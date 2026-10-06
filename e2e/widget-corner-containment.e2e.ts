import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openChatSettings } from "./chat-settings-tools.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;
const UI_SETTINGS_PATH = "/api/app-settings/ui";
const DETACHED_ID = "drawer:chat-settings:chat-name";

/** Decode the browser's actual screenshot, not a canvas recreation of the CSS. */
async function readPixels(page: Page, screenshot: Buffer) {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    return Array.from(context.getImageData(0, 0, image.width, image.height).data);
  }, screenshot.toString("base64"));
}

async function expectClearCorner(page: Page, window: Locator, label: string, expectedBlur?: string) {
  await expect(window).toBeVisible();
  // A detached drawer animates in with a transform. Settle it before reading
  // geometry; screenshot's animation freeze otherwise moves the frame after
  // the crop coordinates have already been measured.
  await window.evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  if (expectedBlur) {
    await expect
      .poll(() => window.evaluate((element) => getComputedStyle(element, "::after").backdropFilter))
      .toBe(expectedBlur);
  }
  // A sharp scene makes an otherwise nearly invisible rectangular backdrop blur
  // measurable. Exclude the legitimate decorative shadow from this paint proof.
  const originalStyle = await window.getAttribute("style");
  await window.evaluate((element) => {
    const root = element as HTMLElement;
    root.style.setProperty("filter", "none", "important");
    const rect = root.getBoundingClientRect();
    const scene = document.createElement("div");
    scene.id = "corner-containment-scene";
    Object.assign(scene.style, {
      position: "fixed",
      pointerEvents: "none",
      left: `${rect.left - 30}px`,
      top: `${rect.top - 30}px`,
      width: `${rect.width + 60}px`,
      height: `${rect.height + 60}px`,
      zIndex: String(Number(getComputedStyle(root).zIndex) - 1),
      background: "repeating-conic-gradient(#102640 0 25%, #f0ecd8 0 50%) 0 0 / 4px 4px",
    });
    root.parentElement!.insertBefore(scene, root);
  });
  try {
    const box = (await window.boundingBox())!;
    const clip = { x: Math.floor(box.x + box.width) - 16, y: Math.floor(box.y), width: 16, height: 16 };
    const paintedPath = test.info().outputPath(`${label}-corner.png`);
    const scenePath = test.info().outputPath(`${label}-scene.png`);
    const painted = await page.screenshot({ clip, scale: "css", animations: "disabled", path: paintedPath });
    await window.evaluate((element) => ((element as HTMLElement).style.visibility = "hidden"));
    const behind = await page.screenshot({ clip, scale: "css", animations: "disabled", path: scenePath });
    await window.evaluate((element) => ((element as HTMLElement).style.visibility = ""));
    const [actual, expected] = await Promise.all([readPixels(page, painted), readPixels(page, behind)]);
    const differences: number[] = [];
    // Stay several pixels outside the diagonal (x + y < 14), away from its
    // antialiasing. Compare RGB rather than compressed PNG byte identity.
    for (let y = 2; y <= 4; y++) {
      for (let right = 2; right <= 4; right++) {
        const pixel = (y * 16 + 16 - right) * 4;
        for (let channel = 0; channel < 3; channel++) {
          differences.push(Math.abs(actual[pixel + channel]! - expected[pixel + channel]!));
        }
      }
    }
    await test.info().attach(`${label}-corner`, { path: paintedPath, contentType: "image/png" });
    await test.info().attach(`${label}-scene`, { path: scenePath, contentType: "image/png" });
    expect(Math.max(...differences), `${label}: the cut-out must reveal unchanged scenery`).toBeLessThanOrEqual(2);
    // The inner surface must still paint; accidentally hiding the entire frame
    // would also make the outside pixels match.
    const insidePixel = (13 * 16 + 2) * 4;
    expect(
      actual.slice(insidePixel, insidePixel + 3),
      `${label}: the header inside the cut must remain visible`,
    ).not.toEqual(expected.slice(insidePixel, insidePixel + 3));
  } finally {
    await window.evaluate((element, style) => {
      if (style === null) element.removeAttribute("style");
      else element.setAttribute("style", style);
      document.getElementById("corner-containment-scene")?.remove();
    }, originalStyle);
  }
}

