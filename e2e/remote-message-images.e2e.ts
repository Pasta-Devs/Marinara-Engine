import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const REMOTE = "https://remote-image.invalid";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function setUi(page: Page, change: { loadRemoteMessageImages?: boolean; toggleBoldDialogue?: boolean }) {
  await page.evaluate(async (change) => {
    const { useUIStore } = (await import("/src/stores/ui.store.ts" as string)) as PageUiStoreModule;
    const state = useUIStore.getState();
    if (change.loadRemoteMessageImages !== undefined) state.setLoadRemoteMessageImages(change.loadRemoteMessageImages);
    if (change.toggleBoldDialogue) state.setBoldDialogue(!state.boldDialogue);
  }, change);
}

async function approvedInBrowser(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const { useUIStore } = (await import("/src/stores/ui.store.ts" as string)) as PageUiStoreModule;
    return useUIStore.getState().approvedRemoteImageUrls;
  });
}

test("Message HTML holds images from other websites until the user asks", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chromium", "Sanitizer output is the same on every browser.");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const result = await page.evaluate(async (remote) => {
    const { sanitizeChatHtml } = (await import("/src/lib/chat-html.ts" as string)) as {
      sanitizeChatHtml: (
        html: string,
        options: { allowStyle?: boolean; remoteImages?: { loadAll: boolean; approved: Set<string> } },
      ) => string;
    };
    const html = [
      `<img src="${remote}/a.png?d=persona" alt="remote" width="200" style="border-radius: 4px">`,
      `<img srcset="${remote}/set.png 1x" src="/api/avatars/file/local.png" alt="local">`,
      `<img src="${location.origin}/api/gallery/file/x.png" alt="absolute local">`,
      `<img src="data:image/png;base64,AA==" alt="data">`,
      `<img src="//remote-image.invalid/relative.png" alt="protocol relative">`,
      `<span style="background-image: url(${remote}/bg.png); color: red">styled</span>`,
    ].join("");
    const render = (loadAll: boolean, approved: string[] = []) => {
      const host = document.createElement("div");
      host.innerHTML = sanitizeChatHtml(html, {
        allowStyle: true,
        remoteImages: { loadAll, approved: new Set(approved) },
      });
      return {
        images: [...host.querySelectorAll("img")].map((img) => img.getAttribute("src")),
        srcset: host.querySelectorAll("[srcset]").length,
        held: [...host.querySelectorAll("[data-mari-remote-image]")].map((el) =>
          el.getAttribute("data-mari-remote-image"),
        ),
        buttons: [...host.querySelectorAll("button")].map((button) => button.textContent),
        style: host.querySelector("span[style]")?.getAttribute("style") ?? "",
      };
    };
    return {
      held: render(false),
      approved: render(false, [`${remote}/a.png?d=persona`]),
      allowed: render(true),
    };
  }, REMOTE);

  const local = [
    "/api/avatars/file/local.png",
    expect.stringMatching(/\/api\/gallery\/file\/x\.png$/u),
    "data:image/png;base64,AA==",
  ];
  expect(result.held.images).toEqual(local);
  expect(result.held.srcset).toBe(0);
  expect(result.held.held).toEqual([`${REMOTE}/a.png?d=persona`, "http://remote-image.invalid/relative.png"]);
  expect(result.held.buttons).toEqual(["Load image", "Load image"]);
  expect(result.held.style).not.toContain("remote-image.invalid");
  expect(result.held.style).toContain("color: red");

  expect(result.approved.images).toEqual([`${REMOTE}/a.png?d=persona`, ...local]);
  expect(result.approved.held).toEqual(["http://remote-image.invalid/relative.png"]);

  expect(result.allowed.images).toEqual([`${REMOTE}/a.png?d=persona`, ...local, "//remote-image.invalid/relative.png"]);
  expect(result.allowed.held).toEqual([]);
  expect(result.allowed.style).toContain(`url(${REMOTE}/bg.png)`);
});

