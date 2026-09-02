// Typing for BROWSER-context dynamic imports used inside page.evaluate
// callbacks (e.g. `await import("/src/stores/ui.store.ts")`). tsc cannot
// resolve these dev-server URLs — and, because rooted specifiers are
// classified as relative, ambient `declare module` blocks can never match
// them either. The working pattern, applied at every call site:
//
//   const module = (await import("/src/stores/ui.store.ts" as string)) as PageUiStoreModule;
//
// `as string` widens the specifier so tsc skips resolution (it is erased at
// transpile time — the browser receives the literal unchanged), and the cast
// types the result via the aliases below, which type-query the REAL client
// sources so drift surfaces as a type error instead of at runtime.
//
// This file is a global script (no top-level import/export), so the aliases
// are visible in every spec without importing. When a type-query would drag
// too much of the client program into this project (React component trees,
// vite-specific typing), keep the call site's own structural cast instead —
// the GameSurface.tsx import in core-flows.e2e.ts is the example.

// Minimal vite ImportMeta surface for the client sources type-queried below
// (locale-loader uses import.meta.env / import.meta.glob). The client's own
// build types these via "vite/client", which is not resolvable from the root
// project; this merge declares only what those sources touch.
interface ImportMeta {
  readonly env?: Record<string, string | boolean | undefined>;
  glob<T = unknown>(
    pattern: string,
    options?: { import?: string; query?: string; eager?: boolean },
  ): Record<string, () => Promise<T>>;
}

type PageUiStoreModule = typeof import("../packages/client/src/stores/ui.store");
type PageChatStoreModule = typeof import("../packages/client/src/stores/chat.store");
type PageAgentStoreModule = typeof import("../packages/client/src/stores/agent.store");
type PageAppDialogsModule = typeof import("../packages/client/src/lib/app-dialogs");
type PageI18nModule = typeof import("../packages/client/src/localization/i18n");
type PageChatHtmlModule = typeof import("../packages/client/src/lib/chat-html");
type PageSlashCommandsModule = typeof import("../packages/client/src/lib/slash-commands");
