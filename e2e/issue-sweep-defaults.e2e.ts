import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const mode of ["roleplay", "conversation"] as const) {
  test(`${mode} wizard waits for saved defaults from another device`, async ({ page, request }) => {
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay"],
      chatWizardDefaults: {},
    });
    let finishSync!: () => void;
    let markRequested!: () => void;
    const sync = new Promise<void>((resolve) => {
      finishSync = resolve;
    });
    const requested = new Promise<void>((resolve) => {
      markRequested = resolve;
    });
    await page.route("**/api/app-settings/ui", async (route) => {
      if (route.request().method() !== "GET") return route.fulfill({ json: {} });
      markRequested();
      await sync;
      await route.fulfill({
        json: {
          value: JSON.stringify({
            __updatedAt: Date.now() + 60_000,
            chatWizardDefaults: {
              [mode]: {
                name: "Saved on another device",
                connectionId: null,
                promptPresetId: null,
                personaId: null,
                personaCharacterId: null,
                characterIds: [],
                metadata: {},
              },
            },
          }),
        },
      });
    });
    const response = await request.post("/api/chats", { data: { name: "Fresh setup", mode, characterIds: [] } });
    expect(response.ok()).toBeTruthy();
    const chat = await response.json();
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chat.id, version },
    );
    try {
      await page.goto("/");
      await requested;
      await page.evaluate(async () => {
        const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
        useChatStore.getState().setShouldOpenWizard(true);
        useChatStore.getState().setShouldOpenSettings(true);
      });
      await expect(page.getByRole("status").filter({ hasText: "Loading" })).toBeVisible();
      await expect(page.locator('[data-component="ChatSetupWizard"]')).toBeHidden();
      finishSync();
      const name = page.locator('[data-component="ChatSetupWizard"] input[type="text"]').first();
      await expect(name).toHaveValue("Saved on another device");
      await name.fill("My next choice");
      await name.blur();
      await expect
        .poll(async () => (await (await request.get(`/api/chats/${chat.id}`)).json()).name)
        .toBe("My next choice");
      await expect(name).toHaveValue("My next choice");
    } finally {
      finishSync();
      await request.delete(`/api/chats/${chat.id}`);
    }
  });
}

