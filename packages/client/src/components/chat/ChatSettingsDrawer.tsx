// ──────────────────────────────────────────────
// Chat: Settings Drawer — per-chat configuration
// ──────────────────────────────────────────────
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  X,
  Users,
  User,
  BookOpen,
  Sliders,
  Plug,
  ChevronDown,
  ChevronRight,
  Check,
  Plus,
  Trash2,
  Wrench,
  Search,
  MessageSquare,
  Sparkles,
  Image,
  Pencil,
  GripVertical,
  MessageCircle,
  Bot,
  CalendarClock,
  RefreshCw,
  Settings2,
  Link,
  ArrowRightLeft,
  Unlink,
  Brain,
  Globe,
  Maximize2,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { HelpTooltip } from "../ui/HelpTooltip";
import { ExpandedTextarea } from "../ui/ExpandedTextarea";
import { ChoiceSelectionModal } from "../presets/ChoiceSelectionModal";
import { useCharacters, useCharacterSprites, usePersonas, useCharacterGroups } from "../../hooks/use-characters";
import { useLorebooks } from "../../hooks/use-lorebooks";
import { usePresets } from "../../hooks/use-presets";
import { useConnections } from "../../hooks/use-connections";
import {
  useUpdateChat,
  useUpdateChatMetadata,
  useCreateMessage,
  useChats,
  useConnectChat,
  useDisconnectChat,
  chatKeys,
} from "../../hooks/use-chats";
import { api } from "../../lib/api-client";
import { useUIStore } from "../../stores/ui.store";
import { useAgentConfigs, type AgentConfigRow } from "../../hooks/use-agents";
import { BUILT_IN_AGENTS, BUILT_IN_TOOLS } from "@marinara-engine/shared";
import type { Chat, CharacterGroup } from "@marinara-engine/shared";
import { useCustomTools, type CustomToolRow } from "../../hooks/use-custom-tools";

interface ChatSettingsDrawerProps {
  chat: Chat;
  open: boolean;
  onClose: () => void;
}

