# Preset-Editor und Prompt-Manager

Diese Anleitung erklärt die Prompt-Presets in Marinara Engine – gespeicherte Prompt-Vorlagen. Du erfährst, was sie sind, wie du im **Preset Editor** (Preset-Editor) eines baust und wie du eines einem Chat zuweist. Ein Preset bestimmt den Aufbau des Textes, den Marinara an die KI schickt.

## Was ein Preset ist

Ein Preset ist eine wiederverwendbare Blaupause. Es legt fest, welche Informationen Marinara an die KI schickt und in welcher Reihenfolge. Dazu gehören selbst geschriebene System-Anweisungen, die Charakterkarte, die Persona, der Chatverlauf, Einträge aus Lorebooks (Sammlungen von Weltwissen) und einiges mehr.

Presets formen den Prompt für **Roleplay**- und **Game**-Chats. Der **Conversation Mode** arbeitet anders und nutzt ein einzelnes Prompt-Feld. Mehr dazu unter „Wie sich Conversation Mode und Game Mode unterscheiden“.

Presets brauchen weder API-Key (geheimer Zugangscode, ähnlich einem Passwort) noch Konto. Sie beschreiben nur, wie ein Prompt aufgebaut wird. Zum Senden brauchst du trotzdem eine funktionierende Verbindung. Siehe [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).

## Den Preset Editor öffnen

Prompt-Presets liegen im Bereich **Prompts** des Panels **Presets** am linken Rand der App. Die weiteren Bereiche dieses Panels heißen **Regexes** und **Functions**.

Oben im Panel sitzen drei Schaltflächen:

- **New** (Plus-Symbol): legt ein neues Preset an.
- **Import** (Download-Symbol): lädt ein Preset aus einer `.json`-Datei.
- **Select** (Häkchen-Symbol): mehrere Presets auf einmal auswählen, um sie zu exportieren oder zu löschen.

Darunter liegen das Feld **Search presets** (Presets durchsuchen) und ein Sortiermenü mit **A-Z**, **Z-A**, **Newest** und **Oldest**. Über **New Folder** (Neuer Ordner) lassen sich Presets in Ordnern gruppieren. Zieh ein Preset auf einen Ordner, um es dorthin zu verschieben. Ein Doppelklick oder Doppeltipp auf einen Ordner benennt ihn um.

Jede Preset-Zeile zeigt Name, Wrap-Format, Anzahl der Abschnitte und Autor. Ist ein Preset als Standard markiert, trägt es das Abzeichen **DEFAULT**. Ein Klick auf die Zeile öffnet das Preset im **Preset Editor**.

## Ein Preset anlegen und bearbeiten

So legst du ein neues Preset an:

1. Öffne das Panel **Presets**.
2. Klick auf die Schaltfläche **New**. Das Fenster **Create Preset** (Preset erstellen) öffnet sich.
3. Gib einen **Name** ein. Dieses Feld ist Pflicht.
4. Ergänze optional eine **Description** (Beschreibung), damit du später weißt, wofür das Preset gedacht ist.
5. Klick auf **Create**. Das neue Preset öffnet sich im **Preset Editor**.
6. Bau den Prompt auf dem Tab **Sections** zusammen (siehe unten).
7. Klick zum Schluss oben rechts auf **Save**.

Der Editor speichert nicht von selbst. Änderungen bleiben erst nach einem Klick auf **Save** erhalten. Willst du den Editor mit ungespeicherten Änderungen verlassen, erscheint eine Warnung mit den Schaltflächen **Keep editing**, **Discard** und **Save & close**.

Zum Exportieren öffnest du das Preset und klickst oben in der Leiste auf die Export-Schaltfläche (Pfeil nach oben). Bei ungespeicherten Änderungen fragt Marinara vorher nach dem Speichern. Zum Löschen dient das Papierkorb-Symbol in derselben Leiste.

## Die Tabs Overview, Sections und Prompts

Der **Preset Editor** hat drei Tabs.

- **Overview**: Name, Beschreibung, Wrap-Format und Autor des Presets.
- **Sections**: der eigentliche Prompt-Aufbau aus Blöcken und Markern.
- **Prompts**: die Modus-Prompts für Conversation- und Game-Chats.

