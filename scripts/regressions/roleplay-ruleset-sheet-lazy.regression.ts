/**
 * The chat view, Chat Settings and the tracker panel load without Game Mode's screen.
 *
 * A Roleplay chat that plays by a ruleset shows its members' sheets in Game Mode's own character
 * sheet, which brings the sheet editor, the inventory and, through the chunk they share, GameSurface
 * and GameNarration. The chat view is loaded at startup, so it may reach that sheet only through the
 * lazy RoleplayRulesetSheet, mounted once a sheet opens; a static import anywhere on the way put about
 * 1 MB of Game Mode's JavaScript on every app load (#8998). This walks the static imports of the client
 * sources from each screen and fails, naming the chain, when one reaches Game Mode's screen.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const clientSource = resolve(dirname(fileURLToPath(import.meta.url)), "../../packages/client/src");

// Every `import ... from` and `export ... from` but `import type`/`export type`, and side-effect
// imports. Dynamic `import()` is the lazy boundary, so it is not followed.
const STATIC_IMPORT = /(?:^|[;\n])\s*(?:import|export)\s+(?!type\s)(?:[^"';]*?\sfrom\s*)?["']([^"']+)["']/gu;

function resolveSource(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? join(clientSource, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(from), specifier)
      : null;
  if (!base) return null;
  const stem = base.replace(/\.js$/u, "");
  for (const candidate of [base, `${stem}.ts`, `${stem}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (/\.tsx?$/u.test(candidate) && existsSync(candidate)) return candidate;
  }
  return null;
}

/** `file` relative to the client source, with `/` between folders on every platform. */
const sourceName = (file: string) => relative(clientSource, file).split(sep).join("/");

/** The first static chain from `start` to a file `forbidden` matches, or null. */
function staticChain(start: string, forbidden: RegExp): string[] | null {
  const parent = new Map<string, string | null>([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const file = queue.shift()!;
    const name = sourceName(file);
    if (forbidden.test(name)) {
      const chain = [name];
      for (let at = parent.get(file); at; at = parent.get(at)) chain.unshift(sourceName(at));
      return chain;
    }
    for (const [, specifier] of readFileSync(file, "utf8").matchAll(STATIC_IMPORT)) {
      const next = resolveSource(file, specifier!);
      if (next && !parent.has(next)) {
        parent.set(next, file);
        queue.push(next);
      }
    }
  }
  return null;
}

const GAME_MODE_SCREEN =
  /^components\/(?:game\/(?:GameSurface|GameNarration|GameCharacterSheet|GameRulesetSheet|GameInventory|RulesetItemPicker)|rulesets\/RulesetSheetEditor)\.tsx$/u;

// The walk itself: the lazy sheet does reach Game Mode's character sheet.
assert.deepEqual(staticChain(join(clientSource, "components/chat/RoleplayRulesetSheet.tsx"), GAME_MODE_SCREEN), [
  "components/chat/RoleplayRulesetSheet.tsx",
  "components/game/GameCharacterSheet.tsx",
]);

for (const screen of [
  "main.tsx",
  "components/chat/ChatArea.tsx",
  "features/chat-settings/ChatSettingsDrawer.tsx",
  "features/tracker-panel/components/TrackerDataSidebar.tsx",
]) {
  const chain = staticChain(join(clientSource, screen), GAME_MODE_SCREEN);
  assert.equal(chain, null, `${screen} statically loads Game Mode's screen: ${chain?.join(" -> ")}`);
}

console.log("roleplay ruleset sheet lazy regression passed");
