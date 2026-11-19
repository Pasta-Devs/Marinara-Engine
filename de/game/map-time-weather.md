# Game Mode: Karte, Zeit und Wetter

Im Karten-Panel siehst du, wo deine Party gerade ist, und bewegst sie weiter. Diese Anleitung behandelt außerdem die Systeme, die die Welt rund um die Party mitführen: Tag und Uhrzeit, das Wetter und die Moral der Party.

## Das Karten-Panel

Im Game Mode sitzt auf dem Spielbildschirm ein Karten-Panel. Es zeigt den Namen der aktuellen Karte, den Spieltag und ein Himmelssymbol für die Tageszeit.

- **Am Computer** ist die Karte ein eingebettetes Panel, das du auf einen Blick erfassen kannst. Du kannst es verschieben und an Ort und Stelle fixieren. Wie verschiebbare Panels funktionieren, steht unter [Game Mode: HUD-Widgets](hud-widgets.md).
- **Am Handy** tippst du auf **Map** (Karte), um das Panel zu öffnen. Seine Schaltfläche startet oben links und lässt sich im Chat herumziehen. Mit **Lock window** (Fenster sperren) bleibt die Schaltfläche an ihrem Platz, mit **Close** (Schließen) kehrst du zu ihr zurück. Die Position wird mit dem Chat gespeichert. Die Handy-Karte nutzt deinen Chat-Widget-Stil aus **Settings → Appearance → App** (Einstellungen → Darstellung → App), und ihre Schaltfläche bleibt vom Drei-Punkte-Menü **Chat tools** getrennt.

### Grid-Ansicht und Node-Ansicht

Marinara wählt die Ansicht nach der Art des Ortes, den die Karte zeigt. Von Hand umschalten kannst du nicht.

- Die **grid**-Ansicht (Raster) ist für offene Gebiete gedacht, etwa eine Region oder eine Stadt. Sie zeigt Quadrate, die nach Gelände eingefärbt sind: Gras, Wald, Wasser, Gebirge, Wüste, Schnee, Stadt, Straße und Höhle.
- Die **node**-Ansicht (Knotenpunkte) ist für geschlossene Bereiche wie Dungeons und Innenräume gedacht. Sie zeigt Orte als Kreise, die durch Linien verbunden sind. Ein unentdeckter Ort zeigt ein Fragezeichen. Eine gestrichelte Linie ist ein Weg, den du noch nicht gegangen bist, eine durchgezogene einer, den du schon genutzt hast.

## Die Party bewegen

Anwählen kannst du nur bestimmte Orte. Auf einer Grid-Karte muss ein Quadrat direkt an deine Party grenzen und bereits entdeckt sein. Auf einer Node-Karte muss ein Knoten mit deinem aktuellen Ort verbunden oder bereits entdeckt sein. Andere Quadrate und Knoten reagieren nicht, wenn du sie anklickst.

1. Klick auf ein Rasterquadrat oder auf einen Knoten einer Node-Karte.
2. Über dem Nachrichtenfeld erscheint ein Chip **Map position:** (Kartenposition:) mit dem Namen des Ortes.
3. Schreib deine Nachricht und schick sie ab. Marinara stellt ihr eine kurze Zeile wie `*moves to <place>*` voran.

Zum Abbrechen klickst du auf die Löschen-Schaltfläche (X) am Chip **Map position:**. Ihr Tooltip lautet **Clear destination** (Ziel entfernen).

Am Handy tippst du einmal auf einen Knoten, um ihn auszuwählen, und dann in der Fußzeile auf **Set destination** (Ziel festlegen). Ein Knoten mit der Markierung **You are here** (Du bist hier) ist dein aktueller Standort.

Wenn es nicht funktioniert hat, prüf, ob das Quadrat an deine Party grenzt und entdeckt ist oder ob der Knoten mit deinem Standort verbunden ist.

### Karten zoomen, wechseln und generieren

