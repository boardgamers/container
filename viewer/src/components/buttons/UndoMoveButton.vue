<template>
    <g
        class="button enabled"
        data-board-control="undo-move"
        role="button"
        aria-label="Undo my move"
        tabindex="0"
        @click="$emit('click')"
        @keydown.enter.prevent="$emit('click')"
        @keydown.space.prevent="$emit('click')"
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
                fill="black"
                d="M248.625,89.25 V0 l-127.5,127.5 l127.5,127.5 V140.25 c84.15,0,153,68.85,153,153 c0,84.15-68.85,153-153,153 c-84.15,0-153-68.85-153-153 h-51 c0,112.2,91.8,204,204,204 s204-91.8,204-204 S360.825,89.25,248.625,89.25z"
            />
        </svg>
        <title>Undo my move</title>
    </g>
</template>
<script lang="ts">
import { Vue, Component } from 'vue-property-decorator';

/** Asks BGS to take back the player's last saved move (offered in games against bots). */
@Component
export default class UndoMoveButton extends Vue {}
</script>
