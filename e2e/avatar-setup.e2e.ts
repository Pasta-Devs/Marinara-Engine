import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { AVATAR_EMOTIONS, AVATAR_EXTRA_FEELINGS } from "@marinara-engine/shared";
import { seedUIState } from "./ui-state-fixture.js";

// #7537 (base lane): a character with expression sprites already has a PNGTuber avatar in a Roleplay chat
// with 2D Avatars on, before anything is saved. The 2D Avatars agent page shows one set of controls (the
// base switches above the 2D lane's PNGTuber panel), saves the sprites with `_talk` sprites as open mouths,
// and the faces can be changed by hand. On phones the chat stays mounted under the agent's page, and its
// avatars stop drawing while covered. Making an avatar from a sprite never offers a talk picture as the
// source, and Arrange mode drags full-body sprites and avatars with one shared gesture. The 3D Avatars page
// links the guide to getting a 3D model and copies a prompt with only the owner's name and look. The 2D and
// 3D Avatars pages leave out the agent pipeline's settings, which never run for them; 2D keeps its
// connection, which the Mesh Avatar Layout uses to look at the sprite. On the 2D page, "Make faces from the
// avatar" opens sprite generation with the owner's avatar as the checked reference and the background
// removal on, also for an owner without sprites, and the faces it saves become the owner's sprites. It starts
// with the six main faces on one 2x3 sheet and can make all 29, a sheet at a time (one face at a time on older
// GPT Image models), with one review of every sheet's prompt.
const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

const FIRST_LOAD_TIMEOUT_MS = 30_000;

const PACKAGE = {
  id: "2d-avatars",
  version: "1.0.0",
  status: "active",
  readiness: "ready",
  readinessError: null,
  error: null,
  legacy: false,
  installedAt: "2026-10-13T00:00:00.000Z",
  manifest: {
    schemaVersion: 2,
    id: "2d-avatars",
    name: "2D Avatars",
    version: "1.0.0",
    description: "Animated 2D avatars.",
    engine: { min: "2.5.0", maxExclusive: "4.0.0" },
    capabilityApi: { major: 1, minor: 73 },
    kind: ["agent"],
    entrypoints: { agents: "agents.json" },
    files: [{ path: "agents.json", sha256: "0".repeat(64), bytes: 1 }],
    permissions: ["ui"],
    restartRequired: false,
  },
};
const AGENT = {
  id: "2d-avatars",
  packageId: "2d-avatars",
  name: "2D Avatars",
  description: "Animated 2D avatars for characters and personas.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "misc",
  execution: "host",
  defaultPromptTemplate: "",
};

async function preparePage(page: Page, characterId: string, ui: Record<string, unknown>, chatId?: string) {
  // Each page keeps its own UI state: settings the agent page syncs to the server must not reach the chat page.
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [PACKAGE] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [AGENT] }));
  // The real list, without avatars other workers save on the same server (the setup page would open on one).
  await page.route("**/api/avatar-models", async (route) => {
    const response = await route.fetch();
    const owners = (await response.json()) as Array<{ owner: { ownerId: string } }>;
    await route.fulfill({ response, json: owners.filter((summary) => summary.owner.ownerId === characterId) });
  });
  await page.route(`**/api/sprites/${characterId}`, (route) =>
    route.fulfill({
      json: ["neutral", "neutral_talk", "happy", "happy_talk", "crying", "full_idle"].map((expression) => ({
        expression,
        filename: `${expression}.png`,
        url: "/sprites/avatar-demo/base.png",
      })),
    }),
  );
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["roleplay"],
    trackerPanelEnabled: false,
    trackerPanelOpen: false,
    ...ui,
  });
  await page.addInitScript(
    ({ appVersion, activeChatId }) => {
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
      if (activeChatId) localStorage.setItem("marinara-active-chat-id", activeChatId);
    },
    { appVersion: APP_VERSION, activeChatId: chatId ?? null },
  );
}

/** Requests for an avatar that the browser logged as failed. Picking an owner without an avatar must log none. */
function collectFailedAvatarLoads(page: Page) {
  const failed: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.location().url.includes("/api/avatar-models/")) {
      failed.push(`${message.text()} ${message.location().url}`);
    }
  });
  return failed;
}

