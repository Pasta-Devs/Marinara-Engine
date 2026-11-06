import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

async function openChat(page: Page, id: string) {
  await isolateSyncedUISettings(page);
  await page.route("**/api/regex-scripts", (route) => route.fulfill({ json: [] }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay"],
    appAccentPulseMode: false,
    theme: "dark",
    chatFontSize: 24,
  });
  await page.addInitScript(
    ({ id, version }) => {
      localStorage.setItem("marinara-active-chat-id", id);
      localStorage.setItem("marinara:whats-new:seen-version", version);
    },
    { id, version },
  );
  await page.goto("/");
}

for (const mode of ["conversation", "roleplay"] as const) {
  test(`System messages render formatting inside the ${mode} transcript`, async ({ page, request }, info) => {
    const created = await request.post("/api/chats", {
      data: { name: `System formatting ${mode}`, mode, characterIds: [] },
    });
    expect(created.ok()).toBeTruthy();
    const chat = await created.json();
    let branchId: string | null = null;
    try {
      const response = await request.post(`/api/chats/${chat.id}/messages`, {
        data: {
          role: "system",
          content: [
            "# System note",
            "First authored line.",
            "Second authored line.",
            "Context user: {{user}}",
            "",
            "**Markdown emphasis** and <strong>Allowed HTML</strong>.",
            'Literal `<font color="#HEX">` stays code.',
            "",
            "```text",
            "  system_code_token_".repeat(45),
            "```",
            '<img src="data:image/png;base64,broken" onerror="window.__unsafeSystemHtml=true"><script>window.__unsafeSystemHtml=true</script><iframe src="https://unsafe.invalid"></iframe>',
            "",
            "Long system content stays readable. ".repeat(30),
          ].join("\n"),
        },
      });
      expect(response.ok()).toBeTruthy();
      const message = await response.json();
      await openChat(page, chat.id);
      await expect(page.getByRole("heading", { name: "System note", exact: true })).toBeVisible();
      const row = page.locator(`[data-message-id="${message.id}"]`);
      await expect(row.getByText("System", { exact: true })).toBeVisible();
      await expect(row.locator(".mari-message-content")).toHaveCSS("font-size", "24px");
      await expect(row.locator("strong")).toHaveText(["Markdown emphasis", "Allowed HTML"]);
      await expect(row.locator(".mari-md-inline-code")).toHaveText('<font color="#HEX">');
      await expect(row.locator(".mari-message-content")).not.toContainText("{{user}}");
      await expect(row.locator("script, iframe, [onerror]")).toHaveCount(0);
      expect(await page.evaluate(() => (window as any).__unsafeSystemHtml)).toBeUndefined();
      for (const theme of ["dark", "light"] as const) {
        await page.evaluate(async (theme) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setTheme(theme);
        }, theme);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const lineTops = await row.evaluate((element) => {
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          const tops: number[] = [];
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            for (const text of ["First authored line.", "Second authored line."]) {
              const start = node.textContent!.indexOf(text);
              if (start < 0) continue;
              const range = document.createRange();
              range.setStart(node, start);
              range.setEnd(node, start + text.length);
              tops.push(range.getBoundingClientRect().top);
            }
          }
          return tops;
        });
        expect(lineTops).toHaveLength(2);
        expect(lineTops[1]).toBeGreaterThan(lineTops[0]!);
        const bounds = await row.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return {
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            left: rect.left,
            right: rect.right,
            viewportWidth: document.documentElement.clientWidth,
          };
        });
        expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth + 1);
        expect(bounds.left).toBeGreaterThanOrEqual(-1);
        expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1);
        const codeBounds = await row
          .locator("pre")
          .evaluate((pre) => ({ width: pre.clientWidth, scroll: pre.scrollWidth }));
        expect(codeBounds.scroll).toBeLessThanOrEqual(codeBounds.width + 1);
        await page.screenshot({ path: info.outputPath(`system-${mode}-${theme}.png`), animations: "disabled" });
      }
      await row.focus();
      await row.getByRole("button", { name: "Edit", exact: true }).click();
      const editor = row.locator("[data-chat-message-editor]");
      await expect(editor).toBeVisible();
      await expect(editor).toHaveValue(/Context user: \{\{user\}\}/);
      const edited = "# Edited system note\n\n**Saved formatting**\nA second line.";
      await editor.fill(edited);
      await row.getByRole("button", { name: /^Save(?: edit)?$/i }).click();
      await expect(row.getByRole("heading", { name: "Edited system note", exact: true })).toBeVisible();
      await expect
        .poll(async () => {
          const messages = await (await request.get(`/api/chats/${chat.id}/messages`)).json();
          return messages.find((item: { id: string }) => item.id === message.id)?.content;
        })
        .toBe(edited);
      await row.getByRole("button", { name: "Bookmark, pin or note", exact: true }).click();
      const marks = page.getByRole("dialog", { name: "Bookmark, pin or note", exact: true });
      await marks.getByRole("button", { name: "Bookmark message", exact: true }).click();
      await marks.press("Escape");
      await expect(row.getByTitle("Bookmarked", { exact: true })).toBeVisible();
      await row.getByRole("button", { name: /branch from here/i }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Create branch", exact: true }).click();
      await expect
        .poll(() =>
          page.evaluate(async () => {
            const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
            return useChatStore.getState().activeChatId;
          }),
        )
        .not.toBe(chat.id);
      branchId = await page.evaluate(async () => {
        const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
        return useChatStore.getState().activeChatId;
      });
      expect(branchId).toBeTruthy();
      const copiedMessages = await (await request.get(`/api/chats/${branchId}/messages`)).json();
      expect(copiedMessages).toHaveLength(1);
      expect(copiedMessages[0]).toMatchObject({ role: "system", content: edited });
    } finally {
      if (branchId) await request.delete(`/api/chats/${branchId}`);
      await request.delete(`/api/chats/${chat.id}`);
    }
  });
}

