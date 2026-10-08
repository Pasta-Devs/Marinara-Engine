import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture";

// #7260: when the sandbox stops a client extension's worker, the host must
// remove its dead controls, say so, and start a fresh sandbox on Restart.
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const fixtures = [
  { id: "restart-fixture", name: "Restart Fixture", contentHash: `sha256:${"a".repeat(64)}` },
  { id: "other-fixture", name: "Other Fixture", contentHash: `sha256:${"b".repeat(64)}` },
] as const;
type Fixture = (typeof fixtures)[number];

// Stands in for the server sandbox bootstrap: it registers one top-bar button
// as soon as it loads, like a real extension does on start-up.
const fixtureSandbox = (fixture: Fixture) => `<!doctype html><script>
window.parent.postMessage({
  channel: "marinara-personal-extension",
  type: "ui-contribution-register",
  contentHash: ${JSON.stringify(fixture.contentHash)},
  contribution: { id: "fixture-action", kind: "button", label: "Fixture action", icon: "sparkles" },
}, "*");
</script>`;

async function openHomeWithFixtureExtension(page: Page) {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: "" } : { success: true } }),
  );
  await page.route("**/api/personal-extensions/runtime/client", (route) =>
    route.fulfill({
      json: fixtures.map((fixture) => ({
        id: fixture.id,
        name: fixture.name,
        description: "",
        capabilities: [],
        contentHash: fixture.contentHash,
        executionMode: "sandboxed",
        runtimeUrl: `/api/personal-extensions/${fixture.id}/sandbox.html?hash=${encodeURIComponent(fixture.contentHash)}`,
        styleUrl: null,
      })),
    }),
  );
  for (const fixture of fixtures) {
    await page.route(`**/api/personal-extensions/${fixture.id}/sandbox.html*`, (route) =>
      route.fulfill({ contentType: "text/html; charset=utf-8", body: fixtureSandbox(fixture) }),
    );
  }
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chibiProfessorMariEnabled: false,
  });
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
  }, version);
  await page.goto("/");
}

async function postFromSandbox(page: Page, fixture: Fixture, message: Record<string, unknown>) {
  const sandbox = page.frames().find((frame) => frame.url().includes(`/${fixture.id}/sandbox.html`));
  if (!sandbox) throw new Error(`The ${fixture.name} sandbox is not running`);
  await sandbox.evaluate(
    (data) => window.parent.postMessage({ channel: "marinara-personal-extension", ...data }, "*"),
    { ...message, contentHash: fixture.contentHash },
  );
}

const stoppedMessage = {
  type: "error",
  stopped: true,
  message: "Browser extension was stopped because its sandbox became unresponsive",
};

test("a stopped client extension drops its controls and Restart starts a fresh sandbox", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Top-bar extension buttons sit in the More menu on phones.");
  await openHomeWithFixtureExtension(page);

  const [restarted, other] = fixtures;
  const sandboxes = (fixture: Fixture) => page.locator(`iframe[data-personal-extension-sandbox="${fixture.id}"]`);
  const action = (fixture: Fixture) =>
    page.locator('[data-component="TopBar"]').getByTitle(`Fixture action (${fixture.name})`, { exact: true });
  const notice = (fixture: Fixture) =>
    page.locator("[data-sonner-toast]").filter({ hasText: `${fixture.name} stopped working.` });
  for (const fixture of fixtures) {
    await expect(action(fixture)).toBeVisible();
    await expect(sandboxes(fixture)).toHaveCount(1);
  }
  await sandboxes(restarted).evaluate((iframe) => iframe.setAttribute("data-fixture-generation", "first"));

  // An ordinary extension error keeps the extension and its controls.
  await postFromSandbox(page, restarted, { type: "error", message: "Fixture handler failed" });
  await expect(notice(restarted)).toHaveCount(0);
  await expect(action(restarted)).toBeVisible();

  // A sandbox-stopped worker removes the dead controls and shows a notice.
  // Stop the other extension first so the restarted one's notice is in front.
  for (const fixture of [other, restarted]) await postFromSandbox(page, fixture, stoppedMessage);
  for (const fixture of fixtures) {
    await expect(notice(fixture)).toBeVisible();
    await expect(action(fixture)).toHaveCount(0);
    await expect(sandboxes(fixture)).toHaveCount(0);
  }
  await expect(notice(restarted).getByText("Its buttons and panels are hidden until you restart it.")).toBeVisible();

  // Restart starts only the chosen extension, in a fresh sandbox.
  await notice(restarted).getByRole("button", { name: "Restart", exact: true }).click();
  await expect(sandboxes(restarted)).toHaveCount(1);
  await expect(sandboxes(restarted)).not.toHaveAttribute("data-fixture-generation", "first");
  await expect(action(restarted)).toBeVisible();
  await expect(sandboxes(other)).toHaveCount(0);
  await expect(action(other)).toHaveCount(0);
});