- **Zoomen.** Nutze **Zoom in** (Plus) und **Zoom out** (Minus) oben rechts. Der Zoom reicht von 75 % bis 180 % in Schritten von 25 %.
- **Karten wechseln.** Hat ein Spiel mehr als eine Karte oder Region, kannst du über ein Dropdown-Menü oben im Panel eine andere aufrufen. Die Karte, auf der du bist, ist mit **(Current)** markiert.
- **Eine Karte generieren.** Klick oben links auf die Zauberstab-Schaltfläche **Generate another map** (weitere Karte generieren), um die aktuelle Karte durch eine neue zu ersetzen. Ein Spiel ohne Karte zeigt **No map yet** und eine Schaltfläche **Generate** (Generieren), die dasselbe tut.

## Tag und Uhrzeit von Hand setzen

Oben im Karten-Panel sitzt die Steuerung für Tag und Uhrzeit. Sie zeigt **Day** (Tag) mit einer Zahl und dazu ein Himmelssymbol.

1. Klick auf die Steuerung **Day**.
2. Gib eine Tageszahl von 1 bis 9999 ein.
3. Wähl eine Tageszeit: **Dawn**, **Morning**, **Afternoon**, **Evening**, **Night** oder **Midnight**.
4. Klick daneben oder drück <kbd>Enter</kbd>, um zu speichern.

Das ist eine manuelle Übersteuerung, unabhängig von der automatischen Uhr. Die Uhr kann von sich aus auch **Noon** anzeigen, doch Noon lässt sich nicht von Hand wählen.

## Wie die Zeit vergeht

Die Spieluhr rechnet mit festen Werten, nicht mit der KI. Jedes neue Spiel startet an Tag 1 um 08:00 Uhr. Jede Aktion stellt die Uhr vor:

| Aktion | Zeit, die vergeht |
| --- | --- |
| Reden | 15 Minuten |
| Erkunden | 30 Minuten |
| Eine Kampfrunde | 5 Minuten |
| Eine kurze Rast | 1 Stunde |
| Eine lange Rast | 8 Stunden |
| Reisen | 2 Stunden |

Sobald die Uhr Mitternacht überschreitet, steigt die Tageszahl um eins.

## Wetter

Das Spiel führt das Wetter mit festen Werten, nicht mit der KI. Es hängt vom Biom (der Art von Umgebung, in der die Party ist, etwa Wüste, Arktis, Küste oder Gebirge) und von der Jahreszeit ab. Beispiele sind klar, bewölkt, Regen, Sturm, Schnee, Blizzard, Nebel und Sandsturm. Am häufigsten ändert sich das Wetter, wenn du reist oder eine lange Rast machst, manchmal beim Erkunden und sonst nur selten. Es färbt darauf ab, wie der GM jede Szene beschreibt.

Damit du das Wetter auf dem Bildschirm siehst, schalte in den Darstellungseinstellungen **Dynamic weather effects (rain, snow, fog, etc.)** ein. Die Option ist standardmäßig an. Dann legen sich Regen-, Schnee- und Nebelpartikel über das Spiel, passend zu Wetter und Tageszeit. Siehe [Darstellungseinstellungen](../appearance/appearance-settings.md).

## Moral der Party

Das Spiel führt im Verborgenen einen Moralwert der Party von 0 bis 100. Er hat fünf Stufen, von der niedrigsten zur höchsten: Broken, Low, Steady, High und Inspired.

Die Moral steigt, wenn du einen Kampf gewinnst, eine Quest abschließt oder einen Schatz findest. Sie sinkt, wenn du einen Kampf verlierst, bei einer Quest scheiterst oder einen Verbündeten verlierst. Mit der Zeit driftet sie wieder zur Mitte zurück. Als Zahl wird sie nicht angezeigt. Sie färbt darauf ab, wie der GM die Stimmung deiner Party beschreibt. Auf deine Würfelwürfe wirkt sie sich nicht aus.

<a id="dungeons-caves-and-stations"></a>

## Verwandte Anleitungen

- [Game Mode: Erste Schritte](getting-started.md)
- [Game Mode: HUD-Widgets](hud-widgets.md)
- [Darstellungseinstellungen](../appearance/appearance-settings.md)
