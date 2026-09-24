# Architektur der Personal Extensions

**Personal Extensions** (persönliche Erweiterungen) sind standardmäßig deaktiviert, per Hash freigegeben und laufen in zwei voneinander isolierten Laufzeitumgebungen. Standardmäßig steht nur eine Klasse zur Verfügung: Entwürfe von Professor Mari. Jede andere Herkunft gilt als **External Extension** (externe Erweiterung) und braucht zwei unabhängige Freigaben durch die betreibende Person.

## Sicherheitsgarantien

Diese Eigenschaften müssen jederzeit gelten:

1. Neu angelegte und importierte Erweiterungen sind immer deaktivierte, nicht freigegebene Entwürfe.
2. Eine Freigabe verlangt den exakten aktuellen `sha256:`-Hash des Inhalts und eine ausdrückliche Bestätigung, dass Code ausgeführt wird. Der Vollzugriff auf die Seite verlangt eine weitere ausdrückliche Bestätigung.
3. Jede Änderung am ausführbaren Code deaktiviert die Erweiterung und löscht `approvedHash`.
4. Ein Rollback stellt einen deaktivierten Entwurf wieder her.
5. Backup und Profil-Import setzen Freigabe und Aktivierung zurück.
6. Professor Mari darf Entwürfe anlegen und aktualisieren, hat aber keine Aktion, die sie freigibt oder aktiviert.
7. Jede Herkunft außer `professor_mari` gilt als extern – also `external`, `local`, `legacy`, `profile_import` sowie unbekannte Werte, die zu `legacy` normalisiert werden.
8. Externe Datensätze tauchen weder in der Verwaltung noch in Laufzeit-Antworten auf, solange nicht `ENABLE_EXTERNAL_EXTENSIONS=true` gesetzt ist **und** zusätzlich die gespeicherte Zustimmung in der **Danger Zone** (Gefahrenbereich) vorliegt.
9. Schließt eine der beiden Freigaben, deaktiviert Marinara die gespeicherten externen Datensätze und beendet laufende Server-Prozesse. Das Polling der Browser-Laufzeit entfernt aktive Browser-Worker.
10. Browser-Code aus der Sandbox läuft nie im Marinara-Dokument. Nur eine externe Browser-Erweiterung mit einem per exaktem Hash freigegebenen `full_page_access` darf die separate Seiten-Laufzeit nutzen. Server-Code läuft nie im Marinara-Serverprozess.
11. Es gibt weder einen URL-Installer noch einen entfernten Katalog oder einen automatischen Updater.
12. Beiträge an die Host-Oberfläche sind schlichte, validierte Deskriptoren. Markup, Styles, URLs, Komponenten und Callbacks einer Erweiterung gelangen niemals in Marinaras React-Baum.
13. Registrierung, Aktivierung, Events, Updates und Entfernen eines Beitrags bleiben an den exakten freigegebenen Inhalts-Hash der aktivierten Erweiterung gebunden.
14. Kontext-Schnappschüsse im Browser enthalten grundsätzlich nur die ID des aktiven Chats und die Charakter-IDs. Die optionalen Berechtigungen `read_active_characters` und `read_active_persona` können begrenzte, per Allowlist freigegebene Felder ergänzen – ausschließlich aus Datensätzen, die in diesem Chat aktiv sind. Nachrichten, ganze Bibliotheken, nicht deklarierte Felder, Metadaten oder Anwendungszugriff geben sie nie preis.
15. Angeforderte Berechtigungen fließen in den Hash des ausführbaren Codes ein. Jede Änderung daran deaktiviert die Erweiterung und verlangt eine neue Freigabe mit exaktem Hash.
16. `full_page_access` gibt es nur extern, verlangt beide **External Extension**-Freigaben und steht Entwürfen von Professor Mari nie zur Verfügung. Es ist ein ausdrücklicher Vertrauensmodus und kein Versprechen einer Sandbox.

