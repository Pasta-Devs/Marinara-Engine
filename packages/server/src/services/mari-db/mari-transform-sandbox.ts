import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { logger } from "../../lib/logger.js";
import {
  getWorkspaceShellSandboxStatus,
  sanitizeWorkspaceShellEnv,
  spawnWorkspaceSandboxedProcess,
  type WorkspaceSandboxedShell,
} from "../professor-mari/workspace-shell-sandbox.js";
import { workspacePathAccessPolicy } from "../professor-mari/workspace-change-review.service.js";

type Row = Record<string, unknown>;

export type MariTransformTable = {
  name: string;
  rows: Row[];
  jsonColumns: string[];
};

export type MariTransformOutput = {
  table: string;
  results: Array<{ defined: boolean; value?: unknown }>;
};

type RunMariTransformInput = {
  workspaceRoot: string;
  scriptPath: string;
  timestamp: string;
  tables: MariTransformTable[];
};

const TRANSFORM_TIMEOUT_MS = 15 * 60_000;
const MAX_TRANSFORM_OUTPUT_BYTES = 32 * 1024 * 1024;
const MAX_TRANSFORM_ERROR_BYTES = 32_000;
const UNSAFE_TRANSFORM_FALLBACK_ENV = "MARI_DB_ALLOW_UNSAFE_TRANSFORMS";

// This source is deliberately self-contained. It executes in a separate Node process behind
// Seatbelt/bubblewrap, not in Marinara's server process. The transform keeps the established
// row/context API while network, secret files, and workspace writes remain unavailable.
const TRANSFORM_RUNNER_SOURCE = String.raw`
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
const emit = process.stdout.write.bind(process.stdout);
const encode = JSON.stringify.bind(JSON);
const clone = (value) => value === undefined ? value : JSON.parse(encode(value));
const jsonColumns = new Map(payload.tables.map((table) => [table.name, new Set(table.jsonColumns)]));

function parseMaybe(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("[") && trimmed !== "null")) return value;
  try { return JSON.parse(trimmed); } catch { return value; }
}

function parseRow(table, row) {
  const out = { ...row };
  for (const key of jsonColumns.get(table) ?? []) {
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = parseMaybe(out[key]);
  }
  return out;
}

function booleanText(value) {
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number" && (value === 0 || value === 1)) return value === 1 ? "true" : "false";
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "false" ? normalized : value;
}

function normalizeRow(table, row) {
  const out = { ...row };
  if (table === "agent_configs") {
    if (out.description === undefined) out.description = "";
    if (out.connectionId === undefined) out.connectionId = null;
    if (out.imagePath === undefined) out.imagePath = null;
    if (out.promptTemplate === undefined) out.promptTemplate = "";
    if (out.settings === undefined) out.settings = {};
    if (typeof out.phase === "string" && out.phase.trim().toLowerCase() === "inactive") out.phase = "post_processing";
    else if (typeof out.phase === "string") out.phase = out.phase.trim();
    out.enabled = "true";
  } else if (table === "custom_tools") {
    if (out.description === undefined) out.description = "";
    if (out.parametersSchema === undefined) out.parametersSchema = {};
    if (out.executionType === undefined) out.executionType = "static";
    if (out.webhookUrl === undefined) out.webhookUrl = null;
    if (out.staticResult === undefined) out.staticResult = null;
    if (out.scriptBody === undefined) out.scriptBody = null;
    out.includeHiddenContext = out.includeHiddenContext === undefined ? "false" : booleanText(out.includeHiddenContext);
    out.enabled = out.enabled === undefined ? "true" : booleanText(out.enabled);
  }
  return out;
}

function rawRow(table, row) {
  const out = normalizeRow(table, row);
  for (const key of jsonColumns.get(table) ?? []) {
    if (!Object.prototype.hasOwnProperty.call(out, key)) continue;
    const value = out[key];
    if (value !== undefined && value !== null && typeof value !== "string") out[key] = encode(value);
  }
  return out;
}

function newId() {
  return randomBytes(16).toString("base64url").slice(0, 21);
}

const moduleUrl = pathToFileURL(payload.scriptPath).href + "?mariDb=" + Date.now();
const imported = await import(moduleUrl);
const transform = imported.default ?? imported.transform;
if (typeof transform !== "function") throw new Error("Transform must export a default function");

const parsedTables = new Map(payload.tables.map((table) => [table.name, table.rows.map((row) => parseRow(table.name, row))]));
const output = [];
for (const table of payload.tables) {
  const results = [];
  for (const original of parsedTables.get(table.name) ?? []) {
    const row = clone(original);
    const context = {
      table: table.name,
      now: payload.timestamp,
      newId,
      raw: (value) => rawRow(table.name, value),
      parse: (value) => parseRow(table.name, value),
      find: (name, predicate) => (parsedTables.get(name) ?? []).filter(predicate).map(clone),
    };
    const value = await transform(row, context);
    results.push(value === undefined ? { defined: false } : { defined: true, value });
  }
  output.push({ table: table.name, results });
}
emit("\n" + payload.marker + encode(output) + "\n");
`;

function transformFailure(stderr: string, fallback: string) {
  const detail = stderr.trim();
  return new Error(detail ? `${fallback}: ${detail.slice(-4_000)}` : fallback);
}

