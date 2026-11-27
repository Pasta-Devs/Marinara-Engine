// ──────────────────────────────────────────────
// UI check: from a git diff to the screens, sizes and themes a change could have affected
// ──────────────────────────────────────────────
// pnpm ui:check (no --full) diffs the working tree against the branch it grew from and checks only:
//   • a component, hook, store or helper → the screens whose code ran it (screen map, screen-map.mjs), at the sizes
//     where it ran; a file no screen runs (a constants file, a barrel) → the screens of the files that import it
//   • a CSS rule → the screens whose page has every class/tag/attribute its selector names, at the sizes its
//     @media allows (overhaul-mobile.css: phones and upright tablets only)
//   • en.json → the screens of the files that use the changed keys
//   • a shared-package export → the screens of the client files that use it
//   • server code → a smoke pass: the core screens on a computer and a phone
//   • themes: the starter themes whose CSS styles something the change touched (all of them when the theme
//     engine, theme tokens or other shared styles changed)
// Anything it can't place goes broad: the check's own scripts, package.json / the lockfile, vite config,
// index.html, main.tsx, a stylesheet it can't parse, or no screen map yet → everything (same as --full).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { diffSheets, loadPostcss, mediaMatches, selectorTokens, splitTopLevel } from "./css-changes.mjs";
import { decodeBits } from "./screen-map.mjs";

const CLIENT_SRC = "packages/client/src/";

/** Changing any of these can change every screen (or the check itself): run everything. */
const FULL_RUN = [
  /^scripts\/ui-check\/(run|detectors|vivaldi|webkit|affected|css-changes|screen-map)\.mjs$/,
  /^scripts\/perf\/(webkit-qc\.mjs|setup-webkit\.sh|setup-vivaldi\.sh)$/,
  /^scripts\/dev\.mjs$/,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
  /^patches\//,
  /^packages\/client\/(package\.json|index\.html|vite\.config\.[cm]?[jt]s|tsconfig[^/]*\.json|postcss\.config[^/]*|tailwind\.config[^/]*)$/,
  /^packages\/client\/src\/(main\.tsx|lib\/ui-check-hook\.ts|styles\/globals\.css)$/,
];

/** Not part of what the app draws. */
const NOT_UI = [
  /^docs\//,
  /^e2e\//,
  /^android\//,
  /^win\//,
  /^tools\//,
  /^\.github\//,
  /^custom_components\//,
  /^scripts\//, // other scripts (ui-check's own are caught by FULL_RUN first)
  /\.md$/i,
  /(^|\/)(__tests__|__mocks__)\//,
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /^packages\/[^/]+\/(test|tests)\//,
  /^[^/]+\.(json|ya?ml|bat|sh|exe|txt|png|jpg)$/i, // repo-root config and launchers (package.json is caught above)
  /^(Dockerfile|LICENSE|\.gitignore|\.gitattributes|\.prettier)/,
];

/** The theme engine itself: a change here can break any theme, so every theme runs. */
const THEME_ENGINE = /theme|accessibility-css|ui-style-overrides/i;
/** Shared style sheets whose rules are token-mapped but which every theme builds on. */
const SHARED_STYLES = /^packages\/client\/src\/styles\/(theme-tokens|overhaul-always|accessibility)\.css$/;

const DESKTOP_FAMILY = new Set(["desktop", "desktop-short", "tablet-landscape"]);

function git(repoRoot, args, options = {}) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options });
}

/** The branch this one grew from: the ref (other than this branch and its own remote) the fewest commits behind. */
export function findBase(repoRoot, explicit) {
  if (explicit) return { ref: explicit, why: "--base" };
  if (process.env.UI_CHECK_BASE) return { ref: process.env.UI_CHECK_BASE, why: "UI_CHECK_BASE" };
  let current = "";
  let upstream = "";
  try {
    current = git(repoRoot, ["symbolic-ref", "-q", "--short", "HEAD"]).trim();
  } catch {
    /* detached */
  }
  try {
    upstream = git(repoRoot, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], {
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    /* none */
  }
  const refs = git(repoRoot, ["for-each-ref", "--format=%(refname:short)", "refs/remotes", "refs/heads"])
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r && !r.endsWith("/HEAD") && r !== current && r !== upstream && !r.endsWith(`/${current || "\0"}`));
  let best = null;
  for (const ref of refs) {
    try {
      const ahead = Number(git(repoRoot, ["rev-list", "--count", `${ref}..HEAD`]).trim());
      if (!best || ahead < best.ahead) best = { ref, ahead };
    } catch {
      /* unrelated ref */
    }
  }
  return best ? { ref: best.ref, why: `nearest branch, ${best.ahead} commit(s) behind this one` } : null;
}

