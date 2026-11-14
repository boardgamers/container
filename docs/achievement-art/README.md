# Container achievement artwork — revision 3

Issue: https://codeberg.org/boardgamers/boardgamers/issues/595

Original industrial geometric artwork for all 17 current awards. This is artwork
and asset-reference maintenance only. Engine 2.1.9 → 2.1.10; achievement manifest
revision 2 → 3; protocol remains 0.11.0. `island-fifteen` is retained; retired
`island-five` and `warehouse-six` are not restored. Definitions, descriptions,
eligibility and evaluator remain identical to canonical baseline
`99e60d5e8f4111f0435d9ea911e2431ec8ef2f7f`.

## Provenance and reproduction

All geometry was authored for this release, under the repository's MIT license.
No downloaded imagery, commercial illustrations, external icons, or font outlines
are used. The five cargo colors correspond to `ContainerColor` in
`engine/src/gamestate.ts`: orange, brown, white, darkslategray, tan. This is
original implementation artwork, not official physical-edition art.

Editable geometry: `scripts/generate-achievement-art.py` and the exported SVGs.
The renderer uses Python 3.12, CairoSVG 2.8.2 and Pillow 11.3.0. Install these in an
isolated environment, then run from the repository root:

```sh
python scripts/generate-achievement-art.py
python scripts/test-achievement-art.py
pnpm --dir engine test
pnpm --dir engine build
```

`manifest.json` provides the exact stable asset keys, SVG and PNG filenames,
SHA-256 hashes, generator hash, source baseline and provenance. PNG uploads are
256 × 256 RGBA. Contact sheets show actual-size 32/48/64px badges on light and
dark backgrounds. All forms fit the circular badge; color is supplemented by
shape and, for cargo diversity, distinct internal patterns. No text font is
required for the geometric score/holding digits.

## Semantic inventory

-   `win`: laden freighter and victory pennant.
-   `win-three-player`, `win-four-player`, `win-five-player`: exactly three/four/five
    separate company quay/offices surround the winning ship. These are company
    counters, not cargo colors. Triangle, square and pentagonal harbor layouts.
-   `debt-free-win`: ship, victory pennant and checked loan ledger.
-   `score-100`: cash and cargo-value columns in a final-account spread.
-   `score-150`: expanded industrial skyline and proceeds around the final account;
    structural progression, not simply a changed numeral.
-   `debt-free`: checked loan ledger without victory imagery.
-   `three-factories`, `four-factories`: exactly three/four sawtooth-roof factories,
    with chimneys and triangle/square production connections.
-   `three-warehouses`, `five-warehouses`: exactly three/five gable-roof depots,
    distinguished from factories, along a road or around a loading courtyard.
-   `island-fifteen`, `island-ten`: three/two rows of five cargo containers on a
    shoreline. Supporting digits denote the minimum holdings, not extra awards.
-   `island-diversity`: all five actual color identities, each with a different
    redundant pattern, on an island.
-   `full-ship`: five occupied cargo slots on a freighter hull.
-   `warehouse-five`: five occupied storage positions in one large warehouse
    cutaway, distinct from five owned warehouse buildings.

## Release gate

Source is prepared on isolated `moon/achievement-art-2026`; canonical release
remote is `git@github.com:boardgamers/container`, branch `master`. `origin` was
fetched and integrated before implementation. No additional configured mirror or
mirror publication workflow was found. No asset upload or engine activation is
part of this authoring stage. Publication requires fresh independent code and
actual image review approval from the coordinator. The exact tested package and
review logs are retained outside tracked sources; the worktree is retained.
