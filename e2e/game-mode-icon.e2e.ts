import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";

// The Game Mode Icon on the character and persona Stats tabs: what a card's fight token
// shows. The avatar by default, a gallery picture, or the initials.
const pixel = readFileSync(new URL("../packages/client/public/icon-512.png", import.meta.url));
const avatar = `data:image/png;base64,${pixel.toString("base64")}`;

async function prepareFreshClient(page: Page) {
  const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
  }, version);
  await seedUIState(page, { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false });
}

function decoded(value: unknown): Record<string, unknown> {
  return (typeof value === "string" ? JSON.parse(value) : value) as Record<string, unknown>;
}

async function characterIcon(request: APIRequestContext, id: string): Promise<unknown> {
  const data = decoded((await (await request.get(`/api/characters/${id}`)).json()).data);
  return (data.extensions as Record<string, unknown>).combatIcon ?? null;
}

test("A character picks its Game Mode Icon: initials, then an uploaded picture", async ({ page, request }) => {
  const name = `Icon ${Date.now().toString(36)} Knight`;
  const created = await request.post("/api/characters", { data: { data: { name } } });
  expect(created.ok()).toBeTruthy();
  const character = (await created.json()) as { id: string };
  try {
    expect(
      (await request.post(`/api/characters/${character.id}/avatar`, { data: { avatar, filename: "a.png" } })).ok(),
    ).toBeTruthy();
    await prepareFreshClient(page);
    await page.goto("/");
    await expect(page.getByRole("main", { name: "Main content" })).toBeVisible();
    await page.evaluate(async (id) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openCharacterDetail(id);
    }, character.id);
    const editor = page.locator(".mari-editor-shell");
    const section = editor.getByTestId("game-mode-icon");
    await section.scrollIntoViewIfNeeded();
    const token = section.getByRole("img", { name: `${name}'s combat token` });
    // No choice yet: the avatar.
    await expect(section.getByRole("radio", { name: "Avatar", exact: true })).toBeChecked();
    await expect(token.locator("img")).toHaveAttribute("src", /\/api\/avatars\/file\//);

    await section.getByRole("radio", { name: "Initials", exact: true }).click();
    await expect(token.locator("img")).toHaveCount(0);
    await expect(token).toHaveText("IK");
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(() => characterIcon(request, character.id)).toEqual({ source: "initials" });

    await section.getByRole("radio", { name: "Custom image", exact: true }).click();
    const upload = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/characters/${character.id}/gallery/upload`) &&
        response.request().method() === "POST",
    );
    await section
      .locator('input[type="file"]')
      .setInputFiles({ name: "token.png", mimeType: "image/png", buffer: pixel });
    const image = (await (await upload).json()) as { id: string; url: string };
    await expect(section.getByRole("option", { name: "Use this picture" })).toHaveAttribute("aria-selected", "true");
    await expect(token.locator("img")).toHaveAttribute("src", image.url);
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(() => characterIcon(request, character.id))
      .toEqual({ source: "image", imageId: image.id, url: image.url });

    // Back to the avatar clears the choice from the card.
    await section.getByRole("radio", { name: "Avatar", exact: true }).click();
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(() => characterIcon(request, character.id)).toBeNull();
  } finally {
    await request.delete(`/api/characters/${character.id}`);
  }
});

test("A persona keeps its Game Mode Icon in its stats", async ({ page, request }) => {
  const name = `Icon Wanderer ${Date.now().toString(36)}`;
  const created = await request.post("/api/characters/personas", { data: { name } });
  expect(created.ok()).toBeTruthy();
  const persona = (await created.json()) as { id: string };
  try {
    await prepareFreshClient(page);
    await page.goto("/");
    await expect(page.getByRole("main", { name: "Main content" })).toBeVisible();
    await page.evaluate(async (id) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openPersonaDetail(id);
    }, persona.id);
    const editor = page.locator(".mari-editor-shell");
    const section = editor.getByTestId("game-mode-icon");
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByText("There is no avatar yet, so the token shows the initials.")).toBeVisible();
    await section.getByRole("radio", { name: "Initials", exact: true }).click();
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(async () =>
        decoded((await (await request.get(`/api/characters/personas/${persona.id}`)).json()).personaStats),
      )
      .toMatchObject({ combatIcon: { source: "initials" } });
  } finally {
    await request.delete(`/api/characters/personas/${persona.id}`);
  }
});

test("Gallery uploads refuse a file that is not the image it claims", async ({ request }) => {
  const character = (await (
    await request.post("/api/characters", { data: { data: { name: "Fake picture owner" } } })
  ).json()) as { id: string };
  const persona = (await (
    await request.post("/api/characters/personas", { data: { name: "Fake picture persona" } })
  ).json()) as { id: string };
  try {
    const fake = { name: "token.png", mimeType: "image/png", buffer: Buffer.from("<html>not a picture</html>") };
    for (const url of [
      `/api/characters/${character.id}/gallery/upload`,
      `/api/characters/personas/${persona.id}/gallery/upload`,
    ]) {
      const response = await request.post(url, { multipart: { file: fake } });
      expect(response.status(), url).toBe(400);
    }
    expect(await (await request.get(`/api/characters/${character.id}/gallery`)).json()).toEqual([]);
    expect(await (await request.get(`/api/characters/personas/${persona.id}/gallery`)).json()).toEqual([]);
  } finally {
    await request.delete(`/api/characters/${character.id}`);
    await request.delete(`/api/characters/personas/${persona.id}`);
  }
});

test("A party token draws the card's Game Mode Icon over its avatar", async ({ page }) => {
  await page.goto("/");
  const sprites = await page.evaluate(async () => {
    const module = (await import("/src/components/game/GameSurface.tsx" as string)) as unknown as {
      generatedPartyMemberToCombatant(
        member: Record<string, unknown>,
        index: number,
        avatarCandidates: unknown[],
        fallbackLevel: number,
      ): { sprite?: string };
    };
    const member = { name: "Mika", hp: 10, maxHp: 10, attacks: [], statuses: [] };
    const candidate = (combatIcon: unknown) => [
      { id: "c1", name: "Mika", avatarUrl: "/api/avatars/file/mika.png", combatIcon },
    ];
    return {
      avatar: module.generatedPartyMemberToCombatant(member, 0, candidate(undefined), 1).sprite ?? null,
      initials: module.generatedPartyMemberToCombatant(member, 0, candidate({ source: "initials" }), 1).sprite ?? null,
      image:
        module.generatedPartyMemberToCombatant(
          member,
          0,
          candidate({ source: "image", imageId: "i1", url: "/api/characters/c1/gallery/file/i1.png" }),
          1,
        ).sprite ?? null,
      offsite:
        module.generatedPartyMemberToCombatant(
          member,
          0,
          candidate({ source: "image", imageId: "i1", url: "https://example.com/i1.png" }),
          1,
        ).sprite ?? null,
    };
  });
  expect(sprites).toEqual({
    avatar: "/api/avatars/file/mika.png",
    initials: null,
    image: "/api/characters/c1/gallery/file/i1.png",
    offsite: "/api/avatars/file/mika.png",
  });
});

test("A token whose picture no longer loads shows its fallback instead of a broken image", async ({ page }) => {
  await page.goto("/");
  await prepareViteFixtureDependencies(page);
  await page.evaluate(async () => {
    const { TokenPicture } = await import("/src/components/game/TokenPicture.tsx" as string);
    const dependencyUrl = window.__viteFixtureDependencyUrl;
    const { default: React } = await import(dependencyUrl("react"));
    const { default: ReactDOM } = await import(dependencyUrl("react-dom_client"));
    const container = document.createElement("div");
    container.id = "token-fixture";
    document.body.append(container);
    ReactDOM.createRoot(container).render(
      React.createElement(TokenPicture, {
        src: "/api/characters/missing/gallery/file/deleted.png",
        alt: "Mika",
        fallback: React.createElement("span", { "data-testid": "token-fallback" }, "MI"),
      }),
    );
  });
  const token = page.locator("#token-fixture");
  await expect(token.getByTestId("token-fallback")).toHaveText("MI");
  await expect(token.locator("img")).toHaveCount(0);
});
