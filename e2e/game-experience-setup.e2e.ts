import { chooseConnection } from "./connection-picker.js";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  compileGameWorld,
  parseWorldKit,
  worldSpatialDraft,
  type MultiplayerPlayer,
} from "@marinara-engine/shared";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

// An Experience with an inline setup block: a seed, a generated config and a custom widget
// requirement the wizard has to apply for as long as the Experience is switched on.
const experienceFixture = {
  id: "setup-fixture",
  version: "1.0.0",
  status: "active",
  readiness: "ready",
  manifest: {
    schemaVersion: 2,
    id: "setup-fixture",
    name: "Setup fixture",
    version: "1.0.0",
    capabilityApi: { major: 1, minor: 18 },
    kind: ["agent"],
    entrypoints: { client: "client.mjs" },
    contributions: {
      slots: ["game-surface"],
      gameSurface: {
        setup: {
          seed: { key: "worldSeed" },
          config: { generate: true },
          requires: { enableCustomWidgets: false },
        },
      },
    },
    permissions: ["ui"],
  },
};

const wizardConnections = [
  { id: "wizard-connection", name: "Wizard connection", provider: "custom", model: "fixture", isDefault: true },
];

/** The package client entry every fixture package serves: one custom element per package id. */
const capabilityClientScript = (ids: string[]) => `for (const id of ${JSON.stringify(ids)}) {
        const tag = 'marinara-capability-' + id;
        if (!customElements.get(tag)) customElements.define(tag, class extends HTMLElement {
          connectedCallback() { this.textContent = 'Legacy package setup fixture'; }
        });
      }`;

type WizardMountOptions = {
  isNewGame: boolean;
  chatMetadata?: Record<string, unknown>;
  characters?: Array<{ id: string; name: string }>;
  multiplayerPlayers?: MultiplayerPlayer[];
};

/** Mount the wizard on its own so a case can drive it without a surrounding chat. */
async function mountWizard(page: Page, testInfo: TestInfo, options: WizardMountOptions): Promise<Locator> {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    theme: testInfo.project.name === "desktop-chromium" ? "light" : "dark",
  });
  await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What shall we cook tonight?", exact: true })).toBeVisible({
    timeout: 40_000,
  });
  await prepareViteFixtureDependencies(page);
  await page.evaluate(
    async ({ isNewGame, chatMetadata, characters, multiplayerPlayers }) => {
      const { GameSetupWizard } = await import("/src/components/game/GameSetupWizard.tsx" as string);
      const dependencyUrl = window.__viteFixtureDependencyUrl;
      const { default: React } = await import(dependencyUrl("react"));
      const { default: ReactDOM } = await import(dependencyUrl("react-dom_client"));
      const { QueryClient, QueryClientProvider } = await import(dependencyUrl("@tanstack_react-query"));
      const container = document.createElement("div");
      document.body.append(container);
      const result = document.createElement("output");
      result.dataset.testid = "wizard-result";
      container.append(result);
      ReactDOM.createRoot(container).render(
        React.createElement(
          QueryClientProvider,
          { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          React.createElement(GameSetupWizard, {
            activeChatId: "wizard-chat",
            isNewGame,
            chatMetadata,
            onSetupError: () => false,
            onCancel: () => {},
            isLoading: false,
            isDraftingMap: false,
            isLinkingSharedWorld: false,
            characters,
            multiplayerPlayers,
            onComplete: (
              config: unknown,
              _preferences: unknown,
              _connections: unknown,
              _name: unknown,
              mapPlan: unknown,
            ) => {
              const output =
                document.querySelector('[data-testid="wizard-result"]') ??
                document.body.appendChild(document.createElement("output"));
              output.setAttribute("data-testid", "wizard-result");
              output.textContent = JSON.stringify({ config, mapPlan });
            },
          }),
        ),
      );
    },
    {
      isNewGame: options.isNewGame,
      chatMetadata: options.chatMetadata ?? {},
      characters: options.characters ?? [],
      multiplayerPlayers: options.multiplayerPlayers,
    },
  );
  const wizard = page.locator('[data-component="GameSetupWizard"]');
  await expect(wizard).toBeVisible();
  return wizard;
}

/** Step buttons that wait for the step to actually change before the case moves on. */
function stepNavigation(wizard: Locator) {
  const navigate = async (direction: "Next" | "Back") => {
    const heading = wizard.getByRole("heading", { level: 4 }).first();
    const previous = await heading.innerText();
    await wizard.getByRole("button", { name: direction, exact: true }).click();
    await expect(heading).not.toHaveText(previous);
    await expect(heading).toBeVisible();
  };
  return { next: () => navigate("Next"), back: () => navigate("Back") };
}

for (const hosted of [false, true]) {
  test(`Multiplayer Game setup reviews without generation ${hosted ? "after inviting players" : "before hosting"}`, async ({
    page,
  }, info) => {
    await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [experienceFixture] }));
    await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
    await page.route("**/api/connections", (route) => route.fulfill({ json: wizardConnections }));
    await page.route("**/api/lorebooks", (route) => route.fulfill({ json: [] }));
    const generated: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && /\/api\/(?:generate|game\/start)/u.test(request.url())) {
        generated.push(request.url());
      }
    });
    const players: MultiplayerPlayer[] = hosted
      ? [
          {
            id: "host_player",
            displayName: "Host fixture",
            personaName: "Captain",
            isHost: true,
            connected: true,
            ready: true,
            joinsNextRound: false,
          },
          {
            id: "guest_player",
            displayName: "Guest fixture",
            personaName: "Scout",
            isHost: false,
            connected: true,
            ready: true,
            joinsNextRound: false,
          },
        ]
      : [];
    const wizard = await mountWizard(page, info, {
      isNewGame: true,
      multiplayerPlayers: players,
      characters: [{ id: "party-fixture", name: "AI companion fixture" }],
    });
    await expect(
      wizard.getByText(
        "Review the world setup, then invite and approve players before starting the adventure. Each player keeps control of their own persona.",
      ),
    ).toBeVisible();
    await expect(wizard.getByRole("switch", { name: "Setup fixture", exact: true })).toHaveCount(0);
    await chooseConnection(page, wizard.locator("[data-connection-value]").first(), "wizard-connection");
    const { next } = stepNavigation(wizard);
    await next();
    await next();
    await expect(wizard.getByText("AI companions (0 selected)", { exact: true })).toBeVisible();
    if (hosted) {
      await expect(wizard.getByText("Playing Captain", { exact: true })).toBeVisible();
      await expect(wizard.getByText("Playing Scout", { exact: true })).toBeVisible();
    }
    for (let step = 2; step < 6; step++) await next();
    if (hosted) await expect(wizard.getByText("Playing Scout", { exact: true })).toBeVisible();
    const review = wizard.getByRole("button", { name: "Review shared game", exact: true });
    await expect(review).toBeEnabled();
    await page.screenshot({ path: info.outputPath(`multiplayer-game-review-${hosted ? "hosted" : "prepared"}.png`) });
    await review.click();
    const result = JSON.parse((await page.getByTestId("wizard-result").textContent()) ?? "{}");
    expect(result.config).not.toHaveProperty("personaId");
    expect(result.config).not.toHaveProperty("gameExperienceId");
    expect(result.mapPlan).toBeUndefined();
    expect(generated).toEqual([]);
  });
}

