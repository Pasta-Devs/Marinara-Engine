import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { crc32 } from "node:zlib";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const requireServer = createRequire(new URL("../packages/server/package.json", import.meta.url));
const sharp = requireServer("sharp");

async function openChat(page: Page, chatId: string) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.addInitScript(
    ({ id, appVersion }) => {
      localStorage.setItem("marinara-active-chat-id", id);
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            rightPanelOpen: false,
            sidebarOpen: false,
            messagesPerPage: 20,
            enableStreaming: true,
            streamingSpeed: 100,
            chatHelpSeenModes: ["conversation", "roleplay", "game"],
          },
          version: 65,
        }),
      );
    },
    { id: chatId, appVersion: version },
  );
  await page.goto("/");
}

async function saveIllustration(request: APIRequestContext, chatId: string, messageId: string, height = 1536) {
  // A normal GPT Image portrait is already 1024px wide; width-only resizing did
  // not reduce it. Large ancillary metadata also used to bypass previews entirely.
  const png = await sharp({
    create: { width: 1024, height, channels: 3, background: "#164e63" },
  })
    .png()
    .toBuffer();
  const metadata = Buffer.from(`Comment\0${"x".repeat(200_000)}`);
  const chunk = Buffer.alloc(metadata.length + 12);
  chunk.writeUInt32BE(metadata.length);
  chunk.write("tEXt", 4, "ascii");
  metadata.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
  const original = Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33)]);
  const upload = await request.post(`/api/gallery/${chatId}/upload`, {
    multipart: {
      prompt: "Synthetic arrival illustration",
      file: { name: "arrival.png", mimeType: "image/png", buffer: original },
    },
  });
  expect(upload.ok()).toBeTruthy();
  const image = (await upload.json()) as { id: string; url: string };
  const attached = await request.patch(`/api/chats/${chatId}/messages/${messageId}/extra`, {
    data: {
      attachments: [{ type: "image", url: image.url, filename: "Arrival illustration", galleryId: image.id }],
    },
  });
  expect(attached.ok()).toBeTruthy();
  return { ...image, original };
}

for (const mode of ["roleplay", "conversation"] as const) {
  for (const height of [1536, 4096]) {
    test(`${mode} mobile image previews bound 1024x${height} PNGs with large metadata; opening still uses the original`, async ({
      page,
      request,
    }, testInfo) => {
      const created = await request.post("/api/chats", {
        data: { name: "Illustration preview proof", mode, characterIds: [], connectionId: "synthetic" },
      });
      expect(created.ok()).toBeTruthy();
      const chat = (await created.json()) as { id: string };
      try {
        for (let index = 0; index < 19; index++) {
          const prior = await request.post(`/api/chats/${chat.id}/messages`, {
            data: { role: index % 2 ? "assistant" : "user", content: `Prior message ${index + 1}.` },
          });
          expect(prior.ok()).toBeTruthy();
        }
        const saved = await request.post(`/api/chats/${chat.id}/messages`, {
          data: { role: "assistant", content: "The illustration accompanies this reply." },
        });
        expect(saved.ok()).toBeTruthy();
        const message = (await saved.json()) as { id: string };
        const image = await saveIllustration(request, chat.id, message.id, height);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const originalRequests: string[] = [];
        page.on("request", (req) => {
          if (req.url().endsWith(image.url)) originalRequests.push(req.url());
        });
        await openChat(page, chat.id);
        await expect(page.locator(".mari-rp-reduced-paint")).toHaveCount(0);
        const attachment = page.getByRole("img", { name: "Arrival illustration", exact: true });
        await expect(attachment).toBeVisible();
        const mobile = testInfo.project.name.includes("mobile");
        await expect
          .poll(() => attachment.evaluate((img: HTMLImageElement) => img.naturalWidth))
          .toBe(mobile ? Math.round((1024 * 1024) / height) : 1024);
        await expect
          .poll(() => attachment.evaluate((img: HTMLImageElement) => img.naturalHeight))
          .toBe(mobile ? 1024 : height);
        if (mobile) expect(originalRequests).toEqual([]);
        await testInfo.attach("chat-preview", {
          body: await page.screenshot({ path: testInfo.outputPath("chat-preview.png") }),
          contentType: "image/png",
        });

        if (mobile) await page.getByRole("button", { name: "More options", exact: true }).click();
        await page.getByRole("button", { name: "Gallery", exact: true }).filter({ visible: true }).click();
        const drawer = page.locator(".mari-chat-gallery-drawer");
        const tile = drawer.getByRole("img", { name: "Synthetic arrival illustration", exact: true });
        await expect(tile).toBeVisible();
        await expect
          .poll(() => tile.evaluate((img: HTMLImageElement) => img.naturalWidth))
          .toBe(mobile ? Math.round((320 * 1024) / height) : 1024);
        await expect
          .poll(() => tile.evaluate((img: HTMLImageElement) => img.naturalHeight))
          .toBe(mobile ? 320 : height);
        if (mobile) expect(originalRequests).toEqual([]);
        await testInfo.attach("gallery-preview", {
          body: await page.screenshot({ path: testInfo.outputPath("gallery-preview.png") }),
          contentType: "image/png",
        });

        await drawer.getByRole("button", { name: "Open gallery image", exact: true }).click();
        const fullImage = page.getByRole("dialog").getByRole("img", { name: "Synthetic arrival illustration" });
        await expect(fullImage).toBeVisible();
        await expect.poll(() => fullImage.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1024);
        await expect.poll(() => fullImage.evaluate((img: HTMLImageElement) => img.naturalHeight)).toBe(height);
        const downloaded = await request.get(image.url);
        expect(await downloaded.body()).toEqual(image.original);
        expect(errors).toEqual([]);
      } finally {
        await request.delete(`/api/chats/${chat.id}`);
      }
    });
  }
}

