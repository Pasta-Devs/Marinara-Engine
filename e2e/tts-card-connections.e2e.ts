import { test, expect, type Page } from "@playwright/test";
import { seedUIState } from "./ui-state-fixture.js";
import { readFileSync } from "node:fs";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

test.beforeEach(async ({ page }) => {
  // Keep server-persisted preferences from overriding this test's local fixture.
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  // Release announcements are unrelated to these connection-management proofs.
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), APP_VERSION);
});

/** Client routing/persistence proof only: all TTS requests are intercepted, never sent to a provider. */
async function openCard(
  page: Page,
  defaultRole: boolean | string = true,
  options: { allowConfigPut?: boolean; narratorVoiceEnabled?: boolean } = {},
) {
  await seedUIState(page, {
    sidebarOpen: false,
    chibiProfessorMariEnabled: false,
    professorMariNavigationEnabled: false,
    hasCompletedOnboarding: true,
  });
  // Put fallback first so choosing the default cannot accidentally pass by array order.
  const rows = [
    {
      id: "tts-scope-a",
      name: "Scope Fallback",
      provider: "audio",
      audioSource: "openai",
      baseUrl: "http://fallback.invalid/v1",
      model: "fallback-model",
      audioVoice: "a-saved",
      defaultForAgents: false as boolean | string,
      fallbackForAgents: "true" as boolean | string,
    },
    {
      id: "tts-scope-b",
      name: "Scope Default",
      provider: "audio",
      audioSource: "openai",
      baseUrl: "http://default.invalid/v1",
      model: "default-model",
      audioVoice: "b-saved",
      defaultForAgents: defaultRole,
      fallbackForAgents: false as boolean | string,
    },
  ];
  const legacy = {
    enabled: false,
    source: "openai",
    baseUrl: "http://legacy-tts.invalid/v1",
    apiKey: "legacy-key",
    model: "legacy-model",
    voice: "legacy-voice",
    speed: 1.25,
    voiceMode: "per-character",
    narratorVoiceEnabled: options.narratorVoiceEnabled ?? false,
    narratorVoice: "legacy-narrator",
    dialogueOnly: false,
    voiceAssignments: [{ characterId: "legacy-character", voice: "legacy-assignment" }],
    sourceProfiles: {
      elevenlabs: {
        baseUrl: "http://legacy-eleven.invalid",
        apiKey: "legacy-eleven-key",
        model: "legacy-eleven-model",
        voice: "legacy-eleven-voice",
      },
    },
  };
  const legacySnapshot = structuredClone(legacy);
  const patches: { id: string; body: Record<string, unknown> }[] = [];
  const configPuts: Record<string, unknown>[] = [];
  const mutations: string[] = [];
  const configReads: Record<string, unknown>[] = [];
  const voiceReads: string[] = [];
  const managerReads: string[] = [];
  const speaks: unknown[] = [];
  const unexpected: string[] = [];
  const revisions: Record<string, number> = { "tts-scope-a": 1, "tts-scope-b": 1 };

  await page.route("**/api/connections", (route) => route.fulfill({ json: rows }));
  await page.route("**/api/connections/tts-scope-*", async (route) => {
    expect(route.request().method()).toBe("PATCH");
    const id = new URL(route.request().url()).pathname.split("/").pop()!;
    const row = rows.find((item) => item.id === id)!;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    patches.push({ id, body });
    mutations.push(`PATCH ${id}`);
    for (const role of ["defaultForAgents", "fallbackForAgents"] as const) {
      if (body[role] === true) rows.forEach((item) => (item[role] = false));
    }
    Object.assign(row, body);
    await route.fulfill({ json: row });
  });
  // One catch-all blocks config writes by default, profile saves, uploads,
  // deletion and models. Only explicit reads/preview and opt-in config PUT are allowed.
  await page.route("**/api/tts/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname === "/api/tts/config" && req.method() === "GET") {
      const roleEnabled = (value: boolean | string) => value === true || value === "true";
      const selected =
        rows.find((row) => roleEnabled(row.defaultForAgents)) ?? rows.find((row) => roleEnabled(row.fallbackForAgents));
      // Match the server's response-only identity overlay; editors read legacyConfig.
      const config = {
        ...legacy,
        ...(selected
          ? {
              source: selected.audioSource,
              baseUrl: selected.baseUrl,
              model: selected.model,
              voice: selected.audioVoice,
            }
          : {}),
        legacyConfig: structuredClone(legacy),
        cacheConnectionId: selected?.id ?? "",
        cacheVoiceRevision: "s1",
        cacheVoiceRevisions: {},
        cacheVoiceStatuses: {},
      };
      configReads.push(structuredClone(config));
      await route.fulfill({ json: config });
      return;
    }
    if (url.pathname === "/api/tts/config" && req.method() === "PUT" && options.allowConfigPut) {
      const body = req.postDataJSON() as Record<string, unknown>;
      configPuts.push(structuredClone(body));
      mutations.push("PUT config");
      // The card submits a legacy draft, not the effective response overlay.
      expect(body).not.toHaveProperty("legacyConfig");
      Object.assign(legacy, body);
      await route.fulfill({ status: 204 });
      return;
    }
    if (url.pathname === "/api/tts/voices" && req.method() === "GET") {
      const id = url.searchParams.get("connectionId")!;
      expect(rows.some((row) => row.id === id)).toBeTruthy();
      voiceReads.push(id);
      const prefix = id === "tts-scope-a" ? "a" : "b";
      await route.fulfill({
        json: {
          voiceOptions: [
            { id: `${prefix}-saved`, name: `${prefix.toUpperCase()} saved` },
            { id: `${prefix}-choice-${revisions[id]}`, name: `${prefix.toUpperCase()} choice ${revisions[id]}` },
          ],
          fromProvider: true,
        },
      });
      return;
    }
    if (url.pathname === "/api/tts/custom-voices" && req.method() === "GET") {
      const id = url.searchParams.get("connectionId")!;
      expect(rows.some((row) => row.id === id)).toBeTruthy();
      managerReads.push(id);
      await route.fulfill({
        json: {
          connectionId: id,
          snapshot: "s1",
          destination: rows.find((row) => row.id === id)!.baseUrl,
          profile: null,
          capability: "unknown",
          voices: [],
          providerVoices: [],
          assignments: {},
        },
      });
      return;
    }
    if (url.pathname === "/api/tts/speak" && req.method() === "POST") {
      speaks.push(req.postDataJSON());
      // Deterministic failure avoids acoustic/playback claims and browser autoplay dependencies.
      await route.fulfill({ status: 502, json: { error: "Mock preview unavailable" } });
      return;
    }
    unexpected.push(`${req.method()} ${url.pathname}`);
    await route.fulfill({ status: 500, json: { error: "Unexpected mocked TTS request" } });
  });
  await page.goto("/");
  await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.setState({ rightPanelOpen: true, rightPanel: "connections", rightPanelWidth: 600 });
  });
  const card = page
    .locator("div.rounded-xl")
    .filter({ has: page.getByText("Text to Speech", { exact: true }) })
    .last();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Expand", exact: true }).click();
  const picker = card.getByRole("combobox", { name: "Default connection for Audio", exact: true });
  const fallback = card.getByRole("combobox", { name: "Fallback connection for Audio", exact: true });
  const voice = card.getByRole("button", { name: "voice", exact: true });
  return {
    card,
    picker,
    fallback,
    voice,
    rows,
    patches,
    configPuts,
    mutations,
    configReads,
    voiceReads,
    managerReads,
    speaks,
    unexpected,
    revisions,
    legacy,
    legacySnapshot,
  };
}

