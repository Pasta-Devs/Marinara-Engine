# Architektur-Übersicht (für Entwickler)

Diese Anleitung richtet sich an Mitwirkende am Code. Sie beschreibt den Aufbau der Codebasis von Marinara Engine: gemeinsame Grundlagen, Feature-Systeme, Zuständigkeiten der Modi und den richtigen Platz für jedes Stück Code. Außerdem listet sie die aktuell größten Dateien und die Richtung für künftige Refactorings.

Umfang: `packages/client/src`, `packages/server/src` und `packages/shared/src`. Eine klassische `.test.ts`-Suite gibt es im Repo nicht. Für die automatische Validierung sorgen versionierte Regressionsskripte und Playwright-Smoke-Tests; temporäre `.test.ts`-Belegdateien stehen in der `.gitignore` und werden nach Gebrauch gelöscht.

Datei-, Zeilen- und Routenzahlen verschieben sich mit jeder Änderung am Repo. Diese Übersicht nennt ungefähre Größenordnungen und Namen. Für exakte Zahlen schau immer in den aktuellen Stand des Baums.

## Abschnittscodes

Nutze diese Codes, wenn du Verschiebungen planst, Issues beschriftest oder einen kurzen Dateikopf in Code schreibst, der sich noch nicht verschieben lässt.

| Code | Bedeutung | Primärer Ort |
| --- | --- | --- |
| `CORE-CONTRACT` | Typen, Schemas, Konstanten und reine Helfer, die Client und Server gemeinsam nutzen | `packages/shared/src` |
| `CLIENT-APP` | Bootstrap der React-App, Layout-Hülle, globale UI-Verdrahtung | `packages/client/src/App.tsx`, `main.tsx`, `components/layout` |
| `CLIENT-SHARED` | UI-Bausteine nur für den Client, allgemeine Hooks, allgemeine Browser-Helfer, globale Stores | `packages/client/src/components/ui`, `hooks`, `lib`, `stores` |
| `SERVER-APP` | Bootstrap der Fastify-App, Middleware, Routen-Registrierung, Laufzeitkonfiguration | `packages/server/src/app.ts`, `index.ts`, `middleware`, `config` |
| `SERVER-SHARED` | Grundlagen nur für den Server: Storage, DB, LLM, Prompt, Lorebook, Import, Integrationen | `packages/server/src/services`, `db`, `utils`, `lib` |
| `MODE-CONVERSATION` | UI und Serververhalten ausschließlich für Conversation | Conversation-Komponenten, `/api/conversation`, Conversation-Services |
| `MODE-ROLEPLAY` | Roleplay-UI, Szenen, Sprites, Helfer für Begegnungen | Roleplay-Chat-Komponenten, `/api/scene`, `/api/encounter`, `/api/sprites` |
| `MODE-GAME` | Game-Mode-UI, GM-Prompts, Würfel, Party, Karte, Kampf, Assets, Sitzungen | `components/game`, `/api/game`, Game-Services |
| `FEATURE-AGENTS` | Agent-Definitionen, Ausführung, Debug-Zustand, Wissens-Routing | Agent-Komponenten, Agent-Store, Agent-Routen/-Services |
| `FEATURE-ASSETS` | Hintergründe, Avatare, Galerie, generierte Bilder, Sprites, Game-Assets | Asset-Routen, Galerie-Speicher, Bild-Services |
| `FEATURE-SIDECAR` | Laufzeit lokaler Modelle, Szenenanalyse, Downloads, Prozesssteuerung | Sidecar-Store, `/api/sidecar`, Sidecar-Services |
| `FEATURE-TTS` | TTS-Konfiguration, Stimmen-Routing, Cache-Keys, Audiowiedergabe | TTS-Einstellungen/-Hooks/-Routen/-Services |
| `FEATURE-IMPORT` | Importer für SillyTavern und Marinara sowie Migrationshelfer | Import-Routen/-Services |
| `TEST` | Versionierte Regressions- und Browser-Smoke-Tests, bei Bedarf zusätzlich temporäre Belegtests | `scripts/regressions`, `e2e` und temporäre Dateien unter `packages/server/src/**/__tests__/`, die nach Gebrauch verschwinden |

