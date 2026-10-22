import { expect, test, type Page } from "@playwright/test";
import { UI_PERSISTENCE } from "../packages/client/src/lib/ui-persistence.js";
import {
  engineStorageWrites,
  installPackageClient,
  packageClientPath,
  preparePackagePage as prepare,
  recordStorageWrites,
  waitForPackageClient,
} from "./host-package-fixture.js";
import { seedUIState } from "./ui-state-fixture.js";

// Older catalog packages (tic-tac-toe@1.0.5 among them) bundle their own copy of the UI store at version 74. On
// load it rewrites the shared key with only the settings it knows: everything below disappears from the blob.
const DROPPED_BY_V74_COPY = [
  "showHomeBrowserAddressBar",
  "noodleNavigation",
  "libraryManualOrders",
  "trackerPanelOpenByChatId",
  "trackerStatDisplayMode",
  "reduceAmbientEffects",
  "mariPanelSortMode",
  "omnibarAsideEnabled",
  "omnibarAsideConnectionId",
  "omnibarAsideDisclosed",
  "omnibarAsideDelayMs",
  "mariEditViewMode",
  "mariUnlockedPackIds",
  "mariSeasonOptOut",
  "mariConnectionId",
  "conversationBackgroundImageOpacity",
  "chatWidgetPreset",
  "chatWidgetFont",
  "chatWidgetShape",
  "chatWidgetButtonSize",
  "chatWidgetBorderColor",
  "chatWidgetBackgroundColor",
  "chatWidgetTextColor",
  "chatWidgetApplyFont",
  "chatWidgetApplyShape",
  "chatWidgetApplyColors",
  "showPaidAgentConnectionWarning",
  "gameNarrationCollapsed",
  "chatListBackgrounds",
  "autoSaveGeneratedImagesToGalleries",
  "imageGameWidth",
  "imageGameHeight",
  "imageCharacterSheetWidth",
  "imageCharacterSheetHeight",
  "alwaysDisplayConversationSwipeMenu",
  "alwaysDisplayRoleplaySwipeMenu",
  "conversationAvatarShape",
  "showContextUsage",
  "showHistoryTrimNotice",
  "showCharactersInPersonaPickers",
  "keepGuidanceAfterRegenerate",
  "customQuickReplies",
  "chatSettingsExpandedSections",
  "includePrivateNotesInExports",
  "colorInlineNames",
  "disableInlineNameGradients",
  "continueAddsNewline",
  "commandCenterMariEnabled",
  "omnibarSuggestionsEnabled",
  "seasonalThemesDisabled",
  "seasonalGreetingYears",
  "seasonalThemeOffYears",
  "defaultDialogueColor",
  "roleplayReducedPaintEffects",
  "showRoleplayThinkingInMessages",
  "keepRoleplayThinkingExpanded",
  "gameTextEffectsEnabled",
  "roleplayNarratorAvatarCycling",
  "roleplayDisplayStyle",
  "roleplayChatPosition",
  "roleplayVnAutoPlay",
  "roleplayVnAutoPlayDelay",
  "roleplayVnPortraitScale",
  "roleplayVnSpriteScale",
  "enterToSendProfessorMari",
  "chatHelpSeenModes",
  "chatHelpButtonHidden",
  "chatSettingsMoveTipDismissed",
  "chatWindowIntroDismissed",
  "echoChamberSideByChatId",
  "echoChamberSizeByChatId",
  "notificationPosition",
  "chatWizardDefaults",
  "conversationTimeZone",
  "activeImpersonatePromptTemplateId",
  "addCyoaChoicesToMessage",
];

// Browser-only settings the v74 copy drops; the server never holds them, so nothing else can bring them back.
const LOCAL_SETTINGS = { roleplayReducedPaintEffects: true, activeImpersonatePromptTemplateId: "e2e-template" };
const LEGACY_MARI_CONNECTION_KEY = "marinara:home-professor-mari-connection-id";
const PACKAGE_ID = "e2e-ui-store-package";

