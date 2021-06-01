<template>
    <g :class="['ship', {dragging}, {canDrag}]" :id="elId" :transform="`translate(${currentX}, ${currentY}) rotate(${rotate}, 15, 40)`">
        <path d="M15 0 L30 10 L30 80 L0 80 L0 10Z" :fill="color" stroke="black"></path>
        <template v-for="(container, i) in containers">
            <Container :key="container.id"
                    :pieceId="container.id"
                    :targetState="{ x: 5, y: 15 + 12 * i, rotate: 0 }"
                    :canDrag="false"
                    :color="container.color" />
        </template>
        <DropZone :width="30" :height="80" :enabled="true" :accepts="'container'" :data="{ type: 'ship' }" />
    </g>
</template>
<script lang="ts">
import { PieceType } from "@/types/ui-data";
import { ContainerPiece } from "container-engine/src/gamestate";
import { Component, Mixins, Prop } from "vue-property-decorator";
import Piece from "./Piece.vue";
import Container from "./Container.vue";
import DropZone from "./DropZone.vue";

@Component({
    created(this: Ship) {
        this.pieceType = PieceType.Ship;
    },
    components: {
        Container,
        DropZone
    }
})
export default class Ship extends Mixins(Piece) {
    @Prop()
    color?: string;

    @Prop()
    containers?: ContainerPiece[];
}

</script>
<style lang="scss">
.ship {
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