# Game Mode combat AI: enemies, companions and GM bosses

**Status: ordinary AI and the first GM boss/reaction implementation are present locally; Summoning and named rulesets remain proposals.** Prepared September 17, 2026 from the combat code merged into staging by [PR #6266](https://github.com/Pasta-Devs/Marinara-Engine/pull/6266). Original audited staging baseline: `1f2e965c34f77b19a1457439f61e291300e163c7`; checkout `025442b1722b090b4640e0f078d1e08a4435f965` had the same relevant combat implementation. The current local implementation branches from staging `abe61d30a`. Recheck staging before follow-up implementation; the original audit's line numbers describe its earlier baseline.

This document is self-contained so another development task can continue without the original conversation. It records the maintainer's requirements, a source audit, recommended defaults, implementation boundaries, and acceptance scenarios. Proposed numbers and fields outside the implemented boundary in section 13 are not existing contracts or playtested balance claims. The implementation and handoffs are local work; no issue or PR has been submitted.

## September 17 scope update

The maintainer approved ordinary AI in Classic and Tactical plus optional AI companion control, then authorized implementation of the GM boss/reaction follow-up. Authored bosses can use legendary actions independently of whether the player chooses a 5e ruleset. The GM receives the party's combat sheets/resources and can anticipate likely actions when a unit begins its activation. Resource-consuming reactions such as Counterspell require a controller decision, not unconditional use whenever available. Summoning remains a design extension. The original source audit and fuller design below are retained; sections 13–17 specify the current decisions and supersede tactical-only sequencing, the eight-adjective launch proposal, earlier exploration-only scope statements, and the original observed-state-only boss prompt.

The runtime work is a first utility-policy implementation, not completion of every acceptance scenario in this document. Its boundaries are recorded in sections 13 and 16. The separate [ruleset implementation handoff](game-combat-rulesets-implementation.md) covers Traditional speed follow-ups, turn/movement order, resource pools and future edition-specific profiles.

## 1. What the maintainer asked for

- Ordinary enemies use engine-controlled behavior described by **one adjective plus a combat role**, such as Reckless Bruiser or Cautious Spellcaster.
- **Only boss-level enemies receive per-turn GM control.** The engine still determines legal actions and resolves their outcomes. Boss control means choosing actions during the fight, not merely generating a script before it.
- Adjective assignment weighs proficiency/level, role, and known personality, with some randomness. Experienced enemies should more often have habits suited to their role, without making every veteran identical.
- **Every Beast and Monstrosity is Mindless.** It pursues the nearest party member by the shortest legal route, ignoring target health and terrain advantages/disadvantages. Do not quietly exempt bosses or named creatures.
- Optimize for strategic fun, plausible behavior, and replayability, especially tactical and future tabletop-like play. This does not require implementing 5e or V20 rules in the AI change.
- Preserve a detailed design for later implementation. The original exploration scope has since been extended to ordinary AI and companion control; see the scope update above.

Related direction lives in [the combat roadmap](game-combat-roadmap.md): battlefield rules, party/summoning participation, and tabletop rules profiles are independent choices. Enemy tactics should also remain independent of them. Summoning stays a later priority.

### Recommended defaults that still need design acceptance

1. Start with eight adjectives: Mindless, Reckless, Cautious, Opportunistic, Protective, Supportive, Disciplined, Cowardly.
2. Show the adjective and role in enemy inspection, with a short explanation. Keep probabilities, utility weights, and raw personality analysis out of normal UI.
3. Interpret Mindless's shortest route as **fewest legal spatial steps**, not lowest terrain movement cost. It may plow through a shorter forest route even when a longer open route would be faster. Movement still consumes the terrain's actual cost.
4. A Beast/Monstrosity boss remains Mindless. The GM chooses only among actions consistent with its required target and pursuit behavior.
5. Ordinary profiles are sampled once and saved. A named recurring NPC retains its established temperament; gaining a level alone does not reroll its personality.
6. Implement ordinary AI in Tactical and Classic together under the revised scope. Completion of the full requested system includes actual GM boss turns; an engine-only milestone must not be described as the whole feature.

## 2. Source audit before the overhaul

The maintainer's second hypothesis is closest: each active combat engine has a common automatic policy. The GM authors the encounter; it does not choose individual turns in the active Game Mode battle UIs.

| Area                    | Classic Game Mode                                                         | Tactical Game Mode                                                            |
| ----------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Turn order              | Initiative rolls plus speed; all combatants participate                   | Player phase, then enemies in effective-speed order                           |
| Enemy policy            | Shared skill heuristic, otherwise random living opposing target           | Shared heal-first, scored attack, then approach policy                        |
| Class differences       | No class-specific decision policy                                         | Six classes change range, movement and crit; all use the same decision policy |
| Personality/proficiency | No stored tactical personality or training model                          | No stored tactical personality or training model                              |
| Boss decisions          | Same ordinary policy, plus supported scripted mechanics                   | Same ordinary policy; boss label affects placement/UI                         |
| GM during each turn     | Not in the active resolver                                                | Not in the active resolver                                                    |
| Reproducibility         | Uses unseeded random decisions/rolls                                      | Seed plus action counter governs decisions and combat rolls                   |
| Persistence             | Client restores combat snapshot; round/animation state is not fully saved | Client persists the complete tactical snapshot in chat metadata               |

There is also a separate encounter-modal system with a model-driven `/encounter/action` route and combat-action types. It is used by the general chat `EncounterModal` through `useEncounter`, not by Game Mode's current `GameCombatUI`. That model can return rewritten combat state; do not reuse it unchanged for the proposed engine-validated boss controller. Trace actual callers before reusing or deleting anything.

Classic's explicit **Special** maneuver also asks the GM to adjudicate a narrative action and permits supported status/element tags. It does not resolve an ordinary round or select routine enemy turns. Preserve this distinction when updating GM prompts; “boss-only turn control” does not prohibit encounter generation, narrative adjudication or post-combat narration.

### Classic policy

In `combat.service.ts`, `resolveCombatRound` calls `chooseAutoSkill` for automatic allies and enemies:

1. A skill is considered usable if MP is sufficient and its cooldown passes a round-modulo check.
2. Heal the most injured eligible ally if at or below 75% HP and a heal skill is available.
3. Otherwise, with a 45% chance, choose a random non-heal skill and random enemy target.
4. Otherwise attack a random opponent.

Enemies pass only themselves as the allies list, so they do not currently heal other enemies through this policy. Non-heal includes buffs as well as attacks/debuffs; any replacement must validate the intended side for each skill instead of retaining that grouping. In practice, the generated-enemy MP omission below prevents those enemies from using their positive-cost skills, leaving random-target basic attacks. The first living player-side combatant receives the submitted player command; other allies act automatically. Changing enemy tactics must not silently change companion control or player identity.

Generated mechanics are processed separately after normal actions. Only `round_interval` and `hp_threshold` currently execute; accepted `on_hit`, `on_attack` and `passive` triggers do not. HP-threshold mechanics repeat in later qualifying rounds, and `damage_one` selects the first opposing target. This is not a live GM choosing a boss move. Explicitly distinguish one-shot and recurring effects before adapting them.

Classic also resolves non-heal skills through a damage-oriented path; buffs/debuffs are not equivalent to Tactical support operations, although a named status can accompany a hit. Real support/control semantics and per-use cooldown state are prerequisites to advertising those Classic behaviors. Automated defend/wait actions also need resolver support; current defend belongs to the controlled player's initiative slot, so faster enemies act before it applies. Difficulty currently scales both sides' attack damage through the common resolver, not decision quality. Preserve or change that separately from temperament tuning.

A separate existing player-control mismatch deserves its own proof: the server transfers commands to the first living ally when slot zero is KO, while the UI's active player index stays at zero. An unavailable skill ID can then fall back to a basic attack. Record/fix that independently rather than coupling it to enemy temperament.

### Tactical policy

`packages/shared/src/features/tactical-combat/ai.ts` currently:

1. Tries the first ready heal skill on the lowest-HP-fraction ally within two tiles, if that ally is at or below 60% HP. It does not move into healing range first.
2. Evaluates reachable movement destinations against living opponents, considering basic attacks and ready attack skills.
3. Scores attacks as `1000 * likelyKill + expectedDamage - 0.75 * counterRisk`. Here, likelyKill means forecast damage reaches current HP and hit chance is at least 50%; it is not a guaranteed kill.
4. Occasionally replaces the best non-kill attack with another random legal attack. The probabilities are 60% casual, 30% normal, 10% hard, 0% brutal. Heal acceptance is 50%, 80%, 100%, 100%, respectively.
5. If no attack is available, approaches the Manhattan-nearest opponent using the reachable tile closest in Manhattan distance. This is not whole-board shortest-path pursuit and can fail to progress around obstacles.

Terrain influences movement and damage/hit forecasts, but the policy has no general assessment of where the unit will be exposed during the next player phase. It does not deliberately select buffs, debuffs, defend, or items. Skill range is simplified. Generated AoE descriptions do not constitute a complete spatial AoE resolver.

Classes are Fighter, Knight, Rogue, Archer, Mage and Healer. Class derivation uses an explicit hint, healing skills, name/skill keywords, elemental attacks and stat heuristics. A role label alone does not create abilities.

### Foundational gaps that would undermine a personality system

These are source-inspection findings, not claims from an executed browser reproduction:

| Gap                                                     | Evidence and consequence                                                                                                                                                    | Narrow next step                                                                                                                                                         |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Generated enemies have no MP                            | `generatedEnemyToCombatant` omits MP/maxMP; generated non-basic skills have positive MP costs. Both engines treat missing MP as zero. Such enemies cannot use those skills. | Add a regression through actual blueprint hydration; preserve explicit resource data or apply a documented generated-enemy resource rule. Do not grant unlimited spells. |
| Level is inferred from HP                               | Generated enemy level normally comes from rounded maxHP/20. A durable creature is not necessarily tactically trained.                                                       | Add a bounded proficiency hint; use level only as a declared fallback until rules profiles supply proper training data.                                                  |
| Boss identity is heuristic                              | Tactical labels the strongest enemy in packs of two or more using maxHP + level\*10 + attack. A solo enemy is never marked by that heuristic.                               | Add explicit per-enemy boss identity. Encounter music tier alone cannot identify which unit gets GM turns.                                                               |
| Generated boss mechanics do not reach Tactical          | Classic gets mechanics props; Tactical does not consume the generated mechanics list.                                                                                       | Map supported mechanics into validated tactical operations, with saved phase/trigger state. Label unsupported mechanics rather than narrating them as executed.          |
| Creature type and personality are not runtime contracts | Enemy description exists in the blueprint but is discarded in runtime hydration; Beast/Monstrosity are not typed categories.                                                | Carry explicit category and bounded assignment inputs through all conversion and persistence boundaries.                                                                 |
| Tactical range is distance-based                        | Walls block walking but do not currently block ranged attacks. No common line-of-sight/cover model exists.                                                                  | Treat LOS/cover as a separate resolver change affecting previews, actions, counters and AI together.                                                                     |
| AI candidate forecasts can diverge from resolution      | Counter-risk forecasting passes the attacker at its original position even when evaluating a different destination; inspect defender terrain in `forecastFrom`.             | Reproduce with different original/destination terrain and correct the forecast before tuning risk-sensitive profiles.                                                    |

Another conversion gap affects both engines: generated attack kind is inferred from English keywords in its name/description, while encounter prose can be generated in other languages. The blueprint's `AoE`/`both` flag also does not survive as actual multi-target behavior. Explicit, validated capability fields should supply future role derivation; translated names must not determine whether a spell heals or attacks.

Do not bundle a full combat rewrite into these prerequisites. Add the smallest proofs, fix the relevant flow, and reuse existing movement, forecast, skill-readiness and action-resolution helpers.

## 3. Separate capability, temperament and control

Each enemy needs answers to different questions:

| Dimension           | Meaning                                          | Example                                                                |
| ------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| Creature category   | Applies required type rules                      | Beast forces Mindless                                                  |
| Role                | What its actual kit is suited to doing           | Supporter has usable healing/buff abilities                            |
| Temperament         | What it values when choosing among legal actions | Cautious values staying out of danger                                  |
| Proficiency         | How consistently it executes its habits          | A veteran Reckless Bruiser still takes risks, but wastes fewer actions |
| Controller          | Who chooses the action                           | Engine for ordinary enemies; GM for explicit bosses                    |
| Encounter objective | What the side is trying to achieve               | Defeat party now; protect/escape/capture later                         |

Use one primary adjective initially. Do not introduce arbitrary trait stacking, a personality vector editor, behavior-tree dependencies, or a general planning framework. A small profile table around shared legal candidates is sufficient.

### Roles based on capabilities

Keep existing tactical classes as geometry/stat presets. A small policy-role mapping may refine them when the kit justifies it:

| Proposed role | Capability evidence                                | Typical job                                          | Likely adjectives                    |
| ------------- | -------------------------------------------------- | ---------------------------------------------------- | ------------------------------------ |
| Bruiser       | Strong close-range attacks                         | Close and trade damage                               | Reckless, Disciplined, Opportunistic |
| Bulwark       | Durable melee kit                                  | Hold a useful position near vulnerable allies        | Protective, Disciplined, Cautious    |
| Skirmisher    | Mobility plus useful close-range damage            | Pick favorable engagements                           | Opportunistic, Cautious, Reckless    |
| Marksman      | Sustained ranged attacks, possibly a minimum range | Maintain a useful firing distance                    | Cautious, Disciplined, Opportunistic |
| Spellcaster   | Usable offensive magic and its resource pool       | Apply ranged pressure without wasting limited skills | Cautious, Disciplined, Opportunistic |
| Controller    | Usable debuffs/control effects                     | Weaken a relevant threat                             | Disciplined, Opportunistic, Cautious |
| Supporter     | Usable healing/buff kit                            | Keep the group effective                             | Supportive, Protective, Cautious     |

These are priors, not prohibitions. A Cowardly Fighter or Reckless Spellcaster must remain possible. A Cleric with armor and melee abilities may be a Bulwark; a healer may prefer the back line. Do not infer temperament from a class stereotype alone. Temporary MP exhaustion changes legal actions, not the saved role or adjective. Do not assign Supportive to a kit that never had support capabilities.

## 4. Adjective catalog

### Initial eight

| Adjective         | Target preference                                                             | Positioning and risk                                                                                    | Skill/resource behavior                                                                                      | What the player can learn                                   |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **Mindless**      | Nearest living reachable party member, by the rule in section 6               | Shortest legal spatial route; ignores terrain utility, exposure and formation                           | Simple legal attack at that target; no healing triage, focus-fire or resource optimization                   | Bait it with proximity, terrain and chokepoints             |
| **Reckless**      | Immediate damage and reachable pressure; not automatically the weakest victim | Closes aggressively, tolerates counterattacks and exposed destinations                                  | Spends strong available attacks readily; rarely pauses to defend                                             | Punish overextension and lure it into bad trades            |
| **Cautious**      | Targets it can threaten while limiting return damage                          | Values safe destinations, useful range and defensive terrain                                            | Preserves scarce resources when a basic attack is nearly as useful; heals/defends when needed                | Pressure its safe space; exploit its reluctance to commit   |
| **Opportunistic** | Wounded, exposed or already compromised targets; reliable finishing chances   | Accepts some risk for a concrete opening                                                                | Values a skill when it creates or exploits that opening                                                      | Protect vulnerable allies and deny easy finishing attacks   |
| **Protective**    | Threats to a designated vulnerable ally, or a nearby supported group          | Stays in support distance; occupies useful blocking tiles when legal                                    | Uses defensive/support actions to preserve the protectee; attacks when protection is not urgent              | Pull the group apart or approach from multiple directions   |
| **Supportive**    | Ally health and useful buffs before personal damage                           | Moves to legal support range while avoiding unnecessary exposure                                        | Heals meaningful missing HP, avoids useless overhealing or duplicate buffs, attacks when support adds little | Pressure the support unit or separate it from beneficiaries |
| **Disciplined**   | Role-effective targets, sensible finishing opportunities                      | Balances damage, safety, positioning and resources; modest target commitment                            | Reliable role fundamentals without specializing in one extreme                                               | Disrupt its role and force unfavorable choices              |
| **Cowardly**      | Safely reachable targets that do not invite retaliation                       | Self-preservation rises sharply when wounded or locally outnumbered; retreats toward safer allied space | Self-heals/defends more readily and avoids costly commitments                                                | Cut off safe retreat and apply sustained ranged pressure    |

Protective does not magically redirect damage, taunt, intercept attacks or gain reactions. Current occupancy permits positional blocking; stronger protection needs actual abilities. Cowardly may withdraw and defend, but the existing Tactical `flee` action ends the entire battle. **Never use global flee as a single enemy's escape.** Per-unit retreat/surrender requires new explicit rules.

Cautious and Cowardly should produce different outcomes: a healthy Cautious Marksman takes a good firing position; a wounded Cowardly Marksman may give up a good shot to preserve itself. Protective and Supportive differ similarly: one guards a person or position, the other maximizes useful support actions.

### Candidate expansion, only with distinct behavior and proof

| Adjective   | Distinct behavior                                                                                         | Needed before shipping                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Vengeful    | Commits to the last attacker or a witnessed ally's killer even when a different target is slightly better | Small persisted combat memory; lawful retargeting when the target is unavailable      |
| Patient     | Holds a valuable position and lets enemies enter favorable range                                          | Bounded hold/engagement rules and a progress guard to avoid endless waiting           |
| Predatory   | Stalks isolated targets and commits when an opening develops                                              | Isolation metric; must not override mandatory Mindless on Beast/Monstrosity           |
| Fanatical   | Sacrifices safety for an explicit ritual, leader or mission                                               | Encounter objectives with visible progress and failure conditions                     |
| Methodical  | Builds a supported debuff/attack sequence rather than chasing immediate damage                            | Explicit combo dependencies, bounded memory, and a clear distinction from Disciplined |
| Coordinated | Takes account of allied intent and reduces redundant attacks/support                                      | Bounded team intent, without omniscient perfect coordination                          |
| Territorial | Defends a location and stops chasing beyond a boundary                                                    | A saved territory/objective and readable disengagement behavior                       |
| Deceptive   | Uses a real feint, decoy or concealment ability to misdirect                                              | Supported deception/perception mechanics; narration alone cannot create an effect     |

Avoid launching synonyms that score identically. Cruel is mostly Opportunistic unless the rules support a distinct goal. Strategic is better reserved for actual bounded planning, rather than a label meaning generally better at everything. Courage and intelligence need not be opposite ends of one scale.

## 5. Assigning profiles: role, experience, personality, then seeded variety

### Precedence

1. Validate explicit creature category. Beast or Monstrosity forces Mindless, regardless of level, personality, difficulty or boss status. Conflicting model-generated adjective hints are discarded with assignment provenance. A conflicting explicitly authored/imported resolved profile is rejected with an actionable error; do not silently rewrite a saved authored choice.
2. Preserve an already resolved valid profile for a resumed encounter. Preserve a known recurring NPC's established temperament when stable identity is available.
3. Honor an authored profile for other creatures if it is compatible with the kit. Unsupported or conflicting explicit input gets a clear validation error; missing input gets defaults.
4. Resolve role from real capabilities, with a validated role hint for ambiguous kits.
5. Compute proficiency, role priors and bounded personality adjustments.
6. Draw one profile with a seeded weighted choice; save the result and policy version.

Mindless is excluded from ordinary random assignment initially. Future authored undead/construct behavior can use it, but its mandatory Beast/Monstrosity rule must remain enforced. For legacy enemies with unknown category, use an explicit `unknown` value; do not guess that a name containing “beast” is a taxonomy declaration.

### Proficiency is not HP, difficulty, or moral worth

Prefer a rules-profile-provided training tier or reliable NPC sheet data. Then use an explicit validated encounter hint. Only fall back to level when neither exists, recording that source. The current HP-derived level is a weak fallback and should not silently become an authoritative measure of intelligence.

For an initial rules-neutral implementation, tiers could map novice/trained/veteran/master to competence `c = 0, 0.35, 0.7, 1`. A concrete provisional Engine level fallback is level 1–2 novice, 3–7 trained, 8–14 veteran, 15+ master. This is a tunable game-design curve, not a tabletop rule; mark its source as `level-fallback`, particularly while levels are HP-derived. Pin that mapping to the assignment version and replace it with rules-profile mappings when those exist. Do not equate 5e challenge rating with character level or impose one level scale on V20-like games.

Experience influences **both** the chance of a role-suitable temperament at first assignment and how consistently the unit follows that temperament. For ordinary local AI it does not reveal hidden player abilities or queued commands. GM bosses have the broader party-sheet awareness specified in section 16; neither controller sees future random rolls or knows an uncommitted player choice. The survivorship premise is a useful worldbuilding bias, not a factual law that all veteran wizards are cautious.

### A concrete weighting model

Use a small role/adjective table and one bounded formula. Example starting values, subject to playtesting:

```text
w[a] = baseRoleWeight[role,a] * exp(1.2*c*roleAffinity[role,a] + 1.5*q*personalityMatch[a])
P[a] = 0.94 * w[a]/sum(w) + 0.06/N
```

- `c`: competence, 0..1.
- `roleAffinity`: authored fit from -1..1; some personalities are effective for more than one role.
- `personalityMatch`: bounded evidence from -1..1, not unrestricted model-supplied numbers.
- `q`: confidence in known personality, 0..1; zero when unknown.
- `N`: number of compatible adjectives; remove incompatible profiles before normalization. If none remain, use a validated Disciplined/basic fallback and record the input problem.
- The 6% mixture gives each compatible uncommon profile a small chance. It never weakens hard type rules.

Illustrative **versatile spellcaster with a support skill**, no personality evidence:

| Adjective     | Base weight | Role affinity | Novice probability | Master probability |
| ------------- | ----------- | ------------- | ------------------ | ------------------ |
| Cautious      | 4           | 1             | 23.0%              | 35.8%              |
| Disciplined   | 4           | 1             | 23.0%              | 35.8%              |
| Opportunistic | 3           | 0.5           | 17.4%              | 15.2%              |
| Supportive    | 1           | 0             | 6.4%               | 3.5%               |
| Protective    | 1           | 0             | 6.4%               | 3.5%               |
| Reckless      | 2           | -1            | 11.9%              | 2.4%               |
| Cowardly      | 2           | -0.5          | 11.9%              | 3.7%               |

Rounding may prevent totals from summing to exactly 100%. A known reckless personality raises Reckless's weight even at high competence. A named NPC's existing adjective should not be rerolled every time its level changes. These numbers illustrate the desired trend, not final balance.

### Personality extraction without a model call for every ordinary turn

Use the existing encounter-generation call to interpret known character/NPC personality into at most three closed-enum hints, each with low/medium/high confidence and a bounded source reference. Examples: loyal, risk-seeking, self-preserving, compassionate, patient. The engine maps hints to numeric weights. Do not ask the model to invent arbitrary probabilities or runtime code.

Use actual known personality when present. An appearance such as “a scarred wizard” is not evidence of caution. Negation matters: “not cowardly” must not boost Cowardly. Multilingual and contradictory descriptions need regression fixtures. If extraction is absent, malformed or unsupported, use no personality adjustment; role plus proficiency plus RNG is sufficient. Keyword matching alone should not be advertised as semantic understanding.

Persist the accepted hints/provenance needed to explain assignment, not model reasoning transcripts. Stable NPC identity must come from existing entity references, not just display names. Anonymous repeated monsters can receive new encounter profiles; recurring named characters need an identity-backed profile before promising cross-session consistency.

### Randomness boundaries

- Use an AI-assignment seed derived from the encounter seed, a stable enemy ID and assignment version. Domain-separate it from terrain generation and combat rolls.
- Do not consume combat RNG while merely enumerating/scoring candidates or rendering previews.
- Save the resolved profile. Refresh, retry, import, rewind to a checkpoint and restart of the same battle must not draw a new temperament accidentally.
- New encounters/seeds may vary composition and temperaments. An explicit reroll should create a new encounter revision, not secretly alter the current fight.
- Tactical currently shares a seeded cursor for decisions and outcomes. Changing its use is a versioned behavior change; preserve old in-progress policy behavior or supply an explicit tested migration.
- Classic's unseeded resolver needs a separate RNG/persistence adapter before claiming exact replay there.

## 6. Mindless: an exact pursuit contract

This is a requested project rule for Beast/Monstrosity, not a claim that those labels imply this behavior in official tabletop rules or real animal behavior.

### Target and route

1. Consider living party members and legal positions from which the creature's designated simple attack can reach each one. The occupied target tile is not a legal destination.
2. For walking, search the board for shortest legal routes measured in **grid steps**, ignoring terrain surcharge in route ranking. Walls, water and mountains still block an ordinary walker. Allies may be traversed under current rules; occupied end positions remain forbidden.
3. Prefer the party member requiring the fewest steps to a legal attack position. Among equally reachable attack goals, prefer the spatially nearer target, then stable target ID and coordinate order. Never break ties using HP, defense, evasion, class or predicted damage.
4. Follow the selected route as far as this turn's actual movement budget permits. Forest still costs two movement points. Pick the furthest legal unoccupied stopping point on that route, not a cheaper off-route shortcut chosen for tactical benefit.
5. If in legal attack range after moving, use the designated simple attack against that target. Otherwise wait after moving. Basic attack is the default; a validated innate signature attack may be designated at creation. Do not search for the best damage skill or retarget for an AoE cluster.
6. Recompute next activation from the updated board. If a route is blocked, choose the next reachable target. If none is reachable, wait; never attack through an illegal movement shortcut or loop indefinitely.

The goal is a deliberately unsophisticated pursuer, not a pathfinding failure. A U-shaped wall may require moving temporarily farther away in Manhattan distance. Whole-board search should find that route.

**Terrain example:** route A takes three legal steps through forest; route B takes five through plains. Mindless selects A even if its movement-point cost is higher. It still receives forest defense/evasion if it ends there, and pays the forest movement cost. A Cautious enemy may intentionally prefer a defensive forest position; a Mindless enemy gets the same bonus incidentally.

For flight and teleportation, use their actual movement contract. Flying crosses blocked ground and occupied cells and may hover on otherwise impassable terrain; teleport crosses intervening obstacles but requires legal landing terrain. Neither mode may end on an occupied cell. Their distance metric is Manhattan distance under current flat-grid rules, not “one teleport hop to anywhere.” Across multiple turns, teleport pursuit needs a route through reachable legal landing positions; never select an apparently close target across a gap wider than all legal hops. Terrain defense/evasion remains effective for every movement mode.

Do not implement a parallel, subtly different set of traversal permissions just for Mindless. Factor/reuse the existing movement predicates. Route preference can ignore cost while execution still uses normal legality and costs.

### Hard exclusions and boss precedence

Mindless does not inspect target HP to choose victims; optimize kill chance; select terrain for cover; coordinate focus-fire; heal wounded allies; retreat because it is afraid; or change target because another class is more valuable. Difficulty and proficiency cannot restore those behaviors.

For a Mindless boss, restrict the GM's candidate menu to this chosen target and required pursuit, with legal signature/phase options that do not evade those constraints. If only one action remains, execute it without a pointless model call. A future exception for intelligent Beast/Monstrosity bosses would be a deliberate product-rule change requiring maintainer agreement, not an implementation convenience.

Classic has no spatial distance. It cannot faithfully implement “nearest by shortest path.” A proposed adaptation is a saved, seeded encounter engagement order with no HP/terrain weighting, targeting the first living entry. **The revised non-spatial implementation uses this abstraction** and must be labeled as such; it does not satisfy the exact spatial requirement. Do not describe the non-spatial abstraction as distance; a real nearest-target rule would require a future formation/position model. Adding front/back formation later could supply a real nearest-target rule; array order must not silently become distance. Tactical's path rule remains the normative Mindless behavior in this proposal.

## 7. Ordinary enemy decisions

### Reuse the resolver; vary priorities

Generate legal candidate actions first, then score them with role and adjective weights. Use existing movement, forecast and readiness helpers; add the minimum reusable legality function needed by both engine AI and GM-controlled units. Do not call the mutation-only `performUnitAction` with unvalidated model input.

Candidates should include:

- Basic attack and usable attack skills, including legal move-then-act destinations.
- Heal, buff and debuff actions against the correct side, including moving into support range.
- Defend, wait, and purposeful movement when no useful attack/support action is available.

Only include mechanics the resolver actually supports. Enemy items need real inventory/accounting first. AoE geometry, summons, taunts, new reactions, opportunity attacks, cover and escape cannot be invented by the scorer. Tactical already has counterattacks and defend/wait; Classic needs explicit automatic defend/wait and proper buff/debuff operations before offering equivalent profiles. This is resolver work, not merely different score weights.

Use normalized factors for expected damage, finishing probability, useful healing/support, immediate counter-risk, next-phase exposure, progress toward the role's engagement range, and resource cost. Multiply those by a small profile table. A very large universal kill bonus would erase temperament differences, so replace it with bounded, profile-dependent finishing value for the new policy.

This is a small utility-scoring approach: compare legal actions using consistent scales and vary priorities by personality. The general approach and use of decision inertia are described in David “Rez” Graham's [An Introduction to Utility Theory](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf). The concrete profiles, formula, defaults and integration plan here are Marinara-specific design recommendations.

### Practical guardrails

- Calculate forecasts from the hypothetical destination, including its terrain, without changing live state or consuming RNG. Counter probability must match actual hit/survival/counter rules; do not label a 50% shot a certain kill.
- Estimate next-phase danger using currently observable positions and known attacks. No future RNG peeking or reading a pending player command. Keep a bounded one-activation threat estimate before considering deeper search.
- Avoid heal spam: value effective healing, urgency, opportunity cost and MP. A one-HP scratch must not automatically outweigh an important action. Avoid refreshing a still-useful buff without benefit.
- Avoid thrashing: retain a valid target/protectee unless another option is meaningfully better. Save the small amount of memory actually used. Mindless follows its nearest-target contract instead of this tactical stickiness.
- Avoid endless kiting/defending: absent meaningful support or retreat progress, bias toward a useful engagement. Use a bounded stagnation guard; do not force a Cowardly unit into a suicidal charge merely to keep turns short.
- Do not let every unit select an identical precomputed phase plan. Resolve in current order, then evaluate the next unit against the updated state, reducing wasted heals and attacks against defeated targets.
- Protective selects a living ally using role/need and keeps that protectee until invalid or clearly inappropriate. Protecting an explicit boss can be a setup hint; it is not universal behavior for all adds.
- Use small seeded variation among near-best actions **within the selected temperament**. Do not reuse today's uniform random choice among all remaining attacks, which can erase the personality.

Proposed initial tuning: normalize policy utility to a fixed scale; let novices choose among options within 0.15 of the best profile score, masters within 0.03, with intermediate competence interpolated. Add a small documented difficulty adjustment, clamped so difficulty never switches temperament. These thresholds require simulation and playtesting; they are not proven balance values.

## 8. Boss turns controlled by the GM

### Identity and responsibility

Add explicit per-unit boss identity in encounter data. Do not automatically turn the strongest member of every pack into a GM boss. Suggested tier values are ordinary, elite, boss; an elite remains engine-controlled unless explicitly designated a boss. The existing encounter-wide music classification can remain separate.

The GM selects a legal action for that boss using its established personality, encounter intent, current board, party skills/resources/items and supported mechanics. This broader awareness supports anticipation, not knowledge of a player's uncommitted choice; section 16 defines the information and interruption contract. The engine owns range, movement, resources, rolls, damage, conditions and turn budgets. Ordinary adds remain engine-controlled, even when a boss is present.

Recommended setup behavior: enable the new tactics system for newly created games when the complete feature ships, and offer “GM directs bosses” as a clearly explained setting using the configured GM connection. Explain that boss turns may take a model response and incur the user's normal provider usage. Existing games keep their behavior until the user opts in; pin the choice when an encounter starts. An engine-only/offline option uses the same profiles for bosses. Do not add a different combat-style enum for this setting or silently change a battle's controller halfway through it.

### Turn orchestration

Keep provider calls in a server orchestration service, outside the pure shared engine:

1. Accept a player action with encounter identity, action ID and expected revision. Validate against the accepted battle state.
2. Advance to the next ordinary action or interruption decision in the existing order. Split declaration from effect resolution so a reaction can interrupt a pending cast; do not resolve an entire round and then rewrite it.
3. Persist the pending activation/window: unit ID, revision, turn cursor, triggering/pending action, policy version and bounded legal candidate menu.
4. Ask the GM connection for a structured candidate ID or pass. Include the current party-sheet snapshot, boss intent, supported mechanics and only the action information appropriate to this window, as specified in section 16. A short optional narration string cannot change state.
5. Validate the response, current revision, unit, candidate membership and current legality. Atomically record the decision and apply the action once.
6. Resume the suspended action/activation from the updated state, then the remaining participants. Revalidate after interruptions; tick each budget/effect at its rules-defined boundary exactly once, then return player control.

Candidate IDs should identify fully specified engine-generated actions, not arbitrary coordinates from the model. A large board can produce many near-duplicate candidates. Build a deterministic bounded menu preserving useful action families: signature moves, attack targets, support, defense and movement. A menu of roughly 8–16 diverse candidates is a starting target to benchmark. Do not prune every alternative using one generic profile before the GM sees it.

### Latency, failure and repeated requests

One provider call per distinct boss decision window is the initial ceiling; no calls for routine adds, raw selection clicks or windows without a useful legal choice. Ordinary turns, anticipation, after-turn legendary actions and triggered reactions can create different windows, so bound total activation/phase latency for multiple bosses. Start with a configurable soft target around five seconds and a hard timeout around ten seconds per call, then tune against actual supported providers. These are design targets, not measured response guarantees. Record a deterministic fallback or pass when the aggregate budget is exhausted rather than issuing unbounded calls.

Timeout, unavailable provider, malformed output or invalid candidate should use the same saved deterministic fallback policy. Save that fallback as the decision; a late model response must not replace it or take an extra turn. Keep the UI responsive, show a simple boss-thinking state, and allow cancellation to the accepted fallback without restarting the whole encounter.

Retries of the same action ID return the stored result. A refreshed tab rejoins the pending decision. Concurrent tabs cannot advance the same boss twice. Switching chats must not attach a response to another encounter. Checkpoint rewind/branch creates or restores a coherent battle identity and decision history; do not replay external calls simply because the animation restarted.

**Persistence prerequisite:** current tactical requests accept state from the client and return a new snapshot; there is no authoritative server turn ledger. Classic likewise accepts complete client-supplied combatants/mechanics without comparing them against an authoritative saved round. A saved candidate ID in the browser alone does not solve retries or concurrency. Before shipping external boss decisions in either mode, introduce the minimum server-owned combat revision/decision store, using existing storage queues where appropriate. Server-owned encounter settings and accepted boss identity must govern whether a model call is allowed; a client-supplied flag must not enable calls. Audit turn-game/Experience namespaces before assuming `game_engine_state` is the right store. This is a bounded combat-state change, not a reason to redesign all game storage.

### Boss mechanics and readability

Promote only supported generated mechanics into structured operations. Give one-shot phase transitions stable IDs and saved trigger state. Distinguish a normal action, a phase transition and an explicitly supported extra action; a flavorful boss description is not permission for free damage.

Telegraph large attacks in the UI/log before their resolution when the mechanic calls for a warning. The GM may improvise flavor around accepted events but must narrate actual outcomes. A learned boss personality and signature kit should remain recognizable across replays even when its legal choices vary.

If GM control is disabled or unavailable, show that engine fallback is in use rather than claiming the GM made that decision. Reproducibility with a GM means replaying saved choices and rolls, not expecting identical new model responses from the same seed.

## 9. Data and integration contract

Prefer one small shared metadata object carried through the existing combat pipeline. Illustrative resolved shape:

```ts
type ResolvedEnemyTactics = {
  version: 1;
  creatureCategory: "beast" | "monstrosity" | "other" | "unknown";
  role: EnemyRole;
  adjective: EnemyAdjective;
  proficiency: "novice" | "trained" | "veteran" | "master";
};
```

This minimum category distinguishes required rules without pretending to implement the complete 5e creature taxonomy. Keep a richer canonical category if one is introduced elsewhere. Store explicit encounter rank separately so boss identity is not encoded by personality. Derive controller from rank plus the pinned encounter boss-control setting; avoid two independently editable sources of truth.

Blueprint assignment hints and resolved runtime data are different contracts. The blueprint may contain bounded role/proficiency/personality hints and a stable NPC reference. The engine resolves them once into the saved profile. Persist assignment provenance once with the encounter, and small decision memory only for policies that actually need it. Do not store duplicated raw personality descriptions on every unit every turn.

Classic additionally needs profile propagation through `sanitizeCombatantForRound`, the round request schema and `CombatantStats`. Its current snapshot intentionally omits round/initiative/action-queue state, so saving only a temperament field cannot support resumable GM turns, real cooldowns or deterministic replay. Persist the authoritative round/activation state required by those features; animations must consume accepted results rather than cause another resolution.

Trace the complete boundary:

```text
known NPC/card data + scene
  -> encounter prompt/schema and generated blueprint
  -> accepted assignment inputs and explicit boss identity
  -> generatedEnemyToCombatant / fallback encounter construction
  -> Classic request OR Tactical start request
  -> resolved units + pinned AI version + encounter identity
  -> action resolution / optional server boss decision
  -> snapshot, checkpoint/branch restore, import/export, post-combat summary
```

Validate enums and bounded values at every external boundary. `.passthrough()` is not validation of new AI fields. Preserve omitted fields in old saves; reject malformed explicit values with a useful error rather than a silent temperament change. A new policy version must not accidentally reinterpret an old snapshot.

For legacy in-progress encounters, keep the legacy policy by default and apply the new system to new battles. Old snapshots lacking taxonomy cannot be retroactively classified reliably; do not pretend the mandatory type rule was evaluated. A newly known Beast/Monstrosity entering the new policy must resolve to Mindless.

Every enemy creation path matters, including generated encounters, manual/fallback combat, restored saves and future summoned units. Do not add fields only to the TypeScript interface and lose them during explicit property copying.

## 10. Fun, realism and replayability checks

**Fun:** enemies should have habits that the player can recognize and exploit. Winning because the player separated a Protective guard from a Supportive healer is more satisfying than winning because a universal scorer selected a random bad move. Avoid turning all enemies into perfect focus-fire machines.

**Realism:** use believable goals, limited information and competence appropriate to the enemy. Cowardice, loyalty, aggression and training are different qualities. Mindless is the requested simplification for two creature categories. Future morale/objective systems can add surrender, territorial defense and escape without pretending these exist now.

**Replayability:** vary profiles and encounter composition across seeds, while preserving identity within a battle and for recurring NPCs. Terrain, role combinations, enemy resources and objectives should create variation beyond a different critical-hit roll. Difficulty should change challenge predictably without making a Mindless Beast suddenly hunt healers.

Example encounter on the same map:

- A Reckless Bruiser leaves its safe tile to pressure a reachable frontline unit.
- A Protective Bulwark stays near the Supportive caster instead of joining that rush.
- A Cautious Marksman keeps a firing lane and avoids an exposed destination.
- A Mindless Beast takes the shorter forest route toward the nearest reachable party member, ignoring a wounded caster farther away.
- A named humanoid boss receives a GM turn to choose between legal signature pressure and protecting its retreat route. Its adds continue using their own profiles.

A different seed can produce a Cowardly Bruiser and Opportunistic Marksman, changing the engagement. A refresh cannot do that. A later appearance of the same named boss should preserve its established habits unless the story or an explicit edit changes them.

## 11. Suggested implementation slices

This is a large feature: it changes persisted contracts, prompts, enemy decisions and asynchronous orchestration. Agree on the design, then implement small reviewable slices against current staging.

| Slice                                  | Deliverable                                                                                                                    | Exit evidence                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| A. Capability and identity foundations | Prove/fix generated-enemy resource loss; explicit category/rank/proficiency hints; preserve fields through all creation paths  | A generated spellcaster can use and consume its real resources; solo boss identity survives restore |
| B. Assignment and persistence          | Role priors, personality hints, seeded saved adjective, versioned legacy behavior                                              | Assignment trends, hard type precedence, stable refresh/import/checkpoint behavior                  |
| C. Tactical ordinary enemies           | Shared legal candidates, exact Mindless pursuit, eight distinct profiles, inspection copy                                      | Behavioral scenario matrix, forecast parity, mobile/browser evidence, bounded performance           |
| D. GM boss turns                       | Server revision/idempotence boundary, resumable enemy phase, validated candidate response, saved fallback, supported mechanics | Timeout/retry/concurrency/restore tests and real-provider/manual boss battle                        |
| E. Classic adaptation                  | Non-spatial profile semantics, proper ally/support pools, seeded decision/roll state and boss initiative integration           | Classic round/resource regressions and restore/replay proof; no false claim of grid behavior        |

Slices A–C are a useful first milestone, but **do not fulfill GM-controlled bosses by themselves**. For Classic, a boss decision must be requested at the correct initiative slot after prior actions, not from a stale beginning-of-round board. Reuse profile tables and assignment logic without forcing spatial and non-spatial engines into one giant resolver.

Later, separately scoped work: common LOS/cover, actual AoE targeting, morale/per-unit escape, objectives, more adjectives, coordination, summoning AI, rules-profile-specific action economies. Tabletop rules should determine legality; enemy temperament should decide how to use those legal options.

### Source map for the implementing agent

| File / symbol                                                                                                                                                                                                                                    | Why it matters                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| [shared combat types](../../packages/shared/src/types/game.ts), `Combatant`, `GameCombatStateSnapshot`                                                                                                                                           | Runtime metadata and Classic restore contract                                              |
| [encounter types](../../packages/shared/src/types/combat-encounter.ts), `CombatEnemy`, `CombatInitState`                                                                                                                                         | Generated blueprint, mechanics and separate encounter-modal types                          |
| [encounter routes](../../packages/server/src/routes/encounter.routes.ts)                                                                                                                                                                         | Generation prompts/schemas and existing character context; separate modal action route     |
| [GM prompts](../../packages/server/src/services/game/gm-prompts.ts)                                                                                                                                                                              | Currently tells GM that combat mechanics are handled by the UI                             |
| [GameSurface](../../packages/client/src/components/game/GameSurface.tsx), `generatedEnemyToCombatant`                                                                                                                                            | Drops description and omits enemy MP; explicit hydration and restore/creation paths        |
| [Classic UI](../../packages/client/src/components/game/GameCombatUI.tsx) and [game hooks](../../packages/client/src/hooks/use-game.ts)                                                                                                           | Active Classic requests, round/animation behavior and player action flow                   |
| [Classic service](../../packages/server/src/services/game/combat.service.ts), `chooseAutoSkill`, `resolveCombatRound`                                                                                                                            | Shared automatic policy, RNG, mechanics and initiative                                     |
| [game routes](../../packages/server/src/routes/game.routes.ts), `/combat/round`, `/combat/tactical/start`, `/combat/tactical/action`                                                                                                             | Schemas and orchestration boundary; client state round-trip                                |
| [Tactical AI](../../packages/shared/src/features/tactical-combat/ai.ts), `decide`, `runEnemyPhase`                                                                                                                                               | Current policy and all-enemies-at-once phase loop                                          |
| [Tactical engine](../../packages/shared/src/features/tactical-combat/engine.ts)                                                                                                                                                                  | Unit conversion, boss heuristic, movement, legality, resolution, forecasts and round ticks |
| [Tactical classes](../../packages/shared/src/features/tactical-combat/classes.ts)                                                                                                                                                                | Existing six classes and capability derivation                                             |
| [Tactical types](../../packages/shared/src/features/tactical-combat/types.ts), [math](../../packages/shared/src/features/tactical-combat/math.ts), [RNG](../../packages/shared/src/features/tactical-combat/rng.ts)                              | Snapshot/action contracts, terrain forecasts and deterministic stream                      |
| [Tactical UI](../../packages/client/src/components/game/TacticalCombatUI.tsx) and [chat metadata](../../packages/shared/src/types/chat.ts)                                                                                                       | Saved tactical snapshot, busy states and pending boss recovery                             |
| [existing terrain regressions](../../scripts/regressions/hybrid-terrain.regression.ts), [route proof](../../scripts/regressions/hybrid-terrain-route.regression.ts), [setup proof](../../scripts/regressions/hybrid-terrain-setup.regression.ts) | Existing runnable proof patterns to extend where relevant                                  |

Before implementation, search issues, open/draft PRs, linked branches and project items to avoid duplicate work. The earlier combat roadmap references closed/unmerged PR #4391 as prior art; recheck its status and ownership, and do not absorb that entire expansion as a prerequisite. Follow current `AGENTS.md`, `CONTRIBUTING.md`, package instructions and the Chai workflow overlay. Do not implement from stale line numbers alone.

## 12. Acceptance and validation plan

Use small runnable `*.regression.ts` proofs in the existing runner. Do not keep temporary `.test.ts` files. Assertions should demonstrate behavior, not merely mirror weight constants.

| Scenario                                                                                        | Required result                                                                                                           |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Beast/Monstrosity with conflicting adjective, master competence, known personality or boss rank | Generated hints always resolve Mindless; conflicting authored/imported resolved profiles are rejected with a useful error |
| Nearest healthy tank versus farther wounded caster                                              | Mindless pursues the tank; Opportunistic may select the caster                                                            |
| Short forest route versus longer open route                                                     | Mindless selects fewer steps while paying actual movement cost; it gains incidental terrain bonuses normally              |
| Wall requiring a temporary move away; unreachable opponent                                      | Pursuit finds the legal detour or another reachable target; no Manhattan deadlock                                         |
| Flying/teleporting Mindless units                                                               | Respect distinct traversal/landing/occupancy and per-turn range; no impossible chained landing path                       |
| Injured ally outside current healing range                                                      | Supportive can move and heal legally; depleted MP/cooldown blocks the skill                                               |
| Protective unit with no taunt or interception ability                                           | Positioning only; no invented damage redirection                                                                          |
| Wounded Cowardly enemy                                                                          | May retreat/defend; never triggers global party flee                                                                      |
| High competence over a fixed large seed set                                                     | Role-suited profiles become more common, rare compatible profiles remain; seed-specific outputs are stable                |
| Known personality, negated trait, contradictory hints, missing/invalid hints, non-English text  | Bounded documented adjustments; no arbitrary numeric control or accidental English-only claim                             |
| Temporary MP exhaustion                                                                         | Role/adjective unchanged; only legal action choices change                                                                |
| Two enemies target a wounded unit, first defeats it                                             | Second evaluates updated state; no attack against a dead target or duplicate reserved heal                                |
| Destination terrain differs from original terrain                                               | Candidate forecasts and actual counters agree on positions, terrain and rules                                             |
| GM invents coordinates, skills, free actions, target IDs or illegal resources                   | No mutation; saved legal fallback or valid candidate only                                                                 |
| GM timeout followed by late success, refresh, duplicate request or simultaneous tabs            | Exactly one accepted boss action and one resource deduction; stale response discarded                                     |
| Party victory/defeat while an enemy phase is suspended                                          | Correct terminal outcome; no remaining boss/add turn after battle end                                                     |
| Checkpoint restore, branching, import/export, legacy save, recurring NPC                        | Preserve accepted profiles and correct battle identity; no unintended rerolls or duplicate external decisions             |
| Classic Mindless and GM boss                                                                    | Explicit non-spatial targeting rule and correct initiative slot; no claim of grid/terrain behavior                        |

Benchmark decision cost with the supported 40-unit / 64-by-64 request bounds, mixed movement modes, many skills and dense obstacles. Cache per-decision movement/threat calculations where justified; invalidate after state changes. Set a measurable ordinary-phase time budget after profiling the current engine on desktop and a representative mobile device. Do not claim a specific millisecond budget without measurement or add deep lookahead before profiling.

For implementation: start with `pnpm install`; run `pnpm check`, focused combat/route regressions, `pnpm regression:prompt` when changing prompts, and `pnpm localization:check` for UI copy. Use the browser regression lane for actual battle flow, refresh, boss waiting/failure, keyboard access, small screens and light/dark themes. Add the appropriate `[Unreleased]` changelog entries. Read `packages/client/.instructions.md` before client edits. Log provider prompts/results through the existing debug facilities and Pino without exposing unrelated secrets.

Before requesting PR review, run CodeRabbit locally, address substantive findings and rerun. Document code-grounded dismissals for false positives or purely pedantic suggestions; do not loop indefinitely. Keep PR test-plan boxes unchecked for the human contributor. When this document is published in a PR, include the required `[docs-i18n]` follow-up or matching translated documentation updates.

### What the original exploration verified

The current behavior descriptions come from source tracing of the active client, routes and resolvers, with separate Classic/Tactical audits. The probability example was calculated directly. No combat AI code was changed, no new policies were simulated, and no browser or real-provider boss flow was exercised. Those are acceptance requirements for implementation, not proof supplied by this design.

## 13. Current ordinary-AI implementation boundary

Implemented policy vocabulary: Mindless, Reckless, Cautious, Opportunistic, Protective, Supportive, Disciplined, Cowardly, **Patient, Methodical and Coordinated**. Other adjectives below are brainstorms, not hidden runtime settings.

The shared `features/combat-ai.ts` contract separates saved role, adjective, training tier and seed from control. New battles receive saved assignments; restored battles with no profile retain the prior automatic policy. Changing a companion's controller does not reroll its adjective. Generated finite MP pools and explicit skill kinds/costs are carried into the runtime; omitted enemy MP uses the same provisional `20 + 3 × level` pool as unstatted allies, preserving explicit zero. This is a generic Engine fallback, not a tabletop resource rule.

The v1 assignment is intentionally smaller than section 5's proposed formula: compatible profiles start with positive weight, role-favored profiles gain a training-dependent bonus, and an optional closed-enum personality hint adds a bounded preference. Category precedence forces Mindless; an explicit Mindless hint also selects that behavior for other creature categories. The existing encounter-generation call provides hints in either language; the engine does not parse prose personality itself. Other temperament hints are preferences rather than guarantees, and model understanding of negation/multilingual characterization still needs provider evaluation. Full provenance and identity-backed personality across recurring NPC encounters remain follow-up work. HP-derived fallback level remains a weak training proxy when no hint exists.

Each mode enumerates executable basic attacks, skills and defensive options, then scores damage, finishing, effective healing, support, cost and relevant tactical factors. No ordinary-turn model call is added. Profiles never grant an unavailable ability, unlimited MP, an extra activation or nonexistent terrain mechanics.

- **Classic:** no spatial score. Mindless uses a stable seeded ordering of living opponents, independent of HP. Support uses the correct allied pool. Buff/debuff skills apply an actual named defense modifier rather than a damage-only approximation. New profiles have per-use cooldowns. Manual companions queue attack/skill/defend choices for their own initiative slots; party inventory and narrative actions remain with the active leader. Other companions default to AI, matching Classic's established interaction. Submitted commands identify their actor, including when the original leader is KO.
- **Tactical:** legal reachable attack/support destinations feed the policy. Mindless follows a shortest-step route while paying actual movement cost; flight and teleport retain their own traversal/landing restrictions. Support may move before casting. New counter estimates use the prospective destination. A conservative public-state reach estimate supplies exposure; it is not full next-turn pathfinding or line of sight. Existing walls still do not block ranged attacks.
- **Patient:** favors a bounded defensive hold over an unfavorable engagement; Classic waits for a near-ready cooldown rather than fictional movement. It cannot keep holding indefinitely while a useful action exists.
- **Methodical:** prefers supported defense-reduction setup, retains the chosen target, and attacks once the status is useful. No invented combo tree or future-roll search.
- **Coordinated:** considers allies' recorded targets and useful debuff support, recalculating after each accepted action. There is no omniscient team planner or reservation of unsubmitted player actions.
- **Companions:** localized per-member Player/AI selection inside the battle, with the active leader kept manual. Tactical companions act after remaining manual commands or when End Turn is selected. Manual override remains possible before a companion acts. Controller changes, profiles and memory persist with combatants/tactical snapshots.
- **Classic persistence:** accepted round results and the next round number are sent to the existing snapshot callback before cosmetic animation. Real per-use cooldowns survive that round-trip. Classic still uses its existing random combat rolls; this is not exact roll replay or a server-owned idempotent action ledger. Simultaneous-tab guarantees belong to the future authoritative boss work.

The first milestone stopped before boss provider calls and reactions; section 16 records their subsequent implementation. Remaining ceilings include per-unit escape, taunt, richer objectives, per-ruleset initiative, full sheet resource normalization, and a recurring-NPC profile registry. Unimplemented pieces of the original proposal remain acceptance work, not implied shipped functionality. Desktop synthetic benchmarks do not constitute real-device mobile performance calibration.

## 14. More adjectives, with class-sensitive behavior

Keep one visible adjective plus a capability-derived role. These are distinct priorities, not synonyms for “smart.” Allow unusual but mechanically valid combinations.

| Adjective | Fighter / Knight | Rogue / Archer | Mage / Healer | Distinction and prerequisite |
| --- | --- | --- | --- | --- |
| **Frugal** | Uses a normal strike before spending a limited combat technique | Saves special ammunition or burst abilities for consequential targets | Uses efficient spells; reserves expensive healing for substantial missing HP | Resource efficiency even when already safe; different from Cautious. Needs real finite resource costs |
| **Relentless** | Keeps pressure on a chosen enemy | Maintains pursuit or sustained ranged pressure on one mark | Continues a supported damage/control sequence on the same threat | Strong target commitment, not Reckless risk-taking; needs saved target and invalid-target/progress escape |
| **Disruptive** | Uses an available disarm, interrupt or disabling strike | Breaks an exposed caster's supported channel or applies a debuff | Prioritizes useful dispel, silence, cleanse or control | Prevents meaningful actions rather than maximizes damage. Only enable actual supported effects; no name-based fake silence |
| **Vengeful** | Retaliates against the foe who wounded it or felled its ward | Marks the last aggressor and seeks a legal opening | Curses that aggressor or protects their intended victim | Event-driven grievance, not weakest-target selection. Needs bounded last-attacker/ally-defeat memory |
| **Adaptive** | Changes tactic after an observed resistance or failed engagement | Stops repeatedly using ineffective attacks | Switches element or support plan based on observed outcomes | Learns only public evidence. Needs bounded observation history; no access to hidden resistance tables |
| **Opportunistic** (already included) | Takes a safe finish instead of a longer duel | Exploits a wounded/exposed target | Uses a spell to secure a real opening | Existing profile is the baseline; do not add “Cruel” as the same scorer |
| **Resolute** | Continues the assigned role despite low health | Keeps a useful firing position under pressure | Finishes an important heal or supported channel | Low-health composure, unlike Reckless aggression; requires intent/commitment and emergency invalidation |
| **Territorial** | Holds an authored gate or ward | Watches a defined approach and stops chasing outside it | Supports allies inside the defended area | Requires a real objective/leash in Tactical. In Classic, defend a named objective, not imaginary coordinates |
| **Zealous** | Prioritizes an explicitly designated leader or cause above personal survival | Spends scarce burst on threats to that objective | Commits support/resources to the mission even at personal risk | Objective loyalty, unlike broad Supportive behavior; requires objective/rank metadata |
| **Deceptive** | Uses a supported feint or stance change | Uses real concealment, decoys or target misdirection | Creates a supported illusion or bait ability | Requires perception/deception mechanics with readable counters. Narrative claims alone do nothing |
| **Merciful** | Chooses a supported nonlethal finish | Disables rather than kills when surrender is possible | Uses restraint/control and accepts surrender | Requires nonlethal outcomes and surrender rules; no attacking defeated targets or invented mercy effect |
| **Selective** | Calls a durable protector only when needed | Calls a pursuer or ranged unit for a current opening | Chooses an elemental/support summon suited to visible threats | A future summon-roster policy, not another generic damage preference; requires summon accounting |

Best next additions after the current eleven: **Frugal, Relentless, Disruptive and Vengeful**. Frugal and Relentless fit existing capabilities with small state changes. Disruptive needs actual disabling/dispel semantics; Vengeful needs combat-event memory. Adaptive and Territorial have high replay value but larger prerequisites. Treat Resolute and Zealous as candidates to test for overlap before expanding the public vocabulary.

The three requested additions also vary by class:

| Adjective | Bruiser / Bulwark | Skirmisher / Marksman | Spellcaster / Supporter |
| --- | --- | --- | --- |
| Patient | Braces while a poor trade improves; holds a valuable approach in Tactical | Waits for legal, useful range rather than forcing a weak shot | Conserves a turn for a near-ready spell or avoids a wasteful heal; never waits for nonexistent mana regeneration |
| Methodical | Applies a real weakening technique, then attacks that foe | Sets up a supported vulnerability before burst | Debuffs before damage, or prepares a supported defensive sequence; useful active effects are not reapplied |
| Coordinated | Pressures an ally's current target or supplies a useful setup | Finishes a target the team is already threatening | Supplies non-redundant support or a debuff allies can exploit; recalculates after each action |

These descriptions are tuning goals. The first implementation uses the generic supported defense buff/debuff model; richer class-specific combinations require corresponding abilities and regression scenarios.

## 15. Summoning design extension

Start without a grid. A summon is an actual combatant with a stable encounter ID, owner reference, side, profile, controller, duration, resource cost and explicit activation budget. Class changes its legal kit; adjective changes priorities as in Classic.

Separate the summoner's **choice of summon** from the summoned unit's **combat policy**. A Patient summoner may preserve a slot for a later threat; a Protective summoned Knight shields through supported actions; a Methodical summoned Mage sets up a debuff; a Coordinated healer avoids duplicate healing. Beast/Monstrosity summons remain Mindless under the current project rule even when friendly.

The ruleset decides whether commands consume the owner's action, whether a summon acts immediately or next round, whether it shares initiative, and what it does when uncommanded. Recommended generic default: summoning consumes the owner's ordinary action, the new unit first activates next round, and uses engine AI unless explicitly controllable. Do not grant a fresh ordinary turn by dismissing/resummoning the same unit. Enforce a population cap and stable one-activation-per-round accounting before adding swarm abilities.

Owner KO, charm/allegiance changes, dismissal, duration expiry, party defeat and encounter end each need explicit cleanup rules. Save ownership and remaining duration across refresh/import. A defeated summon is not an inventory item or a permanent party member. Spell/MP cost is debited once for accepted creation. Summon actions must not manufacture legendary-action windows beyond the pinned boss modifier's eligibility rules.

## 16. GM bosses, legendary actions and reactions

### Implemented generic Engine adapter

New games created in the setup wizard enable server-directed combat. **GM directs bosses** controls provider use; ordinary opponents and AI companions still run locally. Existing games without `combatDirector` stay on their legacy resolver. Encounter setup pins the GM toggle, difficulty, seed, terrain and kit so mid-battle settings do not rewrite accepted rules. The encounter generator must explicitly author `boss`; a high-HP enemy or visual boss marker alone grants no extra actions. A solo boss is supported.

`combat-director.routes.ts` stores a versioned, server-owned snapshot in the existing game-engine state store under `experience:marinara-engine.combat`, anchored to the encounter's starting message. The snapshot includes the initiative cursor, pending effect stack, available choices, reaction/legendary budgets, resources, accepted request IDs and recent event log. Commands carry encounter ID, storage-instance ID and revision; duplicated or stale submissions return accepted state. Inventory consumption and the battle save share a transaction. Provider replies are also checked against the saved row identity, revision and window, so a late reply cannot cross a fallback, checkpoint restore or branch.

- **Classic:** individual initiative slots now pause for a manual character or boss decision. The director resolves one actor at a time, then performs existing end-of-round mechanics/status ticks once. Legacy games retain their original queued round controls.
- **Tactical:** inspecting/selecting a token is free. **Begin [name]'s turn** commits the activation and opens any anticipation opportunity. Movement alone does not produce another activation or legendary window. AI companions and enemies retain the phase structure. Accepted terrain briefs, encounter seeds and setup size remain authoritative. New encounters ignore obsolete campaign seed preferences.
- **Bosses:** initial authored budget is generally three legendary points, with each offered extra action carrying a positive cost. Points refresh at the boss's ordinary activation. Anticipation and after-turn opportunities share that pool; extra actions and reactions never generate their own legendary chain. The generator authors legal attack/defend/move and skill costs. A Mindless boss obeys pursuit restrictions; a sole legal action runs locally.
- **Provider:** use the configured GM tool connection, falling back to the chat's connection. Supply current party/opponent skills, resources, item quantities, conditions, profiles, positions and accepted events. Never send pending private commands, RNG state or typed/hovered player choices. The GM returns one legal candidate ID, never rewritten state. Debug prompt/result logging follows the host's existing facilities. A decision times out after ten seconds; twelve calls per round is the current aggregate ceiling. Ordinary fallback uses local AI; optional legendary windows pass. The UI identifies fallback events and offers a local fallback while the GM is pending. These are fixed initial limits, not configurable latency guarantees.
- **Reactions:** explicitly marked `counterspell` and `guard` skills have triggered windows. Manual characters receive ability/target/cost choices and **Pass**; local AI evaluates threat and scarcity, and GM bosses choose through the same provider contract. A unit has one reaction, refreshed at its activation, and explicit cooldowns still apply. Counterspells may themselves be spells and be countered. Stable unit order and the saved parent stack bound resolution to the forty-unit encounter limit. Passing consumes nothing.
- **Costs:** reserve/spend the declared skill's MP or one exact-level spell slot before reactions, with no double charge on resolution. The generic adapter consumes that cost even if the spell or Counterspell fails. A reaction also spends its allowance; legendary skills spend both their authored skill cost and legendary points. Slots are optional explicit kit data, not inferred from a class or an ability's name. No upcasting or edition-specific refund rules are implemented.
- **Generic effects:** Counterspell has a seeded chance of `clamp(65% + 3% × level difference, 20%, 95%)`; it cancels pending effects only. Guard temporarily applies the existing defending reduction to one threatened ally for that attack. Tactical reactions check authored range and a wall ray; ordinary ranged attacks retain their previous visibility rules. Explicit `areaRadius` and `friendlyFire` enable Tactical attack areas, while Classic `targetScope: all-enemies` applies a single paid cast to the opposing group. These are deliberately generic rules, not either edition of 5e Counterspell.
- **Controls:** the existing battle screens render authoritative accepted state, reaction and legendary budgets, and a focused, keyboard-accessible choice panel. Tactical inventory offers actual supported items instead of the legacy unlimited placeholder potion. Reload restores the pending decision. The reset-before-restore fix preserves the encounter anchor and mechanics, including React's repeated development mount. Resource totals are included in the combat recap.

**Current limits:** the director does not offer the legacy freeform **Special** maneuver or in-place battle restart, because neither has an authoritative action/rewind contract yet; legacy battles retain those controls. Use the existing story/checkpoint controls for restoration. The GM candidate menu is capped at sixteen ordinary/legendary choices; only a small set of reposition destinations is offered. Guard is damage reduction, not movement/interception or an attack of opportunity. Existing Tactical retaliation remains its own automatic exchange, not a spell reaction. Classic retains its current random dice and existing scripted mechanic coverage; Tactical does not gain Classic's scripted mechanics. There is no full tabletop adapter, resurrection, summon ownership, general concentration, upcasting, or recurrent NPC profile registry. Full sheet normalization and durable resources between separate encounters still belong to the ruleset work. Provider-quality evaluation and real-device pacing remain required playtesting.

### Accepted design requirements

**Accepted:** legendary actions should be available to authored bosses independently of a 5e ruleset. The GM knows the party's combat capabilities/resources and can act on a plausible prediction before an ordinary action. AI-controlled units evaluate optional reactions and may decline them to preserve resources. These now have a first generic Engine implementation, separate from the ordinary-turn policy.

### GM awareness and prediction

Give the GM a revision-bound snapshot of each party member's skills/spells, legal ranges and supported area shapes, current/max HP and MP/spell points, slots by level, cooldowns, conditions, equipment, usable item counts and remaining uses. Include shared inventory ownership/access, current positions where applicable, summons, recent accepted actions and the unit beginning its activation. Missing data is unknown, not zero or unlimited. Obtain this from accepted sheets and inventory, not a model-invented summary. Read access to party items grants the boss no ability to use or remove them.

The GM may use this broader encounter awareness to predict threats while choosing behavior appropriate to the boss's personality and proficiency. Ordinary local AI keeps its existing information boundary. Neither receives future RNG, private typed drafts, hovered skill/target choices, or other units' queued commands before their declaration. An actual declared spell supplies only the trigger details exposed by the ruleset; knowledge of the caster's spell list is not proof of which spell it will choose. The server can validate full state while filtering the controller's decision context.

**Fireball example:** the selected mage has Fireball available, enough resources, and a legal blast that threatens the boss without hitting the mage's allies. The GM may infer a high likelihood of Fireball and spend a legendary point on a legal reposition, ward or pressure action. It can guess wrong; it must also consider why a single-target spell or another action might be better. It cannot invent a dodge, silence or free movement. Use the engine's real AoE, friendly-fire and visibility rules; the original single-target approximation could not support this spatial forecast. The director now supports explicitly authored attack areas. In Classic/Summoning, use actual non-spatial target groups and threats rather than invented grid range.

### Three distinct timing windows

Reference behavior: the [2014 legendary-action rules](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/monsters) place legendary actions after another creature's turn and replenish their budget at the boss's own turn. Anticipating the newly selected mage **before** its action is a deliberate Marinara extension, not standard 5e timing. Keep it available independently of ruleset through an explicit, encounter-pinned boss modifier; a faithful 5e profile uses native timing unless that house rule is enabled. Do not silently mix this with the [2024 monster rules](https://www.dndbeyond.com/sources/dnd/br-2024/how-to-use-a-monster).

| Window | Trigger and available information | Budget and continuation |
| --- | --- | --- |
| Anticipatory legendary action | Another unit's activation begins; GM sees that actor, sheets and current state, not its uncommitted action | Spend from the existing legendary pool, then let the actor choose/revalidate its action |
| Triggered reaction | A supported event occurs, such as a spell beginning to cast; reveal only permitted trigger details | Spend the reactor's reaction allowance plus the ability's MP/slot/use cost, then resume or cancel the pending action by rule |
| After-turn legendary action | Another unit finishes its ordinary activation | Spend from the same legendary pool, then advance to the next ordinary activation |

In Tactical, distinguish inspecting/selecting a unit from **beginning its activation**. The first committed selection-to-act can open the anticipation window before movement/action, once per actor activation. Once accepted, changing selection, cancelling a menu, refreshing or switching input methods cannot reopen it or switch to a different actor to farm decisions. Merely inspecting units remains free. Make this commitment visible; after the interruption the selected unit still has its ordinary action unless an actual disabling effect prevents it. A short explanatory affordance is better than a boss attacking on every click.

Classic currently collects commands before resolving a whole initiative round. A command-entry selection is not the unit's actual activation. The future resolver must pause at the initiative slot, expose the active actor without leaking its queued command, resolve anticipation, then validate/declaration-process that command. If interruption makes a queued choice illegal, request a new manual choice (or reevaluate AI) before its cast begins. Do not call the GM on every menu selection or run a future initiative slot early. Apply the same lifecycle to AI companions and future summons.

Proposed generic modifier defaults:

- Author an explicit boss identity and a small legal legendary menu; do not infer GM privilege from highest HP.
- Start with a visible budget of 3 points, actions costing 1–3, refreshed at the boss's ordinary activation start. Pin initial budget and any surprise/incapacitation policy at encounter start. This is Marinara's proposed tuning, not a requirement to copy a published monster.
- Permit at most one anticipatory and one after-turn legendary choice per boss per eligible other-unit activation, both using that same finite pool. This tuning enables the requested anticipation without granting more points. A pass also closes its window. Resolve the previous after-turn window before beginning the next activation.
- In Tactical, the after-turn window follows move-plus-action or Wait, not movement clicks, each strike, counters, animation frames or the whole player phase. In Classic it follows the resolved initiative slot. End Turn closes each eligible skipped activation at most once; summons follow pinned eligibility rules.
- Offer `pass` and only legal candidates within budget. No legendary action opens another legendary window or grants speed doubling. A spell cast as a legendary action may trigger Counterspell only when the selected rules adapter supports that reaction; budgets remain separate.
- Recheck boss alive/able-to-act, target legality and battle outcome before requesting and before accepting a decision. A defeated boss cannot spend a late response. Mindless category constraints still apply to its targeting/pursuit, including legendary options.
- Distinguish ordinary action, reaction, legendary action and lair/phase event. They are separate budgets/triggers; do not let a description create new damage or free activations.
- Ordinary adds stay local AI. GM calls occur only for boss windows with meaningful choice. Reuse the configured GM connection, debug logging, saved fallback and aggregate latency limit from section 8.

### Counterspell and other optional reactions

**Automatically evaluate, selectively spend.** Possessing Counterspell does not mean casting it against every spell. A trigger opens a choice between eligible reactions and `pass`. AI companions and ordinary enemies choose locally using their kit, adjective, proficiency, current resource reserves and the value of denying that particular effect. GM bosses use their GM controller at the same legal window. Player-controlled units receive a costed React/Pass choice; do not silently spend their scarce slots because they possess an ability. Mandatory passive effects follow their own rules without pretending to be discretionary reactions.

Score expected harm/control prevented, ally defeat avoided, valuable enemy healing/setup denied, estimated success, and the opportunity cost of both the resource and consuming the reaction before the next refresh. Counterspell can target a healing or utility spell when its rules permit, not only attacks. Do not inspect future rolls or still-private choices. A costly reaction against a harmless spell can lose to pass; a last slot can be worth spending to prevent a party wipe. Reserve preferences are soft policy priorities unless the player explicitly establishes a hard limit.

| Style / kit | Example reaction priority |
| --- | --- |
| Protective Knight or Mage | Intercept an ally-threatening strike or counter a lethal spell, only with the corresponding real ability |
| Cautious or Patient Mage | Pass on a weak spell to retain a reaction and scarce resources for a serious threat |
| Methodical Mage | Deny a supported cleanse, heal or control spell that would break its established plan |
| Coordinated support caster | Reevaluate after another ally reacts; do not counter an already-negated spell or reserve a reaction twice |
| Reckless caster | Spend more readily to preserve offensive pressure; still cannot cast when its resource/reaction budget is exhausted |
| Frugal caster (proposed adjective) | Prefer a cheaper sufficient response or pass; weigh the last slot against future healing/damage needs |

Use ability IDs and explicit trigger/effect metadata, never the translated word “Counterspell.” Each reaction needs a trigger, timing, target/visibility requirements, resource cost, reaction cost/refresh rule and resolution operation. Keep MP, spell points and slots distinct. Counterspell triggers when casting begins, before that spell's effects; selecting the mage or opening its spell menu is not enough. [2014 Counterspell](https://www.dndbeyond.com/spells/2051-counterspell) and [2024 Counterspell](https://www.dndbeyond.com/spells/2619072-counterspell) have different success/resource outcomes; the adapter must define these explicitly. Traditional needs its own documented interrupt formula/cost rather than an accidental blend.

Revalidate trigger, alive/able state, visibility/range, target and funds before committing. Deduct a chosen reaction's cost once even if its counter attempt fails, except where an implemented rule grants a refund. The pending original spell's cost and action consumption follow its own ruleset, separately from the counterspeller's payment. A pass spends neither. No automatic refund because an animation was cancelled. Proposed Traditional default: one reaction allowance per unit, initially available unless an explicit encounter condition prevents it, replenished at that unit's ordinary activation start. Other adapters define their own amount/refresh boundary; an interrupt or speed follow-up never refreshes it implicitly. Existing Tactical exchange counters are not automatically spell reactions; preserve their current semantics until a ruleset explicitly maps them.

### Interruption resolution and persistence

[PR #6110](https://github.com/Pasta-Devs/Marinara-Engine/pull/6110) provides useful precedent: preserve the original attempted action, show the accepted interruption, update subsequent context immediately, and protect restore/retry from overwriting later changes. Its Roleplay implementation cuts text at a validated literal phrase; that parser is not a combat timing or resource engine. Reuse the persistence/visibility principles, not text truncation to decide whether damage happened.

Represent an ordinary action as a saved declaration, pending effects and a resolution outcome. Proposed sequence: activation start and budget refresh → optional anticipation → legal action declaration/resource commitment → eligible reaction window(s) → remaining effects → activation end → after-turn legendary window. A Counterspell can cancel pending effects, never undo already accepted damage. After a response changes state, revalidate the remaining action, including targets, range and disabling conditions. Before a cast starts, an invalidated queued choice can be replaced without a spend; after casting starts, cancellation/refunds follow the selected rule. Logs and GM narration must describe accepted events, not the unexecuted suffix of an attempted maneuver.

Multiple eligible reactors use a rules-defined stable priority, reevaluating legality after each accepted response. Support nested reactions such as countering Counterspell only through an explicit ruleset capability and bounded pending-action stack. Each entry carries its parent/trigger ID; a unit may respond once to a given trigger and needs a remaining reaction allowance. Close exhausted, cancelled or already-resolved triggers. No unbounded recursion, repeat-pass prompts, repeated resource spending or legendary-to-legendary chains. A deliberately limited first adapter must disclose any unsupported reaction chain rather than claim full 5e behavior.

Minimal saved contract: encounter ID, revision, activation ID/cursor, committed actor, window kind/ID, triggering event and pending-action/parent IDs, controller context revision, candidate revision, eligible/resolved reactor order, legendary and reaction budgets, reserved/committed/refunded resource deltas, accepted choice/pass, resolution status, provider request/fallback outcome and remaining effects. Atomically accept decisions with their costs/results. A late or duplicate answer must not spend again. Restore resumes the pending window or replays its accepted result; branch/rewind isolates the whole combat ledger, not just narration. There is no text-only Restore that refunds an accepted reaction. The server-owned ledger described below supplies the initial implementation; section 8 retains the longer-term contract.

UI: show remaining legendary points, reaction availability and the offered ability's cost; label anticipation versus a triggered reaction. Show why an action was interrupted and whether the original spell resolves, fails or needs a new choice. Expose thinking/waiting, retry/fallback and cancellation accessibly. Telegraph charge attacks where required. Never claim the GM chose a local fallback. Keep internal scores/prompts out of the player's action menu.

Required proofs: correct party spells/resources/items in GM context; depleted-resource forecast; plausible but incorrect Fireball prediction; no draft/queued-command leakage; no raw-click/reselection farming; player changes legal action after anticipation; native 5e timing versus enabled house rule; Counterspell only after a legal cast trigger; weak spell passed versus lethal spell contested; no MP/slot/reaction remaining; cost once on failed counter; rules-specific original-spell refund; forbidden visibility/range; multiple reactors and countered counters; no extra legendary window on movement/follow-up/reaction; correct Classic initiative slot; invalidated queued manual action; tactical skipped units/summon eligibility; exhausted legendary budget; refresh exactly once; death/outcome while waiting; duplicate requests; timeout then late success; refresh, simultaneous tabs, branch/rewind and settings changes. Add real-provider behavior and representative mobile pacing validation after deterministic route tests.

## 17. Encounter environment Agent handoff

The game-creation **Terrain guidance** textarea and summary row are removed. Old setup files may still contain the field for compatibility, but encounter generation no longer injects it into every fight. Battlefield Size remains a reusable setup preference. New battles receive individual internal seeds; saved maps and restarts preserve accepted seeds. The Tactical label describes movement, terrain and forecasts without another game's name.

A future **Battlefield Scout** Agent should run when an encounter is being prepared, using the player's current location, latest scene/environment, authored map details, weather and relevant recent events. It sends a concise environmental brief to the GM before encounter generation, not at world creation and not once per ordinary turn.

Boundary:

| Owner | Work |
| --- | --- |
| `Pasta-Devs/Marinara-Agents`, `staging` | Agent definition, default prompt, package runtime, catalog/manifest, assets, settings owned by that Agent |
| Marinara Engine, `staging` | Encounter-preparation hook, bounded scene input contract, validated Agent result delivery, configured provider routing, caching and fallback, saved terrain provenance |

Inputs must carry encounter/location revision and distinguish observed facts from uncertain suggestions. Output: a short supported-environment summary, bounded terrain features using the existing `TacticalBattlefieldBrief` schema where relevant, and source references. No executable rules, arbitrary tile coordinates, invented resources, boss privilege or HP changes. Classic can receive descriptive hazards/context, but no grid modifiers unless its resolver supports them.

The GM receives the accepted context and still produces the encounter; the Engine validates the final terrain. Cache by encounter/location revision, discard stale replies after travel or scene changes, and avoid repeated paid calls on retry. If disabled, missing or timed out, use current encounter-generation context with ordinary procedural terrain fallback. Persist accepted terrain rather than regenerating on reload. Add debug prompt logging and schema/timeout/stale-location tests. This Agent is documented here, not implemented inside Engine or silently installed.

### Validation recorded for the first implementation

The local baseline `pnpm check` passes, as do the focused combat AI regression, existing hybrid-terrain route/setup/engine regressions, and `pnpm regression:prompt`. Focused browser tests run through the actual Classic/Tactical routes cover companion selection, queued manual commands, automatic companion actions, accepted round persistence and reload. Setup/hydration checks cover removal of terrain guidance, seed zero, explicit non-English spell kinds and explicit zero MP. Desktop light-theme and Android-sized dark-theme Chromium passed; WebKit could not launch because its required system libraries are missing. Screenshots are local test artifacts, not committed documentation assets.

A synthetic 40-unit, 64×64 open board with mixed walking/flying/teleporting units and support skills took roughly 400–440 ms for one ordinary enemy phase on this host. This is not a dense-obstacle worst-case budget or a physical-phone measurement. Balance and full encounter pacing still need playtesting. Those measurements cover the first milestone only; they do not establish boss-window latency or a future ruleset.


### Validation recorded for the boss/reaction implementation

`pnpm check` and `pnpm regression:prompt` pass. The existing unrelated `GameNarration` hook warning remains. Focused ordinary-AI, director, route and provider regressions cover activation commitment, normal-turn preservation, nested counters, passing, failed-counter payment, empty MP/slots, area guards, wall-blocked reactions, disabled turns, inventory transactions, duplicate/stale commands, actual hard timeout, per-round call limits and checkpoint/branch identity. The provider adapter was exercised against a local HTTP fixture, including its actual outbound context and malformed/unknown choice rejection. This proves integration, not strategic quality on a paid model.

Sixteen desktop/mobile Chromium browser checks pass across legacy and directed Classic/Tactical companion controls, real menu actions, ordinary-round completion, pending reaction reload, consuming the last spell slot exactly once, generated skill hydration, and setup cleanup. Screenshots were inspected in desktop light and mobile dark themes; the reaction panel is visible, focused and operable. Physical-device performance, current WebKit coverage, and real-provider decision quality/pacing remain unverified. The expanded route proof also runs the actual ten-second timeout and rejects later replies. This validation used no live gameplay-model call. The maintainer subsequently authorized external CodeRabbit review as part of the expected project workflow; the initial local review completed with 15 findings.


### Local CodeRabbit follow-up

The first pass led to fixes for accepted Classic item consumption after retries/skipped turns, Tactical skill-power forecasts, a legacy-safe public AI entry point, enemy-only boss metadata, malformed state queries and imported decision costs, missing automatic enemy-phase events, missing maximum-MP normalization, invalid controlled-unit IDs, reaction-only skill menus, provider-fixture cleanup, and sharing connection resolution at the service layer. The item report assumed multiple party item menus; only the leader currently has that menu, but removing the stale item ref fixes a real abandoned-retry issue. Consumption now follows the accepted orders and actual action results.

Reviewed suggestions retained with code-based reasons:

- Spell slots intentionally accept only levels 1–9. Silently dropping unsupported keys from generated blueprints could hide an invalid authored kit; the existing schema rejects it. Cantrips and named ruleset behavior belong to the separate ruleset contract.
- Ordinary AI costs now fall back from maximum MP to current MP when no maximum is supplied. Reaction scarcity deliberately divides by **remaining** MP: a Counterspell spending the last few points must be treated as expensive even on a large original pool.
- Boss candidate enumeration already builds its reachable tile list once. Each candidate still passes the authoritative action validator. Removing repeated legality checks or adding a separate validation cache needs performance evidence and must preserve that boundary; this was a performance suggestion, not an observed illegal-action bug.
- `CombatAttackResult` has no existing failed-action reason marker. The new profiled resolver rejects unavailable skills before executing, and the director validates before payment. Adding a new result/UI protocol solely for the legacy zero-effect fallback is deferred as a presentation improvement; the fallback applies no effect and spends no resources.

The second full local pass completed with six findings. Fixed accepted spell-slot merges and stale prop resets in the standalone Classic screen, assigned profiles directly during unit construction, extracted GM characterization from card fields instead of serialized metadata, blocked reaction skills in both legacy ordinary-command paths and automatic selection, and returned a recoverable error for malformed saved-state reads.

The remaining blueprint suggestion is not applicable: `CombatAttack[]` in the shared encounter types, the generated encounter prompt, and `combatSkillsFromGeneratedAttacks` all require attack objects with a name. String-only entries have no supported hydration behavior. The object schema remains strict rather than accepting data the combat screen cannot use.

After those fixes, `pnpm check` and `pnpm regression:prompt` pass. Four combat regressions and the hybrid-terrain route regression pass, including actual provider context extraction with card comments/editing notes excluded. Sixteen desktop/mobile combat checks passed after the first fixes; the final eight Classic browser checks also pass with explicit item retry, skipped item and last-slot exhaustion coverage. A build-refresh collision interrupted one earlier browser run; the successful rerun was performed after the build completed. The third review identified the Classic reaction-only empty skill-panel condition, now fixed on both layouts. The corresponding legacy Tactical healing/resolution path also rejects reaction-only skills. Final review verification is recorded below.


Additional review dispositions:

- The Tactical action endpoint already routes control changes through `applyTacticalTurn` and `applyAction`; `applyAction` rejects assigning AI to the first living party unit. The route regression now exercises that request and verifies HTTP 400 with the manual-leader error. Duplicating the same rule in the route would create a second source of truth.
- AI hints and interrupt fields may be omitted. When supplied, they must satisfy their explicit schemas. Silently catching and dropping malformed capabilities would turn a generated Counterspell, cost or boss kit into different rules without explanation. The proposal to make every optional capability tolerate invalid values is an intentional behavior change, not a missing guard.
- A narrower exported `TacticalUnitAction` alias is a type-cleanup suggestion. Runtime control handling already returns in `applyAction` before ordinary validation/execution, and director action schemas exclude control. This does not block the feature; a future API cleanup may narrow that internal union without changing behavior.


Legacy inventory persistence remains a separate follow-up. The review noted that `GameCombatUI` detaches the inventory callback after a legacy round result. This is pre-existing in the base revision, which also uses `void onInventoryItemUsed?.(usedItemName)`. Simply awaiting it is not an idempotent fix: `handleUseCombatInventoryItem` handles failures internally and legacy rounds have no authoritative saved request/result transaction to retry. New directed battles bypass this callback and use the server ledger's atomic inventory deduction plus accepted-state save. Existing legacy battles retain the old boundary; migrating their round and inventory persistence together requires an explicit compatibility migration. This limitation is documented, not claimed fixed by the item retry/queued-order changes.

The reaction-availability label now uses the localization catalog's singular/plural variants. Final focused combat regressions, client types, workspace lint and the leader-control route proof pass after the small reaction guards; the pre-existing `GameNarration` hook warning remains.


The final verification also prompted deterministic basic-action/defend fallbacks for Classic units without a saved profile or remaining enemies, plus bounded party-order identifiers that must name living party combatants. Their focused regressions and server type checks pass; localization validation passes for reaction-count plurals.

Remaining non-behavioral suggestions are deferred: deduplicating identical spell-slot schemas, returning a pending-action ID instead of using the newest record immediately after synchronous declaration, narrowing internal action types, and replacing the teleport frontier sort with a minimum scan. The current code has explicit bounds, preserves per-action validation, and no interleaved declaration occurs between insertion and selecting that pending record. These suggestions do not establish a changed combat result. Likewise, legacy cooldown 0/omitted is temporarily stored as 1 and decremented at the end of the same whole-round resolver; it is available the next activation. The director uses a separate per-activation payment path with 0 directly. Equalizing those intermediate values is not required for the same availability behavior.


The review's proposed cache change assumes `/director/start` is non-idempotent. It is idempotent for an accepted chat/anchor: the serialized route loads and returns the existing ledger before any creation or payment, and the route regression checks that replaying start with stale client combatants returns exactly the accepted session. Keeping remount/reconnect refreshes allows the client to see restored or updated server state. Disabling them would retain stale cached battles; explicit refresh remains available and retries are disabled.

The fourth local pass completed with 15 findings, including repeats and optional cleanup. Its remaining behavior fix honors explicit Mindless hints for other/unknown creature categories; the focused regression reproduced the ignored hint before the fix. Saved profiles still retain their established behavior. The suggested pending-map cap of 40 would reject a valid terminal stack entry: declaration inserts first, then suppresses further reaction tasks when the count exceeds 40, so the saved bound is 41. Area radius 0 intentionally denotes no area expansion, consistent with both resolvers. Changing the connection helper's inherited dynamic provider import to a static import is optional cleanup. No claim of zero review findings is made; the pre-existing legacy inventory persistence follow-up above remains open.

Final verification after all review fixes: `pnpm check` passes, including localization, formatting, types, lint and production builds; the focused combat AI regression passes after demonstrating the Mindless-hint failure before the fix. Earlier prompt, director/route/provider and desktop/mobile browser results remain as recorded above. The last small review fixes were verified locally, followed by a further external review when preparing the PR.


### PR preparation review

Implementation ownership and scope are tracked in [#6299](https://github.com/Pasta-Devs/Marinara-Engine/issues/6299); translation parity for these two development handoffs is tracked in [#6300](https://github.com/Pasta-Devs/Marinara-Engine/issues/6300). The shared skill symlink resolves, and all 52 skill files were compared byte-for-byte with their previous Git contents. `pnpm check` passes after moving them. `AGENTS.md` is a separate Codex adaptation of `CLAUDE.md`, with an explicit transition from draft to ready when implementation, required local validation and local review are complete.

Publication-round review dispositions:

- `.agents/skills` remains an intentional, working alias for `.claude/skills`. Rewriting every executable reference is unnecessary. The Impeccable project guard and full baseline checks pass through the alias.
- Findings about Impeccable examples, wording, vendored bundle provenance and existing live-tool internals concern files moved without content changes. They are not regressions from this PR. This migration preserves the installed skill, rather than incorporating a separate upstream skill-maintenance project.
- Tactical item scope `any` is explicitly supported by `CombatItemEffect`, route validation and the director's target checks. Replacing every non-self/non-enemy scope with `ally` would break that supported behavior. The existing default applies only to missing scope.
- Eager pursuit computation is bounded and does not change which legal action wins. Making it lazy is an optional performance refinement; the recorded mixed-movement phase measurement remains the current evidence, not a claim that further optimization is impossible.
- Generated attack capabilities are validated by the encounter schema and again by the director's start/action schemas. Substituting defaults for malformed explicit costs or abilities during hydration would silently change an authored kit. Keep absent fields compatible and supplied fields validated, as documented above.
- The repeated request to disable start-query refreshes is rejected for the idempotency and stale-state reasons above; the real route replay proof remains the evidence.

The publication review completed with 34 findings: 30 in the unchanged relocated skill and four in combat code. The four combat suggestions are all covered by the dispositions above (pursuit laziness, supported `any` item targeting, idempotent start refetches, and explicit capability validation). No further implementation change was required from this round. Earlier accepted findings remain fixed and tested. This is a reviewed-with-dispositions result, not a zero-findings claim.

## Difficulty and weather follow-up

See [Combat difficulty and weather](game-combat-difficulty-weather.md) for the #6305 implementation: normalized difficulty, enemy-only Traditional damage modifiers, seeded decision consistency, accepted weather in both modes, explicit attack traits, sheltered/unknown neutrality and fixed conditions across reloads. Alternative rulesets must define their own difficulty policy before inheriting damage scaling.
