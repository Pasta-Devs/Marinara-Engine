import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { closeChatSettings } from "./chat-settings-tools.js";
import { clickTopbarPanel } from "./topbar-navigation.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

test.beforeEach(async ({ page }) => {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    appAccentPulseMode: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
  });
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), APP_VERSION);
});

async function launch(page: Page, mode: "conversation" | "roleplay" | "game") {
  const created = page.waitForResponse(
    (response) => response.request().method() === "POST" && /\/api\/chats\/?$/.test(new URL(response.url()).pathname),
  );
  await page.locator(`[data-home-chat-mode="${mode}"]`).first().click();
  const response = await created;
  expect(response.ok(), await response.text()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  const wizard = page.locator(`[data-component="${mode === "game" ? "GameSetupWizard" : "ChatSetupWizard"}"]`);
  await expect(wizard).toBeVisible();
  return { chat, wizard };
}

async function seedConnection(page: Page) {
  const response = await page.request.post("/api/connections", {
    data: {
      name: "Cancel setup fixture",
      provider: "custom",
      baseUrl: "http://127.0.0.1:1/v1",
      apiKey: "fixture-only",
      model: "fixture",
      maxContext: 8192,
      isDefault: true,
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as { id: string };
}

test("Home cancel and Skip discard only the untouched new chat in every mode", async ({ page }) => {
  test.setTimeout(120_000);
  const connection = await seedConnection(page);
  const kept = await page.request.post("/api/chats", {
    data: { name: "Existing empty chat must survive", mode: "roleplay", characterIds: [] },
  });
  const existing = (await kept.json()) as { id: string };
  const gameResponse = await page.request.post("/api/chats", {
    data: { name: "Existing game setup must survive", mode: "game", characterIds: [] },
  });
  const existingGame = (await gameResponse.json()) as { id: string };
  try {
    await page.goto("/");
    for (const mode of ["conversation", "roleplay", "game"] as const) {
      const { chat, wizard } = await launch(page, mode);
      await wizard.getByRole("button", { name: "Close setup", exact: true }).click();
      await expect.poll(async () => (await page.request.get(`/api/chats/${chat.id}`)).status()).toBe(404);
      await expect(page.locator('[data-component="HomeBrowserHub.HomePage"]')).toBeVisible();
      await expect(page.locator('[data-window="chat-settings"]')).toHaveCount(0);
      expect((await page.request.get(`/api/chats/${existing.id}`)).ok()).toBeTruthy();
    }
    for (const mode of ["conversation", "roleplay"] as const) {
      const { chat, wizard } = await launch(page, mode);
      await wizard.getByRole("button", { name: "Next", exact: true }).click();
      await expect(
        wizard.getByRole("heading", { name: mode === "conversation" ? "Prompt Preset" : "Pick a Preset", exact: true }),
      ).toBeVisible();
      await wizard.getByRole("button", { name: "Next", exact: true }).click();
      if (mode === "roleplay") {
        const choices = page.getByRole("dialog", { name: "Configure Preset Variables" });
        await expect(choices).toBeVisible();
        await choices.getByRole("button", { name: "Close Configure Preset Variables", exact: true }).click();
      }
      await expect(wizard.getByRole("heading", { name: "Persona & Characters", exact: true })).toBeVisible();
      await wizard.getByPlaceholder(/Search characters/i).fill("Just browsing, no selection");
      await wizard.getByRole("button", { name: "Skip", exact: true }).click();
      await expect.poll(async () => (await page.request.get(`/api/chats/${chat.id}`)).status()).toBe(404);
      await expect(page.locator('[data-component="HomeBrowserHub.HomePage"]')).toBeVisible();
    }
    for (const mode of ["conversation", "roleplay"] as const) {
      const { chat } = await launch(page, mode);
      await page.getByRole("button", { name: "Home", exact: true }).click();
      await expect.poll(async () => (await page.request.get(`/api/chats/${chat.id}`)).status()).toBe(404);
      await expect(page.locator('[data-component="HomeBrowserHub.HomePage"]')).toBeVisible();
    }
    const firstDraft = await launch(page, "roleplay");
    const chats = page.locator('[data-component="TopBar"]').getByRole("button", { name: "Chats", exact: true });
    if ((await chats.getAttribute("aria-pressed")) !== "true") await chats.click();
    const secondCreated = page.waitForResponse(
      (response) => response.request().method() === "POST" && /\/api\/chats\/?$/.test(new URL(response.url()).pathname),
    );
    await page
      .getByRole("complementary", { name: "Chat list", exact: true })
      .getByRole("button", { name: "New Roleplay", exact: true })
      .click();
    const secondDraft = (await (await secondCreated).json()) as { id: string };
    await expect.poll(async () => (await page.request.get(`/api/chats/${firstDraft.chat.id}`)).status()).toBe(404);
    expect((await page.request.get(`/api/chats/${secondDraft.id}`)).ok()).toBeTruthy();
    await expect(firstDraft.wizard).toBeVisible();
    await firstDraft.wizard.getByRole("button", { name: "Close setup", exact: true }).click();
    await expect.poll(async () => (await page.request.get(`/api/chats/${secondDraft.id}`)).status()).toBe(404);
    await page.evaluate(async (id) => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setActiveChatId(id);
    }, existingGame.id);
    const existingWizard = page.locator('[data-component="GameSetupWizard"]');
    await expect(existingWizard).toBeVisible();
    await existingWizard.getByRole("button", { name: "Close setup", exact: true }).click();
    await expect(existingWizard).toHaveCount(0);
    expect((await page.request.get(`/api/chats/${existingGame.id}`)).ok()).toBeTruthy();
    const chatsToggle = page.locator('[data-component="TopBar"]').getByRole("button", { name: "Chats", exact: true });
    if ((await chatsToggle.getAttribute("aria-pressed")) !== "true") await chatsToggle.click();
    const sidebar = page.getByRole("complementary", { name: "Chat list", exact: true });
    const created = page.waitForResponse(
      (response) => response.request().method() === "POST" && /\/api\/chats\/?$/.test(new URL(response.url()).pathname),
    );
    await sidebar.getByRole("button", { name: "New Game", exact: true }).click();
    const sidebarChat = (await (await created).json()) as { id: string };
    await expect(existingWizard).toBeVisible();
    await existingWizard.getByRole("button", { name: "Close setup", exact: true }).click();
    await expect.poll(async () => (await page.request.get(`/api/chats/${sidebarChat.id}`)).status()).toBe(404);
  } finally {
    await page.request.delete(`/api/chats/${existingGame.id}`);
    await page.request.delete(`/api/chats/${existing.id}`);
    await page.request.delete(`/api/connections/${connection.id}`);
  }
});

test("Connections hand-offs leave untouched setup chats eligible for cleanup", async ({ page }) => {
  const connection = await seedConnection(page);
  const created: string[] = [];
  try {
    await page.goto("/");
    for (const mode of ["conversation", "roleplay"] as const) {
      const { chat, wizard } = await launch(page, mode);
      created.push(chat.id);
      // The connection disappeared after creation: exercise the wizard's real empty-list shortcut.
      await page.evaluate(async () => {
        const { queryClient } = await import("/src/lib/query-client.ts" as string);
        queryClient.setQueryData(["connections", "list"], []);
      });
      await wizard.getByRole("button", { name: "Set Up a Connection", exact: true }).click();
      await expect(wizard).toHaveCount(0);
      await closeChatSettings(page);
      await page.getByRole("button", { name: "Home", exact: true }).click();
      await expect.poll(async () => (await page.request.get(`/api/chats/${chat.id}`)).status()).toBe(404);
      await page.evaluate(async () => {
        const { queryClient } = await import("/src/lib/query-client.ts" as string);
        await queryClient.invalidateQueries({ queryKey: ["connections", "list"] });
      });
    }
  } finally {
    for (const id of created) await page.request.delete(`/api/chats/${id}`);
    await page.request.delete(`/api/connections/${connection.id}`);
  }
});

test("Download Agents hand-off leaves an untouched setup chat eligible for cleanup", async ({ page }) => {
  const connection = await seedConnection(page);
  let chatId = "";
  try {
    await page.goto("/");
    const { chat, wizard } = await launch(page, "conversation");
    chatId = chat.id;
    for (let step = 0; step < 3; step += 1) await wizard.getByRole("button", { name: "Next", exact: true }).click();
    await expect(wizard.getByRole("heading", { name: "Automation", exact: true })).toBeVisible();
    await wizard.getByRole("button", { name: "Download Agents", exact: true }).click();
    await expect(wizard).toHaveCount(0);
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await expect.poll(async () => (await page.request.get(`/api/chats/${chatId}`)).status()).toBe(404);
  } finally {
    if (chatId) await page.request.delete(`/api/chats/${chatId}`);
    await page.request.delete(`/api/connections/${connection.id}`);
  }
});

test("resetting a new chat background persists the reset and retains the real user edit", async ({ page }) => {
  const connection = await seedConnection(page);
  let chatId = "";
  try {
    await page.route("**/api/backgrounds/file/**", (route) =>
      route.fulfill({
        contentType: "image/gif",
        body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
      }),
    );
    await page.goto("/");
    const { chat, wizard } = await launch(page, "conversation");
    chatId = chat.id;
    // All background controls share this store action and ChatArea's persistence effect.
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().setChatBackground("/api/backgrounds/file/reset-fixture.gif");
    });
    await expect
      .poll(async () => (await (await page.request.get(`/api/chats/${chatId}`)).json()).metadata.background)
      .toBe("reset-fixture.gif");
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().setChatBackground(null);
    });
    await expect
      .poll(async () => (await (await page.request.get(`/api/chats/${chatId}`)).json()).metadata.background)
      .toBeNull();
    await wizard.getByRole("button", { name: "Close setup", exact: true }).click();
    await expect(wizard).toHaveCount(0);
    expect((await page.request.get(`/api/chats/${chatId}`)).ok()).toBeTruthy();
    await closeChatSettings(page);
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await page.evaluate(async (id) => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setActiveChatId(id);
    }, chatId);
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          return useUIStore.getState().chatBackground;
        }),
      )
      .toBeNull();
  } finally {
    if (chatId) await page.request.delete(`/api/chats/${chatId}`);
    await page.request.delete(`/api/connections/${connection.id}`);
  }
});

