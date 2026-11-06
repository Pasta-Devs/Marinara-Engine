# Game Mode: MRPG-Klassen

Jedes neue Spiel nutzt **MRPG**-Klassen (Marinara RPG), auch Spiele aus einer Experience. Jedes Partymitglied hat eine Klasse, steigt durch Kämpfe auf und schaltet im Lauf seiner Entwicklung neue Klassen frei. Spiele, die vor den MRPG-Klassen angelegt wurden, behalten ihre **Legacy**-Bögen, bis du sie umstellst (siehe [Ein Legacy-Spiel auf MRPG umstellen](#move-a-legacy-game-to-mrpg)).

Ein Spiel mit einem Regelsatz, etwa 5e (SRD 5.1), nutzt stattdessen die eigenen Bögen des Regelsatzes; MRPG-Klassen gelten dort nicht.

<a id="classes-and-trees"></a>

## Klassen und Bäume

Es gibt acht Bäume: **Blade**, **Guard**, **Scout**, **Marksman**, **Channeler**, **Hexer**, **Mender** und **Herald**. Jeder Charakter trainiert in zwei davon:

- **Hauptbaum.** Wird auf seinem Bogen ausgewählt. Im Abschnitt **Game Mode** auf der Karte eines Bibliothekscharakters oder einer Persona lässt er sich festlegen. Andernfalls wird er aus Klasse und Fähigkeiten des Charakters abgeleitet.
- **Nebenbaum.** Wird durch das Temperament freigeschaltet, mit dem der Charakter das Spiel beginnt. Ein Charakter, dessen Temperament auf den eigenen Hauptbaum verweist, trainiert nur diesen und kann Klassen erreichen, die ausschließlich jemandem offenstehen, der bei einem Baum bleibt.

Jeder Baum beginnt mit einer Basisklasse. Eine Klasse steigt auf Klassenstufe 10 und erneut auf Stufe 20 in die nächste Klasse auf; bei Stufe 30 ist Schluss. Ein Charakter kann bis zu vier Fertigkeiten aus anderen Klassen mitführen, in denen er trainiert hat. Die Klasse wechselst du außerhalb eines Kampfes auf dem Charakterbogen. Die Werte richten sich nach der aktiven Klasse.

<a id="the-character-sheet"></a>

## Der Charakterbogen

Öffne den Bogen eines Partymitglieds über die Partyliste. Er hat vier Tabs: **Status**, **Classes**, **Skills** und **Gear**. Wachstumsraten sind verborgen. Ist **Debug** eingeschaltet, werden die genauen Wachstumsprozentsätze angezeigt.

Deine Party steigt durch gewonnene Kämpfe auf. Ein verlorener Kampf oder eine Flucht aus dem Kampf bringt keine Erfahrung. Ist **Permadeath** (eine Option bei der Einrichtung) eingeschaltet, ist ein Partymitglied für immer verloren, wenn es in einem Kampf fällt und nicht vor dessen Ende gerettet wird.

<a id="skill-checks"></a>

## Fertigkeitsproben

Proben außerhalb eines Kampfes nutzen die MRPG-Werte des Charakters. Unter [Würfel und Fertigkeitsproben](dice-and-skill-checks.md#how-the-result-is-decided) steht, welchen Wert jede Fertigkeit nutzt.

<a id="newcomers-to-the-party"></a>

## Neuzugänge in der Party

Wer nach Spielbeginn zur Party stößt, beginnt auf der Stufe, die der Game Master vorgibt. Die meisten Neuzugänge starten auf einer niedrigen Stufe, ein erfahrener Kämpfer vielleicht nahe an der Stufe der Party. Der Game Master kann einem Neuzugang außerdem Folgendes geben:

- **Schnelleres Wachstum** bei manchen Werten, wenn ein ungeschliffenes Talent rasch aufholen soll.
- **Von Anfang an bessere Werte**, wenn jemand bereits recht fähig ist.

Das entscheidet der Game Master beim Beitritt des Charakters. Sagt er nichts dazu, beginnt der Neuzugang auf Stufe 1.

<a id="playing-with-others"></a>

## Mit anderen spielen

In einem geteilten Spiel erstellt jeder Gast beim Beitritt zum Raum seinen eigenen Charakter: einen Namen, eine Beschreibung, ein **Charakterkonzept** für den Game Master und dieselbe Auswahl unter **Game Mode** wie bei einer Persona (Startbaum, starke Werte und schwacher Wert). Wenn du eine deiner Personas auswählst, werden diese Angaben daraus übernommen. Im Konzept erklärst du dem Game Master, wer dein Charakter ist und wie du möchtest, dass er in die Geschichte kommt.

Danach fügt der Game Master den Charakter in die Geschichte ein und wählt seinen Schwesterbaum.

- **Ein neues Spiel.** Alle, Gastgeber und Gäste, beginnen auf Stufe 1.
- **Ein bereits laufendes Spiel.** Der Game Master bestimmt außerdem die Startstufe des Gasts und kann ihm schnelleres Wachstum oder bessere Werte geben, wie jedem anderen [Neuzugang](#newcomers-to-the-party).
- **Ein zurückkehrender Gast.** Der Charakter eines Gasts bleibt mit seiner Stufe, Ausrüstung und seinen gezähmten Tieren im Spiel, wenn der Gast geht. Solange der Spieler nicht da ist, setzt der Charakter in Kämpfen aus, sammelt keine Erfahrung und wird vom Game Master aus Szenen herausgehalten. Kehrt der Gast zurück, spielt er denselben Charakter auf der Stufe weiter, auf der er ihn verlassen hat.

<a id="move-a-legacy-game-to-mrpg"></a>

## Ein Legacy-Spiel auf MRPG umstellen

Ein Legacy-Spiel behält seine Legacy-Bögen, solange du möchtest. Öffne zum Umstellen das **Journal** und such im Tab **All** die Karte **MRPG classes** (MRPG-Klassen). Wähle **Upgrade** (Upgrade durchführen).

Die Karte zeigt für jedes Partymitglied:

- **Class** (Klasse): der Baum, in dem es beginnt, vorausgefüllt mit der Auswahl auf seiner Bibliothekskarte oder andernfalls mit seiner Legacy-Klasse. Du kannst ihn ändern.
- **Sister tree** (Schwesterbaum): der Nebenbaum, den sein Temperament freischaltet. Hat ein Charakter noch kein Temperament, wird beim Upgrade eines aus seiner Description abgeleitet.
- **Gear** (Ausrüstung): jede Legacy-Waffe und jedes Legacy-Rüstungsteil, die der Charakter trägt, und das MRPG-Stück, zu dem es werden würde. Entferne das Häkchen, damit eines unverändert bleibt.

Wenn du mit **Upgrade the party** (Upgrade für die Party durchführen) bestätigst:

- Jedes Partymitglied beginnt auf Stufe 10, der höchsten Stufe seiner Startklasse; die Werte jeder Stufe werden wie bei einem Stufenaufstieg ausgewürfelt.
- Die Klasse auf seiner Karte wird zu seiner MRPG-Klasse. Seine Legacy-Klasse und -Fähigkeiten kommen in eine Notiz **Before the upgrade** (vor dem Upgrade) auf der Karte, damit die Geschichte sie weiterhin kennt. Auch seine Legacy-Werte bleiben auf der Karte.
- Jede bestätigte Waffe und jedes bestätigte Rüstungsteil wird zum entsprechenden MRPG-Stück, behält seinen Namen und wird angelegt, sofern die Klasse es tragen kann.

> **Warnung:** Das Upgrade ist unumkehrbar. Ein auf MRPG-Klassen umgestelltes Spiel kann nicht zu Legacy-Bögen zurückkehren.

Während eines Kampfes wird das Upgrade nicht angeboten. Beende zuerst den Kampf. Ein Spiel mit einem Regelsatz kann nicht umgestellt werden; es behält die Bögen seines Regelsatzes.

<a id="related-guides"></a>

## Verwandte Anleitungen

- [Game Mode: Kampf](combat.md)
- [Game Mode: Party und NPCs](party-and-npcs.md)
- [Game Mode: Würfel und Fertigkeitsproben](dice-and-skill-checks.md)
