# Frontend-Architektur (für Entwickler)

Dieser Text richtet sich an Entwickler, nicht an Endnutzer. Er beschreibt den Aufbau des Marinara-Engine-Clients: die Struktur der React-App, die Zustand-Stores, die React-Query-Hooks, die wichtigsten Komponenten und die Landkarte der Server-API. Wer die App einfach nur benutzen will, startet besser bei den Anleitungen.

## Überblick

Marinara Engine ist eine KI-Chat-Anwendung mit den Modi Conversation, Roleplay und Game. Der Client ist eine React-19-Single-Page-App, die Vite ausliefert. Das Styling übernimmt Tailwind CSS v4, ausgeliefert wird das Ganze als Progressive Web App (PWA).

Der Client liegt in `packages/client`. Er spricht über REST und Server-Sent Events (SSE) mit einem Fastify-API-Server (`packages/server`). Die gemeinsamen Datenverträge – Typen, Zod-Schemas, Konstanten – liegen in `packages/shared` und werden von beiden Seiten importiert.

## Architektur der Anwendung

### Drei-Spalten-Layout

Die Oberfläche folgt einem an Discord angelehnten Drei-Spalten-Aufbau, gesteuert von `components/layout/AppShell.tsx`:

```
+-------------+-----------------------------+--------------+
|  Left       |         Center              |  Right       |
|  Sidebar    |                             |  Panel       |
|             |  Chat area or Editor        |              |
|  Chat list  |  (lazy-loaded)              |  Characters  |
|  Folders    |                             |  Lorebooks   |
|  Mode tabs  |  ChatConversationSurface    |  Presets     |
|             |  ChatRoleplaySurface        |  Connections |
|             |  GameSurface                |  Agents      |
|             |  CharacterEditor            |  Personas    |
|             |  LorebookEditor             |  Settings    |
|             |  PresetEditor               |  Browser     |
|             |  ...other editors           |              |
+-------------+-----------------------------+--------------+
```

- Linke Seitenleiste (`components/layout/ChatSidebar.tsx`): die Chatliste, nach Ordnern gegliedert und nach Modus filterbar (Conversation, Roleplay, Game).
- Mittlere Spalte: entweder die aktive Chat-Fläche oder ein vollflächiger Editor (Charakter, Lorebook, Preset und so weiter). Sichtbar ist immer nur eines davon. Editoren ersetzen den Chatbereich.
- Rechtes Panel (`components/layout/RightPanel.tsx`): ein Ressourcen-Browser samt Einstellungen, umschaltbar über die obere Leiste. Einmal eingehängt, bleibt ein Panel im DOM (per CSS versteckt) und behält so Scrollposition und lokalen Zustand.
- Obere Leiste (`components/layout/TopBar.tsx`): Schaltflächen zum schnellen Wechsel zwischen den rechten Panels.

### Navigation

Die Navigation läuft über den Zustand, nicht über URLs – einen Router gibt es nicht. Was gerendert wird, steuert der Zustand-Store `stores/ui.store.ts`:

| Navigationsziel        | Store-Feld           | Auslösende Funktion                               |
| ---------------------- | -------------------- | ------------------------------------------------- |
| Charakter-Editor öffnen | `characterDetailId`  | `openCharacterDetail(id)`                          |
| Lorebook-Editor öffnen  | `lorebookDetailId`   | `openLorebookDetail(id)`                           |
| Preset-Editor öffnen    | `presetDetailId`     | `openPresetDetail(id)`                             |
| Verbindungs-Editor öffnen | `connectionDetailId` | `openConnectionDetail(id)`                         |
| Agent-Editor öffnen     | `agentDetailId`      | `openAgentDetail(id)`                              |
| Persona-Editor öffnen   | `personaDetailId`    | `openPersonaDetail(id)`                            |
| Rechtes Panel wechseln  | `rightPanel`         | `openRightPanel(name)` / `toggleRightPanel(name)` |
| Fenster öffnen          | `modal`              | `openModal(type, props?)`                          |

### Code-Splitting

Die großen Editoren und schweren Komponenten lädt `AppShell.tsx` verzögert nach – über `React.lazy()` in Kombination mit `Suspense`. So bleibt das Initial-Bundle klein (siehe Bundle-Budget weiter unten).

## Zustandsverwaltung

### Zustand-Stores (Client-Zustand)

Für Oberflächen- und Laufzeitzustand nutzt der Client mehrere Zustand-Stores unter `packages/client/src/stores/`. Nur `ui.store.ts` wird persistiert. Die übrigen halten Laufzeitzustand für Chats, Agenten, Spiele, die lokale Modell-Laufzeit, Übersetzung, Dialogfenster, Backfill und Tischspiele.

Aktuell existieren diese Store-Dateien: `agent.store.ts`, `backfill.store.ts`, `chat.store.ts`, `chess-game.store.ts`, `dialog.store.ts`, `encounter.store.ts`, `gallery.store.ts`, `game-asset.store.ts`, `game-mode.store.ts`, `game-state.store.ts`, `poker-game.store.ts`, `sidecar.store.ts`, `translation.store.ts`, `ui.store.ts` und `uno-game.store.ts`.

#### `ui.store.ts`: Einstellungen und Oberflächenrahmen

Der einzige persistierte Store (localStorage über die Zustand-`persist`-Middleware). Er enthält:

- Theme: `visualTheme` („default“ oder „sillytavern“), den `data-theme`-Wert (dark oder light) und eigene Farbüberschreibungen.
- Darstellung: `fontSize`, `chatFontSize`, `fontFamily`, eigene Schriften und Cursor-Stil.
- Chat-Anzeige: `boldDialogue`, `showTimestamps`, `showModelName` und `messagesPerPage`.
- Textgestaltung: Chat-Textfarbe, Deckkraft des Nachrichtenhintergrunds im Roleplay und Textkontur.
- Streaming: `enableStreaming` und `streamingSpeed`.
- Conversation-Theme: Verlaufsfarben der Nachrichtenblasen.
- Ton: `convoNotificationSound` und `rpNotificationSound`.
- Verhalten: `confirmBeforeDelete`, `enterToSendRP`, `enterToSendConvo`, `weatherEffects` und `guideGenerations`.
- Navigation: `rightPanel`, `rightPanelOpen`, `sidebarOpen`, `settingsTab`, sämtliche `*DetailId`-Felder und `modal`.

