// ──────────────────────────────────────────────
// Settings profile builder: fill a profile's slots by drag or click,
// then pick the chats that should use it.
// ──────────────────────────────────────────────
import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  BookOpen,
  Bot,
  Brain,
  FileText,
  Image as ImageIcon,
  Languages,
  Link,
  Palette,
  SlidersHorizontal,
  VenetianMask,
  Wrench,
} from "lucide-react";
import {
  BUILT_IN_TOOLS,
  TRANSLATOR_SETTINGS_KEYS,
  isAgentConfigDeleted,
  isAgentManifestAvailableInChatMode,
  isRetiredBuiltInAgentId,
  type Chat,
  type ChatMode,
  type ChatPreset,
  type ChatPresetSettings,
} from "@marinara-engine/shared";
import { CharacterSelect } from "../characters/CharacterSelect";
import { LorebookListField, PresetPickerField } from "../ui/LibraryPickers";
import { Modal } from "../ui/Modal";
import { ConnectionSelect } from "../connections/ConnectionSelect";
import { PickerField, PickerListField, PickerTileArt } from "../ui/PickerField";
import { SHEET_BUTTON_PRIMARY } from "../ui/neutral-surface-styles";
import { SurfaceBackButton } from "../ui/SurfaceBackButton";
import { useEditorLeaveSave } from "../../hooks/use-editor-leave-save";
import { leaveWithoutSaving } from "../../lib/editor-leave";
import {
  getActiveChatResourceDrag,
  getActiveChatResourceMouseDrag,
  readChatResourceDragPayload,
  type ChatResourceDragPayload,
} from "../../lib/chat-resource-drag";
import { iconOf } from "../agents/organizer/organizer-model";
import { PROFILE_MODES } from "../presets/profile-detail-id";
import { api } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { chatBackgroundMetadataToUrl, chatBackgroundUrlToMetadata } from "../../lib/backgrounds";
import { parseChatMetadata } from "../../lib/chat-display";
import { useConnections } from "../../hooks/use-connections";
import { usePresets } from "../../hooks/use-presets";
import { usePersonas } from "../../hooks/use-characters";
import { useLorebooks } from "../../hooks/use-lorebooks";
import { useAgentConfigs } from "../../hooks/use-agents";
import { useLibraryFolders } from "../../hooks/use-library-folders";
import { isCustomToolSelectable, useCustomToolCapabilities, useCustomTools } from "../../hooks/use-custom-tools";
import { useCapabilityAgentRegistry, useCapabilityCatalog } from "../../hooks/use-capability-packages";
import { useChats } from "../../hooks/use-chats";
import {
  useApplyChatPreset,
  useCreateChatPreset,
  useSaveChatPresetSettings,
  useSetActiveChatPreset,
  useUpdateChatPreset,
} from "../../hooks/use-chat-presets";
import { useUIStore } from "../../stores/ui.store";
import { Checkbox } from "../ui/Checkbox";

type SlotKey = "conn" | "preset" | "agent" | "tool" | "persona" | "bg" | "lore" | "img" | "params" | "mem" | "lang";
type Item = { id: string; name: string; image?: string | null };
type Meta = Record<string, unknown>;

/** Each slot keeps its library colour from the top bar (.mari-panel-gradient--<type>). */
const SLOT_META: Record<SlotKey, { type: string; icon: typeof Link; multi?: boolean; library?: boolean }> = {
  conn: { type: "connections", icon: Link, library: true },
  preset: { type: "presets", icon: FileText, library: true },
  agent: { type: "agents", icon: Bot, multi: true, library: true },
  tool: { type: "agents", icon: Wrench, multi: true },
  persona: { type: "personas", icon: VenetianMask, library: true },
  bg: { type: "backgrounds", icon: ImageIcon, library: true },
  lore: { type: "lorebooks", icon: BookOpen, multi: true, library: true },
  img: { type: "characters", icon: Palette },
  params: { type: "settings", icon: SlidersHorizontal },
  mem: { type: "settings", icon: Brain },
  lang: { type: "settings", icon: Languages },
};

/** Settings edited in Chat Settings, shown here as a summary the profile already holds. */
const isParamsKey = (key: string) =>
  ["chatParameters", "contextMessageLimit", "excludePastReasoning", "pastReasoningLimit"].includes(key);
const isMemoryKey = (key: string) =>
  /^(enableMemoryRecall|advancedMemory|longTermMemory|summary|semanticSummary|dayRolloverHour)/.test(key);
