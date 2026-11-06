// Match Markdown code before interpreting HTML. The HTML-tag alternative skips
// backticks inside quoted attributes, while escaped backticks remain authored text.
const CODE_OR_TAG_RE =
  /^([\t ]*)```([^`\r\n]*)\r?\n([\s\S]*?)(?:^([\t ]*`{3,}[\t ]*\r?)(?=\n|$)|(?![\s\S]))|\\[\\`]|`([^`\r\n]+)`|<\/?[A-Za-z][\w:-]*(?:\s+[^\s"'<>/=`]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>/gm;

const escapeCode = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Keep code literal through quote formatting, HTML detection and sanitization. */
export function protectMarkdownCode(source: string) {
  // Private-use characters survive HTML parsing. Choose a delimiter absent from
  // the source so authored text cannot impersonate one of these temporary slots.
  let marker = `\uE000${crypto.getRandomValues(new Uint32Array(4)).join("x")}\uE001`;
  while (source.includes(marker)) marker += "\uE000";
  const regions: Array<{ source: string; html: string }> = [];
  const text = source.replace(
    CODE_OR_TAG_RE,
    (
      raw,
      indent: string | undefined,
      language: string | undefined,
      body: string | undefined,
      close: string | undefined,
      inline: string | undefined,
    ) => {
      if (inline === undefined && body === undefined) return raw;
      let html: string;
      if (inline !== undefined) {
        html = `<code class="mari-md-inline-code">${escapeCode(inline)}</code>`;
      } else {
        const content = (close ? body!.replace(/\r?\n$/, "") : body!)
          .split(/\r?\n/)
          .map((line) => {
            let stripped = 0;
            while (stripped < indent!.length && line[stripped] === " ") stripped++;
            return line.slice(stripped);
          })
          .join("\n");
        const lang = language!.trim();
        const label = lang ? `<span class="mari-md-codeblock-lang">${escapeCode(lang)}</span>` : "";
        html = `<pre class="mari-md-codeblock">${label}<code>${escapeCode(content)}</code></pre>`;
      }
      const index = regions.push({ source: raw, html }) - 1;
      return `${marker}${index}${marker}`;
    },
  );
  const restore = (value: string, kind: "source" | "html") =>
    value.replace(new RegExp(`${marker}(\\d+)${marker}`, "g"), (_slot, index: string) => regions[Number(index)]![kind]);
  return {
    text,
    restoreSource: (value: string) => restore(value, "source"),
    restoreHtml: (value: string) => restore(value, "html"),
  };
}