Synchronisierte eigene Themes liegen nicht in `ui.store.ts`. Sie kommen per React Query vom Server und werden auf alle Geräte gespiegelt, die mit derselben Marinara-Instanz verbunden sind.

#### `chat.store.ts`: Chat-Laufzeit

Nicht persistiert. Verfolgt die aktive Chat-Sitzung:

- `activeChatId`: welcher Chat angezeigt wird.
- `messages`: das aktuelle Nachrichten-Array.
- `isStreaming`, `streamBuffer`: laufende Generierung.
- `inputDrafts`: Nachrichtenentwürfe pro Chat.
- `currentInput`: der aktuelle Wert des Chat-Eingabefelds.
- `perChatTyping`: Zustand der Tipp-Anzeige.
- `unreadCounts`, `chatNotifications`: Benachrichtigungs-Badges.
- `abortControllers`: laufende Generierungen abbrechen.

#### `agent.store.ts`: Agenten-Ausführung

Verfolgt den Zustand der Agenten-Pipeline während und nach der Generierung:

- `activeAgents`: gerade laufende Agenten.
- `thoughtBubbles`: die Überlegungen der Agenten, in Echtzeit angezeigt.
- `echoMessages`: die Echokammer (simulierter Zuschauer-Chat).
- `cyoaChoices`: die Oberfläche für Verzweigungsentscheidungen.
- `debugLog`: Leistungsdaten und Token-Verbrauch.
- `failedAgentTypes`: Agenten mit Fehler (für die Wiederholen-Oberfläche).

#### `game-state.store.ts`: RPG-Begleiter

Hält Szenen- und Weltkontext für den Roleplay Mode:

- `current` (GameState): Datum, Uhrzeit, Ort, Wetter, anwesende Charaktere, Ereignisse, Spielerwerte, Quests und Inventar.
- `isVisible`, `expandedSections`: Anzeigezustand des HUD (der Info-Leiste am oberen Chatrand).

#### `encounter.store.ts`: Kampfsystem

Zustand des zugbasierten Kampfs:

- `active`: ob gerade eine Begegnung läuft.
- `party`, `enemies`: Kämpfende mit HP, Angriffen und Statuswerten.
- `environment`: Details zur Arena.
- `playerActions`, `encounterLog`: Aktionswarteschlange und Verlauf.
- `combatResult`: Sieg, Niederlage, Flucht oder Abbruch.

#### `gallery.store.ts`: Bild-Overlays

- `pinnedImages`: Bilder, die als Overlay über dem Chatbereich angeheftet sind.

### React Query (Server-Daten)

Sämtliche Server-Daten laufen über TanStack React Query, konfiguriert in `main.tsx`:

- Stale Time: 30 Sekunden (globaler Standard).
- Wiederholung: 1 Versuch.
- Neuladen bei Fokus: deaktiviert.
- Cache: nur im Arbeitsspeicher, ohne Persistenz.

Zu jeder Entität gehört eine eigene Hook-Datei, die Query- und Mutation-Hooks exportiert.

## Hook-Referenz

Alle Hooks liegen in `src/hooks/` und folgen dem Muster `use-{entity}.ts`.

### Chat-Hooks (`use-chats.ts`)

| Hook                               | Typ            | Beschreibung                                 |
| ---------------------------------- | -------------- | -------------------------------------------- |
| `useChats()`                       | Query          | Alle Chats                                   |
| `useChat(id)`                      | Query          | Einzelner Chat per ID                        |
| `useChatMessages(chatId, perPage)` | Infinite Query | Seitenweise Nachrichten eines Chats          |
| `useChatGroup(groupId)`            | Query          | Chat-Gruppe                                  |
| `useCreateChat()`                  | Mutation       | Neuen Chat anlegen                           |
| `useDeleteChat()`                  | Mutation       | Chat löschen                                 |
| `useUpdateChatMetadata()`          | Mutation       | Chat-Metadaten aktualisieren (Agenten, Sprites und mehr) |
| `useBranchChat()`                  | Mutation       | Chat ab einer bestimmten Nachricht verzweigen |
| `useUpdateMessage()`               | Mutation       | Nachrichtentext bearbeiten (optimistisches Update) |
| `useDeleteMessage()`               | Mutation       | Eine einzelne Nachricht löschen              |
| `useDeleteMessages()`              | Mutation       | Mehrere Nachrichten löschen                  |
| `useSetActiveSwipe()`              | Mutation       | Zu einem anderen Swipe wechseln              |
| `usePeekPrompt()`                  | Mutation       | Den fertig zusammengesetzten Prompt ansehen  |
| `useClearAllData()`                | Mutation       | Alles löschen (destruktiv)                   |

### Charakter-Hooks (`use-characters.ts`)

| Hook                   | Typ      | Beschreibung                           |
| ---------------------- | -------- | -------------------------------------- |
| `useCharacters()`      | Query    | Alle Charaktere                        |
| `useCharacter(id)`     | Query    | Einzelner Charakter mit geparsten Kartendaten |
| `useCreateCharacter()` | Mutation | Charakter anlegen                      |
| `useUpdateCharacter()` | Mutation | Charakterkarten-Daten aktualisieren    |
| `useDeleteCharacter()` | Mutation | Charakter löschen                      |
| `useUploadAvatar()`    | Mutation | Avatar-Bild hochladen                  |
| `usePersonas()`        | Query    | Alle Personas                          |
| `usePersona(id)`       | Query    | Einzelne Persona                       |
| `useCreatePersona()`   | Mutation | Persona anlegen                        |
| `useUpdatePersona()`   | Mutation | Persona aktualisieren                  |
| `useDeletePersona()`   | Mutation | Persona löschen                        |
| `useCharacterGroups()` | Query    | Charakter-Gruppen                      |
| `usePersonaGroups()`   | Query    | Persona-Gruppen                        |

### Preset-Hooks (`use-presets.ts`)

