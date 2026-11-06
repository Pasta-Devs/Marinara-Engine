import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { openChatTool } from "./chat-settings-tools.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;
const CHARACTER = "Mira Vale";
const SIDE_REMARK = "I will keep watch from the ridge.";
const WIDGET = "Lanterns Lit";
const COLLAPSED_WIDGET = "Expedition Supplies";
const GRADIENTS = {
  background: "linear-gradient(135deg, #667eea, #764ba2)",
  border: "linear-gradient(90deg, #ff6b6b, #ffd93d)",
  text: "linear-gradient(90deg, #6c5ce7, #00cec9)",
};
type Axis = "font" | "shape" | "colors";
type Surface = "widget" | "map" | "side" | "sheet" | "logs" | "inventory";
type Appearance = Awaited<ReturnType<typeof appearance>>;

async function createGame(request: APIRequestContext) {
  const created = await request.post("/api/characters", { data: { data: { name: CHARACTER } } });
  expect(created.ok()).toBeTruthy();
  const character = (await created.json()) as { id: string };
  let chatId: string | undefined;
  const remove = async () => {
    if (chatId) await request.delete(`/api/chats/${chatId}?force=true`);
    await request.delete(`/api/characters/${character.id}`);
  };
  try {
    const response = await request.post("/api/chats", {
      data: { name: "Game widget style", mode: "game", characterIds: [character.id] },
    });
    expect(response.ok()).toBeTruthy();
    chatId = ((await response.json()) as { id: string }).id;
    expect(
      (
        await request.patch(`/api/chats/${chatId}/metadata`, {
          data: {
            windowLayout: null,
            chatSettingsHintDismissed: true,
            enableAgents: false,
            activeAgentIds: [],
            enableCustomWidgets: true,
            gameId: "game-widget-style",
            gameSessionStatus: "active",
            gameSessionNumber: 1,
            gameIntroPresented: true,
            gameActiveState: "exploration",
            gamePartyCharacterIds: [character.id],
            gameInventory: [{ name: "Lantern", quantity: 3 }],
            gameCharacterCards: [
              {
                name: CHARACTER,
                shortDescription: "A ridge scout who reads the weather.",
                class: "Scout",
                abilities: ["Trail Sense"],
                strengths: ["Patience"],
                weaknesses: ["Deep water"],
                rpgStats: { attributes: [{ name: "WIS", value: 14 }], hp: { value: 24, max: 24 } },
              },
            ],
            gameMap: {
              id: "lantern-vale",
              type: "node",
              name: "Lantern Vale",
              description: "A quiet valley.",
              nodes: [
                { id: "camp", emoji: "⛺", label: "Camp", x: 30, y: 55, discovered: true },
                { id: "ridge", emoji: "⛰️", label: "Ridge", x: 70, y: 35, discovered: true },
              ],
              edges: [{ from: "camp", to: "ridge" }],
              partyPosition: "camp",
            },
            gameBlueprint: {
              campaignPlan: {},
              introSequence: [],
              visualTheme: {},
              hudWidgets: [
                {
                  id: "lanterns",
                  type: "counter",
                  label: WIDGET,
                  icon: "🏮",
                  position: "hud_left",
                  accent: "#FFB347",
                  config: { count: 3 },
                },
                {
                  id: "supplies",
                  type: "progress_bar",
                  label: COLLAPSED_WIDGET,
                  icon: "🎒",
                  position: "hud_right",
                  accent: "#4FD6FF",
                  config: { value: 60, max: 100 },
                },
              ],
            },
          },
        })
      ).ok(),
    ).toBeTruthy();
    expect(
      (
        await request.post(`/api/chats/${chatId}/messages`, {
          data: {
            role: "assistant",
            content: `The lantern lights a quiet path.\n[${CHARACTER}] [side]: "${SIDE_REMARK}"`,
          },
        })
      ).ok(),
    ).toBeTruthy();
    return { chatId, remove };
  } catch (error) {
    await remove();
    throw error;
  }
}

