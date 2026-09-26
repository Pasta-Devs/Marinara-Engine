import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseRulesetDefinition } from "@marinara-engine/shared";
import { seedUIState } from "./ui-state-fixture.js";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";

const parsed = parseRulesetDefinition(
  JSON.parse(readFileSync(new URL("../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8")),
);
if (!parsed.ok) throw new Error(parsed.issues.join("; "));
const ember = parsed.definition;
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const theme of ["light", "dark"] as const) {
  test(`Ruleset sheet picks a live state, keeps it sparse, and a rest puts it back (${theme})`, async ({
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
    // The game's sheet for a traveller on Ember Roads, holding its live state the way the game does
    // and writing every change it is handed where the case can read it.
    await page.evaluate(
      async ({ ember }) => {
        const dependencyUrl = window.__viteFixtureDependencyUrl;
        const { default: React } = await import(dependencyUrl("react"));
        const { default: ReactDOM } = await import(dependencyUrl("react-dom_client"));
        const { QueryClient, QueryClientProvider } = await import(dependencyUrl("@tanstack_react-query"));
        const { GameRulesetSheet } = await import("/src/components/game/GameRulesetSheet.tsx" as string);
        const container = document.createElement("div");
        container.style.cssText =
          "position:fixed;inset:0;z-index:10000;overflow:auto;padding:16px;background:var(--background);color:var(--foreground)";
        document.body.append(container);
        const build = {
          abilities: { brawn: 2, wits: 1, heart: 1 },
          skills: {},
          saves: {},
          bonuses: {},
          fields: {},
          lists: {},
        };
        function Sheet() {
          const [live, setLive] = React.useState(undefined as unknown);
          return React.createElement(
            "div",
            { "data-testid": "sheet", "data-live": JSON.stringify(live ?? null) },
            React.createElement(GameRulesetSheet, {
              definition: ember,
              cardName: "Juno",
              envelope: { v: ember.sheet.version, build },
              live,
              readOnly: false,
              onEnvelopeSave: () => {},
              onLiveChange: setLive,
            }),
          );
        }
        ReactDOM.createRoot(container).render(
          React.createElement(
            QueryClientProvider,
            { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
            React.createElement(Sheet),
          ),
        );
      },
      { ember },
    );

    const sheet = page.getByTestId("sheet");
    const stance = sheet.getByLabel("Stance for Juno");
    // It starts where the ruleset says, and nothing is stored for a state at its default.
    await expect(stance).toHaveValue("steady");
    await expect(stance.locator("option")).toHaveText(["Guarded", "Steady", "Reckless"]);
    await expect(sheet).toHaveAttribute("data-live", "null");

    await stance.selectOption({ label: "Reckless" });
    await expect(stance).toHaveValue("reckless");
    await expect(sheet).toHaveAttribute("data-live", JSON.stringify({ states: { stance: "reckless" } }));
    await page.screenshot({ path: info.outputPath(`live-state-${theme}.png`), fullPage: true });

    // Making camp settles it, and a state back at its default is not stored.
    await sheet.getByRole("button", { name: "Make camp for Juno" }).click();
    await expect(stance).toHaveValue("steady");
    await expect
      .poll(async () => JSON.parse((await sheet.getAttribute("data-live")) ?? "null")?.states ?? null)
      .toBeNull();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
