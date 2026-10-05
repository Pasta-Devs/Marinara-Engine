import { expect, test, type APIRequestContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createChatSummaryEntry } from "@marinara-engine/shared";
import { seedUIState } from "./ui-state-fixture.js";
import { chatSettingsWindow, openChatSettingsTool } from "./chat-settings-tools.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("summary toggles keep other entries usable and toggle all in one save", async ({ page, request }, info) => {
  const created = await request.post("/api/chats", { data: { name: "Summary controls", mode: "roleplay" } });
  expect(created.ok()).toBeTruthy();
  const { id } = await created.json();
  const entries = Array.from({ length: 19 }, (_, index) =>
    createChatSummaryEntry({
      id: `summary-${index}`,
      title: `Summary ${index + 1}`,
      content: "Historical facts. ".repeat(1800),
      enabled: true,
      sourceMode: "range",
      rangeStartIndex: index * 50 + 1,
      rangeEndIndex: (index + 1) * 50,
    }),
  );
  expect((await request.patch(`/api/chats/${id}/metadata`, { data: { summaryEntries: entries } })).ok()).toBeTruthy();
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const saves: Array<{ operation: string; entryIds?: string[] }> = [];
  await page.route(`**/api/chats/${id}/summary-entries`, async (route) => {
    saves.push(route.request().postDataJSON());
    if (saves.length === 1) await gate;
    await route.continue();
  });
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id, version },
    );
    await page.goto("/");
    const panel = await openChatSettingsTool(page, "chat-summary");
    await expect(panel.locator(".mari-drawer__count")).toHaveText("19");
    const toggles = panel.getByRole("button", { name: "Disable summary", exact: true });
    await expect(toggles).toHaveCount(19);
    await toggles.nth(0).click();
    await expect.poll(() => saves.length).toBe(1);
    await expect(toggles.nth(0)).toBeDisabled();
    await expect(toggles.nth(1)).toBeEnabled();
    await panel.getByRole("button", { name: "Expand summary entry", exact: true }).nth(1).click();
    await expect(panel.getByRole("button", { name: "Collapse summary entry", exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("summary-toggle-other-rows-usable.png") });
    release!();
    await expect(toggles).toHaveCount(18);
    await panel.getByRole("button", { name: "Deactivate All", exact: true }).click();
    await expect.poll(() => saves.length).toBe(2);
    expect(saves[1]!.entryIds).toHaveLength(18);
    await expect(panel.getByRole("button", { name: "Activate All", exact: true })).toBeEnabled();
    await panel.getByRole("button", { name: "Activate All", exact: true }).click();
    await expect(toggles).toHaveCount(19);
    expect(saves).toHaveLength(3);
    expect(saves[2]!.entryIds).toHaveLength(19);
    const metadata = (await (await request.get(`/api/chats/${id}`)).json()).metadata;
    expect(metadata.summaryEntries.every((entry: { enabled: boolean }) => entry.enabled)).toBe(true);
  } finally {
    release?.();
    await request.delete(`/api/chats/${id}?force=true`);
  }
});

// #7029: the range fields showed two or three digits, in half the footer, behind an accent border.
test("Chat Summary range fields fit long message numbers in a quiet box", async ({ page, request }, info) => {
  const created = await request.post("/api/chats", { data: { name: "Summary ranges", mode: "roleplay" } });
  expect(created.ok()).toBeTruthy();
  const { id } = await created.json();
  for (let index = 0; index < 3; index += 1) {
    const message = { role: index % 2 ? "assistant" : "user", content: `Line ${index + 1}` };
    expect((await request.post(`/api/chats/${id}/messages`, { data: message })).ok()).toBeTruthy();
  }
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
      // Range mode remembers one range for every chat; this one was picked in a longer chat.
      summaryPopoverSettings: {
        sourceMode: "range",
        contextSize: null,
        rangeStart: 559,
        rangeEnd: 679,
        hideSummarisedMessages: false,
        collapseHiddenMessages: false,
      },
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id, version },
    );
    await page.goto("/");
    // Chat Summary is a Chat Settings drawer (#7034).
    const panel = await openChatSettingsTool(page, "chat-summary");
    const range = panel.getByRole("group", { name: "Range 1", exact: true });
    const from = range.getByRole("spinbutton", { name: "Range 1 from message", exact: true });
    const to = range.getByRole("spinbutton", { name: "Range 1 to message", exact: true });
    const outside = range.getByText("This range is outside the chat history.", { exact: true });
    // It opens on this chat's messages, not as an error.
    await expect.soft(from).toHaveValue("1");
    await expect.soft(to).toHaveValue("3");
    await expect.soft(outside).toBeHidden();

    await from.fill("1234");
    await to.fill("12345");
    await expect(outside).toBeVisible();
    // A range outside the chat selects nothing, as the header says for several ranges.
    await expect.soft(panel.getByText("0 messages selected", { exact: true })).toBeVisible();
    for (const field of [from, to]) {
      expect.soft(await field.evaluate((input) => input.scrollWidth <= input.clientWidth)).toBe(true);
    }
    const layout = await range.evaluate((box) => {
      const summary = box.closest("[data-chat-summary]")!;
      const scope = [...summary.querySelectorAll("p")].find(
        (label) => label.textContent === "Summary Scope",
      )!.parentElement!;
      return {
        border: getComputedStyle(box).borderTopColor,
        sectionBorder: getComputedStyle(scope).borderTopColor,
        widthShare: box.getBoundingClientRect().width / summary.getBoundingClientRect().width,
      };
    });
    // The same quiet border as the window's sections, even for a range that needs fixing,
    // and the range spans the summary section instead of its left half.
    expect.soft(layout.border).toBe(layout.sectionBorder);
    expect.soft(layout.widthShare).toBeGreaterThan(0.8);
    await page.screenshot({ path: info.outputPath("summary-range-fields.png") });
    // Escape dismisses the template choices without closing the surrounding settings window.
    const template = panel.getByRole("button", { name: "Summary prompt template", exact: true });
    await template.click();
    const choices = panel.getByRole("listbox");
    await expect(choices).toBeVisible();
    await choices.getByRole("option").first().focus();
    await page.keyboard.press("Escape");
    await expect(choices).toHaveCount(0);
    await expect(panel).toBeVisible();
    await expect(template).toBeFocused();
  } finally {
    await request.delete(`/api/chats/${id}?force=true`);
  }
});

