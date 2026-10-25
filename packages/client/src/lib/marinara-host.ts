// ──────────────────────────────────────────────
// Sets globalThis.__MARINARA_HOST__ before any agent package client loads
// ──────────────────────────────────────────────
// Package clients use the Engine's own stores, services and libraries from this namespace instead of bundling copies
// that keep their own state (docs/development/optional-agent-packages.md, "Host client namespace"). The shape is
// marinara-host-contract.ts. The package loader (use-capability-packages.ts) loads this module with import() before
// its first package client, so an Engine without packages never loads it and startup does not wait for it.
import * as tanstackReactQuery from "@tanstack/react-query";
import * as clsx from "clsx";
import * as motion14 from "framer-motion";
import * as framerMotion from "framer-motion-v13";
import * as i18next from "i18next";
import * as react from "react";
import * as reactJsxRuntime from "react/jsx-runtime";
import * as reactDom from "react-dom";
import * as reactDomClient from "react-dom/client";
import * as reactI18next from "react-i18next";
import * as sonner from "sonner";
import * as tailwindMerge from "tailwind-merge";
import * as zod from "zod-v3";
import * as zustand from "zustand";
import * as zustandMiddleware from "zustand/middleware";
import { supportedCapabilityApi } from "@marinara-engine/shared";
import { Modal } from "../components/ui/Modal";
import { useAgentStore } from "../stores/agent.store";
import { useRollingBackfillStore } from "../stores/backfill.store";
import { useChatStore } from "../stores/chat.store";
import { useDialogStore } from "../stores/dialog.store";
import { useEncounterStore } from "../stores/encounter.store";
import { useGalleryStore } from "../stores/gallery.store";
import { useGameStateStore } from "../stores/game-state.store";
import { useSidecarStore } from "../stores/sidecar.store";
import { useUIStore } from "../stores/ui.store";
import * as api from "./api-client";
import * as audio from "./audio-service";
import * as dialogs from "./app-dialogs";
import * as emojiCatalog from "./emoji-catalog.generated";
import {
  MARINARA_HOST_MODULE_SPECIFIERS,
  MARINARA_HOST_STORE_NAMES,
  MARINARA_HOST_VERSION,
  type MarinaraHostV1,
} from "./marinara-host-contract";
import { queryClient } from "./query-client";
import * as tts from "./tts-service";

function assertKeys(member: string, actual: object, expected: readonly string[]) {
  const keys = Object.keys(actual);
  if (keys.join() !== expected.join()) {
    throw new Error(`__MARINARA_HOST__.${member} must list ${expected.join(", ")}; it lists ${keys.join(", ")}.`);
  }
}

function defineMarinaraHost(): MarinaraHostV1 {
  const stores = Object.freeze({
    ui: useUIStore,
    chat: useChatStore,
    agent: useAgentStore,
    sidecar: useSidecarStore,
    dialog: useDialogStore,
    gallery: useGalleryStore,
    encounter: useEncounterStore,
    gameState: useGameStateStore,
    backfill: useRollingBackfillStore,
  });
  // Each value is the namespace of its MARINARA_HOST_MODULE_IMPORTS dependency, so a package shares the
  // Engine's one React, React Query, zustand and toast state.
  const modules = Object.freeze({
    react,
    "react/jsx-runtime": reactJsxRuntime,
    "react-dom": reactDom,
    "react-dom/client": reactDomClient,
    "@tanstack/react-query": tanstackReactQuery,
    zustand,
    "zustand/middleware": zustandMiddleware,
    sonner,
    zod,
    i18next,
    "react-i18next": reactI18next,
    "framer-motion": framerMotion,
    "motion/react": motion14,
    "tailwind-merge": tailwindMerge,
    clsx,
  });
  if (import.meta.env.DEV) {
    assertKeys("stores", stores, MARINARA_HOST_STORE_NAMES);
    assertKeys("modules", modules, MARINARA_HOST_MODULE_SPECIFIERS);
  }

  const host = Object.freeze({
    version: MARINARA_HOST_VERSION,
    capabilityApi: supportedCapabilityApi,
    stores,
    services: Object.freeze({ tts, dialogs, audio }),
    modules,
    queryClient,
    components: Object.freeze({ Modal }),
    data: Object.freeze({ emojiCatalog }),
    api,
  }) satisfies MarinaraHostV1;
  Object.defineProperty(globalThis, "__MARINARA_HOST__", {
    value: host,
    writable: false,
    configurable: false,
    enumerable: false,
  });
  return host;
}

let hostReady: Promise<MarinaraHostV1> | null = null;

/**
 * Defines `globalThis.__MARINARA_HOST__` once and resolves with it; every call returns the same promise. A dev reload
 * of this module finds the namespace an earlier copy defined, which can never be replaced.
 */
export function ensureMarinaraHost(): Promise<MarinaraHostV1> {
  hostReady ??= new Promise((resolve) => resolve(globalThis.__MARINARA_HOST__ ?? defineMarinaraHost()));
  return hostReady;
}
