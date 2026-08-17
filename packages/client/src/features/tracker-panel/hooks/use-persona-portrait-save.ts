import { useCallback, useRef } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { useUpdatePersonaTrackerCard } from "../../../hooks/use-characters";

const PERSONA_PORTRAIT_SAVE_MAX_ATTEMPTS = 3;
const PERSONA_PORTRAIT_SAVE_RETRY_DELAY_MS = 400;

export interface PersonaPortraitSaveSnapshot {
  id: string;
  portraitFocusX: number;
  portraitFocusY: number;
  portraitZoom: number;
}

interface PendingPersonaPortraitSave {
  attempt: number;
  snapshot: PersonaPortraitSaveSnapshot;
  version: number;
}

export function usePersonaPortraitSaveCoordinator() {
  const { t: localizeUi } = useUiTranslation();
  const { mutateAsync } = useUpdatePersonaTrackerCard();
  const pendingSaveByPersonaIdRef = useRef(new Map<string, PendingPersonaPortraitSave>());
  const latestSaveVersionByPersonaIdRef = useRef(new Map<string, number>());
  const nextSaveVersionRef = useRef(0);
  const flushQueueRef = useRef<PendingPersonaPortraitSave[]>([]);
  const drainingRef = useRef(false);

  const drainPersonaPortraitSaves = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;

    try {
      let save: PendingPersonaPortraitSave | undefined;
      while ((save = flushQueueRef.current.shift())) {
        const personaId = save.snapshot.id;
        if (latestSaveVersionByPersonaIdRef.current.get(personaId) !== save.version) continue;

        try {
          await mutateAsync({
            id: personaId,
            keepalive: true,
            trackerCardPortrait: {
              portraitFocusX: save.snapshot.portraitFocusX,
              portraitFocusY: save.snapshot.portraitFocusY,
              portraitZoom: save.snapshot.portraitZoom,
            },
          });
        } catch (error) {
          if (latestSaveVersionByPersonaIdRef.current.get(personaId) !== save.version) continue;
          if (save.attempt >= PERSONA_PORTRAIT_SAVE_MAX_ATTEMPTS) {
            console.error("[tracker] Persona portrait save failed after retries", error);
            toast.error(localizeUi("ui.trackerPanel.personainventorypanel.failedToSavePortraitFraming"));
            continue;
          }

          const retryDelay = PERSONA_PORTRAIT_SAVE_RETRY_DELAY_MS * 2 ** (save.attempt - 1);
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, retryDelay);
          });
          if (latestSaveVersionByPersonaIdRef.current.get(personaId) !== save.version) continue;
          flushQueueRef.current.unshift({ ...save, attempt: save.attempt + 1 });
        }
      }
    } finally {
      drainingRef.current = false;
    }
  }, [localizeUi, mutateAsync]);

  const queuePersonaPortraitSave = useCallback((snapshot: PersonaPortraitSaveSnapshot) => {
    const version = ++nextSaveVersionRef.current;
    latestSaveVersionByPersonaIdRef.current.set(snapshot.id, version);
    pendingSaveByPersonaIdRef.current.set(snapshot.id, { attempt: 1, snapshot, version });
  }, []);

  const flushPersonaPortraitSave = useCallback(
    (personaId: string) => {
      const pendingSave = pendingSaveByPersonaIdRef.current.get(personaId);
      if (!pendingSave) return;
      pendingSaveByPersonaIdRef.current.delete(personaId);
      flushQueueRef.current.push(pendingSave);
      void drainPersonaPortraitSaves();
    },
    [drainPersonaPortraitSaves],
  );

  return { queuePersonaPortraitSave, flushPersonaPortraitSave };
}
