// ──────────────────────────────────────────────
// The client host namespace agent packages use (globalThis.__MARINARA_HOST__)
// ──────────────────────────────────────────────
// Package clients take the Engine's live stores, services and libraries from here instead of bundling copies of them
// (docs/development/optional-agent-packages.md, "Host client namespace"). This module is the published contract:
// types and constant lists only, with no runtime import, so a regression and package tooling can read it.
// The namespace only grows. A later member gets a capability API minor; `version` changes only when the shape breaks.
import type { QueryClient } from "@tanstack/react-query";
import type { useUIStore } from "../stores/ui.store";
import type { useChatStore } from "../stores/chat.store";
import type { useAgentStore } from "../stores/agent.store";
import type { useSidecarStore } from "../stores/sidecar.store";
import type { useDialogStore } from "../stores/dialog.store";
import type { useGalleryStore } from "../stores/gallery.store";
import type { useEncounterStore } from "../stores/encounter.store";
import type { useGameStateStore } from "../stores/game-state.store";
import type { useRollingBackfillStore } from "../stores/backfill.store";

export const MARINARA_HOST_VERSION = 1 as const;

/** Bare specifiers a package build may take from the host. Order is documentation only. */
export const MARINARA_HOST_MODULE_SPECIFIERS = [
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
] as const;
export type MarinaraHostModuleSpecifier = (typeof MARINARA_HOST_MODULE_SPECIFIERS)[number];

export const MARINARA_HOST_STORE_NAMES = [
  "ui",
  "chat",
  "agent",
  "sidecar",
  "dialog",
  "gallery",
  "encounter",
  "gameState",
  "backfill",
] as const;
export type MarinaraHostStoreName = (typeof MARINARA_HOST_STORE_NAMES)[number];

/**
 * Major versions of the host modules, which packages are built against. They must match packages/client/package.json,
 * and changing one requires a capability API major (scripts/regressions/marinara-host-namespace.regression.ts).
 */
export const MARINARA_HOST_MODULE_MAJORS = {
  react: 19,
  "react-dom": 19,
  "@tanstack/react-query": 5,
  zustand: 5,
  sonner: 2,
  zod: 3,
  i18next: 26,
  "react-i18next": 17,
  "framer-motion": 13,
  "tailwind-merge": 3,
  clsx: 2,
} as const;

/** Engine-owned browser storage. Packages may read these keys; they never write or remove them. */
export const MARINARA_HOST_ENGINE_STORAGE_KEYS = [
  "marinara-engine-ui",
  "marinara-engine-ui:host",
  "marinara-active-chat-id",
  "marinara-input-drafts",
  "marinara-pending-spatial-transitions",
  "marinara-pinned-gallery-images",
  "marinara_sidecar_prompted",
] as const;
/** Engine-owned IndexedDB database. Packages never open it. */
export const MARINARA_HOST_ENGINE_INDEXED_DB = "marinara-tts-audio-cache" as const;

export interface MarinaraHostV1 {
  readonly version: 1;
  /** The Engine's supportedCapabilityApi, e.g. { major: 1, minor: 341 }. */
  readonly capabilityApi: { readonly major: number; readonly minor: number };
  readonly stores: {
    readonly ui: typeof useUIStore;
    /** Includes the pending spatial transition slice (pendingSpatialTransitions,
     *  setPendingSpatialTransition, clearPendingSpatialTransition, setPendingSpatialTransitionStatus). */
    readonly chat: typeof useChatStore;
    readonly agent: typeof useAgentStore;
    readonly sidecar: typeof useSidecarStore;
    readonly dialog: typeof useDialogStore;
    readonly gallery: typeof useGalleryStore;
    readonly encounter: typeof useEncounterStore;
    readonly gameState: typeof useGameStateStore;
    readonly backfill: typeof useRollingBackfillStore;
  };
  readonly services: {
    /** The module namespace of lib/tts-service.ts (ttsService, playWhenAvailable, ...). */
    readonly tts: typeof import("./tts-service");
    /** The module namespace of lib/app-dialogs.ts (showAlertDialog, showConfirmDialog, ...). */
    readonly dialogs: typeof import("./app-dialogs");
  };
  /** Module namespace objects (`import * as m from spec`), including `default` where the library has one. */
  readonly modules: { readonly [K in MarinaraHostModuleSpecifier]: Readonly<Record<string, unknown>> };
  /** The one QueryClient the Engine renders with. */
  readonly queryClient: QueryClient;
  readonly components: { readonly Modal: typeof import("../components/ui/Modal").Modal };
  readonly data: { readonly emojiCatalog: typeof import("./emoji-catalog.generated") };
  /** The module namespace of lib/api-client.ts (api, ApiError, getApiErrorMessage, ...). */
  readonly api: typeof import("./api-client");
}

