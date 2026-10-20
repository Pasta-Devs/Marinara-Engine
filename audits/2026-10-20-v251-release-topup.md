# v2.5.1 release-guide top-up - 2026-10-20

## Sources and scope

This follows [the initial catch-up](2026-10-20-release-catchup.md), merged as #7884 at `e03ff2d011880a0ef67e7e27279ae362c9333dc9`. All 44 published files from that PR were verified byte for byte. Its tracking issue #7883 is closed. The maintainer merged that PR before the later release changes arrived; a merged GitHub PR cannot be reopened, so this is the single active follow-up.

Tracking issue: [#7888](https://github.com/Pasta-Devs/Marinara-Engine/issues/7888). This translation PR must merge before [release #7885](https://github.com/Pasta-Devs/Marinara-Engine/pull/7885).

| English path | Exact source | Change |
| --- | --- | --- |
| `docs/agents/avatars.md` | `release/v2.5.1`, `f6ae88d536a0277ed2a97ac5943b38331f29bb85` | Remove the development/staging-only notices. Both agents are in Download Agents for every install under Roleplay and Game, requiring Engine 2.5.1 or newer. |
| `docs/agents/built-in-agents.md` | Same release source | Update both avatar availability rows to every install and Engine 2.5.1 or newer. |
| `docs/development/optional-agent-packages.md` | `staging`, `6659b80efc7422cb77b0cf73aa524a387222e5b6`, after #7886 | Add `runtime.persistence.updateCharacterStatus`, validation, duration limits, return value, manual-status/shared-room precedence, permission and feature detection for early API 1.341 hosts. |

The release branch advanced to `510d6eef9f8469c7472dd20e846a714fac89b1ed` during this pass. Both imported guides are byte-identical to the recorded `f6ae88d` source; the later commit only updates release notes.

All ten documentation packs (`de`, `es`, `fr`, `hi`, `ja`, `ko`, `pl`, `pt-br`, `ru`, `zh-hans`) receive these three deltas: **30 translated guides**. Existing prose, headings, code, paths, links and unrelated compatibility rows remain intact. Per-language rules and glossaries were followed; no new terminology precedent required a glossary edit. No seasonal content was added.

The validation snapshot consists of staging `6659b80` with only the two specified guides replaced by their exact release-branch versions. Each manifest's `sourceCommit` identifies that staging baseline; the table above records the two forward release overrides. No single-commit English snapshot is claimed for this combined pass.

## Verification

- Built all ten manifests with `build-manifest.mjs <pack> --source-commit 6659b80efc7422cb77b0cf73aa524a387222e5b6`, then ran `validate-pack.mjs <pack>` against the isolated combined English snapshot. All ten passed: **140 translated guides / 140 English guides**, valid hashes and links, no missing or orphaned guides.
- Ran the UI validator with `--write-manifest` first, then without it, against the staging canonical catalog. Both passed for all eleven UI packs. Staging #7886 changes no English UI keys, so the canonical count is still **14,821** and every UI pack and its manifest remain byte-identical to #7884. Existing stale keys remain for older versions.
- Mechanical content QA passed on all 30 guides: the new API bullet has the same 15 inline literals in each language; its surrounding document is unchanged; headings, links, code fences, numeric limits, NFC/LF and language-specific typography are preserved.
- Independent reviewers checked the other translator's five-language group against the exact English delta. No concrete mistranslation, omitted behavior or API-semantic error was found.
- `git diff --check` passed. No runtime, dependency, version, storage-format or Claude worktree changes are included. Full Engine builds, containers and browser suites are not rerun for this Markdown/JSON-only branch.

## Remaining release top-ups

At inventory time #7882 is still unmerged. It proposes five `mari.runtimeRecovery.*` UI keys and a change to `omnibar.settings.mariRuntime.help`; those are not claimed translated here. Keep this same active PR for the maintainer's later landed changes and recompare the complete English docs/catalog delta before merging. Recheck the two release-guide contents if the release branch moves again.

After merge, verify published content and manifest bytes, then manually close #7888 and any other fully covered translation issue. Manual Download & Replace, in-app navigation/search and UI-pack refresh remain human verification items.
