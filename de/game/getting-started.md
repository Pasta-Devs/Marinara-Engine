# Game Mode: Erste Schritte

Game Mode macht aus Marinara Engine ein Einzelspieler-Rollenspiel, das eine KI als Game Master leitet. In dieser Anleitung erfährst du, was Game Mode ist und was du zum Start brauchst. Danach geht es Schritt für Schritt durch den Einrichtungsassistenten, und du siehst, wo die einzelnen Spielfunktionen zu finden sind. Lies sie einmal durch, starte ein Spiel und folge am Ende den Links zu den vertiefenden Themen.

## Was Game Mode ist

Game Mode ist einer der Chat-Modi von Marinara. Die anderen beiden heißen Conversation und Roleplay.

In Game Mode leitet ein KI-Game-Master (GM) eine Geschichte für dich – also die KI, die die Welt erzählt, jeden Charakter spielt, dem du begegnest, und entscheidet, wie es weitergeht. Das funktioniert wie der Dungeon Master am Spieltisch.

Die Engine führt den Spielzustand über alle Züge hinweg mit. Dazu gehören die Karte, deine Party (deine Abenteuergruppe), Nicht-Spieler-Charaktere (NPCs), Gegenstände, Quests, die Zeit in der Spielwelt und das Wetter. Gespielt wird über viele Züge hinweg. Ein langes Spiel lässt sich in mehrere **Sitzungen** aufteilen – so wie eine Tischrunde eine Kampagne über mehrere Spieleabende verteilt. Die Kampagne ist die gesamte fortlaufende Geschichte.

Du musst nicht jede Mechanik nutzen. Manche Spielerinnen und Spieler lassen Kampf und Würfelwürfe weg und nutzen Game Mode für erzählerisches, visuelles Spiel. Die Rollenspielsysteme sind da, wenn du sie willst.

## Bevor du startest

Für den Spielstart brauchst du genau eine Sache: eine Verbindung zu einem KI-Anbieter für den GM. Eine Verbindung koppelt Marinara an einen KI-Anbieter, damit Text generiert werden kann. Falls noch keine eingerichtet ist, hilft [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).

Alles Weitere ist optional und standardmäßig aus. Nachrüsten kannst du jederzeit:

- **Bildgenerierung.** Game Mode hat ein visuelles Layout mit Hintergründen und Charakterbildern. Zum Füllen brauchst du eine Verbindung zur Bildgenerierung. Die Einstellung **Visual Generation** (visuelle Generierung) im Assistenten ist standardmäßig aus und muss von Hand aktiviert werden. Ohne sie bekommst du weiterhin Geschichte, Zustandsverfolgung und Kampf, aber die visuellen Flächen bleiben leer.
- **Ein lokales Modell für Szeneneffekte.** Marinara kann ein kleines Modell auf dem eigenen Rechner laufen lassen; es heißt **Local Model (Gemma)**. Es liefert Vorschläge für Hintergrund und Musik, ohne Zusatzkosten. Im Assistenten ist es die Standardwahl. Mehr dazu unter [Lokales Modell einrichten](../connections/local-model.md).
- **Der Storyboard-Agent.** Installiere ihn über **Agents > Download Agents** (Agenten herunterladen) und aktiviere ihn danach für das fertige Spiel unter **Chat Settings > Agents**, wenn du Storyboards als Standbilder oder Animationen willst.
- **Eine Verbindung zur Videogenerierung.** Die brauchst du nur für Szenenvideos oder animierte Storyboards.
- **Musik.** Der Agent **Music DJ** kann Spielmusik abspielen. Er benötigt Spotify oder einen lokalen Musikordner und ist standardmäßig aus.

## Der Einrichtungsassistent

Beim Anlegen eines Game-Mode-Chats öffnet sich ein Einrichtungsassistent mit sieben Schritten. Pflicht ist nur ein einziges Feld: die GM-Verbindung im ersten Schritt. Alles andere ist sinnvoll vorbelegt. Du kannst also zügig durchklicken und den Rest Marinara überlassen.

Die sieben Schritte:

