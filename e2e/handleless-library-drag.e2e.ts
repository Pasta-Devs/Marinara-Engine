import { expect, test, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { clickTopbarPanel } from "./topbar-navigation.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

async function sendTouch(target: Locator, type: string, x: number, y: number, cancelable = true) {
  return target.evaluate(
    (element, { type, x, y, cancelable }) => {
      const finger = { identifier: 1, clientX: x, clientY: y };
      const event = new Event(type, { bubbles: true, cancelable });
      Object.defineProperties(event, {
        touches: { value: type === "touchend" || type === "touchcancel" ? [] : [finger] },
        changedTouches: { value: [finger] },
      });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    },
    { type, x, y, cancelable },
  );
}

for (const kind of ["agent", "lorebook", "connection", "preset"] as const) {
  test(`${kind} row picks up without a handle and keeps its controls usable`, async ({ page, request }, testInfo) => {
    const mobile = testInfo.project.name.includes("mobile");
    const name = `Handleless ${kind} ${Date.now()}`;
    const endpoint = kind === "preset" ? "/api/prompts" : `/api/${kind}s`;
    let response;
    if (kind === "preset") {
      const presets = await (await request.get(endpoint)).json();
      response = await request.post(`${endpoint}/${presets[0].id}/duplicate`);
    } else {
      response = await request.post(endpoint, {
        data: {
          name,
          ...(kind === "agent"
            ? {
                type: name,
                phase: "pre_generation",
                promptTemplate: "Context",
                settings: { resultType: "context_injection" },
              }
            : {}),
          ...(kind === "connection" ? { provider: "openrouter", model: "fixture" } : {}),
        },
      });
    }
    expect(response.ok(), await response.text()).toBeTruthy();
    const resource = await response.json();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        theme: mobile ? "dark" : "light",
        visualTheme: testInfo.project.name === "mobile-webkit" ? "sillytavern" : "default",
        sidebarOpen: false,
        rightPanelOpen: false,
      });
      await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
      await page.goto("/");
      await clickTopbarPanel(page, `${kind}s`);
      const panel = page.locator(`[data-component="RightPanel${mobile ? "Mobile" : "Desktop"}"]`);
      const source = panel.locator(`[data-touch-drag-card="${kind}"]`).filter({ hasText: resource.name }).first();
      await expect(source).toBeVisible();
      await expect(source.locator("[data-folder-drag-handle]")).toHaveCount(0);
      // The agent's primary content is a button; it must be draggable while remaining keyboard accessible.
      const body = kind === "agent" ? source.locator("[data-drag-surface]") : source;
      const box = await body.boundingBox();
      expect(box).not.toBeNull();
      const x = box!.x + box!.width * 0.4;
      const y = box!.y + box!.height / 2;
      const preview = page.locator(`body > [data-touch-drag-card="${kind}"][aria-hidden="true"]`);
      if (mobile) {
        await sendTouch(body, "touchstart", x, y);
        expect(await sendTouch(body, "touchmove", x, y - 60)).toBe(false);
        await sendTouch(body, "touchend", x, y - 60);
        await page.waitForTimeout(500);
        await expect(preview).toHaveCount(0);
        const control = source.locator("button:not([data-drag-surface])").first();
        await sendTouch(control, "touchstart", x, y);
        await page.waitForTimeout(500);
        await expect(preview).toHaveCount(0);
        await sendTouch(control, "touchend", x, y);
        await sendTouch(body, "touchstart", x, y);
        await expect(preview).toBeVisible();
        await sendTouch(body, "touchmove", x + 20, y);
      } else {
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 25, y, { steps: 5 });
        await expect(preview).toBeVisible();
      }
      await expect(preview).toContainText(resource.name);
      await page.screenshot({ path: testInfo.outputPath(`${kind}-handleless-pickup.png`) });
      if (mobile) await sendTouch(body, "touchcancel", x, y);
      else {
        await page.keyboard.press("Escape");
        await page.mouse.up();
      }
      await expect(preview).toHaveCount(0);
      await expect(source).toBeVisible();
      await expect(page.locator(".mari-editor-shell")).toHaveCount(0);
      await body.click();
      await expect(page.locator(".mari-editor-shell")).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await page.mouse.up();
      await request.delete(`${endpoint}/${resource.id}`);
    }
  });
}

