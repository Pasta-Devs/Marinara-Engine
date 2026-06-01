// @vitest-environment jsdom

// Regression test for the user-facing half of #1555: an enabled regex script
// stored with a real boolean `enabled: true` must actually transform text on
// the live apply path (useApplyRegex -> ChatInput on send, ChatMessage on
// display). Pre-fix parseScript read `enabled === "true"` only, so a boolean
// row computed enabledBool=false and the script was silently skipped.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useApplyRegex } from "./regex-application";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const regexScriptsMock = vi.hoisted(() => ({
  data: [] as Array<Record<string, unknown>>,
}));

vi.mock("./hooks/use-regex-scripts", () => {
  return { useRegexScripts: () => ({ data: regexScriptsMock.data }) };
});

function regexScript(overrides: Record<string, unknown>) {
  return {
    id: "rx1",
    characterId: null,
    name: "FooBar",
    enabled: true,
    promptOnly: false,
    findRegex: "foo",
    replaceString: "bar",
    trimStrings: [],
    placement: ["ai_output", "user_input"],
    flags: "g",
    order: 0,
    minDepth: null,
    maxDepth: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function Probe() {
  const { applyToAIOutput, applyToUserInput } = useApplyRegex();
  return (
    <div>
      <span data-testid="ai">{applyToAIOutput("foo baz")}</span>
      <span data-testid="user">{applyToUserInput("foo baz")}</span>
    </div>
  );
}

describe("useApplyRegex applies enabled boolean scripts (#1555)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    regexScriptsMock.data = [regexScript({})];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("transforms ai_output and user_input text when enabled is a real boolean true", async () => {
    await act(async () => {
      root.render(<Probe />);
    });
    // GREEN post-fix: the boolean-true script applies; pre-fix it was skipped
    // (enabledBool=false) and the text passed through unchanged ("foo baz").
    expect(container.querySelector('[data-testid="ai"]')?.textContent).toBe("bar baz");
    expect(container.querySelector('[data-testid="user"]')?.textContent).toBe("bar baz");
  });
});

function ScopedProbe({
  mode,
  characterId,
}: {
  mode?: "disabled" | "exclusive" | "chat";
  characterId?: string | null;
}) {
  const { applyToUserInput } = useApplyRegex(["char-a", "char-b"]);
  return <span data-testid="result">{applyToUserInput("global alpha beta", { scopedMode: mode, characterId })}</span>;
}

describe("useApplyRegex scopes character regex scripts", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    regexScriptsMock.data = [
      regexScript({ id: "global", characterId: null, findRegex: "global", replaceString: "GLOBAL" }),
      regexScript({ id: "char-a", characterId: "char-a", findRegex: "alpha", replaceString: "ALPHA" }),
      regexScript({ id: "char-b", characterId: "char-b", findRegex: "beta", replaceString: "BETA" }),
    ];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps disabled mode global-only", async () => {
    await act(async () => {
      root.render(<ScopedProbe mode="disabled" characterId="char-a" />);
    });
    expect(container.querySelector('[data-testid="result"]')?.textContent).toBe("GLOBAL alpha beta");
  });

  it("keeps exclusive mode on the target character only", async () => {
    await act(async () => {
      root.render(<ScopedProbe mode="exclusive" characterId="char-a" />);
    });
    expect(container.querySelector('[data-testid="result"]')?.textContent).toBe("global ALPHA beta");
  });

  it("runs every script loaded for the chat in chat mode, including user input without a character id", async () => {
    await act(async () => {
      root.render(<ScopedProbe mode="chat" />);
    });
    expect(container.querySelector('[data-testid="result"]')?.textContent).toBe("GLOBAL ALPHA BETA");
  });

  it("defaults missing scoped mode to chat mode", async () => {
    await act(async () => {
      root.render(<ScopedProbe />);
    });
    expect(container.querySelector('[data-testid="result"]')?.textContent).toBe("GLOBAL ALPHA BETA");
  });
});
