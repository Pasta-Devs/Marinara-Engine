// @vitest-environment jsdom

import { act } from "react";
import type { ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { CreatorNotesCssInjector } from "./CreatorNotesCssInjector";

const STYLE_ELEMENT_ID = "marinara-card-css";

const characters = [
  {
    id: "char-a",
    data: JSON.stringify({
      creator_notes:
        "<style>.bubble { color: red; } @chat-mode conversation { .conversation-only { color: blue; } } @chat-mode roleplay { .roleplay-only { color: green; } }</style>",
    }),
  },
  {
    id: "char-b",
    data: JSON.stringify({
      creator_notes: "<style>.other { color: purple; }</style>",
    }),
  },
];

let root: Root | undefined;

function renderInjector(props: Partial<ComponentProps<typeof CreatorNotesCssInjector>> = {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);

  act(() => {
    root?.render(
      <CreatorNotesCssInjector
        characterIds={["char-a"]}
        allCharacters={characters}
        mode="chat"
        chatMode="conversation"
        {...props}
      />,
    );
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = undefined;
  document.body.innerHTML = "";
  document.getElementById(STYLE_ELEMENT_ID)?.remove();
});

describe("CreatorNotesCssInjector", () => {
  it("injects global and matching mode CSS for active characters", () => {
    renderInjector();

    const style = document.getElementById(STYLE_ELEMENT_ID);
    expect(style?.textContent).toContain("@layer card-css");
    expect(style?.textContent).toContain(".mari-card-css .bubble");
    expect(style?.textContent).toContain(".mari-card-css .conversation-only");
    expect(style?.textContent).not.toContain(".roleplay-only");
    expect(style?.textContent).not.toContain(".other");
  });

  it("scopes exclusive mode to the active character message wrapper", () => {
    renderInjector({ mode: "exclusive" });

    expect(document.getElementById(STYLE_ELEMENT_ID)?.textContent).toContain(
      '.mari-card-css [data-card-css="char-a"] .bubble',
    );
  });

  it("clears injected CSS when disabled", () => {
    renderInjector({ mode: "disabled" });

    expect(document.getElementById(STYLE_ELEMENT_ID)?.textContent ?? "").toBe("");
  });
});
