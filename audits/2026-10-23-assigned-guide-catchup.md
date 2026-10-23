# Assigned documentation catch-up, 2026-10-23

## Source and scope

Canonical English snapshot: Engine `staging` commit
`957cb117bae645e029dbeb00157b4df248053ece`.

- #8125: the three Card Theming visibility passages in
  `appearance/card-css-theming.md` now distinguish the CSS mode buttons from
  the always-present Roleplay section and its name-color switch. All eleven
  UI packs translate the two new keys, update the three changed descriptions
  and remove the five retired keys.
- #8124: `development/optional-agent-packages.md` documents capability API
  1.376, its fullscreen props, temporary state and the required exit button.
- #8106: `development/ios-pwa-safe-area.md` includes the final landscape section,
  including the later one-sided shell fix from #8128. Raw safe-area variables
  still protect controls; only the opposite shell gutter is removed.

The three guides are updated in all ten documentation packs: de, es, fr, hi,
ja, ko, pl, pt-br, ru and zh-hans. Existing English UI labels, code, paths and
link targets remain intact. The UI packs keep their partial coverage and
English fallback; unrelated stale keys are not removed in this catch-up.

## Pending source changes

The following assigned translation issues remain open because their canonical
English changes are still in unmerged contributor PRs:

| Translation issue | Source PR | Subject |
| --- | --- | --- |
| #8019 | #8018 | Shared-GPU request scheduling |
| #7994 | #7993 | Generated Videos and Video Run Interval |
| #8008 | #8007 | New scene profile, narration and opening |
| #8002 | #8001 | Roleplay videos |

These changes are not published speculatively. Translate the final merged
English sources after their contributor reviews are resolved.

## Validation

- Rebuilt every documentation manifest with the source commit above using
  `scripts/docs-i18n/build-manifest.mjs` from the matching Engine snapshot.
- All ten `scripts/docs-i18n/validate-pack.mjs` runs pass: 140 translated guides
  per language, 1,400 manifest entries in total.
- Ran `scripts/ui-i18n/validate-packs.mjs <canonical-en.json> --write-manifest`,
  then repeated without the flag. All eleven packs and their hashes pass.
  The validator reports unrelated existing stale keys, which Engine ignores.
- A focused comparison verifies that all 30 edited guides preserve existing
  fenced code and link targets, and the added sections preserve the English
  inline-code literal multisets. English fragment anchors for both new sections
  are retained, and existing API 1.50 anchors remain attached to their headings.
  All edited guide text is NFC-normalized.
- A JSON comparison verifies that each UI pack changes exactly the five
  requested added/updated keys and removes exactly the five retired keys;
  all other strings remain identical.
- `git diff --check` passes. This orphan translation branch contains no runtime
  package or `pnpm check` command; the checks above validate the shipped packs.

Human verification of translated prose and the in-app download/render path
remains separate from these structural checks. No native-reader panel review
or physical-phone run is claimed.

## Local review disposition

The first CodeRabbit pass found a misplaced existing API 1.50 fragment anchor
in three packs. The same insertion pattern was inspected in every language and
corrected in all eight packs that carry that anchor. Both new translated
sections also receive their canonical English fragment identifiers.

The suggestion to rename Hindi's per-character option was not applied: the
actual button uses `ui.chat.chatsettingsdrawer.exclusive`, whose shipped Hindi
label is "खास". The help now quotes that exact label and explicitly says its
style applies only to each character's own messages. Introducing a different
label only in the help would point to a button that does not exist. This
catch-up does not rename the established option across the interface.
