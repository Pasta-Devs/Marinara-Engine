# Game Mode: Kampf

Kämpfe gibt es im Game Mode in zwei Arten: **Turn-Based** (Menükämpfe) und **Tactical** (Rasterkämpfe). Du wählst zwischen ihnen mit **Combat Preference** (bevorzugte Kampfart) im Schritt **World** (Welt) des Einrichtungsassistenten. Um das später zu ändern, öffne **Chat Settings** (Chat-Einstellungen), klapp **Combat Style** (Kampfstil) auf und wähle ein **Battle system** (Kampfsystem). Ein Regelsatz, der seine eigenen Kämpfe führt, kann die Auswahl einschränken. Der Game Master (GM, die KI, die das Spiel leitet) legt die Begegnung fest und erzählt das Ergebnis. Marinara wertet die Kampfaktionen mit fester Würfelmathematik aus, die KI entscheidet also nie, wer trifft.

## Eine Kampfbegegnung beginnt

Den Kampf startest du nicht selbst. Der GM eröffnet ihn, sobald die Geschichte es verlangt, etwa wenn du einen Gegner reizt oder in einen Hinterhalt läufst. Dann legt sich ein vollständiger Kampfbildschirm über die Erzählung, gebaut aus dem, was gerade in der Geschichte passiert: deine Party, die Gegner, deren Werte und etwaige Sonderregeln.

Der Bildschirm zeigt deine Party auf der einen Seite und die Gegner auf der anderen. Jeder Kämpfer hat eine Lebensleiste (HP, Trefferpunkte) und, sofern er Fertigkeiten einsetzt, eine Magieleiste (MP, Magiepunkte). Oben stehen **Next:** und der Name dessen, der als Nächstes handelt, sowie **Round** mit der Rundennummer.