// Until the message count arrives, the chat looks only as long as its loaded messages.
test("Chat Summary keeps a remembered range when the message count arrives late", async ({ page, request }, info) => {
  const created = await request.post("/api/chats", { data: { name: "Summary late count", mode: "roleplay" } });
  expect(created.ok()).toBeTruthy();
  const { id } = await created.json();
  for (let index = 0; index < 12; index += 1) {
    const message = { role: index % 2 ? "assistant" : "user", content: `Line ${index + 1}` };
    expect((await request.post(`/api/chats/${id}/messages`, { data: message })).ok()).toBeTruthy();
  }
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
      messagesPerPage: 5,
      summaryPopoverSettings: {
        sourceMode: "range",
        contextSize: null,
        rangeStart: 7,
        rangeEnd: 10,
        hideSummarisedMessages: false,
        collapseHiddenMessages: false,
      },
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id, version },
    );
    const openWithLateCount = async () => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.unroute(`**/api/chats/${id}/message-count`);
      await page.route(`**/api/chats/${id}/message-count`, async (route) => {
        await gate;
        await route.continue();
      });
      await page.goto("/");
      const panel = await openChatSettingsTool(page, "chat-summary");
      const from = panel.getByRole("spinbutton", { name: "Range 1 from message", exact: true });
      const to = panel.getByRole("spinbutton", { name: "Range 1 to message", exact: true });
      await expect(from).toBeVisible();
      return { panel, from, to, release };
    };

    const late = await openWithLateCount();
    late.release();
    await expect.soft(late.from).toHaveValue("7");
    await expect.soft(late.to).toHaveValue("10");

    // A range you already changed stays as you left it.
    const edited = await openWithLateCount();
    await edited.from.fill("2");
    await edited.from.blur();
    const editedTo = await edited.to.inputValue();
    edited.release();
    // The fields take the chat's real length, then any update from it has had a frame to land.
    await expect(edited.from).toHaveAttribute("max", "12");
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 50))));
    await expect.soft(edited.from).toHaveValue("2");
    await expect.soft(edited.to).toHaveValue(editedTo);

    // Switching to Range starts on the Last window, the same as when the count is already known.
    const switched = await openWithLateCount();
    await switched.panel.getByRole("button", { name: "Last", exact: true }).click();
    await expect(switched.from).toBeHidden();
    await switched.panel.getByRole("button", { name: "Range", exact: true }).click();
    await expect(switched.from).toBeVisible();
    switched.release();
    await expect(switched.from).toHaveAttribute("max", "12");
    await expect.soft(switched.from).toHaveValue("1");
    await expect.soft(switched.to).toHaveValue("12");

    // Nor is resting in a field: it catches up once you leave it.
    const focused = await openWithLateCount();
    await focused.from.focus();
    focused.release();
    await expect(focused.from).toHaveAttribute("max", "12");
    await focused.from.blur();
    await expect.soft(focused.from).toHaveValue("7");
    await expect.soft(focused.to).toHaveValue("10");
    await page.screenshot({ path: info.outputPath("summary-range-late-count.png") });
  } finally {
    await request.delete(`/api/chats/${id}?force=true`);
  }
});

