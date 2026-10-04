import { randomUUID } from "node:crypto";
import type { CustomVoiceManagement, CustomVoiceProfile, ManagedCustomVoice, TTSConfig } from "@marinara-engine/shared";
import { privateContextRevision } from "../../utils/crypto.js";
import { safeFetch } from "../../utils/security.js";
import { isTtsLocalUrlsEnabled } from "../../config/runtime-config.js";
import {
  customVoiceStorage,
  isKnownManagedVoice,
  withCustomVoiceLock,
  type CustomVoiceState,
} from "./custom-voice-storage.js";
import { validateCustomVoiceAudio, validateCustomVoiceFields } from "./custom-voice-profile.js";

export interface VoiceContext {
  connectionId: string;
  config: TTSConfig;
  assignments: Record<string, string[]>;
}
export class CustomVoiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
  }
}
export function voiceContextSnapshot(context: VoiceContext): string {
  const cfg = context.config;
  return privateContextRevision(
    JSON.stringify([context.connectionId, cfg.source, cfg.baseUrl.replace(/\/+$/, ""), cfg.apiKey, cfg.model]),
  );
}
function voiceUrl(context: VoiceContext): string {
  return `${context.config.baseUrl.replace(/\/+$/, "")}/audio/voices`;
}
async function providerRequest(context: VoiceContext, method: string, suffix = "", body?: FormData) {
  return safeFetch(`${voiceUrl(context)}${suffix}`, {
    method,
    body,
    headers: context.config.apiKey ? { Authorization: `Bearer ${context.config.apiKey}` } : {},
    signal: AbortSignal.timeout(method === "POST" ? 60_000 : 10_000),
    policy: {
      allowLocal: isTtsLocalUrlsEnabled(),
      allowedProtocols: ["https:", "http:"],
      flagName: "TTS_LOCAL_URLS_ENABLED",
    },
    maxResponseBytes: 2 * 1024 * 1024,
  });
}
async function listProvider(
  context: VoiceContext,
  profile: Exclude<CustomVoiceProfile, null>,
): Promise<{ all: string[]; uploaded: Set<string>; entries?: { id: string; name: string }[] }> {
  const res = await providerRequest(context, "GET");
  if ([404, 405, 501].includes(res.status))
    throw new CustomVoiceError(
      "Provider custom voice listing is unavailable or unsupported for this API profile.",
      501,
    );
  if (!res.ok)
    throw new CustomVoiceError(
      `Provider voice listing failed (HTTP ${res.status}). Check the selected API profile and loaded model.`,
      502,
    );
  const json = (await res.json()) as { object?: unknown; data?: unknown; voices?: unknown; uploaded_voices?: unknown };
  if (profile === "openai-compatible") {
    if (
      json.object !== "list" ||
      !Array.isArray(json.data) ||
      !json.data.every(
        (v) =>
          v &&
          typeof v === "object" &&
          v.object === "audio.voice" &&
          typeof v.id === "string" &&
          v.id.length > 0 &&
          typeof v.name === "string",
      )
    )
      throw new CustomVoiceError("The provider did not return the documented OpenAI-compatible voice list.", 502);
    const ids = new Set<string>(json.data.map((v: { id: string }) => v.id));
    return { all: [...ids], uploaded: ids, entries: json.data };
  }
  if (
    !Array.isArray(json.voices) ||
    !json.voices.every((v) => typeof v === "string") ||
    !Array.isArray(json.uploaded_voices)
  ) {
    throw new CustomVoiceError("The provider did not return the documented vLLM-Omni voice list.", 502);
  }
  const uploaded = new Set<string>();
  for (const entry of json.uploaded_voices) {
    if (entry && typeof entry === "object" && "name" in entry && typeof entry.name === "string")
      uploaded.add(entry.name);
  }
  return { all: [...new Set([...json.voices, ...uploaded])], uploaded };
}
// Legacy generic journals with a resolved distinct ID retain ownership. A name-only
// journal must recover through the documented generic list, never a wrong-mode status.
function confirmedIdentity(voice: ManagedCustomVoice): boolean {
  return voice.identityConfirmed ?? (voice.providerName !== undefined && voice.id !== voice.providerName);
}
type RevisionedVoiceState = CustomVoiceState & { profileRevision?: string };
function mutationSnapshot(snapshot: string, state: RevisionedVoiceState): string {
  return privateContextRevision(JSON.stringify([snapshot, state.profile, state.profileRevision ?? "legacy"]));
}
export function createCustomVoiceService(resolve: () => Promise<VoiceContext>) {
  async function stateFor(context: VoiceContext) {
    const snapshot = voiceContextSnapshot(context);
    // Keep previous endpoint/account contexts recoverable, without transferring registrations.
    const storage = customVoiceStorage(`${context.connectionId}\0${snapshot}`);
    const state: RevisionedVoiceState = (await storage.read()) ?? { snapshot, profile: null, voices: [] };
    return { snapshot, storage, state };
  }
  async function view(context: VoiceContext, refresh: boolean): Promise<CustomVoiceManagement> {
    const { state, storage, snapshot } = await stateFor(context);
    let providerVoices: string[] = [];
    let error: string | undefined;
    let unsupported = false;
    if (state.profile && context.config.source === "openai" && refresh) {
      try {
        const listed = await listProvider(context, state.profile);
        providerVoices = listed.all;
        for (const voice of state.voices) {
          if (voice.status === "deleted") continue;
          if (listed.entries) {
            // Older generic journals stored the intended name only in id.
            const providerName = voice.providerName ?? voice.id;
            const matches = listed.entries.filter((entry) => entry.name === providerName);
            // Keep actual identity evidence even when a confirmed voice becomes unavailable.
            voice.identityConfirmed = confirmedIdentity(voice);
            // A provisional registration name is never deletion ownership.
            if (!voice.identityConfirmed) {
              if (
                matches.length === 1 &&
                !state.voices.some((other) => other !== voice && other.id === matches[0]!.id)
              ) {
                voice.providerName = providerName;
                voice.id = matches[0]!.id;
                voice.identityConfirmed = true;
                voice.status = "ready";
              } else {
                voice.status = "uncertain";
              }
              continue;
            }
            voice.status =
              matches.length === 1 && matches[0]!.id === voice.id
                ? "ready"
                : voice.status === "pending" || voice.status === "uncertain"
                  ? "uncertain"
                  : "unavailable";
            continue;
          }
          voice.status = listed.uploaded.has(voice.id)
            ? "ready"
            : voice.status === "pending" || voice.status === "uncertain"
              ? "uncertain"
              : "unavailable";
        }
        await storage.write(state);
      } catch (cause) {
        unsupported = cause instanceof CustomVoiceError && cause.statusCode === 501;
        error =
          cause instanceof CustomVoiceError
            ? cause.message
            : "Provider listing unavailable. Refresh to recover; do not blindly repeat an upload.";
      }
    }
    const url = new URL(context.config.baseUrl);
    // No embedded URL credentials/query strings in UI or metadata.
    const destination = `${url.protocol}//${url.host}${url.pathname}`;
    return {
      connectionId: context.connectionId,
      snapshot: mutationSnapshot(snapshot, state),
      destination,
      profile: state.profile,
      capability:
        context.config.source !== "openai" || unsupported ? "unsupported" : state.profile ? "explicit" : "unknown",
      voices: state.voices,
      providerVoices,
      assignments: context.assignments,
      ...(error ? { error } : {}),
    };
  }
  async function mutate<T>(snapshot: string, run: (context: VoiceContext) => Promise<T>): Promise<T> {
    const initial = await resolve();
    return withCustomVoiceLock(initial.connectionId, async () => {
      const context = await resolve();
      const current = await stateFor(context);
      if (snapshot !== mutationSnapshot(current.snapshot, current.state))
        throw new CustomVoiceError(
          "Connection changed or API profile changed. Refresh and confirm the new destination before continuing.",
          409,
        );
      return run(context);
    });
  }
  return {
    async get() {
      const context = await resolve();
      return withCustomVoiceLock(context.connectionId, () => view(context, true));
    },
    async profile(snapshot: string, profile: CustomVoiceProfile) {
      return mutate(snapshot, async (context) => {
        if (profile && context.config.source !== "openai")
          throw new CustomVoiceError("This source does not support custom voice registration profiles.");
        const { state, storage } = await stateFor(context);
        if (state.profile !== profile) state.profileRevision = randomUUID();
        state.profile = profile;
        await storage.write(state);
        return view(context, true);
      });
    },
    async register(input: {
      snapshot: string;
      displayName: string;
      consent?: string;
      transcript?: string;
      audioBase64: string;
      acknowledged: boolean;
    }) {
      if (!input.acknowledged)
        throw new CustomVoiceError(
          "Confirm your permission to use this recording. This does not replace provider consent verification.",
        );
      if (
        input.audioBase64.length > Math.ceil((10 * 1024 * 1024) / 3) * 4 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.audioBase64)
      )
        throw new CustomVoiceError("Invalid or oversized WAV recording.");
      const audio = Buffer.from(input.audioBase64, "base64");
      try {
        validateCustomVoiceAudio(audio);
      } catch {
        audio.fill(0);
        throw new CustomVoiceError(
          "Unsupported or invalid recording. Use PCM16 WAV, mono/stereo, 8–48 kHz, at most 10 MiB and 120 seconds.",
        );
      }
      try {
        return await mutate(input.snapshot, async (context) => {
          const { state, storage } = await stateFor(context);
          if (!state.profile || context.config.source !== "openai")
            throw new CustomVoiceError("Explicitly select the supported registration API profile first.");
          let fields: ReturnType<typeof validateCustomVoiceFields>;
          try {
            fields = validateCustomVoiceFields(input, state.profile);
          } catch {
            throw new CustomVoiceError("Invalid display name, transcript or provider consent recording ID.");
          }
          if (
            state.voices.some(
              (v) =>
                v.status !== "deleted" && v.displayName.toLocaleLowerCase() === fields.displayName.toLocaleLowerCase(),
            )
          )
            throw new CustomVoiceError("A managed voice already uses that display name.", 409);
          const listed = await listProvider(context, state.profile); // read-only collision check, not a discovery probe
          const id = `marinara_${randomUUID().replaceAll("-", "")}`;
          if (listed.all.includes(id) || listed.entries?.some((entry) => entry.name === id))
            throw new CustomVoiceError("Provider identifier collision. Refresh before retrying.", 409);
          const voice: ManagedCustomVoice = {
            id,
            ...(state.profile === "openai-compatible" ? { providerName: id, identityConfirmed: false } : {}),
            displayName: fields.displayName,
            status: "pending",
            createdAt: new Date().toISOString(),
          };
          state.voices.push(voice);
          await storage.write(state); // journal intended provider name BEFORE transmission
          const form = new FormData();
          form.append("name", id);
          if (state.profile === "vllm-omni") {
            form.append("consent", fields.consent!);
            if (fields.transcript) form.append("ref_text", fields.transcript);
          }
          form.append("audio_sample", new Blob([new Uint8Array(audio)], { type: "audio/wav" }), "recording.wav");
          try {
            const res = await providerRequest(context, "POST", "", form);
            if (!res.ok) {
              // A rejected request may still have reached provider storage. Retain recovery information.
              voice.status = "uncertain";
              await storage.write(state);
              const result = await view(context, true);
              result.error = `Provider registration rejected (HTTP ${res.status}). Check permissions, consent and loaded-model support; refresh before retrying.`;
              return result;
            }
            const response = (await res.json()) as {
              id?: unknown;
              object?: unknown;
              name?: unknown;
              created?: unknown;
              success?: unknown;
              voice?: { name?: unknown };
            };
            const confirmed =
              state.profile === "openai-compatible"
                ? typeof response.id === "string" &&
                  response.id.length > 0 &&
                  !listed.all.includes(response.id) &&
                  !state.voices.some((other) => other !== voice && other.id === response.id) &&
                  response.object === "audio.voice" &&
                  response.name === id &&
                  response.created === true
                : response.success === true && response.voice?.name === id;
            if (confirmed && state.profile === "openai-compatible") {
              voice.id = response.id as string;
              voice.identityConfirmed = true;
            }
            voice.status = confirmed ? "ready" : "uncertain";
          } catch {
            voice.status = "uncertain";
          }
          await storage.write(state);
          const result = await view(context, true);
          if (result.voices.find((v) => v.providerName === id || v.id === voice.id)?.status !== "ready")
            result.error =
              "Registration outcome is uncertain. Refresh the provider list or check the intended identifier at the backend; do not blindly upload again.";
          return result;
        });
      } finally {
        audio.fill(0);
      }
    },
    async remove(
      input: { snapshot: string; id: string; confirmedAssignments: string[] },
      clearAssignments: (context: VoiceContext, id: string) => Promise<void>,
    ) {
      return mutate(input.snapshot, async (context) => {
        const { state, storage } = await stateFor(context);
        if (!state.profile || context.config.source !== "openai")
          throw new CustomVoiceError("Deletion is unsupported for this API profile.");
        // A tombstoned voice was already deleted from the provider: deleting it
        // again is pure local cleanup and must not call the provider a second time.
        const voice = state.voices.find((v) => v.id === input.id);
        if (!voice) throw new CustomVoiceError("Only explicitly managed uploaded voices can be deleted.");
        const actual = [...(context.assignments[input.id] ?? [])].sort();
        if (JSON.stringify(actual) !== JSON.stringify([...input.confirmedAssignments].sort()))
          throw new CustomVoiceError("Assignments changed. Review and confirm all affected references again.", 409);
        if (voice.status !== "deleted") {
          if ((state.profile === "openai-compatible" || voice.providerName !== undefined) && !confirmedIdentity(voice))
            throw new CustomVoiceError(
              "Provider voice identity is not confirmed. Refresh to recover before deleting.",
              409,
            );
          const res = await providerRequest(context, "DELETE", `/${encodeURIComponent(input.id)}`);
          let confirmed = res.ok && res.status === 204;
          if (res.ok && res.status !== 204) {
            try {
              // OpenAPI leaves DELETE's body unspecified; require an explicit acknowledgment.
              const body = (await res.json()) as { id?: unknown; deleted?: unknown; success?: unknown };
              confirmed =
                body != null &&
                (body.id === undefined || body.id === input.id) &&
                (state.profile === "openai-compatible"
                  ? (body.deleted === true || body.success === true) && body.deleted !== false && body.success !== false
                  : body.success === true);
            } catch {
              /* Ambiguous/empty bodies preserve the record and assignments. */
            }
          }
          if (!confirmed)
            throw new CustomVoiceError(
              "Provider deletion was not confirmed. The management record and assignments have been preserved.",
              502,
            );
          // Tombstone immediately; retain it if local cleanup fails so recovery is possible.
          voice.status = "deleted";
          await storage.write(state);
        }
        await clearAssignments(context, input.id);
        return view(await resolve(), true);
      });
    },
  };
}

/** Managed IDs must never be routed to another account/endpoint or used after deletion. */
export async function assertManagedVoiceUsable(context: VoiceContext, voice: string) {
  if (!(await isKnownManagedVoice(voice))) return;
  const snapshot = voiceContextSnapshot(context);
  const state = await customVoiceStorage(`${context.connectionId}\0${snapshot}`).read();
  if (!state?.voices.some((v) => v.id === voice && v.status === "ready"))
    throw new CustomVoiceError(
      "This custom voice is unavailable for the selected connection. Refresh its managed voice list.",
      409,
    );
}
