import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Check, Minus, Plus, Search, Star } from "lucide-react";
import { LOCAL_SIDECAR_CONNECTION_ID, type Chat, type Lorebook } from "@marinara-engine/shared";
import { chatKeys, useUpdateChat, useUpdateChatMetadata } from "../../hooks/use-chats";
import { useCharacters, usePersonas } from "../../hooks/use-characters";
import { usePresets } from "../../hooks/use-presets";
import { useLorebooks } from "../../hooks/use-lorebooks";
import { useApplyChatPreset, useChatPresets } from "../../hooks/use-chat-presets";
import { useChatCast } from "../../hooks/use-chat-cast";
import {
  getChatActiveAgentIds,
  useAvailableChatAgents,
  useDeletedBuiltInAgentTypes,
} from "../../hooks/use-available-chat-agents";
import { useMatchMedia } from "../../hooks/use-match-media";
import { useConnections } from "../../hooks/use-connections";
import { usePresetChoiceVariables } from "../presets/ChoiceSelectionModal";
import { ChoiceOptionsField } from "../presets/ChoiceOptionsField";
import { ConnectionSwitcherBody, useChatModelPick } from "../connections/ConnectionSwitcherBody";
import { ActiveChatBackgroundPicker } from "../panels/settings/BackgroundPicker";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import { openAddConnection } from "../../lib/add-connection";
import { api } from "../../lib/api-client";
import { readCharacterGreetings } from "../../lib/character-greetings";
import { readCardWithQuestions } from "../../lib/onboarding-add-card";
import { postGreetingWithSwipes } from "../../lib/message-swipes";
import {
  deriveActiveLorebookViews,
  getChatActiveLorebookIds,
  getChatExcludedLorebookIds,
} from "../../lib/chat-lorebooks";
import { requestChatSettingsSectionOpen, type StageSettingsSection } from "../../lib/chat-floating-ui-events";
import { lorebookSwitchWrite, stageGreetingSwap } from "../../lib/chat-setup-stage";
import { cn } from "../../lib/utils";
import { ChatSetupStageCastOrder } from "./ChatSetupStageCastOrder";
import type { CharacterMap, MessageWithSwipes, PersonaInfo } from "./chat-area.types";

export interface StageEditorContext {
  variant: "roleplay" | "conversation";
  chat: Chat;
  chatMeta: Record<string, unknown>;
  chatCharIds: string[];
  characterMap: CharacterMap;
  personaInfo?: PersonaInfo;
  first: MessageWithSwipes | null;
  onSetActiveSwipe: (messageId: string, index: number) => void;
}

/** Every stage editor; all but the opening also live in Chat Settings. */
export type StageEditorSection = StageSettingsSection | "opening";

const TITLES: Record<StageEditorSection, string> = {
  persona: "chat.setupStage.row.persona",
  characters: "chat.setupStage.row.cast",
  opening: "chat.setupStage.row.opening",
  "prompt-preset": "chat.setupStage.row.style",
  connection: "chat.setupStage.row.narrator",
  lorebooks: "chat.setupStage.row.world",
  agents: "chat.setupStage.row.helpers",
  background: "chat.setupStage.row.look",
  profile: "chat.setupStage.row.profile",
};

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";
const NAV = "[data-stage-option], [data-stage-panel] input";
const TABBABLE = 'button:not([disabled]), input:not([disabled]), select, textarea, a[href], [tabindex="0"]';

