# Geführte Generierung und Impersonate

In dieser Anleitung erfährst du, wie du einen Chat in Marinara Engine auf zwei Arten lenkst. Die geführte Generierung gibt der KI eine Richtung vor, ohne dass eine sichtbare Nachricht im Chat landet. Impersonate lässt die KI deine eigene Antwort schreiben. Dazu kommt das **Quick replies**-Menü (Schnellantworten), das beide Aktionen direkt neben die Schaltfläche Send legt.

## Geführte Generierung

Mit der geführten Generierung sagst du der KI, wohin die nächste Antwort führen soll. Deine Vorgabe bleibt außerhalb der Rolle. Sie lenkt die Antwort, erscheint aber nicht als normale Chat-Nachricht.

### Eine Antwort mit /guided lenken

Der wichtigste Weg dahin ist der Slash-Befehl `/guided`.

1. Tippe `/guided` und dahinter deine Vorgabe ins Nachrichtenfeld.
2. Drück Enter oder klick auf Send.
3. Die KI generiert ihre nächste Antwort – in der Richtung, die du vorgegeben hast.

Dieses Beispiel drängt die nächste Antwort in Richtung eines Geständnisses:

```
/guided make him admit he is lying
```

Der Befehl hat kurze Aliasse. Statt `/guided` funktionieren auch `/narrator`, `/narrate` oder `/nar`.

Im Gruppenchat lässt sich die Vorgabe an einen einzelnen Charakter richten. Tippe `/guided respond for <character> <direction>`. Ersetze `<character>` durch den Charakternamen und `<direction>` durch deine Vorgabe. Beispiel:

```
/guided respond for Alice make her admit she is lying
```

### Geführt neu generieren

Eine Antwort lässt sich auch beim Neugenerieren lenken. Dabei dient der Text, der gerade im Nachrichtenfeld steht, einmalig als Vorgabe.

1. Öffne **Settings** (Einstellungen), dann **Advanced** (Erweitert), dann **Message Tools** (Nachrichten-Werkzeuge).
2. Aktiviere **Guide swipes/regens with chat input**. Diese Einstellung ist standardmäßig aus.
3. Geh zurück in einen Chat und tippe eine Vorgabe ins Nachrichtenfeld, ohne sie abzuschicken.
4. Klick bei der KI-Nachricht auf **Regenerate** (neu generieren).

Ist die Einstellung aktiv und steht Text im Feld, ändert sich der Tooltip (der Kurzhinweis beim Draufzeigen) der Schaltfläche **Regenerate** zu **Regenerate (guided)**. Die KI erstellt dann eine neue Fassung der Antwort und nutzt deinen getippten Text als Vorgabe.

### Stored guidance nachlesen

Entsteht eine Antwort mit einer Vorgabe, speichert Marinara diese Vorgabe zum späteren Nachlesen. An der Nachricht erscheint dann die Aktion **Stored guidance** (gespeicherte Vorgabe) – ein Schriftrollen-Symbol.

1. Klick bei der KI-Nachricht auf das Symbol **Stored guidance**.
2. Es öffnet sich ein Fenster namens **Stored guidance** und zeigt die Vorgabe hinter der Antwort.

Das Fenster kennzeichnet, woher die Vorgabe stammt:

- **/guided**: Die Vorgabe kam über den Befehl `/guided`.
- **Guided regenerate**: Die Vorgabe kam von einem geführten Klick auf **Regenerate**.
- **Game start**: Die Vorgabe kam aus der Einrichtung des Game Mode.

Bei Vorgaben aus `/guided` und aus dem geführten Neugenerieren kopiert die Schaltfläche **Copy /guided** die Vorgabe als fertigen `/guided`-Befehl heraus. Den kannst du in einen anderen Chat einfügen und dieselbe Lenkung noch einmal nutzen.

## Impersonate

Impersonate lässt die KI deine nächste Nachricht schreiben – in der Stimme deiner Persona. Die Persona ist der Charakter, den du spielst; im Chat steht sie als `{{user}}`. Wie du eine einrichtest, steht unter [Benutzer-Personas](../characters/personas.md).

Impersonate funktioniert nur in Roleplay-Chats, nicht in Conversation- oder Game-Chats. Im Conversation-Chat erscheint stattdessen die Meldung „Impersonate is not available in Conversation mode.“

### /impersonate verwenden

1. Tippe `/impersonate` ins Nachrichtenfeld. Dahinter kannst du optional eine Vorgabe setzen.
2. Drück Enter oder klick auf Send.
3. Die KI schreibt als deine Persona eine Nutzer-Nachricht und stellt sie in den Chat.

So bringst du die KI etwa dazu, in deiner Stimme nach dem Wetter zu fragen:

```
/impersonate ask about the weather
```

Der Befehl hat einen kurzen Alias. Statt `/impersonate` funktioniert auch `/imp`.

Eine von Impersonate geschriebene Nachricht lässt sich wiederholen. Die Aktion **Regenerate** greift auch bei Nutzer-Nachrichten aus Impersonate – so bekommst du eine andere Fassung.

