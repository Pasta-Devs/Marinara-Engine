import type { MariDbCommandResult } from "@marinara-engine/shared";
import { FandomMediaWikiClient } from "./fandom-mediawiki-client.js";
import { formatWikiPayload } from "./format-wiki-result.js";
import type { ProfessorMariWikiPayload, WikiPageContentMode } from "./types.js";

type CliContext = {
  command: string;
};

const BOOLEAN_FLAGS = new Set([
  "case-sensitive",
  "help",
  "include-statistics",
  "metadata",
  "no-metadata",
  "regex",
]);

function parseArgs(args: string[]) {
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const eqIndex = arg.indexOf("=");
    if (eqIndex > 2) {
      flags.set(arg.slice(2, eqIndex), arg.slice(eqIndex + 1));
      continue;
    }
    const name = arg.slice(2);
    const next = args[i + 1];
    if (next !== undefined && !next.startsWith("--") && !BOOLEAN_FLAGS.has(name)) {
      flags.set(name, next);
      i += 1;
    } else {
      flags.set(name, true);
    }
  }
  return { positionals, flags };
}

function flagString(flags: Map<string, string | boolean>, name: string): string | undefined {
  const value = flags.get(name);
  return typeof value === "string" ? value : undefined;
}

function hasFlag(flags: Map<string, string | boolean>, name: string): boolean {
  return flags.has(name) && flags.get(name) !== false;
}

