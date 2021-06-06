<template>
    <g :class="['factory', {dragging}, {canDrag}]" :id="elId" :transform="`translate(${currentX}, ${currentY})`">
        <circle r="10" :fill="color" stroke="black"></circle>
    </g>
</template>
<script lang="ts">
import { PieceType } from "@/types/ui-data";
import { Component, Mixins, Prop } from "vue-property-decorator";
import Piece from "./Piece.vue";

@Component({
    created(this: Factory) {
        this.pieceType = PieceType.Factory;
    }
})
export default class Factory extends Mixins(Piece) {
    @Prop()
    color?: string;
}

</script>
<style lang="scss">
.factory {
    &:not(.dragging) {
        transition-property: transform;
        transition-duration: 0.8s;
        transition-timing-function: ease-in-out;
    }

    &.canDrag {
        cursor: pointer;

        circle {
            &:hover {
                stroke: white;
            }
        }
    }
}

</style>
