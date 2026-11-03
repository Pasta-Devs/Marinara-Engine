# Audit: docs/game (12) and docs/extending (15)

Read-only checkout: /tmp/claude-0/-home-user-Marinara-Engine/a5b245ec-f036-586c-974e-94c0812b16ad/scratchpad/ro
Code paths below are relative to that root. UI labels checked against packages/client/src/localization/locales/en.json (key line given as `en.json:N`).

Scope note: docs/game was read in full and checked claim by claim. docs/extending: custom-tools, regex-scripts, personal-extensions, writing-personal-extensions, writing-rulesets, writing-story-scripts, writing-creature-packs were read and spot-checked. The ruleset-* reference guides (except ruleset-mechanics, sampled) were classified from headings and opening lines only. Nothing in them is verified.

Link check (script: scratchpad/audit/linkcheck.py): all 82 anchored links and all relative file links in the 27 guides resolve. No broken links.

Ban-list counts (simply, just, actually, really, very, easily, powerful, unlock, Happy, em dash, "In this guide", "Note that"): game/ and extending/ together about 75 hits. Per file: ruleset-mechanics 20, ruleset-combat 14, ruleset-checks 7, dice-and-skill-checks 5, regex-scripts 5, personal-extensions 5, fighting-on-a-ruleset 4, ruleset-items 4, rulesets 2, getting-started 2. Examples: "simply avoids that size" (dice-and-skill-checks.md), "simply narrated" (rulesets.md), "simply comes back with what is left" (fighting-on-a-ruleset.md), "unlock it to reorder the tools" (getting-started.md). One "Happy" hit exists in the set (location not recorded). Also "Capability API 1.x" appears 1,078 times in 11 extending files (ruleset-mechanics 547, ruleset-combat 68, ruleset-character-builder 45, ruleset-items 39, writing-story-scripts 21, ruleset-sheets 18). That is version-history noise for authors, not docs.

Callouts: zero `> **Note:**` / `> **Tip:**` / `> **Warning:**` blocks in any of the 27 guides, although the style guide asks for them on warnings (for example "hand edits can break a game", sessions-and-saves.md).

---

## GAME

### game/getting-started.md (5,900 words)
- Reader task: start a game. Easy to find: yes (linked from every game guide). But the first screen the reader needs (wizard steps, what to pick, what it costs) is buried under ~2,700 words of Overworld world-making (lines 62-118).
- Wrong or stale facts:
  1. "Visual Generation" (lines 21, 142 and the defaults table) is not a UI label. The toggle is the **Illustrator** card, with description "Generate NPC portraits, location backgrounds, scene images, and optional storyboards" (packages/client/src/components/game/GameSetupWizard.tsx:3278; en.json:12488, 12474). Default off is correct (GameSetupWizard.tsx:709-ish `enableSpriteGeneration` false).
  2. "Local Model (Gemma)" (line 22, 33) is not a label. The UI says **Built-in model** (en.json:1803; chat drawer uses "Built-in model (Gemma)", en.json:9714). The default is set (`useLocalScene` true, GameSetupWizard.tsx:707) but it only takes effect when the built-in model is downloaded (GameSetupWizard.tsx:791, 818). The guide says it "is the default choice" with no caveat.
  3. "Game tool connection" (line 180, 182) is labelled **Game tool provider** (en.json:1096, read at FunctionCallingSection.tsx). Also in dice-and-skill-checks.md:158.
  4. Overworld RPG is described as "the default once it is ready" and in full detail, but it is locked on every server unless `MARINARA_OVERWORLD_GAMES` is set (packages/server/src/config/runtime-config.ts:763; packages/server/src/routes/game.routes.ts:6424, 11649; locked note en.json:4900). Every new game is Classic for normal users. The world-making text is about a feature the reader cannot use yet.
  5. "tested in play as of October 31, 2026" (line 205) and "As of 2026" (line 203): dated model claims with no source in the repo. Violates "never add models or prices from memory" for a guide; remove or move to release notes.
- Missing for a first-time reader: what the wizard looks like at each step (no screenshot placeholders are allowed, so the text must say the button labels); what a finished first turn looks like; what to do if Start Game shows nothing for minutes (world generation time is not stated).
- Duplication: "Finish rolled turns in one request" (lines 184) duplicates dice-and-skill-checks.md:138-160 (owner: dice). Tool planning (174-186) overlaps extending/custom-tools.md:139-155 (owner: custom-tools for the tool, getting-started for Game settings; keep one). Storyboard install steps (line 23) duplicate game/storyboard.md:20-30 and extending/ltx; "Storyboard Optimized" (150-152) duplicates storyboard.md:270-274. Game Master Mode (148) duplicates party-and-npcs.md:164-171. Controls list (213-231) duplicates sessions-and-saves and map-time-weather buttons.
- Length: cut about 50%. Move lines 62-118 ("Choosing a setting kit", "Making a world", "The GM intro message") to a separate Overworld/worlds guide and mark it "not yet available". Move "The three kinds of AI call" (156-162) and "Address modes" (164-172) into a short "How a turn works" section or a reference table. Turn the 7-row defaults table into the first thing after the wizard steps.
- Ban list: 2 hits ("unlock it to reorder the tools", "just" in the wizard text). The troubleshooting section is fine.
- Links: all resolve.
- Priority: HIGH (three wrong UI labels on the setup path, locked feature presented as main path, length).