Durchgesetzt werden die beiden Freigaben in den Routen und in den Laufzeitdiensten. Bedienelemente auszublenden ist keine Sicherheitsgrenze. Ein extern stammender Datensatz – von Hand angelegt, wiederhergestellt, aus einer Altversion oder auf anderem Weg eingeschleust – muss unsichtbar und nicht ausführbar bleiben, solange eine der beiden Freigaben fehlt.

## Speicherung und Richtlinie

Die Dateitabelle `installed_extensions` speichert Metadaten, ausführbaren Code, `contentHash`, `approvedHash`, die Herkunft und bis zu zehn frühere Code-Revisionen. Private Einstellungen einer Erweiterung liegen in `app_settings` unter Schlüsseln mit dem Präfix `extension-storage:`. Die Zustimmung in der **Danger Zone** steckt in `external-extensions-enabled`.

Beim Start läuft `preparePersonalExtensionTrust`. Eine alte Zeile ohne Hash bleibt erhalten, ist aber deaktiviert und nicht freigegeben. Eine Zeile, deren gespeicherter Hash nicht mehr zu ihren ausführbaren Feldern passt, wird ebenfalls deaktiviert und neu gehasht.

`personal-extension-policy.service.ts` verbindet die aktive `.env`-Freigabe mit der gespeicherten Zustimmung. `personal-extension-storage.service.ts` kann alle Datensätze deaktivieren, die nicht von Professor Mari stammen. Der `.env`-Watcher wendet die Richtlinie innerhalb von rund zwei Sekunden erneut an und weist die Server-Laufzeit an, den Code zu stoppen, sobald die Freigabe schließt.

## API

Die Verwaltung liegt unter `/api/personal-extensions`:

- `GET /policy` liefert beide Freigabe-Zustände und die Verfügbarkeit der Server-Sandbox.
- `PATCH /policy/external` ändert die Zustimmung in der **Danger Zone** und lehnt `true` ab, solange die `.env`-Freigabe geschlossen ist.
- `GET /` listet die Entwürfe von Professor Mari – externe Entwürfe nur dann, wenn beide Freigaben offen sind.
- `POST /` importiert eine **External Extension** und wird abgelehnt, solange nicht beide Freigaben offen sind.
- `PATCH /:id` bearbeitet oder deaktiviert einen Entwurf.
- `POST /:id/approve` gibt genau den aktuellen Hash frei, wendet die externe Freigabe an und verweigert die Freigabe von Server-Code ohne unterstützte Betriebssystem-Sandbox.
- `POST /:id/rollback` stellt eine frühere, deaktivierte Revision wieder her.
- `DELETE /:id` löscht die Erweiterung samt privaten Einstellungen.

Die Metadaten der freigegebenen Browser-Laufzeit kommen von `GET /runtime/client`. Code aus der Sandbox liefert `GET /:id/sandbox.html?hash=...`. Code und CSS für den Seiten-Vollzugriff liefern `GET /:id/page-runtime.js?hash=...` und `GET /:id/page-style.css?hash=...`. Bei jedem Endpunkt muss genau dieser Hash aktiviert, freigegeben und von der Richtlinie erlaubt sein; die Seiten-Endpunkte verlangen zusätzlich eine externe Herkunft und `full_page_access`.

## Browser-Laufzeit in der Sandbox

`PersonalExtensionInjector.tsx` legt ein verstecktes iframe mit `sandbox="allow-scripts"` und ohne `allow-same-origin` an. Damit hat das iframe eine undurchsichtige Herkunft und kommt weder an Marinaras DOM noch an Cookies, Speicher oder Same-Origin-APIs.

Die Sandbox-Antwort ersetzt die normale Seitenrichtlinie durch eine sehr enge CSP: keine Standard-Ressourcen, keine Verbindungen, keine Formulare, keine Objekte, keine Navigationsrechte. Das CSS der Erweiterung bleibt im versteckten iframe. JavaScript läuft in einem eigenen Worker, den der vertrauenswürdige iframe-Bootstrap erzeugt. Netzwerk-Globals und Globals für verschachtelte Worker entfernt Marinara zusätzlich als weitere Schutzschicht.

