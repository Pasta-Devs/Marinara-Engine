// ──────────────────────────────────────────────
// Chat Setup Wizard — step-by-step new chat configuration
// ──────────────────────────────────────────────
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronRight,
  Plug,
  BookOpen,
  Check,
  Plus,
  Search,
  Trash2,
  MessageCircle,
  X,
  Users,
  Loader2,
  Bot,
  UserRound,
  Sparkles,
  Feather,
  RotateCcw,
  Dices,
  FolderOpen,
} from "lucide-react";
import { cn, getAvatarCropStyle, type AvatarCrop } from "../../lib/utils";
import { useConnections } from "../../hooks/use-connections";
import { usePresets, usePresetFull, useDefaultPreset } from "../../hooks/use-presets";
import { useCharacterGroups, useCharacters, usePersonas } from "../../hooks/use-characters";
import { useLorebooks } from "../../hooks/use-lorebooks";
import { useUpdateChat, useUpdateChatMetadata, useCreateMessage, chatKeys } from "../../hooks/use-chats";
import { useChatPresets, useApplyChatPreset } from "../../hooks/use-chat-presets";
import { useAgentConfigs, useCreateAgent, useUpdateAgent, type AgentConfigRow } from "../../hooks/use-agents";
import { useCapabilityAgentRegistry } from "../../hooks/use-capability-packages";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { useSidecarStore } from "../../stores/sidecar.store";
import { api } from "../../lib/api-client";
import { appendLocalSidecarConnectionOption } from "../../lib/connection-filters";
import { getAgentRunIntervalMeta } from "../../lib/agent-cadence";
import { characterMatchesSearch, getCharacterTitle, parseCharacterDisplayData } from "../../lib/character-display";
import { addSilentGreetingSwipes } from "../../lib/message-swipes";
import { ChoiceSelectionModal } from "../presets/ChoiceSelectionModal";
import {
  CONVERSATION_COMMAND_AGENT_IDS,
  CONVERSATION_COMMAND_KEYS,
  DEFAULT_CONVERSATION_PROMPT,
  DEFAULT_AGENT_CONTEXT_SIZE,
  DEFAULT_AGENT_MAX_TOKENS,
  DEFAULT_AGENT_TOOLS,
  MIN_AGENT_MAX_TOKENS,
  getAgentPromptTemplateOptions,
  getDefaultAgentPrompt,
  resolveDefaultAgentPromptTemplateId,
  isAgentManifestAvailableInChatMode,
  isAgentConfigDeleted,
  isAgentHiddenFromChatSettingsPicker,
  isBuiltInAgentRuntimeDisabled,
  isRetiredBuiltInAgentId,
  mergeBuiltInAgentSettings,
  normalizeAgentPhaseForType,
  type AgentPhase,
  type Chat,
  type ChatMode,
  type ChatPreset,
  type CharacterGroup,
  type ConversationCommandKey,
  type Lorebook,
  type Message,
} from "@marinara-engine/shared";
import { useQueryClient } from "@tanstack/react-query";
import {
  CHAT_PARAMETER_DEFAULTS,
  GenerationParametersFields,
  getEditableGenerationParameters,
  parseEditableGenerationParameters,
  ROLEPLAY_PARAMETER_DEFAULTS,
  type EditableGenerationParameters,
} from "../ui/GenerationParametersEditor";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import {
  NEUTRAL_PANEL_HEADER,
  NEUTRAL_PANEL_SCROLL_AREA,
  NEUTRAL_PANEL_SHELL,
  NEUTRAL_PANEL_SUBTITLE,
  NEUTRAL_PANEL_TITLE,
} from "../ui/neutral-surface-styles";
import {
  AgentAddSetupFields,
  applyAgentAddSetupToAgentSettings,
  buildAgentAddMetadataPatch,
  buildInitialAgentAddSetupState,
  type AgentAddSetupState,
  type AgentAddSpriteSubject,
} from "./AgentAddSetupFields";
import { ConversationTimeZoneSelect } from "./ConversationTimeZoneSelect";

// ─── Step definitions ─────────────────────────

interface WizardStep {
  key: string;
  title: string;
  body: string;
}

const ROLEPLAY_STEPS: WizardStep[] = [
  {
    key: "connection",
    title: "Name & Connection",
    body: "Name the roleplay and choose which AI connection should answer.",
  },
  {
    key: "preset",
    title: "Pick a Preset",
    body: "Presets control the system prompt structure and generation parameters. The default preset works great for most chats!",
  },
  {
    key: "participants",
    title: "Persona & Characters",
    body: "Choose who you are and who joins the scene.",
  },
  {
    key: "lorebooks",
    title: "Attach Lorebooks",
    body: "Lorebooks inject world info and lore into the AI's context when relevant keywords appear. Optional but great for rich worlds!",
  },
  {
    key: "agents",
    title: "Enable Agents",
    body: "Optional agents can track details, polish prose, retrieve knowledge, or add special systems to this roleplay. You can add or remove them later as well!",
  },
];

const CONVERSATION_STEPS: WizardStep[] = [
  {
    key: "connection",
    title: "Name & Connection",
    body: "Name the conversation and choose the connection characters should use.",
  },
  {
    key: "prompt",
    title: "Prompt Preset",
    body: "Choose which preset supplies the Conversation mode prompt.",
  },
  {
    key: "participants",
    title: "Persona & Characters",
    body: "Choose your persona and the characters in this private DM or group chat.",
  },
  {
    key: "automation",
    title: "Automation",
    body: "Decide whether characters can message first, use schedules, and send hidden commands.",
  },
];

const CONVERSATION_COMMAND_TOGGLE_OPTIONS: Array<{
  id: ConversationCommandKey;
  label: string;
  description: string;
}> = [
  { id: "schedule_update", label: "Schedule Updates", description: "Let characters change their current status." },
  { id: "cross_post", label: "Cross-Post", description: "Let characters redirect a message into another chat." },
  { id: "selfie", label: "Selfies", description: "Let characters request generated selfies." },
  { id: "memory", label: "Memories", description: "Let characters create memories for other characters." },
  { id: "scene", label: "Scenes", description: "Let characters start an immersive scene." },
  { id: "music", label: "Music", description: "Let characters play songs through the active Music Player." },
  { id: "haptic", label: "Haptics", description: "Let characters control connected haptic devices." },
  { id: "influence", label: "Influence", description: "Let characters influence a connected chat." },
  { id: "note", label: "Notes", description: "Let characters save durable notes for a connected chat." },
  { id: "call", label: "Calls", description: "Let characters ring you for a Conversation call." },
  { id: "react", label: "Reactions", description: "Let characters react to messages with emoji badges." },
  { id: "uno", label: "UNO", description: "Let characters start a game of UNO at the table when you agree to play." },
  { id: "chess", label: "Chess", description: "Let characters accept a one-on-one chess challenge at the table." },
  {
    id: "poker",
    label: "Poker",
    description: "Let characters sit down for a game of Texas Hold'em poker at the table.",
  },
  { id: "eightball", label: "8-Ball Pool", description: "Let characters rack up a game of 8-ball pool at the table." },
  {
    id: "tic_tac_toe",
    label: "Tic-Tac-Toe",
    description: "Let characters accept a one-on-one tic-tac-toe challenge at the table.",
  },
  {
    id: "rock_paper_scissors",
    label: "Rock-Paper-Scissors",
    description: "Let characters accept a one-on-one rock-paper-scissors match at the table.",
  },
];

// ─── Main component ───────────────────────────

interface ChatSetupWizardProps {
  chat: Chat;
  onFinish: () => void;
}

interface PersonaDisplayInfo {
  id?: string;
  name: string;
  avatarPath?: string | null;
  comment?: string | null;
}

type PersonaSetupOption = PersonaDisplayInfo & {
  id: string;
  avatarPath: string | null;
};

type ConnectionSetupOption = {
  id: string;
  name: string;
  provider?: string;
  defaultParameters?: unknown;
};

function parseCharacterFolderIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  }
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

type AvailableAgent = {
  id: string;
  name: string;
  description: string;
  category: string;
  phase: AgentPhase;
  builtIn: boolean;
  runtimeDisabled?: boolean;
  execution?: "pipeline" | "feature";
};

type AgentAddPreview = {
  agent: AvailableAgent;
  config: AgentConfigRow | null;
  contextSize: number;
  maxTokens: number;
  runInterval: number | null;
  setup: AgentAddSetupState;
};

const WIZARD_PANEL_CLASS = cn(
  NEUTRAL_PANEL_SHELL,
  "pointer-events-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden sm:max-h-[min(90dvh,44rem)]",
);

const WIZARD_FIELD_LABEL = "text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--muted-foreground)]";
const WIZARD_INPUT_CLASS =
  "w-full min-w-0 truncate rounded-lg bg-[var(--secondary)] px-3 py-2 pr-8 text-xs text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] transition-shadow placeholder:text-[var(--muted-foreground)] focus:ring-[var(--primary)]/40";
const WIZARD_NUMBER_INPUT_CLASS =
  "w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] outline-none ring-1 ring-transparent transition-shadow placeholder:text-[var(--muted-foreground)] focus:ring-[var(--primary)]/40";
const WIZARD_GHOST_BUTTON_CLASS =
  "rounded-lg px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]";
const WIZARD_PRIMARY_BUTTON_CLASS =
  "flex items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-1.5 text-xs font-medium text-[var(--primary-foreground)] shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50";
const WIZARD_SECONDARY_BUTTON_CLASS =
  "flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-all hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50";
const CHARACTER_PICKER_PAGE_SIZE = 50;

function readChatMetadata(chat: Chat): Record<string, unknown> {
  const raw = (chat as unknown as { metadata?: string | Record<string, unknown> }).metadata;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return raw ?? {};
}

function readChatActiveAgentIds(chat: Chat): string[] {
  const metadata = readChatMetadata(chat);
  const activeIds = metadata.activeAgentIds;
  return Array.isArray(activeIds) ? activeIds.filter((id): id is string => typeof id === "string") : [];
}

function readConversationCommandToggles(value: unknown): Partial<Record<ConversationCommandKey, boolean>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const toggles: Partial<Record<ConversationCommandKey, boolean>> = {};
  for (const key of CONVERSATION_COMMAND_KEYS) {
    if (typeof source[key] === "boolean") toggles[key] = source[key] as boolean;
  }
  return toggles;
}

function isConversationCommandToggleEnabled(
  toggles: Partial<Record<ConversationCommandKey, boolean>>,
  command: ConversationCommandKey,
): boolean {
  return toggles[command] !== false;
}

function normalizePositiveInteger(value: unknown, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(value)));
}

function normalizeAgentMaxTokens(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_AGENT_MAX_TOKENS;
  return Math.max(MIN_AGENT_MAX_TOKENS, Math.trunc(value));
}

function normalizeAgentMaxTokensInputValue(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return MIN_AGENT_MAX_TOKENS;
  return Math.max(MIN_AGENT_MAX_TOKENS, Math.trunc(value));
}

function WizardBackdrop({ onClose }: { onClose: () => void }) {
  return <div className="absolute inset-0 z-40 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />;
}

