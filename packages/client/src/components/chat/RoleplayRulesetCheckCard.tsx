// ──────────────────────────────────────────────
// A settled ruleset check in a Roleplay reply: the dice card, and what the dice card has no room for
//
// Some rules read more off a roll than its total: which of two named dice showed more (Hope or Fear),
// whether special dice made a messy critical or a bestial failure, what a plot die showed, how many
// dice a push threw again. The card shows the roll; these notes say the rest, in the reader's language.
// ──────────────────────────────────────────────
import type { SkillCheckResult } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import { AnimatedSkillCheckResult } from "../dice/AnimatedSkillCheckResult";

function useCheckNotes(result: SkillCheckResult): string[] {
  const { t: localizeUi } = useUiTranslation();
  const notes: string[] = [];
  if (result.duality === "tie") notes.push(localizeUi("chat.ruleset.check.dualityTie"));
  else if (result.duality) notes.push(localizeUi("chat.ruleset.check.duality", { label: result.duality }));
  if (result.hunger) {
    notes.push(
      localizeUi("chat.ruleset.check.hunger", {
        count: result.hunger,
        label: result.hungerLabel ?? localizeUi("chat.ruleset.check.hungerDefault"),
      }),
    );
  }
  if (result.messy) notes.push(localizeUi("chat.ruleset.check.messy"));
  if (result.bestial) notes.push(localizeUi("chat.ruleset.check.bestial"));
  if (result.plotFace !== undefined) {
    const label = result.plotLabel ?? localizeUi("chat.ruleset.check.plotDefault");
    notes.push(
      result.plotSymbol
        ? localizeUi(`chat.ruleset.check.plot.${result.plotSymbol}`, {
            label,
            face: result.plotFace,
            bonus: result.plotBonus ?? 0,
          })
        : localizeUi("chat.ruleset.check.plot.blank", { label, face: result.plotFace }),
    );
  }
  if (result.pushed) notes.push(localizeUi("chat.ruleset.check.pushed", { count: result.pushed }));
  for (const group of result.groups ?? []) {
    if (group.banes) notes.push(localizeUi("chat.ruleset.check.banes", { label: group.label, count: group.banes }));
  }
  if (result.shift) {
    notes.push(localizeUi("chat.ruleset.check.shift", { shift: result.shift > 0 ? `+${result.shift}` : result.shift }));
  }
  return notes;
}

export function RoleplayRulesetCheckCard({ result }: { result: SkillCheckResult }) {
  const notes = useCheckNotes(result);
  return (
    <div
      className="my-3 flex min-w-0 max-w-full flex-col items-center gap-1 whitespace-normal"
      data-roleplay-ruleset-check
    >
      <AnimatedSkillCheckResult result={result} animate={false} />
      {notes.length > 0 && (
        <p className="text-center text-[0.6875rem] font-medium text-[var(--muted-foreground)]">{notes.join(" · ")}</p>
      )}
    </div>
  );
}