/**
 * Store fields published packages read today, measured from their bundles. `MarinaraHostStoreFields` pins each one
 * with a `Pick<>`, so the client build fails when the Engine drops or renames one: that needs a capability API major.
 * Noodle's `openCharacter` comes from its own capability props, not from the UI store, so it is not listed.
 */
export const MARINARA_HOST_STORE_FIELDS = {
  ui: [
    "achievementsEnabled",
    "debugMode",
    "includeReasoningInExports",
    "enableStreaming",
    "userStatus",
    "enterToSendConvo",
    "conversationCallVoiceVolume",
    "conversationCallVoiceMuted",
    "setConversationCallVoiceVolume",
    "setConversationCallVoiceMuted",
    "conversationTimeZone",
    "noodleNavigation",
    "setNoodleNavigation",
    "noodleSelectedPersonaId",
    "setNoodleSelectedPersonaId",
    "reviewImagePromptsBeforeSend",
    "musicPlayerEnabled",
    "musicPlayerSource",
    "sidebarOpen",
    "setSidebarOpen",
    "chatBackground",
    "setChatBackground",
    "characterDetailId",
    "lorebookDetailId",
    "presetDetailId",
    "connectionDetailId",
    "agentDetailId",
    "toolDetailId",
    "personaDetailId",
    "regexDetailId",
    "characterLibraryOpen",
    "botBrowserOpen",
    "gameAssetsBrowserOpen",
    "modal",
    "rightPanelOpen",
    "closeModal",
    "closeRightPanel",
    "closeBotBrowser",
    "closeAllDetails",
  ],
  chat: [
    "activeChatId",
    "activeChat",
    "isStreaming",
    "streamingChatId",
    "abortControllers",
    "reset",
    "pendingSpatialTransitions",
    "setPendingSpatialTransition",
    "clearPendingSpatialTransition",
    "setPendingSpatialTransitionStatus",
  ],
  agent: ["setYoutubePlay", "reset"],
  sidecar: ["modelDownloaded", "modelDisplayName", "fetchStatus"],
  dialog: ["dialog", "openDialog", "closeDialog"],
  gallery: ["pinImage", "pinVideo"],
  encounter: ["reset"],
  gameState: ["current", "setGameState", "reset"],
  backfill: ["resetBackfill"],
} as const satisfies { readonly [K in MarinaraHostStoreName]: readonly string[] };

type StoreState<T extends { getState: () => unknown }> = ReturnType<T["getState"]>;
type Fields<K extends MarinaraHostStoreName> = (typeof MARINARA_HOST_STORE_FIELDS)[K][number];

export interface MarinaraHostStoreFields {
  readonly ui: Pick<StoreState<typeof useUIStore>, Fields<"ui">>;
  readonly chat: Pick<StoreState<typeof useChatStore>, Fields<"chat">>;
  readonly agent: Pick<StoreState<typeof useAgentStore>, Fields<"agent">>;
  readonly sidecar: Pick<StoreState<typeof useSidecarStore>, Fields<"sidecar">>;
  readonly dialog: Pick<StoreState<typeof useDialogStore>, Fields<"dialog">>;
  readonly gallery: Pick<StoreState<typeof useGalleryStore>, Fields<"gallery">>;
  readonly encounter: Pick<StoreState<typeof useEncounterStore>, Fields<"encounter">>;
  readonly gameState: Pick<StoreState<typeof useGameStateStore>, Fields<"gameState">>;
  readonly backfill: Pick<StoreState<typeof useRollingBackfillStore>, Fields<"backfill">>;
}

declare global {
  var __MARINARA_HOST__: MarinaraHostV1 | undefined;
}
