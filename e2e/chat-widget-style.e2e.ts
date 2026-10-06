import { expect, test, type APIRequestContext, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { closeChatSettings, openChatSettings, openChatTool } from "./chat-settings-tools.js";
import { clickTopbarPanel } from "./topbar-navigation.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;
const UI_SETTINGS_PATH = "/api/app-settings/ui";
const CHAT_NAME_WINDOW = "drawer:chat-settings:chat-name";
type Preset = "default" | "dottore" | "mari";
const EMPTY_COLORS = { border: "", background: "", text: "" };
const APPLY_NONE = { font: false, shape: false, colors: false };
const GRADIENT_COLORS = {
  border: "linear-gradient(90deg, #ff6b6b, #ffd93d)",
  background: "linear-gradient(135deg, #667eea, #764ba2)",
  text: "linear-gradient(90deg, #6c5ce7, #00cec9)",
};
const PALETTES = {
  dark: {
    dottore: { background: "oklch(0.235 0.03 252)", accent: "oklch(0.83 0.095 218)", field: "oklch(0.275 0.035 250)" },
    mari: { background: "oklch(0.235 0.035 275)", accent: "oklch(0.8 0.08 82)", field: "oklch(0.27 0.035 275)" },
  },
  light: {
    dottore: {
      background: "oklch(0.965 0.014 238)",
      accent: "oklch(0.415 0.075 230)",
      field: "oklch(0.935 0.023 243)",
    },
    mari: { background: "oklch(0.975 0.012 80)", accent: "oklch(0.425 0.088 253)", field: "oklch(0.95 0.018 268)" },
  },
} as const;

async function createChat(request: APIRequestContext) {
  const response = await request.post("/api/chats", {
    data: { name: "Widget appearance proof", mode: "conversation", characterIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  expect(
    (
      await request.patch(`/api/chats/${chat.id}/metadata`, {
        data: { windowLayout: null, chatSettingsHintDismissed: true, enableAgents: false },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", content: "Arrange this chat however you like." },
      })
    ).ok(),
  ).toBeTruthy();
  return chat;
}

async function prepare(target: Page | BrowserContext, chatId: string, theme: "dark" | "light") {
  await seedUIState(
    target,
    {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatSettingsMoveTipDismissed: true,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
      appAccentPulseMode: false,
      appAccentRgbMode: false,
      theme,
    },
    "if-missing",
  );
  await target.addInitScript(
    ({ chatId, version }) => {
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem("marinara-active-chat-id", chatId);
    },
    { chatId, version: APP_VERSION },
  );
}

async function readPreferences(page: Page) {
  return page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    const state = useUIStore.getState();
    return {
      preset: state.chatWidgetPreset,
      font: state.chatWidgetFont,
      shape: state.chatWidgetShape,
      colors: {
        border: state.chatWidgetBorderColor,
        background: state.chatWidgetBackgroundColor,
        text: state.chatWidgetTextColor,
      },
      apply: {
        font: state.chatWidgetApplyFont,
        shape: state.chatWidgetApplyShape,
        colors: state.chatWidgetApplyColors,
      },
      ready: state.settingsSyncReady,
    };
  });
}

async function openAppearance(page: Page) {
  await closeChatSettings(page);
  await clickTopbarPanel(page, "settings");
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  await page
    .getByRole("group", { name: "Appearance by chat mode", exact: true })
    .getByRole("button", { name: "App", exact: true })
    .click();
  const controls = page.locator("[data-chat-widget-style-controls]");
  await controls.scrollIntoViewIfNeeded();
  await expect(controls).toBeVisible();
  await expect(controls).toHaveCSS("border-top-width", "0px");
  const cards = controls.locator("[data-chat-widget-preset-option]");
  await expect(cards).toHaveCount(3);
  await expect
    .poll(() =>
      cards.evaluateAll((elements) => Math.min(...elements.map((element) => element.getBoundingClientRect().width))),
    )
    .toBeGreaterThanOrEqual(150);
  for (const preset of ["dottore", "mari"]) {
    const insets = await controls
      .locator(`[data-chat-widget-preset-option="${preset}"] .mari-window`)
      .evaluate((element) => {
        const frame = element.getBoundingClientRect();
        const title = element.querySelector(".mari-window__title")!.getBoundingClientRect();
        const close = element.querySelector(".mari-window__header > svg")!.getBoundingClientRect();
        return { title: title.left - frame.left, close: frame.right - close.right };
      });
    expect(insets.title).toBeGreaterThanOrEqual(12);
    expect(insets.close).toBeGreaterThanOrEqual(12);
  }
  const root = page.locator("html");
  const originalAnimation = await root.getAttribute("data-marinara-accent-animation");
  const theme = (await root.getAttribute("data-theme")) as "dark" | "light";
  await root.evaluate((element) => element.setAttribute("data-marinara-accent-animation", "pulse"));
  try {
    for (const preset of ["dottore", "mari"] as const) {
      const preview = controls.locator(`[data-chat-widget-preview][data-chat-widget-preset="${preset}"]`);
      const customBorder = await preview.evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--mari-widget-custom-border-solid").trim(),
      );
      const accent = await resolvedStyle(page, "color", customBorder || PALETTES[theme][preset].accent);
      for (const selector of [".mari-window__header > svg", ".mari-drawer__icon", ".mari-drawer__arrow"]) {
        await expect(preview.locator(selector)).toHaveCSS("color", accent);
      }
      const bubble = preview.locator(".mari-window-bubble");
      await expect(bubble.locator("svg")).toHaveCSS(
        "color",
        await bubble.evaluate((element) => getComputedStyle(element).color),
      );
    }
  } finally {
    await root.evaluate((element, value) => {
      if (value === null) element.removeAttribute("data-marinara-accent-animation");
      else element.setAttribute("data-marinara-accent-animation", value);
    }, originalAnimation);
  }
  return controls;
}

async function setChatStyleApplication(controls: Locator, role: keyof typeof APPLY_NONE, enabled: boolean) {
  const label = `Apply preset ${role}`;
  const checkbox = controls.getByRole("checkbox", { name: label, exact: true });
  if ((await checkbox.isChecked()) !== enabled) await controls.getByText(label, { exact: true }).click();
  await expect(checkbox).toBeChecked({ checked: enabled });
  if (enabled) await expect(controls.page().locator("html")).toHaveAttribute(`data-chat-widget-apply-${role}`, "true");
  else await expect(controls.page().locator("html")).not.toHaveAttribute(`data-chat-widget-apply-${role}`);
}

async function choosePreset(page: Page, preset: Preset) {
  const apply = (await readPreferences(page)).apply;
  const controls = await openAppearance(page);
  const button = controls.locator(`[data-chat-widget-preset-option="${preset}"]`);
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => readPreferences(page))
    .toEqual({ preset, font: "", shape: "preset", colors: EMPTY_COLORS, apply, ready: true });
  if (preset === "default") await expect(page.locator("html")).not.toHaveAttribute("data-chat-widget-preset");
  else await expect(page.locator("html")).toHaveAttribute("data-chat-widget-preset", preset);
  if (preset !== "default") {
    await page.screenshot({
      path: test.info().outputPath(`chat-widget-preview-${preset}.png`),
      animations: "disabled",
    });
  }
  await clickTopbarPanel(page, "settings");
  await expect(controls).toBeHidden();
}