test("Literal HTML inside backticks cannot change Roleplay formatting or load code images", async ({
  page,
  request,
}) => {
  const created = await request.post("/api/chats", {
    data: { name: "Literal HTML code", mode: "roleplay", characterIds: [] },
  });
  expect(created.ok()).toBeTruthy();
  const chat = await created.json();
  let codeImageRequests = 0;
  await page.route("https://code.invalid/**", (route) => {
    codeImageRequests++;
    return route.abort();
  });
  try {
    const code =
      '<font color="black">\n<style>body { color: black; }</style>\n<img src="https://code.invalid/pixel" onerror="window.__unsafeCode=true">\n\n  return 42;';
    const contents = [
      '7. Dialogue uses `<font color="#HEX">` per NPC.\n\n## Following heading',
      '<strong>Real HTML</strong>\n7. Dialogue uses `<font color="#HEX">` per NPC.\n\n## Following heading\n<font color="#ff0000">Explicitly red</font>\n<span>Theme-colored tail</span>',
      `<strong>Real HTML</strong>\n\n\`\`\`html\n${code}\n\`\`\`\n\n## Following heading`,
      '<strong>Real HTML</strong>\nx < y\n```text\n  first\n\nsecond\n```\n> z\n\n## Following heading',
    ];
    const messages: string[] = [];
    for (const content of contents) {
      const response = await request.post(`/api/chats/${chat.id}/messages`, { data: { role: "assistant", content } });
      expect(response.ok()).toBeTruthy();
      messages.push((await response.json()).id);
    }
    await openChat(page, chat.id);
    for (const [index, id] of messages.entries()) {
      const row = page.locator(`[data-message-id="${id}"]`);
      if (index < 2) {
        await expect(row.locator(".mari-md-inline-code")).toHaveText('<font color="#HEX">');
        await expect(row.locator(".mari-md-inline-code font")).toHaveCount(0);
      } else {
        expect(await row.locator("pre code").textContent()).toBe(index === 2 ? code : "  first\n\nsecond");
        await expect(row.locator("pre font, pre style, pre img, pre script")).toHaveCount(0);
      }
      const heading = row.getByRole("heading", { name: "Following heading", exact: true });
      await expect(heading).toBeVisible();
      const colors = await heading.evaluate((element) => ({
        actual: getComputedStyle(element).color,
        inherited: getComputedStyle(element.closest(".mari-message-content")!).color,
      }));
      expect(colors.actual).toBe(colors.inherited);
      if (index === 1) {
        await expect(row.locator("font")).toHaveCSS("color", "rgb(255, 0, 0)");
        const tail = await row.getByText("Theme-colored tail", { exact: true }).evaluate((element) => ({
          actual: getComputedStyle(element).color,
          inherited: getComputedStyle(element.closest(".mari-message-content")!).color,
        }));
        expect(tail.actual).toBe(tail.inherited);
      }
    }
    expect(codeImageRequests).toBe(0);
    expect(await page.evaluate(() => (window as any).__unsafeCode)).toBeUndefined();
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});
