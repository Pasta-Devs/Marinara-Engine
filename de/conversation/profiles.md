# Conversation-Mode-Profile (Display Name, About Me, Behavior)

Jeder Charakter und jede Persona hat ein kleines Chat-App-Profil für Conversation Mode: einen Anzeigenamen, eine Kurzbiografie („about me“) und eine Verhaltensanweisung. Diese Felder werden in Roleplay oder Game Mode nie verwendet.

Das ist kein Einstellungsprofil (ein gespeicherter Satz von Chat-Optionen, siehe [Einstellungsprofile](../chats/settings-profiles.md)). Neu im Modus? Lies zuerst [Conversation Mode: Erste Schritte](getting-started.md). Eine Persona ist die Charakterkarte, die dich vertritt.

## Wo diese Felder liegen

Die Felder liegen auf einem Tab namens **Convo**.

1. Öffne den Charakter im **Character Editor** oder die Persona im **Persona Editor**. Öffne dafür das Panel **Characters** in der Seitenleiste oder das Panel **Personas** über das Personensymbol in der rechten oberen Leiste und klicke dann auf die Karte (siehe [Charaktere anlegen und bearbeiten](../characters/creating-and-editing-characters.md) und [Nutzer-Personas](../characters/personas.md)).
2. Klicke auf den Tab **Convo**.

Der Tab enthält **Convo Display Name**, **About Me** und **Convo Behavior**. Bei einem Charakter hat er außerdem **Weekly schedule** (mit **Edit schedule** oder **Create schedule**, siehe [Zeitpläne](schedules.md)) und **Image generation directions**, optionale Vorgaben für die Selfies dieses Charakters (siehe [Selfies](selfies.md)).

## Einen Anzeigenamen festlegen

**Convo Display Name** ist der Name, der in Conversation-Chats angezeigt wird. Lass das Feld leer, um den Namen der Karte zu nutzen. Bestehende Nachrichten werden sofort aktualisiert.

Charaktere haben außerdem **Declare this name on the card in the prompt**. Ist es an, fügt Marinara dem Kartentext im Prompt (dem Text, den Marinara an das Modell sendet) eine Zeile wie „Conversation display name: X“ hinzu, damit das Modell weiß, welche Karte zu welchem Namen gehört. Es braucht zuerst einen Anzeigenamen.

## Eine About Me schreiben

**About Me** ist eine kurze Biografie: eine Zeile oder zwei, ein Emoji, ein Witz oder nichts. Marinara fügt bei jedem Zug das **About Me** jedes anwesenden Charakters und jeder anwesenden Persona dem Prompt hinzu, damit das Modell weiß, wie sich jeder darstellt. Dafür musst du nichts tun.

So füllst du sie aus:

- Tippe sie selbst ein. Die Emoji-Schaltfläche in der Werkzeugleiste fügt ein Emoji ein. **Revert** stellt den Text von vor deiner aktuellen Bearbeitung wieder her.
- Klicke bei einem gespeicherten Charakter auf den Zauberstab (**Generate About Me from this card**).
- Bitte **Professor Mari** auf dem Home-Bildschirm darum, zum Beispiel `Write Luna's About Me as a cryptic one-line bio.` Sie liest das gespeicherte Profil, schreibt die Biografie in der Stimme dieser Person und speichert sie. Du kannst ihre Änderung im üblichen Prüfablauf behalten oder zurücknehmen.

Wenn es nicht funktioniert hat: Fehlt der Zauberstab bei einer Karte, ist sie noch nicht gespeichert. Speichere zuerst die Karte.

## Convo Behavior festlegen

**Convo Behavior** ist eine Anweisung dafür, wie der Charakter oder die Persona sich in Conversation Mode verhält, zum Beispiel: kurze Antworten in Kleinschreibung halten und wie ein echter Mensch schreiben. Post-History-Anweisungen sind Prompt-Text, der nach dem jüngsten Chatverlauf steht. Behalte den Standard, wenn du keine eigenen Prompts schreibst. Mit **Insertion** wählst du, wohin die Anweisung im Prompt kommt:

| Option | Wohin die Anweisung kommt |
| --- | --- |
| **Constant — after the card** (Standard) | Immer, direkt nach dem Kartentext. |
| **Constant — before the card** | Immer, direkt vor dem Kartentext. |
| **Append to post-history** | Ans Ende der Post-History-Anweisungen. |
| **Prepend to post-history** | An den Anfang der Post-History-Anweisungen. |
| **Replace post-history** | Anstelle der Post-History-Anweisungen. |
| **Only where {{convo_behavior}} is placed** | Nur dorthin, wo du das Makro in einem eigenen Prompt platzierst. |

## Chat-spezifische About-Me-Überschreibungen

Das **About Me** der Karte ist der Standard überall. Du kannst für einen Chat allein eine andere Biografie festlegen.

1. Klicke in einem Conversation-Chat auf den Avatar oder den Namen eines Charakters oder einer Persona. Daneben öffnet sich eine Profilkarte (auf dem Handy von unten).
2. Lies die Karte. Sie zeigt den Avatar, den Namen und das aktuelle **About Me**. Ein Badge zeigt **Default** oder **Chat-specific**. Bei Charakteren steht dort außerdem **Online**, **Away**, **Busy** oder **Offline**.
3. Klicke auf **Edit**.
4. Tippe die Biografie für diesen Chat ein. Der Tab **Custom emojis** bietet eine Emoji-Auswahl.
5. Klicke auf **Save**. Du siehst „Chat-specific about me saved“.

**Cancel** schließt den Bearbeitungsmodus ohne Speichern. **Revert** macht ungespeicherte Änderungen rückgängig. **Clear** entfernt eine bestehende Überschreibung und kehrt zum Standard der Karte zurück. Auch das Speichern einer leeren Biografie hebt die Überschreibung auf.

## Einen Charakter sein eigenes About Me ändern lassen

Das ist eine fortgeschrittene Option. Ein Tool namens `update_about_me` lässt einen Charakter während eines Chats seine eigene Biografie bearbeiten. Es ist standardmäßig aus. Um es zu nutzen, öffne **Chat Settings → Function Calling**, schalte **Enable Tool Use** ein und füge dann das Tool `update_about_me` hinzu.

Der Charakter wählt eine von zwei Möglichkeiten:

- Public ändert die echte Biografie, die in jedem Chat sichtbar ist. Du gibst sie zuerst frei.
- Chat ändert eine Biografie, die nur im aktuellen Chat gilt.

## Makros für eigene Prompts

Du brauchst keine Makros, damit Profile das Modell erreichen. Nutze sie nur, um einen Wert an eine genaue Stelle in einem eigenen Prompt zu setzen. Jedes ist außerhalb von Conversation Mode leer. Siehe [Makros](../prompts/macros.md).

| Makro | Wert |
| --- | --- |
| `{{convo_display}}` | Der Anzeigename des antwortenden Charakters. |
| `{{char_about}}` | Das wirksame **About Me** des Charakters. |
| `{{persona_about}}` | Das wirksame **About Me** der Persona. |
| `{{convo_behavior}}` | Die Anweisung **Convo Behavior** des Charakters. |

## Verwandte Anleitungen

- [Conversation Mode: Erste Schritte](getting-started.md)
- [Charaktere anlegen und bearbeiten](../characters/creating-and-editing-characters.md)
- [Nutzer-Personas: erstellen und bearbeiten](../characters/personas.md)
- [Makros](../prompts/macros.md)