function SetupWizardShell({
  title,
  steps,
  step,
  currentStep,
  animationKey,
  children,
  onClose,
  onBack,
  onSkip,
  onPrimary,
  primaryLabel,
  primaryIcon,
  primaryDisabled,
  secondaryAction,
  busyContent,
}: {
  title: string;
  steps: WizardStep[];
  step: number;
  currentStep: WizardStep;
  animationKey: string | number;
  children: React.ReactNode;
  onClose: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  onPrimary: () => void;
  primaryLabel: string;
  primaryIcon?: React.ReactNode;
  primaryDisabled?: boolean;
  secondaryAction?: React.ReactNode;
  busyContent?: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-3 pointer-events-none max-md:pt-[max(0.75rem,env(safe-area-inset-top))] max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={animationKey}
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={WIZARD_PANEL_CLASS}
        >
          <div className={cn(NEUTRAL_PANEL_HEADER, "flex shrink-0 items-center justify-between")}>
            <h3 className={NEUTRAL_PANEL_TITLE}>{title}</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              aria-label="Close setup"
            >
              <X size="0.875rem" />
            </button>
          </div>

          <div className={cn(NEUTRAL_PANEL_SCROLL_AREA, "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4")}>
            <h4 className="text-sm font-semibold text-[var(--foreground)]">{currentStep.title}</h4>
            <p className={cn(NEUTRAL_PANEL_SUBTITLE, "mb-4")}>{currentStep.body}</p>
            {children}
          </div>

          <div className="shrink-0 border-t border-[var(--border)]/70 px-5 py-3">
            <div className="mb-3 flex items-center justify-center gap-1.5">
              {steps.map((item, i) => (
                <button
                  key={item.key}
                  type="button"
                  aria-label={`Go to ${item.title}`}
                  disabled={i >= step}
                  onClick={() => {
                    if (i < step) {
                      for (let index = step; index > i; index -= 1) onBack?.();
                    }
                  }}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300 disabled:cursor-default",
                    i === step
                      ? "w-5 bg-[var(--primary)]"
                      : i < step
                        ? "w-3 bg-[var(--primary)]/45 hover:bg-[var(--primary)]/70"
                        : "w-1.5 bg-[var(--muted-foreground)]/25",
                  )}
                />
              ))}
            </div>

            {busyContent ? (
              busyContent
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {onBack && (
                    <button type="button" onClick={onBack} className={WIZARD_GHOST_BUTTON_CLASS}>
                      Back
                    </button>
                  )}
                  {onSkip && (
                    <button type="button" onClick={onSkip} className={WIZARD_GHOST_BUTTON_CLASS}>
                      Skip
                    </button>
                  )}
                </div>
                <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
                  {secondaryAction}
                  <button
                    type="button"
                    onClick={onPrimary}
                    disabled={primaryDisabled}
                    className={WIZARD_PRIMARY_BUTTON_CLASS}
                  >
                    {primaryLabel}
                    {primaryIcon}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function getPersonaTitle(persona: PersonaDisplayInfo): string | null {
  const title = persona.comment?.trim();
  return title ? title : null;
}

function formatPersonaLabel(persona: PersonaDisplayInfo): string {
  const title = getPersonaTitle(persona);
  return title ? `${persona.name} - ${title}` : persona.name;
}

function getCharacterAvatarCrop(character: { data: unknown }): AvatarCrop | null {
  try {
    const parsed = typeof character.data === "string" ? JSON.parse(character.data) : character.data;
    return (parsed as { extensions?: { avatarCrop?: AvatarCrop | null } } | null)?.extensions?.avatarCrop ?? null;
  } catch {
    return null;
  }
}

function CharacterAvatarImage({
  character,
  src,
  alt,
  className,
}: {
  character: { data: unknown };
  src: string;
  alt: string;
  className: string;
}) {
  return (
    <span className={cn("relative block shrink-0 overflow-hidden", className)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-cover"
        style={getAvatarCropStyle(getCharacterAvatarCrop(character))}
      />
    </span>
  );
}

function PersonaAvatar({ persona }: { persona: PersonaDisplayInfo | null }) {
  if (persona?.avatarPath) {
    return (
      <img src={persona.avatarPath} alt={persona.name} loading="lazy" className="h-7 w-7 rounded-full object-cover" />
    );
  }

  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-[0.625rem] font-bold text-[var(--muted-foreground)]">
      {persona?.name ? persona.name[0] : <UserRound size="0.875rem" />}
    </div>
  );
}

function PersonaPicker({
  personas,
  value,
  onChange,
  searchable = true,
}: {
  personas: PersonaSetupOption[];
  value: string | null;
  onChange: (personaId: string | null) => void;
  searchable?: boolean;
}) {
  const selectedId = value ?? "";
  const [search, setSearch] = useState("");
  const filteredPersonas = useMemo(() => {
    if (!search.trim()) return personas;
    const query = search.toLowerCase();
    return personas.filter((persona) => {
      const title = getPersonaTitle(persona)?.toLowerCase() ?? "";
      return persona.name.toLowerCase().includes(query) || title.includes(query);
    });
  }, [personas, search]);

  return (
    <div className="overflow-hidden rounded-lg bg-[var(--secondary)]/50 ring-1 ring-[var(--border)]">
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={!selectedId}
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-all hover:bg-[var(--accent)]",
          !selectedId && "bg-[var(--primary)]/10 ring-1 ring-inset ring-[var(--primary)]/25",
        )}
      >
        <PersonaAvatar persona={null} />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">None</span>
          <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">Stay anonymous</span>
        </div>
        {!selectedId && <Check size="0.75rem" className="shrink-0 text-[var(--primary)]" />}
      </button>

      {personas.length > 0 && <div className="border-t border-[var(--border)]" />}

      {searchable && personas.length > 0 && (
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
          <Search size="0.75rem" className="text-[var(--muted-foreground)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search personas..."
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]"
          />
        </div>
      )}

      <div className="max-h-40 overflow-y-auto">
        {filteredPersonas.map((persona) => {
          const isSelected = selectedId === persona.id;
          const title = getPersonaTitle(persona);
          return (
            <button
              key={persona.id}
              type="button"
              onClick={() => onChange(persona.id)}
              aria-pressed={isSelected}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-all hover:bg-[var(--accent)]",
                isSelected && "bg-[var(--primary)]/10 ring-1 ring-inset ring-[var(--primary)]/25",
              )}
              title={formatPersonaLabel(persona)}
            >
              <PersonaAvatar persona={persona} />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{persona.name}</span>
                {title && (
                  <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">{title}</span>
                )}
              </div>
              {isSelected && <Check size="0.75rem" className="shrink-0 text-[var(--primary)]" />}
            </button>
          );
        })}
        {filteredPersonas.length === 0 && (
          <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
            {personas.length === 0 ? "No personas created yet." : "No matching personas."}
          </p>
        )}
      </div>
    </div>
  );
}

