import { clickTopbarPanel } from "./topbar-navigation.js";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { MARINARA_GRADIENT_PRESET } from "../packages/client/src/lib/css-colors.js";
import { UI_PERSISTENCE } from "../packages/client/src/lib/ui-persistence.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

async function openAppearance(page: Page) {
  await clickTopbarPanel(page, "settings");
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
}

async function readAccentPreferences(page: Page) {
  return page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    const state = useUIStore.getState();
    return {
      color: state.appAccentColor,
      pulse: state.appAccentPulseMode,
      rgb: state.appAccentRgbMode,
      ready: state.settingsSyncReady,
    };
  });
}

test.describe("Marinara accent defaults", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: null } }));
    await page.addInitScript((appVersion) => {
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    }, version);
  });

  for (const theme of ["dark", "light"] as const) {
    test(`default gradient, editable device Pulse, reload and reset (${theme})`, async ({ page }, testInfo) => {
      const desktop = testInfo.project.name.includes("desktop");
      await seedUIState(
        page,
        {
          hasCompletedOnboarding: true,
          rightPanelOpen: false,
          sidebarOpen: false,
          theme,
        },
        "if-missing",
      );
      await page.goto("/");
      await expect
        .poll(() => readAccentPreferences(page))
        .toEqual({
          color: "",
          pulse: desktop,
          rgb: false,
          ready: true,
        });
      const root = page.locator("html");
      await expect
        .poll(() =>
          root.evaluate((element) =>
            getComputedStyle(element).getPropertyValue("--marinara-app-accent-static-gradient").trim(),
          ),
        )
        .toBe(MARINARA_GRADIENT_PRESET);
      await expect(root).toHaveAttribute("data-marinara-chat-chrome-accent-mode", "gradient");
      await openAppearance(page);
      const pulse = page.getByLabel("Accent Pulse", { exact: true });
      await expect(pulse).toBeChecked({ checked: desktop });
      const picker = page.locator("#settings-control-app-accent-color");
      await picker.scrollIntoViewIfNeeded();
      await testInfo.attach(`default-${theme}-appearance.png`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
      await picker.getByRole("button", { name: "Default Marinara Gradient", exact: true }).click();
      for (const [index, color] of ["#ec4b97", "#f29744", "#36cdde"].entries()) {
        await expect(picker.getByRole("textbox", { name: `Edit color stop ${index + 1}`, exact: true })).toHaveValue(
          color,
        );
      }
      await expect(picker.getByRole("button", { name: "Marinara Gradient", exact: true })).toBeVisible();

      // Exercise the actual picker and switch, then preserve both explicit choices through reload.
      await picker.getByRole("button", { name: "Solid", exact: true }).click();
      await picker.getByRole("button", { name: "#1e90ff", exact: true }).click();
      await page.getByText("Accent Pulse", { exact: true }).click();
      await page.reload();
      await expect
        .poll(() => readAccentPreferences(page))
        .toEqual({
          color: "#1e90ff",
          pulse: !desktop,
          rgb: false,
          ready: true,
        });
      // Persisted panel state already reopens Appearance after reload.
      await expect(pulse).toBeChecked({ checked: !desktop });
      await picker.getByRole("button", { name: "Reset to default", exact: true }).click();
      await expect(picker.getByRole("button", { name: "Default Marinara Gradient", exact: true })).toBeVisible();
      await expect(pulse).toBeChecked({ checked: !desktop });
      await picker.getByRole("button", { name: "Default Marinara Gradient", exact: true }).click();
      await picker.getByRole("button", { name: "Gay RGB rainbow", exact: true }).click();
      await picker.getByRole("button", { name: "Marinara Gradient", exact: true }).click();
      // Choosing the default preset restores the existing "follow default" sentinel.
      await expect.poll(async () => (await readAccentPreferences(page)).color).toBe("");
      await page.getByRole("button", { name: "Reset Appearance", exact: true }).click();
      await expect
        .poll(() => readAccentPreferences(page))
        .toEqual({
          color: "",
          pulse: desktop,
          rgb: false,
          ready: true,
        });
      await expect(pulse).toBeChecked({ checked: desktop });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(root).not.toHaveAttribute("data-marinara-accent-animation");
      await expect
        .poll(() =>
          root.evaluate((element) =>
            getComputedStyle(element).getPropertyValue("--marinara-app-accent-gradient").trim(),
          ),
        )
        .toBe(MARINARA_GRADIENT_PRESET);
    });
  }

  test("device defaults survive narrow desktop and wide mobile windows and legacy sync", async ({ page }, testInfo) => {
    const desktop = testInfo.project.name.includes("desktop");
    await page.setViewportSize({ width: desktop ? 600 : 1200, height: 900 });
    await seedUIState(page, { hasCompletedOnboarding: true });
    await page.route("**/api/app-settings/ui", (route) =>
      route.fulfill({
        json: { value: JSON.stringify({ appAccentColor: "#1e90ff", appAccentPulseMode: !desktop }) },
      }),
    );
    await page.goto("/");
    await expect
      .poll(() => readAccentPreferences(page))
      .toEqual({
        color: "#1e90ff",
        pulse: desktop,
        rgb: false,
        ready: true,
      });
  });

  test("a custom theme supplies the steady accent without Pulse and yields to an explicit picker choice", async ({
    page,
  }) => {
    await page.route("**/api/themes", (route) =>
      route.fulfill({
        json: [{ id: "steady-accent", name: "Steady accent", css: ":root { --primary: #14b8a6; }", isActive: true }],
      }),
    );
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      appAccentColor: "",
      appAccentPulseMode: false,
      appAccentRgbMode: false,
    });
    await page.goto("/");
    await expect.poll(async () => (await readAccentPreferences(page)).ready).toBe(true);
    const root = page.locator("html");
    await expect(page.locator("#marinara-custom-theme")).toHaveCount(1);
    for (const [picker, expected] of [
      ["", "#14b8a6"],
      ["#6366f1", "#6366f1"],
      ["", "#14b8a6"],
    ]) {
      await page.evaluate(async (color) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setAppAccentColor(color);
      }, picker);
      await expect
        .poll(() =>
          root.evaluate((element) => getComputedStyle(element).getPropertyValue("--marinara-app-accent-static").trim()),
        )
        .toBe(expected);
      await expect(root).not.toHaveAttribute("data-marinara-accent-animation");
    }
  });

  for (const legacyColor of ["", "linear-gradient(90deg, #1e90ff, #22a6b3)"]) {
    test(`legacy RGB keeps its animation choice (${legacyColor ? "gradient" : "scheme default"})`, async ({ page }) => {
      await page.addInitScript(
        ({ persistence, color }) => {
          localStorage.setItem(
            persistence.name,
            JSON.stringify({
              version: 60,
              state: {
                hasCompletedOnboarding: true,
                chibiProfessorMariEnabled: false,
                appAccentColor: color,
                appAccentRgbMode: true,
              },
            }),
          );
        },
        { persistence: UI_PERSISTENCE, color: legacyColor },
      );
      await page.goto("/");
      await expect
        .poll(() => readAccentPreferences(page))
        .toEqual({
          color: legacyColor,
          pulse: !legacyColor,
          rgb: !!legacyColor,
          ready: true,
        });
    });
  }

  test("new relationship and timer widgets follow the accent while saved colors survive", async ({ page }) => {
    await seedUIState(page, { hasCompletedOnboarding: true });
    await page.goto("/");
    const widgets = await page.evaluate(async () => {
      const { createDefaultGameHudWidget, normalizeGameHudWidgets } = await import(
        "/src/components/game/GameWidgetSetupEditor.tsx" as string
      );
      return ["relationship_meter", "timer"].map((type) => {
        const widget = createDefaultGameHudWidget(type, []);
        const [saved] = normalizeGameHudWidgets([{ ...widget, accent: "#f472b6" }]);
        return { defaultAccent: widget.accent, savedAccent: saved.accent };
      });
    });
    expect(widgets).toEqual([
      { defaultAccent: "var(--marinara-chat-chrome-accent)", savedAccent: "#f472b6" },
      { defaultAccent: "var(--marinara-chat-chrome-accent)", savedAccent: "#f472b6" },
    ]);
  });

  for (const savedPulse of [undefined, false, true]) {
    test(`legacy preferences preserve color and Pulse=${String(savedPulse)}`, async ({ page }, testInfo) => {
      await page.addInitScript(
        ({ persistence, pulse }) => {
          localStorage.setItem(
            persistence.name,
            JSON.stringify({
              version: 100,
              state: {
                hasCompletedOnboarding: true,
                chibiProfessorMariEnabled: false,
                appAccentColor: "#d4acfb",
                appAccentPulseMode: pulse,
              },
            }),
          );
        },
        { persistence: UI_PERSISTENCE, pulse: savedPulse },
      );
      await page.goto("/");
      await expect
        .poll(() => readAccentPreferences(page))
        .toEqual({
          color: "#d4acfb",
          pulse: savedPulse ?? testInfo.project.name.includes("desktop"),
          rgb: false,
          ready: true,
        });
    });
  }
});

