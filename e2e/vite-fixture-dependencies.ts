import type { Page } from "@playwright/test";

declare global {
  interface Window {
    __viteFixtureDependencyUrl: (name: string) => string;
  }
}

/** Reuse the app's exact Vite module identities without relying on resource timing retention. */
export async function prepareViteFixtureDependencies(page: Page, entryPath = "/src/main.tsx") {
  await page.evaluate(async (path) => {
    performance.clearResourceTimings();
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Cannot read Vite entry ${path}: ${response.status}`);
    const entry = await response.text();
    window.__viteFixtureDependencyUrl = (name: string) => {
      const url = entry.match(new RegExp(`"([^"\\n]*/deps/${name}\\.js[^"\\n]*)"`))?.[1];
      if (!url) throw new Error(`Vite entry ${path} is missing the ${name} dependency`);
      return url;
    };
  }, entryPath);
}