Der Worker bekommt ausschließlich:

- Logging mit eigenem Namensraum;
- privaten Speicher der Erweiterung, vermittelt durch das Elterndokument;
- verwaltete Timer;
- eine Registrierung für Aufräumarbeiten;
- nur lesbare IDs des aktiven Chats und der Charaktere über `marinara.context`;
- begrenzte Felder aus den aktiven Charakterkarten und der gewählten Persona, und zwar nur über separat freigegebene Fähigkeiten;
- ein eingeschränktes iframe-Fenster über `marinara.ui.showWindow(...)`;
- vertrauenswürdige Beitragsplätze im Host über `marinara.ui.registerContribution(...)`.

Version 5 der Browser-Erweiterungs-API ergänzt `marinara.context.get()` und `marinara.context.subscribe(listener)`. Der unveränderliche Schnappschuss hat diese Form:

```ts
{
  chatId: string | null;
  characterId: string | null;
  characterIds: readonly string[];
  personaId: string | null;
  characters: readonly PersonalExtensionCharacterSnapshot[];
  persona: PersonalExtensionPersonaSnapshot | null;
}
```

Der Client leitet den Schnappschuss aus `useChatStore` ab und schickt ihn, sobald sich der aktive Chat, seine Charakterliste oder die gewählte Persona ändert. IDs sind nicht leere Zeichenketten mit höchstens 256 Zeichen; die Charakterliste ist bereinigt und auf 256 Einträge begrenzt. Das iframe nimmt ein Kontext-Update nur vom Elterndokument an, und nur wenn dessen `contentHash` zur exakten Revision der Erweiterung passt; danach normalisiert der Worker die Nutzdaten und friert sie erneut ein. Der Start einer Erweiterung wartet auf den ersten Schnappschuss des Hosts – nach einer Sekunde greift ein leerer Kontext als Rückfalloption, damit eine gescheiterte Brücke den Worker nicht dauerhaft blockiert.

`characterId` ist eine Abkürzung für Einzelchats und bleibt in Gruppenchats `null`; `characterIds` enthält alle aktiven Teilnehmenden. `personaId` gibt es nur mit `read_active_persona`. Ohne aktiven Chat sind `chatId`, `characterId`, `personaId` und `persona` gleich `null`, während `characterIds` und `characters` leer bleiben. Die IDs lassen sich gefahrlos als Schlüssel im eigenen privaten Speicher der Erweiterung verwenden.

`read_active_characters` erlaubt in `characters` ausschließlich `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe` und `conversationDisplayName` der aktiven Karten. `read_active_persona` erlaubt in `persona` ausschließlich `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe` und `conversationDisplayName`. Der Server leitet beide Mengen aus dem aktiven Chat ab, wendet Grenzen pro Feld und für die Gesamtmenge an und akzeptiert nie eine vom Client gelieferte Datensatz-ID als Nachweis für den Geltungsbereich.

Fähigkeiten stehen in den Nutzdaten der Erweiterung, werden mit jeder Revision gespeichert, in den **Settings** (Einstellungen) und im Freigabe-Dialog angezeigt und fließen in den Hash des ausführbaren Codes ein. Der Host schickt zuerst den Schnappschuss mit den reinen IDs und reichert ihn danach über den freigegebenen, erweiterungsspezifischen Vermittler an. Der Worker verwirft eigenständig nicht deklarierte Datensätze, weist Charakter-Datensätze mit IDs außerhalb von `characterIds` zurück, begrenzt die Nutzdaten erneut und friert das Ergebnis ein.