| Hook                           | Typ      | Beschreibung                                                |
| ------------------------------ | -------- | ---------------------------------------------------------- |
| `usePresets()`                 | Query    | Alle Presets                                               |
| `usePreset(id)`                | Query    | Einzelnes Preset                                           |
| `usePresetFull(id)`            | Query    | Preset samt Abschnitten, Gruppen und Auswahlblöcken        |
| `useDefaultPreset()`           | Query    | Das Standard-Preset                                        |
| `useCreatePreset()`            | Mutation | Preset anlegen                                             |
| `useUpdatePreset()`            | Mutation | Preset aktualisieren                                       |
| `useDeletePreset()`            | Mutation | Preset löschen                                             |
| `usePresetSections(presetId)`  | Query    | Prompt-Abschnitte eines Presets                            |
| `usePresetGroups(presetId)`    | Query    | Abschnittsgruppen                                          |
| `usePresetVariables(presetId)` | Query    | Preset-Variablen (früher Auswahlblöcke)                    |
| `usePreviewPreset()`           | Mutation | Gerenderte Prompt-Vorschau für `{ presetId, chatId, choices }` |

### Agenten-Hooks (`use-agents.ts`)

| Hook                 | Typ      | Beschreibung                    |
| -------------------- | -------- | ------------------------------- |
| `useAgentConfigs()`  | Query    | Alle Agenten-Konfigurationen    |
| `useAgentConfig(id)` | Query    | Einzelne Agenten-Konfiguration  |
| `useCreateAgent()`   | Mutation | Eigenen Agenten anlegen         |
| `useUpdateAgent()`   | Mutation | Agenten-Konfiguration aktualisieren |
| `useDeleteAgent()`   | Mutation | Agenten löschen                 |
| `useToggleAgent()`   | Mutation | Mitgelieferten Agenten ein- oder ausschalten |

### Generierungs-Hook (`use-generate.ts`)

Der komplexeste Hook. Er liefert `{ generate, retryAgents }` zurück.

`generate(params)` erwartet ein einzelnes Options-Objekt mit Feldern wie `chatId`, `connectionId`, `userMessage`, `regenerateMessageId`, `continueMessageId`, `impersonate` und `attachments`. Läuft für denselben Chat bereits eine Generierung, gibt die Funktion `false` zurück. Der Ablauf:

1. Streaming-Zustand in `chat.store.ts` setzen.
2. Die Generierungsanfrage an `/api/generate` schicken.
3. SSE-Ereignisse auswerten, etwa `token`, `agent_start`, `agent_result`, `agent_error`, `thinking`, `tool_call`, `game_state`, `game_state_patch`, `text_rewrite`, `scene_created`, `done` und `error`.
4. Den React-Query-Cache um die neuen Nachrichten ergänzen.
5. Den Agenten-Store mit Gedankenblasen und Debug-Infos füllen.
6. Fehler über Toast-Benachrichtigungen melden.

### Weitere Hooks

Im Ordner `src/hooks/` stecken außerdem viele funktionsspezifische Hooks. Eine repräsentative Auswahl:

| Datei                          | Zweck                                     |
| ------------------------------ | ----------------------------------------- |
| `use-connections.ts`           | CRUD für API-Verbindungen samt Test       |
| `use-lorebooks.ts`             | CRUD für Lorebooks und Einträge            |
| `use-scene.ts`                 | Szenen planen, anlegen, abschließen        |
| `use-encounter.ts`             | Kampfbegegnung starten, Aktion, Zusammenfassung |
| `use-autonomous-messaging.ts`  | Abfrage und Zeitplanung autonomer Nachrichten |
| `use-idle-detection.ts`        | Erkennung von 10 Minuten Inaktivität      |
| `use-background-autonomous.ts` | Hintergrundabfrage für inaktive Chats     |
| `use-translate.ts`             | Textübersetzung                           |
| `use-apply-regex.ts`           | Regex-Skripte auf Nachrichten anwenden     |
| `use-custom-tools.ts`          | CRUD für eigene Werkzeuge                  |
| `use-knowledge-sources.ts`     | Verwaltung der Wissensquellen              |
| `use-gallery.ts`               | Bilder der Chat-Galerie                    |
| `use-chat-folders.ts`          | CRUD für Chat-Ordner samt Sortierung       |
| `use-regex-scripts.ts`         | CRUD für Regex-Skripte                     |
| `use-haptic.ts`                | Verbindung und Befehle für Haptik-Geräte   |

## Komponenten-Überblick

### Chat-System (`components/chat/`)

Das Chat-System ist der umfangreichste Funktionsbereich. `ChatArea.tsx` lädt drei Render-Flächen verzögert nach: Conversation, Roleplay und Game Mode.

#### Conversation Mode (`ChatConversationSurface.tsx`)

Chat-Blasen wie im Messenger. Eigene Nachrichten rechts, die des Assistenten links. Enthalten sind:

- Seitenweises Nachladen beim Scrollen (ältere Nachrichten erscheinen, sobald du nach oben scrollst).
- Aktionen pro Nachricht: bearbeiten, kopieren, neu generieren, löschen, verzweigen, Prompt ansehen.
- Unterstützung für Anhänge (Bilder und Dateien).
- Emoji- und GIF-Auswahl.
- Slash-Befehle.
- Hinweistöne bei neuen Nachrichten.
- Entwürfe, die pro Chat erhalten bleiben.

#### Roleplay Mode (`ChatRoleplaySurface.tsx`)

Eine dunkle, dichte Oberfläche im RPG-Look. Sie bietet alles aus dem Conversation Mode und zusätzlich:

- Charakter-Sprites, deren Gesichtsausdruck der Expression-Agent steuert.
- Das Roleplay-HUD mit dem Spielzustand (Uhrzeit, Ort, Wetter, anwesende Charaktere).
- Wettereffekte – Partikel-Overlays passend zum Wetter der Szene.
- Das Panel der Echokammer (simulierte Zuschauerreaktionen).
- Kampfbegegnungen mit zugbasiertem Aktionssystem.
- Ein World-Info-Panel mit den gerade aktiven Lorebook-Einträgen.
- Ein Szenensystem für verzweigte Mini-Roleplays.
- Hintergrundbilder mit weichen Übergängen.

#### Game Mode (`GameSurface.tsx`)

Die Fläche für den KI-Game-Master. Sie liegt außerhalb des Chat-Ordners, nämlich in `components/game/GameSurface.tsx`. `ChatArea.tsx` rendert sie, sobald der Chat-Modus `game` ist. Sie liest die eigenen Game-Stores (`game-mode.store.ts`, `game-asset.store.ts`, `game-state.store.ts`) und steuert Sitzungen, Würfelwürfe, Fertigkeitsproben, Karten und Zug-Storyboards über die Hooks in `use-game.ts` und `use-game-storyboards.ts`.

