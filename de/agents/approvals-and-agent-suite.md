# Agent-Freigaben und die Agent Suite

Agenten können in deinen Chat schreiben: Lorebook-Einträge, Zusammenfassungen und Änderungen an Charakterkarten. In dieser Anleitung erfährst du, wie du diese Schreibvorgänge prüfst, bevor sie gespeichert werden, und wie du mit der **Agent Suite** liest und korrigierst, was Agenten gespeichert haben.

## Agent-Schreibvorgänge vor dem Speichern prüfen

Standardmäßig werden manche Schreibvorgänge von Agenten von selbst gespeichert. Mit **Review Agent Outputs** (Agent-Ausgaben prüfen) wartet jeder davon auf deine Freigabe.

1. Öffne den Chat und klick auf **Chat Settings** (Chat-Einstellungen).
2. Scroll zum Abschnitt **Agents**.
3. Öffne in einem Roleplay-Chat **Trackers Control** (Tracker-Steuerung). In einem Game-Chat überspringst du diesen Schritt.
4. Schalte **Review Agent Outputs** an.

Ist der Schalter an, warten Lorebook-Updates, Zusammenfassungs-Updates und andere prüfbare Ausgaben schreibender Agenten auf dich. Ist er aus, können Lorebook- und Zusammenfassungs-Updates automatisch gespeichert werden.

Änderungen an Charakterkarten fragen immer zuerst nach, selbst wenn **Review Agent Outputs** aus ist. Diese Abfrage lässt sich nicht abschalten.

### Ein Lorebook- oder Zusammenfassungs-Update prüfen

Schlägt ein Agent einen Schreibvorgang vor, öffnet sich ein Fenster mit dem Titel **Review Lorebook Update** oder **Review Summary Update**. Es zeigt den Namen des Agenten und ein Feld **Proposed Text** (vorgeschlagener Text), das du bearbeiten kannst. Bei Lorebook-Schreibvorgängen erinnert es dich außerdem daran, jeden Eintrag unter eine `###`-Überschrift zu setzen.

- **Accept** (übernehmen) speichert den Text samt deiner Änderungen.
- **Regenerate** (neu generieren) lässt nur diesen Agenten noch einmal laufen und liefert einen frischen Vorschlag.
- **Discard** (verwerfen) wirft den Vorschlag weg, ohne zu speichern.

Warten weitere Vorschläge, zeigt das Fenster, wie viele. Sobald du mit dem aktuellen fertig bist, öffnet es sich für den nächsten.

Ein Agent mit der Fähigkeit **Create character cards** (Charakterkarten erstellen) kann auch eine neue Charakterkarte vorschlagen. Dann öffnet sich ein Prüffenster mit dem Kartentext. Gespeichert wird erst, wenn du annimmst.

### Ein Charakterkarten-Update prüfen

Der Agent **Card Evolution Auditor** schlägt Änderungen an einer Charakterkarte vor, je nachdem, was im Roleplay passiert ist. In Conversation kann außerdem das eingebaute Tool `update_about_me` eine Änderung am öffentlichen About Me vorschlagen. Keiner der beiden ändert deine Karte eigenmächtig. Beide öffnen **Review Character Card Updates**.

Zu jeder vorgeschlagenen Änderung zeigt das Fenster das betroffene Kartenfeld, eine kurze Begründung, sofern der Agent eine liefert, einen Block **Before** (vorher) mit dem aktuellen Text und ein Feld **After** (nachher), das du bearbeiten kannst.

- **Approve** (freigeben) übernimmt die Änderungen. Die Zahl auf der Schaltfläche zeigt, wie viele davon greifen. Die Freigabe erhöht die Versionsnummer des Charakters und legt einen Eintrag in der Versionshistorie an.
- **Regenerate** lässt den Agenten noch einmal laufen und liefert neue Vorschläge.
- **Reject** (ablehnen) verwirft sie, ohne die Karte zu ändern.

Hat sich die Karte geändert, nachdem der Agent seinen Vorschlag geschrieben hat, wird die Änderung als veraltet markiert und abgedunkelt. Dann erscheint eine Schaltfläche **Override stale** mit der Anzahl. Nutze sie nur, wenn du diesen Text trotzdem willst. Marinara bittet dich um eine Bestätigung und hängt den veralteten Text dann an das Feld an, statt Text zu ersetzen, der nicht mehr passt.

## Gespeicherte Agentendaten ansehen und bearbeiten

