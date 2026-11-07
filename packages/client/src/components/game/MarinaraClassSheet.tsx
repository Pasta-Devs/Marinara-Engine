// A party member's Classic Marinara sheet, between fights (combat overhaul). The owner's pick of
// 2026-11-05 (mockup "Sheet 2"): the fight pools on top, then tabs for Status, Classes (both trees as
// a ladder), Skills (the class's own and the four carried) and Gear. Growth rates stay hidden, as in
// Fire Emblem; with Debug on, each stat shows its exact growth (class growth plus hidden aptitude).
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  MARINARA_ARCHETYPE_ROWS,
  MARINARA_ACCESSORY_SLOTS,
  MARINARA_CARRY_SLOTS,
  MARINARA_CLASSES,
  MARINARA_COMPANION_STABLE,
  MARINARA_PROMOTION_LEVEL,
  MARINARA_STATS,
  MARINARA_XP_PER_LEVEL,
  MARINARA_ARCHETYPES,
  marinaraBelowStandard,
  marinaraCanEquip,
  marinaraCarryRedundant,
  marinaraClass,
  marinaraClassBlock,
  marinaraClassGrowth,
  marinaraClassTraits,
  marinaraCompanionBonus,
  marinaraFrontOnly,
  marinaraGameItemPlace,
  marinaraItemName,
  marinaraLearnedSkills,
  marinaraOwnedGear,
  marinaraPartyFighter,
  marinaraSecondaryFits,
  marinaraSkillSummary,
  marinaraSkillsLeftBehind,
  marinaraStandardEquipment,
  marinaraTierForLevel,
  marinaraTrees,
  normalizeGameInventoryStacks,
  readMarinaraCardProgression,
  type MarinaraArchetype,
  type MarinaraCardProgression,
  type MarinaraClassDef,
  type MarinaraEquipment,
} from "@marinara-engine/shared";
import { api } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { MarinaraItemFacts } from "./MarinaraItemFacts";
import { chatKeys, useChat } from "../../hooks/use-chats";
import { useUIStore } from "../../stores/ui.store";

const blockKey = (block: string) => block.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());

type Props = { chatId: string; name: string; stored: unknown };
type Tab = "status" | "classes" | "skills" | "gear";
const TABS: readonly Tab[] = ["status", "classes", "skills", "gear"];
type Save = (change: {
  classId?: string;
  carried?: string[];
  equipment?: MarinaraEquipment;
  primary?: MarinaraArchetype;
  row?: "front" | "back" | null;
  activeCompanion?: string;
  releaseCompanion?: string;
}) => Promise<void>;

const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]";
const LINE = "border-[var(--marinara-chat-chrome-panel-border)]";

function Meter({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_4.5rem] items-center gap-2.5 text-[0.8125rem]">
      <span className="text-xs font-semibold tracking-wide" style={{ color }}>
        {label}
      </span>
      <span className="h-[0.4375rem] overflow-hidden rounded-full bg-[var(--marinara-chat-chrome-highlight-bg)]">
        <span
          className="block h-full rounded-full"
          style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, background: color }}
        />
      </span>
      <span className="text-right tabular-nums">
        {value} / {max}
      </span>
    </div>
  );
}

