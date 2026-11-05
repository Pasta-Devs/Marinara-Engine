# Eigene Tools und Function Calling

Ein eigenes Tool (auch Function genannt) lässt die KI mitten im Chat eine kleine Aktion ausführen. Die Aktion kann einen festen Text zurückgeben, eine Webadresse aufrufen oder ein kurzes Skript auf dem Server ausführen. Nutze eines, wenn die KI etwas nachschlagen oder berechnen soll, statt zu raten.

Function Calling bedeutet, dass die KI die App bittet, eine Aktion auszuführen, und das Ergebnis dann in ihrer Antwort verwendet. Marinara bringt bereits eingebaute Tools mit, etwa Würfelwürfe, die Lorebook-Suche und Änderungen am Spielzustand. Deine eigenen Tools arbeiten daneben. Ein eigenes Tool hängt nicht an einer Charakterkarte. Du schaltest es für einen Chat ein oder hängst es an einen Agenten (einen Helfer, der neben deinem Chat mitläuft).

> **Hinweis:** Tools brauchen eine Verbindung, die sie unterstützt. Abonnement-Verbindungen von Claude und Grok ignorieren Tool-Definitionen, deshalb zeigt **Chat Settings** (Chat-Einstellungen) bei ihnen einen Hinweis und deaktiviert die Tool-Bedienelemente. Textbefehle und Würfel-Tags funktionieren weiterhin.

## Ein Tool erstellen

Bevor du anfängst, öffne über die obere Leiste das Panel **Presets**. Tools liegen dort im Bereich **Functions** (Funktionen) mit dem Schraubenschlüssel-Symbol. Öffnest du Marinara von einem anderen Gerät aus, speichere zuerst das Admin-Secret unter **Settings → Advanced → Admin Access** (Einstellungen → Erweitert → Admin-Zugriff). Es muss mit `ADMIN_SECRET` auf dem Server übereinstimmen; siehe [Referenz zur Server-Konfiguration](../CONFIGURATION.md).

Für einen ersten Versuch wähle **Static Result**: Dieser Typ braucht sonst nichts.

### So legst du ein Tool an