function parseData(data: unknown): Record<string, unknown> | null {
  if (typeof data !== "string") return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Fast toggles write from the query cache, which mutations update at once, not from the last render.
const latestChat = (qc: QueryClient, chat: Chat) => qc.getQueryData<Chat>(chatKeys.detail(chat.id)) ?? chat;

/** An in-place editor anchored to the word or row that opened it; a bottom sheet on phones. */
function StagePopover({
  anchor,
  section,
  chatId,
  wide,
  onClose,
  children,
}: {
  anchor: HTMLElement;
  section: StageEditorSection;
  chatId: string;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const phone = useMatchMedia("(max-width: 640px)");
  const panelRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const width = wide ? 440 : 360;
  const drawerSection = section === "opening" ? null : section;

  useLayoutEffect(() => {
    if (phone) return;
    const measure = () => {
      const rect = anchor.getBoundingClientRect();
      const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
      const below = window.innerHeight - rect.bottom - 24;
      setPlace(
        below >= 320 || below >= rect.top
          ? { left, top: rect.bottom + 8, maxHeight: below }
          : { left, bottom: window.innerHeight - rect.top + 8, maxHeight: rect.top - 24 },
      );
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [anchor, phone, width]);

  // Focus moves in on open and back to the word that opened it on close.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    // On a phone the panel takes focus, so no input opens the keyboard by itself.
    const target = phone
      ? panel
      : (panel?.querySelector<HTMLElement>('[data-stage-option][aria-checked="true"]') ??
        panel?.querySelector<HTMLElement>(NAV));
    target?.focus({ preventScroll: true });
    return () => anchor.focus({ preventScroll: true });
  }, [anchor, phone]);

  useLayoutEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const node = event.target as Node;
      if (panelRef.current?.contains(node) || anchor.contains(node)) return;
      // Pickers inside (model switcher, background upload) may open their own layers above this one.
      if ((node as Element).closest?.("[data-stage-layer], .mari-modal, [role=dialog]")) return;
      onClose();
    };
    // Inner pickers that use Escape themselves stop it before it gets here.
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [anchor, onClose]);

  const onKeyDown = (event: KeyboardEvent) => {
    // The phone sheet is modal, so Tab wraps inside it.
    if (event.key === "Tab" && phone) {
      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(TABBABLE) ?? []);
      const edge = event.shiftKey ? focusable[0] : focusable[focusable.length - 1];
      if (edge && (document.activeElement === edge || document.activeElement === panelRef.current)) {
        event.preventDefault();
        (event.shiftKey ? focusable[focusable.length - 1] : focusable[0])?.focus();
      }
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(NAV) ?? []);
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    event.preventDefault();
    items[(at + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return createPortal(
    <div data-stage-layer className="fixed inset-0 z-[10000]" style={phone ? undefined : { pointerEvents: "none" }}>
      {phone && <div aria-hidden className="absolute inset-0 bg-black/45" onPointerDown={onClose} />}
      <div
        ref={panelRef}
        data-stage-panel
        role="dialog"
        aria-modal={phone ? true : undefined}
        aria-label={t(TITLES[section])}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          // The desktop popover is not modal, so it closes when focus moves on to the page.
          const next = event.relatedTarget as Element | null;
          if (phone || !next || next === anchor || panelRef.current?.contains(next)) return;
          if (next.closest("[data-stage-layer], .mari-modal, [role=dialog]")) return;
          onClose();
        }}
        className={cn(
          "pointer-events-auto absolute flex flex-col overflow-hidden border outline-none border-[color-mix(in_srgb,var(--foreground)_11%,transparent)] bg-[color-mix(in_srgb,var(--background)_94%,transparent)] text-[var(--foreground)] shadow-[0_20px_50px_rgba(0,0,0,.45)] backdrop-blur-[20px]",
          phone
            ? "inset-x-0 bottom-0 max-h-[80dvh] rounded-t-[18px] pb-[env(safe-area-inset-bottom)]"
            : "rounded-[18px]",
        )}
        style={phone ? undefined : place ? { width, ...place } : { visibility: "hidden" }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">{children}</div>
        {drawerSection && (
          <button
            type="button"
            data-stage-option
            onClick={() => {
              onClose();
              requestChatSettingsSectionOpen(chatId, drawerSection);
            }}
            className={cn(
              "flex min-h-11 shrink-0 items-center border-t border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] px-4 text-left text-[12.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              FOCUS,
            )}
          >
            {t("chat.setupStage.editor.more")}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Option({
  active,
  label,
  hint,
  icon,
  onSelect,
}: {
  active: boolean;
  label: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      data-stage-option
      onClick={onSelect}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-[12px] px-3 py-2 text-left",
        active
          ? "bg-[color-mix(in_srgb,var(--primary)_20%,transparent)]"
          : "hover:bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)]",
        FOCUS,
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px]">{label}</span>
        {hint && (
          <span className="block truncate font-serif text-[12.5px] italic text-[var(--muted-foreground)]">{hint}</span>
        )}
      </span>
      {active && <Check size="1rem" aria-hidden className="shrink-0 text-[var(--primary)]" />}
    </button>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string | null;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <SettingsSwitch
      label={<span className="block truncate text-[14px] text-[var(--foreground)]">{label}</span>}
      description={hint ? <span className="block truncate">{hint}</span> : undefined}
      checked={checked}
      onChange={onChange}
      labelPosition="start"
      className="min-h-11 rounded-[12px] px-3"
      labelClassName="flex-1"
    />
  );
}

const Muted = ({ children }: { children: ReactNode }) => (
  <p className="px-3 py-2 text-[12.5px] text-[var(--muted-foreground)]">{children}</p>
);

function PersonaEditor({ ctx, close }: { ctx: StageEditorContext; close: () => void }) {
  const { t } = useTranslation();
  const { data: personas } = usePersonas();
  const updateChat = useUpdateChat();
  const pick = (personaId: string | null) => {
    updateChat.mutate({ id: ctx.chat.id, personaId });
    close();
  };
  return (
    <>
      <Option active={!ctx.chat.personaId} label={t("chat.setupStage.editor.noPersona")} onSelect={() => pick(null)} />
      {((personas ?? []) as Array<{ id: string; name: string; comment?: string | null }>).map((p) => (
        <Option
          key={p.id}
          active={ctx.chat.personaId === p.id}
          label={p.name}
          hint={p.comment}
          onSelect={() => pick(p.id)}
        />
      ))}
    </>
  );
}

function CastEditor({ ctx }: { ctx: StageEditorContext }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const { data: characterRows } = useCharacters();
  const characters = useMemo(
    () =>
      ((characterRows ?? []) as Array<{ id: string; data: unknown }>).map((row) => {
        const data = parseData(row.data);
        return { id: row.id, data, name: typeof data?.name === "string" ? data.name : row.id };
      }),
    [characterRows],
  );
  const { toggleCharacter } = useChatCast({
    chatId: ctx.chat.id,
    metadata: ctx.chatMeta,
    chatCharIds: ctx.chatCharIds,
    isGame: false,
    onAdded: (_charId, current) => syncGreeting(current),
    onRemoved: (charId) => syncGreeting(ctx.chatCharIds.filter((id) => id !== charId)),
  });
  // A swap (remove A, add B) replaces A's greeting with B's while the stage is open.
  const syncGreeting = (cast: string[]) => {
    if (ctx.variant !== "roleplay") return;
    const { drop, greet } = stageGreetingSwap(ctx.first, cast);
    const data = greet ? characters.find((c) => c.id === greet)?.data : null;
    // ponytail: a card with questions gets no greeting here; Chat Settings asks them. Ask in place if users miss it.
    const [greeting, ...alternates] =
      greet && data && !readCardWithQuestions(data) ? readCharacterGreetings(data).greetings.map((g) => g.text) : [];
    if (!drop && !greeting) return;
    const first = ctx.first;
    void (async () => {
      if (drop && first) await api.delete(`/chats/${ctx.chat.id}/messages/${first.id}?trash=false`);
      if (greet && greeting) await postGreetingWithSwipes(ctx.chat.id, greet, greeting, alternates);
    })()
      .catch(() => undefined)
      .finally(() => qc.invalidateQueries({ queryKey: chatKeys.messages(ctx.chat.id) }));
  };
  const needle = query.trim().toLowerCase();
  const others = characters.filter((c) => !ctx.chatCharIds.includes(c.id) && c.name.toLowerCase().includes(needle));
  const nameOf = (id: string) => ctx.characterMap.get(id)?.name ?? characters.find((c) => c.id === id)?.name ?? id;
  return (
    <>
      <ChatSetupStageCastOrder ctx={ctx} />
      {ctx.chatCharIds.map((id) => (
        <button
          key={id}
          type="button"
          data-stage-option
          aria-label={t("chat.setupStage.editor.remove", { name: nameOf(id) })}
          onClick={() => toggleCharacter(id)}
          className={cn(
            "flex min-h-11 w-full items-center gap-3 rounded-[12px] bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] px-3 text-left text-[14px] hover:bg-[color-mix(in_srgb,var(--primary)_22%,transparent)]",
            FOCUS,
          )}
        >
          <span className="min-w-0 flex-1 truncate">{nameOf(id)}</span>
          <Minus size="1rem" aria-hidden className="text-[var(--muted-foreground)]" />
        </button>
      ))}
      <label className="my-1.5 flex min-h-11 items-center gap-2 rounded-[12px] border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] px-3 focus-within:ring-2 focus-within:ring-[var(--ring)]">
        <Search size="0.95rem" aria-hidden className="text-[var(--muted-foreground)]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("chat.setupStage.editor.searchCharacters")}
          aria-label={t("chat.setupStage.editor.searchCharacters")}
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[var(--muted-foreground)] md:text-[14px]"
        />
      </label>
      {others.slice(0, 60).map((c) => (
        <button
          key={c.id}
          type="button"
          data-stage-option
          aria-label={t("chat.setupStage.editor.add", { name: c.name })}
          onClick={() => toggleCharacter(c.id)}
          className={cn(
            "flex min-h-11 w-full items-center gap-3 rounded-[12px] px-3 text-left text-[14px] hover:bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)]",
            FOCUS,
          )}
        >
          <span className="min-w-0 flex-1 truncate">{c.name}</span>
          <Plus size="1rem" aria-hidden className="text-[var(--primary)]" />
        </button>
      ))}
      {others.length === 0 && <Muted>{t("chat.setupStage.editor.noMatches")}</Muted>}
    </>
  );
}

function OpeningEditor({ ctx, close }: { ctx: StageEditorContext; close: () => void }) {
  const { t } = useTranslation();
  const first = ctx.first;
  const { data } = useQuery({
    queryKey: [...chatKeys.messages(ctx.chat.id), first?.id, "swipes", first?.swipeCount],
    queryFn: () =>
      api.get<Array<{ index: number; content: string }>>(`/chats/${ctx.chat.id}/messages/${first!.id}/swipes`),
    enabled: !!first,
  });
  if (!first) return <Muted>{t("chat.setupStage.row.noGreeting")}</Muted>;
  const swipes = data?.length ? [...data].sort((a, b) => a.index - b.index).map((s) => s.content) : [first.content];
  const active = first.activeSwipeIndex ?? 0;
  return (
    <>
      {swipes.map((content, index) => (
        <Option
          key={index}
          active={index === active}
          label={t("chat.setupStage.editor.greeting", { index: index + 1 })}
          hint={(content ?? "").trim().split("\n")[0].replace(/[*_]/g, "")}
          onSelect={() => {
            if (index !== active) ctx.onSetActiveSwipe(first.id, index);
            close();
          }}
        />
      ))}
    </>
  );
}

function StyleEditor({ ctx }: { ctx: StageEditorContext }) {
  const { t } = useTranslation();
  const { data: presets } = usePresets();
  const updateChat = useUpdateChat();
  const updateMeta = useUpdateChatMetadata();
  const qc = useQueryClient();
  const presetId = ctx.chat.promptPresetId ?? null;
  const existing = (ctx.chatMeta.presetChoices ?? {}) as Record<string, string | string[]>;
  const { variables, baseSelections } = usePresetChoiceVariables(presetId, existing);
  const pick = (id: string | null) => {
    if (id === presetId) return;
    updateChat.mutate({ id: ctx.chat.id, promptPresetId: id });
    // Same as Chat Settings: picking a preset drops a conversation's own prompt.
    if (ctx.variant === "conversation") updateMeta.mutate({ id: ctx.chat.id, customSystemPrompt: null });
  };
  return (
    <>
      <Option active={!presetId} label={t("chat.setupStage.row.defaultPreset")} onSelect={() => pick(null)} />
      {((presets ?? []) as Array<{ id: string; name: string; description?: string | null }>).map((p) => (
        <Option key={p.id} active={p.id === presetId} label={p.name} hint={p.description} onSelect={() => pick(p.id)} />
      ))}
      {variables.length > 0 && (
        <div className="mt-1.5 space-y-3 border-t border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] px-3 pb-2 pt-3">
          {variables.map((v) => (
            <div key={v.id}>
              <p className="mb-1.5 text-[12.5px] text-[var(--muted-foreground)]">{v.question}</p>
              <ChoiceOptionsField
                variable={v}
                selection={baseSelections[v.variableName]}
                optionKey={(option) => option.value}
                ariaLabel={v.question}
                onChange={(next) => {
                  const latest = parseData(latestChat(qc, ctx.chat).metadata)?.presetChoices as typeof existing;
                  updateMeta.mutate({
                    id: ctx.chat.id,
                    presetChoices: { ...baseSelections, ...latest, [v.variableName]: next },
                  });
                }}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function NarratorEditor({ ctx, close }: { ctx: StageEditorContext; close: () => void }) {
  const phone = useMatchMedia("(max-width: 640px)");
  const chatPick = useChatModelPick(ctx.chat.id);
  const { data: connections } = useConnections();
  const updateChat = useUpdateChat();
  const isRandom = ctx.chat.connectionId === "random";
  return (
    <ConnectionSwitcherBody
      current={chatPick.current}
      onApply={chatPick.apply}
      onDone={close}
      onAdd={() => openAddConnection()}
      autoFocusSearch={!phone}
      showLocalModel={((connections ?? []) as Array<{ id: string }>).some((c) => c.id === LOCAL_SIDECAR_CONNECTION_ID)}
      shuffle={{
        active: isRandom,
        onToggle: () => updateChat.mutate({ id: ctx.chat.id, connectionId: isRandom ? null : "random" }),
      }}
      followDefault={{ active: chatPick.followsMain, onSelect: chatPick.useDefault }}
    />
  );
}

function WorldEditor({ ctx }: { ctx: StageEditorContext }) {
  const { t } = useTranslation();
  const { data } = useLorebooks();
  const updateMeta = useUpdateChatMetadata();
  const qc = useQueryClient();
  const chat = ctx.chat;
  const lorebooks = (data ?? []) as Lorebook[];
  const activeIds = getChatActiveLorebookIds(chat);
  const excludedIds = getChatExcludedLorebookIds(chat);
  const views = deriveActiveLorebookViews({
    activeLorebookIds: activeIds,
    excludedLorebookIds: excludedIds,
    chat,
    lorebooks,
  });
  const linkedName = (book: Lorebook) => {
    const id = [book.characterId, ...(book.characterIds ?? [])].find((c) => c && ctx.chatCharIds.includes(c));
    return id ? (ctx.characterMap.get(id)?.name ?? null) : null;
  };
  const rows = lorebooks
    .filter((book) => book.enabled !== false)
    .map((book) => ({ book, view: views.find((v) => v.id === book.id), linked: linkedName(book) }))
    .sort((a, b) => Number(!!b.linked) - Number(!!a.linked) || Number(!!b.view) - Number(!!a.view));
  if (rows.length === 0) return <Muted>{t("chat.setupStage.none")}</Muted>;
  return (
    <>
      {rows.map(({ book, view, linked }) => {
        const on = !!view && !view.isExcluded;
        return (
          <SwitchRow
            key={book.id}
            label={book.name}
            hint={linked ? t("chat.setupStage.editor.linkedTo", { name: linked }) : null}
            checked={on}
            onChange={() => {
              const latest = latestChat(qc, chat);
              updateMeta.mutate({
                id: chat.id,
                ...lorebookSwitchWrite(
                  book.id,
                  view,
                  getChatActiveLorebookIds(latest),
                  getChatExcludedLorebookIds(latest),
                ),
              });
            }}
          />
        );
      })}
    </>
  );
}

function HelpersEditor({ ctx }: { ctx: StageEditorContext }) {
  const { t } = useTranslation();
  const updateMeta = useUpdateChatMetadata();
  const qc = useQueryClient();
  const deleted = useDeletedBuiltInAgentTypes();
  const agents = useAvailableChatAgents(ctx.chat.mode).filter((agent) => !agent.runtimeDisabled);
  const enabled = ctx.chatMeta.enableAgents === true;
  const activeIds = Array.isArray(ctx.chatMeta.activeAgentIds)
    ? (ctx.chatMeta.activeAgentIds as unknown[]).filter((id): id is string => typeof id === "string")
    : [];
  // ponytail: plain list write; Chat Settings also clears a removed agent's stored memory and image settings,
  // which a chat still on its setup stage does not have yet. Route through a shared toggle if that changes.
  const toggle = (id: string, on: boolean) => {
    // Same as Chat Settings: start from the latest list and drop deleted built-in helpers.
    const ids = getChatActiveAgentIds(latestChat(qc, ctx.chat)).filter((x) => x !== id && !deleted.has(x));
    updateMeta.mutate({ id: ctx.chat.id, activeAgentIds: on ? [...ids, id] : ids });
  };
  return (
    <>
      <SwitchRow
        label={t("chat.setupStage.editor.helpersOn")}
        checked={enabled}
        onChange={(next) => updateMeta.mutate({ id: ctx.chat.id, enableAgents: next })}
      />
      {enabled && agents.length === 0 && <Muted>{t("chat.setupStage.editor.noHelpers")}</Muted>}
      {enabled &&
        agents.map((agent) => (
          <SwitchRow
            key={agent.id}
            label={agent.name}
            hint={agent.description}
            checked={activeIds.includes(agent.id)}
            onChange={(next) => toggle(agent.id, next)}
          />
        ))}
    </>
  );
}

function ProfileEditor({ ctx, close }: { ctx: StageEditorContext; close: () => void }) {
  const { data: presets } = useChatPresets(ctx.variant);
  const applyChatPreset = useApplyChatPreset();
  return (
    <>
      {(presets ?? []).map((preset) => (
        <Option
          key={preset.id}
          active={ctx.chatMeta.appliedChatPresetId === preset.id}
          label={preset.name}
          icon={
            <Star
              size="0.95rem"
              aria-hidden
              className={cn("shrink-0", preset.isActive ? "fill-[var(--primary)] text-[var(--primary)]" : "opacity-0")}
            />
          }
          onSelect={() => {
            void applyChatPreset.mutateAsync({ presetId: preset.id, chatId: ctx.chat.id }).catch(() => undefined);
            close();
          }}
        />
      ))}
    </>
  );
}

/** Opens the editor for one stage section in place. */
export function StageEditor({
  section,
  anchor,
  ctx,
  onClose,
}: {
  section: StageEditorSection;
  anchor: HTMLElement;
  ctx: StageEditorContext;
  onClose: () => void;
}) {
  const body =
    section === "persona" ? (
      <PersonaEditor ctx={ctx} close={onClose} />
    ) : section === "characters" ? (
      <CastEditor ctx={ctx} />
    ) : section === "prompt-preset" ? (
      <StyleEditor ctx={ctx} />
    ) : section === "connection" ? (
      <NarratorEditor ctx={ctx} close={onClose} />
    ) : section === "lorebooks" ? (
      <WorldEditor ctx={ctx} />
    ) : section === "agents" ? (
      <HelpersEditor ctx={ctx} />
    ) : section === "background" ? (
      <ActiveChatBackgroundPicker />
    ) : section === "profile" ? (
      <ProfileEditor ctx={ctx} close={onClose} />
    ) : (
      <OpeningEditor ctx={ctx} close={onClose} />
    );
  return (
    <StagePopover
      anchor={anchor}
      section={section}
      chatId={ctx.chat.id}
      wide={section === "connection" || section === "background"}
      onClose={onClose}
    >
      {body}
    </StagePopover>
  );
}
