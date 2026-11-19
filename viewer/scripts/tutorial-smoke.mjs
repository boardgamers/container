import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
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
// Catalogue names are the whitelist; preserve packaged chunk casing (pt-BR, zh-CN, zh-TW).
const locales = (await readdir(new URL('src/localization/', viewer)))
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -5));
const files = {
    '/bundle.js': fileURLToPath(new URL('dist/container-viewer.umd.min.js', viewer)),
    '/bundle.css': fileURLToPath(new URL('dist/container-viewer.css', viewer)),
    '/vue.js': require.resolve('vue/dist/vue.min.js'),
};
for (const locale of locales.filter((locale) => locale !== 'en')) {
    const name = `container-viewer.umd.min.locale-${locale}.js`;
    files[`/${name}`] = fileURLToPath(new URL(`dist/${name}`, viewer));
}
const html =
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/bundle.css"><div id="app"></div><script src="/vue.js"></script><script src="/bundle.js"></script><script>container.launchTutorial("#app",{chapter:new URLSearchParams(location.search).get("chapter")||"supply-chain",locale:new URLSearchParams(location.search).get("locale")||"en"});</script>';
const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const request = new URL(req.url, 'http://localhost');
    const path = request.pathname;
    if (request.searchParams.has('embedded')) {
        res.setHeader('content-type', 'text/html');
        res.end(
            '<!doctype html><meta name=viewport content=width=device-width,initial-scale=1><iframe style=width:100%;height:900px sandbox="allow-scripts allow-same-origin" src="/?chapter=bidding"></iframe>'
        );
        return;
    }
    try {
        if (files[path]) {
            res.setHeader('content-type', path.endsWith('.css') ? 'text/css' : 'text/javascript; charset=utf-8');
            res.end(await readFile(files[path]));
        } else if (path === '/favicon.ico') {
            res.statusCode = 204;
            res.end();
        } else if (path === '/') {
            res.setHeader('content-type', 'text/html');
            res.end(html);
        } else {
            res.statusCode = 404;
            res.end('Not found');
        }
    } catch (error) {
        res.statusCode = 500;
        res.end(String(error));
    }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
