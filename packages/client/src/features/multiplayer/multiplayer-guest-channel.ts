import {
  MULTIPLAYER_LIMITS,
  multiplayerActionSchema,
  multiplayerErrorCodeSchema,
  multiplayerGuestStateSchema,
  type MultiplayerAction,
  type MultiplayerGuestState,
} from "@marinara-engine/shared";
import { MULTIPLAYER_GUEST_LABEL_KEYS, type MultiplayerGuestLabels } from "./multiplayer-guest-labels";

export const MULTIPLAYER_GUEST_CHANNEL = "marinara-multiplayer-guest-v1";
const MAX_WIRE_BYTES = MULTIPLAYER_LIMITS.snapshotBytes + 32_768;
const TOKEN = /^[A-Za-z0-9_-]{8,64}$/u;

export interface MultiplayerGuestTheme {
  mode: "light" | "dark";
  accent: string;
}

export interface MultiplayerGuestPresentation {
  state: MultiplayerGuestState;
  labels: MultiplayerGuestLabels;
  theme: MultiplayerGuestTheme;
}

type ParentMessage =
  ({ type: "state" } & MultiplayerGuestPresentation) | { type: "result"; id: string; accepted: boolean };
type GuestMessage = { type: "ready"; token: string } | { type: "action"; id: string; action: MultiplayerAction };

function exactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function readWire(input: unknown): Record<string, unknown> {
  if (
    typeof input !== "string" ||
    input.length > MAX_WIRE_BYTES ||
    new TextEncoder().encode(input).byteLength > MAX_WIRE_BYTES
  ) {
    throw new Error("Invalid guest channel payload");
  }
  const parsed: unknown = JSON.parse(input);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid guest channel object");
  return parsed as Record<string, unknown>;
}

function stringLabels(value: unknown, keys: readonly string[]): boolean {
  return exactRecord(value, keys) && keys.every((key) => typeof value[key] === "string" && value[key].length <= 2_000);
}

export function validateGuestPresentation(value: unknown): MultiplayerGuestPresentation {
  if (!exactRecord(value, ["state", "labels", "theme"])) throw new Error("Invalid guest presentation");
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_WIRE_BYTES - 32) {
    throw new Error("Guest presentation exceeds the size limit");
  }
  const labels = value.labels;
  if (
    !exactRecord(labels, [...MULTIPLAYER_GUEST_LABEL_KEYS, "errors", "modes"]) ||
    !MULTIPLAYER_GUEST_LABEL_KEYS.every((key) => typeof labels[key] === "string" && labels[key].length <= 2_000) ||
    !stringLabels(labels.errors, multiplayerErrorCodeSchema.options) ||
    !stringLabels(labels.modes, ["conversation", "roleplay", "game"])
  ) {
    throw new Error("Invalid guest labels");
  }
  const theme = value.theme;
  if (
    !exactRecord(theme, ["mode", "accent"]) ||
    (theme.mode !== "dark" && theme.mode !== "light") ||
    typeof theme.accent !== "string" ||
    !/^#[a-f0-9]{6}$/iu.test(theme.accent)
  ) {
    throw new Error("Invalid guest theme");
  }
  return {
    state: multiplayerGuestStateSchema.parse(value.state),
    labels: labels as unknown as MultiplayerGuestLabels,
    theme: theme as unknown as MultiplayerGuestTheme,
  };
}

export function readGuestParentMessage(input: unknown): ParentMessage {
  const value = readWire(input);
  if (value.type === "state" && exactRecord(value, ["type", "state", "labels", "theme"])) {
    return {
      type: "state",
      ...validateGuestPresentation({ state: value.state, labels: value.labels, theme: value.theme }),
    };
  }
  if (
    value.type === "result" &&
    exactRecord(value, ["type", "id", "accepted"]) &&
    typeof value.id === "string" &&
    TOKEN.test(value.id) &&
    typeof value.accepted === "boolean"
  ) {
    return { type: "result", id: value.id, accepted: value.accepted };
  }
  throw new Error("Unknown guest parent message");
}

