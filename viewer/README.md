# Container viewer

From the repository root, install with `pnpm install`.

## Local development

```sh
pnpm --dir viewer serve
```

Add `?chapter=supply-chain` to open a tutorial. The other chapter IDs are
`buildings`, `selling`, `bidding`, `keep-cargo` and `scoring`.

## Build and check

```sh
pnpm --dir viewer check
pnpm --dir viewer test:tutorial
NODE_OPTIONS=--openssl-legacy-provider pnpm --dir viewer package
pnpm --dir viewer test:browser
pnpm --dir viewer test:tutorial:browser
```

Browser checks use Playwright Chromium. Set `CHROMIUM_EXECUTABLE` if using an
existing installation. `pnpm --dir viewer preview:tutorial` serves the built
viewer on port 5197.

The Vue 2 type checker needs `zod` available directly in this workspace to resolve
the protocol's schema types through pnpm's symlinks. It is a development dependency.

## Tutorials on BGS

Upload the same JS and CSS as the ordinary viewer. The `container` global exposes
both `launch` and `launchTutorial`. Chapter metadata is exported as `chapterCards`
from `src/tutorial/lessons.ts`; enter these IDs, versions, titles and descriptions
in the BGS version's Tutorial settings.

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
