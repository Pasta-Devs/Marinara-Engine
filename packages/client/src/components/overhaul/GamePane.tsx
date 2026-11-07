// ──────────────────────────────────────────────
// UI overhaul: Game Mode right pane (mockup "Game B")
//
// One pane on the right of the game with tabs for Party, Inventory, Journal,
// Map and Sessions. It replaces the floating bubbles over the scene; the rare
// tools (volume, assets, game data, checkpoints, retries, ending the session)
// moved into Chat settings > Game.
// ──────────────────────────────────────────────
import { useMemo, useState, type ReactNode } from "react";
import { BookOpen, Backpack, Map as MapIcon, ScrollText, Users, X } from "lucide-react";
import type { AvatarCrop, GameInventoryStack } from "@marinara-engine/shared";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { useOverhaulStore, type OverhaulGamePaneTab } from "../../stores/overhaul.store";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";

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
  { id: "sessions", label: "Sessions", icon: ScrollText },
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
    <span className="ov-gpane__av">{member.name.slice(0, 1).toUpperCase()}</span>
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
  if (!open) return null;
  return (
    <aside className="ov-gpane" aria-label={localizeUi("ui.overhaul.ovgamepane.gamePane")}>
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
