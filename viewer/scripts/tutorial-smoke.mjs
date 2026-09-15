import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
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
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE });
try {
    for (const width of [1400, 390]) {
        const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        for (const chapter of ['supply-chain', 'buildings', 'selling', 'bidding', 'keep-cargo', 'scoring']) {
            await page.goto(`${origin}/?chapter=${chapter}`);
            const guide = page.locator('.bgs-tutorial-guide');
            await guide.waitFor();
            for (let step = 0; step < 24; step++) {
                const heading = await guide.locator('.bgs-tutorial-heading strong').innerText();
                if (heading === 'Chapter complete') break;
                const next = guide.getByRole('button', { name: 'Continue', exact: true });
                if (await next.isEnabled()) await next.click();
                else if (await page.locator('.tutorial-bid').count()) {
                    await page.locator('.tutorial-bid input').fill(heading.includes('add $2') ? '2' : '8');
                    await page.locator('.tutorial-bid button').click();
                } else if (heading.includes('What does keeping') || heading.includes('What does selling')) {
                    await page
                        .locator('.tutorial-actions')
                        .getByRole('button', { name: heading.includes('keeping') ? '$24' : '$12', exact: true })
                        .click();
                } else if (heading.includes('Check all five')) {
                    await page.locator('.tutorial-actions').getByRole('button', { name: '$5', exact: true }).click();
                    await guide.getByRole('alert').waitFor();
                    assert.equal(await guide.locator('.bgs-tutorial-heading strong').innerText(), heading);
                    await page.locator('.tutorial-actions').getByRole('button', { name: '$10', exact: true }).click();
                } else if (heading.includes('entire colour'))
                    await page
                        .locator('.tutorial-actions')
                        .getByRole('button', { name: 'dark green', exact: true })
                        .click();
                else await page.locator('.tutorial-actions button').first().click();
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
        await embedded.locator('.tutorial-bid input').fill('8');
        await embedded.locator('.tutorial-bid button').click();
        await embedded
            .locator('.tutorial-actions')
            .getByRole('button', { name: 'Reveal the bids', exact: true })
            .click();
        await embedded.locator('.tutorial-bid input').fill('2');
        await embedded.locator('.tutorial-bid button').click();
        await embeddedGuide.getByText('5/7 · Reveal the additional bids', { exact: true }).waitFor();
        console.log(`Sandboxed auction ${width}px: additional bid submitted`);
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
