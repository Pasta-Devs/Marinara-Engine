# Roleplay-HUD und Tracker

Das HUD (Heads-up-Display) zeigt in einem Roleplay-Chat aktuelle Details zur Geschichte: die Uhrzeit, das Wetter, wer anwesend ist, deine Werte, deine Gegenstände und deine Quests. Du kannst jeden Wert von Hand korrigieren, einen Wert sperren, damit die KI ihn nicht mehr ändert, und einen Tracker bei Bedarf erneut laufen lassen.

Die Werte stammen von Tracker-Agenten. Ein Agent ist ein Helfer, der neben den Antworten mitläuft. Ein Tracker-Agent verfolgt die Geschichte und aktualisiert nach jeder Nachricht einen Teil des HUD. Ein Widget erscheint nur, wenn sein Agent für den Chat eingeschaltet ist.

## Das HUD einschalten

1. Öffne **Chat Settings** (Chat-Einstellungen) über die Schieberegler-Schaltfläche im Chat.
2. Geh zu **Agents** und schalte **Enable Agents** (Agenten aktivieren) ein.
3. Füg die Agenten aus den Listen unter dem Schalter hinzu. Für ein einfaches HUD fügst du zuerst **World State** hinzu. Für mehr kommen **Persona Stats**, **Character Tracker** oder **Quest Tracker** dazu.
4. Schick eine Nachricht ab.

Nach der Antwort erscheint der Tracker. Am Telefon siehst du die Schaltfläche **World State**. Am Computer siehst du das **Tracker Panel** oder das Fenster **Trackers** (siehe unten). Welcher Agent welches Widget füllt, steht in der Widget-Tabelle.

Wenn es nicht funktioniert hat: Ist kein Tracker-Agent eingeschaltet, zeigt das HUD keine Widgets. Prüf, ob **Enable Agents** an ist.

## Wo das HUD erscheint

Am Telefon sind die Tracker die verschiebbaren Schaltflächen **World State** und **Player & Tracker**. Tippe auf eine, um ihr Panel zu öffnen, und auf **X**, um es zu schließen. Sobald World State Angaben hat, zeigt seine Schaltfläche ein kleines Banner mit Ort, Tag, Uhrzeit, Wetter und Temperatur. Zieh die Schaltflächen an eine beliebige Stelle. Dein Chat merkt sich, wo du sie abgelegt hast. Sie folgen deinem **Chat widget style** (Chat-Widget-Stil) unter **Settings → Appearance → App** (Einstellungen → Darstellung → App).

Am Computer erscheinen dieselben Tracker an einer von zwei Stellen:

- Das **Tracker Panel**: ein Seitenpanel neben deinen Nachrichten. Es ist standardmäßig an. Die Würfel-Schaltfläche in der Titelleiste von **Chat Settings** schaltet es ein und aus.
- Das Fenster **Trackers**: ein verschiebbares Fenster, das die Tracker aufnimmt, wenn das Tracker Panel aus ist.

