import {
  cloneElement,
  isValidElement,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getRoleplayCommandActivity, type RoleplayCommandActivity } from "@marinara-engine/shared";
import { useUpdateMessageExtra } from "../../hooks/use-chats";
import { useRestoreRoleplayInterrupt } from "../../hooks/use-roleplay-commands";
import { useChatStore } from "../../stores/chat.store";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { ExpandedTextarea } from "../ui/ExpandedTextarea";
import { RoleplayDocument } from "./RoleplayDocument";
import { AnimatedDiceRoll, shouldAnimateDiceRollMessage } from "../dice/AnimatedDiceRoll";
import { isDiceRollResult } from "../../lib/dice-roll-result";

const loadedAt = Date.now();

export function RoleplayDiceRoll({ result, createdAt }: { result: string; createdAt: string }) {
  const roll = useMemo(() => {
    try {
      const value: unknown = JSON.parse(result);
      return isDiceRollResult(value) ? value : null;
    } catch {
      return null;
    }
  }, [result]);
  const [animate] = useState(() => Date.parse(createdAt) >= loadedAt && shouldAnimateDiceRollMessage(createdAt));
  return roll ? (
    <div className="my-3 min-w-0 max-w-full whitespace-normal" data-roleplay-inline-roll>
      <AnimatedDiceRoll {...roll} animate={animate} />
    </div>
  ) : null;
}

