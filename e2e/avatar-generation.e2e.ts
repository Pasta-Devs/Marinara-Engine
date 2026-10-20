// Making a 2D avatar from a sprite, end to end against the real server with local image and vision models
// that hold their answers: Cancel aborts the picture or mesh avatar being made (the model's request closes)
// and leaves the panel idle with only finished pictures, Try again shows the picture being redone, and a
// sprite drawn on a flat background is used as it is: nothing is cut out of the blink picture or the saved
// mesh avatar. An image connection that can't edit pictures draws a new face with its blink and talk
// pictures in one sheet; they are offered, kept and saved together.
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createAvatarConfig, type AvatarConfig } from "@marinara-engine/shared";
import AdmZip from "adm-zip";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { sharp } from "../scripts/regressions/fixtures/avatar-2d-fixtures.js";
import { seedUIState } from "./ui-state-fixture.js";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";

const LAYOUT = {
  headBox: [110, 40, 490, 470],
  faceBox: [170, 140, 430, 460],
  eyes: [
    { opening: [321, 272, 379, 298], region: [310, 255, 390, 308] },
    { opening: [221, 272, 279, 298], region: [210, 255, 290, 308] },
  ],
  brows: [
    [318, 238, 380, 250],
    [220, 238, 282, 250],
  ],
  nose: [300, 340],
  mouth: { left: [275, 395], right: [325, 395], box: [272, 388, 328, 402] },
  neck: [300, 490],
};

/** The eyes closed: skin over each eye and a lid line, at sprite scale `scale` from `top`. */
function closedEyes(scale = 1, top = 0) {
  return [250, 350]
    .map(
      (cx) =>
        `<ellipse cx="${cx * scale}" cy="${top + 283 * scale}" rx="${36 * scale}" ry="${18 * scale}" fill="#f2c9a8"/>` +
        `<path d="M${(cx - 30) * scale} ${top + 286 * scale} Q${cx * scale} ${top + 296 * scale} ${(cx + 30) * scale} ${top + 286 * scale}" stroke="#111" stroke-width="${4 * scale}" fill="none"/>`,
    )
    .join("");
}

/** A front-facing bust, 600 x 720, on a flat white background unless `background` is false. */
function bustSvg({ background = true, eyes = "open", mouth = "closed" } = {}) {
  const eye = (cx: number) =>
    `<ellipse cx="${cx}" cy="285" rx="30" ry="14" fill="#fff"/><circle cx="${cx}" cy="285" r="11" fill="#3b6db3"/><circle cx="${cx}" cy="285" r="5" fill="#111"/>` +
    `<path d="M${cx - 34} 284 Q${cx} 260 ${cx + 34} 284" stroke="#222" stroke-width="4" fill="none"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="720">${background ? `<rect width="600" height="720" fill="#fff"/>` : ""}
      <rect x="120" y="540" width="360" height="200" rx="60" fill="#3a5fa0"/><rect x="262" y="440" width="76" height="130" fill="#f2c9a8"/>
      <ellipse cx="300" cy="250" rx="190" ry="210" fill="#5a3a22"/><ellipse cx="300" cy="300" rx="130" ry="160" fill="#f2c9a8"/>
      <rect x="220" y="240" width="62" height="8" rx="4" fill="#4a2f1c"/><rect x="318" y="240" width="62" height="8" rx="4" fill="#4a2f1c"/>
      ${eye(250)}${eye(350)}${eyes === "closed" ? closedEyes() : ""}
      ${mouth === "open" ? `<ellipse cx="300" cy="400" rx="20" ry="12" fill="#5a1a1a"/>` : `<path d="M275 395 Q300 400 325 395" stroke="#a04848" stroke-width="3" fill="none"/>`}</svg>`);
}

function bust() {
  return sharp(bustSvg()).png().toBuffer();
}

async function alphaAt(png: Buffer, x: number, y: number) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return data[(y * info.width + x) * 4 + 3];
}

