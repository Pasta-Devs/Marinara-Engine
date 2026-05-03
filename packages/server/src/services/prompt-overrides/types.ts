// ──────────────────────────────────────────────
// Public types for the prompt-overrides registry.
// Kept in a small file so per-domain registry
// modules can import without circular deps.
// ──────────────────────────────────────────────

export interface PromptVariable {
  name: string;
  description: string;
  example?: string;
}

export interface PromptOverrideKeyDef<TCtx extends Record<string, string | number | undefined>> {
  key: string;
  description: string;
  variables: readonly PromptVariable[];
  /** The hardcoded behavior used when no override exists or when an override fails. */
  defaultBuilder: (ctx: TCtx) => string;
  /** Realistic example values used to preview the default text in the UI. */
  exampleContext: TCtx;
}