export function MarinaraClassSheet({ chatId, name, stored }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const debugMode = useUIStore((state) => state.debugMode);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("status");
  const { data: chat } = useChat(chatId);
  const progression = readMarinaraCardProgression(stored);
  const save: Save = async (change) => {
    setBusy(true);
    try {
      const result = await api.post<{ dropped?: string[] }>("/game/combat/director/marinara/progression", {
        chatId,
        name,
        ...change,
      });
      await qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
      // Say what a class change or carry change took away (playtest 2026-11-01).
      if (result?.dropped?.length)
        toast.warning(t("game.combat.marinara.sheet.dropped", { skills: result.dropped.join(", ") }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("game.combat.marinara.sheet.failed"));
    } finally {
      setBusy(false);
    }
  };
  // The primary tree is the player's pick (Alyssa 2026-10-31): before the first fight, and until they
  // have gained any experience in it.
  const fresh =
    !progression ||
    (progression.level === 1 && progression.xp === 0 && Object.keys(progression.classLevels).length === 1);
  const treePicker = fresh && (
    <label className="flex items-center gap-2 text-xs" data-testid="marinara-primary">
      <span className="w-24 shrink-0 text-[var(--muted-foreground)]">{t("game.combat.marinara.sheet.primary")}</span>
      <select
        className="min-h-9 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2"
        value={progression?.primary ?? ""}
        disabled={busy}
        onChange={(event) => event.target.value && void save({ primary: event.target.value as MarinaraArchetype })}
      >
        {!progression && <option value="">{t("game.combat.marinara.sheet.primaryUnset")}</option>}
        {MARINARA_ARCHETYPES.map((tree) => (
          <option key={tree} value={tree}>
            {t(`game.combat.marinara.archetype.${tree}`)}
          </option>
        ))}
      </select>
    </label>
  );
  if (!progression)
    return (
      <div className="space-y-2 text-xs">
        <p className="text-[var(--muted-foreground)]">{t("game.combat.marinara.sheet.none")}</p>
        {treePicker}
      </div>
    );

  // What they fight with: the body plus gear and passives, so the sheet matches the battle bars
  // (owner 2026-11-05: HP on the sheet is the fight's HP, not the stored body value).
  const fighter = marinaraPartyFighter(name, name, progression);

  return (
    <div className="space-y-3 text-xs" data-testid="marinara-class-sheet">
      {/* The class and its level sit in the sheet's header, above. */}
      <div className="space-y-1.5">
        {progression.fallen && (
          <p>
            <span className="rounded-full border border-[var(--destructive)] px-2 text-[var(--destructive)]">
              {t("game.combat.marinara.sheet.fallen")}
            </span>
          </p>
        )}
        <div className="grid max-w-[26rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 tabular-nums text-[var(--muted-foreground)]">
          <span>{t("game.combat.marinara.level", { level: progression.level })}</span>
          <span className="h-[0.3125rem] overflow-hidden rounded-full bg-[var(--marinara-chat-chrome-highlight-bg)]">
            <span
              className="block h-full rounded-full bg-[var(--primary)]"
              style={{ width: `${(progression.xp / MARINARA_XP_PER_LEVEL) * 100}%` }}
            />
          </span>
          <span>{t("game.combat.marinara.sheet2.exp", { xp: progression.xp, next: MARINARA_XP_PER_LEVEL })}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Meter label={t("game.combat.marinara.stat.hp")} value={fighter.maxHp} max={fighter.maxHp} color="#e0566f" />
        <Meter
          label={t("game.combat.marinara.sheet.resource.mp")}
          value={fighter.maxMp}
          max={fighter.maxMp}
          color="#4fb8c9"
        />
        <Meter
          label={t("game.combat.marinara.sheet2.st")}
          value={fighter.maxStamina}
          max={fighter.maxStamina}
          color="#d9a441"
        />
      </div>

      <div className={cn("-mx-5 flex gap-0.5 overflow-x-auto border-y px-4 py-1.5", LINE)} role="tablist">
        {TABS.map((one) => (
          <button
            key={one}
            type="button"
            role="tab"
            id={`marinara-sheet-tab-${one}`}
            aria-selected={tab === one}
            aria-controls={`marinara-sheet-panel-${one}`}
            onClick={() => setTab(one)}
            className={cn(
              "h-8 shrink-0 rounded-md px-2.5 text-[0.8125rem] font-medium transition-colors",
              tab === one
                ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--marinara-chat-chrome-highlight-bg)] hover:text-[var(--foreground)]",
            )}
          >
            {t(`game.combat.marinara.sheet2.tab.${one}`)}
          </button>
        ))}
      </div>

      {/* A floor on the panel's height keeps the tab row still while switching tabs on a desktop. */}
      <div
        role="tabpanel"
        className="sm:min-h-[min(26rem,calc(85dvh-22rem))]"
        id={`marinara-sheet-panel-${tab}`}
        aria-labelledby={`marinara-sheet-tab-${tab}`}
      >
        {tab === "status" && (
          <StatusTab progression={progression} fighter={fighter} debug={debugMode} busy={busy} save={save} />
        )}
        {tab === "classes" && (
          <ClassesTab progression={progression} busy={busy} save={save} treePicker={treePicker || null} />
        )}
        {tab === "skills" && <SkillsTab progression={progression} busy={busy} save={save} />}
        {tab === "gear" && <GearTab progression={progression} busy={busy} save={save} metadata={chat?.metadata} />}
      </div>
    </div>
  );
}

