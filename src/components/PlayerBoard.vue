<template>
    <g class="player-board">
        <rect width="250" height="20" x="0" y="0" :fill="color" />
        <text x="5" y="10" font-weight="600" fill="black" :text-decoration="currentPlayer ? 'underline' : ''">{{ getPlayerName() }}</text>

        <rect width="250" height="180" x="0" y="20" fill="gray" />

        <DropZone :transform="`translate(35, 200)`" :width="199" :height="80" :accepts="'ship'" :data="{ type: 'playerHarbor', owner: owner }" />
        <rect width="20" height="80" x="0" y="200" fill="gray" />
        <rect width="20" height="80" x="62" y="200" fill="gray" />
        <rect width="20" height="80" x="124" y="200" fill="gray" />
        <rect width="20" height="80" x="186" y="200" fill="gray" />

        <DropZone :transform="`translate(200, 25)`" :width="40" :height="70" :enabled="currentPlayer" :accepts="'loan'" :data="{ type: 'getLoan' }" />

        <DropZone :transform="`translate(13, 25)`" :width="174" :height="30" :enabled="currentPlayer" :accepts="'factory'" />
        <circle r="14" cx="28" cy="40" fill="none" stroke="lightgray" />
        <text text-anchor="middle" x="28" y="40" fill="lightgray">-</text>
        <circle r="14" cx="76" cy="40" fill="none" stroke="lightgray" />
        <text text-anchor="middle" x="76" y="40" fill="lightgray">6</text>
        <circle r="14" cx="124" cy="40" fill="none" stroke="lightgray" />
        <text text-anchor="middle" x="124" y="40" fill="lightgray">9</text>
        <circle r="14" cx="172" cy="40" fill="none" stroke="lightgray" />
        <text text-anchor="middle" x="171" y="40" fill="lightgray">12</text>

        <DropZone :transform="`translate(12, 64)`" :width="32" :height="32" :enabled="currentPlayer" :accepts="'container'" :data="{ type: 'factoryStore', price: 1 }" />
        <rect x="8" y="60" width="40" height="40" fill="none" stroke="lightgray" />
        <text text-anchor="middle" x="28" y="90" fill="lightgray">1</text>
        <DropZone :transform="`translate(60, 64)`" :width="32" :height="32" :enabled="currentPlayer" :accepts="'container'" :data="{ type: 'factoryStore', price: 2 }" />
        <rect x="56" y="60" width="40" height="40" fill="none" stroke="lightgray" />
        <text text-anchor="middle" x="76" y="90" fill="lightgray">2</text>
        <DropZone :transform="`translate(108, 64)`" :width="32" :height="32" :enabled="currentPlayer" :accepts="'container'" :data="{ type: 'factoryStore', price: 3 }" />
        <rect x="104" y="60" width="40" height="40" fill="none" stroke="lightgray" />
        <text text-anchor="middle" x="124" y="90" fill="lightgray">3</text>
        <DropZone :transform="`translate(156, 64)`" :width="32" :height="32" :enabled="currentPlayer" :accepts="'container'" :data="{ type: 'factoryStore', price: 4 }" />
        <rect x="152" y="60" width="40" height="40" fill="none" stroke="lightgray" />
        <text text-anchor="middle" x="172" y="90" fill="lightgray">4</text>

        <DropZone :transform="`translate(7, 104)`" :width="234" :height="42" :enabled="currentPlayer" :accepts="'warehouse'" />
        <rect x="8" y="105" width="40" height="40" fill="none" stroke="lightgray" />
        <text text-anchor="middle" x="28" y="125" fill="lightgray">-</text>
        <rect x="56" y="105" width="40" height="40" fill="none" stroke="lightgray" />
        <text text-anchor="middle" x="76" y="125" fill="lightgray">4</text>
        <rect x="104" y="105" width="40" height="40" fill="none" stroke="lightgray" />
        <text text-anchor="middle" x="124" y="125" fill="lightgray">5</text>
        <rect x="152" y="105" width="40" height="40" fill="none" stroke="lightgray" />
        <text text-anchor="middle" x="172" y="125" fill="lightgray">6</text>
        <rect x="200" y="105" width="40" height="40" fill="none" stroke="lightgray" />
        <text text-anchor="middle" x="220" y="125" fill="lightgray">7</text>

        <DropZone :transform="`translate(12, 154)`" :width="32" :height="32" :enabled="currentPlayer" :accepts="'container'" :data="{ type: 'warehouseStore', price: 2 }" />
        <rect x="8" y="150" width="40" height="40" fill="none" stroke="lightgray" />
        <text text-anchor="middle" x="28" y="180" fill="lightgray">2</text>
        <DropZone :transform="`translate(60, 154)`" :width="32" :height="32" :enabled="currentPlayer" :accepts="'container'" :data="{ type: 'warehouseStore', price: 3 }" />
        <rect x="56" y="150" width="40" height="40" fill="none" stroke="lightgray" />
        <text text-anchor="middle" x="76" y="180" fill="lightgray">3</text>
        <DropZone :transform="`translate(108, 154)`" :width="32" :height="32" :enabled="currentPlayer" :accepts="'container'" :data="{ type: 'warehouseStore', price: 4 }" />
        <rect x="104" y="150" width="40" height="40" fill="none" stroke="lightgray" />
        <text text-anchor="middle" x="124" y="180" fill="lightgray">4</text>
        <DropZone :transform="`translate(156, 154)`" :width="32" :height="32" :enabled="currentPlayer" :accepts="'container'" :data="{ type: 'warehouseStore', price: 5 }" />
        <rect x="152" y="150" width="40" height="40" fill="none" stroke="lightgray" />
        <text text-anchor="middle" x="172" y="180" fill="lightgray">5</text>
        <DropZone :transform="`translate(204, 154)`" :width="32" :height="32" :enabled="currentPlayer" :accepts="'container'" :data="{ type: 'warehouseStore', price: 6 }" />
        <rect x="200" y="150" width="40" height="40" fill="none" stroke="lightgray" />
        <text text-anchor="middle" x="220" y="180" fill="lightgray">6</text>
    </g>
</template>
<script lang="ts">
import { Player } from 'container-engine';
import { Vue, Component, Prop } from 'vue-property-decorator';
import DropZone from './DropZone.vue';

@Component({
    components: {
        DropZone,
    }
})
export default class PlayerBoard extends Vue {
    @Prop()
    color?: string;

    @Prop()
    player!: Player;

    @Prop()
    currentPlayer?: boolean;

    @Prop()
    owner?: number;

    @Prop()
    ended?: boolean;

    onPieceDrop(e) {
        this.$emit('pieceDrop', e);
    }

    getPlayerName() {
        let name = '';
        if (this.currentPlayer) {
            name += '• ';
        }

        name += this.player.name;

        if (this.player.showBid) {
            if (this.player.showAdditionalBid) {
                name += ' (Bid: $' + (this.player.bid + this.player.additionalBid) + ')';
            } else {
                name += ' (Bid: $' + this.player.bid + ')';
            }
        } else if (this.ended) {
            name += ' (Score: $' + (this.player.money) + ')';
        }

        return name;
    }
}

</script>