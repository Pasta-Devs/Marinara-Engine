// The Rules choice of the Game setup wizard: Marinara's own rules, or one installed ruleset. The
// choice is made once, for a new game, and is independent of combat presentation. The Party step,
// where the persona and the party are picked, shows GameSetupRulesetSheetStatus: which members
// already have a sheet for the chosen ruleset. A member without one starts the game on a blank
// sheet, never on invented numbers.
import { useMemo } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  normalizeCharacterLookupName,
  rulesetSheetEnvelopeSchema,
  type GameCombatStyle,
  type InstalledRuleset,
} from "@marinara-engine/shared";
import { useCharacters, usePersonas } from "../../hooks/use-characters";
import { rulesetLayerChoices } from "../../lib/ruleset-layers";
import { rulesetRulesSummary } from "../../lib/ruleset-resolution";
import { rulesetRepositoryLabel } from "../../lib/ruleset-source";
import { cn } from "../../lib/utils";

function readRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

// The same test the game applies when it copies the sheet: a stored value that does not read as a
// sheet starts the game blank, so it must not be listed as a ready sheet here.
function readsAsSheet(entry: unknown): boolean {
  return rulesetSheetEnvelopeSchema.safeParse(entry).success;
}

/** Which of the chosen persona and party already hold a sheet for the chosen ruleset. */
export function GameSetupRulesetSheetStatus({
  ruleset,
  partyCharacterIds,
  personaId,
}: {
  ruleset: InstalledRuleset;
  partyCharacterIds: string[];
  personaId: string | null;
}) {
  const { t } = useUiTranslation();
  const { data: characters } = useCharacters(true);
  const { data: personas } = usePersonas();

  const members = useMemo(() => {
    const rulesetId = ruleset.definition.id;
    // Setup keeps ONE stored sheet per normalized name, the way it matches generated cards: each
    // party member's sheet under its name, then the persona's over a name they share, because the
    // persona is the player. The rows read that same map, so two members who share a name show
    // what the game will really copy for that name.
    const storedByName = new Map<string, unknown>();
    const rows: Array<{ key: string; name: string }> = [];
    const persona = personas?.find((entry) => entry.id === personaId);
    if (persona) rows.push({ key: `persona:${persona.id}`, name: persona.name });
    for (const id of partyCharacterIds) {
      const row = (characters as Array<{ id?: unknown; data?: unknown }> | undefined)?.find((entry) => entry.id === id);
      const data = readRecord(row?.data);
      if (!data) continue;
      const name = typeof data.name === "string" ? data.name : id;
      rows.push({ key: `character:${id}`, name });
      const sheet = readRecord(readRecord(data.extensions)?.rulesetSheets)?.[rulesetId];
      if (sheet) storedByName.set(normalizeCharacterLookupName(name), sheet);
    }
    const personaSheet = readRecord(readRecord(persona?.personaStats)?.rulesetSheets)?.[rulesetId];
    if (persona && personaSheet) storedByName.set(normalizeCharacterLookupName(persona.name), personaSheet);
    return rows.map((row) => ({
      ...row,
      hasSheet: readsAsSheet(storedByName.get(normalizeCharacterLookupName(row.name))),
    }));
  }, [ruleset, characters, personas, partyCharacterIds, personaId]);

  if (members.length === 0) return null;
  return (
    <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-xs">
      <span className="block font-medium text-[var(--foreground)]">
        {t("game.ruleset.setup.sheetsHeading", { name: ruleset.definition.name })}
      </span>
      <ul className="space-y-1">
        {members.map((member) => (
          <li key={member.key} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[var(--foreground)]">{member.name}</span>
            <span className="shrink-0 text-[var(--muted-foreground)]">
              {member.hasSheet ? t("game.ruleset.setup.hasSheet") : t("game.ruleset.setup.blankSheet")}
            </span>
          </li>
        ))}
      </ul>
      {members.some((member) => !member.hasSheet) && (
        <p className="text-[var(--muted-foreground)]">{t("game.ruleset.setup.blankSheetHint")}</p>
      )}
    </div>
  );
}

