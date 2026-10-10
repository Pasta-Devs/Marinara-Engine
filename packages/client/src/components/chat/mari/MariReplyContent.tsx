// The body of one of Mari's replies: streamed words, linked names, compact markdown, files and reasoning.
import { type CSSProperties, type ReactNode, Children, isValidElement, memo, useMemo, useState } from "react";
import { ChevronRight, FileText, Loader2, Sparkles, X } from "lucide-react";
import { type MariWorkspaceActionResult } from "@marinara-engine/shared";
import { type CharacterPreviewModel } from "../../../lib/character-preview";
import { type LorebookPreviewModel } from "../../../lib/lorebook-preview";

import { renderCompactInline, renderMarkdownBlocks } from "../../../lib/markdown";
import { useCodeBlockCopy } from "../../../hooks/use-code-block-copy";
import { cn } from "../../../lib/utils";
import {
  collectMariReferencedResources,
  escapeRegExp,
  findMariSettingReferences,
  mariReferenceTarget,
  selectMariReplyLinks,
  type MariReferencedResource,
} from "../../../lib/mari-referenced-resources";
import { getOmnibarSettingsDestinations } from "../../../lib/omnibar-settings";
import { ResultTypeIcon } from "../../command-center/ResultTypeIcon";
import { resourceResultType, type ResultType } from "../../../lib/command-icons";
import { useTranslation as useUiTranslation } from "react-i18next";
import { ProfessorMariAttachment, isProfessorMariImageAttachment } from "./mari-chat-helpers";
import { WorkspaceToolCall } from "./mari-tool-presentation";

/** While Mari streams, each new word mounts in its own span and blurs in; words already shown keep their key. */
function renderStreamingInline(text: string, keyPrefix: string): ReactNode[] {
  return renderCompactInline(text, keyPrefix).map((node, nodeIndex) =>
    typeof node === "string"
      ? node.split(/(\s+)/).map((word, wordIndex) =>
          /\S/.test(word) ? (
            <span key={`${keyPrefix}-${nodeIndex}-${wordIndex}`} className="mari-stream-word">
              {word}
            </span>
          ) : (
            word
          ),
        )
      : node,
  );
}

/** Slice 72: a name in her answer that opens its record (it replaces the reference cards under the answer). */
type MariReplyLink = {
  resource: MariReferencedResource;
  term: string;
  face: { type: ResultType; src?: string | null; avatarCropStyle?: CSSProperties };
};

/** The names her answer uses for records she read, changed or named (a bold setting), as links. */
export function buildMariReplyLinks(
  content: string,
  tools: readonly WorkspaceToolCall[],
  actionResults: readonly MariWorkspaceActionResult[],
  characterPreviews: ReadonlyMap<string, CharacterPreviewModel>,
  lorebookPreviews: ReadonlyMap<string, LorebookPreviewModel>,
): MariReplyLink[] {
  const settings = getOmnibarSettingsDestinations();
  const resources = [
    ...actionResults.flatMap((result): MariReferencedResource[] =>
      result.resource.kind === "preset"
        ? []
        : [
            {
              kind: result.resource.kind,
              id: result.resource.id,
              name: result.resource.label ?? null,
              fromList: false,
            },
          ],
    ),
    ...collectMariReferencedResources(tools),
    ...findMariSettingReferences(content, settings),
  ]
    .map((resource) => ({
      ...resource,
      name:
        (resource.kind === "character"
          ? characterPreviews.get(resource.id)?.name
          : resource.kind === "lorebook"
            ? lorebookPreviews.get(resource.id)?.name
            : null) ?? resource.name,
    }))
    .filter((resource) => mariReferenceTarget(resource, settings));
  return selectMariReplyLinks(resources, content).map(({ resource, term }) => {
    const character = resource.kind === "character" ? characterPreviews.get(resource.id) : undefined;
    const lorebook = resource.kind === "lorebook" ? lorebookPreviews.get(resource.id) : undefined;
    return {
      resource,
      term,
      face: {
        type: resourceResultType(resource.kind),
        src: character?.avatarSrc ?? lorebook?.imageSrc,
        avatarCropStyle: character?.avatarCropStyle,
      },
    };
  });
}

