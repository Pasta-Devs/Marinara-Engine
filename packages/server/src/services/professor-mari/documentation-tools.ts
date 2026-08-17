import type { Dirent } from "node:fs";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const EXCLUDED_DOC_DIRS = new Set(["evidence", "pr-evidence", "screenshots", "examples", "i18n"]);
const MAX_DOC_FILE_BYTES = 1024 * 1024;
const MAX_DOC_CANDIDATES = 500;
const MAX_DOC_DIRECTORIES = 250;
const MAX_DOC_DEPTH = 8;
const MAX_DOC_AGGREGATE_BYTES = 8 * 1024 * 1024;
const MAX_DOC_SECTIONS = 20_000;
const MAX_DOC_MATCHES = 5_000;
const DEFAULT_SEARCH_LIMIT = 5;
const MAX_SEARCH_LIMIT = 8;
const DEFAULT_READ_CHARS = 8_000;
const MAX_READ_CHARS = 16_000;
const MAX_EXCERPT_CHARS = 700;
const MAX_HEADINGS_IN_MISS = 40;

interface DocumentationSection {
  path: string;
  heading: string;
  content: string;
  startLine: number;
}

export interface DocumentationSearchResult {
  path: string;
  heading: string;
  excerpt: string;
  startLine: number;
  score: number;
}

export interface DocumentationSearchResponse {
  results: DocumentationSearchResult[];
  truncated: boolean;
}

interface DocumentationDiscovery {
  files: Array<{ absolutePath: string; path: string }>;
  totalBytes: number;
  directories: number;
  incomplete: boolean;
  stopped: boolean;
}

async function addDocumentationCandidate(filePath: string, path: string, discovery: DocumentationDiscovery) {
  if (discovery.files.length >= MAX_DOC_CANDIDATES) {
    discovery.incomplete = true;
    discovery.stopped = true;
    return;
  }
  try {
    const info = await lstat(filePath);
    if (!info.isFile() || info.size > MAX_DOC_FILE_BYTES) {
      if (info.isFile()) discovery.incomplete = true;
      return;
    }
    if (discovery.totalBytes + info.size > MAX_DOC_AGGREGATE_BYTES) {
      discovery.incomplete = true;
      discovery.stopped = true;
      return;
    }
    discovery.files.push({ absolutePath: filePath, path });
    discovery.totalBytes += info.size;
  } catch {
    // A file can disappear during an update; omit it from this search.
  }
}

async function collectMarkdownFiles(
  dir: string,
  docsRoot: string,
  discovery: DocumentationDiscovery,
  depth: number,
): Promise<void> {
  if (discovery.stopped) return;
  if (depth > MAX_DOC_DEPTH || discovery.directories >= MAX_DOC_DIRECTORIES) {
    discovery.incomplete = true;
    discovery.stopped = true;
    return;
  }
  discovery.directories += 1;
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (discovery.stopped) return;
    if (entry.isDirectory()) {
      if (EXCLUDED_DOC_DIRS.has(entry.name.toLowerCase())) continue;
      await collectMarkdownFiles(join(dir, entry.name), docsRoot, discovery, depth + 1);
      continue;
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue;
    const absolutePath = join(dir, entry.name);
    const path = `docs/${relative(docsRoot, absolutePath).split(sep).join("/")}`;
    await addDocumentationCandidate(absolutePath, path, discovery);
  }
}

async function canonicalDocumentationFiles(workspaceRoot: string): Promise<DocumentationDiscovery> {
  const root = await realpath(resolve(workspaceRoot));
  const discovery: DocumentationDiscovery = {
    files: [],
    totalBytes: 0,
    directories: 0,
    incomplete: false,
    stopped: false,
  };
  await addDocumentationCandidate(join(root, "README.md"), "README.md", discovery);
  let docsRoot: string;
  try {
    docsRoot = await realpath(join(root, "docs"));
  } catch {
    return discovery;
  }
  if (!isPathWithin(root, docsRoot)) {
    discovery.incomplete = true;
    discovery.stopped = true;
    return discovery;
  }
  await collectMarkdownFiles(docsRoot, docsRoot, discovery, 0);
  return discovery;
}

