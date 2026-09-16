import type { TutorialOptions, TutorialStep } from '@boardgamers/protocol/tutorial';
import type { GameState, Move } from 'container-engine';
import { availableMoves, ended, move as engineMove, setup } from 'container-engine';
import pointCards from 'container-engine/src/cards';
import { ContainerColor as Color, ContainerPiece, Phase, ShipPosition } from 'container-engine/src/gamestate';
import { MoveName } from 'container-engine/src/move';

export type TutorialAction = { kind: 'move'; move: Move } | { kind: 'watch' } | { kind: 'answer'; answer: string };
export interface LessonState {
    game: GameState;
    answer?: string;
}
export interface Choice {
    label: string;
    action: TutorialAction;
    color?: string;
}
export interface Lesson extends Omit<TutorialOptions<LessonState, TutorialAction>, 'move'> {
    title: string;
    description: string;
    move(state: LessonState, action: TutorialAction, frame?: (game: GameState) => void): LessonState;
    choices(state: LessonState, step: string): Choice[];
}
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const colors = [Color.White, Color.Orange, Color.Tan, Color.Brown, Color.Black];
export const colorName = (color: Color) => (color === Color.Black ? 'dark green' : color);
const play = (move: Move): TutorialAction => ({ kind: 'move', move });
const watch: TutorialAction = { kind: 'watch' };
const pass: Move = { name: MoveName.Pass, data: true };
const sail = (data: ShipPosition): Move => ({ name: MoveName.Sail, data });
const bid = (price: number): Move => ({ name: MoveName.Bid, data: true, extraData: { price } });
function take(game: GameState, color: Color): ContainerPiece {
    const index = game.containersLeft.findIndex((piece) => piece.color === color);
    if (index < 0) throw Error(`No ${color} container left in the lesson setup.`);
    return game.containersLeft.splice(index, 1)[0];
}
function activate(game: GameState, seat: number) {
    game.currentPlayers = [seat];
    for (const player of game.players) {
        player.actions = player.id === seat ? 2 : 0;
        player.availableMoves = player.id === seat ? availableMoves(game, player) : null;
    }
}
function base(): GameState {
    const game = setup(3, { beginner: false }, 'container-tutorial-1');
    game.startingPlayer = 0;
    game.players.forEach((player, index) => {
        player.name = ['You', 'Ada', 'Leo'][index];
        player.pointCard = copy(pointCards[index]);
        game.factoriesLeft.push(...player.factories);
        game.containersLeft.push(...player.containersOnFactoryStore.map((entry) => entry.piece));
        player.containersOnFactoryStore = [];
        player.factories = [];
    });
    [Color.Orange, Color.White, Color.Black].forEach((color, index) => {
        const factory = game.factoriesLeft.findIndex((piece) => piece.color === color);
        game.players[index].factories.push(game.factoriesLeft.splice(factory, 1)[0]);
    });
    activate(game, 0);
    return game;
}
function sourceState(): LessonState {
    const game = base();
    game.players[1].containersOnFactoryStore.push({ piece: take(game, Color.White), price: 2, moved: false });
    activate(game, 0);
    return { game };
}
function buildingState(): LessonState {
    const state = sourceState();
    state.game.players[0].containersOnWarehouseStore.push({
        piece: take(state.game, Color.Brown),
        price: 4,
        moved: false,
    });
    activate(state.game, 0);
    return state;
}
function shippingState(keep = false): LessonState {
    const game = base();
    game.players[0].ship.containers = [take(game, Color.White), take(game, Color.White), take(game, Color.Orange)];
    game.players[0].ship.shipPosition = keep ? ShipPosition.OpenSea : ShipPosition.PlayerHarbor11;
    if (keep)
        game.players[0].containersOnIsland = [
            take(game, Color.Black),
            take(game, Color.Black),
            take(game, Color.Black),
            take(game, Color.Tan),
            take(game, Color.Brown),
        ];
    activate(game, 0);
    return { game };
}
function biddingState(): LessonState {
    const game = base();
    game.players[1].ship.containers = [take(game, Color.White), take(game, Color.White), take(game, Color.Tan)];
    activate(game, 1);
    return { game: engineMove(game, sail(ShipPosition.Island), 1) };
}
function scoringState(): LessonState {
    const game = base();
    const you = game.players[0];
    you.containersOnIsland = [
        Color.Black,
        Color.Black,
        Color.Black,
        Color.White,
        Color.White,
        Color.Orange,
        Color.Tan,
        Color.Brown,
    ].map((color) => take(game, color));
    you.containersOnWarehouseStore.push({ piece: take(game, Color.Brown), price: 4, moved: false });
    you.ship.containers.push(take(game, Color.White));
    you.loans.push(game.loansLeft.pop()!);
    // A prepared last turn: every orange/tan piece is in play, never deleted from the supply.
    for (const [seat, color] of [
        [1, Color.Orange],
        [2, Color.Tan],
    ] as const) {
        while (game.containersLeft.some((piece) => piece.color === color))
            game.players[seat].containersOnIsland.push(take(game, color));
    }
    activate(game, 0);
    return { game };
}

