<template>
    <g>
        <circle r="10" :fill="color" stroke="black"></circle>
    </g>
</template>
<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";

@Component
export default class Factory extends Vue {
    @Prop()
    color?: string;
}
</script>
