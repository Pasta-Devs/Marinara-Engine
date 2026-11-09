// ──────────────────────────────────────────────
// SVG pictures in themes (theme security audit, 2026-11-09)
//
// A theme's SVG pictures become same-origin blob: URLs. Shown as a CSS background an SVG never runs
// script, but opened as a page ("Open image in new tab") it would run as Marinara and could read
// its storage and call its API. So every SVG is rebuilt from an allowlist before it gets a URL: SVG
// drawing elements only (no <script>, <foreignObject>, <a>, <iframe>), no event attributes, links
// only to its own #parts or to embedded raster pictures, no processing instructions or DOCTYPE, and
// its CSS cleaned like a theme's (no outside URLs). The text it draws is returned too, so the
// text-safety rules can read it.
// ──────────────────────────────────────────────
import { stripDangerousCss } from "./card-css";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

const ALLOWED_ELEMENTS = new Set(
  [
    "svg",
    "g",
    "defs",
    "symbol",
    "use",
    "title",
    "desc",
    "metadata",
    "path",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "text",
    "tspan",
    "textPath",
    "image",
    "clipPath",
    "mask",
    "pattern",
    "marker",
    "linearGradient",
    "radialGradient",
    "stop",
    "filter",
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feDistantLight",
    "feDropShadow",
    "feFlood",
    "feFuncA",
    "feFuncB",
    "feFuncG",
    "feFuncR",
    "feGaussianBlur",
    "feImage",
    "feMerge",
    "feMergeNode",
    "feMorphology",
    "feOffset",
    "fePointLight",
    "feSpecularLighting",
    "feSpotLight",
    "feTile",
    "feTurbulence",
    "animate",
    "animateMotion",
    "animateTransform",
    "mpath",
    "set",
    "style",
    "switch",
    "view",
  ].map((name) => name.toLowerCase()),
);

/** Embedded raster pictures only: an SVG may not link anywhere, nor embed another SVG. */
const SAFE_HREF = /^(#[\w.:-]+|data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+)$/i;
/** url(#id) references only; any other url() in an attribute is dropped. */
const UNSAFE_URL = /url\s*\(\s*(?!['"]?#)/i;

export interface SanitizedSvg {
  svg: string;
  /** The text the picture draws (text, tspan, textPath) and its title/desc. */
  text: string;
}

const cache = new Map<string, SanitizedSvg | null>();

/** The SVG rebuilt from the allowlist, or null when it doesn't parse as one SVG picture. */
export function sanitizeSvg(source: string): SanitizedSvg | null {
  const known = cache.get(source);
  if (known !== undefined) return known;
  const result = sanitizeNow(source);
  if (cache.size > 256) cache.clear();
  cache.set(source, result);
  return result;
}

function sanitizeNow(source: string): SanitizedSvg | null {
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") return null;
  // External entities are never loaded by browsers; internal ones are refused outright.
  if (/<!ENTITY/i.test(source)) return null;
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(source, "image/svg+xml");
  } catch {
    return null;
  }
  const root = doc.documentElement;
  if (
    !root ||
    root.namespaceURI !== SVG_NS ||
    root.localName !== "svg" ||
    doc.getElementsByTagName("parsererror").length
  )
    return null;
  const texts: string[] = [];
  // Doctype, processing instructions (<?xml-stylesheet?>) and comments go.
  for (const node of Array.from(doc.childNodes)) if (node !== root) doc.removeChild(node);
  const clean = (element: Element) => {
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === 1) {
        const el = child as Element;
        if (el.namespaceURI !== SVG_NS || !ALLOWED_ELEMENTS.has(el.localName.toLowerCase())) {
          el.remove();
          continue;
        }
        // An <animate>/<set> that would change a link, an event or a style is dropped whole.
        if (!cleanAttributes(el)) continue;
        if (el.localName === "style") {
          el.textContent = stripDangerousCss(el.textContent ?? "");
          continue;
        }
        clean(el);
      } else if (child.nodeType === 3 || child.nodeType === 4) {
        // Text (and CDATA) is kept as text.
        if (child.nodeType === 4) element.replaceChild(doc.createTextNode(child.nodeValue ?? ""), child);
      } else {
        element.removeChild(child);
      }
    }
  };
  cleanAttributes(root);
  clean(root);
  for (const el of Array.from(root.querySelectorAll("text, tspan, textPath, title, desc"))) {
    // Only the element's own text nodes, so a <text> with <tspan>s isn't counted twice.
    const own = Array.from(el.childNodes)
      .filter((node) => node.nodeType === 3)
      .map((node) => node.nodeValue ?? "")
      .join("")
      .trim();
    if (own) texts.push(own);
  }
  for (const el of Array.from(root.querySelectorAll("[aria-label]"))) texts.push(el.getAttribute("aria-label") ?? "");
  let svg: string;
  try {
    svg = new XMLSerializer().serializeToString(root);
  } catch {
    return null;
  }
  return { svg, text: texts.join(" ").replace(/\s+/g, " ").trim() };
}

/** Cleans an element's attributes; false when the element itself was removed. */
function cleanAttributes(el: Element): boolean {
  const animated = /^(animate|set|animatetransform|animatemotion)$/i.test(el.localName);
  if (animated) {
    const target = el.getAttribute("attributeName") ?? "";
    if (/^(href|xlink:href|on\w*|style|class|id)$/i.test(target)) {
      el.remove();
      return false;
    }
  }
  for (const attribute of Array.from(el.attributes)) {
    const name = attribute.name;
    const local = attribute.localName.toLowerCase();
    const value = attribute.value;
    const remove = () => el.removeAttributeNode(attribute);
    if (local.startsWith("on")) remove();
    else if (local === "href" || attribute.namespaceURI === XLINK_NS) {
      if (local !== "href" || !SAFE_HREF.test(value.trim())) remove();
    } else if (local === "style") el.setAttribute(name, stripDangerousCss(value));
    else if (/javascript\s*:|vbscript\s*:|data\s*:\s*text/i.test(value) || UNSAFE_URL.test(value)) remove();
    else if (
      animated &&
      /^(values|from|to|by)$/i.test(local) &&
      /[:(]/.test(value) &&
      !/^[-\d.\s,;a-z%#()]+$/i.test(value)
    )
      remove();
    else if (attribute.namespaceURI && attribute.namespaceURI !== XLINK_NS && !/xmlns/.test(attribute.namespaceURI))
      // Attributes in other namespaces (xml:base, ev:event…) aren't needed for drawing.
      if (attribute.namespaceURI !== "http://www.w3.org/XML/1998/namespace" || local !== "space") remove();
  }
  return true;
}
