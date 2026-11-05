import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { clickTopbarPanel } from "./topbar-navigation.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("lorebook links copy across editors, merge without duplicates, and save normally", async ({
  page,
  request,
}, info) => {
  const resources: string[] = [];
  const create = async (path: string, data: unknown) => {
    const resource = await (await request.post(`/api/${path}`, { data, failOnStatusCode: true })).json();
    resources.push(`/api/${path}/${resource.id}`);
    return resource;
  };
  try {
    const character = await create("characters", { data: { name: "Copied character" } });
    const existing = await create("characters", { data: { name: "Existing character" } });
    const persona = await create("characters/personas", { name: "Copied persona" });
    const source = await create("lorebooks", {
      // The mobile projects share a server, so each run names its own books.
      name: `Source links ${info.project.name}`,
      characterIds: [character.id, "deleted-character"],
      personaIds: [persona.id],
    });
    const target = await create("lorebooks", {
      name: `Target links ${info.project.name}`,
      characterIds: [existing.id],
    });
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
    await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
    await page.goto("/");
    const open = async (name: string) => {
      if (!(await page.getByText(name, { exact: true }).isVisible())) await clickTopbarPanel(page, "lorebooks");
      await page.getByText(name, { exact: true }).click();
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    };
    await open(source.name);
    await page.getByText("Linked Characters", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("lorebook-links.png"), animations: "disabled" });
    await expect(page.getByRole("button", { name: "Paste links", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Copy links", exact: true }).click();
    // Leaving the editor unmounts it; the in-app clipboard survives navigation.
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await open(target.name);
    await page.getByRole("button", { name: "Paste links", exact: true }).click();
    // Repeated pastes must not duplicate the linked resources.
    await page.getByRole("button", { name: "Paste links", exact: true }).click();
    await expect(page.getByRole("main").getByText(persona.name, { exact: true })).toBeVisible();
    // The linked characters are one CharacterSelect field since #8763; it names every linked character.
    await expect(
      page.getByRole("main").getByText("Existing character, Copied character", { exact: true }),
    ).toBeVisible();
    const beforeSave = await (await request.get(`/api/lorebooks/${target.id}`)).json();
    expect(beforeSave.personaIds).toEqual([]);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(async () => (await (await request.get(`/api/lorebooks/${target.id}`)).json()).personaIds)
      .toEqual([persona.id]);
    const saved = await (await request.get(`/api/lorebooks/${target.id}`)).json();
    expect(saved.characterIds.sort()).toEqual([existing.id, character.id].sort());
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Paste links", exact: true }).click();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await page.reload();
    await open(target.name);
    await expect(page.getByRole("main").getByText(persona.name, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Paste links", exact: true })).toBeDisabled();
    await page.getByText("Linked Characters", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("lorebook-links-saved.png"), animations: "disabled" });
  } finally {
    await page.close();
    for (const path of resources.reverse()) await request.delete(path).catch(() => undefined);
  }
});

for (const kind of ["character", "persona"] as const) {
  test(`${kind} links paste when the unrelated resource query fails`, async ({ page, request }, info) => {
    test.skip(!info.project.name.includes("desktop"), "Query independence uses the same path on every viewport.");
    const path = kind === "character" ? "characters" : "characters/personas";
    const field = kind === "character" ? "characterIds" : "personaIds";
    const resource = await (
      await request.post(`/api/${path}`, {
        data: kind === "character" ? { data: { name: "Available character" } } : { name: "Available persona" },
        failOnStatusCode: true,
      })
    ).json();
    const source = await (
      await request.post("/api/lorebooks", {
        data: { name: "Available links", [field]: [resource.id] },
        failOnStatusCode: true,
      })
    ).json();
    const target = await (
      await request.post("/api/lorebooks", { data: { name: "Empty links" }, failOnStatusCode: true })
    ).json();
    try {
      await page.route(kind === "character" ? "**/api/characters/personas/list" : "**/api/characters", (route) =>
        route.fulfill({ status: 503, json: { error: "Unrelated library unavailable" } }),
      );
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
      await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
      await page.goto("/");
      await clickTopbarPanel(page, "lorebooks");
      await page.getByText(source.name, { exact: true }).click();
      await page.getByRole("button", { name: "Copy links", exact: true }).click();
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await page.getByText(target.name, { exact: true }).click();
      const paste = page.getByRole("button", { name: "Paste links", exact: true });
      await expect(paste).toBeEnabled();
      await paste.click();
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect
        .poll(async () => (await (await request.get(`/api/lorebooks/${target.id}`)).json())[field])
        .toEqual([resource.id]);
    } finally {
      await page.close();
      for (const url of [`/api/lorebooks/${source.id}`, `/api/lorebooks/${target.id}`, `/api/${path}/${resource.id}`]) {
        await request.delete(url).catch(() => undefined);
      }
    }
  });
}
