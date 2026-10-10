// Ordering for Professor Mari's inline work timeline. Kept out of the component so the rule that
// decides what the user reads, and in which order, has one runnable check.
import { stripProfessorMariSpeakerPrefix } from "./professor-mari-presentation";

export type WorkTimelineItem<Tool> =
  | {
      id: string;
      type: "text" | "thinking" | "status";
      content: string;
      startedAt?: number;
      updatedAt?: number;
      /** Slice 72: the words of a round that ran steps. The server sends them after those steps; they are the
       * caption of the phase the steps landed in, not a line below them. */
      narration?: boolean;
    }
  | { id: string; type: "tool"; tool: Tool };

export type WorkTimelineBlock<Tool> =
  | { kind: "text"; id: string; content: string }
  /** `seconds` is how long she thought, when the stream timed it; at least 1 so a quick thought never reads 0s. */
  | { kind: "thinking"; id: string; content: string; seconds: number | null }
  | { kind: "steps"; id: string; steps: Extract<WorkTimelineItem<Tool>, { type: "tool" }>[] };

/**
 * Mari's run in the order it happened: what she said, what she thought, and the steps she took
 * between. Back-to-back steps share one list. Status lines are internal bookkeeping (pacing,
 * deferrals) and stay out, as they did in the old work card.
 */
export function buildWorkTimelineBlocks<Tool>(items: readonly WorkTimelineItem<Tool>[]): WorkTimelineBlock<Tool>[] {
  const blocks: WorkTimelineBlock<Tool>[] = [];
  for (const item of items) {
    if (item.type === "status") continue;
    if (item.type === "tool") {
      const last = blocks.at(-1);
      if (last?.kind === "steps") last.steps.push(item);
      else blocks.push({ kind: "steps", id: item.id, steps: [item] });
      continue;
    }
    if (item.type === "text") {
      const content = stripProfessorMariSpeakerPrefix(item.content);
      if (content.trim()) blocks.push({ kind: "text", id: item.id, content });
      continue;
    }
    if (!item.content.trim()) continue;
    const { startedAt, updatedAt } = item;
    const seconds =
      startedAt && updatedAt && updatedAt >= startedAt
        ? Math.max(1, Math.round((updatedAt - startedAt) / 1_000))
        : null;
    blocks.push({ kind: "thinking", id: item.id, content: item.content, seconds });
  }
  return blocks;
}

/** A step's verb class, read from its title ("Reading character" → read). Step icons and run phases share it. */
export type StepVerbClass = "search" | "create" | "delete" | "edit" | "read";

const STEP_VERB_PATTERNS: ReadonlyArray<[RegExp, StepVerbClass]> = [
  [/^(search|find|grep|look)/i, "search"],
  [/^(creat|add|install|import)/i, "create"],
  [/^(delet|remov)/i, "delete"],
  [/^(edit|updat|writ|sav|set|chang|renam|appl|replac|mov|cop|fix)/i, "edit"],
  [/^(read|load|list|check|inspect|view|open|fetch|get|preview)/i, "read"],
];

export function stepVerbClass(title: string): StepVerbClass | null {
  return STEP_VERB_PATTERNS.find(([pattern]) => pattern.test(title))?.[1] ?? null;
}

export type RunPhaseKind = "look" | "change" | "other";

/** Slice 72: a read or search she could not do is worked around (amber); any other failed step is a failure. */
export function isLookStep(title: string): boolean {
  const verb = stepVerbClass(title);
  return verb === "read" || verb === "search";
}

/** R14: a finished phase with at most this many steps stays open. */
export const MAX_OPEN_PHASE_STEPS = 3;

const PHASE_KIND: Record<StepVerbClass, RunPhaseKind> = {
  search: "look",
  read: "look",
  create: "change",
  delete: "change",
  edit: "change",
};

export interface RunPhase<Tool> {
  id: string;
  kind: RunPhaseKind;
  /** Its steps, with the thoughts and words that led up to each, in order. */
  items: WorkTimelineItem<Tool>[];
  steps: number;
  /** Failed steps that are not reads or searches: the phase (and the run) failed. */
  failed: number;
  /** Slice 72: reads/searches that failed and she went on without: amber, the run stays green. */
  missed: number;
  /** Slice 72: her words for the round that started this phase (live only once she answers). */
  caption?: string;
  /** R13: every phase stays open while she runs, so each step's done mark is seen. R14: a finished run folds
   * only phases of more than three steps; a short one stays open, so "Looked at 1 thing" shows that thing. */
  open: boolean;
  /** The phase she is still in: its label reads "Looking", not "Looked at 4 things", and it has no done mark yet. */
  live: boolean;
}

/**
 * M5a: a run as phases. Back-to-back steps of one kind (looking, changing, anything else) share a phase,
 * together with the thoughts and words that led up to them. What came before her first step stays as it
 * was (`intro`), and what came after her last step is her answer (`tail`), so neither moves when a phase
 * starts. Phases stay open while she runs and fold when the run ends (R13: folding them earlier hid
 * every done mark); the last one is live until she starts answering.
 */
