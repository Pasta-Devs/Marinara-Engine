import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TTSConfig } from "../../engine/contracts/types/tts";
import { ttsApi } from "./tts-api";
import { invokeTauri } from "./tauri-client";

vi.mock("./tauri-client", () => ({
  invokeTauri: vi.fn(),
}));

const invokeMock = vi.mocked(invokeTauri);

const config = {
  enabled: true,
  source: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  voice: "alloy",
  narratorVoiceEnabled: false,
  narratorVoice: "",
  model: "tts-1",
  audioFormat: "mp3",
  speed: 1,
  elevenLabsStability: 0.5,
  elevenLabsLanguageCode: "",
  voiceMode: "single",
  voiceAssignments: [],
  npcDefaultVoicesEnabled: false,
  npcDefaultMaleVoices: [],
  npcDefaultFemaleVoices: [],
  autoplayRP: false,
  autoplayConvo: false,
  autoplayGame: false,
  autoplayStreaming: false,
  dialogueOnly: false,
  dialogueScope: "all",
  dialogueCharacterName: "",
} satisfies TTSConfig;

describe("ttsApi", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("loads TTS config through the tts_config command", async () => {
    invokeMock.mockResolvedValueOnce(config);

    await expect(ttsApi.config()).resolves.toEqual(config);

    expect(invokeMock).toHaveBeenCalledWith("tts_config");
  });

  it("normalizes native TTS config responses through the contract schema", async () => {
    invokeMock.mockResolvedValueOnce({ enabled: true });

    await expect(ttsApi.config()).resolves.toMatchObject({
      enabled: true,
      source: "openai",
      narratorVoiceEnabled: false,
      narratorVoice: "",
      voiceAssignments: [],
      dialogueScope: "all",
    });
  });

  it("keeps valid native TTS config fields when another saved field is malformed", async () => {
    invokeMock.mockResolvedValueOnce({
      enabled: true,
      source: "elevenlabs",
      baseUrl: "https://api.elevenlabs.io",
      speed: 99,
      audioFormat: "ogg",
      voiceAssignments: [{ characterName: "Nia", voice: "Rachel" }],
      npcDefaultMaleVoices: "Adam",
    });

    await expect(ttsApi.config()).resolves.toMatchObject({
      enabled: true,
      source: "elevenlabs",
      baseUrl: "https://api.elevenlabs.io",
      speed: 1,
      audioFormat: "mp3",
      voiceAssignments: [{ characterId: "", characterName: "Nia", voice: "Rachel" }],
      npcDefaultMaleVoices: [],
    });
  });

  it.each([null, "config", 42, false, []])("rejects malformed native TTS config responses", async (response) => {
    invokeMock.mockResolvedValueOnce(response);

    await expect(ttsApi.config()).rejects.toThrow();

    expect(invokeMock).toHaveBeenCalledWith("tts_config");
  });

  it("updates TTS config with the expected payload", async () => {
    invokeMock.mockResolvedValueOnce(undefined);

    await expect(ttsApi.updateConfig(config)).resolves.toBeUndefined();

    expect(invokeMock).toHaveBeenCalledWith("tts_update_config", { config: expect.objectContaining(config) });
  });

  it("rejects invalid TTS config updates before invoking the native command", async () => {
    await expect(ttsApi.updateConfig({ ...config, speed: 99 } as TTSConfig)).rejects.toThrow();

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("loads provider voices through the tts_voices command", async () => {
    const voices = { voices: ["alloy"], fromProvider: true, source: "openai" };
    invokeMock.mockResolvedValueOnce(voices);

    await expect(ttsApi.voices()).resolves.toBe(voices);

    expect(invokeMock).toHaveBeenCalledWith("tts_voices");
  });

  it("speaks with the expected payload and returns a Blob", async () => {
    invokeMock.mockResolvedValueOnce({ audioBase64: "YXVkaW8=", contentType: "audio/wav" });

    const blob = await ttsApi.speak({ text: "Hello", speaker: "Mari", voice: "alloy" });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("audio/wav");
    expect(invokeMock).toHaveBeenCalledWith("tts_speak", {
      input: { text: "Hello", speaker: "Mari", voice: "alloy" },
    });
  });

  it.each([null, "audio", 42, false])("rejects malformed speak responses before reading audio fields", async (response) => {
    invokeMock.mockResolvedValueOnce(response);

    await expect(ttsApi.speak({ text: "Hello" })).rejects.toThrow("TTS request returned an invalid response");

    expect(invokeMock).toHaveBeenCalledWith("tts_speak", { input: { text: "Hello" } });
  });

  it("rejects speak responses without audio using the provider error message", async () => {
    invokeMock.mockResolvedValueOnce({ error: "Provider rejected the TTS request." });

    await expect(ttsApi.speak({ text: "Hello" })).rejects.toThrow("Provider rejected the TTS request.");
  });

  it("does not invoke when the speak signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(ttsApi.speak({ text: "Hello" }, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("rejects stale audio when the speak signal aborts while the command is in flight", async () => {
    const controller = new AbortController();
    let resolveCommand: (value: unknown) => void = () => undefined;
    invokeMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCommand = resolve;
      }),
    );

    const request = ttsApi.speak({ text: "Hello" }, controller.signal);
    controller.abort();
    resolveCommand({ audioBase64: "YXVkaW8=", contentType: "audio/mpeg" });

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(invokeMock).toHaveBeenCalledWith("tts_speak", { input: { text: "Hello" } });
  });
});
