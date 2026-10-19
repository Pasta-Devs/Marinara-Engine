import { expect, type Page } from "@playwright/test";
import { securityHeadersHook } from "../packages/server/src/middleware/security-headers.js";

/** Serves the app page with the server's own connect-src and img-src (the directives the avatar renderers meet).
 *  Vite's dev page needs inline scripts the production build does not, so the other directives stay off. */
export async function serveWithServerCsp(page: Page) {
  let policy = "";
  securityHeadersHook(
    {} as never,
    {
      header: (name: string, value: string) => {
        if (name === "Content-Security-Policy") policy = value;
      },
    } as never,
    () => {},
  );
  const directives = policy
    .split(";")
    .map((directive) => directive.trim())
    .filter((directive) => /^(?:connect|img)-src\s/u.test(directive));
  expect(directives, "the server sets both directives").toHaveLength(2);
  await page.route(
    (url) => url.pathname === "/",
    async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: { ...response.headers(), "content-security-policy": directives.join("; ") },
      });
    },
  );
}
