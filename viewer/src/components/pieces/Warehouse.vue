<template>
    <g :id="elId" :class="['piece', { dragging, canDrag }]" :transform="`translate(${currentX}, ${currentY})`">
        <path d="M15 0 L30 10 L30 30 L0 30 L0 10Z" fill="#789298" stroke="#233b43" />
        <path d="M0 10 L15 0 L30 10" fill="none" stroke="#344a51" stroke-width="2" />
        <path d="M7 30V14 H23V30" fill="#dae2da" stroke="#425c65" />
        <path d="M8 18H22 M8 22H22 M8 26H22" stroke="#6c8285" />
        <title>Warehouse</title>
    </g>
</template>
<script lang="ts">
import { PieceType } from '@/types/ui-data';
import { Component, Mixins } from 'vue-property-decorator';
import Piece from './Piece.vue';

@Component({
    created(this: Warehouse) {
        this.pieceType = PieceType.Warehouse;
    },
})
export default class Warehouse extends Mixins(Piece) {}
</script>
