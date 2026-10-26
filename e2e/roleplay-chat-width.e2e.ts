import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { clickTopbarPanel } from "./topbar-navigation.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const settingsPath = "/api/app-settings/ui";
const column = '[data-roleplay-chat-column="true"]';
type PublicUiHost = { __MARINARA_HOST__?: { stores: { ui: PageUiStoreModule["useUIStore"] } } };

async function fixture(request: APIRequestContext) {
  const created: string[] = [];
  const cleanup = async () => {
    for (const path of created) await request.delete(path);
  };
  const post = async (path: string, data: unknown) => {
    const response = await request.post(path, { data });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  try {
    const character = await post("/api/characters", { data: { name: "Width fixture", first_mes: "" } });
    created.unshift(`/api/characters/${character.id}`);
    const chat = await post("/api/chats", {
      name: "Roleplay width proof",
      mode: "roleplay",
      characterIds: [character.id],
    });
    created.unshift(`/api/chats/${chat.id}`);
    expect(
      (
        await request.patch(`/api/chats/${chat.id}/metadata`, {
          data: { enableAgents: true, activeAgentIds: [], windowLayout: null, chatSettingsHintDismissed: true },
        })
      ).ok(),
    ).toBe(true);
    await post(`/api/chats/${chat.id}/messages`, {
      role: "assistant",
      characterId: character.id,
      content: "A long archive entry. ".repeat(35) + "ARCHIVE_".repeat(35),
    });
    await post(`/api/chats/${chat.id}/messages`, {
      role: "assistant",
      characterId: character.id,
      content: "The same archivist adds a second note before you answer.",
    });
    await post(`/api/chats/${chat.id}/messages`, { role: "user", content: "I keep the lantern beside the map." });
    await post(`/api/chats/${chat.id}/messages`, { role: "narrator", content: "Rain crosses the tall windows." });
    return { chat, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

async function appearance(page: Page) {
  await clickTopbarPanel(page, "settings");
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  await page
    .getByRole("group", { name: "Appearance by chat mode", exact: true })
    .getByRole("button", { name: "Roleplay", exact: true })
    .click();
  await page.getByText("Custom chat width", { exact: true }).scrollIntoViewIfNeeded();
}

async function layout(page: Page) {
  return page.evaluate(() => {
    const box = (node: Element) => {
      const { left, right, width } = node.getBoundingClientRect();
      return { left, right, width };
    };
    const history = document.querySelector<HTMLElement>("#roleplay-chat-history")!;
    return {
      area: box(document.querySelector('[data-component="CenterContent"]')!),
      composer: box(document.querySelector('[data-roleplay-chat-column="true"]')!),
      bodies: [...document.querySelectorAll(".mari-roleplay-message-body, .rpg-narrator-msg > div:first-child")].map(
        box,
      ),
      avatars: [...document.querySelectorAll(".mari-roleplay-message-row > .mari-message-avatar")].map(box),
      scrollbar: history.offsetWidth - history.clientWidth,
      overflow: Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        history.scrollWidth - history.clientWidth,
      ),
    };
  });
}

async function withinPane(page: Page, desktop: boolean) {
  await expect(async () => {
    const geometry = await layout(page);
    await page.waitForTimeout(150);
    expect(await layout(page)).toEqual(geometry);
    expect(geometry.overflow).toBeLessThanOrEqual(geometry.scrollbar);
    for (const box of [geometry.composer, ...geometry.bodies, ...geometry.avatars]) {
      expect(box.left).toBeGreaterThanOrEqual(geometry.area.left - 1);
      expect(box.right).toBeLessThanOrEqual(geometry.area.right + 1);
    }
    if (desktop)
      for (const body of geometry.bodies) {
        expect(Math.abs(body.left - geometry.composer.left)).toBeLessThanOrEqual(1 + geometry.scrollbar);
        expect(Math.abs(body.right - geometry.composer.right)).toBeLessThanOrEqual(1 + geometry.scrollbar);
      }
  }).toPass();
  return layout(page);
}

async function ui(page: Page, values: Record<string, unknown>) {
  await page.evaluate(async (next) => {
    const { ensureMarinaraHost } = await import("/src/lib/marinara-host.ts" as string);
    await ensureMarinaraHost();
    const store = (globalThis as PublicUiHost).__MARINARA_HOST__?.stores.ui;
    if (!store) throw new Error("The Engine's public UI store is unavailable.");
    store.setState(next);
  }, values);
}

for (const theme of ["dark", "light"] as const)
  test(`Roleplay custom width keeps text, avatars and composer usable · ${theme}`, async ({
    page,
    request,
  }, testInfo) => {
    const desktop = testInfo.project.name.includes("desktop");
    if (desktop) await page.setViewportSize({ width: 1920, height: 1080 });
    const original = await (await request.get(settingsPath)).json();
    const { chat, cleanup } = await fixture(request);
    try {
      expect((await request.put(settingsPath, { data: { value: "" } })).ok()).toBe(true);
      await seedUIState(
        page,
        {
          hasCompletedOnboarding: true,
          theme,
          sidebarOpen: false,
          rightPanelOpen: false,
          appAccentPulseMode: false,
          chatHelpSeenModes: ["roleplay"],
          roleplayChatPosition: "center",
          roleplayDisplayStyle: "classic",
          roleplayAvatarStyle: "circles",
          roleplayAvatarScale: 1,
          roleplayChatWidthPercent: null,
        },
        "if-missing",
      );
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id: chat.id, version },
      );
      await page.goto("/");
      await expect(page.locator(column)).toBeVisible();
      await expect(page.locator(".mari-roleplay-message-body")).toHaveCount(3);
      const baseline = await withinPane(page, desktop);
      await appearance(page);
      await expect(page.getByRole("checkbox", { name: "Custom chat width", exact: true })).not.toBeChecked();
      await page.getByText("Custom chat width", { exact: true }).click();
      const slider = page.getByRole("slider", { name: "Chat area width", exact: true });
      await expect(slider).toHaveAttribute("min", "40");
      await expect(slider).toHaveAttribute("max", "100");
      await expect(slider).toHaveValue("75");
      await slider.press("Home");
      await expect(slider).toHaveValue("40");
      await clickTopbarPanel(page, "settings");
      const narrow = await withinPane(page, desktop);
      await appearance(page);
      await slider.press("End");
      await expect(slider).toHaveValue("100");
      await page.screenshot({
        path: testInfo.outputPath(`roleplay-width-controls-${theme}.png`),
        animations: "disabled",
      });
      await clickTopbarPanel(page, "settings");
      await expect.poll(async () => (await layout(page)).composer.width).toBeGreaterThan(narrow.composer.width + 40);
      const wide = await withinPane(page, desktop);
      expect(wide.bodies[0]!.width).toBeGreaterThan(narrow.bodies[0]!.width);
      await page.screenshot({ path: testInfo.outputPath(`roleplay-width-wide-${theme}.png`), animations: "disabled" });
      await expect
        .poll(
          async () =>
            JSON.parse((await (await request.get(settingsPath)).json()).value || "{}").roleplayChatWidthPercent,
        )
        .toBe(100);
      await page.reload();
      await expect(page.locator(column)).toBeVisible();
      expect((await withinPane(page, desktop)).composer.width).toBeCloseTo(wide.composer.width, 0);
      if (desktop) {
        for (const style of ["panel", "circles", "rectangles", "none"])
          for (const percent of [100, 95])
            await test.step(`${style} grouped rows at ${percent}%`, async () => {
              await ui(page, {
                roleplayAvatarStyle: style,
                roleplayAvatarScale: style === "rectangles" ? 1.25 : 1,
                roleplayChatWidthPercent: percent,
              });
              expect(
                await page.evaluate(() => {
                  const state = (globalThis as PublicUiHost).__MARINARA_HOST__!.stores.ui.getState();
                  return [state.roleplayAvatarStyle, state.roleplayAvatarScale, state.roleplayChatWidthPercent];
                }),
              ).toEqual([style, style === "rectangles" ? 1.25 : 1, percent]);
              await expect(page.locator(".mari-roleplay-avatar-spacer")).toHaveCount(style === "none" ? 0 : 1);
              await expect(page.locator(".mari-roleplay-message-row--rect-avatar")).toHaveCount(
                style === "rectangles" ? 3 : 0,
              );
              await expect(page.locator(".mari-roleplay-message-row--wide")).toHaveCount(
                style === "panel" ? 2 : style === "none" ? 3 : 0,
              );
              if (style === "rectangles")
                expect((await layout(page)).avatars[0]!.width).toBeGreaterThan(wide.avatars[0]!.width);
              await withinPane(page, true);
            });
        await ui(page, { roleplayAvatarStyle: "rectangles", roleplayAvatarScale: 1.25, roleplayChatWidthPercent: 100 });
        await page.locator('[data-tour="sidebar-toggle"]').click();
        for (const side of ["left", "right"] as const) {
          await ui(page, {
            roleplayChatPosition: side,
            trackerPanelEnabled: true,
            trackerPanelOpen: true,
            trackerPanelOpenByChatId: { [chat.id]: true },
            trackerPanelSide: side,
            trackerPanelSizeProfile: "standard",
          });
          const tracker = page.locator(`[data-component="TrackerDataSidebarDesktop.${side}"]`);
          await expect(tracker).toBeVisible();
          await expect(async () => {
            const boxes = await withinPane(page, true);
            const panel = (await tracker.boundingBox())!;
            for (const box of [boxes.composer, ...boxes.bodies, ...boxes.avatars])
              if (side === "left") expect(box.left).toBeGreaterThanOrEqual(panel.x + panel.width - 1);
              else expect(box.right).toBeLessThanOrEqual(panel.x + 1);
          }).toPass();
        }
        await ui(page, {
          trackerPanelEnabled: false,
          trackerPanelOpen: false,
          roleplayChatPosition: "center",
          roleplayAvatarStyle: "circles",
          roleplayAvatarScale: 1,
        });
        await page.locator('[data-tour="sidebar-toggle"]').click();
      }
      await appearance(page);
      await page.getByText("Custom chat width", { exact: true }).click();
      await expect(slider).toHaveCount(0);
      await clickTopbarPanel(page, "settings");
      await expect.poll(async () => (await layout(page)).composer.width).toBeCloseTo(baseline.composer.width, 0);
      await ui(page, { roleplayDisplayStyle: "visual-novel" });
      await page.getByRole("button", { name: "Show chat history", exact: true }).click();
      const history = page.locator("[data-chat-resource-drop-surface]");
      await expect(history).toHaveClass(/mari-roleplay-input-column/);
      // VN history is itself the column; its nested rows reserve their own padding and avatar tracks.
      await withinPane(page, false);
      await expect(async () => {
        const [historyBox, composerBox] = await Promise.all([
          history.boundingBox(),
          page.locator(column).boundingBox(),
        ]);
        expect(Math.abs(historyBox!.x - composerBox!.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(historyBox!.width - composerBox!.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(historyBox!.x + historyBox!.width - composerBox!.x - composerBox!.width)).toBeLessThanOrEqual(
          1,
        );
      }).toPass({ timeout: 10_000 });
      await expect
        .poll(async () => {
          const stored = JSON.parse((await (await request.get(settingsPath)).json()).value || "{}");
          return [stored.roleplayChatWidthPercent, stored.roleplayDisplayStyle];
        })
        .toEqual([null, "visual-novel"]);
      const saved = JSON.parse((await (await request.get(settingsPath)).json()).value || "{}");
      expect(
        (
          await request.put(settingsPath, {
            data: {
              value: JSON.stringify({
                ...saved,
                roleplayChatWidthPercent: "invalid",
                roleplayChatPosition: "right",
                __updatedAt: Date.now() + 60_000,
              }),
            },
          })
        ).ok(),
      ).toBe(true);
      await page.reload();
      await expect
        .poll(() =>
          page.evaluate(() => {
            const stored = JSON.parse(localStorage.getItem("marinara-engine-ui")!).state;
            return [stored.roleplayChatWidthPercent, stored.roleplayChatPosition];
          }),
        )
        .toEqual([null, "right"]);
      await page.screenshot({ path: testInfo.outputPath(`roleplay-width-${theme}.png`), animations: "disabled" });
    } finally {
      await page.close();
      await cleanup();
      await request.put(settingsPath, { data: { value: original.value } });
    }
  });