Am besten verrät schon der Pfad den Abschnitt. Ein Kommentar wie `// Section: MODE-GAME` hilft nur so lange, wie eine Datei noch in einem gemischten Ordner liegt.

## Paketgrenzen

### packages/shared

`CORE-CONTRACT`. Dieses Paket bleibt bewusst laufzeitunabhängig.

Aktueller Inhalt:

- `types`: Chat, Charakter, Game, Spielzustand, Kampf, Szene, Sidecar, TTS, Agenten, Prompts, Lorebooks, Exporte, Themes.
- `schemas`: Zod-Schemas für persistierte und gemeinsam genutzte Entitäten.
- `constants`: Anbieter, Standardwerte, Chat-Modi, Modelllisten, Agent-Prompts.
- `utils`: reine Helfer, etwa für Makro-Expansion, XML-Wrapping und Musikbewertung.
- `features`: Agent-Manifeste und -Registry, Function-Call-Definitionen, Ordner-Pakete, die Engines der Zug-Spiele UNO, Chess und Poker, die Game Mode-Regelsätze und ihr Kampf (`rulesets`, `ruleset-combat`, `tactical-combat` und die `combat-*`-Dateien) sowie in `world` der Weltgenerator mit seinen Share-Dateien (Setting-Kits, Welten, Tile-, Board- und Kreaturenpakete).

Regeln:

- Kein React, kein DOM, kein Fastify, kein Server-Storage, kein Dateisystem, kein Netzwerk, keine Anbieter-SDKs.
- Code kommt nur hierher, wenn Client und Server denselben Vertrag oder denselben reinen Algorithmus brauchen.
- `shared` ist keine Abstellkammer für Helfer, die nur der Client nutzt.

### packages/client

React 19 und Vite-PWA. Aktuell sind es mehrere hundert Quelldateien.

Aktueller Aufbau der obersten Ebene:

- `App.tsx`, `main.tsx`: App-Bootstrap, React Query, PWA, globale Effekte.
- `components/layout`: App-Hülle, Seitenleisten, obere Leiste, Modal-Renderer.
- `components/ui`: wiederverwendbare UI-Bausteine.
- `components/chat`: gemischt – allgemeine Chat-, Conversation-, Roleplay-, Szenen-, Sprite- und Begegnungs-UI.
- `components/game`: Oberfläche und Panels des Game Mode.
- `components/panels`, `components/modals`, Entitäts-Editoren: Einstellungen und Ressourcenverwaltung.
- `features`: herausgelöste Feature-Module, derzeit die Abschnitte der Chat-Einstellungen, Teile des Tracker-Panels, der Mehrspielermodus sowie Vertrag, Einrichtung, Bühne und Renderer der Avatar-Agenten (`features/avatars`).
- `hooks`: React-Query-Hooks und Laufzeit-Hooks für die meisten API-Features.
- `lib`: Browser- und Client-Helfer. Hier mischen sich aktuell allgemeine Helfer mit modusspezifischen Game-Helfern.
- `stores`: Zustand-Stores für UI, Chat-Laufzeit, Agenten, Spielzustand, Game Mode, Assets, Sidecar, Übersetzung, Galerie, Begegnungen und die Zug-Spiele.
- `styles`: globales Stylesheet und Theme-spezifisches CSS.

Wichtige Überschneidungen im aktuellen Stand:

- `components/game` importiert aus `components/chat` gemeinsam genutzte visuelle Teile wie Wettereffekte und Galerie-Panels.
- `components/chat` importiert Spielzustand und Begegnungszustand für Roleplay-Features.
- `hooks/use-generate.ts` fasst Chat-Zustand, Agent-Zustand, Spielzustand, Game-Mode-Zustand, Übersetzungszustand und UI-Einstellungen an.
- Die Helfer `lib/game-*` gehören allein zum Game Mode, liegen aber neben den globalen Helfern.

### packages/server

Fastify-API, dateinativer Speicher und Anbieter-Integrationen. Aktuell sind es mehrere hundert Quelldateien.

