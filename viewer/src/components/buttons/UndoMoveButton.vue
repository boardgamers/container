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
        <image x="30" y="3" width="20" height="20" href="../../icons/undo.svg" aria-hidden="true" />
        <title>Undo my move</title>
    </g>
</template>
<script lang="ts">
import { Vue, Component } from 'vue-property-decorator';

/** Asks BGS to take back the player's last saved move (offered in games against bots). */
@Component
export default class UndoMoveButton extends Vue {}
</script>