`marinara.ui.showWindow({ title, elements, onEvent, onClose })` gibt ein Handle mit `update({ title?, elements? })` und `close()` zurück. Der Worker schickt nur Deskriptoren; jedes Element baut der vertrauenswürdige iframe-Bootstrap über DOM-APIs und `textContent` – nie über `innerHTML`. Der Host zeigt das sonst versteckte Sandbox-iframe nur, solange ein Fenster offen ist, und blendet es beim Schließen wieder aus.

`marinara.ui.registerContribution({ id, kind, label, description?, icon?, surface?, position?, elements?, onActivate?, onEvent? })` gibt ein eingefrorenes Handle mit `update(patch)` und `remove()` zurück. Es unterstützt diese vertrauenswürdigen Host-Bereiche:

- `button`: standardmäßig eine kompakte Aktion in der oberen Leiste oder eine vom Host gerenderte Aktion auf der Oberfläche `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents` oder `settings`;
- `menu-item`: eine Aktion im Menü **Extensions**;
- `panel`: ein Eintrag, der Marinaras vertrauenswürdiges **Extensions**-Panel öffnet.

Schaltflächen in Seitenpanels akzeptieren `position: "header"`, `"before-content"` oder `"after-content"`. Schaltflächen der oberen Leiste lassen `position` weg. Icons verwenden begrenzte Kebab-Case-Namen aus Marinaras Lucide-Katalog; nicht unterstützte Namen fallen auf das Puzzle-Symbol zurück.

Panel-Elemente nutzen dasselbe deklarative Vokabular wie eingeschränkte Fenster: `heading`, `text`, `pre`, `button`, `input`, `select`, `toggle`, `slider`, `color` und `spacer`. Interaktive Bedienelemente brauchen eindeutige IDs. Eine Schaltfläche im Panel schickt `{ contributionId, elementId, values }` an `onEvent`; `values` enthält den aktuellen Zeichenketten-Wert jedes Bedienelements. `onActivate` läuft im Worker der Erweiterung, sobald jemand den Beitrag öffnet oder auslöst. Nach Zustandsänderungen kann die Erweiterung per `handle.update(...)` Label, Beschreibung, Icon oder Panel-Elemente austauschen.

Der Client prüft jeden Deskriptor eigenständig, bevor er ihn in den Laufzeit-Store aufnimmt. Beitragsarten, Oberflächen, Positionen, Bedienelemente, IDs, Optionslisten, Icon-Namenssyntax, Textlängen, gesamter Panel-Text sowie die Zahl der Elemente und Beiträge je Erweiterung werden geprüft und begrenzt. React rendert Text aus Erweiterungen als reinen Text. HTML, CSS, URLs, React-Komponenten und Host-Callbacks aus einer Erweiterung nimmt der Client grundsätzlich nicht an. Der Host entfernt alle Beiträge, sobald der Worker gestoppt wird, sein Hash sich ändert oder er aus der Antwort der freigegebenen Laufzeit verschwindet. Events gehen nur an den Worker, der für dieselbe Erweiterungs-ID und denselben Inhalts-Hash registriert ist.

Es gibt keinen DOM-Helfer, keinen Zugriff auf Marinaras API, keinen Zugriff auf Events des Elterndokuments und keine freie Netzwerkfähigkeit. Das iframe validiert Nachrichten und begrenzt ihre Rate. Ein Heartbeat-Watchdog beendet einen Worker, der nicht mehr reagiert oder in einer Endlosschleife hängt.

## Kompatibilitäts-Laufzeit mit Seiten-Vollzugriff

Für einstellungslastige Werkzeuge und mehrstufige Abläufe bleibt das Beitragsprotokoll der bevorzugte Weg. Eine komplexe Erweiterung kann die Elemente eines Panels schrittweise austauschen und den eigenen Zustand im privaten Speicher der Erweiterung halten.

Ältere Pakete laufen in der sicheren Laufzeit nicht unverändert weiter – etwa solche, die Schaltflächen über Host-Selektoren einhängen, React-Interna durchlaufen, beliebige Overlays zeichnen oder Same-Origin-Routen unter `/api` aufrufen. Portiere sie am besten auf Beitrags-Deskriptoren und eng umrissene Vermittlungsfähigkeiten.