### game/rulesets.md (3,970 words)
- Reader task: pick a ruleset for a new game and understand what changes in play. Findable: yes. But the guide is written for a rules author as much as a player (see "the Engine", "Capability API", "ruleset package").
- Wrong or stale facts:
  1. "Edit sheet" (line 108) is not a label. The button is **Edit ruleset sheet** (en.json:4499).
  2. "Rules only appears when at least one ruleset is installed" (line 15) is right; the wizard row is labelled **Rules** (en.json:4481), and Agent Organizer type is **Rules** (en.json:7949). Guide mixes "ruleset" with the UI's "Rules" label. Choose one for the reader.
  3. Line 38-44, 4-tier battle table: "Lends its sheet to battles" and "Resolves its own fights" are not UI text. Guide should name the one line the wizard actually shows, which it does not quote.
  4. Line 47 and 48 claim behaviour (natural 20 has no effect under 5e) that is a ruleset package property, not a Marinara rule. Unverifiable from this repo; say "in the 5e (SRD 5.1) ruleset" and link.
- Missing: what a reader sees in the sheet block the first time; what "Starts on a blank sheet" means for an unsaved party member.
- Duplication: party-and-npcs.md:52-54 repeats "The ruleset sheet" (owner: rulesets). extending/ruleset-sheets.md and game/rulesets.md both explain live states, wound tracks and rests. ruleset-items.md duplicates market and money (see party-and-npcs).
- Length: cut about 50%. Lines 42-59 (17 bullets of check rules) and 61-83 (pool and other rolls) are author-level. Move to extending/ruleset-checks.md (which already covers them) and keep one table in this guide. Lines 85-112 (sheet widgets) belong to extending/ruleset-sheets.md with a short player summary here.
- Ban list: "simply narrated" (line near 57, "simply"), "very" 0. 2 hits.
- Priority: HIGH (reader-facing page written at author depth; one wrong label).

### game/fighting-on-a-ruleset.md (1,714 words)
- Reader task: understand a fight on a ruleset such as 5e. Findable: yes (linked from rulesets.md). But there is no task inside: no steps, no "what you see". It is a list of mechanics in 6 long paragraphs.
- Wrong or stale facts: labels checked and correct: **Move** (en.json:3051), **Pass** (2893), **Movement** (3585), "Nobody is in reach. Move closer." (3024). No wrong facts found. Unverifiable: all mechanic claims depend on ruleset packages.
- Missing: how to attack (where the menu is, what the buttons are called in the 5e battle screen), how to end a turn, how to read the log line in the example, what "crash" means (line 21 "crash line" is undefined), what "soak", "contest", "Shield" mean.
- Duplication: combat.md:11 and rulesets.md:34 both describe the split; the "on a battlefield" paragraph (35-41) repeats combat.md Tactical rules and includes the 4-vs-8 direction note.
- Length: cut about 60%. Rewrite as: one paragraph of what it is, a "Your turn" steps list, a table of menu items, one "If you cannot act" troubleshooting. Move the rule text to extending/ruleset-combat.md.
- Ban list: "simply not on the menu" (line 21), 4 hits total.
- Priority: HIGH (unreadable for hobbyists, no task structure).

### game/combat.md (2,790 words)
- Reader task: understand a fight and its controls. Findable: yes.
- Wrong or stale facts:
  1. "The four settings multiply final damage ... Higher difficulty means both sides hit harder" (lines 97-108). The multiplier applies only to enemy attacks: packages/server/src/services/game/combat.service.ts:509-510 (`if (attacker.side === "enemy")`); table in packages/shared/src/features/combat-conditions.ts:14-17 (values 0.6/1/1.3/1.6 are correct). Also the file comment says this is "Traditional/legacy Engine rules only".
  2. "Critical hit ... multiplies the total by 1.5" (line 95): correct (combat.service.ts:500).
  3. "blocking up to 40 percent of their Defense value" (line 95): correct (combat.service.ts:504).
  4. Initiative "roll a d20 and adds a bonus based on Speed" (line 82): not verified; no code found in a quick search. Mark unverified.
  5. Turn order (lines 44-49): labels "One at a time, by initiative" and "Your whole party, then the enemies" are correct (en.json:11289-11290), and "Combat Style" / "Turn order" are correct (11286, 11288). "New Overworld RPG games use this" depends on the locked feature.
- Labels verified: Attack, Skills, Special, Defend, Items, Flee (en.json 12946-12958 and 2891), **Ask GM** (11971), **Attempt to Interrupt?**, **Force Interrupt** (12599, 12658), **Victory!** / **Defeat...** (2871, 2869), **React quickly!** (12304), **Combat Log** (11978), **Next:** / **Round** (11991, 12005). Correct.
- Missing: what happens when you pick Attack (who is targeted), how to read the round counter, whether Flee always works.
- Duplication: "Elements" and "Battlefields" sections repeat setting-kit text owned by getting-started.md:62-118 and map-time-weather.md; "Boss mechanics and loot" repeats party-and-npcs.md money text.
- Length: cut about 15-20%: move the elements/battlefield kit paragraphs (lines 118-124) and loot-by-setting (line 130) to a worlds/kits guide.
- Ban list: 1 hit. Clean otherwise.
- Priority: MEDIUM (one wrong fact on the core combat math page).

### game/dice-and-skill-checks.md (3,011 words)
- Reader task: roll dice and read a skill check. Findable: yes.
- Wrong or stale facts: none found on the core paths. Verified:
  - 8 quick presets: packages/client/src/components/game/GameInput.tsx:89.
  - 100 dice / 1000 sides limits: packages/shared/src/utils/dice-notation.ts:37, 39.
  - Labels **Roll dice**, **Clear queued roll** (en.json:12025, 4170); "Narrate dice outcomes immediately" (1098), "Let the Game Master see one die of each size" (1100), "Rethrow after idle turns" (1101), "Values shown per size" (1104). All correct.
  - Skill formula and crit rules: packages/server/src/services/game/skill-check.service.ts:247-251. Skill to attribute map: lines 97-120; fallback to Intelligence at line 136. Correct.
  - Narrate-immediately default on (one-request-dice.ts:184, `!== false`); dice pool default off (dice-pool.service.ts:138). Correct.
  - Rethrow default 3 and window default 1: packages/shared/src/types/chat.ts:780 (3 confirmed); window default not checked.
  - Difficulty bound 1-40 (skill-check-resolution.service.ts:133 SKILL_CHECK_MAX_DC = 40). Correct.
