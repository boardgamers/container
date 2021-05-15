<template>
    <g>
        <rect width="250" height="20" x="0" y="0" :fill="color"></rect>
        <text x="5" y="10" font-weight="600" fill="black">{{ name }}</text>
        <rect width="250" height="180" x="0" y="20" fill="gray"></rect>
        <rect width="20" height="80" x="0" y="200" fill="gray"></rect>
        <rect width="20" height="80" x="62" y="200" fill="gray"></rect>
        <rect width="20" height="80" x="124" y="200" fill="gray"></rect>
        <rect width="20" height="80" x="186" y="200" fill="gray"></rect>

        <circle r="14" cx="28" cy="40" fill="none" stroke="lightgray"></circle>
        <text text-anchor="middle" x="28" y="40" fill="lightgray">-</text>
        <circle r="14" cx="76" cy="40" fill="none" stroke="lightgray"></circle>
        <text text-anchor="middle" x="76" y="40" fill="lightgray">6</text>
        <circle r="14" cx="124" cy="40" fill="none" stroke="lightgray"></circle>
        <text text-anchor="middle" x="124" y="40" fill="lightgray">9</text>
        <circle r="14" cx="172" cy="40" fill="none" stroke="lightgray"></circle>
        <text text-anchor="middle" x="171" y="40" fill="lightgray">12</text>
        
        <rect x="8" y="60" width="40" height="40" fill="none" stroke="lightgray"></rect>
        <text text-anchor="middle" x="28" y="90" fill="lightgray">1</text>
        <rect x="56" y="60" width="40" height="40" fill="none" stroke="lightgray"></rect>
        <text text-anchor="middle" x="76" y="90" fill="lightgray">2</text>
        <rect x="104" y="60" width="40" height="40" fill="none" stroke="lightgray"></rect>
        <text text-anchor="middle" x="124" y="90" fill="lightgray">3</text>
        <rect x="152" y="60" width="40" height="40" fill="none" stroke="lightgray"></rect>
        <text text-anchor="middle" x="172" y="90" fill="lightgray">4</text>

        <rect x="8" y="105" width="40" height="40" fill="none" stroke="lightgray"></rect>
        <text text-anchor="middle" x="28" y="125" fill="lightgray">-</text>
        <rect x="56" y="105" width="40" height="40" fill="none" stroke="lightgray"></rect>
        <text text-anchor="middle" x="76" y="125" fill="lightgray">4</text>
        <rect x="104" y="105" width="40" height="40" fill="none" stroke="lightgray"></rect>
        <text text-anchor="middle" x="124" y="125" fill="lightgray">5</text>
        <rect x="152" y="105" width="40" height="40" fill="none" stroke="lightgray"></rect>
        <text text-anchor="middle" x="172" y="125" fill="lightgray">6</text>
        <rect x="200" y="105" width="40" height="40" fill="none" stroke="lightgray"></rect>
        <text text-anchor="middle" x="220" y="125" fill="lightgray">7</text>

        <rect x="8" y="150" width="40" height="40" fill="none" stroke="lightgray"></rect>
        <text text-anchor="middle" x="28" y="180" fill="lightgray">2</text>
        <rect x="56" y="150" width="40" height="40" fill="none" stroke="lightgray"></rect>
        <text text-anchor="middle" x="76" y="180" fill="lightgray">3</text>
        <rect x="104" y="150" width="40" height="40" fill="none" stroke="lightgray"></rect>
        <text text-anchor="middle" x="124" y="180" fill="lightgray">4</text>
        <rect x="152" y="150" width="40" height="40" fill="none" stroke="lightgray"></rect>
        <text text-anchor="middle" x="172" y="180" fill="lightgray">5</text>
        <rect x="200" y="150" width="40" height="40" fill="none" stroke="lightgray"></rect>
        <text text-anchor="middle" x="220" y="180" fill="lightgray">6</text>
    </g>
</template>
<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";

@Component
export default class PlayerBoard extends Vue {
    @Prop()
    color?: string;

    @Prop()
    name?: string;
}
</script>
