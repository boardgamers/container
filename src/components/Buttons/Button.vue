<template>
    <g class="button" @click="$emit('click')">
        <rect :width="width" height="30" fill="gainsboro" stroke="black" rx="2"></rect>
        <text text-anchor="middle" fill="black" :x="width / 2" y="16">{{ text }}</text>
    </g>
</template>
<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";

@Component
export default class Button extends Vue {
    @Prop()
    text?: string;

    @Prop()
    width?: number;
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
