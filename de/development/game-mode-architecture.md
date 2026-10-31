# Architektur von Game Mode: Regelsätze, Proben und Kampf

Hier findest du die Übersicht, wenn du den Regelcode von Game Mode ändern möchtest: wo ein Regelsatz gelesen wird, wie eine Probe und ein Kampf aufgelöst werden, wo der Zustand gespeichert wird und was ein neuer Regelsatzschlüssel braucht. Die Dokumentation für Spieler steht in `docs/game/`, die Anleitung für Regelsatz-Autoren beginnt bei [`docs/extending/writing-rulesets.md`](../extending/writing-rulesets.md), und die Kampf-KI hat eine eigene Seite: [Kampf-KI im Game Mode](game-combat-ai.md).

## Wo du was findest

| Bereich | Code |
| --- | --- |
| Das Regelsatzformat | `packages/shared/src/schemas/ruleset.schema.ts`: das zod-Schema, `RulesetRef` (die Bindung) und die Gegenprüfungen, die beim Import laufen. Das JSON-Schema für den Editor, `docs/extending/ruleset.schema.json`, wird daraus mit `pnpm ruleset:schema` erzeugt. |
| Capability API | `supportedCapabilityApi` in `packages/shared/src/schemas/capability-package.schema.ts`, mit einer Kommentarzeile je Minor-Version, die deren Ergänzungen beschreibt. |
| Berechnungen für Charakterbögen und Live-Zustand | `packages/shared/src/features/rulesets/`: `sheet-math.ts`, `live-state.ts` (die `[sheet:]`-Operationen), `sheet-commands.ts`, `sheet-builder.ts`, `layers.ts`, `item-*.ts`, `loot.ts`, `market.ts`, `combat-bridge.ts` (der `battle`-Block). |
| Regelsatz-Kämpfe | `packages/shared/src/features/ruleset-combat/`: `resolve.ts`, `options.ts` (was im Menü steht), `grid.ts`, `sight.ts`, `zones.ts`, `creatures.ts`, `pool.ts`, `symbols.ts`, `dice.ts`. Alles reine Funktionen über `(definition, state)`. |
| Marinaras eigener Kampf | `packages/shared/src/features/tactical-combat/` (Tactical-Engine, Rastererzeugung, KI), `combat-director.ts`, `combat-conditions.ts`. |
| Kampf-KI | `packages/shared/src/features/combat-ai.ts`, `combat-minds.ts`; siehe [Kampf-KI im Game Mode](game-combat-ai.md). |
| Server: Regelsätze | `packages/server/src/services/game/ruleset-registry.service.ts` (liest installierte und importierte Regelsätze, löst die Bindung eines Spiels auf), `ruleset-catalog.service.ts`, `ruleset-sheet-turn.service.ts` (wendet die `[sheet:]`-Befehle eines Zugs an), `game-ruleset-version.service.ts`, `routes/game-rulesets.routes.ts`. |
| Server: Proben und Würfel | `skill-check-resolution.service.ts`, `skill-check.service.ts`, `dice.service.ts`, `dice-pool.service.ts`, `one-request-dice.ts`, `dice-rng.ts`. |
| Server: Kämpfe | `combat-director.service.ts` (Classic und Tactical), `combat.service.ts` (die Rundenberechnung für Classic, `resolveCombatRound`), `ruleset-combat-director.service.ts` (ein Kampf, den der Regelsatz auflöst), `combat-ai.service.ts`, `combat-boss.service.ts`, `tactical-battlefield.service.ts`, `made-battlefield.service.ts`. Routen: `routes/combat-director.routes.ts` (Start, Zustand und Befehl des Directors), `routes/encounter.routes.ts` sowie die älteren `POST /game/combat/round`, `/game/combat/tactical/start` und `/game/combat/tactical/action` in `routes/game.routes.ts`. |
| Prompt | `gm-prompts.ts` (`buildGmFormatReminder`, die Charakterbogenblöcke und die vermittelten Tags). |
| Client | `packages/client/src/components/game/`: `GameRulesetSheet.tsx`, `GameSetupRulesChooser.tsx`, `RulesetCombatScreen.tsx` und die übrigen `RulesetCombat*.tsx`, `TacticalCombatUI.tsx`, `GameCombatUI.tsx`, `DirectedCombatUI.tsx`. |

## Ein Regelsatz vom Paket bis ins Spiel

