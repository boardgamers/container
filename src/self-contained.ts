import launch from './launch';
import { setup, Move, move as execMove, stripSecret } from "container-engine";
import { cloneDeep } from "lodash";

function launchSelfContained(selector = "#app") {
    const emitter = launch(selector);

    let gameState = setup(5, {});

    for (let i = 0; i < gameState.players.length; i++) {
        gameState.players[i].name = `Player ${i + 1}`;
    }

    emitter.on("move", async (move: Move) => {
        console.log("move received", JSON.stringify(move));
        const index = gameState.log.length;
        gameState = execMove(gameState, move, 0);

        setTimeout(() =>
            emitter.emit("gamelog", cloneDeep({
                start: index,
                data: {
                    log: stripSecret(gameState, 0).log.slice(index),
                    availableMoves: stripSecret(gameState, 0).players.map(pl => pl.availableMoves)
                }
            })), 200);
    });

    emitter.on('fetchSate', () => emitter.emit("state", cloneDeep(stripSecret(gameState, 0))));

    emitter.on('addLog', data => console.log('addLog', data));
    emitter.on('replaceLog', data => console.log('replaceLog', data));

    emitter.emit("player", { index: 0 });
    emitter.emit("state", cloneDeep(stripSecret(gameState, 0)));
}

export default launchSelfContained;