const isTranslationKey = (key: string) =>
  (TRANSLATOR_SETTINGS_KEYS as readonly string[]).includes(key) ||
  /^(translat|autoTranslate|translateInput|showInputTranslateButton)/.test(key);
const SUMMARY_KEYS: Partial<Record<SlotKey, (key: string) => boolean>> = {
  params: isParamsKey,
  mem: isMemoryKey,
  lang: isTranslationKey,
};

const GROUPS: Array<{ label: string; rows: SlotKey[][] }> = [
  {
    label: "chat.settingsProfile.builder.group.chat",
    rows: [
      ["conn", "preset"],
      ["agent", "tool"],
    ],
  },
  { label: "chat.settingsProfile.builder.group.story", rows: [["persona", "bg"], ["lore"]] },
  { label: "chat.settingsProfile.builder.group.pictures", rows: [["img"]] },
  { label: "chat.settingsProfile.builder.group.behind", rows: [["params"], ["mem", "lang"]] },
];

/** Lets the builder split the dialog into scrolling fields and a fixed footer. */
const CONTENT_CLASS = "flex flex-col overflow-hidden! p-0!";

const readIds = (value: unknown) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
const readId = (value: unknown) => (typeof value === "string" && value ? [value] : []);

/** The ids a slot holds in the profile settings. */
function slotIds(key: SlotKey, settings: ChatPresetSettings): string[] {
  const meta = (settings.metadata ?? {}) as Meta;
  switch (key) {
    case "conn":
      return readId(settings.connectionId);
    case "preset":
      return readId(settings.promptPresetId);
    case "persona":
      return readId(settings.personaId);
    case "lore":
      return readIds(settings.lorebookIds);
    case "bg":
      return readId(meta.background);
    case "agent":
      return readIds(meta.activeAgentIds);
    case "tool":
      return readIds(meta.activeToolIds);
    case "img":
      return readId(meta.imageStyleProfileId);
    default:
      return Object.keys(meta).some(SUMMARY_KEYS[key]!) ? ["saved"] : [];
  }
}

/** A copy of the settings with one slot set to these ids (empty clears it). */
function withSlot(key: SlotKey, settings: ChatPresetSettings, ids: string[]): ChatPresetSettings {
  const next: ChatPresetSettings = { ...settings };
  const meta: Meta = { ...((settings.metadata ?? {}) as Meta) };
  const one = ids[0] ?? undefined;
  const setMeta = (name: string, value: unknown) => {
    if (value === undefined) delete meta[name];
    else meta[name] = value;
  };
  if (key === "conn") next.connectionId = one;
  else if (key === "preset") next.promptPresetId = one;
  else if (key === "persona") next.personaId = one;
  else if (key === "lore") next.lorebookIds = ids.length ? ids : undefined;
  else if (key === "bg") setMeta("background", one);
  else if (key === "agent") setMeta("activeAgentIds", ids.length ? ids : undefined);
  else if (key === "tool") {
    setMeta("activeToolIds", ids.length ? ids : undefined);
    setMeta("enableTools", ids.length ? true : undefined);
  } else if (key === "img") setMeta("imageStyleProfileId", one);
  else if (!ids.length) for (const name of Object.keys(meta)) if (SUMMARY_KEYS[key]!(name)) delete meta[name];
  for (const name of ["connectionId", "promptPresetId", "personaId", "lorebookIds"] as const) {
    if (next[name] === undefined) delete next[name];
  }
  next.metadata = meta as ChatPresetSettings["metadata"];
  return next;
}

interface ChatProfileBuilderProps {
  open: boolean;
  onClose: () => void;
  mode: ChatMode;
  /** The profile to edit; leave out to create a new one. */
  profile?: ChatPreset | null;
  /** Starting slots and name for a new profile (for example, copied from a chat). */
  initialSettings?: ChatPresetSettings;
  initialName?: string;
  /** Chat to tick in step 2. */
  currentChatId?: string;
  /** Save and close without step 2 (the new chat wizard applies the profile itself). */
  saveOnly?: boolean;
  onSaved?: (profile: ChatPreset) => void;
  /**
   * `page` renders the editor as a full-page surface (the Presets panel's Profiles tab) instead of a dialog;
   * step 2 still opens as a dialog on top. A new profile can pick its chat mode there.
   */
  variant?: "modal" | "page";
  /** The page's editor-leave key (`profileDetailId:<id>`), so leaving saves first like the other editors. */
  leaveKey?: string;
}

