import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";
import { expect, test, type APIRequestContext, type Page, type Route, type TestInfo } from "@playwright/test";
import type {
  TacticalBattlefieldBrief,
  TacticalCombatState,
} from "../packages/shared/src/features/tactical-combat/types.js";
import { seedUIState } from "./ui-state-fixture.js";

type HybridTerrainFixture = {
  acceptedCount: number;
  isMutating: () => number;
  unmount: () => void;
};

declare global {
  interface Window {
    __hybridTerrainFixture?: HybridTerrainFixture;
  }
}

const party = [
  {
    id: "scout",
    name: "Flying scout",
    hp: 30,
    maxHp: 30,
    attack: 8,
    defense: 5,
    speed: 8,
    level: 1,
    side: "player",
    movementMode: "fly",
  },
];
const enemies = [
  { id: "guard", name: "Guard", hp: 30, maxHp: 30, attack: 6, defense: 4, speed: 5, level: 1, side: "enemy" },
];

async function createGame(request: APIRequestContext) {
  const response = await request.post("/api/game/create", {
    data: {
      name: "Hybrid battlefield browser proof",
      setupConfig: {
        genre: "Fantasy",
        setting: "A ruined crossing",
        tone: "Adventure",
        difficulty: "normal",
        playerGoals: "Cross the ruins",
        gmMode: "standalone",
        rating: "sfw",
        partyCharacterIds: [],
        combatStyle: "tactical",
        tacticalBattlefield: { seed: 0, size: "large" },
      },
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).sessionChat.id as string;
}

async function snapshot(request: APIRequestContext, chatId: string): Promise<TacticalCombatState | undefined> {
  const response = await request.get(`/api/chats/${chatId}`);
  const row = await response.json();
  const metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
  return metadata.gameTacticalCombatSnapshot;
}

async function createInitialTacticalState(request: APIRequestContext, chatId: string): Promise<TacticalCombatState> {
  const response = await request.post("/api/game/combat/tactical/start", {
    data: {
      chatId,
      party,
      enemies,
      seed: 0,
      environment: "ruins",
      formation: "line",
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return ((await response.json()) as { state: TacticalCombatState }).state;
}

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function delayNextTacticalStart(
  page: Page,
  shouldDelay: (payload: Record<string, unknown>) => boolean,
): Promise<{
  release: () => void;
  requestSeen: Promise<Record<string, unknown>>;
  responseReady: Promise<void>;
  responseComplete: Promise<void>;
}> {
  const release = deferred();
  const requestSeen = deferred<Record<string, unknown>>();
  const responseReady = deferred();
  const responseComplete = deferred();
  // The caller may exit on responseReady's rejection before awaiting responseComplete.
  void responseReady.promise.catch(() => {});
  void responseComplete.promise.catch(() => {});
  let delayed = false;
  await page.route("**/api/game/combat/tactical/start", async (route) => {
    const payload = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    if (delayed || !shouldDelay(payload)) {
      await route.continue(pinnedStart(route));
      return;
    }
    delayed = true;
    requestSeen.resolve(payload);
    try {
      const response = await route.fetch(pinnedStart(route));
      responseReady.resolve();
      await release.promise;
      await route.fulfill({ response });
      responseComplete.resolve();
    } catch (error) {
      responseReady.reject(error);
      responseComplete.reject(error);
      throw error;
    }
  });
  return {
    release: release.resolve,
    requestSeen: requestSeen.promise,
    responseReady: responseReady.promise,
    responseComplete: responseComplete.promise,
  };
}

async function unmountBattle(page: Page) {
  await page.evaluate(() => window.__hybridTerrainFixture?.unmount());
}

async function waitForSettledMutations(page: Page) {
  await expect.poll(() => page.evaluate(() => window.__hybridTerrainFixture?.isMutating() ?? 0)).toBe(0);
}

/** The first board a mount shows waits on a cold start of the fight on the real local API, which ran
 *  past the 10 s default now and then (ship readiness 2026-10-26: a random test of this file failed
 *  most runs, waiting for "End Turn" or "Use generated terrain"). */
const BOARD_READY_MS = 30_000;

/** The first start of a mount asks for a random board, and some boards had no wall in reach or no clash
 *  between the brief's features (ship readiness 2026-10-26: seed 4069513167 laid the wall and the water
 *  side by side). Seed 1 has both, so a start that names no seed is sent with it; a restart keeps its
 *  own seed. */
const PINNED_SEED = 1;

function pinnedStart(route: Route): { postData?: string } {
  const payload = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
  return payload.seed !== undefined ? {} : { postData: JSON.stringify({ ...payload, seed: PINNED_SEED }) };
}

async function pinFirstStartSeed(page: Page) {
  await page.route("**/api/game/combat/tactical/start", (route) => route.continue(pinnedStart(route)));
}

/** Mount the actual battle surface; start, actions and persistence use the real local API. */
async function mountBattle(
  page: Page,
  testInfo: TestInfo,
  chatId: string,
  battlefield: TacticalBattlefieldBrief,
  initialState?: TacticalCombatState,
  battlefieldError?: string,
) {
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    theme: testInfo.project.name === "desktop-chromium" ? "light" : "dark",
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What shall we cook tonight?", exact: true })).toBeVisible({
    timeout: 40_000,
  });
  await prepareViteFixtureDependencies(page);
  await page.evaluate(
    async (props) => {
      const { TacticalCombatUI } = await import("/src/components/game/TacticalCombatUI.tsx" as string);
      const dependencyUrl = window.__viteFixtureDependencyUrl;
      const { default: React } = await import(dependencyUrl("react"));
      const { default: ReactDOM } = await import(dependencyUrl("react-dom_client"));
      const { QueryClient, QueryClientProvider } = await import(dependencyUrl("@tanstack_react-query"));
      const container = document.createElement("div");
      container.style.cssText = "position:fixed;inset:0;z-index:99999;background:#111827";
      document.body.append(container);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const root = ReactDOM.createRoot(container);
      const fixture = {
        acceptedCount: 0,
        isMutating: () => queryClient.isMutating(),
        unmount: () => {
          root.unmount();
          container.remove();
        },
      };
      window.__hybridTerrainFixture = fixture;
      root.render(
        React.createElement(
          QueryClientProvider,
          {
            client: queryClient,
          },
          React.createElement(TacticalCombatUI, {
            ...props,
            onBattlefieldReady: () => {
              fixture.acceptedCount += 1;
            },
            onCombatEnd: () => {},
          }),
        ),
      );
    },
    {
      chatId,
      party,
      enemies,
      battlefield,
      battlefieldError,
      initialState,
      environment: "ruins",
      formation: "line",
      playerCombatantId: "scout",
    },
  );
}

test("Hybrid battlefield preserves landmarks through a flying move, reload and restart", async ({
  page,
  request,
}, testInfo) => {
  const chatId = await createGame(request);
  const brief: TacticalBattlefieldBrief = {
    exposure: "exposed",
    features: [{ terrain: "wall", placement: "west", shape: "barrier" }],
  };
  try {
    const weatherPatch = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: { gameWeather: { type: "rain", wind: "windy", visibility: "reduced" } },
    });
    expect(weatherPatch.ok(), await weatherPatch.text()).toBeTruthy();
    await pinFirstStartSeed(page);
    await mountBattle(page, testInfo, chatId, brief);
    const battle = page.locator('[data-component="TacticalCombatUI"]');
    await expect(battle.getByRole("button", { name: "End Turn", exact: true })).toBeVisible({
      timeout: BOARD_READY_MS,
    });
    await expect.poll(() => snapshot(request, chatId)).toBeTruthy();
    const start = (await snapshot(request, chatId))!;
    expect(Number.isInteger(start.seed)).toBeTruthy();
    expect(start.weather?.type).toBe("rain");
    await expect(page.getByLabel("Combat conditions", { exact: true })).toContainText("Rain");
    expect([start.grid.width, start.grid.height]).toEqual([14, 10]);
    expect(start.battlefield?.kind).toBe("generated");
    expect(start.battlefield?.kind === "generated" && start.battlefield.brief?.features).toEqual(brief.features);
    const scout = start.units.find((unit) => unit.id === "scout")!;
    const destination = start.grid.tiles
      .flatMap((row, y) => row.map((terrain, x) => ({ terrain, x, y })))
      .find(
        (tile) =>
          tile.terrain === "wall" &&
          // Off the shaped board a tile is drawn as nothing, with no button (ship readiness 2026-10-26:
          // seed 341014229 put the first wall in reach off it).
          !start.grid.outside?.[tile.y]?.[tile.x] &&
          Math.abs(tile.x - scout.x) + Math.abs(tile.y - scout.y) <= scout.movement &&
          !start.units.some((unit) => unit.x === tile.x && unit.y === tile.y),
      )!;
    expect(destination).toBeTruthy();
    await battle.getByRole("button", { name: /^Flying scout(?:,|$)/ }).click();
    // A tile by a mountain stands raised and says so (combat C6b): "Wall, height 1, row …".
    await battle
      .getByRole("button", {
        name: new RegExp(`^Wall, (height \\d, )?row ${destination.y + 1}, column ${destination.x + 1}$`),
      })
      .click();
    await battle.getByRole("button", { name: "Confirm Move", exact: true }).click();
    await expect
      .poll(async () => (await snapshot(request, chatId))?.units.find((unit) => unit.id === "scout")?.hasMoved)
      .toBe(true);
    const moved = (await snapshot(request, chatId))!;
    expect(moved.units.find((unit) => unit.id === "scout")).toMatchObject({ x: destination.x, y: destination.y });
    expect(moved.grid).toEqual(start.grid);
    await page.screenshot({ path: testInfo.outputPath("hybrid-terrain-flight.png") });

    const startRequests: unknown[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/game/combat/tactical/start")) startRequests.push(request.postDataJSON());
    });
    await mountBattle(page, testInfo, chatId, brief, moved);
    await expect(battle.getByRole("button", { name: "End Turn", exact: true })).toBeVisible();
    await battle.getByRole("button", { name: /^Flying scout(?:,|$)/ }).click();
    await expect(battle.getByText("Already moved — choose an action", { exact: false })).toBeVisible();
    expect(startRequests).toEqual([]);
    expect(await snapshot(request, chatId)).toEqual(moved);

    const changedWeather = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: { gameWeather: { type: "snow" } },
    });
    expect(changedWeather.ok(), await changedWeather.text()).toBeTruthy();
    await battle.getByTitle("Restart the battle", { exact: true }).click();
    await battle.getByRole("button", { name: "Restart", exact: true }).last().click();
    await expect
      .poll(async () => (await snapshot(request, chatId))?.units.find((unit) => unit.id === "scout")?.hasMoved)
      .toBe(false);
    const restarted = (await snapshot(request, chatId))!;
    expect(restarted.seed).toBe(start.seed);
    expect(restarted.weather).toEqual(start.weather);
    expect(restarted.grid).toEqual(start.grid);
    expect(restarted.battlefield).toEqual(start.battlefield);
    expect(startRequests).toHaveLength(1);
  } finally {
    await request.delete(`/api/chats/${chatId}`);
  }
});

