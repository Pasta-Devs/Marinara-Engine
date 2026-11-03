# Audit: docs/chats/*.md (12) and docs/conversation/*.md (7)

Scope: 19 guides, read-only checkout at `scratchpad/ro`. Evidence paths are relative to the repo root. `en.json` = `packages/client/src/localization/locales/en.json`. "Not in Engine" means the label or behavior is not in this repo, so it is package-owned or missing; those claims are marked unverified, not wrong.

Global results
- Links: 168 relative links across the 19 guides. All targets exist and all anchors match GitHub-style slugs (checked with a script). No broken links.
- Structure: each guide has one H1, no heading level skips, no blockquote `> **Note:**` callouts at all (style rule asks for them). `managing-chats.md:106` uses a plain `Note:` line instead.
- Ban-list hits (word level): chat-settings 7, group-chats 3, peek-prompt 3, sending-and-streaming 4, connected-chats 2, export-import 1, managing-chats 1, messages 1, calls 2, profiles 2, schedules 1, table-games 2, the rest 0. Most hits are `just` and `easy`. Examples: `chat-settings.md:12` "starts just left of the panel"; `group-chats.md:7` "simply becomes a group chat"; `connected-chats.md:19` "easy to confuse"; `export-import.md:10` "It is easy to read"; `peek-prompt.md:79` "A very high Temperature"; `calls.md:208` "The character just shows".
- Em dashes: 0 in these guides.

Cross-guide terminology (the same thing, several names)
- Local model: UI says **Built-in model** (`en.json` `connections.switcher.localModel`, line 2604). Guides say "Local Model" (`docs/conversation/calls.md:67`, `calls.md:255`, and the page `docs/connections/local-model.md`). "Local Model" has 0 hits in en.json.
- Selfie connection: UI says **Selfie model** (`en.json` `ui.chat.chatsettingsdrawer.selfieConnection`, line 9828). `selfies.md` says **Selfie Connection** throughout.
- Image connection vs image provider vs selfie connection: three names for the image service (`selfies.md:38`, `getting-started.md:108`).
- Group modes: Roleplay UI is **Merged (Narrator)** / **Individual** (`en.json` 9724, 9697). Conversation UI is **Grouped** / **Individual** (`en.json` 9678). `group-chats.md:101` describes Conversation as "acts like Merged mode" without the UI name.
- Presence vs schedule vs command words for one status: presence pill shows **Idle**, **Do Not Disturb** (ChatSidebar.tsx:2294-2300); schedule editor shows **Away**, **Busy**, **Online**, **Offline** (CharacterScheduleEditorModal.tsx:72-73); `/status` takes `idle`, `dnd`. `schedules.md` maps idle=Away and dnd=Busy, which is correct, but `getting-started.md` and `schedules.md` both define presence (duplicate).
- Profile: "settings profile" (Chat Settings dropdown, `en.json` "Custom settings profile") vs "Conversation Mode Profiles" (Convo Display Name, About Me; `conversation/profiles.md` title). Same word, two features.
- Connection / account / provider: UI uses **Connection** (Chat Settings section), **Connections** (tab), **Add account** (window title, `en.json` 1860). Guides use all four. Pick "connection" in prose and name the window once.
- Calls setup path: `calls.md:82` says Connections > Speech to Text; `HomeFaq.tsx:524-527` says Connections > Built-in model and Chat Settings > Commands > Calls. `calls.md:96-114` says Agents > Calls.
- Voice option: UI is **Voice option** with **One voice for all** and **Selected per character or persona** (`en.json` 15827, 15775, 15805). Guide says "Voice Option" with "One voice for all characters" and "Selected per character".
- First frame: UI says "New selfie, or the avatar if no selfie **provider**" (`en.json` 9895). Guide says "...if no selfie **connection**".

---

## chats/branches.md
- Task: branch from a message; switch, rename, delete, export, import. Findable: yes (headings match UI names).
- Verified OK: "Branch from here" (`en.json` 9382); Branch graph (`en.json` 994); Rename Branch dialog and "Set a display name for this chat branch." (`en.json` 9264-9266); "Delete this branch? Messages will be lost." (9259); Delete All Branches (9255); "Imported N messages as a new branch" (716-717); "New Branch" default name (`packages/server/src/routes/chats.routes.ts:5777`); export buttons Text, Markdown, JSONL, Story (`packages/client/src/components/chat/ChatBranchesPanel.tsx:194-232`).
- Wrong/stale: none found.
- Missing: the **Export a range** button and a **Stats** button in the same section (`ChatBranchesPanel.tsx:237-251`, `en.json` 910-911). Undocumented anywhere in docs. Also no "what you see" after clicking Import (the file picker).
- Too much detail: lineage and summary-carry-over rules (lines 13, 31-33) are for maintainers. Move to a reference note.
- Duplication: export formats repeated in `export-import.md` (lines 5-16, 20-29); the delete-branch dialog repeated in `managing-chats.md:60-67`. Owner for export formats: `export-import.md`. Owner for delete dialog: `branches.md`.
- Length: cut about 20%.
- Priority: medium (missing Export a range).