function unsafeFallbackEnabled() {
  const value = process.env[UNSAFE_TRANSFORM_FALLBACK_ENV]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

async function spawnTransformProcess(
  workspaceRoot: string,
  scriptPath: string,
  args: string[],
): Promise<WorkspaceSandboxedShell> {
  const status = getWorkspaceShellSandboxStatus();
  if (status.available) {
    return spawnWorkspaceSandboxedProcess({
      executable: process.execPath,
      args,
      workspaceRoot,
      env: process.env,
      writableWorkspace: false,
      allowChildProcesses: false,
    });
  }
  if (!unsafeFallbackEnabled()) {
    throw new Error(
      `${status.reason} mari db transform requires Seatbelt/bubblewrap for untrusted scripts. ` +
        `To run a personally reviewed local transform anyway, set ${UNSAFE_TRANSFORM_FALLBACK_ENV}=true and restart Marinara.`,
    );
  }
  logger.warn(
    "[mari-db] Running a transform without an OS sandbox because %s=true. Node permission mode is not a malicious-code security boundary.",
    UNSAFE_TRANSFORM_FALLBACK_ENV,
  );
  const safeEnv = sanitizeWorkspaceShellEnv(process.env);
  const restrictedArgs = args.map((arg) => (arg === "--allow-fs-read=*" ? `--allow-fs-read=${scriptPath}` : arg));
  const child = spawn(process.execPath, restrictedArgs, {
    cwd: workspaceRoot,
    env: {
      ...safeEnv,
      HOME: workspaceRoot,
      TMPDIR: workspaceRoot,
      TMP: workspaceRoot,
      TEMP: workspaceRoot,
      XDG_CACHE_HOME: workspaceRoot,
      XDG_CONFIG_HOME: workspaceRoot,
      XDG_DATA_HOME: workspaceRoot,
    },
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  return { backend: "node-permission-opt-in", child, cleanup: async () => undefined };
}

export async function runMariTransformSandbox(input: RunMariTransformInput): Promise<MariTransformOutput[]> {
  const workspaceRoot = resolve(input.workspaceRoot);
  const scriptPath = resolve(workspaceRoot, input.scriptPath);
  const canonicalWorkspaceRoot = existsSync(workspaceRoot) ? realpathSync(workspaceRoot) : workspaceRoot;
  const canonicalScriptPath = existsSync(scriptPath) ? realpathSync(scriptPath) : scriptPath;
  if (
    workspacePathAccessPolicy(workspaceRoot, scriptPath) === "forbidden" ||
    workspacePathAccessPolicy(canonicalWorkspaceRoot, canonicalScriptPath) === "forbidden"
  ) {
    throw new Error("Professor Mari cannot use private application data as a transform script.");
  }
  const marker = `MARINARA_TRANSFORM_${randomUUID()}:`;
  const sandboxed = await spawnTransformProcess(workspaceRoot, scriptPath, [
    "--permission",
    // Seatbelt/bubblewrap owns the read boundary. Node's permission layer is
    // added to deny child processes, workers, native addons, and all writes.
    "--allow-fs-read=*",
    "--disable-proto=throw",
    "--input-type=module",
    "--eval",
    TRANSFORM_RUNNER_SOURCE,
  ]);
  const payload = JSON.stringify({
    marker,
    scriptPath,
    timestamp: input.timestamp,
    tables: input.tables,
  });

  return new Promise<MariTransformOutput[]>((resolveRun, rejectRun) => {
    const child = sandboxed.child;
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let outputBytes = 0;
    let stderrBytes = 0;
    let stderrTruncated = false;
    let settled = false;
    let exceededOutput = false;
    let timedOut = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void sandboxed.cleanup().finally(callback);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, TRANSFORM_TIMEOUT_MS);
    timer.unref?.();
    child.stdout?.on("data", (chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > MAX_TRANSFORM_OUTPUT_BYTES) {
        exceededOutput = true;
        child.kill("SIGKILL");
        return;
      }
      stdoutChunks.push(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const remainingBytes = MAX_TRANSFORM_ERROR_BYTES - stderrBytes;
      if (remainingBytes <= 0) {
        stderrTruncated = true;
        return;
      }
      const accepted = chunk.byteLength > remainingBytes ? chunk.subarray(0, remainingBytes) : chunk;
      stderrChunks.push(accepted.byteLength === chunk.byteLength ? accepted : Buffer.from(accepted));
      stderrBytes += accepted.byteLength;
      if (accepted.byteLength < chunk.byteLength) stderrTruncated = true;
    });
    child.on("error", (error) => finish(() => rejectRun(error)));
    child.on("close", (exitCode) =>
      finish(() => {
        const stdout = Buffer.concat(stdoutChunks).toString("utf8");
        const stderrBuffer = Buffer.concat(stderrChunks, stderrBytes);
        const stderrDecoder = new StringDecoder("utf8");
        const stderr = stderrTruncated ? stderrDecoder.write(stderrBuffer) : stderrDecoder.end(stderrBuffer);
        if (timedOut) {
          rejectRun(new Error("Transform timed out after 15 minutes"));
          return;
        }
        if (exceededOutput) {
          rejectRun(new Error("Transform output exceeded 32 MiB"));
          return;
        }
        if (exitCode !== 0) {
          rejectRun(transformFailure(stderr, `Transform sandbox exited with code ${exitCode}`));
          return;
        }
        const markerIndex = stdout.lastIndexOf(`\n${marker}`);
        if (markerIndex < 0) {
          rejectRun(transformFailure(stderr, "Transform sandbox did not return a result"));
          return;
        }
        try {
          const encoded = stdout.slice(markerIndex + marker.length + 1).trim();
          const parsed = JSON.parse(encoded) as unknown;
          if (!Array.isArray(parsed)) throw new Error("result is not an array");
          resolveRun(parsed as MariTransformOutput[]);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          rejectRun(new Error(`Transform sandbox returned an invalid result: ${detail}`));
        }
      }),
    );
    child.stdin?.on("error", (error) => finish(() => rejectRun(error)));
    child.stdin?.end(payload);
  });
}
