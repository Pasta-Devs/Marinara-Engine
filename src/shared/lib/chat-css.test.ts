import { describe, expect, it } from "vitest";
import { filterCssByMode, scopeChatCss } from "./chat-css";

describe("filterCssByMode", () => {
  it("keeps global CSS and only the requested chat mode block", () => {
    const css = [
      ".shared { color: white; }",
      "@chat-mode roleplay { .rp { color: red; } }",
      "@chat-mode conversation { .convo { color: blue; } }",
      "@chat-mode game { .game { color: green; } }",
      ".tail { color: black; }",
    ].join("\n");

    expect(filterCssByMode(css, "conversation")).toContain(".shared");
    expect(filterCssByMode(css, "conversation")).toContain(".convo");
    expect(filterCssByMode(css, "conversation")).toContain(".tail");
    expect(filterCssByMode(css, "conversation")).not.toContain(".rp");
    expect(filterCssByMode(css, "conversation")).not.toContain(".game");
  });

  it("handles nested rule blocks inside mode filters", () => {
    const css = "@chat-mode game { @media (min-width: 600px) { .panel { color: lime; } } }";

    expect(filterCssByMode(css, "game")).toContain("@media");
    expect(filterCssByMode(css, "game")).toContain(".panel");
    expect(filterCssByMode(css, "roleplay").trim()).toBe("");
  });
});

describe("scopeChatCss sanitization", () => {
  it("blocks network, theme override, content, scope escape, and important constructs", () => {
    const sanitized = scopeChatCss(`
      @import url("https://example.test/evil.css");
      @font-face { font-family: Sneak; src: url("https://example.test/font.woff2"); }
      .card:has(.secret) {
        background: url("https://example.test/track.png");
        --background: red;
        content: "spoof";
        position: fixed !important;
      }
    `, ".mari-card-css");

    expect(sanitized).not.toMatch(/@import/i);
    expect(sanitized).not.toMatch(/@font-face/i);
    expect(sanitized).not.toMatch(/https:\/\/example\.test/i);
    expect(sanitized).not.toContain("--background");
    expect(sanitized).not.toMatch(/:has/i);
    expect(sanitized).not.toMatch(/!important/i);
    expect(sanitized).toContain("url(about:invalid)");
    expect(sanitized).toContain("content: '';");
    expect(sanitized).toContain("position:absolute");
  });

  it("blocks content declarations without a trailing semicolon", () => {
    const sanitized = scopeChatCss(".card::before { content: \"fake button\" }", ".mari-card-css");

    expect(sanitized).not.toContain("fake button");
    expect(sanitized).toContain("content: ''}");
  });

  it("allows data image URLs", () => {
    expect(scopeChatCss(".portrait { background: url(data:image/png;base64,abc); }", ".mari-card-css")).toContain(
      "data:image/png",
    );
  });
});

describe("scopeChatCss", () => {
  it("scopes selectors and root-like selectors under the provided scope", () => {
    const scoped = scopeChatCss(":root { color: red; }\n.name, body .bubble { opacity: 1; }", ".mari-card-css");

    expect(scoped).toContain(".mari-card-css { color: red; }");
    expect(scoped).toContain(".mari-card-css .name");
    expect(scoped).toContain(".mari-card-css .bubble");
  });

  it("namespaces keyframes and animation references", () => {
    const scoped = scopeChatCss("@keyframes shimmer { from { opacity: 0; } to { opacity: 1; } }\n.card { animation: shimmer 1s ease; }", ".mari-card-css");

    expect(scoped).toContain("@keyframes mc-shimmer");
    expect(scoped).toContain("animation: mc-shimmer 1s ease");
  });
});
