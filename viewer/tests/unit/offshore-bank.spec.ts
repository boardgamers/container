import Calculator from '@/components/Calculator.vue';
import Game from '@/components/Game.vue';
import OffshoreBank from '@/components/OffshoreBank.vue';
import OffshoreCargo from '@/components/OffshoreCargo.vue';
import PlayerToken from '@/components/PlayerToken.vue';
import { legalBankAction } from '@/offshore-actions';
import { escapeJournal, offshoreJournal } from '@/offshore-journal';
import { mount, shallowMount } from '@vue/test-utils';
import { availableMoves, MoveName, setup } from 'container-engine';
import { Phase, ShipPosition } from 'container-engine/src/gamestate';
import { EventEmitter } from 'events';
import { describe, expect, it } from 'vitest';

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
        mount(OffshoreBank, {
            provide: { __reactiveInject__: { preferences: { colorBlind: true } } },
            propsData: { state, player, availableMoves: own.availableMoves, colorBlind: true },
        });
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
        expect(text).toBe('<Ada> calls bank for container lot 3: $4 in escrow.');
        expect(escapeJournal(text)).toContain('&lt;Ada&gt;');
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
        expect(wrapper.findComponent(OffshoreBank).exists()).toBe(false);
        wrapper.destroy();
    });

    it('distinguishes lot order from cash using a single guide and sale-price typography', () => {
        const { render } = fixture();
        const wrapper = render();
        expect(wrapper.findAll('.bank-lot-guide text').wrappers.map((node) => node.text())).toEqual(['I', 'II', 'III']);
        const money = wrapper.findAll('.bank-money');
        expect(money.wrappers.map((node) => node.text())).toEqual(['$1', '$2', '$3']);
        expect(money.wrappers.every((node) => node.attributes('font-size') === '16')).toBe(true);
        expect(wrapper.find('.bank-piers > rect').attributes('height')).toBe('214');
        expect(wrapper.find('.bank-piers > rect').attributes('width')).toBe('4');
        expect(wrapper.find('[aria-label="Sail to bank"]').exists()).toBe(false);
        expect(wrapper.text()).not.toContain('BANK HARBOR');
        expect(wrapper.findAll('.offshore-lot title').at(0).text()).toBe('Bid containers to win this cash.');
        expect(wrapper.findAll('.offshore-lot title').at(3).text()).toBe('Bid cash to win these containers.');
        wrapper.destroy();
    });

    it('uses player tokens instead of visible bidder names for both auction types', () => {
        const { state, player, own } = fixture();
        const name = '<Trader with a long name>';
        own.name = name;
        state.offshoreBank!.auctions = [
            { type: 'containers', lot: 0, bidder: player, cash: 3, containers: [] },
            {
                type: 'cash',
                lot: 1,
                bidder: player,
                cash: 0,
                containers: [{ container: own.containersOnFactoryStore[0], district: 'factory' }],
            },
        ];
        for (const colorBlind of [false, true]) {
            const wrapper = mount(OffshoreBank, {
                provide: { __reactiveInject__: { preferences: { colorBlind } } },
                propsData: {
                    state,
                    player,
                    availableMoves: own.availableMoves,
                    playerColors: ['#123456', '#234567', '#345678'],
                },
            });
            const tokens = wrapper.findAll('.bank-bidder');
            expect(tokens.length).toBe(2);
            expect(tokens.wrappers.map((t) => t.attributes('transform'))).toEqual([
                'translate(16 86)',
                'translate(16 86)',
            ]);
            tokens.wrappers.forEach((t) => expect(t.find('circle').attributes('r')).toBe('9'));
            const amount = wrapper.find('.bank-bid-amount');
            expect(amount.attributes('x')).toBe('32');
            expect(amount.attributes('y')).toBe('86');
            expect(amount.attributes('text-anchor')).toBe('start');
            const escrow = wrapper
                .findAllComponents(OffshoreCargo)
                .wrappers.find((c) => c.attributes('transform') === 'translate(32 69)')!;
            expect(escrow.props('columns')).toBe(2);
            expect(escrow.props('rows')).toBe(1);
            tokens.wrappers.forEach((token) => {
                expect(token.attributes('aria-label')).toBe(name);
                expect(token.attributes('translate')).toBe('no');
                expect(token.find('title').text()).toBe(name);
                expect(token.find('circle').attributes('fill')).toBe(['#123456', '#234567', '#345678'][player]);
                expect(token.findAll('text').wrappers.map((text) => text.text())).toEqual(
                    colorBlind ? [String(player + 1)] : []
                );
            });
            expect(wrapper.findAll('.bank-board text').wrappers.some((text) => text.text().includes(name))).toBe(false);
            expect(wrapper.findAllComponents(PlayerToken).length).toBe(2);
            wrapper.destroy();
        }
    });

    it('selects the exact type and lot through all six SVG lots', async () => {
        const { render } = fixture();
        const wrapper = render();
        expect(wrapper.findAll('.offshore-lot').length).toBe(6);
        await wrapper.setProps({ selectedOffer: { type: 'cash', lot: 1 } });
        expect(wrapper.findAll('.offshore-lot.selected').length).toBe(1);
        expect(wrapper.find('.offshore-lot.selected').attributes('data-lot')).toBe('1');
        expect(wrapper.find('.offshore-lot.selected').attributes('aria-pressed')).toBe('true');
        for (const type of ['cash', 'containers'])
            for (let lot = 0; lot < 3; lot++) {
                await wrapper.find(`[data-type="${type}"][data-lot="${lot}"]`).trigger('click');
                expect(wrapper.emitted('choose-offer')!.slice(-1)[0][0]).toEqual({ type, lot });
            }
        wrapper.destroy();
    });

    function gameFixture() {
        const f = fixture();
        const emitter = new EventEmitter();
        const submitted: any[] = [];
        emitter.on('move', (moves) => submitted.push(moves));
        const wrapper = shallowMount(Game, {
            propsData: { state: f.state, player: f.player, emitter, preferences: { sound: false } },
        });
        return { ...f, wrapper, submitted };
    }

    it('uses the selected cash-price lot, rejects invalid bids and clears stale drafts', async () => {
        const { wrapper, own, submitted, state } = gameFixture();
        wrapper.findComponent(OffshoreBank).vm.$emit('choose-offer', { type: 'containers', lot: 2 });
        await wrapper.vm.$nextTick();
        wrapper.findComponent(Calculator).vm.$emit('bid', own.money + 1);
        await wrapper.vm.$nextTick();
        expect(submitted.length).toBe(0);
        expect(wrapper.find('.bank-draft').text()).toContain('Invalid offer');
        wrapper.findComponent(Calculator).vm.$emit('bid', 2);
        await wrapper.vm.$nextTick();
        expect(submitted[0].slice(-1)[0]).toEqual({
            name: MoveName.CallBank,
            data: { type: 'containers', lot: 2 },
            extraData: { cash: 2 },
        });
        expect(wrapper.find('.bank-draft').exists()).toBe(false);
        await wrapper.setProps({ state: JSON.parse(JSON.stringify(state)) });
        wrapper.findComponent(OffshoreBank).vm.$emit('choose-offer', { type: 'cash', lot: 1 });
        await wrapper.vm.$nextTick();
        await wrapper.setProps({ player: undefined });
        expect(wrapper.find('.bank-draft').exists()).toBe(false);
        wrapper.destroy();
    });

    it('requires explicit confirmation for multiple cargo pieces and supports cancel', async () => {
        const { wrapper, submitted, factory, warehouse } = gameFixture();
        wrapper.findComponent(OffshoreBank).vm.$emit('choose-offer', { type: 'cash', lot: 1 });
        await wrapper.vm.$nextTick();
        const cargo = wrapper.find('.bank-draft').findComponent(OffshoreCargo);
        cargo.vm.$emit('select', factory.id);
        cargo.vm.$emit('select', warehouse.id);
        await wrapper.vm.$nextTick();
        expect(submitted.length).toBe(0);
        const buttons = wrapper.find('.bank-draft').findAllComponents({ name: 'Button' });
        buttons.at(0).vm.$emit('click');
        await wrapper.vm.$nextTick();
        expect(submitted[0].slice(-1)[0]).toEqual({
            name: MoveName.CallBank,
            data: { type: 'cash', lot: 1 },
            extraData: { containers: [factory.id, warehouse.id] },
        });
        wrapper.destroy();
    });

    it('cancels a draft without submitting and paginates large cargo without losing access', async () => {
        const { wrapper, submitted } = gameFixture();
        wrapper.findComponent(OffshoreBank).vm.$emit('choose-offer', { type: 'cash', lot: 0 });
        await wrapper.vm.$nextTick();
        wrapper.find('.bank-draft').findAllComponents({ name: 'Button' }).at(1).vm.$emit('click');
        await wrapper.vm.$nextTick();
        expect(wrapper.find('.bank-draft').exists()).toBe(false);
        expect(submitted.length).toBe(0);
        wrapper.destroy();
        const pieces = Array.from({ length: 103 }, (_, i) => ({ id: `large-${i}`, color: 'orange' }));
        const cargo = mount(OffshoreCargo, {
            provide: { __reactiveInject__: { preferences: { colorBlind: true } } },
            propsData: { pieces, columns: 3, rows: 2 },
        });
        const seen = new Set<string>();
        for (let page = 0; page < 18; page++) {
            const visible = cargo.findAll('[data-piece-id]');
            expect(visible.length).toBeLessThanOrEqual(6);
            visible.wrappers.forEach((piece) => seen.add(String(piece.attributes('data-piece-id'))));
            await cargo.find('[aria-label="Next cargo page"]').trigger('keydown.enter');
        }
        expect(seen.size).toBe(103);
        cargo.destroy();
    });

    it('spectators can inspect lots without mutation controls', async () => {
        const { render } = fixture();
        const wrapper = render();
        await wrapper.setProps({ player: undefined });
        expect(wrapper.findAll('.offshore-lot[role="button"]').length).toBe(0);
        await wrapper.find('.offshore-lot').trigger('click');
        expect(wrapper.emitted('choose-offer')).toBe(undefined);
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
        expect(vm.returnPrices({ name: MoveName.ReturnBankContainer, data: factory })).toEqual([1, 2, 3, 4]);
        expect(vm.returnPrices({ name: MoveName.ReturnBankContainer, data: warehouse })).toEqual([2, 3, 4, 5, 6]);
        expect(wrapper.findAll('.bank-choice').length).toBe(2);
        expect(wrapper.find('.bank-holding [data-piece-id]').exists()).toBe(true);
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
        expect(wrapper.text()).toContain('Loan default');
        await wrapper.find('.bank-choice [data-piece-id][role="button"]').trigger('keydown.enter');
        expect(wrapper.emitted('move')![0][0].name).toBe(MoveName.SeizeBankContainer);
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
        expect(wrapper.find('.offshore-lot.destination').attributes('data-lot')).toBe('0');
        expect(wrapper.find('.offshore-lot.destination').attributes('role')).toBeUndefined();
        expect(wrapper.find('.bank-decision > text').exists()).toBe(false);
        expect(wrapper.emitted('move')).toBeUndefined();
        expect(wrapper.find('.bank-choice [data-piece-id][role="button"]').attributes('aria-label')).toContain(
            'Pay into container lot 1'
        );
        await wrapper.find('.bank-choice [data-piece-id][role="button"]').trigger('keydown.enter');
        expect(wrapper.emitted('move')![0][0].name).toBe(MoveName.DistributeBankContainer);
        wrapper.destroy();
    });

    it('paginates many bank decisions and retains legal choices on later pages', async () => {
        const { state, player, refresh, render } = fixture();
        state.phase = Phase.BankDecision;
        const containers = Array.from({ length: 11 }, () => ({
            container: { piece: state.containersLeft.pop()!, price: 2, moved: false },
            district: 'factory' as const,
        }));
        state.offshoreBank!.decision = {
            kind: 'return',
            player,
            resumePlayer: player,
            containers,
            payment: [],
            cursor: 0,
        };
        refresh();
        const wrapper = render();
        expect(wrapper.findAll('.bank-choice').length).toBe(4);
        await wrapper.find('[aria-label="More 1/3"]').trigger('click');
        expect(wrapper.findAll('.bank-choice').length).toBe(4);
        await wrapper.find('[aria-label="More 2/3"]').trigger('click');
        expect(wrapper.findAll('.bank-choice').length).toBe(3);
        await wrapper.find('.bank-choice [role="button"]').trigger('click');
        const action = wrapper.emitted('move')![0][0];
        expect(legalBankAction(state, player, action)).toBe(true);
        wrapper.destroy();
    });

    it('places five bank ships in separate berths beside the lots', () => {
        const state = setup(5, { offshoreIsland: true }, 'bank-berths');
        state.players.forEach((p) => {
            p.ship.shipPosition = ShipPosition.OffshoreBank;
        });
        const game = shallowMount(Game, {
            propsData: {
                state,
                player: state.currentPlayers[0],
                emitter: new EventEmitter(),
                preferences: { sound: false },
            },
        });
        const berths = game.findAll('.bank-harbor');
        expect(berths.length).toBe(5);
        berths.wrappers.forEach((berth, i) => {
            expect(berth.attributes('transform')).toBe(`translate(336 ${684 + i * 42})`);
            expect(berth.props('width')).toBe(156);
            expect(berth.props('height')).toBe(38);
            expect(berth.props('enabled')).toBe(i === state.currentPlayers[0]);
        });
        const ships = (game.vm as any).ships;
        expect(ships).toHaveLength(5);
        ships.forEach((ship, i) => {
            expect(ship.rotate).toBe(90);
            // A 30×80 ship rotated around (15,40) spans x-25..x+55 and y+25..y+55.
            expect(ship.x - 25).toBeGreaterThanOrEqual(342);
            expect(ship.x + 55).toBeLessThanOrEqual(444);
            const berthTop = 684 + i * 42;
            const berthBottom = berthTop + 38;
            expect(ship.y + 25 - berthTop).toBe(4);
            expect(berthBottom - (ship.y + 55)).toBe(4);
        });
        game.destroy();
    });

    it('outlines open berths with solid split piers and places cargo directly in the water', async () => {
        const state = setup(5, { offshoreIsland: true }, 'bank-holding-berths');
        const player = state.currentPlayers[0];
        const colors = ['#123456', '#234567', '#345678', '#456789', '#56789a'];
        state.players.forEach((p) => {
            p.ship.shipPosition = ShipPosition.OffshoreBank;
        });
        const other = (player + 1) % 5;
        state.players[other].bankHolding = state.containersLeft.splice(-8);
        const wrapper = mount(OffshoreBank, {
            provide: { __reactiveInject__: { preferences: { colorBlind: true } } },
            propsData: { state, player, playerColors: colors },
        });
        expect(wrapper.findAll('.bank-bid-zone')).toHaveLength(6);
        expect(wrapper.findAll('.bank-berth')).toHaveLength(5);
        wrapper.findAll('.bank-berth').wrappers.forEach((berth, i) => {
            expect(berth.attributes('transform')).toBe(`translate(4 ${i * 42 + 4})`);
            expect(berth.find('.bank-berth-border').attributes('stroke')).toBe(colors[i]);
            expect(berth.find('.bank-berth-border').attributes('fill')).toBe('none');
            expect(berth.find('.bank-berth-border').attributes('stroke-width')).toBe('2');
            expect(berth.find('.bank-berth-border').attributes('d')).toBe('M156 -1 H-2 V39 H156');
            expect(berth.find('.player-token').exists()).toBe(false);
            expect(berth.find('[fill-opacity]').exists()).toBe(false);
            expect(berth.find('.bank-holding').attributes('transform')).toBe('translate(104 3)');
        });
        expect(wrapper.find(`.bank-berth[data-owner="${player}"] [data-piece-id]`).exists()).toBe(false);
        const holding = wrapper.find(`.bank-holding[data-owner="${other}"]`);
        expect(holding.findAll('[data-piece-id]')).toHaveLength(2);
        await holding.find('[aria-label="Next cargo page"]').trigger('click');
        expect(holding.findAll('[data-piece-id]')).toHaveLength(2);
        state.players[other].ship.shipPosition = ShipPosition.OpenSea;
        await wrapper.setProps({ state: { ...state } });
        await holding.find('[aria-label="Previous cargo page"]').trigger('click');
        expect(holding.attributes('transform')).toBe('translate(8 3)');
        expect(holding.findAll('[data-piece-id]')).toHaveLength(6);
        await holding.find('[aria-label="Next cargo page"]').trigger('click');
        expect(holding.findAll('[data-piece-id]')).toHaveLength(2);
        await wrapper.setProps({ player: undefined });
        expect(wrapper.findAll('.bank-berth')).toHaveLength(5);
        expect(wrapper.find('.bank-holding [data-piece-id][role="button"]').exists()).toBe(false);
        expect(wrapper.emitted('move')).toBeUndefined();
        wrapper.destroy();
    });

    it('renders bank ships at finite coordinates and permits arrival loading only', async () => {
        const { state, player, own, refresh, render } = fixture();
        own.ship.shipPosition = ShipPosition.OffshoreBank;
        own.lastMove = { name: MoveName.Sail, data: ShipPosition.OffshoreBank };
        own.bankHolding!.push(state.containersLeft.pop()!);
        refresh();
        const wrapper = render();
        expect(wrapper.find('.bank-holding [role="button"]').exists()).toBe(true);
        await wrapper.find('.bank-holding [role="button"]').trigger('click');
        expect(wrapper.emitted('move')![0][0].name).toBe(MoveName.LoadBankContainer);
        own.lastMove = null;
        refresh();
        await wrapper.setProps({ availableMoves: own.availableMoves });
        expect(wrapper.find('.bank-holding [role="button"]').exists()).toBe(false);
        wrapper.destroy();
        const game = shallowMount(Game, {
            propsData: { state, player, emitter: new EventEmitter(), preferences: { sound: false } },
        });
        const ship = (game.vm as any).ships.find((s) => s.owner === player);
        expect(Number.isFinite(ship.x) && Number.isFinite(ship.y)).toBe(true);
        game.destroy();
    });
});
