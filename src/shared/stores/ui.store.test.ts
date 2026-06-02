import { beforeEach, describe, expect, it } from "vitest";
import { useUIStore } from "./ui.store";

describe("UI store custom sound setters", () => {
  beforeEach(() => {
    useUIStore.setState({
      customNotificationSound: null,
      customTextBlipSound: null,
    });
  });

  it("normalizes custom notification sounds before storing them", () => {
    const invalidSound = {
      name: "not audio",
      type: "text/plain",
      size: 10,
      dataUrl: "data:text/plain;base64,ZmFrZQ==",
    };

    useUIStore.getState().setCustomNotificationSound(invalidSound);
    expect(useUIStore.getState().customNotificationSound).toBeNull();

    useUIStore.getState().setCustomNotificationSound({
      name: "  Ping  ",
      type: "  audio/wav  ",
      size: 10.4,
      dataUrl: "data:audio/wav;base64,ZmFrZQ==",
    });

    expect(useUIStore.getState().customNotificationSound).toEqual({
      name: "Ping",
      type: "audio/wav",
      size: 10,
      dataUrl: "data:audio/wav;base64,ZmFrZQ==",
    });
  });

  it("normalizes custom text blip sounds before storing them", () => {
    const invalidSound = {
      name: "not audio",
      type: "text/plain",
      size: 10,
      dataUrl: "data:text/plain;base64,ZmFrZQ==",
    };

    useUIStore.getState().setCustomTextBlipSound(invalidSound);
    expect(useUIStore.getState().customTextBlipSound).toBeNull();

    useUIStore.getState().setCustomTextBlipSound({
      name: "  Blip  ",
      type: "  audio/ogg  ",
      size: 10.4,
      dataUrl: "data:audio/ogg;base64,ZmFrZQ==",
    });

    expect(useUIStore.getState().customTextBlipSound).toEqual({
      name: "Blip",
      type: "audio/ogg",
      size: 10,
      dataUrl: "data:audio/ogg;base64,ZmFrZQ==",
    });
  });
});
