# Eigene Personal Extensions schreiben

Dieser Leitfaden richtet sich an Personen, die eigene Erweiterungen für Marinara Engine schreiben. Wie du eine Erweiterung installierst, prüfst und sicher ausführst, erfährst du zunächst unter [Personal Extensions](personal-extensions.md).

Code, den du selbst schreibst und importierst, wird als **External Extension** (externe Erweiterung) behandelt. Er ist anfangs deaktiviert und kann erst ausgeführt werden, nachdem du ihn geprüft und seinen exakten SHA-256-Hash genehmigt hast.

## Bevor du beginnst

External Extensions bleiben verborgen, bis beide Sicherheitssperren geöffnet sind:

1. Setze `ENABLE_EXTERNAL_EXTENSIONS=true` in der `.env`-Datei des Marinara-Hosts.
2. Öffne **Settings** > **Advanced** > **Danger Zone** und aktiviere **Allow third-party extension imports**.

Zum Importieren und Verwalten von Erweiterungen ist außerdem ein Zugriff über localhost oder ein eingerichteter **Admin Access** erforderlich. Wenn du Marinara über ein Smartphone, eine LAN-Adresse oder einen entfernten Browser verwendest, setze `ADMIN_SECRET` auf dem Server und trage denselben Wert unter **Settings** > **Advanced** > **Admin Access** ein.

Wähle die Umgebung mit den geringsten Rechten, die für die Aufgabe ausreicht:

| Umgebung | Geeignet für | Wichtige Grenze |
| --- | --- | --- |
| Sandboxed Browser Extension | Privaten Zustand, Kontext des aktiven Chats, Schaltflächen, Menüaktionen und von Marinara gerenderte Panels | Kein Zugriff auf Marinara-DOM, Cookies, Browser-Speicher, Netzwerk oder beliebiges HTML |
| Server Extension | Hintergrundlogik, die verwaltete Timer und privaten Erweiterungsspeicher benötigt | Eigene Betriebssystem-Sandbox; kein Zugriff auf Marinara-Dateien, Geheimnisse, Netzwerk, Kindprozesse oder native Module |
| Full-page External Extension | Älteren Code, der tatsächlich Marinaras Seite oder Same-Origin-APIs benötigt | Keine Sandbox; nur für exakt geprüften Code verwenden, dem du vollständig vertraust |

