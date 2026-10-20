# Game Mode: Party und NPCs

In dieser Anleitung geht es um die Leute in der Game-Mode-Kampagne: um die Partymitglieder und um die NPCs (Nicht-Spieler-Charaktere), die der Game Master einführt. Du erfährst, wie du Charakterblätter der Party öffnest, bearbeitest oder neu generierst und wie du das Adventure Journal liest – inklusive der Ruf-Stufen von NPCs. Außerdem erklärt sie die zwei Game-Master-Modi.

Game Mode ist einer der Chat-Modi von Marinara Engine. Dahinter steckt ein Einzelspieler-RPG (Rollenspiel) mit einer KI als Game Master – kurz GM, also die KI, die das Spiel leitet. Einrichtung und Grundlagen stehen unter [Game Mode: Erste Schritte](getting-started.md).

## Character Profiles

Klick oder tipp auf die Avatar-Schaltfläche **Character Profiles** (Charakterprofile), um die Charaktere zu sehen, die mit dir reisen. Bei mehreren Partymitgliedern wechselt die Schaltfläche durch ihre Porträts und zeigt ein Abzeichen mit der Anzahl.

Du kannst diese Schaltfläche am Computer und am Handy im Chat herumziehen. Öffne sie und nutze **Lock window** (Fenster sperren), damit sie an ihrem Platz bleibt. Am Computer kannst du das Fenster außerdem verschieben und in der Größe ändern. **Close** (Schließen) macht es wieder zur Schaltfläche. Seine Position wird mit dem Chat gespeichert, und es folgt deinem Chat-Widget-Stil aus **Settings → Appearance → App** (Einstellungen → Darstellung → App). Am Handy bleibt es vom Drei-Punkte-Menü **Chat tools** getrennt.

In **Character Profiles** kannst du Folgendes tun:

1. Klick oder tipp auf ein Porträt, um das Charakterblatt dieses Charakters zu öffnen.
2. Zeig am Desktop mit der Maus auf ein Porträt – dann erscheint eine kleine Schaltfläche **X**.
3. Klick auf das **X**, um den Charakter aus der Party zu entfernen.

Jeden Gefährten, den der Game Master angeworben hat, kannst du wieder entfernen – egal ob er bei der Einrichtung oder später in der Geschichte dazugestoßen ist. Deine eigene Persona ist der Charakter, den du spielst. Sie hat kein **X**, dich selbst kannst du also nicht aus der Party werfen.

## Charakterblätter

Ein Charakterblatt ist eine spielbezogene Übersicht zu einem Partymitglied. Es ist etwas anderes als die Charakterkarte. Der Game Master schreibt es aus dem Charakter und der aktuellen Geschichte.

Öffne **Character Profiles** und klick oder tipp dann auf das Porträt des Charakters. Angezeigt werden alle diese Abschnitte, sofern sie Inhalt haben:

- **Attributes** (Attribute): Werte im Tabletop-Stil wie STR, DEX und CON, jeweils mit Modifikator.
- **Stats** (Statuswerte): Ressourcenbalken wie HP oder MP.
- **Abilities** (Fähigkeiten): was der Charakter kann.
- **Strengths** (Stärken) und **Weaknesses** (Schwächen): kurze Listen.
- **Details**: Zusatzangaben wie Skills, Weapon oder Faction.
- **Inventory** (Inventar): was der Charakter mit sich trägt.
- **Traits** (Merkmale): weitere eigene Felder.

Bei einem neuen Charakter steht dort womöglich „Character data will populate as the story progresses“ (die Daten kommen erst im Lauf der Geschichte dazu). Das Blatt füllt sich beim Spielen.

### Ein Blatt per KI neu generieren

Klick auf **Regenerate Sheet** (Blatt neu generieren), damit die KI das Charakterblatt neu schreibt. Grundlage sind der Charakter und der aktuelle Spielkontext. Das lohnt sich, wenn die Geschichte einen Charakter stark verändert hat.

### Ein Blatt von Hand bearbeiten

Klick auf **Edit Sheet** (Blatt bearbeiten), um selbst Hand anzulegen. Im Bearbeitungsmodus stellst du Folgendes ein:

- **Class** (Klasse) und eine kurze Beschreibung unter **Sheet Details** (Blatt-Details).
- **RPG Attributes** (RPG-Attribute): Schalte **Enable** (Aktivieren) ein, um Pools nach HP-Art und Attribute mitzuführen. Über **Add Pool** (Pool hinzufügen) kommt ein Balken dazu – mit Name, aktuellem Wert, Maximalwert und Farbe. Über **Add Attribute** (Attribut hinzufügen) fügst du einen Wert wie STR hinzu.
- **Abilities**, **Strengths** und **Weaknesses**: Mit **Add** (Hinzufügen) hängst du eine Zeile an.
- **Details**: Mit **Add Detail** (Detail hinzufügen) kommt eine beschriftete Angabe dazu.

Zum Schluss klickst du auf **Save Sheet** (Blatt speichern). **Cancel** (Abbrechen) verwirft die Änderungen.

<a id="the-ruleset-sheet"></a>

### Der Regelsatzbogen

In einem Spiel mit Regelsatz (siehe [Spiele mit einem Regelsatz](dice-and-skill-checks.md#games-that-use-a-ruleset)) beginnt jedes Charakterblatt mit einem Block **Ruleset sheet** (Regelsatzbogen). Sein Aufbau kommt aus dem Regelsatz, deshalb sieht ein 5e-Bogen anders aus als der Bogen eines anderen Systems. Ein Spiel ohne Regelsatz hat diesen Block nicht.

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

Die oben beschriebene separate Schaltfläche **Edit Sheet** bearbeitet weiterhin das allgemeine Blatt (Klasse, Fähigkeiten, Stärken und so weiter) und lässt den Regelsatzbogen in Ruhe.

Wurde das Paket des Regelsatzes entfernt oder ist die installierte Kopie älter als die, mit der das Spiel erstellt wurde, zeigt der Block stattdessen einen Hinweis. Proben lassen sich dann erst wieder würfeln, wenn das Paket erneut installiert ist.

### Der Party-Bogen und Fortschrittsuhren

Manche Regelsätze führen einen Bogen für die ganze Party, etwa für eine Crew oder eine Kompanie. Er erscheint auf dem Spielbildschirm nahe der Karte, unter dem Namen, den der Regelsatz ihm gibt. Klick auf den Namen, um ihn zu öffnen. Der Game Master hält ihn aktuell wie die Bögen der einzelnen Charaktere, und wo der Regelsatz es erlaubt, kannst du ihn auch selbst bearbeiten. Hat jemand anderes den Party-Bogen gespeichert, während du bearbeitet hast, zeigt er dessen Fassung: **Save** (Speichern) ersetzt sie durch deine, **Cancel** behält die andere.

Ein Regelsatz kann außerdem **Progress clocks** (Fortschrittsuhren) nutzen: Kreise, die in Segmente geteilt sind und die der Game Master füllt, während sich etwas aufbaut, etwa ein Alarm, der ausgelöst wird. Sie erscheinen nahe der Karte, jeweils mit der Zahl der gefüllten Segmente, und zeigen **Done** (fertig), sobald sie voll sind.

## Das Inventar

Klick über der Erzählung auf **Inventory**, um es zu öffnen. Jedes Quadrat ist ein Stapel: ein Gegenstand und wie viele davon es gibt. Klick auf einen Stapel, um ihn auszuwählen.

Jeder in der Party trägt seine eigenen Sachen. Das Inventar öffnet sich auf **All** (alle). Dort siehst du alle Taschen zusammen, mit dem Namen des Trägers in der Ecke jedes Stapels. Klick auf den Tab eines Partymitglieds, um nur seine Tasche zu sehen. Solange niemand sonst etwas trägt, gibt es keine Tabs, und jeder Stapel gehört dir.

- **Menge ändern.** Mit **-** und **+** nimmst du einen weg oder fügst einen hinzu. Für größere Änderungen tipp in die Zahl zwischen den beiden und drück Enter: Eine Zahl setzt die Anzahl (`300`), ein Vorzeichen fügt so viele hinzu oder nimmt so viele weg (`+100`, `-50`). Setzt du einen Stapel auf 0, wird er entfernt; bei mehr als einem Stück wirst du vorher gefragt.
- **Stapel teilen.** Klick auf **Split** (teilen), gib ein, wie viele in den neuen Stapel sollen, und klick noch einmal auf **Split**. Teilst du 100 von 300 Äpfeln ab, bleibt ein Stapel mit 200 und daneben ein neuer mit 100.
- **Geben.** Klick auf **Give** (geben), wähl, wer es bekommt und wie viele, und klick noch einmal auf **Give**. Um einen ganzen Stapel zu übergeben, kannst du ihn auch auf den Tab dieser Person ziehen.
- **Hinzufügen.** Gib den Namen des Gegenstands ein und klick auf **Add**. Er landet in der Tasche des geöffneten Tabs und von **All** aus in deiner eigenen Tasche, außer dein Regelsatz legt fest, was jeder tragen kann (siehe unten). Fügst du einen Gegenstand hinzu, den diese Tasche schon hat, kommt einer zu seinem ersten Stapel dazu.
- **Zusammenlegen oder umsortieren.** Zieh einen Stapel auf einen anderen Stapel desselben Gegenstands, um sie zusammenzulegen, egal wie jeder heißt. Der zusammengelegte Stapel bleibt bei dem, der den Stapel getragen hat, auf den du ihn gezogen hast. Zieh einen Stapel auf einen anderen Gegenstand, um die beiden zu tauschen.
- **Aus dem Regelsatz.** In einem Spiel, dessen Regelsatz eigene Gegenstände auflistet, öffnet **From the ruleset** (aus dem Regelsatz) eine Auswahl davon, mit der Suche und den Filtern des Regelsatzes. Hak die gewünschten Gegenstände an und klick auf **Add**: Je einer davon landet dort, wo **Add** einen Gegenstand ablegt, also in der Tasche des geöffneten Tabs oder von **All** aus in deiner eigenen Tasche, außer dein Regelsatz legt fest, was jeder tragen kann. Ein eingetippter Name, der zu einem Gegenstand des Regelsatzes gehört, fügt ebenfalls diesen Gegenstand hinzu. Ein Regelsatz kann auch nur seine eigenen Gegenstände zulassen; dann gibt es keinen Namen zum Eintippen.
- **Startausrüstung.** Bietet der Regelsatz Ausrüstung für den Start an, öffnet **Starting gear** (Startausrüstung) sie. Wähl unter **For** (für), für wen sie ist, triff die Entscheidungen, die ein Ausrüstungspaket verlangt, und klick auf seine Schaltfläche **Take** (nehmen), um es in die Tasche dieser Person zu legen. Ausrüstung, die zum Bogen dieses Charakters passt, steht zuerst; andere Ausrüstung darf er nehmen, wenn der Game Master zustimmt. Das Nehmen ist freiwillig. Ist alles Angebotene genommen, heißt die Schaltfläche **Starting gear (taken)**.
- **Benutzen.** Klick auf **Use** (benutzen), um dem Game Master zu sagen, dass du den Gegenstand benutzt. Bei einem Gegenstand des Regelsatzes, der sagt, was seine Benutzung bewirkt, etwa einem Heilumschlag, erledigt die Engine das zuerst: Sie würfelt, was er zurückgibt, trägt das auf dem Bogen des Trägers ein, nimmt einen vom Stapel oder verbraucht eine Ladung und teilt dem Game Master mit, was passiert ist, damit die Geschichte dem folgt. Was er bei jemand anderem bewirkt, erzählt der Game Master. Ein Gegenstand, von dem nichts übrig ist, wird abgelehnt, und einer, der getragen werden muss, lässt sich nur benutzen, solange er getragen wird. Manche Gegenstände verlangen zuerst eine Probe, etwa eine Schriftrolle über dem, was du lesen kannst: Die Engine würfelt sie, und misslingt sie, ist der Gegenstand umsonst verbraucht.
- **Spitzname.** Gib einen neuen Namen für den Stapel ein und klick auf **Save**. Das ist nur dein Name für diesen Stapel: Er bleibt derselbe Gegenstand, der Game Master kann ihn weiter bei seinem eigenen Namen nennen, und ein Spitzname legt ihn nie mit einem anderen Stapel zusammen. Der eigene Name des Gegenstands steht neben dem Spitznamen. Tipp den eigenen Namen wieder ein, um den Spitznamen zu entfernen.

Ein Gegenstand des Regelsatzes zeigt, was er ist, wenn du ihn auswählst: Art, Seltenheit, Tags, Werte und Beschreibung. Ein Stapel davon fasst nur so viele, wie der Regelsatz sagt; alles darüber beginnt einen neuen Stapel. Der Game Master kann auch einen Gegenstand in den eigenen Worten des Regelsatzes erfinden, etwa eine benannte Klinge. Er funktioniert wie die eigenen Gegenstände des Regelsatzes, und seine Details sagen, dass er erfunden wurde und was die Engine angepasst hat, damit er zum Regelsatz passt, etwa einen Bonus, der auf das begrenzt ist, was seine Seltenheit erlaubt. Manche Regelsätze schalten die eigenen Gegenstände von Game Mode ab: Dann gibt der Game Master nur die Gegenstände des Regelsatzes und die, die er erfindet, während du weiterhin eigene Gegenstände eintippen kannst, außer der Regelsatz lässt nur seine eigenen zu.

### Tragen, Binden und Mitführen

Ein Regelsatz kann auch festlegen, wie seine Gegenstände getragen und mitgeführt werden:

- **Angelegt.** Ein Gegenstand, der Trageplätze belegt, etwa eine Rüstung am Körper oder ein Bogen in beiden Händen, hat eine Schaltfläche **Equipped** (angelegt). Sein Träger kann ihn anlegen, solange diese Trageplätze frei sind; der Tab der Tasche zeigt jeden belegten Trageplatz, etwa **Hands 2/2**. Legst du einen Gegenstand aus einem größeren Stapel an, kommt er in einen eigenen Stapel, der als getragen markiert ist.
- **Binden.** Ein Gegenstand, der gebunden sein muss, um zu wirken (eingestimmt, investiert), hat eine Schaltfläche, die nach dem Wort des Regelsatzes dafür benannt ist, etwa **Bound** (gebunden). Ein Charakter kann nur so viele Gegenstände binden, wie sein Bogen erlaubt, angezeigt zum Beispiel als **Bound 1/3**. Ein verfluchter Gegenstand bleibt gebunden, sobald er gebunden ist: Du kannst die Bindung nicht lösen und ihn weder ablegen noch weggeben oder wegwerfen. Nur die Geschichte kann den Fluch über den Game Master beenden.
- **Mitführen.** Legt der Regelsatz fest, was alles wiegt und was jeder Charakter tragen kann, zeigt jede Tasche ihre Last, etwa **Load 5/6, at most 12**, und **Encumbered** (belastet), sobald sie überschreitet, was ihr Träger mühelos trägt. Ein Gegenstand, der von **All** aus hinzugefügt wird, geht an jemanden, der ihn tragen kann, ohne belastet zu werden: zuerst an dich, dann der Reihe nach an die Party. Kann niemand alles tragen, wird es nach dem verbleibenden Platz jedes Einzelnen verteilt, und niemand bekommt je mehr, als er überhaupt tragen kann. Was niemand tragen kann, bleibt zurück, und du wirst informiert. Jemandem mehr zu geben, als er tragen kann, wird abgelehnt, ob über **Give** oder durch Ziehen eines Stapels auf einen Stapel in seiner Tasche.

Gibst du einen getragenen oder gebundenen Gegenstand jemand anderem, wird er abgelegt und die Bindung gelöst.

Das Charakterblatt eines Partymitglieds listet, was es mitführt.

Der Game Master fügt im Lauf der Geschichte Gegenstände hinzu, entfernt sie und übergibt sie, und er sagt, wer sie trägt. Nennt er einen Gegenstand, der zu den Gegenständen des Regelsatzes gehört, ist es genau dieser Gegenstand, und der Game Master erfährt, was jeder Gegenstand des Regelsatzes ist, den du besitzt. Er benutzt die Gegenstände des Regelsatzes genauso wie die Schaltfläche **Use**. In einem Regelsatz, der festlegt, wie Gegenstände getragen und mitgeführt werden, legt er außerdem Gegenstände an und ab, bindet sie und löst Bindungen und sieht die Last, die Trageplätze und die gebundenen Gegenstände jedes Charakters. Ein Gegenstand, den er hinzufügt, ohne zu sagen, wer ihn bekommt, wird genauso verteilt wie deiner. Jede Änderung wird vorgenommen, wenn die Antwort gespeichert wird, und ihre Benachrichtigung erscheint, wenn du diese Stelle der Geschichte erreichst. Nimmt der Game Master einen Gegenstand, ohne zu sagen, von wem, kommt er zuerst aus deiner Tasche und dann aus dem Rest der Party. Eine Änderung, die nicht möglich ist, etwa etwas wegzunehmen, das niemand hat, wird abgelehnt, und der Game Master erfährt es. Generierst du eine Antwort neu, beginnen ihre Änderungen wieder dort, wo dieser Zug begonnen hat, und ein Swipe zurück zu einer früheren Version zeigt, was diese Version hinterlassen hat. Löschst du die Version, auf der du bist, siehst du, was die nächste hinterlassen hat, und eine Verzweigung des Chats nimmt das Inventar jeder Version mit. Das passiert nur, solange das Inventar noch genau so ist, wie die Antwort es hinterlassen hat: Sobald du selbst etwas änderst, setzt eine neue Antwort ihre Änderungen obendrauf, und nichts, was du getan hast, wird rückgängig gemacht. Ein Kampf nutzt Gegenstände über die Aktion **Items** und zählt alle Stapel eines Gegenstands zusammen, egal wer sie trägt und wie sie heißen. Jede Tasche wird samt Teilungen und Spitznamen in die nächste Sitzung übernommen.

### Geld

Ein Regelsatz kann sein eigenes Geld haben: eine oder mehrere Münzfamilien, etwa Pennys, Schillinge und Kronen, in denen jede größere Münze eine bestimmte Zahl der kleinsten wert ist. Münzen sind Stapel wie jeder Gegenstand. Sie wiegen, was der Regelsatz sagt, und zählen zur Last ihres Trägers, und du kannst sie wie alles andere teilen, geben und zusammenlegen. **From the ruleset** hat eine Liste **Coins** (Münzen), um sie von Hand hinzuzufügen.

Über den Stapeln zeigt eine Zeile jede Münzfamilie im geöffneten Tab und was sie zusammen wert ist, etwa **Coin: crowns ×2, pennies ×12 (worth 132 pennies)**.

Der Game Master verlangt und zahlt in diesen Münzen, und ein gewonnener Kampf oder ein Schatz, den er auswürfelt, kann sie ebenfalls abwerfen. Eine Zahlung kommt aus dem Geldbeutel eines Charakters, aus deinem, sofern er nicht sagt, aus wessen, und nur in der Familie, in der der Preis genannt ist: Die größten Münzen gehen zuerst, und ist der genaue Betrag nicht da, wird eine größere Münze gewechselt, und das Wechselgeld kommt in kleineren zurück. Ein Preis, den der Geldbeutel nicht aufbringen kann, wird abgelehnt, und der Game Master erfährt es. Ein Preis in einer Familie wird nie in einer anderen bezahlt; ein Preis in Salz wird also in Salz bezahlt. Geld, das die Party verdient, kommt wie jeder Gegenstand in die Taschen. Jede Zahlung und jede Einnahme erscheint als Benachrichtigung.

Eine Variante des Regelsatzes kann eine Münze weglassen, etwa in einer langen Nacht, in der keine Kronen die Hügelgräber erreichen. Dann wird niemand in dieser Münze bezahlt oder zahlt mit ihr, und ein Preis, der in ihr genannt ist, wird zum selben Wert in den verbleibenden Münzen angezeigt.

Ein Regelsatz kann auch Märkte haben, sodass davon, wo du bist, abhängt, was du kaufen kannst. Der Game Master sagt, an welchem Ort eine Szene spielt und wie groß er ist, ein Weiler oder eine Stadt in den Worten des Regelsatzes, und ein kleiner Ort verkauft weniger: Seltene Dinge gibt es vielleicht nur in einer Stadt, und manche Händler haben nur an größeren Orten einen Laden oder bedienen nur manche Käufer, etwa eine Kapelle, die nur an Gläubige verkauft. Kaufst du etwas, errechnet die Engine den Preis aus den Kosten des Gegenstands und daraus, wie günstig oder teuer das Geschäft ist, nimmt ihn aus dem Geldbeutel des Käufers und legt den Gegenstand in seine Tasche. Unterkunft, Überfahrt und andere Dienste werden nur bezahlt. Eine Benachrichtigung zeigt, was für wie viel gekauft wurde. Ein Kauf, den der Ort, der Händler oder der Geldbeutel nicht zulässt, wird abgelehnt, und der Game Master erfährt den Grund. Ein Regelsatz kann außerdem jeden Tag an einem Ort anders machen: Ein Ort hat vielleicht nur wenige Stück von etwas Seltenem, ein Händler bietet an diesem Tag etwas Ungewöhnliches an, und du kannst Dinge an einen Händler, der damit handelt, zu einem Teil des Preises zurückverkaufen, bis die Händler des Ortes ausgegeben haben, was sie an einem Tag auszahlen. Ein neuer Markttag am selben Ort, den der Game Master beginnt, wenn die Party bleibt, füllt die Regale und die Kasse wieder.

Auch ein Spiel ohne Regelsatz hat Geld und einen Markt, wenn sein Setting-Kit beides hat. Jedes Starter-Kit hat es, etwa Kupfer, Silber und Gold in High Fantasy, Kupfermünzen und Silbertael in Wuxia, Dollar und Cent in der Gegenwart und Credits in Cyberpunk und Space Opera. Der Laden des Kits listet die alltäglichen Dinge, die sein Setting verkauft, jeweils mit einem Preis und dem kleinsten Ort, der sie verkauft. So hat ein Dorf ein Café, aber erst eine Stadt ein Erste-Hilfe-Set. Du kannst das Geld und den Laden unter **Change its words** (Wörter ändern) des Kits ändern oder das Geld ganz entfernen. Kaufen, Bezahlen und Verdienen funktionieren dann wie oben beschrieben, in den eigenen Münzen des Settings.

## Partymitglieder anwerben und entfernen

Wer zur Party gehört, entscheidet der Game Master im Lauf der Geschichte. Eine Schaltfläche zum manuellen Hinzufügen von Gefährten gibt es nicht. Stattdessen nimmt der GM Partymitglieder über die Erzählung auf oder schickt sie weg – je nachdem, was in der Szene passiert.

Fügt der GM einen NPC hinzu, der genau so heißt wie eine deiner Charakterkarten oder wie mehrere deiner Karten zugleich, fragt ein Fenster, welche davon der Party beitritt. Es zeigt Name, Titel und Avatar jeder Karte. Wähl eine Karte aus oder nimm **Keep the game's own** (den Charakter des Spiels behalten) mit dem Namen des NPCs, etwa **Keep the game's own Emma**, um den Charakter zu holen, den das Spiel angelegt hat. Schließt du das Fenster, passiert dasselbe. Eine Karte mit nur ähnlichem Namen, etwa **Samantha** für einen NPC namens Sam, wird nie hinzugefügt.

Willst du selbst einen Gefährten ziehen lassen, nutz wie oben beschrieben das **X** neben seinem Porträt in **Character Profiles**. Die eigene Persona lässt sich so nicht entfernen.

## Das Adventure Journal

Das Adventure Journal (Abenteuer-Tagebuch) protokolliert die Kampagne fortlaufend. Es entsteht aus gespeicherten Spielereignissen und stammt nicht von der KI – deshalb bleibt es sachlich.

Öffne **Session** (Sitzung; siehe [Session öffnen](sessions-and-saves.md#opening-session)) und wähl dann den Tab **Journal**. Das Journal hat diese Tabs:

- **Timeline** (Zeitleiste): eine Liste der Ereignisse – gefundene Orte, Treffen mit NPCs, Kampfergebnisse, Quests und alles rund um Gegenstände.
- **NPCs**: die NPCs, denen du begegnet bist, mit Porträt und Ruf-Stufe (siehe unten).
- **Map** (Karte): eine schlichte Liste der Orte, die du entdeckt hast.
- **Items** (Gegenstände): ein Protokoll darüber, was du erhalten, benutzt, verloren oder abgelegt hast.
- **Library** (Bibliothek): Notizen und Bücher aus der Spielwelt, die der Game Master dir gezeigt hat – gespeichert zum Nachlesen.
- **Notes** (Notizen): dein eigener Notizblock für freien Text.
- **World** (Welt): in einem Spiel mit generierter Welt die Welt, wie deine Party sie kennt. Der Tab zeigt:
  - wo du bist und wie bekannt die Party ist
  - das Ansehen der Party bei jeder Gruppe, mit der sie zu tun hatte
  - was die Party getan hat
  - Neuigkeiten, die sie erreicht haben, wobei Gerüchte gekennzeichnet sind
  - Ärger, der sich zusammenbraut und von dem sie gehört hat
  - die Vergangenheit, die jeder Einheimische erzählen würde

  Er zeigt nur, was die Party wissen kann. Geheimnisse, die nur der Game Master kennt, bleiben verborgen. Er folgt der Geschichte über Swipes und Verzweigungen hinweg.

### Spielernotizen

Der Tab **Notes** ist dein persönlicher Notizblock. Links tippst du, rechts erscheint eine formatierte Vorschau. Ein Hinweis über dem Notizblock warnt: Game Master und Partymitglieder können die Notizen sehen. Alles, was du hier schreibst, kann also die Geschichte beeinflussen.

Kurz nachdem du zu tippen aufhörst, speichert Marinara die Notizen von allein. Währenddessen zeigt ein kleiner Hinweis **Saving...**, danach **Saved**.

## Ruf-Stufen von NPCs

Der Tab **NPCs** im Adventure Journal führt mit, wie jeder NPC zu dir steht. Zu jedem Eintrag gehören ein Porträt, ein Name und eine Ruf-Stufe.

Die Ruf-Stufe verschiebt sich mit deinem Verhalten in der Geschichte. Es gibt sieben Stufen, von der besten bis zur schlechtesten:

| Stufe | Bedeutung |
|---|---|
| **Devoted** | Tief mit dir verbunden |
| **Allied** | Starker Verbündeter |
| **Friendly** | Positiv gestimmt |
| **Neutral** | Ohne klare Haltung |
| **Unfriendly** | Negativ gestimmt |
| **Hostile** | Gegen dich gewandt |
| **Enemy** | Offener Gegner |

Eine Stufe erscheint erst, wenn sich der Ruf eines NPC vom Startwert weg bewegt hat. Ein brandneuer NPC mit unverändertem Ruf zeigt noch keine Stufe.

Ein NPC taucht in diesem Tab auf, sobald der Game Master ihn beschrieben, ihm einen Ruf gegeben oder eine Beziehungsnotiz festgehalten hat. Jede NPC-Zeile bietet außerdem diese Aktionen:

- Das Porträt des NPC hochladen oder ersetzen.
- Ein Porträt per KI generieren, sofern die Bildgenerierung aktiv ist.
- Den NPC aus dem Journal entfernen.

## Game-Master-Modi

Wer das Spiel leitet, legst du im Einrichtungsassistenten fest – im Schritt **Party** unter **Game Master Mode** (Game-Master-Modus). Zur Wahl stehen zwei Optionen:

- **Standalone GM**: der Standard. Marinara baut dir einen Game Master. Der Einrichtungsassistent beschreibt ihn als **A snarky narrator running the show**, also als schnippischen Erzähler, der die Fäden zieht. Eine Charakterkarte brauchst du dafür nicht.
- **Character GM**: Eine deiner eigenen Charakterkarten übernimmt den Game Master. Die Engine weist das Modell an, sich wie dieser Charakter zu verhalten und dabei weiter das Spiel zu leiten. Gut, wenn du eine bestimmte Erzählstimme willst.

Für das erste Spiel ist **Standalone GM** die richtige Wahl. Den Modus legst du beim Anlegen des Spiels fest. Die komplette Einrichtung Schritt für Schritt steht unter [Game Mode: Erste Schritte](getting-started.md).

## Verwandte Anleitungen

- [Game Mode: Erste Schritte](getting-started.md)
- [Game Mode: Sitzungen und Spielstände](sessions-and-saves.md)
