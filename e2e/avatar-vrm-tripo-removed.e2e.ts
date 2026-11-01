import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { tripoMadeVrm } from "../scripts/regressions/fixtures/avatar-3d-fixtures.js";
import { seedUIState } from "./ui-state-fixture.js";

// One-click Tripo models were withdrawn (maintainer decision, 2026-10-19): Tripo models have no face rig, so
// their mouth can't move. This replaces the e2e that drove the Tripo maker. 3D Avatars → Get a 3D model points
// to VRoid Studio and the VRM import, keeps the guide and Copy prompt, and has no Tripo key field or maker; the
// page never asks the server about Tripo, whose routes are gone. A model the generator made earlier still
// imports through the real server and shows as body only, with no faces to pick. Connections doesn't offer
// Tripo either. A VRoid Studio project (.vroid) picked by mistake gets one plain hint and is never uploaded.
const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;
const FIRST_LOAD_TIMEOUT_MS = 30_000;

const PACKAGE = {
  id: "3d-avatars",
  version: "1.0.0",
  status: "active",
  readiness: "ready",
  readinessError: null,
  error: null,
  legacy: false,
  installedAt: "2026-10-13T00:00:00.000Z",
  manifest: {
    schemaVersion: 2,
    id: "3d-avatars",
    name: "3D Avatars",
    version: "1.0.0",
    description: "3D avatars.",
    engine: { min: "2.5.0", maxExclusive: "4.0.0" },
    capabilityApi: { major: 1, minor: 73 },
    kind: ["agent"],
    entrypoints: { agents: "agents.json" },
    files: [{ path: "agents.json", sha256: "0".repeat(64), bytes: 1 }],
    permissions: ["ui"],
    restartRequired: false,
  },
};
const AGENT = {
  id: "3d-avatars",
  packageId: "3d-avatars",
  name: "3D Avatars",
  description: "3D avatars for characters and personas.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "misc",
  execution: "host",
  defaultPromptTemplate: "",
};

/** Requests the page makes to the removed Tripo routes. */
function watchTripoRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (/\/api\/avatar-generation\/(?:tripo-key|vrm-model)/u.test(pathname)) seen.push(pathname);
  });
  return seen;
}

async function openSetup(page: Page, characterId: string | null) {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [PACKAGE] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [AGENT] }));
  await page.route("**/api/avatar-models", async (route) => {
    const response = await route.fetch();
    const owners = (await response.json()) as Array<{ owner: { ownerId: string } }>;
    await route.fulfill({ response, json: owners.filter((summary) => summary.owner.ownerId === characterId) });
  });
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    trackerPanelEnabled: false,
    trackerPanelOpen: false,
    agentDetailId: "3d-avatars",
  });
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    localStorage.removeItem("marinara-active-chat-id");
  }, APP_VERSION);
  await page.goto("/");
  const setup = page.locator('[data-avatar-setup="3d-avatars"]');
  await expect(setup).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT_MS });
  if (characterId) await setup.getByLabel("Character or persona").selectOption(`character:${characterId}`);
  return setup;
}

test("3D Avatars points to VRoid Studio and Import VRM, with no Tripo maker", async ({ page, request }, info) => {
  const characterResponse = await request.post("/api/characters", { data: { data: { name: "VRoid fixture" } } });
  expect(characterResponse.ok(), await characterResponse.text()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  try {
    const tripoRequests = watchTripoRequests(page);
    const setup = await openSetup(page, character.id);
    await expect(setup.getByRole("button", { name: "Import VRM", exact: true })).toBeVisible({
      timeout: FIRST_LOAD_TIMEOUT_MS,
    });
    const guide = setup.locator("section").filter({ has: page.getByRole("heading", { name: "Get a 3D model" }) });
    await expect(guide.getByText("Make one in VRoid Studio, then add it with Import VRM above.")).toBeVisible();
    await expect(guide.getByRole("button", { name: "Read the guide", exact: true })).toBeVisible();
    await expect(guide.getByRole("button", { name: "Copy prompt", exact: true })).toBeVisible();
    await guide.screenshot({ path: info.outputPath("vrm-get-model.png"), animations: "disabled" });

    await expect(setup.locator("[data-vrm-model-maker], [data-tripo-key]")).toHaveCount(0);
    await expect(setup.getByRole("button", { name: "Make 3D model", exact: true })).toHaveCount(0);
    await expect(setup.getByText(/Tripo/u)).toHaveCount(0);
    expect(tripoRequests, "the page never asks about Tripo").toEqual([]);

    // The server's Tripo routes are gone.
    expect((await request.get("/api/avatar-generation/tripo-key")).status()).toBe(404);
    expect((await request.get("/api/avatar-generation/vrm-model/balance")).status()).toBe(404);
    const run = await request.post("/api/avatar-generation/vrm-model", {
      data: { owner: { ownerType: "character", ownerId: character.id }, sourceLabel: "full_neutral" },
    });
    expect(run.status()).toBe(404);
  } finally {
    await request.delete(`/api/characters/${character.id}`).catch(() => undefined);
  }
});

test("Import VRM explains a VRoid Studio project file and never uploads it", async ({ page, request }, info) => {
  const characterResponse = await request.post("/api/characters", { data: { data: { name: "VRoid project" } } });
  expect(characterResponse.ok(), await characterResponse.text()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  try {
    const uploads: string[] = [];
    page.on("request", (sent) => {
      if (sent.method() === "POST" && new URL(sent.url()).pathname.endsWith("/import")) uploads.push(sent.url());
    });
    const setup = await openSetup(page, character.id);
    const importButton = setup.getByRole("button", { name: "Import VRM", exact: true });
    await expect(importButton).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT_MS });
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), importButton.click()]);
    // A picker filtered to .vrm alone would grey the project out, so the hint could never show.
    expect(await chooser.element().getAttribute("accept")).toBe(".vrm,.vroid");
    // VRoid Studio saves projects as ZIP archives.
    await chooser.setFiles({
      name: "Maukie.vroid",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("PK\u0003\u0004VRoid Studio project"),
    });
    await expect(
      page.getByText(
        "That's a VRoid Studio project. In VRoid Studio, choose Export as VRM, then import the .vrm file.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.screenshot({ path: info.outputPath("vrm-vroid-project-hint.png"), animations: "disabled" });
    expect(uploads, "the project is never uploaded").toEqual([]);
    await expect(setup.getByRole("button", { name: "Import VRM", exact: true })).toBeEnabled();
  } finally {
    await request.delete(`/api/characters/${character.id}`).catch(() => undefined);
  }
});