test("editing setup and a delayed saved message both prevent automatic cleanup", async ({ page }) => {
  const connection = await seedConnection(page);
  let firstId = "";
  let secondId = "";
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await page.goto("/");
    const first = await launch(page, "conversation");
    firstId = first.chat.id;
    const name = first.wizard.locator('input[type="text"]').first();
    await name.fill("Configured chat is kept");
    await first.wizard.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(first.wizard).toHaveCount(0);
    await expect
      .poll(async () => (await (await page.request.get(`/api/chats/${firstId}`)).json()).name)
      .toBe("Configured chat is kept");
    // Close the retained chat's settings, then use the same Home action as a user.
    await closeChatSettings(page);
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await expect(page.locator('[data-component="HomeBrowserHub.HomePage"]')).toBeVisible();
    const second = await launch(page, "roleplay");
    secondId = second.chat.id;
    await page.route(`**/api/chats/${secondId}/discard-empty-setup`, async (route) => {
      await gate;
      await route.continue();
    });
    const canceled = page.waitForRequest((request) => request.url().endsWith(`/${secondId}/discard-empty-setup`));
    await second.wizard.getByRole("button", { name: "Close setup", exact: true }).click();
    await canceled;
    const message = await page.request.post(`/api/chats/${secondId}/messages`, {
      data: { role: "user", content: "Saved while cancel waits" },
    });
    expect(message.ok()).toBeTruthy();
    // A late cancellation must not close or deselect another chat opened in the meantime.
    await page.evaluate(async (id) => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setActiveChatId(id);
    }, firstId);
    release();
    await expect(second.wizard).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          return useChatStore.getState().activeChatId;
        }),
      )
      .toBe(firstId);
    expect((await page.request.get(`/api/chats/${secondId}`)).ok()).toBeTruthy();
    expect(
      (await (await page.request.get(`/api/chats/${secondId}/messages`)).json()).some(
        (row: { content: string }) => row.content === "Saved while cancel waits",
      ),
    ).toBeTruthy();
  } finally {
    release();
    for (const id of [firstId, secondId].filter(Boolean)) await page.request.delete(`/api/chats/${id}`);
    await page.request.delete(`/api/connections/${connection.id}`);
  }
});

