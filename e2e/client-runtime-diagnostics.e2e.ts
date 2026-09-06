import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const appVersion = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;
type RuntimeReport = {
  build: string;
  page: string;
  persistence: string;
  navigation: string;
  events: Array<{ page: string; kind: string; reason?: string; error?: string; reactCode?: number }>;
};

async function prepareClient(page: Page, chatId?: string) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.addInitScript(
    ({ version, id }) => {
      localStorage.setItem("marinara:whats-new:seen-version", version);
      if (id) localStorage.setItem("marinara-active-chat-id", id);
      if (!localStorage.getItem("marinara-engine-ui")) {
        localStorage.setItem(
          "marinara-engine-ui",
          JSON.stringify({
            state: {
              hasCompletedOnboarding: true,
              rightPanelOpen: !id,
              rightPanel: "settings",
              settingsTab: "advanced",
              sidebarOpen: false,
              messagesPerPage: 20,
              chatHelpSeenModes: ["conversation", "roleplay", "game"],
            },
            version: 65,
          }),
        );
      }
      let copied = "";
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            copied = value;
          },
          readText: async () => copied,
        },
      });
    },
    { version: appVersion, id: chatId },
  );
}

async function copyReport(page: Page) {
  await page.getByRole("button", { name: "Copy Support Diagnostics", exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("Client runtime:");
  const report = await page.evaluate(() => navigator.clipboard.readText());
  const line = report.split("\n").find((line) => line.startsWith("Client runtime: "));
  expect(line).toBeTruthy();
  return { report, runtime: JSON.parse(line!.slice("Client runtime: ".length)) as RuntimeReport };
}

test("support diagnostics persists private-safe client errors and marks the existing Refresh App action", async ({
  page,
}, testInfo) => {
  await prepareClient(page);
  await page.goto("/");
  const before = await copyReport(page);
  expect(before.runtime.build).toContain(appVersion);
  const sourcePage = before.runtime.page;
  await page.evaluate(() => {
    const error = new TypeError("PRIVATE_CHAT_TEXT: Minified React error #185");
    error.stack = "TypeError: PRIVATE_CHAT_TEXT\n at https://private-host.test/assets/ChatArea-probe.js:1:42";
    window.dispatchEvent(new ErrorEvent("error", { error }));
  });
  await page.getByRole("button", { name: "Refresh App", exact: true }).click();
  await expect(page).toHaveURL(/spa_refresh=/);
  const { report, runtime } = await copyReport(page);
  expect(runtime.persistence).toBe("local");
  expect(runtime.page).not.toBe(sourcePage);
  expect(runtime.events).toContainEqual(
    expect.objectContaining({ kind: "javascript-error", error: "TypeError", reactCode: 185, page: sourcePage }),
  );
  expect(runtime.events).toContainEqual(
    expect.objectContaining({ kind: "reload-requested", reason: "settings-refresh", page: sourcePage }),
  );
  expect(report).not.toContain("PRIVATE_CHAT_TEXT");
  expect(report).not.toContain("private-host");
  await testInfo.attach("copied-client-diagnostics", { body: report, contentType: "text/plain" });
  await testInfo.attach("support-diagnostics", { body: await page.screenshot(), contentType: "image/png" });
});

test("preload recovery is marked but an unrequested browser reload is not attributed to a crash or app recovery", async ({
  page,
}) => {
  await prepareClient(page);
  await page.goto("/");
  const before = await copyReport(page);
  await page.reload();
  const ordinary = await copyReport(page);
  expect(ordinary.runtime.navigation).toBe("reload");
  expect(ordinary.runtime.page).not.toBe(before.runtime.page);
  expect(ordinary.runtime.events.some((event) => event.kind === "reload-requested")).toBe(false);
  await page.evaluate(() => {
    const event = new Event("vite:preloadError", { cancelable: true });
    Object.assign(event, { payload: new TypeError("PRIVATE_IMAGE_URL") });
    window.dispatchEvent(event);
  });
  await expect(page).toHaveURL(/chunk_reload=/);
  const recovered = await copyReport(page);
  expect(recovered.runtime.events).toContainEqual(
    expect.objectContaining({ kind: "reload-requested", reason: "chunk-recovery", page: ordinary.runtime.page }),
  );
  expect(recovered.report).not.toContain("PRIVATE_IMAGE_URL");
  expect(recovered.runtime.page).not.toBe(ordinary.runtime.page);
});

test("Roleplay edit and older-message scrolling keeps the page alive and records only an edit milestone", async ({
  page,
  request,
}, testInfo) => {
  const created = await request.post("/api/chats", {
    data: { name: "Disposable edit scroll proof", mode: "roleplay", characterIds: [] },
  });
  expect(created.ok()).toBeTruthy();
  const chat = (await created.json()) as { id: string };
  const ids: string[] = [];
  let navigations = 0;
  const errors: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations++;
  });
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    for (let index = 0; index < 60; index++) {
      const saved = await request.post(`/api/chats/${chat.id}/messages`, {
        data: {
          role: index % 2 ? "assistant" : "user",
          content: `Saved reply ${index + 1}. ${"An earlier paragraph remains readable while scrolling. ".repeat(12)}`,
        },
      });
      expect(saved.ok()).toBeTruthy();
      ids.push(((await saved.json()) as { id: string }).id);
    }
    await prepareClient(page, chat.id);
    await page.goto("/");
    const transcript = page.locator("[data-chat-scroll]");
    const latest = page.locator(`[data-message-id="${ids.at(-1)}"]`);
    await expect(latest).toBeVisible();
    // Use the existing edit command so long-message action bars need not be
    // scrolled into view before the reported edit/scroll sequence starts.
    await page.evaluate((messageId) => {
      window.dispatchEvent(new CustomEvent("marinara:start-edit-message", { detail: { messageId } }));
    }, ids.at(-1));
    await latest.locator("[data-chat-message-editor]").fill("PRIVATE_EDITED_MESSAGE");
    await latest.getByRole("button", { name: "Save edit", exact: true }).click();
    await expect(latest.locator("[data-chat-message-editor]")).toHaveCount(0);
    await expect(latest).toContainText("PRIVATE_EDITED_MESSAGE");
    await transcript.evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.getByRole("button", { name: "Load More", exact: true }).click();
    await expect(page.locator(`[data-message-id="${ids[20]}"]`)).toBeAttached();
    await transcript.evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.getByRole("button", { name: "Load More", exact: true }).click();
    await expect(page.locator(`[data-message-id="${ids[0]}"]`)).toBeAttached();
    await transcript.evaluate((element) => {
      element.scrollTop = 200;
    });
    await expect(page.locator("textarea.mari-chat-input-textarea")).toBeVisible();
    const recorded = await page.evaluate(() => localStorage.getItem("marinara-client-runtime-events") ?? "");
    const events = JSON.parse(recorded) as RuntimeReport["events"];
    expect(events.some((event) => event.kind === "message-edited")).toBe(true);
    expect(events.some((event) => event.kind === "reload-requested")).toBe(false);
    expect(recorded).not.toContain("PRIVATE_EDITED_MESSAGE");
    expect(navigations).toBe(1);
    expect(errors).toEqual([]);
    await testInfo.attach("edit-and-scroll", { body: await page.screenshot(), contentType: "image/png" });
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});
