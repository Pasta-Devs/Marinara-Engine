// ──────────────────────────────────────────────
// Utility: API Key Encryption
// ──────────────────────────────────────────────
import { logger } from "../lib/logger.js";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import { join } from "node:path";
import { DATA_DIR } from "./data-dir.js";
import { getEncryptionKeyOverride } from "../config/runtime-config.js";

const ALGORITHM = "aes-256-gcm";
const REQUIRED_KEY_BYTES = 32; // AES-256 requires a 32-byte key.

let cachedKey: Buffer | null = null;

/**
 * Decode a hex-encoded encryption key, returning it only if it is exactly 32 bytes.
 *
 * `Buffer.from(value, "hex")` is dangerously lenient — it silently stops at the first
 * non-hex character and drops a trailing nibble on odd-length input, yielding a
 * wrong-length buffer instead of throwing. Feeding that to AES-256-GCM then throws a
 * cryptic `Invalid key length` deep inside cipher creation. Validate up front instead.
 */
function decodeEncryptionKey(value: string): Buffer | null {
  const hex = value.trim().toLowerCase();
  if (hex.length !== REQUIRED_KEY_BYTES * 2 || !/^[0-9a-f]+$/.test(hex)) return null;
  const buf = Buffer.from(hex, "hex");
  return buf.length === REQUIRED_KEY_BYTES ? buf : null;
}

/**
 * Resolve the encryption key with the following priority:
 *  1. ENCRYPTION_KEY env var  (explicit override)
 *  2. Auto-generated key persisted in <DATA_DIR>/.encryption-key
 *
 * If no key exists anywhere, one is generated and saved automatically
 * so updates never break existing installs.
 */
function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  // 1. Env var takes priority
  const envKey = getEncryptionKeyOverride();
  if (envKey) {
    const decoded = decodeEncryptionKey(envKey);
    if (!decoded) {
      throw new Error(
        "ENCRYPTION_KEY is invalid — it must be exactly 64 hexadecimal characters (32 bytes). Generate one with `openssl rand -hex 32`.",
      );
    }
    cachedKey = decoded;
    return cachedKey;
  }

  // 2. Check for persisted key in data dir
  const keyPath = join(DATA_DIR, ".encryption-key");
  if (existsSync(keyPath)) {
    const stored = readFileSync(keyPath, "utf-8").trim();
    if (stored) {
      const decoded = decodeEncryptionKey(stored);
      if (!decoded) {
        throw new Error(
          `Encryption key file at ${keyPath} is corrupt (expected 64 hexadecimal characters). ` +
            `Restore it from a backup, or delete it to generate a new key — existing saved API keys will then need to be re-entered.`,
        );
      }
      cachedKey = decoded;
      restrictKeyFile(keyPath);
      return cachedKey;
    }
  }

  // 3. Auto-generate and persist a new key
  const newKey = randomBytes(32);
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(keyPath, newKey.toString("hex") + "\n", { mode: 0o600 });
  restrictKeyFile(keyPath);
  logger.info("[CRYPTO] No ENCRYPTION_KEY found — generated and saved to %s", keyPath);
  cachedKey = newKey;
  return cachedKey;
}

/**
 * Owner-only access to the key file. On Linux/macOS a key made by an older version, copied, or restored can be
 * readable by other accounts, so the mode is tightened on every start. Windows ignores the mode, so the file's
 * inherited permissions are replaced with full control for this account and SYSTEM only (best effort, once).
 */
function restrictKeyFile(keyPath: string) {
  if (process.platform !== "win32") {
    try {
      if ((statSync(keyPath).mode & 0o077) !== 0) chmodSync(keyPath, 0o600);
    } catch (error) {
      logger.warn(error, "[CRYPTO] Could not make the encryption key file owner-only");
    }
    return;
  }
  let account = "";
  try {
    account = userInfo().username;
  } catch {
    return;
  }
  if (!account) return;
  const domain = process.env.USERDOMAIN?.trim();
  const principal = domain ? `${domain}\\${account}` : account;
  execFile(
    "icacls",
    [keyPath, "/inheritance:r", "/grant:r", `${principal}:F`, "/grant:r", "*S-1-5-18:F"],
    { windowsHide: true, timeout: 15_000 },
    (error) => {
      if (error) logger.warn(error, "[CRYPTO] Could not make the encryption key file owner-only");
    },
  );
}

/** A server-only key for `purpose`, derived from the persisted encryption key so it survives restarts. */
export function deriveServerKey(purpose: string): Buffer {
  return createHmac("sha256", getEncryptionKey()).update(purpose, "utf8").digest();
}

/** Encrypt a plaintext API key. Returns "iv:encrypted:authTag" in hex. */
export function encryptApiKey(plaintext: string): string {
  if (!plaintext) return "";
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${encrypted}:${authTag}`;
}

/** Decrypt an encrypted API key string. */
export function decryptApiKey(encrypted: string): string {
  if (!encrypted) return "";
  const key = getEncryptionKey();
  const [ivHex, encHex, authTagHex] = encrypted.split(":");
  if (!ivHex || !encHex || !authTagHex) return "";
  try {
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    // Key was encrypted with a different encryption key that no longer exists
    logger.warn("[CRYPTO] Failed to decrypt API key — encryption key may have changed. Please re-enter the API key.");
    return "";
  }
}
