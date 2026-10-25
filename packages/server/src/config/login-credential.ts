// ──────────────────────────────────────────────
// Config: remote login and browser sessions
// ──────────────────────────────────────────────
// One answer to "which login protects remote access", shared by the Basic Auth
// gate, the access policy and the access status. BASIC_AUTH_USER and
// BASIC_AUTH_PASS in .env win when both are set; otherwise the login saved in
// the app at DATA_DIR/.remote-login.json applies. Signed-in browsers are kept in
// DATA_DIR/.remote-sessions.json. Both files are read again within RECHECK_MS
// when they change on disk, so deleting them works like an .env edit.

import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../lib/logger.js";
import { DATA_DIR } from "../utils/data-dir.js";
import { getBasicAuthConfig } from "./runtime-config.js";

export type StoredLogin = { user: string; salt: string; hash: string; N: number; r: number; p: number };
export type LoginConfig = { source: "env"; user: string; pass: string } | ({ source: "app" } & StoredLogin);
/** `hash` is the SHA-256 of the cookie token; the token itself is never stored. */
export type SignInMethod = "password" | "pairing" | "setup";
/** `method` is missing on sessions saved before it was recorded. */
export type RemoteSession = {
  id: string;
  hash: string;
  label: string;
  createdAt: number;
  lastSeenAt: number;
  method?: SignInMethod;
};
type SessionsFile = { login: string; sessions: RemoteSession[] };

export const MIN_LOGIN_PASSWORD_LENGTH = 10;
export const SESSION_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
const LOGIN_FILE = join(DATA_DIR, ".remote-login.json");
const SESSIONS_FILE = join(DATA_DIR, ".remote-sessions.json");
/** Matches the .env watcher, so a reset takes effect as fast as an .env edit. */
const RECHECK_MS = 2_000;
const SCRYPT_PARAMS = { N: 2 ** 14, r: 8, p: 1 };
const HASH_BYTES = 32;
const MAX_SESSIONS = 50;
/** lastSeenAt is saved at most this often per session, not on every request. */
const SESSION_TOUCH_MS = 60 * 60 * 1000;

/** Reads `file` again when its stat changes, at most every RECHECK_MS. A missing file gives `missing`. */
function watchedFile<T>(file: string, read: () => T, missing: T) {
  let state: { checkedAt: number; stamp: string; value: T } | null = null;
  return {
    get(): T {
      const now = Date.now();
      // abs(): a clock that steps back must not freeze the cache.
      if (state && Math.abs(now - state.checkedAt) < RECHECK_MS) return state.value;
      let stamp = "";
      try {
        const stats = statSync(file);
        stamp = `${stats.ino}:${stats.size}:${stats.mtimeMs}`;
      } catch {
        // Missing.
      }
      if (state?.stamp === stamp) state.checkedAt = now;
      else {
        try {
          state = { checkedAt: now, stamp, value: stamp ? read() : missing };
        } catch (err) {
          // Gone since the stat means missing; any other read error keeps the last value and tries again.
          if ((err as NodeJS.ErrnoException).code === "ENOENT") state = { checkedAt: now, stamp: "", value: missing };
          else {
            logger.warn(err, "[login] Could not read %s; trying again", file);
            // The old stamp stays, so the next check after RECHECK_MS reads the file again.
            state = { checkedAt: now, stamp: state?.stamp ?? "", value: state ? state.value : missing };
          }
        }
      }
      return state ? state.value : missing;
    },
    forget() {
      state = null;
    },
  };
}

/** Owner-only (0600) and atomic: a crash leaves the old file or the new one, never half of it. */
function writePrivateFile(file: string, value: unknown) {
  mkdirSync(DATA_DIR, { recursive: true });
  const temp = `${file}.${randomBytes(6).toString("hex")}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value)}\n`, { mode: 0o600, flag: "wx" });
  renameSync(temp, file);
}

