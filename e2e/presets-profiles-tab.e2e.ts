// #9260: the Presets panel's Profiles tab lists settings profiles and opens them in the center editor, which saves on
// Back; Create picks the mode with pills. The Prompts tab's select mode gains Select all.
import { readFileSync } from "node:fs";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { seedUIState } from "./ui-state-fixture.js";
import { clickTopbarPanel } from "./topbar-navigation.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

type Profile = { id: string; name: string; mode: string };

async function listProfiles(request: APIRequestContext) {
  return (await (await request.get("/api/chat-presets")).json()) as Profile[];
}

/** On a phone, Back from a center editor already reopens the panel; the topbar button would toggle it shut. */
async function openProfilesTab(page: Page) {
  const tab = page.getByRole("button", { name: "Profiles", exact: true });
  if (!(await tab.isVisible())) await clickTopbarPanel(page, "presets");
  await tab.click();
}

test("the Profiles tab edits and creates settings profiles in the center editor", async ({
  page,
  request,
}, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now().toString(36)}`;
  const original = `Tab profile ${suffix}`;
  const renamed = `Tab profile renamed ${suffix}`;
  const created = `Tab profile new ${suffix}`;
  const response = await request.post("/api/chat-presets", {
    data: { name: original, mode: "roleplay", settings: {} },
  });
  expect(response.ok()).toBeTruthy();
  const profile = (await response.json()) as Profile;

  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["roleplay", "conversation", "game"],
  });
  await page.addInitScript((seen) => localStorage.setItem("marinara:whats-new:seen-version", seen), version);
  try {
    await page.goto("/");
    const skip = page.getByRole("button", { name: "Skip", exact: true });
    if (await skip.isVisible()) await skip.click();
    await clickTopbarPanel(page, "presets");

    // Prompts: Select all ticks every listed preset.
    await page.getByRole("button", { name: "Select presets" }).click();
    const selectAllPresets = page.getByLabel("Select all presets");
    await selectAllPresets.check();
    await expect(selectAllPresets).toBeChecked();
    await page.getByRole("button", { name: "Exit preset selection mode" }).click();

    // Profiles: open the profile, rename it, and Back saves the rename.
    await openProfilesTab(page);
    // The row's hover actions sit over its middle in a narrow panel, so click the name side.
    await page
      .getByRole("button", { name: new RegExp(original) })
      .first()
      .click({ position: { x: 24, y: 24 } });
    const title = page.locator(".mari-editor-title-input");
    await expect(title).toHaveValue(original);
    const back = page.locator('.mari-editor-header button[aria-label^="Back to"]');
    // An empty name refuses the leave and says why, keeping the draft open.
    await title.fill("");
    await back.click();
    await expect(page.getByText("Give the profile a name before leaving.")).toBeVisible();
    await expect(title).toBeVisible();
    await title.fill(renamed);
    await back.click();
    await expect(title).toBeHidden();
    await expect.poll(async () => (await listProfiles(request)).find((p) => p.id === profile.id)?.name).toBe(renamed);

    // Create: the mode pills choose the new profile's mode, and Done closes the editor.
    await openProfilesTab(page);
    await page.getByRole("button", { name: "Create settings profile" }).first().click();
    await expect(title).toBeVisible();
    await page
      .locator(".mari-editor-shell")
      .getByRole("group", { name: "Chat mode" })
      .getByRole("button", { name: "Conversation" })
      .click();
    await title.fill(created);
    await page.getByRole("button", { name: "Save and choose chats…" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Done", exact: true }).click();
    await expect(title).toBeHidden();
    await expect
      .poll(async () => (await listProfiles(request)).find((p) => p.name === created)?.mode)
      .toBe("conversation");
  } finally {
    for (const p of await listProfiles(request)) {
      if (p.name.includes(suffix)) await request.delete(`/api/chat-presets/${p.id}`);
    }
  }
});
