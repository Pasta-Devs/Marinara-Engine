# Charakterfarben und Story-Werte

Die Tabs **Colors** (Farben) und **Stats** (Werte) gibt es sowohl im Charakter-Editor als auch im Persona-Editor. Über die Farben legst du fest, wie ein Charakter oder eine Persona im Chat aussieht. Über die Werte richtest du Größen ein, die du mitverfolgen kannst, etwa Gesundheit oder Hunger.

## Der Tab „Colors“

Der Tab **Colors** stellt drei Farben ein: die Namensfarbe, die Dialogfarbe und die Farbe der Nachrichtenbox. Lass ein Feld leer, damit für diesen Teil die Farbe des App-Themes gilt.

1. Öffne einen Charakter oder eine Persona im zugehörigen Editor.
2. Klick auf den Tab **Colors**.
3. Eine Live-Karte **Preview** (Vorschau) zeigt einen Beispielnamen und eine Beispiel-Sprechblase, darunter stehen die Farbfelder. Die Vorschau aktualisiert sich bei jeder Farbänderung, noch bevor du speicherst.

### Extract Colors from Avatar

**Extract Colors from Avatar** (Farben aus dem Avatar übernehmen) wählt alle drei Farben aus dem Avatarbild. Solange noch kein Avatar vorhanden ist, ist die Schaltfläche deaktiviert und trägt die Beschriftung **Upload an avatar first**. Danach kannst du jede Farbe trotzdem von Hand ändern.

### Die drei Farben

Stell jede Farbe über das Farbfeld ein oder tippe einen Wert ein:

| Feld | Was es einfärbt | Beispielwert |
| --- | --- | --- |
| **Name Display Color** (Namensfarbe) | Den Namen. Das Feld akzeptiert auch einen Verlauf, siehe unten. | `#f59e0b` |
| **Dialogue Highlight Color** (Hervorhebung für Dialoge) | Text innerhalb von Dialog-Anführungszeichen. | `#ffd700` |
| **Message Box Color** (Farbe der Nachrichtenbox) | Den Hintergrund der Sprechblase im Roleplay-Chat. | `#123456` |

**Name Display Color** akzeptiert auch einen CSS-Verlauf, also einen weichen Übergang zwischen Farben:

```text
linear-gradient(90deg, #f59e0b, #ef4444)
```

Der Tab **Colors** eines Charakters hat außerdem **Name Aliases** (Namensaliasse). Tippe weitere Namen oder Spitznamen ein, durch Kommas getrennt, etwa `Kate, Kitty, Katherine`. Sie erhalten die Namensfarbe des Charakters, wenn sie in Chat-Nachrichten vorkommen. Der Hauptname ist immer enthalten. Schalte die Funktion pro Chat unter **Chat Settings → Characters** (Chat-Einstellungen → Charaktere) ein.

Die Transparenz änderst du unter **Settings → Appearance → Roleplay Presentation → Roleplay Messages Background Opacity** (Einstellungen → Darstellung → Roleplay-Darstellung → Deckkraft des Hintergrunds von Roleplay-Nachrichten).

Der Schieberegler ersetzt die Transparenz, die in den Hintergrundfarben von Charakteren, Personas und Presets gespeichert ist, einschließlich übernommener Farben. Deine gespeicherten Farbwerte bleiben, wie sie sind. Namens- und Dialogfarben sind davon nicht betroffen.

Hintergrund-Hooks benutzerdefinierter Themes und Card CSS können die app-eigene Gestaltung der Sprechblasen weiterhin überschreiben.

<a id="where-your-colors-show"></a>

### Wo die Farben auftauchen