- Missing: a plain "how to roll a d20 and see the result" walk-through with what the chip looks like before/after; what **Logs** is.
- Duplication: "Finishing a rolled turn in one request" appears here (138-178) and in getting-started.md:184. Owner: this guide. Getting-started should link only.
- Length: about 35% cuttable. Move lines 162-178 ("one die of each size", a dev-level option with three bullets of trade-off) and 109-117 (other dice systems, pool thresholds) to an advanced reference. Move 71-75 (symbol dice) to extending/ruleset-checks.md.
- Ban list: "simply avoids that size" (162-ish), 5 hits in file.
- Priority: MEDIUM (accurate; too dense for players).

### game/party-and-npcs.md (3,507 words)
- Reader task: view and edit a party member's sheet, manage inventory, read the journal. Findable: yes.
- Wrong or stale facts (on common paths):
  1. "Click **Regenerate Sheet**" (line 39). The button is labelled **Retry** (en.json:2818; packages/client/src/components/game/GameCharacterSheet.tsx:576-582). Help text: "Recreate this sheet from the character and current game history".
  2. "Click **Edit Sheet**" (line 43, 50 and "Save Sheet" line 50 is correct). The button is **Edit card** (en.json:11940; GameCharacterSheet.tsx:625-629). "Save Sheet" is correct (en.json:11955).
  3. "Journal" tabs (lines 116-132): Timeline, NPCs, Map, Items, Library, Notes, World are correct (packages/client/src/components/game/GameJournal.tsx:101-107).
  4. Reputation labels (lines 144-154): seven tiers match packages/server/src/services/game/reputation.service.ts:43 (devoted, allied, friendly, neutral, unfriendly, hostile, enemy). Correct.
  5. "Saving..." / "Saved" (line 138): the UI uses "Saving…" with an ellipsis character (en.json:1054, 1052). Minor.
  6. "Keep the game's own {name}" (line 106): correct (en.json:4230).
- Missing: where **Character Profiles** appears before a game has a party (no-party state not described); what **Regenerate** costs.
- Duplication: ruleset sheet paragraph (lines 52-54) duplicates rulesets.md:85-112. Game Master modes (164-171) duplicate getting-started.md:148. Money and markets (88-100) duplicate extending/ruleset-items.md:471-519 and getting-started's kit text.
- Length: about 40% cuttable. Move the Money and Markets block (lines 88-100) and the Wearing/binding/carrying block (74-86) to extending/ruleset-items.md (owner) with a 2-line pointer. Inventory's "From the ruleset" and "Starting gear" are rule-specific: move to rulesets.md.
- Ban list: 0 hits.
- Priority: HIGH (two wrong button labels on the everyday sheet task; 3,500 words).

### game/sessions-and-saves.md (2,032 words)
- Reader task: end and start a session, read history, fix data, understand saves. Findable: yes.
- Wrong or stale facts:
  1. "Download .txt" (line 30) is not a label. The button is **Download setup** (en.json:12386; packages/client/src/components/game/GameSetupSummary.tsx:159).
  2. Checkpoint retention "five newest of each kind" (line 146-ish, "Automatic checkpoints are kept to the five newest"): correct (packages/server/src/services/game/checkpoint.service.ts:253).
  3. Labels verified: **Session History**, **Initial Game Setup**, **Copy setup**, "What do you want to happen in the next session (optional)?" (en.json:12846), **Ending Session**, **New Session** (4178), **Show Spoilers** / **Hide Spoilers**, **Edit Details**, **Save Details**, **Replay Session**, **Update Plot Arcs**, **Regenerate Lorebook** (12341), **Game Data** window and "Hand edits can break a game..." (16657, 16658), **Before a State Editor save** (11908). Correct.
  4. "Party Status" is "Party Status:" in UI (12338). Trivial.
- Missing: what "concluded" looks like in the row; what happens to the chat if the summary generation fails.
- Duplication: "Edit game data" appears in getting-started.md:221 and here (owner here). Checkpoints in getting-started.md:221 as well. Backup link (../data/backup-and-restore.md) fine.
- Length: about 15%. The spoilers section (103-121) and Edit Details block are reference, not tasks.
- Ban list: 0.
- Priority: MEDIUM (one wrong label; otherwise accurate).

### game/map-time-weather.md (2,665 words)
- Reader task: move on the map, set the time, understand weather and morale. Findable: yes for the map; the overworld and town sections are about a locked feature.
- Wrong or stale facts:
  1. "It changes your dice rolls, from plus 2 at Inspired down to minus 2 at Broken" (line 137). `moraleDiceModifier()` is defined (packages/server/src/services/game/morale.service.ts:89-101) but nothing calls it (grep finds only the definition). Morale tiers and thresholds are correct (morale.service.ts:57-65). The dice effect is not wired. HIGH.
  2. Time table (lines 106-113) matches packages/server/src/services/game/time.service.ts:28-41 (dialogue 15, explore 30, combat round 5, rest short 60, rest long 480, travel 120). Correct.
  3. Manual time choices Dawn..Midnight (line 97) match time.service.ts:17-24 and the UI labels; Noon is a UI-only phase (GameMap.tsx:137). Guide says it is not a choice. Correct.
  4. Zoom 75%-180% in 25% steps (line 79): correct (packages/client/src/components/game/GameMap.tsx:49-51, 1.8 max).
  5. "Dynamic weather effects (rain, snow, fog, etc.)" (line 129): correct (en.json:6775), default on (not checked).
  6. "Generate another map" wand, "No map yet", "(Current)", "Set destination", "You are here", "Walk there", "Go down", "Leave town", "Places in town", "Import a tile pack": correct (en.json 12896, 12237, 12834-ish, 12904, 12908, 4225, 4726, 4737, 4743, 4694, 12234).
