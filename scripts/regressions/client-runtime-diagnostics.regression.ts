import assert from "node:assert/strict";
import {
  getClientRuntimeDiagnostics,
  recordClientError,
  recordClientReload,
  recordClientRuntimeEvent,
  registerClientRuntimeDiagnostics,
} from "../../packages/client/src/lib/client-runtime-diagnostics.js";
import {
  forceRefreshSpa,
  registerPreloadErrorRecovery,
  reloadBrowser,
} from "../../packages/client/src/lib/browser-runtime.js";
import { formatSupportDiagnostics } from "../../packages/client/src/lib/support-diagnostics.js";

const key = "marinara-client-runtime-events";
const privateText = "PRIVATE_PROMPT_AND_CHAT_TEXT";
const data = new Map<string, string>();
let writes = 0;
let storageThrows = false;
let writeThrows = false;
let stop: (() => void) | undefined;
const storage = {
  getItem(name: string) {
    if (storageThrows) throw new Error("storage blocked");
    return data.get(name) ?? null;
  },
  setItem(name: string, value: string) {
    writes++;
    if (storageThrows || writeThrows) throw new Error("storage full");
    data.set(name, value);
  },
};
const documentStub = Object.assign(new EventTarget(), {
  visibilityState: "visible",
  getElementById: () => ({ getBoundingClientRect: () => ({ height: 800, top: 0 }) }),
});
const navigations: string[] = [];
const windowStub = Object.assign(new EventTarget(), {
  innerHeight: 800,
  visualViewport: { height: 500, offsetTop: 12 },
  matchMedia: () => ({ matches: true }),
  location: {
    href: "https://example.test/",
    reload() {
      assert.equal(getClientRuntimeDiagnostics().events.at(-1)?.kind, "reload-requested");
      navigations.push("reload");
    },
    replace(url: string) {
      assert.equal(getClientRuntimeDiagnostics().events.at(-1)?.kind, "reload-requested");
      navigations.push(url);
    },
  },
});
const stubs = {
  window: windowStub,
  document: documentStub,
  localStorage: storage,
  sessionStorage: {
    getItem: (name: string) => data.get(name) ?? null,
    setItem: (name: string, value: string) => data.set(name, value),
  },
  navigator: { standalone: true },
  performance: { getEntriesByType: () => [{ type: "reload" }] },
};
const previous = Object.fromEntries(
  Object.keys(stubs).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
);
for (const [name, value] of Object.entries(stubs))
  Object.defineProperty(globalThis, name, { configurable: true, value });
const start = () => {
  stop?.();
  stop = registerClientRuntimeDiagnostics("2.4.5+abcd1234");
};

