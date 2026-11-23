# Overworld-Spiele (unveröffentlicht)

Nur Hinweise für Entwickler. **Overworld**-Spiele (Setting-Kits, generierte Welten, die Oberweltkarte, Städte und Dungeon-Karten) sind für Spieler noch nicht implementiert. Nichts auf dieser Seite ist Benutzerdokumentation: Professor Mari und die Docs-Seite in der App lesen `docs/development` nicht (abgesehen von den wenigen Anleitungen, die sie aufführen). Lass Overworld-Inhalte daher in dieser Datei, bis der Modus erscheint. Verschiebe diese Abschnitte dann zurück in die Spieleranleitungen unter `docs/game/`.

Der Modus bleibt gesperrt, solange der Server dieses Flag nicht setzt. Dokumentiere es nicht in `docs/CONFIGURATION.md` oder `.env.example`, solange der Modus unfertig ist.

| Variable | Standard | Beschreibung |
| --- | --- | --- |
| `MARINARA_OVERWORLD_GAMES` | `false` | Erlaubt Spielern, Overworld-Spiele (ein Setting-Kit und eine generierte Welt) anzulegen und ein älteres Spiel in eines umzuwandeln. Ist die Variable aus, bietet der Assistent nur VN-Spiele an. |

## Einrichtung: Game-Modus, Setting-Kit und Welt

### VN oder Overworld

Ein neues Spiel läuft in einem von zwei Game-Modi. Du wählst ihn im ersten Schritt; er gilt für alle Sitzungen des Spiels:

- **Overworld** ist eine für dein Setting gemachte Welt, die du auf einer Oberweltkarte durchwanderst, mit Städten, Orten zum Erkunden und Dungeons. Dafür braucht es ein Setting-Kit und eine Welt. Solange du kein Kit wählst, wird das für dein erstes Genre genommen (High Fantasy, wenn das Genre keines hat), und dafür wird eine Welt ausgewürfelt.
- **VN** ist Game Mode, wie er immer war, erzählt wie eine Visual Novel: Szene für Szene, mit der Szenenkarte und Kämpfen und ohne Setting-Kit, Welt, Oberwelt, Städte oder Dungeon-Karten.

Overworld ist gesperrt, solange der Server-Betreiber nicht `MARINARA_OVERWORLD_GAMES` setzt. Solange es gesperrt ist, ist seine Karte ausgegraut, mit dem Hinweis „Overworld-Spiele mit Setting-Kit und generierter Welt sind noch nicht bereit. Neue Spiele beginnen als VN-Spiele.“ Jedes neue Spiel ist dann ein VN-Spiel, und die Auswahl für Setting-Kit und Welt erscheint nicht. Ein Spiel, das angelegt wurde, bevor es diese Wahl gab, läuft weiter wie bisher: mit einer Welt als Overworld-Spiel, ohne als VN-Spiel.

### Ein Setting-Kit wählen

