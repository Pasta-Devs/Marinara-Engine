# Game Mode: Mit einem Regelsatz spielen

Ein Regelsatz erklärt Game Mode, wie ein Tischrollenspiel funktioniert: welche Würfel eine Probe wirft, was auf dem Charakterbogen steht, welche Ressourcen verbraucht werden, was eine Rast wiederherstellt und bei manchen Regelsätzen auch, wie ein ganzer Kampf abläuft. In dieser Anleitung erfährst du, wie du einen Regelsatz bekommst, ihn für ein Spiel auswählst und was sich im Spiel ändert. Ein Spiel ohne Regelsatz läuft mit Marinaras eigenen Regeln, die in den anderen Anleitungen zu Game Mode beschrieben sind.

## Einen Regelsatz bekommen

So installierst du einen offiziellen Regelsatz wie 5e (SRD 5.1):

1. Öffne über das Sparkles-Symbol das Panel **Agents** (Agenten).
2. Wähle **Agent Organizer** (Agentenverwaltung).
3. Such den Regelsatz. Regelsätze sind mit **Rules** gekennzeichnet.
4. Klick auf **Install** (Installieren).

Starte dann ein neues Spiel und wähl ihn aus (siehe unten). Regelsätze kommen aus zwei Quellen:

- **Offizielle** Regelsätze installierst du wie oben beschrieben.
- **Community**-Regelsätze importierst du aus einer Datei oder aus dem GitHub-Repository eines Autors. Sie werden nach ihrer Herkunft abgelegt, etwa `local/ember-roads` oder `alice/v20`.

Der Import nutzt denselben Schalter **Allow custom Agent imports** (Import eigener Agenten erlauben) wie importierte Agenten. Solange er aus ist, bleiben importierte Regelsätze bei neuen Spielen außen vor, und Spiele, die bereits einen nutzen, funktionieren weiter. Ein Spiel mit einem importierten Regelsatz läuft immer mit genau der Version, mit der es angelegt wurde. Wie du einen eigenen schreibst, steht unter [Regelsätze für Game Mode schreiben](../extending/writing-rulesets.md).

Die eigenen Texte eines Regelsatzes, etwa Fertigkeitsnamen, Zauber und Texte für den Game Master (GM), richten sich nach der unter **Settings** (Einstellungen) gewählten Sprache. Ein offizieller Regelsatz lädt nur die Übersetzung für diese Sprache herunter, holt beim Sprachwechsel eine neue und greift bei einer Sprache, die ihm fehlt, auf Englisch zurück. Ein aus einer Datei importierter Regelsatz behält nur die Übersetzung für die Sprache, die beim Import eingestellt war. Um zu wechseln, importierst du die Datei erneut.

## Einen Regelsatz für ein Spiel auswählen

**Rules** (Regeln) erscheint im Schritt **World** des Einrichtungsassistenten nur, wenn mindestens ein Regelsatz installiert ist, und nur bei einem neuen Spiel. Es ist unabhängig von **Combat Preference**: **Rules** legt fest, wie Proben und Bögen funktionieren, und **Combat Preference**, wie Kämpfe dargestellt werden.

