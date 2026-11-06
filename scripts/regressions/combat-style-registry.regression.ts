// The combat-style seam (issue #8109): the game surface asks the active style how to start, draw and
// lay out a battle, and Classic and Tactical are registered through that same seam.
//
// What it pins: both built-in styles are known and cannot be replaced; an id this client has not
// registered plays as classic; a registered style is listed, resolved and removed again by the
// function its registration returned (and a later registration under the same id survives the
// earlier one's removal); only Tactical takes the top chrome; a style that takes a fight's start is
// asked once per message, even by a same-tick double request or a request from inside its own
// start(), and the in-flight flag is handed back either way; a style-owned fight comes back from its
// saved pin and anchor while every other snapshot restores as before; and the game surface reaches the
// battle UI, the top-chrome offset, the active check and the start of a fight through the seam
// rather than by naming a style.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getCombatStyle,
  isBuiltInCombatStyle,
  listCombatStyles,
  offerCombatStart,
  registerCombatStyle,
  resolveCombatStyle,
  styleOwnedFightFromSnapshot,
  type CombatStyleSurface,
} from "../../packages/client/src/components/game/combat-styles.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");

// Built-ins.
assert.deepEqual(listCombatStyles(), ["classic", "tactical"]);
assert.equal(isBuiltInCombatStyle("classic"), true);
assert.equal(isBuiltInCombatStyle("tactical"), true);
assert.equal(isBuiltInCombatStyle("duel"), false);
assert.equal(isBuiltInCombatStyle(undefined), false);
assert.equal(resolveCombatStyle("tactical"), "tactical");
assert.equal(resolveCombatStyle(undefined), "classic");
assert.equal(resolveCombatStyle(null), "classic");
assert.equal(resolveCombatStyle(""), "classic");
assert.equal(resolveCombatStyle("duel"), "classic", "an unregistered id plays as classic");
assert.equal(getCombatStyle("duel"), getCombatStyle("classic"));
assert.equal(getCombatStyle("tactical").ownsTopChrome, true);
assert.notEqual(getCombatStyle("classic").ownsTopChrome, true);
assert.equal(getCombatStyle("classic").start, undefined, "classic keeps the generation pass");
assert.equal(getCombatStyle("tactical").start, undefined, "tactical keeps the generation pass");
assert.equal(getCombatStyle("classic").isActive, undefined);
assert.equal(getCombatStyle("tactical").isActive, undefined);
assert.throws(() => registerCombatStyle("classic", { render: () => null }), /cannot be replaced/);
assert.throws(() => registerCombatStyle("tactical", { render: () => null }), /cannot be replaced/);

// A registered style.
const duel: CombatStyleSurface = { label: "Duel", ownsTopChrome: true, render: () => null };
const unregister = registerCombatStyle("duel", duel);
assert.deepEqual(listCombatStyles(), ["classic", "tactical", "duel"]);
assert.equal(resolveCombatStyle("duel"), "duel");
assert.equal(getCombatStyle("duel"), duel);
unregister();
assert.equal(resolveCombatStyle("duel"), "classic");
assert.deepEqual(listCombatStyles(), ["classic", "tactical"]);

// Re-registration: removing the first leaves the second.
const first: CombatStyleSurface = { render: () => null };
const second: CombatStyleSurface = { render: () => null };
const unregisterFirst = registerCombatStyle("duel", first);
const unregisterSecond = registerCombatStyle("duel", second);
unregisterFirst();
assert.equal(getCombatStyle("duel"), second);
unregisterSecond();
assert.equal(resolveCombatStyle("duel"), "classic");

// Starting a fight through a style.
{
  const inFlight = { current: false };
  const startedMessageId = { current: null as string | null };
  const refs = { inFlight, startedMessageId };
  let calls = 0;
  let sawInFlight = false;
  const taking: CombatStyleSurface = {
    render: () => null,
    start: () => {
      calls += 1;
      sawInFlight = inFlight.current;
      return true;
    },
  };
  assert.equal(offerCombatStart(taking, { chatId: "c", messageId: "m1" }, refs), "taken");
  assert.equal(offerCombatStart(taking, { chatId: "c", messageId: "m1" }, refs), "already-taken");
  assert.equal(calls, 1, "a same-tick double request asks the style once");
  assert.equal(sawInFlight, true, "the in-flight flag is held while the style is asked");
  assert.equal(inFlight.current, false, "and handed back afterwards");
  assert.equal(offerCombatStart(taking, { chatId: "c", messageId: "m2" }, refs), "taken", "a new fight starts again");
  assert.equal(calls, 2);

  let declines = 0;
  const declining: CombatStyleSurface = { render: () => null, start: () => (declines++, false) };
  const fresh = { inFlight: { current: false }, startedMessageId: { current: null as string | null } };
  assert.equal(offerCombatStart(declining, { chatId: "c", messageId: "m1" }, fresh), "declined");
  assert.equal(fresh.inFlight.current, false, "a declined start hands the flag back for the classic pass");
  assert.equal(fresh.startedMessageId.current, null);
  assert.equal(offerCombatStart(declining, { chatId: "c", messageId: "m1" }, fresh), "declined");
  assert.equal(declines, 2);
  assert.equal(offerCombatStart(getCombatStyle("classic"), { chatId: "c", messageId: "m1" }, fresh), "declined");

  const throwing: CombatStyleSurface = {
    render: () => null,
    start: () => {
      throw new Error("boom");
    },
  };
  assert.throws(() => offerCombatStart(throwing, { chatId: "c", messageId: "m1" }, fresh), /boom/);
  assert.equal(fresh.inFlight.current, false, "a throwing start still hands the flag back");
}