test("A loaded message image stays loaded across reloads and devices", async ({ page, browser, request }, info) => {
  test.skip(info.project.name !== "desktop-chromium", "One browser covers the click-to-load flow.");
  const requested: string[] = [];
  // Stand in for the server's synced settings so this test cannot change other tests' preferences.
  let serverSettings: string | null = null;
  const serverApprovals = () =>
    serverSettings
      ? ((JSON.parse(serverSettings) as { approvedRemoteImageUrls?: string[] }).approvedRemoteImageUrls ?? [])
      : [];

  const chatResponse = await request.post("/api/chats", {
    data: { name: "Remote image fixture", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  const markdownUrl = `${REMOTE}/markdown.png?d=persona`;
  const htmlUrl = `${REMOTE}/html.png?d=chat`;
  const brokenUrl = `${REMOTE}/not-an-image.png`;

  const openChat = async (target: Page) => {
    await target.route(`${REMOTE}/**`, async (route) => {
      requested.push(route.request().url());
      if (route.request().url().includes("not-an-image")) {
        await route.fulfill({ contentType: "text/html", body: "<p>nope</p>" });
      } else {
        await route.fulfill({ contentType: "image/png", body: PNG });
      }
    });
    await target.route("**/api/app-settings/ui", async (route) => {
      if (route.request().method() === "PUT") {
        serverSettings = (route.request().postDataJSON() as { value: string }).value;
      }
      await route.fulfill({ json: { value: serverSettings } });
    });
    await seedUIState(
      target,
      {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        chatHelpSeenModes: ["conversation", "roleplay", "game"],
        trackerPanelEnabled: false,
      },
      "if-missing",
    );
    await target.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chat.id, version },
    );
    await target.goto("/", { waitUntil: "domcontentloaded" });
    await expect(target.getByText("Styled card")).toBeVisible({ timeout: 30_000 });
  };
  const placeholder = (target: Page, url: string) => target.locator(`.mari-remote-image[title="${url}"]`);
  const image = (target: Page, url: string) => target.locator(`img[src="${url}"]`);

  const otherDevice = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: page.viewportSize() });
  try {
    for (const content of [
      `Markdown portrait ![mood](${markdownUrl})`,
      `<div class="fixture-card"><img src="${htmlUrl}" alt="html"><span class="fixture-bg" style="background-image: url(${REMOTE}/inline.png)">Styled card</span> "Hello there"</div><style>.fixture-card { background-image: url(${REMOTE}/style-block.png); }</style>`,
      `Broken ![broken](${brokenUrl})`,
    ]) {
      const message = await request.post(`/api/chats/${chat.id}/messages`, { data: { role: "assistant", content } });
      expect(message.ok(), await message.text()).toBeTruthy();
    }

    await openChat(page);
    await expect(placeholder(page, markdownUrl)).toBeVisible();
    await expect(placeholder(page, htmlUrl)).toBeVisible();
    await expect(placeholder(page, markdownUrl)).toContainText("remote-image.invalid");
    await page.waitForTimeout(500);
    expect(requested, "nothing reaches another site before a click").toEqual([]);
    await page.screenshot({ path: info.outputPath("held-images.png") });

    // Only the clicked image loads, and it is remembered on the server.
    await placeholder(page, markdownUrl).getByRole("button", { name: "Load image from remote-image.invalid" }).click();
    await expect(image(page, markdownUrl)).toBeVisible();
    expect(new Set(requested)).toEqual(new Set([markdownUrl]));
    await expect.poll(serverApprovals).toEqual([markdownUrl]);

    // Something that is not an image is not remembered.
    await placeholder(page, brokenUrl).getByRole("button").click();
    await expect(placeholder(page, brokenUrl).getByRole("button")).toHaveText("Couldn't load. Try again");
    expect(await approvedInBrowser(page)).toEqual([markdownUrl]);

    // A message's own HTML images load from their own button.
    await placeholder(page, htmlUrl).getByRole("button").click();
    await expect(image(page, htmlUrl)).toBeVisible();
    expect(new Set(requested)).toEqual(new Set([markdownUrl, brokenUrl, htmlUrl]));

    // Re-rendering the message never shows an approved image's placeholder again.
    await page.evaluate(() => {
      const seen: string[] = [];
      (window as { __heldSeen?: string[] }).__heldSeen = seen;
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (!(node instanceof Element)) continue;
            for (const held of [node, ...node.querySelectorAll(".mari-remote-image")]) {
              if (held.matches(".mari-remote-image")) seen.push(held.getAttribute("title") ?? "");
            }
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    });
    const html = page.locator(".mari-html-content", { hasText: "Styled card" });
    const before = await html.innerHTML();
    await setUi(page, { toggleBoldDialogue: true });
    await expect.poll(() => html.innerHTML()).not.toBe(before);
    await setUi(page, { toggleBoldDialogue: true });
    await expect(image(page, htmlUrl)).toBeVisible();
    const seen = await page.evaluate(() => (window as { __heldSeen?: string[] }).__heldSeen ?? []);
    expect(seen).not.toContain(htmlUrl);
    expect(seen).not.toContain(markdownUrl);

    // Same browser after a reload: shown right away.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Styled card")).toBeVisible();
    await expect(image(page, markdownUrl)).toBeVisible();
    await expect(image(page, htmlUrl)).toBeVisible();
    await expect(placeholder(page, markdownUrl)).toHaveCount(0);

    // Another device: nothing in that browser, the approvals come from the server.
    await expect.poll(serverApprovals).toEqual([htmlUrl, markdownUrl]);
    const otherPage = await otherDevice.newPage();
    await openChat(otherPage);
    await expect(image(otherPage, markdownUrl)).toBeVisible();
    await expect(image(otherPage, htmlUrl)).toBeVisible();
    await expect(placeholder(otherPage, brokenUrl)).toBeVisible();
    expect(requested.some((url) => /inline\.png|style-block\.png/u.test(url))).toBe(false);

    // The setting shows everything directly, as before.
    await setUi(otherPage, { loadRemoteMessageImages: true });
    await expect(otherPage.locator(".mari-remote-image")).toHaveCount(0);
    await expect.poll(() => requested.some((url) => url.includes("inline.png"))).toBe(true);
    await expect.poll(() => requested.some((url) => url.includes("style-block.png"))).toBe(true);
  } finally {
    await otherDevice.close();
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
});
