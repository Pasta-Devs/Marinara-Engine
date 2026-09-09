# Eigene Tools und Function Calling

In dieser Anleitung erfährst du, was eigene Tools – in der App auch Functions genannt – in Marinara Engine sind. Ein eigenes Tool bringt der KI bei, mitten im Chat eine kleine Aktion auszuführen. Es kann einen festen Text zurückgeben, eine externe Webadresse aufrufen oder ein kurzes Skript auf dem Server ausführen. Du lernst, wie du eines baust, wie du die Tool-Nutzung für einen Chat einschaltest und wie Script-Tools sicher bleiben.

## Was Function Calling ist

Beim Function Calling bittet die KI die App, eine Aktion auszuführen, und verwendet das Ergebnis anschließend in der Antwort. Eingebaute Tools bringt die App bereits mit, etwa Würfelwürfe, die Lorebook-Suche und Änderungen am Spielzustand. Eigene Tools stehen im selben **Function Calling**-System direkt neben diesen eingebauten Tools.

Typische Einsatzzwecke für ein eigenes Tool:

- Eine feste Information zurückgeben, etwa deine Öffnungszeiten oder eine Sammlung von Hausregeln.
- Live-Daten von einem externen Dienst abfragen, etwa das Wetter oder ein Smart-Home-Gerät.
- Eine schnelle Berechnung erledigen, etwa Zahlen addieren oder ein eigenes Ergebnis auswürfeln.

Ein eigenes Tool hängt nicht an einer Charakterkarte. Stattdessen schaltest du es für einen Chat ein oder hängst es an einen Agenten. Ein Agent ist ein Helfer, der parallel zum Chat läuft. Beide Wege beschreibt diese Anleitung weiter unten.

