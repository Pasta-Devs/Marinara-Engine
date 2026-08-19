# Eigene Agenten erstellen

In dieser Anleitung erfährst du, wie du in Marinara Engine einen eigenen Agenten baust. Ein Agent ist ein kleiner KI-Helfer, der automatisch neben dem Chat mitläuft. Du lernst, wie du Phase, Fähigkeiten, Ergebnistyp, Aktivierungs-Schlüsselwörter, Tools und den Prompt festlegst – der Prompt ist der Text, den Marinara an die KI schickt. Ein vollständig durchgespieltes Beispiel gibt es dazu.

Neu bei Agenten? Lies zuerst [Agenten: KI-Helfer für deine Chats](agents-overview.md) für die Grundlagen und komm dann hierher zurück.

## Wann sich ein eigener Agent lohnt

Marinara Engine bietet viele offizielle Agenten zum Herunterladen an. Wirf zuerst einen Blick in die [Referenz der herunterladbaren Agenten](built-in-agents.md) und in das öffentliche Paket-Repository [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents), bevor du selbst baust. Vielleicht kann ein Agent aus dem Katalog längst genau das, was du vorhast – und die offiziellen Manifeste sind funktionierende Paket-Beispiele.

Ein eigener Agent lohnt sich, wenn die mitgelieferten nicht abdecken, was du brauchst. Gute Gründe sind:

- Du willst einen Helfer mit eigenen Anweisungen und eigener Stimme.
- Du willst in jeden Prompt eine bestimmte Notiz einfügen.
- Du willst jede Antwort in einem bestimmten Stil umschreiben lassen.
- Du willst, dass ein Agent dein eigenes Tool aufruft.

Ist ein installierter offizieller Agent nah dran, kopier ihn lieber. Zeig im Panel **Agents** (Agenten) auf seine Karte und klick auf **Copy agent** (Agent kopieren). So entsteht eine bearbeitbare eigene Kopie.

## Bevor du loslegst

Zwei Dinge sind vorab wichtig:

1. Agenten werden pro Chat festgelegt, nicht pro Charakter. Ein Agent in der Bibliothek läuft noch nicht von allein. Du musst ihn einem Chat hinzufügen und in den **Chat Settings** (Chat-Einstellungen) **Enable Agents** (Agenten aktivieren) einschalten.
2. Eigene Agenten funktionieren in allen Chat-Modi: Roleplay, Game Mode und Conversation. Offizielle Pakete tauchen nur in den Modi auf, die sie unterstützen – deine eigenen Agenten stehen dagegen überall zur Verfügung.

## Einen eigenen Agenten erstellen

So erstellst du einen neuen eigenen Agenten von Grund auf:

1. Öffne das Panel **Agents**.
2. Klick oben auf die Schaltfläche **New** (Neu) mit dem Plus-Symbol.
3. Der ganzseitige Agent-Editor öffnet sich mit einem leeren eigenen Agenten.
4. Trag oben im Titelfeld einen Namen ein, zum Beispiel `Weather Reporter`.
5. Fülle die Felder **Description** (Beschreibung) und **Author** (Autor) aus, damit du später weißt, wofür der Agent gut ist.
6. Wähle eine **Pipeline Phase** (Pipeline-Phase, siehe unten).
7. Schalte unter **Custom Agent Abilities** (Fähigkeiten eigener Agenten) die Fähigkeiten ein, die du brauchst.
8. Wähle einen **Result Type** (Ergebnistyp), der zur gewünschten Ausgabe passt.
9. Schreib die Anweisungen für den Agenten unter **Prompt Template** (Prompt-Vorlage).
10. Klick oben in der Leiste auf **Save** (Speichern). Es sollte ein grünes **Saved**-Badge erscheinen.

Der neue Agent erscheint jetzt im Bereich **Custom Agents** (Eigene Agenten) des Panels **Agents**. Zum Einsetzen öffnest du einen Chat, gehst zu **Chat Settings**, schaltest **Enable Agents** ein und fügst den Agenten dort aus dem Bereich **Custom Agents** hinzu.

