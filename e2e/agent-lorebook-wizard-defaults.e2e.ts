import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

for (const mode of ["conversation", "roleplay"] as const) {
  test(`reusable ${mode} wizard defaults never transfer an agent's reference book`, async ({ page, request }) => {
    const ids: string[] = [];
    const books: string[] = [];
    await page.route("**/api/app-settings/ui", (route) =>
      route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
    );
    for (const endpoint of ["capability-packages/agents", "capability-packages/installed", "agents"])
      await page.route(`**/api/${endpoint}`, (route) => route.fulfill({ json: [] }));
    const createBook = async () => {
      const response = await request.post("/api/lorebooks", { data: { name: `${mode} reference` } });
      expect(response.ok()).toBeTruthy();
      const book = await response.json();
      books.push(book.id);
      return book.id as string;
    };
    const createChat = async (name: string) => {
      const response = await request.post("/api/chats", { data: { name, mode, characterIds: [] } });
      expect(response.ok()).toBeTruthy();
      const chat = await response.json();
      ids.push(chat.id);
      return chat.id as string;
    };
    const metadata = async (id: string) => (await (await request.get(`/api/chats/${id}`)).json()).metadata;
    const saveMetadata = async (id: string, data: Record<string, unknown>) => {
      const response = await request.patch(`/api/chats/${id}/metadata`, { data });
      expect(response.ok()).toBeTruthy();
    };
    try {
      const sourceBook = await createBook();
      const targetBook = await createBook();
      const source = await createChat("Wizard source");
      const target = await createChat("Wizard target");
      const fresh = await createChat("Wizard fresh target");
      const sourceAttachments = {
        writer: { enabled: true, lorebookId: sourceBook },
        disabled: { enabled: false, lorebookId: sourceBook },
      };
      const targetAttachments = {
        writer: { enabled: true, lorebookId: targetBook },
        unrelated: { enabled: true, lorebookId: targetBook },
      };
      await saveMetadata(source, { agentLorebookAttachments: sourceAttachments });
      await saveMetadata(target, { agentLorebookAttachments: targetAttachments });
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        appAccentPulseMode: false,
        theme: mode === "conversation" ? "light" : "dark",
        chatHelpSeenModes: ["conversation", "roleplay", "game"],
        chatWizardDefaults: {},
      });
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id: source, version },
      );
      await page.goto("/");
      const wizard = page.locator('[data-component="ChatSetupWizard"]');
      const open = async (id: string) => {
        await page.evaluate(async (id) => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          useChatStore.getState().setShouldOpenWizard(false);
          useChatStore.getState().setShouldOpenSettings(false);
          useChatStore.getState().setActiveChatId(id);
        }, id);
        await expect
          .poll(() =>
            page.evaluate(async (id) => {
              const { queryClient } = await import("/src/lib/query-client.ts" as string);
              return queryClient.getQueryData(["chats", "detail", id])?.id;
            }, id),
          )
          .toBe(id);
        await page.evaluate(async () => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          useChatStore.getState().setShouldOpenWizard(true);
          useChatStore.getState().setShouldOpenSettings(true);
        });
        await expect(wizard).toBeVisible();
      };
      const lastStep = async (label: string) => {
        for (
          let guard = 0;
          guard < 12 && !(await wizard.getByRole("button", { name: label, exact: true }).isVisible());
          guard++
        ) {
          const heading = wizard.getByRole("heading", { level: 4 }).first();
          const previous = await heading.innerText();
          await wizard.getByRole("button", { name: "Next", exact: true }).click();
          const choices = page.getByRole("dialog", { name: "Configure Preset Variables", exact: true });
          await expect
            .poll(
              async () =>
                (await choices.isVisible()) ||
                ((await heading.isVisible()) && (await heading.innerText()) !== previous),
            )
            .toBe(true);
          if (await choices.isVisible()) await choices.getByRole("button", { name: "Skip", exact: true }).click();
          await expect(heading).not.toHaveText(previous);
        }
        await expect(wizard.getByRole("button", { name: label, exact: true })).toBeVisible();
      };
      await open(source);
      await lastStep("Save as default");
      await wizard.getByRole("button", { name: "Save as default", exact: true }).click();
      const saved = await page.evaluate(async (mode) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        return useUIStore.getState().chatWizardDefaults[mode];
      }, mode);
      expect.soft(saved.metadata).not.toHaveProperty("agentLorebookAttachments");
      expect(await metadata(source)).toMatchObject({ agentLorebookAttachments: sourceAttachments });

      // Deliberately restore a pre-fix persisted template to exercise the application boundary too.
      await page.evaluate(
        async ({ mode, saved, sourceAttachments }) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setChatWizardDefaults(mode, {
            ...saved,
            metadata: { ...saved.metadata, agentLorebookAttachments: sourceAttachments },
          });
        },
        { mode, saved, sourceAttachments },
      );
      const patches: Array<{ id: string; body: Record<string, unknown> }> = [];
      page.on("request", (request) => {
        const match = new URL(request.url()).pathname.match(/^\/api\/chats\/([^/]+)\/metadata$/u);
        if (match && request.method() === "PATCH") patches.push({ id: match[1]!, body: request.postDataJSON() });
      });
      await open(target);
      await lastStep("Reset defaults");
      expect.soft((await metadata(target)).agentLorebookAttachments).toEqual(targetAttachments);
      expect
        .soft(
          patches
            .filter((patch) => patch.id === target)
            .some((patch) => Object.hasOwn(patch.body, "agentLorebookAttachments")),
        )
        .toBe(false);
      await wizard.getByRole("button", { name: "Reset defaults", exact: true }).click();
      await expect(wizard.getByRole("button", { name: "Save as default", exact: true })).not.toBeVisible();
      await lastStep("Save as default");
      expect.soft((await metadata(target)).agentLorebookAttachments).toEqual(targetAttachments);
      expect.soft((await metadata(target)).agentLorebookAttachments).not.toHaveProperty("disabled");

      await page.evaluate(
        async ({ mode, saved, sourceAttachments }) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setChatWizardDefaults(mode, {
            ...saved,
            metadata: { ...saved.metadata, agentLorebookAttachments: sourceAttachments },
          });
        },
        { mode, saved, sourceAttachments },
      );
      await open(fresh);
      await lastStep("Reset defaults");
      expect.soft((await metadata(fresh)).agentLorebookAttachments ?? {}).toEqual({});
      await wizard.getByRole("button", { name: "Reset defaults", exact: true }).click();
      await lastStep("Save as default");
      expect.soft((await metadata(fresh)).agentLorebookAttachments ?? {}).toEqual({});
    } finally {
      for (const id of ids) await request.delete(`/api/chats/${id}`);
      for (const id of books) await request.delete(`/api/lorebooks/${id}`);
    }
  });
}
