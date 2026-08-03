// ──────────────────────────────────────────────
// TTS Configuration Card (Connections Panel)
// ──────────────────────────────────────────────
import { useCallback, useState, useEffect, useId, useLayoutEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Volume2,
  Key,
  Globe,
  Check,
  Loader2,
  RefreshCw,
  Play,
  Square,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Download,
  Search,
  UserRound,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { toast } from "sonner";
import { useTTSConfig, useUpdateTTSConfig, useTTSModels, useTTSVoices } from "../../../hooks/use-tts";
import { useCharacters } from "../../../hooks/use-characters";
import { ttsService } from "../../../lib/tts-service";
import {
  listCachedTTSAudioEntries,
  listCachedTTSAudioMeta,
  type CachedTTSAudioExportEntry,
} from "../../../lib/tts-audio-cache";
import { parseCharacterDisplayData } from "../../../lib/character-display";
import type {
  TTSConfig,
  TTSSource,
  TTSSourceProfile,
  TTSSourceProfiles,
  TTSVoiceAssignment,
  TTSVoiceMode,
  TTSAudioFormat,
  TTSConversationCallAudioInputMode,
} from "@marinara-engine/shared";
import {
  ELEVENLABS_TTS_LANGUAGE_OPTIONS,
  TTS_API_KEY_MASK,
  TTS_DIALOGUE_PAUSE_DEFAULT_SECONDS,
  TTS_DIALOGUE_PAUSE_MAX_SECONDS,
  TTS_DIALOGUE_PAUSE_MIN_SECONDS,
  ttsSourceProfileFromConfig,
} from "@marinara-engine/shared";
import { HelpTooltip } from "../../ui/HelpTooltip";
import { SettingsCheckbox, SettingsSwitch } from "./SettingControls";
import { useTranslation as useUiTranslation } from "react-i18next";
import { ApiError } from "../../../lib/api-client";

// ── Sub-components ───────────────────────────────

function FieldRow({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium text-[var(--foreground)]">{label}</span>
        {help && <HelpTooltip text={help} />}
      </div>
      {children}
    </div>
  );
}

const INPUT_CLS = "mari-chrome-field w-full px-3 py-2.5 text-sm placeholder:text-[var(--muted-foreground)]";

const TTS_SOURCE_DEFAULTS: Record<
  TTSSource,
  { label: string; baseUrl: string; model: string; voice: string; idleText: string }
> = {
  openai: {
    label: "OpenAI-compatible",
    baseUrl: "https://api.openai.com/v1",
    model: "tts-1",
    voice: "alloy",
    idleText: "OpenAI-compatible TTS",
  },
  elevenlabs: {
    label: "ElevenLabs",
    baseUrl: "https://api.elevenlabs.io",
    model: "eleven_multilingual_v2",
    voice: "",
    idleText: "ElevenLabs TTS",
  },
  pockettts: {
    label: "PocketTTS",
    baseUrl: "http://localhost:8000",
    model: "pocket-tts",
    voice: "alba",
    idleText: "Local PocketTTS",
  },
  xai: {
    label: "xAI Voice",
    baseUrl: "https://api.x.ai/v1",
    model: "grok-tts",
    voice: "eve",
    idleText: "xAI Voice",
  },
};

const TTS_SOURCE_OPTIONS: Array<{ value: TTSSource; label: string }> = [
  { value: "openai", label: "OpenAI-compatible" },
  { value: "elevenlabs", label: "ElevenLabs" },
  { value: "pockettts", label: "PocketTTS" },
  { value: "xai", label: "xAI Voice" },
];

function defaultSourceProfile(source: TTSSource): TTSSourceProfile {
  const defaults = TTS_SOURCE_DEFAULTS[source];
  return {
    baseUrl: defaults.baseUrl,
    apiKey: "",
    voice: defaults.voice,
    model: defaults.model,
    speed: 1,
    elevenLabsStability: 0.5,
    elevenLabsLanguageCode: "",
    elevenLabsGameSoundEffects: false,
    elevenLabsGameMusic: false,
    voiceMode: "single",
    voiceAssignments: [],
    narratorVoiceEnabled: false,
    narratorVoice: defaults.voice,
    npcDefaultVoicesEnabled: false,
    npcDefaultMaleVoices: [],
    npcDefaultFemaleVoices: [],
    audioFormat: "mp3",
  };
}

const ELEVENLABS_TTS_MODELS = [
  "eleven_v3",
  "eleven_multilingual_v2",
  "eleven_flash_v2_5",
  "eleven_turbo_v2_5",
  "eleven_flash_v2",
];

const ELEVENLABS_DEFAULT_VOICE_OPTIONS: VoiceOption[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", category: "ElevenLabs default" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", category: "ElevenLabs default" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", category: "ElevenLabs default" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", category: "ElevenLabs default" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", category: "ElevenLabs default" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", category: "ElevenLabs default" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", category: "ElevenLabs default" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", category: "ElevenLabs default" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", category: "ElevenLabs default" },
];

type CharacterOption = {
  id: string;
  name: string;
  label: string;
};

type VoiceOption = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  labels?: Record<string, string | number | boolean | null> | null;
};

function getTtsRequestErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const payload =
      error.payload && typeof error.payload === "object" && !Array.isArray(error.payload)
        ? (error.payload as Record<string, unknown>)
        : null;
    const rawDetail = payload?.detail;
    const nestedDetail =
      rawDetail && typeof rawDetail === "object" && !Array.isArray(rawDetail)
        ? (rawDetail as Record<string, unknown>)
        : null;
    const detail =
      typeof rawDetail === "string"
        ? rawDetail.trim()
        : typeof nestedDetail?.message === "string"
          ? nestedDetail.message.trim()
          : "";
    return [error.message || fallback, detail].filter(Boolean).join(": ");
  }
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function addSavedVoiceOption(options: VoiceOption[], voiceId: string): VoiceOption[] {
  const id = voiceId.trim();
  if (!id || options.some((option) => option.id === id)) return options;
  return [...options, { id, name: id, category: "saved" }];
}

function formatVoiceOptionLabel(option: VoiceOption): string {
  if (option.category === "saved") return `${option.id} (saved; not in current voice list)`;
  return option.name === option.id ? option.id : `${option.name} (${option.id})`;
}

function formatCacheBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function extensionForTTSBlob(blob: Blob): string {
  const type = blob.type.toLowerCase();
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("wav")) return "wav";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("webm")) return "webm";
  if (type.includes("mp4") || type.includes("m4a")) return "m4a";
  return "audio";
}

function safeTTSFileStem(value: string): string {
  return (
    value
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "tts-clip"
  );
}

