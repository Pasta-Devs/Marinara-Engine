import { expect, test, type APIRequestContext, type Page, type Route } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { PROVIDERS } from "../packages/shared/src/constants/providers.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;
const ENDPOINT = "http://127.0.0.1:19091/team/comfy";

type MediaRow = {
  id: string;
  accountId?: string | null;
  name: string;
  provider: string;
  baseUrl: string;
  model?: string | null;
  imageGenerationSource?: string | null;
  imageService?: string | null;
  videoGenerationSource?: string | null;
  videoService?: string | null;
  comfyuiWorkflow?: string | null;
  defaultParameters?: string | null;
};

async function rows(request: APIRequestContext) {
  return (await (await request.get("/api/connections")).json()) as MediaRow[];
}

async function openAddModels(page: Page, accountId: string, kind?: "image" | "video") {
  await page.evaluate(
    async ({ accountId, kind }) => {
      const { openAddModels } = await import("/src/lib/add-connection.ts" as string);
      openAddModels({ accountId, ...(kind ? { kind } : {}) });
    },
    { accountId, kind },
  );
}

function invariant(row: MediaRow) {
  return {
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    provider: row.provider,
    baseUrl: row.baseUrl,
    model: row.model,
    imageGenerationSource: row.imageGenerationSource,
    imageService: row.imageService,
    videoGenerationSource: row.videoGenerationSource,
    videoService: row.videoService,
    comfyuiWorkflow: row.comfyuiWorkflow,
    defaultParameters: row.defaultParameters,
  };
}

function expectNoUnexpectedFailedRequests(failures: string[], successfulDeletes: Set<string>) {
  const unexpected = failures.filter((failure) => {
    // Query invalidation and closing a surface can cancel reads; canceled writes remain failures below.
    if (/^GET .*: net::ERR_ABORTED$/u.test(failure)) return false;
    // Chromium can report ERR_ABORTED for a bodyless response. Accept only a DELETE whose actual HTTP 204
    // response was observed; persistence assertions below separately prove the row was removed.
    const deletion = /^DELETE (.+): net::ERR_ABORTED$/u.exec(failure);
    return !deletion || !successfulDeletes.has(deletion[1]!);
  });
  expect(unexpected).toEqual([]);
}

