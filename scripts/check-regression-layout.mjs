#!/usr/bin/env node
// Keeps new Node regressions out of the flat scripts/regressions/ folder and away from reading the app's source as
// text. Files that were already there when this check arrived are listed in scripts/regressions/layout-exceptions.json.
// That list never gains a file: an entry whose file is gone or has stopped reading source is an error until removed,
// and a "readsSource" file that moves takes its entry with it.
// See CONTRIBUTING.md § Where a Node regression goes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverRegressions } from "./run-regressions.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGRESSIONS = "scripts/regressions/";
const EXCEPTIONS_FILE = "scripts/regressions/layout-exceptions.json";

/** The folders a new regression may go in, named after the part of the app it covers. Add one when no area fits. */
export const REGRESSION_AREAS = {
  "advanced-memory": "Advanced Memory, memory recall and embeddings",
  agents: "built-in, custom and downloadable agents: Illustrator, Beholder, Music DJ and the rest",
  avatars: "avatars, sprites, expressions and PNGtuber",
  "capability-packages": "capability packages, their install checks, runtime and APIs",
  characters: "character cards, personas and groups",
  chat: "chats, messages, branches, summaries, the gallery and Conversation mode",
  connections: "connections, providers, models and the requests sent to them",
  decision: "the Decision sidecar",
  extensions: "personal extensions and their IPC",
  game: "Game mode outside the ruleset engine: worlds, experiences, scenes and NPCs",
  "game-ruleset": "the ruleset format and engine: combat, sheets, checks, items and dice",
  image: "image generation and image processing",
  launcher: "the launchers, installers and the app updater",
  lorebook: "lorebooks and their keyword matching",
  mari: "Mari's app-data tools: the handbooks and the reads and edits Mari makes to characters, chats, presets and more",
  multiplayer: "multiplayer rooms shared between peers: seats, rosters and shared Game sessions",
  noodle: "Noodle, the creator and fan feed: posts, polls, mentions and the autopost scheduler",
  "professor-mari": "Professor Mari's workspace agent: its queue, skills, sandbox, file access and round reviews",
  prompt: "prompt assembly, macros, presets, context fit and regex scripts",
  roleplay: "Roleplay mode and its trackers",
  security: "authentication, sandboxes, extension security and file-access checks",
  server:
    "server start-up and shutdown, storage, backups, logging, the local utility sidecar and platforms (Android, Termux, Docker)",
  tooling: "repository scripts, CI workflows, Dottore Review and release tooling",
  tts: "text to speech, speech to text, music and other audio",
  ui: "the client shell: onboarding, omnibar, themes, localization and layout",
};

