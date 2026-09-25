import type { BrowserContext, Page } from "@playwright/test";
import type { pickPersistedUIState } from "../packages/client/src/stores/ui.store.js";
import { UI_PERSISTENCE } from "../packages/client/src/lib/ui-persistence.js";

type PersistedUIState = ReturnType<typeof pickPersistedUIState>;

/** Seed current persisted preferences. Migration tests should keep their explicit legacy payloads. */
export async function seedUIState(
  page: Page | BrowserContext,
  state: Partial<PersistedUIState>,
  mode: "replace" | "merge" | "if-missing" = "replace",
) {
  await page.addInitScript(
    ({ name, version, state, mode }) => {
      const stored = localStorage.getItem(name);
      if (mode === "if-missing" && stored) return;
      let previous = {};
      if (mode === "merge" && stored) {
        try {
          previous = JSON.parse(stored).state;
        } catch {
          // A fresh fixture can replace malformed browser-local preferences.
        }
      }
      localStorage.setItem(name, JSON.stringify({ state: { ...previous, ...state }, version }));
    },
    // Surprise visits are random, interactive overlays, not part of unrelated UI proofs.
    { ...UI_PERSISTENCE, state: { chibiProfessorMariEnabled: false, ...state }, mode },
  );
}
