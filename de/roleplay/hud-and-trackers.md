# Roleplay-HUD und Tracker

In dieser Anleitung erfährst du, was das Roleplay-HUD ist und welche kleinen Tracker-Widgets es anzeigt. Du lernst, wie du deren Werte bearbeitest und sperrst und wie das größere Tracker Panel funktioniert. Alles hier gilt für den Roleplay Mode in Marinara Engine.

## Was das HUD ist

Das HUD (heads-up display, eine Info-Leiste am oberen Rand des Chatbereichs) ist eine Reihe kleiner Symbol-Widgets. Jedes Widget zeigt einen Ausschnitt des aktuellen Geschehens: die Uhrzeit, deine Werte oder die anwesenden Charaktere. Marinara hält diese Angaben automatisch aktuell, während die Geschichte weiterläuft.

Die Werte stammen von Tracker-Agenten. Ein Agent ist ein kleiner KI-Helfer, der im Hintergrund läuft. Jeder Tracker-Agent verfolgt die Geschichte und aktualisiert nach jeder Nachricht einen Teil des HUD. Du musst nichts anstoßen.

Ein Widget erscheint nur, wenn sein Tracker-Agent für den Chat aktiviert ist. Agenten schaltest du in **Chat Settings** (Chat-Einstellungen) im Bereich **Agents** ein und aus. Ist kein Tracker-Agent aktiv, zeigt das HUD nur die Schaltfläche **Agents & Actions** und sonst nichts.

## Die HUD-Widgets

Es gibt sieben Tracker-Widgets. Jedes braucht seinen eigenen aktivierten Agenten, um zu erscheinen.

| Widget                 | Braucht diesen Agenten | Zeigt                                                                                     |
| ---------------------- | ----------------- | -------------------------------------------------------------------------------- |
| **World State**        | World State       | Ort, Datum, Uhrzeit, Wetter, Temperatur und deine eigenen Weltzustand-Felder      |
| **Persona Stats**      | Persona Stats     | Die Statusbalken deiner Persona sowie eine Statuszeile                            |
| **Present Characters** | Character Tracker | Wer in der Szene ist – samt Stimmung, Aussehen und charakterspezifischen Feldern  |
| **Inventory**          | Persona Stats     | Gegenstände, die du bei dir trägst, mit Stückzahl                                 |
| **Inventory Tracker**  | Inventory Tracker | Getrennte Listen für Währungen, angelegte Ausrüstung und getragene Gegenstände   |
| **Active Quests**      | Quest Tracker     | Dein aktuelles Ziel                                                               |
| **Custom Tracker**     | Custom Tracker    | Selbst benannte Felder, etwa Zähler oder eine Währung                             |

Beachte: Das Widget **Inventory** wird von demselben Agenten **Persona Stats** gespeist, der auch das Widget **Persona Stats** füllt. Aktiviere **Persona Stats**, und du bekommst beide.

Der eigenständige **Inventory Tracker** ist unabhängig vom Inventar der Persona Stats. Er führt kompakte Einträge aus Name und Stückzahl in drei Gruppen – **Currencies**, **Equipped** und **Inventory** – und verhindert, dass angelegte Ausrüstung zusätzlich im getragenen Inventar auftaucht.

Jeder Eintrag ist eine kleine Pille. Die Pillen laufen über die Breite des Panels und brechen in die nächste Zeile um, sodass eine lange Inventarliste lesbar bleibt, statt sich zu einer hohen Spalte zu strecken. Eine Stückzahl steht nur dabei, wenn sie größer als eins ist, und zwar als `×4` hinter dem Namen; bei einem einzelnen Gegenstand steht nur der Name. In einem schmalen Panel stehen die Pillen einzeln untereinander.

Um eine Stückzahl zu ändern, die gerade eins ist, schalte den Hinzufügen-Modus oder den Sperrmodus ein – beide blenden bei jedem Eintrag das Feld für die Stückzahl ein.

Das Widget **Present Characters** zeigt bis zu drei Charakter-Emoji und dahinter ein „+N“ für alle weiteren. Die Widgets **Inventory** und **Custom Tracker** blättern ihre Einträge nacheinander durch.

## Werte im Popover bearbeiten

Klick auf ein beliebiges Widget, um sein Popover zu öffnen. Ein Popover ist ein kleines Einblendfenster. Jedes Feld darin lässt sich bearbeiten, sodass du einen falsch geratenen Wert der KI korrigieren kannst. Änderungen werden sofort gespeichert.