export function readGuestMessage(input: unknown): GuestMessage {
  const value = readWire(input);
  if (
    value.type === "ready" &&
    exactRecord(value, ["type", "token"]) &&
    typeof value.token === "string" &&
    TOKEN.test(value.token)
  ) {
    return { type: "ready", token: value.token };
  }
  if (
    value.type === "action" &&
    exactRecord(value, ["type", "id", "action"]) &&
    typeof value.id === "string" &&
    TOKEN.test(value.id) &&
    typeof input === "string" &&
    new TextEncoder().encode(input).byteLength <= MULTIPLAYER_LIMITS.actionBytes
  ) {
    return { type: "action", id: value.id, action: multiplayerActionSchema.parse(value.action) };
  }
  throw new Error("Unknown guest message");
}

export function isGuestBootstrap(value: unknown): value is { channel: string; token: string } {
  return (
    exactRecord(value, ["channel", "token"]) &&
    value.channel === MULTIPLAYER_GUEST_CHANNEL &&
    typeof value.token === "string" &&
    TOKEN.test(value.token)
  );
}

/** Called only for a locally served sandboxed guest document, never a peer URL. */
export function connectMultiplayerGuestFrame(
  frame: HTMLIFrameElement,
  options: {
    initial: MultiplayerGuestPresentation;
    onAction: (action: MultiplayerAction) => Promise<boolean>;
    onError: () => void;
    onReady?: () => void;
  },
) {
  const expectedUrl = new URL("/api/multiplayer/guest-view", window.location.origin).href;
  if (!frame.contentWindow || frame.getAttribute("sandbox") !== "allow-scripts" || frame.src !== expectedUrl) {
    throw new Error("Guest frame is not isolated");
  }
  const channel = new MessageChannel();
  const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  let closed = false;
  let ready = false;
  let presentation = validateGuestPresentation(options.initial);
  const activeActions = new Set<string>();
  // Keep only recent IDs. Host operation IDs remain the authoritative deduplication boundary.
  const seen = new Set<string>();
  const timeout = setTimeout(fail, 10_000);

  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(timeout);
    channel.port1.close();
  }
  function fail() {
    if (closed) return;
    close();
    options.onError();
  }
  function sendState(next: MultiplayerGuestPresentation) {
    if (closed) return;
    presentation = validateGuestPresentation(next);
    if (ready) channel.port1.postMessage(JSON.stringify({ type: "state", ...presentation }));
  }
  channel.port1.onmessageerror = fail;
  channel.port1.onmessage = (event: MessageEvent<unknown>) => {
    if (closed) return;
    try {
      const message = readGuestMessage(event.data);
      if (!ready) {
        if (message.type !== "ready" || message.token !== token) return fail();
        ready = true;
        clearTimeout(timeout);
        sendState(presentation);
        options.onReady?.();
        return;
      }
      if (message.type !== "action" || seen.has(message.id) || activeActions.has(message.id)) return fail();
      if (seen.size >= 64) seen.delete(seen.values().next().value!);
      seen.add(message.id);
      if (activeActions.size >= 4) {
        channel.port1.postMessage(JSON.stringify({ type: "result", id: message.id, accepted: false }));
        return;
      }
      activeActions.add(message.id);
      void options
        .onAction(message.action)
        .then(
          (accepted) => {
            if (!closed)
              channel.port1.postMessage(
                JSON.stringify({ type: "result", id: message.id, accepted: accepted === true }),
              );
          },
          () => {
            if (!closed) channel.port1.postMessage(JSON.stringify({ type: "result", id: message.id, accepted: false }));
          },
        )
        .finally(() => {
          activeActions.delete(message.id);
        });
    } catch {
      fail();
    }
  };
  frame.contentWindow.postMessage({ channel: MULTIPLAYER_GUEST_CHANNEL, token }, "*", [channel.port2]);
  return { update: sendState, close };
}
