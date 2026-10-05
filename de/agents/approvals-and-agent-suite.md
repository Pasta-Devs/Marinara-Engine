# Agent-Freigaben und die Agent Suite

In dieser Anleitung erfährst du, wie du prüfst und steuerst, was Agenten (kleine KI-Helfer, die parallel zu den Antworten laufen) während eines Chats schreiben. Beschrieben werden der Schalter **Review Agent Outputs** (Agent-Ausgaben prüfen), die beiden Prüffenster, der **Agent Suite**-Editor und das Panel **Cached prompt injections** (zwischengespeicherte Prompt-Einfügungen).

## Review Agent Outputs

Manche Agenten wollen neue Daten in den Chat schreiben. Ein Lorebook-Agent legt Einträge in einem Lorebook an, also in einer Sammlung von Weltwissen. Ein Zusammenfassungs-Agent speichert eine Chat-Zusammenfassung. Standardmäßig speichert Marinara einen Teil dieser Schreibvorgänge automatisch. Mit **Review Agent Outputs** prüfst du jeden davon erst selbst.

So findest du den Schalter:

1. Öffne den Chat, den du steuern willst.
2. Öffne **Chat Settings** (Chat-Einstellungen).
3. Scroll zum Abschnitt **Agents**.
4. Aktivier **Review Agent Outputs**.

Ist **Review Agent Outputs** aktiv, warten Lorebook-Updates, Zusammenfassungs-Updates und alle anderen prüfbaren Ausgaben schreibender Agenten auf deine Freigabe. Ist der Schalter aus, speichert Marinara Lorebook- und Zusammenfassungs-Updates auch automatisch.

Änderungen an der Charakterkarte sind ein Sonderfall. Sie fragen immer erst nach deiner Freigabe, selbst wenn **Review Agent Outputs** aus ist. Diese Sicherheitsabfrage lässt sich nicht abschalten.

## Das Freigabefenster für Agent-Schreibvorgänge

Ist **Review Agent Outputs** aktiv und schlägt ein Agent einen Lorebook- oder Zusammenfassungs-Eintrag vor, öffnet sich ein Prüffenster. Je nach Art des Schreibvorgangs heißt es **Review Lorebook Update** oder **Review Summary Update**.

Das Fenster zeigt:

- Den Namen des Agenten, von dem der Vorschlag stammt.
- Ein Feld **Proposed Text** (vorgeschlagener Text), das du vor dem Speichern bearbeiten kannst.
- Bei Lorebook-Schreibvorgängen einen kurzen Hinweis, jeden Eintrag unter eine `###`-Überschrift zu setzen.

Unten im Fenster hast du drei Möglichkeiten:

- **Accept** (übernehmen): speichert den Text samt deiner Änderungen in den Chat.
- **Regenerate** (neu generieren): lässt nur diesen einen Agenten noch einmal laufen und liefert einen frischen Vorschlag.
- **Discard** (verwerfen): wirft den Vorschlag weg, ohne zu speichern.

Warten mehrere Vorschläge, zeigt das Fenster, wie viele noch in der Warteschlange stehen. Sobald du einen erledigt hast, öffnet es sich für den nächsten.

## Die Prüfung von Charakterkarten-Updates

Der Agent **Card Evolution Auditor** kann Änderungen an Feldern der Charakterkarte vorschlagen, passend zu dem, was im Roleplay passiert ist. Im Conversation Mode schlägt außerdem das eingebaute Tool `update_about_me` gelegentlich eine Änderung am öffentlichen About Me vor. Keiner der beiden Wege ändert die Karte eigenmächtig: Beide öffnen das Fenster **Review Character Card Updates**, und du entscheidest.

Das Fenster listet jede vorgeschlagene Änderung auf. Zu jeder siehst du:

- Das Kartenfeld, um das es geht (zum Beispiel description, personality oder appearance).
- Eine kurze Begründung, sofern der Agent eine mitliefert.
- Einen Block **Before** (vorher) mit dem aktuellen Text.
- Ein Feld **After** (nachher) mit dem neuen Text. Diesen Text kannst du vor der Freigabe bearbeiten.

Dafür gibt es diese Aktionen:

- **Approve** (freigeben): übernimmt die Änderungen. Die Zahl auf der Schaltfläche zeigt, wie viele Änderungen greifen. Eine Freigabe erhöht die Versionsnummer des Charakters und legt einen Eintrag in der Versionshistorie an.
- **Regenerate**: lässt den Agenten noch einmal laufen und liefert neue Vorschläge.
- **Reject** (ablehnen): verwirft die Vorschläge, ohne die Karte zu ändern.

Manchmal hat sich die Karte geändert, seit der Agent seinen Vorschlag geschrieben hat. Dann markiert die App die Änderung als **stale** (veraltet) und stellt sie abgedunkelt dar. Gibt es veraltete Änderungen, erscheint eine Schaltfläche **Override stale** mit der Anzahl. Nutze sie nur, wenn du den Text trotzdem behalten willst. Die App fragt vorher nach einer Bestätigung. Sie hängt den veralteten Text dann an das Feld an, statt Text zu ersetzen, der ohnehin nicht mehr passt.

