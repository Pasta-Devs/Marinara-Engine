# Versioned combat rulesets: implementation handoff

> **Status header, September 19, 2026.** The `5e-2014` adapter this document reserves is being built
> as a DATA-DRIVEN combat kind rather than a per-system TypeScript adapter: a ruleset declares an
> optional `combat` block and the Engine owns the kind that resolves it, exactly as it owns the
> resolution kinds that resolve a check. The reasoning, the architecture and the slices are in
> `game-rulesets-and-sheets-implementation.md` § Real ruleset combat, and the work is tracked on
> [issue #6361](https://github.com/Pasta-Devs/Marinara-Engine/issues/6361). Everything else in this
> document stands: the Traditional ruleset and its accepted speed behaviour, the product contract,
> the rule that difficulty belongs to the ruleset and never becomes a damage multiplier, the
> director's single server-owned ledger, the reaction and legendary windows, and the save, UI and
> rollout contract. As of slice C3a the kind is WIRED: a fight
> is resolved on the director's existing ledger as a third `style` beside `classic` and `tactical`,
> with the same revision, idempotency, mutex and single "pick a candidate id" model call. As of
> slice C3b it is ON SCREEN: a game whose ruleset declares `combat` plays the fight on the Classic
> shell with the ruleset's own menu, its own words and the real arithmetic in the log, and the
> sheets are written as the fight runs rather than afterwards. As of slice C4a it has POSITIONS: a
> ruleset that declares `combat.distance` can be fought on the tactical engine's own generated
> board, with movement, reach, ranges, burst, cone and line areas, line of sight, cover and strikes
> at somebody walking away all resolved from the ruleset's own numbers, and an opponent that moves.
> The board is not drawn on screen yet, so a positioned fight is reachable only through the API
> until C4b; reactions and the windows signature actions are used in are still to come, in C5.

Status: implementation proposal, September 17, 2026. The AI overhaul does not implement these rulesets. Traditional's speed-follow-up requirement is accepted product direction; thresholds and other defaults below are proposals for tuning. Implement against current `staging`, after checking related work.

## Product contract

Keep four choices independent:

| Choice        | What it controls                                  | Examples                                  |
| ------------- | ------------------------------------------------- | ----------------------------------------- |
| Presentation  | Spatial information and input                     | Classic menus; Tactical grid              |
| Participation | Who fights                                        | Party; future Summoning                   |
| Ruleset       | Legal actions, resources, turn timing, resolution | Traditional; explicitly versioned 5e; V20 |
| Controller    | Who chooses a legal action                        | Player; local AI; GM bosses               |

A Cautious Mage must remain cautious in either presentation. Changing ruleset changes what the Mage is allowed to do, not its personality. Summoning is a participation system, not a third rules engine; its first presentation can be non-spatial. No mode may invent grid distance when no position model exists.

Show readable descriptions in product UI. Avoid comparisons to other games in the Traditional or Tactical description. Rulesets intentionally named for an implemented system must identify the precise supported edition and coverage.

### Difficulty must belong to the ruleset

The current Engine's enemy damage multipliers (Casual 0.6, Normal 1, Hard 1.3, Brutal 1.6) are intended only for Traditional. Revisit them when implementing alternative rulesets: 5e, V20, and later adapters must not automatically inherit these multipliers. Define difficulty using each ruleset's own encounter and resolution model. Keep enemy AI decision tuning separate from arithmetic damage scaling. Add an adapter regression proving that selecting an alternative ruleset does not silently apply the Traditional table. This note does not rename current legacy mechanics to an implemented Traditional ruleset.

## Current source and constraints

- `packages/shared/src/types/game.ts`: `Combatant`, `CombatSkill`, Classic results and snapshots. Current stats are generic numbers; `speed` is not a tabletop Dexterity score or feet of movement.
- `packages/server/src/services/game/combat.service.ts`: Classic rolls initiative each round, resolves one command per participant, and uses generic damage formulas. Legacy games round-trip state through the client; new wizard games use the server-owned combat director ledger.
- `packages/shared/src/features/tactical-combat/{engine,math,types}.ts`: alternating party/enemy phases, class-based range and speed-derived movement, counters, no speed follow-up yet.
- `packages/shared/src/features/combat-ai.ts` and mode adapters: priorities over available actions. Ordinary AI keeps its information boundary; GM bosses receive party sheets/resources for anticipation, but neither sees future rolls or player choices before their declaration.
- `packages/server/src/routes/combat-director.routes.ts` and `services/game/combat-director.service.ts`: versioned authoritative encounter state, activation cursor, pending reactions, legendary budgets and duplicate/stale reply protection. Extend this accepted-action path for ruleset adapters instead of creating a second ledger. Current Counterspell chance, slot payment and cancellation cost are generic Engine policies, not 5e rules.
- `packages/server/src/routes/game.routes.ts`: legacy round/start/action validation. `GameCombatUI`, `TacticalCombatUI` and `use-game.ts`: inputs, previews, accepted results and persistence.
- `GameSurface.tsx`: generated blueprint hydration and combat snapshots. `encounter.routes.ts`: encounter-generation prompt. `game-setup-share.ts`: reusable setup import/export.

Do not rename today's damage formula to Traditional without implementing and verifying the accepted speed behavior. Do not label a d20 roll plus current Engine stats as 5e compliance.

## Minimum architecture

Start with a closed registry of built-in, pure TypeScript adapters. Do not add a scripting language or arbitrary executable rules packages. Reuse the existing legal action and result types where possible; extract a shared helper only after both callers need it.

Persist a pinned reference on each new encounter:

```ts
type RulesetRef = {
  id: "engine-legacy" | "traditional" | "5e-2014" | "v20";
  version: number;
  options: Record<string, boolean | number | string>;
};
```

Each adapter validates its own closed options schema, rather than accepting the example record unrestricted. Include a supported capability list (movement, counter, spell slots, blood spending, summons, boss reactions). Reject an unsupported explicit option with a useful error. Missing ruleset data means `engine-legacy`, never automatic migration to Traditional.

A small interface should cover:

1. Validate/normalize a rules-specific character sheet without guessing conversions.
2. Start an encounter, roll or establish order once at the appropriate rules-defined time.
3. Start an activation: replenish allowed budgets, tick the appropriate statuses.
4. Enumerate legal actions and optional reactions, their target sets, range, cost and timing window, including pass.
5. Produce a read-only forecast without consuming RNG.
6. Accept an action declaration, record its resource commitment, and expose supported trigger windows before effects resolve.
7. Resolve pending effects/reactions into ordered events and resource deltas; expose activation-start/after-activation boss windows only where enabled.
8. End a round when its participants are exhausted; advance round-limited effects once.

The same adapter feeds player input, ordinary AI, GM candidate menus and previews. The GM cannot supply final HP, fabricated skill IDs, a new turn order or free resource changes. Legality uses accepted state; decision contexts expose the information appropriate to their controller and timing window. GM bosses know party skills, spell points/slots, cooldowns and usable inventory for threat prediction. Uncommitted selections and other queued actions remain private until their declaration. A forecast reports expected values, not future die results.

Keep ruleset-specific sheets in a discriminated union. Do not force all resources into `mp`: MP, slot counts, Blood Pool, Willpower, per-round spends and per-rest uses have different semantics. UI bars and ability costs read descriptors from the selected adapter. Store current and maximum resources separately; normalize names only for display, never as resource identity.

## Traditional v1: accepted speed behavior

**Every living eligible participant gets at most one ordinary activation and one combat initiation per round. A speed follow-up is another strike inside that exchange, not another activation.**

Proposed starting balance:

| Rule                | Proposed v1 behavior                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Initiative          | Descending effective Speed, stable encounter tie order; no extra activation for ties or high speed                           |
| Tactical scheduling | Party phase followed by enemy phase; player may choose unacted party units, automatic units use speed order                  |
| Classic scheduling  | Unified descending effective-Speed order; UI queues manual commands then resolves current legal targets at each slot         |
| Movement            | Explicit movement budget independent of Speed. Suggested default 4 tiles, with bounded class/ability adjustments             |
| Attack Speed        | Effective Speed, with only explicitly modeled penalties/bonuses; no fictional weapon weight                                  |
| Follow-up threshold | Attacker Attack Speed at least defender Attack Speed + 5; configurable only as a validated ruleset option                    |
| Eligible action     | Basic attack or a skill explicitly marked `allowsSpeedFollowUp`; default false for skills                                    |
| Exchange            | Initiator strike → legal surviving defender counter → eligible surviving initiator follow-up                                 |
| Faster defender     | One legal counter in v1; a defender follow-up is a separate balance option, default off                                      |
| MP                  | Explicit pool and per-skill cost, deducted once per chosen skill activation; follow-up costs must be specified by that skill |
| Movement refresh    | Once at the next ordinary activation; counter/follow-up never refresh it                                                     |

The threshold of 5 and exchange ordering are Marinara proposals, not a claim to reproduce any particular game's rules. The maintainer requested the faster attacking unit to strike twice; implementing defensive doubling is not required by that request.

Recheck alive state, target validity, range, disabling conditions and remaining budgets between strikes. A unit killed by the counter cannot follow up. A missed first strike does not itself cancel a speed-based follow-up. A defeated target cannot be hit again or replaced silently within the same exchange. Prevent counter-to-counter recursion. A counter does not spend the defender's ordinary initiation, nor grant another one. Heal, buff, item, summon and legendary actions do not double unless an explicit supported ability defines that exception.

Compute eligibility from accepted effective stats at exchange start; apply mid-exchange disabling effects immediately, but do not retroactively add more strikes after a speed buff during the exchange. Put the result in the event list, with a forecast showing one or two strikes and counter eligibility. Refresh during an animation replays accepted events, never rolls or spends twice.

Classic has no movement range: either omit movement or provide a separately defined engagement model. Traditional counters in Classic require an explicit `canCounter` rule; do not copy grid-range checks onto array positions. Recommended v1 is to keep Classic counters off until basic melee/ranged engagement is defined, while retaining attacking-unit speed follow-ups.

## 5e profile: name the edition before coding

Recommended first target: `5e-2014`, pinned to SRD 5.1. A later 2024/SRD 5.2 profile needs its own identifier/version and tests; do not silently combine the editions. The official [SRD index](https://www.dndbeyond.com/srd) publishes the versions, and [SRD 5.1](https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf) is the primary reference for the first target.

Audit the primary reference before implementing: Dexterity-based initiative; movement measured in distance; action, bonus-action and reaction availability; spell slots; concentration and conditions; distinct attack rolls and saving throws. These require dedicated sheet fields and resolution fixtures. Generic Engine level/attack/defense cannot substitute for them. Spell points are an explicitly selected variant with its own reviewed source and limits, not a renamed slot pool.

Ship an honest supported subset first, such as basic weapon attacks, movement, Dodge and a small supported spell list, with unsupported actions unavailable. Do not claim a complete 5e ruleset on the strength of one initiative formula. Keep Traditional doubling disabled; extra attacks arise only from implemented profile abilities.

## V20 profile: dedicated audit required

Target Vampire: The Masquerade 20th Anniversary Edition, not V5 or V20 Dark Ages. Obtain the appropriate primary rules reference before coding exact initiative, declaration order, multiple actions, Celerity, damage/soak, wound penalties and resource-spend limits. No exact V20 formula is approved by this handoff.

Reserve a rules-specific sheet for Attributes/Abilities, health levels, Blood Pool and Willpower, with per-turn spending constraints where supported. Do not convert Blood Pool to generic MP or Celerity to Traditional speed doubling. Tests must cite the edition and rule passage used; a forum answer or Dark Ages preview is not sufficient authority for modern V20 behavior. Resolve content reuse and attribution against the actual selected source before distributing copied text or stat blocks; this document provides no such content.

**Health levels are the blocker, and they are both halves at once: the sheet cannot hold the track, and the combat resolver could not read it if it could.** V20's track is seven named levels carrying a penalty each, marked with bashing, lethal and aggravated damage that sorts and upgrades. None of that can be written today: a `live.tracks` entry is a bounded integer, `combat.health` refuses anything but a `live.pools` id, and nothing in the Engine reads a track and modifies a roll. The format half is in `game-rulesets-and-sheets-implementation.md` under "Proposed: health that is a track, not a number" (#6407). The combat half belongs here: `combat.health` names a `live.pools` id today, `rulesetCombatHealth` reads one number with a temporary buffer, and `dealDamage` subtracts from it, so marking a track, reading the penalty in force and carrying it into an attack or a save are all this document's work once the format can say them. A V20 profile is not worth starting before it exists, because the thing that makes the system feel like itself is taking a beating and fighting on worse.

## Legendary actions, anticipation and reactions

Accepted direction: GM bosses can have legendary actions even under Traditional or other non-5e rulesets. This is an explicit **boss encounter modifier**, independent of ordinary initiative, temperament and participation. See the AI design document's boss section.

The adapter exposes `afterActivation`, and an enabled Marinara anticipation modifier can also expose `activationStarted` after an actor commits to begin its turn. Both legendary windows spend the **same** finite boss pool. Raw clicks, inspection, cancelled menus and refresh do not open more windows. The GM can predict Fireball from the mage's available kit/resources and actual area/friendly-fire rules before the player declares a spell; it cannot read a future command. This anticipation is a house-rule extension to 5e's after-turn timing, explicitly pinned to the encounter. A faithful profile retains native timing unless the modifier is enabled.

Traditional's one-initiation rule applies to ordinary activations; an authored legendary action grants no ordinary activation or speed follow-up. Classic must suspend at the actor's initiative slot rather than interrupting early while the UI collects a whole round's orders. Revalidate queued commands after an interruption and request a replacement if they become illegal before commitment. Tactical needs a distinct activation-start commitment so browsing units is safe and reselection cannot farm interrupts.

Reactions such as Counterspell belong to supported **event triggers**, independently of legendary status. Define at least trigger event, pre/post-effect timing, visibility/range, resource cost, reaction allowance/refresh, outcome and original-action cancellation/refund behavior. The boss GM and ordinary AI use the same legal windows; manual units receive a React/Pass choice. AI automatically evaluates the window and may pass based on temperament, threat value, success estimate, MP/slot scarcity and the cost of losing its reaction. Availability alone never forces spending. An ordinary unit can react without becoming a boss.

Counterspell requires a pending cast, not merely a selected mage. Keep distinct MP/point/slot resource types. The [2014 spell](https://www.dndbeyond.com/spells/2051-counterspell) uses spell-level/check rules, whereas the [2024 spell](https://www.dndbeyond.com/spells/2619072-counterspell) uses a Constitution save and specifies that a successfully interrupted slot-based spell does not expend its slot. Do not apply the 2024 original-spell refund to all editions or to the reacting caster's payment. Traditional needs an explicit tuned interrupt operation; V20 should map its own reactive abilities rather than inherit Counterspell by name.

Reserve and commit resources atomically with accepted declarations/reactions, recording rules-specific refunds separately. Proposed Traditional default: one reaction allowance, initially available unless an explicit encounter condition prevents it, replenished at the unit's ordinary activation start. Other adapters define their own allowance/refresh boundary. Legendary actions and follow-up strikes never refresh it implicitly. Keep existing exchange counters distinct unless explicitly mapped. If a legendary option casts a spell, expose spell reactions only as permitted by the selected rules.

Use a bounded saved pending-action stack with parent/trigger IDs for supported nested reactions, stable reactor priority and revalidation after each response. An already cancelled cast cannot be countered again. Passing closes that unit's opportunity for that trigger. A limited adapter must disclose unsupported counter-reaction chains. Resolve accepted events once and derive narration from them; the reversible text interruption in [PR #6110](https://github.com/Pasta-Devs/Marinara-Engine/pull/6110) is persistence/context precedent, not permission to roll back combat by truncating prose. See AI design section 16 for the full lifecycle and acceptance matrix.

## Save, UI and rollout contract

- Pin ruleset id, version, effective options, unit controllers, sheets, initial order, current/committed activation, legendary/reaction budgets and refresh points, pending-action stack, trigger/decision IDs, resource commitments/refunds, cooldowns, RNG state and accepted interruption decisions in the encounter snapshot.
- Require a server-owned revision/action ledger before asynchronous GM decisions. Reject stale concurrent submissions and make retry idempotent. A browser-stored candidate ID is insufficient.
- Changing game settings affects the next encounter. Preserve the active battle's pinned rules, including after import, checkpoint/branch restore, reconnect and update.
- Keep old in-progress combats on `engine-legacy`. Offer explicit conversion for a future battle with a preview of unmapped stats/resources; never silently overwrite sheets or saved pools.
- Unknown rule versions are read-only/recoverable, not silently interpreted as the latest version.
- Introduce a localized **Combat rules** selector separately from **Combat presentation** and future **Participation**. Briefly describe order, resources and key behavior; show compatibility limitations before starting.
- For missing required sheet fields, request those fields before combat; use legacy rules only through an explicit selection. Do not let generation manufacture authoritative character stats.

## Implementation sequence and exit evidence

| Slice | Work                                                                                            | Smallest useful proof                                                                                                          |
| ----- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Inventory existing resolvers, define pinned identity and legacy adapter                         | Legacy saves and both current presentations reproduce their prior behavior                                                     |
| 2     | Implement Traditional activation/exchange and explicit resource accounting                      | Speed boundary matrix; one initiation/round; MP and cooldown accounting                                                        |
| 3     | Wire previews, UI selection and saved accepted events                                           | Preview/resolution agreement; refresh/import/checkpoint tests; desktop/mobile screenshots                                      |
| 4     | Add declaration/effect boundaries, optional reactions, boss anticipation and after-turn windows | No selection farming or future-command leakage; AI may pass; costs/refresh/refunds correct; no ordinary extra turn or doubling |
| 5     | Implement a stated 5e-2014 subset from primary references                                       | Edition-specific positive/negative examples for every supported action                                                         |
| 6     | Audit and implement a stated V20 subset                                                         | Verified initiative, resource limits and damage examples; no accidental 5e/Traditional math                                    |
| 7     | Adapt Summoning budgets/command ownership                                                       | Spawn/dismiss/death timing, population cap and no summon-based action multiplication                                           |

Traditional acceptance cases: speed gap 4 vs 5; equal speed; counter kills attacker; first strike kills target; first strike misses; incapacitation mid-exchange; ranged counter unavailable; cooldown/MP insufficient; player/AI/GM use identical legality; two fast units still initiate only once each; legendary action does not reset those flags; round refresh restores budgets once; unknown version fails safely.

Reaction/anticipation acceptance cases: actor selection versus committed activation; repeated selection/reload; exact Classic slot; affordable Fireball threat versus exhausted mage; prediction can be wrong; optional weak-spell pass versus high-value counter; insufficient reaction/MP/slot; failed counter still charged; original cast's edition-specific refund; out-of-range/unseen trigger; multiple reactors; supported nested counter and bounded-stack limits; stale response after target death; revalidate interrupted queued choice; native versus house-rule timing; no hidden queued orders or future RNG in controller prompts.

Run `pnpm install`, `pnpm check`, focused `*.regression.ts` proofs, prompt regressions when changing GM/schema prompts, and UI smoke coverage on both presentations. Follow the repository issue/PR workflow and include localized UI copy, changelog, translation follow-up and CodeRabbit before review. Leave PR manual-verification checkboxes unchecked.
