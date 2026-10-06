import { toast } from "sonner";
import type {
  SceneCreateResponse,
  SceneFullPlan,
  ScenePackageData,
  ScenePackageOrigin,
  ScenePlanResponse,
  ScenePromptPreferences,
} from "@marinara-engine/shared";
import { api } from "./api-client";
import { useChatStore } from "../stores/chat.store";
import { normalizeScenePromptPreferences, useUIStore } from "../stores/ui.store";

export interface StartSceneOptions {
  /** The Conversation the scene branches from. Exactly one of this and `packageOrigin`. */
  chatId?: string;
  /** The package thread the scene branches from. */
  packageOrigin?: ScenePackageOrigin;
  /** The package's per-scene settings, handed back to its `claim` and `release`. */
  packageData?: ScenePackageData | null;
  prompt: string;
  initiatorCharId?: string | null;
  initiatorCharName?: string | null;
  background?: string | null;
  planHint?: string | null;
  /**
   * A plan the caller prepared itself (a package that writes its own scenes). Skips the preference
   * dialog and the Engine planner; the scene is created exactly as planned.
   */
  plan?: SceneFullPlan | null;
  connectionId?: string | null;
  onCreated?: (response: SceneCreateResponse) => void;
}

let pendingScenePromptPreferencesSettle: ((preferences: ScenePromptPreferences | null) => void) | null = null;

export function requestScenePromptPreferences(
  sourceLabel?: string | null,
  chatId?: string,
): Promise<ScenePromptPreferences | null> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (preferences: ScenePromptPreferences | null) => {
      if (settled) return;
      settled = true;
      if (pendingScenePromptPreferencesSettle === settle) {
        pendingScenePromptPreferencesSettle = null;
      }
      unsubscribe();
      resolve(preferences);
    };

    pendingScenePromptPreferencesSettle?.(null);
    pendingScenePromptPreferencesSettle = settle;

    const ui = useUIStore.getState();
    const modalProps = {
      chatId,
      sourceLabel: sourceLabel ?? null,
      initialPreferences: ui.scenePromptPreferences,
      onSubmit: (preferences: ScenePromptPreferences) => {
        if (settled) return;
        const normalized = normalizeScenePromptPreferences(preferences);
        useUIStore.getState().setScenePromptPreferences(normalized);
        settle({
          ...normalized,
          ...(preferences.presetChoices ? { presetChoices: preferences.presetChoices } : {}),
          ...(preferences.participantCharacterIds
            ? { participantCharacterIds: preferences.participantCharacterIds }
            : {}),
          ...(preferences.personaId !== undefined ? { personaId: preferences.personaId } : {}),
        });
        useUIStore.getState().closeModal();
      },
      onCancel: () => {
        if (settled) return;
        settle(null);
        useUIStore.getState().closeModal();
      },
    };
    const unsubscribe = useUIStore.subscribe((state) => {
      if (state.modal?.props !== modalProps) settle(null);
    });
    ui.openModal("scene-prompt-preferences", modalProps);
  });
}

export async function startSceneWithPromptPreferences(options: StartSceneOptions): Promise<SceneCreateResponse | null> {
  // A package origin has no Conversation to pick a cast or persona from; its provider supplies both.
  const preferences = options.plan
    ? null
    : await requestScenePromptPreferences(options.initiatorCharName ?? null, options.chatId);
  if (!options.plan && !preferences) return null;

  const toastId = toast.loading(options.plan ? "Creating scene..." : "Planning scene...", { icon: "🎬" });
  let plan: SceneFullPlan | null = options.plan ? { ...options.plan } : null;
  if (!plan)
    try {
      const planningPrompt = [options.prompt, options.planHint ? `Suggested plot plan:\n${options.planHint}` : ""]
        .map((part) => part.trim())
        .filter(Boolean)
        .join("\n\n");
      const planRes = await api.post<ScenePlanResponse>("/scene/plan", {
        debugMode: useUIStore.getState().debugMode,
        ...(options.packageOrigin ? { packageOrigin: options.packageOrigin } : { chatId: options.chatId }),
        prompt: planningPrompt,
        connectionId: options.connectionId ?? null,
        promptPreferences: preferences,
      });
      plan = planRes.plan;
      if (!plan) {
        toast.error(planRes.error || "Scene planning returned empty result. Try again.", { id: toastId });
        return null;
      }
    } catch (error) {
      // A package origin can refuse for its own reasons (no character to cast, package not active); say which.
      toast.error(
        options.packageOrigin && error instanceof Error && error.message
          ? error.message
          : "Failed to plan scene. Check your API connection.",
        { id: toastId },
      );
      return null;
    }

  if (options.background) {
    plan.background = options.background;
  }

  toast.loading("Creating scene...", { id: toastId, icon: "🎬" });
  try {
    const response = await api.post<SceneCreateResponse>("/scene/create", {
      ...(options.packageOrigin
        ? { packageOrigin: options.packageOrigin, ...(options.packageData ? { packageData: options.packageData } : {}) }
        : { originChatId: options.chatId }),
      initiatorCharId: options.initiatorCharId ?? null,
      plan,
      connectionId: options.connectionId ?? null,
      promptPresetId: preferences?.promptPresetId ?? null,
      presetChoices: preferences?.presetChoices,
      participantCharacterIds: preferences?.participantCharacterIds,
      personaId: preferences?.personaId,
    });

    useChatStore.getState().setActiveChatId(response.chatId);
    if (response.background) {
      useUIStore.getState().setChatBackground(`/api/backgrounds/file/${encodeURIComponent(response.background)}`);
    }
    options.onCreated?.(response);
    toast.success(`Scene created: ${response.chatName}`, { id: toastId, icon: "🎬" });
    return response;
  } catch (error) {
    // A package thread can already be in a scene; say so instead of a generic failure.
    toast.error(
      options.packageOrigin && error instanceof Error && error.message ? error.message : "Failed to create scene chat.",
      { id: toastId },
    );
    return null;
  }
}

/** Leave a scene for where it came from: its Conversation, or its package thread in the Home browser. */
export function returnToSceneOrigin(origin: {
  originChatId?: string | null;
  packageOrigin?: ScenePackageOrigin | null;
}) {
  if (origin.packageOrigin) {
    useUIStore.getState().setSceneOriginFocus(origin.packageOrigin);
    useChatStore.getState().setActiveChatId(null);
  } else if (origin.originChatId) {
    useChatStore.getState().setActiveChatId(origin.originChatId);
  }
}
