# Antigravity CLI qualification translation audit

Owner: SpicyMarinara, assisted by Codex. Follow-up: [#8158](https://github.com/Pasta-Devs/Marinara-Engine/issues/8158).

## Scope and source dependency

Translate `docs/development/antigravity-cli-qualification.md` into the existing `de`, `es`, `fr`, `hi`, `ja`, `ko`, `pl`, `pt-br`, `ru`, and `zh-hans` packs. The note records qualification limits; it does not implement the connection requested in #8143.

The canonical English change is [#8156](https://github.com/Pasta-Devs/Marinara-Engine/pull/8156), reviewed source `838dde1517d505e86c64fd01386176f9cb68771f`, merged into `staging` at `419158a7a55b89cdf8d915a26b27319fcab454ac`. The English note's bytes are identical in both commits; manifests use the reviewed source commit.

## Validation

- Added the single guide in all ten existing packs. Code blocks, inline-code multisets, and every link target match the exact English source, including the immutable Darwin ARM64 archive URL and SHA-512.
- Built all ten manifests and ran the pack validator from an isolated archive of the English source commit above. All ten pass with 141 guides each, 1,410 manifest entries in total.
- Verified the byte size and SHA-256 of every manifest entry. Relative to docs-i18n `2c40d752e`, existing entries remain byte-identical; each pack adds only the new guide and updates its source-commit metadata.
- Checked the leading H1, four translated section headings, all five prerequisite items, NFC normalization, LF line endings, and the absence of forbidden whitespace/control characters and full-width Latin alphanumerics. Locale-specific quote and numeral checks pass.
- `git diff --check` passes. This orphan documentation branch has no runtime packages or `pnpm check`; validation covers the translated artifacts rather than app execution.

## Review and publication status

The first local CodeRabbit review completed across all 21 changed files. It found one minor audit-status issue: the English merge completed while review was running, so the English merge gate was outdated. That gate was removed after verifying the merge and identical English bytes.

Hosted review of `39b2778d18627515705ed68eac19552a349e6eea` found two minor negation defects in the Spanish and Brazilian Portuguese experimental record. Both sentences now explicitly negate every action that the probe did not perform. A final glossary pass also aligned the Chinese provider term with the pack's established `服务商`. The three affected manifest hashes were regenerated, and all ten packs were revalidated. The focused local repair review completed across all seven changed files with zero findings; hosted re-examination is pending.

Refreshed against docs-i18n `2c40d752e89ed4673fdaf92fa8f1c33064397aaf` before publication. Raw published bytes and manifest hashes will be verified after the translation merge.

Native-reader review and an in-app language-pack download/render check remain manual verification items. Structural checks do not establish native prose review, live subscription authentication, hook execution isolation, or physical-platform compatibility.