function removeFile(file: string) {
  try {
    unlinkSync(file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

// ── Login ──

let envLogin: Extract<LoginConfig, { source: "env" }> | null = null;
let lastLogin: LoginConfig | null = null;
let setupCodeAllowed = false;
let setupCode: string | null = null;
const loginFile = watchedFile<LoginConfig | null>(LOGIN_FILE, readLoginFile, null);

export function getLoginConfig(): LoginConfig | null {
  const { user, pass } = getBasicAuthConfig();
  let login: LoginConfig | null;
  if (user && pass) {
    if (envLogin?.user !== user || envLogin.pass !== pass) envLogin = { source: "env", user, pass };
    login = envLogin;
  } else {
    login = loginFile.get();
  }
  if (login) setupCode = null;
  else if (lastLogin && setupCodeAllowed) announceSetupCode();
  lastLogin = login;
  return login;
}

function isStoredLogin(value: unknown): value is StoredLogin {
  const v = value as Partial<StoredLogin> | null;
  return (
    typeof v?.user === "string" &&
    v.user.length > 0 &&
    typeof v.salt === "string" &&
    typeof v.hash === "string" &&
    Buffer.from(v.hash, "base64").length >= 16 &&
    Number.isInteger(v.N) &&
    v.N! >= 2 ** 10 &&
    v.N! <= 2 ** 20 &&
    (v.N! & (v.N! - 1)) === 0 &&
    Number.isInteger(v.r) &&
    v.r! >= 1 &&
    v.r! <= 32 &&
    Number.isInteger(v.p) &&
    v.p! >= 1 &&
    v.p! <= 16
  );
}

function readLoginFile(): LoginConfig | null {
  const text = readFileSync(LOGIN_FILE, "utf8");
  try {
    const { user, salt, hash, N, r, p } = JSON.parse(text) as StoredLogin;
    const login = { user, salt, hash, N, r, p };
    if (isStoredLogin(login)) return { source: "app", ...login };
  } catch {
    // Reported below.
  }
  logger.warn("[login] %s is damaged, so no app login applies. Set the login again or delete the file.", LOGIN_FILE);
  return null;
}

/** Constant-time text compare; hashing first hides the length. */
function sameText(a: string, b: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(a), digest(b));
}

function deriveHash(password: string, salt: Buffer, params: Pick<StoredLogin, "N" | "r" | "p">, bytes = HASH_BYTES) {
  const { N, r, p } = params;
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, bytes, { N, r, p, maxmem: 256 * N * r }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function verifyStoredPassword(login: StoredLogin, user: string, password: string): Promise<boolean> {
  const expected = Buffer.from(login.hash, "base64");
  const actual = await deriveHash(password, Buffer.from(login.salt, "base64"), login, expected.length);
  return timingSafeEqual(actual, expected) && sameText(user, login.user);
}

/** Saves the app login and ends the setup code. Sessions belong to one login, so the old ones stop working. */
export async function setStoredLogin(user: string, password: string): Promise<void> {
  const salt = randomBytes(16);
  const hash = await deriveHash(password, salt, SCRYPT_PARAMS);
  const record: StoredLogin = { user, salt: salt.toString("base64"), hash: hash.toString("base64"), ...SCRYPT_PARAMS };
  writePrivateFile(LOGIN_FILE, record);
  loginFile.forget();
  setupCode = null;
}

export function clearStoredLogin(): void {
  removeFile(LOGIN_FILE);
  loginFile.forget();
  deleteAllSessions();
}

// ── One-time setup code ──

/**
 * A browser on the Docker host reaches the server through the Docker gateway, not
 * loopback, so it cannot set the first login without ADMIN_SECRET. This code, shown
 * only in the server log, stands in for ADMIN_SECRET for that first login. Called
 * at startup when the server listens beyond loopback; a new code follows each
 * reset, and any login ends it.
 */
export function enableLoginSetupCode(): void {
  setupCodeAllowed = true;
  if (!getLoginConfig()) announceSetupCode();
  // Notice a reset without waiting for the next request.
  setInterval(getLoginConfig, RECHECK_MS).unref();
}

/** No 0/O or 1/I/L: a code is read off one screen and typed on another. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const SETUP_CODE_LENGTH = 16; // 16 symbols of 31 ≈ 79 bits

/** `length` random symbols in groups of four, like ABCD-EFGH. */
export function readableCode(length: number): string {
  const code = Array.from({ length }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  return code.replace(/(.{4})(?=.)/g, "$1-");
}

/** Ignores case and the spaces or dashes people type between the groups. */
export const normalizeCode = (value: string) => value.toUpperCase().replace(/[\s-]/g, "");

// ip-allowlist registers its parsed TRUSTED_AUTH_PROXY check here; importing it would be a cycle.
let proxyLogsVisitorsIn = () => false;
export function setProxyLogsVisitorsIn(check: () => boolean) {
  proxyLogsVisitorsIn = check;
}

export function announceSetupCode() {
  // A forward-auth proxy logs visitors in, so there is no first login to set. Only entries the
  // policy accepts count: a list of typos or public ranges trusts no proxy and still needs a code.
  if (proxyLogsVisitorsIn()) {
    setupCode = null;
    return;
  }
  setupCode = readableCode(SETUP_CODE_LENGTH);
  logger.warn("[login] No remote login is set. To set one from another device, use the setup code below once.");
  logger.warn("[login] One-time setup code: %s", setupCode);
}

export function isLoginSetupCode(value: unknown): boolean {
  const code = currentSetupCode();
  return code !== null && typeof value === "string" && sameText(normalizeCode(value), normalizeCode(code));
}

/** The printed, unused setup code, or null. */
export function currentSetupCode(): string | null {
  getLoginConfig();
  return setupCode;
}

export const hasLoginSetupCode = () => currentSetupCode() !== null;

/** Call after isLoginSetupCode passed and before any await, so a code works once. */
export function consumeLoginSetupCode(): void {
  setupCode = null;
}

// ── Browser sessions ──

const sessionsFile = watchedFile<SessionsFile | null>(SESSIONS_FILE, readSessionsFile, null);

function isSession(value: unknown): value is RemoteSession {
  const v = value as Partial<RemoteSession> | null;
  return (
    typeof v?.id === "string" &&
    typeof v.hash === "string" &&
    /^[0-9a-f]{64}$/.test(v.hash) &&
    typeof v.label === "string" &&
    Number.isFinite(v.createdAt) &&
    Number.isFinite(v.lastSeenAt) &&
    (v.method === undefined || ["password", "pairing", "setup"].includes(v.method))
  );
}

function readSessionsFile(): SessionsFile | null {
  const text = readFileSync(SESSIONS_FILE, "utf8");
  try {
    const { login, sessions } = JSON.parse(text) as Partial<SessionsFile>;
    if (typeof login === "string" && Array.isArray(sessions) && sessions.every(isSession)) return { login, sessions };
  } catch {
    // Reported below.
  }
  logger.warn("[login] %s is damaged, so every browser must sign in again.", SESSIONS_FILE);
  return null;
}

const hashToken = (token: string) => createHash("sha256").update(token, "utf8").digest();

/** Live sessions of the login `loginKey` names. A new login gets a new key, which ends all older sessions. */
function liveSessions(loginKey: string, fresh = false): RemoteSession[] {
  // Writers read the file as it is now, so they cannot bring back sessions deleted from outside.
  if (fresh) sessionsFile.forget();
  const stored = sessionsFile.get();
  if (stored?.login !== loginKey) return [];
  const oldest = Date.now() - SESSION_MAX_AGE_SECONDS * 1000;
  return stored.sessions.filter((session) => session.createdAt > oldest);
}

function saveSessions(loginKey: string, sessions: RemoteSession[]) {
  writePrivateFile(SESSIONS_FILE, { login: loginKey, sessions });
  sessionsFile.forget();
}

// ponytail: names a few common devices and browsers; use a User-Agent parser if owners need more detail.
export function deviceLabel(userAgent: unknown): string {
  const ua = typeof userAgent === "string" ? userAgent : "";
  const pick = (names: Record<string, string>) => Object.keys(names).find((key) => ua.includes(key));
  const browsers = {
    "Edg/": "Edge",
    "OPR/": "Opera",
    "FxiOS/": "Firefox",
    "CriOS/": "Chrome",
    "Firefox/": "Firefox",
    "Chrome/": "Chrome",
    "Safari/": "Safari",
  };
  const devices = {
    iPhone: "iPhone",
    iPad: "iPad",
    Android: "Android",
    CrOS: "ChromeOS",
    Windows: "Windows",
    Macintosh: "Mac",
    Linux: "Linux",
  };
  const browser = pick(browsers);
  const device = pick(devices);
  if (!browser && !device) return "Unknown device";
  return [browser && browsers[browser as keyof typeof browsers], device && devices[device as keyof typeof devices]]
    .filter(Boolean)
    .join(" on ");
}

/** Starts a session for the login `loginKey` names and returns the cookie token. */
export function createSession(loginKey: string, userAgent: unknown, method: SignInMethod): string {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const session: RemoteSession = {
    id: randomBytes(9).toString("base64url"),
    hash: hashToken(token).toString("hex"),
    label: deviceLabel(userAgent),
    createdAt: now,
    lastSeenAt: now,
    method,
  };
  // The oldest sessions drop out at the cap.
  saveSessions(loginKey, [...liveSessions(loginKey, true), session].slice(-MAX_SESSIONS));
  return token;
}

export function findSession(loginKey: string, token: string): RemoteSession | null {
  const hash = hashToken(token);
  const sessions = liveSessions(loginKey);
  const session = sessions.find((entry) => timingSafeEqual(Buffer.from(entry.hash, "hex"), hash)) ?? null;
  if (session && Date.now() - session.lastSeenAt >= SESSION_TOUCH_MS) {
    try {
      const now = Date.now();
      const current = liveSessions(loginKey, true);
      if (!current.some((entry) => entry.id === session.id)) return null;
      saveSessions(
        loginKey,
        current.map((entry) => (entry.id === session.id ? { ...entry, lastSeenAt: now } : entry)),
      );
    } catch (err) {
      logger.warn(err, "[login] Could not save when a browser was last seen");
    }
  }
  return session;
}

export function listSessions(loginKey: string): RemoteSession[] {
  return liveSessions(loginKey);
}

export function deleteSession(loginKey: string, id: string): boolean {
  const sessions = liveSessions(loginKey, true);
  const rest = sessions.filter((session) => session.id !== id);
  if (rest.length === sessions.length) return false;
  saveSessions(loginKey, rest);
  return true;
}

/** Ends every session of the login `loginKey` except `keepId`, the caller's own. */
export function deleteOtherSessions(loginKey: string, keepId: string | undefined): void {
  saveSessions(
    loginKey,
    liveSessions(loginKey, true).filter((session) => session.id === keepId),
  );
}

export function deleteAllSessions(): void {
  removeFile(SESSIONS_FILE);
  sessionsFile.forget();
}
