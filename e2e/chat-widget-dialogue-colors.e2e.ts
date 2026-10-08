import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

// A character's own dialogue color must outrank Apply preset colors (#7167).
const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;
const ADA = { name: "Ada Quill", color: "#ff5500", rgb: "rgb(255, 85, 0)" };
const BRAM = { name: "Bram Holt", color: "#22c55e", rgb: "rgb(34, 197, 94)" };
const CORA = { name: "Cora Lin" };
const DAX = { name: "Dax Vale", color: "#8b5cf6", rgb: "rgb(139, 92, 246)" };
const GRADIENT_TEXT = "linear-gradient(90deg, #6c5ce7, #00cec9)";
// Immersive HTML output from #7296: a cream card that sets black text itself.
const INK = "rgb(0, 0, 0)";
const CHROME_TEXT = { color: "#6ab04c", rgb: "rgb(106, 176, 76)" };
const IMMERSIVE_HTML = [
  "<style>.rm-ink{color:#000000}</style>",
  '<div style="background:#fdf6e3;color:#000000;padding:12px">',
  "<h3>Ribbon Merchant</h3>",
  '<p style="color:#000000">Inline ink</p>',
  '<font color="#000000">Font ink</font>',
  "</div>",
  '<p class="rm-ink">Class ink</p>',
  "<p>Plain narration.</p>",
  `<p>${CORA.name} says "Fine silks" softly.</p>`,
].join("\n");
type Theme = "dark" | "light";
const PRESETS = ["default", "mari", "dottore"] as const;

async function createFixture(request: APIRequestContext, mode: "roleplay" | "game") {
  const ids: { characters: string[]; chat?: string; persona?: string } = { characters: [] };
  const remove = async () => {
    if (ids.chat) await request.delete(`/api/chats/${ids.chat}?force=true`).catch(() => undefined);
    await Promise.all(ids.characters.map((id) => request.delete(`/api/characters/${id}`).catch(() => undefined)));
    if (ids.persona) await request.delete(`/api/characters/personas/${ids.persona}`).catch(() => undefined);
  };
  try {
    const character = async (name: string, dialogueColor?: string) => {
      const response = await request.post("/api/characters", {
        data: { data: { name, ...(dialogueColor ? { extensions: { dialogueColor } } : {}) } },
      });
      expect(response.ok()).toBeTruthy();
      const id = ((await response.json()) as { id: string }).id;
      ids.characters.push(id);
      return id;
    };
    const ada = await character(ADA.name, ADA.color);
    const bram = await character(BRAM.name, BRAM.color);
    const cora = await character(CORA.name);
    const persona = await request.post("/api/characters/personas", {
      data: { name: DAX.name, dialogueColor: DAX.color },
    });
    expect(persona.ok()).toBeTruthy();
    ids.persona = ((await persona.json()) as { id: string }).id;
    const response = await request.post("/api/chats", {
      data: { name: `Dialogue colors ${mode}`, mode, characterIds: [ada, bram, cora], personaId: ids.persona },
    });
    expect(response.ok()).toBeTruthy();
    ids.chat = ((await response.json()) as { id: string }).id;
    const metadata =
      mode === "roleplay"
        ? { groupChatMode: "individual" }
        : {
            gameId: ids.chat,
            gameSessionStatus: "active",
            gameSessionNumber: 1,
            gameIntroPresented: true,
            gameActiveState: "exploration",
            gameImageAutoGenerationEnabled: false,
            gamePartyCharacterIds: [ada, bram, cora],
          };
    expect(
      (
        await request.patch(`/api/chats/${ids.chat}/metadata`, {
          data: { windowLayout: null, chatSettingsHintDismissed: true, enableAgents: false, ...metadata },
        })
      ).ok(),
    ).toBeTruthy();
    const post = async (characterId: string | null, content: string, role = "assistant") => {
      const posted = await request.post(`/api/chats/${ids.chat}/messages`, {
        data: { role, characterId, content },
      });
      expect(posted.ok()).toBeTruthy();
      return ((await posted.json()) as { id: string }).id;
    };
    const messages =
      mode === "roleplay"
        ? {
            uncolored: await post(cora, `${CORA.name} shrugs. "No color here."`),
            html: await post(ada, `<div class="note">${ADA.name} lifts the lamp. "Follow *me* now."</div>`),
            speaker: await post(ada, `<speaker="${BRAM.name}">"Bram keeps his own color."</speaker>`),
            htmlSpeaker: await post(
              ada,
              `<div class="note"><speaker="${BRAM.name}">"Bram *rides* the HTML path."</speaker></div>`,
            ),
            persona: await post(null, `${DAX.name} nods. "Lead *on*, then."`, "user"),
            immersive: await post(cora, IMMERSIVE_HTML),
            // Keep last: the visual-novel display shows the latest message.
            plain: await post(ada, `${ADA.name} leans in. "Keep *this* close," she whispers.`),
          }
        : {
            game: await post(
              null,
              [
                "A lamp burns.",
                `[${ADA.name}] [main] [calm]: "Keep *this* close."`,
                `[${CORA.name}] [main] [calm]: "No color here."`,
                `[${ADA.name}] [side]: "Watch the ridge."`,
              ].join("\n\n"),
            ),
          };
    return { chatId: ids.chat, messages, remove };
  } catch (error) {
    await remove();
    throw error;
  }
}

