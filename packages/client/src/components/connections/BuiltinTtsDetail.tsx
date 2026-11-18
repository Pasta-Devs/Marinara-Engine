// ──────────────────────────────────────────────
// The built-in voice models' page: Kokoro-82M and Supertonic 3, text to speech the Engine downloads and runs
// itself for the Voice job. Same anatomy as the other models on this device: hero with state, labelled actions,
// one facts card, then its own controls (voices with a preview, voice mixes, Remove files).
// ──────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import { HardDriveDownload, Play, Plus, Power, PowerOff, Settings2, Square, Trash2, X } from "lucide-react";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  BUILTIN_TTS_DEFAULT_VOICE,
  BUILTIN_TTS_LATIN_LANGUAGES,
  BUILTIN_TTS_SOURCE,
  BUILTIN_TTS_SUPERTONIC_LANGUAGES,
  recommendedBuiltinTtsModel,
  type BuiltinTtsBlend,
  type BuiltinTtsModelId,
  type BuiltinTtsModelInfo,
  type BuiltinTtsReadingLanguage,
  type BuiltinTtsStatus,
  type BuiltinTtsSupertonicLanguage,
  type BuiltinTtsVoice,
} from "@marinara-engine/shared";
import {
  previewBuiltinTts,
  useBuiltinTts,
  useCancelBuiltinTtsDownload,
  useDeleteBuiltinTtsBlend,
  useDownloadBuiltinTts,
  useLoadBuiltinTts,
  useRemoveBuiltinTtsModel,
  useSaveBuiltinTtsBlend,
  useSetBuiltinTtsSettings,
  useUnloadBuiltinTts,
  useUseBuiltinTtsModel,
} from "../../hooks/use-builtin-tts";
import { useTTSConfig, useUpdateTTSConfig } from "../../hooks/use-tts";
import { useConnections } from "../../hooks/use-connections";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { JOB, jobLabelKey } from "../../lib/connection-jobs";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { Spinner } from "../ui/Spinner";
import { DEVICE_VOICE, useJobModels } from "./ConnectionDefaults";
import type { ConnectionRowData } from "./ConnectionRow";
import {
  DETAIL_CARD_CLASS,
  DEVICE_FIELD,
  DetailHero,
  FactRow,
  formatBytes,
  SMALL_ACTION,
  StateWord,
  type EngineTone,
} from "./DeviceDetail";
import { ProviderIcon } from "./ProviderIcon";

/** A short line in each language a preview can read; the person can type their own. */
const SAMPLE_LINES: Record<string, string> = {
  en: "Hello! It's lovely to meet you. Shall we begin our story?",
  es: "¡Hola! Encantada de conocerte. ¿Empezamos nuestra historia?",
  fr: "Bonjour ! Ravie de te rencontrer. On commence notre histoire ?",
  hi: "नमस्ते! आपसे मिलकर बहुत खुशी हुई। क्या हम अपनी कहानी शुरू करें?",
  pt: "Olá! Que bom te conhecer. Vamos começar a nossa história?",
  ko: "안녕하세요! 만나서 정말 반가워요. 우리 이야기를 시작해 볼까요?",
  ja: "こんにちは！お会いできてとても嬉しいです。物語を始めましょうか？",
  de: "Hallo! Schön, dich kennenzulernen. Wollen wir mit unserer Geschichte beginnen?",
  pl: "Cześć! Miło cię poznać. Zaczynamy naszą historię?",
  ru: "Привет! Очень рада познакомиться. Начнём нашу историю?",
  zh: "你好！很高兴认识你。我们开始我们的故事吧？",
};

const MAX_BLEND_VOICES = 4;
const PREVIEW_MAX_CHARS = 300;

/** "en-us" → "en", "pt-br" → "pt". */
const baseLanguage = (code: string) => code.toLowerCase().split(/[-_]/)[0] ?? "en";