## chats/chat-settings.md
- Task: find and use Chat Settings; this is the hub. Findable: yes. Too many topics in one page.
- Verified OK: widget style options Default / Dottore / Prof. Mari (`SettingsPanel.tsx:4034-4046`, `en.json` 6629-6636); Apply preset font/shape/colors (`en.json` 6596-6600); Chat Name label; Connection and Follow Main, Shuffle (`en.json` "Follow Main", "Shuffle"); Chat Variables name rule `^[A-Za-z_]\w{0,63}$` (`packages/shared/src/utils/chat-variables.ts:14`) and the 21-character reserved-ID rule (`packages/shared/src/utils/macro-engine.ts:182`); "Chat Summary", "Active Context", "Author's Notes", "Gallery", "Search messages" labels present.
- Wrong/stale:
  - Chat Variable name length limit is 64 characters (`chat-variables.ts:14`). Guide gives no limit.
  - "Chat Summary, under Lorebooks" and "Search messages ... not in Game chats": not verified.
  - Button size range "32 to 96" not verified. The "Hide these tips for this chat" label is verified (`en.json`, key `chat.help.*` area; text matches).
- Missing: a "what you see" line for the first-time intro video and for Reset View confirmation text.
- Duplication: Settings profile list (lines 133-154) repeats `settings-profiles.md:45-70`. Favorite layout (lines 98-122) repeats `settings-profiles.md:112-122`. Chat Branches tools (172-182) repeats `branches.md`. Owner for profiles: `settings-profiles.md`. Owner for favorite layout: this file.
- Length: 22 KB. Cut about 40%: move window mechanics (pin, lock, resize, phone Chat tools menu, control windows) to one reference section at the end; cut the profile list to a link.
- Priority: medium (length and duplication; no confirmed wrong fact in the claims checked).

## chats/connected-chats.md
- Task: link a Conversation to a Roleplay or Game. Findable: yes.
- Wrong/stale:
  - The guide says **Cross-Chat Awareness** is in its own section (lines 21-23). In code it is a toggle inside the **Connected Chats** section (`packages/client/src/components/chat/ChatSettingsDrawer.tsx:7982-7995`).
  - The quoted help text "Characters remember and reference conversations from other chats they're in. Pulls recent messages from sibling chats..." does not exist. The toggle description is "Characters know what happens in their other chats" (`en.json` 9570). The section help is "Choose what this chat knows about your other chats, or link it to a roleplay or game..." (`en.json` 9601).
  - Verified OK: Link to Roleplay or Game (`en.json` 9711); Disconnect (tooltip); Link to Conversation from Game; `<influence>`, `<note>` tags (`packages/server/src/services/conversation/character-commands.ts:26-27, 568-569`); Discord webhook, Noodle, Allow character DMs labels present. `<ooc>` tag not checked.
- Missing: what happens when Cross-Chat Awareness is off and a link exists (not stated).
- Duplication: "Connection" section overlaps `chat-settings.md`.
- Length: cut about 15%.
- Priority: medium (wrong quote and section placement).

## chats/export-import.md
- Task: export one or many chats; import a JSONL file. Findable: yes.
- Verified OK: export buttons (`ChatBranchesPanel.tsx:194-232`); bulk export is JSONL in a ZIP (`ChatSidebar.tsx:974-980`); import accepts `.jsonl` only (`ChatSidebar.tsx:1598`); "Imported N messages" (`ChatSidebar.tsx:832`, `en.json` 716-717); "Include reasoning in exports" default off (`packages/client/src/stores/ui.store.ts:2350`), in Advanced > Message Tools (`SettingsPanel.tsx:7930`); "Story" label (`en.json` 1316).
- Missing: the **Include private notes in exports** toggle (`SettingsPanel.tsx:7938`, `en.json` 6677-6678; default `ui.store.ts`, off). It is not documented, though it matters for sharing transcripts. Also **Export a range** (see branches.md).
- Wrong/stale: "Import a chat as a new branch": the button is in the Chat Branches section and is labelled **Import**; correct.
- Duplication: export formats duplicated in `branches.md`. Owner: this file.
- Length: cut about 10%.
- Priority: low (one missing toggle).