/** Saves on leave and reports dirty state, like the other center editors. Only mounted by the page variant. */
function PageLeaveGuard({
  leaveKey,
  dirty,
  save,
  busy,
}: {
  leaveKey: string;
  dirty: boolean;
  save: () => Promise<boolean>;
  busy: boolean;
}) {
  const setEditorDirty = useUIStore((s) => s.setEditorDirty);
  useEditorLeaveSave(leaveKey, dirty, save, busy);
  useEffect(() => {
    setEditorDirty(dirty);
  }, [dirty, setEditorDirty]);
  useEffect(() => () => setEditorDirty(false), [setEditorDirty]);
  return null;
}

export function ChatProfileBuilder(props: ChatProfileBuilderProps) {
  if (!props.open) return null;
  return (
    <ChatProfileBuilderBody key={`${props.mode}:${props.currentChatId ?? ""}:${props.profile?.id ?? ""}`} {...props} />
  );
}

function ChatProfileBuilderBody({
  onClose,
  mode: initialMode,
  profile,
  initialSettings,
  initialName,
  currentChatId,
  saveOnly = false,
  onSaved,
  variant = "modal",
  leaveKey,
}: ChatProfileBuilderProps) {
  const { t } = useTranslation();
  const fieldId = useId();
  const canDrag = !window.matchMedia("(pointer: coarse), (max-width: 639px)").matches;
  const imageStyleProfiles = useUIStore((s) => s.imageStyleProfiles.profiles);
  const { data: connections } = useConnections();
  const { data: presets } = usePresets();
  const { data: personas } = usePersonas();
  const { data: lorebooks } = useLorebooks();
  const { data: agentConfigs } = useAgentConfigs();
  const { data: agentManifests } = useCapabilityAgentRegistry();
  const { data: catalog } = useCapabilityCatalog();
  const { data: customTools } = useCustomTools();
  const { data: customToolCapabilities } = useCustomToolCapabilities();
  const { data: backgrounds } = useQuery({
    queryKey: ["backgrounds"],
    queryFn: () => api.get<Array<{ filename: string; url: string }>>("/backgrounds"),
  });
  const { data: chats } = useChats();
  const { data: agentFolders } = useLibraryFolders("agents");
  const createPreset = useCreateChatPreset();
  const saveSettings = useSaveChatPresetSettings();
  const renamePreset = useUpdateChatPreset();
  const setActive = useSetActiveChatPreset();
  const applyPreset = useApplyChatPreset();

  // Only a new profile on the page can change mode; a saved profile's mode is fixed.
  const [mode, setMode] = useState<ChatMode>(initialMode);
  const [name, setName] = useState(profile?.name ?? initialName ?? t("chat.settingsProfile.builder.defaultName"));
  const [settings, setSettings] = useState<ChatPresetSettings>(profile?.settings ?? initialSettings ?? {});
  const snapshot = JSON.stringify([name.trim(), mode, settings]);
  const savedSnapshot = useRef(snapshot);
  const dirty = snapshot !== savedSnapshot.current;
  const [overSlot, setOverSlot] = useState<SlotKey | null>(null);
  const [saved, setSaved] = useState<ChatPreset | null>(null);
  const [makeDefault, setMakeDefault] = useState(profile?.isActive ?? false);
  const [checkedChats, setCheckedChats] = useState<Set<string>>(() => new Set(currentChatId ? [currentChatId] : []));
  const [busy, setBusy] = useState(false);

  const library = useMemo((): Record<SlotKey, Item[]> => {
    const artworkById = new Map((catalog?.packages ?? []).map((entry) => [entry.manifest.id, iconOf(entry) ?? null]));
    const configByType = new Map((agentConfigs ?? []).map((config) => [config.type, config]));
    const agents: Item[] = [];
    for (const manifest of agentManifests ?? []) {
      if (manifest.libraryHidden || !isAgentManifestAvailableInChatMode(mode, manifest)) continue;
      const config = configByType.get(manifest.id);
      if (config && isAgentConfigDeleted(config.settings)) continue;
      agents.push({ id: manifest.id, name: manifest.name, image: config?.imagePath || artworkById.get(manifest.id) });
    }
    const builtInIds = new Set(agents.map((agent) => agent.id));
    for (const config of agentConfigs ?? []) {
      if (builtInIds.has(config.type) || isAgentConfigDeleted(config.settings) || isRetiredBuiltInAgentId(config.type))
        continue;
      if ((agentManifests ?? []).some((manifest) => manifest.id === config.type)) continue;
      agents.push({ id: config.type, name: config.name, image: config.imagePath });
    }
    return {
      conn: ((connections ?? []) as Array<{ id: string; name: string }>).map(({ id, name }) => ({ id, name })),
      preset: mode === "roleplay" ? (presets ?? []).map(({ id, name }) => ({ id, name })) : [],
      agent: agents,
      tool: [
        ...BUILT_IN_TOOLS.filter((tool) => tool.name !== "update_about_me" || mode === "conversation").map((tool) => ({
          id: tool.name,
          name: tool.name,
        })),
        ...(customTools ?? [])
          .filter((tool) => isCustomToolSelectable(tool, customToolCapabilities))
          .map((tool) => ({ id: tool.name, name: tool.name })),
      ],
      persona: (personas ?? []).map((persona) => ({ id: persona.id, name: persona.name, image: persona.avatarPath })),
      bg: (backgrounds ?? []).map((bg) => ({
        id: chatBackgroundUrlToMetadata(bg.url) ?? bg.filename,
        name: bg.filename.replace(/\.[^.]+$/, ""),
        image: chatBackgroundMetadataToUrl(chatBackgroundUrlToMetadata(bg.url), 64),
      })),
      lore: (lorebooks ?? []).map(({ id, name }) => ({ id, name })),
      img: (imageStyleProfiles ?? []).map(({ id, name }) => ({ id, name })),
      params: [],
      mem: [],
      lang: [],
    };
  }, [
    agentConfigs,
    agentManifests,
    backgrounds,
    catalog,
    connections,
    customToolCapabilities,
    customTools,
    imageStyleProfiles,
    lorebooks,
    mode,
    personas,
    presets,
  ]);

  const slots = GROUPS.flatMap((group) => group.rows.flat()).filter((key) => key !== "preset" || mode === "roleplay");
  const filled = slots.filter((key) => slotIds(key, settings).length > 0).length;
  const label = (key: SlotKey) => t(`chat.settingsProfile.builder.slot.${key}`);
  const resourceIds = (key: SlotKey, payload: ChatResourceDragPayload | null) => {
    const kinds: Partial<Record<SlotKey, ChatResourceDragPayload["kind"]>> = {
      conn: "connection",
      preset: "preset",
      agent: "agent",
      persona: "persona",
      bg: "background",
      lore: "lorebook",
    };
    if (!payload || payload.unsupported || kinds[key] !== payload.kind) return [];
    return payload.ids
      .map((id) => (key === "bg" ? (chatBackgroundUrlToMetadata(id) ?? id) : id))
      .filter((id) => library[key].some((item) => item.id === id));
  };

  const dropResource = (key: SlotKey, payload: ChatResourceDragPayload | null) => {
    const dropped = resourceIds(key, payload);
    if (dropped.length)
      setSettings((prev) =>
        withSlot(
          key,
          prev,
          SLOT_META[key].multi ? Array.from(new Set([...slotIds(key, prev), ...dropped])) : dropped.slice(0, 1),
        ),
      );
    setOverSlot(null);
  };

  const trimmedName = name.trim();
  // A new profile is created once; a later save (a save on leave after step 2) updates that one.
  const createdRef = useRef<ChatPreset | null>(null);
  // Back can save while a Save click is still running (or the other way round); both share one request, so a
  // new profile is never created twice.
  const inFlightRef = useRef<Promise<ChatPreset> | null>(null);
  const persist = (): Promise<ChatPreset> =>
    (inFlightRef.current ??= persistNow().finally(() => {
      inFlightRef.current = null;
    }));
  const persistNow = async (): Promise<ChatPreset> => {
    const target = profile ?? createdRef.current;
    let result: ChatPreset;
    if (target) {
      if (trimmedName !== target.name) await renamePreset.mutateAsync({ id: target.id, name: trimmedName });
      result = await saveSettings.mutateAsync({ id: target.id, settings });
    } else {
      // A new profile starts from the open chat's settings, so its masked secrets are that chat's.
      result = await createPreset.mutateAsync({
        name: trimmedName.slice(0, 120),
        mode,
        settings,
        fromChatId: initialSettings ? currentChatId : null,
      });
      createdRef.current = result;
    }
    savedSnapshot.current = snapshot;
    return result;
  };
  const saveOnLeave = async () => {
    if (!trimmedName) {
      // Stay on the page, but say why: a silent refusal looks like a dead Back button.
      toast.error(t("chat.settingsProfile.builder.nameRequired"));
      return false;
    }
    try {
      // Not `onSaved?.(await persist())`: an absent onSaved would skip the save itself.
      const result = await persist();
      onSaved?.(result);
      return true;
    } catch {
      toast.error(t("chat.settingsProfile.saveFailed"));
      return false;
    }
  };
  // On the page, leave without the save-on-leave the back button does: Cancel discards, and Done (step 2)
  // comes after the save, while busy is still set, which the leave guard would refuse.
  const leave = () => (variant === "page" ? leaveWithoutSaving(onClose) : onClose());
  const handleSave = async () => {
    if (!trimmedName || busy) return;
    setBusy(true);
    try {
      const result = await persist();
      onSaved?.(result);
      if (saveOnly) onClose();
      else setSaved(result);
    } catch {
      toast.error(t("chat.settingsProfile.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const modeChats = useMemo(
    () =>
      ((chats ?? []) as Chat[]).filter(
        (chat) => chat.mode === mode && parseChatMetadata(chat.metadata).multiplayer == null,
      ),
    [chats, mode],
  );
  const handleApply = async () => {
    if (!saved || busy) return;
    setBusy(true);
    try {
      if (makeDefault && !saved.isActive) await setActive.mutateAsync(saved.id);
      const ids = [...checkedChats].filter((id) => modeChats.some((chat) => chat.id === id));
      const results = await Promise.allSettled(
        ids.map((chatId) => applyPreset.mutateAsync({ presetId: saved.id, chatId })),
      );
      const failed = results.filter((result) => result.status === "rejected").length;
      if (failed > 0) toast.error(t("chat.settingsProfile.builder.applyFailed", { count: failed }));
      else if (ids.length > 0) toast.success(t("chat.settingsProfile.builder.applied", { count: ids.length }));
      leave();
    } catch {
      // Chat applies are settled above, so only the default switch can throw here.
      toast.error(t("chat.settingsProfile.builder.defaultFailed"));
    } finally {
      setBusy(false);
    }
  };

  // The Agents panel files custom agents by their config id, while a profile stores their type.
  const agentFolderList = useMemo(() => {
    const typeById = new Map((agentConfigs ?? []).map((config) => [config.id, config.type]));
    return (agentFolders ?? []).map((folder) => ({
      ...folder,
      itemIds: folder.itemIds.map((id) => typeById.get(id) ?? id),
    }));
  }, [agentConfigs, agentFolders]);

  const setSlot = (key: SlotKey, ids: string[]) => setSettings((prev) => withSlot(key, prev, ids));
  /** A new profile's slots after a mode switch: the same filters the `library` memo applies to that mode. */
  const keepForMode = (prev: ChatPresetSettings, next: ChatMode): ChatPresetSettings => {
    let out = next === "roleplay" ? prev : withSlot("preset", prev, []);
    const manifests = new Map((agentManifests ?? []).map((manifest) => [manifest.id, manifest]));
    out = withSlot(
      "agent",
      out,
      slotIds("agent", out).filter((id) => {
        const manifest = manifests.get(id);
        return !manifest || isAgentManifestAvailableInChatMode(next, manifest);
      }),
    );
    if (next !== "conversation") {
      out = withSlot(
        "tool",
        out,
        slotIds("tool", out).filter((id) => id !== "update_about_me"),
      );
    }
    return out;
  };
  const toggleInSlot = (key: SlotKey, id: string) =>
    setSettings((prev) => {
      const current = slotIds(key, prev);
      return withSlot(key, prev, current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
    });
  const addToSlot = (key: SlotKey, add: string[]) =>
    setSettings((prev) => withSlot(key, prev, Array.from(new Set([...slotIds(key, prev), ...add]))));

  // A slot's field: the shared picker window (#9077) instead of a native select. Presets, lorebooks
  // and personas use their shared fields; the rest show their picture or their library's gradient tile.
  const renderPicker = (key: SlotKey, ids: string[]) => {
    const meta = SLOT_META[key];
    const ariaLabel = label(key);
    const pickOne = (id: string) => setSlot(key, id ? [id] : []);
    const fieldClass =
      "min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm font-normal text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";
    if (key === "preset")
      return (
        <PresetPickerField
          value={ids[0] ?? ""}
          presets={presets ?? []}
          ariaLabel={ariaLabel}
          noneLabel={t("chat.settingsProfile.builder.none")}
          missingLabel={ids[0]}
          triggerClassName={fieldClass}
          onChange={pickOne}
        />
      );
    if (key === "lore")
      return (
        <LorebookListField
          lorebooks={lorebooks ?? []}
          selectedIds={ids}
          onToggle={(id) => toggleInSlot(key, id)}
          onAdd={(add) => addToSlot(key, add)}
          ariaLabel={ariaLabel}
          keepMissing
          triggerClassName={fieldClass}
        />
      );
    if (key === "persona")
      return (
        <CharacterSelect
          kind="persona"
          allowNone
          withCharacters={false}
          value={ids[0] ? { persona: ids[0] } : null}
          onChange={(next) => pickOne(next && "persona" in next ? next.persona : "")}
          aria-label={ariaLabel}
          title={ariaLabel}
          className={fieldClass}
        />
      );
    if (key === "conn")
      return (
        <ConnectionSelect
          kind="chat"
          value={ids[0] ?? null}
          onChange={(next) => pickOne(next ?? "")}
          defaultLabel={t("chat.settingsProfile.builder.none")}
          aria-label={ariaLabel}
          title={ariaLabel}
          className={fieldClass}
        />
      );
    const items = library[key].map((item) => ({
      id: item.id,
      label: item.name,
      icon: <PickerTileArt src={item.image} type={meta.type} icon={meta.icon} />,
      smallIcon: <PickerTileArt src={item.image} type={meta.type} icon={meta.icon} className="h-6 w-6 rounded-md" />,
    }));
    const texts = {
      searchLabel: t("chat.wizard.select.search"),
      emptyLabel: t("chat.settingsProfile.builder.noItems"),
      noMatchesLabel: t("ui.lorebooks.linkedresourcepicker.noMatches"),
    };
    if (meta.multi)
      return (
        <PickerListField
          items={items}
          folders={key === "agent" ? agentFolderList : undefined}
          selectedIds={ids}
          onToggle={(id) => toggleInSlot(key, id)}
          onAdd={(add) => addToSlot(key, add)}
          title={ariaLabel}
          triggerLabel={t(
            key === "tool" ? "chat.settingsProfile.builder.chooseTools" : "chat.settingsProfile.builder.chooseAgents",
          )}
          triggerIcon={
            key === "tool" ? (
              <Wrench size="0.875rem" aria-hidden="true" className="shrink-0 text-[var(--muted-foreground)]" />
            ) : (
              <Bot size="0.875rem" aria-hidden="true" className="shrink-0 text-[var(--muted-foreground)]" />
            )
          }
          triggerClassName={fieldClass}
          ariaLabel={ariaLabel}
          removeLabel={(name) => t("chat.settingsProfile.builder.remove", { name })}
          keepMissing
          {...texts}
          searchLabel={t(
            key === "tool"
              ? "ui.chatSettings.functioncallingsection.searchFunctions"
              : "ui.agents.agentcatalogview.searchAgents",
          )}
        />
      );
    return (
      <PickerField
        value={ids[0] ?? ""}
        items={items}
        ariaLabel={ariaLabel}
        noneLabel={t("chat.settingsProfile.builder.none")}
        missingLabel={ids[0]}
        triggerClassName={fieldClass}
        onChange={pickOne}
        {...texts}
      />
    );
  };

  const renderSlot = (key: SlotKey) => {
    const meta = SLOT_META[key];
    const Icon = meta.icon;
    const ids = slotIds(key, settings);
    const isFilled = ids.length > 0;
    const summary = !!SUMMARY_KEYS[key];
    const items = library[key];
    return (
      <div
        key={key}
        onDragOver={(event: DragEvent) => {
          if (!resourceIds(key, getActiveChatResourceDrag()).length) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "copy";
          setOverSlot(key);
        }}
        onDragLeave={() => setOverSlot(null)}
        onDrop={(event: DragEvent) => {
          event.preventDefault();
          event.stopPropagation();
          dropResource(key, readChatResourceDragPayload(event.dataTransfer));
        }}
        onMouseMove={() => {
          if (resourceIds(key, getActiveChatResourceMouseDrag()).length) setOverSlot(key);
        }}
        onMouseLeave={() => setOverSlot(null)}
        onMouseUp={(event) => {
          if (event.button !== 0) return;
          const payload = getActiveChatResourceMouseDrag();
          if (!resourceIds(key, payload).length) return;
          event.preventDefault();
          // Let the library's window-level mouseup handler clean up its drag preview.
          dropResource(key, payload);
        }}
        className={cn(
          `mari-panel-gradient--${meta.type}`,
          "flex min-w-0 flex-col gap-2 rounded-xl border-[1.5px] p-3 transition-[border-color,background-color] duration-150",
          isFilled
            ? "border-solid border-[var(--border)] bg-[var(--card)]"
            : "border-dashed border-[color-mix(in_srgb,var(--mari-panel-gradient-start)_40%,var(--border))]",
          overSlot === key &&
            "border-dashed border-[var(--mari-panel-gradient-start)] bg-[color-mix(in_srgb,var(--mari-panel-gradient-start)_16%,var(--card))]",
        )}
      >
        <div className="flex min-w-0 flex-col gap-2">
          <span className="flex items-center gap-2 text-[0.8125rem] font-semibold text-[var(--foreground)]">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--mari-panel-gradient-start)_16%,transparent)] text-[var(--mari-panel-gradient-start)]">
              <Icon size="0.875rem" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-col items-start gap-0.5">
              <span id={`${fieldId}-${key}`}>{label(key)}</span>
              {!isFilled && !summary && meta.library && (
                <span className="text-xs font-normal text-[var(--muted-foreground)]">
                  {t(canDrag ? "chat.settingsProfile.builder.hintDrop" : "chat.settingsProfile.builder.hintPick")}
                </span>
              )}
            </span>
          </span>
          {summary ? (
            <span className="text-xs font-normal text-[var(--muted-foreground)]">
              {t(
                ids.length ? "chat.settingsProfile.builder.savedSettings" : "chat.settingsProfile.builder.summaryHelp",
              )}
            </span>
          ) : (
            renderPicker(key, ids)
          )}
        </div>
        {!summary && items.length === 0 && (
          <span className="text-xs text-[var(--muted-foreground)]">{t("chat.settingsProfile.builder.noItems")}</span>
        )}
        {ids.length > 0 && (summary || meta.multi) && (
          <button
            type="button"
            aria-describedby={`${fieldId}-${key}`}
            onClick={() => setSettings((prev) => withSlot(key, prev, []))}
            className="min-h-11 self-start rounded px-2 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            {t("chat.settingsProfile.builder.clear")}
          </button>
        )}
      </div>
    );
  };

  const bodyClass = "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-5 py-4 text-left";
  const buttonClass =
    "min-h-9 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none disabled:opacity-50";
  const primaryClass =
    "min-h-9 rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none disabled:opacity-50";
  const checkClass = "h-4 w-4 shrink-0 accent-[var(--primary)]";

  const count = [...checkedChats].filter((id) => modeChats.some((chat) => chat.id === id)).length;
  const stepTwo = saved && (
    <Modal
      open
      onClose={leave}
      title={t("chat.settingsProfile.builder.useTitle", { name: saved.name })}
      width="max-w-lg"
      contentClassName={CONTENT_CLASS}
      footer={
        <>
          <button type="button" className={SHEET_BUTTON_PRIMARY} disabled={busy} onClick={handleApply}>
            {count > 0 ? t("chat.settingsProfile.builder.applyTo", { count }) : t("chat.settingsProfile.builder.done")}
          </button>
          <span className="text-center text-xs text-[var(--muted-foreground)]">
            {t("chat.settingsProfile.builder.stepTwoHint")}
          </span>
        </>
      }
    >
      <div className={bodyClass}>
        <label className="flex min-h-11 items-center gap-3 rounded-lg bg-[var(--secondary)] px-3 py-2">
          <Checkbox
            autoFocus
            className={checkClass}
            checked={makeDefault}
            onChange={(event) => setMakeDefault(event.target.checked)}
          />
          <span className="flex flex-col">
            <span className="text-sm text-[var(--foreground)]">
              {t(`chat.settingsProfile.builder.newChats.${mode}`)}
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              {t("chat.settingsProfile.builder.makeDefault")}
            </span>
          </span>
        </label>
        <span className="text-[0.6875rem] font-semibold tracking-wider text-[var(--muted-foreground)] uppercase">
          {t("chat.settingsProfile.builder.existingChats")}
        </span>
        {modeChats.length === 0 ? (
          <span className="text-xs text-[var(--muted-foreground)]">{t("chat.settingsProfile.builder.noChats")}</span>
        ) : (
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {modeChats.map((chat) => (
              <label
                key={chat.id}
                className="flex min-h-10 items-center gap-3 rounded-lg px-3 py-1.5 hover:bg-[var(--accent)]"
              >
                <Checkbox
                  className={checkClass}
                  checked={checkedChats.has(chat.id)}
                  onChange={(event) =>
                    setCheckedChats((prev) => {
                      const next = new Set(prev);
                      if (event.target.checked) next.add(chat.id);
                      else next.delete(chat.id);
                      return next;
                    })
                  }
                />
                <span className="truncate text-sm text-[var(--foreground)]">{chat.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
  if (saved && variant === "modal") return stepTwo;

  const nameInput = (className: string) => (
    <input
      value={name}
      onChange={(event) => setName(event.target.value)}
      maxLength={120}
      aria-label={t("chat.settingsProfile.builder.nameLabel")}
      className={className}
    />
  );
  const modeBadge = (
    <span className="shrink-0 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted-foreground)]">
      {t(`chat.settingsProfile.builder.mode.${mode}`)}
    </span>
  );
  // The pills of the Profiles tab's mode filter (agents/AgentModeFilter.tsx), without All.
  const modePicker = (
    <div className="flex flex-wrap gap-1" role="group" aria-label={t("chat.settingsProfile.builder.modeLabel")}>
      {PROFILE_MODES.map((value) => (
        <button
          key={value}
          type="button"
          className={cn(
            "mari-chrome-control h-8 min-h-8 flex-auto px-3 text-[0.625rem]",
            mode === value && "mari-chrome-control--selected",
          )}
          aria-pressed={mode === value}
          disabled={busy}
          onClick={() => {
            if (value === mode) return;
            // Keep the slots both modes share; drop only what the new mode can't hold.
            setMode(value);
            setSettings((prev) => keepForMode(prev, value));
          }}
        >
          {t(`chat.settingsProfile.builder.mode.${value}`)}
        </button>
      ))}
    </div>
  );
  const fields = GROUPS.map((group) => {
    const rows = group.rows.map((row) => row.filter((key) => slots.includes(key))).filter((row) => row.length > 0);
    return (
      <section key={group.label} className="flex flex-col gap-2">
        <h3 className="pl-0.5 text-[0.6875rem] font-semibold tracking-wider text-[var(--muted-foreground)] uppercase">
          {t(group.label)}
        </h3>
        {rows.map((row) => (
          <div key={row.join()} className={cn("grid gap-2", row.length > 1 && "sm:grid-cols-2")}>
            {row.map(renderSlot)}
          </div>
        ))}
      </section>
    );
  });
  const footer = (
    <div className="flex flex-wrap items-center gap-2 px-5 py-3">
      <span className="min-w-40 flex-1 text-xs text-[var(--muted-foreground)]">
        {t("chat.settingsProfile.builder.filled", { filled, total: slots.length })}
      </span>
      <div className="ml-auto flex gap-2">
        <button type="button" className={buttonClass} onClick={leave}>
          {t("chat.settingsProfile.saveChoice.cancel")}
        </button>
        <button type="button" className={primaryClass} disabled={!trimmedName || busy} onClick={handleSave}>
          {t(saveOnly ? "chat.settingsProfile.builder.save" : "chat.settingsProfile.builder.saveAndChoose")}
        </button>
      </div>
    </div>
  );

  if (variant === "page") {
    // PresetEditor's center shell: back button, icon tile and the name as the title.
    return (
      <div data-settings-profile-editor className="mari-editor-shell flex min-h-0 flex-1 flex-col overflow-hidden">
        {leaveKey && <PageLeaveGuard leaveKey={leaveKey} dirty={dirty} save={saveOnLeave} busy={busy} />}
        <div className="mari-editor-header">
          <div className="mari-editor-header-main">
            <SurfaceBackButton />
            <div className="mari-editor-icon-tile mari-panel-gradient-surface mari-panel-gradient--settings">
              <SlidersHorizontal size="1.125rem" className="max-md:!h-[0.875rem] max-md:!w-[0.875rem]" />
            </div>
            {nameInput("mari-editor-title-input min-w-0 flex-1 placeholder:text-[var(--marinara-editor-muted)]")}
          </div>
        </div>
        <div className={bodyClass}>
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            <div className="flex items-center gap-2">{profile ? modeBadge : modePicker}</div>
            {fields}
          </div>
        </div>
        <div className="border-t border-[var(--border)]">
          <div className="mx-auto w-full max-w-3xl">{footer}</div>
        </div>
        {stepTwo}
      </div>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t(profile ? "chat.settingsProfile.builder.editTitle" : "chat.settingsProfile.builder.newTitle")}
      closeButtonClassName="max-sm:hidden"
      width="max-w-3xl"
      mobileFullscreen
      modeless
      contentClassName={CONTENT_CLASS}
    >
      <div className={cn(bodyClass, "gap-4")}>
        <div className="flex items-center gap-2">
          {nameInput(
            "min-h-9 min-w-0 flex-1 rounded-lg bg-[var(--secondary)] px-3 text-sm font-semibold text-[var(--foreground)] ring-1 ring-transparent outline-none focus:ring-[var(--ring)]",
          )}
          {modeBadge}
        </div>
        {fields}
      </div>
      <div className="flex flex-col border-t border-[var(--border)]">{footer}</div>
    </Modal>
  );
}
