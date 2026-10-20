# Plan für Drag-and-drop von Chat-Ressourcen

## Status

Die Phasen 1 bis 4 wurden auf `drag-me-baby-one-more-time` umgesetzt und sind in `staging` gemergt. Spätere Arbeit (#7362) erlaubt es, Bibliothekszeilen ohne Griff zu ziehen, lässt Touch-Nutzer mit Tipps eines zweiten Fingers einen Stapel kompatibler Ressourcen sammeln und zeigt beim Umsortieren Einfügelücken.

Die automatische Abdeckung des Resolvers läuft. Für die Zuweisung von Charakteren und den Austausch der Persona gibt es inzwischen Playwright-Tests auf dem Desktop. Lokal laufen sie im aktuellen Entwicklungscontainer allerdings nicht, weil Chromium `libnspr4.so` nicht laden kann. Diese Browser-Fälle müssen deshalb in der CI oder in einer Umgebung mit den Playwright-Systemabhängigkeiten laufen.

Bevor die restlichen Phasen starten, gelten die Koordinationsregeln des Repositorys:

1. Prüfe, ob es zum Thema Drag-and-drop von Chat-Ressourcen schon ein Issue, einen mit dem Issue verknüpften Branch, einen Draft-PR oder einen Projekteintrag gibt.
2. Mach am Issue sichtbar, wer die Arbeit übernimmt.
3. Öffne einen Draft-PR gegen `staging`, sobald die Umsetzung beginnt.

## Ziel

Nutzende sollen unterstützte Ressourcen aus dem rechten Panel direkt in den aktiven Chat ziehen können – ohne Umweg über die Chat-Einstellungen.

Das mittlere Fenster hat zwei mögliche Ziele:

- **Chat-Fläche:** ändert die dauerhafte Konfiguration des aktiven Chats.
- **Eingabefeld:** ergänzt den aktuellen Entwurf um einen unterstützten Anhang.

Das sind keine universellen Ablegeziele. Ein Ziel erscheint nur, wenn es für das gezogene Element dort eine echte, aktuell unterstützte Operation gibt.

## Produktregel

Das Ziehen wählt Ressource und Ziel aus. Ausgeführt werden nur Operationen, die Chat-Datenmodell und Generierungs-Pipeline bereits abbilden.

- Genau eine gültige ergänzende Operation: sofort anwenden und Undo (rückgängig machen) anbieten.
- Genau eine gültige ersetzende Operation: bestätigen lassen, sobald ein vorhandener Wert überschrieben würde.
- Mehrere wirklich unterstützte Operationen: eine kleine Auswahl zeigen, die nur diese Operationen enthält.
- Keine gültige Operation: kein Ziel aktivieren.
- Bereits zugewiesene Ressource: kein doppeltes Ablegen annehmen.
- Kein spekulativer Kontext für einen Zug, keine versteckte Prompt-Einfügung, keine synthetischen Erwähnungen, keine dekorativen Chips.

## Aktuelle Verträge

Die vorhandenen Verträge `Chat` und `ChatMetadata` unterstützen diese dauerhaften Operationen:

- Charaktere: `Chat.characterIds` aktualisieren.
- Persona: `Chat.personaId` aktualisieren.
- Prompt-Preset: `Chat.promptPresetId` aktualisieren.
- Verbindung: `Chat.connectionId` aktualisieren.
- Lorebooks: `ChatMetadata.activeLorebookIds` aktualisieren.
- Agenten: `ChatMetadata.activeAgentIds` aktualisieren und, sobald angenommen, `ChatMetadata.enableAgents`.
- Chat-Hintergrund: die vorhandenen Metadaten zum Chat-Hintergrund über denselben Zuweisungsweg aktualisieren, den `BackgroundPicker` nutzt.

Die vorhandenen Eingabefelder unterstützen Datei-Anhänge. Referenzen auf Charakter, Lorebook, Agent, Persona, Preset oder Verbindung im Rahmen einer einzelnen Nachricht unterstützen sie bisher nicht.

## Matrix der unterstützten Aktionen

Der Capability-Resolver muss außerdem die geltenden Beschränkungen des Chat-Modus und die Verfügbarkeit der Ressource durchsetzen. Die Tabelle beschreibt die Operation für den Fall, dass die vorhandene Oberfläche sie im aktiven Modus ohnehin erlaubt.

| Ressource | Chat-Fläche | Eingabefeld | Verhalten beim Ablegen |
| --- | --- | --- | --- |
| Charakter | ID zu `characterIds` hinzufügen | Keine | Sofort hinzufügen; Toast-Benachrichtigung mit Undo |
| Lorebook | ID zu `activeLorebookIds` hinzufügen | Keine | Sofort hinzufügen; Toast-Benachrichtigung mit Undo |
| Agent | ID zu `activeAgentIds` hinzufügen | Keine | Sofort hinzufügen, solange Agenten aktiviert sind; sonst das Aktivieren der Agenten und das Hinzufügen bestätigen lassen |
| Persona | `personaId` setzen | Keine | Sofort setzen, wenn leer; bestätigen lassen, sobald eine andere Persona ersetzt wird |
| Prompt-Preset | `promptPresetId` setzen | Keine | Modus-Beschränkungen beachten; sofort setzen, wenn leer; bestätigen lassen, sobald ein anderes Preset ersetzt wird |
| Verbindung | `connectionId` setzen | Keine | Beim Wechsel der aktuellen Verbindung bestätigen lassen; alten und neuen Verbindungsnamen nennen |
| Chat-Hintergrund | Vorhandene Metadaten zum Chat-Hintergrund setzen | Keine | Die aktuelle Semantik der Hintergrund-Zuweisung nutzen; nur bestätigen lassen, wenn der vorhandene Ablauf es verlangt |
| Bild oder unterstützte Datei | Keine | Zu den Anhängen im Entwurf hinzufügen | Die vorhandene Pipeline zur Prüfung und Aufbereitung von Anhängen weiterverwenden |
| Ordner für Charaktere/Lorebooks/Agenten | Keine | Keine | Kein Ziel |
| Bedienelement aus den Einstellungen | Keine | Keine | Kein Ziel |
| Regex-Skript | Keine | Keine | Kein Ziel, solange es keinen Vertrag für eine chat-bezogene Zuweisung gibt |
| Eigene Funktion bzw. eigenes Tool | Keine | Keine | Kein Ziel, solange es keinen Vertrag für eine chat-bezogene Zuweisung gibt |
| Beitrag einer Erweiterung | Standardmäßig keine | Standardmäßig keine | Nur per Opt-in über eine künftige, typisierte Beitrags-API |

### Modus-Regeln

Die Modus-Regeln nicht in den Drag-Handlern verdoppeln. Der Resolver für die Ablege-Fähigkeiten soll dieselben Prädikate nutzen wie die vorhandene Oberfläche für Chat-Einrichtung und Chat-Einstellungen.

Mindestens gilt:

- Prompt-Presets bleiben im Conversation Mode nicht verfügbar, genau wie in `PresetsPanel`.
- Ein abgelegter Agent muss installiert, verfügbar und für den aktuellen Modus gültig sein.
- Operationen für Charakter, Persona, Lorebook, Verbindung und Hintergrund gibt es nur dort, wo das zugehörige Bedienelement zur Zuweisung ohnehin verfügbar ist.
- Chats ohne aktive ID zeigen kein Ablegeziel für Ressourcen.
- Streaming oder laufende Agenten sollen sichere Metadaten-Updates nicht blockieren, sofern ein vorhandener Änderungsweg das nicht ohnehin tut. Bestätigungen für Ersetzungen müssen den aktuellen Chat-Zustand vor dem Anwenden erneut lesen.

## Interaktionsdesign

### Beginn des Ziehens

Jede unterstützte Zeile im Panel schreibt genau einen versionierten Satz Ressourcen-Nutzdaten:

```ts
type ChatResourceDragPayload = {
  version: 1;
  kind: "character" | "lorebook" | "agent" | "persona" | "preset" | "connection" | "background";
  ids: string[];
  label: string;
};
```

Nutze genau einen eigenen MIME-Typ, zum Beispiel `application/x-marinara-chat-resource`. Behalte während der Migration die vorhandenen Ordner-Nutzdaten samt MIME-Typ. Das Umsortieren von Ordnern bleibt eine eigenständige, gültige Deutung desselben Ziehvorgangs.

Ressourcen-Ziehvorgänge sollen `copyMove` anbieten:

- Ordner-Ziele deuten den Ziehvorgang als Verschieben.
- Chat-Ziele deuten ihn als Kopieren beziehungsweise Zuweisen.

Verlass dich bei internen Ressourcen-Operationen nicht auf `text/plain`. Der Typ ist mehrdeutig und enthält aktuell nackte IDs.

### Sichtbarkeit der Ziele

Im Ruhezustand bleiben die Ablegeziele unsichtbar.

Sobald ein erkannter Ressourcen-Ziehvorgang das mittlere Fenster erreicht:

1. Die typisierten Nutzdaten parsen und prüfen.
2. Die gültigen Aktionen gegen den aktuellsten aktiven Chat auflösen.
3. Nur gültige Ziele anzeigen.
4. Aktionsbezogenen Text nutzen, etwa `Add Maris to this chat` statt eines allgemeinen `Drop here`.
5. Ungültige Bereiche unverändert und nicht ablegbar lassen.

Beim Ziehen einer unterstützten Datei hebt sich nur das Eingabefeld hervor. Beim Ziehen von Charakter, Lorebook, Agent, Persona, Preset, Verbindung oder Hintergrund hebt sich in der ersten Version nur die Chat-Fläche hervor.

### Ablegen auf der Chat-Fläche

Der aktive Ablegebereich ist die aktuelle Chat-Fläche, unabhängig von der Scrollposition im Chatverlauf. Ein Ablegen über einer alten Nachricht fügt nichts in den Verlauf ein und ändert den Kontext nicht rückwirkend.

Beim Ablegen:

1. Die aktive Chat-ID und die aktuellen Chat-Daten erneut lesen.
2. Die Fähigkeit erneut auflösen, damit keine veralteten oder doppelten Aktionen entstehen.
3. Sofort anwenden, wenn die Aktion ergänzend und eindeutig ist.
4. Ein fokussiertes Fenster zur Bestätigung öffnen, sobald ersetzt oder ein Agent aktiviert wird.
5. Den Erfolg über eine lokalisierte Toast-Benachrichtigung mit Undo melden.
6. Eine fehlgeschlagene Änderung melden, ohne den Chatverlauf anzufassen.

Leg keine Nachrichten von User, Assistant, Narrator oder System an, um Konfigurationsänderungen festzuhalten. Das Nachrichtenmodell kennt keinen eigenen Typ für Aktivitäts-Events, und Konfigurations-Events dürfen nicht in den für das Modell sichtbaren Verlauf geraten.

### Ablegen im Eingabefeld

Erhalte das aktuelle Verhalten für Dateien in `ChatInput` und `ConversationInput`:

- Unterstützte Typen und die Größengrenze von 20 MB prüfen.
- Bilder über `prepareImageAttachment` aufbereiten.
- Unterstützte Text- und PDF-Dateien über den aktuellen Weg für Anhänge lesen.
- Das Entwurfsverhalten für ausstehende Anhänge pro Chat beibehalten.

Verschärfe die Erkennung im Eingabefeld, damit interne Ressourcen-Ziehvorgänge nicht die Hervorhebung für Datei-Ablagen auslösen und danach nichts tun.

### Bestätigung

Bestätigen lassen nur dort, wo die Operation eine spürbare Folge hat:

- Eine aktive Persona wird ersetzt.
- Ein aktives Prompt-Preset wird ersetzt.
- Eine aktive Verbindung wird gewechselt.
- Agenten werden aktiviert, um einen Agenten hinzuzufügen.
- Ein vorhandener Weg zur Hintergrund-Zuweisung verlangt ohnehin eine Auswahl oder eine Bestätigung der Ersetzung.

Bestätigungen müssen den aktuellen und den vorgeschlagenen Wert nennen, wo das sinnvoll ist. Fremde Aktionen gehören nicht hinein – etwa einen neuen Chat starten, einen Agenten einmalig aufrufen oder die Ressource in einer Nachricht erwähnen.

### Undo

Undo stellt exakt den Wert von vor dem Ablegen wieder her, keine rekonstruierte Vermutung.

- Charakter: das vorherige, vollständige Array `characterIds` wiederherstellen.
- Lorebook: das vorherige, vollständige Array `activeLorebookIds` wiederherstellen.
- Agent: sowohl `activeAgentIds` als auch `enableAgents` wiederherstellen.
- Persona, Preset, Verbindung und Hintergrund: den vorherigen Wert wiederherstellen.

Prüfe vor dem Ausführen von Undo, ob im aktiven Chat noch der Wert aus dem Ablegen steht. Hat inzwischen eine andere Änderung dasselbe Feld angefasst, überschreib sie nicht: Verwirf das veraltete Undo und weise darauf hin, dass sich der Chat geändert hat.

## Architektur

### Gemeinsames Client-Modul

Ergänze ein eng umrissenes Client-Modul, vorläufig `packages/client/src/lib/chat-resource-drag.ts`, mit:

- der MIME-Konstante;
- dem Typ der Nutzdaten und einem Parser zur Laufzeit;
- `writeChatResourceDragPayload(dataTransfer, payload)`;
- der Erkennung von Datei-Ziehvorgängen;
- Guards für die Art der Ressource.

Halte die Nutzdaten in der ersten Version rein clientseitig. Sie sind Zustand einer Browser-Interaktion, kein API-Vertrag.

### Capability-Resolver

Ergänze einen reinen Resolver, vorläufig `packages/client/src/lib/chat-resource-drop-capabilities.ts`:

```ts
type ChatResourceDropAction =
  | { type: "add-characters"; ids: string[] }
  | { type: "add-lorebooks"; ids: string[] }
  | { type: "add-agents"; ids: string[]; mustEnableAgents: boolean }
  | { type: "set-persona"; id: string; replacesId: string | null }
  | { type: "set-preset"; id: string; replacesId: string | null }
  | { type: "set-connection"; id: string; replacesId: string | null }
  | { type: "set-background"; id: string };
```

Als Eingaben dienen die geparsten Ressourcen-Nutzdaten, der aktive Chat, die normalisierten Metadaten, der aktuelle Modus und die verfügbaren Ressourcen-IDs. Ausgabe ist entweder genau eine konkrete Aktion oder `null`.

Der Resolver verantwortet:

- das Unterdrücken von Duplikaten;
- die Modus-Beschränkungen;
- das Filtern mehrerer IDs;
- die Prüfung auf installiert und verfügbar;
- das Erkennen von Ersetzungen;
- die Wahl des Schlüssels für den sichtbaren Aktionstext.

Der Resolver ändert keine Daten und rendert keine Oberfläche.

### Mutations-Koordinator

Ergänze nahe der Chat-Fläche genau einen Hook, vorläufig `use-chat-resource-drop.ts`. Er:

- liest beim Ablegen den aktuellsten aktiven Chat aus React Query beziehungsweise Zustand;
- ruft `useUpdateChat` für die Felder auf oberster Chat-Ebene auf;
- ruft `useUpdateChatMetadata` für Lorebooks und Agenten auf;
- nutzt den vorhandenen Änderungsweg für die Hintergrund-Zuweisung weiter;
- öffnet lokalisierte Bestätigungen über die vorhandenen App-Dialog-Helfer;
- erzeugt Toast-Benachrichtigungen für Erfolg und Fehler sowie abgesicherte Undo-Aktionen.

Asynchrone Änderungslogik gehört nicht in einen Zustand-Store.

### Ablege-Overlay

Ergänze genau eine darstellende Komponente an der gemeinsamen Grenze der mittleren Chat-Fläche – und nicht je Chatverlauf eine eigene Umsetzung:

- Sie bekommt die aktuellen Nutzdaten des Ziehvorgangs und die aufgelöste Aktion.
- Sie deckt die Chat-Fläche ab, ohne das Eingabefeld zu verdecken.
- Sie zählt `dragenter` und `dragleave` in der Tiefe mit, damit nichts über Kindelementen flackert.
- Sie zeigt Icon, Bezeichnung der Ressource und lokalisierten Aktionstext.
- Sie reagiert auf Zeigegerät und Theme.

Die Flächen von Conversation und Roleplay/Game sollen über denselben Koordinator laufen. Flächenspezifische Wrapper dürfen die Geometrie liefern, aber keine Regeln zu Fähigkeiten verdoppeln.

### Anbindung der Panels

Stell die ziehbaren Zeilen Schritt für Schritt um:

1. Charaktere.
2. Lorebooks.
3. Agenten.
4. Personas.
5. Presets.
6. Verbindungen.
7. Hintergründe, sofern sich der vorhandene Zuweisungsvertrag sauber weiterverwenden lässt.

Jede Zeile behält ihre bisherigen Ordner-Nutzdaten und ergänzt die Nutzdaten für Chat-Ressourcen. Am Verschieben von Ordnern ändert sich nichts.

## Umsetzungsphasen

### Phase 1: Vertrag für den Ziehvorgang und Overlay in der Mitte

- Das Modul für die typisierten Nutzdaten samt Parser ergänzen.
- Den reinen Capability-Resolver für Charaktere, Lorebooks und Agenten ergänzen.
- Das Overlay über der mittleren Chat-Fläche und den Mutations-Koordinator ergänzen.
- Die Panel-Zeilen für Charakter, Lorebook und Agent anbinden.
- Lokalisierte Texte für Aktion, Bestätigung, Erfolg, Fehler, Duplikat und Undo ergänzen.
- Sicherstellen, dass interne Ressourcen-Ziehvorgänge keine Datei-Hervorhebung im Eingabefeld auslösen.

Diese Phase belegt den ergänzenden Hauptablauf, um den es bei der Funktion geht.

### Phase 2: Ersetzende Ressourcen

- Nutzdaten für Persona, Preset und Verbindung ergänzen.
- Das Erkennen von Ersetzungen und lokalisierte Bestätigungsfenster ergänzen.
- Vorhandene Modus-Beschränkungen und Änderungs-Hooks weiterverwenden.
- Abgesichertes Undo für ersetzende Operationen ergänzen.

### Phase 3: Hintergrund-Zuweisung

- Klären, ob der vorhandene Auswahlablauf des Hintergrund-Pickers eine abgelegte Hintergrund-ID annehmen kann, ohne Regeln zu verdoppeln.
- Hintergründe nur dann ziehbar machen, wenn sich dasselbe chat-bezogene Zuweisungsverhalten weiterverwenden lässt.
- Sonst Hintergründe weiterhin nicht unterstützen und den Blocker im Issue beziehungsweise PR festhalten.

### Phase 4: Gleichwertigkeit für Touch und ohne Ziehen

Drag-and-drop per HTML auf dem Desktop ist der erste Umsetzungspfad. Mobil darf die Funktion nicht von präzisem Ziehen über Panel-Grenzen hinweg abhängen.

- Jede unterstützte Zeile bekommt in ihrem vorhandenen Aktionsmenü den Eintrag `Add to active chat`.
- Denselben Capability-Resolver, dieselben Bestätigungen und Änderungen sowie dasselbe Undo-Verhalten weiterverwenden.
- Bleibt das Ziehen per Touch erhalten, nutze die vorhandenen Touch-Ziehgriffe und ermittle das Ziel in der Mitte über `elementFromPoint`.
- Das Verhalten beim langen Drücken auf Ordner nicht so überladen, dass das Organisieren unzuverlässig wird.

Ohne diese Phase gilt die Funktion auf Mobilgeräten nicht als fertig.

## Erwartete Dateiänderungen

Wahrscheinlich neue Dateien:

- `packages/client/src/lib/chat-resource-drag.ts`
- `packages/client/src/lib/chat-resource-drop-capabilities.ts`
- `packages/client/src/hooks/use-chat-resource-drop.ts`
- `packages/client/src/components/chat/ChatResourceDropOverlay.tsx`

Wahrscheinlich geänderte Dateien:

- `packages/client/src/components/chat/ChatArea.tsx` oder der kleinste gemeinsame Besitzer der mittleren Fläche.
- `packages/client/src/components/chat/ChatRoleplaySurface.tsx`, falls die Geometrie der Fläche es verlangt.
- `packages/client/src/components/chat/ConversationView.tsx`, falls die Geometrie der Fläche es verlangt.
- `packages/client/src/components/chat/ChatInput.tsx`.
- `packages/client/src/components/chat/ConversationInput.tsx`.
- `packages/client/src/components/panels/CharactersPanel.tsx`.
- `packages/client/src/components/panels/LorebooksPanel.tsx`.
- `packages/client/src/components/panels/AgentsPanel.tsx`.
- `packages/client/src/components/panels/PersonasPanel.tsx`.
- `packages/client/src/components/panels/PresetsPanel.tsx`.
- `packages/client/src/components/panels/ConnectionsPanel.tsx`.
- `packages/client/src/components/panels/settings/BackgroundPicker.tsx`, nur in Phase 3.
- `packages/client/src/localization/locales/en.json` oder der zum Zeitpunkt der Umsetzung gültige kanonische englische Katalog.

Für die Phasen 1 und 2 sind keine Änderungen an Server- oder Shared-Paketen zu erwarten. Zeigt sich bei der Umsetzung, dass eine Operation die vorhandenen Patch-Routen für Chats nicht nutzen kann, dann stopp und schneide den Plan neu zu – statt einen versteckten Prompt- oder Persistenz-Vertrag einzuführen.

## Anforderungen an Barrierefreiheit und Eingabe

- Nicht allein auf Farbe verlassen; Ressourcen-Icon und Aktionstext zeigen.
- Die Entsprechung ohne Ziehen darf sich nicht erst beim Draufzeigen zeigen.
- Bestätigungen sind per Tastatur bedienbar und geben den Fokus beim Schließen zurück.
- Esc bricht eine offene Bestätigung ab.
- Screenreader bekommen eine knappe Ansage, sobald ein gültiges Ablegeziel erscheint und sobald eine Operation gelingt oder scheitert.
- Ablege-Overlays dürfen normales Scrollen nicht abfangen, solange kein erkannter Ziehvorgang läuft.
- Touch-Ziele halten die vorhandenen Mindestgrößen für Mobilgeräte ein.
- Bei reduzierter Bewegung ändern sich Deckkraft und Zustand ohne unnötige Bewegung.

## Lokalisierung

Aller neue sichtbare Text nutzt sprechende Lokalisierungsschlüssel. Aktualisiere nur den kanonischen englischen Katalog; Community-Sprachen dürfen auf Englisch zurückfallen.

Zu den Textkategorien gehören:

- Aktions-Beschriftungen je Ressourcenart.
- Bestätigungen bei Ersetzungen.
- Bestätigung zum Aktivieren von Agenten.
- Toast-Benachrichtigungen für Erfolg und Fehler.
- Meldungen zu Undo und zu veraltetem Undo.
- Ansagen für die Barrierefreiheit.
- Rückmeldung bei Duplikaten und bereits aktiven Ressourcen, falls sie angezeigt wird.
- Aktionen `Add to active chat` ohne Ziehen.

## Tests

Lass keine temporären `.test.ts`-Dateien im Repository liegen.

### Reine Regressions-Abdeckung

Ergänze dauerhafte Abdeckung für den Capability-Resolver nur an einem vorhandenen, unterstützten Ort und in einem vorhandenen Format für Regressionstests:

- Charakter fehlt -> Aktion zum Hinzufügen.
- Charakter bereits vorhanden -> keine Aktion.
- Gemischte Nutzdaten mit mehreren Charakteren -> nur die fehlenden gültigen IDs hinzufügen.
- Lorebook fehlt -> Aktion zum Hinzufügen.
- Lorebook bereits aktiv -> keine Aktion.
- Agent fehlt, Agenten sind aktiviert -> Aktion zum Hinzufügen.
- Agent fehlt, Agenten sind deaktiviert -> Aktion zum Hinzufügen, die das Aktivieren verlangt.
- Agent nicht verfügbar -> keine Aktion.
- Persona ohne aktuelle Persona -> setzende Aktion ohne Ersetzung.
- Persona ersetzt eine andere -> ersetzende Aktion.
- Preset in einem nicht unterstützten Modus -> keine Aktion.
- Verbindung entspricht der aktuellen Verbindung -> keine Aktion.
- Ungültige Version, unbekannte Art, fehlerhafte IDs und übergroße Nutzdaten -> abgelehnt.

### Smoke-Abdeckung im Browser

Erweitere `pnpm smoke:ui`, wo es praktikabel ist:

- Einen Charakter aus dem Panel auf die Chat-Fläche ziehen und die Zuweisung prüfen.
- Undo auslösen und prüfen, ob die vorherige Charakterliste zurück ist.
- Prüfen, dass ein Charakter-Ziehvorgang über dem Eingabefeld keine Rückmeldung für Datei-Ablagen zeigt.
- Eine unterstützte Datei über das Eingabefeld ziehen und prüfen, ob das Verhalten bei Anhängen unverändert bleibt.
- Prüfen, dass eine bereits aktive Ressource kein aktives Ablegeziel hat.
- Prüfen, dass sich eine Bestätigung zur Ersetzung ohne Änderung abbrechen lässt.
- Prüfen, dass eine bestätigte Ersetzung den Chat aktualisiert.
- Prüfen, dass Drag-and-drop von Ordnern die Ressourcen weiterhin im Panel verschiebt.

### Manuelle Prüfung

Prüfe auf dem Desktop in den Modi Conversation, Roleplay und Game, soweit unterstützt:

- Dunkles und helles Theme.
- Rechtes Panel offen, mit langem und gescrolltem Chatverlauf.
- Ergänzendes Ablegen, doppeltes Ablegen, Ersetzung, Abbruch, Fehler, Undo und veraltetes Undo.
- Ziehbewegung über verschachtelte Elemente des Chatverlaufs, ohne dass das Overlay flackert.
- Das vorhandene Verschieben von Ordnern im Panel.
- Die vorhandenen Datei- und Bild-Ablagen in beiden Eingabefeldern.

Prüfe in einem mobilen Viewport oder mit grobem Zeigegerät:

- Die Gleichwertigkeit von `Add to active chat` ohne Ziehen.
- Das vorhandene Ziehen von Ordnern per Touch bleibt nutzbar.
- Bestätigungen passen auf den Bildschirm und lassen sich schließen.
- Kein Text und keine Bedienelemente überlappen.

Nötige Befehle:

```bash
pnpm localization:check
pnpm check
pnpm regression:prompt
pnpm smoke:ui
```

`pnpm regression:prompt` ist vor dem Merge Pflicht: Die Änderung an `LorebooksPanel.tsx` betrifft das Aktivieren von Lorebooks, und das fließt in den Prompt-Aufbau ein.

## Risiken und Gegenmaßnahmen

### Konflikt mit dem vorhandenen Ordner-Ziehen

Risiko: Dieselben Zeilen nutzen Drag-and-drop bereits, um Elemente in Ordner zu verschieben.

Gegenmaßnahme: Die vorhandenen MIME-Typen für Ordner behalten, einen separaten, typisierten MIME-Typ für Chat-Ressourcen ergänzen und jedes Ziel nur seine eigenen Nutzdaten deuten lassen. Das `copyMove`-Verhalten und Ordner-Regressionen prüfen.

### Falsche Hervorhebung im Eingabefeld

Risiko: Die aktuellen `dragover`-Handler im Eingabefeld reagieren auf jeden Ziehvorgang, auch auf interne Ressourcen-IDs.

Gegenmaßnahme: Die Rückmeldung im Eingabefeld nur dann aktivieren, wenn `DataTransfer.types` oder `DataTransfer.items` auf Dateien oder auf andere ausdrücklich unterstützte Anhang-Nutzdaten hinweist.

### Veralteter Chat-Zustand

Risiko: Der aktive Chat oder die zugewiesenen Ressourcen können sich zwischen Ziehbeginn, Ablegen, Bestätigung und Undo ändern.

Gegenmaßnahme: Beim Ablegen gegen den aktuellen Zustand auflösen und vor Änderung oder Undo noch einmal. Undo davor schützen, neuere Änderungen zu überschreiben.

### Abdriften der Modus-Regeln

Risiko: Drag-and-drop könnte eine Zuweisung erlauben, die die Oberfläche für Einrichtung und Einstellungen verbietet.

Gegenmaßnahme: Gemeinsame Prädikate aus den vorhandenen Zuweisungsabläufen herauslösen oder weiterverwenden. Keine zweite Regelmatrix in den Panel-Komponenten fest verdrahten.

### Versteckte Ausweitung des Verhaltens

Risiko: Nimmt das Eingabefeld Ressourcen sichtbar an, verspricht das einen Kontext für einen Zug, den der Server nicht einlöst.

Gegenmaßnahme: Ressourcen-Ablagen im Eingabefeld deaktiviert lassen, bis es einen eigens entworfenen Vertrag für nachrichtenbezogenen Kontext gibt.

### Ablegen großer Auswahlen

Risiko: Ziehen im Auswahlmodus könnte unerwartet viele Charaktere, Lorebooks oder Agenten hinzufügen.

Gegenmaßnahme: Ungültige und bereits aktive IDs filtern, vorhandene Grenzen von Server und Modus beachten und eine Bestätigung verlangen, sobald ein Mehrfach-Ablegen eine vorhandene Schwelle überschreitet. Keine neue, willkürliche Grenze erfinden.

## Ausdrückliche Nicht-Ziele

- Eine Ressource auf einer alten Nachricht ablegen.
- Die Prompt-Historie nachträglich ändern.
- Konfigurationsänderungen als Nachrichten im Chatverlauf festhalten.
- Charaktere, Lorebooks, Personas, Presets, Verbindungen oder Agenten für nur einen Zug.
- Einen Agenten aufrufen, indem man ihn auf dem Eingabefeld ablegt.
- Einen neuen Chat aus einer Ablage in der mittleren Fläche starten.
- Beliebige Einstellungen in den Chat ziehen.
- Eine allgemeine Plugin-API zum Ablegen in der ersten Version.
- Chat-übergreifendes Ziehen von einem Chatverlauf in einen anderen.

## Abnahmekriterien

Phase 1 ist abgenommen, wenn:

- sich Charakter, Lorebook oder Agent aus der Zeile im rechten Panel auf eine gültige aktive Chat-Fläche ziehen lassen;
- das richtige vorhandene Chat-Feld aktualisiert wird, ohne eine Nachricht im Chatverlauf anzulegen;
- bereits aktive und nicht verfügbare Ressourcen nicht angenommen werden;
- das Hinzufügen eines Agenten bei deaktivierten Agenten eine ausdrückliche Bestätigung verlangt;
- jede erfolgreiche Änderung ein abgesichertes Undo anbietet;
- Ressourcen-Ziehvorgänge keine Rückmeldung zu Anhängen im Eingabefeld auslösen;
- vorhandene Datei-Anhänge in beiden Eingabefeldern weiterhin per Ablegen funktionieren;
- sich am vorhandenen Drag-and-drop-Verhalten für Ordner nichts ändert;
- aller neue sichtbare Text lokalisiert ist;
- Desktop und Mobilgeräte gleichwertige Aktionen haben, auch wenn mobil ein Menüeintrag statt des Ziehens über Panel-Grenzen greift;
- `pnpm localization:check`, `pnpm check` und die passenden UI-Smoke-Tests durchlaufen.

Die gesamte Funktion ist abgenommen, wenn zusätzlich die ersetzenden Ressourcen aus Phase 2 und die nötige mobile Gleichwertigkeit fertig sind. Die Hintergrund-Zuweisung bleibt optional, bis Phase 3 bestätigt, dass sich ihre vorhandene Semantik ohne doppelte Regeln weiterverwenden lässt.

## Zurückgestellte Erweiterung

Eine künftige Funktion für nachrichtenbezogenen Kontext könnte Charaktere, Lorebooks, Agenten, Personas, Presets oder Verbindungen zu gültigen Ablagen im Eingabefeld machen. Dafür braucht es einen eigenen Vertrag in Shared und Server, der Persistenz, Prompt-Aufbau, Token-Budget, Anbieter-Routing, Darstellung, Wiederherstellung von Entwürfen und die Semantik der Nachrichten-Historie festlegt. Als reine Client-Chips darf das nicht in diese Funktion hineingeschmuggelt werden.
