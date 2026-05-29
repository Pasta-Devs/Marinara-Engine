import { describe, expect, it } from "vitest";

import { AUDIO_EXTS, AUDIO_MIME_MAP, GAME_ASSET_MIME_MAP, IMAGE_EXTS, IMAGE_MIME_MAP } from "./game-assets";

describe("game asset MIME maps", () => {
  it("covers every advertised image and audio extension", () => {
    for (const extension of IMAGE_EXTS) {
      expect(IMAGE_MIME_MAP[extension], `${extension} should have an image MIME type`).toBeTruthy();
      expect(GAME_ASSET_MIME_MAP[extension], `${extension} should be present in the combined MIME map`).toBe(
        IMAGE_MIME_MAP[extension],
      );
    }

    for (const extension of AUDIO_EXTS) {
      expect(AUDIO_MIME_MAP[extension], `${extension} should have an audio MIME type`).toBeTruthy();
      expect(GAME_ASSET_MIME_MAP[extension], `${extension} should be present in the combined MIME map`).toBe(
        AUDIO_MIME_MAP[extension],
      );
    }
  });

  it("keeps browser-preview MIME hints for WebM and Opus audio", () => {
    expect(AUDIO_MIME_MAP[".webm"]).toBe("audio/webm");
    expect(AUDIO_MIME_MAP[".opus"]).toBe("audio/ogg");
  });
});
