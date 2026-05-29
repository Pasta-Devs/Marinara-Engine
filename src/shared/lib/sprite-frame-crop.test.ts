import { describe, expect, it } from "vitest";
import { cropSpriteDataUrl, type SpriteFrameAdjustments } from "./sprite-frame-crop";

const VALID_FRAME: SpriteFrameAdjustments = {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
};

describe("cropSpriteDataUrl", () => {
  it("rejects frame percentages outside the supported range before loading an image", async () => {
    await expect(cropSpriteDataUrl("data:image/png;base64,", { ...VALID_FRAME, left: -1 })).rejects.toThrow(
      "Frame settings must use percentages between 0 and 100",
    );
    await expect(cropSpriteDataUrl("data:image/png;base64,", { ...VALID_FRAME, top: Number.NaN })).rejects.toThrow(
      "Frame settings must use percentages between 0 and 100",
    );
  });

  it("rejects percentage ranges that leave no usable crop area before loading an image", async () => {
    await expect(cropSpriteDataUrl("data:image/png;base64,", { ...VALID_FRAME, left: 40, right: 60 })).rejects.toThrow(
      "Frame settings must use percentage ranges that leave a usable sprite area",
    );
    await expect(cropSpriteDataUrl("data:image/png;base64,", { ...VALID_FRAME, top: 100 })).rejects.toThrow(
      "Frame settings must use percentage ranges that leave a usable sprite area",
    );
  });
});
