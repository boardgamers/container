<template>
  <g :class="['player-label', {main}]">
    <text style="filter: url(#shadow); fill: white" class="shadow" >{{player.name || `Player ${playerIndex + 1}`}}</text>
    <text class="player-name">{{player.name || `Player ${playerIndex + 1}`}}</text>
    <text class="points" :y="main ? 13 : 11.5" style="stroke: #ffffff33;">{{player.points}}</text>
    <text class="points" :y="main ? 13 : 11.5">{{player.points}}</text>
  </g>
</template>
<script lang="ts">
import {Vue, Component, Prop, Watch} from "vue-property-decorator";
import type {Player} from "container-engine";

@Component
export default class PlayerLabel extends Vue {
  @Prop({default: false})
  main!: boolean;

  @Prop()
  player!: Player;

  @Prop()
  playerIndex!: number;
}

</script>
<style lang="scss">
.player-label {
  &.main {
    fill: orange;
  }

  &.main .player-name {
    font-size: 12px;
  }

  &.main .shadow {
    font-size: 12px;
    opacity: 0.4;
  }

  .player-name, .shadow {
    font-size: 11px;
  }

  .shadow {
    opacity: 0.2;
  }

  .points {
    font-size: 10px;
  }
}
</style>
