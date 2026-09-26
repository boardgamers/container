import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
require('../../engine/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'CommonJS', moduleResolution: 'Node', target: 'ES2022', importHelpers: false },
});
const { lessons } = require('../src/tutorial/lessons');

const viewer = new URL('../', import.meta.url);
const files = {
    '/bundle.js': fileURLToPath(new URL('dist/container-viewer.umd.min.js', viewer)),
    '/bundle.css': fileURLToPath(new URL('dist/container-viewer.css', viewer)),
    '/vue.js': require.resolve('vue/dist/vue.min.js'),
};
const html =
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/bundle.css"><div id="app"></div><script src="/vue.js"></script><script src="/bundle.js"></script><script>container.launchTutorial("#app",{locale:"fa-IR",chapter:new URLSearchParams(location.search).get("chapter")||"supply-chain"});</script>';
const server = createServer(async (req, res) => {
    const request = new URL(req.url, 'http://localhost');
    const path = request.pathname;
    if (request.searchParams.has('embedded')) {
        res.setHeader('content-type', 'text/html');
        res.end(
            '<!doctype html><meta name=viewport content=width=device-width,initial-scale=1><iframe style=width:100%;height:900px sandbox="allow-scripts allow-same-origin" src="/?chapter=bidding"></iframe>'
        );
        return;
    }
    if (files[path]) {
        res.setHeader('content-type', path.endsWith('.css') ? 'text/css' : 'text/javascript');
        res.end(await readFile(files[path]));
    } else {
        res.setHeader('content-type', 'text/html');
        res.end(html);
    }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
async function playOnBoard(page, move) {
    if (move.name === 'pass') return page.locator('[data-tutorial="turn"]').click();
    if (move.name === 'bid') {
        const keys = [7, 8, 9, 4, 5, 6, 1, 2, 3, 0, 'Del', 'Bid'];
        for (const digit of String(move.extraData.price))
            await page
                .locator('.calculator rect.button')
                .nth(keys.indexOf(Number(digit)))
                .click();
        await page.locator('.calculator rect.button').last().click();
        if (await page.locator('.modal.visible').isVisible())
            await page.locator('.modal.visible').getByRole('button', { name: 'تأیید', exact: true }).click();
        return;
    }
    if (move.name === 'accept') return page.locator('g.button').filter({ hasText: 'Accept Ada' }).click();
    if (move.name === 'decline') return page.locator('g.button').filter({ hasText: 'Keep for $6' }).click();
    const id = move.name === 'produce' ? move.extraData.piece.id : move.data?.piece?.id ?? move.extraData?.id;
    const pieces = page.locator('.piece.canDrag');
    const index = await pieces.evaluateAll(
        (els, { id, sail, factory }) =>
            els.findLastIndex((el) =>
                sail
                    ? el.__vue__.pieceType === 'ship' && el.__vue__.owner === 0
                    : factory
                    ? el.__vue__.pieceType === 'factory' && el.__vue__.color === factory
                    : el.__vue__.pieceId === id
            ),
        { id, sail: move.name === 'sail', factory: move.name === 'buyFactory' ? move.data : undefined }
    );
    assert.ok(index >= 0, 'piece available for ' + move.name);
    await pieces.nth(index).click();
    const zones = page.locator('.placeholder.canClick');
    const type = {
        produce: 'factoryStore',
        buyFromFactory: 'warehouseStore',
        buyFactory: 'factory',
        buyWarehouse: 'warehouse',
        sail: move.data === 'sea' ? 'openSea' : 'islandHarbor',
    }[move.name];
    const zone = await zones.evaluateAll(
        (els, { type, price }) =>
            els.findIndex(
                (el) => el.__vue__.data.type === type && (price === undefined || el.__vue__.data.price === price)
            ),
        { type, price: move.extraData?.price }
    );
    assert.ok(zone >= 0, 'destination available for ' + move.name + ' ' + type);
    const bounds = await zones.nth(zone).boundingBox();
    await zones.nth(zone).click({
        position: {
            x: bounds.width * (type === 'factory' || type === 'warehouse' ? 0.4 : 0.15),
            y: bounds.height * 0.4,
        },
    });
    if (await page.locator('.modal.visible').isVisible())
        await page.locator('.modal.visible').getByRole('button', { name: 'تأیید', exact: true }).click();
}

const browser = await chromium.launch();
try {
    for (const width of [1440, 390]) {
        const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        for (const lesson of lessons) {
            await page.goto(`${origin}/?chapter=${lesson.id}`);
            const guide = page.locator('.bgs-tutorial-guide');
            await guide.waitFor();
            await page.waitForFunction(() =>
                /[\u0600-\u06ff]/.test(document.querySelector('.bgs-tutorial-body')?.textContent ?? '')
            );
            assert.equal(await guide.evaluate((el) => getComputedStyle(el).direction), 'rtl');
            assert.equal(
                await page.locator('.container-tutorial').evaluate((el) => getComputedStyle(el).direction),
                'ltr'
            );
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        }
        const lesson = lessons.find((l) => l.id === 'supply-chain');
        await page.goto(`${origin}/?chapter=${lesson.id}`);
        const guide = page.locator('.bgs-tutorial-guide');
        await guide.waitFor();
        let state = lesson.initialState();
        for (let step = 0; step < 24; step++) {
            const heading = await guide.locator('.bgs-tutorial-heading strong').innerText();
            if (heading === 'فصل تمام شد') break;
            const next = guide.getByRole('button', { name: 'ادامه', exact: true });
            if (await next.isEnabled()) await next.click();
            else {
                const stepId = await page.locator('.container-tutorial').getAttribute('data-step');
                const action = lesson.choices(state, stepId)[0]?.action;
                assert.ok(action, `action for ${stepId}`);
                if (action.kind === 'move') await playOnBoard(page, action.move);
                else await page.locator('.tutorial-actions button').first().click();
                state = lesson.move(state, action);
            }
            await page.waitForFunction(
                (previous) => document.querySelector('.bgs-tutorial-heading strong')?.textContent !== previous,
                heading
            );
        }
        assert.equal(await guide.locator('.bgs-tutorial-heading strong').innerText(), 'فصل تمام شد');
        await page.screenshot({ path: `/tmp/container-fa-${width}.png`, fullPage: true });
        assert.deepEqual(errors, []);
        await context.close();
        console.log(`Persian chapters and supply-chain actions passed at ${width}px`);
    }
} finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
}
