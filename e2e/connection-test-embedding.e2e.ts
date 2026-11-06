// #8663: the Model editor's Semantic search section tests its embedding setup. Test embedding saves the typed
// model and Embedding endpoint URL first, embeds through them, and shows the vector size, or the provider's error.
import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

/** A stand-in embeddings server: `/ok/v1` answers with a 4-number vector, `/down/v1` fails. */
async function startEmbeddings() {
  const calls: Array<{ path: string; model?: string }> = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      // The editor also probes the chat address for model details; only embedding calls are recorded.
      if (req.url?.endsWith("/embeddings")) {
        calls.push({ path: req.url, model: (JSON.parse(body) as { model?: string }).model });
      }
      if (req.url === "/ok/v1/embeddings") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ data: [{ index: 0, embedding: [0.1, 0.2, 0.3, 0.4] }] }));
        return;
      }
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "embedding stub is down" } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing embeddings port");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    calls,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

test("Test embedding checks the typed embedding model and endpoint", async ({ page, request }, info) => {
  const stub = await startEmbeddings();
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
  const name = `Embedding test ${info.project.name}`;
  const created = await request.post("/api/connections", {
    data: { name, provider: "openai", baseUrl: `${stub.origin}/chat/v1`, apiKey: "fixture-key", model: "gpt-5-mini" },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const { id } = (await created.json()) as { id: string };
  await page.route(`**/api/connections/${id}/models`, (route) =>
    route.fulfill({ json: { models: [{ id: "gpt-5-mini", name: "GPT-5 mini" }] } }),
  );
  try {
    await page.goto("/");
    await page.evaluate(async (connectionId) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openConnectionDetail(connectionId);
    }, id);
    const advanced = page.locator("details").filter({ has: page.locator("summary", { hasText: "Advanced" }) });
    await advanced.locator("summary").click();
    await advanced.getByRole("button", { name: "More", exact: true }).click();

    const testButton = page.getByRole("button", { name: "Test embedding", exact: true });
    await expect(testButton, "nothing to test before a model is typed").toBeDisabled();
    await page.getByPlaceholder("e.g. text-embedding-3-small", { exact: true }).fill("stub-embed");
    const endpoint = page.getByPlaceholder("e.g. http://localhost:5002/v1", { exact: true });
    await endpoint.fill(`${stub.origin}/ok/v1`);
    await expect(testButton).toBeEnabled();
    await testButton.click();

    const result = page.getByRole("status").filter({ hasText: "Test embedding" });
    await expect(result).toContainText("Success");
    await expect(result).toContainText("4 dimensions");
    expect(stub.calls).toEqual([{ path: "/ok/v1/embeddings", model: "stub-embed" }]);
    // The pending edits were saved before the test ran.
    const saved = (await (await request.get(`/api/connections/${id}`)).json()) as Record<string, unknown>;
    expect(saved.embeddingModel).toBe("stub-embed");
    expect(saved.embeddingBaseUrl).toBe(`${stub.origin}/ok/v1`);
    await result.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("embedding-test-success.png") });

    await endpoint.fill(`${stub.origin}/down/v1`);
    await expect(result, "editing the embedding settings drops the old result").toHaveCount(0);
    await testButton.click();
    await expect(result).toContainText("Failed");
    await expect(result).toContainText("Embedding request failed (503)");
    await expect(result).not.toContainText("dimensions");
    expect(stub.calls.at(-1)).toEqual({ path: "/down/v1/embeddings", model: "stub-embed" });
    await page.screenshot({ path: info.outputPath("embedding-test-failure.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await request.delete(`/api/connections/${id}`);
    await stub.close();
  }
});