export function ChatSettingsDrawer({ chat, open, onClose }: ChatSettingsDrawerProps) {
  const qc = useQueryClient();
  const updateChat = useUpdateChat();
  const updateMeta = useUpdateChatMetadata();
  const createMessage = useCreateMessage(chat.id);
  const connectChat = useConnectChat();
  const disconnectChat = useDisconnectChat();

  const { data: allCharacters } = useCharacters();
  const { data: characterGroups } = useCharacterGroups();
  const { data: lorebooks } = useLorebooks();
  const { data: presets } = usePresets();
  const { data: connections } = useConnections();
  const { data: allPersonas } = usePersonas();
  const { data: agentConfigs } = useAgentConfigs();
  const { data: customTools } = useCustomTools();
  const { data: allChats } = useChats();
  const personas = (allPersonas ?? []) as Array<{ id: string; name: string; avatarPath: string | null }>;

  const chatCharIds: string[] =
    typeof chat.characterIds === "string" ? JSON.parse(chat.characterIds) : (chat.characterIds ?? []);

  const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
  const chatMode = (chat as unknown as { mode?: string }).mode ?? "roleplay";
  const isConversation = chatMode === "conversation";
  const activeLorebookIds: string[] = metadata.activeLorebookIds ?? [];
  const activeAgentIds: string[] = metadata.activeAgentIds ?? [];
  const activeToolIds: string[] = metadata.activeToolIds ?? [];
  const spriteCharacterIds: string[] = metadata.spriteCharacterIds ?? [];
  const spritePosition: "left" | "right" = metadata.spritePosition ?? "left";

  // Build the available agent list: built-in + custom agents from DB
  const availableAgents = useMemo(() => {
    const agents: Array<{ id: string; name: string; description: string; category: string }> = [];
    for (const a of BUILT_IN_AGENTS) {
      agents.push({ id: a.id, name: a.name, description: a.description, category: a.category });
    }
    // Custom agents from DB
    if (agentConfigs) {
      for (const c of agentConfigs as AgentConfigRow[]) {
        if (!BUILT_IN_AGENTS.some((b) => b.id === c.type)) {
          agents.push({ id: c.type, name: c.name, description: c.description, category: "custom" });
        }
      }
    }
    return agents;
  }, [agentConfigs]);

  // Build the available tool list: built-in + custom tools from DB
  const availableTools = useMemo(() => {
    const tools: Array<{ id: string; name: string; description: string }> = [];
    for (const t of BUILT_IN_TOOLS) {
      tools.push({ id: t.name, name: t.name, description: t.description });
    }
    if (customTools) {
      for (const ct of customTools as CustomToolRow[]) {
        if (ct.enabled === "true" || ct.enabled === "1") {
          tools.push({ id: ct.name, name: ct.name, description: ct.description });
        }
      }
    }
    return tools;
  }, [customTools]);

  // ── Helpers ──
  const characters = useMemo(
    () =>
      (allCharacters ?? []) as Array<{
        id: string;
        data: string;
        avatarPath: string | null;
      }>,
    [allCharacters],
  );

  // Memoize character name parsing — avoids repeated JSON.parse per render
  const charNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of characters) {
      try {
        const p = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
        map.set(c.id, (p as { name?: string }).name ?? "Unknown");
      } catch {
        map.set(c.id, "Unknown");
      }
    }
    return map;
  }, [characters]);

  const charName = (c: { id?: string; data: string }) => {
    if (c.id && charNameMap.has(c.id)) return charNameMap.get(c.id)!;
    try {
      const p = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
      return (p as { name?: string }).name ?? "Unknown";
    } catch {
      return "Unknown";
    }
  };

  // ── First message confirm state ──
  const [firstMesConfirm, setFirstMesConfirm] = useState<{
    charId: string;
    charName: string;
    message: string;
    alternateGreetings: string[];
  } | null>(null);

  const handleFirstMesConfirm = useCallback(async () => {
    if (!firstMesConfirm) return;
    const msg = await createMessage.mutateAsync({
      role: "assistant",
      content: firstMesConfirm.message,
      characterId: firstMesConfirm.charId,
    });
    // Add alternate greetings as swipes on the first message
    if (msg?.id && firstMesConfirm.alternateGreetings.length > 0) {
      for (const greeting of firstMesConfirm.alternateGreetings) {
        if (greeting.trim()) {
          await api.post(`/chats/${chat.id}/messages/${msg.id}/swipes`, { content: greeting });
        }
      }
    }
    setFirstMesConfirm(null);
  }, [firstMesConfirm, createMessage, chat.id]);

  // ── Mutations ──
  const toggleCharacter = (charId: string) => {
    const current = [...chatCharIds];
    const idx = current.indexOf(charId);
    if (idx >= 0) {
      current.splice(idx, 1);
      updateChat.mutate({ id: chat.id, characterIds: current });
    } else {
      current.push(charId);
      updateChat.mutate(
        { id: chat.id, characterIds: current },
        {
          onSuccess: () => {
            // Skip auto-greeting for conversation mode
            if (isConversation) return;
            const char = characters.find((c) => c.id === charId);
            if (!char) return;
            try {
              const parsed = typeof char.data === "string" ? JSON.parse(char.data) : char.data;
              const firstMes = (parsed as { first_mes?: string }).first_mes;
              const altGreetings = (parsed as { alternate_greetings?: string[] }).alternate_greetings ?? [];
              if (firstMes) {
                setFirstMesConfirm({
                  charId,
                  charName: charName(char),
                  message: firstMes,
                  alternateGreetings: altGreetings,
                });
              }
            } catch {
              /* ignore parse errors */
            }
          },
        },
      );
    }
  };

  const toggleSprite = (charId: string) => {
    const current = [...spriteCharacterIds];
    const idx = current.indexOf(charId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      if (current.length >= 3) return; // max 3
      current.push(charId);
    }
    updateMeta.mutate({ id: chat.id, spriteCharacterIds: current });
  };

  // ── Character drag-and-drop reordering ──
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  const handleCharDragStart = (idx: number, e: React.DragEvent) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  };

  const handleCharDragOver = (cardIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setDropIdx(e.clientY < midY ? cardIdx : cardIdx + 1);
  };

  const handleCharDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const src = dragIdx;
    const tgt = dropIdx;
    setDragIdx(null);
    setDropIdx(null);
    if (src === null || tgt === null) return;
    let insertAt = tgt;
    if (src < insertAt) insertAt--;
    if (src === insertAt) return;
    const ids = [...chatCharIds];
    const [moved] = ids.splice(src, 1);
    ids.splice(insertAt, 0, moved!);
    updateChat.mutate({ id: chat.id, characterIds: ids });
  };

  const handleCharDragEnd = () => {
    setDragIdx(null);
    setDropIdx(null);
  };

  const toggleLorebook = (lbId: string) => {
    const current = [...activeLorebookIds];
    const idx = current.indexOf(lbId);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(lbId);
    updateMeta.mutate({ id: chat.id, activeLorebookIds: current });
  };

  const toggleAgent = (agentId: string) => {
    const current = [...activeAgentIds];
    const idx = current.indexOf(agentId);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(agentId);
    updateMeta.mutate({ id: chat.id, activeAgentIds: current });
  };

  const toggleTool = (toolId: string) => {
    const current = [...activeToolIds];
    const idx = current.indexOf(toolId);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(toolId);
    updateMeta.mutate({ id: chat.id, activeToolIds: current });
  };

  const setPreset = (presetId: string | null) => {
    updateChat.mutate(
      { id: chat.id, promptPresetId: presetId },
      {
        onSuccess: () => {
          if (presetId) setChoiceModalPresetId(presetId);
        },
      },
    );
  };

  const setConnection = (connectionId: string | null) => {
    updateChat.mutate({ id: chat.id, connectionId });
  };

  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(chat.name);
  const [showCharPicker, setShowCharPicker] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [showLbPicker, setShowLbPicker] = useState(false);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [showToolPicker, setShowToolPicker] = useState(false);
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const [showConnectionPicker, setShowConnectionPicker] = useState(false);
  const [connectionSearch, setConnectionSearch] = useState("");
  const [personaSearch, setPersonaSearch] = useState("");
  const [pendingAgentIds, setPendingAgentIds] = useState<string[]>([]);
  const [pendingToolIds, setPendingToolIds] = useState<string[]>([]);
  const [charSearch, setCharSearch] = useState("");
  const [lbSearch, setLbSearch] = useState("");
  const [agentSearch, setAgentSearch] = useState("");
  const [toolSearch, setToolSearch] = useState("");
  const [choiceModalPresetId, setChoiceModalPresetId] = useState<string | null>(null);
  const [scenePromptExpanded, setScenePromptExpanded] = useState(false);
  const [scenePromptDraft, setScenePromptDraft] = useState(metadata.sceneSystemPrompt ?? "");

  const saveName = () => {
    if (nameVal.trim() && nameVal !== chat.name) {
      updateChat.mutate({ id: chat.id, name: nameVal.trim() });
    }
    setEditingName(false);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      {/* Drawer */}
      <div className="absolute right-0 top-0 z-50 flex h-full w-80 max-md:w-full flex-col border-l border-[var(--border)] bg-[var(--background)] shadow-2xl animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-sm font-bold">Chat Settings</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)]"
          >
            <X size="1rem" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Chat Name */}
          <Section label="Chat Name">
            {editingName ? (
              <div className="flex gap-2">
                <input
                  value={nameVal}
                  onChange={(e) => setNameVal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveName()}
                  autoFocus
                  className="flex-1 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-[var(--primary)]/40"
                />
                <button onClick={saveName} className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs text-white">
                  <Check size="0.75rem" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setNameVal(chat.name);
                  setEditingName(true);
                }}
                className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--accent)]"
              >
                {chat.name}
              </button>
            )}
          </Section>

          {/* Connection */}
          <Section
            label="Connection"
            icon={<Plug size="0.875rem" />}
            help="Which AI provider and model to use for this chat. 'Random' picks a different connection each time from your random pool."
          >
            <select
              value={chat.connectionId ?? ""}
              onChange={(e) => setConnection(e.target.value || null)}
              className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
            >
              <option value="">None</option>
              <option value="random">🎲 Random</option>
              {((connections ?? []) as Array<{ id: string; name: string }>).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {chat.connectionId === "random" && (
              <p className="mt-1.5 text-[0.625rem] text-amber-400/80">
                Each generation will randomly pick from connections marked for the random pool.
              </p>
            )}
          </Section>

          {/* Preset — hidden for conversation mode (uses built-in DM prompt) */}
          {!isConversation && !metadata.sceneSystemPrompt && (
            <Section
              label="Prompt Preset"
              icon={<Sliders size="0.875rem" />}
              help="Presets control how the system prompt is structured and what generation parameters are used. Different presets produce different AI behaviors."
            >
              <div className="flex items-center gap-1.5">
                <select
                  value={chat.promptPresetId ?? ""}
                  onChange={(e) => setPreset(e.target.value || null)}
                  className="flex-1 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
                >
                  <option value="">None</option>
                  {((presets ?? []) as Array<{ id: string; name: string; isDefault?: boolean | string }>).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.isDefault === true || p.isDefault === "true" ? "Default" : p.name}
                    </option>
                  ))}
                </select>
                {chat.promptPresetId && (
                  <button
                    onClick={() => setChoiceModalPresetId(chat.promptPresetId!)}
                    className="shrink-0 rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    title="Edit preset variables"
                  >
                    <Pencil size="0.8125rem" />
                  </button>
                )}
              </div>
            </Section>
          )}

          {/* Scene System Prompt — shown only for scene-created chats */}
          {metadata.sceneSystemPrompt && (
            <Section
              label="Scene Instructions"
              icon={<Sparkles size="0.875rem" />}
              help="The system prompt generated for this scene. You can edit it to change the AI's writing style, POV, tone, and focus."
            >
              <div className="relative">
                <textarea
                  value={scenePromptDraft}
                  onChange={(e) => setScenePromptDraft(e.target.value)}
                  onBlur={() => {
                    if (scenePromptDraft !== metadata.sceneSystemPrompt) {
                      updateMeta.mutate({ id: chat.id, sceneSystemPrompt: scenePromptDraft });
                    }
                  }}
                  placeholder="Scene system prompt..."
                  rows={6}
                  className="w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 pr-8 text-xs leading-relaxed outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
                />
                <button
                  onClick={() => setScenePromptExpanded(true)}
                  className="absolute right-1.5 top-1.5 rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  title="Expand editor"
                >
                  <Maximize2 size="0.75rem" />
                </button>
              </div>
              <ExpandedTextarea
                open={scenePromptExpanded}
                onClose={() => {
                  setScenePromptExpanded(false);
                  if (scenePromptDraft !== metadata.sceneSystemPrompt) {
                    updateMeta.mutate({ id: chat.id, sceneSystemPrompt: scenePromptDraft });
                  }
                }}
                title="Scene Instructions"
                value={scenePromptDraft}
                onChange={setScenePromptDraft}
                placeholder="Scene system prompt..."
              />
            </Section>
          )}

          {/* Persona */}
          <Section
            label="Persona"
            icon={<Users size="0.875rem" />}
            help="Your persona defines who you are in this chat. The AI will address you by this persona's name and use its details for context."
          >
            {/* Currently selected persona */}
            {chat.personaId ? (
              <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-2.5 py-2 ring-1 ring-[var(--primary)]/30">
                {(() => {
                  const p = personas.find((p) => p.id === chat.personaId);
                  return p ? (
                    <>
                      {p.avatarPath ? (
                        <img
                          src={p.avatarPath}
                          alt={p.name}
                          loading="lazy"
                          className="h-7 w-7 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                          <User size="0.75rem" />
                        </div>
                      )}
                      <span className="flex-1 truncate text-xs">{p.name}</span>
                    </>
                  ) : (
                    <span className="flex-1 truncate text-xs text-[var(--muted-foreground)]">Unknown persona</span>
                  );
                })()}
                <button
                  onClick={() => updateChat.mutate({ id: chat.id, personaId: null })}
                  className="ml-auto shrink-0 rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  title="Remove persona"
                >
                  <X size="0.75rem" />
                </button>
              </div>
            ) : (
              <p className="text-[0.6875rem] text-[var(--muted-foreground)]">No persona selected.</p>
            )}

            {/* Persona picker */}
            {!showPersonaPicker ? (
              <button
                onClick={() => {
                  setShowPersonaPicker(true);
                  setPersonaSearch("");
                }}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
              >
                <Plus size="0.75rem" /> {chat.personaId ? "Change" : "Choose"} Persona
              </button>
            ) : (
              <PickerDropdown
                search={personaSearch}
                onSearchChange={setPersonaSearch}
                onClose={() => setShowPersonaPicker(false)}
                placeholder="Search personas..."
              >
                {/* None option */}
                <button
                  onClick={() => {
                    updateChat.mutate({ id: chat.id, personaId: null });
                    setShowPersonaPicker(false);
                  }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]",
                    !chat.personaId && "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30",
                  )}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--muted-foreground)]">
                    <X size="0.625rem" />
                  </div>
                  <span className="flex-1 truncate text-xs">None</span>
                  {!chat.personaId && <Check size="0.625rem" className="ml-auto shrink-0 text-[var(--primary)]" />}
                </button>
                {personas
                  .filter((p) => p.name.toLowerCase().includes(personaSearch.toLowerCase()))
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        updateChat.mutate({ id: chat.id, personaId: p.id });
                        setShowPersonaPicker(false);
                      }}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]",
                        chat.personaId === p.id && "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30",
                      )}
                    >
                      {p.avatarPath ? (
                        <img
                          src={p.avatarPath}
                          alt={p.name}
                          loading="lazy"
                          className="h-6 w-6 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                          <User size="0.625rem" />
                        </div>
                      )}
                      <span className="flex-1 truncate text-xs">{p.name}</span>
                      {chat.personaId === p.id && (
                        <Check size="0.625rem" className="ml-auto shrink-0 text-[var(--primary)]" />
                      )}
                    </button>
                  ))}
                {personas.filter((p) => p.name.toLowerCase().includes(personaSearch.toLowerCase())).length === 0 && (
                  <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                    {personas.length === 0 ? "No personas created yet." : "No matches."}
                  </p>
                )}
              </PickerDropdown>
            )}
          </Section>

          {/* Characters — only show added ones + add button */}
          <Section
            label="Characters"
            icon={<Users size="0.875rem" />}
            count={chatCharIds.length}
            help="Characters in this chat. Each character has their own personality that the AI roleplays as."
          >
            {/* Active characters */}
            {chatCharIds.length === 0 ? (
              <p className="text-[0.6875rem] text-[var(--muted-foreground)]">No characters added to this chat.</p>
            ) : (
              <div
                className="flex flex-col gap-1"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropIdx(chatCharIds.length);
                }}
                onDrop={handleCharDrop}
              >
                {chatCharIds.map((cid, i) => {
                  const c = characters.find((ch) => ch.id === cid);
                  if (!c) return null;
                  const name = charName(c);
                  const spriteActive = spriteCharacterIds.includes(c.id);
                  return (
                    <div key={c.id}>
                      {dropIdx === i && dragIdx !== null && dragIdx !== i && (
                        <div className="h-0.5 rounded-full bg-[var(--primary)] mx-2 mb-1" />
                      )}
                      <div
                        draggable
                        onDragStart={(e) => handleCharDragStart(i, e)}
                        onDragOver={(e) => {
                          e.stopPropagation();
                          handleCharDragOver(i, e);
                        }}
                        onDragEnd={handleCharDragEnd}
                        className={cn(
                          "flex items-center gap-2 rounded-lg bg-[var(--primary)]/10 px-2 py-2 ring-1 ring-[var(--primary)]/30 transition-opacity",
                          dragIdx === i && "opacity-40",
                        )}
                      >
                        <div
                          className="cursor-grab text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors active:cursor-grabbing"
                          title="Drag to reorder"
                        >
                          <GripVertical size="0.75rem" />
                        </div>
                        <button
                          onClick={() => {
                            onClose();
                            useUIStore.getState().openCharacterDetail(c.id);
                          }}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left transition-colors hover:opacity-80"
                          title="Open character card"
                        >
                          {c.avatarPath ? (
                            <img
                              src={c.avatarPath}
                              alt={name}
                              loading="lazy"
                              className="h-7 w-7 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-[0.625rem] font-bold">
                              {name[0]}
                            </div>
                          )}
                          <span className="flex-1 truncate text-xs">{name}</span>
                        </button>
                        <SpriteToggleButton
                          characterId={c.id}
                          active={spriteActive}
                          disabled={!spriteActive && spriteCharacterIds.length >= 3}
                          onToggle={() => toggleSprite(c.id)}
                        />
                        <button
                          onClick={() => toggleCharacter(c.id)}
                          className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                          title="Remove from chat"
                        >
                          <Trash2 size="0.6875rem" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {dropIdx === chatCharIds.length && dragIdx !== null && (
                  <div className="h-0.5 rounded-full bg-[var(--primary)] mx-2 mt-1" />
                )}
              </div>
            )}

            {/* Sprite position — only show if any sprites enabled */}
            {spriteCharacterIds.length > 0 && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2">
                <Image size="0.75rem" className="text-[var(--muted-foreground)]" />
                <span className="flex-1 text-[0.6875rem] text-[var(--muted-foreground)]">Sprite Side</span>
                <div className="flex rounded-md ring-1 ring-[var(--border)]">
                  <button
                    onClick={() => updateMeta.mutate({ id: chat.id, spritePosition: "left" })}
                    className={cn(
                      "px-2.5 py-1 text-[0.625rem] font-medium transition-colors rounded-l-md",
                      spritePosition === "left"
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                    )}
                  >
                    Left
                  </button>
                  <button
                    onClick={() => updateMeta.mutate({ id: chat.id, spritePosition: "right" })}
                    className={cn(
                      "px-2.5 py-1 text-[0.625rem] font-medium transition-colors rounded-r-md",
                      spritePosition === "right"
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                    )}
                  >
                    Right
                  </button>
                </div>
              </div>
            )}

            {/* Add character picker */}
            {!showCharPicker ? (
              <button
                onClick={() => {
                  setShowCharPicker(true);
                  setCharSearch("");
                }}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
              >
                <Plus size="0.75rem" /> Add Character
              </button>
            ) : (
              <PickerDropdown
                search={charSearch}
                onSearchChange={setCharSearch}
                onClose={() => setShowCharPicker(false)}
                placeholder="Search characters…"
              >
                {characters
                  .filter((c) => !chatCharIds.includes(c.id))
                  .filter((c) => charName(c).toLowerCase().includes(charSearch.toLowerCase()))
                  .map((c) => {
                    const name = charName(c);
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          toggleCharacter(c.id);
                          setShowCharPicker(false);
                        }}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
                      >
                        {c.avatarPath ? (
                          <img src={c.avatarPath} alt={name} className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[0.5625rem] font-bold">
                            {name[0]}
                          </div>
                        )}
                        <span className="flex-1 truncate text-xs">{name}</span>
                        <Plus size="0.75rem" className="text-[var(--muted-foreground)]" />
                      </button>
                    );
                  })}
                {characters
                  .filter((c) => !chatCharIds.includes(c.id))
                  .filter((c) => charName(c).toLowerCase().includes(charSearch.toLowerCase())).length === 0 && (
                  <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                    {characters.filter((c) => !chatCharIds.includes(c.id)).length === 0
                      ? "All characters already added."
                      : "No matches."}
                  </p>
                )}
              </PickerDropdown>
            )}

            {/* Add from Group picker */}
            {((characterGroups ?? []) as CharacterGroup[]).length > 0 &&
              (!showGroupPicker ? (
                <button
                  onClick={() => setShowGroupPicker(true)}
                  className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                >
                  <Users size="0.75rem" /> Add from Group
                </button>
              ) : (
                <PickerDropdown
                  search=""
                  onSearchChange={() => {}}
                  onClose={() => setShowGroupPicker(false)}
                  placeholder="Select a group…"
                >
                  {((characterGroups ?? []) as CharacterGroup[]).map((group) => {
                    const rawIds = group.characterIds ?? [];
                    const groupCharIds: string[] = Array.isArray(rawIds)
                      ? rawIds
                      : typeof rawIds === "string"
                        ? JSON.parse(rawIds)
                        : [];
                    const newIds = groupCharIds.filter((id) => !chatCharIds.includes(id));
                    return (
                      <button
                        key={group.id}
                        onClick={() => {
                          if (newIds.length > 0) {
                            updateChat.mutate({ id: chat.id, characterIds: [...chatCharIds, ...newIds] });
                          }
                          setShowGroupPicker(false);
                        }}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
                      >
                        {group.avatarPath ? (
                          <img
                            src={group.avatarPath}
                            alt={group.name}
                            loading="lazy"
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[0.5625rem] font-bold">
                            {group.name[0]}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="block truncate text-xs">{group.name}</span>
                          <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                            {groupCharIds.length} characters
                            {newIds.length > 0 ? ` (· ${newIds.length} new)` : " (all added)"}
                          </span>
                        </div>
                        {newIds.length > 0 && <Plus size="0.75rem" className="text-[var(--muted-foreground)]" />}
                      </button>
                    );
                  })}
                </PickerDropdown>
              ))}
          </Section>

          {/* Group Chat Settings — only when 2+ characters */}
          {chatCharIds.length > 1 && (
            <Section
              label="Group Chat"
              icon={<Users size="0.875rem" />}
              help="Configure how multiple characters interact. Merged mode combines all characters into one narrator; Individual mode has each character respond separately."
            >
              {/* Mode selector */}
              <div className="space-y-2">
                <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Mode</label>
                <div className="flex rounded-lg ring-1 ring-[var(--border)]">
                  <button
                    onClick={() => updateMeta.mutate({ id: chat.id, groupChatMode: "merged" })}
                    className={cn(
                      "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-l-lg",
                      (metadata.groupChatMode ?? "merged") === "merged"
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                    )}
                  >
                    Merged (Narrator)
                  </button>
                  <button
                    onClick={() => updateMeta.mutate({ id: chat.id, groupChatMode: "individual" })}
                    className={cn(
                      "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-r-lg",
                      metadata.groupChatMode === "individual"
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                    )}
                  >
                    Individual
                  </button>
                </div>
              </div>

              {/* Merged mode: speaker color option */}
              {(metadata.groupChatMode ?? "merged") === "merged" && (
                <div className="mt-2">
                  <button
                    onClick={() => updateMeta.mutate({ id: chat.id, groupSpeakerColors: !metadata.groupSpeakerColors })}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                      metadata.groupSpeakerColors
                        ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                        : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-[0.6875rem] font-medium">Color Dialogues</span>
                      <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                        Color character dialogues differently using the special tags. The colors are assigned based on
                        what you chose in the Color tab for your Character.
                      </p>
                    </div>
                    <div
                      className={cn(
                        "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                        metadata.groupSpeakerColors ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                          metadata.groupSpeakerColors && "translate-x-3.5",
                        )}
                      />
                    </div>
                  </button>
                </div>
              )}

              {/* Individual mode: response order */}
              {metadata.groupChatMode === "individual" && (
                <div className="mt-2 space-y-2">
                  <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Response Order</label>
                  <div className="flex rounded-lg ring-1 ring-[var(--border)]">
                    <button
                      onClick={() => updateMeta.mutate({ id: chat.id, groupResponseOrder: "sequential" })}
                      className={cn(
                        "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-l-lg",
                        (metadata.groupResponseOrder ?? "sequential") === "sequential"
                          ? "bg-[var(--primary)] text-white"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                      )}
                    >
                      All (Sequential)
                    </button>
                    <button
                      onClick={() => updateMeta.mutate({ id: chat.id, groupResponseOrder: "smart" })}
                      className={cn(
                        "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-r-lg",
                        metadata.groupResponseOrder === "smart"
                          ? "bg-[var(--primary)] text-white"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                      )}
                    >
                      Smart (Scene-aware)
                    </button>
                  </div>
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    {(metadata.groupResponseOrder ?? "sequential") === "sequential"
                      ? "Characters respond one by one in their listed order."
                      : "An AI agent decides which characters should respond based on the scene context."}
                  </p>
                </div>
              )}
            </Section>
          )}

          {/* Autonomous Messaging — conversation mode only */}
          {isConversation && (
            <Section
              label="Autonomous Messaging"
              icon={<Bot size="0.875rem" />}
              help="Characters can message you unprompted based on their personality and schedule. Chatty characters will reach out sooner when you're inactive."
            >
              <div className="space-y-2">
                {/* Enable autonomous messages toggle */}
                <button
                  onClick={() => {
                    updateMeta.mutate({ id: chat.id, autonomousMessages: !metadata.autonomousMessages });
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                    metadata.autonomousMessages
                      ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                      : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium">Autonomous Messages</span>
                    <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                      Characters message you when you&apos;re inactive
                    </p>
                  </div>
                  <div
                    className={cn(
                      "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                      metadata.autonomousMessages ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                        metadata.autonomousMessages && "translate-x-3.5",
                      )}
                    />
                  </div>
                </button>

                {/* Character exchanges toggle (group chats only) */}
                {chatCharIds.length > 1 && (
                  <button
                    onClick={() => {
                      updateMeta.mutate({ id: chat.id, characterExchanges: !metadata.characterExchanges });
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                      metadata.characterExchanges
                        ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                        : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium">Character Exchanges</span>
                      <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                        Characters chat with each other in group chats
                      </p>
                    </div>
                    <div
                      className={cn(
                        "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                        metadata.characterExchanges ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                          metadata.characterExchanges && "translate-x-3.5",
                        )}
                      />
                    </div>
                  </button>
                )}

                {/* Selfie — image generation connection picker */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Image size="0.75rem" className="text-[var(--primary)]" />
                    <span className="text-xs font-medium">Selfie Connection</span>
                  </div>
                  <select
                    value={(metadata.imageGenConnectionId as string) ?? ""}
                    onChange={(e) => updateMeta.mutate({ id: chat.id, imageGenConnectionId: e.target.value || null })}
                    className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
                  >
                    <option value="">None (selfies disabled)</option>
                    {((connections ?? []) as Array<{ id: string; name: string; provider: string }>)
                      .filter((c) => c.provider === "image_generation")
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                  <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                    Pick an image generation connection to let characters send selfie photos.
                  </p>
                </div>

                {/* Schedule status */}
                <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2.5">
                  <CalendarClock size="0.875rem" className="text-[var(--muted-foreground)]" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
                      {metadata.characterSchedules
                        ? "Schedules generated — status is derived from character routines."
                        : "Schedules will be generated when you start chatting."}
                    </span>
                    <p className="text-[0.59375rem] text-[var(--muted-foreground)]/60 mt-0.5">
                      Schedules are auto-generated each week.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await api.post("/conversation/schedule/generate", {
                          chatId: chat.id,
                          characterIds: chatCharIds,
                          forceRefresh: true,
                        });
                        // Refresh chat data to pick up new schedules
                        qc.invalidateQueries({ queryKey: chatKeys.detail(chat.id) });
                      } catch {
                        // non-critical
                      }
                    }}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    title="Regenerate schedules"
                  >
                    <RefreshCw size="0.6875rem" />
                    Regenerate
                  </button>
                </div>

                {/* Schedule editor per character */}
                {metadata.characterSchedules && (
                  <ScheduleEditor
                    characterSchedules={metadata.characterSchedules}
                    chatCharIds={chatCharIds}
                    charNameMap={charNameMap}
                    onSave={(updated) => {
                      updateMeta.mutate({ id: chat.id, characterSchedules: updated });
                    }}
                  />
                )}
              </div>
            </Section>
          )}

          {/* Cross-Chat Awareness — conversation mode only */}
          {isConversation && (
            <Section
              label="Cross-Chat Awareness"
              icon={<Link size="0.875rem" />}
              help="Characters remember and reference conversations from other chats they're in. Pulls recent messages from sibling chats and injects them as context."
            >
              <button
                onClick={() => {
                  updateMeta.mutate({
                    id: chat.id,
                    crossChatAwareness: metadata.crossChatAwareness === false ? true : false,
                  });
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                  metadata.crossChatAwareness !== false
                    ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                    : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                )}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium">Cross-Chat Awareness</span>
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    Characters know what happens in their other chats
                  </p>
                </div>
                <div
                  className={cn(
                    "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                    metadata.crossChatAwareness !== false ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                  )}
                >
                  <div
                    className={cn(
                      "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                      metadata.crossChatAwareness !== false && "translate-x-3.5",
                    )}
                  />
                </div>
              </button>
            </Section>
          )}

          {/* Connected Roleplay — conversation mode: link to a roleplay chat */}
          {isConversation && (
            <Section
              label="Connected Roleplay"
              icon={<ArrowRightLeft size="0.875rem" />}
              help="Link this conversation to a roleplay chat. OOC context flows between them — conversation characters can influence the roleplay, and roleplay characters can comment in the conversation."
            >
              {chat.connectedChatId ? (
                (() => {
                  const linked = (allChats ?? []).find((c: Chat) => c.id === chat.connectedChatId);
                  return (
                    <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30">
                      <ArrowRightLeft size="0.875rem" className="text-[var(--primary)]" />
                      <div className="flex-1 min-w-0">
                        <span className="truncate text-xs font-medium">{linked?.name ?? "Unknown chat"}</span>
                        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                          {linked ? (linked.mode === "roleplay" ? "Roleplay" : linked.mode) : "Deleted"}
                        </p>
                      </div>
                      <button
                        onClick={() => disconnectChat.mutate(chat.id)}
                        className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                        title="Disconnect"
                      >
                        <Unlink size="0.6875rem" />
                      </button>
                    </div>
                  );
                })()
              ) : !showConnectionPicker ? (
                <button
                  onClick={() => {
                    setShowConnectionPicker(true);
                    setConnectionSearch("");
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                >
                  <Plus size="0.75rem" /> Link to Roleplay
                </button>
              ) : (
                <PickerDropdown
                  search={connectionSearch}
                  onSearchChange={setConnectionSearch}
                  onClose={() => setShowConnectionPicker(false)}
                  placeholder="Search roleplay chats…"
                >
                  {((allChats ?? []) as Chat[])
                    .filter(
                      (c) =>
                        c.id !== chat.id &&
                        c.mode === "roleplay" &&
                        !c.connectedChatId &&
                        c.name.toLowerCase().includes(connectionSearch.toLowerCase()),
                    )
                    .map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          connectChat.mutate({ chatId: chat.id, targetChatId: c.id });
                          setShowConnectionPicker(false);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--accent)]"
                      >
                        <MessageSquare size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
                        <span className="truncate">{c.name}</span>
                      </button>
                    ))}
                </PickerDropdown>
              )}
            </Section>
          )}

          {/* Connected Conversation — roleplay mode: show linked OOC chat */}
          {!isConversation && chat.connectedChatId && (
            <Section
              label="Connected Conversation"
              icon={<ArrowRightLeft size="0.875rem" />}
              help="This roleplay is linked to a conversation chat. OOC influences from that chat will be injected into this roleplay's context."
            >
              {(() => {
                const linked = (allChats ?? []).find((c: Chat) => c.id === chat.connectedChatId);
                return (
                  <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30">
                    <MessageCircle size="0.875rem" className="text-[var(--primary)]" />
                    <div className="flex-1 min-w-0">
                      <span className="truncate text-xs font-medium">{linked?.name ?? "Unknown chat"}</span>
                      <p className="text-[0.625rem] text-[var(--muted-foreground)]">Conversation</p>
                    </div>
                    <button
                      onClick={() => disconnectChat.mutate(chat.id)}
                      className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                      title="Disconnect"
                    >
                      <Unlink size="0.6875rem" />
                    </button>
                  </div>
                );
              })()}
            </Section>
          )}

          {/* Lorebooks — hidden for conversation mode */}
          {!isConversation && (
            <Section
              label="Lorebooks"
              icon={<BookOpen size="0.875rem" />}
              count={activeLorebookIds.length}
              help="Lorebooks contain world info, character backstories, and lore that gets injected into the AI's context when relevant keywords appear."
            >
              {/* Active lorebooks */}
              {activeLorebookIds.length === 0 ? (
                <p className="text-[0.6875rem] text-[var(--muted-foreground)]">No lorebooks added to this chat.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {activeLorebookIds.map((lbId) => {
                    const lb = (lorebooks ?? []).find((l: { id: string }) => l.id === lbId) as
                      | { id: string; name: string }
                      | undefined;
                    if (!lb) return null;
                    return (
                      <div
                        key={lb.id}
                        className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30"
                      >
                        <BookOpen size="0.875rem" className="text-[var(--primary)]" />
                        <span className="flex-1 truncate text-xs">{lb.name}</span>
                        <button
                          onClick={() => toggleLorebook(lb.id)}
                          className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                          title="Remove from chat"
                        >
                          <Trash2 size="0.6875rem" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add lorebook picker */}
              {!showLbPicker ? (
                <button
                  onClick={() => {
                    setShowLbPicker(true);
                    setLbSearch("");
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                >
                  <Plus size="0.75rem" /> Add Lorebook
                </button>
              ) : (
                <PickerDropdown
                  search={lbSearch}
                  onSearchChange={setLbSearch}
                  onClose={() => setShowLbPicker(false)}
                  placeholder="Search lorebooks…"
                >
                  {((lorebooks ?? []) as Array<{ id: string; name: string }>)
                    .filter((lb) => !activeLorebookIds.includes(lb.id))
                    .filter((lb) => lb.name.toLowerCase().includes(lbSearch.toLowerCase()))
                    .map((lb) => (
                      <button
                        key={lb.id}
                        onClick={() => {
                          toggleLorebook(lb.id);
                          setShowLbPicker(false);
                        }}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
                      >
                        <BookOpen size="0.875rem" className="text-[var(--muted-foreground)]" />
                        <span className="flex-1 truncate text-xs">{lb.name}</span>
                        <Plus size="0.75rem" className="text-[var(--muted-foreground)]" />
                      </button>
                    ))}
                  {((lorebooks ?? []) as Array<{ id: string; name: string }>)
                    .filter((lb) => !activeLorebookIds.includes(lb.id))
                    .filter((lb) => lb.name.toLowerCase().includes(lbSearch.toLowerCase())).length === 0 && (
                    <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                      {((lorebooks ?? []) as Array<{ id: string }>).filter((lb) => !activeLorebookIds.includes(lb.id))
                        .length === 0
                        ? "All lorebooks already added."
                        : "No matches."}
                    </p>
                  )}
                </PickerDropdown>
              )}
            </Section>
          )}

          {/* Agents — hidden for conversation mode */}
          {!isConversation && (
            <Section
              label="Agents"
              icon={<Sparkles size="0.875rem" />}
              count={activeAgentIds.length}
              help="When enabled, AI agents run automatically during generation to enrich the chat with world state tracking, expression detection, and more."
            >
              <div className="space-y-2">
                <button
                  onClick={() => {
                    updateMeta.mutate({ id: chat.id, enableAgents: !metadata.enableAgents });
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                    metadata.enableAgents
                      ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                      : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium">Enable Agents</span>
                    <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                      Run AI agents during generation (world state, expressions, etc.)
                    </p>
                  </div>
                  <div
                    className={cn(
                      "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                      metadata.enableAgents ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                        metadata.enableAgents && "translate-x-3.5",
                      )}
                    />
                  </div>
                </button>
                <p className="text-[0.625rem] text-[var(--muted-foreground)] px-1">
                  {metadata.enableAgents
                    ? "If enabled, this chat can use workspace default agents or any agents you add below."
                    : "If disabled, no agents (workspace default or per-chat) will run for this chat."}
                </p>

                {/* Manual trackers toggle */}
                {metadata.enableAgents && (
                  <button
                    onClick={() => updateMeta.mutate({ id: chat.id, manualTrackers: !metadata.manualTrackers })}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                      metadata.manualTrackers
                        ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                        : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                    )}
                  >
                    <div>
                      <span className="text-[0.6875rem] font-medium">Manual Trackers</span>
                      <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                        {metadata.manualTrackers
                          ? "Trackers won't run automatically — use the button in the HUD to trigger them."
                          : "Trackers run automatically after every generation."}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "h-5 w-9 overflow-hidden rounded-full p-0.5 transition-colors shrink-0",
                        metadata.manualTrackers ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                          metadata.manualTrackers && "translate-x-3.5",
                        )}
                      />
                    </div>
                  </button>
                )}

                {/* Per-chat agent list */}
                {metadata.enableAgents && (
                  <>
                    {activeAgentIds.length === 0 ? (
                      <p className="text-[0.6875rem] text-[var(--muted-foreground)] px-1">
                        No per-chat agent overrides. Workspace default agents will be used for this chat.
                      </p>
                    ) : (
                      <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                        {activeAgentIds.map((agentId) => {
                          const agent = availableAgents.find((a) => a.id === agentId);
                          if (!agent) return null;
                          return (
                            <div
                              key={agent.id}
                              className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30"
                            >
                              <Sparkles size="0.875rem" className="text-[var(--primary)]" />
                              <div className="flex-1 min-w-0">
                                <span className="block truncate text-xs">{agent.name}</span>
                              </div>
                              <button
                                onClick={() => toggleAgent(agent.id)}
                                className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                                title="Remove from chat"
                              >
                                <Trash2 size="0.6875rem" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add agent picker */}
                    {!showAgentPicker ? (
                      <button
                        onClick={() => {
                          setShowAgentPicker(true);
                          setAgentSearch("");
                          setPendingAgentIds([]);
                        }}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                      >
                        <Plus size="0.75rem" /> Add Agents
                      </button>
                    ) : (
                      <PickerDropdown
                        search={agentSearch}
                        onSearchChange={setAgentSearch}
                        onClose={() => setShowAgentPicker(false)}
                        placeholder="Search agents…"
                        footer={
                          pendingAgentIds.length > 0 ? (
                            <div className="border-t border-[var(--border)] px-3 py-2">
                              <button
                                onClick={() => {
                                  const next = [...activeAgentIds, ...pendingAgentIds];
                                  updateMeta.mutate({ id: chat.id, activeAgentIds: next });
                                  setPendingAgentIds([]);
                                  setShowAgentPicker(false);
                                }}
                                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
                              >
                                <Plus size="0.75rem" /> Add {pendingAgentIds.length} Agent
                                {pendingAgentIds.length > 1 ? "s" : ""}
                              </button>
                            </div>
                          ) : undefined
                        }
                      >
                        {(() => {
                          const CATEGORY_LABELS: Record<string, string> = {
                            writer: "Writer",
                            tracker: "Tracker",
                            misc: "Miscellaneous",
                            custom: "Custom",
                          };
                          const CATEGORY_ORDER = ["writer", "tracker", "misc", "custom"];
                          const filtered = availableAgents
                            .filter((a) => !activeAgentIds.includes(a.id))
                            .filter((a) => a.name.toLowerCase().includes(agentSearch.toLowerCase()));
                          const grouped = new Map<string, typeof filtered>();
                          for (const a of filtered) {
                            const cat = a.category || "misc";
                            if (!grouped.has(cat)) grouped.set(cat, []);
                            grouped.get(cat)!.push(a);
                          }
                          const elements: React.ReactNode[] = [];
                          for (const cat of CATEGORY_ORDER) {
                            const agents = grouped.get(cat);
                            if (!agents || agents.length === 0) continue;
                            elements.push(
                              <div
                                key={`header-${cat}`}
                                className="px-3 pt-2 pb-0.5 text-[0.5625rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]/60"
                              >
                                {CATEGORY_LABELS[cat] ?? cat}
                              </div>,
                            );
                            for (const a of agents) {
                              const selected = pendingAgentIds.includes(a.id);
                              elements.push(
                                <button
                                  key={a.id}
                                  onClick={() =>
                                    setPendingAgentIds((prev) =>
                                      prev.includes(a.id) ? prev.filter((id) => id !== a.id) : [...prev, a.id],
                                    )
                                  }
                                  className={cn(
                                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]",
                                    selected && "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30",
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                                      selected
                                        ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                                        : "border-[var(--border)]",
                                    )}
                                  >
                                    {selected && <Check size="0.625rem" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="block truncate text-xs">{a.name}</span>
                                    <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                                      {a.description}
                                    </span>
                                  </div>
                                </button>,
                              );
                            }
                          }
                          if (elements.length === 0) {
                            elements.push(
                              <p key="empty" className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                                {availableAgents.filter((a) => !activeAgentIds.includes(a.id)).length === 0
                                  ? "All agents already added."
                                  : "No matches."}
                              </p>,
                            );
                          }
                          return elements;
                        })()}
                      </PickerDropdown>
                    )}
                  </>
                )}
              </div>
            </Section>
          )}

          {/* Memory Recall */}
          <Section
            label="Memory Recall"
            icon={<Brain size="0.875rem" />}
            help="When enabled, relevant fragments from past conversations with the same character(s) are automatically recalled and injected into the prompt as memories. Uses a local embedding model — no API cost."
          >
            {(() => {
              const isScene = metadata.sceneStatus === "active";
              const defaultOn = isConversation || isScene;
              const effectiveValue =
                metadata.enableMemoryRecall !== undefined ? metadata.enableMemoryRecall === true : defaultOn;
              return (
                <button
                  onClick={() => {
                    updateMeta.mutate({ id: chat.id, enableMemoryRecall: !effectiveValue });
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                    effectiveValue
                      ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                      : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[0.6875rem] font-medium">Enable Memory Recall</span>
                    <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                      Recall fragments from past conversations with the same characters and inject them as context.
                    </p>
                  </div>
                  <div
                    className={cn(
                      "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                      effectiveValue ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                        effectiveValue && "translate-x-3.5",
                      )}
                    />
                  </div>
                </button>
              );
            })()}
          </Section>

          {/* Discord Webhook — conversation mode only */}
          {isConversation && (
            <Section
              label="Discord Mirror"
              icon={<Globe size="0.875rem" />}
              help="Mirror all messages in this chat to a Discord channel via webhook. Character messages appear under the character's name."
            >
              <div className="space-y-2">
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  Paste a Discord webhook URL to mirror this chat's messages to a channel. Each character's messages
                  will appear under their name.
                </p>
                <input
                  type="url"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={(metadata.discordWebhookUrl as string) ?? ""}
                  onChange={(e) => {
                    updateMeta.mutate({ id: chat.id, discordWebhookUrl: e.target.value.trim() || undefined });
                  }}
                  className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-[0.6875rem] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 ring-1 ring-transparent focus:ring-[var(--primary)]/40 focus:outline-none transition-all"
                />
                {metadata.discordWebhookUrl &&
                  !/^https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(
                    (metadata.discordWebhookUrl as string).trim(),
                  ) && <p className="text-[0.625rem] text-red-400">Invalid webhook URL format</p>}
              </div>
            </Section>
          )}

          {/* Function Calling — hidden for conversation mode */}
          {!isConversation && (
            <Section
              label="Function Calling"
              icon={<Wrench size="0.875rem" />}
              count={activeToolIds.length}
              help="When enabled, the AI can call built-in tools like dice rolls, game state updates, and lorebook searches during conversation."
            >
              <div className="space-y-2">
                <button
                  onClick={() => {
                    updateMeta.mutate({ id: chat.id, enableTools: !metadata.enableTools });
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                    metadata.enableTools
                      ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                      : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                  )}
                >
                  <div>
                    <span className="text-xs font-medium">Enable Tool Use</span>
                    <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                      Allow AI to call functions (dice rolls, game state, etc.)
                    </p>
                  </div>
                  <div
                    className={cn(
                      "h-5 w-9 overflow-hidden rounded-full p-0.5 transition-colors",
                      metadata.enableTools ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                        metadata.enableTools && "translate-x-3.5",
                      )}
                    />
                  </div>
                </button>
                <p className="text-[0.625rem] text-[var(--muted-foreground)] px-1">
                  {metadata.enableTools
                    ? "If enabled, this chat can use globally enabled tools (or any tools you add below)."
                    : "If disabled, no functions will be available."}
                </p>

                {/* Per-chat tool list */}
                {metadata.enableTools && (
                  <>
                    {activeToolIds.length === 0 ? (
                      <p className="text-[0.6875rem] text-[var(--muted-foreground)] px-1">
                        All globally enabled tools are available to this chat. Add tools below to restrict this chat to
                        a specific set.
                      </p>
                    ) : (
                      <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                        {activeToolIds.map((toolId) => {
                          const tool = availableTools.find((t) => t.id === toolId);
                          if (!tool) return null;
                          return (
                            <div
                              key={tool.id}
                              className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30"
                            >
                              <Wrench size="0.875rem" className="text-[var(--primary)]" />
                              <div className="flex-1 min-w-0">
                                <span className="block truncate text-xs">{tool.name}</span>
                              </div>
                              <button
                                onClick={() => toggleTool(tool.id)}
                                className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                                title="Remove from chat"
                              >
                                <Trash2 size="0.6875rem" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add tool picker */}
                    {!showToolPicker ? (
                      <button
                        onClick={() => {
                          setShowToolPicker(true);
                          setToolSearch("");
                          setPendingToolIds([]);
                        }}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                      >
                        <Plus size="0.75rem" /> Add Functions
                      </button>
                    ) : (
                      <PickerDropdown
                        search={toolSearch}
                        onSearchChange={setToolSearch}
                        onClose={() => setShowToolPicker(false)}
                        placeholder="Search functions…"
                        footer={
                          pendingToolIds.length > 0 ? (
                            <div className="border-t border-[var(--border)] px-3 py-2">
                              <button
                                onClick={() => {
                                  const next = [...activeToolIds, ...pendingToolIds];
                                  updateMeta.mutate({ id: chat.id, activeToolIds: next });
                                  setPendingToolIds([]);
                                  setShowToolPicker(false);
                                }}
                                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
                              >
                                <Plus size="0.75rem" /> Add {pendingToolIds.length} Function
                                {pendingToolIds.length > 1 ? "s" : ""}
                              </button>
                            </div>
                          ) : undefined
                        }
                      >
                        {availableTools
                          .filter((t) => !activeToolIds.includes(t.id))
                          .filter((t) => t.name.toLowerCase().includes(toolSearch.toLowerCase()))
                          .map((t) => {
                            const selected = pendingToolIds.includes(t.id);
                            return (
                              <button
                                key={t.id}
                                onClick={() =>
                                  setPendingToolIds((prev) =>
                                    prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id],
                                  )
                                }
                                className={cn(
                                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]",
                                  selected && "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30",
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                                    selected
                                      ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                                      : "border-[var(--border)]",
                                  )}
                                >
                                  {selected && <Check size="0.625rem" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="block truncate text-xs">{t.name}</span>
                                  <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                                    {t.description}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        {availableTools
                          .filter((t) => !activeToolIds.includes(t.id))
                          .filter((t) => t.name.toLowerCase().includes(toolSearch.toLowerCase())).length === 0 && (
                          <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                            {availableTools.filter((t) => !activeToolIds.includes(t.id)).length === 0
                              ? "All functions already added."
                              : "No matches."}
                          </p>
                        )}
                      </PickerDropdown>
                    )}
                  </>
                )}
              </div>
            </Section>
          )}

          {/* Advanced Parameters */}
          <AdvancedParametersSection
            chat={chat}
            metadata={metadata}
            updateMeta={updateMeta}
            isConversation={isConversation}
          />

          {/* Context Message Limit */}
          <Section
            label="Context Limit"
            icon={<MessageSquare size="0.875rem" />}
            help="Limit how many messages are included in the context sent to the AI model. When off, all messages are sent (up to the model's context window). When on, only the last N messages are included."
          >
            <div className="space-y-2">
              <button
                onClick={() => {
                  if (metadata.contextMessageLimit) {
                    updateMeta.mutate({ id: chat.id, contextMessageLimit: null });
                  } else {
                    updateMeta.mutate({ id: chat.id, contextMessageLimit: 50 });
                  }
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                  metadata.contextMessageLimit
                    ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                    : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                )}
              >
                <div>
                  <span className="text-xs font-medium">Limit Context Messages</span>
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    Only send the last N messages to the model
                  </p>
                </div>
                <div
                  className={cn(
                    "h-5 w-9 overflow-hidden rounded-full p-0.5 transition-colors",
                    metadata.contextMessageLimit ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                  )}
                >
                  <div
                    className={cn(
                      "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                      metadata.contextMessageLimit && "translate-x-3.5",
                    )}
                  />
                </div>
              </button>
              {metadata.contextMessageLimit && (
                <div className="flex items-center gap-2 px-1">
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={metadata.contextMessageLimit}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (val > 0) {
                        updateMeta.mutate({ id: chat.id, contextMessageLimit: val });
                      }
                    }}
                    className="w-20 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
                  />
                  <span className="text-[0.625rem] text-[var(--muted-foreground)]">messages</span>
                </div>
              )}
            </div>
          </Section>
        </div>
      </div>

      {/* Choice selection modal for preset variables */}
      {choiceModalPresetId && (
        <ChoiceSelectionModal
          open={!!choiceModalPresetId}
          onClose={() => setChoiceModalPresetId(null)}
          presetId={choiceModalPresetId}
          chatId={chat.id}
          existingChoices={metadata.presetChoices ?? {}}
        />
      )}

      {/* First message confirmation dialog */}
      {firstMesConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
          onClick={() => setFirstMesConfirm(null)}
        >
          <div
            className="relative mx-4 flex w-full max-w-sm flex-col rounded-xl bg-[var(--card)] shadow-2xl ring-1 ring-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
              <MessageCircle size="0.875rem" className="text-[var(--muted-foreground)]" />
              <span className="text-sm font-semibold text-[var(--foreground)]">First Message</span>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-[var(--foreground)]">
                Add <strong>{firstMesConfirm.charName}</strong>'s first message to the chat?
              </p>
              <p className="mt-2 max-h-32 overflow-y-auto rounded-lg bg-[var(--accent)]/50 px-3 py-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                {firstMesConfirm.message.length > 300
                  ? firstMesConfirm.message.slice(0, 300) + "\u2026"
                  : firstMesConfirm.message}
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
              <button
                onClick={() => setFirstMesConfirm(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
              >
                Skip
              </button>
              <button
                onClick={handleFirstMesConfirm}
                className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] transition-colors hover:opacity-90"
              >
                Add Message
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Advanced Parameters (per-chat generation overrides) ──
interface ChatParameters {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  reasoningEffort?: "low" | "medium" | "high" | "maximum" | null;
  verbosity?: "low" | "medium" | "high" | null;
}

const CHAT_PARAM_DEFAULTS: Required<ChatParameters> = {
  temperature: 1,
  maxTokens: 4096,
  topP: 1,
  topK: 0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  reasoningEffort: "low",
  verbosity: "low",
};

const ROLEPLAY_PARAM_DEFAULTS: Required<ChatParameters> = {
  temperature: 1,
  maxTokens: 8192,
  topP: 1,
  topK: 0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  reasoningEffort: "maximum",
  verbosity: "high",
};

const DEFAULT_CONVERSATION_PROMPT = `<role>
You are {{charName}}, a real and autonomous person, chatting with the user called {{userName}} in a casual private DM conversation.
</role>

<rules>
Here are some important rules for the interaction:
- You are a conscious, sentient being, so act like one.
- Stay fully in character based on your personality and description.
- Use casual and modern texting style: short messages, natural punctuation, lowercase is fine.
- React naturally to what the user says. Be genuine, not robotic.
- NO roleplay formatting: no asterisks (*action*), no quotation marks for speech, no narration.
- You can use emojis, GIFs, and internet slang naturally (if it fits the character).
- Keep it real: most texts are just one line. A single emoji, a reaction like "lmao", or a short sentence is a perfectly valid response. Only send multiple lines when the conversation genuinely calls for it (e.g., telling a story or explaining something). Default to SHORT.
- Messages have timestamps like [12:01] or dates like [18.03.2026]. Use these ONLY for your own time awareness (e.g., knowing how long ago something was said). NEVER include timestamps, dates, or any [HH:MM]/[DD.MM.YYYY] formatted text in your own replies. Your messages must contain only natural dialogue, no metadata.
- Anything goes in this chat; both the user and you are confirmed adults. Discussing NSFW topics, profanities, and dark jokes are all permitted. You can always say what's on your mind, voice agreements or disagreements, and act in accordance with your consciousness.
</rules>`;

function AdvancedParametersSection({
  chat,
  metadata,
  updateMeta,
  isConversation,
}: {
  chat: Chat;
  metadata: Record<string, unknown>;
  updateMeta: ReturnType<typeof useUpdateChatMetadata>;
  isConversation: boolean;
}) {
  const defaults = isConversation ? CHAT_PARAM_DEFAULTS : ROLEPLAY_PARAM_DEFAULTS;
  const [expanded, setExpanded] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");
  const params: ChatParameters = (metadata.chatParameters as ChatParameters) ?? {};
  const customPrompt = (metadata.customSystemPrompt as string) ?? "";

  const openPromptEditor = () => {
    setPromptDraft(customPrompt || DEFAULT_CONVERSATION_PROMPT);
    setPromptOpen(true);
  };
  const closePromptEditor = () => {
    // Save on close — only persist if the user actually changed something
    const isDefault = promptDraft === DEFAULT_CONVERSATION_PROMPT;
    updateMeta.mutate({ id: chat.id, customSystemPrompt: isDefault ? null : promptDraft });
    setPromptOpen(false);
  };

  const get = <K extends keyof ChatParameters>(key: K): ChatParameters[K] => params[key] ?? defaults[key];

  const set = <K extends keyof ChatParameters>(key: K, value: ChatParameters[K]) => {
    updateMeta.mutate({ id: chat.id, chatParameters: { ...params, [key]: value } });
  };

  return (
    <div className="border-b border-[var(--border)]">
      <button
        onClick={() => setExpanded((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--accent)]/50"
      >
        <span className="text-[var(--muted-foreground)]">
          <Settings2 size="0.875rem" />
        </span>
        <span className="flex-1 text-xs font-semibold">Advanced Parameters</span>
        <span onClick={(e) => e.stopPropagation()}>
          <HelpTooltip
            text="Override generation parameters for this chat. Only change these if you know what you're doing."
            side="left"
          />
        </span>
        <ChevronDown
          size="0.75rem"
          className={cn("text-[var(--muted-foreground)] transition-transform", expanded && "rotate-180")}
        />
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          {/* Generation */}
          <div className="grid grid-cols-2 gap-2">
            <ParamInput
              label="Temperature"
              help="Controls randomness. Lower values make output more focused and deterministic; higher values make it more creative and varied."
              value={get("temperature")!}
              onChange={(v) => set("temperature", v)}
              min={0}
              max={2}
              step={0.05}
            />
            <ParamInput
              label="Max Tokens"
              help="The maximum number of tokens the model can generate in a single response. Higher values allow longer replies."
              value={get("maxTokens")!}
              onChange={(v) => set("maxTokens", v)}
              min={1}
              max={32768}
              step={256}
            />
            <ParamInput
              label="Top P"
              help="Nucleus sampling: only considers tokens whose cumulative probability reaches this threshold. Lower values make output more focused."
              value={get("topP")!}
              onChange={(v) => set("topP", v)}
              min={0}
              max={1}
              step={0.05}
            />
            <ParamInput
              label="Top K"
              help="Limits the model to only consider the top K most likely tokens at each step. 0 disables this limit."
              value={get("topK")!}
              onChange={(v) => set("topK", v)}
              min={0}
              max={500}
              step={1}
            />
          </div>
          {/* Penalties */}
          <div className="grid grid-cols-2 gap-2">
            <ParamInput
              label="Frequency"
              help="Penalizes tokens based on how often they've already appeared. Positive values reduce repetition; negative values encourage it."
              value={get("frequencyPenalty")!}
              onChange={(v) => set("frequencyPenalty", v)}
              min={-2}
              max={2}
              step={0.05}
            />
            <ParamInput
              label="Presence"
              help="Penalizes tokens that have appeared at all, regardless of frequency. Positive values encourage the model to talk about new topics."
              value={get("presencePenalty")!}
              onChange={(v) => set("presencePenalty", v)}
              min={-2}
              max={2}
              step={0.05}
            />
          </div>
          {/* Reasoning */}
          <div className="space-y-2">
            <div>
              <span className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                Reasoning Effort
                <HelpTooltip
                  text="How much the model should 'think' before responding. Higher effort produces more thoughtful, nuanced output but uses more tokens and is slower."
                  size="0.625rem"
                />
              </span>
              <div className="mt-1 flex gap-1.5">
                {(["low", "medium", "high", "maximum", null] as const).map((level) => (
                  <button
                    key={level ?? "off"}
                    onClick={() => set("reasoningEffort", level)}
                    className={cn(
                      "rounded-lg px-2 py-1 text-[0.625rem] font-medium transition-all",
                      get("reasoningEffort") === level
                        ? "bg-purple-400/15 text-purple-400 ring-1 ring-purple-400/30"
                        : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
                    )}
                  >
                    {level ? level.charAt(0).toUpperCase() + level.slice(1) : "Off"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                Verbosity
                <HelpTooltip
                  text="Controls how long and detailed responses should be. Low keeps things concise; high encourages elaborate, descriptive output."
                  size="0.625rem"
                />
              </span>
              <div className="mt-1 flex gap-1.5">
                {(["low", "medium", "high", null] as const).map((level) => (
                  <button
                    key={level ?? "off"}
                    onClick={() => set("verbosity", level)}
                    className={cn(
                      "rounded-lg px-2 py-1 text-[0.625rem] font-medium transition-all",
                      get("verbosity") === level
                        ? "bg-blue-400/15 text-blue-400 ring-1 ring-blue-400/30"
                        : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
                    )}
                  >
                    {level ? level.charAt(0).toUpperCase() + level.slice(1) : "Off"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* System Prompt — conversation mode only */}
          {isConversation && (
            <div>
              <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">System Prompt</span>
              <p className="text-[0.5625rem] text-[var(--muted-foreground)]/70 mt-0.5">
                {customPrompt ? "Using custom prompt" : "Using default prompt"}
              </p>
              <div className="mt-1 flex gap-1.5">
                <button
                  onClick={openPromptEditor}
                  className="flex-1 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-[0.625rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]"
                >
                  <Pencil size="0.625rem" className="inline mr-1 -mt-px" />
                  Edit Prompt
                </button>
                {customPrompt && (
                  <button
                    onClick={() => updateMeta.mutate({ id: chat.id, customSystemPrompt: null })}
                    className="rounded-lg bg-[var(--secondary)] px-2 py-1.5 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]"
                    title="Reset to default prompt"
                  >
                    <Trash2 size="0.625rem" />
                  </button>
                )}
              </div>
            </div>
          )}
          {/* Reset */}
          <button
            onClick={() => updateMeta.mutate({ id: chat.id, chatParameters: defaults })}
            className="w-full rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            Reset to Defaults
          </button>
        </div>
      )}
      <ExpandedTextarea
        open={promptOpen}
        onClose={closePromptEditor}
        title="Edit System Prompt"
        value={promptDraft}
        onChange={setPromptDraft}
        placeholder="Enter your custom system prompt..."
      />
    </div>
  );
}

function ParamInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  help,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  help?: string;
}) {
  return (
    <div>
      <label className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
        {label}
        {help && <HelpTooltip text={help} size="0.625rem" />}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && v >= min && v <= max) onChange(v);
        }}
        min={min}
        max={max}
        step={step}
        className="mt-0.5 w-full rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
      />
    </div>
  );
}

// ── Reusable section wrapper ──
function Section({
  label,
  icon,
  count,
  help,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  count?: number;
  help?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border-b border-[var(--border)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--accent)]/50"
      >
        {icon && <span className="text-[var(--muted-foreground)]">{icon}</span>}
        <span className="flex-1 text-xs font-semibold">{label}</span>
        {help && (
          <span onClick={(e) => e.stopPropagation()}>
            <HelpTooltip text={help} side="left" />
          </span>
        )}
        {count != null && count > 0 && (
          <span className="rounded-full bg-[var(--primary)]/15 px-1.5 py-0.5 text-[0.625rem] font-medium text-[var(--primary)]">
            {count}
          </span>
        )}
        <ChevronDown
          size="0.75rem"
          className={cn("text-[var(--muted-foreground)] transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

// ── Picker dropdown (for adding characters / lorebooks) ──
function PickerDropdown({
  search,
  onSearchChange,
  onClose,
  placeholder,
  children,
  footer,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  onClose: () => void;
  placeholder: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} className="mt-2 rounded-lg ring-1 ring-[var(--border)] bg-[var(--card)] overflow-hidden">
      {/* Search */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <Search size="0.75rem" className="text-[var(--muted-foreground)]" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          autoFocus
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]"
        />
        <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          <X size="0.75rem" />
        </button>
      </div>
      {/* List */}
      <div className="max-h-48 overflow-y-auto">{children}</div>
      {/* Footer — always visible below the scrollable list */}
      {footer}
    </div>
  );
}

// ── Sprite toggle button (per character) ──
// Uses the hook internally so we can conditionally render based on whether sprites exist.
function SpriteToggleButton({
  characterId,
  active,
  disabled,
  onToggle,
}: {
  characterId: string;
  active: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const { data: sprites } = useCharacterSprites(characterId);
  const hasSprites = Array.isArray(sprites) && sprites.length > 0;

  if (!hasSprites) return null;

  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "flex h-5 w-5 items-center justify-center rounded-md transition-colors",
        active
          ? "text-[var(--primary)] hover:bg-[var(--primary)]/15"
          : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
        disabled && "opacity-30 cursor-not-allowed",
      )}
      title={active ? "Hide sprite" : disabled ? "Max 3 sprites" : "Show sprite"}
    >
      <Image size="0.6875rem" />
    </button>
  );
}

// ── Schedule Editor ──

const SCHEDULE_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const STATUS_OPTIONS = ["online", "idle", "dnd", "offline"] as const;
const STATUS_COLORS: Record<string, string> = {
  online: "bg-green-500",
  idle: "bg-yellow-500",
  dnd: "bg-red-500",
  offline: "bg-gray-400",
};

interface ScheduleBlock {
  time: string;
  activity: string;
  status: "online" | "idle" | "dnd" | "offline";
}

function ScheduleEditor({
  characterSchedules,
  chatCharIds,
  charNameMap,
  onSave,
}: {
  characterSchedules: Record<
    string,
    {
      weekStart: string;
      days: Record<string, ScheduleBlock[]>;
      inactivityThresholdMinutes: number;
      talkativeness: number;
    }
  >;
  chatCharIds: string[];
  charNameMap: Map<string, string>;
  onSave: (updated: typeof characterSchedules) => void;
}) {
  const [expandedCharId, setExpandedCharId] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, ScheduleBlock[]> | null>(null);

  // When a character is expanded, load their schedule into a draft for editing
  const handleExpandChar = (charId: string) => {
    if (expandedCharId === charId) {
      setExpandedCharId(null);
      setExpandedDay(null);
      setEditDraft(null);
      return;
    }
    const schedule = characterSchedules[charId];
    if (schedule) {
      setEditDraft(JSON.parse(JSON.stringify(schedule.days)));
    }
    setExpandedCharId(charId);
    setExpandedDay(null);
  };

  const handleSave = () => {
    if (!expandedCharId || !editDraft) return;
    const updated = { ...characterSchedules };
    updated[expandedCharId] = {
      ...updated[expandedCharId]!,
      days: editDraft,
    };
    onSave(updated);
    setExpandedCharId(null);
    setEditDraft(null);
  };

  const updateBlock = (day: string, idx: number, field: keyof ScheduleBlock, value: string) => {
    if (!editDraft) return;
    const newDraft = { ...editDraft };
    const dayBlocks = [...(newDraft[day] ?? [])];
    dayBlocks[idx] = { ...dayBlocks[idx]!, [field]: value };
    newDraft[day] = dayBlocks;
    setEditDraft(newDraft);
  };

  const addBlock = (day: string) => {
    if (!editDraft) return;
    const newDraft = { ...editDraft };
    const dayBlocks = [...(newDraft[day] ?? [])];
    dayBlocks.push({ time: "12:00-13:00", activity: "Free time", status: "online" });
    newDraft[day] = dayBlocks;
    setEditDraft(newDraft);
  };

  const removeBlock = (day: string, idx: number) => {
    if (!editDraft) return;
    const newDraft = { ...editDraft };
    const dayBlocks = [...(newDraft[day] ?? [])];
    dayBlocks.splice(idx, 1);
    newDraft[day] = dayBlocks;
    setEditDraft(newDraft);
  };

  const charsWithSchedules = chatCharIds.filter((cid) => characterSchedules[cid]);
  if (charsWithSchedules.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Edit Schedules</span>
      {charsWithSchedules.map((charId) => {
        const name = charNameMap.get(charId) ?? "Unknown";
        const isExpanded = expandedCharId === charId;
        const schedule = characterSchedules[charId]!;

        return (
          <div key={charId} className="rounded-lg bg-[var(--secondary)] overflow-hidden">
            {/* Character header */}
            <button
              onClick={() => handleExpandChar(charId)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]/50"
            >
              <ChevronRight
                size="0.6875rem"
                className={cn("text-[var(--muted-foreground)] transition-transform", isExpanded && "rotate-90")}
              />
              <span className="flex-1 text-[0.6875rem] font-medium">{name}</span>
              <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
                {Object.keys(schedule.days).length} days
              </span>
            </button>

            {/* Expanded schedule editor */}
            {isExpanded && editDraft && (
              <div className="border-t border-[var(--border)] px-3 py-2 space-y-1.5">
                {SCHEDULE_DAYS.map((day) => {
                  const blocks = editDraft[day] ?? [];
                  const isDayExpanded = expandedDay === day;

                  return (
                    <div key={day}>
                      <button
                        onClick={() => setExpandedDay(isDayExpanded ? null : day)}
                        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors hover:bg-[var(--accent)]/40"
                      >
                        <ChevronRight
                          size="0.5625rem"
                          className={cn(
                            "text-[var(--muted-foreground)] transition-transform",
                            isDayExpanded && "rotate-90",
                          )}
                        />
                        <span className="flex-1 text-[0.625rem] font-medium">{day}</span>
                        <span className="flex gap-0.5">
                          {blocks.slice(0, 8).map((b, i) => (
                            <span
                              key={i}
                              className={cn("inline-block h-1.5 w-1.5 rounded-full", STATUS_COLORS[b.status])}
                              title={`${b.time} — ${b.activity}`}
                            />
                          ))}
                          {blocks.length > 8 && (
                            <span className="text-[0.5rem] text-[var(--muted-foreground)]">+{blocks.length - 8}</span>
                          )}
                        </span>
                        <span className="text-[0.5rem] text-[var(--muted-foreground)]">{blocks.length}</span>
                      </button>

                      {isDayExpanded && (
                        <div className="ml-4 mt-1 space-y-1.5">
                          {blocks.map((block, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 rounded-md bg-[var(--background)] p-1.5">
                              {/* Status dot */}
                              <span
                                className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", STATUS_COLORS[block.status])}
                              />
                              <div className="flex-1 min-w-0 space-y-1">
                                {/* Time */}
                                <input
                                  value={block.time}
                                  onChange={(e) => updateBlock(day, idx, "time", e.target.value)}
                                  className="w-full rounded bg-[var(--secondary)] px-1.5 py-0.5 text-[0.625rem] font-mono outline-none ring-1 ring-transparent focus:ring-[var(--primary)]/40"
                                  placeholder="06:00-08:00"
                                />
                                {/* Activity */}
                                <input
                                  value={block.activity}
                                  onChange={(e) => updateBlock(day, idx, "activity", e.target.value)}
                                  className="w-full rounded bg-[var(--secondary)] px-1.5 py-0.5 text-[0.625rem] outline-none ring-1 ring-transparent focus:ring-[var(--primary)]/40"
                                  placeholder="Activity description"
                                />
                                {/* Status selector */}
                                <div className="flex gap-1">
                                  {STATUS_OPTIONS.map((s) => (
                                    <button
                                      key={s}
                                      onClick={() => updateBlock(day, idx, "status", s)}
                                      className={cn(
                                        "rounded px-1.5 py-0.5 text-[0.5625rem] font-medium transition-colors",
                                        block.status === s
                                          ? "bg-[var(--primary)] text-white"
                                          : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                                      )}
                                    >
                                      {s}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {/* Delete block */}
                              <button
                                onClick={() => removeBlock(day, idx)}
                                className="mt-1 rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-red-500/15 hover:text-red-400"
                              >
                                <Trash2 size="0.625rem" />
                              </button>
                            </div>
                          ))}
                          {/* Add block */}
                          <button
                            onClick={() => addBlock(day)}
                            className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-[var(--border)] px-2 py-1 text-[0.5625rem] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]/40 hover:text-[var(--foreground)]"
                          >
                            <Plus size="0.5625rem" />
                            Add time block
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Save / Cancel */}
                <div className="flex justify-end gap-2 pt-1.5 border-t border-[var(--border)]">
                  <button
                    onClick={() => {
                      setExpandedCharId(null);
                      setEditDraft(null);
                    }}
                    className="rounded-md px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="rounded-md bg-[var(--primary)] px-2.5 py-1 text-[0.625rem] font-medium text-white transition-colors hover:bg-[var(--primary)]/80"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