function StatusTab({
  progression,
  fighter,
  debug,
  busy,
  save,
}: {
  progression: MarinaraCardProgression;
  fighter: ReturnType<typeof marinaraPartyFighter>;
  debug: boolean;
  busy: boolean;
  save: Save;
}) {
  const { t } = useTranslation();
  const active = marinaraClass(progression.activeClass);
  const classRow = active?.row ?? MARINARA_ARCHETYPE_ROWS[active?.archetype ?? progression.primary];
  const currentRow = progression.row ?? classRow;
  const trees = marinaraTrees(progression.primary, progression.temperament);
  // A level-up rolls d100 under the active class's growth plus the hidden aptitude: shown only in Debug.
  const growth = active ? marinaraClassGrowth(active) : undefined;
  const growthOf = (stat: (typeof MARINARA_STATS)[number]) =>
    growth ? Math.max(0, growth[stat] + progression.aptitudes[stat]) : null;
  const otherRow = currentRow === "front" ? "back" : "front";
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {MARINARA_STATS.filter((stat) => stat !== "hp").map((stat) => (
          <div
            key={stat}
            className={cn("grid justify-items-center gap-0.5 rounded-xl border px-1 py-2", LINE)}
            data-testid={`marinara-stat-${stat}`}
          >
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">
              {t(`game.combat.marinara.stat.${stat}`)}
            </span>
            <span className="text-2xl font-semibold leading-tight tabular-nums">{Math.round(fighter.stats[stat])}</span>
            {debug && growthOf(stat) !== null && (
              <span className="font-mono text-[0.6875rem] text-[#d9a441]">{growthOf(stat)}%</span>
            )}
          </div>
        ))}
        <button
          type="button"
          disabled={busy || progression.fallen}
          onClick={() => void save({ row: otherRow === classRow ? null : otherRow })}
          title={t("game.combat.marinara.sheet.rowHelp")}
          className={cn(
            "grid justify-items-center gap-0.5 rounded-xl border px-1 py-2 transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg)] disabled:opacity-60",
            LINE,
          )}
          data-testid="marinara-row"
        >
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">
            {t("game.combat.marinara.sheet.row")}
          </span>
          <span className="text-base font-semibold leading-[2rem]">
            {t(`game.combat.marinara.sheet2.row.${currentRow}`)}
          </span>
          <span className="text-[0.625rem] text-[var(--muted-foreground)]">
            {t(`game.combat.marinara.sheet2.rowSwap.${otherRow}`)}
          </span>
        </button>
      </div>
      {debug && growth && (
        <p className="font-mono text-[0.6875rem] text-[#d9a441]" data-testid="marinara-growth-debug">
          {t("game.combat.marinara.sheet2.growthDebug", { hp: growthOf("hp") })}
        </p>
      )}
      <p className="text-[var(--muted-foreground)]">
        {t("game.combat.marinara.sheet2.statsNote")} {t("game.combat.marinara.sheet.rowHelp")}
      </p>
      <div className="flex flex-wrap gap-1">
        <span className={cn("rounded-full border px-2 py-0.5 text-[var(--muted-foreground)]", LINE)}>
          {trees.pure
            ? t("game.combat.marinara.sheet.pure", { tree: t(`game.combat.marinara.archetype.${trees.primary}`) })
            : t("game.combat.marinara.sheet.trees", {
                primary: t(`game.combat.marinara.archetype.${trees.primary}`),
                secondary: t(`game.combat.marinara.archetype.${trees.secondary}`),
              })}
        </span>
      </div>
      <Companions progression={progression} busy={busy} save={save} />
    </div>
  );
}

/** Tamed beasts (Tracker, Alyssa 2026-11-01): one active, swapped outside battle; a full stable asks which
 *  one to let go. */
