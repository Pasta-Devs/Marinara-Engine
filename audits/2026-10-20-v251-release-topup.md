# v2.5.1 release-guide top-up - 2026-10-20

## Sources and scope

This follows [the initial catch-up](2026-10-20-release-catchup.md), merged as #7884 at `e03ff2d011880a0ef67e7e27279ae362c9333dc9`. All 44 published files from that PR were verified byte for byte. Its tracking issue #7883 is closed. The maintainer merged that PR before the later release changes arrived; a merged GitHub PR cannot be reopened, so this is the single active follow-up.

Tracking issue: [#7888](https://github.com/Pasta-Devs/Marinara-Engine/issues/7888). This translation PR must merge before [release #7885](https://github.com/Pasta-Devs/Marinara-Engine/pull/7885).

| English path | Exact source | Change |
| --- | --- | --- |
| `docs/agents/avatars.md` | `release/v2.5.1`, `f6ae88d536a0277ed2a97ac5943b38331f29bb85` | Remove the development/staging-only notices. Both agents are in Download Agents for every install under Roleplay and Game, requiring Engine 2.5.1 or newer. |
| `docs/agents/built-in-agents.md` | Same release source | Update both avatar availability rows to every install and Engine 2.5.1 or newer. |
| `docs/development/optional-agent-packages.md` | `staging`, `6659b80efc7422cb77b0cf73aa524a387222e5b6`, after #7886 | Add `runtime.persistence.updateCharacterStatus`, validation, duration limits, return value, manual-status/shared-room precedence, permission and feature detection for early API 1.341 hosts. |

The release branch advanced to `b53f6cea1551b889b97108461b0e295fcb7003c2` during this pass. Both imported guides remain byte-identical to the recorded `f6ae88d` source.

All ten documentation packs (`de`, `es`, `fr`, `hi`, `ja`, `ko`, `pl`, `pt-br`, `ru`, `zh-hans`) receive these three deltas: **30 translated guides**. Existing prose, headings, code, paths, links and unrelated compatibility rows remain intact. Per-language rules and glossaries were followed; no new terminology precedent required a glossary edit. No seasonal content was added.

The final validation snapshot consists of staging `bc09e7d385c930d5acf596e83ec887bc9a8795a7` with only the two specified guides replaced by their exact release-branch versions. No English docs changed between the API addition at `6659b80` and this final baseline. Each manifest's `sourceCommit` identifies the final staging baseline; the table above records the two forward release overrides. No single-commit English snapshot is claimed for this combined pass.

## Pi / Classic UI recovery top-up

PR #7882 merged to staging at `bc09e7d385c930d5acf596e83ec887bc9a8795a7`. The complete English catalog delta from the prior baseline adds exactly five `mari.runtimeRecovery.*` keys and changes only `omnibar.settings.mariRuntime.help`, with no removals. All six merged values match the reviewed translation source.

Updated all eleven UI packs (`ar`, `de`, `es`, `fr`, `hi`, `ja`, `ko`, `pl`, `pt-BR`, `ru`, `zh-Hans`): **55 added values and 11 changed help values**. Copy preserves three consecutive failures, recovery on the next request, switching on the next answer, and the option to retry Pi anytime. Classic follows each pack's existing displayed option label; where that label is absent, Classic remains the English fallback name. Metadata, unrelated existing values and retained stale keys are unchanged. This is the same active PR as the guide/API top-up.

## Verification

- Built all ten manifests with `build-manifest.mjs <pack> --source-commit bc09e7d385c930d5acf596e83ec887bc9a8795a7`, then ran `validate-pack.mjs <pack>` against the isolated combined English snapshot. All ten passed: **140 translated guides / 140 English guides**, valid hashes and links, no missing or orphaned guides.
- Ran the UI validator with `--write-manifest` first, then without it, against the exact merged staging canonical catalog. Both passed for all eleven UI packs with **14,826 canonical keys**. Existing stale keys remain for older versions; no English parity fill was added.
- UI content QA checks all 66 changed values against the exact English delta, NFC, key order, existing Classic labels, failure count and request/answer timing. Metadata and every unrelated existing value remain identical to the prior head.
- Mechanical content QA passed on all 30 guides: the new API bullet has the same 15 inline literals in each language; its surrounding document is unchanged; headings, links, code fences, numeric limits, NFC/LF and language-specific typography are preserved.
- Independent reviewers checked the other translator's five-language group against the exact English delta. No concrete mistranslation, omitted behavior or API-semantic error was found.
- `git diff --check` passed. No runtime, dependency, version, storage-format or Claude worktree changes are included. Full Engine builds, containers and browser suites are not rerun for this Markdown/JSON-only branch.

## Publication

The full English docs/catalog inventory was rechecked after #7882 landed: no other landed source delta remains uncovered. Recheck the two release guides if their branch moves again, and keep any further maintainer-requested top-ups in this PR until merge.

After final-head review and merge, verify published content and manifest bytes, then manually close #7888 and any other fully covered translation issue. Manual Download & Replace, in-app navigation/search and UI-pack refresh remain human verification items.

## Release 2.5.1 What's New follow-up

#7890 merged at `8ee4263f97bcfcd7e79d8493bc90b5d628734de6` with its scope limited to the staging catalog, so Professor Mari's 2.5.1 What's New strings, which exist only on the release branch, were not in it. This follow-up adds them on top of that merge.

| Source | Exact commit | What it contributes |
| --- | --- | --- |
| `staging` | `bc09e7d385c930d5acf596e83ec887bc9a8795a7` | Docs baseline and every non-release UI key. Unchanged since #7890. |
| `release/v2.5.1` | `da0819159c1399c2d20eb017a8f03ee83cc3b35d` | The 29 `ui.modals.whatsnewmodal.release251.*` keys, including the final `paragraphs.mariMore` text (change my **Runtime**, **Pi** by default, **Classic** one click away) and the new `media.avatarsMesh` caption. |

The release `en.json` equals staging's catalog plus exactly those 29 keys: no other key is added, removed or changed. Between `b53f6cea1` and `da0819159` no English docs changed, and `docs/agents/avatars.md` and `docs/agents/built-in-agents.md` keep the same blobs recorded above (`eea41ec6c`, `a5d546a33`). `docs/development/optional-agent-packages.md` is the same on both branches. The docs packs need no further translation.

All eleven UI packs (`ar`, `de`, `es`, `fr`, `hi`, `ja`, `ko`, `pl`, `pt-BR`, `ru`, `zh-Hans`) now have all 29 keys: **319 added values**; no existing value changed. Professor Mari speaks in each pack's release 2.5.0 voice. Bold labels follow each pack's own UI strings. They stay English where the pack has no translation for the label, or where its release 2.5.0 What's New kept labels English (`hi`). Arabic had no earlier What's New, so its voice follows the pack's existing Professor Mari strings.

Typed examples stay in English where the app only understands English: `"chat with Shrek"` (the Search start-chat pattern is English-only) and `"mood"` (State Editor search matches English JSON keys and shows the field as **Mood**). `"dark mode"` may use the pack's own Search suggestion (`commandCenter.try.commandDark`). The French draft had translated both typed examples; `paragraphs.search`, `paragraphs.stateEditor` and `media.stateEditor` were corrected to the working English text before commit.

No seasonal content was added.

### Follow-up verification

- `validate-pack.mjs` passes for all ten docs packs from both reference checkouts (staging `bc09e7d38` and release `da0819159`): **140 / 140** each. Rebuilding the manifests with `--source-commit bc09e7d385c930d5acf596e83ec887bc9a8795a7` changed nothing.
- `validate-packs.mjs` was run with `--write-manifest`, then without it, against the release `en.json` (**14,855 keys**), and passes. The scratch `en-merged.json` has identical keys and values but is not sorted, so the validator's canonical sort check rejects it. The packs also pass against staging's `en.json`, where the release keys are reported as stale and ignored.
- Mechanical QA on all 319 values: `<strong>` counts match English, there are no placeholders to keep, the text is NFC, and there is no NBSP, U+202F, U+3000, zero-width character, tatweel or CR. No value copies the English. Contributor names, product names, shortcuts and literals (`⌘K`, `⌘J`, `/video`, `{ }`, `[illustrate]`, `***`, `---`, `29`, `.mavatar`) are kept. Every Han character in the `zh-Hans` strings is in GB2312, so they are simplified-only. Each file round-trips through `JSON.stringify(…, null, 2)` byte for byte, and `git diff --check` passes.