function downloadTTSClip(entry: CachedTTSAudioExportEntry, index: number): void {
  const url = URL.createObjectURL(entry.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${String(index + 1).padStart(3, "0")}-${safeTTSFileStem(entry.key)}.${extensionForTTSBlob(entry.blob)}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const ELEVENLABS_DEFAULT_MALE_VOICE_NAMES = new Set([
  "adam",
  "antoni",
  "arnold",
  "baxter",
  "bill",
  "brian",
  "callum",
  "caleb",
  "charlie",
  "chris",
  "clyde",
  "daniel",
  "darian",
  "dave",
  "drew",
  "eddie",
  "eldrin",
  "eric",
  "ethan",
  "fin",
  "finley",
  "george",
  "giovanni",
  "harry",
  "james",
  "jeremy",
  "joseph",
  "josh",
  "kaelen",
  "kellan",
  "lawrence",
  "liam",
  "michael",
  "patrick",
  "paul",
  "roger",
  "river",
  "ryan",
  "sam",
  "sawyer",
  "thomas",
  "warren",
  "will",
  "wyatt",
]);

const ELEVENLABS_DEFAULT_FEMALE_VOICE_NAMES = new Set([
  "alice",
  "alicia",
  "aria",
  "charlotte",
  "domi",
  "dorothy",
  "elli",
  "elara",
  "elowen",
  "emily",
  "florence",
  "freya",
  "gigi",
  "glinda",
  "grace",
  "jade",
  "jessica",
  "laura",
  "lily",
  "maisie",
  "matilda",
  "mimi",
  "nicole",
  "rachel",
  "river",
  "sarah",
  "serena",
  "talia",
]);

function normalizeVoiceName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function readVoiceMetadata(option: VoiceOption): string {
  return [
    option.name,
    option.id,
    option.description,
    option.category,
    ...Object.entries(option.labels ?? {}).flatMap(([key, value]) => [key, String(value ?? "")]),
  ]
    .filter(Boolean)
    .map(String)
    .join(" ");
}

function inferVoiceOptionGender(option: VoiceOption): "male" | "female" | null {
  const metadata = normalizeVoiceName(readVoiceMetadata(option));
  if (/\b(female|feminine|woman|girl|lady)\b/.test(metadata)) return "female";
  if (/\b(male|masculine|man|boy|gentleman)\b/.test(metadata)) return "male";
  return null;
}

function isElevenLabsVoiceForGender(option: VoiceOption, gender: "male" | "female", names: Set<string>): boolean {
  const inferredGender = inferVoiceOptionGender(option);
  if (inferredGender) return inferredGender === gender;

  const normalizedName = normalizeVoiceName(option.name);
  const normalizedId = normalizeVoiceName(option.id);
  return names.has(normalizedName) || names.has(normalizedId);
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <SettingsCheckbox label={label} checked={checked} onChange={onChange} align="between" />;
}

function TtsDropdownIcon({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={cn(
        "mari-chrome-control mari-chrome-control--small pointer-events-none absolute right-1.5 top-1/2 flex min-w-0 -translate-y-1/2 items-center justify-center p-0",
        compact ? "h-6 w-6" : "h-7 w-7",
      )}
      aria-hidden="true"
    >
      <ChevronDown size={compact ? "0.6875rem" : "0.75rem"} />
    </span>
  );
}

type TtsSearchableSelectOption = {
  id: string;
  label: string;
  searchText: string;
  disabled?: boolean;
};

function TtsSearchableSelect({
  value,
  options,
  disabled,
  placeholder,
  ariaLabel,
  searchPlaceholder,
  emptyText,
  optionKind,
  testId,
  compact = false,
  onChange,
}: {
  value: string;
  options: TtsSearchableSelectOption[];
  disabled: boolean;
  placeholder: string;
  ariaLabel: string;
  searchPlaceholder: string;
  emptyText: string;
  optionKind: "character" | "voice";
  testId: string;
  compact?: boolean;
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(
    null,
  );
  const selected = options.find((option) => option.id === value);
  const normalizedSearch = search.trim().toLowerCase();
  const filteredOptions = normalizedSearch
    ? options.filter((option) => option.searchText.toLowerCase().includes(normalizedSearch))
    : options;
  const closePanel = useCallback((restoreFocus = true) => {
    setOpen(false);
    setSearch("");
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        closePanel(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [closePanel, open]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const trigger = rootRef.current;
      if (!trigger) return;
      const triggerRect = trigger.getBoundingClientRect();
      const viewportPadding = 12;
      const gap = 6;
      const preferredWidth = compact ? 352 : 384;
      const width = Math.min(
        Math.max(triggerRect.width, preferredWidth),
        Math.max(0, window.innerWidth - viewportPadding * 2),
      );
      const left = Math.min(
        Math.max(triggerRect.left, viewportPadding),
        Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
      );
      const availableBelow = window.innerHeight - triggerRect.bottom - viewportPadding - gap;
      const availableAbove = triggerRect.top - viewportPadding - gap;
      const desiredHeight = Math.min(panelRef.current?.offsetHeight ?? 320, 320);
      const openAbove = availableBelow < Math.min(220, desiredHeight) && availableAbove > availableBelow;
      const maxHeight = Math.max(160, Math.min(320, openAbove ? availableAbove : availableBelow));
      const panelHeight = Math.min(panelRef.current?.offsetHeight ?? desiredHeight, maxHeight);
      const top = openAbove
        ? Math.max(viewportPadding, triggerRect.top - panelHeight - gap)
        : Math.min(triggerRect.bottom + gap, window.innerHeight - panelHeight - viewportPadding);

      setPosition({ left, top, width, maxHeight });
    };

    let frame = 0;
    const schedulePositionUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updatePosition();
      });
    };

    updatePosition();
    schedulePositionUpdate();
    window.addEventListener("resize", schedulePositionUpdate);
    window.addEventListener("scroll", schedulePositionUpdate, true);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedulePositionUpdate);
      window.removeEventListener("scroll", schedulePositionUpdate, true);
    };
  }, [compact, open]);

  useEffect(() => {
    if (!disabled) return;
    setOpen(false);
    setSearch("");
  }, [disabled]);

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          INPUT_CLS,
          "relative flex min-w-0 cursor-pointer items-center pr-10 text-left disabled:cursor-not-allowed disabled:opacity-50",
          compact && "py-2 text-xs",
        )}
      >
        <span className={cn("truncate", !value && "text-[var(--muted-foreground)]")}>
          {(selected?.label ?? value) || placeholder}
        </span>
        <TtsDropdownIcon compact={compact} />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[10001] flex overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] p-1.5 shadow-2xl shadow-black/40"
            style={{
              left: position?.left ?? -9999,
              top: position?.top ?? -9999,
              width: position?.width ?? 0,
              maxHeight: position?.maxHeight ?? 320,
              opacity: position ? 1 : 0,
            }}
          >
            <div className="flex min-h-0 w-full flex-col">
              {options.length > 8 && (
                <label className="relative mb-1.5 block shrink-0">
                  <Search
                    size="0.75rem"
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--primary)]"
                  />
                  <input
                    autoFocus
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={searchPlaceholder}
                    className={cn(INPUT_CLS, "py-2 pl-8 text-xs")}
                  />
                </label>
              )}
              <div
                id={listboxId}
                role="listbox"
                aria-label={ariaLabel}
                data-testid={testId}
                className="min-h-0 overflow-x-hidden overflow-y-scroll pr-1 [scrollbar-color:var(--primary)_var(--secondary)] [scrollbar-gutter:stable] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--primary)] [&::-webkit-scrollbar-track]:bg-[var(--secondary)] [&::-webkit-scrollbar]:w-2"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={!value}
                  onClick={() => {
                    onChange("");
                    closePanel();
                  }}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-[var(--secondary)]",
                    !value && "bg-[var(--primary)]/10 text-[var(--primary)]",
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--secondary)] text-[var(--primary)]">
                    {optionKind === "character" ? <UserRound size="0.75rem" /> : <Volume2 size="0.75rem" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{placeholder}</span>
                  {!value && <Check size="0.75rem" className="shrink-0" />}
                </button>
                {filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={option.id === value}
                    aria-disabled={option.disabled || undefined}
                    disabled={option.disabled}
                    title={option.label}
                    onClick={() => {
                      onChange(option.id);
                      closePanel();
                    }}
                    className={cn(
                      "flex w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-[var(--secondary)] disabled:cursor-not-allowed disabled:opacity-40",
                      option.id === value && "bg-[var(--primary)]/10 text-[var(--primary)]",
                    )}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--secondary)] text-[var(--primary)]">
                      {optionKind === "character" ? <UserRound size="0.75rem" /> : <Volume2 size="0.75rem" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.id === value && <Check size="0.75rem" className="shrink-0" />}
                  </button>
                ))}
                {filteredOptions.length === 0 && (
                  <p className="px-2.5 py-3 text-center text-xs text-[var(--muted-foreground)]">{emptyText}</p>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function VoiceSelect({
  value,
  options,
  disabled,
  placeholder,
  ariaLabel,
  compact = false,
  onChange,
}: {
  value: string;
  options: VoiceOption[];
  disabled: boolean;
  placeholder: string;
  ariaLabel: string;
  compact?: boolean;
  onChange: (value: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <TtsSearchableSelect
      value={value}
      options={options.map((option) => ({
        id: option.id,
        label: formatVoiceOptionLabel(option),
        searchText: readVoiceMetadata(option),
      }))}
      disabled={disabled}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      searchPlaceholder={localizeUi("ui.panels.ttsconfigcard.searchVoices")}
      emptyText={localizeUi("ui.panels.ttsconfigcard.noMatchingVoices")}
      optionKind="voice"
      testId="tts-voice-options"
      compact={compact}
      onChange={onChange}
    />
  );
}

function CustomizableVoiceInput({
  value,
  options,
  placeholder,
  ariaLabel,
  testId,
  compact = false,
  onChange,
}: {
  value: string;
  options: VoiceOption[];
  placeholder: string;
  ariaLabel: string;
  testId: string;
  compact?: boolean;
  onChange: (value: string) => void;
}) {
  const listId = useId();
  return (
    <div className="min-w-0 flex-1">
      <input
        type="text"
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(INPUT_CLS, compact && "py-2 text-xs")}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        data-testid={testId}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {formatVoiceOptionLabel(option)}
          </option>
        ))}
      </datalist>
    </div>
  );
}

function CharacterSelect({
  value,
  options,
  assignedCharacterIds,
  onChange,
}: {
  value: string;
  options: CharacterOption[];
  assignedCharacterIds: Set<string>;
  onChange: (value: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <TtsSearchableSelect
      value={value}
      options={options.map((option) => ({
        id: option.id,
        label: option.label,
        searchText: `${option.name} ${option.label}`,
        disabled: assignedCharacterIds.has(option.id) && option.id !== value,
      }))}
      disabled={options.length === 0}
      placeholder={localizeUi("ui.panels.ttsconfigcard.selectCharacter")}
      ariaLabel={localizeUi("ui.panels.ttsconfigcard.selectCharacter")}
      searchPlaceholder={localizeUi("ui.panels.ttsconfigcard.searchCharacters")}
      emptyText={localizeUi("ui.panels.ttsconfigcard.noMatchingCharacters")}
      optionKind="character"
      testId="tts-character-options"
      compact
      onChange={onChange}
    />
  );
}

function PocketTTSVoiceControl({
  value,
  options,
  fetching,
  selectLabel,
  inputLabel,
  onChange,
}: {
  value: string;
  options: VoiceOption[];
  fetching: boolean;
  selectLabel: string;
  inputLabel: string;
  onChange: (value: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const selectedServerVoice = options.some((option) => option.id === value) ? value : "";

  return (
    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
      <div className="relative">
        <select
          aria-label={selectLabel}
          value={selectedServerVoice}
          onChange={(event) => {
            if (event.target.value) onChange(event.target.value);
          }}
          disabled={fetching || options.length === 0}
          className={cn(INPUT_CLS, "cursor-pointer appearance-none pr-10")}
        >
          <option value="">
            {fetching
              ? localizeUi("ui.panels.pocketttsvoicecontrol.loadingServerVoices")
              : localizeUi("ui.panels.pocketttsvoicecontrol.chooseServerVoice")}
          </option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {formatVoiceOptionLabel(option)}
            </option>
          ))}
        </select>
        <TtsDropdownIcon />
      </div>
      <input
        aria-label={inputLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLS}
        placeholder={localizeUi("ui.panels.pocketttsvoicecontrol.voiceIdUrlOrPath")}
      />
    </div>
  );
}