function Companions({ progression, busy, save }: { progression: MarinaraCardProgression; busy: boolean; save: Save }) {
  const { t } = useTranslation();
  if (!progression.companions?.length && !progression.pendingCompanion) return null;
  return (
    <div className="space-y-1.5" data-testid="marinara-companions">
      <p className={LABEL}>
        {t("game.combat.marinara.sheet.companions", {
          count: progression.companions?.length ?? 0,
          max: MARINARA_COMPANION_STABLE,
        })}
      </p>
      <p className="text-[var(--muted-foreground)]">{t("game.combat.marinara.sheet.companionsHint")}</p>
      {progression.pendingCompanion && (
        <div className="rounded-md border border-[var(--primary)] px-2 py-1.5" role="alert">
          <p>{t("game.combat.marinara.sheet.companionWaiting", { name: progression.pendingCompanion.name })}</p>
          <button
            type="button"
            className="mt-1 min-h-8 rounded-md border border-[var(--border)] px-2"
            disabled={busy}
            onClick={() => void save({ releaseCompanion: progression.pendingCompanion!.id })}
          >
            {t("game.combat.marinara.sheet.releaseNew", { name: progression.pendingCompanion.name })}
          </button>
        </div>
      )}
      <ul>
        {(progression.companions ?? []).map((one) => {
          const isActive = progression.activeCompanion === one.id;
          return (
            <li key={one.id} className={cn("flex flex-wrap items-center gap-2 border-b py-1.5 last:border-b-0", LINE)}>
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{one.name}</span>{" "}
                <span className="text-[var(--muted-foreground)]">
                  {t(`game.combat.marinara.stat.${one.stat}`, { defaultValue: one.stat })} +
                  {Math.round(marinaraCompanionBonus(one) * 100)}%
                  {one.level ? <> · {t("game.combat.marinara.level", { level: one.level })}</> : null}
                  {one.tier && one.tier !== "standard" ? <> · {t(`game.combat.marinara.tier.${one.tier}`)}</> : null}
                </span>
              </span>
              {isActive ? (
                <span className="text-[var(--primary)]">{t("game.combat.marinara.sheet2.companionActive")}</span>
              ) : (
                <button
                  type="button"
                  className="min-h-8 rounded-md border border-[var(--border)] px-2"
                  disabled={busy}
                  onClick={() => void save({ activeCompanion: one.id })}
                >
                  {t("game.combat.marinara.sheet2.companionMakeActive")}
                </button>
              )}
              <button
                type="button"
                className="min-h-8 rounded-md px-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                disabled={busy}
                onClick={() => void save({ releaseCompanion: one.id })}
              >
                {t("game.combat.marinara.sheet.release")}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const TIERS = ["base", "advanced", "master"] as const;

function ClassesTab({
  progression,
  busy,
  save,
  treePicker,
}: {
  progression: MarinaraCardProgression;
  busy: boolean;
  save: Save;
  treePicker: React.ReactNode;
}) {
  const { t } = useTranslation();
  // The class picked on the ladder: its skills show below it, and a button takes it (a click never
  // switches class at once; Haiku panel 2026-11-01 picked blind).
  const [picked, setPicked] = useState<string | null>(null);
  const trees = marinaraTrees(progression.primary, progression.temperament);
  const shown = marinaraClass(picked ?? progression.activeClass);
  const columns: Array<{ tree: MarinaraArchetype; note: string }> = [
    {
      tree: trees.primary,
      note: trees.pure ? t("game.combat.marinara.sheet2.pureTree") : t("game.combat.marinara.sheet2.primaryTree"),
    },
    ...(trees.secondary && !trees.pure
      ? [
          {
            tree: trees.secondary,
            note: t("game.combat.marinara.sheet2.secondaryTree", {
              temperament: t(`game.combat.marinara.sheet2.temperament.${progression.temperament}`),
            }),
          },
        ]
      : []),
  ];
  const stateOf = (def: MarinaraClassDef): { text: string; kind: "now" | "trained" | "open" | "locked" } => {
    const trained = progression.classLevels[def.id];
    if (def.id === progression.activeClass)
      return { text: t("game.combat.marinara.sheet2.now", { level: trained ?? 1 }), kind: "now" };
    if (trained !== undefined)
      return { text: t("game.combat.marinara.sheet.learnedAt", { level: trained }), kind: "trained" };
    if (def.pure && !trees.pure)
      return {
        text: t("game.combat.marinara.sheet2.pureOnly"),
        kind: "locked",
      };
    if (def.from) {
      const parent = marinaraClass(def.from);
      const needed = MARINARA_PROMOTION_LEVEL[def.tier as "advanced" | "master"] ?? 0;
      if ((progression.classLevels[def.from] ?? 0) < needed)
        return { text: `${parent?.label ?? def.from} ${needed}`, kind: "locked" };
    }
    return { text: t("game.combat.marinara.sheet2.open"), kind: "open" };
  };
  const fits = progression.fallen ? [] : marinaraSecondaryFits(progression);
  const details = (def: MarinaraClassDef) => (
    <ClassDetails
      key={def.id}
      def={def}
      progression={progression}
      busy={busy || !!progression.fallen}
      onTake={(id) => void save({ classId: id })}
    />
  );
  return (
    <div className="space-y-3">
      {treePicker}
      {/* Two trees sit side by side; a Pure character has one, so the details take the other column. */}
      <div className="grid items-start gap-4 sm:grid-cols-2">
        {columns.map(({ tree, note }) => (
          <div key={tree} className="space-y-1.5">
            <p className={cn(LABEL, "flex justify-between gap-2")}>
              <span>
                {t("game.combat.marinara.sheet2.treeName", { tree: t(`game.combat.marinara.archetype.${tree}`) })}
              </span>
              <span className="font-normal normal-case tracking-normal">{note}</span>
            </p>
            {TIERS.map((tier) => {
              const defs = MARINARA_CLASSES.filter((def) => def.archetype === tree && def.tier === tier);
              if (!defs.length) return null;
              return (
                <div key={tier} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2">
                  <span className="pt-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                    {t(`game.combat.marinara.sheet2.tier.${tier}`)}
                  </span>
                  <div className="grid gap-1">
                    {defs.map((def) => {
                      const state = stateOf(def);
                      return (
                        <button
                          key={def.id}
                          type="button"
                          aria-pressed={shown?.id === def.id}
                          onClick={() => setPicked(def.id)}
                          className={cn(
                            "flex min-h-9 items-baseline justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[0.8125rem] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg)]",
                            state.kind === "now"
                              ? "border-[var(--primary)] bg-[var(--primary)]/10"
                              : state.kind === "locked"
                                ? cn("border-dashed text-[var(--muted-foreground)]", LINE)
                                : LINE,
                            shown?.id === def.id && state.kind !== "now" && "ring-1 ring-[var(--primary)]",
                          )}
                        >
                          <span className={state.kind === "locked" ? "font-medium" : "font-semibold"}>{def.label}</span>
                          <span
                            className={cn(
                              "whitespace-nowrap text-xs",
                              state.kind === "now" ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]",
                            )}
                          >
                            {state.text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {shown && columns.length === 1 && details(shown)}
      </div>
      {shown && columns.length > 1 && details(shown)}
      {fits.length > 0 && (
        <div className="text-[var(--muted-foreground)]">
          <p className="font-medium">{t("game.combat.marinara.sheet.secondaryFits")}</p>
          <ul className="list-disc pl-4">
            {fits.map((fit) => (
              <li key={fit.skillId}>
                {t("game.combat.marinara.sheet.secondaryFit", {
                  skill: fit.label,
                  className: fit.classLabel,
                  level: fit.learnedAt,
                  reason: fit.reason,
                })}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[var(--muted-foreground)]">{t("game.combat.marinara.sheet2.classesHelp")}</p>
    </div>
  );
}

function SkillsTab({ progression, busy, save }: { progression: MarinaraCardProgression; busy: boolean; save: Save }) {
  const { t } = useTranslation();
  const active = marinaraClass(progression.activeClass);
  const level = progression.classLevels[progression.activeClass] ?? 1;
  const classRow = active?.row ?? MARINARA_ARCHETYPE_ROWS[active?.archetype ?? progression.primary];
  const currentRow = progression.row ?? classRow;
  // A tree trait the active class already keeps (Cover, Hold the Line for a Guard line) needs no slot.
  const kept = marinaraClassTraits(progression.activeClass);
  const learned = marinaraLearnedSkills(progression).filter(
    (skill) =>
      skill.classId !== progression.activeClass &&
      !(kept.includes(skill.id) && marinaraClass(skill.classId)?.archetype === active?.archetype) &&
      !marinaraCarryRedundant(progression, skill.id),
  );
  const toggleCarry = (id: string) => {
    const carried = progression.carried.includes(id)
      ? progression.carried.filter((one) => one !== id)
      : [...progression.carried, id];
    if (carried.length > MARINARA_CARRY_SLOTS) {
      toast.error(t("game.combat.marinara.sheet.carryFull", { count: MARINARA_CARRY_SLOTS }));
      return;
    }
    void save({ carried });
  };
  const idle = (id: string) => currentRow === "back" && marinaraFrontOnly(id);
  return (
    <div className="space-y-3">
      <p className={LABEL}>
        {t("game.combat.marinara.sheet2.classSkills", { name: active?.label ?? progression.activeClass })}
      </p>
      <ul>
        {[...(active?.skills ?? [])]
          .sort((a, b) => a.learnedAt - b.learnedAt)
          .map((skill) => {
            const has = level >= skill.learnedAt;
            return (
              <li
                key={skill.id}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b py-1.5 last:border-b-0",
                  LINE,
                  !has && "text-[var(--muted-foreground)]",
                )}
              >
                <span className="min-w-0">
                  <span className="text-[0.8125rem] font-semibold">{skill.label}</span>
                  {skill.kind === "passive" && (
                    <span className="ml-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                      {t("game.combat.marinara.sheet.kind.passive")}
                    </span>
                  )}
                  <span className="block text-[var(--muted-foreground)]">
                    {marinaraSkillSummary(skill, progression)}
                    {idle(skill.id) ? <> {t("game.combat.marinara.sheet.frontOnlyIdle")}</> : null}
                  </span>
                </span>
                <span className="whitespace-nowrap text-right text-[var(--muted-foreground)]">
                  {skill.cost ? (
                    <span className="text-[#d9a441]">
                      {skill.cost} {t(`game.combat.marinara.sheet2.cost.${skill.resource ?? "mp"}`)}
                    </span>
                  ) : null}
                  {skill.cost ? " · " : ""}
                  {has
                    ? t("game.combat.marinara.sheet.learnedAt", { level: skill.learnedAt })
                    : t("game.combat.marinara.sheet2.learnsAt", { level: skill.learnedAt })}
                </span>
              </li>
            );
          })}
      </ul>
      <p className={cn(LABEL, "flex justify-between")}>
        <span>{t("game.combat.marinara.sheet2.carryTitle")}</span>
        <span className="font-normal normal-case tracking-normal">
          {t("game.combat.marinara.sheet2.carryCount", {
            count: progression.carried.length,
            max: MARINARA_CARRY_SLOTS,
          })}
        </span>
      </p>
      {learned.length === 0 ? (
        <p className="text-[var(--muted-foreground)]">{t("game.combat.marinara.sheet.nothingToCarry")}</p>
      ) : (
        <ul>
          {learned.map((skill) => {
            const carried = progression.carried.includes(skill.id);
            return (
              <li key={skill.id} className={cn("border-b last:border-b-0", LINE)}>
                <label className="flex cursor-pointer items-start gap-2.5 py-1.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                    checked={carried}
                    disabled={busy || progression.fallen}
                    onChange={() => toggleCarry(skill.id)}
                  />
                  <span className="min-w-0">
                    <span className="text-[0.8125rem] font-semibold">{skill.label}</span>{" "}
                    <span className="text-[var(--muted-foreground)]">· {marinaraClass(skill.classId)?.label}</span>
                    <span className="block text-[var(--muted-foreground)]">
                      {marinaraSkillSummary(skill, progression)}
                      {idle(skill.id) ? <> {t("game.combat.marinara.sheet.frontOnlyIdle")}</> : null}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function GearTab({
  progression,
  busy,
  save,
  metadata,
}: {
  progression: MarinaraCardProgression;
  busy: boolean;
  save: Save;
  metadata: unknown;
}) {
  const { t } = useTranslation();
  // Gear from the party's bags that this class can use, by its name in the game's setting.
  const meta = (metadata ?? {}) as Record<string, unknown>;
  const place = marinaraGameItemPlace(meta);
  const owned = marinaraOwnedGear(normalizeGameInventoryStacks(meta.gameInventory), place);
  const equipment = progression.equipment ?? {};
  // An empty weapon or armour slot fights with the class's standard piece for their tier; a piece worth
  // less than it is marked, so a looted dagger isn't worn by mistake (items playtest I1).
  const archetype = marinaraClass(progression.activeClass)?.archetype ?? progression.primary;
  const tier = marinaraTierForLevel(progression.level);
  const standard = marinaraStandardEquipment(archetype, tier);
  const options = (slot: "weapon" | "armor" | "accessory", current: string | undefined) => {
    const ids = owned
      .filter((gear) => gear.slot === slot && marinaraCanEquip(progression.activeClass, gear.id, slot))
      .map((gear) => gear.id);
    return current && !ids.includes(current) ? [current, ...ids] : ids;
  };
  const wear = (next: MarinaraEquipment) => {
    const accessories = (next.accessories ?? []).filter(Boolean);
    void save({
      equipment: {
        ...(next.weapon ? { weapon: next.weapon } : {}),
        ...(next.armor ? { armor: next.armor } : {}),
        ...(accessories.length ? { accessories } : {}),
      },
    });
  };
  const slotSelect = (
    label: string,
    value: string | undefined,
    ids: string[],
    pick: (id: string) => void,
    slot?: "weapon" | "armor",
  ) => (
    <label key={label} className={cn("grid gap-1 rounded-lg border px-2.5 py-2", LINE)}>
      <span className="text-[0.6875rem] text-[var(--muted-foreground)]">{label}</span>
      <select
        className="min-h-9 min-w-0 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 text-[0.8125rem]"
        value={value ?? ""}
        disabled={busy || progression.fallen}
        onChange={(event) => pick(event.target.value)}
      >
        <option value="">
          {slot && standard[slot]
            ? t("game.combat.marinara.sheet.gearStandardPiece", { name: marinaraItemName(standard[slot]!, place) })
            : t("game.combat.marinara.sheet.gearNothing")}
        </option>
        {ids.map((id) => (
          <option key={id} value={id}>
            {slot && marinaraBelowStandard(id, slot, archetype, tier, progression.stats.strength)
              ? t("game.combat.marinara.sheet.gearBelowStandard", { name: marinaraItemName(id, place) })
              : marinaraItemName(id, place)}
          </option>
        ))}
      </select>
      <MarinaraItemFacts
        itemId={value || (slot ? standard[slot] : undefined)}
        className="text-[var(--muted-foreground)]"
      />
    </label>
  );
  return (
    <div className="space-y-2" data-testid="marinara-gear">
      <div className="grid gap-2 sm:grid-cols-2">
        {slotSelect(
          t("game.combat.marinara.sheet.slot.weapon"),
          equipment.weapon,
          options("weapon", equipment.weapon),
          (id) => wear({ ...equipment, weapon: id || undefined }),
          "weapon",
        )}
        {slotSelect(
          t("game.combat.marinara.sheet.slot.armor"),
          equipment.armor,
          options("armor", equipment.armor),
          (id) => wear({ ...equipment, armor: id || undefined }),
          "armor",
        )}
        {Array.from({ length: MARINARA_ACCESSORY_SLOTS }, (_, n) => {
          const current = equipment.accessories?.[n];
          return slotSelect(
            t("game.combat.marinara.sheet.slot.accessory", { n: n + 1 }),
            current,
            options("accessory", current),
            (id) => {
              const accessories = [...(equipment.accessories ?? [])];
              accessories[n] = id;
              wear({ ...equipment, accessories });
            },
          );
        })}
      </div>
      <p className="text-[var(--muted-foreground)]">{t("game.combat.marinara.sheet.gearStandard")}</p>
    </div>
  );
}

/**
 * One class's role, where it comes from and every skill it teaches, with a button to take it. A
 * promotion names the class it grows from, so a second promotion off the same class (a sibling) reads
 * as that and not as skipping a gate (Haiku panel 2026-11-01).
 */
function ClassDetails({
  def,
  progression,
  busy,
  onTake,
}: {
  def: MarinaraClassDef;
  progression: MarinaraCardProgression;
  busy: boolean;
  onTake: (id: string) => void;
}) {
  const { t } = useTranslation();
  const block = marinaraClassBlock(progression, def.id);
  const current = def.id === progression.activeClass;
  const trained = progression.classLevels[def.id];
  const parent = def.from ? marinaraClass(def.from) : undefined;
  const needed = def.tier === "base" ? 0 : MARINARA_PROMOTION_LEVEL[def.tier as "advanced" | "master"];
  const level = trained ?? 0;
  const traits = marinaraClassTraits(def.id);
  const tree = t(`game.combat.marinara.archetype.${def.archetype}`);
  // The row this class would fight from: front-only skills sit idle in the back (Alyssa 2026-11-02).
  const row = progression.row ?? def.row ?? MARINARA_ARCHETYPE_ROWS[def.archetype];
  // What taking this class up would leave behind, said before the button is pressed.
  const leftBehind = current ? [] : marinaraSkillsLeftBehind(progression, def.id);
  // A change that loses skills asks first, with the list (Sonnet panel r5, 2026-11-03: a line under the
  // button went unread and testers still lost Element Mastery, Weaken and Wither).
  const [confirming, setConfirming] = useState(false);
  const blockParams = def.from
    ? { parent: parent?.label ?? def.from, needed, level: progression.classLevels[def.from] ?? 0 }
    : {};
  return (
    <div className={cn("space-y-1.5 rounded-lg border p-2.5", LINE)} data-testid="marinara-class-details">
      <p>
        <span className="text-[0.8125rem] font-semibold">{def.label}</span>{" "}
        <span className="text-[var(--muted-foreground)]">
          {[
            def.role,
            parent
              ? t("game.combat.marinara.sheet.promotesFrom", { parent: parent.label, level: needed })
              : t("game.combat.marinara.sheet.baseOf", { tree }),
            def.pure ? t("game.combat.marinara.sheet.pureOnly", { tree }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </p>
      <ul className="space-y-0.5">
        {[...def.skills]
          .sort((a, b) => a.learnedAt - b.learnedAt)
          .map((skill) => (
            <li key={skill.id} className={level >= skill.learnedAt ? "" : "text-[var(--muted-foreground)]"}>
              <span className="tabular-nums">
                {t("game.combat.marinara.sheet.learnedAt", { level: skill.learnedAt })}
              </span>{" "}
              <span className="font-medium">{skill.label}</span>{" "}
              <span className="text-[var(--muted-foreground)]">
                {t("game.combat.marinara.sheet.skillLine", {
                  tags: [
                    t(`game.combat.marinara.sheet.kind.${skill.kind}`),
                    skill.cost
                      ? `${skill.cost} ${t(`game.combat.marinara.sheet.resource.${skill.resource ?? "mp"}`)}`
                      : null,
                    traits.includes(skill.id) ? t("game.combat.marinara.sheet.treeTrait", { tree }) : null,
                    row === "back" && marinaraFrontOnly(skill.id)
                      ? t("game.combat.marinara.sheet.frontOnlyIdle")
                      : null,
                  ]
                    .filter(Boolean)
                    .join(", "),
                  summary: marinaraSkillSummary(skill, progression),
                })}
              </span>
            </li>
          ))}
      </ul>
      {!current && (
        <button
          type="button"
          disabled={busy || !!block}
          onClick={() => (leftBehind.length > 0 && !confirming ? setConfirming(true) : onTake(def.id))}
          className="min-h-9 rounded-md bg-[var(--primary)] px-3 text-[var(--primary-foreground)] disabled:opacity-60"
        >
          {trained !== undefined
            ? t("game.combat.marinara.sheet.switchTo", { name: def.label, level: trained })
            : parent
              ? t("game.combat.marinara.sheet.promoteTo", { name: def.label })
              : t("game.combat.marinara.sheet.takeUp", { name: def.label })}
        </button>
      )}
      {!current && block && (
        <p className="text-[var(--muted-foreground)]">
          {t(`game.combat.marinara.sheet.block.${blockKey(block)}`, { defaultValue: block, ...blockParams })}
        </p>
      )}
      {!current && !block && leftBehind.length > 0 && !confirming && (
        <p className="text-amber-500" data-testid="marinara-left-behind">
          {t("game.combat.marinara.sheet.leftBehind", { skills: leftBehind.map((skill) => skill.label).join(", ") })}
        </p>
      )}
      {!current && !block && confirming && leftBehind.length > 0 && (
        <div
          role="alertdialog"
          className="space-y-2 rounded-md border border-amber-500 bg-amber-500/10 p-2"
          data-testid="marinara-left-behind-confirm"
        >
          <p className="font-semibold">{t("game.combat.marinara.sheet.leftBehindTitle", { name: def.label })}</p>
          <ul className="list-disc pl-5">
            {leftBehind.map((skill) => (
              <li key={skill.id}>{skill.label}</li>
            ))}
          </ul>
          <p className="text-[var(--muted-foreground)]">{t("game.combat.marinara.sheet.leftBehindHint")}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                onTake(def.id);
              }}
              className="min-h-9 rounded-md bg-amber-600 px-3 text-white disabled:opacity-60"
            >
              {t("game.combat.marinara.sheet.leftBehindConfirm")}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="min-h-9 rounded-md border border-[var(--border)] px-3"
            >
              {t("game.combat.marinara.sheet.leftBehindCancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
