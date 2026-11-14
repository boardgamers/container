# Container per-game achievements

The engine wrapper exports the optional `achievementDefinitions()` and
`achievements(GameState)` hooks using the published `@boardgamers/protocol/engine`
0.11.0 types. Manifest revision is **1**. IDs are permanent; never reuse them for
another condition. Icons are omitted intentionally (platform generic fallback).

## Manifest

All conditions require a committed, completed 3–5-player game. Non-win feats do
not require a victory.

| ID                 | Condition                                                     |
| ------------------ | ------------------------------------------------------------- |
| `win`              | Sole winner after final score and island-container tiebreaker |
| `win-three-player` | Win a three-player game                                       |
| `win-four-player`  | Win a four-player game                                        |
| `win-five-player`  | Win a five-player game                                        |
| `debt-free-win`    | Win with zero outstanding loans                               |
| `score-100`        | Final score at least 100                                      |
| `score-150`        | Final score at least 150                                      |
| `debt-free`        | Zero outstanding loans at completion                          |
| `three-factories`  | Own at least three factories at completion                    |
| `four-factories`   | Own four factories (the legal maximum) at completion          |
| `three-warehouses` | Own at least three warehouses at completion                   |
| `five-warehouses`  | Own five warehouses at completion                             |
| `island-five`      | At least five containers on the island at completion          |
| `island-ten`       | At least ten containers on the island at completion           |
| `island-diversity` | All five container colors on the island at completion         |
| `full-ship`        | Five containers aboard the ship at completion                 |
| `warehouse-five`   | Five containers in the warehouse store at completion          |

## Threshold attainability audit

`warehouse-six` was an invalid review-candidate ID and is retired, not repurposed.
Its replacement is `warehouse-five`, included in revision 1 for engine 2.1.8.

| Feats                     | Legal limits checked                                                                                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three/four factories      | `BuyFactory` requires fewer than four factories and a new color; four is the cap, with five colors available.                                                                                       |
| Three/five warehouses     | `BuyWarehouse` requires fewer than five; setup supplies five warehouse pieces per seat.                                                                                                             |
| Warehouse stock five      | `BuyFromFactory` requires stock below warehouse count: one container per warehouse, hence five total.                                                                                               |
| Full ship                 | `BuyFromWarehouse` requires fewer than five cargo containers.                                                                                                                                       |
| Island five/ten/diversity | No island holding cap; auctions transfer cargo to the island. Setup supplies 12/16/20 containers of each of five colors for 3/4/5 seats. Ten holdings and five colors fit even the smallest supply. |
| Score 100/150             | Settled score, not cash; no score ceiling. Accepted bids add matching bank subsidies, and island holdings contribute to scoring. These thresholds are not constrained by a fixed cash supply.       |
| Debt-free feats           | Zero outstanding loans is legal; borrowing is optional and loans can be repaid.                                                                                                                     |
| Wins/player counts        | Supported 3/4/5-seat games; no solo threshold or solo victory inferred.                                                                                                                             |

The legal attainability regression starts from setup, buys warehouses and stock
using available moves, and completes a seeded game with five warehouse containers.
It checks capacities throughout and replays the serialized completed game to the
same awards. It does not inject final holdings or alter money/supply/phase.

## Rules and authority

This is Container, not Gaia Project. The engine ends after two supply colors run
out, at the relevant turn/auction boundary. Settlement replaces `player.money`
with the final score, including island values, warehouse stock ($2 each), cargo
($3 each), and loan penalties ($11 each). The hook reads that settled value; it
never applies scoring a second time or mistakes it for remaining cash.

The existing wrapper ranks by score then island-container count. Achievements
use those same comparisons, but do **not** use array/seat order to break an exact
tie: tied leaders get `draw`, others `loss`, and no win achievements are granted.
The existing wrapper assigns sequential rankings even for exact ties; that
separate ranking bug is intentionally not changed by these achievement hooks.
Bot and dropped seats receive no rows, but their results remain opponents'
results; filtering eligibility cannot turn a loss into a win. Player count means
original seats, including bots/drops. Singleton/unsupported games get no rows.

Island holdings come from auctions (including retaining one's own cargo), but do
not prove any particular number of auction victories or deliveries. There are no
historical shipping, auction, production or borrowing feats. In particular,
`debt-free` does not claim the player never borrowed. No log, objective card,
secret breakdown or extra evidence is exposed or required. Hooks do not mutate
inputs, and each manifest call returns a fresh object graph.

## Integration prerequisites / release boundary

-   BGS calls the hook with authoritative completed serialized state and maps
    zero-based seats to accounts. In the reviewed platform code, capture excludes
    `game.cancelled`, `game.winClaim`, and `game.soloEditedAt`, requires ended status,
    and skips already-ended games/existing evidence. Bot, dropped and quit seats
    are mapped to null and discarded; other human seats can still earn feats.
    See `apps/game-server/app/services/game-achievements.ts` (capture/extraction).
    Admin edit-data and replay routes set `soloEditedAt` even for multiplayer games.
    Container itself has no cancellation flag or account IDs; the hook additionally
    filters its `isAI` and `isDropped` flags.
-   **No blanket practice exclusion is established.** Capture does not consult
    `soloRanked` or test custom seeds, `platformRewoundAt`, `soloAnalysisAt`, unlisted
    games, or a generic tutorial/practice marker. Solo ranking policy is separate
    (`packages/models/solo-ranking.ts`), and does not establish Container eligibility.
    Platform analysis uses separate analysis records; Container tutorials run the
    engine locally in the viewer. Neither fact is a general capture-time exclusion.
    Container's `GameState` contains optional `analysisCash` (created by
    `createAnalysisScenario`), but `createAnalysis` has no durable provenance flag;
    the achievement hook does not classify practice from these states. No
    multiplayer Container exposure through those paths has been demonstrated.
    Broader practice exclusion, if required, remains a coordinator/platform policy
    prerequisite rather than a guarantee of this implementation.
-   Install published protocol **0.11.0** using the committed lockfile. No local
    unpublished protocol dependency is used.
-   Engine 2.1.8 carries the reviewed revision-1 manifest (17 achievements).
    Release authorization follows independent approval of commit `6ae62e0`.
    Publication must follow `AGENTS.md`: deliver source, dependencies, lockfile
    and version changes to canonical `master` alongside the BGS engine upload.
    Activation must verify the installed manifest and public album, without
    creating fake production games.

Tests play legal seeded 3/4/5-player games through completion, serialize and
replay them, check immutable/idempotent evaluation, and separately vary final
states to cover all thresholds, exact ties, the tiebreaker, eligibility and
unsupported/unfinished inputs. Synthetic boundary variations are explicitly not
presented as legal game replays.
