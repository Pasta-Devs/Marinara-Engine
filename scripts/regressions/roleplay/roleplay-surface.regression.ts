// The Roleplay surface: idle sprites stay below the transcript and choice controls, every Narrator render path gets
// the live roster, and both background crossfade slots cover without stretching. Also Narrator avatar cycling, the
// Echo Chamber and HUD on a phone, the HUD's Stop Agents action, the Inventory Tracker with reduced effects, CYOA choices, and summary requests
// opening Chat Settings. Reads component source until a test can drive these; most need browser tests.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const roleplaySurfaceSource = readFileSync(
  new URL("../../../packages/client/src/components/chat/ChatRoleplaySurface.tsx", import.meta.url),
  "utf8",
);
const spriteOverlaySource = readFileSync(
  new URL("../../../packages/client/src/components/chat/SpriteOverlay.tsx", import.meta.url),
  "utf8",
);
assert.equal(
  roleplaySurfaceSource.match(/mergedGroupCharacterIds=\{activeChatCharacterIds\}/gu)?.length,
  6,
  "Classic and VN historical, regenerating, and streaming Narrator messages must all receive the live active roster; saved replies keep their own (#8762)",
);
assert.match(
  spriteOverlaySource,
  /const stageZIndexClass = editing \? "z-\[35\]" : "z-\[5\]"/u,
  "non-editing sprites must remain below the Roleplay transcript and its CYOA controls",
);
assert.equal(
  roleplaySurfaceSource.match(/object-cover object-center/gu)?.length,
  2,
  "both crossfade slots should cover their surface without stretching the background",
);