Browser Extensions funktionieren auf jeder unterstützten Plattform. Server Extensions benötigen macOS Seatbelt oder Linux Bubblewrap. Sieh dir die [Plattformtabelle](personal-extensions.md#platform-support) an, bevor du eine Server Extension auswählst.

## Browser-Extension-Schnellstart

Erstelle einen Ordner mit diesem Aufbau:

```text
Hello Panel/
  manifest.json
  extension.js
  extension.css
```

Verwende diese `manifest.json`:

```json
{
  "kind": "marinara.personal-extension",
  "version": 1,
  "config": {
    "name": "Hello Panel",
    "version": "1.0.0",
    "description": "A minimal sandboxed Browser Extension.",
    "runtime": "client",
    "capabilities": [],
    "jsPath": "extension.js",
    "cssPath": "extension.css"
  }
}
```

Verwende diese `extension.js`:

```js
const saved = await marinara.storage.get();
let count = Number(saved.count) || 0;

const statusElement = () => ({
  kind: "text",
  text: `Button pressed ${count} time${count === 1 ? "" : "s"}.`,
});
const elements = () => [
  statusElement(),
  { kind: "button", id: "increment", label: "Count one" },
];

const panel = marinara.ui.registerContribution({
  id: "hello-panel",
  kind: "panel",
  label: "Hello Panel",
  description: "Minimal Personal Extension example",
  icon: "hand",
  elements: elements(),
  onEvent: async ({ elementId }) => {
    if (elementId !== "increment") return;
    count += 1;
    await marinara.storage.patch({ count });
    panel.update({ elements: elements() });
    marinara.ui.showWindow({ title: "Hello Panel", elements: [statusElement()] });
  },
});

marinara.log.info("Hello Panel loaded");
marinara.onCleanup(() => panel.remove());
```

Verwende diese `extension.css`, um das von der Schaltfläche geöffnete eingeschränkte iframe-Fenster zu gestalten:

```css
[data-ext-root] {
  font-size: 16px;
}
```

Importiere die Erweiterung anschließend und führe sie aus:

1. Öffne **Settings** > **Addons** > **External Extensions**.
2. Wähle **Import Folder** und den Ordner `Hello Panel` aus oder packe den Ordner als ZIP-Datei und importiere sie.
3. Öffne den deaktivierten Entwurf und prüfe sein Manifest sowie das JavaScript.
4. Wähle **Review and Run** und genehmige den exakt angezeigten Hash.
5. Öffne das Extensions-Menü und wähle **Hello Panel**.

Dasselbe ausführbare Beispiel liegt im Repository unter `docs/examples/personal-extensions/browser-minimal/`.

## Browser-API-Referenz

Browser Extensions in der Sandbox erhalten ein einziges unveränderliches globales Objekt namens `marinara`:

| API | Zweck |
| --- | --- |
| `runtime`, `version` | Name der Umgebung (`client`) und aktuelle Browser-API-Version |
| `extensionId`, `extensionName`, `capabilities` | Identität und genehmigte Fähigkeiten genau dieser Erweiterungsrevision |
| `log.debug/info/warn/error(...)` | Einen gekennzeichneten Eintrag in die Browser-Konsole schreiben |
| `storage.get()` | Privates JSON-Objekt dieser Erweiterung lesen |
| `storage.patch(object)` | Werte mit dem privaten Speicher zusammenführen und das neue Objekt zurückgeben |
| `storage.delete()` | Privaten Speicher leeren |
| `context.get()` | Aktuelle Momentaufnahme des aktiven Chats lesen |
| `context.subscribe(listener)` | Kontextänderungen empfangen; gibt eine Funktion zum Abbestellen zurück |
| `ui.registerContribution(options)` | Sichere Schaltfläche, Extensions-Menüeintrag oder von Marinara gerendertes Panel hinzufügen |
| `ui.showWindow(options)` | Eingeschränktes iframe-Fenster öffnen |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | Verwaltete Timer, die beim Stoppen der Erweiterung entfernt werden |
| `onCleanup(callback)` | Zusätzliche Bereinigungslogik registrieren |

Verwende [von Marinara gerenderte Panels](personal-extensions.md#add-a-marinara-rendered-panel) für normale Oberflächen und den [Kontext des aktiven Chats](personal-extensions.md#use-active-chat-context) für chatabhängiges Verhalten. Der Erweiterungszustand gehört in `marinara.storage`, nicht in den Browser-Speicher.

`showWindow({ title, elements, onEvent, onClose })` gibt ein Handle mit `update({ title?, elements? })` und `close()` zurück. Paket-CSS gestaltet diese iframe-Fenster in der Sandbox; vom Host gerenderte Beiträge verwenden immer Marinaras eigenes Theme und seine Bedienelemente.

Die sichere Browser-Umgebung besitzt keine DOM- oder Netzwerk-API. Umgehe diese Grenze nicht. Wenn eine nützliche Fähigkeit fehlt, bitte um eine eng begrenzte Host-Fähigkeit, statt standardmäßig auf den Zugriff auf die gesamte Seite zu wechseln.

### Kontextfähigkeiten

Deklariere den optionalen Datensatzzugriff in `config.capabilities`:

```json
{
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` füllt begrenzte Felder der Character-Karten im aktiven Chat.
- `read_active_persona` füllt begrenzte Felder der ausgewählten Persona.
- `full_page_access` wählt die nicht isolierte Kompatibilitätsumgebung und ist nur für External Extensions verfügbar.

Eine Änderung der Fähigkeiten ändert den Hash des ausführbaren Codes, deaktiviert die Erweiterung und erfordert eine neue Prüfung.

## Server-Extension-Schnellstart

Erstelle diesen Ordner:

```text
Server Counter/
  manifest.json
  server-extension.js
```

Verwende diese `manifest.json`:

```json
{
  "kind": "marinara.personal-server-extension",
  "version": 1,
  "config": {
    "name": "Server Counter",
    "version": "1.0.0",
    "description": "A minimal sandboxed Server Extension.",
    "runtime": "server",
    "capabilities": [],
    "serverJsPath": "server-extension.js"
  }
}
```

Verwende diese `server-extension.js`:

```js
const saved = await marinara.storage.get();
const starts = (Number(saved.starts) || 0) + 1;
await marinara.storage.patch({ starts });

marinara.log.info(`Server Counter started ${starts} time${starts === 1 ? "" : "s"}`);

const timer = marinara.setInterval(() => {
  marinara.log.debug("Server Counter heartbeat");
}, 60_000);

marinara.onCleanup(() => marinara.clearInterval(timer));
```

Dasselbe ausführbare Paket ist unter `docs/examples/personal-extensions/server-minimal/` verfügbar.

Server-Code erhält `marinara.runtime`, `marinara.version`, die Erweiterungsidentität, `log`, `storage`, verwaltete Timer und `onCleanup`. Er erhält keinen Zugriff auf Dateisystem, Prozesse, Netzwerk, Modulladen oder Marinara-Datenbank.

Server Extensions bleiben deaktiviert, wenn der Host Seatbelt oder Bubblewrap nicht einrichten kann. Dies ist eine Plattformbeschränkung und kein Erweiterungsfehler.

## Paket- und Manifestreferenz

| Feld | Hinweise |
| --- | --- |
| `kind` | `marinara.personal-extension` oder `marinara.personal-server-extension` |
| top-level `version` | Version der Pakethülle; derzeit `1` |
| `config.name` | Erforderlicher Anzeigename mit 1–200 Zeichen |
| `config.version` | Optionale Erweiterungsversion wie `1.2.0`; numerische, durch Punkte getrennte Versionen unterstützen Warnungen vor Downgrades |
| `config.description` | Optionale Beschreibung mit bis zu 2.000 Zeichen |
| `config.runtime` | `client` oder `server`; Standard ist `client` |
| `config.capabilities` | Angeforderte Browser-Fähigkeiten; Server Extensions müssen eine leere Liste verwenden |
| `config.jsPath` / `config.serverJsPath` | JavaScript-Dateipfad oder geordnetes Pfad-Array relativ zum Manifest |
| `config.cssPath` | Optionaler CSS-Dateipfad oder geordnetes Array; CSS der sicheren Umgebung bleibt im iframe der Sandbox |
| `config.js`, `config.serverJs`, `config.css` | Inline-Alternativen, wenn separate Dateien unnötig sind |

Verwende einfaches JavaScript. Marinara kompiliert kein TypeScript und installiert keine Erweiterungsabhängigkeiten. Bündele erforderliche Abhängigkeiten vor dem Import in dein JavaScript.

Lose Dateien mit den Endungen `.js`, `.mjs`, `.cjs`, `.server.js`, `.server.mjs`, `.server.cjs` und `.css` lassen sich ebenfalls direkt importieren. Ein Manifest ist vorzuziehen, weil es Identität, Umgebung, Version, Fähigkeiten und Dateireihenfolge ausdrücklich festhält.

### Validierungsgrenzen

| Inhalt | Aktuelle Grenze |
| --- | --- |
| Name / Version / Beschreibung | 200 Zeichen / 64 Zeichen / 2.000 Zeichen |
| Browser- oder Server-JS | Keine Quelltextgrenze pro Feld; die Grenze der umgebenden Datei, des Archivs oder der Anfrage gilt weiterhin |
| CSS | 256 KiB |
| Importierte ZIP-Datei | 32 MiB komprimiert, 2 MiB pro Texteintrag und insgesamt 16 MiB entpackter Text |
| Privater Speicher | 1.000.000 Byte serialisiertes JSON pro Erweiterung |

Die Grenzen für ZIP-Datei, Anfrage, Sandbox-Nachricht und Speicher schützen unterschiedliche Transport- oder Laufzeitgrenzen; sie sind keine Richtlinie für ausführbaren Quelltext.

## Aktualisierungs- und Wiederherstellungszyklus

- Jeder neue Import ist anfangs deaktiviert und nicht genehmigt.
- Eine Änderung an Code, CSS, Umgebung oder Fähigkeiten widerruft die Genehmigung und deaktiviert die Erweiterung.
- Ein erneuter Import desselben Namens aktualisiert den vorhandenen Datensatz nach Bestätigung. Ein bytegleicher erneuter Import behält den aktuellen Hash und die Genehmigung; geänderter ausführbarer Inhalt widerruft die Genehmigung. Marinara warnt, wenn numerische Versionen auf ein Downgrade hinweisen.
- **Export** schreibt das aktuelle Manifest und die Quelldateien in ein portierbares Paket. Eine Genehmigung wird nie exportiert.
- Das Wiederherstellen einer Revision, der Import eines Profils oder die Wiederherstellung einer Sicherung lässt die Erweiterung bis zur erneuten Prüfung deaktiviert.
- **Disable** stoppt die Umgebung und die registrierte Bereinigung. Code mit Zugriff auf die gesamte Seite kann ein erneutes Laden benötigen, wenn er nicht registrierte Nebeneffekte erzeugt hat.
- **Delete** entfernt den installierten Datensatz. Exportiere ihn zuerst, falls du den Quelltext später noch benötigen könntest.

## Fehlersuche

| Symptom | Prüfen |
| --- | --- |
| Bedienelemente für externe Importe fehlen | Öffne beide oben beschriebenen Sicherheitssperren für External Extensions |
| Die Verwaltung meldet, dass localhost oder Admin Access erforderlich ist | Richte `ADMIN_SECRET` ein und speichere ihn unter **Admin Access** |
| Beim Import wird keine Erweiterung gefunden | Prüfe `manifest.json` und die relativen Pfade; Server benötigt JS, Browser dagegen CSS oder JS |
| Die Erweiterung wird nach einer Änderung deaktiviert | Erwartetes Verhalten: Prüfe und genehmige den neuen exakten Hash |
| Browser-Code kann `document`, `window`, `fetch` oder lokalen Speicher nicht verwenden | In der sicheren Sandbox erwartet; verwende die dokumentierten Vermittlungs-APIs |
| Server Extension ist nicht verfügbar | Verwende macOS Seatbelt oder Linux mit Bubblewrap oder wechsle zu einer Browser Extension |
| Browser Extension löst eine Ausnahme aus | Öffne die Browser-Entwicklerwerkzeuge; `marinara.log` und Startfehler sind mit dem Erweiterungsnamen gekennzeichnet |
| Server Extension löst eine Ausnahme aus | Prüfe ihren Status unter **Settings** > **Addons** und das Marinara-Serverprotokoll |

CSS, privater Speicher, Importarchive und Laufzeitnachrichten haben jeweils eigene Sicherheitsgrenzen. Marinara sollte die Grenze melden, die ein Paket abgelehnt hat, statt den Vorgang als Ausführungsfehler darzustellen.

## Verwandte Leitfäden

- [Personal Extensions](personal-extensions.md)
- [Serverkonfiguration](../CONFIGURATION.md)
- [Fehlersuche](../TROUBLESHOOTING.md)
- [Personal-Extension-Architektur](../development/personal-extensions.md)
