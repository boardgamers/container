<template>
    <g v-if="state.options.offshoreIsland && bank" class="offshore-bank">
        <g transform="translate(20 680)" class="bank-board">
            <text x="0" y="-12" font-size="10" fill="#45585b">OFFSHORE BANK</text>
            <template v-for="(type, row) in ['cash', 'containers']">
                <g
                    v-for="i in 3"
                    :key="type + i"
                    @click.stop="chooseOffer(type, i - 1)"
                    :transform="`translate(${(i - 1) * 88} ${row * 88})`"
                >
                    <rect
                        class="offshore-lot"
                        :class="{ legal: offer(type, i - 1) }"
                        :data-type="type"
                        :data-lot="i - 1"
                        width="84"
                        height="82"
                        fill="#e2e0d3"
                        stroke="#899997"
                        :role="offer(type, i - 1) ? 'button' : undefined"
                        :tabindex="offer(type, i - 1) ? 0 : undefined"
                        :aria-label="
                            (type === 'cash' ? 'Cash' : 'Container') +
                            ' lot ' +
                            i +
                            (type === 'cash'
                                ? ': $' + bank.cashLots[i - 1]
                                : ': ' + bank.containerLots[i - 1].length + ' containers')
                        "
                        @click.stop="chooseOffer(type, i - 1)"
                        @keydown.enter.prevent.stop="chooseOffer(type, i - 1)"
                        @keydown.space.prevent.stop="chooseOffer(type, i - 1)"
                    >
                        <title>{{ type === 'cash' ? 'Cash' : 'Container' }} lot {{ i }}</title>
                    </rect>
                    <text x="77" y="12" text-anchor="end" font-size="8" pointer-events="none">{{ i }}</text>
                    <text v-if="type === 'cash'" x="6" y="18" font-size="14" pointer-events="none"
                        >${{ bank.cashLots[i - 1] }}</text
                    >
                    <OffshoreCargo
                        v-else
                        :pieces="bank.containerLots[i - 1]"
                        transform="translate(6 19)"
                        :columns="3"
                        :rows="2"
                    />
                    <g v-if="auction(type, i - 1)">
                        <rect
                            x="1"
                            :y="type === 'cash' ? 25 : 70"
                            width="3"
                            height="11"
                            :fill="playerColors[auction(type, i - 1).bidder]"
                        />
                        <title translate="no">{{ owner(auction(type, i - 1).bidder) }}</title>
                        <text x="6" :y="type === 'cash' ? 31 : 76" font-size="8" fill="#203a45" translate="no"
                            >{{ playerLabel(auction(type, i - 1).bidder)
                            }}<title translate="no">{{ owner(auction(type, i - 1).bidder) }}</title></text
                        >
                        <OffshoreCargo
                            v-if="type === 'cash'"
                            :pieces="escrow(auction(type, i - 1))"
                            transform="translate(6 36)"
                            :columns="3"
                            :rows="2"
                        />
                        <text v-else x="78" y="76" font-size="10" text-anchor="end"
                            >${{ auction(type, i - 1).cash }}</text
                        >
                    </g>
                </g>
            </template>
            <Button
                v-if="canSail"
                transform="translate(0 240)"
                :width="130"
                text="Sail to bank"
                @click="emitMove({ name: names.Sail, data: 'offshoreBank' })"
            />
        </g>
        <text x="1100" y="665" font-size="9" fill="#45585b">BANK HARBOR</text>
        <g
            v-for="({ p, i }, index) in holdings"
            :key="'holding' + i"
            :transform="`translate(${600 + Math.floor(index / 3) * 240} ${680 + (index % 3) * 85})`"
            class="bank-holding"
            :data-owner="i"
        >
            <rect x="0" y="-8" width="3" height="12" :fill="playerColors[i]" />
            <text x="7" y="0" font-size="10" fill="#203a45" translate="no"
                >{{ playerLabel(i) }}<title translate="no">{{ owner(i) }}: bank holding</title></text
            >
            <OffshoreCargo
                :pieces="p.bankHolding || []"
                transform="translate(0 12)"
                :columns="9"
                :rows="3"
                :selectable="
                    canAct && i === player
                        ? (availableMoves[names.LoadBankContainer] || []).map((piece) => piece.id)
                        : []
                "
                @select="loadContainer"
            />
        </g>
        <g v-if="bank.decision" class="bank-decision" transform="translate(310 680)">
            <text x="0" y="0" font-size="14">{{ decisionTitle }}</text>
            <template v-if="!decisionMoves.length">
                <text x="0" y="20" font-size="12" fill="#203a45" translate="no"
                    >{{ playerLabel(bank.decision.player)
                    }}<title translate="no">{{ owner(bank.decision.player) }}</title></text
                >
                <OffshoreCargo :pieces="pendingCargo" transform="translate(0 35)" :columns="10" :rows="8" />
            </template>
            <template v-else>
                <text v-if="bank.decision.kind === 'distribute'" x="0" y="20" font-size="11"
                    >Lot {{ distributionLot + 1 }}</text
                >
                <g
                    v-for="(choice, index) in visibleDecisions"
                    :key="choice.data.id"
                    class="bank-choice"
                    :transform="`translate(0 ${40 + index * 35})`"
                >
                    <OffshoreCargo :pieces="[choice.data]" />
                    <template v-if="choice.name === names.ReturnBankContainer">
                        <g
                            v-for="price in returnPrices(choice)"
                            :key="price"
                            role="button"
                            tabindex="0"
                            :aria-label="'Return at $' + price"
                            @click.stop="emitMove({ ...choice, extraData: { price } })"
                            @keydown.enter.prevent.stop="emitMove({ ...choice, extraData: { price } })"
                            @keydown.space.prevent.stop="emitMove({ ...choice, extraData: { price } })"
                        >
                            <rect
                                :x="29 + (price - 1) * 30"
                                y="-3"
                                width="27"
                                height="24"
                                fill="#c6c6b8"
                                stroke="#899997"
                            />
                            <text :x="42 + (price - 1) * 30" y="12" text-anchor="middle" font-size="11"
                                >${{ price }}</text
                            >
                        </g>
                    </template>
                    <g
                        v-else
                        role="button"
                        tabindex="0"
                        :aria-label="
                            choice.name === names.SeizeBankContainer ? 'Select for default' : 'Distribute next'
                        "
                        @click.stop="emitMove(choice)"
                        @keydown.enter.prevent.stop="emitMove(choice)"
                        @keydown.space.prevent.stop="emitMove(choice)"
                    >
                        <rect x="29" y="-3" width="34" height="24" fill="orange" /><text
                            x="46"
                            y="12"
                            text-anchor="middle"
                            fill="white"
                            >→</text
                        >
                    </g>
                </g>
                <Button
                    v-if="decisionPages > 1"
                    transform="translate(0 190)"
                    :width="100"
                    :text="'More ' + (decisionPage + 1) + '/' + decisionPages"
                    @click="decisionPage = (decisionPage + 1) % decisionPages"
                />
            </template>
        </g>
    </g>