Native Funktionsaufrufe erfordern eine Verbindung mit Tool-Unterstützung. Die Abonnementtransporte von Claude und Grok ignorieren native Tool-Definitionen. Deshalb zeigt Chat Settings einen Verfügbarkeitshinweis und deaktiviert die Tool-Bedienelemente für diese Verbindungen. Ihre Textbefehle und Würfel-Tags bleiben verfügbar. Game-Chats können eine separate Verbindung für die Tool-Planung wählen; Kosten und Verhalten erklärt [Optionale Tool-Planung und Lorebook-Suche](../game/getting-started.md#optional-tool-planning-and-lore-searches).

Lorebook-Suchen ordnen Ergebnisse semantisch, wenn die aktivierten Einträge kompatible Vektoren haben. Conversation und Roleplay behalten die Textsuche bei, wenn die semantische Suche nicht verfügbar ist. Die Game-Lorebook-Suche muss separat eingeschaltet werden und meldet fehlende oder inkompatible Vektoren; sie vektorisiert nie automatisch ein Buch.

## Der Bereich Functions

Eigene Tools erstellst und verwaltest du im Panel **Presets** (Presets).

1. Öffne die obere Leiste und klick auf **Presets**.
2. Suche den Bereich **Functions** (Funktionen) – sein Symbol ist ein Schraubenschlüssel.
3. Unter der Überschrift steht der Hinweis **Custom function calls available from Chat Settings**.

Die Bereichsüberschrift hat drei Symbol-Schaltflächen:

- **Create function** (Funktion erstellen, Plus-Symbol) öffnet einen leeren Tool-Editor.
- **Import functions from ZIP or JSON** (Funktionen aus ZIP oder JSON importieren, Download-Symbol) öffnet einen Dateiauswahl-Dialog.
- **Export functions to ZIP** (Funktionen als ZIP exportieren, Upload-Symbol) speichert alle Tools in einer Datei. Ohne Tools ist die Schaltfläche ausgegraut.

Jedes Tool in der Liste zeigt seinen Namen und zwei kleine Pillen: den Typ und die Anzahl der Parameter. Dazu kommen eine kurze Beschreibung, ein Ein-/Aus-Schalter, eine Schaltfläche **Edit function** (Funktion bearbeiten) und eine Schaltfläche **Delete function** (Funktion löschen). Sind Script-Tools auf dem Server deaktiviert, zeigt ein **Script**-Tool zusätzlich die bernsteinfarbene Pille **Script disabled**. Wie du sie aktivierst, steht weiter unten im Abschnitt zum Ausführungstyp Script. Am Anfasser lässt sich jedes Tool an eine andere Stelle ziehen. Die Reihenfolge dient nur der Anzeige und ändert nichts am Verhalten. Solange noch kein Tool existiert, steht in der Liste **No functions yet**.

Das Verwalten von Tools – erstellen, bearbeiten, löschen, umsortieren und der Ein-/Aus-Schalter – läuft über einen geschützten Teil der App. Verwaltest du Tools von einem anderen Gerät aus statt vom Computer mit dem Server, musst du vorher ein Admin-Geheimnis speichern. Mehr dazu in der [Referenz zur Serverkonfiguration](../CONFIGURATION.md) und im Hinweis unter „Sicherheit bei Skripten“ weiter unten.

## Ein Tool erstellen

So baust du ein Tool:

1. Klick im Bereich **Functions** auf **Create function**. Der vollständige Tool-Editor öffnet sich.
2. Gib oben im Namensfeld einen Namen in Kleinbuchstaben und snake_case ein. Genau unter diesem Namen ruft die KI das Tool auf. Ein gültiger Name beginnt mit einem Kleinbuchstaben und besteht danach nur aus Kleinbuchstaben, Ziffern und Unterstrichen. Beispiel: `check_weather`.
3. Fülle das Feld **Description** (Beschreibung) aus. Formuliere sie als Anweisung an die KI, denn die KI entscheidet anhand dieses Textes, wann sie das Tool aufruft. Beispiel: `Get the current weather for a city the user names.`
4. Ergänze die **Parameters** (Parameter), die das Tool braucht – siehe nächster Abschnitt.
5. Wähle einen **Execution Type** (Ausführungstyp): **Static Result**, **Webhook** oder **Script**.
6. Fülle das Feld aus, das zum gewählten Typ gehört.
7. Klick auf **Save**. Neben der Schaltfläche blitzt kurz ein grünes **Saved** auf.

Ein paar Regeln dazu:

- Der Name ist 1 bis 100 Zeichen lang, die Beschreibung 1 bis 500 Zeichen.
- Zwei Tools dürfen nicht denselben Namen tragen. Auch der Name eines eingebauten Tools ist tabu – siehe „Reservierte Namen“ weiter unten.
- Verlässt du den Editor mit ungespeicherten Änderungen, bietet ein Banner **Keep editing**, **Discard** oder **Save & close** an.

## Der Parameter-Editor

Parameter sind die Werte, die die KI beim Aufruf an das Tool übergibt. Jeder Parameter hat einen Namen, einen Typ, eine Pflicht-Markierung und eine Beschreibung.

1. Klick in der Gruppe **Parameters** auf **Add Parameter** (Parameter hinzufügen).
2. Gib einen Parameternamen ein, zum Beispiel `city`.
3. Wähle im Dropdown-Menü einen Typ: `string`, `number`, `boolean`, `array` oder `object`.
4. Aktiviere **Required** (Pflichtfeld), wenn die KI diesen Wert immer mitschicken muss.
5. Schreib eine Beschreibung, die der KI erklärt, was der Wert bedeutet. Beispiel: `The city name to look up, such as Tokyo.`

Über **Add Parameter** kommen weitere Zeilen dazu, über die Minus-Schaltfläche fliegt eine Zeile wieder raus. Zeilen ohne Namen verschwinden beim Speichern. Gute Parameterbeschreibungen sind wichtig, denn nur daraus lernt die KI, was sie schicken soll.

Wird ein Tool nie aufgerufen, steckt oft ein kaputter Parameter-Aufbau dahinter. Das passiert meist bei Tools aus einer von Hand bearbeiteten Datei mit ungültigen Parametern. In dem Fall überspringt die App das Tool bei der Generierung stillschweigend und schreibt nur eine Notiz ins Server-Log.

## Ausführungstyp: Static Result

Ein **Static Result**-Tool gibt bei jedem Aufruf denselben festen Text zurück. Es braucht keinen externen Dienst und funktioniert sofort bei allen. Auf der Karte steht **Returns a fixed string when called.**

Das einzige Feld heißt **Static Result** und ist ein mehrzeiliges Textfeld. Was immer du hier einträgst, geht beim Aufruf an die KI zurück. Bleibt es leer, gibt das Tool `OK` zurück.

Ein Beispiel: Leg ein Tool namens `store_hours` ohne Parameter an. Trag in das Feld **Static Result** Folgendes ein:

```
We are open Monday to Friday, 9am to 5pm. We are closed on weekends.
```

Ruft die KI nun `store_hours` auf, bekommt sie diesen Text zurück und kann die Öffnungszeiten nennen. Die KI sieht deinen Text zusammen mit dem Tool-Namen und den gesendeten Argumenten, nicht die nackte Zeile für sich allein.

## Ausführungstyp: Webhook

Ein **Webhook**-Tool schickt den Tool-Aufruf an eine externe Webadresse und reicht die Antwort dieses Dienstes an die KI weiter. Ein Webhook ist eine Webadresse, die Daten annimmt und Daten zurückschickt. Auf der Karte steht **Sends a POST request to an external URL.**

Das einzige Feld heißt **Webhook URL**. Die App schickt eine POST-Anfrage an diese Adresse. Mit einer POST-Anfrage werden Daten an einen Webdienst übermittelt. Der Anfragerumpf ist JSON, ein reines Textformat für strukturierte Daten, und sieht so aus:

```
{ "tool": "your_tool_name", "arguments": { ... } }
```

Der Dienst sollte mit JSON oder reinem Text antworten. Diese Antwort geht an die KI zurück.

Ein Beispiel: Leg ein Tool namens `check_weather` mit einem erforderlichen String-Parameter namens `city` an. Trag als **Webhook URL** die Adresse deines eigenen Dienstes ein:

```
https://api.example.com/weather
```

Ruft die KI `check_weather` mit `city` = Tokyo auf, empfängt dein Dienst die Anfrage, schlägt das Wetter nach und antwortet. Die KI verwendet diese Antwort dann in ihrer Nachricht.

Was du zu Webhooks wissen solltest:

- Die Antwort ist auf 512 KB begrenzt.
- Für jeden Aufruf gilt ein Zeitlimit, das der Server vorgibt. Der Standard sind 60 Sekunden.
- Standardmäßig sind nur `https://`-Adressen erlaubt. Private und lokale Adressen wie `localhost` oder eine Adresse im Heimnetzwerk sind blockiert. Eine Server-Administratorin muss eine Einstellung setzen, um lokale Adressen freizugeben. Siehe [Referenz zur Serverkonfiguration](../CONFIGURATION.md).
- Schlägt der Aufruf fehl oder läuft er ins Zeitlimit, bekommt die KI ein Fehlerergebnis – der Chat stürzt nicht ab.

## Ausführungstyp: Script

Ein **Script**-Tool führt ein kurzes Stück JavaScript auf dem Server aus und gibt das Ergebnis zurück. JavaScript ist eine weit verbreitete Programmiersprache. Auf der Karte steht **Runs a JavaScript expression server-side.**

Aus Sicherheitsgründen sind Script-Tools standardmäßig deaktiviert. Solange der Server sie nicht freigibt, ist die Karte **Script** ausgegraut und es erscheint eine Warnung. Zum Aktivieren trägt die Server-Administratorin diese Zeile in die `.env`-Datei des Servers ein und startet die App neu:

```
CUSTOM_TOOL_SCRIPT_ENABLED=true
```

Das einzige Feld heißt **Script Body**. Das Skript kann `args` lesen – die von der KI gesendeten Werte – und muss ein Ergebnis mit `return` zurückgeben. Zusätzlich stehen `JSON`, `Math` und `Date` zur Verfügung.

Ein Beispiel: Leg ein Tool namens `add_numbers` mit zwei erforderlichen Number-Parametern namens `x` und `y` an. Trag in das Feld **Script Body** Folgendes ein:

```
const result = args.x + args.y;
return { sum: result };
```

Ruft die KI `add_numbers` mit `x` = 2 und `y` = 3 auf, liefert das Tool die Summe 5. Wirft das Skript einen Fehler, bekommt die KI ein Fehlerergebnis statt eines Absturzes. Lies den Abschnitt „Sicherheit bei Skripten“ weiter unten, bevor du Skripte freigibst.

## Verborgenen Chat-Kontext mitgeben

Sowohl **Webhook**- als auch **Script**-Tools können ein verborgenes Kontext-Objekt empfangen. Das sind zusätzliche Chat-Daten, die die KI nicht als Tool-Eingaben sieht. Aktiviere dafür im Tool-Editor den Schalter **Include hidden chat context** (verborgenen Chat-Kontext mitgeben). Standardmäßig ist er aus.

Ist er aktiv, bekommt der Webhook oder das Skript neben den Argumenten einen Wert `context`. Darin können der Chat-Modus, der Name der aktiven Persona und die Charakternamen im Chat stecken. Möglich sind außerdem gespeicherte Chat-Variablen und, im Game Mode, der Spielzustand. So kann das Tool sein Ergebnis anpassen, ohne dass die KI all diese Daten selbst übergeben muss.

## Tool-Nutzung für einen Chat einschalten

Ein Tool zu erstellen reicht nicht – die KI nutzt es erst, wenn du die Tool-Nutzung auch für den Chat einschaltest.

1. Öffne einen Chat und klick auf das Zahnrad, um **Chat Settings** (Chat-Einstellungen) zu öffnen.
2. Öffne den Bereich **Function Calling** – sein Symbol ist ein Schraubenschlüssel.
3. Aktiviere **Enable Tool Use** (Tool-Nutzung erlauben). Die Beschreibung dazu lautet **Allow AI to call functions (dice rolls, game state, etc.)**. In einem neuen Chat ist die Option aus.

Ist **Enable Tool Use** aktiv und darunter kein Tool eingetragen, darf der Chat alle global aktivierten Tools nutzen. Das umfasst die eingebauten Tools wie Würfelwürfe und Lorebook-Suche sowie jedes eigene Tool, das du im Bereich **Functions** eingeschaltet hast. Für eine engere Auswahl trägst du bestimmte Tools ein:

1. Klick auf **Add Functions** (Funktionen hinzufügen). Es öffnet sich eine Auswahl mit Suchfeld.
2. Hake die gewünschten Tools an. Die Liste mischt eingebaute und eigene Tools.
3. Klick auf **Add Selected**, um sie zu übernehmen.

Sobald mindestens ein Tool eingetragen ist, funktionieren in diesem Chat nur noch diese Tools. Über **New Custom Function** in der Auswahl springst du außerdem direkt in den Tool-Editor. Das Suchfeld der Auswahl durchsucht nur Tool-Namen, keine Beschreibungen.

## Tools an einen Agenten hängen

Ein Tool lässt sich statt einem Chat auch einem Agenten geben. Ein Agent ist ein halb-autonomer Helfer, der während der Generierung läuft – etwa eine Lorebook-Pflege oder eine Musikauswahl.

1. Öffne das Panel **Agents** und darin einen Agenten.
2. Öffne die Gruppe **Tools / Function Calling**.
3. Schalte die Tools ein, die dieser Agent nutzen soll.

Auch mit eingerichtetem Agenten musst du **Enable Tool Use** im Bereich **Function Calling** des Chats aktivieren. Eine Anmerkung zur Wortwahl: Der Fußtext im Agenten-Editor spricht davon, „Enable Function Calling“ zu aktivieren. Der Schalter, den du tatsächlich anklickst, heißt **Enable Tool Use**. Gemeint ist dasselbe Bedienelement. Eine ausführliche Tour durch die Agenten findest du unter [Eigene Agenten erstellen](../agents/custom-agents.md).

## Sicherheit bei Skripten

Ein **Script**-Tool führt echten Code auf dem Server aus – geh entsprechend sorgsam damit um. Die App führt jedes Skript in einer Sandbox aus. Eine Sandbox ist ein abgeschotteter Bereich, der begrenzt, was der Code darf. Die Grenzen sind:

- Kein Netzwerkzugriff. Ein Skript erreicht weder das Internet noch irgendeine Webadresse.
- Kein Dateizugriff. Ein Skript kann keine Dateien auf dem Server lesen oder schreiben.
- Kein Zugriff auf Umgebungsvariablen oder Server-Geheimnisse.
- Ein Zeitlimit. Ein zu lang laufendes Skript wird gestoppt. Der Standard liegt bei 60 Sekunden.

Das schützt vor Versehen und blockiert Netzwerk- und Dateizugriffe. Eine vollständige Abschottung vom Betriebssystem ist es nicht. Wer Tools anlegen darf, kann immer noch ein Skript schreiben, das CPU oder Arbeitsspeicher des Servers verschwendet. Gib Script-Tools nur auf Servern frei, denen du vertraust. Sei vorsichtig, wenn du Script-Tools von anderen Leuten importierst.

Auch das Verwalten von Tools von einem anderen Gerät aus ist geschützt. Bist du nicht am Computer mit dem Server, speichere ein Admin-Geheimnis unter **Settings** (Einstellungen), dann **Advanced**, dann **Admin Access**. Dieses Geheimnis muss zur Einstellung des Servers passen. Die Serverseite beschreibt die [Referenz zur Serverkonfiguration](../CONFIGURATION.md).

## Exportieren und importieren

Tools lassen sich zwischen Installationen umziehen.

- Für ein einzelnes Tool: öffne es und klick auf **Export function** (Funktion exportieren). Das speichert eine `.json`-Datei.
- Für alle Tools: klick im Bereich **Functions** auf **Export functions to ZIP**.
- Zum Importieren: klick auf **Import functions from ZIP or JSON** und wähle eine `.json`- oder `.zip`-Datei. Eine Meldung nennt die Anzahl der importierten Tools.

Importierte Webhook- und Script-Tools speichert Marinara immer deaktiviert und mit ausgeschaltetem **Include hidden chat context** – selbst wenn die Datei eine dieser Berechtigungen verlangt. Nach dem Import zeigt Marinara den Ausführungstyp, gegebenenfalls das Ziel des Webhooks und die von der Datei angeforderten Berechtigungen. Öffne jedes importierte ausführbare Tool, prüfe es und aktiviere es erst, wenn du ihm vertraust. Static-Tools behalten ihren importierten Aktivierungszustand.

Beim Import bleiben Tools außen vor, deren Name mit einem vorhandenen oder einem eingebauten Tool kollidiert. Agenten-Pakete enthalten keine eigenen Tools und importieren auch keine: exportiere vertrauenswürdige Funktionen separat, prüfe sie unter **Function Calls** und hänge sie nach dem Import des Agenten ausdrücklich an.

## Reservierte Namen

Der Name eines eigenen Tools darf nicht mit dem eines eingebauten Tools übereinstimmen. Zu den eingebauten Namen zählen unter anderem `roll_dice`, `update_game_state`, `set_expression`, `trigger_event`, `search_lorebook`, `web_search` und `update_about_me`. Beim Speichern erscheint sonst diese Meldung:

```
"your_name" is a reserved built-in tool name.
```

Auch zwei eigene Tools dürfen nicht denselben Namen tragen. Bei einer Dopplung meldet die App, dass ein Tool mit diesem Namen bereits existiert.

## Fehlerbehebung

Die KI ruft mein Tool nie auf.

- Prüfe, ob **Enable Tool Use** im Bereich **Function Calling** des Chats aktiv ist.
- Falls du bestimmte Tools in den Chat eingetragen hast, prüfe, ob deines in der Liste steht.
- Prüfe, ob der Ein-/Aus-Schalter des Tools im Bereich **Functions** aktiv ist.
- Formuliere die **Description** und die Parameterbeschreibungen klarer, damit die KI weiß, wann sie das Tool aufrufen soll.
- Bei importierten Tools kann ein kaputter Parameter-Aufbau dazu führen, dass die App sie überspringt. Baue die Parameter von Hand neu auf.

Die Script-Karte ist ausgegraut.

- Auf diesem Server sind Skripte deaktiviert. Bitte die Administratorin, `CUSTOM_TOOL_SCRIPT_ENABLED=true` zu setzen und neu zu starten. Siehe [Referenz zur Serverkonfiguration](../CONFIGURATION.md).

Mein Webhook schlägt fehl oder läuft ins Zeitlimit.

- Prüfe, ob die Adresse mit `https://` beginnt und erreichbar ist.
- Eine lokale Adresse ist blockiert, solange die Administratorin lokale Adressen nicht freigibt. Siehe [Referenz zur Serverkonfiguration](../CONFIGURATION.md).
- Langsame Dienste laufen leicht ins Zeitlimit von 60 Sekunden.

Ich kann vom Handy oder einem anderen Gerät aus keine Tools erstellen oder bearbeiten.

- Speichere ein passendes Admin-Geheimnis unter **Settings**, dann **Advanced**, dann **Admin Access**.

## Verwandte Anleitungen

- [Eigene Agenten erstellen](../agents/custom-agents.md)
- [Home-Assistant-Integration](../integrations/home-assistant.md)
- [Referenz zur Serverkonfiguration](../CONFIGURATION.md)