/** Image and vision models on one local server. While `hold` is on, a request waits until the test answers
 *  it (`respond`) or the Engine closes it (Cancel). */
function fakeModels() {
  const state = {
    hold: true,
    holdVisionOnly: false,
    held: [] as Array<{ url: string; respond: () => Promise<void> }>,
    closed: [] as string[],
    open: [] as ServerResponse[],
  };
  const answer = async (url: string, body: Buffer, res: ServerResponse) => {
    res.setHeader("content-type", "application/json");
    if (url.endsWith("/chat/completions")) {
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON.stringify(LAYOUT) } }] }));
      return;
    }
    if (url.endsWith("/images/generations")) {
      res.end(JSON.stringify({ data: [{ b64_json: (await setSheet(body)).toString("base64") }] }));
      return;
    }
    // An edit that keeps the picture in place on the canvas GPT Image 1 is asked for (a 600x720 sprite sits
    // 153 pixels down at 1024/600 scale) and closes its eyes, with the background filled in white as most
    // image models do.
    const start = body.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const sent = body.subarray(start, body.indexOf(Buffer.from("IEND"), start) + 8);
    const picture = await sharp(sent)
      .resize(1024, 1536, { fit: "cover" })
      .flatten({ background: "#fff" })
      .composite([
        {
          input: Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536">${closedEyes(1024 / 600, 153)}</svg>`,
          ),
        },
      ])
      .png()
      .toBuffer();
    res.end(JSON.stringify({ data: [{ b64_json: picture.toString("base64") }] }));
  };
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const url = req.url ?? "";
    if (!/\/(?:images\/edits|images\/generations|chat\/completions)$/u.test(url)) {
      // Model lists and other lookups the app makes for a connection.
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ data: [] }));
      return;
    }
    res.on("close", () => {
      if (!res.writableFinished) state.closed.push(url);
    });
    const body = Buffer.concat(chunks);
    if (state.hold && (!state.holdVisionOnly || url.endsWith("/chat/completions"))) {
      state.held.push({ url, respond: () => answer(url, body, res) });
      state.open.push(res);
      return;
    }
    await answer(url, body, res);
  });
  return { server, state };
}

/** A generated set: the face, eyes closed and mouth open side by side on the plain colour the prompt asks for,
 *  each cell drawn a little differently, as generated sheets are. */
async function setSheet(body: Buffer) {
  const hex = /#[0-9a-f]{6}\b/iu.exec(body.toString("utf8"))?.[0] ?? "#00ff00";
  const cell = async (svg: Buffer, dx: number, dy: number) =>
    sharp({ create: { width: 512, height: 512, channels: 3, background: hex } })
      .composite([{ input: await sharp(svg).resize(420, 504).png().toBuffer(), left: 46 + dx, top: 8 + dy }])
      .png()
      .toBuffer();
  const cells = [
    await cell(bustSvg({ background: false }), 0, 0),
    await cell(bustSvg({ background: false, eyes: "closed" }), 5, 2),
    await cell(bustSvg({ background: false, mouth: "open" }), -3, -1),
  ];
  return sharp({ create: { width: 1536, height: 512, channels: 3, background: hex } })
    .composite(cells.map((input, index) => ({ input, left: index * 512, top: 0 })))
    .png()
    .toBuffer();
}

