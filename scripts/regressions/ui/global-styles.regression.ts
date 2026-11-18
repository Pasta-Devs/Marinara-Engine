// Rules in the app's global stylesheet: mobile Roleplay editing and Echo, paused effects, Recent Chats and gallery
// layout, the pulse animation, reduced ambient effects and Markdown message containers.
// regression-layout: source-path these are stylesheet rules, so the stylesheet's text is what is checked.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const globalStylesSource = readFileSync(
  new URL("../../../packages/client/src/styles/globals.css", import.meta.url),
  "utf8",
);
assert.match(
  globalStylesSource,
  /@media \(max-width: 767px\)[\s\S]*\[data-component="ChatArea\.Roleplay"\]:has\(\.mari-roleplay-message-body--editing\)\s+\[data-roleplay-agent-window\]:not\(\[data-roleplay-agent-window="echo"\]\) \{\s*display: none;/u,
  "Mobile Roleplay editing must temporarily remove agent windows from the constrained viewport",
);
assert.match(
  globalStylesSource,
  /@media \(max-width: 767px\)[\s\S]*\[data-component="ChatArea\.Roleplay"\]\[data-mobile-composer-active="true"\] \[data-roleplay-agent-window="echo"\],\s*\[data-component="ChatArea\.Roleplay"\]:has\(\.mari-roleplay-message-body--editing\) \[data-roleplay-agent-window="echo"\] \{\s*visibility: hidden;/u,
  "Mobile Echo must keep its scroll box while hidden, or reactions revealed during typing leave it pinned to a stale offset",
);
// Slice 85: the navigator is gone; the Home widget's blink is the Mari frame that pauses with the page.
assert.match(
  globalStylesSource,
  /data-marinara-effects-paused="true"\] \.mari-home-professor-blink,[^}]+animation-play-state: paused !important;/u,
);
const globalStyles = readFileSync(new URL("../../../packages/client/src/styles/globals.css", import.meta.url), "utf8");
assert.match(globalStyles, /@container \(min-width: 36rem\)[\s\S]*data-component="RecentChats"/u);
assert.match(
  globalStyles,
  /\.mari-gallery-card \{\s*content-visibility: auto;\s*contain-intrinsic-size: auto 12rem;\s*\}/u,
);
assert.match(
  globalStyles,
  /\[data-marinara-accent-animation\] :where\(\.mari-editor-shell, select\) \{[\s\S]*--primary: var\(--marinara-app-accent-static\);[\s\S]*--marinara-chat-chrome-accent: var\(--marinara-app-accent-static\);[\s\S]*\}/u,
);
assert.match(globalStyles, /\[data-marinara-accent-animation\] select \{\s*transition: none;\s*\}/u);
const markdownBlockquoteStyles =
  globalStyles.match(/\.mari-message-content \.mari-md-blockquote \{[\s\S]*?\}/u)?.[0] ?? "";
assert.match(markdownBlockquoteStyles, /color:\s*inherit;/u);
assert.doesNotMatch(markdownBlockquoteStyles, /color:\s*var\(--muted-foreground\);/u);
const markdownMessageContainerStyles =
  globalStyles.match(/\.mari-message-body,\s*\.mari-message-bubble \{[\s\S]*?\}/u)?.[0] ?? "";
assert.match(markdownMessageContainerStyles, /min-width:\s*0;/u);
assert.match(markdownMessageContainerStyles, /max-width:\s*100%;/u);
// The workspace transcript adds its own earlier `.mari-message-content` rule (padding only); check every rule.
const markdownMessageStyles = [...globalStyles.matchAll(/^\.mari-message-content \{[\s\S]*?\}/gmu)]
  .map((match) => match[0])
  .join("\n");
const markdownCodeBlockStyles =
  globalStyles.match(/^\.mari-message-content \.mari-md-codeblock \{[^{}]*\}/mu)?.[0] ?? "";
const markdownCodeChildStyles =
  globalStyles.match(/^\.mari-message-content \.mari-md-codeblock code \{[^{}]*\}/mu)?.[0] ?? "";
assert.match(markdownMessageStyles, /min-width:\s*0;/u);
assert.match(markdownMessageStyles, /max-width:\s*100%;/u);
assert.match(markdownMessageStyles, /overflow-wrap:\s*anywhere;/u);
assert.match(markdownCodeBlockStyles, /box-sizing:\s*border-box;/u);
assert.match(markdownCodeBlockStyles, /width:\s*100%;/u);
assert.match(markdownCodeBlockStyles, /max-width:\s*100%;/u);
assert.match(markdownCodeBlockStyles, /overflow-x:\s*hidden;/u);
assert.match(markdownCodeBlockStyles, /overflow-wrap:\s*anywhere;/u);
assert.match(markdownCodeBlockStyles, /white-space:\s*pre-wrap;/u);
assert.match(markdownCodeChildStyles, /white-space:\s*inherit;/u);
for (const media of globalStyles.matchAll(/^@media \(max-width: 767px\) \{[\s\S]*?^\}/gmu)) {
  assert.doesNotMatch(media[0], /\.mari-message-content \.mari-md-codeblock\b/u);
}
assert.match(
  globalStylesSource,
  /html\[data-marinara-reduced-effects="true"\] \[class\*="backdrop-blur"\],[\s\S]{0,300}backdrop-filter: none !important;/u,
  "Reduced ambient effects must flatten shared backdrop blur at every viewport size",
);
assert.doesNotMatch(
  globalStylesSource,
  /@media \(max-width: 767px\) \{[\s\S]{0,300}data-marinara-reduced-effects="true"[^\n]*backdrop-blur/u,
  "Desktop users must receive the same reduced-effects backdrop flattening as mobile users",
);