## chats/group-chats.md
- Task: create a group chat; add, remove, turn off members; set who speaks. Findable: yes for Roleplay; no for Conversation (the Conversation section is under a different heading).
- Wrong/stale (high):
  - "Conversation mode ... does not show the Group Chat section. Its controls live in the Autonomous Messaging section" (lines 149-151). Wrong. Conversation shows a **Group Chat** section with **Grouped / Individual** and, in Individual, **Response Order** Sequential / Smart / Manual (`ChatSettingsDrawer.tsx:7108-7116`, `7145`, `7237`; `en.json` 9678, 9788, 9832, 9837, 9719).
  - **Reply When Mentioned** does not exist in the UI (lines 155-166). No en.json key, no code match for "Reply When" (`grep` over client/src and shared/src: none). The behavior it describes is covered by Individual mode plus Manual response order.
  - "Trigger Response" picker: verified (`en.json` 9378). Desktop/mobile placement not verified.
  - Verified OK, Roleplay: default Merged (Narrator) (`packages/shared/src/types/chat.ts:35-37`); Automate active characters options Off / Decision model / Character Tracker (`en.json` 9533-9544); Add Turn To Prompt default on (`ChatSettingsDrawer.tsx`, `groupTurnPromptEnabled !== false`); Color Dialogues label (`en.json` 9589); Scenario Override and "Group Scenario Override" labels; Name Prefix History (`en.json`); Character Exchanges (`en.json` 9564, `ChatSettingsDrawer.tsx:7447-7456`) and it sits in Autonomous Messaging, which the guide says correctly.
- Missing: the Conversation Individual warning toast about token use (`ChatSettingsDrawer.tsx:~7150`, `en.json` "Individual replies can use many tokens").
- Duplication: Conversation pacing overlaps `schedules.md:173`. Owner: `schedules.md` for check-in pacing; this file for turn order.
- Length: 16 KB. Cut about 25%: split Roleplay and Conversation into two sections with the same shape; move the turn-handling table up.
- Priority: high (wrong structure for Conversation; a named toggle does not exist).

## chats/guided-and-impersonate.md
- Task: steer a reply (/guided); write your reply with Impersonate; set up Quick replies. Findable: yes.
- Wrong/stale (high):
  - "Quick replies: Settings > Advanced > Message Tools" (lines 121-125). Wrong. The toggle is in **Settings > General > Input & Editing** (`packages/client/src/components/panels/SettingsPanel.tsx:2557`, inside the section that starts at 2499; `en.json` 6942 "Quick replies"). Default off (`ui.store.ts`, `showQuickRepliesMenu: false`).
  - Verified OK: /guided aliases /narrator /narrate /nar (`packages/client/src/lib/slash-commands.ts:807-808`); "respond as" / "reply as" / "respond for" (`slash-commands.ts:204`); /impersonate alias /imp and /impersonate_prompt alias /imp_prompt (`slash-commands.ts:1167-1189`); "Guide swipes/regens with chat input" (Advanced > Message Tools, `SettingsPanel.tsx:7923`, default off); "Keep guidance after regenerating" in Input & Editing (`SettingsPanel.tsx:2544`, default on); "Impersonate is not available in Conversation mode." (`en.json` 9972); Stored guidance labels (`en.json` 9413, 11220); Regenerate (guided) (`en.json` 9400).
- Missing: what Impersonate does with an empty box (not verified).
- Duplication: Stored guidance section (lines 44-57) repeats `peek-prompt.md:58-70`. Owner: this file. Slash alias list repeats `slash-commands.md`.
- Length: cut about 15%.
- Priority: high (wrong path blocks a common task: turning on Quick replies).

## chats/managing-chats.md
- Task: find, create, import, rename, delete, folder, search, multi-select chats. Findable: yes.
- Verified OK: mode tabs CONVO / RP / GM; "New Conversation" / "New Roleplay" / "New Game" (`en.json` 5958-5960); search placeholders (`navigation.chatSidebar.search.*`); "Delete Chat", "Delete Chats", "Delete This Branch Only" (`en.json` 13172-13174); "Delete this chat?" (13175); "Delete Folder" (`ChatSidebar.tsx:875`); "unnamed" folder names (`ChatSidebar.tsx:197-200`); "New Folder" (`en.json` 15200); "Select chats" (`ChatSidebar.tsx:1630`); "Sort chats" (`ChatSidebar.tsx:1667`); page size 100 with Load more (`ChatSidebar.tsx:109`); Import tooltip "Import SillyTavern or Marinara chat JSONL" (`ChatSidebar.tsx:1618`); "Confirm before deleting" default on, General tab (`en.json` 6640; `ui.store.ts`).
- Wrong/stale: none found.
- Missing: the Add account / Connect / Done steps (lines 27-29) were not verified; "Add account" title is verified (`en.json` 1860).
- Plain `Note:` line at 106 (style). Ban-list: "just removes" (line 64).
- Duplication: branch delete dialog (lines 60-67) repeats `branches.md`; owner `branches.md`.
- Length: cut about 15%.
- Priority: low.