test("Game Features switches keep equal thumb insets and do not shrink on mobile", async ({ page }, info) => {
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/agents", (route) =>
    route.fulfill({
      json: [
        {
          id: "world-state",
          name: "World State",
          description: "Fixture",
          phase: "post_processing",
          settings: {},
        },
      ],
    }),
  );
  await page.route("**/api/connections", (route) => route.fulfill({ json: wizardConnections }));
  await page.route("**/api/lorebooks", (route) => route.fulfill({ json: [] }));
  const wizard = await mountWizard(page, info, { isNewGame: true });
  const { next } = stepNavigation(wizard);
  for (let step = 0; step < 5; step++) await next();
  const names = [
    /^Quick Time Events/u,
    /^Enable Agents/u,
    /^Custom HUD Widgets/u,
    /^Build Widget Setup/u,
    /^Sound effects/u,
    /^Music Generate/u,
  ];
  for (const name of names) {
    const button = wizard.getByRole("button", { name });
    await button.scrollIntoViewIfNeeded();
    const track = button.locator(":scope > .rounded-full");
    const assertInsets = async () => {
      await expect
        .poll(() =>
          track.evaluate((element) => {
            const outer = element.getBoundingClientRect();
            const inner = element.firstElementChild!.getBoundingClientRect();
            const scale = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
            const px = (value: number) => Math.round((value / scale) * 1000) / 1000;
            return {
              width: px(outer.width),
              height: px(outer.height),
              top: px(inner.top - outer.top),
              bottom: px(outer.bottom - inner.bottom),
              edge: px(Math.min(inner.left - outer.left, outer.right - inner.right)),
            };
          }),
        )
        .toEqual({ width: 36, height: 20, top: 2, bottom: 2, edge: 2 });
    };
    await assertInsets();
    if (await button.isEnabled()) {
      const before = await button.getAttribute("aria-pressed");
      await button.press("Space");
      await expect(button).toHaveAttribute("aria-pressed", before === "true" ? "false" : "true");
      await assertInsets();
      await button.press("Space");
    } else {
      await expect(button).toHaveAttribute("aria-pressed", "false");
    }
  }
  await wizard.getByRole("button", { name: /^Quick Time Events/u }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("game-feature-switches.png"), animations: "disabled" });
});

/** A fresh new-game wizard with only the inline-setup Experience installed and switched on. */
async function openWizardWithExperience(page: Page, testInfo: TestInfo): Promise<Locator> {
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [experienceFixture] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/*/client?*", (route) =>
    route.fulfill({ contentType: "text/javascript", body: capabilityClientScript(["setup-fixture"]) }),
  );
  await page.route("**/api/connections", (route) => route.fulfill({ json: wizardConnections }));
  await page.route("**/api/lorebooks", (route) => route.fulfill({ json: [] }));
  const wizard = await mountWizard(page, testInfo, { isNewGame: true });
  await wizard.getByRole("button", { name: "Show", exact: true }).click();
  await wizard.getByRole("switch", { name: "Setup fixture", exact: true }).click();
  return wizard;
}

