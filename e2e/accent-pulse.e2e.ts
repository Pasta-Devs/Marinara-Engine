import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { MARINARA_GRADIENT_PRESET } from "../packages/client/src/lib/css-colors.js";
import { UI_PERSISTENCE } from "../packages/client/src/lib/ui-persistence.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

async function openAppearance(page: Page) {
  await page.locator('[data-tour="panel-settings"]').click();
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
      await page.locator('[data-tour="panel-settings"]').tap();
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
      await page.locator('[data-tour="panel-settings"]').tap();
      await expect.poll(async () => (await runningHomeAnimations(page)).length).toBeGreaterThan(0);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(root).not.toHaveAttribute("data-marinara-accent-animation");
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await expect(root).toHaveAttribute("data-marinara-accent-animation");
    });
  }
}