## chats/messages.md
- Task: edit, delete, swipe, regenerate, hide from AI; message display toggles. Findable: yes.
- Wrong/stale:
  - Delete dialog title: guide says **How to proceed?** (line 45). Code title is **Delete message** (`packages/client/src/components/chat/ChatCommonOverlays.tsx:94`, `en.json` `chat.delete.dialog.title`).
  - Delete dialog options: guide lists 4. Code also has **Delete all other swipes** (`ChatCommonOverlays.tsx:25-29, 117`, `en.json` "Delete all other swipes"), shown when `canDeleteOtherSwipes`.
  - Save tooltip: guide says **Save (Cmd+Enter)** (line 35). en.json says **Save (Cmd/Ctrl+Enter)** (`en.json` 10163, key `ui.chat.edittextarea.saveCmdEnter`).
  - Verified OK: Up Arrow edits last message and Double-click edits messages, both default on (`ui.store.ts:2382-2383`), in General > Input & Editing (`SettingsPanel.tsx:2583, 2590`); "Show message numbers", "Show token usage on messages", "Show model name on messages" in Advanced > Message Tools (`SettingsPanel.tsx:7895-7909`); "Show older messages not sent" note label (`en.json` 6754); Peek prompt only on the newest AI message (`ChatMessage.tsx:4470`); "Cannot delete the last remaining swipe" (`packages/server/src/routes/chats.routes.ts:4734`); "Hidden from AI" label (`en.json` 9981).
- Missing: "Delete more" behavior is described but the multi-select bar labels ("Delete selected", "Select all messages above") are not.
- Duplication: `/hide` and `/unhide` (lines 82-92) repeat `slash-commands.md:53-62`. `/continue` (72-80) overlaps `sending-and-streaming.md:113-115`. Owners: `slash-commands.md` for command syntax; this file for button behavior.
- Length: cut about 15%.
- Priority: medium (wrong dialog title and missing option).

## chats/peek-prompt.md
- Task: see the exact prompt for a reply; debug. Findable: yes (title matches the UI name "Peek prompt").
- Verified OK: "Assembled Prompt" window title (`PeekPromptModal.tsx:82-85` for badges "Exact Text Model Request", "Live Preview", "Raw Messages", "Prompt Preview"); typed shortcut `{{prompt}}`, `{{prompt_preview}}`, `{{preview_prompt}}` (`packages/client/src/lib/chat-macros.ts:268`); Decision diagnostics labels (`en.json` decisionDebug.* 2731-2752; "Test decisions", "Preview inputs", "Show original prompt", "Show tested prompt", "Prepared request bodies (N)", "Requests sent and results (N)"); "Advanced Memory activity" (`en.json`).
- Wrong/stale: "Decision test preview" badge is correct. "Copy" copies the full prompt: not verified. No other wrong fact found.
- Missing: what to do when Decision diagnostics shows "Failed" or "Could not prepare the decision test" (`en.json` 2702); no troubleshooting for that message.
- Duplication: Stored guidance (lines 58-70) repeats `guided-and-impersonate.md:44-57`. Owner: guided file.
- Too much: the entire "Testing decision statements" section (lines 85-99) is advanced and makes this a second page. Move it to a reference section or a new page.
- Length: 9.5 KB. Cut about 25%.
- Ban-list: "very high" (line 79).
- Priority: medium.

## chats/sending-and-streaming.md
- Task: send a message, attach a file, stop a reply, retry, read an error. Findable: yes.
- Verified OK: Send on Enter defaults: Roleplay off, Conversations on, Game on (`ui.store.ts:2431-2433`), in General > Input & Editing (`SettingsPanel.tsx:2499-2511`); "Enter sends to Professor Mari" (`en.json` 6119); attachments 20 MB (`packages/client/src/components/chat/ChatInput.tsx:700`); accepted types (`ChatInput.tsx:2084`); Enable streaming default on, Streaming speed default 50 (`ui.store.ts:2300-2303`), speed slider 1-100 (`SettingsPanel.tsx:2450-2452`); Trim incomplete sentences default off (`ui.store.ts:2360`); progress labels Preparing context, Building prompt, Scanning lorebooks, Recalling memories, Running agents, Retrieving knowledge, Generating (`use-generate.ts`); "Finishing in background..." (`use-generate.ts:3463`); Thinking Tags (`en.json`); Image Captioning (Advanced Parameters).
- Wrong/stale: label case: guide "Image Captioning", UI "Image captioning" (`en.json` 11249). Minor.
- Missing: what the user sees for "Send" when no connection is set (the toast text exists but is not quoted).
- Duplication: retry / /continue overlaps `messages.md:72-80`. Owner: `messages.md`. Slash list overlaps `slash-commands.md`.
- Ban-list: "actually return it" (line 100); "note that says" is fine.
- Length: cut about 15%.
- Priority: low.

