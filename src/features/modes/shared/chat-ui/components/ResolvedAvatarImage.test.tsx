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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

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

  it("does not render the previous resolved avatar after managed avatar props change", async () => {
    avatarFileUrlFromPathMock.mockReturnValue("/Users/philipp/Library/Application Support/marinara/avatar.png");
    const first = deferred<string | null>();
    const second = deferred<string | null>();
    resolveAvatarFileUrlMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

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
    await act(async () => {
      first.resolve("blob:http://localhost/old-avatar");
      await first.promise;
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:http://localhost/old-avatar");

    await act(async () => {
      root.render(
        <ResolvedAvatarImage
          src="/Users/philipp/Library/Application Support/marinara/next-avatar.png"
          avatarFilePath="/Users/philipp/Library/Application Support/marinara/next-avatar.png"
          avatarFilename="next-avatar.png"
          alt="Ada"
        />,
      );
    });

    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("old-avatar");

    await act(async () => {
      second.resolve("blob:http://localhost/next-avatar");
      await second.promise;
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:http://localhost/next-avatar");
  });

  it("renders expression or inline avatar sources directly", async () => {
    await act(async () => {
      root.render(<ResolvedAvatarImage src="data:image/png;base64,AAAA" alt="Expression" />);
    });

    expect(container.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,AAAA");
    expect(resolveAvatarFileUrlMock).not.toHaveBeenCalled();
  });
});
