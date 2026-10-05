<template>
    <g
        :class="['button', { enabled }]"
        role="button"
        :aria-label="tooltip || text"
        :aria-disabled="!enabled"
        :tabindex="enabled ? 0 : -1"
        @click="enabled && $emit('click')"
        @keydown.enter.prevent="enabled && $emit('click')"
        @keydown.space.prevent="enabled && $emit('click')"
    >
        <rect :width="width" height="30" fill="gainsboro" stroke="black" rx="2" />
        <path
            v-if="icon"
            :d="icon === 'edit' ? 'M2 11L12 1L16 5L6 15L1 16Z M10 3L14 7' : 'M2 2L16 16 M16 2L2 16'"
            :transform="`translate(${width / 2 - 9}, 6)`"
            fill="none"
            stroke="black"
            stroke-width="1.8"
            stroke-linecap="round"
            aria-hidden="true"
        />
        <text v-else text-anchor="middle" fill="black" :x="width / 2" y="16">{{ getText() }}</text>
        <title>{{ tooltip || text }}</title>
    </g>
</template>
<script lang="ts">
import { Vue, Component, Prop } from 'vue-property-decorator';

@Component
export default class Button extends Vue {
    @Prop() icon?: 'edit' | 'cancel';

    @Prop()
    text?: string;

    @Prop()
    tooltip?: string;

    @Prop()
    width?: number;

    @Prop({ default: true })
    enabled!: boolean;

    getText() {
        return this.text!.length > 15 ? this.text?.substring(0, 12).concat('...') : this.text;
    }
}
</script>
