<template>
    <g :class="['container', {dragging}, {canDrag}]" :id="elId" :transform="`translate(${currentX}, ${currentY}) rotate(${rotate}, 10, 5)`">
        <rect width="20" height="10" :fill="color" stroke="black"></rect>
    </g>
</template>
<script lang="ts">
import { ContainerState, PieceType } from "@/types/ui-data";
import { Component, Mixins, Prop } from "vue-property-decorator";
import Piece from "./Piece.vue";

@Component({
    created(this: Container) {
        this.pieceType = PieceType.Container;
    }
})
export default class Container extends Mixins(Piece) {
    @Prop()
    color?: string;

    @Prop()
    owner?: number;

    @Prop()
    state?: ContainerState;
}

</script>
<style lang="scss">
.container {
    &:not(.dragging) {
        transition-property: transform;
        transition-duration: 0.8s;
        transition-timing-function: ease-in-out;
    }

    &.canDrag {
        cursor: pointer;

        rect {
            &:hover {
                stroke: white;
            }
        }
    }
}

</style>