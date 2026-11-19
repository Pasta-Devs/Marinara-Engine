# Audit zur Code-Bereinigung

**Audit-Datum:** 2026-07-22

**Ziel-Branch:** `staging`

**Zweck:** entfernbare Altlasten und eng begrenzte Vereinfachungen finden, ohne das Laufzeitverhalten zu verändern.

**Umsetzungsstand:** Befunde mit hoher Sicherheit und geringem Risiko sind in derselben Bereinigung bereits umgesetzt.

## Ergebnis der Umsetzung

Erledigt:

- die vier nicht erreichbaren Quellmodule, das veraltete Sidecar-Build-Skript, den Test-Runner ohne Tests und die abgearbeiteten Task-Briefings entfernt;
- den Debug-Log-Puffer entfernt, der nur für das nicht erreichbare Debug-Panel existierte – die Diagnose über die Browser-Konsole bleibt erhalten;
- alle 60 vom Compiler nachgewiesenen Befunde zu ungenutztem Code aufgelöst und die Unused-Prüfungen in Client und Server aktiviert;
- 53 ungenutzte Client-Hooks, -Helfer, -Typen und -UI-Deklarationen in domänengroßen Häppchen entfernt;
- die acht verwaisten Abhängigkeiten mit hoher Sicherheit entfernt und Lockfile, Workspace-Install-Prüfung sowie den Text zur Fehlerbehebung nachgezogen;
- `pnpm test` im Wurzelverzeichnis so umgestellt, dass es echte Regressionsprüfungen ausführt statt Erfolg ohne einen einzigen Test zu melden;
- den vorhandenen Storyboard-Keyframe-Selektor wiederverwendet und die doppelte Spotify-Query-Token-Logik zusammengeführt;
- das Umsortieren von Preset-Variablen auf das angeforderte Preset begrenzt – die zuvor ignorierte `presetId` dient jetzt als Integritätsgrenze.

Bewusst behalten für separate Kompatibilitäts- oder Produktarbeit:

- `@rollup/wasm-node`;
- Server-Exporte, die APIs außerhalb des Repos oder Test-Einstiegspunkte sein könnten;
- die Zusammenführung von PNG-Parser und Tutorial-Geometrie;
- die großflächigen Editor-/Composer- und Modul-Refactorings;
- Kompatibilitätsfelder, die für ein künftiges Major-Release vorgesehen sind.

Die ausführlichen Befunde weiter unten bleiben als Beweislage vor der Änderung erhalten. Wo noch Empfehlungsformulierungen stehen, gilt dieses Umsetzungsergebnis.

## Validierung

Die umgesetzte Bereinigung hat die unterstützten Nachweiswege des Repositorys bestanden:

- `pnpm install --frozen-lockfile`
- `pnpm check` (Durchsetzung der Unused-Prüfung, TypeScript, ESLint und Produktions-Builds)
- `pnpm test` (alle Regressionswege plus Browser-Smoke-Tests: 81 bestanden, 51 absichtlich übersprungen)

Nebenbei hat die Browser-Suite vier zustandsabhängige Annahmen in Locators offengelegt, während der generische Test-Befehl ehrlich gemacht wurde. Diese Tests navigieren jetzt explizit, grenzen doppelte Mobil-Bedienelemente ein und adressieren den tatsächlichen Noodle-Timeline-Scroller – ohne dass ihre Produktzusicherungen schwächer werden.

## Zusammenfassung

Das Repository ist groß (1.665 versionierte Dateien und rund 478.000 Zeilen über die untersuchten quellcodenahen Dateitypen), doch die meisten großen Dateien sind aktiver Produktcode und keine offensichtlichen Altlasten. Am sichersten ist eine Reihe kleiner, belegter Entfernungen – kein großflächiges Umschreiben.

Der erste Bereinigungsweg des ursprünglichen Audits fand:

- vier Quellmodule ohne eingehende Referenzen (zusammen 899 Zeilen);
- ein veraltetes Sidecar-Build-Skript (173 Zeilen);
- einen Test-Runner, der erfolgreich meldet, obwohl er null Tests ausführt (54 Zeilen, dazu seine Verdrahtung in den Package-Skripten);
- zwei abgearbeitete Phasen-Task-Briefings im Wurzelverzeichnis (235 Zeilen);
- 60 vom Compiler nachgewiesene ungenutzte Deklarationen, Importe, Parameter und lokale Variablen;
- acht vermutlich verwaiste direkte Abhängigkeiten, vorbehaltlich einer Prüfung mit frischer Installation und frischem Build;
- ein vermutlich ungenutztes statisches Mari-Sprite, vorbehaltlich eines Browser-Smoke-Tests.