for (const theme of ["dark", "light"] as const) {
  for (const mode of ["roleplay", "conversation"] as const) {
    test(`${mode} wizard defaults save, survive reload, and reset without profiles (${theme})`, async ({
      page,
      request,
    }, testInfo) => {
      await seedUIState(
        page,
        {
          theme,
          hasCompletedOnboarding: true,
          sidebarOpen: false,
          rightPanelOpen: false,
          chatHelpSeenModes: ["conversation", "roleplay"],
          chatWizardDefaults: {},
        },
        "if-missing",
      );
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
      const ids: string[] = [];
      const profilesBefore = await (await request.get("/api/chat-presets")).json();
      const create = async (name: string) => {
        const response = await request.post("/api/chats", { data: { name, mode, characterIds: [] } });
        expect(response.ok()).toBeTruthy();
        const chat = await response.json();
        ids.push(chat.id);
        return chat.id as string;
      };
      const wizard = page.locator('[data-component="ChatSetupWizard"]');
      const open = async () => {
        await page.evaluate(async () => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          useChatStore.getState().setShouldOpenWizard(true);
          useChatStore.getState().setShouldOpenSettings(true);
        });
        await expect(wizard).toBeVisible();
      };
      const lastStep = async () => {
        for (let i = 0; i < (mode === "roleplay" ? 4 : 3); i++) {
          await wizard.getByRole("button", { name: "Next", exact: true }).click();
          if (mode === "roleplay" && i === 1) {
            const choices = page.getByRole("dialog", { name: "Configure Preset Variables" });
            await expect(
              choices.or(wizard.getByRole("heading", { name: "Persona & Characters", exact: true })),
            ).toBeVisible();
            if (await choices.isVisible())
              await choices.getByRole("button", { name: "Confirm Choices", exact: true }).click();
          }
          await expect(wizard.getByRole("button", { name: "Close setup", exact: true })).toBeVisible();
        }
      };
      try {
        const firstId = await create("Initial setup");
        await page.addInitScript((id) => {
          if (!localStorage.getItem("marinara-active-chat-id")) localStorage.setItem("marinara-active-chat-id", id);
        }, firstId);
        await page.goto("/");
        await open();
        // Use the actual name input independently of translated placeholder punctuation.
        const nameInput = wizard.locator('input[type="text"]').first();
        await nameInput.fill(`Saved ${mode}`);
        await nameInput.blur();
        await expect
          .poll(async () => (await (await request.get(`/api/chats/${firstId}`)).json()).name)
          .toBe(`Saved ${mode}`);
        await lastStep();
        const save = wizard.getByRole("button", { name: "Save as default", exact: true });
        await expect(save).toBeVisible();
        if (mode === "roleplay") {
          const profile = wizard.getByRole("button", { name: /^(Use a )?Profile$/ });
          await expect(profile).toBeVisible();
          const a = await save.boundingBox();
          const b = await profile.boundingBox();
          expect(a && b && (a.y + a.height <= b.y + 1 || a.x + a.width <= b.x + 1)).toBeTruthy();
        }
        await save.click();
        await expect(wizard.getByRole("button", { name: "Reset defaults", exact: true })).toBeVisible();
        await expect
          .poll(() =>
            page.evaluate(
              (chatMode) =>
                JSON.parse(localStorage.getItem("marinara-engine-ui")!).state.chatWizardDefaults[chatMode]?.name,
              mode,
            ),
          )
          .toBe(`Saved ${mode}`);
        await testInfo.attach(`${mode}-defaults-${theme}`, {
          body: await page.screenshot({ path: testInfo.outputPath("wizard.png") }),
          contentType: "image/png",
        });
        await wizard.getByRole("button", { name: "Close setup", exact: true }).click();
        const nextId = await create("Fresh setup");
        await page.evaluate((id) => localStorage.setItem("marinara-active-chat-id", id), nextId);
        await page.reload();
        await open();
        await expect(nameInput).toHaveValue(`Saved ${mode}`);
        await lastStep();
        await wizard.getByRole("button", { name: "Reset defaults", exact: true }).click();
        await expect(nameInput).toHaveValue("Fresh setup");
        await expect
          .poll(() =>
            page.evaluate(
              (chatMode) =>
                JSON.parse(localStorage.getItem("marinara-engine-ui")!).state.chatWizardDefaults[chatMode] ?? null,
              mode,
            ),
          )
          .toBeNull();
        expect(await (await request.get("/api/chat-presets")).json()).toEqual(profilesBefore);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
      } finally {
        for (const id of ids) await request.delete(`/api/chats/${id}`);
      }
    });
  }

  test(`custom agent previous-output and spoiler options persist (${theme})`, async ({ page, request }, testInfo) => {
    await seedUIState(
      page,
      { theme, hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false },
      "if-missing",
    );
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
    const response = await request.post("/api/agents", {
      data: {
        type: `custom-sweep-${theme}`,
        name: "Self context",
        phase: "pre_generation",
        promptTemplate: "Remember prior state.",
        settings: { resultType: "context_injection" },
      },
    });
    expect(response.ok()).toBeTruthy();
    const agent = await response.json();
    const open = async () => {
      await page.evaluate(async (id) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openAgentDetail(id);
      }, agent.id);
      await expect(page.locator(".mari-editor-shell")).toBeVisible();
    };
    const read = async () => {
      const row = await (await request.get(`/api/agents/${agent.id}`)).json();
      return typeof row.settings === "string" ? JSON.parse(row.settings) : row.settings;
    };
    try {
      await page.goto("/");
      await open();
      for (const label of ["Previous output", "JSON context output", "Hide output as spoilers"]) {
        const control = page.getByRole("checkbox", { name: new RegExp(`^${label} `) });
        await page.getByText(label, { exact: true }).click();
        await expect(control).toBeChecked();
      }
      await testInfo.attach(`custom-agent-output-${theme}`, {
        body: await page.screenshot({ path: testInfo.outputPath("agent.png") }),
        contentType: "image/png",
      });
      await page.locator(".mari-editor-header .mari-editor-action--primary").click();
      await expect.poll(async () => (await read()).hideOutput).toBe(true);
      expect((await read()).jsonContextOutput).toBe(true);
      expect((await read()).contextSources.previousOutput).toBe(true);
      await page.reload();
      await open();
      for (const label of ["Previous output", "JSON context output", "Hide output as spoilers"])
        await expect(page.getByRole("checkbox", { name: new RegExp(`^${label} `) })).toBeChecked();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    } finally {
      await request.delete(`/api/agents/${agent.id}`);
    }
  });
}
