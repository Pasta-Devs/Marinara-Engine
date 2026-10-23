# Antigravity CLI qualification translation audit

Owner: SpicyMarinara, assisted by Codex. Follow-up: [#8158](https://github.com/Pasta-Devs/Marinara-Engine/issues/8158).

## Scope and source dependency

Translate `docs/development/antigravity-cli-qualification.md` into the existing `de`, `es`, `fr`, `hi`, `ja`, `ko`, `pl`, `pt-br`, `ru`, and `zh-hans` packs. The note records qualification limits; it does not implement the connection requested in #8143.

The canonical English change is [#8156](https://github.com/Pasta-Devs/Marinara-Engine/pull/8156), reviewed source candidate `838dde1517d505e86c64fd01386176f9cb68771f`. Translated content and manifests are held locally until that English source lands in `staging`.

## Validation

- Added the single guide in all ten existing packs. Code blocks, inline-code multisets, and every link target match the exact English source, including the immutable Darwin ARM64 archive URL and SHA-512.
- Built all ten manifests and ran the pack validator from an isolated archive of the English source commit above. All ten pass with 141 guides each, 1,410 manifest entries in total.
- Verified the byte size and SHA-256 of every manifest entry. Relative to docs-i18n `2c40d752e`, existing entries remain byte-identical; each pack adds only the new guide and updates its source-commit metadata.
- Checked the leading H1, four translated section headings, all five prerequisite items, NFC normalization, LF line endings, and the absence of forbidden whitespace/control characters and full-width Latin alphanumerics. Locale-specific quote and numeral checks pass.
- `git diff --check` passes. This orphan documentation branch has no runtime packages or `pnpm check`; validation covers the translated artifacts rather than app execution.

## Review and publication status

Local review is pending. Content publication remains blocked on the English merge and a final refresh from docs-i18n; raw published bytes and manifest hashes will be verified after the translation merge.

Native-reader review and an in-app language-pack download/render check remain manual verification items. Structural checks do not establish native prose review, live subscription authentication, hook execution isolation, or physical-platform compatibility.
