# Feature Build Workflow Card

Use this when the user asks to add capability, not merely fix broken behavior.

## Size First

Classify the feature before building:

- Small: one to three files, no new architecture, no schema, no new mode.
- Medium: four to ten files, a new UI surface, or a new connection between existing systems.
- Big: more than ten files, a new agent/mode, a new persistent data shape, or a prompt/storage pipeline change.

Say the classification out loud and let the user override it. If scope grows, stop and reclassify before continuing.

## Architecture Gate

Before nontrivial edits, scale the gate to risk:

- Tiny or mechanical: owner, impact, modes/capabilities, checks.
- Normal: owner, impact area, modes/capabilities, callers, contracts, checks.
- Risky or cross-layer: boundary path, input/output/persistence/error behavior, dependency direction, shared-code justification, forbidden shortcuts avoided, docs/skills impact.

If owner, impact, callers, or contract shape cannot be named clearly, resolve that before editing.

## Small

Restate, read the relevant code, build the smallest complete version, verify with
the cheapest proof that exercises the claim, then run the matching validation.
Use browser proof only when browser state is the claim.

## Medium

Restate, use architecture context, sketch a brief plan, build unless the user asked for planning only or the plan exposes a risky unresolved decision, verify, and report where implementation differed from the plan.

## Big

Present architecture options, get the selected direction, break the chosen approach into independently verifiable phases, build only the approved/current phase, verify, report, and stop.

## UX Risk

For UI work, classify UX risk:

- Low: tiny visual or interaction fix, no new flow, no new user decision point.
- Medium: new panel, modal, settings section, empty/error/loading state, or workflow inside an existing surface.
- High: onboarding, first-run setup, destructive action, import/export, mobile-heavy flow, or advanced feature exposed to nontechnical users.

For medium/high UX risk, define the primary user path, required states,
mobile/theme proof, and whether an Impeccable critique/polish pass is useful.
Prefer existing test output, temporary uncommitted tests or harnesses,
route/module repros, or jsdom/component proof when they cover the claim; use
scripted Playwright proof for repeatable browser-dependent UI claims; use manual
instructions when automation cannot cover the full path.

## Code Smell Guard

Before building, name the likely structural risk: bloat, repeated conditionals, shotgun surgery, disposable code, or coupling.

- If touching a known large file, explain why the change belongs there and keep the edit narrow unless a refactor is approved.
- If the same mode/type/provider/entity conditional would spread across files, choose one registry, shared contract, owner service, or change map first.
- If the feature touches four or more surfaces or crosses React/engine/shared API/Rust/docs, list the expected surfaces before editing and verify each afterward.

The final review blocks on smells that threaten correctness, maintainability, proof, data safety, security, or reviewability. Tiny isolated smells can be called out as review notes.

## Docs And Release Notes

For user-facing features, update repo-defined docs or release notes only when the repo has an appropriate source and the change belongs there. If the feature is internal-only or no repo-defined release-note source exists, report `Docs/release notes: not needed` with the reason.
