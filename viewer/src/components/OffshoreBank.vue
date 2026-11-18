<template>
    <section v-if="state.options.offshoreIsland && bank" class="offshore-bank" aria-labelledby="offshore-title">
        <header class="offshore-header">
            <div>
                <span class="offshore-eyebrow">OPTIONAL EXPANSION</span>
                <h2 id="offshore-title">Offshore Island</h2>
            </div>
            <div class="bank-summary">
                <span
                    ><span>Public auctions</span>: {{ bank.auctions.length }} · <span>Your holding</span>:
                    {{ ownPlayer && ownPlayer.bankHolding ? ownPlayer.bankHolding.length : 0 }}</span
                >
                <button
                    type="button"
                    class="bank-button bank-toggle"
                    :aria-expanded="expanded ? 'true' : 'false'"
                    aria-controls="offshore-content"
                    @click="expanded = !expanded"
                >
                    {{ expanded ? 'Hide bank' : 'Show bank' }}
                </button>
            </div>
        </header>
        <div id="offshore-content" v-show="expanded">
            <div class="offshore-lots">
                <article v-for="(cash, i) in bank.cashLots" :key="'cash' + i" class="offshore-lot">
                    <h3>
                        <span>Cash lot</span> {{ i + 1 }} <strong>${{ cash }}</strong>
                    </h3>
                    <div v-if="auction('cash', i)" class="offshore-escrow">
                        <span>Leading bidder</span>: <b translate="no">{{ owner(auction('cash', i).bidder) }}</b>
                        <OffshoreCargo :pieces="escrow(auction('cash', i))" :color-blind="colorBlind" />
                    </div>
                    <p v-else class="offshore-muted">No public bid</p>
                    <button v-if="offer('cash', i)" type="button" class="bank-button" @click="chooseOffer('cash', i)">
                        Call Bank
                    </button>
                </article>
                <article v-for="(cargo, i) in bank.containerLots" :key="'containers' + i" class="offshore-lot">
                    <h3>
                        <span>Container lot</span> {{ i + 1 }} <strong>{{ cargo.length }}</strong>
                    </h3>
                    <OffshoreCargo :pieces="cargo" :color-blind="colorBlind" />
                    <p v-if="auction('containers', i)" class="offshore-escrow">
                        <span>Leading bidder</span>:
                        <b translate="no">{{ owner(auction('containers', i).bidder) }}</b> ·
                        <span>Cash in escrow</span>: ${{ auction('containers', i).cash }}
                    </p>
                    <p v-else class="offshore-muted">No public bid</p>
                    <button
                        v-if="offer('containers', i)"
                        type="button"
                        class="bank-button"
                        @click="chooseOffer('containers', i)"
                    >
                        Call Bank
                    </button>
                </article>
            </div>
            <form
                v-if="selectedOffer && offer(selectedOffer.type, selectedOffer.lot)"
                class="bank-decision"
                @submit.prevent="submitBid"
            >
                <h3>
                    <span>Call Bank</span> ·
                    <span>{{ selectedOffer.type === 'cash' ? 'Cash lot' : 'Container lot' }}</span>
                    {{ selectedOffer.lot + 1 }}
                </h3>
                <template v-if="selectedOffer.type === 'containers'">
                    <label for="bank-cash-bid">Cash bid</label>
                    <input
                        id="bank-cash-bid"
                        v-model.number="cashBid"
                        type="number"
                        min="1"
                        step="1"
                        inputmode="numeric"
                    />
                    <p>Cash is placed in public escrow until outbid or collected.</p>
                </template>
                <template v-else>
                    <p>Select containers from your stores. Your bid must exceed the current public bid.</p>
                    <h4>Factory store</h4>
                    <OffshoreCargo
                        :pieces="factoryCargo"
                        :selectable="storeIds"
                        :selected="selectedIds"
                        :color-blind="colorBlind"
                        @select="toggleContainer"
                    />
                    <h4>Warehouse store</h4>
                    <OffshoreCargo
                        :pieces="warehouseCargo"
                        :selectable="storeIds"
                        :selected="selectedIds"
                        :color-blind="colorBlind"
                        @select="toggleContainer"
                    />
                    <p><span>Selected containers</span>: {{ selectedIds.length }}</p>
                </template>
                <button class="bank-button primary" type="submit" :disabled="!bidIsLegal">Place public bid</button>
                <button class="bank-button" type="button" @click="selectedOffer = null">Cancel</button>
                <p v-if="!bidIsLegal" class="bank-hint">
                    Choose a higher bid using your available cash or stored containers.
                </p>
            </form>
            <section v-if="bank.decision && !decisionMoves.length" class="bank-decision" aria-live="polite">
                <h3>{{ decisionTitle }}</h3>
                <p>
                    <span>Awaiting bank choice</span>: <b translate="no">{{ owner(bank.decision.player) }}</b>
                </p>
                <OffshoreCargo :pieces="pendingCargo" :color-blind="colorBlind" />
            </section>
            <section v-if="decisionMoves.length" class="bank-decision" aria-live="polite">
                <h3>{{ decisionTitle }}</h3>
                <p v-if="bank.decision && bank.decision.kind === 'return'">
                    Choose a new selling price for each returned container.
                </p>
                <p v-if="bank.decision && bank.decision.kind === 'distribute'">
                    <span>Next container goes to lot</span> {{ distributionLot + 1 }}.
                    <span>Choose the order of distribution.</span>
                </p>
                <p v-if="bank.decision && bank.decision.kind === 'seize'">
                    Choose a container to cover unpaid interest.
                </p>
                <div v-for="choice in decisionMoves" :key="choice.data.id" class="bank-choice">
                    <OffshoreCargo :pieces="[choice.data]" :color-blind="colorBlind" />
                    <template v-if="choice.name === names.ReturnBankContainer">
                        <button
                            v-for="price in returnPrices(choice)"
                            :key="price"
                            type="button"
                            class="bank-button"
                            @click="emitMove({ ...choice, extraData: { price } })"
                        >
                            <span>Return at</span> ${{ price }}
                        </button>
                    </template>
                    <button v-else class="bank-button" type="button" @click="emitMove(choice)">
                        {{ choice.name === names.SeizeBankContainer ? 'Select for default' : 'Distribute next' }}
                    </button>
                </div>
            </section>
            <div class="offshore-holdings">
                <article
                    v-for="(p, i) in state.players"
                    :key="p.id"
                    class="offshore-holding"
                    :class="{ own: i === player }"
                >
                    <h3>
                        <span translate="no">{{ owner(i) }}</span> <span v-if="i === player">· You</span>
                    </h3>
                    <span class="offshore-muted">Holding area</span>
                    <OffshoreCargo :pieces="p.bankHolding || []" :color-blind="colorBlind" />
                    <template v-if="i === player">
                        <button
                            v-for="piece in availableMoves[names.LoadBankContainer] || []"
                            :key="piece.id"
                            type="button"
                            class="bank-button"
                            @click="emitMove({ name: names.LoadBankContainer, data: piece })"
                        >
                            <span>Load onto ship</span> <OffshoreCargo :pieces="[piece]" :color-blind="colorBlind" />
                        </button>
                    </template>
                    <span v-if="!p.bankHolding || !p.bankHolding.length" class="offshore-muted">Empty</span>
                    <p v-if="p.ship.shipPosition === 'offshoreBank'" class="offshore-docked">Ship docked at the bank</p>
                </article>
            </div>
            <div class="bank-navigation">
                <button
                    v-if="canSailToBank"
                    type="button"
                    class="bank-button primary"
                    @click="emitMove({ name: names.Sail, data: positions.OffshoreBank })"
                >
                    Sail to offshore bank
                </button>
                <button
                    v-if="canLeaveBank"
                    type="button"
                    class="bank-button"
                    @click="emitMove({ name: names.Sail, data: positions.OpenSea })"
                >
                    Sail to open sea
                </button>
            </div>
        </div>
    </section>
