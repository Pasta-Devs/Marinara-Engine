// ──────────────────────────────────────────────
// Character Voice — this character's row in Connections → Text to Speech.
// It edits the shared TTS settings, not the card, so both places stay in sync
// and a pick saves right away instead of waiting for the editor's Save.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Play, RefreshCw, Settings2, Square, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { setCharacterVoiceAssignment } from "@marinara-engine/shared";
import { useTTSConfig, useTTSVoices, useUpdateTTSVoiceAssignment, useUpdateTTSVoiceMode } from "../../hooks/use-tts";
import { getCharacterNameVoice, getCharacterVoiceAssignment, resolveTTSVoiceForSpeaker } from "../../lib/tts-dialogue";
import { ttsService } from "../../lib/tts-service";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { buildTTSVoiceOptions, CustomizableVoiceInput, VoiceSelect } from "../panels/settings/TTSConfigCard";

const SAVE_DELAY_MS = 600;
const ICON_ACTION_CLS =
  "mari-editor-action inline-flex min-h-9 shrink-0 disabled:cursor-not-allowed disabled:opacity-50";
const ACTION_CLS = cn(ICON_ACTION_CLS, "items-center gap-1.5 px-2.5 text-xs");

export function CharacterVoicePicker({
  characterId,
  characterName,
  spokenName,
}: {
  characterId: string;
  /** Saved card name; kept on the row so speakers matched only by name still find it. */
  characterName: string;
  /** Said in the preview, so a phonetic spelling can be heard before saving the card. */
  spokenName: string;
}) {
  const { t } = useTranslation();
  const { data: config, isLoading: configLoading, dataUpdatedAt } = useTTSConfig();
  const updateVoiceMode = useUpdateTTSVoiceMode();
  const updateVoiceAssignment = useUpdateTTSVoiceAssignment();
  const perCharacter = config?.enabled === true && config.voiceMode === "per-character";
  const voicesQuery = useTTSVoices(config?.source ?? "openai", config?.baseUrl ?? "", perCharacter);

  const savedVoice = getCharacterVoiceAssignment(config?.voiceAssignments, characterId);
  const [draftVoice, setDraftVoice] = useState<string | null>(null);
  const voice = draftVoice ?? savedVoice;
  const pendingSaveRef = useRef<{ timer: ReturnType<typeof setTimeout>; voice: string } | null>(null);
  // Saves not answered yet. A refetch that lands meanwhile can be older than what was typed.
  const savesInFlightRef = useRef(0);
  // Each save waits for the one before it, so the server applies them in the order they were made.
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const saveVoiceRef = useRef((_voice: string) => {});
  saveVoiceRef.current = (nextVoice: string) => {
    // Only this character's row is sent, so settings saved elsewhere since this page loaded stay as they are.
    const input = { characterId, characterName, voice: nextVoice };
    savesInFlightRef.current += 1;
    const save = saveQueueRef.current.then(() => updateVoiceAssignment.mutateAsync(input));
    saveQueueRef.current = save.catch(() => undefined);
    save.then(
      () => {
        savesInFlightRef.current -= 1;
      },
      () => {
        savesInFlightRef.current -= 1;
        toast.error(t("ui.characters.voice.saveFailed"));
        if (!pendingSaveRef.current && savesInFlightRef.current === 0) setDraftVoice(null);
      },
    );
  };

  const flushPendingSave = useCallback(() => {
    const pending = pendingSaveRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingSaveRef.current = null;
    saveVoiceRef.current(pending.voice);
  }, []);

  // A pick made just before leaving the editor is saved, not dropped.
  useEffect(() => flushPendingSave, [flushPendingSave]);

  // Show the saved voice again once every save has landed, or when Text to Speech settings change it.
  useEffect(() => {
    if (!pendingSaveRef.current && savesInFlightRef.current === 0) setDraftVoice(null);
  }, [savedVoice, dataUpdatedAt]);

  const changeVoice = (nextVoice: string) => {
    setDraftVoice(nextVoice);
    if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current.timer);
    pendingSaveRef.current = { timer: setTimeout(flushPendingSave, SAVE_DELAY_MS), voice: nextVoice };
  };

  const [playback, setPlayback] = useState(() => ({
    state: ttsService.getState(),
    activeId: ttsService.getActiveId(),
  }));
  useEffect(() => ttsService.subscribe((state, activeId) => setPlayback({ state, activeId })), []);
  const previewId = `character-voice-preview:${characterId}`;
  const previewBusy =
    playback.activeId === previewId &&
    (playback.state === "loading" || playback.state === "playing" || playback.state === "blocked");
  // The same lookup chat playback uses, with the unsaved pick applied.
  const previewVoice = config
    ? resolveTTSVoiceForSpeaker(
        {
          ...config,
          voiceAssignments: setCharacterVoiceAssignment(config.voiceAssignments, { characterId, characterName }, voice),
        },
        characterName,
        characterId,
      )
    : "";
  const previewBlocked = config?.source === "elevenlabs" && !previewVoice;

  const handlePreview = () => {
    if (previewBusy) {
      ttsService.stop();
      return;
    }
    const name = spokenName.trim();
    const line = name ? `Hi, I'm ${name}. This is how I sound.` : "Hi! This is how I sound.";
    // Keep the effective voice and its backend together; an empty id is legacy.
    ttsService
      .speak(line, previewId, {
        throwOnError: true,
        voice: previewVoice,
        speaker: characterName || undefined,
        audioConnectionId: config?.cacheConnectionId ?? "",
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error && error.message ? error.message : t("ui.characters.voice.previewFailed"));
      });
  };

  const switchToPerCharacterVoices = () => {
    updateVoiceMode
      .mutateAsync({ voiceMode: "per-character" })
      .catch(() => toast.error(t("ui.characters.voice.saveFailed")));
  };

  const voiceOptions = useMemo(
    () => buildTTSVoiceOptions(voicesQuery.data, config?.source ?? "openai", [voice]),
    [config?.source, voice, voicesQuery.data],
  );
  // Without a voice of its own, a card can still speak with one set for its name.
  const nameVoice = getCharacterNameVoice(config?.voiceAssignments, { characterId, characterName });
  const emptyVoiceLabel = nameVoice
    ? t("ui.characters.voice.sameNameVoice", {
        voice: voiceOptions.find((option) => option.id === nameVoice)?.name ?? nameVoice,
      })
    : t("ui.characters.voice.defaultVoice");

  if (configLoading) return <div className="shimmer h-9 w-full rounded-xl" aria-hidden="true" />;

  if (!perCharacter) {
    const ttsOn = config?.enabled === true;
    return (
      <div className="mari-editor-panel mari-editor-panel--soft space-y-2.5 p-3">
        <p className="text-xs text-[var(--muted-foreground)]">
          {ttsOn ? t("ui.characters.voice.sharedVoice") : t("ui.characters.voice.ttsOff")}
        </p>
        <div className="flex flex-wrap gap-2">
          {ttsOn && (
            <button
              type="button"
              onClick={switchToPerCharacterVoices}
              disabled={updateVoiceMode.isPending}
              className={ACTION_CLS}
            >
              {updateVoiceMode.isPending ? (
                <Loader2 size="0.8rem" className="animate-spin" />
              ) : (
                <Volume2 size="0.8rem" />
              )}
              {t("ui.characters.voice.usePerCharacter")}
            </button>
          )}
          <button
            type="button"
            onClick={() => useUIStore.getState().openRightPanel("connections")}
            className={ACTION_CLS}
          >
            <Settings2 size="0.8rem" />
            {t("ui.characters.voice.openSettings")}
          </button>
        </div>
      </div>
    );
  }

  const ariaLabel = t("ui.panels.ttsconfigcard.characterVoiceFor", { name: characterName || spokenName });
  const refreshLabel = t("ui.panels.ttsconfigcard.refreshVoicesFromProvider");
  return (
    <div className="space-y-1.5">
      <div className="flex min-w-0 items-center gap-2">
        {config.source === "openai" ? (
          <CustomizableVoiceInput
            value={voice}
            options={voiceOptions}
            placeholder={emptyVoiceLabel}
            ariaLabel={ariaLabel}
            testId="character-voice-input"
            onChange={changeVoice}
          />
        ) : (
          <VoiceSelect
            value={voice}
            options={voiceOptions}
            disabled={voicesQuery.isLoading || voiceOptions.length === 0}
            placeholder={voicesQuery.isLoading ? t("ui.panels.ttsconfigcard.loadingVoices") : emptyVoiceLabel}
            ariaLabel={ariaLabel}
            onChange={changeVoice}
          />
        )}
        <button
          type="button"
          onClick={() => void voicesQuery.refetch()}
          disabled={voicesQuery.isFetching}
          className={ICON_ACTION_CLS}
          title={refreshLabel}
          aria-label={refreshLabel}
        >
          <RefreshCw size="0.8rem" className={cn(voicesQuery.isFetching && "animate-spin")} />
        </button>
        <button
          type="button"
          onClick={handlePreview}
          disabled={previewBlocked && !previewBusy}
          className={ACTION_CLS}
          title={previewBlocked ? t("ui.characters.voice.pickVoiceFirst") : undefined}
        >
          {previewBusy && playback.state === "loading" ? (
            <Loader2 size="0.8rem" className="animate-spin" />
          ) : previewBusy ? (
            <Square size="0.8rem" />
          ) : (
            <Play size="0.8rem" />
          )}
          {previewBusy && playback.state !== "loading"
            ? t("ui.chat.summarypopover.stop")
            : t("settings.notifications.customSound.actions.preview")}
        </button>
      </div>
      {voicesQuery.isError && (
        <p className="text-[0.6875rem] text-[var(--destructive)]">{t("ui.panels.ttsconfigcard.couldNotLoadVoices")}</p>
      )}
    </div>
  );
}