Aktueller Aufbau der obersten Ebene:

- `app.ts`, `index.ts`: App-Factory, Bootstrap, statische Auslieferung, Hydration des Dateispeichers und Seeder.
- `routes`: viele Routen-Dateien. Die meisten sind schlanke CRUD-APIs, `generate.routes.ts` und `game.routes.ts` dagegen große Orchestrierungs-Dateien. Im Ordner `routes/generate/` liegen die bisher aus dem Generierungspfad herausgelösten Teile, darunter die Token-Ausgabekette (`generation-stream-output.ts`), die Tool-Aufrufrunden (`tool-rounds.ts`), das Parsen von Antwortbefehlen und die Textbereinigung sowie das Speichern der Antwort (`save-generated-reply.ts`).
- `services/storage`: Storage-Fassade für Chats, Charaktere, Prompts, Lorebooks, Einstellungen, Assets, Themes und Spielzustand.
- `services/llm`: Anbieter-Registry, Basisvertrag für Anbieter, OpenAI-kompatible Anbieter, Brücke zum lokalen Sidecar.
- `services/prompt`: gemeinsame Prompt-Zusammenstellung für die Generierung außerhalb des Game Mode.
- `services/conversation`: Zeitpläne, autonome Nachrichten, Awareness, Conversation-Profile, Verarbeitung von Conversation-Befehlen.
- `services/game`: GM-Prompts, Würfel, Kampf, Zustandsautomat, Party-Prompts, Karten, Wetter, Zeit, Sitzungen, Checkpoints, Reputation, Assets.
- `services/sidecar`: lokale Laufzeit, Modellverwaltung, Szenenanalyse, Nachbearbeitung von Szenen.
- `services/agents`: Ausführung von Agenten und Wissens-Routing.
- Feature-Grundlagen: `services/import`, `services/lorebook`, `services/image`, `services/haptic`, `services/tools`, `services/regex`, `services/professor-mari`, `services/mari-db`, `services/turn-games`, `services/spotify`, `services/video`, `services/generation`, `services/chat-summary`, `services/achievements`, `services/prompt-overrides`, `services/setup`, `services/noodle`, `services/memory-recall`, `services/avatars` (Speicherung und Generierung der Avatar-Modelle sowie der Emotionsklassifikator für die Avatar-Agenten), `speech-to-text.service.ts` und `discord-webhook.ts`.
- `db/schema`: Definitionen der Dateitabellen für die Daten unter `DATA_DIR/storage`.
- `db/file-schema.ts`, `db/file-query.ts`: native Tabellen-Metadaten und Abfrageausdrücke.
- `db/file-backed-store.ts`: In-Memory-Tabellenspeicher, Transaktionsgrenze, Wiederherstellung nach Abstürzen und Persistenz per JSON-Snapshot. Siehe [Dateinativer Speicher (für Entwickler)](file-storage.md).

Wichtige Überschneidungen im aktuellen Stand:

- Routen importieren Storage-, LLM-, Prompt-, Lorebook-, Game-, Sidecar- und Feature-Services direkt.
- `generate.routes.ts` bedient den Hauptpfad der Generierung für Conversation und Roleplay und dazu die Agent-Pipeline.
- `game.routes.ts` steuert die Game-Orchestrierung und greift zusätzlich in LLM, Sidecar, Lorebook, Bild, Storage und das Verhalten des Discord-Webhooks ein.
- Die Szenenanalyse liegt in den Sidecar-Services, doch der Game Mode kann sie wahlweise über den Sidecar oder über eine ausgewählte LLM-Verbindung laufen lassen.

## Zuständigkeiten der Modi

### Gemeinsam für alle Modi

Das sind die globalen Grundlagen:

- Persistenz von Chats und Nachrichten: `packages/server/src/routes/chats.routes.ts`, `packages/server/src/services/storage/chats.storage.ts`, gemeinsame Chat-Typen und -Schemas.
- Charaktere und Personas: Charakter-Routen, Storage, Schemas sowie die Charakter-Hooks und -Editoren im Client.
- Verbindungen und Anbieter: Verbindungs-Routen, Storage, gemeinsame Anbieter-Konstanten und `services/llm`.
- Prompt-Presets, Lorebooks, Regex, eigene Tools: gemeinsame Grundlagen für Autorenarbeit und Prompt-Einfügung.
- Transport der Generierung: `packages/client/src/hooks/use-generate.ts`, `packages/server/src/routes/generate.routes.ts` und die Anbieter-Registry.
- TTS, Übersetzung, Galerie, Themes, Einstellungen, Importe, Backups.

### Modus Conversation

Wichtigster Code:

- Client: `components/chat/ChatConversationSurface.tsx`, `ConversationView.tsx`, `ConversationMessage.tsx`, `ConversationInput.tsx` sowie die Schnellstart-Verdrahtung für Conversation in `ChatArea.tsx`.
- Client-Hooks: `use-autonomous-messaging.ts`, `use-background-autonomous.ts`.
- Server: `/api/conversation`, `services/conversation/*`.
- Gemeinsame Metadaten: `conversationSchedulesEnabled`, `characterSchedules`, `scheduleWeekStart` sowie Tages- und Wochenzusammenfassungen.

Erwartete Abgrenzung:

- Conversation gehören Zeitpläne, autonome Check-ins, Conversation-Aktivität und die Anzeige von Nachrichten außerhalb des Roleplay.
- Conversation weiß nichts über Spielwürfel, GM-Tags, Quick-Time-Events, Spielkarten oder den Kampf im Game Mode.

### Modus Roleplay

Wichtigster Code:

- Client: `components/chat/ChatRoleplaySurface.tsx`, `ChatMessage.tsx`, `ChatInput.tsx`, die `RoleplayHUD`-Komponenten, `SpriteOverlay.tsx`, `SceneBanner.tsx`, `CyoaChoices.tsx` und `EncounterModal.tsx`.
- Server: `/api/scene`, `/api/encounter`, `/api/sprites` und Teile von `/api/generate`.
- Gemeinsame Verträge: `scene`, die Roleplay-bezogenen Metadatenfelder des Chats und die Typen für die Sprite-Platzierung.

Erwartete Abgrenzung:

- Roleplay gehören Szenen, die Sprite-Anzeige, CYOA-Auswahlen, das Roleplay-HUD und die Helfer-Abläufe für Begegnungen im Roleplay.
- Gemeinsam genutzte visuelle Effekte, die auch der Game Mode verwendet, gehören aus `components/chat` heraus.

### Modus Game

Wichtigster Code:

- Client: `components/game/*`, `hooks/use-game.ts`, `hooks/use-scene-analysis.ts`, `stores/game-mode.store.ts`, `stores/game-state.store.ts`, `stores/game-asset.store.ts`, `lib/game-*`, `lib/party-dialogue-parser.ts`.
- Server: `/api/game`, `/api/game-assets`, `services/game/*` sowie die Game-Anteile von `services/sidecar/scene-analyzer.ts` und `scene-postprocess.ts`.
- Gemeinsame Verträge: `types/game.ts`, `types/game-state.ts`, `types/combat-encounter.ts` und die Game-Felder in `ChatMetadata`.

Erwartete Abgrenzung:

- Dem Game Mode gehören GM-Prompts, Party-Prompts, Würfel, Fertigkeitsproben, Quick-Time-Events, der Kampf im Spiel, Karten, Reisen und Rasten, Wetter und Zeit, die Reputation bei NPCs, Zusammenfassungen von Spielsitzungen, generierte Game-Assets und Game-Logs.
- Der Game Mode hängt nicht an der UI der Chat-Modi – außer über gemeinsame Bausteine oder ausdrücklich geteilte Feature-Komponenten.

## Aktuell große Dateien

Diese Dateien bremsen künftige Arbeit am ehesten aus, weil sie viele Belange an einer Stelle vermischen. Zeilenzahlen ändern sich ständig, deshalb nennt die Liste eine grobe Reihenfolge und den jeweiligen Belang statt exakter Größen.