test("guided ComfyUI setup adds distinct image and video models without changing the original", async ({
  page,
  request,
}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "One browser owns the shared endpoint and responsive proof.");

  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const successfulDeletes = new Set<string>();
  page.on("response", (response) => {
    if (response.request().method() === "DELETE" && response.status() === 204) successfulDeletes.add(response.url());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (failed) =>
    failedRequests.push(`${failed.method()} ${failed.url()}: ${failed.failure()?.errorText ?? "unknown error"}`),
  );
  const initialAccounts = new Set(
    ((await (await request.get("/api/connection-accounts")).json()) as Array<{ id: string }>).map(
      (account) => account.id,
    ),
  );
  let accountId: string | null = null;
  const createdIds = new Set<string>();
  const originalWorkflow = JSON.stringify({
    "3": { class_type: "KSampler", inputs: { steps: "%steps%", positive: "%prompt%" } },
    "9": { class_type: "SaveImage", inputs: { filename_prefix: "original" } },
  });
  const originalParameters = {
    customParameters: { e2e_origin: "keep-me", strength: 0.42 },
  };

  try {
    const originalResponse = await request.post("/api/connections", {
      data: {
        name: `Original Comfy workflow ${info.workerIndex}`,
        provider: "image_generation",
        imageGenerationSource: "comfyui",
        imageService: "comfyui",
        baseUrl: ENDPOINT,
        apiKey: "",
        model: "original-checkpoint.safetensors",
        comfyuiWorkflow: originalWorkflow,
      },
    });
    expect(originalResponse.ok()).toBeTruthy();
    const original = (await originalResponse.json()) as MediaRow;
    createdIds.add(original.id);
    expect(original.accountId).toBeTruthy();
    accountId = original.accountId!;
    const defaultsResponse = await request.put(`/api/connections/${original.id}/default-parameters`, {
      data: originalParameters,
    });
    expect(defaultsResponse.ok()).toBeTruthy();
    const originalBefore = (await (await request.get(`/api/connections/${original.id}`)).json()) as MediaRow;

    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      theme: "dark",
    });
    await page.addInitScript(
      (version) => localStorage.setItem("marinara:whats-new:seen-version", version),
      APP_VERSION,
    );
    await page.goto("/");

    // The ComfyUI list offers its checkpoints as rows; the workflow is set later with Edit.
    await page.route("**/api/connections/*/models*", (route) =>
      route.fulfill({ json: { models: [{ id: "second-checkpoint.safetensors", name: "Second checkpoint" }] } }),
    );

    // Service discovery must reuse media access without creating a chat placeholder.
    await page.evaluate(async () => {
      const { openAddConnection } = await import("/src/lib/add-connection.ts" as string);
      openAddConnection();
    });
    const serviceDialog = page.getByRole("dialog", { name: "Add connection", exact: true });
    await serviceDialog.locator('[data-add-connection-service="media:comfyui"]').click();
    await expect(
      serviceDialog.getByRole("heading", { name: "Use an existing ComfyUI connection?", exact: true }),
    ).toBeVisible();
    await serviceDialog.locator(`[data-add-connection-existing-account="${accountId}"]`).click();
    await expect(serviceDialog.locator('[data-add-connection-capability="image"]')).toBeVisible();
    await expect(serviceDialog.locator('[data-add-connection-capability="video"]')).toBeVisible();
    await expect(serviceDialog.locator('[data-add-connection-capability="image"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(serviceDialog.locator("[data-model-search]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(serviceDialog).toHaveCount(0);
    // The image row opened for the list is a placeholder: closing without a pick removes it.
    await expect
      .poll(async () => (await rows(request)).filter((row) => row.accountId === accountId).map((row) => row.id))
      .toEqual([original.id]);

    // A refused placeholder leaves the chips to try again and writes nothing.
    const refusedMessage = "E2E refused the first media row";
    const rejectCreate = async (route: Route) => {
      const request = route.request();
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/connections") {
        await route.fulfill({ status: 500, json: { error: refusedMessage } });
        return;
      }
      await route.fallback();
    };
    await page.route("**/api/connections", rejectCreate);
    await openAddModels(page, accountId);
    let dialog = page.getByRole("dialog", { name: "Add model", exact: true });
    await expect(page.getByText(refusedMessage, { exact: true })).toBeVisible();
    await expect(dialog.locator('[data-add-connection-capability="image"]')).toBeVisible();
    await expect(dialog.locator('[data-add-connection-capability="video"]')).toBeVisible();
    expect((await rows(request)).filter((row) => row.accountId === accountId).map((row) => row.id)).toEqual([
      original.id,
    ]);
    await page.unroute("**/api/connections", rejectCreate);

    const imageCreatedResponse = page.waitForResponse(
      (response) =>
        response.ok() &&
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/connections",
    );
    await dialog.locator('[data-add-connection-capability="image"]').click();
    const imageCreated = (await (await imageCreatedResponse).json()) as { id: string };
    createdIds.add(imageCreated.id);
    const checkpoint = dialog.locator('[data-model-id="second-checkpoint.safetensors"] [data-model-option]');
    await expect(checkpoint).toBeVisible();

    mkdirSync(".tmp/connections-media/screenshots", { recursive: true });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({
        animations: "disabled",
        path: `.tmp/connections-media/screenshots/guided-image-${width}-dark.png`,
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    await checkpoint.click();
    await expect
      .poll(async () => (await rows(request)).find((row) => row.id === imageCreated.id)?.model)
      .toBe("second-checkpoint.safetensors");
    await dialog.locator("[data-add-connection-done]").click();
    await expect(dialog).toHaveCount(0);

    // A video row takes a typed checkpoint the list does not name.
    const videoCreatedResponse = page.waitForResponse(
      (response) =>
        response.ok() &&
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/connections",
    );
    await openAddModels(page, accountId, "video");
    dialog = page.getByRole("dialog", { name: "Add model", exact: true });
    await expect(dialog.locator('[data-add-connection-capability="video"]')).toHaveAttribute("aria-pressed", "true");
    const videoCreated = (await (await videoCreatedResponse).json()) as { id: string };
    createdIds.add(videoCreated.id);
    await dialog.locator("[data-model-search]").fill("motion-checkpoint.safetensors");
    await dialog.locator("[data-model-search]").press("Enter");
    await expect
      .poll(async () => (await rows(request)).find((row) => row.id === videoCreated.id)?.model)
      .toBe("motion-checkpoint.safetensors");
    await dialog.locator("[data-add-connection-done]").click();
    await expect(dialog).toHaveCount(0);

    const saved = await rows(request);
    const originalAfter = saved.find((row) => row.id === original.id);
    const imageAfter = saved.find((row) => row.id === imageCreated.id);
    const videoAfter = saved.find((row) => row.id === videoCreated.id);
    expect(originalAfter).toBeTruthy();
    expect(imageAfter).toBeTruthy();
    expect(videoAfter).toBeTruthy();
    expect(invariant(originalAfter!)).toEqual(invariant(originalBefore));
    for (const row of [originalAfter!, imageAfter!, videoAfter!]) {
      expect(row.accountId).toBe(accountId);
      expect(row.baseUrl).toBe(ENDPOINT);
    }
    expect(imageAfter).toMatchObject({
      name: "Second checkpoint",
      provider: "image_generation",
      model: "second-checkpoint.safetensors",
      imageGenerationSource: "comfyui",
      imageService: "comfyui",
    });
    expect(videoAfter).toMatchObject({
      provider: "video_generation",
      model: "motion-checkpoint.safetensors",
      videoGenerationSource: "comfyui",
      videoService: "comfyui",
    });

    // Closing without a pick removes only that temporary row.
    const cancelledResponse = page.waitForResponse(
      (response) =>
        response.ok() &&
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/connections",
    );
    await openAddModels(page, accountId, "image");
    dialog = page.getByRole("dialog", { name: "Add model", exact: true });
    const cancelledId = ((await (await cancelledResponse).json()) as { id: string }).id;
    createdIds.add(cancelledId);
    await expect(dialog.locator("[data-model-search]")).toBeVisible();
    const close = dialog.getByRole("button", { name: "Close Add model", exact: true });
    await expect(close).toBeEnabled();
    await close.click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(async () => (await rows(request)).some((row) => row.id === cancelledId)).toBe(false);
    expect(
      (await rows(request)).filter((row) => [original.id, imageCreated.id, videoCreated.id].includes(row.id)),
    ).toHaveLength(3);
    expect(pageErrors).toEqual([]);
    expectNoUnexpectedFailedRequests(failedRequests, successfulDeletes);
  } finally {
    for (const id of createdIds) {
      await request.delete(`/api/connections/${id}`).catch(() => undefined);
    }
    if (accountId && !initialAccounts.has(accountId)) {
      await request.delete(`/api/connection-accounts/${accountId}`).catch(() => undefined);
    }
  }
});

test("a fresh ComfyUI connection can finish as video without leaving its image placeholder", async ({
  page,
  request,
}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "The fresh account uses one shared browser server.");

  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const successfulDeletes = new Set<string>();
  page.on("response", (response) => {
    if (response.request().method() === "DELETE" && response.status() === 204) successfulDeletes.add(response.url());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (failed) =>
    failedRequests.push(`${failed.method()} ${failed.url()}: ${failed.failure()?.errorText ?? "unknown error"}`),
  );
  const endpoint = "http://127.0.0.1:19092/fresh/comfy";
  const initialAccounts = new Set(
    ((await (await request.get("/api/connection-accounts")).json()) as Array<{ id: string }>).map(
      (account) => account.id,
    ),
  );
  const createdIds = new Set<string>();
  let accountId: string | null = null;

  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      theme: "dark",
    });
    await page.addInitScript(
      (version) => localStorage.setItem("marinara:whats-new:seen-version", version),
      APP_VERSION,
    );
    await page.goto("/");
    await page.evaluate(async () => {
      const { openAddConnection } = await import("/src/lib/add-connection.ts" as string);
      openAddConnection();
    });

    const dialog = page.getByRole("dialog", { name: "Add connection", exact: true });
    await dialog.locator('[data-add-connection-service="media:comfyui"]').click();
    const connectSecond = dialog.getByRole("button", { name: "Make a new connection", exact: true });
    if (await connectSecond.isVisible()) await connectSecond.click();
    await dialog.getByRole("button", { name: "More options", exact: true }).click();
    await dialog.getByLabel("Address", { exact: true }).fill(endpoint);

    const accountCreatedResponse = page.waitForResponse(
      (response) =>
        response.ok() &&
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/connection-accounts",
    );
    await dialog.locator("[data-add-connection-connect]").click();
    const created = (await (await accountCreatedResponse).json()) as {
      account: { id: string };
      connectionId: string;
    };
    accountId = created.account.id;
    createdIds.add(created.connectionId);
    // Image is the first kind, so its list opens on the fresh placeholder; Video makes its own row.
    await expect(dialog.locator('[data-add-connection-capability="image"]')).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.locator("[data-model-search]")).toBeVisible();
    const videoRowResponse = page.waitForResponse(
      (response) =>
        response.ok() &&
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/connections",
    );
    await dialog.locator('[data-add-connection-capability="video"]').click();
    const videoCreated = (await (await videoRowResponse).json()) as { id: string };
    createdIds.add(videoCreated.id);
    await dialog.locator("[data-model-search]").fill("fresh-video-checkpoint.safetensors");
    await dialog.locator("[data-model-search]").press("Enter");
    await expect
      .poll(async () => (await rows(request)).find((row) => row.id === videoCreated.id)?.model)
      .toBe("fresh-video-checkpoint.safetensors");
    await dialog.locator("[data-add-connection-done]").click();
    await expect(dialog).toHaveCount(0);

    const accountRows = (await rows(request)).filter((row) => row.accountId === accountId);
    expect(accountRows).toHaveLength(1);
    expect(accountRows[0]).toMatchObject({
      id: videoCreated.id,
      provider: "video_generation",
      baseUrl: endpoint,
      model: "fresh-video-checkpoint.safetensors",
      videoGenerationSource: "comfyui",
      videoService: "comfyui",
    });
    expect(accountRows.some((row) => row.provider === "image_generation" && !row.model?.trim())).toBe(false);
    expect(pageErrors).toEqual([]);
    expectNoUnexpectedFailedRequests(failedRequests, successfulDeletes);
  } finally {
    for (const id of createdIds) {
      await request.delete(`/api/connections/${id}`).catch(() => undefined);
    }
    if (accountId && !initialAccounts.has(accountId)) {
      await request.delete(`/api/connection-accounts/${accountId}`).catch(() => undefined);
    }
  }
});

