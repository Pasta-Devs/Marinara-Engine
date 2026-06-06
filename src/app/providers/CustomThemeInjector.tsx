// ──────────────────────────────────────────────
// CustomThemeInjector: Injects active custom theme
// CSS and enabled extension CSS/JS into the DOM
// ──────────────────────────────────────────────
import { useEffect } from "react";
import { useThemes } from "../../features/shell/settings/index";
import { useExtensions } from "../../features/shell/settings/index";
import { storageApi } from "../../shared/api/storage-api";
import { stripDangerousCss } from "../../shared/lib/chat-css";

type ExtensionGlobal = typeof globalThis & {
  __marinaraExtensionApis?: Map<string, unknown>;
};

function getExtensionGlobal() {
  return globalThis as ExtensionGlobal;
}

function sanitizeExtensionSourceName(name: string) {
  return (
    name
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "extension"
  );
}

function buildExtensionModuleSource(apiKey: string, extensionName: string, js: string) {
  const sourceName = sanitizeExtensionSourceName(extensionName);
  return [
    `const marinara = globalThis.__marinaraExtensionApis?.get(${JSON.stringify(apiKey)});`,
    `if (!marinara) throw new Error("Extension API is no longer available.");`,
    `const executeExtension = function(marinara) {`,
    js,
    `};`,
    // Bind `this` to globalThis so classic-script-style extensions that rely on
    // `this === window` (e.g. for top-level `this.foo = bar` global assignment)
    // still work under module strict mode.
    `executeExtension.call(globalThis, marinara);`,
    `export {};`,
    `//# sourceURL=marinara-extension-${sourceName}.js`,
  ].join("\n");
}