#### Zentrale Komponenten

- `ChatArea.tsx`: der zentrale Dirigent. Holt alle Daten (Nachrichten, Charaktere, Personas), baut die Charakter-Zuordnung auf, ermittelt den Chat-Modus und rendert die passende Fläche.
- `ChatMessage.tsx`: rendert eine einzelne Nachricht mit Markdown, Swipe-Navigation, Bearbeitung und Aktionsmenüs. Für die Bearbeitung nutzt sie die unkontrollierte Unterkomponente `EditTextarea`, damit währenddessen keine Re-Renders anfallen.
- `ChatInput.tsx`: die Eingabe mit automatischer Höhenanpassung, gespeicherten Entwürfen, Vervollständigung für Slash-Befehle, Anhängen sowie Emoji- und GIF-Einfügung.

### Editor-Komponenten

Jeder Ressourcentyp hat einen vollflächigen Editor, der den Chatbereich ersetzt:

| Editor            | Datei                                         | Verwaltet                                                                       |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| Character Editor  | `components/characters/CharacterEditor.tsx`   | Felder der Charakterkarte, Avatar, Begrüßung, Persönlichkeit, System-Prompt, Metadaten |
| Lorebook Editor   | `components/lorebooks/LorebookEditor.tsx`     | Lorebook-Metadaten und Einträge mit Schlüsselwörtern, Aktivierungsregeln, Einfüge-Einstellungen |
| Preset Editor     | `components/presets/PresetEditor.tsx`         | Prompt-Abschnitte, Gruppen, Marker, Generierungsparameter, Auswahlblöcke        |
| Connection Editor | `components/connections/ConnectionEditor.tsx` | API-Anbieter, Basis-URL, Modell, Kontextfenster, Schalter                       |
| Agent Editor      | `components/agents/AgentEditor.tsx`           | Prompt-Vorlage, Phase, Verbindung, Werkzeuge und Einstellungen des Agenten      |
| Persona Editor    | `components/personas/PersonaEditor.tsx`       | Nutzer-Persona mit Name, Beschreibung, Werten und Avatar                        |

### Fenster-System (`components/modals/`)

Die Fenster rendert `components/layout/ModalRenderer.tsx`. Die Komponente liest `ui.store.modal` und rendert die passende Komponente innerhalb von `Suspense`. Die Fenster-Komponenten liegen unter `components/modals/`.

Aktuell gibt es unter anderem diese Fenstertypen (die Liste ist beispielhaft, nicht vollständig):

| Typ                        | Komponente                    | Zweck                                      |
| -------------------------- | ----------------------------- | ------------------------------------------ |
| `create-character`         | `CreateCharacterModal`        | Charakter schnell anlegen (Name und Avatar) |
| `create-connection`        | `CreateConnectionModal`       | Verbindung schnell anlegen                 |
| `create-persona`           | `CreatePersonaModal`          | Persona schnell anlegen                    |
| `create-lorebook`          | `CreateLorebookModal`         | Lorebook schnell anlegen                   |
| `create-preset`            | `CreatePresetModal`           | Preset schnell anlegen                     |
| `import-character`         | `ImportCharacterModal`        | Import aus Datei (JSON oder PNG)           |
| `import-connection`        | `ImportConnectionModal`       | Verbindungspaket importieren               |
| `import-lorebook`          | `ImportLorebookModal`         | Import aus Datei                           |
| `import-preset`            | `ImportPresetModal`           | Import aus Datei                           |
| `import-persona`           | `ImportPersonaModal`          | Import aus Datei                           |
| `character-card-update`    | `CharacterCardUpdateModal`    | Vom Agenten vorgeschlagene Kartenänderungen prüfen |
| `agent-write-approval`     | `AgentWriteApprovalModal`     | Zustimmung und Prüfung für Schreibzugriffe von Agenten |
| `docs-viewer`              | `DocsViewerModal`             | Dokumentation direkt in der App            |
| `st-bulk-import`           | `STBulkImportModal`           | Massenimport aus SillyTavern-Daten         |
| `about-me-viewer`          | `AboutMeViewerModal`          | Ein About Me aus dem Conversation Mode ansehen |
| `scene-prompt-preferences` | `ScenePromptPreferencesModal` | Einstellungen für Szenen-Prompts           |

Muster für Fenster: Alle nehmen `{ open, onClose }` entgegen, betten ihren Inhalt in die Basiskomponente `Modal` ein, nutzen Mutations für API-Aufrufe und zeigen den Ladezustand aus `mutation.isPending`.

### Panel-System (`components/panels/`)

Die Panels am rechten Rand zeigen Ressourcenlisten mit Suche, Sortierung und Filtern. Ein Klick auf eine Ressource öffnet ihren vollflächigen Editor in der mittleren Spalte.

Panels werden in `RightPanel.tsx` an zwei Stellen registriert:

1. `PANEL_CONFIG`: Titel, Symbol und Verlaufsfarbe.
2. `PANELS`: die Komponenten-Zuordnung.

Panels merken sich ihren Zustand auf Modulebene. Ein `mountedPanels`-Set hält fest, welche Panels bereits geöffnet waren. Einmal eingehängt, bleibt ein Panel im DOM (versteckt über `display: none` oder `aria-hidden`) und behält damit seinen Zustand.

### UI-Bausteine (`components/ui/`)

| Komponente         | Beschreibung                                                           |
| ------------------ | --------------------------------------------------------------------- |
| `Modal`            | Basisfenster mit Klick auf den Hintergrund, Esc-Taste sowie Ein- und Ausblendanimation |
| `ColorPicker`      | Auswahl einer Volltonfarbe oder eines Verlaufs mit vorgegebenen Farbfeldern |
| `ExpandedTextarea` | Bildschirmfüllendes Portal-Overlay zum Bearbeiten langer Texte        |
| `EmojiPicker`      | Durchsuchbares Emoji-Popover (über ein Portal gerendert)              |
| `GifPicker`        | GIF-Suche über die Giphy-API                                          |
| `HelpTooltip`      | Symbol, das beim Draufzeigen einen über ein Portal platzierten Tooltip einblendet |

Alle UI-Komponenten arbeiten mit kontrollierten Props (value plus onChange) und rendern Overlays über Portale.

