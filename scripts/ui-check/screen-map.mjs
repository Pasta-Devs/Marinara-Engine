// ──────────────────────────────────────────────
// UI check: the screen map (which code and which page elements each screen uses, at each size)
// ──────────────────────────────────────────────
// A full run (pnpm ui:check:full, or --update-map) records, for every screen at every size:
//   • files:  the client source files whose functions actually ran while the screen was open (V8 coverage through
//             the dev server, one module per file), and
//   • tokens: every tag, class, id and attribute on the page (and on each of its tabs).
// affected.mjs then turns a git diff into screens: a changed component → the screens that ran it; a changed CSS
// rule → the screens whose page has everything its selector names. The map is a cache: a stale one only means
// a screen is chosen by code it used to run; a screen with no entry (a new screen) is always checked.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { keepsAttributeValue, keepsId } from "./css-changes.mjs";

export const MAP_VERSION = 1;

/** Starts function-level coverage for one page (Chromium only). Returns stop() → client source paths that ran. */
export async function startCoverage(context, page, repoRoot) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Profiler.enable");
  // Function granularity only: much cheaper than block coverage, and a file is all the map needs.
  await cdp.send("Profiler.startPreciseCoverage", { callCount: true, detailed: false });
  const ran = new Set();
  const take = async () => {
    const { result } = await cdp.send("Profiler.takePreciseCoverage");
    for (const script of result) {
      const path = sourcePath(script.url, repoRoot);
      if (!path || ran.has(path)) continue;
      // The first entry is the module's own top level, which runs on import; a file "ran" when one of its
      // functions (a component, a hook, a helper) was called.
      if (script.functions.some((fn, i) => i > 0 && fn.ranges[0]?.count > 0)) ran.add(path);
    }
  };
  return {
    take,
    async stop() {
      await take().catch(() => undefined);
      await cdp.send("Profiler.stopPreciseCoverage").catch(() => undefined);
      await cdp.detach().catch(() => undefined);
      return ran;
    },
  };
}

/** Dev-server module URL → repo path (packages/client/src/… or another workspace file), else null. */
export function sourcePath(url, repoRoot) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    return null;
  }
  if (pathname.startsWith("/src/")) return `packages/client${pathname}`;
  if (pathname.startsWith("/@fs/")) {
    const absolute = pathname.slice(4);
    if (absolute.startsWith(`${repoRoot}/`) && !absolute.includes("/node_modules/"))
      return absolute.slice(repoRoot.length + 1);
  }
  return null;
}

/** Runs in the page: every tag, class, id and attribute present (spelled like selectorTokens() spells them). */
export function collectDomTokens([keepAttributeSource, keepIdSource]) {
  const keepsAttributeValue = (0, eval)(`(${keepAttributeSource})`);
  const keepsId = (0, eval)(`(${keepIdSource})`);
  const out = new Set();
  const visit = (root) => {
    for (const el of root.querySelectorAll("*")) {
      out.add(el.localName.toLowerCase());
      for (const attr of el.attributes) {
        const name = attr.name.toLowerCase();
        out.add(`[${name}]`);
        if (name === "class") for (const c of el.classList) out.add(`.${c}`);
        else if (name === "id") {
          if (keepsId(attr.value)) out.add(`#${attr.value}`);
        } else if (name !== "style" && keepsAttributeValue(name, attr.value)) out.add(`[${name}=${attr.value}]`);
      }
      if (el.shadowRoot) visit(el.shadowRoot);
    }
  };
  out.add("html");
  for (const attr of document.documentElement.attributes) {
    const name = attr.name.toLowerCase();
    out.add(`[${name}]`);
    if (name === "class") for (const c of document.documentElement.classList) out.add(`.${c}`);
    else if (name !== "style" && keepsAttributeValue(name, attr.value)) out.add(`[${name}=${attr.value}]`);
  }
  visit(document);
  return [...out];
}

export const collectDomTokensArg = [keepsAttributeValue.toString(), keepsId.toString()];

// ── The map file ──
// { version, builtAt, commit, sizes, keys: ["home@desktop", …], files: { path: bits }, tokens: { token: bits } }
// bits: base64 of a bitset over keys, or "*" for every key.

function encode(bits, count) {
  if (bits.every(Boolean) && bits.length === count) return "*";
  const bytes = Buffer.alloc(Math.ceil(count / 8));
  bits.forEach((on, i) => {
    if (on) bytes[i >> 3] |= 1 << (i & 7);
  });
  return bytes.toString("base64");
}

export function decodeBits(value, count) {
  if (value === "*") return new Array(count).fill(true);
  const bytes = Buffer.from(value, "base64");
  return Array.from({ length: count }, (_, i) => Boolean(bytes[i >> 3] & (1 << (i & 7))));
}

/** results: [{ screen, size, files: Set, tokens: Set }] from a pass over every screen at every size. */
export function writeScreenMap(file, results, { commit, sizes }) {
  const keys = results.map((r) => `${r.screen}@${r.size}`);
  const byFile = new Map();
  const byToken = new Map();
  results.forEach((r, index) => {
    for (const f of r.files) (byFile.get(f) ?? byFile.set(f, []).get(f)).push(index);
    for (const t of r.tokens) (byToken.get(t) ?? byToken.set(t, []).get(t)).push(index);
  });
  const pack = (map) =>
    Object.fromEntries(
      [...map.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([name, indexes]) => {
          const bits = new Array(keys.length).fill(false);
          for (const i of indexes) bits[i] = true;
          return [name, encode(bits, keys.length)];
        }),
    );
  const map = {
    version: MAP_VERSION,
    builtAt: new Date().toISOString(),
    commit,
    sizes,
    keys,
    files: pack(byFile),
    tokens: pack(byToken),
  };
  writeFileSync(file, `${JSON.stringify(map, null, 0).replace(/,"(files|tokens)":/g, ',\n"$1":')}\n`);
  return map;
}

export function readScreenMap(file) {
  if (!existsSync(file)) return null;
  try {
    const map = JSON.parse(readFileSync(file, "utf8"));
    return map.version === MAP_VERSION ? map : null;
  } catch {
    return null;
  }
}