## Der Agent-Suite-Editor und das Umschreiben mit KI-Hilfe

In der **Agent Suite** siehst und bearbeitest du alles, was die Agenten dieses Chats gespeichert haben. Dazu gehören Tracker-Daten wie die aktuelle Szene, die anwesenden Charaktere und die Persona-Werte, außerdem die gespeicherten Ausgaben deiner eigenen Agenten. So korrigierst du einen falschen Namen, einen Wert oder wirren gespeicherten Text, von Hand oder mit KI-Hilfe.

So öffnest du sie:

1. Öffne **Chat Settings**.
2. Scroll zum Abschnitt **Agents**.
3. Klick auf **Agent Suite**.

Links stehen die Agenten, die in diesem Chat aktiv sind. Wähl einen aus, um zu sehen, was er gespeichert hat. Rechts erscheinen die bearbeitbaren Blöcke, gruppiert in **Stored Memory** (gespeichertes Gedächtnis), **Tracker Data** (nur bei Tracker-Agenten) und **Recent Outputs** (nur bei eigenen Agenten). Agenten ohne Tracker-Daten zeigen nur **Stored Memory**.

Jeder Block ist ein Text- oder JSON-Editor. Nach einer Änderung:

- Klick auf **Save** (speichern), um sie zu behalten.
- Klick auf **Reset** (zurücksetzen), um sie zu verwerfen und zum gespeicherten Wert zurückzukehren.

Möglich ist außerdem, einen Block von der KI umschreiben zu lassen:

1. Klick beim gewünschten Block auf **AI Edit** (mit KI bearbeiten).
2. Willst du nur einen Teil des Textes ändern, markier ihn vorher im Editor. Ohne Markierung wird der ganze Block umgeschrieben.
3. Gib eine Anweisung ein, zum Beispiel „korrigiere die verstümmelten Charakternamen, sie heißt Mira“.
4. Optional: Klick auf **Add Context** (Kontext hinzufügen), um Charakterkarten oder Lorebook-Einträge anzuhängen. Das hilft der KI zu verstehen, wofür die Daten stehen.
5. Wähl die Verbindung aus, die das Umschreiben übernimmt (KI-Anbieter und Modell).
6. Klick auf **Rewrite** (umschreiben).

Der neue Text landet als ungespeicherter Entwurf im Block. Prüf ihn und klick dann auf **Save**, um ihn zu behalten, oder auf **Reset**, um ihn zu verwerfen.

Noch ein paar Hinweise:

- Laufen für diesen Chat noch Agenten, pausiert das Speichern, bis sie fertig sind.
- Der Bereich **Stored Memory** hat eine Schaltfläche **Clear memory** (Gedächtnis leeren). Sie erscheint nur, wenn der Agent Daten gespeichert hat. Sie löscht auf einen Schlag alles, was dieser Agent für diesen Chat gespeichert hat, und lässt sich nicht rückgängig machen. Die App fragt vorher nach einer Bestätigung.
- Beim **Narrative Director** bleiben gespeicherte Spoiler verborgen. Über **Reveal spoilers** (Spoiler anzeigen) siehst und bearbeitest du sie.

## Das Panel „Cached prompt injections“

Bevor eine Antwort generiert wird, fügen manche schreibenden Agenten Text in den Prompt ein, also in den Text, den Marinara an die KI schickt. Typisch ist das bei **Prose Guardian**, **Narrative Director** und eigenen Einfügungs-Agenten. Das Panel **Cached prompt injections** zeigt diesen zusätzlichen Text zur Fehlersuche. Du findest es im Tab **Injections** von **Agent activity**, wenn **Debug mode** eingeschaltet ist (siehe [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md#agent-activity)). Es bezieht sich auf die jeweils letzte Antwort.

Zu jeder zwischengespeicherten Einfügung kannst du:

- Sie aufklappen, um den Text zu lesen und zu bearbeiten.
- Auf das Symbol **Save** klicken, um deine Änderung zu behalten.
- Auf das Symbol **Re-run** (erneut ausführen) klicken, damit dieser eine Agent eine frische Einfügung schreibt.

Einfügungen von **Knowledge Retrieval** und **Knowledge Router** lassen sich in diesem Panel nicht erneut ausführen. Änderungen und erneute Läufe wirken sich nur aus, wenn du genau diese Antwort neu generierst. Ein erneuter Lauf nutzt den ursprünglichen Chatverlauf ab diesem Punkt, nicht die neueren Nachrichten.

## Verwandte Anleitungen

- [Agenten im Überblick](agents-overview.md)
- [Referenz der herunterladbaren Agenten](built-in-agents.md)
- [Charaktere anlegen und bearbeiten](../characters/creating-and-editing-characters.md)