/** Installs one package whose client module is `body`, and records the stored blob's version as each page starts. */
async function installUIStorePackage(page: Page, body: string) {
  await page.addInitScript((name) => {
    const versions = JSON.parse(sessionStorage.getItem("e2e:stored-versions") ?? "[]") as unknown[];
    versions.push(JSON.parse(localStorage.getItem(name) ?? "null")?.version ?? null);
    sessionStorage.setItem("e2e:stored-versions", JSON.stringify(versions));
  }, UI_PERSISTENCE.name);
  await installPackageClient(page, PACKAGE_ID, body);
}

/**
 * A client built before the host namespace: its bundled v74 store reads the key once, keeps only the settings it knows
 * and saves them at v74 (again as the page goes away, after the Engine's own last save).
 */
function oldPackageClient() {
  return `
const name = ${JSON.stringify(UI_PERSISTENCE.name)};
const stored = JSON.parse(localStorage.getItem(name) ?? "null");
if (stored && stored.version !== 74) {
  const state = { ...stored.state };
  for (const key of ${JSON.stringify(DROPPED_BY_V74_COPY)}) delete state[key];
  Object.assign(state, { installedExtensions: [], characterPanelSearch: "" });
  const save = () => localStorage.setItem(name, JSON.stringify({ state, version: 74 }));
  save();
  addEventListener("pagehide", save);
}`;
}

function readPersisted(page: Page) {
  return page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    return useUIStore.persist.getOptions().partialize(useUIStore.getState()) as Record<string, unknown>;
  });
}

function readStored(page: Page) {
  return page.evaluate((name) => JSON.parse(localStorage.getItem(name) ?? "null"), UI_PERSISTENCE.name) as Promise<{
    state: Record<string, unknown>;
    version: number;
  } | null>;
}

function storedVersionsAtStart(page: Page) {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem("e2e:stored-versions") ?? "[]") as unknown[]);
}

function pick(state: Record<string, unknown>, keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, state[key]]));
}