</template>
<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import { BankAuction, BankAuctionType, GameState, ShipPosition } from 'container-engine/src/gamestate';
import { AvailableMoves } from 'container-engine/src/available-moves';
import { Move, MoveName, Moves } from 'container-engine/src/move';
import { legalBankAction } from '../offshore-actions';
import OffshoreCargo from './OffshoreCargo.vue';

@Component({ components: { OffshoreCargo } })
export default class OffshoreBank extends Vue {
    @Prop({ required: true }) state!: GameState;
    @Prop() player?: number;
    @Prop({ default: false }) colorBlind!: boolean;
    @Prop({ default: () => ({}) }) availableMoves!: AvailableMoves;
    expanded = typeof window === 'undefined' || window.innerWidth > 600;

    get attentionKey() {
        return [
            MoveName.ReturnBankContainer,
            MoveName.DistributeBankContainer,
            MoveName.SeizeBankContainer,
            MoveName.LoadBankContainer,
        ]
            .flatMap((name) => (this.availableMoves[name] || []).map((piece) => name + ':' + piece.id))
            .join('|');
    }

    @Watch('attentionKey', { immediate: true })
    revealRequiredChoice(key: string) {
        if (key) this.expanded = true;
    }

    names = MoveName;
    positions = ShipPosition;
    selectedOffer: { type: BankAuctionType; lot: number } | null = null;
    selectedIds: string[] = [];
    cashBid = 1;

