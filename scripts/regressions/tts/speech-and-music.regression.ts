import assert from "node:assert/strict";
import {
  SPOTIFY_RECENT_TRACK_HISTORY_LIMIT,
  ELEVENLABS_AUDIO_TAG_FOR_GAME_EMOTION,
  GAME_TTS_EMOTIONS,
} from "../../../packages/shared/src/index.js";
import { normalizeCustomMusicSource } from "../../../packages/client/src/components/chat/AgentAddSetupFields.js";
import { executeToolCalls } from "../../../packages/server/src/services/tools/tool-executor.js";
import {
  buildElevenLabsTextInput,
  detectTTSAudioMimeType,
  resolveTTSAudioResponseContentType,
} from "../../../packages/server/src/routes/tts.routes.js";
import {
  cleanTTSInputText,
  extractDialogueUtterances,
  resolveTTSVoiceForSpeaker,
} from "../../../packages/client/src/lib/tts-dialogue.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import "../fixtures/regression-agent-definitions.js";

assert.strictEqual(
  normalizeCustomMusicSource({ customMusicSource: "game-assets", localMusicSource: "folder" }),
  "game-assets",
  "the current custom music source should override stale legacy settings",
);
assert.strictEqual(
  normalizeCustomMusicSource({ localMusicSource: "folder" }),
  "folder",
  "legacy custom music source settings should remain supported as a fallback",
);