## API-Client (`lib/api-client.ts`)

Die gesamte Kommunikation mit dem Server läuft über das `api`-Objekt:

```typescript
import { api, ApiError } from "@/lib/api-client";
```

| Methode                        | Signatur            | Beschreibung                          |
| ------------------------------ | ------------------- | ------------------------------------- |
| `api.get<T>(path)`             | `GET /api{path}`    | JSON abrufen                          |
| `api.post<T>(path, body)`      | `POST /api{path}`   | JSON senden, JSON empfangen           |
| `api.put<T>(path, body)`       | `PUT /api{path}`    | Vollständige Aktualisierung           |
| `api.patch<T>(path, body)`     | `PATCH /api{path}`  | Teilweise Aktualisierung              |
| `api.delete(path)`             | `DELETE /api{path}` | Ressource löschen                     |
| `api.upload(path, FormData)`   | `POST /api{path}`   | Datei-Upload als Multipart            |
| `api.download(path, filename)` | `GET /api{path}`    | Download mit Speichern-unter-Dialog   |
| `api.stream(path, body)`       | `POST /api{path}`   | Asynchroner SSE-Generator (nur Tokens) |
| `api.streamEvents(path, body)` | `POST /api{path}`   | Asynchroner SSE-Generator (alle Ereignistypen) |

Fehler werfen `ApiError` – dieses Objekt trägt die Eigenschaften `status` und `message`.

## Styling-System

### Tailwind CSS v4

Das Projekt setzt Tailwind CSS v4 mit dem Plugin `@tailwindcss/vite` ein; eine PostCSS-Konfiguration braucht es dafür nicht. Die Theme-Token bilden CSS-Custom-Properties aus `globals.css` ab:

```css
@theme {
  --color-primary: var(--primary);
  --color-background: var(--background);
  --color-border: var(--border);
  /* ... */
}
```

### Aufbau der Themes

`globals.css` ist in benannte Abschnitte gegliedert. Dazu zählen die Tailwind-`@theme`-Zuordnung, die Variablen des dunklen Themes, die Überschreibungen für das helle Theme, das Basis-Reset, eigene Cursor, Scrollleisten, Glas-Panels, Glow-Utilities, UI-Komponenten und Keyframe-Animationen. Weitere Abschnitte decken Chat-Animationen, das Chat-Styling je Modus, Sprites und Game-HUD, Function-Call-Karten, Regeln für responsives Verhalten, das importierte SillyTavern-Theme, Barrierefreiheit und Performance-Hinweise ab.

### Eigene Themes

Nutzer können eigene Themes anlegen. Die Theme-Definitionen liegen auf dem Marinara-Server und werden auf alle verbundenen Geräte synchronisiert – das gilt auch für das gerade aktive eigene Theme. Das CSS fügt `CustomThemeInjector.tsx` als `style`-Tag ein.

Synchronisiertes Theme-CSS kann die eingebaute Accent-Pulse-Engine mit `--marinara-theme-accent-pulse: enabled` anfordern. Ergänze `--marinara-theme-accent-pulse-source: #a78bfa` (oder einen Verlauf), wenn der Puls eine bestimmte Theme-Akzentfarbe statt der aktuellen Akzentfarbe aus der Darstellung verwenden soll.

### Personal Extensions

Personal Extensions sind auf dem Server gespeicherter Sandbox-Code, der per exaktem Hash freigegeben wird. Die Addons-Oberfläche nutzt `use-personal-extensions.ts`; `PersonalExtensionInjector.tsx` führt freigegebenen Browser-Code in einem eigenen Worker innerhalb eines Sandbox-iframes mit undurchsichtigem Ursprung aus und vermittelt unveränderliche Snapshots des aktiven Chat-Kontexts. Die Kontextfelder sind immer vorhanden; außerhalb eines aktiven Chats sind `chatId` und `characterId` `null`, und `characterIds` ist leer. Begrenzte Felder der aktiven Charakterkarte und der ausgewählten Persona brauchen separat deklarierte, an den Hash gebundene Berechtigungen. Server-Erweiterungen laufen in einem separaten Node-Prozess unter macOS Seatbelt oder Linux Bubblewrap und verweigern den Start, wenn keines von beidem verfügbar ist. Für externe Quellen braucht es zusätzlich die `.env`-Freigabe und das Opt-in in der Danger Zone – geprüft beim Auflisten, bei der Freigabe und zur Laufzeit.

Lies [Architektur der Personal Extensions](personal-extensions.md), bevor du an dieser Funktion etwas änderst.

## Gemeinsames Paket (`packages/shared`)

Das Frontend importiert Typen, Schemas und Konstanten aus `@marinara-engine/shared`.

### Konstanten

Die wichtigsten Dateien in `packages/shared/src/constants/`:

- `defaults.ts`: exportiert unter anderem `APP_VERSION`, `PROFESSOR_MARI_ID`, `DEFAULT_CONNECTION_ID`, `DEFAULT_GENERATION_PARAMS`, `MAX_FILE_SIZES` und `LIMITS`. Hier steht die Version, und hier liegen die Standardwerte für die Generierung.
- `providers.ts`: exportiert `PROVIDERS`, also die Konfigurationen der API-Anbieter (OpenAI, Anthropic, Google und weitere) samt URLs und Authentifizierung.
- `model-lists.ts`: statische Modellkataloge je Anbieter, dazu `IMAGE_GENERATION_SOURCES` für die Anbieter der Bildgenerierung.
- `agent-prompts.ts`: die Basis-Prompts für Zusammenfassung und Secret Plot sowie das Nachschlagen der Prompts zur Laufzeit, die installierte Agenten-Pakete mitbringen.

### Schemas (Zod)

Alle Eingaben werden über Zod-Schemas aus `packages/shared/src/schemas/` geprüft. Repräsentative Dateien:

| Schema-Datei            | Entitäten                                                          |
| ----------------------- | ------------------------------------------------------------------ |
| `agent.schema.ts`       | AgentConfig anlegen und aktualisieren, Agenten-Phasen, Ergebnistypen |
| `character.schema.ts`   | Charakterkarten, Kompatibilitäts-Metadaten, Character Books, Gruppen |
| `chat.schema.ts`        | Chat anlegen, Nachricht anlegen, Generierungsanfrage              |
| `connection.schema.ts`  | API-Verbindung anlegen und aktualisieren                           |
| `custom-tool.schema.ts` | Definitionen eigener Werkzeuge                                     |
| `lorebook.schema.ts`    | Lorebook und Eintrag anlegen/aktualisieren, Aktivierungsbedingungen, Zeitpläne |
| `prompt.schema.ts`      | Preset, Abschnitt, Gruppe, Auswahlblock, Generierungsparameter     |
| `regex.schema.ts`       | Regex-Skript anlegen und aktualisieren                             |
| `personal-extension.schema.ts` | Entwürfe für Personal Extensions, Freigabe per exaktem Hash, Rücknahme und privater Speicher |

Im selben Ordner liegen außerdem Schemas für App-Einstellungen, Chat-Einstellungsprofile, Conversation-Anrufe, eigene Emojis und Sticker, Noodle und Themes.

### Typen

Die Typdefinitionen der Entitäten liegen in `packages/shared/src/types/`. Eine Auswahl der wichtigsten Dateien:

| Typ-Datei             | Zentrale Interfaces                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `agent.ts`            | `AgentConfig`, `AgentResult`, `AgentContext`, `ToolDefinition`, `ToolCall`, `ToolResult`, `BUILT_IN_AGENTS` |
| `character.ts`        | `Character`, `CharacterCardV2`, `CharacterData`, `RPGStatsConfig`                                           |
| `chat.ts`             | `Chat`, `ChatMetadata`, `Message`, `MessageExtra`, `GenerationInfo`, `StreamEvent`                          |
| `connection.ts`       | `APIConnection`, `ModelInfo`, `ModelCapabilities`, `ConnectionTestResult`                                   |
| `combat-encounter.ts` | `CombatPartyMember`, `CombatEnemy`, `CombatActionResult`, `EncounterSettings`                               |
| `game-state.ts`       | `GameState`, `PresentCharacter`, `PlayerStats`, `QuestProgress`, `InventoryItem`                            |
| `lorebook.ts`         | `Lorebook`, `LorebookEntry`, `ActivationCondition`, `LorebookSchedule`, `QuestData`                         |
| `persona.ts`          | `Persona`, `PersonaStatsConfig`                                                                             |
| `personal-extension.ts` | `PersonalExtension`, Laufzeit-Metadaten, Revisionen, Quelle und Server-Laufzeitzustand                     |
| `prompt.ts`           | `PromptPreset`, `PromptSection`, `PromptGroup`, `ChoiceBlock`, `GenerationParameters`                       |
| `scene.ts`            | `SceneMeta`, `SceneFullPlan`                                                                                |
| `haptic.ts`           | `HapticDevice`, `HapticStatus`, `HapticDeviceCommand`                                                       |

### Hilfsfunktionen

| Datei             | Zweck                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `macro-engine.ts` | `resolveMacros(template, context)`: ersetzt Makros wie `{{date}}`, `{{char}}`, `{{random}}`, `{{roll:2d6}}` und `{{getvar::name}}`     |
| `xml-wrapper.ts`  | `nameToXmlTag()`: wandelt einen Anzeigenamen in einen XML-Tag-Slug um (aus „World Info (Before)“ wird „world_info_before“)                           |

## API-Endpunkte

Der Server (`packages/server`) stellt REST-APIs unter `/api` bereit. Was folgt, ist eine grobe Landkarte, keine vollständige Liste. Maßgeblich sind die Datei `packages/server/src/routes/index.ts` und die einzelnen Route-Dateien.

### Kernressourcen

| Präfix               | Methoden                 | Beschreibung                                                                               |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `/api/characters`    | GET, POST, PATCH, DELETE | CRUD für Charaktere, Gruppen, Export (JSON oder PNG)                                        |
| `/api/chats`         | GET, POST, PATCH, DELETE | CRUD für Chats, Nachrichten, Metadaten, verbinden und trennen                              |
| `/api/prompts`       | GET, POST, PATCH, DELETE | CRUD für Presets, Abschnitte, Gruppen, Auswahlblöcke, Export                               |
| `/api/connections`   | GET, POST, PATCH, DELETE | CRUD für API-Verbindungen, duplizieren, testen                                             |
| `/api/agents`        | GET, POST, PATCH, DELETE | CRUD für Agenten, Echo-Nachrichten, Läufe; mitgelieferte Agenten schaltet `PUT /api/agents/toggle/:agentType` |
| `/api/lorebooks`     | GET, POST, PATCH, DELETE | CRUD für Lorebooks, Einträge, Export                                                       |
| `/api/custom-tools`  | GET, POST, PATCH, DELETE | CRUD für eigene Werkzeuge                                                                  |
| `/api/regex-scripts` | GET, POST, PATCH, DELETE | CRUD für Regex-Skripte                                                                     |

Die Gedächtnis-Werkzeuge der Agenten laufen über `/api/agents/memory/:agentType/:chatId`. Dabei ist `agentType` der Typ-String des Agenten und `chatId` die ID des Ziel-Chats.

### Generierung

| Endpunkt                     | Methode | Beschreibung                                         |
| ---------------------------- | ------ | ---------------------------------------------------- |
| `/api/generate`              | POST   | Die zentrale SSE-Generierung samt Agenten-Pipeline    |
| `/api/generate/retry-agents` | POST   | SSE-Wiederholung für die vom Aufrufer genannten Agententypen |

### Chat-Funktionen

| Präfix                    | Endpunkte                        | Beschreibung                 |
| ------------------------- | -------------------------------- | ---------------------------- |
| `/api/chat-folders`       | CRUD plus Sortierung             | Verwaltung der Chat-Ordner   |
| `/api/conversation`       | schedule, status, message, check | System für autonome Nachrichten |
| `/api/scene`              | create, plan, conclude           | Szenenverzweigung            |
| `/api/encounter`          | init, action, summary            | Kampfbegegnungen             |
| `/api/translate`          | POST                             | Textübersetzung              |
| `/api/game`               | CRUD und Aktionen                | Sitzungen und Zustand im Game Mode |
| `/api/game-assets`        | CRUD und Upload                  | Game-Assets                  |
| `/api/turn-games`         | Routen für Chess, UNO, Poker     | Tischspiele in Conversation  |
| `/api/conversation-calls` | Routen für Anrufe und Sitzungen  | Audio-Anrufe in Conversation |

