import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const sharp = createRequire(new URL("../packages/server/package.json", import.meta.url))("sharp");
// Run only the saved-avatar case against the old client to capture the actual missing-avatar baseline.
const baseline = process.env.NARRATOR_AVATAR_BASELINE === "true";
const record = (value: unknown): Record<string, any> =>
  typeof value === "string" ? JSON.parse(value) : ((value as Record<string, any>) ?? {});

function fixture(request: APIRequestContext) {
  const resources: string[] = [];
  const create = async (path: string, data: unknown): Promise<{ id: string }> => {
    const response = await request.post(path, { data });
    expect(response.ok(), await response.text()).toBeTruthy();
    const value = await response.json();
    resources.unshift(`${path}/${value.id}`);
    return value;
  };
  // Test-owned portraits: one solid colour per character, so every avatar differs by file and by look.
  const character = async (name: string, color?: string) => {
    const row = await create("/api/characters", { data: { name, description: `${name} character card.` } });
    let avatarUrl: string | null = null;
    if (color) {
      const avatar: Buffer = await sharp({
        create: { width: 64, height: 64, channels: 3, background: color },
      })
        .png()
        .toBuffer();
      const response = await request.post(`/api/characters/${row.id}/avatar`, {
        data: { avatar: `data:image/png;base64,${avatar.toString("base64")}`, filename: `${name}.png` },
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      avatarUrl = (await response.json()).avatarPath;
      expect(avatarUrl).toBeTruthy();
    }
    return { ...row, avatarUrl };
  };
  return {
    create,
    character,
    cleanup: async () => {
      for (const path of resources) await request.delete(path).catch(() => undefined);
    },
  };
}

async function openChat(page: Page, chatId: string) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    trackerPanelEnabled: false,
    trackerPanelOpen: false,
    chatHelpSeenModes: ["roleplay", "conversation", "game"],
    appAccentPulseMode: false,
    reduceAmbientEffects: false,
    roleplayNarratorAvatarCycling: true,
    roleplayAvatarStyle: "circles",
    roleplayDisplayStyle: "classic",
    streamingSpeed: 100,
  });
  await page.addInitScript(
    ({ chatId, version }) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem("marinara:whats-new:seen-version", version);
    },
    { chatId, version },
  );
  await page.goto("/");
}

async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${baseline ? "before" : "after"}-${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await info.attach(name, { path, contentType: "image/png" });
}

test("saved narrator references add only valid outside avatars without reviving inactive members", async ({
  page,
  request,
}, info) => {
  const data = fixture(request);
  try {
    const alice = await data.character("Alice", "#c0392b");
    const bob = await data.character("Bob", "#2a6fdb");
    const inactive = await data.character("Inactive member", "#1e8449");
    const guest = await data.character("Referenced visitor", "#d4a017");
    const noAvatar = await data.character("Visitor without portrait");
    const memberIds = [alice.id, bob.id, inactive.id];
    const chat = await data.create("/api/chats", {
      name: "Narrator avatar references",
      mode: "roleplay",
      characterIds: memberIds,
    });
    const metadata = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { groupChatMode: "merged", inactiveCharacterIds: [inactive.id] },
    });
    expect(metadata.ok()).toBeTruthy();
    const message = await data.create(`/api/chats/${chat.id}/messages`, {
      role: "assistant",
      content: "The referenced visitor joins Alice and Bob in the scene.",
      extra: {
        referencedCharacterIds: [guest.id, guest.id, inactive.id, alice.id, noAvatar.id, "MISSING_REFERENCE_000"],
      },
    });
    await openChat(page, chat.id);
    const row = page.locator(`[data-message-id="${message.id}"]`);
    const avatars = row.locator(".mari-message-avatar img");
    await expect(row).toContainText("The referenced visitor joins Alice and Bob");
    await expect(avatars).toHaveCount(baseline ? 2 : 3);
    await expect(row.locator(`.mari-message-avatar img[src="${inactive.avatarUrl}"]`)).toHaveCount(0);
    const guestAvatar = row.locator(`.mari-message-avatar img[src="${guest.avatarUrl}"]`);
    await expect(guestAvatar).toHaveCount(baseline ? 0 : 1);
    if (!baseline) await expect(guestAvatar).toHaveCSS("opacity", "1", { timeout: 10_000 });
    await capture(page, info, "narrator-referenced-avatar");
    const savedChat = await (await request.get(`/api/chats/${chat.id}`)).json();
    expect(
      typeof savedChat.characterIds === "string" ? JSON.parse(savedChat.characterIds) : savedChat.characterIds,
    ).toEqual(memberIds);
    expect(record(savedChat.metadata).inactiveCharacterIds).toEqual([inactive.id]);
  } finally {
    await data.cleanup();
  }
});

