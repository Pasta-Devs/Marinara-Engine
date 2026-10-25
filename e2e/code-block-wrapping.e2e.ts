import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const mode of ["conversation", "roleplay"] as const) {
  test(`Fenced code wraps inside ${mode} messages without changing its text`, async ({ page, request }, info) => {
    const chatResponse = await request.post("/api/chats", {
      data: { name: `Code wrapping ${mode}`, mode, characterIds: [] },
    });
    expect(chatResponse.ok()).toBeTruthy();
    const chat = await chatResponse.json();
    try {
      const paragraph = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(18).trimEnd();
      const token = "unbroken_code_token_".repeat(50);
      const code = `${paragraph}\n\n  ${token}\n    return 42;`;
      const messages: string[] = [];
      for (const prefix of ["Plain Markdown", "<strong>Mixed HTML</strong>"]) {
        const response = await request.post(`/api/chats/${chat.id}/messages`, {
          data: { role: "assistant", content: `${prefix}\n\n\`\`\`text\n${code}\n\`\`\`` },
        });
        expect(response.ok()).toBeTruthy();
        messages.push((await response.json()).id);
      }
      await isolateSyncedUISettings(page);
      await page.route("**/api/regex-scripts", (route) => route.fulfill({ json: [] }));
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        chatHelpSeenModes: ["conversation", "roleplay", "game"],
        appAccentPulseMode: false,
        theme: "dark",
      });
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id: chat.id, version },
      );
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      for (const theme of ["dark", "light"] as const) {
        await page.evaluate(async (theme) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setTheme(theme);
        }, theme);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        for (const id of messages) {
          const row = page.locator(`[data-message-id="${id}"]`);
          const block = row.locator("pre.mari-md-codeblock");
          await expect(block).toBeVisible();
          const geometry = await block.evaluate(
            (pre, { paragraph, token }) => {
              const code = pre.querySelector("code")!;
              const rect = pre.getBoundingClientRect();
              const wrappedLines = (text: string) => {
                const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
                for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                  const index = node.textContent!.indexOf(text);
                  if (index < 0) continue;
                  const range = document.createRange();
                  range.setStart(node, index);
                  range.setEnd(node, index + text.length);
                  return new Set([...range.getClientRects()].map((line) => line.top)).size;
                }
                return 0;
              };
              return {
                text: [...code.childNodes].map((node) => (node.nodeName === "BR" ? "\n" : node.textContent)).join(""),
                scrollWidth: pre.scrollWidth,
                clientWidth: pre.clientWidth,
                left: rect.left,
                right: rect.right,
                viewportWidth: document.documentElement.clientWidth,
                paragraphLines: wrappedLines(paragraph),
                tokenLines: wrappedLines(token),
              };
            },
            { paragraph, token },
          );
          expect(geometry.text).toBe(code);
          expect(geometry.paragraphLines).toBeGreaterThan(1);
          expect(geometry.tokenLines).toBeGreaterThan(1);
          expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
          expect(geometry.left).toBeGreaterThanOrEqual(-1);
          expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
        }
        await page
          .locator(`[data-message-id="${messages[0]}"] pre.mari-md-codeblock`)
          .evaluate((pre) => pre.scrollIntoView({ block: "start" }));
        await page.screenshot({ path: info.outputPath(`code-wrapping-${mode}-${theme}.png`), animations: "disabled" });
      }
    } finally {
      await request.delete(`/api/chats/${chat.id}`);
    }
  });
}
