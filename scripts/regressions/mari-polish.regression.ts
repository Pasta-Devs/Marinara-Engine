// Mari panel polish batch (#5741 header combine, #5742 chip scroll affordance,
// #5743 compact mobile bookmarks, #5752 New-chat discoverability, #5753 chips
// slot hygiene, #5754 same-frame verification without the apology round).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveWorkspaceMutationVerification,
  type WorkspaceCommandResult,
} from "../../packages/server/src/services/professor-mari/workspace-agent.service.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");
const flatten = (source: string) => source.replace(/\s+/gu, " ");

// ── #5754 functional: a read in the SAME batch as the write verifies it ─────
// This ordering fact is what lets the prompt teach zero-extra-round
// verification - if it ever stops holding, the same-frame guidance breaks.
const writeResult: WorkspaceCommandResult = {
  id: "w1",
  name: "write",
  input: { path: "notes/a.md", content: "x" },
  output: "ok",
  success: true,
};
const readResult: WorkspaceCommandResult = {
  id: "r1",
  name: "read",
  input: { path: "notes/a.md" },
  output: "x",
  success: true,
};
assert.equal(resolveWorkspaceMutationVerification([]), "none");
assert.equal(resolveWorkspaceMutationVerification([writeResult]), "unverified");
assert.equal(
  resolveWorkspaceMutationVerification([writeResult, readResult]),
  "verified",
  "a same-batch read AFTER the write must count as verification",
);
assert.equal(
  resolveWorkspaceMutationVerification([readResult, writeResult]),
  "unverified",
  "a read BEFORE the write proves nothing about the written state",
);

// ── #5754 prompt + coaching: same-frame read taught, apology banned ─────────
const workspaceAgent = readSource("packages/server/src/services/professor-mari/workspace-agent.service.ts");
const workspaceAgentFlat = flatten(workspaceAgent);
assert.match(workspaceAgent, /include the confirmatory read in the SAME response whenever you can/u);
assert.match(workspaceAgent, /never present it with an apology \("Oops", "my bad"\)/u);
// The direct-request few-shot models write + read in ONE frame.
assert.ok(
  workspaceAgentFlat.includes(
    '"apply":true}},{"name":"app_data","arguments":{"action":"character.get","characterId":"gundorfson-id"}}],"stop":false}',
  ),
  "the mutating few-shot must carry its confirmatory read in the same frame",
);
// Both coaching surfaces forbid the apology framing.
assert.match(workspaceAgent, /matter-of-factly, never as an apology or correction/u);
assert.match(workspaceAgent, /never apologize or present the check as fixing a mistake/u);
// The verification guard itself is untouched.
assert.match(
  workspaceAgent,
  /Run a confirmatory read now\. Only claim completion after that read confirms the change\./u,
);

// ── #5753: the chips/plan slots are cleared only by their own chat ──────────
const useGenerate = readSource("packages/client/src/hooks/use-generate.ts");
const useGenerateFlat = flatten(useGenerate);
assert.ok(
  useGenerateFlat.includes("if (agentState.mariChipsChatId === params.chatId) clearMariChips();"),
  "a regular chat's generation must never clear another chat's Mari chips",
);
assert.ok(useGenerateFlat.includes("if (agentState.mariPlanChatId === params.chatId) clearMariPlan();"));
assert.ok(
  !useGenerateFlat.includes("clearCyoaChoices(); clearMariChips();"),
  "the unconditional app-wide chip clear must stay gone",
);
// The suggestions-disabled mount sweeps are deleted in all three composers -
// rendering already gates on the setting, and the sweeps wiped even the
// held-proposal Accept chip the delivery path deliberately exempts.
for (const file of [
  "packages/client/src/components/chat/HomeProfessorMariChat.tsx",
  "packages/client/src/components/chat/ChatInput.tsx",
  "packages/client/src/components/chat/ConversationInput.tsx",
]) {
  assert.ok(
    !flatten(readSource(file)).includes("if (professorMariSuggestionsEnabled) return; clearMariChips();"),
    `${file} must not sweep the chips slot on mount`,
  );
}
const mariChat = readSource("packages/client/src/components/chat/HomeProfessorMariChat.tsx");
const mariChatFlat = flatten(mariChat);
assert.doesNotMatch(mariChat, /clearSuggestions/u, "the dead loadMessages option stays deleted");