- Die Namensfarbe färbt den angezeigten Namen in den Chat-Nachrichten. Bei einem Charakter färbt sie zusätzlich den Namen in den Tabs der Seitenleiste. Bei einer Persona färbt sie zusätzlich den Namen in den Persona-Auswahllisten.
- Die Dialogfarbe färbt Text innerhalb von Dialog-Anführungszeichen, bei geraden Anführungszeichen ebenso wie bei anderen Anführungsstilen. Unter **Settings** kannst du diesen Text zusätzlich fett darstellen. Conversation-Chats verwenden sie nicht.
- Die Farbe der Nachrichtenbox bestimmt in Roleplay-Chats den Hintergrund der Sprechblasen dieses Charakters oder dieser Persona. Conversation- und Game-Chats verwenden sie nicht.

## Der Tab „Stats“

Der Tab **Stats** legt Zahlen fest wie HP (Lebenspunkte), STR (Stärke) oder eine Hungeranzeige. Schaltest du die Werte ein, schreibt Marinara sie in den Prompt, damit die KI den aktuellen Stand kennt. Die Werte, die du setzt, sind die Startvorgaben für neue Chats. Während des Spiels können Agenten einige davon ändern (siehe [Wie Agenten die Werte aktualisieren](#how-agents-update-your-stats)).

Der Tab **Stats** ist bei Charakteren und Personas unterschiedlich aufgebaut.

### Charakterwerte

Ein Charakter hat einen einzigen Schalter, **Enable story stats** (Story-Werte aktivieren). Ist er aus, wird darunter nichts angezeigt und nichts gesendet. Ist er an, erscheinen zwei Bereiche:

- **Pools** sind benannte Balken mit aktuellem Wert, Maximum und Farbe. Neue Charaktere starten mit HP und MP, jeweils bei 100 von 100.
- **Attributes** sind benannte Zahlen. Neue Charaktere starten mit STR, DEX, CON, INT, WIS und CHA, jeweils bei 10.

Klick auf **Add** (Hinzufügen), um einen Pool oder ein Attribut anzulegen, und auf das X in einer Zeile, um sie zu entfernen.

### Persona-Werte

Der Tab **Stats** einer Persona hat zwei getrennte Blöcke mit jeweils eigenem Schalter.

- **Persona Status Bars** (Statusleisten der Persona), eingeschaltet über **Enable Persona Stats** (Persona-Werte aktivieren), führen körperliche und seelische Bedürfnisse mit. Die Startleisten sind Satiety, Energy, Hygiene und Mood, jeweils bei 100 von 100. Unter **Status Bars** hat jede Leiste einen Namen, einen aktuellen Wert, ein Maximum und eine Farbe. Klick auf **Add**, um eine anzulegen, und auf das X, um eine zu entfernen.
- **Enable story stats** (Story-Werte aktivieren) funktioniert wie bei einer Charakterkarte. Die Persona bekommt **Pools** (Start: HP und MP mit 100 von 100) und **Attributes** (Start: STR, DEX, CON, INT, WIS und CHA mit 10).

<a id="mrpg-picks-on-a-card"></a>

### MRPG-Auswahl auf einer Karte

Beide **Stats**-Tabs haben einen Abschnitt **Game Mode** mit einem Block **MRPG** für Spiele mit MRPG-Klassen (also jedes neue Spiel). Die MRPG-Werte jedes Charakters werden in jedem Spiel neu ausgewürfelt. Deshalb stehen auf der Karte keine Zahlen, sondern nur drei Festlegungen:

- **Starting tree** (Startbaum): der Baum, in dem der Charakter beginnt. **Auto** leitet ihn aus Beschreibung und Persönlichkeit der Karte ab und zeigt den daraus ermittelten Baum an.
- **Strong in** (Stark in): bis zu zwei Werte, bei denen der Charakter gut wächst.
- **Weak in** (Schwach in): ein Wert, bei dem der Charakter schlecht wächst.

Der Block zeigt eine Vorschau auf die Klasse, mit der der Charakter in einem neuen Spiel auf Stufe 1 beginnt, einschließlich Reihe sowie anfänglichen HP, MP und Stamina. Die Auswahl der starken und schwachen Werte beeinflusst das verborgene Wachstum des Charakters in jedem Spiel. Sein Schwesterbaum ergibt sich im Spiel aus seinem Temperament, nicht aus der Karte. Siehe [Game Mode: MRPG-Klassen](../game/mrpg-classes.md#choose-a-characters-trees).

Auf einer Charakterkarte fasst **Story stats** (Story-Werte) darunter die oben beschriebenen Pools und Attribute in einem einklappbaren Bereich zusammen. Roleplay-Chats und Legacy-Spiele verwenden sie. Ein MRPG-Spiel verwendet stattdessen den Klassenblock und erstellt daraus nie einen Bogen.

<a id="game-mode-icon"></a>

### Symbol für Game Mode

Beide **Stats**-Tabs haben einen Block **Game Mode Icon** (Symbol für Game Mode). Er legt das Bild auf dem runden Token dieses Charakters oder dieser Persona fest, das bei einem Kampf in Game Mode auf dem Spielfeld erscheint. Ein kleines Token neben den Optionen zeigt, was das Spielfeld darstellen wird.

- **Avatar** ist der Standard. Es verwendet den Avatar oder, wenn keiner vorhanden ist, die Initialen.
- **Custom image** (eigenes Bild) verwendet ein Bild aus der Galerie der Karte. Wähle eines der dort angezeigten Bilder oder lade ein neues hoch, das der Galerie hinzugefügt wird. Speichere die Karte einmal, bevor du diese Option nutzt.
- **Initials** (Initialen) zeigt immer die Initialen, auch wenn ein Avatar vorhanden ist.

Dasselbe Bild erscheint für diesen Charakter auch in den anderen Kampfstilen. Löschst du das ausgewählte Bild aus der Galerie, weist der Block darauf hin. Wähle ein anderes oder wechsle zurück zu **Avatar**.

<a id="ruleset-sheets"></a>

### Regelsatzbögen

Ist ein Game-Mode-Regelsatz installiert, etwa 5e (SRD 5.1), bekommen beide **Stats**-Tabs unter den Bereichen oben einen Block **Ruleset sheets** (Regelsatzbögen). Er hat einen aufklappbaren Eintrag je installiertem Regelsatz. Er erscheint auch, wenn eine Karte noch einen Bogen für einen Regelsatz enthält, den du nicht mehr hast.

Ein Bogen ist die Startkonfiguration dieses Charakters für diesen Regelsatz. Ein neues Spiel mit dem Regelsatz übernimmt eine Kopie davon. Änderungen im Spiel bleiben in diesem Spiel und gelangen nie zurück auf die Karte.

1. Klapp den Eintrag auf und klick auf **Add a sheet** (Bogen hinzufügen). Du bekommst einen leeren Bogen, in dem jeder Wert auf dem Standard des Regelsatzes steht.
2. Füll ihn aus. Der Aufbau kommt vom Regelsatz: Attributswerte mit ihren Modifikatoren, nach Abschnitten gruppierte Felder, Listen wie Angriffe und Zauber sowie Fertigkeiten und Rettungswürfe mit einer Ausbildungsstufe und einem Zusatzbonus. Berechnete Werte wie ein Übungsbonus oder die passive Wahrnehmung aktualisieren sich beim Tippen und lassen sich nicht bearbeiten.
3. Speichere Charakter oder Persona wie gewohnt.

Du kannst auch Professor Mari bitten, einen Bogen auszufüllen oder zu ändern, etwa: „Gib Rook einen Brawn-Wert von 2 und füge Rooks Ausrüstung ein Brecheisen hinzu.“ Sie schreibt nur den Bogen dieses Regelsatzes, hält jeden Wert innerhalb der Grenzen des Regelsatzes und zeigt die Änderung auf einer Änderungskarte.

Manche Regelsätze bringen fertige Zauber, Angriffe und Merkmale mit. Listen, die sie füllen, haben eine Schaltfläche **Add from catalog** (Aus Katalog hinzufügen), die eine durchsuchbare Auswahl öffnet. Die Zeilen, die sie hinzufügt, sind Kopien, die du wie jede andere bearbeiten kannst.

- Eine Zelle, die der Regelsatz für dich verwaltet, etwa Anwendungen, die einem Attributswert folgen, oder eine Klassenressource, die mit der Stufe wächst, wird an Ort und Stelle angezeigt, lässt sich aber nicht bearbeiten. Sie trägt den Hinweis „Set by the ruleset“ und wird bei jeder Bearbeitung des Bogens neu berechnet.
- Hat sich der Text des Regelsatzes für eine dieser Zeilen geändert, seit du sie ausgewählt hast, nennt eine Zeile unter der Liste, wie viele Zeilen neueren Text haben, zusammen mit der Schaltfläche **Review** (Prüfen). Die Prüfung zeigt jede Zeile mit deinem Text neben dem des Regelsatzes und mit einem Häkchen pro Zeile. **Update selected** (Auswahl aktualisieren) schreibt nur die angehakten Zeilen. Verglichen wird nur Text. Zahlen, Schalter und alles, was du in eine andere Spalte getippt hast, bleiben unberührt.

Ein Bogen für einen Regelsatz, den du nicht installiert hast, bleibt erhalten. Er erscheint als eine Zeile mit der Schaltfläche **Remove** (Entfernen), wird nie an die KI geschickt, lässt sich wieder bearbeiten, sobald du den Regelsatz installierst, und reist beim Export mit der Karte mit. Ein Bogen für einen installierten Regelsatz, den diese Version nicht lesen kann, etwa einer, den eine neuere Version gespeichert hat, bleibt ebenfalls unverändert erhalten. Sein Eintrag bietet nur **Remove this sheet** (diesen Bogen entfernen) an, damit ein neuer Bogen ihn nie versehentlich überschreibt. Jeder Bogen darf höchstens 64 KB groß sein.

Regelsatzbögen sind unabhängig von **Enable story stats**. Ein Spiel mit den eigenen Regeln von Marinara ignoriert sie. Ein Spiel mit Regelsatz nutzt für seine Proben den Bogen statt der Attribute oben.

<a id="how-agents-update-your-stats"></a>

## Wie Agenten die Werte aktualisieren

Der Tab **Stats** legt den Startzustand des Chats fest. Agenten aktualisieren nur Werte, die zu einem Tracker gehören.

| Wert | Wer ihn ändert |
| --- | --- |
| **Pools** eines Charakters wie HP | Der Agent **Character Tracker**, abhängig von Kämpfen, Heilung und Ereignissen der Geschichte. Die Persona des Spielers verfolgt er nicht. |
| **Persona Status Bars** | Der Agent **Persona Stats**, nach jeder Nachricht. |
| **Story stats** wie STR und DEX | Kein Agent. Sie werden mit der Karte für Kampf und Game Mode mitgeschickt sowie für optionale Würfe in Roleplay oder Game Mode. |

Schaltest du den passenden Agenten nicht ein, bleiben die Tracker-Werte auf den Standardwerten, die du gesetzt hast. Der Tab **Stats** allein aktualisiert während des Spiels nichts. Wie du diese Agenten einschaltest, steht unter [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md).

## Wie die Werte im HUD erscheinen

Eingeschaltete Werte erscheinen während eines Chats im HUD. Das HUD ist das kleine Panel mit deinen aktuellen Werten. Balken erscheinen als farbcodierte Verläufe. Wie du es verschiebst oder ausblendest, steht unter [HUD und Tracker](../roleplay/hud-and-trackers.md).

## Verwandte Anleitungen

- [Charaktere anlegen und bearbeiten](creating-and-editing-characters.md)
- [Personas](personas.md)
- [HUD und Tracker](../roleplay/hud-and-trackers.md)
- [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md)