test("historical narrator replies show only the characters of their own scene", async ({ page, request }, info) => {
  test.skip(baseline || !info.project.name.includes("desktop"), "Roster selection is shared across viewports.");
  const data = fixture(request);
  try {
    const ana = await data.character("Ana", "#c0392b");
    const ben = await data.character("Ben", "#2a6fdb");
    const cal = await data.character("Cal", "#1e8449");
    const dee = await data.character("Dee", "#d4a017");
    // Eve has no sprites, so no expression result could ever name her.
    const eve = await data.character("Eve", "#8e44ad");
    const cast = [ana, ben, cal, dee, eve];
    const spriteImage: Buffer = await sharp({
      create: { width: 32, height: 32, channels: 3, background: "#777777" },
    })
      .png()
      .toBuffer();
    for (const character of [ana, ben, cal, dee]) {
      const response = await request.post(`/api/sprites/${character.id}`, {
        data: { expression: "smile", image: `data:image/png;base64,${spriteImage.toString("base64")}` },
      });
      expect(response.ok(), await response.text()).toBeTruthy();
    }
    const chat = await data.create("/api/chats", {
      name: "Scene-only narrator avatars",
      mode: "roleplay",
      characterIds: cast.map((character) => character.id),
    });
    const metadata = await request.patch(`/api/chats/${chat.id}/metadata`, { data: { groupChatMode: "merged" } });
    expect(metadata.ok()).toBeTruthy();
    // Every member is active now; each reply was written with only Ana and Ben in the scene. A user turn before each
    // reply keeps it from grouping under the previous one, which would hide its avatars.
    const reply = async (content: string, characterId: string, extra?: Record<string, unknown>) => {
      await data.create(`/api/chats/${chat.id}/messages`, { role: "user", content: "What happens next?" });
      return data.create(`/api/chats/${chat.id}/messages`, {
        role: "assistant",
        characterId,
        content,
        ...(extra ? { extra } : {}),
      });
    };
    const anaAndBen = {
      spriteExpressions: { [ana.id]: "smile", [ben.id]: "smile" },
      expressionSpriteIds: [ana.id, ben.id],
    };
    const cases: Array<[{ id: string }, typeof cast]> = [
      [
        await reply("A reply saved with its roster.", ana.id, { mergedRosterCharacterIds: [ana.id, ben.id] }),
        [ana, ben],
      ],
      [await reply("An older reply with an expression result.", ana.id, anaAndBen), [ana, ben, eve]],
      [await reply("An older reply without expression data.", ana.id), cast],
      [await reply("Cal's greeting.", cal.id), cast],
    ];
    // An older reply split at a scene break: the expression result is on its last part, grouped under the first.
    const splitFirst = await reply("The first scene of a split reply.", ana.id, { continuesAfterSceneBreak: true });
    await data.create(`/api/chats/${chat.id}/messages`, {
      role: "assistant",
      characterId: ana.id,
      content: "The second scene of a split reply.",
      extra: anaAndBen,
    });
    cases.push([splitFirst, [ana, ben, eve]]);
    await openChat(page, chat.id);
    for (const [message, expected] of cases) {
      const row = page.locator(`[data-message-id="${message.id}"]`);
      await expect(row).toBeVisible();
      await expect(row.locator(".mari-message-avatar img")).toHaveCount(expected.length);
      for (const character of cast) {
        await expect(row.locator(`.mari-message-avatar img[src="${character.avatarUrl}"]`)).toHaveCount(
          expected.includes(character) ? 1 : 0,
        );
      }
    }
    await capture(page, info, "narrator-scene-only-avatars");
  } finally {
    await data.cleanup();
  }
});

