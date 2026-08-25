import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readSource(relativePath) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

const trackerSidebar = readSource("packages/client/src/features/tracker-panel/components/TrackerDataSidebar.tsx");
const inventoryTracker = readSource(
  "packages/client/src/features/tracker-panel/components/sections/InventoryTrackerPanel.tsx",
);
const trackerSectionControls = readSource(
  "packages/client/src/features/tracker-panel/components/controls/SectionControls.tsx",
);
const trackerSectionList = readSource("packages/client/src/features/tracker-panel/components/TrackerSectionList.tsx");
const roleplayHud = readSource("packages/client/src/components/chat/RoleplayHUD.tsx");
const chatToolbarControls = readSource("packages/client/src/components/chat/ChatToolbarControls.tsx");
const roleplayPanels = readSource("packages/client/src/components/chat/RoleplayHUDPanels.tsx");
const appShell = readSource("packages/client/src/components/layout/AppShell.tsx");
const trackerHeader = readSource("packages/client/src/features/tracker-panel/components/TrackerSidebarHeader.tsx");
const uiStore = readSource("packages/client/src/stores/ui.store.ts");
const chatGallery = readSource("packages/client/src/components/chat/ChatGallery.tsx");
const chatSettingsDrawer = readSource("packages/client/src/components/chat/ChatSettingsDrawer.tsx");
const chatSidebar = readSource("packages/client/src/components/layout/ChatSidebar.tsx");
const chatBranchSelector = readSource("packages/client/src/components/chat/ChatBranchSelector.tsx");
const homeBrowserHub = readSource("packages/client/src/components/chat/HomeBrowserHub.tsx");
const storyboardChatSettings = readSource("packages/client/src/components/chat/StoryboardChatSettingsPanel.tsx");
const conversationView = readSource("packages/client/src/components/chat/ConversationView.tsx");
const agentSettingsControls = readSource("packages/client/src/components/chat/AgentSettingsControls.tsx");
const translationSection = readSource("packages/client/src/features/chat-settings/sections/TranslationSection.tsx");
const discordMirrorSection = readSource("packages/client/src/features/chat-settings/sections/DiscordMirrorSection.tsx");
const gameExtraPromptSection = readSource(
  "packages/client/src/features/chat-settings/sections/GameExtraPromptSection.tsx",
);
const gameWidgetEditor = readSource("packages/client/src/components/game/GameWidgetSetupEditor.tsx");
const gameVolumeMixer = readSource("packages/client/src/components/game/GameVolumeMixer.tsx");
const advancedParameters = readSource(
  "packages/client/src/features/chat-settings/sections/AdvancedParametersSection.tsx",
);
const globalStyles = readSource("packages/client/src/styles/globals.css");