## chats/slash-commands.md
- Task: look up a command. Findable: yes (reference).
- Verified OK: aliases: /roll /r /dice; /games /game /play; /sys /system; /guided /narrator /narrate /nar; /continue /cont; /as /respond; /emote /emotion /sprite; /impersonate /imp; /impersonate_prompt /imp_prompt; /remind /reminder /timer; /random /rand /event; /scene /rp; /goto /jump /scroll; /illustrate /ill; /macros /macro (`packages/client/src/lib/slash-commands.ts`, lines 731-1645). /roll `kh`, `kl`, `dh`, `dl` (lines 113-122).
- Wrong/stale: "In Game mode, only /illustrate works as a slash command" not verified. Table game commands (/uno, /chess, /poker, /8ball, /pool, /tictactoe, /ttt, /rps) are package-defined; not in Engine (`ChatSidebar`/`slash-commands.ts` builds them from package contributions, `slash-commands.ts:1655-1680`). Consistent with `docs/agents/built-in-agents.md:404-420` and `packages/server/src/services/professor-mari/official-agent-knowledge.ts:279-293`.
- Missing: which commands need Roleplay vs Conversation is only in the intro; a short mode column would help.
- Duplication: /hide, /unhide with `messages.md`; /guided and /impersonate with `guided-and-impersonate.md`; game commands with `table-games.md` and `getting-started.md`. Owner for syntax: this file.
- Length: 11.7 KB. Cut about 10%.
- Priority: low.

---

## conversation/getting-started.md
- Task: understand Conversation mode; set up a chat with the wizard; find Automation and Commands. Findable: yes.
- Verified OK: four wizard steps: Name & Connection, Prompt Preset, Persona & Characters, Automation (`packages/client/src/components/chat/ChatSetupWizard.tsx:148-200`); "Start Chatting" button (`ChatSetupWizard.tsx:2259`); Autonomous Messages default on (`ChatSetupWizard.tsx:1222`); Generate Schedules only when Autonomous is on (`ChatSetupWizard.tsx:2075`); presence pill with Active / Idle / Do Not Disturb / Invisible (`ChatSidebar.tsx:2280-2310`); Idle after 10 minutes (`packages/client/src/hooks/use-idle-detection.ts:11`); "What are you doing?" field (`en.json` `ui.layout.userstatusfooter.whatAreYouDoing`).
- Wrong/stale:
  - "The complete set of command families is" 17 items; the code has **18** command keys (`packages/shared/src/types/chat.ts:81-100`). **Videos** (key `video`) is missing from the list.
  - "Every visible family starts on" (line 55) is wrong for Videos: video is opt-in and off by default (`chat.ts:106-111`; `selfies.md:117`).
  - Reactions note: the guide says reactions are saved as a note like `[User reacted with ...]` (line 98). Not found. A user reaction is stored on the message (`packages/server/src/routes/chats.routes.ts:3207-3221`) and feeds the autonomous cadence; the prompt phrase is "X reacted with Y" (`packages/server/src/routes/generate/conversation-custom-assets.ts:558`). Treat the bracket format as unverified or wrong.
  - Table game slash commands (lines 122-146): package-defined; see slash-commands.md.
  - Calls, Illustrator, Music DJ, Haptics "appear only when packages installed": consistent with `CONVERSATION_COMMAND_AGENT_IDS` (`chat.ts:114-127`).
- Missing: link from Automation step to where Commands master toggle lives after setup (`selfies.md` names it; guide does not).
- Duplication: presence statuses repeated in `schedules.md:175-190`; selfies section repeats `selfies.md`; table games repeats `table-games.md`. Owner: each feature file; this file should link.
- Length: 11 KB. Cut about 30%.
- Priority: medium (family list wrong, reactions format unverified).

## conversation/schedules.md
- Task: turn on autonomous messages; set schedules; /status; presence. Findable: yes.
- Verified OK: Chat Check-In Cap labels and "Default chat ceiling (talkativeness-based)" / "Numeric value" (`en.json` 9574, 9614, 9747); talkativeness-based caps 8/6/5/3/2 (`packages/server/src/services/conversation/autonomous.service.ts:130-133`); Wait before checking in default 120, clamped 15-360 (`packages/server/src/services/conversation/schedule.service.ts:454`); away delay 1-3 min, busy 2-5 min (`schedule.service.ts:585-587`); Busy waits 3x (`autonomous.service.ts:446`); follow-up cap 3 total (`autonomous.service.ts:417-418`); schedule editor labels: Chat talkativeness, Check-in moments (Morning, Goodnight, Meal breaks, After busy, Long absence), Advanced timing, Daily safety limit, Week action Rewrite / Adjust / Vary / Repair (`CharacterScheduleEditorModal.tsx:91-122`); "Renew weekly" and "Character Schedule Manager" (`en.json` 8896, 8926); Edit schedules, Create schedule, Summary may be stale, Save schedule, Export/Import schedule (`en.json`).
- Wrong/stale: "Talkativeness levels Rare / Quiet / Balanced / Social / Very frequent": Rare, Quiet, Balanced, Social verified (`CharacterScheduleEditorModal.tsx:91-94`); Very frequent not checked. Otherwise none found.
- Missing: what the user sees after /status sets a status (a status badge in the chat header is not described).
- Duplication: presence statuses repeated from getting-started.md; check-in pacing overlaps group-chats.md:113-116. Owner: this file.
- Length: 12.4 KB. Cut about 25%: move the full schedule editor field list to a table; cut the pacing prose to a table.
- Priority: low (mostly accurate).

