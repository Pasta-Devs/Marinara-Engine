import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
for (const theme of ["dark", "light"] as const) {
  test(`Schedule icon retains its size in the conversation sidebar (${theme})`, async ({ page }, info) => {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: true,
      rightPanelOpen: false,
      theme,
      appAccentPulseMode: false,
    });
    await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
    await page.goto("/");
    const schedule = page.getByRole("button", { name: "Character Schedule Manager", exact: true });
    await expect(schedule).toBeVisible();
    await page.screenshot({ path: info.outputPath(`schedule-${theme}.png`), animations: "disabled" });
    // Sample both rectangles in one frame while the mobile sidebar is entering.
    const icon = await schedule.evaluate((button) => {
      const bounds = button.getBoundingClientRect();
      const svg = button.querySelector("svg")!.getBoundingClientRect();
      return { width: svg.width, height: svg.height, contained: svg.left >= bounds.left && svg.right <= bounds.right };
    });
    expect(icon.width).toBeGreaterThanOrEqual(19);
    expect(icon.height).toBeGreaterThanOrEqual(19);
    expect(icon.contained).toBe(true);
    if (info.project.name.includes("mobile")) await schedule.tap();
    else await schedule.click();
    await expect(page.getByRole("dialog", { name: "Character Schedule Manager", exact: true })).toBeVisible();
  });

  test(`Professor Mari copies only fenced code, with original whitespace (${theme})`, async ({ page }, info) => {
    const chatResponse = await page.request.get("/api/chats/internal/professor-mari");
    expect(chatResponse.ok()).toBeTruthy();
    const chat = await chatResponse.json();
    const marker = `code-${info.project.name}-${theme}-${Date.now()}`;
    const code = `// ${marker}\nconst greeting = "<hello> & goodbye";\n\n\n  return greeting;`;
    const response = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        characterId: "__professor_mari__",
        content: `Copy fixture\n\n\`\`\`js\n${code}\n\`\`\`\n\n\`inline code\``,
      },
    });
    expect(response.ok()).toBeTruthy();
    const message = await response.json();
    try {
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        theme,
        appAccentPulseMode: false,
      });
      await page.addInitScript((version) => {
        localStorage.setItem("marinara:whats-new:seen-version", version);
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (text: string) => {
              (window as any).__copiedCode = text;
            },
          },
        });
      }, version);
      await page.goto("/");
      await page.getByRole("tab", { name: "Professor", exact: true }).click();
      const pane = page.locator('[data-component="HomeProfessorMariChat.Window"]');
      const block = pane.locator("pre.mari-md-codeblock").filter({ hasText: marker });
      await expect(block).toBeVisible();
      await page.screenshot({ path: info.outputPath(`mari-code-${theme}.png`), animations: "disabled" });
      const copy = block.getByRole("button");
      await expect(copy).toBeVisible();
      await expect(copy).toHaveAccessibleName("Copy code");
      await expect(copy).toHaveAttribute("aria-live", "polite");
      if (info.project.name.includes("mobile")) await copy.tap();
      else await copy.press("Enter");
      await expect.poll(() => page.evaluate(() => (window as any).__copiedCode)).toBe(code);
      await expect(copy).toHaveText("Copied");
      await expect(copy).toHaveAccessibleName("Copied");
      await expect(pane.locator(".mari-md-inline-code").getByRole("button")).toHaveCount(0);
      await page.evaluate(() => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async () => {
              throw new Error("Denied");
            },
          },
        });
        document.execCommand = () => false;
      });
      await copy.click();
      await expect(copy).toHaveText("Copy failed");
      await expect(copy).toHaveAccessibleName("Copy failed");
      await expect(copy).toHaveAccessibleName("Copy code");

      // The other caller still copies just code after moving its controls into the shared hook.
      await page.route("**/api/docs/content?*", (route) =>
        route.fulfill({
          json: {
            path: "CONFIGURATION.md",
            title: "Copy proof",
            language: "en",
            updatedAt: new Date().toISOString(),
            content: "# Copy proof\n\n```sh\npnpm check\n```",
          },
        }),
      );
      await page.evaluate(async () => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (text: string) => {
              (window as any).__copiedCode = text;
            },
          },
        });
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openModal("docs-viewer", { initialDoc: "CONFIGURATION.md" });
      });
      const docsCopy = page.locator(".docs-reader-content").getByRole("button", { name: "Copy code", exact: true });
      await docsCopy.click();
      await expect.poll(() => page.evaluate(() => (window as any).__copiedCode)).toBe("pnpm check");
    } finally {
      await page.request.delete(`/api/chats/${chat.id}/messages/${message.id}`);
    }
  });
}
