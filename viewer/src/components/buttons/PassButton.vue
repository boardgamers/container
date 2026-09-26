<template>
    <g
        :class="['button', { enabled }]"
        data-board-control="pass"
        role="button"
        aria-label="Pass turn"
        :tabindex="enabled ? 0 : -1"
        :aria-disabled="!enabled"
        @click="enabled && $emit('click')"
        @keydown.enter.prevent="enabled && $emit('click')"
        @keydown.space.prevent="enabled && $emit('click')"
    >
        <rect width="80" height="26" fill="gainsboro" stroke="black" rx="2" />
        <image x="30" y="3" width="20" height="20" href="../../icons/pass.svg" aria-hidden="true" />
        <title>Pass turn</title>
    </g>
</template>
<script lang="ts">
import { Vue, Component, Prop } from 'vue-property-decorator';

@Component
export default class PassButton extends Vue {
    @Prop()
    enabled!: boolean;
}
</script>