## Pipeline Phase

Die **Pipeline Phase** legt fest, wann der Agent läuft. Wähle eine von drei Schaltflächen:

- **Pre-Generation**: läuft, bevor die KI antwortet. Der Agent kann Kontext ergänzen oder den Prompt verändern.
- **Parallel**: läuft gleichzeitig mit der Antwort. Die fertige Antwort sieht er nicht.
- **Post-Processing**: läuft, wenn die Antwort fertig ist. Der Agent kann sie lesen und bei manchen Ergebnistypen auch bearbeiten.

Manche Ergebnistypen erzwingen eine Phase. Wählst du **Text Rewrite**, springt die Phase auf **Post-Processing**. Wählst du **Prompt Patch**, springt sie auf **Pre-Generation**. Der Grund: Diese Aufgaben ergeben nur in der jeweiligen Phase Sinn.

Eigene Agenten in der Phase **Post-Processing** bekommen zusätzlich den Bereich **Turn Data Access** (Zugriff auf Zugdaten). Dort gibt es zwei optionale Schalter: **Pre-generation injections** und **Parallel agent results**. Schalte sie ein, damit der Agent lesen kann, was andere Agenten im selben Zug erzeugt haben. Lass sie aus, dann bleibt der Agent isoliert.

## Custom Agent Abilities

**Custom Agent Abilities** sind Fähigkeiten, die du bewusst freischaltest. Solange der Schalter aus ist, bleibt die Fähigkeit gesperrt. Damit ist ein eigener Agent standardmäßig ungefährlich. Verfügbar sind:

| Fähigkeit | Was der Agent damit darf |
|---|---|
| **Create lorebooks** | Ein neues, vom Agenten erzeugtes Lorebook anlegen, wenn die Lore-Ausgabe kein Ziel hat. |
| **Edit lorebooks** | Lorebook-Einträge schreiben oder Lorebook-Aktualisierungen als Ergebnis liefern. |
| **Edit messages** | Den generierten Nachrichtentext durch eine umgeschriebene Fassung ersetzen oder Auswahlmöglichkeiten zum Weitermachen anhängen. |
| **Edit trackers** | Den Zustand von Spiel-, Charakter-, Persona- oder eigenen Trackern aktualisieren. |
| **Frontend styling** | Während der Generierung einen zeitweiligen visuellen Effekt anwenden. |
| **Change chat backgrounds** | Den für einen Chat gewählten Hintergrund ändern und dauerhaft speichern. |
| **Change character sprites** | Die im Chat gezeigten Gesichtsausdrücke von Charakteren und Persona ändern. |
| **Control media playback** | Die Wiedergabe von Spotify, YouTube oder lokaler Musik steuern. |
| **Control haptic devices** | Begrenzte Befehle an ein verbundenes haptisches Gerät schicken. |
| **Edit About Me details** | Den chatspezifischen **About Me**-Text ändern. Änderungen an der öffentlichen Karte brauchen weiterhin eine eigene Freigabe. |
| **Image generation** | Die Bildgenerierung mit einem Bild-Prompt anstoßen. |
| **Vectors/embeddings** | Vektor- oder Embedding-Kontext nutzen. Ein Embedding ist eine numerische Darstellung von Text; über Vektoren lässt sich Text nach Bedeutung durchsuchen. |
| **Main prompt edits** | Den Prompt bearbeiten, der an das KI-Hauptmodell geht. |

Ein Lorebook ist eine Sammlung von Hintergrundnotizen, also von Weltwissen, das die KI in eine Szene holen kann. Ein Tracker ist ein Live-Panel, das Werte wie Statuswerte, Stimmung oder Ort festhält.

Schaltest du **Edit lorebooks** ein, erscheint der Bereich **Lorebook Writer**. Aktiviere dort **Allow lorebook entry writes** und wähle im Dropdown-Menü **Target lorebook** genau ein Lorebook aus. Nur in dieses eine Lorebook darf der Agent schreiben.

## Result Type

