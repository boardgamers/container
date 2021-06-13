import { move as execMove, Move, setup, stripSecret } from 'container-engine';
import { moveAI } from 'container-engine/src/engine';
import { cloneDeep } from 'lodash';
import launch from './launch';

function launchSelfContained(selector = '#app') {
    const strip = false;

    const emitter = launch(selector);

    let gameState = setup(5, {});

    for (let i = 0; i < gameState.players.length; i++) {
        gameState.players[i].name = `Player ${i + 1}`;
    }

    for (const player of gameState.players.slice(1)) {
        player.isAI = true;
    }

    emitter.on('move', async (move: Move) => {
        gameState = execMove(gameState, move, 0);

        emitter.emit('state', cloneDeep(strip ? stripSecret(gameState, 0) : gameState));

        let delay = 800;
        while (gameState.players.some(pl => pl.isAI && pl.availableMoves)) {
            gameState = moveAI(gameState, gameState.players.findIndex(pl => pl.isAI && pl.availableMoves));
            let newState = cloneDeep(strip ? stripSecret(gameState, 0) : gameState);
            setTimeout(() => emitter.emit('state', newState), delay);
            delay += 800;
        }
    });

    emitter.on('fetchSate', () => emitter.emit('state', cloneDeep(strip ? stripSecret(gameState, 0) : gameState)));

    emitter.emit('player', { index: 0 });
    emitter.emit('state', cloneDeep(strip ? stripSecret(gameState, 0) : gameState));

    let delay = 800;
    while (gameState.players.some(pl => pl.isAI && pl.availableMoves)) {
        gameState = moveAI(gameState, gameState.players.findIndex(pl => pl.isAI && pl.availableMoves));
        let newState = cloneDeep(strip ? stripSecret(gameState, 0) : gameState);
        setTimeout(() => emitter.emit('state', newState), delay);
        delay += 800;
    }
}

export default launchSelfContained;
