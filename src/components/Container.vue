<template>
    <g>
        <g :transform="'rotate(' + rotate + ', 10, 5)'">
            <rect width="20" height="10" :fill="color" stroke="black"></rect>
        </g>
    </g>
</template>
<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";

@Component
export default class Container extends Vue {
    @Prop()
    color?: string;

    @Prop()
    rotate?: number;
}
</script>
