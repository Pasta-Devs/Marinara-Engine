// The small round marks a ruleset fight shows its budgets with: a letter on a tone, filled while the
// budget is still there to spend and hollow once it is spent. The letter always shows, so the tone is
// never the only thing telling two budgets apart.
import { RULESET_BUDGET_TONES, type RulesetDefinition } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";

type Tone = (typeof RULESET_BUDGET_TONES)[number];

/** Each tone's fill. The letter on it is always the same near-black, so every fill is light enough
 *  to carry it in a light theme and a dark one alike. */
const TONE_FILL: Record<Tone, string> = {
  rose: "#ff8597",
  amber: "#eab964",
  violet: "#b9adff",
  teal: "#6fd6c4",
  sky: "#8cc8ff",
  lime: "#b6dd73",
  orange: "#f6a066",
  slate: "#b7bdc9",
};

export interface RulesetBudgetMark {
  id: string;
  label: string;
  short: string;
  fill: string;
  /** How many of it a turn gives. */
  count: number;
}

/** How each budget of the ruleset is marked: its own letters and tone when the file gives them
 *  (1.375), else the first letter of its label and the tone of its place, which for 5e's Action,
 *  Bonus action and Reaction is A, B and R in rose, amber and violet. */
export function rulesetBudgetMarks(
  definition: RulesetDefinition | undefined,
  /** The ruleset's own words in the player's language (1.806): its labels, and the letter read off one. */
  text: (english: string) => string = (english) => english,
): RulesetBudgetMark[] {
  const budgets = definition?.combat?.economy.budgets ?? [];
  return budgets.map((budget, index) => {
    const label = text(budget.label);
    return {
      id: budget.id,
      label,
      short: (budget.short ? text(budget.short) : (Array.from(label.trim())[0] ?? "?")).toLocaleUpperCase(),
      fill: TONE_FILL[budget.tone ?? RULESET_BUDGET_TONES[index % RULESET_BUDGET_TONES.length]!],
      count: budget.count,
    };
  });
}

export function RulesetBudgetPip({
  mark,
  spent,
  size = "md",
  title,
}: {
  mark: RulesetBudgetMark;
  spent?: boolean;
  size?: "sm" | "md";
  /** What a screen reader and a pointer are told; the budget's own name when nothing more is said. */
  title?: string;
}) {
  return (
    <span
      role="img"
      aria-label={title ?? mark.label}
      title={title ?? mark.label}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-extrabold leading-none tabular-nums",
        size === "sm" ? "h-4 w-4 text-[0.5rem]" : "h-5 w-5 text-[0.625rem]",
        spent ? "text-[var(--muted-foreground)] ring-[1.5px] ring-inset ring-[var(--border)]" : "text-[#140e1c]",
      )}
      style={spent ? undefined : { backgroundColor: mark.fill }}
    >
      {mark.short}
    </span>
  );
}