/** Changed paths between the base's merge-base and the working tree (committed, staged, unstaged, untracked). */
export function changedFiles(repoRoot, baseRef) {
  const mergeBase = git(repoRoot, ["merge-base", "HEAD", baseRef]).trim();
  const tracked = git(repoRoot, ["diff", "--name-only", "--no-renames", mergeBase]).split("\n").filter(Boolean);
  const untracked = git(repoRoot, ["ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean);
  return { mergeBase, files: [...new Set([...tracked, ...untracked])].sort() };
}

function oldText(repoRoot, mergeBase, path) {
  try {
    return git(repoRoot, ["show", `${mergeBase}:${path}`], { stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

function newText(repoRoot, path) {
  const full = join(repoRoot, path);
  return existsSync(full) ? readFileSync(full, "utf8") : "";
}

// ── The client's import graph (for files no screen ran directly) ──

function clientSources(repoRoot) {
  const files = git(repoRoot, ["ls-files", "--cached", "--others", "--exclude-standard", CLIENT_SRC])
    .split("\n")
    .filter((f) => /\.(tsx?|jsx?|mjs|css)$/.test(f) && existsSync(join(repoRoot, f)));
  const text = new Map(files.map((f) => [f, readFileSync(join(repoRoot, f), "utf8")]));
  return { files, text };
}

function importersOf(sources) {
  const set = new Set(sources.files);
  const resolve = (from, spec) => {
    let base;
    if (spec.startsWith("@/")) base = join(CLIENT_SRC, spec.slice(2));
    else if (spec.startsWith(".")) base = join(dirname(from), spec);
    else return null;
    base = base.replace(/\?.*$/, "");
    for (const candidate of [base, base.replace(/\.js$/, "")])
      for (const ext of ["", ".ts", ".tsx", ".js", ".mjs", ".jsx", "/index.ts", "/index.tsx"])
        if (set.has(candidate + ext)) return candidate + ext;
    return null;
  };
  const importers = new Map();
  for (const [file, src] of sources.text) {
    if (file.endsWith(".css")) continue;
    const specs = [
      ...src.matchAll(/(?:^|[\s;}])(?:import|export)\s+(?:[^'";]*?\sfrom\s*)?["']([^"']+)["']/g),
      ...src.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g),
    ].map((m) => m[1]);
    for (const spec of specs) {
      const target = resolve(file, spec);
      if (target) (importers.get(target) ?? importers.set(target, new Set()).get(target)).add(file);
    }
  }
  return importers;
}

/** Words a theme's selectors could name, from a source file's strings and data-* attribute names. */
function sourceWords(text) {
  const words = new Set();
  for (const m of text.matchAll(/["'`]([^"'`\n]{1,400})["'`]/g))
    for (const w of m[1].matchAll(/[A-Za-z_][\w-]{2,}/g)) words.add(w[0]);
  for (const m of text.matchAll(/\b(data-[\w-]+)=/g)) words.add(m[1]);
  return words;
}

/** Class names, ids and attribute names/values a selector names (what a theme and a change can share). */
export function selectorWords(selector) {
  const words = new Set();
  for (const alt of splitTopLevel(selector))
    for (const token of selectorTokens(alt)) {
      const m = token.match(/^[.#](.+)$|^\[([^=\]]+)(?:=(.+))?\]$/);
      if (!m) continue;
      if (m[1]) words.add(m[1]);
      if (m[2]?.startsWith("data-")) words.add(m[2]);
      if (m[3]) words.add(m[3]);
    }
  return words;
}

/**
 * screens.mjs: a change inside one screen's entry checks that screen (every size); a change anywhere else in it
 * (the test data, a helper several screens share) can reach every screen. Returns screen ids, or null for "all".
 */
function changedScreenEntries(repoRoot, mergeBase, path, screens) {
  const text = newText(repoRoot, path);
  const lines = text.split("\n");
  const listStart = lines.findIndex((l) => /^export function screenList\(/.test(l));
  if (listStart < 0) return null;
  let patch;
  try {
    patch = git(repoRoot, ["diff", "-U0", "--no-color", mergeBase, "--", path]);
  } catch {
    return null;
  }
  if (!patch.trim() && !existsSync(join(repoRoot, path))) return null;
  const changed = [];
  for (const m of patch.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(m[1]);
    const count = m[2] === undefined ? 1 : Number(m[2]);
    // A pure deletion (count 0) sits after line `start`; count it as that line.
    for (let n = start; n < start + Math.max(count, 1); n++) changed.push(Math.max(n - 1, 0));
  }
  if (!patch.trim()) {
    // Untracked (new) file: no diff against git; treat as everything.
    return null;
  }
  const ids = new Set();
  const entryStart = (i) => {
    for (let j = i; j > listStart; j--) if (/^ {4}(\{|\.\.\.)/.test(lines[j])) return j;
    return -1;
  };
  for (const index of changed) {
    if (index <= listStart) return null;
    const start = entryStart(index);
    if (start < 0) return null;
    let end = start + 1;
    while (end < lines.length && !/^ {4}(\{|\.\.\.)/.test(lines[end]) && !/^ {2}\];/.test(lines[end])) end++;
    if (index >= end) return null; // the closing lines of screenList
    const block = lines.slice(start, end).join("\n");
    let any = false;
    for (const m of block.matchAll(/\bid:\s*(?:"([^"]+)"|`([^`]+)`)/g)) {
      const escape = (part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(
        `^${(m[1] ?? m[2])
          .split(/\$\{[^}]*\}/)
          .map(escape)
          .join(".+")}$`,
      );
      for (const screen of screens) if (pattern.test(screen.id)) (ids.add(screen.id), (any = true));
    }
    if (!any) return null;
  }
  return ids;
}

// ── The choice ──

/**
 * @param {object} o
 * @param {string} o.repoRoot
 * @param {object|null} o.map  the screen map (readScreenMap)
 * @param {Record<string, {viewport:{width:number,height:number}, touch?:string}>} o.sizes  SIZES of run.mjs
 * @param {{id:string, group?:string}[]} o.screens
 * @param {string} [o.base]
 */
export function chooseChecks({ repoRoot, map, sizes, screens, base }) {
  const notes = [];
  const sizeNames = Object.keys(sizes);
  const sizeInfo = Object.fromEntries(
    sizeNames.map((name) => [
      name,
      { width: sizes[name].viewport.width, height: sizes[name].viewport.height, touch: Boolean(sizes[name].touch) },
    ]),
  );
  const full = (why, extra = {}) => ({ full: true, why, notes, ...extra });

  const found = findBase(repoRoot, base);
  if (!found) return full("no branch to compare with (pass --base <branch>)");
  let diff;
  try {
    diff = changedFiles(repoRoot, found.ref);
  } catch (error) {
    return full(`could not diff against ${found.ref}: ${String(error.message ?? error).split("\n")[0]}`);
  }
  const baseLine = `${found.ref} (${found.why}), merge-base ${diff.mergeBase.slice(0, 9)}`;
  if (!diff.files.length) return { full: false, base: baseLine, changed: [], jobs: new Map(), notes, themes: null };

  const SCREENS_FILE = "scripts/ui-check/screens.mjs";
  const screenEdits = diff.files.includes(SCREENS_FILE)
    ? changedScreenEntries(repoRoot, diff.mergeBase, SCREENS_FILE, screens)
    : new Set();
  if (screenEdits === null)
    return full(`${SCREENS_FILE} changed outside one screen's entry (test data or a shared helper)`, {
      base: baseLine,
    });
  const forcing = diff.files.find((f) => FULL_RUN.some((re) => re.test(f)));
  if (forcing) return full(`${forcing} changed (shared by every screen, or the check itself)`, { base: baseLine });
  if (!map) return full("no screen map yet: this run builds it (scripts/ui-check/screen-map.json)", { base: baseLine });

  const keys = map.keys.map((key) => {
    const at = key.lastIndexOf("@");
    return { screen: key.slice(0, at), size: key.slice(at + 1) };
  });
  const keyCount = keys.length;
  const fileBits = (path) => (map.files[path] ? decodeBits(map.files[path], keyCount) : null);
  const tokenBitsCache = new Map();
  const tokenBits = (token) => {
    if (!tokenBitsCache.has(token))
      tokenBitsCache.set(token, map.tokens[token] ? decodeBits(map.tokens[token], keyCount) : null);
    return tokenBitsCache.get(token);
  };

  const jobs = new Map(); // screen id → Set(size)
  const add = (screen, size) => {
    if (!sizes[size]) return false;
    const set = jobs.get(screen) ?? jobs.set(screen, new Set()).get(screen);
    const fresh = !set.has(size);
    set.add(size);
    return fresh;
  };
  /** Adds every key whose bit is on (and whose size passes keep). Returns the screen ids added. */
  const addBits = (bits, keep = () => true) => {
    const hit = new Set();
    bits.forEach((on, i) => {
      if (on && keep(keys[i].size)) {
        add(keys[i].screen, keys[i].size);
        hit.add(keys[i].screen);
      }
    });
    return hit;
  };
  const allScreensAt = (keep) => {
    const hit = new Set();
    for (const s of screens) for (const size of sizeNames) if (keep(size) && add(s.id, size) !== null) hit.add(s.id);
    return hit;
  };
  const describe = (hit) =>
    hit.size === 0 ? "no checked screen" : hit.size > 8 ? `${hit.size} screens` : [...hit].sort().join(", ");

  let allThemes = false;
  const themeWords = new Set();
  let sources = null;
  let importers = null;
  const loadSources = () => {
    sources ??= clientSources(repoRoot);
    return sources;
  };

  /** A client code file → the screens that ran it, or (never ran) the screens of the files importing it. */
  const addCodeFile = (path, seen = new Set()) => {
    const bits = fileBits(path);
    if (bits) return addBits(bits);
    importers ??= importersOf(loadSources());
    const hit = new Set();
    let frontier = [path];
    seen.add(path);
    for (let depth = 0; depth < 8 && frontier.length; depth++) {
      const next = [];
      for (const file of frontier)
        for (const parent of importers.get(file) ?? []) {
          if (seen.has(parent)) continue;
          seen.add(parent);
          const parentBits = fileBits(parent);
          if (parentBits) for (const s of addBits(parentBits)) hit.add(s);
          else next.push(parent);
        }
      frontier = next;
    }
    return hit;
  };

  let postcss = null;
  const smoke = () => {
    const hit = new Set();
    for (const s of screens.filter((s) => s.group === "core"))
      for (const size of ["desktop", "phone"]) if (add(s.id, size)) hit.add(s.id);
    return hit;
  };

  if (screenEdits.size) {
    for (const id of screenEdits) for (const size of sizeNames) add(id, size);
    notes.push({ path: SCREENS_FILE, what: `screen entries changed → ${[...screenEdits].join(", ")} (every size)` });
  }
  for (const path of diff.files) {
    if (path === SCREENS_FILE || /(^|\/)node_modules(\/|$)|(^|\/)\.tmp\//.test(path)) continue;
    const isClient = path.startsWith(CLIENT_SRC);
    if (!isClient && NOT_UI.some((re) => re.test(path)) && !path.startsWith("packages/")) {
      notes.push({ path, what: "not part of the app's screens: nothing to check" });
      continue;
    }
    if (path === "scripts/ui-check/screen-map.json" || path === "scripts/ui-check/allow.json") {
      notes.push({ path, what: "check data only: nothing to check" });
      continue;
    }
    if (!isClient && NOT_UI.some((re) => re.test(path))) {
      notes.push({ path, what: "tests or docs: nothing to check" });
      continue;
    }

    if (path.startsWith("packages/server/")) {
      const hit = smoke();
      notes.push({ path, what: `server code: smoke pass, core screens on desktop + phone (${hit.size} screen(s))` });
      continue;
    }

    if (path.startsWith("packages/shared/src/")) {
      const text = newText(repoRoot, path) + oldText(repoRoot, diff.mergeBase, path);
      const names = new Set(
        [...text.matchAll(/export\s+(?:declare\s+)?(?:const|let|function\*?|class|enum|type|interface)\s+(\w+)/g)].map(
          (m) => m[1],
        ),
      );
      for (const m of text.matchAll(/export\s*\{([^}]*)\}/g))
        for (const part of m[1].split(",")) {
          const name = part
            .trim()
            .split(/\s+as\s+/)
            .pop();
          if (name) names.add(name);
        }
      const users = [...loadSources().text].filter(
        ([file, src]) =>
          !file.endsWith(".css") &&
          src.includes("@marinara-engine/shared") &&
          [...names].some((n) => new RegExp(`\\b${n}\\b`).test(src)),
      );
      const hit = new Set();
      for (const [file] of users) for (const s of addCodeFile(file)) hit.add(s);
      notes.push({
        path,
        what: names.size
          ? `shared code used by ${users.length} client file(s) → ${describe(hit)}`
          : "shared code with no exports the client uses → nothing to check",
      });
      continue;
    }

    if (!path.startsWith("packages/client/")) {
      // Another workspace package or an unknown top-level file: be safe.
      const hit = allScreensAt(() => true);
      notes.push({ path, what: `not sure what this affects → all ${hit.size} screens` });
      continue;
    }

    if (/\/localization\/locales\/[^/]+\.json$/.test(path)) {
      if (!path.endsWith("/en.json")) {
        notes.push({ path, what: "another language (the check runs in English): nothing to check" });
        continue;
      }
      let before = {};
      let after = {};
      try {
        before = JSON.parse(oldText(repoRoot, diff.mergeBase, path) || "{}");
        after = JSON.parse(newText(repoRoot, path) || "{}");
      } catch {
        const hit = allScreensAt(() => true);
        notes.push({ path, what: `could not read the English strings → all ${hit.size} screens` });
        continue;
      }
      const changedKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
        (k) => k !== "_meta" && before[k] !== after[k],
      );
      const { text } = loadSources();
      const hit = new Set();
      const unused = [];
      for (const key of changedKeys) {
        let users = [...text].filter(([f, src]) => !f.includes("/locales/") && src.includes(key)).map(([f]) => f);
        // Keys built at run time (t(`settings.tabs.${id}`)): look for the part before the last dot.
        let prefix = key;
        while (!users.length && prefix.split(".").length > 2) {
          prefix = prefix.slice(0, prefix.lastIndexOf("."));
          users = [...text]
            .filter(([f, src]) => !f.includes("/locales/") && src.includes(`${prefix}.`))
            .map(([f]) => f);
        }
        if (!users.length) unused.push(key);
        for (const file of users) for (const s of file.endsWith(".css") ? [] : addCodeFile(file)) hit.add(s);
        for (const file of users) for (const w of sourceWords(text.get(file) ?? "")) themeWords.add(w);
      }
      notes.push({
        path,
        what: `${changedKeys.length} English string(s) → ${describe(hit)}${unused.length ? ` (${unused.length} not used by any screen's code)` : ""}`,
      });
      continue;
    }

    if (path.endsWith(".css")) {
      const sheetSizes = /overhaul-mobile\.css$/.test(path)
        ? new Set(["phone", "tablet-portrait"])
        : new Set(sizeNames);
      if (THEME_ENGINE.test(path) || SHARED_STYLES.test(path)) allThemes = true;
      postcss ??= loadPostcss(repoRoot);
      let changes;
      try {
        changes = diffSheets(postcss, oldText(repoRoot, diff.mergeBase, path), newText(repoRoot, path), path);
      } catch (error) {
        const hit = allScreensAt((size) => sheetSizes.has(size));
        allThemes = true;
        notes.push({
          path,
          what: `could not read this stylesheet (${error.reason ?? error.message}) → all ${hit.size} screens`,
        });
        continue;
      }
      const rules = [...changes.changedRules];
      const broadAt = [];
      for (const at of changes.changedAtRules) {
        const keyframes = at.match(/^@(?:-webkit-)?keyframes\s+(\S+)/i);
        const utility = at.match(/^@utility\s+([\w-]+)/i);
        if (keyframes) {
          // An animation: the rules that use it.
          for (const rule of changes.flat.rules.values()) if (rule.body.includes(keyframes[1])) rules.push(rule);
        } else if (utility) {
          rules.push({ selectors: [`.${utility[1]}`], selector: `.${utility[1]}`, media: [] });
        } else broadAt.push(at);
      }
      const hit = new Set();
      if (broadAt.length) {
        for (const s of allScreensAt((size) => sheetSizes.has(size))) hit.add(s);
        allThemes = true;
      }
      for (const rule of rules) {
        const keep = (size) => sheetSizes.has(size) && rule.media.every((query) => mediaMatches(query, sizeInfo[size]));
        for (const word of selectorWords(rule.selector)) themeWords.add(word);
        for (const alt of rule.selectors) {
          const needed = [...selectorTokens(alt)];
          if (!needed.length) {
            for (const s of allScreensAt(keep)) hit.add(s);
            continue;
          }
          const bitsList = needed.map(tokenBits);
          if (bitsList.some((b) => !b)) continue; // names something no checked screen has
          const both = bitsList[0].map((on, i) => on && bitsList.every((b) => b[i]));
          for (const s of addBits(both, keep)) hit.add(s);
        }
      }
      notes.push({
        path,
        what: `${changes.changedRules.length} rule(s)${changes.changedAtRules.length ? ` + ${changes.changedAtRules.length} at-rule(s)` : ""}${broadAt.length ? ` (${broadAt.slice(0, 2).join(", ")} reaches every page)` : ""} → ${describe(hit)}`,
      });
      continue;
    }

    if (/\.(tsx?|jsx?|mjs)$/.test(path) && path.startsWith(CLIENT_SRC)) {
      if (/\.(test|spec)\./.test(path) || /\/__tests__\//.test(path) || /\.d\.ts$/.test(path)) {
        notes.push({ path, what: "tests or types: nothing to check" });
        continue;
      }
      if (THEME_ENGINE.test(path)) allThemes = true;
      const hit = addCodeFile(path);
      for (const w of sourceWords(newText(repoRoot, path))) themeWords.add(w);
      const ran = Boolean(fileBits(path));
      notes.push({
        path,
        what: hit.size
          ? `${ran ? "runs on" : "used through the files importing it, on"} ${describe(hit)}`
          : existsSync(join(repoRoot, path))
            ? "not shown on any checked screen"
            : "deleted; its importers changed too",
      });
      continue;
    }

    // Pictures, fonts and other client files: the code that names them.
    const name = basename(path);
    const { text } = loadSources();
    const users = [...text].filter(([, src]) => src.includes(name)).map(([f]) => f);
    const hit = new Set();
    for (const file of users)
      if (file.endsWith(".css")) for (const s of allScreensAt(() => true)) hit.add(s);
      else for (const s of addCodeFile(file)) hit.add(s);
    notes.push({
      path,
      what: users.length ? `used by ${users.length} file(s) → ${describe(hit)}` : "not used by the client code",
    });
  }

  // A screen the map doesn't know yet (added since the map was built) is always checked.
  const known = new Set(keys.map((k) => k.screen));
  const unmapped = screens.filter((s) => !known.has(s.id)).map((s) => s.id);
  if (jobs.size && unmapped.length) {
    for (const id of unmapped) for (const size of sizeNames) add(id, size);
    notes.push({ path: "(screen list)", what: `not in the screen map yet, always checked: ${unmapped.join(", ")}` });
  }

  return {
    full: false,
    base: baseLine,
    changed: diff.files,
    jobs,
    notes,
    themes: { all: allThemes, words: themeWords },
    mapCommit: map.commit,
  };
}

/** Does a theme's CSS style anything the change touched? */
export function themeTouches(themeCss, words) {
  if (!themeCss) return true;
  const selectors = [];
  for (const m of themeCss.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}@;]+)\{/g)) selectors.push(m[1]);
  for (const selector of selectors) for (const word of selectorWords(selector)) if (words.has(word)) return true;
  return false;
}

export { DESKTOP_FAMILY };