async function readBoundedMarkdown(filePath: string, maxBytes = MAX_DOC_FILE_BYTES): Promise<string | null> {
  try {
    const info = await lstat(filePath);
    const byteLimit = Math.min(MAX_DOC_FILE_BYTES, Math.max(0, maxBytes));
    if (!info.isFile() || info.size > byteLimit) return null;
    const content = await readFile(filePath);
    if (content.byteLength > byteLimit) return null;
    return content.toString("utf8");
  } catch {
    return null;
  }
}

function markdownSections(
  path: string,
  content: string,
  maxSections: number,
): { sections: DocumentationSection[]; truncated: boolean } {
  const lines = content.split(/\r?\n/);
  const headings: Array<{ index: number; heading: string }> = [];
  let overflowIndex: number | null = null;
  for (const [index, line] of lines.entries()) {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/u);
    if (!match) continue;
    if (headings.length >= Math.max(1, maxSections)) {
      overflowIndex = index;
      break;
    }
    headings.push({ index, heading: match[2]!.trim() });
  }
  if (headings.length === 0) {
    return {
      sections: [{ path, heading: "Document overview", content, startLine: 1 }],
      truncated: false,
    };
  }

  const sections: DocumentationSection[] = [];
  if (headings[0]!.index > 0) {
    sections.push({
      path,
      heading: "Document overview",
      content: lines.slice(0, headings[0]!.index).join("\n"),
      startLine: 1,
    });
  }
  headings.forEach((heading, index) => {
    const end = headings[index + 1]?.index ?? overflowIndex ?? lines.length;
    sections.push({
      path,
      heading: heading.heading,
      content: lines.slice(heading.index + 1, end).join("\n"),
      startLine: heading.index + 1,
    });
  });
  return {
    sections: sections.slice(0, maxSections),
    truncated: overflowIndex !== null || sections.length > maxSections,
  };
}

function firstMarkdownHeading(content: string) {
  return iterateMarkdownHeadings(content.split(/\r?\n/)).next().value?.heading ?? "Document overview";
}

/**
 * Iterate ATX headings, skipping fenced code blocks and preserving terminal '#'
 * characters that belong to the heading text (e.g. "C#"). Shared by heading
 * listing and lookup so the two always agree on what counts as a heading.
 */
function* iterateMarkdownHeadings(lines: string[]): Generator<{ index: number; level: number; heading: string }> {
  let fence: { char: string; length: number } | null = null;
  for (const [index, line] of lines.entries()) {
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*(.*)$/u);
    if (fenceMatch) {
      const run = fenceMatch[1]!;
      const marker = run[0]!;
      // Close only on the same marker, an equal-or-longer run, and no trailing text.
      if (fence === null) fence = { char: marker, length: run.length };
      else if (marker === fence.char && run.length >= fence.length && fenceMatch[2]!.trim() === "") fence = null;
      continue;
    }
    if (fence !== null) continue;
    // Closing '#' run is stripped only when whitespace-separated, so "C#" survives.
    const match = line.match(/^(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/u);
    if (match) yield { index, level: match[1]!.length, heading: match[2]!.trim() };
  }
}

function listMarkdownHeadings(content: string): string[] {
  return [...iterateMarkdownHeadings(content.split(/\r?\n/))].map((entry) => entry.heading);
}

function readMarkdownHeading(path: string, content: string, requestedHeading: string): DocumentationSection | null {
  const lines = content.split(/\r?\n/);
  const normalizedHeading = requestedHeading.toLocaleLowerCase();
  const headings = [...iterateMarkdownHeadings(lines)];
  for (const [position, entry] of headings.entries()) {
    if (entry.heading.toLocaleLowerCase() !== normalizedHeading) continue;
    let end = lines.length;
    for (let next = position + 1; next < headings.length; next += 1) {
      if (headings[next]!.level <= entry.level) {
        end = headings[next]!.index;
        break;
      }
    }
    return {
      path,
      heading: entry.heading,
      content: lines.slice(entry.index + 1, end).join("\n"),
      startLine: entry.index + 1,
    };
  }
  return null;
}

function queryTerms(query: string) {
  return [...new Set(query.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_-]*/gu) ?? [])].filter(
    (term) => term.length > 1,
  );
}

function countOccurrences(text: string, needle: string) {
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while ((offset = text.indexOf(needle, offset)) !== -1) {
    count += 1;
    offset += Math.max(needle.length, 1);
  }
  return count;
}