async function runningHomeAnimations(page: Page) {
  return page.locator('[data-component="HomeBrowserHub"]').evaluate((home) =>
    home
      .getAnimations({ subtree: true })
      .filter((animation) => animation.playState === "running" && animation.effect?.getTiming().iterations === Infinity)
      .map((animation) => (animation instanceof CSSAnimation ? animation.animationName : "other")),
  );
}

for (const color of ["#a78bfa", "linear-gradient(90deg, #a78bfa, #ec4899, #22d3ee)"]) {
  for (const theme of ["dark", "light"] as const) {
    test(`mobile Accent Pulse keeps idle settings quiet (${color.startsWith("#") ? "solid" : "gradient"}, ${theme})`, async ({
      page,
    }, testInfo) => {
      test.skip(!testInfo.project.name.includes("mobile"), "Touch-screen rendering budget.");
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        rightPanelOpen: false,
        sidebarOpen: false,
        appAccentColor: color,
        appAccentPulseMode: true,
        appAccentRgbMode: false,
        theme,
      });
      await page.addInitScript((appVersion) => {
        localStorage.setItem("marinara:whats-new:seen-version", appVersion);
      }, version);
      // Keep another browser project's synced Appearance choices out of this fixture.
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: null } }));
      await page.goto("/");
      await clickTopbarPanel(page, "settings", "tap");
      await page.getByRole("tab", { name: "Appearance", exact: true }).tap();
      await expect(page.getByLabel("Accent Pulse", { exact: true })).toBeChecked();
      const root = page.locator("html");
      await expect(root).toHaveAttribute("data-marinara-accent-animation");
      const firstAccent = await root.evaluate((element) => element.style.getPropertyValue("--primary"));
      await expect
        .poll(() => root.evaluate((element) => element.style.getPropertyValue("--primary")))
        .not.toBe(firstAccent);

      // Sample real transition events while idle, rather than asserting a CSS rule's text.
      const rendering = await page.evaluate(async () => {
        const paintTransitions = new Set<string>();
        const onTransition = (event: TransitionEvent) => {
          if (/color|shadow|filter|background/i.test(event.propertyName)) paintTransitions.add(event.propertyName);
        };
        document.addEventListener("transitionrun", onTransition);
        const before = document.documentElement.style.getPropertyValue("--primary");
        try {
          await new Promise((resolve) => setTimeout(resolve, 2_500));
          return {
            paintTransitions: [...paintTransitions],
            before,
            after: document.documentElement.style.getPropertyValue("--primary"),
          };
        } finally {
          document.removeEventListener("transitionrun", onTransition);
        }
      });
      expect(rendering.after).not.toBe(rendering.before);
      expect(rendering.paintTransitions).toEqual([]);
      await expect.poll(() => runningHomeAnimations(page)).toEqual([]);
      await testInfo.attach("idle-appearance.png", { body: await page.screenshot(), contentType: "image/png" });

      // Returning to Home restores its visible ambient effects.
      await clickTopbarPanel(page, "settings", "tap");
      await expect.poll(async () => (await runningHomeAnimations(page)).length).toBeGreaterThan(0);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(root).not.toHaveAttribute("data-marinara-accent-animation");
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await expect(root).toHaveAttribute("data-marinara-accent-animation");
    });
  }
}

