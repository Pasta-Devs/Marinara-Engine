# Audit: docs/roleplay/*.md and docs/characters/*.md

Checkout: `/tmp/claude-0/-home-user-Marinara-Engine/a5b245ec-f036-586c-974e-94c0812b16ad/scratchpad/ro` (staging, commit f756cfdce). Docs match the working checkout at `/home/user/Marinara-Engine`.
Method: read each guide; checked UI labels against `packages/client/src/localization/locales/en.json` and the components that render them; checked defaults and limits in code; ran a link and anchor check over all 15 files.
Line refs are `file:line` in the `ro` checkout (`packages/...` abbreviated below).

## Cross-cutting

- **Links and anchors:** all relative links resolve; all `#anchors` resolve to GitHub-style slugs. One flag in `characters/galleries.md:76` (`card://self/gallery/...`) is inside a fenced code block, so it is not a broken link.
- **Opener ban:** 16 of 21 guides use "This guide covers / explains / shows" in the opening paragraph (line 3). Banned by SKILL.md ("Text that describes what the docs will do"). Affects: roleplay/backgrounds, combat-encounters, getting-started, hud-and-trackers, narrative-director, scenes, characters/bot-browser, choosing-your-persona, colors-and-stats, creating-and-editing-characters, galleries, import-export, interactive-onboarding, library-organization, personas, sprites. Mid-text repeats also exist: creating-and-editing:40, personas:9, sprites:24. Fix: open with what the feature is for.
- **Em dashes:** 5 total. hud-and-trackers.md:35, :39, :75, :147; characters/interactive-onboarding.md:101.
- **Other ban-list hits:** "Note that" hud-and-trackers.md:33. "simply" library-organization.md:76. "easy" library-organization.md:82. "very" bot-browser.md:91, getting-started.md:182 ("Very weak models"). "actually" bot-browser.md:165, sprites.md:130. "just" as filler: hud-and-trackers.md:37, 61, 98, 102; scenes.md:45, 57; getting-started.md:70, 90 (these two are "just below", a location sense, OK to keep).
- **Callouts:** no `> **Note:**`, `> **Tip:**` or `> **Warning:**` blocks in any of the 15 files. Candidate Warning: hud-and-trackers.md:102 "Clear Trackers cannot be undone" (data loss, SKILL.md allows Warning for that).
- **Bold density:** high (53 to 167 bold spans per guide). Most are UI labels, which is allowed. Not counted as violations.
- **Hard-coded English in UI (code issue, not doc):** these labels are literal strings, not localization keys, so the docs match the app but the app skips i18n: `components/ui/CustomEmojiTagButton.tsx:64, 103-124` (Make emoji, Make sticker, Switch to emoji/sticker, Remove emoji/sticker, Rename); `components/chat/ExpressionSpriteSettings.tsx` (Expressions, Full-body option labels); `components/modals/ImportCharacterModal.tsx:39-49` (All tags / No tags / Existing only, Character only / Global); `components/bot-browser/BotBrowserView.tsx` (Show Low Quality toggle). Flag to maintainers; docs should keep the English label.

---

## roleplay/getting-started.md (205 lines, ~21.7 KB)

- **Main tasks:** start a roleplay (wizard), understand the stage, sprites, HUD, chat tools, Author's Notes. Findable: partly. The guide is the Roleplay hub, but it also holds Whispers, Private notes, Illustrations, HTML, Video, Interruptions, Echo, CYOA, Combat, Scenes, Models and Troubleshooting. Reader looking for "Whisper" or "CYOA" has to scroll 200 lines. Yes for the wizard and HUD, no for features.
- **Wrong or stale facts:**
  1. **"Roleplay Commands" is not a UI label.** The section is titled **Commands** (`packages/client/src/components/chat/RoleplayCommandsSettings.tsx:40`, key `roleplay.commands.title` = "Commands" at en.json:6280). It sits inside the Agents section (`ChatSettingsDrawer.tsx` ~8402-8416). Wrong path used 6 times: lines 106, 112, 122, 142, 150, 156. Fix to **Chat Settings → Agents → Commands**.
  2. **Illustrations and Video clips need the Illustrator agent.** `RoleplayCommandsSettings.tsx:62-66`: `illustrate` and `video` are only available when the Illustrator agent is installed and active in the chat. Guide (line 106, 150) gives no prerequisite; the toggle is greyed out without it. Music needs Spotify agent, Combat needs Combat agent (same lines).
  3. Wizard steps (lines 19-25) match `packages/client/src/components/chat/ChatSetupWizard.tsx:146-168`. Verified.
  4. Sprite section labels (Sprite Source, Expression Size, Full-body Size, Default Side, Expression Avatars, Arrange, Done, Reset) match `ExpressionSpriteSettings.tsx` and en.json. Verified.
  5. Injections tab appears only with Debug mode: `components/agents/AgentActivitySection.tsx:49` (`showInjectionsTab = debugMode`). Verified.
  6. Author's Notes Injection Depth help text matches en.json:9101. Verified.
  7. HTML Artifacts, Whisper, Interruptions and Video clips all start off: matches `RoleplayCommandsSettings.tsx` checked state. Verified (Illustrations/HTML labels match en.json:6240-6245).
- **Missing steps:** Turning on a command needs the command's agent (see 2). No "what you see now" after enabling Illustrations/Render in-line. "Settings → Appearance → App" mentioned, not explained. "Chat tools" three-dot menu on phone not explained.
- **Unexplained terms:** "agent" is explained, but "thought bubble" (line 92), "Narrator" (appointed narrator, line 122), "group Individual mode" (line 126), "merged mode" (not here, but in scenes), "Smart response order" (line 126), "hidden from everyone", "Hide from AI" (line 130).
- **Duplication:** Scenes section (174-176) repeats scenes.md (owner: scenes.md). Combat section (170-172) repeats combat-encounters.md (owner: combat-encounters.md). Models (178-184) is a summary of generation-parameters (owner: prompts/generation-parameters.md). Pointers are fine; keep them short. Author's Notes says "this guide is its main reference" (line 86); no owner guide found in the chats/ folder yet. Could not verify.
- **Length:** cut ~35%. Move Whispers and Private notes (120-146, ~27 lines) and the rest of the Roleplay Commands features (104-160) into one reference page "Roleplay commands" (`roleplay/commands.md`, new). Move the "Chat tools" list (62-74) to chats/chat-settings.md (owner).
- **Ban-list:** opener "This guide covers" (line 3). "Very" (182). "just below" (70, 90; location sense, OK to keep).
- **Links:** all resolve; anchors none. OK.
- **Priority:** HIGH (wrong menu name in 6 places; missing prerequisite; length).
- **Terms:** "Roleplay Commands" (docs) vs **Commands** (UI). "Agent" vs "helper" used as synonyms (line 11). "Narrator" vs "narrator character" (line 126, UI key says "Show the note to the narrator character"). "HUD" vs "Roleplay HUD" (UI uses "Roleplay HUD", e.g. "Shown in the Roleplay HUD").

## roleplay/hud-and-trackers.md (166 lines, ~19 KB)

- **Main tasks:** see the HUD, find a tracker, edit a value, lock a value, re-run a tracker, use the State Editor. Findable: yes for "edit a value" and "lock"; hard for "State Editor" (buried at line 136).
- **Wrong or stale facts:**
  1. **"Add field" button does not exist.** The State Editor's add-field button reads **Add** (`packages/client/src/components/ui/state-editor/StateFieldsView.tsx:230`, key `ui.stateEditor.fields.add` = "Add", en.json:16542). Line 147. "Add item" (line 147) is correct (en.json:16543).
  2. **"Reload" button:** line 152 says a conflict shows a **Reload** button. No "Reload" label found in `components/ui/state-editor/`. Could not verify; check where the refused-save notice is rendered.
  3. Lock tooltips (lines 88-92: Enter lock mode, Lock field, Unlock field, Exit lock mode) match en.json:the `ui.chat.hudlockmodetoggle.*` and `ui.chat.hudfieldlockbutton.*` keys. Verified.
  4. Tracker widget → agent table (lines 23-31) names match `packages/server/src/services/professor-mari/official-agent-knowledge.ts` (World State, Quest Tracker, Character Tracker, Persona Stats, Custom Tracker, Inventory Tracker). Verified.
  5. Tracker Panel default is ON (line 127 "on by default"): `client/src/stores/ui.store.ts:2152, 3410, 3900` sets `trackerPanelEnabled: true`. Verified.
  6. Temperature unit default °C (line 134): `ui.store.ts:620-624`, fallback "celsius". Verified.
  7. Trackers window starts pinned (line 51): `components/chat/RoleplayTrackerWindow.tsx:109` `pinned: true`. Verified.
  8. Tracker Panel settings location "Settings, under the Appearance tab" (line 106): `components/panels/SettingsPanel.tsx` (tab id `appearance`, line 250). Plausible; section label not checked.
  9. "Desktop size" options Compact / Standard / Expanded (line 131): labels found in `SettingsPanel.tsx:640-650`. Verified.
  10. Manual trackers: line 100 says "Trackers Control" → "Individual tracker schedule". Both keys exist (en.json:986, ui.chat.chatsettingsdrawer.individualTrackerSchedule). Verified. The old "Manual Trackers" switch is only a server flag `chatMeta.manualTrackers` (`server/src/routes/generate.routes.ts:5003`); no UI label, so line 100's reference is fine as migration text.
  11. "Put back in Trackers" (line 61): en.json:2761 has "Put back in {{host}}" (`drawer.popOut.close`). Consistent. Verified.