function sectionScore(section: DocumentationSection, phrase: string, terms: string[]) {
  const path = section.path.toLocaleLowerCase();
  const heading = section.heading.toLocaleLowerCase();
  const content = section.content.toLocaleLowerCase();
  let score = countOccurrences(content, phrase) * 12;
  if (heading.includes(phrase)) score += 30;
  if (path.includes(phrase)) score += 18;
  for (const term of terms) {
    score += Math.min(countOccurrences(content, term), 12);
    if (heading.includes(term)) score += 8;
    if (path.includes(term)) score += 5;
  }
  return score;
}

function excerptForMatch(content: string, phrase: string, terms: string[]) {
  const lines = content.split(/\r?\n/);
  const needles = [phrase, ...terms].filter(Boolean);
  const matchIndex = lines.findIndex((line) => {
    const normalized = line.toLocaleLowerCase();
    return needles.some((needle) => normalized.includes(needle));
  });
  const start = Math.max(0, matchIndex === -1 ? 0 : matchIndex - 1);
  const excerpt = lines
    .slice(start, start + 5)
    .join("\n")
    .trim();
  if (excerpt.length <= MAX_EXCERPT_CHARS) return excerpt;
  return `${excerpt.slice(0, MAX_EXCERPT_CHARS - 1).trimEnd()}…`;
}

function compareSearchResults(a: DocumentationSearchResult, b: DocumentationSearchResult) {
  return b.score - a.score || a.path.localeCompare(b.path) || a.startLine - b.startLine;
}

export async function searchCanonicalDocumentation(
  workspaceRoot: string,
  query: string,
  requestedLimit = DEFAULT_SEARCH_LIMIT,
): Promise<DocumentationSearchResponse> {
  const normalizedQuery = query.trim().slice(0, 200);
  if (normalizedQuery.length < 2) throw new Error("docs_search query must be at least 2 characters");
  const phrase = normalizedQuery.toLocaleLowerCase();
  const terms = queryTerms(normalizedQuery);
  const limit = Math.max(1, Math.min(MAX_SEARCH_LIMIT, Math.trunc(requestedLimit) || DEFAULT_SEARCH_LIMIT));
  const discovery = await canonicalDocumentationFiles(workspaceRoot);
  const results: DocumentationSearchResult[] = [];
  let bytesRead = 0;
  let sectionCount = 0;
  let matchCount = 0;
  let truncated = discovery.incomplete;

  fileLoop: for (const file of discovery.files) {
    const remainingBytes = MAX_DOC_AGGREGATE_BYTES - bytesRead;
    if (remainingBytes <= 0) {
      truncated = true;
      break;
    }
    const content = await readBoundedMarkdown(file.absolutePath, remainingBytes);
    if (content === null) {
      truncated = true;
      continue;
    }
    bytesRead += Buffer.byteLength(content, "utf8");
    const remainingSections = MAX_DOC_SECTIONS - sectionCount;
    if (remainingSections <= 0) {
      truncated = true;
      break;
    }
    const sectionBatch = markdownSections(file.path, content, remainingSections);
    for (const section of sectionBatch.sections) {
      sectionCount += 1;
      const score = sectionScore(section, phrase, terms);
      if (score > 0) {
        matchCount += 1;
        results.push({
          path: section.path,
          heading: section.heading,
          excerpt: excerptForMatch(section.content, phrase, terms),
          startLine: section.startLine,
          score,
        });
        results.sort(compareSearchResults);
        if (results.length > limit) results.pop();
        if (matchCount >= MAX_DOC_MATCHES) {
          truncated = true;
          break fileLoop;
        }
      }
      if (sectionCount >= MAX_DOC_SECTIONS) {
        truncated = true;
        break fileLoop;
      }
    }
    if (sectionBatch.truncated) {
      truncated = true;
      break;
    }
  }

  return { results, truncated };
}

function isPathWithin(parent: string, child: string) {
  const normalizedParent = process.platform === "win32" ? parent.toLowerCase() : parent;
  const normalizedChild = process.platform === "win32" ? child.toLowerCase() : child;
  const prefix = normalizedParent.endsWith(sep) ? normalizedParent : `${normalizedParent}${sep}`;
  return normalizedChild === normalizedParent || normalizedChild.startsWith(prefix);
}

