// ──────────────────────────────────────────────
// TTS Configuration Card (Connections Panel)
// ──────────────────────────────────────────────
import { useState, useEffect, useMemo, useRef } from "react";
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
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { toast } from "sonner";
import { useTTSConfig, useUpdateTTSConfig, useTTSVoices } from "../../../hooks/use-tts";
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
    baseUrl: "http://localhost:49112",
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
          <option value="">{fetching ?localizeUi("ui.panels.pocketttsvoicecontrol.loadingServerVoices") :localizeUi("ui.panels.pocketttsvoicecontrol.chooseServerVoice")}</option>
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
        <span className="text-[0.625rem] text-[var(--muted-foreground)]">{selected.length} {localizeUi("ui.panels.npcdefaultvoicepool.selected")}</span>
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
        <p className="rounded-lg border border-dashed border-[var(--border)] px-2.5 py-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">{localizeUi("ui.panels.npcdefaultvoicepool.noProviderVoicesLoadedYet")}</p>
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
  } = useTTSVoices(
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
    setDialoguePauseSeconds(
      (savedConfig.dialoguePauseMs ?? TTS_DIALOGUE_PAUSE_DEFAULT_SECONDS * 1000) / 1000,
    );
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
      toast.success(localizeUi("ui.panels.ttsconfigcard.exportedValue1CachedTtsClipValue2", { value1: entries.length, value2: entries.length === 1 ? "" :localizeUi("ui.noodle.stageprofileview.s") }));
    } catch {
      toast.error(localizeUi("ui.panels.ttsconfigcard.failedToExportCachedTtsClips"));
    } finally {
      setExportingTtsCache(false);
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
              ?localizeUi("ui.panels.ttsconfigcard.value1Value2Value3Value4Value5", { value1: selectedSource.label, value2: model || selectedSource.model, value3: selectedVoiceLabel, value4: narratorVoiceEnabled ?localizeUi("ui.panels.ttsconfigcard.narratorValue1", { value1: narratorVoiceLabel }) : "", value5: voicesFromProvider || source !== "openai" ? "" :localizeUi("ui.panels.ttsconfigcard.builtInVoices") })
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
            title={enabled ?localizeUi("ui.panels.ttsconfigcard.disableTts") :localizeUi("ui.panels.ttsconfigcard.enableTts")}
            className="rounded-lg p-1 hover:bg-[var(--secondary)]"
          />

          <button
            onClick={() => setExpanded((v) => !v)}
            className="mari-chrome-control mari-chrome-control--small h-8 min-h-0 w-8 p-0"
            title={expanded ?localizeUi("ui.panels.ttsconfigcard.collapse") :localizeUi("ui.panels.ttsconfigcard.expand")}
          >
            {expanded ? <ChevronUp size="0.875rem" /> : <ChevronDown size="0.875rem" />}
          </button>
        </div>
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="mt-3 space-y-4 border-t border-sky-400/10 pt-3">
          {/* Source */}
          <FieldRow label={localizeUi("ui.panels.ttsconfigcard.source")} help={localizeUi("ui.panels.ttsconfigcard.chooseTheProviderUsedByTheServerSideTts")}>
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
                ?localizeUi("ui.panels.ttsconfigcard.theElevenlabsApiRootUseTheDefaultUnlessYou")
                : source === "pockettts"
                  ?localizeUi("ui.panels.ttsconfigcard.thePocketttsOpenaiCompatibleServerRootItsDefaultIs")
                  : source === "xai"
                    ?localizeUi("ui.panels.ttsconfigcard.theXaiVoiceApiRootUseHttpsApiX")
                    :localizeUi("ui.panels.ttsconfigcard.theOpenaiCompatibleTtsApiEndpointUseTheDefault")
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
            <p className="text-[0.625rem] text-[var(--muted-foreground)]">{localizeUi("ui.panels.ttsconfigcard.encryptedAtRestKeepTheMaskedValueToPreserve")}</p>
          </FieldRow>

          {/* Model */}
          <FieldRow
            label={localizeUi("ui.panels.ttsconfigcard.model")}
            help={
              source === "elevenlabs"
                ?localizeUi("ui.panels.ttsconfigcard.elevenlabsModelIdToUseUseElevenV3For")
                : source === "pockettts"
                  ?localizeUi("ui.panels.ttsconfigcard.pocketttsSelectsItsLanguageModelWhenYouStartThe")
                  : source === "xai"
                    ?localizeUi("ui.panels.ttsconfigcard.xaiVoiceCurrentlyUsesTheTtsEndpointThisIs")
                    :localizeUi("ui.panels.ttsconfigcard.ttsModelToUseEGTts1Tts")
            }
          >
            <div className="relative">
              <input
                value={model}
                list={source === "elevenlabs" ? "elevenlabs-tts-models" : undefined}
                onChange={(e) => {
                  setModel(e.target.value);
                  mark({ model: e.target.value });
                }}
                className={cn(
                  INPUT_CLS,
                  source === "elevenlabs" &&
                    "pr-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0",
                )}
                placeholder={selectedSource.model}
              />
              {source === "elevenlabs" && <TtsDropdownIcon />}
            </div>
            {source === "elevenlabs" && (
              <>
                <datalist id="elevenlabs-tts-models">
                  {ELEVENLABS_TTS_MODELS.map((modelId) => (
                    <option key={modelId} value={modelId} />
                  ))}
                </datalist>
                <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">{localizeUi("ui.panels.ttsconfigcard.elevenV3SpeechUses")} <code className="font-mono">{"eleven_v3"}</code>{localizeUi("ui.panels.ttsconfigcard.idsContaining")}{" "}
                  <code className="font-mono">{"ttv"}</code> {localizeUi("ui.panels.ttsconfigcard.areTextToVoiceVoiceDesignModelsNanogptProxies")}{" "}
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
                  ?localizeUi("ui.panels.ttsconfigcard.elevenlabsVoicesAreFetchedByNameAndSavedBy")
                  : source === "pockettts"
                    ?localizeUi("ui.panels.ttsconfigcard.pocketttsBuiltInOrCustomVoiceFromYourServer")
                    : source === "xai"
                      ?localizeUi("ui.panels.ttsconfigcard.xaiVoiceIdBuiltInsIncludeEveAraRex")
                      :localizeUi("ui.panels.ttsconfigcard.voiceToUseForSynthesisFetchedFromYourConfigured")
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
                ) : (
                  <select
                    value={voice}
                    onChange={(e) => {
                      setVoice(e.target.value);
                      mark({ voice: e.target.value });
                    }}
                    disabled={fetchingVoices || voiceOptions.length === 0}
                    className={cn(INPUT_CLS, "flex-1 cursor-pointer appearance-none")}
                  >
                    {source === "elevenlabs" && <option value="">{localizeUi("ui.panels.ttsconfigcard.selectAnElevenlabsVoice")}</option>}
                    {fetchingVoices && <option value="">{localizeUi("ui.panels.ttsconfigcard.loadingVoices")}</option>}
                    {!fetchingVoices && voiceOptions.length === 0 && !voicesError && (
                      <option value="">
                        {source === "elevenlabs"
                          ?localizeUi("ui.panels.ttsconfigcard.enterApiKeySaveThenRefreshVoices")
                          :localizeUi("ui.panels.ttsconfigcard.saveConfigToLoadVoices")}
                      </option>
                    )}
                    {!fetchingVoices && voicesError && <option value="">{localizeUi("ui.panels.ttsconfigcard.couldNotLoadVoices")}</option>}
                    {voiceOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {formatVoiceOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => void refetchVoices()}
                  disabled={fetchingVoices || !savedConfig?.enabled}
                  className="mari-chrome-control mari-chrome-control--small shrink-0 text-xs"
                  title={localizeUi("ui.panels.ttsconfigcard.refreshVoicesFromProvider")}
                >
                  <RefreshCw size="0.75rem" className={cn(fetchingVoices && "animate-spin")} />
                </button>
              </div>
              {!voicesFromProvider && source === "openai" && voices.length > 0 && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">{localizeUi("ui.panels.ttsconfigcard.showingOpenaiBuiltInVoicesSaveEnableToLoad")}</p>
              )}
              {!voicesFromProvider && source === "elevenlabs" && !fetchingVoices && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">{localizeUi("ui.panels.ttsconfigcard.elevenlabsVoicesLoadAfterTheConnectionIsSavedWith")}</p>
              )}
              {!voicesFromProvider && source === "pockettts" && voices.length > 0 && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">{localizeUi("ui.panels.ttsconfigcard.showingPocketttsBuiltInFallbacksSaveAndRefreshTo")}</p>
              )}
              {voicesFromProvider && source === "pockettts" && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">{localizeUi("ui.panels.ttsconfigcard.loaded")} {voices.length} {localizeUi("ui.panels.ttsconfigcard.voice")}{voices.length === 1 ? "" :localizeUi("ui.noodle.stageprofileview.s")} {localizeUi("ui.panels.ttsconfigcard.fromPocketttsServer")}</p>
              )}
              {!voicesFromProvider && source === "xai" && voices.length > 0 && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">{localizeUi("ui.panels.ttsconfigcard.showingXaiBuiltInVoicesSaveWithAnApi")}</p>
              )}
            </FieldRow>
          )}

          {voiceMode === "per-character" && (
            <FieldRow label={localizeUi("ui.panels.ttsconfigcard.characterVoices")} help={localizeUi("ui.panels.ttsconfigcard.assignVoicesToSpecificCharactersFromYourCharactersTab")}>
              <div className="space-y-2 rounded-xl border border-sky-400/15 bg-sky-400/5 p-2">
                <div className="grid gap-2 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)] sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto]">
                  <span>{localizeUi("ui.panels.appearancesettings.character")}</span>
                  <span>{localizeUi("ui.panels.ttsconfigcard.voice_3091c84")}</span>
                  <span className="hidden sm:block" />
                </div>
                {voiceAssignments.length === 0 && (
                  <p className="rounded-lg border border-dashed border-[var(--border)] px-2.5 py-2 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">{localizeUi("ui.panels.ttsconfigcard.addACharacterVoiceToRouteTtsBySpeaker")}</p>
                )}
                {voiceAssignments.map((assignment, index) => (
                  <div
                    key={`${assignment.characterId || "character"}-${index}`}
                    className="grid gap-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto]"
                  >
                    <select
                      value={assignment.characterId}
                      onChange={(e) => handleVoiceAssignmentCharacterChange(index, e.target.value)}
                      className={cn(INPUT_CLS, "cursor-pointer appearance-none py-2 text-xs")}
                    >
                      <option value="">{localizeUi("ui.panels.ttsconfigcard.selectCharacter")}</option>
                      {characterOptions.map((option) => (
                        <option
                          key={option.id}
                          value={option.id}
                          disabled={assignedCharacterIds.has(option.id) && option.id !== assignment.characterId}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={assignment.voice}
                      onChange={(e) => handleVoiceAssignmentVoiceChange(index, e.target.value)}
                      disabled={fetchingVoices || voiceOptions.length === 0}
                      className={cn(INPUT_CLS, "cursor-pointer appearance-none py-2 text-xs")}
                    >
                      {source === "elevenlabs" && <option value="">{localizeUi("ui.panels.ttsconfigcard.selectVoice")}</option>}
                      {voiceOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {formatVoiceOptionLabel(option)}
                        </option>
                      ))}
                    </select>
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
                  <Plus size="0.75rem" />{localizeUi("ui.panels.ttsconfigcard.addCharacterVoice")}</button>
                {characterOptions.length === 0 && (
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">{localizeUi("ui.panels.ttsconfigcard.addCharactersInTheCharactersTabBeforeAssigningCharacter")}</p>
                )}
              </div>
            </FieldRow>
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
                  ) : (
                    <select
                      value={narratorVoice}
                      onChange={(e) => handleNarratorVoiceChange(e.target.value)}
                      disabled={fetchingVoices || voiceOptions.length === 0}
                      className={cn(INPUT_CLS, "min-w-0 flex-1 cursor-pointer appearance-none")}
                    >
                      {source === "elevenlabs" && <option value="">{localizeUi("ui.panels.ttsconfigcard.selectNarratorVoice")}</option>}
                      {fetchingVoices && <option value="">{localizeUi("ui.panels.ttsconfigcard.loadingVoices")}</option>}
                      {!fetchingVoices && voiceOptions.length === 0 && !voicesError && (
                        <option value="">
                          {source === "elevenlabs"
                            ?localizeUi("ui.panels.ttsconfigcard.enterApiKeySaveThenRefreshVoices")
                            :localizeUi("ui.panels.ttsconfigcard.saveConfigToLoadVoices")}
                        </option>
                      )}
                      {!fetchingVoices && voicesError && <option value="">{localizeUi("ui.panels.ttsconfigcard.couldNotLoadVoices")}</option>}
                      {voiceOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {formatVoiceOptionLabel(option)}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => void refetchVoices()}
                    disabled={fetchingVoices || !savedConfig?.enabled}
                    className="mari-chrome-control mari-chrome-control--small shrink-0 text-xs"
                    title={localizeUi("ui.panels.ttsconfigcard.refreshVoicesFromProvider")}
                  >
                    <RefreshCw size="0.75rem" className={cn(fetchingVoices && "animate-spin")} />
                  </button>
                </div>
              )}
              {narratorVoiceEnabled && source === "elevenlabs" && !narratorVoice && (
                <p className="text-[0.625rem] leading-relaxed text-amber-300/80">{localizeUi("ui.panels.ttsconfigcard.selectANarratorVoiceOrNarrationWillFallBack")}</p>
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
                  <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">{localizeUi("ui.panels.ttsconfigcard.npcsWithUnclearGenderUseAStablePickFrom")}</p>
                  {!voicesFromProvider && (
                    <p className="text-[0.625rem] leading-relaxed text-amber-300/80">{localizeUi("ui.panels.ttsconfigcard.saveAndEnableThisTtsProviderThenRefreshVoices")}</p>
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
                    {option.code ?localizeUi("ui.panels.ttsconfigcard.value1Value2", { value1: option.label, value2: option.code }) : option.label}
                  </option>
                ))}
              </select>
              {elevenLabsLanguageCode && (
                <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">{localizeUi("ui.panels.ttsconfigcard.forcing")} {selectedLanguage.label}{localizeUi("ui.panels.ttsconfigcard.elevenlabsMayRejectThisIfTheSelectedModelDoes")}</p>
              )}
            </FieldRow>
          )}

          {source === "elevenlabs" && (
            <FieldRow
              label={localizeUi("ui.panels.ttsconfigcard.stabilityValue1", { value1: Math.round(elevenLabsStability * 100) })}
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
              <span className="text-xs font-medium">
                {localizeUi("ui.panels.ttsconfigcard.gameAudioGeneration")}
              </span>
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
                label={localizeUi("ui.panels.ttsconfigcard.pauseBetweenDialoguesValue1Value2", { value1: dialoguePauseSeconds, value2: dialoguePauseSeconds === 1 ?localizeUi("ui.panels.ttsconfigcard.second") :localizeUi("ui.panels.ttsconfigcard.seconds") })}
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
                  <span>{TTS_DIALOGUE_PAUSE_MIN_SECONDS} {localizeUi("ui.noodle.stageprofileview.s")}</span>
                  <span>{TTS_DIALOGUE_PAUSE_MAX_SECONDS} {localizeUi("ui.noodle.stageprofileview.s")}</span>
                </div>
              </FieldRow>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-sky-400/15 bg-sky-400/5 px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium">{localizeUi("ui.panels.ttsconfigcard.cachedClips")}</div>
              <div className="truncate text-[0.625rem] text-[var(--muted-foreground)]">
                {ttsCacheSummary.count} {localizeUi("ui.panels.ttsconfigcard.clip")}{ttsCacheSummary.count === 1 ? "" :localizeUi("ui.noodle.stageprofileview.s")} ·{" "}
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
              {ttsState === "loading" ?localizeUi("ui.panels.ttsconfigcard.loading") : ttsState === "playing" ?localizeUi("ui.chat.summarypopover.stop") :localizeUi("settings.notifications.customSound.actions.preview")}
            </button>

            <div className="flex-1" />

            {/* Auto-save status */}
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-[0.6875rem] text-[var(--muted-foreground)]">
                <Loader2 size="0.625rem" className="animate-spin" />{localizeUi("chat.settings.inlineEditor.saving")}</span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-[0.6875rem] text-emerald-400">
                <Check size="0.625rem" />{localizeUi("chat.settings.inlineEditor.saved")}</span>
            )}
            {saveStatus === "error" && <span className="text-[0.6875rem] text-[var(--destructive)]">{localizeUi("ui.panels.ttsconfigcard.saveFailed")}</span>}
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
