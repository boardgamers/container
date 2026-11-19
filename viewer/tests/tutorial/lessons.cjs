const assert = require('node:assert/strict');
const { test } = require('node:test');
require('../../../engine/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'CommonJS', moduleResolution: 'Node', target: 'ES2022', importHelpers: false },
});
const { createTutorial } = require('@boardgamers/protocol/tutorial');
const { stripSecret } = require('../../../engine/src/engine');
const { lessons } = require('../../src/tutorial/lessons');
const expectedCash = {
    'supply-chain': 21,
    buildings: 7,
    selling: 36,
    bidding: 10,
    'keep-cargo': 14,
    scoring: 54,
    'offshore-cargo': 19,
    'offshore-cash': 23,
    'offshore-outbid': 20,
};
function memory() {
    const entries = new Map();
    return { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
}
function actionFor(lesson, snapshot) {
    const step = lesson.steps[snapshot.step].id;
    if (step === 'bid' || step === 'raise')
        return { kind: 'move', move: { name: 'bid', data: true, extraData: { price: step === 'bid' ? 8 : 2 } } };
    const choices = lesson.choices(snapshot.state, step);
    if (step === 'keep-value' || step === 'sell-value')
        return choices.find((choice) => choice.label === (step === 'keep-value' ? '$24' : '$12')).action;
    if (step === 'set') return choices.find((choice) => choice.label === '$10').action;
    if (step === 'discard') return choices.find((choice) => choice.label === 'dark green').action;
    assert.equal(choices.length, 1, `${lesson.id}/${step} needs one expected action`);
    return choices[0].action;
}
for (const lesson of lessons) {
    test(`${lesson.id}: complete using legal engine moves and restore the saved result`, async () => {
        const storage = memory();
        const controller = await createTutorial({ ...lesson, storage });
        let turns = 0;
        while (!controller.snapshot.completed && ++turns < 25) {
            const snapshot = controller.snapshot;
            const ok = snapshot.canContinue
                ? await controller.continue()
                : await controller.play(actionFor(lesson, snapshot));
            assert.equal(ok, true, `${lesson.id}/${lesson.steps[snapshot.step].id}: ${controller.snapshot.error}`);
            const game = controller.snapshot.state.game;
            const pieces = [
                ...game.containersLeft,
                ...(game.offshoreBank?.containerLots.flat() || []),
                ...(game.offshoreBank?.auctions.flatMap((a) =>
                    a.containers
                        .filter(
                            (c) =>
                                !game.offshoreBank.decision?.settlement ||
                                game.offshoreBank.decision.settlement.bidder !== a.bidder
                        )
                        .map((c) => c.container.piece)
                ) || []),
                ...(game.offshoreBank?.decision?.kind === 'return'
                    ? game.offshoreBank.decision.containers.map((c) => c.container.piece)
                    : game.offshoreBank?.decision?.payment || []),
                ...game.players.flatMap((player) => [
                    ...player.ship.containers,
                    ...(player.bankHolding || []),
                    ...player.containersOnIsland,
                    ...player.containersOnFactoryStore.map((item) => item.piece),
                    ...player.containersOnWarehouseStore.map((item) => item.piece),
                ]),
            ];
            assert.equal(pieces.length, 60, 'all containers remain in play or in the supply');
            assert.equal(new Set(pieces.map((piece) => piece.id)).size, 60, 'no duplicated pieces');
        }
        assert.equal(controller.snapshot.completed, true);
        assert.equal(controller.snapshot.canContinue, false, 'the last action completes without an extra Continue');
        assert.equal(controller.snapshot.state.game.players[0].money, expectedCash[lesson.id]);
        const restored = await createTutorial({ ...lesson, storage });
        assert.deepEqual(restored.snapshot.state, controller.snapshot.state);
        assert.equal(restored.snapshot.completed, true);
        if (lesson.id === 'scoring') {
            assert.deepEqual(
                controller.snapshot.state.game.players.map((player) => player.money),
                [54, 20, 20]
            );
            assert.equal(controller.snapshot.state.game.players[0].finalScoreBreakdown[6], '-$6');
        }
        controller.destroy();
        restored.destroy();
    });
}
test('bidding hides the sealed offers, sums the tie-break and pauses before the seller chooses', async () => {
    const lesson = lessons.find((lesson) => lesson.id === 'bidding');
    const controller = await createTutorial(lesson);
    await controller.continue();
    assert.equal(
        await controller.play({ kind: 'move', move: { name: 'bid', data: true, extraData: { price: -1 } } }),
        false
    );
    assert.equal(controller.snapshot.state.game.players[0].money, 20);
    await controller.play(actionFor(lesson, controller.snapshot));
    let publicView = stripSecret(controller.snapshot.state.game, 2);
    assert.equal(publicView.players[0].bid, 0);
    assert.equal(publicView.players[0].pointCard, null);
    assert.equal(publicView.players[0].money, 0);
    await controller.play({ kind: 'watch' });
    assert.deepEqual(controller.snapshot.state.game.highestBidders, [0, 2]);
    await controller.play(actionFor(lesson, controller.snapshot));
    publicView = stripSecret(controller.snapshot.state.game, 2);
    assert.equal(publicView.players[0].bid, 8);
    assert.equal(publicView.players[0].additionalBid, 0);
    await controller.play({ kind: 'watch' });
    assert.equal(controller.snapshot.state.game.phase, 'acceptDecline');
    assert.deepEqual(controller.snapshot.state.game.highestBidders, [0, 2]);
    assert.equal(
        controller.snapshot.state.game.players[0].bid + controller.snapshot.state.game.players[0].additionalBid,
        10
    );
    assert.equal(controller.snapshot.state.game.players[0].containersOnIsland.length, 0);
    controller.destroy();
});
test('incorrect scoring answers do not progress, and Retry restores the current exercise', async () => {
    const lesson = lessons.find((lesson) => lesson.id === 'scoring');
    const controller = await createTutorial(lesson);
    await controller.continue();
    assert.equal(await controller.play({ kind: 'answer', answer: '5' }), false);
    assert.equal(controller.snapshot.step, 1);
    await controller.play({ kind: 'answer', answer: '10' });
    assert.equal(await controller.play({ kind: 'answer', answer: 'white' }), false);
    assert.equal(controller.snapshot.step, 2);
    await controller.restartStep();
    assert.equal(controller.snapshot.step, 2);
    await controller.play({ kind: 'answer', answer: 'darkslategray' });
    await controller.play(actionFor(lesson, controller.snapshot));
    assert.equal(controller.snapshot.completed, true);
    await controller.restart();
    assert.equal(controller.snapshot.step, 0);
    assert.equal(controller.snapshot.state.game.players[0].money, 20);
    controller.destroy();
});

test('the keep-or-sell questions compare the net value before the actual choice', async () => {
    const lesson = lessons.find((lesson) => lesson.id === 'keep-cargo');
    const c = await createTutorial(lesson);
    await c.continue();
    await c.play(actionFor(lesson, c.snapshot));
    await c.play({ kind: 'watch' });
    while (c.snapshot.canContinue) await c.continue();
    assert.equal(await c.play({ kind: 'answer', answer: '30' }), false, 'Keeping must subtract the payment');
    assert.match(c.snapshot.error, /Not quite.*minus the \$6/);
    assert.equal(await c.play({ kind: 'answer', answer: '24' }), true);
    assert.equal(await c.play({ kind: 'answer', answer: '6' }), false, 'Selling includes the matching subsidy');
    assert.equal(await c.play({ kind: 'answer', answer: '12' }), true);
    assert.equal(c.snapshot.state.game.players[0].money, 20, 'Answers do not execute the auction');
    await c.play(actionFor(lesson, c.snapshot));
    assert.equal(c.snapshot.state.game.players[0].money, 14);
    assert.equal(c.snapshot.state.game.players[0].containersOnIsland.length, 8);
});

for (const lesson of lessons.filter((l) => l.id.startsWith('offshore-'))) {
    test(`${lesson.id}: every checkpoint resumes, replays deterministically and rejects wrong moves`, async () => {
        const storage = memory();
        let controller = await createTutorial({ ...lesson, storage });
        const initial = structuredClone(controller.snapshot.state);
        let iterations = 0;
        while (!controller.snapshot.completed && ++iterations < 25) {
            const checkpoint = structuredClone(controller.snapshot.state);
            const step = controller.snapshot.step;
            assert.equal(await controller.play({ kind: 'answer', answer: 'skip' }), false);
            assert.equal(
                await controller.play({
                    kind: 'move',
                    move: { name: 'callBank', data: { type: 'containers', lot: 2 }, extraData: { cash: 1 } },
                }),
                false
            );
            assert.deepEqual(controller.snapshot.state, checkpoint, 'invalid actions never mutate bank state');
            await controller.restartStep();
            assert.deepEqual(controller.snapshot.state, checkpoint, 'replay restores escrow, decisions and holding');
            controller.destroy();
            controller = await createTutorial({ ...lesson, storage });
            assert.equal(controller.snapshot.step, step);
            assert.deepEqual(controller.snapshot.state, checkpoint, 'mid-lesson resume restores the checkpoint');
            const publicGame = stripSecret(checkpoint.game, 0);
            assert.ok(publicGame.players[0].pointCard);
            for (const opponent of publicGame.players.slice(1)) assert.equal(opponent.pointCard, null);
            const action = actionFor(lesson, controller.snapshot);
            const expected = lesson.move(structuredClone(checkpoint), action);
            const frames = [];
            lesson.move(structuredClone(checkpoint), action, (game) => frames.push(game));
            assert.ok(frames.length, 'all interactive and scripted steps use engine moves');
            assert.equal(await controller.play(action), true, controller.snapshot.error);
            assert.deepEqual(controller.snapshot.state, expected, 'replayed action has deterministic results');
            const game = controller.snapshot.state.game;
            if (lesson.id === 'offshore-cargo' && game.offshoreBank.won) {
                assert.equal(game.players[0].availableMoves?.callBank, undefined, 'no Call Bank in the winning turn');
                assert.equal(game.players[0].bankHolding.length + game.players[0].ship.containers.length, 2);
            }
            if (lesson.id === 'offshore-cash' && controller.snapshot.completed) {
                assert.equal(game.players[0].ship.shipPosition, initial.game.players[0].ship.shipPosition);
                assert.equal(game.offshoreBank.decision, undefined, 'last same-colour payment resolved automatically');
                assert.equal(game.offshoreBank.cashLots[2], 0);
            }
            if (lesson.id === 'offshore-outbid' && lesson.steps[step].id === 'new-leader') {
                assert.equal(game.currentPlayers[0], 0);
                assert.equal(game.offshoreBank.auctions[0].bidder, 1, 'leader survives across learner turns');
                assert.equal(game.players[0].containersOnFactoryStore.find((c) => c.piece.color === 'white').price, 3);
            }
        }
        assert.equal(controller.snapshot.completed, true);
        await controller.restart();
        assert.deepEqual(controller.snapshot.state, initial);
        controller.destroy();
    });
}

test('Offshore lesson prose is translated in every supported catalogue', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const directory = path.resolve(__dirname, '../../src/localization');
    const messages = lessons
        .filter((lesson) => lesson.id.startsWith('offshore-'))
        .flatMap((lesson) => [
            lesson.title,
            lesson.description,
            lesson.completion.title,
            lesson.completion.text,
            ...lesson.steps.flatMap((step) => [step.title, step.text]),
        ]);
    for (const file of fs.readdirSync(directory).filter((file) => file.endsWith('.json'))) {
        const catalogue = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
        for (const message of messages) {
            assert.ok(catalogue[message], `${file}: missing ${message}`);
            if (file !== 'en.json') assert.notEqual(catalogue[message], message, `${file}: untranslated ${message}`);
        }
    }
});
