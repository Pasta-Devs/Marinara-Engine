# Game Mode rulesets and ruleset character sheets: implementation handoff

Status: in progress. Written September 18, 2026 against `staging` at `459f8b85` (v2.4.6). Slice 1 (the shared schema, the pin, the registry and Capability API 1.20) is implemented; every later slice is still a proposal. § Format decisions records where the implemented format differs from the first draft and why. It complements `game-combat-rulesets-implementation.md` (the combat handoff). Where the two differ, § Relationship to the combat handoff says so and asks for sign-off rather than quietly overriding it.

Companion file: [`ruleset-5e-2014.example.json`](ruleset-5e-2014.example.json), the first ruleset definition, the precise statement of what "the whole sheet" means, and the file the slice 1 regression validates. The authority for the format is the zod schema in `packages/shared/src/schemas/ruleset.schema.ts`.

## Why

Feature request from the author of [Marinara-RPG-Extension](https://github.com/Kenhito/Marinara-RPG-Extension), which ships sixteen tabletop systems as an overlay: Game Mode checks are locked to d20 plus Engine modifiers, the sheet is six attributes, and running another system today takes four or five per-turn agents per ruleset. They would rather run natively. Their `docs/ENGINE-CONSTRAINTS.md` is a useful requirements list; their overlay architecture is not the target.

First-party scope is **5e, pinned to SRD 5.1 (`5e-2014`)**. V20 and other systems are left to community authors through the same data format (slice 7), which is why the format must not be 5e-shaped.

## Product contract

1. A ruleset is chosen when a game is created and pinned for that game's lifetime. It is independent of Experience, combat presentation, participation and controller.
2. No ruleset pinned means `engine-legacy`: today's behaviour, byte for byte, including prompts.
3. **A ruleset never adds a model call.** Checks ride the existing dice flows. Sheet changes ride tags in the GM's own narration. Prompt context is string assembly from the sheet and the ruleset data. No ruleset uses `api.registerTool`, and none ships a per-turn agent.
4. The Engine owns rolls, modifiers, resource arithmetic and legality. The GM chooses what to check and how hard, and narrates the real result.
5. A sheet on a character card or persona is that character's **starting build** for that ruleset. A game takes a copy. Nothing in a game writes back to the library.
6. A ruleset declares its coverage and the UI shows it before the game starts. Until the combat handoff's adapter exists for a ruleset, its battles run on `engine-legacy` combat and the UI says so in plain words.

## Verified current behaviour

Read from source, not inferred from docs.

| Fact                                                                                                                                                                                                                                                                                                                                            | Where                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Checks are d20 + skill modifier + attribute modifier against a DC; natural 20 and 1 auto-resolve; skills map to attributes through a hardcoded table that falls back to INT                                                                                                                                                                     | `services/game/skill-check.service.ts`                                                                                     |
| Only the player's card is ever read for modifiers, found by persona name with a first-card fallback                                                                                                                                                                                                                                             | `skill-check-resolution.service.ts` `findPlayerCharacterCard`                                                              |
| `[skill_check:]` accepts `dice=` and `resolution="successes" threshold=`, but those paths take no sheet input and are "never audited and never rewritten"                                                                                                                                                                                       | same file; `docs/game/dice-and-skill-checks.md`                                                                            |
| At setup, party cards' `extensions.rpgStats` and the persona's `personaStats.rpgStats` are copied into `chat.metadata.gameCharacterCards[].rpgStats` with HP reset to max                                                                                                                                                                       | `routes/game.routes.ts` `loadSetupRpgContext`, `applyGameSetupPayload`                                                     |
| Edit Sheet saves to that chat-metadata copy. No write-back to the library card was found in `game.routes.ts`                                                                                                                                                                                                                                    | `GameSurface.tsx` `handleSaveCharacterSheet`                                                                               |
| `playerStats` (player only: skills, attributes, inventory) lives in the per-message game-state snapshot and follows swipes. `playerStats.attributes` is never seeded                                                                                                                                                                            | `types/game-state.ts`; comment in `skill-check-resolution.service.ts`                                                      |
| No GM tag changes sheet values. The reminder says stats and party HP "remain in their own canonical systems"                                                                                                                                                                                                                                    | `services/game/gm-prompts.ts`                                                                                              |
| Combat spell slots exist (`spellSlots`, `slotLevel`) but are supplied by encounter generation "ONLY when established"                                                                                                                                                                                                                           | `routes/encounter.routes.ts`, `combat-director.service.ts`                                                                 |
| All of combat has one model call site: the boss picks a `candidateId` from an Engine-enumerated menu                                                                                                                                                                                                                                            | `combat-boss.service.ts`                                                                                                   |
| Client slots are `conversation-surface`, `conversation-toolbar`, `chat-settings`, `spatial-workspace`, `chat-runtime`, `game-world-map`, `home-browser-tab`, `game-surface`, `roleplay-tracker`, `tracker-panel`. None reaches the character or persona editor                                                                                  | `schemas/capability-package.schema.ts`                                                                                     |
| Character `extensions` and persona stats schemas are `.passthrough()`; both importers spread `extensions` wholesale                                                                                                                                                                                                                             | `character.schema.ts`, `persona.schema.ts`, `persona-normalization.ts`, `marinara.importer.ts`, `st-character.importer.ts` |
| A community lane for declarative content already exists: a GitHub repository with one top-level `agents.json`, fetched as an archive from `github.com` or `codeload.github.com`, size-capped, previewed as a change list, digest-tracked for updates, and gated by **Allow custom Agent imports**. Single-file and folder import share the gate | `services/agents/custom-agent-repositories.service.ts`; `docs/agents/custom-agents.md` § Importing and exporting           |
| `gm-verbs.json` is the precedent for a reserved-filename declarative asset the Engine reads, validates and acts on with no package code                                                                                                                                                                                                         | `optional-agent-packages.md` § 1.16; `capability-gm-verb-runtime.service.ts`                                               |

## Relationship to the combat handoff

The combat handoff says: "Start with a closed registry of built-in, pure TypeScript adapters. Do not add a scripting language or arbitrary executable rules packages."

Proposed reading. Slice 1 is built on it, and the issue asks the maintainer to sign off on it and on the widened `RulesetRef`:

- The **closed registry** is the set of _resolution kinds_ and _derivation ops_, in Engine TypeScript. Adding a kind is an Engine PR with regressions.
- A **ruleset definition** is validated data that parameterises a kind and declares a sheet. It contains no expression strings, is never evaluated, and brings no package code.
- **Combat adapters stay Engine TypeScript**, keyed by the same ruleset id, exactly as the combat handoff describes. Data cannot sensibly express declaration order, action economy or reaction windows, and this document does not try.
- Both documents share one `RulesetRef`. This document pins it on the game; the combat handoff snapshots it onto each encounter.

This keeps the base distribution free of optional rules content, consistent with the agent-package objective, without opening an executable lane.

## Format decisions

The format must serve rulesets nobody has written yet, many of which will be drafted by an AI agent reading the 5e file as its example. Anything the 5e file happened to need became a named, general primitive, so an author never concludes that a thing "can only be done the 5e way".

- **No id is special.** The Engine never looks for `level`, `dex`, `slots` or `hp`. The proficiency bonus is whatever value `resolution.proficiency.bonus` references; it may be omitted, and tiers then use a `flat` bonus. Level tables are an ordinary `stepTable` derived value reading an ordinary field.
- **The dice are a parameter** of `dice-sum` (`{ count, sides }`), and natural results are refused unless the ruleset rolls a single die.
- **Ability modifiers are a closed op**: `floorHalfMinusTen`, `identity` (the score is the modifier) or a `stepTable`.
- **Saves are a list like skills**, not "one per ability", so a three-save system is expressible. Skills and saves may omit their ability.
- **Every skill and save may carry a free numeric bonus** on the sheet (`bonuses`), which covers rank-based systems and item bonuses without a new primitive.
- **Passive scores are not an op.** They are `sum` over `{ "const": 10 }` and `{ "skillMod": "perception" }`.
- **A list whose rows are resources declares `pools`** (name, maximum and optional recharge columns), and a rest restores them with `listPools` filtered by `recharge`. Nothing knows the word "counters".
- **Rest amounts are closed shapes**: `to` (`"max"`, `"min"` or a number) or `by` (a constant, or a fraction of the maximum with rounding and a floor). 5e's "half your hit dice, at least one" is `{ "fractionOfMax": 0.5, "round": "down", "min": 1 }`.
- **Pools may start empty** (`start: "empty"`) for stress, corruption and similar rising tracks.
- **`gm.sheetSummary`** names which fields, derived values and lists the compact prompt block shows, so the Engine does not hardcode "AC, passive Perception, prepared spells".
- **`$comment` is allowed on any object** and `$schema` at the root; both are dropped before validation. Everything else is strict: a ruleset the Engine only partly understands would silently change a game's arithmetic, so an unknown key refuses the whole file, and the refusal lists `path: message` lines an author can act on.
- **A section is declared before an item names it**, so every group in the editor has a label.
- **Derived values read only values declared above them**, which makes a cycle unrepresentable. The value that feeds the proficiency bonus, and everything above it, may not read a skill or save modifier.
- **Every label and guidance string follows the gm-verbs prompt hygiene**: one line, no control characters, no square brackets, no macro braces.
- **A package declares kind `ruleset`**, needs no permission and no entrypoint, and must declare Capability API 1.20 when it lists `ruleset.json`.

## Architecture

### The pin

```ts
type RulesetRef = {
  id: string; // bare for an official ruleset, "<owner>/<id>" or "local/<id>" for a community one
  version: number;
  packageId: string | null;
  source?: string; // where a community ruleset came from
  options: Record<string, boolean | number | string>;
};
// chat.metadata.gameRuleset?: RulesetRef   — absent means engine-legacy
```

Written once by game creation, like `gameExperienceId`. `gameRuleset` is declared on the `ChatMetadata` interface, so the GM-verb namespace derivation sees it as Engine-owned. An unknown id, or a pinned `version` newer than the installed definition, makes the game read-only-recoverable with a clear message, never silently reinterpreted. An installed definition newer than the pin is accepted, because sheets are read tolerantly against the current schema. The combat handoff's `RulesetRef` closes `id` to four built-in names; this one widens it to a string so community rulesets can exist, which is part of the sign-off asked for above.

### `ruleset.json` (Capability API 1.20)

A package lists `ruleset.json` in `contributions.assets.paths`, hash-pinned in `files[]`. Discovery is by that reserved filename, as with `gm-verbs.json`. The Engine refuses it on declared bytes above 256 KB before reading, validates it with a strict shared zod schema, and drops it with one log line if unusable. A ruleset package is useless without the seam, so it declares 1.20 and older Engines refuse the install cleanly.

Top-level shape (see the draft file): `id`, `version`, `name`, `edition`, `license`, `coverage`, `resolution`, `sheet`, `rests`, `gm`.

### Resolution kinds

`resolution.kind` is a discriminated union. Slice 2 ships one kind:

- **`dice-sum`**: roll the ruleset's dice (1d20 by default), add the ability modifier, the proficiency tier's bonus and any free bonus on the sheet, and meet or beat a DC. It supports advantage and disadvantage, and a per-roll-type policy for the extreme faces of a single die. For `5e-2014` that policy is `none` for checks and saves, which is a deliberate difference from `engine-legacy`. The first draft called this kind `d20-sum`; the dice became a parameter so a 2d6-plus-stat system does not need a kind of its own.

A second kind, **`dice-pool`** (pool size from two sheet ratings, target number, 1s cancelling, botch, exploding or doubled tens, specialties), is slice 7 and should be specified with a community author who runs those systems.

The resolver keeps every invariant the current service documents: it never throws, a roll that cannot happen writes the tag back sparse, numbers the GM invented are replaced, and the record in **Logs** is the Engine's.

### Sheet schema primitives

Closed set: `abilities`, `skills` and `saves` (each optionally naming its ability), typed `fields` (`number`, `text`, `longtext`, `boolean`, `enum`, `dice`), `derived` values (closed ops `sum`, `stepTable`, `scale`, `min`, `max` over value references), `lists` of typed columns with `maxItems`, and `live` state (`pools`, `tracks`, `text`, `conditions`). A value reference is an object with exactly one of `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod`, `saveMod`; there are no expression strings. The editor and the in-game sheet are rendered generically from this. No package client code is needed, and no editor slot.

Equipment is deliberately not a list: Game Mode already owns inventory. The sheet carries `attacks` and an entered `ac`.

### Storage: build versus live

| Part           | Contents                                                                                                      | Home                                                                                               | Rewinds with swipes          |
| -------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------- |
| Starting build | Everything the author enters                                                                                  | Card: `data.extensions.rulesetSheets[rulesetId]`. Persona: `personaStats.rulesetSheets[rulesetId]` | n/a                          |
| Game build     | Copy taken at setup; edited by Edit Sheet and level-ups                                                       | `chat.metadata.gameCharacterCards[].rulesetSheet`                                                  | No, same as `rpgStats` today |
| Live state     | Current HP, temp HP, slots left, hit dice, class counters, conditions, concentration, exhaustion, death saves | Game-state snapshot, keyed by card name                                                            | Yes                          |

Live state belongs in the snapshot because sheet commands are relative ("spend one 3rd-level slot"), and a regenerated turn must not spend twice. `game-state.storage.ts` was not read for this document; slice 5 starts by confirming whether a new snapshot field needs a `STORAGE_VERSION` bump. If the snapshot cannot take it, fall back to absolute-per-message commands and say so in the GM guidance.

Each stored sheet is `{ v, build }` and is refused above 64 KB serialized.

### GM surface

`GmPromptContext` gains the resolved ruleset. When present, `gm-prompts.ts`:

1. replaces the built-in skill-check paragraph with `gm.checkGuidance` and the difficulty ladder;
2. adds a compact sheet block per party member: ability modifiers, proficient skills and saves, passive Perception, AC, remaining resources, prepared spells by level, active conditions;
3. teaches one Engine-owned command, proposed as `[sheet: who="Name" …]`, with a closed operation set: `spend`, `restore`, `damage`, `heal`, `temp`, `condition`, `concentrate`, `rest`.

The Engine validates every operation against the live sheet. A cast with no slot left is refused, logged, and surfaced as a turn notice, never applied as a negative pool. `sheet` must join the reserved GM tag set and its parser must be swept by the verb-name regression. With no ruleset pinned, the prompt is byte-identical; prove it with `pnpm regression:prompt`.

`[skill_check:]` gains an optional `who=`. Without it the player is checked, as today. Saves are requested as `skill="Dexterity save"`, which the existing normaliser already recognises.

One-request dice placeholders gain `PROF` and the ruleset's skill ids as resolvable names, under the existing rule that an unresolvable name is refused rather than treated as zero.

### Setup, editor and in-game UI

- **Setup wizard**: a localized **Rules** choice beside, not inside, combat presentation. Default is Marinara's own rules. Each installed ruleset shows its `coverage.summary`. Party members and the persona show whether they have a sheet for the chosen ruleset; a missing sheet offers the editor or a blank default build. Generation never invents authoritative scores.
- **Setup sharing** (`game-setup-share.ts`): restore the ruleset when installed and compatible; otherwise report it and fall back to default rules, as Experience import does.
- **Character and persona editors**: under **Stats**, one collapsible subsection per installed ruleset, rendered from the schema. Sheets stored for rulesets that are not installed show as a single line with a **Remove** button.
- **In-game sheet** (`GameCharacterSheet.tsx`): when the game has a ruleset, render the ruleset sheet with live pools, a rest control, and hit-dice spending. Level-up is manual in v1: the player edits the build and derived values recompute.

### Import and export

Nothing needs to be added for sheets to travel: `extensions` and persona stats already pass through every importer and schema. The rule is **keep dormant, never drop**: a sheet for a ruleset the importer lacks is kept under its key, hidden from prompts, shown as one removable line, size-capped at import, and validated against the ruleset's schema only when that ruleset is first installed and used. Dropping would silently destroy the sheet for anyone who installs the ruleset later and for everyone downstream of a re-export.

Not yet verified: that the Compatible JSON and PNG exporters leave unknown extension keys alone. Check before documenting the behaviour.

## What the `5e-2014` sheet covers

| Tier                             | Meaning                                      | Contents                                                                                                                                                                                                              |
| -------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Engine computes with it       | Authoritative arithmetic                     | Six ability scores, level, proficiency bonus, skill proficiency tier (none, half, proficient, expertise), save proficiencies, spellcasting ability, spell save DC, spell attack bonus, passive Perception, initiative |
| B. Engine tracks the number      | Enforced bookkeeping, no fiction adjudicated | HP and temp HP, hit dice, spell slots 1st–9th, Pact Magic slots, named class counters with short or long recharge, death saves, exhaustion, the fourteen SRD conditions, concentration, short and long rests          |
| C. Engine stores it, GM reads it | Structured lists                             | Spells (level, prepared, ritual, concentration, notes), attacks, features and traits, other proficiencies and languages, class, subclass, race, background, alignment, XP                                             |

Deliberately out of v1: class and subclass tables (slot maxima and HP are entered, not derived), multiclass slot calculation, a structured spell compendium, armour-derived AC, automated level-up, enemy and NPC sheets, attack rolls and critical hits (combat adapter), tool checks.

Spells are tier C on purpose. Out of combat the GM adjudicates the effect; the Engine guarantees the spell is on the sheet and the slot is really spent. The combat adapter later gives a small supported spell list mechanical definitions, and at that point battle slots come from the sheet instead of from encounter generation.

## The package

`packages/ruleset-5e-2014/` in Marinara-Agents: `manifest.json` (schema 2, API 1.20, `contributions.assets.paths: ["ruleset.json"]`), `ruleset.json`, `locales/en.json`, `README.md`, `CHANGELOG.md`, and the SRD attribution. No server entrypoint, no client entrypoint, no LLM agent. Slice 1 confirmed that `capabilityPackageManifestSchema` accepts a package with empty `entrypoints`, so no Engine schema change and no dummy agent is needed. The Marinara-Agents catalog validator still requires `entrypoints.agents` for every catalogued package, which slice 6 has to relax for kind `ruleset`.

Display name "5e (SRD 5.1)". Do not use Wizards of the Coast trademarks in the name, description or artwork. Copy the attribution statement verbatim from the SRD 5.1 PDF. List the id in `INCOMPLETE_PACKAGE_IDS`, then `STAGING_ONLY_PACKAGE_IDS`.

No rules lorebook in v1. The guidance block plus the sheet block is enough for capable models, and a CC-BY SRD lorebook already exists in the community for anyone who wants one attached.

## Authoring and sharing a community ruleset

**Authoring.** An author writes one `ruleset.json`, starting from the 5e file. They choose a resolution kind the Engine supports, declare the sheet, the rests and the GM guidance, and validate against a JSON Schema generated from the shared zod schema and published with the docs, plus a small validator script. A sheet hand-entered through **Edit Spoilers** is enough to test a check before any editor UI exists.

**The ceiling.** Data can only parameterise a kind that exists. A mechanic no kind expresses (exploding dice, roll-under percentile, degrees of success, a Fate ladder) is an Engine PR adding a kind with regressions, not something a ruleset file can do. That is the cost of having no scripting language, and the authoring docs must say it first, not last. Community authors who already implement these mechanics are the right people to contribute the kinds, and their existing cases are ready-made regressions.

**Sharing, three lanes.**

| Lane              | How                                                                                                                                                                            | Fits                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Official catalog  | PR a package to Marinara-Agents; one-click install from **Download Agents**                                                                                                    | Widely played systems with clean licensing                                             |
| Custom repository | The existing custom agent repository lane also reads `rulesets/*.json`. A user adds the author's GitHub URL once, reviews the preview, and receives later updates the same way | An author with several systems; the requester's repository is already shaped like this |
| Single file       | **Import ruleset** accepts one `ruleset.json`                                                                                                                                  | Iterating locally, or handing a file to a friend                                       |

All community lanes sit behind **Allow custom Agent imports**. Nothing executes, but `gm.*` text reaches the GM prompt, so the import review says so and treats a ruleset with the same trust as an imported agent prompt or lorebook.

**Rules that make sharing safe.**

- Official ids are bare (`5e-2014`). Community ids are namespaced by source (`<owner>/<id>` for a repository, `local/<id>` for a file), so two authors' `v20` never collide and nothing can shadow an official ruleset.
- Definitions are stored by id and version. An update adds a version and never rewrites one. A game keeps resolving the version it pinned; the same version arriving with different bytes is refused with a message telling the author to bump it.
- A sheet is read tolerantly against its ruleset's current schema: unknown fields are kept, missing fields take defaults, out-of-range values are clamped on edit, never on read. There are no migration scripts.
- A community `RulesetRef` carries its source URL. A shared setup file or a dormant sheet can therefore tell the recipient where the missing ruleset came from, instead of only that it is missing.

Characters travel on their own. A card exported with a community sheet keeps it, a recipient without that ruleset keeps it dormant, and it becomes live the moment they add the author's repository.

## Slices and exit evidence

Each slice is one PR against `staging`, with a draft PR opened when work starts, a `CHANGELOG.md` `[Unreleased]` entry, localized copy, docs, a `[docs-i18n]` follow-up, and unchecked manual-verification boxes. Proofs are `*.regression.ts`; no `.test.ts` stays in the tree.

| #   | Repo            | Work                                                                                                                                                                | Smallest useful proof                                                                                                                                                                                                                                                                                     |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | —               | Open the issue (Appendix) and get sign-off on § Relationship                                                                                                        | Maintainer reply on the issue                                                                                                                                                                                                                                                                             |
| 1   | Engine + Agents | Shared zod schema and types, `RulesetRef`, ruleset registry reading `ruleset.json` from installed packages, package skeleton marked incomplete. No behaviour change | Draft file validates; unknown kind, unknown key, oversized file and duplicate id are refused with a log line; a game with no pin resolves `engine-legacy`                                                                                                                                                 |
| 2   | Engine          | `dice-sum` resolver wired into `skill-check-resolution.service.ts`; GM reminder swap; `who=`                                                                        | Proficiency, expertise, half proficiency, save proficiency, level boundaries 4→5 and 16→17, advantage, natural 20 below DC fails and natural 1 above DC passes; legacy chat byte-identical in prompt and result. Manual: hand-enter a sheet through **Edit Spoilers** JSON and watch a real banner        |
| 3   | Engine          | Sheets on cards and personas: storage, generic Stats subsection, dormant handling, size cap                                                                         | Round-trip through Marinara Native export and import with and without the package installed; persona normalization keeps the key; light, dark and 400 px screenshots                                                                                                                                      |
| 4   | Engine          | Rules choice in the setup wizard, missing-sheet handling, copy-at-setup, setup sharing                                                                              | New game copies the build; library card unchanged after in-game edits; setup import without the package falls back with an explanation                                                                                                                                                                    |
| 5   | Engine          | In-game ruleset sheet, live state, `[sheet:]` command, rests, reserved-tag sweep                                                                                    | Spend then swipe restores the slot; regenerate does not double-spend; cast with no slot is refused with a visible notice; long rest restores half hit dice with a minimum of one; verb named `sheet` is refused                                                                                           |
| 6   | Agents          | Finish and stage the package                                                                                                                                        | `validate-catalog.mjs` green; install, update and uninstall on a staging Engine; a game whose package was uninstalled opens read-only-recoverable                                                                                                                                                         |
| 7a  | Engine          | Community lanes: **Import ruleset** for one file, and `rulesets/*.json` read by the existing custom agent repository lane                                           | A namespaced id cannot shadow an official one; the preview lists added, changed and removed rulesets; same version with different bytes is refused; a game keeps its pinned version after an update; turning the import toggle off hides community rulesets from new games without breaking existing ones |
| 7b  | Engine          | `dice-pool` resolution kind                                                                                                                                         | Specified with, and ideally contributed by, a community author who already runs pool systems; their existing cases become the regressions                                                                                                                                                                 |
| —   | Engine          | `5e-2014` combat adapter                                                                                                                                            | Combat handoff slice 5, after its slices 1–4                                                                                                                                                                                                                                                              |

Slices 1 and 2 come first because they are testable end to end with no UI at all, which is the cheapest way to find out the schema is wrong.

Slice 7a depends only on slice 1, and 7b only on slice 2. Neither should wait for 3–6: the request came from a community author, and under a strictly numbered order they would be the last person served. Run 7a and 7b in parallel with the sheet UI once slice 2 has merged.

## Open decisions, with defaults

1. **Companions without a sheet.** Default: blank build plus manual entry. An optional "suggest a sheet from this card" action that the user reviews and accepts is a reasonable later addition and stays consistent with "generation does not manufacture authoritative stats", because acceptance is the user's act.
2. **XP or milestones.** Default: the sheet stores XP, nothing awards it automatically, and level is edited by hand.
3. **Command tag name.** `[sheet:]` is a proposal; any name works provided it joins the reserved set.
4. **Who builds `dice-pool`.** Default: invite the requester to specify it on the issue, and to contribute it if they want to. They have a working implementation and the systems knowledge; the Engine side supplies the seam and review.

## Not verified for this document

`game-state.storage.ts` and whether a snapshot field needs a storage-version bump; the Compatible JSON and PNG export paths; `GameSetupWizard.tsx` and where the Experiences block writes `gameExperienceId`; `game-setup-share.ts`; how the custom agent repository lane surfaces in the client, and whether its archive reader tolerates extra top-level folders; the sighted dice pool's interaction with a ruleset resolver; `game-combat-ai-design.md`.

## Appendix: issue draft

> **Game Mode: selectable rulesets and ruleset character sheets (5e first)**
>
> Requested by the author of Marinara-RPG-Extension, who currently needs four or five per-turn agents per system to work around d20-only checks and the six-attribute sheet. Proposal: a ruleset is validated data (`ruleset.json`, a reserved-filename package asset like `gm-verbs.json`) that parameterises a closed, Engine-owned set of resolution kinds and declares a full character sheet. No package code, no expression strings, and no added model calls. Sheets live on cards and personas as starting builds and are copied into each game.
>
> This reads the combat handoff's "closed registry of built-in adapters" as applying to resolution kinds and combat adapters, with ruleset definitions as data. Is that acceptable, and is anyone working on something adjacent? First-party scope is `5e-2014` on SRD 5.1. Combat is unchanged and stays with the combat handoff. Full plan: `docs/development/game-rulesets-and-sheets-implementation.md`.
