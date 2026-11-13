---
name: MRPG classes and builds
description: Read before setting a character's or persona's MRPG picks (starting tree, strong and weak stats), or when the user asks about MRPG classes, roles, skills or build advice for Game Mode.
---

# MRPG classes and builds

Purpose: set the MRPG picks on a card or persona, and give build advice that matches the real classes. MRPG (Marinara RPG) is the class system of every new Game Mode game that doesn't use a ruleset. The player guide is `docs/game/mrpg-classes.md`.

## The picks on a card

A card or persona stores three picks in its Game Mode section. Nothing else about MRPG lives on the card: levels, classes, gear and companions belong to each game.

- `tree`: the **primary tree** the character starts in, one of `blade`, `guard`, `scout`, `marksman`, `channeler`, `hexer`, `mender`, `herald`. Left on Auto, the game reads it from the description (and in the game from their class and abilities), and a card that names nothing starts as a Blade.
- `strong`: up to two stats they grow well in. `weak`: one stat they grow poorly in, never also strong. Stats: `hp`, `strength`, `magic`, `skill`, `speed`, `defense`, `resistance`, `luck`. These lean the hidden growth each game rolls. They set no numbers.

Read with `character.mrpg.get` / `persona.mrpg.get` (`characterId` / `personaId`). Write with `character.mrpg.update` / `persona.mrpg.update`, `patch` {`tree`, `strong`, `weak`}, `reason`, `apply:true`. Only the fields you send change. `null` puts one back to Auto. The server refuses an unknown tree or stat, more than two strong stats, or a stat both strong and weak, and lists each problem. A successful write marks the card's MRPG builder finished, so the card shows the picks. Never write `extensions.classic` or `personaStats` by hand.

**The sister tree is not a pick.** The Game Master reads the character's temperament from their Description and personality, and that temperament opens the second tree:

| Temperament              | Sister tree |
| ------------------------ | ----------- |
| Reckless                 | Blade       |
| Protective, Honourable   | Guard       |
| Opportunistic, Cowardly  | Scout       |
| Patient, Cautious        | Marksman    |
| Arrogant, Methodical     | Channeler   |
| Cruel                    | Hexer       |
| Supportive               | Mender      |
| Coordinated, Disciplined | Herald      |

To aim for a sister tree, write the Description so that temperament shows in how they fight. A temperament that points back at the primary tree (a Reckless Blade, a Supportive Mender) makes the character **Pure**: one tree only, with its Pure-only class line opened.

When you pick for the user, fit the character: the tree from how they fight, strong stats from what they're known for, weak from their clear gap. Say why in one line each. Ask only when the card gives nothing to go on.

## How classes work

- Each tree has a base class, two advanced classes (open at class level 10), each with a master class (class level 20), plus a Pure-only advanced and master line. Levels stop at 30.
- Stats come from the **active class** at its class level. A class taken up late starts with a level 1 body, and catches up at double experience while below half the character's level.
- Outside battle a character switches to any class they opened, and **carries up to four skills** from other classes they trained. A carried skill runs on the user's own stats. Guard keeps Cover and Hold the Line, and the Channeler tree keeps Channel Element, in every class of that tree without a slot.
- The weapon decides Str or Mag: a staff, wand or focus hits with Magic against Resistance, anything else with Strength against Defense. That holds for carried skills too.
- MP (8 + twice Magic) does not come back in a fight. Stamina (10 + Str + half Spd) refills a little every turn, more when defending.
- Melee hits on the back row deal half damage. Front trees: Blade, Guard, Scout, plus the Witch line. The rest stand in back.

## The trees and their classes

Skill levels are class levels. A skill marked **carry** was designed to be worth carrying. Any skill can be carried.

**Blade**: weapon fighters, heavy single hits. Leans Str, Spd.

