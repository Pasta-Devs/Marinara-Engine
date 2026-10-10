import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { acquireMariThreadLock, releaseMariThreadLock } from "./mari-thread-lock.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

const SENTENCE_THEN_LIST = [
  "Here is the plan for your three characters.",
  "",
  "1. Lord Aldric Vane, a brooding vampire lord with a full backstory.",
  "2. Pip, a bubbly pocket AI with two alternate greetings.",
  "3. Brother Wen, a silent monk who speaks only in riddles.",
].join("\n");
const LIST_FIRST = ["1. Save the first card.", "2. Open the second card.", "3. Check the third card."].join("\n");

test.beforeEach(async () => {
  await acquireMariThreadLock();
});

test.afterEach(() => {
  releaseMariThreadLock();
});

/** A model that answers every request with the reply text the test sets. */
async function startReplyProvider() {
  const state = { reply: "" };
  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString() || "{}") as { stream?: boolean };
      // Professor Mari's workspace protocol: one JSON object, with the reply in `say` and `stop` set.
      const content = JSON.stringify({ say: state.reply, stop: true, commands: [] });
      if (body.stream) {
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.end(
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
        );
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const { port } = server.address() as AddressInfo;
  return {
    state,
    baseUrl: `http://127.0.0.1:${port}/v1`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

async function openMariWithProvider(
  page: Page,
  request: APIRequestContext,
  baseUrl: string,
  width: number,
  height: number,
) {
  const connection = await request.post("/api/connections", {
    data: {
      name: `Reply clear fixture ${Date.now().toString(36)}`,
      provider: "custom",
      baseUrl,
      apiKey: "fixture",
      model: "fixture",
      maxContext: 65536,
    },
  });
  expect(connection.ok(), await connection.text()).toBeTruthy();
  const connectionId = ((await connection.json()) as { id: string }).id;
  await page.setViewportSize({ width, height });
  await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), APP_VERSION);
  await seedUIState(page, { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false });
  await page.goto("/");
  await page
    .locator("main")
    .first()
    .click({ position: { x: 5, y: 5 } });
  return connectionId;
}

async function cleanUp(request: APIRequestContext, connectionId: string) {
  const threads = (await (await request.get("/api/chats/internal/professor-mari/chats")).json()) as Array<{
    id: string;
  }>;
  for (const thread of threads)
    await request.delete(`/api/chats/internal/professor-mari/chats/${thread.id}`).catch(() => undefined);
  await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
}

for (const [label, width, height] of [
  ["390", 390, 844],
  ["1440", 1440, 900],
] as const) {
  for (const [name, reply, paragraphFirst] of [
    ["sentence then numbered list", SENTENCE_THEN_LIST, true],
    ["numbered list first", LIST_FIRST, false],
  ] as const) {
    test(`${label}: ${name}: only the first paragraph sits beside Mari, the list starts below her`, async ({
      page,
      request,
    }, testInfo) => {
      test.skip(
        label === "390" ? !testInfo.project.name.startsWith("mobile") : !testInfo.project.name.startsWith("desktop"),
        "390 runs on the phone emulation, 1440 on the desktop project.",
      );
      const provider = await startReplyProvider();
      provider.state.reply = reply;
      const connectionId = await openMariWithProvider(page, request, provider.baseUrl, width, height);
      try {
        await page.keyboard.press("Control+j");
        const mariPane = page.locator('[data-component="GlobalOmnibar.Mari"]');
        const composer = mariPane.locator("textarea:visible");
        await expect(composer).toBeVisible();
        await composer.fill("Plan three characters");
        await composer.press("Enter");
        const answer = mariPane.locator(".mari-answer").last();
        await expect(answer.locator(".mari-message-content"))
          .toContainText("Here is the plan", {
            timeout: 30_000,
          })
          .catch(() => undefined);
        await expect(answer.locator(".mari-message-content ol, .mari-message-content p").first()).toBeVisible({
          timeout: 30_000,
        });
        await expect(answer.locator(".mari-answer__sprite")).toBeVisible({ timeout: 20_000 });
        await page.waitForTimeout(600);

        const geometry = await answer.evaluate((node) => {
          const rect = (el: Element) => el.getBoundingClientRect();
          const sprite = node.querySelector(".mari-answer__sprite")!;
          const children = Array.from(node.querySelectorAll(".mari-message-content > *"));
          const spriteRect = rect(sprite);
          return {
            sprite: { left: spriteRect.left, right: spriteRect.right, bottom: spriteRect.bottom },
            children: children.map((el) => {
              const r = rect(el);
              // A block spans the column even when its lines sit beside her, so judge the first line's box.
              const range = document.createRange();
              range.selectNodeContents(el);
              const line = range.getClientRects()[0] ?? r;
              return {
                tag: el.tagName,
                left: r.left,
                top: r.top,
                right: r.right,
                bottom: r.bottom,
                lineLeft: line.left,
              };
            }),
          };
        });
        await page.screenshot({
          path: `.tmp/omnibar-ux/round9/proof-14/${label}-${paragraphFirst ? "para-list" : "list-first"}.png`,
        });
        console.log(`PROOF14 ${label} ${name} ${JSON.stringify(geometry)}`);

        const [first, ...rest] = geometry.children;
        expect(first, "the reply has a first block").toBeTruthy();
        // On the phone she sits at the column start, so a later block starts below her. On the desktop she sits in
        // the margin, so a later block clears her sideways. Either way no later block sits beside her.
        for (const child of rest) {
          const below = child.top >= geometry.sprite.bottom - 1;
          const clearOfHer = child.left >= geometry.sprite.right - 1;
          expect(below || clearOfHer, `${child.tag} does not sit beside Mari`).toBeTruthy();
        }
        if (paragraphFirst && label === "390") {
          expect(first!.lineLeft, "the first paragraph sits beside Mari").toBeGreaterThanOrEqual(
            geometry.sprite.right - 1,
          );
        }
      } finally {
        await cleanUp(request, connectionId);
        await provider.close();
      }
    });
  }
}
