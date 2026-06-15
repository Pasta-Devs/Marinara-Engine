#!/usr/bin/env node
// ──────────────────────────────────────────────
// Marinara local CLI
// ──────────────────────────────────────────────
import { CSRF_HEADER, CSRF_HEADER_VALUE } from "@marinara-engine/shared";

function serverUrl() {
  return (process.env.MARI_SERVER_URL || `http://127.0.0.1:${process.env.PORT || "7860"}`).replace(/\/+$/, "");
}

function commandText(argv: string[]) {
  return ["mari", ...argv].map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" ");
}

function print(value: unknown, jsonl: boolean) {
  if (jsonl && Array.isArray(value)) {
    for (const item of value) process.stdout.write(`${JSON.stringify(item)}\n`);
    return;
  }
  if (typeof value === "string") {
    process.stdout.write(value.endsWith("\n") ? value : `${value}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function truncate(value: string, max = 220) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function summarizeObject(value: JsonRecord): JsonRecord {
  const out: JsonRecord = {};
  for (const [key, entry] of Object.entries(value).slice(0, 16)) {
    if (typeof entry === "string") {
      out[key] = truncate(entry);
    } else if (Array.isArray(entry)) {
      const primitive = entry.every((item) => item === null || ["string", "number", "boolean"].includes(typeof item));
      out[key] = primitive && entry.length <= 12 ? entry : `[${entry.length} item${entry.length === 1 ? "" : "s"}]`;
    } else if (isRecord(entry)) {
      out[key] = `{${Object.keys(entry).length} key${Object.keys(entry).length === 1 ? "" : "s"}}`;
    } else {
      out[key] = entry;
    }
  }
  const omitted = Object.keys(value).length - Object.keys(out).length;
  if (omitted > 0) out.__omittedKeys = omitted;
  return out;
}

function summarizeRow(row: unknown): unknown {
  if (!isRecord(row)) return row;
  const out: JsonRecord = {};
  for (const key of ["id", "comment", "avatarPath", "spriteFolderPath", "createdAt", "updatedAt"]) {
    if (Object.prototype.hasOwnProperty.call(row, key)) out[key] = row[key];
  }
  if (isRecord(row.data)) out.data = summarizeObject(row.data);
  else if (typeof row.data === "string") out.data = truncate(row.data);
  for (const [key, value] of Object.entries(row)) {
    if (Object.prototype.hasOwnProperty.call(out, key) || key === "data") continue;
    if (typeof value === "string") out[key] = truncate(value);
    else if (Array.isArray(value)) out[key] = `[${value.length} item${value.length === 1 ? "" : "s"}]`;
    else if (isRecord(value)) out[key] = `{${Object.keys(value).length} key${Object.keys(value).length === 1 ? "" : "s"}}`;
    else out[key] = value;
  }
  return out;
}

function compactMutationPayload(payload: unknown): unknown {
  if (!isRecord(payload) || !isRecord(payload.summary)) return payload;
  const summary = payload.summary;
  const preview = Array.isArray(summary.preview) ? summary.preview : [];
  const mode = typeof payload.mode === "string" ? payload.mode : null;
  const saved = mode === "apply" && payload.ok === true;
  return {
    ok: payload.ok,
    mode: payload.mode,
    saved,
    status: mode === "dry-run" ? "dry_run_only" : saved ? "applied" : payload.ok === false ? "failed" : "ok",
    message:
      mode === "dry-run"
        ? "Preview only: no changes were saved. Re-run the same command with --apply after user approval to persist it."
        : saved
          ? "Applied and saved. Verify the resulting state with a read command before claiming user-visible success."
          : undefined,
    command: typeof payload.command === "string" ? truncate(payload.command, 500) : payload.command,
    summary: {
      matchedRows: summary.matchedRows,
      affectedRows: summary.affectedRows,
      insertedRows: summary.insertedRows,
      updatedRows: summary.updatedRows,
      replacedRows: summary.replacedRows,
      deletedRows: summary.deletedRows,
      affectedTables: summary.affectedTables,
      preview: preview.slice(0, 5).map((entry) => {
        if (!isRecord(entry)) return entry;
        return {
          table: entry.table,
          id: entry.id,
          action: entry.action,
          before: summarizeRow(entry.before),
          after: summarizeRow(entry.after),
        };
      }),
      truncated: summary.truncated === true || preview.length > 5,
    },
    validation: payload.validation,
    approval: payload.approval,
    journalPath: payload.journalPath,
    error: payload.error,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const jsonl = argv.includes("--jsonl");
  const rawOutput = argv.includes("--raw");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [CSRF_HEADER]: CSRF_HEADER_VALUE,
  };
  const adminSecret = process.env.MARI_ADMIN_SECRET || process.env.ADMIN_SECRET;
  if (adminSecret) headers["X-Admin-Secret"] = adminSecret;

  const response = await fetch(`${serverUrl()}/api/professor-mari/workspace/db/command`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      argv,
      command: commandText(argv),
      cwd: process.cwd(),
      sessionId: process.env.MARI_WORKSPACE_SESSION_ID || `cli:${process.pid}`,
    }),
  });

  const text = await response.text();
  let payload: any = text;
  try {
    payload = JSON.parse(text);
  } catch {
    // keep raw text
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error || text || `HTTP ${response.status}`;
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
    return;
  }

  const printablePayload = rawOutput ? payload : compactMutationPayload(payload);

  if (payload?.error) {
    print(printablePayload, jsonl);
    process.exitCode = 1;
    return;
  }

  if (payload && typeof payload === "object" && "summary" in payload) {
    print(printablePayload, jsonl);
  } else if (payload && typeof payload === "object" && "output" in payload) {
    print(payload.output, jsonl);
  } else {
    print(payload, jsonl);
  }

  if (payload?.ok === false) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
