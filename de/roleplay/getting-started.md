# Roleplay Mode: Erste Schritte

In dieser Anleitung erfährst du, was Roleplay Mode ist, wie eine Rollenspielrunde startet und was auf dem Bildschirm passiert. Dazu kommen die Sprite-Steuerung, die Chat-Werkzeugleiste, **Author's Notes** (Autorennotizen) und Verweise auf die tiefergehenden Funktionen.

## Was Roleplay Mode ist

Roleplay Mode ist einer der Chat-Modi von Marinara Engine. Die anderen heißen Conversation und Game. Roleplay liefert dir eine Szenenansicht, die ganz auf eine Geschichte ausgerichtet ist.

Eine Roleplay-Szene kann ein Hintergrundbild, Charakter-Sprites und eine Info-Leiste mit dem Weltzustand zeigen. Ein Sprite ist ein Charakterbild auf der Bühne, das sich mit der Stimmung ändert. Diese Info-Leiste am oberen Chatrand heißt HUD.

Roleplay setzt außerdem auf Helfer, die Agenten heißen. Ein Agent ist eine kleine automatische Aufgabe, die parallel zur KI-Antwort läuft. Agenten führen den Weltzustand mit, wählen Sprites und Hintergründe aus und vieles mehr.

Für Roleplay Mode brauchst du keine Bildgenerierung. Ohne sie funktioniert der Modus weiterhin als reiner Text-Chat. Die Sprite-Plätze bleiben leer, der Hintergrund zeigt eine einfarbige Fläche, und das HUD führt trotzdem alles mit. Wie du eine Verbindung einrichtest, steht unter [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md).

Nimm Roleplay Mode, wenn du eine Szene zum Eintauchen willst. Für schlichtes Chatten wie in einem Messenger nimm [Conversation Mode](../conversation/getting-started.md). Für ein strukturiertes Rollenspiel mit Party, Kampf und Würfeln nimm [Game Mode](../game/getting-started.md).

## Eine Rollenspielrunde starten

Leg einen neuen Roleplay-Chat an, dann öffnet sich der Einrichtungsassistent. Er hat fünf Schritte. Nur die KI-Verbindung ist Pflicht. Alles andere ist optional und später änderbar.

1. **Name & Connection** (Name und Verbindung). Benenne die Rollenspielrunde und wähle die KI-Verbindung aus, die antwortet. Das Namensfeld darf leer bleiben.
2. **Pick a Preset** (Preset wählen). Ein Preset ist eine gespeicherte Prompt-Vorlage und steuert den Aufbau des Prompts sowie die Einstellungen für die Generierung. Für die meisten Chats passt das Standard-Preset.
3. **Persona & Characters** (Persona und Charaktere). Wähle die Persona, die du spielst, und die Charaktere, die in der Szene mitspielen.
4. **Attach Lorebooks** (Lorebooks anhängen). Ein Lorebook ist eine Sammlung von Weltwissen, die die KI liest, sobald bestimmte Schlüsselwörter auftauchen. Dieser Schritt ist optional.
5. **Enable Agents** (Agenten aktivieren). Wähle die Agenten aus, die in diesem Chat laufen. Später lassen sich Agenten unter **Chat Settings** (Chat-Einstellungen) im Bereich **Agents** ergänzen oder entfernen.

Sobald der Einrichtungsassistent durch ist, öffnet sich die Szene und du kannst die erste Nachricht schicken.

## Die Bühne: Hintergrund, Sprites und HUD

Die Roleplay-Bühne ist die Szenenfläche hinter und um die Nachrichten herum. Sie besteht aus drei Teilen.

Der **Hintergrund** ist ein bildschirmfüllendes Bild hinter der Nachrichtenspalte. Beim Wechsel blendet es weich über. Der Agent **Background** kann pro Zug einen Hintergrund aus der Bibliothek aussuchen. Möglich ist außerdem ein fester Hintergrund pro Chat. Das komplette Hintergrund-System beschreibt [Roleplay-Hintergründe](backgrounds.md).

**Sprites** sind die Charakterbilder auf der Bühne. Eine feste Obergrenze gibt es nicht. Jeder Charakter im Chat mit aktivierten Sprites kann erscheinen. Dafür braucht die Charakterkarte eine hochgeladene Sprite-Bibliothek. Fehlt sie, bleibt der Sprite-Platz leer. Wie Sprites zu einem Charakter kommen, steht unter [Charakter-Sprites](../characters/sprites.md).

