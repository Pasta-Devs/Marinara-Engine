import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { hideExistingItems } from "./connections-panel.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

/**
 * The managed decision sidecar's installer.
 *
 * Nothing here installs anything: the point is that a user cannot reach a download by
 * accident. Download turns the sidecar on first, and turning it on is a confirmation
 * carrying this machine's verdict. Where it cannot run (it needs Linux with an NVIDIA
 * GPU), the row is greyed out and names what works instead.
 */
test("the decision installer is reachable before setup, asks before turning on, and judges a pasted repository", async ({
  page,
  request,
}, testInfo) => {
  const status = await (await request.get("/api/decision/sidecar")).json();
  const screenshot = async (name: string) => {
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: "disabled" });
    await testInfo.attach(name, { path: testInfo.outputPath(`${name}.png`), contentType: "image/png" });
  };

  await seedUIState(
    page,
    { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false, theme: "dark" },
    "if-missing",
  );
  // Marked seen, as the other specs do: the release notes open over everything on a
  // fresh profile and would catch every click below.
  await page.addInitScript(
    (appVersion) => localStorage.setItem("marinara:whats-new:seen-version", appVersion),
    version,
  );
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  // The shared server keeps earlier specs' accounts (#8456: deleting a Model leaves its account), so this page
  // sees none of them and shows the empty state it starts from.
  await hideExistingItems(page, request, "/api/connections");
  await hideExistingItems(page, request, "/api/connection-accounts");
  await page.goto("/");
  await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.getState().openRightPanel("connections");
  });

  // Since the Connections redesign the installer is a row on the built-in model's page (596c3fa824). The Decision
  // job's Add window offers that page as a tile (67f0383521). Not conditional on a chat model: the decision
  // sidecar is its own model and its own process, so it must be reachable before anything is set up.
  const panel = page.locator("[data-connections-panel]").filter({ visible: true });
  if (!status.supported) {
    // The tile is only offered where the sidecar can run; the built-in model's page, which the empty panel opens
    // directly, still shows the row greyed out, naming what does work instead.
    await panel.locator('[data-add-connection-service="local_model"]').click();
    await expect(page.getByText(/You can still use activation questions/u)).toBeVisible();
    await screenshot("decision-installer-dark");
    return;
  }
  await panel.locator('[data-defaults-role="decision"]').getByRole("button", { name: "Add", exact: true }).click();
  const openInstaller = page.getByRole("dialog").locator('[data-add-connection-service="decision_builtin"]');
  await expect(openInstaller).toBeVisible();
  await openInstaller.click();

  // It opens the built-in model's page in place of the Add window, not as a second window on top.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveCount(1);
  await screenshot("decision-installer-dark");

  // The row's Download turns the sidecar on first, and that asks with this machine's verdict; declining enables
  // and installs nothing.
  const writes: string[] = [];
  page.on("request", (sent) => {
    if (sent.method() === "POST" && /\/api\/decision\/sidecar\/(enable|install)$/u.test(new URL(sent.url()).pathname))
      writes.push(new URL(sent.url()).pathname);
  });
  await expect(dialog.getByRole("button", { name: "Download and install" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Download", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Turn on the built-in decision model?" });
  await expect(confirm.getByText(/runs a second built-in model beside your normal one/u)).toBeVisible();
  await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(confirm).toBeHidden();
  expect(writes).toEqual([]);
  expect((await (await request.get("/api/decision/sidecar")).json()).settings.enabled).toBe(false);

  // A pasted repository is judged by what it declares, without installing anything.
  const refused = await (
    await request.post("/api/decision/sidecar/inspect", { data: { repoId: "Qwen/Qwen3.5-2B" } })
  ).json();
  expect(refused.refusal).toBeTruthy();
  const malformed = await (
    await request.post("/api/decision/sidecar/inspect", { data: { repoId: "not-a-repo" } })
  ).json();
  expect(malformed.refusal).toBe("invalid_repo");
});
