import { expect } from "chai";
import { availableMoves } from "./available-moves";
import { setup, move as execMove, ended } from './engine';
import { ContainerColor, ShipPosition } from "./gamestate";
import { Move } from './move';

/*
    Current player: 2,
    Factories: blue, white, red,
    Point Cards: rybwu, ybwur, urybw
*/
describe("Engine", () => {
    it("should play full game", () => {
        let G = setup(5, { beginner: false }, "test");

        G.currentPlayer = 0;
        G.players[0].actions = 2;
        G.players[0].availableMoves = availableMoves(G, G.players[0]);
        G.players[0].factories[0] = ContainerColor.Blue;
        G.players[1].factories[0] = ContainerColor.Red;
        G.players[2].factories[0] = ContainerColor.Black;
        G.players[3].factories[0] = ContainerColor.Yellow;
        G.players[4].factories[0] = ContainerColor.White;
        G.players[0].containersOnFactoryStore[0] = { containerColor: ContainerColor.Blue, price: 2 };
        G.players[1].containersOnFactoryStore[0] = { containerColor: ContainerColor.Red, price: 2 };
        G.players[2].containersOnFactoryStore[0] = { containerColor: ContainerColor.Black, price: 2 };
        G.players[3].containersOnFactoryStore[0] = { containerColor: ContainerColor.Yellow, price: 2 };
        G.players[4].containersOnFactoryStore[0] = { containerColor: ContainerColor.White, price: 2 };

        G = execMove(G, { name: "buyFactory", data: ContainerColor.Red } as Move, 0);
        G = execMove(G, { name: "buyWarehouse", data: true } as Move, 0);
        G = execMove(G, { name: "pass", data: true } as Move, 0);

        G = execMove(G, { name: "buyFactory", data: ContainerColor.Yellow } as Move, 1);
        G = execMove(G, { name: "produce", data: ContainerColor.Red, extraData: { price: 2 } } as Move, 1);
        G = execMove(G, { name: "produce", data: ContainerColor.Yellow, extraData: { price: 2 } } as Move, 1);
        G = execMove(G, { name: "pass", data: true } as Move, 1);

        G = execMove(G, { name: "buyWarehouse", data: true } as Move, 2);
        G = execMove(G, { name: "buyFromFactory", data: { player: 1, container: { containerColor: ContainerColor.Red, price: 2 } }, extraData: { price: 4 } } as Move, 2);
        G = execMove(G, { name: "buyFromFactory", data: { player: 1, container: { containerColor: ContainerColor.Red, price: 2 } }, extraData: { price: 4 } } as Move, 2);
        G = execMove(G, { name: "pass", data: true } as Move, 2);

        G = execMove(G, { name: "buyFactory", data: ContainerColor.Black } as Move, 3);
        G = execMove(G, { name: "produce", data: ContainerColor.Black, extraData: { price: 3 } } as Move, 3);
        G = execMove(G, { name: "produce", data: ContainerColor.Yellow, extraData: { price: 2 } } as Move, 3);
        G = execMove(G, { name: "pass", data: true } as Move, 3);

        G = execMove(G, { name: "buyWarehouse", data: true } as Move, 4);
        G = execMove(G, { name: "sail", data: ShipPosition.Player2 } as Move, 4);
        G = execMove(G, { name: "buyFromWarehouse", data: { player: 2, container: { containerColor: ContainerColor.Red, price: 4 } } } as Move, 4);
        G = execMove(G, { name: "buyFromWarehouse", data: { player: 2, container: { containerColor: ContainerColor.Red, price: 4 } } } as Move, 4);
        G = execMove(G, { name: "pass", data: true } as Move, 4);

        G = execMove(G, { name: "produce", data: ContainerColor.Red, extraData: { price: 3 } } as Move, 0);
        G = execMove(G, { name: "produce", data: ContainerColor.Blue, extraData: { price: 2 } } as Move, 0);
        G = execMove(G, { name: "buyFromFactory", data: { player: 2, container: { containerColor: ContainerColor.Black, price: 2 } }, extraData: { price: 3 } } as Move, 0);
        G = execMove(G, { name: "pass", data: true } as Move, 0);

        G = execMove(G, { name: "buyFactory", data: ContainerColor.White } as Move, 1);
        G = execMove(G, { name: "produce", data: ContainerColor.Red, extraData: { price: 2 } } as Move, 1);
        G = execMove(G, { name: "produce", data: ContainerColor.Yellow, extraData: { price: 2 } } as Move, 1);
        G = execMove(G, { name: "produce", data: ContainerColor.White, extraData: { price: 3 } } as Move, 1);
        G = execMove(G, { name: "pass", data: true } as Move, 1);

        G = execMove(G, { name: "buyFactory", data: ContainerColor.Blue } as Move, 2);
        G = execMove(G, { name: "buyFromFactory", data: { player: 1, container: { containerColor: ContainerColor.Yellow, price: 2 } }, extraData: { price: 3 } } as Move, 2);
        G = execMove(G, { name: "buyFromFactory", data: { player: 1, container: { containerColor: ContainerColor.Yellow, price: 2 } }, extraData: { price: 3 } } as Move, 2);
        G = execMove(G, { name: "pass", data: true } as Move, 2);

        G = execMove(G, { name: "buyFactory", data: ContainerColor.Blue } as Move, 3);
        G = execMove(G, { name: "produce", data: ContainerColor.Yellow, extraData: { price: 2 } } as Move, 3);
        G = execMove(G, { name: "produce", data: ContainerColor.Black, extraData: { price: 3 } } as Move, 3);
        G = execMove(G, { name: "produce", data: ContainerColor.Blue, extraData: { price: 2 } } as Move, 3);
        G = execMove(G, { name: "pass", data: true } as Move, 3);

        G = execMove(G, { name: "buyWarehouse", data: true } as Move, 4);
        G = execMove(G, { name: "sail", data: ShipPosition.OpenSea } as Move, 4);
        G = execMove(G, { name: "pass", data: true } as Move, 4);

        G = execMove(G, { name: "buyFromFactory", data: { player: 3, container: { containerColor: ContainerColor.Yellow, price: 2 } }, extraData: { price: 4 } } as Move, 0);
        G = execMove(G, { name: "sail", data: ShipPosition.Player2 } as Move, 0);
        G = execMove(G, { name: "buyFromWarehouse", data: { player: 2, container: { containerColor: ContainerColor.Yellow, price: 3 } } } as Move, 0);
        G = execMove(G, { name: "buyFromWarehouse", data: { player: 2, container: { containerColor: ContainerColor.Yellow, price: 3 } } } as Move, 0);
        G = execMove(G, { name: "pass", data: true } as Move, 0);

        G = execMove(G, { name: "produce", data: ContainerColor.Yellow, extraData: { price: 3 } } as Move, 1);
        G = execMove(G, { name: "produce", data: ContainerColor.Red, extraData: { price: 3 } } as Move, 1);
        G = execMove(G, { name: "produce", data: ContainerColor.White, extraData: { price: 3 } } as Move, 1);
        G = execMove(G, { name: "arrangeFactory", data: { containerColor: ContainerColor.White, price: 3 }, extraData: { price: 2 } } as Move, 1);
        G = execMove(G, { name: "arrangeFactory", data: { containerColor: ContainerColor.White, price: 3 }, extraData: { price: 2 } } as Move, 1);
        G = execMove(G, { name: "arrangeFactory", data: { containerColor: ContainerColor.Red, price: 3 }, extraData: { price: 2 } } as Move, 1);
        G = execMove(G, { name: "arrangeFactory", data: { containerColor: ContainerColor.Yellow, price: 3 }, extraData: { price: 2 } } as Move, 1);
        G = execMove(G, { name: "sail", data: ShipPosition.Player0 } as Move, 1);
        G = execMove(G, { name: "buyFromWarehouse", data: { player: 0, container: { containerColor: ContainerColor.Black, price: 3 } } } as Move, 1);
        G = execMove(G, { name: "buyFromWarehouse", data: { player: 0, container: { containerColor: ContainerColor.Yellow, price: 4 } } } as Move, 1);
        G = execMove(G, { name: "pass", data: true } as Move, 1);

        G = execMove(G, { name: "buyWarehouse", data: true } as Move, 2);
        G = execMove(G, { name: "buyFromFactory", data: { player: 1, container: { containerColor: ContainerColor.White, price: 2 } }, extraData: { price: 3 } } as Move, 2);
        G = execMove(G, { name: "buyFromFactory", data: { player: 1, container: { containerColor: ContainerColor.White, price: 2 } }, extraData: { price: 3 } } as Move, 2);
        G = execMove(G, { name: "buyFromFactory", data: { player: 1, container: { containerColor: ContainerColor.Red, price: 2 } }, extraData: { price: 4 } } as Move, 2);
        G = execMove(G, { name: "pass", data: true } as Move, 2);

        G = execMove(G, { name: "buyWarehouse", data: true } as Move, 3);
        G = execMove(G, { name: "produce", data: ContainerColor.Blue, extraData: { price: 1 } } as Move, 3);
        G = execMove(G, { name: "arrangeFactory", data: { containerColor: ContainerColor.Blue, price: 2 }, extraData: { price: 1 } } as Move, 3);
        G = execMove(G, { name: "arrangeFactory", data: { containerColor: ContainerColor.Black, price: 3 }, extraData: { price: 2 } } as Move, 3);
        G = execMove(G, { name: "arrangeFactory", data: { containerColor: ContainerColor.Black, price: 3 }, extraData: { price: 2 } } as Move, 3);
        G = execMove(G, { name: "pass", data: true } as Move, 3);

        G = execMove(G, { name: "buyFromFactory", data: { player: 3, container: { containerColor: ContainerColor.Blue, price: 1 } }, extraData: { price: 4 } } as Move, 4);
        G = execMove(G, { name: "buyFromFactory", data: { player: 3, container: { containerColor: ContainerColor.Blue, price: 1 } }, extraData: { price: 4 } } as Move, 4);
        G = execMove(G, { name: "sail", data: ShipPosition.Island } as Move, 4);
        G = execMove(G, { name: "bid", data: true, extraData: { price: 1 } } as Move, 0);
        G = execMove(G, { name: "bid", data: true, extraData: { price: 5 } } as Move, 1);
        G = execMove(G, { name: "bid", data: true, extraData: { price: 4 } } as Move, 2);
        G = execMove(G, { name: "bid", data: true, extraData: { price: 2 } } as Move, 3);
        G = execMove(G, { name: "accept", data: 1 } as Move, 4);

        G = execMove(G, { name: "buyFromWarehouse", data: { player: 2, container: { containerColor: ContainerColor.White, price: 3 } } } as Move, 0);
        G = execMove(G, { name: "buyFromWarehouse", data: { player: 2, container: { containerColor: ContainerColor.White, price: 3 } } } as Move, 0);
        G = execMove(G, { name: "sail", data: ShipPosition.OpenSea } as Move, 0);
        G = execMove(G, { name: "pass", data: true } as Move, 0);

        G = execMove(G, { name: "produce", data: ContainerColor.Red, extraData: { price: 2 } } as Move, 1);
        G = execMove(G, { name: "produce", data: ContainerColor.Yellow, extraData: { price: 2 } } as Move, 1);
        G = execMove(G, { name: "produce", data: ContainerColor.White, extraData: { price: 2 } } as Move, 1);
        G = execMove(G, { name: "sail", data: ShipPosition.OpenSea } as Move, 1);
        G = execMove(G, { name: "pass", data: true } as Move, 1);

        G = execMove(G, { name: "sail", data: ShipPosition.Player4 } as Move, 2);
        G = execMove(G, { name: "buyFromWarehouse", data: { player: 4, container: { containerColor: ContainerColor.Blue, price: 4 } } } as Move, 2);
        G = execMove(G, { name: "buyFromWarehouse", data: { player: 4, container: { containerColor: ContainerColor.Blue, price: 4 } } } as Move, 2);
        G = execMove(G, { name: "buyFromFactory", data: { player: 3, container: { containerColor: ContainerColor.Black, price: 2 } }, extraData: { price: 3 } } as Move, 2);
        G = execMove(G, { name: "buyFromFactory", data: { player: 3, container: { containerColor: ContainerColor.Black, price: 2 } }, extraData: { price: 3 } } as Move, 2);
        G = execMove(G, { name: "arrangeWarehouse", data: { containerColor: ContainerColor.Red, price: 4 }, extraData: { price: 3 } } as Move, 2);
        G = execMove(G, { name: "pass", data: true } as Move, 2);

        G = execMove(G, { name: "sail", data: ShipPosition.Player2 } as Move, 3);
        G = execMove(G, { name: "getLoan", data: true } as Move, 3);
        G = execMove(G, { name: "buyFromWarehouse", data: { player: 2, container: { containerColor: ContainerColor.Black, price: 3 } } } as Move, 3);
        G = execMove(G, { name: "buyFromWarehouse", data: { player: 2, container: { containerColor: ContainerColor.Black, price: 3 } } } as Move, 3);
        G = execMove(G, { name: "buyFromWarehouse", data: { player: 2, container: { containerColor: ContainerColor.Red, price: 3 } } } as Move, 3);
        G = execMove(G, { name: "sail", data: ShipPosition.OpenSea } as Move, 3);
        G = execMove(G, { name: "pass", data: true } as Move, 3);

        G = execMove(G, { name: "buyFromFactory", data: { player: 1, container: { containerColor: ContainerColor.White, price: 2 } }, extraData: { price: 4 } } as Move, 4);
        G = execMove(G, { name: "buyFromFactory", data: { player: 1, container: { containerColor: ContainerColor.Red, price: 2 } }, extraData: { price: 3 } } as Move, 4);
        G = execMove(G, { name: "buyFromFactory", data: { player: 1, container: { containerColor: ContainerColor.Yellow, price: 2 } }, extraData: { price: 3 } } as Move, 4);
        G = execMove(G, { name: "sail", data: ShipPosition.OpenSea } as Move, 4);
        G = execMove(G, { name: "pass", data: true } as Move, 4);

        G = execMove(G, { name: "sail", data: ShipPosition.Island } as Move, 0);
        G = execMove(G, { name: "getLoan", data: true } as Move, 1);
        G = execMove(G, { name: "bid", data: true, extraData: { price: 11 } } as Move, 1);
        G = execMove(G, { name: "getLoan", data: true } as Move, 2);
        G = execMove(G, { name: "bid", data: true, extraData: { price: 8 } } as Move, 2);
        G = execMove(G, { name: "bid", data: true, extraData: { price: 7 } } as Move, 3);
        G = execMove(G, { name: "bid", data: true, extraData: { price: 9 } } as Move, 4);
        G = execMove(G, { name: "accept", data: 1 } as Move, 0);

        G = execMove(G, { name: "getLoan", data: true } as Move, 1);
        G = execMove(G, { name: "sail", data: ShipPosition.Player4 } as Move, 1);
        G = execMove(G, { name: "buyFromWarehouse", data: { player: 4, container: { containerColor: ContainerColor.Yellow, price: 3 } } } as Move, 1);
        G = execMove(G, { name: "buyFromWarehouse", data: { player: 4, container: { containerColor: ContainerColor.Red, price: 3 } } } as Move, 1);
        G = execMove(G, { name: "buyFromWarehouse", data: { player: 4, container: { containerColor: ContainerColor.White, price: 4 } } } as Move, 1);
        G = execMove(G, { name: "sail", data: ShipPosition.OpenSea } as Move, 1);
        G = execMove(G, { name: "pass", data: true } as Move, 1);

        G = execMove(G, { name: "payLoan", data: true } as Move, 2);
        G = execMove(G, { name: "buyFromFactory", data: { player: 0, container: { containerColor: ContainerColor.Blue, price: 2 } }, extraData: { price: 3 } } as Move, 2);
        G = execMove(G, { name: "buyFromFactory", data: { player: 0, container: { containerColor: ContainerColor.Blue, price: 2 } }, extraData: { price: 3 } } as Move, 2);
        G = execMove(G, { name: "buyFromFactory", data: { player: 3, container: { containerColor: ContainerColor.Yellow, price: 2 } }, extraData: { price: 4 } } as Move, 2);
        G = execMove(G, { name: "pass", data: true } as Move, 2);

        G = execMove(G, { name: "sail", data: ShipPosition.Player2 } as Move, 3);
        G = execMove(G, { name: "buyFromWarehouse", data: { player: 2, container: { containerColor: ContainerColor.Blue, price: 3 } } } as Move, 3);
        G = execMove(G, { name: "buyFromWarehouse", data: { player: 2, container: { containerColor: ContainerColor.Yellow, price: 4 } } } as Move, 3);
        G = execMove(G, { name: "produce", data: ContainerColor.Blue, extraData: { price: 2 } } as Move, 3);
        G = execMove(G, { name: "produce", data: ContainerColor.Black, extraData: { price: 3 } } as Move, 3);
        G = execMove(G, { name: "produce", data: ContainerColor.Yellow, extraData: { price: 2 } } as Move, 3);
        G = execMove(G, { name: "pass", data: true } as Move, 3);

        G = execMove(G, { name: "buyFromFactory", data: { player: 3, container: { containerColor: ContainerColor.Yellow, price: 2 } }, extraData: { price: 4 } } as Move, 4);
        G = execMove(G, { name: "buyFromFactory", data: { player: 3, container: { containerColor: ContainerColor.Yellow, price: 2 } }, extraData: { price: 4 } } as Move, 4);
        G = execMove(G, { name: "buyFromFactory", data: { player: 3, container: { containerColor: ContainerColor.Blue, price: 2 } }, extraData: { price: 2 } } as Move, 4);
        G = execMove(G, { name: "sail", data: ShipPosition.Player2 } as Move, 4);
        G = execMove(G, { name: "buyFromWarehouse", data: { player: 2, container: { containerColor: ContainerColor.Blue, price: 3 } } } as Move, 4);
        G = execMove(G, { name: "pass", data: true } as Move, 4);

        G = execMove(G, { name: "buyWarehouse", data: true } as Move, 0);
        G = execMove(G, { name: "buyFromFactory", data: { player: 1, container: { containerColor: ContainerColor.Yellow, price: 2 } }, extraData: { price: 3 } } as Move, 0);
        G = execMove(G, { name: "buyFromFactory", data: { player: 1, container: { containerColor: ContainerColor.Red, price: 2 } }, extraData: { price: 4 } } as Move, 0);
        G = execMove(G, { name: "pass", data: true } as Move, 0);

        G = execMove(G, { name: "produce", data: ContainerColor.Red, extraData: { price: 3 } } as Move, 1);
        G = execMove(G, { name: "produce", data: ContainerColor.White, extraData: { price: 3 } } as Move, 1);
        G = execMove(G, { name: "produce", data: ContainerColor.Yellow, extraData: { price: 3 } } as Move, 1);
        G = execMove(G, { name: "sail", data: ShipPosition.Island } as Move, 1);
        G = execMove(G, { name: "bid", data: true, extraData: { price: 12 } } as Move, 2);
        G = execMove(G, { name: "bid", data: true, extraData: { price: 5 } } as Move, 3);
        G = execMove(G, { name: "bid", data: true, extraData: { price: 20 } } as Move, 4);
        G = execMove(G, { name: "bid", data: true, extraData: { price: 7 } } as Move, 0);
        G = execMove(G, { name: "accept", data: 4 } as Move, 1);
        G = execMove(G, { name: "payLoan", data: true } as Move, 1);
        G = execMove(G, { name: "payLoan", data: true } as Move, 1);

        // G = execMove(G, { name: "pass", data: true } as Move, 0);
        // G = execMove(G, { name: "pass", data: true } as Move, 1);
        // G = execMove(G, { name: "pass", data: true } as Move, 2);
        // G = execMove(G, { name: "pass", data: true } as Move, 3);
        // G = execMove(G, { name: "pass", data: true } as Move, 4);

        expect(ended(G)).to.be.false;
    });
});