## conversation/profiles.md
- Task: set a Convo display name, About Me, Convo Behavior. Findable: partly (the title says "Conversation Mode Profiles", the UI term is "Convo" tab).
- Verified OK: Convo tab, Convo Display Name, About Me, Convo Behavior, "Declare this name on the card in the prompt" (`en.json` 8667-8673; `ConvoProfileFields.tsx`); Insertion options: constant after / before, post-history append / prepend / replace, macro only (`ConvoProfileFields.tsx:20-25`, `packages/shared/src/schemas/character.schema.ts:35-42`); "Chat-specific about me saved" (`en.json` 13501); Revert, Clear labels (`en.json` 8686).
- Wrong/stale: `update_about_me` tool exists (`packages/server/src/services/tools/tool-executor.ts`); "Enable Tool Use" label exists (`en.json`). The four macros were not verified in macro-engine.ts beyond `convo_behavior`, `char_about`, `persona_about`, `convo_display` appearing in `packages/shared/src/utils/macro-engine.ts`.
- Missing: the title collision with "settings profile" (see terminology). A one-line "not the same as a settings profile" note at the top would help.
- Duplication: none major.
- Length: 7.5 KB. Cut about 15%.
- Priority: medium (title collision; likely confusion).

## conversation/emoji-stickers-gifs.md
- Task: upload/name/use custom emojis and stickers; GIFs; selection preferences. Findable: yes.
- Verified OK: emoji max 256 px and sticker max 512 px (`packages/client/src/lib/custom-emoji.ts:17-20`); name pattern `^[a-z0-9_]{1,32}$` (`packages/shared/src/schemas/custom-emoji.schema.ts:7`, `custom-sticker.schema.ts:7`); "Name this emoji" / "Name this sticker" (`en.json` 10091, 11052); "Make emoji" / "Make sticker" (`CustomEmojiTagButton.tsx:123-124`); "Send sticker" dialog with "Send & reply" and "Add to message" (`ConversationInput.tsx:1846-1850`); export filenames `marinara-custom-emojis.json`, `marinara-custom-stickers.json` (`CustomEmojiTab.tsx:156`, `StickerPicker.tsx:226`); GIPHY_API_KEY (`packages/server/src/config/runtime-config.ts:509`); Giphy rating "r" (`packages/server/src/routes/gifs.routes.ts:88`); "Selection preferences" (`en.json` 10097); "Max offered (each)" default 20 (`en.json` 10081).
- Wrong/stale: "Semantic / Random / Tool-call" are mode keys in `CustomEmojiSelectionSettings` (`semantic`, `random`, `tool-call`); display labels not verified.
- Missing: the Giphy dashboard steps are not verified.
- Duplication: none major.
- Length: 8.8 KB. Cut about 15%.
- Priority: low.

## conversation/selfies.md
- Task: turn selfies on; set selfie options; request a selfie; video messages. Findable: yes for the title; the control names do not match the UI.
- Wrong/stale (high):
  - **Selfie Connection** (bold, used throughout): UI label is **Selfie model** (`en.json` 9828, `ui.chat.chatsettingsdrawer.selfieConnection`).
  - "Video Connection" (lines 122): not in Engine en.json (the Engine label "Video connection" exists only for storyboards, `en.json` 8156). The Calls/Illustrator package may own the label; unverified.
  - First frame label: "New selfie, or the avatar if no selfie connection" (line 124) vs UI "...if no selfie **provider**" (`en.json` 9895).
  - Verified OK: Generated Selfies label (`en.json` 9668); Illustrator Settings (9688); Resolution presets 512x512, 512x768, 768x768, 768x1024, 896x1152 (default), 1024x1024 (`ChatSettingsDrawer.tsx:7712-7718`; default `ui.store.ts` imageSelfieWidth 896, height 1152); Prompt Model, Image Style, None (selfies disabled) (`en.json` 9766, 9742); Send Avatar References, Attach Card Appearance labels (`en.json` 9044, 9050); Images only / Videos only / Images and videos (`en.json` 10701-10703); Generated Videos (`en.json` 9669); Video Run Interval (`en.json` 7695); Videos per reply default 3 (`en.json` 15849; default not verified); gallery Selfie / Video buttons (`en.json` 9327, 9338); Regenerate image (`en.json` 9349); "Selfie generated." (`en.json` 9328).
- Missing: the Expose media prompts before sending option is described (line 98); the label is verified as "Expose media prompts before sending" (`en.json` 6733).
- Duplication: getting-started.md lines 104-110 repeats the setup steps. Owner: this file.
- Length: 11.9 KB. Cut about 20%.
- Priority: high (main control name does not match the UI).

