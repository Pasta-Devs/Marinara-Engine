import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
async function prepare(page: Page, state = {}) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    appAccentPulseMode: false,
    ...state,
  });
  await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
}

for (const kind of ["character", "persona", "lorebook"] as const) {
  test(`${kind} folder follows the sidebar sort and search`, async ({ page, request }, testInfo) => {
    const resource = kind === "persona" ? "characters/personas" : `${kind}s`;
    const folders =
      kind === "character"
        ? "characters/groups"
        : kind === "persona"
          ? "characters/persona-groups"
          : "library-folders/lorebooks";
    const prefix = `Sweep-${Date.now()}`;
    const ids: string[] = [];
    let folderId = "";
    try {
      for (const name of [`${prefix} Zebra`, `${prefix} Alpha`]) {
        const response = await request.post(`/api/${resource}`, {
          data: kind === "character" ? { data: { name } } : { name },
        });
        expect(response.ok()).toBeTruthy();
        ids.push((await response.json()).id);
      }
      const response = await request.post(`/api/${folders}`, {
        data: {
          name: `${prefix} folder`,
          ...(kind === "character" ? { characterIds: ids } : kind === "persona" ? { personaIds: ids } : {}),
        },
      });
      expect(response.ok()).toBeTruthy();
      folderId = (await response.json()).id;
      if (kind === "lorebook") {
        expect(
          (await request.post("/api/library-folders/lorebooks/move", { data: { folderId, itemIds: ids } })).ok(),
        ).toBeTruthy();
      }
      await prepare(page);
      await page.goto("/");
      await page.locator(`[data-tour="panel-${kind}s"]`).click();
      const folder = page.locator(`[data-${kind}-folder-id="${folderId}"]`);
      const header = folder.locator(':scope > [role="button"]');
      if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
      const rows = folder.locator(`[data-touch-drag-card="${kind}"]`);
      const sort = page.locator('select.mari-chrome-sort-field[title="Sort order"]:visible');
      await sort.selectOption("name-asc");
      await expect(rows).toHaveCount(2);
      await expect(rows.nth(0)).toContainText(`${prefix} Alpha`);
      await expect(rows.nth(1)).toContainText(`${prefix} Zebra`);
      await page.screenshot({ path: testInfo.outputPath(`${kind}-folder-sort.png`) });
      await sort.selectOption("name-desc");
      await expect(rows.nth(0)).toContainText(`${prefix} Zebra`);
      await sort.selectOption("newest");
      await expect(rows.nth(0)).toContainText(`${prefix} Alpha`);
      await sort.selectOption("oldest");
      await expect(rows.nth(0)).toContainText(`${prefix} Zebra`);
      const search = page.getByRole("textbox", { name: `Search ${kind}s`, exact: true });
      await search.fill(`${prefix} Alpha`);
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText(`${prefix} Alpha`);
      const saved = await (await request.get(`/api/${folders}${kind === "lorebook" ? "" : "/list"}`)).json();
      const entry = saved.find((item: { id: string }) => item.id === folderId);
      const members =
        kind === "character"
          ? JSON.parse(entry.characterIds)
          : kind === "persona"
            ? JSON.parse(entry.personaIds)
            : entry.itemIds;
      expect(members).toEqual(ids);
    } finally {
      if (folderId) await request.delete(`/api/${folders}/${folderId}`);
      for (const id of ids) await request.delete(`/api/${resource}/${id}`);
    }
  });
}

for (const style of ["classic", "bubble"] as const) {
  test(`scene invitations wait for a click and survive cancellation and reload (${style})`, async ({
    page,
    request,
  }, testInfo) => {
    const chat = await (
      await request.post("/api/chats", { data: { name: "Scene invitation proof", mode: "conversation" } })
    ).json();
    try {
      const message = await (
        await request.post(`/api/chats/${chat.id}/messages`, {
          data: { role: "assistant", content: "The laboratory door is open. We can discuss the experiment first." },
        })
      ).json();
      expect(
        (
          await request.patch(`/api/chats/${chat.id}/messages/${message.id}/extra`, {
            data: {
              sceneRequest: {
                prompt: "A quiet laboratory",
                planHint: "Inspect the instruments",
                initiatorCharName: "Dottore",
              },
            },
          })
        ).ok(),
      ).toBeTruthy();
      await prepare(page, { conversationMessageStyle: style, theme: style === "classic" ? "light" : "dark" });
      await page.addInitScript((id) => localStorage.setItem("marinara-active-chat-id", id), chat.id);
      let planningCalls = 0;
      await page.route("**/api/scene/plan", (route) => {
        planningCalls++;
        return route.fulfill({ status: 500, json: { error: "Fixture planning failure" } });
      });
      await page.goto("/");
      const setup = page.getByRole("dialog", { name: "Scene Prompt Setup", exact: true });
      const invitation = page.getByRole("button", { name: "Set up scene", exact: true });
      await expect(invitation).toBeVisible();
      await expect(setup).toBeHidden();
      await expect(
        page.getByText("The laboratory door is open. We can discuss the experiment first.", { exact: true }),
      ).toBeVisible();
      expect(planningCalls).toBe(0);
      await page.screenshot({ path: testInfo.outputPath(`scene-invitation-${style}.png`) });
      await invitation.click();
      await expect(setup).toBeVisible();
      await setup.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(setup).toBeHidden();
      await expect(invitation).toBeEnabled();
      await page.reload();
      await expect(invitation).toBeVisible();
      await expect(setup).toBeHidden();
      await invitation.click();
      await setup.getByRole("button", { name: "Plan Scene", exact: true }).click();
      await expect.poll(() => planningCalls).toBe(1);
      await expect(invitation).toBeEnabled();
    } finally {
      await request.delete(`/api/chats/${chat.id}`);
    }
  });
}

test("extra actions precede emoji and remain available without sending", async ({
  page,
  request,
  isMobile,
}, testInfo) => {
  const chat = await (await request.post("/api/chats", { data: { name: "Composer proof", mode: "roleplay" } })).json();
  try {
    await prepare(page, { showQuickRepliesMenu: true, showQuickReplyPostOnly: true, showQuickReplyGuide: true });
    await page.addInitScript((id) => localStorage.setItem("marinara-active-chat-id", id), chat.id);
    await page.goto("/");
    await page.locator("textarea[data-chat-composer]").fill("Inspect the laboratory.");
    const actions = page.getByRole("button", { name: "Quick replies", exact: true });
    await expect(actions).toBeVisible();
    const emoji = page.getByRole("button", { name: "Emoji", exact: true });
    const actionBox = (await actions.boundingBox())!;
    const sendBox = (await page.locator(".mari-chat-send-btn").boundingBox())!;
    expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(sendBox.x);
    if (!isMobile) {
      const emojiBox = (await emoji.boundingBox())!;
      expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(emojiBox.x);
    }
    await actions.click();
    await expect(page.getByRole("menuitem", { name: /Post Only/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Guided/i })).toBeVisible();
    await expect(page.getByRole("menuitem").last()).toHaveCSS("opacity", "1");
    await page.screenshot({ path: testInfo.outputPath("extra-actions-menu.png") });
    expect(await (await request.get(`/api/chats/${chat.id}/messages`)).json()).toEqual([]);
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});
