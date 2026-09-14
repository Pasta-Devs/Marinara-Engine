// The setup seam, end to end. An Experience that declares `contributions.gameSurface.setup` no longer
// swaps the wizard body out: every step stays mounted, the host draws the declared seed field inside the
// Experiences block, and the declared requirement is explained beside the control it governs. An
// Experience that declares NO `setup` block still owns its whole form, so the host hands the body over to
// it exactly as it did before the seam.
//
// Both fixtures are hand-written manifests served to `/api/capability-packages/installed`, the same way
// `capability-permissions.e2e.ts` does it, so no package has to be installed for this to run. Nothing here
// names a shipped package: the seam is keyed off the DECLARATION, and so is this spec.
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

const SEED_LABEL = "World seed";
const SEED_KEY = "seed";
const MAX_SEED = 4_294_967_295;
const RANDOMIZE_HINT = "Replaces the seed with a new random number, including one you typed.";

const SEAM_EXPERIENCE = { id: "setup-seam-fixture", name: "Setup Seam Fixture" };
const LEGACY_EXPERIENCE = { id: "legacy-seam-fixture", name: "Legacy Seam Fixture" };

// Both proofs below are desktop-only: the seam is layout-independent, so one viewport proves it. The gate
// is declared at file scope rather than inside each test body on purpose. An in-body `test.skip` runs only
// after Playwright has built the test's fixtures, so a desktop-only spec still launches a browser in every
// project just to skip — and a project whose browser cannot start reports a failure instead of a skip. A
// file-scope modifier is evaluated first, and this one reads only the `isMobile` device option (the
// modifier callback is handed fixtures, not `testInfo`), so no browser is launched for the projects that
// skip. `isMobile` is the device flag the mobile projects carry and the desktop project does not, which is
// the same split the project names describe.
test.skip(({ isMobile }) => isMobile, "The setup seam and its pre-seam fallback are covered on desktop.");

/** A game-surface manifest. `setup` present is the seam path; absent is the pre-seam body swap. */
function gameSurfaceManifest(experience: { id: string; name: string }, declaresSetup: boolean) {
  return {
    schemaVersion: 2,
    id: experience.id,
    name: experience.name,
    version: "1.0.0",
    description: `${experience.name} game surface test manifest.`,
    author: "Pasta Devs",
    engine: { min: "2.3.0", maxExclusive: "3.0.0" },
    capabilityApi: { major: 1, minor: 17 },
    builtAgainst: { engineVersion: "2.4.5", engineCommit: "0".repeat(40) },
    kind: ["turn-game"],
    entrypoints: { client: "client.js" },
    files: [],
    permissions: [],
    restartRequired: false,
    contributions: {
      slots: ["game-surface"],
      gameSurface: {
        surfaceClass: "seam-fixture-surface",
        ...(declaresSetup
          ? {
              setup: {
                seed: { key: SEED_KEY, label: SEED_LABEL },
                config: { generate: true },
                requires: { enableCustomWidgets: false },
              },
            }
          : {}),
      },
    },
  };
}

function installedEntry(experience: { id: string; name: string }, declaresSetup: boolean) {
  return {
    id: experience.id,
    version: "1.0.0",
    manifest: gameSurfaceManifest(experience, declaresSetup),
    installedAt: "2026-09-12T00:00:00.000Z",
    status: "active",
    readiness: "ready",
    error: null,
    readinessError: null,
    legacy: false,
  };
}

/** A client bundle that only registers the custom element the host mounts, so the package side of the
 *  legacy path resolves instead of sitting in a load-failure state the assertions would have to tolerate. */
function clientModuleSource(packageId: string) {
  const tag = `marinara-capability-${packageId}`;
  return `class SeamFixtureElement extends HTMLElement {
  connectedCallback() {
    this.setAttribute("data-seam-fixture", "mounted");
  }
}
if (!customElements.get(${JSON.stringify(tag)})) customElements.define(${JSON.stringify(tag)}, SeamFixtureElement);
export default SeamFixtureElement;
`;
}