test("2D Avatars shows a character's sprites as its avatar and saves them as a PNGTuber", async ({
  page,
  request,
}, info) => {
  const characterResponse = await request.post("/api/characters", { data: { data: { name: "Avatar fixture" } } });
  expect(characterResponse.ok(), await characterResponse.text()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Avatar chat", mode: "roleplay", characterIds: [character.id] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  expect(
    (
      await request.patch(`/api/chats/${chat.id}/metadata`, {
        data: { enableAgents: true, activeAgentIds: ["2d-avatars"] },
      })
    ).ok(),
  ).toBeTruthy();

  try {
    // ── With nothing saved, the chat already shows the character's sprites as its avatar ──
    const chatPage = await page.context().newPage();
    await preparePage(chatPage, character.id, {}, chat.id);
    await chatPage.goto("/");
    const avatar = chatPage.locator(`[data-avatar-stage] [data-avatar-owner="${character.id}"]`);
    await expect(avatar).toHaveAttribute("data-avatar-kind", "pngtuber", { timeout: FIRST_LOAD_TIMEOUT_MS });
    await expect(avatar.getByRole("img", { name: "Avatar fixture's avatar" })).toBeVisible();
    await expect(chatPage.locator("[data-avatar-stage]")).not.toHaveAttribute("data-avatar-paused", "true");
    const nothingSaved = await request.get(`/api/avatar-models/character/${character.id}`);
    expect(nothingSaved.status()).toBe(200);
    expect(await nothingSaved.json()).toBeNull();
    await chatPage.close();

    // ── The setup on the agent's page (on phones it covers the chat, which stays mounted under it) ──
    await preparePage(page, character.id, { agentDetailId: "2d-avatars" }, chat.id);
    const failedAvatarLoads = collectFailedAvatarLoads(page);
    await page.goto("/");
    const setup = page.locator('[data-avatar-setup="2d-avatars"]');
    // The first load also compiles the lazy setup chunk on the dev server.
    await expect(setup).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT_MS });
    await expect(setup.getByText("Choose a character or persona to set up its avatar.")).toBeVisible();
    await setup.getByLabel("Character or persona").selectOption(`character:${character.id}`);
    // Wait for the lazy PNGTuber panel, then check the page has one set of controls.
    await expect(setup.locator("[data-avatar-pngtuber-status]")).toHaveText(
      "Shows your expression sprites until you change something here.",
      { timeout: FIRST_LOAD_TIMEOUT_MS },
    );
    await expect(setup.getByRole("button", { name: "Use my sprites", exact: true })).toHaveCount(1);
    await expect(setup.getByRole("button", { name: "Import PNGTuber Plus save", exact: true })).toHaveCount(1);
    await expect(setup.getByRole("button", { name: "Remove", exact: true })).toHaveCount(0);
    await expect(setup.getByText("Shown in chats")).toBeVisible();
    await expect(setup.getByText("An example avatar. Set one up to see yours.")).toHaveCount(0);
    await expect(setup.getByRole("img", { name: "Preview" })).toBeVisible();
    await expect(setup.getByRole("checkbox", { name: /Show this avatar in chats/u })).toBeChecked();
    expect(failedAvatarLoads, "an owner without an avatar loads without an error").toEqual([]);
    // Making an avatar from a sprite offers faces only, never their talk pictures: blink and talk pictures are
    // made for the talking head's faces, and a face's own talk sprite shows as its open mouth.
    await expect
      .poll(() =>
        setup
          .getByRole("group", { name: /: Face$/u })
          .evaluateAll((groups) => groups.map((group) => group.getAttribute("aria-label"))),
      )
      .toEqual(["neutral: Face", "happy: Face", "crying: Face"]);
    await expect(
      setup
        .getByRole("group", { name: "neutral: Mouth open", exact: true })
        .getByRole("img", { name: "neutral: Mouth open", exact: true }),
    ).toBeVisible();
    await expect(setup.getByRole("group", { name: "Sprite to use", exact: true }).getByRole("button")).toHaveText([
      "neutral",
      "happy",
      "crying",
      "full idle",
    ]);
    await page.screenshot({ path: info.outputPath("avatar-setup-sprites.png"), animations: "disabled" });
    if (info.project.name.startsWith("mobile")) {
      // Only the preview draws: the covered chat's avatars stop.
      await expect(page.locator(`[data-avatar-stage]:has([data-avatar-owner="${character.id}"])`)).toHaveAttribute(
        "data-avatar-paused",
        "true",
        { timeout: FIRST_LOAD_TIMEOUT_MS },
      );
    }

    await setup.getByRole("button", { name: "Use my sprites", exact: true }).click();
    await expect(setup.locator("[data-avatar-pngtuber-status]")).not.toHaveText(
      "Shows your expression sprites until you change something here.",
    );
    await expect(setup.getByRole("button", { name: "Remove", exact: true })).toHaveCount(1);
    await expect(setup.locator('[data-avatar-feeling="sad"]')).toHaveValue("crying");
    await expect(setup.locator('[data-avatar-feeling="angry"]')).toHaveValue("");
    await setup.locator('[data-avatar-feeling="angry"]').selectOption("happy");
    await expect
      .poll(async () => {
        const saved = (await (await request.get(`/api/avatar-models/character/${character.id}`)).json()) as {
          kinds: { pngtuber: { expressionMap: Record<string, unknown> } };
        };
        return saved.kinds.pngtuber.expressionMap.angry;
      })
      .toEqual({ target: "happy", source: "user", confidence: 1 });
    await page.screenshot({ path: info.outputPath("avatar-setup.png"), animations: "disabled", fullPage: true });

    const saved = (await (await request.get(`/api/avatar-models/character/${character.id}`)).json()) as {
      activeKind: string;
      kinds: { pngtuber: { layers: Record<string, { mouthOpen?: unknown }> } };
    };
    expect(saved.activeKind).toBe("pngtuber");
    expect(Object.keys(saved.kinds.pngtuber.layers).sort()).toEqual(["crying", "happy", "neutral"]);
    expect(saved.kinds.pngtuber.layers.happy?.mouthOpen).toEqual({ source: "sprite", label: "happy_talk" });

    // ── The chat shows the saved avatar ──
    // The agent page leaves first: it shares local storage with the chat page and keeps saving its UI state
    // (the open agent page) there, which could open the agent page in the chat page as it starts.
    await page.goto("about:blank");
    const savedChatPage = await page.context().newPage();
    await preparePage(savedChatPage, character.id, {}, chat.id);
    await savedChatPage.goto("/");
    const savedAvatar = savedChatPage.locator(`[data-avatar-stage] [data-avatar-owner="${character.id}"]`);
    await expect(savedAvatar).toHaveAttribute("data-avatar-kind", "pngtuber", { timeout: FIRST_LOAD_TIMEOUT_MS });
    await expect(savedAvatar.getByRole("img", { name: "Avatar fixture's avatar" })).toBeVisible();
    await savedChatPage.bringToFront();
    await expect(savedChatPage.locator("[data-avatar-stage]")).not.toHaveAttribute("data-avatar-paused", "true");
    await savedChatPage.close();

    // ── Removing the character removes its avatar ──
    expect((await request.delete(`/api/characters/${character.id}`)).status()).toBe(204);
    expect((await request.get(`/api/avatar-models/character/${character.id}`)).status()).toBe(404);
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`).catch(() => undefined);
    await request.delete(`/api/characters/${character.id}`).catch(() => undefined);
  }
});

test("Arrange mode drags full-body sprites and avatars with the same gesture", async ({ page, request }) => {
  const characterResponse = await request.post("/api/characters", { data: { data: { name: "Arrange fixture" } } });
  expect(characterResponse.ok(), await characterResponse.text()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Arrange chat", mode: "roleplay", characterIds: [character.id] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  expect(
    (
      await request.patch(`/api/chats/${chat.id}/metadata`, {
        data: {
          enableAgents: true,
          activeAgentIds: ["expression", "2d-avatars"],
          spriteCharacterIds: [character.id],
          spriteDisplayModes: ["full-body"],
          fullBodySpriteScale: 0.5,
          spritePlacements: { [character.id]: { x: 25, y: 85 }, [`${character.id}:avatar`]: { x: 75, y: 85 } },
        },
      })
    ).ok(),
  ).toBeTruthy();

  try {
    await preparePage(page, character.id, { chatSettingsExpandedSections: { "roleplay-agents": true } }, chat.id);
    await page.goto("/");
    // Each item's positioned box is a direct child of its stage.
    const sprite = page.getByRole("img", { name: "full-body neutral sprite" }).locator("xpath=../..");
    const avatar = page.locator(`[data-avatar-stage] [data-avatar-owner="${character.id}"]`);
    const place = (item: Locator) =>
      item.evaluate((element: HTMLElement) => [parseFloat(element.style.left), parseFloat(element.style.top)]);
    await expect(sprite).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT_MS });
    await expect(avatar.getByRole("img", { name: "Arrange fixture's avatar" })).toBeVisible({
      timeout: FIRST_LOAD_TIMEOUT_MS,
    });
    expect(await place(sprite)).toEqual([25, 85]);
    expect(await place(avatar)).toEqual([75, 85]);

    // Arrange mode, from the Expression Engine's sprite settings.
    await page.evaluate(async () => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setShouldOpenSettings(true);
    });
    const drawer = page.locator(".mari-chat-settings-drawer");
    const agents = drawer.locator('[data-chat-settings-section="roleplay-agents"]');
    const agentsHeader = agents.getByRole("button", { name: "Agents", exact: true });
    await expect(agentsHeader).toBeVisible();
    if ((await agentsHeader.getAttribute("aria-expanded")) !== "true") await agentsHeader.click();
    const arrange = agents.getByRole("button", { name: "Arrange", exact: true });
    await arrange.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await arrange.click();
    await drawer.getByRole("button", { name: "Close Chat Settings" }).click();
    await expect(drawer).toHaveCount(0);

    // The item follows the pointer by the share of the stage it moved, and stays where it is dropped.
    const drag = async (item: Locator, dxPercent: number, dyPercent: number) => {
      const [width, height] = await item.evaluate((element) => [
        element.parentElement!.clientWidth,
        element.parentElement!.clientHeight,
      ]);
      const box = (await item.getByRole("img").boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + (width! * dxPercent) / 200, y + (height! * dyPercent) / 200, { steps: 3 });
      await expect(item.getByText("Release to Save", { exact: true })).toBeVisible();
      await page.mouse.move(x + (width! * dxPercent) / 100, y + (height! * dyPercent) / 100, { steps: 3 });
      await page.mouse.up();
      await expect(item.getByText("Drag to Move", { exact: true })).toBeVisible();
    };
    const near = async (item: Locator, expected: [number, number]) => {
      const [left, top] = await place(item);
      expect(Math.abs(left! - expected[0]), `left ${left}`).toBeLessThan(0.5);
      expect(Math.abs(top! - expected[1]), `top ${top}`).toBeLessThan(0.5);
    };
    await drag(sprite, 10, -10);
    await near(sprite, [35, 75]);
    await drag(avatar, -10, -10);
    await near(avatar, [65, 75]);
    await near(sprite, [35, 75]);

    // The sprite's check button saves its place and ends Arrange mode for both.
    await sprite.getByRole("button", { name: "Finish placing sprite", exact: true }).click();
    await expect(page.getByText("Drag to Move", { exact: true })).toHaveCount(0);
    await expect(sprite).toHaveClass(/pointer-events-none/u);
    await expect(avatar).toHaveClass(/pointer-events-none/u);

    // Both places are kept.
    await page.reload();
    await expect(sprite).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT_MS });
    await expect(avatar).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT_MS });
    await near(sprite, [35, 75]);
    await near(avatar, [65, 75]);
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`).catch(() => undefined);
    await request.delete(`/api/characters/${character.id}`).catch(() => undefined);
  }
});