for (const isNewGame of [true, false]) {
  test(`Experience wizard preserves ordinary steps and import scope (${isNewGame ? "new" : "existing"} game)`, async ({
    page,
  }, testInfo) => {
    // Includes legacy setup, file import and two passes through all seven steps.
    if (isNewGame) test.setTimeout(120_000);
    const books = [
      { id: "free-book", name: "Unattached lore", enabled: true },
      { id: "excluded-book", name: "Excluded lore", enabled: true },
      { id: "disabled-book", name: "Disabled lore", enabled: false },
      { id: "keeper-book", name: "Keeper lore", enabled: true, sourceAgentId: "game-lorebook-keeper" },
    ];
    await page.route("**/api/capability-packages/installed", (route) =>
      route.fulfill({
        json: [
          experienceFixture,
          {
            ...experienceFixture,
            id: "legacy-fixture",
            manifest: {
              ...experienceFixture.manifest,
              id: "legacy-fixture",
              name: "Legacy fixture",
              contributions: { slots: ["game-surface"] },
            },
          },
        ],
      }),
    );
    await page.route("**/api/capability-packages/agents", (route) =>
      route.fulfill({
        json: [
          {
            id: "hierarchical-maps",
            name: "World Maps",
            description: "Fixture",
            phase: "post_generation",
            category: "tracker",
          },
        ],
      }),
    );
    await page.route("**/api/capability-packages/*/client?*", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: capabilityClientScript(["setup-fixture", "legacy-fixture"]),
      }),
    );
    await page.route("**/api/connections", (route) => route.fulfill({ json: wizardConnections }));
    await page.route("**/api/lorebooks", (route) => route.fulfill({ json: books }));
    await page.route("**/api/lorebooks/keeper-book/entries", (route) => route.fulfill({ json: [] }));
    let failEntryFetch = true;
    await page.route("**/api/lorebooks/free-book/entries", (route) =>
      failEntryFetch
        ? route.fulfill({ status: 503, json: { error: "Temporary entry loading failure" } })
        : route.fulfill({
            json: [
              {
                id: "keyword-entry",
                lorebookId: "free-book",
                name: "Keyword entry",
                enabled: true,
                constant: false,
                order: 0,
              },
              {
                id: "constant-entry",
                lorebookId: "free-book",
                name: "Constant entry",
                enabled: true,
                constant: true,
                order: 1,
              },
              { id: "disabled-entry", lorebookId: "free-book", name: "Disabled entry", enabled: false, order: 2 },
              {
                id: "chat-disabled-entry",
                lorebookId: "free-book",
                name: "Chat disabled entry",
                enabled: true,
                order: 3,
              },
            ],
          }),
    );
    const wizard = await mountWizard(page, testInfo, {
      isNewGame,
      chatMetadata: {
        excludedLorebookIds: ["excluded-book"],
        entryStateOverrides: { "chat-disabled-entry": { enabled: false } },
      },
      characters: [{ id: "party-fixture", name: "Companion fixture" }],
    });
    const { next, back } = stepNavigation(wizard);
    if (isNewGame) {
      await page.screenshot({ path: testInfo.outputPath("setup-before-experience.png") });
      await expect(wizard.getByRole("button", { name: "Import setup", exact: true })).toBeEnabled();
      await wizard
        .locator('input[type="file"]')
        .first()
        .setInputFiles({
          name: "legacy.marinara-game-setup.json",
          mimeType: "application/json",
          buffer: Buffer.from(
            JSON.stringify({
              format: "marinara-game-setup",
              version: 1,
              gameName: "Imported legacy adventure",
              setup: {
                config: {
                  genre: "Fantasy",
                  setting: "Legacy Harbor",
                  tone: "Hopeful",
                  difficulty: "Normal",
                  rating: "sfw",
                  gmMode: "standalone",
                  partyCharacterIds: [],
                  playerGoals: "Find the missing keeper",
                  gameExperienceId: "legacy-fixture",
                  experienceConfig: { stalePackageState: "discard me" },
                },
              },
            }),
          ),
        });
      const legacy = page.getByRole("dialog", { name: "Legacy fixture", exact: true });
      await expect(legacy).toBeVisible();
      await expect(legacy.getByText("Legacy package setup fixture", { exact: true })).toBeVisible();
      await expect(legacy).toHaveCSS("opacity", "1");
      await page.screenshot({ path: testInfo.outputPath("setup-imported-legacy-experience.png") });
      await expect(legacy.getByRole("button", { name: "Close setup", exact: true })).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(legacy.getByRole("button", { name: "Back", exact: true })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(legacy.getByRole("button", { name: "Close setup", exact: true })).toBeFocused();
      await legacy.getByRole("button", { name: "Back", exact: true }).click();
      await expect(wizard).toBeFocused();
      await expect(wizard.getByText(/The saved Experience is unavailable/u)).toHaveCount(0);
      await wizard.getByRole("button", { name: "Show", exact: true }).click();
      await wizard.getByRole("switch", { name: "Setup fixture", exact: true }).click();
      const seedInvalid = "Enter a whole number from 0 to 4294967295 before starting.";
      await wizard.getByRole("spinbutton", { name: "World seed" }).fill("");
      await expect(wizard.getByRole("alert")).toHaveText(seedInvalid);
      // The seed is an unsigned whole number, so a fraction is refused instead of being rounded silently.
      await wizard.getByRole("spinbutton", { name: "World seed" }).fill("1.5");
      await expect(wizard.getByRole("alert")).toHaveText(seedInvalid);
      await wizard.getByRole("button", { name: "Randomize", exact: true }).click();
      await expect(wizard.getByRole("alert")).toHaveCount(0);
      await expect(wizard.getByRole("spinbutton", { name: "World seed" })).not.toHaveValue("");
      await wizard.getByRole("spinbutton", { name: "World seed" }).fill("4242");
      await page.screenshot({ path: testInfo.outputPath("setup-inline-experience.png") });
    } else {
      await expect(wizard.getByText("Experiences", { exact: true })).toHaveCount(0);
    }
    // Import carries only the numeric seed and keeps all the built-in steps.
    await wizard
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: "fixture.marinara-game-setup.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            format: "marinara-game-setup",
            version: 1,
            gameName: "Imported adventure",
            gmConnectionId: "wizard-connection",
            setup: {
              config: {
                genre: "Fantasy",
                setting: "Copper Harbor",
                tone: "Hopeful",
                difficulty: "Normal",
                rating: "sfw",
                gmMode: "standalone",
                partyCharacterIds: ["party-fixture"],
                playerGoals: "Find the missing keeper",
                enableAgents: true,
                gameExperienceId: "setup-fixture",
                experienceConfig: { worldSeed: 7, stalePackageState: "discard me", generate: false },
                activeLorebookEntryIds: ["keyword-entry", "missing-entry"],
              },
            },
          }),
        ),
      });
    // The picked entries have not loaded yet, so none of them may be reported as missing.
    await expect(wizard.getByText(/available here and w/u)).toHaveCount(0);
    if (isNewGame) {
      await expect(wizard.getByRole("spinbutton", { name: "World seed" })).toHaveValue("7");
      await wizard.getByRole("switch", { name: "Setup fixture", exact: true }).click();
      await expect(wizard.getByRole("switch", { name: "Setup fixture", exact: true })).toBeVisible();
      await wizard.getByRole("switch", { name: "Setup fixture", exact: true }).click();
    } else
      await expect(
        wizard.getByText("The Experience and seed were skipped. They can only be selected for a new game."),
      ).toBeVisible();
    await next();
    await expect(wizard.getByRole("heading", { name: "World", exact: true })).toBeVisible();
    await next();
    await expect(wizard.getByRole("heading", { name: "Party", exact: true })).toBeVisible();
    await expect(wizard.getByText("Companion fixture", { exact: true }).first()).toBeVisible();
    await next();
    await expect(wizard.getByRole("heading", { name: "Goals", exact: true })).toBeVisible();
    await next();
    await wizard.getByRole("button", { name: "Select individual entries", exact: true }).click();
    await expect(wizard.locator("summary").filter({ hasText: "Keeper lore" })).toHaveCount(0);
    await expect(wizard.getByRole("alert")).toContainText("Could not load the entries.");
    await next();
    await next();
    await expect(wizard.getByRole("button", { name: /Start/u })).toBeDisabled();
    await back();
    await expect(wizard.getByRole("heading", { name: "Features", exact: true })).toBeVisible();
    await back();
    await expect(wizard.getByRole("heading", { name: "Lorebooks", exact: true })).toBeVisible();
    failEntryFetch = false;
    await wizard.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(wizard.getByRole("alert")).toHaveCount(0);
    await wizard.locator("summary").filter({ hasText: "Unattached lore" }).click();
    await expect(wizard.getByRole("checkbox")).toHaveCount(2);
    await expect(wizard.getByRole("checkbox").first()).toHaveAccessibleName("Constant entry");
    await expect(wizard.getByRole("checkbox", { name: "Keyword entry", exact: true })).toBeChecked();
    await page.screenshot({ path: testInfo.outputPath("setup-lore-entry-picker.png") });
    await next();
    await expect(wizard.getByRole("heading", { name: "Features", exact: true })).toBeVisible();
    const widgetToggle = wizard.getByRole("button", { name: /^Custom HUD Widgets/u });
    if (isNewGame) {
      // The declared requirement is applied and the control is locked while the Experience is on.
      await expect(wizard.getByText("Setup fixture turns custom HUD widgets off for this game.")).toBeVisible();
      await expect(widgetToggle).toBeDisabled();
      await expect(widgetToggle).toHaveAttribute("aria-pressed", "false");
      await widgetToggle.click({ force: true });
      await expect(widgetToggle).toHaveAttribute("aria-pressed", "false");
      await expect(wizard.getByText("Hierarchical world map", { exact: true })).toHaveCount(0);
    } else {
      await expect(wizard.getByText("Hierarchical world map", { exact: true })).toBeVisible();
    }
    await next();
    await expect(wizard.getByRole("heading", { name: "GM", exact: true })).toBeVisible();
    await wizard.getByRole("button", { name: /Start/u }).click();
    const result = JSON.parse((await page.getByTestId("wizard-result").textContent()) ?? "{}");
    expect(result.config.partyCharacterIds).toEqual(["party-fixture"]);
    expect(result.config.playerGoals).toBe("Find the missing keeper");
    expect(result.config.activeLorebookEntryIds).toEqual(["keyword-entry"]);
    expect(result.config.activeLorebookIds).toBeUndefined();
    expect(result.mapPlan).toBeUndefined();
    if (isNewGame) {
      expect(result.config.gameExperienceId).toBe("setup-fixture");
      expect(result.config.experienceConfig).toEqual({ worldSeed: 7, generate: true });
      // Starting cannot serialize an invalid seed.
      for (let step = 0; step < 6; step++) await back();
      // The entries have loaded by now, so the one imported pick that does not exist here is reported.
      await expect(
        wizard.getByText("1 selected lorebook entry from this file is not available here and was skipped."),
      ).toBeVisible();
      await wizard.getByRole("spinbutton", { name: "World seed" }).fill("");
      for (let step = 0; step < 6; step++) await next();
      await expect(wizard.getByRole("button", { name: /Start/u })).toBeDisabled();
    } else {
      expect(result.config).not.toHaveProperty("gameExperienceId");
      expect(result.config).not.toHaveProperty("experienceConfig");
    }
  });
}