test("a saved automatic illustration appears before the remaining agent stream closes", async ({
  page,
  request,
}, testInfo) => {
  // Control only the provider SSE timing; persistence and image serving use the real server.
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (new URL(url, location.origin).pathname !== "/api/generate") return nativeFetch(input, init);
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            Object.assign(window, { illustrationStream: controller });
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    };
  });
  const created = await request.post("/api/chats", {
    data: { name: "Automatic illustration tail", mode: "roleplay", characterIds: [], connectionId: "synthetic" },
  });
  expect(created.ok()).toBeTruthy();
  const chat = (await created.json()) as { id: string };
  const emit = (type: string, data: unknown) =>
    page.evaluate(
      (event) => {
        const controller = (window as unknown as { illustrationStream: ReadableStreamDefaultController })
          .illustrationStream;
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
      },
      { type, data },
    );
  try {
    await openChat(page, chat.id);
    await page.locator("textarea.mari-chat-input-textarea").fill("Illustrate this reply.");
    await page.locator("button.mari-chat-send-btn").click();
    await expect.poll(() => page.evaluate(() => "illustrationStream" in window)).toBe(true);
    const saved = await request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "assistant", content: "A finished reply with an image on the way." },
    });
    expect(saved.ok()).toBeTruthy();
    const message = (await saved.json()) as { id: string; content: string };
    await emit("token", message.content);
    await emit("message_saved", message);
    await emit("assistant_message_ready", message);
    await emit("agent_start", { phase: "post_generation" });
    await emit("illustration_queued", { messageId: message.id });
    await emit("done", "");
    await expect(page.locator(`[data-message-id="${message.id}"]`)).toBeVisible();
    await expect(page.locator('[data-message-id="__streaming__"]')).toHaveCount(0);
    const image = await saveIllustration(request, chat.id, message.id);
    await emit("illustration", { messageId: message.id, imageUrl: image.url, galleryId: image.id });

    // A slow background/agent tail still owns the SSE, but this image is durable.
    await expect(page.getByRole("img", { name: "Arrival illustration", exact: true })).toBeVisible();
    await expect
      .poll(() =>
        page
          .getByRole("img", { name: "Arrival illustration", exact: true })
          .evaluate((img: HTMLImageElement) => img.naturalHeight),
      )
      .toBe(testInfo.project.name.includes("mobile") ? 1024 : 1536);
    await testInfo.attach("automatic-arrival", {
      body: await page.screenshot({ path: testInfo.outputPath("automatic-arrival.png") }),
      contentType: "image/png",
    });
    await page.evaluate(() => {
      (window as unknown as { illustrationStream: ReadableStreamDefaultController }).illustrationStream.close();
    });
    await expect(page.getByRole("img", { name: "Arrival illustration", exact: true })).toBeVisible();
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});
