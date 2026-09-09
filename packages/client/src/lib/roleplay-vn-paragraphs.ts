/** A blank line completes a VN paragraph; fenced code stays together. */
export function latestRoleplayParagraph(content: string, streaming = false): string {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  let fence = "";
  let paragraph: string[] = [];
  let latest = "";
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
      if (completed) latest = completed;
      paragraph = [];
    } else {
      paragraph.push(line);
    }
  }
  return (!streaming && paragraph.join("\n").trim()) || latest;
}