Diese Angaben lassen sich pro Popover bearbeiten:

- **World State**: **Location**, **Date**, **Time**, **Weather**, **Temperature** sowie die Zeilen eigener Weltzustand-Felder.
- **Persona Stats**: eine **Status**-Zeile und benannte Statusbalken mit aktuellem Wert und Maximalwert. Balken lassen sich hinzufügen und entfernen.
- **Present Characters**: Charaktere hinzufügen oder entfernen und je Charakter Emoji, Name, **Mood**, **Look**, **Outfit**, **Thinks** (private Gedanken) und eigene Feldwerte bearbeiten. Pro Charakter lässt sich ein Avatar hochladen. Die Schaltfläche **Auto** schaltet zwischen „Auto-generate avatars: ON“ und „Auto-generate avatars: OFF“ um.
- **Inventory**: Gegenstände hinzufügen oder entfernen und Name sowie Stückzahl bearbeiten.
- **Inventory Tracker**: Einträge unter **Currencies**, **Equipped** und **Inventory** hinzufügen oder entfernen und jeweils Name oder Stückzahl bearbeiten. Einen Gegenstand zwischen zwei Gruppen zu verschieben, geht noch nicht in einem Schritt – entferne ihn aus der einen Gruppe und füge ihn der anderen hinzu.
- **Active Quests**: Quests hinzufügen oder entfernen. Jede Quest hat benannte Ziele mit Kontrollkästchen zum Abhaken.
- **Custom Tracker**: Name-Wert-Felder hinzufügen, entfernen oder bearbeiten.

## Der Sperrmodus

Die Tracker-Agenten überschreiben die HUD-Werte nach jedem Zug. Das ist meistens praktisch. Manchmal driftet ein Wert aber immer wieder in die falsche Richtung, und du willst ihn von Hand festnageln. Genau dafür gibt es den Sperrmodus.

Ein gesperrtes Feld bleibt beim nächsten automatischen Tracker-Durchlauf unangetastet. Gesperrte Felder sind markiert, du erkennst sie also auf einen Blick.

So sperrst du ein Feld:

1. Öffne das Popover des Widgets.
2. Klick auf den Schalter mit dem Schloss oben im Popover. Sein Tooltip (Kurzhinweis beim Draufzeigen) lautet **Enter lock mode**.
3. Neben jedem bearbeitbaren Wert erscheint nun eine kleine Schloss-Schaltfläche.
4. Klick auf das Schloss neben dem Wert, den du festhalten willst. Der Tooltip dazu lautet **Lock field**.

Zum Entsperren klickst du dieselbe Schaltfläche erneut an (Tooltip **Unlock field**). Den Sperrmodus verlässt du über den Schalter oben (Tooltip **Exit lock mode**). Der Sperrmodus gilt für das gesamte HUD: Schaltest du ihn in einem Popover ein, tauchen die Schloss-Schaltflächen überall auf.

## Einen Tracker erneut laufen lassen

Du kannst einen Tracker sofort aktualisieren, statt auf die nächste Nachricht zu warten.

In jedem Popover sitzt eine kleine Schaltfläche zum Aktualisieren (Pfeil im Kreis). Ein Klick darauf lässt genau diesen einen Tracker für den letzten Zug erneut laufen. Die Tooltips nennen den jeweiligen Tracker beim Namen, etwa **Re-run world state tracker only** oder **Re-run quest tracker only**.

Unter **Chat Settings → Agents** stellt **Manual Trackers** sämtliche aktivierten Tracker auf manuelle Steuerung um. Alternativ lässt du diesen Schalter aus und setzt unter **Individual tracker schedule** nur einzelne Agenten auf manuell. Sobald mindestens ein Tracker manuell läuft, erscheint in der HUD-Zeile eine Schaltfläche zum Aktualisieren; ein Klick darauf startet alle manuellen Tracker für den aktuellen Zug. Die Schaltfläche im jeweiligen Tracker-Popover startet weiterhin nur diesen einen Tracker.

Das Funkel-Symbol am Anfang der HUD-Zeile öffnet das Menü **Agents & Actions**. Von dort lässt du alle Tracker erneut laufen, wiederholst fehlgeschlagene Agenten oder löschst mit **Clear Trackers** den kompletten getrackten Weltzustand des Chats. **Clear Trackers** lässt sich nicht rückgängig machen – sei damit vorsichtig.

## Das Tracker Panel