test("background thumbnail picks up without selecting the background", async ({ page, request }, testInfo) => {
  const mobile = testInfo.project.name.includes("mobile");
  const response = await request.post("/api/backgrounds/upload", {
    multipart: {
      file: {
        name: `handleless-${Date.now()}.gif`,
        mimeType: "image/gif",
        buffer: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
      },
    },
  });
  expect(response.ok()).toBeTruthy();
  const { filename } = await response.json();
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: null } }));
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
    await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
    await page.goto("/");
    await clickTopbarPanel(page, "settings");
    await page.getByRole("tab", { name: "Appearance", exact: true }).click();
    await page.getByPlaceholder("Search settings").fill("Backgrounds");
    await page.getByRole("button", { name: /Backgrounds Section/ }).click();
    await page.getByRole("button", { name: "Browse library", exact: true }).click();
    const library = page.getByRole("dialog", { name: "Background Library" });
    await library.getByPlaceholder("Search backgrounds").fill(filename.replace(/\.gif$/, ""));
    const source = library.locator(`[data-background-id="user:${filename}"]`);
    const thumbnail = source.locator("[data-drag-surface]");
    const box = await thumbnail.boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;
    const selected = await source.getAttribute("data-background-selected");
    const preview = page.locator('body > [data-touch-drag-card="background"][aria-hidden="true"]');
    if (mobile) {
      await sendTouch(thumbnail, "touchstart", x, y);
      await sendTouch(thumbnail, "touchmove", x + 2, y, false);
      await page.waitForTimeout(400);
      await expect(preview).toHaveCount(0);
      await sendTouch(thumbnail, "touchend", x + 2, y);
      await sendTouch(thumbnail, "touchstart", x, y);
      await expect(preview).toBeVisible();
      await sendTouch(thumbnail, "touchcancel", x, y);
    } else {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 25, y, { steps: 5 });
      await expect(preview).toBeVisible();
      await page.keyboard.press("Escape");
      await page.mouse.up();
    }
    await expect(preview).toHaveCount(0);
    await expect(source).toHaveAttribute("data-background-selected", selected!);
  } finally {
    await page.mouse.up();
    await request.delete(`/api/backgrounds/${encodeURIComponent(filename)}`);
  }
});

test("background reordering preserves folder membership in the All view", async ({ page, request }, testInfo) => {
  const filenames: string[] = [];
  const folderIds: string[] = [];
  const prefix = `reorder-${Date.now()}`;
  try {
    for (const label of ["A", "B"]) {
      const folderResponse = await request.post("/api/backgrounds/folders", { data: { name: `${prefix}-${label}` } });
      expect(folderResponse.ok()).toBeTruthy();
      folderIds.push((await folderResponse.json()).id);
      const upload = await request.post("/api/backgrounds/upload", {
        multipart: {
          file: {
            name: `${prefix}-${label}.gif`,
            mimeType: "image/gif",
            buffer: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
          },
        },
      });
      expect(upload.ok()).toBeTruthy();
      filenames.push((await upload.json()).filename);
      const moved = await request.patch("/api/backgrounds/organization", {
        data: { backgroundId: `user:${filenames.at(-1)}`, folderId: folderIds.at(-1) },
      });
      expect(moved.ok()).toBeTruthy();
    }
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: null } }));
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
    await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
    await page.goto("/");
    await clickTopbarPanel(page, "settings");
    await page.getByRole("tab", { name: "Appearance", exact: true }).click();
    await page.getByPlaceholder("Search settings").fill("Backgrounds");
    await page.getByRole("button", { name: /Backgrounds Section/ }).click();
    await page.getByRole("button", { name: "Browse library", exact: true }).click();
    const library = page.getByRole("dialog", { name: "Background Library" });
    await library.getByPlaceholder("Search backgrounds").fill(prefix);
    const source = library.locator(`[data-background-id="user:${filenames[1]}"]`);
    const target = library.locator(`[data-background-id="user:${filenames[0]}"]`);
    const thumbnail = source.locator("[data-drag-surface]");
    const box = (await thumbnail.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const mobile = testInfo.project.name.includes("mobile");
    if (mobile) {
      await sendTouch(thumbnail, "touchstart", x, y);
      await expect(page.locator('body > [data-drag-kind="background"][aria-hidden="true"]')).toBeVisible();
    } else {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 15, y);
    }
    const destination = (await target.boundingBox())!;
    const dropX = destination.x + 4;
    const dropY = destination.y + destination.height / 2;
    if (mobile) await sendTouch(thumbnail, "touchmove", dropX, dropY);
    else await page.mouse.move(dropX, dropY);
    await expect(target).toHaveAttribute("data-drag-insert", "before");
    if (mobile) await sendTouch(thumbnail, "touchend", dropX, dropY);
    else await page.mouse.up();
    await expect(library.locator('[data-drag-kind="background"]').first()).toHaveAttribute(
      "data-background-id",
      `user:${filenames[1]}`,
    );
    const backgrounds = await (await request.get("/api/backgrounds")).json();
    for (let index = 0; index < filenames.length; index++) {
      expect(backgrounds.find((item: { id: string }) => item.id === `user:${filenames[index]}`).folderId).toBe(
        folderIds[index],
      );
    }
  } finally {
    await page.mouse.up();
    for (const filename of filenames) await request.delete(`/api/backgrounds/${encodeURIComponent(filename)}`);
    for (const id of folderIds) await request.delete(`/api/backgrounds/folders/${id}`);
  }
});