## conversation/calls.md
- Task: set up and use a voice or video call. Findable: yes. Mostly package-owned.
- Verified OK: Local Whisper models and sizes: Whisper Tiny (Multilingual) 180 MB / 350 MB RAM; Whisper Base (Multilingual) 320 MB / 650 MB RAM (`packages/shared/src/types/sidecar.ts:415-430`); "Download Whisper" and "Delete Local Whisper" labels (`en.json` 2236-2239); Local Whisper unavailable in Lite mode message (`en.json` 2244); Speech to Text labels: Server URL, API key, Model, Language, Test, "Use your own speech-to-text server" toggle (`en.json` 2552-2568); `STT_LOCAL_URLS_ENABLED` (`packages/server/src/config/runtime-config.ts:746`); Call audio enabled default off and input mode default `local_whisper` (`packages/client/src/components/panels/settings/TTSConfigCard.tsx:1052-1053`); TTS source names OpenAI-compatible, ElevenLabs, PocketTTS, xAI (`packages/shared/src/types/tts.ts:6`; `TTSConfigCard.tsx:124`); Character video presence, Generate voice cues labels are package-owned (not in Engine).
- Wrong/stale (high):
  - "Connections > Local Model > Local Speech Model" (line 67): the Engine has no "Local Speech Model" string (0 hits) and no "Local Model" string (UI says **Built-in model**, `en.json` 2604). HomeFaq.tsx:524 says "Connections > Built-in model".
  - Audio input modes (lines 56-59): the four UI labels (Mic recording + Local Whisper, Browser speech recognition, Manual system dictation, Provider-native audio/video) are not in Engine. The Engine type has four values `system`, `auto`, `transcribe`, `local_whisper` (`packages/shared/src/types/conversation-call.ts:9`). Mapping cannot be verified here.
  - Path to Calls settings: guide says Agents > Calls (line 106). HomeFaq.tsx:525 says Chat Settings > Commands > Calls. Two paths; cannot confirm which is current.
  - Call Audio Pipeline, Audio/Video Calls, Start call, End call, Open call chat, Close call chat, Message in call: none in en.json. Unverified.
