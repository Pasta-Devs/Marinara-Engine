import { expect, test, type Page } from "@playwright/test";
import { createServer, type ServerResponse } from "node:http";
import { supportedCapabilityApi } from "../packages/shared/src/schemas/capability-package.schema.js";
import {
  engineStorageWrites,
  installPackageClient,
  packageClientPath,
  preparePackagePage,
  recordStorageWrites,
  waitForPackageClient,
} from "./host-package-fixture.js";
import { seedUIState } from "./ui-state-fixture.js";

const PACKAGE_ID = "e2e-host-namespace-package";

interface ChatSeen {
  activeChatId: string | null;
  isStreaming: boolean;
  streamingChatId: string | null;
}

/**
 * A package client built against the host namespace. At import it keeps what it found, and it follows the Engine's
 * live chat store the way a game board or Calls does, reading only.
 */
const NAMESPACE_CLIENT = `
const host = globalThis.__MARINARA_HOST__;
globalThis.__e2eHostAtImport = host ?? null;
const seen = (globalThis.__e2eChatSeen = []);
const chat = host?.stores?.chat;
if (chat) {
  const note = (state) => {
    const next = { activeChatId: state.activeChatId, isStreaming: state.isStreaming, streamingChatId: state.streamingChatId };
    const last = seen[seen.length - 1];
    if (!last || Object.keys(next).some((key) => last[key] !== next[key])) seen.push(next);
  };
  note(chat.getState());
  chat.subscribe(note);
}`;

function chatSeen(page: Page) {
  return page.evaluate(() => (globalThis as { __e2eChatSeen?: ChatSeen[] }).__e2eChatSeen ?? []);
}

async function openPackagePage(page: Page, state: Parameters<typeof seedUIState>[1] = {}) {
  await preparePackagePage(page);
  await seedUIState(page, { hasCompletedOnboarding: true, ...state });
  await recordStorageWrites(page);
  await installPackageClient(page, PACKAGE_ID, NAMESPACE_CLIENT);
}