    @Watch('state')
    resetDraft() {
        this.selectedOffer = null;
        this.selectedIds = [];
        this.cashBid = 1;
    }

    get bank() {
        return this.state.offshoreBank;
    }
    get ownPlayer() {
        return this.player == null ? undefined : this.state.players[this.player];
    }
    get factoryCargo() {
        return (this.ownPlayer?.containersOnFactoryStore || []).map((c) => ({ ...c.piece, price: c.price }));
    }
    get warehouseCargo() {
        return (this.ownPlayer?.containersOnWarehouseStore || []).map((c) => ({ ...c.piece, price: c.price }));
    }
    get storeIds() {
        return [...this.factoryCargo, ...this.warehouseCargo].map((c) => c.id);
    }
    offer(type: BankAuctionType, lot: number) {
        return this.availableMoves[MoveName.CallBank]?.find((o) => o.type === type && o.lot === lot);
    }
    chooseOffer(type: BankAuctionType, lot: number) {
        if (!this.offer(type, lot)) return;
        this.selectedOffer = { type, lot };
        this.selectedIds = [];
        this.cashBid = (this.auction(type, lot)?.cash || 0) + 1;
    }
    toggleContainer(id: string) {
        if (!this.storeIds.some((storeId) => storeId === id)) return;
        this.selectedIds = this.selectedIds.includes(id)
            ? this.selectedIds.filter((c) => c !== id)
            : [...this.selectedIds, id];
    }
    get bidMove(): Moves.MoveCallBank | null {
        return this.selectedOffer
            ? {
                  name: MoveName.CallBank,
                  data: this.selectedOffer,
                  extraData:
                      this.selectedOffer.type === 'cash' ? { containers: this.selectedIds } : { cash: this.cashBid },
              }
            : null;
    }
    get bidIsLegal() {
        return !!this.bidMove && legalBankAction(this.state, this.player, this.bidMove);
    }
    submitBid() {
        if (this.bidMove && this.bidIsLegal) this.emitMove(this.bidMove);
    }
    emitMove(action: Move) {
        // Recheck against the current legal move set immediately before emitting.
        if (!this.availableMoves[action.name] || !legalBankAction(this.state, this.player, action)) return;
        this.$emit('move', action);
        this.resetDraft();
    }
    get decisionMoves(): Moves.MoveBankContainer[] {
        const names = [
            MoveName.ReturnBankContainer,
            MoveName.DistributeBankContainer,
            MoveName.SeizeBankContainer,
        ] as const;
        return names.flatMap((name) => (this.availableMoves[name] || []).map((data) => ({ name, data })));
    }
    get pendingCargo() {
        const decision = this.bank?.decision;
        return decision?.kind === 'return'
            ? decision.containers.map((c) => ({ ...c.container.piece, price: c.container.price }))
            : decision?.payment || [];
    }
    get decisionTitle() {
        return this.bank?.decision?.kind === 'return'
            ? 'Outbid containers'
            : this.bank?.decision?.kind === 'seize'
            ? 'Loan default'
            : 'Distribute bank payment';
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
    get canSailToBank() {
        return this.availableMoves[MoveName.Sail]?.includes(ShipPosition.OffshoreBank);
    }
    get canLeaveBank() {
        return (
            this.ownPlayer?.ship.shipPosition === ShipPosition.OffshoreBank &&
            this.availableMoves[MoveName.Sail]?.includes(ShipPosition.OpenSea)
        );
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
}
</script>
<style scoped>
.offshore-bank {
    font: 14px/1.4 system-ui, sans-serif;
    box-sizing: border-box;
    width: min(1250px, 100%);
    margin: 14px auto;
    padding: 18px;
    background: #f6f4e9;
    border: 1px solid #8ca9aa;
    border-top: 4px solid #315f66;
    border-radius: 10px;
    color: #203a45;
    box-shadow: 0 4px 14px #203a4510;
}
.offshore-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
}
.bank-summary {
    display: flex;
    align-items: center;
    gap: 12px;
    color: #526d70;
    font-size: 12px;
}
.bank-toggle {
    margin: 0;
    white-space: nowrap;
}
.offshore-header h2 {
    margin: 3px 0 0;
    font-size: 23px;
}
.offshore-header p {
    font-size: 13px;
    color: #526d70;
}
.offshore-eyebrow {
    font-size: 10px;
    font-weight: bold;
    letter-spacing: 0.13em;
    color: #63786e;
}
.offshore-lots {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
}
.offshore-lot {
    border: 1px solid #c4d0c8;
    border-radius: 7px;
    padding: 12px;
    background: #ffffffa8;
    min-width: 0;
}
h3 {
    margin: 0 0 8px;
    font-size: 14px;
}
.offshore-lot h3 strong {
    float: right;
    color: #315f66;
    font-size: 18px;
}
.offshore-escrow {
    margin-top: 10px;
    font-size: 12px;
}
.offshore-escrow .offshore-cargo {
    margin-top: 6px;
}
.offshore-muted {
    color: #586c6b;
    font-size: 12px;
}
.offshore-holdings {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 8px;
    margin-top: 14px;
}
.offshore-holding {
    border: 1px dashed #adbfbb;
    border-radius: 6px;
    padding: 10px;
    min-width: 0;
}
.offshore-holding.own {
    background: #e6eee3;
    border-style: solid;
}
.offshore-holding .offshore-cargo {
    margin: 5px 0;
}
.offshore-docked {
    margin: 8px 0 0;
    font-size: 12px;
    font-weight: bold;
    color: #315f66;
}
.bank-button {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
    margin: 7px 5px 0 0;
    padding: 8px 12px;
    min-height: 36px;
    border: 1px solid #74938e;
    border-radius: 5px;
    background: #fffdf5;
    color: #254d4b;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
}
.bank-button.primary {
    background: #315f66;
    color: white;
}
.bank-button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}
.bank-button:focus-visible,
input:focus-visible {
    outline: 3px solid #af742c;
    outline-offset: 2px;
}
.bank-button:hover:not(:disabled) {
    box-shadow: inset 0 0 0 1px currentColor;
}
.bank-decision {
    margin-top: 12px;
    padding: 14px;
    border: 2px solid #af8a48;
    border-radius: 7px;
    background: #fffae9;
}
.bank-decision p {
    font-size: 13px;
}
.bank-decision h4 {
    margin: 10px 0 5px;
    font-size: 12px;
}
.bank-decision input {
    width: 90px;
    margin: 0 10px;
    padding: 7px;
    border: 1px solid #74938e;
    border-radius: 4px;
    font: inherit;
}
.bank-choice {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin: 6px 0;
}
.bank-hint {
    color: #765a2c;
}
.bank-navigation {
    margin-top: 8px;
}
@media (max-width: 600px) {
    .offshore-bank {
        padding: 12px;
        margin: 8px 0;
    }
    .offshore-header {
        display: block;
    }
    .offshore-header p {
        margin: 5px 0;
    }
    .offshore-lots {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .offshore-lot {
        padding: 9px;
    }
    .offshore-holdings {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
</style>