- Missing: which Calls version the guide targets. The "restart Marinara" step is a claim, not verified.
- Duplication: TTS setup (lines 37-50) repeats `docs/media/tts-setup.md`; Local Model repeats `docs/connections/local-model.md`.
- Length: 22.9 KB. Cut about 35%: move Local Whisper and speech-to-text setup to the Local Model guide; keep the call flow; move hidden commands list to a table.
- Priority: high (setup path conflicts with the app's own FAQ; cannot verify labels in this repo).

## conversation/table-games.md
- Task: start and play UNO, Chess, Poker, 8-Ball Pool, Tic-Tac-Toe, RPS; let characters start games. Findable: yes. Package-owned.
- Verified OK: slash commands /8ball /pool /tictactoe /ttt /rps consistent with `docs/agents/built-in-agents.md:404-420` and `packages/server/src/services/professor-mari/official-agent-knowledge.ts:279-293`; Commands toggles for each game (`en.json` 9591 "Commands"); "Let characters..." descriptions not in Engine (package-owned).
- Not in Engine: "Start UNO", "Start Chess", "Start Poker", "Start 8-Ball Pool", "Deal", "Start game", "Next hand", "Showdown", "Silent (no announcer)", "House dealer (silent)", "Race to 3", "Resign and end this game?", "End this poker game?" (0 hits in en.json). Stakes defaults (1000 / 10 / 0 / 0) and seat limits (UNO 2-10, Poker 2-8) are unverified here.
- Wrong/stale: none confirmed.
- Missing: the install step (Agent Organizer) is linked but the restart claim is not verified.
- Duplication: `docs/agents/built-in-agents.md` has the same games (lines 404-420). `getting-started.md` lines 112-146 repeats slash commands. Owner: this file for rules; built-in-agents for the catalog entry.
- Length: 13.8 KB. Cut about 40%: rule details belong to the Marinara-Agents package docs; keep how to start, how to end, and the Commands toggles.
- Priority: medium (package-owned; cannot verify; recommend checking against the package before any edit).

---

## Priority summary
- High: group-chats.md (Conversation group section and "Reply When Mentioned" wrong); guided-and-impersonate.md (Quick replies path wrong); selfies.md ("Selfie Connection" label); calls.md (setup path and labels unverifiable and conflicting); messages.md (dialog title and missing option) is medium-high.
- Medium: connected-chats.md; peek-prompt.md; getting-started.md; profiles.md; chat-settings.md; branches.md; table-games.md.
- Low: managing-chats.md; sending-and-streaming.md; slash-commands.md; schedules.md; emoji-stickers-gifs.md; export-import.md.

Top 5 wrong facts (verified):
1. Conversation mode has a Group Chat section with Grouped / Individual and Sequential / Smart / Manual response order; there is no "Reply When Mentioned" toggle. (`group-chats.md` lines 149-166; code `ChatSettingsDrawer.tsx:7108-7145, 7237`)
2. Quick replies is under Settings > General > Input & Editing, not Advanced > Message Tools. (`guided-and-impersonate.md` 121-125; code `SettingsPanel.tsx:2557`)
3. The selfie setting is labelled "Selfie model" in the UI, not "Selfie Connection". (`selfies.md` throughout; `en.json` 9828)
4. The delete dialog is titled "Delete message", not "How to proceed?", and has a "Delete all other swipes" option. (`messages.md` 43-52; `ChatCommonOverlays.tsx:25-29, 94`)
5. Cross-Chat Awareness is inside Connected Chats, and the quoted help text does not exist; the real text is "Characters know what happens in their other chats". (`connected-chats.md` 17-27; `ChatSettingsDrawer.tsx:7982-7995`; `en.json` 9570)
Also: the Commands grid omits Videos, which is opt-in (`getting-started.md` 55-76; `shared/src/types/chat.ts:81-111`).

---

## Word list candidates

Term the UI uses → synonyms seen in docs → one-line plain explanation
- Chat Settings → chat settings drawer, settings panel, sliders button → the panel of options for the chat you have open.
- Built-in model → Local Model, local model, on-device model → a model that runs on the same computer as Marinara.
- Selfie model → Selfie Connection, selfie connection, image connection → the image service used for selfies.
- Merged (Narrator) → merged, narrator mode, one reply → one reply voices every character in a Roleplay group.
- Grouped → merged, group reply → one reply voices several characters in a Conversation group.
- Individual → individual mode, separate replies → each character answers in its own reply.
- Response Order (Sequential / Smart / Manual) → turn order, speaker order → how the next speaker is picked in an Individual group.
- Settings profile / Profile → profile, preset, chat settings bundle → a saved set of chat settings you can apply to other chats.
- Prompt Preset → preset, prompt template, prompt source → the saved prompt structure and generation values.
- Convo Display Name / About Me / Convo Behavior → profile, bio, persona profile → the per-character profile shown in Conversation mode.
- Assembled Prompt → Peek Prompt viewer, prompt viewer → the window that shows the exact prompt sent for a reply.
- Peek prompt → peek at the prompt, prompt viewer → the action that opens the Assembled Prompt window.
- Delete message → How to proceed?, delete dialog → the dialog that removes a message, one swipe, or more.
- Connected chat / Connected Chats → linked chat, link, cross-chat → a one-to-one link between a Conversation and a Roleplay or Game.
- Cross-Chat Awareness → sibling chats, shared memory → a character remembers its other Conversation chats.
- Add account → connection, provider, account, endpoint, API key → a saved link to an AI service.
- Connections → providers, accounts → the page that holds all AI service links.
- Autonomous Messages / Autonomous Messaging → check-ins, reach out first, proactive messages → characters who message you first.
- Chat Check-In Cap → daily limit, check-in limit → the most check-ins per day in one chat.
- Active / Idle / Do Not Disturb / Invisible (presence pill) → status, presence → your availability for the characters.
- Online / Away / Busy / Offline (schedule blocks) → statuses → a character's availability in a schedule block (Away = idle, Busy = dnd in /status).
- Chat talkativeness → talkativeness, how chatty → how often a character starts a conversation.
- Commands (master toggle) → hidden actions, command families, agent commands → actions a character can take on its own.
- Agent Organizer → Agents, agent packages, downloadable agents → where you install optional add-ons.
- Stored guidance → guidance, direction, steer → the instruction that shaped a reply, saved with it.
- Regenerate (guided) → guided regenerate → a new reply steered by the text you typed.
- Quick replies → quick actions, send menu → extra send buttons next to Send.
- Swipe → alternate reply, version → one of several answers kept on the same message.
- Hide from AI / Unhide from AI → hide, hidden → keeps a message out of the AI's context.
- Branch from here → branch, fork → copies the chat up to a message into a new chat branch.
- Chat Branches → branches, branch graph → the section that lists and manages a chat's branches.
- Story (export) → styled HTML page, web page → an export you can open in a browser.
- Video connection / Default for Videos → video provider, video model → the service that makes video clips.
- Video Run Interval → video interval → how many messages pass between automatic video clips.
- First frame → starting picture, first picture → the image a video clip starts from.
- Voice option (One voice for all / Selected per character or persona) → voice mode → whether one voice or a voice per character is used for TTS.
- Image captioning → image description, captioning → turns attached images into text for a model that cannot see images.
- Decision model → helper model, yes/no model → a smaller model used for yes/no decisions.
- Chat widget style (Default / Dottore / Prof. Mari) → theme, look → the look of movable chat buttons and windows.
- Chat tools (phone menu) → three-dot menu, tools menu → the phone menu that holds chat tools outside Chat Settings.
- CONVO / RP / GM (tabs) → Conversation / Roleplay / Game → the three chat modes in the sidebar.
- Schedule → routine, weekly routine → a character's week of status blocks.