- Missing: what the map looks like in a plain Classic game (the guide opens with the overworld, which Classic games do not have); what a "Destination" move costs in time.
- Duplication: the overworld/town/dungeon sections repeat getting-started.md:118 and the Overworld content in getting-started.md:62-118. Owner should be a single worlds guide.
- Length: about 40% cuttable: move "The overworld" (13-52, ~1,000 words) and "Tile packs" (25-33) to the worlds guide. Keep map basics, time, weather, morale.
- Ban list: 1 hit.
- Priority: HIGH (a stated mechanic is not implemented; guide must not claim it).

### game/hud-widgets.md (1,025 words)
- Reader task: edit, move, build widgets. Findable: yes.
- Wrong or stale facts: widget types match packages/shared/src/types/game.ts:951 (8 types); 4-widget limit matches packages/server/src/routes/game.routes.ts:2141 (MAX_GAME_HUD_WIDGETS = 4). Labels **Edit**, **Save Changes** (correct for editor in GameWidgetPanel.tsx:517), **Save Widgets** (en.json:9805), **Export Widgets** / **Import Widgets** (12854, 12856), **Build Widget Setup** (12433), **Accent** (12858) correct.
  - "Review Starting Widgets" (line 30): UI text is sentence case, "Review starting widgets" (en.json:12780). Trivial.
  - "Prepare Next Session Widgets" and "Start Next Session" (line 39) are hard-coded English in packages/client/src/components/game/GameWidgetPanel.tsx:846-853, not localized keys. Doc is right; code breaks the localization rule in AGENTS.md. Note for code owners.
  - Unverified: "Press **Remove**", "Press **Back**" labels (GameWidgetPanel.tsx:837 gives "Back", ok); "Current value" and "Maximum value" are labels in the editor (en.json:13036 for "Maximum value"; "Current value" not found).
  - "press the R key while the icon is focused" (line 60): not verified.
- Missing: a sample widget (what a Progress Bar looks like filled); what the phone pills look like.
- Duplication: mostly Roleplay HUD guide (linked). OK.
- Length: about 10%. Fine.
- Ban list: 1 hit.
- Priority: LOW.

### game/game-assets.md (2,297 words)
- Reader task: add music, sprites, backgrounds; choose assets per game. Findable: yes.
- Wrong or stale facts:
  1. "No **Backgrounds** are bundled. The background folders start empty" (line 25). Wrong: 12 starter backgrounds plus Black.jpg ship in packages/server/src/assets/default-backgrounds/ and are copied into the data folder on first boot (packages/server/src/db/seed-backgrounds.ts:1-25). The guide's own line 115 says "The bundled starter backgrounds count as shared". Contradiction within the page. HIGH.
  2. Starter set: five music tracks (packages/server/src/assets/default-game-assets/music/: 5 mp3 files) and ambient folders nature/urban/interior (matches). Correct.
  3. Upload size 50 MB audio/image, 10 MB text (packages/server/src/routes/game-assets.routes.ts:94-95). Correct.
  4. Upload folder defaults and types: not checked beyond the size constants.
  5. "Music & Sound Effects connection" (line 175): UI says **Use the default Music & Sound Effects account** (en.json:1869). Guide says "connection" in one place and UI says "account". Terminology conflict.
  6. "Expose" / "Game Audio" card label: correct (en.json:12468). "Adjust Game Assets for this Game" correct (12411). "Selecting", "Reset to all", "All folders included" correct (13154, 13125, 13094). "Asset Browser", "Upload to Server", "Choose Files", "Rescan", "Open in system folder" correct (15383, 15395, 15386, 15392, 13153).
  7. "Add description..." hint (line 138): not found in en.json. Unverified.
- Missing: how a music track is picked per scene (one sentence); what a missing-folder warning looks like.
- Duplication: "Music DJ custom folder" (187-198) duplicates the Music DJ guide (media/music.md, linked); keep a pointer only. Art-family section (107-115) is authoring-level.
- Length: about 25%. Move the art-family block (107-115) to the worlds guide or extending; move "Generated sound effects and music" (161-185) to media/music or connection docs.
- Ban list: 0.
- Priority: HIGH (wrong fact in the asset library; internal contradiction).

### game/ltx-2-3-storyboards.md (2,910 words)
- Reader task: set up a local LTX 2.3 ComfyUI video path for Storyboards. Findable: yes from storyboard.md. Audience: a user with a local GPU and ComfyUI; this is a power-user setup procedure, not a Game Mode guide.
- Wrong or stale facts:
  1. "Game Illustrator" (line 151) is labelled "Illustrator" in the wizard and in Chat Settings (en.json:12488). Minor.
  2. "Choose a six-second default duration, 16:9, and 480p" (line 138) and the connection steps: "Video Generation" connection, "ComfyUI" choice (ConnectionEditor.tsx:4767), "Base URL" (en.json:11469), "ComfyUI Workflow" field: not verified in en.json.
  3. Placeholder list (lines 98-107) matches packages/server/src/services/video/video-generation.ts:382-392 (%prompt%, %width%, %height%, %seed%, %length%, %fps%, %duration_seconds%, %model%). Missing from the guide: %length_s%, %global_prompt%, %local_prompts%, %segment_lengths%. Correct default fps 16 (video-generation.ts:357-359).
  4. Preset names "LTX Simple Image-to-Video", "LTX Director Storyboard", "Storyboard First Frame", "Narration Passthrough", "Krea 2", "Z-Image Turbo Narrative" come from the Storyboard package, not this repo. Unverified here.
  5. "Game Video Prompt" (line 169): correct (en.json:9664).