const echoChamberPanelSource = readFileSync(
  new URL("../../../packages/client/src/components/chat/EchoChamberPanel.tsx", import.meta.url),
  "utf8",
);
const chatMessageSource = readFileSync(
  new URL("../../../packages/client/src/components/chat/ChatMessage.tsx", import.meta.url),
  "utf8",
);
const assignedSweepChatAreaSource = readFileSync(
  new URL("../../../packages/client/src/components/chat/ChatArea.tsx", import.meta.url),
  "utf8",
);
assert.match(assignedSweepChatAreaSource, /export const ChatArea = memo\(function ChatArea/u);
assert.doesNotMatch(assignedSweepChatAreaSource, /updateMessage(?:Extra)?\.mutate/u);
assert.match(chatMessageSource, /mari-chrome-accent-progress mari-accent-animated mb-1\.5 h-0\.5/u);
assert.match(
  chatMessageSource,
  /function ConversationStartMarkers[\s\S]*className=\{cn\("w-full", panel \? "mb-1 px-1" : "mb-0\.5 px-2"\)\}/u,
  "Roleplay New Start dividers must span user and assistant message bodies",
);
assert.match(chatMessageSource, /pointer-events-auto relative z-30 flex h-11 w-11/u);
assert.equal(
  chatMessageSource.match(/\(showActions \|\| editing\) && "opacity-100"/gu)?.length,
  2,
  "Editing must keep every Roleplay and Game message action visible",
);
assert.equal(
  roleplaySurfaceSource.match(/data-roleplay-agent-window/gu)?.length,
  3,
  "Roleplay must identify both HUD layouts and package-provided agent surfaces",
);
assert.match(
  echoChamberPanelSource,
  /const rootAttributes = \{[^}]*"data-roleplay-agent-window": "echo"[^}]*\}/u,
  "Echo Chamber should retain its marker for mobile composer visibility",
);
assert.match(
  echoChamberPanelSource,
  /<FloatingWindow[\s\S]*?rootAttributes=\{rootAttributes\}/u,
  "the Echo Chamber window and desktop bubble must share the mobile edit marker",
);
assert.match(
  echoChamberPanelSource,
  /<WindowBubble[\s\S]*?attributes=\{\{ \.\.\.rootAttributes,/u,
  "the collapsed phone Echo Chamber button must retain the mobile edit marker",
);
assert.match(assignedSweepChatAreaSource, /mari-chrome-accent-text-muted mari-accent-animated max-w-sm text-xs/u);
const roleplayHudSource = readFileSync(
  new URL("../../../packages/client/src/components/chat/RoleplayHUD.tsx", import.meta.url),
  "utf8",
);
const cyoaChoicesSource = readFileSync(
  new URL("../../../packages/client/src/components/chat/CyoaChoices.tsx", import.meta.url),
  "utf8",
);
// Chat Summary is a Chat Settings drawer, so a request opens Chat Settings there (desktop window or phone sheet).
assert.match(
  assignedSweepChatAreaSource,
  // One listener table now serves the summary, lorebook-entries and search drawers (omnibar chat tool rows).
  /\[CHAT_SUMMARY_OPEN_REQUEST_EVENT, "summary"\][\s\S]{0,400}chatId !== useChatStore\.getState\(\)\.activeChatId\) return;\s*handleOpenSettingsPanel\(undefined, \{ initialSection \}\)/u,
  "Summary requests must open Chat Settings at the Chat Summary drawer for the active chat only",
);
assert.match(
  chatMessageSource,
  /const cycleMergedNarratorAvatars = \(!isRoleplay \|\| roleplayNarratorAvatarCycling\) && !reduceAmbientEffects;/u,
  "Narrator avatar cycling must follow the Roleplay preference and stop with reduced ambient effects",
);
assert.match(
  chatMessageSource,
  /aria-label=\{localizeUi\("ui\.chat\.edittextarea\.saveEdit"\)\}[\s\S]{0,180}h-11 w-11/u,
  "The Roleplay edit Save control must keep a full touch-sized hit target",
);
assert.equal(
  roleplayHudSource.match(/!reduceAmbientEffects && "animate-\[inventory-cycle_0\.4s_ease-out\]"/gu)?.length,
  1,
  "The dedicated Roleplay Inventory Tracker widget must suppress mount animations with reduced ambient effects",
);
assert.match(
  cyoaChoicesSource,
  /extra: \{ cyoaChoices: \[\] \}[\s\S]{0,900}if \(impersonated\)[\s\S]{0,160}connectionId: null/u,
  "selecting a CYOA prompt must consume it permanently and follow impersonation with a character reply",
);
assert.match(
  assignedSweepChatAreaSource,
  /savedUrl \?\? \(chat\.mode === "roleplay" \? useUIStore\.getState\(\)\.defaultRoleplayBackground : null\)/u,
  "new Roleplay chats must inherit the explicitly selected default background",
);
assert.match(
  chatMessageSource,
  /\[cycleMergedNarratorAvatars, isMergedGroup, mergedCycleKey, mergedAvatars\.length, mergedNameColors\.length\]/u,
  "Narrator cycling must reset when active character IDs change without changing count",
);
assert.match(
  chatMessageSource,
  /const applyMergedCycleIndex = \(index: number\) => \{[\s\S]{0,1200}applyMergedCycleIndex\(0\);/u,
  "Narrator cycling must immediately apply its reset index to avatar and name opacity",
);
assert.match(
  chatMessageSource,
  /const mergedNameColors = useMemo\(\(\) => mergedAvatars\.map\(\(avatar\) => avatar\.nameColor\)/u,
  "Merged Narrator avatar and name-color indexes must come from the same renderable character list",
);
assert.match(
  chatMessageSource,
  /mergedNameColors\.length === 0 \? \([\s\S]{0,180}<NameColorText color=\{msgNameColor\}>\{localizeUi\("ui\.chat\.chatmessage\.narrator"\)\}/u,
  "Merged messages must retain a Narrator label when no active character avatar resolves",
);
assert.match(
  chatMessageSource,
  /useCompactRectangleAvatar \|\| !cycleMergedNarratorAvatars[\s\S]{0,180}rectangleSafeCropStyle/u,
  "Static compact Narrator avatars must not receive positioned crop dimensions that break their flex layout",
);
assert.match(
  chatMessageSource,
  /cycleMergedNarratorAvatars \? "absolute inset-0 w-full" : "relative w-0 min-w-0 flex-1"/u,
  "Disabling Narrator cycling must place active avatars together",
);

// The HUD menu offers Stop Agents only while agents run, styled like the actions beside it.
const roleplayActionsSource = readFileSync(
  new URL("../../../packages/client/src/components/chat/RoleplayHUDActionsMenu.tsx", import.meta.url),
  "utf8",
);
assert.match(roleplayActionsSource, /showStopAgentsAction = isAgentProcessing && !!onStopAgents/u);
assert.match(roleplayActionsSource, /ui\.chat\.roleplayhudactionsmenu\.stopAgents/u);
assert.doesNotMatch(
  roleplayActionsSource,
  /stopAgents[\s\S]{0,700}text-\[var\(--destructive\)\]/u,
  "Stop Agents should use the same neutral action styling as its neighboring controls",
);