export function GameSetupRulesChooser({
  rulesets,
  activeId,
  combatStyle,
  layerIds,
  onSelect,
  onToggleLayer,
}: {
  rulesets: InstalledRuleset[];
  activeId: string | null;
  /** The Combat Preference picked above, named in the note so "Marinara's combat" is never read as Classic. */
  combatStyle: GameCombatStyle;
  /** The layers checked on the chosen ruleset. Empty for a ruleset that ships none. */
  layerIds: string[];
  onSelect: (rulesetId: string | null) => void;
  onToggleLayer: (layerId: string) => void;
}) {
  const { t } = useUiTranslation();
  const active = rulesets.find((entry) => entry.definition.id === activeId) ?? null;
  // A ruleset that ships no layers produces no rows and the block is not drawn at all, so the Rules
  // step reads exactly as it did before layers existed.
  const layerChoices = active ? rulesetLayerChoices(active.definition, layerIds) : [];

  const cardClass = (selected: boolean) =>
    cn(
      // Cards in one row stretch to the tallest, so the text is pinned to the top of each.
      "flex w-full flex-col justify-start rounded-lg p-3 text-left text-xs transition-colors ring-1",
      selected
        ? "bg-[var(--primary)]/10 ring-[var(--primary)]/40"
        : "bg-[var(--secondary)] ring-[var(--border)] hover:ring-[var(--primary)]/20",
    );

  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">{t("game.ruleset.setup.label")}</span>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => onSelect(null)} aria-pressed={!active} className={cardClass(!active)}>
          <span className="block font-medium text-[var(--foreground)]">{t("game.ruleset.setup.ownRules")}</span>
          <span className="mt-1 block text-[var(--muted-foreground)]">
            {t("game.ruleset.setup.ownRulesDescription")}
          </span>
        </button>
        {rulesets.map(({ definition, source }) => {
          const selected = active?.definition.id === definition.id;
          // An imported ruleset says so on its own card: it was not reviewed by anyone, and where
          // it came from is part of deciding whether to build a whole campaign on it.
          const repository = source ? rulesetRepositoryLabel(source) : null;
          return (
            <button
              key={definition.id}
              type="button"
              onClick={() => onSelect(definition.id)}
              aria-pressed={selected}
              className={cardClass(selected)}
            >
              <span className="block font-medium text-[var(--foreground)]">{definition.name}</span>
              {source && (
                <span className="mt-0.5 block text-[0.625rem] uppercase text-[var(--muted-foreground)]/80">
                  {repository
                    ? t("game.ruleset.setup.importedFrom", { source: repository })
                    : t("game.ruleset.setup.imported")}
                </span>
              )}
              <span className="mt-1 block text-[var(--muted-foreground)]">{definition.coverage.summary}</span>
            </button>
          );
        })}
      </div>

      {active && (
        <div className="mt-2 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-xs">
          {/* How the chosen ruleset rolls a check, in its own numbers: the choice is made once and
              stays with the game, so it is worth reading before the game is created. */}
          <p className="text-[var(--muted-foreground)]">
            {rulesetRulesSummary(active.definition, t).map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
          <p className="text-[var(--muted-foreground)]">{t("game.ruleset.setup.pinned")}</p>
          {/* What battles will do is read from the BLOCKS this file declares, never from the
              `coverage.combat` flag beside them: the flag is what an author says the ruleset
              covers, and what resolves a fight has to be what the file really carries. A `combat`
              block resolves the fight itself, a `battle` block only lends the sheet to Marinara's
              own combat, and a ruleset with neither leaves battles exactly as they were. */}
          <p className="text-[var(--muted-foreground)]">
            {active.definition.combat
              ? t("game.ruleset.setup.combatOwnRules")
              : t(
                  active.definition.battle
                    ? "game.ruleset.setup.combatFromSheets"
                    : "game.ruleset.setup.combatFromPreference",
                  {
                    style: t(
                      combatStyle === "tactical"
                        ? "ui.game.gamesetupwizard.tactical"
                        : "ui.game.gamesetupwizard.classic",
                    ),
                  },
                )}
          </p>
        </div>
      )}

      {/* The variants this ruleset ships. They narrow its own rules, so they belong under it rather
          than beside the ruleset cards, and a ruleset that ships none shows nothing here. */}
      {layerChoices.length > 0 && (
        <div className="mt-2 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-xs">
          <span className="block font-medium text-[var(--foreground)]">{t("game.ruleset.setup.layersHeading")}</span>
          <ul className="space-y-1.5">
            {layerChoices.map((choice) => (
              <li key={choice.layer.id}>
                <label className={cn("flex items-start gap-2", choice.blockedBy && "opacity-60")}>
                  <input
                    type="checkbox"
                    checked={choice.checked}
                    disabled={Boolean(choice.blockedBy)}
                    onChange={() => onToggleLayer(choice.layer.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-[var(--foreground)]">{choice.layer.label}</span>
                    {choice.layer.summary && (
                      <span className="block text-[var(--muted-foreground)]">{choice.layer.summary}</span>
                    )}
                    {/* Named, not just greyed out: the box is disabled because another checked layer
                        rules it out, and the only way to reach it is to turn that one off. */}
                    {choice.blockedBy && (
                      <span className="block text-[var(--muted-foreground)]">
                        {t("game.ruleset.setup.layerBlocked", { layer: choice.blockedBy.label })}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-[var(--muted-foreground)]">{t("game.ruleset.setup.layersPinned")}</p>
        </div>
      )}
    </div>
  );
}
