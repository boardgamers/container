import assert from 'node:assert/strict';

// "Undo my move": BGS offers it in games against bots (protocol `undo:available` / `undo`).
export async function checkUndoMove(page, engine) {
    const earlier = JSON.parse(JSON.stringify(engine.setup(3, {}, 'undo-move')));
    earlier.players.forEach((player, index) => {
        player.name = ['You', 'Bot 1', 'Bot 2'][index];
    });
    const seat = earlier.currentPlayers[0];
    const later = engine.move(JSON.parse(JSON.stringify(earlier)), { name: 'pass', data: true }, seat);
    assert.ok(later.log.length > earlier.log.length);
    await page.evaluate(
        ({ later, seat }) => {
            window.undoRequests = 0;
            host.on('undo', () => undoRequests++);
            host.emit('preferences', { sound: false, analysis: false });
            host.emit('player', { index: seat });
            host.emit('state', later);
        },
        { later, seat }
    );
    const control = page.locator('[data-board-control="undo-move"]');
    const turnUndo = page.locator('[data-board-control="undo"]');
    const status = page.locator('.statusBar span');
    await turnUndo.waitFor();
    assert.equal(await control.count(), 0, 'hidden until BGS offers it');

    await page.evaluate(() => host.emit('undo:available', true));
    await control.waitFor();
    assert.equal(await control.getAttribute('aria-label'), 'Undo my move');
    assert.equal(await control.locator('title').textContent(), 'Undo my move');
    assert.equal(await turnUndo.count(), 0, 'it stands in for the in-turn undo');
    assert.doesNotMatch(await status.textContent(), /your turn/);
    await control.click();
    assert.equal(await page.evaluate(() => undoRequests), 1, 'clicking asks BGS to undo');

    // BGS then sends the earlier position: the move count goes down.
    await page.evaluate((earlier) => host.emit('state', earlier), earlier);
    await page.waitForFunction(() => document.querySelector('.statusBar span')?.textContent === "It's your turn!");
    assert.equal(
        await page.locator('.journal-entry').count(),
        earlier.log.length,
        'the journal drops the moves taken back'
    );

    // Hidden while BGS replays history, for spectators and in analysis.
    const emit = (event) =>
        page.evaluate((event) => {
            if (typeof event === 'string') host.emit(event);
            else for (const [name, value] of Object.entries(event)) host.emit(name, value);
        }, event);
    for (const [enter, leave] of [
        ['replay:start', 'replay:end'],
        [{ player: {} }, { player: { index: seat } }],
        [{ preferences: { sound: false, analysis: true } }, { preferences: { sound: false, analysis: false } }],
    ]) {
        await emit(enter);
        await control.waitFor({ state: 'detached' });
        assert.equal(await turnUndo.count(), 1);
        await emit(leave);
        await control.waitFor();
    }

    // Translated like the other board controls.
    await page.evaluate(() => host.emit('preferences', { sound: false, analysis: false, locale: 'fr' }));
    await page.waitForFunction(
        () =>
            document.querySelector('[data-board-control="undo-move"]')?.getAttribute('aria-label') ===
            'Annuler mon coup'
    );
    await page.evaluate(() => host.emit('preferences', { sound: false, analysis: false, locale: 'en' }));
    await page.waitForFunction(
        () => document.querySelector('[data-board-control="undo-move"]')?.getAttribute('aria-label') === 'Undo my move'
    );

    await page.evaluate(() => host.emit('undo:available', false));
    await control.waitFor({ state: 'detached' });
    assert.equal(await turnUndo.count(), 1);
    assert.equal(await page.evaluate(() => undoRequests), 1);
}
