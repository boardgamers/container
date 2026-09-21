import Draggable from '@/components/pieces/Draggable.vue';
import { expect } from 'chai';

function gesture(scale = 1) {
    const events: any[] = [];
    let captured: number | undefined;
    const transform = {
        type: 2,
        matrix: { e: 0, f: 0 },
        setTranslate(x: number, y: number) {
            this.matrix = { e: x, f: y };
        },
    };
    const vm: any = {
        ...(Draggable as any).options.methods,
        canDrag: true,
        dragging: false,
        dragCancelled: false,
        $emit: (...args: any[]) => events.push(args),
        htmlElement: {
            transform: { baseVal: { numberOfItems: 1, getItem: () => transform } },
            setPointerCapture: (id: number) => (captured = id),
            hasPointerCapture: (id: number) => captured === id,
            releasePointerCapture: () => (captured = undefined),
        },
        svgElement: {
            createSVGPoint: () => ({
                x: 0,
                y: 0,
                matrixTransform() {
                    return { x: this.x / scale, y: this.y / scale };
                },
            }),
            getScreenCTM: () => ({ inverse: () => ({}) }),
        },
    };
    const pointer = (x: number, y = 0, id = 1, type = 'touch') => ({
        pointerId: id,
        pointerType: type,
        clientX: x,
        clientY: y,
        isPrimary: true,
        button: 0,
        preventDefault() {},
    });
    return { vm, events, pointer, transform };
}

describe('Board pointer gestures', () => {
    it('keeps small finger movements as a tap on a scaled-down board', () => {
        const { vm, events, pointer } = gesture(0.3);
        vm.startDrag(pointer(100));
        vm.drag(pointer(104, 3));
        vm.endDrag(pointer(104, 3));
        expect(events.map((e) => e[0])).to.deep.equal(['fastClick']);
        expect(vm.dragging).to.equal(false);
    });
    it('captures a drag and translates screen movement into board coordinates', () => {
        const { vm, events, pointer, transform } = gesture(0.5);
        vm.startDrag(pointer(200));
        vm.drag(pointer(100));
        expect(vm.dragging).to.equal(true);
        expect(transform.matrix.e).to.equal(-200);
        vm.endDrag(pointer(100));
        expect(vm.dragCancelled).to.equal(false);
        expect(events.some((e) => e[0] === 'fastClick')).to.equal(false);
    });
    it('cancels a pinch or interrupted drag without turning it into a tap/drop', () => {
        const { vm, events, pointer } = gesture();
        vm.startDrag(pointer(100));
        vm.drag(pointer(50));
        vm.cancelDrag();
        vm.endDrag(pointer(50));
        expect(vm.dragCancelled).to.equal(true);
        expect(vm.dragging).to.equal(false);
        expect(events.some((e) => e[0] === 'fastClick')).to.equal(false);
    });
    it('ignores unrelated pointers and capture loss after a completed tap', () => {
        const { vm, events, pointer } = gesture();
        vm.startDrag(pointer(100));
        vm.endDrag(pointer(100, 0, 2));
        expect(events).to.have.length(0);
        vm.endDrag(pointer(100));
        vm.endDrag(pointer(100), true);
        expect(events.map((e) => e[0])).to.deep.equal(['fastClick']);
        expect(vm.dragCancelled).to.equal(false);
    });
});