test("Dottore windows keep scene blur and custom paint inside their cut corners", async ({ page, request }) => {
  test.setTimeout(120_000);
  const original = (await (await request.get(UI_SETTINGS_PATH)).json()) as { value: string | null };
  let chatId: string | undefined;
  try {
    expect((await request.put(UI_SETTINGS_PATH, { data: { value: "" } })).ok()).toBeTruthy();
    const response = await request.post("/api/chats", {
      data: { name: "Corner containment proof", mode: "conversation", characterIds: [] },
    });
    expect(response.ok()).toBeTruthy();
    chatId = ((await response.json()) as { id: string }).id;
    expect(
      (
        await request.patch(`/api/chats/${chatId}/metadata`, {
          data: { windowLayout: null, chatSettingsHintDismissed: true, enableAgents: false },
        })
      ).ok(),
    ).toBeTruthy();
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatSettingsMoveTipDismissed: true,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
      appAccentPulseMode: false,
      appAccentRgbMode: false,
      theme: "dark",
    });
    await page.addInitScript(
      ({ chatId, version }) => {
        localStorage.setItem("marinara-active-chat-id", chatId);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { chatId, version: APP_VERSION },
    );
    await page.goto("/");
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          return useUIStore.getState().settingsSyncReady;
        }),
      )
      .toBe(true);
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().setChatWidgetPreset("dottore");
    });
    for (const theme of ["dark", "light"] as const) {
      await page.evaluate(async (theme) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setTheme(theme);
      }, theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      for (const paint of ["preset", "gradient", "custom-theme"] as const) {
        await page.evaluate(async (paint) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          const state = useUIStore.getState();
          state.setChatWidgetBorderColor(paint === "gradient" ? "linear-gradient(90deg, #ffd93d, #ff6b6b)" : "");
          state.setChatWidgetBackgroundColor(paint === "gradient" ? "linear-gradient(135deg, #667eea, #764ba2)" : "");
        }, paint);
        const customTheme =
          paint === "custom-theme"
            ? await page.addStyleTag({
                content:
                  ".mari-window { --mari-window-bg: rgb(197 218 241 / .75); --mari-window-header-bg: rgb(123 230 239 / .65); --mari-window-backdrop-filter: blur(20px); }",
              })
            : null;
        try {
          const settings = await openChatSettings(page);
          const expectedBlur = paint === "custom-theme" ? "blur(20px)" : undefined;
          await expectClearCorner(page, settings, `${theme}-${paint}-settings`, expectedBlur);
          await settings.locator('[data-drawer="chat-name"] [data-drawer-control="pop-out"]').click();
          // Opening through the shared store isolates this frame proof from the
          // separate phone launcher/menu presentation being tested elsewhere.
          await page.evaluate(async (id) => {
            const { useFloatingWindowStore } = await import("/src/stores/floating-window.store.ts" as string);
            useFloatingWindowStore.getState().openWindow(id);
          }, DETACHED_ID);
          const detached = page.locator(`.mari-window[data-window="${DETACHED_ID}"]`);
          await expectClearCorner(page, detached, `${theme}-${paint}-detached`, expectedBlur);
          await detached.locator('[data-window-control="put-back"]').click();
          await expect(detached).toHaveCount(0);
        } finally {
          await customTheme?.evaluate((element) => element.parentNode?.removeChild(element));
        }
      }
    }
    // Non-cut presets keep a single backdrop pass, including when a custom
    // border creates the decorative pseudo-element and a theme sets local blur.
    const customBlur = await page.addStyleTag({
      content: ".mari-window { --mari-window-backdrop-filter: blur(20px); }",
    });
    try {
      for (const preset of ["default", "mari"] as const) {
        await page.evaluate(async (preset) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          const state = useUIStore.getState();
          state.setChatWidgetPreset(preset);
          state.setChatWidgetBorderColor("linear-gradient(90deg, #ffd93d, #ff6b6b)");
        }, preset);
        const settings = await openChatSettings(page);
        await expect(settings).toHaveCSS("backdrop-filter", "blur(20px)");
        await expect
          .poll(() =>
            settings.evaluate((element) => {
              const frame = getComputedStyle(element, "::after");
              return { painted: frame.content !== "none", blur: frame.backdropFilter };
            }),
          )
          .toEqual({ painted: true, blur: "none" });
      }
    } finally {
      await customBlur.evaluate((element) => element.parentNode?.removeChild(element));
    }
  } finally {
    try {
      await page.close();
    } finally {
      await request.put(UI_SETTINGS_PATH, { data: { value: original.value ?? "" } });
      if (chatId) await request.delete(`/api/chats/${chatId}?force=true`);
    }
  }
});
