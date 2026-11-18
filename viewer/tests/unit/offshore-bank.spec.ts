import Game from '@/components/Game.vue';
import OffshoreBank from '@/components/OffshoreBank.vue';
import { legalBankAction } from '@/offshore-actions';
import { escapeJournal, offshoreJournal } from '@/offshore-journal';
import { mount, shallowMount } from '@vue/test-utils';
import { expect } from 'chai';
import { availableMoves, MoveName, setup } from 'container-engine';
import { Phase, ShipPosition } from 'container-engine/src/gamestate';
import { EventEmitter } from 'events';

function fixture() {
    const state = setup(3, { offshoreIsland: true }, 'offshore-viewer');
    const player = state.currentPlayers[0];
    state.players.forEach((p, i) => (p.name = `Trader ${i + 1}`));
    const own = state.players[player];
    own.actions = 2;
    const factory = state.containersLeft.pop()!;
    const warehouse = state.containersLeft.pop()!;
    own.containersOnFactoryStore.push({ piece: factory, price: 2, moved: false });
    own.containersOnWarehouseStore.push({ piece: warehouse, price: 3, moved: false });
    const refresh = () => (own.availableMoves = availableMoves(state, own));
    refresh();
    const render = () =>
        mount(OffshoreBank, { propsData: { state, player, availableMoves: own.availableMoves, colorBlind: true } });
    return { state, player, own, factory, warehouse, refresh, render };
}

