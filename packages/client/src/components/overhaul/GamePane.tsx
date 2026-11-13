// ──────────────────────────────────────────────
// UI overhaul: Game Mode right pane (mockup "Game B")
//
// One pane on the right of the game with tabs for Party, Inventory, Journal,
// Map and Sessions. It replaces the floating bubbles over the scene; the rare
// tools (volume, assets, game data, checkpoints, retries, ending the session)
// moved into Chat settings > Game.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { avatarInitial } from "../../lib/avatar-initial";
import { BookOpen, Backpack, History, Map as MapIcon, Users, X } from "lucide-react";
import type { AvatarCrop, GameInventoryStack } from "@marinara-engine/shared";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { useOverhaulStore, type OverhaulGamePaneTab } from "../../stores/overhaul.store";
import { useUIStore } from "../../stores/ui.store";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useGameModeStore } from "../../stores/game-mode.store";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";

/** The narrowest the game scene (narration, composer) may get beside the game pane before the pane floats. */
const GAME_SCENE_MIN_WIDTH = 520;
/** The pane's width (23.5rem in overhaul.css), for measuring while it is folded away. */
const GAME_PANE_REM = 23.5;
/** About how wide the chat list is, to tell whether it fits back in. */
const CHAT_LIST_REM = 20;

export interface OvGamePaneMember {
  id: string;
  name: string;
  avatarUrl?: string | null;
  avatarCrop?: AvatarCrop | null;
}

export interface OvGamePaneCard {
  title: string;
  subtitle?: string;
  mood?: string;
  status?: string;
  level?: number;
  stats?: Array<{ name: string; value: number; max?: number; color?: string }>;
  inventory?: Array<{ name: string; quantity?: number; location?: string }>;
  customFields?: Record<string, string>;
}

const TABS: Array<{ id: OverhaulGamePaneTab; label: string; icon: typeof Users }> = [
  { id: "party", label: "Party", icon: Users },
  { id: "inventory", label: "Inventory", icon: Backpack },
  { id: "journal", label: "Journal", icon: BookOpen },
  { id: "map", label: "Map", icon: MapIcon },
  { id: "sessions", label: "Sessions", icon: History },
];

const HP = /^(hp|health|hit points?|vitality)$/i;
const MP = /^(mp|mana|magic|energy|stamina|sp)$/i;

function findStat(card: OvGamePaneCard | undefined, pattern: RegExp) {
  return card?.stats?.find((stat) => pattern.test(stat.name.trim()));
}

function Meter({ stat }: { stat?: { value: number; max?: number; color?: string } }) {
  const { t: localizeUi } = useUiTranslation();
  if (!stat) return <span className="ov-gpane__na">—</span>;
  const pct = stat.max ? Math.max(0, Math.min(100, (stat.value / stat.max) * 100)) : 100;
  return (
    <span className="ov-gpane__meter">
      <span>
        {stat.max
          ? localizeUi("ui.chat.roleplaysetupwizard.value1Value2", { value1: stat.value, value2: stat.max })
          : stat.value}
      </span>
      <i>
        <b style={{ width: `${pct}%`, background: stat.color || undefined }} />
      </i>
    </span>
  );
}

function Avatar({ member }: { member: OvGamePaneMember }) {
  return member.avatarUrl ? (
    <span className="ov-gpane__av">
      <img src={member.avatarUrl} alt="" style={getAvatarCropStyle(member.avatarCrop)} />
    </span>
  ) : (
    <span className="ov-gpane__av" data-mari-part="avatar-placeholder" data-role="assistant">
      {avatarInitial(member.name)}
    </span>
  );
}