Die **Agent Suite** zeigt alles, was die Agenten in diesem Chat gespeichert haben: Tracker-Daten wie die aktuelle Szene, die anwesenden Charaktere und die Persona-Werte, dazu die gespeicherten Ausgaben eigener Agenten. Damit behebst du einen falschen Namen, korrigierst einen Wert oder räumst wirren Text auf.

1. Öffne **Chat Settings** und scroll zu **Agents**.
2. Klick auf **Agent Suite**.
3. Wähl links einen Agenten aus der Liste.

Rechts erscheinen bearbeitbare Blöcke in bis zu drei Gruppen: **Stored Memory** (gespeichertes Gedächtnis), **Tracker Data** (nur bei Tracker-Agenten) und **Recent Outputs** (nur bei eigenen Agenten). Agenten ohne Tracker-Daten zeigen nur **Stored Memory**.

Jeder Block ist ein Text- oder JSON-Editor. JSON-Blöcke zeigen Zeilennummern und melden ungültiges JSON sofort. **Save** (Speichern) bleibt deaktiviert, bis sich das JSON parsen lässt. Um alle Tracker-Daten zu durchsuchen oder als Felder zu bearbeiten, klick in der Kopfzeile von **Tracker Data** auf **Open in State Editor**. Siehe [Der State Editor](../roleplay/hud-and-trackers.md#the-state-editor).

Hast du einen Block geändert, klick auf **Save**, um die Änderung zu behalten, oder auf **Reset** (zurücksetzen), um zum gespeicherten Wert zurückzukehren.

### Einen Block von der KI umschreiben lassen

1. Klick beim Block auf **AI Edit** (mit KI bearbeiten).
2. Willst du nur einen Teil ändern, markier diesen Text zuerst. Ohne Markierung wird der ganze Block umgeschrieben.
3. Gib eine Anweisung ein, zum Beispiel „korrigiere die verstümmelten Charakternamen, sie heißt Mira“.
4. Optional: Klick auf **Add Context** (Kontext hinzufügen), um Charakterkarten oder Lorebook-Einträge anzuhängen, damit die KI weiß, was die Daten bedeuten.
5. Wähl die Verbindung (den KI-Dienst und das Modell), die das Umschreiben übernimmt.
6. Klick auf **Rewrite** (umschreiben).

Das Ergebnis landet als ungespeicherter Entwurf im Block. Prüf es und wähl dann **Save** oder **Reset**.

- Laufen für diesen Chat noch Agenten, wartet das Speichern, bis sie fertig sind.
- **Clear memory** (Gedächtnis leeren) erscheint in **Stored Memory** nur, wenn der Agent Daten gespeichert hat. Es löscht auf einen Schlag alles, was dieser Agent für diesen Chat gespeichert hat, und lässt sich nicht rückgängig machen. Marinara bittet dich vorher um eine Bestätigung.
- Beim **Narrative Director** sind gespeicherte Spoiler verborgen. Über **Reveal spoilers** (Spoiler anzeigen) siehst und bearbeitest du sie.

## Zwischengespeicherte Prompt-Einfügungen ansehen

Bevor eine Antwort generiert wird, fügen manche schreibenden Agenten Text in den Prompt ein. Typisch ist das bei **Prose Guardian**, **Narrative Director** und eigenen Einfügungs-Agenten. Das Panel **Cached prompt injections** (zwischengespeicherte Prompt-Einfügungen) zeigt diesen Text für die letzte Antwort. Es ist eine Ansicht zur Fehlersuche.

Bevor du anfängst: Schalte **Debug mode** an (siehe [Agenten im Überblick](agents-overview.md#tell-whether-an-agent-ran)). Öffne in einem Roleplay-Chat den Tab **Injections** von **Agent activity** (Agentenaktivität). Siehe [Agent activity](../roleplay/getting-started.md#agent-activity).

Jede Einfügung kannst du aufklappen, um den Text zu lesen und zu bearbeiten. Über das Symbol **Save** behältst du deine Änderung, über das Symbol **Re-run** (erneut ausführen) schreibt dieser Agent eine frische Einfügung.

Einfügungen von **Knowledge Retrieval** und **Knowledge Router** lassen sich hier nicht erneut ausführen. Änderungen und erneute Läufe wirken sich nur aus, wenn du genau diese Antwort neu generierst. Ein erneuter Lauf nutzt den Chatverlauf bis zu diesem Punkt, nicht neuere Nachrichten.

## Verwandte Anleitungen

- [Agenten im Überblick](agents-overview.md)
- [Referenz der herunterladbaren Agenten](built-in-agents.md)
- [Charaktere anlegen und bearbeiten](../characters/creating-and-editing-characters.md)
