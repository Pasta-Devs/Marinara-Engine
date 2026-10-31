/**
 * A Guided intro chosen in the wizard is kept as guided (cheap-GM playtest 2026-10-26: a "Guided" intro
 * choice was stored as "none").
 *
 *   - A guided or defined intro is sent as chosen; one left blank is never quietly sent as none, but is
 *     a problem the wizard names (Start and the setup's download wait on it), in its own words.
 *   - None is still none.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gameIntroChoiceSchema } from "../../packages/shared/src/index.js";
import { gameIntroForSetup, gameIntroProblem } from "../../packages/client/src/components/game/GameSetupGmIntro.js";

// ── Guided, as written ──
const guided = gameIntroForSetup({ mode: "guided", text: "  Open at the docks at dawn.  " });
assert.deepEqual(guided, { mode: "guided", text: "Open at the docks at dawn." });
assert.ok(gameIntroChoiceSchema.safeParse(guided).success);
assert.equal(gameIntroProblem({ mode: "guided", text: "Open at the docks at dawn." }), null);

// ── Blank is asked for, never quietly none ──
for (const mode of ["guided", "defined"] as const) {
  const blank = gameIntroForSetup({ mode, text: "   " });
  assert.equal(blank?.mode, mode, `a blank ${mode} intro is not sent as none`);
  assert.equal(gameIntroProblem({ mode, text: "   " }), "blank");
}
const en = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../packages/client/src/localization/locales/en.json", import.meta.url)),
    "utf8",
  ),
) as Record<string, string>;
assert.ok(en["game.intro.blank"], "the wizard says what to do");

// ── None is none ──
assert.deepEqual(gameIntroForSetup({ mode: "none" }), { mode: "none" });
assert.equal(gameIntroProblem({ mode: "none" }), null);
assert.equal(gameIntroForSetup(null), undefined);

console.log("game-intro-guided-kept: ok");