Du nutzt immer nur eines von beiden. Siehe [Das Tracker Panel](#the-tracker-panel) und [Das Trackers-Fenster](#the-trackers-window).

## Die HUD-Widgets

| Widget | Braucht diesen Agenten | Zeigt |
| --- | --- | --- |
| **World State** | World State | Ort, Datum, Uhrzeit, Wetter, Temperatur und deine eigenen Weltfelder |
| **Persona Stats** | Persona Stats | Die Statusbalken deiner Persona und eine Statuszeile |
| **Present Characters** | Character Tracker | Wer in der Szene ist, mit Stimmung, Aussehen und eigenen Feldern |
| **Inventory** | Persona Stats | Gegenstände, die du mitführst, mit Stückzahl |
| **Inventory Tracker** | Inventory Tracker | Getrennte Listen für Währungen, angelegte Ausrüstung und mitgeführte Gegenstände |
| **Active Quests** | Quest Tracker | Dein aktuelles Ziel |
| **Custom Tracker** | Custom Tracker | Deine eigenen benannten Felder, etwa Zähler oder eine Währung |

Das Widget **Inventory** stammt vom Agenten **Persona Stats**; schalte ihn also ein, um beide zu bekommen. Der **Inventory Tracker** ist davon getrennt. Er führt Einträge in drei Gruppen, **Currencies**, **Equipped** und **Inventory**, und listet angelegte Ausrüstung nie doppelt auf.

Jeder Eintrag ist eine kleine Pille. Eine Stückzahl erscheint nur, wenn sie größer als eins ist, und zwar als `×4`. Um eine Stückzahl von eins zu ändern, schalte den Hinzufügen-Modus oder den Sperrmodus ein: Beide blenden bei jedem Eintrag das Feld für die Stückzahl ein. Der Hinzufügen-Modus ist die Schaltfläche **+** in der Kopfzeile des Tracker Panels. Der [Sperrmodus](#lock-mode) ist weiter unten erklärt.

**Present Characters** zeigt bis zu drei Charakter-Emoji und dazu eine Zahl „+N“. **Inventory** und **Custom Tracker** zeigen ihre Einträge nacheinander.

## Einen Tracker-Wert bearbeiten

Jedes Feld lässt sich bearbeiten, sodass du einen Wert korrigieren kannst, den die KI falsch erfasst hat. Deine Änderung wird sofort gespeichert. Die nächste Antwort geht von deinem korrigierten Wert aus, auch wenn du die korrigierte Antwort neu generierst oder per Swipe eine alternative Antwort wählst.

1. Öffne den Tracker: Tippe am Telefon auf seine Schaltfläche, oder öffne am Computer seinen Abschnitt im Tracker Panel oder im Trackers-Fenster.
2. Klick auf den Wert und gib den neuen ein.

- **World State**: **Location**, **Date**, **Time**, **Weather**, **Temperature** und eigene Weltfelder.
- **Persona Stats**: eine Zeile **Status** und benannte Balken mit aktuellem Wert und Maximalwert. Balken lassen sich hinzufügen und entfernen.
- **Present Characters**: Charaktere hinzufügen oder entfernen. Emoji, Name, **Mood**, **Look**, **Outfit**, **Thinks** (private Gedanken) und eigene Felder jedes Charakters bearbeiten. Für jeden lässt sich ein Avatar hochladen. Die Schaltfläche **Auto** schaltet „Auto-generate avatars“ ein oder aus.
- **Inventory**: Gegenstände hinzufügen oder entfernen. Namen und Stückzahlen bearbeiten.
- **Inventory Tracker**: Einträge unter **Currencies**, **Equipped** und **Inventory** hinzufügen oder entfernen. Um einen Gegenstand in eine andere Gruppe zu verschieben, entferne ihn und füge ihn dort hinzu.
- **Active Quests**: Quests hinzufügen oder entfernen. Jede Quest hat Ziele mit Kontrollkästchen.
- **Custom Tracker**: Felder mit Name und Wert hinzufügen, entfernen oder bearbeiten.

Um viele Werte auf einmal zu korrigieren, nutze den [State Editor](#the-state-editor).

<a id="lock-mode"></a>

## Der Sperrmodus

Tracker-Agenten überschreiben die HUD-Werte nach jedem Zug. Mit dem Sperrmodus hältst du einen Wert fest. Ist ein Feld gesperrt, lässt der nächste automatische Durchlauf es unangetastet. Nutze ihn, wenn ein Wert immer wieder in die falsche Richtung driftet.

1. Öffne den Tracker.
2. Klick auf den Schalter mit dem Schloss oben im Tracker (Tooltip **Enter lock mode**). Neben jedem bearbeitbaren Wert erscheint eine kleine Schloss-Schaltfläche.
3. Klick auf die Schloss-Schaltfläche neben dem Wert (Tooltip **Lock field**). Gesperrte Felder sind markiert.

Zum Entsperren klickst du dieselbe Schaltfläche erneut (**Unlock field**). Um den Sperrmodus zu verlassen, klick erneut auf den Schalter oben (**Exit lock mode**). Der Sperrmodus gilt für das gesamte HUD: Schaltest du ihn in einem Tracker ein, erscheinen die Schloss-Schaltflächen überall.

## Einen Tracker erneut laufen lassen

Um einen Tracker sofort zu aktualisieren, statt auf die nächste Nachricht zu warten, klick auf die Schaltfläche mit dem Pfeil im Kreis darin. Sie lässt nur diesen Tracker für den letzten Zug erneut laufen. Der Tooltip nennt den Tracker, zum Beispiel **Re-run world state tracker only**.

Damit ein Tracker nur auf deine Anforderung läuft, öffne **Chat Settings → Agents → Trackers Control** (Chat-Einstellungen → Agenten → Tracker-Steuerung) und schalte den Tracker unter **Individual tracker schedule** (Zeitplan pro Tracker) ein. Ein manueller Tracker läuft nicht nach jeder Antwort. War in einem Chat der alte Schalter **Manual Trackers** an, sind dort alle Tracker eingeschaltet.

Solange mindestens ein Tracker manuell läuft, erscheint eine Schaltfläche zum Aktualisieren: am Telefon in der HUD-Zeile, am Computer neben dem Titel des Trackers-Fensters. Klick darauf, um die manuellen Tracker für den aktuellen Zug laufen zu lassen.

In **Agent activity** lässt du alle Tracker erneut laufen, wiederholst fehlgeschlagene Agenten und nutzt **Clear Trackers** (Tracker leeren). Siehe [Agent activity](getting-started.md#agent-activity).

> **Warnung:** **Clear Trackers** löscht den gesamten erfassten Weltzustand des Chats und lässt sich nicht rückgängig machen.

<a id="the-trackers-window"></a>

## Das Trackers-Fenster

Am Computer nutzen die Tracker das Fenster **Trackers**, wenn das Tracker Panel aus ist. Ist neben deinen Nachrichten Platz, öffnet es sich links. Andernfalls startet es als kleine **Trackers**-Schaltfläche oben links im Chat. Klick auf die Schaltfläche, um es zu öffnen. Ein Chat mit gespeichertem Layout behält deine Anordnung.

Verschieb das Fenster an seiner Titelleiste und ändere seine Größe an den Kanten. Oben rechts hat es diese Schaltflächen:

- **Pin** (anheften): hält es offen, wenn du woanders klickst. Anfangs ist es angeheftet.
- **Lock** (sperren): verhindert Verschieben und Größenänderungen und hält auch seine Schaltfläche fest. Die Schaltfläche öffnet das Fenster weiterhin.
- **Close** (schließen): verkleinert es zur verschiebbaren **Trackers**-Schaltfläche.

**Reset View** (Ansicht zurücksetzen) in Chat Settings löscht die gespeicherte Anordnung und wählt je nach verfügbarem Platz das ursprüngliche Fenster oder die Schaltfläche.

Jeder Tracker hat einen aufklappbaren Abschnitt. Klick auf seine Überschrift, um ihn zu einer kleinen Vorschau zuzuklappen, und erneut, um ihn zu öffnen. Marinara merkt sich, welche du zugeklappt hast.

Um einem Tracker ein eigenes Fenster zu geben, klick auf die Schaltfläche zum Herauslösen neben seinem Pfeil oder zieh seinen Titel aus dem Trackers-Fenster. Das neue Fenster ist zunächst nicht angeheftet. Hefte es an, damit es offen bleibt. **X** verkleinert es zu einer kleinen Schaltfläche mit dem Symbol des Trackers. **World State** schrumpft stattdessen zu einem Banner mit denselben Angaben zu Ort, Datum, Uhrzeit und Wetter wie am Telefon, das du an eine beliebige Stelle ziehen kannst, etwa oben in die Mitte des Chats. Um den Tracker zurückzulegen, klick auf **Put back in Trackers** (in Trackers zurücklegen; der gebogene Pfeil links von **X**) oder zieh ihn auf das Trackers-Fenster. Jeder Chat merkt sich, welche Tracker herausgelöst sind und wo sie liegen.

<a id="the-tracker-panel"></a>

## Das Tracker Panel

Das **Tracker Panel** ist ein größeres Seitenpanel mit denselben Daten. Es zeigt außerdem Porträts und Gedanken der Charaktere.

1. Öffne **Chat Settings**.
2. Klick in der Titelleiste auf die Schaltfläche **Tracker Panel** (den Würfel) neben Anheften und Sperren. Sie bleibt hervorgehoben, solange das Panel an ist.
3. Klick erneut darauf, um das Panel auszublenden. Am Computer erscheinen die Tracker dann im Trackers-Fenster.

Am Computer fügt sich das Panel neben deinen Nachrichten ein, höchstens bis zu der Breite, die **Desktop size** (Desktop-Größe) festlegt. Ist das Fenster für beides zu schmal, etwa bei geöffneter Chat-Seitenleiste, werden deine Nachrichten und das Nachrichtenfeld etwas schmaler. Am Telefon oder Tablet fügt das Einschalten eine verschiebbare Tracker-Panel-Schaltfläche hinzu. Tippe darauf, um das Panel zu öffnen, und erneut, um es zu schließen. Solange das Panel oder ein anderer Bildschirm den Chat verdeckt, sind die verschiebbaren Schaltflächen des Chats ausgeblendet und kommen danach an denselben Stellen zurück.

### Tracker-Felder anpassen

Die Schaltflächen in der Kopfzeile des Panels ändern den Aufbau des Trackers:

- **+** wechselt in den Hinzufügen-Modus. Der Bereich World bekommt **Add world field** (Weltfeld hinzufügen), jede Karte eines anwesenden Charakters **Add custom field** (eigenes Feld hinzufügen). Die Feldnamen bleiben auch im normalen Modus sichtbar.
- Das Papierkorb-Symbol wechselt in den Lösch-Modus, in dem du eigene Welt- oder Charakterfelder entfernst. Mit einem Feld verschwinden auch seine Sperren.
- Das Schloss-Symbol wechselt in den Sperrmodus. Für eigene Felder gelten dieselben Sperrregeln wie für die eingebauten.
- Das durchgestrichene Augen-Symbol wechselt in den Ausblenden-Modus. Wähle auf einer Charakterkarte **Mood**, **Look**, **Outfit** oder **Thoughts**. Ein ausgeblendetes Feld verschwindet aus dem Tracker Panel und dem HUD, wird geleert und bleibt gesperrt, damit Agenten es nicht wieder befüllen. Wechsle erneut in den Ausblenden-Modus, um es als leeres Feld wieder anzuzeigen.

Agenten aktualisieren die Werte deiner eigenen Felder. Ein Feld, das du angelegt hast, löschen sie nie.

### Ein neues Porträt erstellen

Sobald der Character Tracker eine Bildverbindung hat, kann die große Karte eines Charakters ein neues Porträt erstellen. Bei einer kompakten Karte klickst du auf **Feature character card** (Charakterkarte hervorheben), um die große zu öffnen. Das Trackers-Fenster zeigt immer große Karten. Fahr mit der Maus über das Porträt und klick auf die Schaltfläche mit dem Auge, um eines aus **Look** zu erstellen, oder auf die Schaltfläche mit dem Hemd für **Look** und **Outfit**. Die Schaltfläche mit dem Hemd erscheint nur, wenn der Charakter ein Outfit hat. Das alte Porträt bleibt, bis das neue fertig ist. Schlägt das Erstellen fehl, behältst du das alte. Charaktere, die mit dem Avatar ihrer Karte oder einem Ausdrucks-Sprite angezeigt werden, haben diese Schaltflächen nicht.

### Einstellungen des Tracker Panels

Öffne **Settings → Appearance**, klapp die Gruppe **Roleplay** auf und such den Abschnitt **Tracker Panel**.

| Einstellung | Was sie bewirkt |
| --- | --- |
| **Tracker Panel** | Der Ein-/Aus-Schalter, derselbe, den der Würfel bedient. Standardmäßig an. Ist er an, lautet die Beschriftung „Shown in the Roleplay HUD“. |
| **Dock Tracker Panel to edge** | Setzt das Panel an den Bildschirmrand und hält Chat-Steuerelemente in der Nähe davon frei. |
| **Use expression sprites for tracker portraits** | Verwendet das aktuelle Ausdrucks-Sprite eines Charakters statt des schlichten Avatars, sofern eines vorhanden ist. Siehe [Charakter-Sprites](../characters/sprites.md). |
| **Panel background** | Eine Farbe oder ein Verlauf für das Panel. |
| **Desktop size** | Breite des Panels: **Compact**, **Standard** oder **Expanded**. |
| **Thought display mode** | **Docked** öffnet Gedanken in der Charakterkarte. **Floating** öffnet sie als Blase neben dem Porträt. |
| **Always show Docked thoughts** | Hält bei **Docked** den Gedanken jedes hervorgehobenen Charakters sichtbar, statt ihn hinter einer Schaltfläche zu verstecken. |
| **Stat display mode** | Zeigt Werte als Balken oder als runde Anzeigen. |
| **Temperature unit** | **°C** (Standard) oder **°F**. Das ändert nur die Anzeige, nicht den gespeicherten Wert. |

<a id="the-state-editor"></a>

## Der State Editor

Der **State Editor** zeigt alle Tracker des aktuellen Zugs in einem einzigen Fenster, sodass du einen Wert finden und korrigieren kannst, ohne jeden Tracker einzeln zu öffnen. Er funktioniert auch am Telefon.

Du öffnest ihn auf jedem dieser Wege:

- Über das Zahnrad (**Tracker panel settings**) in der Kopfzeile des Tracker Panels und dann die Schaltfläche **{ }** (**Open in State Editor**).
- Über die Schaltfläche **{ }** in der Titelleiste des Fensters **Trackers** oder eines Trackers, den du herausgelöst hast.
- Am Telefon über die Schaltfläche **{ }** in den Panels **World State** und **Player & Tracker**.
- Über den Link **Open in State Editor** unter **Tracker Data** in der **Agent Suite**.

Er öffnet sich im Abschnitt des Trackers, von dem du kommst. World State öffnet sich zum Beispiel bei **Scene**.

- **Zeile zum Zug**: unter dem Suchfeld. Sie nennt die Nachricht und den Swipe, die du bearbeitest, zum Beispiel „Editing message #12 · swipe 2 of 3“. **Latest** kennzeichnet den neuesten Zug. Jeder Swipe hat seinen eigenen Zustand; wische also zuerst, um einen anderen zu bearbeiten.
- **Abschnitte**: **Scene**, **Present Characters**, **Persona Stats**, **Inventory Tracker**, **Custom Tracker Fields** und **Active Quests**. Am Telefon stehen sie als Chips über dem Editor. Ein Punkt markiert einen geänderten Abschnitt.
- **Suche**: Gib einen Schlüssel oder Wert ein, etwa `mood`. Klick auf ein Ergebnis, um dorthin zu springen.
- **Fields** (Felder): Jeder Abschnitt öffnet sich als **Fields**, mit Eingabefeldern für Text, Zahlen und An/Aus-Werte.
- **No value**: Ein leeres Feld zeigt eine Auswahl aus **Text**, **Number** (Zahl) und **On/off** (an/aus).
- **Add item** (Eintrag hinzufügen): fügt einen Eintrag hinzu und kopiert dabei den darüber.
- **Add** (Hinzufügen): ergänzt einen Abschnitt oder eine leere Karte um ein benanntes Feld.
- **×**: entfernt einen Eintrag oder leert einen Wert.
- **JSON**: Hier bearbeitest du die Rohdaten. **Format** (formatieren) räumt sie auf. Ein Abschnitt mit fehlerhaftem JSON lässt sich erst speichern, wenn du den Fehler behoben hast.
- **Revert** (zurücksetzen): macht deine Änderungen an einem Abschnitt rückgängig.

Charaktere und Quests gehören zur Geschichte, deshalb kannst du ihre Karten hier nicht hinzufügen. Listen darin, etwa die Werte eines Charakters, kannst du bearbeiten.

So speicherst du:

1. Klick auf **Review changes** (Änderungen prüfen), um jede Änderung Zeile für Zeile zu sehen.
2. Klick auf **Save changes** (Änderungen speichern). Das schreibt alle Abschnitte auf einmal in den Zug, den du bearbeitet hast.

Bis dahin bleiben deine Entwürfe im Fenster, und beim Schließen wirst du gefragt, bevor sie verworfen werden.

Wenn es nicht funktioniert hat: Ist die Geschichte weitergelaufen, während du bearbeitet hast, überschreibt der Editor sie nicht. Nach einer neuen Antwort, einem neuen Swipe oder einer Tracker-Aktualisierung an einem Abschnitt, den du geändert hast, wird das Speichern mit einer Schaltfläche **Reload** (neu laden) abgelehnt. **Reload** zeigt den neuesten Zustand und verwirft deine Entwürfe.

## Verwandte Anleitungen

- [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md)
- [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md)
- [Charakterfarben und RPG-Werte](../characters/colors-and-stats.md): Der Tab **Stats** legt fest, mit welchen Balken und Attributen eine Persona oder ein Charakter startet.
- [Roleplay Mode: Erste Schritte](getting-started.md)
- [Game Mode: HUD-Widgets](../game/hud-widgets.md)
