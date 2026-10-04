import Game from '@/components/Game.vue';
import { islandValue } from '@/island-value';
import { shallowMount } from '@vue/test-utils';
import { expect } from 'chai';
import { setup } from 'container-engine';
import { EventEmitter } from 'events';

function playerWithCounts(counts: number[], offset = 1000) {
    const player = setup(3, { beginner: true }, 'island-value').players[0];
    player.containersOnIsland = player.pointCard!.containerValues.flatMap((value, index) =>
        Array.from({ length: counts[index] }, (_, i) => ({
            id: `C${offset + index * 10 + i}` as const,
            color: value.containerColor,
        }))
    );
    return player;
}

describe('Private island value', () => {
    for (const [counts, expected] of [
        [[0, 0, 0, 0, 0], 0],
        [[3, 0, 0, 0, 0], 0],
        [[2, 1, 1, 1, 3], 40], // all five colours: the $5/10 colour scores $10
        [[2, 1, 1, 0, 3], 31], // no full-set bonus
        [[1, 1, 1, 1, 1], 22], // tied $5/10 colour is discarded
        [[2, 0, 2, 1, 0], 24], // other ties discard the lower value
    ] as [number[], number][]) {
        it(`scores ${counts.join('/')} as $${expected}`, () => {
            const player = playerWithCounts(counts);
            const before = JSON.stringify(player);
            expect(islandValue(player)).to.equal(expected);
            expect(JSON.stringify(player)).to.equal(before);
        });
    }

    it('shows only the viewing player’s island, updates with state, and hides for spectators or hidden cards', async () => {
        const state = setup(3, { beginner: true }, 'island-value');
        const first = playerWithCounts([2, 1, 1, 1, 3]);
        const second = playerWithCounts([2, 0, 2, 1, 0], 2000);
        state.players[0].containersOnIsland = first.containersOnIsland;
        state.players[1].containersOnIsland = second.containersOnIsland;
        state.players[1].pointCard = second.pointCard;
        const wrapper = shallowMount(Game, {
            propsData: { state, player: 0, emitter: new EventEmitter(), preferences: { sound: false } },
        });
        expect(wrapper.findAll('.island-value')).to.have.length(1);
        expect(wrapper.find('.island-value').text()).to.contain('Your island: $40');
        await wrapper.setProps({ player: 1 });
        expect(wrapper.find('.island-value').text()).to.contain('Your island: $24');
        const updated = JSON.parse(JSON.stringify(state));
        updated.players[1].containersOnIsland = [];
        await wrapper.setProps({ state: updated });
        expect(wrapper.find('.island-value').text()).to.contain('Your island: $0');
        await wrapper.setProps({ player: undefined });
        expect(wrapper.find('.island-value').exists()).to.equal(false);
        delete updated.players[0].pointCard;
        await wrapper.setProps({ state: JSON.parse(JSON.stringify(updated)), player: 0 });
        expect(wrapper.find('.island-value').exists()).to.equal(false);
        wrapper.destroy();
    });
});