async function routeCapabilityPackages(page: Page, experience: { id: string; name: string }, declaresSetup: boolean) {
  await page.route("**/api/capability-packages/installed", (route) =>
    route.fulfill({ json: [installedEntry(experience, declaresSetup)] }),
  );
  await page.route("**/api/capability-packages/catalog", (route) =>
    route.fulfill({ json: { schemaVersion: 1, generatedAt: "2026-09-12T00:00:00.000Z", packages: [] } }),
  );
  await page.route("**/api/capability-packages/updates**", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
  await page.route(`**/api/capability-packages/${experience.id}/client**`, (route) =>
    route.fulfill({ contentType: "text/javascript", body: clientModuleSource(experience.id) }),
  );
  await page.route("**/api/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/lorebooks/scan/**", (route) =>
    route.fulfill({ json: { entries: [], budgetSkippedEntries: [], totalTokens: 0, totalEntries: 0 } }),
  );
  // The orientation tour and the release-notes modal are unrelated overlays that would sit over the wizard
  // this spec drives.
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), APP_VERSION);
}

test("a declared setup keeps every wizard step and draws the Experience's own fields inline", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(90_000);

  const suffix = `${testInfo.project.name}-${Date.now().toString(36)}`;
  const characterName = `Seam Party Member ${suffix}`;
  const characterResponse = await request.post("/api/characters", {
    data: { data: { name: characterName, first_mes: `Hello from ${characterName}.` } },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  const chatResponse = await request.post("/api/chats", {
    data: { name: `Setup Seam Wizard ${suffix}`, mode: "game", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    await routeCapabilityPackages(page, SEAM_EXPERIENCE, true);
    await page.addInitScript((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);
    await page.goto("/");

    const dialog = page.getByRole("dialog", { name: "New Game" });
    await expect(dialog).toBeVisible({ timeout: 30_000 });

    // The block is collapsed until asked for, and says what an Experience does to the setup below it.
    await expect(dialog.getByText("Experiences", { exact: true })).toBeVisible();
    const toggleVisibility = dialog.getByRole("button", { name: "Show", exact: true });
    await expect(toggleVisibility).toHaveAttribute("aria-expanded", "false");
    await toggleVisibility.click();

    const experienceSwitch = dialog.getByRole("switch").filter({ hasText: SEAM_EXPERIENCE.name });
    await expect(experienceSwitch).toHaveAttribute("aria-checked", "false");
    await expect(dialog.getByLabel(SEED_LABEL)).toHaveCount(0);
    await experienceSwitch.click();
    await expect(experienceSwitch).toHaveAttribute("aria-checked", "true");
    await expect(
      dialog.getByText(`${SEAM_EXPERIENCE.name} is on for this game. It uses everything you set below,`, {
        exact: false,
      }),
    ).toBeVisible();

    // The seed field and its randomize control are drawn by the HOST, inside the Experiences block: the
    // innermost element holding the experience row is the one that has to hold them. The `has` locator is
    // written relative (page-rooted, one role) because Playwright applies an inner locator's whole selector
    // chain to each candidate — a dialog-rooted one would look for a dialog inside every div.
    const experiencesBlock = dialog
      .locator("div")
      .filter({ has: page.getByRole("switch") })
      .last();
    const seedInput = experiencesBlock.getByLabel(SEED_LABEL);
    const randomize = experiencesBlock.getByRole("button", { name: RANDOMIZE_HINT });
    await expect(seedInput).toBeVisible();
    await expect(randomize).toBeVisible();
    await expect(seedInput).toHaveAttribute("type", "number");
    const rolledSeed = await seedInput.inputValue();
    expect(rolledSeed).toMatch(/^\d+$/u);
    expect(Number(rolledSeed)).toBeGreaterThanOrEqual(0);
    expect(Number(rolledSeed)).toBeLessThanOrEqual(MAX_SEED);

    // Randomize overwrites a number the player typed, rather than only filling an empty field.
    await seedInput.fill("123456");
    await randomize.click();
    await expect(seedInput).not.toHaveValue("123456");
    const randomizedSeed = await seedInput.inputValue();
    expect(randomizedSeed).toMatch(/^\d+$/u);
    expect(Number(randomizedSeed)).toBeLessThanOrEqual(MAX_SEED);
    await seedInput.fill("123456");

    // The block cannot be collapsed out from under a field the player still has to answer.
    const stillExpanded = dialog.getByRole("button", { name: "Hide", exact: true });
    await expect(stillExpanded).toHaveAttribute("aria-expanded", "true");
    await expect(stillExpanded).toBeDisabled();

    // The headline win: steps 1 through 6 stay mounted, so the Party step is still reachable and its
    // picker still renders.
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "World", exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Party", exact: true })).toBeVisible();
    await expect(dialog.getByText(/^Party Members \(\d+ selected\)$/u)).toBeVisible();
    await expect(dialog.getByText(characterName, { exact: true }).first()).toBeVisible();

    // The declared requirement is explained beside the control it governs, and the control stays the
    // player's to answer: flipping it leaves the Experience's expectation on screen, unmet.
    for (const heading of ["Goals", "Lorebooks", "Features"]) {
      await dialog.getByRole("button", { name: "Next", exact: true }).click();
      await expect(dialog.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    const requirement = dialog.getByRole("status").filter({ hasText: "expects custom HUD widgets" });
    await expect(requirement).toHaveText(`${SEAM_EXPERIENCE.name} expects custom HUD widgets to be off.`);
    const widgetsControl = dialog.getByRole("button").filter({ hasText: "Custom HUD Widgets" });
    const widgetsCard = dialog
      .locator("div")
      .filter({ has: page.getByRole("button").filter({ hasText: "Custom HUD Widgets" }) })
      .filter({ has: page.getByRole("status").filter({ hasText: "expects custom HUD widgets" }) })
      .last();
    await expect(widgetsCard).toBeVisible();
    await widgetsControl.click();
    await expect(requirement).toContainText("Your own answer is what this game will use.");

    // Walking the steps never discards the seed: it is wizard state, not step state.
    for (const heading of ["Lorebooks", "Goals", "Party", "World", "Connection"]) {
      await dialog.getByRole("button", { name: "Back", exact: true }).click();
      await expect(dialog.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    await expect(dialog.getByLabel(SEED_LABEL)).toHaveValue("123456");
  } finally {
    await request.delete(`/api/chats/${chat.id}`).catch(() => undefined);
    await request.delete(`/api/characters/${character.id}`).catch(() => undefined);
  }
});

test("an Experience that declares no setup block still draws its own setup form instead of the wizard", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(90_000);

  const suffix = `${testInfo.project.name}-${Date.now().toString(36)}`;
  const chatResponse = await request.post("/api/chats", {
    data: { name: `Legacy Experience Setup ${suffix}`, mode: "game", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    await routeCapabilityPackages(page, LEGACY_EXPERIENCE, false);
    await page.addInitScript((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);
    await page.goto("/");

    const wizard = page.getByRole("dialog", { name: "New Game" });
    await expect(wizard).toBeVisible({ timeout: 30_000 });
    await wizard.getByRole("button", { name: "Show", exact: true }).click();
    const experienceSwitch = wizard.getByRole("switch").filter({ hasText: LEGACY_EXPERIENCE.name });
    await expect(experienceSwitch).toBeVisible();
    await experienceSwitch.click();

    // The body swap: the package's own setup dialog replaces the wizard entirely, and no host-drawn seed
    // field appears for a package that never declared one.
    const legacyDialog = page.getByRole("dialog", { name: LEGACY_EXPERIENCE.name });
    await expect(legacyDialog).toBeVisible();
    await expect(legacyDialog.getByRole("button", { name: "Close setup", exact: true })).toBeVisible();
    await expect(page.locator('[data-component="GameSetupWizard"]')).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "New Game" })).toHaveCount(0);
    await expect(page.getByLabel(SEED_LABEL)).toHaveCount(0);
  } finally {
    await request.delete(`/api/chats/${chat.id}`).catch(() => undefined);
  }
});