Allein die vier nicht erreichbaren Module, das veraltete Skript, der wirkungslose Runner und die Task-Briefings machen 1.361 versionierte Zeilen aus. Trotzdem sollte die Arbeit auf kleine Bereinigungs-PRs verteilt werden, damit jede Löschung einen eng gefassten Nachweis und einen einfachen Rückweg hat.

## Vorgehen beim Audit

Das Audit stützt sich auf mehrere Arten von Belegen:

1. Inventar aller versionierten Dateien, Dateitypen, großen Quellbereiche und größten Dateien.
2. Analyse der TypeScript-Importe und -Exporte über den AST, inklusive relativer Importe und Repository-Aliase.
3. Exakte Symbol- und Dateinamen-Suchen über versionierten Quellcode, Skripte, Dokumentation, Manifeste und Workflows.
4. TypeScript-Compiler-Läufe mit erzwungenem `noUnusedLocals` und `noUnusedParameters` für Client und Server.
5. Suche nach direkten Abhängigkeiten plus gezielte Blicke in die Git-Historie, wo eine Abhängigkeit oder ein Skript nach einem früheren Refactoring gestrandet wirkte.
6. Normalisierter Vergleich von Codefenstern auf Duplikate, gefolgt von manueller Prüfung der umfangreichsten Treffer.
7. Syntaxprüfungen für versionierte JSON-, Python- und Bash-Dateien.

Unten verwendete Sicherheitsstufen:

- **Hoch:** mehrere unabhängige Prüfungen stimmen überein; die Entfernung sollte rein mechanisch sein.
- **Mittel:** aktuell ohne Referenz, aber dynamisches Laden, externe Nutzer oder Produktabsicht könnten trotzdem eine Rolle spielen.
- **Zurückgestellt:** eine berechtigte Vereinfachung, deren Regressionsfläche für einen reinen Aufräum-Durchgang zu breit ist.

Statische Analyse kann nicht beweisen, dass es keine Nachschlagevorgänge über Strings zur Laufzeit, keine Nutzung heruntergeladener Pakete, keine vom Nutzenden angegebenen Pfade und keine externen Konsumenten gibt. Solche Fälle sind ausdrücklich benannt statt als toter Code behandelt.

## 1. Dateientfernungen mit hoher Sicherheit

### 1.1 Nicht erreichbare Quellmodule

| Kandidat | Beleg | Hinweis zur Bereinigung | Nötiger Nachweis |
| --- | --- | --- | --- |
| `packages/client/src/components/agents/AgentDebugPanel.tsx` (296 Zeilen) | Kein eingehender Import, und `AgentDebugPanel` taucht nur an der eigenen Deklaration auf. | Die Komponente entfernen. Danach `debugLog` und `clearDebugLog` im Agent-Store prüfen; sie werden sonst nur von diesem nicht erreichbaren Panel genutzt. `lastResults` nicht entfernen – das braucht `SpriteOverlay`. | `pnpm check`; Agent-Einstellungen bzw. Debug-Modus öffnen und die aktiven Debug-Oberflächen prüfen. |
| `packages/client/src/components/agents/AgentThoughtBubbles.tsx` (113 Zeilen) | Kein eingehender Import, und `AgentThoughtBubbles` taucht nur an der eigenen Deklaration auf. Die aktuelle Oberfläche für Gedankenblasen und Checkliste läuft über `RoleplayHUD` / `RoleplayHUDActionsMenu`. | Die Komponente entfernen, ebenso den veralteten Eintrag in `packages/client/.instructions.md`. | `pnpm check`; `pnpm regression:roleplay`; Roleplay-HUD und Kontinuitäts-Checkliste im Browser prüfen. |
| `packages/client/src/components/panels/GlobalGalleryPanel.tsx` (468 Zeilen) | Kein eingehender Import, keine Routen-Registrierung, keine namensgleiche Referenz. | Nur dieses Panel entfernen. Daraus **nicht** ableiten, dass die gesamte Galerie-Funktion tot ist: `NoodleHome`, Galerie-Hooks, Server-Routen und Speicher haben weiterhin aktive Referenzen. | `pnpm check`; `pnpm smoke:ui`; Bild-Upload und Galerie in Noodle manuell prüfen. |
| `packages/shared/src/features/turn-games/engine-utils.ts` (22 Zeilen) | Keine Importe, kein Barrel-Export, und alle vier exportierten Symbole kommen nur in dieser Datei vor. | Die Datei löschen. | `pnpm check`; `pnpm regression`. |