function PartyTab({
  members,
  cards,
  inventory,
  onEditSheet,
}: {
  members: OvGamePaneMember[];
  cards: Record<string, OvGamePaneCard>;
  inventory: GameInventoryStack[];
  onEditSheet?: (memberId: string) => (() => void) | undefined;
}) {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const [picked, setPicked] = useState<string | null>(null);
  const selected = members.find((member) => member.id === picked) ?? members[0];
  if (!members.length) return <p className="ov-gpane__empty">{localizeUi("ui.overhaul.partytab.noPartyMembersYet")}</p>;
  const card = selected ? cards[selected.id] : undefined;
  const carried = selected
    ? inventory.filter((stack) => (stack.holder ?? "").toLowerCase() === selected.name.toLowerCase())
    : [];
  const otherStats = (card?.stats ?? []).filter((stat) => !HP.test(stat.name.trim()) && !MP.test(stat.name.trim()));
  const editSheet = selected ? onEditSheet?.(selected.id) : undefined;
  return (
    <>
      <table className="ov-gpane__table">
        <thead>
          <tr>
            <th>{localizeUi("ui.overhaul.partytab.member")}</th>
            <th>{localizeUi("ui.chat.targetselection.hp")}</th>
            <th>{localizeUi("ui.game.gamecombatui.mp")}</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const memberCard = cards[member.id];
            return (
              <tr
                key={member.id}
                className={cn(member.id === selected?.id && "is-on")}
                onClick={() => setPicked(member.id)}
              >
                <td>
                  <span className="ov-gpane__who">
                    <Avatar member={member} />
                    <span>
                      {member.name}
                      {memberCard?.subtitle || memberCard?.level ? (
                        <small>
                          {[memberCard.subtitle, memberCard.level ? `Lv ${memberCard.level}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      ) : null}
                    </span>
                  </span>
                </td>
                <td>
                  <Meter stat={findStat(memberCard, HP)} />
                </td>
                <td>
                  <Meter stat={findStat(memberCard, MP)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {selected ? (
        <div className="ov-gpane__detail">
          <div className="ov-gpane__detail-head">
            <p className="ov-gpane__label">{selected.name}</p>
            {/* The full character sheet (MRPG classes, skills and gear live there); the party bar that
                opened it is hidden in this layout. */}
            {card ? (
              <button
                type="button"
                className="ov-gpane__link"
                onClick={() => useGameModeStore.getState().openCharacterSheet(selected.id)}
              >
                {localize("Open sheet")} ›
              </button>
            ) : null}
            {editSheet ? (
              <button type="button" className="ov-gpane__link" onClick={editSheet}>
                {localizeUi("ui.overhaul.partytab.editSheet")} ›
              </button>
            ) : null}
          </div>
          {!card?.stats?.length ? <p className="ov-gpane__none">{localizeUi("ui.overhaul.partytab.noStats")}</p> : null}
          {otherStats.length ? (
            <div className="ov-gpane__stats">
              {otherStats.map((stat) => (
                <span key={stat.name}>
                  <small>{stat.name}</small>
                  <b>
                    {stat.max
                      ? localizeUi("ui.chat.roleplaysetupwizard.value1Value2", { value1: stat.value, value2: stat.max })
                      : stat.value}
                  </b>
                </span>
              ))}
            </div>
          ) : null}
          {card?.status || card?.mood ? (
            <>
              <p className="ov-gpane__label">{localizeUi("game.ruleset.sheet.conditions")}</p>
              <div className="ov-gpane__chips">
                {[card.status, card.mood].filter(Boolean).map((value) => (
                  <span key={value}>{value}</span>
                ))}
              </div>
            </>
          ) : null}
          {card?.customFields && Object.keys(card.customFields).length ? (
            <dl className="ov-gpane__fields">
              {Object.entries(card.customFields).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {carried.length || card?.inventory?.length ? (
            <>
              <p className="ov-gpane__label">{localizeUi("ui.overhaul.partytab.carrying")}</p>
              <ul className="ov-gpane__list">
                {(carried.length
                  ? carried.map((stack) => ({
                      key: stack.id,
                      name: stack.nickname || stack.name,
                      quantity: stack.quantity,
                      note: stack.equipped ? "Equipped" : "",
                    }))
                  : (card?.inventory ?? []).map((item, index) => ({
                      key: `${item.name}-${index}`,
                      name: item.name,
                      quantity: item.quantity ?? 1,
                      note: item.location ?? "",
                    }))
                ).map((item) => (
                  <li key={item.key}>
                    <span>{item.name}</span>
                    {item.quantity > 1 ? <small>×{item.quantity}</small> : null}
                    {item.note ? <em>{item.note}</em> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function InventoryTab({
  inventory,
  playerName,
  onOpenInventory,
}: {
  inventory: GameInventoryStack[];
  playerName: string;
  onOpenInventory?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const groups = useMemo(() => {
    const byHolder = new Map<string, GameInventoryStack[]>();
    for (const stack of inventory) {
      const holder = stack.holder || playerName;
      byHolder.set(holder, [...(byHolder.get(holder) ?? []), stack]);
    }
    return [...byHolder.entries()];
  }, [inventory, playerName]);
  return (
    <>
      <div className="ov-gpane__bar">
        <span>
          {inventory.length}{" "}
          {inventory.length === 1
            ? localizeUi("ui.overhaul.inventorytab.stack")
            : localizeUi("ui.overhaul.inventorytab.stacks")}
        </span>
        {onOpenInventory ? (
          <button type="button" className="ov-edbtn" onClick={onOpenInventory}>
            {localizeUi("ui.overhaul.inventorytab.openInventory")}
          </button>
        ) : null}
      </div>
      {groups.length ? (
        groups.map(([holder, stacks]) => (
          <div key={holder}>
            <p className="ov-gpane__label">{holder}</p>
            <ul className="ov-gpane__list">
              {stacks.map((stack) => (
                <li key={stack.id}>
                  <span>{stack.nickname || stack.name}</span>
                  {stack.quantity > 1 ? <small>×{stack.quantity}</small> : null}
                  {stack.equipped ? <em>{localizeUi("ui.game.gameinventory.equipped")}</em> : null}
                </li>
              ))}
            </ul>
          </div>
        ))
      ) : (
        <p className="ov-gpane__empty">{localizeUi("ui.overhaul.inventorytab.theInventoryIsEmpty")}</p>
      )}
    </>
  );
}

export function OvGamePane({
  members,
  cards,
  inventory,
  playerName,
  onOpenInventory,
  onEditSheet,
  heading,
  journal,
  map,
  sessions,
}: {
  members: OvGamePaneMember[];
  cards: Record<string, OvGamePaneCard>;
  inventory: GameInventoryStack[];
  playerName: string;
  onOpenInventory?: () => void;
  /** Opens a member's Game Mode sheet; returns nothing for members without one (NPCs). */
  onEditSheet?: (memberId: string) => (() => void) | undefined;
  /** Day, place and session, shown over the tabs. */
  heading: ReactNode;
  journal: ReactNode;
  map: ReactNode;
  sessions: ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const open = useOverhaulStore((state) => state.gamePaneOpen);
  const tab = useOverhaulStore((state) => state.gamePaneTab);
  const setTab = useOverhaulStore((state) => state.setGamePaneTab);
  const setOpen = useOverhaulStore((state) => state.setGamePaneOpen);
  // When the Library or the chat list (or a narrow window) leaves the scene under GAME_SCENE_MIN_WIDTH beside
  // the pane, the pane folds away to its top-bar button and comes back by itself once there is room again
  // (user panel 3, PG1: floating over the scene, it cut the narration off mid-sentence). Opened again while
  // there is no room, it floats over the scene with a clear edge, the narration keeps to the uncovered part,
  // and a click in the scene folds it away again.
  const forced = useOverhaulStore((state) => state.gamePaneForced);
  const setForced = useOverhaulStore((state) => state.setGamePaneForced);
  const setMadeRoom = useOverhaulStore((state) => state.setGamePaneMadeRoom);
  const paneRef = useRef<HTMLElement | null>(null);
  const probeRef = useRef<HTMLSpanElement | null>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const host = (paneRef.current ?? probeRef.current)?.parentElement;
    if (!open || !host) return;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const measure = () => {
      const paneWidth = paneRef.current?.offsetWidth || GAME_PANE_REM * rem;
      const room = host.clientWidth - paneWidth;
      // A little slack before it comes back, so dragging the window edge doesn't flicker it.
      setNarrow((was) => (was ? room < GAME_SCENE_MIN_WIDTH + 32 : room < GAME_SCENE_MIN_WIDTH));
      // Opened with room to spare: the "float it" request from the top-bar button isn't needed, and
      // must not make it float later when the Library opens (it folds then, as before).
      if (room >= GAME_SCENE_MIN_WIDTH && useOverhaulStore.getState().gamePaneForced) setForced(false);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [open, forced, setForced]);
  useEffect(() => {
    if (!narrow) setForced(false);
  }, [narrow, setForced]);
  // Opened again while there is no room: fold the chat list away first, so the pane can sit beside the scene.
  // The chat list comes back by itself once there is room for all three again (the Library closed).
  const hidListRef = useRef(false);
  const listWidthRef = useRef(0);
  useEffect(() => {
    if (!forced || !narrow) return;
    const ui = useUIStore.getState();
    if (ui.sidebarOpen) {
      // The chat list sits left of the game, so how far the game starts from the left is the list's width.
      listWidthRef.current = (paneRef.current ?? probeRef.current)?.parentElement?.getBoundingClientRect().left ?? 0;
      hidListRef.current = true;
      ui.setSidebarOpen(false);
    }
  }, [forced, narrow]);
  useEffect(() => {
    const host = (paneRef.current ?? probeRef.current)?.parentElement;
    if (!open || !host) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const check = () => {
      if (!hidListRef.current) return;
      const ui = useUIStore.getState();
      if (ui.sidebarOpen) {
        hidListRef.current = false;
        return;
      }
      const paneWidth = paneRef.current?.offsetWidth || GAME_PANE_REM * rem;
      const listWidth = listWidthRef.current || CHAT_LIST_REM * rem;
      if (host.clientWidth - paneWidth - listWidth >= GAME_SCENE_MIN_WIDTH + 16) {
        hidListRef.current = false;
        ui.setSidebarOpen(true);
      }
    };
    const observer = new ResizeObserver(check);
    observer.observe(host);
    return () => observer.disconnect();
  }, [open]);
  const madeRoom = open && narrow && !forced;
  const overlay = open && narrow && forced;
  useEffect(() => {
    setMadeRoom(madeRoom);
  }, [madeRoom, setMadeRoom]);
  useEffect(() => () => setMadeRoom(false), [setMadeRoom]);
  // Floating: the narration keeps to the part of the scene the pane doesn't cover, and a click there folds it.
  useEffect(() => {
    const pane = paneRef.current;
    const host = pane?.parentElement;
    if (!overlay || !pane || !host) return;
    host.classList.add("is-pane-over");
    host.style.setProperty("--ov-gpane-cover", `${pane.offsetWidth}px`);
    const onPointerDown = (event: PointerEvent) => {
      if (pane.contains(event.target as Node)) return;
      if (!host.contains(event.target as Node)) return;
      // Typing your action (or using the composer's buttons) keeps the pane up to look at while you write.
      if ((event.target as Element).closest?.("textarea, input, [data-chat-composer], [data-mari-part='composer']"))
        return;
      setForced(false);
    };
    host.addEventListener("pointerdown", onPointerDown);
    return () => {
      host.classList.remove("is-pane-over");
      host.style.removeProperty("--ov-gpane-cover");
      host.removeEventListener("pointerdown", onPointerDown);
    };
  }, [overlay, setForced]);
  if (!open) return null;
  if (madeRoom) return <span ref={probeRef} className="ov-gpane-probe" hidden />;
  return (
    <aside
      ref={paneRef}
      className={cn("ov-gpane", overlay && "is-overlay")}
      aria-label={localizeUi("ui.overhaul.ovgamepane.gamePane")}
    >
      <div className="ov-gpane__head">
        <div className="ov-gpane__where">{heading}</div>
        <button
          type="button"
          aria-label={localizeUi("ui.overhaul.ovgamepane.hideGamePane")}
          title={localizeUi("ui.overhaul.ovgamepane.hideGamePane")}
          onClick={() => setOpen(false)}
        >
          <X size={14} />
        </button>
      </div>
      <div className="ov-gpane__tabs" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={cn(tab === id && "is-on")}
            onClick={() => setTab(id)}
          >
            <Icon size={14} aria-hidden="true" />
            {localize(label)}
          </button>
        ))}
      </div>
      <div className={cn("ov-gpane__body", `is-${tab}`)} role="tabpanel">
        {tab === "party" ? (
          <PartyTab members={members} cards={cards} inventory={inventory} onEditSheet={onEditSheet} />
        ) : null}
        {tab === "inventory" ? (
          <InventoryTab inventory={inventory} playerName={playerName} onOpenInventory={onOpenInventory} />
        ) : null}
        {tab === "journal" ? journal : null}
        {tab === "map" ? map : null}
        {tab === "sessions" ? sessions : null}
      </div>
    </aside>
  );
}