function flagNumber(flags: Map<string, string | boolean>, name: string): number | undefined {
  const raw = flagString(flags, name);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringListFromFlag(value: string | undefined) {
  return value
    ?.split(/[|,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function outputResult<T>(
  context: CliContext,
  flags: Map<string, string | boolean>,
  payload: ProfessorMariWikiPayload<T>,
): MariDbCommandResult {
  const output = flagString(flags, "output") === "json" ? payload : formatWikiPayload(payload as ProfessorMariWikiPayload<unknown>);
  return {
    ok: payload.ok,
    mode: "read",
    command: context.command,
    output,
  };
}

function required(value: string | undefined, message: string): string {
  if (!value?.trim()) throw new Error(message);
  return value.trim();
}

function contentMode(value: string | undefined): WikiPageContentMode | undefined {
  if (!value) return undefined;
  if (value === "summary" || value === "source" || value === "html" || value === "none") return value;
  throw new Error("--content must be summary, source, html, or none.");
}

export function wikiHelpText() {
  return [
    "Usage: mari wiki <command>",
    "Discovery:",
    "  find-wikis <query> [--lang en] [--limit 10]",
    "  search-all <query> [--lang en] [--namespace 0] [--limit 10]",
    "Wiki reads:",
    "  search <wiki> <query> [--limit 10] [--continue <token>]",
    "  get-page (--wiki <wiki> --title <title> | --page-url <url>) [--content summary|source|html|none] [--section <n>]",
    "  pages <wiki> <title...> [--content summary|source|none]",
    "  sections (--wiki <wiki> --title <title> | --page-url <url>) [--section <n> --content source|html]",
    "  category <wiki> <category> [--type page|subcat|file] [--namespace <id>] [--limit 50] [--continue <token>]",
    "  site-info <wiki> [--include-statistics]",
    "  search-in-page (--wiki <wiki> --title <title> | --page-url <url>) <query> [--regex] [--case-sensitive] [--context-lines 2]",
    "Output:",
    "  Plain readable text by default. Add --output json for structured details.",
    "Examples:",
    "  mari wiki find-wikis genshin",
    "  mari wiki search genshin-impact Nahida",
    "  mari wiki get-page --page-url https://genshin-impact.fandom.com/wiki/Nahida",
    "  mari wiki sections --wiki genshin-impact --title Nahida",
    "  mari wiki get-page --wiki genshin-impact --title Nahida --content source --section 3",
  ].join("\n");
}

export function wikiCommandHelpText(command: string) {
  switch (command) {
    case "find-wikis":
    case "find":
      return [
        "Usage: mari wiki find-wikis <query> [--lang en] [--limit 10]",
        "Find Fandom communities by topic.",
      ].join("\n");
    case "search-all":
      return [
        "Usage: mari wiki search-all <query> [--lang en] [--namespace 0] [--limit 10]",
        "Search indexed Fandom pages across communities.",
      ].join("\n");
    case "search":
    case "search-wiki":
      return [
        "Usage: mari wiki search <wiki> <query> [--limit 10] [--continue <token>]",
        "Search inside one Fandom wiki. Wiki may be a slug or URL.",
      ].join("\n");
    case "get-page":
    case "get":
      return [
        "Usage: mari wiki get-page (--wiki <wiki> --title <title> | --page-url <url>) [--content summary|source|html|none] [--section <n>]",
        "Read one Fandom wiki page. Defaults to summary.",
      ].join("\n");
    case "pages":
      return [
        "Usage: mari wiki pages <wiki> <title...> [--content summary|source|none]",
        "Read up to 50 pages from the same wiki.",
      ].join("\n");
    case "sections":
      return [
        "Usage: mari wiki sections (--wiki <wiki> --title <title> | --page-url <url>) [--section <n> --content source|html]",
        "List page sections, optionally reading one section.",
      ].join("\n");
    case "category":
    case "category-members":
      return [
        "Usage: mari wiki category <wiki> <category> [--type page|subcat|file] [--namespace <id>] [--limit 50] [--continue <token>]",
        "List category members and return MediaWiki continuation tokens.",
      ].join("\n");
    case "site-info":
      return [
        "Usage: mari wiki site-info <wiki> [--include-statistics]",
        "Resolve and inspect one Fandom wiki.",
      ].join("\n");
    case "search-in-page":
      return [
        "Usage: mari wiki search-in-page (--wiki <wiki> --title <title> | --page-url <url>) <query> [--regex] [--case-sensitive] [--context-lines 2]",
        "Search within one page's source text.",
      ].join("\n");
    default:
      return wikiHelpText();
  }
}

export async function executeWikiCli(args: string[], context: CliContext): Promise<MariDbCommandResult> {
  const parsed = parseArgs(args);
  const command = parsed.positionals[0];
  if (!command || command === "help" || hasFlag(parsed.flags, "help")) {
    return {
      ok: true,
      mode: "read",
      command: context.command,
      output: command && command !== "help" ? wikiCommandHelpText(command) : wikiHelpText(),
    };
  }

  const client = new FandomMediaWikiClient();
  try {
    switch (command) {
      case "find":
      case "find-wikis": {
        const query = required(parsed.positionals.slice(1).join(" ") || flagString(parsed.flags, "query"), "Query is required.");
        return outputResult(
          context,
          parsed.flags,
          await client.findWikis({ query, lang: flagString(parsed.flags, "lang"), limit: flagNumber(parsed.flags, "limit") }),
        );
      }
      case "search-all": {
        const query = required(parsed.positionals.slice(1).join(" ") || flagString(parsed.flags, "query"), "Query is required.");
        return outputResult(
          context,
          parsed.flags,
          await client.searchAll({
            query,
            lang: flagString(parsed.flags, "lang"),
            namespace: flagNumber(parsed.flags, "namespace"),
            limit: flagNumber(parsed.flags, "limit"),
          }),
        );
      }
      case "search":
      case "search-wiki": {
        const wiki = required(flagString(parsed.flags, "wiki") ?? parsed.positionals[1], "Wiki is required.");
        const query =
          flagString(parsed.flags, "query") ??
          parsed.positionals
            .slice(2)
            .join(" ")
            .trim();
        return outputResult(
          context,
          parsed.flags,
          await client.searchWiki({
            wiki,
            query: required(query, "Query is required."),
            limit: flagNumber(parsed.flags, "limit"),
            continueFrom: flagString(parsed.flags, "continue") ?? flagString(parsed.flags, "continueFrom"),
          }),
        );
      }
      case "get":
      case "get-page": {
        const title = flagString(parsed.flags, "title") ?? parsed.positionals.slice(1).join(" ").trim();
        return outputResult(
          context,
          parsed.flags,
          await client.getPage({
            wiki: flagString(parsed.flags, "wiki"),
            title: title || undefined,
            pageId: flagNumber(parsed.flags, "page-id") ?? flagNumber(parsed.flags, "pageId"),
            pageUrl: flagString(parsed.flags, "page-url") ?? flagString(parsed.flags, "pageUrl"),
            content: contentMode(flagString(parsed.flags, "content")),
            metadata: hasFlag(parsed.flags, "no-metadata") ? false : undefined,
            section: flagString(parsed.flags, "section"),
          }),
        );
      }
      case "pages": {
        const wiki = required(flagString(parsed.flags, "wiki") ?? parsed.positionals[1], "Wiki is required.");
        const flaggedTitles = stringListFromFlag(flagString(parsed.flags, "titles"));
        const titles = flaggedTitles && flaggedTitles.length > 0 ? flaggedTitles : parsed.positionals.slice(2);
        const mode = contentMode(flagString(parsed.flags, "content"));
        if (mode === "html") throw new Error("--content for pages must be summary, source, or none.");
        return outputResult(
          context,
          parsed.flags,
          await client.getPages({
            wiki,
            titles,
            content: mode,
            metadata: hasFlag(parsed.flags, "no-metadata") ? false : undefined,
          }),
        );
      }
      case "sections": {
        const title = flagString(parsed.flags, "title") ?? parsed.positionals.slice(1).join(" ").trim();
        const mode = contentMode(flagString(parsed.flags, "content"));
        if (mode === "summary") throw new Error("--content for sections must be source, html, or none.");
        return outputResult(
          context,
          parsed.flags,
          await client.getSections({
            wiki: flagString(parsed.flags, "wiki"),
            title: title || undefined,
            pageUrl: flagString(parsed.flags, "page-url") ?? flagString(parsed.flags, "pageUrl"),
            section: flagString(parsed.flags, "section"),
            content: mode,
          }),
        );
      }
      case "category":
      case "category-members": {
        const wiki = required(flagString(parsed.flags, "wiki") ?? parsed.positionals[1], "Wiki is required.");
        const category = required(flagString(parsed.flags, "category") ?? parsed.positionals.slice(2).join(" "), "Category is required.");
        const type = flagString(parsed.flags, "type");
        if (type && type !== "page" && type !== "subcat" && type !== "file") {
          throw new Error("--type must be page, subcat, or file.");
        }
        const memberType = type as "page" | "subcat" | "file" | undefined;
        return outputResult(
          context,
          parsed.flags,
          await client.getCategoryMembers({
            wiki,
            category,
            type: memberType,
            namespace: flagNumber(parsed.flags, "namespace"),
            limit: flagNumber(parsed.flags, "limit"),
            continueFrom: flagString(parsed.flags, "continue") ?? flagString(parsed.flags, "continueFrom"),
          }),
        );
      }
      case "site-info": {
        const wiki = required(flagString(parsed.flags, "wiki") ?? parsed.positionals[1], "Wiki is required.");
        return outputResult(
          context,
          parsed.flags,
          await client.getSiteInfo({ wiki, includeStatistics: hasFlag(parsed.flags, "include-statistics") }),
        );
      }
      case "search-in-page": {
        const query =
          flagString(parsed.flags, "query") ??
          (flagString(parsed.flags, "wiki") || flagString(parsed.flags, "page-url") || flagString(parsed.flags, "pageUrl")
            ? parsed.positionals.slice(1).join(" ")
            : parsed.positionals.slice(3).join(" "));
        return outputResult(
          context,
          parsed.flags,
          await client.searchInPage({
            wiki: flagString(parsed.flags, "wiki") ?? parsed.positionals[1],
            title: flagString(parsed.flags, "title") ?? parsed.positionals[2],
            pageUrl: flagString(parsed.flags, "page-url") ?? flagString(parsed.flags, "pageUrl"),
            query: required(query, "Query is required."),
            regex: hasFlag(parsed.flags, "regex"),
            caseSensitive: hasFlag(parsed.flags, "case-sensitive"),
            contextLines: flagNumber(parsed.flags, "context-lines") ?? flagNumber(parsed.flags, "contextLines"),
          }),
        );
      }
      default:
        return { ok: false, mode: "read", command: context.command, error: `Unknown mari wiki command: ${command}\n${wikiHelpText()}` };
    }
  } catch (err) {
    return {
      ok: false,
      mode: "read",
      command: context.command,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