test("opening an empty connection initializes once while the account refresh is pending", async ({
  page,
  request,
}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "One browser owns this initialization fixture.");
  const response = await request.post("/api/connection-accounts", {
    data: { name: "Empty setup", provider: "custom", baseUrl: "http://127.0.0.1:19094/v1", apiKey: "" },
  });
  expect(response.ok()).toBeTruthy();
  const { account, connectionId } = await response.json();
  await request.delete(`/api/connections/${connectionId}`);
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let refreshStarted!: () => void;
  const refresh = new Promise<void>((resolve) => {
    refreshStarted = resolve;
  });
  let creations = 0;
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await page.route("**/api/connections", async (route) => {
      if (route.request().method() === "POST") creations++;
      await route.fallback();
    });
    await page.route("**/api/connection-accounts", async (route) => {
      if (route.request().method() === "GET" && creations) {
        refreshStarted();
        await released;
      }
      await route.fallback();
    });
    await page.route("**/api/connections/*/models*", (route) => route.fulfill({ json: { models: [] } }));
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
    await page.addInitScript(
      (version) => localStorage.setItem("marinara:whats-new:seen-version", version),
      APP_VERSION,
    );
    await page.goto("/");
    await openAddModels(page, account.id);
    await refresh;
    // Let the model-list refresh render while its sibling account refresh is still deliberately held.
    await expect.poll(async () => (await rows(request)).filter((row) => row.accountId === account.id).length).toBe(1);
    await page.waitForTimeout(350);
    expect(creations).toBe(1);
    release();
    const dialog = page.getByRole("dialog", { name: "Add model", exact: true });
    await expect(dialog.locator('[data-add-connection-step="3"]')).toBeVisible();
    await dialog.getByRole("button", { name: "Close Add model", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(async () => (await rows(request)).filter((row) => row.accountId === account.id).length).toBe(0);
  } finally {
    release();
    for (const row of await rows(request))
      if (row.accountId === account.id) await request.delete(`/api/connections/${row.id}`);
    await request.delete(`/api/connection-accounts/${account.id}`);
  }
});

