# Personal Extensions

**Personal Extensions** (persönliche Erweiterungen) sind private Code-Entwürfe, die Professor Mari für dich schreibt. Du findest sie unter **Settings** (Einstellungen) > **Addons** (Zusatzfunktionen) > **Personal Extensions**.

Standardmäßig steht dort:

> Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash.

Einen Befehl für einen neuen Entwurf gibt es in diesem Bereich nicht, und Import-Bedienelemente ebenso wenig. Bitte Professor Mari darum, einen Entwurf anzulegen oder zu überarbeiten. Sie darf Code speichern – freigeben oder aktivieren darf sie ihn nicht.

Wenn du dein eigenes Paket schreiben und importieren möchtest, nutze die [Anleitung zum Erstellen persönlicher Erweiterungen](writing-personal-extensions.md). Selbst erstellte Pakete verwenden den separat geschützten Ablauf für externe Erweiterungen.

## Prüfen und aktivieren

Jeder Entwurf ist zunächst deaktiviert. Marinara berechnet aus dem ausführbaren Code einen SHA-256-Fingerabdruck. Öffne den Entwurf, sieh dir den Code an, vergleiche den angezeigten Hash und wähle **Review and Run** (prüfen und ausführen) nur dann, wenn du genau dieser Version vertraust. Jede Änderung am ausführbaren Code und jede wiederhergestellte Fassung deaktiviert die Erweiterung wieder und verlangt eine neue Freigabe.

Eine Sandbox beschränkt die Rechte, macht beliebigen Code aber nicht vertrauenswürdig. Eine bösartige Erweiterung kann trotzdem CPU-Leistung verschwenden, bis der Watchdog sie stoppt, ihren eigenen Speicher bis ans erlaubte Limit vollschreiben oder sich über Log-Ausgaben täuschend verhalten. Erweiterungen mit Vollzugriff auf die Seite geben diese Isolierung bewusst auf. Prüfe den Code deshalb immer, bevor du ihn aktivierst.

## Isolierung zur Laufzeit

Eine Browser-Erweiterung läuft in einem eigenen Worker innerhalb eines Sandbox-iframes mit undurchsichtigem Origin. Sie kommt weder an Marinaras Seite noch an DOM, Cookies, Browser-Speicher, Origin-APIs oder das Netzwerk heran. Erlaubt sind ihr: privater Erweiterungs-Speicher, Logging, verwaltete Timer, Aufräum-Registrierung, eingeschränkte Fenster, sichere Beitragspunkte in der Oberfläche sowie ein Nur-Lese-Abbild des aktiven Chats samt Charakter-IDs. Ausgewählte Felder der beteiligten Charakterkarten oder der gewählten Persona bekommt sie nur, wenn die passenden Berechtigungen deklariert und freigegeben sind.

Mit `marinara.ui.registerContribution(...)` kann eine Erweiterung Aktionen in der oberen Leiste, Einträge im Extensions-Menü und dauerhafte Panels am rechten Rand ergänzen. Marinara zeichnet diese Flächen im aktiven Theme und mit einem festen Satz an Bedienelementen: Überschriften, Text, vorformatierte Ausgabe, Schaltflächen, Texteingaben, Auswahlfelder, Schalter, Schieberegler, Farbwähler und Abstandshalter. Eine Erweiterung liefert nur Inhalt und Zustand – niemals HTML, CSS, URLs, React-Komponenten oder Event-Handler des Hosts.

Diese Oberflächen-Funktionen und -Regeln gelten für jede Browser-Erweiterung in der Sandbox gleichermaßen, egal woher sie stammt. Eine importierte externe Erweiterung läuft in dieser sicheren Umgebung – es sei denn, ihr Paket verlangt ausdrücklich **Full page access** (Vollzugriff auf die Seite) oder nutzt das ältere Format `marinara.extension` von vor der Sandbox, das weiter unten beschrieben ist.

### Ein von Marinara gezeichnetes Panel ergänzen

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

