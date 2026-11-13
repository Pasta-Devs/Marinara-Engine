// The per-agent cards in Chat Settings' Agents section show and save their own settings. The drawer is being split
// into one component per card (#9119), so each card is covered here before it moves.
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { openChatSettings } from "./chat-settings-tools.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/** The downloadable agents these cards belong to, as the agent catalog would list them. */
const AGENTS = [
  { id: "card-evolution-auditor", name: "Card Evolution Auditor", category: "writer", phase: "post_processing" },
];

async function createRoleplayChat(request: APIRequestContext, activeAgentIds: string[], extra = {}) {
  const response = await request.post("/api/chats", {
    data: { name: "Agent cards", mode: "roleplay", characterIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  const metadata = { enableAgents: true, activeAgentIds, ...extra };
  expect((await request.patch(`/api/chats/${chat.id}/metadata`, { data: metadata })).ok()).toBeTruthy();
  return chat.id;
}

async function openApp(page: Page, chatId: string) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.route("**/api/capability-packages/agents", (route) =>
    route.fulfill({
      json: AGENTS.map((agent) => ({
        ...agent,
        description: `${agent.name} test agent.`,
        author: "Pasta Devs",
        execution: "host",
        enabledByDefault: false,
        modeAllowlist: ["roleplay"],
        defaultPromptTemplate: "Test prompt.",
      })),
    }),
  );
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/agents", (route) => route.fulfill({ json: [] }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
  });
  await page.addInitScript(
    ({ id, version }) => {
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem("marinara-active-chat-id", id);
    },
    { id: chatId, version: APP_VERSION },
  );
  await page.goto("/");
  await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible();
}

/** Opens Chat Settings' Agents section and returns the named agent's card, expanded. */
async function openAgentCard(page: Page, chatId: string, agentId: string) {
  const settings = await openChatSettings(page);
  const agents = settings.locator('[data-drawer="roleplay-agents"]');
  const toggle = agents.locator(":scope > .mari-drawer__header [data-drawer-toggle]");
  await toggle.scrollIntoViewIfNeeded();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  const card = agents.locator(`#chat-settings-agent-menu-${chatId}-${agentId}`.replace(/[^a-zA-Z0-9_#-]/g, "-"));
  await card.scrollIntoViewIfNeeded();
  const cardToggle = card.locator("[aria-expanded]").first();
  if ((await cardToggle.getAttribute("aria-expanded")) !== "true") await cardToggle.click();
  return { settings, card };
}

async function readAgentDetailId(page: Page) {
  return page.evaluate(async () => {
    const module = (await import("/src/stores/ui.store.ts" as string)) as {
      useUIStore: { getState(): { agentDetailId: string | null } };
    };
    return module.useUIStore.getState().agentDetailId;
  });
}

test("Card Evolution Auditor's card closes Chat Settings and opens the auditor's setup", async ({ page, request }) => {
  const chatId = await createRoleplayChat(request, ["card-evolution-auditor"]);
  try {
    await openApp(page, chatId);
    const { settings, card } = await openAgentCard(page, chatId, "card-evolution-auditor");
    await card.getByRole("button", { name: "Open Auditor Setup", exact: true }).click();
    await expect(settings).toBeHidden();
    await expect.poll(() => readAgentDetailId(page)).toBe("card-evolution-auditor");
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});
