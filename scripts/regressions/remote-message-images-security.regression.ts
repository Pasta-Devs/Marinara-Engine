// Images from other websites in messages wait for a click unless the user turns on
// "Load images from other websites in messages". The browser half (placeholders,
// clicking, remembering) is covered by e2e/remote-message-images.e2e.ts.
import assert from "node:assert/strict";
import { sanitizeChatMessageCss, scopeChatMessageCss } from "../../packages/client/src/lib/chat-message-css.js";
import {
  addApprovedRemoteImageUrl,
  normalizeApprovedRemoteImageUrls,
  remoteImageHost,
  remoteImageHref,
} from "../../packages/client/src/lib/remote-images.js";

const page = "http://127.0.0.1:7860/chat";

// Only http(s) on another origin counts as another website.
assert.equal(remoteImageHref("https://cdn.example/m.png?d=1", page), "https://cdn.example/m.png?d=1");
assert.equal(remoteImageHref("//cdn.example/m.png", page), "http://cdn.example/m.png", "protocol-relative");
assert.equal(remoteImageHref("https:\\\\cdn.example\\m.png", page), "https://cdn.example/m.png", "backslashes");
assert.equal(remoteImageHref(" https://cdn.example/m.png ", page), "https://cdn.example/m.png", "padding");
assert.equal(remoteImageHref("http://localhost:7860/api/x.png", page), "http://localhost:7860/api/x.png");
assert.equal(remoteImageHref("https://127.0.0.1:7860/api/x.png", page), "https://127.0.0.1:7860/api/x.png");
for (const local of [
  "/api/gallery/file/a/b.png",
  "api/sprites/x.png",
  "http://127.0.0.1:7860/api/avatars/file/a.png",
  "data:image/png;base64,AA==",
  "blob:http://127.0.0.1:7860/2f6c2b2e-1",
  "card://characters/x/gallery/y.png",
  "",
]) {
  assert.equal(remoteImageHref(local, page), null, `${local} is not another website`);
}
assert.equal(remoteImageHost("https://cdn.example:8443/m.png"), "cdn.example:8443");

// Approvals are absolute URLs, newest first, deduplicated and capped for settings sync.
assert.deepEqual(
  normalizeApprovedRemoteImageUrls(["https://a.example/1.png", 4, "/api/x", "https://a.example/1.png", "data:x"]),
  ["https://a.example/1.png"],
);
const approvals = addApprovedRemoteImageUrl(["https://a.example/1.png"], "https://b.example/2.png");
assert.deepEqual(approvals, ["https://b.example/2.png", "https://a.example/1.png"]);
assert.equal(addApprovedRemoteImageUrl(approvals, "https://b.example/2.png"), approvals, "no change, same list");
const many = Array.from({ length: 1500 }, (_, index) => `https://cdn.example/${index}.png`);
assert.equal(normalizeApprovedRemoteImageUrls(many).length, 1000, "the list has a fixed size");
const long = Array.from({ length: 400 }, (_, index) => `https://cdn.example/${index}/${"x".repeat(1000)}.png`);
assert.ok(normalizeApprovedRemoteImageUrls(long).join("").length <= 200_000, "the list has a fixed character size");

// Message CSS: with the setting off, every source on another website is dropped.
(globalThis as { location?: { href: string } }).location = { href: page };
const remoteCss = `
  .a { background: url("https://cdn.example/a.png?d=persona"); }
  .b { background-image: url(https://cdn.example/b.png); }
  .c { background: image-set("https://cdn.example/c.png" 1x); }
  .d { background: -webkit-image-set(url(https://cdn.example/d.png) 1x); }
  .e { --e: url(https://cdn.example/e.png); background: var(--e); }
  .f { list-style-image: u\\72l(https://cdn.example/f.png); }
  .g { background: src("https://cdn.example/g.png"); }
  .h { background: url(http://127.0.0.1:7860\\2f evil); }
  .i { cursor: url('https://cdn.example/i.cur'), auto; }
  .local { background: url(data:image/png;base64,AA==); }
  .same { background: url("http://127.0.0.1:7860/api/gallery/file/a.png"); }
`;
const heldCss = sanitizeChatMessageCss(remoteCss, { remoteUrls: false });
assert.doesNotMatch(heldCss, /cdn\.example|evil/u, "no CSS source on another website survives");
assert.match(heldCss, /url\(data:image\/png;base64,AA==\)/u, "embedded images stay");
assert.match(heldCss, /url\("http:\/\/127\.0\.0\.1:7860\/api\/gallery\/file\/a\.png"\)/u, "the app's own files stay");
assert.match(heldCss, /\.i \{ cursor: none, auto; \}/u, "a dropped source leaves valid CSS");

const allowedCss = sanitizeChatMessageCss(remoteCss);
assert.match(
  allowedCss,
  /url\("https:\/\/cdn\.example\/a\.png\?d=persona"\)/u,
  "with the setting on, remote CSS loads",
);
assert.match(allowedCss, /image-set\("https:\/\/cdn\.example\/c\.png" 1x\)/u);

const heldScoped = scopeChatMessageCss(
  '@font-face { font-family: "Story"; src: url("https://cdn.example/f.woff2"); } .x { font-family: "Story"; background: url(https://cdn.example/x.png); }',
  ".message-scope",
  { remoteUrls: false },
);
assert.doesNotMatch(heldScoped, /cdn\.example/u, "message <style> blocks are held too");
assert.match(heldScoped, /\.message-scope \.x\s*\{/u);
assert.match(
  scopeChatMessageCss(".x { background: url(https://cdn.example/x.png); }", ".message-scope", { remoteUrls: true }),
  /url\(https:\/\/cdn\.example\/x\.png\)/u,
);

console.info("Remote message image regressions passed.");
