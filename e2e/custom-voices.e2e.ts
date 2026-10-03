import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { seedUIState } from "./ui-state-fixture.js";

/**
 * Custom-voice management (vLLM-Omni) — mocked browser coverage.
 *
 * Scope: the CustomVoiceManager that lives inside an audio connection's editor.
 * The provider (vLLM-Omni) is never contacted: every /api/tts/custom-voices*
 * round-trip is satisfied by an in-test state machine via page.route. Only the
 * /api/connections CRUD hits the real (disposable) server, so no production
 * TTS provider, model download, or network egress is involved.
 *
 * Honest limitation: because the endpoints are mocked, this verifies the client
 * flow (read-only open/refresh, file preview without synthesis/registration,
 * capability explanation, register happy-path, uncertain outcome, and stale
 * snapshot isolation) — not the acoustic quality of the resulting voice.
 *
 */

interface Voice {
  id: string;
  displayName: string;
  status: "pending" | "ready" | "uncertain" | "unavailable" | "deleted";
  createdAt: string;
}

interface Mgmt {
  connectionId: string;
  snapshot: string;
  destination: string;
  profile: "vllm-omni" | null;
  capability: "unknown" | "unsupported" | "explicit";
  voices: Voice[];
  providerVoices: string[];
  assignments: Record<string, string[]>;
  error?: string;
}

function baseMgmt(overrides: Partial<Mgmt> = {}): Mgmt {
  return {
    connectionId: "conn-cvm",
    snapshot: "s1",
    destination: "http://127.0.0.1:9999/v1",
    profile: null,
    capability: "unknown",
    voices: [],
    providerVoices: [],
    assignments: {},
    ...overrides,
  };
}

/** Minimal valid PCM16 mono 8 kHz WAV (0.3 s of silence) for the file input. */
function makeWav(): { name: string; mimeType: string; buffer: Buffer } {
  const sampleRate = 8000;
  const numFrames = 2400;
  const channels = 1;
  const bits = 16;
  const dataSize = numFrames * channels * (bits / 8);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + dataSize, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * channels * (bits / 8), 28);
  h.writeUInt16LE(channels * (bits / 8), 32);
  h.writeUInt16LE(bits, 34);
  h.write("data", 36);
  h.writeUInt32LE(dataSize, 40);
  return { name: "sample.wav", mimeType: "audio/wav", buffer: Buffer.concat([h, Buffer.alloc(dataSize)]) };
}

/**
 * Install the stateful mock for /api/tts/custom-voices*.
 * Each operation receives the current server state and returns the next state
 * (or an { __status, ... } envelope for error responses).
 */
function mockCustomVoices(
  page: Page,
  handlers: {
    get: (s: Mgmt) => Mgmt | { __status: number; error: string };
    put?: (body: any, s: Mgmt) => Mgmt | { __status: number; error: string };
    post?: (body: any, s: Mgmt, isDelete: boolean) => Mgmt | { __status: number; error: string };
  },
) {
  let state = baseMgmt();
  const handle = async (route: import("@playwright/test").Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    let body: any = {};
    try {
      body = req.postDataJSON();
    } catch {
      body = {};
    }
    const isDelete = url.pathname.endsWith("/delete");
    let result: Mgmt | { __status: number; error: string };
    if (method === "GET") {
      result = handlers.get(state);
    } else if (method === "PUT") {
      result = handlers.put ? handlers.put(body, state) : state;
    } else {
      result = handlers.post ? handlers.post(body, state, isDelete) : state;
    }
    const status =
      result && typeof result === "object" && "__status" in (result as any) ? (result as any).__status : 200;
    const payload = status >= 400 ? { success: false, error: (result as any).error } : result;
    state = status >= 400 ? state : (result as Mgmt);
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });
  };
  // The glob `*` does not cross path separators, so the `/delete` subpath
  // needs its own pattern; both patterns use the same mock state.
  page.route("**/tts/custom-voices*/*", handle);
  page.route("**/tts/custom-voices*", handle);
}

/** Track requests the page makes, split into "mutations" and "synthesis". */
function trackRequests(page: Page) {
  const mutations: string[] = []; // PUT/POST to /tts/custom-voices*
  const reads: string[] = []; // GET to /tts/custom-voices*
  const speak: string[] = []; // POST /api/tts/speak (actual synthesis)
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("/tts/custom-voices")) {
      (req.method() === "GET" ? reads : mutations).push(`${req.method()} ${u}`);
    }
    if (u.includes("/api/tts/speak") && req.method() === "POST") speak.push(u);
  });
  return { mutations, reads, speak };
}