Wie ein Kampf entschieden wird, hängt vom Charaktersystem des Spiels ab. Jedes neue Spiel nutzt **MRPG**-Klassen: Jeder Kämpfer kämpft mit den Werten, Fertigkeiten und der Ausrüstung seiner Klasse (siehe [Kämpfe in einem MRPG-Spiel](#battles-in-an-mrpg-game)). Ein **Legacy**-Spiel, das vor den MRPG-Klassen angelegt wurde, nutzt die älteren Regeln für Angriff und Verteidigung unter [So rechnet der Kampf](#how-combat-math-works). Die Bildschirme und Schaltflächen unten sind bei beiden gleich.

> **Hinweis:** In einem Spiel mit einem Regelsatz, der seine Kämpfe selbst auflöst, etwa 5e (SRD 5.1), folgt der Kampf dem Regelsatz, nicht dieser Seite. Siehe [Kämpfe mit einem Regelsatz](fighting-on-a-ruleset.md). Ein Regelsatz, der Kämpfen nur seinen Charakterbogen leiht, behält den Kampf von hier. Siehe [Was in Kämpfen passiert](rulesets.md#what-happens-in-battles).

## Einen Turn-Based-Kampf spielen

Ein Turn-Based-Kampf hat kein Spielfeld. Alle Mitglieder der Party nehmen teil. Du wählst die Aktion für einen Charakter, das erste lebende Partymitglied. Die übrigen Begleiter handeln selbstständig.

Bist du am Zug, wähle eine Aktion:

| Aktion | Was sie tut |
| --- | --- |
| **Attack** (Angriff) | Trifft einen Gegner mit einem einfachen Angriff. |
| **Skills** (Fertigkeiten) | Setzt eine besondere Fähigkeit ein. Fertigkeiten können MP kosten. Manche heilen einen Verbündeten, manche treffen einen Gegner, manche verteilen einen Buff oder Debuff. |
| **Special** (Sonderaktion) | Tipp eine frei formulierte Aktion in eigenen Worten ein und drück dann auf **Ask GM** (den GM fragen), zum Beispiel „Ich kicke Sand in die gesprungene Linse des Ruin Guard.“ Was passiert, entscheidet der GM. |
| **Defend** (Verteidigen) | Erhöht deine Verteidigung für den Rest der Runde, sodass du weniger Schaden nimmst. |
| **Items** (Gegenstände) | Setzt einen Gegenstand aus deiner Tasche ein. **Full inventory** (vollständiges Inventar) öffnet deine komplette Gegenstandsliste. |
| **Flee** (Fliehen) | Verlässt den Kampf sofort. Das gelingt immer und beendet den Kampf augenblicklich. |

Nach deiner Wahl läuft die Runde ab. Die Ergebnisse erscheinen als aufsteigende Schadenszahlen, als sich ändernde Lebensleisten und als Zeilen in **Combat Log** (Kampfprotokoll). Gewinnst du, erscheint das Banner **Victory!**, fällt deine Party, das Banner **Defeat...**.

In einem Spiel mit Regelsatz tut **Items** bei den eigenen Gegenständen des Regelsatzes, was der Regelsatz sagt: wie viel sie heilen oder schaden und welche Zustände sie verursachen. Ein Gegenstand mit Ladungen wird angeboten, solange eine Nutzung übrig ist. Bei einem Gegenstand, der zuerst eine Probe verlangt, wird sie gewürfelt, und misslingt sie, ist der Gegenstand umsonst verbraucht. Ein Gegenstand, dem der Regelsatz keine Nutzung gibt, wird nicht angeboten. Andere Gegenstände tun, was der GM zu Kampfbeginn festgelegt hat, außer der Regelsatz schaltet die eigenen Gegenstände von Game Mode ab.

## Einen Tactical-Kampf spielen

Im Tactical-Kampf stehen deine Party und die Gegner auf einem Schlachtfeld mit Raster. Jedes Quadrat ist ein Feld, etwa **Plains** (Ebene) oder **Forest** (Wald).

1. Bist du am Zug (**Player Phase**, oder am Namen einer Einheit steht „'s turn“), klick auf dem Raster auf eine deiner Einheiten. Ihre Bewegungsreichweite erscheint auf dem Spielfeld.
2. Klick auf ein Zielfeld und dann auf **Confirm Move** (Bewegung bestätigen). Mit **Reset Move** (Bewegung zurücksetzen) wählst du neu.
3. Nach der Bewegung meldet das Spielfeld „Already moved — choose an action.“ Wähle **Attack**, **Defend** oder **Item** (Gegenstand). Auch **Flee** steht hier.
4. Bei **Attack** meldet das Spielfeld **Select an enemy**. Klick auf einen Gegner. Die Angriffsvorschau zeigt das erwartete Ergebnis. Klick auf **Confirm** (Bestätigen), um dich festzulegen. **← Back** (zurück) geht einen Schritt zurück.
5. Klick auf **End Turn** (Zug beenden), wenn du fertig bist. In der Zugreihenfolge, in der die Party zuerst zieht, folgt dann die **Enemy Phase**.

Zeigt das Spielfeld **Resolving…**, warte einen Moment. **Restart** (Neustart) startet den Kampf nach einer Bestätigung von vorn, auf demselben Schlachtfeld.

Wer wann handelt, hängt von **Turn order** (Zugreihenfolge) ab. Siehe [Zugreihenfolge](#turn-order). Handgemachte Spielfelder und Geländeregeln stehen unter [Taktische Kämpfe und Gelände](#tactical-battles-and-terrain).

<a id="battles-in-an-mrpg-game"></a>

## Kämpfe in einem MRPG-Spiel

In einem Spiel mit MRPG-Klassen kämpft jedes Partymitglied mit seiner aktiven Klasse: ihren Werten, ihren Fertigkeiten und der Ausrüstung auf seinem Bogen (siehe [MRPG-Klassen](mrpg-classes.md)). Gegner kämpfen je nach Rang als Lakai, Standardgegner, Elitegegner oder Boss. Ein Panel neben dem Kampf zeigt, wer als Nächstes handelt, sowie Klasse, Stufe, Reihe und Ressourcen jedes Kämpfers und am Ende, was die Party erhalten hat.

<a id="turns-skills-and-resources"></a>

### Züge, Fertigkeiten und Ressourcen

- **Zugreihenfolge.** Initiativewürfe gibt es nicht. Die Kämpfer handeln auf einer Zeitleiste. Jede Aktion schiebt den nächsten Zug eines Kämpfers nach hinten – je höher seine Speed, desto weniger weit. Schnelle Kämpfer handeln deshalb häufiger.
- **Fertigkeiten.** **Skills** führt die Fertigkeiten der aktiven Klasse und die mitgeführten Fertigkeiten auf, jeweils mit Kosten und einer Schätzung ihrer Wirkung. Magische Fertigkeiten kosten **MP**, die während des Kampfes nicht zurückkehren. Die übrigen kosten **Stamina**, von der sich in jedem Zug ein wenig erholt.
- **Verteidigen.** Erhöht Defense bis zum nächsten Zug des Kämpfers um die Hälfte und stellt mehr Stamina wieder her.
- **Munition und Elemente.** Ein Marksman lädt im Panel neben dem Kampf eine Munitionsart, ein Channeler kanalisiert dort ein Element. Beides zu wechseln ist kostenlos. Wenn du nichts auswählst, nimmt die KI die beste Option für das Ziel.

<a id="hitting-and-damage"></a>

### Treffer und Schaden

- **Trefferchance.** Sie steigt mit Skill und Luck des Angreifers und sinkt mit Speed und Luck des Ziels. Unter 25 % fällt sie nie.
- **Kritische Treffer.** Sie ergeben sich aus Skill des Angreifers gegen Luck des Ziels und verursachen doppelten Schaden.
- **Schaden.** Ein Waffenangriff verursacht Strength plus Angriffskraft abzüglich Defense des Ziels. Ein Zauber oder ein Treffer mit einem Stab, Zauberstab oder Fokus nutzt stattdessen Magic gegen Resistance. Die Angriffskraft wächst mit der Stufe ein wenig, so wie es bessere Ausrüstung tun würde.
- **Schadensarten.** Jeder Treffer hat eine Art: Hieb, Stich oder Wucht bei Waffen, ein Element (Feuer, Eis, Blitz, Wind, Holz, Erde, Wasser oder Metall) oder Licht beziehungsweise Dunkelheit. Ein Gegner kann gegen eine Art schwach sein (anderthalbfacher Schaden), ihr widerstehen (halber Schaden), gegen sie immun sein oder sie absorbieren. Eine Schwäche oder Resistenz wird beim Gegner angezeigt, sobald ein Treffer sie aufgedeckt hat, und die Party merkt sie sich für alle Gegner dieser Art. Elementare Schwächen von Gegnern folgen dem Zyklus der fünf Wandlungsphasen, in dem jedes Element das nächste überwindet: Holz spaltet Erde, Erde staut Wasser, Wasser löscht Feuer, Feuer schmilzt Metall und Metall schneidet Holz.

<a id="rows"></a>

### Reihen

Ein Turn-Based-Kampf hat auf jeder Seite eine vordere und eine hintere Reihe. Ein Nahkampftreffer gegen die hintere Reihe verursacht in beide Richtungen halben Schaden, während Fernangriffe und Zauber beide Reihen mit vollem Schaden treffen. Steht niemand in der vorderen Reihe einer Seite, wird ihre hintere Reihe zur vorderen. Jede Klasse hat eine Standardreihe. Du kannst die Reihe eines Charakters im Tab **Status** (Status) seines Bogens ändern. Tactical-Kämpfe haben keine Reihen: Die Positionen auf dem Spielfeld entscheiden, wer wen erreichen kann.

<a id="taunts-yielding-and-taming"></a>

### Provokation, Aufgabe und Zähmen

- **Provoke.** Provoke eines Sentinels zwingt alle Gegner, den Sentinel 2 Züge lang anzugreifen. Kann ein Gegner ihn auf einem Spielfeld nicht erreichen, kommt er so nah wie möglich heran und macht sich stattdessen bereit.
- **Aufgeben.** Ein intelligenter Gegner, der am Verlieren ist, kann sich ergeben oder fliehen. Haben alle verbliebenen Gegner aufgegeben, fragt der Kampf **Spare them** (verschonen) oder **Finish them** (erledigen). In beiden Fällen erhält die Party Beute und Erfahrung. Ein Gegner, der einen Schatz trägt und flieht, entkommt mit seiner Beute.
- **Zähmen.** Ein Tracker kann ein wildes Tier zähmen, das weniger als 30 % HP hat. Es verlässt den Kampf und wird zu einem Gefährten, den der Charakter auch behält, wenn der Kampf danach verloren geht.

<a id="after-the-fight"></a>

### Nach dem Kampf

Ein gewonnener Kampf bringt allen, die gekämpft haben, Erfahrung (siehe [Stufen und Erfahrung](mrpg-classes.md#levels-and-experience)). Das Abschlusspanel zeigt jede gewonnene Stufe, die gestiegenen Werte und alle nun offenen Beförderungen. Ein verlorener Kampf oder eine Flucht bringt nichts. Ist **Permadeath** (dauerhafter Tod) an, ist ein Partymitglied, das am Kampfende am Boden liegt, für immer verloren.

In einem MRPG-Spiel bestimmt **Difficulty** (Schwierigkeit), wie viele Gegner kommen und wie stark sie sind, statt ihren Schaden zu multiplizieren. Auf **Brutal** können Gegner mehrere Stufen über der Party stehen.

## Den GM unterbrechen

Solange der GM schreibt, kannst du mit der Schaltfläche **Interrupt** (Unterbrechen) dazwischengehen. Nichts, was du tippst, zählt, bevor du es abschickst.

1. Klick auf **Interrupt**. Ein Fenster mit dem Titel **Attempt to Interrupt?** öffnet sich.
2. Wähle eine Möglichkeit:
   - **No** (Nein) bricht ab und lässt den GM weiterschreiben.
   - **Force Interrupt** (Unterbrechung erzwingen) geht sauber dazwischen. Der GM erfährt nicht, dass du unterbrochen hast. Dein Eingabefeld bekommt einen grünen Rahmen.
   - **Yes** (Ja) versucht eine Unterbrechung innerhalb der Geschichte, gegen die sich der GM wehren kann. Dein Eingabefeld färbt sich rot, die App weist mit „using dice recommended“ auf Würfel hin, und die Würfel-Schaltfläche pulsiert. Ein Würfelwurf kann helfen.
3. Tipp deine Nachricht ein und schick sie ab.

Überlegst du es dir anders, drück auf **Resume** (fortsetzen). Die offene Unterbrechung verfällt, und die Erzählung läuft weiter.

## Quick-Time-Events

Für schnelle Momente wie Ausweichen oder Verfolgen kann der GM ein Quick-Time-Event (QTE) auslösen. Das Overlay zeigt eine schrumpfende Countdown-Leiste, die Aufforderung **React quickly!** (schnell reagieren) und je eine nummerierte Schaltfläche pro Möglichkeit. Klick auf die gewünschte Aktion, bevor die Zeit abläuft, dann bekommst du einen Bonus. Je schneller du reagierst, desto größer der Bonus. Läuft die Zeit ab, kassierst du stattdessen einen Malus. Ein QTE kommt ohne Würfel aus.

Willst du QTEs ausschalten, etwa für Screenreader oder für Spiel ohne Zeitdruck, schalte im Schritt **Features** des Assistenten **Quick Time Events** aus.

## Kampf auf dem Handy

Auf dem Handy kleben die Aktionsschaltflächen am unteren Bildschirmrand. Panels, die keinen Platz finden, wandern in ein Panel, das sich von unten aufschiebt und vier Tabs hat: **Party** (Mitglieder und Lebensstand), **Boss Mechanics** (die Sonderregeln des Kampfes), **Dialogue** (Kampfsprüche der Kämpfer) und **Combat Log** (der Verlauf Runde für Runde). Tipp auf einen Tab, um sein Panel zu öffnen. Zum Schließen tippst du daneben oder auf die Schließen-Schaltfläche.

<a id="how-combat-math-works"></a>

## So rechnet der Kampf

Die Regeln in diesem Abschnitt gelten für **Legacy**-Spiele und für Spiele, deren Regelsatz Marinaras Kämpfen seinen Charakterbogen leiht. Ein Spiel mit **MRPG**-Klassen – also jedes neue Spiel – kämpft stattdessen nach den Regeln unter [Kämpfe in einem MRPG-Spiel](#battles-in-an-mrpg-game).

Jede Runde entscheidet feste Würfelmathematik, nicht die KI. So bleibt der Kampf fair und nachvollziehbar. Ein d20 ist ein zwanzigseitiger Würfel (1 bis 20). Zu Tactical-Kämpfen siehe außerdem [Zugreihenfolge](#turn-order) und [Sicht, Deckung und Höhe](#sight-cover-and-height).

**Initiative.** Zu Beginn jeder Runde würfelt jeder Kämpfer einen d20 und addiert einen Bonus aus seiner Geschwindigkeit (Geschwindigkeit geteilt durch 5, abgerundet). Höhere Summen handeln zuerst. Ein Kämpfer setzt die Runde aus, wenn er eingefroren, betäubt oder gefesselt ist oder seine Geschwindigkeit auf 0 gefallen ist.

**Angriff und Verteidigung.** Greift ein Kämpfer einen anderen an:

1. Der Angreifer würfelt einen d20 und addiert einen Bonus aus seinem Angriffswert.
2. Der Verteidiger würfelt einen d20 und addiert einen Bonus aus seinem Verteidigungswert.
3. Ist die Summe des Angreifers niedriger, geht der Angriff daneben.
4. Ein kritischer Treffer gelingt bei einer natürlichen 20 oder wenn der Angreifer den Verteidiger um 10 oder mehr übertrifft.

**Schaden.** Bei einem Treffer ergibt sich der Grundschaden aus dem Angriffswert des Angreifers und wächst mit der Stufe. Dazu kommen zusätzliche d6, und höherstufige Kämpfer würfeln mehr davon. Ein kritischer Treffer multipliziert die Summe mit 1,5. Danach blockt die Verteidigung des Verteidigers bis zu 40 Prozent ihres eigenen Werts von diesem Schaden.

<a id="difficulty-scaling"></a>

### Skalierung nach Schwierigkeit

In einem Legacy-Spiel wird der Schaden als Nächstes mit der **Difficulty** skaliert, die du im Einrichtungsassistenten festlegst. Modifikatoren durch Wetter und Statuseffekte wirken erst danach. Der Multiplikator gilt nur für Angriffe von Gegnern: Ein schwierigeres Spiel lässt die Gegner härter zuschlagen, während der Schaden deiner Party gleich bleibt.

| Schwierigkeit | Schadensmultiplikator der Gegner |
| --- | --- |
| Casual | 0,6 |
| Normal | 1,0 |
| Hard | 1,3 |
| Brutal | 1,6 |

Diese Multiplikatoren gehören zu Marinaras eigenen Regeln. Ein Regelsatz bringt seine eigenen Schwierigkeitsregeln mit.

## Statuseffekte und elementare Reaktionen

Dieser Abschnitt beschreibt Legacy-Kämpfe. Ein MRPG-Spiel hat eigene Schadensarten (siehe [Treffer und Schaden](#hitting-and-damage)). Die Effekte seiner Fertigkeiten wie Poisoned, Asleep oder Slowed sind bei der jeweiligen Fertigkeit beschrieben.

Ein Statuseffekt verändert Angriff, Verteidigung, Geschwindigkeit oder HP eines Kämpfers vorübergehend. Buffs helfen, Debuffs schaden. Ein Status hält eine festgelegte Zahl an Runden und verfliegt dann. Gifteffekte zehren jede Runde an den HP, Regenerationseffekte füllen sie auf. Eingefroren, betäubt und gefesselt lassen den Kämpfer seinen Zug aussetzen.

Manche Angriffe und Fertigkeiten tragen ein Element. Das erste Element, das ein Ziel trifft, hinterlässt eine Aura, eine nachwirkende Spur. Trifft ein anderes Element dasselbe Ziel, löst das eine elementare Reaktion aus, die Bonusschaden bringt und oft einen Statuseffekt. Zu den Reaktionen zählen Melt, Shatter, Overload, Superconduct, Toxic Blaze, Purification, Eclipse und Electrotoxin. Sie entstehen automatisch, einschalten musst du sie nicht.

### Elemente

Welche Elemente es gibt, gehört zum Setting:

- Kein Setting-Kit oder ein Kit, das keine nennt: die klassischen sechs (Feuer, Eis, Blitz, Gift, Heiliges, Schatten).
- Wuxia: die fünf Wandlungsphasen (Holz, Feuer, Erde, Metall, Wasser), von denen jede die nächste überwindet.
- Cyberpunk und Space Opera: kinetisch, thermisch, EM sowie chemisch oder Plasma.
- Gegenwart und 1920er-Jahre: keine.

Regen und Sturm auf offenem Gelände dämpfen feuerartige Elemente und stärken blitzartige. In einem taktischen Kampf trifft ein Element härter gegen eines, das es schlägt, und schwächer gegen eines, von dem es geschlagen wird. Die Elemente und Reaktionen eines Kits kannst du unter **Change its words** (Wörter ändern) ändern. Siehe [Ein Setting-Kit wählen](getting-started.md#choosing-a-setting-kit).

## Boss-Mechaniken und Beute

Starke Gegner können Boss-Mechaniken haben, Sonderregeln, die der GM für genau diesen Kampf schreibt. Eine Mechanik greift nach Zeitplan, etwa alle paar Runden, oder sobald der Boss unter einen bestimmten Lebensstand fällt. Sie kann die ganze Party treffen, den Boss stärken oder einen Statuseffekt verteilen. Löst eine aus, zeigt **Combat Log** sie an, damit du reagieren kannst.

Gewinnst du, lassen die Gegner Beute fallen, die direkt in den Taschen der Party landet. Gegenstände haben eine Seltenheit, von common über uncommon, rare und epic bis legendary. Höhere Schwierigkeit verschiebt die Beute zu selteneren Gegenständen und wirft etwas mehr davon ab. Eine Benachrichtigung nennt, was gefallen ist, und der GM erfährt, dass es schon in deinen Taschen ist.

Was fällt, gehört zu deinem Setting. Ein Spiel mit Setting-Kit wirft die eigene Beute des Kits ab (ein Spiel in der Gegenwart eine Geschenkkarte oder ein Erste-Hilfe-Set, nie ein verzaubertes Schwert), und du kannst diese Begriffe unter **Change its words** ändern. Ein Spiel ohne Kit wirft ab, was sein Genre üblicherweise hat. Ein Genre ohne Starter-Kit, etwa Steampunk, wirft schlichte Dinge ab, die zu keinem Setting gehören. In einem Spiel, dessen Regelsatz eigene Beutetabellen hat, werfen die Gegner stattdessen die Gegenstände des Regelsatzes ab, und ein Regelsatz, der die eigenen Gegenstände von Game Mode abschaltet, wirft nur seine eigenen ab.

## Referenz: taktische Kämpfe

<a id="tactical-battles-and-terrain"></a>

### Taktische Kämpfe und Gelände

Beim Erstellen eines Spiels gibt es keine Schlachtfeldeinstellungen auszufüllen. Jeder Kampf erhält ein eigenes Spielfeld, generiert aus einem neuen Seed und der Vorgabe des GM für die Szene. Der GM liefert Umgebung, Formation und eine kurze Geländevorgabe, die Geländeabschnitte und Barrieren nahe der Mitte oder an einem Rand verlangen kann. Marinara erzeugt die genauen Felder und Startpositionen. Das akzeptierte Schlachtfeld wird gespeichert, sodass ein Neuladen dieses Spielfeld wiederherstellt.

Marinara prüft Vorgabe und Aufbau. Das angeforderte Gelände bleibt erhalten, und die Begegnung bleibt zugleich erreichbar.

Lassen sich die Bedingungen nicht vereinbaren, meldet der Kampf das Problem. **Use generated terrain** (generiertes Gelände verwenden) startet dann ohne die abgelehnten Geländeelemente. Stillschweigend entfernt werden sie nie.

Eine Welt kann auch handgemachte Schlachtfelder haben: Spielfelder, die Feld für Feld für einen ihrer Orte gemalt wurden, mit einem Welteditor wie Pixelforge. Beginnt ein Kampf an diesem Ort oder an einem Ort darin, nutzt er eines dieser Spielfelder statt eines generierten.

- Das Spielfeld wird genau so verwendet, wie es gemalt wurde. Hat der Ort mehrere, entscheidet der Seed des Kampfes, eine Zahl, die eines davon auswählt.
- Die Geländevorgabe des GM wird dort nicht genutzt, seine Formation entscheidet aber weiterhin, wo jede Seite startet. Der GM erfährt, dass das Spielfeld für diesen Ort gemacht wurde.
- Ein handgemachtes Spielfeld muss drei Regeln folgen: Es hat eine der drei Spielfeldgrößen, die beiden Spalten an jeder Seite, an denen sich die Seiten aufstellen, sind Ebenen, und jedes Feld, auf dem ein Kämpfer stehen kann, ist mit dem Rest verbunden. Der Editor lehnt ein Spielfeld ab, das eine Regel verletzt, und sagt, warum.

Diese Spielfelder werden mit den Änderungen von Hand an der Welt gespeichert und reisen so in Weltdateien, Kartenpaketen und der Bibliothek mit.

| Gelände | Gehen | Verteidigung und Ausweichen |
| --- | --- | --- |
| Ebene | Kostet 1 Bewegungspunkt | Kein Bonus |
| Wald | Kostet 2 Bewegungspunkte | +1 Verteidigung, +15 Prozentpunkte Ausweichen |
| Ruinen | Kostet 1 Bewegungspunkt | +1 Verteidigung, +10 Prozentpunkte Ausweichen |
| Berg, Wasser, Wand | Blockiert Gehen | Kein Bonus |

Einheiten mit einer etablierten Flug- oder Teleportationsfähigkeit bewegen sich anders:

- **Gehen** folgt erreichbaren Bodenfeldern. Gegnerische Einheiten versperren den Weg, und auf einem belegten Feld kann eine Einheit ihre Bewegung nicht beenden.
- **Fliegen** überquert Gelände und Einheiten für einen Bewegungspunkt pro Feld, auch im Wald. Eine fliegende Einheit kann über einem sonst blockierten Feld schweben, aber nicht auf einer anderen Einheit enden.
- **Teleportation** ignoriert Gelände und Einheiten dazwischen. Das Ziel muss in Bewegungsreichweite liegen, frei und begehbar sein. Es darf nicht in einer Wand, auf einem Berg oder über Wasser ohne Untergrund liegen.

Beide Sonderbewegungen nutzen das aktuelle Bewegungsbudget und die gerade (nicht diagonale) Felddistanz. Sie behalten die Verteidigungs- und Ausweichboni des Zielfelds und ignorieren Höhe. Die Flughöhe eines Fliegers, Decken sowie zauberspezifische Kosten und Sichtanforderungen werden nicht abgebildet. Beschwörungen gehören noch nicht zu Marinaras eigenem Kampfsystem.

<a id="turn-order"></a>

### Zugreihenfolge

Ein Tactical-Kampf verteilt die Züge auf eine von zwei Arten:

- **One at a time, by initiative** (einzeln nach Initiative): Jede Einheit bekommt einen Platz in einer ausgewürfelten Reihenfolge, und nur die Einheit, die am Zug ist, kann handeln. Das Spielfeld zeigt die Reihenfolge. Neue Overworld-Spiele nutzen diese Art.
- **Your whole party, then the enemies** (erst die ganze Party, dann die Gegner): Jede Einheit der Party kann handeln, dann folgt die Gegnerphase. VN-Spiele nutzen diese Art.

Zum Ändern öffne **Chat Settings**, klapp **Combat Style** auf und wähle eine **Turn order**. Die Option erscheint, solange das **Battle system** auf Tactical steht, außer wenn der Regelsatz des Spiels seine Kämpfe selbst führt. Die Änderung gilt ab dem nächsten Kampf. Ein laufender Kampf behält seine Reihenfolge.

<a id="sight-cover-and-height"></a>

### Sicht, Deckung und Höhe

- **Sicht.** Wände und Berge blockieren die Sicht. Eine Einheit kann nur dann angreifen, eine Fertigkeit oder einen Gegenstand einsetzen, wenn sie das Ziel sieht.
- **Deckung.** Etwas zwischen Angreifer und Ziel schützt das Ziel. Ein Wald- oder Ruinenfeld dazwischen oder eine Wand oder ein Berg, die einen Teil der Sicht versperren, geben halbe Deckung. Eine Wand oder ein Berg, die den größten Teil der Sicht versperren, geben Dreivierteldeckung. Halbe Deckung zieht 15 Prozentpunkte von der Trefferchance ab, Dreivierteldeckung 30. Der Bonus des Feldes, auf dem das Ziel steht, und seine Deckung addieren sich nicht: Es zählt der bessere Wert.
- **Höhe.** Auf einem Spielfeld mit Bergen ist ein Berg zwei Stufen hoch und der Boden um ihn herum eine Stufe. Eine Stufe hinaufzugehen kostet einen Bewegungspunkt mehr, hinunterzugehen kostet nichts. Ein Absatz von zwei oder mehr Stufen ist eine Klippe, über die niemand gehen kann. Höheres Gelände blockiert außerdem die Sicht zwischen zwei niedrigeren Feldern. Ein Angriff von höherem Gelände nach unten erhöht die Trefferchance um 10, ein Fernangriff von höherem Gelände reicht ein Feld weiter, und niedrige Deckung wie ein Wald verbirgt ein Ziel nicht vor einem Angriff von oben. Handgemachte Schlachtfelder können eigene Klippen haben.

### Schlachtfeldszenen

Ein taktisches Spielfeld ist wie der Ort angelegt, an dem der Kampf stattfindet: Ein Wald hat Bäume zum Verstecken, ein Dungeon Wände und Korridore, eine Stadt Straßen. Ein Spiel mit Setting-Kit benennt seine eigenen Szenen in seinen Worten, sodass ein Cyberpunk-Kampf auf einem Dach oder im Korridor eines Megablocks stattfindet und ein Wuxia-Kampf in einem Bambuswald oder einem Teehaus. Auch die Felder des Spielfelds tragen die Begriffe des Settings (Deckung und Trümmer statt Wald und Ruinen). Die Szenen und Feldbegriffe eines Kits kannst du unter **Change its words** ändern.

## Verwandte Anleitungen

- [Game Mode: Kämpfe mit einem Regelsatz](fighting-on-a-ruleset.md)
- [Game Mode: Würfel und Fertigkeitsproben](dice-and-skill-checks.md)
- [Game Mode: Party und NPCs](party-and-npcs.md)
- [Game Mode: Erste Schritte](getting-started.md)
- [Kampfbegegnungen (Roleplay)](../roleplay/combat-encounters.md)
