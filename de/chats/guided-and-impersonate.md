# Geführte Generierung und Impersonate

Zwei Wege, einen Chat zu lenken. Die geführte Generierung gibt der nächsten Antwort eine Richtung vor, ohne eine sichtbare Nachricht zu posten. Impersonate lässt das Modell deine eigene Antwort schreiben. Das Menü **Quick replies** (Schnellantworten) legt beides neben **Send** (Senden).

## Eine Antwort mit /guided lenken

Deine Vorgabe steht außerhalb der Rolle. Sie prägt die Antwort, erscheint aber nicht als Chat-Nachricht.

1. Tipp `/guided` und deine Vorgabe ins Nachrichtenfeld.
2. Drück <kbd>Enter</kbd> oder klick auf **Send**.

Das Modell schreibt seine nächste Antwort in Richtung deiner Vorgabe. Zum Beispiel:

```text
/guided make him admit he is lying
```

Statt `/guided` kannst du auch `/narrator`, `/narrate` oder `/nar` tippen. In einem Gruppenchat richtest du die Vorgabe mit `respond as`, `reply as` oder `respond for` an einen einzelnen Charakter:

```text
/guided respond as Alice make her admit she is lying
```

## Geführt neu generieren

Dabei dient der Text in deinem Nachrichtenfeld einmalig als Vorgabe für eine Neugenerierung.

1. Öffne **Settings → Advanced → Message Tools** und schalte **Guide swipes/regens with chat input** (Swipes und Neugenerierungen mit der Chat-Eingabe lenken) ein. Standardmäßig ist die Einstellung aus.
2. Tipp in einem Chat eine Vorgabe ins Nachrichtenfeld, aber schick sie nicht ab.
3. Klick an der KI-Nachricht auf **Regenerate** (neu generieren). Steht Text im Feld, heißt die Schaltfläche **Regenerate (guided)**.

Deine Vorgabe bleibt danach im Feld stehen, sodass du sie anpassen und noch einmal neu generieren kannst. Soll das Feld stattdessen geleert werden, schalte **Keep guidance after regenerating** (Vorgabe nach dem Neugenerieren behalten) unter **Settings → General → Input & Editing** aus.

Wenn es nicht funktioniert hat: Die Schaltfläche muss **Regenerate (guided)** heißen. Steht dort nur **Regenerate**, ist die Einstellung aus oder das Feld leer.

<a id="read-stored-guidance"></a>

## Stored guidance nachlesen

Marinara speichert die Vorgabe, die eine Antwort geprägt hat.

1. Klick an der KI-Nachricht auf das Symbol **Stored guidance** (gespeicherte Vorgabe), eine Schriftrolle.
2. Ein Fenster mit dem Titel **Stored guidance** zeigt die Vorgabe.

Das Fenster kennzeichnet, woher die Vorgabe stammt: **/guided**, **Guided regenerate** oder **Game start** (Einrichtung des Game Mode). Bei Vorgaben aus `/guided` und aus dem geführten Neugenerieren kopiert **Copy /guided** (als /guided kopieren) einen fertigen `/guided`-Befehl, den du in einen anderen Chat einfügen kannst.

## Deine Antwort mit Impersonate schreiben

Impersonate lässt das Modell deine nächste Nachricht im Tonfall deiner Persona schreiben. Eine Persona ist der Charakter, den du spielst, geschrieben als `{{user}}`. Siehe [Personas](../characters/personas.md).

Bevor du anfängst: Impersonate funktioniert nur in Roleplay-Chats. In Conversation siehst du „Impersonate is not available in Conversation mode.“ Auch in Game steht es nicht zur Verfügung.

1. Tipp `/impersonate` ins Nachrichtenfeld. Wenn du willst, häng eine Vorgabe an.
2. Drück <kbd>Enter</kbd> oder klick auf **Send**.

Das Modell postet eine Nutzernachricht als deine Persona. Dieses Beispiel schreibt eine Nachricht, die nach dem Wetter fragt:

```text
/impersonate ask about the weather
```

Der kurze Alias ist `/imp`. **Regenerate** funktioniert auch bei einer Nachricht, die Impersonate geschrieben hat, sodass du eine andere Fassung bekommst.