test("lorebook narrator avatar references clear on regeneration and follow the selected swipe", async ({
  page,
  request,
}, info) => {
  test.skip(
    baseline || !info.project.name.includes("desktop"),
    "Generation and swipe persistence are shared across viewports.",
  );
  test.setTimeout(120_000);
  const data = fixture(request);
  const prompts: string[] = [];
  const provider = createServer(async (incoming, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
    if (incoming.method !== "POST" || incoming.url !== "/v1/chat/completions") {
      response.writeHead(404).end();
      return;
    }
    prompts.push(JSON.stringify(JSON.parse(Buffer.concat(chunks).toString()).messages));
    response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
    response.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "The narrator describes the scene." }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  try {
    const address = provider.address();
    if (!address || typeof address === "string") throw new Error("Avatar fixture provider did not bind");
    const connection = await data.create("/api/connections", {
      name: "Narrator references provider",
      provider: "custom",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      apiKey: "synthetic-test-key",
      model: "narrator-reference-fixture",
      maxContext: 32768,
      treatAsLocalEndpoint: true,
    });
    const alice = await data.character("Alice", "#c0392b");
    const bob = await data.character("Bob", "#2a6fdb");
    const guest = await data.character("Referenced visitor", "#d4a017");
    const memberIds = [alice.id, bob.id];
    const preset = await data.create("/api/prompts", { name: "Narrator reference cards", wrapFormat: "none" });
    for (const [order, type] of ["lorebook", "id_macro_cards", "chat_history"].entries()) {
      await data.create(`/api/prompts/${preset.id}/sections`, {
        identifier: type,
        name: type,
        role: "system",
        isMarker: true,
        markerConfig: { type },
        injectionPosition: "ordered",
        order,
      });
    }
    const lorebook = await data.create("/api/lorebooks", { name: "Referenced visitor activation", tokenBudget: 2048 });
    await data.create(`/api/lorebooks/${lorebook.id}/entries`, {
      name: "Visitor summoned by beacon",
      content: `LORE_VISITOR: {{${guest.id}}} arrives. {{${guest.id}}} carries a letter.`,
      keys: ["guestbeacon"],
    });
    const chat = await data.create("/api/chats", {
      name: "Generated narrator references",
      mode: "roleplay",
      characterIds: memberIds,
      connectionId: connection.id,
      promptPresetId: preset.id,
    });
    const metadata = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: {
        groupChatMode: "merged",
        enableAgents: false,
        enableTools: false,
        enableMemoryRecall: false,
        activeLorebookIds: [lorebook.id],
      },
    });
    expect(metadata.ok(), await metadata.text()).toBeTruthy();
    const user = await data.create(`/api/chats/${chat.id}/messages`, {
      role: "user",
      content: "I light the guestbeacon.",
    });
    const messages = async () =>
      (await (await request.get(`/api/chats/${chat.id}/messages`)).json()) as Array<{
        id: string;
        role: string;
        activeSwipeIndex: number;
        extra: unknown;
      }>;
    const generate = async (messageId?: string) => {
      const response = await request.post("/api/generate", {
        data: { chatId: chat.id, ...(messageId ? { regenerateMessageId: messageId } : {}) },
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      expect(await response.text()).not.toContain('"type":"error"');
      const reply = (await messages()).filter((message) => message.role === "assistant").at(-1);
      expect(reply).toBeTruthy();
      return reply!;
    };
    const reply = await generate();
    expect(record(reply.extra).referencedCharacterIds).toEqual([guest.id]);
    expect(prompts.at(-1)).toContain("LORE_VISITOR: Referenced visitor arrives.");
    expect(prompts.at(-1)).toContain("Referenced visitor character card.");
    await openChat(page, chat.id);
    const row = page.locator(`[data-message-id="${reply.id}"]`);
    const guestAvatar = row.locator(`.mari-message-avatar img[src="${guest.avatarUrl}"]`);
    await expect(guestAvatar).toHaveCount(1);

    const edited = await request.patch(`/api/chats/${chat.id}/messages/${user.id}`, {
      data: { content: "Describe just Alice and Bob." },
    });
    expect(edited.ok()).toBeTruthy();
    const regenerated = await generate(reply.id);
    expect(regenerated.id).toBe(reply.id);
    expect(regenerated.activeSwipeIndex).toBe(1);
    expect(record(regenerated.extra).referencedCharacterIds).toEqual([]);
    expect(prompts.at(-1)).not.toContain("LORE_VISITOR");
    expect(prompts.at(-1)).not.toContain("Referenced visitor character card.");
    await page.reload();
    await expect(row).toContainText("The narrator describes the scene.");
    await expect(guestAvatar).toHaveCount(0);
    for (const index of [0, 1]) {
      const switched = await request.put(`/api/chats/${chat.id}/messages/${reply.id}/active-swipe`, {
        data: { index },
      });
      expect(switched.ok()).toBeTruthy();
      const selected = (await messages()).find((message) => message.id === reply.id)!;
      expect(record(selected.extra).referencedCharacterIds).toEqual(index === 0 ? [guest.id] : []);
      await page.reload();
      await expect(row).toContainText("The narrator describes the scene.");
      await expect(guestAvatar).toHaveCount(index === 0 ? 1 : 0);
    }
    const saved = await (await request.get(`/api/chats/${chat.id}`)).json();
    expect(typeof saved.characterIds === "string" ? JSON.parse(saved.characterIds) : saved.characterIds).toEqual(
      memberIds,
    );
  } finally {
    await data.cleanup();
    await new Promise<void>((resolve) => provider.close(() => resolve()));
  }
});

for (const variant of ["single-roleplay", "individual-roleplay", "conversation", "game"] as const) {
  test(`saved references do not add narrator avatars in ${variant}`, async ({ page, request }, info) => {
    test.skip(baseline || !info.project.name.includes("desktop"), "Mode gates are shared across viewports.");
    const data = fixture(request);
    try {
      const alice = await data.character("Alice", "#c0392b");
      const bob = await data.character("Bob", "#2a6fdb");
      const guest = await data.character("Outside visitor", "#d4a017");
      const mode = variant.endsWith("roleplay") ? "roleplay" : variant;
      const chat = await data.create("/api/chats", {
        name: `No narrator reference in ${variant}`,
        mode,
        characterIds: variant === "single-roleplay" ? [alice.id] : [alice.id, bob.id],
      });
      const metadata = await request.patch(`/api/chats/${chat.id}/metadata`, {
        data: {
          groupChatMode: variant === "individual-roleplay" ? "individual" : "merged",
          ...(mode === "game"
            ? {
                gameId: "avatar-mode-gate",
                gameSessionStatus: "active",
                gameSessionNumber: 1,
                gameIntroPresented: true,
                gameActiveState: "dialogue",
                enableAgents: false,
                gameBlueprint: { campaignPlan: {}, hudWidgets: [], introSequence: [], visualTheme: {} },
              }
            : {}),
        },
      });
      expect(metadata.ok(), await metadata.text()).toBeTruthy();
      const content = `This ${variant} reply keeps its own avatar.`;
      await data.create(`/api/chats/${chat.id}/messages`, {
        role: "assistant",
        characterId: alice.id,
        content,
        extra: { referencedCharacterIds: [guest.id] },
      });
      const requestedReferenceIds: string[] = [];
      page.on("request", (request) => {
        if (request.method() === "POST" && new URL(request.url()).pathname === "/api/characters/summaries") {
          requestedReferenceIds.push(...(request.postDataJSON()?.ids ?? []));
        }
      });
      await openChat(page, chat.id);
      await expect(page.getByText(content, { exact: true })).toBeVisible();
      // Let queries started after the first render settle before checking their absence.
      await page.waitForLoadState("networkidle");
      await expect(page.locator(`img[src="${guest.avatarUrl}"]`)).toHaveCount(0);
      expect(requestedReferenceIds).not.toContain(guest.id);
    } finally {
      await data.cleanup();
    }
  });
}
