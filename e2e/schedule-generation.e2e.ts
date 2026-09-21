import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { CONVERSATION_SCHEDULE_DAYS, type WeekSchedule } from "@marinara-engine/shared";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
for (const theme of ["dark", "light"] as const) {
  test(`Schedule errors preserve drafts and daily requests assemble one week (${theme})`, async ({
    page,
    request,
  }, info) => {
    test.setTimeout(120_000);
    const name = `Schedule ${theme} ${info.project.name} ${Date.now().toString(36)}`;
    const schedule: WeekSchedule = {
      weekStart: "2026-01-05T00:00:00.000Z",
      talkativeness: 37,
      inactivityThresholdMinutes: 85,
      days: Object.fromEntries(
        CONVERSATION_SCHEDULE_DAYS.map((day) => [
          day,
          [{ time: "00:00-00:00", activity: "Original routine", status: "online" }],
        ]),
      ),
    };
    const created = await request.post("/api/characters", {
      data: { data: { name, extensions: { conversationSchedule: schedule } } },
    });
    expect(created.ok()).toBeTruthy();
    const character = await created.json();
    const connectionRows = [
      {
        id: "default-schedule-fixture",
        name: "Default language",
        model: "default-model",
        provider: "custom",
        isDefault: "true",
      },
      { id: "chosen-schedule-fixture", name: "Local schedule model", model: "chosen-model", provider: "custom" },
      { id: "image-fixture", name: "Image connection", provider: "image_generation" },
      { id: "quarantined-fixture", name: "Unreviewed import", provider: "custom", profileImportReviewRequired: "true" },
    ];
    await page.route("**/api/connections", (route) => route.fulfill({ json: connectionRows }));
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: true,
      rightPanelOpen: false,
      theme,
      appAccentPulseMode: false,
    });
    await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
    await page.addInitScript(() => {
      const fetch = window.fetch;
      window.fetch = (input, options) => {
        const request = input instanceof Request ? input : null;
        if ((request?.url ?? String(input)).includes("/api/conversation/schedule/"))
          (window as unknown as { scheduleRequestSignal?: AbortSignal | null }).scheduleRequestSignal =
            options?.signal ?? request?.signal;
        return fetch(input, options);
      };
    });
    type DraftRequest = {
      mode: string;
      day?: string;
      connectionId?: string;
      draftMode?: string;
      schedule: WeekSchedule;
    };
    let calls: DraftRequest[] = [];
    let failDay: string | null = "week";
    const pendingRequest: { release?: () => void } = {};
    let pauseRequests = false;
    let cancelledFixture = false;
    let newWeekStart = "2026-09-14T00:00:00.000Z";
    await page.route("**/api/conversation/schedule/draft", async (route) => {
      const body = route.request().postDataJSON() as DraftRequest;
      const activity = `${cancelledFixture ? "Cancelled" : "New"} ${body.day}`;
      calls.push(body);
      if (pauseRequests)
        await new Promise<void>((resolve) => {
          pendingRequest.release = resolve;
        });
      if (failDay === body.day || failDay === body.mode) {
        await route.fulfill({
          status: 502,
          json: {
            error: "The model returned invalid schedule JSON. Try again or choose another model.",
            rawResponse: '{"days":',
          },
        });
      } else if (body.mode === "day") {
        await route.fulfill({
          json: {
            day: body.day,
            weekStart: newWeekStart,
            blocks: [{ time: "00:00-00:00", activity, status: "online" }],
          },
        });
      } else {
        await route.fulfill({ json: { schedule: { ...body.schedule, weekStart: newWeekStart } } });
      }
    });
    await page.route("**/api/conversation/schedule/summary", async (route) => {
      await new Promise<void>((resolve) => {
        pendingRequest.release = resolve;
      });
      await route.fulfill({ json: { summary: "Cancelled summary", generatedAt: new Date().toISOString() } });
    });
    const storedSchedule = async () => {
      const row = await (await request.get(`/api/characters/${character.id}`)).json();
      return (typeof row.data === "string" ? JSON.parse(row.data) : row.data).extensions
        .conversationSchedule as WeekSchedule;
    };
    try {
      await page.goto("/");
      await page.getByRole("button", { name: "Character Schedule Manager", exact: true }).click();
      const manager = page.getByRole("dialog", { name: "Character Schedule Manager", exact: true });
      await manager.getByRole("button", { name: `Edit ${name} schedule`, exact: true }).click();
      const dialog = page.getByRole("dialog", { name: `Edit ${name} Schedule`, exact: true });
      await dialog.getByText("Schedule AI", { exact: true }).click();
      const weekButton = dialog.getByRole("button", { name: "Adjust week", exact: true });
      await weekButton.click();
      await expect(dialog.getByRole("alert")).toContainText("Generation failed. Your draft has been kept.");
      await expect(dialog.getByRole("alert")).toContainText("invalid schedule JSON");
      await expect(weekButton).toBeEnabled();
      expect(calls).toHaveLength(1);
      expect(calls[0]?.mode).toBe("week");
      expect(calls[0]?.connectionId).toBe("default-schedule-fixture");
      await page.screenshot({ path: info.outputPath(`schedule-error-${theme}.png`), animations: "disabled" });
      const repair = dialog.getByRole("textbox", { name: "Edit generated schedule JSON", exact: true });
      await expect(repair).toHaveValue('{"days":');
      await dialog.getByRole("button", { name: "Apply to draft", exact: true }).click();
      await expect(dialog.getByRole("alert")).toContainText("Each block needs time");
      await repair.fill(
        JSON.stringify({ days: { Monday: [{ time: "00:00-00:00", activity: "Original routine", status: "online" }] } }),
      );
      await dialog.getByRole("button", { name: "Apply to draft", exact: true }).click();
      await expect(repair).toBeHidden();
      expect((await storedSchedule()).days.Monday?.[0]?.activity).toBe("Original routine");
      const picker = dialog.getByRole("combobox", { name: "Generation connection", exact: true });
      await expect(picker).toHaveValue("default-schedule-fixture");
      await expect(picker.locator('option[value="image-fixture"]')).toHaveCount(0);
      await expect(picker.locator('option[value="quarantined-fixture"]')).toHaveCount(0);
      await picker.selectOption("chosen-schedule-fixture");
      await expect(dialog.getByText("custom · chosen-model", { exact: true })).toBeVisible();
      const mondayToggle = dialog
        .locator("section")
        .filter({ hasText: /^Monday/ })
        .getByRole("button")
        .first();
      await expect(mondayToggle.getByTitle("00:00-00:00 Original routine", { exact: true })).toBeVisible();
      await mondayToggle.click();
      const mondayTime = dialog.getByRole("textbox", { name: "Monday block time range", exact: true });
      await mondayTime.fill("06:00-06:00");
      const fullDay = mondayToggle.getByTitle("06:00-06:00 Original routine", { exact: true });
      await expect(fullDay).toBeVisible();
      expect(
        await fullDay.evaluate(
          (element) => element.getBoundingClientRect().width / element.parentElement!.getBoundingClientRect().width,
        ),
      ).toBeGreaterThan(0.95);
      await page.screenshot({ path: info.outputPath(`schedule-full-day-${theme}.png`), animations: "disabled" });
      await mondayTime.fill("00:00-00:00");
      await dialog.getByRole("textbox", { name: "Monday block activity", exact: true }).fill("Unsaved routine");
      await dialog.getByRole("combobox", { name: "Weekly generation", exact: true }).selectOption("day");
      calls = [];
      failDay = "Wednesday";
      await weekButton.click();
      await expect(dialog.getByRole("alert")).toBeVisible();
      expect(calls.map((call) => call.day)).toEqual(["Monday", "Tuesday", "Wednesday"]);
      await expect(dialog.getByRole("textbox", { name: "Monday block activity", exact: true })).toHaveValue(
        "New Monday",
      );
      expect((await storedSchedule()).days.Monday?.[0]?.activity).toBe("Original routine");
      await repair.fill(
        JSON.stringify({ blocks: [{ time: "00:00-00:00", activity: "Repaired Wednesday", status: "online" }] }),
      );
      await dialog.getByRole("button", { name: "Apply to draft", exact: true }).click();
      await expect(repair).toBeHidden();

      calls = [];
      failDay = null;
      pauseRequests = true;
      await weekButton.click();
      await expect(dialog.getByRole("status")).toHaveText("Generating Monday (1/7)…");
      await expect(picker).toBeDisabled();
      await expect(dialog.getByLabel("Chat talkativeness", { exact: true })).toBeDisabled();
      await expect(dialog.getByLabel(/^Wait before checking in/)).toBeDisabled();
      await expect(dialog.getByRole("button", { name: "Save schedule", exact: true })).toBeDisabled();
      await expect(dialog.getByRole("textbox", { name: "Monday block activity", exact: true })).toHaveValue(
        "New Monday",
      );
      await page.screenshot({ path: info.outputPath(`schedule-generating-${theme}.png`), animations: "disabled" });
      await expect.poll(() => !!pendingRequest.release).toBe(true);
      pauseRequests = false;
      pendingRequest.release!();
      pendingRequest.release = undefined;
      await expect(weekButton).toBeEnabled();
      expect(calls.map((call) => call.day)).toEqual(CONVERSATION_SCHEDULE_DAYS);
      expect(
        calls.every((call) => call.connectionId === "chosen-schedule-fixture" && call.draftMode === "adjust"),
      ).toBe(true);
      expect(calls[1]?.schedule.days.Monday?.[0]?.activity).toBe("New Monday");
      await expect(dialog.getByRole("textbox", { name: "Monday block activity", exact: true })).toHaveValue(
        "New Monday",
      );
      await expect(dialog.getByRole("alert")).toHaveCount(0);
      expect((await storedSchedule()).days.Monday?.[0]?.activity).toBe("Original routine");
      await dialog.getByRole("button", { name: "Save schedule", exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect.poll(async () => (await storedSchedule()).days.Sunday?.[0]?.activity).toBe("New Sunday");
      expect((await storedSchedule()).talkativeness).toBe(37);
      expect((await storedSchedule()).weekStart).toBe(newWeekStart);

      newWeekStart = "2026-09-21T00:00:00.000Z";
      await manager.getByRole("button", { name: `Edit ${name} schedule`, exact: true }).click();
      await mondayToggle.click();
      const dayResponse = page.waitForResponse("**/api/conversation/schedule/draft");
      await dialog.getByRole("button", { name: "Regenerate Monday", exact: true }).click();
      await dayResponse;
      await expect(dialog.getByRole("button", { name: "Regenerate Monday", exact: true })).toBeEnabled();
      await dialog.getByRole("button", { name: "Save schedule", exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect.poll(async () => (await storedSchedule()).weekStart).toBe(newWeekStart);

      await manager.getByRole("button", { name: `Edit ${name} schedule`, exact: true }).click();
      await dialog.getByText("Schedule AI", { exact: true }).click();
      await dialog.getByRole("combobox", { name: "Weekly generation", exact: true }).selectOption("day");
      calls = [];
      pauseRequests = true;
      await weekButton.click();
      await expect(dialog.getByRole("status")).toHaveText("Generating Monday (1/7)…");
      const abortedOnClose = await dialog.getByRole("button", { name: "Cancel", exact: true }).evaluate((button) => {
        (button as HTMLButtonElement).click();
        return (window as unknown as { scheduleRequestSignal?: AbortSignal }).scheduleRequestSignal?.aborted;
      });
      expect(abortedOnClose, "closing aborts the request before the click handler returns").toBe(true);
      await expect(dialog).toBeHidden();
      await expect.poll(() => !!pendingRequest.release).toBe(true);
      pauseRequests = false;
      pendingRequest.release!();
      pendingRequest.release = undefined;
      await manager.getByRole("button", { name: `Edit ${name} schedule`, exact: true }).click();
      await expect(dialog).toBeVisible();
      expect(calls).toHaveLength(1);
      expect((await storedSchedule()).days.Monday?.[0]?.activity).toBe("New Monday");
      cancelledFixture = true;
      for (const action of ["Regenerate Monday", "Generate summary"]) {
        if (action === "Regenerate Monday") await mondayToggle.click();
        pauseRequests = true;
        await dialog.getByRole("button", { name: action, exact: true }).click();
        await expect.poll(() => !!pendingRequest.release).toBe(true);
        if (action === "Regenerate Monday") {
          await expect(dialog.getByRole("textbox", { name: "Monday block activity", exact: true })).toBeDisabled();
          await expect(dialog.getByLabel("Chat talkativeness", { exact: true })).toBeDisabled();
          await dialog.getByRole("button", { name: "Stop", exact: true }).click();
          await expect(dialog.getByRole("button", { name: "Regenerate Monday", exact: true })).toBeEnabled();
          await expect(dialog.getByText("Regenerating Monday...", { exact: true })).toHaveCount(0);
          await dialog.getByRole("button", { name: `Close Edit ${name} Schedule`, exact: true }).click();
        } else {
          await dialog.getByRole("button", { name: "Stop", exact: true }).click();
          await expect(dialog.getByRole("button", { name: "Generate summary", exact: true })).toBeEnabled();
          await expect(dialog).toBeVisible();
          await page.keyboard.press("Escape");
        }
        await expect(dialog).toBeHidden();
        pauseRequests = false;
        pendingRequest.release!();
        pendingRequest.release = undefined;
        await manager.getByRole("button", { name: `Edit ${name} schedule`, exact: true }).click();
        await expect(dialog.getByRole("button", { name: "Generate summary", exact: true })).toBeEnabled();
        await mondayToggle.click();
        await expect(dialog.getByRole("textbox", { name: "Monday block activity", exact: true })).toHaveValue(
          "New Monday",
        );
        await mondayToggle.click();
        expect((await storedSchedule()).routineSummary ?? "").toBe("");
      }
    } finally {
      pendingRequest.release?.();
      await request.delete(`/api/characters/${character.id}`);
    }
  });
}

test("Character card schedules explain missing connections and allow manual editing", async ({
  page,
  request,
}, info) => {
  const name = `Empty schedule ${info.project.name} ${Date.now().toString(36)}`;
  const created = await request.post("/api/characters", { data: { data: { name } } });
  expect(created.ok()).toBeTruthy();
  const character = await created.json();
  await page.route("**/api/connections", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    theme: "light",
    appAccentPulseMode: false,
  });
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
  try {
    await page.goto("/");
    await page.locator('[data-tour="panel-characters"]').click();
    const rightPanel = page.locator(
      `[data-component="${info.project.name.includes("mobile") ? "RightPanelMobile" : "RightPanelDesktop"}"]`,
    );
    await rightPanel.getByRole("button", { name: "Open Library", exact: true }).click();
    const library = page.locator('[data-component="CharacterLibraryView"]');
    await library.getByPlaceholder("Search characters").fill(name);
    await library.getByRole("button", { name: "Edit Character", exact: true }).click();
    await page.getByRole("button", { name: "Create schedule", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: `Edit ${name} Schedule`, exact: true });
    await expect(dialog.getByRole("combobox", { name: "Generation connection", exact: true })).toHaveValue("");
    await expect(
      dialog.getByText("Choose a language connection for schedule generation. You can add one in Connections.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Generate summary", exact: true })).toBeDisabled();
    await dialog.getByText("Schedule AI", { exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Rewrite week", exact: true })).toBeDisabled();
    await page.screenshot({ path: info.outputPath("schedule-empty-connections.png"), animations: "disabled" });
    await dialog
      .locator("section")
      .filter({ hasText: /^Monday/ })
      .getByRole("button")
      .first()
      .click();
    await dialog.getByRole("button", { name: "Add block", exact: true }).click();
    await dialog.getByRole("textbox", { name: "Monday block activity", exact: true }).fill("Manual routine");
    await dialog.getByRole("button", { name: "Save schedule", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(async () => {
        const saved = await (await request.get(`/api/characters/${character.id}`)).json();
        return JSON.parse(saved.data).extensions?.conversationSchedule?.days.Monday?.[0]?.activity;
      })
      .toBe("Manual routine");
  } finally {
    await request.delete(`/api/characters/${character.id}`);
  }
});