test.describe("TTS card selected backend (fully mocked)", () => {
  test("voice hook follows config cache identity with unchanged props and preserves explicit scopes", async ({
    page,
  }) => {
    const reads: string[] = [];
    await seedUIState(page, { hasCompletedOnboarding: true, chibiProfessorMariEnabled: false });
    await page.route("**/api/tts/config", (route) => route.fulfill({ json: {} }));
    await page.route("**/api/tts/voices*", (route) => {
      const id = new URL(route.request().url()).searchParams.get("connectionId") ?? "legacy";
      reads.push(id);
      return route.fulfill({ json: { voices: [id], source: "openai", fromProvider: true } });
    });
    await page.goto("/");
    await prepareViteFixtureDependencies(page);
    await page.evaluate(async () => {
      const url = window.__viteFixtureDependencyUrl;
      const { default: React } = await import(url("react"));
      const { default: ReactDOM } = await import(url("react-dom_client"));
      const { QueryClient, QueryClientProvider } = await import(url("@tanstack_react-query"));
      const { useTTSVoices } = await import("/src/hooks/use-tts.ts" as string);
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
      qc.setQueryData(["tts", "config"], {});
      const mount = document.createElement("div");
      mount.id = "tts-hook-regression";
      document.body.appendChild(mount);
      mount.addEventListener("scope", (event) => {
        qc.setQueryData(["tts", "config"], { cacheConnectionId: (event as CustomEvent).detail });
      });
      function Voices({ label, connectionId }: { label: string; connectionId?: string }) {
        // No parent config subscriber and no changing props: only the hook can
        // observe the config update. Fresh voice caches must not mask the switch.
        const result = useTTSVoices("openai", "https://same.invalid/v1", true, connectionId);
        return React.createElement("output", { "data-scope": label }, result.data?.voices.join(",") ?? "pending");
      }
      ReactDOM.createRoot(mount).render(
        React.createElement(
          QueryClientProvider,
          { client: qc },
          React.createElement(Voices, { label: "implicit" }),
          React.createElement(Voices, { label: "explicit", connectionId: "explicit" }),
          React.createElement(Voices, { label: "legacy", connectionId: "" }),
        ),
      );
    });
    const fixture = page.locator("#tts-hook-regression");
    await expect(fixture.locator('[data-scope="implicit"]')).toHaveText("legacy");
    await expect(fixture.locator('[data-scope="explicit"]')).toHaveText("explicit");
    await expect(fixture.locator('[data-scope="legacy"]')).toHaveText("legacy");
    for (const id of ["scope-a", "scope-b", "scope-a", ""]) {
      await fixture.evaluate((mount, scope) => mount.dispatchEvent(new CustomEvent("scope", { detail: scope })), id);
      await expect(fixture.locator('[data-scope="implicit"]')).toHaveText(id || "legacy");
      await expect(fixture.locator('[data-scope="explicit"]')).toHaveText("explicit");
      await expect(fixture.locator('[data-scope="legacy"]')).toHaveText("legacy");
    }
    expect(reads.filter((id) => id === "scope-a")).toHaveLength(1);
    expect(reads.filter((id) => id === "scope-b")).toHaveLength(1);
    expect(reads.filter((id) => id === "explicit")).toHaveLength(1);
    expect(reads.filter((id) => id === "legacy")).toHaveLength(1);
  });

  test("disabled legacy parent assignment and narrator lists share selected provider voices without writes", async ({
    page,
  }) => {
    const f = await openCard(page, true, { narratorVoiceEnabled: true });
    await expect(f.picker).toHaveValue("tts-scope-b");
    await expect(f.voice).toContainText("B saved");
    await expect.poll(() => f.voiceReads.length).toBeGreaterThan(0);
    expect(f.legacy.enabled).toBe(false);

    // OpenAI shared controls are accessible comboboxes backed by native datalists,
    // not the selected connection's searchable button/listbox.
    for (const [name, saved] of [
      ["Voice for Character", "legacy-assignment"],
      ["Narrator Voice", "legacy-narrator"],
    ] as const) {
      const input = f.card.getByRole("combobox", { name, exact: true });
      await expect(input).toHaveValue(saved);
      const listId = await input.getAttribute("list");
      expect(listId).toBeTruthy();
      const list = f.card.locator(`datalist[id=${JSON.stringify(listId)}]`);
      await expect(list.locator('option[value="b-saved"]')).toHaveText("B saved (b-saved)");
      await expect(list.locator('option[value="b-choice-1"]')).toHaveText("B choice 1 (b-choice-1)");
      await expect(list.locator('option[value="a-choice-1"]')).toHaveCount(0);
      await expect(list.locator(`option[value=${JSON.stringify(saved)}]`)).toHaveCount(1);
    }
    expect(f.voiceReads.every((id) => id === "tts-scope-b")).toBe(true);
    expect(f.patches).toEqual([]);
    expect(f.configPuts).toEqual([]);
    expect(f.mutations).toEqual([]);
    expect(f.legacy).toEqual(f.legacySnapshot);
    expect(f.managerReads).toEqual([]);
    expect(f.speaks).toEqual([]);
    expect(f.unexpected).toEqual([]);
  });

  test("pending shared-setting debounce survives an immediate connection voice PATCH", async ({ page }) => {
    const f = await openCard(page, true, { allowConfigPut: true });
    await expect(f.voice).toContainText("B saved");
    const rowsBefore = structuredClone(f.rows);
    const dialogues = f.card.getByRole("checkbox", { name: "Only read dialogues", exact: true });
    await expect(dialogues).not.toBeChecked();

    // Schedule the legacy PUT, then patch the connection without waiting for the
    // debounce: connection invalidation must not erase the pending shared draft.
    await dialogues.check();
    await f.voice.click();
    await page.getByRole("option", { name: "B choice 1 (b-choice-1)", exact: true }).click();
    await expect.poll(() => f.patches.length).toBe(1);
    await expect.poll(() => f.configPuts.length).toBe(1);
    await expect
      .poll(() => ({ voice: f.configReads.at(-1)?.voice, dialogueOnly: f.configReads.at(-1)?.dialogueOnly }))
      .toEqual({ voice: "b-choice-1", dialogueOnly: true });
    await expect(dialogues).toBeChecked();
    await expect(f.voice).toContainText("B choice 1");

    expect(f.patches).toEqual([{ id: "tts-scope-b", body: { audioVoice: "b-choice-1" } }]);
    // Prove the PATCH actually occurred inside the pending debounce window.
    expect(f.mutations).toEqual(["PATCH tts-scope-b", "PUT config"]);
    expect(f.configPuts[0]).toMatchObject({ ...f.legacySnapshot, dialogueOnly: true });
    // Full shared saves add defaults; all original legacy fields must survive.
    expect(f.legacy).toMatchObject({ ...f.legacySnapshot, dialogueOnly: true });
    expect(f.rows).toEqual([rowsBefore[0], { ...rowsBefore[1], audioVoice: "b-choice-1" }]);
    expect(f.configReads.at(-1)).toMatchObject({
      source: "openai",
      baseUrl: "http://default.invalid/v1",
      model: "default-model",
      voice: "b-choice-1",
      legacyConfig: { ...f.legacySnapshot, dialogueOnly: true },
    });
    expect(f.voiceReads.every((id) => id === "tts-scope-b")).toBe(true);
    expect(f.managerReads).toEqual([]);
    expect(f.speaks).toEqual([]);
    expect(f.unexpected).toEqual([]);
  });

  for (const role of [true, "true"] as const) {
    test(`saved default (${typeof role}) wins over fallback; clearing restores fallback then legacy`, async ({
      page,
    }) => {
      const f = await openCard(page, role);
      await expect(f.picker).toHaveValue("tts-scope-b");
      await expect(f.fallback).toHaveValue("tts-scope-a");
      await expect(f.card.getByText(/Using Scope Default for speech/)).toBeVisible();
      await expect(f.voice).toContainText("B saved");
      await expect.poll(() => f.voiceReads.length).toBeGreaterThan(0);
      expect(f.voiceReads.every((id) => id === "tts-scope-b")).toBeTruthy();
      expect(f.managerReads).toEqual([]);
      expect(f.patches).toEqual([]);
      expect(f.speaks).toEqual([]);

      await f.picker.selectOption("");
      await expect(f.card.getByText(/Using Scope Fallback for speech/)).toBeVisible();
      await expect(f.voice).toContainText("A saved");
      await expect.poll(() => f.voiceReads.includes("tts-scope-a")).toBeTruthy();
      await f.fallback.selectOption("");
      const legacyInput = f.card.locator('input[placeholder="https://api.openai.com/v1"]');
      await expect(legacyInput).toHaveValue("http://legacy-tts.invalid/v1");
      await expect(f.card.locator('input[placeholder="tts-1"]')).toHaveValue("legacy-model");
      await expect(f.card.getByRole("button", { name: "Manage custom voices", exact: true })).toBeDisabled();
      expect(f.patches).toEqual([
        { id: "tts-scope-b", body: { defaultForAgents: false } },
        { id: "tts-scope-a", body: { fallbackForAgents: false } },
      ]);
      expect(f.legacy).toEqual(f.legacySnapshot);
      expect(f.managerReads).toEqual([]);
      expect(f.speaks).toEqual([]);
      expect(f.unexpected).toEqual([]);
    });
  }

  test("refresh and voice save stay scoped; preview sends exact backend; manager never auto-registers", async ({
    page,
  }) => {
    const f = await openCard(page);
    await expect(f.voice).toContainText("B saved");
    // The titled refresh belongs to legacy character assignments, not the selected connection.
    const refreshVoices = f.card
      .getByRole("button", { name: "Refresh", exact: true })
      .and(f.card.locator("button:not([title])"));
    await expect(refreshVoices).toBeEnabled();
    const readsBefore = f.voiceReads.length;
    f.revisions["tts-scope-b"] = 2;
    await refreshVoices.click();
    await expect.poll(() => f.voiceReads.length).toBeGreaterThan(readsBefore);
    await f.voice.click();
    await expect(page.getByRole("option", { name: "B choice 2 (b-choice-2)", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: "B choice 1 (b-choice-1)", exact: true })).toHaveCount(0);
    await expect(page.getByRole("option", { name: "A choice 1 (a-choice-1)", exact: true })).toHaveCount(0);
    await page.getByRole("option", { name: "B choice 2 (b-choice-2)", exact: true }).click();
    await expect(f.voice).toContainText("B choice 2");
    expect(f.patches).toEqual([{ id: "tts-scope-b", body: { audioVoice: "b-choice-2" } }]);
    expect(f.rows[0]!.audioVoice).toBe("a-saved");
    expect(f.rows[1]!.audioVoice).toBe("b-choice-2");
    expect(f.legacy).toEqual(f.legacySnapshot);
    expect(f.speaks).toEqual([]);
    expect(f.managerReads).toEqual([]);

    await f.card.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.getByText("Mock preview unavailable", { exact: true })).toBeVisible();
    expect(f.speaks).toEqual([
      {
        text: "Hello! This is a preview of the text to speech voice.",
        voice: "b-choice-2",
        audioConnectionId: "tts-scope-b",
      },
    ]);
    await f.card.getByRole("button", { name: "Manage custom voices", exact: true }).click();
    await expect(page.getByRole("dialog").getByText("http://default.invalid/v1", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog").locator("#cvm-profile")).toHaveValue("");
    await f.picker.selectOption("", { force: true });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(f.voice).toContainText("A saved");
    await f.voice.click();
    await expect(page.getByRole("option", { name: "A choice 1 (a-choice-1)", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: "B choice 2 (b-choice-2)", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    // Development StrictMode may replay the read-only mount effect.
    expect(f.managerReads.length).toBeGreaterThan(0);
    expect(f.managerReads.every((id) => id === "tts-scope-b")).toBe(true);
    expect(f.voiceReads).toContain("tts-scope-a");
    expect(f.patches.filter((patch) => "audioVoice" in patch.body)).toEqual([
      { id: "tts-scope-b", body: { audioVoice: "b-choice-2" } },
    ]);
    expect(f.legacy).toEqual(f.legacySnapshot);
    expect(f.unexpected).toEqual([]);
  });
});
