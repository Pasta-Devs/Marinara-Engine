# Game Mode: Kampf

Dieser Leitfaden erklärt Kämpfe im Game Mode von Marinara Engine. Wähle im Einrichtungsschritt **World** (Welt) unter **Combat Preference** (bevorzugte Kampfart) zwischen **Classic** (Menükämpfen) und **Tactical** (Rasterkämpfen). Der KI-Game-Master (GM) legt die Begegnung fest und erzählt die Ergebnisse; die Engine wertet Kampfaktionen aus.

<a id="tactical-battles-and-terrain"></a>

## Taktische Kämpfe und Gelände

Im taktischen Kampf stehen deine Gruppe und die Gegner auf einem Schlachtfeld. Wähle eine Gruppeneinheit, prüfe ihre Bewegungsreichweite, wähle Ziel und Aktion und bestätige sie. Wer wann handelt, hängt von der **Turn order** (Zugreihenfolge) des Kampfes ab (siehe [Zugreihenfolge](#turn-order)). Angriffsvorschauen zeigen die erwarteten Folgen vor der Bestätigung.

Beim Erstellen eines Tactical-Spiels kannst du optional Seed, Größe und Geländehinweise für den GM festlegen. Bei leerem Seed-Feld wird ein Seed erzeugt. Er ist eine ganze Zahl von 0 bis 4294967295, einschließlich null. Bei gleichen Kämpfern, gleicher Geländevorgabe und gleichen weiteren Eingaben reproduziert er das Spielfeld; er zwingt den GM nicht zu derselben Geschichte oder denselben Gegnern.

Der GM liefert Umgebung, Formation und eine kurze Geländevorgabe. Die Engine erzeugt daraus genaue Felder und Startpositionen. Vorgaben können Geländeabschnitte und Barrieren nahe der Kartenmitte oder am Rand verlangen. Geländehinweise sind ein Wunsch an den GM, keine Garantie, dass jedes Wort zu einem Feld wird. Das akzeptierte Schlachtfeld wird gespeichert und beim Neuladen wiederhergestellt.

Die Engine prüft Vorgabe und Ergebnis. Sie erhält das angeforderte Gelände und stellt zugleich die Erreichbarkeit sicher. Lassen sich die Bedingungen nicht vereinbaren, meldet der Kampf das Problem. **Use generated terrain** (generiertes Gelände verwenden) startet ausdrücklich ohne die abgelehnten Geländeelemente; sie werden nicht stillschweigend entfernt.

Die Welt eines Spiels kann auch **handgemachte Schlachtfelder** haben. Das sind Spielfelder, die Feld für Feld für einen der Orte der Welt gemalt wurden, mit einem Editor wie Pixelforge. Beginnt ein Kampf, während die Party an diesem Ort oder an einem Ort darin ist, nutzt der Kampf eines dieser Spielfelder statt eines generierten. Das Spielfeld wird genau so verwendet, wie es gemalt wurde, in der Szene, für die es gemalt wurde. Hat der Ort mehrere Spielfelder, wählt der Seed des Kampfes eines aus. Die Geländevorgabe des GM wird dort nicht genutzt, seine Formation entscheidet aber weiterhin, wo jede Seite startet. Der GM erfährt, dass das Spielfeld für diesen Ort gemacht wurde, und die Schlachtfeldzeile nennt das Spielfeld.

Ein handgemachtes Spielfeld muss drei Regeln folgen. Es hat eine der drei Spielfeldgrößen. Die beiden Spalten an jeder Seite, an denen sich die Seiten aufstellen, sind Ebenenfelder. Jedes Feld, auf dem ein Kämpfer stehen kann, ist mit dem Rest verbunden. Der Editor lehnt ein Spielfeld ab, das eine Regel verletzt, und sagt, warum. Handgemachte Schlachtfelder werden mit den Änderungen von Hand an der Welt gespeichert und reisen so mit ihr in Weltdateien, Kartenpaketen und der Weltbibliothek.

| Gelände | Gehen | Verteidigung und Ausweichen |
| --- | --- | --- |
| Ebene | Kostet 1 Bewegungspunkt | Kein Bonus |
| Wald | Kostet 2 Bewegungspunkte | +1 Verteidigung, +15 Prozentpunkte Ausweichen |
| Ruinen | Kostet 1 Bewegungspunkt | +1 Verteidigung, +10 Prozentpunkte Ausweichen |
| Berg, Wasser, Wand | Blockiert Gehen | Kein Bonus |

Einheiten mit einer etablierten Flug- oder Teleportationsfähigkeit können sich anders bewegen:

- **Gehen** folgt erreichbaren Bodenfeldern. Gegner versperren den Weg; auf belegten Feldern darf eine Bewegung nicht enden.
- **Fliegen** überquert Gelände und dazwischenstehende Einheiten für einen Bewegungspunkt pro Feld, auch im Wald. Eine fliegende Einheit darf über einem sonst blockierten Feld schweben, aber nicht auf einer anderen Einheit enden.
- **Teleportation** ignoriert Gelände und Einheiten unterwegs. Das Ziel muss in Bewegungsreichweite liegen, frei und begehbar sein. Eine Teleportation darf nicht in einer Wand, auf einem Bergfeld oder über Wasser ohne Untergrund enden.

Beide Sonderbewegungen nutzen das aktuelle Bewegungsbudget und die orthogonale Felddistanz. Verteidigungs- und Ausweichboni des Zielfelds bleiben erhalten. Beide ignorieren Höhe (siehe unten). Die Flughöhe eines Fliegers, Decken sowie zauberspezifische Kosten und Sichtanforderungen werden nicht abgebildet.

<a id="turn-order"></a>

### Zugreihenfolge

Ein Tactical-Kampf verteilt die Züge auf eine von zwei Arten:

- **One at a time, by initiative** (einzeln nach Initiative): Jede Einheit bekommt einen Platz in einer ausgewürfelten Reihenfolge, und nur die Einheit, die am Zug ist, kann handeln. Das Spielfeld zeigt die Zugreihenfolge. Neue Overworld-RPG-Spiele nutzen diese Art.
- **Your whole party, then the enemies** (erst die ganze Party, dann die Gegner): Jede Einheit der Party kann handeln, dann folgt die Gegnerphase. Classic-Spiele nutzen diese Art.

Zum Ändern öffne **Chat Settings** (Chat-Einstellungen), klapp **Combat Style** (Kampfstil) auf und wähle eine **Turn order**. Die Option erscheint, solange das **Battle system** (Kampfsystem) auf Tactical steht, außer wenn der Regelsatz des Spiels seine Kämpfe selbst führt. Die Änderung gilt ab dem nächsten Kampf; ein laufender Kampf behält seine Reihenfolge.

### Sicht, Deckung und Höhe

- **Sicht.** Wände und Berge blockieren die Sicht. Eine Einheit kann nur dann angreifen, eine Fertigkeit oder einen Gegenstand einsetzen, wenn sie das Ziel sieht.
- **Deckung.** Etwas zwischen Angreifer und Ziel schützt das Ziel. Ein Wald- oder Ruinenfeld dazwischen oder eine Wand oder ein Berg, die einen Teil der Sicht versperren, geben halbe Deckung. Eine Wand oder ein Berg, die den größten Teil der Sicht versperren, geben Dreivierteldeckung. Halbe Deckung zieht 15 Prozentpunkte von der Trefferchance ab, Dreivierteldeckung 30. Der Bonus des Feldes, auf dem das Ziel steht, und seine Deckung addieren sich nicht: Es zählt der bessere Wert.
- **Höhe.** Auf einem Spielfeld mit Bergen ist ein Berg zwei Stufen hoch und der Boden um ihn herum eine Stufe. Eine Stufe hinaufzugehen kostet einen Bewegungspunkt mehr, hinunterzugehen kostet nichts. Ein Absatz von zwei oder mehr Stufen ist eine Klippe, über die niemand gehen kann. Höheres Gelände blockiert außerdem die Sicht zwischen zwei niedrigeren Feldern. Ein Angriff von höherem Gelände nach unten erhöht die Trefferchance um 10, ein Fernangriff von höherem Gelände reicht ein Feld weiter, und niedrige Deckung wie ein Wald verbirgt ein Ziel nicht vor einem Angriff von oben. Handgemachte Schlachtfelder können eigene Klippen haben.

Vollständige Beschwörungskämpfe sind eine gesonderte spätere Arbeit.

## Klassische Kämpfe

Die folgenden Abschnitte über Aktionsmenüs und Würfelberechnungen beschreiben Classic-Kämpfe. Alle Gruppenmitglieder nehmen teil, aber dein gewählter Befehl steuert den ersten lebenden Kämpfer der Gruppe; die übrigen Begleiter handeln automatisch.

## Eine Kampfbegegnung beginnt

Den Kampf startest du nicht selbst. Der GM eröffnet ihn, sobald die Geschichte es verlangt: etwa wenn du einen Gegner reizt oder in einen Hinterhalt läufst. Dann legt sich ein vollständiger Kampfbildschirm über die Erzählung. Die Engine baut den Kampf aus dem, was gerade in der Geschichte passiert – deine Party (deine Abenteuergruppe), die Gegner, deren Werte und etwaige Sonderregeln.

Auf dem Kampfbildschirm steht deine Party auf der einen Seite, die Gegner stehen auf der anderen. Jeder Kämpfer hat eine Lebensleiste (HP, Trefferpunkte) und, sofern er Fertigkeiten einsetzt, eine Magieleiste (MP, Magiepunkte). Oben zeigt **Next:** an, wer als Nächstes am Zug ist. Ein Rundenzähler nennt **Round** und die aktuelle Rundennummer.

<a id="games-whose-ruleset-resolves-its-own-fights"></a>

### Spiele mit eigener Kampfauflösung des Regelsatzes

Ein Regelsatz kann einen ganzen Kampf nach seinen eigenen Regeln auflösen, statt Marinaras Kampf nur einige Werte zu leihen. Dann gehören ihm auch die Angaben auf dem Kampfbildschirm: die Angriffe und Fähigkeiten deines Charakters, seine Aktionsökonomie, seine Zustände und ein Protokoll mit der tatsächlichen Rechnung. Alles wird sofort bei der Ausführung in den Charakterbogen geschrieben.

Auch was ein Zug umfasst, bestimmt der Regelsatz. Ein Treffer kann mehrere Schadensarten zugleich verursachen; jeder Teil wird getrennt gewürfelt, durch Resistenzen gemindert und mit Rettungswürfen geprüft, bleibt aber Teil desselben Treffers. Ein Aktionsverbrauch kann mehrere Angriffe kaufen. Solange welche übrig sind, bietet das Menü sie kostenlos mit Restzahl an; du kannst dazwischen eine andere Waffe verwenden oder gehen. Eine Fähigkeit kann kostenlos sein, nur für diesen Zug eine zweite Aktion geben oder Sprinten, Rückzug und Verstecken mit einem kleineren Teil des Zuges erlauben. Automatisches Verhalten, etwa Zusatzschaden beim ersten passenden Treffer eines Zuges, wird ohne Auswahl hinzugefügt und im Protokoll genannt. Ein Zustand kann eigene Rettungswürfe erschweren oder erleichtern, alle Schadensarten halbieren, Angriffe auf seinen Verursacher oder Annäherung an ihn verhindern oder bei dessen Ausfall enden. Ein Zustand kann außerdem einen Wert ändern: deine Verteidigung erhöhen, deinen Angriffswürfen, Rettungswürfen und vergleichenden Proben Würfel hinzufügen oder abziehen oder dich verlangsamen. Das Protokoll zeigt jeden davon neben dem Wurf, den er verändert hat, und die Chancen im Menü berücksichtigen ihn. Manche Zustände halten bis zum Beginn deines nächsten Zuges oder nur bis zum nächsten Angriff oder Rettungswurf, um den es geht. Und ein Regelsatz kann etwas wie Erschöpfung auf einer Leiste auf deinem Bogen zählen, sodass jede erreichte Stufe die Lage ein wenig verschlechtert, solange sie anhält.

Ein Regelsatz, dessen Proben eine Handvoll Würfel werfen und die zählen, die ein Ziel erreichen, kann genauso kämpfen. Dann wirft ein Angriff deinen Pool und braucht eine bestimmte Zahl an Erfolgen, um zu treffen, nie weniger als einen, und jeder weitere Erfolg fügt dem Schaden einen Würfel hinzu. Auch der Schaden wird als Würfel geworfen, und wer getroffen wird, kann je nach Schadensart einen Teil davon absorbieren: entweder mit Würfeln zur Schadensminderung, von denen jeder einen Punkt abzieht, oder indem Würfel abgezogen werden, bevor der Schaden geworfen wird. Was übrig bleibt, wird als Wunden markiert. Dein Wundabzug nimmt dir Würfel aus deinen Pools, wie er es bei deinen Proben tut, und ein Zustand fügt Würfel hinzu oder nimmt sie weg. Rettungswürfe und vergleichende Proben sind ebenfalls Pools. Das Protokoll nennt, wie viele Würfel eingesetzt wurden, was sie erreichen mussten, wie viele Erfolge sie fanden und was die Schadensminderung abgezogen hat. Ein solcher Regelsatz kann außerdem zu Beginn jeder Runde die Initiative neu würfeln und begrenzen, wie viel einer Ressource du in einem Zug ausgeben kannst. Was über die Grenze hinausginge, steht dann bis zu deinem nächsten Zug einfach nicht im Menü. Ein Pool-Regelsatz kann die Initiative auch als Zahl führen, die den ganzen Kampf über gilt und die Angriffe verschieben: Du wählst für jeden Angriff, wie du ihn ausführst. Entweder nimmst du dir einen Teil der Zahl deines Ziels, statt ihm zu schaden, oder du gibst deine eigene Zahl als Schadenswürfel aus. Ein Angriff im ausgebenden Stil, der trifft, setzt deine Zahl zurück; einer, der verfehlt, kostet dich so viel davon, wie der Regelsatz sagt. Wer auf die Zusammenbruchsgrenze des Regelsatzes fällt, ist zusammengebrochen und kann nichts ausgeben, bis er sich erholt hat. Die Reihenfolge folgt in jeder Runde den Zahlen, und die Zahl jedes Kämpfers steht neben seiner Gesundheit.

Ein Regelsatz kann außerdem jedem im Kampf eine vergleichende Probe erlauben: jemanden packen, ihn umstoßen oder zurückstoßen oder sich aus einem Griff losreißen. Beide Seiten würfeln und addieren ihren eigenen Wert, die höhere Summe gewinnt, und das Menü zeigt deine Gewinnchance, bevor du wählst. Gewinnst du beim Packen, hältst du deinen Gegner fest, bis er sich losreißt oder du ausfällst; verlierst du, passiert nichts. Losreißen erscheint nur im Menü, solange dich etwas festhält, und nur gegen den, der dich festhält. Ein Stoß bewegt nur auf einem Schlachtfeld jemanden und endet an Wänden und an jedem, der im Weg steht.

Manche Fähigkeiten antworten auf den Zug eines anderen, statt in deinem eigenen Zug eingesetzt zu werden. Wenn ein Gegner gerade etwas einsetzen will, wenn etwas auf dich gerichtet ist, wenn dich ein Angriff gerade getroffen hat oder wenn dir gerade etwas geschadet hat und du für diesen Moment eine Antwort hast, hält der Kampf an, und das Menü bietet sie neben **Pass** (passen) an. Nach einem Treffer nennt das Protokoll, was der Angriff gewürfelt hat und wogegen, sodass du sehen kannst, ob eine Antwort wie Shield ihn zu einem Fehlschlag machen würde. Nimmst du sie, wird derselbe Wurf erneut geprüft, und das Protokoll sagt, ob er noch trifft. Gegner können genauso antworten, mit einer eigenen Parade. Ein Konter kann die Fähigkeit eines Gegners stoppen, bevor sie wirkt, egal auf wen sie gerichtet war, solange der Gegner in Reichweite des Konters ist. Ein Regelsatz kann festlegen, dass ein Konter nur auf bestimmte Arten von Fähigkeiten antwortet, etwa auf Zauber. Was die gestoppte Fähigkeit gekostet hat, bleibt trotzdem ausgegeben, und auf einen Konter kann nichts antworten.

Ein solcher Regelsatz kann auch festlegen, was ein Spielfeldquadrat in seinen eigenen Einheiten bedeutet, etwa Fuß oder Schritte. Dann findet ein Kampf mit **Combat Preference** gleich **Tactical** auf einem Schlachtfeld statt: mit denselben Spielfeldern, generiert oder für den Ort handgemacht, demselben Gelände und derselben Aufstellung wie die oben beschriebenen Tactical-Kämpfe. Die Präferenz wirkt damit auch hier. Ohne Entfernungsangaben oder bei **Classic** bleibt der Kampf wie bisher ohne räumliche Einschränkung der Zielauswahl.

Auf diesem Spielfeld entscheiden die Werte des Regelsatzes: Bewegung pro Zug folgt seiner Bewegungsregel oder der Geschwindigkeit einer Kreatur; Waffenreichweite folgt ihren Zeilen; Fähigkeiten erzeugen wirkliche Kreis-, Kegel- oder Linienflächen; Wände blockieren Schüsse; Deckung wirkt nach den Regeln. Wer die Reichweite eines Gegners verlässt, erlaubt ihm einen Angriff, wenn der Regelsatz dessen Kosten festlegt. Bewegung geht in acht Richtungen für jeweils ein Feld, wie auf den Tischrollenspielrastern dieser Regeln, statt in den vier Richtungen von Marinaras eigenen Tactical-Kämpfen oben.

Das Spielfeld ist sichtbar. Jedes Feld ist eine Schaltfläche, erreichbar mit Zeiger oder Pfeiltasten, und beschreibt Gelände, Besetzung und Bewegungskosten. **Move** (bewegen) markiert erreichbare Felder mit ihren Kosten in der Einheit des Regelsatzes, zeichnet beim Zeigen oder Fokussieren den Weg und markiert Felder mit drohenden Angriffen bernsteinfarben; die Gegner werden darunter genannt. Eine Aktion mit Ziel markiert zulässige Ziele, die du auf dem Brett oder in der Liste wählen kannst. Ohne erreichbares Ziel erscheint **Nobody is in reach. Move closer.** statt eines wirkungslosen Angriffs. Flächenaktionen zielen auf ein Feld: Erreichbare Zielfelder leuchten, und das Feld unter dem Zeiger nennt alle Betroffenen einschließlich Verbündeter. Bewegung lässt sich vor und nach einer Aktion ausgeben. Das Menü kehrt mit dem Rest zurück; darunter steht **Movement** (Bewegung) in der Einheit des Regelsatzes. Escape bricht eine angefangene Auswahl ab und bringt den Tastaturfokus zurück ins Menü.

Ein Regelsatz kann außerdem mehr vom Schlachtfeld nutzen: Deckung in Abstufungen bis zur Dreivierteldeckung; höheres Gelände, das Angriffe und Stürze verändert; Kreaturen, die fliegen, schwimmen, klettern oder graben; **Hide** (verstecken) und **Search** (suchen) im Menü; und, wenn sich jemand von einem Gegner löst, eine Pause, die den Gegner fragt, ob er zuschlagen will. Welche davon ein Kampf nutzt, hängt vom Regelsatz ab. Fliegen über Hindernisse, das Durchzwängen durch enge Stellen, Reittiere und das Mitschleifen von jemandem, den du festhältst, sind gesonderte spätere Arbeiten.

<a id="games-that-use-a-ruleset"></a>

### Spiele mit einem Regelsatz

Nutzt dein Spiel einen Regelsatz (siehe [Der Regelsatzbogen](party-and-npcs.md#the-ruleset-sheet)) und erlaubt dieser Regelsatz Kämpfen, den Bogen zu lesen, beginnt jedes Partymitglied den Kampf mit dem Ressourcenpool und den Zauberplätzen, die der Regelsatz für Kämpfe vorgesehen hat, so wie sein Bogen sie gerade hat. Die Fähigkeiten, die es aus den Katalogen des Regelsatzes gewählt hat, werden zu Fertigkeiten, wenn Marinaras Kampf sie nutzen kann: Ein Eintrag, der nur etwas außerhalb des Kampfes beschreibt, eine Reaktion oder ein Eintrag, dessen Kosten der Kampf nicht verrechnen kann, bleibt außen vor. Trefferpunkte werden als Anteil am Maximum übernommen statt als Zahl des Bogens: Ein Charakter, der laut Bogen halb gesund ist, beginnt den Kampf mit der Hälfte der Lebensleiste, die ihm der Kampfbildschirm gibt, denn im Kampf gelten Marinaras Zahlen. Ein Bogen mit 9 Gesundheit gerät so nicht in einen Kampf, in dem ein Treffer 12 Schaden macht. Endet der Kampf, wird die verlorene oder zurückgewonnene Gesundheit auf dieselbe Weise zurückübertragen, und ausgegebene Zauberplätze und Ressourcen werden so zurückgeschrieben, wie sie sind. Der Rest des Kampfes bleibt unverändert: Die Würfelrechnung auf dieser Seite ist weiterhin die von Marinara, und Angriffswürfe, Rettungswürfe und Konzentration aus dem Tischrollenspiel werden nicht angewendet. Ein Kampf, den du verlässt, indem du die Nachricht löschst, in der er begann, schreibt nichts zurück, weil er nicht stattgefunden hat. Ein Regelsatz, der nichts über Kämpfe sagt, lässt den Kampf genau so, wie er hier beschrieben ist.

## Das Aktionsmenü

Bist du am Zug, wählst du genau eine Aktion aus dem Menü. Es gibt sechs davon:

- **Attack** (Angriff): Ein Gegner kassiert einen einfachen Angriff.
- **Skills** (Fertigkeiten): eine besondere Fähigkeit einsetzen. Fertigkeiten können MP kosten. Manche heilen einen Verbündeten, manche treffen einen Gegner, manche verteilen einen Buff oder Debuff.
- **Special** (Sonderaktion): Tipp eine frei formulierte Aktion in eigenen Worten ein und drück dann auf **Ask GM** (den GM fragen). Zum Beispiel: „Ich kicke Sand in die gesprungene Linse des Ruin Guard.“ Was daraus wird, entscheidet der GM.
- **Defend** (verteidigen): Für den Rest der Runde steigt deine Verteidigung, du nimmst also weniger Schaden.
- **Items** (Gegenstände): einen Gegenstand aus der Tasche nutzen. Über **Full inventory** (vollständiges Inventar) öffnest du von hier aus die komplette Gegenstandsliste. In einem Spiel mit Regelsatz tun die eigenen Gegenstände des Regelsatzes, was der Regelsatz sagt: wie viel sie heilen oder schaden und welche Zustände sie verursachen. Ein Gegenstand mit Ladungen wird angeboten, solange eine Nutzung übrig ist, und bei einem, der zuerst eine Probe verlangt, wird sie beim Einsatz gewürfelt: Misslingt sie, ist er umsonst verbraucht. Einer, dem der Regelsatz keine Nutzung gibt, wird nicht angeboten. Deine übrigen Gegenstände tun, was der Game Master zu Kampfbeginn festgelegt hat, außer der Regelsatz schaltet die eigenen Gegenstände von Game Mode ab.
- **Flee** (fliehen): den Kampf sofort verlassen. Eine Flucht beendet den Kampf augenblicklich.

Nach deiner Wahl läuft die Runde ab. Die Ergebnisse erscheinen als aufsteigende Schadenszahlen, als Ausschlag der Lebensleisten und als Zeilen im Kampfprotokoll.

## So rechnet der Kampf

Sobald ein Kampf läuft, entscheidet feste Würfelmathematik über jede Runde – nicht die KI. Der GM erzählt lediglich die Ergebnisse. Wer trifft und wie viel Schaden ankommt, bestimmt er nie. Damit bleibt der Kampf fair und nachvollziehbar. „W20“ steht im Folgenden für den Wurf eines zwanzigseitigen Würfels, also eine Zahl von 1 bis 20.

### Initiative (Zugreihenfolge)

Zu Beginn jeder Runde würfelt jeder Kämpfer einen W20 und addiert einen Bonus aus seiner Geschwindigkeit. Wer höher liegt, handelt früher. Eingefrorene, betäubte oder gefesselte Kämpfer setzen die ganze Runde aus – ebenso alle, deren Geschwindigkeit auf 0 gefallen ist.

### Angriff und Verteidigung

Greift ein Kämpfer einen anderen an:

1. Der Angreifer würfelt einen W20 und addiert einen Bonus aus seinem Angriffswert.
2. Der Verteidiger würfelt einen W20 und addiert einen Bonus aus seinem Verteidigungswert.
3. Liegt die Summe des Angreifers unter der des Verteidigers, geht der Angriff daneben.
4. Ein kritischer Treffer gelingt bei einer natürlichen 20 oder wenn der Angreifer den Verteidiger um 10 oder mehr übertrifft.

### Schaden

Bei einem Treffer ergibt sich der Grundschaden aus dem Angriffswert des Angreifers und wächst mit dessen Stufe. Dazu kommen zusätzliche Schadenswürfel, von denen höherstufige Kämpfer mehr werfen. Ein kritischer Treffer multipliziert die Summe mit 1,5. Anschließend senkt die Verteidigung des Ziels den Schaden und blockt dabei bis zu 40 Prozent des Verteidigungswerts.

### Skalierung nach Schwierigkeit

Im letzten Schritt skaliert der Schaden mit der Schwierigkeit des Spiels, die du im Einrichtungsassistenten festlegst. Die vier Stufen wirken so auf den Endschaden:

| Schwierigkeit | Schadensmultiplikator |
|---|---|
| Casual | 0.6 |
| Normal | 1.0 |
| Hard | 1.3 |
| Brutal | 1.6 |

Je höher die Schwierigkeit, desto härter treffen beide Seiten – Kämpfe werden kürzer und riskanter.

## Statuseffekte und elementare Reaktionen

Ein Statuseffekt verändert Angriff, Verteidigung, Geschwindigkeit oder HP eines Kämpfers vorübergehend. Buffs helfen, Debuffs schaden. Ein Status hält eine festgelegte Zahl an Runden und verfliegt dann. Gifteffekte zehren jede Runde an den HP, Regenerationseffekte füllen sie auf. Drei Effekte mit eigenem Namen lassen den betroffenen Kämpfer seinen Zug aussetzen: eingefroren, betäubt und gefesselt.

Manche Angriffe und Fertigkeiten tragen ein Element: Fire, Ice, Lightning, Poison, Holy oder Shadow. Das erste Element, das ein Ziel trifft, hinterlässt eine Aura – eine nachwirkende Spur dieses Elements. Trifft dann ein anderes Element dasselbe Ziel, löst das eine elementare Reaktion aus. Die Reaktion bringt Bonusschaden und oft einen Statuseffekt.

Zu den Reaktionen zählen Melt, Shatter, Overload, Superconduct, Toxic Blaze, Purification, Eclipse und Electrotoxin. Dieses System läuft von allein. Du musst es weder aktivieren noch einstellen. Reaktionen entstehen automatisch, sobald die passenden Elemente auf demselben Ziel aufeinandertreffen.

## Elemente

Angriffe, Fertigkeiten und Gegenstände können ein Element tragen, und ein Element, das ein Ziel trifft, auf dem noch die Aura eines anderen liegt, kann eine Reaktion auslösen, die härter trifft. Welche Elemente es gibt, gehört zum Setting: Ein Spiel ohne Setting-Kit oder mit einem, das keine nennt, kämpft mit den klassischen sechs (Feuer, Eis, Blitz, Gift, Heiliges und Schatten); ein Wuxia-Spiel mit den fünf Wandlungsphasen (Holz, Feuer, Erde, Metall und Wasser, von denen jede die nächste überwindet); ein Cyberpunk- oder Space-Opera-Spiel mit kinetisch, thermisch, EM und chemisch oder Plasma; und ein Spiel in der Gegenwart oder in den 1920er-Jahren mit gar keinen. Regen und Sturm auf offenem Gelände dämpfen feuerartige Elemente und stärken blitzartige. In einem taktischen Kampf trifft ein Element härter gegen eines, das es schlägt, und schwächer gegen eines, von dem es geschlagen wird. Die Elemente eines Kits und ihre Reaktionen kannst du unter **Change its words** (Wörter ändern) ändern.

## Schlachtfelder

Das Spielfeld eines taktischen Kampfes ist wie der Ort angelegt, an dem der Kampf stattfindet: Ein Wald hat Bäume zum Verstecken, ein Dungeon Wände und Korridore, eine Stadt Straßen. Ein Spiel mit Setting-Kit benennt seine eigenen Szenen in seinen eigenen Worten, und jede ist wie eines dieser Spielfelder angelegt. So findet ein Cyberpunk-Kampf auf einem Dach oder im Korridor eines Megablocks statt und ein Wuxia-Kampf in einem Bambuswald oder einem Teehaus, und auch die Felder des Spielfelds tragen die Begriffe des Settings (Deckung und Trümmer statt Wald und Ruinen). Die Karte eines Gebiets und die kleinen Details, auf die der Game Master achten soll, folgen dem Setting auf dieselbe Weise. Die Szenen und Feldbegriffe eines Kits kannst du unter **Change its words** ändern.

## Boss-Mechaniken und Beute

Starke Gegner können Boss-Mechaniken mitbringen – Sonderregeln, die der GM für genau diesen Kampf schreibt. Eine Mechanik greift nach Zeitplan, etwa alle paar Runden, oder sobald der Boss unter einen bestimmten Lebensstand fällt. Sie kann die ganze Party treffen, den Boss stärken oder einen Statuseffekt verteilen. Löst eine Mechanik aus, erscheint der Effekt im Kampfprotokoll, sodass du reagieren kannst.

Gewinnst du einen Kampf, lassen die Gegner Beute fallen, und sie landet direkt in den Taschen der Party, sobald der Kampf endet. Jeder Gegenstand hat eine Seltenheit, von häufig bis selten: common, uncommon, rare, epic und legendary. Höhere Schwierigkeit verschiebt die Beute zu selteneren Gegenständen und wirft etwas mehr davon ab. Was fällt, gehört zu deinem Setting: Ein Spiel mit Setting-Kit wirft die eigene Beute des Kits ab (ein Spiel in der Gegenwart eine Geschenkkarte oder ein Erste-Hilfe-Set, nie ein verzaubertes Schwert), und du kannst diese Begriffe unter **Change its words** des Kits ändern. Ein Spiel ohne Kit wirft ab, was sein Genre üblicherweise hat, und ein Genre ohne Starter-Kit, etwa Steampunk, wirft schlichte Dinge ab, die zu keinem bestimmten Setting gehören. Eine Benachrichtigung nennt, was gefallen ist, und der Game Master erfährt, dass es schon in deinen Taschen ist. In einem Spiel, dessen Regelsatz eigene Beutetabellen hat, werfen die Gegner stattdessen die Gegenstände des Regelsatzes ab, und ein Regelsatz, der die eigenen Gegenstände von Game Mode abschaltet, wirft nur seine eigenen ab. Bei einem Sieg erscheint das Banner **Victory!**, fällt deine Party, erscheint **Defeat...**.

## Den GM unterbrechen

Solange der GM noch an seiner Antwort schreibt, kannst du mit der Schaltfläche **Interrupt** dazwischengehen. Getippter Text zählt erst, wenn du ihn wirklich abschickst. Ein Klick auf **Interrupt** öffnet ein Bestätigungsfenster mit dem Titel **Attempt to Interrupt?** und drei Möglichkeiten:

- **No**: abbrechen und den GM weiterschreiben lassen.
- **Force Interrupt**: sauber dazwischengehen. Der GM erfährt nichts von der Unterbrechung. Das Eingabefeld bekommt einen grünen Rahmen.
- **Yes**: eine Unterbrechung innerhalb der Geschichte versuchen, gegen die sich der GM wehren kann. Das Eingabefeld färbt sich rot, die App weist mit „using dice recommended“ auf Würfel hin, und die Würfel-Schaltfläche pulsiert. Ein Würfelwurf kann deinen Versuch hier gelingen lassen.

Nach der Bestätigung tippst du deine Nachricht und schickst sie ab. Überlegst du es dir anders, drück auf **Resume** (fortsetzen): Die offene Unterbrechung verfällt und die Erzählung läuft weiter. Nützlich ist das in angespannten Momenten – etwa als Reaktion in der Sekunde, bevor ein Kampf losbricht.

## Quick-Time-Events

Für schnelle Actionmomente wie Ausweichen oder Verfolgen kann der GM ein Quick-Time-Events-Overlay auslösen, kurz QTE. Das Overlay zeigt eine schrumpfende Countdown-Leiste, die Aufforderung **React quickly!** (schnell reagieren) und je eine Schaltfläche pro Möglichkeit. Jede Schaltfläche ist nummeriert (1, 2, 3 und so weiter). Klick auf die Schaltfläche der Aktion, die du willst.

Wähle eine Aktion, bevor die Zeit abläuft, dann gibt es einen Bonus. Je schneller du reagierst, desto größer fällt er aus. Läuft die Zeit vorher ab, kassierst du stattdessen einen Malus. Ein Quick-Time-Event kommt ohne Würfel aus. Hier zählt reines Tempo.

## Kampf auf dem Handy

Auf dem Handy ordnet sich der Kampfbildschirm für das kleine Display neu. Die Aktionsschaltflächen kleben am unteren Bildschirmrand. Panels, die daneben keinen Platz mehr finden, wandern in ein Panel, das sich von unten aufschiebt und vier Tabs hat:

- **Party**: deine Partymitglieder und deren Lebensstand.
- **Boss Mechanics** (Boss-Mechaniken): die Sonderregeln des laufenden Kampfes.
- **Dialogue** (Dialog): Kampfsprüche der Kämpfer.
- **Combat Log** (Kampfprotokoll): der Verlauf Runde für Runde.

Tipp auf einen Tab, um dessen Panel zu öffnen. Zum Schließen tippst du daneben oder auf die Schließen-Schaltfläche.

## Verwandte Anleitungen

- [Game Mode: Würfel und Fertigkeitsproben](dice-and-skill-checks.md)
- [Game Mode: Party und NPCs](party-and-npcs.md)
- [Game Mode: Erste Schritte](getting-started.md)
- [Kampfbegegnungen im Roleplay](../roleplay/combat-encounters.md)