1. Öffne im Einrichtungsassistenten den Schritt **World**.
2. Behalte unter **Rules** die Option **Marinara's own rules** (die eingebauten d20-Proben und der Bogen mit sechs Attributen) oder wähl einen Regelsatz wie **5e (SRD 5.1)**.
3. Lies die Zusammenfassung. Sie nennt, was der Regelsatz abdeckt, und enthält eine Zeile zu Kämpfen (siehe [Was in Kämpfen passiert](#what-happens-in-battles)).
4. Optional: Schalte **layers** (Ebenen) ein (siehe unten).
5. Prüf im Schritt **Party**, wer mit **Has a sheet** (Bogen vorhanden) und wer mit **Starts on a blank sheet** (beginnt mit leerem Bogen) gekennzeichnet ist. Ein Bogen enthält die Zahlen eines Charakters für diesen Regelsatz, etwa Attributswerte und Trefferpunkte. Ein leerer Bogen nutzt die Standardwerte des Regelsatzes. Du kannst ihn später ausfüllen.

Der Regelsatz wird beim Anlegen des Spiels festgelegt. Du kannst ihn später weder wechseln noch einen hinzufügen.

**Layers** sind benannte Varianten eines Regelsatzes, etwa Low magic oder Hard winter. Sie erscheinen als Schalter unter dem Regelsatz, jeweils mit einer Zeile dazu, was sie bewirken. Eine Ebene kann:

- die Schwierigkeiten verschärfen,
- eine Auswahl auf dem Bogen einschränken,
- einige vorgefertigte Einträge aus der Auswahl des Bogeneditors ausblenden,
- ändern, was Händler verkaufen und welche Schätze als Beute anfallen,
- dem GM zusätzliche Anweisungen geben, auch für die Welt, die er baut.

Manche Ebenen schließen sich gegenseitig aus, und der Assistent deaktiviert die, die du nicht haben kannst. Sobald das Spiel beginnt, stehen die Ebenen fest. Ein Bogen, der bereits etwas nutzt, das eine Ebene wegnimmt, behält es.

Einen Bogen legst du unter **Stats** im Charakter- oder Persona-Editor an (siehe [Regelsatzbögen](../characters/colors-and-stats.md#ruleset-sheets)). Das Spiel kopiert jeden Bogen, wenn es die Welt generiert, und nichts, was du im Spiel änderst, geht an den Charakter oder die Persona zurück. Ein Mitglied ohne Bogen bekommt einen leeren, auf dem jeder Wert dem Standard des Regelsatzes entspricht. Die Weltgenerierung erfindet nie Werte.

Eine geteilte Setup-Datei merkt sich ihren Regelsatz. Importierst du eine und hast diesen Regelsatz nicht oder nur in einer älteren Version, sagt dir der Assistent, welcher Regelsatz es war, und das Spiel nutzt Marinaras eigene Regeln, sofern du ihn nicht installierst und auswählst.

<a id="what-happens-in-battles"></a>

## Was in Kämpfen passiert

Was ein Regelsatz im Kampf tut, hängt davon ab, wie er geschrieben wurde. Die Zeile unter dem Regelsatz im Assistenten sagt dir, welche Zeile der Tabelle zutrifft.

| Der Regelsatz | Kämpfe |
| --- | --- |
| Löst seine Kämpfe selbst auf, etwa 5e (SRD 5.1) | Werden nach den eigenen Regeln des Regelsatzes auf seinem eigenen Kampfbildschirm ausgetragen. Siehe [Kämpfe mit einem Regelsatz](fighting-on-a-ruleset.md). |
| Stellt Kämpfen seinen Bogen bereit | Marinaras eigenes Kampfsystem mit Gesundheit, Zauberplätzen und Fähigkeiten aus dem Bogen (siehe unten). |
| Macht keine Angaben zu Kämpfen | Marinaras eigenes Kampfsystem, genau wie ohne Regelsatz. Siehe [Kampf](combat.md). |

Stellt ein Regelsatz seinen Bogen bereit, nutzt Marinaras Kampfsystem den Bogen so:

- Jedes Partymitglied beginnt den Kampf mit dem Ressourcenpool und den Zauberplätzen, die der Regelsatz für Kämpfe vorgesehen hat, so wie sein Bogen sie gerade hat.
- Fähigkeiten, die aus den Katalogen des Regelsatzes gewählt wurden, werden zu Fertigkeiten, wenn Marinaras Kampfsystem sie nutzen kann. Ein Eintrag, der nur etwas außerhalb des Kampfes beschreibt, eine Reaktion oder ein Eintrag, dessen Kosten der Kampf nicht verrechnen kann, bleibt außen vor.
- Trefferpunkte werden als Anteil am Maximum übernommen, nicht als Zahl des Bogens. Ein Charakter mit halber Gesundheit beginnt mit der Hälfte der Lebensleiste des Kampfbildschirms. So gerät ein Bogen mit 9 Gesundheit nie in einen Kampf, in dem ein Treffer 12 Schaden macht.
- Endet der Kampf, wird verlorene oder zurückgewonnene Gesundheit auf dieselbe Weise zurückübertragen, und ausgegebene Zauberplätze und Ressourcen werden so zurückgeschrieben, wie sie sind.

Der Rest bleibt unverändert. Die Würfelrechnung ist weiterhin die von Marinara (siehe [So rechnet der Kampf](combat.md#how-combat-math-works)), und Angriffswürfe, Rettungswürfe und Konzentration aus dem Tischrollenspiel werden nicht angewendet. Ein Kampf, den du verlässt, indem du die Nachricht löschst, in der er begann, schreibt nichts zurück.

<a id="checks-on-a-ruleset"></a>

## Proben mit einem Regelsatz

Der GM fordert Proben an wie in jedem Spiel (siehe [Fertigkeitsproben](dice-and-skill-checks.md#skill-checks)), aber der Regelsatz legt fest, wie sie gewürfelt werden.

- Der GM nennt nur die Fertigkeit oder den Rettungswurf und legt eine Schwierigkeit fest. Er bekommt die Schwierigkeitsskala des Regelsatzes mitgeteilt, nicht die eingebaute. Eine Schwierigkeit darf so weit reichen wie diese Skala, auch über die 1 bis 40 von Marinaras eigenen Regeln hinaus. Ein Weg bleibt bei 1 bis 40: der Ersatzweg, der eine Probe würfelt, die ein gespeicherter Zug noch schuldet.
- Marinara würfelt mit den Würfeln des Regelsatzes und addiert den Modifikator aus dem **Regelsatzbogen** des Charakters: den Attributsmodifikator, wenn die Fertigkeit oder der Rettungswurf ein Attribut nennt, den Bonus für die Ausbildungsstufe (ein Vielfaches eines Übungsbonus, ein fester Wert oder beides) und einen Zusatzbonus auf dem Bogen. Eingebaute Fertigkeitsboni und Attribute werden nicht verwendet.
- Die Ergebnisse folgen dem Regelsatz. Unter 5e (SRD 5.1) hat eine natürliche 20 oder 1 bei Proben und Rettungswürfen keine besondere Wirkung, eine natürliche 20, die die Schwierigkeit verfehlt, scheitert also.
- Fehlt das Paket des Regelsatzes oder ist es älter als das, mit dem das Spiel erstellt wurde, werden Proben ohne Zahlen gespeichert und bleiben ausstehend. Sie werden nie mit den Regeln eines anderen Systems gewürfelt.

Marinara traut keinen Zahlen, die der GM schreibt. Ein Tag, das fertig aussieht, wird neu gewürfelt und ersetzt, wenn sein Modifikator nicht der vom Bogen ist, wenn es eine andere Anzahl oder Größe von Würfeln geworfen hat als der Regelsatz, wenn der gezählte Würfel nicht der ist, den sein Wurfmodus behält, oder wenn es ein natürliches Ergebnis behauptet, das der Regelsatz nicht kennt.

### Was der GM einer Probe hinzufügen kann

| Der GM schreibt | Wirkung |
| --- | --- |
| `who="Name"` | Die Probe nutzt den Bogen dieses Partymitglieds. Ohne diese Angabe würfelt der Spieler. Ein Mitglied ohne Bogen würfelt auf einem leeren. Ein Name, der zu niemandem passt oder den zwei Mitglieder teilen, würfelt ohne Modifikator. Trägt ein Mitglied denselben Namen wie dein eigener Charakter, meint dieser Name trotzdem dich. Marinara leiht sich nie den Bogen eines anderen. |
| `with="Ability"` | Würfelt die Fertigkeit oder den Rettungswurf mit einem anderen Attribut. Es zählt nur ein Attribut, das der Regelsatz deklariert. Alles andere wird ignoriert. |
| `difficulty="Hard"` | Nennt statt einer Zahl eine Stufe der Skala. Marinara würfelt gegen die Zahl dieser Stufe, und die gespeicherte Probe zeigt die Zahl. Ein unbekannter Name wird ignoriert. |
| Würfelplatzhalter | Können die Attribute, Fertigkeiten und Rettungswürfe des Regelsatzes nennen, und `PROF` für den Übungsbonus, wenn der Regelsatz einen hat. |

Einen Würfel, den du vor der Probe selbst geworfen hast, nutzt Marinara nur, wenn der Regelsatz einen einzelnen d20 würfelt. Ein Regelsatz mit anderen Würfeln, etwa 2d6 oder einem Pool, ignoriert ihn.

### Wie der Bogen einen Wurf verändert

- **Talismane, die einen Wurf verändern.** Der GM nennt den Talisman an der Probe, und Marinara zieht seine Kosten ab, wendet seine Wirkung an und würfelt. Ein Talisman, den du nicht gewählt hast oder nicht bezahlen kannst, wirkt nicht und kostet nichts.
- **Eine Ressource ausgeben, um einen Wurf abzusichern.** Der GM sagt das an der Probe. Marinara zieht die Punkte ab, ergänzt, was damit gekauft wurde, und würfelt. Reicht der Pool nicht, wird nichts ausgegeben. Das Protokoll zeigt, was tatsächlich bezahlt wurde. Wie viel eine Probe kaufen darf, legt der Regelsatz fest: eine feste Zahl, eine Zahl auf deinem Bogen oder so viel, wie die Probe Würfel hat.
- **Zahlen, die mitlaufen.** Sagt der Regelsatz, dass eine Zahl auf dem Bogen bei bestimmten Würfen gilt, etwa schweres Gepäck bei jedem Brawn-Wurf, addiert Marinara sie zu jeder Probe, für die sie gilt, und die Würfelkarte nennt, was der Bogen hinzugefügt hat.
- **Fertigkeiten ohne Ausbildung.** Ein Regelsatz kann festlegen, dass eine Probe ohne Ausbildung Würfel oder Punkte kostet, eine Stufe schwerer ist oder gar nicht möglich ist. Eine Probe, die du nicht versuchen kannst, wird nicht gewürfelt, und die Erzählung sagt das. Dein Bogen zeigt für eine solche Fertigkeit keine Zahl, bis du sie erlernst.
- **Wunden.** Hat der Regelsatz eine Wundleiste und sagt, dass ihr Abzug für Würfe gilt, erschweren Verletzungen jede Probe. Unter einem Pool-Regelsatz nimmt der Abzug entsprechend viele Würfel aus dem Pool, aber nie unter den kleinsten Pool, den der Regelsatz erlaubt (bei manchen sind das null Würfel). Unter einem Regelsatz, der Würfel addiert, ist er ein fester Abzug. Die Probe nennt, wie viel angewendet wurde. Siehe [Der Regelsatzbogen](#the-ruleset-sheet).

Der GM hält außerdem Ressourcen, Zustände und Rasten jedes Charakters auf dem Bogen aktuell, und Marinara lehnt eine Änderung ab, die der Bogen nicht erlaubt.

### Regelsätze mit Würfelpools

Manche Systeme zählen Würfel, statt einen Bonus zu addieren. Die Zahl auf dem Bogen gibt an, wie viele Würfel du wirfst, und du zählst die, die hoch genug ausfallen.

- **Die Zahl auf dem Bogen steht für Würfel.** Ein Wert von 3 und ein Beruf mit 2 ergeben fünf Würfel. Der Bogen zeigt „5 dice“ statt „+5“.
- **Die Schwierigkeit ist eine Anzahl von Erfolgen.** Eine schwere Aufgabe verlangt drei Erfolge, nicht eine Summe von 15. Die Skala des Regelsatzes sagt, wie viele jede Stufe braucht.
- **Marinara wirft und zählt.** Der Regelsatz legt fest, welche Augenzahlen zählen, ob eine hohe Augenzahl einen weiteren Würfel wirft oder doppelt zählt, ob niedrige Augenzahlen Erfolge aufheben und was als Patzer oder als herausragender Erfolg gilt. Die Würfelkarte zeigt jeden Würfel, hebt die hervor, die das Ziel erreicht haben, und vergleicht die Erfolge mit der benötigten Zahl. Ein großer Pool bricht in weitere Zeilen um, und die Karte zeigt nie eine Summe, zu der die Würfel gar nicht addiert wurden.
- **Der GM kann eine einzelne Probe anpassen**, wenn der Regelsatz es erlaubt: ein höheres oder niedrigeres Ziel pro Würfel, Würfel, die je nach Umständen hinzukommen oder wegfallen, und eine niedrigere Augenzahl, ab der Würfel neu geworfen werden oder doppelt zählen. Alles bleibt im Bereich des Regelsatzes. Eine Stufe der Skala kann ihr eigenes Ziel pro Würfel haben. Die Würfelkarte sagt es, wenn eine Probe eine andere als die übliche Augenzahl des Regelsatzes genutzt hat.
- **Würfel können neu geworfen werden**, wenn der Regelsatz eine Regel dafür hat. Der GM nennt sie an der Probe, und die niedrig gefallenen Würfel werden neu geworfen, einmal oder so lange, bis sie höher ausfallen. Eine Ressource, die du ausgibst, kann dasselbe kaufen. Ein Wurf wird nur auf eine Art neu geworfen. Würden zwei gelten, zählt die, die mehr Würfel erfasst.
- **Zwei Attribute können zusammen gewürfelt werden**, wenn der Regelsatz es vorsieht: Zwei Werte werden als ein Pool geworfen.
- **Ein Patzer kann mit einem Ergebnis einhergehen.** In einem Regelsatz, der niedrige Augenzahlen auf mindestens der Hälfte der Würfel als Patzer zählt, behält eine Probe, die trotzdem ihre Erfolge erreicht hat, ihr Ergebnis, und die Karte ergänzt, dass etwas schiefgegangen ist. Ganz ohne Erfolge ist es ein kritischer Fehlschlag.
- **Der GM liefert nie die Zahlen.** Ein Poolergebnis, das in der Erzählung steht, wird durch Marinaras eigenen Wurf ersetzt. Vorteil und ein vorab geworfener Würfel gelten nicht.
- **Dem GM einen Würfel jeder Größe zu zeigen, gilt hier nicht.** Die Würfel, die der GM sieht, sind zwanzigseitig. Eine Poolprobe wird blind gewürfelt und wie jeder blinde Wurf erzählt.

### Weitere Würfelarten eines Regelsatzes

Marinara wirft weiterhin die Würfel, und die Würfelkarte folgt dem Regelsatz:

- **Die höchsten Würfel behalten.** Wirf eine Handvoll Würfel und lies den höchsten, die zwei oder die drei höchsten ab.
- **Gegen deinen Bogen würfeln.** Würfle gleich oder unter einer Zahl auf deinem Bogen, etwa einem Fertigkeitswert in Prozent.
- **Würfel mit eigenen Seiten.** Seiten können etwas anderes wert sein als ihre Zahl, etwa Minus, leer und Plus, oder Symbole tragen, etwa Erfolg, Vorteil und ihre Gegenteile.
- **Ergebnisse in Bereichen.** Eine Probe kann in einem Bereich landen, etwa einem kritischen Erfolg oder einem Erfolg mit Preis, statt einfach zu gelingen oder zu scheitern. Die Karte nennt den Bereich, und der GM erzählt ihn.
- **Einige Proben anders gewürfelt.** Ein Regelsatz kann die meisten Proben auf eine Art würfeln und einige nennen, die anders gewürfelt werden.

<a id="the-ruleset-sheet"></a>

## Der Regelsatzbogen

In einem Spiel mit Regelsatz beginnt jeder Charakterbogen mit einem Block **Ruleset sheet** (Regelsatzbogen). Sein Aufbau kommt aus dem Regelsatz, deshalb sieht ein 5e-Bogen anders aus als der Bogen eines anderen Systems. Ein Spiel ohne Regelsatz hat keinen solchen Block. Siehe auch [Character Profiles](party-and-npcs.md#character-profiles).

| Teil | So funktioniert es |
| --- | --- |
| **Resources** (Ressourcen) | Trefferpunkte, Zauberplätze oder eine Klassenressource zeigen, was vom Maximum übrig ist. Nutze die Schaltflächen Minus und Plus oder gib eine Zahl ein. Eine Ressource mit temporärem Puffer zeigt außerdem **Temp**. |
| **Tracks** (Leisten) | Etwa für Erschöpfung. Lassen sich innerhalb ihres Bereichs stufenweise erhöhen und senken. |
| **Notes** (Notizen) | Kurze Textfelder, etwa dafür, worauf sich ein Charakter gerade konzentriert. |
| **Conditions** (Zustände) | Schaltflächen, die du ein- und ausschaltest. |
| **States** (Live-Zustände) | Eine Gestalt oder Haltung: jeweils ein Wert aus einer Liste. Ein Live-Zustand kann Zahlen ändern, die auf ihn folgen, etwa Würfel, die Würfen hinzugefügt werden, und eine Rast kann ihn zurücksetzen. |
| **Rastschaltflächen** | Wenden eine der Rasten des Regelsatzes an. Was eine Rast wiederherstellt, legt der Regelsatz fest. Sie kann auch Ladungen von Gegenständen zurückbringen, etwa die eines Zauberstabs, und die Zeile unter den Schaltflächen nennt, was zurückgekommen ist. Unter 5e (SRD 5.1) stellt eine lange Rast Trefferpunkte und Zauberplätze wieder her und bringt die Hälfte der Trefferwürfel zurück, mindestens einen. |
| Zusammenfassung des Aufbaus | Attributsmodifikatoren, ausgebildete Fertigkeiten und Rettungswürfe sowie Werte, die der Regelsatz auswählt, etwa die Rüstungsklasse. |

**Wound tracks** (Wundleisten) sind eine Reihe von Kästchen statt einer Zahl, für Systeme, die Schaden markieren statt zählen. Jedes Kästchen nennt diese Verletzungsstufe und sagt, was sie von deinen Würfen abzieht.

1. Hat der Regelsatz mehr als eine Schadensart, wähle zuerst die Art.
2. Klick auf **Mark** (markieren) oder **Clear one** (eine Markierung entfernen). Du kannst auch auf das nächste leere Kästchen klicken, um eine Markierung hinzuzufügen, oder auf das letzte markierte, um eine zu entfernen. Andere Kästchen reagieren nicht auf Klicks.

Eine schwerere Markierung nimmt das höhere Kästchen und schiebt leichtere nach unten. Die Zeile darunter nennt den wirksamen Abzug und alles, was nicht auf die Leiste passte. Manche Regelsätze nummerieren ihre Kästchen, statt sie zu benennen, manchmal so viele, wie dein eigener Wert beträgt, und manche setzen jede Markierung auf das Kästchen, auf das sie zielt. Dort kannst du auf jedes freie Kästchen klicken, **Clear one** nimmt die leichteste Markierung auf dem höchsten Kästchen, und eine volle Leiste lehnt eine weitere Markierung ab, statt eine alte zu verschlimmern. Ein Regelsatz kann Kästchen aus einer Liste auf deinem Bogen hinzufügen und eine Rast oder Heilung nur eine Schadensart entfernen lassen.

### Wie der GM den Bogen ändert

Der GM hält den Bogen beim Erzählen aktuell. Wenn ein Charakter eine Ressource ausgibt, Schaden nimmt, geheilt wird, einen Zustand bekommt oder verliert, einen Live-Zustand wechselt oder rastet, trägt er die Änderung ein, und Marinara prüft sie gegen den Bogen. Eine unmögliche Änderung, etwa ein Zauber ohne freien Zauberplatz, wird abgelehnt. Nichts ändert sich, und ein Hinweis sagt es dir.

Setzt ein Charakter etwas ein, das aus den Katalogen des Regelsatzes gewählt wurde, etwa einen Zauber oder ein Klassenmerkmal, nennt der GM es, und Marinara bezahlt den ganzen Preis: was der Regelsatz als Kosten angibt, plus eine Nutzung jedes Zählers, der dazugehört. Ein Zauber, der einen Zauberplatz kostet, wird von der Platzstufe bezahlt, die der Regelsatz nennt, und der GM kann eine höhere verlangen. Marinara steigt nie von selbst auf einen höheren Platz. Lässt sich ein Teil des Preises nicht bezahlen, wird das Ganze abgelehnt, und nichts wird ausgegeben. Etwas Kostenloses, etwa ein Zaubertrick, wird nur erzählt.

Manche Zahlen auf dem Bogen gehören dem Regelsatz: Eine Klassenressource, deren Maximum deiner Stufe folgt, oder Nutzungen, die einem Attributswert folgen, legt der Regelsatz fest und hält sie richtig, wenn du den Bogen bearbeitest. Ein Regelsatz kann außerdem eine Zahl aus dem aktuellen Stand einer Ressource oder Leiste errechnen, für jeden Wert eines Live-Zustands eine Zahl angeben, eine Spalte einer Liste aufsummieren (etwa das Gewicht der eingepackten Ausrüstung) oder eine Fertigkeit auf so eine Zahl begrenzen, sodass eine Fertigkeit schrumpfen kann, solange eine Ressource niedrig ist. Der Bogen des Spiels zeigt diese aktuellen Werte, und eine Probe oder ein Kampf nutzt den Wert des jeweiligen Moments. Der Bogeneditor auf einer Charakterkarte hat kein Spiel, aus dem er lesen kann, und zeigt sie deshalb so, wie sie zu Spielbeginn wären.

Live-Werte gehören zu der Nachricht, in der sie entstanden sind. Wechselst du per Swipe (alternative Antwort) zu einer anderen Version eines Zuges oder generierst ihn neu, kehrt der Bogen auf den Stand vor diesem Zug zurück, damit nichts doppelt ausgegeben wird.

### Den Regelsatzbogen bearbeiten

Hier änderst du den Charakteraufbau selbst, etwa nach einem Stufenaufstieg.

1. Öffne den Bogen des Charakters und klick auf **Edit ruleset sheet** (Regelsatzbogen bearbeiten).
2. Ändere Werte, Felder, Listen wie Zauber sowie die Ausbildung in Fertigkeiten und Rettungswürfen. Berechnete Werte aktualisieren sich beim Tippen. Hat der Regelsatz einen Schritt-für-Schritt-Assistenten, wähl **Guided** (geführt), um durch jede Entscheidung geführt zu werden (Werte, Fertigkeiten, Startausrüstung), oder **All fields** (alle Felder), um alles auf einmal zu sehen.
3. Klick auf **Save sheet** (Bogen speichern).

Es ist derselbe Editor wie auf der Charakterkarte. Zeilen lassen sich aus den Katalogen des Regelsatzes hinzufügen, Zellen, die der Regelsatz pflegt, werden angezeigt, lassen sich aber nicht bearbeiten, und eine Liste, deren Regelsatztext sich geändert hat, bietet **Review** (prüfen) an. Speichern ändert nur die Kopie in diesem Spiel. Der Bogen, der am Charakter oder an der Persona gespeichert ist, wird von einem Spiel nie verändert.

Die separate Schaltfläche **Edit card** (Karte bearbeiten) bearbeitet den allgemeinen Bogen (Klasse, Fähigkeiten, Stärken) und lässt den Regelsatzbogen in Ruhe. Siehe [Einen Bogen von Hand bearbeiten](party-and-npcs.md#edit-a-sheet-by-hand).

Wenn es nicht funktioniert hat und das Paket des Regelsatzes entfernt wurde oder älter ist als das, mit dem das Spiel erstellt wurde, zeigt der Block stattdessen einen Hinweis. Proben lassen sich erst wieder würfeln, wenn das Paket erneut installiert ist.

## Der Party-Bogen und Fortschrittsuhren

Manche Regelsätze führen einen Bogen für die ganze Party, etwa für eine Crew oder eine Kompanie. Er erscheint auf dem Spielbildschirm nahe der Karte, unter dem Namen, den der Regelsatz ihm gibt. Klick auf den Namen, um ihn zu öffnen. Der GM hält ihn aktuell wie die Bögen der einzelnen Charaktere, und wo der Regelsatz es erlaubt, kannst du ihn auch selbst bearbeiten. Hat jemand anderes den Party-Bogen gespeichert, während du ihn bearbeitet hast, siehst du dessen Fassung. **Save** (Speichern) ersetzt sie durch deine, **Cancel** (Abbrechen) behält die andere.

Ein Regelsatz kann außerdem **Progress clocks** (Fortschrittsuhren) nutzen: Kreise, die in Segmente geteilt sind und die der GM füllt, während sich etwas aufbaut, etwa ein Alarm, der ausgelöst wird. Sie erscheinen nahe der Karte, jeweils mit der Zahl der gefüllten Segmente, und zeigen **Done** (fertig), sobald sie voll sind.

## Verwandte Anleitungen

- [Game Mode: Kämpfe mit einem Regelsatz](fighting-on-a-ruleset.md)
- [Game Mode: Würfel und Fertigkeitsproben](dice-and-skill-checks.md)
- [Game Mode: Party und NPCs](party-and-npcs.md)
- [Charakterfarben und Story-Werte: Regelsatzbögen](../characters/colors-and-stats.md#ruleset-sheets)
- [Regelsätze für Game Mode schreiben](../extending/writing-rulesets.md)