### Medien und Assets

| Präfix                        | Beschreibung                 |
| ----------------------------- | ---------------------------- |
| `/api/avatars/file/:filename` | Ausliefern von Avatar-Bildern |
| `/api/backgrounds`            | CRUD für Hintergründe samt Upload |
| `/api/sprites/:characterId`   | Verwaltung der Sprite-Gesichtsausdrücke |
| `/api/fonts`                  | Verwaltung eigener Schriften |
| `/api/gallery/:chatId`        | Galerie-Bilder eines Chats   |
| `/api/global-gallery`         | Bilder der globalen Galerie  |
| `/api/tts`                    | Routen für Text to Speech (Sprachausgabe) |
| `/api/youtube`                | Routen für den YouTube-DJ    |
| `/api/custom-emojis`          | Eigene Emoji-Assets          |
| `/api/custom-stickers`        | Eigene Sticker-Assets        |
| `/api/gifs/search`            | GIF-Suche (Giphy-Proxy)      |

### Externe Integrationen

| Präfix                          | Beschreibung                 |
| ------------------------------- | ---------------------------- |
| `/api/bot-browser/chub/*`       | Charaktersuche auf Chub      |
| `/api/bot-browser/chartavern/*` | Suche auf CharacterTavern    |
| `/api/bot-browser/janny/*`      | Suche auf JannyAI            |
| `/api/bot-browser/pygmalion/*`  | Suche auf Pygmalion          |
| `/api/bot-browser/wyvern/*`     | Suche auf Wyvern             |
| `/api/bot-browser/datacat/*`    | Suche auf DataCat            |
| `/api/haptic/*`                 | Steuerung von Haptik-Geräten |
| `/api/spotify/*`                | Spotify-Anmeldung            |
| `/api/knowledge-sources`        | Wissensbasis für die Abfrage |

### System

| Endpunkt                        | Beschreibung                            |
| ------------------------------- | --------------------------------------- |
| `/api/updates/check`            | Versionsabgleich mit den GitHub-Releases |
| `/api/updates/latest`           | Metadaten des neuesten Releases         |
| `/api/updates/commits-behind`   | Update-Abstand bei einer Git-Installation |
| `/api/backup`                   | Vollständiges Backup, Export, Import    |
| `/api/import/*`                 | Profil-Import aus SillyTavern und Marinara |
| `/api/admin/clear-all`          | Alle Daten löschen                      |
| `/api/themes`                   | Synchronisierte eigene Themes           |
| `/api/personal-extensions`      | Richtlinien, Entwürfe, Freigabe, Laufzeit und privater Speicher der Sandbox-Erweiterungen |
| `/api/app-settings`             | App-Einstellungen auf Serverseite       |
| `/api/sidecar`                  | Laufzeit für lokale Modelle             |
| `/api/chat-presets`             | Chat-Einstellungsprofile (Endpunktname aus Alt-Zeiten) |
| `/api/connection-folders`       | Ordner für Verbindungen                 |
| `/api/prompt-overrides`         | Überschreibungen mitgelieferter Prompts |
| `/api/achievements`             | Freigeschaltete Errungenschaften        |
| `/api/noodle`                   | Die soziale Timeline von Noodle         |
| `/api/professor-mari/workspace` | Workspace-Operationen von Professor Mari |

## PWA-Unterstützung

Die App ist eine Progressive Web App, konfiguriert über VitePWA:

- Manifest: `public/manifest.json` mit dem App-Namen „Marinara Engine“, dem Anzeigemodus standalone und dunklem Theme.
- Symbole: ein 64px-Favicon, maskierbare Symbole in 192px und 512px sowie ein Splash-Logo.
- Service Worker: Workbox mit automatischer Update-Strategie.
- Caching: statische Assets werden zwischengespeichert; `/api/*`-Routen laufen mit NetworkOnly.
- Keep-alive: `lib/keep-alive.ts` nutzt die Web Locks API und BroadcastChannel-Pings, damit der Tab nicht einschläft.

### Erkennung von Versionsunterschieden

`App.tsx` fragt alle 5 Minuten `/api/health` ab. Weicht die Server-Version von der zwischengespeicherten Client-Version ab, meldet der Client den Service Worker ab. Zusätzlich leert er die Caches, um ein Update zu erzwingen.

## Agenten-System

Das Agenten-System verarbeitet KI-Antworten über konfigurierbare Pipelines. Agenten laufen in drei Phasen:

1. Vor der Generierung: vor dem eigentlichen LLM-Aufruf, etwa zum Einfügen von Kontext oder zum Abrufen von Wissen.
2. Parallel: gleichzeitig zur Hauptgenerierung, etwa für Weltzustand oder Kampf.
3. Nachbearbeitung: nach der Hauptantwort, etwa zum Umschreiben der Prosa oder zum Aktualisieren von Lorebooks.

Wiederholungsanfragen gehen an `/api/generate/retry-agents`, zusammen mit einer expliziten `agentTypes`-Liste. Eine übergreifende Aktion wie **Re-run Trackers** (Tracker erneut ausführen) übergibt alle aktiven Tracker-Typen. Ein einzelnes Widget-Bedienelement übergibt nur seinen eigenen Tracker.

Die Gedächtnis-Werkzeuge der Agenten – etwa das Secret-Plot-Panel des Narrative Director – laufen über `/api/agents/memory/:agentType/:chatId`. Die Route gilt für konfigurierte Agenten, die je Chat ein Gedächtnis speichern. In aktuellen Konfigurationen liegt das Secret-Plot-Gedächtnis unter `director`; für ältere Chats wird `secret-plot-driver` weiterhin akzeptiert.

### Herunterladbare Agenten aus erster Hand

Die schlanke Engine startet mit einer leeren Agenten-Registry zur Laufzeit. Erst Pakete aus dem öffentlichen Katalog [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) steuern geprüfte Agenten-Manifeste, Client- und Server-Einstiegspunkte sowie UI-Slots zur Laufzeit bei. Der Kompatibilität halber liegen die aktiven Definitionen weiterhin unter `BUILT_IN_AGENTS` – sie stammen aber aus installierten Paketen, nicht aus mitgelieferten Implementierungen. Der offizielle Katalog enthält diese Pakete:

