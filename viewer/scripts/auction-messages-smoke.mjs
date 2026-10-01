import assert from 'node:assert/strict';

export async function checkAuctionMessages(page, state) {
    const accepted = "slim_shagen accepts coyotte508's bid of $10 and receives $20";
    const declined = 'slim_shagen declines all bids and buys the cargo for $10';
    await page.evaluate(
        ({ state, accepted, declined }) => {
            state.players[0].name = 'slim_shagen';
            state.players[1].name = 'coyotte508';
            state.log = [
                {
                    type: 'move',
                    player: 0,
                    move: { name: 'accept', data: 1 },
                    simple: accepted,
                    pretty: "<b>slim_shagen</b> accepts <b>coyotte508</b>'s bid of $10 and receives $20",
                },
            ];
            host.emit('state', state);
            host.emit('chat:messages', [
                { _id: '000000050000000000000001', type: 'system', text: accepted },
                { _id: '000000050000000000000002', type: 'system', text: declined },
                { _id: '000000050000000000000003', type: 'text', author: 'coyotte508', text: accepted },
            ]);
            host.emit('preferences', { locale: 'fr' });
        },
        { state, accepted, declined }
    );
    await page.waitForFunction(() => document.querySelector('.journal-entry')?.textContent.includes('reçoit $20'));
    await page.waitForFunction(() =>
        document.querySelector('.bgs-game-chat article.system')?.textContent.includes('reçoit $20')
    );
    assert.match(
        await page.locator('.journal-entry').textContent(),
        /slim_shagen accepte l’enchère de coyotte508 de \$10 et reçoit \$20/
    );
    assert.match(
        await page.locator('.bgs-game-chat article.system').nth(1).textContent(),
        /achète la cargaison pour \$10/
    );
    assert.ok(
        (await page.locator('.bgs-game-chat article:not(.system)').textContent()).includes(accepted),
        'player messages remain untouched'
    );
    await page.evaluate(() => host.emit('preferences', { locale: 'en' }));
    await page.waitForFunction(() =>
        document.querySelector('.bgs-game-chat article.system')?.textContent.includes('bid of $10 and receives $20')
    );
    assert.ok((await page.locator('.journal-entry').textContent()).includes(accepted));
}
