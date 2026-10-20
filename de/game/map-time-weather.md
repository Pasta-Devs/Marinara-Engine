# Game Mode: Karte, Zeit und Wetter

In dieser Anleitung erfährst du, wie das Karten-Panel im Game Mode funktioniert und welche Systeme die Welt rund um die Party (deine Abenteuergruppe) mitführen: Tag und Uhrzeit, das Wetter und die Moral der Party. Beschrieben werden außerdem die beiden Kartenansichten, das Bewegen und Zoomen sowie das manuelle Einstellen von Tag und Uhrzeit.

## Das Karten-Panel

Im Game Mode sitzt auf dem Spielbildschirm ein kleines Karten-Panel. Es zeigt den Namen der aktuellen Karte, den Spieltag und ein Himmelssymbol für die Tageszeit.

Am Computer ist die Karte ein eingebettetes Panel, das du auf einen Blick erfassen kannst. Das Panel lässt sich verschieben und an Ort und Stelle fixieren. Wie verschiebbare Panels genau funktionieren, steht in der unten verlinkten Anleitung zu den HUD-Widgets.

Am Handy tippst du auf **Map** (Karte), um das Karten-Panel zu öffnen. Seine Schaltfläche startet oben links und lässt sich im Chat herumziehen. Mit der Schaltfläche **Lock window** (Fenster sperren) im Panel bleibt die Kartenschaltfläche an ihrem Platz; **Close** (Schließen) kehrt zu dieser Schaltfläche zurück. Die Position wird mit dem Chat gespeichert. Die Handy-Karte nutzt deinen Chat-Widget-Stil aus **Settings → Appearance → App** (Einstellungen → Darstellung → App), und ihre Schaltfläche bleibt vom Drei-Punkte-Menü **Chat tools** getrennt.

<a id="the-overworld"></a>

## Die Oberwelt

