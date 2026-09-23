// Engine HTTP API access. The engine checks Origin on state-changing requests, so every call sends it.
import { API, ORIGIN } from "./config.mjs";
import { parse } from "./util.mjs";

/**
 * Call the engine API. A failed call's error names the engine's x-request-id (when the engine sends one), so it can
 * be passed straight to lookup_error.
 */
export async function api(path, { method = "GET", body, timeoutMs = 20_000, base = API, origin = ORIGIN } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { Origin: origin, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  const data = text ? parse(text) : null;
  if (!res.ok) {
    const detail = data && typeof data === "object" ? (data.error ?? data.message ?? text) : text;
    const requestId = res.headers.get("x-request-id");
    const errorId = data && typeof data === "object" ? (data.errorId ?? data.diagnostic?.errorId ?? null) : null;
    const refs = [requestId && `requestId=${requestId}`, errorId && `errorId=${errorId}`].filter(Boolean).join(" ");
    const error = new Error(
      `${method} ${path} -> ${res.status}: ${String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 500)}` +
        (refs ? ` (${refs}; pass either to lookup_error)` : ""),
    );
    error.status = res.status;
    throw error;
  }
  return data;
}

/** /api/health body, or null when the engine does not answer. */
export async function health({ base = API, origin = ORIGIN, timeoutMs = 10_000 } = {}) {
  try {
    const res = await fetch(`${base}/health`, { headers: { Origin: origin }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return parse(await res.text()) ?? {};
  } catch {
    return null;
  }
}

export async function engineOnline(options) {
  return (await health(options)) !== null;
}

export async function requireOnline() {
  if (!(await engineOnline())) throw new Error(`engine is not running on ${ORIGIN} (see engine_status / restart_engine)`);
}

export async function getChat(chatId) {
  const chat = await api(`/chats/${encodeURIComponent(chatId)}`);
  return { ...chat, metadata: parse(chat.metadata) };
}

export async function getMessages(chatId) {
  const rows = await api(`/chats/${encodeURIComponent(chatId)}/messages`, { timeoutMs: 60_000 });
  const list = Array.isArray(rows) ? rows : (rows?.messages ?? []);
  return list
    .map((m) => ({ ...m, extra: parse(m.extra) }))
    .sort((a, b) =>
      String(a.createdAt) === String(b.createdAt)
        ? String(a.id).localeCompare(String(b.id))
        : String(a.createdAt).localeCompare(String(b.createdAt)),
    );
}

export async function listChats() {
  const rows = await api("/chats", { timeoutMs: 60_000 });
  return (Array.isArray(rows) ? rows : []).map((c) => ({ ...c, metadata: parse(c.metadata) }));
}

export async function listCharacters() {
  const rows = await api("/characters", { timeoutMs: 60_000 });
  return (Array.isArray(rows) ? rows : []).map((c) => ({ ...c, data: parse(c.data) }));
}

export async function getCharacter(id) {
  const c = await api(`/characters/${encodeURIComponent(id)}`);
  return { ...c, data: parse(c.data) };
}

/** Resolve a chat by id or by a (case-insensitive) name fragment; the most recently updated match wins. */
export async function resolveChat(ref) {
  const chats = await listChats();
  const exact = chats.find((c) => c.id === ref);
  if (exact) return exact;
  const needle = String(ref).toLowerCase();
  const matches = chats
    .filter((c) => String(c.name ?? "").toLowerCase().includes(needle))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  if (!matches.length) throw new Error(`no chat matches "${ref}"`);
  return matches[0];
}

export async function resolveCharacter(ref) {
  const all = await listCharacters();
  const exact = all.find((c) => c.id === ref);
  if (exact) return exact;
  const needle = String(ref).toLowerCase();
  const byName = all.filter((c) => String(c.data?.name ?? "").toLowerCase() === needle);
  if (byName.length === 1) return byName[0];
  const partial = all.filter((c) => String(c.data?.name ?? "").toLowerCase().includes(needle));
  if (partial.length === 1) return partial[0];
  if (!partial.length) throw new Error(`no character matches "${ref}"`);
  throw new Error(`"${ref}" is ambiguous: ${partial.map((c) => `${c.data?.name} (${c.id})`).join(", ")}`);
}