Das **Tracker Panel** ist ein größeres Panel an der Seite und zeigt dieselben Tracker-Daten wie die kompakten HUD-Widgets. Die Tracker-Karten bekommen darin mehr Platz, dazu kommen Porträts und Gedanken. Eingerichtet wird es unter **Settings** (Einstellungen) im Tab **Appearance** im Abschnitt **Tracker Panel**.

Über die Bedienelemente in der Panel-Kopfzeile passt du außerdem den Aufbau der Tracker an:

- Klick auf **+**, um in den Hinzufügen-Modus zu wechseln. Der Bereich World bekommt dann **Add world field**, jede Karte eines anwesenden Charakters **Add custom field**. Die Feldnamen bleiben auch im normalen Modus sichtbar, damit die Werte immer verständlich sind.
- Klick auf das Papierkorb-Symbol, um in den Lösch-Modus zu wechseln, und entferne dort eigene Welt- oder Charakterfelder. Mit dem Feld verschwinden auch die dafür gespeicherten Feldsperren.
- Klick auf das Schloss-Symbol, um in den Sperrmodus zu wechseln. Für eigene Feldwerte gelten dieselben Sperrregeln wie für die eingebauten Tracker-Werte.
- Klick auf das durchgestrichene Augen-Symbol, um in den Ausblenden-Modus zu wechseln, und wähle auf einer Charakterkarte **Mood**, **Look**, **Outfit** oder **Thoughts**. Ausgeblendete Felder verschwinden aus dem Tracker Panel und dem Roleplay-HUD, werden geleert und bleiben gesperrt, damit die Tracker-Agenten sie nicht wieder befüllen. Ein erneuter Wechsel in den Ausblenden-Modus holt ein verstecktes Feld als leeres Feld zurück.

Die Namen eigener Felder legen den Aufbau fest und bleiben über alle Tracker-Durchläufe hinweg stabil. Die Tracker-Agenten aktualisieren die Werte, sobald die Geschichte sie verändert; lässt ein Agent ein Feld in seiner Ausgabe weg, bleibt dein Feld trotzdem erhalten.

Diese Einstellungen steuern das Panel:

- **Tracker Panel**: der Hauptschalter zum Ein- und Ausschalten. Er ist standardmäßig an. Ist er an, lautet die Beschriftung „Shown in the Roleplay HUD“.
- **Replace tracker HUD icons**: blendet die kompakte Symbolleiste aus, damit das Panel stattdessen am Bildschirmrand andocken kann. Die Schaltfläche **Agents & Actions** bleibt sichtbar.
- **Use expression sprites for tracker portraits**: lässt die Tracker-Porträts das Ausdrucks-Sprite eines Charakters verwenden – also sein Porträt zur aktuellen Stimmung – statt des schlichten Avatars, sofern eines vorhanden ist. Ausdrucks-Sprites erklärt der Artikel [Charakter-Sprites](../characters/sprites.md).
- **Panel background**: eine Auswahl an Farben und Verläufen für den Hintergrund des Panels.
- **Desktop size**: legt die Breite des Panels fest. Zur Wahl stehen **Compact**, **Standard** und **Expanded**.
- **Thought display mode**: legt fest, wie die Gedanken eines Charakters erscheinen. **Docked** öffnet sie in der Charakterkarte. **Floating** zeigt sie als Blase neben dem Porträt.
- **Always show Docked thoughts**: hält bei **Thought display mode** auf **Docked** den Gedanken jedes hervorgehobenen Charakters dauerhaft sichtbar, statt ihn hinter einer Schaltfläche zu verstecken.
- **Temperature unit**: schaltet die Temperaturanzeige zwischen **Celsius** und **Fahrenheit** um. Standard ist Celsius. Das ändert nur die Anzeige, nicht den gespeicherten Weltzustand-Wert.

## Welche Agenten das HUD füllen

Hinter jedem HUD-Widget steckt ein Tracker-Agent, der nach jedem Zug läuft. Welcher Agent welches Widget speist, steht in der Widget-Tabelle am Anfang dieser Anleitung.

Welche Statusbalken und RPG-Attribute eine Persona oder ein Charakter zu Beginn mitbringt, legst du im Tab **Stats** im Charakter- oder Persona-Editor fest. Die Tracker-Agenten passen diese Werte dann im Lauf der Geschichte an.

## Verwandte Anleitungen

- [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md)
- [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md)
- [Charakterfarben und RPG-Werte](../characters/colors-and-stats.md)
- [Roleplay Mode: Erste Schritte](getting-started.md)
- [Game Mode: HUD-Widgets](../game/hud-widgets.md)
