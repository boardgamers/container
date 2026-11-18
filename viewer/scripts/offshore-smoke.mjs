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
        page.on('console', (msg) => {
            if (msg.type() === 'error') console.error(msg.text());
        });
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
        await page.waitForSelector('.offshore-bank .offshore-lot', { state: 'attached' });
        assert.equal(await page.locator('.offshore-bank .offshore-lot').count(), 6);
        assert.equal(await page.locator('text=OPTIONAL EXPANSION').count(), 0);
        await page.locator('.offshore-lot[data-type="containers"][data-lot="2"]').click();
        const calculator = page.locator('[data-tutorial="bank-bid"]');
        await calculator.focus();
        await calculator.press('9');
        await calculator.press('9');
        await calculator.press('9');
        await calculator.getByRole('button', { name: 'Bid', exact: true }).click();
        assert.equal(await page.evaluate(() => moves.length), 0, 'invalid cash offer is not submitted');
        await calculator.locator('rect[y="130"][x="50"]').click();
        await page.screenshot({ path: `/tmp/container-offshore-draft-${width}.png`, fullPage: true });
        await calculator.getByRole('button', { name: 'Bid', exact: true }).click();
        const bid = await page.evaluate(() => moves.at(-1));
        assert.equal(bid.at(-1).name, 'callBank');
        assert.equal(bid.at(-1).data.lot, 2);
        for (const action of bid) state = engine.move(state, action, player);
        await push();
        assert.match(
            await page.locator('.offshore-lot[data-type="containers"][data-lot="2"]').locator('..').textContent(),
            /\$2/
        );

        // A fresh turn fixture: calling the bank twice in one turn is illegal.
        state = engine.setup(3, { offshoreIsland: true }, 'offshore-browser');
        state.players.forEach((p, i) => (p.name = ['Ada', 'Benoît', 'Cleo'][i]));
        state.newTurn = true;
        const offered = state.players[player].containersOnFactoryStore[0].piece;
        const second = state.containersLeft.pop();
        state.players[player].containersOnWarehouseStore.push({ piece: second, price: 3, moved: false });
        await push();
        await page.locator('.offshore-lot[data-type="cash"][data-lot="1"]').click();
        await page.locator(`.bank-draft [data-piece-id="${offered.id}"]`).click();
        await page.locator(`.bank-draft [data-piece-id="${second.id}"]`).click();
        assert.equal(await page.evaluate(() => moves.length), 0, 'selection never auto-submits');
        await page.getByRole('button', { name: 'Confirm offer', exact: true }).click();
        const cargoBid = await page.evaluate(() => moves.at(-1));
        assert.equal(cargoBid.at(-1).name, 'callBank');
        assert.equal(cargoBid.at(-1).data.lot, 1);
        assert.deepEqual(cargoBid.at(-1).extraData.containers, [offered.id, second.id]);
        for (const action of cargoBid) state = engine.move(state, action, player);
        await push();

        // The decision is on-board too: no HTML cards, forms, expansion eyebrow or toggle.
        assert.equal(await page.locator('.bank-toggle, #offshore-title, .bank-decision form').count(), 0);
        const own = state.players[player];
        const returned = { piece: state.containersLeft.pop(), price: 2, moved: false };
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
        await page.waitForFunction(() => document.querySelector('.bank-decision')?.textContent.includes('Outbid'));
        assert.equal(
            await page.locator('.bank-decision [data-piece-id]').count(),
            1,
            'spectator sees pending return cargo'
        );
        assert.equal(
            await page.locator('.bank-decision [role="button"]').count(),
            0,
            'spectator has no decision controls'
        );
        await page.evaluate((player) => host.emit('player', { index: player }), player);
        await push();
        await page.getByRole('button', { name: 'Return at $3', exact: true }).click();
        const repricing = await page.evaluate(() => moves.at(-1));
        assert.equal(repricing.length, 1, 'interruption is not appended to the previous bid buffer');
        state = engine.move(state, repricing[0], player);
        assert.equal(state.newTurn, true);
        await push();
        assert.equal(await page.locator('.bank-decision').count(), 0);
        assert.equal(
            state.players[player].containersOnFactoryStore.find((c) => c.piece.id === returned.piece.id).price,
            3
        );

        // Existing journal localization works without a separate web-style panel.
        await page.evaluate(() => host.emit('preferences', { locale: 'fr' }));
        await page.waitForFunction(() =>
            document.querySelector('.inline-game-log')?.textContent.includes('appelle la banque')
        );
        assert.match(await page.locator('.inline-game-log').innerText(), /appelle la banque/);
        assert.match(await page.locator('.inline-game-log').innerText(), /remet un conteneur/);
        await page.locator('.board-scroll').evaluate((el) => {
            el.scrollLeft = 0;
        });
        await page.waitForTimeout(100);
        const bounds = await page.locator('.bank-board').boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'bank visible within board viewport');
        await page.screenshot({ path: `/tmp/container-offshore-${width}.png`, fullPage: true });
        await page.evaluate(() => host.emit('preferences', { locale: 'en' }));

        // Arrival-only pickup, using the displayed holding cargo (no component internals).
        state.players[player].ship.shipPosition = 'offshoreBank';
        state.players[player].lastMove = { name: 'sail', data: 'offshoreBank' };
        const pickup = state.containersLeft.pop();
        state.players[player].bankHolding.push(pickup);
        state.newTurn = true;
        await push();
        await page.locator(`.bank-holding [data-piece-id="${pickup.id}"]`).click();
        const loading = await page.evaluate(() => moves.at(-1));
        assert.equal(loading.at(-1).name, 'loadBankContainer');
        for (const action of loading) state = engine.move(state, action, player);
        assert.ok(state.players[player].ship.containers.some((piece) => piece.id === pickup.id));
        await push();

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