async function mountGenerationPanel(page: Page, ownerId: string, config: AvatarConfig | null = null) {
  await prepareViteFixtureDependencies(page);
  await page.evaluate(
    async ({ ownerId, config }) => {
      const url = window.__viteFixtureDependencyUrl;
      const { default: React } = await import(url("react"));
      const { default: ReactDOM } = await import(url("react-dom_client"));
      const { QueryClient, QueryClientProvider } = await import(url("@tanstack_react-query"));
      const { AvatarGenerationPanel } = (await import(
        "/src/features/avatars/generation/AvatarGenerationPanel.tsx" as string
      )) as { AvatarGenerationPanel: unknown };
      const mount = document.createElement("div");
      mount.dataset.avatarGeneration = "true";
      mount.style.cssText =
        "position:fixed;inset:0;z-index:99999;overflow:auto;background:var(--background);color:var(--foreground);padding:12px";
      document.body.append(mount);
      ReactDOM.createRoot(mount).render(
        React.createElement(
          QueryClientProvider,
          { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          React.createElement(AvatarGenerationPanel as never, {
            owner: { ownerType: "character", ownerId },
            config,
            onChanged: () => {},
          }),
        ),
      );
    },
    { ownerId, config },
  );
  return page.locator("[data-avatar-generation]");
}

test("Cancel stops the picture being made, and avatars made from a sprite keep it as it is", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const models = fakeModels();
  await new Promise<void>((resolve) => models.server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${(models.server.address() as { port: number }).port}/v1`;
  const created: string[] = [];
  let characterId = "";
  try {
    const character = await request.post("/api/characters", { data: { data: { name: "Sprite fixture" } } });
    expect(character.ok(), await character.text()).toBeTruthy();
    characterId = ((await character.json()) as { id: string }).id;
    const sprite = await request.post(`/api/sprites/${characterId}`, {
      data: { expression: "neutral", image: `data:image/png;base64,${(await bust()).toString("base64")}` },
    });
    expect(sprite.ok(), await sprite.text()).toBeTruthy();
    const connection = async (data: Record<string, unknown>) => {
      const response = await request.post("/api/connections", { data: { apiKey: "fixture", baseUrl, ...data } });
      expect(response.ok(), await response.text()).toBeTruthy();
      const { id } = (await response.json()) as { id: string };
      created.push(id);
      return id;
    };
    const imageId = await connection({
      name: `Held image ${testInfo.project.name}`,
      provider: "image_generation",
      imageGenerationSource: "openai",
      imageService: "openai",
      model: "gpt-image-1",
    });
    const visionId = await connection({
      name: `Held vision ${testInfo.project.name}`,
      provider: "custom",
      model: "vision",
    });

    await page.route("**/api/app-settings/ui", (route) =>
      route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
    );
    await seedUIState(page, { hasCompletedOnboarding: true, reviewImagePromptsBeforeSend: false });
    await page.goto("/");
    const panel = await mountGenerationPanel(page, characterId);
    await panel.getByLabel("Image connection").selectOption(imageId);

    // ── Cancel while a blink picture is being drawn ──
    // Every feeling shows the one neutral face, so it is the only row, with its blink and talk slots empty.
    await expect(panel.locator("[data-talking-head-face]")).toHaveCount(1);
    await expect(panel.locator('[data-talking-head-face="neutral"]')).toContainText(
      "Neutral, Happy, Angry, Sad, Relaxed, Surprised",
    );
    await panel.getByRole("button", { name: "Make 2 pictures" }).click();
    await expect.poll(() => models.state.held.length).toBe(1);
    expect(models.state.held[0]!.url).toMatch(/\/images\/edits$/u);
    await expect(panel.getByRole("status")).toHaveText("Making picture 1 of 2…");
    // Cancel's own request reaches the server late, as through a slow proxy.
    let cancelDelivered = false;
    await page.route("**/api/avatar-generation/cancel", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.fulfill({ response: await route.fetch() });
      cancelDelivered = true;
    });
    await panel.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(panel.getByRole("button", { name: "Cancel", exact: true })).toHaveCount(0);
    await expect(panel.getByText("Waiting", { exact: true })).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Make 2 pictures" })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath("cancelled.png"), animations: "disabled" });
    await expect
      .poll(() => models.state.closed, { message: "the image request in flight is aborted" })
      .toEqual([models.state.held[0]!.url]);

    // ── The next picture starts at once, the late cancel doesn't stop it, and nothing is cut out of it ──
    const blink = panel.getByRole("group", { name: "neutral: Eyes closed", exact: true });
    await blink.getByRole("button", { name: "Make neutral: Eyes closed", exact: true }).click();
    await expect.poll(() => models.state.held.length).toBe(2);
    await expect(panel.getByRole("status")).toHaveText("Making picture 1 of 1…");
    await expect.poll(() => cancelDelivered).toBe(true);
    expect(models.state.closed, "the late cancel left the new picture alone").toHaveLength(1);
    await models.state.held[1]!.respond();
    const drawn = panel.getByRole("img", { name: "New picture: neutral: Eyes closed" });
    await expect(drawn).toBeVisible({ timeout: 30_000 });
    const src = await drawn.getAttribute("src");
    const picture = Buffer.from(src!.slice(src!.indexOf(",") + 1), "base64");
    expect(await alphaAt(picture, 3, 3), "the sprite's white background stays").toBe(255);
    expect(await alphaAt(picture, 300, 330), "the face stays").toBe(255);
    await page.screenshot({ path: testInfo.outputPath("pngtuber-picture.png"), animations: "disabled" });

    // ── Try again shows the picture being redone, not a picture that seems done ──
    const retry = blink.getByRole("button", { name: "Try neutral: Eyes closed again", exact: true });
    await retry.click();
    await expect.poll(() => models.state.held.length).toBe(3);
    await expect(blink).toHaveAttribute("aria-busy", "true");
    await expect(drawn).toBeVisible();
    await expect(blink.getByRole("button", { name: "Keep", exact: true })).toHaveCount(0);
    await expect(retry).toHaveCount(0);
    await expect(panel.getByRole("status")).toHaveText("Making picture 1 of 1…");
    await page.screenshot({ path: testInfo.outputPath("pngtuber-redo.png"), animations: "disabled" });
    await models.state.held[2]!.respond();
    await expect(blink).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
    await expect(retry).toBeVisible();
    await expect(panel.getByRole("status")).toHaveCount(0);

    // ── A kept picture is stored in the PNGTuber avatar ──
    await blink.getByRole("button", { name: "Keep", exact: true }).click();
    await expect(blink.getByRole("button", { name: "Kept", exact: true })).toHaveAttribute("aria-pressed", "true");
    await panel.getByRole("button", { name: "Save kept pictures (1)" }).click();
    await expect
      .poll(async () => {
        const config = await request.get(`/api/avatar-models/character/${characterId}`);
        return config.ok() ? (await config.json())?.kinds?.pngtuber?.layers?.neutral?.eyesClosed : undefined;
      })
      .toMatchObject({ source: "file", path: expect.stringMatching(/^pngtuber\/.+\.png$/u) });

    // ── Cancel while the vision model looks at the sprite for the mesh avatar ──
    // This fixture only draws closed eyes. Answer its unusable mesh mouth edit immediately so the
    // supported fallback reaches the held vision call; keep the vision cancellation proof intact.
    models.state.holdVisionOnly = true;
    await panel.getByLabel("Chat connection that can see pictures").selectOption(visionId);
    // The neutral sprite is picked for a mesh avatar until the user picks another.
    await expect(
      panel.getByRole("group", { name: "Sprite to use" }).getByRole("button", { name: "neutral" }),
    ).toHaveAttribute("aria-pressed", "true");
    await panel.getByRole("button", { name: "Make mesh avatar" }).click();
    await expect.poll(() => models.state.held.length).toBe(4);
    expect(models.state.held[3]!.url).toMatch(/\/chat\/completions$/u);
    await panel.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect.poll(() => models.state.closed.length, { message: "the vision request is aborted" }).toBe(2);
    await expect(panel.getByText("Building the mesh avatar…")).toHaveCount(0);
    await expect(panel.getByRole("alert")).toHaveCount(0);

    // ── The mesh avatar is built from the sprite as it is ──
    models.state.hold = false;
    await panel.getByRole("button", { name: "Make mesh avatar" }).click();
    await panel.getByRole("button", { name: "Save as mesh avatar" }).click({ timeout: 30_000 });
    let file = "";
    await expect
      .poll(async () => {
        const config = await request.get(`/api/avatar-models/character/${characterId}`);
        file = config.ok() ? (((await config.json())?.kinds?.["mesh-avatar"]?.file as string | undefined) ?? "") : "";
        return file;
      })
      .toMatch(/^mesh-avatar\/.+\.mavatar$/u);
    const archive = await request.get(`/api/avatar-models/character/${characterId}/files/${file}`);
    const base = new AdmZip(Buffer.from(await archive.body())).getEntry("built/base.png")!.getData();
    expect(await alphaAt(base, 3, 3), "the mesh avatar keeps the sprite's background").toBe(255);
    expect(await alphaAt(base, 300, 600), "its body stays").toBe(255);
  } finally {
    for (const response of models.state.open) response.destroy();
    models.server.closeAllConnections();
    await new Promise<void>((resolve) => models.server.close(() => resolve()));
    for (const id of created) await request.delete(`/api/connections/${id}`);
    if (characterId) await request.delete(`/api/characters/${characterId}`);
  }
});

async function meshReviewOwner(request: APIRequestContext) {
  const character = await request.post("/api/characters", { data: { data: { name: "Mesh review fixture" } } });
  expect(character.ok(), await character.text()).toBeTruthy();
  const { id } = (await character.json()) as { id: string };
  const image = `data:image/png;base64,${(await bust()).toString("base64")}`;
  const sprite = await request.post(`/api/sprites/${id}`, { data: { expression: "neutral", image } });
  expect(sprite.ok(), await sprite.text()).toBeTruthy();
  return { id, image };
}

// Generation responses are controlled here to exercise the browser's review/save boundary. The real image
// model and archive paths above, and the mesh sprite regressions, cover building and storing the pictures.
test("Mesh picture review uses the chosen image connection and keeps only the saved draft", async ({
  page,
  request,
}, testInfo) => {
  const { id, image } = await meshReviewOwner(request);
  const owner = { ownerType: "character" as const, ownerId: id };
  const config = createAvatarConfig(owner, new Date().toISOString());
  config.kinds["mesh-avatar"] = { file: "mesh-avatar/existing.mavatar", expressionMap: {}, source: "generated" };
  const previews: Record<string, unknown>[] = [];
  const generations: Record<string, unknown>[] = [];
  const saves: Record<string, unknown>[] = [];
  let nextFails = false;
  let made = 0;
  const pictures = ["mouth_a", "mouth_i", "mouth_o", "mouth_a_half", "eyes_closed", "eyes_half", "eyes_smile"].map(
    (key) => ({ key, image }),
  );
  try {
    await page.route("**/api/app-settings/ui", (route) =>
      route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
    );
    await page.route("**/api/connections", (route) =>
      route.fulfill({
        json: [
          { id: "default-image", name: "Default image fixture", provider: "image_generation", defaultForAgents: true },
          { id: "chosen-image", name: "Chosen image fixture", provider: "image_generation" },
          { id: "sheet-image", name: "Sheet image fixture", provider: "image_generation" },
          { id: "chosen-vision", name: "Vision fixture", provider: "custom" },
        ],
      }),
    );
    await page.route("**/api/avatar-generation/mesh-rig/preview", (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      previews.push(body);
      const sheet = body.imageConnectionId === "sheet-image";
      return route.fulfill({
        json: {
          items: [
            {
              id: `mesh:neutral:${sheet ? "set" : "mouth_i"}`,
              kind: "sprite",
              title: "Unlocalized server title",
              prompt: sheet ? "Draw a matching set." : "Draw a wide mouth.",
            },
          ],
        },
      });
    });
    await page.route("**/api/avatar-generation/mesh-rig", (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      generations.push(body);
      if (nextFails) {
        nextFails = false;
        return route.fulfill({ status: 400, json: { error: "Synthetic mesh retry failed." } });
      }
      return route.fulfill({
        json: {
          archive: Buffer.from(`mesh-draft-${++made}`).toString("base64"),
          preview: image,
          warnings: [],
          pictures,
          spriteStatus: "complete",
          newFace: body.imageConnectionId === "sheet-image",
        },
      });
    });
    await page.route("**/api/avatar-generation/mesh-rig/save", (route) => {
      saves.push(route.request().postDataJSON() as Record<string, unknown>);
      return route.fulfill({ json: { kind: "mesh-avatar", config, files: [], warnings: [] } });
    });
    await seedUIState(page, { hasCompletedOnboarding: true, reviewImagePromptsBeforeSend: true });
    await page.goto("/");
    const panel = await mountGenerationPanel(page, id, config);
    const mesh = panel.locator('section[aria-labelledby="avatar-generation-mesh"]');
    await expect(mesh).toContainText("replace the current mesh avatar when you save");
    await panel.getByLabel("Image connection", { exact: true }).selectOption("chosen-image");
    await mesh.getByLabel("Chat connection that can see pictures").selectOption("chosen-vision");
    await mesh.getByRole("button", { name: "Make mesh avatar", exact: true }).click();
    const review = page.getByRole("dialog", { name: "Review Image Prompt", exact: true });
    await expect(review).toBeVisible();
    await expect(review.getByText("neutral: Wide mouth", { exact: true })).toBeVisible();
    await expect(review.getByText("Unlocalized server title", { exact: true })).toHaveCount(0);
    expect(previews).toEqual([
      { owner, sourceLabel: "neutral", connectionId: "chosen-vision", imageConnectionId: "chosen-image" },
    ]);
    expect(generations).toHaveLength(0);
    expect(saves).toHaveLength(0);
    await review.getByRole("textbox").fill("Keep the face fixed and draw a wide mouth.");
    await review.getByRole("button", { name: "Generate", exact: true }).click();
    await expect(mesh.locator("[data-mesh-picture]")).toHaveCount(7);
    await expect(mesh).toContainText("Drawn mouths and eyes are ready");
    for (const name of [
      "Mouth open",
      "Wide mouth",
      "Rounded mouth",
      "Mouth half open",
      "Eyes closed",
      "Eyes half closed",
      "Smiling eyes",
    ]) {
      await expect(mesh.getByRole("img", { name: `Mesh picture: ${name}`, exact: true })).toBeVisible();
    }
    expect(generations[0]).toMatchObject({
      owner,
      sourceLabel: "neutral",
      connectionId: "chosen-vision",
      imageConnectionId: "chosen-image",
      promptOverrides: [{ id: "mesh:neutral:mouth_i", prompt: "Keep the face fixed and draw a wide mouth." }],
    });
    expect(saves).toHaveLength(0);
    await page.screenshot({ path: testInfo.outputPath("mesh-seven-picture-review.png"), animations: "disabled" });

    // Cancelling prompt review does not replace a draft or send a generation/save request.
    await mesh.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(review).toBeVisible();
    await review.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(mesh.getByRole("button", { name: "Save as mesh avatar", exact: true })).toBeEnabled();
    expect(generations).toHaveLength(1);
    expect(saves).toHaveLength(0);

    // A failed retry retains the draft; the next successful retry is the one Keep/Save submits.
    nextFails = true;
    await mesh.getByRole("button", { name: "Try again", exact: true }).click();
    await review.getByRole("button", { name: "Generate", exact: true }).click();
    await expect(mesh.getByRole("alert")).toContainText("Synthetic mesh retry failed.");
    await expect(mesh.locator("[data-mesh-picture]")).toHaveCount(7);
    expect(saves).toHaveLength(0);
    await panel.getByLabel("Image connection", { exact: true }).selectOption("sheet-image");
    await mesh.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(review.getByText("neutral: Matched mouth and eye pictures", { exact: true })).toBeVisible();
    await review.getByRole("button", { name: "Generate", exact: true }).click();
    await expect.poll(() => made).toBe(2);
    const save = mesh.getByRole("button", { name: "Save as mesh avatar", exact: true });
    await expect(save).toBeEnabled();
    await expect(mesh).toContainText("your sprite and PNGTuber pictures stay as they are");
    expect(generations.at(-1)).toMatchObject({
      imageConnectionId: "sheet-image",
      promptOverrides: [{ id: "mesh:neutral:set", prompt: "Draw a matching set." }],
    });
    expect(saves).toHaveLength(0);
    await save.click();
    await expect.poll(() => saves.length).toBe(1);
    expect(saves[0]).toEqual({ owner, archive: Buffer.from("mesh-draft-2").toString("base64") });
    await expect(mesh.locator("[data-mesh-picture]")).toHaveCount(0);
  } finally {
    await request.delete(`/api/characters/${id}`);
  }
});

for (const spriteStatus of ["unavailable", undefined] as const) {
  test(`A ${spriteStatus ?? "legacy"} mesh draft explains its fallback without an image connection`, async ({
    page,
    request,
  }) => {
    const { id, image } = await meshReviewOwner(request);
    const bodies: Record<string, unknown>[] = [];
    let saves = 0;
    try {
      await page.route("**/api/app-settings/ui", (route) =>
        route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
      );
      await page.route("**/api/connections", (route) => route.fulfill({ json: [] }));
      await page.route("**/api/avatar-generation/mesh-rig/preview", (route) => route.fulfill({ json: { items: [] } }));
      await page.route("**/api/avatar-generation/mesh-rig", (route) => {
        bodies.push(route.request().postDataJSON() as Record<string, unknown>);
        return route.fulfill({
          json: {
            archive: "fallback",
            preview: image,
            warnings: [],
            ...(spriteStatus ? { spriteStatus, spriteError: "Image connection unavailable." } : {}),
          },
        });
      });
      await page.route("**/api/avatar-generation/mesh-rig/save", (route) => {
        saves += 1;
        return route.fulfill({
          json: {
            kind: "mesh-avatar",
            config: createAvatarConfig({ ownerType: "character", ownerId: id }, new Date().toISOString()),
            files: [],
            warnings: [],
          },
        });
      });
      await seedUIState(page, { hasCompletedOnboarding: true, reviewImagePromptsBeforeSend: true });
      await page.goto("/");
      const panel = await mountGenerationPanel(page, id);
      const mesh = panel.locator('section[aria-labelledby="avatar-generation-mesh"]');
      await mesh.getByRole("button", { name: "Make mesh avatar", exact: true }).click();
      await expect(
        mesh.getByText(
          "Drawn mouth and eye pictures aren't available. This draft uses the usual mesh mouth and eyelids.",
        ),
      ).toBeVisible();
      await expect(mesh.locator("[data-mesh-picture]")).toHaveCount(0);
      await expect(mesh.getByText("Drawn mouths and eyes are ready", { exact: false })).toHaveCount(0);
      await expect(page.getByRole("dialog", { name: "Review Image Prompt", exact: true })).toHaveCount(0);
      expect(bodies[0]).toMatchObject({ imageConnectionId: null, connectionId: null, promptOverrides: [] });
      expect(saves).toBe(0);
      await mesh.getByRole("button", { name: "Save as mesh avatar", exact: true }).click();
      await expect.poll(() => saves).toBe(1);
    } finally {
      await request.delete(`/api/characters/${id}`);
    }
  });
}

test("An image connection that can't edit draws a new face with its blink and talk pictures, kept together", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const models = fakeModels();
  models.state.hold = false;
  const urls: string[] = [];
  models.server.prependListener("request", (req: IncomingMessage) => urls.push(req.url ?? ""));
  await new Promise<void>((resolve) => models.server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${(models.server.address() as { port: number }).port}/v1`;
  let connectionId = "";
  let characterId = "";
  try {
    const character = await request.post("/api/characters", {
      data: { data: { name: "Set fixture", description: "brown hair, blue eyes, a blue jacket" } },
    });
    expect(character.ok(), await character.text()).toBeTruthy();
    characterId = ((await character.json()) as { id: string }).id;
    const sprite = await request.post(`/api/sprites/${characterId}`, {
      data: { expression: "neutral", image: `data:image/png;base64,${(await bust()).toString("base64")}` },
    });
    expect(sprite.ok(), await sprite.text()).toBeTruthy();
    const connection = await request.post("/api/connections", {
      data: {
        name: `DALL-E ${testInfo.project.name}`,
        provider: "image_generation",
        imageGenerationSource: "openai",
        imageService: "openai",
        model: "dall-e-3",
        apiKey: "fixture",
        baseUrl,
      },
    });
    expect(connection.ok(), await connection.text()).toBeTruthy();
    connectionId = ((await connection.json()) as { id: string }).id;

    await page.route("**/api/app-settings/ui", (route) =>
      route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
    );
    await seedUIState(page, { hasCompletedOnboarding: true, reviewImagePromptsBeforeSend: false });
    await page.goto("/");
    const panel = await mountGenerationPanel(page, characterId);
    await panel.getByLabel("Image connection").selectOption(connectionId);
    await panel.getByRole("button", { name: "Make 2 pictures" }).click();

    // One sheet makes the new face and both of its pictures.
    const blink = panel.getByRole("img", { name: "New picture: neutral: Eyes closed" });
    const talk = panel.getByRole("img", { name: "New picture: neutral: Mouth open" });
    await expect(blink).toBeVisible({ timeout: 60_000 });
    await expect(talk).toBeVisible();
    await expect(panel.getByRole("img", { name: "New picture: neutral: New face" })).toBeVisible();
    await expect(panel.getByText("can't edit pictures, so it drew a new face")).toBeVisible();
    await expect(panel.getByRole("status")).toHaveCount(0);
    expect(
      urls.filter((url) => url.endsWith("/images/generations")),
      "one picture is drawn",
    ).toHaveLength(1);
    expect(
      urls.filter((url) => url.endsWith("/images/edits")),
      "the connection is never asked to edit",
    ).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("new-face-set.png"), animations: "disabled" });

    // Keeping one picture keeps the set; saving makes the new face the face of the feeling.
    const blinkSlot = panel.getByRole("group", { name: "neutral: Eyes closed", exact: true });
    const talkSlot = panel.getByRole("group", { name: "neutral: Mouth open", exact: true });
    await blinkSlot.getByRole("button", { name: "Keep", exact: true }).click();
    await expect(blinkSlot.getByRole("button", { name: "Kept", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(talkSlot.getByRole("button", { name: "Kept", exact: true })).toHaveAttribute("aria-pressed", "true");
    await panel.getByRole("button", { name: "Save kept pictures (2)" }).click();
    await expect
      .poll(async () => {
        const config = await request.get(`/api/avatar-models/character/${characterId}`);
        return config.ok() ? (await config.json())?.kinds?.pngtuber?.layers?.neutral : undefined;
      })
      .toMatchObject({
        base: { source: "file", path: "pngtuber/neutral-base.png" },
        eyesClosed: { source: "file", path: "pngtuber/neutral-eyes-closed.png" },
        mouthOpen: { source: "file", path: "pngtuber/neutral-mouth-open.png" },
      });
    await expect(panel.getByRole("img", { name: "New picture: neutral: New face" })).toHaveCount(0);
  } finally {
    models.server.closeAllConnections();
    await new Promise<void>((resolve) => models.server.close(() => resolve()));
    if (connectionId) await request.delete(`/api/connections/${connectionId}`);
    if (characterId) await request.delete(`/api/characters/${characterId}`);
  }
});
