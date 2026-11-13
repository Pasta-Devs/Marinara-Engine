import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Download, Pencil, Plus, Save, Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  chatFollowsChatPreset,
  type Chat,
  type ChatMode,
  type ChatPreset,
  type ChatPresetSettings,
} from "@marinara-engine/shared";
import { useChats } from "../../../hooks/use-chats";
import {
  useChatPresets,
  useSaveChatPresetSettings,
  useUpdateChatPreset,
  useDeleteChatPreset,
  useApplyChatPreset,
  useApplyChatPresetToFollowers,
  useImportChatPreset,
  useSetActiveChatPreset,
} from "../../../hooks/use-chat-presets";
import { readCurrentWindowLayout } from "../../../hooks/use-chat-window-layout";
import { api } from "../../../lib/api-client";
import { showAlertDialog, showChoiceDialog, showConfirmDialog } from "../../../lib/app-dialogs";
import { parseChatMetadata } from "../../../lib/chat-display";
import { saveIntoProfileSettings } from "../../../lib/chat-preset-apply";
import { cn } from "../../../lib/utils";
import { HelpTooltip } from "../../../components/ui/HelpTooltip";
import { ChatProfileBuilder } from "../../../components/chat/ChatProfileBuilder";

const CHAT_PRESET_UNAPPLIED_SELECT_VALUE = "__chat_preset_unapplied__";

interface SettingsProfilesSectionProps {
  order: number;
  chat: Chat;
  chatMode: ChatMode;
  isRoleplayMode: boolean;
  metadata: Record<string, any>;
  activeLorebookIds: string[];
  profileBuilder: ChatPreset | "new" | null;
  setProfileBuilder: Dispatch<SetStateAction<ChatPreset | "new" | null>>;
}

