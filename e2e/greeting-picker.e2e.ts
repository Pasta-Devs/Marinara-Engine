import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { seedUIState } from "./ui-state-fixture.js";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";

const greetings = Array.from({ length: 24 }, (_, index) => ({
  index,
  content: `[${index < 12 ? "Chapter 1" : "Chapter 2"}][Quiet][Evening] ${index === 0 ? "The last train home" : `A different evening ${index + 1}`}\n${Array.from({ length: 8 }, () => 'The platform is almost empty when you arrive. Aster is waiting beneath the station clock, turning a folded ticket between her fingers. "I wasn’t sure you would come," she says. Outside, the rain softens the lights of the city.').join("\n\n")}`,
}));

test("greeting picker previews safely and keeps its reading action reachable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.route("**/api/chats/picker-proof/messages/picker-proof/swipes", (route) =>
    route.fulfill({ json: greetings }),
  );
  await page.addInitScript(
    (version) => localStorage.setItem("marinara:whats-new:seen-version", version),
    JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version,
  );
  await page.goto("/");
  await prepareViteFixtureDependencies(page);
  await page.evaluate(async (content) => {
    const { SwipePicker } = await import("/src/components/chat/SwipePicker.tsx" as string);
    const dependencyUrl = window.__viteFixtureDependencyUrl;
    const { default: React } = await import(dependencyUrl("react"));
    const { default: ReactDOM } = await import(dependencyUrl("react-dom_client"));
    const { QueryClient, QueryClientProvider } = await import(dependencyUrl("@tanstack_react-query"));
    const container = document.createElement("div");
    document.body.append(container);
    ReactDOM.createRoot(container).render(
      React.createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        React.createElement(SwipePicker, {
          chatId: "picker-proof",
          messageId: "picker-proof",
          activeSwipeIndex: 0,
          swipeCount: 24,
          currentContent: content,
          greeting: true,
          triggerClassName: "fixed top-0 left-0 z-[9999]",
          onSetActiveSwipe: async (index: number) => {
            document.body.dataset.chosenGreeting = String(index);
            return true;
          },
        }),
      ),
    );
  }, greetings[0]!.content);
  await page.getByRole("button", { name: /Choose.*greeting/i }).click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  const rows = modal.getByRole("option");
  await expect(rows).toHaveCount(24);
  const filters = modal.getByRole("button", { name: "Filters", exact: true });
  await expect(filters).toHaveAttribute("aria-expanded", "false");
  await filters.click();
  await modal.getByRole("button", { name: /^Chapter 2/ }).click();
  await expect(rows).toHaveCount(12);
  await modal.getByRole("button", { name: /Clear.*tag/i }).click();
  await expect(rows).toHaveCount(24);
  await modal.getByRole("button", { name: "Filters", exact: true }).click();
  await modal.getByRole("combobox").press("ArrowDown");
  await expect(rows.nth(1)).toHaveAttribute("aria-selected", "true");
  await rows.nth(1).click();
  const useGreeting = modal.getByRole("button", { name: "Use this greeting", exact: true });
  await expect(useGreeting).toBeVisible();
  await rows.nth(1).click();
  await expect(modal).toBeVisible();
  await expect(page.locator("body")).not.toHaveAttribute("data-chosen-greeting");
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 390) {
      // Enter the phone reader from the list, just as a phone user does.
      await modal.getByRole("button", { name: /Back/ }).click();
      await rows.nth(1).click();
    }
    await expect(useGreeting).toBeInViewport();
    await expect(modal).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`greeting-picker-${width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const visualTheme of ["default", "sillytavern"]) {
    for (const theme of ["dark", "light"]) {
      await page.evaluate(
        async ({ visualTheme, theme }) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setVisualTheme(visualTheme);
          useUIStore.getState().setTheme(theme);
        },
        { visualTheme, theme },
      );
      await expect(useGreeting).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath(`greeting-picker-${visualTheme}-${theme}.png`) });
    }
  }
  const search = modal.getByRole("combobox");
  await search.fill("nothing matches this");
  await expect(rows).toHaveCount(0);
  await search.fill("A different evening 2");
  await expect(rows.first()).toBeVisible();
  await rows.first().click();
  await useGreeting.click();
  await expect(modal).toBeHidden();
  await expect(page.locator("body")).toHaveAttribute("data-chosen-greeting", "1");
});
