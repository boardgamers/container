<template>
    <g class="button" @click="$emit('click')">
        <rect width="70" height="30" fill="gainsboro" stroke="black" rx="2"></rect>
        <path transform="translate(10,10)" d="M0 0 L5 5 L0 10 Z M5 0 L10 5 L5 10 Z" fill="black" />
        <text text-anchor="middle" fill="black" x="42" y="16">Pass</text>
    </g>
</template>
<script lang="ts">
import { Vue, Component } from "vue-property-decorator";

@Component
export default class PassButton extends Vue {
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
