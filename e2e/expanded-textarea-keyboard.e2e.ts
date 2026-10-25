import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

async function viewport(page: Page, height: number, offsetTop = 0) {
  await page.evaluate(
    ({ height, offsetTop }) => {
      const visual = window.visualViewport!;
      for (const [key, value] of Object.entries({ height, offsetTop, pageTop: offsetTop })) {
        Object.defineProperty(visual, key, { configurable: true, get: () => value });
      }
      visual.dispatchEvent(new Event("resize"));
    },
    { height, offsetTop },
  );
}

async function visibleLine(field: Locator) {
  return field.evaluate((element: HTMLTextAreaElement) => {
    const box = element.getBoundingClientRect();
    const css = getComputedStyle(element);
    const top = window.visualViewport!.offsetTop;
    const bottom = top + window.visualViewport!.height;
    const lineTop = box.top + parseFloat(css.paddingTop);
    const lineBottom = lineTop + parseFloat(css.lineHeight);
    return {
      lineTop,
      lineBottom,
      top,
      bottom,
      readable:
        box.height - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom) >= parseFloat(css.lineHeight) &&
        lineTop >= top &&
        lineBottom <= bottom &&
        document.elementFromPoint(box.left + 12, (lineTop + lineBottom) / 2) === element,
    };
  });
}

for (const theme of ["dark", "light"] as const) {
  test(`expanded editor keeps its text and controls reachable above the keyboard (${theme})`, async ({
    page,
  }, info) => {
    const mobile = info.project.name.includes("mobile");
    await page.setViewportSize(mobile ? { width: 844, height: 390 } : { width: 1440, height: 900 });
    await isolateSyncedUISettings(page);
    await seedUIState(page, {
      theme,
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      achievementsEnabled: false,
    });
    await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
    await page.goto("/");
    // AppShell re-baselines landscape at 80/320ms after an orientation event, including the initial device rotation.
    if (mobile) await page.waitForTimeout(400);
    // Exercise the real shared component with a caller-supplied footer, as package prompt editors use it.
    await page.evaluate(async () => {
      const { ensureMarinaraHost } = await import("/src/lib/marinara-host.ts" as string);
      const { ExpandedTextarea } = await import("/src/components/ui/ExpandedTextarea.tsx" as string);
      const host = await ensureMarinaraHost();
      const React = host.modules.react;
      const container = document.createElement("div");
      document.body.append(container);
      function EditorFixture() {
        const [value, setValue] = React.useState("Keyboard text");
        const [open, setOpen] = React.useState(true);
        return React.createElement(ExpandedTextarea, {
          open,
          title: "Keyboard regression editor",
          value,
          onChange: setValue,
          onClose: () => setOpen(false),
          footer: React.createElement(
            "button",
            {
              type: "button",
              style: { minHeight: 40 },
              onClick: () => {
                container.dataset.saved = value;
                setOpen(false);
              },
            },
            "Save fixture",
          ),
        });
      }
      container.dataset.keyboardFixture = "";
      host.modules["react-dom/client"].createRoot(container).render(React.createElement(EditorFixture));
    });
    const editor = page.locator('[data-component="ExpandedTextarea"]');
    const field = editor.locator("textarea");
    await expect(field).toBeFocused();
    await field.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(0, 0));
    if (mobile) {
      await viewport(page, 390);
      await viewport(page, 140, 110);
      await expect(page.locator("html")).toHaveAttribute("data-mari-software-keyboard-open", "");
    }
    await expect.poll(() => visibleLine(field)).toMatchObject({ readable: true });
    await field.pressSequentially("Typed ");
    await expect(field).toHaveValue("Typed Keyboard text");
    await expect.poll(() => visibleLine(field)).toMatchObject({ readable: true });
    const proof = info.outputPath(`expanded-${theme}-geometry.json`);
    writeFileSync(proof, JSON.stringify(await visibleLine(field), null, 2));
    await info.attach("readable-first-line", { path: proof, contentType: "application/json" });
    await page.screenshot({ path: info.outputPath(`expanded-${theme}-typing.png`) });
    // Reaching the footer must not depend on dismissing the software keyboard.
    const save = editor.getByRole("button", { name: "Save fixture" });
    await save.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        save.evaluate((button) => {
          const box = button.getBoundingClientRect();
          const vv = window.visualViewport!;
          return box.top >= vv.offsetTop && box.bottom <= vv.offsetTop + vv.height;
        }),
      )
      .toBe(true);
    await save.click();
    await expect(page.locator("[data-keyboard-fixture]")).toHaveAttribute("data-saved", "Typed Keyboard text");
    await expect(editor).toHaveCount(0);
  });
}
