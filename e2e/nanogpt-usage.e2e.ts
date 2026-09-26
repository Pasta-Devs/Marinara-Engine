import { test, expect } from "@playwright/test";
import { seedUIState } from "./ui-state-fixture";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies";

for (const theme of ["light", "dark"] as const) {
  test(`NanoGPT meter keeps unknown usage refreshable and reports the real allowance in ${theme}`, async ({
    page,
  }, info) => {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, { hasCompletedOnboarding: true, chibiProfessorMariEnabled: false, theme });
    let calls = 0;
    let fail = false;
    let weekly: Record<string, unknown> | null = { used: null, remaining: null, percentUsed: null, degraded: true };
    let active = true;
    await page.route("**/api/connections/nano-usage/subscription-usage", (route) => {
      calls++;
      return route.fulfill(
        fail
          ? { status: 502, json: { error: "Usage unavailable" } }
          : {
              json: {
                provider: "nanogpt",
                credential: "management_token",
                active,
                state: active ? "active" : "inactive",
                limits: { weeklyInputTokens: 60_000_000, dailyInputTokens: null, dailyImages: null },
                weeklyInputTokens: weekly,
                dailyInputTokens: null,
                dailyImages: null,
                currentPeriodEnd: null,
              },
            },
      );
    });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await prepareViteFixtureDependencies(page);
    await page.evaluate(async () => {
      const url = window.__viteFixtureDependencyUrl;
      const { default: React } = await import(url("react"));
      const { default: ReactDOM } = await import(url("react-dom_client"));
      const { QueryClient, QueryClientProvider } = await import(url("@tanstack_react-query"));
      const { NanoGptUsageWidget } = await import("/src/components/connections/NanoGptUsageWidget.tsx" as string);
      const mount = document.createElement("div");
      mount.style.cssText =
        "position:fixed;inset:0;z-index:99999;overflow:auto;background:var(--background);padding:12px;color:var(--foreground)";
      document.body.appendChild(mount);
      ReactDOM.createRoot(mount).render(
        React.createElement(
          QueryClientProvider,
          {
            client: new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
          },
          ...["inline", "card"].map((variant) =>
            React.createElement(
              "section",
              {
                key: variant,
                "data-testid": variant,
                style: { width: "100%", maxWidth: "320px", marginBottom: "16px" },
              },
              React.createElement(NanoGptUsageWidget, { connectionId: "nano-usage", variant }),
            ),
          ),
        ),
      );
    });
    const inline = page.getByTestId("inline");
    await expect(inline).toContainText("unknown");
    await expect(inline.getByRole("progressbar")).toHaveCount(0);
    await expect(inline.getByRole("button", { name: "Refresh usage", exact: true })).toBeVisible();
    weekly = { used: 72_000_000, remaining: 0, percentUsed: 1.2, degraded: false };
    await inline.getByRole("button", { name: "Refresh usage", exact: true }).click();
    await expect(inline).toContainText("72M / 60M");
    await expect(inline.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    await page.screenshot({ path: info.outputPath(`nanogpt-${theme}.png`) });
    active = false;
    weekly = null;
    await inline.getByRole("button", { name: "Refresh usage", exact: true }).click();
    await expect(inline).toContainText("inactive");
    await expect(inline.getByRole("progressbar")).toHaveCount(0);
    await expect(inline.getByRole("button", { name: "Refresh usage", exact: true })).toBeVisible();
    fail = true;
    await inline.getByRole("button", { name: "Refresh usage", exact: true }).click();
    await expect(inline).toContainText("Usage unavailable");
    fail = false;
    await inline.getByRole("button", { name: "Retry usage lookup", exact: true }).click();
    await expect(inline).toContainText("inactive");
    expect(calls).toBe(5);
  });
}
