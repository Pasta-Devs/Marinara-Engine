# Eigene Personal Extensions schreiben

In dieser Anleitung erfährst du, wie du eine Browser-Erweiterung oder eine Server-Erweiterung schreibst, als Paket verpackst und importierst. Sie richtet sich an alle, die JavaScript schreiben können. Wie du eine Erweiterung prüfst und ausführst, steht unter [Personal Extensions](personal-extensions.md).

Code, den du selbst schreibst und importierst, wird als **External Extension** (externe Erweiterung) behandelt. Er ist anfangs deaktiviert und kann erst laufen, nachdem du ihn geprüft und seinen exakten SHA-256-Hash freigegeben hast.

## Bevor du beginnst

External Extensions bleiben verborgen, bis du beide Sicherheitsschritte aus [Importe von Fremdanbietern erlauben](personal-extensions.md#allow-third-party-imports) erledigt hast: `ENABLE_EXTERNAL_EXTENSIONS=true` in `.env` und **Allow third-party extension imports** (Importe von Fremdanbietern erlauben) unter **Settings → Advanced → Danger Zone** (Einstellungen → Erweitert → Gefahrenbereich).

Zum Importieren und Verwalten von Erweiterungen brauchst du außerdem Zugriff über localhost oder das Admin-Secret. Von einem Smartphone, einer LAN-Adresse oder einem entfernten Browser aus setzt du `ADMIN_SECRET` auf dem Server und trägst denselben Wert unter **Settings → Advanced → Admin Access** (Einstellungen → Erweitert → Admin-Zugriff) ein.

Wähle die Laufzeitumgebung mit den geringsten Rechten, die für die Aufgabe ausreicht:

| Laufzeitumgebung | Geeignet für | Wichtige Grenze |
| --- | --- | --- |
| Browser-Erweiterung in der Sandbox | Privaten Zustand, Kontext des aktiven Chats, Schaltflächen, Menüaktionen und von Marinara gerenderte Panels | Kein Zugriff auf Marinara-DOM, Cookies, Browser-Speicher, Netzwerk oder beliebiges HTML |
| Server-Erweiterung | Hintergrundlogik, die verwaltete Timer und privaten Erweiterungsspeicher braucht | Eigene Betriebssystem-Sandbox; kein Zugriff auf Marinara-Dateien, Geheimnisse, Netzwerk, Kindprozesse oder native Module |
| External Extension mit Vollzugriff auf die Seite | Älteren Code, der Marinaras Seite oder Same-Origin-APIs braucht | Keine Sandbox; nur für genau den Code verwenden, dem du vollständig vertraust |

Browser-Erweiterungen funktionieren auf jeder unterstützten Plattform. Server-Erweiterungen benötigen macOS Seatbelt oder Linux Bubblewrap. Sieh dir die [Plattformtabelle](personal-extensions.md#platform-support) an, bevor du dich für eine Server-Erweiterung entscheidest.

## Schnellstart für Browser-Erweiterungen

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

Verwende diese `extension.css`, um das eingeschränkte iframe-Fenster zu gestalten, das die Schaltfläche öffnet:

```css
[data-ext-root] {
  font-size: 16px;
}
```

Importiere die Erweiterung anschließend und führe sie aus:

1. Öffne **Settings → Addons → External Extensions**.
2. Wähle **Import Extension Folder** (Erweiterungsordner importieren) und den Ordner `Hello Panel` aus, oder packe den Ordner als ZIP-Datei und importiere sie mit **Import Extension File** (Erweiterungsdatei importieren).
3. Öffne den deaktivierten Entwurf und prüfe sein Manifest und sein JavaScript.
4. Wähle **Review and Run** (prüfen und ausführen) und gib den exakt angezeigten Hash frei.
5. Öffne das Extensions-Menü und wähle **Hello Panel**.

Dasselbe ausführbare Beispiel liegt im Repository unter `docs/examples/personal-extensions/browser-minimal/`.

## Browser-API-Referenz

Browser-Erweiterungen in der Sandbox erhalten ein einziges unveränderliches globales Objekt namens `marinara`:

| API | Zweck |
| --- | --- |
| `runtime`, `version` | Name der Laufzeitumgebung (`client`) und aktuelle Browser-API-Version |
| `extensionId`, `extensionName`, `capabilities` | Identität und freigegebene Fähigkeiten genau dieser Erweiterungsrevision |
| `log.debug/info/warn/error(...)` | Einen gekennzeichneten Eintrag in die Browser-Konsole schreiben |
| `storage.get()` | Privates JSON-Objekt dieser Erweiterung lesen |
| `storage.patch(object)` | Werte mit dem privaten Speicher zusammenführen und das neue Objekt zurückgeben |
| `storage.delete()` | Privaten Speicher leeren |
| `context.get()` | Aktuellen Snapshot des aktiven Chats lesen |
| `context.subscribe(listener)` | Kontextänderungen empfangen; gibt eine Funktion zum Abbestellen zurück |
| `ui.registerContribution(options)` | Sichere Schaltfläche, Eintrag im Extensions-Menü oder von Marinara gerendertes Panel hinzufügen |
| `ui.showWindow(options)` | Eingeschränktes iframe-Fenster öffnen |
| `dice.registerFormat(options)` | `/roll` eine Notation beibringen; Marinara wirft die darin benannten Würfel |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | Verwaltete Timer, die beim Stoppen der Erweiterung entfernt werden |
| `onCleanup(callback)` | Zusätzliche Bereinigungslogik registrieren |

Verwende [von Marinara gerenderte Panels](#add-a-marinara-rendered-panel) für normale Oberflächen, den [Kontext des aktiven Chats](#use-active-chat-context) für chatabhängiges Verhalten und [Würfelformate](#add-a-dice-format) für eine eigene `/roll`-Notation. Der Zustand der Erweiterung gehört in `marinara.storage`, nicht in den Browser-Speicher.

`showWindow({ title, elements, onEvent, onClose })` gibt ein Handle mit `update({ title?, elements? })` und `close()` zurück. Paket-CSS gestaltet diese iframe-Fenster in der Sandbox; vom Host gerenderte Beiträge verwenden immer Marinaras eigenes Theme und seine eigenen Bedienelemente.

Die sichere Browser-Laufzeitumgebung hat keine DOM- oder Netzwerk-API. Umgehe diese Grenze nicht. Wenn eine nützliche Fähigkeit fehlt, bitte um eine eng begrenzte Host-Fähigkeit, statt standardmäßig auf den Zugriff auf die ganze Seite zu wechseln.

### Kontextfähigkeiten

Deklariere den optionalen Zugriff auf Datensätze in `config.capabilities`:

```json
{
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` füllt begrenzte Felder der Charakterkarten im aktiven Chat.
- `read_active_persona` füllt begrenzte Felder der ausgewählten Persona.
- `full_page_access` wählt die Kompatibilitäts-Laufzeitumgebung ohne Sandbox und steht nur External Extensions zur Verfügung.

Eine Änderung der Fähigkeiten ändert den Hash des ausführbaren Codes, deaktiviert die Erweiterung und erfordert eine neue Prüfung.

<a id="what-a-browser-extension-can-do"></a>

### Was eine Browser-Erweiterung kann

Eine Browser-Erweiterung läuft in einem eigenen Worker innerhalb eines Sandbox-iframes mit undurchsichtigem Origin. Sie kommt weder an Marinaras Seite noch an DOM, Cookies, Browser-Speicher, Origin-APIs oder das Netzwerk heran. Ihre Fähigkeiten sind privater Erweiterungsspeicher, Logging, verwaltete Timer, die Registrierung von Bereinigungslogik, eingeschränkte Fenster, sichere Beitragsplätze des Hosts und ein schreibgeschützter Snapshot des aktiven Chats und der Charakter-IDs. Ausgewählte Felder der aktiven Charakterkarten oder der ausgewählten Persona bekommt sie nur, wenn die passenden Berechtigungen deklariert und freigegeben sind.

Mit `marinara.ui.registerContribution(...)` können Erweiterungen Aktionen in der oberen Leiste oder in Seitenpanels, Einträge im Extensions-Menü und dauerhafte Panels am rechten Rand hinzufügen. Marinara rendert diese Flächen im aktiven Theme und mit einem festen Satz an Bedienelementen: Überschriften, Text, vorformatierte Ausgabe, Schaltflächen, Texteingaben, Auswahlfelder, Schalter, Schieberegler, Farbwähler und Abstandshalter. Eine Erweiterung liefert Inhalt und Zustand, niemals HTML, CSS, URLs, React-Komponenten oder Event-Handler des Hosts.

Diese Oberflächen-Fähigkeiten und Regeln gelten für jede Browser-Erweiterung in der Sandbox gleichermaßen, egal woher sie stammt. Eine importierte Erweiterung eines Fremdanbieters (External Extension) läuft in dieser sicheren Laufzeitumgebung, es sei denn, ihr Paket verlangt ausdrücklich **Full page access** (Vollzugriff auf die Seite) oder nutzt das weiter unten beschriebene Format `marinara.extension` aus der Zeit vor der Sandbox.

### Text-Tokens schätzen

Personal Extensions für Browser, Full page access und Server können Marinaras eingebauten Schätzer für Text-Tokens verwenden:

```js
const tokens = marinara.estimateTextTokens(text);
```

Die Signatur lautet `estimateTextTokens(text: string): number`; auch der aus `@marinara-engine/shared` exportierte Typ `PersonalExtensionTokenApi` beschreibt sie. Der Aufruf ist synchron, braucht keine zusätzliche Fähigkeit und liefert Marinaras modellunabhängige Schätzung der Token-Anzahl, kein exaktes Tokenizer-Ergebnis. Prüfe bei älteren Engines vor dem Aufruf, ob `typeof marinara.estimateTextTokens === "function"` gilt.

<a id="add-a-marinara-rendered-panel"></a>

### Ein von Marinara gerendertes Panel hinzufügen

```js
const panel = marinara.ui.registerContribution({
  id: "weather-settings",
  kind: "panel",
  label: "Weather controls",
  description: "Tune a weather scene without leaving Marinara.",
  icon: "sparkles",
  elements: [
    { kind: "heading", text: "Atmosphere" },
    {
      kind: "select",
      id: "weather",
      label: "Weather",
      value: "rain",
      options: [
        { value: "rain", label: "Rain" },
        { value: "snow", label: "Snow" },
        { value: "aurora", label: "Aurora" },
      ],
    },
    { kind: "slider", id: "intensity", label: "Intensity", min: 0, max: 100, value: 60 },
    { kind: "toggle", id: "lightning", label: "Lightning", checked: false },
    { kind: "color", id: "tint", label: "Tint", value: "#6d8cff" },
    { kind: "button", id: "apply", label: "Apply" },
  ],
  onActivate: async () => {
    const settings = await marinara.storage.get();
    // Update the panel when stored state should be reflected in the controls.
  },
  onEvent: async ({ elementId, values }) => {
    if (elementId !== "apply") return;
    await marinara.storage.patch(values);
  },
});

marinara.onCleanup(() => panel.remove());
```

Verwende `kind: "button"` für eine kompakte Aktion und `kind: "menu-item"` für eine Aktion im Extensions-Menü. Mit `kind: "command"` legst du einen Eintrag im Command Center an, der einen vorhandenen Beitrag aus derselben Revision der Erweiterung aktiviert. Ein Befehl braucht `targetContributionId` und kann weder `onActivate` noch `onEvent` verwenden.

```js
marinara.ui.registerContribution({
  id: "open-weather",
  kind: "command",
  label: "Open weather controls",
  targetContributionId: "weather-settings",
});
```

Der Host löst einen Befehl nur auf, wenn das Ziel dieselbe Erweiterungs-ID und denselben Inhalts-Hash hat. Fehlende Ziele, Ziele aus anderen Erweiterungen und Ziele aus veralteten Revisionen werden abgelehnt. Schaltflächen verwenden standardmäßig `surface: "top-bar"`. Stattdessen können sie `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents` oder `settings` ansteuern, wobei `position` auf `header`, `before-content` oder `after-content` steht. `icon` akzeptiert jeden von Marinara unterstützten Lucide-Iconnamen in kebab-case. Beide Aktionsarten rufen `onActivate` auf. Ein `panel` ruft `onActivate` beim Öffnen auf; seine Schaltflächen rufen `onEvent` mit den aktuellen Werten aller Bedienelemente des Panels auf. Das zurückgegebene Handle unterstützt Aktualisierungen je nach Art: `button` akzeptiert `label`, `description`, `icon`, `surface` und `position`; `menu-item` akzeptiert `label`, `description` und `icon`; `panel` akzeptiert `label`, `description`, `icon` und `elements`. Alle Handles unterstützen `remove()`. IDs dürfen Buchstaben, Zahlen, `.`, `_` und `-` enthalten.

Dieses Beispiel setzt eine native Aktion über den Inhalt des Presets-Panels:

```js
marinara.ui.registerContribution({
  id: "preset-helper",
  kind: "button",
  label: "Preset helper",
  description: "Run the preset helper",
  icon: "list-sparkles",
  surface: "presets",
  position: "before-content",
  onActivate: () => {
    // Run extension behavior here.
  },
});
```

Aufwendigere Werkzeuge bauen mehrstufige Oberflächen, indem sie die Panel-Elemente nach einem Ereignis aktualisieren. Halte den Anwendungszustand in `marinara.storage`; kodiere ihn nicht im Markup.

<a id="use-active-chat-context"></a>

### Den Kontext des aktiven Chats nutzen

Version 5 der API für Browser-Erweiterungen stellt undurchsichtige Kennungen für den Chat bereit, der gerade in Marinara angezeigt wird:

```js
const renderForContext = async ({ chatId, characterId, characterIds, personaId, characters, persona }) => {
  if (!chatId) return; // Home, a library, or another surface without an active chat.

  const storage = await marinara.storage.get();
  const tab = storage.tabsByChat?.[chatId];

  // characterId is available only for a single-Character chat.
  // Use characterIds for group chats.
  marinara.log.debug("Loaded Notepad tab", {
    chatId,
    characterId,
    characterIds,
    personaId,
    characterNames: characters.map((character) => character.name),
    personaName: persona?.name ?? null,
    tab,
  });
};

const unsubscribe = marinara.context.subscribe(renderForContext);
marinara.onCleanup(unsubscribe);
```

`marinara.context.get()` liefert denselben aktuellen Snapshot, ohne ein Abonnement anzulegen. Ist kein Chat aktiv, ist `chatId` gleich `null` und `characterIds` leer. `characterId` ist nur gesetzt, wenn genau ein Charakter beteiligt ist; Gruppenchats geben alle Beteiligten über `characterIds` heraus und lassen `characterId` auf `null`. `personaId` ist nur gesetzt, wenn `read_active_persona` freigegeben ist.

Chat- und Charakter-IDs stehen immer zur Verfügung; damit kann eine Erweiterung ihren eigenen privaten Speicher nach Namensräumen trennen. Die Felder der Datensätze brauchen eine oder beide optionalen Berechtigungen im Manifest der Erweiterung:

```json
{
  "runtime": "client",
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` füllt `characters` mit den Karten, die am aktiven Chat beteiligt sind.
- `read_active_persona` füllt `persona` mit der Persona, die im aktiven Chat ausgewählt ist.

Ohne die jeweilige Berechtigung bleibt der Wert `[]` beziehungsweise `null`. Marinara zeigt jede angeforderte Berechtigung unter **Requested access** (angeforderter Zugriff) und noch einmal im Freigabedialog für den exakten Hash. Kommt eine Berechtigung hinzu oder fällt eine weg, ändert sich der Hash des ausführbaren Codes, die Erweiterung wird deaktiviert und braucht eine neue Freigabe.

Charakter-Snapshots enthalten ausschließlich `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe` und `conversationDisplayName`. Persona-Snapshots enthalten ausschließlich `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe` und `conversationDisplayName`. Texte werden auf eine Höchstlänge begrenzt, bevor sie die Sandbox-Brücke passieren.

Marinara übergibt niemals Nachrichten, Creator Notes, System-Prompts, Post-History-Anweisungen, Kommentare, Avatar-Pfade, vollständige Charakter- oder Persona-Bibliotheken, nicht deklarierte Felder, Chat-Metadaten, Datenbank-Handles, Netzwerkzugriff oder schreibende Operationen. Kontext-Aktualisierungen bleiben an den freigegebenen Code-Hash gebunden und kommen an, sobald sich der aktive Chat, seine Charakterliste oder die ausgewählte Persona ändert.

<a id="add-a-dice-format"></a>

### Ein Würfelformat hinzufügen

Version 6 der API für Browser-Erweiterungen lässt eine Erweiterung `/roll` eine eigene Notation beibringen, etwa für einen Erzählwürfelpool. Die Erweiterung liest die Notation und benennt die zu werfenden Würfel; Marinara wirft sie mit seinem eigenen sicheren Würfelgenerator und gibt die gewürfelten Seiten zurück. Eine Erweiterung darf sagen, was ein Wurf bedeutet, aber nie, was gewürfelt wurde.

```js
const SYMBOLS = { boost: [0, 0, 1, 1, 2, 1], setback: [0, 0, -1, -1, 0, 0] };

const format = marinara.dice.registerFormat({
  id: "narrative",
  label: "Narrative dice",
  // Return null for notation this format does not read.
  parse(notation) {
    const terms = [...notation.matchAll(/(\d+)\s*(boost|setback)/g)];
    if (!terms.length) return null;
    const kinds = terms.flatMap(([, count, kind]) => Array(Number(count)).fill(kind));
    return { dice: kinds.map(() => 6), kinds };
  },
  // rolls[i] is the face Marinara threw for dice[i]; plan is what parse returned.
  read({ notation, dice, rolls, plan }) {
    const net = rolls.reduce((sum, face, i) => sum + SYMBOLS[plan.kinds[i]][face - 1], 0);
    return { total: net, text: net > 0 ? `${net} success` : "failure" };
  },
});
marinara.onCleanup(() => format.remove());
```

`/roll 2 boost 1 setback` postet dann die gewürfelten Seiten, die Summe und den Text der Erweiterung, gekennzeichnet mit dem Namen des Formats. Einfache Notation wie `2d6` oder `4d6kh3` würfelt immer wie bisher und erreicht nie eine Erweiterung. Andere Notation geht nacheinander an jedes registrierte Format; das erste, dessen `parse` Würfel zurückgibt, übernimmt den Wurf.

- `parse(notation)` gibt `null` oder `{ dice: [sides, ...] }` mit 1–100 Würfeln mit je 2–1.000 Seiten zurück. Alles Weitere im Objekt bleibt in der Sandbox und wird als `plan` an `read` zurückgegeben.
- `read(...)` gibt `{ total, text?, kept? }` zurück: eine endliche Zahl, höchstens 200 Zeichen Klartext und optional die Positionen der gewerteten Würfel in aufsteigender Reihenfolge. `/roll` streicht die übrigen durch.
- Jede Erweiterung kann 4 Formate registrieren. Die Notation ist höchstens 100 Zeichen lang. `parse` und `read` dürfen asynchron sein, müssen aber jeweils innerhalb von 2 Sekunden antworten.
- Der Text wird als Klartext angezeigt: Links, Bilder, Formatierung und HTML werden maskiert.

Würfelformate gelten für `/roll` im Browser. Das Tool `roll_dice` des Game Masters und andere serverseitige Würfe behalten die eingebaute Notation und die Würfel des Regelsatzes. Prüfe bei älteren Engines vor dem Aufruf, ob `typeof marinara.dice?.registerFormat === "function"` gilt.

### Ältere Erweiterungen und Erweiterungen mit Vollzugriff

Wetter-Steuerungen, Prompt-Editoren und andere umfangreiche Abläufe sind legitime Einsatzzwecke für Beiträge. Ihre sicheren Portierungen können einen Einstiegspunkt im Menü oder in der oberen Leiste mit Panels kombinieren, die sich schrittweise aktualisieren. Bestehende Pakete, die DOM-Overlays einfügen, Marinaras CSS-Selektoren abfragen, React-Interna durchlaufen oder `/api`-Routen derselben Origin aufrufen, lassen sich nicht unverändert in die sichere Laufzeitumgebung importieren.

Beiträge zur Oberfläche liefern die Bedienoberfläche, keine allgemeinen Rechte im Hintergrund. Die Kontext-API gibt immer die IDs des aktiven Chats und der Charaktere heraus und darüber hinaus nur die oben aufgeführten, deklarierten Felder der aktiven Datensätze. Funktionen, die Nachrichten, Presets, Lorebooks, nicht deklarierte Charakter- oder Persona-Daten oder visuelle Szeneneffekte brauchen, benötigen weiterhin eine eigene, eng zugeschnittene Broker-Fähigkeit, die Marinara bereitstellt. Eine Erweiterung darf eine solche Fähigkeit nicht über Zugriffe auf das Host-DOM oder uneingeschränkte Netzwerkanfragen nachbilden.

Hängt eine External Extension vom Zugriff auf das Host-DOM ab, darf sie Folgendes anfordern:

```json
{
  "runtime": "client",
  "capabilities": ["full_page_access"]
}
```

**Vollzugriff auf die Seite ist keine Sandbox-Fähigkeit.** Das freigegebene JavaScript und CSS laufen innerhalb von Marinaras Seite. Der Code kann alles lesen oder ändern, was für die aktuelle Browser-Sitzung sichtbar ist, Chats und Karten einsehen, den Browser-Speicher nutzen, Netzwerkanfragen stellen und Marinara-APIs derselben Origin aufrufen. In der Praxis hat er in der Seite dieselben Rechte wie Code, den du in die Browser-Konsole einfügst. Entwürfe von Professor Mari können ihn nicht anfordern.

Erweiterungen mit Vollzugriff auf die Seite sollten für Netzwerkanfragen `marinara.fetch(...)` verwenden. Signatur und Ergebnis entsprechen `window.fetch`; zusätzlich kann **Settings > Addons > External Extensions** dann für diese Erweiterung die Anzahl der Anfragen in der Sitzung, die von Antworten gemeldeten übertragenen Bytes, die aktuelle Anfragerate und eine Warnung bei anhaltend hohem Datenverkehr anzeigen. Ein direktes `window.fetch` bleibt verfügbar, weil Code mit Vollzugriff auf die Seite vertrauenswürdiger Seitencode ist; diese Anfragen lassen sich der Erweiterung aber nicht zuordnen.

Marinara erkennt die ältere v1-Hülle mit `kind: "marinara.extension"` ohne ausdrückliches Feld `capabilities` als Paket aus der Zeit vor der Sandbox und vergibt beim Import **Full page access**. So landen ältere Pakete wie WeatherTweaker im richtigen Prüfablauf, statt still in einem Worker zu scheitern. Ein modernes Paket, das diese Hülle nutzt, aber die sichere Laufzeitumgebung will, muss `"capabilities": []` enthalten.

Die beiden Sicherheitssperren für External Extensions und die Freigabe per exaktem Hash gelten weiterhin. Eine Änderung an Code, CSS oder Berechtigungen deaktiviert die Erweiterung und verlangt eine neue Freigabe. Beim Deaktivieren entfernt Marinara die eigenen Script- und Stylesheet-Knoten, bricht die über die Kompatibilitäts-API angelegten Timer ab und ruft die mit `marinara.onCleanup(...)` registrierten Callbacks auf. Weil Seitencode nicht registrierte Listener, Timer, globale Variablen oder DOM-Änderungen anlegen kann, ist das Aufräumen nur ein Versuch nach bestem Wissen; lade die Seite nach dem Deaktivieren einer Erweiterung neu, falls etwas übrig bleibt.

Die ältere API `marinara.ui.showWindow(...)` steht weiterhin für ein temporäres Fenster im iframe mit undurchsichtigem Origin bereit. Sie nutzt dieselben festen Bedienelemente und liefert die Handles `update(...)` und `close()`. Greif lieber zu Beiträgen, wenn das Werkzeug über Marinaras normale Navigation erreichbar sein soll.

## Schnellstart für Server-Erweiterungen

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

Dasselbe ausführbare Paket liegt unter `docs/examples/personal-extensions/server-minimal/`.

Server-Code erhält `marinara.runtime`, `marinara.version`, die Identität der Erweiterung, `log`, `storage`, verwaltete Timer und `onCleanup`. Er erhält keinen Zugriff auf Dateisystem, Prozesse, Netzwerk, das Laden von Modulen oder die Marinara-Datenbank.

Server-Erweiterungen bleiben deaktiviert, wenn der Host Seatbelt oder Bubblewrap nicht einrichten kann. Das ist eine Einschränkung der Plattform und kein Fehler der Erweiterung.

## Paket- und Manifestreferenz

| Feld | Hinweise |
| --- | --- |
| `kind` | `marinara.personal-extension` oder `marinara.personal-server-extension` |
| `version` auf oberster Ebene | Version der Pakethülle; derzeit `1` |
| `config.name` | Erforderlicher Anzeigename mit 1–200 Zeichen |
| `config.version` | Optionale Erweiterungsversion wie `1.2.0`; numerische, durch Punkte getrennte Versionen ermöglichen Warnungen vor Downgrades |
| `config.description` | Optionale Beschreibung mit bis zu 2.000 Zeichen |
| `config.runtime` | `client` oder `server`; Standard ist `client` |
| `config.capabilities` | Angeforderte Browser-Fähigkeiten; Server-Erweiterungen müssen eine leere Liste verwenden |
| `config.jsPath` / `config.serverJsPath` | JavaScript-Dateipfad oder geordnetes Array von Pfaden, relativ zum Manifest |
| `config.cssPath` | Optionaler CSS-Dateipfad oder geordnetes Array; CSS der sicheren Laufzeitumgebung bleibt im iframe der Sandbox |
| `config.js`, `config.serverJs`, `config.css` | Inline-Alternativen, wenn separate Dateien unnötig sind |

Verwende einfaches JavaScript. Marinara kompiliert kein TypeScript und installiert keine Abhängigkeiten für Erweiterungen. Bündele nötige Abhängigkeiten vor dem Import in dein JavaScript.

Lose Dateien mit den Endungen `.js`, `.mjs`, `.cjs`, `.server.js`, `.server.mjs`, `.server.cjs` und `.css` lassen sich ebenfalls direkt importieren. Ein Manifest ist vorzuziehen, weil es Identität, Laufzeitumgebung, Version, Fähigkeiten und Dateireihenfolge ausdrücklich festhält.

### Validierungsgrenzen

| Inhalt | Aktuelle Grenze |
| --- | --- |
| Name / Version / Beschreibung | 200 Zeichen / 64 Zeichen / 2.000 Zeichen |
| Browser- oder Server-JS | Keine Quelltextgrenze pro Feld; die Grenze der umgebenden Datei, des Archivs oder der Anfrage gilt weiterhin |
| CSS | 256 KiB |
| Importierte ZIP-Datei | 32 MiB komprimiert, 2 MiB pro Texteintrag und insgesamt 16 MiB entpackter Text |
| Privater Speicher | 1.000.000 Byte serialisiertes JSON pro Erweiterung |

Die Grenzen für ZIP-Datei, Anfrage, Sandbox-Nachricht und Speicher schützen jeweils eigene Transport- oder Laufzeitgrenzen; sie sind keine Richtlinie für ausführbaren Quelltext.

## Aktualisierungs- und Wiederherstellungszyklus

- Jeder neue Import ist anfangs deaktiviert und nicht freigegeben.
- Eine Änderung an Code, CSS, Laufzeitumgebung oder Fähigkeiten hebt die Freigabe auf und deaktiviert die Erweiterung.
- Ein erneuter Import mit demselben Namen aktualisiert nach einer Bestätigung den vorhandenen Datensatz. Ein bytegleicher erneuter Import behält den aktuellen Hash und die Freigabe; geänderter ausführbarer Inhalt hebt die Freigabe auf. Marinara warnt, wenn numerische Versionen auf ein Downgrade hinweisen.
- **Export** (Exportieren) schreibt das aktuelle Manifest und die Quelldateien in ein portables Paket. Eine Freigabe wird nie exportiert.
- Das Wiederherstellen einer Revision, der Import eines Profils oder die Wiederherstellung eines Backups lässt die Erweiterung deaktiviert, bis sie erneut geprüft wurde.
- **Disable** (Deaktivieren) stoppt die Laufzeitumgebung und die registrierte Bereinigung. Code mit Zugriff auf die ganze Seite kann ein Neuladen der Seite erfordern, wenn er nicht registrierte Nebeneffekte erzeugt hat.
- **Delete** (Löschen) entfernt den installierten Datensatz. Exportiere zuerst, falls du den Quelltext später noch brauchen könntest.

## Fehlersuche

| Symptom | Prüfen |
| --- | --- |
| Bedienelemente für externe Importe fehlen | Öffne beide oben beschriebenen Sicherheitssperren für External Extensions |
| Die Verwaltung meldet, dass localhost oder Admin Access erforderlich ist | Richte `ADMIN_SECRET` ein und speichere es unter **Admin Access** |
| Beim Import wird keine Erweiterung gefunden | Prüfe `manifest.json` und die relativen Pfade darin; Server braucht JS, Browser dagegen CSS oder JS |
| Die Erweiterung wird nach einer Änderung deaktiviert | Erwartetes Verhalten: Prüfe den neuen exakten Hash und gib ihn frei |
| Browser-Code kann `document`, `window`, `fetch` oder lokalen Speicher nicht verwenden | In der sicheren Sandbox erwartet; verwende die dokumentierten Broker-APIs |
| Server-Erweiterung ist nicht verfügbar | Verwende macOS Seatbelt oder Linux mit Bubblewrap, oder wechsle zu einer Browser-Erweiterung |
| Browser-Erweiterung löst eine Ausnahme aus | Öffne die Entwicklerwerkzeuge des Browsers; `marinara.log` und Startfehler sind mit dem Namen der Erweiterung gekennzeichnet |
| Server-Erweiterung löst eine Ausnahme aus | Prüfe ihren Status unter **Settings → Addons** und das Serverprotokoll von Marinara |

CSS, privater Speicher, Importarchive und Laufzeitnachrichten haben weiterhin jeweils eigene Sicherheitsgrenzen. Marinara sollte die Grenze melden, die ein Paket abgelehnt hat, statt den Vorgang als Ausführungsfehler darzustellen.

## Verwandte Anleitungen

- [Personal Extensions](personal-extensions.md)
- [Server-Konfiguration](../CONFIGURATION.md)
- [Fehlerbehebung](../TROUBLESHOOTING.md)
- [Architektur der Personal Extensions](../development/personal-extensions.md)