`kind: "button"` eignet sich für eine kompakte Aktion, `kind: "menu-item"` für eine Aktion im Extensions-Menü. Schaltflächen verwenden standardmäßig `surface: "top-bar"`. Alternativ können sie mit `position` auf `header`, `before-content` oder `after-content` die Flächen `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents` oder `settings` ansteuern. `icon` akzeptiert von Marinara unterstützte Lucide-Namen in kebab-case. Beide Aktionsarten rufen `onActivate` auf. Ein `panel` ruft `onActivate` beim Öffnen auf; seine Schaltflächen rufen `onEvent` mit den aktuellen Werten aller Panel-Bedienelemente auf. Der Handle bietet je nach Art unterschiedliche Updates: `button` akzeptiert `label`, `description`, `icon`, `surface` und `position`; `menu-item` akzeptiert `label`, `description` und `icon`; `panel` akzeptiert `label`, `description`, `icon` und `elements`. Alle Handles unterstützen `remove()`. IDs dürfen Buchstaben, Zahlen sowie `.`, `_` und `-` enthalten.

Dieses Beispiel platziert eine native Aktion oberhalb des Inhalts im Presets-Bereich:

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

Aufwendigere Werkzeuge bauen mehrstufige Oberflächen, indem sie die Panel-Elemente nach einem Ereignis austauschen. Halte den Anwendungszustand in `marinara.storage` – nicht im Markup.

### Den Kontext des aktiven Chats nutzen

Version 5 der Browser-Extension-API stellt undurchsichtige Kennungen für den Chat bereit, der gerade in Marinara angezeigt wird:

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

`marinara.context.get()` liefert dasselbe aktuelle Abbild, ohne ein Abo anzulegen. Ist kein Chat aktiv, ist `chatId` gleich `null` und `characterIds` leer. `characterId` ist nur gesetzt, wenn genau ein Charakter beteiligt ist; in Gruppenchats stehen alle Beteiligten in `characterIds`, und `characterId` bleibt `null`. `personaId` ist nur gesetzt, wenn `read_active_persona` freigegeben wurde.

Chat- und Charakter-IDs stehen immer zur Verfügung; damit kann eine Erweiterung ihren eigenen privaten Speicher sauber trennen. Für die Felder der Datensätze braucht es dagegen eine oder beide optionalen Berechtigungen im Manifest der Erweiterung:

```json
{
  "runtime": "client",
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` füllt `characters` mit den Karten, die am aktiven Chat beteiligt sind.
- `read_active_persona` füllt `persona` mit der Persona, die der aktive Chat verwendet.

Fehlt eine Berechtigung, bleibt der Wert `[]` beziehungsweise `null`. Marinara zeigt jede angeforderte Berechtigung unter **Requested access** (angeforderter Zugriff) und noch einmal im Freigabedialog für den exakten Hash. Kommt eine Berechtigung hinzu oder fällt eine weg, ändert sich der Hash des ausführbaren Codes: Die Erweiterung wird deaktiviert und braucht eine neue Freigabe.

Ein Charakter-Abbild enthält ausschließlich `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe` und `conversationDisplayName`. Ein Persona-Abbild enthält ausschließlich `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe` und `conversationDisplayName`. Alle Texte werden gekürzt, bevor sie die Sandbox-Brücke passieren.

Niemals übergibt Marinara Nachrichten, Creator Notes, System-Prompts, Post-History-Anweisungen, Kommentare, Avatar-Pfade, vollständige Charakter- oder Persona-Bibliotheken, nicht deklarierte Felder, Chat-Metadaten, Datenbank-Handles, Netzwerkzugriff oder schreibende Operationen. Auch Kontext-Aktualisierungen hängen am freigegebenen Code-Hash; sie kommen an, sobald sich der aktive Chat, seine Charakterliste oder die gewählte Persona ändert.

### Ältere Erweiterungen und Erweiterungen mit Vollzugriff

Wetter-Steuerungen, Prompt-Editoren und andere umfangreiche Abläufe sind völlig legitime Einsatzzwecke für Contributions. Sichere Portierungen kombinieren einen Starter im Menü oder in der oberen Leiste mit Panels, die sich Schritt für Schritt aktualisieren. Bestehende Pakete, die DOM-Overlays einfügen, Marinaras CSS-Selektoren abfragen, React-Interna durchsuchen oder `/api`-Routen derselben Origin aufrufen, lassen sich nicht unverändert in die sichere Laufzeitumgebung importieren.