try {
  // Old-page observations survive reopening. Unknown stored fields never do.
  data.set(
    key,
    JSON.stringify([
      {
        at: 1,
        page: "old-page",
        build: "2.4.5+old",
        kind: "reload-requested",
        reason: "chunk-recovery",
        secret: privateText,
      },
    ]),
  );
  start();
  const first = getClientRuntimeDiagnostics();
  assert.equal(first.events[0]?.reason, "chunk-recovery");
  assert.equal(first.events[0]?.page, "old-page");
  assert.equal(first.build, "2.4.5+abcd1234");
  assert.deepEqual(first.view, [500, 12, 800, 0]);
  assert.equal(first.standalone, true);
  assert.equal(first.navigation, "reload");
  assert.equal(first.persistence, "local");
  assert.ok(!JSON.stringify(first).includes(privateText));
  assert.equal(registerClientRuntimeDiagnostics("duplicate-registration"), stop, "registration is idempotent");

  const error = new TypeError(`${privateText}: Minified React error #185`);
  error.stack = `TypeError: ${privateText}\n at render (https://private-host.test/assets/ChatArea-abc123.js:1:42)\n at /private/${privateText}.js`;
  recordClientError("render-error", error);
  const captured = getClientRuntimeDiagnostics().events.at(-1);
  assert.equal(captured?.error, "TypeError");
  assert.equal(captured?.reactCode, 185);
  assert.equal(captured?.asset, "ChatArea-abc123.js:1:42");
  const beforeDuplicates = writes;
  for (let index = 0; index < 1000; index++) recordClientError("render-error", error);
  assert.equal(writes, beforeDuplicates, "duplicate error storms cannot write on every rejection");
  windowStub.dispatchEvent(Object.assign(new Event("error"), { error }));
  windowStub.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: error }));
  assert.ok(getClientRuntimeDiagnostics().events.some((event) => event.kind === "javascript-error"));
  assert.ok(getClientRuntimeDiagnostics().events.some((event) => event.kind === "promise-error"));

  const hostileError = new Error();
  Object.defineProperty(hostileError, "name", {
    get() {
      throw new Error(privateText);
    },
  });
  assert.doesNotThrow(() => recordClientError("render-error", hostileError));
  recordClientRuntimeEvent("message-edited");
  recordClientRuntimeEvent("image-arrived");
  documentStub.visibilityState = "hidden";
  documentStub.dispatchEvent(new Event("visibilitychange"));
  windowStub.dispatchEvent(new Event("pagehide"));
  const firstPage = getClientRuntimeDiagnostics().page;
  start();
  assert.notEqual(getClientRuntimeDiagnostics().page, firstPage);
  assert.ok(
    getClientRuntimeDiagnostics().events.some((event) => event.page === firstPage && event.kind === "page-hide"),
  );
  assert.ok(getClientRuntimeDiagnostics().events.some((event) => event.kind === "message-edited"));
  assert.ok(!JSON.stringify(getClientRuntimeDiagnostics()).includes(privateText));
  assert.ok(!JSON.stringify(getClientRuntimeDiagnostics()).includes("private-host"));

  // Existing full reloads are marked before navigating, without new reloads.
  const beforeReload = navigations.length;
  reloadBrowser("render-recovery");
  await forceRefreshSpa({ reason: "version-update", queryParamKey: "v", queryParamValue: "new" });
  assert.equal(navigations.length, beforeReload + 2);
  assert.equal(navigations.at(-1), "https://example.test/?v=new");
  assert.equal(getClientRuntimeDiagnostics().events.at(-1)?.reason, "version-update");

  registerPreloadErrorRecovery();
  const preload = Object.assign(new Event("vite:preloadError", { cancelable: true }), { payload: error });
  windowStub.dispatchEvent(preload);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(preload.defaultPrevented, true);
  assert.equal(getClientRuntimeDiagnostics().events.at(-1)?.reason, "chunk-recovery");
  const recovered = navigations.length;
  const repeated = new Event("vite:preloadError", { cancelable: true });
  windowStub.dispatchEvent(repeated);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(repeated.defaultPrevented, false, "the existing preload cooldown still exposes repeated failures");
  assert.equal(navigations.length, recovered);

  // Bounded history, malformed/oversized storage, and no inferred crash cause.
  for (let index = 0; index < 30; index++) recordClientRuntimeEvent("message-edited");
  assert.equal(getClientRuntimeDiagnostics().events.length, 16);
  data.set(key, "malformed");
  start();
  assert.equal(getClientRuntimeDiagnostics().events.length, 1);
  assert.equal(getClientRuntimeDiagnostics().persistence, "local");
  data.set(key, "x".repeat(20_000));
  start();
  assert.equal(getClientRuntimeDiagnostics().events.length, 1);
  assert.equal(getClientRuntimeDiagnostics().navigation, "reload");
  assert.ok(!getClientRuntimeDiagnostics().events.some((event) => event.kind === "reload-requested"));

  // Full/blocked storage retains current-page observations in memory and never
  // prevents recovery; it explicitly cannot promise previous-page persistence.
  writeThrows = true;
  recordClientReload("settings-refresh");
  assert.equal(getClientRuntimeDiagnostics().persistence, "unavailable");
  assert.equal(getClientRuntimeDiagnostics().events.at(-1)?.reason, "settings-refresh");
  assert.doesNotThrow(() => reloadBrowser("render-recovery"));
  storageThrows = true;
  start();
  assert.equal(getClientRuntimeDiagnostics().persistence, "unavailable");
  assert.equal(getClientRuntimeDiagnostics().events.at(-1)?.kind, "page-start");
  const report = formatSupportDiagnostics({
    version: "2.4.5",
    build: "2.4.5+different-server",
    commit: "different-server",
    serverOs: "Linux",
    clientOs: "iOS",
    browser: "synthetic",
    gpu: "synthetic",
    connectionName: null,
    connectionProvider: null,
    model: null,
    clientRuntime: getClientRuntimeDiagnostics(),
  });
  assert.ok(report.includes("2.4.5+different-server"));
  assert.ok(report.includes('"build":"2.4.5+abcd1234"'));
  assert.ok(report.includes('"persistence":"unavailable"'));
  assert.ok(!report.includes(privateText));
  console.info(
    "Client diagnostics: bounded persistence, reload markers, error deduplication, privacy and unavailable-storage proofs passed.",
  );
} finally {
  stop?.();
  for (const name of Object.keys(stubs)) {
    const descriptor = previous[name];
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
}
