import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("a TypeSafe Decision connection can be given another address, and Test uses it (#7084)", async ({
  page,
  request,
}, testInfo) => {
  // Stands in for a server that runs TypeSafe's API, so TypeSafe itself is never contacted.
  const received: Array<{ path?: string; authorization?: string }> = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    received.push({ path: req.url, authorization: req.headers.authorization });
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        answers: Object.fromEntries(Object.keys(body.questions ?? {}).map((id) => [id, { type: "noul", noul: 0.8 }])),
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  let id: string | undefined;
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing mock server port");
    const origin = `http://127.0.0.1:${address.port}`;
    const created = await request.post("/api/connections", {
      data: {
        name: `TypeSafe address ${testInfo.project.name}`,
        provider: "decision",
        decisionSource: "typesafe",
        baseUrl: "https://api.typesafe.ai",
        apiKey: "ts-e2e",
        model: "jev-latest",
      },
    });
    expect(created.ok()).toBeTruthy();
    ({ id } = await created.json());
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, theme: "dark" });
    await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
    await page.goto("/");
    await page.evaluate(async (id) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openConnectionDetail(id);
    }, id);
    const editor = page.locator(".mari-editor-shell");
    await expect(editor.getByText(/To use another server that runs TypeSafe's API/u)).toBeVisible();
    const baseUrl = editor.getByPlaceholder("https://api.typesafe.ai", { exact: true });
    await baseUrl.scrollIntoViewIfNeeded();
    await expect(baseUrl).toBeEnabled();
    await expect(baseUrl).toHaveValue("https://api.typesafe.ai");

    await baseUrl.fill(origin);
    const path = testInfo.outputPath("decision-typesafe-address.png");
    await page.screenshot({ path, animations: "disabled" });
    await testInfo.attach("decision-typesafe-address", { path, contentType: "image/png" });
    await editor.getByRole("button", { name: "Test Connection", exact: true }).click();
    await expect(editor.getByText(/Probability of yes: 0\.800/u)).toBeVisible();
    expect(received).toEqual([{ path: "/v1/systemone", authorization: "Bearer ts-e2e" }]);
    await expect.poll(async () => (await (await request.get(`/api/connections/${id}`)).json()).baseUrl).toBe(origin);

    // OpenRouter stays on its own address.
    await editor.locator("#decision-source").selectOption("openrouter");
    await expect(baseUrl).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    try {
      if (id) await request.delete(`/api/connections/${id}`);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  }
});
