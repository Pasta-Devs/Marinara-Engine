import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { multiplayerGuestDocument } from "../packages/server/src/services/multiplayer/guest-document";
import {
  MULTIPLAYER_GUEST_LABEL_KEYS,
  multiplayerGuestErrorLabelKey,
} from "../packages/client/src/features/multiplayer/multiplayer-guest-labels";
import {
  multiplayerErrorCodeSchema,
  type MultiplayerGuestState,
} from "../packages/shared/src/schemas/multiplayer.schema";

const root = fileURLToPath(new URL("../", import.meta.url));
const hostile =
  '<img src="https://evil.invalid/steal" onerror="window.pwned=1"><script>window.pwned=1</script><svg onload="parent.fetch(\'/api/secret\')"></svg><style>@import "https://evil.invalid/css";</style><iframe src="/api/secret"></iframe> javascript:alert(1) [download](data:text/html,evil)';
const initialState: MultiplayerGuestState = {
  phase: "connected",
  error: null,
  snapshot: {
    version: 1,
    roomId: "room_123456",
    selfId: "guest_123456",
    revision: 1,
    nextSequence: 0,
    name: "Room <img onerror=alert(1)>",
    mode: "roleplay",
    status: "active",
    generation: "idle",
    usage: { generations: 0, maxGenerations: 100, automaticReplies: true },
    players: [
      {
        id: "host_123456",
        displayName: "Host",
        personaName: "Host persona",
        isHost: true,
        connected: true,
        ready: false,
        joinsNextRound: false,
      },
      {
        id: "guest_123456",
        displayName: "Guest <script>",
        personaName: "Persona <svg>",
        isHost: false,
        connected: true,
        ready: false,
        joinsNextRound: false,
      },
    ],
    characters: [{ id: "ai_123456", name: "GM <img src=x>", role: "gm" }],
    messages: [
      {
        id: "message_123456",
        actorId: null,
        actorName: "AI <script>",
        kind: "assistant",
        text: hostile,
        reactions: [{ emoji: '<svg onload="alert(1)">', by: ["Host <script>"] }],
        createdAt: "2026-09-29T10:00:00.000Z",
      },
    ],
    round: null,
  },
};

let server: Server;
let origin = "";
let guestHtml = "";
let guestHeaders: Record<string, string> = {};
let parentBundle = "";
let privateRequests = 0;