### Tab Overview

Der Tab **Overview** enthält vier Felder. **Name** ist der Anzeigename im Panel **Presets**. **Description** fasst das Preset kurz zusammen. **Wrap Format** steuert die Formatierung der Abschnitte (siehe „Wrap-Formate“). **Author** ist ein optionaler Name der erstellenden Person – praktisch, wenn du ein Preset weitergibst. Zwei schreibgeschützte Karten zeigen die Anzahl der **Sections** und **Groups**.

### Tab Prompts

Der Tab **Prompts** enthält die Modus-Prompts.

- **Conversation Mode**: ein Textfeld, das als Conversation-Prompt dieses Presets dient. Bleibt es leer, greift der eingebaute Conversation-Prompt von Marinara.
- **Roleplay Mode**: hier nicht bearbeitbar. Roleplay nutzt den Prompt, der aus deinen **Sections** zusammengesetzt wird.
- **Game Mode**: ein Textfeld, das als Game-Prompt dieses Presets dient. Bleibt es leer, greift der eingebaute Game-Prompt von Marinara.

## Abschnitte und Marker

Auf dem Tab **Sections** baust du den Prompt. Jeder Abschnitt landet im fertigen Text für die KI. Zusammengesetzt wird von oben nach unten.

Ein Klick auf **Add Section** (Abschnitt hinzufügen) öffnet das Menü. Es bietet zwei Arten von Abschnitt.

Ein **Prompt Block** ist ein Freitext-Abschnitt, den du selbst schreibst. Er eignet sich für System-Anweisungen, Vorgaben zum Ton oder jede Formulierung, die in jedem Prompt stehen soll.

Ein **Marker** ist ein Abschnitt, der sich automatisch füllt. Eigenen Text hat er nicht. Stattdessen setzt Marinara beim Senden aktuelle Inhalte aus dem Chat ein. Die folgende Tabelle listet die Marker auf.

| Marker | Was er einfügt |
|---|---|
| **Character Info** | Die Details der aktiven Charakterkarte. |
| **Persona** | Die Details der aktiven Persona. |
| **Chat History** | Die laufenden Chat-Nachrichten. |
| **Chat Summary** | Die zusammengestellte Zusammenfassung dieses Chats. |
| **Dialogue Examples** | Die Beispieldialoge des Charakters. |
| **Lorebook Marker (All)** | Alle aktiven Lorebook-Einträge. |
| **Lorebook Marker (Before)** | Lorebook-Einträge, die davor eingefügt werden sollen. |
| **Lorebook Marker (After)** | Lorebook-Einträge, die danach eingefügt werden sollen. |

Ist ein Abschnitt ein Marker, trägt seine Zeile das Abzeichen **MARKER**. Klapp sie auf, und ein Hinweis nennt den Marker-Typ. In die meisten Marker lässt sich kein Inhalt tippen, weil Marinara sie selbst erzeugt.

Fehlt in einem Preset ein aktivierter Marker **Dialogue Examples**, hängt Marinara vorhandene Beispieldialoge hinter dem Szenario an **Character Info** an. Dabei gilt die XML-, Markdown- oder unumschlossene Schreibweise des Presets. Füge einen Dialogue-Examples-Marker hinzu, wenn du die Platzierung selbst bestimmen willst – doppelt fügt Marinara die Beispiele nicht ein.

Hat der Chat aktive Lorebooks, das Preset aber keinen Lorebook-Marker, erscheint eine Warnung. Sie lautet: „Add a lorebook marker when this preset should receive active lorebook entries.“ Füge einen Lorebook-Marker hinzu, damit diese Einträge bei der KI ankommen. Siehe [Lorebooks im Überblick](../lorebooks/overview.md).

Hast du eigene Agenten mit der Option „inject as section“ eingerichtet, zeigt das Menü zusätzlich die Gruppe **Agent Sections**. Jeder Agent-Abschnitt fügt die jüngste Ausgabe des jeweiligen Agenten in den Prompt ein. Eigene Anweisungen kannst du darum herum ergänzen.