async function appearance(target: Locator) {
  return target.evaluate(async (element) => {
    getComputedStyle(element).backgroundColor;
    await Promise.all(
      element
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
    const host = getComputedStyle(element);
    const after = getComputedStyle(element, "::after");
    const before = getComputedStyle(element, "::before");
    const fill = after.content !== "none" && after.clipPath.includes("polygon") ? after : host;
    return {
      background: fill.backgroundColor,
      image: fill.backgroundImage,
      borderImage: before.backgroundImage,
      textFill: host.webkitTextFillColor,
      font: host.fontFamily,
      radius: host.borderRadius,
      clip: after.clipPath,
      // Game sections clip themselves to a cut frame instead of painting a clipped layer.
      sectionClip: host.clipPath,
    };
  });
}

/** Tailwind's color-mix utilities and equivalent rgb() paint serialize differently. Compare rendered pixels. */
async function pixels(page: Page, colors: string[]) {
  return page.evaluate(
    (paints) =>
      paints.map((paint) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d")!;
        context.fillStyle = paint;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data).join(",");
      }),
    colors,
  );
}

/** Resolves a CSS color, such as a color-mix() of a computed color, the way an element would. */
async function resolveColor(page: Page, color: string) {
  return page.evaluate((value) => {
    const probe = document.createElement("span");
    probe.style.color = value;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, color);
}

async function application(page: Page, enabled: Axis[]) {
  await page.evaluate(async (axes) => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    const state = useUIStore.getState();
    state.setChatWidgetApplyFont(axes.includes("font"));
    state.setChatWidgetApplyShape(axes.includes("shape"));
    state.setChatWidgetApplyColors(axes.includes("colors"));
  }, enabled);
  for (const axis of ["font", "shape", "colors"] as const) {
    if (enabled.includes(axis)) {
      await expect(page.locator("html")).toHaveAttribute(`data-chat-widget-apply-${axis}`, "true");
    } else await expect(page.locator("html")).not.toHaveAttribute(`data-chat-widget-apply-${axis}`);
  }
}

async function setStore(page: Page, updates: Record<string, string>) {
  await page.evaluate(async (values) => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    const state = useUIStore.getState() as unknown as Record<string, (value: string) => void>;
    for (const [setter, value] of Object.entries(values)) state[setter]!(value);
  }, updates);
}

