import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const game = 'container';
const require = createRequire(import.meta.url);
const repo = new URL('../../', import.meta.url);
const engine = require(fileURLToPath(new URL('engine/dist/index.js', repo)));
const server = createServer(async (req, res) => {
    try {
        if (req.url === '/') {
            res.setHeader('Content-Type', 'text/html');
            res.end(
                '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/container-viewer.css"><div id="app"></div><script src="/vue.js"></script><script src="/container-viewer.umd.min.js"></script>'
            );
        } else {
            res.setHeader('Content-Type', req.url.endsWith('.css') ? 'text/css' : 'text/javascript');
            res.end(
                await readFile(
                    req.url === '/vue.js'
                        ? require.resolve('vue/dist/vue.min.js')
                        : fileURLToPath(new URL('viewer/dist' + req.url, repo))
                )
            );
        }
    } catch {
        res.writeHead(404);
        res.end();
    }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch();
try {
    for (const width of [390, 1400]) {
        const page = await browser.newPage({ viewport: { width, height: 950 } });
        const errors = [];
        const requests = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('response', (r) => {
            if (r.url().includes('locale-')) requests.push({ url: r.url(), status: r.status() });
        });
        await page.goto(`http://127.0.0.1:${server.address().port}/`);
        const state = JSON.parse(JSON.stringify(engine.setup(3, {}, '17')));
        state.newTurn = true;
        state.players.forEach((p, i) => (p.name = ['You', 'Ada', 'Leo'][i]));
        await page.evaluate((state) => {
            window.host = container.launch('#app');
            host.emit('preferences', { locale: 'zh-Hans-CN', sound: false });
            host.emit('player', { index: 0 });
            host.emit('state', state);
        }, state);
        await page.waitForFunction(() => document.body.textContent.includes('结束回合'));
        await page.screenshot({ path: `/tmp/container-zh-CN-${width}.png`, fullPage: true });
        assert.ok(requests.some((r) => r.url.includes('zh-CN') && r.status === 200));
        await page.evaluate(() => host.emit('preferences', { locale: 'en', sound: false }));
        await page.waitForFunction(() => document.body.textContent.includes('Pass'));
        await page.evaluate(() => host.emit('preferences', { locale: 'zh_CN', sound: false }));
        await page.waitForFunction(() => document.body.textContent.includes('结束回合'));
        assert.deepEqual(errors, []);
        assert.ok(requests.every((r) => r.status === 200));
        await page.close();
    }
    console.log('Container Simplified Chinese: cold loading and locale switching passed at mobile and desktop widths.');
} finally {
    await browser.close();
    await new Promise((r) => server.close(r));
}