test("a stalled setup save releases cancellation and a later attempt retries safely", async ({ page }) => {
  const connection = await seedConnection(page);
  let chatId = "";
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let discardRequests = 0;
  try {
    await page.goto("/");
    const { chat, wizard } = await launch(page, "conversation");
    chatId = chat.id;
    await page.route(`**/api/chats/${chatId}`, async (route) => {
      if (route.request().method() === "PATCH") await gate;
      await route.continue();
    });
    page.on("request", (request) => {
      if (request.url().endsWith(`/${chatId}/discard-empty-setup`)) discardRequests += 1;
    });
    const saving = page.waitForRequest(
      (request) => request.method() === "PATCH" && new URL(request.url()).pathname === `/api/chats/${chatId}`,
    );
    await wizard.locator('input[type="text"]').first().fill("User edit finishes after cancel");
    await wizard.getByRole("button", { name: "Close setup", exact: true }).click();
    await saving;
    await expect(page.getByRole("status").filter({ hasText: "Closing setup…" })).toBeVisible();
    // This PATCH stays unanswered throughout cancellation. Never compare or delete uncertain state.
    await expect(wizard).toHaveCount(0, { timeout: 8_000 });
    expect(discardRequests).toBe(0);
    expect((await page.request.get(`/api/chats/${chatId}`)).ok()).toBeTruthy();
    expect(
      await page.evaluate(async (id) => {
        const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
        return !!useChatStore.getState().pendingNewChatSetups[id];
      }, chatId),
    ).toBe(true);
    release();
    await expect
      .poll(async () => (await (await page.request.get(`/api/chats/${chatId}`)).json()).name)
      .toBe("User edit finishes after cancel");
    await closeChatSettings(page);
    await page.getByRole("button", { name: "Home", exact: true }).click();
    // A new call must run, rather than joining the abandoned wait promise.
    await expect.poll(() => discardRequests).toBeGreaterThan(0);
    await expect
      .poll(() =>
        page.evaluate(async (id) => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          return useChatStore.getState().pendingNewChatSetups[id] ?? null;
        }, chatId),
      )
      .toBeNull();
    const kept = await page.request.get(`/api/chats/${chatId}`);
    expect(kept.ok()).toBeTruthy();
    expect((await kept.json()).name).toBe("User edit finishes after cancel");
  } finally {
    release();
    if (chatId) await page.request.delete(`/api/chats/${chatId}`);
    await page.request.delete(`/api/connections/${connection.id}`);
  }
});

