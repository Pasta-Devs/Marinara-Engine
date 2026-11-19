/**
 * Decisions about a given picture, for a decision model that reads pictures.
 *
 * Marinara makes pictures (Illustrator, selfies, weather versions, sprites) and keeps
 * a library of them (backgrounds). A decision model that reads pictures can say whether
 * one shows what was asked for, cheaply and on this computer. Everything here is
 * optional twice over: the feature's own setting, and a selected decision model that
 * reads pictures. Without either, nothing is asked and nothing changes.
 *
 * Statements are worded as statements, like every other decision, and the answers are
 * the model's probabilities, compared with its own operating point.
 */
import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { DECISION_SETTINGS_KEYS, resolveDecisionBackend, type DecisionBackend } from "./decision-default.js";
import { attachDecisionPictures, decisionMediaForMessage } from "./decision-media.js";

/** True when the backend is Marinara's own decision model and it reads pictures. */
export function backendReadsPictures(backend: DecisionBackend | null | undefined): backend is DecisionBackend {
  return !!backend?.mediaTokens && backend.mediaTokens.picture > 0;
}

/**
 * The selected decision model, only when it reads pictures. Null otherwise, which every
 * caller treats as "this check is off".
 */
export async function resolvePictureDecisionBackend(db: DB, signal?: AbortSignal): Promise<DecisionBackend | null> {
  const appSettings = createAppSettingsStorage(db);
  const connections = createConnectionsStorage(db);
  try {
    const backend = await resolveDecisionBackend(
      {
        getLocalDefault: () => appSettings.get(DECISION_SETTINGS_KEYS.localDefault),
        getThinkingPreGeneration: async () => false,
        getDefaultConnection: () => connections.getDefaultForDecision(),
        getConnectionWithKey: (id) => connections.getWithKey(id),
        debugMode: isDebugAgentsEnabled(),
      },
      signal,
    );
    return backendReadsPictures(backend) ? backend : null;
  } catch (error) {
    logger.debug(error, "[decision] No decision model that reads pictures");
    return null;
  }
}

const PICTURE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/** Raw image bytes as a data URL, from base64 and a file extension. */
export function pictureDataUrl(base64: string, ext: string): string | null {
  const mime = PICTURE_MIME[ext.replace(/^\./u, "").toLowerCase()];
  return mime && base64 ? `data:${mime};base64,${base64}` : null;
}

/** Bare base64 picture bytes (as reference images are kept) as a data URL, by their signature. */
export function sniffedPictureDataUrl(base64: string | null | undefined): string | null {
  if (!base64) return null;
  if (base64.startsWith("data:image/")) return base64;
  const head = Buffer.from(base64.slice(0, 24), "base64");
  const ext =
    head[0] === 0x89 && head[1] === 0x50
      ? "png"
      : head[0] === 0xff && head[1] === 0xd8
        ? "jpg"
        : head.subarray(8, 12).toString("latin1") === "WEBP"
          ? "webp"
          : head.subarray(0, 3).toString("latin1") === "GIF"
            ? "gif"
            : null;
  return ext ? pictureDataUrl(base64, ext) : null;
}

/** A saved picture file as a data URL, or null when it is missing, too large or not a picture. */
export async function pictureFileDataUrl(path: string, maxBytes = 24 * 1024 * 1024): Promise<string | null> {
  try {
    if ((await stat(path)).size > maxBytes) return null;
    return pictureDataUrl((await readFile(path)).toString("base64"), extname(path));
  } catch {
    return null;
  }
}

export interface PictureStatement {
  id: string;
  statement: string;
}

/**
 * Ask statements about the given pictures. Returns each statement's probability, or
 * null when the backend does not read pictures or did not answer. Never throws.
 */
