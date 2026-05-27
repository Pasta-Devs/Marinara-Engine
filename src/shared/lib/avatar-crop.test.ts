import { describe, expect, it } from "vitest";
import { getAvatarCropStyle, isLegacyAvatarCrop, parseAvatarCropJson } from "./utils";

describe("avatar crop compatibility", () => {
  it("parses current source-rectangle crops", () => {
    expect(parseAvatarCropJson('{"srcX":0.1,"srcY":0.2,"srcWidth":0.5,"srcHeight":0.5}')).toEqual({
      srcX: 0.1,
      srcY: 0.2,
      srcWidth: 0.5,
      srcHeight: 0.5,
    });
  });

  it("parses legacy zoom/offset crops", () => {
    const crop = parseAvatarCropJson('{"zoom":1.4,"offsetX":12,"offsetY":-8,"fullImage":true}');

    expect(crop).toEqual({ zoom: 1.4, offsetX: 12, offsetY: -8, fullImage: true });
    expect(crop && isLegacyAvatarCrop(crop)).toBe(true);
  });

  it("rejects malformed legacy crops", () => {
    expect(parseAvatarCropJson('{"zoom":0,"offsetX":12,"offsetY":-8}')).toBeNull();
    expect(parseAvatarCropJson('{"zoom":1.2,"offsetX":12,"offsetY":-8,"fullImage":"yes"}')).toBeNull();
    expect(parseAvatarCropJson('{"zoom":1.2,"offsetX":"12","offsetY":-8}')).toBeNull();
    expect(parseAvatarCropJson('{"zoom":1.2,"offsetX":12}')).toBeNull();
    expect(parseAvatarCropJson('{"zoom":1.2,"offsetX":12,"offsetY":null}')).toBeNull();
  });

  it("renders legacy crop transforms", () => {
    expect(getAvatarCropStyle({ zoom: 1.4, offsetX: 12, offsetY: -8 })).toEqual({
      transform: "scale(1.4) translate(12px, -8px)",
    });
    expect(getAvatarCropStyle({ zoom: 1, offsetX: 12, offsetY: -8 })).toEqual({
      transform: "scale(1) translate(12px, -8px)",
    });
    expect(getAvatarCropStyle({ zoom: 1, offsetX: 0, offsetY: 0 })).toEqual({});
    expect(getAvatarCropStyle({ zoom: 1, offsetX: 0, offsetY: 0, fullImage: true })).toEqual({
      objectFit: "contain",
    });
  });
});