Das **HUD** ist eine Reihe kleiner Widgets am oberen Chatrand. Jedes Widget gehört zu einem Tracker – einem Agenten, der Werte mitführt. Ein Widget erscheint also nur, wenn sein Agent läuft. Widgets zeigen Datum, Uhrzeit, Wetter, Ort, anwesende Charaktere, Inventar, Quests und Werte. Klick auf ein Widget, um ein Panel zu öffnen und die Werte zu bearbeiten. Alle Widgets und Sperrmodi erklärt [Roleplay-HUD und Tracker](hud-and-trackers.md).

### Steuerung der Sprite-Darstellung

Die Sprite-Steuerung findest du unter **Chat Settings** im Bereich **Agents** auf der Karte **Expression Engine**. Sie taucht auf, sobald mindestens ein Charakter Sprites aktiviert hat.

- **Sprite Source** (Sprite-Quelle). Ein Schalter mit **Expressions** und **Full-body**. Wähle eins von beiden oder beides. Mindestens eine Option muss aktiv bleiben.
- **Expression Size**, **Full-body Size**, **Expression Opacity** und **Full-body Opacity**. Vier Regler für Größe und Durchsichtigkeit der Sprites. Diese Einstellungen bleiben in diesem Browser und wandern nicht auf andere Geräte.
- **Default Side** (Standardseite). Ein Schalter zwischen **Left** und **Right**, der festlegt, auf welcher Seite neue Sprites starten.
- **Expression Avatars**. Aktiviert übernehmen die Avatare im Chatverlauf das aktuelle Gesichtsausdruck-Sprite des Charakters.

Sprites lassen sich auch von Hand verschieben: Klick auf der Bühne auf die Schaltfläche **Arrange** (anordnen). Solange sie aktiv ist, heißt sie **Done**. Zieh ein Sprite an die gewünschte Stelle und bestätige mit dem kleinen Haken darüber. Klick zum Abschluss auf **Done**. Die Schaltfläche **Reset** verwirft alle eigenen Platzierungen.

Einen Gesichtsausdruck kannst du auch per **/emote** im Chatfeld setzen. Zwei Schreibweisen funktionieren:

```
/emote happy
```

```
/emote "Aria" angry
```

Die erste Form setzt den Gesichtsausdruck für die Szene. Die zweite spricht einen bestimmten Charakter an. Tipp **/emote** ohne weitere Angaben ein, dann erscheinen die verfügbaren Gesichtsausdrücke für jeden Charakter in der Szene.

## Die Chat-Werkzeugleiste

Die Werkzeugleiste sitzt oben im Chatbereich. Ihre Schaltflächen öffnen kleine Einblendfenster, sogenannte Popovers. Die wichtigsten sind:

- **Chat Summary** (Chat-Zusammenfassung). Zeigt die laufende Zusammenfassung des Chats und lässt sie bearbeiten.
- **Active Context** (aktiver Kontext). Listet die verknüpften Charaktere, Lorebook-Einträge und das Preset auf, die in die letzte Antwort geflossen sind. Dabei siehst du, welche Lorebook-Einträge gegriffen haben und eingefügt wurden.
- **Author's Notes**. Eine freie Notiz, die in jedem Zug in den Prompt wandert. Mehr dazu unten.
- **Gallery** (Galerie). Öffnet die Bild- und Videogalerie des Chats, in der sich eine Illustration oder ein Hintergrund generieren lässt.
- **Chat Settings**. Öffnet das vollständige Einstellungs-Panel für diesen Chat.

### Author's Notes

**Author's Notes** ist eine Notiz von dir, die die KI bei jeder Generierung mitliest. Nutze sie für dauerhafte Hinweise, etwa eine Regel zum Tonfall oder eine verborgene Tatsache. Öffne sie über die Stift-Schaltfläche in der Werkzeugleiste.

Schreib die Notiz in das Feld. Zum Beispiel: „Halte den Ton düster und spannungsgeladen. Der Bösewicht ist insgeheim ein Verbündeter.“

Darunter liegt das Zahlenfeld **Injection Depth**. Es legt fest, wie weit oben im Chatverlauf die Notiz landet. Die Hilfe in der App sagt: „Depth 0 = after the latest message, 4 = four messages from the end.“ Bei Tiefe 0 sitzt die Notiz am dichtesten an der neuesten Antwort.

