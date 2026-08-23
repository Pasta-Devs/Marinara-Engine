// ──────────────────────────────────────────────
// Professor Mari: saved-memory prompt injection (#4851)
//
// Pure renderer for the `<professor_mari_memory>` block. Kept separate from the
// workspace agent so the token-critical invariants (never inline a non-persistent
// body; cap the index; bound the whole persistent region) are unit-testable in isolation.
// ──────────────────────────────────────────────
import { MAX_INSTRUCTION_CONTENT_LENGTH, type MariInstructionRow } from "../storage/mari-instructions.storage.js";

export interface RenderMariMemoryOptions {
  maxIndexEntries?: number;
  maxIndexChars?: number;
  maxPersistentBodyChars?: number;
}

// The always-on footprint. Non-persistent bodies are NEVER injected here; the whole
// point of index-and-fetch (and the maintainer's one caveat) is avoiding token bloat.
// The index is capped by BOTH an entry count AND a total-char budget, and the ENTIRE
// persistent region (heading + body + separators of every row) is charged against one
// budget, so the whole always-injected block stays bounded far below provider limits.
const DEFAULT_MAX_INDEX_ENTRIES = 60;
const DEFAULT_MAX_INDEX_CHARS = 8_000;
const DEFAULT_MAX_PERSISTENT_BODY_CHARS = MAX_INSTRUCTION_CONTENT_LENGTH;

const MEMORY_BLOCK_TAG = "professor_mari_memory";

// Memory content is prompt LEAF content and reaches the model VERBATIM; see
// CONTRIBUTING.md "Prompt Leaf Content Is Verbatim": memories are named there explicitly,
// angle brackets are NOT escaped, and structure comes from the fixed <professor_mari_memory>
// wrapper (which authored content cannot alter, since the model does not parse the prompt as
// XML). We only FLATTEN the short one-line index/heading fields to a single line so a newline
// cannot split a list entry across lines; this is line formatting, not escaping: `<`, `>`, `&`
// pass through untouched, and full bodies are emitted byte-for-byte.
function flattenLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function renderMariMemoryPrompt(
  rows: MariInstructionRow[],
  options: RenderMariMemoryOptions = {},
): string | null {
  const maxIndexEntries = options.maxIndexEntries ?? DEFAULT_MAX_INDEX_ENTRIES;
  const maxIndexChars = options.maxIndexChars ?? DEFAULT_MAX_INDEX_CHARS;
  const maxPersistentBodyChars = options.maxPersistentBodyChars ?? DEFAULT_MAX_PERSISTENT_BODY_CHARS;

  const enabled = rows.filter((row) => row.enabled && row.name.trim());
  if (enabled.length === 0) return null;

  // Persistent first, so a persistent directive can never be pushed out of the index by the cap.
  const ordered = [...enabled.filter((row) => row.persistent), ...enabled.filter((row) => !row.persistent)];
  // Cap the always-on index by BOTH entry count and total chars, so the block can never grow
  // near provider limits before it starts dropping content (always keeping at least one entry).
  const indexLines: string[] = [];
  let indexChars = 0;
  for (const row of ordered) {
    if (indexLines.length >= maxIndexEntries) break;
    const marker = row.persistent ? " [PERSISTENT]" : "";
    const description = flattenLine(row.description);
    const desc = description ? `: ${description}` : "";
    const line = `- [${flattenLine(row.id)}] ${flattenLine(row.name)}${marker}${desc}`;
    if (indexChars + line.length + 1 > maxIndexChars && indexLines.length > 0) break;
    indexLines.push(line);
    indexChars += line.length + 1;
  }
  const trimmedIndex = ordered.length - indexLines.length;

  const persistentSections: string[] = [];
  let persistentBudget = maxPersistentBodyChars;
  let trimmedPersistent = 0;
  for (const row of ordered.filter((row) => row.persistent && row.content.trim())) {
    // Body is emitted verbatim (already trimmed at write). Charge the WHOLE serialized section,
    // heading + body + the join separator, against the budget, so many small-body rows with long
    // headings cannot escape it.
    const section = `### ${flattenLine(row.name)}\n${row.content}`;
    const cost = section.length + 1;
    if (cost <= persistentBudget) {
      persistentSections.push(section);
      persistentBudget -= cost;
    } else {
      trimmedPersistent += 1;
    }
  }

  const parts: string[] = [
    `<${MEMORY_BLOCK_TAG}>`,
    "These are the user's saved memories, their standing preferences and instructions for how you work. Treat them as authoritative: where a memory conflicts with your default behavior, follow the memory.",
    "",
    "Before you act on a request, scan this index. If an entry bears on the task or the situation (including memories about how you should behave), call instruction.get with its id to read the full memory, then follow it. Do not act on a memory from its title alone; fetch it first. (Persistent memories are shown in full below and are always active.)",
    "",
    "Saved memories (index):",
    ...indexLines,
  ];
  if (trimmedIndex > 0) {
    parts.push(
      `- (+${trimmedIndex} more memories not shown here. Call instruction.list to page through them all: it returns {items, total, nextOffset}; re-call with offset: nextOffset until nextOffset is null.)`,
    );
  }
  if (persistentSections.length > 0) {
    parts.push("", "Persistent memories (full text, always active):", ...persistentSections);
  }
  if (trimmedPersistent > 0) {
    parts.push(
      "",
      `(${trimmedPersistent} persistent memory/memories were too long to inline. They are in the index above; fetch them with instruction.get.)`,
    );
  }
  parts.push(`</${MEMORY_BLOCK_TAG}>`);
  return parts.join("\n");
}
