# Offshore engine/viewer contract

Opt-in `GameOptions.offshoreIsland?: boolean`; wrapper expansion ID `offshore-island`.
`G.offshoreBank` exists only when enabled. `cashLots: number[3]`, `containerLots: ContainerPiece[3][]`, `auctions: BankAuction[]`, `called`, `won`. Auction `type: 'cash' | 'containers'` describes **prize**, `lot: 0|1|2`, `bidder`, `cash` (public escrow), `containers: {container: ContainerOnStore, district: 'factory'|'warehouse'}[]` (public escrow/reserves). Money is already net of escrow. Players have optional `bankHolding: ContainerPiece[]`, `offshoreStats: {cashAuctionsWon:number;containerAuctionsWon:number}` including end-game settlements.

`ShipPosition.OffshoreBank = 'offshoreBank'`. Only free pickup immediately on arrival (or successive pickup); no stationary later-turn pickup.

Move enum names/values:

-   `CallBank = 'callBank'`: data `{type:'cash'|'containers',lot:number}`, extraData `{cash?:number,containers?:string[]}`. For container prize send cash; for cash prize send container IDs from own factory/warehouse. Minimum opening bid 1 (explicit interpretation of ambiguous rules), raise by at least1. Available data enumerates lot choices, not combinations.
-   `ReturnBankContainer = 'returnBankContainer'`: data ContainerPiece, extraData `{price:number}`. Price 1–4 factory, 2–6 warehouse. Only returned containers reprice, owner chooses one at a time.
-   `DistributeBankContainer = 'distributeBankContainer'`: data ContainerPiece, no extraData. Chooses next container to pay into deterministic next unfrozen lot, starting I; repeated until payment exhausted.
-   `SeizeBankContainer = 'seizeBankContainer'`: data ContainerPiece, no extraData. Right-hand player chooses among highest-priority source; repeat then choose distribution.
-   `LoadBankContainer = 'loadBankContainer'`: data ContainerPiece, no extraData, free repeat until capacity5. Other normal moves end arrival pickup window.

`Phase.BankDecision = 'bankDecision'`, `G.currentPlayers` is sole decision owner. `offshoreBank.decision` describes `kind:'return'|'distribute'|'seize'`, `player`, `resumePlayer`, returned `containers`, ordered-to-be-chosen `payment`, distribution `cursor`, optional `debtor`, `remaining`, `settlement`, `ending`. Use availableMoves keys to display controls. Each decision commits independently; resumePlayer's interrupted regular turn resumes after final choice. Discretionary choices are logged explicit moves. After each engine move, distribution automatically drains when all remaining payment pieces have the same color (including a single piece), in persisted payment order into cyclic unfrozen destinations. These forced effects are not synthetic moves or viewer emissions; collection and any following settlement finish before legal moves are published. Multiple colors still require explicit choices. Return pricing, seizure and loading remain explicit. Legacy saved single-piece distribution decisions still accept their advertised move. Fake previews normalize distribution but never score secret point cards.

Score breakdown remains same length: ship line includes bankHolding at $3 each. Other base scoring unchanged.

## Interpretations / unresolved physical-rule detail

By user-selected rule, empty container reward lots and $0 cash reward lots cannot receive opening bids or raises; replenished lots become eligible again, subject to normal auction restrictions. This resolves the PDF’s “any lot” ambiguity for this implementation, not as a publisher-confirmed ruling. Existing saved auctions on empty lots still settle normally (positive opening bids remain required).

For two auctions pending at game end, p18 says to resolve each, but does not specify a simultaneous-payment snapshot or which resolves first. This implementation resolves the persisted `auctions` array in order, with each payment before collection/cleanup as p14 directs. Only currently active tokens freeze lots; a cleaned-up lot can receive later payments. This is deterministic but end-resolution ordering is an explicit rules ambiguity requiring publisher clarification, not a claimed mandated tie-break. Normal turn-start resolution follows the same pay/collect/clean sequence.

`initialContainerLots` is an additional public immutable setup snapshot used to reconstruct observed cash from a stripped state with an unrelated analysis seed. It contains only the publicly seeded bank pieces, never secret cash or scoring cards.
