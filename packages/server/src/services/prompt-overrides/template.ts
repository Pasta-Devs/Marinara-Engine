// ──────────────────────────────────────────────
// Prompt Override Template Engine
//
// Simple ${name} substitution against a strict
// variable allowlist. Distinct from the chat
// macro engine ({{user}}, {{char}}, …) — different
// domain, different surface.
// ──────────────────────────────────────────────

const VARIABLE_PATTERN = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

export interface TemplateValidationResult {
  valid: boolean;
  unknownVariables: string[];
}

/**
 * Check that a template only references variables in the declared list.
 * Returns the unknown variables found (if any).
 */
export function validateTemplate(template: string, declared: readonly string[]): TemplateValidationResult {
  const allowed = new Set(declared);
  const seen = new Set<string>();
  const unknown: string[] = [];
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    const name = match[1];
    if (!name || seen.has(name)) continue;
    seen.add(name);
    if (!allowed.has(name)) unknown.push(name);
  }
  return { valid: unknown.length === 0, unknownVariables: unknown };
}

/**
 * Substitute ${name} occurrences with the matching value from `vars`.
 * Variables outside the declared allowlist are left intact (safer than
 * throwing — production rendering should never crash on a stale template).
 * Validation is the responsibility of the write path (PUT route).
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string | number | undefined>,
  declared: readonly string[],
): string {
  const allowed = new Set(declared);
  return template.replace(VARIABLE_PATTERN, (raw, name: string) => {
    if (!allowed.has(name)) return raw;
    const value = vars[name];
    return value === undefined || value === null ? "" : String(value);
  });
}
