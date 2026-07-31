import { useEffect } from "react";
import {
  CSRF_HEADER,
  CSRF_HEADER_VALUE,
  type PersonalClientExtensionRuntime,
  type PersonalExtensionCharacterSnapshot,
  type PersonalExtensionContextSnapshot,
  type PersonalExtensionPersonaSnapshot,
} from "@marinara-engine/shared";
import { usePersonalExtensionRuntime } from "../../hooks/use-personal-extensions";
import {
  createPersonalExtensionContextSnapshot,
  personalExtensionContextKey,
} from "../../lib/personal-extension-context";
import {
  registerPersonalExtensionContribution,
  removePersonalExtensionContribution,
  removePersonalExtensionContributions,
  setPersonalExtensionContributionDispatcher,
} from "../../lib/personal-extension-contributions";
import { useChatStore } from "../../stores/chat.store";

type ActiveClientExtension = {
  contentHash: string;
  extension: PersonalClientExtensionRuntime;
  iframe: HTMLIFrameElement;
};

type FullPageExtensionIdentity = {
  id: string;
  name: string;
  contentHash: string;
};

type FullPageExtensionApi = {
  version: 1;
  extension: Readonly<FullPageExtensionIdentity>;
  log: Readonly<Pick<Console, "debug" | "info" | "warn" | "error">>;
  storage: Readonly<{
    get: () => Promise<Record<string, unknown>>;
    patch: (value: Record<string, unknown>) => Promise<Record<string, unknown>>;
    clear: () => Promise<void>;
  }>;
  setTimeout: (callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => number;
  clearTimeout: (timerId: number) => void;
  setInterval: (callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => number;
  clearInterval: (timerId: number) => void;
  onCleanup: (cleanup: () => unknown) => void;
};

type ActiveFullPageExtension = {
  contentHash: string;
  extension: PersonalClientExtensionRuntime;
  script: HTMLScriptElement;
  style: HTMLLinkElement | null;
  cleanupFns: Array<() => unknown>;
  timeoutIds: Set<number>;
  intervalIds: Set<number>;
};

type FullPageExtensionHostWindow = Window & {
  __marinaraRunFullPageExtension?: (
    identity: FullPageExtensionIdentity,
    main: (api: FullPageExtensionApi) => unknown,
  ) => void;
};

type SandboxMessage = {
  channel?: string;
  type?:
    | "ready"
    | "error"
    | "log"
    | "storage"
    | "ui-window-open"
    | "ui-window-close"
    | "ui-resize"
    | "ui-contribution-register"
    | "ui-contribution-update"
    | "ui-contribution-remove";
  contentHash?: string;
  requestId?: string;
  action?: "get" | "patch" | "delete";
  payload?: unknown;
  contribution?: unknown;
  contributionId?: unknown;
  level?: "debug" | "info" | "warn" | "error";
  args?: unknown[];
  message?: string;
  width?: number;
  height?: number;
};

// The sandbox iframe is a hidden 0×0 element until the extension opens a
// window; then it becomes a small floating panel docked bottom-right. It never
// covers Marinara's page — the rest of the app stays visible and interactive.
function setSandboxIframeHidden(iframe: HTMLIFrameElement) {
  iframe.hidden = true;
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  iframe.removeAttribute("style");
}

function sizeSandboxPanel(iframe: HTMLIFrameElement, width?: number, height?: number) {
  const maxW = Math.max(240, Math.min(window.innerWidth - 32, 420));
  const maxH = Math.round(window.innerHeight * 0.7);
  const w = Math.max(240, Math.min(typeof width === "number" ? width : 340, maxW));
  const h = Math.max(80, Math.min(typeof height === "number" ? height : 240, maxH));
  iframe.hidden = false;
  iframe.removeAttribute("aria-hidden");
  iframe.tabIndex = 0;
  Object.assign(iframe.style, {
    position: "fixed",
    right: "1rem",
    bottom: "1rem",
    top: "auto",
    left: "auto",
    width: `${w}px`,
    height: `${h}px`,
    maxWidth: "calc(100vw - 2rem)",
    maxHeight: "70vh",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
    background: "transparent",
    overflow: "hidden",
    zIndex: "2147483000",
    colorScheme: "normal",
  });
}

// Forward Marinara's resolved accent/surface colors so the in-iframe window
// matches the current theme. Only color strings cross the boundary.
function postSandboxTheme(iframe: HTMLIFrameElement) {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  iframe.contentWindow?.postMessage(
    {
      channel: "marinara-personal-extension",
      type: "ui-theme",
      theme: {
        accent: read("--primary", "#a855f7"),
        accentText: read("--primary-foreground", "#ffffff"),
        surface: read("--card", "#18181b"),
        text: read("--foreground", "#f4f4f5"),
        border: read("--border", "rgba(127,127,127,0.35)"),
        muted: read("--secondary", "rgba(127,127,127,0.15)"),
      },
    },
    "*",
  );
}

function readPersonalExtensionContext(): PersonalExtensionContextSnapshot {
  const { activeChatId, activeChat } = useChatStore.getState();
  const characterIds = activeChatId && activeChat?.id === activeChatId ? activeChat.characterIds : [];
  const personaId = activeChatId && activeChat?.id === activeChatId ? activeChat.personaId : null;
  return createPersonalExtensionContextSnapshot(activeChatId, characterIds, personaId);
}

function sendSandboxContext(active: ActiveClientExtension, context: PersonalExtensionContextSnapshot) {
  const canReadPersona = active.extension.capabilities.includes("read_active_persona");
  active.iframe.contentWindow?.postMessage(
    {
      channel: "marinara-personal-extension",
      type: "context-update",
      contentHash: active.contentHash,
      context: {
        ...context,
        personaId: canReadPersona ? context.personaId : null,
        persona: canReadPersona ? context.persona : null,
      },
    },
    "*",
  );
}

async function postSandboxContext(active: ActiveClientExtension, context = readPersonalExtensionContext()) {
  sendSandboxContext(active, context);
  if (
    !context.chatId ||
    !active.extension.capabilities.some(
      (capability) => capability === "read_active_characters" || capability === "read_active_persona",
    )
  ) {
    return;
  }
  try {
    const response = await extensionFetch(active.extension.id, "context", {
      method: "POST",
      body: JSON.stringify({ chatId: context.chatId }),
    });
    if (!response.ok) throw new Error(`Context read failed (${response.status})`);
    const records = (await response.json()) as {
      characters?: PersonalExtensionCharacterSnapshot[];
      persona?: PersonalExtensionPersonaSnapshot | null;
    };
    if (
      activeExtensions.get(active.extension.id) !== active ||
      personalExtensionContextKey(readPersonalExtensionContext()) !== personalExtensionContextKey(context)
    ) {
      return;
    }
    sendSandboxContext(active, {
      ...context,
      characters: Array.isArray(records.characters) ? records.characters : [],
      persona: records.persona && typeof records.persona === "object" ? records.persona : null,
    });
  } catch (error) {
    console.warn(`[Personal Extension ${active.extension.name}] active record context could not be loaded`, error);
  }
}

const activeExtensions = new Map<string, ActiveClientExtension>();
const activeFullPageExtensions = new Map<string, ActiveFullPageExtension>();

function extensionFetch(id: string, path: string, init: RequestInit = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    headers.set(CSRF_HEADER, CSRF_HEADER_VALUE);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }
  return fetch(`/api/personal-extensions/${encodeURIComponent(id)}/${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

async function cleanupExtension(id: string) {
  const active = activeExtensions.get(id);
  activeExtensions.delete(id);
  removePersonalExtensionContributions(id);
  if (active) {
    active.iframe.contentWindow?.postMessage({ channel: "marinara-personal-extension", type: "stop" }, "*");
    active.iframe.remove();
  }

  const fullPage = activeFullPageExtensions.get(id);
  activeFullPageExtensions.delete(id);
  if (!fullPage) return;
  fullPage.script.remove();
  fullPage.style?.remove();
  for (const timerId of fullPage.timeoutIds) window.clearTimeout(timerId);
  for (const timerId of fullPage.intervalIds) window.clearInterval(timerId);
  for (const cleanup of fullPage.cleanupFns.reverse()) {
    try {
      await cleanup();
    } catch (error) {
      console.warn(`[Personal Extension ${fullPage.extension.name}] cleanup failed`, error);
    }
  }
  window.dispatchEvent(
    new CustomEvent("marinara-personal-extension-stopped", {
      detail: { id: fullPage.extension.id, contentHash: fullPage.contentHash },
    }),
  );
}

const STORAGE_ACTIONS = new Set<SandboxMessage["action"]>(["get", "patch", "delete"]);
const LOG_LEVELS = new Set<NonNullable<SandboxMessage["level"]>>(["debug", "info", "warn", "error"]);

function createFullPageExtensionApi(active: ActiveFullPageExtension): FullPageExtensionApi {
  const extension = Object.freeze({
    id: active.extension.id,
    name: active.extension.name,
    contentHash: active.contentHash,
  });
  const storage = Object.freeze({
    async get() {
      const response = await extensionFetch(active.extension.id, "storage");
      if (!response.ok) throw new Error(`Storage read failed (${response.status})`);
      return ((await response.json()) as { value?: Record<string, unknown> }).value ?? {};
    },
    async patch(value: Record<string, unknown>) {
      const response = await extensionFetch(active.extension.id, "storage", {
        method: "PATCH",
        body: JSON.stringify(value),
      });
      if (!response.ok) throw new Error(`Storage update failed (${response.status})`);
      return ((await response.json()) as { value?: Record<string, unknown> }).value ?? {};
    },
    async clear() {
      const response = await extensionFetch(active.extension.id, "storage", { method: "DELETE" });
      if (!response.ok) throw new Error(`Storage clear failed (${response.status})`);
    },
  });
  const api: FullPageExtensionApi = {
    version: 1,
    extension,
    log: Object.freeze({
      debug: console.debug.bind(console, `[Personal Extension ${active.extension.name}]`),
      info: console.info.bind(console, `[Personal Extension ${active.extension.name}]`),
      warn: console.warn.bind(console, `[Personal Extension ${active.extension.name}]`),
      error: console.error.bind(console, `[Personal Extension ${active.extension.name}]`),
    }),
    storage,
    setTimeout(callback, delay, ...args) {
      const timerId = window.setTimeout(() => {
        active.timeoutIds.delete(timerId);
        callback(...args);
      }, delay);
      active.timeoutIds.add(timerId);
      return timerId;
    },
    clearTimeout(timerId) {
      active.timeoutIds.delete(timerId);
      window.clearTimeout(timerId);
    },
    setInterval(callback, delay, ...args) {
      const timerId = window.setInterval(callback, delay, ...args);
      active.intervalIds.add(timerId);
      return timerId;
    },
    clearInterval(timerId) {
      active.intervalIds.delete(timerId);
      window.clearInterval(timerId);
    },
    onCleanup(cleanup) {
      if (typeof cleanup !== "function") throw new TypeError("onCleanup requires a function");
      active.cleanupFns.push(cleanup);
    },
  };
  return Object.freeze(api);
}

async function handleStorage(active: ActiveClientExtension, message: SandboxMessage) {
  // Never infer DELETE from an unknown action: a malformed message must be
  // rejected, not silently mapped onto a destructive request.
  if (!message.requestId || !STORAGE_ACTIONS.has(message.action)) {
    active.iframe.contentWindow?.postMessage(
      {
        channel: "marinara-personal-extension",
        type: "storage-result",
        requestId: message.requestId,
        ok: false,
        error: "Storage request was rejected by the host",
      },
      "*",
    );
    return;
  }
  try {
    let value: Record<string, unknown> = {};
    if (message.action === "get") {
      const response = await extensionFetch(active.extension.id, "storage");
      if (!response.ok) throw new Error(`Storage read failed (${response.status})`);
      value = ((await response.json()) as { value?: Record<string, unknown> }).value ?? {};
    } else if (message.action === "patch") {
      const response = await extensionFetch(active.extension.id, "storage", {
        method: "PATCH",
        body: JSON.stringify(message.payload ?? {}),
      });
      if (!response.ok) throw new Error(`Storage update failed (${response.status})`);
      value = ((await response.json()) as { value?: Record<string, unknown> }).value ?? {};
    } else {
      const response = await extensionFetch(active.extension.id, "storage", { method: "DELETE" });
      if (!response.ok) throw new Error(`Storage delete failed (${response.status})`);
    }
    active.iframe.contentWindow?.postMessage(
      {
        channel: "marinara-personal-extension",
        type: "storage-result",
        requestId: message.requestId,
        ok: true,
        value,
      },
      "*",
    );
  } catch (error) {
    active.iframe.contentWindow?.postMessage(
      {
        channel: "marinara-personal-extension",
        type: "storage-result",
        requestId: message.requestId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      "*",
    );
  }
}

export function PersonalExtensionInjector() {
  const { data: extensions = [] } = usePersonalExtensionRuntime();

  useEffect(() => {
    const host = window as FullPageExtensionHostWindow;
    const runFullPageExtension = (
      identity: FullPageExtensionIdentity,
      main: (api: FullPageExtensionApi) => unknown,
    ) => {
      const active =
        identity && typeof identity.id === "string" ? activeFullPageExtensions.get(identity.id) : undefined;
      if (
        !active ||
        identity.contentHash !== active.contentHash ||
        identity.name !== active.extension.name ||
        typeof main !== "function"
      ) {
        throw new Error("Full-page extension identity did not match the approved runtime");
      }
      Promise.resolve()
        .then(() => main(createFullPageExtensionApi(active)))
        .then(async (cleanup) => {
          const stale = activeFullPageExtensions.get(identity.id) !== active;
          if (typeof cleanup === "function") {
            if (stale) {
              try {
                await cleanup();
              } catch (error) {
                console.warn(`[Personal Extension ${active.extension.name}] late cleanup failed`, error);
              }
              return;
            }
            active.cleanupFns.push(() => cleanup());
          }
          if (stale) return;
          window.dispatchEvent(
            new CustomEvent("marinara-personal-extension-ready", {
              detail: { id: identity.id, contentHash: identity.contentHash },
            }),
          );
        })
        .catch((error) => {
          console.error(`[Personal Extension ${active.extension.name}] failed`, error);
          window.dispatchEvent(
            new CustomEvent("marinara-personal-extension-error", {
              detail: {
                id: identity.id,
                contentHash: identity.contentHash,
                message: error instanceof Error ? error.message : String(error),
              },
            }),
          );
        });
    };
    host.__marinaraRunFullPageExtension = runFullPageExtension;
    return () => {
      if (host.__marinaraRunFullPageExtension === runFullPageExtension) {
        delete host.__marinaraRunFullPageExtension;
      }
    };
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      const active = [...activeExtensions.values()].find(
        (candidate) => candidate.iframe.contentWindow === event.source,
      );
      if (!active || event.origin !== "null") return;
      const message = event.data as SandboxMessage;
      if (!message || message.channel !== "marinara-personal-extension") return;
      if (
        (message.type === "ui-contribution-register" || message.type === "ui-contribution-update") &&
        message.contentHash === active.contentHash
      ) {
        registerPersonalExtensionContribution(active.extension, message.contribution);
        return;
      }
      if (message.type === "ui-contribution-remove" && message.contentHash === active.contentHash) {
        removePersonalExtensionContribution(active.extension.id, active.contentHash, message.contributionId);
        return;
      }
      if (message.type === "storage") {
        void handleStorage(active, message);
        return;
      }
      if (message.type === "ui-window-open") {
        sizeSandboxPanel(active.iframe, message.width, message.height);
        postSandboxTheme(active.iframe);
        return;
      }
      if (message.type === "ui-resize") {
        if (!active.iframe.hidden) sizeSandboxPanel(active.iframe, message.width, message.height);
        return;
      }
      if (message.type === "ui-window-close") {
        setSandboxIframeHidden(active.iframe);
        return;
      }
      if (message.type === "log" && LOG_LEVELS.has(message.level as NonNullable<SandboxMessage["level"]>)) {
        const args = Array.isArray(message.args) ? message.args : [];
        console[message.level as NonNullable<SandboxMessage["level"]>](
          `[Personal Extension ${active.extension.name}]`,
          ...args,
        );
        return;
      }
      if (message.type === "ready" && message.contentHash === active.contentHash) {
        window.dispatchEvent(
          new CustomEvent("marinara-personal-extension-ready", {
            detail: { id: active.extension.id, contentHash: active.contentHash },
          }),
        );
        return;
      }
      if (message.type === "error") {
        console.error(`[Personal Extension ${active.extension.name}] failed`, message.message);
        window.dispatchEvent(
          new CustomEvent("marinara-personal-extension-error", {
            detail: {
              id: active.extension.id,
              contentHash: active.contentHash,
              message: message.message ?? "Sandboxed browser extension failed",
            },
          }),
        );
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    let previousContextKey = personalExtensionContextKey(readPersonalExtensionContext());
    return useChatStore.subscribe(() => {
      const context = readPersonalExtensionContext();
      const nextContextKey = personalExtensionContextKey(context);
      if (nextContextKey === previousContextKey) return;
      previousContextKey = nextContextKey;
      for (const active of activeExtensions.values()) void postSandboxContext(active, context);
    });
  }, []);

  useEffect(() => {
    const expected = new Map(extensions.map((extension) => [extension.id, extension]));
    for (const [id, active] of activeExtensions) {
      const next = expected.get(id);
      if (!next || next.executionMode !== "sandboxed" || next.contentHash !== active.contentHash) {
        void cleanupExtension(id);
      }
    }
    for (const [id, active] of activeFullPageExtensions) {
      const next = expected.get(id);
      if (!next || next.executionMode !== "full-page" || next.contentHash !== active.contentHash) {
        void cleanupExtension(id);
      }
    }

    for (const extension of extensions) {
      if (extension.executionMode === "full-page") {
        const active = activeFullPageExtensions.get(extension.id);
        if (active?.contentHash === extension.contentHash) continue;
        const script = document.createElement("script");
        script.src = extension.runtimeUrl;
        script.async = true;
        script.dataset.personalExtensionFullPage = extension.id;
        script.addEventListener("error", () => {
          console.error(`[Personal Extension ${extension.name}] full-page runtime could not be loaded`);
          if (activeFullPageExtensions.get(extension.id)?.script === script) {
            void cleanupExtension(extension.id);
          }
          window.dispatchEvent(
            new CustomEvent("marinara-personal-extension-error", {
              detail: {
                id: extension.id,
                contentHash: extension.contentHash,
                message: "Full-page extension runtime could not be loaded",
              },
            }),
          );
        });
        const style = extension.styleUrl ? document.createElement("link") : null;
        if (style) {
          style.rel = "stylesheet";
          style.href = extension.styleUrl!;
          style.dataset.personalExtensionFullPageStyle = extension.id;
          document.head.appendChild(style);
        }
        activeFullPageExtensions.set(extension.id, {
          contentHash: extension.contentHash,
          extension,
          script,
          style,
          cleanupFns: [],
          timeoutIds: new Set(),
          intervalIds: new Set(),
        });
        document.head.appendChild(script);
        continue;
      }
      const active = activeExtensions.get(extension.id);
      if (active?.contentHash === extension.contentHash) continue;
      const iframe = document.createElement("iframe");
      iframe.setAttribute("sandbox", "allow-scripts");
      iframe.setAttribute("aria-hidden", "true");
      iframe.tabIndex = -1;
      iframe.hidden = true;
      iframe.src = extension.runtimeUrl;
      iframe.dataset.personalExtensionSandbox = extension.id;
      iframe.referrerPolicy = "no-referrer";
      const nextActive = {
        contentHash: extension.contentHash,
        extension,
        iframe,
      };
      activeExtensions.set(extension.id, nextActive);
      iframe.addEventListener("load", () => void postSandboxContext(nextActive), { once: true });
      document.body.appendChild(iframe);
      setPersonalExtensionContributionDispatcher(extension, (message) => {
        iframe.contentWindow?.postMessage({ channel: "marinara-personal-extension", ...message }, "*");
      });
    }
  }, [extensions]);

  useEffect(
    () => () => {
      const ids = new Set([...activeExtensions.keys(), ...activeFullPageExtensions.keys()]);
      for (const id of ids) void cleanupExtension(id);
    },
    [],
  );

  return null;
}