test("a stalled discard request releases the wizard for a safe retry", async ({ page }) => {
  const connection = await seedConnection(page);
  let chatId = "";
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let attempts = 0;
  try {
    await page.goto("/");
    const { chat, wizard } = await launch(page, "conversation");
    chatId = chat.id;
    await page.route(`**/api/chats/${chatId}/discard-empty-setup`, async (route) => {
      attempts += 1;
      if (attempts === 1) {
        // This controlled failure is held before it reaches the server.
        await gate;
        await route.abort().catch(() => {});
      } else {
        await route.continue();
      }
    });
    await wizard.getByRole("button", { name: "Close setup", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Closing setup…" })).toBeVisible();
    await expect(page.getByText("We couldn't remove the empty chat; please try again.", { exact: true })).toBeVisible({
      timeout: 13_000,
    });
    expect(attempts).toBe(1);
    await expect(wizard.getByRole("button", { name: "Close setup", exact: true })).toBeEnabled();
    expect((await page.request.get(`/api/chats/${chatId}`)).ok()).toBeTruthy();
    expect(
      await page.evaluate(async (id) => {
        const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
        return !!useChatStore.getState().pendingNewChatSetups[id];
      }, chatId),
    ).toBe(true);
    // On narrow screens the error notification overlaps Close setup; dismiss it as a user would.
    await page.getByRole("button", { name: "Close toast", exact: true }).click();
    await wizard.getByRole("button", { name: "Close setup", exact: true }).click();
    await expect(wizard).toHaveCount(0);
    await expect.poll(async () => (await page.request.get(`/api/chats/${chatId}`)).status()).toBe(404);
    expect(attempts).toBe(2);
    await expect(page.locator('[data-component="HomeBrowserHub.HomePage"]')).toBeVisible();
  } finally {
    release();
    if (chatId) await page.request.delete(`/api/chats/${chatId}`);
    await page.request.delete(`/api/connections/${connection.id}`);
  }
});

test("cancel waits for automatic defaults and preserves a racing user edit", async ({ page }) => {
  const connection = await seedConnection(page);
  const retained: string[] = [];
  const releaseAll: Array<() => void> = [];
  try {
    await seedUIState(
      page,
      {
        chatWizardDefaults: {
          roleplay: {
            connectionId: connection.id,
            promptPresetId: null,
            personaId: null,
            personaCharacterId: null,
            characterIds: [],
            metadata: { contextMessageLimit: 17 },
          },
        },
      },
      "merge",
    );
    await page.goto("/");
    for (const edited of [false, true]) {
      let started!: (id: string) => void;
      const seen = new Promise<string>((resolve) => {
        started = resolve;
      });
      let allowFetch!: () => void;
      const fetchGate = new Promise<void>((resolve) => {
        allowFetch = resolve;
      });
      let serverSaved!: () => void;
      const committed = new Promise<void>((resolve) => {
        serverSaved = resolve;
      });
      let release!: () => void;
      const responseGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      releaseAll.push(allowFetch, release);
      const pattern = "**/api/chats/*/metadata";
      const intercept = async (route: import("@playwright/test").Route) => {
        if (route.request().method() !== "PATCH" || route.request().postDataJSON()?.contextMessageLimit !== 17) {
          await route.continue();
          return;
        }
        started(new URL(route.request().url()).pathname.split("/")[3]!);
        await fetchGate;
        const response = await route.fetch();
        serverSaved();
        await responseGate;
        await route.fulfill({ response });
      };
      await page.route(pattern, intercept);
      await page.locator('[data-home-chat-mode="roleplay"]').first().click();
      const id = await seen;
      retained.push(id);
      if (edited) {
        const rename = await page.request.patch(`/api/chats/${id}`, {
          data: { name: "User edit during automatic defaults" },
        });
        expect(rename.ok()).toBeTruthy();
        const userSetting = await page.request.patch(`/api/chats/${id}/metadata`, {
          data: { customSystemPrompt: "User-authored setting while defaults load" },
        });
        expect(userSetting.ok()).toBeTruthy();
      }
      allowFetch();
      await committed;
      await page.getByRole("button", { name: "Home", exact: true }).click();
      // The automatic defaults response is still outstanding, so cancellation must wait for its whole task.
      expect((await page.request.get(`/api/chats/${id}`)).ok()).toBeTruthy();
      release();
      if (edited) {
        await expect
          .poll(async () => {
            const row = await (await page.request.get(`/api/chats/${id}`)).json();
            return { name: row.name, limit: row.metadata.contextMessageLimit, prompt: row.metadata.customSystemPrompt };
          })
          .toEqual({
            name: "User edit during automatic defaults",
            limit: 17,
            prompt: "User-authored setting while defaults load",
          });
        await expect
          .poll(() =>
            page.evaluate(async (chatId) => {
              const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
              return useChatStore.getState().pendingNewChatSetups[chatId] ?? null;
            }, id),
          )
          .toBeNull();
      } else {
        await expect.poll(async () => (await page.request.get(`/api/chats/${id}`)).status()).toBe(404);
      }
      await page.unroute(pattern, intercept);
      await expect(page.locator('[data-component="HomeBrowserHub.HomePage"]')).toBeVisible();
    }
  } finally {
    for (const release of releaseAll) release();
    for (const id of retained) await page.request.delete(`/api/chats/${id}`);
    await page.request.delete(`/api/connections/${connection.id}`);
  }
});

test("cancel waits for the starred profile and preserves chat-owned user edits", async ({ page }) => {
  const connection = await seedConnection(page);
  const retained: string[] = [];
  let profileId = "";
  const releaseAll: Array<() => void> = [];
  try {
    const createdProfile = await page.request.post("/api/chat-presets", {
      data: {
        name: "Automatic setup fixture",
        mode: "roleplay",
        settings: {
          connectionId: connection.id,
          metadata: { contextMessageLimit: 23, enableTools: true },
        },
      },
    });
    expect(createdProfile.ok()).toBeTruthy();
    const profile = (await createdProfile.json()) as { id: string };
    profileId = profile.id;
    expect((await page.request.post(`/api/chat-presets/${profile.id}/set-active`)).ok()).toBeTruthy();
    await page.goto("/");
    for (const edited of [false, true]) {
      let started!: (id: string) => void;
      const seen = new Promise<string>((resolve) => {
        started = resolve;
      });
      let allowFetch!: () => void;
      const fetchGate = new Promise<void>((resolve) => {
        allowFetch = resolve;
      });
      let serverSaved!: () => void;
      const committed = new Promise<void>((resolve) => {
        serverSaved = resolve;
      });
      let release!: () => void;
      const responseGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      releaseAll.push(allowFetch, release);
      const pattern = "**/api/chat-presets/*/apply/*";
      const intercept = async (route: import("@playwright/test").Route) => {
        if (route.request().method() !== "POST") {
          await route.continue();
          return;
        }
        started(new URL(route.request().url()).pathname.split("/")[5]!);
        await fetchGate;
        const response = await route.fetch();
        serverSaved();
        await responseGate;
        await route.fulfill({ response });
      };
      await page.route(pattern, intercept);
      await page.locator('[data-home-chat-mode="roleplay"]').first().click();
      const id = await seen;
      retained.push(id);
      if (edited) {
        const userSetting = await page.request.patch(`/api/chats/${id}/metadata`, {
          data: { summary: "User-authored history while profile loads", activeAgentIds: ["user-selected-agent"] },
        });
        expect(userSetting.ok()).toBeTruthy();
      }
      allowFetch();
      await committed;
      if (edited) {
        await page.getByRole("button", { name: "Home", exact: true }).click();
      } else {
        const loading = page.getByRole("status").filter({ hasText: "Loading..." });
        await expect(loading).toBeVisible();
        // The loading shell's first sibling is its dismissible backdrop.
        await loading
          .locator("../..")
          .locator(":scope > div")
          .first()
          .click({ position: { x: 2, y: 2 } });
        await expect(page.getByRole("status").filter({ hasText: "Closing setup…" })).toBeVisible();
      }
      // The automatic profile response is still outstanding, so cancellation must wait for its whole task.
      expect((await page.request.get(`/api/chats/${id}`)).ok()).toBeTruthy();
      release();
      if (edited) {
        await expect
          .poll(async () => {
            const row = await (await page.request.get(`/api/chats/${id}`)).json();
            return {
              limit: row.metadata.contextMessageLimit,
              summary: row.metadata.summary,
              agents: row.metadata.activeAgentIds,
            };
          })
          .toEqual({
            limit: 23,
            summary: "User-authored history while profile loads",
            agents: ["user-selected-agent"],
          });
        await expect
          .poll(() =>
            page.evaluate(async (chatId) => {
              const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
              return useChatStore.getState().pendingNewChatSetups[chatId] ?? null;
            }, id),
          )
          .toBeNull();
      } else {
        await expect.poll(async () => (await page.request.get(`/api/chats/${id}`)).status()).toBe(404);
      }
      await page.unroute(pattern, intercept);
      await expect(page.locator('[data-component="HomeBrowserHub.HomePage"]')).toBeVisible();
    }
  } finally {
    for (const release of releaseAll) release();
    for (const id of retained) await page.request.delete(`/api/chats/${id}`);
    if (profileId) await page.request.delete(`/api/chat-presets/${profileId}`);
    await page.request.delete(`/api/connections/${connection.id}`);
  }
});

for (const themeMode of ["dark", "light"] as const) {
  test(`editor loading matches the loaded surface in ${themeMode} theme`, async ({ page }, testInfo) => {
    await seedUIState(
      page,
      {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        appAccentPulseMode: false,
        theme: themeMode,
        appBackgroundColor: "#34392e",
      },
      "merge",
    );
    const response = await page.request.post("/api/characters", {
      data: { data: { name: `Loading surface ${themeMode}` } },
    });
    const character = (await response.json()) as { id: string };
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      await page.route(`**/api/characters/${character.id}`, async (route) => {
        await gate;
        await route.continue();
      });
      await page.goto("/");
      await clickTopbarPanel(page, "characters");
      await page
        .locator(`[data-character-id="${character.id}"]`)
        .getByText(`Loading surface ${themeMode}`, { exact: true })
        .click();
      const host = page.locator('[data-component="DetailEditor"], [data-component="MobileDetailSheet"]');
      await expect(host).toBeVisible();
      await expect(host.locator(".shimmer").first()).toBeVisible();
      // Resolve the token through a real element, including custom-theme overrides and browser color serialization.
      const loading = await host.evaluate((element) => {
        const probe = document.createElement("div");
        probe.style.background = "var(--marinara-editor-bg)";
        element.append(probe);
        const token = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return { actual: getComputedStyle(element).backgroundColor, token };
      });
      expect(loading.actual).toBe(loading.token);
      const screenshot = testInfo.outputPath(`editor-loading-${themeMode}.png`);
      await page.screenshot({ path: screenshot });
      await testInfo.attach(`editor loading ${themeMode}`, { path: screenshot, contentType: "image/png" });
      release();
      await expect(host.locator(".mari-editor-header")).toBeVisible();
      const surface = host.locator(".mari-editor-shell").first();
      await expect(surface).toHaveCSS("background-color", loading.actual);
      expect(
        await page.evaluate(() => document.documentElement.style.getPropertyValue("--marinara-app-background-paint")),
      ).toBe("#34392e");
    } finally {
      release();
      await page.request.delete(`/api/characters/${character.id}`);
    }
  });
}

for (const scheduled of [false, true]) {
  test(`successful Conversation Start retires setup before navigation (${scheduled ? "buffered schedule" : "immediate"})`, async ({
    page,
  }) => {
    const connection = await seedConnection(page);
    const created = await page.request.post("/api/characters", {
      data: { data: { name: "Started conversation fixture" } },
    });
    expect(created.ok()).toBeTruthy();
    const character = (await created.json()) as { id: string };
    let chatId = "";
    let discardRequests = 0;
    let scheduleRequests = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/discard-empty-setup")) discardRequests += 1;
    });
    await page.route("**/api/conversation/schedule/generate", (route) => {
      scheduleRequests += 1;
      return route.fulfill({ json: { success: true } });
    });
    try {
      await seedUIState(
        page,
        {
          chatWizardDefaults: {
            conversation: {
              connectionId: connection.id,
              promptPresetId: null,
              personaId: null,
              personaCharacterId: null,
              characterIds: [character.id],
              metadata: { autonomousMessages: scheduled, conversationSchedulesEnabled: scheduled },
            },
          },
        },
        "merge",
      );
      await page.goto("/");
      const { chat, wizard } = await launch(page, "conversation");
      chatId = chat.id;
      for (const heading of ["Prompt Preset", "Persona & Characters", "Automation"]) {
        await wizard.getByRole("button", { name: "Next", exact: true }).click();
        await expect(wizard.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      }
      await wizard.getByRole("button", { name: "Start Chatting", exact: true }).click();
      await expect(wizard).toHaveCount(0);
      await closeChatSettings(page);
      const detail = await page.request.get(`/api/chats/${chatId}`);
      expect(detail.status()).toBe(200);
      expect((await detail.json()).metadata.conversationSetupComplete).toBe(true);
      expect(scheduleRequests).toBe(scheduled ? 1 : 0);
      await page.getByRole("button", { name: "Home", exact: true }).click();
      await expect(page.locator('[data-component="HomeBrowserHub.HomePage"]')).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(async (id) => {
            const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
            return !!useChatStore.getState().pendingNewChatSetups[id];
          }, chatId),
        )
        .toBe(false);
      expect((await page.request.get(`/api/chats/${chatId}`)).status()).toBe(200);
      expect(discardRequests).toBe(0);
    } finally {
      if (chatId) await page.request.delete(`/api/chats/${chatId}`);
      await page.request.delete(`/api/characters/${character.id}`);
      await page.request.delete(`/api/connections/${connection.id}`);
    }
  });
}