Beiträge zur Oberfläche liefern nur die Bedienfläche, keine Rechte im Hintergrund. Die Kontext-API gibt stets die IDs des aktiven Chats und der Charaktere heraus und darüber hinaus nur die deklarierten Felder der oben aufgezählten aktiven Datensätze. Funktionen, die Nachrichten, Presets, Lorebooks, nicht deklarierte Charakter- oder Persona-Daten oder visuelle Szeneneffekte brauchen, benötigen weiterhin eine eigene, eng zugeschnittene Broker-Funktion, die Marinara bereitstellt. Nachbauen über Zugriffe auf das Host-DOM oder ungefilterte Netzwerkanfragen ist einer Erweiterung nicht erlaubt.

Hängt eine externe Erweiterung tatsächlich vom Zugriff auf das Host-DOM ab, darf sie Folgendes anfordern:

```json
{
  "runtime": "client",
  "capabilities": ["full_page_access"]
}
```

**Vollzugriff auf die Seite ist keine Sandbox-Funktion.** Freigegebenes JavaScript und CSS laufen direkt in Marinaras Seite. Der Code kann alles lesen und verändern, was die aktuelle Browser-Sitzung sieht, Chats und Karten auswerten, den Browser-Speicher nutzen, Netzwerkanfragen stellen und Marinara-APIs derselben Origin aufrufen. In der Praxis hat er dieselbe Macht wie Code, den du in die Browser-Konsole einfügst. Entwürfe von Professor Mari dürfen ihn nicht anfordern.

Ein älteres v1-Paket mit `kind: "marinara.extension"` und ohne ausdrückliches Feld `capabilities` erkennt Marinara als Paket von vor der Sandbox und vergibt beim Import **Full page access**. So landen alte Pakete wie WeatherTweaker im richtigen Prüfablauf, statt still im Worker zu scheitern. Ein modernes Paket, das dieses Format nutzt, aber in der sicheren Laufzeitumgebung bleiben will, muss `"capabilities": []` angeben.

Die beiden Schalter für externe Erweiterungen und die Freigabe per exaktem Hash gelten unverändert. Jede Änderung an Code, CSS oder Berechtigungen deaktiviert die Erweiterung und verlangt eine neue Freigabe. Beim Deaktivieren entfernt Marinara die eigenen Script- und Stylesheet-Knoten, bricht die über die Kompatibilitäts-API angelegten Timer ab und ruft die mit `marinara.onCleanup(...)` registrierten Callbacks auf. Weil Code in der Seite auch nicht registrierte Listener, Timer, globale Variablen oder DOM-Änderungen hinterlassen kann, bleibt das Aufräumen ein Versuch nach bestem Wissen: Lade die Seite nach dem Deaktivieren neu, falls etwas übrig bleibt.

Die ältere API `marinara.ui.showWindow(...)` steht weiterhin für ein temporäres Fenster im iframe mit undurchsichtigem Origin bereit. Sie nutzt dieselben festen Bedienelemente und liefert die Handles `update(...)` und `close()`. Greif lieber zu Contributions, wenn sich das Werkzeug über Marinaras normale Navigation erreichen lassen soll.

Eine Server-Erweiterung läuft in einem separaten, rechtebeschränkten Node-Prozess innerhalb von macOS Seatbelt oder Linux Bubblewrap. Sie kommt weder an Marinaras Dateien noch an deine eigenen Dateien, geerbte Server-Geheimnisse, das Netzwerk, Kindprozesse, Worker oder native Addons heran. Lässt sich keine unterstützte Betriebssystem-Sandbox einrichten, bleiben Server-Erweiterungen deaktiviert.

### Unterstützte Plattformen

Browser-Erweiterungen sperrt bereits der Browser selbst in eine Sandbox – sie laufen deshalb überall. Server-Erweiterungen brauchen eine unterstützte Betriebssystem-Sandbox; fehlt sie, bleiben sie deaktiviert und lassen sich auch nicht einschalten. Marinara führt sie niemals ersatzweise ohne Sandbox aus.

| Plattform               | Browser-Erweiterungen in Sandbox | Externe Erweiterungen mit Vollzugriff | Server-Erweiterungen                        |
| ----------------------- | -------------------------------- | ------------------------------------- | ------------------------------------------- |
| macOS                   | ✅ In Sandbox                    | ⚠️ Ausdrückliches Vertrauen nötig     | ✅ In Sandbox (Seatbelt)                    |
| Linux (mit Bubblewrap)  | ✅ In Sandbox                    | ⚠️ Ausdrückliches Vertrauen nötig     | ✅ In Sandbox (Bubblewrap)                  |
| Linux (ohne `bwrap`)    | ✅ In Sandbox                    | ⚠️ Ausdrückliches Vertrauen nötig     | ⛔ Deaktiviert – `bwrap` installieren       |
| Windows                 | ✅ In Sandbox                    | ⚠️ Ausdrückliches Vertrauen nötig     | ⛔ Deaktiviert – Browser-Erweiterung nutzen |
| Android                 | ✅ In Sandbox                    | ⚠️ Ausdrückliches Vertrauen nötig     | ⛔ Deaktiviert – Browser-Erweiterung nutzen |