async function open(page: Page, chatId: string, theme: Theme) {
  // Isolate preference sync from the disposable server shared with other specs.
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.route("**/api/game-assets/manifest", (route) =>
    route.fulfill({ json: { scannedAt: "2026-07-16T00:00:00.000Z", count: 0, assets: {}, byCategory: {} } }),
  );
  await seedUIState(
    page,
    {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatSettingsMoveTipDismissed: true,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
      appAccentPulseMode: false,
      appAccentRgbMode: false,
      gameInstantTextReveal: true,
      theme,
    },
    // Keep the chosen preset across the visual-novel reload.
    "if-missing",
  );
  await page.addInitScript(
    ({ chatId, version }) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem("marinara:whats-new:seen-version", version);
    },
    { chatId, version: APP_VERSION },
  );
  await page.goto("/");
}

async function setStore(page: Page, updates: Record<string, string | boolean>) {
  await page.evaluate(async (values) => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    const state = useUIStore.getState() as unknown as Record<string, (value: string | boolean) => void>;
    for (const [setter, value] of Object.entries(values)) state[setter]!(value);
  }, updates);
}

async function readCssColor(page: Page, variable: string) {
  return page.evaluate((name) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, variable);
}

async function paint(target: Locator) {
  return target.evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, fill: style.webkitTextFillColor, image: style.backgroundImage };
  });
}

/** Both the color and the painted fill are the character's color, with no preset gradient on top. */
async function expectOwnColor(target: Locator, rgb: string, label: string) {
  await expect(target, label).toHaveCount(1);
  expect(await paint(target), label).toEqual({ color: rgb, fill: rgb, image: "none" });
}

async function setPreset(page: Page, preset: "default" | "mari" | "dottore", applyColors: boolean) {
  await setStore(page, { setChatWidgetPreset: preset, setChatWidgetApplyColors: applyColors });
  if (preset === "default") await expect(page.locator("html")).not.toHaveAttribute("data-chat-widget-preset");
  else await expect(page.locator("html")).toHaveAttribute("data-chat-widget-preset", preset);
  if (applyColors) await expect(page.locator("html")).toHaveAttribute("data-chat-widget-apply-colors", "true");
  else await expect(page.locator("html")).not.toHaveAttribute("data-chat-widget-apply-colors");
}

