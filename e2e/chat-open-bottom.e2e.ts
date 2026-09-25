import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const mode of ["conversation", "roleplay"] as const) {
  test(`${mode} opens at the latest message after history loads and when reopened`, async ({
    page,
    request,
    baseURL,
  }, testInfo) => {
    const imageUrl = new URL("/scroll-opening-fixture.svg", baseURL).href;
    const transcript = [
      JSON.stringify({ user_name: "You", character_name: "Guide", chat_metadata: {} }),
      ...Array.from({ length: 80 }, (_, index) =>
        JSON.stringify({
          name: index % 2 ? "Guide" : "You",
          is_user: index % 2 === 0,
          mes: `Opening transcript message ${index + 1}. ![Delayed illustration](${imageUrl})`,
        }),
      ),
    ].join("\n");
    const response = await request.post("/api/import/st-chat", {
      multipart: {
        file: { name: `opening-${mode}.jsonl`, mimeType: "application/jsonl", buffer: Buffer.from(transcript) },
        mode,
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    const { chatId } = (await response.json()) as { chatId: string };
    const otherResponse = await request.post("/api/import/st-chat", {
      multipart: {
        file: {
          name: `other-${mode}.jsonl`,
          mimeType: "application/jsonl",
          buffer: Buffer.from(transcript.replaceAll("Opening transcript", "Other transcript")),
        },
        mode,
      },
    });
    expect(otherResponse.ok()).toBeTruthy();
    const { chatId: otherChatId } = (await otherResponse.json()) as { chatId: string };
    let releaseImages!: () => void;
    const imagesReady = new Promise<void>((resolve) => {
      releaseImages = resolve;
    });
    try {
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: null } }));
      await seedUIState(
        page,
        {
          hasCompletedOnboarding: true,
          sidebarOpen: false,
          rightPanelOpen: false,
          chatHelpSeenModes: ["conversation", "roleplay", "game"],
          messagesPerPage: 20,
          theme: testInfo.project.name.includes("mobile") ? "dark" : "light",
        },
        "if-missing",
      );
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id: chatId, version },
      );
      // Exercise an initially empty transcript before the saved history arrives.
      await page.route(`**/api/chats/${chatId}/messages?*`, async (route) => {
        const result = await route.fetch();
        await new Promise((resolve) => setTimeout(resolve, 300));
        await route.fulfill({ response: result });
      });
      await page.route("**/scroll-opening-fixture.svg", async (route) => {
        await imagesReady;
        await route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#344e5b"/></svg>',
        });
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const scroller = page.locator("[data-chat-scroll]:visible");
      const latest = page.getByText(/^Opening transcript message 80\./);
      const distanceFromBottom = () =>
        scroller.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop);
      await expect(latest).toBeVisible();
      await expect(page.locator('img[alt="Delayed illustration"]').first()).toBeAttached();
      await expect.poll(distanceFromBottom).toBeLessThan(30);
      await expect(latest).toBeInViewport();

      // Images arrive only after the old, fixed two-frame opening scroll has finished.
      await page.waitForTimeout(100);
      releaseImages();
      await expect
        .poll(() =>
          page
            .locator('img[alt="Delayed illustration"]')
            .last()
            .evaluate((img: HTMLImageElement) => img.naturalWidth),
        )
        .toBe(600);
      await page.waitForTimeout(100);
      await expect.poll(distanceFromBottom).toBeLessThan(30);
      await page.screenshot({ path: testInfo.outputPath(`${mode}-opening.png`) });

      await page.reload();
      await expect(latest).toBeInViewport();
      await expect.poll(distanceFromBottom).toBeLessThan(30);

      // A reader can move into history without being pulled back down.
      await scroller.dispatchEvent("wheel", { deltaY: -600 });
      await scroller.evaluate((element) => {
        element.scrollTop = 0;
        const firstMessage = element.querySelector<HTMLElement>("[data-message-id]");
        if (firstMessage) firstMessage.style.paddingBottom = "80px";
      });
      await page.waitForTimeout(350);
      expect(await scroller.evaluate((element) => element.scrollTop)).toBe(0);
      await page.locator('[data-tour="sidebar-toggle"]').click();
      const sidebar = page.locator('[data-component="ChatSidebar"]');
      await sidebar.locator(`[data-tour="chat-mode-${mode}"]`).click();
      await sidebar.locator(`[data-chat-id="${otherChatId}"]`).click();
      await expect(latest).toHaveCount(0);
      await expect(page.getByText(/^Other transcript message 80\./)).toBeInViewport();
      await expect.poll(distanceFromBottom).toBeLessThan(30);
      if (testInfo.project.name.includes("mobile")) await page.locator('[data-tour="sidebar-toggle"]').click();
      await sidebar.locator(`[data-chat-id="${chatId}"]`).click();
      await expect(latest).toBeVisible();
      await expect(page.locator('img[alt="Delayed illustration"]').first()).toBeAttached();
      await expect.poll(distanceFromBottom).toBeLessThan(30);
      if (testInfo.project.name.includes("mobile")) await expect(sidebar).not.toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath(`${mode}-reopened.png`) });

      // Returning from Home must also re-arm the same chat's opening position.
      await page.locator('[data-topbar-hover-key="home"]').click();
      await expect(scroller).toHaveCount(0);
      // Mount without a layout box, as when the chat is covered by another pane.
      const pendingLayout = await page.addStyleTag({ content: "[data-chat-scroll] { display: none !important; }" });
      if (testInfo.project.name.includes("mobile")) await page.locator('[data-tour="sidebar-toggle"]').click();
      await sidebar.locator(`[data-tour="chat-mode-${mode}"]`).click();
      await sidebar.locator(`[data-chat-id="${chatId}"]`).click();
      await expect(latest).toBeAttached();
      await page.waitForTimeout(100);
      await pendingLayout.evaluate((element) => element.parentNode?.removeChild(element));
      await expect(latest).toBeInViewport();
      await expect.poll(distanceFromBottom).toBeLessThan(30);
    } finally {
      releaseImages();
      await request.delete(`/api/chats/${chatId}?force=true`);
      await request.delete(`/api/chats/${otherChatId}?force=true`);
    }
  });
}