- **Missing steps:** Lock mode: no "what you see" after clicking the top toggle (lock icons appear next to each value; line 89 says so, OK). State Editor: how to reach it on a phone is described but no screenshot-ready label order. "Re-run" on phone vs computer not split.
- **Duplication:** "Agent activity" is explained three times: getting-started.md:88-96 (owner), hud lines 63, 90-92 (`Agent activity has its own section…`), and 102. Keep one (owner: getting-started or a new agent-activity page). Widget → agent table repeated in line 156 ("The widget table at the top of this guide"). Lines 154-158 duplicate personas.md and colors-and-stats.md (Stats tab feeds the HUD).
- **Length:** cut ~30%. The Tracker Panel settings list (125-134, 10 items) and the State Editor section (136-152, 17 lines) are reference material: move to a table or a separate "State Editor" reference. Keep the widget table, editing, lock mode, re-run.
- **Ban-list:** 4 em dashes (35, 39, 75, 147), "Note that" (33), "just" (37, 61, 98, 102 — check sense).
- **Links:** all resolve (including `../game/hud-widgets.md`). Anchors none.
- **Priority:** HIGH for the "Add field" label; MEDIUM overall (duplication, length).
- **Terms:** "HUD" vs "Roleplay HUD" (UI) vs "heads-up display" (docs). "Tracker Panel" (UI) = the side panel; "Trackers window" (UI key chat.trackerWindow.title). Docs say "Tracker Panel" and "Trackers window" consistently. "Tracker" vs "tracker agent" — keep both, define once. "Drawer" (line 59) is an internal term; UI shows a section header. Replace with "section".

## roleplay/narrative-director.md (102 lines, ~6.4 KB)

- **Main tasks:** arm Push Story for one reply; choose mode; turn on Secret Plot; edit the hidden arc. Findable: yes.
- **Wrong or stale facts:**
  1. **Push Story mode is not set in Chat Settings.** The Narrative Director card in Chat Settings has no mode picker. Its only text reads "Choose between a natural or random push each time from the Push Story button above the chat input" (`ChatSettingsDrawer.tsx:9076`; key `ui.chat.agentaddsetupfields.chooseBetweenANaturalOrRandomPushEachTime`). Lines 32-33, 39 ("open Chat Settings, go to Agents, find the Narrative Director card, and click the mode you want") are wrong.
  2. **There is no default mode.** Line 39 says "**Natural** is the default". Code: clicking Push Story while unarmed opens a menu to pick the mode (`components/chat/ChatInput.tsx:874-890`, `handlePushStoryClick` sets `pushStoryMenuOpen`, `handleArmPushStory(mode)`). Nothing is pre-armed. Fix: the mode is chosen each time from the Push Story menu.
  3. **UI labels are "Naturally" and "Randomly", not "Natural" and "Random Event".** Menu items (`ChatInput.tsx` ~1960-1985): **Naturally** — "Push the existing plot forward"; **Randomly** — "Add a plausible surprise to the scene" (en.json:9364-9370 `ui.chat.chatinput.naturally`, `randomly`, `pushTheExistingPlotForward`, `addAPlausibleSurpriseToTheScene`). "Random Event" appears in no en.json value.
  4. **Armed button label** (missing from guide): reads **Push Story: Naturally** or **Push Story: Randomly** (`ChatInput.tsx:1943`, key `ui.chat.chatinput.pushStoryValue1`).
  5. **Tooltip quotes are wrong.** Line 41 quotes "Arm a natural Narrative Director push for the next response." Not in en.json (no "Arm a" key). Armed-tooltip keys are `ui.chat.chatinput.chooseHowTheNarrativeDirectorPushesTheStoryIn` ("Choose how the Narrative Director pushes the story in the next response") and `disarmTheNarrativeDirectorPush`. Replace.
  6. Toast on arm (line 21) matches en.json:9351 with `{{value1}}` = "naturally"/"randomly". Verified. Disarm toast (line 26) matches en.json:9364. Verified.
  7. Secret Plot toggle label (line 53) matches `ui.chat.chatsettingsdrawer.maintainAHiddenLongTermArcForThisRoleplay`. Verified.
  8. Run Interval default 8, range 1-100 (lines 59): `components/agents/AgentEditor.tsx:1092` default 8, `AgentAddSetupFields.tsx:1445-1446` min 1 max 100. Verified.
  9. Reveal/Hide/Spoilers labels (lines 65-67): en.json:8036-8038, `ui.agents.secretplotpanel.*`, and `ui.agents.secretplotpanel.revealEmptyArc`, `hideSpoilers`, `spoilersHidden`. Verified. Field labels (Arc description, Protagonist arc, Character arc) verified.
  10. Regenerate dialog (line 76): title "Regenerate Secret Plot", buttons **Regenerate** and **Keep Current Arc** (`components/agents/SecretPlotPanel.tsx:170-173`). Verified.
  11. "Copy default to edit" (line 89) matches en.json `ui.agents.agenteditor.copyDefaultToEdit`. Verified.
  12. Line 53 says the Secret Plot label reads "Maintain a hidden long-term arc for this roleplay." Verified.
- **Missing steps:** Push Story menu step (see 1-2). Say what happens if you click Push Story while generating (disabled, line 28 correct). Say how to disarm via the menu (line 26 correct but needs the button reference).
- **Duplication:** Opening text (lines 7) explains agents, duplicating agents-overview.md (linked). Fine.
- **Length:** cut ~15%: the Secret Plot prompt section (82-96) can move to the agent editor reference.
- **Ban-list:** none.
- **Links:** all resolve.
- **Priority:** HIGH (wrong control location and wrong default; wrong UI labels).
- **Terms:** "Push Story" (UI, keep), "Natural/Random Event" (docs) vs "Naturally/Randomly" (UI). "Narrative Director" (UI name) vs "director" (internal id; not user-facing). "Secret Plot" (UI, keep).

## roleplay/backgrounds.md (57 lines, ~4 KB)

- **Main tasks:** turn on the Background agent; generate a background by hand; pin a background to a chat. Findable: yes.
- **Wrong or stale facts:**
  1. **Quoted progress note does not exist.** Line 32 quotes "AI background generation is running. The new background will be applied when it finishes." No match in en.json or `packages/` source. Remove the quote or replace with the real behavior.
  2. Error message (line 34) matches `packages/server/src/routes/backgrounds.routes.ts:458` exactly. Verified.
  3. "Roleplay and Game modes only" (line 36) matches `backgrounds.routes.ts:~441` ("Scene background generation is available in Roleplay and Game modes"). Verified.
  4. Background label "Background" button in Gallery (line 29) matches `ui.chat.chatgallery.background` = "Background" (en.json:9278). Verified. "Generating..." (line 30) matches `ui.chat.imageregeneratepanel.generating`. Verified.
  5. Settings path **Settings → Appearance → Backgrounds → Chat Background** (lines 42-47): key `ui.panels.appearancesettings.chatBackground` = "Chat Background" (en.json:15080). Verified. "Remove" button not verified.
  6. Background agent is off by default (line 15): not verified.
- **Missing steps:** No "what you see" after step 4 in the Background agent section ("the backdrop updates on its own" is vague). Manual generation: say where the new image goes (line 32 says library).
- **Duplication:** "Your background library and blur" (lines 49-51) duplicates appearance/chat-backgrounds.md (linked, OK; keep pointer only). "Generate a background by hand" overlaps media/scene-backgrounds.md (linked as "AI scene art from the Gallery"). Check which guide owns manual generation; one should link.
- **Length:** cut ~10%.
- **Ban-list:** none. Opener: "This guide covers" (line 3).
- **Links:** all resolve.
- **Priority:** MEDIUM (one invented quote; otherwise accurate).
- **Terms:** "Background agent" vs "Backgrounds" section vs "scene backdrop" vs "background" (UI uses "Background" and "Chat Background").

## roleplay/combat-encounters.md (92 lines, ~5.7 KB)