| Agent                    | Phase           | Aufgabe                                                           |
| ------------------------ | --------------- | ----------------------------------------------------------------- |
| `prose-guardian`         | post_processing | Wacht über die Schreibqualität (keine Wiederholungen, zeigen statt erzählen) |
| `continuity`             | post_processing | Erkennt Widersprüche und kann Hinweise zum Umschreiben liefern    |
| `director`               | pre_generation  | Fügt Erzählvorgaben und optional den Secret-Plot-Zustand ein      |
| `echo-chamber`           | parallel        | Simuliert Publikumsreaktionen                                     |
| `world-state`            | post_processing | Liest Datum, Uhrzeit, Ort und Wetter aus der Erzählung heraus     |
| `expression`             | post_processing | Wählt die Gesichtsausdrücke der Charakter-Sprites                 |
| `quest`                  | post_processing | Verfolgt neue, geänderte und abgeschlossene Quests                |
| `background`             | post_processing | Wählt passende Hintergrundbilder                                  |
| `character-tracker`      | post_processing | Verfolgt Zustandsänderungen der Charaktere                        |
| `persona-stats`          | post_processing | Verfolgt Änderungen an den Werten der Spieler-Persona             |
| `custom-tracker`         | post_processing | Verfolgt selbst definierte strukturierte Zustände                 |
| `inventory-tracker`      | post_processing | Verfolgt Währungen, ausgerüstete Gegenstände und Inventar         |
| `illustrator`            | post_processing | Erzeugt Bild-Prompts für Szenen und Medienanfragen                |
| `lorebook-keeper`        | post_processing | Legt Lorebook-Einträge automatisch an und aktualisiert sie        |
| `card-evolution-auditor` | post_processing | Prüft Charakterkarten und schlägt Weiterentwicklungen vor         |
| `combat`                 | parallel        | Verfolgt Kampfrunden, HP, Initiative und Ausgang                  |
| `html`                   | post_processing | Schreibt fertige Roleplay-Antworten um und ergänzt diegetische HTML-Grafiken |
| `spotify`                | post_processing | Steuert die Wiedergabe im Music DJ (Spotify, YouTube oder lokale Musik) |
| `knowledge-retrieval`    | pre_generation  | Holt Kontext aus den Wissensquellen                               |
| `knowledge-router`       | pre_generation  | Leitet passende Lorebook- und Wissenseinträge weiter              |
| `haptic`                 | post_processing | Schickt Befehle an Haptik-Geräte                                  |
| `cyoa`                   | post_processing | Erzeugt Auswahlmöglichkeiten                                      |
| `conversation-calls`     | feature         | Ergänzt Audio- und Videoanrufe in Conversation samt Einstellungen |
| `hierarchical-maps`      | feature         | Ergänzt Karten, räumlichen Kontext und Bewegung in Roleplay/Game   |
| `uno`                    | feature         | Ergänzt den UNO-Tisch in Conversation                             |
| `chess`                  | feature         | Ergänzt das Schachbrett in Conversation                           |
| `poker`                  | feature         | Ergänzt den Texas-Hold'em-Tisch in Conversation                   |
| `eightball`              | feature         | Ergänzt den 8-Ball-Billardtisch in Conversation                   |
| `tic-tac-toe`            | feature         | Ergänzt das Tic-Tac-Toe-Feld in Conversation                      |
| `rock-paper-scissors`    | feature         | Ergänzt Schere-Stein-Papier-Partien in Conversation               |

### Ergebnistypen der Agenten

Agenten liefern typisierte Ergebnisse, die das Frontend verarbeitet. Die Union `AgentResultType` in `packages/shared/src/types/agent.ts` umfasst:

`game_state_update`, `text_rewrite`, `sprite_change`, `echo_message`, `quest_update`, `image_prompt`, `context_injection`, `continuity_check`, `director_event`, `lorebook_update`, `character_card_update`, `background_change`, `character_tracker_update`, `persona_stats_update`, `custom_tracker_update`, `inventory_tracker_update`, `spotify_control`, `youtube_control`, `local_music_control`, `haptic_command`, `cyoa_choices`, `secret_plot`, `game_master_narration`, `party_action`, `game_map_update`, `game_state_transition`, `prompt_patch`, `frontend_theme_update` und `about_me_update`.

## Chat-Modi

### Conversation Mode

Reiner Dialog mit einem oder mehreren KI-Charakteren. Charaktere können verschiedene Status haben (online, abwesend, bitte nicht stören, offline), die Zeitpunkt und Stil der Antwort beeinflussen. Mitgelieferte Agenten werden pro Chat hinzugefügt, nicht global aktiviert.

### Roleplay Mode

Ein dichtes Erzählerlebnis mit Verfolgung des Spielzustands: Szenenkontext (Ort, Zeit, Wetter), Anwesenheit und Stimmung der Charaktere, Spielerwerte, Inventar und Quests, Kampfbegegnungen, World Info aus Lorebooks und Sprite-Gesichtsausdrücke.

### Game Mode

Sitzungen mit einem KI-Game-Master, dazu Partymitglieder, Würfel, Spielzustand, Assets, Storyboards, ein Journal und ein strukturierter Sitzungsablauf. Der Game Mode nutzt eigene Stores und Routen für Spielzustand, Assets, Tischspiele, Szenenvideos und Storyboards. Den Ablauf aus Nutzersicht beschreibt [Game Mode: Erste Schritte](../game/getting-started.md).

## Entwicklung

### Befehle

Abhängigkeiten installieren:

```bash
pnpm install
```

Server und Client mit Hot Reload starten:

```bash
pnpm dev
```

Nur den Dev-Server des Clients starten:

```bash
pnpm dev:client
```

Nur den API-Server starten:

```bash
pnpm dev:server
```

Die Basisprüfung ausführen (TypeScript plus ESLint):

```bash
pnpm check
```

Für die Produktion bauen:

```bash
pnpm build
```

### Bundle-Budget

- Haupteinstieg: höchstens 1 MB.
- Pro Chunk: höchstens 500 KB.
- Vendor-Splits: react, tanstack, motion, zustand, icons und misc.

### Pfad-Alias

`@/*` verweist sowohl in der TypeScript- als auch in der Vite-Konfiguration auf `./src/*`.

## Verwandte Anleitungen

- [Architektur-Landkarte (für Entwickler)](architecture-map.md)
- [Dateibasierte Speicherung (für Entwickler)](file-storage.md)