// How a test that reads source text names the file: a quoted path into an app's src folder (a whole path, a folder, or
// the start of a template such as `packages/client/src/${file}`), or the same path in join() segments.
const QUOTED = /(["'`])((?:(?!\1)[^\n])*)\1/gu;
const SOURCE_FOLDER = /packages\/(?:client|server|shared)\/src(?:\/|$|\$\{)/u;
const SOURCE_SEGMENTS = /["'`]packages["'`]\s*,\s*["'`](?:client|server|shared)["'`]\s*,\s*["'`]src["'`]/u;
// A file of one of these types is code; any other extension (locale JSON, images) is data, and so is src/assets/.
const CODE_EXTENSION = /^(?:tsx?|css|m?js)$/u;
const ASSETS = /\/src\/assets(?:\/|$)/u;
// Lines that don't read source: comments, imports, file URLs for import(), and child processes that run it.
const NOT_A_READ =
  /^\s*(?:\/\/|\/?\*|import\b|export\b[^"'`]*\bfrom\b|\}\s*from\b)|\bimport\(|pathToFileURL\(|\b(?:spawn|spawnSync|execFile|execFileSync|fork)\(/u;
const READS_FILES = /\breadFile(?:Sync)?\(/u;
// The reason must follow on the same line.
const OPT_OUT = /regression-layout: source-path[ \t]+\S/u;

function namesSourceFile(line) {
  if (NOT_A_READ.test(line)) return false;
  if (SOURCE_SEGMENTS.test(line)) return true;
  for (const [, , quoted] of line.matchAll(QUOTED)) {
    if (!SOURCE_FOLDER.test(quoted) || ASSETS.test(quoted)) continue;
    const extension = /\.([A-Za-z0-9]+)$/u.exec(quoted.split("/").pop())?.[1];
    if (extension === undefined || CODE_EXTENSION.test(extension)) return true;
  }
  return false;
}

/** Whether a regression reads the app's own source files as text, without saying why it names them. */
export function readsAppSource(text) {
  if (OPT_OUT.test(text) || !READS_FILES.test(text)) return false;
  return text.split("\n").some(namesSourceFile);
}

/**
 * The problems with a set of regression files. `files` holds `{ path, text }` with repository-relative `/` paths;
 * `exceptions` is the parsed layout-exceptions.json. Returns readable messages; none means the layout is fine.
 */
export function checkRegressionLayout(files, exceptions, areas = REGRESSION_AREAS) {
  const problems = [];
  const topLevel = new Set(exceptions.topLevel);
  const readsSource = new Set(exceptions.readsSource);
  const texts = new Map(files.map((file) => [file.path, file.text]));
  const areaList = Object.entries(areas)
    .map(([name, covers]) => `    ${name}/  ${covers}`)
    .join("\n");

  for (const file of files) {
    const [folder, ...rest] = file.path.slice(REGRESSIONS.length).split("/");
    if (rest.length === 0) {
      if (!topLevel.has(file.path)) {
        problems.push(
          `${file.path}: new regressions go in an area folder, not directly in ${REGRESSIONS}. ` +
            `If a file there already covers this feature, add your case to it; otherwise move this file into the ` +
            `folder for the part of the app it covers (add a folder to REGRESSION_AREAS in ` +
            `scripts/check-regression-layout.mjs when none fits):\n${areaList}`,
        );
      }
    } else if (!Object.hasOwn(areas, folder)) {
      problems.push(
        `${file.path}: ${REGRESSIONS}${folder}/ is not an area folder. Use one of these, or add it to ` +
          `REGRESSION_AREAS in scripts/check-regression-layout.mjs:\n${areaList}`,
      );
    }
    if (!readsSource.has(file.path) && readsAppSource(file.text)) {
      problems.push(
        `${file.path}: reads the app's source code as text. Such checks break on harmless refactors and pass when ` +
          `the behaviour is broken, so test what the code does instead: import it, call it and assert on the result. ` +
          `If the file names source for another reason (it starts the real server, say), or reading it is the point ` +
          `(a build or packaging check), give the reason in a comment "regression-layout: source-path <reason>". ` +
          `If this file was moved from a path listed in "readsSource" in ${EXCEPTIONS_FILE}, update that entry's path.`,
      );
    }
  }

  for (const listed of topLevel) {
    if (!texts.has(listed)) {
      problems.push(`${EXCEPTIONS_FILE}: "${listed}" is no longer in ${REGRESSIONS}; remove it from "topLevel".`);
    }
  }
  for (const listed of readsSource) {
    if (!texts.has(listed)) {
      problems.push(
        `${EXCEPTIONS_FILE}: "${listed}" no longer exists. If it moved, change this "readsSource" entry to its new ` +
          `path; if it was deleted, remove the entry.`,
      );
    } else if (!readsAppSource(texts.get(listed))) {
      problems.push(`${EXCEPTIONS_FILE}: "${listed}" no longer reads app source; remove it from "readsSource".`);
    }
  }
  return problems;
}

/** The regression files in the repository, with their text. */
export function readRegressionFiles() {
  return discoverRegressions().map((relative) => ({
    path: relative,
    text: fs.readFileSync(path.join(repositoryRoot, relative), "utf8"),
  }));
}

if (
  process.argv[1] &&
  fs.existsSync(process.argv[1]) &&
  fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const exceptions = JSON.parse(fs.readFileSync(path.join(repositoryRoot, EXCEPTIONS_FILE), "utf8"));
  const problems = checkRegressionLayout(readRegressionFiles(), exceptions);
  if (problems.length > 0) {
    console.error(`Regression layout check failed (${problems.length}):\n\n${problems.join("\n\n")}`);
    process.exit(1);
  }
  console.log("Regression layout check passed.");
}
