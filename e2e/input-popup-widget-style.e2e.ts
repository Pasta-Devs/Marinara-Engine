import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;
const GRADIENTS = {
  background: "linear-gradient(135deg, #667eea, #764ba2)",
  border: "linear-gradient(90deg, #ff6b6b, #ffd93d)",
  text: "linear-gradient(90deg, #6c5ce7, #00cec9)",
};
type Mode = "roleplay" | "conversation" | "game";

async function createChats(request: APIRequestContext) {
  const characterIds: string[] = [];
  const chats: { id: string; mode: Mode }[] = [];
  const remove = async () => {
    for (const chat of chats) await request.delete(`/api/chats/${chat.id}?force=true`);
    for (const id of characterIds) await request.delete(`/api/characters/${id}`);
  };
  try {
    for (const name of ["Popup guide", "Popup companion"]) {
      const response = await request.post("/api/characters", { data: { data: { name } } });
      expect(response.ok()).toBeTruthy();
      characterIds.push(((await response.json()) as { id: string }).id);
    }
    for (const mode of ["roleplay", "conversation", "game"] as const) {
      const response = await request.post("/api/chats", { data: { name: `Input popup ${mode}`, mode, characterIds } });
      expect(response.ok()).toBeTruthy();
      const chat = (await response.json()) as { id: string };
      chats.push({ id: chat.id, mode });
      expect(
        (
          await request.patch(`/api/chats/${chat.id}/metadata`, {
            data: {
              windowLayout: null,
              chatSettingsHintDismissed: true,
              enableAgents: mode === "roleplay",
              activeAgentIds: mode === "roleplay" ? ["director"] : [],
              ...(mode === "roleplay"
                ? { roleplayDisplayStyle: "classic", groupChatMode: "individual", groupResponseOrder: "sequential" }
                : {}),
              ...(mode === "game"
                ? {
                    gameId: "input-popup-proof",
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
      expect(
        (
          await request.post(`/api/chats/${chat.id}/messages`, {
            data: { role: "assistant", characterId: characterIds[0], content: "The lantern lights a quiet path." },
          })
        ).ok(),
      ).toBeTruthy();
    }
    return { chats, remove };
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
    };
  });
}

async function application(page: Page, enabled: ("font" | "shape" | "colors")[]) {
  await page.evaluate(async (axes) => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    const state = useUIStore.getState();
    state.setChatWidgetApplyFont(axes.includes("font"));
    state.setChatWidgetApplyShape(axes.includes("shape"));
    state.setChatWidgetApplyColors(axes.includes("colors"));
  }, enabled);
  for (const axis of ["font", "shape", "colors"]) {
    if (enabled.includes(axis as "font" | "shape" | "colors")) {
      await expect(page.locator("html")).toHaveAttribute(`data-chat-widget-apply-${axis}`, "true");
    } else await expect(page.locator("html")).not.toHaveAttribute(`data-chat-widget-apply-${axis}`);
  }
}

async function showChat(page: Page, chat: { id: string; mode: Mode }) {
  await page.evaluate(async (id) => {
    const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
    useChatStore.getState().setActiveChatId(id);
  }, chat.id);
  const area = page.locator(`[data-chat-mode="${chat.mode}"]`);
  await expect(area).toBeVisible();
  await expect(area.locator("textarea[data-chat-composer]").first()).toBeVisible();
  return area;
}

async function inViewport(target: Locator) {
  await expect(target).toBeVisible();
  await expect(target).toBeInViewport({ ratio: 1 });
}

for (const [preset, theme] of [
  ["dottore", "dark"],
  ["mari", "light"],
] as const) {
  test(`input popups independently follow ${preset} styling in ${theme} mode`, async ({
    page,
    request,
    isMobile,
  }, info) => {
    test.setTimeout(180_000);
    const fixture = await createChats(request);
    try {
      // Isolate preference sync from the disposable server shared with other specs.
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        chatSettingsMoveTipDismissed: true,
        chatHelpSeenModes: ["conversation", "roleplay", "game"],
        appAccentPulseMode: false,
        appAccentRgbMode: false,
        showQuickRepliesMenu: true,
        showQuickReplyPostOnly: true,
        showQuickReplyGuide: true,
        theme,
      });
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id: fixture.chats[0]!.id, version: APP_VERSION },
      );
      await page.goto("/");
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setGameTextSpeed(100);
        useUIStore.getState().setGameDialogueDisplayMode("stacked");
      });
      let area = await showChat(page, fixture.chats[0]!);
      const draft = area.locator("textarea[data-chat-composer]").first();
      const replyTrigger = area.getByRole("button", { name: "Quick replies", exact: true });
      const openReplyControl = async () => {
        await draft.fill("A draft for the quick actions.");
        await replyTrigger.click();
        const control = page.locator('[data-chat-input-popup="quick-reply"]').getByRole("menuitem").first();
        await inViewport(control);
        await page.mouse.move(1, 1);
        return control;
      };
      const replyBaseline = await appearance(await openReplyControl());
      await replyTrigger.click();
      await draft.fill("");
      const characterTrigger = area.getByRole("button", { name: "Trigger character response", exact: true });
      await characterTrigger.click();
      const characterPopup = page.getByText("Trigger Response", { exact: true }).locator("..");
      await inViewport(characterPopup);
      const baseline = await appearance(characterPopup);
      const before = info.outputPath(`input-popup-${preset}-before.png`);
      await page.screenshot({ path: before, animations: "disabled" });
      await info.attach("Input popup with styling disabled", { path: before, contentType: "image/png" });
      await page.evaluate(async (selected) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setChatWidgetPreset(selected);
      }, preset);
      await expect(page.locator("html")).toHaveAttribute("data-chat-widget-preset", preset);
      expect(await appearance(characterPopup)).toEqual(baseline);

      await application(page, ["font"]);
      const lettering = await appearance(characterPopup);
      expect(lettering.font).not.toBe(baseline.font);
      expect({ ...lettering, font: baseline.font }).toEqual(baseline);
      await application(page, ["shape"]);
      const shape = await appearance(characterPopup);
      expect(shape.font).toBe(baseline.font);
      expect(shape.background).toBe(baseline.background);
      expect(shape.image).toBe(baseline.image);
      expect([shape.radius, shape.clip]).not.toEqual([baseline.radius, baseline.clip]);
      await application(page, ["colors"]);
      const colors = await appearance(characterPopup);
      expect(colors.font).toBe(baseline.font);
      expect(colors.radius).toBe(baseline.radius);
      expect(colors.clip).toBe(baseline.clip);
      expect(colors.background).not.toBe(baseline.background);
      await application(page, ["font", "shape", "colors"]);
      const styled = await appearance(characterPopup);
      expect(styled.font).toBe(lettering.font);
      expect(styled.radius).toBe(shape.radius);
      expect(styled.background).toBe(colors.background);
      await characterTrigger.click();

      await application(page, []);
      const reply = await openReplyControl();
      expect(await appearance(reply)).toEqual(replyBaseline);
      for (const axis of ["font", "shape", "colors"] as const) {
        await application(page, [axis]);
        const painted = await appearance(reply);
        expect(painted.font).toBe(axis === "font" ? lettering.font : replyBaseline.font);
        expect(painted.background).toBe(axis === "colors" ? colors.background : replyBaseline.background);
        if (axis === "shape") {
          expect([painted.radius, painted.clip]).not.toEqual([replyBaseline.radius, replyBaseline.clip]);
        } else {
          expect([painted.radius, painted.clip]).toEqual([replyBaseline.radius, replyBaseline.clip]);
        }
      }
      await application(page, ["font", "shape", "colors"]);
      const combinedReply = await appearance(reply);
      expect(combinedReply.font).toBe(lettering.font);
      expect(combinedReply.background).toBe(colors.background);
      expect([combinedReply.radius, combinedReply.clip]).not.toEqual([replyBaseline.radius, replyBaseline.clip]);
      await replyTrigger.click();
      await draft.fill("");

      // Exercise the actual icon-opened menus, including body portals and the
      // separate mobile media sheet. Match rendered paint, not CSS class names.
      for (const gradients of [false, true]) {
        if (gradients) {
          await page.evaluate(async (paints) => {
            const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
            const state = useUIStore.getState();
            state.setChatWidgetBackgroundColor(paints.background);
            state.setChatWidgetBorderColor(paints.border);
            state.setChatWidgetTextColor(paints.text);
          }, GRADIENTS);
        }
        const check = async (target: Locator, control = false) => {
          await inViewport(target);
          await page.mouse.move(1, 1);
          const painted = await appearance(target);
          expect(painted.font).toBe(lettering.font);
          if (gradients) {
            expect(painted.image).toContain("linear-gradient");
            expect(painted.image).toContain("102, 126, 234");
            if (!control) {
              expect(painted.borderImage).toContain("255, 107, 107");
              expect(painted.textFill).toBe("rgb(108, 92, 231)");
            }
          } else expect(painted.background).toBe(colors.background);
          if (!control) {
            expect(painted.radius).toBe(shape.radius);
            expect(painted.clip).toBe(shape.clip);
          }
        };
        for (const chat of fixture.chats) {
          area = await showChat(page, chat);
          if (chat.mode === "roleplay") {
            await characterTrigger.click();
            await check(characterPopup);
            if (gradients) {
              await expect(characterPopup.getByText("Popup guide", { exact: true })).toHaveCSS(
                "background-image",
                /108, 92, 231/,
              );
            }
            const path = info.outputPath(`input-popup-${preset}-character-${gradients ? "gradient" : "preset"}.png`);
            await page.screenshot({ path, animations: "disabled" });
            await info.attach(`${preset} character popup ${gradients ? "gradient" : "preset"}`, {
              path,
              contentType: "image/png",
            });
            await characterTrigger.click();
            const story = area.getByRole("button", { name: "Push Story", exact: true });
            await story.click();
            const storyPopup = page.locator('[data-chat-input-popup="story"]');
            await check(storyPopup);
            await storyPopup.getByRole("menuitem", { name: /Naturally/ }).click();
            await expect(storyPopup).toBeHidden();
            await area.getByRole("button", { name: /Push Story.*naturally/i }).click();
          }
          if (chat.mode === "conversation") {
            const mediaTrigger = area.getByRole("button", { name: "Emoji, GIFs, stickers & tools", exact: true });
            await mediaTrigger.click();
            const media = page.locator('[data-chat-input-popup="media"]:visible');
            await check(media);
            await media.getByRole("button", { name: "Tools", exact: true }).click();
            await expect(media.getByRole("button", { name: /Post only/ })).toBeVisible();
            const path = info.outputPath(`input-popup-${preset}-media-${gradients ? "gradient" : "preset"}.png`);
            await page.screenshot({ path, animations: "disabled" });
            await info.attach(`${preset} media popup ${gradients ? "gradient" : "preset"}`, {
              path,
              contentType: "image/png",
            });
            await area.locator("textarea[data-chat-composer]").first().click();
            await expect(media).toBeHidden();
          }
          if (chat.mode === "game") {
            const addressTrigger = area.getByRole("button", { name: /^Choose who to address/ });
            await addressTrigger.click();
            await check(page.locator('[data-chat-input-popup="address"]'));
            await addressTrigger.click();
            const diceTrigger = area.getByRole("button", { name: "Roll dice", exact: true });
            await diceTrigger.click();
            await check(page.locator('[data-chat-input-popup="dice"]'));
            const diceField = page.locator("[data-chat-dice-input]");
            await check(diceField, true);
            const diceAppearance = await appearance(diceField);
            expect(diceAppearance.radius).toBe(combinedReply.radius);
            expect(diceAppearance.clip).toBe(combinedReply.clip);
            await expect(diceField.getByRole("textbox")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
            await expect(diceField.getByRole("textbox")).toHaveCSS("background-image", "none");
            await diceField.getByRole("textbox").fill("2d6+1");
            await expect(diceField.getByRole("textbox")).toHaveValue("2d6+1");
            await diceField.getByRole("textbox").fill("");
            const frameWidth = () =>
              diceField.evaluate((element) => getComputedStyle(element, "::after").borderTopWidth);
            if (preset === "dottore") {
              await expect(diceField).toHaveCSS("box-shadow", "none");
              await expect.poll(frameWidth).toBe("2px");
              await diceField.screenshot({
                path: info.outputPath(`dice-input-${gradients ? "gradient" : "preset"}-focused.png`),
              });
            }
            await diceField.getByRole("textbox").blur();
            if (preset === "dottore") {
              await expect.poll(frameWidth).toBe("1px");
              await diceField.screenshot({
                path: info.outputPath(`dice-input-${gradients ? "gradient" : "preset"}-normal.png`),
              });
            }
            const path = info.outputPath(`input-popup-${preset}-game-${gradients ? "gradient" : "preset"}.png`);
            await page.screenshot({ path, animations: "disabled" });
            await info.attach(`${preset} Game dice ${gradients ? "gradient" : "preset"}`, {
              path,
              contentType: "image/png",
            });
            await diceTrigger.click();
          }
          if (chat.mode !== "conversation" && !isMobile) {
            const emojiTrigger = area.getByRole("button", { name: "Emoji", exact: true });
            await emojiTrigger.click();
            const emoji = page.locator("[data-emoji-picker]");
            await check(emoji);
            await emoji.getByRole("textbox", { name: "Search emojis", exact: true }).fill("smile");
            await expect(emoji.getByRole("button", { name: /smil/i }).first()).toBeVisible();
            await emojiTrigger.click();
          }
          if (chat.mode === "roleplay" || (chat.mode === "conversation" && !isMobile)) {
            const input = area.locator("textarea[data-chat-composer]").first();
            await input.fill("A draft for the quick actions.");
            const replies = area.getByRole("button", { name: "Quick replies", exact: true });
            await replies.click();
            const menu = page.locator('[data-chat-input-popup="quick-reply"]');
            await check(menu.getByRole("menuitem").first(), true);
            await replies.click();
            await input.fill("");
          }
          if (chat.mode !== "game") {
            const input = area.locator("textarea[data-chat-composer]").first();
            await input.fill("/");
            const commands = page.locator('[data-chat-input-popup="commands"]');
            await check(commands);
            if (preset === "dottore") {
              expect(
                await commands.evaluate((element) => {
                  const rect = element.getBoundingClientRect();
                  return element.contains(document.elementFromPoint(rect.left + 1, rect.top + 1));
                }),
              ).toBe(false);
            }
            const path = info.outputPath(`input-popup-${preset}-${chat.mode}-${gradients ? "gradient" : "preset"}.png`);
            await page.screenshot({ path, animations: "disabled" });
            await info.attach(`${preset} ${chat.mode} commands ${gradients ? "gradient" : "preset"}`, {
              path,
              contentType: "image/png",
            });
            await input.fill("");
          }
        }
      }
      await application(page, []);
      await showChat(page, fixture.chats[0]!);
      await characterTrigger.click();
      expect(await appearance(characterPopup)).toEqual(baseline);
    } catch (error) {
      const path = info.outputPath("input-popup-failure.png");
      await page.screenshot({ path, animations: "disabled" });
      await info.attach("Input popup at assertion failure", { path, contentType: "image/png" });
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
