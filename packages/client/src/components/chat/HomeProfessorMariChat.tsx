import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Link, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { PROFESSOR_MARI_ID, type APIConnection, type Chat, type Message } from "@marinara-engine/shared";
import { useConnections } from "../../hooks/use-connections";
import { useGenerate } from "../../hooks/use-generate";
import { chatKeys } from "../../hooks/use-chats";
import { filterLanguageGenerationConnections } from "../../lib/connection-filters";
import { api } from "../../lib/api-client";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";
import { cn } from "../../lib/utils";
import { ConversationMessage } from "./ConversationMessage";
import { HomeFaq } from "./HomeFaq";
import type { CharacterMap } from "./chat-area.types";

const MARI_AVATAR_URL = "/sprites/mari/Mari_profile.png";
const MARI_CHIBI_URL = "/sprites/mari/chibi-professor-mari.png";
const MARI_CONNECTION_STORAGE_KEY = "marinara:home-professor-mari-connection-id";
const MARI_WELCOME =
  "Howdy, welcome to Marinara Engine!\n\nFeeling a little lost? It is not a skill issue yet, I am here to help. Ask me about the app, your setup, or what to do next.";

function readStoredConnectionId() {
  try {
    return window.localStorage.getItem(MARI_CONNECTION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberConnectionId(id: string) {
  try {
    window.localStorage.setItem(MARI_CONNECTION_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

function toMessageExtra(message: Message): Message["extra"] {
  if (typeof message.extra === "string") {
    try {
      return JSON.parse(message.extra) as Message["extra"];
    } catch {
      return {
        displayText: null,
        isGenerated: message.role === "assistant",
        tokenCount: null,
        generationInfo: null,
      };
    }
  }
  return message.extra;
}

function createWelcomeMessage(chatId: string | null): Message {
  return {
    id: "__professor_mari_home_welcome__",
    chatId: chatId ?? "__professor_mari_home__",
    role: "assistant",
    characterId: PROFESSOR_MARI_ID,
    content: MARI_WELCOME,
    activeSwipeIndex: 0,
    createdAt: new Date(0).toISOString(),
    extra: {
      displayText: null,
      isGenerated: false,
      tokenCount: null,
      generationInfo: null,
    },
  };
}

function createLocalUserMessage(chatId: string, content: string): Message {
  return {
    id: `__professor_mari_local_${Date.now()}`,
    chatId,
    role: "user",
    characterId: null,
    content,
    activeSwipeIndex: 0,
    createdAt: new Date().toISOString(),
    extra: {
      displayText: null,
      isGenerated: false,
      tokenCount: null,
      generationInfo: null,
    },
  };
}

function createStreamMessage(chatId: string, content: string): Message {
  return {
    id: "__professor_mari_home_stream__",
    chatId,
    role: "assistant",
    characterId: PROFESSOR_MARI_ID,
    content,
    activeSwipeIndex: 0,
    createdAt: new Date().toISOString(),
    extra: {
      displayText: null,
      isGenerated: true,
      tokenCount: null,
      generationInfo: null,
    },
  };
}

function ProfessorMariPixelScene({ active }: { active: boolean }) {
  return (
    <div className="mari-professor-pixel-scene" data-state={active ? "active" : "idle"} aria-hidden="true">
      <div data-part="glow" />
      <div data-part="desk" />
      <img src={MARI_CHIBI_URL} alt="" data-part="sprite" draggable={false} />
      <div data-part="laptop">
        <div data-part="screen">
          <span />
          <span />
          <span />
        </div>
        <div data-part="base">
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

export function HomeProfessorMariChat() {
  const qc = useQueryClient();
  const { data: connectionsRaw, isLoading: connectionsLoading } = useConnections();
  const { generate } = useGenerate();
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(() => readStoredConnectionId());
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [connectionMenuOpen, setConnectionMenuOpen] = useState(false);
  const hasLoadedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const connectionButtonRef = useRef<HTMLButtonElement>(null);
  const connectionMenuRef = useRef<HTMLDivElement>(null);

  const streamBuffer = useChatStore((state) => (chatId ? (state.streamBuffers.get(chatId) ?? "") : ""));
  const hasActiveGeneration = useChatStore((state) => (chatId ? state.abortControllers.has(chatId) : false));
  const mariPhase = useChatStore((state) => (chatId ? (state.mariPhaseByChatId.get(chatId) ?? null) : null));

  const languageConnections = useMemo(
    () => filterLanguageGenerationConnections((connectionsRaw ?? []) as APIConnection[]),
    [connectionsRaw],
  );
  const selectedConnection = useMemo(
    () => languageConnections.find((connection) => connection.id === selectedConnectionId) ?? null,
    [languageConnections, selectedConnectionId],
  );
  const effectiveConnection =
    selectedConnection ??
    languageConnections.find((connection) => connection.isDefault) ??
    languageConnections[0] ??
    null;
  const effectiveConnectionId = effectiveConnection?.id ?? null;
  const isBusy = sending || hasActiveGeneration;

  const characterMap = useMemo<CharacterMap>(() => {
    return new Map([
      [
        PROFESSOR_MARI_ID,
        {
          name: "Professor Mari",
          avatarUrl: MARI_AVATAR_URL,
          conversationStatus: isBusy ? "online" : "idle",
          conversationActivity: isBusy ? "Experimenting" : "Available",
        },
      ],
    ]);
  }, [isBusy]);

  const loadMessages = useCallback(async (id: string) => {
    const items = await api.get<Message[]>(`/chats/${id}/messages?limit=80`);
    setMessages(items.map((message) => ({ ...message, extra: toMessageExtra(message) })));
  }, []);

  const ensureProfessorMariChat = useCallback(
    async (connectionId: string | null) => {
      const params = new URLSearchParams();
      if (connectionId) params.set("connectionId", connectionId);
      const query = params.toString();
      const chat = await api.get<Chat>(`/chats/internal/professor-mari${query ? `?${query}` : ""}`);
      setChatId(chat.id);
      qc.setQueryData(chatKeys.detail(chat.id), chat);
      return chat;
    },
    [qc],
  );

  useEffect(() => {
    if (languageConnections.length === 0) {
      setSelectedConnectionId(null);
      return;
    }

    setSelectedConnectionId((current) => {
      if (current && languageConnections.some((connection) => connection.id === current)) return current;
      const next =
        languageConnections.find((connection) => connection.isDefault)?.id ?? languageConnections[0]?.id ?? null;
      if (next) rememberConnectionId(next);
      return next;
    });
  }, [languageConnections]);

  useEffect(() => {
    if (hasLoadedRef.current || connectionsLoading) return;
    hasLoadedRef.current = true;
    setLoadingHistory(true);
    ensureProfessorMariChat(effectiveConnectionId)
      .then((chat) => loadMessages(chat.id))
      .catch((error) => {
        console.error("[Professor Mari] Failed to load home assistant", error);
      })
      .finally(() => setLoadingHistory(false));
  }, [connectionsLoading, effectiveConnectionId, ensureProfessorMariChat, loadMessages]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, streamBuffer]);

  const displayMessages = useMemo(() => {
    const base = [createWelcomeMessage(chatId), ...messages];
    if (chatId && streamBuffer) return [...base, createStreamMessage(chatId, streamBuffer)];
    return base;
  }, [chatId, messages, streamBuffer]);

  useEffect(() => {
    if (!connectionMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (connectionButtonRef.current?.contains(target) || connectionMenuRef.current?.contains(target)) return;
      setConnectionMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [connectionMenuOpen]);

  const handleConnectionChange = (id: string) => {
    setSelectedConnectionId(id);
    rememberConnectionId(id);
    setConnectionMenuOpen(false);
  };

  const handleRestart = useCallback(async () => {
    const chat = await ensureProfessorMariChat(effectiveConnectionId);
    const currentMessages = await api.get<Message[]>(`/chats/${chat.id}/messages`);
    if (currentMessages.length > 0) {
      await api.post(`/chats/${chat.id}/messages/bulk-delete`, {
        messageIds: currentMessages.map((message) => message.id),
      });
    }
    setMessages([]);
    setDraft("");
    useChatStore.getState().clearStreamBuffer(chat.id);
    toast.success("Professor Mari's home chat was restarted.");
  }, [effectiveConnectionId, ensureProfessorMariChat]);

  const runRestart = useCallback(async () => {
    if (isBusy) return;
    setSending(true);
    try {
      await handleRestart();
    } catch (error) {
      console.error("[Professor Mari] Failed to restart", error);
      toast.error("Professor Mari could not restart her notes.");
    } finally {
      setSending(false);
    }
  }, [handleRestart, isBusy]);

  const handleSubmit = async () => {
    const text = draft.trim();
    if (!text || isBusy) return;

    if (text === "/restart") {
      await runRestart();
      return;
    }

    if (!effectiveConnectionId) {
      toast.error("Set up a language connection before asking Professor Mari.");
      useUIStore.getState().openRightPanel("connections");
      return;
    }

    setSending(true);
    try {
      const chat = await ensureProfessorMariChat(effectiveConnectionId);
      setDraft("");
      setMessages((current) => [...current, createLocalUserMessage(chat.id, text)]);
      const received = await generate({
        chatId: chat.id,
        connectionId: effectiveConnectionId,
        userMessage: text,
      });
      await loadMessages(chat.id);
      if (!received) toast.error("Professor Mari did not receive a reply from the model.");
    } catch (error) {
      console.error("[Professor Mari] Failed to send", error);
      toast.error("Professor Mari could not answer right now.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="w-full max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--card)]/85 shadow-lg shadow-black/10 mt-10 sm:mt-0">
      <div className="grid gap-2.5 p-2 sm:grid-cols-[minmax(0,0.72fr)_minmax(0,1.45fr)] sm:p-2.5">
        <div className="flex min-w-0 flex-col items-center justify-start gap-2 rounded-lg border border-[var(--border)]/70 bg-[var(--secondary)]/25 p-2.5">
          <div className="w-full max-w-[14rem] [--mari-professor-sprite-bottom:5%]">
            <ProfessorMariPixelScene active={isBusy || mariPhase !== null} />
          </div>
          <div className="hidden sm:block w-full">
            <HomeFaq compact />
          </div>
        </div>

        <div className="flex h-[clamp(24rem,70dvh,31rem)] min-w-0 flex-col rounded-lg border border-[var(--border)]/70 bg-[var(--background)]/70">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/60 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-xs font-semibold text-[var(--foreground)]">Ask Professor Mari</span>
            </div>
            <button
              type="button"
              onClick={() => void runRestart()}
              disabled={isBusy}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.6875rem] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
              title="Restart Professor Mari chat"
            >
              <RefreshCw size="0.75rem" />
              /restart
            </button>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-3 text-left">
            {loadingHistory ? (
              <div className="flex h-full items-center justify-center text-xs text-[var(--muted-foreground)]">
                Loading Professor Mari...
              </div>
            ) : (
              displayMessages.map((message, index) => (
                <ConversationMessage
                  key={message.id}
                  message={message}
                  isStreaming={message.id === "__professor_mari_home_stream__"}
                  hideActions
                  hideTimestamp
                  hideUserAvatar
                  noHoverGroup
                  plainUserMessages
                  characterMap={characterMap}
                  chatCharacterIds={[PROFESSOR_MARI_ID]}
                  messageIndex={index + 1}
                  messageOrderIndex={index + 1}
                />
              ))
            )}
          </div>

          <form
            className="border-t border-[var(--border)]/60 p-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <div className="relative flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 shadow-inner shadow-black/10 focus-within:border-[var(--primary)]/50">
              <button
                ref={connectionButtonRef}
                type="button"
                onClick={() => setConnectionMenuOpen((current) => !current)}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all",
                  connectionMenuOpen
                    ? "bg-foreground/10 text-foreground/75"
                    : "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70",
                )}
                title={effectiveConnection?.name ? `Connection: ${effectiveConnection.name}` : "Select connection"}
              >
                <Link size="1rem" />
              </button>

              {connectionMenuOpen && (
                <div
                  ref={connectionMenuRef}
                  className="absolute bottom-full left-2 z-20 mb-2 flex max-h-72 min-w-[15rem] max-w-[20rem] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] text-left shadow-2xl"
                >
                  <div className="border-b border-[var(--border)] px-3 py-2 text-[0.6875rem] font-semibold text-[var(--foreground)]">
                    Connections
                  </div>
                  <div className="overflow-y-auto p-1">
                    {languageConnections.length > 0 ? (
                      languageConnections.map((connection) => {
                        const isActive = effectiveConnectionId === connection.id;
                        return (
                          <button
                            key={connection.id}
                            type="button"
                            onClick={() => handleConnectionChange(connection.id)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--accent)]",
                              isActive && "font-semibold text-[var(--foreground)]",
                            )}
                          >
                            <span className="min-w-0 flex-1 truncate">{connection.name || connection.id}</span>
                            {isActive && <Check size="0.75rem" className="shrink-0 text-[var(--primary)]" />}
                          </button>
                        );
                      })
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setConnectionMenuOpen(false);
                          useUIStore.getState().openRightPanel("connections");
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                      >
                        <Link size="0.875rem" />
                        Add a connection
                      </button>
                    )}
                  </div>
                </div>
              )}

              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSubmit();
                  }
                }}
                rows={1}
                placeholder="Ask Professor Mari..."
                className="max-h-24 min-h-8 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm leading-5 text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
                disabled={isBusy}
              />
              <button
                type="submit"
                disabled={!draft.trim() || isBusy}
                className={cn(
                  "mari-chat-send-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white transition-all duration-200",
                  draft.trim() && !isBusy ? "hover:text-white active:scale-90" : "cursor-not-allowed opacity-40",
                )}
                aria-label="Send to Professor Mari"
                title="Send"
              >
                <Send size="0.9375rem" className={cn(draft.trim() && "translate-x-[1px]")} />
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="sm:hidden px-2 pb-2">
        <HomeFaq compact />
      </div>
    </section>
  );
}
