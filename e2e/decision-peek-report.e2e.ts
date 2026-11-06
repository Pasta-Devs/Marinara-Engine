import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const theme of ["dark", "light"] as const)
  test(`Peek Prompt decision diagnostics (${theme})`, async ({ page, request }, testInfo) => {
    const ids: { character?: string; chat?: string; chatConnection?: string; preset?: string } = {};
    // No global setting is changed, so projects sharing a server cannot disturb each other:
    // 33 statements go one past the default Decision statements per turn (32), and Peek
    // Prompt never asks, so the first 32 are unanswered and the last is dropped.
    const statements = [
      "Mira draws a sword in the latest message",
      ...Array.from({ length: 31 }, (_, index) => `Filler statement ${index + 1} holds`),
      "Mira is soaked by rain in the latest message",
    ];
    try {
      const character = await request.post("/api/characters", { data: { data: { name: "Mira" } } });
      expect(character.ok(), await character.text()).toBeTruthy();
      ids.character = ((await character.json()) as { id: string }).id;
      // Peek Prompt never calls it; it only needs a connection to build the whole prompt.
      const chatConnection = await request.post("/api/connections", {
        data: { name: "Peek chat fixture", provider: "custom", baseUrl: "http://127.0.0.1:9/v1", model: "fixture" },
      });
      expect(chatConnection.ok(), await chatConnection.text()).toBeTruthy();
      ids.chatConnection = ((await chatConnection.json()) as { id: string }).id;
      // A preset section holds the statements; a disabled one is never counted.
      const preset = await request.post("/api/prompts", { data: { name: "Peek decisions", wrapFormat: "none" } });
      expect(preset.ok(), await preset.text()).toBeTruthy();
      ids.preset = ((await preset.json()) as { id: string }).id;
      for (const [order, data] of [
        {
          identifier: "scene",
          name: "Scene",
          role: "system",
          content: statements.map((statement) => `{{#if decision:"${statement}"}}Yes.{{/if}}`).join(" "),
        },
        {
          identifier: "off",
          name: "Disabled",
          role: "system",
          enabled: false,
          content: '{{#if decision:"A disabled section asks this"}}Never.{{/if}}',
        },
        { identifier: "history", name: "History", isMarker: true, markerConfig: { type: "chat_history" } },
      ].entries())
        expect(
          (await request.post(`/api/prompts/${ids.preset}/sections`, { data: { ...data, order } })).ok(),
        ).toBeTruthy();
      const chat = await request.post("/api/chats", {
        data: {
          name: "Peek decision report",
          mode: "roleplay",
          characterIds: [ids.character],
          connectionId: ids.chatConnection,
          promptPresetId: ids.preset,
        },
      });
      expect(chat.ok(), await chat.text()).toBeTruthy();
      ids.chat = ((await chat.json()) as { id: string }).id;
      await request.post(`/api/chats/${ids.chat}/messages`, { data: { role: "user", content: "Mira looks up." } });

      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, theme });
      await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
      await page.addInitScript((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), ids.chat);
      await page.goto("/");
      // `{{prompt}}` previews the next turn's prompt without sending anything.
      await page.locator("textarea.mari-chat-input-textarea").fill("{{prompt}}");
      await page.locator("button.mari-chat-send-btn").click();

      // The unanswered notice reads differently with and without a Decision model, so it
      // is found by the statement it lists.
      const unanswered = page.getByRole("status").filter({ hasText: "Mira draws a sword in the latest message" });
      const dropped = page.getByRole("status").filter({ hasText: "over the per-turn limit (counted as no): 1" });
      await expect(unanswered).toContainText(": 32.");
      await expect(dropped).toContainText("Mira is soaked by rain in the latest message");
      await expect(unanswered).not.toContainText("soaked by rain");
      await expect(page.getByText("A disabled section asks this")).toHaveCount(0);
      const path = testInfo.outputPath("peek-decision-report.png");
      await page.screenshot({ path, animations: "disabled" });
      await testInfo.attach("peek-decision-report", { path, contentType: "image/png" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      // Transport and isolation have a real-provider route regression. Here the browser
      // receives deterministic results without changing a shared server's model default.
      const modes: string[] = [];
      let fixture: "normal" | "empty" | "unavailable" | "deferred" | "failed" | "memory" | "memory-empty" = "normal";
      await page.route("**/api/generate/dryRun", async (route) => {
        const body = route.request().postDataJSON();
        expect(body.chatId).toBe(ids.chat);
        expect(body.returnPrompt).toBe(true);
        modes.push(body.decisionDebug);
        if (fixture === "failed") return route.fulfill({ status: 500, json: { error: "Fixture failure" } });
        const run = body.decisionDebug === "run";
        await route.fulfill({
          json: {
            prompt: {
              messages: [{ role: "system", content: "TEST_DECISION_BRANCH" }],
              decisionDebug: {
                mode: body.decisionDebug,
                model: "Decision fixture",
                createdAt: new Date().toISOString(),
                turnId: "fixture-turn",
                results:
                  fixture === "empty" || fixture === "memory" || fixture === "memory-empty"
                    ? []
                    : fixture === "unavailable"
                      ? [{ statement: "The door is open.", kind: "noul", status: "unavailable" }]
                      : [
                          {
                            statement: "The door is open.",
                            kind: "noul",
                            status: run ? "evaluated" : fixture === "deferred" ? "deferred" : "ready",
                            threshold: 0.5,
                            ...(run ? { probability: 0.82, yes: true } : {}),
                          },
                          { statement: "A fight begins.", kind: "noul", status: "held", yes: false },
                          ...(run
                            ? [
                                {
                                  statement: "The weather changes.",
                                  kind: "noul",
                                  status: "unanswered",
                                  error: "timeout",
                                },
                              ]
                            : []),
                        ],
                ...(fixture === "memory-empty"
                  ? { advancedMemory: {} }
                  : fixture === "memory"
                    ? {
                        advancedMemory: {
                          recall: {
                            createdAt: "2026-09-27T12:00:00Z",
                            model: "Jev memory fixture",
                            sourceEndMessageId: "fixture-source",
                            fallback: false,
                            threshold: 0.5,
                            omittedCount: 2,
                            results: [
                              {
                                id: "scene-1",
                                kind: "scene",
                                text: "The old silver compass promise.",
                                score: 0.94,
                                selected: true,
                              },
                              {
                                id: "scene-2",
                                kind: "scene",
                                text: "An unrelated rainy evening.",
                                score: 0.04,
                                selected: false,
                              },
                            ],
                          },
                          sceneCheck: {
                            createdAt: "2026-09-27T12:01:00Z",
                            model: "Jev memory fixture",
                            sourceEndMessageId: "fixture-reply",
                            fallback: true,
                            threshold: 0.8,
                            omittedCount: 0,
                            results: [
                              { id: "ending", kind: "scene_end", text: "They parted for the night.", selected: false },
                            ],
                          },
                        },
                      }
                    : {}),
                requests:
                  fixture === "memory" || fixture === "memory-empty"
                    ? []
                    : [
                        {
                          protocol: "system_one",
                          body: {
                            model: "Decision fixture",
                            state: { recent_messages: [{ role: "user", content: "I open the door.\nMira looks up." }] },
                            questions: { d0: { type: "noul", instructions: "The door is open." } },
                          },
                          ...(run ? { results: [{ id: "d0", probability: 0.82 }] } : {}),
                        },
                      ],
              },
            },
            parameters: {},
          },
        });
      });
      expect(modes).toEqual([]);
      await page.getByRole("button", { name: "Decision diagnostics" }).click();
      const diagnostics = page.getByRole("region", { name: "Decision diagnostics" });
      await expect(diagnostics.getByText("Ready to test")).toBeVisible();
      expect(modes).toEqual(["inspect"]);
      await diagnostics.getByText("Prepared request bodies (1)").click();
      await expect(diagnostics.locator("pre")).toContainText("I open the door.");
      // A multi-line message in a request body reads with its line break, not as "\n".
      expect(await diagnostics.locator("pre").innerText()).toContain("I open the door.\nMira looks up.");
      await diagnostics.getByRole("button", { name: "Test decisions", exact: true }).click();
      await expect(diagnostics.getByText("Evaluated in this test")).toBeVisible();
      await expect(diagnostics).toContainText("0.82");
      await expect(diagnostics).toContainText("Request error: timeout");
      const held = diagnostics.getByRole("listitem").filter({ hasText: "A fight begins." });
      await expect(held).toContainText("Held by sticky");
      await expect(held).not.toContainText("Score:");
      await expect(page.getByText("Decision test preview", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: /^System ~/i }).click();
      await expect(page.getByText("TEST_DECISION_BRANCH", { exact: true })).toBeVisible();
      expect(modes).toEqual(["inspect", "run"]);
      await page.getByRole("button", { name: "Show original prompt" }).click();
      await expect(dropped).toContainText("Mira is soaked by rain in the latest message");
      await expect(page.getByText("TEST_DECISION_BRANCH", { exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Show tested prompt" }).click();
      await expect(page.getByText("Decision test preview", { exact: true })).toBeVisible();
      if (!(await page.getByText("TEST_DECISION_BRANCH", { exact: true }).isVisible()))
        await page.getByRole("button", { name: /^System ~/i }).click();
      await expect(page.getByText("TEST_DECISION_BRANCH", { exact: true })).toBeVisible();
      const testedPath = testInfo.outputPath(`decision-test-${theme}.png`);
      await page.screenshot({ path: testedPath, animations: "disabled" });
      await testInfo.attach("decision-test", { path: testedPath, contentType: "image/png" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      fixture = "empty";
      await diagnostics.getByRole("button", { name: "Preview inputs" }).click();
      await expect(diagnostics.getByText("No decision statements were found in this prompt.")).toBeVisible();
      await expect(diagnostics.getByRole("button", { name: "Test decisions", exact: true })).toBeDisabled();
      fixture = "memory-empty";
      await diagnostics.getByRole("button", { name: "Preview inputs" }).click();
      await expect(diagnostics).toContainText("No Advanced Memory decisions have been recorded yet.");
      fixture = "memory";
      await diagnostics.getByRole("button", { name: "Preview inputs" }).click();
      await expect(diagnostics.getByText("Advanced Memory activity", { exact: true })).toBeVisible();
      await expect(diagnostics.getByText("No decision statements were found in this prompt.")).toHaveCount(0);
      await expect(diagnostics.getByRole("button", { name: "Test decisions", exact: true })).toBeDisabled();
      const recalled = diagnostics.getByRole("listitem").filter({ hasText: "The old silver compass promise." });
      await expect(recalled).toContainText("Selected");
      await expect(recalled).toContainText("0.94");
      await expect(diagnostics).toContainText("Some decisions were unavailable.");
      await expect(diagnostics).toContainText("2 more results omitted");
      await recalled.scrollIntoViewIfNeeded();
      const memoryPath = testInfo.outputPath(`memory-decisions-${theme}.png`);
      await page.screenshot({ path: memoryPath, animations: "disabled" });
      await testInfo.attach("memory-decisions", { path: memoryPath, contentType: "image/png" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      fixture = "unavailable";
      await diagnostics.getByRole("button", { name: "Preview inputs" }).click();
      await expect(diagnostics.getByText("Decision model unavailable or not selected")).toBeVisible();
      await expect(diagnostics.getByRole("button", { name: "Test decisions", exact: true })).toBeDisabled();
      fixture = "deferred";
      await diagnostics.getByRole("button", { name: "Preview inputs" }).click();
      await expect(diagnostics.getByRole("button", { name: "Test decisions", exact: true })).toBeEnabled();
      await diagnostics.getByRole("button", { name: "Test decisions", exact: true }).click();
      await expect(diagnostics.getByText("Evaluated in this test")).toBeVisible();
      await expect(diagnostics).toContainText("0.82");
      fixture = "failed";
      await diagnostics.getByRole("button", { name: "Preview inputs" }).click();
      await expect(diagnostics.getByRole("alert")).toContainText("Could not prepare the decision test");
    } finally {
      if (ids.chat) await request.delete(`/api/chats/${ids.chat}`);
      if (ids.character) await request.delete(`/api/characters/${ids.character}`);
      if (ids.chatConnection) await request.delete(`/api/connections/${ids.chatConnection}`);
      if (ids.preset) await request.delete(`/api/prompts/${ids.preset}`);
    }
  });
