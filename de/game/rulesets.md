# Game Mode: Mit einem Regelsatz spielen

Ein Regelsatz erklärt Game Mode, wie ein Tischrollenspiel funktioniert: welche Würfel eine Probe wirft, was auf dem Charakterbogen steht, welche Ressourcen verbraucht werden, was eine Rast wiederherstellt und bei manchen Regelsätzen auch, wie ein ganzer Kampf abläuft. Dieser Leitfaden erklärt, wie du einen Regelsatz bekommst, ihn für ein Spiel auswählst und was sich ändert, sobald du damit spielst. Ein Spiel ohne Regelsatz läuft mit Marinaras eigenen Regeln, die in den anderen Anleitungen zu Game Mode beschrieben sind.

<a id="getting-a-ruleset"></a>

## Einen Regelsatz bekommen

Regelsätze kommen aus zwei Quellen. Offizielle, etwa 5e (SRD 5.1), installierst du über **Agent Organizer (Agentenverwaltung)**, wo sie mit **Rules** gekennzeichnet sind. Community-Regelsätze importierst du aus einer Datei oder aus dem GitHub-Repository eines Autors, und sie werden unter ihrer Herkunft abgelegt, etwa `local/ember-roads` oder `alice/v20`. Der Import nutzt denselben Schalter **Allow custom Agent imports** (eigene Agenten-Importe erlauben) wie importierte Agenten. Solange dieser Schalter aus ist, bleiben importierte Regelsätze bei neuen Spielen außen vor, und Spiele, die bereits einen nutzen, funktionieren weiter. Ein Spiel mit einem importierten Regelsatz läuft immer mit genau der Version, mit der es angelegt wurde. Wie du einen eigenen schreibst, steht unter [Regelsätze für Game Mode schreiben](../extending/writing-rulesets.md).

### Sprache

Die eigenen Texte eines Regelsatzes, etwa seine Fertigkeitsnamen, Zauber und Texte für den Game Master, richten sich nach der unter **Settings** (Einstellungen) gewählten Sprache. Ein offizieller Regelsatz lädt nur die Übersetzung für diese Sprache herunter, holt die neue Übersetzung beim Sprachwechsel und greift bei einer Sprache, in die er noch nicht übersetzt wurde, auf Englisch zurück. Ein aus einer Datei importierter Regelsatz behält nur die Übersetzung für die Sprache, die beim Import eingestellt war; um die Sprache zu wechseln, importiere die Datei erneut.

<a id="choosing-a-ruleset-for-a-game"></a>

## Einen Regelsatz für ein Spiel auswählen

**Rules** (Regeln) erscheint nur, wenn mindestens ein Regelsatz installiert ist, und nur bei einem neuen Spiel. Es ist unabhängig von **Combat Preference**: Das eine entscheidet, wie Proben und Charakterbögen funktionieren, das andere, wie Kämpfe dargestellt werden.

- **Marinara's own rules** ist der Standard: die eingebauten d20-Proben und der Bogen mit sechs Attributen.
- **Ein Regelsatz**, etwa **5e (SRD 5.1)** zeigt eine kurze Zusammenfassung dessen, was er abdeckt, und eine Zeile dazu, was in Kämpfen passiert. Ein Regelsatz, der seine Kämpfe selbst auflöst, sagt das. Einer, der nur den Bogen beisteuert, sagt, dass Kämpfe mit Marinaras Kampfsystem und mit Gesundheit, Energie und Fähigkeiten aus dem Bogen laufen. Einer, der beides nicht tut, sagt, dass Kämpfe mit Marinaras Kampfsystem laufen, und nennt die gewählte **Combat Preference**.

Der Regelsatz wird beim Anlegen des Spiels festgelegt und bleibt bei diesem Spiel. Er lässt sich später weder wechseln noch hinzufügen.