function NpcDefaultVoicePool({
  label,
  options,
  selected,
  onToggle,
  note,
}: {
  label: string;
  options: VoiceOption[];
  selected: string[];
  onToggle: (voiceId: string, checked: boolean) => void;
  note?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">{label}</span>
        <span className="text-[0.625rem] text-[var(--muted-foreground)]">
          {selected.length} {localizeUi("ui.panels.npcdefaultvoicepool.selected")}
        </span>
      </div>
      {options.length > 0 ? (
        <div className="grid gap-1 sm:grid-cols-2">
          {options.map((option) => (
            <label
              key={option.id}
              className="flex min-w-0 cursor-pointer items-center gap-2 rounded-lg bg-black/10 px-2 py-1.5 text-xs transition-colors hover:bg-black/20"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.id)}
                onChange={(e) => onToggle(option.id, e.target.checked)}
                className="h-3 w-3 shrink-0 rounded border-[var(--border)] accent-[var(--primary)]"
              />
              <span className="truncate">{formatVoiceOptionLabel(option)}</span>
            </label>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-[var(--border)] px-2.5 py-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
          {localizeUi("ui.panels.npcdefaultvoicepool.noProviderVoicesLoadedYet")}
        </p>
      )}
      {note && <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">{note}</p>}
    </div>
  );
}

// ── Main card ─────────────────────────────────────

export function TTSConfigCard() {
  const { t: localizeUi } = useUiTranslation();
  const { data: savedConfig, isLoading } = useTTSConfig();
  const updateConfig = useUpdateTTSConfig();
  const { data: characters } = useCharacters();

  // Local draft state
  const [enabled, setEnabled] = useState(false);
  const [source, setSource] = useState<TTSSource>("openai");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("tts-1");
  const [voice, setVoice] = useState("alloy");
  const [voiceMode, setVoiceMode] = useState<TTSVoiceMode>("single");
  const [voiceAssignments, setVoiceAssignments] = useState<TTSVoiceAssignment[]>([]);
  const [narratorVoiceEnabled, setNarratorVoiceEnabled] = useState(false);
  const [narratorVoice, setNarratorVoice] = useState("");
  const [npcDefaultVoicesEnabled, setNpcDefaultVoicesEnabled] = useState(false);
  const [npcDefaultMaleVoices, setNpcDefaultMaleVoices] = useState<string[]>([]);
  const [npcDefaultFemaleVoices, setNpcDefaultFemaleVoices] = useState<string[]>([]);
  const [speed, setSpeed] = useState(1.0);
  const [elevenLabsStability, setElevenLabsStability] = useState(0.5);
  const [elevenLabsLanguageCode, setElevenLabsLanguageCode] = useState("");
  const [elevenLabsGameSoundEffects, setElevenLabsGameSoundEffects] = useState(false);
  const [elevenLabsGameMusic, setElevenLabsGameMusic] = useState(false);
  const [autoplayRP, setAutoplayRP] = useState(false);
  const [autoplayConvo, setAutoplayConvo] = useState(false);
  const [autoplayGame, setAutoplayGame] = useState(false);
  const [progressivePlayback, setProgressivePlayback] = useState(false);
  const [dialogueOnly, setDialogueOnly] = useState(false);
  const [dialoguePauseSeconds, setDialoguePauseSeconds] = useState(TTS_DIALOGUE_PAUSE_DEFAULT_SECONDS);
  const [audioFormat, setAudioFormat] = useState<TTSAudioFormat>("mp3");
  const [callAudioEnabled, setCallAudioEnabled] = useState(false);
  const [callAudioInputMode, setCallAudioInputMode] = useState<TTSConversationCallAudioInputMode>("local_whisper");
  const [callVideoInputEnabled, setCallVideoInputEnabled] = useState(false);
  const [callCharacterVideoEnabled, setCallCharacterVideoEnabled] = useState(false);
  const [callAutomaticVideoClipsEnabled, setCallAutomaticVideoClipsEnabled] = useState(false);
  const [callCustomVideoClipsEnabled, setCallCustomVideoClipsEnabled] = useState(false);

  const [expanded, setExpanded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceProfilesRef = useRef<TTSSourceProfiles>({});
  const [ttsState, setTTSState] = useState(ttsService.getState());
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [ttsCacheSummary, setTtsCacheSummary] = useState({ count: 0, bytes: 0 });
  const [exportingTtsCache, setExportingTtsCache] = useState(false);

  // Voice fetch — keyed on the *saved* baseUrl so it only refetches when saved
  const savedSource = savedConfig?.source ?? "openai";
  const {
    data: voicesData,
    isFetching: fetchingVoices,
    refetch: refetchVoices,
    isError: voicesError,
    error: voicesRequestError,
  } = useTTSVoices(
    savedSource,
    savedConfig?.baseUrl ?? TTS_SOURCE_DEFAULTS[savedSource].baseUrl,
    savedConfig?.enabled ?? false,
  );
  const {
    data: modelsData,
    isFetching: fetchingModels,
    refetch: refetchModels,
  } = useTTSModels(
    savedSource,
    savedConfig?.baseUrl ?? TTS_SOURCE_DEFAULTS[savedSource].baseUrl,
    savedConfig?.enabled ?? false,
  );

  // Populate draft from server on load
  useEffect(() => {
    if (!savedConfig) return;
    setEnabled(savedConfig.enabled);
    setSource(savedConfig.source ?? "openai");
    setBaseUrl(savedConfig.baseUrl);
    setApiKey(savedConfig.apiKey); // masked value from server
    setModel(savedConfig.model);
    setVoice(savedConfig.voice);
    setVoiceMode(savedConfig.voiceMode ?? "single");
    setVoiceAssignments(savedConfig.voiceAssignments ?? []);
    setNarratorVoiceEnabled(savedConfig.narratorVoiceEnabled ?? false);
    setNarratorVoice(savedConfig.narratorVoice ?? "");
    setNpcDefaultVoicesEnabled(savedConfig.npcDefaultVoicesEnabled ?? false);
    setNpcDefaultMaleVoices(savedConfig.npcDefaultMaleVoices ?? []);
    setNpcDefaultFemaleVoices(savedConfig.npcDefaultFemaleVoices ?? []);
    setSpeed(savedConfig.speed);
    setElevenLabsStability(savedConfig.elevenLabsStability ?? 0.5);
    setElevenLabsLanguageCode(savedConfig.elevenLabsLanguageCode ?? "");
    setElevenLabsGameSoundEffects(savedConfig.elevenLabsGameSoundEffects ?? false);
    setElevenLabsGameMusic(savedConfig.elevenLabsGameMusic ?? false);
    setAutoplayRP(savedConfig.autoplayRP);
    setAutoplayConvo(savedConfig.autoplayConvo);
    setAutoplayGame(savedConfig.autoplayGame);
    setProgressivePlayback(savedConfig.progressivePlayback ?? false);
    setDialogueOnly(savedConfig.dialogueOnly ?? false);
    setDialoguePauseSeconds((savedConfig.dialoguePauseMs ?? TTS_DIALOGUE_PAUSE_DEFAULT_SECONDS * 1000) / 1000);
    setAudioFormat(savedConfig.audioFormat ?? "mp3");
    setCallAudioEnabled(savedConfig.callAudioEnabled ?? false);
    setCallAudioInputMode(savedConfig.callAudioInputMode ?? "local_whisper");
    setCallVideoInputEnabled(savedConfig.callVideoInputEnabled ?? false);
    setCallCharacterVideoEnabled(savedConfig.callCharacterVideoEnabled ?? false);
    setCallAutomaticVideoClipsEnabled(savedConfig.callAutomaticVideoClipsEnabled ?? false);
    setCallCustomVideoClipsEnabled(savedConfig.callCustomVideoClipsEnabled ?? false);
    sourceProfilesRef.current = savedConfig.sourceProfiles ?? {};
    setSaveStatus("idle");
  }, [savedConfig]);

  // Track TTS playback state for the preview button
  useEffect(
    () =>
      ttsService.subscribe((s) => {
        setTTSState(s);
        if (s === "error") {
          setPreviewError(ttsService.getLastError() ?? "TTS preview failed.");
        }
      }),
    [],
  );

  // Clear debounce timer on unmount
  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    void listCachedTTSAudioMeta().then((entries) => {
      if (cancelled) return;
      setTtsCacheSummary({
        count: entries.length,
        bytes: entries.reduce((total, entry) => total + Math.max(0, entry.size || 0), 0),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [expanded, ttsState]);

  const buildPayload = (overrides?: Partial<TTSConfig>): TTSConfig => ({
    enabled,
    source,
    baseUrl,
    apiKey: apiKey === TTS_API_KEY_MASK ? TTS_API_KEY_MASK : apiKey,
    model,
    voice,
    voiceMode,
    voiceAssignments,
    narratorVoiceEnabled,
    narratorVoice,
    npcDefaultVoicesEnabled,
    npcDefaultMaleVoices,
    npcDefaultFemaleVoices,
    speed,
    elevenLabsStability,
    elevenLabsLanguageCode,
    elevenLabsGameSoundEffects,
    elevenLabsGameMusic,
    autoplayRP,
    autoplayConvo,
    autoplayGame,
    progressivePlayback,
    dialogueOnly,
    dialoguePauseMs: dialoguePauseSeconds * 1000,
    audioFormat,
    callAudioEnabled,
    callSttConnectionId: "",
    callSttModel: "",
    callAudioInputMode,
    callVideoInputEnabled,
    callCharacterVideoEnabled,
    callAutomaticVideoClipsEnabled,
    callCustomVideoClipsEnabled,
    // Soundboard is intentionally always-on for Conversation Calls. Saving this card also migrates old false values.
    callSoundboardEnabled: true,
    sourceProfiles: sourceProfilesRef.current,
    ...overrides,
  });

  const saveNow = async (payload: TTSConfig) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setSaveStatus("saving");
    await updateConfig.mutateAsync(payload);
    setSaveStatus("saved");
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => {
      setSaveStatus((s) => (s === "saved" ? "idle" : s));
      statusTimerRef.current = null;
    }, 2000);
  };

  const mark = (overrides?: Partial<TTSConfig>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("idle");
    setPreviewError(null);
    const payload = buildPayload(overrides);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await saveNow(payload);
      } catch {
        setSaveStatus("error");
        toast.error(localizeUi("ui.panels.ttsconfigcard.failedToSaveTtsSettings"));
      }
    }, 600);
  };

  const handleSourceChange = (nextSource: TTSSource) => {
    if (nextSource === source) return;
    const currentProfile = ttsSourceProfileFromConfig(buildPayload());
    const sourceProfiles: TTSSourceProfiles = {
      ...sourceProfilesRef.current,
      [source]: currentProfile,
    };
    const nextProfile = sourceProfiles[nextSource] ?? defaultSourceProfile(nextSource);
    sourceProfilesRef.current = sourceProfiles;

    setSource(nextSource);
    setBaseUrl(nextProfile.baseUrl);
    setApiKey(nextProfile.apiKey);
    setModel(nextProfile.model);
    setVoice(nextProfile.voice);
    setVoiceMode(nextProfile.voiceMode);
    setVoiceAssignments(nextProfile.voiceAssignments);
    setNarratorVoiceEnabled(nextProfile.narratorVoiceEnabled);
    setNarratorVoice(nextProfile.narratorVoice);
    setNpcDefaultVoicesEnabled(nextProfile.npcDefaultVoicesEnabled);
    setNpcDefaultMaleVoices(nextProfile.npcDefaultMaleVoices);
    setNpcDefaultFemaleVoices(nextProfile.npcDefaultFemaleVoices);
    setSpeed(nextProfile.speed);
    setElevenLabsStability(nextProfile.elevenLabsStability);
    setElevenLabsLanguageCode(nextProfile.elevenLabsLanguageCode);
    setElevenLabsGameSoundEffects(nextProfile.elevenLabsGameSoundEffects);
    setElevenLabsGameMusic(nextProfile.elevenLabsGameMusic);
    setAudioFormat(nextProfile.audioFormat);
    mark({
      source: nextSource,
      ...nextProfile,
      sourceProfiles,
    });
  };

  const handlePreview = () => {
    if (ttsState === "playing" || ttsState === "loading") {
      ttsService.stop();
      return;
    }
    setPreviewError(null);
    void (async () => {
      const payload = buildPayload();
      const previewVoice =
        payload.voiceMode === "per-character"
          ? (payload.voiceAssignments.find((assignment) => assignment.voice)?.voice ?? payload.voice)
          : payload.voice;
      if (payload.source === "elevenlabs" && !previewVoice) {
        toast.error(localizeUi("ui.panels.ttsconfigcard.selectAnElevenlabsVoiceBeforePreviewing"));
        return;
      }

      try {
        try {
          await saveNow(payload);
        } catch {
          setSaveStatus("error");
          throw new Error("Failed to save TTS settings before preview.");
        }
        await ttsService.speak("Hello! This is a preview of the text to speech voice.", "tts-preview", {
          throwOnError: true,
          voice: previewVoice,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "TTS preview failed.";
        setPreviewError(message);
        toast.error(message);
      }
    })();
  };

  const handleExportCachedClips = async () => {
    setExportingTtsCache(true);
    try {
      const entries = await listCachedTTSAudioEntries();
      if (entries.length === 0) {
        toast.info(localizeUi("ui.panels.ttsconfigcard.noCachedTtsClipsToExportYet"));
        setTtsCacheSummary({ count: 0, bytes: 0 });
        return;
      }

      entries.forEach((entry, index) => downloadTTSClip(entry, index));
      setTtsCacheSummary({
        count: entries.length,
        bytes: entries.reduce((total, entry) => total + Math.max(0, entry.size || entry.blob.size), 0),
      });
      toast.success(
        localizeUi("ui.panels.ttsconfigcard.exportedValue1CachedTtsClipValue2", {
          value1: entries.length,
          value2: entries.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
        }),
      );
    } catch {
      toast.error(localizeUi("ui.panels.ttsconfigcard.failedToExportCachedTtsClips"));
    } finally {
      setExportingTtsCache(false);
    }
  };

  const handleRefreshVoices = async () => {
    try {
      await saveNow(buildPayload());
      const [voiceResult, modelResult] = await Promise.all([
        refetchVoices(),
        source === "elevenlabs" ? refetchModels() : Promise.resolve(null),
      ]);
      if (voiceResult.error) throw voiceResult.error;
      if (modelResult?.error) throw modelResult.error;
      toast.success(
        source === "elevenlabs"
          ? localizeUi("ui.panels.ttsconfigcard.elevenlabsVoicesAndModelsRefreshed")
          : localizeUi("ui.panels.ttsconfigcard.voicesRefreshed"),
      );
    } catch (error) {
      setSaveStatus("error");
      toast.error(
        getTtsRequestErrorMessage(error, localizeUi("ui.panels.ttsconfigcard.couldNotRefreshVoices")),
      );
    }
  };

  const voices = voicesData?.voices ?? [];
  const fetchedVoiceOptions = voicesData?.voiceOptions ?? voices.map((v) => ({ id: v, name: v }));
  const voiceOptions = useMemo(() => {
    let nextOptions = fetchedVoiceOptions.length > 0 ? fetchedVoiceOptions : [];
    if (source === "elevenlabs" && nextOptions.length === 0) {
      nextOptions = ELEVENLABS_DEFAULT_VOICE_OPTIONS;
    }
    for (const savedVoice of [
      voice,
      narratorVoice,
      ...voiceAssignments.map((assignment) => assignment.voice),
      ...npcDefaultMaleVoices,
      ...npcDefaultFemaleVoices,
    ]) {
      nextOptions = addSavedVoiceOption(nextOptions, savedVoice);
    }
    return nextOptions;
  }, [
    fetchedVoiceOptions,
    narratorVoice,
    npcDefaultFemaleVoices,
    npcDefaultMaleVoices,
    source,
    voice,
    voiceAssignments,
  ]);
  const voicesFromProvider = voicesData?.fromProvider ?? false;
  const voicesErrorMessage = voicesError
    ? getTtsRequestErrorMessage(
        voicesRequestError,
        localizeUi("ui.panels.ttsconfigcard.couldNotRefreshVoices"),
      )
    : null;
  const modelOptions = useMemo(() => {
    const providerModels = modelsData?.source === "elevenlabs" ? modelsData.models : [];
    const choices = providerModels.length > 0 ? providerModels : ELEVENLABS_TTS_MODELS.map((id) => ({ id, name: id }));
    if (!model || choices.some((option) => option.id === model)) return choices;
    return [{ id: model, name: model }, ...choices];
  }, [model, modelsData]);
  const canRefreshVoices = Boolean(baseUrl.trim()) && (source !== "elevenlabs" || Boolean(apiKey.trim()));
  const elevenLabsMatchedMaleVoiceOptions = useMemo(
    () =>
      voiceOptions.filter((option) => isElevenLabsVoiceForGender(option, "male", ELEVENLABS_DEFAULT_MALE_VOICE_NAMES)),
    [voiceOptions],
  );
  const elevenLabsMatchedFemaleVoiceOptions = useMemo(
    () =>
      voiceOptions.filter((option) =>
        isElevenLabsVoiceForGender(option, "female", ELEVENLABS_DEFAULT_FEMALE_VOICE_NAMES),
      ),
    [voiceOptions],
  );
  const elevenLabsNpcMaleVoiceOptions = useMemo(() => {
    let options = elevenLabsMatchedMaleVoiceOptions.length > 0 ? elevenLabsMatchedMaleVoiceOptions : voiceOptions;
    for (const savedVoice of npcDefaultMaleVoices) {
      options = addSavedVoiceOption(options, savedVoice);
    }
    return options;
  }, [elevenLabsMatchedMaleVoiceOptions, npcDefaultMaleVoices, voiceOptions]);
  const elevenLabsNpcFemaleVoiceOptions = useMemo(() => {
    let options = elevenLabsMatchedFemaleVoiceOptions.length > 0 ? elevenLabsMatchedFemaleVoiceOptions : voiceOptions;
    for (const savedVoice of npcDefaultFemaleVoices) {
      options = addSavedVoiceOption(options, savedVoice);
    }
    return options;
  }, [elevenLabsMatchedFemaleVoiceOptions, npcDefaultFemaleVoices, voiceOptions]);
  const maleNpcVoiceFallbackNote =
    voiceOptions.length > 0 && elevenLabsMatchedMaleVoiceOptions.length === 0
      ? "No male-labeled defaults were detected, so this pool uses the provider voice list."
      : undefined;
  const femaleNpcVoiceFallbackNote =
    voiceOptions.length > 0 && elevenLabsMatchedFemaleVoiceOptions.length === 0
      ? "No female-labeled defaults were detected, so this pool uses the provider voice list."
      : undefined;
  const defaultMaleVoiceIds = useMemo(
    () =>
      (elevenLabsMatchedMaleVoiceOptions.length > 0 ? elevenLabsMatchedMaleVoiceOptions : voiceOptions).map(
        (option) => option.id,
      ),
    [elevenLabsMatchedMaleVoiceOptions, voiceOptions],
  );
  const defaultFemaleVoiceIds = useMemo(
    () =>
      (elevenLabsMatchedFemaleVoiceOptions.length > 0 ? elevenLabsMatchedFemaleVoiceOptions : voiceOptions).map(
        (option) => option.id,
      ),
    [elevenLabsMatchedFemaleVoiceOptions, voiceOptions],
  );
  const characterOptions = useMemo<CharacterOption[]>(() => {
    return ((characters ?? []) as Array<{ id?: string; data?: unknown; comment?: string | null }>)
      .map((character) => {
        if (!character.id) return null;
        const info = parseCharacterDisplayData({ data: character.data, comment: character.comment });
        return {
          id: character.id,
          name: info.name,
          label: info.comment ? `${info.name} — ${info.comment}` : info.name,
        };
      })
      .filter((option): option is CharacterOption => Boolean(option))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [characters]);
  const assignedCharacterIds = useMemo(
    () => new Set(voiceAssignments.map((assignment) => assignment.characterId).filter(Boolean)),
    [voiceAssignments],
  );
  const allCharactersAssigned = characterOptions.length > 0 && assignedCharacterIds.size >= characterOptions.length;
  const customVoiceCount = voiceAssignments.filter((assignment) => assignment.characterId && assignment.voice).length;
  const selectedSource = TTS_SOURCE_DEFAULTS[source];
  const selectedVoiceLabel =
    voiceMode === "per-character"
      ? `Per character${customVoiceCount > 0 ? ` · ${customVoiceCount} custom` : ""}`
      : voice || (source === "elevenlabs" ? "No voice selected" : selectedSource.voice);
  const narratorVoiceLabel = narratorVoice || (source === "elevenlabs" ? "No narrator voice selected" : voice);
  const previewVoice =
    voiceMode === "per-character" ? (voiceAssignments.find((assignment) => assignment.voice)?.voice ?? voice) : voice;
  const selectedLanguage =
    ELEVENLABS_TTS_LANGUAGE_OPTIONS.find((option) => option.code === elevenLabsLanguageCode) ??
    ELEVENLABS_TTS_LANGUAGE_OPTIONS[0];
  const speedMin = source === "elevenlabs" || source === "xai" ? 0.7 : 0.25;
  const speedMax = source === "elevenlabs" ? 1.2 : source === "xai" ? 1.5 : 4.0;
  const speedHelp =
    source === "elevenlabs"
      ? "Playback speed. ElevenLabs supports 0.7×–1.2×; wider saved values are clamped when spoken."
      : source === "xai"
        ? "Playback speed. xAI Voice supports 0.7×–1.5×; wider saved values are clamped when spoken."
        : "Playback speed. 1.0 is normal; range is 0.25×–4.0×.";
  const speedSliderValue = Math.min(speedMax, Math.max(speedMin, speed));
  const speedLabel =
    (source === "elevenlabs" || source === "xai") && speedSliderValue !== speed
      ? `Speed — ${speedSliderValue.toFixed(2)}× (clamped from ${speed.toFixed(2)}×)`
      : `Speed — ${speed.toFixed(2)}×`;
  const previewDisabled = !enabled || ttsState === "loading" || (source === "elevenlabs" && !previewVoice);
  const previewTitle =
    source === "elevenlabs" && !previewVoice
      ? "Select an ElevenLabs voice first"
      : !enabled
        ? "Enable TTS first"
        : ttsState === "playing"
          ? "Stop preview"
          : "Preview voice";
  const updateVoiceAssignments = (nextAssignments: TTSVoiceAssignment[]) => {
    setVoiceAssignments(nextAssignments);
    mark({ voiceAssignments: nextAssignments });
  };

  const handleVoiceAssignmentCharacterChange = (index: number, characterId: string) => {
    const character = characterOptions.find((option) => option.id === characterId);
    const nextAssignments = voiceAssignments.map((assignment, assignmentIndex) =>
      assignmentIndex === index
        ? {
            ...assignment,
            characterId,
            characterName: character?.name ?? "",
          }
        : assignment,
    );
    updateVoiceAssignments(nextAssignments);
  };

  const handleVoiceAssignmentVoiceChange = (index: number, nextVoice: string) => {
    const nextAssignments = voiceAssignments.map((assignment, assignmentIndex) =>
      assignmentIndex === index ? { ...assignment, voice: nextVoice } : assignment,
    );
    updateVoiceAssignments(nextAssignments);
  };

  const handleAddVoiceAssignment = () => {
    const nextCharacter =
      characterOptions.find((option) => !assignedCharacterIds.has(option.id)) ?? characterOptions[0] ?? null;
    const nextAssignment: TTSVoiceAssignment = {
      characterId: nextCharacter?.id ?? "",
      characterName: nextCharacter?.name ?? "",
      voice: voiceOptions[0]?.id ?? voice,
    };
    updateVoiceAssignments([...voiceAssignments, nextAssignment]);
  };

  const handleRemoveVoiceAssignment = (index: number) => {
    updateVoiceAssignments(voiceAssignments.filter((_, assignmentIndex) => assignmentIndex !== index));
  };

  const toggleNarratorVoice = (enabled: boolean) => {
    const nextNarratorVoice = enabled && !narratorVoice ? voice || selectedSource.voice : narratorVoice;
    setNarratorVoiceEnabled(enabled);
    setNarratorVoice(nextNarratorVoice);
    mark({ narratorVoiceEnabled: enabled, narratorVoice: nextNarratorVoice });
  };

  const handleNarratorVoiceChange = (nextVoice: string) => {
    setNarratorVoice(nextVoice);
    mark({ narratorVoice: nextVoice });
  };

  const toggleNpcDefaultVoices = (enabled: boolean) => {
    const poolsAreUnpartitioned = sameStringSet(npcDefaultMaleVoices, npcDefaultFemaleVoices);
    const nextMaleVoices =
      enabled && (npcDefaultMaleVoices.length === 0 || poolsAreUnpartitioned)
        ? defaultMaleVoiceIds
        : npcDefaultMaleVoices;
    const nextFemaleVoices =
      enabled && (npcDefaultFemaleVoices.length === 0 || poolsAreUnpartitioned)
        ? defaultFemaleVoiceIds
        : npcDefaultFemaleVoices;

    setNpcDefaultVoicesEnabled(enabled);
    setNpcDefaultMaleVoices(nextMaleVoices);
    setNpcDefaultFemaleVoices(nextFemaleVoices);
    mark({
      npcDefaultVoicesEnabled: enabled,
      npcDefaultMaleVoices: nextMaleVoices,
      npcDefaultFemaleVoices: nextFemaleVoices,
    });
  };

  const toggleNpcDefaultVoice = (gender: "male" | "female", voiceId: string, checked: boolean) => {
    const current = gender === "male" ? npcDefaultMaleVoices : npcDefaultFemaleVoices;
    const next = checked ? [...new Set([...current, voiceId])] : current.filter((id) => id !== voiceId);

    if (gender === "male") {
      setNpcDefaultMaleVoices(next);
      mark({ npcDefaultMaleVoices: next });
    } else {
      setNpcDefaultFemaleVoices(next);
      mark({ npcDefaultFemaleVoices: next });
    }
  };

  if (isLoading) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-sky-400/20 bg-gradient-to-br from-sky-400/5 to-blue-500/5 p-3 transition-all",
        expanded && "border-sky-400/30",
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-sm">
          <Volume2 size="1rem" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{localizeUi("ui.panels.ttsconfigcard.textToSpeech")}</div>
          <div className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">
            {enabled
              ? localizeUi("ui.panels.ttsconfigcard.value1Value2Value3Value4Value5", {
                  value1: selectedSource.label,
                  value2: model || selectedSource.model,
                  value3: selectedVoiceLabel,
                  value4: narratorVoiceEnabled
                    ? localizeUi("ui.panels.ttsconfigcard.narratorValue1", { value1: narratorVoiceLabel })
                    : "",
                  value5:
                    voicesFromProvider || source !== "openai"
                      ? ""
                      : localizeUi("ui.panels.ttsconfigcard.builtInVoices"),
                })
              : selectedSource.idleText}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Enable toggle */}
          <SettingsSwitch
            checked={enabled}
            onChange={(checked) => {
              setEnabled(checked);
              mark({ enabled: checked });
            }}
            ariaLabel={enabled ? "Disable TTS" : "Enable TTS"}
            title={
              enabled
                ? localizeUi("ui.panels.ttsconfigcard.disableTts")
                : localizeUi("ui.panels.ttsconfigcard.enableTts")
            }
            className="rounded-lg p-1 hover:bg-[var(--secondary)]"
          />

          <button
            onClick={() => setExpanded((v) => !v)}
            className="mari-chrome-control mari-chrome-control--small h-8 min-h-0 w-8 p-0"
            title={
              expanded ? localizeUi("ui.panels.ttsconfigcard.collapse") : localizeUi("ui.panels.ttsconfigcard.expand")
            }
          >
            {expanded ? <ChevronUp size="0.875rem" /> : <ChevronDown size="0.875rem" />}
          </button>
        </div>
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="mt-3 space-y-4 border-t border-sky-400/10 pt-3">
          {/* Source */}
          <FieldRow
            label={localizeUi("ui.panels.ttsconfigcard.source")}
            help={localizeUi("ui.panels.ttsconfigcard.chooseTheProviderUsedByTheServerSideTts")}
          >
            <select
              value={source}
              onChange={(e) => handleSourceChange(e.target.value as TTSSource)}
              className={cn(INPUT_CLS, "cursor-pointer appearance-none")}
            >
              {TTS_SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FieldRow>

          {/* Base URL */}
          <FieldRow
            label={localizeUi("ui.panels.ttsconfigcard.baseUrl")}
            help={
              source === "elevenlabs"
                ? localizeUi("ui.panels.ttsconfigcard.theElevenlabsApiRootUseTheDefaultUnlessYou")
                : source === "pockettts"
                  ? localizeUi("ui.panels.ttsconfigcard.thePocketttsOpenaiCompatibleServerRootItsDefaultIs")
                  : source === "xai"
                    ? localizeUi("ui.panels.ttsconfigcard.theXaiVoiceApiRootUseHttpsApiX")
                    : localizeUi("ui.panels.ttsconfigcard.theOpenaiCompatibleTtsApiEndpointUseTheDefault")
            }
          >
            <div className="relative">
              <Globe size="0.875rem" className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-400" />
              <input
                value={baseUrl}
                onChange={(e) => {
                  setBaseUrl(e.target.value);
                  mark({ baseUrl: e.target.value });
                }}
                className={cn(INPUT_CLS, "pl-8 font-mono")}
                placeholder={selectedSource.baseUrl}
              />
            </div>
          </FieldRow>

          {/* API Key */}
          <FieldRow
            label={localizeUi("ui.panels.ttsconfigcard.apiKey")}
            help={localizeUi("ui.panels.ttsconfigcard.yourApiKeyForTheTtsProviderEncryptedAt")}
          >
            <div className="relative">
              <Key size="0.875rem" className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-400" />
              <input
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  mark({ apiKey: e.target.value === TTS_API_KEY_MASK ? TTS_API_KEY_MASK : e.target.value });
                }}
                type="password"
                className={cn(INPUT_CLS, "pl-8")}
                placeholder={localizeUi("ui.panels.ttsconfigcard.enterApiKeyOrClearToRemove")}
              />
            </div>
            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
              {localizeUi("ui.panels.ttsconfigcard.encryptedAtRestKeepTheMaskedValueToPreserve")}
            </p>
          </FieldRow>

          {/* Model */}
          <FieldRow
            label={localizeUi("ui.panels.ttsconfigcard.model")}
            help={
              source === "elevenlabs"
                ? localizeUi("ui.panels.ttsconfigcard.elevenlabsModelIdToUseUseElevenV3For")
                : source === "pockettts"
                  ? localizeUi("ui.panels.ttsconfigcard.pocketttsSelectsItsLanguageModelWhenYouStartThe")
                  : source === "xai"
                    ? localizeUi("ui.panels.ttsconfigcard.xaiVoiceCurrentlyUsesTheTtsEndpointThisIs")
                    : localizeUi("ui.panels.ttsconfigcard.ttsModelToUseEGTts1Tts")
            }
          >
            {source === "elevenlabs" ? (
              <div className="relative">
                <select
                  aria-label={localizeUi("ui.panels.ttsconfigcard.model")}
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    mark({ model: e.target.value });
                  }}
                  className={cn(INPUT_CLS, "cursor-pointer appearance-none pr-10")}
                >
                  {modelOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name === option.id
                        ? option.id
                        : localizeUi("ui.panels.ttsconfigcard.value1Value2", {
                            value1: option.name,
                            value2: option.id,
                          })}
                    </option>
                  ))}
                </select>
                <TtsDropdownIcon />
              </div>
            ) : (
              <input
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  mark({ model: e.target.value });
                }}
                className={INPUT_CLS}
                placeholder={selectedSource.model}
              />
            )}
            {source === "elevenlabs" && (
              <>
                {fetchingModels && (
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.panels.ttsconfigcard.loadingModels")}
                  </p>
                )}
                <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                  {localizeUi("ui.panels.ttsconfigcard.elevenV3SpeechUses")}{" "}
                  <code className="font-mono">{"eleven_v3"}</code>
                  {localizeUi("ui.panels.ttsconfigcard.idsContaining")} <code className="font-mono">{"ttv"}</code>{" "}
                  {localizeUi("ui.panels.ttsconfigcard.areTextToVoiceVoiceDesignModelsNanogptProxies")}{" "}
                  <code className="font-mono">{"Elevenlabs-V3"}</code>.
                </p>
              </>
            )}
          </FieldRow>

          {/* Voice assignment mode */}
          <FieldRow
            label={localizeUi("ui.panels.ttsconfigcard.voiceOption")}
            help={localizeUi("ui.panels.ttsconfigcard.useOneVoiceForEveryCharacterOrAssignSpecific")}
          >
            <select
              aria-label={localizeUi("ui.panels.ttsconfigcard.voiceOption")}
              value={voiceMode}
              onChange={(e) => {
                const nextMode = e.target.value as TTSVoiceMode;
                setVoiceMode(nextMode);
                mark({ voiceMode: nextMode });
              }}
              className={cn(INPUT_CLS, "cursor-pointer appearance-none")}
            >
              <option value="single">{localizeUi("ui.panels.ttsconfigcard.oneVoiceForAllCharacters")}</option>
              <option value="per-character">{localizeUi("ui.panels.ttsconfigcard.selectedPerCharacter")}</option>
            </select>
          </FieldRow>

          {voiceMode === "single" && (
            <FieldRow
              label={localizeUi("ui.panels.ttsconfigcard.allCharactersVoice")}
              help={
                source === "elevenlabs"
                  ? localizeUi("ui.panels.ttsconfigcard.elevenlabsVoicesAreFetchedByNameAndSavedBy")
                  : source === "pockettts"
                    ? localizeUi("ui.panels.ttsconfigcard.pocketttsBuiltInOrCustomVoiceFromYourServer")
                    : source === "xai"
                      ? localizeUi("ui.panels.ttsconfigcard.xaiVoiceIdBuiltInsIncludeEveAraRex")
                      : localizeUi(
                          "ui.panels.ttsconfigcard.chooseAProviderVoiceOrEnterACustomOpenaiCompatibleValueSuchAsAKokoroMix",
                        )
              }
            >
              <div className="flex gap-2">
                {source === "pockettts" ? (
                  <PocketTTSVoiceControl
                    value={voice}
                    options={voiceOptions}
                    fetching={fetchingVoices}
                    selectLabel="PocketTTS server voice"
                    inputLabel="PocketTTS voice ID, URL, or path"
                    onChange={(nextVoice) => {
                      setVoice(nextVoice);
                      mark({ voice: nextVoice });
                    }}
                  />
                ) : source === "openai" ? (
                  <CustomizableVoiceInput
                    value={voice}
                    options={voiceOptions}
                    placeholder={localizeUi("ui.panels.ttsconfigcard.customVoiceOrKokoroMix")}
                    ariaLabel={localizeUi("ui.panels.ttsconfigcard.allCharactersVoice")}
                    testId="tts-custom-voice-input-global"
                    onChange={(nextVoice) => {
                      setVoice(nextVoice);
                      mark({ voice: nextVoice });
                    }}
                  />
                ) : (
                  <VoiceSelect
                    value={voice}
                    options={voiceOptions}
                    disabled={fetchingVoices || voiceOptions.length === 0}
                    placeholder={
                      fetchingVoices
                        ? localizeUi("ui.panels.ttsconfigcard.loadingVoices")
                        : voicesError
                          ? localizeUi("ui.panels.ttsconfigcard.couldNotLoadVoices")
                          : source === "elevenlabs"
                            ? localizeUi("ui.panels.ttsconfigcard.selectAnElevenlabsVoice")
                            : localizeUi("ui.panels.ttsconfigcard.selectVoice")
                    }
                    ariaLabel={localizeUi("ui.panels.ttsconfigcard.allCharactersVoice")}
                    onChange={(nextVoice) => {
                      setVoice(nextVoice);
                      mark({ voice: nextVoice });
                    }}
                  />
                )}
                <button
                  onClick={() => void handleRefreshVoices()}
                  disabled={fetchingVoices || !canRefreshVoices}
                  className="mari-chrome-control mari-chrome-control--small shrink-0 text-xs"
                  title={localizeUi("ui.panels.ttsconfigcard.refreshVoicesFromProvider")}
                >
                  <RefreshCw size="0.75rem" className={cn(fetchingVoices && "animate-spin")} />
                </button>
              </div>
              {!voicesFromProvider && source === "openai" && voices.length > 0 && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.panels.ttsconfigcard.showingOpenaiBuiltInVoicesSaveEnableToLoad")}
                </p>
              )}
              {!voicesFromProvider && source === "elevenlabs" && !fetchingVoices && !voicesError && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.panels.ttsconfigcard.elevenlabsVoicesLoadAfterTheConnectionIsSavedWith")}
                </p>
              )}
              {!voicesFromProvider && source === "pockettts" && voices.length > 0 && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.panels.ttsconfigcard.showingPocketttsBuiltInFallbacksSaveAndRefreshTo")}
                </p>
              )}
              {voicesFromProvider && source === "pockettts" && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.panels.ttsconfigcard.loaded")} {voices.length}{" "}
                  {localizeUi("ui.panels.ttsconfigcard.voice")}
                  {voices.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s")}{" "}
                  {localizeUi("ui.panels.ttsconfigcard.fromPocketttsServer")}
                </p>
              )}
              {voicesFromProvider && source === "elevenlabs" && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.panels.ttsconfigcard.loadedVoiceCount", { count: voices.length })}
                </p>
              )}
              {!voicesFromProvider && source === "xai" && voices.length > 0 && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.panels.ttsconfigcard.showingXaiBuiltInVoicesSaveWithAnApi")}
                </p>
              )}
            </FieldRow>
          )}

          {voiceMode === "per-character" && (
            <FieldRow
              label={localizeUi("ui.panels.ttsconfigcard.characterVoices")}
              help={localizeUi("ui.panels.ttsconfigcard.assignVoicesToSpecificCharactersFromYourCharactersTab")}
            >
              <div className="space-y-2 rounded-xl border border-sky-400/15 bg-sky-400/5 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="grid min-w-0 flex-1 gap-2 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)] sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto]">
                    <span>{localizeUi("ui.panels.appearancesettings.character")}</span>
                    <span>{localizeUi("ui.panels.ttsconfigcard.voice_3091c84")}</span>
                    <span className="hidden sm:block" />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRefreshVoices()}
                    disabled={fetchingVoices || !canRefreshVoices}
                    className="mari-chrome-control mari-chrome-control--small shrink-0 text-xs"
                    title={localizeUi("ui.panels.ttsconfigcard.refreshVoicesFromProvider")}
                  >
                    <RefreshCw size="0.75rem" className={cn(fetchingVoices && "animate-spin")} />
                    <span>{localizeUi("ui.panels.ttsconfigcard.refresh")}</span>
                  </button>
                </div>
                {voiceAssignments.length === 0 && (
                  <p className="rounded-lg border border-dashed border-[var(--border)] px-2.5 py-2 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
                    {localizeUi("ui.panels.ttsconfigcard.addACharacterVoiceToRouteTtsBySpeaker")}
                  </p>
                )}
                {voiceAssignments.map((assignment, index) => (
                  <div
                    key={`voice-assignment-${index}`}
                    className="grid gap-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto]"
                  >
                    <CharacterSelect
                      value={assignment.characterId}
                      options={characterOptions}
                      assignedCharacterIds={assignedCharacterIds}
                      onChange={(characterId) => handleVoiceAssignmentCharacterChange(index, characterId)}
                    />
                    {source === "openai" ? (
                      <CustomizableVoiceInput
                        value={assignment.voice}
                        onChange={(nextVoice) => handleVoiceAssignmentVoiceChange(index, nextVoice)}
                        options={voiceOptions}
                        placeholder={localizeUi("ui.panels.ttsconfigcard.customVoiceOrKokoroMix")}
                        ariaLabel={localizeUi("ui.panels.ttsconfigcard.characterVoiceFor", {
                          name: assignment.characterName || localizeUi("ui.panels.appearancesettings.character"),
                        })}
                        testId={`tts-custom-voice-input-character-${assignment.characterId || index}`}
                        compact
                      />
                    ) : (
                      <VoiceSelect
                        value={assignment.voice}
                        onChange={(nextVoice) => handleVoiceAssignmentVoiceChange(index, nextVoice)}
                        disabled={fetchingVoices || voiceOptions.length === 0}
                        options={voiceOptions}
                        placeholder={localizeUi("ui.panels.ttsconfigcard.selectVoice")}
                        ariaLabel={localizeUi("ui.panels.ttsconfigcard.characterVoiceFor", {
                          name: assignment.characterName || localizeUi("ui.panels.appearancesettings.character"),
                        })}
                        compact
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveVoiceAssignment(index)}
                      className="mari-chrome-control mari-chrome-control--small h-9 min-h-0 px-2 sm:w-9"
                      title={localizeUi("ui.panels.ttsconfigcard.removeCharacterVoice")}
                    >
                      <X size="0.75rem" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddVoiceAssignment}
                  disabled={characterOptions.length === 0 || allCharactersAssigned}
                  className="mari-chrome-control w-full text-xs"
                >
                  <Plus size="0.75rem" />
                  {localizeUi("ui.panels.ttsconfigcard.addCharacterVoice")}
                </button>
                {characterOptions.length === 0 && (
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.panels.ttsconfigcard.addCharactersInTheCharactersTabBeforeAssigningCharacter")}
                  </p>
                )}
              </div>
            </FieldRow>
          )}

          {voicesError && (
            <p className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 px-2.5 py-2 text-[0.6875rem] leading-relaxed text-[var(--destructive)]">
              {voicesErrorMessage}
            </p>
          )}

          <FieldRow
            label={localizeUi("ui.panels.ttsconfigcard.narratorVoice")}
            help={localizeUi("ui.panels.ttsconfigcard.useASeparateVoiceForNarratorMessagesGameNarration")}
          >
            <div className="space-y-2 rounded-xl border border-sky-400/15 bg-sky-400/5 p-2">
              <ToggleRow
                label={localizeUi("ui.panels.ttsconfigcard.useSeparateNarratorVoice")}
                checked={narratorVoiceEnabled}
                onChange={toggleNarratorVoice}
              />
              {narratorVoiceEnabled && (
                <div className="flex gap-2 max-sm:flex-col">
                  {source === "pockettts" ? (
                    <PocketTTSVoiceControl
                      value={narratorVoice}
                      options={voiceOptions}
                      fetching={fetchingVoices}
                      selectLabel="PocketTTS narrator server voice"
                      inputLabel="PocketTTS narrator voice ID, URL, or path"
                      onChange={handleNarratorVoiceChange}
                    />
                  ) : source === "openai" ? (
                    <CustomizableVoiceInput
                      value={narratorVoice}
                      options={voiceOptions}
                      placeholder={localizeUi("ui.panels.ttsconfigcard.customVoiceOrKokoroMix")}
                      ariaLabel={localizeUi("ui.panels.ttsconfigcard.narratorVoice")}
                      testId="tts-custom-voice-input-narrator"
                      onChange={handleNarratorVoiceChange}
                    />
                  ) : (
                    <VoiceSelect
                      value={narratorVoice}
                      onChange={handleNarratorVoiceChange}
                      disabled={fetchingVoices || voiceOptions.length === 0}
                      options={voiceOptions}
                      placeholder={localizeUi("ui.panels.ttsconfigcard.selectNarratorVoice")}
                      ariaLabel={localizeUi("ui.panels.ttsconfigcard.narratorVoice")}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => void handleRefreshVoices()}
                    disabled={fetchingVoices || !canRefreshVoices}
                    className="mari-chrome-control mari-chrome-control--small shrink-0 text-xs"
                    title={localizeUi("ui.panels.ttsconfigcard.refreshVoicesFromProvider")}
                  >
                    <RefreshCw size="0.75rem" className={cn(fetchingVoices && "animate-spin")} />
                  </button>
                </div>
              )}
              {narratorVoiceEnabled && source === "elevenlabs" && !narratorVoice && (
                <p className="text-[0.625rem] leading-relaxed text-amber-300/80">
                  {localizeUi("ui.panels.ttsconfigcard.selectANarratorVoiceOrNarrationWillFallBack")}
                </p>
              )}
            </div>
          </FieldRow>

          {source !== "elevenlabs" && (
            <FieldRow
              label={localizeUi("ui.panels.ttsconfigcard.audioFormat")}
              help={localizeUi("ui.panels.ttsconfigcard.outputAudioFormatWavAreUsefulForLocalSelf")}
            >
              <select
                value={audioFormat}
                onChange={(e) => {
                  const next = e.target.value as TTSAudioFormat;
                  setAudioFormat(next);
                  mark({ audioFormat: next });
                }}
                className={cn(INPUT_CLS, "cursor-pointer appearance-none")}
              >
                <option value="mp3">{localizeUi("ui.panels.ttsconfigcard.mp3")}</option>
                <option value="wav">{localizeUi("ui.panels.ttsconfigcard.wav")}</option>
              </select>
            </FieldRow>
          )}

          <FieldRow
            label={localizeUi("ui.panels.ttsconfigcard.randomNpcVoices")}
            help={localizeUi("ui.panels.ttsconfigcard.whenEnabledTrackedGameNpcsWithoutACharacterSpecific")}
          >
            <div className="space-y-2 rounded-xl border border-sky-400/15 bg-sky-400/5 p-2">
              <ToggleRow
                label={localizeUi("ui.panels.ttsconfigcard.useDefaultVoicesForRandomNpcs")}
                checked={npcDefaultVoicesEnabled}
                onChange={toggleNpcDefaultVoices}
              />
              {npcDefaultVoicesEnabled && (
                <div className="space-y-3 pt-1">
                  <NpcDefaultVoicePool
                    label={localizeUi("ui.panels.ttsconfigcard.maleNpcDefaults")}
                    options={elevenLabsNpcMaleVoiceOptions}
                    selected={npcDefaultMaleVoices}
                    onToggle={(voiceId, checked) => toggleNpcDefaultVoice("male", voiceId, checked)}
                    note={maleNpcVoiceFallbackNote}
                  />
                  <NpcDefaultVoicePool
                    label={localizeUi("ui.panels.ttsconfigcard.femaleNpcDefaults")}
                    options={elevenLabsNpcFemaleVoiceOptions}
                    selected={npcDefaultFemaleVoices}
                    onToggle={(voiceId, checked) => toggleNpcDefaultVoice("female", voiceId, checked)}
                    note={femaleNpcVoiceFallbackNote}
                  />
                  <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                    {localizeUi("ui.panels.ttsconfigcard.npcsWithUnclearGenderUseAStablePickFrom")}
                  </p>
                  {!voicesFromProvider && (
                    <p className="text-[0.625rem] leading-relaxed text-amber-300/80">
                      {localizeUi("ui.panels.ttsconfigcard.saveAndEnableThisTtsProviderThenRefreshVoices")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </FieldRow>

          {/* Speed */}
          <FieldRow label={speedLabel} help={speedHelp}>
            <input
              type="range"
              min={speedMin}
              max={speedMax}
              step={0.05}
              value={speedSliderValue}
              onChange={(e) => {
                setSpeed(parseFloat(e.target.value));
                mark({ speed: parseFloat(e.target.value) });
              }}
              className="w-full accent-[var(--primary)]"
            />
            <div className="flex justify-between text-[0.6rem] text-[var(--muted-foreground)]">
              <span>{speedMin.toFixed(2)}×</span>
              <span>1.0×</span>
              <span>{speedMax.toFixed(2)}×</span>
            </div>
          </FieldRow>

          {source === "elevenlabs" && (
            <FieldRow
              label={localizeUi("settings.application.language.label")}
              help={localizeUi("ui.panels.ttsconfigcard.optionalElevenlabsLanguageCodeAutoLetsElevenlabsDetectThe")}
            >
              <select
                value={elevenLabsLanguageCode}
                onChange={(e) => {
                  setElevenLabsLanguageCode(e.target.value);
                  mark({ elevenLabsLanguageCode: e.target.value });
                }}
                className={cn(INPUT_CLS, "cursor-pointer appearance-none")}
              >
                {ELEVENLABS_TTS_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.code || "auto"} value={option.code}>
                    {option.code
                      ? localizeUi("ui.panels.ttsconfigcard.value1Value2", {
                          value1: option.label,
                          value2: option.code,
                        })
                      : option.label}
                  </option>
                ))}
              </select>
              {elevenLabsLanguageCode && (
                <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                  {localizeUi("ui.panels.ttsconfigcard.forcing")} {selectedLanguage.label}
                  {localizeUi("ui.panels.ttsconfigcard.elevenlabsMayRejectThisIfTheSelectedModelDoes")}
                </p>
              )}
            </FieldRow>
          )}

          {source === "elevenlabs" && (
            <FieldRow
              label={localizeUi("ui.panels.ttsconfigcard.stabilityValue1", {
                value1: Math.round(elevenLabsStability * 100),
              })}
              help={localizeUi("ui.panels.ttsconfigcard.elevenlabsVoiceStabilityLowerValuesAreMoreExpressiveAnd")}
            >
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={elevenLabsStability}
                onChange={(e) => {
                  const next = parseFloat(e.target.value);
                  setElevenLabsStability(next);
                  mark({ elevenLabsStability: next });
                }}
                className="w-full accent-[var(--primary)]"
              />
              <div className="flex justify-between text-[0.6rem] text-[var(--muted-foreground)]">
                <span>{localizeUi("ui.panels.ttsconfigcard.creative")}</span>
                <span>{localizeUi("ui.panels.ttsconfigcard.natural")}</span>
                <span>{localizeUi("ui.panels.ttsconfigcard.robust")}</span>
              </div>
            </FieldRow>
          )}

          {source === "elevenlabs" && (
            <div className="space-y-1">
              <span className="text-xs font-medium">{localizeUi("ui.panels.ttsconfigcard.gameAudioGeneration")}</span>
              <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.panels.ttsconfigcard.gameAudioGenerationHelp")}
              </p>
              <ToggleRow
                label={localizeUi("ui.panels.ttsconfigcard.generateGameSoundEffects")}
                checked={elevenLabsGameSoundEffects}
                onChange={(value) => {
                  setElevenLabsGameSoundEffects(value);
                  mark({ elevenLabsGameSoundEffects: value });
                }}
              />
              <ToggleRow
                label={localizeUi("ui.panels.ttsconfigcard.generateGameMusic")}
                checked={elevenLabsGameMusic}
                onChange={(value) => {
                  setElevenLabsGameMusic(value);
                  mark({ elevenLabsGameMusic: value });
                }}
              />
            </div>
          )}

          {/* Auto-play */}
          <div className="space-y-1">
            <span className="text-xs font-medium">{localizeUi("ui.panels.ttsconfigcard.autoPlay")}</span>
            <ToggleRow
              label={localizeUi("ui.panels.ttsconfigcard.roleplayMessages")}
              checked={autoplayRP}
              onChange={(v) => {
                setAutoplayRP(v);
                mark({ autoplayRP: v });
              }}
            />
            <ToggleRow
              label={localizeUi("ui.panels.ttsconfigcard.conversationMessages")}
              checked={autoplayConvo}
              onChange={(v) => {
                setAutoplayConvo(v);
                mark({ autoplayConvo: v });
              }}
            />
            <ToggleRow
              label={localizeUi("ui.panels.ttsconfigcard.gameNarration")}
              checked={autoplayGame}
              onChange={(v) => {
                setAutoplayGame(v);
                mark({ autoplayGame: v });
              }}
            />
            <ToggleRow
              label={localizeUi("ui.panels.ttsconfigcard.progressivePlayback")}
              checked={progressivePlayback}
              onChange={(v) => {
                setProgressivePlayback(v);
                mark({ progressivePlayback: v });
              }}
            />
            <ToggleRow
              label={localizeUi("ui.panels.ttsconfigcard.onlyReadDialogues")}
              checked={dialogueOnly}
              onChange={(v) => {
                setDialogueOnly(v);
                mark({ dialogueOnly: v });
              }}
            />
            {dialogueOnly && (
              <FieldRow
                label={localizeUi("ui.panels.ttsconfigcard.pauseBetweenDialoguesValue1Value2", {
                  value1: dialoguePauseSeconds,
                  value2:
                    dialoguePauseSeconds === 1
                      ? localizeUi("ui.panels.ttsconfigcard.second")
                      : localizeUi("ui.panels.ttsconfigcard.seconds"),
                })}
                help={localizeUi("ui.panels.ttsconfigcard.addsSilenceBetweenSeparateDialogueLinesInTheSame")}
              >
                <input
                  type="range"
                  aria-label={localizeUi("ui.panels.ttsconfigcard.pauseBetweenDialoguesInSeconds")}
                  min={TTS_DIALOGUE_PAUSE_MIN_SECONDS}
                  max={TTS_DIALOGUE_PAUSE_MAX_SECONDS}
                  step={1}
                  value={dialoguePauseSeconds}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setDialoguePauseSeconds(next);
                    mark({ dialoguePauseMs: next * 1000 });
                  }}
                  className="w-full accent-[var(--primary)]"
                />
                <div className="flex justify-between text-[0.6rem] text-[var(--muted-foreground)]">
                  <span>
                    {TTS_DIALOGUE_PAUSE_MIN_SECONDS} {localizeUi("ui.noodle.stageprofileview.s")}
                  </span>
                  <span>
                    {TTS_DIALOGUE_PAUSE_MAX_SECONDS} {localizeUi("ui.noodle.stageprofileview.s")}
                  </span>
                </div>
              </FieldRow>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-sky-400/15 bg-sky-400/5 px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium">{localizeUi("ui.panels.ttsconfigcard.cachedClips")}</div>
              <div className="truncate text-[0.625rem] text-[var(--muted-foreground)]">
                {ttsCacheSummary.count} {localizeUi("ui.panels.ttsconfigcard.clip")}
                {ttsCacheSummary.count === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s")} ·{" "}
                {formatCacheBytes(ttsCacheSummary.bytes)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleExportCachedClips()}
              disabled={exportingTtsCache || ttsCacheSummary.count === 0}
              className="mari-chrome-control mari-chrome-control--small shrink-0 text-xs"
              title={localizeUi("ui.panels.ttsconfigcard.exportCachedTtsClips")}
            >
              {exportingTtsCache ? <Loader2 size="0.75rem" className="animate-spin" /> : <Download size="0.75rem" />}
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {/* Preview */}
            <button
              onClick={handlePreview}
              disabled={previewDisabled}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs ring-1 transition-all",
                ttsState === "playing"
                  ? "bg-sky-500/10 text-sky-400 ring-sky-400/30 hover:bg-sky-500/20"
                  : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-[var(--border)] hover:text-[var(--foreground)] hover:ring-sky-400/60",
                previewDisabled && "cursor-not-allowed opacity-50",
              )}
              title={previewTitle}
            >
              {ttsState === "loading" ? (
                <Loader2 size="0.75rem" className="animate-spin" />
              ) : ttsState === "playing" ? (
                <Square size="0.75rem" />
              ) : (
                <Play size="0.75rem" />
              )}
              {ttsState === "loading"
                ? localizeUi("ui.panels.ttsconfigcard.loading")
                : ttsState === "playing"
                  ? localizeUi("ui.chat.summarypopover.stop")
                  : localizeUi("settings.notifications.customSound.actions.preview")}
            </button>

            <div className="flex-1" />

            {/* Auto-save status */}
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-[0.6875rem] text-[var(--muted-foreground)]">
                <Loader2 size="0.625rem" className="animate-spin" />
                {localizeUi("chat.settings.inlineEditor.saving")}
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-[0.6875rem] text-emerald-400">
                <Check size="0.625rem" />
                {localizeUi("chat.settings.inlineEditor.saved")}
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-[0.6875rem] text-[var(--destructive)]">
                {localizeUi("ui.panels.ttsconfigcard.saveFailed")}
              </span>
            )}
          </div>
          {previewError && (
            <p className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 px-2.5 py-2 text-[0.6875rem] leading-relaxed text-[var(--destructive)]">
              {previewError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