### 1.2 Veraltetes Sidecar-Build-Skript

`scripts/build-sidecar-runtime.mjs` wird von keinem Package-Skript, Workflow, Dokument oder Quellcode referenziert. Es ruft `pnpm exec node-llama-cpp` auf, doch `node-llama-cpp` ist keine Workspace-Abhängigkeit mehr. Die Git-Historie verbindet das Skript mit dem früheren Build-Pfad des lokalen Gemma-Sidecars.

**Empfehlung (hohe Sicherheit):** das Skript löschen. Vorher noch einmal außerhalb des Repositorys nach Release-Artefakten suchen, falls eine Installer-Pipeline extern konfiguriert ist.

### 1.3 Abgearbeitete Umsetzungs-Briefings im Wurzelverzeichnis

`MARI_PHASE2_TASK.md` und `MARI_PHASE3_TASK.md` sind branch-bezogene Umsetzungsanweisungen für Arbeit, die inzwischen im Code steckt. Nichts im Repository verweist auf sie, und dauerhafte Dokumentation für Nutzende oder Beitragende sind sie nicht.

**Empfehlung (hohe Sicherheit):** beide aus dem Arbeitsbaum entfernen. Ihre Historie bleibt in Git verfügbar. Falls eine Begründung darin noch wertvoll ist, gehört nur diese Begründung ins passende Architekturdokument – nicht die Aufgabenanweisungen.

### 1.4 Irreführender Test-Runner ohne Tests

`packages/server/scripts/run-tests.mjs` zielt auf drei `.test.ts`-Globs, aber in keinem der Zielordner liegt eine Testdatei. Sowohl `pnpm --filter @marinara-engine/server test` als auch `pnpm test` im Wurzelverzeichnis enden erfolgreich – mit null Tests und null Suites. Die früheren Tests wurden absichtlich entfernt, und die Repository-Regeln verbieten es, `.test.ts`-Dateien zu behalten.

Das ist gefährlicher als gewöhnlicher toter Code, denn ein grünes `pnpm test` suggeriert derzeit eine Testabdeckung, die es nicht gibt.

**Empfehlung (hohe Sicherheit):**

1. Den Server-Runner und das `test`-Skript des Servers entfernen.
2. Die Layout-Prüfung des Windows-Installers behalten, ihr bei Bedarf aber einen eigenen, ehrlichen Skriptnamen geben.
3. Das `test`-Skript im Wurzelverzeichnis so neu definieren, dass es eine bewusst gewählte Auswahl an Regressions- und Smoke-Tests ausführt – oder den generischen Alias streichen und `pnpm check`, `pnpm regression:*` sowie `pnpm smoke:ui` als die tatsächlichen Nachweisbefehle dokumentieren.
4. Sicherstellen, dass die CI nicht allein aufgrund eines Laufs ohne Tests „tests passed“ melden kann.

## 2. Bereinigung der Abhängigkeiten

Diese direkten Abhängigkeiten haben aktuell keinen Import, keine Registrierung, keine Konfiguration und keine String-Referenz zur Laufzeit außerhalb von Manifesten und Lockfile, sofern nicht anders vermerkt.

