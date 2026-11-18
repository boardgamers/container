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
        const lotBounds = await page.locator('.offshore-lot[data-type="containers"][data-lot="2"]').boundingBox();
        const pierBounds = await page.locator('.bank-piers').boundingBox();
        assert.ok(pierBounds.x >= lotBounds.x + lotBounds.width, 'harbor is beside the bank lots');
        assert.ok(pierBounds.x - lotBounds.x - lotBounds.width < 12, 'harbor joins the bank, not a distant area');
        assert.equal(await page.getByText('BANK HARBOR', { exact: true }).count(), 0);
        await page.locator('.offshore-lot[data-type="containers"][data-lot="2"]').click();
        const checkDraft = async (type, lot) => {
            const selected = page.locator('.offshore-lot.selected');
            assert.equal(await selected.count(), 1);
            assert.equal(await selected.getAttribute('data-type'), type);
            assert.equal(await selected.getAttribute('data-lot'), String(lot));
            assert.equal(await selected.getAttribute('aria-pressed'), 'true');
            assert.equal(await selected.evaluate((el) => getComputedStyle(el).stroke), 'rgb(0, 0, 255)');
            assert.equal(await page.locator('.bank-bid-guidance').count(), 0);
            const draft = page.locator(type === 'cash' ? '.bank-draft-focus' : '.bank-draft');
            await draft.scrollIntoViewIfNeeded();
            const bounds = await draft.boundingBox();
            const svg = await draft.evaluate((el) => {
                const r = el.ownerSVGElement.getBoundingClientRect();
                return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
            });
            assert.ok(
                bounds.x >= svg.x &&
                    bounds.y >= svg.y &&
                    bounds.x + bounds.width <= svg.right + 1 &&
                    bounds.y + bounds.height <= svg.bottom + 1,
                'draft within SVG'
            );
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'complete draft visible horizontally');
        };
        // Zero cancels this bank draft only, by either mouse or keyboard.
        for (const keyboard of [false, true]) {
            const zeroCalculator = page.locator('[data-tutorial="bank-bid"]');
            assert.equal(
                await page.locator('.bank-draft').getByRole('button', { name: 'Cancel', exact: true }).count(),
                0
            );
            if (keyboard) {
                await zeroCalculator.focus();
                await zeroCalculator.press('0');
                await zeroCalculator.press('Enter');
            } else await zeroCalculator.getByRole('button', { name: 'Bid', exact: true }).click();
            assert.equal(await page.locator('.bank-draft, .offshore-lot.selected').count(), 0);
            assert.equal(await page.evaluate(() => moves.length), 0);
            await page.locator('.offshore-lot[data-type="containers"][data-lot="2"]').click();
        }
        await checkDraft('containers', 2);
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
        assert.match(await page.locator('.bank-bid-amount').textContent(), /^\$2/);
        assert.equal(await page.locator('.bank-bid-amount').getAttribute('font-size'), '16');
        const tokenBounds = await page.locator('.bank-bidder circle').first().boundingBox();
        const amountBounds = await page.locator('.bank-bid-amount').boundingBox();
        assert.ok(amountBounds.x > tokenBounds.x + tokenBounds.width, 'cash bid is beside, not below, the token');
        assert.ok(
            Math.abs(amountBounds.y + amountBounds.height / 2 - tokenBounds.y - tokenBounds.height / 2) < 8,
            'cash bid and token are aligned'
        );
        assert.equal(await page.getByRole('button', { name: 'Sail to bank', exact: true }).count(), 0);
        const bidder = page.locator('.bank-bidder');
        assert.equal(await bidder.getAttribute('aria-label'), state.players[player].name);
        assert.equal((await bidder.locator('text').textContent()).trim(), String(player + 1));
        await page.evaluate(() => host.emit('preferences', { colorBlind: false }));
        await page.waitForFunction(() => !document.querySelector('.bank-bidder text'));
        assert.equal(await bidder.locator('text').count(), 0, 'normal mode shows only a player token');
        await page.evaluate(() => host.emit('preferences', { colorBlind: true }));
        await page.waitForFunction(() => !!document.querySelector('.bank-bidder text'));

        // A fresh turn fixture: calling the bank twice in one turn is illegal.
        state = engine.setup(3, { offshoreIsland: true }, 'offshore-browser');
        state.players.forEach((p, i) => (p.name = ['Ada', 'Benoît', 'Cleo'][i]));
        state.newTurn = true;
        const offered = state.players[player].containersOnFactoryStore[0].piece;
        const second = state.containersLeft.pop();
        state.players[player].containersOnWarehouseStore.push({ piece: second, price: 3, moved: false });
        await push();
        await page.locator('.offshore-lot[data-type="cash"][data-lot="1"]').click();
        await page.locator(`.piece.bid-eligible[data-piece-id="${offered.id}"]`).click();
        await checkDraft('cash', 1);
        assert.equal(await page.locator('.bank-lot-draft [data-piece-id]').count(), 1);
        await page.screenshot({ path: `/tmp/container-offshore-cargo-one-${width}.png`, fullPage: true });
        await page.locator(`.piece.bid-eligible[data-piece-id="${second.id}"]`).click();
        assert.equal(await page.evaluate(() => moves.length), 0, 'selection never auto-submits');
        assert.equal(await page.locator('.piece.canDrag, .loan.canDrag, .offshore-lot.legal').count(), 0);
        assert.equal(await page.locator('.piece.bid-selected').count(), 2);
        assert.equal(
            await page.locator('rect[stroke="blue"]').count(),
            0,
            'no sidebar frame or ordinary action outlines'
        );
        const selectedPiece = page.locator(`.piece[data-piece-id="${second.id}"]`);
        await selectedPiece.focus();
        await selectedPiece.press('Space');
        assert.equal(await selectedPiece.getAttribute('aria-pressed'), 'false');
        await selectedPiece.press('Enter');
        assert.equal(await selectedPiece.getAttribute('aria-pressed'), 'true');
        if (width < 600) await page.locator('.player-board-tab').nth(player).click();
        await page.screenshot({ path: `/tmp/container-offshore-cargo-focus-${width}.png`, fullPage: true });

        await page.locator(`.piece.bid-eligible[data-piece-id="${offered.id}"]`).click();
        await page.locator(`.piece.bid-eligible[data-piece-id="${second.id}"]`).click();
        assert.equal(await page.locator('.bank-lot-draft [data-piece-id]').count(), 0);
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        assert.equal(await page.locator('.bid-eligible, .bid-selected, .bank-draft').count(), 0);
        assert.ok((await page.locator('.piece.canDrag').count()) > 0, 'cancel restores ordinary actions');
        assert.equal(await page.evaluate(() => moves.length), 0);
        await page.locator('.offshore-lot[data-type="cash"][data-lot="1"]').click();
        await page.locator(`.piece.bid-eligible[data-piece-id="${offered.id}"]`).click();
        await page.locator(`.piece.bid-eligible[data-piece-id="${second.id}"]`).click();
        if (width < 600) {
            await page.getByRole('button', { name: 'Bid (2)', exact: true }).click();
            assert.equal(await page.locator('.piece.bid-selected').count(), 2, 'navigation preserves draft');
        }
        await checkDraft('cash', 1);
        await page.screenshot({ path: `/tmp/container-offshore-cargo-draft-${width}.png`, fullPage: true });
        assert.equal(await page.locator('.bank-draft-action').count(), 1);
        assert.deepEqual(
            await page
                .locator('.bank-lot-draft [data-piece-id]')
                .evaluateAll((els) => els.map((el) => el.dataset.pieceId)),
            [offered.id, second.id]
        );
        await page.locator('.bank-draft-action').click();
        const cargoBid = await page.evaluate(() => moves.at(-1));
        assert.equal(cargoBid.at(-1).name, 'callBank');
        assert.equal(cargoBid.at(-1).data.lot, 1);
        assert.deepEqual(cargoBid.at(-1).extraData.containers, [offered.id, second.id]);
        for (const action of cargoBid) state = engine.move(state, action, player);
        await push();

        await page.locator('.board-scroll').evaluate((el) => {
            el.scrollLeft = 0;
        });
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `/tmp/container-offshore-bid-zones-${width}.png`, fullPage: true });
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

        // Sail using the normal ship selection/destination flow, without a separate button.
        state.players[player].ship.shipPosition = engine.ShipPosition.OpenSea;
        state.players[player].lastMove = null;
        state.players[player].actions = 2;
        const pickup = state.containersLeft.pop();
        state.players[player].bankHolding.push(pickup, ...state.containersLeft.splice(-7));
        state.players[(player + 1) % 3].bankHolding.push(state.containersLeft.pop());
        state.newTurn = true;
        await push();
        await page
            .locator('.piece')
            .filter({ hasText: `${state.players[player].name}'s Ship` })
            .click();
        assert.equal(await page.locator('.bank-harbor').count(), 5);
        assert.equal(await page.locator('.bank-harbor.showDrop').count(), 1);
        assert.equal(await page.locator('.bank-harbor.canClick').getAttribute('data-berth'), String(player));
        await page.locator('.bank-harbor.canClick').click();
        const sailing = await page.evaluate(() => moves.at(-1));
        assert.deepEqual(sailing.at(-1), { name: 'sail', data: 'offshoreBank' });
        for (const action of sailing) state = engine.move(state, action, player);
        assert.equal(state.players[player].ship.shipPosition, 'offshoreBank');
        await push();
        // Ship and waiting cargo share a player-colored berth, never the same space.
        await page.waitForTimeout(1200);
        const ownBerth = page.locator(`.bank-berth[data-owner="${player}"]`);
        await ownBerth.scrollIntoViewIfNeeded();
        const holdingBounds = await ownBerth.locator('.bank-holding').boundingBox();
        const shipBounds = await page
            .locator('.piece')
            .filter({ hasText: `${state.players[player].name}'s Ship` })
            .boundingBox();
        assert.ok(shipBounds.x + shipBounds.width < holdingBounds.x, 'ship never overlaps waiting cargo');
        assert.equal(await page.locator('.bank-berth').count(), 3);
        assert.equal(await ownBerth.locator('[data-piece-id]').count(), 2);
        await ownBerth.getByRole('button', { name: 'Next cargo page' }).click();
        assert.equal(await ownBerth.locator('[data-piece-id]').count(), 2);
        await ownBerth.getByRole('button', { name: 'Previous cargo page' }).click();
        await page.screenshot({ path: `/tmp/container-offshore-harbor-${width}.png`, fullPage: true });
        // Arrival-only pickup still uses the displayed holding cargo.
        await page.locator(`.bank-holding [data-piece-id="${pickup.id}"]`).click();
        const loading = await page.evaluate(() => moves.at(-1));
        assert.equal(loading.at(-1).name, 'loadBankContainer');
        // The emitted turn buffer includes sailing, already applied to this fixture above.
        state = engine.move(state, loading.at(-1), player);
        assert.ok(state.players[player].ship.containers.some((piece) => piece.id === pickup.id));
        await push();

        // Pick the payment color, not the destination: lot II is frozen by an auction.
        const payments = ['orange', 'white', 'orange'].map((color) => {
            const index = state.containersLeft.findIndex((piece) => piece.color === color);
            assert.ok(index >= 0);
            return state.containersLeft.splice(index, 1)[0];
        });
        state.offshoreBank.auctions = [
            { type: 'containers', lot: 1, bidder: (player + 1) % 3, cash: 2, containers: [] },
        ];
        state.offshoreBank.decision = {
            kind: 'distribute',
            player,
            resumePlayer: player,
            containers: [],
            payment: payments.slice(),
            cursor: 0,
        };
        state.phase = 'bankDecision';
        state.newTurn = true;
        state.currentPlayers = [player];
        await push();
        const checkPayment = async (lot, stage) => {
            assert.equal(await page.locator('.offshore-lot.destination').getAttribute('data-lot'), String(lot));
            assert.equal(await page.locator('.offshore-lot[role="button"]').count(), 0);
            assert.equal(await page.locator('.bank-decision > text').count(), 0);
            assert.equal(await page.evaluate(() => moves.length), 0, 'never auto-pay');
            await page.waitForTimeout(1200);
            await page.screenshot({ path: `/tmp/container-offshore-payment-${stage}-${width}.png`, fullPage: true });
        };
        await checkPayment(0, 'choice');
        // Spectators see destination and pending cargo, but cannot choose or bid.
        await page.evaluate((state) => {
            host.emit('player', { index: undefined });
            host.emit('state', state);
        }, engine.stripSecret(copy(state)));
        assert.equal(await page.locator('.bank-decision [role="button"]').count(), 0);
        assert.equal(await page.locator('.offshore-lot.destination').getAttribute('data-lot'), '0');
        await page.evaluate((player) => host.emit('player', { index: player }), player);
        await push();
        for (const [index, lot] of [
            [1, 0],
            [0, 2],
            [2, 0],
        ]) {
            await page.locator(`.bank-choice [data-piece-id="${payments[index].id}"]`).click();
            const actions = await page.evaluate(() => moves.at(-1));
            assert.equal(actions.length, 1);
            assert.equal(actions[0].name, 'distributeBankContainer');
            state = engine.move(state, actions[0], player);
            assert.ok(state.offshoreBank.containerLots[lot].some((piece) => piece.id === payments[index].id));
            await push();
            if (index === 1) await checkPayment(2, 'skip');
            if (index === 0) await checkPayment(0, 'last');
        }
        assert.equal(await page.locator('.bank-decision, .offshore-lot.destination').count(), 0);

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
        assert.equal(await page.evaluate(() => moves.length), 0, 'single payment requires explicit click');
        await page.locator('.bank-choice [data-piece-id][role="button"]').click();
        const distribution = await page.evaluate(() => moves.at(-1));
        assert.equal(distribution.length, 1);
        state = engine.move(state, distribution[0], player);
        assert.equal(state.phase, 'gameEnd');
        await push();
        await page.waitForFunction(() => document.querySelector('.statusBar')?.textContent.includes('Game ended'));
        // Five fixed assignments, all docked; waiting cargo belongs to the same colored row.
        state = engine.setup(5, { offshoreIsland: true }, 'offshore-five-harbors');
        state.currentPlayers = [player];
        state.players.forEach((p, i) => {
            p.name = `Trader ${i + 1}`;
            p.ship.shipPosition = engine.ShipPosition.OffshoreBank;
            p.bankHolding = state.containersLeft.splice(-7);
        });
        await push();
        await page.waitForTimeout(1200);
        assert.equal(await page.locator('.bank-berth').count(), 5);
        assert.equal(await page.locator('.bank-berth .player-token, .bank-berth [fill-opacity]').count(), 0);
        assert.equal(await page.locator('.bank-berth-border[fill="none"][stroke-width="2"]').count(), 5);
        for (let i = 0; i < 5; i++) {
            const berth = page.locator(`.bank-berth[data-owner="${i}"]`);
            const cargo = await berth.locator('.bank-holding').boundingBox();
            const ship = await page
                .locator('.piece')
                .filter({ hasText: `Trader ${i + 1}'s Ship` })
                .boundingBox();
            const bounds = await berth.boundingBox();
            assert.ok(ship.x + ship.width < cargo.x);
            assert.ok(cargo.x >= bounds.x && cargo.x + cargo.width <= bounds.x + bounds.width + 1);
            assert.ok(cargo.y >= bounds.y && cargo.y + cargo.height <= bounds.y + bounds.height);
            assert.ok(
                ship.y >= bounds.y - 2 && ship.y + ship.height <= bounds.y + bounds.height + 2,
                JSON.stringify({ i, ship, bounds })
            );
        }
        await page.locator(`.bank-berth[data-owner="${player}"]`).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `/tmp/container-offshore-five-harbors-${width}.png`, fullPage: true });
        await page.evaluate((state) => {
            host.emit('player', { index: undefined });
            host.emit('state', state);
        }, engine.stripSecret(copy(state)));
        assert.equal(await page.locator('.bank-holding [data-piece-id][role="button"]').count(), 0);
        assert.equal(await page.locator('.bank-harbor.canClick').count(), 0);
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
