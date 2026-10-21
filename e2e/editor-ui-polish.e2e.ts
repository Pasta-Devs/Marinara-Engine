import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;
const ACCENT = "#36cdde";
type Kind = "character" | "persona" | "lorebook" | "preset" | "connection" | "agent";
const paths: Record<Kind, string> = {
  character: "/api/characters",
  persona: "/api/characters/personas",
  lorebook: "/api/lorebooks",
  preset: "/api/prompts",
  connection: "/api/connections",
  agent: "/api/agents",
};

async function prepare(page: Page) {
  await isolateSyncedUISettings(page);
  await page.route("**/api/access/status", (route) =>
    route.fulfill({
      json: {
        loopbackOnly: true,
        host: "127.0.0.1",
        basicAuth: false,
        adminSecret: false,
        allowlist: false,
        passwordlessPeers: [],
        loginKeepsOpen: [],
        viaProxy: false,
      },
    }),
  );
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    appAccentPulseMode: false,
    appAccentColor: ACCENT,
    theme: "dark",
  });
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), APP_VERSION);
  await page.goto("/");
  await expect(page.locator('[data-component="AppShell"]')).toBeVisible();
}

async function open(page: Page, kind: Kind, id: string) {
  await page.evaluate(
    async ({ kind, id }) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      const state = useUIStore.getState();
      if (kind === "character") state.openCharacterDetail(id);
      else if (kind === "persona") state.openPersonaDetail(id);
      else if (kind === "lorebook") state.openLorebookDetail(id);
      else if (kind === "preset") state.openPresetDetail(id);
      else if (kind === "connection") state.openConnectionDetail(id);
      else state.openAgentDetail(id);
    },
    { kind, id },
  );
  const editor = page.locator(".mari-editor-shell").filter({ visible: true });
  await expect(editor).toHaveCount(1);
  return editor;
}

async function create(request: APIRequestContext, kind: Kind, data: Record<string, unknown>) {
  const response = await request.post(paths[kind], { data });
  expect(response.ok(), await response.text()).toBeTruthy();
  return ((await response.json()) as { id: string }).id;
}

async function expectAccent(button: Locator) {
  await expect(button).toBeVisible();
  const colors = await button.evaluate((element) => {
    const expected = document.createElement("span");
    expected.style.color = "var(--marinara-editor-accent)";
    element.append(expected);
    const result = { actual: getComputedStyle(element).color, expected: getComputedStyle(expected).color };
    expected.remove();
    return result;
  });
  expect(colors.actual).toBe(colors.expected);
}

async function expectAccentBorder(container: Locator) {
  const colors = await container.evaluate((element) => {
    const expected = document.createElement("span");
    expected.style.borderColor = "color-mix(in oklab, var(--marinara-chat-chrome-accent) 40%, transparent)";
    element.append(expected);
    const result = {
      actual: getComputedStyle(element).borderBottomColor,
      expected: getComputedStyle(expected).borderBottomColor,
    };
    expected.remove();
    return result;
  });
  expect(colors.actual).toBe(colors.expected);
}