| Workspace | Abhängigkeit | Sicherheit und Beleg |
| --- | --- | --- |
| client | `class-variance-authority` | **Hoch.** Keine Nutzung in Quellcode oder Konfiguration. Auch eine frühere Aufräumaktion behandelte das Paket bereits als ungenutzt. |
| client | `autoprefixer` | **Hoch, mit Build-Nachweis.** Keine PostCSS-Konfiguration, kein Import; der Client nutzt das Tailwind-Vite-Plugin. |
| server | `@earendil-works/pi-ai` | **Hoch.** Die Laufzeit von Professor Mari wurde von der Pi-Abhängigkeit weg umgebaut. Die Repository-Historie hält ausdrücklich fest, dass das Paket bereits nicht mehr importiert und für eine spätere Bereinigung liegen gelassen wurde. |
| server | `@fastify/websocket` | **Hoch.** Keine Plugin-Registrierung, keine WebSocket-Route, kein Import. |
| server | `png-chunk-text` | **Hoch.** Kein Import. Die PNG-Metadaten werden derzeit direkt verarbeitet. |
| server | `png-chunks-encode` | **Hoch.** Kein Import. |
| server | `png-chunks-extract` | **Hoch.** Kein Import. |
| shared | `chess.js` | **Hoch, mit Kompatibilitätsnachweis.** Kein aktueller Import im Quellcode. Die eingebaute Schachfunktion wurde in optionale Pakete ausgelagert. Beim Entfernen müssen außerdem der Eintrag in `scripts/check-workspace-install.mjs` gelöscht und der veraltete Hinweis zu fehlendem `chess.js` in der Fehlerbehebung aktualisiert werden. |

Auch `@rollup/wasm-node` im Client hat keine Referenz, könnte aber ein umgebungsspezifischer Rollup-Fallback sein. Einstufung deshalb **mittlere Sicherheit**: erst Packaging- und CI-Historie prüfen und Builds auf allen unterstützten Plattformen nachweisen, dann entfernen.

Abhängigkeiten wie `workbox-window`, `pino-pretty`, `esbuild` im Wurzelverzeichnis, Typ-Pakete oder reine CLI-Werkzeuge dürfen nicht allein anhand des Importtexts als ungenutzt gelten. Sie werden von generierten Modulen, string-basierter Transport-Konfiguration, Build-Skripten oder Package-Skripten verwendet.

Für den Abhängigkeits-PR gilt: `pnpm-lock.yaml` aktualisieren, aus einem sauberen Zustand installieren und den vollständigen Build- und Prüfweg durchlaufen. Ein Paket aus einem bereits gefüllten `node_modules`-Baum zu entfernen, ist kein ausreichender Nachweis.

## 3. Vom Compiler nachgewiesener ungenutzter Code

Mit erzwungenen TypeScript-Unused-Prüfungen entstanden **57 Server-Diagnosen** und **3 Client-Diagnosen**. Das wiegt schwerer als reine Textsuche-Kandidaten. Meist geht es um Importe oder lokale Variablen, die sich mechanisch entfernen lassen; bei Callback-Parametern und Parametern öffentlicher Methoden gehören vorher die Aufrufsignaturen geprüft.

### 3.1 Client

- `ChatSettingsDrawer.tsx`: ungenutzter Filterparameter `subject`.
- `GameCombatUI.tsx`: ungenutzter Map-Parameter `line`.
- `hooks/use-encounter.ts`: ungenutztes `_res`; die Anfrage abwarten, ohne sie zuzuweisen.

### 3.2 Server