Rechts in jeder Abschnittszeile sitzen die Bedienelemente. **Duplicate** kopiert den Abschnitt. Das Augensymbol aktiviert oder deaktiviert ihn. **Delete** entfernt ihn. Zum Umsortieren ziehst du am Griff, nutzt die Pfeile nach oben und unten oder hältst auf dem Touchscreen lange gedrückt.

Zum Bearbeiten klappst du einen Abschnitt auf (Klick auf den Namen oder den Pfeil). Ändern lassen sich **Name** und Rolle (**System**, **User** oder **Assistant**). Bei einem **Prompt Block** kommt das Feld **Content** dazu. Im Inhaltsfeld funktionieren Makros. Siehe [Prompt-Makros](macros.md).

## Gruppen und Position der Abschnitte

### Gruppen

Gruppen fassen mehrere Abschnitte in einem Container zusammen. So bleiben zusammengehörige Abschnitte auch im fertigen Prompt beieinander.

1. Klick auf dem Tab **Sections** in der Werkzeugleiste auf **Groups**.
2. Klick auf **New Group**. Es erscheint eine Gruppe namens „New Group“.
3. Ein Klick auf den Gruppennamen benennt sie um.
4. Klapp einen Abschnitt auf und wähle die Gruppe im Dropdown-Menü **Group**.

Beim Wrap-Format **XML** wird eine Gruppe zu einem übergeordneten Tag um ihre Abschnitte. Bei **Markdown** wird sie zu einer Überschrift. Löschst du eine Gruppe, bleiben ihre Abschnitte erhalten – sie verlieren nur die Gruppenzuordnung.

### Position und Tiefe

Im aufgeklappten Editor hat jeder Abschnitt die Einstellung **Position**.

- **Ordered (in sequence)**: Der Abschnitt steht dort, wo er in der Liste auftaucht. Das ist der Normalfall.
- **Depth (from end of chat)**: Der Abschnitt landet eine feste Anzahl Nachrichten vor dem Ende des Chats. Dann erscheint zusätzlich das Zahlenfeld **Depth** (Tiefe). Die Tiefe 0 setzt den Abschnitt hinter die letzte Nachricht.

**Depth** eignet sich für Hinweise, die die KI nahe an den neuesten Nachrichten sehen soll – etwa eine kurze Stilvorgabe.

## Wrap-Formate

**Wrap Format** auf dem Tab **Overview** legt fest, wie jeder Abschnitt beim Zusammensetzen des Prompts umschlossen wird. Zur Wahl stehen drei Schaltflächen.

- **XML**: Jeder Abschnitt steckt in Tags, etwa einem Namens-Tag um seinen Inhalt. Gruppen werden zu übergeordneten Tags. Das ist der Standard.
- **MARKDOWN**: Jeder Abschnitt bekommt eine Überschrift. Gruppen werden zu Überschriften höherer Ebene.
- **NONE**: Es kommt nichts drumherum. Der Inhalt geht exakt so raus, wie du ihn geschrieben hast.

Für die meisten Modelle ist XML eine gute Grundeinstellung. Probier **MARKDOWN** oder **NONE** nur, wenn ein Modell ohne Tags besser zu reagieren scheint.

## Ein Preset einem Chat zuweisen

Ein Preset wirkt erst, wenn du es einem Chat zuweist. In einem **Roleplay**-Chat gibt es dafür zwei Wege.

Über das Panel **Presets**:

1. Öffne den Chat, den du ändern willst.
2. Zeig im Panel **Presets** auf eine Preset-Zeile.
3. Klick auf die Häkchen-Schaltfläche **Assign to chat** (dem Chat zuweisen). Ein erneuter Klick hebt die Zuweisung auf.

Über **Chat Settings**:

1. Öffne den Chat.
2. Öffne **Chat Settings** (Chat-Einstellungen, Zahnradsymbol).
3. Such den Bereich **Prompt Preset**.
4. Wähle im Dropdown-Menü ein Preset.

Hat ein Preset Variablen, öffnet sich beim Zuweisen das Fenster **Configure Preset Variables** (Preset-Variablen konfigurieren). Dort triffst du deine Auswahl. Siehe [Preset-Variablen](preset-variables.md). Wechselst du zu einem anderen Preset, gehen die vorher getroffenen Variablen-Auswahlen verloren.