test("switching kinds keeps a fresh connection's chat catalog available", async ({ page, request }, info) => {
  test.skip(info.project.name !== "desktop-chromium", "One browser owns this fresh setup flow.");
  let accountId: string | null = null;
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await page.route("**/api/connections/*/test", (route) =>
      route.fulfill({ json: { success: true, latencyMs: 1, message: "ok", modelName: null } }),
    );
    await page.route("**/api/connections/*/models*", (route) =>
      route.fulfill({ json: { models: [{ id: "gpt-fixture", name: "Fixture chat" }] } }),
    );
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
    await page.addInitScript(
      (version) => localStorage.setItem("marinara:whats-new:seen-version", version),
      APP_VERSION,
    );
    await page.goto("/");
    await page.evaluate(async () => {
      const { openAddConnection } = await import("/src/lib/add-connection.ts" as string);
      openAddConnection({ provider: "openai" });
    });
    const dialog = page.getByRole("dialog", { name: "Add connection", exact: true });
    const second = dialog.getByRole("button", { name: "Make a new connection", exact: true });
    if (await second.isVisible()) await second.click();
    await dialog.getByLabel("API key", { exact: true }).fill("fixture-not-real");
    const createdAccount = page.waitForResponse(
      (response) =>
        response.ok() &&
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/connection-accounts",
    );
    await dialog.locator("[data-add-connection-connect]").click();
    accountId = ((await (await createdAccount).json()) as { account: { id: string } }).account.id;
    await expect(dialog.locator('[data-add-connection-capability="chat"]')).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.locator('[data-model-id="gpt-fixture"]')).toBeVisible();
    await dialog.locator('[data-add-connection-capability="image"]').click();
    await expect
      .poll(async () => (await rows(request)).filter((row) => row.accountId === accountId).map((row) => row.provider))
      .toEqual(expect.arrayContaining(["openai", "image_generation"]));
    await dialog.locator('[data-add-connection-capability="chat"]').click();
    await expect(dialog.locator('[data-model-id="gpt-fixture"]')).toBeVisible();
    await dialog.getByRole("button", { name: "Close Add connection", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(async () => (await rows(request)).filter((row) => row.accountId === accountId).length).toBe(0);
  } finally {
    if (accountId) {
      for (const row of await rows(request)) {
        if (row.accountId === accountId) await request.delete(`/api/connections/${row.id}`);
      }
      await request.delete(`/api/connection-accounts/${accountId}`);
    }
  }
});

