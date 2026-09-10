<template>
    <g class="player-board">
        <rect width="250" height="20" x="0" y="0" :fill="color" />
        <text x="5" y="10" font-weight="600" fill="black" :text-decoration="isCurrentPlayer ? 'underline' : ''">{{
            getPlayerName()
        }}</text>

        <rect width="250" height="180" x="0" y="20" fill="#e2e0d3" stroke="#899997" />
        <rect width="246" height="2" x="2" y="21" :fill="color" />
        <text x="248" y="104" text-anchor="end" font-size="8" fill="#45585b">FACTORY SALES</text>
        <text x="248" y="194" text-anchor="end" font-size="8" fill="#45585b">WAREHOUSE SALES</text>

        <rect width="20" height="80" x="0" y="200" fill="#c6c6b8" />
        <rect width="20" height="80" x="62" y="200" fill="#c6c6b8" />
        <rect width="20" height="80" x="124" y="200" fill="#c6c6b8" />
        <rect width="20" height="80" x="186" y="200" fill="#c6c6b8" />
        <DropZone
            :transform="`translate(20, 200)`"
            :width="42"
            :height="80"
            :accepts="'ship'"
            :data="{ type: 'playerHarbor' + owner + '1', owner: owner }"
        />
        <DropZone
            :transform="`translate(82, 200)`"
            :width="42"
            :height="80"
            :accepts="'ship'"
            :data="{ type: 'playerHarbor' + owner + '2', owner: owner }"
        />
        <DropZone
            :transform="`translate(144, 200)`"
            :width="42"
            :height="80"
            :accepts="'ship'"
            :data="{ type: 'playerHarbor' + owner + '3', owner: owner }"
        />
        <DropZone
            :transform="`translate(206, 200)`"
            :width="43"
            :height="80"
            :accepts="'ship'"
            :data="{ type: 'playerHarbor' + owner + '4', owner: owner }"
        />

        <DropZone
            :transform="`translate(200, 23)`"
            :width="47"
            :height="77"
            :enabled="isCurrentPlayer"
            :accepts="'loan'"
            :data="{ type: 'getLoan' }"
        />

        <circle r="14" cx="28" cy="40" fill="none" stroke="#6f7976" />
        <text text-anchor="middle" x="28" y="40" fill="#394b4d">-</text>
        <circle r="14" cx="76" cy="40" fill="none" stroke="#6f7976" />
        <text text-anchor="middle" x="76" y="40" fill="#394b4d">6</text>
        <circle r="14" cx="124" cy="40" fill="none" stroke="#6f7976" />
        <text text-anchor="middle" x="124" y="40" fill="#394b4d">9</text>
        <circle r="14" cx="172" cy="40" fill="none" stroke="#6f7976" />
        <text text-anchor="middle" x="171" y="40" fill="#394b4d">12</text>
        <DropZone
            :transform="`translate(13, 25)`"
            :width="174"
            :height="30"
            :enabled="isCurrentPlayer"
            :accepts="'factory'"
            :data="{ type: 'factory' }"
        />

        <rect x="8" y="60" width="40" height="40" fill="none" stroke="#6f7976" />
        <text text-anchor="middle" x="28" y="90" fill="#394b4d">1</text>
        <DropZone
            :transform="`translate(8, 60)`"
            :width="40"
            :height="40"
            :enabled="isCurrentPlayer"
            :accepts="'container'"
            :data="{ type: 'factoryStore', price: 1 }"
        />
        <rect x="56" y="60" width="40" height="40" fill="none" stroke="#6f7976" />
        <text text-anchor="middle" x="76" y="90" fill="#394b4d">2</text>
        <DropZone
            :transform="`translate(56, 60)`"
            :width="40"
            :height="40"
            :enabled="isCurrentPlayer"
            :accepts="'container'"
            :data="{ type: 'factoryStore', price: 2 }"
        />
        <rect x="104" y="60" width="40" height="40" fill="none" stroke="#6f7976" />
        <text text-anchor="middle" x="124" y="90" fill="#394b4d">3</text>
        <DropZone
            :transform="`translate(104, 60)`"
            :width="40"
            :height="40"
            :enabled="isCurrentPlayer"
            :accepts="'container'"
            :data="{ type: 'factoryStore', price: 3 }"
        />
        <rect x="152" y="60" width="40" height="40" fill="none" stroke="#6f7976" />
        <text text-anchor="middle" x="172" y="90" fill="#394b4d">4</text>
        <DropZone
            :transform="`translate(152, 60)`"
            :width="40"
            :height="40"
            :enabled="isCurrentPlayer"
            :accepts="'container'"
            :data="{ type: 'factoryStore', price: 4 }"
        />

        <g transform="translate(8, 105)"><path d="M20 0 L40 13 L40 40 L0 40 L0 13Z" fill="none" stroke="#6f7976" /></g>
        <text text-anchor="middle" x="28" y="128" fill="#394b4d">-</text>
        <g transform="translate(56, 105)"><path d="M20 0 L40 13 L40 40 L0 40 L0 13Z" fill="none" stroke="#6f7976" /></g>
        <text text-anchor="middle" x="76" y="128" fill="#394b4d">4</text>
        <g transform="translate(104, 105)"
            ><path d="M20 0 L40 13 L40 40 L0 40 L0 13Z" fill="none" stroke="#6f7976"
        /></g>
        <text text-anchor="middle" x="124" y="128" fill="#394b4d">5</text>
        <g transform="translate(152, 105)"
            ><path d="M20 0 L40 13 L40 40 L0 40 L0 13Z" fill="none" stroke="#6f7976"
        /></g>
        <text text-anchor="middle" x="172" y="128" fill="#394b4d">6</text>
        <g transform="translate(200, 105)"
            ><path d="M20 0 L40 13 L40 40 L0 40 L0 13Z" fill="none" stroke="#6f7976"
        /></g>
        <text text-anchor="middle" x="220" y="128" fill="#394b4d">7</text>
        <DropZone
            :transform="`translate(7, 104)`"
            :width="234"
            :height="42"
            :enabled="isCurrentPlayer"
            :accepts="'warehouse'"
            :data="{ type: 'warehouse' }"
        />

        <rect x="8" y="150" width="40" height="40" fill="none" stroke="#6f7976" />
        <text text-anchor="middle" x="28" y="180" fill="#394b4d">2</text>
        <DropZone
            :transform="`translate(8, 150)`"
            :width="40"
            :height="40"
            :enabled="isCurrentPlayer"
            :accepts="'container'"
            :data="{ type: 'warehouseStore', price: 2 }"
        />
        <rect x="56" y="150" width="40" height="40" fill="none" stroke="#6f7976" />
        <text text-anchor="middle" x="76" y="180" fill="#394b4d">3</text>
        <DropZone
            :transform="`translate(56, 150)`"
            :width="40"
            :height="40"
            :enabled="isCurrentPlayer"
            :accepts="'container'"
            :data="{ type: 'warehouseStore', price: 3 }"
        />
        <rect x="104" y="150" width="40" height="40" fill="none" stroke="#6f7976" />
        <text text-anchor="middle" x="124" y="180" fill="#394b4d">4</text>
        <DropZone
            :transform="`translate(104, 150)`"
            :width="40"
            :height="40"
            :enabled="isCurrentPlayer"
            :accepts="'container'"
            :data="{ type: 'warehouseStore', price: 4 }"
        />
        <rect x="152" y="150" width="40" height="40" fill="none" stroke="#6f7976" />
        <text text-anchor="middle" x="172" y="180" fill="#394b4d">5</text>
        <DropZone
            :transform="`translate(152, 150)`"
            :width="40"
            :height="40"
            :enabled="isCurrentPlayer"
            :accepts="'container'"
            :data="{ type: 'warehouseStore', price: 5 }"
        />
        <rect x="200" y="150" width="40" height="40" fill="none" stroke="#6f7976" />
        <text text-anchor="middle" x="220" y="180" fill="#394b4d">6</text>
        <DropZone
            :transform="`translate(200, 150)`"
            :width="40"
            :height="40"
            :enabled="isCurrentPlayer"
            :accepts="'container'"
            :data="{ type: 'warehouseStore', price: 6 }"
        />
    </g>
</template>
<script lang="ts">
import { Player } from 'container-engine';
import { Vue, Component, Prop } from 'vue-property-decorator';
import DropZone from './DropZone.vue';

@Component({
    components: {
        DropZone,
    },
})
export default class PlayerBoard extends Vue {
    @Prop()
    color?: string;

    @Prop()
    player!: Player;

    @Prop()
    isCurrentPlayer?: boolean;

    @Prop()
    owner?: number;

    @Prop()
    ended?: boolean;

    onPieceDrop(e) {
        this.$emit('pieceDrop', e);
    }

    getPlayerName() {
        let name = '';
        if (this.isCurrentPlayer) {
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
            name += ' (Score: $' + this.player.money + ')';
        }

        return name;
    }
}
</script>