async function computedAppearance(element: Locator) {
  return element.evaluate(async (node) => {
    await Promise.all(
      node
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
    const style = getComputedStyle(node);
    return {
      background: style.backgroundColor,
      image: style.backgroundImage,
      color: style.color,
      border: style.borderTopColor,
      radius: style.borderRadius,
      clip: style.clipPath,
      font: style.fontFamily,
    };
  });
}

async function resolvedStyle(page: Page, property: string, value: string) {
  return page.evaluate(
    ({ property, value }) => {
      const probe = document.createElement("span");
      probe.style.setProperty(property, value);
      document.body.appendChild(probe);
      const resolved = getComputedStyle(probe).getPropertyValue(property);
      probe.remove();
      return resolved;
    },
    { property, value },
  );
}

async function expectColorPaintValidation(page: Page) {
  const result = await page.evaluate(async () => {
    const { getChatWidgetPaint, getChatWidgetColorStyle } = await import("/src/lib/chat-widget-colors.ts" as string);
    const conic = getChatWidgetColorStyle({ border: "conic-gradient(from 45deg, #123456, #abcdef)" });
    return {
      rejected: ["url(https://example.invalid/image.png)", "red; color: blue", "not-a-color"].map(getChatWidgetPaint),
      solid: getChatWidgetPaint(" #123456 "),
      conicFirstStop: conic["--mari-widget-custom-border-solid"],
    };
  });
  expect(result).toEqual({ rejected: ["", "", ""], solid: "#123456", conicFirstStop: "#123456" });
}

async function setGradientColors(controls: Locator) {
  for (const role of ["border", "background", "text"] as const) {
    const picker = controls.locator(`[data-chat-widget-color="${role}"]`);
    const trigger = picker.locator(":scope > div > button");
    await trigger.click();
    await picker.getByRole("button", { name: "Gradient", exact: true }).click();
    await picker.getByTitle(GRADIENT_COLORS[role], { exact: true }).click();
    await trigger.click();
  }
}

async function paintedImages(element: Locator) {
  return element.evaluate((node) =>
    [node, ...node.querySelectorAll(":scope > .mari-window-bubble__paint")].flatMap((layer) =>
      [null, "::before", "::after"].flatMap((pseudo) => {
        const style = getComputedStyle(layer, pseudo);
        return [style.backgroundImage, style.borderImageSource];
      }),
    ),
  );
}

async function previewAppearance(preview: Locator) {
  return {
    window: await computedAppearance(preview.locator(".mari-window")),
    frame: await paintedImages(preview.locator(".mari-window")),
    title: await computedAppearance(preview.locator(".mari-window__title")),
    icon: await computedAppearance(preview.locator(".mari-drawer__icon")),
    bubble: await computedAppearance(preview.locator(".mari-window-bubble")),
    bubblePaint: await paintedImages(preview.locator(".mari-window-bubble")),
  };
}

async function expectGradientWidgets(page: Page, settings: Locator, bubble: Locator) {
  for (const role of ["border", "background", "text"] as const) {
    await expect(page.locator("html")).toHaveAttribute("data-chat-widget-colors", new RegExp(`\\b${role}\\b`));
    await expect
      .poll(() =>
        page
          .locator("html")
          .evaluate(
            (element, key) => getComputedStyle(element).getPropertyValue(`--mari-widget-custom-${key}`).trim(),
            role,
          ),
      )
      .toBe(GRADIENT_COLORS[role]);
  }
  for (const target of [settings, bubble]) {
    for (const role of ["border", "background"] as const) {
      const expected = await resolvedStyle(page, "background-image", GRADIENT_COLORS[role]);
      await expect.poll(async () => (await paintedImages(target)).join("\n")).toContain(expected);
    }
  }
  const iconColor = await resolvedStyle(page, "color", "#ff6b6b");
  await expect(bubble.locator("svg").first()).toHaveCSS("color", iconColor);
  await expect(settings.locator(".mari-drawer__icon").first()).toHaveCSS("color", iconColor);
  const title = settings.locator(".mari-window__title");
  await expect(title).toHaveCSS(
    "background-image",
    await resolvedStyle(page, "background-image", GRADIENT_COLORS.text),
  );
  await expect(title).toHaveCSS("-webkit-text-fill-color", "rgba(0, 0, 0, 0)");
}

async function exerciseColorControls(page: Page, preset: Preset, theme: "dark" | "light") {
  let controls = await openAppearance(page);
  const untouched = [];
  for (const other of ["default", "dottore", "mari"] as const) {
    if (other !== preset) {
      const preview = controls.locator(`[data-chat-widget-preview][data-chat-widget-preset="${other}"]`);
      untouched.push({ preset: other, appearance: await previewAppearance(preview) });
    }
  }
  const selected = controls.locator(`[data-chat-widget-preview][data-chat-widget-preset="${preset}"]`);
  const crest = await selected
    .locator(".mari-window__header")
    .evaluate((element) => getComputedStyle(element, "::after").backgroundImage);
  await setGradientColors(controls);
  await expect.poll(async () => (await readPreferences(page)).colors).toEqual(GRADIENT_COLORS);
  await page.screenshot({
    path: test.info().outputPath(`chat-widget-color-controls-${preset}-${theme}.png`),
    animations: "disabled",
  });
  for (const { preset: other, appearance } of untouched) {
    await expect
      .poll(() => previewAppearance(controls.locator(`[data-chat-widget-preview][data-chat-widget-preset="${other}"]`)))
      .toEqual(appearance);
  }
  await expectGradientWidgets(page, selected.locator(".mari-window"), selected.locator(".mari-window-bubble"));
  expect(
    await selected
      .locator(".mari-window__header")
      .evaluate((element) => getComputedStyle(element, "::after").backgroundImage),
  ).toBe(crest);
  await clickTopbarPanel(page, "settings");
  const settings = await openChatSettings(page);
  await expectGradientWidgets(page, settings, page.locator("[data-chat-settings-button]"));
  // A custom foreground/background pair must remain paired on native fields in either app theme.
  const profile = settings.getByRole("combobox", { name: "Profile", exact: true });
  await expect(profile).toHaveCSS(
    "background-image",
    await resolvedStyle(page, "background-image", GRADIENT_COLORS.background),
  );
  await expect(profile).toHaveCSS("-webkit-text-fill-color", await resolvedStyle(page, "color", "#6c5ce7"));
  await expect(profile).toHaveCSS("color", await resolvedStyle(page, "color", "#6c5ce7"));
  await expect(settings.locator(".mari-window__title-row > svg")).toHaveCSS(
    "color",
    await resolvedStyle(page, "color", "#ff6b6b"),
  );
  await expect(profile.locator("option:not(:checked)").first()).toHaveCSS(
    "background-color",
    await resolvedStyle(page, "background-color", "#667eea"),
  );
  const selectedOption = profile.locator("option:checked");
  await expect(selectedOption).toHaveCSS(
    "-webkit-text-fill-color",
    await selectedOption.evaluate((element) => getComputedStyle(element).color),
  );
  expect(
    await settings
      .locator(".mari-window__header")
      .evaluate((element) => getComputedStyle(element, "::after").backgroundImage),
  ).toBe(crest);
  await page.screenshot({
    path: test.info().outputPath(`chat-widget-colors-${preset}-${theme}.png`),
    animations: "disabled",
  });
  await closeChatSettings(page);
  controls = await openAppearance(page);
  const remaining = { ...GRADIENT_COLORS };
  for (const role of ["border", "background", "text"] as const) {
    await controls
      .locator(`[data-chat-widget-color="${role}"]`)
      .getByRole("button", { name: "Reset color", exact: true })
      .click();
    remaining[role] = "";
    await expect.poll(async () => (await readPreferences(page)).colors).toEqual(remaining);
    await expect(page.locator("html")).not.toHaveAttribute("data-chat-widget-colors", new RegExp(`\\b${role}\\b`));
  }
  if (preset === "dottore") {
    const textPicker = controls.locator('[data-chat-widget-color="text"]');
    const trigger = textPicker.locator(":scope > div > button");
    await trigger.click();
    await textPicker.getByRole("button", { name: "Solid", exact: true }).click();
    await textPicker.getByRole("textbox").fill("#2d9f73");
    await trigger.click();
    await clickTopbarPanel(page, "settings");
    const solidSettings = await openChatSettings(page);
    const nameSection = solidSettings.locator('[data-drawer="chat-name"]');
    const toggle = nameSection.locator("[data-drawer-toggle]");
    const wasOpen = (await toggle.getAttribute("aria-expanded")) === "true";
    if (!wasOpen) await toggle.click();
    // This real body caption has a muted utility color; the chosen solid paint must still win.
    await expect(nameSection.getByText("Chat ID", { exact: true })).toHaveCSS(
      "-webkit-text-fill-color",
      await resolvedStyle(page, "color", "#2d9f73"),
    );
    if (!wasOpen) await toggle.click();
    await closeChatSettings(page);
    controls = await openAppearance(page);
  }
  await setGradientColors(controls);
  await controls.locator(`[data-chat-widget-preset-option="${preset}"]`).click();
  await expect.poll(async () => (await readPreferences(page)).colors).toEqual(EMPTY_COLORS);
  await expect(page.locator("html")).not.toHaveAttribute("data-chat-widget-colors");
  await clickTopbarPanel(page, "settings");
}

async function measureWidgets(page: Page) {
  const settings = await openChatSettings(page);
  // Keep hover/focus paint out of the comparison with the unchanged Default style.
  await page.mouse.move(1, 1);
  const drawer = settings.locator('[data-drawer="chat-name"]');
  await expect(drawer).toBeVisible();
  const appearance = {
    window: await computedAppearance(settings),
    frame: await settings.evaluate((element) => {
      const frame = getComputedStyle(element, "::after");
      return {
        background: frame.content === "none" ? getComputedStyle(element).backgroundColor : frame.backgroundColor,
        clip: frame.content === "none" ? "none" : frame.clipPath,
      };
    }),
    header: await computedAppearance(settings.locator(".mari-window__header")),
    title: await computedAppearance(settings.locator(".mari-window__title")),
    drawer: await computedAppearance(drawer.locator(".mari-drawer__header")),
  };
  await closeChatSettings(page);
  return { ...appearance, bubble: await computedAppearance(page.locator("[data-chat-settings-button]")) };
}

async function drag(page: Page, element: Locator, dx: number, dy: number) {
  const box = await element.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}

async function expectCustomColorsKeepCutCorners(page: Page) {
  const settings = await openChatSettings(page);
  const frameClip = await settings.evaluate((element) => getComputedStyle(element, "::after").clipPath);
  const customTheme = await page.addStyleTag({
    content: `.mari-window[data-window="chat-settings"] {
    --mari-window-bg: #18324b;
    --mari-window-border: #e4bc70;
    --mari-window-header-bg: #e7faff;
  }`,
  });
  try {
    await expect(settings).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(settings).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    await expect(settings).toHaveCSS("clip-path", "none");
    expect(
      await settings.evaluate((element) => ({
        fill: getComputedStyle(element, "::after").backgroundColor,
        border: getComputedStyle(element, "::before").backgroundColor,
        clip: getComputedStyle(element, "::after").clipPath,
      })),
    ).toEqual({ fill: "rgb(24, 50, 75)", border: "rgb(228, 188, 112)", clip: frameClip });
    const header = settings.locator(".mari-window__header");
    await expect(header).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    expect(
      await header.evaluate((element) => ({
        fill: getComputedStyle(element, "::before").backgroundColor,
        clip: getComputedStyle(element, "::before").clipPath,
        top: getComputedStyle(element, "::before").top,
        left: getComputedStyle(element, "::before").left,
        right: getComputedStyle(element, "::before").right,
      })),
    ).toEqual({ fill: "rgb(231, 250, 255)", clip: "none", top: "7px", left: "7px", right: "7px" });
  } finally {
    await customTheme.evaluate((element) => element.parentNode?.removeChild(element));
    await closeChatSettings(page);
  }
}

async function exerciseWindow(page: Page, desktop: boolean) {
  const settings = await openChatSettings(page);
  if (desktop) {
    const before = (await settings.boundingBox())!;
    await drag(page, settings.locator(".mari-window__title"), -100, 0);
    await expect.poll(async () => (await settings.boundingBox())!.x).toBeLessThan(before.x - 80);
    const moved = (await settings.boundingBox())!;
    await drag(page, settings.locator('.mari-window__resize-handle[data-edge="se"]'), 32, -24);
    await expect.poll(async () => (await settings.boundingBox())!.width).toBeGreaterThan(moved.width + 20);
  }
  await settings
    .locator('[data-drawer="chat-name"]')
    .getByRole("button", { name: "Open Chat Name in its own window", exact: true })
    .click();
  if (!desktop) {
    await expect(settings).toBeHidden();
    await openChatTool(page, CHAT_NAME_WINDOW);
  }
  const popped = page.locator(`.mari-window[data-window="${CHAT_NAME_WINDOW}"]`);
  await expect(popped).toBeVisible();
  await popped.getByRole("button", { name: "Widget appearance proof", exact: true }).click();
  await expect(popped.getByRole("textbox")).toHaveValue("Widget appearance proof");
  await popped.getByRole("textbox").press("Enter");
  await expect(popped.getByRole("button", { name: "Widget appearance proof", exact: true })).toBeVisible();
  await expect(popped.locator('[data-window-control="put-back"]')).toBeInViewport({ ratio: 1 });
  await popped.locator('[data-window-control="put-back"]').click();
  await expect(popped).toHaveCount(0);
  await openChatSettings(page);
  await expect(settings.locator('[data-drawer="chat-name"]')).toBeVisible();
}

async function expectCompactFramedWidgets(page: Page, preset: "dottore" | "mari", theme: string) {
  const settings = await openChatSettings(page);
  const header = settings.locator(".mari-window__header");
  const grip = settings.locator(".mari-window__resize-grip");
  if (await grip.count()) {
    await page.mouse.move(1, 1);
    await expect(grip).toHaveCSS(
      "color",
      await resolvedStyle(page, "color", PALETTES[theme as "dark" | "light"][preset].accent),
    );
  }
  expect(await header.evaluate((element) => getComputedStyle(element, "::before").backgroundImage)).not.toContain(
    "url(",
  );
  expect(await header.evaluate((element) => getComputedStyle(element, "::after").content)).not.toBe("none");
  if (preset === "dottore") {
    // The shadow must follow the painted cut frame, while handles and the crest stay unclipped.
    await expect(settings).toHaveCSS("box-shadow", "none");
    await expect(settings).toHaveCSS("filter", /drop-shadow\(/);
    await expect(settings).toHaveCSS("clip-path", "none");
  }
  // Read both rows in one frame while the phone sheet animates into place.
  await expect
    .poll(() =>
      settings.evaluate((element) => {
        const name = element.querySelector('[data-drawer="chat-name"]')!.getBoundingClientRect();
        const branches = element.querySelector('[data-drawer="conversation-chat-branches"]')!.getBoundingClientRect();
        return Math.abs(branches.top - name.bottom);
      }),
    )
    .toBeLessThanOrEqual(1);

  const body = settings.locator(".mari-window__body");
  expect(
    await settings.evaluate((element) => {
      const frame = element.getBoundingClientRect();
      const content = element.querySelector(".mari-window__body")!.getBoundingClientRect();
      return frame.bottom - content.bottom;
    }),
  ).toBeGreaterThanOrEqual(4);
  const scroller = body.locator(":scope > .overflow-y-auto");
  await scroller.evaluate((element) => {
    element.scrollTop = (element.scrollHeight - element.clientHeight) / 2;
  });
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.screenshot({
    path: test.info().outputPath(`chat-widgets-${preset}-${theme}-scrolled.png`),
    animations: "disabled",
  });
  await scroller.evaluate((element) => {
    element.scrollTop = 0;
  });

  if (preset === "mari") {
    expect(
      await settings
        .locator('.mari-drawer[data-detached="false"]')
        .evaluateAll((elements) => elements.every((element) => getComputedStyle(element).borderRadius === "0px")),
    ).toBe(true);
    expect(
      await page
        .locator("[data-chat-settings-button]")
        .evaluate((element) => getComputedStyle(element, "::after").backgroundImage),
    ).toBe("none");
    expect(await header.evaluate((element) => getComputedStyle(element, "::after").backgroundImage)).toContain(
      "mari-primogem.svg",
    );
  }
}

for (const theme of ["dark", "light"] as const) {
  test(`widget presets preserve Default and keep windows usable in ${theme} mode`, async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(120_000);
    const chat = await createChat(request);
    try {
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await prepare(page, chat.id, theme);
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="conversation"]')).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expectColorPaintValidation(page);
      await expect
        .poll(() => readPreferences(page))
        .toEqual({
          preset: "default",
          font: "",
          shape: "preset",
          colors: EMPTY_COLORS,
          apply: APPLY_NONE,
          ready: true,
        });
      const baseline = await measureWidgets(page);
      // Default keeps the existing theme hooks, including the transparent drawer/title-bar surfaces.
      expect(baseline.window.background).toBe(
        await resolvedStyle(page, "background-color", "var(--marinara-chat-chrome-panel-bg)"),
      );
      expect(baseline.window.border).toBe(
        await resolvedStyle(page, "color", "var(--marinara-chat-chrome-panel-border)"),
      );
      expect(baseline.title.color).toBe(await resolvedStyle(page, "color", "var(--marinara-chat-chrome-panel-title)"));
      expect(baseline.header.background).toBe("rgba(0, 0, 0, 0)");
      expect(baseline.drawer.background).toBe("rgba(0, 0, 0, 0)");
      expect(baseline.bubble.radius).toBe(await resolvedStyle(page, "border-radius", "calc(var(--radius) + 0.125rem)"));
      const appearances: Awaited<ReturnType<typeof measureWidgets>>[] = [];
      for (const preset of ["dottore", "mari"] as const) {
        await choosePreset(page, preset);
        const appearance = await measureWidgets(page);
        appearances.push(appearance);
        const palette = PALETTES[theme][preset];
        expect(
          await page
            .locator("html")
            .evaluate((element) => getComputedStyle(element).getPropertyValue("--mari-widget-bg").trim()),
        ).toBe(palette.background);
        expect(appearance.frame.background).toBe(await resolvedStyle(page, "color", palette.background));
        expect(appearance.title.color).toBe(await resolvedStyle(page, "color", palette.accent));
        expect(appearance.drawer.background).toBe(await resolvedStyle(page, "color", palette.field));
        expect(appearance.title.font).toContain(preset === "dottore" ? "monospace" : "serif");
        expect(appearance.frame.background).not.toBe(baseline.frame.background);
        expect(appearance.window.clip).toBe("none");
        if (preset === "dottore") expect(appearance.frame.clip).toContain("polygon(");
        expect(appearance.header).not.toEqual(baseline.header);
        expect(appearance.drawer).not.toEqual(baseline.drawer);
        expect(appearance.bubble).not.toEqual(baseline.bubble);
        if (preset === "dottore") await expectCustomColorsKeepCutCorners(page);
        await exerciseWindow(page, testInfo.project.name.includes("desktop"));
        await expectCompactFramedWidgets(page, preset, theme);
        await page.screenshot({
          path: testInfo.outputPath(`chat-widgets-${preset}-${theme}.png`),
          animations: "disabled",
        });
        await closeChatSettings(page);
        await exerciseColorControls(page, preset, theme);
      }
      expect(appearances[0]).not.toEqual(appearances[1]);
      await choosePreset(page, "default");
      expect(await measureWidgets(page)).toEqual(baseline);
      if (theme === "light" && testInfo.project.name.includes("desktop")) {
        await exerciseColorControls(page, "default", theme);
        expect(await measureWidgets(page)).toEqual(baseline);
      }
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });
}

test("widget font, shape and color choices survive reload and a fresh browser, and Reset Appearance restores Default", async ({
  page,
  request,
  browser,
}, testInfo) => {
  test.skip(
    !testInfo.project.name.includes("desktop"),
    "One real-server proof covers the shared appearance preferences.",
  );
  test.setTimeout(120_000);
  const original = (await (await request.get(UI_SETTINGS_PATH)).json()) as { value: string | null };
  const chat = await createChat(request);
  const freshContext = await browser.newContext({ viewport: page.viewportSize()! });
  const readSaved = async () => {
    const saved = (await (await request.get(UI_SETTINGS_PATH)).json()) as { value: string | null };
    return JSON.parse(saved.value || "{}") as Record<string, unknown>;
  };
  try {
    expect((await request.put(UI_SETTINGS_PATH, { data: { value: "" } })).ok()).toBeTruthy();
    await prepare(page, chat.id, "dark");
    await page.goto("/");
    await expect
      .poll(() => readPreferences(page))
      .toEqual({ preset: "default", font: "", shape: "preset", colors: EMPTY_COLORS, apply: APPLY_NONE, ready: true });
    const baseline = await measureWidgets(page);
    await choosePreset(page, "dottore");
    const preset = await measureWidgets(page);
    let controls = await openAppearance(page);
    for (const role of ["font", "shape", "colors"] as const) {
      await expect(controls.getByRole("checkbox", { name: `Apply preset ${role}`, exact: true })).not.toBeChecked();
    }
    await setChatStyleApplication(controls, "font", true);
    await expect.poll(async () => (await readPreferences(page)).apply).toEqual({ ...APPLY_NONE, font: true });
    await setChatStyleApplication(controls, "shape", true);
    await setChatStyleApplication(controls, "colors", true);
    const apply = { font: true, shape: true, colors: true };
    // Changing the visual preset must not silently opt the chat back out of any selected scope.
    await controls.locator('[data-chat-widget-preset-option="mari"]').click();
    await expect.poll(async () => (await readPreferences(page)).apply).toEqual(apply);
    await controls.locator('[data-chat-widget-preset-option="dottore"]').click();
    await expect.poll(async () => (await readPreferences(page)).apply).toEqual(apply);
    await controls.locator("#chat-widget-font").selectOption("@serif");
    await controls.locator("#chat-widget-shape").selectOption("square");
    await setGradientColors(controls);
    await clickTopbarPanel(page, "settings");
    const square = await measureWidgets(page);
    expect(square.title.font).toContain("serif");
    expect(square.title.font).not.toBe(preset.title.font);
    expect(square.window.radius).toBe("0px");
    expect(square.bubble.radius).toBe("0px");
    const expected = {
      preset: "dottore",
      font: "@serif",
      shape: "square",
      colors: GRADIENT_COLORS,
      apply,
      ready: true,
    };
    await expect.poll(() => readPreferences(page)).toEqual(expected);
    await expect
      .poll(async () => {
        const saved = await readSaved();
        return {
          preset: saved.chatWidgetPreset,
          font: saved.chatWidgetFont,
          shape: saved.chatWidgetShape,
          colors: {
            border: saved.chatWidgetBorderColor,
            background: saved.chatWidgetBackgroundColor,
            text: saved.chatWidgetTextColor,
          },
          apply: {
            font: saved.chatWidgetApplyFont,
            shape: saved.chatWidgetApplyShape,
            colors: saved.chatWidgetApplyColors,
          },
        };
      })
      .toEqual({ preset: "dottore", font: "@serif", shape: "square", colors: GRADIENT_COLORS, apply });
    await page.reload();
    await expect.poll(() => readPreferences(page)).toEqual(expected);
    expect(await measureWidgets(page)).toEqual(square);

    await prepare(freshContext, chat.id, "dark");
    const freshPage = await freshContext.newPage();
    await freshPage.goto(new URL("/", page.url()).toString());
    await expect.poll(() => readPreferences(freshPage)).toEqual(expected);
    expect(await measureWidgets(freshPage)).toEqual(square);
    await freshContext.close();

    // Overrides remain independent: changing shape keeps the chosen font and preset colors.
    const shapes = new Map<string, string>();
    for (const shape of ["rounded", "cut-corner", "arched"] as const) {
      controls = await openAppearance(page);
      await controls.locator("#chat-widget-shape").selectOption(shape);
      await clickTopbarPanel(page, "settings");
      const rendered = await measureWidgets(page);
      expect(rendered.title.font).toBe(square.title.font);
      expect(rendered.frame.background).toBe(square.frame.background);
      shapes.set(
        shape,
        JSON.stringify({ radius: rendered.window.radius, clip: rendered.frame.clip, bubble: rendered.bubble.radius }),
      );
    }
    expect(new Set(shapes.values()).size).toBe(3);
    await openAppearance(page);
    await page.getByRole("button", { name: "Reset Appearance", exact: true }).click();
    await expect
      .poll(() => readPreferences(page))
      .toEqual({ preset: "default", font: "", shape: "preset", colors: EMPTY_COLORS, apply: APPLY_NONE, ready: true });
    await clickTopbarPanel(page, "settings");
    const reset = await measureWidgets(page);
    expect(reset.title.font).toBe(baseline.title.font);
    expect(reset.window.radius).toBe(baseline.window.radius);
    expect(reset.window.clip).toBe(baseline.window.clip);
    await expect
      .poll(async () => {
        const saved = await readSaved();
        return [
          saved.chatWidgetPreset,
          saved.chatWidgetFont,
          saved.chatWidgetShape,
          saved.chatWidgetBorderColor,
          saved.chatWidgetBackgroundColor,
          saved.chatWidgetTextColor,
          saved.chatWidgetApplyFont,
          saved.chatWidgetApplyShape,
          saved.chatWidgetApplyColors,
        ];
      })
      .toEqual(["default", "", "preset", "", "", "", false, false, false]);
  } finally {
    await freshContext.close();
    // Stop its debounced persistence before restoring the shared server fixture.
    await page.close();
    await request.put(UI_SETTINGS_PATH, { data: { value: original.value ?? "" } });
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
});

const SCOPE_MESSAGE = "The lantern lights a quiet path.";
type ChatStyleFixture = { id: string; mode: "roleplay" | "game" | "conversation"; view: string };

async function createStyleScopes(request: APIRequestContext) {
  const response = await request.post("/api/characters", { data: { data: { name: "Style guide" } } });
  expect(response.ok()).toBeTruthy();
  const character = (await response.json()) as { id: string };
  const chats: ChatStyleFixture[] = [];
  try {
    for (const view of ["classic", "visual-novel", "game", "conversation"] as const) {
      const mode = view === "classic" || view === "visual-novel" ? "roleplay" : view;
      const created = await request.post("/api/chats", {
        data: { name: `Style scope ${view}`, mode, characterIds: [character.id] },
      });
      expect(created.ok()).toBeTruthy();
      const chat = (await created.json()) as { id: string };
      chats.push({ id: chat.id, mode, view });
      expect(
        (
          await request.patch(`/api/chats/${chat.id}/metadata`, {
            data: {
              windowLayout: null,
              chatSettingsHintDismissed: true,
              enableAgents: false,
              ...(mode === "roleplay" ? { roleplayDisplayStyle: view, background: "Black.jpg" } : {}),
              ...(mode === "game"
                ? {
                    gameId: "widget-style-scope",
                    gameSessionStatus: "active",
                    gameSessionNumber: 1,
                    gameIntroPresented: true,
                    gameActiveState: "dialogue",
                    gameBlueprint: { campaignPlan: {}, hudWidgets: [], introSequence: [], visualTheme: {} },
                  }
                : {}),
            },
          })
        ).ok(),
      ).toBeTruthy();
      if (mode === "game") {
        expect(
          (
            await request.post(`/api/chats/${chat.id}/messages`, {
              data: { role: "assistant", content: "A bell sounds in the courtyard." },
            })
          ).ok(),
        ).toBeTruthy();
      }
      expect(
        (
          await request.post(`/api/chats/${chat.id}/messages`, {
            data: { role: "assistant", characterId: character.id, content: SCOPE_MESSAGE },
          })
        ).ok(),
      ).toBeTruthy();
    }
    return {
      chats,
      remove: async () => {
        for (const chat of chats) await request.delete(`/api/chats/${chat.id}?force=true`);
        await request.delete(`/api/characters/${character.id}`);
      },
    };
  } catch (error) {
    for (const chat of chats) await request.delete(`/api/chats/${chat.id}?force=true`);
    await request.delete(`/api/characters/${character.id}`);
    throw error;
  }
}

async function showStyleScope(page: Page, chat: ChatStyleFixture) {
  await page.evaluate(async (id) => {
    const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
    useChatStore.getState().setActiveChatId(id);
  }, chat.id);
  const area = page.locator(`[data-chat-mode="${chat.mode}"]`);
  await expect(area).toBeVisible();
  const surface =
    chat.view === "classic"
      ? area.locator(".mari-rp-bubble.mari-chat-style-surface").first()
      : chat.view === "visual-novel"
        ? area.locator("[data-roleplay-vn] .mari-chat-style-surface").first()
        : chat.mode === "game"
          ? area.locator('[data-component="GameNarration.ActivePanel"]')
          : area.locator(".mari-message-bubble.mari-chat-style-conversation").first();
  await expect(surface).toBeVisible();
  const text = surface.getByText(SCOPE_MESSAGE, { exact: true }).first();
  await expect(text).toBeVisible();
  const input = area.locator("textarea[data-chat-composer]").first();
  await expect(input).toBeVisible();
  const composer = area.locator(".mari-chat-input-box.mari-chat-style-surface").first();
  await expect(composer).toBeVisible();
  return { surface, text, composer, input };
}

async function surfaceAppearance(element: Locator) {
  return element.evaluate(async (node) => {
    // Flush and finish finite paint transitions before comparing independent axes.
    getComputedStyle(node).backgroundColor;
    await Promise.all(
      node
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
    const host = getComputedStyle(node);
    const after = getComputedStyle(node, "::after");
    const before = getComputedStyle(node, "::before");
    const fill = after.content !== "none" && after.clipPath.includes("polygon") ? after : host;
    return {
      background: fill.backgroundColor,
      image: fill.backgroundImage,
      radius: host.borderRadius,
      clip: after.clipPath,
      borderImage: before.backgroundImage,
    };
  });
}

async function originalOutline(element: Locator, ring = false) {
  return element.evaluate((node, useRing) => {
    const style = getComputedStyle(node);
    if (!useRing) return style.borderTopColor;
    // RP paints a one-pixel box-shadow ring, not its border property.
    const paintedRing = style.boxShadow.match(/((?:rgba?|oklch|oklab|color)\([^)]*\)) 0px 0px 0px 1px(?:,|$)/u);
    if (!paintedRing) throw new Error(`Expected a painted RP ring: ${style.boxShadow}`);
    return paintedRing[1]!;
  }, ring);
}

for (const [preset, theme] of [
  ["dottore", "dark"],
  ["mari", "light"],
] as const) {
  test(`chat style switches independently extend ${preset} to each chat mode in ${theme} mode`, async ({
    page,
    request,
  }, info) => {
    test.setTimeout(180_000);
    const fixture = await createStyleScopes(request);
    try {
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await prepare(page, fixture.chats[0]!.id, theme);

      await page.goto("/");
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setGameTextSpeed(100);
        useUIStore.getState().setGameDialogueDisplayMode("stacked");
        useUIStore.getState().setConversationMessageStyle("bubble");
      });
      const gameLog = page.locator(".mari-game-stacked-log");
      let gameLogBaseline: Awaited<ReturnType<typeof surfaceAppearance>> | undefined;
      let gameLogOutline = "";
      const outlines = new Map<string, { surface: string; composer: string; focusedComposer: string }>();
      const baseline = new Map<
        string,
        {
          surface: Awaited<ReturnType<typeof surfaceAppearance>>;
          composer: Awaited<ReturnType<typeof surfaceAppearance>>;
          font: string;
        }
      >();
      for (const chat of fixture.chats) {
        const scope = await showStyleScope(page, chat);
        if (chat.mode === "game") {
          await expect(gameLog).toBeVisible();
          gameLogBaseline = await surfaceAppearance(gameLog);
          gameLogOutline = await originalOutline(gameLog);
        }
        baseline.set(chat.view, {
          surface: await surfaceAppearance(scope.surface),
          composer: await surfaceAppearance(scope.composer),
          font: await scope.text.evaluate((node) => getComputedStyle(node).fontFamily),
        });
        if (chat.view === "classic" || chat.mode === "game") {
          const surface = await originalOutline(scope.surface, chat.view === "classic");
          const composer = await originalOutline(scope.composer);
          await scope.input.focus();
          await surfaceAppearance(scope.composer);
          const focusedComposer = await originalOutline(scope.composer);
          await scope.input.blur();
          await surfaceAppearance(scope.composer);
          outlines.set(chat.view, { surface, composer, focusedComposer });
        }
      }
      await showStyleScope(page, fixture.chats[0]!);
      const baselinePath = info.outputPath(`chat-style-${preset}-baseline.png`);
      await page.screenshot({ path: baselinePath, animations: "disabled" });
      await info.attach("Chat style before enabling", { path: baselinePath, contentType: "image/png" });
      await choosePreset(page, preset);
      let scope = await showStyleScope(page, fixture.chats[0]!);
      const original = baseline.get("classic")!;
      const swipes = page.locator('[data-chat-mode="roleplay"] .mari-message-swipes').first();
      const swipeFrame = swipes.locator(".mari-swipe-input");
      const swipeInput = swipeFrame.locator("input");
      const swipeArrow = swipes.getByRole("button").first();
      const originalSwipe = {
        frame: await surfaceAppearance(swipeFrame),
        arrow: await surfaceAppearance(swipeArrow),
        font: await swipeInput.evaluate((node) => getComputedStyle(node).fontFamily),
      };
      const send = page.locator(".mari-chat-send-btn").first();
      const sendFill = await send.evaluate((node) => getComputedStyle(node).backgroundColor);
      expect(await surfaceAppearance(scope.surface)).toEqual(original.surface);
      expect(await surfaceAppearance(scope.composer)).toEqual(original.composer);
      await expect(scope.text).toHaveCSS("font-family", original.font);

      let controls = await openAppearance(page);
      await setChatStyleApplication(controls, "font", true);
      await clickTopbarPanel(page, "settings");
      const selectedFont = await scope.surface.evaluate((node) => getComputedStyle(node).fontFamily);
      expect(selectedFont).not.toBe(original.font);
      await expect(scope.text).toHaveCSS("font-family", selectedFont);
      await expect(scope.input).toHaveCSS("font-family", selectedFont);
      await expect(swipes).toHaveCSS("font-family", selectedFont);
      await expect(swipeInput).toHaveCSS("font-family", selectedFont);
      expect(await surfaceAppearance(swipeFrame)).toEqual(originalSwipe.frame);
      expect(await surfaceAppearance(swipeArrow)).toEqual(originalSwipe.arrow);
      expect(await surfaceAppearance(scope.surface)).toEqual(original.surface);
      expect(await surfaceAppearance(scope.composer)).toEqual(original.composer);

      controls = await openAppearance(page);
      await setChatStyleApplication(controls, "font", false);
      await setChatStyleApplication(controls, "shape", true);
      await clickTopbarPanel(page, "settings");
      for (const [target, old] of [
        [scope.surface, original.surface],
        [scope.composer, original.composer],
      ] as const) {
        const shaped = await surfaceAppearance(target);
        expect(shaped.background).toBe(old.background);
        expect(shaped.image).toBe(old.image);
        if (preset === "dottore") expect(shaped.clip).toContain("polygon");
        else expect(shaped.radius).not.toBe(old.radius);
      }
      await expect(scope.text).toHaveCSS("font-family", original.font);
      await expect(swipeInput).toHaveCSS("font-family", originalSwipe.font);
      for (const [target, old] of [
        [swipeFrame, originalSwipe.frame],
        [swipeArrow, originalSwipe.arrow],
      ] as const) {
        const shaped = await surfaceAppearance(target);
        expect(shaped.background).toBe(old.background);
        if (preset === "dottore") expect(shaped.clip).toContain("polygon");
        else expect(shaped.radius).not.toBe(old.radius);
      }
      if (preset === "dottore") {
        expect(await send.evaluate((node) => getComputedStyle(node, "::after").backgroundColor)).toBe(sendFill);
        const frame = (element: Locator) =>
          element.evaluate((node) => getComputedStyle(node, "::before").backgroundColor);
        await expect.poll(() => frame(scope.surface)).toBe(outlines.get("classic")!.surface);
        await expect.poll(() => frame(scope.composer)).toBe(outlines.get("classic")!.composer);
        await scope.input.focus();
        await expect.poll(() => frame(scope.composer)).toBe(outlines.get("classic")!.focusedComposer);
        await scope.input.blur();
      }

      const gameScope = await showStyleScope(
        page,
        fixture.chats.find((chat) => chat.mode === "game")!,
      );
      if (preset === "dottore") {
        for (const [element, color] of [
          [gameScope.surface, outlines.get("game")!.surface],
          [gameLog, gameLogOutline],
        ] as const) {
          await expect
            .poll(() => element.evaluate((node) => getComputedStyle(node, "::before").backgroundColor))
            .toBe(color);
        }
      }
      const shapedLog = await surfaceAppearance(gameLog);
      // Tailwind's oklab black/40 and the equivalent rgba paint serialize differently.
      const logFillPixels = await page.evaluate(
        (colors) =>
          colors.map((color) => {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 1;
            const context = canvas.getContext("2d")!;
            context.fillStyle = color;
            context.fillRect(0, 0, 1, 1);
            return Array.from(context.getImageData(0, 0, 1, 1).data);
          }),
        [shapedLog.background, gameLogBaseline!.background],
      );
      expect(logFillPixels[0]).toEqual(logFillPixels[1]);
      expect(shapedLog.image).toBe(gameLogBaseline!.image);

      await showStyleScope(page, fixture.chats[0]!);

      controls = await openAppearance(page);
      await setChatStyleApplication(controls, "shape", false);
      await setChatStyleApplication(controls, "colors", true);
      await clickTopbarPanel(page, "settings");
      const colored = await surfaceAppearance(scope.surface);
      expect(colored.radius).toBe(original.surface.radius);
      expect(colored.clip).toBe(original.surface.clip);
      expect(colored.background).toBe(
        await resolvedStyle(page, "background-color", PALETTES[theme][preset].background),
      );
      await expect(scope.text).toHaveCSS("font-family", original.font);

      for (const [target, old] of [
        [swipeFrame, originalSwipe.frame],
        [swipeArrow, originalSwipe.arrow],
      ] as const) {
        const painted = await surfaceAppearance(target);
        expect(painted.radius).toBe(old.radius);
        expect(painted.clip).toBe(old.clip);
        expect(painted.background).toBe(colored.background);
      }

      controls = await openAppearance(page);
      await setChatStyleApplication(controls, "font", true);
      await setChatStyleApplication(controls, "shape", true);
      await page
        .locator('[data-component="RightPanel"]')
        .getByRole("button", { name: "Close panel", exact: true })
        .click();
      await expect(
        page.locator('[data-component="RightPanelDesktopSlot"], [data-component="RightPanelMobile"]'),
      ).toBeHidden();
      for (const chat of fixture.chats) {
        await showStyleScope(page, chat);
        if (chat.view === "visual-novel" || (chat.mode === "game" && info.project.name === "desktop-chromium")) {
          const control = page.locator(".mari-vn-history-control:visible, .mari-map-generate-control:visible");
          await expect(control).toHaveCount(1);
          await expect(control).toHaveCSS("font-family", selectedFont);
          const painted = await surfaceAppearance(control);
          expect(painted.background).toBe(colored.background);
          if (preset === "dottore") expect(painted.clip).toContain("polygon");
        }
        const path = info.outputPath(`chat-style-${preset}-${chat.view}.png`);
        await page.screenshot({ path, animations: "disabled" });
        await info.attach(`${preset} ${chat.view} chat style`, { path, contentType: "image/png" });
      }
      controls = await openAppearance(page);
      await controls.locator("#chat-widget-font").selectOption("@serif");
      await controls.locator("#chat-widget-shape").selectOption("cut-corner");
      await setGradientColors(controls);
      await clickTopbarPanel(page, "settings");
      const background = await resolvedStyle(page, "background-image", GRADIENT_COLORS.background);
      const border = await resolvedStyle(page, "background-image", GRADIENT_COLORS.border);
      const textGradient = await resolvedStyle(page, "background-image", GRADIENT_COLORS.text);
      for (const chat of fixture.chats) {
        await test.step(`${chat.view} paints custom colors/font and preserves its shape contract`, async () => {
          scope = await showStyleScope(page, chat);
          await expect(scope.text).toHaveCSS("font-family", /serif/);
          await expect(scope.input).toHaveCSS("font-family", /serif/);
          await expect(scope.input).toHaveCSS("-webkit-text-fill-color", "rgb(108, 92, 231)");
          for (const target of [scope.surface, scope.composer]) {
            const painted = await surfaceAppearance(target);
            expect(painted.image).toBe(background);
            expect(painted.borderImage).toBe(border);
            if (chat.mode === "conversation" && target === scope.surface) {
              expect(painted.radius).toBe(baseline.get(chat.view)!.surface.radius);
              expect(painted.clip).toBe(baseline.get(chat.view)!.surface.clip);
            } else expect(painted.clip).toContain("polygon");
          }
          // Read actual glyph paint, not only the inherited custom properties.
          const glyph = scope.text.locator("p:not(:has(*)), span:not(:has(*))").filter({ hasText: /\S/ }).first();
          const paintedText = (await glyph.count()) ? glyph : scope.text;
          await expect(paintedText).toHaveCSS("background-image", textGradient);
          await expect(paintedText).toHaveCSS("-webkit-text-fill-color", "rgba(0, 0, 0, 0)");

          if (chat.view === "visual-novel" || (chat.mode === "game" && info.project.name === "desktop-chromium")) {
            const control = page.locator(".mari-vn-history-control:visible, .mari-map-generate-control:visible");
            await expect(control).toHaveCSS("font-family", /serif/);
            const painted = await surfaceAppearance(control);
            expect(painted.clip).toContain("polygon");
            expect(painted.image).toContain(background);
            await expect(control.locator("svg")).toHaveCSS("color", "rgb(255, 107, 107)");
          }

          if (chat.view === "classic" || chat.mode === "conversation") {
            const pager = page.locator(`[data-chat-mode="${chat.mode}"] .mari-message-swipes`).first();
            await expect(pager.locator("input")).toHaveCSS("font-family", /serif/);
            await expect(pager.locator("input")).toHaveCSS("-webkit-text-fill-color", "rgb(108, 92, 231)");
            await expect(pager.locator(":scope > span.tabular-nums")).toHaveCSS("background-image", textGradient);
            for (const control of [pager.locator(".mari-swipe-input"), pager.getByRole("button").first()]) {
              const painted = await surfaceAppearance(control);
              expect(painted.clip).toContain("polygon");
              expect(painted.image).toContain(background);
            }
          }

          await scope.input.fill("A readable draft");
          await expect(scope.input).toHaveValue("A readable draft");
          await scope.input.fill("");
        });
      }
      // The default unboxed Conversation layout receives font and glyph colors too.
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setConversationMessageStyle("classic");
      });
      const unboxed = page
        .locator('[data-chat-mode="conversation"] .mari-message-content')
        .filter({ hasText: SCOPE_MESSAGE })
        .first();
      await expect(unboxed).toBeVisible();
      await expect(unboxed).not.toHaveClass(/mari-message-bubble/);
      await expect(unboxed).toHaveCSS("font-family", /serif/);
      await expect(unboxed.getByText(SCOPE_MESSAGE, { exact: true }).first()).toHaveCSS(
        "background-image",
        textGradient,
      );
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setConversationMessageStyle("bubble");
      });
      scope = await showStyleScope(
        page,
        fixture.chats.find((chat) => chat.mode === "conversation")!,
      );
      // Public chat hooks override the preset without reshaping Conversation bubbles.
      const custom = await page.addStyleTag({
        content:
          ":root { --mari-chat-bg: rgb(20, 30, 40); --mari-chat-text: rgb(230, 240, 250); --mari-chat-font-family: monospace; }",
      });
      await expect(scope.surface).toHaveCSS("background-color", "rgb(20, 30, 40)");
      await expect(scope.text).toHaveCSS("font-family", "monospace");
      await expect(scope.input).toHaveCSS("-webkit-text-fill-color", "rgb(230, 240, 250)");
      await custom.evaluate((node) => node.parentNode?.removeChild(node));
      controls = await openAppearance(page);
      for (const role of ["font", "shape", "colors"] as const) await setChatStyleApplication(controls, role, false);
      await clickTopbarPanel(page, "settings");
      for (const chat of fixture.chats) {
        const reset = await showStyleScope(page, chat);
        expect(await surfaceAppearance(reset.surface)).toEqual(baseline.get(chat.view)!.surface);
        expect(await surfaceAppearance(reset.composer)).toEqual(baseline.get(chat.view)!.composer);
        await expect(reset.text).toHaveCSS("font-family", baseline.get(chat.view)!.font);
        if (chat.view === "classic") {
          expect(await surfaceAppearance(swipeFrame)).toEqual(originalSwipe.frame);
          expect(await surfaceAppearance(swipeArrow)).toEqual(originalSwipe.arrow);
          await expect(swipeInput).toHaveCSS("font-family", originalSwipe.font);
        }
      }
    } finally {
      await fixture.remove();
    }
  });
}