| Datei | Abschnitt | Belang |
| --- | --- | --- |
| `packages/server/src/routes/generate.routes.ts` | gemeinsame Generierung und Agenten | Route, Streaming, Prompt, Agenten, Storage und Nebenwirkungen stecken in einer Datei. |
| `packages/server/src/routes/game.routes.ts` | `MODE-GAME` | API-Handler, GM-Ablauf, Szenenanalyse, Assets, Kampf und Persistenz sind eng verkoppelt. |
| `packages/client/src/components/game/GameSurface.tsx` | `MODE-GAME` | Rendering, Zustandsorchestrierung, Assets, Logs, Erzählung, Kampf und Effekte sind eng verkoppelt. |
| `packages/client/src/components/chat/ChatSettingsDrawer.tsx` | gemischte Chat-Einstellungen | Die Herauslösung der Abschnitte läuft bereits in `features/chat-settings`, trotzdem bleibt das Panel groß. |
| `packages/client/src/components/game/GameNarration.tsx` | `MODE-GAME` | Anzeige-Rendering und Befehlsformatierung hängen eng zusammen. |
| `packages/client/src/components/game/GameCombatUI.tsx` | `MODE-GAME` | Kampfanzeige, Bedienelemente und Logs lassen sich in kleinere Panels und Hooks zerlegen. |
| `packages/client/src/components/chat/RoleplayHUD.tsx` | `MODE-ROLEPLAY` | Ein Teil ist über `RoleplayHUDActionsMenu.tsx` und `RoleplayHUDPanels.tsx` bereits abgetrennt. |

## Zielstruktur

Das ist die Richtung für künftige Refactorings. Es muss nicht alles auf einmal umziehen.

### Ziel für den Client

```text
packages/client/src/
  app/                         # App bootstrap, shell integration, providers
  shared/
    components/                # UI primitives and mode-agnostic widgets
    hooks/                     # cross-feature client hooks
    lib/                       # browser/runtime helpers
    stores/                    # global client stores only
  features/
    agents/
    assets/
    gallery/
    sidecar/
    tts/
    translation/
  modules/
    conversation/
      components/
      hooks/
      lib/
    roleplay/
      components/
      hooks/
      lib/
    game/
      components/
      hooks/
      lib/
      stores/
```

### Ziel für den Server

```text
packages/server/src/
  app/                         # Fastify setup, route registration, middleware
  shared/
    db/
    storage/
    llm/
    prompt/
    lorebook/
    utils/
  features/
    agents/
    assets/
    haptic/
    image/
    import/
    sidecar/
    tts/
  modules/
    chat/
    conversation/
    roleplay/
      scene/
      encounter/
      sprites/
    game/
      routes/
      services/
      prompts/
```

### Ziel für shared

```text
packages/shared/src/
  contracts/
    chat/
    conversation/
    roleplay/
    game/
    providers/
  constants/
  utils/
```

Die alte flache Aufteilung in `types`, `schemas` und `constants` erzählt längst nicht mehr die ganze Geschichte. Unter `packages/shared/src/features/` liegen inzwischen Agenten, Function Calls, Ordner-Pakete, Zug-Spiele, Regelsätze und Kampf sowie der Weltgenerator. Der erste Aufräumschritt in `shared` sollte trotzdem auf Typ-Ebene und in kleinen Etappen passieren, nicht als große Dateiverschiebung.

## Regeln für die Migration

1. Neuer Code kommt in den engsten passenden Abschnitt.
2. Nutzen zwei oder mehr Modi eine Client-Komponente, verschiebe sie nach `CLIENT-SHARED`, bevor weiteres modusspezifisches Verhalten dazukommt.
3. Brauchen Client und Server denselben Typ, dasselbe Schema oder denselben reinen Helfer, verschiebe ihn nach `CORE-CONTRACT`.
4. Braucht ihn nur der Server, gehört er nicht nach `packages/shared`.
5. Routen-Dateien validieren HTTP-Eingaben und rufen Services auf. Fachliche Entscheidungen gehören in die Services.
6. Stores sind entweder global (`ui`, `chat`, `sidecar`) oder modusspezifisch (`game-mode`, `encounter`). Kein Store sollte klammheimlich mehrere Modi besitzen.
7. Metadaten sollten über `ChatMode` unterschieden werden: Basis-Metadaten plus Felder für Conversation, Roleplay und Game.
8. Verschiebe ein Feature nach dem anderen. Lass Kompatibilitäts-Exporte oder Wrapper stehen, wenn ein breit genutzter Import-Pfad sonst das halbe Repo aufwirbelt.
9. Nach jeder Verschiebung Lint laufen lassen:

   ```bash
   pnpm lint
   ```

   Danach einen gezielten Prettier-Check auf den geänderten Dateien.

