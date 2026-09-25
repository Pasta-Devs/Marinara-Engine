# Combat difficulty and weather

Implementation record for [#6305](https://github.com/Pasta-Devs/Marinara-Engine/issues/6305), following the combat director in #6302. This document records the agreed scope and implementation boundaries.

## Setup and difficulty

Remove the Battlefield Seed field and summary, while retaining Battlefield Size. New encounters receive internal random seeds. Ignore obsolete campaign seed preferences when starting future battles; retain accepted battle seeds, grids and restart behavior. Change Classic's description to “Cinematic menu battles.”

Normalize difficulty through one shared helper, including title-case older setups. Keep enemy damage multipliers Casual 0.6, Normal 1, Hard 1.3 and Brutal 1.6. Classic must scale only enemy damage, like Tactical. Audit encounters and loot for the same casing bug. Pin difficulty at encounter creation, rather than changing it when settings change during combat.

These damage multipliers belong only to Traditional (the current legacy Engine mechanics). When implementing 5e, V20, or any alternative ruleset, revisit difficulty through that ruleset's own policy. Do not inherit the Traditional multipliers by default. AI decision tuning is a separate concern from damage scaling.

## Weather

Use existing campaign weather and grounded encounter exposure. Save accepted weather with the encounter; an absent field in an old combat save means neutral mechanics. Unknown exposure is neutral. Enclosed environments are sheltered. Current weather aliases must normalize to the existing weather types, and setting a type must generate compatible wind and visibility.

Initial rules apply equally to both sides: rain modestly reduces fire damage and increases lightning damage; strong wind penalizes explicitly tagged projectile attacks; poor visibility penalizes explicitly sight-dependent attacks; snow increases walking costs in Tactical. Flying and teleportation retain their movement semantics. Untagged abilities receive no inferred projectile/sight trait based on names. Clear/cloudy weather is normally neutral. Shared helpers must drive forecasts, resolution and AI estimates without consuming future combat rolls.

Show accepted conditions and effects in both combat interfaces. Cosmetic weather settings cannot disable mechanics. Weather stays fixed during an encounter; weather-changing abilities, periodic weather transitions, random lightning strikes and heat attrition are deferred. Summoning and future rulesets can reuse the shared weather contract without adding an unfinished UI mode.

## Enemy decisions

Preserve role, adjective, proficiency, legality and resource accounting. Difficulty changes bounded seeded decision variation: Casual allows more plausible mistakes, Normal stays near the current baseline, Hard is more consistent and Brutal minimizes mistakes while retaining proficiency differences. Companion decision tuning uses a fixed Normal baseline at every difficulty; companions still respond to real weather and danger. Mindless restrictions remain intact.

Use weather-aware scores for attacks, support, positioning and reactions. Counterspell and guard compete with passing according to threat, cost and personality. No difficulty grants hidden commands, future rolls, free resources or additional actions. The GM boss prompt receives accepted difficulty/weather and guidance on pressure and opportunity selection; the engine still enforces the offered legal choices and budgets. Provider failure retains the local fallback.

## Validation and delivery

Implement setup/correctness, weather, and AI integration in that order. Add runnable regression proof for difficulty casing; enemy-only damage; weather exposure, aliases, forecasts and movement; save/restore; deterministic enemy choices and companion tuning; reaction costs and boss prompt boundaries. Update existing setup/terrain fixtures for the obsolete seed preference. Exercise desktop/mobile and both themes, including weather animations disabled. Run baseline checks, relevant prompt and browser regressions, and local CodeRabbit before marking the draft ready.

Tuning values are initial game-design values, not proven balance. Automated fixtures establish mechanics and invariants; real-provider boss quality and extended campaign balance require playtesting. Deferred issues remain unassigned unless work actually starts on them.

## Implementation details

Shared conditions live in `packages/shared/src/features/combat-conditions.ts`. Difficulty is normalized at setup import/create and at encounter, loot, Classic and Tactical consumers. Enemy decision variation is multiplied by 2.5 / 1 / 0.4 / 0.15 for Casual / Normal / Hard / Brutal; saved proficiency and personality remain in force. Classic estimates use the same opposed-d20 hit probability as resolution, while Tactical estimates use the shared attack forecast. Tactical pursuit uses terrain and weather costs to rank routes for ordinary profiles. Mindless units instead rank legal routes by the fewest spatial steps; both policies pay actual terrain and weather costs during movement. Reactions consider expected threat and resource scarcity, with the same enemy-only variation policy.

Exposed rain, heavy rain and storms multiply fire damage by 0.85 and lightning damage by 1.15. Explicit projectiles lose 10 accuracy points in strong wind and 15 in gales. Explicit sight-dependent attacks lose 5 points in reduced visibility and 15 in poor visibility. Combined penalties cap at 25 points. Classic converts these to opposed attack-roll modifiers (one point per five accuracy points), and its conditions display names those roll penalties. Tactical exposed snow/blizzards add one walking point per entered tile; flight and teleportation are unaffected. Elemental damage items also receive rain modifiers; healing and status durations do not.

Encounter generation authors basic-attack and skill `projectile` / `requiresSight` booleans and `battlefield.terrainBrief.exposure`. Missing attack traits are neutral. Explicit exposure wins; recognized enclosed environments are sheltered, recognized outdoor environments exposed, and ambiguous environments unknown. Campaign weather comes from the persisted weather system, falling back to a committed scene weather value when absent. Combat-start message tags suppress background weather progression before the rendered mode catches up. Accepted conditions are saved on the director and Tactical state; contradictory or malformed imports are refused. Existing saves lacking weather remain neutral. Legacy Tactical restarts pass accepted conditions (including neutral absence) rather than sampling changed campaign weather.

The setup still validates obsolete fields on imports for compatibility and safety, but removes them from normalized setup exports. The engine retains explicit encounter seeds for restore/restart and regression reproduction. This does not remove Experience world seeds, which serve a different purpose.

## Verification record

Baseline `pnpm check` (including localization, types, lint and production builds) and `pnpm version:check` passed locally. The Node suite covered 295 regression files; five were rerun successfully after a concurrent build briefly removed generated files. Combat regressions were rerun after review fixes, including incoming combat tags, non-combat weather progression, weighted pursuit, difficulty consistency, reaction resources and boss context.

Desktop Chromium in light theme and mobile Chromium in dark theme exercised setup/imports, both combat modes, weather with animations disabled, reactions, reloads, terrain fallback and restored-map isolation. Local mobile WebKit could not launch because the host lacks libicu74, libjpeg-turbo8, libmanette-0.2-0 and gstreamer1.0-libav; that browser remains a CI/manual verification item. The PR records the final review results and repeated random-map fixture checks.