- Blade: Power Strike (L1, carry), Battle Rhythm (+15% all damage, L5, carry).
- Duelist → Headsman: crits and finishing. Flurry, Riposte, Keen Edge (+10% crit, carry); Last Cut (+50% on foes below half HP, carry), Follow Through (a kill or crit grants another action).
- Bloodsworn → Cleaver: berserker. Reckless Swing, Bloodrage, Bloodlust (heals 15% of damage, carry); Sweeping Ruin (hits all foes, carry), Unstoppable.
- Pure: Weaponmaster → Paragon of Arms. Arsenal (hits the foe's weakest physical type, carry); Peerless (an extra action every third action, carry).

**Guard**: tanks who pull attacks and protect. Leans HP, Def.

- Guard: Cover and Hold the Line (tree traits), Challenge (one foe must target the user, carry), Steadfast (+20% max HP, carry).
- Sentinel → Stonewall: Provoke (all foes, carry), Sworn Ward (strikes whoever attacks the warded ally, carry), Retaliate (counters every hit, carry); Fortress, Shield Wall (back row takes 25% less), Last Stand (survive one fatal blow, carry).
- Warden → Elder Warden: anti-magic. Spellguard, Aura of Warding (allies take 35% less magic damage, carry), Old Oath; Landslide (earth damage from Def or Res, carry), Elder Oath.
- Pure: Aegis → Bulwark. Warding Stance (carry), Entrench (carry), Immovable; Oath of Iron (no ally drops below 1 HP for a round), Shield Line (+15% party Def and Res, carry).

**Scout**: fast, evasive, steals. Leans Spd, Lck.

- Scout: Steal (carry), Keen Eye (+15% accuracy, +10% crit, carry), Light Feet.
- Rogue → Phantom: Backstab, Exploit (+25% crit on debuffed foes, carry); Vanish (bonus action evasion and a big crit setup, carry), Assassinate.
- Skirmisher → Harrier: Hit and Run, Fleet (+20% Speed, carry); Double Time (an extra action), Tailwind (+20% party Speed, carry).
- Pure: Shade → Shroud. Shadowstep (dark hit that reaches the back row at full damage, carry), Elusive; Thousand Shadows (three decoys, carry), Perfect Evasion.

**Marksman**: archers who switch ammunition. Leans Skl, Str.

- Marksman: Aimed Shot, Exploit Weakness (weakness hits deal double, carry), True Aim (+15% accuracy, carry).
- Sharpshooter → Farshot: Pierce (ignores half Def and Res, carry), Steady; Headshot, Dead Eye, Return Fire (shoots the first foe to attack anyone, carry).
- Tracker → Huntsmaster: Mark Prey (+35% damage taken, bonus action, carry), Tame (beast companions, carry), Read the Signs; Snare Field, Sic, Pack Tactics (+40% party damage on marked foes, carry), Bond.
- Pure: Artillerist → Siegebreaker. Volley (hits all foes, carry), Heavy Draw; Ruinous Barrage, Sundering (hits cut Defense, carry).

**Channeler**: elemental mages (fire, ice, lightning, wind, wood, earth, water, metal). Leans Mag.

- Channeler: Unravel (stacking Res cut), Channel Element (tree trait, bonus action), Resonance (+20% on elemental weaknesses, carry).
- Elementalist → Stormcaller: Element Mastery (each element inflicts its ailment), Elemental Lance, Attunement (+15% in the channeled element, carry); Tempest (all foes, carry), Overcharge.
- Rune Scholar → Runelord: Edge Runes (the party strikes in the user's element), Warding Runes (party takes 25% less elemental damage, carry); Grand Inscription (element + 20% party damage, carry), Living Runes.
- Pure: Astral Adept → Starweaver. Greater Channel (adds light and dark), Starfall, Deep Well (+30% max MP, carry); Convergence, Mana Tide (5% MP a turn, carry).

**Hexer**: curses, drains, ailments with dark magic. Leans Mag, Res.

- Hexer: Weaken (saps the foe's higher of Str or Mag, carry), Wither, Drain Touch (heals 20% of damage and refills MP or stamina, carry).
- Witch → Carrion Lord (front row): Rot, Grave Hunger, Grave Skin (-20% damage taken in front, carry); Carrion Feast, Grave Tithe, Siphoning Rot (carry).
- Dreamcaller → Dreamweaver: Lull (sleep, carry), Slow Time; Mass Confusion, Nightmare (sleepers lose 10% HP a turn, carry).
- Pure: Nullifier → Void Sovereign. Siphon (steals a buff, carry), Devour (carry); Total Eclipse (all foes, carry), Abyssal Will, Null (immune to debuffs, carry).

**Mender**: healers with light magic. Leans Mag, Res.

- Mender: Mend, Verdict (light damage), Purify (all carry).
- Cleric → Saint: Sanctuary (party heal), Sanctified (party takes 15% less magic damage, carry); Revive (carry), Grace.
- Apothecary → Panacean: Remedy, Item Savant (items 50% stronger, carry); Elixir Rain (party regen, carry), Double Dose.
- Pure: Lifebinder → Lightbearer. Barrier (shield, carry), Overheal; Undying Light, Miracle (first ally to fall gets back up, carry).

**Herald**: leaders and singers who buff the party. Leans Lck, Spd.

- Herald: Rally (+20% party damage, carry), Rekindle (restores MP or stamina), Rallying Presence (+10% ally damage, carry).
- Cantor → Maestro: stacking songs (Battle Hymn, Swift Refrain, Guarding Refrain, all bonus actions), Encore (buffs last a turn longer, carry); Crescendo, Tempo (carry).
- Field Captain → Marshal: Draw Fire (an ally pulls single-target attacks, carry), Hold Fast; Grand Strategy (an ally acts at once), Kill Zone (+25% party damage while an ally draws fire, carry).
- Pure: Standard-Bearer → Lodestar. Raise the Banner, Morale (carry); Hour of Heroes, Fortune's Favour (+10% party crit, carry).

## Build advice

Lead with the character's role in the party, then the two or three carries that serve it. Name skills exactly as above, and the class and level that teaches each. Never promise numbers the sheet doesn't show.

**Primary and sister pairings the game itself suggests** (the sheet shows these to players):

- Marksman + Guard: Sworn Ward on the tank, so whoever hits them gets shot back; Challenge to pull a foe off the back row.
- Scout + Guard: Challenge a foe onto the hard-to-hit Scout.
- Guard + Hexer: Drain Touch, a tank that heals itself.
- Guard + Marksman: True Aim, so Retaliate counters land.
- Blade + Herald: Rally before heavy hits. Herald + Blade: Battle Rhythm so the Herald hits back.
- Blade + Scout: Keen Eye on every swing.
- Channeler + Hexer: Weaken the foe threatening the back row. Hexer + Channeler: Tempest to hit every foe.
- Hexer + Mender: Mend between curses. Mender + Guard: Steadfast keeps the healer standing.
- Marksman + Herald: Rally, then shoot.

**Carries by goal:**

- More damage: Battle Rhythm, Keen Edge, Exploit (with a debuffer in the party), Attunement or Resonance (casters), Exploit Weakness (anyone who hits weaknesses), Mark Prey or Pack Tactics (whole-party).
- Survive: Steadfast, Bloodlust or Drain Touch (heal on hit), Grave Skin (front-row caster), Last Stand, Null.
- Tank: Challenge or Provoke with Retaliate; Warding Stance for magic-heavy foes. Pair a tank with Field Captain's Kill Zone.
- Support from any class: Rally, Rallying Presence, Mend, Purify, Barrier, Revive, Aura of Warding, Encore.
- Crowd control: Lull (beside Nightmare), Weaken, Slow Time comes only with the Dreamcaller line.

**Combos worth naming:**

- A Channeler's Element Mastery ailments switch on Rogue's Exploit and the Dreamcaller's Slow Time.
- Mark Prey with Read the Signs or Pack Tactics, and any burst skill (Last Cut, Headshot).
- Provoke or Warding Stance with Field Captain's Hold Fast and Marshal's Kill Zone.
- Vanish's +20% damage taken stacks with Mark Prey's.
- A Channeler carrying into the Marksman tree changes plain arrows to their channeled element.
- Edge Runes or Grand Inscription with physical fighters who lack elemental hits.

**Stat picks that fit a tree:** Blade Str and Spd; Guard HP and Def (Res for a Warden); Scout Spd and Lck; Marksman Skl and Str; Channeler Mag and Skl; Hexer Mag and Res; Mender Mag and Res; Herald Lck and Spd. A weak stat is best one the tree barely uses: Magic for physical fighters, Strength for casters, Luck for tanks.

Mixed physical and magic builds are allowed and can be strong, but they cost extra training time, which is intended. Say so instead of steering everyone to one tree.
