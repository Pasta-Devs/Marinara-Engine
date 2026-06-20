import type { ProfessorMariWikiPayload, WikiTruncation } from "./types.js";

const ACRONYMS = new Set(["api", "html", "id", "url"]);

function humanizeKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => (ACRONYMS.has(part.toLowerCase()) ? part.toUpperCase() : `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`))
    .join(" ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function primitive(value: unknown) {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function formatString(label: string, value: string, indent: string) {
  if (!value.includes("\n") && value.length <= 240) return [`${indent}- ${label}: ${value}`];
  return [`${indent}${label}:`, ...value.split(/\r?\n/).map((line) => `${indent}  ${line}`)];
}

function formatValue(label: string, value: unknown, indent = ""): string[] {
  if (value === undefined) return [];
  if (value === null) return [`${indent}- ${label}: null`];
  if (typeof value === "string") return formatString(label, value, indent);
  if (typeof value === "number" || typeof value === "boolean") return [`${indent}- ${label}: ${String(value)}`];
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${indent}- ${label}: []`];
    const lines = [`${indent}${label}:`];
    for (const item of value) {
      if (primitive(item)) {
        lines.push(`${indent}- ${String(item)}`);
      } else if (isRecord(item)) {
        const title =
          typeof item.title === "string"
            ? item.title
            : typeof item.name === "string"
              ? item.name
              : typeof item.line === "string"
                ? item.line
                : undefined;
        const url = typeof item.url === "string" ? item.url : undefined;
        const firstLine = [title, url].filter(Boolean).join(" - ");
        lines.push(`${indent}- ${firstLine || "Item"}`);
        for (const [childKey, childValue] of Object.entries(item)) {
          if (childKey === "title" || childKey === "name" || childKey === "line" || childKey === "url") continue;
          lines.push(...formatValue(humanizeKey(childKey), childValue, `${indent}  `));
        }
      } else {
        lines.push(`${indent}- ${String(item)}`);
      }
    }
    return lines;
  }
  if (isRecord(value)) {
    const lines = [`${indent}${label}:`];
    for (const [childKey, childValue] of Object.entries(value)) {
      lines.push(...formatValue(humanizeKey(childKey), childValue, `${indent}  `));
    }
    return lines;
  }
  return [`${indent}- ${label}: ${String(value)}`];
}

function pageTitleFromData(data: unknown): string | undefined {
  if (!isRecord(data)) return undefined;
  if (typeof data.title === "string") return data.title;
  if (isRecord(data.page) && typeof data.page.title === "string") return data.page.title;
  return undefined;
}

function pageUrlFromData(data: unknown): string | undefined {
  if (!isRecord(data)) return undefined;
  if (typeof data.url === "string") return data.url;
  if (isRecord(data.page) && typeof data.page.url === "string") return data.page.url;
  return undefined;
}

function formatTruncation(truncation: WikiTruncation | undefined) {
  if (!truncation) return [];
  const lines = ["", "Truncation:"];
  if (truncation.returnedBytes !== undefined) lines.push(`- Returned bytes: ${truncation.returnedBytes}`);
  if (truncation.totalBytes !== undefined) lines.push(`- Total bytes: ${truncation.totalBytes}`);
  if (truncation.continueFrom) lines.push(`- Continue from: ${truncation.continueFrom}`);
  if (truncation.remedyHint) lines.push(`- Remedy: ${truncation.remedyHint}`);
  return lines;
}

export function formatWikiPayload(payload: ProfessorMariWikiPayload<unknown>) {
  if (!payload.ok) {
    const lines = [`Fandom/MediaWiki error: ${payload.category}`, payload.message];
    if (payload.wiki?.host) lines.push(`Wiki: ${payload.wiki.sitename ?? payload.wiki.host}`);
    if (payload.page?.title) lines.push(`Page: ${payload.page.title}`);
    if (payload.page?.url) lines.push(`URL: ${payload.page.url}`);
    if (payload.retryAfterSeconds !== undefined) lines.push(`Retry after: ${payload.retryAfterSeconds} seconds`);
    return lines.join("\n");
  }

  const data = payload.data;
  const pageTitle = pageTitleFromData(data);
  const pageUrl = pageUrlFromData(data);
  const lines: string[] = [];
  if (pageTitle) lines.push(`Page: ${pageTitle}`);
  if (payload.wiki) lines.push(`Wiki: ${payload.wiki.sitename ?? payload.wiki.host}`);
  if (pageUrl) lines.push(`URL: ${pageUrl}`);
  if (payload.fetchedAt) lines.push(`Fetched: ${payload.fetchedAt}`);
  if (lines.length > 0) lines.push("");

  if (isRecord(data)) {
    for (const [key, value] of Object.entries(data)) {
      if (["title", "url"].includes(key)) continue;
      lines.push(...formatValue(humanizeKey(key), value));
    }
  } else {
    lines.push(...formatValue("Result", data));
  }
  lines.push(...formatTruncation(payload.truncation));
  return lines.join("\n").trimEnd();
}