/** Playwright has no software keyboard. iPhone Safari shrinks only the visual viewport for it. */
async function installIphoneKeyboard(page: Page) {
  await page.addInitScript(() => {
    let keyboardTop: number | null = null;
    const viewport = new EventTarget();
    Object.defineProperties(viewport, {
      height: { get: () => keyboardTop ?? window.innerHeight },
      width: { get: () => window.innerWidth },
      offsetTop: { get: () => 0 },
      pageTop: { get: () => 0 },
      offsetLeft: { get: () => 0 },
      pageLeft: { get: () => 0 },
      scale: { get: () => 1 },
    });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    Object.defineProperty(window, "__setKeyboardTop", {
      value: (top: number | null) => {
        keyboardTop = top;
        viewport.dispatchEvent(new Event("resize"));
      },
    });
  });
}

test("Chat Summary keeps the field being edited above the phone keyboard", ({ page, request }, info) =>
  keepsFieldAboveKeyboard(page, request, info, false));

// Turned sideways, a summary is taller than the room left above the keyboard.
// A sideways phone is wide enough for the Chat Settings window, which fits above the keyboard while you type.
test("Chat Summary keeps the field being edited above the phone keyboard in landscape", ({ page, request }, info) =>
  keepsFieldAboveKeyboard(page, request, info, true));

