import DOMPurify from "dompurify";
import { ARTIFACT_SVG_ATTR, ARTIFACT_SVG_TAGS, scopeArtifactSvgAttribute } from "./artifact-svg";
import { protectMarkdownCode } from "./markdown-code";
import { sanitizeChatMessageCss } from "./chat-message-css";
import { currentRemoteImagePolicy, holdRemoteImages } from "./remote-image-policy";
import type { RemoteImagePolicy } from "./remote-images";

const HTML_TAG_NAME_SOURCE =
  "div|span|style|table|p|br|img|a|ul|ol|li|h[1-6]|em|strong|b|i|pre|code|section|article|header|footer|nav|button|input|form|label|select|option|textarea|canvas|svg|video|audio|source|iframe|hr|blockquote|details|summary|figure|figcaption|main|aside|mark|small|sub|sup|del|ins|abbr|time|progress|meter|output|dialog|template|slot|ruby|rt|rp|bdi|bdo|wbr|area|map|track|embed|object|param|picture|portal|datalist|fieldset|legend|optgroup|caption|col|colgroup|thead|tbody|tfoot|th|td|dl|dt|dd|kbd|samp|var|cite|dfn|q|s|u|font|center";

/** Check whether text contains meaningful HTML tags. */
export const HTML_TAG_RE = new RegExp(`<(?:${HTML_TAG_NAME_SOURCE})\\b[^>]*>`, "i");
const ENCODED_HTML_TAG_RE = new RegExp(
  `&(?:lt|#0*60|#x0*3c);(\\/?\\s*(?:${HTML_TAG_NAME_SOURCE})\\b[^<>]*?)&(?:gt|#0*62|#x0*3e);`,
  "gi",
);

function decodeHtmlTagAttributeEntities(value: string): string {
  return value.replace(/&quot;|&#0*34;|&#x0*22;/gi, '"').replace(/&apos;|&#0*39;|&#x0*27;/gi, "'");
}

export function decodeEncodedChatHtmlTags(value: string): string {
  return value.replace(
    ENCODED_HTML_TAG_RE,
    (_match, tagBody: string) => `<${decodeHtmlTagAttributeEntities(tagBody)}>`,
  );
}

export function containsChatHtml(value: string): boolean {
  return HTML_TAG_RE.test(decodeEncodedChatHtmlTags(protectMarkdownCode(value).text));
}

const CHAT_HTML_ALLOWED_TAGS = [
  "a",
  "abbr",
  "aside",
  "b",
  "bdi",
  "bdo",
  "blockquote",
  "br",
  "caption",
  "center",
  "cite",
  "code",
  "col",
  "colgroup",
  "dd",
  "del",
  "details",
  "dfn",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "font",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "i",
  "img",
  "ins",
  "kbd",
  "li",
  "main",
  "mark",
  "nav",
  "ol",
  "p",
  "pre",
  "q",
  "s",
  "samp",
  "section",
  "small",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "u",
  "ul",
  "var",
] as const;

const CHAT_HTML_ALLOWED_ATTR = [
  "alt",
  "class",
  "color",
  "colspan",
  "data-spk",
  "decoding",
  "href",
  "id",
  "loading",
  "rel",
  "rowspan",
  "src",
  "style",
  "target",
  "title",
] as const;

export type SanitizeChatHtmlOptions = {
  allowStyle?: boolean;
  allowLinks?: boolean;
  /**
   * Images and CSS sources on other websites. Defaults to the user's current setting and approvals.
   * "keep" leaves them for a later pass over the same HTML; only use it when the result is
   * sanitized again before display.
   */
  remoteImages?: RemoteImagePolicy | "keep";
  /** Keep the drawing subset of SVG, with its ids under this prefix. Only for [html] artifacts; messages never set it. */
  artifactSvgIdPrefix?: string;
};

export function sanitizeChatHtml(html: string, options: SanitizeChatHtmlOptions = {}): string {
  const remoteImages = options.remoteImages === "keep" ? null : (options.remoteImages ?? currentRemoteImagePolicy());
  const allowedAttr = CHAT_HTML_ALLOWED_ATTR.filter(
    (attr) =>
      (options.allowStyle || attr !== "style") &&
      (options.allowLinks !== false || (attr !== "href" && attr !== "target")),
  );
  const svgIdPrefix = options.artifactSvgIdPrefix;
  const allowSvg = svgIdPrefix !== undefined;
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...CHAT_HTML_ALLOWED_TAGS, ...(allowSvg ? ARTIFACT_SVG_TAGS : [])],
    ALLOWED_ATTR: [...allowedAttr, ...(allowSvg ? ARTIFACT_SVG_ATTR : [])],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    FORBID_TAGS: ["animate", "embed", "foreignObject", "iframe", "math", "object", "script", "style"].concat(
      allowSvg ? [] : ["svg"],
    ),
    FORBID_ATTR: ["onerror", "onload", "onclick", "srcdoc"],
    RETURN_DOM_FRAGMENT: true,
  }) as DocumentFragment;
  for (const anchor of clean.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    anchor.setAttribute("rel", "noopener noreferrer");
  }
  if (allowSvg) {
    for (const anchor of clean.querySelectorAll("svg a")) anchor.replaceWith(...anchor.childNodes);
    for (const element of clean.querySelectorAll("svg, svg *")) {
      for (const { name, value } of [...element.attributes]) {
        const scoped = scopeArtifactSvgAttribute(name, value, svgIdPrefix);
        if (scoped === null) element.removeAttribute(name);
        else if (scoped !== value) element.setAttribute(name, scoped);
      }
    }
  }
  if (options.allowStyle) {
    for (const element of clean.querySelectorAll<HTMLElement>("[style]")) {
      const style = sanitizeChatMessageCss(element.getAttribute("style") ?? "", {
        remoteUrls: remoteImages?.loadAll !== false,
      });
      if (style) element.setAttribute("style", style);
      else element.removeAttribute("style");
    }
    for (const media of clean.querySelectorAll("img, audio, video")) {
      media.setAttribute("referrerpolicy", "no-referrer");
    }
  }
  if (remoteImages) holdRemoteImages(clean, remoteImages);
  const container = clean.ownerDocument.createElement("div");
  container.append(clean);
  return container.innerHTML;
}

export function extractChatStyleBlocks(html: string): { html: string; css: string } {
  const stylesOnly = DOMPurify.sanitize(`<div>${html}</div>`, {
    ALLOWED_TAGS: ["div", "style"],
    ALLOWED_ATTR: [],
    FORBID_CONTENTS: [],
    RETURN_DOM_FRAGMENT: true,
  }) as DocumentFragment;
  const cssBlocks = [...stylesOnly.querySelectorAll("style")].map((style) => style.textContent ?? "");
  return {
    // The normal sanitizer removes the original style elements after their
    // sanitized, browser-parsed contents have been collected above.
    html,
    css: cssBlocks.join("\n"),
  };
}