test("movable button pixel size is independent, stays reachable and restores the current default", async ({
  page,
  request,
  browser,
}, info) => {
  test.setTimeout(180_000);
  const original = (await (await request.get(UI_SETTINGS_PATH)).json()) as { value: string | null };
  const fixture = await createStyleScopes(request);
  const game = fixture.chats.find((chat) => chat.mode === "game")!;
  const freshContext = await browser.newContext({ viewport: page.viewportSize()! });
  const settingsButton = page.locator("[data-chat-settings-button]");
  const readSize = async () => {
    const saved = (await (await request.get(UI_SETTINGS_PATH)).json()) as { value: string | null };
    return (JSON.parse(saved.value || "{}") as { chatWidgetButtonSize?: number | null }).chatWidgetButtonSize;
  };
  const closeAppearance = async () => {
    await page.getByRole("button", { name: "Close panel", exact: true }).click();
    await expect(
      page.locator('[data-component="RightPanelDesktopSlot"], [data-component="RightPanelMobile"]'),
    ).toBeHidden();
  };
  const assertReachable = async () => {
    await expect
      .poll(() =>
        page.evaluate(() => {
          const area = document.querySelector('[data-component="CenterContent"]')!.getBoundingClientRect();
          const composer = document.querySelector("textarea[data-chat-composer]")!.getBoundingClientRect();
          const boxes = [...document.querySelectorAll<HTMLElement>(".mari-window-bubble[data-window]")]
            .filter((node) => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden")
            .map((node) => node.getBoundingClientRect());
          return (
            boxes.length >= 4 &&
            boxes.every(
              (box, index) =>
                box.left >= area.left - 1 &&
                box.right <= area.right + 1 &&
                box.bottom <= composer.top + 1 &&
                boxes
                  .slice(index + 1)
                  .every(
                    (other) =>
                      box.right <= other.left + 1 ||
                      other.right <= box.left + 1 ||
                      box.bottom <= other.top + 1 ||
                      other.bottom <= box.top + 1,
                  ),
            )
          );
        }),
      )
      .toBe(true);
  };
  try {
    expect((await request.put(UI_SETTINGS_PATH, { data: { value: "" } })).ok()).toBeTruthy();
    await prepare(page, game.id, "dark");
    await page.goto("/");
    await expect.poll(async () => (await readPreferences(page)).ready).toBe(true);
    await closeChatSettings(page);
    await expect(settingsButton).toBeVisible();
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    await assertReachable();
    const baseline = await settingsButton.boundingBox();
    expect(baseline).not.toBeNull();
    const originalFont = await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      return useUIStore.getState().fontSize;
    });
    await page.screenshot({ path: info.outputPath("button-size-default.png"), animations: "disabled" });
    let controls = await openAppearance(page);
    const field = controls.getByLabel("Button size (px)", { exact: true });
    await expect(field).toHaveValue("");
    await expect(field).toHaveAttribute("placeholder", "Default");
    await field.fill("64");
    await field.press("Enter");
    await expect(settingsButton).toHaveCSS("width", "64px");
    await expect(settingsButton.locator("svg")).toHaveCSS("width", "32px");
    expect(
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        return useUIStore.getState().fontSize;
      }),
    ).toBe(originalFont);
    for (const preset of ["dottore", "mari"] as const) {
      await controls.locator(`[data-chat-widget-preset-option="${preset}"]`).click();
      await expect(field).toHaveValue("64");
      await expect(settingsButton).toHaveCSS("width", "64px");
    }
    await controls.locator('[data-chat-widget-preset-option="dottore"]').click();
    await field.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("button-size-setting.png"), animations: "disabled" });
    await closeAppearance();
    const profile = page.locator('.mari-window-bubble[data-window="control:character-profiles"]');
    await expect(profile).toHaveCSS("width", "64px");
    await expect(profile.locator(".mari-window-bubble__icon > span")).toHaveCSS("width", "32px");
    if (info.project.name.includes("mobile")) {
      await expect(page.locator('.mari-window-bubble[data-window="control:map"]')).toHaveCSS("width", "64px");
      await expect(page.locator("[data-chat-tools-menu-button]")).toHaveCSS("width", "64px");
    }
    await assertReachable();
    await page.screenshot({ path: info.outputPath("button-size-64.png"), animations: "disabled" });
    await expect.poll(readSize).toBe(64);
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().setFontSize(22);
    });
    await expect(settingsButton).toHaveCSS("width", "64px");
    await expect(settingsButton.locator("svg")).toHaveCSS("width", "32px");
    await page.reload();
    await expect(settingsButton).toHaveCSS("width", "64px");
    await prepare(freshContext, game.id, "dark");
    const freshPage = await freshContext.newPage();
    await freshPage.goto(new URL("/", page.url()).toString());
    await expect(freshPage.locator("[data-chat-settings-button]")).toHaveCSS("width", "64px");
    await freshContext.close();

    controls = await openAppearance(page);
    await controls.getByLabel("Button size (px)", { exact: true }).fill("999");
    await controls.getByLabel("Button size (px)", { exact: true }).press("Enter");
    await expect(controls.getByLabel("Button size (px)", { exact: true })).toHaveValue("96");
    await closeAppearance();
    await expect(settingsButton).toHaveCSS("width", "96px");
    await assertReachable();
    controls = await openAppearance(page);
    await controls.getByLabel("Button size (px)", { exact: true }).fill("1");
    await controls.getByLabel("Button size (px)", { exact: true }).press("Enter");
    await expect(settingsButton).toHaveCSS("width", "32px");
    await controls.getByLabel("Button size (px)", { exact: true }).fill("");
    await controls.getByLabel("Button size (px)", { exact: true }).press("Enter");
    await expect(page.locator("html")).not.toHaveAttribute("data-chat-widget-button-size");
    await controls.getByLabel("Button size (px)", { exact: true }).fill("64");
    await controls.getByLabel("Button size (px)", { exact: true }).press("Enter");
    await controls.getByRole("button", { name: "Reset button size to default", exact: true }).click();
    await expect(controls.getByLabel("Button size (px)", { exact: true })).toHaveValue("");
    await expect.poll(readSize).toBeNull();
    await page.evaluate(async (font) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().setFontSize(font);
    }, originalFont);
    await closeAppearance();
    await expect.poll(async () => (await settingsButton.boundingBox())!.width).toBeCloseTo(baseline!.width, 0);
  } finally {
    await freshContext.close();
    await page.close();
    await request.put(UI_SETTINGS_PATH, { data: { value: original.value ?? "" } });
    await fixture.remove();
  }
});