for (const [preset, theme] of [
  ["dottore", "dark"],
  ["mari", "light"],
] as const) {
  test(`Game widgets, side remarks, sheets, logs, Inventory and Journal follow ${preset} styling in ${theme} mode`, async ({
    page,
    request,
    isMobile,
  }, info) => {
    test.setTimeout(240_000);
    const fixture = await createGame(request);
    const shots: string[] = [];
    const shoot = async (name: string, target?: Locator) => {
      const path = info.outputPath(`game-widget-style-${preset}-${name}.png`);
      if (target) await target.screenshot({ path, animations: "disabled" });
      else await page.screenshot({ path, animations: "disabled" });
      await info.attach(name, { path, contentType: "image/png" });
      shots.push(path);
    };
    try {
      // Isolate preference sync from the disposable server shared with other specs.
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await page.route("**/api/game-assets/manifest", (route) =>
        route.fulfill({ json: { scannedAt: "2026-07-16T00:00:00.000Z", count: 0, assets: {}, byCategory: {} } }),
      );
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        chatSettingsMoveTipDismissed: true,
        chatHelpSeenModes: ["conversation", "roleplay", "game"],
        appAccentPulseMode: false,
        appAccentRgbMode: false,
        gameTextSpeed: 100,
        theme,
      });
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id: fixture.chatId, version: APP_VERSION },
      );
      await page.goto("/");

      // An already-styled Game chat surface and control to compare against.
      const narration = page.locator('[data-component="GameNarration.ActivePanel"]');
      await expect(narration).toBeVisible({ timeout: 30_000 });
      const side = page.locator(".experience-side-line").filter({ hasText: SIDE_REMARK });
      await expect(side).toBeVisible();
      // Phones show widgets as buttons; open one and keep the other as a control to compare.
      if (isMobile) await page.locator(`button[title="${WIDGET}"]`).click();
      const pill = page.locator(`button[title="${COLLAPSED_WIDGET}"]`);
      const widget = page.locator(".marinara-chat-popover").filter({ hasText: WIDGET }).filter({ visible: true });
      await expect(widget).toHaveCount(1);
      const map = page.locator('[data-tour="game-map"]:not(.mari-window)');
      if (!isMobile) await expect(map).toBeVisible();
      const sheet = page.locator('[data-component="GameCharacterSheet"]');
      const openSheet = async () => {
        await page.locator('.mari-window-bubble[data-window="control:character-profiles"]').click();
        await page.getByTitle(`${CHARACTER} - Click to open character sheet`).filter({ visible: true }).click();
        await expect(sheet).toBeVisible();
        await page.mouse.move(1, 1);
      };
      const closeSheet = async () => {
        await sheet.getByRole("button", { name: "Close character sheet", exact: true }).click();
        await expect(sheet).toBeHidden();
      };
      // Game sections that open over the scene.
      const logs = page.locator('[role="dialog"]').filter({ hasText: "Session Logs" }).locator(":scope > div");
      const inventory = page.getByRole("dialog", { name: "Inventory" }).locator(":scope > div");
      const sections: [Surface, Locator, () => Promise<void>, () => Promise<void>][] = [
        [
          "logs",
          logs,
          () => page.getByRole("button", { name: "Logs", exact: true }).filter({ visible: true }).first().click(),
          () => page.getByRole("button", { name: "Close logs", exact: true }).click(),
        ],
        [
          "inventory",
          inventory,
          // Phones show the Inventory button as its icon alone.
          () => narration.locator("button:has(> svg.lucide-package)").filter({ visible: true }).first().click(),
          () => inventory.getByRole("button", { name: "Close inventory", exact: true }).click(),
        ],
      ];
      const isSection = (name: string) => sections.some(([section]) => section === name);
      const inventoryButton = narration.locator("button:has(> svg.lucide-package)").filter({ visible: true }).first();
      // What the Inventory paints inside: the quantity badge's white text, the item letter's amber,
      // and black tints, which follow the background inside the section but not on its own shadow.
      const inventoryTints = async () => {
        await inventoryButton.click();
        await expect(inventory).toBeVisible();
        await page.mouse.move(1, 1);
        const tints = await inventory.evaluate((section) => {
          const badge = Array.from(section.querySelectorAll<HTMLElement>('span[class~="text-white"]')).find((element) =>
            element.textContent?.trim().endsWith("3"),
          )!;
          const letter = section.querySelector<HTMLElement>('div[class~="text-amber-400/80"]')!;
          return {
            badge: getComputedStyle(badge).color,
            letter: getComputedStyle(letter).color,
            ownBlack: getComputedStyle(section).getPropertyValue("--color-black"),
            innerBlack: getComputedStyle(section.firstElementChild!).getPropertyValue("--color-black"),
            rootBlack: getComputedStyle(document.documentElement).getPropertyValue("--color-black"),
            background: getComputedStyle(section).getPropertyValue("--mari-game-bg"),
          };
        });
        await inventory.getByRole("button", { name: "Close inventory", exact: true }).click();
        await expect(inventory).toBeHidden();
        return tints;
      };
      // Game content in a window follows the window's style: its white tint becomes the window text.
      const journalWhite = async () => {
        const session = await openChatTool(page, "control:session");
        await session.getByRole("button", { name: "Journal", exact: true }).click();
        const journal = session.locator('[data-game-section="journal"]');
        await expect(journal).toBeVisible();
        const colors = await journal.evaluate((element) => [
          getComputedStyle(element).getPropertyValue("--color-white"),
          getComputedStyle(element.closest(".mari-window")!).color,
        ]);
        await session.locator('[data-window-control="close"]').click();
        await expect(session).toBeHidden();
        return pixels(page, colors);
      };

      const surfaces = (): [Surface, Locator][] => [
        ["widget", widget],
        ...(isMobile ? [] : ([["map", map]] as [Surface, Locator][])),
        ["side", side],
      ];
      const measure = async () => {
        await page.mouse.move(1, 1);
        const result = new Map<Surface | "narration" | "pill", Appearance>();
        result.set("narration", await appearance(narration));
        for (const [name, target] of surfaces()) result.set(name, await appearance(target));
        if (isMobile) result.set("pill", await appearance(pill));
        for (const [name, target, open, close] of sections) {
          await open();
          await expect(target).toBeVisible();
          await page.mouse.move(1, 1);
          result.set(name, await appearance(target));
          await close();
          await expect(target).toBeHidden();
        }
        await openSheet();
        result.set("sheet", await appearance(sheet));
        return result;
      };

      // Default with every switch off is the staging look.
      expect((await journalWhite())[0], "the Journal keeps its white text").toBe("255,255,255,255");
      const baseline = await measure();
      await shoot("default-sheet");
      await closeSheet();
      await shoot("default");
      for (const [name, target] of surfaces()) await shoot(`default-${name}`, target);
      const baselinePath = info.outputPath(`game-widget-style-${preset}-default.json`);
      writeFileSync(baselinePath, JSON.stringify(Object.fromEntries(baseline), null, 2));
      await info.attach("default appearance", { path: baselinePath, contentType: "application/json" });
      const expectBaseline = async (current: Map<string, Appearance>) => {
        for (const [name, value] of baseline) {
          if (name === "narration") continue;
          expect(current.get(name), `${name} keeps its own look`).toEqual(value);
        }
      };

      // A preset alone styles windows, not chat surfaces.
      await setStore(page, { setChatWidgetPreset: preset });
      await expect(page.locator("html")).toHaveAttribute("data-chat-widget-preset", preset);
      await expectBaseline(await measure());
      await closeSheet();
      const [journalText, windowText] = await journalWhite();
      expect(journalText, "the Journal uses the window text").toBe(windowText);

      await application(page, ["font"]);
      const lettering = await measure();
      const font = lettering.get("narration")!.font;
      expect(font).not.toBe(baseline.get("narration")!.font);
      for (const [name, value] of lettering) {
        if (name === "narration") continue;
        expect(value.font, `${name} uses the chat font`).toBe(font);
        expect({ ...value, font: baseline.get(name)!.font }, `${name} keeps its shape and colors`).toEqual(
          baseline.get(name),
        );
      }
      await closeSheet();

      await application(page, ["shape"]);
      const shaped = await measure();
      const reference = shaped.get("narration")!;
      if (preset === "dottore") expect(reference.clip).toContain("polygon");
      else expect(reference.radius).not.toBe(baseline.get("narration")!.radius);
      for (const [name, value] of shaped) {
        if (name === "narration") continue;
        const old = baseline.get(name)!;
        expect(value.font, `${name} keeps its font`).toBe(old.font);
        const [paint, oldPaint] = await pixels(page, [value.background, old.background]);
        expect(paint, `${name} keeps its fill`).toBe(oldPaint);
        // A cut control paints its corner marks as images on the same layer.
        if (name !== "pill" || preset !== "dottore") expect(value.image).toBe(old.image);
        if (name === "pill") {
          if (preset === "dottore") expect(value.clip).toContain("polygon");
          else expect(value.radius).not.toBe(old.radius);
        } else if (preset === "dottore") expect(value.clip, `${name} has cut corners`).toBe(reference.clip);
        else expect(value.radius, `${name} has the arched shape`).toBe(reference.radius);
        if (isSection(name) && preset === "dottore") expect(value.sectionClip, `${name} is cut`).toContain("polygon");
      }
      await shoot("shape-sheet");
      await closeSheet();

      await application(page, ["colors"]);
      const colored = await measure();
      const palette = colored.get("narration")!;
      expect(palette.background).not.toBe(baseline.get("narration")!.background);
      // The game's own accent stays on widget values.
      await expect(widget.getByText("3", { exact: true })).toHaveCSS("-webkit-text-fill-color", "rgb(255, 179, 71)");
      for (const [name, value] of colored) {
        if (name === "narration") continue;
        const old = baseline.get(name)!;
        expect(value.background, `${name} uses the widget background`).toBe(palette.background);
        expect([value.font, value.radius, value.clip], `${name} keeps its font and shape`).toEqual([
          old.font,
          old.radius,
          old.clip,
        ]);
        if (name !== "pill") {
          expect(value.textFill, `${name} uses the widget text color`).toBe(palette.textFill);
          expect(value.borderImage).toBe(palette.borderImage);
        }
      }
      await closeSheet();
      const control = await inventoryButton.evaluate((button) => getComputedStyle(button).color);
      const tints = await inventoryTints();
      expect(await pixels(page, [tints.badge]), "Inventory white text uses the widget text color").toEqual(
        await pixels(page, [palette.textFill]),
      );
      expect(await pixels(page, [tints.letter]), "Inventory amber uses the control color").toEqual(
        await pixels(page, [await resolveColor(page, `color-mix(in oklab, ${control} 80%, transparent)`)]),
      );
      expect(tints.ownBlack, "the Inventory's own shadow stays dark").toBe(tints.rootBlack);
      expect(tints.innerBlack, "black tints inside follow the background").toBe(tints.background);
      expect(tints.innerBlack).not.toBe(tints.rootBlack);

      await application(page, ["font", "shape", "colors"]);
      const styled = await measure();
      for (const [name, value] of styled) {
        if (name === "narration" || name === "pill") continue;
        expect(value.font).toBe(font);
        expect(value.textFill).toBe(palette.textFill);
        if (preset === "dottore") expect(value.clip).toBe(reference.clip);
        else {
          expect(value.radius).toBe(reference.radius);
          expect(value.background).toBe(palette.background);
        }
      }
      await shoot("styled-sheet");
      await closeSheet();
      await shoot("styled");

      // Custom gradients reach the same surfaces.
      await setStore(page, {
        setChatWidgetBackgroundColor: GRADIENTS.background,
        setChatWidgetBorderColor: GRADIENTS.border,
        setChatWidgetTextColor: GRADIENTS.text,
      });
      const custom = await measure();
      const customReference = custom.get("narration")!;
      expect(customReference.image).toContain("102, 126, 234");
      for (const [name, value] of custom) {
        if (name === "narration" || name === "pill") continue;
        expect(value.image, `${name} uses the custom background`).toBe(customReference.image);
        expect(value.borderImage, `${name} uses the custom border`).toBe(customReference.borderImage);
        expect(value.textFill, `${name} uses the custom text color`).toBe(customReference.textFill);
      }
      await shoot("custom-sheet");
      await closeSheet();
      await shoot("custom");
      await setStore(page, {
        setChatWidgetBackgroundColor: "",
        setChatWidgetBorderColor: "",
        setChatWidgetTextColor: "",
      });

      // A gradient app accent repaints chat popovers; it must not undo Apply preset colors.
      await setStore(page, { setAppAccentColor: "linear-gradient(90deg, #ff0000, #0000ff)" });
      await expect(page.locator("html")).toHaveAttribute("data-marinara-chat-chrome-accent-mode", "gradient");
      await application(page, ["colors"]);
      const accented = await measure();
      for (const [name, value] of accented) {
        if (name === "narration" || name === "pill") continue;
        expect(value.background, `${name} keeps the widget background under a gradient accent`).toBe(
          accented.get("narration")!.background,
        );
        expect(value.image).toBe(accented.get("narration")!.image);
      }
      await closeSheet();
      await setStore(page, { setAppAccentColor: "" });

      // Default supplies no palette: Game amber marks warnings, so it takes the app accent held steady.
      await setStore(page, { setChatWidgetPreset: "default" });
      await expect(page.locator("html")).not.toHaveAttribute("data-chat-widget-preset");
      const steady = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--marinara-app-accent-static").trim(),
      );
      expect(await pixels(page, [(await inventoryTints()).letter]), "Default amber uses the steady accent").toEqual(
        await pixels(page, [await resolveColor(page, `color-mix(in oklab, ${steady} 80%, transparent)`)]),
      );

      await application(page, []);
      await setStore(page, { setChatWidgetPreset: "default" });
      await expect(page.locator("html")).not.toHaveAttribute("data-chat-widget-preset");
      await expectBaseline(await measure());
      await closeSheet();
      expect((await journalWhite())[0]).toBe("255,255,255,255");
    } catch (error) {
      await shoot("failure").catch(() => undefined);
      throw error;
    } finally {
      try {
        await page.close();
      } finally {
        await fixture.remove();
      }
    }
  });
}

