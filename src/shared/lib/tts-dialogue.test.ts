import { describe, expect, it } from "vitest";
import type { TTSConfig } from "../../engine/contracts/types/tts";
import { buildTTSVoiceRequests } from "./tts-dialogue";

const baseConfig: TTSConfig = {
  enabled: true,
  source: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  voice: "alloy",
  narratorVoiceEnabled: false,
  narratorVoice: "",
  model: "tts-1",
  speed: 1,
  elevenLabsStability: 0.5,
  elevenLabsLanguageCode: "",
  voiceMode: "single",
  voiceAssignments: [],
  npcDefaultVoicesEnabled: false,
  npcDefaultMaleVoices: [],
  npcDefaultFemaleVoices: [],
  autoplayRP: true,
  autoplayConvo: false,
  autoplayGame: false,
  autoplayStreaming: false,
  dialogueOnly: false,
  dialogueScope: "all",
  dialogueCharacterName: "",
};

describe("TTS dialogue routing", () => {
  it("routes prose to narrator voice and quoted dialogue to the fallback character", () => {
    const requests = buildTTSVoiceRequests('She smiles. "Come here." Then waits.', {
      ...baseConfig,
      narratorVoiceEnabled: true,
      narratorVoice: "nova",
    }, "Ada");

    expect(requests).toEqual([
      expect.objectContaining({ text: "She smiles.", speaker: "Narrator", voice: "nova" }),
      expect.objectContaining({ text: "Come here.", speaker: "Ada", voice: "alloy" }),
      expect.objectContaining({ text: "Then waits.", speaker: "Narrator", voice: "nova" }),
    ]);
  });

  it("keeps action-only chunks on narrator voice when narrator splitting is enabled", () => {
    const requests = buildTTSVoiceRequests("She crosses the room without speaking.", {
      ...baseConfig,
      narratorVoiceEnabled: true,
      narratorVoice: "nova",
    }, "Ada");

    expect(requests).toEqual([
      expect.objectContaining({ text: "She crosses the room without speaking.", speaker: "Narrator", voice: "nova" }),
    ]);
  });

  it("leaves single-voice playback unchanged when narrator splitting is disabled", () => {
    const requests = buildTTSVoiceRequests('She smiles. "Come here."', baseConfig, "Ada");

    expect(requests).toEqual([
      expect.objectContaining({ text: "She smiles. \"Come here.\"", speaker: "Ada", voice: "alloy" }),
    ]);
  });

  it("supports doubled ASCII quotes as dialogue delimiters", () => {
    const requests = buildTTSVoiceRequests('She whispers, ""Stay close.""', {
      ...baseConfig,
      narratorVoiceEnabled: true,
      narratorVoice: "nova",
    }, "Ada");

    expect(requests).toEqual([
      expect.objectContaining({ text: "She whispers,", speaker: "Narrator", voice: "nova" }),
      expect.objectContaining({ text: "Stay close.", speaker: "Ada", voice: "alloy" }),
    ]);
  });

  it("does not treat a real fallback speaker named Narrator as synthetic narration", () => {
    const requests = buildTTSVoiceRequests('"Line."', {
      ...baseConfig,
      narratorVoiceEnabled: true,
      narratorVoice: "nova",
    }, "Narrator");

    expect(requests).toEqual([
      expect.objectContaining({ text: "Line.", speaker: "Narrator", voice: "alloy" }),
    ]);
  });
});
