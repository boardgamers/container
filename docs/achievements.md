# Container per-game achievements (review candidate)

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
| `warehouse-six`    | At least six containers in the warehouse store at completion  |

## Rules and authority

This is Container, not Gaia Project. The engine ends after two supply colors run
out, at the relevant turn/auction boundary. Settlement replaces `player.money`
with the final score, including island values, warehouse stock ($2 each), cargo
($3 each), and loan penalties ($11 each). The hook reads that settled value; it
never applies scoring a second time or mistakes it for remaining cash.

The existing wrapper ranks by score then island-container count. Achievements
use those same comparisons, but do **not** use array/seat order to break an exact
tie: tied leaders get `draw`, others `loss`, and no win achievements are granted.
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

-   BGS must call the hook with the authoritative completed serialized state, map
    zero-based seats to eligible human accounts, and reject cancelled, analysis,
    tutorial and otherwise ineligible games using platform metadata. This engine
    has no cancellation flag or account IDs. The hook additionally filters the
    engine's `isAI` and `isDropped` flags.
-   Install published protocol **0.11.0** using the committed lockfile. No local
    unpublished protocol dependency is used.
-   Coordinator review/activation is required. This branch does not upload to BGS,
    activate a manifest, bump release versions, or push to the release branch.
-   Later publication must follow `AGENTS.md` delivery requirements.

Tests play legal seeded 3/4/5-player games through completion, serialize and
replay them, check immutable/idempotent evaluation, and separately vary final
states to cover all thresholds, exact ties, the tiebreaker, eligibility and
unsupported/unfinished inputs. Synthetic boundary variations are explicitly not
presented as legal game replays.