Im **Conversation Mode** lassen sich Prompt-Presets nicht über das Panel zuweisen. Ein Klick auf die Zuweisen-Schaltfläche zeigt dort die Meldung: „Prompt presets are not available in conversation mode.“ Wie Conversation- und Game-Chats stattdessen mit Presets umgehen, steht im nächsten Abschnitt.

## Wie sich Conversation Mode und Game Mode unterscheiden

**Conversation**- und **Game**-Chats bauen den Prompt nicht aus Sections. Sie nutzen einen einzelnen Modus-Prompt, den du pro Chat überschreiben kannst.

In diesen Modi zeigt **Chat Settings** einen Bereich **Prompt Preset** mit dem Dropdown-Menü **Prompt source**. Es listet deine Presets auf. Standardmäßig steht dort „Default conversation prompt“ oder „Default game prompt“. Ohne Presets liest du „No presets available“ (keine Presets vorhanden).

Unter dem Dropdown-Menü sitzt eine Statuszeile. Sie zeigt einen von drei Zuständen:

- **Default**: Der eingebaute Modus-Prompt kommt zum Einsatz.
- **Preset**: Der Prompt stammt aus dem gewählten Preset.
- **Custom**: Du hast eine Fassung getippt, die nur für diesen Chat gilt.

Über **Edit Prompt** tippst du einen Prompt nur für diesen Chat. Der Editor heißt dann **Edit Conversation Prompt** oder **Edit Game Prompt**. Stimmt deine Fassung exakt mit dem Preset oder dem Standard überein, wertet Marinara sie nicht als Anpassung. Sobald eine eigene Fassung existiert, erscheint die Schaltfläche **Reset to default prompt**, die sie wieder entfernt.

Game-Chats haben zusätzlich das Feld **Extra instructions** (zusätzliche Anweisungen). Was dort steht, kommt zum Game-Prompt hinzu. Das Limit liegt bei 2000 Zeichen. Ein Beispiel für so eine Anweisung: „Write in the style of Terry Pratchett.“

<a id="decision-blocks-and-prompt-caching"></a>

## Decision-Blöcke und Prompt-Caching

Ein Abschnitt kann einen Decision-Block `{{#if decision:"..."}}` enthalten. Dieser Teil des Presets wird dann nur in Zügen gesendet, in denen eine Aussage über den Chat wahr ist. Siehe [Das Decision-Modell fragen](conditional-prompts.md#asking-the-decision-model).

**Setze wechselnde Decision-Blöcke spät im Prompt ein**, etwa in Anweisungen nach dem Verlauf. Ein veränderter Zweig kann verhindern, dass der Anbieter den Prompt ab dieser Stelle wiederverwendet; frühe Änderungen können daher den Großteil der Cache-Ersparnis kosten. Ein früheres unverändertes Präfix kann weiter passen; nicht zwangsläufig wird der gesamte Prompt neu berechnet. Lass eine Decision nur dann weit oben, wenn ihre Antwort selten wechselt und ihre Anweisungen dorthin gehören. Einzelheiten je Anbieter stehen unter [Prompt-Caching](conditional-prompts.md#prompt-caching).

Aussagen in deaktivierten Abschnitten und Gruppen werden nie geprüft und zählen nicht zu **Decision statements per turn** (Decision-Aussagen pro Zug).

## Prüfen, was bei der KI angekommen ist

Welches Preset und welche Abschnitte tatsächlich bei der KI gelandet sind, zeigt **Peek Prompt**. Du siehst dort den vollständig zusammengesetzten Prompt einer Nachricht – der schnellste Weg, eine merkwürdige Antwort aufzuklären. Siehe [Peek Prompt: sehen, was die KI bekommen hat](../chats/peek-prompt.md).

## Verwandte Anleitungen

- [Preset-Variablen](preset-variables.md)
- [Prompt-Makros](macros.md)
- [Generierungsparameter](generation-parameters.md)
- [Einstellungsprofile](../chats/settings-profiles.md)
- [Chat Settings im Überblick](../chats/chat-settings.md)
- [Peek Prompt: sehen, was die KI bekommen hat](../chats/peek-prompt.md)