- `db/file-backed-store.ts`: ungenutztes `TABLES_REVERSE`; ungenutztes Instanzfeld `loadedManifest` samt Zuweisung.
- Importe und lokale Variablen in Routen: `backup.routes.ts` (`dirname`), `sprites.routes.ts` (`readdir`), `scene.routes.ts` (`gsStorage`), `noodle.routes.ts` (`extractNoodleMentionHandles`, `NoodleInteractionType`) und `generate/dry-run-route.ts` (`lorebooksStore`).
- Ungenutzte Callback-Parameter in Routen: `game-assets.routes.ts`, `lorebooks.routes.ts`, `sprites.routes.ts` und `youtube.routes.ts` (`reply`). Nur dann in `_reply` umbenennen, wenn die Position in der Fastify-Signatur erhalten bleiben muss.
- `game.routes.ts`: `GmPromptContext`, `formatMoraleContext` und `sceneSpotifyTrackCandidateSchema`.
- `generate.routes.ts`: `readFileSync`, `LIMITS`, `AgentPhase`, `CharacterStat`, `GameState`, `createLLMProvider`, `formatZonedConversationDate`, `formatZonedConversationTime`, `chatsTable`, `normalizeCustomEmojiSelection`, `embedMemoryRecallTexts`, `latestHistoryUserContent`, `getActiveTurnGame`, `startTurnGame`, `pruneEmptyPromptWrappers`, `areConversationSchedulesEnabled`, `addEventEntry`, `normalizeAgentMaxTokens`, `resolveAgentRunInterval` sowie die lokale Variable `chatParams`.
- `generate/dry-run-route.ts`: die tote lokale Hilfsfunktion `wrapperMessages`.
- `services/agents/agent-executor.ts`: ungenutzter Parameter `agentType` in `sanitizeTextAgentResponse`; beim Entfernen die internen Aufrufer anpassen.
- `services/agents/agent-pipeline.ts`: ungenutztes `AgentPhase`.
- `services/conversation/schedule.service.ts`: ungenutztes `createLLMProvider` und `ConversationStatusOverride`.
- `services/game/perception.service.ts`: ungenutztes `RPGAttributes`.
- `services/generation/conversation-react-command-runtime.ts`: ungenutzter Hilfsparameter `command`.
- `services/import/st-bulk.importer.ts`: ungenutztes `personasTable`.
- `services/lorebook/keyword-scanner.ts`: ungenutztes destrukturiertes `currentMessageIndex`; vor dem Entfernen die interne Form der Optionen prüfen.
- `services/lorebook/prompt-injector.ts`: ungenutztes `LorebookEntry`.
- `services/mari-db/mari-db.service.ts`: tote Hilfsfunktion `makeEmptyValidation`.
- `services/prompt/assembler.ts`: ungenutztes `PromptPreset`, `PromptSection`, `PromptGroup`, `groupOrder` und `chatHistoryEndIdx`.
- `services/sidecar/scene-analyzer.ts`: tote Hilfsfunktionen `widgetUpdateHint` und `widgetStateSummary`.
- `services/sidecar/scene-postprocess.ts`: tote Hilfsfunktion `normalizeExpression`.
- `services/sidecar/sidecar-process.service.ts`: `lastReadyAt` wird zugewiesen, aber nie gelesen.
- `services/storage/noodle.storage.ts`: ungenutztes `NoodlerStageProfile`.
- `services/storage/prompts.storage.ts`: ungenutzter Parameter `presetId` in `reorderVariables`; vor einer Signaturänderung Aufrufer und Sortierlogik des Speichers prüfen.

Sobald diese Liste abgearbeitet ist, `noUnusedLocals` und `noUnusedParameters` in den TypeScript-Konfigurationen von Server und Client aktivieren. Damit wird aus dem einmaligen Durchgang eine dauerhaft gepflegte Zusicherung. Callback-Parameter, die zwingend nötig sind, lieber mit `_` präfixen, als die Regel erneut global abzuschalten.

## 4. Interne Exporte ohne Nutzer im Repository

Exportierte Deklarationen entgehen den üblichen Unused-Prüfungen, deshalb suchte ein zweiter Durchgang nach Namen, die nur an ihrer Deklaration vorkommen. Der Client ist eine Anwendung und keine öffentliche Bibliothek – das macht diese Fundstellen zu brauchbaren Kandidaten für die Entfernung. In domänengroßen Häppchen löschen und den Compiler die zugehörigen privaten Helfer und Importe aufdecken lassen.

### 4.1 Client-Hooks und -Helfer

- Agent-Hooks: `useAgentConfig`, `useUpdateAgentByType`, `useToggleAgent`.
- Charakter-Hooks: `useUpdatePersonaGalleryClipTrim`, `useCharacterGroup`.
- Chat- und Ordner-Hooks: `useReorderChats`, `useActiveChatPreset`, `useCreateChatPreset`, `useTouchChat`, `useMarkAutonomousUnread`, `useBulkSetMessagesHiddenFromAI`, `useSwipes`, `useMoveConnection`.
- Game-Hooks: `useRegeneratePartyCard`, `useUpdateGameMapBinding`, `useCombatLoot`, `useLootGenerate`, `useGameJournal`, `useGameCheckpoints`, `useCreateCheckpoint`, `useLoadCheckpoint`, `useDeleteCheckpoint`.
- Haptik-Hooks: `useHapticStopScan`, `useHapticCommand`, `useHapticStopAll`.
- Lorebook-Hooks: `useLorebookEntry`, `useBulkCreateEntries`, `useSearchLorebookEntries`.
- Weitere Hooks: `useCustomTool`, `useUpdateNoodleAccount`, `usePreset`, `useCreatePreset`, `usePresetGroups`, `useReorderGroups`, `usePresetSections`, `usePresetVariables`, `usePreviewPreset`, `useRegexScript`, `useUpdateSpatialContext`.
- UI-Deklarationen: `parseQteTag`, `NoodlerNotificationItem`, `LabelWithHelp`, `RESOURCE_PANEL_SORT_OPTIONS` und `SyncedSettings`.
- Bibliotheks-Helfer: `isManagedChatBackgroundUrl`, `isBrowserSpeechRecognitionSupported`, `requestTurnGameBotGeneration`, `resolveInputMacrosForChat`, `createCustomToolFolderPackageFilename`, `resolveCurrentGameSessionChatId`, `readTextFileFromZip` und `buildTTSMessageText`.

