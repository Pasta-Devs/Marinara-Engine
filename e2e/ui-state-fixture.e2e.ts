import { expect, test } from "@playwright/test";
import { UI_PERSISTENCE } from "../packages/client/src/lib/ui-persistence.js";
import { seedUIState } from "./ui-state-fixture.js";

test("UI fixtures use the live persistence contract and preserve existing preferences", async ({ page }) => {
  // This is a local persistence contract test, not a cross-device settings sync test.
  await page.route("**/api/app-settings/ui", async (route) => {
    await route.fulfill({ json: { value: null } });
  });
  // Compile-time guards: unknown or renamed preferences must fail rather than silently seed nothing.
  if (false) {
    // @ts-expect-error This obsolete preference is not part of the persisted UI state.
    await seedUIState(page, { chatBubbleStyle: "bubbles" });
    // @ts-expect-error A known preference must also have its real value type.
    await seedUIState(page, { messagesPerPage: "20" });
  }
  await seedUIState(
    page,
    {
      hasCompletedOnboarding: true,
      rightPanelOpen: false,
      sidebarOpen: false,
      messagesPerPage: 20,
      conversationMessageStyle: "bubble",
    },
    "if-missing",
  );
  await page.goto("/");
  const contract = await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    const options = useUIStore.persist.getOptions();
    return {
      name: options.name,
      version: options.version,
      state: options.partialize(useUIStore.getState()),
    };
  });
  expect(contract).toMatchObject({
    ...UI_PERSISTENCE,
    state: {
      messagesPerPage: 20,
      conversationMessageStyle: "bubble",
      hasCompletedOnboarding: true,
      chibiProfessorMariEnabled: false,
    },
  });
  await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.setState({ messagesPerPage: 40 });
  });
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        return useUIStore.getState().messagesPerPage;
      }),
    )
    .toBe(40);
});
