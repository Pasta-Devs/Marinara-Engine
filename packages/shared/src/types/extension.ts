// ──────────────────────────────────────────────
// Extension Types
// ──────────────────────────────────────────────

/**
 * A user-installed extension stored on the Marinara server.
 *
 * Client extension JS is delivered to the client as part of the list payload and
 * executed in the page via the blob-URL loader in `CustomThemeInjector.tsx`.
 * Server extension JS is executed by the Node.js runtime and must be treated as
 * trusted code.
 */
export interface InstalledExtension {
  id: string;
  name: string;
  /** Optional author-declared release version used for update and downgrade notices. */
  version?: string | null;
  description: string;
  /** Where the extension executes. Existing/legacy extensions default to "client". */
  runtime: "client" | "server";
  /** Optional CSS injected as a <style> tag while enabled. */
  css?: string | null;
  /** Optional JavaScript payload consumed by the client loader while enabled. */
  js?: string | null;
  /** Optional JavaScript payload consumed by the server extension runtime while enabled. */
  serverJs?: string | null;
  /** Whether the extension is currently active. */
  enabled: boolean;
  /** Runtime-only status for server extensions. */
  serverStatus?: "running" | "stopped" | "error";
  /** Runtime-only startup/reload error for server extensions. */
  serverError?: string | null;
  /** When the user originally imported it. */
  installedAt: string;
  createdAt: string;
  updatedAt: string;
}