export async function askAboutPictures(args: {
  backend: DecisionBackend;
  pictures: string[];
  statements: PictureStatement[];
  /** A few words on what the pictures are, read with them. */
  context?: string;
}): Promise<Map<string, number> | null> {
  if (!backendReadsPictures(args.backend) || args.pictures.length === 0 || args.statements.length === 0) return null;
  const state = attachDecisionPictures(
    { about: args.context?.trim() || "The attached picture." } as Record<string, unknown>,
    args.pictures,
  );
  try {
    const answers = await args.backend.ask(
      state,
      args.statements.map((entry) => ({ id: entry.id, instructions: entry.statement })),
    );
    return answers && answers.size > 0 ? answers : null;
  } catch (error) {
    logger.debug(error, "[decision] A picture decision failed");
    return null;
  }
}

/** One thing a generated picture should show. `expect: false` for something it should not. */
export interface PictureCheckLine {
  statement: string;
  expect?: boolean;
}

export interface PictureCheckResult {
  /** True when every line came out as expected. */
  passed: boolean;
  /** How well it matched overall, 0 to 1, for keeping the better of two. */
  score: number;
  /** The lines that did not come out as expected. */
  failed: string[];
}

/**
 * Check one picture against what it should show. Null when nothing could be asked,
 * which callers treat as a pass: a check that cannot run never holds a picture back.
 */
export async function checkPicture(args: {
  backend: DecisionBackend;
  picture: string;
  /** A picture to compare with, such as the character's avatar: sent first, the checked one second. */
  reference?: string | null;
  lines: PictureCheckLine[];
  context?: string;
}): Promise<PictureCheckResult | null> {
  const lines = args.lines.filter((line) => line.statement.trim()).slice(0, 8);
  if (lines.length === 0) return null;
  const answers = await askAboutPictures({
    backend: args.backend,
    pictures: args.reference ? [args.reference, args.picture] : [args.picture],
    statements: lines.map((line, index) => ({ id: `c${index}`, statement: line.statement.trim() })),
    context: args.context,
  });
  if (!answers) return null;
  const threshold = args.backend.calibration.defaultThreshold;
  const failed: string[] = [];
  let total = 0;
  let counted = 0;
  lines.forEach((line, index) => {
    const p = answers.get(`c${index}`);
    if (p === undefined) return;
    const expect = line.expect !== false;
    if (expect ? p < threshold : p >= threshold) failed.push(line.statement.trim());
    total += expect ? p : 1 - p;
    counted += 1;
  });
  if (counted === 0) return null;
  return { passed: failed.length === 0, score: total / counted, failed };
}

/** Lines written by the user, one statement per line; a line starting with "not:" should be false. */
export function parsePictureCheckLines(text: unknown): PictureCheckLine[] {
  if (typeof text !== "string") return [];
  return text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((line) => {
      const negated = /^not\s*:\s*/iu.exec(line);
      return negated ? { statement: line.slice(negated[0].length), expect: false } : { statement: line };
    })
    .filter((line) => line.statement.length > 0 && line.statement.length <= 300);
}

export type PictureCheckMode = "off" | "retry" | "best_of_two";

export function normalizePictureCheckMode(value: unknown): PictureCheckMode {
  return value === "retry" || value === "best_of_two" ? value : "off";
}

/**
 * Make a picture, check it, and make another when the check asks for it.
 *
 * - `retry`: one more attempt when the first fails; the better of the two is kept.
 * - `best_of_two`: always two attempts, the better kept.
 *
 * A check that cannot run keeps the first picture. A second attempt that fails to
 * generate keeps the first. Never throws for the check; generation errors from the
 * first attempt propagate as they would without a check.
 */