test("Experience without inline setup keeps its own setup dialog", async ({ page }, testInfo) => {
  // The pre-seam compatibility path: a game-surface package that declares no setup block still owns
  // its whole setup form, so the wizard steps step aside for it and come back when the player goes back.
  const legacy = {
    id: "legacy-only-fixture",
    version: "1.0.0",
    status: "active",
    readiness: "ready",
    manifest: {
      schemaVersion: 2,
      id: "legacy-only-fixture",
      name: "Legacy only fixture",
      version: "1.0.0",
      capabilityApi: { major: 1, minor: 18 },
      kind: ["agent"],
      entrypoints: { client: "client.mjs" },
      contributions: { slots: ["game-surface"] },
      permissions: ["ui"],
    },
  };
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [legacy] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/*/client?*", (route) =>
    route.fulfill({ contentType: "text/javascript", body: capabilityClientScript(["legacy-only-fixture"]) }),
  );
  await page.route("**/api/connections", (route) => route.fulfill({ json: wizardConnections }));
  await page.route("**/api/lorebooks", (route) => route.fulfill({ json: [] }));
  const wizard = await mountWizard(page, testInfo, { isNewGame: true });
  await expect(wizard.getByRole("button", { name: "Next", exact: true })).toBeVisible();
  await wizard.getByRole("button", { name: "Show", exact: true }).click();
  await wizard.getByRole("switch", { name: "Legacy only fixture", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Legacy only fixture", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Legacy package setup fixture", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close setup", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Back", exact: true })).toBeVisible();
  // The package owns the whole form here, so none of the wizard's own steps stay on screen behind it.
  await expect(wizard).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("setup-legacy-only-dialog.png") });
  await dialog.getByRole("button", { name: "Back", exact: true }).click();
  await expect(wizard).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await expect(wizard.getByRole("button", { name: "Next", exact: true })).toBeVisible();
  // The list comes back collapsed with the package turned off again, ready to be chosen a second time.
  await wizard.getByRole("button", { name: "Show", exact: true }).click();
  await expect(wizard.getByRole("switch", { name: "Legacy only fixture", exact: true })).toHaveAttribute(
    "aria-checked",
    "false",
  );
});

test("locked widget requirement is restored when the Experience is turned off", async ({ page }, testInfo) => {
  // Three walks between the first step and Features, so this case needs the larger scenario budget.
  test.setTimeout(120_000);
  const wizard = await openWizardWithExperience(page, testInfo);
  const { next, back } = stepNavigation(wizard);
  const widgetToggle = wizard.getByRole("button", { name: /^Custom HUD Widgets/u });
  // The declared requirement is applied and the control is locked while the Experience is on.
  for (let step = 0; step < 5; step++) await next();
  await expect(wizard.getByRole("heading", { name: "Features", exact: true })).toBeVisible();
  await expect(wizard.getByText("Setup fixture turns custom HUD widgets off for this game.")).toBeVisible();
  await expect(widgetToggle).toBeDisabled();
  await expect(widgetToggle).toHaveAttribute("aria-pressed", "false");
  // Turning the Experience off unlocks the control at the player's own earlier choice.
  for (let step = 0; step < 5; step++) await back();
  await wizard.getByRole("switch", { name: "Setup fixture", exact: true }).click();
  for (let step = 0; step < 5; step++) await next();
  await expect(wizard.getByRole("heading", { name: "Features", exact: true })).toBeVisible();
  await expect(widgetToggle).toBeEnabled();
  await expect(widgetToggle).toHaveAttribute("aria-pressed", "true");
  await expect(wizard.getByText(/turns custom HUD widgets/u)).toHaveCount(0);
});

test("an ordinary setup import keeps the prefilled seed", async ({ page }, testInfo) => {
  const wizard = await openWizardWithExperience(page, testInfo);
  const seedField = wizard.getByRole("spinbutton", { name: "World seed" });
  await seedField.fill("4242");
  // An ordinary setup file carries no Experience, so it must leave the prefilled seed alone.
  await wizard
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "ordinary.marinara-game-setup.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "marinara-game-setup",
          version: 1,
          gameName: "Imported ordinary adventure",
          setup: {
            config: {
              genre: "Fantasy",
              setting: "Copper Harbor",
              tone: "Hopeful",
              difficulty: "Normal",
              rating: "sfw",
              gmMode: "standalone",
              partyCharacterIds: [],
              playerGoals: "Find the missing keeper",
            },
          },
        }),
      ),
    });
  // The import handler is async, so wait for it to land before switching the Experience back on.
  await expect(wizard.getByRole("switch", { name: "Setup fixture", exact: true })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await wizard.getByRole("switch", { name: "Setup fixture", exact: true }).click();
  await expect(seedField).toHaveValue("4242");
  await expect(wizard.getByRole("alert")).toHaveCount(0);
});

test("Tactical setup keeps size and retires battlefield seed and terrain guidance", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/connections", (route) => route.fulfill({ json: wizardConnections }));
  await page.route("**/api/lorebooks", (route) => route.fulfill({ json: [] }));
  const wizard = await mountWizard(page, testInfo, { isNewGame: true });
  await wizard
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "tactical.marinara-game-setup.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "marinara-game-setup",
          version: 1,
          gameName: "River crossing",
          gmConnectionId: "wizard-connection",
          setup: {
            config: {
              genre: "Fantasy",
              setting: "River crossing",
              tone: "Hopeful",
              difficulty: "normal",
              rating: "sfw",
              gmMode: "standalone",
              partyCharacterIds: [],
              playerGoals: "Reach the far shore",
              combatStyle: "tactical",
              tacticalBattlefield: { seed: 0, size: "large", instructions: "Ruins beside a forest clearing." },
            },
          },
        }),
      ),
    });
  await expect(wizard.getByPlaceholder("Name your adventure...", { exact: true })).toHaveValue("River crossing");
  const { next } = stepNavigation(wizard);
  await next();
  await expect(wizard.getByLabel("Battlefield seed", { exact: true })).toHaveCount(0);
  const size = wizard.getByLabel("Battlefield size", { exact: true });
  await expect(size).toHaveValue("large");
  await expect(wizard.getByLabel("Terrain guidance", { exact: true })).toHaveCount(0);
  await expect(wizard.getByText(/Fire Emblem|current style/)).toHaveCount(0);
  await wizard.getByRole("button", { name: /^Classic/ }).click();
  await expect(size).toHaveCount(0);
  await expect(wizard.getByText("Cinematic menu battles", { exact: true })).toBeVisible();
  await wizard.getByRole("button", { name: /^Tactical/ }).click();
  await expect(size).toHaveValue("large");
  await size.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("hybrid-terrain-setup.png") });
  for (let step = 0; step < 5; step++) await next();
  await expect(wizard.getByRole("button", { name: "Download setup", exact: true })).toBeEnabled();
  await wizard.getByRole("button", { name: /Start/u }).click();
  const result = JSON.parse((await page.getByTestId("wizard-result").textContent()) ?? "{}");
  expect(result.config.combatStyle).toBe("tactical");
  expect(result.config.difficulty).toBe("normal");
  expect(result.config.tacticalBattlefield).toEqual({
    size: "large",
  });
});

