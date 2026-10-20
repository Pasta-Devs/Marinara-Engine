# Charakterfarben und RPG-Werte

In dieser Anleitung erfährst du, wie der Tab **Colors** (Farben) und der Tab **Stats** (Werte) in Marinara Engine funktionieren. Beide Tabs gibt es im Charakter-Editor und im Persona-Editor. Über die Farben legst du fest, wie ein Charakter oder die Persona im Chat aussieht. Über die Werte richtest du mitgeführte Größen wie Gesundheit oder Hunger ein.

## Der Tab **Colors**

Jeder Charakter und jede Persona hat im Editor einen Tab **Colors**. Dort stellst du drei Farben ein: die Namensfarbe, die Dialogfarbe und die Farbe der Nachrichtenbox. Bleibt ein Feld leer, gilt für diesen Teil die Standardfarbe des App-Themes.

So öffnest du den Tab **Colors**:

1. Öffne einen Charakter im Charakter-Editor oder eine Persona im Persona-Editor.
2. Klick in der Tab-Leiste auf den Tab **Colors**.
3. Jetzt siehst du eine Live-Karte **Preview** (Vorschau) und darunter drei Farbfelder.

Die **Preview**-Karte zeigt einen Beispielnamen und eine Beispiel-Sprechblase. Sie aktualisiert sich bei jeder Farbänderung – so siehst du das Ergebnis schon vor dem Speichern.

### Extract Colors from Avatar

Die Schaltfläche **Extract Colors from Avatar** (Farben aus dem Avatar übernehmen) wählt Namensfarbe, Dialogfarbe und Farbe der Nachrichtenbox automatisch aus dem Avatarbild. Aktiv ist die Schaltfläche erst, sobald ein Avatar vorhanden ist. Vorher bleibt sie deaktiviert und trägt die Beschriftung **Upload an avatar first**. Auch nach der Übernahme lässt sich jede der drei Farben von Hand ändern.

### Die drei Farben

Stell jede Farbe über das Farbfeld ein oder tippe einen Wert ein:

- **Name Display Color** (Namensfarbe): die Farbe des Namens. Dieses Feld akzeptiert auch einen CSS-Verlauf. Ein Verlauf ist ein weicher Übergang zwischen Farben. Beispielwert: `linear-gradient(90deg, #f59e0b, #ef4444)`.
- **Dialogue Highlight Color** (Hervorhebung für Dialoge): die Farbe für Text innerhalb von Dialog-Anführungszeichen. Beispielwert: `#ffd700`.
- **Message Box Color** (Farbe der Nachrichtenbox): die Hintergrundfarbe der Sprechblase im Chat. Am besten wirkt eine halbtransparente Farbe. Beispielwert: `rgba(0, 0, 0, 0.5)`.

Eine halbtransparente Farbe lässt den Hintergrund teilweise durch die Sprechblase scheinen. Das Format `rgba` steht für Rot, Grün, Blau und einen Alpha-Wert von 0 (durchsichtig) bis 1 (deckend).

<a id="where-your-colors-show"></a>

## Wo die Farben auftauchen

Jede Farbe wirkt an einer anderen Stelle im Chat:

- Die Namensfarbe färbt den angezeigten Namen in den Chat-Nachrichten. Bei einem Charakter färbt sie zusätzlich den Namen in den Tabs der Seitenleiste. Bei einer Persona färbt sie zusätzlich den Namen in den Persona-Auswahllisten.
- Die Dialogfarbe färbt Text innerhalb von Dialog-Anführungszeichen. Das klappt mit geraden Anführungszeichen ebenso wie mit anderen Anführungsstilen. Unter **Settings** (Einstellungen) lässt sich dieser Text zusätzlich fett darstellen. Conversation-Chats verwenden sie nicht.
- Die Farbe der Nachrichtenbox bestimmt in Roleplay-Chats den Hintergrund der Sprechblasen dieses Charakters bzw. dieser Persona. Conversation- und Game-Chats verwenden sie nicht.

## Der Tab **Stats**

Jeder Charakter und jede Persona hat außerdem einen Tab **Stats**. Werte sind Zahlen wie HP (Lebenspunkte), STR (Stärke) oder eine Hungeranzeige. Sind die Werte aktiviert, schreibt die App sie in den Prompt – also in den Text, den Marinara an die KI schickt –, damit die KI den aktuellen Stand kennt. Was du hier einträgst, sind die Startwerte für neue Chats. Während des Spiels ändern Agenten sie dann. Mehr dazu im Abschnitt zu den Agenten weiter unten.

