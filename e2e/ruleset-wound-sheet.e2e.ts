import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseRulesetDefinition } from "@marinara-engine/shared";
import { seedUIState } from "./ui-state-fixture.js";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";

const parsed = parseRulesetDefinition(
  JSON.parse(readFileSync(new URL("../docs/examples/rulesets/gravewatch.json", import.meta.url), "utf8")),
);
if (!parsed.ok) throw new Error(parsed.issues.join("; "));
const definition = parsed.definition;
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const theme of ["light", "dark"] as const) {
  test(`Ruleset wound sheet marks, heals and reloads without losing overflow (${theme})`, async ({
    page,
    request,
  }, info) => {
    const response = await request.post("/api/chats", {
      data: { name: "Wound sheet fixture", mode: "game", characterIds: [] },
    });
    expect(response.ok()).toBeTruthy();
    const chat = await response.json();
    try {
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, {
        theme,
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        chibiProfessorMariEnabled: false,
      });
      await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
      const mount = async (readOnly = false) => {
        await page.goto("/");
        await prepareViteFixtureDependencies(page);
        await page.evaluate(
          async ({ definition, chatId, readOnly }) => {
            const dependencyUrl = window.__viteFixtureDependencyUrl;
            const { default: React } = await import(dependencyUrl("react"));
            const { default: ReactDOM } = await import(dependencyUrl("react-dom_client"));
            const { GameRulesetSheet } = await import("/src/components/game/GameRulesetSheet.tsx" as string);
            const { api } = await import("/src/lib/api-client.ts" as string);
            const state = await api.get(`/chats/${chatId}/game-state`);
            const container = document.createElement("div");
            container.dataset.woundFixture = "true";
            container.style.cssText =
              "position:fixed;inset:0;z-index:10000;overflow:auto;padding:16px;background:var(--background);color:var(--foreground)";
            document.body.append(container);
            function Fixture() {
              const [live, setLive] = React.useState(state?.rulesetLive?.warden ?? {});
              return React.createElement(GameRulesetSheet, {
                definition,
                cardName: "Warden",
                envelope: undefined,
                live,
                readOnly,
                onEnvelopeSave: () => {},
                onLiveChange: (next: unknown) => {
                  setLive(next);
                  void api
                    .patch(`/chats/${chatId}/game-state`, { manual: true, rulesetLive: { warden: next } })
                    .catch((error: unknown) => {
                      container.dataset.saveError = String(error);
                    });
                },
              });
            }
            ReactDOM.createRoot(container).render(React.createElement(Fixture));
          },
          { definition, chatId: chat.id, readOnly },
        );
      };
      const persisted = async () =>
        (await (await request.get(`/api/chats/${chat.id}/game-state`)).json()).rulesetLive?.warden?.wounds?.harm;
      const sheet = page.locator("[data-wound-fixture]");
      const mark = sheet.getByRole("button", { name: "Mark", exact: true });
      const clear = sheet.getByRole("button", { name: "Clear one", exact: true });
      await mount();
      await expect(clear).toBeDisabled();
      await mark.click();
      await expect.poll(persisted).toMatchObject({ marks: ["knock"] });
      await expect(sheet.getByRole("button", { name: /^Scuffed, 0 to rolls, marked K/ })).toBeEnabled();
      await sheet.screenshot({ path: info.outputPath(`wound-zero-penalty-${theme}.png`) });
      await expect(sheet.getByRole("status")).toHaveText("Harm applies no penalty to your rolls.");
      await sheet.getByRole("button", { name: "Mark Harm with T", exact: true }).click();
      await mark.click();
      await expect.poll(persisted).toMatchObject({ marks: ["tear", "knock"] });
      await expect(sheet.getByRole("status")).toHaveText("Harm is at Winded, so -1 applies to your rolls.");
      await clear.click();
      await expect.poll(persisted).toMatchObject({ marks: ["tear"] });
      for (let count = 2; count <= 4; count++) {
        await mark.click();
        await expect.poll(persisted).toMatchObject({ marks: Array(count).fill("tear") });
      }
      await mark.click();
      await expect.poll(persisted).toMatchObject({ marks: ["tear", "tear", "tear", "tear"], overflow: 1 });
      await expect(sheet.getByRole("status")).toContainText("1 more mark had nowhere to go.");
      await sheet.screenshot({ path: info.outputPath(`wound-overflow-${theme}.png`) });
      // A heal would take the overflow first, so no box is offered for clearing; Clear one is.
      await expect(sheet.getByRole("button", { name: /^Down, -99 to rolls, marked T/ })).toBeDisabled();
      await expect(clear).toBeEnabled();
      await mount();
      await expect(sheet.getByRole("status")).toContainText("1 more mark had nowhere to go.");
      await clear.click();
      await expect.poll(persisted).toMatchObject({ marks: ["tear", "tear", "tear", "tear"] });
      await expect.poll(async () => (await persisted()).overflow ?? 0).toBe(0);
      await expect(sheet.getByRole("status")).not.toContainText("nowhere to go");
      expect(await sheet.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await mount(true);
      await expect(mark).toBeDisabled();
      await expect(clear).toBeDisabled();
      await expect(sheet.getByRole("button", { name: "Mark Harm with T", exact: true })).toBeDisabled();
    } finally {
      await page.close();
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });
}

const embered = parseRulesetDefinition(
  JSON.parse(readFileSync(new URL("../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8")),
);
if (!embered.ok) throw new Error(embered.issues.join("; "));
const ember = embered.definition;

test("Ruleset box track marks the box clicked, clears the highest, and refuses when full", async ({
  page,
  request,
}, info) => {
  const response = await request.post("/api/chats", {
    data: { name: "Box track fixture", mode: "game", characterIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  const chat = await response.json();
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      theme: "light",
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chibiProfessorMariEnabled: false,
    });
    await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
    await page.goto("/");
    await prepareViteFixtureDependencies(page);
    // Heart 2 on Ember Roads is four Strain boxes, which fill by box and refuse a mark when full.
    await page.evaluate(
      async ({ definition, chatId }) => {
        const dependencyUrl = window.__viteFixtureDependencyUrl;
        const { default: React } = await import(dependencyUrl("react"));
        const { default: ReactDOM } = await import(dependencyUrl("react-dom_client"));
        const { GameRulesetSheet } = await import("/src/components/game/GameRulesetSheet.tsx" as string);
        const { api } = await import("/src/lib/api-client.ts" as string);
        const container = document.createElement("div");
        container.dataset.boxFixture = "true";
        container.style.cssText =
          "position:fixed;inset:0;z-index:10000;overflow:auto;padding:16px;background:var(--background);color:var(--foreground)";
        document.body.append(container);
        const build = {
          abilities: { brawn: 0, wits: 0, heart: 2 },
          skills: {},
          saves: {},
          bonuses: {},
          fields: {},
          lists: {},
        };
        function Fixture() {
          const [live, setLive] = React.useState({});
          return React.createElement(GameRulesetSheet, {
            definition,
            cardName: "Traveller",
            envelope: { v: definition.sheet.version, build },
            live,
            readOnly: false,
            onEnvelopeSave: () => {},
            onLiveChange: (next: unknown) => {
              setLive(next);
              void api.patch(`/chats/${chatId}/game-state`, { manual: true, rulesetLive: { traveller: next } });
            },
          });
        }
        ReactDOM.createRoot(container).render(React.createElement(Fixture));
      },
      { definition: ember, chatId: chat.id },
    );
    const persisted = async () =>
      (await (await request.get(`/api/chats/${chat.id}/game-state`)).json()).rulesetLive?.traveller?.wounds?.strain;
    const sheet = page.locator("[data-box-fixture]");
    const box = (n: number) => sheet.getByRole("button", { name: new RegExp(`^Box ${n}, `) });
    const mark = sheet.getByRole("button", { name: "Mark", exact: true });
    const clear = sheet.getByRole("button", { name: "Clear one", exact: true });
    await expect(box(4)).toBeVisible();
    await expect(box(5)).toHaveCount(0);

    // Any clear box takes a mark where it is, and the marks never move.
    await box(3).click();
    await expect.poll(persisted).toMatchObject({ marks: ["", "", "strain"] });
    await expect(sheet.getByRole("status")).toHaveText(
      "Strain has 1 of 4 boxes marked, with no penalty to your rolls.",
    );
    await box(1).click();
    await expect.poll(persisted).toMatchObject({ marks: ["strain", "", "strain"] });
    // Only the box a heal would clear is offered for clearing: the highest of the marks.
    await expect(box(1)).toBeDisabled();
    await expect(box(3)).toBeEnabled();
    await clear.click();
    await expect.poll(persisted).toMatchObject({ marks: ["strain"] });

    // Full, the track refuses another mark, so Mark is off, and the table's penalty is said in boxes.
    for (const n of [2, 3, 4]) {
      await box(n).click();
      await expect.poll(async () => ((await persisted())?.marks ?? []).filter(Boolean).length).toBe(n);
    }
    await expect(mark).toBeDisabled();
    await expect(sheet.getByRole("status")).toHaveText("Strain has 4 of 4 boxes marked, so -1 applies to your rolls.");
    await sheet.screenshot({ path: info.outputPath("box-track-full.png") });
    expect(await sheet.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  } finally {
    await page.close();
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
});