async function createCombat(request: APIRequestContext, mode: "classic" | "tactical") {
  const unit = (id: string, side: "player" | "enemy") => ({
    id,
    name: id,
    side,
    hp: 30,
    maxHp: 40,
    mp: 10,
    maxMp: 10,
    attack: 6,
    defense: 4,
    speed: id === "Hero" ? 12 : 5,
    level: 2,
    skills: [],
  });
  const party = [unit("Hero", "player"), unit("Companion", "player")];
  const enemies = [unit("Guard", "enemy")];
  const created = await request.post("/api/game/create", {
    data: {
      name: `Combat style ${mode}`,
      setupConfig: {
        genre: "Fantasy",
        setting: "Ruins",
        tone: "Adventure",
        difficulty: "normal",
        playerGoals: "Hold",
        gmMode: "standalone",
        rating: "sfw",
        partyCharacterIds: [],
        combatStyle: mode,
        combatDirector: false,
        gmBossControl: false,
        tacticalBattlefield: { seed: 9 },
      },
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const chatId = ((await created.json()) as { sessionChat: { id: string } }).sessionChat.id;
  const remove = async () => {
    await request.delete(`/api/chats/${chatId}?force=true`);
  };
  try {
    type Tactical = { units: { id: string; tactics: unknown }[] };
    let tactical: Tactical | null = null;
    if (mode === "tactical") {
      const started = await request.post("/api/game/combat/tactical/start", {
        data: { chatId, party, enemies, seed: 9 },
      });
      expect(started.ok(), await started.text()).toBeTruthy();
      tactical = ((await started.json()) as { state: Tactical }).state;
    }
    const message = await request.post(`/api/chats/${chatId}/messages`, {
      data: { role: "assistant", content: "Hold the ruins. [state: combat]" },
    });
    expect(message.ok()).toBeTruthy();
    const withTactics = (list: ReturnType<typeof unit>[]) =>
      list.map((c) => ({ ...c, ...(tactical ? { tactics: tactical.units.find((u) => u.id === c.id)!.tactics } : {}) }));
    const patched = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        windowLayout: null,
        chatSettingsHintDismissed: true,
        gameSessionStatus: "active",
        gameIntroPresented: true,
        gameActiveState: "combat",
        gameImageAutoGenerationEnabled: false,
        gameStoryboardAutoIllustrationsEnabled: false,
        gameCombatStyle: mode,
        gameCombatState: {
          party: withTactics(party),
          enemies: withTactics(enemies),
          itemEffects: [],
          mechanics: [],
          dialogueCues: [],
          startMessageId: ((await message.json()) as { id: string }).id,
          combatStyle: mode,
        },
        ...(tactical ? { gameTacticalCombatSnapshot: tactical } : {}),
      },
    });
    expect(patched.ok(), await patched.text()).toBeTruthy();
    return { chatId, remove };
  } catch (error) {
    await remove();
    throw error;
  }
}

