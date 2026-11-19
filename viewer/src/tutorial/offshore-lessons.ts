import type { GameState, Move } from 'container-engine';
import { availableMoves, move as engineMove, setup } from 'container-engine';
import { ContainerColor as Color, ShipPosition } from 'container-engine/src/gamestate';
import { MoveName } from 'container-engine/src/move';
import type { Lesson, LessonState, TutorialAction } from './lessons';

const pass: Move = { name: MoveName.Pass, data: true };
const cash = (amount: number): Move => ({
    name: MoveName.CallBank,
    data: { type: 'containers', lot: 0 },
    extraData: { cash: amount },
});
const cargo = (game: GameState, seat: number, count: number): Move => ({
    name: MoveName.CallBank,
    data: { type: 'cash', lot: 2 },
    extraData: { containers: game.players[seat].containersOnFactoryStore.slice(0, count).map((c) => c.piece.id) },
});
function fixture(): LessonState {
    const game = setup(3, { offshoreIsland: true }, 'offshore-tutorial-1');
    game.startingPlayer = 0;
    game.currentPlayers = [0];
    game.players.forEach((p, seat) => {
        p.name = ['You', 'Ada', 'Leo'][seat];
        game.containersLeft.push(...p.containersOnFactoryStore.map((c) => c.piece));
        p.containersOnFactoryStore = [];
        // Prepare two genuine stored pieces per player, preserving the complete supply.
        for (const color of [Color.White, Color.Orange]) {
            const i = game.containersLeft.findIndex((c) => c.color === color);
            p.containersOnFactoryStore.push({ piece: game.containersLeft.splice(i, 1)[0], price: 2, moved: false });
        }
        p.actions = seat === 0 ? 2 : 0;
        p.availableMoves = seat === 0 ? availableMoves(game, p) : null;
    });
    return { game, answer: '0' };
}
type Stage = {
    id: string;
    title: string;
    text: string;
    move?: (g: GameState) => Move;
    script?: (g: GameState, apply: (m: Move, seat: number) => void) => void;
};
const endRound = (_g: GameState, apply: (m: Move, seat: number) => void) => {
    apply(pass, 1);
    apply(pass, 2);
};
const finish: Stage = {
    id: 'finish-turn',
    title: 'Leave time for public bids',
    text: 'Choose Pass to end your turn. The bank does not settle immediately: other players can raise before your next turn.',
    move: () => pass,
};
const wait: Stage = {
    id: 'wait-bank',
    title: 'Wait until your next turn',
    text: 'Watch Ada and Leo pass. If you still lead when your next turn begins, the bank settles. This is not the sealed auction used by ships at the main island.',
    script: endRound,
};
function make(id: string, title: string, description: string, stages: Stage[], completion: string): Lesson {
    return {
        game: 'container',
        id,
        version: 1,
        title,
        description,
        initialState: fixture,
        steps: stages.map((stage, index) => ({
            id: stage.id,
            title: stage.title,
            text: stage.text,
            target: stage.script ? 'lesson-actions' : 'game-board',
            complete: (state) => Number(state.answer) > index,
            validateMove(state, action) {
                if (stage.script)
                    return action.kind === 'watch' ? undefined : 'Watch the other players before continuing.';
                const expected = stage.move!(state.game);
                if (action.kind !== 'move' || action.move.name !== expected.name)
                    return 'Follow the bank action described in this step.';
                const actual = action.move;
                const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
                // Container IDs identify physical pieces; display metadata and object key order are irrelevant.
                const data = expected.data as any;
                const got = actual.data as any;
                const matches = data?.id
                    ? got?.id === data.id
                    : data?.type
                    ? got?.type === data.type && got?.lot === data.lot
                    : equal(got, data);
                const extra = (expected as any).extraData as any;
                const supplied = (actual as any).extraData as any;
                const extras =
                    !extra ||
                    Object.keys(extra).every((key) =>
                        key === 'containers'
                            ? equal([...extra[key]].sort(), [...(supplied?.[key] || [])].sort())
                            : supplied?.[key] === extra[key]
                    );
                return matches && extras ? undefined : 'Follow the bank action described in this step.';
            },
        })),
        move(state, action, frame) {
            let game = state.game;
            const index = Number(state.answer);
            const apply = (m: Move, seat: number) => {
                game = engineMove(game, m, seat);
                frame?.(structuredClone(game));
            };
            if (action.kind === 'move') apply(action.move, 0);
            else if (action.kind === 'watch') stages[index].script!(game, apply);
            return { game, answer: String(index + 1) };
        },
        choices(state, step) {
            const stage = stages.find((s) => s.id === step);
            if (!stage) return [];
            const action: TutorialAction = stage.script
                ? { kind: 'watch' }
                : { kind: 'move', move: stage.move!(state.game) };
            return [{ label: stage.script ? 'Watch the other players' : stage.title, action }];
        },
        completion: { title: 'Bank lesson complete', text: completion },
    };
}
export const offshoreLessons: Lesson[] = [
    make(
        'offshore-cargo',
        'Bank cargo and your ship',
        'Bid cash publicly, wait for settlement, then sail and load your safe holding.',
        [
            {
                id: 'cash-offer',
                title: 'Offer $1 for container lot 1',
                text: 'Select bank container lot 1 and confirm a $1 offer. The minimum opening bid and minimum raise are $1. Cash is reserved immediately; empty reward lots cannot be selected.',
                move: () => cash(1),
            },
            finish,
            wait,
            {
                id: 'sail-bank',
                title: 'Sail to your coloured berth',
                text: 'You won! Your containers wait safely in your coloured bank holding. You cannot Call Bank on this winning turn. Select your ship, then sail to the bank. Arrival does not load anything automatically.',
                move: () => ({ name: MoveName.Sail, data: ShipPosition.OffshoreBank }),
            },
            {
                id: 'load-bank',
                title: 'Choose a container to load',
                text: 'Click the first container in your holding to load it. Loading is free only just after arrival (or another pickup), up to five aboard. The remaining holding is safe; it scores $3 per container at game end.',
                move: (g) => ({ name: MoveName.LoadBankContainer, data: g.players[0].bankHolding![0] }),
            },
        ],
        'Public bank auctions do not replace sealed ship auctions. Your cargo is now aboard; containers left in your holding remain yours.'
    ),
    make(
        'offshore-cash',
        'Stored cargo for bank cash',
        'Select real stored cargo, review one offer, then choose payment colour order.',
        [
            {
                id: 'cargo-offer',
                title: 'Offer both factory containers for cash lot 3',
                text: 'Select cash lot 3. Click your white and orange factory containers on the board. Review the chosen lot and two-piece offer in the preview, then confirm once. Only stored factory or warehouse cargo can be offered; reserved cargo still uses store capacity.',
                move: (g) => cargo(g, 0, 2),
            },
            finish,
            wait,
            {
                id: 'payment-order',
                title: 'Pay white first',
                text: 'Choose white first for container lot 1. Payment is distributed across available lots in order. Once only one colour remains, the engine places it automatically: orange goes to lot 2. Your cash arrives without a ship visiting the bank.',
                move: (g) => ({
                    name: MoveName.DistributeBankContainer,
                    data: g.offshoreBank!.decision!.payment.find((c) => c.color === Color.White)!,
                }),
            },
        ],
        'You exchanged stored cargo for cash without moving your ship. Choosing payment colour order changes the future rewards; identical-colour choices resolve automatically.'
    ),
    make(
        'offshore-outbid',
        'Outbid and recover cargo',
        'See a public leader change, reprice returned stock, and wait for the new leader.',
        [
            {
                id: 'opening-cargo',
                title: 'Offer white for cash lot 3',
                text: 'Select cash lot 3 and offer just your white factory container. With three or four players only one bank auction can be active; with five, one of each type. An active auction can only be raised on the same lot.',
                move: (g) => cargo(g, 0, 1),
            },
            finish,
            {
                id: 'rival-raise',
                title: 'Ada offers two containers',
                text: 'Watch Ada raise on the same cash lot. Quantity beats quantity, regardless of colour. Your one container is released from escrow and you choose its new store price.',
                script: (g, apply) => apply(cargo(g, 1, 2), 1),
            },
            {
                id: 'return-cargo',
                title: 'Return white at $3',
                text: 'Choose $3 for your returned white factory container. It returns to its original district; its former price need not be kept. Returning cargo is a decision, not a new turn or action.',
                move: (g) => ({
                    name: MoveName.ReturnBankContainer,
                    data: g.offshoreBank!.decision!.containers[0].container.piece,
                    extraData: { price: 3 },
                }),
            },
            {
                id: 'new-leader',
                title: 'Your next turn does not collect',
                text: 'Watch Ada finish and Leo pass. Ada is now the leader, so your next turn does not win the cash. Raising would require three stored containers, not a different colour or a different lot.',
                script: endRound,
            },
            {
                id: 'let-settle',
                title: 'Let the new leader collect',
                text: 'Pass. Ada must remain leader until her own next turn, not merely yours.',
                move: () => pass,
            },
            {
                id: 'ada-payment',
                title: 'Watch Ada settle',
                text: 'Ada chooses white first; the remaining orange payment is automatic. Watch the bank pay her, leaving cash lot 3 empty and unavailable until replenished.',
                script: (g, apply) =>
                    apply(
                        {
                            name: MoveName.DistributeBankContainer,
                            data: g.offshoreBank!.decision!.payment.find((c) => c.color === Color.White)!,
                        },
                        1
                    ),
            },
        ],
        'A higher public offer changes both the leader and the settlement deadline. Outbid cargo returns to its original store with a new price; outbid cash is refunded.'
    ),
];
