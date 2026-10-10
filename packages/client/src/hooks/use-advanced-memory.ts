import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  advancedMemoryProblems,
  type AdvancedMemoryJob,
  type AdvancedMemorySettings,
  type AdvancedMemoryStatus,
  type Message,
} from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { EXPORT_FAILED_TOAST_ID } from "../lib/file-download";
import { translate } from "../localization/i18n";
import { useChatStore } from "../stores/chat.store";
import { useUIStore } from "../stores/ui.store";
import { chatKeys } from "./use-chats";

export const advancedMemoryKeys = {
  status: (chatId: string) => ["advanced-memory", chatId] as const,
  sources: (chatId: string, recordId: string) => ["advanced-memory-sources", chatId, recordId] as const,
};

export const ADVANCED_MEMORY_SETTINGS_EVENT = "marinara:advanced-memory-settings";
const notifiedFailures = new Map<string, string>();

export function notifyAdvancedMemoryFailure(chatId: string, job: Pick<AdvancedMemoryJob, "id" | "status" | "error">) {
  if (job.status !== "error") {
    notifiedFailures.delete(chatId);
    toast.dismiss(`advanced-memory-error-${chatId}`);
    return;
  }
  if (!job.error) return;
  const failure = JSON.stringify([job.id, job.error]);
  if (notifiedFailures.get(chatId) === failure) return;
  notifiedFailures.set(chatId, failure);
  if (notifiedFailures.size > 100) notifiedFailures.delete(notifiedFailures.keys().next().value!);
  toast.error(translate("chat.advancedMemory.failureNotice"), {
    id: `advanced-memory-error-${chatId}`,
    duration: 15_000,
    action: {
      label: translate("chat.advancedMemory.reviewFailure"),
      onClick: () => {
        useChatStore.getState().setActiveChatId(chatId);
        window.dispatchEvent(new CustomEvent(ADVANCED_MEMORY_SETTINGS_EVENT, { detail: { chatId } }));
      },
    },
  });
}

/** Opens Chat Settings at Advanced Memory for a chat, optionally at one scene or starting Fix there. */
export function openAdvancedMemory(chatId: string, request: { sceneId?: string; fix?: boolean } = {}) {
  useChatStore.getState().setActiveChatId(chatId);
  const ui = useUIStore.getState();
  if (request.sceneId || request.fix) ui.setAdvancedMemoryRequest({ chatId, ...request });
  ui.setChatSettingsSectionExpanded("roleplay-memory-recall", true);
  window.dispatchEvent(new CustomEvent(ADVANCED_MEMORY_SETTINGS_EVENT, { detail: { chatId } }));
}

/** Scene numbers as Access memories shows them: saved and missing scenes in message order. */
export function advancedMemorySceneNumbers(status: AdvancedMemoryStatus | undefined): Map<string, number> {
  const scenes = (status?.records ?? [])
    .filter((record) => record.kind === "scene")
    .sort((a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex);
  const ids = [...scenes, ...(status?.unpreparedScenes ?? [])]
    .sort((a, b) => a.startIndex - b.startIndex)
    .map((scene) => scene.sceneId);
  return new Map([...new Set(ids)].map((id, index) => [id, index + 1]));
}

// ponytail: which problem scenes and Fix results this browser already announced, per chat. Capped at
// 50 chats; a forgotten chat is announced once more. Server-side seen state would follow the user across devices.
const NOTIFIED_KEY = "marinara:advanced-memory-notified";
function readNotified(): Record<string, string[]> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

/** Remembers that these problem scenes (or `fix:<jobId>` results) were shown, so no notice repeats them. */
export function markAdvancedMemoryNotified(chatId: string, ids: string[]) {
  const all = readNotified();
  const known = Array.isArray(all[chatId]) ? all[chatId] : [];
  if (ids.every((id) => known.includes(id))) return;
  delete all[chatId];
  all[chatId] = [...new Set([...known, ...ids])].slice(-500);
  for (const id of Object.keys(all).slice(0, -50)) delete all[id];
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(all));
  } catch {
    /* Private windows may refuse storage; the notice may then show again. */
  }
}

