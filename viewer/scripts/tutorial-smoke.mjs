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
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/bundle.css"><div id="app"></div><script src="/vue.js"></script><script src="/bundle.js"></script><script>container.launchTutorial("#app",{chapter:new URLSearchParams(location.search).get("chapter")||"supply-chain"});</script>';
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
            await page.locator('.modal.visible').getByRole('button', { name: 'Confirm', exact: true }).click();
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
    await zones
        .nth(zone)
        .click({
            position: {
                x: bounds.width * (type === 'factory' || type === 'warehouse' ? 0.4 : 0.15),
                y: bounds.height * 0.4,
            },
        });
    if (await page.locator('.modal.visible').isVisible())
        await page.locator('.modal.visible').getByRole('button', { name: 'Confirm', exact: true }).click();
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE });
try {
    for (const width of process.env.WIDTH ? [Number(process.env.WIDTH)] : [1400, 390]) {
        const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        for (const lesson of lessons.filter((l) => !process.env.CHAPTER || l.id === process.env.CHAPTER)) {
            const chapter = lesson.id;
            let state = lesson.initialState();
            console.log(`START ${chapter} ${width}`);
            await page.goto(`${origin}/?chapter=${chapter}`);
            const guide = page.locator('.bgs-tutorial-guide');
            await guide.waitFor();
            for (let step = 0; step < 24; step++) {
                const heading = await guide.locator('.bgs-tutorial-heading strong').innerText();
                if (heading === 'Chapter complete') break;
                const next = guide.getByRole('button', { name: 'Continue', exact: true });
                if (await next.isEnabled()) await next.click();
                else if (heading.includes('What does keeping') || heading.includes('What does selling')) {
                    assert.equal(
                        await guide.getByRole('button', { name: 'Show area', exact: true }).isVisible(),
                        false
                    );
                    await page
                        .locator('.tutorial-actions')
                        .getByRole('button', { name: heading.includes('keeping') ? '$24' : '$12', exact: true })
                        .click();
                    await page.getByRole('status').filter({ hasText: 'Correct!' }).waitFor();
                    assert.match(
                        await page.locator('.bgs-tutorial-feedback').innerText(),
                        heading.includes('keeping') ? /\$24 gained/ : /\$12 received/
                    );
                } else if (heading.includes('Check all five')) {
                    assert.equal(
                        await guide.getByRole('button', { name: 'Show area', exact: true }).isVisible(),
                        false
                    );
                    await page.locator('.tutorial-actions').getByRole('button', { name: '$5', exact: true }).click();
                    await guide.getByRole('alert').waitFor();
                    assert.equal(await guide.locator('.bgs-tutorial-heading strong').innerText(), heading);
                    await page.locator('.tutorial-actions').getByRole('button', { name: '$10', exact: true }).click();
                    await page.getByRole('status').filter({ hasText: 'Correct!' }).waitFor();
                } else if (heading.includes('entire colour'))
                    await page
                        .locator('.tutorial-actions')
                        .getByRole('button', { name: 'dark green', exact: true })
                        .click();
                else {
                    const stepId = await page.locator('.container-tutorial').getAttribute('data-step');
                    let action = lesson.choices(state, stepId)[0]?.action;
                    if (chapter === 'bidding' && ['bid', 'raise'].includes(stepId))
                        action = {
                            kind: 'move',
                            move: { name: 'bid', data: true, extraData: { price: stepId === 'bid' ? 8 : 2 } },
                        };
                    assert.ok(action, `action for ${chapter}/${stepId}`);
                    if (action.kind === 'move') {
                        assert.equal(
                            await page.locator('.tutorial-actions button:visible').count(),
                            0,
                            'no ready-made game actions'
                        );
                        await playOnBoard(page, action.move);
                    } else await page.locator('.tutorial-actions button').first().click();
                    state = lesson.move(state, action);
                }
                await page.waitForFunction(
                    (previous) => document.querySelector('.bgs-tutorial-heading strong')?.textContent !== previous,
                    heading
                );
                if (chapter === 'bidding' && heading.includes('Submit a sealed')) {
                    assert.match(await page.locator('.tutorial-auction').innerText(), /Leo: Sealed/);
                    await page.reload();
                    await guide.waitFor();
                    assert.match(
                        await guide.locator('.bgs-tutorial-heading strong').innerText(),
                        /Wait for the other bidder/
                    );
                }
            }
            assert.equal(await guide.locator('.bgs-tutorial-heading strong').innerText(), 'Chapter complete');
            assert.equal(await guide.getByRole('button', { name: 'Continue', exact: true }).isEnabled(), false);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
            assert.equal(await page.locator('.container-chat').count(), 0);
            if (chapter === 'scoring') assert.match(await page.locator('.tutorial-result').innerText(), /\$54/);
            await page.screenshot({ path: `/tmp/container-tutorial-${chapter}-${width}.png`, fullPage: true });
            await page.reload();
            await guide.waitFor();
            assert.equal(await guide.locator('.bgs-tutorial-heading strong').innerText(), 'Chapter complete');
            console.log(JSON.stringify({ chapter, width, complete: true }));
        }
        await page.goto(`${origin}/?embedded=1`);
        const embedded = page.frameLocator('iframe');
        const embeddedGuide = embedded.locator('.bgs-tutorial-guide');
        await embeddedGuide.getByRole('button', { name: 'Back to start', exact: true }).click();
        await embeddedGuide.getByRole('button', { name: 'Continue', exact: true }).click();
        await playOnBoard(embedded, { name: 'bid', extraData: { price: 8 } });
        await embedded
            .locator('.tutorial-actions')
            .getByRole('button', { name: 'Reveal the bids', exact: true })
            .click();
        await playOnBoard(embedded, { name: 'bid', extraData: { price: 2 } });
        await embeddedGuide.getByText('5/7 · Reveal the additional bids', { exact: true }).waitFor();
        console.log(`Sandboxed native auction ${width}px passed`);
        await page.goto(`${origin}/?chapter=selling`);
        await page.evaluate(() => {
            window.container.launch('#app');
        });
        assert.equal(await page.locator('.bgs-tutorial-guide').count(), 0);
        assert.equal(await page.locator('.game').count(), 1);
        await page.evaluate(() => window.container.launchTutorial('#app', { chapter: 'selling' }));
        assert.equal(await page.locator('.game').count(), 1);
        assert.deepEqual(errors, []);
        await context.close();
    }
} finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
}
