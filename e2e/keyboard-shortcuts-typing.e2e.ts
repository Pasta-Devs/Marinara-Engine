import { expect, test } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

for (const theme of ["dark", "light"] as const) {
  test(`question marks reach editable fields across shadow roots in ${theme}`, async ({ page }, info) => {
    await page.setViewportSize(
      info.project.name.includes("mobile") ? { width: 844, height: 390 } : { width: 1440, height: 900 },
    );
    await isolateSyncedUISettings(page);
    await seedUIState(page, {
      theme,
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      achievementsEnabled: false,
    });
    await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
    await page.goto("/");
    // Package UIs use an open shadow root. Keep this host regression independent of installed packages.
    await page.evaluate(() => {
      const fixture = document.createElement("section");
      fixture.dataset.keyboardTypingFixture = "";
      fixture.style.cssText =
        "position:fixed;top:16px;left:16px;right:16px;z-index:80;max-width:800px;padding:16px;" +
        "background:var(--card);color:var(--foreground);border:1px solid var(--border);";
      const fields = `
        <label>Input<input aria-label="Input" type="text"></label>
        <label>Textarea<textarea aria-label="Textarea"></textarea></label>
        <label>Editable<div role="textbox" aria-label="Editable" contenteditable="true"></div></label>`;
      const css = `
        label{display:block;margin:6px 0;font:14px sans-serif}
        input,textarea,[contenteditable]{display:block;box-sizing:border-box;width:100%;height:32px;
          border:1px solid var(--border);padding:4px;background:var(--card);color:var(--foreground)}`;
      const light = document.createElement("div");
      light.dataset.lightFields = "";
      light.innerHTML = `<h2>Document fields</h2>${fields}`;
      for (const element of light.querySelectorAll<HTMLElement>("label")) {
        element.style.cssText = "display:block;margin:6px 0;font:14px sans-serif";
      }
      for (const element of light.querySelectorAll<HTMLElement>("input,textarea,[contenteditable]")) {
        element.style.cssText =
          "display:block;box-sizing:border-box;width:100%;height:32px;border:1px solid var(--border);" +
          "padding:4px;background:var(--card);color:var(--foreground)";
      }
      const shadow = document.createElement("marinara-keyboard-shadow-fixture");
      shadow.attachShadow({ mode: "open" }).innerHTML = `<style>${css}</style><h2>Package fields</h2>${fields}`;
      const columns = document.createElement("div");
      columns.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:16px";
      columns.append(light, shadow);
      const outside = document.createElement("button");
      outside.textContent = "Outside text fields";
      outside.style.cssText = "margin-top:8px;min-height:32px";
      fixture.append(columns, outside);
      document.body.append(fixture);
      const events: unknown[] = [];
      window.addEventListener(
        "keydown",
        (event) => {
          if (event.key !== "?") return;
          const target = event.target instanceof Element ? event.target.tagName : null;
          const path = event.composedPath().map((node) => (node instanceof Element ? node.tagName : null));
          // Native event dispatch can run microtasks between listeners; sample after bubbling finishes.
          window.setTimeout(() => {
            events.push({ key: event.key, target, path, defaultPrevented: event.defaultPrevented });
            fixture.dataset.keyTrace = JSON.stringify(events);
          }, 0);
        },
        { capture: true },
      );
    });
    const fixture = page.locator("[data-keyboard-typing-fixture]");
    const help = page.getByRole("dialog", { name: "Keyboard shortcuts", exact: true });
    const outside = fixture.getByRole("button", { name: "Outside text fields" });
    const results: unknown[] = [];
    try {
      // Verify the real global listener has attached before testing fields during initial app startup.
      await outside.focus();
      await expect(async () => {
        await page.keyboard.press("?");
        await expect(help).toBeVisible({ timeout: 500 });
      }).toPass({ timeout: 10_000 });
      await expect.poll(() => help.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Escape");
      await expect(help).toHaveCount(0);
      // Modal restores its opener on the next animation frame; finish that before focusing an editor.
      await expect(outside).toBeFocused();
      for (const scope of [
        fixture.locator("[data-light-fields]"),
        fixture.locator("marinara-keyboard-shadow-fixture"),
      ]) {
        for (const name of ["Textarea", "Input", "Editable"]) {
          const field = scope.getByRole("textbox", { name, exact: true });
          await field.focus();
          await expect(field).toBeFocused();
          await page.keyboard.press("?");
          try {
            if (name === "Editable") await expect(field).toHaveText("?");
            else await expect(field).toHaveValue("?");
            await expect(help).toHaveCount(0);
          } finally {
            results.push({
              scope: await scope.evaluate((element) => element.tagName),
              field: name,
              value: await field.evaluate((element) =>
                element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
                  ? element.value
                  : element.textContent,
              ),
              helpVisible: await help.isVisible(),
            });
          }
        }
      }
      // The help binding must remain available when focus is outside an editable field.
      await outside.focus();
      await page.keyboard.press("?");
      await expect(help).toBeVisible();
      await page.screenshot({ path: info.outputPath("outside-field-help.png") });
      await page.keyboard.press("Escape");
      await expect(help).toHaveCount(0);
    } finally {
      const proof = info.outputPath("typing-event-paths.json");
      writeFileSync(
        proof,
        JSON.stringify(
          { results, events: JSON.parse((await fixture.getAttribute("data-key-trace")) ?? "[]") },
          null,
          2,
        ),
      );
      await info.attach("typing-event-paths", { path: proof, contentType: "application/json" });
      await page.screenshot({ path: info.outputPath("typing-state.png") });
    }
  });
}
