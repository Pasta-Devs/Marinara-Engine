import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronUp, CircleUser, FileText, Link, Plus, Send, X } from "lucide-react";
import { runProfessorMariEntry, type MariMessage } from "../../../../engine/mari/mari-entry";
import {
  compactProfessorMariHistory,
  EMPTY_MARI_COMPACTION,
  isMariResetCommand,
  mariContextMessages,
  type MariCompactionState,
} from "../../../../engine/mari/mari-history";
import { llmApi } from "../../../../shared/api/llm-api";
import { mariApi, type ProfessorMariPreferences } from "../../../../shared/api/mari-api";
import { useConnections } from "../../../catalog/connections/index";
import { usePersonas } from "../../../catalog/characters/index";
import { ConversationMessage } from "../../../modes/conversation/message-shell";
import type { CharacterMap, PersonaInfo } from "../../../modes/shared/chat-ui/types";
import type { Message } from "../../../../engine/contracts/types/chat";
import { filterLanguageGenerationConnections } from "../../../../shared/lib/connection-filters";
import { cn, getAvatarCropStyle, parseAvatarCropJson } from "../../../../shared/lib/utils";
import { useUIStore } from "../../../../shared/stores/ui.store";

const MARI_AVATAR_URL = "/sprites/mari/Mari_profile.png";
const MARI_CHIBI_URL = "/sprites/mari/chibi-professor-mari.png";
const MARI_CHARACTER_ID = "__professor_mari_shell__";
const MARI_WELCOME_CONTENT =
  "Howdy, welcome to Marinara Engine!\n\nFeeling a little lost? It's not a skill issue yet, I'm here to help! If you have any questions, feel free to ask. I'm also knowledgeable about how the entire application works and can even edit it to meet your needs! Am I not the best? 😎";
const MARI_CONNECTION_SETUP_CONTENT =
  "Oh, whoops! Looks like you're trying to talk to me without having a model connection set up yet. I'm afraid I need the sweet GPU juice to run. Let me take you to the Connections tab first…";
const MARI_NO_CONNECTION_SELECTED_ERROR =
  'No connection set for this chat! Click the "chains" icon in the input box to select one.';
const MARI_INPUT_PLACEHOLDER = "Message @Professor Mari, /reset to reset the conversation and only then clear it";

type MariAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
};

type MariConnection = {
  id: string;
  name?: string;
  provider?: string;
  model?: string | null;
  maxContext?: unknown;
};

