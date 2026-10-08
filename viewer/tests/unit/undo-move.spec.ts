import { UndoButton, UndoMoveButton } from '@/components/buttons';
import Game from '@/components/Game.vue';
import { shallowMount } from '@vue/test-utils';
import { expect } from 'chai';
import { move, Move, MoveName, setup } from 'container-engine';
import { EventEmitter } from 'events';

const copy = (value) => JSON.parse(JSON.stringify(value));
const pass: Move = { name: MoveName.Pass, data: true };
const getLoan: Move = { name: MoveName.GetLoan, data: true };

function mountGame(props: Record<string, unknown> = {}) {
    const state = setup(3, {}, 'undo-move');
    const player = state.currentPlayers[0];
    const emitter = new EventEmitter();
    const undos: unknown[] = [];
    emitter.on('undo', () => undos.push(true));
    const wrapper = shallowMount(Game, {
        propsData: { state, player, emitter, preferences: { sound: false }, ...props },
    });
    const shown = () => wrapper.findComponent(UndoMoveButton).exists();
    return { wrapper, vm: wrapper.vm as any, state, player, undos, shown };
}

describe('Undo my move', () => {
    it('is hidden by default, shown while BGS offers it, and requests the undo', async () => {
        const { wrapper, undos, shown } = mountGame();
        expect(shown()).to.equal(false);
        expect(wrapper.findComponent(UndoButton).exists()).to.equal(true);
        await wrapper.setProps({ undoAvailable: true });
        expect(shown()).to.equal(true);
        expect(wrapper.findComponent(UndoButton).exists(), 'it takes the in-turn undo slot').to.equal(false);
        wrapper.findComponent(UndoMoveButton).vm.$emit('click');
        expect(undos).to.have.length(1);
        await wrapper.setProps({ undoAvailable: false });
        expect(shown()).to.equal(false);
        expect(wrapper.findComponent(UndoButton).exists()).to.equal(true);
        wrapper.destroy();
    });

    for (const [mode, props] of [
        ['spectators', { player: undefined }],
        ['analysis', { preferences: { sound: false, analysis: true } }],
        ['lessons', { tutorialMove: () => undefined }],
        ['a non-interactive board', { interactionDisabled: true }],
    ] as [string, Record<string, unknown>][]) {
        it(`is hidden for ${mode}`, async () => {
            const { wrapper, vm, undos, shown } = mountGame({ undoAvailable: true, ...props });
            expect(shown()).to.equal(false);
            vm.requestUndo();
            expect(undos).to.have.length(0);
            wrapper.destroy();
        });
    }

    it('is hidden once the game has ended', async () => {
        const { wrapper, state, shown } = mountGame({ undoAvailable: true });
        expect(shown()).to.equal(true);
        await wrapper.setProps({ state: { ...copy(state), phase: 'gameEnd' } });
        expect(shown()).to.equal(false);
        wrapper.destroy();
    });

    it('leaves the slot to the in-turn undo while the turn has unsaved moves', async () => {
        const { wrapper, vm, shown } = mountGame({ undoAvailable: true });
        vm.sendMove(getLoan);
        expect(vm.turnMoves).to.have.length(1);
        await wrapper.vm.$nextTick();
        expect(shown()).to.equal(false);
        expect(wrapper.findComponent(UndoButton).props('enabled')).to.equal(true);
        vm.undo();
        await wrapper.vm.$nextTick();
        expect(shown()).to.equal(true);
        wrapper.destroy();
    });

    it('renders an earlier state and discards drafts when moves are taken back', async () => {
        const { wrapper, vm, state, player } = mountGame({ undoAvailable: true });
        const later = move(copy(state), pass, player);
        expect(later.newTurn).to.not.equal(false);
        await wrapper.setProps({ state: later });
        const drafts = () => ({
            selected: vm.ui.selected,
            editingBid: vm.editingBid,
            confirmBid: vm.confirmBidVisible,
            confirmBidRevision: vm.confirmBidRevision,
            totalBid: vm.totalBid,
            confirmSail: vm.confirmSailVisible,
        });
        const draft = () =>
            Object.assign(vm, {
                editingBid: '1:3:0:initial',
                confirmBidVisible: true,
                confirmBidRevision: '1:3:0:initial',
                totalBid: 7,
                confirmSailVisible: true,
            });
        draft();
        vm.ui.selected = { pieceType: 'container', pieceId: 'C1', canDrag: true };
        const version = vm.draftsVersion;

        // A later position (the game moving on) keeps the drafts.
        await wrapper.setProps({ state: copy(later) });
        expect(drafts().totalBid).to.equal(7);

        await wrapper.setProps({ state: copy(state) });
        expect(copy(vm.G)).to.deep.equal(copy(state));
        expect(vm.turnMoves).to.deep.equal([]);
        expect(drafts()).to.deep.equal({
            selected: null,
            editingBid: null,
            confirmBid: false,
            confirmBidRevision: null,
            totalBid: 0,
            confirmSail: false,
        });
        expect(vm.draftsVersion, 'the bid calculator is remounted').to.equal(version + 1);

        // Requesting the undo discards drafts right away, even before the state arrives.
        draft();
        wrapper.findComponent(UndoMoveButton).vm.$emit('click');
        expect(drafts().totalBid).to.equal(0);
        expect(drafts().confirmBid).to.equal(false);
        expect(vm.draftsVersion).to.equal(version + 2);
        wrapper.destroy();
    });
});
