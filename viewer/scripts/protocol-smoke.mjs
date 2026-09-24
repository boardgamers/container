import { checkHostPresentation } from './host-presentation-smoke.mjs';
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
const journalEntry = (text) => ({ type: 'move', move: { name: 'pass' }, pretty: text, simple: text });
const html =
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/bundle.css"><div id="app"></div><script src="/vue.js"></script>' +
    '<script src="/bundle.js"></script>';
const server = createServer(async (req, res) => {
    try {
        const bundle = `viewer/dist/${game}-viewer.umd.min.js`;
        const css = `viewer/dist/${game}-viewer.css`;
        const files = {
            '/bundle.js': fileURLToPath(new URL(bundle, repo)),
            '/bundle.css': fileURLToPath(new URL(css, repo)),
            '/vue.js': require.resolve('vue/dist/vue.min.js'),
        };
        if (req.url === '/') {
            res.setHeader('Content-Type', 'text/html');
            res.end(html);
        } else if (files[req.url]) {
            res.setHeader('Content-Type', req.url.endsWith('.css') ? 'text/css' : 'text/javascript; charset=utf-8');
            res.end(await readFile(files[req.url]));
        } else {
            res.statusCode = 404;
            res.end();
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
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.address().port}/`);
        assert.deepEqual(errors, [], 'bundle loads without browser errors');
        let state = engine.setup(3, {}, '17');
        state = JSON.parse(JSON.stringify(state));
        state.newTurn = true;
        state.players.forEach((player, index) => {
            player.name = ['You', 'Ada Lovelace', 'Bob'][index];
        });
        state.log = Array.from({ length: 50 }, (_, index) =>
            journalEntry(`Journal entry ${index + 1}: Ada buys containers from Bob's warehouse.`)
        );
        const id = (value) => value.toString(16).padStart(24, '0');
        const messages = Array.from({ length: 35 }, (_, i) => ({
            _id: id(i + 1),
            type: 'text',
            author: 'Bob',
            playerIndex: 2,
            text: `Earlier message ${i + 1}`,
            createdAt: '2026-09-13T12:00:00Z',
        }));
        // BGS can load the viewer before revealing its iframe.
        await page.locator('#app').evaluate((el) => (el.style.display = 'none'));
        await page.evaluate(
            ({ game, state, messages }) => {
                window.globalName = game;
                window.readyCount = 0;
                window.receipts = [];
                window.sent = [];
                window.playerClicks = [];
                window.fetches = 0;
                window.host = window[window.globalName].launch('#app');
                host.on('ready', () => readyCount++);
                host.on('fetchState', () => fetches++);
                host.on('chat:read', (payload) => receipts.push(payload));
                host.on('chat:send', (payload) => sent.push(payload));
                host.on('player:clicked', (payload) => playerClicks.push(payload));
                host.emit('preferences', { sound: false });
                host.emit('player', { index: 0 });
                host.emit('state', state);
                host.emit('chat:state', {
                    canSend: true,
                    mentions: [
                        { id: 'self', name: 'You', playerIndex: 0 },
                        { id: 'ada', name: 'Ada Lovelace', playerIndex: 1 },
                        { id: 'bob', name: 'Bob', playerIndex: 2 },
                    ],
                });
                host.emit('chat:messages', messages);
            },
            { game, state, messages }
        );
        await page.waitForFunction(() => readyCount === 1);
        await page.locator('#app').evaluate((el) => (el.style.display = ''));
        const panel = page.locator('.bgs-game-chat');
        const input = panel.locator('input');
        const list = panel.locator('.chat-messages');
        const journal = page.locator('.journal-feed');
        const assertJournalAtEnd = () =>
            page.waitForFunction(
                () => {
                    const el = document.querySelector('.journal-feed');
                    return el && el.clientHeight > 0 && Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 3;
                },
                null,
                { timeout: 3000 }
            );
        await assertJournalAtEnd();
        const journalHeight = await page
            .locator('.inline-game-log')
            .evaluate((el) => el.getBoundingClientRect().height);
        const chatHeight = await panel.evaluate((el) => el.getBoundingClientRect().height);
        if (width >= 1000) {
            assert.ok(Math.abs(journalHeight - chatHeight) < 2, 'journal and chat have the same height');
        } else {
            assert.equal(chatHeight, 0, 'mobile starts on the journal tab');
            assert.ok(journalHeight > 0, 'journal is visible');
        }
        await journal.evaluate((el) => {
            el.scrollTop = 0;
            el.dispatchEvent(new Event('scroll'));
        });
        state.log.push(journalEntry('New entry while reading older moves.'));
        await page.evaluate((state) => host.emit('state', state), state);
        await journal.locator('.journal-entry').last().getByText('New entry while reading older moves.').waitFor();
        assert.equal(await journal.evaluate((el) => el.scrollTop), 0, 'new moves preserve the reading position');
        await journal.evaluate((el) => {
            el.scrollTop = el.scrollHeight;
            el.dispatchEvent(new Event('scroll'));
        });
        state.log.push(journalEntry('New entry while following the journal.'));
        await page.evaluate((state) => host.emit('state', state), state);
        await journal.locator('.journal-entry').last().getByText('New entry while following the journal.').waitFor();
        await assertJournalAtEnd();
        if (width < 1000) await page.getByRole('tab', { name: /^Chat/ }).click();
        await panel.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => {
            const el = document.querySelector('.chat-messages');
            return el && Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 3;
        });
        if (width < 1000) {
            await page.setViewportSize({ width, height: 600 });
            await panel.evaluate((el) => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 400));
            await list.evaluate((el) => {
                el.scrollTop = el.scrollHeight;
            });
            const point = await list.evaluate((el) => {
                const rect = el.getBoundingClientRect();
                return { x: rect.left + 50, y: rect.top + 50 };
            });
            await page.mouse.move(point.x, point.y);
            await page.mouse.wheel(0, 500);
            await page.waitForFunction(
                () => {
                    const composer = document.querySelector('.chat-composer').getBoundingClientRect();
                    return composer.bottom <= window.innerHeight + 1;
                },
                null,
                { timeout: 3000 }
            );
            await page.setViewportSize({ width, height: 900 });
        }
        assert.equal(await panel.locator('summary').textContent(), 'Chat', 'old history is not unread');
        await input.fill('@');
        assert.deepEqual(await panel.locator('.chat-suggestions button').allTextContents(), ['@Ada Lovelace', '@Bob']);
        await input.press('Enter');
        assert.equal(await input.inputValue(), '@"Ada Lovelace" ');
        assert.equal(await page.evaluate(() => sent.length), 0, 'selecting a mention does not send');
        await input.fill('@"Ada Lovelace" hello');
        await input.press('Enter');
        assert.equal(await page.evaluate(() => sent.length), 1);
        await input.fill('next draft');
        await page.evaluate(() => host.emit('chat:result', { requestId: sent[0].requestId, ok: true }));
        assert.equal(await input.inputValue(), 'next draft', 'ack preserves a newer draft');
        await input.press('Enter');
        await page.evaluate(() =>
            host.emit('chat:result', { requestId: sent[1].requestId, ok: false, error: 'Try again' })
        );
        assert.equal(await input.inputValue(), 'next draft');
        assert.match(await panel.locator('.chat-status').textContent(), /Try again/);
        await panel.evaluate((el) => {
            el.open = false;
        });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForFunction(() => document.querySelector('.chat-shortcut').hidden);
        const incoming = {
            _id: id(40),
            type: 'text',
            author: 'Ada Lovelace',
            playerIndex: 1,
            text: '@You see https://example.com',
            segments: [
                { kind: 'mention', name: 'You', id: 'self' },
                { kind: 'text', text: ' see ' },
                { kind: 'link', text: 'example', url: 'https://example.com' },
            ],
        };
        await page.evaluate((incoming) => {
            host.emit('chat:appended', [incoming]);
            host.emit('chat:appended', [incoming]);
        }, incoming);
        assert.match(await panel.locator('summary').textContent(), /1 unread/);
        // Visibility follows the chat panel's animation-frame measurement.
        await page.locator('.chat-shortcut').waitFor({ state: 'visible' });
        assert.equal(await page.locator('.chat-shortcut').isVisible(), true, 'unread messages show the shortcut');
        assert.equal(await list.locator('article').count(), 36, 'duplicate append is ignored');
        await page.evaluate((messages) => host.emit('chat:messages', messages), [...messages, incoming]);
        assert.match(
            await panel.locator('summary').textContent(),
            /1 unread/,
            'history refresh preserves known unread'
        );
        const link = list.locator('a');
        assert.equal(await link.getAttribute('href'), 'https://example.com');
        assert.match(await link.getAttribute('rel'), /noopener/);
        await page.evaluate(
            (incoming) =>
                host.emit('chat:updated', [{ ...incoming, text: '<img src=x onerror=alert(1)>', segments: undefined }]),
            incoming
        );
        assert.equal(await list.locator('article').last().locator('img').count(), 0);
        assert.match(await list.locator('article').last().textContent(), /<img/);
        await page.evaluate((incoming) => host.emit('chat:updated', [incoming]), incoming);
        await panel.evaluate((el) => {
            el.open = true;
        });
        if (width < 1000) await page.getByRole('tab', { name: /^Chat/ }).click();
        await panel.scrollIntoViewIfNeeded();
        await list.evaluate((el) => {
            el.scrollTop = el.scrollHeight;
            el.dispatchEvent(new Event('scroll'));
        });
        await list.locator('.chat-mention').click();
        assert.deepEqual(await page.evaluate(() => playerClicks), [{ index: 0 }]);
        await page.waitForFunction(() => receipts.some((r) => r.messageId === '000000000000000000000028'));
        await page.waitForFunction(() => document.querySelector('.chat-shortcut').hidden);
        const receiptCount = await page.evaluate(() => receipts.length);
        await list.evaluate((el) => {
            el.scrollTop = 0;
            el.dispatchEvent(new Event('scroll'));
            el.scrollTop = el.scrollHeight;
            el.dispatchEvent(new Event('scroll'));
        });
        await page.waitForTimeout(650);
        assert.equal(await page.evaluate(() => receipts.length), receiptCount, 'scrolling does not repeat read events');
        await page.evaluate(() => host.emit('chat:deleted', ['000000000000000000000028']));
        assert.equal(await list.locator('article').count(), 35);
        await page.evaluate((state) => {
            host.emit('state', state);
            host.emit('state:updated');
        }, state);
        await page.waitForFunction(() => fetches > 0);
        assert.equal(await page.evaluate(() => readyCount), 1, 'ready fires once');
        await page.evaluate(
            (state) => host.emit('gamelog', { start: 0, data: { state: { ...state, newTurn: false } } }),
            state
        );
        await page.waitForTimeout(100);
        assert.equal(
            await page.evaluate(() => fetches),
            1,
            'tentative move state is rendered without fetching a committed state'
        );

        await page.evaluate(() => {
            window.translationsRequested = [];
            host.on('chat:translate', (request) => {
                translationsRequested.push(request);
                host.emit('chat:translation', { ...request, ok: true, text: 'Bonjour <img src=x>', language: 'en' });
            });
            host.emit('chat:state', {
                canSend: true,
                translationTarget: 'fr',
                translationLabels: {
                    translate: 'Traduire',
                    translating: 'Traduction…',
                    translated: 'Traduit',
                    original: 'Voir l’original',
                    error: 'Indisponible',
                    retry: 'Réessayer',
                },
            });
            host.emit('chat:messages', [
                { _id: '000000000000000000000070', type: 'text', text: 'Hello', language: 'en' },
            ]);
        });
        await page.locator('.chat-translate').click();
        await page.getByRole('button', { name: 'Traduit · Voir l’original', exact: true }).waitFor();
        assert.equal(await page.evaluate(() => translationsRequested.length), 1);
        assert.equal(await page.locator('[data-message-id="000000000000000000000070"] img').count(), 0);
        assert.match(
            await page.locator('[data-message-id="000000000000000000000070"]').textContent(),
            /Bonjour <img src=x>/
        );
        await page.locator('.chat-translate').click();
        assert.match(await page.locator('[data-message-id="000000000000000000000070"]').textContent(), /Hello/);
        assert.equal(
            await page.evaluate(() => translationsRequested.length),
            1,
            'showing original needs no new request'
        );
        await page.evaluate(() => host.emit('preferences', { sound: false, analysis: true }));
        await page.waitForFunction(() => !document.querySelector('.chat-translate')?.getBoundingClientRect().height);
        await page.screenshot({ path: '/tmp/container-analysis-' + width + '.png', fullPage: true });
        await page.evaluate(() => host.emit('preferences', { sound: false, analysis: false }));
        await page.screenshot({ path: `/tmp/${game}-protocol-${width}.png`, fullPage: true });
        await page.evaluate(
            ({ state, incoming }) => {
                const old = host;
                host = window[globalName].launch('#app');
                host.emit('preferences', { sound: false });
                host.emit('player', { index: 0 });
                host.emit('state', state);
                host.emit('chat:state', { canSend: true });
                old.emit('chat:appended', [incoming]);
            },
            { state, incoming }
        );
        assert.equal(await page.locator('.bgs-game-chat').count(), 1);
        assert.equal(await page.locator('.chat-messages article').count(), 0, 'relaunch detaches old chat');
        await assertJournalAtEnd();
        await page.reload();
        await page.evaluate((state) => {
            window.host = window.container.launch('#app');
            host.emit('preferences', { sound: false });
            host.emit('state', state);
        }, state);
        await assertJournalAtEnd();
        assert.deepEqual(errors, [], 'no browser errors');
        await checkHostPresentation(page, 'host', `/tmp/container-board-thumbnail-${width}.png`);
        assert.deepEqual(errors, []);
        await page.close();
        console.log(`${game} ${width}px: protocol/chat smoke passed`);
    }
} finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
}