test("a vendor connection set up for images can open its chat catalog without retyping access", async ({
  page,
  request,
}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "One browser owns the vendor fixture.");
  const created = await request.post("/api/connections", {
    data: {
      name: "Original image",
      provider: "image_generation",
      imageGenerationSource: "openai",
      imageService: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "fixture-vendor-key",
      model: "gpt-image-fixture",
    },
  });
  expect(created.ok()).toBeTruthy();
  const image = (await created.json()) as MediaRow;
  expect(image.accountId).toBeTruthy();
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await page.route("**/api/connection-accounts", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      const response = await route.fetch();
      await route.fulfill({
        response,
        json: ((await response.json()) as Array<{ id: string }>).filter((account) => account.id === image.accountId),
      });
    });
    await page.route("**/api/connections/*/models*", (route) =>
      route.fulfill({
        json: {
          models: [
            { id: "gpt-fixture", name: "Fixture chat" },
            { id: "gpt-fixture-two", name: "Second fixture chat" },
          ],
        },
      }),
    );
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
    await page.addInitScript(
      (version) => localStorage.setItem("marinara:whats-new:seen-version", version),
      APP_VERSION,
    );
    await page.goto("/");
    await page.evaluate(async () => {
      const { openAddConnection } = await import("/src/lib/add-connection.ts" as string);
      openAddConnection({ provider: "openai" });
    });
    const dialog = page.getByRole("dialog", { name: "Add connection", exact: true });
    await dialog.locator(`[data-add-connection-existing-account="${image.accountId}"]`).click();
    await dialog.locator('[data-add-connection-capability="chat"]').click();
    await expect(dialog.locator('[data-model-id="gpt-fixture"]')).toBeVisible();
    await dialog.locator('[data-model-id="gpt-fixture"] [data-model-option]').click();
    await dialog.locator('[data-model-id="gpt-fixture-two"] [data-model-option]').click();
    await expect
      .poll(async () => (await rows(request)).filter((row) => row.accountId === image.accountId).length)
      .toBe(3);
    const linked = (await rows(request)).filter((row) => row.accountId === image.accountId);
    expect(linked).toHaveLength(3);
    expect(linked.filter((row) => row.id !== image.id).every((row) => !!row.model?.trim())).toBe(true);
    for (const row of linked.filter((row) => row.id !== image.id)) {
      const detail = await (await request.get(`/api/connections/${row.id}`)).json();
      expect(detail.apiKeyEncrypted).toBeTruthy();
      expect(row.accountId).toBe(image.accountId);
      expect(row.baseUrl || PROVIDERS[row.provider as keyof typeof PROVIDERS]?.defaultBaseUrl).toBe(
        "https://api.openai.com/v1",
      );
    }
    expect(linked.find((row) => row.id !== image.id)).toMatchObject({
      provider: "openai",
    });
    expect(linked.find((row) => row.id === image.id)).toMatchObject({
      provider: "image_generation",
      model: "gpt-image-fixture",
    });
    await dialog.getByRole("button", { name: "Close Add connection", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(async () => (await rows(request)).filter((row) => row.accountId === image.accountId).length)
      .toBe(3);
  } finally {
    for (const row of await rows(request))
      if (row.accountId === image.accountId) await request.delete(`/api/connections/${row.id}`);
    await request.delete(`/api/connection-accounts/${image.accountId}`);
  }
});
