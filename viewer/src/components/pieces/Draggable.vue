<script lang="ts">
import { Vue, Component, Prop } from 'vue-property-decorator';

@Component({
    mounted(this: Draggable) {
        this.$nextTick(() => {
            const start = (event: PointerEvent) => this.startDrag(event);
            const drag = (event: PointerEvent) => this.drag(event);
            const end = (event: PointerEvent) => this.endDrag(event);
            const cancel = (event: PointerEvent) => this.endDrag(event, true);
            const anotherPointer = (event: PointerEvent) => {
                if (this._pointer !== undefined && event.pointerId !== this._pointer) this.cancelDrag();
            };
            const element = this.htmlElement;
            element.addEventListener('pointerdown', start);
            element.addEventListener('pointermove', drag);
            element.addEventListener('pointerup', end);
            element.addEventListener('pointercancel', cancel);
            element.addEventListener('lostpointercapture', cancel);
            window.addEventListener('pointerdown', anotherPointer, true);
            this.$on('hook:beforeDestroy', () => {
                element.removeEventListener('pointerdown', start);
                element.removeEventListener('pointermove', drag);
                element.removeEventListener('pointerup', end);
                element.removeEventListener('pointercancel', cancel);
                element.removeEventListener('lostpointercapture', cancel);
                window.removeEventListener('pointerdown', anotherPointer, true);
            });
        });
    },
})
export default class Draggable extends Vue {
    @Prop()
    canDrag!: boolean;

    dragging = false;
    dragCancelled = false;
    _pointer?: number;
    _offset = { x: 0, y: 0 };
    _transform?: SVGTransform;
    _press?: { x: number; y: number };

    get svgElement() {
        return this.htmlElement.ownerSVGElement!;
    }

    get htmlElement() {
        return this.$el as SVGGElement;
    }

    startDrag(evt: PointerEvent) {
        if (!this.canDrag || !evt.isPrimary || evt.button !== 0 || this._pointer !== undefined) return;
        this.dragCancelled = false;
        this._pointer = evt.pointerId;
        this._press = { x: evt.clientX, y: evt.clientY };
        this._offset = this.getMousePosition(evt);
        const transforms = this.htmlElement.transform.baseVal;
        if (transforms.numberOfItems === 0 || transforms.getItem(0).type !== 2) {
            const translate = this.svgElement.createSVGTransform();
            translate.setTranslate(0, 0);
            transforms.insertItemBefore(translate, 0);
        }
        this._transform = transforms.getItem(0);
        this._offset.x -= this._transform.matrix.e;
        this._offset.y -= this._transform.matrix.f;
        this.htmlElement.setPointerCapture(evt.pointerId);
    }

    drag(evt: PointerEvent) {
        if (!this._press || evt.pointerId !== this._pointer) return;
        // Measure finger jitter in screen pixels, independent of board/browser zoom.
        const threshold = evt.pointerType === 'mouse' ? 5 : 8;
        if (!this.dragging && Math.hypot(evt.clientX - this._press.x, evt.clientY - this._press.y) < threshold) return;
        this.dragging = true;
        evt.preventDefault();
        const coord = this.getMousePosition(evt);
        this._transform!.setTranslate(coord.x - this._offset.x, coord.y - this._offset.y);
        this.$emit('draggedTo', { x: coord.x - this._offset.x, y: coord.y - this._offset.y });
    }

    endDrag(evt: PointerEvent, cancelled = false) {
        if (evt.pointerId !== this._pointer) return;
        this.finishDrag(cancelled);
    }

    cancelDrag() {
        this.finishDrag(true);
    }

    finishDrag(cancelled: boolean) {
        if (this._pointer === undefined) return;
        const pointer = this._pointer;
        const clicked = !this.dragging && !cancelled;
        this.dragCancelled = cancelled;
        this._pointer = undefined;
        this._press = undefined;
        this.dragging = false;
        if (this.htmlElement.hasPointerCapture(pointer)) this.htmlElement.releasePointerCapture(pointer);
        if (clicked) this.$emit('fastClick', this);
    }

    getMousePosition(evt: PointerEvent) {
        const point = this.svgElement.createSVGPoint();
        point.x = evt.clientX;
        point.y = evt.clientY;
        return point.matrixTransform(this.svgElement.getScreenCTM()!.inverse());
    }
}
</script>
