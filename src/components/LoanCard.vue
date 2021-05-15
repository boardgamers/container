<template>
    <g>
        <rect width="30" height="60" fill="royalblue" stroke="white" stroke-width="2" rx="2"></rect>
        <g transform="translate(33, -10) rotate(280, 15, 30)">
            <text text-anchor="middle" fill="white">Loan</text>
        </g>
    </g>
</template>
<script lang="ts">
import { Vue, Component } from "vue-property-decorator";

@Component
export default class LoanCard extends Vue {
}
</script>