**Author's Notes** funktioniert in Game Mode und Conversation Mode genauso. Diese Anleitung ist die zentrale Referenz dazu.

## Das Menü „Agents & Actions“

Die Funkel-Schaltfläche in der HUD-Zeile öffnet das Menü **Agents & Actions** (Agenten und Aktionen). Der Tab **Activity** listet die Ausgaben der Agenten auf, die sogenannten Gedankenblasen. Einzelne Blasen lassen sich ausblenden, **Clear all** räumt alle auf einmal weg. Auch die Ausgaben eigener Agenten erscheinen hier.

Ist ein Agent im letzten Zug gescheitert, erscheint eine Fehlerliste samt Schaltfläche zum erneuten Versuch. Über dieses Menü lassen sich auch alle Tracker erneut ausführen. Eine leicht verständliche Tour durch das gesamte Agenten-System bietet [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md).

Ein Tab **Injections** erscheint nur bei aktiviertem **Debug mode** (Debug-Modus). Aktivieren kannst du ihn unter **Settings** (Einstellungen) im Bereich **Advanced**. Der Tab zeigt die Prompt-Schnipsel, die schreibende Agenten vor der letzten Antwort gespeichert haben. Zu diesen Agenten zählen **Prose Guardian**, der Antworten an deine Stilregeln anpasst, und der **Narrative Director**, der die Handlung lenkt.

Gespeicherte Schnipsel lassen sich ansehen, bearbeiten und erneut ausführen. Eine Bearbeitung wirkt nur auf das, was beim erneuten Generieren derselben Antwort verwendet wird. Die Antwort auf dem Bildschirm bleibt unverändert. So bleibt das neue Generieren nachvollziehbar und wiederholbar.

Der Narrative Director bringt die Schaltfläche **Push Story** über dem Chatfeld mit. Sie aktiviert den Director nur für die nächste Antwort. Der Narrative Director kann außerdem einen verborgenen Langzeit-Handlungsbogen führen, den **Secret Plot**. Beides beschreibt [Narrative Director und Secret Plot](narrative-director.md).

## Unterbrechungen durch Charaktere

Aktiviere unter **Chat Settings → Agents → Roleplay Commands** die Option **Interruptions** (Unterbrechungen), damit Charaktere die letzte Nachricht bei einem plausiblen verbalen oder körperlichen Eingreifen abbrechen können. Die Funktion ist zunächst ausgeschaltet und benötigt keinen herunterladbaren Agenten.

Das Modell verwendet `[interrupt: part="a verbatim phrase of at least three words"]`. Marinara sucht diese wörtliche Phrase nur in der Nachricht unmittelbar vor der Antwort, behält den Text bis einschließlich der Phrase und ersetzt das Ende durch einen Unterbrechungsstrich. Dialog behält sein schließendes Anführungszeichen; Aktionen erhalten keines. Fehlt eine eindeutige Übereinstimmung, bleibt die Nachricht unverändert.

Öffne die Befehlsinformationen der Antwort und wähle **Restore original message** (Originalnachricht wiederherstellen), um die ursprüngliche Nachricht zurückzuholen. Eine Neugenerierung stellt zuerst die vollständige ursprüngliche Eingabe wieder her, damit die neue Antwort selbst über eine Unterbrechung entscheiden kann. Die Auswahl einer vorhandenen Variante wendet deren Unterbrechung an, sofern du sie nicht ausdrücklich wiederhergestellt hast. Spätere manuelle Änderungen bleiben erhalten und werden nicht von einer alten Unterbrechung überschrieben.

## Echo Chamber

**Echo Chamber** ist ein optionaler Agent, der ein Live-Publikum in die Szene holt. Das Ganze funktioniert wie ein Streaming-Chat, der in festen Zeitabständen neue Reaktionen einblendet. Aktivieren kannst du ihn unter **Chat Settings** im Bereich **Agents** auf der Karte **Echo Chamber**. Das Panel schwebt über der Szene und lässt sich zu einer kleinen Leiste einklappen.

## CYOA-Auswahlmöglichkeiten

**CYOA** steht für Choose Your Own Adventure, also „Wähle dein eigenes Abenteuer“. Der Agent **CYOA Choices** ist standardmäßig aus. Aktiviert ergänzt er nach einer Antwort anklickbare Auswahl-Schaltflächen. Ein Klick darauf schickt die Auswahl als deine nächste Nachricht ab. Das funktioniert ausschließlich in Roleplay Mode.