1. Öffne **Presets** und such den Bereich **Functions**.
2. Klick auf **Create function** (Funktion erstellen, Plus-Symbol). Ein leerer Tool-Editor öffnet sich.
3. Gib einen Namen in Kleinbuchstaben und snake_case ein, etwa `check_weather`. Genau unter diesem Namen ruft die KI das Tool auf. Er beginnt mit einem Kleinbuchstaben und besteht danach aus Kleinbuchstaben, Ziffern und Unterstrichen.
4. Fülle **Description** (Beschreibung) aus. Formuliere sie als Anweisung an die KI, denn die KI entscheidet anhand dieses Textes, wann sie das Tool aufruft. Beispiel: `Get the current weather for a city the user names.`
5. Ergänze die Parameter, die das Tool braucht (siehe [Parameter hinzufügen](#add-parameters)).
6. Wähle einen **Execution Type** (Ausführungstyp): **Static Result**, **Webhook** oder **Script**.
7. Fülle das Feld für diesen Typ aus (siehe [Einen Ausführungstyp wählen](#choose-an-execution-type)).
8. Klick auf **Save** (Speichern). Neben der Schaltfläche blitzt kurz ein grünes **Saved** auf.

Regeln für Namen und Beschreibungen:

- Der Name ist 1 bis 100 Zeichen lang, die Beschreibung 1 bis 500 Zeichen.
- Zwei Tools dürfen nicht denselben Namen tragen, und ein Tool darf keinen eingebauten Namen wie `roll_dice`, `update_game_state`, `set_expression`, `trigger_event`, `search_lorebook`, `web_search` oder `update_about_me` verwenden. Bei einer Kollision erscheint eine Meldung wie `"your_name" is a reserved built-in tool name.`
- Verlässt du den Editor mit ungespeicherten Änderungen, bietet ein Banner **Keep editing**, **Discard** oder **Save & close** an.

Die Überschrift des Bereichs **Functions** hat drei Symbol-Schaltflächen:

- **Create function** (Plus-Symbol)
- **Import functions from ZIP or JSON** (Funktionen aus ZIP oder JSON importieren)
- **Export functions to ZIP** (Funktionen als ZIP exportieren) – ausgegraut, wenn du keine Tools hast

Jedes Tool in der Liste zeigt:

- seinen Namen, seinen Typ, die Anzahl der Parameter und die Beschreibung
- einen Ein-/Aus-Schalter
- **Edit function** (Funktion bearbeiten) und **Delete Function** (Funktion löschen)

Zieh ein Tool an seinem Anfasser, um die Liste neu zu ordnen. Die Reihenfolge dient nur der Anzeige. Solange es keine Tools gibt, steht in der Liste **No functions yet**.

<a id="add-parameters"></a>

## Parameter hinzufügen

Parameter sind die Eingaben, die die KI beim Aufruf an dein Tool schickt. Jeder Parameter hat einen Namen, einen Typ, eine Pflicht-Markierung und eine Beschreibung.

1. Klick in der Gruppe **Parameters** (Parameter) auf **Add Parameter** (Parameter hinzufügen).
2. Gib einen Namen ein, etwa `city`.
3. Wähle einen Typ: `string`, `number`, `boolean`, `array` oder `object`.
4. Aktiviere **Required** (Pflichtfeld), wenn die KI diesen Wert immer mitschicken muss.
5. Schreib eine Beschreibung, die der KI erklärt, was der Wert bedeutet, etwa `The city name to look up, such as Tokyo.`

Mit **Add Parameter** fügst du weitere Zeilen hinzu, mit der Minus-Schaltfläche einer Zeile entfernst du sie. Eine Zeile ohne Namen fällt beim Speichern weg.

Scheint die KI ein importiertes Tool nie aufzurufen, sind seine Parameter womöglich ungültig. Die App überspringt das Tool dann, ohne dir Bescheid zu geben. Lösche die Parameter und leg sie von Hand neu an.

<a id="choose-an-execution-type"></a>

## Einen Ausführungstyp wählen

### Static Result

Ein **Static Result**-Tool gibt bei jedem Aufruf denselben Text zurück. Es braucht keinen externen Dienst. Auf seiner Karte steht **Returns a fixed string when called.**

Das einzige Feld ist **Static Result**, ein mehrzeiliges Textfeld. Lässt du es leer, gibt das Tool `OK` zurück.

Beispiel: ein Tool namens `store_hours` ohne Parameter mit diesem **Static Result**:

```text
We are open Monday to Friday, 9am to 5pm. We are closed on weekends.
```

Ruft die KI `store_hours` auf, bekommt sie diesen Text zusammen mit dem Tool-Namen und allen gesendeten Argumenten und kann dem Nutzer deine Öffnungszeiten nennen.

### Webhook

Ein **Webhook**-Tool schickt den Aufruf an eine Webadresse und gibt die Antwort dieses Dienstes an die KI zurück. Ein Webhook ist eine Adresse, die Daten annimmt und Daten zurückschickt. Auf seiner Karte steht **Sends a POST request to an external URL.**

Das einzige Feld ist **Webhook URL**. Die App schickt eine POST-Anfrage, eine Art, Daten an einen Webdienst zu senden. Der Anfragerumpf ist JSON, ein reines Textformat für strukturierte Daten, und sieht so aus:

```json
{ "tool": "your_tool_name", "arguments": { ... } }
```

Schaltest du **Include hidden chat context** (verborgenen Chat-Kontext mitgeben) ein, enthält der Rumpf zusätzlich einen Wert `context`. Der Dienst antwortet mit JSON oder reinem Text, und diese Antwort geht an die KI zurück.

Beispiel: ein Tool namens `check_weather` mit einem erforderlichen String-Parameter `city` und dieser **Webhook URL**:

```text
https://api.example.com/weather
```

Ruft die KI es mit `city` = Tokyo auf, schlägt dein Dienst das Wetter nach und antwortet, und die KI verwendet die Antwort in ihrer Nachricht.

Grenzen:

- Die Antwort ist auf 512 KB begrenzt.
- Für jeden Aufruf gilt ein Zeitlimit. Der Standard sind 60 Sekunden (`CUSTOM_TOOL_TIMEOUT_MS`).
- Standardmäßig sind nur `https://`-Adressen erlaubt. Private und lokale Adressen wie `localhost` oder eine Adresse im Heimnetzwerk sind blockiert, bis ein Admin des Servers sie freigibt. Siehe [Referenz zur Server-Konfiguration](../CONFIGURATION.md).
- Schlägt der Aufruf fehl oder läuft er ins Zeitlimit, bekommt die KI ein Fehlerergebnis, und der Chat läuft weiter.

Wenn es nicht funktioniert hat: Prüfe, ob die Adresse mit `https://` beginnt und erreichbar ist. Eine lokale Adresse bleibt blockiert, solange der Admin sie nicht freigibt. Ein langsamer Dienst kann das Limit von 60 Sekunden erreichen.

### Script

Ein **Script**-Tool führt ein kurzes Stück JavaScript auf dem Server aus und gibt das Ergebnis zurück. JavaScript ist eine weit verbreitete Programmiersprache. Auf seiner Karte steht **Runs a JavaScript expression server-side.**

Script-Tools sind standardmäßig aus. Hat dein Server sie nicht eingeschaltet, ist die Karte **Script** ausgegraut und es erscheint die bernsteinfarbene Pille **Script disabled**. Zum Einschalten trägt der Admin des Servers diese Zeile in die `.env`-Datei des Servers ein und startet Marinara neu:

```text
CUSTOM_TOOL_SCRIPT_ENABLED=true
```

Das einzige Feld ist **Script Body**. Das Skript liest `args` (die Werte, die die KI gesendet hat) und muss mit `return` ein Ergebnis zurückgeben. `JSON`, `Math` und `Date` stehen zur Verfügung.

Beispiel: ein Tool namens `add_numbers` mit zwei erforderlichen Number-Parametern `x` und `y` und diesem **Script Body**:

```js
const result = args.x + args.y;
return { sum: result };
```

Ruft die KI es mit `x` = 2 und `y` = 3 auf, gibt das Tool die Summe 5 zurück. Wirft das Skript einen Fehler, bekommt die KI ein Fehlerergebnis.

Ein Skript führt echten Code auf deinem Server aus, und zwar in einer Sandbox (einem abgeschotteten Bereich, der begrenzt, was Code darf):

- Kein Netzwerkzugriff und kein Dateizugriff.
- Kein Zugriff auf Umgebungsvariablen oder Server-Geheimnisse.
- Ein Zeitlimit. Der Standard sind 60 Sekunden.

Die Sandbox ist keine vollständige Abschottung auf Betriebssystemebene. Wer Tools anlegen darf, kann trotzdem ein Skript schreiben, das CPU oder Arbeitsspeicher verschwendet. Schalte Script-Tools nur auf Servern ein, denen du vertraust, und sei vorsichtig mit Skripten, die andere geschrieben haben.

Wenn es nicht funktioniert hat: Ist die Karte **Script** ausgegraut, bitte den Admin, `CUSTOM_TOOL_SCRIPT_ENABLED=true` zu setzen und neu zu starten.

### Verborgenen Chat-Kontext mitgeben

**Webhook**- und **Script**-Tools können zusätzliche Chat-Daten empfangen, die die KI nicht als Tool-Eingaben sieht. Schalte im Tool-Editor **Include hidden chat context** ein (standardmäßig aus). Dein Tool bekommt dann einen Wert `context`, der Folgendes enthalten kann:

- den Chat-Modus
- den Namen der aktiven Persona und die Charakternamen
- gespeicherte Chat-Variablen
- im Game Mode den Spielzustand

So kann ein Tool sein Ergebnis anpassen, ohne dass die KI all diese Daten übergeben muss.

## Tools für einen Chat einschalten

Ein Tool zu erstellen bringt die KI noch nicht dazu, es zu nutzen. Du schaltest die Tool-Nutzung außerdem für den Chat ein.

1. Öffne einen Chat und dann **Chat Settings**.
2. Öffne den Bereich **Function Calling** (Funktionsaufrufe) mit dem Schraubenschlüssel-Symbol.
3. Schalte **Enable Tool Use** (Tool-Nutzung aktivieren) ein. Die Beschreibung dazu lautet **Allow AI to call functions (dice rolls, game state, etc.)**. In einem neuen Chat ist die Option aus.
4. Prüfe, ob es funktioniert: Frag die KI etwas, das dein Tool beantwortet, beim Beispiel `store_hours` etwa „Wie sind eure Öffnungszeiten?“. Die Antwort sollte den Text des Tools verwenden.

Ist **Enable Tool Use** eingeschaltet und darunter nichts hinzugefügt, kann der Chat jedes global aktivierte Tool verwenden, das er unterstützt: die eingebauten Tools und jedes eigene Tool, dessen Schalter unter **Functions** eingeschaltet ist. Game-Chats brauchen für `search_lorebook` zusätzlich **Let the GM search lore** (GM im Weltwissen suchen lassen).

So begrenzt du einen Chat auf eine Auswahl:

1. Klick auf **Add Functions** (Funktionen hinzufügen). Eine Auswahl öffnet sich, mit einem Suchfeld, das nur Tool-Namen durchsucht.
2. Hake die gewünschten Tools an. Die Liste mischt eingebaute und eigene Tools.
3. Klick auf **Add Selected** (ausgewählte hinzufügen).

Sobald du Tools hinzugefügt hast, funktionieren in diesem Chat nur noch diese. **New Custom Function** (neue eigene Funktion) in der Auswahl springt in den Tool-Editor.

Game-Chats können eine separate Verbindung für die Tool-Planung verwenden. Kosten und Verhalten erklärt [Optionale Tool-Planung und Lorebook-Suche](../game/getting-started.md#optional-tool-planning-and-lore-searches).

Wenn es nicht funktioniert hat: Prüfe, ob **Enable Tool Use** eingeschaltet ist, ob das Tool in der Liste des Chats steht, falls du bestimmte Tools hinzugefügt hast, und ob der Schalter des Tools unter **Functions** eingeschaltet ist. Eine klarere **Description** und klarere Parameterbeschreibungen helfen der KI zu entscheiden, wann sie das Tool aufruft.

## Tools an einen Agenten hängen

Du kannst ein Tool auch einem Agenten statt einem Chat geben.

1. Öffne das Panel **Agents** und darin einen Agenten.
2. Öffne seine Gruppe **Tools / Function Calling**.
3. Schalte die Tools ein, die dieser Agent nutzen darf.

**Enable Tool Use** im Bereich **Function Calling** des Chats musst du trotzdem einschalten. Die Fußzeile des Agenten-Editors erinnert dich daran. Mehr zu Agenten allgemein findest du unter [Eigene Agenten erstellen](../agents/custom-agents.md).

## Tools exportieren und importieren

- Um ein einzelnes Tool zu exportieren, öffne es und klick auf **Export function** (Funktion exportieren). Das speichert eine `.json`-Datei.
- Um alle Tools zu exportieren, klick auf **Export functions to ZIP**.
- Zum Importieren klick auf **Import functions from ZIP or JSON** und wähle eine `.json`- oder `.zip`-Datei. Eine Meldung nennt die Anzahl der importierten Tools.

Importierte Webhook- und Script-Tools werden immer ausgeschaltet gespeichert, mit ausgeschaltetem **Include hidden chat context**, selbst wenn die Datei eines davon verlangt. Marinara zeigt dann den Typ, die Webhook-Adresse und die Berechtigungen, die die Datei angefordert hat. Öffne jedes importierte Tool, prüfe es und schalte es nur ein, wenn du ihm vertraust. Static-Tools behalten ihren importierten Ein-/Aus-Zustand.

Ein Import überspringt jedes Tool, dessen Name mit einem vorhandenen oder eingebauten Tool kollidiert. Agenten-Pakete enthalten keine eigenen Tools: Exportiere und prüfe sie separat und hänge sie an, nachdem du den Agenten importiert hast.

## Verwandte Anleitungen

- [Eigene Agenten erstellen](../agents/custom-agents.md)
- [Home-Assistant-Integration](../integrations/home-assistant.md)
- [Referenz zur Server-Konfiguration](../CONFIGURATION.md)