Ein ungenutzter Client-Hook beweist **nicht**, dass sein Server-Endpunkt ungenutzt ist. Erst den Hook entfernen; Routen separat gegen Oberfläche, Capability-Pakete und externe API-Kompatibilität prüfen.

### 4.2 Server-Kandidaten mit offener API- oder Test-Einstiegs-Entscheidung

Auch die folgenden exportierten Server-Deklarationen haben keinen Nutzer im Repository. Die meisten wirken intern, doch exportierte Test-Einstiegspunkte und Helfer können von Werkzeugen außerhalb des Repos verwendet werden. Die Sicherheit bleibt mittel, bis die Maintainer bestätigen, dass es sich um keine unterstützten APIs handelt:

- Laufzeit und Basic Auth: `getServerRoot`, `getSpotifyRedirectUri`, `isAutoOpenBrowserDisabled`, `hasBasicAuthConfigured`;
- Test-Einstiegspunkte: `resetRateLimitBucketsForTests`, `buildKnowledgeRetrievalAgentMessagesForTest`, `splitRuntimeHandledAgentInjectionsForTest`, `__setSdkForTesting`;
- Helfer für Generierung und Prompts: `normalizeSecretPlotSceneDirections`, `buildUserMessageRegenerationPrompt`, `buildUserMessageRegenerationSourceMessage`, `wrapFields`, `mergeTruncation`, `modelAccessOptions`, `isStandaloneCharacterProfileBlock`, `resolveChatSummaryPromptFromMetadata`;
- Game-Helfer: `buildNpcPortraitImagePrompt`, `buildBackgroundImagePrompt`, `buildSceneIllustrationImagePrompt`, `buildSessionSummaryPrompt`, `buildCardAdjustmentPrompt`, `moraleDiceModifier`, `buildNpcRelationshipSummary`, `buildSessionCarryoverContext`, `getTurnGameContextText`;
- Lorebook-Helfer: `enforceMaxActivatedEntries`, `applyPerLorebookTokenBudgets`, `resolveActivatedLorebookEntryContent`, `resolveBudgetAndRecursivelyActivateLorebookEntries`, `recursiveScan`;
- Hilfsfunktionen und Typen: `AgentPipelineResult`, `resolveVideoRequestDuration`, `newTimeSortableId`, `parseBoolean`, `sanitizePathFilename`.

Den Test „kommt nur einmal im Text vor“ nicht pauschal auf `packages/shared` anwenden: Die dortigen Exporte sind Kompatibilitätsverträge für Client, Server und herunterladbare Agent-Pakete – inklusive Nutzern außerhalb dieses Repositorys.

## 5. Kandidat unter den statischen Assets

`packages/client/public/sprites/mari/Mari_point_down_left.png`, das einzige mitgelieferte Mari-Sprite, dessen Dateiname und Pfad nirgends im Repository auftauchten, wurde im Arbeitsschritt omnibar slice 38a entfernt.

Mitgelieferte Game-Assets nicht anhand von Dateinamen-Suchen ausdünnen. Server-Seeder und Manifeste durchsuchen manche Asset-Ordner dynamisch.

## 6. Eng begrenzte Vereinfachungen

Hier geht es um bessere Wartbarkeit, nicht um das Löschen von totem Code. Jede Änderung muss das Verhalten exakt erhalten und einen gezielten Regressionsnachweis mitbringen.

### 6.1 Exakt oder nahezu exakt doppelte Fachlogik