function notified(chatId: string, id: string) {
  const known = readNotified()[chatId];
  return Array.isArray(known) && known.includes(id);
}

/**
 * Watches the open chat's Advanced Memory while Chat Settings is closed: problems show a dot on the Chat
 * Settings button and one notice per new problem scene, and a finished Fix shows its result once.
 */
export function useAdvancedMemoryAttention(chatId: string, enabled: boolean, settingsOpen: boolean) {
  const { t } = useTranslation();
  const { data } = useAdvancedMemoryStatus(chatId, enabled);
  const status = enabled ? data : undefined;
  const problems = useMemo(() => (status ? advancedMemoryProblems(status) : null), [status]);
  const job = status?.job;
  const busy = job?.status === "running" || job?.status === "error";
  const sceneIds = problems ? [...problems.fixSceneIds, ...problems.reviewSceneIds] : [];
  const sceneKey = sceneIds.join("\0");
  const fixable = !!problems?.fixSceneIds.length;
  const fixResult = job?.fixResult;
  const fixFinished = !!fixResult && !(job?.status === "running" && job.id === fixResult.jobId);
  useEffect(() => {
    if (!fixResult || !fixFinished || notified(chatId, `fix:${fixResult.jobId}`)) return;
    // Problems Fix reports are not announced again as new ones.
    markAdvancedMemoryNotified(chatId, [`fix:${fixResult.jobId}`, ...(sceneKey ? sceneKey.split("\0") : [])]);
    if (settingsOpen) return; // The Fix box shows and announces the result.
    const fixed = fixResult.fixedSceneIds.length;
    const review = fixResult.reviewSceneIds.length;
    toast(fixed ? t("chat.advancedMemory.fix.doneNotice", { count: fixed }) : t("chat.advancedMemory.fix.noneFixed"), {
      id: `advanced-memory-fix-${chatId}`,
      duration: 15_000,
      ...(review ? { description: t("chat.advancedMemory.fix.doneReviewNotice", { count: review }) } : {}),
      action: { label: t("chat.advancedMemory.fix.show"), onClick: () => openAdvancedMemory(chatId) },
    });
  }, [chatId, fixFinished, fixResult, sceneKey, settingsOpen, t]);
  useEffect(() => {
    // A stopped job already has its own notice; Chat Settings shows the problems itself.
    if (busy || settingsOpen || !sceneKey) return;
    const ids = sceneKey.split("\0");
    if (ids.every((id) => notified(chatId, id))) return;
    markAdvancedMemoryNotified(chatId, ids);
    toast(t("chat.advancedMemory.fix.notice", { count: ids.length }), {
      id: `advanced-memory-problems-${chatId}`,
      duration: 15_000,
      action: {
        label: t(fixable ? "chat.advancedMemory.fix.action" : "chat.advancedMemory.reviewFailure"),
        onClick: () => openAdvancedMemory(chatId, { fix: fixable }),
      },
    });
  }, [busy, chatId, fixable, sceneKey, settingsOpen, t]);
  return !!problems && job?.status !== "running" && (!!sceneKey || problems.blockers.length > 0 || problems.stopped);
}

export function useAdvancedMemoryStatus(chatId: string, enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: advancedMemoryKeys.status(chatId),
    queryFn: ({ signal }) => api.get<AdvancedMemoryStatus>(`/chats/${chatId}/advanced-memory`, { signal }),
    enabled: !!chatId && enabled,
    staleTime: 1_000,
    refetchInterval: (query) => (enabled && query.state.data?.job.status === "running" ? 1_000 : false),
  });
  const jobId = query.data?.job.id;
  const jobStatus = query.data?.job.status;
  const jobError = query.data?.job.error;
  useEffect(() => {
    if (enabled && jobStatus)
      notifyAdvancedMemoryFailure(chatId, { id: jobId, status: jobStatus, error: jobError ?? null });
  }, [chatId, enabled, jobId, jobStatus, jobError]);
  useEffect(() => {
    if (jobId && jobStatus === "ready") void qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
  }, [chatId, jobId, jobStatus, qc]);
  return query;
}

