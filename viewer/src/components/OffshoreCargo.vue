<template>
    <div class="offshore-cargo">
        <template v-for="piece in pieces">
            <button
                v-if="selectable.includes(piece.id)"
                :key="piece.id"
                type="button"
                class="offshore-cargo-piece"
                :class="{ selected: selected.includes(piece.id) }"
                :aria-pressed="selected.includes(piece.id) ? 'true' : 'false'"
                :data-piece-id="piece.id"
                :title="colourName(piece.color)"
                @click="$emit('select', piece.id)"
            >
                <span v-html="badge(piece.color)"></span>
                <span>{{ colourName(piece.color) }}</span>
                <small v-if="piece.price != null">${{ piece.price }}</small>
            </button>
            <span v-else :key="piece.id" class="offshore-cargo-piece" :title="colourName(piece.color)">
                <span v-html="badge(piece.color)"></span>
                <span>{{ colourName(piece.color) }}</span>
                <small v-if="piece.price != null">${{ piece.price }}</small>
            </span>
        </template>
    </div>
</template>
<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { ContainerPiece } from 'container-engine/src/gamestate';
import { colorBadgeHtml } from '../color-blind';

/** Cargo outside the classic board: real piece IDs are preserved for escrow and loading choices. */
@Component
export default class OffshoreCargo extends Vue {
    @Prop({ default: () => [] }) pieces!: Array<ContainerPiece & { price?: number }>;
    @Prop({ default: () => [] }) selectable!: string[];
    @Prop({ default: () => [] }) selected!: string[];
    @Prop({ default: false }) colorBlind!: boolean;

    badge(color: string) {
        return colorBadgeHtml(color, this.colorBlind);
    }

    colourName(color: string) {
        return color === 'darkslategray' ? 'dark green' : color;
    }
}
</script>
<style scoped>
.offshore-cargo {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    min-width: 0;
}
.offshore-cargo-piece {
    display: inline-flex;
    gap: 5px;
    align-items: center;
    padding: 5px 7px;
    border: 1px solid #b7c9ca;
    border-radius: 5px;
    background: #fffdf5;
    color: #203a45;
    font: inherit;
    font-size: 12px;
}
button.offshore-cargo-piece {
    cursor: pointer;
    min-height: 36px;
}
button.offshore-cargo-piece:hover,
button.offshore-cargo-piece.selected {
    background: #dfeddf;
    border-color: #37655a;
}
button.offshore-cargo-piece:focus-visible {
    outline: 3px solid #af742c;
    outline-offset: 2px;
}
</style>
