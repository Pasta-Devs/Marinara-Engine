/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

// Spy on the block-level markdown parser so we can assert how often it runs.
const { renderMarkdownBlocks } = vi.hoisted(() => ({
  renderMarkdownBlocks: vi.fn((content: string, _renderInline?: unknown) => [content]),
}));
vi.mock("../../../../shared/lib/markdown", () => ({
  renderMarkdownBlocks: (content: string, renderInline: unknown) => renderMarkdownBlocks(content, renderInline),
  applyInlineMarkdown: (text: string) => [text],
}));

import { MessageContent } from "./ConversationMessage";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("MessageContent memoization (#2304)", () => {
  let container: HTMLDivElement;
  let root: Root;

  function mount(node: Parameters<Root["render"]>[0]) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(node));
  }

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    renderMarkdownBlocks.mockClear();
  });

  it("does not re-parse when content is unchanged across re-renders", () => {
    mount(<MessageContent content="hello **world**" onImageOpen={() => {}} />);
    expect(renderMarkdownBlocks).toHaveBeenCalledTimes(1);

    // Re-render with a NEW onImageOpen identity (defeating the React.memo bail) but the
    // same content — the streaming render storm forced exactly this. The parse must not run again.
    act(() => root.render(<MessageContent content="hello **world**" onImageOpen={() => {}} />));
    expect(renderMarkdownBlocks).toHaveBeenCalledTimes(1);
  });

  it("re-parses when the content changes", () => {
    mount(<MessageContent content="first" onImageOpen={() => {}} />);
    expect(renderMarkdownBlocks).toHaveBeenCalledTimes(1);

    act(() => root.render(<MessageContent content="second" onImageOpen={() => {}} />));
    expect(renderMarkdownBlocks).toHaveBeenCalledTimes(2);
  });

  it("renders an inline image button for image URLs without parsing markdown", () => {
    const opened: string[] = [];
    mount(<MessageContent content="https://example.test/pic.png" onImageOpen={(url) => opened.push(url)} />);
    expect(renderMarkdownBlocks).not.toHaveBeenCalled();
    const button = container.querySelector("button");
    expect(button?.querySelector("img")?.getAttribute("src")).toBe("https://example.test/pic.png");
  });
});
