<template>
    <g class="offshore-cargo">
        <g
            v-for="(piece, i) in visiblePieces"
            :key="piece.id"
            :transform="`translate(${(i % columns) * 23},${Math.floor(i / columns) * 13})`"
            :class="{ selectable: selectable.includes(piece.id), selected: selected.includes(piece.id) }"
            :role="selectable.includes(piece.id) ? 'button' : undefined"
            :tabindex="selectable.includes(piece.id) ? 0 : undefined"
            :aria-pressed="selectable.includes(piece.id) ? (selected.includes(piece.id) ? 'true' : 'false') : undefined"
            :aria-label="cargoLabel(piece)"
            :data-piece-id="piece.id"
            @click="selectPiece($event, piece.id)"
            @keydown.enter.prevent.stop="selectable.includes(piece.id) && $emit('select', piece.id)"
            @keydown.space.prevent.stop="selectable.includes(piece.id) && $emit('select', piece.id)"
        >
            <rect
                x="-1"
                y="-1"
                width="22"
                height="12"
                rx="1"
                fill="none"
                :stroke="selected.includes(piece.id) ? 'blue' : 'transparent'"
                stroke-width="2"
            />
            <rect width="20" height="10" rx=".8" :fill="piece.color" stroke="#21343b" />
            <path d="M4 2V8 M8 2V8 M12 2V8 M16 2V8" stroke="#10252b" stroke-opacity=".3" stroke-width=".7" />
            <path d="M1 1H19" stroke="white" stroke-opacity=".5" />
            <ColorMark :color="piece.color" transform="translate(10 5) scale(.8)" />
            <title>{{ cargoLabel(piece) }}</title>
        </g>
        <g v-if="pages > 1" :transform="`translate(0 ${rows * 13 + 3})`">
            <g
                role="button"
                tabindex="0"
                aria-label="Previous cargo page"
                @click.stop="page = (currentPage + pages - 1) % pages"
                @keydown.enter.prevent.stop="page = (currentPage + pages - 1) % pages"
                @keydown.space.prevent.stop="page = (currentPage + pages - 1) % pages"
            >
                <rect width="20" height="16" fill="#c6c6b8" /><text x="10" y="12" text-anchor="middle" font-size="12"
                    >‹</text
                >
            </g>
            <text x="23" y="12" font-size="8">{{ currentPage + 1 }}/{{ pages }}</text>
            <g
                role="button"
                tabindex="0"
                aria-label="Next cargo page"
                :transform="`translate(${columns * 23 - 22} 0)`"
                @click.stop="page = (currentPage + 1) % pages"
                @keydown.enter.prevent.stop="page = (currentPage + 1) % pages"
                @keydown.space.prevent.stop="page = (currentPage + 1) % pages"
            >
                <rect width="20" height="16" fill="#c6c6b8" /><text x="10" y="12" text-anchor="middle" font-size="12"
                    >›</text
                >
            </g>
        </g>
    </g>
</template>
<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { ContainerPiece } from 'container-engine/src/gamestate';
import ColorMark from './ColorMark.vue';

@Component({ components: { ColorMark } })
export default class OffshoreCargo extends Vue {
    @Prop({ default: () => [] }) pieces!: Array<ContainerPiece & { price?: number }>;
    @Prop({ default: () => [] }) selectable!: string[];
    @Prop({ default: () => [] }) selected!: string[];
    @Prop({ default: '' }) actionLabel!: string;
    @Prop({ default: 3 }) columns!: number;

    @Prop({ default: 2 }) rows!: number;
    page = 0;
    get pages() {
        return Math.max(1, Math.ceil(this.pieces.length / (this.columns * this.rows)));
    }
    get currentPage() {
        return Math.min(this.page, this.pages - 1);
    }
    get visiblePieces() {
        return this.pieces.slice(
            this.currentPage * this.columns * this.rows,
            (this.currentPage + 1) * this.columns * this.rows
        );
    }

    selectPiece(event: Event, id: string) {
        if (!this.selectable.includes(id)) return;
        event.stopPropagation();
        this.$emit('select', id);
    }
    cargoLabel(piece: ContainerPiece & { price?: number }) {
        return `${this.actionLabel && this.selectable.includes(piece.id) ? this.actionLabel + ': ' : ''}${
            piece.color === 'darkslategray' ? 'dark green' : piece.color
        } container${piece.price == null ? '' : ': $' + piece.price}`;
    }
}
</script>
<style scoped>
.selectable {
    cursor: pointer;
}
.selectable:focus-visible {
    outline: 2px solid blue;
    outline-offset: 2px;
}
.selectable:hover > rect:first-child,
.selected > rect:first-child {
    stroke: blue;
}
</style>