test("Conflicting terrain requires an explicit generated fallback", async ({ page, request }, testInfo) => {
  const chatId = await createGame(request);
  const requests: Array<{ battlefield?: TacticalBattlefieldBrief }> = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/game/combat/tactical/start")) requests.push(request.postDataJSON());
  });
  try {
    await pinFirstStartSeed(page);
    await mountBattle(page, testInfo, chatId, {
      features: [
        { terrain: "wall", placement: "west", shape: "barrier" },
        { terrain: "water", placement: "west", shape: "barrier" },
      ],
    });
    const fallback = page.getByRole("button", { name: "Use generated terrain", exact: true });
    await expect(fallback).toBeVisible({ timeout: BOARD_READY_MS });
    expect(requests).toHaveLength(1);
    expect(await snapshot(request, chatId)).toBeFalsy();
    await page.screenshot({ path: testInfo.outputPath("hybrid-terrain-fallback.png") });
    await fallback.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "End Turn", exact: true })).toBeVisible();
    await expect.poll(() => snapshot(request, chatId)).toBeTruthy();
    const accepted = (await snapshot(request, chatId))!;
    expect(Number.isInteger(accepted.seed)).toBeTruthy();
    expect(accepted.grid.width).toBe(14);
    expect(accepted.battlefield?.kind).toBe("generated");
    expect(accepted.battlefield?.kind === "generated" ? accepted.battlefield.brief?.features : null).toBeUndefined();
    expect(requests).toHaveLength(2);
    expect(requests[1]?.battlefield?.features).toBeUndefined();
    await page.getByTitle("Restart the battle", { exact: true }).click();
    await page.getByRole("button", { name: "Restart", exact: true }).last().click();
    await expect.poll(() => requests.length).toBe(3);
    await expect(page.getByRole("button", { name: "End Turn", exact: true })).toBeVisible();
    expect(requests[2]?.battlefield?.features).toBeUndefined();
    expect((await snapshot(request, chatId))?.grid).toEqual(accepted.grid);
  } finally {
    await request.delete(`/api/chats/${chatId}`);
  }
});