function run(id: string): Lesson['move'] {
    return (state, action, frame) => {
        let game = state.game;
        const apply = (move: Move, seat: number) => {
            game = engineMove(game, move, seat);
            frame?.(copy(game));
        };
        if (action.kind === 'answer') return { ...state, answer: action.answer };
        if (action.kind === 'move') {
            apply(action.move, 0);
            if (id === 'buildings' && action.move.name === MoveName.Pass) {
                apply(pass, 1);
                apply(pass, 2);
            }
        } else if (id === 'supply-chain') {
            apply(sail(ShipPosition.PlayerHarbor01), 1);
            const piece = game.players[0].containersOnWarehouseStore[0].piece;
            apply({ name: MoveName.BuyFromWarehouse, data: { player: 0, piece } }, 1);
            apply(pass, 1);
            apply(pass, 2);
        } else if (id === 'bidding') {
            if (game.phase === Phase.AcceptDecline) apply({ name: MoveName.Accept, data: 0 }, 1);
            else apply(bid(game.highestBidders.length ? 2 : 8), 2);
        } else {
            apply(bid(id === 'keep-cargo' ? 6 : 8), 1);
            apply(bid(id === 'keep-cargo' ? 4 : 6), 2);
        }
        return { ...state, game };
    };
}
function actionStep(
    id: string,
    title: string,
    text: string,
    allowed: (action: TutorialAction) => boolean,
    complete: (state: LessonState) => boolean,
    hint?: string
): TutorialStep<LessonState, TutorialAction> {
    return {
        id,
        title,
        text,
        hint,
        target: 'lesson-actions',
        complete,
        validateMove: (_state, action) =>
            allowed(action) ? undefined : 'Follow the action described in this step, or use Replay step.',
    };
}
const isMove = (name: MoveName) => (action: TutorialAction) => action.kind === 'move' && action.move.name === name;
function questionStep(
    id: string,
    title: string,
    text: string,
    answer: string,
    hint: string,
    success: string
): TutorialStep<LessonState, TutorialAction> {
    return {
        id,
        title,
        text,
        hint,
        success,
        complete: (state) => state.answer === answer,
        validateMove: (_state, action) =>
            action.kind !== 'answer'
                ? 'Choose one of the answers below.'
                : action.answer === answer
                ? undefined
                : `Not quite. ${hint}`,
    };
}
const isWatch = (action: TutorialAction) => action.kind === 'watch';
const choice = (label: string, move: Move): Choice => ({ label, action: play(move) });
const watchChoice = (label: string): Choice[] => [{ label, action: watch }];
const shell = (id: string) => ({ game: 'container', id, version: id === 'keep-cargo' ? 3 : 1, move: run(id) });

