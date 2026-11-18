<template>
    <g class="player-token" role="img" :aria-label="name" translate="no" tabindex="0">
        <title>{{ name }}</title>
        <circle r="9" :fill="color" stroke="#203a45" stroke-width="1.2" />
        <circle r="6.5" fill="none" stroke="white" stroke-opacity=".35" stroke-width=".8" />
        <g v-if="preferences.colorBlind" pointer-events="none">
            <circle r="6.5" fill="white" />
            <text y="0" text-anchor="middle" fill="#172d34" font-size="10" font-weight="bold">{{ symbol }}</text>
        </g>
    </g>
</template>
<script lang="ts">
import { Component, InjectReactive, Prop, Vue } from 'vue-property-decorator';
import { playerSymbol } from '../player-colors';
import type { Preferences } from '../types/ui-data';

@Component
export default class PlayerToken extends Vue {
    @InjectReactive() readonly preferences!: Preferences;
    @Prop({ required: true }) owner!: number;
    @Prop({ required: true }) name!: string;
    @Prop({ required: true }) color!: string;

    get symbol() {
        return playerSymbol(this.owner, this.preferences);
    }
}
</script>
<style scoped>
.player-token:focus-visible {
    outline: none;
}
.player-token:focus-visible > circle:first-of-type {
    stroke-width: 2.5;
}
</style>
