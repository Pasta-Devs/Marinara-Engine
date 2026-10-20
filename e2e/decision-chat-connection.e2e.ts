import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { openConnectionsPanel } from "./connections-panel.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("a Custom connection's chat model becomes a Decision connection in one click (#6714)", async ({
  page,
  request,
}, testInfo) => {
  // A stand-in Ollama: OpenAI-compatible chat completions with log-probabilities, and a
  // plain 404 for everything else, /v1/systemone included.
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("404 page not found");
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [
          {
            message: { role: "assistant", content: "Yes" },
            logprobs: {
              content: [
                {
                  token: "Yes",
                  logprob: Math.log(0.8),
                  top_logprobs: [
                    { token: "Yes", logprob: Math.log(0.8) },
                    { token: "No", logprob: Math.log(0.2) },
                  ],
                },
              ],
            },
          },
        ],
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing mock server port");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const name = `Ollama ${testInfo.project.name}`;
  const created = await request.post("/api/connections", {
    data: { name, provider: "custom", baseUrl, model: "gemma4:e2b" },
  });
  expect(created.ok()).toBeTruthy();
  const { id } = await created.json();
  let decisionId: string | undefined;
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, theme: "dark" });
    await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
    await page.goto("/");
    await page.evaluate(async (id) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openConnectionDetail(id);
    }, id);
    const editor = page.locator(".mari-editor-shell");
    const capture = async (label: string) => {
      const path = testInfo.outputPath(`${label}.png`);
      await page.screenshot({ path, animations: "disabled" });
      await testInfo.attach(label, { path, contentType: "image/png" });
    };

    // The shortcut lives in the Model's row menu; variant D lists the Model in the panel search.
    await openConnectionsPanel(page);
    await page
      .locator("[data-connections-panel]")
      .filter({ visible: true })
      .getByRole("textbox", { name: "Search models and connections" })
      .fill(name);
    const actions = page.getByRole("button", { name: `Actions for ${name}`, exact: true });
    await actions.scrollIntoViewIfNeeded();
    await actions.click();
    const shortcut = page.getByRole("menuitem", { name: "Use this model for decisions", exact: true });
    await capture("decision-chat-shortcut");
    await shortcut.click();

    // The new Decision connection opens with the chat connection's server and model.
    const source = editor.locator("#decision-source");
    await expect(source).toHaveValue("openai_compatible");
    await expect(editor.getByText(/Use a chat model on a server you already run\./u)).toBeVisible();
    const time = editor.getByLabel("Time limit (seconds)", { exact: true });
    await expect(time).toHaveValue("4");
    await source.scrollIntoViewIfNeeded();
    await capture("decision-chat-source");
    await expect
      .poll(async () => {
        const rows = (await (await request.get("/api/connections")).json()) as Array<Record<string, unknown>>;
        const row = rows.find((entry) => entry.provider === "decision" && entry.credentialsFromConnectionId === id);
        decisionId = row?.id as string | undefined;
        return row && { source: row.decisionSource, baseUrl: row.baseUrl, model: row.model };
      })
      .toEqual({ source: "openai_compatible", baseUrl, model: "gemma4:e2b" });

    await editor.getByRole("button", { name: "Test connection", exact: true }).click();
    const result = editor.getByText(/Probability of yes: 0\.800 · answered in .* \(time limit 4 s\)/u);
    await expect(result).toBeVisible();
    await result.scrollIntoViewIfNeeded();
    await capture("decision-chat-test");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    if (decisionId) await request.delete(`/api/connections/${decisionId}`);
    await request.delete(`/api/connections/${id}`);
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