// The HTML has already passed ChatMessage's sanitizer. Insert only text-node
// slots into that complete document, so an inline roll cannot break its tags.
function RoleplayDiceHtml({ element, slots }: { element: ReactElement; slots: Map<string, ReactNode> }) {
  const ref = useRef<HTMLDivElement>(null);
  // Keep the host element identical while portals mount. Reapplying
  // dangerouslySetInnerHTML would discard their DOM targets.
  const [host] = useState(() => cloneElement(element, { ref } as Record<string, unknown>));
  const processed = useRef(false);
  const [targets, setTargets] = useState<Array<{ marker: string; element: HTMLElement }>>([]);
  useLayoutEffect(() => {
    if (!ref.current || processed.current) return;
    processed.current = true;
    const walker = document.createTreeWalker(ref.current, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    const next: typeof targets = [];
    for (const node of nodes) {
      if (node.parentElement?.closest("style, script")) continue;
      const parts = node.data.split(new RegExp(`(${[...slots.keys()].join("|")})`, "u"));
      if (parts.length === 1) continue;
      const fragment = document.createDocumentFragment();
      for (const part of parts) {
        if (slots.has(part)) {
          const target = document.createElement("span");
          target.style.display = "block";
          fragment.append(target);
          next.push({ marker: part, element: target });
        } else fragment.append(document.createTextNode(part));
      }
      node.replaceWith(fragment);
    }
    setTargets(next);
  }, [slots]);
  return (
    <>
      {host}
      {targets.map((target) => createPortal(slots.get(target.marker), target.element, target.marker))}
      {[...slots].filter(([marker]) => !targets.some((target) => target.marker === marker)).map(([, roll]) => roll)}
    </>
  );
}

/** Replace private, render-only text markers after parsing the complete prose once. */
export function replaceRoleplayDiceMarkers(content: ReactNode, slots: Map<string, ReactNode>): ReactNode {
  if (!slots.size) return content;
  const pattern = new RegExp(`(${[...slots.keys()].join("|")})`, "u");
  const used = new Set<string>();
  const visit = (node: ReactNode): ReactNode => {
    if (typeof node === "string")
      return node.split(pattern).map((part) => {
        if (!slots.has(part)) return part;
        used.add(part);
        return slots.get(part);
      });
    if (Array.isArray(node)) return node.map(visit);
    if (
      !isValidElement<{ children?: ReactNode; className?: string; dangerouslySetInnerHTML?: { __html: string } }>(node)
    )
      return node;
    const html = node.props.dangerouslySetInnerHTML?.__html;
    if (html !== undefined) {
      for (const marker of slots.keys()) used.add(marker);
      // Remount when the sanitized document changes; React owns the surrounding
      // element, while portals own only the empty slots created inside it.
      return <RoleplayDiceHtml key={`${node.props.className}:${html}`} element={node} slots={slots} />;
    }
    return node.props.children === undefined ? node : cloneElement(node, {}, visit(node.props.children));
  };
  const rendered = visit(content);
  return (
    <>
      {rendered}
      {[...slots].filter(([marker]) => !used.has(marker)).map(([, roll]) => roll)}
    </>
  );
}

const actionClass =
  "min-h-11 rounded-lg px-3 text-sm text-[var(--primary)] hover:bg-[var(--primary)]/10 focus-visible:outline focus-visible:outline-[var(--primary)] disabled:opacity-40";

function CommandNotice({
  item,
  characterName,
  soundUrl,
  pending,
  update,
  restore,
}: {
  item: RoleplayCommandActivity;
  characterName: string;
  soundUrl?: string;
  pending: boolean;
  update: (item: RoleplayCommandActivity) => Promise<unknown>;
  restore: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const { command } = item;
  const content =
    (command.type === "notes" || command.type === "memory" || command.type === "document") &&
    typeof command.content === "string"
      ? command.content
      : null;
  const limit = command.type === "memory" ? 1000 : command.type === "notes" ? 8000 : 16000;
  const save = async (next: RoleplayCommandActivity) => {
    setError("");
    try {
      await update(next);
      setEditing(false);
    } catch {
      setError(t("roleplay.commands.activity.saveFailed"));
    }
  };
  return (
    <div className="min-w-0 space-y-2 whitespace-normal" data-roleplay-command={command.type}>
      {!item.deleted &&
        !item.error &&
        command.type === "document" &&
        typeof command.title === "string" &&
        content !== null && <RoleplayDocument document={command} styleVariant={item.documentStyle} />}
      <div
        className="overflow-hidden rounded-lg border border-[var(--primary)]/20 text-[var(--marinara-chat-chrome-panel-text)]"
        style={{ WebkitTextStroke: "0px", textShadow: "none" }}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-h-11 w-full items-center gap-2 px-3 py-3 text-left text-sm text-[var(--primary)] focus-visible:outline focus-visible:outline-[var(--primary)]"
        >
          <ChevronDown size="1rem" aria-hidden className={`shrink-0 ${open ? "rotate-180" : ""}`} />
          <span className="min-w-0 break-words">
            {t("roleplay.commands.activity.used", { character: characterName, command: command.type })}
          </span>
        </button>
        {open && (
          <div className="space-y-3 border-t border-[var(--primary)]/20 px-3 py-3 text-sm">
            {item.deleted ? (
              <p>{t("roleplay.commands.activity.deleted")}</p>
            ) : (
              content !== null && (
                <div>
                  {command.type !== "document" && (
                    <>
                      <p className="mb-1 font-medium">{t("roleplay.commands.activity.context")}</p>
                      <div className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words">{content}</div>
                    </>
                  )}
                  {!item.error && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button
                        type="button"
                        className={actionClass}
                        disabled={pending}
                        onClick={() => {
                          setDraft(content);
                          setEditing(true);
                        }}
                      >
                        <Pencil size="0.875rem" aria-hidden className="mr-1 inline" />
                        {t("roleplay.commands.activity.edit")}
                      </button>
                      <button
                        type="button"
                        className={actionClass}
                        disabled={pending}
                        onClick={async () => {
                          if (
                            await showConfirmDialog({
                              title: t("roleplay.commands.activity.deleteTitle"),
                              message: t("roleplay.commands.activity.deleteDescription"),
                              confirmLabel: t("roleplay.commands.activity.delete"),
                              cancelLabel: t("roleplay.commands.activity.cancel"),
                            })
                          )
                            await save({ ...item, deleted: true });
                        }}
                      >
                        <Trash2 size="0.875rem" aria-hidden className="mr-1 inline" />
                        {t("roleplay.commands.activity.delete")}
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
            <div>
              <p className="mb-1 font-medium">{t("roleplay.commands.activity.original")}</p>
              <pre className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs">
                {item.raw}
              </pre>
            </div>
            {item.result && (
              <div>
                <p className="mb-1 font-medium">{t("roleplay.commands.activity.result")}</p>
                <pre className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs">
                  {item.result}
                </pre>
              </div>
            )}
            {item.error && <p>{t("roleplay.commands.failed", { error: item.error })}</p>}
            {command.type === "interrupt" &&
              item.interruption &&
              !item.deleted &&
              !item.error &&
              (item.interruption.restored ? (
                <p role="status">{t("roleplay.commands.interrupt.restored")}</p>
              ) : (
                <button
                  type="button"
                  className={actionClass}
                  disabled={pending}
                  onClick={async () => {
                    setError("");
                    try {
                      await restore();
                    } catch (error) {
                      setError(
                        t("roleplay.commands.interrupt.restoreFailed", {
                          error: error instanceof Error ? error.message : t("roleplay.commands.activity.saveFailed"),
                        }),
                      );
                    }
                  }}
                >
                  <RotateCcw size="0.875rem" aria-hidden className="mr-1 inline" />
                  {t("roleplay.commands.interrupt.restore")}
                </button>
              ))}
            {soundUrl && (
              <audio
                controls
                preload="none"
                src={soundUrl}
                className="w-full max-w-full"
                aria-label={t("roleplay.commands.sound.play")}
              />
            )}
            {error && <p role="alert">{error}</p>}
          </div>
        )}
      </div>
      {editing && (
        <ExpandedTextarea
          open
          onClose={() => setEditing(false)}
          title={t("roleplay.commands.activity.editTitle")}
          value={draft}
          onChange={setDraft}
          closeLabel={t("roleplay.commands.activity.cancel")}
          footer={
            <div className="flex flex-wrap items-center justify-end gap-2 pb-[var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom))]">
              {error && (
                <p role="alert" className="mr-auto text-sm">
                  {error}
                </p>
              )}
              {draft.length > limit && (
                <p role="alert" className="mr-auto text-sm">
                  {t("roleplay.commands.activity.tooLong", { limit })}
                </p>
              )}
              <button type="button" className={actionClass} disabled={pending} onClick={() => setEditing(false)}>
                {t("roleplay.commands.activity.cancel")}
              </button>
              <button
                type="button"
                className={actionClass}
                disabled={pending || !draft.trim() || draft.length > limit}
                onClick={() => {
                  if (content !== null)
                    void save({ ...item, command: { ...command, content: draft } as typeof command });
                }}
              >
                {t("roleplay.commands.activity.save")}
              </button>
            </div>
          }
        />
      )}
    </div>
  );
}

export function RoleplayCommandResults({
  chatId,
  messageId,
  swipeIndex,
  characterName,
  extra,
  isStreaming,
}: {
  chatId: string;
  messageId: string;
  swipeIndex: number;
  characterName: string;
  extra: Record<string, unknown>;
  isStreaming: boolean;
}) {
  const { t } = useTranslation();
  const mutation = useUpdateMessageExtra(chatId);
  const restore = useRestoreRoleplayInterrupt(chatId);
  const chatGenerating = useChatStore(
    (state) => state.abortControllers.has(chatId) || (state.isStreaming && state.streamingChatId === chatId),
  );
  const activity = getRoleplayCommandActivity(extra);
  const sounds = Array.isArray(extra.attachments)
    ? extra.attachments.filter(
        (attachment) =>
          attachment?.roleplaySound === true &&
          typeof attachment.name === "string" &&
          typeof attachment.url === "string" &&
          attachment.url.startsWith("/api/game-assets/file/sfx/"),
      )
    : [];
  if (!activity.length && !sounds.length) return null;
  return (
    <div className="mt-3 space-y-2" data-roleplay-command-results onDoubleClick={(event) => event.stopPropagation()}>
      {activity.map((item, index) => (
        <CommandNotice
          key={`${messageId}:${swipeIndex}:${index}`}
          item={item}
          characterName={characterName}
          pending={isStreaming || chatGenerating || mutation.isPending || restore.isPending}
          restore={() => restore.mutateAsync({ messageId, swipeIndex, activityIndex: index })}
          soundUrl={
            item.command.type === "sound"
              ? sounds.find((sound) => sound.name === (item.command as { description: string }).description)?.url
              : undefined
          }
          update={(next) =>
            mutation.mutateAsync({
              messageId,
              swipeIndex,
              extra: {
                roleplayCommandActivity: activity.map((record, i) => (i === index ? next : record)),
                roleplayPrivateCommands: null,
                roleplayDocuments: null,
              },
            })
          }
        />
      ))}
      {!activity.some((item) => item.command.type === "sound") &&
        sounds.map((sound, index) => (
          <audio
            key={index}
            controls
            preload="none"
            src={sound.url}
            className="w-full max-w-full"
            aria-label={t("roleplay.commands.sound.play")}
          />
        ))}
    </div>
  );
}
