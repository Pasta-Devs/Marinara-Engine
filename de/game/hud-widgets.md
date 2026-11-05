# Game Mode: HUD-Widgets

HUD-Widgets sind kleine Panels am linken und rechten Rand des Spielbildschirms. Sie führen Dinge mit wie eine Lebensanzeige, einen Goldzähler oder das Vertrauen eines Verbündeten. HUD steht für Heads-up-Display. Jedes Spiel hat eigene Widgets, getrennt von den HUD-Trackern in Roleplay (siehe [Roleplay-HUD und Tracker](../roleplay/hud-and-trackers.md)).

Ein Spiel kann insgesamt bis zu 4 Widgets haben, beliebig auf die linke und die rechte Seite verteilt. Widgets kommen nur zum Einsatz, wenn **Custom HUD Widgets** (eigene HUD-Widgets) für das Spiel eingeschaltet ist. Im Einrichtungsassistenten ist die Option standardmäßig an. Der Game Master (GM) entwirft dann beim Aufbau deiner Welt einen Startsatz.

## Widget-Typen

Der GM wählt für jedes Widget, das er anlegt, einen Typ. Baust du Widgets von Hand, kannst du die Typen selbst wählen.

| Widget-Typ | Was es anzeigt |
| --- | --- |
| **Progress Bar** | Ein waagerechter Balken für einen Wert im Verhältnis zu einem Maximum, etwa Leben oder Ausdauer. |
| **Gauge** | Eine halbrunde Skala für einen Wert im Verhältnis zu einem Maximum. |
| **Relationship Meter** | Ein Balken mit Meilenstein-Markierungen und Beschriftung, passend für das Vertrauen eines NPC (Nicht-Spieler-Charakter) oder eine Bindung. |
| **Counter** | Eine große Zahl, etwa Gold, vergangene Tage oder erledigte Gegner. |
| **Stat Block** | Ein kleines Raster aus benannten Feldern mit Werten, etwa STR und DEX oder ein Statuswort. |
| **List** | Eine kurze Aufzählung mit Texteinträgen, etwa aktive Ziele. |
| **Inventory Grid** | Ein Raster aus Inventarplätzen, optional mit Kategorie-Tabs und Stückzahlen. |
| **Timer** | Eine Countdown-Uhr in Minuten und Sekunden, die live herunterlaufen kann. |

## Widgets vor dem Spielstart prüfen

Gibt es eigene Widgets, sitzt auf dem Spielbildschirm unter **Start Game** (Spiel starten) eine Schaltfläche **Review Starting Widgets** (Start-Widgets prüfen). Ein Klick darauf öffnet vor dem Start das Fenster **Review Starting Widgets**. Es listet jedes Start-Widget auf, damit du die Widgets anpassen kannst, bevor das Spiel sie festschreibt.

1. Drück bei einem Widget auf **Edit** (bearbeiten), um seine Startwerte zu ändern oder **Stat Block**-Felder umzubenennen.
2. Drück auf **Remove** (entfernen), um ein Widget zu verwerfen, das du nicht willst.
3. Drück auf **Start Game**, um mit den gezeigten Widgets loszuspielen. Mit **Back** (zurück) schließt du das Fenster, ohne zu starten.

Ein ähnliches Fenster, **Prepare Next Session Widgets** (Widgets für die nächste Sitzung vorbereiten), erscheint, wenn du in einem laufenden Spiel eine neue Sitzung beginnst. Es hat **Start Next Session** (nächste Sitzung starten) statt **Start Game** und **Cancel** (Abbrechen) statt **Back**.

## Ein Widget im laufenden Spiel bearbeiten

Der GM aktualisiert die Widget-Werte, während die Geschichte voranschreitet. Verpasst er eine Aktualisierung, korrigier das Widget von Hand.

1. Such das Widget-Panel am linken oder rechten Bildschirmrand.
2. Klick in der Kopfzeile des Widgets auf die Stift-Schaltfläche (**Edit**).
3. Ändere die Werte im Editor-Fenster, etwa den **Maximum value** (Maximalwert) bei einem Balken.
4. Klick auf **Save Changes** (Änderungen speichern).

Ein Klick auf die Kopfzeile des Widgets klappt seinen Inhalt zu oder auf.

## Panels verschieben und fixieren

Widget-Panels sind standardmäßig fixiert. Jedes hat ein Schloss-Symbol in der Kopfzeile.

1. Klick auf das Schloss-Symbol, um das Panel zu lösen. Eine zarte Umrandung zeigt, dass es sich bewegen lässt.
2. Zieh das Panel an eine neue Stelle.
3. Klick erneut auf das Schloss-Symbol, um es zu fixieren.

Um ein Panel an seinen Standardplatz zurückzubringen, doppelklick auf sein Schloss-Symbol oder drück <kbd>R</kbd>, während das Symbol den Fokus hat. Jedes Panel merkt sich Position und Sperrzustand pro Spiel. Dein Layout wird nicht in andere Spiele übernommen.

Am Handy erscheinen Widgets als kleine Pillen statt als volle Panels. Tipp auf eine Pille, um das Widget zu öffnen, und auf das X, um es zu schließen.

## Eigene Widgets bauen

Du kannst Widgets auch selbst entwerfen, statt sie den GM anlegen zu lassen. Den manuellen Editor öffnest du an einer dieser Stellen:

- Im Einrichtungsassistenten: Schalte **Custom HUD Widgets** ein und dann **Build Widget Setup** (Widget-Setup bauen). Der Editor erscheint darunter.
- In einem bestehenden Spiel: Öffne **Chat Settings** (Chat-Einstellungen) und dann den Bereich **Widgets**.

1. Wähl im Dropdown-Menü einen Widget-Typ und drück auf **Add** (hinzufügen).
2. Leg **Icon** (ein kurzes Symbol oder Emoji), **Label**, **Type**, **Side** (**Left HUD** oder **Right HUD**) und **Accent** (die Farbe) fest.
3. Füll die Felder des jeweiligen Typs aus: Ein Balken nutzt **Value** und **Max**, ein Zähler **Count**, ein Inventarraster **Slots** und **Contents** und ein Timer **Seconds** und **Running**.
4. Drück in den **Chat Settings** auf **Save Widgets** (Widgets speichern), um deine Änderungen zu übernehmen. **Reset** (zurücksetzen) macht ungespeicherte Bearbeitungen rückgängig.

Der Editor zeigt, wie viele der 4 erlaubten Widgets du schon verwendet hast.

## Widgets über Import und Export teilen

Ein Widget-Layout lässt sich in eine Datei speichern und in ein anderes Spiel laden. Der Einrichtungsassistent und der Bereich **Widgets** der **Chat Settings** haben beide diese Schaltflächen.

1. Drück auf **Export Widgets** (Widgets exportieren), um deine Widgets als JSON-Datei (ein reines Textdatenformat) herunterzuladen.
2. Drück in einem anderen Spiel auf **Import Widgets** (Widgets importieren) und wähl diese Datei aus.
3. Drück in den **Chat Settings** auf **Save Widgets**, damit die geladenen Widgets greifen.

## Verwandte Anleitungen

- [Game Mode: Erste Schritte](getting-started.md)
- [Roleplay-HUD und Tracker](../roleplay/hud-and-trackers.md)
