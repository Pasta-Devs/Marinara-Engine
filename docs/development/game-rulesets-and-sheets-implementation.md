# Game Mode rulesets and ruleset character sheets: implementation handoff

Status: in progress. Written September 18, 2026 against `staging` at `459f8b85` (v2.4.6). Slice 1 (the shared schema, the pin, the registry and Capability API 1.20) slice 2 (the `dice-sum` resolver, `who=`, and the Game Master reminder swap) slice 3 (sheets on cards and personas) slice 4 (the Rules choice, the pin at creation, copy-at-setup and setup sharing) slice 5 (the in-game sheet, live state and the `[sheet:]` command) slice 7a (the community lanes) slice 8a (the catalog format, its route and Capability API 1.21) the combat bridge (the `battle` block, the shared helpers and Capability API 1.22) slice 8c (scaled catalog values, the `use` command, Refresh from ruleset and Capability API 1.23) slice 7b (the `dice-pool` resolution kind, the `with=`, `threshold=` and `bonus=` tag attributes and Capability API 1.24) layers L1 (variants a ruleset ships in its own file, the wizard's layer toggles, the `gm.worldGuidance` slot and Capability API 1.25) and real ruleset combat C1 (the `combat` block, the pure resolver, the mechanics additions and Capability API 1.26) C2 (bestiaries, creature actions and the threat clamp, Capability API 1.27) C3a (the combat director that resolves a fight on the server's own ledger) C3b (that fight played on screen in the ruleset's own words) C4a (positions, reach and range, areas, cover and opportunity strikes, Capability API 1.28) C4b (the fight drawn on the battlefield) and C5a (what one turn can do: a second damage clause, several strikes for one budget, abilities that change the economy, riders, the new condition effects and Capability API 1.29) are implemented, client half included where there is one; the slices after C5a are still proposals. § Format decisions records where the implemented format differs from the first draft and why. It complements `game-combat-rulesets-implementation.md` (the combat handoff). Where the two differ, § Relationship to the combat handoff says so and asks for sign-off rather than quietly overriding it.

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

**The combat bridge and this boundary.** The bridge (§ What the combat bridge settled) sits underneath that reading rather than beside it. It adds no resolution: it moves numbers across the seam between the sheet and the Engine's existing combat model, in both directions, for a ruleset that opts in with a `battle` block. It applies no attack roll, no saving throw and no concentration, and it changes no damage arithmetic, so it makes no claim to implement any system's combat. It is generic, so it serves a community 2d6 system on the day it lands and not only 5e. It is also explicitly superseded per ruleset: the day a real combat adapter for a ruleset exists, that adapter owns the fight and the bridge steps aside for it. The PR asks the maintainer to sign this off, because the boundary it comes closest to is the combat handoff's, not this document's.

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

## What slice 2 settled

- **The resolver sits behind the existing context.** `SkillCheckModifierContext` gains an optional `ruleset`. Every caller already goes through `resolveSkillCheckWithContext`, so the endpoint, generation post-processing, one-request dice and the sighted pool all reach the ruleset without new call sites.
- **Finished-looking tags are audited against the sheet.** Under `engine-legacy` a complete tag with tidy arithmetic is accepted as it stands: no context is loaded for it, it is not audited against any sheet, and it is not rolled again. In a ruleset game the generate route passes a `rulesetPinned` hint, the context is loaded for those tags too, and a modifier, die count or natural result the ruleset would not have produced sends the tag back to be rolled. The hint exists so a legacy game still never loads the context for a finished tag.
- **A pin the install cannot honour fails closed.** Loading the context throws, and the tag driver's existing failure path saves the checks sparse, still owing a roll.
- **`who=` rides the result.** `SkillCheckResult.who` is set only by the ruleset resolver, and the serializer writes it, so legacy records keep their bytes.
- **A stranger rolls unmodified dice.** A `who=` that matches no party card, or that two cards share, gets no modifier at all, because a ruleset's defaults are not neutral in every system. A party member (or the player) without a sheet rolls on the ruleset's blank default build, which is what setup copies for them. A skill name the ruleset does not know adds nothing either. Nothing falls back to a guessed ability. The player's own card keeps a name it shares with a party member.
- **The injected d20 and a player's pre-rolled d20 are honoured only where a single d20 is what the ruleset rolls.** Other dice come from the Engine's fair die.
- **The endpoint's difficulty cap stays at 40** (marked `ponytail:`); generation post-processing honours a wider ladder.
- **The sheet block and the sheet command are slice 5**, with live state. Slice 2 swaps only the check lines of the reminder, and drops the line that teaches other dice notations, because a ruleset game has one rules system.

## What slice 3 settled

- **The storage boundary is bounded, never shape-checked.** `rulesetSheets` is declared on the character extensions and persona stats schemas as a record whose keys must be ruleset ids and whose values must be objects of at most 64 KB, at most 32 of them. The sheet's shape is not validated there, because the ruleset may not be installed. An update that breaks a bound is refused with a message.
- **Importers cap, they do not refuse.** `capImportedRulesetSheets` drops only a sheet the boundary would refuse, so one bad sheet never costs an import the card. It runs in the native character importer, the SillyTavern importer, and inside `normalizePersonaStats`, which is also the persona read path.
- **The editor is one generic component** (`RulesetSheetEditor`) rendered from the definition, mounted by `RulesetSheetsSection` in both **Stats** tabs. Installed rulesets come from `GET /api/capability-packages/rulesets`, keyed under the capability package query keys so an install or removal refreshes it.
- **Values are clamped when edited, never when read**, and a stored proficiency tier the ruleset no longer offers still shows as what it is.
- **Nothing is called dormant until the installed list has loaded**, so a slow request never shows a live sheet as missing.

## What slice 4 settled

- **The server builds the pin.** The wizard sends a `ruleset` in `GameSetupConfig`, but only its `id` is trusted: `POST /game/create` rebuilds the `RulesetRef` from its own registry and writes it to both `gameSetupConfig.ruleset` and `chat.metadata.gameRuleset`. A ruleset that is not installed is refused with `ruleset_not_installed`, never swapped for other rules.
- **A game with no ruleset gains no key.** `gameRuleset` is written only when a ruleset was chosen, so legacy metadata keeps its bytes.
- **Copy-at-setup lives in one place.** `applyGameSetupPayload` loads the party's and the persona's stored sheets itself, so both setup entry points (`/game/setup` and `/game/setup/apply-json`) copy the same way. Cards are matched by normalized name, as `rpgStats` already is, and the persona wins a name it shares with a party member. A member with no stored sheet gets a blank default build.
- **Setup sharing follows the Experience rule.** A shared ruleset is restored for a new game when this install has it at the shared version or newer, and dropped otherwise; the wizard then names the missing ruleset from the file's `rulesetName` label. The pin inside a shared file is untrusted input and is read through `rulesetRefSchema`.
- **The Rules block is its own component** (`GameSetupRulesChooser`), placed beside Combat Preference, rendered only for a new game with at least one ruleset installed.

## What slice 5 settled

- **Live state is its own snapshot column.** `game_state_snapshots.ruleset_live` holds `RulesetLiveStates`, keyed by normalized card name. A new column on the file-backed store needs no `STORAGE_VERSION` bump: an old row reads the column as null, and null means every pool at its default. It is not a key inside `playerStats`, because several trackers rebuild that object from the fields they know.
- **Live state is sparse.** Only values that were set are stored, and a value back at its default is dropped again. An untouched "full" pool therefore follows its maximum when a level-up raises it, and a character with nothing spent has no entry at all.
- **A turn is measured against the state it started with.** `[sheet:]` commands are applied after every rewrite of the reply and before it is saved, on top of the live state of the row the turn follows (for a continuation, the row the continued message already has). A regenerated turn resolves its base from the messages before it, so it cannot spend twice, and each swipe keeps the state it ended with.
- **Every saved turn of a ruleset game writes its row**, changed or not, so the next turn, a swipe and a new session always have a row to start from. A tracker that later rebuilds the same message and swipe keeps the live state: `create` carries it over from the row it replaces unless the caller passes one.
- **The command is the Engine's, the names are the ruleset's.** The grammar (`spend`, `restore`, `damage`, `temp`, `track`, `condition`, `note`, `rest`, with `heal` read as `restore`) is the same for every ruleset. `concentrate` from the first proposal became the general `note`, because "concentration" is one system's word. Pool, track, condition, note and rest names come from the ruleset and are matched by id or label.
- **The saved reply is the record.** Each command is rewritten in place with `result="ok" now="…"` or `result="refused" reason="…"`. A result the model writes itself is ignored. A refused command changes nothing and is logged; the client says so once per turn.
- **Sheets reach the Game Master late in the prompt.** The sheet blocks and the command lines are part of the per-turn format reminder, never the system prompt, because live state changes every turn and the system prompt is what a provider caches. With no ruleset the reminder is byte-identical.
- **The player edits through the same rules.** The in-game sheet applies `applyRulesetSheetOp` for every button and saves through `PATCH /chats/:id/game-state`, which bounds live state (`rulesetLiveStatesSchema`) and judges nothing else: it is the player's own game.
- **`sheet` is reserved.** A package verb with that name is refused, and the verb-name sweep finds the taught tag in the reminder.
- **Not done here:** party members' own turns (`/party-turn`) do not apply sheet commands; only the Game Master's reply does.

## What slice 7a settled

- **Storage.** Community rulesets live in a new file-backed table, `game_rulesets`, one row per namespaced id and version, holding the exact imported text and its sha256. No storage format bump. The table has no owner and no cascade: removing the repository that supplied a ruleset only clears `repositoryId`.
- **Ids.** The file always carries its bare id. The Engine files it as `local/<id>` for a picked file and `<owner>/<id>` (GitHub owner, lower-cased) for a repository, and the registry rewrites `definition.id` to that namespaced id, so sheets, pins and the wizard all key on it. A GitHub account named `local` is refused, so nobody can file rulesets among the user's own.
- **Versions.** A stored version is never rewritten. The same bytes are a no-op, different bytes under an existing version are refused (`RulesetVersionConflictError`) with a message telling the author to raise the version. A community pin resolves the exact version it names (`version-missing` when it is gone); official packages keep the "installed is at least the pinned version" rule.
- **Gating.** Single-file import needs privileged access and **Allow custom Agent imports**. The repository lane keeps its own env flag on top. With imports off, `/game/create` refuses a community ruleset (`ruleset_imports_disabled`) and the wizard leaves them out, but resolution never consults the policy, so existing games keep working. Removal needs privileged access only, so it still works with imports off.
- **Removal.** `DELETE /api/game-rulesets?rulesetId=` removes every stored version. When games pin the ruleset it answers 409 `ruleset_in_use` with the count, and the client asks again before retrying with `force=true`.
- **Review.** No capability checkboxes, because a ruleset has none. The review shows identity, license, coverage, how checks roll, and the Game Master text verbatim, and says that text is sent to the model.
- **Repository lane.** `<top>/rulesets/*.json`, direct children only, at most 32 files of `RULESET_MAX_BYTES`. A repository may carry agents, rulesets, or both. One unusable file is a preview row with its reasons, never a failed repository. A ruleset withdrawn upstream stays installed.
- **Authoring.** `docs/extending/writing-rulesets.md` leads with the ceiling. `docs/extending/ruleset.schema.json` is generated from the zod schema by `pnpm ruleset:schema`, and a regression fails when it is stale. The guide ships one example per resolution kind, neither of them d20-shaped: Ember Roads rolls 2d6 and Gravewatch throws a ten-sided pool. Both are validated by a regression, which also checks that the published schema carries a member for every kind.

## What slice 8a settled

- **The header is in the ruleset, the entries may not be.** `ruleset.json` gains an optional `catalogs` array (at most 12). Each header carries `id`, `label`, the sheet lists it `feeds` (1 to 8), declared `filters`, optional `units`, and exactly one of `entries` (inline) or `asset`. The key is absent rather than empty when a ruleset ships none, so a file written before catalogs existed still parses to the same bytes.
- **The asset path is derived, never chosen.** `asset` must equal `catalogs/<the catalog's id>.json`, so the route finds the file from the ruleset alone and no catalog can name another one's file.
- **One helper decides what a list can hold.** `rulesetListRowIssues(list, values)` is exported from the shared package and is the single answer to "could this row be stored": the schema runs it over every inline entry, `parseRulesetCatalogFile` runs it over an asset's entries at read time, and the client runs it again over the rows a player picked. A catalog therefore cannot write something the editor would then refuse. `rulesetCatalogEntryIssues(definition, catalog, entries)` is the shared wrapper both validation paths call.
- **Copy at pick, like copy at setup.** `rowsFromCatalogEntry` returns the rows with one reserved key, `RULESET_CATALOG_ROW_KEY = "_catalog"`, holding `<catalogId>/<entryId>`. Column ids must start with a letter, so it can never collide with one. The rows are copies: the player edits them, the sheet stays readable while its ruleset is uninstalled, and a new ruleset version never rewrites a character.
- **Caps.** 12 catalogs per ruleset, 8 feeds and 8 filters per catalog, 2000 entries per catalog inline or asset, 6 rows per entry, and `RULESET_CATALOG_MAX_BYTES = 1 MB` per asset, checked against the manifest's declared `files[].bytes` before the file is read.
- **The list stays small.** `GET /api/capability-packages/rulesets` strips inline `entries` and reports `entryCount` instead, because the list is read whenever a sheet editor opens. A ruleset without catalogs is listed byte for byte as before. `GET /api/capability-packages/rulesets/catalog?rulesetId=&catalogId=&version=` serves one catalog: inline entries, or the parsed and validated asset. It has no privileged gate, for the same reason `/rulesets` has none, and it is registered ahead of the `/:id/...` routes so a package id cannot shadow it. An unknown ruleset, version or catalog is a 404 with a code; an asset the Engine will not read is a 422 with the author's own issue lines.
- **Capability API 1.21, with two halves.** Declaring a `catalogs/<id>.json` asset requires 1.21 and the `ruleset.json` beside it. Catalogs also live INSIDE the ruleset file, which the manifest cannot show, so install reads the verified bytes and refuses a `catalogs` key under a lower declaration. An unparseable ruleset does not fail the install: that stays the registry's report, with a log line.
- **`mechanics` is validated, and partly consumed.** The optional block (kind, range, area, targets, friendly fire, amount, damage type, attack roll, save, cost, per-cost step, concentration, reaction) is a closed strict vocabulary so a typo surfaces now rather than when something finally reads it. Slice 8a only validated it and showed one compact line in the picker. The combat bridge consumes kind, range, area, friendly fire, amount, damage type, cost and reaction (to leave reaction entries out). Attack roll, save, concentration and per-cost step are still read by nothing.
- **Known ceiling: community catalogs are inline only.** A ruleset imported as a single file, or received from a GitHub repository, carries its catalogs inside the one file, and therefore inside the existing 256 KB cap. Separate catalog files for community rulesets (`rulesets/<id>/catalogs/*.json`) were left out on purpose: the repository lane reads direct children of `rulesets/` only, and the single-file lane has one file by definition. A community author with a list too long for 256 KB publishes a package instead. If that becomes a real limit, it is its own slice.
- **The proof is a second non-d20 ruleset.** `docs/examples/rulesets/ember-roads.json` grew a `knacks` list, a `tricks` list whose rows are pools, and a catalog feeding both, with an entry that writes two rows and entries carrying `mechanics`. Nothing in the format is 5e-shaped, and the regressions read that file rather than the 5e one.

## What the combat bridge settled

- **A ruleset opts in, and silence changes nothing.** `ruleset.json` gains an optional `battle` block: `health` (required, the live pool that is hit points), optional `energy` (the pool that becomes MP), optional `slots` (pools with a level from 1 to 9), and optional `skills` (up to eight sheet lists, each with an optional `onlyWhen` boolean column and an optional `alwaysWhen: { column, equals }` exception). With no block, a battle is byte for byte the battle it was before. Capability API 1.22, gated at install the way `catalogs` is, because the block lives inside the ruleset file and not in the manifest.
- **Every name points at a declared live pool.** A list whose rows are pools cannot be hit points: a row pool is keyed by the row's name and comes and goes as the sheet is edited. Health and energy differ, slot pools are unique, levels are unique, lists exist, `onlyWhen` is a boolean column and `alwaysWhen.column` is a column of the same list.
- **The bridge is three pure shared helpers**, in `packages/shared/src/features/rulesets/combat-bridge.ts`: `seedCombatantFromSheet`, `combatSkillsFromSheet` and `sheetOpsFromCombatResult` plus `applyCombatResultToLive`, over the one conversion `carryHealthShare` that both directions of health go through. No I/O, no throwing, no server route. The client calls them either side of the one seam all three battle UIs share.
- **Hit points are carried as a SHARE of the maximum, both ways.** Found by the first browser pass: the Engine builds a level 1 combatant with around 60 hit points and deals 11 to 15 damage a hit, while an Ember Roads character has 9 Grit and a level 1 5e wizard has 8 hit points. The damage arithmetic is the Engine's and stays the Engine's, so lending raw sheet numbers killed a bridged character with the first blow of every fight. The combatant keeps the Engine's own `maxHp` and starts at the same share of it the sheet's health pool is at; the write-back reads the final share back onto the sheet's scale and writes the difference. Energy and slots stay absolute: they are small counts, their costs come off the same sheet, and the Engine spends them one at a time. The toast, `docs/game/combat.md` and the ruleset guide all say that the numbers in battle are Marinara's.
- **A share never moves a sheet by itself.** A fight that did not move the combatant's hit points writes no health operation at all, so the two roundings cannot drift a sheet by a point. Above zero never converts to below one in either direction, so nobody is rounded out of a fight or off a sheet.
- **Zero hit points is the real number.** A member whose health pool is empty starts the fight down, which is the state a member knocked out inside a fight is already in. Clamping to 1 would invent health the sheet does not have. A party that is entirely down ends the fight in an immediate defeat, which is the honest outcome. The same holds in reverse: a combatant at zero writes the sheet to zero.
- **Only catalog-marked rows become skills.** A row typed by hand has no `mechanics` behind it, so there is nothing to turn into numbers. A cost on a pool the Engine cannot spend (hit points, a pool group, a class resource) takes the skill away rather than making it free. `utility` and reaction entries are left out.
- **`power` is calibrated, not computed.** It is a multiplier on the fighter's attack, so the bridge divides the average amount by 7 and clamps to 0.5 to 3: a basic weapon then lands where the Engine's own basic skills sit (1.35 for an attack, 1.15 for a heal) and a third-level area spell reaches the ceiling a generated skill is already clamped to. A bigger die pool never yields a smaller multiplier.
- **Write-back goes through the sheet's own rules.** Each delta becomes a `damage`, `restore` or `spend` operation applied with `applyRulesetSheetOp`, so a battle can never write something the sheet would refuse from the Game Master or from the player. The write-back is not all or nothing: a refused operation is skipped and returned to the caller, and the operations that were accepted stay applied. An abandoned battle writes nothing: the fight did not happen.
- **The summary carries what the sheet needs.** `buildTacticalSummary` now reports `mp`, `maxMp` and `spellSlots` like the director's summary already did.
- **What the bridge deliberately does not read.** `attackRoll`, `save`, `concentration` and `perCostStep` stay validated and unused, and `coverage.combat` keeps its own meaning. Applying them would be a claim to implement a system's combat, which is the combat handoff's work.

## What slice 8c settled

All three parts are in: scaled catalog values, the `use` command and Refresh from ruleset.

- **A row may carry four numbers the ruleset keeps.** A catalog entry row gains an optional `scaled` map: up to four of that row's own `number` columns, each `{ from: <value reference>, table?: <step table> }`. Without `table` the column takes the reference's value (a trick's uses equal to an ability score); with it the value is looked up (Rage by level). Anything fancier is a `derived` value the ruleset declares and the entry points at, so the format learns no new arithmetic. `values` still holds the plain number the row is before a sheet is known.
- **One check for both catalog shapes.** The cross-checks live in `rulesetCatalogEntryIssues`, which inline entries and asset entries both go through, so a scaled row is held to the same rule whichever way it ships: the key is a `number` column of that row's list, `from` resolves, and the row is the entry's ONLY row for its list, so a marked row on a sheet maps to one spec without guessing. The `checkRef` closure that validated every other value reference became the shared `rulesetValueRefIssues`, so a reference that is good in a derived value is good in a scaled column. A scaled column may name any declared derived value, like a live pool's `max`: it sits outside the sheet's own top-to-bottom order.
- **On edit, never on read.** `recomputeScaledRows(definition, build, catalogs)` in `packages/shared/src/features/rulesets/scaled-rows.ts` returns the SAME build reference when nothing changed, so a sheet that was only opened is never rewritten. The value is fitted to the column it lands in (clamped to `min` and `max`, floored when the column is whole numbers), so it can never write something the editor would refuse. Live state, the prompt block, the battle bridge and the server all keep reading the stored number. `scaledRowColumns` tells an editor which cells to lock.
- **Nothing is guessed from an absent catalog.** A row with no `_catalog` mark, a catalog the caller did not fetch and an entry that is gone are all left exactly as they are, because the ruleset's intent for that row is unknown.
- **`use` is the cast helper, without the word "spell".** `[sheet: who="Name" op="use" name="..."]`, with `op="cast"` and `spell=` as aliases the way `heal` aliases `restore`. It pays every `mechanics.cost` term plus one from each list-row pool the same entry wrote. A term naming a group pays from the first pool of the group, in declaration order, that can afford it, and there is NO automatic climb to a higher one: a group is not always a ladder. `pool=` is the upcast, accepted only for a single-term cost inside the same group. All or nothing: the steps go through `applyRulesetSheetOp` on a working copy and the first refusal refuses the whole command. An entry with no cost is `ok` and changes nothing. New refusals: `unknown-entry`, `ambiguous-entry`, `bad-pool`.
- **The name is what the Game Master was shown.** A row answers to its `gm.sheetSummary` name column, then `pools.nameColumn`, then the list's first text column, and to the entry's own `label`, so a renamed row still works. A catalog that could not be loaded reads as `unknown-entry`, logged server-side: the Engine cannot know the price and will not invent one.
- **The catalogs are loaded only when a turn needs them.** `loadTurnRulesetCatalogs` reads nothing unless the reply carries a `use` or `cast` command, and then only the catalogs the party's own rows point at. The route's asset-reading half moved into `services/game/ruleset-catalog.service.ts`, which opens a catalog and reads it as two steps so the route can still answer 304 before a megabyte is parsed. A failed load is a `logger.warn` and never loses the turn.
- **Capability API 1.23, read from the bytes.** `scaled` is a new key in a strict file, so an older Engine refuses whatever holds it. Install already has the verified bytes of `ruleset.json` AND of every declared `catalogs/<id>.json`, so the gate reads both: a scaled row inline or in an asset needs 1.23. An unparseable file still skips the check, as it always has.
- **Refresh offers the ruleset's newer TEXT, and only text.** `planCatalogRefresh` and `applyCatalogRefresh` in `packages/client/src/lib/ruleset-catalog.ts` compare only `text`, `longtext`, `dice` and `enum` columns the entry actually sets, never a scaled column, and never a value the column itself would refuse. A number or a boolean is where the player's own state lives and there is no stored base to merge against, so it is left alone: documented as the ceiling in the authoring guide. A row is matched to the entry row it came from by position among the rows with the same mark in that list when the counts agree, and otherwise only when the entry writes one row for the list; a row whose entry is gone is skipped silently.
- **Reviewed, never applied behind the player.** Nothing is drawn when nothing differs. A list with differing rows gets one plain line (not a live region, so it does not re-announce while the sheet is typed in) and a **Review** button opening `RulesetCatalogRefreshModal`, which shows each row's differing columns with the sheet's text beside the ruleset's and a tick per row, checked by default. **Update selected** applies everything in ONE `commit`, writing only the differing columns and keeping every other key of the row, the `_catalog` mark included. Cancel changes nothing.
- **The editor loads what the sheet points at, and only that.** `RulesetSheetEditor` fetches the catalogs named by the build's own marks with `useQueries` over the picker's own `rulesetCatalogQuery`, so the picker, the battle prefetch and the editor share one cache entry, and a build with no marks fetches nothing. A pending or failed load reads as "no catalogs yet": nothing is locked and nothing is recomputed. `commit` is still the one change path and now runs `recomputeScaledRows` on the patched build; opening a sheet never calls `onChange`, and a sheet edited before its catalogs landed is brought up to date once when they arrive.
- **Proven on both examples.** `docs/examples/rulesets/ember-roads.json` scales its trick's uses from an ability score with no table, on a 2d6 system with no level at all; the 5e example is used with a test catalog whose class resource follows `level` through a step table. `scripts/regressions/game-ruleset-scaled-rows.regression.ts` plus `use` cases in the live and catalog regressions, and the client lane `scripts/regressions/ruleset-catalog-refresh.regression.ts` for Refresh on both examples.

## What slice 7b settled

The second resolution kind, `dice-pool`. The plan wanted it specified with a community author who already runs pool systems; nobody answered, so the vocabulary was taken from what pool systems in the wild actually need and the PR invites that review.

- **The same sheet, a different meaning for its number.** Everything the sheet already computes for a check (the ability modifier, the proficiency tier's bonus, the free per-entry bonus) is, under `dice-pool`, the NUMBER OF DICE. No new sheet vocabulary, no new editor, no second way to declare a rating. `formatRulesetCheckValue(definition, value)` is the one place that decides whether a number prints as "+5" or as "5 dice", and the prompt's sheet block, the editor and the in-game sheet all go through it.
- **The kinds share their sheet math by construction.** `abilityModifier`, `proficiency` and `proficiencyTiers` are one object spread into both union members, so the cross-checks that refuse a multiplier with no bonus to multiply run for both, while the dice-sum-only rule (naturals need a single die) stays inside its own branch.
- **What the kind can express.** `die.sides`, `pool` (the range the sheet's number is clamped into, with a `min` of 0 allowing an empty pool to fail with no roll), `target` (fixed, or a range the Game Master may move inside), `double`, `explode` (chained, capped at the pool's own maximum), `cancel`, `botch`, `exceptional`, `situationalDice`, and a `difficultyLadder` of required successes with an optional per-step target. A rule that could never fire is refused at import: a face outside the die, a cancelling face that also succeeds, a ladder step naming a target the Game Master could not set.
- **A botch is read before cancelling.** "No die succeeded AND a botching face showed" is the rule, so a pool whose only success was cancelled away has failed rather than botched. A botch forces the check to fail, so a botch and a success can never both be reported.
- **Three per-check attributes, clamped rather than refused.** `threshold=` (only while the target is adjustable), `bonus=` (only with `situationalDice`) and `with=` (roll a skill or save with another ability than its own). A value outside the declared range is pulled to the nearest end, and an ability the ruleset does not offer is ignored with a debug line. A resolved record is written from the RESULT (`SkillCheckResult.threshold`, `bonusDice`, `withAbility`), so it shows what the roll applied, never the raw ask; only a sparse rewrite, where nothing was rolled, keeps the ask as written. `with=` works for both kinds because the modifier function is shared, so a 5e ruleset gets "Strength (Intimidation)" for free.
- **A pool result is always the Engine's.** `rulesetVouchesFor` never vouches for a pool: the numbers are auditable, but a handful of dice has so many internally consistent outcomes that an audit constrains nothing. `isRulesetRollableSkillCheckTag` therefore accepts any `dice=` or `resolution=` the model wrote from habit and ignores `mode=`, because the pool comes from the sheet and the kind has no advantage. A die the player rolled before the turn never applies.
- **The difficulty is a count of successes.** Its ceiling is `rulesetPoolMaxSuccesses` (the largest pool, as many exploded dice again, doubled when faces count twice), the same number the schema lets a ladder step or `exceptional` ask for, not the d20 bounds, in `isResolvableSkillCheckRequest`; the resolver clamps it once more because the sighted pool bounds a written DC before any ruleset is loaded.
- **The sighted one-request pool stays out of it.** The pool holds twenty-sided dice, so a `dice-pool` game takes the blind branch exactly as a 2d6 `dice-sum` ruleset already does: the check is rolled by the Engine, no pool value is spent, and no slot is recorded against a roll it did not decide. The same gate now reads the kind before the dice, because a pool ruleset has no `dice` at all. Roll placeholders (`[[roll: 1d8+NAME]]`) resolve no sheet name under a pool ruleset and the prompt advertises none, because a count of dice added to a damage roll would be a number that means something else.
- **`SkillCheckResult` gained `threshold?`.** Both pool paths set it: the `dice-pool` ruleset, which knows the target its rules chose, and the legacy `resolution="successes"` tag, which knows the one it was handed. The serializer writes `threshold=` from the result, so the two spellings cannot drift, and the legacy path's bytes are unchanged.
- **Capability API 1.24, read from the bytes.** A `dice-pool` resolution is a shape an older Engine's strict schema refuses outright, so install reads `ruleset.json` and refuses the kind under an older declaration, exactly as it does for `catalogs` under 1.21, `battle` under 1.22 and `scaled` under 1.23.
- **What was deliberately left out, and said out loud in the docs.** Take the highest die (needs a partial-success tier the result type does not have), stance pools compared to a stat, symbol dice, opposed pools, roll-under and open-ended percentile, and sum pools with a wild die. Each would be its own kind. Re-rolls bought with a resource and automatic successes are the Game Master's `bonus=` and `[sheet:]` commands, not resolver rules.
- **Proof.** `docs/examples/rulesets/gravewatch.json` is an original ten-sided pool system shipped beside Ember Roads, and `scripts/regressions/game-ruleset-dice-pool.regression.ts` pins the schema refusals, every special rule with an injected die sequence, the clamps, the tag attributes, the prompt line per kind, the sheet block wording, the 1.24 install gate, the untouched legacy pool path and the sighted pool falling back blind.

## What layers L1 settled

Slice L1 of § Open decisions item 5: a layer is a variant a ruleset ships INSIDE its own file, so it can never go missing for a pinned game, needs no new storage, no new lane and no install gate beyond the API number. L2 (layers shipped by someone else) stays open.

- **The effects are a closed set, and every one of them narrows or appends.** Guidance appended to `gm.checkGuidance` and to the new `gm.worldGuidance`, values REMOVED from an enum field, the difficulty ladder replaced by one of the same resolution kind, catalog entries hidden from the sheet editor's picker. A layer adds nothing: a value a layer added would be unknown to every other reader of the sheet, and to every game that turned the layer off. It also adds no model call, no live state and no combat number.
- **`gm.worldGuidance` is a base slot, not a layer key.** Base rulesets had no way to shape the world their game is generated in. `/game/setup` resolves the pin once and passes the layered `worldGuidance` into `buildSetupPrompt`, which renders it as `<ruleset_world>`. It is read once, at setup, and never reaches a turn; the existing setup prompt debug logging prints it with the rest.
- **The choice is frozen into the pin's `options` record**, which existed for this and was empty. `/game/create` validates it against the definition with `rulesetLayerSelectionIssues` and answers `ruleset_layer_unknown` or `ruleset_layer_conflict` as a 400, rather than starting the game on rules the player did not choose. Keys the Engine does not own ride along untouched, and the record is capped at `RULESET_REF_MAX_OPTIONS` on the way in only: the pin itself stays read tolerantly, because an existing game must never become unreadable.
- **Applied in exactly one place.** `resolveGameRuleset` returns the EFFECTIVE definition, so the prompt, the resolver, the sheet block, the editor and the battle bridge all see the layered ruleset with no change of their own. It also exposes `baseDefinition` and the active `layers: {id,label}[]`. No caller held the registry's object by identity, so nothing else moved.
- **The effective definition is re-validated, with two documented relaxations.** `rulesetEffectiveDefinitionSchema` is the file schema with a namespaced id allowed (the registry re-keys community rulesets, and the FILE schema refuses the slash) and a looser guidance cap, because a layer appends to text that is capped at 1500 per file. It is bounded all the same, at the base plus every layer's own 4000. The layer-versus-field cross-check is the one rule skipped on an effective definition: the values it removes are already gone, which is the point.
- **A layer never costs a game its ruleset.** `applyRulesetLayers` never throws. It validates all the active layers together, and only if that fails does it add them one at a time and keep the ones that work. A chosen layer the file no longer has, and the later of a conflicting pair, are simply not applied. Both are debug lines rather than warnings, because resolution runs on every turn.
- **Guidance is joined with a space, not a blank line.** Every guidance string in the format is one line by `promptSafeText`'s own rule, and the Game Master reminder renders `checkGuidance` inside a single bullet, where a line break would read as a new instruction.
- **Conflicts are symmetric, and the LATER layer goes.** Naming one side of the pair is enough, and declaration order decides, so the same two choices always produce the same rules.
- **Nothing rewrites a character.** A sheet that already holds a removed enum value keeps it and shows it, the editor simply stops offering it, and a catalog entry a layer hides is left out of the picker while a row the player already took stays. `catalogEntryHiddenByLayers` is the picker's filter; the ruleset's own entries are never touched.
- **The client half is built on the same two helpers.** `GameSetupRulesChooser` draws one checkbox per layer under the chosen ruleset, disables the one a checked layer rules out and names it, and `packages/client/src/lib/ruleset-layers.ts` holds the pure part: the toggle, the options record, and the restore that drops a layer id the installed definition no longer has. `useGameRuleset` applies the pin's layers once, so every in-game reader sees the effective definition and the sheet heads itself with the ruleset's name and the active layers. The picker filters with `visibleCatalogEntries`, which narrows what is offered and nothing else: Refresh from ruleset and the scaled columns read the catalog straight from the query, and the character and persona editors pass no options at all, so they hide nothing. `scripts/regressions/ruleset-layers-client.regression.ts` pins all of it.
- **Capability API 1.25**, read from the bytes, exactly as `catalogs` under 1.21, `battle` under 1.22, `scaled` under 1.23 and `dice-pool` under 1.24: a non-empty `layers` array, or a base `gm.worldGuidance`, needs the declaration.
- **Proven on all three examples.** Ember Roads gains "Hard winter" (harsher ladder, both guidance slots, and a rule hiding the knacks that cost Grit from the picker), Gravewatch gains "The long night" (a ladder of successes with per-step targets, which is what makes the point that nothing here is d20-shaped), and the 5e draft gains "Low magic" (two values off the spellcasting enum) plus a conflicting "High magic". `scripts/regressions/game-ruleset-layers.regression.ts` pins the schema refusals, the application on every combination of every example, the same-reference case, the fallback, the route's refusals and frozen pin, the reminder, the world prompt and the 1.25 gate.

## Real ruleset combat

**The decision.** Asked whether combat should be a per-ruleset TypeScript adapter or data, the user
ruled on [#6361](https://github.com/Pasta-Devs/Marinara-Engine/issues/6361): "do whatever is needed
in order to get the truest version of 5e combat we can accomplish, and the order of PRs is up to
you." So a `combat` block joins `resolution` as validated data that parameterises an Engine-owned
kind, the combat handoff's reserved `5e-2014` adapter becomes the 5e package's own data, and the
standing rule still holds: the FORMAT is never 5e-shaped. Fidelity comes from a rich closed
vocabulary plus the package's data, not from a file that can name one system's words.

**The architecture.** Four seams, in this order:

1. A pure shared resolver, `packages/shared/src/features/ruleset-combat/`, with no I/O, an injected
   roller and a plain serialisable state. Everything that acts picks an id off one legal menu.
2. One server-owned session on the combat director's existing ledger, as a third `style` beside
   `classic` and `tactical`: the same storage row, revision, idempotency, mutex, windows and single
   "pick a candidate id" model call. No second ledger.
3. The existing shells, driven through the `directed` prop they already accept, with the option menu
   in place of the hardcoded one and the real roll in the log.
4. The bridge steps aside per ruleset: a ruleset that declares `combat` never takes the `battle`
   path, and `coverage.combat` finally means something.

**The slices.** C1 the schema and the resolver. C2 bestiary catalogs, stat-block actions, sequences
and recharge, the threat clamp, and the 5e package's own creatures and enriched spells. C3
the director's `ruleset` style, split into C3a (session, routes, persistence, enemy choices over the
menu) and C3b (the Classic shell on real numbers, `coverage.combat` true). C4 the board, split into C4a (the format,
positions, movement, reach and ranges, areas, cover, opportunity attacks, the picker and the view) and C4b (the board on
screen, out of the Tactical style's own look). C5 what a turn can do and what interrupts one, split
into C5a (the turn economy, riders and the condition vocabulary) and C5b (the window itself: a walk
held open, and the one a signature action is bought in). C5c and later: what else opens a window,
legendary actions, contests and the remaining conditions.

### What C1 settled

- **The block is optional, absent rather than empty, and lives beside `battle`.** A ruleset may
  carry both: the bridge is what an Engine too old for `combat` falls back to, and a fight never
  uses both. Capability API 1.26, read from the ruleset's own bytes exactly as `catalogs` under
  1.21, `battle` under 1.22, `scaled` under 1.23, `dice-pool` under 1.24 and `layers` under 1.25.
- **One kind, `attack-vs-defense`**, parameterised the way `dice-sum` is: the dice for initiative and
  for an attack are declared, so a 2d6 system needs no kind of its own. Saving throws inside a fight
  roll the attack dice, because a `dice-pool` ruleset has no total to compare with a difficulty; the
  authoring guide says so.
- **Every name is the ruleset's, and every one is cross-checked**: the health pool is a declared live
  pool that does not start empty, the defense and the initiative modifier are value references, an
  attack's columns are columns of the list it names and of the right type, an ability list is
  filtered exactly as `battle.skills` is, conditions map the sheet's own ids onto a closed effect
  list, concentration names a live text and a save, dying names two different tracks, budgets have
  unique ids, and `attacks[].budget`, `abilities[].budget` and `mechanics.budget` name a declared
  budget.
- **The action economy is a list of budgets**, each `per` turn or round with a count. The FIRST
  declared budget is the main one and is what a standard action spends: a convention rather than a
  key, because a standard action is the Engine's own and the alternative was a second way to say
  "action" in every file.
- **`mechanics` grew six keys, all optional and additive**: `targetCount`, `autoHit`, `applies`
  (condition, duration, optional save that ends it), `temporary`, `scales` (extra DICE from a step
  table over a value reference) and `budget`. `rulesetCatalogEntryIssues` checks them, so an inline
  catalog and an asset catalog are held to the same rule.
- **Sheet-backed and block-backed combatants.** A party member READS through `evaluateRulesetSheet`,
  `resolveRulesetValueRef`, `readRulesetLive` and `rulesetCheckModifier`, and WRITES through
  `applyRulesetSheetOp` on a live blob carried inside the encounter, so health, resources,
  conditions and concentration are the sheet's during the fight and after it, and a reload mid-fight
  is exact. An opponent is a plain stat block and lives in the encounter only.
- **The menu is the only place legality lives.** `rulesetCombatOptions` offers what the actor can
  afford right now, priced by a dry run of the sheet's own `use` command (`planRulesetUse`, reused
  rather than re-implemented), including the upcast: a higher pool of the same family, with
  `perCostStep` adding its dice once per step between the declared pool and the paying one.
- **The definition is a parameter, not part of the state.** `rulesetCombatOptions`,
  `applyRulesetCombatChoice`, `advanceRulesetTurn` and `rulesetEncounterSummary` all take the
  definition the pin resolves to. The state carries `{ id, version }` so a persisted fight says what
  resolved it, and stays small enough to persist: a party member's catalogs are narrowed to the
  entries their own rows point at.
- **Events carry the arithmetic**, never a conclusion: the dice as they fell, the modifier, the
  total, the defense or difficulty it met, what a resistance did to it and what is left. A log can
  print "17 + 5 = 22 against 15: hit, 9 slashing" without doing any arithmetic of its own.
- **Nothing throws.** An illegal choice returns the state it was given, unchanged by identity, and
  one `refused` event with a reason from a closed list.
- **What C1 deliberately does not do**, with the seams left in place and said out loud in the
  authoring guide: positions, distance, reach, ranges, areas on a map, cover and movement (`range`,
  `area`, `economy.movement` and the four distance-reading condition effects are validated and
  unread); reactions and their windows (`cannot-react`, and a `reaction` entry is off the menu);
  bestiaries, multiattack and recharge; and who an opponent chooses to attack. Nothing is playable
  yet: there is no route, no session and no screen.
- **Proven on both examples with scripted dice.** `scripts/regressions/game-ruleset-combat-core.regression.ts`
  pins the schema refusals, the mechanics cross-checks, initiative and both tiebreaks, the menu, the
  action economy, hits, misses, lucky faces, criticals, advantage and disadvantage cancelling,
  typed damage with resist, vulnerable and immune, temporary points first, saves for half and for
  nothing, an area sharing one damage roll, a slot spent through the sheet and refused when empty,
  the upcast, a scaled cantrip, conditions with save-ends and durations, concentration broken by
  damage and replaced by a second ability, dying with a revival on a lucky face and death on three
  failures, healing from zero, victory, defeat, the summary, the 1.26 install gate and a fight
  carried through `JSON.parse(JSON.stringify(...))` mid-battle.

### What C2 settled

- **A catalog says what it holds.** `holds` is `"rows"` (the default, so every catalog written
  before this release is unchanged) or `"creatures"`. A bestiary declares no `feeds`, needs a
  `combat` block and a `threat` scale, and is never offered by the sheet editor's picker, which goes
  by `feeds` and therefore never sees one. An entry carries `rows` or a `creature`, never both and
  never neither, and a creature carries no `mechanics`: it says what it does in its own actions. A
  mixed catalog is refused, inline and in a `catalogs/<id>.json` asset, because
  `rulesetCatalogEntryIssues` is where both are checked.
- **A creature is written in the keys `combat` already declares**: health as a number or as dice
  thrown when the encounter is created, a defense, an initiative modifier, ability scores and save
  modifiers under the sheet's own ids, resistances by declared damage type, immunities by the
  sheet's own conditions, a tier of the ruleset's own scale, prompt-safe traits the Game Master is
  shown and never resolves, and actions. Capability API 1.27, read from the ruleset's own bytes
  exactly as 1.21 through 1.26 are.
- **A stat block carries its own save difficulties.** `save.difficulty`, or `saveDifficulty` for a
  condition that ends on a save when the action forces none of its own, and one of the two is
  required wherever a save is asked for. C1's rule for catalog rows (the abilities source supplies
  the number) has no counterpart here, because a block is not a sheet.
- **Four things only a creature's action has**: `uses` (per encounter or per day), `recharge` (spent
  when used, rolled at the start of its owner's turn, back on `from` or higher, starts available),
  `sequence` (other actions of the same block, in order, one budget for the lot, each part with its
  own target and its own roll, never naming another sequence) and `signature` (bought with the
  block's own `signaturePoints`, refreshed at the start of its own turn, never on its own turn's
  menu). `rulesetSignatureOptions` prices them and `applyRulesetCombatChoice` spends them, in the
  window C5b opens between two turns and nowhere else.
- **A sequence takes the targets of all its parts.** Hand it fewer and every part takes the ones at
  the front of the list, so one id is "all of it at the same target". A part whose target the fight
  is already over for is skipped, and nothing picks a new one: choosing is the caller's job.
- **The clamp is for proposals only.** A shipped bestiary is data the author wrote and is taken as
  written; a creature the Game Master invents goes through `clampRulesetStatBlock`, which pulls
  health into the tier's band, holds defense, to-hit and save difficulties to two above the tier,
  drops names the ruleset does not have and everything past six actions, and scales damage down
  until the best round fits the tier's `damagePerRound` upper bound. It takes off dice count, then
  the flat part, then a strike from a sequence, then the size of the die, and never scales anything
  to nothing. A tier the ruleset does not declare falls back to the lowest, and every change comes
  back as a plain sentence for the log.
- **`damagePerRound` is read as one target's worth of a whole round**, sequence included, rather
  than as one attack, because the round is what a clamp has to bound.
- **Looking one up is exact, then plain, then nothing.** `findRulesetCreature` matches
  `<catalogId>/<entryId>`, then a label or an id once case and punctuation are set aside, then
  returns null. A reference the handed-in catalogs do not hold leaves that opponent out of the fight
  with one `refused` event carrying `unknown-creature`, rather than walking in a creature with no
  numbers.
- **Proven on both examples** in `scripts/regressions/game-ruleset-combat-creatures.regression.ts`:
  Ember Roads ships three original creatures and a three-rung threat scale, the 5e draft ships four,
  and neither file's format knows the other's words.

### What C3a settled

C3 is split in two: C3a is the server half, and C3b is the screen. No Capability API bump, because
the format did not change.

- **One ledger, a third `style`.** `DirectedCombatView.style` gains `"ruleset"`. The same storage
  row, the same namespace, the same revision, instance and request-id idempotency, the same per-chat
  queue and the same "the model only picks a candidate id from a menu the Engine enumerated" rule.
  `GameCombatStyle`, which is the PLAYER'S preference, stays two values: the ruleset style is never
  a preference, it is what a game on a ruleset with a `combat` block gets.
- **The style's own logic lives in its own file.** `ruleset-combat-director.service.ts` is pure over
  `(definition, state)`, so a regression drives a whole fight with no database. The existing
  `combat-director.service.ts` gained three dispatch points and nothing else: the widened `style`,
  a `rulesetFight` field on the persisted state, and an early return in `advanceCombatDirector` and
  in `commandCombatDirector` so the task queue never runs for a fight it cannot resolve.
- **The server decides what the fight is resolved by.** `/start` resolves the chat's pin itself and
  refuses a game with no ruleset or no `combat` block. The party is read from the chat's own sheets
  through `rulesetSheetBuildsByName`, which MOVED into the shared combat bridge so the `battle`
  bridge and this style match a combatant to a sheet by the same rule. A client-sent sheet is never
  read, and a member without one is refused by name.
- **An opponent's numbers**, in order: `findRulesetCreature` on the reference the Game Master named,
  then on the opponent's own name, then `clampRulesetStatBlock` over a proposal in the shared
  creature form, then a plain block from the tier's own numbers (`rulesetTierStatBlock`: the middle
  of the health band, the tier's defense and to-hit, one attack dealing the middle of
  `damagePerRound` flat and untyped). Every fallback and every clamp line is kept on the session as
  `adjustments` and logged once.
- **The Engine's own `party` and `enemies` stay in step** after every step, because
  `handleCombatEnd`, the recap and the journal read them, and `CombatSummary` is filled from them
  when the fight ends. `rulesetEncounterOutcome` is what decides who won; the hit points agree
  because they are the same numbers.
- **Live sheet state is written when an action is ACCEPTED**, inside the ledger's own save, and the
  new blob rides back on the response so the client's store needs no refetch. If the write fails the
  step fails, so the ledger and the sheet can never disagree, and there is no end-of-battle
  write-back for this style at all.
- **The menu is sent, never computed.** `rulesetOptionTargets` is a new shared helper beside the
  resolver, and `applyRulesetCombatChoice`'s own target check now goes through it, so the list a
  client is offered and the list the rules accept are one list.
- **`continue` resolves exactly one turn** of an actor no human plays: every action it takes, the
  end of its turn, and the next actor. The picker turns the menu into `CombatAiCandidate`s and lets
  the existing `chooseCombatCandidate` choose, so a ruleset fight is scored by the same tactics as
  the other two styles. It is capped at twelve actions a turn, always ends the turn, and never
  points a blast at its own side: whether a target is an ally is read off the TARGET, not off the
  side the option was written for, which is what an author who allows friendly fire needs.
- **A boss opens a window instead.** One `CombatDecisionOption` per candidate, extended additively
  with `optionId`, `targetIds` and `label`, answered by the existing `continue` job through a
  ruleset-aware prompt builder beside `buildCombatBossPrompt`: the same JSON-only `{"candidateId"}`
  answer, the same debug lines, the same ten-second timeout, the same call cap, and the same
  fallback to the local picker on garbage or on an id the menu does not hold.
- **A refusal changes nothing**, bumps no revision, spends no request id, and answers 400 with the
  resolver's own reason in a stable `code` field (`ruleset_combat_<refusal>`).
- **A fight whose ruleset is gone** comes back finished with outcome `flee` and one director event
  saying why, rather than a 500 or a fight resolved by other rules. Nothing about that is persisted,
  so reinstalling the ruleset picks the same fight up where it was left.
- **The blueprint speaks the ruleset's terms.** When the chat's ruleset declares `combat`,
  `/encounter/init` lists the threat tiers and a bounded bestiary index (the first sixty names in
  declaration order) and asks for each opponent's `creature`, `tier` or `proposed` block. A game
  with no ruleset, or one without `combat`, gets today's prompt unchanged, and a malformed
  `proposed` is dropped instead of failing the whole blueprint.
- **Proven** in `scripts/regressions/ruleset-combat-director.regression.ts` (pure, both example
  rulesets) and `ruleset-combat-director-route.regression.ts` (the real routes, the live write-back,
  an unchanged classic fight, the boss window with the model faked, and the blueprint prompt).

### What C3b settled

C3b is the screen. Still no Capability API bump: the format did not change, and the three shared
additions below are fields nothing outside the Engine writes.

- **One decision says whether a fight is the ruleset's own**, and everything reads it:
  `isRulesetCombatFight({ combatDirector, definition, anchor })` in
  `packages/client/src/lib/ruleset-combat-bridge.ts`. All three have to hold. It is read off the
  BLOCKS the file declares, never off `coverage.combat`, which is what the author claims rather than
  what the file carries. The setup wizard and the import review say what battles will do from the
  same test.
- **The Classic shell is the stage.** `GameCombatUI`'s `directed` prop gains an optional `ruleset`
  part; without it every Classic path is the one it has always been, and with it the hardcoded
  attack/skill/defend menu, its sub-phases and its arrow-key handling are all replaced by the
  ruleset's own menu. Portraits, health bars and their animations already read `party` and
  `enemies`, which the server keeps in step, so they were not touched at all.
- **Nothing on screen computes legality or arithmetic.** The menu, the legal target ids, the costs,
  the forecast and every number in the log come from the server's view. An option the rules refuse
  is simply not sent, so nothing is greyed out by the client, and a 400 refusal is a localized
  sentence per `code` with the server's own sentence as the fallback for a code this build does not
  know.
- **The words are the ruleset's.** Budgets, conditions, saves, tracks, tiers, pools and what an
  attack is rolled against all print the labels the file declares, so 5e says "Armor Class" and
  Ember Roads says "Guard". Only the kind's own closed list of standard actions, and ending a turn,
  are named by the Engine.
- **The log is one pure module**, `packages/client/src/lib/ruleset-combat-log.ts`, so every event
  type's line can be pinned. A roll with nothing added to it prints as the die alone; several dice
  that add up to what was kept print as the handful; advantage and disadvantage print both dice and
  the one kept, and only when the event says which way it leaned.
- **The bridge stands aside for exactly that fight.** `startBattleParty` does not seed from the
  sheet and `handleCombatEnd` does not call `applyRulesetBattleResult`, because the server wrote
  every accepted step as it happened. A ruleset with `battle` and no `combat`, and a game without
  the director, keep the bridge exactly as it was.
- **The recap is the real summary.** `CombatSummary` gained an optional `ruleset` field carrying
  `RulesetEncounterSummary`, and the recap prints health as value and maximum in the ruleset's own
  pool, who is down, dying or stable, conditions by label, the ruleset's own round count, and one
  line saying the sheets were kept up to date, in place of the percentage lines.
- **Three small shared additions**, all additive: `RulesetEncounterSummary.party[].stable` (a recap
  could not otherwise tell somebody who has stopped slipping from somebody still on the clock),
  `CombatSummary.ruleset`, and `creature`/`tier`/`proposed` on `CombatEnemy` and `Combatant` so the
  blueprint's own terms reach `/start` through the client pipeline.
- **One small server change:** `syncRulesetCombatants` now sets the director's own `round` from the
  fight's round. It used to stay on one forever, which showed as "Round 1" all fight and as "after 1
  round" in the recap.
- **Proven** in `scripts/regressions/ruleset-combat-screen-client.regression.ts` (every event type's
  line on both example rulesets through the real English catalog, menu grouping, target picking, the
  decision above for every combination, and the recap from a real summary) and in a third mode of
  `e2e/game-combat-director.e2e.ts` that imports Ember Roads through the real route and plays a
  fight on it.

### What C5a settled

C5a is what one TURN can do, on the shared and server sides. Everything in it is additive and
optional, and a ruleset that declares none of it resolves byte for byte as it did.

- **A blow may be several amounts.** `mechanics.plus` on a catalog entry and `damage.plus` on a
  creature action are up to three clauses, each rolled and typed on its own, each answered by the
  target's own hide on its own, each doubled by a critical on its own, and each able to ask the
  TARGET for a save of its own (`onSuccess: "none"` leaves nothing of that clause, `"half"` leaves
  half). The blow they make together is ONE check against concentration, with the summed damage,
  and one check for going down. Forecasts, the threat clamp and the measured damage per round all
  count the clauses; a save-gated clause is counted in full, because a forecast says what a blow
  would do.
- **Several strikes for one budget.** `combat.attacks[].strikes` is a value reference. The first
  take spends the budget and puts the rest in `combatant.strikesLeft`; while any are in hand every
  row of a list that declares `strikes` is offered at no budget cost, carrying `option.strikes` so
  the menu can say what is left. Different weapons, different targets and a walk between them all
  fall out of the menu with no special case. A list that buys one strike a spend puts nothing in
  hand and emits no event, so today's logs are unchanged.
- **Abilities that change the economy.** `mechanics.free` costs no budget, `mechanics.gives` adds
  to budgets the moment it is used and caps where they land, and `mechanics.standard` offers named
  standard actions as `standard:<id>@<budget>`, priced by the ability that granted them. A
  `utility` entry that declares `gives` or `standard` is built as an action rather than dropped,
  and one whose `standard` is all it has stays off the menu itself: a permission is not something
  anybody takes.
- **Riders.** A new catalog entry kind, `rider`, and a creature's own `riders[]`. Passive, never on
  the menu, and one more clause of the first qualifying hit of the period. Which attacks it comes
  off is resolved once when the fight begins, out of the attack lists it names and one truthy
  column of their rows, so the resolution never re-reads a sheet. `oncePer: "turn"` is cleared at
  the start of EVERY turn, whosever it is, so a strike made while somebody else is acting can carry
  one.
- **Condition vocabulary.** Five new effects, plus `saves` (which saves the two save effects are
  about), `whileSourceInSight` (a gate over all of that condition's effects) and
  `endsWhenSourceDown`. A tracked condition already recorded who applied it, so nothing new had to
  be stored for the three source-bound ones.
- **Proven** by the C5a block in `scripts/regressions/game-ruleset-combat-core.regression.ts` (the
  refusals, the clauses, the strikes, the economy, the riders, the conditions, both examples, and a
  fight compared event for event with the same fight on a ruleset carrying none of the keys) and
  the board-only condition cases in `game-ruleset-combat-grid.regression.ts`.
- **Left for C5b and later**: `on` has one value, `hit`, so a rider still fires by itself.
  `combat.standard` stayed a closed list of plain strings, because every ruleset that already ships
  one writes it that way; what a dodge does BEYOND being harder to hit is said beside it instead, in
  `combat.standardEffects.dodge.saves`.

### What C5b settled

C5b is the WINDOW: a fight held open between one step and the next, for somebody who is not the
current actor.

- **No new key, and no capability bump.** Every part of the vocabulary a window reads was already
  there: `combat.opportunity.budget` says what a strike at a passer-by costs, a creature's
  `signature` and `signaturePoints` say what its points buy. What changed is that the Engine asks
  instead of deciding: an opportunity strike used to be made FOR its holder, and a signature action
  used to be buyable at any moment that was not its own turn. A package built before this slice
  plays the same fight, one question at a time.
- **The window lives in the state.** `RulesetEncounterState.window` holds the kind, what opened it,
  who is still to answer and, when a walk opened it, the rest of that walk: the cells already
  crossed, the ones still to cross, what has been paid and everybody already asked. A fight saved
  mid-walk comes back with the same people still to ask and the same cells still to walk, and
  `windows` counts every one ever opened so an answer written for a closed one is refused rather
  than spent on the one that replaced it.
- **While a window is open, nothing else moves.** Every other choice is refused with `window-open`,
  including the end of the turn, and an answer naming another window is refused with `stale-window`.
  There is one entry point either way: `applyRulesetCombatChoice` takes the answer exactly as it
  takes a turn's choice, off `rulesetWindowOptions` or `RULESET_PASS_OPTION`.
- **One answer each.** The window asks each waiting combatant once, struck or passed, and drops
  anybody left with nothing to answer with rather than holding the fight open for a menu with only a
  pass on it. One chance each for a whole walk, however many times the path leaves the same reach.
- **A walk is finished even when the last blow ended the fight**, because its own event is what says
  where the walker really stopped.
- **The director drives it.** Everybody in a window who is not a person's to play answers there and
  then, out of the window's own menu and through the same scoring that plays their turn; a Game
  Master's boss is asked through the Game Master's own decision, with letting the moment go by as
  one of the answers. The window is left standing only for somebody's own party member, and
  `DirectedRulesetView.window` is what the client draws the question and its Pass on.
- **Proven** by the window block in `scripts/regressions/game-ruleset-combat-grid.regression.ts`
  (held open, the menu, the strike, the pass, the refusals, one chance per walk), the signature
  windows in `game-ruleset-combat-creatures.regression.ts`, and the boss's own window in
  `ruleset-combat-director-route.regression.ts`.
- **Left for C5c and later**: what ELSE opens a window. A catalog entry marked `reaction` names no
  trigger yet, so it is still on no menu; the vocabulary that says what a reaction answers, and the
  nesting, cancellation and refunds that come with a counter, are the next slice's.

### What C4a settled

C4a is the board, on the shared and server sides. C4b is the screen that draws it.

- **What a cell is worth is the ruleset's to say, and saying it is what makes a fight positionable.**
  New optional `combat.distance: { label, perCell }`. Every distance the block's world states is in
  that unit: `economy.movement`, a creature's `speed`, a weapon's `reach` and `range`, a creature
  action's `reach` and `range`. A catalog that declares its own `units.distance` converts its own
  `mechanics.range` and `area.size` with its own `perCell`; one that does not uses the block's.
  Capability API 1.28, read from the ruleset's own bytes exactly as every level since 1.21.
- **Nothing that works today changed.** A fight without a board is byte for byte the fight it was:
  the whole event log of the same scenario is compared, on the very rulesets that now declare a cell
  size and on copies stripped of every new key. The state stayed at `v: 1` because every new field
  is optional and absent on a fight that has none.
- **Everybody on the board, or nobody.** `createRulesetEncounter` takes an optional
  `board: { grid, placements }` and stores it only when the ruleset declares `distance` AND every
  combatant has a cell inside the grid. One missing placement leaves the whole fight theatre of the
  mind, because a fight where somebody stands nowhere could answer nothing about distance.
- **The grid is the tactical engine's own.** The server calls `generateTacticalBattlefield` and
  `placeSpawns` from the same seed and the same cursor the tactical style uses, with stand-in units
  that carry only a side, a boss flag and a tile. `placeSpawns` was widened to a structural
  `TacticalPlaceable` for that, which `TacticalUnit` already satisfies. No second generator, no
  second terrain table, no board sizes of this fight's own.
- **Eight neighbours, one cell each, and distance is the larger axis difference.** That is how the
  tabletop grids this is for are played, and it is deliberately NOT the tactical engine's own four
  directions and Manhattan distance, which stay exactly as they are for its own fights. Terrain
  `moveCost` is the price of ENTERING a cell, nothing solid may be entered, no corner may be cut
  between two solid cells, a friend may be walked past and nobody may be stopped on.
- **One new pure module**, `packages/shared/src/features/ruleset-combat/grid.ts`: `rulesetInCells`,
  `rulesetCellDistance`, `rulesetReachableCells`, `rulesetLineOfSight`, `rulesetAreaCells` and
  `rulesetOpportunityAttack`. Real burst, cone and line shapes, not the older bridge's one radius.
- **The menu is still the only legality.** Where a walk may go, who an option may be pointed at and
  where a shape may be aimed are all one rule the resolution checks a choice against, and a target
  the rules would allow if only it were closer is refused with `out-of-reach` or `no-line-of-sight`
  rather than a bare `bad-target`.
- **The picker moves.** It weighs every cell it can reach against every option from there, subtracts
  for each strike the walk would provoke, prefers not to move when it can already do its best where
  it stands, and closes the distance (sprinting first when the ruleset lists `dash`) when nothing is
  in reach. Bounded to 48 cells, and the Game Master's window to 24 candidates.
- **Proven** in `scripts/regressions/game-ruleset-combat-grid.regression.ts` (hand-drawn boards,
  scripted dice, both example rulesets, and the byte-for-byte comparison), plus positioned cases in
  `ruleset-combat-director.regression.ts` and `ruleset-combat-director-route.regression.ts`.
- **Left for later**: three-quarter and total cover, elevation, flying over obstacles, squeezing,
  hiding and forced movement. The reaction window itself is C5b.

### What C4b settled

C4b is the board on screen. It draws what C4a resolves and decides nothing of its own.

- **The screen follows the VIEW, not the preference.** `DirectedCombatUI` mounts the board when the
  ruleset view carries a `grid`, and keeps the Classic stage when it does not. The client sends
  `positioned: true` on `/start` exactly when the fight is the ruleset's own, the game's combat
  preference is Tactical and the resolved ruleset declares `combat.distance`; the server still
  decides whether a board can be drawn at all.
- **One new presentational component**, `RulesetCombatBoard.tsx`. `TacticalCombatUI` was not
  restructured: its palettes, textures, terrain icons, tile shadow, keyframes and token helpers
  moved unchanged into `lib/tactical-board-look.ts`, which both boards import, so the two look like
  one product and a new terrain theme cannot drift between them.
- **The client computes nothing.** Reachable squares and their cost, the path, who a step provokes,
  who may be targeted and where a shape may be aimed with everybody it would catch all come off the
  view. `lib/ruleset-combat-board.ts` indexes them by square; the one number it derives is the
  ruleset's own distance, cells times `perCell`, which is what the whole screen is said in.
- **One focusable thing per square.** Tiles are buttons with a roving tabindex and arrow-key
  movement; tokens are drawn over them with `pointer-events-none`, so clicking a token is clicking
  its square and the keyboard means one thing. Escape leaves a half-made choice and hands the
  keyboard back to the menu, which is the C3 rule: focus returns only when the PLAYER closed it.
- **The half-made choice lives on the board**, which hands it back down to `RulesetCombatMenu`
  through an optional controlled `step`. Without that pair the menu keeps its own state and the C3
  screen is byte for byte the screen it was.
- **The board keeps a floor of its own height**, and the menu, the hint line and the log each bound
  themselves. Measured at 1366x850 and at 375x812 with a fight in progress and a log of 17 lines:
  no horizontal page scroll, no overlapping tokens, the whole board visible at both sizes.
- **Proven** in `scripts/regressions/ruleset-combat-screen-client.regression.ts` (the squares, the
  walk, the path, the target, the aims, the sentences, the "nothing in reach" rule, the distance
  formatter and the four refusals, on both example rulesets) and in a fourth mode of
  `e2e/game-combat-director.e2e.ts` that plays a positioned Ember Roads fight in a real browser.

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
// chat.metadata.gameRuleset?: RulesetRef   (absent means engine-legacy)
```

Written once by game creation, like `gameExperienceId`. `gameRuleset` is declared on the `ChatMetadata` interface, so the GM-verb namespace derivation sees it as Engine-owned. An unknown id, or a pinned `version` newer than the installed definition, makes the game read-only-recoverable with a clear message, never silently reinterpreted. An installed definition newer than the pin is accepted, because sheets are read tolerantly against the current schema. The combat handoff's `RulesetRef` closes `id` to four built-in names; this one widens it to a string so community rulesets can exist, which is part of the sign-off asked for above.

### `ruleset.json` (Capability API 1.20)

A package lists `ruleset.json` in `contributions.assets.paths`, hash-pinned in `files[]`. Discovery is by that reserved filename, as with `gm-verbs.json`. The Engine refuses it on declared bytes above 256 KB before reading, validates it with a strict shared zod schema, and drops it with one log line if unusable. A ruleset package is useless without the seam, so it declares 1.20 and older Engines refuse the install cleanly.

Top-level shape (see the draft file): `id`, `version`, `name`, `edition`, `license`, `coverage`, `resolution`, `sheet`, `rests`, `gm`.

### Resolution kinds

`resolution.kind` is a discriminated union. Two kinds are built:

- **`dice-sum`** (slice 2): roll the ruleset's dice (1d20 by default), add the ability modifier, the proficiency tier's bonus and any free bonus on the sheet, and meet or beat a DC. It supports advantage and disadvantage, and a per-roll-type policy for the extreme faces of a single die. For `5e-2014` that policy is `none` for checks and saves, which is a deliberate difference from `engine-legacy`. The first draft called this kind `d20-sum`; the dice became a parameter so a 2d6-plus-stat system does not need a kind of its own.
- **`dice-pool`** (slice 7b): throw the sheet's own number of dice and count the ones that reach a target, with optional doubled faces, exploding faces, cancelling faces, botches, exceptional successes and situational dice. The same sheet: what `dice-sum` adds to the roll is, here, the number of dice (§ What slice 7b settled).

The sheet math both kinds share (`abilityModifier`, `proficiency`, `proficiencyTiers`) is declared once and spread into each member, so its cross-checks run for every kind and a third one cannot grow a second rule for the same number.

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

Live state belongs in the snapshot because sheet commands are relative ("spend one 3rd-level slot"), and a regenerated turn must not spend twice. It is its own column, `game_state_snapshots.ruleset_live`, which needed no `STORAGE_VERSION` bump. See § What slice 5 settled for how a turn reads and writes it.

Each stored sheet is `{ v, build }` and is refused above 64 KB serialized.

### GM surface

When the game's ruleset resolves, the per-turn format reminder (`buildGmFormatReminder`, never the system prompt):

1. replaces the built-in skill-check paragraph with `gm.checkGuidance` and the difficulty ladder;
2. adds a compact sheet block per party member inside `<character_sheets>`: ability modifiers, trained skills and saves, the `gm.sheetSummary` fields, remaining resources, tracks away from their default, notes, active conditions, and the summary lists;
3. teaches one Engine-owned command, `[sheet: who="Name" op="…" …]`, with a closed operation set: `spend`, `restore` (`heal` is read as `restore`), `damage`, `temp`, `track`, `condition`, `note`, `rest`. The first proposal's `concentrate` became the general `note`.

The Engine validates every operation against the live sheet. A cast with no slot left is refused, logged, written back into the reply as refused, and surfaced once per turn, never applied as a negative pool. `sheet` is in the reserved GM tag set, and the verb-name regression finds the taught tag in the reminder. With no ruleset pinned, the prompt is byte-identical; `game-ruleset-checks.regression.ts` and `one-request-dice-prompt.regression.ts` pin that, and `pnpm regression:prompt` covers the rest of the prompt.

`[skill_check:]` gains an optional `who=`. Without it the player is checked, as today. Saves are requested as `skill="Dexterity save"`, which the existing normaliser already recognises.

One-request dice placeholders gain `PROF` (when the ruleset has a proficiency bonus) and the ruleset's skills, saves and abilities, by id or label, as resolvable names, under the existing rule that an unresolvable name is refused rather than treated as zero.

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

## Proposed: the rest of catalogs

Status: the format, the route, Capability API 1.21 and the sheet editor's picker are built (§ What slice 8a settled). The first-party SRD content shipped as the `ruleset-5e-2014` package 0.2.0, and the combat bridge is built (§ What the combat bridge settled). Scaled catalog values, the `use` command and Refresh from ruleset are built too (§ What slice 8c settled). Raised by the first hands-on use of the 5e sheet: entering spells, attacks and class features row by row is miserable, and a community author will want to ship their system's content the same way.

**The picker.** The sheet editor gains an **Add from catalog** button on every list a catalog feeds. It opens a searchable picker with the catalog's declared filters, multi-select, and a mark on entries the sheet already has, read from the `_catalog` key the picked rows carry. It reads the entries from the catalog route when it opens, never before. **Refresh from ruleset** uses the same mark to offer the newer text of an entry the author has changed (§ What slice 8c settled).

**Catalog entries and combat.** A sheet and its catalogs do not make a battle follow the ruleset. Tactical and Classic battles run on the Engine's own combat model today (`CombatSkill`: a range, an area radius, a slot level, a power multiplier against the attack stat), and the Engine resolves nothing by the ruleset's own rules. A ruleset without a `battle` block is not read by a battle at all; one with the block lends the fight its health, energy, slots and catalog-picked rows through the combat bridge (§ What the combat bridge settled), still on the Engine's math. Rules-accurate resolution (a save for half damage, upcasting, action economy, which metamagic may touch which spell) is code, and it belongs to the combat handoff's per-ruleset adapters (`game-combat-rulesets-implementation.md`, its slice 5 for `5e-2014`), not to a data file. What a catalog CAN carry is the facts such an adapter needs, which is why an entry already has the optional typed `mechanics` block slice 8a shipped: range, area shape and size, attack roll or save (a save the sheet declares, and what a success does), damage dice and type, what one step of a higher cost adds, targets, concentration. Entering the SRD once is the point. The smaller step that was possible before any adapter exists is now built (§ What the combat bridge settled): a ruleset opts in with a `battle` block, a combatant is seeded from the sheet at the start of a battle (health as a share of the Engine's own maximum, an energy pool, slots), catalog-marked rows become Engine skills (range in cells, area, slot cost, element), and health, energy and slots are written back afterwards. The sheet matters in a battle while the damage math stays the Engine's, and the docs and the UI say so.

**Was later, now built.** Maximums that grow with level (Ki points equal to level, Rage uses from a table) and the cast helper (`[sheet: op="cast" spell="Fireball"]` that finds the slot) are both in (§ What slice 8c settled). The entry row carries a value reference with an optional step table for that column, the editor recomputes it on edit and never on read, and the helper is the general `use` command.

**Cheaper helps that need no format change**, worth doing alongside: paste a list of names into a list to create the rows, and the already-listed open decision 1 ("suggest a sheet from this card", reviewed and accepted by the user).

**First-party content for `5e-2014`** once the format exists: SRD 5.1 spells, the SRD class features with their resource counters (Second Wind, Action Surge, Rage, Ki, Channel Divinity, Bardic Inspiration, Sorcery Points, Wild Shape, Lay on Hands, Arcane Recovery), and the SRD weapon table as ready-made attack rows. SRD 5.1 is CC-BY-4.0, so the text may ship with the attribution the package already carries. It must be built from an authoritative machine-readable copy of the SRD, never typed from memory.

**Slices.** 8a, Engine: the catalog format, the asset loader and the route, and the sheet editor's **Add from catalog** picker, with regressions on a second non-5e ruleset. Built. 8b, Agents: `ruleset-5e-2014` 0.2.0 with the SRD catalogs. Shipped. 8c, Engine: scaled catalog values, the `use` command and Refresh from ruleset. Built. Community catalogs in files of their own (§ What slice 8a settled records why they are not here) would be another.

## Slices and exit evidence

Each slice is one PR against `staging`, with a draft PR opened when work starts, a `CHANGELOG.md` `[Unreleased]` entry, localized copy, docs, a `[docs-i18n]` follow-up, and unchecked manual-verification boxes. Proofs are `*.regression.ts`; no `.test.ts` stays in the tree.

| #   | Repo            | Work                                                                                                                                                                | Smallest useful proof                                                                                                                                                                                                                                                                                     |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | n/a             | Open the issue (Appendix) and get sign-off on § Relationship                                                                                                        | Maintainer reply on the issue                                                                                                                                                                                                                                                                             |
| 1   | Engine + Agents | Shared zod schema and types, `RulesetRef`, ruleset registry reading `ruleset.json` from installed packages, package skeleton marked incomplete. No behaviour change | Draft file validates; unknown kind, unknown key, oversized file and duplicate id are refused with a log line; a game with no pin resolves `engine-legacy`                                                                                                                                                 |
| 2   | Engine          | `dice-sum` resolver wired into `skill-check-resolution.service.ts`; GM reminder swap; `who=`                                                                        | Proficiency, expertise, half proficiency, save proficiency, level boundaries 4→5 and 16→17, advantage, natural 20 below DC fails and natural 1 above DC passes; legacy chat byte-identical in prompt and result. Manual: hand-enter a sheet through **Edit Spoilers** JSON and watch a real banner        |
| 3   | Engine          | Sheets on cards and personas: storage, generic Stats subsection, dormant handling, size cap                                                                         | Round-trip through Marinara Native export and import with and without the package installed; persona normalization keeps the key; light, dark and 400 px screenshots                                                                                                                                      |
| 4   | Engine          | Rules choice in the setup wizard, missing-sheet handling, copy-at-setup, setup sharing                                                                              | New game copies the build; library card unchanged after in-game edits; setup import without the package falls back with an explanation                                                                                                                                                                    |
| 5   | Engine          | In-game ruleset sheet, live state, `[sheet:]` command, rests, reserved-tag sweep                                                                                    | Spend then swipe restores the slot; regenerate does not double-spend; cast with no slot is refused with a visible notice; long rest restores half hit dice with a minimum of one; verb named `sheet` is refused                                                                                           |
| 6   | Agents          | Finish and stage the package                                                                                                                                        | `validate-catalog.mjs` green; install, update and uninstall on a staging Engine; a game whose package was uninstalled opens read-only-recoverable                                                                                                                                                         |
| 7a  | Engine          | Community lanes: **Import ruleset** for one file, and `rulesets/*.json` read by the existing custom agent repository lane                                           | A namespaced id cannot shadow an official one; the preview lists added, changed and removed rulesets; same version with different bytes is refused; a game keeps its pinned version after an update; turning the import toggle off hides community rulesets from new games without breaking existing ones |
| 7b  | Engine          | `dice-pool` resolution kind. Built                                                                                                                                  | Built: the schema refusals, every pool rule with an injected die sequence, the clamps, the tag attributes, the prompt line per kind, the 1.24 install gate, the legacy pool path unchanged and the sighted pool falling back blind                                                                        |
| n/a | Engine          | `5e-2014` combat adapter                                                                                                                                            | Combat handoff slice 5, after its slices 1–4                                                                                                                                                                                                                                                              |

Slices 1 and 2 come first because they are testable end to end with no UI at all, which is the cheapest way to find out the schema is wrong.

Slice 7a depends only on slice 1, and 7b only on slice 2. Neither should wait for 3–6: the request came from a community author, and under a strictly numbered order they would be the last person served. Run 7a and 7b in parallel with the sheet UI once slice 2 has merged. Both are built.

## Open decisions, with defaults

1. **Companions without a sheet.** Default: blank build plus manual entry. An optional "suggest a sheet from this card" action that the user reviews and accepts is a reasonable later addition and stays consistent with "generation does not manufacture authoritative stats", because acceptance is the user's act.
2. **XP or milestones.** Default: the sheet stores XP, nothing awards it automatically, and level is edited by hand.
3. **Command tag name.** `[sheet:]` is a proposal; any name works provided it joins the reserved set.
4. **Who builds `dice-pool`.** Default: invite the requester to specify it on the issue, and to contribute it if they want to. They have a working implementation and the systems knowledge; the Engine side supplies the seam and review.

5. **Layers on top of a ruleset (for example Low Magic on 5e).** Settled for L1, layers a ruleset ships inside its own file; see § What layers L1 settled. L2, layers shipped by SOMEONE ELSE (a package asset or an imported file naming `appliesTo: { ruleset, minVersion }`, stored and versioned like a community ruleset, plus a "layer missing" resolution status), stays open and reuses L1's format and application unchanged. It is not designed further until L1 has merged.

## Not verified for this document

`game-state.storage.ts` and whether a snapshot field needs a storage-version bump; the Compatible JSON and PNG export paths; `GameSetupWizard.tsx` and where the Experiences block writes `gameExperienceId`; `game-setup-share.ts`; how the custom agent repository lane surfaces in the client, and whether its archive reader tolerates extra top-level folders; the sighted dice pool's interaction with a ruleset resolver; `game-combat-ai-design.md`.

## Appendix: issue draft

> **Game Mode: selectable rulesets and ruleset character sheets (5e first)**
>
> Requested by the author of Marinara-RPG-Extension, who currently needs four or five per-turn agents per system to work around d20-only checks and the six-attribute sheet. Proposal: a ruleset is validated data (`ruleset.json`, a reserved-filename package asset like `gm-verbs.json`) that parameterises a closed, Engine-owned set of resolution kinds and declares a full character sheet. No package code, no expression strings, and no added model calls. Sheets live on cards and personas as starting builds and are copied into each game.
>
> This reads the combat handoff's "closed registry of built-in adapters" as applying to resolution kinds and combat adapters, with ruleset definitions as data. Is that acceptable, and is anyone working on something adjacent? First-party scope is `5e-2014` on SRD 5.1. Combat is unchanged and stays with the combat handoff. Full plan: `docs/development/game-rulesets-and-sheets-implementation.md`.