Braucht die Kompatibilität wirklich die Host-Seite, darf eine **External Extension** `full_page_access` anfordern. `PersonalExtensionInjector.tsx` lädt genau diese freigegebene Revision über ein Same-Origin-Skriptelement und optional ein Stylesheet. Der Code läuft in einer asynchronen Funktion mit einem kleinen Kompatibilitäts-Objekt `marinara` für Identität, Logging, privaten Speicher, verwaltete Timer und die Registrierung für Aufräumarbeiten. Die üblichen Globals der Seite bleiben verfügbar – genau darum geht es bei diesem Recht.

Der Seiten-Loader prüft `id`, Namen und Inhalts-Hash gegen die Laufzeit-Metadaten, bevor er Code aufruft. Der Server prüft bei jeder Anfrage nach Skript oder Stylesheet zusätzlich den exakten Hash, den Aktivierungszustand, die externe Herkunft, die Berechtigung und die Richtlinie mit ihren beiden Freigaben. Schließt eine Freigabe, deaktiviert Marinara den Datensatz; das Polling der Laufzeit entfernt danach die eingefügten Knoten und räumt so gut wie möglich auf. Nebenwirkungen, die Seiten-Code mit vollem Vertrauen bereits erzeugt hat, lassen sich damit nicht zurücknehmen – der Ablauf weist deshalb darauf hin, dass ein Neuladen nötig sein kann.

Ältere Importe mit `kind: "marinara.extension"` und ohne ausdrückliche `capabilities`-Angabe bekommen `full_page_access`. Moderne Exporte schreiben dieses Feld immer, auch als leere Liste – sichere Pakete werden beim erneuten Import also nicht neu eingestuft.

## Server-Laufzeit

Server-Code läuft in einem eigenen Node-Prozess, nie über einen Import im laufenden Prozess. Nodes Berechtigungsmodell verweigert Dateisystem, Netzwerk, Kindprozesse, Worker, native Addons, WASI und Inspector. Zusätzlich läuft der Kindprozess in:

- macOS Seatbelt; oder
- Linux Bubblewrap mit getrennten Namensräumen für PID, Netzwerk, IPC und Mounts.

Die Sandbox bekommt eine minimale Umgebung, einen kleinen V8-Heap, keine Anwendungsdateien, keine Server-Geheimnisse und begrenzte, zeilenweise geschriebene Protokolldateien in ihrem privaten temporären Ordner. Sie bekommt nur Logging, den privaten Speicher der Erweiterung, verwaltete Timer und die Registrierung für Aufräumarbeiten. Nachrichtenkontingente und eine separate Heartbeat-Datei fangen Protokollfluten und Endlosschleifen ab.

Node-Berechtigungen und `node:vm` sind zusätzliche Schutzschichten, nicht die Sicherheitsgrenze. Die separate Betriebssystem-Sandbox ist Pflicht. Unter Windows, Android, Linux ohne `bwrap` und auf jeder anderen nicht unterstützten Plattform lassen sich Server-Erweiterungen gar nicht erst aktivieren.

## Validierung

Führe aus:

```bash
pnpm check
pnpm regression:extensions-security
pnpm regression:professor-mari-shell-sandbox
pnpm smoke:ui
```

Der Sicherheits-Regressionstest muss belegen: die zweistufige Freigabe, die Entwertung bei abweichendem Hash, die Worker-Form mit undurchsichtiger Herkunft, begrenzte und an den Hash gebundene Kontext-Schnappschüsse, Validierung und Aufräumen der Host-Beiträge, das ausschließlich externe Routing für den Seiten-Vollzugriff samt Bestätigung, die Einstufung älterer Pakete, das Entfernen der Umgebungsvariablen, die Verweigerung von Dateisystem und Netzwerk, den privaten Speicher sowie das Verhalten der Sandbox-Verfügbarkeit im Fehlerfall (fail closed).