function manageButton(page: Page) {
  return page.getByRole("button", { name: "Manage custom voices", exact: true });
}

async function openConnectionEditor(page: Page, id: string) {
  await page.goto("/");
  await page.evaluate(async (connId) => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.getState().openConnectionDetail(connId);
  }, id);
  await expect(page.locator(".mari-editor-shell").first()).toBeVisible({ timeout: 20000 });
}

async function createAudioConnection(
  request: APIRequestContext,
  name: string,
  audioSource: "openai" | "elevenlabs" | "pockettts" | "xai",
): Promise<string> {
  const resp = await request.post("/api/connections", {
    data: {
      name,
      provider: "audio",
      audioSource,
      baseUrl: "http://127.0.0.1:9999/v1",
      apiKey: "cvm-test-key",
      model: "cvm-fake-model",
    },
  });
  expect(resp.ok()).toBeTruthy();
  const created = await resp.json();
  return created.id;
}

test.describe("custom voice management (mocked provider)", () => {
  test.beforeEach(async ({ page }) => {
    await seedUIState(page, { sidebarOpen: false, chibiProfessorMariEnabled: false });
  });

  test("open + refresh is read-only: no mutations and no synthesis", async ({ page, request }) => {
    const id = await createAudioConnection(request, "CVM Open", "openai");
    const tracker = trackRequests(page);
    let getCalls = 0;
    mockCustomVoices(page, {
      get: (s) => {
        getCalls += 1;
        // First read fails (network/provider blip) → surfaces the recovery Refresh.
        if (getCalls === 1) return { __status: 502, error: "Custom voice operation failed." };
        return s;
      },
      put: (b, s) => ({ ...s, snapshot: "s2", profile: b.profile ?? s.profile, capability: "explicit" }),
      post: (b, s) => s,
    });

    await openConnectionEditor(page, id);
    await manageButton(page).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    // The failed read shows the recovery control; the destination is not yet known.
    await expect(modal.getByRole("button", { name: "Refresh" })).toBeVisible();

    // Manual refresh: a second read, now successful. Still a pure read — no mutation.
    await modal.getByRole("button", { name: "Refresh" }).click();
    await expect(modal.getByText("http://127.0.0.1:9999/v1")).toBeVisible();

    expect(getCalls).toBeGreaterThanOrEqual(2);
    expect(tracker.speak).toEqual([]);
    expect(tracker.mutations).toEqual([]);
    expect(tracker.reads.length).toBeGreaterThanOrEqual(2);
  });

  test("selecting a file and filling consent previews without registering or synthesizing", async ({
    page,
    request,
  }) => {
    const id = await createAudioConnection(request, "CVM Preview", "openai");
    const tracker = trackRequests(page);
    // Profile already set → "explicit" capability, which is what reveals the upload form.
    mockCustomVoices(page, {
      get: () => baseMgmt({ profile: "vllm-omni", capability: "explicit", snapshot: "s2" }),
    });

    await openConnectionEditor(page, id);
    await manageButton(page).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal.getByText("http://127.0.0.1:9999/v1")).toBeVisible();

    // Pick a WAV, fill display name + consent + transcript, tick acknowledgment.
    await modal.locator("#cvm-file").setInputFiles(makeWav());
    await modal.locator("#cvm-display-name").fill("Aria Preview");
    await modal.locator("#cvm-consent").fill("rec-0001");
    await modal.locator("#cvm-transcript").fill("hello world");
    await modal.locator('input[type="checkbox"]').first().check();

    // Previewing the file (and completing the form) must NOT post to the provider
    // nor synthesize anything: registration only happens on the explicit Upload.
    await page.waitForTimeout(400);
    expect(tracker.mutations).toEqual([]);
    expect(tracker.speak).toEqual([]);
  });

  test("unsupported source explains why the profile cannot be used", async ({ page, request }) => {
    const id = await createAudioConnection(request, "CVM Unsupported", "elevenlabs");
    mockCustomVoices(page, {
      get: (s) => baseMgmt({ ...s, capability: "unsupported" }),
    });

    await openConnectionEditor(page, id);
    await manageButton(page).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    // "unsupported" explanation is shown; the profile <select> (unknown-only) is not.
    await expect(
      modal.getByText(
        "Custom voices aren't supported by this TTS source. Use an OpenAI-compatible endpoint to manage custom voices.",
      ),
    ).toBeVisible();
    await expect(modal.locator("#cvm-profile")).toHaveCount(0);
  });

  test("successful registration: select profile, upload, voice becomes ready", async ({ page, request }) => {
    const id = await createAudioConnection(request, "CVM Success", "openai");
    mockCustomVoices(page, {
      get: (s) => s,
      put: (b, s) =>
        s.profile ? s : { ...s, snapshot: "s2", profile: b.profile ?? "vllm-omni", capability: "explicit" },
      post: (b, s) => {
        const voice: Voice = {
          id: "marinara_test123",
          displayName: b.displayName,
          status: "ready",
          createdAt: new Date().toISOString(),
        };
        return { ...s, snapshot: "s3", voices: [...s.voices, voice] };
      },
    });

    await openConnectionEditor(page, id);
    await manageButton(page).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal.getByText("http://127.0.0.1:9999/v1")).toBeVisible();

    // capability unknown → profile select visible. Select and save the profile.
    await modal.locator("#cvm-profile").selectOption("vllm-omni");
    await modal.getByRole("button", { name: "Save profile" }).click();
    // After the PUT, the manager refreshes and now reports the explicit capability.
    await expect(modal.getByText("This connection supports custom voice uploads.")).toBeVisible();

    // Fill the upload form and submit.
    await modal.locator("#cvm-file").setInputFiles(makeWav());
    await modal.locator("#cvm-display-name").fill("Aria Clone");
    await modal.locator("#cvm-consent").fill("rec-0002");
    await modal.locator('input[type="checkbox"]').first().check();
    await modal.getByRole("button", { name: "Upload voice" }).click();

    // The registered voice appears as "Ready" and the success toast is shown.
    await expect(modal.getByText("Aria Clone").first()).toBeVisible();
    await expect(modal.getByText("Ready", { exact: true })).toBeVisible();
    await expect(page.getByText("Uploaded custom voice Aria Clone", { exact: true })).toBeVisible();
  });

  test("rejected registration is surfaced as uncertain, not ready", async ({ page, request }) => {
    const id = await createAudioConnection(request, "CVM Uncertain", "openai");
    mockCustomVoices(page, {
      get: (s) => s,
      put: (b, s) =>
        s.profile ? s : { ...s, snapshot: "s2", profile: b.profile ?? "vllm-omni", capability: "explicit" },
      post: (_b, s) => {
        // Provider rejected the upload (502): the voice is retained as "uncertain".
        return {
          ...s,
          snapshot: "s3",
          voices: [
            {
              id: "marinara_uncertain",
              displayName: "Ghost",
              status: "uncertain",
              createdAt: new Date().toISOString(),
            },
          ],
        };
      },
    });

    await openConnectionEditor(page, id);
    await manageButton(page).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    await modal.locator("#cvm-profile").selectOption("vllm-omni");
    await modal.getByRole("button", { name: "Save profile" }).click();
    await expect(modal.getByText("This connection supports custom voice uploads.")).toBeVisible();

    await modal.locator("#cvm-file").setInputFiles(makeWav());
    await modal.locator("#cvm-display-name").fill("Ghost");
    await modal.locator("#cvm-consent").fill("rec-0003");
    await modal.locator('input[type="checkbox"]').first().check();
    await modal.getByRole("button", { name: "Upload voice" }).click();

    // Outcome is uncertain: status shown, recovery guidance present, not "ready".
    await expect(modal.getByText("Uncertain", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "The server accepted the upload but can't confirm the voice is ready yet. Refresh before re-uploading.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(modal.getByText("Ready", { exact: true })).toHaveCount(0);
  });

  test("stale snapshot isolates the connection: PUT 409 keeps state, no corruption", async ({ page, request }) => {
    const id = await createAudioConnection(request, "CVM Stale", "openai");
    mockCustomVoices(page, {
      get: (s) => s,
      // The connection changed between read and write → the server rejects with 409.
      put: (_b, s) => ({
        __status: 409,
        error: "Connection changed. Refresh and confirm the new destination before continuing.",
      }),
    });

    await openConnectionEditor(page, id);
    await manageButton(page).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal.getByText("http://127.0.0.1:9999/v1")).toBeVisible();

    await modal.locator("#cvm-profile").selectOption("vllm-omni");
    await modal.getByRole("button", { name: "Save profile" }).click();

    // The 409 surfaces as an error toast; the profile stays unselected (capability
    // remains "unknown" → select still present) and the destination is unchanged.
    await expect(
      page.getByText(
        "Couldn't save the profile: Connection changed. Refresh and confirm the new destination before continuing.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(modal.locator("#cvm-profile")).toBeVisible();
    await expect(modal.getByText("http://127.0.0.1:9999/v1")).toBeVisible();
  });

  test("deleting an already-deleted managed voice confirms all assignments and keeps the tombstone", async ({
    page,
    request,
  }) => {
    const id = await createAudioConnection(request, "CVM Tombstone", "openai");
    const tracker = trackRequests(page);
    const deleteBodies: any[] = [];
    const deletedVoice: Voice = {
      id: "marinara_tomb01",
      displayName: "Ghost",
      status: "deleted",
      createdAt: new Date().toISOString(),
    };
    mockCustomVoices(page, {
      get: (s) =>
        s.profile
          ? s
          : {
              ...s,
              snapshot: "s1",
              profile: "vllm-omni",
              capability: "explicit",
              voices: [deletedVoice],
              assignments: { marinara_tomb01: ["Character Alpha", "Character Beta"] },
            },
      // Deletion of an already-tombstoned voice is pure local cleanup: the
      // successful response clears the remaining assignment references while
      // the tombstone itself stays in the managed list.
      post: (b, s, isDelete) => {
        expect(isDelete).toBeTruthy();
        deleteBodies.push(b);
        return { ...s, assignments: {} };
      },
    });

    await openConnectionEditor(page, id);
    await manageButton(page).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    // The deleted voice stays visible with its "Deleted" status…
    await expect(modal.getByText("Ghost")).toBeVisible();
    await expect(modal.getByText("Deleted", { exact: true })).toBeVisible();
    // …and a tombstone never offers Test synthesis (only "ready" voices do).
    await expect(modal.getByRole("button", { name: "Test", exact: true })).toHaveCount(0);

    // Open the delete confirmation for the tombstone: it must list ALL
    // remaining assignment labels.
    await modal.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(modal.getByText("Delete Ghost?", { exact: true })).toBeVisible();
    await expect(
      modal.getByText("In use by: Character Alpha, Character Beta. Confirm these assignments before deleting."),
    ).toBeVisible();

    // The confirmation checkbox is required: submit stays disabled until it is ticked.
    const confirmCheckbox = modal.getByLabel("I've confirmed the assignments above.");
    await expect(confirmCheckbox).toBeVisible();
    await expect(confirmCheckbox).not.toBeChecked();
    const confirmDelete = modal.getByRole("button", { name: "Delete voice", exact: true });
    await expect(confirmDelete).toBeDisabled();
    await confirmCheckbox.check();
    await expect(confirmDelete).toBeEnabled();

    // Submit: one POST to the existing delete endpoint with the exact payload.
    await confirmDelete.click();

    // Success toast acknowledges the local cleanup.
    await expect(page.getByText("Deleted Ghost", { exact: true })).toBeVisible();
    expect(deleteBodies).toEqual([
      {
        snapshot: "s1",
        id: "marinara_tomb01",
        confirmedAssignments: ["Character Alpha", "Character Beta"],
      },
    ]);
    expect(tracker.mutations).toHaveLength(1);
    // toHaveLength(1) just proved the element exists; the `!` is for the
    // noUncheckedIndexedAccess build, not a runtime assumption.
    const mutation = tracker.mutations[0]!;
    expect(mutation.startsWith("POST ")).toBeTruthy();
    expect(mutation).toContain(`/tts/custom-voices/delete?connectionId=${id}`);

    // The confirmation section closes; the tombstone remains visible and the
    // cleared references are reflected on refresh (no assignment list, no Test).
    await expect(modal.getByText("Delete Ghost?", { exact: true })).toHaveCount(0);
    await expect(modal.getByText("Ghost")).toBeVisible();
    await expect(modal.getByText("Deleted", { exact: true })).toBeVisible();
    await expect(modal.getByText("In use by:")).toHaveCount(0);
    await expect(modal.getByRole("button", { name: "Test", exact: true })).toHaveCount(0);

    // No synthesis and no extra mutation traffic for the whole flow.
    expect(tracker.speak).toEqual([]);
  });
});
