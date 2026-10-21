import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { EXPERIENCE_FILE_CONTENT_TYPE, experienceFileParts } from "@marinara-engine/shared";
import { seedUIState } from "./ui-state-fixture.js";

// Experience files (Capability API 1.373): the Game wizard reads a file's manifest from its start, shows
// how big the import is and what it is made of, and sends the file only when the player chooses Import.

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

const files = [
  { path: "art/portrait.png", data: new Uint8Array(300_000).fill(7) },
  { path: "music/theme.ogg", data: new Uint8Array(600_000).fill(3) },
  { path: "music/fight.ogg", data: new Uint8Array(60_000).fill(5) },
  { path: "worlds/vale.json", data: new TextEncoder().encode(JSON.stringify({ vale: "x".repeat(40_000) })) },
];
const manifest = {
  schemaVersion: 2,
  id: "held-autumn-file",
  name: "The Held Autumn (file)",
  version: "1.0.0",
  description: "A harvest that will not end.",
  capabilityApi: { major: 1, minor: 373 },
  builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
  engine: { min: "2.3.0", maxExclusive: "4.0.0" },
  kind: ["experience"],
  entrypoints: {},
  contributions: { slots: ["game-surface"], gameSurface: { setup: {} } },
  files: files.map((file) => ({ path: file.path, sha256: sha256(file.data), bytes: file.data.byteLength })),
  permissions: [],
  restartRequired: false,
};
const experienceFile = Buffer.from(experienceFileParts(manifest, files).join(""));
const installedRecord = {
  id: manifest.id,
  version: manifest.version,
  manifest,
  installedAt: "2026-10-13T00:00:00.000Z",
  status: "active",
  error: null,
  readiness: "ready",
  readinessError: null,
  legacy: false,
};

async function mountWizard(page: Page, testInfo: TestInfo) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/connections", (route) =>
    route.fulfill({
      json: [
        { id: "wizard-connection", name: "Wizard connection", provider: "custom", model: "fixture", isDefault: true },
      ],
    }),
  );
  await page.route("**/api/lorebooks", (route) => route.fulfill({ json: [] }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    theme: testInfo.project.name === "desktop-chromium" ? "light" : "dark",
  });
  await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What shall we cook tonight?", exact: true })).toBeVisible({
    timeout: 40_000,
  });
  await prepareViteFixtureDependencies(page);
  await page.evaluate(async () => {
    const { GameSetupWizard } = await import("/src/components/game/GameSetupWizard.tsx" as string);
    const dependencyUrl = window.__viteFixtureDependencyUrl;
    const { default: React } = await import(dependencyUrl("react"));
    const { default: ReactDOM } = await import(dependencyUrl("react-dom_client"));
    const { QueryClient, QueryClientProvider } = await import(dependencyUrl("@tanstack_react-query"));
    const container = document.createElement("div");
    document.body.append(container);
    ReactDOM.createRoot(container).render(
      React.createElement(
        QueryClientProvider,
        { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        React.createElement(GameSetupWizard, {
          activeChatId: "wizard-chat",
          isNewGame: true,
          chatMetadata: {},
          onSetupError: () => false,
          onCancel: () => {},
          isLoading: false,
          isDraftingMap: false,
          isLinkingSharedWorld: false,
          characters: [],
          onComplete: () => {},
        }),
      ),
    );
  });
  const wizard = page.locator('[data-component="GameSetupWizard"]');
  await expect(wizard).toBeVisible();
  return wizard;
}

test("an Experience file is reviewed before import: its size, what it is made of, Import or Don't Import", async ({
  page,
}, testInfo) => {
  let installed: unknown[] = [];
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: installed }));
  const uploads: Array<{ contentType: string | undefined; body: Buffer | null }> = [];
  await page.route("**/api/capability-packages/experience-file", (route) => {
    uploads.push({ contentType: route.request().headers()["content-type"], body: route.request().postDataBuffer() });
    installed = [installedRecord];
    return route.fulfill({ json: { ...installedRecord, usesDecisions: false } });
  });
  const wizard = await mountWizard(page, testInfo);
  await wizard.getByRole("button", { name: "Show", exact: true }).first().click();
  const input = page.getByTestId("experience-file-input");

  // Not an Experience file: said so, and nothing is sent.
  await input.setInputFiles({
    name: "held.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("PK\u0003\u0004zip"),
  });
  await expect(
    wizard.getByText(/^This file cannot be imported as an Experience: This is not an Experience file\./),
  ).toBeVisible();

  // The review: read from the file's start, before anything is sent.
  await input.setInputFiles({
    name: "the-held-autumn.experience.json",
    mimeType: "application/json",
    buffer: experienceFile,
  });
  const dialog = page.getByRole("dialog", { name: "Import an Experience" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("The Held Autumn (file)", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/^An Experience file holds no code/)).toBeVisible();
  const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  await expect(dialog.getByTestId("experience-import-size")).toHaveText(mb(experienceFile.length));
  const total = files.reduce((sum, file) => sum + file.data.length, 0);
  const share = (bytes: number) => Math.round((bytes / total) * 100);
  await expect(dialog.getByTestId("experience-import-image")).toContainText(`${share(300_000)}% (293.0 KB, 1 file)`);
  await expect(dialog.getByTestId("experience-import-audio")).toContainText(`${share(660_000)}% (644.5 KB, 2 files)`);
  await expect(dialog.getByTestId("experience-import-data")).toContainText(`${share(files[3]!.data.length)}%`);
  await page.screenshot({ path: testInfo.outputPath("experience-file-review.png") });

  // Don't Import: the dialog closes and nothing was sent.
  await dialog.getByRole("button", { name: "Don't Import", exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(uploads).toEqual([]);

  // Import: the file goes up as it is, and the Experience is switched on for this game.
  await input.setInputFiles({
    name: "the-held-autumn.experience.json",
    mimeType: "application/json",
    buffer: experienceFile,
  });
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(uploads).toHaveLength(1);
  expect(uploads[0]!.contentType).toBe(EXPERIENCE_FILE_CONTENT_TYPE);
  expect(uploads[0]!.body?.equals(experienceFile)).toBe(true);
  await expect(
    wizard.getByText("Imported The Held Autumn (file). It is on for this game.", { exact: true }),
  ).toBeVisible();
  await expect(wizard.getByRole("switch", { name: /The Held Autumn \(file\)/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("a refused import says why in the review and keeps it open", async ({ page }, testInfo) => {
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/experience-file", (route) =>
    route.fulfill({ status: 400, json: { error: "music/theme.ogg does not match its manifest's checksum" } }),
  );
  const wizard = await mountWizard(page, testInfo);
  await wizard.getByRole("button", { name: "Show", exact: true }).first().click();
  await page.getByTestId("experience-file-input").setInputFiles({
    name: "the-held-autumn.experience.json",
    mimeType: "application/json",
    buffer: experienceFile,
  });
  const dialog = page.getByRole("dialog", { name: "Import an Experience" });
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("music/theme.ogg does not match its manifest's checksum");
  await expect(dialog).toBeVisible();
});
