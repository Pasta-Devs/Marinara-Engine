import type { WrapFormat } from "@marinara-engine/shared";

// ──────────────────────────────────────────────────────────────────────────────
// Prompt leaf handling — VERBATIM CONTENT.
//
// HARD RULE: do NOT (re-)introduce `<` / `>` / `&` escaping for prompt LEAF
// content — character card fields, lorebook entries, persona, memories, scene
// text, example dialogue, etc. This content is handed to the model exactly as
// the user wrote it, so people can organize their cards and lorebooks with
// angle-bracket / HTML-style tags (`<thinking>`, `<scenario>`, `<div>`, …) and
// have them reach the model as written.
//
// Why this keeps getting "fixed" and re-broken: a past change started
// HTML-escaping `<` to `&lt;` as a prompt-injection guard against untrusted
// imported cards. In practice that mangles the (very common) legitimate use of
// tags in cards/lorebooks — the model receives `&lt;thinking>` instead of
// `<thinking>`, HTML styling breaks, editing shows raw `&lt;`, and it wastes
// tokens — while the "injection" it guards against is, for local single-user
// RP, at worst a rare, self-inflicted, self-fixable annoyance (the user sees
// the wacky output and edits their own card). Maintainer decision: verbatim
// content wins. If you think this needs escaping again, it almost certainly
// does not — check with a maintainer before changing it.
//
// This does NOT affect the prompt's structural integrity: the framework's own
// section wrappers (`<description>…</description>`, `<last_message>…`, etc.) are
// emitted by `wrapContent` AROUND this content, independent of what the content
// contains.
//
// SCOPE — what is deliberately still escaped, and why it is NOT a reason to
// re-escape this path:
//   • The agent value/attribute escapers (`escapeXml` / `escapeXmlAttribute` in
//     `agent-executor.ts`, and the local `escapeXmlText` in `knowledge-router.ts`)
//     escape dynamic values into XML *attributes* and into structured agent
//     output. A stray `"` or `<` there breaks an attribute or element, so those
//     MUST stay escaped.
//   • Note that `agent-executor.ts` (~line 2255) escapes the SAME card fields
//     (description / personality / scenario / …) into ELEMENT CONTENT of a
//     strict, machine-parsed world-state document. That is a different consumer
//     with different rules — it is intentionally not verbatim, and it is NOT a
//     "consistency" argument for re-escaping the main prompt path here. The
//     model reads the prompt as tokens; the world-state doc is parsed as XML.
//   • There is also a `knowledge-router.ts` local function coincidentally also
//     named `escapeXmlText` that legitimately DOES escape (agent entry catalog).
//     Do not confuse it with the identity `passThroughLeaf` below.
// ──────────────────────────────────────────────────────────────────────────────

// The example-dialogue separator. Some import paths hand us this marker already
// HTML-entity-escaped; we canonicalize ONLY this exact control marker back to
// the literal `<START>` so the separator still works. Everything else is left
// untouched.
const EXAMPLE_DIALOGUE_MARKER_PATTERN = /(<START>|&lt;START(?:&gt;|>))/g;
const EXACT_EXAMPLE_DIALOGUE_MARKER_PATTERN = /^(?:<START>|&lt;START(?:&gt;|>))$/;

/**
 * Prompt leaf content is emitted VERBATIM — identity function.
 *
 * Named `passThroughLeaf` on purpose: the body is `return value`, and a function
 * whose name implied escaping (it used to be `escapeXmlText`) invited a one-line
 * "an XML escaper should obviously escape" change that silently re-broke every
 * card using `<thinking>` / HTML tags. The name now states the contract so that
 * regression can't masquerade as a fix. DO NOT add `<` / `>` / `&` escaping
 * here — see the file header. A regression test locks this to identity.
 */
export function passThroughLeaf(value: string): string {
  return value;
}

function neutralizeMarkdownHeadings(value: string): string {
  return value.replace(/^(\s{0,3})(#{1,6})(?=\s|$)/gm, "$1\\$2");
}

export function sanitizePromptLeaf(value: string, wrapFormat: WrapFormat): string {
  // XML wrap: pass content through untouched (verbatim tags — see file header).
  if (wrapFormat === "xml") return value;
  // Markdown wrap: only neutralize leading `#` so user text can't forge section
  // headings in the markdown layout. (Angle brackets are irrelevant here.)
  if (wrapFormat === "markdown") return neutralizeMarkdownHeadings(value);
  return value;
}

export function sanitizeExampleDialoguePromptLeaf(value: string, wrapFormat: WrapFormat): string {
  if (wrapFormat !== "xml") return sanitizePromptLeaf(value, wrapFormat);

  // Content passes through verbatim; the only transform is canonicalizing an
  // already-escaped `&lt;START>` marker (from some importers) back to `<START>`.
  return value
    .split(EXAMPLE_DIALOGUE_MARKER_PATTERN)
    .map((chunk) => (EXACT_EXAMPLE_DIALOGUE_MARKER_PATTERN.test(chunk) ? "<START>" : chunk))
    .join("");
}
