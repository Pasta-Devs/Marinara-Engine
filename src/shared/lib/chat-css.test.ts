import { describe, expect, it } from "vitest";
import { cssTargetsTypingIndicator, filterCssByMode, scopeChatCss, stripDangerousCss } from "./chat-css";

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

  it("ignores braces inside strings and comments when skipping another mode", () => {
    const css = [
      '@chat-mode game { .game::before { content: "}"; } /* } */ .leak { color: red; } }',
      "@chat-mode conversation { .convo { color: blue; } }",
    ].join("\n");
    const filtered = filterCssByMode(css, "conversation");

    expect(filtered).toContain(".convo");
    expect(filtered).not.toContain(".leak");
    expect(filtered).not.toContain('content: "}"');
  });
});

describe("scopeChatCss sanitization", () => {
  it("blocks network, theme override, scope escape, and important constructs", () => {
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
    expect(sanitized).toContain("position:absolute");
  });

  it("neutralizes escaped url() so it can't tunnel under the network guard", () => {
    // `\75rl(...)` parses as url(...) in the engine; the function name is decoded before the guard.
    const sanitized = scopeChatCss(".x { background: \\75rl(https://tracker.test/pixel); }", ".mari-card-css");
    expect(sanitized).not.toMatch(/tracker\.test/i);
    expect(sanitized).toContain("url(about:invalid)");
  });

  it("preserves benign escapes outside function names (only function-name tokens are decoded)", () => {
    // An escaped slash in a class name (e.g. a "w-1/2"-style utility class) must survive intact.
    expect(scopeChatCss(".w-1\\/2 { color: red }", ".mari-card-css")).toContain(".w-1\\/2");
    // An escaped code point inside a content string is preserved, not rewritten.
    expect(scopeChatCss('.card::before { content: "\\2014" }', ".mari-card-css")).toContain('"\\2014"');
  });

  it("does not decode function-name escapes that live inside a content string", () => {
    // `\75rl(` here is decorative text, not a real url() call — it must stay literal, not become "url(".
    const sanitized = scopeChatCss('.card::before { content: "\\75rl(" }', ".mari-card-css");
    expect(sanitized).toContain('"\\75rl("');
    expect(sanitized).not.toContain('"url("');
  });

  it("allows sanitized content text (no HTML-like chars)", () => {
    const sanitized = scopeChatCss('.card::before { content: "Hello World" }', ".mari-card-css");
    expect(sanitized).toContain('content: "Hello World"');
  });

  it("strips HTML-like characters from content text", () => {
    const sanitized = scopeChatCss('.card::before { content: "<button>Click me</button>" }', ".mari-card-css");
    expect(sanitized).not.toContain("<button>");
    expect(sanitized).not.toContain("</button>");
    expect(sanitized).toContain('content: "buttonClick me/button"');
  });

  it("keeps semicolons inside quoted content values", () => {
    const sanitized = scopeChatCss('.card::before { content: "A; B"; color: red }', ".mari-card-css");
    expect(sanitized).toContain('content: "A; B";');
    expect(sanitized).toContain("color: red");
  });

  it("caps content text length at 200 characters", () => {
    const longText = "A".repeat(300);
    const sanitized = scopeChatCss(`.card::before { content: "${longText}" }`, ".mari-card-css");
    expect(sanitized).toContain("A".repeat(200));
    expect(sanitized).not.toContain("A".repeat(201));
  });

  it("allows empty content strings", () => {
    const sanitized = scopeChatCss(".card::before { content: '' }", ".mari-card-css");
    expect(sanitized).toContain("content: ''");
  });

  it("allows CSS content functions", () => {
    const sanitized = scopeChatCss('.card::before { content: counter(section) }', ".mari-card-css");
    expect(sanitized).toContain("content: counter(section)");
  });

  it("sanitizes quoted text segments beside allowed CSS content functions", () => {
    const sanitized = scopeChatCss(
      '.card::before { content: attr(data-typing-name) "<button>fake</button>" }',
      ".mari-card-css",
    );
    expect(sanitized).toContain('content: attr(data-typing-name) "buttonfake/button"');
    expect(sanitized).not.toContain("<button>");
    expect(sanitized).not.toContain("</button>");
  });

  it("preserves content: attr(data-typing-name) (the documented typing-label pattern)", () => {
    const sanitized = scopeChatCss(
      ".mari-typing-indicator::after { content: attr(data-typing-name) }",
      ".mari-card-css",
    );
    expect(sanitized).toContain("attr(data-typing-name)");
    // and the selector is still scoped under the card root
    expect(sanitized).toContain(".mari-card-css .mari-typing-indicator::after");
  });

  it("falls back to empty string for unrecognized content values", () => {
    const sanitized = scopeChatCss(".card::before { content: something-weird }", ".mari-card-css");
    expect(sanitized).toContain("content: ''");
  });

  it("allows data image URLs", () => {
    expect(scopeChatCss(".portrait { background: url(data:image/png;base64,abc); }", ".mari-card-css")).toContain(
      "data:image/png",
    );
  });

  it("allows @font-face with data: URIs only", () => {
    const css = '@font-face { font-family: MyFont; src: url(data:font/woff2;base64,abc); }';
    const sanitized = scopeChatCss(css, ".mari-card-css");
    expect(sanitized).toMatch(/@font-face/i);
    expect(sanitized).toContain("data:font/woff2");
  });

  it("strips @font-face blocks with external URLs", () => {
    const css = '@font-face { font-family: Sneak; src: url("https://evil.test/font.woff2"); }';
    const sanitized = scopeChatCss(css, ".mari-card-css");
    expect(sanitized).not.toMatch(/@font-face/i);
  });

  it("strips @font-face blocks whose source is a non-font data: URI (e.g. image)", () => {
    // image/* data URIs are allowed for general url() use but are NOT valid font sources;
    // the whole @font-face block is dropped so the documented font-only contract holds.
    const css = '@font-face { font-family: Sneak; src: url(data:image/png;base64,abc); }';
    const sanitized = scopeChatCss(css, ".mari-card-css");
    expect(sanitized).not.toMatch(/@font-face/i);
  });

  it("strips @font-face blocks with local() / no data: url source (no vacuous pass)", () => {
    // local() references an installed font (non-data, fingerprintable) and there's no data:
    // url at all — must not survive the font-data-only contract.
    expect(scopeChatCss('@font-face { font-family: Sneak; src: local("Inter"); }', ".mari-card-css")).not.toMatch(
      /@font-face/i,
    );
    // local() mixed with a valid data: font is still rejected (any non-data source disqualifies).
    expect(
      scopeChatCss(
        '@font-face { font-family: Sneak; src: local("Inter"), url(data:font/woff2;base64,abc); }',
        ".mari-card-css",
      ),
    ).not.toMatch(/@font-face/i);
  });

  it("strips @font-face blocks that hide local() behind escaped function names", () => {
    // `l\6f cal(...)` parses as local(...); the function name is decoded before the gate runs,
    // so the escaped source is caught even alongside a valid data: font url.
    const css = '@font-face { font-family: Sneak; src: l\\6f cal("Inter"), url(data:font/woff2;base64,abc); }';
    expect(scopeChatCss(css, ".mari-card-css")).not.toMatch(/@font-face/i);
  });

  it("allows data: URIs with application/font MIME types", () => {
    const css = '.icon { background: url(data:application/font-woff2;base64,abc); }';
    const sanitized = scopeChatCss(css, ".mari-card-css");
    expect(sanitized).toContain("data:application/font-woff2");
  });

  it("strips broad data:application/octet-stream urls (fonts/images only)", () => {
    const sanitized = scopeChatCss(".x { background: url(data:application/octet-stream;base64,abc); }", ".mari-card-css");
    expect(sanitized).not.toContain("octet-stream");
    expect(sanitized).toContain("url(about:invalid)");
  });

  it("namespaces @font-face families and rewrites references so embedded fonts can't leak app-wide", () => {
    const css =
      '@font-face { font-family: "Inter"; src: url(data:font/woff2;base64,abc); }\n.label { font-family: "Inter", sans-serif; }';
    const sanitized = scopeChatCss(css, ".mari-card-css");
    // the embedded family is renamed to a namespaced one
    expect(sanitized).toContain("mc-font-Inter");
    // and no bare app-family "Inter" is ever declared (which would otherwise override app UI)
    expect(sanitized).not.toMatch(/font-family:\s*["']?Inter["']?\s*[;,}]/i);
    // the reference still resolves to the namespaced family and keeps the fallback
    expect(sanitized).toContain("sans-serif");
  });

  it("salts @font-face names so two cards embedding the same family can't collide globally", () => {
    const cardA =
      '@font-face { font-family: "Inter"; src: url(data:font/woff2;base64,AAA); }\n.label { font-family: "Inter"; }';
    const cardB =
      '@font-face { font-family: "Inter"; src: url(data:font/woff2;base64,BBB); }\n.label { font-family: "Inter"; }';
    const a = scopeChatCss(cardA, ".mari-card-css");
    const b = scopeChatCss(cardB, ".mari-card-css");
    const nameA = a.match(/mc-font-Inter-[a-z0-9]+/i)?.[0];
    const nameB = b.match(/mc-font-Inter-[a-z0-9]+/i)?.[0];
    expect(nameA).toBeTruthy();
    expect(nameB).toBeTruthy();
    expect(nameA).not.toBe(nameB);
  });

  it("keeps multiple faces of one family grouped under a single salted name within a card", () => {
    const css =
      '@font-face { font-family: "Inter"; font-weight: 400; src: url(data:font/woff2;base64,AAA); }\n' +
      '@font-face { font-family: "Inter"; font-weight: 700; src: url(data:font/woff2;base64,BBB); }\n' +
      '.label { font-family: "Inter", sans-serif; }';
    const out = scopeChatCss(css, ".mari-card-css");
    const names = [...out.matchAll(/mc-font-Inter-[a-z0-9]+/gi)].map((m) => m[0]);
    // 2 @font-face declarations + 1 reference, all rewritten to the same salted family name
    expect(names.length).toBe(3);
    expect(new Set(names).size).toBe(1);
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

  it("scopes chained selectors on [data-card-css] in exclusive mode", () => {
    const exclusiveScope = '.mari-card-css [data-card-css="char-123"]';
    const scoped = scopeChatCss(
      '[data-card-css]:not([data-grouped]) .body { color: red; }\n[data-card-css][data-grouped] .body { color: blue; }',
      exclusiveScope,
    );

    expect(scoped).toContain('.mari-card-css [data-card-css="char-123"]:not([data-grouped]) .body');
    expect(scoped).toContain('.mari-card-css [data-card-css="char-123"][data-grouped] .body');
    // Must NOT create nested [data-card-css] descendant selectors
    expect(scoped).not.toContain('] [data-card-css]:');
    expect(scoped).not.toContain('] [data-card-css][');
  });

  it("scopes chained selectors on [data-card-css] as descendant in chat mode", () => {
    const chatScope = ".mari-card-css";
    const scoped = scopeChatCss(
      '[data-card-css]:not([data-grouped]) .body { color: red; }\n[data-card-css][data-grouped] .body { color: blue; }',
      chatScope,
    );

    expect(scoped).toContain(".mari-card-css [data-card-css]:not([data-grouped]) .body");
    expect(scoped).toContain(".mari-card-css [data-card-css][data-grouped] .body");
  });

  it("scopes chained class selectors on [data-card-css] in exclusive mode", () => {
    const exclusiveScope = '.mari-card-css [data-card-css="char-123"]';
    const scoped = scopeChatCss(
      "[data-card-css].mari-message-group { border-left: 2px solid pink; }",
      exclusiveScope,
    );

    expect(scoped).toContain('.mari-card-css [data-card-css="char-123"].mari-message-group');
  });

  it("scopes chained class selectors on [data-card-css] as descendant in chat mode", () => {
    const chatScope = ".mari-card-css";
    const scoped = scopeChatCss(
      "[data-card-css].mari-message-group { border-left: 2px solid pink; }",
      chatScope,
    );

    expect(scoped).toContain(".mari-card-css [data-card-css].mari-message-group");
  });
});

describe("cssTargetsTypingIndicator", () => {
  it("detects the .mari-typing-* selector hooks", () => {
    expect(cssTargetsTypingIndicator(".mari-typing-text { color: red; }")).toBe(true);
    expect(cssTargetsTypingIndicator(".mari-typing-dots span { background: pink; }")).toBe(true);
    expect(cssTargetsTypingIndicator(".mari-typing-indicator { gap: 4px; }")).toBe(true);
  });

  it("detects data-typing-name usage (e.g. content: attr(data-typing-name))", () => {
    expect(
      cssTargetsTypingIndicator('.mari-typing-indicator::after { content: attr(data-typing-name); }'),
    ).toBe(true);
  });

  it("returns false for CSS that doesn't touch the typing indicator", () => {
    expect(cssTargetsTypingIndicator(".mari-message-content { color: red; } .name { font-weight: 700; }")).toBe(
      false,
    );
  });

  it("ignores typing hooks that only appear inside comments", () => {
    // A comment mentioning the hook must NOT count as an active selector.
    expect(cssTargetsTypingIndicator("/* tweak .mari-typing-text later */ .name { color: red; }")).toBe(false);
    expect(cssTargetsTypingIndicator("/* uses data-typing-name */ .bubble { opacity: 1; }")).toBe(false);
  });

  it("ignores typing hooks that only appear inside decorative strings", () => {
    expect(cssTargetsTypingIndicator('.label::after { content: ".mari-typing-text"; }')).toBe(false);
    expect(cssTargetsTypingIndicator('.label::after { content: "data-typing-name"; }')).toBe(false);
  });

  it("composes with filterCssByMode so only the active surface's typing rules count", () => {
    const css = [
      "@chat-mode roleplay { .mari-typing-text { color: lime; } }",
      "@chat-mode conversation { .bubble { color: white; } }",
    ].join("\n");
    // The typing rule lives in the roleplay block, so it must not register for conversation…
    expect(cssTargetsTypingIndicator(filterCssByMode(css, "conversation"))).toBe(false);
    // …but it does for roleplay.
    expect(cssTargetsTypingIndicator(filterCssByMode(css, "roleplay"))).toBe(true);
  });

  it("detects a conversation-scoped typing rule under the conversation filter", () => {
    const css = "@chat-mode conversation { .mari-typing-text::after { content: ' is cooking…'; } }";
    expect(cssTargetsTypingIndicator(filterCssByMode(css, "conversation"))).toBe(true);
    expect(cssTargetsTypingIndicator(filterCssByMode(css, "game"))).toBe(false);
  });
});

describe("stripDangerousCss (theme/extension CSS)", () => {
  it("neutralizes remote url() exfiltration", () => {
    const out = stripDangerousCss(".bg { background: url(https://tracker.test/pixel.png); }");
    expect(out).toContain("url(about:invalid)");
    expect(out).not.toContain("tracker.test");
  });

  it("still neutralizes url() hidden behind escaped characters (#1989)", () => {
    const out = stripDangerousCss(".bg { background: \\75rl(https://tracker.test/pixel); }");
    expect(out).not.toContain("tracker.test");
  });

  it("keeps data: image and font URLs", () => {
    expect(stripDangerousCss(".x { background: url(data:image/png;base64,abc); }")).toContain("data:image/png");
    expect(
      stripDangerousCss("@font-face { font-family: F; src: url(data:font/woff2;base64,abc); }"),
    ).toContain("data:font/woff2");
  });

  it("strips @import, expression(), and javascript: vectors", () => {
    expect(stripDangerousCss('@import "https://evil.test/x.css"; .a { color: red; }')).not.toContain("@import");
    expect(stripDangerousCss(".a { width: expression(alert(1)); }")).not.toContain("expression(");
    expect(stripDangerousCss(".a { background: javascript:alert(1); }")).not.toContain("javascript:");
  });

  it("defuses :visited history probing", () => {
    expect(stripDangerousCss("a:visited { color: red; }")).not.toContain(":visited");
  });

  it("preserves a theme's legitimate token, !important, and position overrides", () => {
    const themeCss = ":root { --background: #101010; --accent: #ff0066; } .panel { color: red !important; position: fixed; }";
    const out = stripDangerousCss(themeCss);
    expect(out).toContain("--background: #101010");
    expect(out).toContain("--accent: #ff0066");
    expect(out).toContain("!important");
    expect(out).toContain("position: fixed");
  });
});
