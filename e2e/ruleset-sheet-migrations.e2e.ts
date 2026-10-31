import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseRulesetDefinition, readRulesetSheetEnvelope } from "@marinara-engine/shared";
import { seedUIState } from "./ui-state-fixture.js";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";

// A ruleset that moved on a layout (C6e-0, Capability API 1.77): one level becomes a level per class,
// one pool of hit dice one per die. A character stored on the old layout opens in the sheet editor
// with its level on its class, and in the game's sheet with its spent die on the right pool, and what
// either stores next is the new layout.
const doc = JSON.parse(
  readFileSync(new URL("../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8"),
);
doc.sheet.version = 2;
for (const id of ["level_fighter", "level_wizard", "level_other"]) {
  doc.sheet.fields.push({ id, label: id, type: "number", min: 0, max: 20, default: 0 });
}
const dice = [
  ["hit_dice_d10", "level_fighter"],
  ["hit_dice_d6", "level_wizard"],
  ["hit_dice_d8", "level_other"],
];
doc.sheet.live.pools = doc.sheet.live.pools.filter((pool: { id: string }) => pool.id !== "hit_dice");
for (const [id, field] of dice) doc.sheet.live.pools.push({ id, label: id, max: { field } });
for (const rest of doc.rests) {
  rest.restore = (rest.restore ?? []).flatMap((entry: { pool?: string }) =>
    entry.pool === "hit_dice" ? dice.map(([id]) => ({ pool: id, to: "max" })) : [entry],
  );
}
doc.sheet.migrations = [
  {
    from: 1,
    steps: [
      {
        route: "level",
        by: "class",
        cases: [
          { words: ["fighter"], to: "level_fighter" },
          { words: ["wizard"], to: "level_wizard" },
        ],
        else: "level_other",
        default: 1,
      },
      { routeLive: "pool", from: "hit_dice", cases: dice.map(([id]) => id), else: "hit_dice_d8" },
    ],
  },
];
const parsed = parseRulesetDefinition(doc);
if (!parsed.ok) throw new Error(parsed.issues.join("; "));
const definition = parsed.definition;
const stored = { v: 1, build: { fields: { level: 5, class: "Fighter" } } };
const migrated = readRulesetSheetEnvelope(definition, stored)!;
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("an old-layout sheet opens migrated in the editor and in the game, and stores the new layout", async ({
  page,
}) => {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    theme: "dark",
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chibiProfessorMariEnabled: false,
  });
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
  await page.goto("/");
  await prepareViteFixtureDependencies(page);
  await page.evaluate(
    async ({ definition, stored, migrated }) => {
      const dependencyUrl = window.__viteFixtureDependencyUrl;
      const { default: React } = await import(dependencyUrl("react"));
      const { default: ReactDOM } = await import(dependencyUrl("react-dom_client"));
      const { RulesetSheetEditor } = await import("/src/components/rulesets/RulesetSheetEditor.tsx" as string);
      const { GameRulesetSheet } = await import("/src/components/game/GameRulesetSheet.tsx" as string);
      const { QueryClient, QueryClientProvider } = await import(dependencyUrl("@tanstack_react-query"));
      const record = window as unknown as { __envelope?: unknown; __live?: unknown };
      const container = document.createElement("div");
      container.dataset.migrationFixture = "true";
      container.style.cssText =
        "position:fixed;inset:0;z-index:10000;overflow:auto;padding:16px;background:var(--background);color:var(--foreground)";
      document.body.append(container);
      function Fixture() {
        const [envelope, setEnvelope] = React.useState(stored);
        const [live, setLive] = React.useState({ pools: { hit_dice: { value: 1 } } });
        return React.createElement(
          "div",
          null,
          React.createElement(
            "section",
            { "data-editor": "true" },
            React.createElement(RulesetSheetEditor, {
              definition,
              envelope,
              onChange: (next: unknown) => {
                record.__envelope = next;
                setEnvelope(next);
              },
            }),
          ),
          React.createElement(
            "section",
            { "data-game": "true" },
            React.createElement(GameRulesetSheet, {
              definition,
              cardName: "Brenna",
              envelope: migrated,
              live,
              onEnvelopeSave: () => {},
              onLiveChange: (next: unknown) => {
                record.__live = next;
                setLive(next);
              },
            }),
          ),
        );
      }
      const client = new QueryClient();
      ReactDOM.createRoot(container).render(
        React.createElement(QueryClientProvider, { client }, React.createElement(Fixture)),
      );
    },
    { definition, stored, migrated },
  );

  // The editor shows the old level on the fighter's own level, before anything is saved.
  const editor = page.locator("[data-editor]");
  await expect(editor.getByLabel("level_fighter", { exact: true })).toHaveValue("5");
  expect(await page.evaluate(() => (window as unknown as { __envelope?: unknown }).__envelope)).toBeUndefined();
  // An edit stores the new layout, labelled with it, the routed level kept.
  await editor.getByLabel("level_wizard", { exact: true }).fill("2");
  await editor.getByLabel("level_wizard", { exact: true }).blur();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __envelope?: { v: number } }).__envelope?.v))
    .toBe(2);
  const saved = await page.evaluate(
    () => (window as unknown as { __envelope: { build: { fields: Record<string, unknown> } } }).__envelope,
  );
  expect([saved.build.fields.level_fighter, saved.build.fields.level_wizard]).toEqual([5, 2]);

  // The game's sheet reads the old pool's spent dice on the fighter's d10, and a spend stores them there.
  const game = page.locator("[data-game]");
  await expect(game.getByLabel("hit_dice_d10 for Brenna", { exact: true })).toHaveValue("1");
  await game.getByRole("button", { name: "Take one from hit_dice_d10 for Brenna", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __live?: unknown }).__live))
    .toEqual({ pools: { hit_dice_d10: { value: 0 } } });
  await expect(game.getByLabel("hit_dice_d10 for Brenna", { exact: true })).toHaveValue("0");
});