/** The first mention of each linked name (a bold one or a whole word) becomes its link; the rest stay text. */
function linkReplyNodes(
  nodes: ReactNode[],
  links: readonly MariReplyLink[],
  used: Set<MariReplyLink>,
  renderLink: (link: MariReplyLink, content: ReactNode, key: string) => ReactNode,
  keyPrefix: string,
): ReactNode[] {
  return nodes.flatMap((node, index): ReactNode[] => {
    const open = links.filter((link) => !used.has(link));
    if (open.length === 0) return [node];
    const same = (link: MariReplyLink, text: string) => link.term.toLocaleLowerCase() === text.toLocaleLowerCase();
    if (typeof node === "string") {
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}])(?:${open.map((link) => escapeRegExp(link.term)).join("|")})(?![\\p{L}\\p{N}])`,
        "giu",
      );
      const out: ReactNode[] = [];
      let last = 0;
      for (const match of node.matchAll(pattern)) {
        const link = links.find((candidate) => !used.has(candidate) && same(candidate, match[0]));
        if (!link) continue;
        used.add(link);
        out.push(node.slice(last, match.index), renderLink(link, match[0], `${keyPrefix}-${index}-${match.index}`));
        last = match.index + match[0].length;
      }
      out.push(node.slice(last));
      return out;
    }
    if (isValidElement<{ children?: ReactNode }>(node) && node.type === "strong") {
      const parts = Children.toArray(node.props.children);
      const text = parts.every((part) => typeof part === "string") ? parts.join("").trim() : "";
      const link = text ? open.find((candidate) => same(candidate, text)) : undefined;
      if (link) {
        used.add(link);
        return [renderLink(link, node, `${keyPrefix}-${index}`)];
      }
    }
    return [node];
  });
}

function MariReplyLinkButton({
  link,
  onOpen,
  children,
}: {
  link: MariReplyLink;
  onOpen: (resource: MariReferencedResource) => void;
  children: ReactNode;
}) {
  const { t } = useUiTranslation();
  const name = link.resource.name ?? link.term;
  return (
    <button
      type="button"
      className="mari-ref"
      title={t("mari.reply.openLink", { name })}
      onClick={() => onOpen(link.resource)}
    >
      <MariFace type={link.face.type} name={name} src={link.face.src} avatarCropStyle={link.face.avatarCropStyle} />
      {children}
    </button>
  );
}

export const CompactMarkdown = memo(function CompactMarkdown({
  content,
  streaming,
  links,
  onOpenLink,
}: {
  content: string;
  streaming?: boolean;
  /** Slice 72: names to turn into links (a finished answer only). */
  links?: readonly MariReplyLink[];
  onOpenLink?: (resource: MariReferencedResource) => void;
}) {
  const trimmed = content.trim();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const rendered = useMemo(() => {
    if (!trimmed) return null;
    if (streaming) return renderMarkdownBlocks(trimmed, renderStreamingInline, "home-mari");
    if (!links?.length || !onOpenLink) return renderMarkdownBlocks(trimmed, renderCompactInline, "home-mari");
    const used = new Set<MariReplyLink>();
    return renderMarkdownBlocks(
      trimmed,
      (text, keyPrefix) =>
        linkReplyNodes(
          renderCompactInline(text, keyPrefix),
          links,
          used,
          (link, linkContent, key) => (
            <MariReplyLinkButton key={key} link={link} onOpen={onOpenLink}>
              {linkContent}
            </MariReplyLinkButton>
          ),
          keyPrefix,
        ),
      "home-mari",
    );
  }, [trimmed, streaming, links, onOpenLink]);
  useCodeBlockCopy(container, rendered);
  if (!trimmed) return null;
  return (
    <div
      ref={setContainer}
      className="mari-message-content text-[0.8125rem] leading-[1.42] text-[var(--foreground)] [&_.mari-md-codeblock]:my-1.5 [&_.mari-md-codeblock]:max-h-44 [&_.mari-md-codeblock]:pb-12! [&_.mari-md-heading]:mb-0.5 [&_.mari-md-heading]:mt-1 [&_.mari-md-ol]:my-1 [&_.mari-md-ul]:my-1"
    >
      {rendered}
      {streaming && <span className="mari-stream-caret" aria-hidden="true" />}
    </div>
  );
});

export function ProfessorMariAttachedFiles({
  attachments,
  onRemove,
}: {
  attachments: ProfessorMariAttachment[];
  onRemove?: (index: number) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (attachments.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((attachment, index) =>
        isProfessorMariImageAttachment(attachment) ? (
          <div key={`${attachment.name}-${index}`} className="relative">
            <a
              href={attachment.data}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]/70"
              title={attachment.name}
            >
              <img
                src={attachment.data}
                alt={attachment.name || "Attached image"}
                className="h-24 w-24 object-cover sm:h-28 sm:w-28"
                draggable={false}
              />
            </a>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute right-1 top-1 rounded bg-[var(--background)]/80 p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] focus-visible:text-[var(--primary)]"
                aria-label={localizeUi("ui.chat.homeprofessormarichat.removeAttachment")}
                title={localizeUi("ui.chat.homeprofessormarichat.removeAttachment")}
              >
                <X size="0.75rem" />
              </button>
            )}
          </div>
        ) : (
          <div key={`${attachment.name}-${index}`} className="relative max-w-[14rem]">
            <a
              href={attachment.data}
              target="_blank"
              rel="noreferrer"
              download={attachment.name}
              className={cn(
                "flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/70 px-2.5 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                onRemove && "pr-8",
              )}
              title={attachment.name}
            >
              <FileText size="0.875rem" className="shrink-0 text-[var(--primary)]" />
              <span className="min-w-0 truncate">{attachment.name}</span>
            </a>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] focus-visible:text-[var(--primary)]"
                aria-label={localizeUi("ui.chat.homeprofessormarichat.removeAttachment")}
                title={localizeUi("ui.chat.homeprofessormarichat.removeAttachment")}
              >
                <X size="0.75rem" />
              </button>
            )}
          </div>
        ),
      )}
    </div>
  );
}

/** R11: files ride in the composer's top row as chips (thumbnail or file icon, name, ×), before "Aware of". */
export function ProfessorMariAttachmentPreviews({
  attachments,
  isReading,
  onRemove,
}: {
  attachments: ProfessorMariAttachment[];
  isReading: boolean;
  onRemove: (index: number) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <>
      {attachments.map((attachment, index) => (
        <span key={`${attachment.name}-${index}`} className="mari-composer-chip" title={attachment.name}>
          {isProfessorMariImageAttachment(attachment) ? (
            <img src={attachment.data} alt="" className="mari-composer-chip__thumb" draggable={false} />
          ) : (
            <FileText aria-hidden="true" />
          )}
          <span className="mari-composer-chip__text">{attachment.name}</span>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="mari-workspace-context-chip__remove"
            aria-label={localizeUi("ui.chat.professormariattachmentpreviews.removeValue1", { value1: attachment.name })}
            title={localizeUi("ui.chat.professormariattachmentpreviews.removeFile")}
          >
            <X size="0.625rem" aria-hidden="true" />
          </button>
        </span>
      ))}
      {isReading ? (
        <span className="mari-composer-chip">
          <Loader2 className="animate-spin" aria-hidden="true" />
          <span className="mari-composer-chip__text">{localizeUi("ui.chat.chatinput.readingFile")}</span>
        </span>
      ) : null}
    </>
  );
}

export function MariReasoningPanel({
  thinking,
  live,
  forceOpen,
  seconds,
}: {
  thinking: string;
  live?: boolean;
  forceOpen?: boolean;
  /** How long she thought, when the stream timed it. Older saved runs fall back to a line count. */
  seconds?: number | null;
}) {
  const { t: localizeUi } = useUiTranslation();
  const lines = thinking.trim().split(/\n+/);
  const lineCount = Math.max(1, lines.length);
  const latestThought = lines.at(-1)?.trim() ?? "";
  return (
    <details
      open={forceOpen || undefined}
      className="mari-reasoning-panel group text-[0.8125rem] text-[var(--muted-foreground)]"
      data-live={live ? "true" : "false"}
    >
      {/* Direction A: a quiet one-line disclosure, like a finished step. */}
      <summary
        className={cn(
          "-ml-2 flex min-h-[1.9rem] max-w-full cursor-pointer list-none items-center gap-2 rounded-lg px-2 marker:hidden hover:bg-[var(--mari-hover)] hover:text-[var(--foreground)] [&::-webkit-details-marker]:hidden",
          live ? "w-full" : "w-fit",
        )}
      >
        <Sparkles
          size="0.72rem"
          className={cn("mari-reasoning-panel__star shrink-0", live && "mari-reasoning-panel__star--live")}
          aria-hidden="true"
        />
        {live ? null : (
          <span>
            {seconds != null
              ? localizeUi("mari.workCard.thoughtFor", { seconds })
              : localizeUi("ui.chat.marireasoningpanel.reasoning")}
          </span>
        )}
        {live ? (
          <span className="mari-reasoning-panel__ticker" role="status">
            <span key={latestThought}>{latestThought || localizeUi("ui.chat.marireasoningpanel.live")}</span>
          </span>
        ) : seconds != null ? null : (
          <span className="rounded-md bg-[var(--background)]/70 px-1.5 py-0.5 text-[0.58rem] font-medium uppercase tracking-[0.12em] opacity-75">
            {localizeUi("ui.chat.marireasoningpanel.value1LineValue2", {
              value1: lineCount,
              value2: lineCount === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
            })}
          </span>
        )}
        <ChevronRight
          size="0.75rem"
          className="shrink-0 opacity-70 transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
      </summary>
      <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap break-words py-1 pl-5 text-[0.6875rem] italic leading-relaxed text-[var(--muted-foreground)]">
        {thinking.trimEnd()}
      </pre>
    </details>
  );
}

/** Slice 72: a record's face beside its name (a step, a phase, a reply link): its avatar, else its initial. */
export function MariFace({
  type,
  name,
  src,
  avatarCropStyle,
}: {
  type: ResultType;
  name: string;
  src?: string | null;
  avatarCropStyle?: CSSProperties;
}) {
  if (src) {
    return (
      <ResultTypeIcon type={type} src={src} kind="avatar" avatarCropStyle={avatarCropStyle} className="mari-face" />
    );
  }
  if (type === "character" || type === "persona") {
    const hue = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
    return (
      <span
        className="mari-face"
        data-initial="true"
        style={{ "--mari-face-hue": hue } as CSSProperties}
        aria-hidden="true"
      >
        {[...name.trim()][0]?.toLocaleUpperCase()}
      </span>
    );
  }
  return (
    <span className="mari-face" data-type={type} aria-hidden="true">
      <ResultTypeIcon type={type} glyph />
    </span>
  );
}
