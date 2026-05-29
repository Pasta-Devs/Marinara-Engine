import { describe, expect, it } from "vitest";

import { AUDIO_EXTS, AUDIO_MIME_MAP, GAME_ASSET_MIME_MAP, IMAGE_EXTS, IMAGE_MIME_MAP } from "./game-assets";

describe("game asset MIME maps", () => {
  function sorted(values: Iterable<string>) {
    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }

  it("keeps advertised extensions exactly aligned with MIME maps", () => {
    expect(sorted(Object.keys(IMAGE_MIME_MAP))).toEqual(sorted(IMAGE_EXTS));
    expect(sorted(Object.keys(AUDIO_MIME_MAP))).toEqual(sorted(AUDIO_EXTS));
    expect(sorted(Object.keys(GAME_ASSET_MIME_MAP))).toEqual(sorted([...IMAGE_EXTS, ...AUDIO_EXTS]));

    for (const extension of AUDIO_EXTS) {
      expect(GAME_ASSET_MIME_MAP[extension], `${extension} should be present in the combined MIME map`).toBe(
        AUDIO_MIME_MAP[extension],
      );
    }

    for (const extension of IMAGE_EXTS) {
      expect(GAME_ASSET_MIME_MAP[extension], `${extension} should be present in the combined MIME map`).toBe(
        IMAGE_MIME_MAP[extension],
      );
    }
  });

  it("keeps browser-preview MIME hints for WebM and Opus audio", () => {
    expect(AUDIO_MIME_MAP[".webm"]).toBe("audio/webm");
    expect(AUDIO_MIME_MAP[".opus"]).toBe("audio/ogg");
  });
});
