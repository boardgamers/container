<template>
    <g class="button" @click="$emit('click')">
        <rect width="70" height="30" fill="gainsboro" stroke="black" rx="2" />
        <image x="6" y="6" width="16" height="16" href="../../icons/undo.svg" />
        <text text-anchor="middle" fill="black" x="42" y="16">Undo</text>
    </g>
</template>
<script lang="ts">
import { Vue, Component } from 'vue-property-decorator';

@Component
export default class UndoButton extends Vue {
}
</script>
<style lang="scss">
.button {
    cursor: pointer;

    &:hover {
        rect {
            fill: silver;
            stroke: white;
        }

        path {
            fill: white;
        }

        text {
            fill: white;
        }
    }
}
</style>