for (const mode of ["classic", "tactical"] as const) {
  test(`Game ${mode} combat sections follow the chat style`, async ({ page, request, isMobile }, info) => {
    test.setTimeout(180_000);
    const fixture = await createCombat(request, mode);
    try {
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await page.route("**/api/game-assets/manifest", (route) =>
        route.fulfill({ json: { scannedAt: "2026-07-16T00:00:00.000Z", count: 0, assets: {}, byCategory: {} } }),
      );
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        chatSettingsMoveTipDismissed: true,
        chatHelpSeenModes: ["conversation", "roleplay", "game"],
        appAccentPulseMode: false,
        appAccentRgbMode: false,
        gameInstantTextReveal: true,
        theme: "dark",
      });
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id: fixture.chatId, version: APP_VERSION },
      );
      await page.goto("/");

      // Each style's panels: the classic action bar (a sheet on phones) and round, or the tactical bars.
      const expected =
        mode === "tactical"
          ? ["tactical-status", "combat-ai"]
          : isMobile
            ? ["combat-sheet"]
            : ["combat-round", "combat-actions"];
      for (const name of expected) {
        const section = page.locator(`[data-game-section="${name}"]`).filter({ visible: true });
        await expect(section).toHaveCount(1, { timeout: 40_000 });
        await expect(section, `${name} carries the shared chat style classes`).toHaveClass(
          /(?=.*\bmari-chat-style-surface\b)(?=.*\bmari-game-section\b)/u,
        );
      }
      const read = async () => {
        await page.mouse.move(1, 1);
        const result: Record<string, Appearance> = {};
        for (const name of expected) {
          result[name] = await appearance(page.locator(`[data-game-section="${name}"]`).filter({ visible: true }));
        }
        return result;
      };
      const baseline = await read();
      await page.screenshot({ path: info.outputPath(`combat-${mode}-default.png`), animations: "disabled" });

      // A preset alone keeps them as they are, like the other chat surfaces.
      await setStore(page, { setChatWidgetPreset: "dottore" });
      await expect(page.locator("html")).toHaveAttribute("data-chat-widget-preset", "dottore");
      expect(await read()).toEqual(baseline);

      await application(page, ["font", "shape", "colors"]);
      const palette = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        return [root.getPropertyValue("--mari-widget-bg"), root.getPropertyValue("--mari-widget-text")];
      });
      const styled = await read();
      await page.screenshot({ path: info.outputPath(`combat-${mode}-dottore.png`), animations: "disabled" });
      for (const name of expected) {
        const value = styled[name]!;
        expect(value.font, `${name} uses the Dottore font`).toContain("monospace");
        expect(value.sectionClip, `${name} has cut corners`).toContain("polygon");
        expect(await pixels(page, [value.background, value.textFill]), `${name} uses the Dottore colors`).toEqual(
          await pixels(page, palette),
        );
      }

      await setStore(page, {
        setChatWidgetBackgroundColor: GRADIENTS.background,
        setChatWidgetBorderColor: GRADIENTS.border,
        setChatWidgetTextColor: GRADIENTS.text,
      });
      const custom = await read();
      for (const name of expected) {
        expect(custom[name]!.image, `${name} uses the custom background`).toContain("102, 126, 234");
        expect(custom[name]!.borderImage, `${name} uses the custom border`).toContain("255, 107, 107");
      }
      await setStore(page, {
        setChatWidgetBackgroundColor: "",
        setChatWidgetBorderColor: "",
        setChatWidgetTextColor: "",
      });

      // Pale party, enemy and element colors made for the dark scene stay readable on a light style.
      await setStore(page, { setTheme: "light", setChatWidgetPreset: "mari" });
      await expect(page.locator("html")).toHaveAttribute("data-chat-widget-preset", "mari");
      await page.mouse.move(1, 1);
      const measureContrast = () =>
        page.evaluate((names) => {
          const pale =
            /(?:^|\s)text-(?:red|orange|yellow|green|emerald|cyan|sky|blue|violet|purple|fuchsia|rose)-(?:50|100|200|300|400)(?:\/\d+)?(?=\s|$)/u;
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          const context = canvas.getContext("2d", { willReadFrequently: true })!;
          const paint = (color: string) => {
            context.fillStyle = color;
            context.fillRect(0, 0, 1, 1);
            return Array.from(context.getImageData(0, 0, 1, 1).data);
          };
          const luminance = ([r, g, b]: number[]) => {
            const linear = (value: number) =>
              (value /= 255) <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
            return 0.2126 * linear(r!) + 0.7152 * linear(g!) + 0.0722 * linear(b!);
          };
          const results: [string, number][] = [];
          for (const name of names) {
            for (const section of document.querySelectorAll<HTMLElement>(`[data-game-section="${name}"]`)) {
              if (!section.getClientRects().length) continue;
              for (const element of section.querySelectorAll<HTMLElement>("*")) {
                const text = element.textContent?.trim();
                if (element instanceof SVGElement || !text || !element.getClientRects().length) continue;
                if (!pale.test(element.getAttribute("class") ?? "")) continue;
                // The scene, then every fill from the section down to the element, then its text.
                const chain: HTMLElement[] = [];
                for (
                  let node: HTMLElement | null = element;
                  node && node !== section.parentElement;
                  node = node.parentElement
                ) {
                  chain.unshift(node);
                }
                let background = paint("#000");
                for (const node of chain) background = paint(getComputedStyle(node).backgroundColor);
                const foreground = paint(getComputedStyle(element).color);
                const [light, dark] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
                results.push([`${name} "${text.slice(0, 20)}"`, (light! + 0.05) / (dark! + 0.05)]);
              }
            }
          }
          return results;
        }, expected);
      // Phones show the active party member once the battle intro ends.
      if (mode === "classic") {
        await expect
          .poll(async () => (await measureContrast()).length, { message: "the active party member's color is checked" })
          .toBeGreaterThan(0);
      }
      const contrast = await measureContrast();
      for (const [label, ratio] of contrast) expect(ratio, `${label} is readable`).toBeGreaterThanOrEqual(3);
      await setStore(page, { setTheme: "dark" });

      await application(page, []);
      await setStore(page, { setChatWidgetPreset: "default" });
      await expect(page.locator("html")).not.toHaveAttribute("data-chat-widget-preset");
      expect(await read()).toEqual(baseline);
    } finally {
      try {
        await page.close();
      } finally {
        await fixture.remove();
      }
    }
  });
}
