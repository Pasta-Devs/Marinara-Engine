# Kataloge im Regelsatz

Diese Seite gehört zu [Regelsätze für Game Mode schreiben](writing-rulesets.md). Vorgefertigte Einträge, die der Bogeneditor in einer Auswahl anbietet: der Katalogkopf, Einträge, Werte, die der Regelsatz aktuell hält, Bogenbefehle und der Nutzungsbefehl.

Zauberlisten, Ausrüstungstabellen oder seitenlange Klassenmerkmale Zeile für Zeile einzugeben, ist mühsam. Ein Katalog ist eine benannte Sammlung fertiger Einträge, die du mit dem Regelsatz auslieferst. Der Bogeneditor bietet sie in einer Auswahl an jeder vom Katalog befüllten Liste an. Die Auswahl eines Eintrags füllt die Zeile aus.

Kataloge sind optional. Ein Regelsatz darf bis zu zwölf enthalten. Die Engine kennt den Inhalt keines davon: Jede ID, Spalte, jeder Filter und jedes Wort stammt aus deiner Datei.

## Der Katalogkopf

Der Kopf steht in `catalogs` auf der obersten Ebene der Datei neben `gm`.

```json
"catalogs": [
  {
    "id": "knacks",
    "label": "Knacks",
    "feeds": ["knacks", "tricks"],
    "filters": [
      { "id": "grit", "label": "Grit cost", "type": "number" },
      { "id": "road", "label": "Road", "type": "text" },
      { "id": "callings", "label": "Calling", "type": "tags", "startFrom": { "field": "calling" } }
    ],
    "units": { "distance": { "label": "paces", "perCell": 2 } },
    "entries": []
  }
]
```