Ein Spiel mit generierter Welt (siehe [Eine Welt erstellen](getting-started.md#making-a-world)) öffnet sich auf der **Oberwelt**: Der Boden der Welt ist als Pixelkarte hinter der Erzählung gezeichnet, mit Wäldern, Hügeln, Küsten und Meeren, den Straßen und Wegen zwischen den Siedlungen, jeder Siedlung in ihrer Größe und deiner Party. Die größeren Orte sind auf der Karte beschriftet, ebenso der Ort, an dem du gerade bist. Zieh die Karte, um dich umzusehen.

Tippe oder klick auf eine Siedlung oder wähl sie unter **Places** (Orte) aus. Dort stehen die nächstgelegenen Orte zuerst, jeweils mit der Dauer des Weges. Du siehst dann die Größe der Siedlung und die Reise von deinem Standort aus: wie viele Tage oder Stunden du unterwegs bist und auf welchen Wegen. **Walk there** (dorthin gehen) schickt die Party auf der schnellsten Route über die Wege der Welt dorthin, und die Tage der Reise vergehen sofort auf der Uhr. Ab dann ist die Party dort, und **dein nächster Zug teilt dem Game Master mit**, wohin du gegangen bist, wie lange es gedauert hat und auf welchen Wegen. So kann er die Ankunft erzählen. Die Tage der Welt selbst vergehen dabei mit, so wie wenn der Game Master sagt, dass Zeit vergeht. Ein zweiter Weg vor deinem nächsten Zug setzt dort an, wo der erste geendet hat.

Höhlen, Minen, Krypten und Ruinen ein paar Schritte außerhalb einer Siedlung sind auf der Oberwelt als **Stätten** eingezeichnet. Eine neue Welt hat in jeder Region eine oder zwei davon, benannt nach der Siedlung daneben („Hollin Caves“, „Ashby Ruins“). Wer eine Welt baut, kann weitere hinzufügen, mit einem solchen Namen oder mit einer eigens dafür gemachten Karte. Eine Welt, die vor den Stätten erstellt wurde, behält ihre Orte, wie sie waren. **Walk there** führt zu einer Stätte wie zu einer Siedlung: über die Wege der Welt zu ihrer Siedlung und dann zu Fuß abseits der Straße. An einer Stätte bietet ihre Infokarte **Enter** (betreten) an. Das öffnet die Karte der Stätte (siehe [Dungeons, Höhlen und Stationen](#dungeons-caves-and-stations)). Verlässt du sie, steht die Party wieder bei der Stätte auf der Oberwelt. Eine Stätte, die für die Geschichte des Spiels wichtig ist, bleibt **geschlossen** (blass gezeichnet, keine Reise dorthin und kein Betreten), bis der Game Master sie öffnet, sobald die Geschichte dort ankommt. Wer eine Welt baut, kann eine Stätte bis dahin auch ganz von der Karte verbergen oder sie von Anfang an offen lassen.

Ein Ort in Trümmern wird in Trümmern gezeichnet. Nach Einbruch der Dunkelheit wird die Karte dunkler, und in den Siedlungen leuchten die Fenster. Jede Stilfamilie eines Settings hat ihre eigenen Tiles: Fantasy, Wuxia, die Gegenwart, die 1920er-Jahre, Science-Fiction und das Ödland haben jeweils eigene Farben und Gebäude. Ein Setting-Kit ohne Familie zeichnet schlichte Tiles.

Die Oberwelt ist eine Ansicht, und die Szenenansicht (die Hintergründe und Charakterbilder des Spiels) ist nur einen Schalter entfernt: **Show the scene** (Szene zeigen) in **Game controls** (Spielsteuerung), am Handy im Drei-Punkte-Menü **Chat tools**. Mit **Show the overworld** (Oberwelt zeigen) kommst du zurück. Das Spiel merkt sich, welche Ansicht du gewählt hast. Ein Kampf und die Wiederholung einer Sitzung nutzen ihre eigenen Bildschirme.

### Tile-Packs

Die Oberwelt und die Städte werden aus **Tile-Packs** gezeichnet. Ein Tile-Pack enthält eine Farbpalette und jedes Tile als Reihen von Pixeln: jede Bodenart, die Siedlungen nach Größe, die Party sowie die Straßen, Dächer und Bewohner der Stadt. Jede Stilfamilie hat ihr eigenes eingebautes Pack. Öffne das Panel **Agents** (Agenten) und such **Tile packs** (Tile-Packs). Dort kannst du:

- festlegen, mit welchem Pack jedes Setting gezeichnet wird; sein eigenes heißt **Built in** (eingebaut);
- mit **Import a tile pack** (Tile-Pack importieren) ein Pack aus einer `.tilepack.json`-Datei übernehmen, die jemand geteilt hat;
- ein Pack mit **Export** (Exportieren) teilen oder es mit **Remove** (Entfernen) löschen. Jedes Setting, das damit gezeichnet wurde, nutzt dann wieder seine eigenen Tiles.

Ein Pack braucht nur die Tiles, die es ändert: Alles, was es weglässt, wird schlicht gezeichnet. Nennt ein Pack ein Tile, das Marinara Engine nicht zeichnet, behält es den Rest und sagt, was es weggelassen hat.

<a id="the-town"></a>

### Die Stadt

Ist die Party in einer Siedlung, wähl sie auf der Oberwelt aus und dann **Enter**, um die Stadt zu sehen. Sie ist aus der Welt heraus angelegt: ihre Straßen und ihr Platz, die Orte, die die Welt oder die Geschichte darin hat (an ihren Gebäuden beschriftet), in einem größeren Ort ihre Halle, die Werkstätten der Gewerbe, für die sie bekannt ist, und ihre Wohnhäuser. Ihre Bewohner sind dort, wo die Stunde sie hinführt: tagsüber bei der Arbeit, in der Abenddämmerung auf dem Platz, nachts zu Hause.

Eine Stadt lässt sich auch **von Hand anlegen**, mit einem Editor wie Pixelforge, als Teil der Änderungen von Hand an der Welt. Ihre Gebäude lassen sich auf andere Grundstücke verschieben: Ein Gebäude, das auf das Grundstück eines anderen verschoben wird, tauscht mit diesem den Platz, und jedes Gebäude zeigt weiterhin zu einer Straße. Ihr Boden lässt sich mit Straßen, Pflaster, freier Fläche, Bäumen oder einem Brunnen bemalen, nie aber unter einem Gebäude oder vor seiner Tür, mitten auf dem Platz oder unter einem Marktstand. Wer wo wohnt und arbeitet, ändert sich nie, und ein Weg zu einem verschobenen Gebäude wird ab seiner neuen Tür berechnet. Der Editor lehnt eine Anlage, die nicht zur Stadt passt, mit Begründung ab; Orte, die die Geschichte im Spiel hinzufügt, finden trotzdem ein Grundstück. Eine Anlage kann auch Gebäude abseits der Grundstücke platzieren, Felder, Trampelpfade, Wasser mit Brücken darüber und Hecken malen und Dekorationen in der Stadt verteilen. Die Stadtansicht zeichnet all das (Dekorationen nur mit einem Bildpaket, das sie enthält).

Wähl ein Gebäude oder den Platz aus, direkt oder in der Liste **Places in town** (Orte in der Stadt), um zu sehen, wer gerade dort ist und wie viele Minuten es entfernt ist. **Walk there** führt die Party über die Straßen quer durch die Stadt, um die Gebäude herum (und um die Bäume, Brunnen, Gewässer und Hecken, die eine Anlage von Hand gemalt hat, und über ihre Brücken). Die Minuten des Weges vergehen auf der Uhr, und **dein nächster Zug teilt dem Game Master mit**, wohin die Party gegangen ist und wer dort ist. Ein Besuch an einem benannten Ort, etwa einem Gasthaus, das die Geschichte hinzugefügt hat, macht ihn zu dem Ort, an dem die Party ist. **Leave town** (Stadt verlassen) führt zurück zur Oberwelt. Das Spiel merkt sich, in welcher Ansicht du warst.

<a id="dungeons-caves-and-stations"></a>

### Dungeons, Höhlen und Stationen

In einem Overworld-RPG-Spiel (siehe [Classic oder Overworld RPG](getting-started.md#classic-or-overworld-rpg)) kann der Game Master eine **Karte des Ortes** öffnen, wenn die Geschichte unter die Erde oder an Bord führt: einen Dungeon, eine Höhle oder eine Station, über die Szene gezeichnet. Jede Karte wird aus dem Spiel und dem Namen des Ortes angelegt, sodass derselbe Ort immer dieselben Räume hat. Wird die Karte eines Ortes erneut geöffnet, an dem die Party schon ist, bleibt sie, wie sie war. Der Game Master wählt außerdem eines von elf Aussehen: Fels-, Eis-, Kristall- und Lavahöhlen; eine Krypta, eine Kanalisation und einen Tempel; sowie die Korridore, das Labor, das Maschinendeck und die Hydroponik einer Station. Liegt in der Tile-Pack-Bibliothek ein Tile-Pack für dieses Aussehen, wird die Karte mit dessen Grafik gezeichnet, sonst in schlichten Farben.

Ein Ort in der Stadt, in den die Party hinabsteigen kann (je nach Name eine Höhle, eine Mine, eine Krypta, eine Kanalisation oder eine Ruine; in einem Science-Fiction-Setting ein Wrack oder ein Bunker), bietet **Go down** (hinabsteigen) an, wenn die Party dort ist. Das öffnet die Karte dieses Ortes auf dieselbe Weise, jedes Mal dieselbe Karte. Beim Verlassen steht die Party wieder in der Stadt, dort, wo sie hinabgestiegen ist. Ist die Party gerade auf einer anderen Karte, verlass zuerst diese. Ein Ort kann auch eine **von Hand gemachte Karte** haben, erstellt mit einem Editor wie Pixelforge: Go down öffnet dann diese Karte, egal wie der Ort heißt, gezeichnet mit dem Pack, das sie nennt. Auf so einer Karte ist der Ausgang dort, wo die Party hereingekommen ist, ihre Requisiten stehen nie im Weg, und Leute stehen zu den Uhrzeiten, die die Karte ihnen gibt, auf ihren benannten Plätzen. Der Game Master erfährt, wer dort ist.

Klick auf eine Stelle der Karte oder nutze die Pfeiltasten, um auf dem kürzesten Weg dorthin zu gehen. Die Minuten vergehen auf der Uhr (etwa eine Minute pro dreißig Schritte), und **dein nächster Zug teilt dem Game Master mit**, aus welchem Bereich in welchen die Party gegangen ist. Die Beschriftung oben zeigt, in welchem Bereich die Party ist. **Show the scene** und **Show the map** (Karte zeigen) in **Game controls** wechseln zwischen Karte und Szene; das Spiel merkt sich, wo du warst.

Zum Verlassen geh zurück zum Ausgang (je nach Ort eine Treppe, eine Leiter oder eine Luke) und wähle **Leave** (verlassen). Der Game Master kann die Karte auch beenden, wenn die Geschichte den Ort verlässt. Wird ein Zug neu generiert, in dem eine Karte geöffnet, auf ihr gelaufen oder sie verlassen wurde, kehrt die Karte zu ihrem Stand vor diesem Zug zurück. Spiele ohne Karte laufen wie bisher.

## Grid-Ansicht und Node-Ansicht

Die Karte kennt zwei Ansichten. Welche davon erscheint, entscheidet Marinara Engine anhand der Art des dargestellten Ortes. Von Hand umschalten kannst du nicht.

- Die **grid**-Ansicht (Raster) ist für offene Gebiete gedacht, etwa eine Oberwelt, eine Region oder eine Stadt. Sie zeigt Quadrate, die nach Gelände eingefärbt sind: Gras, Wald, Wasser, Gebirge, Wüste, Schnee, Stadt, Straße und Höhle.
- Die **node**-Ansicht (Knotenpunkte) ist für geschlossene Bereiche wie Dungeons und Innenräume gedacht. Orte erscheinen als Kreise, die durch Linien verbunden sind. Ein noch unentdeckter Ort trägt ein Fragezeichen. Eine gestrichelte Linie steht für einen Weg, den du noch nicht gegangen bist, eine durchgezogene für einen bereits genutzten Weg.

## Die Party bewegen

Zum Reisen wählst du ein Ziel auf der Karte. Anwählbar ist allerdings nicht alles. Auf einer Grid-Karte muss ein Quadrat direkt an die Party grenzen und bereits entdeckt sein. Auf einer Node-Karte muss ein Knoten mit dem aktuellen Ort verbunden oder bereits entdeckt sein. Alle anderen Quadrate und Knoten reagieren nicht auf einen Klick.

1. Klick auf ein Rasterquadrat oder auf einen Knoten der Node-Karte.
2. Über dem Nachrichtenfeld erscheint ein Chip **Destination:** (Ziel:) mit dem Namen des Ortes.
3. Schreib deine Nachricht und schick sie ab. Marinara stellt ihr eine kurze Zeile wie `*moves to <place>*` voran.

Zum Abbrechen klickst du auf die kleine Löschen-Schaltfläche (das X) am Chip **Destination:**.

Am Handy läuft es etwas anders. Tippe einmal auf einen Knoten, um ihn auszuwählen, und dann in der Fußzeile auf **Set destination** (Ziel festlegen). Der Knoten mit der Markierung **You are here** (Du bist hier) ist der aktuelle Standort.

## Die Karte zoomen

Jede Karte hat oben rechts eine Zoom-Steuerung.

- **Zoom in** (die Plus-Schaltfläche) holt die Karte näher heran.
- **Zoom out** (die Minus-Schaltfläche) zeigt mehr davon.

Der Zoom reicht von 75 % bis 180 %, in Schritten von 25 %.

## Zwischen Karten wechseln

Manche Spiele haben mehrere Karten oder Regionen. Gibt es mehr als eine Karte, erscheint oben im Karten-Panel ein kleines Dropdown-Menü. Darüber rufst du eine andere Karte auf. Die Karte, auf der du dich tatsächlich befindest, ist mit **(Current)** markiert.

## Eine neue Karte generieren

Oben links im Karten-Panel sitzt eine Zauberstab-Schaltfläche mit der Beschriftung **Generate another map** (weitere Karte generieren). Ein Klick darauf ersetzt die aktuelle Karte durch eine frische.

Hat ein Spiel noch gar keine Karte, zeigt das Panel **No map yet** (noch keine Karte) und dazu eine Schaltfläche **Generate**, die dasselbe tut.

## Tag und Uhrzeit von Hand setzen

Ganz oben im Karten-Panel sitzt die Steuerung für Tag und Uhrzeit. Sie zeigt **Day** (Tag) mit einer Zahl und daneben ein kleines Himmelssymbol für die Tageszeit.

1. Klick auf die Steuerung **Day**.
2. Trag im Feld eine neue Tageszahl ein. Möglich sind Werte von 1 bis 9999.
3. Wähl im Dropdown-Menü eine Tageszeit. Zur Auswahl stehen **Dawn**, **Morning**, **Afternoon**, **Evening**, **Night** und **Midnight**.
4. Klick daneben oder drück Enter, um zu speichern.

Das ist eine manuelle Übersteuerung: Du setzt Tag und Uhrzeit selbst, unabhängig von der automatischen Uhr, die im nächsten Abschnitt beschrieben wird. Die Uhr kann von sich aus auch **Noon** anzeigen, doch Noon steht bei der manuellen Auswahl nicht zur Verfügung.

## Wie die Zeit automatisch vergeht

Die Spieluhr läuft von allein. Sie rechnet mit festen Werten statt mit der KI und ist deshalb immer konsistent. Jedes neue Spiel startet an Tag 1 um 08:00 Uhr morgens. Jede Aktion stellt die Uhr um einen festen Betrag vor.

| Aktion | Zeit, die vergeht |
|---|---|
| Reden | 15 Minuten |
| Erkunden | 30 Minuten |
| Eine Kampfrunde | 5 Minuten |
| Eine kurze Rast | 1 Stunde |
| Eine lange Rast | 8 Stunden |
| Reisen | 2 Stunden |

Sobald die Uhr Mitternacht überschreitet, steigt die Tageszahl um eins.

In einem Spiel mit Welt vergeht die Zeit außerdem von selbst:

- Solange die Oberwelt vorne ist und das Spiel auf dich wartet, vergeht alle fünf echten Sekunden eine Spielminute. Die Uhr steht still, während der Game Master schreibt, bevor du seine Antwort gelesen hast, während die Szenenansicht vorne ist und während die App im Hintergrund läuft.
- Ein Weg auf der Oberwelt lässt die Tage vergehen, die seine Route dauert.
- Sagt der Game Master, dass Tage vergehen (eine Reise, eine lange Rast, eine Wartezeit), rückt die Uhr ebenfalls um diese Tage vor. Eine neu generierte Antwort stellt sie nicht noch einmal vor; setz den Tag von Hand, wenn die neue Erzählung eine andere Dauer hat.

## Wetter

Auch das Wetter führt das Spiel selbst mit, mit festen Werten und ohne KI. Es hängt vom Biom und von der Jahreszeit ab. Ein Biom ist die Art von Umgebung, in der die Party unterwegs ist, zum Beispiel Wüste, Arktis, Küste oder Gebirge. Zum Wetter gehören unter anderem klar, bewölkt, Regen, Sturm, Schnee, Blizzard, Nebel und Sandsturm.

Das Wetter kann sich durch deine Aktionen ändern. Am häufigsten passiert das beim Reisen und bei einer langen Rast, manchmal beim Erkunden, sonst nur selten. Das Wetter färbt darauf ab, wie der Game Master – die KI, die das Spiel leitet – jede Szene beschreibt.

Damit das Wetter auch auf dem Bildschirm sichtbar wird, aktiviere in den Darstellungs-Einstellungen der App die Option **Dynamic weather effects (rain, snow, fog, etc.)** (dynamische Wettereffekte). Sie ist standardmäßig aktiv. Ist sie eingeschaltet, legen sich animierte Partikel wie Regen, Schnee und Nebel über das Spiel, passend zu Wetter und Tageszeit. Weitere Darstellungsoptionen findest du in der unten verlinkten Anleitung zu den Darstellungs-Einstellungen.

## Moral der Party

Das Spiel führt im Verborgenen einen Moralwert der Party von 0 bis 100. Er kennt fünf Stufen, von der niedrigsten zur höchsten: Broken, Low, Steady, High und Inspired.

Die Moral verschiebt sich mit dem, was in der Geschichte passiert. Ein gewonnener Kampf, eine abgeschlossene Quest oder ein Schatzfund heben sie. Eine verlorene Schlacht, eine gescheiterte Quest oder der Verlust eines Verbündeten drücken sie. Mit der Zeit driftet die Moral wieder zur Mitte zurück.

Als Zahl taucht die Moral im Spiel nicht auf. Sie wirkt stattdessen im Hintergrund: Sie verändert die Würfelwürfe, von plus 2 bei Inspired bis minus 2 bei Broken. Und sie färbt darauf ab, wie der Game Master die Stimmung der Party beschreibt.

## Verwandte Anleitungen

- [Game Mode: Erste Schritte](getting-started.md)
- [Game Mode: HUD-Widgets](hud-widgets.md)
- [Darstellungs-Einstellungen](../appearance/appearance-settings.md)
