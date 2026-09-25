<template>
    <g
        class="button enabled color-blind-toggle"
        role="button"
        tabindex="0"
        aria-label="Color-blind mode"
        :aria-pressed="isOn ? 'true' : 'false'"
        @click="$emit('click')"
        @keydown.enter.prevent="$emit('click')"
        @keydown.space.prevent="$emit('click')"
    >
        <circle cx="15" cy="15" r="15" :fill="isOn ? '#eaf4cf' : 'gainsboro'" stroke="#203a45" stroke-width="2" />
        <path d="M4 15Q15 2 26 15Q15 28 4 15Z" fill="none" stroke="#203a45" stroke-width="1.7" />
        <circle cx="15" cy="15" r="4.5" fill="none" stroke="#203a45" stroke-width="1.7" />
        <path d="M15 10.5V19.5A4.5 4.5 0 0 1 15 10.5" fill="#203a45" />
        <title>Color-blind mode</title>
    </g>
</template>
<script lang="ts">
import { Vue, Component, Prop } from 'vue-property-decorator';
@Component
export default class ColorBlindButton extends Vue {
    @Prop() isOn?: boolean;
}
</script>
