import { GameState, move as execMove, Move, setup, stripSecret } from 'container-engine';
import { moveAI } from 'container-engine/src/engine';
import { cloneDeep } from 'lodash';
import AbstractJudge from '../../engine/src/fixtures/Abstract-judge-7215.json';
import launch from './launch';

function launchSelfContained(selector = '#app') {
    const strip = false;

    const emitter = launch(selector);

    let gameState = setup(5, {});

    for (let i = 0; i < gameState.players.length; i++) {
        gameState.players[i].name = `Player ${i + 1}`;
    }

    let playerIndex = 1;

    for (const player of gameState.players) {
        if (player.id != playerIndex) player.isAI = true;
    }

    if (process.env.VUE_APP_loadGame) {
        gameState = AbstractJudge as GameState;
        playerIndex = AbstractJudge.currentPlayers[0];
    }

    emitter.on('move', async (moves: Move | Move[]) => {
        console.log('moves received', moves);

        // Mimic the platform: replay the whole turn buffer from the last committed
        // state; only keep (persist) the result once the turn is committed.
        let newState = cloneDeep(gameState);
        for (const move of Array.isArray(moves) ? moves : [moves]) {
            newState = execMove(newState, move, playerIndex);
        }
        console.log('new game state', newState);

        if (newState.newTurn === false) {
            // Tentative: just echo the state back to the acting player. Delayed like on
            // the real platform, where the echo arrives over the network mid-animation.
            const echo = cloneDeep(strip ? stripSecret(newState, playerIndex) : newState);
            setTimeout(() => emitter.emit('state', echo), 300);
            return;
        }

        gameState = newState;
        emitter.emit('state', cloneDeep(strip ? stripSecret(gameState, playerIndex) : gameState));

        let delay = 800;
        while (gameState.players.some((pl) => pl.isAI && pl.availableMoves)) {
            gameState = moveAI(
                gameState,
                gameState.players.findIndex((pl) => pl.isAI && pl.availableMoves)
            );
            let newState = cloneDeep(strip ? stripSecret(gameState, playerIndex) : gameState);
            setTimeout(() => emitter.emit('state', newState), delay);
            delay += 800;
        }

        console.log('available moves', gameState.players[playerIndex].availableMoves);
    });

    emitter.on('fetchSate', () =>
        emitter.emit('state', cloneDeep(strip ? stripSecret(gameState, playerIndex) : gameState))
    );

    emitter.emit('player', { index: playerIndex });
    emitter.emit('state', cloneDeep(strip ? stripSecret(gameState, playerIndex) : gameState));

    let delay = 800;
    while (gameState.players.some((pl) => pl.isAI && pl.availableMoves)) {
        gameState = moveAI(
            gameState,
            gameState.players.findIndex((pl) => pl.isAI && pl.availableMoves)
        );
        let newState = cloneDeep(strip ? stripSecret(gameState, playerIndex) : gameState);
        setTimeout(() => emitter.emit('state', newState), delay);
        delay += 800;
    }

    console.log('available moves', gameState.players[playerIndex].availableMoves);
}

export default launchSelfContained;