test("An invalid GM terrain brief waits for explicit fallback without another model request", async ({
  page,
  request,
}, testInfo) => {
  const chatId = await createGame(request);
  const starts: unknown[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/game/combat/tactical/start")) starts.push(request.postDataJSON());
  });
  try {
    await mountBattle(
      page,
      testInfo,
      chatId,
      {},
      undefined,
      "The GM's terrain request was invalid: Unknown battlefield terrain.",
    );
    const fallback = page.getByRole("button", { name: "Use generated terrain", exact: true });
    await expect(fallback).toBeVisible({ timeout: BOARD_READY_MS });
    expect(starts).toEqual([]);
    await fallback.click();
    await expect(page.getByRole("button", { name: "End Turn", exact: true })).toBeVisible();
    expect(starts).toHaveLength(1);
  } finally {
    await request.delete(`/api/chats/${chatId}`);
  }
});

for (const scenario of [
  {
    name: "restored restart",
    async mount(page: Page, request: APIRequestContext, testInfo: TestInfo, chatId: string) {
      const initialState = await createInitialTacticalState(request, chatId);
      await mountBattle(page, testInfo, chatId, {}, initialState);
    },
    shouldDelay: () => true,
    async trigger(page: Page) {
      await page.getByTitle("Restart the battle", { exact: true }).click();
      await page.getByRole("button", { name: "Restart", exact: true }).last().click();
    },
  },
  {
    name: "explicit generated fallback",
    async mount(page: Page, _request: APIRequestContext, testInfo: TestInfo, chatId: string) {
      await mountBattle(page, testInfo, chatId, {
        features: [
          { terrain: "wall", placement: "west", shape: "barrier" },
          { terrain: "water", placement: "west", shape: "barrier" },
        ],
      });
      await expect(page.getByRole("button", { name: "Use generated terrain", exact: true })).toBeVisible({
        timeout: BOARD_READY_MS,
      });
    },
    shouldDelay: (payload: Record<string, unknown>) => !("battlefield" in payload),
    async trigger(page: Page) {
      await page.getByRole("button", { name: "Use generated terrain", exact: true }).click();
    },
  },
] as const) {
  test(`Late tactical launch completion after unmount does not persist ${scenario.name}`, async ({
    page,
    request,
  }, testInfo) => {
    const chatId = await createGame(request);
    const delayedStart = await delayNextTacticalStart(page, scenario.shouldDelay);
    try {
      await scenario.mount(page, request, testInfo, chatId);
      await scenario.trigger(page);
      await expect(delayedStart.requestSeen).resolves.toMatchObject({ chatId });
      await delayedStart.responseReady;
      await unmountBattle(page);
      delayedStart.release();
      await delayedStart.responseComplete;
      await waitForSettledMutations(page);
      await expect.poll(() => page.evaluate(() => window.__hybridTerrainFixture?.acceptedCount ?? 0)).toBe(0);
      await expect.poll(() => snapshot(request, chatId)).toBeFalsy();
    } finally {
      await request.delete(`/api/chats/${chatId}`);
    }
  });
}