test("3D Avatars links the 3D model guide and copies a prompt with the owner's name and look only", async ({
  page,
  request,
}, info) => {
  const LOOK = "long silver hair in a braid, red eyes, black hoodie with gold zips, slim build, round glasses.";
  const PERSONA_LOOK = "Short black bob, green eyes, yellow raincoat over a grey dress.";
  const OVERRIDE_LOOK = "1girl, twin tails, pastel pink hair, blue eyes, sailor uniform";
  const OVERRIDDEN = "Plain appearance that the Image Appearance Override replaces.";
  // Card fields other than the look, and chat text, must never reach a prompt meant for an outside tool.
  const PRIVATE = ["DESCRIPTION-SECRET", "PERSONALITY-SECRET", "SCENARIO-SECRET", "GREETING-SECRET", "CHAT-SECRET"];
  const characterResponse = await request.post("/api/characters", {
    data: {
      data: {
        name: "Model guide fixture",
        description: "DESCRIPTION-SECRET",
        personality: "PERSONALITY-SECRET",
        scenario: "SCENARIO-SECRET",
        first_mes: "GREETING-SECRET",
        // Another macro means nothing to an outside tool, so only the owner's own name is filled in.
        extensions: { appearance: `{{char}} has ${LOOK} She keeps the scarf {{user}} gave her.` },
      },
    },
  });
  expect(characterResponse.ok(), await characterResponse.text()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  const personaResponse = await request.post("/api/characters/personas", {
    data: {
      name: "Guide persona",
      // A blank appearance counts as none.
      appearance: "   ",
      description: `${PERSONA_LOOK} Often seen with {{char}}.`,
      personality: "PERSONALITY-SECRET",
    },
  });
  expect(personaResponse.ok(), await personaResponse.text()).toBeTruthy();
  const persona = (await personaResponse.json()) as { id: string };
  const overridePersonaResponse = await request.post("/api/characters/personas", {
    data: {
      name: "Override persona",
      appearance: OVERRIDDEN,
      imageAppearanceEnabled: true,
      imageAppearance: OVERRIDE_LOOK,
    },
  });
  expect(overridePersonaResponse.ok(), await overridePersonaResponse.text()).toBeTruthy();
  const overridePersona = (await overridePersonaResponse.json()) as { id: string };
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Model guide chat", mode: "roleplay", characterIds: [character.id] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  expect(
    (
      await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", characterId: character.id, content: "CHAT-SECRET" },
      })
    ).ok(),
  ).toBeTruthy();

  try {
    await preparePage(page, character.id, { agentDetailId: "3d-avatars" });
    const PACKAGE_3D = { ...PACKAGE, id: "3d-avatars", manifest: { ...PACKAGE.manifest, id: "3d-avatars" } };
    const AGENT_3D = { ...AGENT, id: "3d-avatars", packageId: "3d-avatars", name: "3D Avatars" };
    await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [PACKAGE_3D] }));
    await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [AGENT_3D] }));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as { __copiedPrompt?: string }).__copiedPrompt = text;
          },
        },
      });
    });
    const copied = () => page.evaluate(() => (window as { __copiedPrompt?: string }).__copiedPrompt ?? "");
    const failedAvatarLoads = collectFailedAvatarLoads(page);
    await page.goto("/");
    const setup = page.locator('[data-avatar-setup="3d-avatars"]');
    await expect(setup).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT_MS });
    await setup.getByLabel("Character or persona").selectOption(`character:${character.id}`);
    await expect(setup.getByRole("button", { name: "Import VRM", exact: true })).toBeVisible({
      timeout: FIRST_LOAD_TIMEOUT_MS,
    });

    // ── The section sits next to the VRM import ──
    const guide = setup.locator("section").filter({ has: page.getByRole("heading", { name: "Get a 3D model" }) });
    await expect(guide).toBeVisible();
    await expect(guide.getByRole("button", { name: "Read the guide", exact: true })).toBeVisible();
    await guide.screenshot({ path: info.outputPath("avatar-3d-model-guide.png"), animations: "disabled" });

    // ── Copy prompt: the character's name and look, posed for 3D ──
    await guide.getByRole("button", { name: "Copy prompt", exact: true }).click();
    await expect.poll(copied).toContain("Model guide fixture has long silver hair in a braid");
    const prompt = await copied();
    expect(prompt).toContain(LOOK);
    expect(prompt).toMatch(/full-body/iu);
    expect(prompt).toMatch(/T-pose/u);
    expect(prompt).toMatch(/front view/iu);
    expect(prompt).not.toContain("{{");
    for (const secret of PRIVATE) expect(prompt, secret).not.toContain(secret);
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Prompt copied." })).toBeVisible();

    // ── A persona with a blank appearance uses its description ──
    await setup.getByLabel("Character or persona").selectOption(`persona:${persona.id}`);
    await guide.getByRole("button", { name: "Copy prompt", exact: true }).click();
    await expect.poll(copied).toContain("Guide persona");
    const personaPrompt = await copied();
    expect(personaPrompt).toContain(PERSONA_LOOK);
    expect(personaPrompt).not.toContain("{{");
    for (const secret of PRIVATE) expect(personaPrompt, secret).not.toContain(secret);

    // ── An Image Appearance Override that is on replaces the appearance ──
    await setup.getByLabel("Character or persona").selectOption(`persona:${overridePersona.id}`);
    await guide.getByRole("button", { name: "Copy prompt", exact: true }).click();
    await expect.poll(copied).toContain("Override persona");
    const overridePrompt = await copied();
    expect(overridePrompt).toContain(OVERRIDE_LOOK);
    expect(overridePrompt).not.toContain(OVERRIDDEN);
    expect(failedAvatarLoads, "owners without an avatar load without an error").toEqual([]);

    // ── Read the guide opens the docs at the section ──
    const docRequest = page.waitForRequest((req) => {
      const url = new URL(req.url());
      return url.pathname.endsWith("/api/docs/content") && url.searchParams.get("path") === "agents/avatars.md";
    });
    await guide.getByRole("button", { name: "Read the guide", exact: true }).click();
    await docRequest;
    const reader = page.locator(".docs-reader-content");
    const heading = reader.getByRole("heading", { name: "Get a 3D model" });
    await expect(heading).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT_MS });
    await expect(reader.locator("mark.docs-search-mark").first()).toHaveText("Get a 3D model");
    await expect(heading).toBeInViewport();
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`).catch(() => undefined);
    await request.delete(`/api/characters/${character.id}`).catch(() => undefined);
    await request.delete(`/api/characters/personas/${persona.id}`).catch(() => undefined);
    await request.delete(`/api/characters/personas/${overridePersona.id}`).catch(() => undefined);
  }
});

test("2D Avatars makes faces from the avatar with sprite generation, also for an owner without sprites", async ({
  page,
  request,
}, info) => {
  const picture = readFileSync(new URL("../packages/client/public/sprites/avatar-demo/base.png", import.meta.url));
  const avatar = { avatar: `data:image/png;base64,${picture.toString("base64")}`, filename: "faces.png" };
  const OVERRIDE_LOOK = "1girl, short red hair, green eyes, black coat";
  const characterResponse = await request.post("/api/characters", {
    data: {
      data: {
        name: "Faces fixture",
        description: "A description the image appearance replaces.",
        extensions: {
          appearance: "An appearance the image appearance replaces.",
          imageAppearanceEnabled: true,
          imageAppearance: OVERRIDE_LOOK,
        },
      },
    },
  });
  expect(characterResponse.ok(), await characterResponse.text()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  const personaResponse = await request.post("/api/characters/personas", {
    data: { name: "Faces persona", appearance: "Tall, silver hair, grey coat." },
  });
  expect(personaResponse.ok(), await personaResponse.text()).toBeTruthy();
  const persona = (await personaResponse.json()) as { id: string };
  const noAvatarResponse = await request.post("/api/characters/personas", {
    data: { name: "Faceless persona", appearance: "Short, brown hair." },
  });
  expect(noAvatarResponse.ok(), await noAvatarResponse.text()).toBeTruthy();
  const noAvatar = (await noAvatarResponse.json()) as { id: string };
  const imageConnection = async (model: string) => {
    const response = await request.post("/api/connections", {
      data: {
        name: `Faces image ${model} ${info.project.name}`,
        provider: "image_generation",
        imageGenerationSource: "openai",
        imageService: "openai",
        model,
        baseUrl: "http://127.0.0.1:9/v1",
        apiKey: "fixture",
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    return (await response.json()) as { id: string };
  };
  // A model that draws a whole sheet, and an older one that draws each face as its own image.
  const connection = await imageConnection("gpt-image-2");
  const olderConnection = await imageConnection("gpt-image-1");

  try {
    const avatarPath = async (path: string) => {
      const uploaded = await request.post(`/api/characters/${path}/avatar`, { data: avatar });
      expect(uploaded.ok(), await uploaded.text()).toBeTruthy();
      const owner = await request.get(`/api/characters/${path}`);
      return ((await owner.json()) as { avatarPath: string }).avatarPath;
    };
    const characterAvatar = await avatarPath(character.id);
    const personaAvatar = await avatarPath(`personas/${persona.id}`);
    // The persona has the demo sprites; the character has none.
    await preparePage(page, persona.id, { agentDetailId: "2d-avatars", reviewImagePromptsBeforeSend: false });
    const sheets: Array<Record<string, unknown>> = [];
    await page.route("**/api/sprites/generate-sheet", async (route) => {
      const body = route.request().postDataJSON() as { expressions: string[] } & Record<string, unknown>;
      sheets.push(body);
      // The drawn, cleaned faces as the sprite pipeline returns them.
      await route.fulfill({
        json: {
          sheetBase64: "",
          cells: body.expressions.map((expression) => ({ expression, base64: picture.toString("base64") })),
        },
      });
    });
    await page.goto("/");
    const setup = page.locator('[data-avatar-setup="2d-avatars"]');
    await expect(setup).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT_MS });
    const dialog = page.getByRole("dialog", { name: "Generate Sprites" });
    const reference = dialog.getByRole("checkbox", { name: "Use current avatar as a reference image" });
    const makeFaces = setup.getByRole("button", { name: "Make faces from the avatar", exact: true });
    const useConnection = (id: string) => dialog.locator("select").first().selectOption(id);
    const face = (name: string) => dialog.getByRole("button", { name, exact: true });

    // ── A character without sprites ──
    await setup.getByLabel("Character or persona").selectOption(`character:${character.id}`);
    await expect(setup.getByText("Make faces from the avatar first, then add blinking and talking.")).toBeVisible({
      timeout: FIRST_LOAD_TIMEOUT_MS,
    });
    await expect(
      setup.getByText(
        "Draws new faces from the avatar, removes their background, and saves them as this character's or persona's sprites.",
      ),
    ).toBeVisible();
    await expect(makeFaces).toBeEnabled();
    await setup.screenshot({ path: info.outputPath("avatar-faces-action.png"), animations: "disabled" });
    await makeFaces.click();
    await expect(dialog).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT_MS });
    await expect(reference).toBeChecked();
    await expect(dialog.getByRole("img", { name: "Current avatar reference" }).first()).toHaveAttribute(
      "src",
      characterAvatar,
    );
    await expect(dialog.getByRole("checkbox", { name: "Transparent sprite background" })).toBeChecked();
    await expect(dialog.locator("textarea").first()).toHaveValue(OVERRIDE_LOOK);
    // The faces offered are the avatar's six main faces, all chosen, and the 23 extra feelings, which every grid
    // can fill. Talking-head faces are still portraits: no full-body or animated ones.
    await useConnection(connection.id);
    await expect(dialog.getByRole("button", { name: "6 (2×3)", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByRole("button", { name: "16 (4×4)", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "smirk", exact: true })).toHaveCount(0);
    for (const emotion of AVATAR_EMOTIONS) await expect(face(emotion)).toHaveAttribute("aria-pressed", "true");
    for (const feeling of AVATAR_EXTRA_FEELINGS) await expect(face(feeling)).toHaveAttribute("aria-pressed", "false");
    await expect(dialog.getByText("6 faces in 1 picture.", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Full-body", exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("checkbox", { name: /Generate animated portraits/u })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("avatar-faces-generator.png"), animations: "disabled" });
    await dialog.getByRole("button", { name: "Generate Sheet", exact: true }).click();
    await expect.poll(() => sheets.length).toBe(1);
    expect(sheets[0]).toMatchObject({
      connectionId: connection.id,
      appearance: OVERRIDE_LOOK,
      referenceImages: [characterAvatar],
      spriteType: "expressions",
      noBackground: true,
      expressions: ["neutral", "happy", "angry", "sad", "relaxed", "surprised"],
      cols: 2,
      rows: 3,
      talkingHeadFaces: true,
    });
    await dialog.getByRole("button", { name: /^Save \d+ Sprites?$/u }).click();
    await expect(dialog).toBeHidden();
    // The saved faces are the character's sprites, and the panel offers them at once.
    await expect(setup.getByText("Make faces from the avatar first, then add blinking and talking.")).toHaveCount(0);
    await expect(setup.getByRole("group", { name: "neutral: Face", exact: true })).toBeVisible();
    const saved = (await (await request.get(`/api/sprites/${character.id}`)).json()) as Array<{ expression: string }>;
    expect(saved.map((sprite) => sprite.expression)).toContain("neutral");

    // ── A saved talking head shows the faces made again, over a face the user chose ──
    const savedSetup = async () =>
      (
        (await (await request.get(`/api/avatar-models/character/${character.id}`)).json()) as {
          kinds?: { pngtuber?: { expressionMap: Record<string, unknown>; layers: Record<string, unknown> } };
        }
      ).kinds?.pngtuber;
    const userPick = (target: string) => ({ target, source: "user", confidence: 1 });
    await setup.getByRole("button", { name: "Use my sprites", exact: true }).click();
    await setup.locator('[data-avatar-feeling="happy"]').selectOption("angry");
    await expect.poll(async () => (await savedSetup())?.expressionMap.happy).toEqual(userPick("angry"));
    await makeFaces.click();
    await useConnection(connection.id);
    sheets.length = 0;
    await dialog.getByRole("button", { name: "Generate Sheet", exact: true }).click();
    await expect.poll(() => sheets.length).toBe(1);
    await dialog.getByRole("button", { name: /^Save \d+ Sprites?$/u }).click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(async () => (await savedSetup())?.expressionMap)
      .toMatchObject(Object.fromEntries(AVATAR_EMOTIONS.map((emotion) => [emotion, userPick(emotion)])));
    expect(Object.keys((await savedSetup())?.layers ?? {}).sort()).toEqual([...AVATAR_EMOTIONS].sort());
    await expect(setup.locator('[data-avatar-feeling="happy"]')).toHaveValue("happy");

    // ── All 29 faces, a 2x3 sheet at a time, main faces first ──
    const allFaces = [...AVATAR_EMOTIONS, ...AVATAR_EXTRA_FEELINGS];
    await makeFaces.click();
    await useConnection(connection.id);
    await face("All faces").click();
    await expect(dialog.getByText("29 faces in 5 pictures.", { exact: true })).toBeVisible();
    // A grid only sets how many faces go in each picture; the faces chosen stay chosen.
    await dialog.getByRole("button", { name: "9 (3×3)", exact: true }).click();
    await expect(dialog.getByText("29 faces in 4 pictures.", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "6 (2×3)", exact: true }).click();
    await expect(face("realization")).toHaveAttribute("aria-pressed", "true");
    sheets.length = 0;
    await dialog.getByRole("button", { name: "Generate Sprites", exact: true }).click();
    await expect(dialog.getByRole("combobox", { name: /^Assign expression for sprite \d+$/u })).toHaveCount(29);
    expect(sheets.map((sheet) => sheet.expressions)).toEqual(
      [0, 6, 12, 18, 24].map((at) => allFaces.slice(at, at + 6)),
    );
    for (const sheet of sheets) expect(sheet).toMatchObject({ cols: 2, rows: 3, talkingHeadFaces: true });
    await page.screenshot({ path: info.outputPath("avatar-faces-all.png"), animations: "disabled" });
    await dialog.getByRole("button", { name: "Save 29 Sprites", exact: true }).click();
    await expect(dialog).toBeHidden();
    const savedAll = (await (await request.get(`/api/sprites/${character.id}`)).json()) as Array<{
      expression: string;
    }>;
    expect(savedAll.map((sprite) => sprite.expression)).toEqual(expect.arrayContaining(allFaces));
    // The last picture is only partly filled; its prompt still asks for the whole grid it is cut from.
    const lastSheetPreview = await request.post("/api/sprites/generate-sheet/preview", {
      data: {
        connectionId: connection.id,
        appearance: OVERRIDE_LOOK,
        expressions: allFaces.slice(24),
        cols: 2,
        rows: 3,
        spriteType: "expressions",
        talkingHeadFaces: true,
        styleProfileId: "realistic",
      },
    });
    expect(lastSheetPreview.ok(), await lastSheetPreview.text()).toBeTruthy();
    const lastSheetPrompt = ((await lastSheetPreview.json()) as { items: Array<{ prompt: string }> }).items[0]?.prompt;
    expect(lastSheetPrompt).toContain("EXACTLY 6 total portrait cells");
    expect(lastSheetPrompt).toContain("6 equally sized square cells");
    expect(lastSheetPrompt).not.toMatch(/EXACTLY 5 |5 equally sized/u);

    // ── An older GPT Image model gets one face per request, past its eight-face limit ──
    await makeFaces.click();
    await useConnection(olderConnection.id);
    await expect(dialog.getByRole("button", { name: "6 (2×3)", exact: true })).toHaveCount(0);
    await face("All faces").click();
    await face("Main faces").click();
    await expect(dialog.getByText("6 faces in 6 pictures.", { exact: true })).toBeVisible();
    sheets.length = 0;
    await dialog.getByRole("button", { name: "Generate Sprites", exact: true }).click();
    await expect(dialog.getByRole("combobox", { name: /^Assign expression for sprite \d+$/u })).toHaveCount(6);
    expect(sheets.map((sheet) => sheet.expressions)).toEqual(AVATAR_EMOTIONS.map((emotion) => [emotion]));
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // ── A persona with sprites ──
    await setup.getByLabel("Character or persona").selectOption(`persona:${persona.id}`);
    await expect(setup.getByRole("group", { name: "neutral: Face", exact: true })).toBeVisible({
      timeout: FIRST_LOAD_TIMEOUT_MS,
    });
    await makeFaces.click();
    await expect(reference).toBeChecked();
    await expect(dialog.getByRole("img", { name: "Current avatar reference" }).first()).toHaveAttribute(
      "src",
      personaAvatar,
    );
    await expect(dialog.locator("textarea").first()).toHaveValue("Tall, silver hair, grey coat.");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // ── Without an avatar there is nothing to draw the faces from ──
    await setup.getByLabel("Character or persona").selectOption(`persona:${noAvatar.id}`);
    await expect(setup.getByText("Add an avatar to this character or persona first.")).toBeVisible({
      timeout: FIRST_LOAD_TIMEOUT_MS,
    });
    await expect(makeFaces).toBeDisabled();

    // ── With prompt review on, every picture's prompt is reviewed once, before the first is sent ──
    await seedUIState(page, { reviewImagePromptsBeforeSend: true }, "merge");
    await page.reload();
    await setup.getByLabel("Character or persona").selectOption(`character:${character.id}`);
    await makeFaces.click();
    await useConnection(connection.id);
    await dialog.getByRole("button", { name: "1 (1×1)", exact: true }).click();
    await expect(dialog.getByText("6 faces in 6 pictures.", { exact: true })).toBeVisible();
    sheets.length = 0;
    await dialog.getByRole("button", { name: "Generate Sprites", exact: true }).click();
    const review = page.getByRole("dialog", { name: "Review Image Prompts", exact: true });
    await expect(review).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT_MS });
    const prompts = review.locator("textarea");
    await expect(prompts).toHaveCount(12);
    // Each picture's prompt describes its own face, with open eyes and closed lips.
    await expect(prompts.first()).toHaveValue(/Draw each face like this: neutral: calm resting face/u);
    await expect(prompts.first()).not.toHaveValue(/happy: /u);
    // Each picture's card names the faces it makes.
    await expect(review.getByText("Picture 1: neutral", { exact: true })).toBeVisible();
    await expect(review.getByText("Picture 6: surprised", { exact: true })).toBeVisible();
    expect(sheets).toHaveLength(0);
    await review.getByRole("button", { name: "Generate", exact: true }).click();
    await expect(dialog.getByRole("combobox", { name: /^Assign expression for sprite \d+$/u })).toHaveCount(6);
    await expect(review).toBeHidden();
    expect(sheets.map((sheet) => sheet.expressions)).toEqual(AVATAR_EMOTIONS.map((emotion) => [emotion]));
    for (const sheet of sheets) {
      expect(sheet).toMatchObject({ cols: 1, rows: 1, talkingHeadFaces: true });
      expect(sheet.promptOverrides).toHaveLength(6);
    }
  } finally {
    await request.delete(`/api/characters/${character.id}`).catch(() => undefined);
    await request.delete(`/api/characters/personas/${persona.id}`).catch(() => undefined);
    await request.delete(`/api/characters/personas/${noAvatar.id}`).catch(() => undefined);
    await request.delete(`/api/connections/${connection.id}`).catch(() => undefined);
    await request.delete(`/api/connections/${olderConnection.id}`).catch(() => undefined);
  }
});

test("The avatar agents' pages leave out the agent pipeline's settings, which other agents' pages keep", async ({
  page,
  request,
}) => {
  const agentResponse = await request.post("/api/agents", {
    data: {
      type: "custom-avatar-context-fixture",
      name: "Context fixture",
      phase: "pre_generation",
      promptTemplate: "Summarize the scene.",
      settings: { resultType: "context_injection" },
    },
  });
  expect(agentResponse.ok(), await agentResponse.text()).toBeTruthy();
  const agent = (await agentResponse.json()) as { id: string };

  try {
    await preparePage(page, "no-owner", { agentDetailId: "2d-avatars" });
    // Both avatar packages are installed here.
    const PACKAGE_3D = { ...PACKAGE, id: "3d-avatars", manifest: { ...PACKAGE.manifest, id: "3d-avatars" } };
    const AGENT_3D = { ...AGENT, id: "3d-avatars", packageId: "3d-avatars", name: "3D Avatars" };
    await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [PACKAGE, PACKAGE_3D] }));
    await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [AGENT, AGENT_3D] }));
    await page.goto("/");
    const editor = page.locator(".mari-editor-shell");
    const section = (name: string) => editor.locator(`h3:text-is("${name}")`);
    const control = (name: string) => editor.getByText(name, { exact: true });
    // The pipeline never runs the avatar agents, so none of these do anything for them.
    const PIPELINE_SECTIONS = [
      "Pipeline Phase",
      "Context Sources",
      "Agent Budget",
      "Add as Prompt Section",
      "Prompt Template",
      "Tools / Function Calling",
    ];
    const PIPELINE_CONTROLS = ["Share requests with other agents", "Named prompt options"];
    const open = (id: string) =>
      page.evaluate(async (id) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openAgentDetail(id);
      }, id);

    for (const id of ["2d-avatars", "3d-avatars"]) {
      await open(id);
      await expect(page.locator(`[data-avatar-setup="${id}"]`)).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT_MS });
      await expect(section("Description")).toBeVisible();
      for (const name of PIPELINE_SECTIONS) await expect(section(name), `${id}: ${name}`).toHaveCount(0);
      for (const name of PIPELINE_CONTROLS) await expect(control(name), `${id}: ${name}`).toHaveCount(0);
      // The Mesh Avatar Layout reads the 2D agent's connection; the 3D agent never uses one.
      await expect(section("Connection Override"), id).toHaveCount(id === "2d-avatars" ? 1 : 0);
    }

    await open(agent.id);
    for (const name of [...PIPELINE_SECTIONS, "Connection Override"]) await expect(section(name), name).toBeVisible();
    for (const name of PIPELINE_CONTROLS) await expect(control(name), name).toBeVisible();
  } finally {
    await request.delete(`/api/agents/${agent.id}`).catch(() => undefined);
  }
});