const cases: RegressionCase[] = [
  {
    name: "Spotify search pages requests above the provider's ten-result limit",
    async run() {
      const originalFetch = globalThis.fetch;
      const requestedPages: Array<{ limit: number; offset: number }> = [];
      globalThis.fetch = (async (input: string | URL | Request) => {
        const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
        const limit = Number(url.searchParams.get("limit"));
        const offset = Number(url.searchParams.get("offset"));
        requestedPages.push({ limit, offset });
        return new Response(
          JSON.stringify({
            tracks: {
              items: Array.from({ length: limit }, (_, index) => ({
                uri: `spotify:track:search${offset + index}`,
                name: `Search result ${offset + index}`,
                artists: [{ name: "Regression Artist" }],
                album: { name: "Regression Album" },
              })),
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch;

      try {
        const [result] = await executeToolCalls(
          [
            {
              id: "call_spotify_search_twenty",
              type: "function",
              function: { name: "spotify_search", arguments: JSON.stringify({ query: "laboratory", limit: 20 }) },
            },
          ],
          { spotify: { accessToken: "regression-token" } },
        );
        assert.equal(result?.success, true);
        assert.deepEqual(requestedPages, [
          { limit: 10, offset: 0 },
          { limit: 10, offset: 10 },
        ]);
        assert.equal((JSON.parse(result!.result) as { count?: number }).count, 20);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  },
  {
    name: "Spotify playlist candidates suppress the extended recent-track window",
    async run() {
      const originalFetch = globalThis.fetch;
      const recentTrackUris = Array.from(
        { length: SPOTIFY_RECENT_TRACK_HISTORY_LIMIT },
        (_, index) => `spotify:track:recent${index}`,
      );
      const freshTrackUris = Array.from({ length: 50 }, (_, index) => `spotify:track:fresh${index}`);
      const allTrackUris = [...recentTrackUris, ...freshTrackUris];

      globalThis.fetch = (async (input: string | URL | Request) => {
        const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const limit = Number(url.searchParams.get("limit") ?? 50);
        const pageUris = allTrackUris.slice(offset, offset + limit);
        const nextOffset = offset + pageUris.length;
        return new Response(
          JSON.stringify({
            items: pageUris.map((uri, index) => ({
              item: {
                uri,
                name: `Track ${offset + index}`,
                artists: [{ name: "Regression Artist" }],
                album: { name: "Regression Album" },
              },
            })),
            total: allTrackUris.length,
            next: nextOffset < allTrackUris.length ? `https://api.spotify.com/next?offset=${nextOffset}` : null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch;

      try {
        const results = await executeToolCalls(
          [
            {
              id: "call_spotify_candidates",
              type: "function",
              function: {
                name: "spotify_get_playlist_tracks",
                arguments: JSON.stringify({ playlistId: "regression-playlist", candidateLimit: 50 }),
              },
            },
          ],
          {
            spotify: { accessToken: "regression-token" },
            chatMeta: { spotifyRecentTracks: recentTrackUris },
          },
        );

        assert.equal(results[0]?.success, true);
        const payload = JSON.parse(results[0]!.result) as {
          tracks?: Array<{ uri?: string }>;
          indexedTrackCount?: number;
          recentAvoidedCount?: number;
        };
        assert.equal(payload.indexedTrackCount, allTrackUris.length);
        assert.equal(payload.recentAvoidedCount, recentTrackUris.length);
        assert.deepEqual(new Set((payload.tracks ?? []).map((track) => track.uri)), new Set(freshTrackUris));
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  },
  {
    name: "Spotify preserves enabled repeat for a Music DJ track selection",
    async run() {
      const originalFetch = globalThis.fetch;
      const selectedUris = [
        "spotify:track:AAAAAAAAAAAAAAAAAAAAAA",
        "spotify:track:BBBBBBBBBBBBBBBBBBBBBB",
        "spotify:track:CCCCCCCCCCCCCCCCCCCCCC",
      ];
      const playbackBodies: Array<{ uris?: string[]; position_ms?: number }> = [];
      const queuedUris: string[] = [];
      const repeatStates: string[] = [];
      let activeUri = "spotify:track:ZZZZZZZZZZZZZZZZZZZZZZ";
      let repeatState = "track";

      globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
        const method = init?.method ?? "GET";
        if (url.pathname === "/v1/me/player" && method === "GET") {
          return new Response(
            JSON.stringify({
              is_playing: true,
              repeat_state: repeatState,
              item: { uri: activeUri },
              device: { id: "regression-device", name: "Regression device", type: "computer" },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.pathname === "/v1/me/player/play" && method === "PUT") {
          assert.equal(
            repeatState,
            "off",
            "Music DJ must clear the previous repeat mode before replacing Spotify's playback context",
          );
          const body = JSON.parse(String(init?.body ?? "{}")) as { uris?: string[]; position_ms?: number };
          playbackBodies.push(body);
          activeUri = body.uris?.[0] ?? activeUri;
          return new Response(null, { status: 204 });
        }
        if (url.pathname === "/v1/me/player/repeat" && method === "PUT") {
          repeatState = url.searchParams.get("state") ?? "off";
          repeatStates.push(repeatState);
          return new Response(null, { status: 204 });
        }
        if (url.pathname === "/v1/me/player/queue" && method === "POST") {
          queuedUris.push(url.searchParams.get("uri") ?? "");
          return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected Spotify regression request: ${method} ${url.pathname}`);
      }) as typeof fetch;

      try {
        const results = await executeToolCalls(
          [
            {
              id: "call_spotify_repeat_context",
              type: "function",
              function: {
                name: "spotify_play",
                arguments: JSON.stringify({ uris: selectedUris, reason: "Regression selection" }),
              },
            },
          ],
          {
            spotify: { accessToken: "regression-token" },
          },
        );

        assert.equal(results[0]?.success, true);
        const payload = JSON.parse(results[0]!.result) as {
          repeat?: string;
          repeatState?: string;
          queued?: number;
        };
        assert.deepEqual(playbackBodies[0]?.uris, selectedUris);
        assert.deepEqual(queuedUris, [], "repeatable Music DJ selections must not use Spotify's disposable queue");
        assert.deepEqual(repeatStates, ["off", "context"]);
        assert.equal(repeatStates.at(-1), "context");
        assert.equal(payload.repeat, "context");
        assert.equal(payload.repeatState, "context");
        assert.equal(payload.queued, selectedUris.length);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  },
  {
    name: "Spotify keeps repeat-track for a single Music DJ song",
    async run() {
      const originalFetch = globalThis.fetch;
      const selectedUri = "spotify:track:DDDDDDDDDDDDDDDDDDDDDD";
      const playbackBodies: Array<{ uris?: string[] }> = [];
      const repeatStates: string[] = [];
      let activeUri = "spotify:track:ZZZZZZZZZZZZZZZZZZZZZZ";
      let repeatState = "track";

      globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
        const method = init?.method ?? "GET";
        if (url.pathname === "/v1/me/player" && method === "GET") {
          return new Response(
            JSON.stringify({
              is_playing: true,
              repeat_state: repeatState,
              item: { uri: activeUri },
              device: { id: "regression-device", name: "Regression device", type: "computer" },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.pathname === "/v1/me/player/play" && method === "PUT") {
          const body = JSON.parse(String(init?.body ?? "{}")) as { uris?: string[] };
          playbackBodies.push(body);
          activeUri = body.uris?.[0] ?? activeUri;
          return new Response(null, { status: 204 });
        }
        if (url.pathname === "/v1/me/player/repeat" && method === "PUT") {
          repeatState = url.searchParams.get("state") ?? "off";
          repeatStates.push(repeatState);
          return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected Spotify regression request: ${method} ${url.pathname}`);
      }) as typeof fetch;

      try {
        const results = await executeToolCalls(
          [
            {
              id: "call_spotify_repeat_track",
              type: "function",
              function: {
                name: "spotify_play",
                arguments: JSON.stringify({ uri: selectedUri, reason: "Regression single" }),
              },
            },
          ],
          {
            spotify: { accessToken: "regression-token" },
            spotifyRepeatAfterPlay: "track",
          },
        );

        assert.equal(results[0]?.success, true);
        const payload = JSON.parse(results[0]!.result) as { repeat?: string; repeatState?: string };
        assert.deepEqual(playbackBodies[0]?.uris, [selectedUri]);
        assert.deepEqual(repeatStates, ["off", "track"]);
        assert.equal(payload.repeat, "track");
        assert.equal(payload.repeatState, "track");
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  },
  {
    name: "Spotify does not report a repeated Music DJ selection before context repeat is confirmed",
    async run() {
      const originalFetch = globalThis.fetch;
      const selectedUris = ["spotify:track:EEEEEEEEEEEEEEEEEEEEEE", "spotify:track:FFFFFFFFFFFFFFFFFFFFFF"];
      let activeUri = "spotify:track:ZZZZZZZZZZZZZZZZZZZZZZ";
      let repeatRequests = 0;
      let playbackReads = 0;
      const repeatDeviceIds: Array<string | null> = [];

      globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
        const method = init?.method ?? "GET";
        if (url.pathname === "/v1/me/player" && method === "GET") {
          const deviceId = playbackReads++ === 0 ? "target-device" : "other-active-device";
          return new Response(
            JSON.stringify({
              is_playing: true,
              repeat_state: "off",
              item: { uri: activeUri },
              device: { id: deviceId, name: "Regression device", type: "computer" },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.pathname === "/v1/me/player/play" && method === "PUT") {
          const body = JSON.parse(String(init?.body ?? "{}")) as { uris?: string[] };
          activeUri = body.uris?.[0] ?? activeUri;
          return new Response(null, { status: 204 });
        }
        if (url.pathname === "/v1/me/player/repeat" && method === "PUT") {
          repeatRequests++;
          repeatDeviceIds.push(url.searchParams.get("device_id"));
          return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected Spotify regression request: ${method} ${url.pathname}`);
      }) as typeof fetch;

      try {
        const results = await executeToolCalls(
          [
            {
              id: "call_spotify_repeat_unconfirmed",
              type: "function",
              function: {
                name: "spotify_play",
                arguments: JSON.stringify({ uris: selectedUris, reason: "Unconfirmed repeat regression" }),
              },
            },
          ],
          {
            spotify: { accessToken: "regression-token" },
            spotifyRepeatAfterPlay: "context",
          },
        );

        assert.equal(results[0]?.success, false);
        const payload = JSON.parse(results[0]!.result) as {
          error?: string;
          applied?: boolean;
          playbackPending?: boolean;
          verification?: string;
          repeatState?: string;
        };
        assert.equal(repeatRequests, 3, "Spotify repeat should be retried while playback reports it as off");
        assert.deepEqual(
          repeatDeviceIds,
          ["target-device", "target-device", "target-device"],
          "delayed verification must not redirect repeat retries to a different active device",
        );
        assert.match(payload.error ?? "", /failed to apply context repeat mode/u);
        assert.equal(payload.applied, undefined);
        assert.equal(payload.playbackPending, undefined);
        assert.equal(payload.verification, "failed");
        assert.equal(payload.repeatState, "off");
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  },
  {
    name: "npc default TTS voice pools work for non-ElevenLabs providers",
    run() {
      const baseConfig: Parameters<typeof resolveTTSVoiceForSpeaker>[0] = {
        source: "openai",
        voice: "alloy",
        voiceMode: "per-character",
        voiceAssignments: [],
        npcDefaultVoicesEnabled: true,
        npcDefaultMaleVoices: ["ash", "verse"],
        npcDefaultFemaleVoices: ["nova", "shimmer"],
      };

      const maleVoice = resolveTTSVoiceForSpeaker(baseConfig, "Captain Mora", undefined, {
        name: "Captain Mora",
        gender: "male",
      });
      assert.ok(["ash", "verse"].includes(maleVoice));

      const sharedPoolVoice = resolveTTSVoiceForSpeaker(
        {
          ...baseConfig,
          npcDefaultMaleVoices: ["ash", "nova"],
          npcDefaultFemaleVoices: ["ash", "nova"],
        },
        "Captain Mora",
        undefined,
        {
          name: "Captain Mora",
          gender: "male",
        },
      );
      assert.ok(["ash", "nova"].includes(sharedPoolVoice));

      const fallbackVoice = resolveTTSVoiceForSpeaker(
        {
          ...baseConfig,
          npcDefaultMaleVoices: [],
          npcDefaultFemaleVoices: [],
        },
        "Captain Mora",
        undefined,
        {
          name: "Captain Mora",
          gender: "male",
        },
      );
      assert.equal(fallbackVoice, "alloy");

      const emptyElevenLabsVoice = resolveTTSVoiceForSpeaker(
        {
          ...baseConfig,
          source: "elevenlabs",
          voice: "",
          npcDefaultMaleVoices: [],
          npcDefaultFemaleVoices: [],
        },
        "Captain Mora",
        undefined,
        {
          name: "Captain Mora",
          gender: "male",
        },
      );
      assert.equal(emptyElevenLabsVoice, "");
    },
  },
  {
    name: "TTS cleanup strips VN speaker and sprite metadata",
    run() {
      const cleaned = cleanTTSInputText(`\
[Pippa Quill] [main] [neutral]: "Reserved. Tomorrow afternoon."
[2B-] [whisper:Matt] [thinking]: "Your ribs require rest."
[Morgana-] [side] [smirk]: "A bold strategy."
[bg: backgrounds:generated:guild-hall]
[state: dialogue]`);

      assert.equal(cleaned.includes("Pippa Quill"), false);
      assert.equal(cleaned.includes("neutral"), false);
      assert.equal(cleaned.includes("whisper:Matt"), false);
      assert.equal(cleaned.includes("thinking"), false);
      assert.equal(cleaned.includes("smirk"), false);
      assert.equal(cleaned.includes("backgrounds:generated"), false);
      assert.match(cleaned, /Reserved\. Tomorrow afternoon\./);
      assert.match(cleaned, /Your ribs require rest\./);
      assert.match(cleaned, /A bold strategy\./);
    },
  },
  {
    name: "TTS dialogue extraction ignores HTML and CSS attributes",
    run() {
      const htmlCard = `<div style="max-width:340px;font-family:Georgia,'Times New Roman',serif;color:#3a2f1e;"><div class="label">read a hundred times</div><div>Your name is <span style="font-weight:bold">Maukie</span>.</div></div>`;
      const utterances = extractDialogueUtterances(`${htmlCard}\nDottore said, "Stay behind me."`, "Dottore");

      assert.deepEqual(utterances, [{ text: "Stay behind me.", speaker: "Dottore" }]);
      const cleaned = cleanTTSInputText(`<style>.note { color: red; }</style>${htmlCard}`);
      assert.equal(cleaned.includes("max-width"), false);
      assert.equal(cleaned.includes("font-family"), false);
      assert.equal(cleaned.includes("color: red"), false);
      assert.match(cleaned, /Your name is Maukie\./);

      assert.deepEqual(
        extractDialogueUtterances('<div class="frame"></div><speaker="Dottore">"Do not move."</speaker>', "Narrator"),
        [{ text: "Do not move.", speaker: "Dottore" }],
      );
    },
  },
  {
    name: "ElevenLabs TTS input speaks only audio tags the model performs (#8619)",
    run() {
      // The audio tags ElevenLabs' v3/v4 prompting guide documents (voice-related, and the Enhance feature's directions).
      const ELEVENLABS_DOCUMENTED_AUDIO_TAGS = new Set([
        "laughs",
        "whispers",
        "sighs",
        "sarcastic",
        "curious",
        "excited",
        "crying",
        "mischievously",
        "happy",
        "sad",
        "angry",
        "annoyed",
        "appalled",
        "thoughtful",
        "surprised",
      ]);
      // A game expression is a sprite name: it becomes the documented audio tag that means it, or none. An undocumented
      // word in brackets is read aloud before the line ("neutral. Four thirty-one…").
      assert.equal(
        buildElevenLabsTextInput("Reserved. Tomorrow afternoon.", "neutral", "eleven_v4"),
        "Reserved. Tomorrow afternoon.",
      );
      assert.equal(
        buildElevenLabsTextInput("Your ribs require rest.", "thinking", "eleven_v4"),
        "[thoughtful] Your ribs require rest.",
      );
      assert.equal(
        buildElevenLabsTextInput("A bold strategy.", "smirk", "eleven_v4"),
        "[mischievously] A bold strategy.",
      );
      assert.equal(buildElevenLabsTextInput("Ha!", "laughing", "eleven_v3"), "[laughs] Ha!");
      assert.equal(buildElevenLabsTextInput("Five more minutes.", "sleepy", "eleven_v4"), "Five more minutes.");
      assert.equal(buildElevenLabsTextInput("Fine.", "Neutral", "eleven_v4"), "Fine.", "expressions match any case");
      assert.equal(
        buildElevenLabsTextInput("  [thoughtful] Already prepared.", "thinking", "eleven_v4"),
        "  [thoughtful] Already prepared.",
      );
      for (const emotion of GAME_TTS_EMOTIONS) {
        const tag = ELEVENLABS_AUDIO_TAG_FOR_GAME_EMOTION[emotion];
        assert.ok(
          tag === null || ELEVENLABS_DOCUMENTED_AUDIO_TAGS.has(tag),
          `${emotion} maps to a documented ElevenLabs audio tag, or to none`,
        );
      }

      // Any other tone is a cue written to be performed (the Roleplay speaker extractor's) and is kept as written.
      assert.equal(buildElevenLabsTextInput("Stay close.", "[soft]\n", "eleven_v3"), "[soft] Stay close.");
      assert.equal(buildElevenLabsTextInput("No cue needed.", " \n[] ", "eleven_v4"), "No cue needed.");

      // A model without audio tags reads any bracket aloud, so it never gets one; NanoGPT's Eleven v3 does.
      for (const model of [
        "eleven_multilingual_v2",
        "eleven_flash_v2_5",
        "eleven_turbo_v2_5",
        "Elevenlabs-Turbo-V2.5",
      ]) {
        assert.equal(buildElevenLabsTextInput("I'm happy.", "happy", model), "I'm happy.", `${model} gets no tag`);
        assert.equal(buildElevenLabsTextInput("Stay close.", "soft", model), "Stay close.", `${model} gets no cue`);
      }
      assert.equal(buildElevenLabsTextInput("I'm happy.", "happy", "Elevenlabs-V3"), "[happy] I'm happy.");
      assert.equal(buildElevenLabsTextInput("I'm happy.", "happy", "tts_v3"), "[happy] I'm happy.");
    },
  },
  {
    name: "TTS recognizes encoded audio when providers omit or mislabel the content type",
    run() {
      const mpeg = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);
      const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
      const ogg = new Uint8Array([0x4f, 0x67, 0x67, 0x53]);
      const flac = new Uint8Array([0x66, 0x4c, 0x61, 0x43]);
      const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);
      const mp4 = new Uint8Array([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0]);
      const providerError = new TextEncoder().encode('{"error":"provider failure"}');

      assert.equal(detectTTSAudioMimeType(mpeg), "audio/mpeg");
      assert.equal(detectTTSAudioMimeType(wav), "audio/wav");
      assert.equal(detectTTSAudioMimeType(ogg), "audio/ogg");
      assert.equal(detectTTSAudioMimeType(flac), "audio/flac");
      assert.equal(detectTTSAudioMimeType(webm), "audio/webm");
      assert.equal(detectTTSAudioMimeType(mp4), "audio/mp4");
      assert.equal(detectTTSAudioMimeType(providerError), null);

      assert.equal(resolveTTSAudioResponseContentType(null, mpeg), "audio/mpeg");
      assert.equal(resolveTTSAudioResponseContentType("audio/mpeg", providerError), "audio/mpeg");
      assert.equal(resolveTTSAudioResponseContentType("application/octet-stream", wav), "audio/wav");
      assert.equal(resolveTTSAudioResponseContentType("application/octet-stream", providerError), null);
      assert.equal(resolveTTSAudioResponseContentType("application/json", providerError), null);
      assert.equal(resolveTTSAudioResponseContentType("text/plain", ogg), "audio/ogg");
    },
  },
];

await runNamedCases(cases);
