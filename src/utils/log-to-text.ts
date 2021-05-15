import { LogItem, GameState, MoveName, Phase, GameEventName } from 'container-engine';

export function logToText(G: GameState, item: LogItem): string[] {
    return [];
    
    // switch (item.type) {
    //     case "move": {
    //         switch (item.move.name) {
    //             case MoveName.ChooseCard: return [`${G.players[item.player].name} made their choice`];
    //             case MoveName.PlaceCard: {
    //                 const ret = [`${G.players[item.player].name} placed their card on row ${item.move.data.row + 1}`]
    //                 if (item.move.data.replace) {
    //                     ret.push(`**${G.players[item.player].name} takes the row!!**`);
    //                 }

    //                 return ret;
    //             }
    //         }
    //     }

    //     case "phase": {
    //         switch (item.phase) {
    //             case Phase.ChooseCard:
    //                 return ["*Time to make a choice!*"];
    //             case Phase.PlaceCard:
    //                 return ["*Here we go!*"];
    //         }
    //     }

    //     case "event": {
    //         switch (item.event.name) {
    //             case GameEventName.GameStart:
    //                 return ["**Game started!!**"];
    //             case GameEventName.GameEnd:
    //                 return ["**Game ended!!**"];
    //             case GameEventName.RevealCards: {
    //                 const ret: string[] = [];

    //                 item.event.cards.forEach((card, i) => {
    //                     ret.push(`${G.players[i].name} reveals ${card.number} (${new Array(card.points).fill('★').join('')})`);
    //                 });

    //                 return ret;
    //             }

    //             case GameEventName.RoundStart: {
    //                 return [`**Round ${item.event.round}**`];
    //             }
    //         }
    //     }
    // }
}