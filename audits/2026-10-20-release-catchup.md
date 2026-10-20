# Release translation catch-up - 2026-10-20

## Source and scope

- Baseline English: `dcae4133750c0a982c2bc4e6efe8f940bc57b4e3`, covered by the [previous release catch-up](2026-10-19-release-catchup.md), merged in #7873.
- This pass uses English `48725a8e524864ffdc960dd5df3238761e832d7d` on Engine `staging`. The later staging merge `a3c07c3f1b9f345d4ac1240542eeaa3e047175d2` changes neither English documentation nor `en.json`, so this pass covers its English too.
- Translation branch baseline: `006a5bded` on `docs-i18n`.
- Full Markdown and canonical UI comparisons against the baseline found two changed guides, two added UI keys, and no changed or removed UI keys.
- Tracking issue: [#7883](https://github.com/Pasta-Devs/Marinara-Engine/issues/7883).

All ten documentation packs (`de`, `es`, `fr`, `hi`, `ja`, `ko`, `pl`, `pt-br`, `ru`, `zh-hans`) receive the same source changes:

| English path | Content brought up to date |
| --- | --- |
| `docs/agents/avatars.md` | Sentence moods with streaming off; Game Master face priority during voiced Game lines; character voice timing, stop/pause/chat-switch behavior and text fallback; first-clip mouth timing handover; enlargement of small sprites for a correctly sized mesh mouth. |
| `docs/development/optional-agent-packages.md` | Capability API 1.341 host runtime services, shared registries and queued persistence, connection admission and integrations, exact permissions, refusal to bundle a second stateful service, shared server library resolution and link repair, and schema/API compatibility gating. |

The twenty guide files retain code, inline API literals, paths, URLs and link targets. Each language follows its glossary and the per-language conventions in `CONTRIBUTING.md`. No new terminology precedent required a glossary change.

All eleven UI packs (`ar`, `de`, `es`, `fr`, `hi`, `ja`, `ko`, `pl`, `pt-BR`, `ru`, `zh-Hans`) gain exactly these two translated values:

- `avatars.vrm.vroidProject`
- `editor.save.dismissError`

Existing UI values and metadata are unchanged. Existing stale keys remain for compatibility with older Engine versions, as in the previous catch-up.

## Verification

- Rebuilt each documentation manifest with `build-manifest.mjs <pack> --source-commit 48725a8e524864ffdc960dd5df3238761e832d7d`, then ran `validate-pack.mjs <pack>` against an isolated copy of that exact English snapshot. All ten passed: **140 translated guides / 140 English guides**, no missing or orphaned files, valid hashes and link targets.
- Ran `scripts/ui-i18n/validate-packs.mjs <canonical-en.json> --write-manifest`, then repeated it without `--write-manifest`. Both passed.
- Checked all 31 changed guide/UI content files: fenced code matches English; heading levels/counts match; new API inline literals match byte for byte; the quoted runtime error and ten API bullets are retained; text is NFC/LF with no introduced invisible spacing or forbidden full-width Latin letters/digits. Each UI file adds only the two requested keys and no full translated value copies English.
- Independent review checked all ten languages' new prose and all eleven UI packs for omitted behavior, API semantics, permissions, compatibility and fallback rules. It found no concrete defect.
- `git diff --check` passed. No runtime code, dependency, release metadata or storage-format changes are part of this PR. Full Engine builds and containers are not rerun for this Markdown/JSON-only branch.

## UI coverage

| Pack | Current translated keys | Coverage | Retained stale keys |
| --- | --- | --- | --- |
| `ar` | 8,577 / 14,821 | 58% | 12 |
| `de` | 13,999 / 14,821 | 94% | 0 |
| `es` | 14,126 / 14,821 | 95% | 0 |
| `fr` | 14,000 / 14,821 | 94% | 3 |
| `hi` | 14,254 / 14,821 | 96% | 0 |
| `ja` | 13,977 / 14,821 | 94% | 0 |
| `ko` | 14,464 / 14,821 | 98% | 109 |
| `pl` | 14,176 / 14,821 | 96% | 3 |
| `pt-BR` | 14,087 / 14,821 | 95% | 0 |
| `ru` | 14,337 / 14,821 | 97% | 0 |
| `zh-Hans` | 14,740 / 14,821 | 99% | 84 |

## Later release top-ups

Keep the same PR open while the maintainer identifies later landed Claude changes. Recompare English documentation and new/changed UI keys, translate the delta into every relevant pack, and rebuild/revalidate the manifests.

When the `release/v2.5.1` PR is open, take `docs/agents/avatars.md` and `docs/agents/built-in-agents.md` from that branch and record its exact source commit here. Those translations must be included before this PR merges, allowing the language packs to land before the English release PR. That PR was not open at this pass's inventory time.

After merge, verify published manifest/content bytes and close #7883 and any other fully covered `[docs-i18n]` issues manually: GitHub closing keywords do not close issues from the `docs-i18n` branch.

Manual Download & Replace, UI-pack refresh, in-app search/navigation and native-reader sampling remain verification items.
