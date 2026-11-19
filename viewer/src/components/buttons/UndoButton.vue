<template>
    <g
        :class="['button', { enabled }]"
        data-board-control="undo"
        role="button"
        aria-label="Undo last move"
        :tabindex="enabled ? 0 : -1"
        :aria-disabled="!enabled"
        @click="enabled && $emit('click')"
        @keydown.enter.prevent="enabled && $emit('click')"
        @keydown.space.prevent="enabled && $emit('click')"
    >
        <rect width="80" height="26" fill="gainsboro" stroke="black" rx="2" />
        <svg
            class="undo-icon"
            x="30"
            y="3"
            width="20"
            height="20"
            viewBox="0 0 497.25 497.25"
            aria-hidden="true"
            pointer-events="none"
        >
            <path
                :fill="enabled ? 'black' : 'silver'"
                d="M248.625,89.25 V0 l-127.5,127.5 l127.5,127.5 V140.25 c84.15,0,153,68.85,153,153 c0,84.15-68.85,153-153,153 c-84.15,0-153-68.85-153-153 h-51 c0,112.2,91.8,204,204,204 s204-91.8,204-204 S360.825,89.25,248.625,89.25z"
            />
        </svg>
        <title>Undo last move</title>
    </g>
</template>
<script lang="ts">
import { Vue, Component, Prop } from 'vue-property-decorator';

@Component
export default class UndoButton extends Vue {
    @Prop()
    enabled!: boolean;
}
</script>