1. **Quelle.** Ein offizieller Regelsatz ist ein Capability-Paket vom Typ `ruleset`, das `ruleset.json` (und gegebenenfalls `catalogs/<id>.json`) in `contributions.assets.paths` aufführt, per Hash in `files[]` festgeschrieben. Ein Community-Regelsatz wird als einzelne Datei, als Paketdatei `<name>.ruleset.json` oder aus dem Ordner `rulesets/` eines Repositorys importiert und unter einer ID mit Namensraum (`local/<id>`, `<owner>/<id>`) gespeichert, sodass er niemals einen offiziellen Regelsatz verdecken kann.
2. **Sprache.** Die Übersetzungen eines offiziellen Regelsatzes liegen in Sprachpaketen vor, die in seinem Katalogeintrag aufgeführt sind; der Paketmanager behält nur die Sprache der Engine (`syncRulesetLocalePack` in `package-manager.service.ts`). Eine importierte Paketdatei behält nur die beim Import aktive Sprache.
3. **Registrierung.** `ruleset-registry.service.ts` liest jede Definition mit dem gemeinsamen Schema ein und verwirft unbrauchbare Definitionen mit einer Protokollzeile. Definitionen werden nach ID und Version gespeichert; dieselbe Version mit abweichenden Bytes wird abgelehnt.
4. **Die Bindung.** Beim Anlegen eines Spiels wird `chat.metadata.gameRuleset` einmal geschrieben: `{ id, version, packageId, source?, options }`, wobei `options` die gewählten Ebenen enthält. Ohne Bindung gelten Marinaras eigene Regeln. Kann diese Installation eine Bindung nicht einhalten (der Regelsatz fehlt oder ist älter als die gebundene Version), wird dies gemeldet und die Proben des Spiels bleiben ausstehend; sie werden niemals nach den Regeln eines anderen Systems aufgelöst.

## Zustand

| Teil | Inhalt | Speicherort | Wird mit Swipes zurückgespult |
| --- | --- | --- | --- |
| Ausgangsaufbau | Der Charakterbogen, den ein Spieler auf einer Karte oder Persona ausfüllt | Karte `data.extensions.rulesetSheets[rulesetId]`, Persona `personaStats.rulesetSheets[rulesetId]` | Nicht zutreffend |
| Spielaufbau | Eine bei der Einrichtung angelegte Kopie, die über **Edit sheet** (Bogen bearbeiten) und Stufenaufstiege bearbeitet wird | `chat.metadata.gameCharacterCards[].rulesetSheet` | Nein |
| Live-Zustand | Pools, Leisten, Zustände, Live-Zustände, Notizen | `game_state_snapshots.ruleset_live` | Ja |
| Ein Kampf | Die Begegnung, ihr Seed und Würfelzeiger, wer am Zug ist | Der Speicherdatensatz des Kampf-Directors, einer je Chat | Wird mit dem Zug wiederhergestellt, der ihn gestartet hat |

Der Live-Zustand gehört zum Snapshot, damit ein neu erzeugter Zug niemals doppelt Ressourcen ausgibt. Ein gespeicherter Charakterbogen hat die Form `{ v, build }`, ist auf 64 KB begrenzt und wird tolerant eingelesen: Unbekannte Felder bleiben erhalten, fehlende übernehmen Standardwerte. Ein Layout, das Werte zu neuen IDs verschiebt, deklariert `sheet.migrations`; diese werden beim Lesen durch `readRulesetSheetEnvelope` und `readStoredLiveState` angewendet. Ein Charakterbogen für einen nicht installierten Regelsatz bleibt ruhend erhalten und wird niemals verworfen.

## Eine Probe von Anfang bis Ende

1. Der Game Master schreibt `[skill_check: …]`, optional mit `who=`, `with=`, dem Namen einer Leiterstufe, einem Charm oder einer Ausgabe. Ist Würfeln mit nur einer Anfrage eingeschaltet, darf er stattdessen einen Zweigblock oder einen Platzhalter `[[roll: …]]` schreiben (`one-request-dice.ts`).
2. `skill-check-resolution.service.ts` liest den gebundenen Regelsatz und wählt anhand von `resolution.kind`: `dice-sum`, `dice-pool`, `dice-highest`, `roll-against` oder `symbol-pool`. Vom Modell geschriebene Zahlen werden geprüft und ersetzt, sofern der Regelsatz nicht für sie bürgt; für Pools, beibehaltene Würfel und in Ergebnisbereiche eingeteilte Resultate wird niemals gebürgt.
3. Würfel: Eine Probe würfelt mit `rollDieSecurely` (Web Crypto, in `packages/shared/src/utils/dice-notation.ts`). Ein Regelsatz-Kampf, seine Gegenstandsnutzungen, Beute und Märkte würfeln mit `seededDieRoller(seed, cursor)` aus demselben Modul, sodass sich ein Kampf aus seinem Seed wiederholen lässt. Seit #8608 gibt es keine andere Würfelfunktion.
4. Das Ergebnis wird als vollständiges Tag und als Würfelkarte zurückgeschrieben und in **Logs** (Protokolle) erfasst.

## Charakterbogenbefehle

