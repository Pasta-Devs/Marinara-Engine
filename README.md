# Marinara Engine — Documentation and UI language packs

This orphan branch holds the translated in-app documentation, one folder per
language code (`es/`, …), each mirroring the English `docs/` folder and file
names 1:1 with a generated `manifest.json`.

The app downloads the selected language from this branch into its data folder
(Settings → General → Documentation Language). This branch is never part of a
user install: launchers fetch only `main`/`staging`, and the installer clones a
single tag, so translations add zero checkout size.

## Updating a pack

1. Read the language's conventions in `glossaries/glossary-<lang>.md` first —
   register, terminology, typography, and UI-label rules are per-language and
   deliberate. (The `glossaries/` folder is contributor documentation only; it
   is outside every pack directory and never downloaded by the app.)
2. Edit or add files under `<lang>/`, keeping paths identical to `docs/` on
   `staging`. Translate prose, headings, and link text only — code blocks,
   paths, URLs, and link targets (including `#fragments`) stay byte-identical.
3. From an Engine checkout, run:
   - `node scripts/docs-i18n/build-manifest.mjs <path-to>/<lang> --source-commit <engine-sha>`
   - `node scripts/docs-i18n/validate-pack.mjs <path-to>/<lang>`
4. Commit content and manifest together — and if the change sets a new
   terminology or style precedent, update the glossary in the same commit.

See `CONTRIBUTING.md § Translated documentation` on `staging` for the full
rules, including the per-file English fallback that makes partial packs safe.

## UI language packs

`ui/<BCP-47>.json` contains community interface translations, separate from documentation folders.
The original eleven packs were moved from Engine; a subsequent review corrected three German spelling errors. English remains canonical on
`staging` at `packages/client/src/localization/locales/en.json`. Arabic has a UI pack even without a docs pack.
Preserve canonical filenames such as `pt-BR.json` and `zh-Hans.json`.

Engine downloads a UI pack only when the user selects its language (Settings → General → Language).
Refresh language pack updates it explicitly. Downloaded UI packs survive updates in `DATA_DIR/ui-packs`;
missing packs and missing keys fall back to English. Startup never downloads one.

After editing translations, generate and validate the shared manifest:

```bash
node scripts/ui-i18n/validate-packs.mjs /path/to/Engine/packages/client/src/localization/locales/en.json --write-manifest
node scripts/ui-i18n/validate-packs.mjs /path/to/Engine/packages/client/src/localization/locales/en.json
```

The dependency-free validator checks metadata, semantic keys, text, interpolation and rich-text tokens, reports
coverage and stale keys against the supplied English source, and verifies `ui/manifest.json` sizes/hashes.
Engine ignores stale keys; use `[ui-i18n]` follow-ups to batch catch-up work after key renames/deletions.
New languages also need their code added to Engine's `UI_LANGUAGE_CODES` registry. Existing pack corrections
only need a PR against `docs-i18n`. Do not copy English into every pack to satisfy key parity.