1. **Auswahl des Storyboard-Keyframes – geringes Risiko.** `GameSurface.tsx` enthält eine lokale Implementierung `findStoryboardKeyframeForSegment`, die dem exportierten `findReplayStoryboardKeyframe` in `lib/game-session-replay.ts` entspricht. Den Bibliotheks-Helfer wiederverwenden und die lokale Kopie entfernen.
2. **Normalisierung der Spotify-Suche – geringes bis mittleres Risiko.** `SPOTIFY_STOP_WORDS`, `SPOTIFY_MOOD_EXPANSIONS` und der Erweiterungsablauf liegen doppelt in `game-spotify-music.service.ts` und `tool-executor.ts`. Einen kleinen Helfer für Spotify-Query-Tokens herauslösen, damit die beiden Pfade nicht auseinanderlaufen.
3. **Auslesen der PNG-Charakterkarten-Metadaten – mittleres Risiko.** `extractCharaFromPng` ist in `import.routes.ts` und `st-bulk.importer.ts` unabhängig voneinander implementiert. Eine gemeinsame Server-Hilfsfunktion herauslösen und mit Regressions-Fixtures normale Text-Chunks, internationale Text-Chunks, Base64- und Roh-Payloads, V2-/V3-Karten sowie defekte PNGs nachweisen.
4. **Geometrie der Tutorial-Tooltips – mittleres Risiko.** `GameTutorial.tsx` und `OnboardingTutorial.tsx` enthalten dieselbe Logik für Kollision und Platzierung. Nur die gemeinsame Geometrieberechnung herauslösen; die mobil- und produktspezifischen Regeln jedes Tutorials als explizite Optionen belassen.
5. **Normalisierung bearbeiteter Spielsegmente in Client und Server – mittleres bis hohes Risiko.** Die reine Normalisierung ähnelt sich auf beiden Seiten. Nur ein wirklich laufzeitneutrales Schema bzw. einen Normalisierer nach shared verschieben; Parsing und Persistenz bleiben Sache des Servers.

### 6.2 Große, wiederholte UI-Bereiche: großflächige Zusammenführung zurückstellen

- `CharacterEditor.tsx` und `PersonaEditor.tsx` enthalten einen umfangreichen, doppelten Ablauf zur Sprite-Verwaltung.
- `ChatInput.tsx` und `ConversationInput.tsx` wiederholen das Verhalten von Guided Plan und Eingabefeld.

Eine Zusammenführung würde sich lohnen, aber ein Paar komplett zu verschmelzen erzeugt eine große Regressionsfläche. Besser einen zusammenhängenden Hook bzw. eine Komponente nach der anderen herauslösen – bei den Editoren zuerst die Sprite-Verwaltung, bei den Eingabefeldern zuerst das Guided-Plan-Verhalten – und nach jeder Extraktion beide Aufrufer im Browser testen.

### 6.3 Aktive Komplexitäts-Brennpunkte

