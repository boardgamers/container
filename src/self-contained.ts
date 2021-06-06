import launch from './launch';
import { setup, Move, move as execMove, stripSecret } from "container-engine";
import { cloneDeep } from "lodash";
import { moveAI } from 'container-engine/src/engine';

function launchSelfContained(selector = "#app") {
    const strip = false;

    const emitter = launch(selector);

    let gameState = setup(5, {});

    for (let i = 0; i < gameState.players.length; i++) {
        gameState.players[i].name = `Player ${i + 1}`;
    }

    for (const player of gameState.players.slice(1)) {
        player.isAI = true;
    }

    emitter.on("move", async (move: Move) => {
        console.log("move received", JSON.stringify(move));
        gameState = execMove(gameState, move, gameState.currentPlayer!);

        emitter.emit("state", cloneDeep(strip ? stripSecret(gameState, 0) : gameState));

        let delay = 0;
        while (gameState.players.some(pl => pl.isAI && pl.availableMoves)) {
            gameState = moveAI(gameState, gameState.players.findIndex(pl => pl.isAI && pl.availableMoves));
            let newState = cloneDeep(strip ? stripSecret(gameState, 0) : gameState);
            setTimeout(() => emitter.emit("state", newState), delay);
            delay += 400;
        }
    });

    emitter.on('fetchSate', () => emitter.emit("state", cloneDeep(strip ? stripSecret(gameState, 0) : gameState)));

    // emitter.on('addLog', data => console.log('addLog', data));
    // emitter.on('replaceLog', data => console.log('replaceLog', data));

    emitter.emit("player", { index: 0 });
    emitter.emit("state", cloneDeep(strip ? stripSecret(gameState, 0) : gameState));

    if (gameState.players[gameState.currentPlayer!].isAI) {
        let delay = 0;
        while (gameState.players.some(pl => pl.isAI && pl.availableMoves)) {
            gameState = moveAI(gameState, gameState.players.findIndex(pl => pl.isAI && pl.availableMoves));
            let newState = cloneDeep(strip ? stripSecret(gameState, 0) : gameState);
            setTimeout(() => emitter.emit("state", newState), delay);
            delay += 400;
        }
    }
}

export default launchSelfContained;