test("successful participant-free Roleplay Apply & Start retires setup before navigation", async ({ page }) => {
  const connection = await seedConnection(page);
  let chatId = "";
  let discardRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/discard-empty-setup")) discardRequests += 1;
  });
  try {
    await page.goto("/");
    const { chat, wizard } = await launch(page, "roleplay");
    chatId = chat.id;
    await wizard.getByRole("button", { name: /^(Use a Profile|Profile)$/ }).click();
    await wizard.getByRole("button", { name: "Apply & Start", exact: true }).click();
    await expect(wizard).toHaveCount(0);
    await closeChatSettings(page);
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await expect(page.locator('[data-component="HomeBrowserHub.HomePage"]')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(async (id) => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          return !!useChatStore.getState().pendingNewChatSetups[id];
        }, chatId),
      )
      .toBe(false);
    expect((await page.request.get(`/api/chats/${chatId}`)).status()).toBe(200);
    expect(discardRequests).toBe(0);
  } finally {
    if (chatId) await page.request.delete(`/api/chats/${chatId}`);
    await page.request.delete(`/api/connections/${connection.id}`);
  }
});

test("failed participant-free Roleplay profile application preserves empty-draft cleanup", async ({ page }) => {
  const connection = await seedConnection(page);
  let chatId = "";
  let discardRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/discard-empty-setup")) discardRequests += 1;
  });
  try {
    await page.goto("/");
    const { chat, wizard } = await launch(page, "roleplay");
    chatId = chat.id;
    await wizard.getByRole("button", { name: /^(Use a Profile|Profile)$/ }).click();
    await page.route("**/api/chat-presets/*/apply/*", (route) =>
      route.fulfill({ status: 503, json: { error: "Fixture failure" } }),
    );
    const failed = page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().includes(`/apply/${chatId}`),
    );
    await wizard.getByRole("button", { name: "Apply & Start", exact: true }).click();
    expect((await failed).status()).toBe(503);
    await expect(wizard).toHaveCount(0);
    await closeChatSettings(page);
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await expect(page.locator('[data-component="HomeBrowserHub.HomePage"]')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(async (id) => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          return !!useChatStore.getState().pendingNewChatSetups[id];
        }, chatId),
      )
      .toBe(false);
    expect((await page.request.get(`/api/chats/${chatId}`)).status()).toBe(404);
    expect(discardRequests).toBe(1);
  } finally {
    if (chatId) await page.request.delete(`/api/chats/${chatId}`);
    await page.request.delete(`/api/connections/${connection.id}`);
  }
});