for (const theme of ["dark", "light"] as const) {
  test(`shared shell borders and mobile bookmarks follow the selected accent (${theme})`, async ({ page }, info) => {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: null } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chibiProfessorMariEnabled: false,
      appAccentColor: "#3b82f6",
      appAccentPulseMode: false,
      theme,
    });
    await page.addInitScript((appVersion) => {
      localStorage.removeItem("marinara-active-chat-id");
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    }, version);
    await page.goto("/");
    const home = page.locator('[data-component="HomeBrowserHub"]');
    // Wait for the cold Home chunk before checking the rendered shell surfaces.
    await expect(home).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => (await readAccentPreferences(page)).ready).toBe(true);
    await page.screenshot({ path: info.outputPath(`home-borders-${theme}.png`), animations: "disabled" });
    const renderedColor = (expression: string) =>
      page.evaluate((color) => {
        const probe = document.createElement("span");
        probe.style.color = color;
        document.body.append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      }, expression);
    const borderMix = theme === "dark" ? 20 : 27;
    for (const color of ["#3b82f6", "#14b8a6"]) {
      await page.evaluate(async (accent) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setAppAccentColor(accent);
      }, color);
      await expect.poll(async () => (await readAccentPreferences(page)).color).toBe(color);
      const border = `color-mix(in srgb, ${color} ${borderMix}%, transparent)`;
      await expect(home.locator(":scope > div")).toHaveCSS(
        "border-top-color",
        await renderedColor(`color-mix(in oklab, ${border} 75%, transparent)`),
      );
      const bookmark = page.locator('[data-component="HomeBrowserHub.MobileBookmarksTrigger"]');
      if (info.project.name.includes("mobile")) {
        await expect(bookmark).toHaveCSS("color", await renderedColor(color));
        await bookmark.tap();
        await expect(bookmark).toHaveAttribute("aria-expanded", "true");
        await expect(bookmark).toHaveCSS("color", await renderedColor(color));
        await bookmark.tap();
      }
      await clickTopbarPanel(page, "settings");
      await page.getByRole("tab", { name: "Appearance", exact: true }).click();
      await expect(page.locator(".mari-right-panel:visible")).toHaveCSS(
        "background-color",
        await renderedColor("var(--sidebar)"),
      );
      await expect(page.locator(".mari-right-panel-header:visible")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(page.locator("#settings-section-app-style")).toHaveCSS(
        "background-color",
        await renderedColor("color-mix(in oklab, var(--sidebar) 35%, transparent)"),
      );
      await expect(page.locator("#settings-control-theme-mode select")).toHaveCSS(
        "background-color",
        await renderedColor("var(--sidebar)"),
      );
      const settingsHeader = page.locator(".mari-right-panel-header:visible > div.absolute");
      await expect(settingsHeader).toHaveCSS(
        "background-color",
        await renderedColor(`color-mix(in oklab, ${border} 30%, transparent)`),
      );
      const modes = page.getByRole("group", { name: "Appearance by chat mode", exact: true });
      await expect(modes).toHaveCSS("border-top-color", await renderedColor(border));
      await expect(modes.getByRole("button", { name: "App", exact: true })).toHaveCSS(
        "border-right-color",
        await renderedColor(border),
      );
      await expect(page.getByRole("tab", { name: "General", exact: true }).locator("span").first()).toHaveCSS(
        "border-top-color",
        await renderedColor(`color-mix(in oklab, ${border} 55%, transparent)`),
      );
      await expect(page.getByRole("button", { name: /^Quick Access/u }).locator("../..")).toHaveCSS(
        "border-top-color",
        await renderedColor(`color-mix(in oklab, ${border} 60%, transparent)`),
      );
      if (!info.project.name.includes("mobile")) {
        const edgeColor = await renderedColor(`color-mix(in srgb, ${color} 14%, var(--background) 86%)`);
        await expect
          .poll(() =>
            page
              .locator(".mari-right-panel.mari-shell-panel-edge:visible")
              .evaluate((element) => getComputedStyle(element, "::after").backgroundColor),
          )
          .toBe(edgeColor);
      }
      await page.screenshot({
        path: info.outputPath(`settings-borders-${theme}-${color.slice(1)}.png`),
        animations: "disabled",
      });
      if (!info.project.name.includes("mobile")) {
        const pointerSetting = page.locator("#settings-control-custom-cursor");
        await pointerSetting.hover();
        await expect(pointerSetting).toHaveCSS(
          "background-color",
          await renderedColor("color-mix(in oklab, var(--marinara-chat-chrome-highlight-bg) 50%, transparent)"),
        );
        await page.mouse.move(0, 0);
      }
      await clickTopbarPanel(page, "settings");
    }
  });
}

