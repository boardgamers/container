<template>
    <g class="button" @click="$emit('click')">
        <rect width="70" height="30" fill="gainsboro" stroke="black" rx="2"></rect>
        <path transform="translate(8,8) scale(0.025,0.025)" fill="black" d="M248.625,89.25 V0 l-127.5,127.5 l127.5,127.5 V140.25 c84.15,0,153,68.85,153,153 c0,84.15-68.85,153-153,153 c-84.15,0-153-68.85-153-153 h-51 c0,112.2,91.8,204,204,204 s204-91.8,204-204 S360.825,89.25,248.625,89.25z"/>
        <text text-anchor="middle" fill="black" x="42" y="16">Undo</text>
    </g>
</template>
<script lang="ts">
import { Vue, Component } from "vue-property-decorator";

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