</template>
<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { BankAuction, BankAuctionType, GameState, ShipPosition } from 'container-engine/src/gamestate';
import { AvailableMoves } from 'container-engine/src/available-moves';
import { playerColors } from 'container-engine/src/engine';
import { Move, MoveName, Moves } from 'container-engine/src/move';
import { legalBankAction } from '../offshore-actions';
import Button from './buttons/Button.vue';
import OffshoreCargo from './OffshoreCargo.vue';

@Component({ components: { OffshoreCargo, Button } })
export default class OffshoreBank extends Vue {
    @Prop({ required: true }) state!: GameState;
    @Prop() player?: number;
    @Prop({ default: () => ({}) }) availableMoves!: AvailableMoves;
    @Prop({ default: () => playerColors }) playerColors!: string[];
    names = MoveName;
    decisionPage = 0;
    get decisionPages() {
        return Math.max(1, Math.ceil(this.decisionMoves.length / 4));
    }
    get visibleDecisions() {
        return this.decisionMoves.slice(
            Math.min(this.decisionPage, this.decisionPages - 1) * 4,
            (Math.min(this.decisionPage, this.decisionPages - 1) + 1) * 4
        );
    }
    get canAct() {
        return this.player != null && this.state.currentPlayers.includes(this.player);
    }
    get holdings() {
        return this.state.players
            .map((p, i) => ({ p, i }))
            .filter(
                ({ p, i }) =>
                    (p.bankHolding || []).length ||
                    (i === this.player && !!this.availableMoves[MoveName.LoadBankContainer])
            );
    }
    get canSail() {
        return (
            this.canAct &&
            !!this.availableMoves[MoveName.Sail] &&
            legalBankAction(this.state, this.player, { name: MoveName.Sail, data: ShipPosition.OffshoreBank })
        );
    }

