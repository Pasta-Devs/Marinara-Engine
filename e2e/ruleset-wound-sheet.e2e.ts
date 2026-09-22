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
