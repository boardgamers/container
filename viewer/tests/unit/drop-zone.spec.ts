import DropZone from '@/components/DropZone.vue';
import { shallowMount } from '@vue/test-utils';
import { expect } from 'chai';
import { EventEmitter } from 'events';

describe('Drop zone cancellation', () => {
    it('clears a pending drop without executing it, and removes its listener on teardown', () => {
        const communicator = new EventEmitter();
        let drops = 0;
        communicator.on('pieceDrop', () => drops++);
        const wrapper = shallowMount(DropZone, {
            propsData: { width: 40, height: 40, accepts: 'container' },
            provide: {
                communicator,
                ui: { dragged: null, selected: null },
                __reactiveInject__: { preferences: {}, player: 0 },
            },
        });
        (wrapper.vm as any).overlapping = true;
        communicator.emit('draggedPosChanged', { pieceType: 'container', dragCancelled: true });
        expect(drops).to.equal(0);
        expect((wrapper.vm as any).overlapping).to.equal(false);
        expect(communicator.listenerCount('dragCancelled')).to.equal(0);
        wrapper.destroy();
        expect(communicator.listenerCount('draggedPosChanged')).to.equal(0);
    });
});
