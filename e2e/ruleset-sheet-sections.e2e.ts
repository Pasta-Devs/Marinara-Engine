import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseRulesetDefinition } from "@marinara-engine/shared";
import { seedUIState } from "./ui-state-fixture.js";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";

const load = (name: string) => {
  const parsed = parseRulesetDefinition(
    JSON.parse(readFileSync(new URL(`../docs/examples/rulesets/${name}.json`, import.meta.url), "utf8")),
  );
  if (!parsed.ok) throw new Error(parsed.issues.join("; "));
  return parsed.definition;
};
const gravewatch = load("gravewatch");
const ember = load("ember-roads");
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const theme of ["light", "dark"] as const) {
  test(`Ruleset sheet groups skills under their sections, and applies what untrained costs (${theme})`, async ({
    page,
  }, info) => {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      theme,
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chibiProfessorMariEnabled: false,
    });
    await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
    await page.goto("/");
    await prepareViteFixtureDependencies(page);
    // The sheet editor for Gravewatch and for Ember Roads, and the game's sheet for a warden trained in
    // Ward and Barter, side by side.
    await page.evaluate(
      async ({ gravewatch, ember }) => {
        const dependencyUrl = window.__viteFixtureDependencyUrl;
        const { default: React } = await import(dependencyUrl("react"));
        const { default: ReactDOM } = await import(dependencyUrl("react-dom_client"));
        const { QueryClient, QueryClientProvider } = await import(dependencyUrl("@tanstack_react-query"));
        const { RulesetSheetEditor } = await import("/src/components/rulesets/RulesetSheetEditor.tsx" as string);
        const { GameRulesetSheet } = await import("/src/components/game/GameRulesetSheet.tsx" as string);
        const container = document.createElement("div");
        container.style.cssText =
          "position:fixed;inset:0;z-index:10000;overflow:auto;padding:16px;background:var(--background);color:var(--foreground)";
        document.body.append(container);
        const trained = {
          abilities: { sinew: 2, nerve: 2, warmth: 2 },
          skills: { ward: "rating_2", barter: "rating_1" },
          saves: {},
          bonuses: {},
          fields: {},
          lists: {},
        };
        function Editor({ definition, testId }: { definition: unknown; testId: string }) {
          const [envelope, setEnvelope] = React.useState(undefined);
          return React.createElement(
            "div",
            { "data-testid": testId },
            React.createElement(RulesetSheetEditor, { definition, envelope, onChange: setEnvelope }),
          );
        }
        ReactDOM.createRoot(container).render(
          React.createElement(
            QueryClientProvider,
            { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
            React.createElement(Editor, { definition: gravewatch, testId: "gravewatch-editor" }),
            React.createElement(Editor, { definition: ember, testId: "ember-editor" }),
            React.createElement(
              "div",
              { "data-testid": "gravewatch-game" },
              React.createElement(GameRulesetSheet, {
                definition: gravewatch,
                cardName: "Warden",
                envelope: { v: gravewatch.sheet.version, build: trained },
                live: {},
                readOnly: true,
                onEnvelopeSave: () => {},
                onLiveChange: () => {},
              }),
            ),
          ),
        );
      },
      { gravewatch, ember },
    );

    const editor = page.getByTestId("gravewatch-editor");
    // Each section heading comes before its own skills, in the sheet's order.
    const text = await editor.innerText();
    const at = (needle: string) => text.indexOf(needle);
    for (const [heading, first] of [
      ["Labour", "Dig"],
      ["The watch", "Listen"],
      ["Company", "Soothe"],
    ] as const) {
      expect(at(heading), heading).toBeGreaterThan(-1);
      expect(at(heading), `${heading} before ${first}`).toBeLessThan(at(first));
    }
    expect(at("Labour")).toBeLessThan(at("The watch"));
    expect(at("The watch")).toBeLessThan(at("Company"));
    // Untrained Wrestle loses its section's die: Sinew 2 is one die.
    const wrestle = editor
      .locator("div")
      .filter({ hasText: /^Wrestle/ })
      .last();
    await expect(wrestle).toContainText("1 die");
    // Untrained Dig cannot be attempted at all, so it shows no number that would promise a roll.
    await expect(editor.getByLabel("Dig cannot be attempted untrained")).toHaveText("—");

    // Ember Roads names no section on its skills, so none is drawn, and untrained Tinker costs two.
    const emberEditor = page.getByTestId("ember-editor");
    await expect(emberEditor.getByText("Labour", { exact: true })).toHaveCount(0);
    await expect(
      emberEditor
        .locator("div")
        .filter({ hasText: /^Tinker/ })
        .last(),
    ).toContainText("-2");

    // The game's sheet lists what the warden is trained in under the same headings.
    const game = page.getByTestId("gravewatch-game");
    const chips = await game.innerText();
    expect(chips).toMatch(/the watch\s+Ward 4 dice/i);
    expect(chips).toMatch(/company\s+Barter 3 dice/i);

    await page.screenshot({ path: info.outputPath(`sheet-sections-${theme}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