test("all six editors share the dark sidebar surface and preserve theme overrides", async ({ page, request }, info) => {
  const entries: [Kind, string][] = [];
  try {
    entries.push(["character", await create(request, "character", { data: { name: "Editor surface character" } })]);
    entries.push(["persona", await create(request, "persona", { name: "Editor surface persona" })]);
    entries.push(["lorebook", await create(request, "lorebook", { name: "Editor surface lorebook" })]);
    entries.push(["preset", await create(request, "preset", { name: "Editor surface preset" })]);
    entries.push([
      "connection",
      await create(request, "connection", {
        name: "Editor surface connection",
        provider: "openai",
        model: "gpt-4.1",
        apiKey: "fixture",
        baseUrl: "http://127.0.0.1:9/v1",
      }),
    ]);
    entries.push([
      "agent",
      await create(request, "agent", {
        name: "Editor surface agent",
        type: "editor-surface-fixture",
        phase: "pre_generation",
        promptTemplate: "Fixture.",
      }),
    ]);
    await prepare(page);
    for (const [kind, id] of entries) {
      const editor = await open(page, kind, id);
      await expect
        .poll(() =>
          editor.evaluate((element) => {
            const probe = document.createElement("span");
            probe.style.backgroundColor = "var(--sidebar)";
            element.append(probe);
            const matches = getComputedStyle(element).backgroundColor === getComputedStyle(probe).backgroundColor;
            probe.remove();
            return matches;
          }),
        )
        .toBe(true);
      await editor.screenshot({ path: info.outputPath(`${kind}-dark.png`), animations: "disabled" });
    }
    const editor = await open(page, "character", entries[0]![1]);
    for (const [theme, visualTheme] of [
      ["light", "default"],
      ["dark", "sillytavern"],
    ] as const) {
      await page.evaluate(
        async ({ theme, visualTheme }) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setTheme(theme);
          useUIStore.getState().setVisualTheme(visualTheme);
        },
        { theme, visualTheme },
      );
      await expect
        .poll(() =>
          editor.evaluate((element) => {
            const probe = document.createElement("span");
            probe.style.backgroundColor = "var(--background)";
            element.append(probe);
            const same = getComputedStyle(element).backgroundColor === getComputedStyle(probe).backgroundColor;
            probe.remove();
            return same;
          }),
        )
        .toBe(true);
      await editor.screenshot({
        path: info.outputPath(`character-${theme}-${visualTheme}.png`),
        animations: "disabled",
      });
    }
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().setVisualTheme("default");
      const style = document.createElement("style");
      style.textContent = ":root { --marinara-editor-bg: rgb(40, 50, 60); }";
      document.head.append(style);
    });
    await expect(editor).toHaveCSS("background-color", "rgb(40, 50, 60)");
  } finally {
    for (const [kind, id] of entries.reverse()) await request.delete(`${paths[kind]}/${id}`).catch(() => undefined);
  }
});

for (const kind of ["character", "persona"] as const) {
  test(`${kind} editor uses compact avatar words, accent actions, and centered alternative status`, async ({
    page,
    request,
  }, info) => {
    const fields = {
      name: `Polished ${kind}`,
      tags: ["fixture"],
      description: "First revision.",
      summary: "Fixture summary.",
      mes_example: "Example dialogue.",
    };
    const id = await create(
      request,
      kind,
      kind === "character"
        ? { data: { ...fields, first_mes: "First greeting.", alternate_greetings: ["Alternative greeting."] } }
        : fields,
    );
    try {
      const update = await request.patch(`${paths[kind]}/${id}`, {
        data:
          kind === "character" ? { data: { description: "Second revision." } } : { description: "Second revision." },
      });
      expect(update.ok(), await update.text()).toBeTruthy();
      const image = await request.post(`${paths[kind]}/${id}/avatar`, {
        data: {
          avatar:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=",
        },
      });
      expect(image.ok(), await image.text()).toBeTruthy();
      await prepare(page);
      const editor = await open(page, kind, id);
      const full = editor.getByRole("button", { name: "Full", exact: true });
      const remove = editor.getByTitle("Remove avatar", { exact: true });
      await full.scrollIntoViewIfNeeded();
      await expect(full).toBeVisible();
      await expect(full.locator("svg")).toHaveCount(0);
      if (kind === "character") {
        await expect(remove.locator("svg")).toHaveCount(0);
        await expectAccent(remove);
      }
      const geometry = await full.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const bounds = element.getBoundingClientRect();
        return { lines: range.getClientRects().length, left: bounds.left, right: bounds.right, viewport: innerWidth };
      });
      expect(geometry.lines).toBe(1);
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(geometry.viewport);
      await page.screenshot({ path: info.outputPath(`${kind}-avatar.png`), animations: "disabled" });
      const deleteVersion = editor.getByRole("button", { name: "Delete this saved version", exact: true }).first();
      await deleteVersion.scrollIntoViewIfNeeded();
      await expectAccent(deleteVersion);
      const tags = editor.getByRole("button", { name: "Remove All", exact: true });
      await tags.scrollIntoViewIfNeeded();
      await expect(tags).toHaveClass(/mari-editor-action/u);
      const compact = editor.getByRole("button", { name: "Editor sections", exact: true });
      if (await compact.isVisible()) {
        await compact.click();
        await editor
          .getByRole("menu", { name: "Editor sections", exact: true })
          .getByRole("menuitemradio", { name: "Card", exact: true })
          .click();
      } else {
        await editor
          .getByRole("navigation", { name: "Editor sections", exact: true })
          .getByRole("button", { name: "Card", exact: true })
          .click();
      }
      const summary = editor.locator(`#${kind}-card-summary`);
      await summary.getByRole("button", { name: "Add Alternative Field", exact: true }).click();
      const status = summary.locator("summary").filter({ hasText: "Active in 0 chats" });
      await expect(status).toBeVisible();
      const centers = await status.evaluate((element) => {
        const outer = element.getBoundingClientRect();
        const text = element.querySelector("span")!.getBoundingClientRect();
        return { outer: outer.y + outer.height / 2, text: text.y + text.height / 2 };
      });
      expect(Math.abs(centers.outer - centers.text)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: info.outputPath(`${kind}-alternative.png`), animations: "disabled" });
      if (kind === "character") {
        const add = editor.getByRole("button", { name: "+ Add", exact: true });
        await add.scrollIntoViewIfNeeded();
        await expect(add).toHaveClass(/mari-editor-action/u);
        const deleteGreeting = editor.getByRole("button", { name: "Remove alternate greeting 1", exact: true });
        await deleteGreeting.scrollIntoViewIfNeeded();
        await expectAccent(deleteGreeting);
        await page.screenshot({ path: info.outputPath("character-greetings.png"), animations: "disabled" });
      }
    } finally {
      await request.delete(`${paths[kind]}/${id}`).catch(() => undefined);
    }
  });
}

