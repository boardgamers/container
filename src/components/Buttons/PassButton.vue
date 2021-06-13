<template>
    <g class="button" @click="$emit('click')">
        <rect width="70" height="30" fill="gainsboro" stroke="black" rx="2" />
        <image x="10" y="10" width="10" height="10" href="../../icons/pass.svg" />
        <text text-anchor="middle" fill="black" x="42" y="16">Pass</text>
    </g>
</template>
<script lang="ts">
import { Vue, Component } from 'vue-property-decorator';

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
