---
name: marinara-legacy-parity-audit
description: "Compare a Marinara Engine refactor feature, contract, schema, storage format, runtime behavior, performance path, or product surface against legacy Marinara to find regressions, parity gaps, current refactor defects, remote/embedded drift, and places where legacy still works better. Trigger keyword: parityscan. Use when any user asks for legacy parity, feature regression analysis, what remains from legacy, what refactor lost, legacy vs refactor comparison, contract/schema parity, or parity audits for Character, Persona, Lorebook, Chat, Roleplay, Game, providers, agents, tools, sprites, engine contracts, schemas, imports, exports, settings, storage, migrations, or other Marinara product areas."
---

# Marinara Legacy Parity Audit

Use this skill to compare the current Marinara Engine refactor repo with legacy Marinara for one feature, contract, schema, storage format, runtime behavior, or product area. Focus on product-important missing behavior, likely accidental regressions, current refactor defects, and legacy flows that still work better.

Activation keyword: `parityscan`.

## Path Setup

Use the current worktree as the refactor checkout unless the user gives another path.

Resolve legacy from the first available source:

1. A path provided by the user.
2. `$env:MARINARA_LEGACY_PATH`.
3. A nearby checkout named `MarinaraEngine`, `Marinara-Engine-legacy`, or `legacy-Marinara-Engine`.
4. The `main` branch of `https://github.com/Pasta-Devs/Marinara-Engine.git`, currently treated as legacy.

If no local legacy path is available and network access or cloning/fetching is blocked, ask one focused question for a usable legacy checkout path. Follow active workspace rules before creating any new checkout or persistent copy.

## Required Context

Before auditing:

1. Read the refactor repo `AGENTS.md`.
2. Load repo-local `skills/marinara-agent-workflow/SKILL.md`.
3. Use `skills/marinara-agent-workflow/references/workflows/investigate.md` unless the user explicitly wants fixes, PR work, issue filing, or another workflow lane.
4. Load `skills/marinara-architecture-guard/SKILL.md` for imports, ownership, shared API wrappers, storage, Tauri, HTTP dispatch, remote runtime, or cross-boundary concerns.
5. Load `skills/marinara-mode-separation/SKILL.md` for Chat, Roleplay, Game, prompt assembly, generation routing, scene logic, autonomous flows, or mode UI.
6. Load `skills/marinara-bugfix-discipline/SKILL.md` if editing code becomes part of the task.

Treat user-provided topic skills, local notes, GitHub issues, and PRs as optional leads. Do not require personal skills or private notes. Confirm every finding with code, runtime, or artifact evidence.

## Audit Flow

1. State the audit gate before deep comparison: target aliases, contract surface, refactor owner, legacy owner, risk level, proof target, issue/PR coverage, and included/excluded downstream consumers.
2. Search both codebases with `rg` using target terms, schema names, field names, UI labels, commands, routes, storage keys, and serialized formats.
3. Trace the full path for runtime behavior: refactor UI to engine/shared API/Tauri/Rust, and legacy UI to client/server/shared. Do not stop at a visible button when persistence, prompt assembly, generation, import/export, or asset resolution matters.
4. For contracts and storage formats, trace producers, consumers, migrations or compatibility repair, import/export, and user-visible workflows.
5. Check `docs/REFACTOR_PARITY_PIPELINE.md#known-intentional-divergences` before classifying a legacy/refactor difference as a gap.
6. Search open issues and PRs for the target when GitHub access or `gh` is available. Treat issue bodies as leads, not proof.
7. Load `references/audit-checklists.md` when the target touches CRUD, editors, import/export, runtime behavior, media, storage, performance, UX, architecture, or proof coverage.
8. Load `references/classification-guide.md` before classifying final findings.
9. Load `references/report-template.md` when drafting the final audit.

Useful starting commands:

```powershell
rg -n "<target>|<Target>|<schemaName>|<schemaField>|<ui label>|<command>|<storageKey>" src src-tauri public skills
rg -n "<target>|<Target>|<schemaName>|<schemaField>|<ui label>|<route>|<api>|<storageKey>" <legacy-root>
gh issue list --repo Pasta-Devs/Marinara-Engine --state open --search "<target terms>" --json number,title,body,labels,url
gh pr list --repo Pasta-Devs/Marinara-Engine --state open --search "<target terms>" --json number,title,body,labels,url
```

For storage or hot-path audits, also search:

```powershell
rg -n "storage_list|storage_get|storage_create|fields|fieldSelections|projection|pagination|before|list_messages|avatarPath|swipes|extra|http_dispatch|remote-runtime" src src-tauri
```

## Evidence Standard

Every finding needs evidence from both sides when possible:

- Cite refactor files with line references.
- Cite legacy files with line references.
- Mention commands or searches used when they materially support absence or presence.
- Mark absence carefully: "No matching refactor path found in searches X/Y/Z" rather than "does not exist" unless code structure proves it.
- Distinguish code-level support from app-proven behavior.
- For issue-backed leads, cite the issue or PR number, then cite confirming code or runtime evidence.
- For performance findings, include the call shape, expected payload shape, large fields involved, and whether proof is measured, reproduced, or static-only.

When line references are unavailable, include exact file paths and symbols. Do not rely only on old skill references, memory, or naming similarity.

## Output Shape

Use `references/report-template.md` for final reports. Start with the highest-severity confirmed regressions and likely-unintentional gaps. Separate legacy parity findings, legacy-better workflows, current refactor defects/risks, intentional divergences, and refactor-better areas. End with recommended next actions ordered by value and risk.

Do not open issues, edit scratch notes, or modify code unless the user asks for that next step or standing instructions require it for an out-of-scope actionable finding.
