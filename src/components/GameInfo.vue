<template>
  <g :class="['game-info']"> >
    <text>Round: {{round}}</text>
  </g>
</template>
<script lang="ts">

import {Vue, Component, Prop, Watch} from "vue-property-decorator";


@Component
export default class GameInfo extends Vue {
    @Prop()
    round?: number;
}

</script>
<style lang="scss">
.game-info {
  text {
    font-size: 12px;
  }
}
</style>