export function SettingsProfilesSection({
  order,
  chat,
  chatMode,
  isRoleplayMode,
  metadata,
  activeLorebookIds,
  profileBuilder,
  setProfileBuilder,
}: SettingsProfilesSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const { data: allChats } = useChats({ refetchOnMount: false });

  // ── Chat settings profiles (legacy API/type names still use "chat preset") ──
  const presetMode = chatMode;
  const { data: chatPresets } = useChatPresets(presetMode);
  const saveChatPreset = useSaveChatPresetSettings();
  const renameChatPreset = useUpdateChatPreset();
  const deleteChatPreset = useDeleteChatPreset();
  const applyChatPreset = useApplyChatPreset();
  const applyChatPresetToFollowers = useApplyChatPresetToFollowers();
  const importChatPreset = useImportChatPreset();
  const setActiveChatPreset = useSetActiveChatPreset();
  const presetList = useMemo(() => (chatPresets ?? []) as ChatPreset[], [chatPresets]);
  const appliedPresetId = (metadata.appliedChatPresetId as string | undefined) ?? null;
  const appliedChatPreset = useMemo(() => {
    if (!appliedPresetId) return null;
    return presetList.find((p) => p.id === appliedPresetId) ?? null;
  }, [presetList, appliedPresetId]);
  const selectedChatPreset = useMemo(() => {
    if (appliedChatPreset) return appliedChatPreset;
    return presetList.find((p) => p.isDefault) ?? null;
  }, [presetList, appliedChatPreset]);
  const chatPresetSelectValue =
    appliedChatPreset?.id ?? (presetList.length > 0 ? CHAT_PRESET_UNAPPLIED_SELECT_VALUE : "");
  const [renamingPreset, setRenamingPreset] = useState(false);
  const [renamePresetVal, setRenamePresetVal] = useState("");
  const presetFileInputRef = useRef<HTMLInputElement | null>(null);

  const snapshotCurrentPresetSettings = useCallback((): ChatPresetSettings => {
    return {
      connectionId: chat.connectionId ?? null,
      promptPresetId: chat.promptPresetId ?? null,
      // Preset variable choices belong to the chat's preset, so they are saved with its id.
      ...(chat.promptPresetId && {
        presetVariables: { presetId: chat.promptPresetId, choices: metadata.presetChoices ?? {} },
      }),
      // The window layout as shown, even if its save to the chat is still waiting.
      metadata: { ...metadata, windowLayout: readCurrentWindowLayout() },
    };
  }, [chat.connectionId, chat.promptPresetId, metadata]);

  const handleSelectPreset = (id: string) => {
    if (!id || id === CHAT_PRESET_UNAPPLIED_SELECT_VALUE || id === appliedChatPreset?.id) return;
    applyChatPreset.mutate({ presetId: id, chatId: chat.id });
  };

  const handleToggleDefaultPreset = () => {
    if (!selectedChatPreset || selectedChatPreset.isActive) return;
    setActiveChatPreset.mutate(selectedChatPreset.id);
  };

  const handleSaveIntoPreset = async () => {
    if (!selectedChatPreset || selectedChatPreset.isDefault) return;
    const profileId = selectedChatPreset.id;
    const settings = saveIntoProfileSettings(snapshotCurrentPresetSettings(), selectedChatPreset.settings);
    // Count from a fresh list so chats changed in another window are included. One try without
    // retries, so a failing list falls back to the loaded one at once.
    const chatList = await api.get<Chat[]>("/chats").catch(() => allChats ?? []);
    const followerCount = chatList.filter(
      (other) =>
        other.id !== chat.id &&
        other.mode === chat.mode &&
        chatFollowsChatPreset(parseChatMetadata(other.metadata), profileId),
    ).length;
    const choice =
      followerCount > 0
        ? await showChoiceDialog({
            title: localizeUi("chat.settingsProfile.saveChoice.title"),
            message: localizeUi("chat.settingsProfile.saveChoice.message"),
            choices: [
              { key: "profile", label: localizeUi("chat.settingsProfile.saveChoice.profileOnly") },
              {
                key: "chats",
                label: localizeUi("chat.settingsProfile.saveChoice.updateChats", { count: followerCount }),
              },
            ],
            cancelLabel: localizeUi("chat.settingsProfile.saveChoice.cancel"),
          })
        : "profile";
    if (choice !== "profile" && choice !== "chats") return;
    try {
      await saveChatPreset.mutateAsync({ id: profileId, settings });
    } catch {
      toast.error(localizeUi("chat.settingsProfile.saveFailed"));
      return;
    }
    if (choice === "profile") return;
    try {
      const { updated, failed } = await applyChatPresetToFollowers.mutateAsync({
        presetId: profileId,
        exceptChatId: chat.id,
      });
      if (failed > 0) toast.error(localizeUi("chat.settingsProfile.saveChoice.updateFailed", { count: failed }));
      else toast.success(localizeUi("chat.settingsProfile.saveChoice.updated", { count: updated }));
    } catch {
      toast.error(localizeUi("chat.settingsProfile.saveChoice.updateFailed", { count: followerCount }));
    }
  };

  const handleStartRenamePreset = () => {
    if (!selectedChatPreset || selectedChatPreset.isDefault) return;
    setRenamePresetVal(selectedChatPreset.name);
    setRenamingPreset(true);
  };

  const handleCommitRenamePreset = () => {
    if (!selectedChatPreset || selectedChatPreset.isDefault) {
      setRenamingPreset(false);
      return;
    }
    const next = renamePresetVal.trim();
    if (next && next !== selectedChatPreset.name) {
      renameChatPreset.mutate({ id: selectedChatPreset.id, name: next });
    }
    setRenamingPreset(false);
  };

  const newProfileSettings = useMemo(
    (): ChatPresetSettings =>
      profileBuilder === "new"
        ? {
            ...snapshotCurrentPresetSettings(),
            ...(chat.personaId ? { personaId: chat.personaId } : {}),
            ...(activeLorebookIds.length ? { lorebookIds: [...activeLorebookIds] } : {}),
          }
        : {},
    [profileBuilder, snapshotCurrentPresetSettings, chat.personaId, activeLorebookIds],
  );

  const handleDeletePreset = async () => {
    if (!selectedChatPreset || selectedChatPreset.isDefault) return;
    const ok = await showConfirmDialog({
      title: localizeUi("chat.settingsProfile.action.delete"),
      message: localizeUi("dialog.delete.namedPermanent", {
        name: selectedChatPreset.name,
      }),
      confirmLabel: localizeUi("lorebook.editor.batch.delete"),
      tone: "destructive",
    });
    if (!ok) return;
    const wasApplied = selectedChatPreset.id === appliedPresetId;
    const defaultPreset = presetList.find((p) => p.isDefault);
    deleteChatPreset.mutate(selectedChatPreset.id, {
      onSuccess: () => {
        setProfileBuilder((current) =>
          current && current !== "new" && current.id === selectedChatPreset.id ? null : current,
        );
        // If the chat was using the profile we just deleted, fall back to the
        // Default profile's settings: without this, the chat would visually
        // show "Default" but keep the deleted profile's actual values.
        if (wasApplied && defaultPreset) {
          applyChatPreset.mutate({ presetId: defaultPreset.id, chatId: chat.id });
        }
      },
    });
  };

  const handleExportPreset = () => {
    if (!selectedChatPreset) return;
    api.download(
      `/chat-presets/${selectedChatPreset.id}/export`,
      `${selectedChatPreset.name}.marinara-settings-profile.json`,
    );
  };

  const handleImportClick = () => {
    presetFileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    try {
      const text = await file.text();
      const envelope = JSON.parse(text);
      const created = await importChatPreset.mutateAsync(envelope);
      if (created?.id && created.mode === chat.mode) {
        applyChatPreset.mutate({ presetId: created.id, chatId: chat.id });
      }
    } catch (err) {
      await showAlertDialog({
        title: localizeUi("chat.settingsProfile.import.failedTitle"),
        message: localizeUi("chat.settingsProfile.import.failedWithReason", {
          reason: err instanceof Error ? err.message : localizeUi("chat.settingsProfile.import.invalidFile"),
        }),
        tone: "destructive",
      });
    }
  };

  return (
    <div
      data-chat-settings-profiles
      style={{ order }}
      className="flex shrink-0 flex-col gap-2 border-b border-[var(--border)] px-4 py-3"
    >
      <input
        ref={presetFileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFile}
      />
      <ChatProfileBuilder
        open={profileBuilder !== null}
        onClose={() => setProfileBuilder(null)}
        mode={chatMode}
        profile={profileBuilder === "new" ? null : profileBuilder}
        initialSettings={newProfileSettings}
        currentChatId={chat.id}
      />
      {/* Dropdown / rename input + help */}
      <div className="flex items-center gap-2">
        {renamingPreset ? (
          <input
            value={renamePresetVal}
            onChange={(e) => setRenamePresetVal(e.target.value)}
            onBlur={handleCommitRenamePreset}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCommitRenamePreset();
              else if (e.key === "Escape") setRenamingPreset(false);
            }}
            autoFocus
            maxLength={120}
            className="flex-1 min-w-0 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-[var(--primary)]/40"
          />
        ) : (
          <select
            value={chatPresetSelectValue}
            onChange={(e) => handleSelectPreset(e.target.value)}
            aria-label={localizeUi("chat.settingsProfile.label")}
            title={localizeUi("chat.settingsProfile.action.apply")}
            className="mari-preset-native-select flex-1 min-w-0 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
          >
            {presetList.length === 0 && <option value="">{localizeUi("ui.panels.ttsconfigcard.loading")}</option>}
            {!appliedChatPreset && presetList.length > 0 && (
              <option value={CHAT_PRESET_UNAPPLIED_SELECT_VALUE}>
                {appliedPresetId
                  ? localizeUi("chat.settingsProfile.option.missing")
                  : localizeUi("chat.settingsProfile.option.custom")}
              </option>
            )}
            {presetList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.isDefault ? localizeUi("ui.noodle.noodlehome.default") : p.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => setProfileBuilder(selectedChatPreset)}
          disabled={!selectedChatPreset || selectedChatPreset.isDefault}
          title={
            selectedChatPreset?.isDefault
              ? localizeUi("chat.settingsProfile.default.cannotSave")
              : localizeUi("chat.settingsProfile.builder.editHint")
          }
          className="shrink-0 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {localizeUi("chat.settingsProfile.builder.edit")}
        </button>
        <button
          type="button"
          onClick={() => setProfileBuilder("new")}
          title={localizeUi("chat.settingsProfile.builder.newHint")}
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
        >
          <Plus size="0.75rem" aria-hidden />
          {localizeUi("chat.settingsProfile.builder.new")}
        </button>
        <button
          onClick={handleToggleDefaultPreset}
          disabled={!selectedChatPreset || selectedChatPreset.isActive || setActiveChatPreset.isPending}
          title={
            !selectedChatPreset
              ? localizeUi("chat.settingsProfile.default.selectFirst")
              : selectedChatPreset.isActive
                ? localizeUi("chat.settingsProfile.default.current")
                : localizeUi("chat.settingsProfile.default.markForMode")
          }
          aria-pressed={!!selectedChatPreset?.isActive}
          aria-label={
            selectedChatPreset?.isActive
              ? localizeUi("chat.settingsProfile.default.label")
              : localizeUi("chat.settingsProfile.action.markDefault")
          }
          className={cn(
            "shrink-0 flex items-center justify-center rounded-md p-1.5 transition-colors disabled:cursor-not-allowed",
            selectedChatPreset?.isActive
              ? "text-yellow-400 disabled:opacity-100"
              : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-yellow-400 disabled:opacity-40",
          )}
        >
          <Star
            size="0.875rem"
            fill={selectedChatPreset?.isActive ? "currentColor" : "none"}
            strokeWidth={selectedChatPreset?.isActive ? 1.5 : 2}
          />
        </button>
        <HelpTooltip
          side="left"
          text={
            isRoleplayMode
              ? localizeUi("chat.settingsProfile.description.roleplay")
              : localizeUi("chat.settingsProfile.description.conversation")
          }
        />
      </div>
      {/* Single row of all profile actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleSaveIntoPreset}
          disabled={!selectedChatPreset || selectedChatPreset.isDefault}
          title={
            selectedChatPreset?.isDefault
              ? localizeUi("chat.settingsProfile.default.cannotSave")
              : localizeUi("chat.settingsProfile.action.saveInto")
          }
          className="flex-1 flex items-center justify-center rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save size="0.875rem" />
        </button>
        <button
          onClick={handleStartRenamePreset}
          disabled={!selectedChatPreset || selectedChatPreset.isDefault}
          title={
            selectedChatPreset?.isDefault
              ? localizeUi("chat.settingsProfile.default.cannotRename")
              : localizeUi("chat.settingsProfile.action.rename")
          }
          className="flex-1 flex items-center justify-center rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Pencil size="0.875rem" />
        </button>
        <span className="mx-1 h-4 w-px shrink-0 bg-[var(--border)]" aria-hidden />
        <button
          onClick={handleImportClick}
          title={localizeUi("chat.settingsProfile.action.import")}
          className="flex-1 flex items-center justify-center rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
        >
          <Download size="0.875rem" />
        </button>
        <button
          onClick={handleExportPreset}
          disabled={!selectedChatPreset}
          title={localizeUi("chat.settingsProfile.action.export")}
          className="flex-1 flex items-center justify-center rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Upload size="0.875rem" />
        </button>
        <button
          onClick={handleDeletePreset}
          disabled={!selectedChatPreset || selectedChatPreset.isDefault}
          title={
            selectedChatPreset?.isDefault
              ? localizeUi("chat.settingsProfile.default.cannotDelete")
              : localizeUi("chat.settingsProfile.action.delete")
          }
          className="flex-1 flex items-center justify-center rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 size="0.875rem" />
        </button>
      </div>
    </div>
  );
}