test.describe("UI settings and an old package's copy of the UI store", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!testInfo.project.name.includes("desktop"), "One browser proves the shared browser-storage path.");
  });

  test("a package client changes the Engine's live UI store and writes no Engine key itself", async ({ page }) => {
    await prepare(page);
    await seedUIState(page, { hasCompletedOnboarding: true }, "if-missing");
    await recordStorageWrites(page);
    await installUIStorePackage(
      page,
      `const ui = globalThis.__MARINARA_HOST__?.stores.ui;
globalThis.__e2eUIStoreAtImport = ui ?? null;
ui?.getState().setRoleplayReducedPaintEffects(true);`,
    );
    await page.goto("/");
    await waitForPackageClient(page);
    expect(
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        return {
          liveStore: (globalThis as { __e2eUIStoreAtImport?: unknown }).__e2eUIStoreAtImport === useUIStore,
          changed: useUIStore.getState().roleplayReducedPaintEffects,
        };
      }),
    ).toEqual({ liveStore: true, changed: true });
    // The package changed the Engine's own settings, so the Engine saves them.
    await expect.poll(async () => (await readStored(page))?.state.roleplayReducedPaintEffects).toBe(true);
    const writes = await engineStorageWrites(page);
    expect(
      writes.some((write) => write.key === UI_PERSISTENCE.name && write.caller.includes("/src/stores/ui.store.ts")),
      "the Engine's store saved the package's change",
    ).toBe(true);
    // No write to marinara-engine-ui, marinara-active-chat-id, marinara-input-drafts or another Engine key came from
    // the package's own code.
    expect(writes.filter((write) => write.caller.includes(packageClientPath(PACKAGE_ID)))).toEqual([]);
  });

  test("settings survive an old package client saving its v74 copy over them", async ({ page }) => {
    await prepare(page);
    // From a v74 blob, migrations would size the sheet like this background and restore this old Mari connection;
    // the user's saved sheet size and cleared connection must win instead.
    await seedUIState(page, { hasCompletedOnboarding: true, imageBackgroundWidth: 1536 }, "if-missing");
    await page.addInitScript((key) => localStorage.setItem(key, "e2e-legacy-mari"), LEGACY_MARI_CONNECTION_KEY);
    await recordStorageWrites(page);
    await installUIStorePackage(page, oldPackageClient());
    await page.goto("/");
    await waitForPackageClient(page);
    // The write check in the test above sees an old client write the Engine's key itself.
    expect(
      (await engineStorageWrites(page))
        .filter((write) => write.caller.includes(packageClientPath(PACKAGE_ID)))
        .map((write) => write.key),
    ).toEqual([UI_PERSISTENCE.name]);
    // The package saved its copy when it loaded; the user's changes come after it.
    await page.evaluate(async (settings) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      const ui = useUIStore.getState();
      ui.setSidebarWidth(400);
      ui.setRoleplayReducedPaintEffects(settings.roleplayReducedPaintEffects);
      ui.selectImpersonatePromptTemplate({ id: settings.activeImpersonatePromptTemplateId, prompt: "Stay in voice." });
    }, LOCAL_SETTINGS);
    await expect
      .poll(async () => pick((await readStored(page))?.state ?? {}, Object.keys(LOCAL_SETTINGS)))
      .toEqual(LOCAL_SETTINGS);
    const saved = pick(await readPersisted(page), [...DROPPED_BY_V74_COPY, "sidebarWidth"]);
    expect(pick(saved, ["imageCharacterSheetWidth", "mariConnectionId", "sidebarWidth"])).toEqual({
      imageCharacterSheetWidth: 1280,
      mariConnectionId: null,
      sidebarWidth: 400,
    });

    for (let reload = 1; reload <= 2; reload += 1) {
      await page.reload();
      await waitForPackageClient(page);
      // The package's v74 copy, made before the user's changes, is what the first reload finds in the key.
      if (reload === 1) expect(await storedVersionsAtStart(page)).toEqual([UI_PERSISTENCE.version, 74]);
      expect(pick(await readPersisted(page), Object.keys(saved))).toEqual(saved);
    }
  });

  for (const legacy of [
    { release: "v2.4.4", version: 96, sheet: [1536, 1024] },
    { release: "v2.5.0", version: 101, sheet: [1280, 720] },
  ]) {
    test(`an upgrade from ${legacy.release} still migrates its saved settings`, async ({ page }) => {
      await prepare(page);
      await page.addInitScript(
        ({ name, version, mariKey }) => {
          if (sessionStorage.getItem("e2e:legacy-seeded")) return;
          sessionStorage.setItem("e2e:legacy-seeded", "true");
          localStorage.setItem(mariKey, "e2e-legacy-mari");
          localStorage.setItem(
            name,
            JSON.stringify({
              state: {
                hasCompletedOnboarding: true,
                chibiProfessorMariEnabled: false,
                chatWindowIntroDismissed: true,
                seasonalThemesDisabled: true,
                imageBackgroundWidth: 1536,
                imageBackgroundHeight: 1024,
              },
              version,
            }),
          );
        },
        { name: UI_PERSISTENCE.name, version: legacy.version, mariKey: LEGACY_MARI_CONNECTION_KEY },
      );
      await page.goto("/");
      expect(
        pick(await readPersisted(page), [
          "imageCharacterSheetWidth",
          "imageCharacterSheetHeight",
          "mariConnectionId",
          "roleplayReducedPaintEffects",
          "activeImpersonatePromptTemplateId",
        ]),
      ).toEqual({
        imageCharacterSheetWidth: legacy.sheet[0],
        imageCharacterSheetHeight: legacy.sheet[1],
        mariConnectionId: "e2e-legacy-mari",
        roleplayReducedPaintEffects: false,
        activeImpersonatePromptTemplateId: null,
      });
      await expect.poll(async () => (await readStored(page))?.version).toBe(UI_PERSISTENCE.version);
    });
  }

  test("preferences seeded at the current version win over the saved copy", async ({ page }) => {
    await prepare(page);
    await seedUIState(page, { hasCompletedOnboarding: true }, "if-missing");
    await page.goto("/");
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().setRoleplayReducedPaintEffects(true);
    });
    await expect.poll(async () => (await readStored(page))?.state.roleplayReducedPaintEffects).toBe(true);
    await seedUIState(page, { hasCompletedOnboarding: true, roleplayReducedPaintEffects: false });
    await page.reload();
    expect((await readPersisted(page)).roleplayReducedPaintEffects).toBe(false);
  });
});
