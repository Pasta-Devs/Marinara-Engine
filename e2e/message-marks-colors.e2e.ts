import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const mode of ["conversation", "roleplay"] as const) {
  test(`${mode} marks follow Chroma and Help explains them`, async ({ page, request }, info) => {
    const chat = await (
      await request.post("/api/chats", { data: { name: "Message colours", mode }, failOnStatusCode: true })
    ).json();
    try {
      const message = await (
        await request.post(`/api/chats/${chat.id}/messages`, {
          data: {
            role: "assistant",
            content: "A message with a bookmark and a context pin.",
            extra: {
              bookmark: { createdAt: new Date().toISOString() },
              pinnedToContext: true,
              privateNote: "A private note.",
            },
          },
          failOnStatusCode: true,
        })
      ).json();
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        appAccentPulseMode: false,
        chatHelpSeenModes: ["conversation", "roleplay", "game"],
      });
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id: chat.id, version },
      );
      await page.goto("/");
      await page.getByRole("button", { name: "Chats", exact: true }).click();
      if (info.project.name.includes("mobile")) await page.getByRole("button", { name: "Close chats" }).click();
      const row = page.locator(`[data-message-id="${message.id}"]`);
      await row.focus();
      await row.getByRole("button", { name: "Bookmark, pin or note", exact: true }).click();
      const menu = page.getByRole("dialog", { name: "Bookmark, pin or note", exact: true });
      const note = menu.getByRole("textbox", { name: "Private note", exact: true });
      await note.fill("");
      const appearance = async () => ({
        ...(await menu.evaluate((element) => {
          const field = element.querySelector("textarea")!;
          const style = getComputedStyle(field);
          return {
            body: getComputedStyle(element).color,
            placeholder: getComputedStyle(field, "::placeholder").color,
            border: style.borderColor,
            icon: getComputedStyle(element.querySelector("svg")!).color,
          };
        })),
        hint: await menu
          .getByText(/^Keeps pinned messages past the history limit/)
          .evaluate((element) => getComputedStyle(element).color),
      });
      for (const theme of ["dark", "light"] as const) {
        const colors = [];
        for (const [index, accent] of ["#14b8a6", "#3b82f6", "#ffffff"].entries()) {
          const text = theme === "dark" ? (index === 0 ? "#99f6e4" : "#bfdbfe") : index === 0 ? "#115e59" : "#1e40af";
          await page.evaluate(
            async ({ theme, accent, text }) => {
              const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
              useUIStore.getState().setTheme(theme);
              useUIStore.getState().setAppAccentColor(accent);
              useUIStore.getState().setChatChromeTextColor(text);
            },
            { theme, accent, text },
          );
          await note.focus();
          // The accent already styles the frame; wait for that existing transition to settle.
          await expect
            .poll(() =>
              menu.evaluate((element) =>
                getComputedStyle(element).getPropertyValue("--marinara-app-accent-solid").trim(),
              ),
            )
            .toBe(accent);
          await page.screenshot({ path: info.outputPath(`marks-${theme}-${index}.png`), animations: "disabled" });
          colors.push(await appearance());
          if (theme === "light") {
            const contrasts = await menu
              .locator('button[aria-pressed="true"] > svg, label > svg')
              .evaluateAll((icons) => {
                const canvas = document.createElement("canvas");
                canvas.width = canvas.height = 1;
                const context = canvas.getContext("2d")!;
                const luminance = (color: string) => {
                  // A black backdrop gives translucent light panels their lowest contrast.
                  context.fillStyle = "#000";
                  context.fillRect(0, 0, 1, 1);
                  context.fillStyle = color;
                  context.fillRect(0, 0, 1, 1);
                  const channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map((channel) => {
                    const value = channel / 255;
                    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
                  });
                  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
                };
                const background = luminance(getComputedStyle(icons[0]!.closest('[role="dialog"]')!).backgroundColor);
                return icons.map((icon) => {
                  const foreground = luminance(getComputedStyle(icon).color);
                  return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
                });
              });
            expect(contrasts).toHaveLength(3);
            for (const contrast of contrasts) expect(contrast).toBeGreaterThanOrEqual(3);
          }
        }
        for (const key of Object.keys(colors[0]!) as Array<keyof (typeof colors)[number]>) {
          expect(colors[1]![key], `${theme} ${key} follows Chroma`).not.toBe(colors[0]![key]);
        }
      }
      await page.keyboard.press("Escape");
      const help = page.getByRole("button", { name: "Help", exact: true }).filter({ visible: true });
      if (!(await help.count())) {
        // Help sits beside the Chat Settings title (on phones it closes the sheet first).
        await page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true }).click();
      }
      await help.click();
      const overlay = page.locator(`[data-chat-help-overlay="${mode}"]`);
      if (info.project.name.includes("mobile")) {
        await overlay.locator('[data-chat-help-highlight="messages"]').click();
      }
      const legend = overlay.locator(`[data-chat-help-action-legend="${mode}"]`);
      await expect(legend).toContainText(
        "Bookmark a message, pin it in context past the history limit, or add a private note the model never sees.",
      );
    } finally {
      await page.close();
      await request.delete(`/api/chats/${chat.id}`);
    }
  });
}
