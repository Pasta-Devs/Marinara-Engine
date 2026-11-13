// ──────────────────────────────────────────────
// A settled ruleset check in a Roleplay reply: Game Mode's dice card, where the check happened
// ──────────────────────────────────────────────
import type { SkillCheckResult } from "@marinara-engine/shared";
import { AnimatedSkillCheckResult } from "../dice/AnimatedSkillCheckResult";

export function RoleplayRulesetCheckCard({ result }: { result: SkillCheckResult }) {
  return (
    <div className="my-3 flex min-w-0 max-w-full justify-center whitespace-normal" data-roleplay-ruleset-check>
      <AnimatedSkillCheckResult result={result} animate={false} />
    </div>
  );
}
