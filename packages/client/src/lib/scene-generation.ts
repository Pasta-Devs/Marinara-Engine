import { toast } from "sonner";
import type {
  SceneCreateResponse,
  SceneFullPlan,
  ScenePlanResponse,
  ScenePromptPreferences,
} from "@marinara-engine/shared";
import { api } from "./api-client";
import { useChatStore } from "../stores/chat.store";
import { normalizeScenePromptPreferences, useUIStore } from "../stores/ui.store";

export interface StartSceneOptions {
  chatId: string;
  prompt: string;
  initiatorCharId?: string | null;
  initiatorCharName?: string | null;
  background?: string | null;
  planHint?: string | null;
  connectionId?: string | null;
  onCreated?: (response: SceneCreateResponse) => void;
}

let pendingScenePromptPreferencesSettle: ((preferences: ScenePromptPreferences | null) => void) | null = null;

export function requestScenePromptPreferences(sourceLabel?: string | null): Promise<ScenePromptPreferences | null> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (preferences: ScenePromptPreferences | null) => {
      if (settled) return;
      settled = true;
      if (pendingScenePromptPreferencesSettle === settle) {
        pendingScenePromptPreferencesSettle = null;
      }
      resolve(preferences);
    };

    pendingScenePromptPreferencesSettle?.(null);
    pendingScenePromptPreferencesSettle = settle;

    const ui = useUIStore.getState();
    ui.openModal("scene-prompt-preferences", {
      sourceLabel: sourceLabel ?? null,
      initialPreferences: ui.scenePromptPreferences,
      onSubmit: (preferences: ScenePromptPreferences) => {
        const normalized = normalizeScenePromptPreferences(preferences);
        useUIStore.getState().setScenePromptPreferences(normalized);
        useUIStore.getState().closeModal();
        settle(normalized);
      },
      onCancel: () => {
        useUIStore.getState().closeModal();
        settle(null);
      },
    });
  });
}

export async function startSceneWithPromptPreferences(options: StartSceneOptions): Promise<SceneCreateResponse | null> {
  const preferences = await requestScenePromptPreferences(options.initiatorCharName ?? null);
  if (!preferences) return null;

  const toastId = toast.loading("Planning scene...", { icon: "🎬" });
  let plan: SceneFullPlan | null = null;
  try {
    const planningPrompt = [options.prompt, options.planHint ? `Suggested plot plan:\n${options.planHint}` : ""]
      .map((part) => part.trim())
      .filter(Boolean)
      .join("\n\n");
    const planRes = await api.post<ScenePlanResponse>("/scene/plan", {
      chatId: options.chatId,
      prompt: planningPrompt,
      connectionId: options.connectionId ?? null,
      promptPreferences: preferences,
    });
    plan = planRes.plan;
    if (!plan) {
      toast.error(planRes.error || "Scene planning returned empty result. Try again.", { id: toastId });
      return null;
    }
  } catch {
    toast.error("Failed to plan scene. Check your API connection.", { id: toastId });
    return null;
  }

  if (options.background) {
    plan.background = options.background;
  }

  toast.loading("Creating scene...", { id: toastId, icon: "🎬" });
  try {
    const response = await api.post<SceneCreateResponse>("/scene/create", {
      originChatId: options.chatId,
      initiatorCharId: options.initiatorCharId ?? null,
      plan,
      connectionId: options.connectionId ?? null,
      promptPresetId: preferences.promptPresetId ?? null,
    });

    useChatStore.getState().setActiveChatId(response.chatId);
    if (response.background) {
      useUIStore.getState().setChatBackground(`/api/backgrounds/file/${encodeURIComponent(response.background)}`);
    }
    options.onCreated?.(response);
    toast.success(`Scene created: ${response.chatName}`, { id: toastId, icon: "🎬" });
    return response;
  } catch {
    toast.error("Failed to create scene chat.", { id: toastId });
    return null;
  }
}
