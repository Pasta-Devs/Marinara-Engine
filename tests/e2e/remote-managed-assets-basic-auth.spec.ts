import { expect, test, type Page } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

type ProbeResult = {
  firstGameText: string;
  objectUrls: Array<{ size: number; type: string; url: string }>;
  refreshedGameRender: { height: number; name: string; width: number };
  refreshedGameText: string;
  rendered: Array<{ height: number; name: string; width: number }>;
  resolved: Array<{ name: string; url: string }>;
  revokedObjectUrls: string[];
};

type AssetRequest = {
  authorization: string | undefined;
  method: string | undefined;
  url: string | undefined;
};

const BASIC_AUTH_USERNAME = "mari";
const BASIC_AUTH_PASSWORD = "sauce";
const EXPECTED_AUTHORIZATION = `Basic ${Buffer.from(`${BASIC_AUTH_USERNAME}:${BASIC_AUTH_PASSWORD}`).toString("base64")}`;
const EXPECTED_ASSET_PATHS = [
  "/api/assets/avatar/characters/alice/avatar.svg",
  "/api/assets/avatar-thumbnail/128/characters/alice/avatar.svg",
  "/api/assets/background/sky.svg",
  "/api/assets/font/Serif.woff2",
  "/api/assets/gallery/gallery.svg",
  "/api/assets/game/scene/hero.svg",
  "/api/assets/lorebook/lore.svg",
  "/api/assets/sprite/character/char-1/pose.svg",
  "/api/assets/thumbnail/gallery/256/gallery.svg",
];

let viteServer: ViteDevServer;
let viteUrl: string;

function listen(server: ReturnType<typeof createHttpServer>): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve((server.address() as AddressInfo).port);
    });
  });
}

function closeServer(server: Pick<ReturnType<typeof createHttpServer>, "close">): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function setCorsHeaders(request: IncomingMessage, response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", request.headers.origin ?? "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, X-Marinara-CSRF");
  response.setHeader("Access-Control-Expose-Headers", "Cache-Control, ETag");
}

function assetSvg(label: string, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${color}"/><title>${label}</title></svg>`;
}

function createAuthenticatedAssetServer(requests: AssetRequest[]) {
  return createHttpServer((request, response) => {
    setCorsHeaders(request, response);
    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }

    requests.push({
      authorization: request.headers.authorization,
      method: request.method,
      url: request.url,
    });

    if (request.headers.authorization !== EXPECTED_AUTHORIZATION) {
      response.writeHead(401).end("Unauthorized");
      return;
    }

    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (!url.pathname.startsWith("/api/assets/")) {
      response.writeHead(404).end("Not found");
      return;
    }

    const refreshed = url.searchParams.has("mriAssetV");
    response.setHeader("Content-Type", "image/svg+xml");
    response.setHeader("Cache-Control", "public, max-age=31536000");
    response.setHeader("ETag", refreshed ? '"asset-after"' : '"asset-before"');
    response.end(assetSvg(refreshed ? "variant-after" : "variant-before", refreshed ? "#246bfe" : "#d93f3f"));
  });
}

async function runProbe(page: Page, runtimeUrl: string): Promise<ProbeResult> {
  await page.goto(`${viteUrl}/tests/e2e/fixtures/remote-managed-asset-probe.html`);
  await expect(page.getByRole("heading", { name: "Remote managed asset probe" })).toBeVisible();
  return page.evaluate((url) => {
    const probe = (
      window as unknown as {
        __runRemoteManagedAssetProbe: (payload: { runtimeUrl: string }) => Promise<ProbeResult>;
      }
    ).__runRemoteManagedAssetProbe;
    return probe({ runtimeUrl: url });
  }, runtimeUrl);
}

test.beforeAll(async () => {
  viteServer = await createServer({
    logLevel: "error",
    server: { host: "127.0.0.1" },
  });
  await viteServer.listen(0);
  const address = viteServer.httpServer?.address() as AddressInfo;
  viteUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await viteServer.close();
});

test("remote managed assets render as Basic Auth blobs and refresh after invalidation", async ({ page }) => {
  const requests: AssetRequest[] = [];
  const assetServer = createAuthenticatedAssetServer(requests);
  const assetPort = await listen(assetServer);
  const runtimeUrl = `http://${BASIC_AUTH_USERNAME}:${BASIC_AUTH_PASSWORD}@127.0.0.1:${assetPort}`;

  try {
    const result = await runProbe(page, runtimeUrl);
    const assetRequests = requests.filter((request) => request.method === "GET");

    expect(result.resolved.map((entry) => entry.name)).toEqual([
      "avatar",
      "avatar-thumbnail",
      "background",
      "font",
      "gallery",
      "game",
      "lorebook",
      "sprite",
      "thumbnail",
    ]);
    expect(result.resolved.every((entry) => entry.url.startsWith("blob:"))).toBe(true);
    expect(result.resolved.every((entry) => !entry.url.includes(BASIC_AUTH_USERNAME))).toBe(true);
    expect(result.rendered).toEqual(
      expect.arrayContaining([
        { height: 8, name: "avatar", width: 8 },
        { height: 8, name: "avatar-thumbnail", width: 8 },
        { height: 8, name: "background", width: 8 },
        { height: 8, name: "gallery", width: 8 },
        { height: 8, name: "game", width: 8 },
        { height: 8, name: "lorebook", width: 8 },
        { height: 8, name: "sprite", width: 8 },
        { height: 8, name: "thumbnail", width: 8 },
      ]),
    );
    expect(result.refreshedGameRender).toEqual({ height: 8, name: "game-refreshed", width: 8 });
    expect(result.firstGameText).toContain("variant-before");
    expect(result.refreshedGameText).toContain("variant-after");
    expect(result.revokedObjectUrls).toContain(result.resolved.find((entry) => entry.name === "game")?.url);
    expect(result.objectUrls).toHaveLength(10);

    for (const assetPath of EXPECTED_ASSET_PATHS) {
      expect(assetRequests.some((request) => new URL(request.url ?? "/", "http://127.0.0.1").pathname === assetPath)).toBe(
        true,
      );
    }

    expect(assetRequests.every((request) => request.authorization === EXPECTED_AUTHORIZATION)).toBe(true);
    expect(assetRequests.every((request) => !request.url?.includes(BASIC_AUTH_USERNAME))).toBe(true);
    expect(assetRequests.every((request) => !request.url?.includes(BASIC_AUTH_PASSWORD))).toBe(true);
    expect(
      assetRequests.some((request) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        return url.pathname === "/api/assets/game/scene/hero.svg" && url.searchParams.has("mriAssetV");
      }),
    ).toBe(true);

  } finally {
    await closeServer(assetServer);
  }
});
