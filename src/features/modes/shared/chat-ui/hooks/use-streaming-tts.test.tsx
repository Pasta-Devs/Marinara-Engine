// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TTSConfig } from "../../../../../engine/contracts/types/tts";
import { useChatStore } from "../../../../../shared/stores/chat.store";
import { ttsService } from "../../../../../shared/lib/tts-service";
import { useStreamingTTS } from "./use-streaming-tts";

const baseConfig: TTSConfig = {
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
  autoplayRP: true,
  autoplayConvo: false,
  autoplayGame: false,
  autoplayStreaming: true,
  dialogueOnly: false,
  dialogueScope: "all",
  dialogueCharacterName: "",
};

class MockAudio {
  static instances: MockAudio[] = [];

  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  playbackRate = 1;
  paused = false;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn(() => {
    this.paused = true;
  });
  src = "";

  constructor(src: string) {
    this.src = src;
    MockAudio.instances.push(this);
  }
}

function Harness({
  enabled = true,
  config = baseConfig,
  fallbackSpeaker = "Narrator",
}: {
  enabled?: boolean;
  config?: TTSConfig;
  fallbackSpeaker?: string;
}) {
  useStreamingTTS({
    enabled,
    chatId: "chat-1",
    ttsConfig: config,
    fallbackSpeaker,
  });
  return null;
}

async function waitFor(expectation: () => void): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown;
  while (Date.now() - startedAt < 1000) {
    try {
      expectation();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  throw lastError;
}

describe("useStreamingTTS", () => {
  let container: HTMLDivElement;
  let root: Root;
  let objectUrlIndex = 0;

  beforeEach(() => {
    vi.spyOn(ttsService, "generateAudio").mockImplementation(async (text) => new Blob([text], { type: "audio/mpeg" }));
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:tts-${++objectUrlIndex}`);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.stubGlobal("Audio", MockAudio);
    MockAudio.instances = [];
    objectUrlIndex = 0;
    useChatStore.getState().reset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    useChatStore.getState().reset();
  });

  it("fetches completed sentences as the stream grows and plays them sequentially", async () => {
    act(() => {
      root.render(<Harness />);
    });

    act(() => {
      useChatStore.getState().setStreaming(true, "chat-1");
      useChatStore.getState().appendStreamBuffer("First sentence. Second", "chat-1");
    });

    await waitFor(() => expect(ttsService.generateAudio).toHaveBeenCalledTimes(1));
    expect(ttsService.generateAudio).toHaveBeenNthCalledWith(
      1,
      "First sentence.",
      expect.objectContaining({ speaker: "Narrator" }),
    );
    await waitFor(() => expect(MockAudio.instances).toHaveLength(1));
    expect(MockAudio.instances[0]?.play).toHaveBeenCalledTimes(1);

    act(() => {
      useChatStore.getState().appendStreamBuffer(" sentence.", "chat-1");
    });

    await waitFor(() => expect(ttsService.generateAudio).toHaveBeenCalledTimes(2));
    expect(ttsService.generateAudio).toHaveBeenNthCalledWith(
      2,
      "Second sentence.",
      expect.objectContaining({ speaker: "Narrator" }),
    );
    expect(MockAudio.instances).toHaveLength(1);

    act(() => {
      MockAudio.instances[0]?.onended?.();
    });

    await waitFor(() => expect(MockAudio.instances).toHaveLength(2));
    expect(MockAudio.instances[1]?.play).toHaveBeenCalledTimes(1);
  });

  it("routes streaming prose to narrator voice without emitting partial quoted dialogue", async () => {
    const config: TTSConfig = {
      ...baseConfig,
      narratorVoiceEnabled: true,
      narratorVoice: "nova",
    };
    act(() => {
      root.render(<Harness config={config} fallbackSpeaker="Ada" />);
    });

    act(() => {
      useChatStore.getState().setStreaming(true, "chat-1");
      useChatStore.getState().appendStreamBuffer('She smiles. "Hello. How', "chat-1");
    });

    await waitFor(() => expect(ttsService.generateAudio).toHaveBeenCalledTimes(1));
    expect(ttsService.generateAudio).toHaveBeenNthCalledWith(
      1,
      "She smiles.",
      expect.objectContaining({ speaker: "Narrator", voice: "nova" }),
    );

    act(() => {
      useChatStore.getState().appendStreamBuffer(' are you?" She nods.', "chat-1");
    });

    await waitFor(() => expect(ttsService.generateAudio).toHaveBeenCalledTimes(3));
    expect(ttsService.generateAudio).toHaveBeenNthCalledWith(
      2,
      "Hello. How are you?",
      expect.objectContaining({ speaker: "Ada", voice: "alloy" }),
    );
    expect(ttsService.generateAudio).toHaveBeenNthCalledWith(
      3,
      "She nods.",
      expect.objectContaining({ speaker: "Narrator", voice: "nova" }),
    );
  });
});