1. **Connection.** Wähle den **Game Mode**: **Overworld RPG** oder **Classic**. Overworld RPG ist noch nicht fertig, deshalb starten neue Spiele vorerst als **Classic**. Siehe [Classic oder Overworld RPG](#classic-or-overworld-rpg). Vergib den Spielnamen, wähle die GM-Verbindung und optional eine Verbindung für Szeneneffekte. Für Szeneneffekte ist **Local Model (Gemma)** vorbelegt.
2. **World.** Lege Genre, Schauplatz, Ton, Schwierigkeit, Inhaltsfreigabe und Sprache fest. Die Ideen, die unter dem Schauplatz und später unter den Zielen angeboten werden, stammen aus verschiedenen Arten von Settings, bei jedem Öffnen des Assistenten neu gemischt. Wähle unter **Combat Preference** (bevorzugte Kampfart) zwischen **Classic** (Menükämpfen) und **Tactical** (Rasterkämpfen). Tactical-Spiele bieten außerdem optionale Einstellungen für Schlachtfeld-Seed, Größe und Geländehinweise. Ist ein Game-Mode-Regelsatz installiert, erscheint darunter **Rules**: Behalte **Marinara's own rules** oder wähle den Regelsatz. Siehe [Regeln auswählen](#choosing-rules). Bei Overworld RPG folgen darunter **Setting kit** (Setting-Kit) und **Your world** (deine Welt). Siehe [Ein Setting-Kit wählen](#choosing-a-setting-kit) und [Eine Welt erstellen](#making-a-world).
3. **Party.** Wähle deine Persona (den Charakter, den du spielst), den **Game Master Mode** und eventuelle Partymitglieder. **GM intro message** (Intro-Nachricht des GM) legt die erste Nachricht des Spiels fest. Siehe [Die Intro-Nachricht des GM](#the-gm-intro-message).
4. **Goals.** Sag dem GM, was du dir vom Abenteuer erhoffst.
5. **Lorebooks.** Hänge die Lorebooks an, deren Fakten der GM als verbindlich behandeln soll. Ein Lorebook ist eine Sammlung von Hintergrundwissen zur Welt. Mehr dazu unter [Lorebooks](../lorebooks/overview.md).
6. **Features.** Aktiviere optionale Systeme wie Visual Generation, Music DJ und HUD-Widgets. Installierbare Agenten aktivierst du nach dem Anlegen des Spiels in den Chat Settings.
7. **GM.** Wähle den Präsentationsstil und sieh dir die erweiterten GM-Anweisungen an, bevor die Welt gebaut wird.

Zum Schluss klickst du auf **Start Game**.

Wenn du bei Tactical-Spielen die Schlachtfeldoptionen leer lässt, wählt der GM eine zur Szene passende Vorgabe und die Engine erzeugt das Spielfeld. Ein fester Seed reproduziert die Generierung bei gleichen Begegnungseingaben; mit Geländehinweisen bittest du den GM etwa um eine verfallene Mauer oder Waldlichtung. [Game Mode: Kampf](combat.md#tactical-battles-and-terrain) beschreibt Bewegungsregeln, Geländeboni und Generierungsfehler.

<a id="classic-or-overworld-rpg"></a>

### Classic oder Overworld RPG

Ein neues Spiel läuft in einem von zwei Game Modes, die du im ersten Schritt wählst und die für alle Sitzungen des Spiels gelten:

- **Overworld RPG** (der Standard, sobald es fertig ist): eine für dein Setting gemachte Welt, die du auf einer Oberweltkarte durchwanderst, mit Städten zum Besuchen, Orten zum Erkunden und Dungeons zum Hinabsteigen. Dafür braucht es ein Setting-Kit und eine Welt; solange du kein Kit wählst, wird das für dein erstes Genre genommen (High Fantasy bei einem Genre ohne eigenes), und dafür wird eine Welt ausgewürfelt.
- **Classic**: Game Mode, wie er immer war. Die Geschichte wird Szene für Szene erzählt, mit der Szenenkarte und Kämpfen, aber ohne Setting-Kit, Welt, Oberwelt, Städte oder Dungeon-Karten.

Ein Spiel, das angelegt wurde, bevor es diese Wahl gab, läuft weiter wie bisher: mit einer Welt als Overworld-Spiel, ohne als Classic-Spiel.

Overworld RPG wird noch fertiggestellt. Bis dahin ist seine Auswahlkarte ausgegraut, mit dem Hinweis „Overworld games, with a setting kit and a generated world, are not ready yet. New games start as Classic games.“ Jedes neue Spiel ist dann Classic, und die Auswahl für Setting-Kit und Welt unten erscheint nicht. Sie beschreibt Overworld-RPG-Spiele.

<a id="choosing-rules"></a>

### Regeln auswählen

**Rules** (Regeln) erscheint nur, wenn mindestens ein Regelsatz installiert ist, und nur bei einem neuen Spiel. Es ist unabhängig von **Combat Preference**: Das eine entscheidet, wie Proben und Charakterbögen funktionieren, das andere, wie Kämpfe dargestellt werden.

- **Marinara's own rules** ist der Standard: die eingebauten d20-Proben und der Bogen mit sechs Attributen.
- Ein Regelsatz wie **5e (SRD 5.1)** zeigt eine kurze Zusammenfassung dessen, was er abdeckt, und eine Zeile dazu, was in Kämpfen passiert. Ein Regelsatz, der seine Kämpfe selbst auflöst, sagt das. Einer, der nur den Bogen beisteuert, sagt, dass Kämpfe mit Marinaras Kampfsystem und mit Gesundheit, Energie und Fähigkeiten aus dem Bogen laufen. Einer, der beides nicht tut, sagt, dass Kämpfe mit Marinaras Kampfsystem laufen, und nennt die gewählte **Combat Preference**.

Löst der Regelsatz seine Kämpfe selbst auf, gehört der Kampfbildschirm diesem Regelsatz: Das Menü enthält die eigenen Angriffe und Fähigkeiten deines Charakters, jeweils mit dem, was sie aus dem Aktionsbudget und den Pools des Regelsatzes verbrauchen; das Panel darunter zeigt die Zugreihenfolge, die Runde, die Zustände aller Beteiligten unter den Namen des Regelsatzes und den Rest jedes Budgets; und das Protokoll zeigt die echte Rechnung, etwa „Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit.“ Jede Aktion wird in dem Moment, in dem sie wirkt, in den Charakterbogen geschrieben. Schließt du den Tab mitten im Kampf, geht also nichts verloren, und der Game Master erfährt danach, dass die Zahlen bereits feststehen. Sagt der Regelsatz außerdem, wie viel ein Feld des Schlachtfelds in seiner eigenen Entfernungseinheit wert ist, bestimmt deine **Combat Preference**, wie der Kampf dargestellt wird: **Classic** spielt ihn ohne Positionen, **Tactical** auf einem Spielfeld, auf dem du gehst, Reichweite und Entfernung in der Einheit des Regelsatzes misst und eine Form auf ein Feld richtest. Siehe [Kampf](combat.md#games-whose-ruleset-resolves-its-own-fights). Ein Regelsatz ohne Angaben zur Entfernung behält die Präferenz, nutzt sie aber nicht.

Der Regelsatz wird beim Anlegen des Spiels festgelegt und bleibt bei diesem Spiel. Er lässt sich später weder wechseln noch hinzufügen.

Manche Regelsätze bieten **layers** (Ebenen): benannte Varianten wie Low magic oder Hard winter, die als Schalter unter dem Regelsatz erscheinen, jeweils mit einer Zeile, die sagt, was sie bewirken. Eine Ebene kann die Schwierigkeiten verschärfen, eine Auswahl auf dem Charakterbogen einschränken, einige vorgefertigte Einträge aus der Auswahl des Bogeneditors herausnehmen und dem Game Master zusätzliche Anweisungen geben, auch für die Welt, die er bei der Einrichtung baut. Manche Ebenen schließen sich gegenseitig aus, und der Assistent deaktiviert die, die du nicht haben kannst. Sobald das Spiel beginnt, stehen die Ebenen fest, genau wie der Regelsatz selbst, und ein Bogen, der bereits etwas nutzt, das eine Ebene wegnimmt, behält es.

Regelsätze kommen aus zwei Quellen. Offizielle installierst du über **Download Agents**, wo sie mit **Rules** gekennzeichnet sind. Community-Regelsätze importierst du aus einer Datei oder aus dem GitHub-Repository eines Autors, und sie werden unter ihrer Herkunft abgelegt, etwa `local/ember-roads` oder `alice/v20`. Der Import nutzt denselben Schalter **Allow custom Agent imports** (eigene Agenten-Importe erlauben) wie importierte Agenten. Solange dieser Schalter aus ist, bleiben importierte Regelsätze bei neuen Spielen außen vor, und Spiele, die bereits einen nutzen, funktionieren weiter. Ein Spiel mit einem importierten Regelsatz läuft immer mit genau der Version, mit der es angelegt wurde. Wie du einen eigenen schreibst, steht unter [Regelsätze für Game Mode schreiben](../extending/writing-rulesets.md).

Hast du einen Regelsatz gewählt, listet der Schritt **Party** unter den Auswahlfeldern deine Persona und die Partymitglieder auf und kennzeichnet jeden mit **Has a sheet** (Bogen vorhanden) oder **Starts on a blank sheet** (beginnt mit leerem Bogen). Einen Bogen legst du unter **Stats** im Charakter- oder Persona-Editor an (siehe [Regelsatzbögen](../characters/colors-and-stats.md#ruleset-sheets)). Das Spiel kopiert jeden Bogen, wenn die Welt generiert wird. Nichts, was du im Spiel änderst, geht an den Charakter oder die Persona zurück. Ein Mitglied ohne Bogen bekommt einen leeren, auf dem jeder Wert dem Standard des Regelsatzes entspricht; die Weltgenerierung erfindet nie Werte.

Eine geteilte Setup-Datei merkt sich ihren Regelsatz. Importierst du eine und hast diesen Regelsatz nicht oder nur in einer älteren Version, sagt dir der Assistent, welcher Regelsatz es war, und das Spiel nutzt Marinaras eigene Regeln, sofern du ihn nicht installierst und auswählst.

<a id="choosing-a-setting-kit"></a>

### Ein Setting-Kit wählen

Ein **Setting kit** gibt dem Game Master die Wörter, in denen deine Art von Welt geschrieben ist: wie ihre Orte heißen und wie groß eine Siedlung werden kann, ihre Arten von Gruppen, wofür ein Ort bekannt sein kann, wie die Leute reisen, wie ein Jahr und ein Tag heißen, wie sich ihre Völker selbst benennen, was ein gewonnener Kampf fallen lassen kann, ihr Geld und die alltäglichen Dinge, die dort verkauft werden, ihre Elemente, die Orte, an denen ihre Kämpfe stattfinden, und welche Familie von Grafik, Musik und Klängen sie nutzt (siehe [Game-Assets](game-assets.md#a-settings-own-art-and-music)). Es legt außerdem fest, welche Arten von Veränderung die Welt kennt, etwa Rivalitäten, Verbrechen, Kriege oder Katastrophen, und wie schnell sie sich von selbst verändert. Eine ausgeschaltete Art wird nie als Hintergrundereignis eingebracht, und eine Szene eskaliert nicht dorthin, sodass ein Streit ein Streit bleiben kann.

Angeboten wird es nur bei einem neuen Overworld-RPG-Spiel, das immer eines hat: Solange du kein Kit wählst, wird das für dein erstes Genre genommen. Für den Anfang gibt es acht: High Fantasy, Wuxia und Xianxia, Gegenwart, übernatürliche Gegenwart, die 1920er-Jahre, Cyberpunk, Space Opera und Postapokalypse. Die Gegenwart ist standardmäßig sanft, ohne Verbrechen, Konflikte oder Katastrophen und in gemächlichem Tempo, für Slice of Life.

Wählst du ein Kit, bevor du ein Genre gewählt hast, setzt es das passende Genre, etwa **Cyberpunk** für Cyberpunk oder **Wuxia** für Wuxia und Xianxia, und die Ideen für Schauplatz und Ziele beginnen dann mit denen des Kits. Ein Genre, das du selbst gewählt hast, bleibt, wie es ist.

Nach der Auswahl bittet **Write it for my setting** (für mein Setting umschreiben) deine Game-Master-Verbindung, das Kit für das gewählte Genre, den Schauplatz und den Ton umzuschreiben. Passt das, was das Modell schreibt, nicht zusammen, wird es noch einmal mit den Gründen gefragt; danach sagt dir der Assistent, was nicht stimmte, und behält dein bisheriges Kit. **Change its words** (Wörter ändern) öffnet jedes Wort des Kits zum Bearbeiten. Eine Liste wird in einer Zeile getippt, durch Kommas getrennt. Ein Kit mit einem Problem, etwa einem leeren Namen oder ohne Siedlungen, sagt, was nicht stimmt, und das Spiel kann erst starten, wenn es behoben ist.

Das Spiel behält das Kit, mit dem es angelegt wurde. Der Game Master liest es in jedem Zug, und die Weltgenerierung nutzt seine Wörter. Auch eine geteilte Setup-Datei bringt ihr Kit mit.

Eine Experience kann ihr eigenes **Kartenpaket** mitliefern: ein Setting-Kit, fertige Karten und eigene Tiles. Ist diese Experience an, zeigt die Einrichtung ihr Kit als festgelegt (kein Kit zur Auswahl) und, falls sie Karten mitliefert, eine **Map** (Karte) zur Auswahl; das Spiel wird auf dieser Karte gespielt und mit den Tiles der Experience gezeichnet. Schaltest du die Experience aus, bekommst du deine eigenen Entscheidungen zurück.

**Download this kit** (dieses Kit herunterladen) speichert das Kit als Datei (`.worldkit.json`) zum Teilen, und **Import a kit file** (Kit-Datei importieren) liest eine wieder ein. **Import a world file** (Weltdatei importieren) holt eine ganze Welt auf einmal herein (siehe unten).

<a id="making-a-world"></a>

### Eine Welt erstellen

Ist ein Setting-Kit gewählt, legt **Your world** vor Spielbeginn eine ganze Welt in den Wörtern des Kits an: ihre Regionen, Siedlungen jeder Größe auf der Größenleiter des Kits, wofür jeder Ort bekannt ist, und die Wege zwischen ihnen (Straßen, Flüsse, Seewege, Sprungrouten) samt der Zahl der Tage, die jede Reise dauert. Jedes neue Overworld-RPG-Spiel hat eine, ausgewürfelt aus einem Seed, den du ändern kannst.

Eine Welt entsteht aus einem **World seed** (Welt-Seed). Derselbe Seed, dasselbe Kit und dieselbe Vorgabe ergeben immer dieselbe Welt: **Roll** (würfeln) gibt dir also eine andere, und eine wieder eingetippte Zahl holt eine zurück. Die Vorschau darunter ist die Welt, die das Spiel spielen wird: eine kleine Karte des Geländes und seiner Siedlungen, der Startpunkt der Party und eine Liste aller Siedlungen nach Region.

- **Start from this lore** (von dieser Lore ausgehen) liest in den angehakten Lorebooks die Orte, die sie nennen, und die datierten Ereignisse, die sie festhalten, jeweils genau so, wie die Lore es sagt, samt den Einträgen, aus denen sie stammen. **Build around the lore** (um die Lore herum bauen) füllt die Welt um sie herum auf; **Only the lore's places** (nur die Orte der Lore) erschafft nichts daneben.
- **Write the world's brief** (Vorgabe der Welt schreiben) bittet deine Game-Master-Verbindung um den Rest: die Gegenwart zu Spielbeginn, die wichtigsten Orte, die Gruppen, um die sich die Gegenwart dreht (was jede will und wer ihre Verbündeten und Rivalen sind), und Namen für die Orte und Menschen, die die Welt zeichnet, jeweils im Klang und in der Reihenfolge der Völker des Kits. Die Orte der Lore bleiben erhalten, was das Modell auch schreibt, und alles, was nicht zum Kit passt, wird weggelassen und gezählt, ebenso die wenigen Namen, zu denen Modelle immer wieder greifen. **Change the brief** (Vorgabe ändern) öffnet ihre Wörter zum Bearbeiten, einschließlich der Vor- und Familiennamen jedes Volkes.

Ohne Vorgabe besteht die Welt nur aus dem Kit und den Orten der Lore, und die Orte, die sie zeichnet, sind nummeriert, bis eine Vorgabe ihnen Namen gibt.

Eine Welt hat auch eine Vergangenheit. Vor Spielbeginn lässt die eigene Engine der Welt sie Jahr für Jahr ab ihrer Gründung vorwärtslaufen: Jede Siedlung wird gegründet und wächst auf ihre heutige Größe, die Gruppen der Vorgabe werden an ihren Sitzen gegründet, bekommen und verlieren Anführer und verbünden oder entzweien sich, und wo es sie in der Welt gibt, hinterlassen Banditen, Kriege und Hungersnöte ihre Spuren; manche Orte gehen dabei verloren. Eine schwere Veränderung kommt erst, nachdem sie sich eine Weile angebahnt hat (Spannungen vor einem Krieg, eine Dürre vor einer Hungersnot), und sie nutzt nur die Arten von Veränderung, die das Kit erlaubt: Die Vergangenheit einer sanften Welt ist ebenfalls sanft. Datierte Ereignisse, die deine Lore festhält oder die Vorgabe nennt, geschehen dann und dort, wo sie es sagen. Derselbe Seed und dieselbe Vorgabe ergeben immer dieselbe Vergangenheit.

Der Game Master erfährt die bemerkenswertesten Ereignisse der Vergangenheit, wer den Ort hält, an dem die Party ist, und wer diese Gruppe anführt, sowie die eigene Vergangenheit dieses Ortes. Nach jedem anderen Ort und jeder anderen Gruppe kann er fragen und bekommt die Antwort in seinem nächsten Zug.

Jede Siedlung hat ihre Bewohner, die der Seed auswürfelt, wenn die Party dort ankommt: mehr an größeren Orten, jeder mit einem Namen aus der Namensliste seiner eigenen Kultur, einem Beruf, der zu dem passt, wofür der Ort bekannt ist, einem Temperament, dem, was ihm wichtig ist, seiner Art zu sprechen und seinem Aussehen, und manche, die von anderswo gekommen sind. Der Game Master sieht ein paar Bewohner des aktuellen Ortes, die die Party noch nicht getroffen hat, und bringt einen davon ins Spiel, wenn jemand Neues die Szene betritt. Jemand, den er mit vollem Namen nennt, wird mit seiner Tätigkeit und seinem Aussehen in die verfolgten Charaktere des Spiels aufgenommen, sodass zwei Personen mit demselben Namen auseinandergehalten werden. Ohne die Namenslisten einer Vorgabe heißen die Leute nach ihrem Beruf.

Im Spiel weiß der Game Master immer, wo die Party ist, wohin sie von dort gehen kann und wie lange jeder Weg dauert. Wohin die Party geht, benennt er mit einem Orts-Tag. Ein Ort, den die Welt aufführt, behält die Größe, die die Welt ihm gegeben hat. Bei einem Regelsatz mit Märkten nimmt er außerdem die passende Größe auf der Größenleiter des Marktes an, sodass die Hauptstadt einer Welt der größte Ort des Marktes ist. Ein Ort, den die Welt nicht aufführt, etwa ein Bauernhof oder ein Lager, behält den Namen, den der Game Master ihm gibt. Sobald das Spiel beginnt, steht die Vergangenheit der Welt fest. Ihr Aufbau steht ebenfalls fest, abgesehen von Änderungen von Hand (siehe unten). Eine geteilte Setup-Datei bringt die Welt so mit, wie sie zuerst erstellt wurde.

Was die Party der Welt antut, bleibt bestehen. Hilft oder schadet die Party einer Gruppe, macht sie zwei Gruppen zu Freunden oder Feinden, stellt sie sich auf die Seite einer Gruppe oder verrät sie, verbessert oder beschädigt sie einen Ort, nimmt sie einen Ort für eine Gruppe ein, vernichtet sie eine Gruppe, setzt sie jemanden an die Spitze einer Gruppe oder richtet sie einen Ort zugrunde, hält der Game Master das in seiner Antwort fest, so wie einen Ort oder eine Gruppe, die die Geschichte einbringt. Jede Änderung wird gegen die Welt geprüft: Eine Änderung einer Art, die das Kit ausgeschaltet hat, etwa ein Krieg in einer gemütlichen Gegenwartswelt, oder eine, die einen Ort oder eine Gruppe nennt, die es in der Welt nicht gibt, wird abgelehnt. Von da an erfährt der Game Master die Welt so, wie die Geschichte sie hinterlassen hat: wie es dem Ort geht, wer ihn hält und wer diese Gruppe anführt, was die Party dort getan hat, wie die Party bei jeder Gruppe dasteht, mit der sie zu tun hatte, und was sich seit Spielbeginn verändert hat. Ein Ort, den die Geschichte hinzugefügt hat, ist ein Ort, zu dem die Party gehen kann. Eine Änderung gehört zu der Antwort, die sie bewirkt hat; ein Swipe, eine Neugenerierung oder eine gelöschte Nachricht nimmt sie also mit dieser Antwort zurück.

Die Welt dreht sich auch ohne die Party weiter. Sagt der Game Master, dass Zeit vergeht (eine Reise, eine Nachtruhe, eine lange Wartezeit), macht die Welt ihre eigenen Schritte, jeweils eine Woche, und nur in den Arten von Veränderung, die das Kit kennt: Wohlstand steigt und fällt, Neuankömmlinge lassen sich nieder, Gruppen kommen sich näher oder werden zu Rivalen, Anführer treten ab, und wo es sie in der Welt gibt, sucht Ärger Orte in schweren Zeiten heim, und Spannungen zwischen zwei Gruppen können nach einer Saison des Aufbaus zum Krieg werden. Katastrophen kommen nie von selbst; nur der Game Master kann eine erzählen, wie jedes Ereignis jenseits der Party, und sie wird abgelehnt, wenn ihre Art ausgeschaltet ist. Dort, wo die Party ist, wird nichts entschieden: Was dort bevorsteht, bleibt der Szene überlassen. Nachrichten verbreiten sich: Der Game Master erfährt von einer Veränderung als Gerücht aus der Ferne, sobald die Tage vergangen sind, die die Wege brauchen, und er sieht, was sich in der Nähe anbahnt, damit die Party eingreifen kann. Einen sich anbahnenden Krieg darf er nur zurückhalten, wenn er für die Welt keinen Sinn ergibt oder das Spiel ruinieren würde, ohne dass die Party eine echte Chance hätte, ihn aufzuhalten. Die Taten der Party zählen umso mehr, je bekannter sie wird: Die Hilfe von Fremden ändert wenig, die einer berühmten Party viel.

Eine Welt kann außerdem **Änderungen von Hand** behalten. Das sind Änderungen, die du mit einem Welteditor vornimmst, einem Werkzeug, das eine Welt nach ihrer Erstellung verändert. Du kannst Orte umbenennen oder verschieben, das Gelände bemalen und Orte und Bewohner hinzufügen. Du kannst auch das taktische Schlachtfeld eines Ortes bemalen (siehe [Kampf](combat.md#tactical-battles-and-terrain)) und eine Stadt von Hand anlegen (siehe [Die Stadt](map-time-weather.md#the-town)). Jeder Teil des Spiels sieht die Änderungen sofort: der Game Master, die Oberwelt, die Städte und der Tab World. Ein umbenannter Ort hört weiterhin auf seinen alten Namen, und der Game Master erfährt, wie er einmal hieß.

Änderungen von Hand verändern die Welt ab jetzt, nie ihre Vergangenheit. Die Geschichte der Welt und die Veränderungen, die sie von selbst durchgemacht hat, bleiben, wie sie waren. Eine Siedlung, die du hinzufügst, bleibt so, wie du sie hinzugefügt hast. Eine Stadt behält ihre Anlage, sodass die Orte und Bewohner, die du hinzufügst, auf ihre nächsten freien Baugrundstücke und in ihre nächsten freien Wohnungen kommen.

Eine Welt kann als Datei reisen. **Download this world** (diese Welt herunterladen, unter **Your world**) speichert die Welt, die du gerade erstellst, und **Download the world** (Welt herunterladen) auf dem Tab World eines Spiels speichert dessen Welt samt allen Änderungen von Hand als `.world.json`-Datei. **Import a world file** (neben dem Setting-Kit) liest eine in die Einrichtung eines neuen Spiels ein: Es wählt das Setting-Kit der Datei und erstellt ihre Welt mit ihren Änderungen von Hand. **Your worlds** (deine Welten) macht dasselbe mit einer Welt aus deiner Bibliothek, etwa einer, die außerhalb eines Spiels mit einem Editor wie Pixelforge entstanden ist.

Eine Weltdatei kann außerdem die **Story** der Welt mitbringen: die Ereignisse und Szenen, die jemand für sie geschrieben hat. Die Story kommt mit der Welt und bleibt zu denselben Bedingungen erhalten. Im Spiel erscheinen die Szenen einer Story in der Erzählung vor der Antwort des Game Masters, genau so, wie sie geschrieben sind. Ihre Questziele stehen unter **Story** auf dem Tab World des Journals, sobald die Story sie zeigt. Wie du eine schreibst, steht unter [Story-Skripte für Game Mode schreiben](../extending/writing-story-scripts.md).

Die Änderungen von Hand und die Story wurden für diesen Seed und diese Vorgabe gemacht, sie fallen also weg, wenn du eines davon änderst. Lässt sich eine Datei nicht lesen, wird sie abgelehnt, und der Assistent sagt, warum. Eine Weltdatei bringt die Welt außerdem so mit, wie sie erstellt wurde, sodass sich eine Welt, die eine andere Version des Weltgenerators erstellt hat, genau so öffnet, wie sie erstellt wurde. Eine ältere Datei ohne diese Angabe wird abgelehnt. Passt etwas in der Datei nicht zum Setting-Kit, wird es weggelassen, und der Assistent sagt, was.

Ein Spiel, das ohne Welt angelegt wurde, bevor es die Wahl des Game Mode gab, kann später eine bekommen, aber nur, wenn du das willst: Der Tab **World** (Welt) des Journals bietet **Make a world for this game** (eine Welt für dieses Spiel erstellen) an, mit denselben Auswahlmöglichkeiten für Setting-Kit und Welt wie bei einem neuen Spiel. Die Welt beginnt mit dem nächsten Zug; die bisherigen Züge, die Karte und die Bewohner des Spiels bleiben, wie sie sind. Solange Overworld RPG nicht fertig ist, ist die Schaltfläche mit demselben Hinweis wie in der Einrichtung ausgegraut.

Ein Spiel behält seine Welt so, wie sie erstellt wurde. Orte, Bewohner, Städte und Geschichte werden beim Spielstart und bei jedem Speichern der Änderungen von Hand mit dem Spiel gespeichert, sodass ein Update, das ändert, wie Welten erstellt werden, nie eine Welt verändert, die schon gespielt wird. Eine neue Sitzung, eine Verzweigung und ein exportierter Chat behalten dieselbe Welt, und wie sich die Welt in früheren Sitzungen weiterentwickelt hat (ihr Wohlstand, ihre Herrscher und Kriege), bleibt so erhalten, wie es sich abgespielt hat. Eine Welt, die eine frühere Version des Weltgenerators erstellt hat, läuft so weiter, wie sie erstellt wurde, lässt sich aber nicht mehr bearbeiten.

Ein Spiel mit Welt öffnet sich auf der **Oberwelt**: der Welt als Pixelkarte, auf der du die Party über die Wege der Welt von Siedlung zu Siedlung gehen lassen und die Stadt betreten kannst, in der sie gerade ist; die Szenenansicht ist nur einen Schalter entfernt. Siehe [Die Oberwelt](map-time-weather.md#the-overworld).

<a id="the-gm-intro-message"></a>

### Die Intro-Nachricht des GM

**GM intro message** auf dem Schritt **Party** entscheidet, wie das Spiel beginnt:

- **None** (keine, der Standard): Der Game Master eröffnet das Spiel so, wie er es für richtig hält.
- **Defined** (festgelegt): Tipp die erste Nachricht genau so ein, wie sie lauten soll. Das Spiel beginnt mit genau dieser Nachricht, und eine Neugenerierung liefert denselben Text.
- **Guided** (gelenkt): Beschreib, wie der Anfang verlaufen soll, etwa wo er beginnt, wer da ist und was zuerst passiert. Der Game Master schreibt die Eröffnung danach.

Der Text darf bis zu 8.000 Zeichen lang sein. Er darf keine doppelten geschweiften Klammern enthalten, ein **Guided**-Text auch keine eckigen Klammern. Das Feld sagt dir, wenn sich der Text nicht verwenden lässt. Die Story einer Welt kann ihr eigenes Intro mitbringen. Sperrt die Story es, zeigt das Feld es mit „Set by this Experience and locked, so the game opens as its creator meant.“ an, und es lässt sich nicht ändern.

### Standardwerte, die du kennen solltest

Das sind die Startwerte in den Schritten **World**, **Party** und **Features**. Ändern lässt sich jeder davon.

| Einstellung | Standard | Hinweise |
|---|---|---|
| Genre | Fantasy | Mehrfachauswahl, eigene Einträge möglich; ein zuerst gewähltes Setting-Kit setzt sein eigenes |
| Tone | Heroic | Mehrfachauswahl |
| Difficulty | Normal | Casual, Normal, Hard oder Brutal; höhere Stufen machen den Kampf härter |
| Content Rating | SFW | SFW oder NSFW; NSFW erlaubt Inhalte für Erwachsene, erzwingt sie aber nicht |
| Language | English | Der gesamte Text im Spiel wird in dieser Sprache geschrieben |
| Game Master Mode | Standalone GM | Standalone GM baut dir einen GM; Character GM nutzt eine deiner Charakterkarten als GM |
| Visual Generation | Off | Für Bilder einschalten; braucht eine Verbindung zur Bildgenerierung |
| Game Presentation | Standard | **Storyboard Optimized** nutzt den Storyboard Game Prompt, um die Erzählung des GM zu formen; der Storyboard-Agent wird dadurch weder installiert noch aktiviert |
| Music DJ | Off | Braucht Spotify oder einen lokalen Musikordner |
| Custom HUD Widgets | On | Nutzt die von der KI erzeugten Status-Widgets der neuen Welt |
| Start Muted | Off | Startet das Spiel stummgeschaltet |

Neu in Game Mode? Dann lass **Game Master Mode** auf **Standalone GM**. Marinara baut dir einen fairen, leicht schnippischen GM, und du kannst den Modus in Ruhe ausprobieren, bevor du eine eigene GM-Karte schreibst.

Wähle im letzten Schritt **Storyboard Optimized**, wenn GM-Züge als verfilmbare visuelle Momente geschrieben werden sollen. Damit greift das eingebaute Preset **Storyboard Game Prompt** für die Erzählung des GM. Der Storyboard-Agent wird dadurch weder installiert noch aktiviert. Bild- oder Videogenerierung schaltet die Auswahl nicht ein, an den gewählten Verbindungen ändert sie nichts, und die Standardwerte des Agenten für Planner und Formatierung bleiben ebenfalls erhalten. Installiere und aktiviere Storyboard nach dem Anlegen des Spiels separat. Seine Einstellungen für Keyframes, Planner, Bild und Video legst du unter **Chat Settings > Agents > Storyboards** fest.

Die alternative Anime-Kombination aus einem Guss bleibt nach der Einrichtung verfügbar: Wähle **Anime Episode Director** für den Animation Planner und **Anime Game Video** für den Storyboard Video Prompt.

Der Editor **GM Prompt** zeigt eine Vorschau des Prompts, der für die gewählte Präsentation tatsächlich greift – ein Prompt ist der Text, den Marinara an die KI schickt. Bei ausgewähltem **Storyboard Optimized** erscheint im Editor der Storyboard Game Prompt samt Makro für die Keyframe-Anzahl. Lässt du den Text unverändert, bleibt das eingebaute Preset aktiv; bearbeitest du ihn, entsteht ein eigener Prompt, der das Präsentations-Preset überschreibt.

## Die drei Arten von KI-Aufruf

Game Mode nutzt drei verschiedene Arten von KI-Aufruf. Wer sie kennt, versteht besser, woher Kosten und Fehler kommen.

1. **Weltgenerierung.** Sie läuft genau einmal, nämlich beim Klick auf **Start Game**. Die GM-Verbindung liefert ein einziges großes, strukturiertes Dokument im Format JSON zurück. Darin stecken der Weltüberblick, die Startkarte, NPCs, die Spielbögen deiner Party und die Widgets auf dem Bildschirm. JSON ist ein striktes Textformat, das die KI exakt einhalten muss – sonst kann das Spiel nichts damit anfangen. Das ist der anspruchsvollste Schritt, und deshalb zählt die Modellwahl hier am meisten.
2. **Spielzüge.** Jede Nachricht, die du abschickst, baut einen frischen Prompt mit dem aktuellen Zustand. Danach erzählt der GM weiter und aktualisiert die Welt. Die Berechnungen der Kampfrunden übernimmt die Engine, nicht das Modell – so bleiben die Ergebnisse fair und einheitlich.
3. **Sitzungszusammenfassungen.** Beendest du eine Sitzung, schreibt der GM eine strukturierte Rückschau samt Notizen zur Kontinuität. Beim Start einer neuen Sitzung verfasst er eine kurze Überleitung, damit das nächste Kapitel sauber anschließt. Ältere Sitzungen werden zu Zusammenfassungen verdichtet, damit lange Kampagnen das Modell nicht überfordern.

## Adressierung: mit wem du gerade sprichst

In der Eingabeleiste sitzt neben der Schaltfläche für Dateianhänge eine kleine Sprechblasen-Schaltfläche. Ihr Tooltip lautet **Choose who to address** – ein Tooltip ist der Kurzhinweis, der beim Draufzeigen erscheint. Diese Schaltfläche legt fest, an wen deine Nachricht geht, und kennt drei Zustände.

- Standardmäßig geht deine Nachricht in die Szene. Sie gilt als normale Handlung oder Dialogzeile im Spiel. Der GM und deine Party reagieren innerhalb der Geschichte.
- **Talk to Party** ergänzt die Markierung `[To the party]` und richtet das Wort direkt an deine Begleiter. Nutze das für taktische Absprachen wie „Was machen wir hier jetzt?“ Diese Option erscheint nur, wenn deine Party nicht leer ist.
- **Talk to GM** ergänzt die Markierung `[To the GM]` und wendet sich außerhalb der Rolle an den GM. Nutze das für Fragen wie „Weiß mein Charakter etwas über den Tempel?“ oder für Wünsche zum Erzähltempo.

Der aktive Modus trägt im Menü die Markierung **On**. Um **Talk to Party** oder **Talk to GM** wieder abzuschalten, klick denselben Menüeintrag noch einmal an. Danach landen deine Nachrichten wieder in der Szene.

<a id="optional-tool-planning-and-lore-searches"></a>

## Optionale Tool-Planung und Lorebook-Suche

Öffne während des Spiels **Chat Settings → Function Calling** (Chat-Einstellungen → Funktionsaufrufe). Mit **Let the GM search lore** (GM im Weltwissen suchen lassen) kann der GM Informationen nach ihrer Bedeutung suchen, ohne alle anderen optionalen Tools einzuschalten. Aktiviere zunächst die Vektorisierung für die betreffenden Lorebooks und vektorisiere ihre Einträge. Die Suche berücksichtigt aktivierte Bücher, Ordner und die Eintragsschalter des jeweiligen Chats. Sie nutzt die konfigurierte Embedding-Verbindung und kann eine weitere Modellanfrage auslösen.

Game-Chats benötigen **Let the GM search lore** für Lorebook-Tool-Abfragen, auch wenn **Enable Tool Use** eingeschaltet ist. Bei ausgeschalteter Option ist `search_lorebook` in der Tool-Auswahl nicht verfügbar. Ein bereits ausgewählter Eintrag bleibt mit einer Erklärung sichtbar, damit du ihn entfernen oder die Lore-Suche wieder einschalten kannst.

**Game tool connection** (Verbindung für Game-Tools) steht standardmäßig auf **Same as narrator** (wie der Erzähler), wodurch die normale Tool-Schleife erhalten bleibt. Eine andere Verbindung führt vor der Erzählung genau eine separate Planungsanfrage aus. Dieses Modell wählt die Tools; der Erzähler erhält ihre tatsächlichen Ergebnisse als Text. Die zusätzliche Anfrage wird über die ausgewählte Verbindung abgerechnet. Ein günstigeres Modell kann die Tool-Kosten senken, aber andere Tools wählen. Dieser einzelne Planungsschritt kann aus dem ersten Ergebnis keine zweite Suche ableiten. Nutze **Same as narrator**, wenn der Erzähler mehrere Tool-Runden durchdenken soll (bis zu vier pro Zug; danach erzählt er mit den Ergebnissen, die er hat).

Claude- und Grok-Abonnementverbindungen unterstützen keine nativen Tool-Aufrufe. Die betroffenen Bedienelemente erklären das und bleiben deaktiviert, bis eine unterstützte Game-Tool-Verbindung ausgewählt ist. Textbefehle und Würfel-Tags funktionieren weiterhin. Fehlt eine separate Verbindung oder schlägt ihre Anfrage fehl, meldet der Zug den Fehler, statt still ohne die angeforderte Tool-Arbeit zu erzählen.

**Finish rolled turns in one request** (gewürfelte Züge mit einer Anfrage abschließen) ändert die zweite oben beschriebene Anfrageart. Gewöhnlich braucht ein Würfelzug zwei Anfragen: den Entwurf und die Umschreibung mit echten Zahlen. Bei aktivierter Option schreibt der Game Master den Ausgang blind und die Engine setzt die Zahlen danach ein; der Zug kostet eine Anfrage. Die Option ist standardmäßig aus. Zwei Dinge können weiterhin eine Anfrage ergänzen: ein Würfel-Tool-Aufruf bei **Enable Tool Use** und eine separate **Game tool connection**, die stets selbst plant. Siehe [Game Mode: Würfel und Fertigkeitsproben](dice-and-skill-checks.md#finishing-a-rolled-turn-in-one-request).

Wenn deine lokalen Modelle begrenzten GPU-Speicher gemeinsam nutzen, öffne **Chat Settings → Agents** und aktiviere **Run Game tasks one at a time** (Game-Aufgaben nacheinander ausführen). Erzählung, Agenten und Szenenmedien warten innerhalb dieses Game-Chats aufeinander. Die Option ist zunächst ausgeschaltet und reserviert die GPU nicht gegenüber anderen Chats oder Anwendungen. Die vorhandenen Abbruchfunktionen bleiben während der Ausführung und beim Warten verfügbar.

## Agenten aktivieren

Agenten sind optionale KI-Helfer, die neben dem GM mitlaufen. Um sie im Spiel zu nutzen, öffne während des Spielens **Chat Settings** (Chat-Einstellungen), geh in den Bereich **Agents** und aktiviere **Enable Agents**. Laufende Agenten kosten extra, weil sie zusätzliche Aufrufe erzeugen.

Zwei Agenten lohnen sich für Game Mode besonders:

- **Game Session Keeper** hilft, die Kontinuität über mehrere Sitzungen hinweg zu wahren.
- **Music DJ** sucht die Hintergrundmusik aus. Er braucht Spotify oder einen lokalen Musikordner.

Game Mode nutzt außerdem **Review Agent Outputs**, damit du prüfen kannst, was ein Agent produziert hat. Das ganze Bild zu Agenten gibt es unter [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md).

## Ein Modell auswählen

Die Weltgenerierung ist der schwierigste Teil von Game Mode. Sie verlangt vom Modell ein einziges langes, striktes JSON-Dokument, in dem kein Feld fehlen darf. Ein Modell, das im normalen Chat glänzt, kann an diesem Schritt trotzdem scheitern.

Nimm für die Weltgenerierung ein leistungsfähiges, aktuelles Spitzenmodell über eine kostenpflichtige Verbindung. Stand 2026 berichten Spielende von guten Ergebnissen mit den Flaggschiff-Stufen der großen Anbieter, etwa Anthropic Claude, OpenAI GPT und Google Gemini. Konkrete Modellnamen ändern sich häufig – versteh das also als Beispiele, nicht als feste Liste.

Für die laufenden Spielzüge reicht manchmal ein günstigeres Modell, denn hier geht es um Erzählung statt um striktes JSON. Vergisst der GM plötzlich NPCs oder widerspricht früheren Details, dann wechsle wieder auf ein stärkeres Modell.

Finger weg von kostenlosen oder automatisch weiterleitenden Modellen für die Weltgenerierung. Sie landen womöglich bei einem kleineren Modell, das kein gültiges Weltgenerierungs-JSON liefert. Kleine Open-Weight-Modelle scheitern an diesem Schritt meist ebenfalls.

Die vollständige Referenz zu den Parametern findest du unter [Generierungsparameter](../prompts/generation-parameters.md).

<a id="the-games-controls"></a>

## Die Bedienelemente des Spiels

Am Computer öffnen sich die Bedienelemente des Spiels über Schaltflächen nahe der oberen rechten Ecke des Chats. Am Handy findest du sie im verschiebbaren Drei-Punkte-Menü **Chat tools** (Chat-Tools):

- **Game controls** (Spielsteuerung, der Gamecontroller):
  - **Retry turn**, **Retry scene analysis**, **Retry Music DJ**, wenn Music DJ die Spielmusik übernimmt, und **Retry assets image generation**.
  - Läuft ein Storyboard als Spielhintergrund, findest du dort auch Wiederholung, Wiedergabe/Pause und Stummschaltung.
  - In einem Spiel mit Welt wechseln **Show the scene** (Szene zeigen) und **Show the overworld** (Oberwelt zeigen) die Ansicht, und **Show the map** (Karte zeigen) kehrt zu einer offenen Dungeon-, Höhlen- oder Stationskarte zurück.
  - **Edit game data** (Spieldaten bearbeiten) korrigiert die gespeicherten Daten des Spiels von Hand (siehe [Spieldaten von Hand bearbeiten](sessions-and-saves.md#editing-game-data-by-hand)), und **Checkpoints** setzt das Spiel auf einen früheren Moment zurück (siehe [Wie das Spiel speichert](sessions-and-saves.md#how-your-game-saves)).
- **Session** (Sitzung, die Feder): Sitzungsverlauf, Journal und Sitzungssteuerung. Siehe [Game Mode: Sitzungen und Spielstände](sessions-and-saves.md).
- **Volume** (Lautstärke, der Lautsprecher): die Lautstärke für **Master**, **Music**, **Sound Effects**, **TTS** und **Ambient**.
- **Game Assets** (Spielressourcen, der Ordner): Szenenmedien und Asset Browser. Siehe [Game-Assets: Musik, Sound, Sprites und Hintergründe](game-assets.md).
- **Connected chat** (verknüpfter Chat), wenn das Spiel mit einer Conversation verbunden ist. Siehe [Eine Conversation mit einem Roleplay oder Game verknüpfen](../chats/connected-chats.md#switching-between-connected-chats).

Wähl ein Tool, um seine Steuerung am Computer in einem verschiebbaren Fenster oder am Handy in einem Panel über die ganze Breite zu öffnen. Am Computer ziehst du seine Schaltfläche, um sie zu bewegen. Am Handy verschiebst du das Drei-Punkte-Menü oder entsperrst es, um die Tools darin neu anzuordnen. Schließt du das Fenster oder Panel, kannst du das Tool von derselben Stelle aus wieder öffnen. Siehe [Steuerungsfenster und ihre Schaltflächen](../chats/chat-settings.md#control-windows-and-their-buttons).

Du kannst diese Steuerungen auch in **Chat Settings** unterbringen. Öffne das jeweilige Fenster und wähle **Put back in Chat Settings**. Dort erscheint es als aufklappbarer Abschnitt. Über dessen Schaltfläche zum Herauslösen wird es wieder ein eigenes Fenster. Jedes Spiel speichert deine Auswahl; **Reset View** stellt die ursprüngliche Anordnung wieder her: Schaltflächen am Computer, Einträge in Chat tools am Handy.

**Character Profiles** (Charakterprofile) bleibt am Computer wie am Handy außerhalb von Chat tools. Zieh seine Porträt-Schaltfläche, wohin du willst, und öffne es dann, um ein Gruppenmitglied zu wählen und seinen Charakterbogen anzusehen oder zu bearbeiten. Am Handy hat auch **Map** (Karte) eine eigene verschiebbare Schaltfläche. Beide folgen deinem Chat-Widget-Stil, speichern ihre Position für dieses Spiel und lassen sich aus ihrem geöffneten Fenster heraus sperren. Die Desktop-Karte behält ihre bisherigen Bedienelemente im Karten-Panel.

## Wo welches Spielthema steht

Diese Anleitung bringt dich ins Spiel. Jedes tiefergehende Thema hat eine eigene Anleitung:

- [Game Mode: Kampf](combat.md) behandelt Begegnungen, das Aktionsmenü, die Schadensberechnung und Quick-Time-Events.
- [Game Mode: Party und NPCs](party-and-npcs.md) behandelt Character Profiles, Charakterbögen und das Adventure Journal.
- [Game Mode: Sitzungen und Spielstände](sessions-and-saves.md) behandelt das Beenden und Starten von Sitzungen sowie die Sitzungshistorie.
- [Game Mode: Karte, Zeit und Wetter](map-time-weather.md) behandelt die Kartenansichten sowie die automatische Uhr und das Wetter.
- [Game Mode: Würfel und Fertigkeitsproben](dice-and-skill-checks.md) behandelt das Würfelmenü und die Regeln für Fertigkeitsproben.
- [Game Mode: HUD-Widgets](hud-widgets.md) behandelt die Status-Widgets auf dem Bildschirm.
- [Spiel-Assets](game-assets.md) behandelt die Bibliothek für Musik, Sound, Sprites und Hintergründe.
- [Anleitung zum Storyboard-Agenten](storyboard.md) behandelt die Installation sowie Storyboards in Roleplay und Game Mode.

Author's Notes funktionieren hier genauso wie in den anderen Modi. Mehr dazu unter [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md).

## Fehlerbehebung

### Die Weltgenerierung scheitert mit einem JSON- oder 422-Fehler

Meistens liegt es daran, dass das Modell das vollständige strukturierte JSON nicht liefern konnte. Probier der Reihe nach Folgendes.

1. Prüf, welche Verbindung der GM benutzt. Zeigt sie auf ein kostenloses oder automatisch weiterleitendes Modell, wechsle auf ein leistungsfähiges kostenpflichtiges Modell.
2. Versuch es erneut. Manche Fehlschläge sind Einzelfälle, und dieselbe Konfiguration klappt im zweiten Anlauf.
3. Kürze ein sehr langes Feld für Schauplatz oder Vorlieben. Lange Eingaben lassen dem Modell weniger Platz für die JSON-Ausgabe.

Hat ein Aufruf fast geklappt und war das JSON nur leicht beschädigt, bietet Marinara das Fenster **Repair JSON** (JSON reparieren) an. Es öffnet einen Editor mit Zeilennummern und der Rohausgabe des Modells. Eine Statuszeile sagt dir, ob das JSON gültig ist, oder zeigt den Parse-Fehler. Klick auf **Format**, um gültiges JSON aufzuräumen. Klick danach auf **Apply Repaired JSON**, um deine korrigierte Fassung zu übernehmen, ohne einen kompletten neuen Versuch zu bezahlen. Die Option **Repair JSON** erscheint auch bei Sitzungszusammenfassungen und anderen strukturierten Aufrufen.

Weitere Symptome und Lösungen findest du unter [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md).

### Der GM erzählt fröhlich, obwohl du einen düsteren Ton gewählt hast

Manche Modelle bleiben gut gelaunt, egal welcher Ton eingestellt ist. Dafür gibt es zwei Wege. Trag im Vorlieben-Feld des Assistenten eine klare Anweisung ein, etwa „keep narration grim, do not soften failures“. Oder wechsle auf ein Modell, dessen Grundton zu dem passt, was du willst.

## Verwandte Anleitungen

- [Game Mode: Kampf](combat.md)
- [Game Mode: Party und NPCs](party-and-npcs.md)
- [Game Mode: Sitzungen und Spielstände](sessions-and-saves.md)
- [Game Mode: Karte, Zeit und Wetter](map-time-weather.md)
- [Game Mode: Würfel und Fertigkeitsproben](dice-and-skill-checks.md)
- [Game Mode: HUD-Widgets](hud-widgets.md)
- [Spiel-Assets](game-assets.md)
- [Anleitung zum Storyboard-Agenten](storyboard.md)
- [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md)
- [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md)
- [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md)
- [Generierungsparameter](../prompts/generation-parameters.md)
- [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md)