test("A setting kit is off by default, can be picked, written for the setting, edited and carried", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/connections", (route) => route.fulfill({ json: wizardConnections }));
  await page.route("**/api/lorebooks", (route) => route.fulfill({ json: [] }));
  const modern = WORLD_STARTER_KITS.find((kit) => kit.id === "modern_day")!;
  const written = { ...structuredClone(modern), id: "harbor_life", label: "Harbor town life" };
  const writes: Array<Record<string, any>> = [];
  let refuse = true;
  let gate: Promise<void> | null = null;
  await page.route("**/api/game/world-kit", async (route) => {
    writes.push(route.request().postDataJSON());
    if (gate) await gate;
    if (refuse) {
      await route.fulfill({
        status: 422,
        json: {
          error: "The model could not write a setting kit that holds together.",
          issues: ["layers: Exactly one layer holds the settlements"],
        },
      });
    } else {
      await route.fulfill({ json: { kit: written } });
    }
  });

  const wizard = await mountWizard(page, testInfo, { isNewGame: true });
  await chooseConnection(page, wizard.locator("[data-connection-value]").first(), "wizard-connection");
  const { next, back } = stepNavigation(wizard);
  await next();
  // A new game is on the Overworld RPG, whose world needs a kit: the genre's own until another is picked,
  // and no kit-less card.
  await expect(wizard.getByRole("button", { name: /^No setting kit/u })).toHaveCount(0);
  await expect(wizard.getByRole("button", { name: /^High fantasy/u })).toHaveAttribute("aria-pressed", "true");

  await wizard.getByRole("button", { name: /^Modern day/u }).click();
  await expect(wizard.getByRole("button", { name: /^Modern day/u })).toHaveAttribute("aria-pressed", "true");
  // The words are folded away until asked for, so the World step stays short.
  await expect(wizard.getByLabel("Name", { exact: true })).toBeHidden();
  await wizard.getByText("Change its words", { exact: true }).click();
  await expect(wizard.getByLabel("Name", { exact: true })).toHaveValue("Modern day");
  // The slice-of-life kit is gentle: no crime, conflict or catastrophe.
  for (const kind of ["Crime", "Conflict", "Catastrophe"]) {
    await expect(wizard.getByRole("checkbox", { name: kind, exact: true })).not.toBeChecked();
  }
  await expect(wizard.getByRole("checkbox", { name: "Rivalry", exact: true })).toBeChecked();

  // Picking the kit already picked keeps the words already changed.
  await wizard.getByLabel("Name", { exact: true }).fill("My modern day");
  await wizard.getByRole("button", { name: /^Modern day/u }).click();
  await expect(wizard.getByLabel("Name", { exact: true })).toHaveValue("My modern day");
  await wizard.getByLabel("Name", { exact: true }).fill("Modern day");

  // A refusal says why, and keeps the kit as it was.
  await wizard.getByRole("button", { name: "Write it for my setting", exact: true }).click();
  await expect(wizard.getByRole("alert")).toContainText(
    "The model could not write a setting kit that holds together. layers: Exactly one layer holds the settlements",
  );
  await expect(wizard.getByLabel("Name", { exact: true })).toHaveValue("Modern day");
  refuse = false;

  // A write that comes back late never replaces a kit picked while it was out.
  let open!: () => void;
  gate = new Promise<void>((resolve) => (open = resolve));
  await wizard.getByRole("button", { name: "Write it for my setting", exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  // A long write says it is still going: the seconds count up, and it can take minutes.
  await expect(wizard.getByRole("button", { name: /^Writing… [1-9]\d* s$/u })).toBeVisible({ timeout: 5_000 });
  await expect(wizard.getByText("A model can take a few minutes to write this.", { exact: false })).toBeVisible();
  await wizard.getByRole("button", { name: /^Cyberpunk A megacity/u }).click();
  open();
  gate = null;
  await expect(wizard.getByRole("button", { name: "Write it for my setting", exact: true })).toBeEnabled();
  await expect(wizard.getByLabel("Name", { exact: true })).toHaveValue("Cyberpunk");
  await wizard.getByRole("button", { name: /^Modern day/u }).click();
  await expect(wizard.getByLabel("Name", { exact: true })).toHaveValue("Modern day");

  await wizard.getByRole("button", { name: "Write it for my setting", exact: true }).click();
  await expect(wizard.getByLabel("Name", { exact: true })).toHaveValue("Harbor town life");
  await expect(wizard.getByRole("alert")).toHaveCount(0);
  expect(writes).toHaveLength(3);
  // The modern day kit brought its own genre, since none was chosen (worldgen W6g).
  expect(writes[2]).toMatchObject({ connectionId: "wizard-connection", genre: "Modern", tone: "Heroic" });
  expect(writes[2]!.start.id).toBe("modern_day");

  // Every word can be changed; a list is typed as one line, and a trailing comma survives typing.
  const sizes = wizard.getByLabel("Settlement sizes, smallest first", { exact: true });
  await sizes.fill("hamlet, port town,");
  await expect(sizes).toHaveValue("hamlet, port town,");
  await sizes.pressSequentially(" city");
  await wizard.getByRole("checkbox", { name: "Crime", exact: true }).check();
  await wizard.getByLabel("What Crime looks like here", { exact: true }).fill("smuggling on the docks");
  // What a won fight drops, in the kit's own words (worldgen W6a).
  await wizard.getByLabel("Common", { exact: true }).fill("Fishing net, Tide table,");
  // Its money and what it sells (worldgen W6b).
  await wizard.getByLabel("Coin", { exact: true }).nth(1).fill("buck");
  await wizard.getByLabel("Price of Coffee, in the smallest coin", { exact: true }).fill("350");
  // Its elements (worldgen W6c): modern day has none, and one can be added.
  await expect(wizard.getByText("This setting has no elemental attacks.", { exact: true })).toBeVisible();
  // Back to the classic six as words to change: a renamed element is renamed where the kit names it.
  await wizard.getByRole("button", { name: "Back to the classic six", exact: true }).click();
  await wizard.getByRole("button", { name: "Change them", exact: true }).click();
  await wizard.getByLabel("Element", { exact: true }).first().fill("Flame");
  await wizard.getByRole("button", { name: "Add an element", exact: true }).click();
  await wizard.getByLabel("Element", { exact: true }).last().fill("Tide");
  // Its battlefields (worldgen W6d): a scene renamed and a tile word of its own.
  await wizard.getByLabel("Scene", { exact: true }).first().fill("Harbor road");
  await wizard.getByLabel("Open tiles", { exact: true }).fill("Quay");
  // Its art and music (worldgen W6f): the modern day's own family, changed to the jazz age's.
  await expect(wizard.getByLabel("Art and music", { exact: true })).toHaveValue("modern");
  await wizard.getByLabel("Art and music", { exact: true }).selectOption({ label: "Jazz age" });
  // Retyping the places keeps the settlements on the layer of that name.
  const settlements = wizard.getByLabel("Which of them holds the settlements", { exact: true });
  await expect(settlements.locator("option:checked")).toHaveText("city");
  await wizard.getByLabel("Places, outermost first", { exact: true }).fill("country, city, quarter");
  await expect(settlements.locator("option:checked")).toHaveText("city");
  await settlements.selectOption({ label: "quarter" });

  await page.screenshot({ path: testInfo.outputPath("setting-kit-editor.png"), fullPage: true });

  // A kit that does not hold together blocks the start until it is fixed.
  await wizard.getByLabel("Name", { exact: true }).fill("");
  await expect(wizard.getByText("This kit cannot be used yet:", { exact: true })).toBeVisible();
  for (let step = 0; step < 5; step++) await next();
  await expect(wizard.getByRole("button", { name: /Start/u })).toBeDisabled();
  await expect(wizard.getByRole("button", { name: "Download setup", exact: true })).toBeDisabled();
  await expect(
    wizard.getByText("Fix the setting kit on the World step before starting.", { exact: true }),
  ).toBeVisible();
  for (let step = 0; step < 5; step++) await back();
  if (!(await wizard.getByLabel("Name", { exact: true }).isVisible())) {
    await wizard.getByText("Change its words", { exact: true }).click();
  }
  await wizard.getByLabel("Name", { exact: true }).fill("Harbor town life");
  await expect(wizard.getByText("This kit cannot be used yet:", { exact: true })).toHaveCount(0);

  for (let step = 0; step < 5; step++) await next();
  await expect(wizard.getByRole("button", { name: "Download setup", exact: true })).toBeEnabled();
  await wizard.getByRole("button", { name: /Start/u }).click();
  const result = JSON.parse((await page.getByTestId("wizard-result").textContent()) ?? "{}");
  expect(result.config.worldKit.label).toBe("Harbor town life");
  // A word renamed in place keeps the id of the word it replaced, so a world that refers to it still
  // finds it; a word kept keeps its own.
  expect(result.config.worldKit.sizes).toEqual([
    { id: "village", label: "hamlet" },
    { id: "small_town", label: "port town" },
    { id: "city", label: "city" },
  ]);
  expect(result.config.worldKit.change.kinds.crime).toEqual({ label: "smuggling on the docks", on: true });
  expect(result.config.worldKit.change.kinds.conflict.on).toBe(false);
  expect(result.config.worldKit.loot.common).toEqual(["Fishing net", "Tide table"]);
  expect(result.config.worldKit.scenes[0]).toEqual({ label: "Harbor road", like: "city" });
  expect(result.config.worldKit.tiles.plains).toBe("Quay");
  expect(result.config.worldKit.family).toBe("jazz_age");
  const elements = result.config.worldKit.elements as Array<{ label: string; beats?: string[] }>;
  expect(elements.map((element) => element.label)).toEqual([
    "Flame",
    "Ice",
    "Lightning",
    "Poison",
    "Holy",
    "Shadow",
    "Tide",
  ]);
  expect(elements.find((element) => element.label === "Lightning")!.beats).toEqual(["Flame"]);
  expect(
    (result.config.worldKit.reactions as Array<{ on: string; with: string; label: string }>).find(
      (reaction) => reaction.label === "Melt",
    ),
  ).toMatchObject({ on: "Flame", with: "Ice" });
  expect(result.config.worldKit.money.units.map((unit: { label: string }) => unit.label)).toEqual(["cent", "buck"]);
  expect(result.config.worldKit.shop.find((thing: { name: string }) => thing.name === "Coffee").price).toBe(350);
  // The ladder lost a size; what the shop sold from the biggest keeps its rank (the market reads it as
  // the largest size left), so the kit still holds together.
  expect(result.config.worldKit.shop.find((thing: { name: string }) => thing.name === "Concert Tickets").from).toBe(3);
  expect(result.config.worldKit.layers).toEqual([
    { id: "country", label: "country" },
    { id: "city", label: "city" },
    { id: "quarter", label: "quarter", settlements: true },
  ]);
});

test("The wizard suggests settings from across settings, and a picked kit brings its own and its genre", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/connections", (route) => route.fulfill({ json: wizardConnections }));
  await page.route("**/api/lorebooks", (route) => route.fulfill({ json: [] }));
  // Which starter setting each suggested setting comes from (worldgen W6g).
  const english = JSON.parse(
    readFileSync(new URL("../packages/client/src/localization/locales/en.json", import.meta.url), "utf8"),
  ) as Record<string, string>;
  const settingOf = new Map(
    Object.entries(english)
      .filter(([key]) => /^game\.setup\.suggestions\.[a-z0-9_]+\.setting\d$/.test(key))
      .map(([key, text]) => [text, key.split(".")[3]!]),
  );
  const wizard = await mountWizard(page, testInfo, { isNewGame: true });
  const suggested = async () =>
    (await wizard.getByRole("button").allInnerTexts()).map((text) => text.trim()).filter((text) => settingOf.has(text));
  await chooseConnection(page, wizard.locator("[data-connection-value]").first(), "wizard-connection");
  // A Classic game has no kit, so its ideas come from across the settings.
  const styles = wizard.getByTestId("game-style-chooser");
  await styles.getByRole("radio", { name: /Classic/ }).click();
  const { next, back } = stepNavigation(wizard);
  await next();

  // Without a kit: three ideas from three different settings, beside "Surprise me!".
  const first = await suggested();
  expect(first).toHaveLength(3);
  expect(new Set(first.map((text) => settingOf.get(text))).size).toBe(3);
  await expect(wizard.getByRole("button", { name: "Surprise me!", exact: true }).first()).toBeVisible();
  await expect(wizard.getByRole("button", { name: "Fantasy", exact: true })).toHaveAttribute("aria-pressed", "true");
  await back();
  await styles.getByRole("radio", { name: /Overworld RPG/ }).click();
  await next();

  // A picked cyberpunk kit brings its own two ideas first, and its genre while none was chosen.
  await wizard.getByRole("button", { name: /A megacity of districts and stacked blocks/u }).click();
  const cyberpunk = await suggested();
  expect(cyberpunk.slice(0, 2)).toEqual([
    english["game.setup.suggestions.cyberpunk.setting1"],
    english["game.setup.suggestions.cyberpunk.setting2"],
  ]);
  expect(settingOf.get(cyberpunk[2]!)).not.toBe("cyberpunk");
  await expect(wizard.getByRole("button", { name: "Cyberpunk", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(wizard.getByRole("button", { name: "Fantasy", exact: true })).toHaveAttribute("aria-pressed", "false");
  await wizard
    .getByRole("button", { name: english["game.setup.suggestions.cyberpunk.setting2"]!, exact: true })
    .click();
  await expect(wizard.getByPlaceholder(english["ui.game.gamesetupwizard.describeYourWorld"]!)).toHaveValue(
    english["game.setup.suggestions.cyberpunk.setting2"]!,
  );

  // Once the player chooses a genre, a kit never changes it.
  await wizard.getByRole("button", { name: "Horror", exact: true }).click();
  await wizard.getByRole("button", { name: /A sector of star systems joined by jump lanes/u }).click();
  await expect(wizard.getByRole("button", { name: "Horror", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(wizard.getByRole("button", { name: "Cyberpunk", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(wizard.getByRole("button", { name: "Sci-Fi", exact: true })).toHaveAttribute("aria-pressed", "false");
});

test("A shared setup brings its setting kit to a new game and refuses one that does not hold together", async ({
  page,
}, testInfo) => {
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/connections", (route) => route.fulfill({ json: wizardConnections }));
  await page.route("**/api/lorebooks", (route) => route.fulfill({ json: [] }));
  const wuxia = WORLD_STARTER_KITS.find((kit) => kit.id === "wuxia_xianxia")!;
  const shared = (worldKit: unknown, gameName: string) => ({
    name: "kit.marinara-game-setup.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "marinara-game-setup",
        version: 1,
        gameName,
        gmConnectionId: "wizard-connection",
        setup: {
          config: {
            genre: "Wuxia",
            setting: "The jianghu",
            tone: "Heroic",
            difficulty: "normal",
            rating: "sfw",
            gmMode: "standalone",
            partyCharacterIds: [],
            playerGoals: "",
            worldKit,
          },
        },
      }),
    ),
  });
  const wizard = await mountWizard(page, testInfo, { isNewGame: true });
  const file = wizard.locator('input[type="file"]').first();
  const gameName = wizard.getByPlaceholder("Name your adventure...", { exact: true });
  await file.setInputFiles(shared(wuxia, "Rivers and lakes"));
  await expect(gameName).toHaveValue("Rivers and lakes");
  // A kit that does not hold together refuses the whole file (with a toast this standalone mount
  // does not draw), so nothing of it lands over what the first file set.
  const noSettlements = { ...wuxia, layers: wuxia.layers.map(({ settlements: _, ...layer }) => layer) };
  await file.setInputFiles(shared(noSettlements, "Broken kit"));
  await page.waitForTimeout(500);
  await expect(gameName).toHaveValue("Rivers and lakes");
  const { next } = stepNavigation(wizard);
  await next();
  await expect(wizard.getByRole("button", { name: /^Wuxia and xianxia/u })).toHaveAttribute("aria-pressed", "true");
  for (let step = 0; step < 5; step++) await next();
  await wizard.getByRole("button", { name: /Start/u }).click();
  const result = JSON.parse((await page.getByTestId("wizard-result").textContent()) ?? "{}");
  expect(result.config.worldKit.id).toBe("wuxia_xianxia");
});

test("An existing game never offers a setting kit", async ({ page }, testInfo) => {
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/connections", (route) => route.fulfill({ json: wizardConnections }));
  await page.route("**/api/lorebooks", (route) => route.fulfill({ json: [] }));
  const wizard = await mountWizard(page, testInfo, { isNewGame: false });
  const { next } = stepNavigation(wizard);
  await next();
  await expect(wizard.getByRole("heading", { name: "World", exact: true })).toBeVisible();
  await expect(wizard.getByText("Setting kit", { exact: true })).toHaveCount(0);
});

test("A world is made from a seed in the kit's words: the lore's places kept, the brief written, previewed and carried", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/connections", (route) => route.fulfill({ json: wizardConnections }));
  await page.route("**/api/lorebooks", (route) =>
    route.fulfill({ json: [{ id: "lb-aldmark", name: "Aldmark lore" }] }),
  );
  const canon = [{ name: "Thornmere", layer: "settlement", size: "city", tags: ["port"], lore: ["entry-a"] }];
  const canonEvents = [
    {
      yearsAgo: 30,
      kind: "catastrophe",
      text: "The great flood.",
      places: ["Thornmere"],
      groups: ["The River Guild"],
      lore: ["entry-a"],
    },
  ];
  const brief = {
    briefVersion: 1,
    premise: "The old king is dying.",
    places: [
      ...canon,
      { name: "Aldmark", layer: "realm", tags: [] },
      { name: "Hollin", layer: "settlement", parent: "Aldmark", size: "village", tags: [], start: true },
    ],
    placeNames: [{ culture: "heartland", names: ["Ashby", "Wending", "Calder"] }],
    groups: [
      { name: "The River Guild", kind: "guild", seat: "Thornmere", note: "Wants the tolls." },
      { name: "House Vane", kind: "noble_house", rivals: ["The River Guild"] },
    ],
    peopleNames: [{ culture: "heartland", given: ["Ama", "Tobin"], family: ["Holt"] }],
  };
  const asked = { canon: [] as Array<Record<string, any>>, brief: [] as Array<Record<string, any>> };
  await page.route("**/api/game/world-canon", async (route) => {
    asked.canon.push(route.request().postDataJSON());
    await route.fulfill({ json: { places: canon, events: canonEvents, repairs: [], entriesRead: 3, entriesLeft: 0 } });
  });
  let gate: Promise<void> | null = null;
  await page.route("**/api/game/world-brief", async (route) => {
    asked.brief.push(route.request().postDataJSON());
    if (gate) await gate;
    await route.fulfill({ json: { brief, repairs: [] } });
  });

  const wizard = await mountWizard(page, testInfo, { isNewGame: true });
  await chooseConnection(page, wizard.locator("[data-connection-value]").first(), "wizard-connection");
  const { next, back } = stepNavigation(wizard);
  await next();
  // The Overworld RPG always has a world: one is rolled for the kit, with no switch to leave it out.
  await wizard.getByRole("button", { name: /^High fantasy/u }).click();
  await expect(wizard.getByRole("checkbox", { name: /^Make a world/u })).toHaveCount(0);
  await expect(wizard.getByText("Your world", { exact: true })).toBeVisible();
  const seed = wizard.getByLabel("World seed", { exact: true });
  await expect(seed).toHaveValue(/^\d+$/u);
  await seed.fill("12345");
  // A world of the kit alone is previewed at once.
  await expect(wizard.getByTestId("world-preview")).toContainText("The party starts in ");

  await wizard.getByRole("checkbox", { name: "Aldmark lore", exact: true }).check();
  await wizard.getByRole("button", { name: "Read the lore's places", exact: true }).click();
  await expect(wizard.getByText("From the lore: Thornmere.", { exact: true })).toBeVisible();
  await expect(wizard.getByText("Dated events from the lore, kept as they are: 1.", { exact: true })).toBeVisible();
  // Before any brief, the world is the kit and the lore's places.
  await wizard.getByText(/^Settlements \(\d+\)$/u).click();
  await expect(wizard.getByTestId("world-preview")).toContainText("Thornmere (city)");
  expect(asked.canon[0]).toMatchObject({ connectionId: "wizard-connection", lorebookIds: ["lb-aldmark"] });
  expect(asked.canon[0]!.kit.id).toBe("high_fantasy");

  // A brief that comes back after the world was changed lands on nothing: the world stays as changed.
  let open!: () => void;
  gate = new Promise<void>((resolve) => (open = resolve));
  await wizard.getByRole("button", { name: "Write the world's brief", exact: true }).click();
  await expect.poll(() => asked.brief.length).toBe(1);
  await wizard.getByLabel("World seed", { exact: true }).fill("999");
  const answered = page.waitForResponse("**/api/game/world-brief");
  open();
  gate = null;
  await answered;
  await expect(wizard.getByText("The brief is written.", { exact: true })).toHaveCount(0);
  await expect(wizard.getByLabel("World seed", { exact: true })).toHaveValue("999");
  await wizard.getByLabel("World seed", { exact: true }).fill("12345");

  await wizard.getByRole("button", { name: "Write the world's brief", exact: true }).click();
  await expect(wizard.getByText("The brief is written.", { exact: true })).toBeVisible();
  // Reading the lore again after the brief keeps the brief in step with it.
  await wizard.getByRole("button", { name: "Read the lore's places", exact: true }).click();
  await expect(wizard.getByText("Places found: 1, in 3 entries.", { exact: true })).toBeVisible();
  expect(asked.brief.at(-1)).toMatchObject({ canon, canonEvents, grounding: "expand", genre: "Fantasy" });
  await expect(wizard.getByTestId("world-preview")).toContainText("The party starts in Hollin.");
  await wizard.getByText("Change the brief", { exact: true }).click();
  await wizard.getByLabel("Now (the premise)", { exact: true }).fill("The old king is dead.");
  // The groups and each people's names are the brief's words too.
  await expect(wizard.getByLabel("Given names (heartland folk)", { exact: true })).toHaveValue("Ama, Tobin");
  await wizard.getByLabel("Family names (heartland folk)", { exact: true }).fill("Holt, Marrow");
  await wizard.getByLabel("What The River Guild wants", { exact: true }).fill("Wants the bridge.");
  // Renaming a group carries the name to the groups that call it a rival.
  await wizard.getByLabel("Name (guild)", { exact: true }).fill("The River Company");
  await expect(wizard.getByText("Left out or changed to fit the kit:", { exact: true })).toHaveCount(0);
  await wizard.getByLabel("Name (guild)", { exact: true }).fill("The River Guild");
  // Renaming the kit's settlements word keeps the brief's places; taking out a tag says what left.
  await wizard.getByText("Change its words", { exact: true }).click();
  await wizard.getByLabel("Places, outermost first", { exact: true }).fill("realm, province, burgh, quarter");
  await expect(wizard.getByTestId("world-preview")).toContainText("The party starts in Hollin.");
  const tags = wizard.getByLabel("What a place may be known for", { exact: true });
  const tagWords = await tags.inputValue();
  await tags.fill(tagWords.replace(/^port, /u, ""));
  await expect(wizard.getByText("Thornmere: a tag the kit does not have was left out")).toBeVisible();
  await tags.fill(tagWords);
  await expect(wizard.getByText("Left out or changed to fit the kit:", { exact: true })).toHaveCount(0);
  // Renaming a place carries the name to the places inside it.
  await wizard.getByLabel("Name (realm)", { exact: true }).fill("Aldmarch");
  await expect(wizard.getByTestId("world-preview")).toContainText("The party starts in Hollin.");
  await expect(wizard.getByText("Left out or changed to fit the kit:", { exact: true })).toHaveCount(0);
  // And to the groups seated in it.
  const thornmereName = wizard.getByLabel("Name (burgh)", { exact: true }).first();
  await thornmereName.fill("Thornmere Port");
  await expect(wizard.getByText("Left out or changed to fit the kit:", { exact: true })).toHaveCount(0);
  await wizard.getByLabel("Name (burgh)", { exact: true }).first().fill("Thornmere");
  await page.screenshot({ path: testInfo.outputPath("world-panel.png"), fullPage: true });

  // A seed that is not one blocks the start, the download and the preview until it is fixed.
  await seed.fill("12abc");
  await expect(wizard.getByText("A seed is a whole number from 0 to 4294967295.", { exact: true })).toBeVisible();
  await expect(wizard.getByTestId("world-preview")).toHaveCount(0);
  for (let step = 0; step < 5; step++) await next();
  await expect(wizard.getByRole("button", { name: /Start/u })).toBeDisabled();
  await expect(wizard.getByRole("button", { name: "Download setup", exact: true })).toBeDisabled();
  await expect(wizard.getByText("Fix the world on the World step before starting.", { exact: true })).toBeVisible();
  for (let step = 0; step < 5; step++) await back();
  await wizard.getByLabel("World seed", { exact: true }).fill("12345");
  for (let step = 0; step < 5; step++) await next();
  await wizard.getByRole("button", { name: /Start/u }).click();
  const result = JSON.parse((await page.getByTestId("wizard-result").textContent()) ?? "{}");
  expect(result.config.world).toMatchObject({
    seed: 12345,
    generatorVersion: WORLD_GENERATOR_VERSION,
    grounding: "expand",
  });
  expect(result.config.world.brief.premise).toBe("The old king is dead.");
  expect(result.config.world.brief.events).toEqual(canonEvents);
  expect(result.config.world.brief.groups[0]).toMatchObject({ name: "The River Guild", note: "Wants the bridge." });
  expect(result.config.world.brief.peopleNames[0]).toMatchObject({
    given: ["Ama", "Tobin"],
    family: ["Holt", "Marrow"],
  });
  expect(result.config.world.brief.places[0]).toEqual({ ...canon[0], tags: ["port"] });
});

test("A game that makes a world can lay it out as its World Maps map, exactly the world's places and ways", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/agents", (route) =>
    route.fulfill({
      json: [
        {
          id: "hierarchical-maps",
          name: "World Maps",
          description: "Fixture",
          phase: "post_generation",
          category: "tracker",
        },
      ],
    }),
  );
  await page.route("**/api/connections", (route) => route.fulfill({ json: wizardConnections }));
  await page.route("**/api/lorebooks", (route) => route.fulfill({ json: [] }));
  const wizard = await mountWizard(page, testInfo, { isNewGame: true });
  await chooseConnection(page, wizard.locator("[data-connection-value]").first(), "wizard-connection");
  const { next } = stepNavigation(wizard);
  await next();
  await wizard.getByRole("button", { name: /^High fantasy/u }).click();
  await wizard.getByLabel("World seed", { exact: true }).fill("12345");
  await expect(wizard.getByTestId("world-preview")).toContainText("The party starts in ");
  for (let step = 0; step < 4; step++) await next();
  await wizard.getByRole("button", { name: /Enable Agents/u }).click();
  const fromTheWorld = wizard.getByRole("button", { name: /^From the world/u });
  await fromTheWorld.click();
  await expect(fromTheWorld).toHaveAttribute("aria-pressed", "true");
  await next();
  await wizard.getByRole("button", { name: /Start/u }).click();

  const result = JSON.parse((await page.getByTestId("wizard-result").textContent()) ?? "{}");
  expect(result.config.gameWorldMapMode).toBe("hierarchical");
  expect(result.mapPlan.mode).toBe("world");
  // The map is exactly the one the shared atlas makes of the game's world.
  const kit = parseWorldKit(result.config.worldKit);
  if (!kit.ok) throw new Error(kit.issues.join("; "));
  const inputs = { kit: kit.kit, ...result.config.world };
  expect(result.mapPlan.draft).toEqual(worldSpatialDraft({ ...inputs, world: compileGameWorld(inputs) }));
  expect(result.mapPlan.draft.definition.startingLocationId).toBeTruthy();
});

test("A shared setup brings its world to a new game", async ({ page }, testInfo) => {
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/connections", (route) => route.fulfill({ json: wizardConnections }));
  await page.route("**/api/lorebooks", (route) => route.fulfill({ json: [] }));
  const wuxia = WORLD_STARTER_KITS.find((kit) => kit.id === "wuxia_xianxia")!;
  const shared = (world: unknown, gameName: string) => ({
    name: "world.marinara-game-setup.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "marinara-game-setup",
        version: 1,
        gameName,
        gmConnectionId: "wizard-connection",
        setup: {
          config: {
            genre: "Wuxia",
            setting: "The jianghu",
            tone: "Heroic",
            difficulty: "normal",
            rating: "sfw",
            gmMode: "standalone",
            partyCharacterIds: [],
            playerGoals: "",
            worldKit: wuxia,
            world,
          },
        },
      }),
    ),
  });
  const world = { seed: 7, generatorVersion: 1, brief: { briefVersion: 1, premise: "Rivers and lakes stir." } };
  const wizard = await mountWizard(page, testInfo, { isNewGame: true });
  const file = wizard.locator('input[type="file"]').first();
  const gameName = wizard.getByPlaceholder("Name your adventure...", { exact: true });
  await file.setInputFiles(shared(world, "Rivers and lakes"));
  await expect(gameName).toHaveValue("Rivers and lakes");
  // A world that is not one refuses the whole file.
  await file.setInputFiles(shared({ ...world, seed: -1 }, "Broken world"));
  await page.waitForTimeout(500);
  await expect(gameName).toHaveValue("Rivers and lakes");
  const { next } = stepNavigation(wizard);
  await next();
  await expect(wizard.getByText("Your world", { exact: true })).toBeVisible();
  await expect(wizard.getByLabel("World seed", { exact: true })).toHaveValue("7");
  for (let step = 0; step < 5; step++) await next();
  await wizard.getByRole("button", { name: /Start/u }).click();
  const result = JSON.parse((await page.getByTestId("wizard-result").textContent()) ?? "{}");
  expect(result.config.world).toMatchObject({ seed: 7, brief: { premise: "Rivers and lakes stir." } });
});