type MariPersona = {
  id: string;
  name: string;
  avatarPath?: string | null;
  avatarCrop?: string;
  comment?: string | null;
  description?: string | null;
  personality?: string | null;
  scenario?: string | null;
  backstory?: string | null;
  appearance?: string | null;
};

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDaySeparator(value: string) {
  const date = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - messageDay.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function getDayKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function toConversationMessage(message: MariMessage): Message {
  return {
    id: message.id,
    chatId: "professor-mari",
    role: message.role,
    characterId: message.role === "assistant" ? MARI_CHARACTER_ID : null,
    content: message.content,
    activeSwipeIndex: 0,
    swipeCount: 1,
    createdAt: message.createdAt,
    extra: {
      displayText: null,
      isGenerated: message.role === "assistant",
      tokenCount: null,
      generationInfo: null,
    },
  };
}

export function ProfessorMariSurface() {
  const { data: rawConnections } = useConnections();
  const { data: rawPersonas } = usePersonas();
  const convoGradient = useUIStore((s) => s.convoGradient);
  const theme = useUIStore((s) => s.theme);
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const [messages, setMessages] = useState<MariMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [compaction, setCompaction] = useState<MariCompactionState>(EMPTY_MARI_COMPACTION);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<MariAttachment[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [connectionMenuOpen, setConnectionMenuOpen] = useState(false);
  const [personaMenuOpen, setPersonaMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [connectionSetupPromptOpen, setConnectionSetupPromptOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const persistedConnectionIdRef = useRef<ProfessorMariPreferences["selectedConnectionId"] | undefined>(undefined);
  const persistedPersonaIdRef = useRef<ProfessorMariPreferences["selectedPersonaId"] | undefined>(undefined);
  const connectionSelectionTouchedRef = useRef(false);
  const personaSelectionTouchedRef = useRef(false);
  const preferencesReady = preferencesLoaded;
  const canSend = (draft.trim().length > 0 || attachments.length > 0) && !sending && historyLoaded && preferencesReady;
  const connections = useMemo(
    () =>
      filterLanguageGenerationConnections((rawConnections ?? []) as MariConnection[]).sort((a, b) =>
        (a.name || a.id).localeCompare(b.name || b.id),
      ),
    [rawConnections],
  );
  const personas = useMemo(
    () => ((rawPersonas ?? []) as MariPersona[]).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [rawPersonas],
  );
  const selectedConnection = connections.find((connection) => connection.id === selectedConnectionId) ?? null;
  const hasModelConnections = connections.length > 0;
  const selectedPersona = personas.find((persona) => persona.id === selectedPersonaId) ?? null;
  const gradientStyle = useMemo(() => {
    const gradient = convoGradient[theme];
    const isDefaultDark = convoGradient.dark.from === "#0a0a0e" && convoGradient.dark.to === "#1c2133";
    const isDefaultLight = convoGradient.light.from === "#f2eff7" && convoGradient.light.to === "#eae6f0";
    if ((theme === "dark" && isDefaultDark) || (theme === "light" && isDefaultLight)) {
      return { background: "var(--secondary)" };
    }
    return { background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` };
  }, [convoGradient, theme]);
  const characterMap: CharacterMap = useMemo(
    () =>
      new Map([
        [
          MARI_CHARACTER_ID,
          {
            name: "Professor Mari",
            avatarUrl: MARI_AVATAR_URL,
            conversationStatus: "online",
          },
        ],
      ]),
    [],
  );
  const personaInfo: PersonaInfo | undefined = useMemo(() => {
    if (!selectedPersona) return undefined;
    return {
      name: selectedPersona.name,
      description: selectedPersona.description ?? undefined,
      avatarUrl: selectedPersona.avatarPath ?? undefined,
      avatarCrop: parseAvatarCropJson(selectedPersona.avatarCrop),
    };
  }, [selectedPersona]);
  const welcomeMessage = useMemo<MariMessage>(
    () => ({
      id: "professor-mari-welcome",
      role: "assistant",
      content: MARI_WELCOME_CONTENT,
      createdAt: new Date().toISOString(),
    }),
    [],
  );
  const visibleMessages = useMemo(() => {
    if (!historyLoaded) return [];
    return messages.length > 0 ? messages : [welcomeMessage];
  }, [historyLoaded, messages, welcomeMessage]);
  const conversationMessages = useMemo(() => visibleMessages.map(toConversationMessage), [visibleMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sendError]);

  useEffect(() => {
    let active = true;
    void mariApi.history
      .get()
      .then((history) => {
        if (!active) return;
        setMessages(history.messages);
        setCompaction(history.compaction);
      })
      .catch((error) => {
        if (!active) return;
        setSendError(error instanceof Error ? error.message : "Professor Mari history could not be loaded.");
      })
      .finally(() => {
        if (active) setHistoryLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void mariApi.preferences
      .get()
      .then((preferences) => {
        if (!active) return;
        persistedConnectionIdRef.current = preferences.selectedConnectionId;
        persistedPersonaIdRef.current = preferences.selectedPersonaId;
        if (!connectionSelectionTouchedRef.current) {
          setSelectedConnectionId(preferences.selectedConnectionId);
        }
        if (!personaSelectionTouchedRef.current) {
          setSelectedPersonaId(preferences.selectedPersonaId);
        }
      })
      .catch((error) => {
        if (!active) return;
        persistedConnectionIdRef.current = null;
        persistedPersonaIdRef.current = null;
        setSendError(error instanceof Error ? error.message : "Professor Mari preferences could not be loaded.");
      })
      .finally(() => {
        if (active) setPreferencesLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (
      !preferencesLoaded ||
      (persistedConnectionIdRef.current === selectedConnectionId && persistedPersonaIdRef.current === selectedPersonaId)
    ) {
      return;
    }
    const nextConnectionId = selectedConnectionId;
    const nextPersonaId = selectedPersonaId;
    persistedConnectionIdRef.current = nextConnectionId;
    persistedPersonaIdRef.current = nextPersonaId;
    void mariApi.preferences.save({ selectedConnectionId: nextConnectionId, selectedPersonaId: nextPersonaId }).catch((error) => {
      persistedConnectionIdRef.current = undefined;
      persistedPersonaIdRef.current = undefined;
      setSendError(error instanceof Error ? error.message : "Professor Mari preferences could not be saved.");
    });
  }, [preferencesLoaded, selectedConnectionId, selectedPersonaId]);

  useEffect(() => {
    if (!preferencesLoaded || rawConnections === undefined || !selectedConnectionId) return;
    if (!connections.some((connection) => connection.id === selectedConnectionId)) {
      setSelectedConnectionId(null);
    }
  }, [connections, preferencesLoaded, rawConnections, selectedConnectionId]);

  useEffect(() => {
    if (!preferencesLoaded || rawPersonas === undefined || !selectedPersonaId) return;
    if (!personas.some((persona) => persona.id === selectedPersonaId)) {
      setSelectedPersonaId(null);
    }
  }, [personas, preferencesLoaded, rawPersonas, selectedPersonaId]);

  useEffect(() => {
    if (hasModelConnections) setConnectionSetupPromptOpen(false);
  }, [hasModelConnections]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "0px";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }, [draft]);

  const readFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const nextAttachments = await Promise.all(
      Array.from(files).map(
        (file) =>
          new Promise<MariAttachment>((resolve, reject) => {
            const finish = (content: string) =>
              resolve({
                id: newId("mari-file"),
                name: file.name,
                type: file.type || "application/octet-stream",
                size: file.size,
                content,
              });
            if (file.type.startsWith("image/")) {
              const reader = new FileReader();
              reader.onload = () => finish(String(reader.result ?? ""));
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
              return;
            }
            file.text().then(finish).catch(reject);
          }),
      ),
    );
    setAttachments((current) => [...current, ...nextAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const send = async () => {
    const userMessage = draft.trim() || (attachments.length > 0 ? "[attachments]" : "");
    if (!userMessage || sending || !historyLoaded || !preferencesReady) return;
    if (isMariResetCommand(userMessage)) {
      setDraft("");
      setAttachments([]);
      setSendError(null);
      setSending(true);
      try {
        await mariApi.history.reset();
        setMessages([]);
        setCompaction(EMPTY_MARI_COMPACTION);
      } catch (error) {
        setSendError(error instanceof Error ? error.message : "Professor Mari history could not be reset.");
      } finally {
        setSending(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      return;
    }
    if (!hasModelConnections) {
      setConnectionSetupPromptOpen(true);
      setSendError(null);
      setConnectionMenuOpen(false);
      setPersonaMenuOpen(false);
      setMobileMenuOpen(false);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    if (!selectedConnection) {
      setConnectionSetupPromptOpen(false);
      setSendError(MARI_NO_CONNECTION_SELECTED_ERROR);
      setConnectionMenuOpen(true);
      setPersonaMenuOpen(false);
      setMobileMenuOpen(false);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    const currentAttachments = attachments;
    setDraft("");
    setAttachments([]);
    setSendError(null);
    setSending(true);
    requestAnimationFrame(() => inputRef.current?.focus());
    try {
      const user = await mariApi.history.appendMessage({ role: "user", content: userMessage });
      const messagesWithUser = [...messages, user];
      setMessages(messagesWithUser);

      const compactionResult = await compactProfessorMariHistory({
        messages: messagesWithUser,
        compaction,
        connection: selectedConnection,
        llm: llmApi,
      });
      const nextCompaction = compactionResult.compaction;
      if (compactionResult.compacted) {
        setCompaction(await mariApi.history.saveCompaction(nextCompaction));
      }
      const contextMessages = mariContextMessages(messagesWithUser, nextCompaction).filter(
        (message) => message.id !== user.id,
      );

      const response = await runProfessorMariEntry(
        {
          userMessage,
          messages: contextMessages,
          compactedSummary: nextCompaction.compactedSummary,
          connectionId: selectedConnection?.id ?? null,
          persona: selectedPersona
            ? {
                id: selectedPersona.id,
                name: selectedPersona.name,
                comment: selectedPersona.comment ?? null,
                description: selectedPersona.description ?? null,
                personality: selectedPersona.personality ?? null,
                scenario: selectedPersona.scenario ?? null,
                backstory: selectedPersona.backstory ?? null,
                appearance: selectedPersona.appearance ?? null,
              }
            : null,
          attachments: currentAttachments.map((attachment) => ({
            id: attachment.id,
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
            content: attachment.content,
          })),
        },
        mariApi,
      );
      const assistant = await mariApi.history.appendMessage({ role: "assistant", content: response.content });
      setMessages((current) => [...current, assistant]);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Professor Mari failed to respond.");
      setSending(false);
      return;
    }
    setSending(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const openConnectionsPanel = () => {
    setConnectionSetupPromptOpen(false);
    setConnectionMenuOpen(false);
    setPersonaMenuOpen(false);
    setMobileMenuOpen(false);
    openRightPanel("connections");
  };

  const selectConnection = (id: string | null) => {
    connectionSelectionTouchedRef.current = true;
    setSelectedConnectionId(id);
    setConnectionMenuOpen(false);
    setMobileMenuOpen(false);
  };
  const selectPersona = (id: string | null) => {
    personaSelectionTouchedRef.current = true;
    setSelectedPersonaId(id);
    setPersonaMenuOpen(false);
    setMobileMenuOpen(false);
  };
  const inputIconButtonClass =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-foreground/60 transition-all hover:bg-foreground/10 hover:text-foreground active:scale-90";
  const activeInputIconButtonClass = "bg-foreground/10 text-foreground";

  return (
    <section
      className="mari-chat-area relative flex h-full flex-col overflow-hidden"
      style={gradientStyle}
      aria-busy={!historyLoaded || sending}
    >
      <div className="mari-messages-scroll flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mari-professor-hero mx-auto flex w-full max-w-3xl justify-center px-4 pb-2 pt-5 sm:pt-7">
          <ProfessorMariPixelScene active={sending || !historyLoaded} />
        </div>

        <div className="mx-auto w-full max-w-3xl px-0 pb-4 pt-1">
          {!historyLoaded && <ProfessorMariLoadingState />}
          {conversationMessages.map((message, index) => {
            const previous = conversationMessages[index - 1];
            const showSeparator = !previous || getDayKey(previous.createdAt) !== getDayKey(message.createdAt);
            const isGrouped =
              !!previous &&
              previous.role === message.role &&
              previous.characterId === message.characterId &&
              getDayKey(previous.createdAt) === getDayKey(message.createdAt) &&
              new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() <= 5 * 60 * 1000;
            return (
              <div key={message.id}>
                {showSeparator && (
                  <div className="relative my-4 flex items-center px-4">
                    <div className="flex-1 border-t border-[var(--border)]/40" />
                    <span className="mx-4 text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
                      {formatDaySeparator(message.createdAt)}
                    </span>
                    <div className="flex-1 border-t border-[var(--border)]/40" />
                  </div>
                )}
                <ConversationMessage
                  message={message}
                  isStreaming={false}
                  isGrouped={isGrouped}
                  hideActions
                  characterMap={characterMap}
                  personaInfo={personaInfo}
                  chatCharacterIds={[MARI_CHARACTER_ID]}
                  messageIndex={index + 1}
                  messageOrderIndex={index}
                />
              </div>
            );
          })}
          {sending && (
            <div className="px-4 py-2 text-xs text-[var(--muted-foreground)]">Professor Mari is thinking...</div>
          )}
          {sendError && <div className="px-4 py-2 text-xs text-red-500">{sendError}</div>}
          <div ref={messagesEndRef} className="h-1" />
        </div>
      </div>

      <div className="mari-chat-input chat-input-container relative z-10 px-3 pb-3 md:px-[12%]">
        {(connectionMenuOpen || personaMenuOpen || mobileMenuOpen) && (
          <div className="pointer-events-none absolute inset-x-3 bottom-full z-30 mb-2 md:inset-x-[12%]">
            <MariContextMenu
              connections={connections}
              personas={personas}
              selectedConnectionId={selectedConnectionId}
              selectedPersonaId={selectedPersonaId}
              mode={mobileMenuOpen ? "both" : connectionMenuOpen ? "connections" : "personas"}
              onSelectConnection={selectConnection}
              onSelectPersona={selectPersona}
            />
          </div>
        )}

        {connectionSetupPromptOpen && (
          <div className="mx-auto mb-2 flex max-w-3xl flex-col gap-2 rounded-xl border border-sky-400/30 bg-[var(--card)] px-3 py-2.5 text-xs text-[var(--foreground)] shadow-xl shadow-sky-500/10 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 leading-relaxed text-[var(--foreground)]/85">{MARI_CONNECTION_SETUP_CONTENT}</p>
            <button
              type="button"
              onClick={openConnectionsPanel}
              className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-sky-500 px-3 text-xs font-semibold text-white transition-all hover:bg-sky-400 active:scale-95"
            >
              <Link size="0.8125rem" />
              Take me there!
            </button>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="group flex items-center gap-1.5 rounded-lg bg-foreground/10 px-2 py-1 text-xs text-foreground/70"
              >
                <FileText size="0.875rem" className="shrink-0 text-foreground/50" />
                <span className="max-w-[9rem] truncate">{attachment.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                  className="rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
                  title="Remove attachment"
                  aria-label={`Remove ${attachment.name}`}
                >
                  <X size="0.75rem" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            "mari-chat-input-box relative mx-auto flex max-w-3xl items-center gap-1.5 rounded-2xl border-2 px-2.5 py-2.5 transition-all duration-200 sm:gap-2 sm:px-4",
            "bg-[var(--card)]",
            canSend ? "border-blue-400/30 shadow-md shadow-blue-500/5" : "border-foreground/25",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.txt,.md,.markdown,.json,.jsonl,.csv,.log,.xml,.yaml,.yml"
            multiple
            className="hidden"
            onChange={(event) => void readFiles(event.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={inputIconButtonClass}
            title="Attach files"
            aria-label="Attach files"
          >
            <Plus size="1rem" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (!hasModelConnections) {
                setConnectionSetupPromptOpen(true);
                setConnectionMenuOpen(false);
                setPersonaMenuOpen(false);
                setMobileMenuOpen(false);
                return;
              }
              setConnectionMenuOpen((open) => !open);
              setPersonaMenuOpen(false);
              setMobileMenuOpen(false);
            }}
            className={cn(
              inputIconButtonClass,
              selectedConnection && activeInputIconButtonClass,
              !hasModelConnections && "ring-1 ring-foreground/20",
            )}
            title={
              selectedConnection
                ? selectedConnection.name || selectedConnection.id
                : hasModelConnections
                  ? "Quick Connection Switcher"
                  : "Set up a model connection"
            }
            aria-label={hasModelConnections ? "Quick Connection Switcher" : "Set up a model connection"}
          >
            <Link size="1rem" />
          </button>

          <button
            type="button"
            onClick={() => {
              setPersonaMenuOpen((open) => !open);
              setConnectionMenuOpen(false);
              setMobileMenuOpen(false);
            }}
            className={cn(
              inputIconButtonClass,
              "relative hidden overflow-hidden sm:flex",
              selectedPersona && activeInputIconButtonClass,
            )}
            title={selectedPersona ? selectedPersona.name : "Quick Persona Switcher"}
            aria-label="Quick Persona Switcher"
          >
            {selectedPersona?.avatarPath ? (
              <img
                src={selectedPersona.avatarPath}
                alt=""
                className="h-full w-full rounded-lg object-cover"
                style={getAvatarCropStyle(parseAvatarCropJson(selectedPersona.avatarCrop))}
                draggable={false}
              />
            ) : (
              <CircleUser size="1rem" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen((open) => !open);
              setConnectionMenuOpen(false);
              setPersonaMenuOpen(false);
            }}
            className={cn(inputIconButtonClass, "sm:hidden", mobileMenuOpen && activeInputIconButtonClass)}
            title="Quick Switcher"
            aria-label="Quick Switcher"
          >
            <ChevronUp size="1rem" className={cn("transition-transform", mobileMenuOpen && "rotate-180")} />
          </button>

          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={1}
            spellCheck
            autoCorrect="on"
            placeholder={MARI_INPUT_PLACEHOLDER}
            className="mari-chat-input-textarea max-h-[12.5rem] min-w-0 flex-1 resize-none bg-transparent py-0 text-sm leading-normal text-foreground/90 placeholder:text-foreground/30 outline-none"
          />

          <button
            type="button"
            onClick={() => void send()}
            disabled={!canSend}
            className={cn(
              "mari-chat-send-btn",
              inputIconButtonClass,
              canSend ? "text-foreground hover:text-foreground/80 active:scale-90" : "text-foreground/20",
            )}
            title="Send"
            aria-label="Send"
          >
            <Send size="0.9375rem" className={cn(canSend && "translate-x-[1px]")} />
          </button>
        </div>
      </div>
    </section>
  );
}

function ProfessorMariLoadingState() {
  return (
    <div className="flex justify-center px-4 py-6">
      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] shadow-sm">
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400/60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-400" />
        </span>
        Restoring Professor Mari...
      </div>
    </div>
  );
}

function ProfessorMariPixelScene({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        "mari-professor-pixel-scene",
        active ? "mari-professor-pixel-scene-active" : "mari-professor-pixel-scene-idle",
      )}
    >
      <div className="mari-professor-pixel-glow" aria-hidden />
      <div className="mari-professor-pixel-desk" aria-hidden />
      <img src={MARI_CHIBI_URL} alt="Professor Mari" className="mari-professor-pixel-sprite" draggable={false} />
      <div className="mari-professor-laptop" aria-hidden>
        <div className="mari-professor-laptop-screen">
          <span />
          <span />
          <span />
        </div>
        <div className="mari-professor-laptop-base">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}

function MariContextMenu({
  connections,
  personas,
  selectedConnectionId,
  selectedPersonaId,
  mode,
  onSelectConnection,
  onSelectPersona,
}: {
  connections: MariConnection[];
  personas: MariPersona[];
  selectedConnectionId: string | null;
  selectedPersonaId: string | null;
  mode: "connections" | "personas" | "both";
  onSelectConnection: (id: string | null) => void;
  onSelectPersona: (id: string | null) => void;
}) {
  return (
    <div className="pointer-events-auto mx-auto grid max-h-[min(26rem,48dvh)] max-w-3xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl backdrop-blur-xl sm:w-fit sm:min-w-[20rem]">
      {(mode === "connections" || mode === "both") && (
        <div className="min-w-0 border-b border-[var(--border)] last:border-b-0">
          <div className="border-b border-[var(--border)] px-3 py-2 text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
            Connections
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => onSelectConnection(null)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--accent)]",
                selectedConnectionId === null && "font-semibold text-[var(--foreground)]",
              )}
            >
              <span className="flex-1 truncate">No connection selected</span>
              {selectedConnectionId === null && <Check size="0.75rem" />}
            </button>
            {connections.map((connection) => {
              const active = connection.id === selectedConnectionId;
              return (
                <button
                  key={connection.id}
                  type="button"
                  onClick={() => onSelectConnection(connection.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--accent)]",
                    active && "font-semibold text-[var(--foreground)]",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{connection.name || connection.id}</span>
                  {connection.provider && (
                    <span className="shrink-0 text-[0.625rem] text-[var(--muted-foreground)]">{connection.provider}</span>
                  )}
                  {active && <Check size="0.75rem" />}
                </button>
              );
            })}
            {connections.length === 0 && (
              <div className="px-3 py-4 text-center text-[0.6875rem] italic text-[var(--muted-foreground)]">
                No connections found.
              </div>
            )}
          </div>
        </div>
      )}

      {(mode === "personas" || mode === "both") && (
        <div className="min-w-0">
          <div className="border-b border-[var(--border)] px-3 py-2 text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
            Personas
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => onSelectPersona(null)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--accent)]",
                selectedPersonaId === null && "text-[var(--foreground)]",
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--secondary)] text-xs font-semibold text-[var(--muted-foreground)]">
                ?
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">No persona selected</div>
              </div>
              {selectedPersonaId === null && <Check size="0.75rem" />}
            </button>
            {personas.map((persona) => {
              const active = persona.id === selectedPersonaId;
              return (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => onSelectPersona(persona.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--accent)]",
                    active && "text-[var(--foreground)]",
                  )}
                >
                  {persona.avatarPath ? (
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[var(--border)]">
                      <img
                        src={persona.avatarPath}
                        alt=""
                        className="h-full w-full object-cover"
                        style={getAvatarCropStyle(parseAvatarCropJson(persona.avatarCrop))}
                        draggable={false}
                      />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--secondary)] text-xs font-semibold text-[var(--muted-foreground)]">
                      {(persona.name || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold">{persona.name || persona.id}</div>
                    {persona.comment && (
                      <div className="truncate text-[0.625rem] text-[var(--muted-foreground)]">{persona.comment}</div>
                    )}
                  </div>
                  {active && <Check size="0.75rem" />}
                </button>
              );
            })}
            {personas.length === 0 && (
              <div className="px-3 py-4 text-center text-[0.6875rem] italic text-[var(--muted-foreground)]">
                No personas found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