// Restoring a style-owned fight.
{
  const unregisterPlain = registerCombatStyle("duel", { render: () => null });
  assert.deepEqual(
    styleOwnedFightFromSnapshot({ party: [], combatStyle: "duel", startMessageId: "m1" }, "c"),
    { style: null, startMessageId: "m1" },
    "a style with no isActive() cannot draw a party-less fight, so its save is stale",
  );
  unregisterPlain();
  const unregisterDead = registerCombatStyle("duel", { render: () => null, isActive: () => false });
  assert.deepEqual(
    styleOwnedFightFromSnapshot({ party: [], combatStyle: "duel", startMessageId: "m1" }, "c"),
    { style: null, startMessageId: "m1" },
    "a style that reports no live fight for the chat leaves a stale save",
  );
  unregisterDead();
  const unregisterThrowing = registerCombatStyle("duel", {
    render: () => null,
    isActive: () => {
      throw new Error("not loaded");
    },
  });
  assert.equal(
    styleOwnedFightFromSnapshot({ party: [], combatStyle: "duel", startMessageId: "m1" }, "c")?.style,
    null,
    "a throwing isActive() counts as no live fight",
  );
  unregisterThrowing();
  const unregister = registerCombatStyle("duel", { render: () => null, isActive: (chatId) => chatId === "c" });
  assert.equal(
    styleOwnedFightFromSnapshot({ party: [], combatStyle: "duel", startMessageId: "m1" }, "other")?.style,
    null,
    "the style is asked about this chat",
  );
  assert.deepEqual(styleOwnedFightFromSnapshot({ party: [], combatStyle: "duel", startMessageId: "m1" }, "c"), {
    style: "duel",
    startMessageId: "m1",
  });
  assert.equal(styleOwnedFightFromSnapshot({ party: [{}], combatStyle: "duel" }, "c"), null, "a fight with a party");
  assert.equal(styleOwnedFightFromSnapshot({ party: [], combatStyle: "tactical" }, "c"), null, "a built-in style");
  assert.equal(styleOwnedFightFromSnapshot({ party: [], combatStyle: null }, "c"), null);
  assert.equal(styleOwnedFightFromSnapshot(null, "c"), null);
  unregister();
  assert.deepEqual(
    styleOwnedFightFromSnapshot({ party: [], combatStyle: "duel", startMessageId: "m1" }, "c"),
    { style: null, startMessageId: "m1" },
    "a style no longer registered leaves a stale save",
  );
}

// The game surface goes through the seam.
const surface = readSource("packages/client/src/components/game/GameSurface.tsx");
assert.match(surface, /combatStyleSurface\.render\(combatSurfaceContext\)/);
assert.match(surface, /combatStyleSurface\.ownsTopChrome/);
assert.match(surface, /offerCombatStart\(\s*combatStyleSurface,/);
assert.match(surface, /styleOwnedFightFromSnapshot\(snapshot, activeChatId\)/);
// The once-per-message latch is released wherever a fight ends or a start is abandoned.
assert.equal(
  surface.match(/combatStyleStartedMessageIdRef\.current = null;/g)?.length,
  6,
  "released by the five abandon paths and the end of a fight",
);
// The server enters a style-owned fight only once its snapshot is saved.
assert.match(surface, /gameCombatState: snapshot \}\)\s*\.then\(\(\) => transitionGameState\.mutate/);
assert.match(surface, /combatStyleSurface\.isActive\?\.\(/);
assert.doesNotMatch(surface, /<TacticalCombatUI\b/, "the tactical UI is mounted by its style, not the surface");
assert.doesNotMatch(surface, /<GameCombatUI\b/, "the classic UI is mounted by its style, not the surface");
assert.doesNotMatch(surface, /tacticalCombatActive/);

console.log("combat-style-registry regression passed");