describe('Offshore bank viewer', () => {
    it('formats public bank journal details and escapes user-provided player names', () => {
        const { state, player } = fixture();
        state.players[player].name = '<Ada>';
        const text = offshoreJournal(
            {
                type: 'move',
                player,
                pretty: '',
                simple: '',
                move: { name: MoveName.CallBank, data: { type: 'containers', lot: 2 }, extraData: { cash: 4 } },
            },
            state
        )!;
        expect(text).to.equal('<Ada> calls bank for container lot 3: $4 in escrow.');
        expect(escapeJournal(text)).to.contain('&lt;Ada&gt;');
    });
    it('keeps classic games free of the expansion panel', () => {
        const state = setup(3, {}, 'classic-viewer');
        const wrapper = shallowMount(Game, {
            propsData: {
                state,
                player: state.currentPlayers[0],
                emitter: new EventEmitter(),
                preferences: { sound: false },
            },
        });
        expect(wrapper.findComponent(OffshoreBank).exists()).to.equal(false);
        wrapper.destroy();
    });

    it('shows three lots of each kind and submits a real engine-legal cash bid', async () => {
        const { render, state, player } = fixture();
        const wrapper = render();
        expect(wrapper.findAll('.offshore-lot').length).to.equal(6);
        await wrapper.findAll('.offshore-lot').at(3).find('button').trigger('click');
        await wrapper.find('input').setValue('2');
        const before = JSON.stringify(state);
        await wrapper.find('form').trigger('submit');
        const action = wrapper.emitted('move')![0][0];
        expect(action).to.deep.equal({
            name: MoveName.CallBank,
            data: { type: 'containers', lot: 0 },
            extraData: { cash: 2 },
        });
        expect(legalBankAction(state, player, action)).to.equal(true);
        expect(JSON.stringify(state)).to.equal(before);
        wrapper.destroy();
    });

    it('selects specific factory and warehouse pieces for a cargo bid and rejects empty bids', async () => {
        const { render, factory, warehouse } = fixture();
        const wrapper = render();
        await wrapper.find('.offshore-lot button').trigger('click');
        expect(wrapper.find('button[type="submit"]').attributes('disabled')).to.equal('disabled');
        await wrapper.find(`form [data-piece-id="${factory.id}"]`).trigger('click');
        await wrapper.find(`form [data-piece-id="${warehouse.id}"]`).trigger('click');
        await wrapper.find('form').trigger('submit');
        expect(wrapper.emitted('move')![0][0].extraData.containers).to.deep.equal([factory.id, warehouse.id]);
        wrapper.destroy();
    });

    it('does not enable invalid cash bids or stale/spectator controls', async () => {
        const { render, own } = fixture();
        const wrapper = render();
        await wrapper.findAll('.offshore-lot').at(3).find('button').trigger('click');
        await wrapper.find('input').setValue(String(own.money + 1));
        await wrapper.find('form').trigger('submit');
        expect(wrapper.emitted('move')).to.equal(undefined);
        await wrapper.setProps({ availableMoves: {}, player: undefined });
        expect(wrapper.findAll('.offshore-lot button').length).to.equal(0);
        expect(wrapper.find('form').exists()).to.equal(false);
        wrapper.destroy();
    });

    it('offers only engine-valid return prices, preserving escrow and holding cargo', () => {
        const { state, player, own, factory, warehouse, refresh, render } = fixture();
        own.bankHolding!.push(state.containersLeft.pop()!);
        state.phase = Phase.BankDecision;
        state.offshoreBank!.decision = {
            kind: 'return',
            player,
            resumePlayer: player,
            containers: [
                { container: own.containersOnFactoryStore.pop()!, district: 'factory' },
                { container: own.containersOnWarehouseStore.pop()!, district: 'warehouse' },
            ],
            payment: [],
            cursor: 0,
        };
        refresh();
        const wrapper = render();
        const vm = wrapper.vm as any;
        expect(vm.returnPrices({ name: MoveName.ReturnBankContainer, data: factory })).to.deep.equal([1, 2, 3, 4]);
        expect(vm.returnPrices({ name: MoveName.ReturnBankContainer, data: warehouse })).to.deep.equal([2, 3, 4, 5, 6]);
        expect(wrapper.findAll('.bank-choice').length).to.equal(2);
        expect(wrapper.find('.offshore-holding.own .offshore-cargo-piece').exists()).to.equal(true);
        wrapper.destroy();
    });

    it('shows default selection and distribution only when requested by the engine', async () => {
        const { state, player, refresh, render } = fixture();
        state.phase = Phase.BankDecision;
        state.offshoreBank!.decision = {
            kind: 'seize',
            player,
            resumePlayer: player,
            debtor: player,
            remaining: 1,
            containers: [],
            payment: [],
            cursor: 0,
        };
        refresh();
        let wrapper = render();
        expect(wrapper.text()).to.contain('Loan default');
        await wrapper.find('.bank-choice button').trigger('click');
        expect(wrapper.emitted('move')![0][0].name).to.equal(MoveName.SeizeBankContainer);
        wrapper.destroy();
        state.offshoreBank!.decision = {
            kind: 'distribute',
            player,
            resumePlayer: player,
            containers: [],
            payment: [state.containersLeft.pop()!],
            cursor: 0,
        };
        refresh();
        wrapper = render();
        expect(wrapper.text()).to.contain('Next container goes to lot');
        await wrapper.find('.bank-choice button').trigger('click');
        expect(wrapper.emitted('move')![0][0].name).to.equal(MoveName.DistributeBankContainer);
        wrapper.destroy();
    });

    it('renders bank ships at finite coordinates and permits arrival loading only', async () => {
        const { state, player, own, refresh, render } = fixture();
        own.ship.shipPosition = ShipPosition.OffshoreBank;
        own.lastMove = { name: MoveName.Sail, data: ShipPosition.OffshoreBank };
        own.bankHolding!.push(state.containersLeft.pop()!);
        refresh();
        const wrapper = render();
        expect(wrapper.find('.offshore-holding.own button').text()).to.contain('Load onto ship');
        await wrapper.find('.offshore-holding.own button').trigger('click');
        expect(wrapper.emitted('move')![0][0].name).to.equal(MoveName.LoadBankContainer);
        own.lastMove = null;
        refresh();
        await wrapper.setProps({ availableMoves: own.availableMoves });
        expect(wrapper.find('.offshore-holding.own button').exists()).to.equal(false);
        wrapper.destroy();
        const game = shallowMount(Game, {
            propsData: { state, player, emitter: new EventEmitter(), preferences: { sound: false } },
        });
        const ship = (game.vm as any).ships.find((s) => s.owner === player);
        expect(Number.isFinite(ship.x) && Number.isFinite(ship.y)).to.equal(true);
        game.destroy();
    });
});