Der Tab **Stats** beim Charakter und der Tab **Stats** bei der Persona sind unterschiedlich aufgebaut. Deshalb beschreibt der folgende Text beide einzeln.

### Charakterwerte: Enable RPG Stats

Beim Charakter gibt es einen einzigen Schalter: **Enable RPG Stats** (RPG-Werte aktivieren). Steht er auf aus, wird darunter nichts angezeigt und nichts gesendet. Steht er auf an, erscheinen zwei Bereiche:

- **Pools**: benannte Balken mit aktuellem Wert, Maximum und Farbe. Neue Charaktere starten mit einem HP-Pool und einem MP-Pool, jeweils bei 100 von 100. Klick auf **Add** (Hinzufügen), um einen weiteren Pool anzulegen. Klick auf das X in einer Zeile, um sie zu entfernen.
- **Attributes**: benannte Zahlenwerte. Neue Charaktere starten mit STR, DEX, CON, INT, WIS und CHA, jeweils bei 10. Klick auf **Add**, um ein weiteres Attribut anzulegen. Klick auf das X in einer Zeile, um sie zu entfernen.

### Persona-Werte: zwei Bereiche

Der Tab **Stats** einer Persona besteht aus zwei getrennten Blöcken mit jeweils eigenem Schalter.

Der erste Block heißt **Persona Status Bars** (Statusleisten der Persona) und wird über **Enable Persona Stats** (Persona-Werte aktivieren) eingeschaltet. Diese Leisten führen körperliche und seelische Bedürfnisse mit. Nach dem Aktivieren stehen als Startleisten Satiety, Energy, Hygiene und Mood bereit, jeweils bei 100 von 100. Unter **Status Bars** verwaltest du die Liste. Jede Leiste hat einen Namen, einen aktuellen Wert, ein Maximum und eine Farbe. Klick auf **Add**, um eine Leiste anzulegen, und auf das X, um eine zu entfernen.

Der zweite Block heißt **RPG Attributes** und wird über **Enable RPG Attributes** (RPG-Attribute aktivieren) eingeschaltet. Er funktioniert wie bei einer Charakterkarte: Die Persona bekommt **Pools** (Start: HP und MP mit 100 von 100) und **Attributes** (Start: STR, DEX, CON, INT, WIS und CHA mit 10).

<a id="ruleset-sheets"></a>

### Regelsatzbögen

Ist ein Game Mode-Regelsatz installiert, etwa 5e (SRD 5.1), bekommen beide **Stats**-Tabs unter den Bereichen oben einen Block **Ruleset sheets** (Regelsatzbögen). Er hat einen aufklappbaren Eintrag je installiertem Regelsatz. Der Block erscheint auch, wenn eine Karte noch einen Bogen für einen Regelsatz enthält, den du nicht mehr hast.

1. Klapp den Eintrag auf und klick auf **Add a sheet** (Bogen hinzufügen). Du bekommst einen leeren Bogen, in dem jeder Wert auf dem Standard des Regelsatzes steht.
2. Füll ihn aus. Der Aufbau kommt vom Regelsatz selbst: Attributswerte mit ihren Modifikatoren, nach Abschnitten gruppierte Felder, Listen wie Angriffe und Zauber sowie Fertigkeiten und Rettungswürfe mit je einer Ausbildungsstufe und einem Zusatzbonus. Berechnete Werte wie ein Übungsbonus oder die passive Wahrnehmung aktualisieren sich beim Tippen und lassen sich nicht bearbeiten.
3. Speichere Charakter oder Persona wie gewohnt.

Ein Bogen hier ist die **Startkonfiguration** des Charakters für diesen Regelsatz. Ein neues Spiel mit dem Regelsatz übernimmt eine Kopie davon. Änderungen im Spiel bleiben in diesem Spiel und gelangen nie zurück auf die Karte.

Manche Regelsätze bringen fertige Zauber, Angriffe und Merkmale mit. Listen, die sie füllen, haben eine Schaltfläche **Add from catalog** (Aus Katalog hinzufügen), die eine durchsuchbare Auswahl öffnet. Die Zeilen, die sie hinzufügt, sind Kopien, die du wie jede andere bearbeiten kannst. Daraus folgen zwei Dinge:

