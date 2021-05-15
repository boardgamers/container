<template>
    <g>
        <g :transform="'rotate(' + rotate + ', 15, 40)'">
            <path d="M15 0 L30 10 L30 80 L0 80 L0 10Z" :fill="color" stroke="black"></path>
        </g>
    </g>
</template>
<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";

@Component
export default class Warehouse extends Vue {
    @Prop()
    color?: string;

    @Prop()
    rotate?: number;
}
</script>
