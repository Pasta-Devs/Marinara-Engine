import { describe, expect, it, vi } from "vitest";
import type { LlmGateway, LlmRequest } from "../../../capabilities/llm";
import type { StorageGateway } from "../../../capabilities/storage";
import { analyzeGameScene } from "./game-scene-analysis.service";

async function* emptyStream() {
  // Test double for the streaming side of the LLM port.
}

describe("analyzeGameScene", () => {
  it("uses the game scene analyzer prompt and post-processes model output", async () => {
    const requests: LlmRequest[] = [];
    const llm = {
      complete: vi.fn(async (request: LlmRequest) => {
        requests.push(request);
        return JSON.stringify({
          background: "castle hall",
          weather: "cold",
          timeOfDay: "null",
          spotifyTrack: "spotify:track:good",
          segmentEffects: [
            {
              segment: 0,
              background: "old castle hallway",
              sfx: ["door slam"],
              directions: [
                { effect: "flash", duration: 1 },
                { effect: "screen_shake", duration: 1 },
              ],
            },
          ],
          directions: [{ effect: "bad_effect", duration: 3 }],
        });
      }),
      stream: emptyStream,
      listModels: vi.fn(async () => []),
    } satisfies LlmGateway;
    const storage = {
      get: vi.fn(async () => ({ id: "chat-1", metadata: { gameSceneConnectionId: "scene-conn" } })),
      list: vi.fn(async () => []),
    } as unknown as StorageGateway;

    const result = await analyzeGameScene(
      { storage, llm },
      {
        chatId: "chat-1",
        narration: "The party steps into the old castle as the doors slam shut.",
        context: {
          currentState: "dialogue",
          availableBackgrounds: ["backgrounds:castle:hall"],
          availableSfx: ["sfx:door-slam"],
          currentBackground: null,
          currentWeather: "cloudy",
          currentTimeOfDay: "night",
          trackedNpcs: [{ id: "npc-1", name: "Ari" }],
          characterNames: ["Ari"],
          useSpotifyMusic: true,
          availableSpotifyTracks: [{ uri: "spotify:track:good", name: "Storm Hall", artist: "Mari" }],
        },
      },
    );

    expect(requests[0]?.connectionId).toBe("scene-conn");
    expect(requests[0]?.messages).toHaveLength(2);
    expect(requests[0]?.messages[0]).toMatchObject({ role: "system" });
    expect(requests[0]?.messages[1]?.content).toContain("BACKGROUND OPTIONS: <backgrounds:castle:hall>");
    expect(requests[0]?.messages[1]?.content).toContain("SPOTIFY TRACK OPTIONS:");
    expect(result.background).toBe("backgrounds:castle:hall");
    expect(result.weather).toBe("frost");
    expect(result.timeOfDay).toBeNull();
    expect(result.spotifyTrack).toEqual({ uri: "spotify:track:good", name: "Storm Hall", artist: "Mari", album: null });
    expect(result.segmentEffects?.[0]?.background).toBe("backgrounds:castle:hall");
    expect(result.segmentEffects?.[0]?.sfx).toEqual(["sfx:door-slam"]);
    expect(result.segmentEffects?.[0]?.directions).toEqual([{ effect: "flash", duration: 1 }]);
    expect(result.directions).toEqual([]);
  });

  it("drops malformed nested scene fields without losing valid analysis", async () => {
    const llm = {
      complete: vi.fn(async () =>
        JSON.stringify({
          background: "castle hall",
          weather: "cold",
          segmentEffects: [
            {
              segment: 0,
              background: "old castle hallway",
              sfx: [null, "door slam", { bad: true }],
              directions: [null, { effect: "flash", duration: 1 }],
            },
          ],
        }),
      ),
      stream: emptyStream,
      listModels: vi.fn(async () => []),
    } satisfies LlmGateway;
    const storage = {
      get: vi.fn(async () => ({ id: "chat-1", metadata: { gameSceneConnectionId: "scene-conn" } })),
      list: vi.fn(async () => []),
    } as unknown as StorageGateway;

    const result = await analyzeGameScene(
      { storage, llm },
      {
        chatId: "chat-1",
        narration: "The party steps into the old castle as the doors slam shut.",
        context: {
          availableBackgrounds: ["backgrounds:castle:hall"],
          availableSfx: ["sfx:door-slam"],
        },
      },
    );

    expect(result.background).toBe("backgrounds:castle:hall");
    expect(result.weather).toBe("frost");
    expect(result.segmentEffects?.[0]?.background).toBe("backgrounds:castle:hall");
    expect(result.segmentEffects?.[0]?.sfx).toEqual(["sfx:door-slam"]);
    expect(result.segmentEffects?.[0]?.directions).toEqual([{ effect: "flash", duration: 1 }]);
  });

  it("falls back to the first Spotify candidate when scene analysis JSON is malformed", async () => {
    const llm = {
      complete: vi.fn(async () => "{ not valid json"),
      stream: emptyStream,
      listModels: vi.fn(async () => []),
    } satisfies LlmGateway;
    const storage = {
      get: vi.fn(async () => ({ id: "chat-1", metadata: { gameSceneConnectionId: "scene-conn" } })),
      list: vi.fn(async () => []),
    } as unknown as StorageGateway;

    const result = await analyzeGameScene(
      { storage, llm },
      {
        chatId: "chat-1",
        narration: "The battle starts.",
        context: {
          useSpotifyMusic: true,
          availableSpotifyTracks: [
            { uri: "spotify:track:first", name: "First Track", artist: "Mari", album: "Fallbacks" },
            { uri: "spotify:track:second", name: "Second Track", artist: "Mari" },
          ],
        },
      },
    );

    expect(result.spotifyTrack).toEqual({
      uri: "spotify:track:first",
      name: "First Track",
      artist: "Mari",
      album: "Fallbacks",
    });
  });

  it("normalizes malformed Spotify candidate metadata before falling back", async () => {
    const llm = {
      complete: vi.fn(async () => "{ not valid json"),
      stream: emptyStream,
      listModels: vi.fn(async () => []),
    } satisfies LlmGateway;
    const storage = {
      get: vi.fn(async () => ({ id: "chat-1", metadata: { gameSceneConnectionId: "scene-conn" } })),
      list: vi.fn(async () => []),
    } as unknown as StorageGateway;

    const result = await analyzeGameScene(
      { storage, llm },
      {
        chatId: "chat-1",
        narration: "The battle starts.",
        context: {
          useSpotifyMusic: true,
          availableSpotifyTracks: [
            {
              uri: "spotify:track:first",
              name: 123,
              artist: null,
              album: { title: "Fallbacks" },
            },
          ],
        },
      },
    );

    expect(result.spotifyTrack).toEqual({
      uri: "spotify:track:first",
      name: null,
      artist: null,
      album: null,
    });
  });

  it("does not fall back when valid scene analysis explicitly returns no Spotify track", async () => {
    const llm = {
      complete: vi.fn(async () => JSON.stringify({ spotifyTrack: null })),
      stream: emptyStream,
      listModels: vi.fn(async () => []),
    } satisfies LlmGateway;
    const storage = {
      get: vi.fn(async () => ({ id: "chat-1", metadata: { gameSceneConnectionId: "scene-conn" } })),
      list: vi.fn(async () => []),
    } as unknown as StorageGateway;

    const result = await analyzeGameScene(
      { storage, llm },
      {
        chatId: "chat-1",
        narration: "The party rests quietly.",
        context: {
          useSpotifyMusic: true,
          availableSpotifyTracks: [{ uri: "spotify:track:first", name: "First Track", artist: "Mari" }],
        },
      },
    );

    expect(result.spotifyTrack).toBeNull();
  });

  it("keeps default null analysis when malformed scene analysis has no Spotify candidates", async () => {
    const llm = {
      complete: vi.fn(async () => "{ not valid json"),
      stream: emptyStream,
      listModels: vi.fn(async () => []),
    } satisfies LlmGateway;
    const storage = {
      get: vi.fn(async () => ({ id: "chat-1", metadata: { gameSceneConnectionId: "scene-conn" } })),
      list: vi.fn(async () => []),
    } as unknown as StorageGateway;

    const result = await analyzeGameScene(
      { storage, llm },
      {
        chatId: "chat-1",
        narration: "The party rests quietly.",
        context: {
          useSpotifyMusic: true,
          availableSpotifyTracks: [],
        },
      },
    );

    expect(result.background).toBeNull();
    expect(result.spotifyTrack).toBeNull();
    expect(result.reputationChanges).toEqual([]);
    expect(result.segmentEffects).toEqual([]);
    expect(result.directions).toEqual([]);
  });

  it("does not fall back to Spotify candidates when Spotify music is disabled", async () => {
    const llm = {
      complete: vi.fn(async () => "{ not valid json"),
      stream: emptyStream,
      listModels: vi.fn(async () => []),
    } satisfies LlmGateway;
    const storage = {
      get: vi.fn(async () => ({ id: "chat-1", metadata: { gameSceneConnectionId: "scene-conn" } })),
      list: vi.fn(async () => []),
    } as unknown as StorageGateway;

    const result = await analyzeGameScene(
      { storage, llm },
      {
        chatId: "chat-1",
        narration: "The party rests quietly.",
        context: {
          useSpotifyMusic: false,
          availableSpotifyTracks: [{ uri: "spotify:track:first", name: "First Track", artist: "Mari" }],
        },
      },
    );

    expect(result.spotifyTrack).toBeNull();
  });
});