### Die Impersonate-Einstellungen

Impersonate hat einen eigenen Einstellungsbereich, der für jedes `/impersonate` gilt – in allen Chats. Du öffnest ihn über die Einstellungen des jeweiligen Chats.

1. Öffne das Panel **Chat Settings** (Chat-Einstellungen) eines Roleplay-Chats.
2. Such den Abschnitt **Impersonate**.

Der Abschnitt enthält diese Bedienelemente:

- **Prompt Template**: eine optionale Anweisung, die bei jedem Impersonate an das Modell geht. Bleibt das Feld leer, greift der Prompt des Chats – oder der eingebaute Standard, falls der Chat keinen hat. Unterstützt werden die Makros `{{user}}`, `{{persona_description}}` und `{{impersonate_direction}}`. Ein Makro ist ein Platzhalter, den Marinara vor dem Senden durch echten Text ersetzt. Über **Built-in default** liest du den Standardtext nach. Die Schaltfläche **Reset** setzt eine eigene Vorlage wieder auf leer zurück.
- **Preset**: nutzt ein bestimmtes Prompt-Preset nur für Impersonate-Antworten. Ein Preset ist eine gespeicherte Sammlung von Prompt-Einstellungen. Siehe [Presets](../prompts/presets.md). Der Standard ist **Use chat default**. Presets greifen nur im Roleplay.
- **Connection**: leitet Impersonate-Antworten über eine bestimmte Verbindung, etwa über ein günstigeres oder schnelleres Modell. Eine Verbindung ist eine gespeicherte Verknüpfung zu einem KI-Anbieter. Siehe [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md). Der Standard ist **Use chat default**. Möglich ist außerdem **Random**.
- **Skip agents**: Ist der Schalter an, überspringt Marinara während Impersonate die Agenten-Pipeline (Tracker, Lorebook-Router und ähnliche Helfer). Das hält Impersonate schnell und verhindert Änderungen am Weltzustand. Standardmäßig ist der Schalter aus. Siehe [Agenten](../agents/agents-overview.md).
- **Use CYOA as direction**: Ist der Schalter an, wird ein angeklickter CYOA-Punkt zur Impersonate-Vorgabe, statt als normale Nachricht im Chat zu landen. CYOA steht für „choose your own adventure“ – eine Reihe anklickbarer Auswahlmöglichkeiten, die manche Chats nach einer Antwort anzeigen. Standardmäßig ist diese Einstellung aus.

### Einen eigenen Impersonate-Prompt setzen

Ein Impersonate-Prompt lässt sich per Slash-Befehl auch nur für einen einzelnen Chat setzen.

1. Tippe `/impersonate_prompt` und dahinter deinen Prompt in Anführungszeichen.
2. Drück Enter.

Beispiel:

```
/impersonate_prompt "You will now play as my OC:"
```

Um den Prompt dieses Chats zu löschen und zum Standard zurückzukehren, tippe:

```
/impersonate_prompt reset
```

Der Befehl hat einen kurzen Alias: `/imp_prompt`.

## Das **Quick replies**-Menü

Das **Quick replies**-Menü legt zusätzliche Sende-Aktionen neben die normale Schaltfläche Send. Damit erreichst du die geführte Generierung und Impersonate mit einem Klick, ganz ohne Slash-Befehl.

Welche Aktionen erscheinen, legst du in den Einstellungen fest.

1. Öffne **Settings**, dann **Advanced**, dann **Message Tools**.
2. Aktiviere **Quick replies**. Standardmäßig ist die Option aus.
3. Klapp sie auf und wähle die gewünschten Aktionen. Sobald das Menü aktiv ist, sind alle drei Aktionen standardmäßig an.

Diese drei Aktionen gibt es:

- **Post only**: stellt deine getippte Nachricht in den Chat, ohne eine KI-Antwort auszulösen. Das geht auch mit dem Slash-Befehl `/send <message>`.
- **Guide reply**: schickt deinen getippten Text als `/guided`-Vorgabe statt als normale Nachricht.
- **Impersonate**: generiert eine Antwort als deine Persona und nutzt den getippten Text als Vorgabe. In Conversation-Chats ist diese Aktion ausgeblendet, weil Impersonate dort nicht funktioniert.

Ist nur eine Aktion aktiv, sitzt ihre Schaltfläche direkt neben Send. Sind mehrere aktiv, rutschen sie in ein kleines Menü. Ein Klick auf die Drei-Punkte-Schaltfläche (Beschriftung **Quick replies**) öffnet es.

## Verwandte Anleitungen

- [Nachrichten-Aktionen: Bearbeiten, Löschen, Swipen, Neu generieren](messages.md)
- [Peek Prompt: Sehen, was die KI bekommen hat](peek-prompt.md)
- [Benutzer-Personas: Anlegen und Bearbeiten](../characters/personas.md)
- [Presets](../prompts/presets.md)
