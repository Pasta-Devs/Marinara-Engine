import { expect, test } from "@playwright/test";

test("app shell renders without a blank page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  const mainContent = page.getByRole("main", { name: "Main content" });
  await expect(mainContent).toBeVisible();
  await expect(mainContent.getByRole("heading", { name: /Marinara Engine/ })).toBeVisible();

  expect(errors).toEqual([]);
});