Der Game Master ändert einen Charakterbogen mit `[sheet: who="Name" op="…"]`. Die Operationen, die ein Tag angeben darf, sind `spend`, `restore` (Alias `heal`), `damage`, `temp`, `track`, `condition`, `state`, `note`, `rest`, `use` (Alias `cast`), `pass`, `advance`, `dismiss`, `prepare` und `unprepare` (`RULESET_SHEET_OP_NAMES` und `RulesetSheetOp` in `live-state.ts`). `ruleset-sheet-turn.service.ts` prüft jede gegen den Live-Charakterbogen; eine nicht mögliche Operation, etwa das Wirken eines Zaubers ohne verbleibenden Zauberplatz, wird abgelehnt, protokolliert und einmal je Zug angezeigt, und nichts wird teilweise angewendet. `sheet` ist ein reserviertes GM-Tag.

## Ein Kampf von Anfang bis Ende

Ein Kampf im Spiel wird in einem von drei Stilen ausgetragen, abhängig vom Regelsatz und der **Combat Preference** (Kampfpräferenz) des Spiels:

| Regelsatz | Stil | Server |
| --- | --- | --- |
| Keiner oder kein `battle`-/`combat`-Block | Marinaras Classic- oder Tactical-Kampf | `combat-director.service.ts` |
| `battle`-Block | Marinaras Kampf mit den Pools, Zauberplätzen und Katalogfertigkeiten des Charakterbogens; Gesundheit wird als Anteil am Maximum übernommen und zurückgeschrieben | `combat-director.service.ts` mit `combat-bridge.ts` |
| `combat`-Block | Der eigene Kampf des Regelsatzes, auf einem Brett, wenn `combat` die Entfernung eines Feldes angibt und das Spiel Tactical nutzt | `ruleset-combat-director.service.ts` |

Alle drei nutzen das Kampfprotokoll des Directors: einen Speicherdatensatz je Chat, eine Revision, eine Absicherung über Anfrage-IDs und eine Warteschlange je Chat. Das Protokoll erfasst nur Kämpfe, die über den Director laufen. Die älteren Routen in `game.routes.ts`, `POST /game/combat/round` (ruft `resolveCombatRound` für die übermittelten Kampfteilnehmer auf), `/game/combat/tactical/start` und `/game/combat/tactical/action`, führen kein solches Protokoll: Der Client hält den Kampfzustand und sendet ihn bei jedem Aufruf zurück. In einem Regelsatz-Kampf entscheidet das Menü über die Zulässigkeit (`options.ts`), der Auflöser wendet eine Wahl an (`resolve.ts`), die Würfel stammen aus dem Seed und Zeiger des Kampfs, und alles, was ein Gruppenmitglied ausgibt oder verliert, wird nach den eigenen Regeln des Charakterbogens direkt gespeichert, sodass beim Schließen des Tabs mitten im Kampf nichts verloren geht. Nicht eigens verfasste Gegner werden aus dem Bestiarium und dem Begegnungsbudget des Regelsatzes erzeugt; der Game Master darf benannte Gegner und Bosse spielen und dabei aus den nach Rang geordneten Vorschlägen der Engine wählen.

## Einen Regelsatzschlüssel hinzufügen

1. Ergänze ihn mit seinen Gegenprüfungen in `ruleset.schema.ts` und in den TypeScript-Typen, die der Auflöser liest.
2. Erhöhe `supportedCapabilityApi` um eine Minor-Version und ergänze deren Kommentarzeile. Sichere den Schlüssel so ab, dass ein Regelsatz, der ihn nutzt, diese Minor-Version oder eine neuere deklarieren muss.
3. Implementiere ihn zuerst im reinen gemeinsamen Code, binde dann den Server an und danach den Client.
4. Führe `pnpm ruleset:schema` aus, um `docs/extending/ruleset.schema.json` neu zu erzeugen.
5. Dokumentiere ihn auf der passenden Seite der Autorenanleitung (`docs/extending/ruleset-*.md`) und in der Dokumentation für Spieler, falls er für sie sichtbar ist.
6. Ergänze eine Datei `scripts/regressions/*.regression.ts`, die ihn im reinen Code durchläuft und auch eine abgelehnte Eingabe abdeckt.
7. Liste die geänderten englischen Seiten im offenen Issue `[docs-i18n]` auf.

`docs/development/ruleset-5e-2014.example.json` ist ein gekürzter 5e-Entwurf, den Hunderte von Regressionstests und Ende-zu-Ende-Tests als Testvorlage lesen. Es ist nicht das ausgelieferte SRD-Paket; dieses liegt in Marinara-Agents unter `packages/ruleset-5e-2014/`.

## Offene Arbeiten

- Über Hindernisse auf einem Regelsatz-Brett fliegen: Ein Flieger wird wie alle anderen bewegt.
- Beschwörungen in Marinaras eigenem Classic- und Tactical-Kampf (Regelsatz-Kämpfe können bereits beschwören). Der Entwurf steht unter [Kampf-KI im Game Mode](game-combat-ai.md#summoning-design-extension).
- Ein Battlefield Scout Agent, der den Geländeüberblick für einen Kampf vorbereitet, beschrieben unter [Kampf-KI im Game Mode](game-combat-ai.md#encounter-environment-agent-handoff).
