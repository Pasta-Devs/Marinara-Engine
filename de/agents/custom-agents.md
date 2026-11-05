# Eigene Agenten erstellen

Ein eigener Agent ist ein Helfer, den du selbst schreibst: Du legst seine Anweisungen fest, wann er läuft und was er ändern darf. Bau einen, wenn kein [herunterladbarer Agent](built-in-agents.md) das tut, was du willst. Ist ein installierter Agent nah dran, zeig im Panel **Agents** (Agenten) auf seine Karte und klick auf **Copy agent** (Agent kopieren). So bekommst du eine bearbeitbare Kopie.

Bevor du loslegst: Lies [Agenten: KI-Helfer für deine Chats](agents-overview.md). Ein Agent, den du baust, läuft noch nicht von allein. Du fügst ihn anschließend einem Chat hinzu. Eigene Agenten funktionieren in allen Chat-Modi.

## Einen eigenen Agenten erstellen

1. Öffne das Panel **Agents**.
2. Klick oben auf **New** (Neu), das Plus-Symbol. Der ganzseitige Agent-Editor öffnet sich.
3. Trag im Titelfeld einen Namen ein, zum Beispiel `Weather Reporter`.
4. Fülle **Description** (Beschreibung) und **Author** (Autor) aus.
5. Wähle eine **Pipeline Phase** (Pipeline-Phase; siehe [Pipeline Phase](#pipeline-phase)).
6. Schalte unter **Custom Agent Abilities** (Fähigkeiten eigener Agenten) die Fähigkeiten ein, die der Agent braucht.
7. Wähle einen **Result Type** (Ergebnistyp), der zu dem passt, was der Agent erzeugt. Bist du unsicher, nimm **Context Injection**. Dieser Typ braucht keine Fähigkeit und kein festes Ausgabeformat.
8. Schreib die Anweisungen des Agenten unter **Prompt Template** (Prompt-Vorlage).
9. Klick oben in der Leiste auf **Save** (Speichern). Ein grünes **Saved**-Badge erscheint.

Der Agent erscheint jetzt im Bereich **Custom Agents** (Eigene Agenten) des Panels **Agents**. Zum Einsetzen öffnest du einen Chat, gehst zu **Chat Settings** (Chat-Einstellungen), schaltest **Enable Agents** (Agenten aktivieren) ein und fügst den Agenten aus **Custom Agents** hinzu.

## Pipeline Phase

Die **Pipeline Phase** legt fest, wann der Agent läuft.

- **Pre-Generation**: vor der Antwort. Der Agent kann Kontext ergänzen oder den Prompt verändern.
- **Parallel**: gleichzeitig mit der Antwort. Die fertige Antwort sieht er nicht.
- **Post-Processing**: nach der Antwort. Der Agent kann die Antwort lesen und sie bei manchen Ergebnistypen bearbeiten.

Manche Ergebnistypen erzwingen eine Phase. **Text Rewrite** stellt auf **Post-Processing** um. **Prompt Patch** und **Character Activity** stellen auf **Pre-Generation** um.

Agenten in der Phase **Post-Processing** bekommen zusätzlich den Bereich **Turn Data Access** (Zugriff auf Zugdaten) mit zwei Schaltern: **Pre-generation injections** und **Parallel agent results**. Schalte sie ein, damit der Agent lesen kann, was andere Agenten im selben Zug erzeugt haben.

## Custom Agent Abilities

Fähigkeiten sind Befugnisse, die du bewusst freischaltest. Jede bleibt gesperrt, bis du ihren Schalter einschaltest.

- **Create lorebooks**: ein neues, vom Agenten erzeugtes Lorebook anlegen, wenn seine Lore-Ausgabe kein Ziel hat.
- **Edit lorebooks**: Lorebook-Einträge schreiben oder Lorebook-Aktualisierungen als Ergebnis liefern.
- **Edit messages**: den generierten Nachrichtentext ersetzen oder ihm Auswahlmöglichkeiten zum Weitermachen anhängen.
- **Edit trackers**: den Zustand von Spiel-, Charakter-, Persona- oder eigenen Trackern aktualisieren.
- **Frontend styling**: während der Generierung einen zeitweiligen visuellen Stil anwenden.
- **Change chat backgrounds**: den Hintergrund eines Chats ändern und speichern.
- **Change character sprites**: die im Chat gezeigten Gesichtsausdrücke von Charakteren und Personas ändern.
- **Control media playback**: Spotify, YouTube oder lokale Musik steuern.
- **Control haptic devices**: begrenzte Befehle an ein verbundenes haptisches Gerät schicken.
- **Edit About Me details**: den chatspezifischen About-Me-Text ändern. Änderungen an der öffentlichen Karte brauchen weiterhin deine Freigabe.
- **Image generation**: einen Bild-Prompt an die Bildgenerierung schicken.
- **Vectors/embeddings**: Vektor-Kontext nutzen. Mit Vektoren kann Marinara Text nach seiner Bedeutung durchsuchen.
- **Main prompt edits**: den Prompt bearbeiten, der an das Hauptmodell geht.
- **Create character cards**: eine neue Charakterkarte vorschlagen. Sie wird erst gespeichert, wenn du sie geprüft und angenommen hast.
- **Choose active chat characters**: auswählen, welche angehängten Charaktere für die aktuelle Antwort in Conversation oder Roleplay aktiv sind.

Schaltest du **Edit lorebooks** ein, erscheint der Bereich **Lorebook Writer**. Schalte dort **Allow lorebook entry writes** ein und wähle unter **Target lorebook** ein Lorebook aus. Der Agent darf nur in dieses Lorebook schreiben.

## Result Type

Der **Result Type** sagt Marinara, wie die Antwort des Agenten zu lesen ist. Die meisten Typen erwarten JSON, ein Textformat mit geschweiften Klammern und Anführungszeichen. Ein Typ bleibt ausgegraut, bis du die Fähigkeit einschaltest, die er braucht.

Typen, die keine Fähigkeit brauchen:

- **Context Injection**: fügt vor der Generierung Text ein oder hält danach eine Notiz fest. Der einfachste Einstieg.

Typen, die **Edit messages** brauchen:

- **Text Rewrite**: ersetzt nach der Antwort den Nachrichtentext.
- **Interactive Choices**: hängt der Nachricht Auswahlmöglichkeiten zum Weitermachen an.

Typen, die **Edit trackers** brauchen:

- **Character Tracker**: aktualisiert die anwesenden Charaktere.
- **Persona Stats**: aktualisiert Werte, Status und Inventar der Persona.
- **Custom Tracker**: ersetzt die Felder deines eigenen Trackers.
- **Game State**: aktualisiert Spieldaten nach Art des Weltzustands.

Weitere Typen, jeweils mit eigener Fähigkeit:

- **Lorebook Update** (Edit lorebooks): erstellt oder aktualisiert Lorebook-Einträge.
- **Image Prompt** (Image generation): lässt die Bildgenerierung eine Szene zeichnen.
- **Prompt Patch** (Main prompt edits): ergänzt Prompt-Abschnitte, stellt sie voran oder ersetzt sie.
- **Frontend Style** (Frontend styling): wendet einen zeitweiligen Stileffekt an.
- **Background Change** (Change chat backgrounds): wählt einen verfügbaren Hintergrund aus und speichert ihn.
- **Sprite Change** (Change character sprites): ändert die im Chat gezeigten Gesichtsausdrücke.
- **Spotify Control**, **YouTube Control**, **Local Music Control** (Control media playback): steuern die Wiedergabe.
- **Haptic Command** (Control haptic devices): schickt einen begrenzten Befehl an ein haptisches Gerät.
- **About Me Update** (Edit About Me details): aktualisiert den chatspezifischen About-Me-Text und schlägt öffentliche Änderungen vor.
- **Character Card Creation** (Create character cards): schlägt eine bearbeitbare Charakterkarte zur Freigabe vor.
- **Character Activity** (Choose active chat characters): wählt die Charakterkarten aus, die für die aktuelle Antwort genutzt werden. Dieser Typ läuft vor der Antwort und muss mindestens einen angehängten Charakter auswählen.

### Steuerelemente für Bildagenten in einem Chat

Ein Agent mit der Fähigkeit **Image generation** erhält unter **Chat Settings → Agents → Custom Agents** zwei zusätzliche Steuerelemente.

- **Image model** (Bildmodell): überschreibt nur für diesen Agenten in diesem Chat die Bildverbindung. Belass es auf **Agent default** (Agent-Standard), um die eigene Einstellung des Agenten zu behalten. Der **Image Style** des Chats gilt auch für Bilder eigener Agenten.
- **Camera button**: erzeugt sofort ein Bild, ohne auf Aktivierungs-Schlüsselwörter zu warten. Lehnt die Vorlage des Agenten es ab, einen Prompt zu schreiben, erhältst du statt eines Bildes eine Fehlermeldung.

## Activation Keywords

Standardmäßig läuft ein Agent in seinem normalen Takt (der Takt bestimmt, wie oft er läuft). Mit **Activation Keywords** (Aktivierungs-Schlüsselwörter) wird der Agent übersprungen, solange die Szene nicht dazu passt. Das spart Tokens.

1. Trag unter **Activation Keywords** ein Schlüsselwort oder eine Wendung pro Zeile ein, etwa `tavern` oder `secret door`.
2. Stell **Scan Depth** (Scan-Tiefe) auf die Anzahl der letzten Nachrichten, die durchsucht werden. Der Standard ist 5, das Maximum 200.

Der Agent läuft dann nur, wenn in diesen Nachrichten ein Schlüsselwort vorkommt. Lass das Feld leer, um den Filter auszuschalten. Takt und eine eventuelle Aktivierungsfrage gelten weiterhin.

## Tools anhängen

Ein Agent kann Tools aufrufen: Funktionen, die die KI ausführt, um etwas abzurufen oder zu ändern, und deren Ergebnis sie anschließend zurückliest. Das nennt sich auch Function Calling.

1. Öffne im Agent-Editor **Tools / Function Calling** und schalte jedes Tool ein, das du willst. Die Liste enthält mitgelieferte Tools und deine eigenen. Wie du eines baust, steht unter [Eigene Tools](../extending/custom-tools.md).
2. Öffne in den **Chat Settings** den Bereich **Function Calling** und schalte **Enable Tool Use** (Tool-Nutzung aktivieren) ein. Ohne diese Einstellung bleiben die Tools des Agenten aus.

Importierte Agenten bekommen nie Tool-Zugriff. Sieh dir einen importierten Agenten an und wähle seine Tools dann selbst aus.

Ein Agent bekommt pro Lauf höchstens 16 Runden mit Tool-Aufrufen (weniger, wenn `MAX_TOOL_ROUNDS` auf dem Server niedriger ist) und antwortet danach mit dem, was er hat. Ein Modell, das jeweils nur ein Tool aufruft, verbraucht für jeden Aufruf eine Runde. Ein Agent, der viele Einträge speichert, sollte deshalb mehrere Aufrufe in einer Antwort absetzen. Ein Backfill-Lauf für Lorebooks bekommt bis zu 64 Runden.

## Named prompt options

Ein Agent kann mehrere Prompt-Varianten enthalten. So wählt jeder Chat eine davon aus, ohne dass du den Agenten bearbeitest.

1. Suche unter **Prompt Template** den Bereich **Named prompt options** (benannte Prompt-Varianten).
2. Klick auf **Add option** (Variante hinzufügen).
3. Gib der Variante einen Namen und eine kurze Beschreibung und schreib dann ihren vollständigen Prompt.

Fügt jemand den Agenten einem Chat hinzu, listet ein Dropdown-Menü **Prompt Mode** deine Varianten auf. Gibt es keine, erscheint nur der Standard-Prompt.

## Weitere Einstellungen

- **Model override** (Modell überschreiben): Nutze für diesen Agenten ein anderes Modell, zum Beispiel ein günstigeres. Bleibt das Feld leer, nutzt er das Modell des Chats. Der Agent sendet die auf dieser Verbindung gespeicherten Generierungsparameter. Siehe [Parameter für Agenten](../prompts/generation-parameters.md#parameters-for-agents).
- **Agent Budget** (Agent-Budget): **Context Size** gibt an, wie viele der letzten Nachrichten der Agent liest (Standard 5). **Max Output Tokens** ist der für die Ausgabe reservierte Platz (Standard 4.096, von 128 bis 32.768).
- **Add as Prompt Section** (Als Prompt-Abschnitt hinzufügen): stellt die jüngste Ausgabe des Agenten als Abschnitt bereit, den du in ein Prompt-Preset einfügen kannst.

Makros wie `{{user}}` und `{{char}}` funktionieren in der **Prompt Template**. Siehe [Makros](../prompts/macros.md).

## Ein durchgespieltes Beispiel

Dieser Agent schreibt jede Antwort in britisches Englisch um.

1. Nenn ihn `British English Editor`.
2. Schalte unter **Custom Agent Abilities** die Fähigkeit **Edit messages** ein.
3. Wähle unter **Result Type** den Typ **Text Rewrite**. Die Phase springt auf **Post-Processing**.
4. Füge das hier in die **Prompt Template** ein:

   ```text
   You are a copy editor. Rewrite the latest reply into British English.
   Change spelling and vocabulary only. Do not change the meaning, tone, or events.
   Return JSON with an "editedText" field holding the full rewritten reply,
   and a "changes" array of short notes describing what you changed.
   ```

5. Klick auf **Save**.
6. Öffne einen Roleplay-Chat, schalte in den **Chat Settings** **Enable Agents** ein und füge den Agenten aus **Custom Agents** hinzu.

Nach jeder Antwort liefert der Agent JSON wie dieses:

```json
{"editedText":"The colour of the harbour caught her eye.","changes":[{"description":"color to colour, harbor to harbour"}]}
```

Marinara setzt `editedText` in die Antwort ein. Die Notizen aus `changes` erscheinen als kurze Zusammenfassung.

## Agenten importieren und exportieren

Um einen Agenten zu exportieren, klickst du im Editor oben in der Leiste auf **Export agent** (Agent exportieren), das Upload-Symbol. Die Datei enthält Prompt und Einstellungen des Agenten, aber nie Definitionen eigener Tools. Für mehrere Agenten nutzt du **Select agents** (Agenten auswählen) im Panel **Agents**, markierst sie und exportierst sie.

Externe Importe sind standardmäßig gesperrt.

1. Öffne **Settings → Advanced → Danger Zone** und schalte **Allow custom Agent imports** (Import eigener Agenten erlauben) ein. Eine Änderung an der `.env` ist nicht nötig.
2. Klick im Panel **Agents** auf **Import agents** (Agenten importieren) und wähle Agent-Dateien oder einen Ordner.
3. Prüf die Liste der Berechtigungen, die Marinara anzeigt. Bestätige nur, was der Agent braucht. Nicht angehakte Fähigkeiten bleiben gesperrt.

Diese Sperre betrifft nur Agenten aus Dateien, Ordnern oder eigenen Repositories. Agenten, die du selbst anlegst, und offizielle Agenten aus **Agent Organizer** (Agentenverwaltung) funktionieren ganz normal. Jede importierte Datei bekommt eine neue eigene Identität und kann deshalb keinen offiziellen Agenten ersetzen.

Zur Sicherheit ignoriert Marinara mitgelieferte Funktionen, entfernt Tool-Auswahlen, bereinigt temporäres CSS und prüft die freigegebenen Fähigkeiten, bevor ein importierter Agent Nachrichten, Tracker, Lorebooks, Hintergründe, Sprites, Medien, haptische Geräte, About-Me-Daten, Prompts oder Bilder ändern darf. Importiere vertrauenswürdige Funktionen getrennt, sieh sie durch und häng sie dem Agenten selbst an. Schaltest du den Schalter in der **Danger Zone** wieder aus, laufen importierte Agenten nicht mehr.

<a id="activation-questions"></a>

## Aktivierungsfragen

Eine Aktivierungsfrage prüft, ob die jüngste Szene deinen Agenten braucht. Sie erkennt Umschreibungen, die Schlüsselwörter übersehen. Dafür braucht sie ein **Decision model** (Entscheidungsmodell), ein kleines Modell, das Ja-Nein-Fragen beantwortet. Wähle es im Panel Connections aus. Siehe [Decision-Modelle](../connections/decision-models.md). Steht **Decision model** auf **None**, dem Standard, bleiben die Fragefelder deaktiviert, und ein Agent mit einer Frage läuft so, als hätte er keine.

1. Öffne den eigenen Agenten.
2. Gib eine **Question** (Frage) mit bis zu 500 Zeichen ein. Die Makros `{{user}}` und `{{char}}` funktionieren darin.
3. Setze **Run when probability is at least** (ab dieser Wahrscheinlichkeit ausführen) auf die Schwelle für diesen Agenten. Der Agent läuft, wenn die Wahrscheinlichkeit für „ja“ die Schwelle erreicht; höhere Werte überspringen also mehr Läufe. Der Editor zeigt einen empfohlenen Wert für dein Modell: 0,5 für lokale Chat-Modelle und Decision-Konten oder 0,1 für die eingebauten Open-Jev-Modelle. Prüf ihn an deinen eigenen Chats, nachdem du das Modell gewechselt hast. Siehe [Schwellenwerte](../connections/decision-models.md#thresholds).
4. Optional: Setze **Bypass the question after this many messages without a successful run** (Frage nach dieser Anzahl Nachrichten ohne erfolgreiche Ausführung umgehen). Nach so vielen Nachrichten wird die Frage übersprungen, damit ein Modell, das immer wieder „nein“ antwortet, den Agenten nicht dauerhaft stilllegen kann. Schlüsselwörter und Takt gelten weiterhin.

Formuliere die Frage als Aussage über die neueste Nachricht, etwa `The latest message moves the scene to a new place.` Ein kleines Modell hat das zuverlässiger beantwortet als `Did the scene change?` Siehe [Aussagen formulieren](../prompts/conditional-prompts.md#writing-statements).

So läuft es ab:

- Schlüsselwörter und Takt werden zuerst geprüft; ein übersprungener Agent kostet daher keine Decision-Anfrage. Fragen mit derselben Scan-Tiefe werden je Phase gebündelt.
- **Scan Depth** legt die Nachrichten fest, die Schlüsselwörter und Frage gemeinsam nutzen.
- Agenten vor oder parallel zur Generierung nutzen den Chat vor der Antwort. Agenten in der Nachverarbeitung sehen auch die fertige Antwort.
- Bei Zeitüberschreitung, nicht verfügbarem Modell oder ungültiger Antwort läuft der Agent normal. Das Zeitlimit hängt vom Modelltyp ab und davon, ob das Modell zuerst nachdenken muss. Siehe [Zeitlimits](../connections/decision-models.md#time-limits).
- Importierte Agenten mit einer Aktivierungsfrage oder Decision-Aussagen zeigen einen Hinweis mit Link zur Anleitung für Decision-Modelle. Ohne Decision-Modell läuft der Agent, sobald Schlüsselwörter und **Trigger Cadence** (Ausführungstakt) es erlauben, und Aussagen im Prompt gelten als nein.

Aktivierungsfragen gelten nur für eigene Agenten.

<a id="decision-statements-in-the-agents-prompt"></a>

## Decision-Bedingungen im Agenten-Prompt

Eine Aktivierungsfrage entscheidet, ob der Agent läuft. Eine Decision-Bedingung in der **Prompt Template** entscheidet, welche Anweisungen ein laufender Agent erhält. Die Syntax steht unter [Bedingte Prompts](../prompts/conditional-prompts.md#asking-the-decision-model):

```text
{{#if decision:"In the latest message, the characters move to a different location"}}
Update the location field.
{{else}}
Leave the location as it is.
{{/if}}
```

Damit schickst du in ruhigen Zügen einen kleineren Prompt. Ein Tracker kann den Ort nur dann aktualisieren, wenn er sich geändert hat. Ein Bildagent kann ein neues Bild nur dann beschreiben, wenn sich die Szene geändert hat. Ein Musikagent kann den Titel nur dann wechseln, wenn die Stimmung umgeschlagen ist. Um einen von mehreren Anweisungssätzen auszuwählen, nimm `{{#if decision_choice:"The kind of scene in the latest message" == "combat"}}`, dann `{{else if decision_choice:"The kind of scene in the latest message" == "dialogue"}}` und so weiter. Siehe [Bedingte Prompts](../prompts/conditional-prompts.md#asking-the-decision-model).

- Agenten vor oder parallel zur Generierung lesen den Chat vor der Antwort und teilen ihre Antworten mit dem Haupt-Prompt. Agenten in der Nachverarbeitung lesen die fertige Antwort; ihre Aussagen werden mit ihr erneut abgefragt.
- Ein erneuter Agentenlauf verwendet erfolgreiche Antworten wieder, die für denselben Zug, dasselbe Modell und dieselben Aussagen noch im Cache liegen. Siehe [Antworten wiederverwenden](../prompts/conditional-prompts.md#answer-reuse).
- In einem Agenten-Prompt benennt `{{char}}` alle Charaktere im Chat. In einer Gruppe wird aus `{{char}} is angry` daher „Kaelen, Alyssa is angry“. Nenne den Charakter beim Namen oder schreib „a character“.
- Ohne Antwort gilt eine Aussage als nein. Gestalte den `{{else}}`-Zweig sinnvoll, denn viele Nutzer haben kein Decision-Modell.

Agenten, die aus Marinara-Agents installiert wurden, verarbeiten ihre Prompts auf dieselbe Weise.

## Verwandte Anleitungen

- [Agenten: KI-Helfer für deine Chats](agents-overview.md)
- [Decision-Modelle](../connections/decision-models.md)
- [Referenz der herunterladbaren Agenten](built-in-agents.md)
- [Eigene Tools](../extending/custom-tools.md)
- [Makros](../prompts/macros.md)
