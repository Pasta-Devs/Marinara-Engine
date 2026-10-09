import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { acquireMariThreadLock, releaseMariThreadLock } from "./mari-thread-lock.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/**
 * R13 (slice 62g): "no cool (I'm doing / I've done this) checkmarks". A scripted fake model runs the
 * real workspace loop with read steps over two rounds, and holds each next round open long enough to
 * look at the screen mid-run: every finished step must show its green done mark in an OPEN phase
 * while she is still working (slice 36 folded them away), and an answer without steps still ends on a
 * small done check.
 */
// F11: like the mari-arrival specs, this reads "the most recent Mari thread", so a thread left over
// from another spec changes which thread the run lands in. The lock keeps this file from running at
// the same time as any other locked Mari-thread spec; the cleanup then starts from a clean slate.
test.beforeEach(async ({ request }) => {
  await acquireMariThreadLock();
  const existing = (await (await request.get("/api/chats/internal/professor-mari/chats")).json()) as Array<{
    id: string;
  }>;
  await Promise.all(
    existing.map((chat) =>
      request.delete(`/api/chats/internal/professor-mari/chats/${chat.id}`).catch(() => undefined),
    ),
  );
});

test.afterEach(() => {
  releaseMariThreadLock();
});

test("done marks show on each step while Mari is still working", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "One live run on desktop is enough proof.");
  test.setTimeout(90_000);

  const tool = (action: string) => ({ name: "app_data", arguments: { action } });
  // Each round: the action the fake model returns, and how long it holds the response first.
  const rounds: Array<{ delayMs: number; action: Record<string, unknown> }> = [
    { delayMs: 0, action: { say: "", commands: [tool("character.list"), tool("lorebook.list")], stop: false } },
    { delayMs: 4_000, action: { say: "", commands: [tool("persona.list")], stop: false } },
    { delayMs: 4_000, action: { say: "You have no characters, lorebooks or personas yet.", commands: [], stop: true } },
    { delayMs: 0, action: { say: "Hello! Ask me anything.", commands: [], stop: true } },
  ];
  const prompts: string[] = [];
  const provider = createServer((incoming, response) => {
    // Model-list probes are not a round of her run.
    if (incoming.method !== "POST") {
      incoming.resume();
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "fixture" }] }));
      return;
    }
    const chunks: Buffer[] = [];
    incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
    incoming.on("end", () => {
      prompts.push(Buffer.concat(chunks).toString());
      const round = rounds.shift() ?? { delayMs: 0, action: { say: "Done.", commands: [], stop: true } };
      setTimeout(() => {
        response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
        response.end(
          [
            `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: JSON.stringify(round.action) }, finish_reason: null }] })}`,
            `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}`,
            "data: [DONE]",
            "",
          ].join("\n\n"),
        );
      }, round.delayMs);
    });
  });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));

  let connectionId = "";
  let mariChatId = "";
  try {
    const address = provider.address();
    if (!address || typeof address === "string") throw new Error("Missing fixture provider address");
    const connection = await request.post("/api/connections", {
      data: {
        name: `Done marks fixture ${Date.now().toString(36)}`,
        provider: "custom",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        apiKey: "fixture",
        model: "fixture",
        maxContext: 65536,
      },
    });
    expect(connection.ok(), await connection.text()).toBeTruthy();
    connectionId = ((await connection.json()) as { id: string }).id;
    const mariChat = await request.get(`/api/chats/internal/professor-mari?connectionId=${connectionId}`);
    expect(mariChat.ok(), await mariChat.text()).toBeTruthy();
    mariChatId = ((await mariChat.json()) as { id: string }).id;

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), APP_VERSION);
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      rightPanelOpen: false,
      sidebarOpen: false,
      reduceAmbientEffects: true,
    });
    await page.goto("/");
    await page
      .locator("main")
      .first()
      .click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+j");
    const mariPane = page.locator('[data-component="GlobalOmnibar.Mari"]');
    await expect(mariPane).toBeVisible();
    await mariPane.locator("textarea:visible").fill("What do I have in my library?");
    await page.keyboard.press("Control+Enter");

    const timeline = mariPane.locator('.mari-work-timeline[data-active="true"]');
    await expect(timeline).toBeVisible();
    const doneSteps = timeline.locator('.mari-live-work__steps li[data-status="done"]');
    // Round 1's two reads are done while round 2 is still held open: both rows are visible, each with its check.
    await expect(doneSteps).toHaveCount(2);
    await expect(timeline.locator("details.mari-phase").first()).toHaveAttribute("open", "");
    for (const row of await doneSteps.all()) {
      await expect(row.locator(".mari-work-timeline__done-mark")).toBeVisible();
    }
    await page.screenshot({ path: "test-results/mari-live-done-marks-proof/live-done-marks-round1-1440.png" });

    // Round 2's read lands while the final answer is still held: three checked rows, still in an open phase.
    await expect(doneSteps).toHaveCount(3);
    await expect(timeline).toHaveAttribute("data-active", "true");
    for (const row of await doneSteps.all()) {
      await expect(row.locator(".mari-work-timeline__done-mark")).toBeVisible();
    }
    await page.screenshot({ path: "test-results/mari-live-done-marks-proof/live-done-marks-round2-1440.png" });

    // The run ends: this phase has 3 steps (at MAX_OPEN_PHASE_STEPS), so 62h keeps it open instead of
    // folding it; its summary and "Worked for" both still carry the check.
    const finished = mariPane.locator('.mari-work-timeline[data-active="false"]').last();
    await expect(finished).toContainText("You have no characters", { timeout: 20_000 });
    const phase = finished.locator("details.mari-phase").first();
    await expect(phase).toHaveAttribute("open", "");
    await expect(phase.locator("> summary .mari-done-mark--step")).toBeVisible();
    await expect(finished.locator(".mari-work-timeline__header .mari-work-timeline__done-mark")).toBeVisible();
    await page.screenshot({ path: "test-results/mari-live-done-marks-proof/live-done-marks-finished-1440.png" });

    // R13.2: the prompt she really got no longer sends her on reads just to make a card show, lets a
    // question that needs it get a paragraph, and keeps chat.diagnose for real bad-reply complaints.
    const systemPrompt = prompts[0] ?? "";
    // Slice 68 shortened these rules; the checks follow its wording, same intent.
    expect(systemPrompt).toContain("only for its contents or an unknown id");
    expect(systemPrompt).toContain("a short paragraph or steps if needed");
    expect(systemPrompt).toContain("never read just to fill `detail` or `action`");
    expect(systemPrompt).toContain("not for questions about you or how-tos");
    expect(systemPrompt).not.toContain("so its card can show");
    expect(systemPrompt).not.toContain("she forgets things");

    // An answer without any step still ends on a small done check.
    await mariPane.locator("textarea:visible").fill("Hi!");
    await page.keyboard.press("Control+Enter");
    const plain = mariPane.locator(".mari-work-timeline").filter({ hasText: "Hello! Ask me anything." }).last();
    await expect(plain.locator(".mari-work-timeline__done")).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: "test-results/mari-live-done-marks-proof/no-step-answer-done-1440.png" });
  } finally {
    if (mariChatId)
      await request.delete(`/api/chats/internal/professor-mari/chats/${mariChatId}`).catch(() => undefined);
    if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
    await new Promise<void>((resolve) => provider.close(() => resolve()));
  }
});