const supply: Lesson = {
    ...shell('supply-chain'),
    title: 'From factory to ship',
    description: 'Produce, set prices, trade with another player and load a ship.',
    initialState: sourceState,
    steps: [
        {
            id: 'intro',
            title: 'Make money by trading',
            text: 'Factories produce containers. Other players buy them for their warehouses, then sell them to visiting ships. In this chapter, make a container and earn money from a trade. You cannot buy from your own stores.',
            target: 'business',
        },
        actionStep(
            'produce',
            'Produce and set a price',
            'Your orange factory can produce one orange container. Produce it and offer it for $2. Production costs $1, paid to the player before you, and uses your first action.',
            (action) =>
                action.kind === 'move' &&
                action.move.name === MoveName.Produce &&
                action.move.data === Color.Orange &&
                action.move.extraData.price === 2,
            (state) => state.game.players[0].produced.includes(Color.Orange)
        ),
        actionStep(
            'buy',
            'Buy for your warehouse',
            'Use your second action to buy Ada’s white container for $2. Offer it from your warehouse for $4. The house-shaped row holds warehouse buildings. The squares below it hold containers for sale: their numbers are prices, not extra storage spaces. Your one warehouse holds one container.',
            (action) =>
                action.kind === 'move' &&
                action.move.name === MoveName.BuyFromFactory &&
                action.move.data.player === 1 &&
                action.move.extraData.price === 4,
            (state) => state.game.players[0].containersOnWarehouseStore.length === 1
        ),
        actionStep(
            'finish',
            'Finish your turn',
            'Both actions are spent. In the normal game, Done confirms your purchases and prices. Until then, Undo can revise your turn. In a lesson, use the replay control to start this step again.',
            isMove(MoveName.Pass),
            (state) => state.game.currentPlayers[0] === 1
        ),
        actionStep(
            'trade',
            'Watch Ada load her ship',
            'Ada sails into your harbour and buys the white container for $4. Loading immediately after sailing into a harbour costs no extra action. A ship holds up to five containers. Watch the white container move from your warehouse onto her ship.',
            isWatch,
            (state) => state.game.players[1].ship.containers.length === 1
        ),
    ],
    completion: {
        title: 'Your first trade is complete',
        text: 'You paid $2 and sold for $4: a $2 trading margin. After the $1 production cost, you have $21. Your orange container is still for sale. Ships must pass through open sea between harbours; reaching the island auctions the entire cargo.',
    },
    choices({ game }, step) {
        if (step === 'produce')
            return [
                choice('Produce orange · price $2', {
                    name: MoveName.Produce,
                    data: Color.Orange,
                    extraData: { piece: game.containersLeft.find((piece) => piece.color === Color.Orange)!, price: 2 },
                }),
            ];
        if (step === 'buy')
            return [
                choice('Buy white for $2 · sell at $4', {
                    name: MoveName.BuyFromFactory,
                    data: { player: 1, piece: game.players[1].containersOnFactoryStore[0].piece },
                    extraData: { price: 4 },
                }),
            ];
        if (step === 'finish') return [choice('Done', pass)];
        return step === 'trade' ? watchChoice('Watch Ada trade') : [];
    },
};
const buildings: Lesson = {
    ...shell('buildings'),
    title: 'Factories and warehouses',
    description: 'Distinguish buildings from sale spaces, then expand production and storage.',
    initialState: buildingState,
    steps: [
        {
            id: 'intro',
            title: 'Buildings are not sale spaces',
            text: 'The circles hold factories; the house shapes hold warehouses. Numbers in empty building slots are purchase costs. The squares BELOW each building row hold containers for sale. Their numbers are your selling prices. They do not tell you how many containers you can store.',
            target: 'business',
        },
        actionStep(
            'warehouse',
            'Buy room for another container',
            'Your warehouse is full with one brown container. Each warehouse holds one container. Buy a second warehouse for $4 to increase capacity to two. Buying a building uses one action.',
            isMove(MoveName.BuyWarehouse),
            (state) => state.game.players[0].warehouses.length === 2
        ),
        actionStep(
            'stock',
            'Use the new storage space',
            'Buy Ada’s white container for $2 and offer it for $3. You can now keep both the brown and white containers for visiting ships to buy. Buying a warehouse does not produce or include any containers.',
            (action) =>
                action.kind === 'move' &&
                action.move.name === MoveName.BuyFromFactory &&
                action.move.data.player === 1 &&
                action.move.extraData.price === 3,
            (state) => state.game.players[0].containersOnWarehouseStore.length === 2
        ),
        actionStep(
            'finish',
            'Confirm these two actions',
            'You bought a warehouse, then stock for it. Choose Done. Ada and Leo will pass so you can try expanding your factory next.',
            isMove(MoveName.Pass),
            (state) => state.game.currentPlayers[0] === 0 && state.game.players[0].actions === 2
        ),
        actionStep(
            'factory',
            'Buy a second factory for $6',
            'Your orange factory makes orange containers. Buy a white factory to produce a second colour. You may own only one factory of each colour. Each factory also adds two spaces to your factory sales stock.',
            (action) =>
                action.kind === 'move' && action.move.name === MoveName.BuyFactory && action.move.data === Color.White,
            (state) => state.game.players[0].factories.length === 2
        ),
        actionStep(
            'orange',
            'Produce with both factories',
            'One production action can make one container per factory. Pay $1 for the entire action, even when using several factories. Start with orange and offer it for $2.',
            (action) =>
                action.kind === 'move' &&
                action.move.name === MoveName.Produce &&
                action.move.data === Color.Orange &&
                action.move.extraData.price === 2,
            (state) => state.game.players[0].produced.includes(Color.Orange)
        ),
        actionStep(
            'white',
            'Add white in the same action',
            'Now produce white and offer it for $3. This is still the same production action, with no extra $1 payment. More factories produce more stock; more warehouses let you buy and resell more stock from other players.',
            (action) =>
                action.kind === 'move' &&
                action.move.name === MoveName.Produce &&
                action.move.data === Color.White &&
                action.move.extraData.price === 3,
            (state) => state.game.players[0].produced.includes(Color.White)
        ),
    ],
    completion: {
        title: 'You expanded both businesses',
        text: 'You have two factories and two warehouses, with $7 left. Your factories can make two colours and store four containers in total. Your warehouses hold two containers bought from other players. Building prices and container sale prices are separate.',
    },
    choices({ game }, step) {
        if (step === 'warehouse')
            return [
                choice('Buy warehouse · pay $4', {
                    name: MoveName.BuyWarehouse,
                    data: true,
                    extraData: game.warehousesLeft[0],
                }),
            ];
        if (step === 'stock')
            return [
                choice('Buy white for $2 · sell at $3', {
                    name: MoveName.BuyFromFactory,
                    data: { player: 1, piece: game.players[1].containersOnFactoryStore[0].piece },
                    extraData: { price: 3 },
                }),
            ];
        if (step === 'finish') return [choice('Done', pass)];
        if (step === 'factory')
            return [
                choice('Buy white factory · pay $6', {
                    name: MoveName.BuyFactory,
                    data: Color.White,
                    extraData: game.factoriesLeft.find((piece) => piece.color === Color.White)!,
                }),
            ];
        if (step === 'orange' || step === 'white') {
            const color = step === 'orange' ? Color.Orange : Color.White;
            const price = step === 'orange' ? 2 : 3;
            return [
                choice(`Produce ${step} · price $${price}`, {
                    name: MoveName.Produce,
                    data: color,
                    extraData: { piece: game.containersLeft.find((piece) => piece.color === color)!, price },
                }),
            ];
        }
        return [];
    },
};
const selling: Lesson = {
    ...shell('selling'),
    title: 'Sail and sell your cargo',
    description: 'Start an auction, reveal the sealed bids and collect the bank subsidy.',
    initialState: () => shippingState(),
    steps: [
        {
            id: 'intro',
            title: 'One auction for the whole ship',
            text: 'Your ship is already loaded at Ada’s harbour. Two white containers and one orange container will be sold together. You are the seller: everyone else bids, then you decide whether to sell or buy the cargo yourself.',
            target: 'cargo',
        },
        actionStep(
            'sea',
            'Harbour → open sea',
            'Sail into open sea. Moving directly from one harbour to another is not allowed. This uses one of your two actions.',
            isMove(MoveName.Sail),
            (state) => state.game.players[0].ship.shipPosition === ShipPosition.OpenSea
        ),
        actionStep(
            'island',
            'Open sea → island',
            'Sail to the island to start the auction. An island auction ends your turn even if it was your first action. The seller does not submit a bid.',
            (action) =>
                action.kind === 'move' &&
                action.move.name === MoveName.Sail &&
                action.move.data === ShipPosition.Island,
            (state) => state.game.phase === Phase.Bid
        ),
        actionStep(
            'bids',
            'Secret bids, then a reveal',
            'Ada and Leo each choose one secret bid for all three containers. They cannot see the other bid before both are submitted. A bid of $0 is allowed. Watch their bids reveal together.',
            isWatch,
            (state) => state.game.phase === Phase.AcceptDecline
        ),
        actionStep(
            'accept',
            'Accept $8 and receive $16',
            'Ada offered $8; Leo offered $6. Accept Ada’s highest bid. She pays you $8 and gets all three containers on her island. The bank adds another $8: you receive $16 in total.',
            (action) => action.kind === 'move' && action.move.name === MoveName.Accept && action.move.data === 1,
            (state) => state.game.players[1].containersOnIsland.length === 3
        ),
    ],
    completion: {
        title: 'The subsidy rewards shipping',
        text: 'You now have $36. Ada paid $8, Leo paid nothing, and your empty ship stays at the island. The next player’s turn begins. The bank subsidy goes only to the seller when another player buys the cargo.',
    },
    choices(_state, step) {
        if (step === 'sea') return [choice('Sail to open sea', sail(ShipPosition.OpenSea))];
        if (step === 'island') return [choice('Sail to the island', sail(ShipPosition.Island))];
        if (step === 'bids') return watchChoice('Watch the sealed bids');
        return step === 'accept' ? [choice('Accept Ada · receive $16', { name: MoveName.Accept, data: 1 })] : [];
    },
};
const bidding: Lesson = {
    ...shell('bidding'),
    title: 'Bid, raise and break a tie',
    description: 'Make a sealed offer, add a tie-break bid and see who pays.',
    initialState: biddingState,
    steps: [
        {
            id: 'intro',
            title: 'Now you are the buyer',
            text: 'Ada is auctioning two white containers and one tan container as a single shipment. Bid for all three, and remember she may keep them instead. You can ignore your value card for now: this chapter teaches bidding. The next chapters explain how containers score.',
            target: 'cargo',
        },
        actionStep(
            'bid',
            'Submit a sealed bid of $8',
            'Enter 8 and choose Bid. Your offer is hidden from Leo until he has also bid. You only pay if Ada ultimately sells the cargo to you. You cannot bid more cash than you hold.',
            (action) =>
                action.kind === 'move' && action.move.name === MoveName.Bid && action.move.extraData.price === 8,
            (state) => state.game.players[0].bid === 8
        ),
        actionStep(
            'reveal',
            'Wait for the other bidder',
            'Your $8 is submitted. Watch Leo submit his sealed bid; both first-round offers are then revealed.',
            isWatch,
            (state) => state.game.highestBidders.length === 2
        ),
        actionStep(
            'raise',
            'A tie: add $2',
            'You and Leo both offered $8. Only the tied highest bidders bid again. Enter 2 as your additional bid: your new total will be $10, not $2. You may add $0, but cannot lower your first bid.',
            (action) =>
                action.kind === 'move' && action.move.name === MoveName.Bid && action.move.extraData.price === 2,
            (state) => state.game.players[0].additionalBid === 2
        ),
        actionStep(
            'second-reveal',
            'Reveal the additional bids',
            'Your extra $2 is secret until Leo submits his addition. Watch the second reveal.',
            isWatch,
            (state) => state.game.phase === Phase.AcceptDecline
        ),
        {
            id: 'still-tied',
            title: 'Still tied? The seller chooses',
            text: 'Leo also added $2, so both total bids are $10. There is no third bidding round. Ada may accept either tied highest bidder, or pay $10 to the bank and keep the cargo.',
            target: 'auction-summary',
        },
        actionStep(
            'seller',
            'Watch Ada choose your offer',
            'Ada chooses you. You pay only your total bid of $10; the extra bid is not charged again. Leo pays nothing.',
            isWatch,
            (state) => state.game.players[0].containersOnIsland.length === 3
        ),
    ],
    completion: {
        title: 'You won the cargo, not the game yet',
        text: 'You have $10 cash and three island containers. Ada received $20 including the subsidy. At the end of the game, every container of your most numerous island colour is removed. For example, with five white containers and four of each other colour, all five white containers are removed and score $0. The next chapters explain the rest of scoring.',
    },
    choices(_state, step) {
        return ['reveal', 'second-reveal'].includes(step)
            ? watchChoice('Reveal the bids')
            : step === 'seller'
            ? watchChoice('Watch Ada choose')
            : [];
    },
};
const keeping: Lesson = {
    ...shell('keep-cargo'),
    title: 'Keep the cargo yourself',
    description: 'Decline the bids, pay the bank and compare the cost with selling.',
    initialState: () => shippingState(true),
    steps: [
        {
            id: 'intro',
            title: 'Decline does not cancel the auction',
            text: 'You already have three dark-green containers, one tan and one brown on your island. The ship’s white and orange containers would complete your five-colour set. This time, practise buying your own shipment.',
            target: 'cargo',
        },
        actionStep(
            'island',
            'Offer your shipment',
            'Sail to the island. Ada and Leo will bid for the entire cargo, just as in the previous auction.',
            (action) =>
                action.kind === 'move' &&
                action.move.name === MoveName.Sail &&
                action.move.data === ShipPosition.Island,
            (state) => state.game.phase === Phase.Bid
        ),
        actionStep(
            'bids',
            'Reveal the offers',
            'Wait for both sealed bids before deciding what to do with your shipment.',
            isWatch,
            (state) => state.game.phase === Phase.AcceptDecline
        ),
        {
            id: 'private-values',
            title: 'Your own values, hidden from others',
            text: 'Each player has a private value card. The same colour can be worth different amounts to different players, and you cannot see their cards. These are the final scoring values of island containers, not their buying prices. On your card, white is worth $10 each.',
            target: 'value-card',
        },
        {
            id: 'set-and-discard',
            title: 'The $5 or $10 bonus, then the discard',
            text: 'Orange is marked $5/10 on your card: each orange scores $10 if your island has all five colours, or $5 otherwise. Then remove every container of your most numerous colour. Keeping this cargo gives you all five colours; your three dark-green containers will be removed and score $0.',
            target: 'score-preview',
        },
        questionStep(
            'keep-value',
            'What does keeping add?',
            'The two white containers are worth $20. The orange is worth $10 because it completes your five-colour set. Keeping adds $30 in containers, but costs $6 paid to the bank. What is the net gain?',
            '24',
            '$30 in containers minus the $6 payment.',
            'Correct! $30 in containers − $6 paid to the bank = $24 gained.'
        ),
        questionStep(
            'sell-value',
            'What does selling earn?',
            'Ada pays her $6 bid and the bank matches it. How much cash do you receive in total?',
            '12',
            'Add the $6 bid and the $6 bank subsidy.',
            'Correct! Ada’s $6 + the bank’s $6 = $12 received.'
        ),
        actionStep(
            'decline',
            'Pay $6 to keep it',
            'Keeping gains $24 of final value. Selling earns $12 cash. In this position, keeping is worth $12 more. Keep the cargo: pay $6 to the bank and add all three containers to your island. You receive no subsidy.',
            isMove(MoveName.Decline),
            (state) => state.game.players[0].ship.containers.length === 0
        ),
    ],
    completion: {
        title: 'Cargo instead of cash',
        text: 'You have $14 left and all five colours on your island. Each orange now qualifies for $10. At final scoring, remove all three dark-green containers: they are your most numerous colour and score $0. To keep a shipment, you must be able to pay the highest bid. Loans give you $10, cost $1 interest each turn and deduct $11 each from your final score if unpaid.',
    },
    choices(_state, step) {
        if (step === 'island') return [choice('Sail to the island', sail(ShipPosition.Island))];
        if (step === 'bids') return watchChoice('Reveal the bids');
        if (step === 'keep-value' || step === 'sell-value') {
            const answers = step === 'keep-value' ? ['24', '30', '36'] : ['6', '12', '18'];
            return answers.map((answer) => ({
                label: `$${answer}`,
                action: { kind: 'answer', answer },
            }));
        }
        return step === 'decline' ? [choice('Keep cargo · pay $6', { name: MoveName.Decline, data: true })] : [];
    },
};
const scoring: Lesson = {
    ...shell('scoring'),
    title: 'What actually scores?',
    description: 'Discard your most numerous colour, value a full set and count the final money.',
    initialState: scoringState,
    steps: [
        {
            id: 'intro',
            title: 'The last turn',
            text: 'Two colours in the supply are empty, so the game ends after this turn. Your island has 3 dark green, 2 white, 1 orange, 1 tan and 1 brown. Each player has a private card with different values for these colours. Your card determines your final score; the prices you paid at auction do not.',
            target: 'score-preview',
        },
        questionStep(
            'set',
            'Check all five colours first',
            'The orange row says $5/10: each orange scores $10 if you have all five colours on your island, or $5 otherwise. Check this before removing any containers. You have all five colours. What is each orange worth?',
            '10',
            'All five colours are present, so use the higher value on the card.',
            'Correct! All five colours are present, so each orange scores $10.'
        ),
        questionStep(
            'discard',
            'Which entire colour is removed?',
            'At final scoring, remove every container of your most numerous island colour. All containers of that colour score $0, regardless of their card value. If colours tie, remove your $5/10 colour if it is tied; otherwise the game removes the lowest-valued tied colour. Which colour must you remove here?',
            Color.Black,
            'You have 3 dark green, 2 white, and 1 of each other colour. Remove the colour with the most containers.',
            'Correct! Remove all 3 dark-green containers. All three score $0.'
        ),
        actionStep(
            'finish',
            'Finish the game and count',
            'The three dark-green containers contribute $0. White earns $20, orange $10, tan $6 and brown $4: $40 from the island. Add $20 cash, $2 for your warehouse container and $3 for the container on your ship; subtract $11 for your loan. Factory stock and buildings score nothing. Choose Done to see the final result.',
            isMove(MoveName.Pass),
            (state) => ended(state.game)
        ),
    ],
    completion: {
        title: 'You finish with $54',
        text: 'Your final total is: $20 + $40 + $2 + $3 − $11 = $54. The highest final total wins. Aim for profitable trade and useful island cargo, while watching which colour will be discarded. The final-score table below shows every component.',
    },
    choices(_state, step) {
        if (step === 'set')
            return ['5', '10'].map((answer) => ({
                label: `$${answer}`,
                action: { kind: 'answer', answer },
            }));
        if (step === 'discard')
            return colors.map((color) => ({
                label: colorName(color),
                color,
                action: { kind: 'answer', answer: color },
            }));
        return step === 'finish' ? [choice('Done · score the game', pass)] : [];
    },
};
export const lessons: Lesson[] = [supply, buildings, selling, bidding, keeping, scoring];
export const chapterCards = lessons.map(({ id, version, title, description }) => ({ id, version, title, description }));
