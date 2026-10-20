import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/** Keeps a page's proof local: no What's New prompt, and no server copy of the synced UI settings. */
export async function preparePackagePage(page: Page) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: null } }));
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), APP_VERSION);
}

/** The URL the Engine imports a package client from; it appears in the stack of everything that client runs. */
export function packageClientPath(packageId: string) {
  return `/api/capability-packages/${packageId}/client`;
}

/**
 * Installs one package whose client module is `body`, through routed API responses only (nothing reaches the server).
 * The client registers its element and counts its loads in `globalThis.__e2ePackageLoads`.
 */
export async function installPackageClient(page: Page, packageId: string, body: string) {
  const manifest = {
    schemaVersion: 1,
    id: packageId,
    name: "Host Namespace Fixture",
    version: "1.0.0",
    description: "Host namespace fixture.",
    engine: { min: "2.3.0", maxExclusive: "4.0.0" },
    kind: ["agent"],
    entrypoints: { agents: "agents.json", client: "client.js" },
    files: [{ path: "client.js", sha256: "0".repeat(64), bytes: 1 }],
    permissions: ["ui"],
    restartRequired: false,
  };
  await page.route("**/api/capability-packages/installed", (route) =>
    route.fulfill({
      json: [
        {
          id: packageId,
          version: manifest.version,
          manifest,
          installedAt: "2026-10-01T00:00:00.000Z",
          status: "active",
          error: null,
          readiness: "ready",
          readinessError: null,
          legacy: false,
        },
      ],
    }),
  );
  await page.route(`**${packageClientPath(packageId)}?*`, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `${body}
customElements.get("marinara-capability-${packageId}") ||
  customElements.define("marinara-capability-${packageId}", class extends HTMLElement {});
globalThis.__e2ePackageLoads = (globalThis.__e2ePackageLoads ?? 0) + 1;`,
    }),
  );
}

export async function waitForPackageClient(page: Page) {
  await expect
    .poll(() => page.evaluate(() => (globalThis as { __e2ePackageLoads?: number }).__e2ePackageLoads))
    .toBe(1);
}

export interface StorageWrite {
  area: "local" | "session";
  method: "setItem" | "removeItem";
  key: string;
  /** The stack frame that called setItem or removeItem: the code that wrote the key itself. */
  caller: string;
}

/**
 * Records every localStorage and sessionStorage write of each page, with the frame that made it. A package that
 * changes a setting through the Engine's store leaves a write whose caller is the Engine's store; a package that
 * writes an Engine key itself leaves one whose caller is its own client URL.
 */
export async function recordStorageWrites(page: Page) {
  await page.addInitScript(() => {
    const writes: unknown[] = [];
    Object.defineProperty(globalThis, "__e2eStorageWrites", { value: writes });
    const callerOf = (stack: string | undefined) => {
      const frames = (stack ?? "").split("\n").slice(1);
      const wrapper = frames.findIndex((frame) => frame.includes("__e2eRecordedStorage"));
      return frames[wrapper + 1]?.trim() ?? "";
    };
    const { setItem, removeItem } = Storage.prototype;
    const areaOf = (storage: Storage) => (storage === globalThis.sessionStorage ? "session" : "local");
    Storage.prototype.setItem = function __e2eRecordedStorageSetItem(this: Storage, key: string, value: string) {
      writes.push({ area: areaOf(this), method: "setItem", key, caller: callerOf(new Error().stack) });
      return setItem.call(this, key, value);
    };
    Storage.prototype.removeItem = function __e2eRecordedStorageRemoveItem(this: Storage, key: string) {
      writes.push({ area: areaOf(this), method: "removeItem", key, caller: callerOf(new Error().stack) });
      return removeItem.call(this, key);
    };
  });
}

/** The recorded writes to Engine-owned keys (docs: "Engine-owned browser storage") since the page loaded. */
export function engineStorageWrites(page: Page): Promise<StorageWrite[]> {
  return page.evaluate(async () => {
    // The contract module is read in the page: its types reach React components the e2e project does not compile.
    const { MARINARA_HOST_ENGINE_STORAGE_KEYS } = (await import("/src/lib/marinara-host-contract.ts" as string)) as {
      MARINARA_HOST_ENGINE_STORAGE_KEYS: readonly string[];
    };
    const writes = (globalThis as { __e2eStorageWrites?: StorageWrite[] }).__e2eStorageWrites ?? [];
    return writes.filter((write) => MARINARA_HOST_ENGINE_STORAGE_KEYS.includes(write.key));
  });
}
