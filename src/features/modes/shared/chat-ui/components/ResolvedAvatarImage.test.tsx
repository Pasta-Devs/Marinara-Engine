// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { avatarFileUrlFromPath, resolveAvatarFileUrl } from "../../../../../shared/api/local-file-api";
import { ResolvedAvatarImage } from "./ResolvedAvatarImage";

vi.mock("../../../../../shared/api/local-file-api", () => ({
  avatarFileUrlFromPath: vi.fn(),
  resolveAvatarFileUrl: vi.fn(),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const avatarFileUrlFromPathMock = vi.mocked(avatarFileUrlFromPath);
const resolveAvatarFileUrlMock = vi.mocked(resolveAvatarFileUrl);

describe("ResolvedAvatarImage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    avatarFileUrlFromPathMock.mockReset();
    resolveAvatarFileUrlMock.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("resolves managed avatar files without rendering stale filesystem paths", async () => {
    avatarFileUrlFromPathMock.mockReturnValue("/Users/philipp/Library/Application Support/marinara/avatar.png");
    resolveAvatarFileUrlMock.mockResolvedValue("blob:http://localhost/avatar");
    const onResolvedSrc = vi.fn();

    await act(async () => {
      root.render(
        <ResolvedAvatarImage
          src="/Users/philipp/Library/Application Support/marinara/avatar.png"
          avatarFilePath="/Users/philipp/Library/Application Support/marinara/avatar.png"
          avatarFilename="avatar.png"
          alt="Ada"
          onResolvedSrc={onResolvedSrc}
        />,
      );
    });

    expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:http://localhost/avatar");
    expect(container.innerHTML).not.toContain("/Users/philipp");
    expect(resolveAvatarFileUrlMock).toHaveBeenCalledWith(
      "avatar.png",
      "/Users/philipp/Library/Application Support/marinara/avatar.png",
    );
    expect(onResolvedSrc).toHaveBeenLastCalledWith("blob:http://localhost/avatar");
  });

  it("does not fall back to a stale filesystem path when managed resolution fails", async () => {
    avatarFileUrlFromPathMock.mockReturnValue("/Users/philipp/Library/Application Support/marinara/avatar.png");
    resolveAvatarFileUrlMock.mockRejectedValue(new Error("401"));

    await act(async () => {
      root.render(
        <ResolvedAvatarImage
          src="/Users/philipp/Library/Application Support/marinara/avatar.png"
          avatarFilePath="/Users/philipp/Library/Application Support/marinara/avatar.png"
          avatarFilename="avatar.png"
          alt="Ada"
        />,
      );
    });

    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("/Users/philipp");
  });

  it("renders expression or inline avatar sources directly", async () => {
    await act(async () => {
      root.render(<ResolvedAvatarImage src="data:image/png;base64,AAAA" alt="Expression" />);
    });

    expect(container.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,AAAA");
    expect(resolveAvatarFileUrlMock).not.toHaveBeenCalled();
  });
});
