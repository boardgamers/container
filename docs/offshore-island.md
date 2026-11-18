# Offshore Island expansion

This optional expansion adds the **Off-Shore Bank** to Container. The platform
expansion ID is `offshore-island`; standalone engine setup uses
`{ offshoreIsland: true }`. The setting is persisted in game options so replay
uses the same rules. Missing/false means the existing classic implementation.
Existing games are not opted in automatically.

## Rules reference and scope

Reference: [Container rulebook](https://bghub.org/r/container.pdf), especially
pages 2, 11–14, and 16–18. A second public copy is the
[retailer-hosted v8 rulebook](https://gamers-hq.de/media/pdf/a6/62/28/Container_Rulebook_v8_compressed.pdf).
The requested board is shown in the
[Offshore Island discussion](https://boardgamers.space/discussions/offshore-island-expansion-avhRTKevB006WhXy).

This is an expansion to the existing online rules, not a wholesale migration to
the newer edition. Existing supply counts, base-game scoring/tiebreaking, and
classic-mode behavior are not silently replaced by the newer edition's rules.
No physical-edition artwork is copied into the viewer.

### Bank economy

-   Three cash lots start at $1/$2/$3. Three container lots start with 2/1/0
    containers drawn from three distinct colors, removed from the supply.
-   Call Bank is one action, at most once per turn. Bid cash for a container lot,
    or factory/warehouse containers for a cash lot. Bank bids are public, unlike
    delivery-auction bids.
-   Three/four players share one active bank auction. Five players may have two,
    but at most one of each type.
-   The highest bidder wins at the start of their next turn, **after** paying loan
    interest/default. Auction winnings cannot fund that turn's interest.
-   Cash committed to a bid is unavailable for other payments. Containers
    committed to a bid remain reserved against their original district's capacity.
    Outbid containers return to their original district, with owner repricing.
-   Bank payments start at lot I, cycling through the three lots and skipping
    frozen lots with active auctions. A container payer chooses the color order.
-   Interest, delivery self-buyouts, and seized containers replenish the bank.
    Building costs and loan repayments still go to the ordinary supply.
-   Won containers go into the winner's bank holding area, not directly onto their
    ship or scoring island. Sailing to the bank allows loading one's holding-area
    containers up to the ship's capacity of five.
-   No Call Bank on a turn when winning a bank auction or triggering game end.
    Pending auctions settle at game end. Bank holding-area containers score $3 each.

## Rules interpretations requiring playtest review

The implementation uses a minimum opening bank bid of **$1 or one container**.
The reference explicitly sets a +1 minimum for raises, but does not specify a
numeric opening minimum. This positive minimum is an interpretation, not a
verified publisher clarification. The explicit permission for $0 delivery bids
does not establish permission for $0 bank bids.

Bank pickup is available on arrival only. The reference provides no stationary
bank-loading action, unlike the explicit ordinary purchase action at a player's
harbor. To collect newly won cargo while already at the bank, sail to sea and
return. A publisher clarification could warrant changing this behavior later.

If two bank auctions remain at game end, they resolve in their persisted auction
order, completing each payment, collection, and cleanup before the next. Thus a
later payment may replenish a lot whose earlier auction has already settled.
The rulebook does not explicitly specify an ordering or simultaneous frozen-lot
snapshot; this deterministic interpretation also needs publisher/playtest review.

The old 10th Anniversary Investment Bank differs from the requested newer
Off-Shore Bank (for example its single auction and subsidy wording). It is not
used to override the newer bank rules.

## Viewer

The bank is part of the SVG board, using the same cargo pieces, outlined spaces,
player colors, buttons and bid calculator as the base game. The Offshore board
adds a lower bank area without shifting the classic board coordinates. On mobile,
the **Bank** navigation button brings that area into view.

Each lot separates its reward from the current bidder's token and bid. Click a
lot to offer cash or select stored cargo, then confirm the offer. During payment,
click a container below the lots; a connecting line and highlighted lot show its
fixed destination. Repricing and default choices appear beside the bank.

Each player's open-water berth has solid player-colored piers; shared piers split
evenly between adjacent colors. Won containers wait directly in the berth, without
a separate holding box or harbor token, until clicked to load on arrival. Cargo
moves beside a docked ship within the same unpartitioned berth.
Empty harbor rows stay visible, and large cargo lists are paginated. There is no
separate expansion banner or collapsible card panel.

## Developer testing

Run the existing local viewer with `pnpm --dir viewer serve`, then add
`?offshoreIsland=1` to its URL to opt into the expansion. Without that query
parameter the demo remains classic. BGS uses the expansion ID instead of the
local-demo query parameter.

The engine has focused bank rules tests, serializes between decisions to catch
persistence bugs, and plays complete seeded expansion games with bots for all
three player counts. Classic compatibility tests compare full serialized setup,
completed games, and replay against hashes captured from pre-expansion commit
`93194c8`, rather than merely checking that old games still finish.

New achievements are `offshore-win` (win an expansion game) and `offshore-trader`
(win both bank-auction types in one completed expansion game). They use manifest
revision 4; all 17 existing achievement IDs and artwork references are retained.

## Release boundary

Engine support alone does not expose a selectable expansion in BGS. A release
must include the engine and viewer together, register `offshore-island` in the
BGS game's expansion metadata, and verify a new expansion game through the
platform. Fetch `GET /api/admin/gameinfo/container/3`, preserve existing expansion
entries, and append `{ "name": "offshore-island", "label": "Offshore Island" }`
to the version-level `expansions` array via the corresponding PUT endpoint.
The platform filters unknown expansion IDs, so registration must follow a verified
compatible engine/viewer deployment; the old engine ignores expansion IDs. Do not opt an existing saved game into the expansion by editing its
options: its setup, supply, and history were created under different rules.

Before publication, run engine tests/build, viewer checks/unit/browser tests,
locale checks, and full-game/replay tests with the expansion both on and off.
Verify cash/container conservation, escrow spending and capacity, interrupted
turns, spectators' hidden-information views, and dropped-player/bot completion.