test.describe("The host namespace agent packages use", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!testInfo.project.name.includes("desktop"), "One browser proves the shared client namespace.");
  });

  test("is complete, live and read-only before a package client loads", async ({ page }) => {
    await openPackagePage(page);
    await page.goto("/");
    await waitForPackageClient(page);

    const found = await page.evaluate(async () => {
      type HostNamespace = {
        version: number;
        capabilityApi: { major: number; minor: number };
        stores: Record<string, unknown>;
        services: { tts: Record<string, unknown>; dialogs: Record<string, unknown> };
        modules: Record<string, Record<string, unknown>>;
        queryClient: { getQueryCache(): { getAll(): unknown[] } };
        components: { Modal: unknown };
        data: { emojiCatalog: Record<string, unknown> };
        api: Record<string, unknown>;
      };
      const load = <T>(path: string) => import(path as string) as Promise<T>;
      const host = (globalThis as { __MARINARA_HOST__?: HostNamespace }).__MARINARA_HOST__!;
      const [ui, chat, agent, sidecar, dialog, gallery, encounter, gameState, backfill] = await Promise.all(
        [
          "ui.store.ts",
          "chat.store.ts",
          "agent.store.ts",
          "sidecar.store.ts",
          "dialog.store.ts",
          "gallery.store.ts",
          "encounter.store.ts",
          "game-state.store.ts",
          "backfill.store.ts",
        ].map((file) => load<Record<string, unknown>>(`/src/stores/${file}`)),
      );
      const [queryClientModule, tts, dialogs, api, emojiCatalog, modal] = await Promise.all([
        load<{ queryClient: unknown }>("/src/lib/query-client.ts"),
        load<Record<string, unknown>>("/src/lib/tts-service.ts"),
        load<Record<string, unknown>>("/src/lib/app-dialogs.ts"),
        load<Record<string, unknown>>("/src/lib/api-client.ts"),
        load<Record<string, unknown>>("/src/lib/emoji-catalog.generated.ts"),
        load<{ Modal: unknown }>("/src/components/ui/Modal.tsx"),
      ]);
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, "__MARINARA_HOST__");
      try {
        (globalThis as { __MARINARA_HOST__?: unknown }).__MARINARA_HOST__ = { version: 2 };
      } catch {
        // A non-writable property throws here in strict code; either way it must keep the Engine's namespace.
      }
      const sample = (specifier: string, name: string) => typeof host.modules[specifier]?.[name];
      return {
        definedAtImport: (globalThis as { __e2eHostAtImport?: unknown }).__e2eHostAtImport === host,
        version: host.version,
        capabilityApi: { ...host.capabilityApi },
        members: Object.keys(host),
        storeNames: Object.keys(host.stores),
        moduleSpecifiers: Object.keys(host.modules),
        liveStores: {
          ui: host.stores.ui === ui!.useUIStore,
          chat: host.stores.chat === chat!.useChatStore,
          agent: host.stores.agent === agent!.useAgentStore,
          sidecar: host.stores.sidecar === sidecar!.useSidecarStore,
          dialog: host.stores.dialog === dialog!.useDialogStore,
          gallery: host.stores.gallery === gallery!.useGalleryStore,
          encounter: host.stores.encounter === encounter!.useEncounterStore,
          gameState: host.stores.gameState === gameState!.useGameStateStore,
          backfill: host.stores.backfill === backfill!.useRollingBackfillStore,
        },
        hostModules: {
          tts: host.services.tts.ttsService === tts.ttsService,
          dialogs: host.services.dialogs.showConfirmDialog === dialogs.showConfirmDialog,
          api: host.api.api === api.api && host.api.ApiError === api.ApiError,
          emojiCatalog: host.data.emojiCatalog.EMOJI_CATEGORIES === emojiCatalog.EMOJI_CATEGORIES,
          Modal: host.components.Modal === modal.Modal,
        },
        appQueryClient:
          host.queryClient === queryClientModule.queryClient && host.queryClient.getQueryCache().getAll().length > 0,
        samples: {
          react: sample("react", "useState"),
          "react/jsx-runtime": sample("react/jsx-runtime", "jsx"),
          "react-dom": sample("react-dom", "createPortal"),
          "react-dom/client": sample("react-dom/client", "createRoot"),
          "@tanstack/react-query": sample("@tanstack/react-query", "QueryClientProvider"),
          zustand: sample("zustand", "create"),
          "zustand/middleware": sample("zustand/middleware", "persist"),
          sonner: sample("sonner", "toast"),
          zod: sample("zod", "z"),
          i18next: sample("i18next", "createInstance"),
          "react-i18next": sample("react-i18next", "I18nextProvider"),
          "framer-motion": sample("framer-motion", "motion"),
          "tailwind-merge": sample("tailwind-merge", "twMerge"),
          clsx: sample("clsx", "clsx"),
        },
        property: { writable: descriptor?.writable, configurable: descriptor?.configurable },
        unchanged: (globalThis as { __MARINARA_HOST__?: unknown }).__MARINARA_HOST__ === host,
        frozen: [host, host.stores, host.services, host.modules, host.components, host.data].every(Object.isFrozen),
      };
    });

    expect(found).toEqual({
      definedAtImport: true,
      version: 1,
      capabilityApi: { ...supportedCapabilityApi },
      members: [
        "version",
        "capabilityApi",
        "stores",
        "services",
        "modules",
        "queryClient",
        "components",
        "data",
        "api",
      ],
      storeNames: ["ui", "chat", "agent", "sidecar", "dialog", "gallery", "encounter", "gameState", "backfill"],
      moduleSpecifiers: [
        "react",
        "react/jsx-runtime",
        "react-dom",
        "react-dom/client",
        "@tanstack/react-query",
        "zustand",
        "zustand/middleware",
        "sonner",
        "zod",
        "i18next",
        "react-i18next",
        "framer-motion",
        "tailwind-merge",
        "clsx",
      ],
      liveStores: {
        ui: true,
        chat: true,
        agent: true,
        sidecar: true,
        dialog: true,
        gallery: true,
        encounter: true,
        gameState: true,
        backfill: true,
      },
      hostModules: { tts: true, dialogs: true, api: true, emojiCatalog: true, Modal: true },
      appQueryClient: true,
      samples: {
        react: "function",
        "react/jsx-runtime": "function",
        "react-dom": "function",
        "react-dom/client": "function",
        "@tanstack/react-query": "function",
        zustand: "function",
        "zustand/middleware": "function",
        sonner: "function",
        zod: "object",
        i18next: "function",
        "react-i18next": "function",
        "framer-motion": "function",
        "tailwind-merge": "function",
        clsx: "function",
      },
      property: { writable: false, configurable: false },
      unchanged: true,
      frozen: true,
    });
  });

  test("a package reading the chat store follows the open chat and the reply stream", async ({ page, request }) => {
    test.setTimeout(120_000);
    const suffix = Date.now().toString(36);
    const heldReplies = new Set<ServerResponse>();
    const providerServer = createServer((incoming, response) => {
      incoming.resume();
      incoming.on("end", () => {
        if (incoming.method !== "POST" || incoming.url !== "/v1/chat/completions") {
          response.writeHead(404, { "content-type": "application/json" });
          response.end(JSON.stringify({ error: "Unexpected host-namespace provider request" }));
          return;
        }
        response.writeHead(200, {
          "content-type": "text/event-stream",
          connection: "close",
          "cache-control": "no-cache",
        });
        response.write(
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "Still replying" }, finish_reason: null }] })}\n\n`,
        );
        // The reply streams until the test lets it finish.
        heldReplies.add(response);
      });
    });
    await new Promise<void>((resolve) => providerServer.listen(0, "127.0.0.1", resolve));
    const finishReplies = () => {
      for (const response of heldReplies) {
        response.end(
          [
            `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "." }, finish_reason: "stop" }] })}`,
            "data: [DONE]",
            "",
          ].join("\n\n"),
        );
      }
      heldReplies.clear();
    };

    const chatIds: string[] = [];
    let characterId = "";
    let connectionId = "";
    try {
      const address = providerServer.address();
      if (!address || typeof address === "string") throw new Error("The host-namespace provider did not bind");
      const connection = await request.post("/api/connections", {
        data: {
          name: `Host Namespace Provider ${suffix}`,
          provider: "custom",
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          apiKey: "e2e-host-namespace",
          model: "host-namespace-model",
          maxContext: 32_768,
        },
      });
      expect(connection.ok(), await connection.text()).toBeTruthy();
      connectionId = ((await connection.json()) as { id: string }).id;
      const character = await request.post("/api/characters", {
        data: { data: { name: `Namespace Reader ${suffix}`, description: "Answers in one line." } },
      });
      expect(character.ok(), await character.text()).toBeTruthy();
      characterId = ((await character.json()) as { id: string }).id;
      for (const name of ["First", "Second"]) {
        const created = await request.post("/api/chats", {
          data: {
            name: `${name} namespace chat ${suffix}`,
            mode: "conversation",
            characterIds: [characterId],
            connectionId,
          },
        });
        expect(created.ok(), await created.text()).toBeTruthy();
        const chatId = ((await created.json()) as { id: string }).id;
        chatIds.push(chatId);
        const metadata = await request.patch(`/api/chats/${chatId}/metadata`, {
          data: { conversationSetupComplete: true, enableAgents: false },
        });
        expect(metadata.ok(), await metadata.text()).toBeTruthy();
      }
      const [firstChatId, secondChatId] = chatIds as [string, string];

      await openPackagePage(page, {
        sidebarOpen: true,
        chatHelpSeenModes: ["roleplay", "conversation", "game"],
        chatSettingsMoveTipDismissed: true,
      });
      await page.addInitScript((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), firstChatId);
      await page.goto("/");
      await waitForPackageClient(page);
      await expect.poll(async () => (await chatSeen(page)).at(-1)?.activeChatId).toBe(firstChatId);

      // The user opens the other chat from the sidebar; the package sees it without a reload.
      const sidebar = page.locator('[data-component="ChatSidebar"]');
      await sidebar.locator('[data-tour="chat-mode-conversation"]').click();
      await sidebar.locator(`[data-chat-id="${secondChatId}"]`).click();
      await expect.poll(async () => (await chatSeen(page)).at(-1)?.activeChatId).toBe(secondChatId);

      await page.locator('textarea[placeholder*="/ for commands"]').fill("Are you there?");
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await expect
        .poll(async () => (await chatSeen(page)).at(-1))
        .toEqual({ activeChatId: secondChatId, isStreaming: true, streamingChatId: secondChatId });
      await expect.poll(() => heldReplies.size).toBe(1);
      finishReplies();
      await expect.poll(async () => (await chatSeen(page)).at(-1)?.isStreaming).toBe(false);
      await expect(page.getByText("Still replying.")).toBeVisible();

      const writes = await engineStorageWrites(page);
      // The Engine itself saved the open chat; the check below would see a package that wrote it.
      expect(
        writes.some(
          (write) => write.key === "marinara-active-chat-id" && write.caller.includes("/src/stores/chat.store.ts"),
        ),
      ).toBe(true);
      expect(writes.filter((write) => write.caller.includes(packageClientPath(PACKAGE_ID)))).toEqual([]);
    } finally {
      finishReplies();
      await Promise.allSettled(chatIds.map((chatId) => request.delete(`/api/chats/${chatId}`)));
      if (characterId) await request.delete(`/api/characters/${characterId}`).catch(() => undefined);
      if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
      await new Promise<void>((resolve) => providerServer.close(() => resolve()));
    }
  });

  test("an app dialog a package opens shows above the package's own overlay", async ({ page }) => {
    await openPackagePage(page);
    await page.goto("/");
    await waitForPackageClient(page);
    // A package screen on its own layer, as World Maps (10020) and Slurp sheets (10000-10001) use.
    await page.evaluate(() => {
      const overlay = document.createElement("div");
      overlay.dataset.testid = "e2e-package-overlay";
      overlay.style.cssText = "position: fixed; inset: 0; z-index: 10020; background: rgb(0 0 0 / 0.4);";
      document.body.append(overlay);
      const host = (
        globalThis as {
          __MARINARA_HOST__?: {
            services: { dialogs: { showConfirmDialog(options: { title: string; message: string }): Promise<boolean> } };
          };
        }
      ).__MARINARA_HOST__!;
      void host.services.dialogs
        .showConfirmDialog({ title: "Package question", message: "Keep this package's change?" })
        .then((answer) => Object.assign(globalThis, { __e2eDialogAnswer: answer }));
    });

    const dialog = page.getByRole("dialog", { name: "Package question" });
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    expect(
      await dialog.evaluate((element) => {
        const confirm = [...element.querySelectorAll("button")].find(
          (button) => button.textContent?.trim() === "Confirm",
        );
        const box = confirm!.getBoundingClientRect();
        return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      }),
    ).toBe(true);
    // Playwright's click also fails when the overlay would take the press.
    await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => (globalThis as { __e2eDialogAnswer?: boolean }).__e2eDialogAnswer))
      .toBe(true);
  });
});