/** A language's own name in the Engine's language ("en-gb" → "English (United Kingdom)"). */
function useLanguageName() {
  const { i18n } = useTranslation();
  return useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([i18n.language, "en"], { type: "language" });
    } catch {
      names = null;
    }
    return (code: string) => {
      try {
        return names?.of(code) ?? code;
      } catch {
        return code;
      }
    };
  }, [i18n.language]);
}

/** Whether the Voice job speaks with the built-in voice model now. */
function useVoiceUsesBuiltin(): boolean {
  const { data: tts } = useTTSConfig();
  return !!tts?.enabled && tts.source === BUILTIN_TTS_SOURCE && !tts.connectionId?.trim();
}

/** The page's state as one coloured word, shared with the On this device rows. */
export function useBuiltinTtsState(): { name: string; tone: EngineTone; state: string; detail: string } | null {
  const { t } = useTranslation();
  const { data } = useBuiltinTts();
  const inUse = useVoiceUsesBuiltin();
  if (!data?.supported) return null;
  const name = t("connections.builtinTts.name");
  const active = data.models.find((model) => model.id === data.activeModelId);
  const detail = active?.label ?? "";
  const download = data.download;
  if (download?.status === "downloading") {
    const percent = download.total > 0 ? Math.round((download.downloaded / download.total) * 100) : 0;
    return { name, tone: "off", detail, state: t("connections.builtinEmbedding.downloadingPercent", { percent }) };
  }
  if (data.error && !data.loaded) return { name, tone: "warn", detail, state: t("connections.device.state.error") };
  if (!active) return { name, tone: "off", detail, state: t("connections.device.state.notDownloaded") };
  if (data.loading) return { name, tone: "off", detail, state: t("connections.device.state.starting") };
  if (!inUse) return { name, tone: "off", detail, state: t("connections.device.state.notInUse") };
  if (data.loaded) return { name, tone: "ok", detail, state: t("connections.device.state.running") };
  return { name, tone: "ok", detail, state: t("connections.builtinEmbedding.state.ready") };
}

/** Plays one preview at a time; a second press stops it. */
function usePreviewPlayer() {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const stop = () => {
    audio.current?.pause();
    audio.current = null;
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
    setPlaying(null);
  };
  useEffect(() => stop, []);
  const play = async (key: string, voice: string, text: string) => {
    if (playing === key) return stop();
    stop();
    setPending(key);
    try {
      const blob = await previewBuiltinTts(voice, text.slice(0, PREVIEW_MAX_CHARS));
      const next = URL.createObjectURL(blob);
      url.current = next;
      const element = new Audio(next);
      audio.current = element;
      element.onended = stop;
      setPlaying(key);
      await element.play();
    } catch (error) {
      stop();
      toast.error(error instanceof Error ? error.message : t("connections.builtinTts.previewFailed"));
    } finally {
      setPending(null);
    }
  };
  return { playing, pending, play };
}

function PlayButton({
  id,
  player,
  voice,
  text,
  label,
}: {
  id: string;
  player: ReturnType<typeof usePreviewPlayer>;
  voice: string;
  text: string;
  label: string;
}) {
  const { t } = useTranslation();
  const isPlaying = player.playing === id;
  return (
    <button
      type="button"
      onClick={() => void player.play(id, voice, text)}
      disabled={!!player.pending || !text.trim()}
      className={SMALL_ACTION}
      aria-label={isPlaying ? t("connections.builtinTts.stop") : label}
    >
      {player.pending === id ? <Spinner size="sm" /> : isPlaying ? <Square size="0.75rem" /> : <Play size="0.75rem" />}
      {isPlaying ? t("connections.builtinTts.stop") : t("connections.builtinTts.play")}
    </button>
  );
}