assert.doesNotMatch(
  trackerSidebar,
  /className="block \[--tracker-profile-icon:var\(--marinara-chat-chrome-accent\)\]"/u,
  "downloadable Tracker Panel sections must inherit the shared neutral header icon color",
);
assert.match(
  trackerSidebar,
  /className="block"/u,
  "downloadable Tracker Panel sections must retain block display styling",
);
assert.match(
  trackerSidebar,
  /\[\.\.\.otherCapabilityTrackerPackages, \.\.\.beholderTrackerPackages\]/u,
  "Beholder must remain the final downloadable section in Tracker Panel",
);
assert.match(
  uiStore,
  /if \(inventoryIndex >= 0 && customIndex >= 0 && inventoryIndex > customIndex\)[\s\S]*order\.splice\(customIndex, 0, "inventory"\)/u,
  "persisted Tracker Panel orders must keep Inventory above Custom",
);
assert.match(
  appShell,
  /mari-tracker-panel[^"\n]*ring-\[var\(--marinara-app-accent-static\)\]/u,
  "Tracker Panel frames must use the configured app accent",
);
assert.match(
  roleplayHud,
  /function TrackerPanelToggleButton[\s\S]*?className=\{WIDGET\}[\s\S]*?<TrackerPanelIcon/u,
  "the roleplay Tracker Panel launcher must reuse the shared tracker widget control",
);
assert.match(
  roleplayHud,
  /const HUD_ICON_BUTTON = getChatToolbarButtonClass\(\{ compact: true \}\)/u,
  "tracker widget controls must inherit the shared chat toolbar treatment",
);
assert.match(
  chatToolbarControls,
  /text-\[var\(--marinara-chat-chrome-button-text\)\]/u,
  "shared chat toolbar icons must inherit the configured chat chrome color",
);
assert.match(
  trackerHeader,
  /mari-accent-animated[^\n]*marinara-app-accent-solid/u,
  "the Tracker Panel header dice must follow the animated app accent",
);
assert.doesNotMatch(
  inventoryTracker,
  /className="\[--tracker-profile-icon:var\(--marinara-chat-chrome-accent\)\]"/u,
  "Inventory must inherit the same header icon color as other Tracker Panel sections",
);
assert.match(
  inventoryTracker,
  /"@container relative z-10 overflow-hidden", !plain && TRACKER_SECTION_SHELL_CLASS/u,
  "Inventory must retain the shared Tracker Panel section wrapper",
);
assert.match(trackerSectionControls, /TRACKER_SECTION_SHELL_CLASS =[\s\S]*border-b border-\[var\(--border\)\]/u);
assert.match(
  inventoryTracker,
  /mari-chrome-tag grid h-4 w-4[^\n]*place-items-center[^\n]*text-current/u,
  "Inventory delete controls must stay centered and inherit the item text color",
);
assert.match(
  trackerSectionList,
  /case "inventory":[\s\S]*?<InventoryTrackerPanel[\s\S]*?\n\s+deleteMode\n/u,
  "Inventory items must expose delete controls directly in Tracker Panel",
);
assert.match(
  roleplayHud,
  /className: compact \? CHAT_TOOLBAR_MOBILE_OVERFLOW_HEIGHT_CLASS : undefined/u,
  "downloadable tracker controls must receive the built-in mobile toolbar height",
);
assert.match(
  roleplayHud,
  /const centered = window\.innerWidth < 768;[\s\S]*?Math\.round\(window\.innerWidth \/ 2\)[\s\S]*?transform: pos\.centered \? "translateX\(-50%\)" : undefined/u,
  "the mobile Agents menu must center itself horizontally",
);
assert.match(
  roleplayHud,
  /const hasWorldState =[\s\S]*?getChatToolbarButtonClass\([\s\S]*?hasWorldState \? "w-auto min-w-8 gap-1 px-2" : "group flex-col gap-0 overflow-hidden"[\s\S]*?!hasWorldState \? \([\s\S]*?<MapPin/u,
  "World State must use the shared toolbar treatment and stay compact until it has generated content",
);
assert.match(
  roleplayHud,
  /function InventoryTrackerWidget[\s\S]*?className=\{WIDGET\}[\s\S]*?total > 0 \?[\s\S]*?<Backpack/u,
  "the Inventory launcher must reuse the shared toolbar treatment and only show its backpack while empty",
);
assert.match(
  roleplayPanels,
  /export function PersonaStatsPanel[\s\S]*NEUTRAL_PANEL_HEADER[\s\S]*PersonaStatusField/u,
  "Persona Stats must place Current Status below its panel header",
);
assert.match(
  roleplayPanels,
  /\{showPersona && \([\s\S]*personastatswidget\.personaStats[\s\S]*<PersonaStatusField/u,
  "the combined mobile panel must place Persona Stats above Current Status",
);
assert.doesNotMatch(
  roleplayPanels,
  /\{(?:characters|quests)\.length\}\)/u,
  "combined mobile Character and Quests headings must not append counts",
);
assert.doesNotMatch(
  roleplayPanels,
  /combinedplayerpanel\.customValue1/u,
  "the combined mobile Custom heading must not append a count",
);
assert.match(
  roleplayPanels,
  /capabilityProps=\{\{[\s\S]*?chatId,[\s\S]*?chatMode: "roleplay",[\s\S]*?mobileCompact: true,/u,
  "the combined mobile panel must request Memory Nag's fixed-open compact presentation",
);
assert.match(
  roleplayPanels,
  /<InventoryTrackerGridPanel[\s\S]*\n\s+plain\n/u,
  "the mobile Inventory section must use the same plain surface treatment as neighboring trackers",
);
assert.doesNotMatch(
  roleplayPanels,
  /ui\.chat\.customtrackerpanel\.customTrackerValue1/u,
  "the Custom HUD popover must not append a count to its title",
);
assert.match(
  chatGallery,
  /className="mari-chrome-field h-10 w-full !rounded-md pl-9 pr-10 text-xs"/u,
  "the shared Gallery search must reuse the standard chat field",
);
assert.match(
  chatSettingsDrawer,
  /case "director":\s*return <Clapperboard/u,
  "Narrative Director must use a distinct clapperboard icon instead of the generic agent star",
);
assert.match(
  chatSettingsDrawer,
  /case "expression":\s*return <VenetianMask/u,
  "Expression Engine must use a distinct theatre-mask icon in Chat Settings",
);
assert.match(
  agentSettingsControls,
  /<div className="flex h-full flex-col gap-1">[\s\S]*?"flex-1 justify-between rounded-md/u,
  "paired agent setting toggles must stretch to the same height",
);
assert.match(
  chatSettingsDrawer,
  /function getActiveAgentMenuDescription/u,
  "active agent menus must strip package installation instructions from their descriptions",
);
assert.match(chatSettingsDrawer, /"Add the Agent in Chat Settings"/u);
assert.match(chatSettingsDrawer, /"Enable it per chat from Chat Settings"/u);
assert.equal(
  (chatSettingsDrawer.match(/!h-8 !min-h-8 w-full whitespace-nowrap !py-0/gu) ?? []).length,
  2,
  "Lorebook Keeper actions must share one explicit height",
);
assert.match(
  translationSection,
  /className="mari-chrome-field mt-0\.5 w-full !rounded-md px-3 py-2 text-xs"/u,
  "the shared Translation language field must use the canonical Chat Settings input style",
);
assert.match(
  chatSettingsDrawer,
  /<SettingsSwitch\s+label=\{localizeUi\("ui\.chat\.chatsettingsdrawer\.addTurnToPrompt"\)\}/u,
  "Add Turn To Prompt must use the shared Settings toggle",
);
assert.match(
  chatSettingsDrawer,
  /<AgentSettingsActionButton[\s\S]*accessMemoriesForThisChat/u,
  "Memory Recall must use the shared Chat Settings action button",
);
assert.doesNotMatch(
  chatSettingsDrawer,
  /noodleTimelineContextEnabled[\s\S]*disabled=\{updateMeta\.isPending\}/u,
  "unrelated metadata writes must not visually disable the Noodle timeline switch",
);
assert.equal(
  (storyboardChatSettings.match(/className="flex h-full flex-col gap-1"/gu) ?? []).length,
  2,
  "Storyboard slider and number cards must share equal-height wrappers",
);
assert.equal(
  (homeBrowserHub.match(/\? "flex-1 gap-1 px-2" : "w-9 flex-none gap-0 px-0"/gu) ?? []).length,
  3,
  "mobile Home tabs must expand only the active tab and collapse inactive tabs to icons",
);
assert.equal(
  (homeBrowserHub.match(/\? "block" : "hidden sm:block"/gu) ?? []).length,
  3,
  "inactive mobile Home tabs must hide their labels while retaining desktop labels",
);
assert.equal(
  (advancedParameters.match(/<AgentSettingsActionButton/gu) ?? []).length,
  2,
  "Advanced Parameters save and reset actions must reuse the shared action button",
);
assert.doesNotMatch(
  chatSettingsDrawer,
  /mari-chat-option-switch[^\n]*groupTurnPromptEnabled/u,
  "Add Turn To Prompt must not restore the legacy custom toggle styling",
);
assert.match(
  chatSidebar,
  /mari-chrome-muted-badge flex shrink-0 items-center gap-0\.5/u,
  "chat-list branch counts must use the shared compact tag treatment",
);
assert.match(
  chatBranchSelector,
  /mari-chrome-muted-badge absolute -right-1 -top-1/u,
  "the active-chat branch count must use the same shared compact tag treatment",
);
assert.match(
  globalStyles,
  /\.mari-chrome-tag\s*\{\s*border-radius: 0\.625rem;/u,
  "the shared compact tag class must own the same softly rounded geometry as library tags",
);
assert.match(
  conversationView,
  /data-conversation-header-identity[\s\S]*?<ConversationPresenceCard[\s\S]*?data-chat-help="call"[\s\S]*?<div className="ml-2 flex/u,
  "the Conversation call launcher must sit beside the character or group identity instead of the right action cluster",
);
assert.doesNotMatch(
  chatSettingsDrawer,
  /SettingsSwitchTrack/u,
  "Chat Settings must use the shared SettingsSwitch instead of rebuilding toggle tracks",
);
assert.match(
  discordMirrorSection,
  /discordMirror[\s\S]*mari-chrome-field/u,
  "Discord Mirror must label and reuse the canonical shared input field",
);
assert.match(
  gameExtraPromptSection,
  /extraInstructions[\s\S]*<MacroTextarea/u,
  "Game Extra Instructions must use the shared expandable macro field",
);
assert.match(
  chatSettingsDrawer,
  /campaignArtStyle[\s\S]*<MacroTextarea[\s\S]*sceneImageInstructions[\s\S]*<MacroTextarea/u,
  "Game Illustrator prompt fields must use shared expandable macro fields",
);
assert.match(
  gameWidgetEditor,
  /<AgentSettingsActionButton[\s\S]*addWidget/u,
  "Game widget creation must use the shared agent action button",
);
assert.doesNotMatch(
  gameVolumeMixer,
  /(?:red|destructive)/u,
  "the muted Game volume control must not use a hard-coded warning color",
);

process.stdout.write("Tracker and Gallery UI regression passed\n");