test("successful participant-free Roleplay Start keeps an automatically configured chat on navigation", async ({
  page,
}) => {
  const connection = await seedConnection(page);
  let chatId = "";
  let discardRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/discard-empty-setup")) discardRequests += 1;
  });
  try {
    await seedUIState(
      page,
      {
        chatWizardDefaults: {
          roleplay: {
            connectionId: connection.id,
            promptPresetId: null,
            personaId: null,
            personaCharacterId: null,
            characterIds: [],
            metadata: { chatParameters: null },
          },
        },
      },
      "merge",
    );
    await page.goto("/");
    const { chat, wizard } = await launch(page, "roleplay");
    chatId = chat.id;
    await expect
      .poll(() =>
        page.evaluate(async (id) => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          return useChatStore.getState().pendingNewChatSetups[id]?.metadata.chatParameters;
        }, chatId),
      )
      .toBeNull();
    for (const heading of ["Pick a Preset", "Persona & Characters", "Attach Lorebooks", "Enable Agents"]) {
      await wizard.getByRole("button", { name: "Next", exact: true }).click();
      await expect(wizard.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    await wizard.getByRole("button", { name: "Start", exact: true }).click();
    await expect(wizard).toHaveCount(0);
    await closeChatSettings(page);
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(async (id) => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          return !!useChatStore.getState().pendingNewChatSetups[id];
        }, chatId),
      )
      .toBe(false);
    expect((await page.request.get(`/api/chats/${chatId}`)).status()).toBe(200);
    expect(discardRequests).toBe(0);
  } finally {
    if (chatId) await page.request.delete(`/api/chats/${chatId}`);
    await page.request.delete(`/api/connections/${connection.id}`);
  }
});

