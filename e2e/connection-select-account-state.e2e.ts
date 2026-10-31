import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";
import { seedUIState } from "./ui-state-fixture.js";

test("real connection fields distinguish failed account reads from standalone and review states", async ({ page }) => {
  const rows = [
    { id: "standalone", name: "Standalone proof", accountId: null },
    { id: "account", name: "Account proof", accountId: "unread-account" },
    {
      id: "lender",
      name: "Standalone lender proof",
      accountId: "stale-account",
      credentialsFromConnectionId: "standalone",
    },
    { id: "review", name: "Review proof", accountId: "unread-account", profileImportReviewRequired: true },
  ].map((row) => ({ provider: "openai", model: "gpt-4o-mini", ...row }));
  await page.route("**/api/connections", (route) => route.fulfill({ json: rows }));
  await page.route("**/api/connection-accounts", (route) =>
    route.fulfill({ status: 503, json: { error: "Account proof failure" } }),
  );
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.goto("/");
  await prepareViteFixtureDependencies(page);
  await page.evaluate(async (rows) => {
    const { ConnectionSelect } = await import("/src/components/connections/ConnectionSelect.tsx" as string);
    const dependencyUrl = window.__viteFixtureDependencyUrl;
    const { default: React } = await import(dependencyUrl("react"));
    const { default: ReactDOM } = await import(dependencyUrl("react-dom_client"));
    const { QueryClient, QueryClientProvider } = await import(dependencyUrl("@tanstack_react-query"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const container = document.createElement("main");
    container.dataset.accountProof = "true";
    container.style.cssText =
      "position:fixed;inset:0;z-index:99999;padding:24px;background:var(--background);color:var(--foreground)";
    document.body.append(container);
    ReactDOM.createRoot(container).render(
      React.createElement(
        QueryClientProvider,
        { client },
        rows.map((row) =>
          React.createElement(
            "section",
            { key: row.id, "data-proof-row": row.id },
            React.createElement(ConnectionSelect, {
              value: row.id,
              onChange: () => {},
              "aria-label": row.name,
              required: true,
            }),
          ),
        ),
      ),
    );
  }, rows);
  const fixture = page.locator("[data-account-proof]");
  await expect(fixture.locator('[data-proof-row="account"]')).toContainText("Account status unavailable");
  await expect(fixture.locator('[data-proof-row="review"]')).toContainText("import needs review");
  for (const id of ["standalone", "lender"]) {
    const row = fixture.locator(`[data-proof-row="${id}"]`);
    await expect(row.getByRole("button")).toBeEnabled();
    await expect(row).not.toContainText(/Account status unavailable|[Cc]hecking|import needs review/);
    await expect(row).toContainText("Other models");
  }
  await expect(fixture.locator('[data-proof-row="review"]')).not.toContainText("Account status unavailable");
  await mkdir(".tmp/pr8456-help", { recursive: true });
  await page.screenshot({ path: ".tmp/pr8456-help/account-status.png", animations: "disabled" });
});
