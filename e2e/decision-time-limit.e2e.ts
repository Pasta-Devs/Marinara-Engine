import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { openJobSettings } from "./connections-panel.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("a Decision connection's time limit saves, and Test reports an answer slower than it", async ({
  page,
  request,
}, testInfo) => {
  let delayMs = 0;
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString());
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        answers: Object.fromEntries(Object.keys(body.questions).map((id) => [id, { type: "noul", noul: 0.8 }])),
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing mock server port");
  const created = await request.post("/api/connections", {
    data: {
      name: `Decision time limit ${testInfo.project.name}`,
      provider: "decision",
      decisionSource: "custom",
      baseUrl: `http://127.0.0.1:${address.port}`,
      model: "jev-latest",
    },
  });
  expect(created.ok()).toBeTruthy();
  const { id } = await created.json();
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, theme: "dark" });
    await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
    const previous = (await (await request.get("/api/decision/options")).json()).selected ?? null;
    expect((await request.post("/api/decision/select", { data: { id } })).ok()).toBeTruthy();
    // The time limit lives in the Decision settings window; Test stays in the model window.
    const openSettings = async () => {
      await openJobSettings(page, "decision");
      return page.locator('[data-connection-part="decision"]');
    };
    const setLimit = async (value: string) => {
      const part = await openSettings();
      const limit = part.getByLabel("Time limit (seconds)", { exact: true });
      await limit.scrollIntoViewIfNeeded();
      await limit.fill(value);
      await limit.blur();
      await part.getByRole("button", { name: "Save", exact: true }).click();
      // The part's Save button goes away once the edit is stored.
      await expect(part.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
      await page.keyboard.press("Escape");
      return limit;
    };
    const openWindow = async () => {
      await page.evaluate(async (id) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openConnectionDetail(id);
      }, id);
      return page.locator(".mari-editor-shell");
    };
    const capture = async (name: string) => {
      const path = testInfo.outputPath(`${name}.png`);
      await page.screenshot({ path, animations: "disabled" });
      await testInfo.attach(name, { path, contentType: "image/png" });
    };
    try {
      await page.goto("/");
      const part = await openSettings();
      await expect(part.getByLabel("Time limit (seconds)", { exact: true })).toHaveValue("1.5");
      await expect(part.getByText(/Answers that come later count as no\./)).toBeVisible();
      await capture("decision-time-limit-field");
      await page.keyboard.press("Escape");

      // An answer slower than the limit is reported with its real time, not as a dead endpoint.
      await setLimit("0.5");
      await expect
        .poll(async () => (await (await request.get(`/api/connections/${id}`)).json()).decisionTimeoutMs)
        .toBe(500);
      delayMs = 1000;
      let editor = await openWindow();
      await editor.getByRole("button", { name: "Test provider", exact: true }).click();
      await expect(editor.getByText(/over this provider's 0\.5 s time limit/u)).toBeVisible();
      await capture("decision-time-limit-slow");
      await editor.getByRole("button", { name: "Done", exact: true }).click();

      delayMs = 0;
      await setLimit("2.5");
      editor = await openWindow();
      await editor.getByRole("button", { name: "Test provider", exact: true }).click();
      await expect(
        editor.getByText(/Probability of yes: 0\.800 · answered in .* \(time limit 2\.5 s\)/u),
      ).toBeVisible();
      await page.reload();
      await expect((await openSettings()).getByLabel("Time limit (seconds)", { exact: true })).toHaveValue("2.5");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    } finally {
      await request.post("/api/decision/select", { data: { id: previous } });
    }
  } finally {
    await request.delete(`/api/connections/${id}`);
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