test("starred-profile translator defaults stay inside the automatic empty-draft baseline", async ({ page }) => {
  const connection = await seedConnection(page);
  const previous = await (await page.request.get("/api/app-settings/translator-defaults")).json();
  const previousProfile = await (await page.request.get("/api/chat-presets/active/roleplay")).json();
  let profileId = "";
  let chatId = "";
  try {
    expect(
      (
        await page.request.put("/api/app-settings/translator-defaults", {
          data: {
            value: JSON.stringify({ translationProvider: "ai", translationTargetLang: "pl", translateInput: true }),
          },
        })
      ).ok(),
    ).toBeTruthy();
    const created = await page.request.post("/api/chat-presets", {
      data: {
        name: "Automatic translator baseline",
        mode: "roleplay",
        settings: { connectionId: connection.id, metadata: { contextMessageLimit: 23 } },
      },
    });
    expect(created.ok()).toBeTruthy();
    profileId = (await created.json()).id;
    expect((await page.request.post(`/api/chat-presets/${profileId}/set-active`)).ok()).toBeTruthy();
    const applied = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.includes(`/chat-presets/${profileId}/apply/`),
    );
    await page.goto("/");
    const { chat, wizard } = await launch(page, "roleplay");
    chatId = chat.id;
    const raw = await (await applied).json();
    expect(typeof raw.metadata).toBe("string");
    expect(JSON.parse(raw.metadata).translationTargetLang).toBe("pl");
    await expect
      .poll(async () => (await (await page.request.get(`/api/chats/${chatId}`)).json()).metadata.translationTargetLang)
      .toBe("pl");
    await wizard.getByRole("button", { name: "Close setup", exact: true }).click();
    await expect.poll(async () => (await page.request.get(`/api/chats/${chatId}`)).status()).toBe(404);
  } finally {
    if (chatId) await page.request.delete(`/api/chats/${chatId}`);
    if (previousProfile?.id) await page.request.post(`/api/chat-presets/${previousProfile.id}/set-active`);
    if (profileId) await page.request.delete(`/api/chat-presets/${profileId}`);
    await page.request.put("/api/app-settings/translator-defaults", { data: { value: previous.value ?? "null" } });
    await page.request.delete(`/api/connections/${connection.id}`);
  }
});

test("Game setup after reload preserves a chat whose creation provenance is no longer in this tab", async ({
  page,
}) => {
  const connection = await seedConnection(page);
  let chatId = "";
  try {
    await page.goto("/");
    const { chat } = await launch(page, "game");
    chatId = chat.id;
    await page.reload();
    const wizard = page.locator('[data-component="GameSetupWizard"]');
    await expect(wizard).toBeVisible();
    expect(
      await page.evaluate(async (id) => {
        const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
        return !!useChatStore.getState().pendingNewChatSetups[id];
      }, chatId),
    ).toBe(false);
    await wizard.getByRole("button", { name: "Close setup", exact: true }).click();
    await expect(wizard).toHaveCount(0);
    expect((await page.request.get(`/api/chats/${chatId}`)).status()).toBe(200);
  } finally {
    if (chatId) await page.request.delete(`/api/chats/${chatId}`);
    await page.request.delete(`/api/connections/${connection.id}`);
  }
});