for (const theme of ["dark", "light"] as const) {
  test(`Roleplay dialogue keeps each character's color under Apply preset colors (${theme})`, async ({
    page,
    request,
  }, info) => {
    test.setTimeout(120_000);
    const fixture = await createFixture(request, "roleplay");
    try {
      await open(page, fixture.chatId, theme);
      const content = (id: string) => page.locator(`[data-message-id="${id}"] .mari-message-content`).first();
      const plain = content(fixture.messages.plain!).locator("strong").filter({ hasText: "Keep" });
      const html = content(fixture.messages.html!).locator("strong").filter({ hasText: "Follow" });
      const speaker = content(fixture.messages.speaker!).locator("strong").filter({ hasText: "Bram keeps" });
      const htmlSpeaker = content(fixture.messages.htmlSpeaker!).locator("strong").filter({ hasText: "Bram rides" });
      const persona = content(fixture.messages.persona!).locator("strong").filter({ hasText: "Lead on" });
      const uncolored = content(fixture.messages.uncolored!).locator("strong").filter({ hasText: "No color" });
      const bubble = page.locator(`[data-message-id="${fixture.messages.uncolored}"] .mari-rp-bubble`).first();
      await expect(plain).toBeVisible({ timeout: 30_000 });

      const expectCharacterColors = async (label: string) => {
        await expectOwnColor(plain, ADA.rgb, `${label}: plain dialogue`);
        await expectOwnColor(plain.locator("em"), ADA.rgb, `${label}: italics inside plain dialogue`);
        await expectOwnColor(html, ADA.rgb, `${label}: HTML dialogue`);
        await expectOwnColor(html.locator("em"), ADA.rgb, `${label}: italics inside HTML dialogue`);
        await expectOwnColor(speaker, BRAM.rgb, `${label}: group speaker dialogue`);
        await expectOwnColor(htmlSpeaker, BRAM.rgb, `${label}: group speaker in an HTML message`);
        await expectOwnColor(htmlSpeaker.locator("em"), BRAM.rgb, `${label}: italics inside HTML speaker dialogue`);
        await expectOwnColor(persona, DAX.rgb, `${label}: persona dialogue`);
        await expectOwnColor(persona.locator("em"), DAX.rgb, `${label}: italics inside persona dialogue`);
      };

      // Apply preset colors off: the existing look.
      await expectCharacterColors("switch off");
      const baseline = await paint(uncolored);
      expect(baseline.fill).toBe(baseline.color);

      for (const preset of PRESETS) {
        await setPreset(page, preset, true);
        await expectCharacterColors(preset);
        // Dialogue without a character color keeps following the preset text.
        const surface = await paint(bubble);
        expect((await paint(uncolored)).fill, `${preset}: uncolored dialogue follows the preset`).toBe(surface.fill);
        await page.screenshot({ path: info.outputPath(`roleplay-${preset}-${theme}.png`), animations: "disabled" });

        // A custom gradient text color paints text leaves, but not character dialogue.
        await setStore(page, { setChatWidgetTextColor: GRADIENT_TEXT });
        await expect(page.locator("html")).toHaveAttribute("data-chat-widget-colors", /\btext\b/);
        await expectCharacterColors(`${preset} with gradient text`);
        expect((await paint(uncolored)).image, `${preset}: uncolored dialogue keeps the gradient`).toContain(
          "linear-gradient",
        );
        await setStore(page, { setChatWidgetTextColor: "" });
      }

      // Nothing changes with the switch off again.
      await setPreset(page, "mari", false);
      await expectCharacterColors("switch off again");
      expect(await paint(uncolored)).toEqual(baseline);

      // Visual-novel display renders the latest paragraph through the same path.
      await setPreset(page, "mari", true);
      expect(
        (
          await request.patch(`/api/chats/${fixture.chatId}/metadata`, {
            data: { roleplayDisplayStyle: "visual-novel" },
          })
        ).ok(),
      ).toBeTruthy();
      await page.reload();
      const novel = page.locator("[data-roleplay-vn]");
      await expect(novel).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("html")).toHaveAttribute("data-chat-widget-apply-colors", "true");
      const novelDialogue = novel.locator("strong").filter({ hasText: "Keep" });
      await expectOwnColor(novelDialogue, ADA.rgb, "visual novel dialogue");
      await expectOwnColor(novelDialogue.locator("em"), ADA.rgb, "italics inside visual novel dialogue");
      await page.screenshot({ path: info.outputPath(`roleplay-vn-mari-${theme}.png`), animations: "disabled" });
    } finally {
      try {
        await page.close();
      } finally {
        await fixture.remove();
      }
    }
  });

  test(`HTML messages keep their own text colors with a custom Chat Chrome Text Color (${theme})`, async ({
    page,
    request,
  }, info) => {
    test.setTimeout(120_000);
    const fixture = await createFixture(request, "roleplay");
    try {
      await open(page, fixture.chatId, theme);
      const message = page.locator(`[data-message-id="${fixture.messages.immersive}"]`);
      const content = message.locator(".mari-message-content").first();
      const bubble = message.locator(".mari-rp-bubble").first();
      const inked = {
        "inherited heading": content.locator("h3").filter({ hasText: "Ribbon Merchant" }),
        "inline color": content.locator("p").filter({ hasText: "Inline ink" }),
        "font color": content.locator("font").filter({ hasText: "Font ink" }),
        "class from the message's own style": content.locator("p").filter({ hasText: "Class ink" }),
      };
      const narration = content.locator("p").filter({ hasText: "Plain narration." });
      const dialogue = content.locator("strong").filter({ hasText: "Fine silks" });
      await expect(inked["inline color"]).toBeVisible({ timeout: 30_000 });
      await setStore(page, { setChatChromeTextColor: CHROME_TEXT.color });
      await expect.poll(() => readCssColor(page, "--marinara-chat-chrome-text")).toBe(CHROME_TEXT.rgb);
      const chromeText = await readCssColor(page, "--marinara-chat-chrome-panel-text");

      const expectInk = async (label: string, skip?: keyof typeof inked) => {
        for (const [name, target] of Object.entries(inked)) {
          if (name !== skip) await expectOwnColor(target, INK, `${label}: ${name}`);
        }
      };

      // Apply preset colors off: the chrome color never reaches messages.
      await expectInk("switch off");
      const baseline = await paint(narration);

      for (const preset of PRESETS) {
        await setPreset(page, preset, true);
        await expectInk(preset);
        // Text without a color of its own, and dialogue without a character color, follow the preset.
        const surface = await paint(bubble);
        if (preset === "default") expect(surface.fill, "default: messages use Chat Chrome Text Color").toBe(chromeText);
        expect((await paint(narration)).fill, `${preset}: plain narration follows the preset`).toBe(surface.fill);
        expect((await paint(dialogue)).fill, `${preset}: uncolored dialogue follows the preset`).toBe(surface.fill);
        await bubble.scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath(`html-${preset}-${theme}.png`), animations: "disabled" });

        await setStore(page, { setChatWidgetTextColor: GRADIENT_TEXT });
        await expect(page.locator("html")).toHaveAttribute("data-chat-widget-colors", /\btext\b/);
        // A color set only by a class still takes the gradient (ponytail note in chat-widget-surfaces.css).
        await expectInk(`${preset} with gradient text`, "class from the message's own style");
        expect((await paint(narration)).image, `${preset}: plain narration keeps the gradient`).toContain(
          "linear-gradient",
        );
        expect((await paint(dialogue)).image, `${preset}: uncolored dialogue keeps the gradient`).toContain(
          "linear-gradient",
        );
        await setStore(page, { setChatWidgetTextColor: "" });
      }

      await setPreset(page, "default", false);
      await expectInk("switch off again");
      expect(await paint(narration)).toEqual(baseline);
    } finally {
      try {
        await page.close();
      } finally {
        await fixture.remove();
      }
    }
  });

  test(`Game dialogue keeps each character's color under Apply preset colors (${theme})`, async ({
    page,
    request,
  }, info) => {
    test.setTimeout(120_000);
    const fixture = await createFixture(request, "game");
    try {
      await open(page, fixture.chatId, theme);
      const panel = page.locator('[data-component="GameNarration.ActivePanel"]');
      await expect(panel).toContainText("A lamp burns.", { timeout: 30_000 });
      const next = panel.getByRole("button", { name: "Next", exact: true });
      const box = panel.locator(".game-narration-prose > div");
      const name = panel.locator(".experience-dialogue-speaker");
      const sideLine = page.locator(".experience-side-line").filter({ hasText: "Watch the ridge." });
      const side = sideLine.locator("p");
      const sideName = sideLine.getByText(ADA.name, { exact: true });
      const withGradientText = async (check: () => Promise<void>) => {
        await setStore(page, { setChatWidgetTextColor: GRADIENT_TEXT });
        await expect(page.locator("html")).toHaveAttribute("data-chat-widget-colors", /\btext\b/);
        await check();
        await setStore(page, { setChatWidgetTextColor: "" });
      };

      // Ada's line, its italics and her name paint exactly as they do without the preset colors.
      await next.click();
      await expect(box).toContainText("Keep this close.");
      const ada = { line: await paint(box), em: await paint(box.locator("em")) };
      expect(ada.line).toEqual({ color: ADA.rgb, fill: ADA.rgb, image: "none" });
      expect(ada.em).toEqual(ada.line);
      const expectAda = async (label: string) => {
        expect(await paint(box), `${label}: Game dialogue`).toEqual(ada.line);
        expect(await paint(box.locator("em")), `${label}: italics inside Game dialogue`).toEqual(ada.em);
        await expectOwnColor(name, ADA.rgb, `${label}: Game speaker name`);
        await expectOwnColor(name.locator("span"), ADA.rgb, `${label}: Game speaker name text`);
      };
      await expectAda("switch off");
      for (const preset of PRESETS) {
        await setPreset(page, preset, true);
        await expectAda(preset);
        await page.screenshot({ path: info.outputPath(`game-${preset}-${theme}.png`), animations: "disabled" });
        await withGradientText(() => expectAda(`${preset} with gradient text`));
      }
      await setPreset(page, "default", false);

      // Cora has no dialogue color, so her line and name follow the preset text.
      await next.click();
      await expect(box).toContainText("No color here.");
      const cora = { line: await paint(box), name: await paint(name) };
      await expect(side).toBeVisible();
      const expectSide = async (label: string) => {
        await expectOwnColor(side, ADA.rgb, `${label}: side remark`);
        await expectOwnColor(sideName, ADA.rgb, `${label}: side remark name`);
      };
      await expectSide("switch off");
      const stacked = page.locator(".mari-game-stacked-log").getByText("Keep this close.");
      const stackedNames = page.locator(".mari-game-stacked-log").getByText(ADA.name, { exact: true });
      for (const preset of PRESETS) {
        await setPreset(page, preset, true);
        const surface = await paint(panel);
        expect((await paint(box)).fill, `${preset}: uncolored Game dialogue follows the preset`).toBe(surface.fill);
        expect((await paint(name)).fill, `${preset}: uncolored Game name follows the preset`).toBe(surface.fill);
        await expectSide(preset);
        await withGradientText(async () => {
          await expectSide(`${preset} with gradient text`);
          expect((await paint(box)).image, `${preset}: uncolored Game dialogue keeps the gradient`).toContain(
            "linear-gradient",
          );
        });
        // The stacked display keeps earlier lines in its own log surface.
        await setStore(page, { setGameDialogueDisplayMode: "stacked" });
        await expect(stacked).toBeVisible();
        await expectOwnColor(stacked, ADA.rgb, `${preset}: stacked Game dialogue`);
        await expect(stackedNames.first()).toBeVisible();
        for (const stackedName of await stackedNames.all()) {
          await expectOwnColor(stackedName, ADA.rgb, `${preset}: stacked Game speaker name`);
        }
        await setStore(page, { setGameDialogueDisplayMode: "classic" });
      }

      await setPreset(page, "default", false);
      expect({ line: await paint(box), name: await paint(name) }).toEqual(cora);
    } finally {
      try {
        await page.close();
      } finally {
        await fixture.remove();
      }
    }
  });
}
