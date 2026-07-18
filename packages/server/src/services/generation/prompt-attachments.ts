export type PromptAttachment = {
  type?: string | null;
  url?: string | null;
  data?: string | null;
  filename?: string | null;
  name?: string | null;
  prompt?: string | null;
  galleryId?: string | null;
  imageCaption?: string | null;
  imageCaptionConnectionId?: string | null;
  imageCaptionModel?: string | null;
  imageCaptionProvider?: string | null;
  imageCaptionedAt?: string | null;
};

const IMAGE_ATTACHMENT_PROVIDER_BYTE_LIMIT = 6 * 1024 * 1024;
const FILE_ATTACHMENT_PROVIDER_BYTE_LIMIT = 20 * 1024 * 1024;
const READABLE_ATTACHMENT_PROMPT_BYTE_LIMIT = 20 * 1024 * 1024;
const TEXT_ATTACHMENT_EXTENSIONS = new Set([
  "csv",
  "json",
  "jsonl",
  "log",
  "markdown",
  "md",
  "txt",
  "xml",
  "yaml",
  "yml",
]);

/** Parse a JSON extra field safely. */
export function parseExtra(extra: unknown): Record<string, unknown> {
  if (!extra) return {};
  try {
    const parsed: unknown = typeof extra === "string" ? JSON.parse(extra) : extra;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function getAttachmentFilename(attachment: PromptAttachment): string {
  const rawName = attachment.filename ?? attachment.name;
  return typeof rawName === "string" && rawName.trim() ? rawName.trim() : "attachment";
}

export function extractImageAttachmentDataUrls(attachments: PromptAttachment[] | undefined): string[] {
  return (attachments ?? [])
    .filter((attachment) => typeof attachment.type === "string" && attachment.type.startsWith("image/"))
    .map((attachment) => attachment.data)
    .filter((data): data is string => typeof data === "string" && data.length > 0)
    .filter((data) => estimateDataUrlBytes(data) <= IMAGE_ATTACHMENT_PROVIDER_BYTE_LIMIT);
}

export function extractFileAttachmentInputs(
  attachments: PromptAttachment[] | undefined,
): Array<{ type: string; data: string; filename: string }> {
  return (attachments ?? []).flatMap((attachment) => {
    const type = normalizeProviderFileAttachmentType(attachment);
    if (!type || typeof attachment.data !== "string") return [];
    if (estimateDataUrlBytes(attachment.data) > READABLE_ATTACHMENT_PROMPT_BYTE_LIMIT) return [];
    const data = normalizeDataUrlMimeType(attachment.data, type);
    if (!data) return [];
    return [{ type, data, filename: getAttachmentFilename(attachment) }];
  });
}

function normalizeProviderFileAttachmentType(attachment: PromptAttachment): string | null {
  const type = typeof attachment.type === "string" ? attachment.type.toLowerCase().trim() : "";
  const filename = getAttachmentFilename(attachment).toLowerCase();
  if (type === "application/pdf" || filename.endsWith(".pdf")) return "application/pdf";
  return null;
}

function normalizeDataUrlMimeType(dataUrl: string, mimeType: string): string | null {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex < 0) return null;
  const meta = dataUrl.slice(5, commaIndex).toLowerCase();
  if (!meta.includes(";base64")) return null;
  return `data:${mimeType};base64,${dataUrl.slice(commaIndex + 1)}`;
}

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex < 0) return Buffer.byteLength(dataUrl, "utf8");

  const meta = dataUrl.slice(0, commaIndex).toLowerCase();
  const payload = dataUrl.slice(commaIndex + 1);
  if (!meta.includes(";base64")) {
    let bytes = 0;
    let segmentStart = 0;
    for (const match of payload.matchAll(/%[0-9a-f]{2}/gi)) {
      bytes += Buffer.byteLength(payload.slice(segmentStart, match.index), "utf8") + 1;
      segmentStart = match.index + match[0].length;
    }
    return bytes + Buffer.byteLength(payload.slice(segmentStart), "utf8");
  }

  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

function isReadableTextAttachment(attachment: PromptAttachment): boolean {
  const type = typeof attachment.type === "string" ? attachment.type.toLowerCase() : "";
  if (type.startsWith("text/")) return true;
  if (
    type === "application/json" ||
    type === "application/ld+json" ||
    type === "application/xml" ||
    type === "application/x-yaml" ||
    type === "application/yaml"
  ) {
    return true;
  }

  const name = getAttachmentFilename(attachment).toLowerCase();
  const extension = name.includes(".") ? name.split(".").pop() : "";
  return !!extension && TEXT_ATTACHMENT_EXTENSIONS.has(extension);
}

function decodeDataUrlText(dataUrl: string): string | null {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex < 0) return null;

  const meta = dataUrl.slice(0, commaIndex).toLowerCase();
  const payload = dataUrl.slice(commaIndex + 1);
  try {
    if (meta.includes(";base64")) {
      return Buffer.from(payload, "base64").toString("utf8");
    }
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}

export function escapeXmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildReadableAttachmentBlocks(attachments: PromptAttachment[] | undefined): string[] {
  return (attachments ?? []).flatMap((attachment) => {
    if (!isReadableTextAttachment(attachment) || typeof attachment.data !== "string") return [];
    if (estimateDataUrlBytes(attachment.data) > FILE_ATTACHMENT_PROVIDER_BYTE_LIMIT) return [];
    const decoded = decodeDataUrlText(attachment.data);
    if (!decoded?.trim()) return [];

    const filename = getAttachmentFilename(attachment);
    const type = typeof attachment.type === "string" && attachment.type.trim() ? attachment.type.trim() : "text/plain";

    return [
      [
        `<attached_file name="${escapeXmlAttribute(filename)}" type="${escapeXmlAttribute(type)}">`,
        decoded,
        `</attached_file>`,
      ].join("\n"),
    ];
  });
}

export function appendReadableAttachmentsToContent(
  content: string,
  attachments: PromptAttachment[] | undefined,
): string {
  const blocks = buildReadableAttachmentBlocks(attachments);
  if (blocks.length === 0) return content;
  return `${content}${content.trim() ? "\n\n" : ""}${blocks.join("\n\n")}`;
}
