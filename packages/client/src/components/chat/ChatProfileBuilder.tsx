// ──────────────────────────────────────────────
// Settings profile builder: fill a profile's slots by drag or click,
// then pick the chats that should use it.
// ──────────────────────────────────────────────
import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  BookOpen,
  Bot,
  Brain,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Languages,
  Link,
  Palette,
  SlidersHorizontal,
  VenetianMask,
  Wrench,
  X,
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
import { Modal } from "../ui/Modal";
import { AgentArtwork } from "../agents/AgentArtwork";
import { iconOf } from "../agents/organizer/organizer-model";
import { api } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { chatBackgroundMetadataToUrl, chatBackgroundUrlToMetadata } from "../../lib/backgrounds";
import { parseChatMetadata } from "../../lib/chat-display";
import { useConnections } from "../../hooks/use-connections";
import { usePresets } from "../../hooks/use-presets";
import { usePersonas } from "../../hooks/use-characters";
import { useLorebooks } from "../../hooks/use-lorebooks";
import { useAgentConfigs } from "../../hooks/use-agents";
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
}

export function ChatProfileBuilder(props: ChatProfileBuilderProps) {
  if (!props.open) return null;
  return <ChatProfileBuilderBody {...props} />;
}

function ChatProfileBuilderBody({
  onClose,
  mode,
  profile,
  initialSettings,
  initialName,
  currentChatId,
  saveOnly = false,
  onSaved,
}: ChatProfileBuilderProps) {
  const { t } = useTranslation();
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
  const createPreset = useCreateChatPreset();
  const saveSettings = useSaveChatPresetSettings();
  const renamePreset = useUpdateChatPreset();
  const setActive = useSetActiveChatPreset();
  const applyPreset = useApplyChatPreset();

  const [name, setName] = useState(profile?.name ?? initialName ?? t("chat.settingsProfile.builder.defaultName"));
  const [settings, setSettings] = useState<ChatPresetSettings>(profile?.settings ?? initialSettings ?? {});
  const [openSlot, setOpenSlot] = useState<SlotKey | null>(null);
  const [dragKind, setDragKind] = useState<SlotKey | null>(null);
  // Touch screens and phone widths (no library tray) cannot drag, so they only get the pick hint.
  const canDrag = !window.matchMedia("(pointer: coarse), (max-width: 639px)").matches;
  const [overSlot, setOverSlot] = useState<SlotKey | null>(null);
  const [query, setQuery] = useState("");
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
  const findItem = (key: SlotKey, id: string): Item => library[key].find((item) => item.id === id) ?? { id, name: id };

  const put = (key: SlotKey, id: string) => {
    setSettings((prev) => {
      const current = slotIds(key, prev);
      if (!SLOT_META[key].multi) return withSlot(key, prev, current[0] === id ? [] : [id]);
      return withSlot(key, prev, current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
    });
  };
  const remove = (key: SlotKey, id: string) =>
    setSettings((prev) => withSlot(key, prev, SUMMARY_KEYS[key] ? [] : slotIds(key, prev).filter((x) => x !== id)));

  const trimmedName = name.trim();
  const handleSave = async () => {
    if (!trimmedName || busy) return;
    setBusy(true);
    try {
      let result: ChatPreset;
      if (profile) {
        if (trimmedName !== profile.name) await renamePreset.mutateAsync({ id: profile.id, name: trimmedName });
        result = await saveSettings.mutateAsync({ id: profile.id, settings });
      } else {
        result = await createPreset.mutateAsync({ name: trimmedName.slice(0, 120), mode, settings });
      }
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
      onClose();
    } catch {
      // Chat applies are settled above, so only the default switch can throw here.
      toast.error(t("chat.settingsProfile.builder.defaultFailed"));
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (key: SlotKey) => (event: DragEvent) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    if (dragKind === key && id && !slotIds(key, settings).includes(id)) put(key, id);
    setDragKind(null);
    setOverSlot(null);
  };

  const renderChipLogo = (key: SlotKey, item: Item) => {
    if (key === "agent") {
      return (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[color-mix(in_srgb,var(--foreground)_12%,var(--card))] shadow-[0_1px_3px_rgb(0_0_0/0.3),inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_10%,transparent)] [&>img]:h-[68%]! [&>img]:w-[68%]! [&>img]:object-contain!">
          <AgentArtwork imageUrl={item.image ?? undefined} alt="" iconSize="0.75rem" />
        </span>
      );
    }
    if (item.image) return <img src={item.image} alt="" className="h-5 w-5 shrink-0 rounded-md object-cover" />;
    return <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--mari-panel-gradient-start)]" aria-hidden />;
  };

  const renderSlot = (key: SlotKey) => {
    const meta = SLOT_META[key];
    const Icon = meta.icon;
    const ids = slotIds(key, settings);
    const isFilled = ids.length > 0;
    const isOpen = openSlot === key;
    const canDrop = dragKind === key;
    const summary = !!SUMMARY_KEYS[key];
    const items = library[key];
    return (
      <div
        key={key}
        onDragOver={(event) => {
          if (!canDrop) return;
          event.preventDefault();
          setOverSlot(key);
        }}
        onDragLeave={() => setOverSlot((prev) => (prev === key ? null : prev))}
        onDrop={onDrop(key)}
        className={cn(
          `mari-panel-gradient--${meta.type}`,
          "flex min-w-0 flex-col rounded-xl border-[1.5px] transition-[opacity,border-color,background-color] duration-150",
          isFilled
            ? "border-solid border-[var(--border)] bg-[var(--card)]"
            : "border-dashed border-[color-mix(in_srgb,var(--mari-panel-gradient-start)_40%,var(--border))]",
          canDrop &&
            "border-dashed border-[var(--mari-panel-gradient-start)] bg-[color-mix(in_srgb,var(--mari-panel-gradient-start)_8%,var(--card))]",
          overSlot === key && "bg-[color-mix(in_srgb,var(--mari-panel-gradient-start)_16%,var(--card))]",
          dragKind && !canDrop && "opacity-30",
        )}
      >
        <div className="flex min-h-[3.25rem] items-center gap-3 px-3 py-2">
          <button
            type="button"
            aria-expanded={isOpen}
            onClick={() => setOpenSlot(isOpen ? null : key)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--mari-panel-gradient-start)_16%,transparent)] text-[var(--mari-panel-gradient-start)]">
              <Icon size="0.875rem" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
              <span className="text-[0.8125rem] font-semibold text-[var(--foreground)]">{label(key)}</span>
              {!isFilled && (
                <span className="text-xs text-[var(--muted-foreground)]">
                  {summary || !meta.library || !canDrag
                    ? t(summary ? "chat.settingsProfile.builder.hintSummary" : "chat.settingsProfile.builder.hintPick")
                    : t("chat.settingsProfile.builder.hintDrop")}
                </span>
              )}
            </span>
            <ChevronDown
              size="0.875rem"
              aria-hidden
              className={cn("shrink-0 text-[var(--muted-foreground)] transition-transform", isOpen && "rotate-180")}
            />
          </button>
        </div>
        {isFilled && (
          <div className="flex flex-wrap gap-1 px-3 pb-2.5 pl-[3.25rem]">
            {ids.map((id) => {
              const item = summary ? { id, name: t("chat.settingsProfile.builder.savedSettings") } : findItem(key, id);
              return (
                <span
                  key={id}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[color-mix(in_srgb,var(--mari-panel-gradient-start)_35%,transparent)] bg-[var(--secondary)] py-0.5 pr-0.5 pl-1 text-xs text-[var(--foreground)]"
                >
                  {!summary && renderChipLogo(key, item)}
                  <span className="truncate">{item.name}</span>
                  <button
                    type="button"
                    onClick={() => remove(key, id)}
                    aria-label={t("chat.settingsProfile.builder.remove", { name: item.name })}
                    className="grid h-5 w-5 shrink-0 place-items-center rounded text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
                  >
                    <X size="0.75rem" aria-hidden />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        {isOpen && (
          <div className="flex max-h-44 flex-wrap gap-1 overflow-y-auto border-t border-[var(--border)] px-3 py-2">
            {summary || items.length === 0 ? (
              <span className="text-xs text-[var(--muted-foreground)]">
                {t(summary ? "chat.settingsProfile.builder.summaryHelp" : "chat.settingsProfile.builder.noItems")}
              </span>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={ids.includes(item.id)}
                  onClick={() => put(key, item.id)}
                  className={cn(
                    "inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-left text-xs transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none",
                    ids.includes(item.id)
                      ? "border-[var(--mari-panel-gradient-start)] bg-[color-mix(in_srgb,var(--mari-panel-gradient-start)_14%,var(--secondary))] text-[var(--foreground)]"
                      : "border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  )}
                >
                  {renderChipLogo(key, item)}
                  <span className="truncate">{item.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  const needle = query.trim().toLowerCase();
  const trayItems = (Object.keys(SLOT_META) as SlotKey[])
    .filter((key) => SLOT_META[key].library && slots.includes(key))
    .flatMap((key) =>
      library[key]
        .filter(
          (item) => !needle || item.name.toLowerCase().includes(needle) || label(key).toLowerCase().includes(needle),
        )
        .map((item) => ({ key, item })),
    );

  // The fields scroll on their own; the library and the buttons stay below them.
  const bodyClass = "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-5 py-4 text-left";
  const footer = (children: ReactNode) => (
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-5 py-3">{children}</div>
  );
  const buttonClass =
    "min-h-9 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none disabled:opacity-50";
  const primaryClass =
    "min-h-9 rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none disabled:opacity-50";
  const checkClass = "h-4 w-4 shrink-0 accent-[var(--primary)]";

  if (saved) {
    const count = [...checkedChats].filter((id) => modeChats.some((chat) => chat.id === id)).length;
    return (
      <Modal
        open
        onClose={onClose}
        title={t("chat.settingsProfile.builder.useTitle", { name: saved.name })}
        width="max-w-lg"
        contentClassName={CONTENT_CLASS}
      >
        <div className={bodyClass}>
          <label className="flex min-h-11 items-center gap-3 rounded-lg bg-[var(--secondary)] px-3 py-2">
            <input
              type="checkbox"
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
                  <input
                    type="checkbox"
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
        {footer(
          <>
            <span className="min-w-40 flex-1 text-xs text-[var(--muted-foreground)]">
              {t("chat.settingsProfile.builder.stepTwoHint")}
            </span>
            <button type="button" className={primaryClass} disabled={busy} onClick={handleApply}>
              {count > 0
                ? t("chat.settingsProfile.builder.applyTo", { count })
                : t("chat.settingsProfile.builder.done")}
            </button>
          </>,
        )}
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t(profile ? "chat.settingsProfile.builder.editTitle" : "chat.settingsProfile.builder.newTitle")}
      width="max-w-3xl"
      mobileFullscreen
      contentClassName={CONTENT_CLASS}
    >
      <div className={cn(bodyClass, "gap-4")}>
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            aria-label={t("chat.settingsProfile.builder.nameLabel")}
            className="min-h-9 min-w-0 flex-1 rounded-lg bg-[var(--secondary)] px-3 text-sm font-semibold text-[var(--foreground)] ring-1 ring-transparent outline-none focus:ring-[var(--ring)]"
          />
          <span className="shrink-0 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted-foreground)]">
            {t(`chat.settingsProfile.builder.mode.${mode}`)}
          </span>
        </div>
        {GROUPS.map((group) => {
          const rows = group.rows
            .map((row) => row.filter((key) => slots.includes(key)))
            .filter((row) => row.length > 0);
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
        })}
      </div>
      <div className="flex flex-col border-t border-[var(--border)]">
        <div className="grid gap-x-3 gap-y-2 px-5 pt-3 max-sm:hidden sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          <div className="flex flex-col">
            <span className="text-[0.8125rem] font-semibold text-[var(--foreground)]">
              {t("chat.settingsProfile.builder.library")}
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              {t("chat.settingsProfile.builder.libraryHint")}
            </span>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("chat.settingsProfile.builder.search")}
            aria-label={t("chat.settingsProfile.builder.search")}
            className="min-h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--ring)]"
          />
          <div className="col-span-full flex gap-1 overflow-x-auto pb-1">
            {trayItems.map(({ key, item }) => (
              <button
                key={`${key}:${item.id}`}
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", item.id);
                  event.dataTransfer.effectAllowed = "copy";
                  setDragKind(key);
                }}
                onDragEnd={() => {
                  setDragKind(null);
                  setOverSlot(null);
                }}
                onClick={() => put(key, item.id)}
                title={label(key)}
                aria-pressed={slotIds(key, settings).includes(item.id)}
                className={cn(
                  `mari-panel-gradient--${SLOT_META[key].type}`,
                  "inline-flex shrink-0 cursor-grab items-center gap-1.5 rounded-md border border-transparent bg-[var(--secondary)] px-2 py-1 text-xs text-[var(--foreground)] hover:border-[color-mix(in_srgb,var(--mari-panel-gradient-start)_45%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none aria-pressed:border-[var(--mari-panel-gradient-start)]",
                )}
              >
                {renderChipLogo(key, item)}
                <span className="max-w-40 truncate">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <span className="min-w-40 flex-1 text-xs text-[var(--muted-foreground)]">
            {t("chat.settingsProfile.builder.filled", { filled, total: slots.length })}
          </span>
          <div className="ml-auto flex gap-2">
            <button type="button" className={buttonClass} onClick={onClose}>
              {t("chat.settingsProfile.saveChoice.cancel")}
            </button>
            <button type="button" className={primaryClass} disabled={!trimmedName || busy} onClick={handleSave}>
              {t(saveOnly ? "chat.settingsProfile.builder.save" : "chat.settingsProfile.builder.saveAndChoose")}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
