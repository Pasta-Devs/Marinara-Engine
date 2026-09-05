import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const appVersion = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

test.beforeEach(async ({ page }) => {
  await page.route("**/api/app-settings/ui", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: { value: null } })
      : route.fulfill({ json: { success: true } }),
  );
  await page.addInitScript((version) => {
    localStorage.setItem("marinara:whats-new:seen-version", version);
    localStorage.setItem(
      "marinara-engine-ui",
      JSON.stringify({
        state: {
          hasCompletedOnboarding: true,
          sidebarOpen: false,
          rightPanelOpen: false,
          chatHelpSeenModes: ["conversation", "roleplay", "game"],
          messagesPerPage: 20,
          chatBubbleStyle: "bubbles",
        },
        version: 96,
      }),
    );
  }, appVersion);
});

test("chat page-size changes while disabled restart from the newest cursor when re-enabled", async ({ page }) => {
  const fixtureMessages = Array.from({ length: 12 }, (_, index) => ({
    id: `paused-message-${index}`,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    content: `Paused transcript message ${index}`,
    role: "assistant",
    extra: "{}",
  }));
  await page.route("**/api/chats/paused-page-size/messages?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    const before = params.get("before")?.split("|")[1];
    const end = before ? fixtureMessages.findIndex((message) => message.id === before) : fixtureMessages.length;
    const limit = Number(params.get("limit"));
    return route.fulfill({ json: fixtureMessages.slice(Math.max(0, end - limit), end) });
  });
  await page.goto("/");
  await page.evaluate(async () => {
    // Mount the real hook with an isolated cache so chat-detail loading can be
    // paused independently of the app shell and its own query observers.
    const { useChatMessages } = await import("/src/hooks/use-chats.ts" as string);
    // Reuse the app's exact versioned module URLs, including Vite's cache hash,
    // so the harness and hook share the same React Query context.
    const dependencyUrl = (name: string) =>
      performance
        .getEntriesByType("resource")
        .find((entry) => new URL(entry.name).pathname.endsWith(`/deps/${name}.js`))!.name;
    const { default: React } = await import(dependencyUrl("react"));
    const { default: ReactDOM } = await import(dependencyUrl("react-dom_client"));
    const { QueryClient, QueryClientProvider } = await import(dependencyUrl("@tanstack_react-query"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    function Harness() {
      const [enabled, setEnabled] = React.useState(true);
      const [pageSize, setPageSize] = React.useState(4);
      const query = useChatMessages("paused-page-size", pageSize, enabled);
      return React.createElement(
        "div",
        { style: { position: "fixed", inset: 0, zIndex: 99999, background: "#16151c" } },
        React.createElement("button", { onClick: () => query.fetchNextPage() }, "Load fixture history"),
        React.createElement(
          "button",
          { onClick: () => setEnabled(!enabled) },
          enabled ? "Pause fixture" : "Resume fixture",
        ),
        React.createElement("button", { onClick: () => setPageSize(2) }, `Fixture page size ${pageSize}`),
        React.createElement(
          "output",
          { "data-testid": "paused-pages" },
          JSON.stringify(
            query.data?.pages.map((messages: Array<{ id: string }>) => messages.map((message) => message.id)),
          ),
        ),
      );
    }
    const container = document.createElement("div");
    document.body.append(container);
    ReactDOM.createRoot(container).render(
      React.createElement(QueryClientProvider, { client }, React.createElement(Harness)),
    );
  });
  const pages = page.getByTestId("paused-pages");
  await expect(pages).toHaveText(
    JSON.stringify([["paused-message-8", "paused-message-9", "paused-message-10", "paused-message-11"]]),
  );
  await page.getByRole("button", { name: "Load fixture history" }).click();
  await expect(pages).toContainText("paused-message-4");
  await page.getByRole("button", { name: "Pause fixture" }).click();
  await page.getByRole("button", { name: "Fixture page size 4" }).click();
  await expect(page.getByRole("button", { name: "Fixture page size 2" })).toBeVisible();
  await expect(pages).toContainText("paused-message-4");
  await page.getByRole("button", { name: "Resume fixture" }).click();
  await expect(pages).toHaveText(JSON.stringify([["paused-message-10", "paused-message-11"]]));
  await page.getByRole("button", { name: "Load fixture history" }).click();
  await expect(pages).toHaveText(
    JSON.stringify([
      ["paused-message-10", "paused-message-11"],
      ["paused-message-8", "paused-message-9"],
    ]),
  );
});

for (const mode of ["conversation", "roleplay"] as const) {
  test(`${mode} issue sweep: persona crops match the current image and padded times remain prose`, async ({
    page,
    request,
  }, testInfo) => {
    const oldCrop = { zoom: 1.5, offsetX: 0, offsetY: 10 };
    const crop = { srcX: 0.2, srcY: 0.1, srcWidth: 0.5, srcHeight: 0.5 };
    const personaResponse = await request.post("/api/characters/personas", {
      data: { name: "Sweep Persona" },
    });
    expect(personaResponse.ok(), await personaResponse.text()).toBeTruthy();
    const persona = (await personaResponse.json()) as { id: string };
    const avatarResponse = await request.post(`/api/characters/personas/${persona.id}/avatar`, {
      data: {
        avatar: readFileSync(new URL("../packages/client/public/icon-512.png", import.meta.url)).toString("base64"),
      },
    });
    expect(avatarResponse.ok(), await avatarResponse.text()).toBeTruthy();
    const { avatarPath: avatarUrl } = (await avatarResponse.json()) as { avatarPath: string };
    await request.patch(`/api/characters/personas/${persona.id}`, { data: { avatarCrop: crop } });
    for (const path of [avatarUrl, "/api/avatars/sweep-old.png"]) {
      await page.route(`**${path}`, (route) =>
        route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#302540"/><circle cx="90" cy="70" r="35" fill="#dfb68e"/><rect x="40" y="110" width="100" height="90" fill="#699eb7"/></svg>',
        }),
      );
    }
    const chatResponse = await request.post("/api/chats", {
      data: { name: "Sweep Persona Crop", mode, characterIds: [], personaId: persona.id },
    });
    const chat = (await chatResponse.json()) as { id: string };
    try {
      const messageResponse = await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "user", content: "The current portrait should agree with my menu." },
      });
      const message = (await messageResponse.json()) as { id: string; extra: string };
      const snapshot = JSON.parse(message.extra).personaSnapshot as { avatarCrop: string };
      expect(JSON.parse(snapshot.avatarCrop)).toEqual(crop);
      await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", content: "An intervening reply keeps both portrait rows visible." },
      });
      const historicalResponse = await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "user", content: "This replaced portrait must keep its historical crop." },
      });
      const historical = (await historicalResponse.json()) as { id: string };
      await request.patch(`/api/chats/${chat.id}/messages/${historical.id}/extra`, {
        data: {
          personaSnapshot: {
            personaId: persona.id,
            name: "Earlier Persona",
            avatarUrl: "/api/avatars/sweep-old.png",
            avatarCrop: JSON.stringify(JSON.stringify(oldCrop)),
          },
        },
      });
      await request.patch(`/api/characters/personas/${persona.id}`, { data: { avatarCrop: crop } });
      const proseResponse = await request.post(`/api/chats/${chat.id}/messages`, {
        data: {
          role: "assistant",
          content: "0600\n\n*0600*\n\n0600. Wake up.\n\n0001. Report received.\n\n1. First item\n2. Second item",
        },
      });
      const prose = (await proseResponse.json()) as { id: string };
      await page.addInitScript((id) => localStorage.setItem("marinara-active-chat-id", id), chat.id);
      await page.goto("/");
      const currentImage = page.locator(`[data-message-id="${message.id}"] img[src="${avatarUrl}"]`).first();
      await expect(currentImage).toHaveJSProperty("complete", true);
      await expect(currentImage).toHaveAttribute("style", /width: 200%;/);
      await expect(currentImage).toHaveAttribute("style", /left: -40%;/);
      const historicImage = page
        .locator(`[data-message-id="${historical.id}"] img[src="/api/avatars/sweep-old.png"]`)
        .first();
      await expect(historicImage).toHaveAttribute("style", /scale\(1\.5\)/);
      const proseRow = page.locator(`[data-message-id="${prose.id}"]`);
      await expect(proseRow).toContainText("0600. Wake up.");
      await expect(proseRow).toContainText("0001. Report received.");
      await expect(proseRow.locator("ol")).toHaveCount(1);
      await expect(proseRow.locator("ol li")).toHaveCount(2);
      await testInfo.attach(`${mode}-avatar-and-time`, { body: await page.screenshot(), contentType: "image/png" });
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`).catch(() => undefined);
      await request.delete(`/api/characters/personas/${persona.id}`).catch(() => undefined);
    }
  });

  test(`${mode} issue sweep: goto loads history and page-size changes refetch`, async ({ page, request }, testInfo) => {
    const transcript = [
      JSON.stringify({ user_name: "You", character_name: "Guide", chat_metadata: {} }),
      ...Array.from({ length: 120 }, (_, index) =>
        JSON.stringify({
          name: index % 2 ? "Guide" : "You",
          is_user: index % 2 === 0,
          mes: `Sweep transcript message ${index + 1}. A short synthetic message for history navigation.`,
        }),
      ),
    ].join("\n");
    const importedResponse = await request.post("/api/import/st-chat", {
      multipart: {
        file: { name: `sweep-${mode}.jsonl`, mimeType: "application/jsonl", buffer: Buffer.from(transcript) },
        mode,
      },
    });
    expect(importedResponse.ok(), await importedResponse.text()).toBeTruthy();
    const { chatId } = (await importedResponse.json()) as { chatId: string };
    try {
      await page.addInitScript((id) => localStorage.setItem("marinara-active-chat-id", id), chatId);
      await page.goto("/");
      const composer = page.locator('[data-chat-composer="true"]:visible');
      await expect(page.getByText(/^Sweep transcript message 120\./)).toBeVisible();
      const messages = page.locator("[data-message-id]");
      await expect(messages).toHaveCount(20);

      for (const [command, target] of [
        ["goto", 104],
        ["jump", 30],
        ["scroll", 80],
      ] as const) {
        await composer.fill(`/${command} ${target}`);
        if (mode === "roleplay") await page.locator("button.mari-chat-send-btn").click();
        else await composer.press("Enter");
        await expect(composer).toHaveValue("");
        const targetMessage = page.getByText(new RegExp(`^Sweep transcript message ${target}\\.`));
        await expect(targetMessage).toBeInViewport();
        // Let native smooth scrolling settle so a transient pass cannot hide a snap-back.
        await page.waitForTimeout(500);
        await expect(targetMessage).toBeInViewport();
      }
      await testInfo.attach(`${mode}-goto-history`, { body: await page.screenshot(), contentType: "image/png" });

      await page.locator('[data-tour="panel-settings"]').click();
      const pageSize = page.locator("#settings-control-messages-per-page input");
      const refetched = page.waitForResponse(
        (response) => response.url().includes(`/chats/${chatId}/messages?limit=100`) && response.ok(),
      );
      await pageSize.fill("");
      await pageSize.pressSequentially("100");
      await pageSize.press("Tab");
      await refetched;
      await page.locator('[data-tour="panel-settings"]').click();
      await expect(messages).toHaveCount(100);
      await page.locator('[data-tour="panel-settings"]').click();
      await pageSize.fill("0");
      await pageSize.press("Tab");
      await page.locator('[data-tour="panel-settings"]').click();
      await expect(messages).toHaveCount(120);
      await page.locator('[data-tour="panel-settings"]').click();
      await pageSize.fill("20");
      await pageSize.press("Tab");
      await page.locator('[data-tour="panel-settings"]').click();
      await expect(messages).toHaveCount(20);
      await expect(page.getByText(/^Sweep transcript message 120\./)).toBeVisible();
    } finally {
      await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
    }
  });
}

test("mobile issue sweep: paused fallback weather keeps its bitmap across viewport resizing", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile compositor pause path only.");
  await page.addInitScript(() => {
    delete (HTMLCanvasElement.prototype as Partial<HTMLCanvasElement>).transferControlToOffscreen;
  });
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Weather resize fixture", mode: "roleplay", characterIds: [] },
  });
  const chat = (await chatResponse.json()) as { id: string };
  try {
    await request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "assistant", content: "Rain falls outside the observatory." },
    });
    const stateResponse = await request.patch(`/api/chats/${chat.id}/game-state`, {
      data: { weather: "rain", time: "night" },
    });
    expect(stateResponse.ok(), await stateResponse.text()).toBeTruthy();
    await page.addInitScript((id) => localStorage.setItem("marinara-active-chat-id", id), chat.id);
    await page.goto("/");
    const canvas = page.locator('canvas[class*="contain:strict"]');
    await expect(canvas).toHaveCount(1);
    const painted = () =>
      canvas.evaluate((element) => {
        const canvasElement = element as HTMLCanvasElement;
        return canvasElement
          .getContext("2d")!
          .getImageData(0, 0, canvasElement.width, canvasElement.height)
          .data.some((value, index) => index % 4 === 3 && value > 0);
      });
    await expect.poll(painted).toBe(true);
    const composer = page.locator('[data-chat-composer="true"]:visible');
    await composer.fill("A draft freezes ambient animation.");
    const original = page.viewportSize()!;
    await page.setViewportSize({ width: original.width, height: 480 });
    await expect.poll(painted).toBe(true);
    await testInfo.attach("weather-paused-resize", { body: await page.screenshot(), contentType: "image/png" });
    await page.setViewportSize(original);
    await composer.fill("");
    await composer.blur();
    await expect.poll(painted).toBe(true);
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`).catch(() => undefined);
  }
});
