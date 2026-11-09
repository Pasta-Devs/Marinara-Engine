/** Splits text into VN paragraphs delimited by blank lines; fenced code stays together. */
export function splitRoleplayParagraphs(content: string, streaming = false): string[] {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  let fence = "";
  let paragraph: string[] = [];
  const paragraphs: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = "";
    }
    // The last split item has no terminating newline while a stream is open.
    if (!fence && !line.trim() && (!streaming || index < lines.length - 1)) {
      const completed = paragraph.join("\n").trim();
      if (completed) paragraphs.push(completed);
      paragraph = [];
    } else {
      paragraph.push(line);
    }
  }

  if (!streaming) {
    const tail = paragraph.join("\n").trim();
    if (tail) paragraphs.push(tail);
  }

  return mergeSceneBreaks(paragraphs, streaming);
}

const SCENE_BREAK_RE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;

/**
 * A paragraph that is only a scene break (---, ***, ___) opens the next page instead of being a
 * page of its own; at the end it closes the last one. While a reply streams in, a trailing break
 * waits for the paragraph it belongs to.
 */
function mergeSceneBreaks(paragraphs: string[], streaming: boolean): string[] {
  const merged: string[] = [];
  let pending = "";
  for (const paragraph of paragraphs) {
    if (SCENE_BREAK_RE.test(paragraph)) {
      pending = pending ? `${pending}\n\n${paragraph}` : paragraph;
      continue;
    }
    merged.push(pending ? `${pending}\n${paragraph}` : paragraph);
    pending = "";
  }
  if (pending && !streaming) {
    if (merged.length > 0) merged[merged.length - 1] = `${merged[merged.length - 1]}\n\n${pending}`;
    else merged.push(pending);
  }
  return merged;
}

/** A blank line completes a VN paragraph; fenced code stays together. */
export function latestRoleplayParagraph(content: string, streaming = false): string {
  const paragraphs = splitRoleplayParagraphs(content, streaming);
  return paragraphs[paragraphs.length - 1] ?? "";
}
