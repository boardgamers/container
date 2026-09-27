import Game from '@/components/Game.vue';
import { shallowMount } from '@vue/test-utils';
import { expect } from 'chai';
import { availableMoves, move, Move, MoveName, setup } from 'container-engine';
import { EventEmitter } from 'events';

const getLoan: Move = { name: MoveName.GetLoan, data: true };
const payLoan: Move = { name: MoveName.PayLoan, data: true };
const copy = (value) => JSON.parse(JSON.stringify(value));

function mountWithLoan(hasLoan = false) {
    const state = setup(3, {}, 'viewer-loans');
    const player = state.currentPlayers[0];
    if (hasLoan) {
        state.players[player].loans.push(state.loansLeft.pop()!);
        state.players[player].availableMoves = availableMoves(state, state.players[player]);
    }
    const emitter = new EventEmitter();
    const sent: Move[][] = [];
    emitter.on('move', (moves) => sent.push(copy(moves)));
    const wrapper = shallowMount(Game, {
        propsData: { state, player, emitter, preferences: { sound: false } },
    });
    return { wrapper, vm: wrapper.vm as any, state, player, sent };
}

describe('Loan reversal', () => {
    for (const hasLoan of [false, true]) {
        it(`cancels ${hasLoan ? 'repayment then borrowing' : 'borrowing then repayment'} immediately`, () => {
            const { wrapper, vm, state, sent } = mountWithLoan(hasLoan);
            for (let i = 0; i < 50; i++) {
                vm.sendMove(hasLoan ? payLoan : getLoan);
                vm.sendMove(hasLoan ? getLoan : payLoan);
                expect(vm.turnMoves).to.deep.equal([]);
                expect(copy(vm.G)).to.deep.equal(copy(state));
            }
            expect(sent).to.have.length(50);
            expect(sent.every((buffer) => buffer.length === 1)).to.equal(true);
            wrapper.destroy();
        });
    }

    it('resends the shortened buffer when another loan remains', () => {
        const { wrapper, vm, state, player, sent } = mountWithLoan();
        vm.sendMove(getLoan);
        vm.sendMove(getLoan);
        vm.sendMove(payLoan);
        expect(vm.turnMoves).to.deep.equal([getLoan]);
        expect(sent[sent.length - 1]).to.deep.equal([getLoan]);
        expect(copy(vm.G)).to.deep.equal(copy(move(copy(state), getLoan, player, true)));
        wrapper.destroy();
    });

    it('does not resurrect a cancelled loan when its tentative server response arrives late', async () => {
        const { wrapper, vm, state, player } = mountWithLoan();
        const late = move(copy(state), getLoan, player);
        vm.sendMove(getLoan);
        vm.sendMove(payLoan);
        await wrapper.setProps({ state: late });
        expect(vm.turnMoves).to.deep.equal([]);
        expect(copy(vm.G)).to.deep.equal(copy(state));
        wrapper.destroy();
    });

    it('keeps a loan and repayment when a purchase occurs between them', () => {
        const { wrapper, vm, state } = mountWithLoan();
        const purchase: Move = { name: MoveName.BuyWarehouse, data: true, extraData: state.warehousesLeft[0] };
        for (const action of [getLoan, purchase, payLoan]) vm.sendMove(action);
        expect(vm.turnMoves).to.deep.equal([getLoan, purchase, payLoan]);
        expect(vm.G.log.length).to.equal(state.log.length + 3);
        wrapper.destroy();
    });
});