Der **Result Type** sagt Marinara, wie die Ausgabe des Agenten zu lesen ist. Die meisten Ergebnistypen erwarten JSON vom Agenten. JSON ist ein einfaches Textformat mit geschweiften Klammern und Anführungszeichen. Jeder Ergebnistyp setzt die passende Fähigkeit aus der Tabelle oben voraus.

| Result Type | Wirkung | Nötige Fähigkeit |
|---|---|---|
| **Context Injection** | Fügt vor der Generierung Text ein oder hält danach eine Notiz fest. | Keine |
| **Text Rewrite** | Läuft nach der Antwort und ersetzt den Nachrichtentext. | Edit messages |
| **Lorebook Update** | Erstellt oder aktualisiert Lorebook-Einträge. | Edit lorebooks |
| **Character Tracker** | Aktualisiert den Charakter-Tracker (anwesende Charaktere). | Edit trackers |
| **Persona Stats** | Aktualisiert Werte, Status und Inventar der Persona. | Edit trackers |
| **Custom Tracker** | Ersetzt die Felder deines eigenen Trackers. | Edit trackers |
| **Game State** | Aktualisiert Spieldaten nach Art des Weltzustands. | Edit trackers |
| **Image Prompt** | Lässt die Bildgenerierung eine Szene zeichnen. | Image generation |
| **Prompt Patch** | Ergänzt Prompt-Abschnitte, stellt sie voran oder ersetzt sie. | Main prompt edits |
| **Frontend Style** | Wendet einen zeitweiligen Stileffekt an. | Frontend styling |
| **Background Change** | Wählt einen verfügbaren Chat-Hintergrund aus und speichert ihn dauerhaft. | Change chat backgrounds |
| **Sprite Change** | Ändert die im Chat gezeigten Gesichtsausdrücke von Charakteren und Persona. | Change character sprites |
| **Spotify Control** | Steuert die Spotify-Wiedergabe. | Control media playback |
| **YouTube Control** | Steuert die YouTube-Wiedergabe. | Control media playback |
| **Local Music Control** | Steuert die Wiedergabe aus der lokalen Musiksammlung. | Control media playback |
| **Haptic Command** | Schickt einen begrenzten Befehl an ein verbundenes haptisches Gerät. | Control haptic devices |
| **About Me Update** | Aktualisiert den chatspezifischen **About Me**-Text und schlägt öffentliche Änderungen vor. | Edit About Me details |
| **Interactive Choices** | Hängt Auswahlmöglichkeiten zum Weitermachen an die generierte Nachricht. | Edit messages |

**Context Injection** ist der freundlichste Einstieg. Dieser Typ braucht weder eine freigeschaltete Fähigkeit noch ein festes Ausgabeformat. Nimm ihn, wenn der Agent einfach nur eine kurze Notiz in den Prompt schreiben oder eine Zusammenfassung festhalten soll.

Ist ein Ergebnistyp ausgegraut, fehlt noch die passende Fähigkeit. Schalte den entsprechenden Schalter unter **Custom Agent Abilities** ein, dann lässt sich der Ergebnistyp anklicken.

### Steuerelemente pro Chat für Bildagenten

Ein Agent mit der Fähigkeit **Image generation** erhält auf seiner Karte unter **Chat Settings → Agents → Custom Agents** zwei zusätzliche Steuerelemente neben der Prompt-Vorlagenauswahl, die jeder eigene Agent besitzt:

- **Image Connection** — überschreibt nur für diesen Chat, welche Bildverbindung der Agent verwendet. Mit **Agent default** bleibt die Verbindung aus den Agenteneinstellungen erhalten. Die Auswahl **Image Style** des Chats gilt ebenfalls für Bilder eigener Agenten, sodass derselbe Agent pro Chat anders rendern kann, ohne ihn zu duplizieren.
- **Camera button** — erzeugt sofort ein Bild mit diesem Agenten, ohne auf seine Aktivierungswörter zu warten. Der Agent schreibt den Prompt weiterhin selbst; liefert seine Vorlage keinen, erscheint statt eines Bildes eine Fehlermeldung.

## Activation Keywords

