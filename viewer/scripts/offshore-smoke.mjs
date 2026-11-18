import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const root = new URL('../../', import.meta.url);
const engine = require(fileURLToPath(new URL('engine/dist/index.js', root)));
const copy = (value) => JSON.parse(JSON.stringify(value));
const files = {
    '/bundle.js': fileURLToPath(new URL('viewer/dist/container-viewer.umd.min.js', root)),
    '/bundle.css': fileURLToPath(new URL('viewer/dist/container-viewer.css', root)),
    '/vue.js': require.resolve('vue/dist/vue.min.js'),
};
const server = createServer(async (req, res) => {
    try {
        if (req.url === '/') {
            res.setHeader('Content-Type', 'text/html');
            res.end(
                '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><div id="app"></div><script src="/vue.js"></script><script src="/bundle.js"></script>'
            );
        } else {
            const locale = /^\/container-viewer\.umd\.min\.locale-[a-zA-Z-]+\.js$/.test(req.url);
            const path = files[req.url] || (locale && fileURLToPath(new URL('viewer/dist' + req.url, root)));
            if (!path) {
                res.statusCode = 404;
                res.end();
                return;
            }
            res.setHeader('Content-Type', req.url.endsWith('.css') ? 'text/css' : 'text/javascript; charset=utf-8');
            res.end(await readFile(path));
        }
    } catch (error) {
        res.statusCode = 500;
        res.end(String(error));
    }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE });
try {
    for (const width of [390, 1400]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(`http://127.0.0.1:${server.address().port}/`);
        let state = engine.setup(3, { offshoreIsland: true }, 'offshore-browser');
        const player = state.currentPlayers[0];
        state.players.forEach((p, i) => (p.name = ['Ada', 'Benoît', 'Cleo'][i]));
        state.newTurn = true;
        await page.evaluate(
            ({ state, player }) => {
                window.host = container.launch('#app');
                window.moves = [];
                host.on('move', (value) => moves.push(value));
                host.emit('preferences', { sound: false, colorBlind: true });
                host.emit('player', { index: player });
                host.emit('state', state);
            },
            { state: engine.stripSecret(copy(state), player), player }
        );
        const push = async () => {
            state.players[player].availableMoves = engine.availableMoves(state, state.players[player]);
            await page.evaluate((state) => {
                moves.length = 0;
                host.emit('state', state);
            }, engine.stripSecret(copy(state), player));
        };
        await page.waitForSelector('.offshore-lot', { state: 'attached' });
        if (width <= 600) {
            assert.equal(await page.locator('.bank-toggle').getAttribute('aria-expanded'), 'false');
            await page.getByRole('button', { name: 'Show bank', exact: true }).click();
        }
        assert.equal(await page.locator('.offshore-lot').count(), 6);
        await page.locator('.offshore-lot').nth(3).getByRole('button', { name: 'Call Bank', exact: true }).click();
        await page.locator('#bank-cash-bid').fill('2');
        await page.getByRole('button', { name: 'Place public bid', exact: true }).click();
        const bid = await page.evaluate(() => moves.at(-1));
        assert.equal(bid.at(-1).name, 'callBank');
        for (const action of bid) state = engine.move(state, action, player);
        await push();
        assert.match(await page.locator('.offshore-lot').nth(3).innerText(), /Cash in escrow: \$2/);

        await page.getByRole('button', { name: 'Hide bank', exact: true }).click();
        // A returned container is a committed interruption belonging to its owner.
        const own = state.players[player];
        const returned = own.containersOnFactoryStore.pop();
        assert.ok(returned);
        state.newTurn = true;
        state.phase = 'bankDecision';
        state.currentPlayers = [player];
        state.offshoreBank.decision = {
            kind: 'return',
            player,
            resumePlayer: player,
            containers: [{ container: returned, district: 'factory' }],
            payment: [],
            cursor: 0,
        };
        await page.evaluate((state) => {
            host.emit('player', { index: undefined });
            host.emit('state', state);
        }, engine.stripSecret(copy(state)));
        await page.getByRole('button', { name: 'Show bank', exact: true }).click();
        await page.waitForFunction(() =>
            document.querySelector('.bank-decision')?.textContent.includes('Awaiting bank choice')
        );
        assert.equal(
            await page.locator('.bank-decision .offshore-cargo-piece').count(),
            1,
            'spectator sees pending return cargo'
        );
        assert.equal(await page.locator('.bank-decision button').count(), 0, 'spectator has no decision controls');
        await page.evaluate((player) => host.emit('player', { index: player }), player);
        await push();
        await page.getByRole('button', { name: 'Return at $3', exact: true }).click();
        const repricing = await page.evaluate(() => moves.at(-1));
        assert.equal(repricing.length, 1, 'interruption is not appended to the previous bid buffer');
        state = engine.move(state, repricing[0], player);
        assert.equal(state.newTurn, true);
        await push();
        assert.equal(await page.locator('.bank-choice').count(), 0);
        assert.equal(
            state.players[player].containersOnFactoryStore.find((c) => c.piece.id === returned.piece.id).price,
            3
        );

        // Public lots and escrow remain visible after French localization and on phones.
        await page.evaluate(() => host.emit('preferences', { locale: 'fr' }));
        await page.waitForFunction(() => document.querySelector('#offshore-title')?.textContent === 'Île offshore');
        assert.match(await page.locator('.offshore-bank').innerText(), /Lot d’argent/);
        assert.match(await page.locator('.offshore-bank').innerText(), /Argent consigné/);
        assert.match(await page.locator('.inline-game-log').innerText(), /appelle la banque/);
        assert.match(await page.locator('.inline-game-log').innerText(), /remet un conteneur/);
        const bounds = await page.locator('.offshore-bank').boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'panel fits viewport');
        assert.equal(await page.locator('.offshore-bank').evaluate((el) => el.scrollWidth <= el.clientWidth + 1), true);
        await page.screenshot({ path: `/tmp/container-offshore-${width}.png`, fullPage: true });
        await page.evaluate(() => host.emit('preferences', { locale: 'en' }));

        // Final cash settlement must remain clickable with opponents' point cards stripped.
        const payment = state.players[player].containersOnFactoryStore.pop();
        const auction = {
            type: 'cash',
            lot: 0,
            bidder: player,
            cash: 0,
            containers: [{ container: payment, district: 'factory' }],
        };
        state.offshoreBank.auctions = [auction];
        state.offshoreBank.decision = {
            kind: 'distribute',
            player,
            resumePlayer: player,
            containers: [],
            payment: [payment.piece],
            cursor: 0,
            settlement: copy(auction),
            ending: true,
        };
        state.phase = 'bankDecision';
        state.newTurn = true;
        state.currentPlayers = [player];
        await push();
        await page.getByRole('button', { name: 'Distribute next', exact: true }).click();
        const distribution = await page.evaluate(() => moves.at(-1));
        assert.equal(distribution.length, 1);
        state = engine.move(state, distribution[0], player);
        assert.equal(state.phase, 'gameEnd');
        await push();
        await page.waitForFunction(() => document.querySelector('.statusBar')?.textContent.includes('Game ended'));
        assert.deepEqual(errors, []);
        await page.close();
        console.log(
            `Offshore browser smoke passed: ${width}px, stripped state, bids, interruption, final settlement, French.`
        );
    }
} finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
}