export async function generateCheckedPicture<T>(args: {
  mode: PictureCheckMode;
  backend: DecisionBackend | null;
  generate: () => Promise<T>;
  toDataUrl: (result: T) => string | null;
  lines: PictureCheckLine[];
  /** See `checkPicture`: when set, lines compare "the second picture" with "the first". */
  reference?: string | null;
  context?: string;
  label: string;
}): Promise<{ result: T; check: PictureCheckResult | null; attempts: number }> {
  const first = await args.generate();
  if (args.mode === "off" || !backendReadsPictures(args.backend) || args.lines.length === 0)
    return { result: first, check: null, attempts: 1 };
  const backend = args.backend;
  const judge = async (result: T) => {
    const picture = args.toDataUrl(result);
    return picture
      ? checkPicture({ backend, picture, reference: args.reference, lines: args.lines, context: args.context })
      : null;
  };
  const firstCheck = await judge(first);
  if (!firstCheck) return { result: first, check: null, attempts: 1 };
  if (args.mode === "retry" && firstCheck.passed) return { result: first, check: firstCheck, attempts: 1 };
  logger.info(
    "[picture-check] %s: %s",
    args.label,
    firstCheck.passed
      ? "making a second to compare"
      : `trying again (${firstCheck.failed.length} line(s) did not match)`,
  );
  let second: T;
  try {
    second = await args.generate();
  } catch (error) {
    logger.warn(error, "[picture-check] %s: the second attempt failed; keeping the first", args.label);
    return { result: first, check: firstCheck, attempts: 2 };
  }
  const secondCheck = await judge(second);
  // Fewer lines missed wins; the score only breaks a tie. A line missed by a hair still
  // adds almost a full point to the score, so the score alone could keep a picture that fails one.
  const better =
    secondCheck !== null &&
    (secondCheck.failed.length < firstCheck.failed.length ||
      (secondCheck.failed.length === firstCheck.failed.length && secondCheck.score > firstCheck.score));
  if (!better) return { result: first, check: firstCheck, attempts: 2 };
  return { result: second, check: secondCheck, attempts: 2 };
}

/**
 * Of a few library pictures, the one that best shows `place`, or null when none clearly
 * does. Each is asked about on its own. Strict on purpose: a wrong yes shows the wrong
 * place, a wrong no only paints a new picture.
 */
export async function pickPictureShowingPlace(args: {
  backend: DecisionBackend;
  place: string;
  candidates: Array<{ id: string; picture: string }>;
}): Promise<string | null> {
  const place = args.place.trim().slice(0, 300);
  if (!place) return null;
  const bar = Math.max(0.8, args.backend.calibration.defaultThreshold);
  let best: { id: string; p: number } | null = null;
  for (const candidate of args.candidates) {
    const answers = await askAboutPictures({
      backend: args.backend,
      pictures: [candidate.picture],
      statements: [{ id: "place", statement: `The picture shows this place: ${place}` }],
      context: "A background picture from the library.",
    });
    const p = answers?.get("place");
    if (p !== undefined && p >= bar && (!best || p > best.p)) best = { id: candidate.id, p };
  }
  return best?.id ?? null;
}

/**
 * The newest picture among the chat's last `within` messages (uploads, gallery pictures,
 * illustrations), as a data URL, or null when there is none.
 */
export async function newestChatPicture(
  messages: ReadonlyArray<{ extra?: unknown }>,
  context: Parameters<typeof decisionMediaForMessage>[1],
  within = 4,
): Promise<string | null> {
  for (const message of [...messages.slice(-within)].reverse()) {
    const pictures = decisionMediaForMessage(message, context).filter((ref) => ref.kind === "image");
    for (const ref of pictures.reverse()) {
      const url = await ref.load().catch(() => null);
      if (url) return url;
    }
  }
  return null;
}

/**
 * Whether the newest picture in the chat already shows what is about to be drawn, so
 * the Illustrator can skip a picture that would repeat it. Strict on purpose: a wrong
 * yes loses a picture, a wrong no only costs one. False whenever it cannot tell.
 */
export async function newestPictureAlreadyShows(args: {
  backend: DecisionBackend;
  picture: string;
  description: string;
}): Promise<boolean> {
  const answers = await askAboutPictures({
    backend: args.backend,
    pictures: [args.picture],
    statements: [
      { id: "same", statement: `The picture already shows this moment: ${args.description.trim().slice(0, 300)}` },
    ],
    context: "The chat's newest picture.",
  });
  const p = answers?.get("same");
  return p !== undefined && p >= Math.max(0.75, args.backend.calibration.defaultThreshold);
}
