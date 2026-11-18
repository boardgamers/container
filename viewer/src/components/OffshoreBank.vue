<template>
    <g v-if="state.options.offshoreIsland && bank" class="offshore-bank">
        <g transform="translate(20 680)" class="bank-board">
            <text x="0" y="-24" font-size="10" fill="#45585b">OFFSHORE BANK</text>
            <g v-for="(label, i) in ['I', 'II', 'III']" :key="label" class="bank-lot-guide">
                <title>Lot order: payments start at I, then cycle through II and III, skipping active auctions.</title>
                <rect :x="i * 104" y="-18" width="100" height="16" fill="transparent" />
                <text :x="50 + i * 104" y="-9" text-anchor="middle" font-size="10" fill="#45585b" translate="no">{{
                    label
                }}</text>
            </g>
            <template v-for="(type, row) in ['cash', 'containers']">
                <g
                    v-for="i in 3"
                    :key="type + i"
                    @click.stop="chooseOffer(type, i - 1)"
                    :transform="`translate(${(i - 1) * 104} ${row * 110})`"
                >
                    <rect
                        class="offshore-lot"
                        :class="{ legal: offer(type, i - 1) }"
                        :data-type="type"
                        :data-lot="i - 1"
                        width="100"
                        height="104"
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
                        <title>
                            {{
                                type === 'cash'
                                    ? 'Bid containers to win this cash.'
                                    : 'Bid cash to win these containers.'
                            }}
                        </title>
                    </rect>
                    <text v-if="type === 'cash'" class="bank-money" x="6" y="18" font-size="16" pointer-events="none"
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
                        <PlayerToken
                            class="bank-bidder"
                            :transform="`translate(16 ${type === 'cash' ? 33 : 94})`"
                            :owner="auction(type, i - 1).bidder"
                            :name="owner(auction(type, i - 1).bidder)"
                            :color="playerColors[auction(type, i - 1).bidder]"
                        />
                        <OffshoreCargo
                            v-if="type === 'cash'"
                            :pieces="escrow(auction(type, i - 1))"
                            transform="translate(6 44)"
                            :columns="3"
                            :rows="2"
                        />
                        <text v-else class="bank-money bank-bid-amount" x="94" y="94" font-size="16" text-anchor="end"
                            >${{ auction(type, i - 1).cash }}<title>Cash bid</title></text
                        >
                    </g>
                </g>
            </template>
        </g>
        <g class="bank-piers" pointer-events="none" transform="translate(332 680)">
            <rect width="4" height="214" fill="#c6c6b8" />
            <rect v-for="i in 6" :key="i" x="4" :y="(i - 1) * 42" width="108" height="4" fill="#c6c6b8" />
        </g>
        <g
            v-for="({ p, i }, index) in holdings"
            :key="'holding' + i"
            :transform="`translate(${750 + Math.floor(index / 3) * 240} ${680 + (index % 3) * 85})`"
            class="bank-holding"
            :data-owner="i"
        >
            <PlayerToken transform="translate(9 0)" :owner="i" :name="owner(i)" :color="playerColors[i]" />
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
        <g v-if="bank.decision" class="bank-decision" transform="translate(470 680)">
            <text x="0" y="0" font-size="14">{{ decisionTitle }}</text>
            <template v-if="!decisionMoves.length">
                <PlayerToken
                    transform="translate(9 20)"
                    :owner="bank.decision.player"
                    :name="owner(bank.decision.player)"
                    :color="playerColors[bank.decision.player]"
                />
                <OffshoreCargo :pieces="pendingCargo" transform="translate(0 35)" :columns="10" :rows="8" />
            </template>
            <template v-else>
                <text v-if="bank.decision.kind === 'distribute'" x="0" y="20" font-size="11"
                    >Lot {{ ['I', 'II', 'III'][distributionLot] }}</text
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
                            <text :x="42 + (price - 1) * 30" y="12" text-anchor="middle" font-size="16">{{
                                price
                            }}</text>
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
import { BankAuction, BankAuctionType, GameState } from 'container-engine/src/gamestate';
import { AvailableMoves } from 'container-engine/src/available-moves';
import { playerColors } from 'container-engine/src/engine';
import { Move, MoveName, Moves } from 'container-engine/src/move';
import { legalBankAction } from '../offshore-actions';
import Button from './buttons/Button.vue';
import OffshoreCargo from './OffshoreCargo.vue';
import PlayerToken from './PlayerToken.vue';

@Component({ components: { OffshoreCargo, PlayerToken, Button } })
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