export function groupRunPhases<Tool>(
  items: readonly WorkTimelineItem<Tool>[],
  { active, describe }: { active: boolean; describe: (tool: Tool) => { title: string; failed: boolean } },
): { intro: WorkTimelineItem<Tool>[]; phases: RunPhase<Tool>[]; tail: WorkTimelineItem<Tool>[] } {
  const intro: WorkTimelineItem<Tool>[] = [];
  const phases: RunPhase<Tool>[] = [];
  let pending: WorkTimelineItem<Tool>[] = [];
  for (const item of items) {
    if (item.type === "status") continue;
    const current = phases.at(-1);
    if (item.type === "text" && item.narration && current) {
      // ponytail: one caption per phase (the round that opened it); later rounds' words stay unshown. Join
      // them if a phase ever needs every round's words.
      if (item.content.trim()) current.caption ??= item.content.trim();
      continue;
    }
    if (item.type !== "tool") {
      pending.push(item);
      continue;
    }
    const step = describe(item.tool);
    const verb = stepVerbClass(step.title);
    const kind = verb ? PHASE_KIND[verb] : "other";
    if (phases.length === 0) intro.push(...pending.splice(0));
    let phase = phases.at(-1);
    if (phase?.kind !== kind) {
      phase = { id: item.id, kind, items: [], steps: 0, failed: 0, missed: 0, open: active, live: false };
      phases.push(phase);
    }
    phase.items.push(...pending, item);
    pending = [];
    phase.steps += 1;
    if (step.failed && isLookStep(step.title)) phase.missed += 1;
    else if (step.failed) phase.failed += 1;
  }
  for (const phase of phases) phase.open = active || phase.steps <= MAX_OPEN_PHASE_STEPS;
  const last = phases.at(-1);
  const answering = pending.some((item) => item.type === "text" && item.content.trim());
  if (last && active && !answering) last.live = true;
  // Slice 70: once she has answered, her narration between steps ("Let me pull up his card…") was live status
  // only; the finished turn shows the steps and her last round's words (each round is its own text item).
  if (!active && answering) {
    const notText = (item: WorkTimelineItem<Tool>) => item.type !== "text";
    const answer = pending.findLastIndex((item) => item.type === "text" && item.content.trim());
    for (const phase of phases) {
      phase.items = phase.items.filter(notText);
      delete phase.caption;
    }
    return { intro: intro.filter(notText), phases, tail: pending.filter((item, i) => notText(item) || i === answer) };
  }
  return { intro, phases, tail: pending };
}

/**
 * Her answer without a trailing "Why" list, and that list's points: the client folds them into one
 * line you can open. Only a heading-like "Why" line followed by nothing but bullets counts.
 */
export function splitMariAnswerWhy(content: string): { answer: string; why: string[] } {
  const lines = content.replace(/\s+$/u, "").split("\n");
  const heading = lines.findLastIndex((line) =>
    /^\s*(?:#{1,4}\s*)?(?:\*\*|__)?why(?: it works| this works| it matters)?\s*:?\s*(?:\*\*|__)?\s*:?\s*$/iu.test(line),
  );
  if (heading < 0) return { answer: content, why: [] };
  const rest = lines.slice(heading + 1).filter((line) => line.trim());
  const bullet = /^\s*(?:[-*•]|\d+[.)])\s+(.+)$/u;
  if (rest.length === 0 || !rest.every((line) => bullet.test(line))) return { answer: content, why: [] };
  return {
    answer: lines.slice(0, heading).join("\n").trimEnd(),
    why: rest.map((line) => bullet.exec(line)![1]!.trim()),
  };
}

// ponytail: English-only. Step titles are English literals in inferToolPresentation; localize both
// together if they ever move into en.json.
// Keyed by the stem left after stripping "-ing", so silent-e verbs drop the e ("making" → "mak").
const IRREGULAR_PAST: Record<string, string> = {
  build: "built",
  find: "found",
  get: "got",
  mak: "made",
  put: "put",
  read: "read",
  run: "ran",
  send: "sent",
  set: "set",
  tak: "took",
  think: "thought",
  writ: "wrote",
};

/**
 * A finished step reads in the past tense ("Read character"), the running one in the present
 * ("Reading character"). Only a leading "-ing" verb changes; any other title is left as it is.
 */
export function pastTenseStepTitle(title: string): string {
  const match = /^([A-Za-z]+?)ing\b/.exec(title);
  // "Thing"/"String" have no vowel before "ing": not a verb form.
  if (!match || !/[aeiouy]/i.test(match[1]!)) return title;
  const word = match[0];
  let stem = match[1]!.toLowerCase();
  const doubled = /([bdglmnprt])\1$/.test(stem);
  const irregular = IRREGULAR_PAST[stem] ?? (doubled ? IRREGULAR_PAST[stem.slice(0, -1)] : undefined);
  let past: string;
  if (irregular) past = irregular;
  else {
    // "Planning" → "Planned", "Copying" → "Copied", "Updating" → "Updated", "Checking" → "Checked".
    if (/[^aeiou]y$/.test(stem)) stem = `${stem.slice(0, -1)}i`;
    past = stem.endsWith("e") ? `${stem}d` : `${stem}ed`;
  }
  const cased = word[0] === word[0]!.toUpperCase() ? past[0]!.toUpperCase() + past.slice(1) : past;
  return cased + title.slice(word.length);
}
