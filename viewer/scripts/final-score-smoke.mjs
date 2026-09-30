import assert from 'node:assert/strict';

export async function checkFinalScore(browser, origin, engine) {
    const state = JSON.parse(JSON.stringify(engine.setup(5, {}, 'final-score-scroll')));
    state.phase = 'gameEnd';
    state.players.forEach((player, index) => {
        player.name = ['You', 'Spock', 'SchweddyBalls', 'Ada', 'Last player'][index];
        player.finalScoreBreakdown = Array(10).fill('$10');
    });
    for (const [width, height] of [
        [320, 568],
        [390, 620],
        [844, 390],
        [1400, 900],
    ]) {
        const mobile = width < 1000;
        const page = await browser.newPage({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        try {
            page.setDefaultTimeout(5000);
            await page.goto(origin);
            await page.evaluate((state) => {
                window.host = window.container.launch('#app');
                host.emit('preferences', { sound: false });
                host.emit('player', { index: 0 });
                host.emit('state', state);
            }, state);
            await page.locator('g.button').filter({ hasText: 'Final Score' }).click();
            const dialog = page.getByRole('dialog', { name: 'Final Score' });
            const bounds = await dialog.boundingBox();
            assert.ok(bounds.x >= 0 && bounds.y >= 0, 'dialog starts inside the viewport');
            assert.ok(bounds.x + bounds.width <= width && bounds.y + bounds.height <= height, 'dialog fits viewport');
            const scroller = dialog.getByRole('region');
            const metrics = () =>
                scroller.evaluate((el) => ({
                    x: el.scrollLeft,
                    y: el.scrollTop,
                    maxX: el.scrollWidth - el.clientWidth,
                    maxY: el.scrollHeight - el.clientHeight,
                }));
            assert.equal((await metrics()).x, 0, 'category column is reachable from the start');
            if (mobile) {
                const cdp = await page.context().newCDPSession(page);
                const box = await scroller.boundingBox();
                const swipe = async (dx, dy) => {
                    const x = box.x + box.width / 2 - dx / 2;
                    const y = box.y + box.height / 2 - dy / 2;
                    await cdp.send('Input.dispatchTouchEvent', {
                        type: 'touchStart',
                        touchPoints: [{ x, y, id: 1 }],
                    });
                    for (let step = 1; step <= 12; step++) {
                        await cdp.send('Input.dispatchTouchEvent', {
                            type: 'touchMove',
                            touchPoints: [{ x: x + (dx * step) / 12, y: y + (dy * step) / 12, id: 1 }],
                        });
                        await page.waitForTimeout(20);
                    }
                    await page.waitForTimeout(100);
                    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                    await page.waitForTimeout(100);
                };
                assert.ok((await metrics()).maxX > 0, 'five-player table overflows horizontally');
                assert.ok((await metrics()).maxY > 0, 'short screen needs vertical scrolling');
                await swipe(-160, 0);
                await page.waitForFunction(() => document.querySelector('.final-score-scroll').scrollLeft > 0);
                await swipe(160, 0);
                await page.waitForFunction(() => document.querySelector('.final-score-scroll').scrollLeft < 2);
                for (let i = 0; i < 6 && (await metrics()).x < (await metrics()).maxX - 2; i++) await swipe(-160, 0);
                const horizontal = await metrics();
                assert.ok(horizontal.x >= horizontal.maxX - 2, 'last player is reachable by swiping');
                await swipe(0, -140);
                await page.waitForFunction(() => document.querySelector('.final-score-scroll').scrollTop > 0);
                for (let i = 0; i < 6 && (await metrics()).y < (await metrics()).maxY - 2; i++) await swipe(0, -140);
                const vertical = await metrics();
                assert.ok(vertical.y >= vertical.maxY - 2, 'final total is reachable by swiping');
                const lastCell = await dialog.locator('tr').last().locator('td').last().boundingBox();
                assert.ok(
                    lastCell.y >= box.y && lastCell.y + lastCell.height <= box.y + box.height,
                    'total is visible'
                );
                await cdp.detach();
            }
            await page.screenshot({ path: `/tmp/container-final-score-${width}.png` });
            await dialog.getByRole('button', { name: 'Close', exact: true }).click();
            assert.equal(await dialog.isVisible(), false, 'close stays reachable after scrolling');
            assert.deepEqual(errors, [], 'final score has no browser errors');
            console.log(`container ${width}x${height}: final-score scrolling passed`);
        } finally {
            await page.close();
        }
    }
}