Standardmäßig läuft ein eigener Agent in seinem normalen Takt. Mit **Activation Keywords** (Aktivierungs-Schlüsselwörter) überspringst du ihn, solange die Szene nicht dazu passt. Das spart Tokens und Kosten. Ein Token ist ein kleines Textstück, das die KI mitzählt.

So richtest du das ein:

1. Trag im Bereich **Activation Keywords** ein Schlüsselwort oder eine Wendung pro Zeile ein. Zum Beispiel:

```
tavern
secret door
moonlit ritual
```

2. Stell **Scan Depth** auf die Anzahl der letzten Nachrichten, die durchsucht werden sollen. Der Standard ist 5, das Maximum 200.
3. Der Agent läuft nun nur noch, wenn in diesen letzten Nachrichten mindestens ein Schlüsselwort vorkommt.

Lass das Feld für die Schlüsselwörter leer, dann läuft der Agent jedes Mal in seinem normalen Takt.

## Tools anhängen (Function Calling)

Dein Agent kann Tools aufrufen. Ein Tool ist eine Funktion, die die KI ausführen kann, um etwas abzurufen oder zu ändern; das Ergebnis liest sie anschließend zurück. Das nennt sich auch Function Calling.

Zum Anhängen öffnest du den Bereich **Tools / Function Calling** und schaltest jedes Tool einzeln ein oder aus. Die Liste enthält die mitgelieferten Tools und alle, die du selbst gebaut hast. Wie das geht, steht unter [Eigene Tools](../extending/custom-tools.md).

Tools funktionieren nur, wenn der Chat selbst sie erlaubt. Öffne in den **Chat Settings** den Bereich **Function Calling** und schalte **Enable Tool Use** (Tool-Nutzung aktivieren) ein. Ohne diese Chat-Einstellung bleiben die Tools des Agenten aus, selbst wenn du sie hier aktivierst.

Importierte Agent-Dateien bringen keinen Tool-Zugriff mit. Sieh dir nach dem Import Prompt und Einstellungen an und wähle die gewünschten Tools anschließend selbst aus.

## Named prompt options

Ein einzelner Agent kann mehrere Prompt-Varianten enthalten. Diese Funktion heißt **Named prompt options** (benannte Prompt-Varianten). Ein Chat wählt dann eine Variante aus, ohne dass du den Agenten global änderst.

So legst du eine Variante an:

1. Suche unter **Prompt Template** den Bereich **Named prompt options**.
2. Klick auf **Add option** (Variante hinzufügen).
3. Gib der Variante einen Namen und eine kurze Beschreibung.
4. Schreib den vollständigen Prompt-Text für diese Variante.

Wer deinen Agenten zu einem Chat hinzufügt, sieht ein Dropdown-Menü **Prompt Mode** mit deinen benannten Varianten. Legst du keine an, zeigt das Chat-Menü nur den Standard-Prompt.

## Weitere Einstellungen zum Anpassen

Eigene Agenten teilen sich einige Einstellungen mit den mitgelieferten Agenten:

- **Connection Override** (Verbindung überschreiben): Wähle für diesen Agenten eine andere KI-Verbindung, etwa ein günstigeres Modell für Hintergrundarbeit. Bleibt das Feld leer, nutzt der Agent die Verbindung des Chats.
- **Agent Budget** (Agent-Budget): Stell **Context Size** ein, also wie viele der letzten Nachrichten der Agent liest (Standard 5). Dazu **Max Output Tokens**, den reservierten Platz für die Ausgabe (Standard 4096, möglich sind 128 bis 32768).
- **Add as Prompt Section** (Als Prompt-Abschnitt hinzufügen): Schalte das ein, um die jüngste Ausgabe des Agenten als Abschnitt bereitzustellen, den du in ein Prompt-Preset einfügen kannst.

Makros wie `{{user}}` und `{{char}}` funktionieren auch in der **Prompt Template**. Die vollständige Liste steht unter [Makros](../prompts/macros.md).

## Ein durchgespieltes Beispiel

Hier ist ein kompletter eigener Agent, der jede Antwort in britisches Englisch umschreibt.