// Model BGS's cross-origin CDN classic script, without a crossorigin attribute.
const crossOriginHost = createServer((req, res) => {
    if (req.url === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(html.replace(/(src|href)="\//g, `$1="${origin}/`));
});
await new Promise((resolve) => crossOriginHost.listen(0, '127.0.0.1', resolve));
const tutorialHost = `http://127.0.0.1:${crossOriginHost.address().port}`;
async function playOnBoard(page, move) {
    if (move.name === 'callBank') {
        await page.locator(`.offshore-lot[data-type="${move.data.type}"][data-lot="${move.data.lot}"]`).click();
        assert.equal(await page.locator('.offshore-lot.selected').count(), 1);
        if (move.data.type === 'containers') {
            const calc = page.locator('[data-tutorial="bank-bid"]');
            await calc.focus();
            for (const digit of String(move.extraData.cash)) await calc.press(digit);
            await calc.getByRole('button', { name: 'Bid', exact: true }).click();
        } else {
            for (const id of move.extraData.containers)
                await page.locator(`.piece.bid-eligible[data-piece-id="${id}"]`).click();
            assert.equal(
                await page.locator('.bank-lot-draft [data-piece-id]').count(),
                move.extraData.containers.length
            );
            assert.equal(await page.locator('.bank-draft-action').count(), 1);
            await page.screenshot({
                path: `/tmp/container-tutorial-${process.env.CHAPTER || 'bank'}-draft-${page.viewportSize().width}.png`,
                fullPage: true,
            });
            await page.locator('.bank-draft-action').click();
        }
        return;
    }
    if (move.name === 'returnBankContainer')
        return page.getByRole('button', { name: `Return at $${move.extraData.price}`, exact: true }).click();
    if (move.name === 'distributeBankContainer')
        return page.locator(`.bank-choice [data-piece-id="${move.data.id}"]`).click();
    if (move.name === 'loadBankContainer')
        return page.locator(`.bank-holding [data-piece-id="${move.data.id}"]`).click();
    if (move.name === 'sail' && move.data === 'offshoreBank') {
        await page.locator('.piece').filter({ hasText: "You's Ship" }).click();
        await page.locator('.bank-harbor.canClick').click();
        return;
    }
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
    await zones.nth(zone).click({
        position: {
            x: bounds.width * (type === 'factory' || type === 'warehouse' ? 0.4 : 0.15),
            y: bounds.height * 0.4,
        },
    });
    if (await page.locator('.modal.visible').isVisible())
        await page.locator('.modal.visible').getByRole('button', { name: 'Confirm', exact: true }).click();
}

// One real bank bid per locale is enough here: the English suite below walks every
// chapter. Fresh contexts prevent saved tutorial progress/locale from hiding fallbacks.
async function localizedOffshoreSmoke(browser) {
    const lesson = lessons.find((lesson) => lesson.id === 'offshore-cargo');
    assert.ok(lesson);
    assert.equal(locales.length, 17, 'exercise all supported catalogue languages');
    let englishGeometry;
    for (const locale of ['en', ...locales.filter((locale) => locale !== 'en')]) {
        const catalog = JSON.parse(await readFile(new URL(`src/localization/${locale}.json`, viewer), 'utf8'));
        const translated = (source) => {
            if (locale === 'en') return source;
            assert.ok(typeof catalog[source] === 'string' && catalog[source].trim(), `${locale}: missing ${source}`);
            return catalog[source];
        };
        const first = lesson.steps[0];
        const title = translated(first.title);
        const instruction = translated(first.text);
        if (locale !== 'en') {
            assert.notEqual(title, first.title, `${locale}: English step-title fallback`);
            assert.notEqual(instruction, first.text, `${locale}: English instruction fallback`);
        }
        const context = await browser.newContext({ viewport: { width: 390, height: 950 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const errors = [];
        const loadedChunks = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
            if (message.type() === 'error' || message.text().includes('Could not load game language'))
                errors.push(message.text());
        });
        page.on('requestfailed', (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
        page.on('response', (response) => {
            if (response.url().includes('.locale-')) loadedChunks.push(new URL(response.url()).pathname);
            if (response.status() >= 400 && !response.url().endsWith('/favicon.ico'))
                errors.push(`${response.status()}: ${response.url()}`);
        });
        try {
            await page.goto(`${tutorialHost}/?chapter=${lesson.id}&locale=${encodeURIComponent(locale)}`);
            await page.waitForFunction(
                ({ title, instruction, locale }) =>
                    document.querySelector('.container-tutorial')?.lang === locale &&
                    document.querySelector('.bgs-tutorial-heading strong')?.textContent.includes(title) &&
                    Array.from(document.querySelectorAll('.bgs-tutorial-body p')).some(
                        (p) => p.textContent.trim() === instruction
                    ),
                { title, instruction, locale }
            );
            const guide = page.locator('.bgs-tutorial-guide');
            assert.ok((await guide.innerText()).includes(instruction), `${locale}: full translated instruction`);
            const geometry = await page.locator('.offshore-lot').evaluateAll((lots) =>
                lots.map((lot) => ({
                    type: lot.dataset.type,
                    lot: lot.dataset.lot,
                    transform: lot.parentElement.getAttribute('transform'),
                    width: lot.getAttribute('width'),
                    height: lot.getAttribute('height'),
                    matrix: ['a', 'b', 'c', 'd', 'e', 'f'].map((key) => lot.getCTM()[key]),
                }))
            );
            assert.equal(geometry.length, 6);
            if (locale === 'en') englishGeometry = geometry;
            if (locale === 'fa') {
                assert.equal(await guide.evaluate((el) => getComputedStyle(el).direction), 'rtl');
                assert.equal(
                    await page.locator('.container-tutorial').evaluate((el) => getComputedStyle(el).direction),
                    'ltr'
                );
                assert.equal(
                    await page.locator('.offshore-bank').evaluate((el) => getComputedStyle(el).direction),
                    'ltr'
                );
                assert.deepEqual(
                    geometry,
                    englishGeometry,
                    'Persian must not mirror/reorder/resize the physical board'
                );
            }
            const assertReadable = async () => {
                assert.equal(
                    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
                    false,
                    `${locale}: no horizontal page overflow`
                );
                const clipped = await guide.locator('button:visible').evaluateAll((buttons) =>
                    buttons
                        .filter((button) => {
                            const box = button.getBoundingClientRect();
                            return (
                                !(
                                    button.textContent.trim() ||
                                    button.getAttribute('aria-label') ||
                                    button.getAttribute('title')
                                ) ||
                                box.width <= 0 ||
                                box.height < 32 ||
                                box.left < -1 ||
                                box.right > innerWidth + 1 ||
                                button.scrollWidth > button.clientWidth + 1
                            );
                        })
                        .map((button) => button.textContent)
                );
                assert.deepEqual(clipped, [], `${locale}: readable guide controls`);
            };
            await assertReadable();
            // Complete the first step using the board and the localized bank calculator.
            await page.locator('.offshore-lot[data-type="containers"][data-lot="0"]').click();
            const calculator = page.locator('[data-tutorial="bank-bid"]');
            await calculator.focus();
            await calculator.press('1');
            const bid = calculator.getByRole('button', { name: translated('Bid'), exact: true });
            assert.equal(await bid.isEnabled(), true, `${locale}: localized Bid control`);
            if (['fr', 'fa', 'zh-CN'].includes(locale))
                await page.screenshot({ path: `/tmp/container-tutorial-offshore-${locale}-390.png`, fullPage: true });
            await bid.click();
            const nextTitle = translated(lesson.steps[1].title);
            await page.waitForFunction(
                (title) => document.querySelector('.bgs-tutorial-heading strong')?.textContent.includes(title),
                nextTitle
            );
            await assertReadable();
            if (locale !== 'en')
                assert.ok(
                    loadedChunks.includes(`/container-viewer.umd.min.locale-${locale}.js`),
                    `${locale}: packaged sidecar loaded`
                );
            assert.deepEqual(errors, [], `${locale}: no browser or locale loading errors`);
            console.log(JSON.stringify({ chapter: lesson.id, locale, width: 390, localizedFirstStep: true }));
        } finally {
            await context.close();
        }
    }
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE });
try {
    await localizedOffshoreSmoke(browser);
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
            await page.screenshot({ path: `/tmp/container-tutorial-${chapter}-start-${width}.png`, fullPage: true });
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
                    if (chapter.startsWith('offshore-'))
                        await page.screenshot({
                            path: `/tmp/container-tutorial-${chapter}-${stepId}-${width}.png`,
                            fullPage: true,
                        });
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
    await new Promise((resolve) => crossOriginHost.close(resolve));
    await new Promise((resolve) => server.close(resolve));
}
