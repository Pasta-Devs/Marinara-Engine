#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

const CREDITS_MODAL_PATH = new URL("../packages/client/src/components/chat/HomeCreditsModal.tsx", import.meta.url);
const CONTRIBUTORS_URL = "https://api.github.com/repos/Pasta-Devs/Marinara-Engine/contributors?per_page=100";

const checkOnly = process.argv.includes("--check");

async function fetchContributors() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Marinara-Engine-Credits-Sync",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const contributors = [];
  let nextUrl = CONTRIBUTORS_URL;

  while (nextUrl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let res;
    try {
      res = await fetch(nextUrl, { headers, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("GitHub contributors request timed out after 15 seconds.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) {
      throw new Error(`GitHub contributors request failed: ${res.status} ${res.statusText}`);
    }
    const page = await res.json();
    if (!Array.isArray(page)) {
      throw new Error("GitHub contributors response was not an array.");
    }
    contributors.push(
      ...page.map((entry) => ({
        login: String(entry.login ?? "").trim(),
        url: String(entry.html_url ?? "").trim(),
        contributions: Number(entry.contributions ?? 0),
        type: String(entry.type ?? "User"),
      })),
    );

    const link = res.headers.get("link") ?? "";
    const nextMatch = link.match(/<([^>]+)>;\s*rel="next"/);
    nextUrl = nextMatch?.[1] ?? "";
  }

  return contributors.filter(
    (entry) =>
      entry.login &&
      entry.type !== "Bot" &&
      entry.url.startsWith("https://github.com/") &&
      Number.isFinite(entry.contributions),
  );
}

function renderContributors(contributors) {
  const rows = contributors.map(
    (entry) =>
      `  { login: ${JSON.stringify(entry.login)}, url: ${JSON.stringify(entry.url)}, contributions: ${entry.contributions} },`,
  );
  return `const CONTRIBUTORS = [\n${rows.join("\n")}\n];`;
}

function replaceContributors(source, contributorsBlock) {
  const pattern = /const CONTRIBUTORS = \[\n[\s\S]*?\n\];/;
  if (!pattern.test(source)) {
    throw new Error("Could not find CONTRIBUTORS block in HomeCreditsModal.tsx.");
  }
  return source.replace(pattern, contributorsBlock);
}

const contributors = await fetchContributors();
const source = await readFile(CREDITS_MODAL_PATH, "utf8");
const nextSource = replaceContributors(source, renderContributors(contributors));

if (nextSource === source) {
  console.log(`Credits are up to date (${contributors.length} contributors).`);
  process.exit(0);
}

if (checkOnly) {
  console.error(`Credits are stale. Run pnpm credits:sync to refresh ${contributors.length} contributors.`);
  process.exit(1);
}

await writeFile(CREDITS_MODAL_PATH, nextSource);
console.log(`Updated Credits modal with ${contributors.length} GitHub contributors.`);
