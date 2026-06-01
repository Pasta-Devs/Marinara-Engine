import { afterEach, describe, expect, it } from "vitest";
import { useGalleryStore } from "./gallery.store";

afterEach(() => {
  useGalleryStore.setState({ pinnedImages: [], illustratingChatIds: [] });
});

describe("gallery illustration state", () => {
  it("keeps manual illustration pending state in the shared store", () => {
    const firstStart = useGalleryStore.getState().startIllustrating("chat-1");
    const duplicateStart = useGalleryStore.getState().startIllustrating("chat-1");

    expect(firstStart).toBe(true);
    expect(duplicateStart).toBe(false);
    expect(useGalleryStore.getState().illustratingChatIds).toEqual(["chat-1"]);

    useGalleryStore.getState().finishIllustrating("chat-1");

    expect(useGalleryStore.getState().illustratingChatIds).toEqual([]);
  });
});
