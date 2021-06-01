<template>
    <g :class="['warehouse', {dragging}, {canDrag}]" :id="elId" :transform="`translate(${currentX}, ${currentY})`">
        <path d="M15 0 L30 10 L30 30 L0 30 L0 10Z" fill="dimgray" stroke="black"></path>
    </g>
</template>
<script lang="ts">
import { PieceType } from "@/types/ui-data";
import { Component, Mixins } from "vue-property-decorator";
import Piece from "./Piece.vue";

@Component({
    created(this: Warehouse) {
        this.pieceType = PieceType.Warehouse;
    }
})
export default class Warehouse extends Mixins(Piece) {
}

</script>
<style lang="scss">
.warehouse {
    &:not(.dragging) {
        transition-property: transform;
        transition-duration: 0.8s;
        transition-timing-function: ease-in-out;
    }

    &.canDrag {
        cursor: pointer;

        path {
            &:hover {
                stroke: white;
            }
        }
    }
}

</style>