// ── #5752: New chat is discoverable ─────────────────────────────────────────
const enJson = JSON.parse(readSource("packages/client/src/localization/locales/en.json")) as Record<string, string>;
assert.equal(enJson["ui.chat.homeprofessormarichat.newChat"], "New chat");
assert.ok("ui.chat.homeprofessormarichat.newChatSavesTheCurrentChatHere" in enJson);
assert.ok("home.professorMari.newChat" in enJson);
assert.ok(!("ui.chat.homeprofessormarichat.restart" in enJson), "the misleading Restart label is gone");
assert.ok(!("ui.chat.homeprofessormarichat.restartSavesTheCurrentChatHere" in enJson));
assert.ok(!("home.professorMari.restart" in enJson));
// The Chats popover carries its own New chat button.
assert.ok(mariChatFlat.includes("setChatHistoryOpen(false); void runRestart();"));

// ── #5741: Skills and Memories share one header button ──────────────────────
assert.ok("ui.chat.homeprofessormarichat.skillsAndMemories" in enJson);
assert.ok("ui.chat.homeprofessormarichat.openSkillsAndMemories" in enJson);
assert.match(mariChat, /activeSkillCount \+ activeMemoryCount/u, "the combined button sums both badges");
assert.match(mariChat, /libraryMenuOpen/u);
// The menu rows still open the original panes with their own badges.
assert.ok(mariChatFlat.includes("setLibraryMenuOpen(false); toggleSkillsMenu();"));
assert.ok(mariChatFlat.includes("setLibraryMenuOpen(false); toggleMemoriesMenu();"));

// ── #5742: the chip row is reachable by mouse and shows its overflow ────────
const chipsComponent = readSource("packages/client/src/components/chat/MariSuggestionChips.tsx");
const chipsFlat = flatten(chipsComponent);
// Mouse drag translates to scrollLeft; touch and pen keep native panning.
assert.ok(chipsFlat.includes('if (event.pointerType !== "mouse" || event.button !== 0) return;'));
assert.match(chipsComponent, /CHIP_DRAG_THRESHOLD_PX/u, "a plain click must never register as a drag");
assert.match(chipsComponent, /setPointerCapture/u);
// One click is swallowed after a real drag so releasing over a chip scrolls
// instead of firing it.
assert.match(chipsComponent, /wasDraggedRef/u);
// Edge fades track the live scroll position per side.
assert.match(chipsComponent, /data-fade-left/u);
assert.match(chipsComponent, /data-fade-right/u);
const globalsCss = readSource("packages/client/src/styles/globals.css");
assert.match(globalsCss, /\.mari-suggestion-chips\[data-fade-left="true"\]/u);
assert.match(globalsCss, /--mari-suggestion-chips-fade/u);
assert.match(
  globalsCss,
  /mask-image: linear-gradient\(/u,
  "the fade is a mask, never a solid overlay over chat backgrounds",
);

// ── #5743: mobile bookmarks collapse to a compact tab-strip button ──────────
const browserHub = readSource("packages/client/src/components/chat/HomeBrowserHub.tsx");
const browserHubFlat = flatten(browserHub);
assert.match(browserHub, /mobileBookmarksTriggerRef/u);
assert.ok(
  browserHubFlat.includes('aria-label={t("home.browser.bookmarksCompact")}'),
  "the compact trigger is labeled for assistive tech",
);
// Desktop never shows the compact button; mobile never renders the full bar.
assert.match(browserHub, /focus-visible:ring-\[var\(--marinara-app-accent-solid\)\] sm:hidden/u);
assert.ok(
  browserHubFlat.includes(
    'className="hidden min-h-8 items-center border-t border-[var(--border)]/45 px-2 sm:flex sm:min-h-9 sm:px-3"',
  ),
  "the full bookmarks bar is desktop-only - no empty row remains at phone widths",
);
// The per-surface visibility settings still gate both surfaces - no new toggle.
assert.ok(browserHubFlat.includes('activeTab !== "home" && !showHomeBrowserMobileBookmarksOnOtherTabs && "hidden"'));
assert.ok(
  browserHubFlat.includes('mobileBookmarksOpen && (activeTab === "home" || showHomeBrowserMobileBookmarksOnOtherTabs)'),
);
assert.ok("home.browser.bookmarksCompact" in enJson);

console.log("Mari polish regression passed.");