Die größten aktiven Module sind `server/routes/game.routes.ts`, `client/components/game/GameSurface.tsx`, `client/features/chat-settings/ChatSettingsDrawer.tsx`, `server/routes/generate.routes.ts` und `client/components/panels/SettingsPanel.tsx`. Löschkandidaten sind sie nicht. Weiterhin gilt: eng begrenzte Routen-Handler, Domänen-Services, Panel-Abschnitte und reine Hilfsfunktionen nur dann herauslösen, wenn die betroffene Funktion ohnehin gerade geändert wird. Ein eigener PR nach dem Motto „alles aufteilen“ brächte viel Bewegung ohne verlässlichen Verhaltensnachweis. Das Chat-Einstellungen-Panel war die Ausnahme. Es wurde abschnittsweise aufgeteilt, ein Abschnitt pro PR (#9119). Die Regeln für seinen Ordner stehen in `packages/client/.instructions.md` in Abschnitt Chat Settings.

## 7. Bewusst von der Bereinigung ausgenommen

- Kompatibilitätsfelder, die ausdrücklich für die gesamte 2.x-Linie zugesagt sind, darunter die Kompatibilitätsformen für Bildstil, Spielzustand, Text to Speech (TTS), Persona-Tracker und Conversation-Kontext. Diese nur über eine versionierte Migration im nächsten Major-Release entfernen.
- Generierte Capability-Registries und Manifeste. Über ihre Skripte neu erzeugen, nicht von Hand ausdünnen.
- Code herunterladbarer Agent-Pakete wie Illustrator, Music DJ oder Lorebook Keeper. Aufräumarbeiten an Laufzeit und Prompts der Agenten gehören nach `Pasta-Devs/Marinara-Agents`; hier gehört nur die Anbindung an den Host hin.
- Home-Assistant-Module unter `custom_components`, deren Erkennung über Konventionen und Manifeste läuft.
- `MarinaraLauncher.exe`, das vom Migrationscode für Taskleisten-Verknüpfungen genutzt wird.
- `start-local.bat`: von keinem Package-Skript referenziert, aber plausibel als lokaler Starter für Menschen. Erst nach Rückfrage bei den Maintainern entfernen.
- Schema-Deklarationen, die ohne Referenz aussehen, aber bei der Modul-Initialisierung oder Tabellen-Registrierung ausgeführt werden.
- Server-Routen allein deshalb, weil ein bequemer React-Hook ungenutzt ist; herunterladbare Pakete oder API-Nutzer könnten sie trotzdem aufrufen.

## 8. Empfohlene Reihenfolge der Bereinigung

Die Arbeit soll einfach und prüfbar bleiben:

1. **PR A – Altlasten:** die vier nicht erreichbaren Module, den veralteten Eintrag in der Komponenten-Dokumentation, das obsolete Sidecar-Skript, die abgearbeiteten Task-Briefings und – nach manueller Bestätigung – das ungenutzte Mari-Sprite entfernen.
2. **PR B – ehrliche Testfläche:** den Test-Runner ohne Tests entfernen und die Package-Skripte so umbenennen bzw. neu definieren, dass erfolgreiche Befehle für echte Prüfungen stehen.
3. **PR C – Compiler-Bereinigung:** die 60 TypeScript-Diagnosen auflösen, danach die Unused-Prüfungen in den Konfigurationen von Client und Server aktivieren.
4. **PR D – Abhängigkeiten:** die acht Pakete mit hoher Sicherheit entfernen, Workspace-Install-Prüfung und Fehlerbehebungstext nachziehen, das Lockfile neu erzeugen und eine saubere Installation samt Build nachweisen.
5. **PR E und folgende – Domänen-Häppchen:** ungenutzte Client-Exporte nach Domäne entfernen, danach die risikoarmen doppelten Helfer einzeln angehen.

Entfernung von Abhängigkeiten, großflächiges UI-Refactoring und Zerlegung von Routen nicht in einem einzigen Bereinigungs-PR zusammenwerfen.

## 9. Nachweismatrix

Zu jeder Änderung den passenden Nachweis führen:

- Jede Code-Bereinigung: `pnpm check`.
- Shared- oder breite Server-Änderungen: zuerst `pnpm regression` oder das engere `pnpm regression:<domain>`, vor dem Merge dann der vollständige Durchlauf.
- Bereinigung von UI-Komponenten oder Hooks: `pnpm smoke:ui` plus manuelle Prüfung des betroffenen Ablaufs im Browser.
- Prompt-, Agent- oder Roleplay-Pfade: `pnpm regression:prompt` und/oder `pnpm regression:roleplay`.
- Bereinigung von Abhängigkeiten: saubere bzw. eingefrorene Installation, `pnpm check`, Produktions-Builds und CI auf den unterstützten Plattformen.
- Zusammenführung des PNG-Imports: direkte Import-Regressionen für gültige und defekte Charakterkarten.
- Release- und Versionsdateien, falls unerwartet berührt: `pnpm version:check` und `pnpm credits:check`.

Vor dieser Bereinigung taugte das Ergebnis des generischen `pnpm test` nicht als Testnachweis, weil der Befehl erfolgreich endete, ohne Tests auszuführen.

## 10. Validierung und Grenzen des Audits

Während dieses Audits gilt:

- alle versionierten JSON-Dateien ließen sich fehlerfrei parsen;
- alle 12 versionierten Python-Dateien ließen sich mit dem AST-Parser von Python fehlerfrei parsen;
- `start.sh`, `start-termux.sh` und `android/build-apk.sh` bestanden `bash -n`;
- die TypeScript-Unused-Läufe ergaben die oben dokumentierten 57 Server- und 3 Client-Befunde;
- die Test-Befehle von Server und Wurzelverzeichnis wurden direkt dabei beobachtet, wie sie mit null Tests erfolgreich endeten.

ShellCheck und PowerShell waren nicht installiert, deshalb fanden weder semantisches Linting der Shell-Skripte noch das Parsen der PowerShell- und Windows-Skripte statt. Android- und Home-Assistant-Ziele wurden strukturell geprüft, in diesem Audit aber nicht vollständig gebaut. Diese Plattformprüfungen gehören in die Bereinigungs-PRs, die ihre Dateien anfassen.