async function resolveCanonicalDocPath(workspaceRoot: string, requestedPath: string) {
  const normalized = requestedPath.trim().replace(/^\.\//u, "").replace(/\\/gu, "/");
  if (normalized !== "README.md" && (!normalized.startsWith("docs/") || !normalized.toLowerCase().endsWith(".md"))) {
    throw new Error("docs_read path must be README.md or an English Markdown file under docs/");
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("docs_read path is invalid");
  }
  if (segments.slice(1).some((segment) => EXCLUDED_DOC_DIRS.has(segment.toLowerCase()))) {
    throw new Error("docs_read path is outside the canonical user documentation set");
  }
  const workspace = await realpath(resolve(workspaceRoot));
  const requested = resolve(workspace, ...segments);
  const requestedInfo = await lstat(requested);
  if (!requestedInfo.isFile()) throw new Error(`Documentation file not found: ${normalized}`);
  const canonicalTarget = await realpath(requested);
  if (normalized === "README.md") {
    const canonicalReadme = await realpath(join(workspace, "README.md"));
    if (canonicalTarget !== canonicalReadme || !isPathWithin(workspace, canonicalTarget)) {
      throw new Error("docs_read README path escapes the canonical workspace boundary");
    }
  } else {
    const canonicalDocsRoot = await realpath(join(workspace, "docs"));
    if (!isPathWithin(workspace, canonicalDocsRoot) || !isPathWithin(canonicalDocsRoot, canonicalTarget)) {
      throw new Error("docs_read path escapes the canonical documentation boundary");
    }
  }
  return { normalized, absolute: canonicalTarget };
}

export async function readCanonicalDocumentation(
  workspaceRoot: string,
  requestedPath: string,
  requestedHeading?: string,
  requestedMaxChars = DEFAULT_READ_CHARS,
) {
  const { normalized, absolute } = await resolveCanonicalDocPath(workspaceRoot, requestedPath);
  const content = await readBoundedMarkdown(absolute);
  if (content === null) throw new Error(`Documentation file not found or too large: ${normalized}`);
  const heading = requestedHeading?.trim();
  const section = heading ? readMarkdownHeading(normalized, content, heading) : null;
  if (heading && !section) {
    const available = listMarkdownHeadings(content);
    let hint: string;
    if (available.length === 0) {
      hint =
        " This document has no headings; omit `heading` to read the document (the result may be truncated by maxChars).";
    } else {
      const shown = available.slice(0, MAX_HEADINGS_IN_MISS);
      const more = available.length > shown.length ? `, …(+${available.length - shown.length} more)` : "";
      hint = ` Available headings: ${shown.map((entry) => `"${entry}"`).join(", ")}${more}.`;
    }
    throw new Error(`Heading not found in ${normalized}: "${heading}".${hint}`);
  }
  const selected = section?.content ?? content;
  const maxChars = Math.max(1_000, Math.min(MAX_READ_CHARS, Math.trunc(requestedMaxChars) || DEFAULT_READ_CHARS));
  const truncated = selected.length > maxChars;
  return {
    path: normalized,
    heading: section?.heading ?? firstMarkdownHeading(content),
    startLine: section?.startLine ?? 1,
    content: truncated ? `${selected.slice(0, maxChars).trimEnd()}\n…` : selected,
    truncated,
  };
}

export function formatDocumentationSearch(query: string, response: DocumentationSearchResponse) {
  const { results, truncated } = response;
  if (results.length === 0) {
    return `No canonical documentation matches found for: ${query.trim()}${truncated ? " (search stopped at the safe corpus limit)" : ""}`;
  }
  return [
    `Canonical documentation matches for: ${query.trim()}`,
    truncated ? "Note: search stopped at the safe corpus limit; results may be incomplete." : "",
    ...results.map(
      (result, index) =>
        `${index + 1}. Source: ${result.path} — Heading: ${result.heading} — Line: ${result.startLine}\n${result.excerpt}`,
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function formatDocumentationRead(result: Awaited<ReturnType<typeof readCanonicalDocumentation>>) {
  return [
    `Source: ${result.path}`,
    `Heading: ${result.heading}`,
    `Starts at line: ${result.startLine}${result.truncated ? " (bounded excerpt)" : ""}`,
    "",
    result.content,
  ].join("\n");
}
