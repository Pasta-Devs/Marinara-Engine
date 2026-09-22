import { expect, test } from "@playwright/test";
import { seedUIState } from "./ui-state-fixture.js";

/**
 * The managed decision sidecar's installer.
 *
 * Nothing here installs anything: the point is that a user cannot reach a download by
 * accident. The model choice does not exist until the sidecar is enabled, and enabling
 * it is a confirmation carrying this machine's verdict.
 */
test("the decision installer warns, gates the model choice behind Enable, and judges a pasted repository", async ({
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
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.goto("/");
  await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.getState().openRightPanel("connections");
  });

  // The Local Model card owns this, so the installer is reached from inside it.
  const openCard = page.getByText("Local Model", { exact: true }).first();
  await expect(openCard).toBeVisible();
  await openCard.click();
  // Not conditional: the decision sidecar is its own model and its own process, so
  // this must be reachable whether or not a chat model has been downloaded. Skipping
  // here would hide exactly the regression that put it behind one.
  const openInstaller = page.getByRole("button", { name: /Decision sidecar/ });
  await expect(openInstaller).toBeVisible();
  await openInstaller.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // The warning is always visible, above anything that could start a download.
  await expect(dialog.getByText("Experimental. Most people do not need this.")).toBeVisible();
  await screenshot("decision-installer-dark");

  if (!status.supported) {
    // Greyed out rather than hidden, naming what does work instead.
    await expect(dialog.getByText(/You can still use activation questions/u)).toBeVisible();
    return;
  }

  // Nothing downloadable is on screen until the sidecar is enabled.
  await expect(dialog.getByRole("button", { name: "Download and install" })).toHaveCount(0);
  await expect(dialog.getByPlaceholder("owner/model-name")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /Enable decision sidecar/ })).toBeVisible();

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
