# BGS rules page

`container-rules.en.md` is the English source of the public
[Container rules page](https://boardgamers.space/page/container/rules).
It documents the classic game and the optional Offshore Island expansion.

The CMS page key is `container:rules`. Before publishing, fetch
`GET /api/admin/page/container%3Arules/en` and compare against the source being
replaced to avoid overwriting another editor's work. Update only `content` with
`PUT` to the same endpoint; preserve visibility and other page metadata.
Verify the saved Markdown and public page after publication.

Translated CMS pages do not refresh automatically when English changes. Refresh
missing/outdated translations with `POST /api/admin/page/translate-bulk` and body
`{"pageName":"container:rules","sourceLang":"en"}`, then verify the job completes
without errors and each translated version references the current English update.
This uses BGS's existing translation service, separate from the viewer catalogs.

Commit and push the published source to `master` in the same task. A page-only
update needs no engine/viewer version bump or artifact upload.