type AdvancedMemoryAction =
  | {
      action: "settings";
      settings:
        Partial<AdvancedMemorySettings> | ((current: AdvancedMemorySettings) => Partial<AdvancedMemorySettings>);
    }
  | {
      action: "initialize";
      settings?: Partial<AdvancedMemorySettings>;
      debugMode?: boolean;
      sceneId?: string;
      /** Fix: repair every flagged scene in one run. */
      fixAll?: boolean;
      /** Find scenes again between these message numbers. */
      range?: { start: number; end: number };
    }
  | { action: "cancel" | "reindex" | "reset" }
  | {
      action: "record";
      recordId: string;
      patch: { content?: string; timeline?: string; enabled?: boolean; audienceCharacterIds?: string[] };
    }
  | { action: "delete-record"; recordId: string }
  | { action: "import"; envelope: unknown };

export function useAdvancedMemoryAction(chatId: string) {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    scope: { id: `advanced-memory:${chatId}` },
    mutationFn: async (request: AdvancedMemoryAction) => {
      const base = `/chats/${chatId}/advanced-memory`;
      switch (request.action) {
        case "settings": {
          // Scoped mutations run in order; derive coupled limits after earlier saves have settled.
          const settings =
            typeof request.settings === "function"
              ? request.settings(
                  (
                    qc.getQueryData<AdvancedMemoryStatus>(advancedMemoryKeys.status(chatId)) ??
                    (await api.get<AdvancedMemoryStatus>(base))
                  ).settings,
                )
              : request.settings;
          return api.patch<AdvancedMemoryStatus>(`${base}/settings`, settings);
        }
        case "record":
          return api.patch<AdvancedMemoryStatus>(`${base}/records/${request.recordId}`, request.patch);
        case "delete-record":
          return api.delete<AdvancedMemoryStatus>(`${base}/records/${request.recordId}`);
        case "initialize":
          return api.post<AdvancedMemoryStatus>(`${base}/initialize`, {
            settings: request.settings,
            debugMode: request.debugMode,
            sceneId: request.sceneId,
            fixAll: request.fixAll,
            range: request.range,
          });
        case "import":
          return api.post<AdvancedMemoryStatus>(`${base}/import`, request.envelope);
        case "reset":
          return api.delete<AdvancedMemoryStatus>(base);
        default:
          return api.post<AdvancedMemoryStatus>(`${base}/${request.action}`, {});
      }
    },
    onSuccess: async (status, request) => {
      // An older status fetch must not replace this save before the next queued edit reads it.
      await qc.cancelQueries({ queryKey: advancedMemoryKeys.status(chatId), exact: true });
      qc.setQueryData(advancedMemoryKeys.status(chatId), status);
      // Record edits change neither chat metadata nor their source messages.
      if (request.action === "record" || request.action === "delete-record") return;
      void qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
      void qc.invalidateQueries({ queryKey: ["advanced-memory-sources", chatId] });
    },
    onError: (error) => toast.error(t("chat.advancedMemory.failed", { message: error.message })),
  });
}

export function useAdvancedMemorySources(chatId: string, recordId: string | null) {
  return useQuery({
    queryKey: advancedMemoryKeys.sources(chatId, recordId ?? ""),
    queryFn: ({ signal }) =>
      api.get<Message[]>(`/chats/${chatId}/advanced-memory/records/${recordId}/sources`, { signal }),
    enabled: !!chatId && !!recordId,
    staleTime: 0,
  });
}

export function useAdvancedMemoryKnowledgeMessages(chatId: string, enabled: boolean, before?: string) {
  return useQuery({
    queryKey: ["advanced-memory-knowledge-messages", chatId, before],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ limit: "50" });
      if (before) params.set("before", before);
      return api.get<Array<Message & { rowid: number }>>(`/chats/${chatId}/messages?${params}`, { signal });
    },
    enabled: !!chatId && enabled,
    staleTime: 0,
  });
}

export function useExportAdvancedMemory(chatId: string) {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: () => api.download(`/chats/${chatId}/advanced-memory/export`, `advanced-memory-${chatId}.json`),
    onError: (error) =>
      toast.error(t("chat.advancedMemory.failed", { message: error.message }), { id: EXPORT_FAILED_TOAST_ID }),
  });
}