Einrichtung im Editor:

1. Nenn ihn `British English Editor`.
2. Schalte unter **Custom Agent Abilities** die Fähigkeit **Edit messages** ein.
3. Wähle unter **Result Type** den Typ **Text Rewrite**. Die Phase springt von selbst auf **Post-Processing**.
4. Füge das hier in die **Prompt Template** ein:

```
You are a copy editor. Rewrite the latest reply into British English.
Change spelling and vocabulary only. Do not change the meaning, tone, or events.
Return JSON with an "editedText" field holding the full rewritten reply,
and a "changes" array of short notes describing what you changed.
```

5. Klick auf **Save**.
6. Öffne einen Roleplay-Chat, geh zu **Chat Settings**, schalte **Enable Agents** ein und füge `British English Editor` aus dem Bereich **Custom Agents** hinzu.

Nach jeder Antwort liefert der Agent JSON wie dieses:

```
{"editedText":"The colour of the harbour caught her eye.","changes":[{"description":"color to colour, harbor to harbour"}]}
```

Marinara liest `editedText` und setzt den Text in die Antwort ein. Die Nachricht erscheint dann in britischem Englisch. Die Notizen aus `changes` erscheinen als kurze Zusammenfassung dessen, was der Agent angepasst hat.

## Agenten importieren und exportieren

Einen eigenen Agenten kannst du als Datei weitergeben.

Zum Exportieren klickst du im Editor oben in der Leiste auf die Schaltfläche **Export agent** (Agent exportieren) mit dem Upload-Symbol. Das speichert Prompt und Konfiguration des Agenten als Paket. Definitionen eigener Tools sind in Agent-Paketen nie enthalten.

Für mehrere Agenten auf einmal nutzt du **Select agents** (Agenten auswählen) im Panel **Agents**, markierst die gewünschten Agenten und exportierst die Gruppe.

Der Import externer Agenten ist standardmäßig gesperrt. Öffne zuerst **Settings → Advanced → Danger Zone** und aktiviere **Allow custom Agent imports** (Import eigener Agenten erlauben). Für diesen Schalter ist keine Änderung an der `.env` nötig. Er betrifft nur Agenten aus Dateien, Ordnern oder eigenen Repositories: Agenten, die du in Marinara anlegst, und offizielle Agenten aus **Download Agents** bleiben ganz normal verfügbar.

Zum Importieren öffnest du das Panel **Agents** und klickst auf **Import agents** (Agenten importieren) für eine einzelne Datei oder auf **Import agent folder** (Agent-Ordner importieren) für einen ganzen Ordner. Marinara zeigt eine Berechtigungsprüfung, bevor irgendetwas gespeichert wird. Bestätige nur die Fähigkeiten, die der Agent wirklich braucht; nicht angehakte Fähigkeiten bleiben gesperrt. Jeder Datei-Import bekommt eine neue eigene Identität und kann deshalb keinen kuratierten Agenten mit demselben internen Typ ersetzen.

Zur Sicherheit ignoriert Marinara mitgelieferte Funktionen, entfernt Tool-Auswahlen aus importierten Einstellungen, bereinigt temporäres CSS vor dem Anwenden und prüft die freigegebenen Fähigkeiten, bevor ein importierter Agent Nachrichten, Tracker, Lorebooks, Hintergründe, Sprites, Medien, haptische Geräte, **About Me**-Daten, Prompts oder generierte Bilder ändern darf. Importiere vertrauenswürdige Funktionen getrennt über **Function Calls**, sieh sie durch und häng sie dem Agenten danach ausdrücklich an. Schaltest du den Danger-Zone-Schalter wieder aus, laufen extern importierte Agenten nicht mehr; lokal erstellte und offizielle Agenten bleiben davon unberührt.

## Verwandte Anleitungen

- [Agenten: KI-Helfer für deine Chats](agents-overview.md)
- [Referenz der herunterladbaren Agenten](built-in-agents.md)
- [Eigene Tools](../extending/custom-tools.md)
- [Makros](../prompts/macros.md)