/** A voice dropdown, grouped by language. */
function VoiceSelect({
  voices,
  value,
  onChange,
  label,
  disabled,
  mixes = [],
}: {
  voices: readonly BuiltinTtsVoice[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  disabled?: boolean;
  /** Saved mixes, listed after the voices so the one the Voice job uses can be shown. */
  mixes?: readonly BuiltinTtsBlend[];
}) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const languageName = useLanguageName();
  const groups = useMemo(() => {
    const map = new Map<string, BuiltinTtsVoice[]>();
    for (const voice of voices) map.set(voice.language, [...(map.get(voice.language) ?? []), voice]);
    return [...map.entries()];
  }, [voices]);
  const gender = (voice: BuiltinTtsVoice) =>
    t(voice.gender === "female" ? "connections.builtinTts.female" : "connections.builtinTts.male");
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
      className={DEVICE_FIELD}
    >
      {groups.length === 1 && groups[0]![0] === "any"
        ? voices.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voice.name}
            </option>
          ))
        : groups.map(([language, list]) => (
            <optgroup key={language} label={languageName(language)}>
              {list.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {localizeUi("ui.agents.featureagentdetailhost.value1Value2", {
                    value1: voice.name,
                    value2: gender(voice),
                  })}
                </option>
              ))}
            </optgroup>
          ))}
      {mixes.length > 0 && (
        <optgroup label={t("connections.builtinTts.savedMixes")}>
          {mixes.map((mix) => (
            <option key={mix.id} value={mix.id}>
              {mix.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

/** Builds a mix of 2 to 4 voices of the model in use; it can be heard first, then saved with a name. */
function BlendCard({
  data,
  voices,
  sample,
  player,
}: {
  data: BuiltinTtsStatus;
  voices: readonly BuiltinTtsVoice[];
  sample: string;
  player: ReturnType<typeof usePreviewPlayer>;
}) {
  const { t } = useTranslation();
  const save = useSaveBuiltinTtsBlend();
  const remove = useDeleteBuiltinTtsBlend();
  const blends = data.blends.filter((blend) => blend.model === data.activeModelId);
  const [parts, setParts] = useState<Array<{ voice: string; weight: number }>>(() => [
    { voice: voices[0]?.id ?? "", weight: 50 },
    { voice: voices[1]?.id ?? voices[0]?.id ?? "", weight: 50 },
  ]);
  const [name, setName] = useState("");
  // A model switch changes the voices; start the mix again from the new model's first two.
  const modelId = data.activeModelId;
  useEffect(() => {
    setParts([
      { voice: voices[0]?.id ?? "", weight: 50 },
      { voice: voices[1]?.id ?? voices[0]?.id ?? "", weight: 50 },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);
  const total = parts.reduce((sum, part) => sum + part.weight, 0);
  const spec = parts.map((part) => `${part.voice}:${part.weight}`).join("+");
  const sameVoices = new Set(parts.map((part) => part.voice)).size < parts.length;
  const report = (error: unknown) =>
    toast.error(error instanceof Error ? error.message : t("connections.builtinEmbedding.failed"));
  const setPart = (index: number, next: Partial<{ voice: string; weight: number }>) =>
    setParts((current) => current.map((part, i) => (i === index ? { ...part, ...next } : part)));

  return (
    <section className={DETAIL_CARD_CLASS} data-builtin-tts-blend>
      <div className="text-xs font-semibold text-[var(--foreground)]">{t("connections.builtinTts.mixTitle")}</div>
      <p className="mt-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">{t("connections.builtinTts.mixHint")}</p>
      <div className="mt-2 flex flex-col gap-2">
        {parts.map((part, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2 max-sm:gap-1.5">
            <div className="min-w-0 w-[18rem] max-w-full max-sm:w-auto max-sm:flex-1">
              <VoiceSelect
                voices={voices}
                value={part.voice}
                onChange={(voice) => setPart(index, { voice })}
                label={t("connections.builtinTts.mixVoice", { number: index + 1 })}
              />
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={part.weight}
              onChange={(event) => setPart(index, { weight: Number(event.target.value) })}
              aria-label={t("connections.builtinTts.mixAmount", { number: index + 1 })}
              className="w-28 accent-[var(--primary)] max-sm:w-auto max-sm:flex-1"
            />
            <span className="w-9 text-right text-[0.6875rem] tabular-nums text-[var(--muted-foreground)]">
              {Math.round((part.weight / total) * 100)}%
            </span>
            {parts.length > 2 && (
              <button
                type="button"
                onClick={() => setParts((current) => current.filter((_, i) => i !== index))}
                className="mari-chrome-control mari-chrome-control--small p-1 max-md:min-h-11 max-md:min-w-11"
                aria-label={t("connections.builtinTts.mixRemoveVoice")}
                title={t("connections.builtinTts.mixRemoveVoice")}
              >
                <X size="0.75rem" />
              </button>
            )}
          </div>
        ))}
        {parts.length < MAX_BLEND_VOICES && (
          <button
            type="button"
            onClick={() =>
              setParts((current) => [
                ...current,
                {
                  voice: voices.find((voice) => !current.some((part) => part.voice === voice.id))?.id ?? "",
                  weight: 50,
                },
              ])
            }
            className={cn(SMALL_ACTION, "self-start")}
          >
            <Plus size="0.75rem" />
            {t("connections.builtinTts.mixAddVoice")}
          </button>
        )}
        {sameVoices && (
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("connections.builtinTts.mixSameVoice")}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("connections.builtinTts.mixNamePlaceholder")}
            aria-label={t("connections.builtinTts.mixName")}
            className={cn(DEVICE_FIELD, "min-w-0 w-[18rem] max-w-full max-sm:w-auto max-sm:flex-1")}
          />
          <PlayButton id="mix" player={player} voice={spec} text={sample} label={t("connections.builtinTts.mixPlay")} />
          <button
            type="button"
            disabled={!name.trim() || sameVoices || save.isPending}
            onClick={() =>
              save.mutate(
                { name: name.trim(), voice: spec },
                {
                  onSuccess: () => {
                    toast.success(t("connections.builtinTts.mixSaved", { name: name.trim() }));
                    setName("");
                  },
                  onError: report,
                },
              )
            }
            className={SMALL_ACTION}
          >
            {t("connections.builtinTts.mixSave")}
          </button>
        </div>
      </div>
      {blends.length > 0 && (
        <div className="mt-3 border-t border-[var(--border)] pt-2">
          <div className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
            {t("connections.builtinTts.savedMixes")}
          </div>
          {blends.map((blend) => (
            <div key={blend.id} className="flex min-h-9 items-center gap-2 text-xs max-md:min-h-11">
              <span className="min-w-0 flex-1 truncate" title={blend.id}>
                {blend.name}
              </span>
              <PlayButton
                id={`blend:${blend.id}`}
                player={player}
                voice={blend.id}
                text={sample}
                label={t("connections.builtinTts.playNamed", { name: blend.name })}
              />
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => remove.mutate(blend.id, { onError: report })}
                className="mari-chrome-control mari-chrome-control--small p-1 max-md:min-h-11 max-md:min-w-11"
                aria-label={t("connections.builtinTts.deleteNamed", { name: blend.name })}
                title={t("connections.builtinTts.deleteNamed", { name: blend.name })}
              >
                <Trash2 size="0.75rem" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function BuiltinTtsDetail() {
  const { t, i18n } = useTranslation();
  const languageName = useLanguageName();
  const status = useBuiltinTts();
  const { data: tts } = useTTSConfig();
  const updateTts = useUpdateTTSConfig();
  const modelFor = useJobModels((useConnections().data ?? []) as ConnectionRowData[]);
  const inUse = useVoiceUsesBuiltin();
  const download = useDownloadBuiltinTts();
  const cancel = useCancelBuiltinTtsDownload();
  const useModel = useUseBuiltinTtsModel();
  const setSettings = useSetBuiltinTtsSettings();
  const load = useLoadBuiltinTts();
  const unload = useUnloadBuiltinTts();
  const remove = useRemoveBuiltinTtsModel();
  const engine = useBuiltinTtsState();
  const player = usePreviewPlayer();
  const [picked, setPicked] = useState<BuiltinTtsModelId | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [sample, setSample] = useState<string | null>(null);

  const data = status.data;
  const recommended = recommendedBuiltinTtsModel(i18n.language);
  const active = data?.models.find((model) => model.id === data.activeModelId) ?? null;
  const activeVoices = useMemo(
    () => (data && active ? data.voices.filter((entry) => entry.model === active.id) : []),
    [active, data],
  );
  const activeMixes = useMemo(
    () => (data && active ? data.blends.filter((blend) => blend.model === active.id) : []),
    [active, data],
  );
  const known = (id: string) =>
    activeVoices.some((entry) => entry.id === id) || activeMixes.some((mix) => mix.id === id);
  // The voice or saved mix the Voice job uses, when it is one of this model's; otherwise the model's first.
  const savedVoice = inUse && tts?.voice && known(tts.voice) ? tts.voice : null;
  const chosenVoice =
    voice && known(voice) ? voice : (savedVoice ?? (active ? BUILTIN_TTS_DEFAULT_VOICE[active.id] : ""));
  // A mix reads with the language of the first voice in it.
  const chosen =
    activeVoices.find((entry) => entry.id === chosenVoice) ??
    activeVoices.find((entry) => entry.id === chosenVoice.split(":")[0]);
  const chosenName = activeMixes.find((mix) => mix.id === chosenVoice)?.name ?? chosen?.name ?? chosenVoice;
  // The preview line follows the voice's language (Kokoro) or the reading language (Supertonic).
  const sampleLanguage = (() => {
    if (!data || !active) return "en";
    if (chosen && chosen.language !== "any") return baseLanguage(chosen.language);
    const reading = data.settings.language;
    if (reading !== "auto") return reading;
    const engineLanguage = baseLanguage(i18n.language);
    return (BUILTIN_TTS_SUPERTONIC_LANGUAGES as readonly string[]).includes(engineLanguage)
      ? engineLanguage
      : data.settings.latinLanguage;
  })();
  const sampleText = sample ?? SAMPLE_LINES[sampleLanguage] ?? SAMPLE_LINES.en!;
  // A new voice or language brings its own sample line back, unless the person typed one.
  useEffect(() => setSample(null), [sampleLanguage]);

  if (!data) {
    return status.isError ? (
      <p className="text-xs text-[var(--muted-foreground)]">{t("connections.builtinTts.statusFailed")}</p>
    ) : (
      <Spinner size="sm" />
    );
  }
  if (!data.supported) {
    return <p className="text-xs text-[var(--muted-foreground)]">{t("connections.builtinTts.unsupported")}</p>;
  }
  const report = (error: unknown) =>
    toast.error(error instanceof Error ? error.message : t("connections.builtinEmbedding.failed"));

  const installed = (id: BuiltinTtsModelId) => data.installed.includes(id);
  const downloading = data.download?.status === "downloading" ? data.download : null;
  const failedDownload = data.download?.status === "error" ? data.download : null;
  const choice =
    data.models.find((model) => model.id === picked) ??
    active ??
    data.models.find((model) => model.id === recommended) ??
    data.models[0]!;
  // While a picked model downloads, the page shows it: it becomes the model in use when done.
  const pickedDownload = downloading && downloading.modelId === picked ? choice : null;
  const shown = pickedDownload ?? active ?? choice;
  const busy =
    download.isPending ||
    useModel.isPending ||
    load.isPending ||
    unload.isPending ||
    remove.isPending ||
    setSettings.isPending;

  const languagesOf = (model: BuiltinTtsModelInfo) =>
    model.id === "supertonic-3"
      ? [...BUILTIN_TTS_SUPERTONIC_LANGUAGES]
      : [...new Set(data.voices.filter((entry) => entry.model === model.id).map((entry) => entry.language))];

  const describe = (model: BuiltinTtsModelInfo) =>
    [
      installed(model.id)
        ? ""
        : t("connections.builtinEmbedding.notDownloadedSize", { size: formatBytes(model.downloadBytes) }),
      model.id === recommended ? t("connections.builtinTts.recommendedForLanguage") : "",
      t(model.id === "supertonic-3" ? "connections.builtinTts.aboutSupertonic" : "connections.builtinTts.aboutKokoro", {
        voices: data.voices.filter((entry) => entry.model === model.id).length,
        license: model.license,
      }),
    ]
      .filter(Boolean)
      .join(" ");

  const startDownload = async (model: BuiltinTtsModelInfo) => {
    const confirmed = await showConfirmDialog({
      title: t("connections.builtinEmbedding.downloadTitle", { model: model.label }),
      message: [
        t("connections.builtinTts.downloadBody", {
          size: formatBytes(model.downloadBytes),
          memory: formatBytes(model.ramBytes),
          license: model.license,
        }),
        model.id === "supertonic-3" ? t("connections.builtinTts.supertonicTerms") : "",
      ]
        .filter(Boolean)
        .join(" "),
      confirmLabel: t("connections.device.download"),
    });
    if (!confirmed) return;
    setPicked(model.id);
    download.mutate({ modelId: model.id, use: true }, { onError: report });
  };

  const pickModel = async (model: BuiltinTtsModelInfo) => {
    if (!active) return setPicked(model.id);
    if (model.id === active.id) return;
    if (!installed(model.id)) return startDownload(model);
    useModel.mutate(model.id, {
      onSuccess: () => toast.success(t("connections.builtinTts.switched", { model: model.label })),
      onError: report,
    });
  };

  const removeFiles = async () => {
    if (!active) return;
    const other = data.models.find((model) => model.id !== active.id && installed(model.id));
    const confirmed = await showConfirmDialog({
      title: t("connections.builtinEmbedding.removeTitle", { model: active.label }),
      message: other
        ? t("connections.builtinTts.removeBodyOther", { other: other.label })
        : t("connections.builtinTts.removeBody"),
      confirmLabel: t("connections.device.removeFiles"),
      tone: "destructive",
    });
    if (confirmed) remove.mutate(active.id, { onError: report });
  };

  const toggleLoad = () => {
    if (data.loaded) unload.mutate(undefined, { onError: report });
    else
      load.mutate(undefined, {
        onSuccess: () => toast.success(t("connections.builtinTts.loaded")),
        onError: report,
      });
  };

  const useForVoice = async () => {
    // The button waits for the TTS settings to load, so a save that returns has happened;
    // a failed one shows its own error.
    const saved = await modelFor(JOB.voice)?.onChange(`${DEVICE_VOICE}${BUILTIN_TTS_SOURCE}`);
    if (saved === true) toast.success(t("connections.builtinTts.nowVoice"));
  };

  const makeDefaultVoice = () => {
    if (!tts) return;
    updateTts.mutate(
      { ...tts, voice: chosenVoice },
      {
        onSuccess: () => toast.success(t("connections.builtinTts.defaultVoiceSet", { voice: chosenName })),
        onError: report,
      },
    );
  };

  return (
    <div className="flex flex-col gap-3" data-component="BuiltinTtsDetail">
      <DetailHero icon={<ProviderIcon provider="builtin-tts" size="lg" />} title={t("connections.builtinTts.name")}>
        {engine ? <StateWord tone={engine.tone} label={engine.state} /> : null}
        <span>· {t("connections.accounts.section.device")}</span>
      </DetailHero>

      {active && (
        <div className="flex flex-wrap gap-1.5">
          {!inUse && (
            <button type="button" onClick={() => void useForVoice()} disabled={!tts} className={SMALL_ACTION}>
              {t("connections.device.useForVoice")}
            </button>
          )}
          <button type="button" onClick={toggleLoad} disabled={busy || data.loading} className={SMALL_ACTION}>
            {load.isPending || unload.isPending || data.loading ? (
              <Spinner size="sm" />
            ) : data.loaded ? (
              <PowerOff size="0.75rem" />
            ) : (
              <Power size="0.75rem" />
            )}
            {load.isPending || data.loading
              ? t("connections.device.pleaseWait")
              : data.loaded
                ? t("connections.builtinEmbedding.unload")
                : t("connections.builtinEmbedding.load")}
          </button>
          <button
            type="button"
            onClick={() => useUIStore.getState().openModal("job-settings", { job: "voice" })}
            className={SMALL_ACTION}
          >
            <Settings2 size="0.75rem" />
            {t("connections.device.openJobSettings")}
          </button>
        </div>
      )}

      {data.error && !data.loaded && (
        <div
          role="alert"
          className="mari-device-warn rounded-lg border border-[var(--marinara-app-accent-static)]/20 bg-[var(--marinara-app-accent-static)]/5 p-2.5 text-[0.6875rem]"
        >
          <div className="font-medium text-[var(--marinara-app-accent-static)]">
            {t("connections.builtinTts.didNotStart")}
          </div>
          <div className="mt-1 text-[var(--muted-foreground)] [overflow-wrap:anywhere]">{data.error}</div>
        </div>
      )}

      <section className={DETAIL_CARD_CLASS}>
        <FactRow label={t("connections.device.fact.model")}>
          {/* A dropdown, not chips: a phone has room for the name on one line and little more. */}
          <select
            value={shown.id}
            disabled={busy || !!downloading}
            onChange={(event) => {
              const model = data.models.find((entry) => entry.id === event.target.value);
              if (model) void pickModel(model);
            }}
            aria-label={t("connections.device.fact.model")}
            className={DEVICE_FIELD}
          >
            {data.models.map((model) => (
              <option key={model.id} value={model.id}>
                {installed(model.id)
                  ? model.label
                  : t("connections.builtinEmbedding.optionToDownload", {
                      model: model.label,
                      size: formatBytes(model.downloadBytes),
                    })}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[0.6875rem] text-[var(--muted-foreground)]">{describe(shown)}</span>
        </FactRow>
        <FactRow label={t("connections.builtinTts.languages")}>
          {languagesOf(shown)
            .map((code) => languageName(code))
            .join(", ")}
        </FactRow>
        <FactRow label={t("connections.device.fact.memory")}>
          {t("connections.builtinEmbedding.memoryUpTo", { max: formatBytes(shown.ramBytes) })}
          <span className="block text-[0.6875rem] text-[var(--muted-foreground)]">
            {t("connections.builtinTts.unloadsWhenIdle")}
          </span>
        </FactRow>
        <FactRow label={t("connections.device.fact.usedBy")}>
          {inUse ? t(jobLabelKey(JOB.voice)) : t("connections.device.usedBy.none")}
        </FactRow>
        {active?.id === "supertonic-3" && (
          <FactRow label={t("connections.builtinTts.readsIn")}>
            <select
              value={data.settings.language}
              disabled={busy}
              onChange={(event) =>
                setSettings.mutate({ language: event.target.value as BuiltinTtsReadingLanguage }, { onError: report })
              }
              aria-label={t("connections.builtinTts.readsIn")}
              className={DEVICE_FIELD}
            >
              <option value="auto">{t("connections.builtinTts.readsInAuto")}</option>
              {BUILTIN_TTS_SUPERTONIC_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {languageName(code)}
                </option>
              ))}
            </select>
            {data.settings.language === "auto" && (
              <span className="mt-1 block text-[0.6875rem] text-[var(--muted-foreground)]">
                {t("connections.builtinTts.readsInAutoHint")}
              </span>
            )}
          </FactRow>
        )}
        {active?.id === "supertonic-3" && data.settings.language === "auto" && (
          <FactRow label={t("connections.builtinTts.latinText")}>
            <select
              value={data.settings.latinLanguage}
              disabled={busy}
              onChange={(event) =>
                setSettings.mutate(
                  { latinLanguage: event.target.value as BuiltinTtsSupertonicLanguage },
                  { onError: report },
                )
              }
              aria-label={t("connections.builtinTts.latinText")}
              className={DEVICE_FIELD}
            >
              {BUILTIN_TTS_LATIN_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {languageName(code)}
                </option>
              ))}
            </select>
          </FactRow>
        )}
      </section>

      {downloading ? (
        <div className="flex flex-col gap-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--secondary)]">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-[width]"
              style={{
                width: `${downloading.total > 0 ? Math.min(100, Math.round((downloading.downloaded / downloading.total) * 100)) : 8}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-2 text-[0.6875rem] text-[var(--muted-foreground)]">
            <span className="min-w-0 truncate">
              {t("connections.builtinEmbedding.downloadingOf", {
                model: downloading.label,
                done: formatBytes(downloading.downloaded),
                total: formatBytes(downloading.total),
              })}
            </span>
            <button
              type="button"
              onClick={() => cancel.mutate(undefined, { onError: report })}
              className={SMALL_ACTION}
            >
              <X size="0.75rem" />
              {t("connections.builtinEmbedding.cancel")}
            </button>
          </div>
        </div>
      ) : !active ? (
        <button
          type="button"
          onClick={() => void startDownload(choice)}
          disabled={busy}
          className="mari-chrome-control mari-chrome-control--primary w-full"
        >
          <HardDriveDownload size="0.8125rem" />
          {t("connections.builtinEmbedding.downloadModel", {
            model: choice.label,
            size: formatBytes(choice.downloadBytes),
          })}
        </button>
      ) : null}

      {failedDownload && (
        <p role="alert" className="text-[0.6875rem] text-[var(--marinara-app-accent-static)] [overflow-wrap:anywhere]">
          {t("connections.builtinEmbedding.downloadFailed", { error: failedDownload.error ?? "" })}
        </p>
      )}

      {active && (
        <section className={DETAIL_CARD_CLASS} data-builtin-tts-voices>
          <div className="text-xs font-semibold text-[var(--foreground)]">{t("connections.builtinTts.voices")}</div>
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 w-[18rem] max-w-full max-sm:w-auto max-sm:flex-1">
                <VoiceSelect
                  voices={activeVoices}
                  mixes={activeMixes}
                  value={chosenVoice}
                  onChange={setVoice}
                  label={t("connections.builtinTts.voice")}
                />
              </div>
              <PlayButton
                id="voice"
                player={player}
                voice={chosenVoice}
                text={sampleText}
                label={t("connections.builtinTts.playNamed", { name: chosenName })}
              />
              {inUse &&
                tts?.voice !== chosenVoice &&
                !(tts?.voice === "" && chosenVoice === BUILTIN_TTS_DEFAULT_VOICE[active.id]) && (
                  <button
                    type="button"
                    onClick={makeDefaultVoice}
                    disabled={updateTts.isPending}
                    className={SMALL_ACTION}
                  >
                    {t("connections.builtinTts.makeDefault")}
                  </button>
                )}
            </div>
            <textarea
              value={sampleText}
              maxLength={PREVIEW_MAX_CHARS}
              rows={2}
              onChange={(event) => setSample(event.target.value)}
              aria-label={t("connections.builtinTts.sampleLine")}
              className="mari-chrome-field min-h-14 w-full resize-y px-2 py-1.5 text-xs max-sm:text-base"
            />
            <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("connections.builtinTts.voicesHint")}</p>
          </div>
        </section>
      )}

      {active && activeVoices.length > 1 && (
        <BlendCard data={data} voices={activeVoices} sample={sampleText} player={player} />
      )}

      {shown.id === "supertonic-3" && (
        <p className="px-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">
          {t("connections.builtinTts.supertonicTerms")}
        </p>
      )}

      {active && !downloading && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void removeFiles()}
          className={cn(SMALL_ACTION, "mari-device-remove self-start")}
        >
          <Trash2 size="0.75rem" />
          {t("connections.device.removeFiles")}
        </button>
      )}
    </div>
  );
}