- `id` und `label`: Die ID folgt den Regeln für Bogen-IDs; die Beschriftung benennt die Auswahl.
- `holds`: `"rows"` (Standard und der Wert aller vor dieser Veröffentlichung geschriebenen Kataloge), `"creatures"` oder `"items"`. Ein Kreaturenkatalog ist ein Bestiarium für Kämpfe, und ein Gegenstandskatalog listet Dinge auf, die eine Gruppe mit sich führt. Keiner von beiden schreibt etwas auf einen Bogen, deklariert `feeds` oder wird je in der Auswahl angeboten. Siehe unten [Kreaturen](ruleset-combat.md#creatures-a-bestiary-a-fight-reads) und [Gegenstände](ruleset-items.md).
- `feeds`: Die Listen deines Bogens, in die Einträge dieses Katalogs schreiben dürfen, mindestens eine und höchstens acht. Für Zeilenkataloge erforderlich, bei Kreaturen- und Gegenstandskatalogen nicht erlaubt. Ein Eintrag kann niemals in eine hier nicht genannte Liste schreiben oder einen Wert ablegen, den die Spalten der Liste nicht aufnehmen können.
- `filters`: Optional, höchstens acht. Die Filter, mit denen die Auswahl eingegrenzt werden kann. Ein Filter ist `number`, ein `text`-Wert oder `tags` (mehrere Wörter). `startFrom` nennt ein Bogenfeld, mit dessen Wert die Auswahl startet. Hat ein Charakter die Berufung Tinker, sieht er dadurch zuerst Tinker-Einträge.
- `units`: Optional. Was eine Reichweite oder Flächengröße im `mechanics`-Block eines Eintrags in deinem System bedeutet.

## Ein Eintrag

```json
{
  "id": "road-sense",
  "label": "Road Sense",
  "summary": "You read a road the way other people read a face.",
  "filters": { "grit": 0, "road": "Ash Flats", "callings": ["Scout", "Courier"] },
  "rows": [
    {
      "list": "knacks",
      "values": { "name": "Road Sense", "notes": "Sneak to notice where a road turns bad." }
    }
  ]
}
```

- `id`: Kleinbuchstaben, Ziffern und einzelne Bindestriche; innerhalb des Katalogs eindeutig.
- `label` und `summary`: Was die Auswahl zeigt. Die Zusammenfassung ist optional, einzeilig und höchstens 300 Zeichen lang.
- `filters`: Die Werte für die im Kopf deklarierten Filter. Ein `number`-Filter nimmt eine Zahl, ein `text`-Filter eine Zeichenfolge und ein `tags`-Filter eine Liste von Zeichenfolgen.
- `rows`: Was die Auswahl des Eintrags schreibt, eine bis sechs Zeilen. `list` ist eine der `feeds`-Listen des Katalogs. Die Schlüssel von `values` sind die Spalten-IDs dieser Liste.
- `creature`: Ein Gegner statt Zeilen in einem Katalog, dessen `holds` Kreaturen angibt. Ein Eintrag enthält genau eines von `rows` oder `creature`. Eine Kreatur trägt kein `mechanics`; sie beschreibt ihr Verhalten in ihren eigenen Aktionen.

Jeder Wert wird gegen die Spalten der Zielliste geprüft. Ein falsch geschriebener Spaltenname oder eine Zahl außerhalb des Spaltenbereichs wird daher zusammen mit dem zugehörigen Eintrag gemeldet. Einträge innerhalb der Regelsatzdatei werden beim Laden des Regelsatzes geprüft, bei einer importierten Datei also beim Import. Eine separate Katalogdatei eines Pakets wird geprüft, sobald die Auswahl sie erstmals anfordert. Hat die Datei einen Fehler, zeigt die Auswahl dessen Gründe statt Einträgen.

## Ein Eintrag, mehrere Listen

Ein Merkmal mit begrenzten Nutzungen besteht auf dem Bogen aus zwei Zeilen: dem Merkmal selbst und seinem Nutzungszähler. Ausgewählt wird es trotzdem nur einmal.

```json
{
  "id": "last-ember",
  "label": "Last Ember",
  "rows": [
    {
      "list": "knacks",
      "values": { "name": "Last Ember", "notes": "Spend 1 Grit to give a downed friend 3 Grit back." }
    },
    { "list": "tricks", "values": { "name": "Last Ember", "uses": 1, "recharge": "camp" } }
  ]
}
```

## Werte, die der Regelsatz aktuell hält

Nach der Auswahl gehören die Zahlen einer Zeile dem Spieler. Eine sinnvolle Ausnahme ist ein Maximum, das dem Charakter folgt, etwa Nutzungen in Höhe eines Attributswerts oder eine Klassenressource, die mit der Stufe wächst. Eine Zeile darf in einer `scaled`-Zuordnung bis zu vier ihrer eigenen Zahlenspalten nennen. Der Bogeneditor hält diese Zellen dann aktuell.

```json
{
  "list": "tricks",
  "values": { "name": "Last Ember", "uses": 1, "recharge": "camp" },
  "scaled": { "uses": { "from": { "abilityScore": "heart" } } }
}
```

- Der Schlüssel ist eine der `number`-Spalten der Liste.
- `from` ist ein gewöhnlicher Wertverweis mit demselben geschlossenen Vokabular wie überall sonst. Komplexere Berechnungen gehören in einen vom Bogen deklarierten `derived`-Wert, auf den `from` verweist (`"from": { "derived": "lay_on_hands_max" }`). Hier kommt keine neue Rechenart hinzu.
- `table` ist optional. Mit dieser Angabe wird der referenzierte Wert in einer Stufentabelle nachgeschlagen. So wird aus einer Stufe eine Zahl: `"scaled": { "max": { "from": { "field": "level" }, "table": [[1, 2], [3, 3], [6, 4]] } }`.
- `values` muss weiterhin eine einfache Zahl für die Spalte enthalten. Fehlt sie, wird die Zeile abgelehnt. Sie gilt, bevor ein Bogen bekannt ist, und bleibt auf einem Bogen ohne den entsprechenden Verweis erhalten.
- Eine Zeile mit `scaled` muss entweder die einzige Zeile dieses Eintrags für die betreffende Liste sein, sodass eine markierte Bogenzeile immer zu genau einer Vorgabe passt, oder (Capability API 1.92) jede Zeile, die der Eintrag in diese Liste schreibt, muss ihren eigenen Namen in der Namensspalte der Liste tragen (der `nameColumn` ihrer Pools, sonst ihrer ersten Textspalte). Die Zeile auf dem Bogen wird dann über diesen Namen ihrer Vorgabe zugeordnet. So kann ein Merkmal zwei Nutzungen geben, die jeweils für sich wachsen; eine Zeile, die der Spieler umbenennt, bleibt unverändert.

Der Wert wird beim Bearbeiten des Bogens berechnet, niemals beim Lesen. Eine gespeicherte Zeile enthält daher immer tatsächlich die angegebene Zahl. Sie wird an die Zielspalte angepasst: auf deren `min` und `max` begrenzt und bei Ganzzahlspalten abgerundet. Im obigen Beispiel hat ein Charakter mit Heart 3 drei Nutzungen, einer mit Heart 0 oder weniger keine. Die Zeile bleibt mit 0 Nutzungen auf seinem Bogen. Da ein Zähler mit Maximum 0 kein Pool ist, kann im Spiel nichts daraus verbraucht werden.

Skalierte Spalten brauchen bei einem als Paket ausgelieferten Regelsatz Capability API 1.23. Ein importierter Community-Regelsatz wird von der lesenden Engine geprüft und braucht keine solche Angabe.

## Ausgewählte Zeilen sind Kopien

Jede ausgewählte Zeile wird mit einem zusätzlichen Schlüssel `_catalog` auf den Bogen kopiert. Er enthält `<catalog id>/<entry id>`. Spalten-IDs beginnen immer mit einem Buchstaben; dieser Schlüssel kann deshalb nie mit einem deiner Schlüssel zusammenfallen.

Die Kopie gehört dem Charakter. Spieler können anschließend alles daran bearbeiten. Der Bogen funktioniert weiter, wenn dein Regelsatz nicht installiert ist, und eine neue veröffentlichte Regelsatzversion schreibt niemals einen Charakter um. Anhand der Markierung zeigt die Auswahl, was der Bogen bereits enthält. Auch die nachfolgend beschriebene Aktualisierung liest sie.

## Aus dem Regelsatz aktualisieren

Weil eine ausgewählte Zeile ihre Markierung behält, kann der Bogeneditor auf abweichende neuere Texte hinweisen. Eine kurze Zeile unter der Liste nennt die Zahl der Zeilen mit neuerem Text. **Review** (prüfen) zeigt für jede davon den Bogeninhalt neben der Regelsatzfassung sowie ein Auswahlkästchen je Zeile. Erst mit **Update selected** (Auswahl aktualisieren) wird etwas geschrieben, und nur die abweichenden Spalten der ausgewählten Zeilen. Alles andere in der Zeile bleibt erhalten, einschließlich der Markierung.

Der Vergleich ist absichtlich eng begrenzt:

- Vorhandene Werte werden nur in Spalten der Typen `text`, `longtext`, `dice` und `enum` verglichen. Vorhandene `number`- und `boolean`-Werte gehören dem Spieler und bleiben erhalten, auch 0 und false. Eine noch nicht in der Zeile enthaltene Spalte kann mit ihrem typisierten Wert angeboten werden, einschließlich Zahlen und Schaltern. Skalierte Spalten sind ausgenommen, weil sie bereits dem Bogen folgen.
- Nur Spalten, die dein Eintrag setzt, werden betrachtet. Eine ausgelassene Spalte wird nie verändert, unabhängig von ihrem Bogeninhalt.
- Ein von der Spalte selbst abgelehnter Wert wird übersprungen statt geschrieben, etwa ein nicht mehr angebotenes `enum`-Element oder Text über `maxLength`.
- Eine Zeile wird ihrer ursprünglichen Eintragszeile anhand ihrer Position unter den gleich markierten Zeilen dieser Liste zugeordnet. Das funktioniert, solange der Bogen noch genau so viele davon enthält, wie dein Eintrag schreibt. Andernfalls ist die Zuordnung nur möglich, wenn dein Eintrag genau eine Zeile für diese Liste schreibt. Hat ein Spieler eine Zeile eines zweizeiligen Eintrags gelöscht, bleibt der Eintrag unverändert, statt die Zuordnung zu erraten.
- Eine Zeile, deren Eintrag dein Katalog nicht mehr enthält, bleibt still unverändert.

Umformulierungen und Umbenennungen können also nach Zustimmung des Spielers auch Charaktere erreichen, die den Eintrag schon ausgewählt haben. Eine Änderung der Bedeutung einer Zahl kann und wird das nicht: Sobald die Zeile dem Spieler gehört, gehört ihm auch diese Spalte.

## Bogenbefehle: Dauerhafter Fortschritt

Ein Regelsatz kann mit `sheet.advancement` Änderungen am dauerhaften Aufbau eines Charakters zulassen:

```json
"advancement": {
  "fields": ["xp", "level", "humanity", "discipline"],
  "abilities": true,
  "skills": true,
  "saves": true,
  "text": "Award XP at the end of a session; change other values only when earned."
}
```

Nimm nur Feld-IDs auf, die dein Bogen als Zahl oder Text (`text` oder `longtext`) deklariert, höchstens 24. Die booleschen Werte erlauben jeweils alle Attribute, Fertigkeiten oder Rettungswürfe; ausgelassen oder false bedeutet keine Erlaubnis. Eine leere Erlaubnismenge, ein unbekanntes Feld, ein nicht unterstützter Feldtyp oder ein unbekannter Schlüssel wird beim Import abgelehnt. `text` ist optionaler Anleitungstext mit höchstens 400 promptsicheren Zeichen. Ohne `advancement` verhalten sich die bisherigen Befehle wie zuvor, und jede `advance`-Anforderung wird abgelehnt.

```
[sheet: op="advance" field="xp" by="250" who="party"]
[sheet: op="advance" field="xp" to="1200"]
[sheet: op="advance" field="humanity" by="-1"]
[sheet: op="advance" field="discipline" to="Auspex"]
[sheet: op="advance" ability="str" by="1"]
[sheet: op="advance" ability="str" to="16"]
[sheet: op="advance" skill="stealth" tier="expert"]
[sheet: op="advance" save="will" tier="trained"]
```

Nenne genau ein Ziel. Felder und Attribute nehmen genau eines von `by` oder `to`; Text nimmt nur `to`. Namen und Stufen passen auf IDs oder Beschriftungen, ohne Beachtung der Groß- und Kleinschreibung. Fertigkeiten und Rettungswürfe nehmen jede in `resolution.proficiencyTiers` deklarierte Stufe an. Zahlenfelder beachten `integer`, `min` und `max`, Attribute ihre ganzzahligen Grenzen und Text `maxLength`. Ein ungültiger Wert wird mit dem Grund `bad-amount` abgelehnt, der die Grenze nennt, und nie still begrenzt. Ausgeschalteter Fortschritt, nicht erlaubte Ziele, unbekannte Namen und unbekannte Stufen werden ebenfalls abgelehnt. Das neu geschriebene Tag trägt `result` und den neuen Wert in `now`. Lass `who` für den Spieler weg oder verwende `who="party"` für jede eindeutige Gruppenkarte; teilweise Ablehnungen nennen, welche Karten nicht fortschreiten konnten.

Die Engine speichert den Aufbau über denselben Metadatenspeicher wie eine Bearbeitung durch den Spieler auf der Karte des Spiels, behält dabei die Bogenversion und berechnet abgeleitete Werte aus dem neuen Aufbau neu. Bibliothekskarten werden nicht verändert. Wie bei laufenden Befehlen setzt ein alternativer Swipe oder eine neu generierte Antwort vor den Änderungen der ausgehenden Antwort an. Jede Antwort hält ihren abschließenden Aufbau fest, auch Antworten ohne Fortschritt. Das Auswählen eines Swipes stellt seinen Snapshot wieder her; das Löschen der neuesten Antwort legt den vorherigen Snapshot frei. Das Löschen einer älteren Antwort lässt einen späteren Snapshot in Kraft, bis diese spätere Antwort entfernt wird. Ein Fortsetzen aktualisiert den Snapshot derselben Antwort. Rückgängig machen ändert nur Werte, die noch dem festgehaltenen Ergebnis entsprechen. Spätere Bearbeitungen durch den Spieler bleiben also erhalten, und nicht damit zusammenhängende Bearbeitungen verhindern nicht, dass eine EP-Vergabe rückgängig gemacht wird.

<a id="the-use-command-letting-the-game-master-spend-a-price-you-wrote"></a>

## Der `use`-Befehl: Den Game Master einen von dir festgelegten Preis bezahlen lassen

Während der Erzählung hält der Game Master jeden Bogen mit `[sheet: ...]`-Befehlen aktuell: `spend`, `restore` (`heal` bedeutet dasselbe), `damage`, `temp`, `track`, `condition`, `note` und `rest`. Ein Regelsatz mit Katalogen erhält einen weiteren:

```
[sheet: who="Mira" op="use" name="Fireball"]
[sheet: who="Mira" op="use" name="Fireball" pool="3rd-level slots"]
```

`op="cast"` bedeutet dasselbe wie `op="use"`, und `spell=` dasselbe wie `name=`. So funktioniert die vom Game Master gewählte Formulierung, ohne dass dein Format das Wort "Zauber" kennen muss.

Der Name wird ohne Beachtung der Groß- und Kleinschreibung mit den Zeilen dieses Charakterbogens abgeglichen, die aus einem deiner Kataloge stammen. Eine Zeile reagiert auf den dem Game Master gezeigten Namen – zuerst die `sheetSummary`-Namensspalte der Liste, dann deren `pools.nameColumn`, dann ihre erste Textspalte – und auf das `label` des ursprünglichen Eintrags. So bleibt sie auch nach einer Umbenennung durch den Spieler erreichbar. Ein Name ohne Treffer und ein Name, der auf zwei verschiedene Einträge passt, werden beide abgelehnt.

Was verbraucht wird:

- Jeder Bestandteil von `mechanics.cost` des Eintrags. Nennt ein Bestandteil einen laufenden Pool, wird daraus bezahlt. Nennt er eine Pool-GRUPPE, wird in Deklarationsreihenfolge der erste Pool der Gruppe gewählt, der den Preis bezahlen kann. Es gibt keinen automatischen Aufstieg zu einem höheren Pool, denn eine Gruppe ist nicht immer eine Stufenfolge.
- Zusätzlich eine Nutzung aus jedem Listenzeilen-Pool, den derselbe Eintrag angelegt hat, etwa dem Nutzungszähler eines Merkmals. Das ist die zweite Zeile des obigen Eintrags `Last Ember`. Ein Zähler mit Maximum 0 kann keine Nutzung bereitstellen. Der Befehl wird deshalb abgelehnt, statt kostenlos ausgeführt zu werden.

`pool=` ermöglicht das Verstärken durch einen anderen Pool: derselbe einzelne Preis, bezahlt aus einem anderen Pool derselben Gruppe. Das wird nur akzeptiert, wenn die Kosten genau einen Bestandteil haben und der genannte Pool zu dessen Gruppe gehört oder für sie bezahlt. Alles andere wird abgelehnt statt umgedeutet.

**Ein Pool, der für eine andere Gruppe bezahlt** (Capability API 1.171). Das `pays` eines laufenden Pools nennt bis zu vier andere Gruppen, deren Kosten er ebenfalls bezahlen darf, auf seiner eigenen Stufe (seinem `level` oder seinem Platz in seiner eigenen Gruppe), und nie Kosten einer höheren Stufe als seiner eigenen. Die Paktplätze in 5e bezahlen für Zauber, deren Kosten aus den Zauberplätzen stammen, so wie es ein Hexenmeister mit mehreren Klassen darf:

```json
{
  "id": "pact_slots",
  "label": "Pact Slots",
  "group": "pact",
  "max": { "field": "pact_slot_count" },
  "level": { "field": "pact_slot_level" },
  "pays": ["slots"]
}
```

Ein Kampf bietet einen solchen Pool neben den höheren Pools der eigenen Gruppe des Zaubers an, und eine Zahlung daraus lässt den Zauber um so viele Stufen wachsen, wie seine Stufe über der des Zaubers liegt: Ein Paktplatz des 3. Grades bezahlt Magic Missile so, wie es ein Zauberplatz des 3. Grades täte. Eine Nutzung, deren eigener Pool leer ist, wird weiterhin angeboten, bezahlt nur aus einem höheren Pool oder einem, der für sie bezahlt; ein Zauber des 1. Grades wird also mit einem Zauberplatz des 2. Grades gewirkt, sobald die Plätze des 1. Grades aufgebraucht sind. `targetsPerCostStep` (1.171, 1 bis 10) in den `mechanics` eines Eintrags fügt für jede Stufe, um die er höher bezahlt wird, so viele Ziele hinzu, höchstens bis 20: Hold Person ist `"targetCount": 1,
"targetsPerCostStep": 1`.

Es gilt alles oder nichts. Kann ein Teil nicht bezahlt werden, wird der gesamte Befehl abgelehnt, nichts verändert und der Spieler informiert. Ein völlig kostenloser Eintrag, etwa ein Zaubertrick oder ein passives Merkmal, wird angenommen und verändert nichts.

## Direkt in der Regelsatzdatei oder als eigene Datei

Ein kleiner Katalog steht direkt in `ruleset.json`, im Feld `entries` des Katalogkopfs. Ein langer Katalog liegt in einer eigenen Datei, die der Kopf stattdessen mit `asset` nennt. Ein Katalog enthält genau eines von beiden.

```json
{ "id": "knacks", "label": "Knacks", "feeds": ["knacks"], "asset": "catalogs/knacks.json" }
```

Der Pfad ist immer `catalogs/<the catalog's id>.json`. Die Datei selbst sieht so aus:

```json
{ "schemaVersion": 1, "catalog": "knacks", "entries": [] }
```

Separate Katalogdateien gibt es in einem Paket: einem, das über den offiziellen Katalog veröffentlicht wird, oder einer Regelsatz-Paketdatei, die du selbst importierst (siehe [Deinen Regelsatz teilen](writing-rulesets.md#sharing-your-ruleset)). Das Paket führt die Datei in `contributions.assets.paths` neben `ruleset.json` auf und braucht Capability API 1.21. Ein Kreaturenkatalog braucht Capability API 1.27, unabhängig davon, ob er direkt eingebettet ist oder eine eigene Datei hat, und ein Gegenstandskatalog braucht 1.49. **Ein als Einzeldatei importierter oder über ein GitHub-Repository geteilter Regelsatz enthält seine Kataloge direkt in der Datei.** Sie müssen daher in die 512-KB-Grenze der gesamten Regelsatzdatei passen. Das reicht für einige Hundert kurze Einträge.

Die Grenzen sind 12 Kataloge pro Regelsatz, in beiden Formen 2000 Einträge je Katalog und 2 MB für eine Katalogdatei. Ein Paket, dessen `ruleset.json` größer als 256 KB ist oder das eine Katalogdatei über 1 MB enthält, braucht Capability API 1.340, mit der beide Grenzen angehoben wurden.