Manche Regelsätze bieten **layers** (Ebenen): benannte Varianten wie Low magic oder Hard winter, die als Schalter unter dem Regelsatz erscheinen, jeweils mit einer Zeile, die sagt, was sie bewirken. Eine Ebene kann die Schwierigkeiten verschärfen, eine Auswahl auf dem Charakterbogen einschränken, einige vorgefertigte Einträge aus der Auswahl des Bogeneditors herausnehmen, ändern, welche Händler was verkaufen und welche Schätze als Beute anfallen, und dem Game Master zusätzliche Anweisungen geben, auch für die Welt, die er bei der Einrichtung baut. Manche Ebenen schließen sich gegenseitig aus, und der Assistent deaktiviert die, die du nicht haben kannst. Sobald das Spiel beginnt, stehen die Ebenen fest, genau wie der Regelsatz selbst, und ein Bogen, der bereits etwas nutzt, das eine Ebene wegnimmt, behält es.

Hast du einen Regelsatz gewählt, listet der Schritt **Party** unter den Auswahlfeldern deine Persona und die Partymitglieder auf und kennzeichnet jeden mit **Has a sheet** (Bogen vorhanden) oder **Starts on a blank sheet** (beginnt mit leerem Bogen). Einen Bogen legst du unter **Stats** im Charakter- oder Persona-Editor an (siehe [Regelsatzbögen](../characters/colors-and-stats.md#ruleset-sheets)). Das Spiel kopiert jeden Bogen, wenn die Welt generiert wird. Nichts, was du im Spiel änderst, geht an den Charakter oder die Persona zurück. Ein Mitglied ohne Bogen bekommt einen leeren, auf dem jeder Wert dem Standard des Regelsatzes entspricht; die Weltgenerierung erfindet nie Werte.

Eine geteilte Setup-Datei merkt sich ihren Regelsatz. Importierst du eine und hast diesen Regelsatz nicht oder nur in einer älteren Version, sagt dir der Assistent, welcher Regelsatz es war, und das Spiel nutzt Marinaras eigene Regeln, sofern du ihn nicht installierst und auswählst.

<a id="what-happens-in-battles"></a>

## Was in Kämpfen passiert

Was ein Regelsatz im Kampf tut, hängt davon ab, wie er geschrieben wurde. Die Zeile unter dem Regelsatz im Einrichtungsassistenten sagt dir, welcher der folgenden Fälle zutrifft.

| Der Regelsatz | Kämpfe |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Löst seine Kämpfe selbst auf, etwa 5e (SRD 5.1) | Werden nach den eigenen Regeln des Regelsatzes auf seinem eigenen Kampfbildschirm ausgetragen. Siehe [Kämpfe mit einem Regelsatz](fighting-on-a-ruleset.md). |
| Stellt Kämpfen seinen Bogen bereit | Marinaras eigenes Kampfsystem nutzt Gesundheit, Zauberplätze und Attribute des Bogens. Siehe unten. |
| Macht keine Angaben zu Kämpfen | Marinaras eigenes Kampfsystem, genau wie in einem Spiel ohne Regelsatz. Siehe [Kampf](combat.md). |

Stellt der Regelsatz Kämpfen seinen Bogen bereit, beginnt jedes Partymitglied den Kampf mit dem Ressourcenpool und den Zauberplätzen, die der Regelsatz für Kämpfe vorgesehen hat, so wie sein Bogen sie gerade hat. Die Fähigkeiten, die es aus den Katalogen des Regelsatzes gewählt hat, werden zu Fertigkeiten, wenn Marinaras Kampf sie nutzen kann: Ein Eintrag, der nur etwas außerhalb des Kampfes beschreibt, eine Reaktion oder ein Eintrag, dessen Kosten der Kampf nicht verrechnen kann, bleibt außen vor. Trefferpunkte werden als Anteil am Maximum übernommen statt als Zahl des Bogens: Ein Charakter, der laut Bogen halb gesund ist, beginnt den Kampf mit der Hälfte der Lebensleiste, die ihm der Kampfbildschirm gibt, denn im Kampf gelten Marinaras Zahlen. Ein Bogen mit 9 Gesundheit gerät so nicht in einen Kampf, in dem ein Treffer 12 Schaden macht. Endet der Kampf, wird die verlorene oder zurückgewonnene Gesundheit auf dieselbe Weise zurückübertragen, und ausgegebene Zauberplätze und Ressourcen werden so zurückgeschrieben, wie sie sind. Der Rest des Kampfes bleibt unverändert: Die Würfelrechnung ist weiterhin die von Marinara (siehe [So funktioniert die Kampfrechnung](combat.md#how-combat-math-works)), und Angriffswürfe, Rettungswürfe und Konzentration aus dem Tischrollenspiel werden nicht angewendet. Ein Kampf, den du verlässt, indem du die Nachricht löschst, in der er begann, schreibt nichts zurück, weil er nicht stattgefunden hat.

<a id="checks-on-a-ruleset"></a>

## Proben mit einem Regelsatz

Bei einem Spiel mit Regelsatz fordert der Game Master wie in jedem Spiel Proben an (siehe [Fertigkeitsproben](dice-and-skill-checks.md#skill-checks)), aber der Regelsatz legt fest, wie sie gewürfelt werden:

- Der Game Master nennt weiterhin nur die Fertigkeit oder den Rettungswurf und legt eine Schwierigkeit fest. Statt der eingebauten Skala bekommt er die Schwierigkeitsskala des Regelsatzes mitgeteilt. Eine Schwierigkeit darf so weit reichen wie diese Skala, auch über die 1 bis 40 hinaus, die Marinaras eigene Regeln erlauben. Ein Weg bleibt auch in einem Regelsatz-Spiel bei 1 bis 40: der Ersatzweg, der eine Probe würfelt, die eine gespeicherte Runde noch schuldet.
- Die Engine würfelt mit den Würfeln des Regelsatzes und addiert den Modifikator aus dem **Regelsatzbogen** des Charakters. Er besteht aus den Teilen, die der Regelsatz deklariert: dem Attributsmodifikator, wenn die Fertigkeit oder der Rettungswurf ein Attribut nennt, dem Bonus für die Ausbildungsstufe (ein Vielfaches eines Übungsbonus, ein fester Wert oder beides) und einem Zusatzbonus, der auf dem Bogen eingetragen ist. Die eingebauten Fertigkeitsboni und Attribute werden nicht verwendet.
- Eine Probe kann einem Partymitglied gelten. Der Game Master ergänzt das Tag um `who="Name"`, und die Engine nimmt den Bogen dieses Charakters. Ohne `who` würfelt der Spieler. Ein Partymitglied, das noch keinen Bogen hat, würfelt auf einem leeren Bogen, auf dem jeder Wert dem Standard des Regelsatzes entspricht. Ein Name, der zu niemandem in der Party passt oder den zwei Partymitglieder teilen, würfelt ganz ohne Modifikator. Die einzige Ausnahme ist der Name deines eigenen Charakters: Trägt ein Partymitglied denselben Namen, meint dieser Name trotzdem dich und nutzt deinen Bogen. Die Engine leiht sich nie den Bogen eines anderen.
- Natürliche Ergebnisse folgen dem Regelsatz. Unter 5e (SRD 5.1) hat eine natürliche 20 oder 1 bei Proben und Rettungswürfen keine besondere Wirkung. Eine natürliche 20, die die Schwierigkeit verfehlt, scheitert also. Das weicht absichtlich von Marinaras eigenen Regeln ab.
- Zahlen, die der Game Master selbst schreibt, gelten nicht als verlässlich. Ein Tag, das fertig aussieht, wird neu gewürfelt und ersetzt, wenn sein Modifikator nicht der vom Bogen ist, wenn es eine andere Anzahl oder Größe von Würfeln geworfen hat als der Regelsatz, wenn der gezählte Würfel nicht der ist, den sein Wurfmodus behält, oder wenn es ein natürliches Ergebnis behauptet, das der Regelsatz nicht kennt.
- Einen Würfel, den du vor der Probe selbst geworfen hast, nutzt die Engine nur, wenn der Regelsatz einen einzelnen d20 würfelt. Ein Regelsatz mit anderen Würfeln, etwa 2d6 oder einem Pool, ignoriert ihn und würfelt normal.
- Der Game Master kann eine Fertigkeit oder einen Rettungswurf mit einem anderen Attribut als dem üblichen würfeln lassen, indem er dem Tag `with="Ability"` hinzufügt. Es zählt nur ein Attribut, das dein Regelsatz deklariert. Alles andere wird ignoriert, und die Fertigkeit behält ihr eigenes.
- Der Game Master kann statt einer Zahl eine Stufe der Schwierigkeitsskala nennen, etwa `difficulty="Hard"`. Die Engine würfelt gegen die Zahl dieser Stufe, und die gespeicherte Probe zeigt die Zahl. Ein Name, den die Skala nicht kennt, wird ignoriert.
- Würfelplatzhalter können die Attribute, Fertigkeiten und Rettungswürfe des Regelsatzes nennen, und `PROF` für den Übungsbonus, wenn der Regelsatz einen hat.
- Fehlt das Paket des Regelsatzes oder ist es älter als das, mit dem das Spiel erstellt wurde, werden Proben ohne Zahlen gespeichert und bleiben ausstehend. Sie werden nie mit den Regeln eines anderen Systems gewürfelt.
- Verändert etwas auf deinem Bogen einen Wurf, etwa ein Talisman, der misslungene Würfel neu wirft, nennt der Game Master es an der Probe, und die Engine erledigt den Rest: Sie zieht die Kosten des Talismans ab, wendet seine Wirkung an und würfelt. Ein Talisman, den du nicht gewählt hast oder nicht bezahlen kannst, wirkt nicht und kostet nichts.
- Erlaubt der Regelsatz, eine Ressource auszugeben, um einen Wurf abzusichern, sagt der Game Master das direkt an der Probe, und die Engine erledigt beides auf einmal: Sie zieht die Punkte ab, ergänzt, was damit gekauft wurde, und würfelt. Reicht der Pool nicht, wird nichts ausgegeben, und der Wurf bleibt so, wie er ohnehin gewesen wäre. Das Protokoll zeigt, was tatsächlich bezahlt wurde, nicht, was angefordert war. Wie viel eine Probe kaufen darf, legt der Regelsatz fest: eine feste Zahl, eine Zahl auf deinem Bogen oder so viel, wie die Probe Würfel hat.
- Sagt der Regelsatz, dass eine Zahl auf deinem Bogen bei bestimmten Würfen mitläuft, etwa schweres Gepäck bei jedem Brawn-Wurf, addiert die Engine sie zu jeder Probe, für die sie gilt. Die Würfelkarte nennt, was der Bogen hinzugefügt hat.
- Ein Regelsatz kann festlegen, was bei einer Probe passiert, wenn du in der Fertigkeit keine Ausbildung hast: Sie kann dich Würfel oder Punkte kosten, eine Stufe schwerer sein oder gar nicht möglich sein. Eine Probe, die du ohne Ausbildung nicht versuchen kannst, wird nicht gewürfelt, und die Erzählung sagt das, statt ein Ergebnis zu zeigen. Dein Bogen zeigt für eine solche Fertigkeit keine Zahl, bis du sie erlernst.
- Hat der Regelsatz eine Wundleiste und sagt, dass ihr Abzug für Würfe gilt, erschweren Verletzungen jede Probe. Unter einem Pool-Regelsatz nimmt der Abzug entsprechend viele Würfel aus dem Pool, aber nie unter den kleinsten Pool, den dieser Regelsatz erlaubt; manche Systeme setzen ihn auf null. Unter einem Regelsatz, der Würfel addiert, ist er ein fester Abzug auf den Wurf. In beiden Fällen nennt die Probe, wie viel abgezogen wurde, damit du siehst, warum du weniger Würfel geworfen hast. Siehe [Der Regelsatzbogen](#the-ruleset-sheet).
- Der Game Master hält außerdem Ressourcen, Zustände und Rasten jedes Charakters auf dem Bogen aktuell, und die Engine lehnt eine Änderung ab, die der Bogen nicht erlaubt. Siehe [Der Regelsatzbogen](#the-ruleset-sheet).

### Regelsätze mit Würfelpools

Manche Systeme addieren keinen Bonus zum Wurf. Stattdessen gibt die Zahl auf dem Bogen an, wie viele Würfel du wirfst, und du zählst die, die hoch genug ausfallen. Ein Regelsatz kann so geschrieben sein, und ein Spiel damit verhält sich etwas anders:

- **Die Zahl auf dem Bogen steht für Würfel.** Ein Wert von 3 und ein Beruf mit 2 ergeben fünf Würfel. Dein Bogen zeigt das als „5 dice“ statt „+5“, im Editor und in dem, was der Game Master liest.
- **Die Schwierigkeit ist eine Anzahl von Erfolgen.** Eine schwere Aufgabe verlangt drei Erfolge, nicht eine Summe von 15. Die Schwierigkeitsskala des Regelsatzes sagt, wie viele jede Stufe braucht.
- **Die Engine wirft die Würfel und zählt sie.** Welche Augenzahlen zählen, ob eine hohe Augenzahl einen weiteren Würfel wirft oder doppelt zählt, ob niedrige Augenzahlen Erfolge aufheben und was als Patzer oder als herausragender Erfolg gilt, all das kommt aus dem Regelsatz. Die Würfelkarte zeigt jeden geworfenen Würfel, hebt die, die das Ziel erreicht haben, von den übrigen ab und nennt, wie viele Erfolge gefallen sind und wie viele die Probe brauchte. Ein großer Pool bricht in weitere Zeilen um, statt zu schrumpfen, und die Karte zeigt nie eine Summe, zu der die Würfel gar nicht addiert wurden.
- **Der Game Master kann eine einzelne Probe anpassen**, wenn der Regelsatz es erlaubt: ein höheres oder niedrigeres Ziel pro Würfel, Würfel, die je nach Umständen hinzukommen oder wegfallen, und eine niedrigere Augenzahl, ab der Würfel neu geworfen werden oder doppelt zählen. Alles bleibt in dem Bereich, den der Regelsatz deklariert. Eine Stufe der Schwierigkeitsskala kann ihr eigenes Ziel pro Würfel haben, das gilt, wenn der Game Master diese Stufe wählt. Die Würfelkarte sagt es, wenn eine Probe bei einer anderen als der üblichen Augenzahl des Regelsatzes neu geworfen oder doppelt gezählt hat.
- **Würfel können neu geworfen werden**, wenn der Regelsatz eine Regel dafür hat: Der Game Master nennt sie an der Probe, wenn die Lage es verlangt, und die niedrig gefallenen Würfel werden neu geworfen, einmal oder so lange, bis sie höher ausfallen. Eine Ressource, die du ausgibst, kann dasselbe kaufen. Ein Wurf wird nur auf eine Art neu geworfen; würden zwei gelten, zählt die, die mehr Würfel erfasst.
- **Zwei Attribute können zusammen gewürfelt werden**, wenn der Regelsatz es vorsieht: Eine Attributsprobe kann die Würfel eines zweiten Attributs hinzunehmen, sodass zwei Werte als ein Pool geworfen werden.
- **Bei manchen Regelsätzen kann neben dem Ergebnis etwas schiefgehen.** In einem Regelsatz, der niedrige Augenzahlen auf mindestens der Hälfte der Würfel als Patzer zählt, behält eine Probe, die trotzdem ihre Erfolge erreicht hat, ihr Ergebnis, und die Würfelkarte ergänzt, dass daneben etwas schiefgegangen ist. Ganz ohne Erfolge ist es ein kritischer Fehlschlag.
- **Der Game Master liefert nie die Zahlen.** Ein Poolergebnis, das in der Erzählung steht, wird immer durch den eigenen Wurf der Engine ersetzt. Vorteil gilt nicht, ebenso wenig ein Würfel, den du vor der Probe selbst geworfen hast.
- **Dem Game Master einen Würfel jeder Größe zu zeigen, gilt für diese Proben nicht.** Die Würfel, die er sieht, sind zwanzigseitig. Eine Poolprobe würfelt die Engine blind, und sie wird wie jeder andere blinde Wurf erzählt.

### Weitere Würfelarten eines Regelsatzes

Ein Regelsatz kann seine Proben auch auf andere Arten würfeln. Die Engine wirft weiterhin die Würfel, und die Würfelkarte folgt dem Regelsatz:

- **Die höchsten Würfel behalten.** Wirf eine Handvoll Würfel und lies den höchsten, die zwei höchsten oder die drei höchsten ab, je nachdem, was der Regelsatz vorgibt.
- **Gegen deinen Bogen würfeln.** Würfle gleich oder unter einer Zahl auf deinem Bogen, etwa einem Fertigkeitswert in Prozent, statt einen Bonus zu den Würfeln zu addieren.
- **Würfel mit eigenen Seiten.** Seiten können etwas anderes wert sein als ihre Zahl, etwa Minus, leer und Plus. Manche Würfel tragen statt Zahlen Symbole, etwa Erfolg, Vorteil und ihre Gegenteile.
- **Ergebnisse in Bereichen.** Eine Probe kann in einem von mehreren Ergebnissen landen, etwa einem kritischen Erfolg oder einem Erfolg mit Preis, statt einfach zu gelingen oder zu scheitern. Die Würfelkarte nennt den Bereich, und der Game Master erzählt ihn.
- **Einige Proben anders gewürfelt.** Ein Regelsatz kann die meisten Proben auf eine Art würfeln und einige nennen, die anders gewürfelt werden.

<a id="the-ruleset-sheet"></a>

## Der Regelsatzbogen

In einem Spiel mit Regelsatz beginnt jedes Charakterblatt mit einem Block **Ruleset sheet** (Regelsatzbogen). Sein Aufbau kommt aus dem Regelsatz, deshalb sieht ein 5e-Bogen anders aus als der Bogen eines anderen Systems. Ein Spiel ohne Regelsatz hat diesen Block nicht.

- **Resources** (Ressourcen) wie Trefferpunkte, Zauberplätze oder eine Klassenressource zeigen, was vom Maximum übrig ist. Nutze die Schaltflächen Minus und Plus oder gib eine Zahl ein. Eine Ressource mit temporärem Puffer zeigt außerdem ein Feld **Temp**.
- **Tracks** (Leisten), etwa für Erschöpfung, steigen und fallen innerhalb ihres Bereichs.
- **Wound tracks** (Wundleisten) sind eine Reihe von Kästchen statt einer Zahl, für Systeme, die Schaden markieren statt zählen. Jedes Kästchen nennt, wie diese Verletzungsstufe heißt und was sie von deinen Würfen abzieht. Wähle zuerst die Schadensart, wenn der Regelsatz mehr als eine hat, und dann **Mark** (markieren) oder **Clear one** (eine Markierung entfernen). Du kannst auch auf das nächste leere Kästchen klicken, um eine Markierung hinzuzufügen, oder auf das letzte markierte, um eine zu entfernen; andere Kästchen reagieren nicht auf Klicks. Eine schwerere Markierung nimmt das höhere Kästchen und schiebt leichtere nach unten, und die Zeile darunter nennt den wirksamen Abzug sowie alles, was gar nicht mehr auf die Leiste passte. Manche Regelsätze nummerieren ihre Kästchen, statt sie zu benennen, manchmal so viele, wie der eigene Wert eines Charakters beträgt, und manche setzen jede Markierung auf das Kästchen, auf das sie zielt. Dort kannst du auf jedes freie Kästchen klicken, **Clear one** nimmt die leichteste Markierung auf dem höchsten Kästchen, und eine volle Leiste lehnt eine weitere Markierung ab, statt eine alte zu verschlimmern. Ein Regelsatz kann einer Leiste auch Kästchen aus einer Liste auf deinem Bogen hinzufügen und eine Rast oder Heilung nur eine Schadensart entfernen lassen. Wenn der Regelsatz es vorsieht, gilt dieser Abzug für deine Würfe: Er nimmt Würfel aus einem Pool oder wird auf eine Würfelsumme angerechnet, und die Würfelkarte nennt, wie viel angewendet wurde.
- **Notes** (Notizen), etwa worauf sich ein Charakter gerade konzentriert, sind kurze Textfelder.
- **Conditions** (Zustände) sind Schaltflächen, die du ein- und ausschaltest.
- **States** (Live-Zustände), etwa eine Gestalt oder eine Haltung, haben jeweils genau einen Wert aus einer Liste. Wähl den Wert aus der Liste. Ein Live-Zustand kann die Zahlen ändern, die auf ihn folgen, etwa die Würfel, die eine Haltung deinen Würfen hinzufügt, und eine Rast kann ihn auf den Ausgangswert zurücksetzen.
- **Rastschaltflächen** wenden eine der Rasten des Regelsatzes an. Was eine Rast wiederherstellt, legt der Regelsatz fest. Eine Rast kann auch die Ladungen von Gegenständen zurückbringen, die der Charakter trägt, etwa die eines Zauberstabs; die Zeile unter den Schaltflächen nennt dann, was zurückgekommen ist. Unter 5e (SRD 5.1) stellt eine lange Rast Trefferpunkte und Zauberplätze wieder her und bringt die Hälfte der Trefferwürfel des Charakters zurück, mindestens einen.
- Darunter steht eine kurze Zusammenfassung des Charakteraufbaus: Attributsmodifikatoren, ausgebildete Fertigkeiten und Rettungswürfe sowie einige Werte, die der Regelsatz auswählt, etwa die Rüstungsklasse.

Der Game Master hält denselben Bogen beim Erzählen aktuell. Wenn ein Charakter eine Ressource ausgibt, Schaden nimmt, geheilt wird, einen Zustand bekommt oder verliert, einen Live-Zustand wechselt oder rastet, trägt er die Änderung ein, und die Engine prüft sie gegen den Bogen. Eine Änderung, die nicht möglich ist, etwa ein Zauber ohne freien Zauberplatz, wird abgelehnt: Nichts ändert sich, und ein Hinweis sagt es dir.

Setzt ein Charakter etwas ein, das er aus den Katalogen des Regelsatzes gewählt hat, etwa einen Zauber oder ein Klassenmerkmal, nennt der Game Master es, und die Engine bezahlt den ganzen Preis: was der Regelsatz als Kosten angibt, plus eine Nutzung jedes Zählers, der dazugehört. Ein Zauber, der einen Zauberplatz kostet, wird von der Platzstufe bezahlt, die der Regelsatz dafür nennt, und der Game Master kann stattdessen eine höhere verlangen. Die Engine steigt nie von selbst auf einen höheren Platz. Lässt sich ein Teil des Preises nicht bezahlen, wird das Ganze abgelehnt, und nichts wird ausgegeben. Etwas, das nichts kostet, etwa ein Zaubertrick, wird einfach erzählt.

Manche Zahlen auf dem Bogen gehören dem Regelsatz, nicht dir. Eine Klassenressource, deren Maximum deiner Stufe folgt, oder Nutzungen, die einem Attributswert folgen, legt der Regelsatz fest und hält sie richtig, wenn du den Bogen bearbeitest.

Manche berechneten Werte folgen dem Spiel selbst: Ein Regelsatz kann eine Zahl aus dem aktuellen Stand einer Ressource oder Leiste errechnen, für jeden Wert eines Live-Zustands eine Zahl angeben oder eine Spalte einer Liste aufsummieren, etwa das Gewicht der Ausrüstung, die du eingepackt hast. Er kann eine Fertigkeit auch auf so eine Zahl begrenzen, sodass eine Fertigkeit schrumpfen kann, solange eine Ressource niedrig ist. Diese Werte zeigen im Bogen des Spiels ihren aktuellen Stand, und eine Probe oder ein Kampf nutzt die Werte, die in dem Moment gelten, in dem sie stattfinden. Der Bogeneditor auf einer Charakterkarte hat kein Spiel, aus dem er lesen kann, und zeigt sie deshalb so, wie sie zu Spielbeginn wären.

Diese Live-Werte gehören zu der Nachricht, in der sie entstanden sind. Wechselst du per Swipe (alternative Antwort) zu einer anderen Version eines Zuges oder generierst ihn neu, kehrt der Bogen auf den Stand vor diesem Zug zurück, damit nie etwas doppelt ausgegeben wird.

Klick auf **Edit sheet** (Bogen bearbeiten), um den Charakteraufbau selbst zu ändern, etwa nach einem Stufenaufstieg: Werte, Felder, Listen wie Zauber sowie die Ausbildung in Fertigkeiten und Rettungswürfen. Berechnete Werte aktualisieren sich beim Tippen. Es ist derselbe Editor wie auf der Charakterkarte: Auch hier lassen sich Zeilen aus den Katalogen des Regelsatzes hinzufügen, Zellen, die der Regelsatz pflegt, werden angezeigt, lassen sich aber nicht bearbeiten, und eine Liste, deren Regelsatztext sich geändert hat, bietet eine Schaltfläche **Review** (prüfen) an. Hat der Regelsatz einen Assistenten für Schritt-für-Schritt-Aufbau, bietet der Editor **Guided** (geführt) neben **All fields** (alle Felder) an. **Guided** führt dich durch jede Entscheidung, etwa Werte, Fertigkeiten und Startausrüstung, und nennt, worauf jeder Schritt noch wartet. **All fields** zeigt alles auf einmal. Klick auf **Save sheet** (Bogen speichern), wenn du fertig bist. Das ändert nur die Kopie des Bogens in diesem Spiel. Der Bogen, der am Charakter oder an der Persona gespeichert ist, wird von einem Spiel nie verändert.

Die separate Schaltfläche **Edit Sheet** (siehe [Ein Blatt von Hand bearbeiten](party-and-npcs.md#edit-a-sheet-by-hand)) bearbeitet weiterhin das allgemeine Blatt (Klasse, Fähigkeiten, Stärken und so weiter) und lässt den Regelsatzbogen in Ruhe.

Wurde das Paket des Regelsatzes entfernt oder ist die installierte Kopie älter als die, mit der das Spiel erstellt wurde, zeigt der Block stattdessen einen Hinweis. Proben lassen sich dann erst wieder würfeln, wenn das Paket erneut installiert ist.

## Der Party-Bogen und Fortschrittsuhren

Manche Regelsätze führen einen Bogen für die ganze Party, etwa für eine Crew oder eine Kompanie. Er erscheint auf dem Spielbildschirm nahe der Karte, unter dem Namen, den der Regelsatz ihm gibt. Klick auf den Namen, um ihn zu öffnen. Der Game Master hält ihn aktuell wie die Bögen der einzelnen Charaktere, und wo der Regelsatz es erlaubt, kannst du ihn auch selbst bearbeiten. Hat jemand anderes den Party-Bogen gespeichert, während du bearbeitet hast, zeigt er dessen Fassung: **Save** (Speichern) ersetzt sie durch deine, **Cancel** behält die andere.

Ein Regelsatz kann außerdem **Progress clocks** (Fortschrittsuhren) nutzen: Kreise, die in Segmente geteilt sind und die der Game Master füllt, während sich etwas aufbaut, etwa ein Alarm, der ausgelöst wird. Sie erscheinen nahe der Karte, jeweils mit der Zahl der gefüllten Segmente, und zeigen **Done** (fertig), sobald sie voll sind.

## Verwandte Anleitungen

- [Game Mode: Kämpfe mit einem Regelsatz](fighting-on-a-ruleset.md)
- [Game Mode: Würfel und Fertigkeitsproben](dice-and-skill-checks.md)
- [Game Mode: Party und NPCs](party-and-npcs.md)
- [Charakterfarben und RPG-Werte: Regelsatzbögen](../characters/colors-and-stats.md#ruleset-sheets)
- [Regelsätze für Game Mode schreiben](../extending/writing-rulesets.md)