- Missing for its reader: a plain-language first step; a warning that this needs a GPU with ~8+ GB and what "VRAM" means; what success looks like (a clip in the Gallery's Videos tab).
- Duplication: storyboard.md:258-268 summarises the same profile. ComfyUI setup is in media/comfyui.md (linked). The model-format table duplicates model notes elsewhere.
- Length: about 60% cuttable. Move the model-format table, model filename list and official references (lines 33-76) and the "Record a reproducible setup" list (248-260) to media/comfyui.md or an advanced appendix. Keep the 6-step test (203-215) and troubleshooting.
- Ban list: 1 hit.
- Priority: MEDIUM (accurate placeholders; wrong audience and too deep for Game Mode).

### game/storyboard.md (3,512 words)
- Reader task: install Storyboard, turn it on for Roleplay or Game, generate. Findable: partly. The title is "Storyboard Agent Guide", filed under game/, but about half the page is Roleplay.
- Wrong or stale facts:
  1. "Use the Game image connection" (line 41) and "Use the Game image connection" wording: UI is **Use the chat image connection** (en.json:8149). Medium.
  2. "Expose image prompts before sending" (line 167): UI is **Expose media prompts before sending** (en.json:6733). Medium.
  3. "Use Storyboard Template" (line 183): UI label is **Use Storyboard Template** (en.json:9884); the agent-settings table at line 50 calls the same switch "Use the final image template" (en.json:8154). Two labels for two different controls or one control; check.
  4. "Animation Clip Duration" (line 179): correct (en.json:9519). Settings table "Keyframes per Turn" vs UI "Keyframes per turn" (8079): case only.
  5. "Still Planner" (line 181): UI is "Still planner" (en.json:8148). Case only. "Animation Planner" correct (9520).
  6. "Enable Storyboards", "Automatic Storyboard Illustrations", "Automatic Storyboard Animations", "View storyboard", "Create storyboard", "Using agent default", "Attach Card Appearance", "Send Avatar References", "Use NovelAI character prompts", "Manual only", "Still images", "Animations", "Floating viewer" (8064), "Viewer display" (8159), "Messages per episode" (8049), "Default Roleplay episode interval" (8122): correct.
  7. Source bounds "20 messages and 12,000 characters" (line 122): correct (packages/server/src/services/roleplay/storyboard-episode.ts:3-4).
  8. "IMAGE_GEN_TIMEOUT_MS / VIDEO_GEN_TIMEOUT_MS ... restart" (line 347): correct, both are restart-required (packages/server/src/config/env-watcher.ts:61-63).
  9. Preset names ("Still Keyframes", "Comic Page Animation", "Game Scene Illustration", "Cinematic Scene Video", "Comic Page Video", "Narration Passthrough", "NovelAI Keyframes") are package-owned; not present in the repo. Unverified here.
  10. "Revised Game Mode recipes" (line 204): "Revised" is changelog language. Retitle.
- Missing: a single first-run path for a new user (install, enable, connect image provider, pick keyframes, generate). Currently it is four separate quick starts.
- Duplication: install steps in getting-started.md:23 and ltx-2-3-storyboards.md:27; "Storyboard Optimized" repeated (getting-started.md:150-152, 270-274); the Roleplay half duplicates roleplay/ guides (owner should be roleplay).
- Length: about 50% cuttable. Move the Roleplay half (lines 101-142) to roleplay/ (or the Storyboard agent page under agents/), keep Game Mode. Move "Revised Game Mode recipes" (204-269) to ltx/recipes appendix. Move the settings tables to the agent settings page.
- Ban list: 1 hit.
- Priority: HIGH (scope mismatch, two wrong labels, duplication).

---

## EXTENDING

### extending/custom-tools.md (2,658 words)
- Reader task: build a custom tool (static, webhook, script) and turn it on. Findable: yes. Audience: hobbyist with some technical comfort. Good fit.
- Wrong or stale facts: none found on checked claims:
  - Section label **Functions** (en.json:15363), **Create function**, **Import functions from ZIP or JSON**, **Export functions to ZIP**, **Edit function**, **Script disabled**, **Add Parameter**, **Include hidden chat context**, **Webhook URL**, **Script Body**, **Static Result**, **Save & close**, **Keep editing** all correct (15349-15380, 8163-8220). The card descriptions "Returns a fixed string when called.", "Sends a POST request to an external URL.", "Runs a JavaScript expression server-side." are correct (packages/client/src/components/agents/ToolEditor.tsx:42-44).
  - Static empty result returns OK: packages/server/src/services/tools/tool-executor.ts:502. Correct.
  - Webhook body shape {tool, arguments, context}: tool-executor.ts:509-515. Correct.
  - Webhook reply cap 512 KB: tool-executor.ts:527 (`maxResponseBytes: 512 * 1024`). Correct. Timeout 60 s default: packages/server/src/config/runtime-config.ts:28; `CUSTOM_TOOL_TIMEOUT_MS` in docs/CONFIGURATION.md:268. Correct.
  - Local URLs blocked by default; `WEBHOOK_LOCAL_URLS_ENABLED` (runtime-config.ts:753-754, docs/CONFIGURATION.md:318). Correct. Guide does not name this variable; it points to CONFIGURATION.md. Acceptable.
  - `CUSTOM_TOOL_SCRIPT_ENABLED` (runtime-config.ts:758). Correct.
  - Name 1-100 and description 1-500 characters (lines 53): not verified.
- Missing: the Presets path is "top bar → Presets", but the guide says "Open the top bar and click Presets" (en.json:5990 navigation.topbar.presets). Correct.
- Duplication: game-tool planning (game/getting-started.md:174-186) overlaps "Turning on tool use for a chat"; keep this as owner.
- Length: fine. About 5% cuttable.
- Ban list: 0.
- Priority: LOW (accurate; good model for the other extending pages).

### extending/regex-scripts.md (2,236 words)
- Reader task: write and place a find-and-replace rule. Findable: yes. Good hobbyist fit.
- Wrong or stale facts: none found. Verified: "Regexes" section (15597), "No regexes yet" (15596), Create regex / Import regexes from JSON / Export regexes to JSON (8563, 8574, 8572), Find Pattern (Regex) (7986), Replace With (8008), Regex Flags (8002), Trim Strings (8023), Add trim string (7964), Live Test (7992), Apply To (7969), Apply Mode (7968), Advanced Options (7965). Default name "New Regex Script" (RegexScriptEditor.tsx:343), default flags "gi" (RegexScriptEditor.tsx:263), default apply mode display (RegexScriptEditor.tsx:264). All correct.
  - Note: "AI Output", "User Input", "Only Display", "Only Prompt", "Both" are hard-coded in RegexScriptEditor.tsx:54-78, not localization keys. Doc is correct; code breaks AGENTS.md localization rule.
- Missing: a sample that ships with the app (none), what "Result:" looks like for a no-match.
- Duplication: Macros link fine.
- Length: fine.
- Ban list: 5 hits ("just", "simply", "actually" etc. in file). Examples: "You do not need to know how to code"? not counted. Count per earlier grep: 5.
- Priority: LOW.

### extending/personal-extensions.md (2,696 words)
- Reader task: find and review a Professor Mari-made extension and enable it. Findable: yes (Settings > Addons). Audience mismatch: the first ~25 lines are for a user; the remaining ~240 lines are a developer API reference for the sandboxed Browser Extension (registerContribution, storage, chat context, dice formats, server extensions, platform support).
- Wrong or stale facts:
  - Empty-state text (line 7) matches en.json:6910. Correct.
  - "Review and Run" (line 25): correct (en.json:15324).
  - "Personal Extensions" and "Addons" tab (7142, 7192): correct.
  - "Full page access" approval text: correct (en.json:6895).
  - `estimateTextTokens(text: string): number`: correct (packages/shared/src/types/personal-extension.ts:12).
  - `marinara.ui.registerContribution` exists in the sandbox SDK (packages/server/src/routes/personal-extensions.routes.ts:627, 806). Correct.
  - "There is no New Draft action and there are no import controls in this section." Not verified against current UI; plausible.
- Missing for a user: what a draft looks like, how to read the code hash, what "External Extensions" is (the guide says self-written packages use a separately gated flow, and the gate itself is only in writing-personal-extensions.md).
- Duplication: writing-personal-extensions.md overlaps heavily (runtime, platform support, capability names). Owner should be writing-personal-extensions for the API.
- Length: about 80% cuttable from this page: keep the user intro, review/enable steps and a link. Move the rest to writing-personal-extensions.md (which already has a runtime table).
- Ban list: 5 hits.
- Priority: HIGH (mixed audience on the user's first page).

### extending/writing-personal-extensions.md (2,328 words)
- Reader task: write a Browser or Server Extension. Audience: developer. Good for its audience.
- Wrong or stale facts: gates verified: `ENABLE_EXTERNAL_EXTENSIONS` (packages/server/src/config/runtime-config.ts:771; env-watcher.ts:142) and the Danger Zone toggle **Allow third-party extension imports** (en.json:6834). Correct. Not verified: "Browser Extension API version 5" (personal-extension SDK version string not checked), `ADMIN_SECRET` and the Settings path.
- Missing: a "what you see when it loads" check step; the Debugging section is short.
- Duplication: platform table and runtime table overlap personal-extensions.md:219-236.
- Length: about 10%.
- Ban list: 1 hit.
- Priority: MEDIUM (dev doc; fix duplication with personal-extensions).

### extending/writing-rulesets.md (2,328 words)
- Reader task: write and import a ruleset JSON file. Audience: power user / author. Findable: yes (linked from game/rulesets.md).
- Wrong or stale facts: verified: **Import agents** (en.json:15043), **Game Mode ruleset** import choice (en.json:4379), "Allow custom Agent imports" under Danger Zone (6496), **Rules** section. Correct. File size 512 KB (packages/shared/src/schemas/ruleset.schema.ts:21). Correct. Example files `docs/examples/rulesets/ember-roads.json` and `gravewatch.json` exist. Correct. `$schema` path exists (docs/extending/ruleset.schema.json).
  - Stale: "256 KB before Capability API 1.340" (author noise, line 62).
- Missing: a minimal valid file inline; the first error message the importer shows.
- Duplication: good hub page for the ruleset-* set. OK.
- Length: about 10% (version history).
- Ban list: 0.
- Priority: MEDIUM (accurate hub; remove version history).

### extending/writing-story-scripts.md (5,375 words)
- Reader task: write a story script for a world (creator). Audience: creator (technical-ish; JSON, REST). Findable: yes, from getting-started "Making a world"? Only indirectly.
- Wrong or stale facts: limits checked: flags 256, events 256, knowledge 600 (packages/shared/src/features/world/story.ts:21-29). Correct. Route `GET/PUT/DELETE /api/game/:chatId/story` (packages/server/src/routes/game.routes.ts:12251) and `/api/game-worlds/:id/story` (routes/game-worlds.routes.ts:317-347). Correct.
  - "256 flags (64 before Capability API 1.353), ... 256 events (128 before 1.349)" (lines 44-46): version history, not user-facing.
  - Tag syntax `[story: event="<id>"]` and `[story: flag=... value=...]` (lines 506-507): not verified.
- Missing: a complete minimal example (the shape block is empty arrays); how the creator tests in-game beyond the PUT command (no UI path given, although the game's World tab lists objectives).
- Duplication: "Making a world" in getting-started.md:81-112 explains the same concepts from the player side; keep one.
- Length: about 30% cuttable (version history, long limit lists to a table, "Held ground" and "Seasons" sections).
- Ban list: 1 hit.
- Priority: MEDIUM (author reference; no UI path for a creator who does not use the API).

### extending/writing-creature-packs.md (1,068 words)
- Reader task: make a `.creatures.json` art pack. Audience: creator. Good fit, short.
- Wrong or stale facts: not verified in depth. Pixelforge is an external maker (fine). `.creatures.json` file type and board-pack references exist (packages/shared/src/features/world/board-pack.ts).
- Missing: how to load the pack in the app (no path given in the page top).
- Length: fine.
- Ban list: 0.
- Priority: LOW.

### extending/ruleset-mechanics.md (76,417 words, 1,168 lines)
- Reader task: look up what one catalog entry's `mechanics` block means. Audience: ruleset author, reference only.
- Structure: ONE heading (`# Ruleset Entry Mechanics`) for 76,000 words. 140 lines longer than 1,000 characters (longest 2,975). 569 blank lines. Each entry is a single very long paragraph with JSON snippets and "(Capability API 1.x)" tags.
- Wrong or stale facts: not checked line by line. Sampled a few statements (e.g., `amountAdd` read by ruleset fights only, line 3) and they read consistently with the code's shape; not verified.
- Missing: an index of keys; a table of allowed values per key; a worked example per `kind`.
- Duplication: ruleset-combat.md (keys for fights) and ruleset-checks.md overlap; "Capability API" version notes are repeated 547 times.
- Length: the single biggest problem in the set. Should be generated from packages/shared/src/schemas/ruleset.schema.ts or from ruleset.schema.json, or split into one page per `kind`/key group with a table per key (name, type, default, meaning). Prose can drop about 90 percent. Remove version tags.
- Ban list: 20 hits.
- Priority: HIGH (structural; unreadable).

### extending/ruleset-combat.md (22,317 words, 2,064 lines)
- Reader task: write a `battle` or `combat` block for a ruleset. Audience: author, reference.
- Structure: 11 H2/H3 sections; "Every key" subsection (line 168) runs ~400 lines. Positions section (line 1354) is ~250 lines. 68 "Capability API" tags, 29 "the Engine" mentions.
- Wrong or stale facts: not verified line by line. Only check made: the file's own statement "a fight you leave by deleting the message ... writes nothing back" is consistent with rulesets.md:38.
- Missing: a minimal example of a combat block; a checklist of required vs optional keys.
- Duplication: fighting-on-a-ruleset.md (game) explains the same fight from the player side; rulesets.md:28-40 repeats the battle table.
- Length: about 60% cuttable or splittable. Split into 4 pages: battle block (lending sheet), combat block keys, creatures/bestiary, board positions. Generate the key tables from the schema.
- Ban list: 14 hits.
- Priority: HIGH (structure, length, version noise).

### extending/ruleset-items.md (13,590 words, 666 lines)
- Reader task: define items, weapons, money, markets. Audience: author, reference.
- Structure: 20 H2/H3 sections, reasonable, but long sections of prose (e.g. "A market day", "Honest and dishonest sellers", "Spotting fakes" lines 567-656 are game-design prose).
- Wrong or stale facts: not verified. "Starting gear" (line 481) and markets duplicate game/party-and-npcs.md:88-100.
- Missing: item example end to end.
- Length: about 40% cuttable: markets and fakes read as design notes, move out or shorten. Capability API version tags 39.
- Ban list: 4 hits.
- Priority: MEDIUM-HIGH (length; duplicated with party-and-npcs).

### extending/ruleset-character-builder.md (8,684 words, 717 lines)
- Reader task: write a guided builder for a sheet. Audience: author. One H1, no H2s.
- Structure: single H1 for 8,700 words. Needs headings (Steps, Choices, Gating, Examples).
- Wrong or stale facts: not verified. Opening says "A sheet may declare `sheet.builder` (Capability API 1.86)". The UI labels **Guided** and **All fields** are correct (en.json:16270, 16244).
- Length: about 40% cuttable. Add headings first.
- Ban list: 1 hit.
- Priority: MEDIUM (no structure).

### extending/ruleset-checks.md (5,826 words, 334 lines)
- Reader task: choose a resolution kind (dice-sum, dice-pool, dice-highest, roll-against, symbol-pool). Audience: author, reference.
- Structure: good H3 split by kind. Acceptable.
- Wrong or stale facts: the five kinds match game/rulesets.md and writing-rulesets.md:9-16. Not verified in code.
- Duplication: game/dice-and-skill-checks.md:109-117 and 190 (symbol dice); rulesets.md:61-83. Owner: this page for authors.
- Length: about 15%.
- Ban list: 7 hits.
- Priority: MEDIUM.

### extending/ruleset-sheets.md (6,255 words, 366 lines)
- Reader task: write sheet fields, wound tracks, live states, rests. Audience: author.
- Structure: H2 sections fine.
- Wrong or stale facts: not verified. The guide says the "Full GM rules reference" is at line 227; kept.
- Duplication: game/rulesets.md:85-112 covers the same sheet UI for players. Keep the player summary there only.
- Length: about 15%.
- Ban list: 2 hits.
- Priority: MEDIUM.

### extending/ruleset-catalogs.md (2,807 words, 263 lines)
- Reader task: write catalog entries for picker lists (spells, features). Audience: author.
- Structure: clean H2s.
- Wrong or stale facts: not verified.
- Length: fine.
- Priority: LOW.

### extending/ruleset-layers-and-translations.md (2,381 words, 166 lines)
- Reader task: variants and translations. Audience: author.
- Structure: fine.
- Wrong or stale facts: not verified.
- Length: fine. Ban list: 1.
- Priority: LOW.

---

## Cross-cutting findings

1. Audience: the game/ guides are written for players, but several (rulesets, fighting-on-a-ruleset, combat's Elements/Battlefields paragraphs, dice pool sections) read as author/engine docs. The extending/ folder is author reference, but its top-level names do not say so.
2. Duplicated topics (owner in brackets):
   - Setting kit, world making, Overworld: getting-started (owner: a new worlds guide) vs map-time-weather, combat (elements/battlefields), party-and-npcs (money), writing-story-scripts.
   - Finish rolled turns in one request: dice (owner) vs getting-started.
   - Ruleset sheet UI: rulesets (owner) vs party-and-npcs and ruleset-sheets.
   - Money and markets: ruleset-items (owner) vs party-and-npcs and getting-started.
   - Storyboard install and Storyboard Optimized: storyboard (owner) vs getting-started and ltx.
   - Tool planning: custom-tools (owner) vs getting-started.
   - Personal extensions API: writing-personal-extensions (owner) vs personal-extensions.
   - Game Master modes: party-and-npcs (owner) vs getting-started.
   - Battle split (ruleset vs Marinara combat): rulesets (owner) vs fighting-on-a-ruleset, combat, ruleset-combat.
3. Terms for the same thing (UI term first):
   - connection (UI: "Connections", "connection" in Game settings) vs account ("Music & Sound Effects account", en.json:1869) vs provider ("Game tool provider", en.json:1096). Guides use all three.
   - Built-in model (UI) vs "Local Model (Gemma)" (guide) vs "local sidecar" (code comments, en.json:8501 in ChatSettingsDrawer).
   - Illustrator (UI) vs "Visual Generation" (guide) vs "Game Illustrator" (ltx guide).
   - Rules (UI) vs ruleset (guides).
   - Marinara vs "the Engine" (158 uses in the top 14 files, mostly rulesets and extending).
   - GM vs Game Master: both used in every guide. UI uses "GM" in labels (for example "GM intro message", "GM Prompt").
   - Storyboard / Storyboards / storyboard.

---

## Priority summary

HIGH: getting-started (wrong labels, locked feature as main path, 5.9k words); rulesets (author depth, wrong label); fighting-on-a-ruleset (unreadable, no task); party-and-npcs (two wrong button labels on the everyday task; 3.5k); map-time-weather (morale dice effect not implemented); game-assets (backgrounds claim wrong and self-contradictory); storyboard (scope mismatch, wrong labels); personal-extensions (mixed audience); ruleset-mechanics (76k, one heading); ruleset-combat (22k, 2,064 lines); ruleset-items (13.6k).
MEDIUM: combat (difficulty applies to enemy only); dice (dense); sessions-and-saves (one label); ltx-2-3 (wrong audience, too deep); writing-personal-extensions; writing-rulesets; writing-story-scripts; ruleset-character-builder (no headings); ruleset-checks; ruleset-sheets.
LOW: hud-widgets, custom-tools, regex-scripts, writing-creature-packs, ruleset-catalogs, ruleset-layers.

---

## Word list candidates

- Built-in model | "Local Model (Gemma)", "local sidecar", "Gemma", "scene-effects connection" | the on-device model that Marinara can download and run for small helper jobs.
- Illustrator | "Visual Generation", "Game Illustrator", "image generation toggle" | the switch and card that makes NPC portraits, backgrounds and scene images.
- Game tool provider | "Game tool connection", "tool planning connection", "separate tool connection" | the connection that picks tools before narration.
- Edit card | "Edit Sheet", "edit character sheet" | opens the editor for a party member's character card in the game.
- Retry (sheet) | "Regenerate Sheet", "regenerate the sheet" | asks the AI to rebuild a party member's sheet.
- Edit ruleset sheet | "Edit sheet", "Edit Sheet" | opens the full ruleset sheet editor (Guided and All fields).
- Download setup | "Download .txt", "setup file" | saves the game's creation setup as a text file.
- Use the chat image connection | "Game image connection", "Use the Game image connection" | the image connection used by this chat's Game/Storyboard media.
- Expose media prompts before sending | "Expose image prompts", "review prompts" | shows the compiled prompts before a manual media job runs.
- Use Storyboard Template | "Use the final image template" | applies the final formatter before the image request (verify: two UI labels found).
- Rules | "ruleset", "rule set", "rules package" | a tabletop rules file you pick for a new game.
- Music & Sound Effects account | "connection", "audio connection" | the service used to generate sound and music.
- Setting kit | "world kit", "worldkit", "starter kit" | the word-set that gives a setting its places, money, sounds and art.
- Experience | "map pack", "experience pack" | a bundle that ships a setting kit, maps and tiles.
- Storyboard | "Storyboard Agent", "storyboards" | the downloadable agent that turns story text into keyframes and clips.
- Game Master (GM) | "the Engine" (when meaning the AI host) | the AI that runs the game; say "Game Master (GM)" on first use, then "GM".
- Marinara | "the Engine" | the app itself; use "Marinara" in guides, reserve "engine" for the code.
- Checkpoint | "save", "save point", "backup" | a stored moment of the game you can load back.
- Session History | "session list", "history" | the list of concluded sessions in the Session panel.
- Morale | "party morale" | a hidden 0-100 score with five tiers (Broken to Inspired); the dice effect is not implemented.