## Erste Kandidaten für ein Refactoring

Diese Aufräumschritte eignen sich gut zum Einstieg, weil sie die Kopplung senken, ohne das Verhalten zu ändern.

1. `components/chat` in allgemeine, Conversation- und Roleplay-Gruppen aufteilen.
   - Kandidaten für „allgemein“: `ChatCommonOverlays`, `ChatBranchSelector`, `ChatGalleryDrawer`, `WeatherEffects` sowie gemeinsame Nachrichten- und Eingabe-Bausteine.
   - Kandidaten für Conversation: `ChatConversationSurface`, `ConversationView`, `ConversationMessage`, `ConversationInput`.
   - Kandidaten für Roleplay: `ChatRoleplaySurface`, `SpriteOverlay`, `SceneBanner`, `CyoaChoices`, `EncounterModal`. Das Roleplay-HUD ist über `RoleplayHUDActionsMenu.tsx` und `RoleplayHUDPanels.tsx` schon teilweise aufgeteilt.
2. Client-Helfer, die nur der Game Mode braucht, in ein Game-Modul verschieben.
   - Kandidaten: `game-audio`, `game-tag-parser`, `game-full-body-pose`, `game-character-name-match`, `game-segment-edits`, `party-dialogue-parser`.
3. `GameSurface.tsx` in Laufzeit-Hooks und kleinere Container aufteilen.
   - Mögliche Hooks: Laufzeit für Erzählung, Assets, Szenenanalyse, Kampf, Log und Verlauf sowie Audio.
4. `GameNarration.tsx` in Befehls-Parsing und -Formatierung plus Anzeige-Komponenten aufteilen.
5. `game.routes.ts` nach Handler-Gruppen aufteilen.
   - Mögliche Gruppen: Setup und Sitzung, Zug-Generierung, Würfel und Fertigkeitsproben und Quick-Time-Events, Journal und Inventar, Karte und Reisen und Wetter, Kampf, Assets und Szenenanalyse.
6. `generate.routes.ts` in Generierungs-Transport, Verarbeitung der Agent-Pipeline, Retry-Routen sowie Helfer für Befehle und Nachbearbeitung aufteilen. Issue #7573 hat damit begonnen: Die Token-Ausgabekette, die Tool-Runden, die Antwortbefehle, die Bereinigung des Antworttexts, die Generierungsinfos der gespeicherten Nachricht, der versteckte Befehlsanker und das Speichern der Antwort liegen jetzt in `routes/generate/`, jeweils mit eigener Regression.
7. `ChatMetadata` in modusspezifische Metadaten-Verträge aufteilen.
8. Gemeinsame Roleplay- und Game-Visuals aus `components/chat` herausziehen, bevor der Game Mode noch mehr Chat-Interna importiert.

## Praktischer Einstieg

Für den nächsten Aufräum-PR bietet sich diese Reihenfolge an:

1. Lege die Zielordner für genau einen Bereich an.
2. Verschiebe zuerst die reinen Helfer.
3. Danach die Blatt-Komponenten.
4. Lass den großen Orchestrator so lange liegen, bis seine Importe überwiegend auf das neue Modul zeigen.
5. Füge Kompatibilitäts-Re-Exporte nur dort ein, wo aufgewirbelte Importe von der eigentlichen Änderung ablenken würden.
6. Lint laufen lassen:

   ```bash
   pnpm lint
   ```

   Danach gezielte Prettier-Checks auf den geänderten Dateien.

## Verwandte Anleitungen

- [Frontend-Architektur (für Entwickler)](frontend.md)
- [Dateinativer Speicher (für Entwickler)](file-storage.md)
