import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readSource(relativePath) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

const roleplayHud = readSource("packages/client/src/components/chat/RoleplayHUD.tsx");
const roleplayPanels = readSource("packages/client/src/components/chat/RoleplayHUDPanels.tsx");
const chatHelp = readSource("packages/client/src/components/chat/ChatHelpOverlay.tsx");
const chatSidebar = readSource("packages/client/src/components/layout/ChatSidebar.tsx");
const branchSelector = readSource("packages/client/src/components/chat/ChatBranchSelector.tsx");
const cardLibrary = readSource("packages/client/src/components/characters/CharacterLibraryView.tsx");
const agentCatalog = readSource("packages/client/src/components/agents/AgentCatalogView.tsx");
const agentSettingsControls = readSource("packages/client/src/components/chat/AgentSettingsControls.tsx");
const inventoryPanel = readSource(
  "packages/client/src/features/tracker-panel/components/sections/InventoryTrackerPanel.tsx",
);
const sectionControls = readSource(
  "packages/client/src/features/tracker-panel/components/controls/SectionControls.tsx",
);
const trackerDataSidebar = readSource("packages/client/src/features/tracker-panel/components/TrackerDataSidebar.tsx");
const questTrackerPanel = readSource(
  "packages/client/src/features/tracker-panel/components/sections/quest-tracker/QuestTrackerPanel.tsx",
);
const globals = readSource("packages/client/src/styles/globals.css");

