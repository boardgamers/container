import Game from '@/components/Game.vue';
import { shallowMount } from '@vue/test-utils';
import { expect } from 'chai';
import { setup } from 'container-engine';
import { EventEmitter } from 'events';

describe('Game chat mount point', () => {
    it('preserves externally mounted chat through initial state and mobile controls', async () => {
        const wrapper = shallowMount(Game, {
            propsData: { state: null, emitter: new EventEmitter(), preferences: { sound: false } },
        });
        const slot = wrapper.element.querySelector('.chat-host')!;
        const messages = document.createElement('div');
        messages.textContent = 'A message from another player';
        slot.appendChild(messages);
        await wrapper.setProps({ state: setup(5, {}, 'chat-slot') });
        await wrapper.vm.$nextTick();
        expect(wrapper.element.contains(messages), 'first state must not replace the chat DOM').to.equal(true);
        await wrapper.setData({ mobilePlayer: 2, mobileOverview: true });
        expect(wrapper.element.querySelector('.chat-host')).to.equal(slot);
        expect(wrapper.element.contains(messages)).to.equal(true);
        wrapper.destroy();
    });
});
