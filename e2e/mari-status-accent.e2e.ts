import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const mariCss = readFileSync(new URL("../packages/client/src/styles/mari.css", import.meta.url), "utf8");

// Exercise only the confirmed delete review action and its Trash icon, using production CSS.
for (const theme of ["light", "dark"] as const) {
  test(`${theme}: Mari delete actions follow the held accent`, async ({ page }) => {
    await page.setContent(`
      <!doctype html><html data-theme="${theme}" data-marinara-accent-animation="pulse"><head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          ${mariCss}
          *, *::before, *::after { transition: none !important; animation: none !important; }
        </style>
      </head><body>
        <article class="mari-card" data-variant="danger" data-needs-you="true">
          <div id="media" class="mari-card__media">Delete</div>
          <button id="delete" class="mari-btn mari-btn--danger">Delete</button>
        </article>
      </body></html>
    `);
    await page.evaluate((theme) => {
      const root = document.documentElement;
      root.style.setProperty("--background", theme === "dark" ? "#050312" : "#faf8ff");
      root.style.setProperty("--foreground", theme === "dark" ? "#d4d4d4" : "#1a1025");
      root.style.setProperty("--primary-foreground", "#0a0a0a");
      root.style.setProperty("--primary", "#ec4899");
      root.style.setProperty("--destructive", "#ef4444");
      root.style.setProperty("--marinara-app-accent-static", "#14b8a6");
    }, theme);

    const samples: Array<[string, string]> = [
      ["media", "color"],
      ["media", "background-color"],
      ["delete", "background-color"],
    ];
    const readColours = () =>
      page.evaluate(
        (samples) =>
          samples.map(([id, property]) => getComputedStyle(document.getElementById(id)!).getPropertyValue(property)),
        samples,
      );
    const first = await readColours();
    await expect(page.locator("#delete")).toHaveCSS("background-color", "rgb(20, 184, 166)");
    await expect(page.locator("#delete")).toHaveCSS("color", "rgb(10, 10, 10)");

    await page.evaluate(() => document.documentElement.style.setProperty("--marinara-app-accent-static", "#6366f1"));
    const selected = await readColours();
    for (const [index, sample] of samples.entries()) {
      expect(selected[index], `${sample.join(": ")} follows a changed accent`).not.toBe(first[index]);
    }
    await expect(page.locator("#delete")).toHaveCSS("background-color", "rgb(99, 102, 241)");
    await page.locator("#delete").hover();
    expect(await readColours(), "hover retains the chosen delete accent").toEqual(selected);

    // Pulse changes the live accent; a destructive action keeps the held choice.
    await page.evaluate(() => {
      for (const variable of ["--primary", "--marinara-app-accent-solid", "--marinara-chat-chrome-accent"]) {
        document.documentElement.style.setProperty(variable, "#22c55e");
      }
    });
    expect(await readColours()).toEqual(selected);
    await page.evaluate(() => document.documentElement.style.setProperty("--primary-foreground", "#faf8ff"));
    await expect(page.locator("#delete")).toHaveCSS("color", "rgb(250, 248, 255)");
  });
}
