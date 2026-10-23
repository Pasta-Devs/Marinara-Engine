import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { clickTopbarPanel } from "./topbar-navigation.js";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const CUSTOM = {
  id: "custom-fixture",
  type: "custom-fixture",
  name: "My Director",
  description: "Custom writing helper",
  phase: "post_processing",
  enabled: "true",
  connectionId: null,
  imagePath: null,
  promptTemplate: "Help write the story.",
  settings: "{}",
  createdAt: "2026-10-23T00:00:00.000Z",
  updatedAt: "2026-10-23T00:00:00.000Z",
};
const OFFICIAL = [
  { id: "director", name: "Narrative Director", category: "writer" },
  { id: "spotify", name: "Music DJ", category: "misc" },
  { id: "haptic", name: "Haptic", category: "misc" },
  {
    id: "conversation-helper",
    name: "Conversation Helper",
    category: "misc",
    execution: "feature",
    modeAllowlist: ["conversation"],
  },
].map((agent) => ({
  packageId: agent.id,
  description: "Official package fixture",
  phase: "post_processing",
  enabledByDefault: false,
  defaultPromptTemplate: "",
  ...agent,
}));

async function openAgents(
  page: Page,
  {
    folder = false,
    theme = "dark",
    registryGate,
  }: { folder?: boolean; theme?: "dark" | "light"; registryGate?: Promise<void> } = {},
) {
  const copies: Record<string, unknown>[] = [];
  const agents = [
    CUSTOM,
    { ...CUSTOM, id: "configured-director", type: "director", name: "My renamed official agent" },
  ];
  await isolateSyncedUISettings(page);
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, theme });
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), APP_VERSION);
  await page.route("**/api/capability-packages/agents", async (route) => {
    await registryGate;
    await route.fulfill({ json: OFFICIAL });
  });
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/catalog", (route) =>
    route.fulfill({ json: { schemaVersion: 1, generatedAt: "2026-10-23T00:00:00.000Z", packages: [] } }),
  );
  await page.route("**/api/library-folders/agents", (route) =>
    route.fulfill({
      json: folder
        ? [
            {
              id: "folder-fixture",
              scope: "agents",
              name: "Writers",
              collapsed: false,
              sortOrder: 0,
              itemIds: ["director", CUSTOM.id],
            },
          ]
        : [],
    }),
  );
  await page.route("**/api/agents", async (route) => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      copies.push(input);
      const copied = { ...CUSTOM, ...input, id: "copied-fixture", settings: JSON.stringify(input.settings) };
      agents.push(copied);
      await route.fulfill({ json: copied });
    } else await route.fulfill({ json: agents });
  });
  await page.goto("/");
  await clickTopbarPanel(page, "agents");
  const panel = page.getByRole("region", { name: "Agents", exact: true });
  if (!registryGate) await expect(panel.locator("[data-agent-card]")).toHaveCount(5);
  return { panel, copies };
}