- **Main tasks:** enable Combat agent; start an encounter; play; end. Findable: yes.
- **Wrong or stale facts:**
  1. Encounter button tooltip "Start Combat Encounter": `ui.chat.chatinput.startCombatEncounter` (en.json:9371). Verified.
  2. Setup modal title "Configure Combat Narrative" (en.json `ui.chat.encounterconfig.configureCombatNarrative`), **Begin Combat**, "Initializing combat encounter..." (`ui.chat.encountermodalinner.initializingCombatEncounter`), "Combat Encounter" title, "Your Actions", "Custom Action", "Select Target", "All Enemies", "Processing action...", "Combat Error", "Close Encounter", "Close Combat Window", "Close Anyway". All verified in en.json.
  3. Combat Narration / Summary Narration labels (lines 27-28): en.json has "⚔️ Combat Narration" and "📜 Summary Narration" (emoji prefix). Docs should drop the emoji from the label text or note it. Low.
  4. Result banner words (line 71) **VICTORY, DEFEAT, FLED, INTERRUPTED**: the general combat strings are "Victory!" and "Defeat..." (`game.combat.banner.victory`, `game.combat.banner.defeat`, en.json:2869-2871). Roleplay-combat banner keys not checked. Could not verify; check the Roleplay combat result banner before publishing these caps.
  5. "Conclude" in the top bar (line 68) matches `ui.chat.encountermodalinner.conclude` (en.json:10177). Verified. The confirm box text "Conclude this encounter early?" exists (10179). "End Combat" (line 69) matches `ui.chat.encountermodalinner.endCombat`. Verified.
  6. Narration options (line 32-35): Present/Past Tense, Omniscient/Limited exist (`ui.chat.narrativeselect.*`). Person labels (First/Second/Third Person) not verified.
- **Missing steps:** After **Begin Combat** the reader needs a line on what happens to the chat message list. "Your buttons unlock when the turn finishes" is good; add an "If it did not work" line (no troubleshooting, despite having a Combat Error screen).
- **Duplication:** "How it differs from Game Mode combat" (75-85) is a comparison that belongs in game/combat.md (linked). Keep 2 lines here.
- **Length:** cut ~10%.
- **Ban-list:** "This guide explains" opener only.
- **Links:** all resolve.
- **Priority:** MEDIUM (banner words unverified; no troubleshooting).
- **Terms:** "Encounter" (button), "Combat Encounter" (modal), "combat" (agent). Fine. "Combat Error" (screen). "Spellbook" (UI, `commandCenter.values.lorebookCategory.spellbook`).

## roleplay/scenes.md (101 lines, ~8.3 KB)

- **Main tasks:** start a scene from a conversation; end, discard, clone, or convert. Findable: yes.
- **Wrong or stale facts:** none found in the checks below.
  1. `/scene` command and alias `/rp`: `packages/client/src/lib/slash-commands.ts:1281-1282`. Verified.
  2. "A scene is in progress", "Go to Scene", "Allow replies here", "Back to conversation": en.json:10979-10984 (`ui.chat.scenebanner.*`). Verified.
  3. "End Scene" (`ui.chat.endscenebar.endScene`), "End and save summary?", "Discard scene?", "Convert this scene into a standalone roleplay?", "Convert", "Clone from here", "Set up scene", "Scene Prompt Setup", "Plan Scene". All verified (en.json:10184-10192, 8xxx; `ui.modals.scenepromptpreferencesmodal.*`).
  4. POV labels First/Second/Third Person and Tense Past/Present/Future: `components/modals/ScenePromptPreferencesModal.tsx:21-30`. Verified.
  5. **Discard button:** line 61 describes it as **Discard**. Button label is "Discard" (`ui.agents.agenteditor.discard`, reused by `SceneBanner.tsx:~275`). Verified, but the key is reused from the agent editor; the label is correct.
  6. "Saving..." state (line 60) matches `game.ruleset.sheet.saving` and `ui.game.gamejournal.savingEntry` — generic. Could not verify the scene-specific string.
  7. Extra instructions field label: `ui.modals.scenepromptpreferencesmodal.extraInstructions` (en.json). Verified.
- **Missing steps:** "Discard" line says "Nothing is written back" (64) and End Scene says "keeps a memory". Good. No "If it did not work" line; add one for "no origin conversation" (Back to conversation hidden).
- **Duplication:** "Why scenes do not inherit connected chat context" (89-95) duplicates chats/connected-chats.md (linked). Keep 2 lines.
- **Length:** cut ~10%.
- **Ban-list:** "just" x2 (45, 57) sense: "just type the command" (45) is filler. Opener "This guide explains".
- **Links:** all resolve.
- **Priority:** LOW.
- **Terms:** "scene" (UI and docs agree). "Conversation" (mode) vs "conversation" (lowercase) fine. "Clone" vs "fork" (line 87 uses both "fork" and "clone"). Pick "clone" (UI) and drop "fork".

## characters/creating-and-editing-characters.md (218 lines, ~17.8 KB)

- **Main tasks:** create a character; find the editor tabs; write fields; add avatar; use version history. Findable: yes.
- **Wrong or stale facts:**
  1. Create flow: **New** → **Create Character** → **Name** → **Create** (lines 13-17). Labels verified: `ui.modals.createcharactermodal.createCharacter` ("Create Character"), `...name` ("Name *"), `...create` ("Create").
  2. Editor tabs in order (line 38): Metadata, Card, Onboarding, Convo, Lorebook, Sprites, Gallery, Colors, Voice, Stats, Advanced. Verified: `editor.tabs.*` keys in en.json (card, colors, convo, gallery, lorebook, metadata, onboarding, sprites, stats, voice). "Advanced" tab label not verified in editor.tabs (no `editor.tabs.advanced` key). Could not verify.
  3. Save button states: "Uploading…" and "Saving…" verified (`editor.save.uploading`, `editor.save.saving`). **"Embedding…"** verified (`editor.save.embedding`).
  4. Header buttons (line 30-34): Favorite, Export character, Import character as persona, Duplicate character, Delete character — verified (`ui.characters.charactereditor.*`).
  5. Talkativeness: 0-100 percent, default 50 (line 57): `shared/src/schemas/character.schema.ts:93` default 0.5. Verified.
  6. Depth 4 default and role System (line 168): `packages/server/src/services/prompt/macro-context.ts:1002-1004`. Verified.
  7. Portrait size default 1024x1024 (line 148): `packages/server/src/services/image/image-generation-settings.ts:33`. Verified.
  8. **"Character ID"** (line 53): no en.json key with that text. The persona version is "Persona ID" (`ui.personas.personametadatatab.personaId`). Check the character label key before publishing.
  9. Professor Mari cannot be deleted (line 207): server text says "Professor Mari's own built-in card is managed by Marinara and reset on every start, so it cannot be edited or deleted" (`server/src/services/mari-db/mari-db.service.ts:8986`). The guide's "the app blocks it and tells you she is a built-in character" was not verified against a delete-route message.
  10. Version reset sets "0.0" (line 191): could not verify in code (no literal `"0.0"` found in client components). Check `characterversionhistorypanel`.
  11. Compare window lists fields Name, Description, ... (line 182) — not verified.
  12. Avatar generation: **Generate Character Avatar**, **Use Avatar**, **Use current avatar as a reference**, **Regenerate**: verified (en.json).
- **Missing steps:** Alternatives (lines 106-123, ~18 lines) lack an example. Version history "Reset" consequences fine. Missing: "what you see" after Create (line 19 says the editor opens — good).
- **Duplication:** personas.md repeats almost all of the Card tab, the wand, alternative fields, and version history (see personas.md). Owner: this guide. Also the Voice tab overlaps tts-setup (linked, OK).
- **Length:** cut ~15%: move the alternative-fields section (106-123) and the Voice tab detail (150-158) to reference sections.
- **Ban-list:** 2 "This guide" openers (3, 40).
- **Links:** all resolve. Note `#...` anchors in other guides into this one are not used.
- **Priority:** MEDIUM ("Character ID" label; several unverified claims).
- **Terms:** "character card" vs "card" vs "character" — pick "character card" once; "Card tab" (UI) = the Card tab. "Alternative field" (UI: "Add Alternative Field") vs "alternate greeting" (UI: "Alternate Greetings") — two unrelated terms, keep both but define them apart. "Summary" (card field) vs "Chat Summary" (chat feature).

## characters/personas.md (218 lines, ~19 KB)