- Eine Zelle, die der Regelsatz für dich verwaltet, etwa Anwendungen, die einem Attributswert folgen, oder eine Klassenressource, die mit deiner Stufe wächst, wird an Ort und Stelle angezeigt, lässt sich aber nicht bearbeiten und trägt den Hinweis „Set by the ruleset“. Sie wird bei jeder Bearbeitung aus dem Rest des Bogens neu berechnet.
- Hat sich der Text des Regelsatzes für eine dieser Zeilen geändert, seit du sie ausgewählt hast, nennt eine Zeile unter der Liste, wie viele Zeilen neueren Text haben, zusammen mit der Schaltfläche **Review** (Prüfen). Die Prüfung zeigt jede Zeile mit dem Inhalt deines Bogens neben dem, was der Regelsatz sagt, und mit einem Häkchen pro Zeile. **Update selected** (Auswahl aktualisieren) schreibt nur die angehakten Zeilen. Verglichen wird nur Text: Zahlen, Schalter und alles, was du in eine andere Spalte getippt hast, bleiben unberührt, ebenso jede Zeile, deren Häkchen du entfernst.

Ein Bogen für einen Regelsatz, den du nicht installiert hast, bleibt erhalten und wird nicht gelöscht. Er erscheint als eine Zeile mit der Schaltfläche **Remove** (Entfernen), wird nie an die KI geschickt und lässt sich wieder bearbeiten, sobald du den Regelsatz installierst. Beim Export reist er außerdem mit der Karte mit. Jeder Bogen darf höchstens 64 KB groß sein.

Ein Bogen für einen installierten Regelsatz, den diese Version von Marinara nicht lesen kann – etwa einer, den eine neuere Version gespeichert hat –, bleibt ebenfalls unverändert erhalten. Sein Eintrag bietet nur **Remove this sheet** (diesen Bogen entfernen) an, damit ein neuer Bogen ihn nie versehentlich überschreibt.

Regelsatzbögen sind unabhängig von **Enable RPG Stats** und **Enable RPG Attributes**. Ein Spiel mit den eigenen Regeln von Marinara ignoriert sie, und ein Spiel mit Regelsatz nutzt sie für seine Proben statt der Attribute oben.

## Wie Agenten die Werte aktualisieren

Die Werte im Tab **Stats** werden zum Startzustand des Chats. Agenten können die unten beschriebenen Werte aktualisieren, die zu einem Tracker gehören. RPG Attributes wie STR und DEX sind Kontext der Karte und keine Tracker-Werte, die Agenten verwalten.

- Der Agent **Character Tracker** passt die verfolgten Stats des Charakters an, einschließlich Pools wie HP – abhängig von Kämpfen, Heilung und Ereignissen der Geschichte. Die Persona des Spielers verfolgt er nicht.
- Der Agent **Persona Stats** passt nach jeder Nachricht die **Persona Status Bars** an, je nachdem, was in der Geschichte passiert.
- Die **RPG Attributes** von Charakteren und Personas werden mit ihrer Karte für Combat und Game Mode mitgeschickt sowie für optionale Würfe in Roleplay oder Game Mode. Agenten aktualisieren diese Attribute nicht.

Ohne den passenden Tracker-Agenten bleiben die Tracker-Werte auf dem eingestellten Stand. Der Tab **Stats** allein aktualisiert nichts von selbst. Wie du diese Agenten einschaltest, steht in der Anleitung zu den mitgelieferten Agenten.

## Wie die Werte im HUD erscheinen

Sind Werte aktiviert, erscheinen sie während des Chats im HUD-Widget. HUD steht für Heads-up-Display, ein kleines Panel mit den aktuellen Werten. Balken erscheinen als farbcodierte Verläufe und sind so auf einen Blick lesbar. Die HUD-Anleitung beschreibt die vollständige Anzeige und erklärt, wie du sie verschiebst oder ausblendest.

## Verwandte Anleitungen

- [Charaktere anlegen und bearbeiten](creating-and-editing-characters.md)
- [Personas: erstellen und bearbeiten](personas.md)
- [HUD und Tracker](../roleplay/hud-and-trackers.md)
- [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md)