test("Agent mode filters match runtime availability and combine with search", async ({ page }, info) => {
  const { panel } = await openAgents(page);
  const cards = panel.locator("[data-agent-card]");
  const names = async () =>
    (await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-agent-name")))).sort();
  const modes = panel.getByRole("group", { name: "Filter agents by supported chat mode" });
  await modes.getByRole("button", { name: "Conversation", exact: true }).click();
  await page.screenshot({ path: info.outputPath("conversation-filter.png") });
  await expect.poll(names).toEqual(["Conversation Helper", "Haptic", "My Director"]);
  await modes.getByRole("button", { name: "Roleplay", exact: true }).click();
  await expect.poll(names).toEqual(["Haptic", "Music DJ", "My Director", "Narrative Director"]);
  await modes.getByRole("button", { name: "Game", exact: true }).click();
  await expect.poll(names).toEqual(["Haptic", "Music DJ", "My Director"]);
  const search = panel.getByPlaceholder("Search agents", { exact: true });
  await search.fill("Director");
  await expect.poll(names).toEqual(["My Director"]);
  await modes.getByRole("button", { name: "All", exact: true }).click();
  await expect.poll(names).toEqual(["My Director", "Narrative Director"]);
  await search.fill("no match");
  await expect(cards).toHaveCount(0);
  await search.fill("");
  await expect(cards).toHaveCount(5);
});

for (const folder of [false, true]) {
  test(`Only custom agents can be copied in the ${folder ? "folder" : "root"} list`, async ({ page }, info) => {
    const { panel, copies } = await openAgents(page, { folder });
    if (folder) await panel.getByText("Writers", { exact: true }).click();
    const official = panel.locator('[data-agent-card][data-agent-name="Narrative Director"]');
    const custom = panel.locator('[data-agent-card][data-agent-name="My Director"]');
    await expect(official).toBeVisible();
    await expect(custom).toBeVisible();
    if (folder) {
      const modes = panel.getByRole("group", { name: "Filter agents by supported chat mode" });
      await modes.getByRole("button", { name: "Conversation", exact: true }).click();
      await expect(official).toHaveCount(0);
      await expect(custom).toBeVisible();
      await modes.getByRole("button", { name: "All", exact: true }).click();
      await expect(official).toBeVisible();
    }
    await official.hover();
    await page.screenshot({ path: info.outputPath("copy-actions.png") });
    await expect(
      panel
        .locator('[data-agent-card]:not([data-agent-name="My Director"])')
        .getByRole("button", { name: "Copy agent", exact: true }),
    ).toHaveCount(0);
    await custom.getByRole("button", { name: "Copy agent", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => copies.length).toBe(1);
    expect(copies[0]?.name).toBe("My Director (Copy)");
    await expect(page.getByRole("button", { name: "Back to agents", exact: true })).toBeVisible();
    await expect(page.getByRole("note")).toHaveCount(0);
  });
}

test("Copy waits for the package registry before classifying agents", async ({ page }) => {
  let releaseRegistry!: () => void;
  const registryGate = new Promise<void>((resolve) => {
    releaseRegistry = resolve;
  });
  try {
    const { panel, copies } = await openAgents(page, { registryGate });
    const custom = panel.locator('[data-agent-card][data-agent-name="My Director"]');
    await expect(custom).toBeVisible();
    await expect(panel.getByRole("button", { name: "Copy agent", exact: true })).toHaveCount(0);
    releaseRegistry();
    await expect(panel.locator("[data-agent-card]")).toHaveCount(5);
    const copy = custom.getByRole("button", { name: "Copy agent", exact: true });
    await copy.focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => copies.length).toBe(1);
  } finally {
    releaseRegistry();
  }
});

for (const theme of ["dark", "light"] as const) {
  test(`New custom agent explains limits and dismisses without losing draft in ${theme} theme`, async ({
    page,
  }, info) => {
    const { panel } = await openAgents(page, { theme });
    await panel.getByRole("button", { name: "New", exact: true }).click();
    const description = page.getByPlaceholder("What does this agent do…", { exact: true });
    await description.fill("My unchanged draft 🎭");
    await page.screenshot({ path: info.outputPath("new-agent-notice.png") });
    const notice = page.getByRole("note");
    await expect(notice).toContainText("Custom agents may have fewer features than official agents.");
    await expect(notice).toContainText("dedicated backend code");
    const noticeBounds = await notice.boundingBox();
    const descriptionBounds = await description.boundingBox();
    expect(noticeBounds!.y + noticeBounds!.height).toBeLessThan(descriptionBounds!.y);
    expect(await notice.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    const dismiss = notice.getByRole("button", { name: "Dismiss custom-agent information", exact: true });
    await dismiss.focus();
    await page.keyboard.press("Enter");
    await expect(notice).toHaveCount(0);
    await expect(description).toHaveValue("My unchanged draft 🎭");
  });
}