test.beforeAll(async () => {
  const english = JSON.parse(await readFile(`${root}packages/client/src/localization/locales/en.json`, "utf8"));
  const labels = {
    ...Object.fromEntries(MULTIPLAYER_GUEST_LABEL_KEYS.map((key) => [key, english[`multiplayer.guest.${key}`]])),
    errors: Object.fromEntries(
      multiplayerErrorCodeSchema.options.map((key) => [key, english[multiplayerGuestErrorLabelKey(key)]]),
    ),
    modes: Object.fromEntries(
      ["conversation", "roleplay", "game"].map((key) => [key, english[`multiplayer.guest.modes.${key}`]]),
    ),
  };
  const document = multiplayerGuestDocument(
    {
      javascript: await readFile(`${root}packages/client/dist/multiplayer/guest.js`, "utf8"),
      css: await readFile(`${root}packages/client/dist/multiplayer/guest.css`, "utf8"),
    },
    "local-trusted-build-nonce-123456",
  );
  guestHtml = document.html;
  guestHeaders = document.headers;
  const bundle = await build({
    stdin: {
      sourcefile: "multiplayer-isolation-fixture.tsx",
      resolveDir: `${root}packages/client`,
      loader: "tsx",
      contents: `
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {MultiplayerGuestFrame} from './src/features/multiplayer/MultiplayerGuestFrame';
        import {connectMultiplayerGuestFrame} from './src/features/multiplayer/multiplayer-guest-channel';
        const root=createRoot(document.getElementById('root'));
        let state=${JSON.stringify(initialState)};
        const labels=${JSON.stringify(labels)};
        const theme={mode:'dark',accent:'#c084fc'};
        window.proof={actions:[],errors:0,accept:true,setState(next){state=next;render()},labels};
        function render(){root.render(<MultiplayerGuestFrame state={state} labels={labels} theme={theme} title="Shared room" onAction={async action=>{window.proof.actions.push(action);return window.proof.accept}} onProtocolError={()=>window.proof.errors++}/>)}
        if(location.search==='?manual'){
          const frame=document.createElement('iframe');frame.title='Shared room';frame.sandbox='allow-scripts';frame.src='/api/multiplayer/guest-view';
          document.getElementById('root').append(frame);
          window.proof.connectManual=()=>connectMultiplayerGuestFrame(frame,{initial:{state,labels,theme},onAction:async action=>{window.proof.actions.push(action);return true},onError:()=>window.proof.errors++});
        }else render();
      `,
    },
    bundle: true,
    format: "iife",
    target: "es2020",
    write: false,
    define: { "process.env.NODE_ENV": '"production"' },
  });
  parentBundle = bundle.outputFiles[0]!.text;
  server = createServer((req, res) => {
    if (req.url === "/api/secret") privateRequests += 1;
    if (req.url === "/api/multiplayer/guest-view") {
      res.writeHead(200, guestHeaders).end(guestHtml);
    } else if (req.url === "/fixture.js") {
      res.writeHead(200, { "Content-Type": "text/javascript" }).end(parentBundle);
    } else if (req.url === "/" || req.url === "/?manual") {
      res
        .writeHead(200, { "Content-Type": "text/html" })
        .end(
          '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%}iframe{width:100%;height:100%;border:0}</style><div id="root"></div><script src="/fixture.js"></script>',
        );
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing isolation fixture address");
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  server?.closeAllConnections();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

async function openGuest(page: Page) {
  await page.addInitScript(() => {
    const scope = window as unknown as Record<string, any>;
    scope.proofPorts = [];
    const NativeChannel = MessageChannel;
    scope.MessageChannel = class extends NativeChannel {
      constructor() {
        super();
        scope.proofPorts.push(this.port1);
      }
    };
    window.addEventListener("message", (event) => {
      if (event.ports.length && event.source === parent) scope.receivedProofPort = event.ports[0];
    });
    if (window === parent) {
      localStorage.setItem("marinara_admin_secret", "private-test-secret");
      document.cookie = "admin=private-test-cookie; SameSite=Strict";
      scope.MarinaraAndroidNative = {
        saveFile: () => {
          scope.nativeCalls = (scope.nativeCalls ?? 0) + 1;
        },
      };
    }
  });
  await page.goto(origin);
  const guest = page.frameLocator('iframe[title="Shared room"]');
  await expect(guest.getByText(hostile, { exact: true })).toBeVisible();
  return guest;
}

test("production guest renders hostile data as inert text with no capabilities or network", async ({ page }) => {
  const requests: string[] = [];
  let downloads = 0;
  let popups = 0;
  page.on("request", (request) => requests.push(request.url()));
  page.on("download", () => downloads++);
  page.on("popup", () => popups++);
  const guest = await openGuest(page);
  await expect(guest.locator("img,iframe,style:not([nonce]),a,video,audio,object,embed")).toHaveCount(0);
  const guestFrame = page.frames().find((frame) => frame.url().endsWith("/api/multiplayer/guest-view"))!;
  const boundary = await guestFrame.evaluate(() => {
    const denied = (fn: () => unknown) => {
      try {
        fn();
        return false;
      } catch {
        return true;
      }
    };
    return {
      parent: denied(() => parent.document.body),
      storage: denied(() => localStorage.getItem("marinara_admin_secret")),
      cookie: denied(() => document.cookie),
      native: "MarinaraAndroidNative" in window,
      executed: "pwned" in window,
    };
  });
  expect(boundary).toEqual({ parent: true, storage: true, cookie: true, native: false, executed: false });
  await guest.getByRole("button", { name: /players/i }).click();
  await expect(guest.getByText("Guest <script>", { exact: false })).toBeVisible();
  await expect(guest.getByText("GM <img src=x>", { exact: true })).toBeVisible();
  await guest.getByRole("button", { name: /close players/i }).click();
  expect(
    requests.filter(
      (url) => ![`${origin}/`, `${origin}/fixture.js`, `${origin}/api/multiplayer/guest-view`].includes(url),
    ),
  ).toEqual([]);
  expect(downloads).toBe(0);
  expect(popups).toBe(0);
  expect(await page.evaluate(() => (window as any).nativeCalls ?? 0)).toBe(0);
});

test("actions stay typed and rejected sends preserve the draft", async ({ page }) => {
  const guest = await openGuest(page);
  await page.evaluate(() => {
    (window as any).proof.accept = false;
  });
  await guest.getByRole("textbox").fill("My character waits.");
  await guest.getByRole("button", { name: /^send$/i }).click();
  await expect(guest.getByRole("textbox")).toHaveValue("My character waits.");
  await expect.poll(() => page.evaluate(() => (window as any).proof.actions.length)).toBe(1);
  expect(await page.evaluate(() => (window as any).proof.actions[0].type)).toBe("message");
  await guest.getByRole("button", { name: /^send$/i }).click();
  await expect.poll(() => page.evaluate(() => (window as any).proof.actions.length)).toBe(2);
  const retries = await page.evaluate(() => (window as any).proof.actions);
  expect(retries[1]).toEqual(retries[0]);
  await page.evaluate((state) => {
    (window as any).proof.setState({ ...state, phase: "reconnecting", error: "disconnected" });
  }, initialState);
  await expect(guest.getByRole("textbox")).toHaveValue("My character waits.");
  await expect(guest.getByRole("button", { name: /^send$/i })).toBeDisabled();
  await page.evaluate((state) => {
    (window as any).proof.setState({
      ...state,
      error: "stale-action",
      snapshot: { ...state.snapshot, revision: 2, nextSequence: 7 },
    });
    (window as any).proof.accept = true;
  }, initialState);
  await expect(guest.getByRole("button", { name: /^send$/i })).toBeEnabled();
  await guest.getByRole("button", { name: /^send$/i }).click();
  await expect(guest.getByRole("textbox")).toHaveValue("");
  const accepted = await page.evaluate(() => (window as any).proof.actions[2]);
  expect(accepted.operationId).not.toBe(retries[0].operationId);
  expect(accepted.sequence).toBe(7);
  await guest.getByRole("button", { name: /leave/i }).click();
  await expect.poll(() => page.evaluate(() => (window as any).proof.actions.at(-1).type)).toBe("leave");
});

test("Game HUD stays inert and choices only extend the player's draft", async ({ page }) => {
  const guest = await openGuest(page);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  const malicious = '<img src="https://evil.invalid/game" onerror="parent.fetch(\'/api/secret\')">';
  const state: MultiplayerGuestState = {
    ...initialState,
    snapshot: {
      ...initialState.snapshot!,
      mode: "game",
      revision: 2,
      players: initialState.snapshot!.players.map((player) => ({
        ...player,
        personaChangeRejected: player.id === initialState.snapshot!.selfId,
      })),
      messages: [
        ...initialState.snapshot!.messages,
        {
          id: "event_123456",
          actorId: null,
          actorName: "Host",
          kind: "event",
          text: "Untrusted fallback text",
          createdAt: "2026-09-29T10:00:01.000Z",
          event: { type: "host-pass", targetName: '<img src=x onerror="alert(1)">' },
        },
      ],
      round: {
        id: "round_123456",
        number: 1,
        phase: "collecting",
        requiredParticipantIds: ["host_123456", "guest_123456"],
        submittedParticipantIds: [],
        ownSubmission: null,
      },
      game: {
        state: "exploration",
        location: malicious,
        weather: '<svg onload="alert(1)">',
        time: "javascript:alert(1)",
        choices: [malicious],
        rolls: [{ label: "<script>alert(1)</script>", total: 12 }],
        trackers: [
          {
            ownerId: "guest_123456",
            name: "Scout",
            values: [{ label: "Health", value: '<iframe src="/api/secret">' }],
          },
        ],
      },
    },
  };
  await page.evaluate((value) => (window as any).proof.setState(value), state);
  await expect(
    guest.getByText(
      "This character name is already in use. Choose a different name so messages and commands reach the right player.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    guest.getByText('The host recorded a pass. · <img src=x onerror="alert(1)">', { exact: true }),
  ).toBeVisible();
  await expect(guest.getByText("Untrusted fallback text", { exact: true })).toHaveCount(0);
  await guest.locator("summary").filter({ hasText: "Game status" }).click();
  await guest.getByRole("textbox").fill("My existing action.");
  await guest.getByRole("button", { name: `Add to your draft: ${malicious}`, exact: true }).click();
  await expect(guest.getByRole("textbox")).toHaveValue(`My existing action.\n${malicious}`);
  expect(await page.evaluate(() => (window as any).proof.actions)).toEqual([]);
  await expect(guest.locator("img,iframe,style:not([nonce]),a,svg[onload],script:not([nonce])")).toHaveCount(0);
  expect(requests).toEqual([]);
  await page.setViewportSize({ width: 390, height: 360 });
  await guest.getByRole("textbox").scrollIntoViewIfNeeded();
  await expect(guest.getByRole("textbox")).toBeInViewport();
  await guest.getByRole("button", { name: "Submit action", exact: true }).scrollIntoViewIfNeeded();
  await expect(guest.getByRole("button", { name: "Submit action", exact: true })).toBeInViewport();
  await guest.getByRole("button", { name: "Pass", exact: true }).scrollIntoViewIfNeeded();
  await expect(guest.getByRole("button", { name: "Pass", exact: true })).toBeInViewport();
  await expect(guest.getByRole("button", { name: "Leave", exact: true })).toBeInViewport();
  await page.evaluate(
    (value) =>
      (window as any).proof.setState({
        ...value,
        snapshot: { ...value.snapshot, revision: 3, mode: "roleplay", game: null, round: null, generation: "running" },
      }),
    state,
  );
  await expect(guest.getByRole("button", { name: /^send$/i })).toBeDisabled();
  await expect(guest.getByRole("textbox")).toHaveValue(`My existing action.\n${malicious}`);
});

test("strict channel rejects forged actions, unknown fields and oversized host messages", async ({ page }) => {
  await openGuest(page);
  const frame = page.frames().find((item) => item.url().endsWith("/api/multiplayer/guest-view"))!;
  await frame.evaluate(() => {
    (window as any).receivedProofPort.postMessage(
      JSON.stringify({
        type: "action",
        id: "forged_123456",
        action: { type: "download", operationId: "forged_123456", url: "/api/secret" },
      }),
    );
  });
  await expect.poll(() => page.evaluate(() => (window as any).proof.errors)).toBe(1);
  expect(await page.evaluate(() => (window as any).proof.actions)).toEqual([]);
  await page.reload();
  await expect(page.frameLocator("iframe").getByText(hostile, { exact: true })).toBeVisible();
  await page.evaluate(() => {
    (window as any).proofPorts.at(-1).postMessage("x".repeat(300_000));
  });
  await expect.poll(() => page.evaluate(() => (window as any).proof.errors)).toBe(1);
  await page.reload();
  await expect(page.frameLocator("iframe").getByText(hostile, { exact: true })).toBeVisible();
  await page.evaluate(() => {
    (window as any).proofPorts
      .at(-1)
      .postMessage(JSON.stringify({ type: "result", id: "result_123456", accepted: true, nativeAction: "saveFile" }));
  });
  await expect.poll(() => page.evaluate(() => (window as any).proof.errors)).toBe(1);
});

test("reconnect without a snapshot cannot erase room identity or revision binding", async ({ page }) => {
  for (const snapshot of [
    { ...initialState.snapshot!, roomId: "different_room" },
    { ...initialState.snapshot!, selfId: "different_self" },
    { ...initialState.snapshot!, revision: 0 },
  ]) {
    await openGuest(page);
    await page.evaluate(() =>
      (window as any).proof.setState({ phase: "reconnecting", snapshot: null, error: "disconnected" }),
    );
    await expect(page.frameLocator("iframe").getByText(hostile, { exact: true })).toHaveCount(0);
    await page.evaluate((state) => (window as any).proof.setState(state), { ...initialState, snapshot });
    await expect.poll(() => page.evaluate(() => (window as any).proof.errors)).toBe(1);
    expect(await page.evaluate(() => (window as any).proof.actions)).toEqual([]);
  }
});

test("a sibling cannot bootstrap the guest and a completed handshake cannot be replaced", async ({ page }) => {
  await page.goto(`${origin}/?manual`);
  await expect(page.locator('iframe[title="Shared room"]')).toBeVisible();
  const frame = page.frames().find((item) => item.url().endsWith("/api/multiplayer/guest-view"))!;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const sibling = document.createElement("iframe");
        sibling.sandbox.add("allow-scripts");
        sibling.srcdoc = `<script>const c=new MessageChannel();parent.frames[0].postMessage({channel:'marinara-multiplayer-guest-v1',token:'forged_123456'},'*',[c.port2]);parent.postMessage('sibling-sent','*');<\/script>`;
        const done = (event: MessageEvent) => {
          if (event.source === sibling.contentWindow && event.data === "sibling-sent") {
            window.removeEventListener("message", done);
            resolve();
          }
        };
        window.addEventListener("message", done);
        document.body.append(sibling);
      }),
  );
  await expect(frame.locator("#multiplayer-root")).toBeEmpty();
  await page.evaluate(() => (window as any).proof.connectManual());
  await expect(frame.getByText(hostile, { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const replacement = new MessageChannel();
    replacement.port1.onmessage = () => {
      (window as any).replacementAccepted = true;
    };
    document
      .querySelector("iframe")!
      .contentWindow!.postMessage({ channel: "marinara-multiplayer-guest-v1", token: "replacement_123456" }, "*", [
        replacement.port2,
      ]);
  });
  await frame.getByRole("textbox").fill("The original channel stays active.");
  await frame.getByRole("button", { name: /^send$/i }).click();
  await expect.poll(() => page.evaluate(() => (window as any).proof.actions.length)).toBe(1);
  expect(await page.evaluate(() => (window as any).replacementAccepted ?? false)).toBe(false);
});

test("guest CSP denies even direct network attempts", async ({ page }) => {
  await openGuest(page);
  const frame = page.frames().find((item) => item.url().endsWith("/api/multiplayer/guest-view"))!;
  const before = privateRequests;
  const results = await frame.evaluate(async (url) => {
    const fetchDenied = await fetch(url, { credentials: "include" }).then(
      () => false,
      () => true,
    );
    const imageDenied = await new Promise<boolean>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(false);
      image.onerror = () => resolve(true);
      image.src = url;
      document.body.append(image);
    });
    return { fetchDenied, imageDenied };
  }, `${origin}/api/secret`);
  expect(results).toEqual({ fetchDenied: true, imageDenied: true });
  expect(privateRequests).toBe(before);
});

test("direct guest navigation stays opaque and cannot bootstrap itself", async ({ page }) => {
  await page.goto(`${origin}/api/multiplayer/guest-view`);
  expect(
    await page.evaluate(() => {
      try {
        localStorage.setItem("escape", "1");
        return false;
      } catch {
        return true;
      }
    }),
  ).toBe(true);
  await expect(page.locator("#multiplayer-root")).toBeEmpty();
});