test("dropping a VRoid project anywhere in 3D Avatars explains it before choosing an owner", async ({ page }) => {
  const uploads: string[] = [];
  page.on("request", (sent) => {
    if (sent.method() === "POST" && new URL(sent.url()).pathname.endsWith("/import")) uploads.push(sent.url());
  });
  const setup = await openSetup(page, null);
  await expect(setup.getByLabel("Character or persona")).toHaveValue("");
  const result = await setup.evaluate((element) => {
    const other = new DataTransfer();
    other.setData("text/plain", "an unrelated resource");
    const otherDrag = new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: other });
    const otherDrop = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: other });
    element.dispatchEvent(otherDrag);
    element.dispatchEvent(otherDrop);
    const files = new DataTransfer();
    files.items.add(new File(["VRoid Studio project"], "Maukie.VROID", { type: "application/octet-stream" }));
    const drag = new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: files });
    const drop = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: files });
    element.dispatchEvent(drag);
    element.dispatchEvent(drop);
    return {
      fileDragAccepted: drag.defaultPrevented,
      projectDropHandled: drop.defaultPrevented,
      otherDragHandled: otherDrag.defaultPrevented,
      otherDropHandled: otherDrop.defaultPrevented,
    };
  });
  expect(result).toEqual({
    fileDragAccepted: true,
    projectDropHandled: true,
    otherDragHandled: false,
    otherDropHandled: false,
  });
  await expect(
    page.getByText("That's a VRoid Studio project. In VRoid Studio, choose Export as VRM, then import the .vrm file.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(uploads, "a dropped project is never uploaded").toEqual([]);
});

test("A model made earlier with Tripo still loads in setup as body only", async ({ page, request }, info) => {
  const characterResponse = await request.post("/api/characters", { data: { data: { name: "Maukie fixture" } } });
  expect(characterResponse.ok(), await characterResponse.text()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  try {
    const imported = await request.post(`/api/avatar-models/character/${character.id}/import`, {
      multipart: { file: { name: "Maukie.vrm", mimeType: "model/gltf-binary", buffer: tripoMadeVrm() } },
    });
    expect(imported.ok(), await imported.text()).toBeTruthy();

    const tripoRequests = watchTripoRequests(page);
    const setup = await openSetup(page, character.id);
    await expect(setup.getByText("Maukie", { exact: true })).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT_MS });
    await expect(setup.getByText("VRM 1.0 by Tripo AI", { exact: true })).toBeVisible();
    await expect(setup.locator("[data-vrm-body-only]")).toHaveText("Body only, the face doesn't move.");
    await expect(setup.getByLabel("Mouth: A", { exact: true })).toHaveCount(0);
    await expect(setup.getByText("Make one in VRoid Studio, then add it with Replace model above.")).toBeVisible();
    await setup.screenshot({ path: info.outputPath("vrm-tripo-made-model.png"), animations: "disabled" });
    expect(tripoRequests).toEqual([]);

    const uploads: string[] = [];
    page.on("request", (sent) => {
      if (sent.method() === "POST" && new URL(sent.url()).pathname.endsWith("/import")) uploads.push(sent.url());
    });
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      setup.getByRole("button", { name: "Replace model", exact: true }).click(),
    ]);
    await chooser.setFiles({
      name: "Maukie.vroid",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("project"),
    });
    await expect(
      page.getByText(
        "That's a VRoid Studio project. In VRoid Studio, choose Export as VRM, then import the .vrm file.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(uploads, "a project cannot replace the saved model").toEqual([]);

    const saved = (await (await request.get(`/api/avatar-models/character/${character.id}`)).json()) as {
      activeKind: string;
      kinds: { vrm: { expressionNames: string[]; meta: { title: string } } };
    };
    expect(saved.activeKind).toBe("vrm");
    expect(saved.kinds.vrm.expressionNames).toEqual([]);
    expect(saved.kinds.vrm.meta.title).toBe("Maukie");
  } finally {
    await request.delete(`/api/characters/${character.id}`).catch(() => undefined);
  }
});

test("Connections no longer offers Tripo", async ({ page, request }) => {
  const refused = await request.post("/api/connections", {
    data: { name: "Tripo test", provider: "tripo", apiKey: "tsk_e2e_never_shown" },
  });
  expect(refused.status(), "the server refuses a Tripo connection").toBe(400);
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    localStorage.removeItem("marinara-active-chat-id");
  }, APP_VERSION);
  await page.goto("/");
  await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.getState().openModal("create-connection");
  });
  const dialog = page.getByRole("dialog");
  // Services show 4 tiles until "Show all N" in the Add window.
  await dialog.getByRole("button", { name: /^Show all/ }).click({ timeout: FIRST_LOAD_TIMEOUT_MS });
  await expect(dialog.getByRole("button", { name: "OpenAI", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Tripo", exact: true })).toHaveCount(0);
});