Unter Windows und Android gibt es keine unterstützte Prozess-Sandbox des Betriebssystems, deshalb entfallen Server-Erweiterungen dort bewusst. Nimm stattdessen eine Browser-Erweiterung – oder betreibe den Marinara-Server auf macOS oder Linux (mit `bwrap`), wenn du eine Server-Erweiterung brauchst.

## Externe Erweiterungen

Importe von Fremdanbietern sind standardmäßig gesperrt und ausgeblendet. Dafür sind zwei Schritte nötig:

1. Setze auf dem Marinara-Host `ENABLE_EXTERNAL_EXTENSIONS=true` in `.env`.
2. Öffne **Settings** > **Advanced** (Erweitert) > **Danger Zone** (Gefahrenbereich), scroll unter die Bedienelemente zum Löschen von Daten, lies die Warnung und aktiviere **Allow third-party extension imports** (Importe von Fremdanbietern erlauben).

Erst danach zeigt **Settings** > **Addons** den Bereich **External Extensions** samt Bedienelementen für Datei- und Ordner-Import. Diese Formate versteht Marinara immer:

- `.personal-extension.zip` und kompatible `.zip`-Pakete;
- `.json`-Manifeste;
- `.css`;
- `.js`, `.mjs` und `.cjs`;
- `.server.js`, `.server.mjs` und `.server.cjs`.

Ein Import bringt nie eine Freigabe mit und kann sich nicht selbst aktivieren. Als extern gelten außerdem alte Einträge, aus einem Profil importierte, von Hand abgelegte und solche unbekannter Herkunft. Sie bleiben ausgeblendet, lassen sich nicht freigeben und sind aus beiden Laufzeitumgebungen ausgeschlossen, solange nicht beide Schalter offen sind.

Sieh dir die Liste unter **Requested access** an, bevor du einen exakten Hash freigibst. Die meisten Browser-Erweiterungen sollten in der sicheren Sandbox bleiben. Ein Paket mit der Kennzeichnung **Full page access** ist bewusst nicht isoliert – aktiviere es nur, wenn du genau diese Version geprüft hast und ihr vertraust.

Sobald du einen der beiden Schalter umlegst, stoppt Marinara laufende externe Server-Prozesse, entfernt die Browser-Worker samt der Laufzeit-Knoten mit Vollzugriff und deaktiviert die gespeicherten externen Einträge. Wer die Schalter erneut öffnet, startet sie damit nicht automatisch wieder. Lade die Seite neu, falls eine Erweiterung mit Vollzugriff Änderungen hinterlassen hat, die sie nicht zum Aufräumen angemeldet hatte.

Erweiterungen von Fremdanbietern können bösartigen oder gefährlichen Code enthalten. Prüfe jede einzelne Zeile, bevor du sie herunterlädst, importierst oder aktivierst. Du handelst dabei vollständig auf eigene Verantwortung.

## Export, Fassungen und Notfallhilfe

Über die Export-Aktion einer Erweiterung lädst du ein portables Paket herunter. Exportierte und wiederhergestellte Pakete bleiben deaktiviert. Auch wer eine frühere Fassung wiederherstellt, erhält wieder einen deaktivierten Entwurf.

Verhält sich eine Erweiterung daneben, wähle **Disable** (deaktivieren). Ist die Oberfläche nicht erreichbar, beende Marinara und setze im passenden `installed_extensions`-Eintrag den Wert `enabled` auf `"false"`. Setze `approvedHash` niemals von Hand.

## Verwandte Anleitungen

- [Persönliche Erweiterungen schreiben](writing-personal-extensions.md)
- [Professor Mari](../home/professor-mari.md)
- [Server-Konfiguration](../CONFIGURATION.md)
- [Backup und Wiederherstellung](../data/backup-and-restore.md)
- [Fernzugriff](../REMOTE_ACCESS.md)
