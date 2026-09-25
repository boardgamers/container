<template>
    <g v-if="preferences.colorBlind && path" class="color-mark" pointer-events="none">
        <rect x="-5" y="-5" width="10" height="10" rx="1" fill="white" />
        <path
            :d="path"
            transform="translate(-5 -5)"
            fill="none"
            stroke="#172d34"
            stroke-width="1.5"
            stroke-linejoin="round"
        />
    </g>
</template>
<script lang="ts">
import { Component, InjectReactive, Prop, Vue } from 'vue-property-decorator';
import type { Preferences } from '../types/ui-data';
import { colorMarkPath } from '../color-blind';
@Component
export default class ColorMark extends Vue {
    @InjectReactive() readonly preferences!: Preferences;
    @Prop() color?: string;
    get path() {
        return colorMarkPath(this.color);
    }
}
</script>
