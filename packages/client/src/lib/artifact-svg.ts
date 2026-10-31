// The drawing subset of SVG an [html] artifact may use. Nothing here can load a file, run code or reach outside the
// artifact: use, image, foreignObject, filters and animation stay out, and messages keep their full SVG ban.
export const ARTIFACT_SVG_TAGS = [
  "circle",
  "clipPath",
  "defs",
  "ellipse",
  "g",
  "line",
  "linearGradient",
  "path",
  "polygon",
  "polyline",
  "radialGradient",
  "rect",
  "stop",
  "svg",
  "text",
  "tspan",
] as const;

export const ARTIFACT_SVG_ATTR = [
  "clip-path",
  "clip-rule",
  "clipPathUnits",
  "cx",
  "cy",
  "d",
  "dominant-baseline",
  "dx",
  "dy",
  "fill",
  "fill-opacity",
  "fill-rule",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "fx",
  "fy",
  "gradientTransform",
  "gradientUnits",
  "height",
  "letter-spacing",
  "offset",
  "opacity",
  "points",
  "preserveAspectRatio",
  "r",
  "rx",
  "ry",
  "spreadMethod",
  "stop-color",
  "stop-opacity",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-opacity",
  "stroke-width",
  "text-anchor",
  "transform",
  "viewBox",
  "width",
  "x",
  "x1",
  "x2",
  "y",
  "y1",
  "y2",
] as const;

const LOCAL_PAINT_REFERENCE = /^\s*url\(\s*(["']?)#([\w:.-]+)\1\s*\)\s*$/iu;

/**
 * One SVG attribute's safe value, or null to remove it. Ids get the artifact's prefix, so two artifacts both using
 * id="table" keep their own gradients. References may only point at an id inside the artifact: a url() to anywhere
 * else could load a file, and a CSS escape could spell url() past this check, so both are dropped. The style attribute
 * is left for the chat CSS sanitizer.
 */
export function scopeArtifactSvgAttribute(name: string, value: string, idPrefix: string): string | null {
  const attribute = name.toLowerCase();
  if (attribute === "style") return value;
  if (attribute === "id") return `${idPrefix}${value}`;
  if (attribute === "href") return value.startsWith("#") ? `#${idPrefix}${value.slice(1)}` : null;
  if (!/url\(|\\/iu.test(value)) return value;
  const reference = LOCAL_PAINT_REFERENCE.exec(value);
  return reference ? `url(#${idPrefix}${reference[2]})` : null;
}
