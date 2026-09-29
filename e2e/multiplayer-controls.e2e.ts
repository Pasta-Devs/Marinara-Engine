import { expect, test, type Page, type TestInfo } from "@playwright/test";
import type { MultiplayerHostState } from "@marinara-engine/shared";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies";
import { seedUIState } from "./ui-state-fixture";

// Use the real controls and app theme with a deterministic local API. No peer,
// provider, native device, or existing Engine data is needed for these UI proofs.
async function mountControls(
  page: Page,
  info: TestInfo,
  surface:
    "settings" | "players" | "host" | "guest" | "lobby" | "game-setup" | "participant-host" | "participant-guest",
) {
  const theme = info.project.name === "desktop-chromium" ? "light" : "dark";
  await seedUIState(page, { hasCompletedOnboarding: true, theme });
  await page.route("**/multiplayer-controls-fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {};
        window.$RefreshSig$ = () => type => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        import '/src/styles/globals.css';
      </script></head><body><main id="fixture"></main></body></html>`,
    }),
  );
  await page.goto("/multiplayer-controls-fixture");
  await prepareViteFixtureDependencies(page);
  await page.evaluate(
    async ({ surface, theme }) => {
      const url = window.__viteFixtureDependencyUrl;
      const { default: React } = await import(url("react"));
      Object.assign(window, { __multiplayerFixtureReact: React });
      const { default: ReactDOM } = await import(url("react-dom_client"));
      const { QueryClient, QueryClientProvider } = await import(url("@tanstack_react-query"));
      const entry = await (await fetch("/src/main.tsx")).text();
      const localizationUrl = entry.match(/"([^"\n]*\/localization\/i18n\.ts[^"\n]*)"/)?.[1];
      if (!localizationUrl) throw new Error("Missing localization entry");
      const { initializeLocalization, i18n } = await import(localizationUrl);
      await initializeLocalization("en");
      if (!i18n.exists("multiplayer.title")) throw new Error("Multiplayer catalog did not load");
      document.documentElement.dataset.theme = theme;
      const root = document.getElementById("fixture")!;
      root.style.cssText = "max-width:580px;margin:0 auto;padding:16px;color:var(--foreground)";
      document.body.style.background = "var(--background)";
      let controls;
      if (surface === "settings") {
        controls = React.createElement(
          (await import("/src/features/multiplayer/MultiplayerSettings.tsx" as string)).MultiplayerSettings,
        );
      } else if (surface === "players") {
        controls = React.createElement(
          (await import("/src/features/multiplayer/MultiplayerHostControls.tsx" as string)).MultiplayerPlayersSection,
          {
            chatId: "shared_chat_123",
            forceOpen: true,
            gameStart: {
              type: "startGame",
              config: {
                genre: "mystery",
                partyCharacterIds: ["stale_party_123"],
                gmMode: "character",
                gmCharacterId: "stale_gm_123",
              },
              preferences: "A shared adventure",
            },
          },
        );
      } else if (surface === "game-setup") {
        controls = React.createElement(
          (await import("/src/features/multiplayer/PreparedMultiplayerGameSetup.tsx" as string))
            .PreparedMultiplayerGameSetup,
          {
            chat: { id: "shared_chat_123", mode: "game", metadata: {} },
            players: [],
            onPrepared: () => {},
            onCancel: () => {},
          },
        );
      } else if (surface === "participant-host" || surface === "participant-guest") {
        const { snapshot } = await (await fetch("/api/multiplayer/host")).json();
        const { MultiplayerParticipantControls } = await import(
          "/src/features/multiplayer/MultiplayerParticipantControls.tsx" as string
        );
        controls = React.createElement(MultiplayerParticipantControls, {
          snapshot,
          host: surface === "participant-host",
          onAction: async (action: unknown) => {
            await fetch("/api/multiplayer/guest/action", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(action),
            });
            return true;
          },
        });
      } else {
        const chat =
          surface === "lobby"
            ? await (await fetch("/api/chats/shared_chat_123")).json()
            : {
                id: "stopped_room_chat",
                name: "Stopped session",
                mode: "roleplay",
                metadata: { multiplayer: { role: surface, roomId: "stopped_room", status: "disconnected" } },
              };
        const componentUrl = "/src/features/multiplayer/MultiplayerChat.tsx";
        const { MultiplayerChat } = await import(componentUrl);
        const componentSource = await (await fetch(componentUrl)).text();
        const storeUrl = componentSource.match(/"([^"\n]*\/stores\/chat\.store\.ts[^"\n]*)"/)?.[1];
        if (!storeUrl) throw new Error("Missing chat store entry");
        const { useChatStore } = await import(storeUrl);
        useChatStore.setState({ activeChatId: chat.id });
        root.dataset.activeChat = chat.id;
        useChatStore.subscribe((state: { activeChatId: string | null }) => {
          root.dataset.activeChat = state.activeChatId ?? "none";
        });
        controls = React.createElement(MultiplayerChat, { chat });
      }
      ReactDOM.createRoot(root).render(
        React.createElement(
          QueryClientProvider,
          { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          controls,
        ),
      );
    },
    { surface, theme },
  );
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("multiplayer requires separate consent and reviews only selected persona text before joining", async ({
  page,
}, info) => {
  let enabled = false;
  const writes: Array<{ path: string; body: unknown }> = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== "GET") writes.push({ path, body: request.postDataJSON() });
    if (path === "/api/multiplayer/status")
      return route.fulfill({ json: { available: true, enabled, hosting: false, joined: false, tlsAvailable: true } });
    if (path === "/api/multiplayer/settings") {
      enabled = request.postDataJSON().enabled;
      return route.fulfill({ json: { enabled } });
    }
    if (path === "/api/multiplayer/preview")
      return route.fulfill({
        json: {
          name: "Moonlit Harbor <img src=x>",
          mode: "roleplay",
          fingerprint: "a".repeat(64),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      });
    if (path === "/api/characters/personas/list")
      return route.fulfill({
        json: [
          {
            id: "persona_123",
            name: "Mira",
            description: "An astronomer.",
            privateNotes: "PRIVATE",
            avatarPath: "/secret.png",
          },
        ],
      });
    if (path === "/api/multiplayer/join")
      return route.fulfill({
        json: { localChatId: "guest_chat_123", state: { phase: "awaiting-approval", snapshot: null, error: null } },
      });
    return route.fulfill({ json: path === "/api/app-settings/ui" ? { value: "" } : [] });
  });
  await mountControls(page, info, "settings");
  const enable = page.getByRole("switch", { name: "Enable multiplayer", exact: true });
  await expect(enable).toBeDisabled();
  await expect(page.getByRole("button", { name: "Join session", exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "I understand the risks and want to enable optional multiplayer." }).check();
  await enable.click();
  await expect(page.getByRole("switch", { name: "Disable multiplayer and disconnect" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(writes[0]).toEqual({ path: "/api/multiplayer/settings", body: { enabled: true, consent: true } });
  const create = page.getByRole("button", { name: "Create shared session", exact: true });
  await create.focus();
  await page.keyboard.press("Enter");
  const modePicker = page.getByRole("dialog", { name: "Create shared session", exact: true });
  await expect(modePicker).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modePicker).toHaveCount(0);
  await expect(create).toBeFocused();
  await page.getByText("Only connect with people you trust.", { exact: false }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("multiplayer-settings-warning.png") });
  await page.getByRole("button", { name: "Join session", exact: true }).click();
  await page.getByLabel("Invite code", { exact: true }).fill("fixture-code");
  await page.getByRole("button", { name: "Review invitation" }).click();
  await expect(page.getByText("Moonlit Harbor <img src=x>", { exact: false })).toBeVisible();
  await expect(page.locator("#fixture img")).toHaveCount(0);
  await page.getByLabel("Room password (at least 12 characters)").fill("separate-password");
  await page.getByLabel("Your display name").fill("Mari");
  await page.getByLabel("Choose your persona").selectOption("persona_123");
  await expect(page.getByLabel("Description to share")).toHaveValue("An astronomer.");
  const join = page.getByRole("button", { name: "Request to join" });
  await expect(join).toBeDisabled();
  await page
    .getByLabel("I verified the host and agree to share only the display name and persona text shown above.")
    .check();
  await noHorizontalOverflow(page);
  await page.screenshot({ path: info.outputPath("multiplayer-settings-join.png") });
  await join.click();
  await expect
    .poll(() => writes.find((item) => item.path === "/api/multiplayer/join"))
    .toEqual({
      path: "/api/multiplayer/join",
      body: {
        inviteCode: "fixture-code",
        password: "separate-password",
        displayName: "Mari",
        persona: { name: "Mira", description: "An astronomer." },
        consent: true,
      },
    });
});

test("multiplayer stays inaccessible without the environment gate and native guests stay disabled", async ({
  page,
}, info) => {
  let available = false;
  await page.route("**/api/**", (route) =>
    route.fulfill({
      json:
        new URL(route.request().url()).pathname === "/api/multiplayer/status"
          ? { available, enabled: true, hosting: false, joined: false, tlsAvailable: true }
          : [],
    }),
  );
  await mountControls(page, info, "settings");
  await expect(page.getByText("Multiplayer is unavailable.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Join session", exact: true })).toHaveCount(0);
  available = true;
  await page.addInitScript(() => Object.assign(window, { MarinaraAndroidNative: {} }));
  await mountControls(page, info, "settings");
  await expect(page.getByRole("button", { name: "Join session", exact: true })).toBeDisabled();
  await expect(page.getByText("Joining is unavailable in the native Android app", { exact: false })).toBeVisible();
});

test("Players reuses chat settings for invitations, approval, AI proposals and game readiness", async ({
  page,
}, info) => {
  const actions: Array<Record<string, unknown>> = [];
  const host: MultiplayerHostState = {
    chatId: "shared_chat_123",
    snapshot: {
      version: 1,
      roomId: "room_123456",
      revision: 1,
      selfId: "host_123456",
      nextSequence: 0,
      name: "Moonlit Harbor",
      mode: "game",
      status: "lobby",
      generation: "idle",
      usage: { generations: 0, maxGenerations: 100, automaticReplies: true },
      players: [
        {
          id: "host_123456",
          displayName: "Mari",
          personaName: "Mira",
          isHost: true,
          connected: true,
          ready: false,
          joinsNextRound: false,
        },
        {
          id: "guest_123456",
          displayName: "Ari",
          personaName: null,
          isHost: false,
          connected: true,
          ready: false,
          joinsNextRound: false,
        },
      ],
      characters: [{ id: "gm_12345678", name: "Professor", role: "gm" }],
      messages: [],
      round: null,
    },
    pendingRequests: [
      { id: "request_123", displayName: "Rose", persona: { name: "Lily", description: "A curious traveler." } },
    ],
    proposals: [
      {
        id: "proposal_123",
        participantId: "guest_123456",
        displayName: "Ari",
        character: { name: "Guide", description: "Knows the harbor.", role: "character" },
      },
    ],
    invite: { code: "fixture-invitation-code", expiresAt: new Date(Date.now() + 600_000).toISOString() },
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/multiplayer/host/actions") {
      const action = route.request().postDataJSON();
      actions.push(action);
      if (action.type === "approve") {
        host.pendingRequests = [];
        host.snapshot.players[1]!.personaName = "Rowan";
      }
      if (action.type === "proposal-approve") {
        host.proposals = [];
        host.snapshot.characters.push({ id: "approved_ai_123", name: "Guide", role: "character" });
      }
      if (action.type === "remove-character")
        host.snapshot.characters = host.snapshot.characters.filter((character) => character.id !== action.characterId);
      return route.fulfill({ json: {} });
    }
    return route.fulfill({ json: path === "/api/multiplayer/host" ? host : [] });
  });
  await mountControls(page, info, "players");
  await expect(page.getByRole("button", { name: "Start game", exact: true })).toBeDisabled();
  await expect(page.getByText("Rose · Lily", { exact: true })).toBeVisible();
  await noHorizontalOverflow(page);
  await page.screenshot({ path: info.outputPath("multiplayer-players-top.png") });
  const stop = page.getByRole("button", { name: "Stop hosting", exact: true });
  await stop.scrollIntoViewIfNeeded();
  await expect(stop).toBeInViewport();
  await expect(page.getByLabel("Maximum AI generations this session")).toBeInViewport();
  expect((await stop.boundingBox())!.height).toBeGreaterThanOrEqual(40);
  await page.screenshot({ path: info.outputPath("multiplayer-players-bottom.png") });
  await page.getByLabel("Maximum AI generations this session").fill("25");
  await page.getByLabel("Automatic AI replies").uncheck();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start game", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Maximum AI generations this session")).toHaveValue("25");
  await expect(page.getByLabel("Automatic AI replies")).not.toBeChecked();
  host.snapshot.usage = { ...host.snapshot.usage, automaticReplies: true, maxGenerations: 50 };
  await expect(page.getByLabel("Maximum AI generations this session")).toHaveValue("50");
  await expect(page.getByLabel("Automatic AI replies")).toBeChecked();
  await page.getByRole("button", { name: "Approve and save to host library", exact: true }).click();
  await page.getByLabel("Maximum AI generations this session").fill("25");
  await page.getByLabel("Automatic AI replies").uncheck();
  await page.getByRole("button", { name: "Save response controls", exact: true }).click();
  await expect
    .poll(() => actions)
    .toEqual([
      { type: "approve", requestId: "request_123" },
      { type: "proposal-approve", proposalId: "proposal_123" },
      { type: "configure", automaticReplies: false, maxGenerations: 25 },
    ]);
  await page.getByRole("button", { name: "Revoke invitation", exact: true }).click();
  await expect.poll(() => actions.at(-1)).toEqual({ type: "revoke-invite" });
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await expect
    .poll(() => actions.at(-1))
    .toEqual({
      type: "startGame",
      preferences: "A shared adventure",
      config: {
        genre: "mystery",
        partyCharacterIds: ["approved_ai_123"],
        gmMode: "character",
        gmCharacterId: "gm_12345678",
      },
    });
  await page.getByRole("button", { name: "Remove AI character", exact: true }).first().click();
  await expect.poll(() => actions.at(-1)).toEqual({ type: "remove-character", characterId: "gm_12345678" });
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await expect
    .poll(() => actions.at(-1))
    .toEqual({
      type: "startGame",
      preferences: "A shared adventure",
      config: { genre: "mystery", partyCharacterIds: ["approved_ai_123"], gmMode: "standalone", gmCharacterId: null },
    });
});

test("shared Game setup waits for characters before mounting the wizard", async ({ page }, info) => {
  let releaseCharacters!: () => void;
  const charactersReady = new Promise<void>((resolve) => {
    releaseCharacters = resolve;
  });
  await page.route("**/api/characters", async (route) => {
    await charactersReady;
    return route.fulfill({ json: [{ id: "guide_123", name: "Guide" }] });
  });
  await page.route("**/GameSetupWizard.tsx*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `export function GameSetupWizard({characters,isLoading}) {
      return window.__multiplayerFixtureReact.createElement('div', {'data-testid':'loaded-game-wizard','data-loading':String(isLoading)}, characters.map(character=>character.name).join(', '));
    }`,
    }),
  );
  await mountControls(page, info, "game-setup");
  await expect(page.getByRole("status")).toBeVisible();
  await expect(page.getByTestId("loaded-game-wizard")).toHaveCount(0);
  releaseCharacters();
  await expect(page.getByTestId("loaded-game-wizard")).toHaveText("Guide");
  await expect(page.getByTestId("loaded-game-wizard")).toHaveAttribute("data-loading", "false");
  await noHorizontalOverflow(page);
});

test("editing a hosted Game setup synchronizes the reviewed roster before saving and starting", async ({
  page,
}, info) => {
  const writes: Array<Record<string, unknown>> = [];
  const setup = {
    config: {
      genre: "mystery",
      partyCharacterIds: ["guest_card_123", "new_party_123"],
      gmMode: "character",
      gmCharacterId: "old_party_123",
    },
    preferences: "The revised adventure",
  };
  const chat = {
    id: "shared_chat_123",
    name: "Moonlit Harbor",
    mode: "game",
    metadata: {
      multiplayer: { role: "host", roomId: "room_123456", status: "lobby" },
      multiplayerSetupComplete: true,
      gameSetupConfig: {
        partyCharacterIds: ["guest_card_123", "old_party_123"],
        gmMode: "character",
        gmCharacterId: "old_gm_123",
      },
      multiplayerGameSetup: { preferences: "Original adventure" },
    },
  };
  const host: MultiplayerHostState = {
    chatId: chat.id,
    snapshot: {
      version: 1,
      roomId: "room_123456",
      revision: 1,
      selfId: "host_123456",
      nextSequence: 0,
      name: chat.name,
      mode: "game",
      status: "lobby",
      generation: "idle",
      usage: { generations: 0, maxGenerations: 100, automaticReplies: true },
      players: [
        {
          id: "host_123456",
          displayName: "Mari",
          personaName: "Mira",
          isHost: true,
          connected: true,
          ready: false,
          joinsNextRound: false,
        },
      ],
      characters: [
        { id: "old_gm_123", name: "Professor", role: "gm" },
        { id: "old_party_123", name: "Guide", role: "character" },
        { id: "guest_card_123", name: "Approved guest character", role: "character" },
      ],
      messages: [],
      round: null,
    },
    pendingRequests: [],
    proposals: [],
    invite: null,
  };
  // The real wizard has its own browser proof. Here its explicit completion
  // callback isolates the hosted controller's roster/save ordering.
  await page.route("**/PreparedMultiplayerGameSetup.tsx*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `export function PreparedMultiplayerGameSetup({onPrepared,busy}) {
      return window.__multiplayerFixtureReact.createElement('button', {disabled:busy, onClick:()=>onPrepared(${JSON.stringify(setup)})}, 'Confirm reviewed setup');
    }`,
    }),
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/multiplayer/status")
      return route.fulfill({
        json: { available: true, enabled: true, hosting: true, joined: false, tlsAvailable: true },
      });
    if (path === "/api/multiplayer/host") return route.fulfill({ json: host });
    if (path === `/api/chats/${chat.id}`) return route.fulfill({ json: chat });
    if (path === "/api/multiplayer/host/actions") {
      const action = request.postDataJSON();
      writes.push(action);
      if (action.type === "remove-character")
        host.snapshot.characters = host.snapshot.characters.filter((character) => character.id !== action.characterId);
      if (action.type === "add-character")
        host.snapshot.characters.push({ id: action.characterId, name: action.characterId, role: action.role });
      return route.fulfill({ json: {} });
    }
    if (path === `/api/chats/${chat.id}/metadata`) {
      const metadata = request.postDataJSON();
      writes.push({ type: "save-metadata", ...metadata });
      Object.assign(chat.metadata, metadata);
      return route.fulfill({ json: chat });
    }
    return route.fulfill({ json: [] });
  });
  await mountControls(page, info, "lobby");
  await page.getByRole("button", { name: "Edit setup", exact: true }).click();
  await page.getByRole("button", { name: "Confirm reviewed setup", exact: true }).click();
  await expect
    .poll(() => writes)
    .toEqual([
      { type: "remove-character", characterId: "old_gm_123" },
      { type: "remove-character", characterId: "old_party_123" },
      { type: "add-character", characterId: "new_party_123", role: "character" },
      { type: "add-character", characterId: "old_party_123", role: "gm" },
      {
        type: "save-metadata",
        multiplayerSetupComplete: true,
        gameSetupConfig: setup.config,
        multiplayerGameSetup: { preferences: setup.preferences },
      },
    ]);
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await expect.poll(() => writes.at(-1)).toEqual({ type: "startGame", ...setup });
  await noHorizontalOverflow(page);
});

test("host adds an existing library ID while guests only propose reviewed text, even with forged host flags", async ({
  page,
}, info) => {
  const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  await page.route("**/api/**", (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST") {
      writes.push({ path, body: request.postDataJSON() });
      return route.fulfill({ json: {} });
    }
    if (path === "/api/multiplayer/host")
      return route.fulfill({
        json: {
          snapshot: {
            selfId: "self_123456",
            nextSequence: 0,
            generation: "idle",
            characters: [],
            players: [{ id: "self_123456", isHost: true }],
          },
        },
      });
    if (path === "/api/characters")
      return route.fulfill({
        json: [
          {
            id: "character_123",
            data: {
              name: "Guide",
              description: "Knows the harbor.",
              creator_notes: "PRIVATE",
              extensions: { script: "SECRET" },
            },
          },
        ],
      });
    return route.fulfill({ json: [] });
  });
  await mountControls(page, info, "participant-host");
  await page.getByLabel("Choose a character from your library").selectOption("character_123");
  await expect(page.getByLabel("Character name", { exact: true }).last()).not.toBeEditable();
  await page.getByRole("button", { name: "Add AI character", exact: true }).click();
  await expect
    .poll(() => writes)
    .toEqual([
      {
        path: "/api/multiplayer/host/actions",
        body: { type: "add-character", characterId: "character_123", role: "character" },
      },
    ]);
  await mountControls(page, info, "participant-guest");
  await expect(page.getByRole("button", { name: "Add AI character", exact: true })).toHaveCount(0);
  await page.getByLabel("Choose a character from your library").selectOption("character_123");
  await page.getByRole("button", { name: "Send proposal for approval", exact: true }).click();
  await expect.poll(() => writes.at(-1)?.path).toBe("/api/multiplayer/guest/action");
  expect(writes.at(-1)?.body).toMatchObject({
    type: "propose-character",
    sequence: 0,
    character: { name: "Guide", description: "Knows the harbor.", role: "character" },
  });
  expect(Object.keys(writes.at(-1)!.body.character as object).sort()).toEqual(["description", "name", "role"]);
});

test("stopped rooms remain escapable when multiplayer endpoints are disabled", async ({ page }, info) => {
  await page.route("**/api/**", (route) => {
    if (new URL(route.request().url()).pathname === "/api/multiplayer/status")
      return route.fulfill({
        json: { available: false, enabled: false, hosting: false, joined: false, tlsAvailable: false },
      });
    return route.fulfill({ status: 404, json: { error: "disabled" } });
  });
  await mountControls(page, info, "host");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.locator("#fixture")).toHaveAttribute("data-active-chat", "none");
  await mountControls(page, info, "guest");
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.locator("#fixture")).toHaveAttribute("data-active-chat", "none");
});