- **Main tasks:** create a persona; edit; choose a persona per chat (see choosing-your-persona); import/export; delete. Findable: yes for create; Persona Editor sections duplicate other guides, so the reader can't tell which guide to trust.
- **Wrong or stale facts:**
  1. **Search placeholder** (line 28): guide says "Search personas/tags" — matches `search.panels.personasAndTags` in en.json. Verified. (Choosing-persona's "Search personas..." is the wrong one; see that guide.)
  2. Persona Export window options **Marinara Native** and **Compatible JSON** (lines 201-202): `components/ui/ExportFormatDialog.tsx:51-52`. Verified.
  3. Persona version default "1.0" (line 72): `client/src/components/personas/` (`personaVersion ?? "1.0"`). Verified.
  4. Starter status bars Satiety, Energy, Hygiene, Mood at 100/100 (line 152): `shared/src/utils/authored-card.ts:105-110` (`defaultPersonaBars`). Verified.
  5. RPG starter HP and MP 100/100; STR...CHA at 10 (line 153): `shared/src/utils/rpg-stats.ts` HP at line 4; MP and attribute defaults not checked. Partly verified.
  6. Duplicate name "{original name} (Copy)" (line 178): `packages/server/src/services/storage/characters.storage.ts:1145` ("(Copy)" suffix for personas). Verified.
  7. "Delete All Expressions" / "Delete All Full-Body" (line 131 of sprites and personas): UI shows **Delete All** + category name (`PersonaEditor.tsx:3104-3107`). The docs' composed label is accurate in effect; say "Delete All" + category.
  8. Export persona header, **Add persona as character**, **Duplicate persona**, **Delete persona** (line 56): en.json:`ui.personas.personaeditor.*`. Verified.
  9. "Persona ID" with Copy (line 66): `ui.personas.personametadatatab.personaId`. Verified.
  10. Tabs in order (line 60): Metadata, Card, Convo, Lorebook, Sprites, Gallery, Colors, Stats. Consistent with editor.tabs keys. Verified.
  11. "Open Library" (line 24) and Personas panel buttons New / Import / Select / New Folder: `ui.panels.resourceLibraryLauncher.openLibrary` and `ui.panels.backgroundpicker.newFolder` verified. "Persona Library" name not checked.
  12. Import accepts .marinara and .json only (line 190-193): not checked against the Persona import modal (`ImportCharacterModal` accepts .json, .png, .marinara, .charx; persona import accept list not checked).
  13. "Persona Editor" is a doc term; UI does not title the page that. Low.
- **Missing steps:** No "what you see" after Create. No step for choosing the persona in a chat (points to choosing-your-persona: OK).
- **Duplication (largest in this set):**
  - Card tab + wand + alternatives + Active in + version history (lines 78-123, 161-174) duplicate creating-and-editing-characters.md (owner). Replace with one paragraph and a link.
  - Sprites tab (125-131) duplicates sprites.md (owner). Cut to one sentence.
  - Import/Export (186-204) duplicates import-export.md (owner) and the Export dialog.
  - Colors tab (137-146) duplicates colors-and-stats.md (owner).
  - Stats tab (148-159) duplicates colors-and-stats.md (owner) and the agent list (95-103 there).
  - Version history (161-174) duplicates creating-and-editing.md (owner).
- **Length:** cut ~40% (about 90 of 218 lines).
- **Ban-list:** 2 "This guide" openers (3 and "This guide covers"). Fine otherwise.
- **Links:** all resolve.
- **Priority:** HIGH for duplication (readers get two versions of the same rules); MEDIUM for facts.
- **Terms:** "Persona" (UI) vs "user persona" (guide titles). "Persona Status Bars" (UI) vs "status bars" vs "Persona Stats" (agent name, UI). "Pools" / "Attributes" (UI) vs "RPG stats" (docs, character toggle is "Enable RPG Stats" but persona toggle is "Enable RPG Attributes"). Pick one: "RPG Attributes" for personas.

## characters/choosing-your-persona.md (61 lines, ~3.6 KB)

- **Main tasks:** pick a persona for a chat; switch mid-chat; use None. Findable: yes.
- **Wrong or stale facts:**
  1. **Search placeholder** (line 23): guide says "Search personas..." (with ellipsis). Code uses `ui.chat.chatsettingsdrawer.searchPersonas` = "Search personas" (en.json:9823) at `ChatSettingsDrawer.tsx:6093, 6407` and `ChatSetupWizard.tsx:784`. Fix to "Search personas".
  2. Button text (line 22): "Choose Persona" / "Change Persona". Code composes **Choose** or **Change** + "Persona" (`ChatSettingsDrawer.tsx:6395-6400`, keys `ui.chat.chatsettingsdrawer.choose` / `.change` and `ui.characters.cardlibrarydetailcard.persona`). Accurate in effect.
  3. "No persona selected." (line 21): matches `ui.chat.chatsettingsdrawer.noPersonaSelected` (en.json:6066-6383 usage). Verified.
  4. "Your Persona" (wizard, line 31) matches `ui.chat.conversationquicksetup.yourPersona`. Verified. "Player's Persona" (Game wizard) matches `ui.game.gamesetupwizard.playerSPersona`. Verified.
  5. "Create your persona" in picker and Chat Settings (lines 33, 35) matches `ui.characters.onboarding.modalTitle`. Verified.
  6. Quick Persona Switcher (line 39): `ui.chat.quickpersonaswitcher.quickPersonaSwitcher`. Verified. On mobile the menu is "Quick Switcher" (`ui.chat.quickswitchermobile.quickSwitcher`), not named in the guide; the guide says "Quick Switcher chevron" (line 47). Verified.
  7. "Ungrouped" (line 45) matches `ui.chat.personapicker.ungrouped`. Verified.
  8. "The former global active persona setting has been removed" (line 11): not verified.
- **Missing steps:** Line 35 mentions "Characters" showing an onboarding marker; say where to click. Mobile path is OK.
- **Duplication:** The persona-per-chat rules overlap personas.md's "{{user}} macro" (personas 11-15). Keep the macro text in personas.md only.
- **Length:** cut ~5%.
- **Ban-list:** "This guide explains" opener only.
- **Links:** all resolve.
- **Priority:** LOW (one wrong placeholder).
- **Terms:** "persona" (UI "Personas", "Your Persona", "Player's Persona" in Game). Good. "Quick Persona Switcher" (desktop) vs "Quick Switcher" (mobile) — docs should name both.

## characters/bot-browser.md (205 lines, ~16.4 KB)

- **Main tasks:** find a card; choose a source; search and filter; handle NSFW; log in to Pygmalion; review and import; download as PNG. Findable: yes for "import"; the source table and NSFW list are long.
- **Wrong or stale facts:**
  1. **Embedded lorebook prompt is wrong.** Lines 177-179 say importing shows "a small confirm box from your web browser" with **OK** / **Cancel**. Code: an in-app panel titled **Embedded lorebook found** appears with **Import Lorebook** and **No Import** (and **Back**) (`packages/client/src/components/bot-browser/BotBrowserView.tsx` ~3090-3130; keys `ui.modals.importcharactermodal.embeddedLorebookFound`, `...importLorebook`, `...noImport`, `ui.botBrowser.importDialog.back`). The panel is shown only if the card has lorebook entries (`chooseImportTarget`, line ~2204). Rewrite.
  2. **Import flow is missing a step.** Clicking **Import** on a card opens an **Import Card** dialog (line 2990, `ui.botBrowser.importDialog.importCard`) with **Where should this card live?**: **Import as Character** or **Import as Persona** (`BotBrowserView.tsx:3022-3061`; keys `ui.botBrowser.importDialog.chooseDestination*`, `importAsCharacter`, `importAsPersona`). Lines 157-163 (steps 1-5) do not include this. Lines 159-163 also say "Choose an Imported tags option, then Import" — the tags panel is in the detail view (verified below), but the destination step comes after Import.
  3. **Button after Import** reads **Importing...** (line 161, `ui.botBrowser.detailview.importing`). Verified.
  4. **Sources and menu order** (line 26): ChubAI, JannyAI, CharacterTavern, Pygmalion, Wyvern, DataCat, PlotLight, PlotLight Personas: `BotBrowserView.tsx:1585-1594` (ALL_PROVIDERS). Verified. CharacterTavern "Unavailable" badge: `ui.botBrowser.providerUnavailable.badge` (en.json:8355). Verified.
  5. **Default sorts** (table, lines 65-72): ChubAI "Most Downloaded" (`BotBrowserView.tsx:515-518`, label "👑 Most Downloaded"), JannyAI "Newest" (645), Pygmalion "Downloads" (1051), Wyvern "Popular" (1159), DataCat "Relevance" (1312), PlotLight "Popular" (1507-1510). Verified.
  6. **CharacterTavern notice** (lines 34-42): "Open CharacterTavern" (`ui.botBrowser.providerUnavailable.openSite` "Open {{value1}}"), "Import Character" button (`BotBrowserView.tsx` ~3430). Verified. Notice text (en.json:8356) says "download cards from character-tavern.com and import the file": matches guide.
  7. "View on Chub" (line 30): link text is "View on" + siteName; ChubAI siteName is "Chub" (`BotBrowserView.tsx:514`, `:3612`). Verified.
  8. **Show Low Quality** toggle (line 104) and **Min Tokens** / **Max Output Tokens**: `BotBrowserView.tsx:657` (JannyAI extra toggle, hard-coded English), en.json has Min Tokens and Max Output Tokens (`ui.botBrowser.botbrowserview.minTokens`, `ui.agents.agenteditor.maxOutputTokens`). Verified. "Sort Direction" exists (`ui.botBrowser.botbrowserview.sortDirection`). Verified.
  9. **Tags panel**: "Search tags..." (line 84) matches `ui.botBrowser.botbrowserview.searchTags` = "Search tags" (no ellipsis). Minor. "Tags will appear after searching" (line 89). Verified. "Clear" (line 87) exists as a generic label; not verified in tag panel.
  10. **Search placeholder** (line 61): "Search characters..." — en.json `search.panels.characters` = "Search characters" (no ellipsis). Minor.
  11. **"Browsing PlotLight"** header (line 76): `ui.botBrowser.botbrowserview.browsingValue1` = "Browsing {{value1}}". Verified.
  12. **NSFW texts** (lines 112-116): "DataCat is NSFW only" dialog, "Continue to DataCat", "Don't continue to DataCat" (en.json:DataCat keys), "NSFW depends on your account settings" (`ui.botBrowser.botbrowserview.nsfwDependsOnYourAccountSettings`), "Use \"🔞 Popular NSFW\" sort..." (`ui.botBrowser.botbrowserview.usePopularNsfwSortForNsfwContent`). Verified.
  13. **PlotLight texts** (lines 55-57): "PlotLight is busy" + seconds (`ui.botBrowser.plotlight.busy_one/_other`), "PlotLight doesn't offer this for download." (`ui.botBrowser.plotlight.unavailable`). Verified.
  14. **Pygmalion login** (lines 126-133): "Pygmalion Authentication", "Auth Token", "Save & Connect", the `authn` localStorage key (shown in the login help `BotBrowserView.tsx:3349`). Verified. "Log Out" (line 137). Verified. In-memory token, cleared on restart: `server/src/routes/bot-browser-pygmalion.routes.ts:23` ("In-memory token store (persists until server restart)"). Verified.
  15. **"Browsing"/Pygmalion "Log In"** button (line 124): `ui.botBrowser.botbrowserview.logIn` = "Log In". Verified.
  16. **Detail view** (lines 145-151): "Back to results" (`ui.botBrowser.detailview.backToResults`), "Creator's Notes" (`ui.botBrowser.detailview.creatorSNotes`), "Has embedded lorebook" (`...hasEmbeddedLorebook`, amber badge). Verified. "up to twenty tag chips": `BotBrowserView.tsx:3751` `slice(0, 20)`. Verified.
  17. **Download as PNG** (line 155): "Download as PNG", "Building PNG..." (`ui.botBrowser.detailview.downloadAsPng`, `buildingPng`). Verified.
  18. Card Browser entry points (lines 15-16): Download button tooltip "Download character cards" (`ui.panels.resourceLibraryLauncher.downloadCards`). Verified.
  19. Old names: "Bot Browser" (line 3) — no UI string; "Browser" is "Card browser" in commandCenter.system.cardBrowser. Fine as history.
- **Missing steps:** The destination step (2 above). "What you see" after Import: the guide says "You should see a message", but the success text is not named. Name it or drop the claim. Pygmalion: no step for "NSFW" after login beyond the checkbox text.
- **Duplication:** "Cards with a built-in lorebook" in import-export.md (owner for import behavior) overlaps lines 177-179 here. Keep the link; drop the duplicate. Import tags table (167-175) duplicates the import dialog options in import-export.md (lines 30-36). Owner: import-export.md; link from here.
- **Length:** cut ~25%: the per-source NSFW list (108-118) and the 8-row sort table could become one table (Source | Default sort | NSFW | Login). Pygmalion login steps (120-141) can move to a "Log in to Pygmalion" reference.
- **Ban-list:** "very" (91 "very large"), "actually" (165 "To actually chat"). Opener: "This guide explains".
- **Links:** all resolve, anchors `#plotlight`, `#charactertavern` resolve.
- **Priority:** HIGH (embedded lorebook flow is wrong; destination step missing; affects a common task: importing).
- **Terms:** "Card Browser" (UI "Card browser" in menus; "Card Browser" title). Guide consistent. "ChubAI" (menu) vs "Chub" (link text) — guide explains; keep. "Import" vs "Download as PNG" fine. "Imported tags" (UI) vs "tag import mode" (guide, line 32 of import-export). "Creator's Notes" (card browser detail) vs "Creator Notes" (editor metadata tab, en.json:`ui.characters.metadatatab.creatorNotes`). Pick one and note the difference. "Alt Greetings" (line 101) is not a UI label; the detail view uses **Alternate Greetings** (`ui.botBrowser.detailview` section list). Fix.

## characters/sprites.md (193 lines, ~15.4 KB)

- **Main tasks:** upload sprites; name them by file name; generate with AI; clean backgrounds; export; choose how sprites show in a chat. Findable: yes for upload; the chat-display section is at line 150, far from the editor.
- **Wrong or stale facts:**
  1. Upload labels: **Add sprites**, **Upload images**, **Import folder** (lines 33, 43), **Add Sprite**, **Upload Folder** (persona). Verified (en.json `sprites.library.addSprites`, `uploadImages`, `importFolder`; `ui.personas.personaspritestab.uploadFolder`).
  2. **Generate Sprite** / **Generate Sprites** / **Expressions (Portrait)** / **Reference Images** / **Appearance Description** / **Transparent sprite background** / **Expression Count** / **Pose Count** / **Match existing expression sprites** / **Generate animated portraits**: verified (`ui.ui.spritegenerationmodal.*`, en.json).
  3. **Clean Backgrounds**, **Cleanup strength**, **Undo Cleanup**: verified. Cleanup default 35: `components/ui/SpriteGenerationModal.tsx:621` `useState(35)`. Verified. Range 0-100 and "Soft to Aggressive" labels not verified.
  4. **"Last cleanup has a restore point"** (line 126): `ui.characters.spritestab.lastCleanupHasARestorePoint` used in `CharacterEditor.tsx:6066`. Verified.
  5. Clips category label, **Facial Expressions**, **Full-body**: `sprites.library.expressions` = "Facial Expressions", `sprites.library.fullBody` = "Full-body". Verified. Note: the Sprite Source toggle uses plain "Expressions" (`ExpressionSpriteSettings.tsx`); docs use the two names in different places. Fix terms.
  6. **Expression Engine** (lines 156-166): the guide says to download it from **Agents → Agent Organizer**. The agent is in the Professor Mari knowledge list (`official-agent-knowledge.ts:70`, category "tracker"); whether it is a built-in or downloadable package was not confirmed. Could not verify. Check against built-in-agents.md before merging.
  7. **Sprite Source** default "both on" (line 166), **Expression Avatars** "off by default" (line 167): `ui.store.ts` / `ChatSettingsDrawer.tsx:1688-1700`; `expressionAvatarsEnabled` is a chat flag (`shared/src/types/chat.ts:549`). Default not verified.
  8. **Sprite Layout** (line 175), **Arrange** / **Done** / **Reset** / **Default Side** (Left default) / sizes 5-200% and opacity 15-100% (lines 179-180): **Sprite Layout** (`ui.chat.expressionsetupfields.spriteLayout`), **Arrange** (`ui.chat.chatsettingsdrawer.arrange`), **Done** (`lorebook.editor.batch.done`), **Reset** (`ui.characters.charactercliptrimmodal.reset`), **Default Side** (`ui.chat.chatsettingsdrawer.defaultSide`), Left/Right present. Verified. Size/opacity limits: `ChatSettingsDrawer.tsx:931-935` clamp helper; actual min/max constants not found. Could not verify 5-200 and 15-100.
  9. **New folder** creates "unnamed" (line 69): `components/panels/CharactersPanel.tsx:92` returns "unnamed". Verified.
  10. **Rename up to 160 characters** (line 61): not verified in code.
  11. **Select all sprites** (line 73): `sprites.library.selectAllSprites`. Verified. **Delete All Expressions / Full-Body** (line 65): composed label (see personas.md 7). OK.
  12. **Export** options **Expressions only**, **Full-body only**, **All sprites** (lines 136-138): en.json `ui.characters.spritestab.expressionsOnly`, `fullBodyOnly`, `allSprites`. Verified. `catalog.json` in the zip (line 140): not verified.
  13. **Character Sheet** / **Manage** / **Use as reference image** (line 79): `ui.characters.charactersheet.*` and `...useAsReference`. Verified.
  14. "Upload PNG, JPEG, GIF, WebP, AVIF, and passive SVG" (line 28): not verified.
  15. Background cleanup works on PNG, JPG, JPEG, WEBP, AVIF; not GIF or SVG (line 128): not verified.
- **Missing steps:** Chat display (line 150+) starts with "This happens in the chat settings" — add the path: Chat Settings → Agents → Expression Engine card. Clips section (182-184) is a pointer only (OK).
- **Duplication:** persona sprite details duplicate personas.md (125-131). Owner: this guide. Upload and folder detail is also in personas.md. The Video call Clips section is owned by conversation/calls.md (linked, OK).
- **Length:** cut ~25%. Move the folder/selection section (67-75), the Folder-aware integrations / API section (142-148, developer detail: `GET /api/sprites/...`) to a developer reference, and the file-name variant rules (50-52) to a table.
- **Ban-list:** "actually" (130, "actually be"), openers "This guide shows you" (3) and "Sprites only appear" fine.
- **Links:** all resolve.
- **Priority:** MEDIUM (Expression Engine source unverified; several defaults unverified; long).
- **Terms:** "Facial Expressions" (UI category) vs "Expressions" (Sprite Source toggle, persona/character tab label) vs "expression sprite" (docs). "Full-body" (UI) consistent. "Sprite" vs "expression" vs "pose". "Arrange mode" (docs) vs **Arrange** (UI button).

## characters/colors-and-stats.md (114 lines, ~10 KB)

- **Main tasks:** set name, dialogue, and message-box colors; set stats; set a Game Mode icon. Findable: yes.
- **Wrong or stale facts:** none found in these checks.
  1. Colors tab labels: **Extract Colors from Avatar**, **Upload an avatar first**, **Name Display Color**, **Dialogue Highlight Color**, **Message Box Color**: en.json `ui.characters.colorstab.*` and `ui.personas.personacolorstab.*`. Verified.
  2. **Roleplay Messages Background Opacity** (line 29): en.json `ui.panels.appearancesettings.roleplayMessagesBackgroundOpacity`. Verified. Settings path not checked.
  3. **Enable RPG Stats** (character, line 49): `ui.characters.statstab.enableRpgStats`. Verified. **Enable RPG Attributes** (persona): `ui.personas.personastatstab.enableRpgAttributes`. Verified. **Enable Persona Stats**: `ui.personas.personastatstab.enablePersonaStats`. Verified.
  4. **Pools** / **Attributes** / **Status Bars** / **Persona Status Bars**: en.json `ui.characters.statstab.pools`, `...attributes`, `ui.personas.personastatstab.statusBars`, `...personaStatusBars`. Verified.
  5. **Add a sheet** / **Add from catalog** / **Set by the ruleset** / **Update selected** / **Remove this sheet**: `ui.rulesets.sheets.addSheet`, `game.ruleset.catalog.addFrom`, `ui.rulesets.sheet.scaledHint`, `ui.rulesets.sheet.refreshApply`, `ui.rulesets.sheets.removeSheet`. Verified.
  6. **Game Mode Icon** modes "Custom image" / "Avatar" / "Initials": `ui.characters.combatIcon.title`, `...modeImage` = "Custom image". Verified.
  7. Starter Satiety/Energy/Hygiene/Mood: `shared/src/utils/authored-card.ts:105-110`. Verified. Character starter HP and MP at 100 (line 51): `shared/src/utils/rpg-stats.ts:4` (HP). MP not checked.
  8. 64 KB sheet limit (line 89): not verified.
  9. "Character Tracker updates Pools such as HP" (line 99): not verified in agent code.
- **Missing steps:** Colors: "a live Preview card" (line 13, 15): `ui.characters.colorstab` Preview key not checked. Low.
- **Duplication:** colors-and-stats is the owner. personas.md repeats Colors (137-146) and Stats (148-159). The Game Mode Icon block is also in personas.md (155). Keep the owner text here; link from personas.
- **Length:** cut ~20%: the Ruleset sheets section (72-93, ~22 lines) is a separate feature; move it to the Game Mode rulesets reference.
- **Ban-list:** "This guide covers" opener (3); "HUD means heads-up display" (107) is fine.
- **Links:** all resolve.
- **Priority:** MEDIUM (length, ruleset section; facts mostly verified).
- **Terms:** "RPG Stats" (character toggle) vs "RPG Attributes" (persona toggle, same content). Pick one term for both; the UI uses both. "Pools" (UI) vs "pools" (docs) fine. "Stats" (tab) vs "stats" (generic).

## characters/galleries.md (114 lines, ~9.3 KB)

- **Main tasks:** add images/videos to the character gallery; tag emoji or sticker; reuse images in greetings; save web images. Findable: yes.
- **Wrong or stale facts:** none found in these checks.
  1. **Character Gallery** / **Persona Gallery** titles: `ui.characters.charactergallerytab.characterGallery`, `ui.personas.personagallerytab.personaGallery`. Verified.
  2. **Upload Character Images** / **Upload Persona Images** / **Upload Character Videos** / **Upload Persona Videos**: verified (en.json).
  3. **Copy image reference** (line 73): `ui.characters.charactergallerytab.copyImageReference`. Verified.
  4. **Tag as emoji or sticker** tooltip (line 48): `ui.ui.customemojitagbutton.tagAsEmojiOrSticker`. Verified.
  5. Menu items **Make emoji**, **Make sticker**, **Rename**, **Switch to sticker/emoji**, **Remove emoji/sticker**, and dialog titles **Custom Emoji** / **Custom Sticker** (lines 49-64): found in `components/ui/CustomEmojiTagButton.tsx:64, 103-124` as hard-coded English strings, not en.json keys. Labels are accurate; see the cross-cutting localization note.
  6. **Size limits** 256x256 emoji and 512x512 sticker (lines 55, 62): `shared/src/schemas/custom-emoji.schema.ts:9` (256) and `custom-sticker.schema.ts:9` (512). Verified.
  7. **Name rule** 1-32 lowercase letters, numbers, underscores (line 53): `packages/server/src/routes/characters.routes.ts:399` ("customName must use 1-32 lowercase letters, numbers, or underscores"). Verified. The auto-convert ("Big Grin" → big_grin) is not verified.
  8. **Video types** MP4, WebM, MOV (line 39): `CharacterEditor.tsx:4543` `accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"`. Verified.
  9. **Save images locally** limits 10 MB and 40 megapixels; PNG, JPEG, GIF, WebP (line 105): `server/src/services/image/greeting-image-bake.ts:9-10, 14`. Verified.
  10. **Restore web links** (line 107): `ui.characters.dialoguetab.restoreGreetingImages`. Verified.
  11. **Images accepted** "JPG, PNG, GIF, WebP, and AVIF" (line 30): not verified.
- **Missing steps:** No "what you see" after tagging (line 59 says overlay button shows the name; good). Step 5 "In the Custom Emoji or Custom Sticker dialog, type a name" fine.
- **Duplication:** creating-and-editing lines 81-83 point here (good). The "Reuse" section is long for one guide; OK.
- **Length:** cut ~10%.
- **Ban-list:** "This guide covers" (3) opener only.
- **Links:** all resolve. (`card://self/...` line 76 is inside a code fence.)
- **Priority:** LOW.
- **Terms:** "Gallery" (character/persona) vs "chat gallery" (docs line 20) vs UI "Chat Gallery" section. "Custom emoji" / "sticker" (UI) consistent. "Scoped" (line 67) is jargon; say "only for this character".

## characters/import-export.md (91 lines, ~5.9 KB)

- **Main tasks:** import a card; choose tags and regex and lorebook options; export one or many. Findable: yes.
- **Wrong or stale facts:** none found.
  1. Import window title **Import Character** and drop text "Drop one or more files here or click to browse": `ui.modals.importcharactermodal.importCharacter`, `...dropOneOrMoreFilesHereOrClickTo`. Verified.
  2. Accepted file types .json, .png, .marinara, .charx (table, lines 11-16): `components/modals/ImportCharacterModal.tsx:503` `accept=".json,.png,.marinara,.charx"`. Verified.
  3. Tag options (lines 34-36) and defaults ("All tags"): `ImportCharacterModal.tsx:37-42`, default `useState<TagImportMode>("all")` at line 62. Verified (labels hard-coded English).
  4. Regex options (lines 42-43) and default "Character only": `ImportCharacterModal.tsx:47-49`. Verified. Global destination **Presets → Regexes** not checked.
  5. Embedded lorebook panel (lines 49-52): "Embedded lorebook found", "Import Lorebook", "No Import": `ImportCharacterModal` keys in en.json. Verified.
  6. Export window **Export Character** (line 60): `ui.characters.charactereditor.exportCharacter_cdcda78`. Verified.
  7. Export formats (lines 62-66): **Marinara Native**, **Compatible JSON**, **Compatible PNG Card**: `components/ui/ExportFormatDialog.tsx:51-54`. PNG is offered for characters only (`CharacterEditor.tsx:1381` passes `showPngOption`). The guide says all three are offered; that is true for characters only. Minor note.
  8. Bulk export zip **marinara-characters.zip** and **Select** / **Export**: `components/panels/CharactersPanel.tsx:724`. Verified.
  9. Onboarding kept by Marinara Native and PNG, dropped by Compatible JSON (line 70): not verified in export code. Could not verify.
  10. Settings → **Imports** tab for SillyTavern folder (line 85): not verified.
- **Missing steps:** Step 5 "Each file shows a green check with 'Imported'" — en.json `ui.modals.importcharactermodal` result strings not checked.
- **Duplication:** the lorebook and tags sections repeat in bot-browser.md (177-179, 167-175). This guide owns them. Link from bot-browser.
- **Length:** cut ~5%. The table is good.
- **Ban-list:** opener "This guide shows how" (3). Otherwise clean.
- **Links:** all resolve.
- **Priority:** LOW.
- **Terms:** "character card" (UI "character"). ".marinara" vs ".marinara.json" (line 16 says both: check the export file name, `marinara.json` vs `.marinara`). "Tag import mode" (line 32) is an internal term; the UI says "Imported card tags". Use the UI term.

## characters/interactive-onboarding.md (115 lines, ~10 KB)

- **Main tasks:** author onboarding; add persona and character questions; answer questions as a player; sharing. Findable: yes.
- **Wrong or stale facts:** none found in the checks below.
  1. **Interactive onboarding** switch (line 19) and **How onboarding works** (line 19): `ui.characters.onboarding.enable`, `...tutorialTitle`. Verified.
  2. **Persona Questions** / **Character Questions** tab sections (lines 27, 45): `ui.characters.onboarding.questions`, `...cardQuestions`. Verified. **Add Question** (line 29): `ui.characters.onboarding.addQuestion`. Verified.
  3. Field labels Variable Name, Question (shown to user), Multi-Select, Allow own answer, Help text for players, Write your own: verified (`ui.presets.variablecard.*`, `ui.characters.onboarding.*`).
  4. **Review persona** / **Create persona** / **Save answers** (lines 93-94): `ui.characters.onboarding.reviewPersona`, `...createPersona`, `...saveAnswers`. Verified.
  5. **Create your persona** title (line 89, 90) and **About you** (line 55, 92): `ui.characters.onboarding.modalTitle`, `ui.characters.onboarding.modalPersonaSection`. Verified.
  6. **Available variables** (line 73), **Rendered preview** (line 85): `ui.panels.promptoverrideseditorbody.availableVariables` and `...renderedPreview`. Verified.
  7. **Chat Variables** (line 101): `ui.chatSettings.chatvariablessection.chatVariables`. Verified.
  8. "Persona & Characters" step (line 89): `ChatSetupWizard.tsx` ROLEPLAY_STEPS title. Verified.
  9. **Quick Start** (line 96) is not in en.json (no exact key). Could not verify the label; check the Quick Start entry point.
  10. "up to 100 questions" (line 29), "keeps the first 100" (line 107): not verified.
  11. "Compatible JSON leaves it out" (line 107): not verified (see import-export 9).
- **Missing steps:** Step 3 "the questions window opens whenever a card has character questions" fine. "Click Next" (line 91): `Next` wizard button not checked.
- **Duplication:** Persona fields (lines 63-85) overlap creating-and-editing's Card tab; link instead. The Persona picker (lines 98-100) repeats choosing-your-persona (owner). Keep one line and a link.
- **Length:** cut ~15%: the "Three things an author should know" list is good; the sharing section (105-107) can be merged.
- **Ban-list:** "This guide explains" opener only.
- **Links:** all resolve, anchor `#character-questions` resolves.
- **Priority:** MEDIUM (length; unverified Quick Start label and limits).
- **Terms:** "onboarding" (UI "Interactive onboarding") vs "setup" vs "questions". "Persona template" (line 7) vs "persona" (UI). "Character question" vs "persona question" — both are UI-visible headings: keep. "Variable" (UI label "Variable Name") vs "question" — docs say both; define once.

## characters/library-organization.md (134 lines, ~8.1 KB)

- **Main tasks:** search, sort, folders, favorites, tags, bulk export and delete. Findable: yes.
- **Wrong or stale facts:** none found in these checks.
  1. Panel buttons **Download**, **Open Library** (`ui.panels.resourceLibraryLauncher.openLibrary`), **New** , **Import**, **Select**. Verified.
  2. **Search characters/tags** placeholder (line 23): `search.panels.charactersAndTags` = "Search characters/tags". Verified.
  3. **Load more** (line 19): `ui.characters.characterlibraryview.loadMoreValue1Loaded` / `chatInsights.search.loadMore`. Verified.
  4. Sort options (table, lines 47-54): **Manual order** (`dragDrop.manualOrder`), **A-Z**, **Z-A**, **Newest**, **Oldest**, **Favorites**. Verified via `CharactersPanel.tsx` sort select (lines ~915-925) and keys `ui.panels.backgroundpicker.aZ`/`zA`/`newest`/`oldest` (en.json:15155-15229) and `ui.panels.characterspanel.favorites` = "Favorites" (en.json:15259). Verified. Note: the UI option label is **Favorites**; guide's table says **Favorites** — correct.
  5. **Favs / Non-favs** filter buttons (line 84-88): `ui.panels.characterspanel.favs`, `...nonFavs`. Verified. "All" button label not checked.
  6. **New Folder** and **unnamed** (lines 64-65): `ui.panels.backgroundpicker.newFolder` and `CharactersPanel.tsx:92` returns "unnamed". Verified.
  7. Helper line "Drag and drop characters to folders, double-click or double-tap to rename" (line 70): en.json:`ui.panels.characterspanel.dragAndDropCharactersToFoldersDoubleClickOr`. Verified.
  8. **Remove from folder** (line 70): `ui.panels.characterspanel.removeFromFolder`. Verified.
  9. Folder delete message (line 76): `CharactersPanel.tsx:598-600` "Delete "{name}"? Its N characters will stay in the library and move out of the folder." Verified.
  10. Bulk Delete confirm "Delete N characters?" (line 118): `ui.panels.characterspanel.deleteCharacterValue..` `Delete {{value1}} character{{value2}}?`. Verified.
  11. Export zip **marinara-characters.zip** (line 117): `CharactersPanel.tsx:724`. Verified.
  12. **Tags (12)** button (line 98): `ui.layout.chatsidebar.tagsValue1` = "Tags ({{value1}})". Verified. **Clear** (line 102) and "Remove tag "name" from all characters?" (line 101): `ui.characters.metadatatab.removeTagValue1` exists. Clear not verified in this panel.
  13. **Add from Folder** (line 128): `ui.noodle.noodlehome.addFromFolder` = "Add from Folder". Verified.
  14. F2 rename: `CharactersPanel` uses F2 pattern (`ui.panels.backgroundpicker.doubleClickDoubleTapOrPressF2ToRename`). Verified.
- **Missing steps:** Step for "Select" mode → bulk actions bar: clear. "Drag selected into folder" (line 120) not tested.
- **Duplication:** Import/export bullets (lines 9-13 and 122) duplicate import-export.md (linked). Keep the link only. Persona library search (line 27) overlaps personas.md 28; keep in one.
- **Length:** cut ~10%. The tag exclusion examples (29-41) can be a short table.
- **Ban-list:** "easy" (82), "simply" (76) — "Marking a character as a favorite makes it easy to find later" (line ~78-82). Opener "This guide covers" (3).
- **Links:** all resolve.
- **Priority:** LOW.
- **Terms:** "Characters panel" (UI) vs "Character Library" (docs line 27 and the Open Library view). "Favorite" vs "Favs". "Folder" (UI "folder") vs "group" in Game and group-chat roster ("Add from Folder" uses folder). Keep "folder" everywhere.

---

## Word list candidates

UI term → synonyms seen in these docs → one-line plain explanation

| UI term (use this) | Synonyms in docs | Plain explanation |
| --- | --- | --- |
| **Commands** (under Chat Settings → Agents) | "Roleplay Commands" | Hidden commands characters can send, such as illustrations, whispers and interruptions. |
| **Push Story** | "story push", "Narrative Director push" | Button above the message box that steers the next reply once. |
| **Naturally** / **Randomly** (Push Story menu) | "Natural", "Natural mode", "Random Event" | The two choices for a Push Story. Pick one each time. |
| **Secret Plot** | "hidden arc", "hidden long-term arc" | A hidden long-term storyline the Narrative Director keeps updated. |
| **Tracker Panel** | "side panel", "tracker sidebar" | Large side panel that shows tracker cards. |
| **Trackers** (window) | "tracker window" | Floating window that holds the trackers when the Tracker Panel is off. |
| **Roleplay HUD** / HUD | "heads-up display", "stat display", "widgets" | The on-screen area that shows world state and trackers. |
| **State Editor** | "tracker editor", "state panel" | Window that shows every tracker value for the current turn so you can fix it. |
| **Agent activity** | "agent log", "activity" | Panel that shows what each agent did last turn. |
| **Expression Engine** | "expression agent", "sprite agent" | Agent that picks which sprite to show for the mood. |
| **Sprite Source** | "display mode" | Chooses which sprite types show: Expressions, Full-body, or both. |
| **Facial Expressions** (sprite category) | "expressions", "portraits" | The face-only sprite set for one character. |
| **Full-body** | "full-body sprites", "poses" | The whole-body sprite set. |
| **Clips** (sprite category) | "video clips" (also means chat video) | Looping videos used as a camera during calls. Separate feature. |
| **Card Browser** | "Bot Browser" (old), "Browser", "card browser" | Built-in search for public character cards. |
| **Import Character** | "import dialog", "import window" | Window that takes card files; import options live here. |
| **Persona** | "user persona", "player persona", "your identity" | Your own character card, used in chats. |
| **Your Persona** / **Player's Persona** | "persona field" | Persona field in the new-chat wizard (Game wizard uses "Player's Persona"). |
| **Quick Persona Switcher** (desktop) / **Quick Switcher** (mobile) | "persona switcher" | Avatar button near the message box to change persona. |
| **Persona Status Bars** | "Persona Stats", "status bars" | Persona need bars like Satiety and Energy. |
| **RPG Attributes** (persona) / **Enable RPG Stats** (character) | "RPG stats", "pools" | Pools and attributes like HP and STR. Same content, different toggle name. |
| **Add Alternative Field** | "alternative field", "alt field" | An extra version of a card field used only in chosen chats. |
| **Alternate Greetings** | "Alt Greetings" | Extra first messages a character can open with. Not the same as alternative fields. |
| **Creator Notes** (editor) / **Creator's Notes** (card browser) | "creator note" | Private notes about the card. Not sent to the AI. Use one spelling. |
| **Lorebook** | "world info", "lore" | Set of world facts the AI reads when keywords appear. |
| **Embedded lorebook** | "character book" | A lorebook stored inside a card file. |
| **Interactive onboarding** | "onboarding", "persona wizard", "questions" | Card questions that build a persona for the player. |
| **Persona Questions** / **Character Questions** | "onboarding questions" | Questions that fill a persona (saved to it) or answer for one chat (saved to the chat). |
| **Chat Settings** | "chat settings drawer", "settings panel" | Side panel for everything in one chat. |
| **Chat tools** | "tools menu" | Sections of Chat Settings or the three-dot menu on phones. |
| **Gallery** (character or persona) | "card gallery", "character images" | Images and videos attached to a character or persona. |
| **Chat gallery** | "scene art" | Images made in one chat. Not attached to the character. |
| **Custom emoji** / **Sticker** | "emoji tag", "gallery emoji" | Gallery image used as an inline emoji or a block sticker in Conversation mode. |
| **Whisper** | "secret", "aside" | Text shown only to one character and the narrator. |
| **Scene** | "side branch", "branch" | A short roleplay branched off a Conversation chat. |
| **Connection** | "provider", "API", "account" | The link to an AI service (Connections panel). Pick one; the UI says "connection". |
| **Card** / **character card** | "character file", "character" | The file that defines a character. Use "character card" once, then "character". |

## Could not verify (do not change without a check)

- `getting-started.md`: Author's Notes "main reference" owner guide (no chats/ guide checked).
- `getting-started.md`: Echo Chamber mobile and desktop behavior; Whisper "Reveal a secret" and "Hide from AI" behaviors; Smart order behavior.
- `hud-and-trackers.md`: State Editor "Reload" button text (line 152).
- `hud-and-trackers.md`: Roleplay "Clear Trackers" confirm text (uses `chat.trackers.clearConfirmation`, verified; button text verified).
- `narrative-director.md`: "Push Story disabled while a reply is generating" (line 28) — behavior checked only at the handler level (`ChatInput.tsx:874-875`).
- `creating-and-editing-characters.md`: "Character ID" label (line 53); "Advanced" tab label; version reset "0.0"; compare window fields; Professor Mari delete message wording.
- `personas.md`: Persona import accepted file types; "Persona Library" name; "RPG HP and MP" starter MP.
- `choosing-your-persona.md`: "former global active persona setting removed".
- `combat-encounters.md`: Roleplay combat result banner words (VICTORY, DEFEAT, FLED, INTERRUPTED); Person labels (First/Second/Third).
- `backgrounds.md`: Background agent off by default; Remove button next to Chat Background.
- `sprites.md`: Expression Engine built-in vs downloadable (Agents → Agent Organizer path); Expression Avatars and Sprite Source defaults; Sprite size 5–200% and opacity 15–100% limits; rename 160 characters; upload type list; background-cleanup type list; catalog.json in export zip.
- `galleries.md`: auto-convert "Big Grin" → big_grin; image upload type list.
- `import-export.md`: Compatible JSON dropping onboarding; Settings → Imports tab; ".marinara" vs ".marinara.json" extension.
- `interactive-onboarding.md`: "Quick Start" label; 100-question cap; Compatible JSON dropping onboarding.
- `colors-and-stats.md`: 64 KB ruleset-sheet cap; Character Tracker updates Pools (agent code not checked); Settings path for Roleplay Messages Background Opacity.
- `bot-browser.md`: Success message text after Import ("message that the character was imported"); "Clear" button in tag panel; JannyAI Cloudflare message text.

## Priority summary

| Guide | Priority | Why |
| --- | --- | --- |
| roleplay/narrative-director.md | HIGH | Wrong control location and default; wrong UI labels and tooltip quotes. |
| characters/bot-browser.md | HIGH | Embedded lorebook flow wrong; destination step missing from import. |
| roleplay/getting-started.md | HIGH | "Roleplay Commands" path wrong (6 places); missing Illustrator prerequisite; long. |
| characters/personas.md | HIGH (duplication) | Repeats card, sprites, import/export, colors and stats guides. |
| roleplay/hud-and-trackers.md | MEDIUM-HIGH | "Add field" label wrong; duplicated Agent activity; em dashes; long. |
| roleplay/backgrounds.md | MEDIUM | Invented progress note quote. |
| characters/sprites.md | MEDIUM | Unverified source for Expression Engine; defaults unverified; long. |
| characters/creating-and-editing-characters.md | MEDIUM | "Character ID" label unverified; long; owner of duplicated content. |
| roleplay/combat-encounters.md | MEDIUM | Banner words unverified; no troubleshooting. |
| characters/colors-and-stats.md | MEDIUM | Ruleset section long; facts mostly OK. |
| characters/interactive-onboarding.md | MEDIUM | Quick Start label and limits unverified; long-ish. |
| characters/choosing-your-persona.md | LOW | One wrong placeholder ("Search personas...", en: "Search personas"). |
| roleplay/scenes.md | LOW | Accurate; ban-list and "fork"/"clone" term. |
| characters/galleries.md | LOW | Accurate; hard-coded UI labels are a code issue. |
| characters/import-export.md | LOW | Accurate; "tag import mode" term. |
| characters/library-organization.md | LOW | Accurate; ban-list words. |

## Top wrong facts (for the lead)

1. narrative-director.md:32-33, 39, 41: Push Story mode is picked from the Push Story menu each time, not in Chat Settings; there is no default ("Natural is the default" is false). Labels are "Naturally"/"Randomly" (`ChatInput.tsx:874-890, 1943`; `ChatSettingsDrawer.tsx:9076`).
2. bot-browser.md:157-163, 177-179: Import opens an "Import Card" dialog with "Import as Character / Import as Persona" first, and an "Embedded lorebook found" panel with **Import Lorebook** / **No Import** (not a browser OK/Cancel box) (`BotBrowserView.tsx:2990-3061, ~3090-3130`).
3. getting-started.md:106, 112, 122, 142, 150, 156: section is **Commands**, not "Roleplay Commands" (`RoleplayCommandsSettings.tsx:40`, en.json:6280). Illustrations and Video clips also require the Illustrator agent (`RoleplayCommandsSettings.tsx:62-66`).
4. hud-and-trackers.md:147: State Editor button is **Add**, not **Add field** (`StateFieldsView.tsx:230`; en.json:16542).
5. backgrounds.md:32: quoted note "AI background generation is running. The new background will be applied when it finishes." does not exist in code or en.json. Also choosing-your-persona.md:23 "Search personas..." should be "Search personas" (`ChatSettingsDrawer.tsx:6093`; en.json:9823).

## Word list note

The most urgent fix is the single term for the Commands section and the Push Story modes; the docs use three names for each. The rest of the list above is for the rewrite pass.
