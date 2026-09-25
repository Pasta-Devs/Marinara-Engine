import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
for (const mode of ["roleplay", "conversation"] as const) {
  test(`${mode} preserves a long provider translation through rendering and reload`, async ({
    page,
    request,
  }, info) => {
    const translated = `${"Zażółć gęślą jaźń. ".repeat(3000)}KONIEC PEŁNEGO TŁUMACZENIA`;
    const bodies: any[] = [];
    const provider = createServer(async (req, res) => {
      if (req.method !== "POST") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ data: [{ id: "fixture" }] }));
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      bodies.push(JSON.parse(Buffer.concat(chunks).toString()));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: translated }, finish_reason: "stop" }] }));
    });
    await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
    const address = provider.address();
    if (!address || typeof address === "string") throw new Error("Missing fixture port");
    const paths: string[] = [];
    const create = async (path: string, data: unknown) => {
      const response = await request.post(path, { data });
      expect(response.ok(), await response.text()).toBeTruthy();
      const result = await response.json();
      paths.unshift(`${path}/${result.id}`);
      return result;
    };
    try {
      const character = await create("/api/characters", { data: { name: "Alice", first_mes: "" } });
      const connection = await create("/api/connections", {
        name: "Long translation proof",
        provider: "custom",
        apiKey: "",
        model: "fixture",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        maxContext: 32768,
        maxTokensOverride: 8192,
      });
      const chat = await create("/api/chats", { name: "Long translation proof", mode, characterIds: [character.id] });
      await request.patch(`/api/chats/${chat.id}/metadata`, {
        data: {
          translationProvider: "ai",
          translationConnectionId: connection.id,
          translationOutputTargetLang: "pl",
          translationDisplayOnly: true,
        },
      });
      const message = await create(`/api/chats/${chat.id}/messages`, {
        role: "assistant",
        characterId: character.id,
        content: "The complete translation belongs here.",
      });
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        chatHelpSeenModes: ["roleplay", "conversation"],
        theme: info.project.name.includes("mobile") ? "dark" : "light",
      });
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id: chat.id, version },
      );
      await page.goto("/");
      const row = page.locator(`[data-message-id="${message.id}"]`).first();
      await expect(row).toBeVisible();
      if (info.project.name.includes("mobile")) await row.getByText("The complete translation belongs here.", { exact: true }).tap();
      else await row.hover();
      await row.getByRole("button", { name: "Translate", exact: true }).click();
      await expect(row).toContainText("KONIEC PEŁNEGO TŁUMACZENIA");
      expect(bodies.at(-1).max_tokens).toBe(8192);
      const saved = await (await request.get(`/api/chats/${chat.id}/messages`)).json();
      expect(JSON.parse(saved.find((entry: any) => entry.id === message.id).extra).translation).toBe(translated);
      await page.reload();
      await expect(row).toContainText("KONIEC PEŁNEGO TŁUMACZENIA");
      expect(await row.textContent()).toContain(translated);
    } finally {
      for (const path of paths) await request.delete(path).catch(() => undefined);
      await new Promise<void>((resolve) => provider.close(() => resolve()));
    }
  });
}