## Kampfbegegnungen

Roleplay Mode bringt eine schlanke Kampfebene mit. Aktiviere den Agenten **Combat** und klick dann auf die Schaltfläche **Encounter** über dem Chatfeld (ihr Tooltip – ein Kurzhinweis beim Draufzeigen – lautet „Start Combat Encounter“). Es öffnet sich erst ein Einrichtungsfenster, dann ein Kampfbildschirm mit Lebensbalken und Aktions-Schaltflächen. Der Kampf in Game Mode ist davon unabhängig. Den kompletten Ablauf beschreibt [Kampfbegegnungen (Roleplay)](combat-encounters.md).

## Szenen

Eine **Szene** ist eine Nebenverzweigung einer Rollenspielrunde. Nutze sie für eine Rückblende, einen Nebenschauplatz oder einen alternativen Weg, ohne den Hauptstrang zu verlieren. Eine Szene zieht keinen Kontext aus einer verbundenen Conversation – auch dann nicht, wenn die übergeordnete Rollenspielrunde das tut. Mehr dazu unter [Szenen: eine Rollenspielrunde verzweigen](scenes.md).

## Modelle auswählen

Für Roleplay Mode reichen die Standardwerte gut aus. Zwei allgemeine Tipps helfen in den meisten Fällen.

Die Chat-Verbindung schreibt die Prosa der Charaktere. Ein Modell der Mittelklasse oder besser hält die Erzählstimme über lange Szenen hinweg stabil. Die Agent-Verbindungen erledigen kleine, strukturierte Aufgaben – etwa den Zustand auslesen oder einen Gesichtsausdruck wählen. Sehr schwache Modelle liefern hier gern falsche Zustände oder unpassende Sprites.

Für Agenten darf ein günstigeres Modell laufen als für den Chat. Viele Nutzende kombinieren ein starkes Modell im Chat mit einem schnellen, günstigen für die Agenten. Wenn HUD-Werte oder Sprites dauerhaft danebenliegen, stell die Agent-Verbindung auf ein leistungsfähigeres Modell um. Zu den Sampler-Einstellungen siehe [Generierungsparameter](../prompts/generation-parameters.md).

## Fehlerbehebung

**Ein HUD-Widget zeigt den falschen Wert.** Jedes Widget wird von einem Tracker gefüllt. Öffne das Widget-Panel und korrigiere den Wert von Hand. Driften die Werte immer wieder ab, stell die Agent-Verbindung auf ein stärkeres Modell um. Alternativ sperrst du ein Feld, damit der nächste automatische Durchlauf es nicht überschreibt.

**Die Gesichtsausdrücke der Sprites ändern sich nicht.** Prüf, ob der Charakter eine hochgeladene Sprite-Bibliothek hat. Bildgenerierung brauchst du nur, wenn Marinara neue Sprites erzeugen soll. Ohne Sprites läuft der Agent zwar, hat aber nichts zum Anzeigen. Einen Gesichtsausdruck kannst du auch von Hand über **/emote** setzen.

**Der Hintergrund wechselt nie.** Der Agent **Background** wählt aus der Hintergrund-Bibliothek aus. Bei nur ein oder zwei Hintergründen landet er immer wieder bei denselben. Leg weitere Hintergründe an, damit der Agent mehr Auswahl hat. Siehe [Roleplay-Hintergründe](backgrounds.md).

**Eine neu generierte Antwort schlägt weiter die falsche Richtung ein.** Aktiviere **Debug mode** unter **Settings** im Bereich **Advanced**. Öffne das Menü **Agents & Actions**, geh auf den Tab **Injections** und bearbeite oder wiederhole den gespeicherten Schnipsel, bevor du neu generierst. Weitere Hilfe bietet [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md).

## Verwandte Anleitungen

- [Roleplay-Hintergründe](backgrounds.md)
- [Roleplay-HUD und Tracker](hud-and-trackers.md)
- [Kampfbegegnungen (Roleplay)](combat-encounters.md)
- [Narrative Director und Secret Plot](narrative-director.md)
- [Szenen: eine Rollenspielrunde verzweigen](scenes.md)
- [Charakter-Sprites](../characters/sprites.md)
- [Eine Conversation mit einem Roleplay oder Game verbinden](../chats/connected-chats.md)
- [Makros](../prompts/macros.md)
