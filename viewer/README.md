# Container viewer

Use Node.js 24 and pnpm 11. From the repository root, install with
`pnpm install --frozen-lockfile`. The workspace explicitly permits esbuild's
required platform-binary installation script.

## Local development

```sh
pnpm --dir viewer serve
```

Add `?offshoreIsland=1` to opt into Offshore Island in the local demo. Without that query parameter the demo remains classic. The expansion panel displays public auctions, escrow and holding areas; its bid, return-price, distribution, default and loading controls follow the engine's legal moves.

Add `?chapter=supply-chain` to open a tutorial. The other chapter IDs are
`buildings`, `selling`, `bidding`, `keep-cargo`, `scoring`,
`offshore-cargo`, `offshore-cash` and `offshore-outbid`.
The last three opt into the Offshore Island expansion; the classic lessons retain their saved progress.
Chapter cards are exported for host integration. BGS tutorial metadata must be updated separately when publishing.
Add `&locale=fr` (or another supported locale) to preview a translated lesson.

## Build and check

```sh
pnpm --dir viewer check
pnpm --dir viewer test:tutorial
pnpm --dir viewer test:unit
pnpm --dir viewer build
pnpm --dir viewer package
pnpm --dir viewer test:browser
pnpm --dir viewer test:offshore:browser
pnpm --dir viewer test:tutorial:browser
```

Browser checks use Playwright Chromium. Set `CHROMIUM_EXECUTABLE` if using an
existing installation. `pnpm --dir viewer preview:tutorial` serves the built
viewer on port 5197.

The Vue 2 type checker needs `zod` available directly in this workspace to resolve
the protocol's schema types through pnpm's symlinks. It is a development dependency.

## Package compatibility

The Vue 2 viewer uses Vite for development and builds; no OpenSSL legacy
provider or Vue CLI setup is needed. `build` produces the standalone demo,
while `package` produces the classic-script UMD viewer for BGS.

Load Vue 2 before `dist/container-viewer.umd.min.js` and include
`dist/container-viewer.css` separately; the bundle does not inject CSS. The
existing `container.launch` and `container.launchTutorial` globals are retained.
Deploy the matching `container-viewer.umd.min.locale-*.js` sidecars beside the
minified entry, keeping their filenames: non-English translations are loaded
lazily as native ES modules relative to that script URL. Serve them with a
JavaScript MIME type and allow CORS when hosting assets on another origin.
English is bundled. The readable `container-viewer.umd.js` build uses its own
`container-viewer.umd.locale-*.js` sidecars. Publish/deploy JS, CSS and matching
sidecars together (do not upload only the entry bundle).

## Tutorials on BGS

Upload the same JS, CSS and locale sidecars as the ordinary viewer. The `container` global exposes
both `launch` and `launchTutorial`. Complete BGS metadata is exported as `tutorialCatalog`
from `src/tutorial/lessons.ts` (`chapterSections` and `chapterCards` are also exported).
Save that payload in the BGS version's Tutorial settings, including the `sections`
array and each chapter's `section`. The six original chapters belong to **Base game**;
the three bank chapters belong to **Offshore Island**. Preserve chapter IDs and
versions when changing grouping so existing progress stays associated with its lesson.

Lessons run the real engine locally with deterministic opponents and private
player views. The extra lesson controls make drag actions accessible on mobile.
Chapter progress survives refresh. Playback controls return to the previous step,
replay the current step or go back to the start. No live game or chat messages are sent.

## Shared accessibility preference

The viewer follows BGS's boolean `colorBlind` preference (default `false`).
Its eye icon updates the same shared preference through `update:preference`.
Shapes identify container colours across pieces, factories, value cards, trade
controls, tutorials and the journal. Player numbers match ships, boards and
island rows. No engine state or colour identifiers are changed.

Register `{ "name": "colorBlind", "label": "Color-blind mode", "type": "checkbox", "default": false }` in the BGS viewer preferences.
