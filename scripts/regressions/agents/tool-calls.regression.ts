import assert from "node:assert/strict";
import { DEFAULT_AGENT_TOOLS } from "../../../packages/shared/src/index.js";
import { isChatToolEnabledByDefault } from "../../../packages/server/src/services/generation/tool-resolution-runtime.js";
import {
  createCustomToolArgumentsValidator,
  executeToolCalls,
  formatToolExecutionResultForModel,
} from "../../../packages/server/src/services/tools/tool-executor.js";
import { decodeHtmlEntities, extractReadableText } from "../../../packages/server/src/services/tools/web-page-text.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import "../fixtures/regression-agent-definitions.js";

async function callWebFetch(args: Record<string, unknown>) {
  const [result] = await executeToolCalls([
    {
      id: "call_web_fetch",
      type: "function",
      function: { name: "web_fetch", arguments: JSON.stringify(args) },
    },
  ]);
  assert.ok(result, "web_fetch returned a result");
  return { success: result!.success, payload: JSON.parse(result!.result) as Record<string, unknown> };
}

const cases: RegressionCase[] = [
  {
    name: "custom tool validators isolate schema identifiers and reject async schemas",
    run() {
      const schema = {
        $id: "https://marinara.invalid/regression-tool.schema.json",
        type: "object",
        properties: {
          action: { type: "string" },
        },
        required: ["action"],
      };
      const firstValidator = createCustomToolArgumentsValidator(schema);
      const secondValidator = createCustomToolArgumentsValidator({ ...schema });

      assert.equal(firstValidator({ action: "retry" }), null);
      assert.equal(secondValidator({ action: "retry" }), null);
      assert.match(firstValidator({}) ?? "", /required property 'action'/u);
      assert.throws(
        () =>
          createCustomToolArgumentsValidator({
            $async: true,
            type: "object",
            properties: {},
          }),
        /Async tool parameter schemas are not supported/u,
      );
    },
  },
  {
    name: "built-in tool schemas reject malformed and invalid arguments while allowing valid calls",
    async run() {
      const results = await executeToolCalls([
        {
          id: "call_malformed_roll_dice",
          type: "function",
          function: {
            name: "roll_dice",
            arguments: "{",
          },
        },
        {
          id: "call_array_roll_dice",
          type: "function",
          function: {
            name: "roll_dice",
            arguments: "[]",
          },
        },
        {
          id: "call_missing_roll_dice_argument",
          type: "function",
          function: {
            name: "roll_dice",
            arguments: "{}",
          },
        },
        {
          id: "call_valid_roll_dice",
          type: "function",
          function: {
            name: "roll_dice",
            arguments: JSON.stringify({ notation: "1d2" }),
          },
        },
        {
          id: "call_missing_spotify_play_target",
          type: "function",
          function: {
            name: "spotify_play",
            arguments: JSON.stringify({ reason: "No track supplied" }),
          },
        },
        {
          id: "call_combined_spotify_play",
          type: "function",
          function: {
            name: "spotify_play",
            arguments: JSON.stringify({
              uri: "spotify:track:lead",
              uris: ["spotify:track:queued"],
            }),
          },
        },
      ]);

      assert.equal(results[0]?.success, false);
      assert.match(results[0]!.result, /expected valid JSON/u);
      assert.equal(results[1]?.success, false);
      assert.match(results[1]!.result, /expected a JSON object/u);
      assert.equal(results[2]?.success, false);
      assert.match(results[2]!.result, /required property 'notation'/u);
      assert.equal(results[3]?.success, true);
      assert.equal((JSON.parse(results[3]!.result) as { notation: string }).notation, "1d2");
      assert.equal(results[4]?.success, false);
      assert.match(results[4]!.result, /Invalid arguments/u);
      assert.equal(results[5]?.success, false);
      assert.doesNotMatch(results[5]!.result, /Invalid arguments/u);
      assert.match(results[5]!.result, /Spotify not configured/u);
    },
  },
  {
    name: "custom schema validation blocks invalid webhooks and reports semantic failures",
    async run() {
      const originalFetch = globalThis.fetch;
      const previousAllowLocal = process.env.WEBHOOK_LOCAL_URLS_ENABLED;
      const conflictPayload = { message: "Retry later", retryable: true };
      let fetchCalls = 0;
      process.env.WEBHOOK_LOCAL_URLS_ENABLED = "true";
      globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
        fetchCalls += 1;
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          arguments?: { action?: string };
        };
        if (body.arguments?.action === "conflict") {
          return new Response(JSON.stringify(conflictPayload), {
            status: 409,
          });
        }
        if (body.arguments?.action === "reported_error") {
          return new Response(JSON.stringify({ error: "Webhook rejected the request" }), {
            status: 200,
          });
        }
        return new Response(JSON.stringify({ accepted: true }), {
          status: 200,
        });
      }) as typeof fetch;

      try {
        const customTool = {
          name: "regression_webhook",
          executionType: "webhook",
          webhookUrl: "http://127.0.0.1/regression",
          staticResult: null,
          scriptBody: null,
          validateArguments: createCustomToolArgumentsValidator({
            type: "object",
            properties: {
              action: { type: "string" },
              target: { type: "string", format: "email" },
            },
            required: ["action", "target"],
            additionalProperties: false,
          }),
        };
        const results = await executeToolCalls(
          [
            {
              id: "call_missing_custom_webhook_argument",
              type: "function",
              function: {
                name: "regression_webhook",
                arguments: "{}",
              },
            },
            {
              id: "call_invalid_custom_webhook_format",
              type: "function",
              function: {
                name: "regression_webhook",
                arguments: JSON.stringify({ action: "accepted", target: "not-an-email" }),
              },
            },
            {
              id: "call_failed_custom_webhook",
              type: "function",
              function: {
                name: "regression_webhook",
                arguments: JSON.stringify({ action: "conflict", target: "retry@example.com" }),
              },
            },
            {
              id: "call_reported_custom_webhook_error",
              type: "function",
              function: {
                name: "regression_webhook",
                arguments: JSON.stringify({ action: "reported_error", target: "retry@example.com" }),
              },
            },
            {
              id: "call_successful_custom_webhook",
              type: "function",
              function: {
                name: "regression_webhook",
                arguments: JSON.stringify({ action: "accepted", target: "accepted@example.com" }),
              },
            },
          ],
          { customTools: [customTool] },
        );

        assert.equal(results[0]?.success, false);
        assert.match(results[0]!.result, /required property 'action'/u);
        assert.equal(results[1]?.success, false);
        assert.match((JSON.parse(results[1]!.result) as { error: string }).error, /format "email"/u);
        assert.equal(results[2]?.success, false);
        assert.deepEqual(JSON.parse(results[2]!.result), conflictPayload);
        assert.equal(results[2]?.httpStatus, 409);
        assert.deepEqual(JSON.parse(formatToolExecutionResultForModel(results[2]!)), {
          error: "Tool request failed with HTTP status 409",
          success: false,
          httpStatus: 409,
          response: conflictPayload,
        });
        assert.equal(results[3]?.success, false);
        assert.deepEqual(JSON.parse(results[3]!.result), { error: "Webhook rejected the request" });
        assert.equal(results[4]?.success, true);
        assert.deepEqual(JSON.parse(results[4]!.result), { accepted: true });
        assert.equal(formatToolExecutionResultForModel(results[4]!), results[4]!.result);
        assert.equal(fetchCalls, 3);
      } finally {
        globalThis.fetch = originalFetch;
        if (previousAllowLocal === undefined) {
          delete process.env.WEBHOOK_LOCAL_URLS_ENABLED;
        } else {
          process.env.WEBHOOK_LOCAL_URLS_ENABLED = previousAllowLocal;
        }
      }
    },
  },
  {
    name: "Spotify tools stay agent-owned when chat function calls are enabled",
    run() {
      for (const toolName of DEFAULT_AGENT_TOOLS.spotify ?? []) {
        assert.equal(isChatToolEnabledByDefault(toolName), false, `${toolName} must require Music DJ selection`);
      }
      assert.equal(isChatToolEnabledByDefault("roll_dice"), true);
    },
  },
  {
    name: "web_fetch stays opt-in because it is the only tool that lets the model choose a destination",
    run() {
      assert.equal(isChatToolEnabledByDefault("web_fetch"), false);
      // web_search only ever talks to DuckDuckGo, so it cannot be aimed at an attacker's host.
      assert.equal(isChatToolEnabledByDefault("web_search"), true);
    },
  },
  {
    name: "web_fetch refuses non-https and private addresses without naming the resolved host",
    async run() {
      const insecure = await callWebFetch({ url: "http://example.com/page" });
      assert.equal(insecure.success, false);
      assert.match(String(insecure.payload.error), /only reads https/u);

      for (const url of ["https://127.0.0.1/", "https://2130706433/", "https://0x7f.1/", "https://[::1]/"]) {
        const refused = await callWebFetch({ url });
        assert.equal(refused.success, false, `${url} must be refused`);
        assert.equal(refused.payload.error, "That address is not allowed.");
        // The refusal must not hand the model a map of the user's network.
        assert.doesNotMatch(String(refused.payload.error), /resolved|127\.0\.0\.1|::1|private|loopback/iu);
      }
    },
  },
  {
    name: "web_fetch reports a failed status and reads a text/plain page",
    async run() {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (input: string | URL | Request) => {
        if (String(input).includes("missing")) {
          return new Response("not found", { status: 404, headers: { "content-type": "text/html" } });
        }
        return new Response("Plain text page.", {
          status: 200,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }) as typeof fetch;

      try {
        const missing = await callWebFetch({ url: "https://1.1.1.1/missing" });
        assert.equal(missing.success, false);
        assert.equal(missing.payload.status, 404);
        assert.match(String(missing.payload.error), /failed \(404\)/u);

        const plain = await callWebFetch({ url: "https://1.1.1.1/plain" });
        assert.equal(plain.success, true);
        assert.equal(plain.payload.text, "Plain text page.");
        assert.equal(plain.payload.chars, 16);
        assert.equal(plain.payload.truncated, false);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  },
  {
    name: "web_fetch clips page text and reports the chars and truncated contract",
    async run() {
      const originalFetch = globalThis.fetch;
      const longPage = `<html><head><title>Short title</title></head><body><article><p>${"word ".repeat(4000)}</p></article></body></html>`;
      globalThis.fetch = (async () =>
        new Response(longPage, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        })) as typeof fetch;

      try {
        const clipped = await callWebFetch({ url: "https://1.1.1.1/long", maxChars: 500 });
        assert.equal(clipped.success, true);
        const text = String(clipped.payload.text);
        assert.equal(clipped.payload.chars, String(clipped.payload.title).length + text.length);
        assert.equal(clipped.payload.truncated, true);
        assert.ok(text.length <= 500, `text was ${text.length} characters`);
        assert.ok(
          String(clipped.payload.title).length + text.length <= 500,
          "the title comes out of the same budget as the text",
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  },
  {
    name: "web_fetch decodes a page with the charset it declares",
    async run() {
      const originalFetch = globalThis.fetch;
      // "café" in windows-1252: é is the single byte 0xE9, which is not valid UTF-8.
      const body = Buffer.from(
        `<html><body><article><p>caf${String.fromCharCode(0xe9)} au lait</p></article></body></html>`,
        "latin1",
      );
      globalThis.fetch = (async () =>
        new Response(body, {
          status: 200,
          headers: { "content-type": "text/html; charset=windows-1252" },
        })) as typeof fetch;

      try {
        const decoded = await callWebFetch({ url: "https://1.1.1.1/latin" });
        assert.equal(decoded.success, true);
        assert.match(String(decoded.payload.text), /café au lait/u);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  },
  {
    name: "extraction stays bounded on a deeply nested page",
    run() {
      // Tree construction cost grows with depth, so a crafted page of nested tags used to stall the
      // event loop for tens of seconds. The nesting scan cuts it before the tree is built.
      const depth = 100_000;
      const html = `<html><head><title>nested</title></head><body>${"<article>".repeat(depth)}${"word ".repeat(200)}${"</article>".repeat(depth)}</body></html>`;
      const started = Date.now();
      const extracted = extractReadableText(html, { maxChars: 12_000 });
      const elapsed = Date.now() - started;
      assert.ok(elapsed < 1_000, `deeply nested extraction took ${elapsed}ms`);
      assert.equal(extracted.title, "nested");
    },
  },
  {
    name: "web_fetch extraction drops chrome, scripts and styles",
    run() {
      const page = `<!doctype html>
<html><head><title>Artorias &amp; the Abyss</title>
<style>body { color: red } .hidden { display: none }</style>
<script>window.analytics = { track() { return "noise" } }</script></head>
<body>
  <nav><a href="/">Home</a> <a href="/lore">Lore</a></nav>
  <main>
    <h1>Artorias the Abysswalker</h1>
    <p>Artorias was one of Gwyn's Four Knights, and he &quot;walked the Abyss&quot; to stop its spread.</p>
    <p>He is not a god. His sword deals extra damage to the Abyss&rsquo;s creatures &#8212; the Darkwraiths.</p>
  </main>
  <footer>Copyright &copy; 2024</footer>
</body></html>`;
      const extracted = extractReadableText(page);
      assert.equal(extracted.title, "Artorias & the Abyss");
      assert.match(extracted.text, /Artorias was one of Gwyn's Four Knights/u);
      assert.match(extracted.text, /"walked the Abyss"/u);
      assert.match(extracted.text, /Abyss’s creatures — the Darkwraiths/u);
      assert.doesNotMatch(extracted.text, /window\.analytics|color: red|<[a-z]/iu);
      assert.doesNotMatch(extracted.text, /Copyright/u, "the main block wins over the footer");
    },
  },
  {
    name: "web_fetch extraction prefers the longest content container and keeps bare fragments",
    run() {
      const longestArticle = extractReadableText(`<body>
  <article><p>Short teaser.</p></article>
  <article><p>${"The full article text. ".repeat(20)}</p></article>
</body>`);
      assert.match(longestArticle.text, /The full article text\./u);
      assert.doesNotMatch(longestArticle.text, /Short teaser/u);

      const fragment = extractReadableText("<p>Bare fragment &amp; text.</p>");
      assert.equal(fragment.text, "Bare fragment & text.");
    },
  },
  {
    name: "web_fetch extraction keeps table cells and headings on their own lines",
    run() {
      const infobox = extractReadableText(`<body><main><table class="infobox">
<tr><th>Release date</th><td>April 12, 2016</td></tr>
<tr><th>Developer</th><td>FromSoftware</td></tr>
</table><p>${"Body prose here. ".repeat(20)}</p></main></body>`);
      const lines = infobox.text.split("\n").filter((line) => line.trim());
      assert.ok(lines.includes("Release date"), "the label is its own line");
      assert.ok(lines.includes("April 12, 2016"), "the value is its own line");
      assert.ok(lines.includes("FromSoftware"), "the second value is its own line");

      const formatted = extractReadableText("<div><p>One</p><p>Two</p></div><ul><li>Three</li></ul>");
      assert.deepEqual(
        formatted.text.split("\n").filter((line) => line.trim()),
        ["One", "Two", "Three"],
      );
    },
  },
  {
    name: "web_fetch extraction survives a page-wide form and decodes wiki entities",
    run() {
      // An ASP.NET page wraps everything in one <form>; dropping it must not empty the page.
      const aspNet = extractReadableText(
        `<body><form id="aspnetForm"><div><h1>Title</h1><p>${"Real content that must survive. ".repeat(20)}</p></div></form></body>`,
      );
      assert.match(aspNet.text, /Real content that must survive/u);

      assert.equal(decodeHtmlEntities("&hellip;&mdash;&ndash;&laquo;&raquo;&#x27;&unknown;"), "…—–«»'&unknown;");
    },
  },
  {
    name: "web_fetch keeps content whose id or class only contains a chrome word",
    run() {
      // `protocol-overview` contains "toc" and `menu-guide` contains "menu"; neither is chrome.
      const page = `<html><body><main>
<p>Short intro line.</p>
<div id="protocol-overview"><p>${"The protocol overview explains the handshake. ".repeat(10)}</p></div>
<div class="menu-guide"><p>${"The menu guide explains ordering. ".repeat(10)}</p></div>
</main></body></html>`;
      const extracted = extractReadableText(page);
      assert.match(extracted.text, /protocol overview explains the handshake/u);
      assert.match(extracted.text, /menu guide explains ordering/u);
    },
  },
  {
    name: "web_fetch still drops a genuine sidebar and keeps prose beside a large nav",
    run() {
      const prose = "Article prose. ".repeat(30);
      const links = "Links: a b c";

      // A rule-based trim that takes a sizeable share of the prose is reported.
      const sidebar = extractReadableText(
        `<body><main><p>${prose}</p><div class="sidebar"><p>${"Sidebar links. ".repeat(30)}</p></div></main></body>`,
      );
      assert.match(sidebar.text, /Article prose/u);
      assert.doesNotMatch(sidebar.text, /Sidebar links/u);
      assert.equal(sidebar.truncated, true);

      // A script inside the dropped block is not prose, so it must not inflate the share.
      const withScript = extractReadableText(
        `<body><main><p>${prose}</p><div class="sidebar"><p>${links}</p><script>${"var x = 1; ".repeat(500)}</script></div></main></body>`,
      );
      assert.doesNotMatch(withScript.text, /Links:/u);
      assert.equal(withScript.truncated, false);

      const withoutScript = extractReadableText(
        `<body><main><p>${prose}</p><div class="sidebar"><p>${links}</p></div></main></body>`,
      );
      assert.equal(withoutScript.truncated, false);

      // A short article beside a genuine sidebar and a 20 KB script keeps the sidebar out.
      const shortPage = extractReadableText(
        `<body><main><p>${"Short prose. ".repeat(4)}</p><div class="sidebar"><p>${links}</p><script>${"var x = 1; ".repeat(2000)}</script></div></main></body>`,
      );
      assert.doesNotMatch(shortPage.text, /Links:/u);

      // A nav-heavy page must not shrink the scale enough to re-admit the sidebar.
      const navHeavy = extractReadableText(
        `<body><main><nav>${"Menu links. ".repeat(100)}</nav><div class="sidebar"><p>${"Sidebar links. ".repeat(30)}</p></div><p>${"Short prose. ".repeat(4)}</p></main></body>`,
      );
      assert.doesNotMatch(navHeavy.text, /Sidebar links/u);
      assert.equal(navHeavy.truncated, true);

      // A sibling script must not pull the sidebar back in either.
      const siblingScript = extractReadableText(
        `<body><main><p>${"Short prose. ".repeat(4)}</p><div class="sidebar"><p>${"Sidebar links. ".repeat(32)}</p></div><script>${"var x = 1; ".repeat(2000)}</script></main></body>`,
      );
      assert.doesNotMatch(siblingScript.text, /Sidebar links/u);
      assert.equal(siblingScript.truncated, true);

      const besideNav = extractReadableText(
        `<body><main><nav class="nav"><p>${"Menu links. ".repeat(60)}</p></nav><p>${prose}</p></main></body>`,
      );
      assert.match(besideNav.text, /Article prose/u);
      assert.doesNotMatch(besideNav.text, /Menu links/u);
      // A nav is a tag rule, not a class rule, so it does not mark the page as trimmed.
      assert.equal(besideNav.truncated, false);
    },
  },
  {
    name: "web_fetch reads the first part of an oversized page instead of failing",
    async run() {
      const originalFetch = globalThis.fetch;
      const oversized = `<html><head><title>Big</title></head><body><article><p>${"word ".repeat(600_000)}</p></article></body></html>`;
      assert.ok(oversized.length > 2 * 1024 * 1024, "the fixture must exceed the response cap");
      globalThis.fetch = (async () =>
        new Response(oversized, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        })) as typeof fetch;

      try {
        const result = await callWebFetch({ url: "https://1.1.1.1/big", maxChars: 500 });
        assert.equal(result.success, true);
        assert.equal(result.payload.truncated, true);
        assert.ok(String(result.payload.text).length > 0, "the first part of the page is still read");
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  },
];

await runNamedCases(cases);