### Die Impersonate-Einstellungen

Diese Einstellungen gelten für jedes `/impersonate` in all deinen Chats. Öffne in einem Roleplay-Chat **Chat Settings** (Chat-Einstellungen) und such den Abschnitt **Impersonate**. Wie du das Panel öffnest, steht in [Chat Settings](chat-settings.md).

| Bedienelement | Funktion |
| --- | --- |
| **Prompt Template** (Prompt-Vorlage) | Eine optionale Anweisung, die bei jedem Impersonate mitgeschickt wird. Bleibt sie leer, gilt der Prompt des Chats oder der eingebaute Standard. Sie unterstützt `{{user}}`, `{{persona_description}}` und `{{impersonate_direction}}` – Platzhalter, die Marinara durch echten Text ersetzt. Wähl **Built-in default** (eingebauter Standard), um den Standard zu lesen, **Copy built-in default to edit** (eingebauten Standard zum Bearbeiten kopieren), um eine Kopie anzulegen, **Save as** (Speichern unter), um eine Vorlage unter einem Namen zu behalten, und **Delete template** (Vorlage löschen), um eine zu entfernen. |
| **Preset** | Ein Prompt-Preset nur für Impersonate-Antworten. Standard: **Use chat default** (Chat-Standard verwenden). Siehe [Presets](../prompts/presets.md). |
| **Connection** (Verbindung) | Das Modell für Impersonate-Antworten, etwa ein günstigeres oder schnelleres. Standard: **Use chat default**. Du kannst auch **Random** (Zufall) wählen. Siehe [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md). |
| **Skip agents** (Agenten überspringen) | Überspringt während Impersonate die Agenten (Tracker, Lorebook-Router und ähnliche Helfer). Das hält Impersonate schnell und verhindert, dass es den Weltzustand ändert. Standardmäßig aus. Siehe [Agenten](../agents/agents-overview.md). |
| **Use CYOA as direction** (CYOA als Vorgabe verwenden) | Ein Klick auf eine CYOA-Option (choose your own adventure, „wähle dein eigenes Abenteuer“) dient als Impersonate-Vorgabe, statt sie zu posten. Standardmäßig aus. Ist **Add CYOA choices to the message box instead of sending them** (CYOA-Auswahlmöglichkeiten ins Nachrichtenfeld einfügen, statt sie abzuschicken) unter **Settings → General → Input & Editing** an, fügt ein Klick nur den Text in dein Nachrichtenfeld ein, und diese Einstellung hat keine Wirkung. |

### Einen Prompt für einen Chat festlegen

1. Tipp `/impersonate_prompt` und deinen Prompt in Anführungszeichen.
2. Drück <kbd>Enter</kbd>.

```text
/impersonate_prompt "You will now play as my OC:"
```

Um zum Standard zurückzukehren, tipp `/impersonate_prompt reset`. Der Alias ist `/imp_prompt`.

## Quick replies neben Send hinzufügen

Quick replies ergänzen **Send** um Alternativen mit einem Klick, sodass du keinen Slash-Befehl tippen musst.

1. Öffne **Settings → General → Input & Editing**.
2. Schalte **Quick replies** ein. Standardmäßig ist es aus.
3. Klapp es auf, um zu wählen, welche Aktionen erscheinen. Sobald es an ist, sind alle drei Aktionen standardmäßig an.

| Aktion | Funktion |
| --- | --- |
| **Post only** (nur posten) | Stellt deine getippte Nachricht ohne Antwort in den Chat. Der Befehl `/send <message>` bewirkt dasselbe. |
| **Guide reply** (Antwort lenken) | Schickt deinen getippten Text als `/guided`-Vorgabe. |
| **Impersonate** | Erzeugt eine Antwort von der Seite deiner Persona und nutzt deinen getippten Text als Vorgabe. In Conversation-Chats ist diese Aktion ausgeblendet. |

Ist eine Aktion an, sitzt ihre Schaltfläche neben **Send**. Sind es mehrere, wandern sie in eine Drei-Punkte-Schaltfläche (**Quick replies**), die ein Menü öffnet.