async function keepsFieldAboveKeyboard(page: Page, request: APIRequestContext, info: TestInfo, landscape: boolean) {
  test.skip(!info.project.name.startsWith("mobile"), "Only phones have an on-screen keyboard.");
  const iPhone = info.project.name === "mobile-webkit";
  const created = await request.post("/api/chats", { data: { name: "Summary keyboard", mode: "roleplay" } });
  expect(created.ok()).toBeTruthy();
  const { id } = await created.json();
  const entries = Array.from({ length: 4 }, (_, index) =>
    createChatSummaryEntry({
      id: `keyboard-summary-${index}`,
      title: `Summary ${index + 1}`,
      content: "The caravan crossed the dunes at dusk. ".repeat(12),
      enabled: true,
      sourceMode: "range",
      rangeStartIndex: index * 10 + 1,
      rangeEndIndex: (index + 1) * 10,
    }),
  );
  expect((await request.patch(`/api/chats/${id}/metadata`, { data: { summaryEntries: entries } })).ok()).toBeTruthy();
  for (let index = 0; index < 5; index += 1) {
    const message = { role: index % 2 ? "assistant" : "user", content: `Line ${index + 1}` };
    expect((await request.post(`/api/chats/${id}/messages`, { data: message })).ok()).toBeTruthy();
  }
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id, version },
    );
    if (iPhone) await installIphoneKeyboard(page);
    const upright = page.viewportSize()!;
    if (landscape) await page.setViewportSize({ width: upright.height, height: upright.width });
    await page.goto("/");
    // Chat Summary is a drawer in Chat Settings: a sheet upright, a window when the phone is wide enough.
    await openChatSettingsTool(page, "chat-summary");
    const panel = chatSettingsWindow(page);
    await expect(panel).toBeVisible();

    const phone = page.viewportSize()!;
    // The keyboard covers about half of a phone turned sideways.
    const keyboardTop = Math.round(phone.height * (landscape ? 0.5 : 0.6));
    // Android shrinks the page for the keyboard; iPhone shrinks only what is visible.
    const setKeyboard = async (open: boolean) => {
      if (iPhone) {
        await page.evaluate(
          (top) => (window as typeof window & { __setKeyboardTop: (top: number | null) => void }).__setKeyboardTop(top),
          open ? keyboardTop : null,
        );
      } else {
        await page.setViewportSize(open ? { width: phone.width, height: keyboardTop } : phone);
      }
      const html = page.locator("html");
      if (open) await expect(html).toHaveAttribute("data-mari-software-keyboard-open", "");
      else await expect(html).not.toHaveAttribute("data-mari-software-keyboard-open");
    };
    // The field's first lines show above the keyboard, not scrolled out of the window around them.
    const showsAboveKeyboard = (field: Locator) =>
      field.evaluate((element, top) => {
        const box = element.getBoundingClientRect();
        return [box.top + 8, box.top + Math.min(box.height - 8, 56)].every((y) => {
          const hit = y > 0 && y < top && document.elementFromPoint(box.left + box.width / 2, y);
          return !!hit && (hit === element || element.contains(hit));
        });
      }, keyboardTop);
    // Focus a field low on the screen, where the keyboard will appear, then open the keyboard.
    const typeIn = async (name: string, field: Locator) => {
      await field.evaluate((element) => element.scrollIntoView({ block: "end" }));
      await field.focus();
      const before = (await field.boundingBox())!;
      expect(before.y + before.height, "the keyboard would cover the field").toBeGreaterThan(keyboardTop);
      await setKeyboard(true);
      await expect.poll(() => showsAboveKeyboard(field)).toBe(true);
      await page.screenshot({ path: info.outputPath(`keyboard-${name}.png`) });
      // The window fits above the keyboard, and scrolling it away from the field is not undone
      // by the next viewport update, so everything else is still a scroll away.
      const frame = (await panel.boundingBox())!;
      expect(frame.y + frame.height).toBeLessThanOrEqual(keyboardTop + 1);
      const scrollTopAfterUpdate = await panel.evaluate(async (element) => {
        // The window's own scroll area is the first one inside it.
        const area = [...element.querySelectorAll("*")].find(
          (node) => node.scrollHeight > node.clientHeight && /auto|scroll/.test(getComputedStyle(node).overflowY),
        )!;
        area.scrollTop = 0;
        window.dispatchEvent(new Event("resize"));
        await new Promise((resolve) => setTimeout(resolve, 300));
        return area.scrollTop;
      });
      expect(scrollTopAfterUpdate).toBe(0);
      await setKeyboard(false);
    };

    const summaryField = panel.getByRole("textbox", { name: "Write or paste a summary of this chat...", exact: true });
    // A finger tap, as a phone sends it, while typing in the controls at the bottom. It lands where
    // the finger is, even when it moves focus out of them. WebKit blurs the field on mousedown and
    // the window leaves its keyboard layout before the click, so there the tap is dropped, but it
    // must not press what moves under the finger.
    const tap = async (target: Locator) => {
      const box = (await target.boundingBox())!;
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await expect(panel.getByRole("checkbox", { checked: true })).toHaveCount(0);
    };
    if (!landscape) {
      // Here the tap moves focus into the summary list, scrolled to its end.
      await panel.getByLabel("Messages", { exact: true }).focus();
      await setKeyboard(true);
      const lastEdit = panel.getByRole("button", { name: "Edit summary entry", exact: true }).last();
      await lastEdit.evaluate((element) => element.scrollIntoView({ block: "center" }));
      await tap(lastEdit);
      if (!iPhone) await expect(summaryField).toBeFocused();
      await setKeyboard(false);
      const cancel = panel.getByRole("button", { name: "Cancel", exact: true });
      if (await cancel.isVisible()) await cancel.click();
    }

    await panel.getByRole("button", { name: "Edit summary entry", exact: true }).last().click();
    await expect(summaryField).toBeFocused();
    await typeIn("summary", summaryField);
    await typeIn("title", panel.getByPlaceholder("Summary title", { exact: true }));
    await panel.getByRole("button", { name: "Cancel", exact: true }).click();

    await panel.getByRole("button", { name: "Edit", exact: true }).click();
    await typeIn(
      "prompt",
      panel.getByRole("textbox", { name: "Prompt instructions for summary generation...", exact: true }),
    );

    // Sideways, message ranges fill the window before the keyboard opens, so they are checked upright.
    if (landscape) return;
    // Message ranges stay listed under the summaries after a run, and with several of them those
    // controls alone are taller than the room the keyboard leaves. They scroll with the drawer, so the
    // field being typed in still shows.
    await panel.getByRole("button", { name: "Range", exact: true }).click();
    const addRange = panel.getByRole("button", { name: "Add range", exact: true });
    await panel.getByRole("spinbutton", { name: "Range 1 to message", exact: true }).fill("1");
    await setKeyboard(true);
    // The range controls scroll with the drawer, so the finger finds Add range where it shows.
    await addRange.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await tap(addRange);
    if (!iPhone) await expect(panel.getByRole("spinbutton", { name: "Range 2 to message", exact: true })).toBeVisible();
    await setKeyboard(false);
    const rangeEnds = panel.getByRole("spinbutton", { name: /^Range \d+ to message$/ });
    while ((await rangeEnds.count()) < 5) await addRange.click();
    await panel.getByRole("button", { name: "Edit summary entry", exact: true }).last().click();
    await expect(summaryField).toBeFocused();
    await setKeyboard(true);
    await expect.poll(() => showsAboveKeyboard(summaryField)).toBe(true);
    await page.screenshot({ path: info.outputPath("keyboard-summary-ranges.png") });
    // A field in those controls keeps them in view.
    await setKeyboard(false);
    const lastRangeEnd = panel.getByRole("spinbutton", { name: "Range 5 to message", exact: true });
    await lastRangeEnd.focus();
    await setKeyboard(true);
    await expect(lastRangeEnd).toBeFocused();
    await expect.poll(() => showsAboveKeyboard(lastRangeEnd)).toBe(true);
  } finally {
    await request.delete(`/api/chats/${id}?force=true`);
  }
}