export function CustomThemeInjector() {
  const { data: installedExtensions = [] } = useExtensions();
  const { data: customThemes = [] } = useThemes();
  const activeTheme = customThemes.find((theme) => theme.isActive) ?? null;

  // Inject active custom theme CSS
  useEffect(() => {
    const id = "marinara-custom-theme";
    let style = document.getElementById(id) as HTMLStyleElement | null;

    if (!activeTheme) {
      style?.remove();
      return;
    }

    if (!style) {
      style = document.createElement("style");
      style.id = id;
      document.head.appendChild(style);
    }
    // Theme CSS is injected raw into document.head, so it bypasses the card-CSS
    // sanitizer. Strip the network-exfil and script-injection vectors while leaving
    // a theme's legitimate token/!important/position overrides intact.
    style.textContent = stripDangerousCss(activeTheme.css);

    return () => {
      style?.remove();
    };
  }, [activeTheme]);

  // Inject enabled extension CSS
  useEffect(() => {
    const prefix = "marinara-ext-";

    // Remove old extension styles
    document.querySelectorAll(`style[id^="${prefix}"]`).forEach((el) => el.remove());

    // Inject enabled ones
    for (const ext of installedExtensions) {
      if (!ext.enabled || !ext.css) continue;
      const style = document.createElement("style");
      style.id = `${prefix}${ext.id}`;
      style.textContent = stripDangerousCss(ext.css);
      document.head.appendChild(style);
    }

    return () => {
      document.querySelectorAll(`style[id^="${prefix}"]`).forEach((el) => el.remove());
    };
  }, [installedExtensions]);

  // Execute enabled extension JS
  useEffect(() => {
    const cleanupFns: Array<() => void> = [];
    const prefix = "marinara-ext-js-";

    // Remove old extension scripts
    document.querySelectorAll(`[id^="${prefix}"]`).forEach((el) => el.remove());

    for (const ext of installedExtensions) {
      if (!ext.enabled || !ext.js) continue;

      try {
        const extensionCleanups: Array<() => void> = [];
        const extensionGlobal = getExtensionGlobal();
        const apiKey = `${ext.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        let disposed = false;
        let objectUrl: string | null = null;

        const runExtensionCleanups = () => {
          const cleanups = extensionCleanups.splice(0);
          cleanups.forEach((cleanup) => {
            try {
              cleanup();
            } catch (e) {
              console.warn(`[Extension:${ext.name}] Cleanup error:`, e);
            }
          });
        };

        const revokeObjectUrl = () => {
          if (!objectUrl) return;
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        };

        const cleanupExtension = () => {
          disposed = true;
          revokeObjectUrl();
          extensionGlobal.__marinaraExtensionApis?.delete(apiKey);
          runExtensionCleanups();
        };

        // Extension API passed to JS extensions
        const extensionAPI = {
          extensionId: ext.id,
          extensionName: ext.name,

          // Inject CSS with auto-cleanup
          addStyle: (css: string) => {
            const style = document.createElement("style");
            style.id = `${prefix}style-${ext.id}-${Date.now()}`;
            style.textContent = css;
            document.head.appendChild(style);
            extensionCleanups.push(() => style.remove());
            return style;
          },

          // Inject DOM element with auto-cleanup
          addElement: (parent: Element | string, tag: string, attrs?: Record<string, string>) => {
            const target = typeof parent === "string" ? document.querySelector(parent) : parent;
            if (!target) return null;
            const el = document.createElement(tag);
            if (attrs) {
              Object.entries(attrs).forEach(([k, v]) => {
                if (k === "innerHTML") el.innerHTML = v;
                else if (k === "textContent") el.textContent = v;
                else el.setAttribute(k, v);
              });
            }
            target.appendChild(el);
            extensionCleanups.push(() => el.remove());
            return el;
          },

          storage: {
            list: storageApi.list,
            get: storageApi.get,
            create: storageApi.create,
            update: storageApi.update,
            delete: storageApi.delete,
          },

          // addEventListener with auto-cleanup
          on: (target: EventTarget, event: string, handler: EventListenerOrEventListenerObject) => {
            target.addEventListener(event, handler);
            extensionCleanups.push(() => target.removeEventListener(event, handler));
          },

          // setInterval with auto-cleanup
          setInterval: (fn: () => void, ms: number) => {
            const id = window.setInterval(fn, ms);
            extensionCleanups.push(() => window.clearInterval(id));
            return id;
          },

          // setTimeout with auto-cleanup
          setTimeout: (fn: () => void, ms: number) => {
            const id = window.setTimeout(fn, ms);
            extensionCleanups.push(() => window.clearTimeout(id));
            return id;
          },

          // MutationObserver with auto-cleanup
          observe: (target: Element | string, callback: MutationCallback, options?: MutationObserverInit) => {
            const el = typeof target === "string" ? document.querySelector(target) : target;
            if (!el) return null;
            const observer = new MutationObserver(callback);
            observer.observe(el, options || { childList: true, subtree: true });
            extensionCleanups.push(() => observer.disconnect());
            return observer;
          },

          // Register a cleanup function manually
          onCleanup: (fn: () => void) => {
            if (disposed) {
              fn();
              return;
            }
            extensionCleanups.push(fn);
          },
        };

        extensionGlobal.__marinaraExtensionApis ??= new Map();
        extensionGlobal.__marinaraExtensionApis.set(apiKey, extensionAPI);
        cleanupFns.push(cleanupExtension);

        const moduleSource = buildExtensionModuleSource(apiKey, ext.name, ext.js);
        const blob = new Blob([moduleSource], { type: "text/javascript" });
        objectUrl = URL.createObjectURL(blob);

        void import(/* @vite-ignore */ objectUrl)
          .catch((e) => {
            if (!disposed) {
              console.error(`[Extension:${ext.name}] Failed to execute:`, e);
              runExtensionCleanups();
            }
          })
          .finally(() => {
            revokeObjectUrl();
            extensionGlobal.__marinaraExtensionApis?.delete(apiKey);
          });
      } catch (e) {
        console.error(`[Extension:${ext.name}] Failed to execute:`, e);
      }
    }

    return () => {
      cleanupFns.forEach((fn) => fn());
    };
  }, [installedExtensions]);

  return null;
}
