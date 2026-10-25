// ──────────────────────────────────────────────
// Middleware helper: recently refused devices
// ──────────────────────────────────────────────
// Remembers, in memory only, which devices the access gates turned away, so the
// host can tell the owner that a device tried to connect. Keeps no addresses in
// the answer: a device label and the reason are enough to act on.

import { randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { deviceLabel } from "../config/login-credential.js";
import { multiplayerPeerSocketKey as clientAddressKey } from "../services/multiplayer/peer-server.js";

export type RefusalReason = "noLogin" | "allowlist";
export type RefusedDevice = { id: string; label: string; reason: RefusalReason; at: number };

/** The same device keeps one entry, and so one banner, for this long after its last try. */
const REFUSAL_WINDOW_MS = 30 * 60_000;
const MAX_REFUSALS = 20;

const refusals = new Map<string, RefusedDevice>();

function forgetOld(now: number) {
  for (const [key, entry] of refusals) if (now - entry.at >= REFUSAL_WINDOW_MS) refusals.delete(key);
}

export function recordRefusal(request: FastifyRequest, reason: RefusalReason): void {
  const now = Date.now();
  forgetOld(now);
  const label = deviceLabel(request.headers["user-agent"]);
  // Visitors behind one local proxy share an address, so the label tells them apart.
  // An allowlist can face the internet, where every scanner has a new address: one entry per label there.
  const address = reason === "allowlist" ? "" : clientAddressKey(request.ip);
  const key = `${address}|${label}|${reason}`;
  const known = refusals.get(key);
  refusals.delete(key);
  refusals.set(key, { id: known?.id ?? randomBytes(9).toString("base64url"), label, reason, at: now });
  if (refusals.size > MAX_REFUSALS) refusals.delete(refusals.keys().next().value!);
}

/** Newest first. */
export function listRefusals(): RefusedDevice[] {
  forgetOld(Date.now());
  return [...refusals.values()].reverse();
}
