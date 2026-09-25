import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const rendering of ["plain Markdown", "mixed HTML"] as const) {
  test(`Roleplay Markdown blocks follow Chroma and balance paragraph spacing (${rendering})`, async ({
    page,
    request,
  }, testInfo) => {
    const character = await (
      await request.post("/api/characters", { data: { data: { name: "Markdown fixture" } } })
    ).json();
    const chat = await (
      await request.post("/api/chats", {
        data: { name: "Markdown block spacing", mode: "roleplay", characterIds: [character.id] },
      })
    ).json();
    try {
      const blocks = [
        { name: "quote", syntax: "> A quoted passage.", selector: "blockquote", separator: "\n\n" },
        { name: "dashes", syntax: "---", selector: "hr", separator: "\n\n" },
        { name: "stars", syntax: "***", selector: "hr", separator: "\n\n" },
        {
          name: "extra quote",
          syntax: "> Extra blank lines stay intentional.",
          selector: "blockquote",
          separator: "\n\n\n",
        },
      ];
      const markdown = [
        ...blocks.map(
          ({ name, syntax, separator }) => `**Before ${name}.**${separator}${syntax}${separator}**After ${name}.**`,
        ),
        "**First line.**\n**Second line.**\n\n**New paragraph.**\n\n\n**Extra paragraph.**",
        "`---` and `> literal quote` remain inline code.",
      ].join("\n\n");
      const content =
        rendering === "mixed HTML"
          ? markdown.replace(/^\*\*([^*\n]+)\*\*$/gm, "<strong>$1</strong>") +
            '<div><hr title="Raw rule"><br><br><span>Authored rule breaks.</span></div>' +
            '<div><blockquote title="Raw quote">Authored quote.</blockquote><br><br><span>Authored quote breaks.</span></div>' +
            '<PRE title="Raw code"><CODE>First<br>&gt; literal code<br>---<br>***<br>Last</CODE></PRE>' +
            "\n\n```text\nFirst\n> fenced literal\n---\n***\nLast\n```" +
            '\n\n<div title="Adjacent blocks">\n---\n> Adjacent quote.\n***\n</div>' +
            "\n**Bold `inline` continuation.**" +
            '\n<div title="Adjacent headings">\n---\n# Heading after rule\n> Quote before heading.\n## Heading after quote\n---\n-# Caption after rule\n</div>'
          : `${markdown}\n\n> First quoted paragraph.\n>\n> Second quoted paragraph.\n\n\`\`\`text\n---\n\n> literal code\n\`\`\``;
      const message = await (
        await request.post(`/api/chats/${chat.id}/messages`, {
          data: { role: "assistant", characterId: character.id, content },
        })
      ).json();
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      // Exercise Markdown spacing itself, without optional display-time regex cleanup.
      await page.route("**/api/regex-scripts", (route) => route.fulfill({ json: [] }));
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        chatHelpSeenModes: ["roleplay"],
        appAccentPulseMode: false,
        appAccentColor: "#3b82f6",
        chatChromeTextColor: "#3b82f6",
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
      const row = page.locator(`[data-message-id="${message.id}"]`);
      await expect(row.locator(".mari-md-blockquote")).toHaveCount(rendering === "plain Markdown" ? 3 : 4);
      await expect(row.locator(".mari-md-rule")).toHaveCount(rendering === "plain Markdown" ? 2 : 6);
      await expect(row.locator(".mari-md-inline-code")).toHaveText(
        rendering === "plain Markdown" ? ["---", "> literal quote"] : ["---", "> literal quote", "inline"],
      );
      if (rendering === "plain Markdown") {
        await expect(row.locator("pre code")).toHaveText("---\n\n> literal code");
        await expect(row.locator("blockquote").last()).toHaveText(
          "First quoted paragraph.\n\nSecond quoted paragraph.",
        );
      } else {
        for (const code of [row.locator('[title="Raw code"]'), row.locator(".mari-md-codeblock")]) {
          await expect(code.locator("br")).toHaveCount(4);
          await expect(code.locator("hr, blockquote, strong, em")).toHaveCount(0);
        }
        await expect(row.locator('[title="Raw code"] code')).toHaveText("First> literal code---***Last");
        await expect(row.locator(".mari-md-codeblock code")).toHaveText("First> fenced literal---***Last");
        await expect(row.locator('[title="Adjacent blocks"] .mari-md-blockquote')).toHaveText("Adjacent quote.");
        await expect(row.locator('[title="Adjacent blocks"] .mari-md-rule')).toHaveCount(2);
        await expect(row.locator('[title="Adjacent headings"] .mari-md-heading')).toHaveText([
          "Heading after rule",
          "Heading after quote",
        ]);
        await expect(row.locator('[title="Adjacent headings"] .mari-md-subtext')).toHaveText("Caption after rule");
        await expect(row.locator("strong").filter({ has: page.locator("code") })).toHaveText(
          "Bold inline continuation.",
        );
        const rawBreaks = await row
          .locator('[title="Raw rule"], [title="Raw quote"]')
          .evaluateAll((elements) =>
            elements.map((element) => [
              element.nextElementSibling?.tagName,
              element.nextElementSibling?.nextElementSibling?.tagName,
            ]),
          );
        expect(rawBreaks).toEqual([
          ["BR", "BR"],
          ["BR", "BR"],
        ]);
      }
      await page.evaluate(() => document.fonts.ready);

      for (const theme of ["dark", "light"] as const) {
        await page.evaluate(async (theme) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setTheme(theme);
        }, theme);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await row.getByText("Before quote.", { exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath(`markdown-blocks-${theme}.png`), animations: "disabled" });
        const geometry = await row.evaluate((element, blocks) => {
          const strong = (text: string) =>
            [...element.querySelectorAll("strong")].find((node) => node.textContent === text)!;
          const position = (text: string) => strong(text).getBoundingClientRect();
          const gaps = blocks.map(({ name, selector }) => {
            const before = strong(`Before ${name}.`);
            const block = [...element.querySelectorAll(selector)].find((node) =>
              Boolean(before.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING),
            )!;
            const rect = block.getBoundingClientRect();
            return {
              name,
              above: rect.top - before.getBoundingClientRect().bottom,
              below: position(`After ${name}.`).top - rect.bottom,
            };
          });
          const first = position("First line.");
          const second = position("Second line.");
          const paragraph = position("New paragraph.");
          const extra = position("Extra paragraph.");
          return {
            gaps,
            lineStep: second.top - first.top,
            paragraphStep: paragraph.top - second.top,
            extraStep: extra.top - paragraph.top,
          };
        }, blocks);
        await testInfo.attach(`block-geometry-${theme}`, {
          body: JSON.stringify(geometry),
          contentType: "application/json",
        });
        for (const gap of geometry.gaps) {
          expect
            .soft(Math.abs(gap.above - gap.below), `${theme} ${gap.name}: ${JSON.stringify(gap)}`)
            .toBeLessThanOrEqual(1);
        }
        if (rendering === "plain Markdown") {
          expect.soft(geometry.paragraphStep).toBeCloseTo(geometry.lineStep * 2, 0);
          expect.soft(geometry.extraStep).toBeCloseTo(geometry.lineStep * 3, 0);
        }
        await expect.soft(row.locator("blockquote").first()).toHaveCSS("border-top-color", "rgb(59, 130, 246)");
      }
    } finally {
      await request.delete(`/api/chats/${chat.id}`);
      await request.delete(`/api/characters/${character.id}`);
    }
  });
}