for (const theme of ["dark", "light"] as const) {
  test(`legacy package frames inherit the host accent without replacing app branding (${theme})`, async ({ page }) => {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: null } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      appAccentColor: "#20b080",
      appAccentPulseMode: false,
      appAccentRgbMode: false,
      theme,
    });
    await page.goto("/");
    await expect.poll(async () => (await readAccentPreferences(page)).ready).toBe(true);
    await page.evaluate(() => {
      const fixture = document.createElement("div");
      fixture.id = "legacy-package-accent-proof";
      // Old published bundles append this scoped copy of Engine defaults after the host stylesheet.
      fixture.innerHTML = ["noodle", "slurp", "slurp2"]
        .map(
          (id) => `
          <style>@scope (marinara-capability-${id}, [data-marinara-capability-scope="${id}"]) {
            :scope {
              --primary: #ec4b97;
              --marinara-app-accent-solid: var(--primary);
              --marinara-chat-chrome-accent: var(--marinara-app-accent-solid);
              --marinara-chat-chrome-panel-border: color-mix(in srgb, var(--marinara-chat-chrome-accent) 16%, transparent);
            }
          }</style>
          <marinara-capability-${id} class="legacy-accent-frame" style="border:1px solid var(--marinara-chat-chrome-panel-border)"></marinara-capability-${id}>
          <div data-marinara-capability-scope="${id}" class="legacy-accent-frame" style="border:1px solid var(--marinara-chat-chrome-panel-border)">
            <span class="legacy-brand" style="--noodle-accent:${id === "noodle" ? "#7ea7ff" : "#ff7ec1"};color:var(--noodle-accent)"></span>
          </div>`,
        )
        .join("");
      document.body.append(fixture);
    });
    for (const accent of ["#20b080", "#8060ff"]) {
      await page.evaluate(async (color) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setAppAccentColor(color);
      }, accent);
      const border = await page.evaluate((color) => {
        const reference = document.createElement("span");
        reference.style.border = `1px solid color-mix(in srgb, ${color} 16%, transparent)`;
        document.body.append(reference);
        const rendered = getComputedStyle(reference).borderTopColor;
        reference.remove();
        return rendered;
      }, accent);
      await expect
        .poll(() =>
          page.locator("#legacy-package-accent-proof .legacy-accent-frame").evaluateAll((frames) =>
            frames.map((frame) => ({
              accent: getComputedStyle(frame).getPropertyValue("--marinara-chat-chrome-accent").trim(),
              border: getComputedStyle(frame).borderTopColor,
            })),
          ),
        )
        .toEqual(
          Array.from({ length: 6 }, () => ({
            accent,
            border,
          })),
        );
    }
    await expect(page.locator(".legacy-brand").nth(0)).toHaveCSS("color", "rgb(126, 167, 255)");
    await expect(page.locator(".legacy-brand").nth(1)).toHaveCSS("color", "rgb(255, 126, 193)");
    await expect(page.locator(".legacy-brand").nth(2)).toHaveCSS("color", "rgb(255, 126, 193)");
    const explicitTheme = page.locator('#legacy-package-accent-proof [data-marinara-capability-scope="slurp2"]');
    await explicitTheme.evaluate((element) => {
      (element as HTMLElement).style.setProperty("--marinara-chat-chrome-accent", "#ff7ec1");
    });
    expect(
      await explicitTheme.evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--marinara-chat-chrome-accent").trim(),
      ),
    ).toBe("#ff7ec1");
  });
}