const beholderLauncher = roleplayHud.indexOf("item.id}-beholder-launcher");
const agentsGroup = roleplayHud.indexOf("<ActionsGroup");
assert.ok(
  beholderLauncher >= 0 && beholderLauncher < agentsGroup,
  "Beholder must launch between Tracker Panel and Agents",
);
assert.doesNotMatch(
  roleplayHud,
  /\[\.\.\.memoryNagTrackerPackages, \.\.\.otherRoleplayTrackerPackages, \.\.\.beholderTrackerPackages\]/u,
  "mobile must not mount standalone Memory Nag or Beholder controls in the tracker row",
);
assert.match(
  roleplayPanels,
  /showQuests[\s\S]*showInventory[\s\S]*memoryNagPackageIds\.map[\s\S]*showCustomTracker/u,
  "the combined mobile tracker panel must order Inventory and Memory Nag after Quests and before Custom",
);
assert.match(
  chatHelp,
  /querySelectorAllDeep\(root[\s\S]*root instanceof Element && root\.shadowRoot[\s\S]*querySelectorAllDeep\(root\.shadowRoot/u,
  "help target discovery must descend into package shadow roots",
);
assert.match(
  chatHelp,
  /definition\.selector\.startsWith\("\[data-chat-help="\)[\s\S]*readVisibleRect\(element, preferInteractive\)/u,
  "only chat toolbar targets should shrink to their interactive controls",
);
assert.match(
  chatHelp,
  /window\.innerWidth < 768 \? 0 : TARGET_PADDING/u,
  "dense mobile help targets must not be expanded into overlapping frames",
);
assert.match(
  chatHelp,
  /closestDeep\(interactive, "\[data-chat-toolbar-overflow-menu\]"\)[\s\S]*MOBILE_TOOLBAR_HIGHLIGHT_SIZE/u,
  "mobile overflow help targets must share one square highlight size",
);
assert.match(
  chatHelp,
  /const railLeft = mobileOverflowRect\.left - TARGET_PADDING[\s\S]*reachesBehindRail[\s\S]*width: railLeft - target\.rect\.left/u,
  "large mobile help regions must reserve the open toolbar rail instead of squeezing button highlights",
);
assert.match(
  chatHelp,
  /fixedMobileToolbarRects[\s\S]*fixedMobileToolbarRects\.get\(target\.id\) \?\? target\.rect/u,
  "collision separation must preserve the equal square frames around mobile toolbar buttons",
);
assert.match(
  roleplayHud,
  /left: pos\.left, transform: pos\.centered \? "translateX\(-50%\)"/u,
  "the mobile Agents menu must center from its rendered width",
);
assert.match(
  roleplayHud,
  /total > 0 \? \([\s\S]*tabular-nums[\s\S]*\) : \([\s\S]*<Backpack/u,
  "the Inventory launcher must show only the item count after inventory is populated",
);
assert.doesNotMatch(
  roleplayHud,
  /<(?:TrackerPanelIcon|Backpack|MapPin)[^>]*mari-chrome-accent-icon/u,
  "built-in tracker launchers must inherit the shared toolbar resting color",
);
assert.match(
  roleplayHud,
  /<span className="contents \[&_button>svg\]:!text-inherit">[\s\S]*<CapabilityElement/u,
  "downloadable tracker icons must inherit the same shared toolbar color",
);
assert.match(
  roleplayHud,
  /onRerunTracker:[\s\S]*trackerRetryBusy:[\s\S]*onToggleLockMode:/u,
  "package tracker launchers must receive working regenerate and lock callbacks",
);
assert.match(
  roleplayPanels,
  /personaStats[\s\S]*<PersonaStatusField/u,
  "the mobile tracker panel must present Persona Stats before Current Status",
);
assert.doesNotMatch(
  roleplayPanels,
  /(?:Characters|Quests|Custom)\s*\{[^}]*\.length/u,
  "mobile tracker headings must not append item counts",
);
assert.doesNotMatch(
  roleplayPanels,
  /ui\.panels\.characterspanel\.characters/u,
  "the mobile Characters heading must not reuse the library count-prefix label",
);
assert.match(
  inventoryPanel,
  /mari-rgb-static-icon block text-current/u,
  "Inventory remove icons must inherit their item text color instead of the animated accent",
);
assert.match(
  globals,
  /\.mari-chrome-muted-badge[\s\S]*border-radius: 0\.625rem;[\s\S]*\.mari-chrome-tag\s*\{\s*border-radius: 0\.625rem;/u,
  "shared tags and badges must use the compact search-tag corner radius",
);
assert.doesNotMatch(
  chatSidebar,
  /mari-chrome-muted-badge mari-chrome-tag/u,
  "chat branch badges must use the exact shared character-tag badge",
);
assert.match(
  branchSelector,
  /mari-chrome-muted-badge absolute/u,
  "toolbar branch counts must use the same shared badge shape",
);
assert.match(
  cardLibrary,
  /card\.tags\.slice\(0, 2\)\.map[\s\S]*mari-chrome-tag/u,
  "character and persona library tags must use the shared compact tag shape",
);
assert.match(
  agentCatalog,
  /selected\.manifest\.kind[\s\S]*mari-chrome-tag[\s\S]*packageModes\(selected\.manifest\.id\)[\s\S]*mari-chrome-tag/u,
  "agent kind and mode tags must use the shared compact tag shape",
);
assert.match(
  sectionControls,
  /export const TRACKER_SECTION_SHELL_CLASS/u,
  "Tracker Panel sections must share one themed shell class",
);
assert.match(
  trackerDataSidebar,
  /TRACKER_SECTION_SHELL_CLASS, "mari-tracker-capability-section"[\s\S]*TrackerReadabilityVeil strength="strong"[\s\S]*<CapabilityElement/u,
  "downloadable tracker sections must use the same shell and readability veil as built-in sections",
);
assert.doesNotMatch(
  questTrackerPanel,
  /radial-gradient|QUEST_PANEL_TEXTURE_CLASS/u,
  "Quest Board must inherit the shared square panel texture instead of adding dots",
);
assert.match(
  globals,
  /\.mari-tracker-capability-section :is\(\.mn-tracker, \.bh-tracker-launch\)[\s\S]*border-bottom: 0;[\s\S]*\.mn-tracker-title, \.bh-tracker-launch__title[\s\S]*--tracker-panel-font-scale/u,
  "Memory Nag and Beholder must inherit shared section dividers, backgrounds, and constrained typography",
);
assert.match(
  agentSettingsControls,
  /flex min-h-8 items-center justify-center rounded-md[\s\S]*text-center/u,
  "shared agent segmented controls, including Music DJ, must center their contents",
);

process.stdout.write("Mobile tracker and help layout regression passed\n");