    get bank() {
        return this.state.offshoreBank;
    }
    offer(type: BankAuctionType, lot: number) {
        return this.canAct && this.availableMoves[MoveName.CallBank]?.some((o) => o.type === type && o.lot === lot);
    }
    chooseOffer(type: BankAuctionType, lot: number) {
        if (this.offer(type, lot)) this.$emit('choose-offer', { type, lot });
    }
    emitMove(action: Move) {
        if (!this.availableMoves[action.name] || !legalBankAction(this.state, this.player, action)) return;
        this.$emit('move', action);
    }
    get decisionMoves(): Moves.MoveBankContainer[] {
        if (!this.canAct) return [];
        return (
            [MoveName.ReturnBankContainer, MoveName.DistributeBankContainer, MoveName.SeizeBankContainer] as const
        ).flatMap((name) => (this.availableMoves[name] || []).map((data) => ({ name, data })));
    }
    get pendingCargo() {
        const d = this.bank?.decision;
        return d?.kind === 'return'
            ? d.containers.map((c) => ({ ...c.container.piece, price: c.container.price }))
            : d?.payment || [];
    }
    get decisionTitle() {
        return this.bank?.decision?.kind === 'return'
            ? 'Outbid'
            : this.bank?.decision?.kind === 'seize'
            ? 'Loan default'
            : 'Pay bank';
    }
    returnPrices(choice: Moves.MoveBankContainer) {
        return [1, 2, 3, 4, 5, 6].filter((price) =>
            legalBankAction(this.state, this.player, { ...choice, extraData: { price } })
        );
    }
    get distributionLot() {
        const lots = [0, 1, 2].filter((i) => !this.bank?.auctions.some((a) => a.type === 'containers' && a.lot === i));
        return lots[(this.bank?.decision?.cursor || 0) % lots.length];
    }
    owner(index: number) {
        return this.state.players[index]?.name || String(index + 1);
    }
    playerLabel(index: number) {
        const name = this.owner(index);
        return name.length > 10 ? name.slice(0, 9) + '…' : name;
    }
    auction(type: BankAuctionType, lot: number) {
        return this.bank?.auctions.find((a) => a.type === type && a.lot === lot);
    }
    escrow(auction: BankAuction) {
        return auction.containers.map((c) => ({ ...c.container.piece, price: c.container.price }));
    }
    loadContainer(id: string) {
        const piece = this.availableMoves[MoveName.LoadBankContainer]?.find((c) => c.id === id);
        if (piece) this.emitMove({ name: MoveName.LoadBankContainer, data: piece });
    }
}
</script>
<style scoped>
.offshore-lot.legal {
    stroke: #1b6c87;
    stroke-width: 2;
    cursor: pointer;
}
.offshore-lot[role='button']:hover,
.offshore-lot[role='button']:focus-visible,
[role='button']:focus-visible > rect {
    stroke: blue;
    stroke-width: 2;
    outline: none;
}
[role='button'] {
    cursor: pointer;
}
</style>
