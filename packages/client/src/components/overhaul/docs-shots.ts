// ──────────────────────────────────────────────
// UI overhaul: screenshots inside the Docs guides
//
// Guides stay image-free Markdown (they also render on GitHub and the website),
// so pictures live here: each one names a guide and a heading, and the Docs page
// shows it after the first paragraph or list under that heading, the same rule
// marinaraengine.net uses. Files sit in packages/client/public/docs-shots/ and
// are taken from the new layout with scripts/docs-shots/capture.mjs. A guide
// whose heading was renamed simply loses the picture; nothing breaks.
// English guides only for now: the pictures show the English UI.
// ──────────────────────────────────────────────
import manifest from "./docs-shots.json";

export interface DocShot {
  /** File name in /docs-shots/ (without extension, always .webp). */
  name: string;
  /** Guide path, as in the docs index ("conversation/selfies.md"). */
  guide: string;
  /** Exact heading text (## or ###); empty = under the guide's title. */
  heading: string;
  alt: string;
  /** Pixel size, so the page does not jump while the picture loads. */
  width: number;
  height: number;
}

const SHOTS = (manifest as { shots: DocShot[] }).shots;

export type DocPiece = { kind: "markdown"; text: string } | { kind: "shot"; shot: DocShot };

/** Cut a prepared guide into Markdown runs with the guide's screenshots between them. */
export function splitDocAtShots(markdown: string, path: string, language: string): DocPiece[] {
  const shots = language === "en" ? SHOTS.filter((shot) => shot.guide === path) : [];
  if (!shots.length) return [{ kind: "markdown", text: markdown }];
  const lines = markdown.split("\n");
  const inserts = new Map<number, DocShot[]>();
  for (const shot of shots) {
    let at = shot.heading
      ? lines.findIndex((line) => /^#{2,6}\s/.test(line) && line.replace(/^#+\s*/, "").trim() === shot.heading)
      : lines.findIndex((line) => /^#\s/.test(line));
    if (at < 0) continue;
    // Skip the heading and blank lines, then the first block (paragraph, list or code) under it.
    at++;
    while (at < lines.length && !lines[at]!.trim()) at++;
    let fence = false;
    while (at < lines.length && (fence || lines[at]!.trim())) {
      if (lines[at]!.trimStart().startsWith("```")) fence = !fence;
      at++;
    }
    inserts.set(at, [...(inserts.get(at) ?? []), shot]);
  }
  const pieces: DocPiece[] = [];
  let start = 0;
  for (const at of [...inserts.keys()].sort((a, b) => a - b)) {
    pieces.push({ kind: "markdown", text: lines.slice(start, at).join("\n") });
    for (const shot of inserts.get(at)!) pieces.push({ kind: "shot", shot });
    start = at;
  }
  pieces.push({ kind: "markdown", text: lines.slice(start).join("\n") });
  return pieces.filter((piece) => piece.kind === "shot" || piece.text.trim());
}
