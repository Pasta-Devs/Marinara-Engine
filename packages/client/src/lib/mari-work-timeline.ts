// Ordering for Professor Mari's inline work timeline. Kept out of the component so the rule that
// decides what the user reads, and in which order, has one runnable check.
import { stripProfessorMariSpeakerPrefix } from "./professor-mari-presentation";

export type WorkTimelineItem<Tool> =
  { id: string; type: "text" | "thinking" | "status"; content: string } | { id: string; type: "tool"; tool: Tool };

export type WorkTimelineBlock<Tool> =
  | { kind: "text" | "thinking"; id: string; content: string }
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
    const content = item.type === "text" ? stripProfessorMariSpeakerPrefix(item.content) : item.content;
    if (content.trim()) blocks.push({ kind: item.type, id: item.id, content });
  }
  return blocks;
}