function SetupGenerationParametersPanel({
  enabled,
  value,
  showOpenRouterServiceTier,
  onEnabledChange,
  onChange,
}: {
  enabled: boolean;
  value: EditableGenerationParameters;
  showOpenRouterServiceTier: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onChange: (next: EditableGenerationParameters) => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
      <button
        type="button"
        onClick={() => onEnabledChange(!enabled)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <span className="block text-xs font-medium text-[var(--foreground)]">Customize Parameters</span>
          <span className="block text-[0.575rem] text-[var(--muted-foreground)]">
            Leave this off to use the selected connection&apos;s saved defaults for this chat.
          </span>
        </div>
        <div
          className={cn(
            "h-5 w-9 rounded-full p-0.5 transition-colors",
            enabled ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
          )}
        >
          <div className={cn("h-4 w-4 rounded-full bg-white transition-transform", enabled && "translate-x-3.5")} />
        </div>
      </button>
      {enabled && (
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <GenerationParametersFields
            value={value}
            showOpenRouterServiceTier={showOpenRouterServiceTier}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  );
}

export function ChatSetupWizard({ chat, onFinish }: ChatSetupWizardProps) {
  const chatMode = (chat as unknown as { mode?: string }).mode ?? "roleplay";

  if (chatMode === "conversation") {
    return <ConversationQuickSetup chat={chat} onFinish={onFinish} />;
  }

  // Game mode has its own wizard in GameSurface — skip the roleplay wizard
  if (chatMode === "game") {
    return null;
  }

  return <RoleplaySetupWizard chat={chat} onFinish={onFinish} />;
}

// ──────────────────────────────────────────────
// Conversation Quick Setup — Discord-style "New DM" picker
// ──────────────────────────────────────────────

function ConversationQuickSetup({ chat, onFinish }: ChatSetupWizardProps) {
  const [step, setStep] = useState(0);
  const currentStep = CONVERSATION_STEPS[step]!;
  const isLast = step === CONVERSATION_STEPS.length - 1;
  const { data: connections } = useConnections();
  const sidecarModelDownloaded = useSidecarStore((state) => state.modelDownloaded);
  const sidecarModelDisplayName = useSidecarStore((state) => state.modelDisplayName);
  const { data: presets } = usePresets();
  const { data: defaultPreset } = useDefaultPreset();
  const [selectedPromptPresetId, setSelectedPromptPresetId] = useState<string | null>(chat.promptPresetId ?? null);
  const { data: allCharacters } = useCharacters();
  const { data: allCharacterGroups } = useCharacterGroups();
  const { data: allPersonas } = usePersonas();
  const { data: installedAgentManifests = [], isLoading: installedAgentsLoading } = useCapabilityAgentRegistry();
  const updateChat = useUpdateChat();
  const updateMeta = useUpdateChatMetadata();
  const queryClient = useQueryClient();
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const openAgentCatalog = useUIStore((s) => s.openAgentCatalog);
  const [scheduleState, setScheduleState] = useState<"idle" | "generating" | "done">("idle");
  const [autonomousEnabled, setAutonomousEnabled] = useState(true);
  const [generateSchedule, setGenerateSchedule] = useState(false);
  const [promptPresetTouched, setPromptPresetTouched] = useState(false);
  const [customConversationPromptEnabled, setCustomConversationPromptEnabled] = useState(false);
  const [conversationSystemPromptDraft, setConversationSystemPromptDraft] = useState(DEFAULT_CONVERSATION_PROMPT);
  const defaultPromptPresetAppliedRef = useRef<string | null>(null);
  const selectedConnectionChatIdRef = useRef(chat.id);
  const latestChatConnectionIdRef = useRef(chat.connectionId);
  const [selectedConnectionId, setSelectedConnectionId] = useState(chat.connectionId ?? "");
  const installedAgentIds = useMemo(
    () => new Set(installedAgentManifests.map((agent) => agent.id)),
    [installedAgentManifests],
  );
  const availableConversationCommandOptions = useMemo(() => {
    return CONVERSATION_COMMAND_TOGGLE_OPTIONS.filter((command) => {
      const agentId = CONVERSATION_COMMAND_AGENT_IDS[command.id];
      return !agentId || installedAgentIds.has(agentId);
    });
  }, [installedAgentIds]);
  const hasConversationCommands = availableConversationCommandOptions.length > 0;
  const hasInstalledAgents = installedAgentIds.size > 0;
  const openDownloadAgents = useCallback(() => {
    onFinish();
    openRightPanel("agents");
    openAgentCatalog();
  }, [onFinish, openAgentCatalog, openRightPanel]);

  useEffect(() => {
    setSelectedPromptPresetId(chat.promptPresetId ?? null);
  }, [chat.id, chat.promptPresetId]);

  useEffect(() => {
    latestChatConnectionIdRef.current = chat.connectionId;
  }, [chat.connectionId]);

  useEffect(() => {
    if (selectedConnectionChatIdRef.current === chat.id) return;
    selectedConnectionChatIdRef.current = chat.id;
    setSelectedConnectionId(latestChatConnectionIdRef.current ?? "");
  }, [chat.id]);

  // Track whether the user has manually edited the chat name.
  // If not, auto-rename to match the selected character name(s).
  const [userEditedName, setUserEditedName] = useState(false);

  const characters = useMemo(
    () =>
      (allCharacters ?? []) as Array<{ id: string; data: string; comment?: string | null; avatarPath: string | null }>,
    [allCharacters],
  );
  const personas = useMemo(
    () =>
      (allPersonas ?? []) as Array<{
        id: string;
        name: string;
        avatarPath: string | null;
        comment?: string | null;
      }>,
    [allPersonas],
  );
  const promptPresetOptions = useMemo(
    () =>
      (presets ?? []) as Array<{
        id: string;
        name: string;
        isDefault?: boolean | string;
        conversationPrompt?: string;
      }>,
    [presets],
  );
  const selectedPromptPreset = useMemo(
    () => promptPresetOptions.find((preset) => preset.id === selectedPromptPresetId) ?? null,
    [promptPresetOptions, selectedPromptPresetId],
  );
  const selectedPromptPresetName = selectedPromptPreset?.name ?? null;
  const baseConversationPrompt = useMemo(() => {
    const presetPrompt = selectedPromptPreset?.conversationPrompt?.trim();
    const defaultPresetPrompt =
      defaultPreset?.id === selectedPromptPresetId ? (defaultPreset.conversationPrompt?.trim() ?? "") : "";
    return presetPrompt || defaultPresetPrompt || DEFAULT_CONVERSATION_PROMPT;
  }, [
    defaultPreset?.conversationPrompt,
    defaultPreset?.id,
    selectedPromptPreset?.conversationPrompt,
    selectedPromptPresetId,
  ]);
  const resolveConversationPromptForPresetId = useCallback(
    (presetId: string | null) => {
      const listedPresetPrompt = promptPresetOptions
        .find((preset) => preset.id === presetId)
        ?.conversationPrompt?.trim();
      const defaultPresetPrompt =
        defaultPreset?.id === presetId ? (defaultPreset.conversationPrompt?.trim() ?? "") : "";
      const presetPrompt = listedPresetPrompt || defaultPresetPrompt;
      return presetPrompt || DEFAULT_CONVERSATION_PROMPT;
    },
    [defaultPreset?.conversationPrompt, defaultPreset?.id, promptPresetOptions],
  );

  useEffect(() => {
    if (customConversationPromptEnabled) return;
    setConversationSystemPromptDraft(baseConversationPrompt);
  }, [baseConversationPrompt, customConversationPromptEnabled]);

  const metadata = useMemo(() => {
    return readChatMetadata(chat);
  }, [chat]);
  const [commandsEnabled, setCommandsEnabled] = useState(() => metadata.characterCommands !== false);
  const [conversationCommandToggles, setConversationCommandToggles] = useState<
    Partial<Record<ConversationCommandKey, boolean>>
  >(() => readConversationCommandToggles(metadata.conversationCommandToggles));
  const connectionOptions = useMemo(
    () =>
      appendLocalSidecarConnectionOption(
        (connections ?? []) as ConnectionSetupOption[],
        sidecarModelDownloaded,
        sidecarModelDisplayName,
      ),
    [connections, sidecarModelDisplayName, sidecarModelDownloaded],
  );
  const selectedConnection = useMemo(
    () => connectionOptions.find((connection) => connection.id === selectedConnectionId) ?? null,
    [connectionOptions, selectedConnectionId],
  );
  const parameterDefaults = useMemo(
    () => getEditableGenerationParameters(CHAT_PARAMETER_DEFAULTS, selectedConnection?.defaultParameters),
    [selectedConnection?.defaultParameters],
  );
  const [customizeParameters, setCustomizeParameters] = useState(
    () => !!parseEditableGenerationParameters(metadata.chatParameters),
  );
  const [generationParameters, setGenerationParameters] = useState<EditableGenerationParameters>(() =>
    getEditableGenerationParameters(parameterDefaults, metadata.chatParameters),
  );

  useEffect(() => {
    setGenerationParameters(getEditableGenerationParameters(parameterDefaults, metadata.chatParameters));
  }, [parameterDefaults, metadata.chatParameters]);

  useEffect(() => {
    setCustomizeParameters(!!parseEditableGenerationParameters(metadata.chatParameters));
  }, [metadata.chatParameters]);

  const persistedChatCharIds: string[] = useMemo(() => {
    return typeof chat.characterIds === "string" ? JSON.parse(chat.characterIds) : (chat.characterIds ?? []);
  }, [chat.characterIds]);
  const [chatCharIds, setChatCharIds] = useState<string[]>(persistedChatCharIds);

  useEffect(() => {
    setChatCharIds(persistedChatCharIds);
  }, [persistedChatCharIds]);

  const [search, setSearch] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [characterPickerLimit, setCharacterPickerLimit] = useState(CHARACTER_PICKER_PAGE_SIZE);

  useEffect(() => {
    setCharacterPickerLimit(CHARACTER_PICKER_PAGE_SIZE);
  }, [search]);

  const charInfoMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof parseCharacterDisplayData>>();
    for (const character of characters) {
      map.set(character.id, parseCharacterDisplayData(character));
    }
    return map;
  }, [characters]);

  const getCharacterInfo = useCallback(
    (c: { id?: string; data: string; comment?: string | null }) => {
      if (c.id && charInfoMap.has(c.id)) return charInfoMap.get(c.id)!;
      return parseCharacterDisplayData(c);
    },
    [charInfoMap],
  );

  const charName = useCallback(
    (c: { id?: string; data: string; comment?: string | null }) => getCharacterInfo(c).name,
    [getCharacterInfo],
  );

  const characterFolders = useMemo(
    () =>
      ((allCharacterGroups ?? []) as CharacterGroup[]).map((group) => ({
        ...group,
        characterIds: parseCharacterFolderIds(group.characterIds),
      })),
    [allCharacterGroups],
  );
  const validCharacterIds = useMemo(() => new Set(characters.map((character) => character.id)), [characters]);
  const getAddableFolderCharacterIds = useCallback(
    (folder: { characterIds: string[] }) =>
      folder.characterIds.filter((id) => validCharacterIds.has(id) && !chatCharIds.includes(id)),
    [chatCharIds, validCharacterIds],
  );

  // Build an auto-generated chat name from character IDs
  const buildAutoName = useCallback(
    (charIds: string[]) => {
      if (charIds.length === 0) return "New Conversation";
      const names = charIds
        .map((id) => {
          const c = characters.find((ch) => ch.id === id);
          return c ? charName(c) : null;
        })
        .filter((n): n is string => !!n);
      return names.length > 0 ? names.join(", ") : "New Conversation";
    },
    [characters, charName],
  );

  const toggleCharacter = useCallback(
    (charId: string) => {
      const current = [...chatCharIds];
      const idx = current.indexOf(charId);
      if (idx >= 0) current.splice(idx, 1);
      else current.push(charId);
      setChatCharIds(current);

      // Auto-rename the chat if the user hasn't manually edited the name
      if (!userEditedName) {
        const autoName = buildAutoName(current);
        updateChat.mutate({ id: chat.id, characterIds: current, name: autoName });
      } else {
        updateChat.mutate({ id: chat.id, characterIds: current });
      }
    },
    [buildAutoName, chat.id, chatCharIds, updateChat, userEditedName],
  );

  const addCharactersFromFolder = useCallback(
    (folderId: string) => {
      const folder = characterFolders.find((entry) => entry.id === folderId);
      if (!folder) return;
      const newIds = getAddableFolderCharacterIds(folder);
      if (newIds.length === 0) {
        toast.info("All characters from this folder are already added.");
        setSelectedFolderId("");
        return;
      }
      const nextCharacterIds = [...chatCharIds, ...newIds];
      setChatCharIds(nextCharacterIds);
      if (!userEditedName) {
        updateChat.mutate({ id: chat.id, characterIds: nextCharacterIds, name: buildAutoName(nextCharacterIds) });
      } else {
        updateChat.mutate({ id: chat.id, characterIds: nextCharacterIds });
      }
      setSelectedFolderId("");
      toast.success(`Added ${newIds.length} character${newIds.length === 1 ? "" : "s"} from ${folder.name}.`);
    },
    [buildAutoName, characterFolders, chat.id, chatCharIds, getAddableFolderCharacterIds, updateChat, userEditedName],
  );

  const addRandomCharacter = useCallback(() => {
    const selected = new Set(chatCharIds);
    const pool = characters.filter((character) => {
      if (selected.has(character.id)) return false;
      return characterMatchesSearch(getCharacterInfo(character), search);
    });
    const character = pool[Math.floor(Math.random() * pool.length)];
    if (character) toggleCharacter(character.id);
  }, [characters, chatCharIds, getCharacterInfo, search, toggleCharacter]);

  const setConnection = useCallback(
    (connectionId: string | null) => {
      setSelectedConnectionId(connectionId ?? "");
      updateChat.mutate(
        { id: chat.id, connectionId },
        {
          onSuccess: () => {
            latestChatConnectionIdRef.current = connectionId;
          },
          onError: () => setSelectedConnectionId(latestChatConnectionIdRef.current ?? ""),
        },
      );
    },
    [chat.id, updateChat],
  );

  const setPreset = useCallback(
    (presetId: string | null) => {
      setPromptPresetTouched(true);
      setSelectedPromptPresetId(presetId);
      if (customConversationPromptEnabled) {
        setConversationSystemPromptDraft(resolveConversationPromptForPresetId(presetId));
      }
      updateChat.mutate({ id: chat.id, promptPresetId: presetId });
    },
    [chat.id, customConversationPromptEnabled, resolveConversationPromptForPresetId, updateChat],
  );

  useEffect(() => {
    const defaultId = defaultPreset?.id ?? null;
    if (promptPresetTouched || chat.promptPresetId || !defaultId) return;

    const applyKey = `${chat.id}:${defaultId}`;
    if (defaultPromptPresetAppliedRef.current === applyKey) return;

    defaultPromptPresetAppliedRef.current = applyKey;
    setSelectedPromptPresetId(defaultId);
    if (customConversationPromptEnabled) {
      setConversationSystemPromptDraft(resolveConversationPromptForPresetId(defaultId));
    }
    updateChat.mutate({ id: chat.id, promptPresetId: defaultId });
  }, [
    chat.id,
    chat.promptPresetId,
    customConversationPromptEnabled,
    defaultPreset?.id,
    promptPresetTouched,
    resolveConversationPromptForPresetId,
    updateChat,
  ]);

  const setPersona = useCallback(
    (personaId: string | null) => {
      updateChat.mutate({ id: chat.id, personaId });
    },
    [chat.id, updateChat],
  );

  const available = useMemo(
    () =>
      characters.filter((c) => {
        if (chatCharIds.includes(c.id)) return false;
        return characterMatchesSearch(getCharacterInfo(c), search);
      }),
    [characters, chatCharIds, getCharacterInfo, search],
  );
  const visibleAvailable = available.slice(0, characterPickerLimit);
  const hasMoreAvailable = available.length > visibleAvailable.length;

  const hasConnection = !!chat.connectionId;
  const hasCharacters = chatCharIds.length > 0;
  const goBack = useCallback(() => {
    setStep((value) => Math.max(0, value - 1));
  }, []);
  const goNext = useCallback(() => {
    setStep((value) => Math.min(CONVERSATION_STEPS.length - 1, value + 1));
  }, []);

  const handleStartChatting = useCallback(async () => {
    if (!hasConnection || !hasCharacters) return;
    const trimmedConversationSystemPrompt = conversationSystemPromptDraft.trim();
    const baseConversationPromptText = baseConversationPrompt.trim();
    const customSystemPrompt =
      customConversationPromptEnabled &&
      trimmedConversationSystemPrompt &&
      trimmedConversationSystemPrompt !== baseConversationPromptText
        ? trimmedConversationSystemPrompt
        : null;
    await updateMeta.mutateAsync({
      id: chat.id,
      autonomousMessages: autonomousEnabled,
      conversationSchedulesEnabled: autonomousEnabled && generateSchedule,
      characterCommands: hasConversationCommands && commandsEnabled,
      conversationCommandToggles,
      conversationSetupComplete: true,
      chatParameters: customizeParameters ? generationParameters : null,
      customSystemPrompt,
    });
    if (autonomousEnabled && generateSchedule) {
      setScheduleState("generating");
      try {
        const scheduleGenerationPreferences = useUIStore.getState().scheduleGenerationPreferences;
        const conversationTimeZone = useUIStore.getState().conversationTimeZone;
        await api.post("/conversation/schedule/generate", {
          chatId: chat.id,
          characterIds: chatCharIds,
          scheduleGenerationPreferences,
          timeZone: conversationTimeZone,
        });
        await queryClient.invalidateQueries({ queryKey: chatKeys.detail(chat.id) });
        await queryClient.invalidateQueries({ queryKey: ["conversation-status", chat.id] });
      } catch {
        // Schedule generation is non-critical — continue anyway
      }
      setScheduleState("done");
      setTimeout(onFinish, 2000);
    } else {
      onFinish();
    }
  }, [
    hasConnection,
    hasCharacters,
    chat.id,
    chatCharIds,
    onFinish,
    autonomousEnabled,
    generateSchedule,
    updateMeta,
    customizeParameters,
    generationParameters,
    hasConversationCommands,
    commandsEnabled,
    conversationCommandToggles,
    queryClient,
    customConversationPromptEnabled,
    conversationSystemPromptDraft,
    baseConversationPrompt,
  ]);

  const renderConnectionStep = () => (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className={WIZARD_FIELD_LABEL}>Name</label>
        <input
          type="text"
          key={userEditedName ? "user" : chat.name}
          defaultValue={chat.name}
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (value && value !== chat.name) {
              setUserEditedName(true);
              updateChat.mutate({ id: chat.id, name: value });
            }
          }}
          placeholder="Conversation name"
          className={WIZARD_INPUT_CLASS}
        />
      </div>

      <div className="space-y-1.5">
        <label className={WIZARD_FIELD_LABEL}>Connection</label>
        <select
          value={selectedConnectionId}
          onChange={(event) => setConnection(event.target.value || null)}
          className={WIZARD_INPUT_CLASS}
        >
          <option value="">None</option>
          <option value="random">Random</option>
          {connectionOptions.map((connection) => (
            <option key={connection.id} value={connection.id}>
              {connection.name}
            </option>
          ))}
        </select>
        {connectionOptions.length === 0 && (
          <button
            onClick={() => {
              openRightPanel("connections");
              onFinish();
            }}
            className={WIZARD_SECONDARY_BUTTON_CLASS}
          >
            <Plug size="0.75rem" />
            Set Up a Connection
          </button>
        )}
        <SetupGenerationParametersPanel
          enabled={customizeParameters}
          value={generationParameters}
          showOpenRouterServiceTier={selectedConnection?.provider === "openrouter"}
          onEnabledChange={setCustomizeParameters}
          onChange={setGenerationParameters}
        />
      </div>
    </div>
  );

  const renderPromptStep = () => (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className={WIZARD_FIELD_LABEL}>Conversation Prompt</label>
        <select
          value={selectedPromptPresetId ?? ""}
          onChange={(event) => setPreset(event.target.value || null)}
          className={WIZARD_INPUT_CLASS}
        >
          <option value="">None</option>
          {promptPresetOptions.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
        <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
          This selects the Conversation mode prompt stored in the preset. Chat Settings can still override it per chat.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
        <button
          type="button"
          onClick={() => setCustomConversationPromptEnabled((enabled) => !enabled)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Feather
              size={14}
              className={customConversationPromptEnabled ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-[var(--foreground)]">Conversation Prompt</p>
              <p className="truncate text-[0.55rem] text-[var(--muted-foreground)]">
                {customConversationPromptEnabled
                  ? "Custom prompt will override the selected preset"
                  : selectedPromptPresetName
                    ? `Using ${selectedPromptPresetName}`
                    : "Using default conversation prompt"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[0.5625rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              {customConversationPromptEnabled ? "Custom" : selectedPromptPresetName ? "Preset" : "Default"}
            </span>
            <div
              className={cn(
                "flex h-5 w-8 items-center rounded-full px-0.5 transition-colors",
                customConversationPromptEnabled ? "bg-[var(--primary)]" : "bg-[var(--secondary)]",
              )}
            >
              <div
                className={cn(
                  "h-4 w-4 rounded-full bg-white transition-transform",
                  customConversationPromptEnabled && "translate-x-3.5",
                )}
              />
            </div>
          </div>
        </button>

        {customConversationPromptEnabled && (
          <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
            <textarea
              value={conversationSystemPromptDraft}
              onChange={(event) => setConversationSystemPromptDraft(event.target.value)}
              rows={10}
              maxLength={16000}
              className="max-h-72 min-h-48 w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs leading-relaxed text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] transition-all placeholder:text-[var(--muted-foreground)]/50 focus:ring-[var(--primary)]/40"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[0.5625rem] text-[var(--muted-foreground)]">
                Leaving this unchanged keeps the selected preset or built-in default.
              </p>
              <button
                type="button"
                onClick={() => setConversationSystemPromptDraft(baseConversationPrompt)}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                <RotateCcw size={11} />
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderParticipantsStep = () => (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className={WIZARD_FIELD_LABEL}>Your Persona</label>
        <PersonaPicker personas={personas} value={chat.personaId ?? null} onChange={setPersona} />
      </div>

      <div className="space-y-1.5">
        <label className={WIZARD_FIELD_LABEL}>
          {chatCharIds.length > 1 ? (
            <span className="flex items-center gap-1.5">
              <Users size="0.6875rem" />
              Group Chat · {chatCharIds.length} members
            </span>
          ) : (
            "Who do you want to message?"
          )}
        </label>

        {chatCharIds.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {chatCharIds.map((cid) => {
              const character = characters.find((entry) => entry.id === cid);
              if (!character) return null;
              const name = charName(character);
              const title = getCharacterTitle(getCharacterInfo(character));
              return (
                <button
                  key={cid}
                  onClick={() => toggleCharacter(cid)}
                  className="group flex items-center gap-1.5 rounded-lg bg-[var(--primary)]/10 py-1 pl-1 pr-2.5 text-xs ring-1 ring-[var(--primary)]/25 transition-all hover:bg-[var(--destructive)]/15 hover:ring-[var(--destructive)]/30"
                  title={title ? `${name} - ${title}` : name}
                >
                  {character.avatarPath ? (
                    <CharacterAvatarImage
                      character={character}
                      src={character.avatarPath}
                      alt={name}
                      className="h-5 w-5 rounded-md"
                    />
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--accent)] text-[0.5rem] font-bold">
                      {name[0]}
                    </div>
                  )}
                  <span className="max-w-[7rem] truncate">{name}</span>
                  <X size="0.625rem" className="text-[var(--muted-foreground)] group-hover:text-[var(--destructive)]" />
                </button>
              );
            })}
          </div>
        )}

        <div className="overflow-hidden rounded-lg bg-[var(--secondary)]/50 ring-1 ring-[var(--border)]">
          <div className="flex items-center gap-2 px-3 py-2">
            <Search size="0.75rem" className="text-[var(--muted-foreground)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search characters..."
              className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]"
            />
          </div>
          {characterFolders.length > 0 && (
            <div className="flex items-center gap-2 border-t border-[var(--border)] px-3 py-2">
              <FolderOpen size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
              <select
                value={selectedFolderId}
                onChange={(event) => setSelectedFolderId(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-xs text-[var(--foreground)] outline-none"
                aria-label="Add characters from folder"
              >
                <option value="">Add from Folder</option>
                {characterFolders.map((folder) => {
                  const newCount = getAddableFolderCharacterIds(folder).length;
                  return (
                    <option key={folder.id} value={folder.id}>
                      {folder.name} ({newCount > 0 ? `${newCount} new` : "all added"})
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                onClick={() => addCharactersFromFolder(selectedFolderId)}
                disabled={!selectedFolderId}
                className="rounded-lg bg-[var(--primary)]/15 px-2.5 py-1 text-[0.625rem] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add
              </button>
            </div>
          )}
          <div className="max-h-48 overflow-y-auto border-t border-[var(--border)]">
            {available.length > 0 && (
              <button
                type="button"
                onClick={addRandomCharacter}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--primary)]/10 text-[var(--primary)] ring-1 ring-[var(--primary)]/25">
                  <Dices size="0.875rem" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs">Random</span>
                  <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">Dice pick</span>
                </div>
                <Plus size="0.75rem" className="text-[var(--muted-foreground)]" />
              </button>
            )}
            {visibleAvailable.map((character) => {
              const info = getCharacterInfo(character);
              const title = getCharacterTitle(info);
              return (
                <button
                  key={character.id}
                  onClick={() => toggleCharacter(character.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
                >
                  {character.avatarPath ? (
                    <CharacterAvatarImage
                      character={character}
                      src={character.avatarPath}
                      alt={info.name}
                      className="h-7 w-7 rounded-md"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent)] text-[0.5625rem] font-bold">
                      {info.name[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs">{info.name}</span>
                    {title && (
                      <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">{title}</span>
                    )}
                  </div>
                  <Plus size="0.75rem" className="text-[var(--muted-foreground)]" />
                </button>
              );
            })}
            {hasMoreAvailable && (
              <button
                type="button"
                onClick={() => setCharacterPickerLimit((limit) => limit + CHARACTER_PICKER_PAGE_SIZE)}
                className="w-full border-t border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10"
              >
                Load more ({visibleAvailable.length} of {available.length})
              </button>
            )}
            {available.length === 0 && (
              <p className="px-3 py-3 text-center text-[0.6875rem] text-[var(--muted-foreground)]">
                {characters.filter((character) => !chatCharIds.includes(character.id)).length === 0
                  ? "All characters added."
                  : "No matches."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderAutomationStep = () => (
    <div className="space-y-2">
      <button
        onClick={() => setAutonomousEnabled((value) => !value)}
        className={cn(
          "mari-chat-option-field flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
          autonomousEnabled && "mari-chat-option-field--active",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Bot
            size="0.875rem"
            className={autonomousEnabled ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}
          />
          <div>
            <span className="text-xs font-medium">Autonomous Messages</span>
            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
              Characters can message you first when you are inactive.
            </p>
          </div>
        </div>
        <div
          className={cn(
            "mari-chat-option-switch h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
            autonomousEnabled && "mari-chat-option-switch--active",
          )}
        >
          <div
            className={cn(
              "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
              autonomousEnabled && "translate-x-3.5",
            )}
          />
        </div>
      </button>

      {autonomousEnabled && (
        <button
          onClick={() => setGenerateSchedule((value) => !value)}
          className={cn(
            "mari-chat-option-field flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
            generateSchedule && "mari-chat-option-field--active",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Loader2
              size="0.875rem"
              className={generateSchedule ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}
            />
            <div>
              <span className="text-xs font-medium">Generate Schedules</span>
              <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                Optional routines for availability and delayed replies.
              </p>
            </div>
          </div>
          <div
            className={cn(
              "mari-chat-option-switch h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
              generateSchedule && "mari-chat-option-switch--active",
            )}
          >
            <div
              className={cn(
                "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                generateSchedule && "translate-x-3.5",
              )}
            />
          </div>
        </button>
      )}

      {autonomousEnabled && generateSchedule && (
        <div className="rounded-lg bg-[var(--secondary)]/55 px-3 py-2.5 ring-1 ring-[var(--border)]/80">
          <ConversationTimeZoneSelect compact />
        </div>
      )}

      {hasConversationCommands && (
        <button
          onClick={() => setCommandsEnabled((value) => !value)}
          className={cn(
            "mari-chat-option-field flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
            commandsEnabled && "mari-chat-option-field--active",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Sparkles
              size="0.875rem"
              className={commandsEnabled ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}
            />
            <div>
              <span className="text-xs font-medium">Commands</span>
              <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                Choose which built-in and installed-agent actions characters may use.
              </p>
            </div>
          </div>
          <div
            className={cn(
              "mari-chat-option-switch h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
              commandsEnabled && "mari-chat-option-switch--active",
            )}
          >
            <div
              className={cn(
                "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                commandsEnabled && "translate-x-3.5",
              )}
            />
          </div>
        </button>
      )}

      {hasConversationCommands && commandsEnabled && (
        <div className="grid gap-1.5 pt-1 sm:grid-cols-2">
          {availableConversationCommandOptions.map((command) => {
            const enabled = isConversationCommandToggleEnabled(conversationCommandToggles, command.id);
            return (
              <button
                key={command.id}
                type="button"
                onClick={() =>
                  setConversationCommandToggles((current) => ({
                    ...current,
                    [command.id]: !enabled,
                  }))
                }
                aria-pressed={enabled}
                className={cn(
                  "mari-chat-option-field flex min-h-[4rem] items-start justify-between gap-2 rounded-lg px-3 py-2 text-left transition-all",
                  enabled && "mari-chat-option-field--active",
                )}
              >
                <div className="min-w-0 flex-1">
                  <span className="block text-[0.6875rem] font-medium text-[var(--foreground)]">{command.label}</span>
                  <p className="mt-0.5 text-[0.59375rem] leading-snug text-[var(--muted-foreground)]">
                    {command.description}
                  </p>
                </div>
                <div
                  className={cn(
                    "mari-chat-option-switch mt-0.5 h-4 w-7 shrink-0 rounded-full p-0.5 transition-colors",
                    enabled && "mari-chat-option-switch--active",
                  )}
                >
                  <div
                    className={cn(
                      "h-3 w-3 rounded-full bg-white shadow-sm transition-transform",
                      enabled && "translate-x-3",
                    )}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!installedAgentsLoading && !hasInstalledAgents && (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--secondary)]/35 px-4 py-4 text-center">
          <p className="text-xs font-medium text-[var(--foreground)]">No agents downloaded yet.</p>
          <p className="mx-auto mt-1 max-w-sm text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            Download agents to add Selfies, Calls, Music, Haptics, and Conversation games.
          </p>
          <button
            type="button"
            onClick={openDownloadAgents}
            className={cn(WIZARD_PRIMARY_BUTTON_CLASS, "mx-auto mt-3 gap-2")}
          >
            <Sparkles size="0.8125rem" />
            Download Agents
          </button>
        </div>
      )}
    </div>
  );

  const content =
    currentStep.key === "connection"
      ? renderConnectionStep()
      : currentStep.key === "prompt"
        ? renderPromptStep()
        : currentStep.key === "participants"
          ? renderParticipantsStep()
          : renderAutomationStep();
  const busyContent =
    scheduleState === "generating" ? (
      <div className="flex items-center justify-center gap-2 py-1">
        <Loader2 size="0.875rem" className="animate-spin text-[var(--primary)]" />
        <span className="text-xs text-[var(--muted-foreground)]">
          Generating schedule{chatCharIds.length > 1 ? "s" : ""}...
        </span>
      </div>
    ) : scheduleState === "done" ? (
      <div className="flex items-center justify-center gap-2 py-1">
        <Check size="0.875rem" className="text-emerald-400" />
        <span className="text-xs text-emerald-400">Ready! Say hi to start the conversation.</span>
      </div>
    ) : null;

  return (
    <>
      <WizardBackdrop onClose={onFinish} />
      <SetupWizardShell
        title="New Conversation"
        steps={CONVERSATION_STEPS}
        step={step}
        currentStep={currentStep}
        animationKey={`conversation-${currentStep.key}`}
        onClose={onFinish}
        onBack={step > 0 ? goBack : undefined}
        onSkip={onFinish}
        onPrimary={isLast ? handleStartChatting : goNext}
        primaryLabel={isLast ? "Start Chatting" : "Next"}
        primaryIcon={isLast ? <MessageCircle size="0.75rem" /> : <ChevronRight size="0.75rem" />}
        primaryDisabled={isLast && (!hasConnection || !hasCharacters)}
        busyContent={busyContent}
      >
        {content}
      </SetupWizardShell>
    </>
  );
}

// ──────────────────────────────────────────────
// Roleplay Setup Wizard — step-by-step guided setup
// ──────────────────────────────────────────────

function RoleplaySetupWizard({ chat, onFinish }: ChatSetupWizardProps) {
  const STEPS = ROLEPLAY_STEPS;

  const [step, setStep] = useState(0);
  const currentStep = STEPS[step]!;
  const isLast = step === STEPS.length - 1;
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  // Open in shortcut mode if the chat store flag was set (e.g. via right-click "Quick Start").
  const [shortcutMode, setShortcutMode] = useState(() => {
    const flag = useChatStore.getState().shouldOpenWizardInShortcutMode;
    if (flag) useChatStore.getState().setShouldOpenWizardInShortcutMode(false);
    return flag;
  });
  const [shortcutPresetId, setShortcutPresetId] = useState<string>("");

  const updateChat = useUpdateChat();
  const updateMeta = useUpdateChatMetadata();
  const updateAgentConfig = useUpdateAgent();
  const createAgent = useCreateAgent();
  const createMessage = useCreateMessage(chat.id);
  const queryClient = useQueryClient();
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const roleplaySpriteScale = useUIStore((s) => s.roleplaySpriteScale);
  const musicPlayerSource = useUIStore((s) => s.musicPlayerSource);

  // Fetch full preset data to check for choice blocks (variables)
  const { data: presetFull, isLoading: presetFullLoading } = usePresetFull(chat.promptPresetId ?? null);

  const { data: connections } = useConnections();
  const sidecarModelDownloaded = useSidecarStore((state) => state.modelDownloaded);
  const sidecarModelDisplayName = useSidecarStore((state) => state.modelDisplayName);
  const { data: presets } = usePresets();
  const { data: defaultPreset } = useDefaultPreset();
  const { data: allPersonas } = usePersonas();
  const { data: allCharacters } = useCharacters();
  const { data: allCharacterGroups } = useCharacterGroups();
  const { data: lorebooks } = useLorebooks();
  const { data: agentConfigs, isLoading: agentConfigsLoading } = useAgentConfigs();
  const { data: installedAgentManifests = [], isLoading: installedAgentsLoading } = useCapabilityAgentRegistry();

  // Chat-settings presets for the shortcut view
  const supportsNarrativeDirectorSecretPlot = (chat as unknown as { mode?: string }).mode === "roleplay";
  const chatPresetMode = (
    (chat as unknown as { mode?: string }).mode === "visual_novel" ? "roleplay" : "roleplay"
  ) as ChatMode;
  const activeChatMode = ((chat as unknown as { mode?: ChatMode }).mode ?? "roleplay") as ChatMode;
  const { data: chatPresetsData } = useChatPresets(chatPresetMode);
  const chatPresetList = useMemo(() => (chatPresetsData ?? []) as ChatPreset[], [chatPresetsData]);
  const applyChatPreset = useApplyChatPreset();

  const personas = useMemo(
    () =>
      (allPersonas ?? []) as Array<{
        id: string;
        name: string;
        avatarPath: string | null;
        comment?: string | null;
      }>,
    [allPersonas],
  );
  const characters = useMemo(
    () =>
      (allCharacters ?? []) as Array<{ id: string; data: string; comment?: string | null; avatarPath: string | null }>,
    [allCharacters],
  );
  const characterFolders = useMemo(
    () =>
      ((allCharacterGroups ?? []) as CharacterGroup[]).map((group) => ({
        ...group,
        characterIds: parseCharacterFolderIds(group.characterIds),
      })),
    [allCharacterGroups],
  );
  const validCharacterIds = useMemo(() => new Set(characters.map((character) => character.id)), [characters]);
  const connectionOptions = useMemo(
    () =>
      appendLocalSidecarConnectionOption(
        (connections ?? []) as ConnectionSetupOption[],
        sidecarModelDownloaded,
        sidecarModelDisplayName,
      ),
    [connections, sidecarModelDisplayName, sidecarModelDownloaded],
  );
  const selectedConnection = useMemo(
    () => connectionOptions.find((connection) => connection.id === chat.connectionId) ?? null,
    [connectionOptions, chat.connectionId],
  );
  const parameterDefaults = useMemo(
    () => getEditableGenerationParameters(ROLEPLAY_PARAMETER_DEFAULTS, selectedConnection?.defaultParameters),
    [selectedConnection?.defaultParameters],
  );

  const metadata = useMemo(() => {
    return readChatMetadata(chat);
  }, [chat]);
  const [customizeParameters, setCustomizeParameters] = useState(
    () => !!parseEditableGenerationParameters(metadata.chatParameters),
  );
  const [generationParameters, setGenerationParameters] = useState<EditableGenerationParameters>(() =>
    getEditableGenerationParameters(parameterDefaults, metadata.chatParameters),
  );

  useEffect(() => {
    setGenerationParameters(getEditableGenerationParameters(parameterDefaults, metadata.chatParameters));
  }, [parameterDefaults, metadata.chatParameters]);

  useEffect(() => {
    setCustomizeParameters(!!parseEditableGenerationParameters(metadata.chatParameters));
  }, [metadata.chatParameters]);

  const persistedChatCharIds: string[] = useMemo(() => {
    return typeof chat.characterIds === "string" ? JSON.parse(chat.characterIds) : (chat.characterIds ?? []);
  }, [chat.characterIds]);
  const [chatCharIds, setChatCharIds] = useState<string[]>(persistedChatCharIds);

  useEffect(() => {
    setChatCharIds(persistedChatCharIds);
  }, [persistedChatCharIds]);

  const getAddableFolderCharacterIds = useCallback(
    (folder: { characterIds: string[] }) =>
      folder.characterIds.filter((id) => validCharacterIds.has(id) && !chatCharIds.includes(id)),
    [chatCharIds, validCharacterIds],
  );

  const activeLorebookIds: string[] = useMemo(
    () =>
      (Array.isArray(metadata.activeLorebookIds) ? metadata.activeLorebookIds : []).filter(
        (id: unknown): id is string => typeof id === "string",
      ),
    [metadata.activeLorebookIds],
  );
  const activeAgentIds: string[] = useMemo(
    () =>
      (Array.isArray(metadata.activeAgentIds) ? metadata.activeAgentIds : []).filter(
        (id: unknown): id is string => typeof id === "string",
      ),
    [metadata.activeAgentIds],
  );
  const readLatestActiveAgentIds = useCallback(() => {
    const latestChat = queryClient.getQueryData<Chat>(chatKeys.detail(chat.id));
    return latestChat ? readChatActiveAgentIds(latestChat) : [...activeAgentIds];
  }, [activeAgentIds, chat.id, queryClient]);
  const agentsEnabled = metadata.enableAgents === true;
  const agentConfigsByType = useMemo(() => {
    const map = new Map<string, AgentConfigRow>();
    for (const config of (agentConfigs ?? []) as AgentConfigRow[]) {
      map.set(config.type, config);
    }
    return map;
  }, [agentConfigs]);
  const installedAgentIds = useMemo(
    () => new Set(installedAgentManifests.map((agent) => agent.id)),
    [installedAgentManifests],
  );
  const availableAgents = useMemo(() => {
    const agents: AvailableAgent[] = [];
    for (const agent of installedAgentManifests) {
      if (agent.libraryHidden) continue;
      if (!isAgentManifestAvailableInChatMode(activeChatMode, agent)) continue;
      if (isAgentHiddenFromChatSettingsPicker(activeChatMode, agent.id)) continue;
      const existing = agentConfigsByType.get(agent.id);
      if (existing && isAgentConfigDeleted(existing.settings)) continue;
      agents.push({
        id: agent.id,
        name: agent.name,
        description: existing?.description ?? agent.description,
        category: agent.category,
        phase: normalizeAgentPhaseForType(agent.id, existing?.phase ?? agent.phase),
        builtIn: true,
        runtimeDisabled: isBuiltInAgentRuntimeDisabled(agent.id),
        execution: agent.execution,
      });
    }
    for (const config of (agentConfigs ?? []) as AgentConfigRow[]) {
      if (isAgentConfigDeleted(config.settings)) continue;
      if (isRetiredBuiltInAgentId(config.type)) continue;
      if (installedAgentIds.has(config.type)) continue;
      agents.push({
        id: config.type,
        name: config.name,
        description: config.description,
        category: "custom",
        phase: normalizeAgentPhaseForType(config.type, config.phase),
        builtIn: false,
        runtimeDisabled: false,
        execution: "pipeline",
      });
    }
    return agents;
  }, [activeChatMode, agentConfigs, agentConfigsByType, installedAgentIds, installedAgentManifests]);

  const getPromptOptionsForAgent = useCallback(
    (agentId: string) => {
      const config = agentConfigsByType.get(agentId);
      const settings = mergeBuiltInAgentSettings(agentId, config?.settings);
      return getAgentPromptTemplateOptions({
        promptTemplate: config?.promptTemplate || "",
        fallbackPromptTemplate: getDefaultAgentPrompt(agentId),
        settings,
      });
    },
    [agentConfigsByType],
  );

  // Character name helper
  const charInfoMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof parseCharacterDisplayData>>();
    for (const c of characters) {
      map.set(c.id, parseCharacterDisplayData(c));
    }
    return map;
  }, [characters]);

  const getCharacterInfo = useCallback(
    (c: { id?: string; data: string; comment?: string | null }) => {
      if (c.id && charInfoMap.has(c.id)) return charInfoMap.get(c.id)!;
      return parseCharacterDisplayData(c);
    },
    [charInfoMap],
  );

  const charName = useCallback(
    (c: { id?: string; data: string; comment?: string | null }) => getCharacterInfo(c).name,
    [getCharacterInfo],
  );

  const charTitle = useCallback(
    (c: { id?: string; data: string; comment?: string | null }) => getCharacterTitle(getCharacterInfo(c)),
    [getCharacterInfo],
  );

  const agentAddSpriteSubjects = useMemo<AgentAddSpriteSubject[]>(() => {
    const selectedCharacters = chatCharIds
      .map((characterId) => characters.find((character) => character.id === characterId))
      .filter(
        (character): character is { id: string; data: string; comment?: string | null; avatarPath: string | null } =>
          Boolean(character),
      );
    const selectedPersona = chat.personaId ? personas.find((persona) => persona.id === chat.personaId) : null;
    return [
      ...selectedCharacters.map((character) => ({
        id: character.id,
        name: charName(character),
        subtitle: charTitle(character),
        avatarPath: character.avatarPath ?? null,
      })),
      ...(selectedPersona
        ? [
            {
              id: selectedPersona.id,
              name: selectedPersona.name,
              subtitle: selectedPersona.comment || "Persona",
              avatarPath: selectedPersona.avatarPath ?? null,
            },
          ]
        : []),
    ];
  }, [chat.personaId, chatCharIds, charName, charTitle, characters, personas]);

  // Track whether the user has manually edited the chat name.
  // The Connection step's Name input flips this to true onBlur when the
  // user changes it, which suppresses auto-rename on character selection.
  const [userEditedName, setUserEditedName] = useState(false);

  // Build an auto-generated chat name from character IDs
  const buildAutoName = useCallback(
    (charIds: string[]) => {
      if (charIds.length === 0) return "New Roleplay";
      const names = charIds.map((id) => charInfoMap.get(id)?.name).filter((n): n is string => !!n);
      return names.length > 0 ? names.join(", ") : "New Roleplay";
    },
    [charInfoMap],
  );

  // ── Mutations ──
  const setConnection = useCallback(
    (connectionId: string | null) => {
      updateChat.mutate({ id: chat.id, connectionId });
    },
    [chat.id, updateChat],
  );

  const setPreset = useCallback(
    (presetId: string | null) => {
      updateChat.mutate({ id: chat.id, promptPresetId: presetId });
    },
    [chat.id, updateChat],
  );

  // Auto-select the default preset for new chats
  useEffect(() => {
    if (!chat.promptPresetId && defaultPreset?.id) {
      updateChat.mutate({ id: chat.id, promptPresetId: defaultPreset.id });
    }
  }, [defaultPreset?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPersona = useCallback(
    (personaId: string | null) => {
      updateChat.mutate({ id: chat.id, personaId });
    },
    [chat.id, updateChat],
  );

  const createInitialGreetingForCharacter = useCallback(
    async (charId: string) => {
      const char = characters.find((c) => c.id === charId);
      if (!char) return;
      try {
        const parsed = typeof char.data === "string" ? JSON.parse(char.data) : char.data;
        const firstMes = (parsed as { first_mes?: string }).first_mes;
        const altGreetings = (parsed as { alternate_greetings?: string[] }).alternate_greetings ?? [];
        if (firstMes) {
          const msg = await createMessage.mutateAsync({ role: "assistant", content: firstMes, characterId: charId });
          if (msg?.id && altGreetings.length > 0) {
            await addSilentGreetingSwipes(chat.id, msg.id, altGreetings);
            queryClient.invalidateQueries({ queryKey: chatKeys.messages(chat.id) });
          }
        }
      } catch {
        /* ignore */
      }
    },
    [characters, chat.id, createMessage, queryClient],
  );

  const toggleCharacter = useCallback(
    (charId: string) => {
      const current = [...chatCharIds];
      const idx = current.indexOf(charId);
      if (idx >= 0) {
        current.splice(idx, 1);
        setChatCharIds(current);
        // Auto-rename the chat if the user hasn't manually edited the name
        const updateData: { id: string; characterIds: string[]; name?: string } = {
          id: chat.id,
          characterIds: current,
        };
        if (!userEditedName) updateData.name = buildAutoName(current);
        updateChat.mutate(updateData);
      } else {
        current.push(charId);
        setChatCharIds(current);
        const updateData: { id: string; characterIds: string[]; name?: string } = {
          id: chat.id,
          characterIds: current,
        };
        if (!userEditedName) updateData.name = buildAutoName(current);
        updateChat.mutate(updateData);
      }
    },
    [buildAutoName, chat.id, chatCharIds, updateChat, userEditedName],
  );

  const addCharactersFromFolder = useCallback(
    (folderId: string) => {
      const folder = characterFolders.find((entry) => entry.id === folderId);
      if (!folder) return;
      const newIds = getAddableFolderCharacterIds(folder);
      if (newIds.length === 0) {
        toast.info("All characters from this folder are already added.");
        return;
      }
      const nextCharacterIds = [...chatCharIds, ...newIds];
      setChatCharIds(nextCharacterIds);
      const updateData: { id: string; characterIds: string[]; name?: string } = {
        id: chat.id,
        characterIds: nextCharacterIds,
      };
      if (!userEditedName) updateData.name = buildAutoName(nextCharacterIds);
      updateChat.mutate(updateData);
      toast.success(`Added ${newIds.length} character${newIds.length === 1 ? "" : "s"} from ${folder.name}.`);
    },
    [buildAutoName, characterFolders, chat.id, chatCharIds, getAddableFolderCharacterIds, updateChat, userEditedName],
  );

  const toggleLorebook = useCallback(
    (lbId: string) => {
      const current = [...activeLorebookIds];
      const idx = current.indexOf(lbId);
      if (idx >= 0) current.splice(idx, 1);
      else current.push(lbId);
      updateMeta.mutate({ id: chat.id, activeLorebookIds: current });
    },
    [chat.id, activeLorebookIds, updateMeta],
  );

  // Default the shortcut dropdown once presets load. Prefer (in order):
  //  1) the preset already applied to this chat,
  //  2) the user's starred / active preset for the mode,
  //  3) the built-in Default preset.
  useEffect(() => {
    if (shortcutPresetId) return;
    if (chatPresetList.length === 0) return;
    const appliedId = (metadata.appliedChatPresetId as string | undefined) ?? null;
    const applied = appliedId ? chatPresetList.find((p) => p.id === appliedId) : null;
    const starred = chatPresetList.find((p) => p.isActive);
    const fallback = chatPresetList.find((p) => p.isDefault);
    const pick = applied ?? starred ?? fallback;
    if (pick) setShortcutPresetId(pick.id);
  }, [chatPresetList, shortcutPresetId, metadata.appliedChatPresetId]);

  const [shortcutApplying, setShortcutApplying] = useState(false);

  const finishWizard = useCallback(async () => {
    await updateMeta.mutateAsync({
      id: chat.id,
      chatParameters: customizeParameters ? generationParameters : null,
    });
    for (const charId of chatCharIds) {
      await createInitialGreetingForCharacter(charId);
    }
    onFinish();
  }, [
    chat.id,
    chatCharIds,
    createInitialGreetingForCharacter,
    customizeParameters,
    generationParameters,
    onFinish,
    updateMeta,
  ]);

  const seedInitialGreetingsIfEmpty = useCallback(async () => {
    if (chatCharIds.length === 0) return;
    try {
      const messages = await api.get<Array<Pick<Message, "role">>>(`/chats/${chat.id}/messages`);
      const hasNonSystemMessage = messages.some((message) => message.role !== "system");
      if (hasNonSystemMessage) return;
    } catch {
      return;
    }
    for (const charId of chatCharIds) {
      await createInitialGreetingForCharacter(charId);
    }
  }, [chat.id, chatCharIds, createInitialGreetingForCharacter]);

  const handleShortcutApply = useCallback(async () => {
    if (!shortcutPresetId) {
      await seedInitialGreetingsIfEmpty();
      onFinish();
      return;
    }
    try {
      setShortcutApplying(true);
      await applyChatPreset.mutateAsync({ presetId: shortcutPresetId, chatId: chat.id });
    } catch {
      /* fall through — still close the wizard */
    } finally {
      await seedInitialGreetingsIfEmpty();
      setShortcutApplying(false);
      onFinish();
    }
  }, [shortcutPresetId, chat.id, applyChatPreset, onFinish, seedInitialGreetingsIfEmpty]);

  // Search state for character & lorebook pickers
  const [charSearch, setCharSearch] = useState("");
  const [selectedRoleplayFolderId, setSelectedRoleplayFolderId] = useState("");
  const [characterPickerLimit, setCharacterPickerLimit] = useState(CHARACTER_PICKER_PAGE_SIZE);
  const [lbSearch, setLbSearch] = useState("");
  const [agentSearch, setAgentSearch] = useState("");
  const [agentAddPreview, setAgentAddPreview] = useState<AgentAddPreview | null>(null);
  const [addingAgentToChat, setAddingAgentToChat] = useState(false);

  useEffect(() => {
    setCharacterPickerLimit(CHARACTER_PICKER_PAGE_SIZE);
  }, [charSearch]);

  // On the preset step, wait for full preset data before allowing advance
  const isPresetStep = currentStep.key === "preset";
  const nextDisabled = isPresetStep && !!chat.promptPresetId && presetFullLoading;

  const next = useCallback(() => {
    if (isLast) {
      void finishWizard();
    } else {
      // When leaving the preset step (index 1), show the choice modal if the preset has variables
      if (currentStep.key === "preset" && chat.promptPresetId && presetFull?.choiceBlocks?.length) {
        setShowChoiceModal(true);
        return;
      }
      setStep((s) => s + 1);
      setCharSearch("");
      setLbSearch("");
      setAgentSearch("");
      setAgentAddPreview(null);
    }
  }, [isLast, finishWizard, currentStep.key, chat.promptPresetId, presetFull?.choiceBlocks?.length]);

  const previous = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
    setCharSearch("");
    setLbSearch("");
    setAgentSearch("");
    setAgentAddPreview(null);
  }, []);

  const openAgentAddPreview = useCallback(
    (agent: AvailableAgent) => {
      const config = agentConfigsByType.get(agent.id) ?? null;
      const mergedSettings = mergeBuiltInAgentSettings(agent.id, config?.settings);
      const intervalMeta = getAgentRunIntervalMeta(agent.id, agent.builtIn);
      setAgentAddPreview({
        agent,
        config,
        contextSize: normalizePositiveInteger(mergedSettings.contextSize, DEFAULT_AGENT_CONTEXT_SIZE, 200),
        maxTokens: normalizeAgentMaxTokens(mergedSettings.maxTokens),
        runInterval: intervalMeta
          ? normalizePositiveInteger(mergedSettings.runInterval, intervalMeta.defaultValue, intervalMeta.max)
          : null,
        setup: buildInitialAgentAddSetupState({
          agentId: agent.id,
          settings: mergedSettings,
          metadata,
          musicPlayerSource,
          roleplaySpriteScale,
          allowSecretPlot: supportsNarrativeDirectorSecretPlot,
        }),
      });
    },
    [agentConfigsByType, metadata, musicPlayerSource, roleplaySpriteScale, supportsNarrativeDirectorSecretPlot],
  );

  const removeAgentFromChat = useCallback(
    (agentId: string) => {
      const latestActiveAgentIds = readLatestActiveAgentIds();
      updateMeta.mutate({
        id: chat.id,
        activeAgentIds: latestActiveAgentIds.filter((id) => id !== agentId),
      });
      if (agentAddPreview?.agent.id === agentId) setAgentAddPreview(null);
    },
    [agentAddPreview?.agent.id, chat.id, readLatestActiveAgentIds, updateMeta],
  );

  const confirmAddAgent = useCallback(async () => {
    if (!agentAddPreview) return;
    const { agent, config, contextSize, maxTokens, runInterval, setup } = agentAddPreview;
    const builtInMeta = installedAgentManifests.find((entry) => entry.id === agent.id) ?? null;
    let nextSettings: Record<string, unknown> = {
      ...mergeBuiltInAgentSettings(agent.id, config?.settings),
      contextSize,
      maxTokens: normalizeAgentMaxTokens(maxTokens),
    };
    const intervalMeta = getAgentRunIntervalMeta(agent.id, !!builtInMeta);
    if (intervalMeta && runInterval != null) nextSettings.runInterval = runInterval;
    nextSettings = applyAgentAddSetupToAgentSettings(agent.id, setup, nextSettings, {
      allowSecretPlot: supportsNarrativeDirectorSecretPlot,
    });
    const nextEnabledTools = nextSettings.enabledTools;
    if (
      builtInMeta &&
      (!Array.isArray(nextEnabledTools) ||
        (agent.id === "spotify" && nextSettings.musicProvider === "spotify" && nextEnabledTools.length === 0))
    ) {
      nextSettings.enabledTools = DEFAULT_AGENT_TOOLS[agent.id] ?? [];
    }

    setAddingAgentToChat(true);
    try {
      if (builtInMeta?.execution === "feature") {
        // Feature packages own their settings and runtime; chat activation is enough.
      } else if (config) {
        await updateAgentConfig.mutateAsync({ id: config.id, settings: nextSettings });
      } else if (builtInMeta) {
        await createAgent.mutateAsync({
          type: builtInMeta.id,
          name: agent.name,
          description: agent.description,
          phase: normalizeAgentPhaseForType(agent.id, agent.phase),
          connectionId: null,
          promptTemplate: "",
          settings: nextSettings,
        });
      }

      await updateMeta.mutateAsync({
        id: chat.id,
        enableAgents: true,
        activeAgentIds: Array.from(new Set([...readLatestActiveAgentIds(), agent.id])),
        ...buildAgentAddMetadataPatch(agent.id, setup, metadata, {
          allowSecretPlot: supportsNarrativeDirectorSecretPlot,
          defaultPromptTemplateId: resolveDefaultAgentPromptTemplateId(nextSettings),
        }),
      });
      toast.success(`Added ${agent.name}! You can access its settings in Agents section in Chat Settings!`);
      setAgentAddPreview(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add this agent to the chat.");
    } finally {
      setAddingAgentToChat(false);
    }
  }, [
    agentAddPreview,
    chat.id,
    createAgent,
    installedAgentManifests,
    metadata,
    readLatestActiveAgentIds,
    supportsNarrativeDirectorSecretPlot,
    updateAgentConfig,
    updateMeta,
  ]);

  // ─── Step content renderers ───────────────────

  function renderConnection() {
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className={WIZARD_FIELD_LABEL}>Name</label>
          <input
            type="text"
            key={userEditedName ? "user" : chat.name}
            defaultValue={chat.name}
            onBlur={(event) => {
              const value = event.target.value.trim();
              if (value && value !== chat.name) {
                setUserEditedName(true);
                updateChat.mutate({ id: chat.id, name: value });
              }
            }}
            placeholder="Roleplay name"
            className={WIZARD_INPUT_CLASS}
          />
        </div>
        <select
          value={chat.connectionId ?? ""}
          onChange={(e) => setConnection(e.target.value || null)}
          className={WIZARD_INPUT_CLASS}
        >
          <option value="">None</option>
          <option value="random">Random</option>
          {connectionOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {connectionOptions.length === 0 && (
          <button
            onClick={() => {
              openRightPanel("connections");
              onFinish();
            }}
            className={WIZARD_SECONDARY_BUTTON_CLASS}
          >
            <Plug size="0.8125rem" />
            Set Up a Connection
          </button>
        )}
        <SetupGenerationParametersPanel
          enabled={customizeParameters}
          value={generationParameters}
          showOpenRouterServiceTier={selectedConnection?.provider === "openrouter"}
          onEnabledChange={setCustomizeParameters}
          onChange={setGenerationParameters}
        />
      </div>
    );
  }

  function renderPreset() {
    return (
      <select
        value={chat.promptPresetId ?? ""}
        onChange={(e) => setPreset(e.target.value || null)}
        className={WIZARD_INPUT_CLASS}
      >
        <option value="">None</option>
        {((presets ?? []) as Array<{ id: string; name: string; isDefault?: boolean | string }>).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    );
  }

  function renderPersona() {
    return <PersonaPicker personas={personas} value={chat.personaId ?? null} onChange={setPersona} />;
  }

  function renderCharacters() {
    const available = characters.filter((c) => {
      if (chatCharIds.includes(c.id)) return false;
      return characterMatchesSearch(getCharacterInfo(c), charSearch);
    });
    const visibleAvailable = available.slice(0, characterPickerLimit);
    const hasMoreAvailable = available.length > visibleAvailable.length;
    const addRandomCharacter = () => {
      const selected = new Set(chatCharIds);
      const pool = characters.filter((character) => {
        if (selected.has(character.id)) return false;
        return characterMatchesSearch(getCharacterInfo(character), charSearch);
      });
      const character = pool[Math.floor(Math.random() * pool.length)];
      if (character) toggleCharacter(character.id);
    };

    return (
      <div className="space-y-2">
        {/* Added characters */}
        {chatCharIds.length > 0 && (
          <div className="flex flex-col gap-1">
            {chatCharIds.map((cid) => {
              const c = characters.find((ch) => ch.id === cid);
              if (!c) return null;
              const name = charName(c);
              const title = charTitle(c);
              return (
                <div
                  key={cid}
                  className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30"
                >
                  {c.avatarPath ? (
                    <CharacterAvatarImage
                      character={c}
                      src={c.avatarPath}
                      alt={name}
                      className="h-6 w-6 rounded-full"
                    />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[0.5625rem] font-bold">
                      {name[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs">{name}</span>
                    {title && (
                      <span className="block truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                        {title}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => toggleCharacter(cid)}
                    className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                    title="Remove"
                  >
                    <Trash2 size="0.6875rem" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Search + add */}
        <div className="rounded-lg ring-1 ring-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            <Search size="0.75rem" className="text-[var(--muted-foreground)]" />
            <input
              value={charSearch}
              onChange={(e) => setCharSearch(e.target.value)}
              placeholder="Search characters…"
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]"
            />
          </div>
          {characterFolders.length > 0 && (
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
              <FolderOpen size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
              <select
                value={selectedRoleplayFolderId}
                onChange={(event) => setSelectedRoleplayFolderId(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-xs text-[var(--foreground)] outline-none"
                aria-label="Add characters from folder"
              >
                <option value="">Add from Folder</option>
                {characterFolders.map((folder) => {
                  const newCount = getAddableFolderCharacterIds(folder).length;
                  return (
                    <option key={folder.id} value={folder.id}>
                      {folder.name} ({newCount > 0 ? `${newCount} new` : "all added"})
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                onClick={() => {
                  addCharactersFromFolder(selectedRoleplayFolderId);
                  setSelectedRoleplayFolderId("");
                }}
                disabled={!selectedRoleplayFolderId}
                className="rounded-lg bg-[var(--primary)]/15 px-2.5 py-1 text-[0.625rem] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add
              </button>
            </div>
          )}
          <div className="max-h-32 overflow-y-auto">
            {available.length > 0 && (
              <button
                type="button"
                onClick={addRandomCharacter}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)] ring-1 ring-[var(--primary)]/25">
                  <Dices size="0.8125rem" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs">Random</span>
                  <span className="block truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                    Dice pick
                  </span>
                </div>
                <Plus size="0.75rem" className="text-[var(--muted-foreground)]" />
              </button>
            )}
            {visibleAvailable.map((c) => {
              const name = charName(c);
              const title = charTitle(c);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCharacter(c.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
                >
                  {c.avatarPath ? (
                    <CharacterAvatarImage
                      character={c}
                      src={c.avatarPath}
                      alt={name}
                      className="h-6 w-6 rounded-full"
                    />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[0.5625rem] font-bold">
                      {name[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs">{name}</span>
                    {title && (
                      <span className="block truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                        {title}
                      </span>
                    )}
                  </div>
                  <Plus size="0.75rem" className="text-[var(--muted-foreground)]" />
                </button>
              );
            })}
            {hasMoreAvailable && (
              <button
                type="button"
                onClick={() => setCharacterPickerLimit((limit) => limit + CHARACTER_PICKER_PAGE_SIZE)}
                className="w-full border-t border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10"
              >
                Load more ({visibleAvailable.length} of {available.length})
              </button>
            )}
            {available.length === 0 && (
              <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                {characters.filter((c) => !chatCharIds.includes(c.id)).length === 0
                  ? "All characters already added."
                  : "No matches."}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderParticipants() {
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className={WIZARD_FIELD_LABEL}>Your Persona</label>
          {renderPersona()}
        </div>
        <div className="space-y-1.5">
          <label className={WIZARD_FIELD_LABEL}>
            {chatCharIds.length > 1 ? (
              <span className="flex items-center gap-1.5">
                <Users size="0.6875rem" />
                Characters · {chatCharIds.length}
              </span>
            ) : (
              "Characters"
            )}
          </label>
          {renderCharacters()}
        </div>
      </div>
    );
  }

  function renderLorebooks() {
    const available = ((lorebooks ?? []) as Array<{ id: string; name: string }>).filter(
      (lb) => !activeLorebookIds.includes(lb.id) && lb.name.toLowerCase().includes(lbSearch.toLowerCase()),
    );

    return (
      <div className="space-y-2">
        {/* Active lorebooks */}
        {activeLorebookIds.length > 0 && (
          <div className="flex flex-col gap-1">
            {activeLorebookIds.map((lbId) => {
              const lb = ((lorebooks ?? []) as Array<{ id: string; name: string }>).find((l) => l.id === lbId);
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
                    title="Remove"
                  >
                    <Trash2 size="0.6875rem" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Search + add */}
        <div className="rounded-lg ring-1 ring-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            <Search size="0.75rem" className="text-[var(--muted-foreground)]" />
            <input
              value={lbSearch}
              onChange={(e) => setLbSearch(e.target.value)}
              placeholder="Search lorebooks…"
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]"
            />
          </div>
          <div className="max-h-32 overflow-y-auto">
            {available.map((lb) => (
              <button
                key={lb.id}
                onClick={() => toggleLorebook(lb.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
              >
                <BookOpen size="0.875rem" className="text-[var(--muted-foreground)]" />
                <span className="flex-1 truncate text-xs">{lb.name}</span>
                <Plus size="0.75rem" className="text-[var(--muted-foreground)]" />
              </button>
            ))}
            {available.length === 0 && (
              <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                {((lorebooks ?? []) as Array<{ id: string }>).filter((lb) => !activeLorebookIds.includes(lb.id))
                  .length === 0
                  ? "All lorebooks already added."
                  : "No matches."}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderAgents() {
    const agentCategorySections = [
      { category: "writer", title: "Writer Agents" },
      { category: "tracker", title: "Tracker Agents" },
      { category: "misc", title: "Misc Agents" },
      { category: "custom", title: "Custom Agents" },
    ] as const;
    const filteredAgents = availableAgents.filter((agent) => {
      const query = agentSearch.toLowerCase();
      return (
        agent.name.toLowerCase().includes(query) ||
        agent.description.toLowerCase().includes(query) ||
        agent.category.toLowerCase().includes(query)
      );
    });
    const knownAgentCategories = new Set<string>(agentCategorySections.map((section) => section.category));
    const unknownAgentCategories = Array.from(
      new Set(filteredAgents.map((agent) => agent.category).filter((category) => !knownAgentCategories.has(category))),
    );
    const filteredAgentSections = [
      ...agentCategorySections.map((section) => ({
        ...section,
        agents: filteredAgents.filter((agent) => agent.category === section.category),
      })),
      ...unknownAgentCategories.map((category) => ({
        category,
        title: category.trim()
          ? `${category.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())} Agents`
          : "Other Agents",
        agents: filteredAgents.filter((agent) => agent.category === category),
      })),
    ].filter((section) => section.agents.length > 0);
    const agentAddIntervalMeta = agentAddPreview
      ? getAgentRunIntervalMeta(agentAddPreview.agent.id, agentAddPreview.agent.builtIn)
      : null;

    if (agentConfigsLoading || installedAgentsLoading) {
      return (
        <div className="flex min-h-40 items-center justify-center gap-2 text-xs text-[var(--muted-foreground)]">
          <Loader2 size="0.875rem" className="animate-spin" />
          Loading agents…
        </div>
      );
    }

    if (availableAgents.length === 0) {
      return (
        <div
          data-component="ChatSetupWizard.AgentEmptyState"
          className="flex min-h-52 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--secondary)]/35 px-5 py-8 text-center"
        >
          <p className="max-w-sm text-sm font-medium leading-6 text-[var(--muted-foreground)]">
            No agents downloaded yet. Head to Agents tab and click Download Agents to get some!
          </p>
          <button
            type="button"
            onClick={() => {
              onFinish();
              openRightPanel("agents");
            }}
            className={cn(WIZARD_PRIMARY_BUTTON_CLASS, "gap-2")}
          >
            <Sparkles size="0.8125rem" />
            Open Agents tab
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <button
          onClick={() =>
            updateMeta.mutate({
              id: chat.id,
              enableAgents: !agentsEnabled,
              activeAgentIds: !agentsEnabled ? readLatestActiveAgentIds() : [],
            })
          }
          className={cn(
            "mari-chat-option-field flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
            agentsEnabled && "mari-chat-option-field--active",
          )}
        >
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium">Enable Agents</span>
            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
              Add optional helpers to this roleplay. You can edit detailed agent menus later in Chat Settings.
            </p>
          </div>
          <div
            className={cn(
              "mari-chat-option-switch h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
              agentsEnabled && "mari-chat-option-switch--active",
            )}
          >
            <div
              className={cn(
                "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                agentsEnabled && "translate-x-3.5",
              )}
            />
          </div>
        </button>

        {agentsEnabled && (
          <>
            {agentAddPreview && (
              <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/70 p-3">
                <div className="flex items-start gap-2">
                  <Sparkles size="0.875rem" className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{agentAddPreview.agent.name}</p>
                      <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[0.5625rem] uppercase tracking-wide text-[var(--muted-foreground)]">
                        {agentAddPreview.agent.builtIn ? agentAddPreview.agent.category : "custom"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                      {agentAddPreview.agent.description || "No description available."}
                    </p>
                  </div>
                </div>

                {agentAddPreview.agent.execution === "feature" ? (
                  <p className="rounded-lg bg-[var(--accent)] px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                    This lets characters initiate the downloaded feature in this chat. Manual controls supplied by the
                    installed package remain available independently, and no separate agent model call is used.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                        Context Size
                      </span>
                      <DraftNumberInput
                        min={1}
                        max={200}
                        value={agentAddPreview.contextSize}
                        onCommit={(value) => {
                          setAgentAddPreview((current) =>
                            current
                              ? {
                                  ...current,
                                  contextSize: Math.max(1, Math.min(200, value)),
                                }
                              : current,
                          );
                        }}
                        disabled={addingAgentToChat}
                        selectOnFocus
                        className={WIZARD_NUMBER_INPUT_CLASS}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                        Max Output Tokens
                      </span>
                      <DraftNumberInput
                        min={MIN_AGENT_MAX_TOKENS}
                        value={agentAddPreview.maxTokens}
                        onCommit={(value) => {
                          setAgentAddPreview((current) =>
                            current
                              ? {
                                  ...current,
                                  maxTokens: normalizeAgentMaxTokensInputValue(value),
                                }
                              : current,
                          );
                        }}
                        disabled={addingAgentToChat}
                        selectOnFocus
                        className={WIZARD_NUMBER_INPUT_CLASS}
                      />
                    </label>
                  </div>
                )}

                {agentAddIntervalMeta && agentAddPreview.runInterval != null && (
                  <label className="space-y-1">
                    <span className="block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                      {agentAddIntervalMeta.label}
                    </span>
                    <DraftNumberInput
                      min={1}
                      max={agentAddIntervalMeta.max}
                      value={agentAddPreview.runInterval}
                      onCommit={(value) => {
                        setAgentAddPreview((current) =>
                          current
                            ? {
                                ...current,
                                runInterval: Math.max(1, Math.min(agentAddIntervalMeta.max, value)),
                              }
                            : current,
                        );
                      }}
                      disabled={addingAgentToChat}
                      selectOnFocus
                      className={WIZARD_NUMBER_INPUT_CLASS}
                    />
                    <span className="block text-[0.5625rem] text-[var(--muted-foreground)]">
                      {agentAddIntervalMeta.help}
                    </span>
                  </label>
                )}

                <AgentAddSetupFields
                  agentId={agentAddPreview.agent.id}
                  value={agentAddPreview.setup}
                  disabled={addingAgentToChat}
                  lorebooks={(lorebooks ?? []) as Lorebook[]}
                  promptOptions={getPromptOptionsForAgent(agentAddPreview.agent.id)}
                  spriteSubjects={agentAddSpriteSubjects}
                  allowSecretPlotControls={supportsNarrativeDirectorSecretPlot}
                  onChange={(patch) =>
                    setAgentAddPreview((current) =>
                      current ? { ...current, setup: { ...current.setup, ...patch } } : current,
                    )
                  }
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAgentAddPreview(null)}
                    disabled={addingAgentToChat}
                    className={WIZARD_GHOST_BUTTON_CLASS}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmAddAgent()}
                    disabled={addingAgentToChat}
                    className={WIZARD_PRIMARY_BUTTON_CLASS}
                  >
                    {addingAgentToChat ? "Adding..." : "Add Agent"}
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-lg bg-[var(--secondary)]/50 ring-1 ring-[var(--border)]">
              <div className="flex items-center gap-2 px-3 py-2">
                <Search size="0.75rem" className="text-[var(--muted-foreground)]" />
                <input
                  value={agentSearch}
                  onChange={(event) => setAgentSearch(event.target.value)}
                  placeholder="Search agents..."
                  className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]"
                />
              </div>
              <div className="max-h-56 overflow-y-auto border-t border-[var(--border)]">
                {filteredAgentSections.map((section) => {
                  const activeCount = section.agents.filter((agent) => activeAgentIds.includes(agent.id)).length;
                  return (
                    <div key={section.category} className="border-b border-[var(--border)]/70 last:border-b-0">
                      <div className="sticky top-0 z-10 flex items-center justify-between bg-[var(--secondary)]/95 px-3 py-1.5 backdrop-blur-sm">
                        <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                          {section.title}
                        </span>
                        <span className="rounded-full bg-[var(--background)]/70 px-1.5 py-0.5 text-[0.5625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                          {activeCount > 0 ? `${activeCount}/${section.agents.length}` : section.agents.length}
                        </span>
                      </div>
                      {section.agents.map((agent) => {
                        const active = activeAgentIds.includes(agent.id);
                        return (
                          <button
                            key={agent.id}
                            type="button"
                            onClick={() => (active ? removeAgentFromChat(agent.id) : openAgentAddPreview(agent))}
                            className={cn(
                              "flex w-full items-start gap-2.5 px-3 py-2 text-left transition-all hover:bg-[var(--accent)]",
                              active && "bg-[var(--primary)]/10",
                            )}
                          >
                            <Sparkles size="0.8125rem" className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
                            <div className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium">{agent.name}</span>
                              <span className="mt-0.5 line-clamp-2 block text-[0.625rem] leading-tight text-[var(--muted-foreground)]">
                                {agent.description}
                              </span>
                            </div>
                            <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                              {active ? "Added" : "Add"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
                {filteredAgentSections.length === 0 && (
                  <p className="px-3 py-3 text-center text-[0.6875rem] text-[var(--muted-foreground)]">
                    {availableAgents.length === 0 ? "No agents available." : "No matching agents."}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  const stepRenderers: Record<string, () => React.ReactNode> = {
    connection: renderConnection,
    preset: renderPreset,
    participants: renderParticipants,
    lorebooks: renderLorebooks,
    agents: renderAgents,
  };

  const shortcutStep: WizardStep = {
    key: "shortcut",
    title: "Use Settings Presets",
    body: "Pick a saved chat-settings preset, your persona, and any characters in one compact setup pass.",
  };
  const shortcutContent = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className={WIZARD_FIELD_LABEL}>Chat Preset</label>
        <select
          value={shortcutPresetId}
          onChange={(event) => setShortcutPresetId(event.target.value)}
          className={WIZARD_INPUT_CLASS}
        >
          {chatPresetList.length === 0 && <option value="">Loading...</option>}
          {chatPresetList.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.isDefault ? "Default" : preset.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className={WIZARD_FIELD_LABEL}>Persona</label>
        <PersonaPicker personas={personas} value={chat.personaId ?? null} onChange={setPersona} />
      </div>

      <div className="space-y-1.5">
        <label className={WIZARD_FIELD_LABEL}>
          {chatCharIds.length > 1 ? (
            <span className="flex items-center gap-1.5">
              <Users size="0.6875rem" />
              Characters · {chatCharIds.length}
            </span>
          ) : (
            "Characters"
          )}
        </label>
        {renderCharacters()}
      </div>
    </div>
  );

  return (
    <>
      <WizardBackdrop onClose={onFinish} />

      <ChoiceSelectionModal
        open={showChoiceModal}
        onClose={() => {
          setShowChoiceModal(false);
          setStep((s) => s + 1);
          setCharSearch("");
          setLbSearch("");
          setAgentSearch("");
          setAgentAddPreview(null);
        }}
        presetId={chat.promptPresetId ?? null}
        chatId={chat.id}
      />

      {!showChoiceModal &&
        (shortcutMode ? (
          <SetupWizardShell
            title="Quick Setup"
            steps={[shortcutStep]}
            step={0}
            currentStep={shortcutStep}
            animationKey="roleplay-shortcut"
            onClose={onFinish}
            onBack={() => setShortcutMode(false)}
            onSkip={onFinish}
            onPrimary={handleShortcutApply}
            primaryLabel={shortcutApplying ? "Applying..." : "Apply & Start"}
            primaryIcon={shortcutApplying ? <Loader2 size="0.75rem" className="animate-spin" /> : undefined}
            primaryDisabled={shortcutApplying || !shortcutPresetId}
          >
            {shortcutContent}
          </SetupWizardShell>
        ) : (
          <SetupWizardShell
            title="New Roleplay"
            steps={STEPS}
            step={step}
            currentStep={currentStep}
            animationKey={`roleplay-${currentStep.key}`}
            onClose={onFinish}
            onBack={step > 0 ? previous : undefined}
            onSkip={onFinish}
            onPrimary={next}
            primaryLabel={isLast ? "Start" : "Next"}
            primaryIcon={isLast ? <Check size="0.75rem" /> : <ChevronRight size="0.75rem" />}
            primaryDisabled={nextDisabled}
            secondaryAction={
              <button
                type="button"
                onClick={() => setShortcutMode(true)}
                title="Apply a saved chat-settings preset and pick a persona plus characters in one step"
                className={WIZARD_SECONDARY_BUTTON_CLASS}
              >
                <span className="hidden xs:inline sm:inline">Use Settings Presets</span>
                <span className="inline xs:hidden sm:hidden">Presets</span>
              </button>
            }
          >
            {stepRenderers[currentStep.key]?.()}
          </SetupWizardShell>
        ))}
    </>
  );
}