Ein **Setting-Kit** gibt dem GM die Wörter, in denen deine Art von Welt geschrieben ist: Ortsnamen und Siedlungsgrößen, Arten von Gruppen, wie die Leute reisen, Namen für ein Jahr und einen Tag, wie sich Völker selbst benennen, Geld und Waren, Elemente, Kampforte und welche Familie von Grafik und Musik es nutzt (siehe [Game-Assets](#art-and-music-families)). Es legt außerdem fest, welche Arten von Veränderung die Welt erlaubt, etwa Rivalitäten, Verbrechen, Kriege oder Katastrophen, und wie schnell sie sich verändert. Eine ausgeschaltete Art wird nie eingebracht, sodass ein Streit ein Streit bleiben kann.

Es gibt acht Kits: High Fantasy, Wuxia und Xianxia, Gegenwart, übernatürliche Gegenwart, die 1920er-Jahre, Cyberpunk, Space Opera und Postapokalypse. Die Gegenwart ist standardmäßig sanft, ohne Verbrechen, Konflikte oder Katastrophen und in gemächlichem Tempo.

- Wählst du ein Kit vor einem Genre, setzt es das passende Genre. Ein Genre, das du selbst gewählt hast, bleibt.
- **Für mein Setting schreiben** bittet dein GM-Modell, das Kit für dein Genre, deinen Schauplatz und deinen Ton umzuschreiben. Passt das Ergebnis nicht zusammen, wird das Modell noch einmal mit den Gründen gefragt. Scheitert es erneut, sagt dir der Assistent, was nicht stimmte, und behält dein bisheriges Kit.
- **Begriffe ändern** öffnet alle Begriffe des Kits zur Bearbeitung. Tipp eine Liste in eine Zeile, durch Kommas getrennt. Ein Kit mit einem Problem, etwa einem leeren Namen oder ohne Siedlungen, sagt, was nicht stimmt, und das Spiel kann erst starten, wenn es behoben ist.
- **Dieses Kit herunterladen** speichert eine `.worldkit.json`-Datei zum Teilen. **Kit-Datei importieren** liest eine wieder ein.

Das Spiel behält das Kit, mit dem es angelegt wurde, und eine geteilte Setup-Datei bringt es mit. Eine Experience kann ihr eigenes Kartenpaket mitliefern (ein Kit, fertige Karten und Tiles). Ist diese Experience an, zeigt die Einrichtung ihr Kit als festgelegt und, falls sie Karten mitliefert, eine **Karte** zur Auswahl. Schaltest du die Experience aus, bekommst du deine Entscheidungen zurück.

### Eine Welt erstellen

Ist ein Kit gewählt, legt **Deine Welt** vor Spielbeginn eine Welt in den Wörtern des Kits an: Regionen, Siedlungen jeder Größe, wofür jeder Ort bekannt ist, und die Wege zwischen ihnen (Straßen, Flüsse, Seewege, Sprungrouten) samt Reisedauer in Tagen.

Eine Welt entsteht aus einem **Welt-Seed**. Derselbe Seed, dasselbe Kit und dieselbe Vorgabe ergeben immer dieselbe Welt. **Würfeln** gibt dir eine andere, und eine wieder eingetippte Zahl holt eine zurück. Die Vorschau zeigt eine kleine Karte des Geländes und der Siedlungen, den Startpunkt der Party und eine Liste der Siedlungen nach Region.

- **Mit dieser Lore beginnen** liest in den angehakten Lorebooks die Orte und datierten Ereignisse, die sie nennen, genau so, wie sie geschrieben sind. **Um die Lore herum aufbauen** füllt die Welt um sie herum auf. **Nur die Orte aus der Lore** erschafft nichts daneben.
- **Vorgabe der Welt schreiben** bittet dein GM-Modell um die Gegenwart, die wichtigsten Orte, die Gruppen, um die sich die Gegenwart dreht (was jede will und wer ihre Verbündeten und Rivalen sind), und Namen für Orte und Menschen im eigenen Klang jedes Volkes. Die Orte der Lore bleiben erhalten, was das Modell auch schreibt. Alles, was nicht zum Kit passt, wird weggelassen und gezählt. **Vorgabe ändern** öffnet ihre Wörter, einschließlich der Vor- und Familiennamen jedes Volkes. Ohne Vorgabe sind Orte nummeriert, und Menschen heißen nach ihrem Beruf.

**Eine Welt hat eine Vergangenheit.** Vor Spielbeginn läuft die Welt Jahr für Jahr ab ihrer Gründung vorwärts. Siedlungen wachsen, Gruppen werden gegründet, bekommen und verlieren Anführer und verbünden oder entzweien sich. Wo es sie in der Welt gibt, hinterlassen Banditen, Kriege und Hungersnöte ihre Spuren. Eine schwere Veränderung kommt erst, nachdem sie sich angebahnt hat, und nur in den Arten, die das Kit erlaubt. Datierte Ereignisse aus deiner Lore oder der Vorgabe geschehen dann und dort, wo sie es sagen. Derselbe Seed und dieselbe Vorgabe ergeben dieselbe Vergangenheit.

**Was der GM weiß.** Der GM weiß immer, wo die Party ist, wohin sie gehen kann und wie lange jeder Weg dauert. Er erfährt die bemerkenswertesten Ereignisse der Vergangenheit, wer den aktuellen Ort anführt und die Geschichte dieses Ortes. Nach jedem anderen Ort und jeder anderen Gruppe kann er fragen und bekommt die Antwort in seinem nächsten Zug. Er nennt das Ziel der Party mit einem Orts-Tag. Ein Ort, den die Welt aufführt, behält die Größe, die die Welt ihm gegeben hat. Ein Ort, den die Welt nicht aufführt, etwa ein Bauernhof, behält den Namen, den der GM ihm gibt. Jede Siedlung hat Bewohner, die der Seed auswürfelt, wenn die Party ankommt: mit einem Namen aus ihrer Kultur, einem Beruf, der zum Ort passt, einem Temperament, einer Sprechweise und einem Aussehen. Nennt der GM jemanden mit vollem Namen, wird diese Person in die verfolgten Charaktere aufgenommen.

**Was die Party tut, bleibt bestehen.** Hilft oder schadet die Party einer Gruppe, ändert sie, wie zwei Gruppen zueinander stehen, nimmt oder ruiniert sie einen Ort oder setzt sie jemanden an die Spitze einer Gruppe, hält der GM das in seiner Antwort fest. Jede Änderung wird gegen die Welt geprüft. Eine Änderung einer Art, die das Kit ausgeschaltet hat, oder eine, die einen Ort oder eine Gruppe nennt, die es in der Welt nicht gibt, wird abgelehnt. Von da an erfährt der GM die Welt so, wie die Geschichte sie hinterlassen hat. Ein Ort, den die Geschichte hinzugefügt hat, ist ein Ort, zu dem die Party gehen kann. Ein Swipe, eine Neugenerierung oder eine gelöschte Nachricht nimmt eine Änderung mit ihrer Antwort zurück.

**Die Welt dreht sich ohne die Party weiter.** Sagt der GM, dass Zeit vergeht, macht die Welt Schritte von jeweils einer Woche, nur in den Arten von Veränderung, die das Kit kennt. Katastrophen kommen nie von selbst: Nur der GM kann eine erzählen, und sie wird abgelehnt, wenn ihre Art ausgeschaltet ist. Dort, wo die Party ist, wird nichts entschieden. Nachrichten verbreiten sich: Der GM erfährt von einer fernen Veränderung, sobald die Tage vergangen sind, die die Wege brauchen. Die Taten der Party zählen umso mehr, je bekannter sie wird.

**Änderungen von Hand.** In einem Welteditor kannst du Orte umbenennen oder verschieben, das Gelände bemalen, Orte und Bewohner hinzufügen, das taktische Schlachtfeld eines Ortes bemalen (siehe [Kampf](../game/combat.md#tactical-battles-and-terrain)) und eine Stadt gestalten (siehe [Die Stadt](#the-town)). Jeder Teil des Spiels sieht die Änderungen sofort. Ein umbenannter Ort wird auch unter seinem alten Namen weiterhin erkannt. Änderungen verändern die Welt ab jetzt, nie ihre Vergangenheit. Eine Stadt behält ihre Anlage, sodass Orte und Bewohner, die du hinzufügst, auf ihre nächsten freien Baugrundstücke und in ihre nächsten freien Wohnungen kommen.

**Weltdateien.** **Diese Welt herunterladen** (unter **Deine Welt**) speichert die Welt, die du gerade erstellst, und **Welt herunterladen** auf dem Tab Welt eines Spiels speichert dessen Welt samt Änderungen von Hand als `.world.json`-Datei. **Weltdatei importieren** (neben dem Setting-Kit) liest eine in die Einrichtung eines neuen Spiels ein: Es wählt das Kit der Datei und erstellt ihre Welt. **Deine Welten** macht dasselbe mit einer Welt aus deiner Bibliothek. Eine Datei kann auch die Story der Welt mitbringen: Ereignisse und Szenen, die ihr Ersteller geschrieben hat. Die Szenen einer Story erscheinen in der Erzählung vor der Antwort des GM, genau so, wie sie geschrieben sind, und ihre Questziele stehen unter **Geschichte** auf dem Tab Welt des Journals. Wie du eine schreibst, steht unter [Game-Mode-Story-Skripte schreiben](writing-story-scripts.md). Änderungen von Hand und die Story gehören zu diesem Seed und dieser Vorgabe, sie fallen also weg, wenn du eines davon änderst. Eine Datei, die sich nicht lesen lässt, wird abgelehnt, und der Assistent sagt, warum. Passt der Inhalt einer Datei nicht zum Kit, wird er teilweise weggelassen, und der Assistent sagt, was.

**Später und gespeichert.** Ein Spiel, das ohne Welt angelegt wurde, kann später über den Tab **Welt** des Journals mit **Eine Welt für dieses Spiel erschaffen** eine bekommen. Die Welt beginnt mit dem nächsten Zug; die bisherigen Züge, die Karte und die Bewohner bleiben. Solange Overworld RPG gesperrt ist, ist die Schaltfläche ausgegraut. Ein Spiel behält seine Welt so, wie sie erstellt wurde, sodass eine neue Sitzung, eine Verzweigung und ein exportierter Chat dieselbe Welt behalten. Eine Welt, die eine frühere Version des Generators erstellt hat, läuft weiter, lässt sich aber nicht mehr bearbeiten.

Ein Spiel mit Welt öffnet sich auf der **Oberwelt**, einer Pixelkarte, auf der du die Party zwischen Siedlungen wandern lässt und Städte betrittst. Siehe [Die Oberwelt](#the-overworld).

## Karten

### Die Oberwelt

Ein Spiel mit generierter Welt (siehe [Eine Welt erstellen](#making-a-world)) öffnet sich auf der **Oberwelt**: Der Boden der Welt ist als Pixelkarte hinter der Erzählung gezeichnet, mit Wäldern, Hügeln, Küsten und Meeren, den Straßen und Wegen zwischen den Siedlungen, jeder Siedlung in ihrer Größe und deiner Party. Die größeren Orte sind beschriftet, ebenso der, an dem du gerade bist. Zieh die Karte, um dich umzusehen.

1. Tippe oder klick auf eine Siedlung oder wähl sie unter **Orte** aus (die nächstgelegenen zuerst, mit der Reisedauer).
2. Lies ihre Größe und die Reise von deinem Standort aus ab: Tage oder Stunden und auf welchen Wegen.
3. Klick auf **Dorthin gehen**. Die Party zieht auf der schnellsten Route über die Wege der Welt, und die Tage der Reise vergehen sofort auf der Uhr.

Dein nächster Zug teilt dem GM mit, wohin du gegangen bist, wie lange es gedauert hat und auf welchen Wegen, damit er die Ankunft erzählen kann. Ein zweiter Weg vor deinem nächsten Zug setzt dort an, wo der erste geendet hat.

Höhlen, Minen, Krypten und Ruinen ein paar Schritte außerhalb einer Siedlung sind als **Stätten** eingezeichnet. Eine neue Welt hat in jeder Region eine oder zwei davon, benannt nach der Siedlung daneben („Hollin Caves“, „Ashby Ruins“). **Dorthin gehen** führt über die Wege zu ihrer Siedlung und dann zu Fuß abseits der Straße weiter. An einer Stätte öffnet **Betreten** ihre Karte (siehe [Dungeons, Höhlen und Stationen](#dungeons-caves-and-stations)). Eine Stätte, die für die Geschichte wichtig ist, bleibt **geschlossen** (blass, keine Reise, kein Betreten), bis der GM sie öffnet. Wer eine Welt baut, kann eine Stätte bis dahin auch verbergen oder sie von Anfang an öffnen.

Ein Ort in Trümmern wird in Trümmern gezeichnet. Nach Einbruch der Dunkelheit wird die Karte dunkler, und Fenster leuchten auf. Jede Stilfamilie eines Settings (Fantasy, Wuxia, die Gegenwart, die 1920er-Jahre, Science-Fiction, das Ödland) hat ihre eigenen Tiles. Ein Kit ohne Familie zeichnet schlichte Tiles.

Zum Wechseln zwischen den Ansichten nutzt du **Szene anzeigen** und **Oberwelt anzeigen** in **Spielsteuerung**, am Handy im Drei-Punkte-Menü **Chat-Tools**. Das Spiel merkt sich deine Wahl. Ein Kampf und die Wiederholung einer Sitzung nutzen ihre eigenen Bildschirme.

### Tile-Packs

Tile-Packs enthalten die Farbpalette und jedes Tile als Reihen von Pixeln: jede Bodenart, die Siedlungen nach Größe, die Party sowie die Straßen, Dächer und Bewohner einer Stadt. Jede Stilfamilie hat ein eingebautes Pack. Öffne das Panel **Agenten** und such **Kachelpakete**. Dort kannst du:

- festlegen, mit welchem Pack jedes Setting gezeichnet wird; **Eingebaut** ist sein eigenes,
- mit **Kachelpaket importieren** ein Pack aus einer `.tilepack.json`-Datei importieren,
- ein Pack mit **Exportieren** teilen oder es mit **Entfernen** löschen. Jedes Setting, das damit gezeichnet wurde, nutzt dann wieder seine eigenen Tiles.

Ein Pack braucht nur die Tiles, die es ändert, und alles, was es weglässt, wird schlicht gezeichnet. Nennt ein Pack ein Tile, das Marinara nicht zeichnet, behält es den Rest und sagt, was es weggelassen hat.

### Die Stadt

Ist die Party in einer Siedlung, wähl sie auf der Oberwelt aus und dann **Betreten**, um die Stadt zu sehen. Sie ist aus der Welt heraus angelegt: Straßen und ein Platz, die Orte, die die Welt oder die Geschichte darin hat (an ihren Gebäuden beschriftet), in einem größeren Ort eine Halle, Werkstätten für die Gewerbe, für die der Ort bekannt ist, und Wohnhäuser. Die Leute sind dort, wo die Stunde sie hinführt: tagsüber bei der Arbeit, in der Abenddämmerung auf dem Platz, nachts zu Hause.

Wähl ein Gebäude oder den Platz aus, direkt oder unter **Orte in der Stadt**, um zu sehen, wer dort ist und wie viele Minuten es entfernt ist. **Dorthin gehen** führt über die Straßen und Brücken der Stadt, um Gebäude und von Hand eingezeichnete Hindernisse herum. Die Minuten vergehen auf der Uhr, und dein nächster Zug teilt dem GM mit, wohin die Party gegangen ist und wer dort ist. Ein Besuch an einem benannten Ort, etwa einem Gasthaus, das die Geschichte hinzugefügt hat, macht ihn zum aktuellen Ort der Party. **Stadt verlassen** führt zurück zur Oberwelt. Das Spiel merkt sich, in welcher Ansicht du warst.

Eine Stadt lässt sich mit einem Welteditor wie Pixelforge **von Hand anlegen**, als Teil der Änderungen von Hand an der Welt.

- Gebäude lassen sich auf andere Grundstücke verschieben. Ein Gebäude, das auf das Grundstück eines anderen verschoben wird, tauscht mit diesem den Platz, und jedes Gebäude zeigt weiterhin zu einer Straße.
- Der Boden lässt sich mit Straßen, Pflaster, freier Fläche, Bäumen oder einem Brunnen bemalen, nie aber unter einem Gebäude, vor seiner Tür, mitten auf dem Platz oder unter einem Marktstand.
- Wer wo wohnt und arbeitet, ändert sich nie, und ein Weg zu einem verschobenen Gebäude wird ab seiner neuen Tür berechnet.
- Der Editor lehnt eine Anlage ab, die nicht zur Stadt passt, und sagt, warum. Orte, die die Geschichte im Spiel hinzufügt, finden trotzdem ein Grundstück.
- Eine Anlage kann auch Gebäude abseits der Grundstücke platzieren, Felder, Trampelpfade, Wasser mit Brücken und Hecken malen und Dekorationen setzen. Die Stadtansicht zeichnet all das (Dekorationen nur mit einem Bildpaket, das sie enthält).

### Dungeons, Höhlen und Stationen

Führt die Geschichte unter die Erde oder an Bord, kann der GM eine **Karte des Ortes** öffnen: einen Dungeon, eine Höhle oder eine Station, über die Szene gezeichnet. Sie wird aus dem Spiel und dem Namen des Ortes angelegt, sodass derselbe Ort immer dieselben Räume hat, und bei einer Rückkehr bleibt die Karte, wie sie war. Der GM wählt eine von elf Gestaltungen: Fels-, Eis-, Kristall- und Lavahöhlen; eine Krypta, eine Kanalisation und einen Tempel; sowie die Korridore, das Labor, das Maschinendeck und die Hydroponik einer Station. Gibt es ein Tile-Pack für dieses Aussehen, nutzt die Karte dessen Grafik. Ohne eines bleibt sie in schlichten Farben.

Ein Ort in der Stadt, in den die Party hinabsteigen kann (je nach Name eine Höhle, Mine, Krypta, Kanalisation oder Ruine, in Science-Fiction ein Wrack oder ein Bunker), zeigt **Hinabsteigen**, wenn die Party dort ist.

- Damit öffnet sich jedes Mal dieselbe Karte, und beim Verlassen steht die Party wieder in der Stadt.
- Ist die Party gerade auf einer anderen Karte, verlass zuerst diese.
- Ein Ort kann auch eine von Hand gemachte Karte haben, erstellt mit einem Welteditor wie Pixelforge. **Hinabsteigen** öffnet dann diese Karte, egal wie der Ort heißt, gezeichnet mit dem Pack, das sie nennt. Auf so einer Karte ist der Ausgang dort, wo die Party hereingekommen ist, Requisiten versperren nie den Weg, und Leute stehen zu den Uhrzeiten, die die Karte ihnen gibt, auf benannten Plätzen. Der GM erfährt, wer dort ist.

Klick auf eine Stelle der Karte oder nutze die Pfeiltasten, um auf dem kürzesten Weg dorthin zu gehen. Die Minuten vergehen auf der Uhr (etwa eine Minute pro dreißig Schritte), und dein nächster Zug teilt dem GM mit, aus welchem Bereich in welchen die Party gegangen ist. Die Beschriftung oben nennt den aktuellen Bereich. **Szene anzeigen** und **Karte anzeigen** in **Spielsteuerung** wechseln zwischen Szene und Karte.

Zum Verlassen geh zurück zum Ausgang (eine Treppe, eine Leiter oder eine Luke) und wähl **Verlassen**. Der GM kann die Karte auch beenden, wenn die Geschichte den Ort verlässt. Wird ein Zug neu generiert, in dem eine Karte geöffnet, auf ihr gelaufen oder sie verlassen wurde, kehrt die Karte zu ihrem Stand vor diesem Zug zurück.

## Zeit

In einem Spiel mit Welt vergeht die Zeit außerdem von selbst:

- Solange die Oberwelt vorne ist und das Spiel auf dich wartet, vergeht alle fünf echten Sekunden eine Spielminute. Die Uhr steht still, während der GM schreibt, bevor du seine Antwort gelesen hast, während die Szenenansicht vorne ist und während die App im Hintergrund läuft.
- Ein Weg auf der Oberwelt lässt die Tage vergehen, die seine Route dauert.
- Sagt der Game Master (GM), dass Tage vergehen (eine Reise, eine lange Rast, eine Wartezeit), rückt die Uhr um diese Tage vor. Eine neu generierte Antwort stellt sie nicht noch einmal vor. Setz den Tag von Hand, wenn die neue Erzählung eine andere Dauer hat.

## Kampf

### Elemente

Welche Elemente es gibt, gehört zum Setting:

- Kein Setting-Kit oder ein Kit, das keine nennt: die klassischen sechs (Feuer, Eis, Blitz, Gift, Heiliges, Schatten).
- Wuxia: die fünf Wandlungsphasen (Holz, Feuer, Erde, Metall, Wasser), von denen jede die nächste überwindet.
- Cyberpunk und Space Opera: kinetisch, thermisch, EM sowie chemisch oder Plasma.
- Gegenwart und 1920er-Jahre: keine.

Regen und Sturm auf offenem Gelände dämpfen feuerartige Elemente und stärken blitzartige. In einem taktischen Kampf trifft ein Element härter gegen eines, das es schlägt, und schwächer gegen eines, von dem es geschlagen wird. Die Elemente und Reaktionen eines Kits kannst du unter **Begriffe ändern** ändern. Siehe [Ein Setting-Kit wählen](#choosing-a-setting-kit).

### Beute

Welche Beute du erhältst, hängt von deinem Setting ab. In einem Spiel mit Setting-Kit stammt die Beute aus dem Kit (in der Gegenwart etwa eine Geschenkkarte oder ein Erste-Hilfe-Set, nie ein verzaubertes Schwert). Diese Begriffe kannst du unter **Begriffe ändern** ändern. Ohne Kit gibt es die für das Genre übliche Beute. Bei einem Genre ohne Starter-Kit, etwa Steampunk, gibt es einfache Gegenstände, die keinem bestimmten Setting zugeordnet sind. Hat der Regelsatz des Spiels eigene Beutetabellen, hinterlassen Gegner stattdessen dessen Gegenstände. Schaltet der Regelsatz die eigenen Gegenstände von Game Mode ab, gibt es nur seine Beute.

### Handgemachte Schlachtfelder

Eine Welt kann auch handgemachte Schlachtfelder haben: Spielfelder, die Feld für Feld für einen ihrer Orte gemalt wurden, mit einem Welteditor wie Pixelforge. Beginnt ein Kampf an diesem Ort oder an einem Ort darin, nutzt er eines dieser Spielfelder statt eines generierten.

- Das Spielfeld wird genau so verwendet, wie es gemalt wurde. Hat der Ort mehrere, entscheidet der Seed des Kampfes, eine Zahl, die eines davon auswählt.
- Die Geländevorgabe des GM wird dort nicht genutzt, seine Formation entscheidet aber weiterhin, wo jede Seite startet. Der GM erfährt, dass das Spielfeld für diesen Ort gemacht wurde.
- Ein handgemachtes Spielfeld muss drei Regeln erfüllen: Es hat eine der drei Spielfeldgrößen, die beiden Spalten an jeder Seite, an denen sich die Seiten aufstellen, sind Ebenen, und jedes Feld, auf dem ein Kämpfer stehen kann, ist mit dem Rest verbunden. Der Editor lehnt ein Spielfeld ab, das eine Regel verletzt, und sagt, warum.

Diese Spielfelder werden zusammen mit den Änderungen von Hand an der Welt gespeichert und bleiben so in Weltdateien, Kartenpaketen und der Bibliothek erhalten.

### Schlachtfeldszenen

Ein Spiel mit Setting-Kit benennt seine eigenen Szenen in seinen Worten, sodass ein Cyberpunk-Kampf auf einem Dach oder im Korridor eines Megablocks stattfindet und ein Wuxia-Kampf in einem Bambuswald oder einem Teehaus. Auch die Felder des Spielfelds tragen die Begriffe des Settings (Deckung und Trümmer statt Wald und Ruinen). Die Szenen und Feldbegriffe eines Kits kannst du unter **Begriffe ändern** ändern.

## Journal, Geld und Sitzungen

Der Tab **Welt** zeigt, wo du bist und wie bekannt die Party ist, ihr Ansehen bei jeder Gruppe, was sie getan hat, Neuigkeiten, die sie erreicht haben (Gerüchte sind gekennzeichnet), Ärger, der sich zusammenbraut und von dem sie gehört hat, und die Vergangenheit, die jeder Einheimische erzählen würde. Er zeigt nur, was die Party wissen kann. Geheimnisse, die nur der GM kennt, bleiben verborgen. Er folgt der Geschichte über Swipes und Verzweigungen hinweg.

Auch ein Spiel ohne Regelsatz hat Geld und einen Markt, wenn sein Setting-Kit beides hat. Jedes Starter-Kit hat es, etwa Kupfer, Silber und Gold in High Fantasy, Kupfermünzen und Silbertael in Wuxia, Dollar und Cent in der Gegenwart und Credits in Cyberpunk und Space Opera. Der Laden des Kits listet Alltagswaren mit Preis und dem kleinsten Ort, der sie jeweils verkauft. So hat ein Dorf ein Café, aber erst eine Stadt ein Erste-Hilfe-Set. Du kannst das Geld und den Laden unter **Begriffe ändern** des Kits ändern oder das Geld entfernen. Siehe [Ein Setting-Kit wählen](#choosing-a-setting-kit).

In einem Spiel mit generierter Welt geht die Welt dort weiter, wo sie zurückgelassen wurde: die vergangenen Tage, die Taten und das Ansehen der Party, die Orte und Gruppen, die die Geschichte hinzugefügt hat, und wohin die Party gezogen ist.

## Familien für Grafik und Musik

Ein Spiel, das mit einem Setting-Kit gestartet wurde, hat eine Stilfamilie für Grafik und Musik. Du siehst sie unter **Grafik und Musik**, wenn du die Wörter des Kits änderst: `fantasy`, `scifi`, `modern`, `wuxia`, `jazz_age`, `wasteland` oder eine eigene Familie des Kits. Das Spiel nutzt die Ordner, die nach seiner Familie benannt sind, und jeden Ordner, der nach keiner Familie benannt ist, und lässt die Ordner anderer Familien weg. Ein Cyberpunk-Spiel spielt nie Fantasy-Kampfmusik und zeigt nie den verzauberten Wald. Passt nichts aus seiner Familie oder den gemeinsamen Ordnern, läuft lieber gar nichts als ein Titel einer anderen Familie. Ein Spiel ohne Setting-Kit nutzt jeden Ordner.

- **Musik**: Lege die Titel des Settings unter `music/<state>/<family>/<intensity>` ab, zum Beispiel `combat/wuxia/intense`. Sie haben Vorrang vor gemeinsamen Titeln.
- **Hintergründe**: `backgrounds/<family>`. Hintergründe, die in einem Spiel mit Setting-Kit generiert werden, landen ebenfalls dort.
- **Kampfgeräusche**: Ein Geräusch in `sfx/combat/<family>`, das genauso heißt wie ein mitgeliefertes, etwa `sword-swing`, ersetzt dieses in Spielen dieser Familie. Die mitgelieferten Kampfgeräusche sind Fantasy, die Kämpfe anderer Familien bleiben also still, bis du eigene Geräusche für sie hinzufügst.

Die mitgelieferten Starter-Hintergründe gelten als gemeinsam, außer den Fantasy-Hintergründen (`ancient_library`, `castle_cliff`, `enchanted_forest`) und dem modernen `city_night`. Ein Setting-Kit, das gespeichert wurde, bevor es Stilfamilien gab, funktioniert weiter: Eines, das aus einem Starter-Kit entstanden ist, nutzt dessen Familie, und jedes andere nutzt jeden Ordner, bis du unter **Grafik und Musik** eine Familie auswählst. Die Auswahlleiste oben nennt die Familie des geöffneten Spiels.

## World Maps: Aus der Welt

- **Aus der Welt** erscheint, wenn das Game eine Welt erstellt (siehe [Eine Welt erstellen](#making-a-world)). Es legt diese Welt als Karte an: ihre Regionen, Siedlungen und Orte sowie die Wege dazwischen mit ihren Reisezeiten. Du prüfst die Karte, bevor sie gespeichert wird. Eine KI-Generierung ist nicht nötig, und die Orte der Karte sind die Orte der Welt. Im Spiel bleiben beide im Gleichschritt. Der Game Master und die Märkte nutzen den Ort, an dem die Karte die Party verortet. Nennt der Game Master einen Ort der Welt, bewegt die Karte die Party dorthin. Ab World Maps 1.6.0 nimmt sie dabei den kürzesten Weg. Frühere Versionen gehen nur einen Schritt: zu einem darin liegenden Ort, zum übergeordneten Ort oder zu einem Ort, der über einen Weg verbunden ist.

## Story-Skripte

Welten können Story-Skripte enthalten. Siehe [Game-Mode-Story-Skripte schreiben](writing-story-scripts.md).
