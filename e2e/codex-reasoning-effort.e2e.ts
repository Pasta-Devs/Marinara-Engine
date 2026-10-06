import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

// #7083: a Codex (OpenAI ChatGPT) connection offers its thinking level in the connection's default parameters.
test("Codex connections set their thinking level in connection settings", async ({ page, request }, info) => {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
  const created = await request.post("/api/connections", {
    data: { name: "Codex effort fixture", provider: "openai_chatgpt", model: "gpt-6.1-sol" },
  });
  expect(created.ok()).toBeTruthy();
  const { id } = await created.json();
  // Never ask the real Codex model catalog.
  await page.route(`**/api/connections/${id}/models`, (route) =>
    route.fulfill({ json: { models: [{ id: "gpt-6.1-sol", name: "GPT-6.1-Sol" }] } }),
  );
  const effective = async () => {
    const response = await request.post("/api/generate/parameters", { data: { connectionId: id } });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    return { inherited: body.inheritedParameters.reasoningEffort, sent: body.parameters.reasoningEffort.value };
  };
  const saved = async () =>
    JSON.parse((await (await request.get(`/api/connections/${id}`)).json()).defaultParameters ?? "{}").reasoningEffort;
  const save = async () => {
    await page.getByRole("button", { name: "Save", exact: true }).click();
    // Saved shows once the editor has reloaded the saved connection, so later edits are not overwritten by that reload.
    await expect(page.getByText("Saved", { exact: true })).toBeAttached();
  };
  const open = async () => {
    await page.evaluate(async (id) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openConnectionDetail(id);
    }, id);
    await expect(page.getByPlaceholder("Connection name")).toHaveValue("Codex effort fixture");
  };

  try {
    // Until a level is picked, Codex keeps the model's own default instead of the preset's Maximum.
    expect(await effective()).toEqual({ inherited: null, sent: null });

    await page.goto("/");
    await open();
    const defaults = page.getByRole("checkbox", { name: "Use custom defaults for this connection", exact: true });
    await defaults.scrollIntoViewIfNeeded();
    await defaults.press("Space");
    await expect(defaults).toBeChecked();

    const reasoning = page.getByText("Reasoning Effort", { exact: true }).locator("../../..");
    await expect(reasoning.locator("button[aria-pressed]")).toHaveText([
      "Default",
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ]);
    await expect(reasoning.getByRole("button", { name: "Off", exact: true })).toHaveCount(0);
    // Turning on custom defaults starts at Default, so it does not pick a level by itself.
    await expect(reasoning.getByRole("button", { name: "Default", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await reasoning.getByRole("button", { name: "Show help", exact: true }).click();
    await expect(
      page.getByText("How long Codex thinks before answering; Default keeps Codex's own level for the model.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    const medium = reasoning.getByRole("button", { name: "medium", exact: true });
    await medium.click();
    await expect(medium).toHaveAttribute("aria-pressed", "true");
    await reasoning.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("codex-reasoning-effort.png"), animations: "disabled" });
    await save();
    await expect.poll(saved).toBe("medium");
    expect(await effective()).toEqual({ inherited: "medium", sent: "medium" });

    const providerDefault = reasoning.getByRole("button", { name: "Default", exact: true });
    await providerDefault.click();
    await expect(providerDefault).toHaveAttribute("aria-pressed", "true");
    await save();
    await expect.poll(saved).toBeNull();
    expect(await effective()).toEqual({ inherited: null, sent: null });
  } finally {
    await request.delete(`/api/connections/${id}`);
  }
});