test("stock preset copy action stays centered", async ({ page, request }, info) => {
  const response = await request.get("/api/prompts");
  const presets = (await response.json()) as { id: string; name: string }[];
  const stock = presets.find((preset) => /Marinara.*Universal/u.test(preset.name));
  expect(stock).toBeTruthy();
  await prepare(page);
  const editor = await open(page, "preset", stock!.id);
  const button = editor.getByRole("button", { name: "Create editable copy", exact: true });
  await expect(button).toBeVisible();
  const align = await button.evaluate((element) => {
    const button = element.getBoundingClientRect();
    const row = element.parentElement!.getBoundingClientRect();
    const controls = Array.from(element.parentElement!.children).map((child) => child.getBoundingClientRect());
    return {
      buttonCenter: button.x + button.width / 2,
      rowCenter: row.x + row.width / 2,
      wrapped: Math.abs(controls[0]!.y - button.y) > 2,
    };
  });
  if (align.wrapped) expect(Math.abs(align.buttonCenter - align.rowCenter)).toBeLessThanOrEqual(1);
  await expect(button).toHaveCSS("margin-right", "0px");
  await page.screenshot({ path: info.outputPath("stock-preset-copy.png"), animations: "disabled" });
});

for (const peer of ["privateNetwork", "internet"] as const) {
  test(`${peer} access warning and settings follow the chosen accent`, async ({ page }, info) => {
    await prepare(page);
    await page.route("**/api/access/status", (route) =>
      route.fulfill({
        json: {
          loopbackOnly: false,
          host: "0.0.0.0",
          basicAuth: false,
          adminSecret: false,
          allowlist: false,
          passwordlessPeers: [peer],
          loginKeepsOpen: [],
          viaProxy: false,
        },
      }),
    );
    await page.reload();
    const banner = page
      .locator(".fixed.inset-x-0.top-0")
      .filter({ has: page.getByText("Others can open Marinara without a password", { exact: true }) });
    await expect(banner).toBeVisible();
    const icon = banner.locator("svg").first();
    await expect(icon).toHaveCSS("color", "rgb(54, 205, 222)");
    const tint = banner.locator(".border-b");
    await expectAccentBorder(tint);
    await page.screenshot({ path: info.outputPath(`access-${peer}-banner.png`), animations: "disabled" });
    await banner.getByRole("button", { name: "Review access", exact: true }).click();
    await banner.getByRole("button", { name: "Dismiss", exact: true }).click();
    const settings = page.locator("#settings-section-access-status");
    await expect(settings).toBeVisible();
    const warning = settings.locator(".rounded-lg.border").filter({ hasText: "can open Marinara" }).first();
    await expectAccentBorder(warning);
    await page.screenshot({ path: info.outputPath(`access-${peer}-settings.png`), animations: "disabled" });
  });
}
