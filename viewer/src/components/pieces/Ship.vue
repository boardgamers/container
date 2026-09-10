<template>
    <g
        :id="elId"
        :class="['piece', { dragging, canDrag }]"
        :transform="`translate(${currentX}, ${currentY}) rotate(${rotate}, 15, 40)`"
    >
        <path
            d="M15 0 Q29 7 30 17 L30 72 Q30 80 23 80 H7 Q0 80 0 72 V17 Q1 7 15 0Z"
            :fill="color"
            stroke="#203a45"
            stroke-width="1.5"
        />
        <path d="M15 6 L25 16 V71 H5 V16Z" fill="#eef1e6" fill-opacity=".8" />
        <path d="M5 68 H25 V76 H5Z" fill="#344954" />
        <path d="M8 70 H12 M17 70 H21" stroke="#c4e4e8" stroke-width="2" />
        <Container
            v-for="(container, i) in containers"
            :key="container.id"
            :pieceId="container.id"
            :targetState="{ x: 5, y: 15 + 12 * i, rotate: 0 }"
            :canDrag="false"
            :color="container.color"
        />
        <DropZone :width="30" :height="80" :enabled="player == owner" :accepts="'container'" :data="{ type: 'ship' }" />
        <title>{{ ownerName }}'s Ship</title>
    </g>
</template>
<script lang="ts">
import { PieceType } from '@/types/ui-data';
import { ContainerPiece, ShipPosition } from 'container-engine/src/gamestate';
import { Component, InjectReactive, Mixins, Prop } from 'vue-property-decorator';
import Piece from './Piece.vue';
import Container from './Container.vue';
import DropZone from '../DropZone.vue';

@Component({
    created(this: Ship) {
        this.pieceType = PieceType.Ship;
    },
    components: {
        Container,
        DropZone,
    },
})
export default class Ship extends Mixins(Piece) {
    @InjectReactive()
    readonly player!: number;

    @Prop()
    color?: string;

    @Prop()
    containers?: ContainerPiece[];

    @Prop()
    owner?: number;

    @Prop()
    ownerName?: string;

    @Prop()
    position!: ShipPosition;
}
</script>
