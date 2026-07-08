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
  TTSVoiceAssignment,
  TTSVoiceMode,
  TTSAudioFormat,
  TTSConversationCallAudioInputMode,
} from "@marinara-engine/shared";
import { ELEVENLABS_TTS_LANGUAGE_OPTIONS, TTS_API_KEY_MASK } from "@marinara-engine/shared";
import { HelpTooltip } from "../../ui/HelpTooltip";
import { SettingsCheckbox, SettingsSwitch } from "./SettingControls";

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

const INPUT_CLS =
  "w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";

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
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">{label}</span>
        <span className="text-[0.625rem] text-[var(--muted-foreground)]">{selected.length} selected</span>
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
          No provider voices loaded yet.
        </p>
      )}
      {note && <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">{note}</p>}
    </div>
  );
}

// ── Main card ─────────────────────────────────────

export function TTSConfigCard() {
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
  const [autoplayRP, setAutoplayRP] = useState(false);
  const [autoplayConvo, setAutoplayConvo] = useState(false);
  const [autoplayGame, setAutoplayGame] = useState(false);
  const [progressivePlayback, setProgressivePlayback] = useState(false);
  const [dialogueOnly, setDialogueOnly] = useState(false);
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
    setAutoplayRP(savedConfig.autoplayRP);
    setAutoplayConvo(savedConfig.autoplayConvo);
    setAutoplayGame(savedConfig.autoplayGame);
    setProgressivePlayback(savedConfig.progressivePlayback ?? false);
    setDialogueOnly(savedConfig.dialogueOnly ?? false);
    setAudioFormat(savedConfig.audioFormat ?? "mp3");
    setCallAudioEnabled(savedConfig.callAudioEnabled ?? false);
    setCallAudioInputMode(savedConfig.callAudioInputMode ?? "local_whisper");
    setCallVideoInputEnabled(savedConfig.callVideoInputEnabled ?? false);
    setCallCharacterVideoEnabled(savedConfig.callCharacterVideoEnabled ?? false);
    setCallAutomaticVideoClipsEnabled(savedConfig.callAutomaticVideoClipsEnabled ?? false);
    setCallCustomVideoClipsEnabled(savedConfig.callCustomVideoClipsEnabled ?? false);
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
    autoplayRP,
    autoplayConvo,
    autoplayGame,
    progressivePlayback,
    dialogueOnly,
    audioFormat,
    dialogueScope: "all",
    dialogueCharacterName: "",
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
        toast.error("Failed to save TTS settings.");
      }
    }, 600);
  };

  const handleSourceChange = (nextSource: TTSSource) => {
    const defaults = TTS_SOURCE_DEFAULTS[nextSource];
    const nextApiKey = apiKey === TTS_API_KEY_MASK ? "" : apiKey;

    setSource(nextSource);
    setBaseUrl(defaults.baseUrl);
    setApiKey(nextApiKey);
    setModel(defaults.model);
    setVoice(defaults.voice);
    setVoiceMode("single");
    setVoiceAssignments([]);
    setNarratorVoiceEnabled(false);
    setNarratorVoice(defaults.voice);
    setNpcDefaultVoicesEnabled(false);
    setNpcDefaultMaleVoices([]);
    setNpcDefaultFemaleVoices([]);
    setElevenLabsLanguageCode("");
    mark({
      source: nextSource,
      baseUrl: defaults.baseUrl,
      apiKey: nextApiKey,
      model: defaults.model,
      voice: defaults.voice,
      voiceMode: "single",
      voiceAssignments: [],
      narratorVoiceEnabled: false,
      narratorVoice: defaults.voice,
      npcDefaultVoicesEnabled: false,
      npcDefaultMaleVoices: [],
      npcDefaultFemaleVoices: [],
      elevenLabsLanguageCode: "",
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
        toast.error("Select an ElevenLabs voice before previewing.");
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
        toast.info("No cached TTS clips to export yet.");
        setTtsCacheSummary({ count: 0, bytes: 0 });
        return;
      }

      entries.forEach((entry, index) => downloadTTSClip(entry, index));
      setTtsCacheSummary({
        count: entries.length,
        bytes: entries.reduce((total, entry) => total + Math.max(0, entry.size || entry.blob.size), 0),
      });
      toast.success(`Exported ${entries.length} cached TTS clip${entries.length === 1 ? "" : "s"}.`);
    } catch {
      toast.error("Failed to export cached TTS clips.");
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
          <div className="text-sm font-medium">Text to Speech</div>
          <div className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">
            {enabled
              ? `${selectedSource.label} · ${model || selectedSource.model} · ${selectedVoiceLabel}${narratorVoiceEnabled ? ` · Narrator: ${narratorVoiceLabel}` : ""}${voicesFromProvider || source !== "openai" ? "" : " (built-in voices)"}`
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
            title={enabled ? "Disable TTS" : "Enable TTS"}
            className="rounded-lg p-1 hover:bg-[var(--secondary)]"
          />

          <button
            onClick={() => setExpanded((v) => !v)}
            className="mari-chrome-control mari-chrome-control--small h-8 min-h-0 w-8 p-0"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp size="0.875rem" /> : <ChevronDown size="0.875rem" />}
          </button>
        </div>
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Source */}
          <FieldRow label="Source" help="Choose the provider used by the server-side TTS proxy.">
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
            label="Base URL"
            help={
              source === "elevenlabs"
                ? "The ElevenLabs API root. Use the default unless you proxy ElevenLabs through another server."
                : source === "pockettts"
                  ? "The PocketTTS server root. Start it with pocket-tts serve, then use http://localhost:8000 unless you changed the port."
                  : source === "xai"
                    ? "The xAI Voice API root. Use https://api.x.ai/v1 unless you proxy xAI through another server."
                    : "The OpenAI-compatible TTS API endpoint. Use the default for OpenAI or point to a self-hosted server."
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
            label="API Key"
            help="Your API key for the TTS provider. Encrypted at rest. Keep the masked value to preserve the current key, or clear the field to remove it."
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
                placeholder="Enter API key or clear to remove"
              />
            </div>
            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
              Encrypted at rest · Keep the masked value to preserve the current key, or clear it to remove the saved key
            </p>
          </FieldRow>

          {/* Model */}
          <FieldRow
            label="Model"
            help={
              source === "elevenlabs"
                ? "ElevenLabs model_id to use. Use eleven_v3 for Eleven v3 speech; eleven_ttv_v3 is a voice-design model and cannot generate TTS."
                : source === "pockettts"
                  ? "PocketTTS selects its language/model when you start the local server. This field is kept for clarity and future compatible servers."
                  : source === "xai"
                    ? "xAI Voice currently uses the /tts endpoint; this is saved for compatibility with future model selection."
                    : "TTS model to use. e.g. tts-1, tts-1-hd, gpt-4o-mini-tts, or any model your provider supports."
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
                <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                  Eleven v3 speech uses <code className="font-mono">eleven_v3</code>. IDs containing{" "}
                  <code className="font-mono">ttv</code> are Text to Voice / voice design models. NanoGPT proxies use{" "}
                  <code className="font-mono">Elevenlabs-V3</code>.
                </p>
              </>
            )}
          </FieldRow>

          {/* Voice assignment mode */}
          <FieldRow
            label="Voice Option"
            help="Use one voice for every character, or assign specific voices to characters from your Characters tab."
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
              <option value="single">One voice for all characters</option>
              <option value="per-character">Selected per character</option>
            </select>
          </FieldRow>

          {voiceMode === "single" && (
            <FieldRow
              label="All Characters Voice"
              help={
                source === "elevenlabs"
                  ? "ElevenLabs voices are fetched by name and saved by voice ID."
                  : source === "pockettts"
                    ? "PocketTTS built-in voice name or a voice URL/path accepted by your PocketTTS server."
                    : source === "xai"
                      ? "xAI Voice ID. Built-ins include eve, ara, rex, sal, and leo; custom xAI voice IDs can be typed after saving."
                      : "Voice to use for synthesis. Fetched from your configured provider when available."
              }
            >
              <div className="flex gap-2">
                {source === "pockettts" ? (
                  <>
                    <input
                      value={voice}
                      list="pockettts-voices"
                      onChange={(e) => {
                        setVoice(e.target.value);
                        mark({ voice: e.target.value });
                      }}
                      className={cn(INPUT_CLS, "flex-1")}
                      placeholder="alba or a voice URL/path"
                    />
                    <datalist id="pockettts-voices">
                      {voiceOptions.map((option) => (
                        <option key={option.id} value={option.id} />
                      ))}
                    </datalist>
                  </>
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
                    {source === "elevenlabs" && <option value="">Select an ElevenLabs voice</option>}
                    {fetchingVoices && <option value="">Loading voices…</option>}
                    {!fetchingVoices && voiceOptions.length === 0 && !voicesError && (
                      <option value="">
                        {source === "elevenlabs"
                          ? "Enter API key, save, then refresh voices"
                          : "Save config to load voices"}
                      </option>
                    )}
                    {!fetchingVoices && voicesError && <option value="">Could not load voices</option>}
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
                  title="Refresh voices from provider"
                >
                  <RefreshCw size="0.75rem" className={cn(fetchingVoices && "animate-spin")} />
                </button>
              </div>
              {!voicesFromProvider && source === "openai" && voices.length > 0 && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  Showing OpenAI built-in voices — save & enable to load from your provider
                </p>
              )}
              {!voicesFromProvider && source === "elevenlabs" && !fetchingVoices && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  ElevenLabs voices load after the connection is saved with an API key
                </p>
              )}
              {!voicesFromProvider && source === "pockettts" && voices.length > 0 && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  Showing PocketTTS built-in voices. You can type a custom voice URL or path accepted by your server.
                </p>
              )}
              {!voicesFromProvider && source === "xai" && voices.length > 0 && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  Showing xAI built-in voices. Save with an API key, then refresh to load account/custom voices.
                </p>
              )}
            </FieldRow>
          )}

          {voiceMode === "per-character" && (
            <FieldRow label="Character Voices" help="Assign voices to specific characters from your Characters tab.">
              <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/40 p-2">
                <div className="grid gap-2 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)] sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto]">
                  <span>Character</span>
                  <span>Voice</span>
                  <span className="hidden sm:block" />
                </div>
                {voiceAssignments.length === 0 && (
                  <p className="rounded-lg border border-dashed border-[var(--border)] px-2.5 py-2 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
                    Add a character voice to route TTS by speaker.
                  </p>
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
                      <option value="">Select character</option>
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
                      {source === "elevenlabs" && <option value="">Select voice</option>}
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
                      title="Remove character voice"
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
                  Add character voice
                </button>
                {characterOptions.length === 0 && (
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    Add characters in the Characters tab before assigning character voices.
                  </p>
                )}
              </div>
            </FieldRow>
          )}

          <FieldRow
            label="Narrator Voice"
            help="Use a separate voice for narrator messages, game narration, and roleplay narration outside speaker-tagged dialogue."
          >
            <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/40 p-2">
              <ToggleRow
                label="Use separate narrator voice"
                checked={narratorVoiceEnabled}
                onChange={toggleNarratorVoice}
              />
              {narratorVoiceEnabled && (
                <div className="flex gap-2 max-sm:flex-col">
                  {source === "pockettts" ? (
                    <>
                      <input
                        value={narratorVoice}
                        list="pockettts-narrator-voices"
                        onChange={(e) => handleNarratorVoiceChange(e.target.value)}
                        className={cn(INPUT_CLS, "min-w-0 flex-1")}
                        placeholder="alba or a voice URL/path"
                      />
                      <datalist id="pockettts-narrator-voices">
                        {voiceOptions.map((option) => (
                          <option key={option.id} value={option.id} />
                        ))}
                      </datalist>
                    </>
                  ) : (
                    <select
                      value={narratorVoice}
                      onChange={(e) => handleNarratorVoiceChange(e.target.value)}
                      disabled={fetchingVoices || voiceOptions.length === 0}
                      className={cn(INPUT_CLS, "min-w-0 flex-1 cursor-pointer appearance-none")}
                    >
                      {source === "elevenlabs" && <option value="">Select narrator voice</option>}
                      {fetchingVoices && <option value="">Loading voices…</option>}
                      {!fetchingVoices && voiceOptions.length === 0 && !voicesError && (
                        <option value="">
                          {source === "elevenlabs"
                            ? "Enter API key, save, then refresh voices"
                            : "Save config to load voices"}
                        </option>
                      )}
                      {!fetchingVoices && voicesError && <option value="">Could not load voices</option>}
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
                    title="Refresh voices from provider"
                  >
                    <RefreshCw size="0.75rem" className={cn(fetchingVoices && "animate-spin")} />
                  </button>
                </div>
              )}
              {narratorVoiceEnabled && source === "elevenlabs" && !narratorVoice && (
                <p className="text-[0.625rem] leading-relaxed text-amber-300/80">
                  Select a narrator voice, or narration will fall back only when a global voice is available.
                </p>
              )}
            </div>
          </FieldRow>

          {source !== "elevenlabs" && (
            <FieldRow
              label="Audio Format"
              help="Output audio format. WAV are useful for local/self-hosted TTS servers that do not support MP3."
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
                <option value="mp3">MP3</option>
                <option value="wav">WAV</option>
              </select>
            </FieldRow>
          )}

          <FieldRow
            label="Random NPC Voices"
            help="When enabled, tracked game NPCs without a character-specific voice use a stable random provider voice. If voice metadata is available, Marinara prefers matching male/female pools."
          >
            <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/40 p-2">
              <ToggleRow
                label="Use default voices for random NPCs"
                checked={npcDefaultVoicesEnabled}
                onChange={toggleNpcDefaultVoices}
              />
              {npcDefaultVoicesEnabled && (
                <div className="space-y-3 pt-1">
                  <NpcDefaultVoicePool
                    label="Male NPC defaults"
                    options={elevenLabsNpcMaleVoiceOptions}
                    selected={npcDefaultMaleVoices}
                    onToggle={(voiceId, checked) => toggleNpcDefaultVoice("male", voiceId, checked)}
                    note={maleNpcVoiceFallbackNote}
                  />
                  <NpcDefaultVoicePool
                    label="Female NPC defaults"
                    options={elevenLabsNpcFemaleVoiceOptions}
                    selected={npcDefaultFemaleVoices}
                    onToggle={(voiceId, checked) => toggleNpcDefaultVoice("female", voiceId, checked)}
                    note={femaleNpcVoiceFallbackNote}
                  />
                  <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                    NPCs with unclear gender use a stable pick from both pools. Assigned character voices still win.
                  </p>
                  {!voicesFromProvider && (
                    <p className="text-[0.625rem] leading-relaxed text-amber-300/80">
                      Save and enable this TTS provider, then refresh voices to load provider voice options.
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
              label="Language"
              help="Optional ElevenLabs language_code. Auto lets ElevenLabs detect the language; choose a language to force pronunciation and text normalization. The selected model must support that language."
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
                    {option.code ? `${option.label} (${option.code})` : option.label}
                  </option>
                ))}
              </select>
              {elevenLabsLanguageCode && (
                <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                  Forcing {selectedLanguage.label}; ElevenLabs may reject this if the selected model does not support
                  it.
                </p>
              )}
            </FieldRow>
          )}

          {source === "elevenlabs" && (
            <FieldRow
              label={`Stability — ${Math.round(elevenLabsStability * 100)}%`}
              help="ElevenLabs voice stability. Lower values are more expressive and creative; higher values are more consistent and robust."
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
                <span>Creative</span>
                <span>Natural</span>
                <span>Robust</span>
              </div>
            </FieldRow>
          )}

          {/* Auto-play */}
          <div className="space-y-1">
            <span className="text-xs font-medium">Auto-play</span>
            <ToggleRow
              label="Roleplay messages"
              checked={autoplayRP}
              onChange={(v) => {
                setAutoplayRP(v);
                mark({ autoplayRP: v });
              }}
            />
            <ToggleRow
              label="Conversation messages"
              checked={autoplayConvo}
              onChange={(v) => {
                setAutoplayConvo(v);
                mark({ autoplayConvo: v });
              }}
            />
            <ToggleRow
              label="Game narration"
              checked={autoplayGame}
              onChange={(v) => {
                setAutoplayGame(v);
                mark({ autoplayGame: v });
              }}
            />
            <ToggleRow
              label="Progressive playback"
              checked={progressivePlayback}
              onChange={(v) => {
                setProgressivePlayback(v);
                mark({ progressivePlayback: v });
              }}
            />
            <ToggleRow
              label="Only read dialogues"
              checked={dialogueOnly}
              onChange={(v) => {
                setDialogueOnly(v);
                mark({ dialogueOnly: v, dialogueScope: "all", dialogueCharacterName: "" });
              }}
            />
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/40 px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium">Cached clips</div>
              <div className="truncate text-[0.625rem] text-[var(--muted-foreground)]">
                {ttsCacheSummary.count} clip{ttsCacheSummary.count === 1 ? "" : "s"} ·{" "}
                {formatCacheBytes(ttsCacheSummary.bytes)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleExportCachedClips()}
              disabled={exportingTtsCache || ttsCacheSummary.count === 0}
              className="mari-chrome-control mari-chrome-control--small shrink-0 text-xs"
              title="Export cached TTS clips"
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
              {ttsState === "loading" ? "Loading…" : ttsState === "playing" ? "Stop" : "Preview"}
            </button>

            <div className="flex-1" />

            {/* Auto-save status */}
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-[0.6875rem] text-[var(--muted-foreground)]">
                <Loader2 size="0.625rem" className="animate-spin" />
                Saving…
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-[0.6875rem] text-emerald-400">
                <Check size="0.625rem" />
                Saved
              </span>
            )}
            {saveStatus === "error" && <span className="text-[0.6875rem] text-[var(--destructive)]">Save failed</span>}
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
