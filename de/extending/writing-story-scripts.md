# Story-Skripte für Game Mode schreiben

Mit einem Story-Skript steuerst du, wie sich ein Game-Mode-Spiel entfaltet: Szenen, die abgespielt werden, wenn die Gruppe irgendwo ankommt, Aufgaben, um die der Game Master gebeten wird, sobald eine Bedingung erfüllt ist, Ziele, denen der Spieler im Journal folgt, und Momente, die der Game Master selbst markieren darf. Dieser Leitfaden richtet sich an alle, die eigene Story-Skripte schreiben. Wenn du eine Welt spielen möchtest, die eine Story hat, beginne bei [Eine Welt erstellen](../game/getting-started.md#making-a-world).

Ein Story-Skript enthält Daten, keinen Code. Nichts darin wird ausgeführt. Die Engine prüft es gegen die Welt, für die es geschrieben ist, spielt es Zug für Zug ab und lehnt alles ab, was nicht passt.

## Wo eine Story liegt

Eine Story gehört zu genau einer Welt. Sie nennt die Orte und Personen dieser Welt und ergibt daher nur mit der Welt Sinn, für die sie geschrieben wurde (mit ihrem Seed, ihrer Vorgabe und ihren manuellen Änderungen).

- In einer **Weltdatei** (`.world.json`) als `story` auf oberster Ebene neben `world`. Eine Engine, die keine Storys kennt, liest die Welt trotzdem.
- Im **Kartenpaket** einer Experience: Jede Weltdatei kann ihre Story mitbringen, und ein neues Spiel übernimmt sie zusammen mit der Karte. Siehe [optionale Agent-Pakete](../development/optional-agent-packages.md).
- In einer Welt, die außerhalb eines Spiels in der Bibliothek liegt: `GET`, `PUT` und `DELETE /api/game-worlds/:id/story`, genau wie bei einem Spiel. Ein neues Spiel, das mit dieser Welt beginnt, übernimmt die Story.
- In einem Spiel, sobald es begonnen hat: `GET`, `PUT` und `DELETE /api/game/:chatId/story` lesen, speichern und entfernen sie. Beim Speichern wird sie gegen die Welt des Spiels geprüft, einschließlich ihrer manuellen Änderungen, und manuelle Änderungen, die etwas entfernen würden, das die Story nennt, werden abgelehnt.

Bei der Einrichtung eines neuen Spiels bleibt eine aus einer Datei oder einem Kartenpaket gelesene Story erhalten, solange Seed und Vorgabe der Welt unverändert bleiben.

## Der Aufbau

```json
{
  "storyVersion": 1,
  "flags": [],
  "directions": [],
  "events": [],
  "cutscenes": [],
  "fights": [],
  "endings": [],
  "knowledge": []
}
```

IDs bestehen aus 1 bis 40 Kleinbuchstaben, Ziffern, `_` oder `-` und sind innerhalb ihrer Liste eindeutig. Eine Story enthält höchstens 256 Flags (64 vor Capability API 1.353), 64 Anweisungen, 256 Ereignisse (128 vor 1.349), 64 Zwischensequenzen, 32 Kämpfe, 16 Enden und 600 Wissenseinträge. Kein Text darin darf einen Zeilenumbruch, eckige Klammern oder `{{` enthalten, und Namen, die in ein Tag geschrieben werden (eine Gruppe, ein Hintergrund), dürfen kein doppeltes Anführungszeichen enthalten: Nichts, was eine Story sagt, kann sich als eines der Tags des Game Master ausgeben.

### Flags

Ein Flag ist ein Wert, den die Story speichert: `"bool"` (wahr oder falsch) oder `"number"`.

```json
{ "id": "trust", "kind": "number", "initial": 0, "gm": true, "note": "How far the town trusts the party" }
```

- Mit `gm: true` darf der Game Master es setzen (siehe [Die Tags des Game Master](#the-game-masters-tags)); `note` erklärt ihm, was das Flag bedeutet.
- Flags sind vor dem Spieler verborgen. Mit `quest` wird ein Flag zu einem **Quest-Ziel** im Journal:

```json
{
  "id": "favours",
  "kind": "number",
  "initial": 0,
  "quest": { "title": "Favours", "text": "Do the town three favours", "goal": 3 }
}
```

Ein Zahlen-Flag kann ein `min` und ein `max` haben (Capability API 1.358): Jedes `set` und `add` hält es innerhalb dieser Grenzen, auch die eigenen Tags des Game Master. So bleibt ein Zustimmungswert zwischen -10 und 10, egal wie viele Ereignisse etwas dazuaddieren. Sein `initial` muss innerhalb der Grenzen liegen.

```json
{ "id": "approval", "kind": "number", "initial": 0, "min": -10, "max": 10, "gm": true }
```

Ein Ja-Nein-Ziel ist erfüllt, wenn sein Flag wahr ist; ein Zahlenziel, wenn sein Flag den Zielwert `goal` erreicht (1, wenn keiner angegeben ist). Ist ein `goal` eingetragen, zeigt das Journal den Fortschritt an. Ein Ziel mit `"hidden": true` bleibt im Journal verborgen, bis ein Ereignis es anzeigt.

#### Uhren

Ein Zahlen-Flag kann eine **Uhr** sein, die sich vor den Augen des Spielers füllt (Capability API 1.342): ein Kreis mit 2 bis 12 Segmenten, eines pro Punkt gefüllt, angezeigt im HUD des Spiels und im Tab **World** (Welt), mit ihrem Titel und dem, was passiert, wenn sie voll ist.

```json
{
  "id": "reeve",
  "kind": "number",
  "initial": 0,
  "gm": true,
  "clock": { "title": "The Reeve's patience", "segments": 6, "full": "The Reeve sends his men." }
}
```

Du kannst sie wie jedes Zahlen-Flag setzen, erhöhen und in Bedingungen prüfen. Der Game Master erfährt in jedem Zug von den Uhren und einmalig, wenn eine voll wird (durch ein Ereignis oder, bei seinem eigenen Tag, im Zug danach), was er geschehen lassen soll. Eine Uhr mit `"hidden": true` bleibt verborgen, bis ein Ereignis sie mit `show` anzeigt.

### Anweisungen

Eine Anweisung richtet sich dauerhaft an den Game Master und gilt, solange ihre Bedingungen erfüllt sind:

```json
{ "id": "wary", "text": "The town is wary of strangers.", "if": [{ "flag": "trust", "is": "<", "value": 2 }] }
```

<a id="conditions"></a>

### Bedingungen

`{ "flag": "<id>", "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <value> }`. Alle Bedingungen einer `if`-Liste müssen erfüllt sein. Ein Ja-Nein-Flag wird nur mit `=` oder `!=` verglichen.

`{ "party": "<person id>", "is": "in" | "out" }` fragt, ob eine Person der Welt gerade mit der Gruppe reist, etwa ein Begleiter, den die Story rekrutiert hat (Capability API 1.349).

`{ "partySize": { "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <1 to 32> } }` fragt nach der Gruppengröße: dem Spielercharakter und allen mitreisenden Begleitern außer denen, die nie kämpfen (Capability API 1.360). Die Bedingung ist nur erfüllt, wenn die Engine die Gruppengröße kennt.

`{ "any": [<condition>, <condition>, ...] }` ist erfüllt, wenn eine ihrer 2 bis 8 Bedingungen erfüllt ist (Capability API 1.358): ein Entweder-oder in einer Liste statt zweier Ereignisse.

```json
"if": [{ "any": [{ "flag": "won_granary", "is": "=", "value": true }, { "party": "p11-3", "is": "in" }] }]
```

### Wissen

Was Personen über sich selbst, einander und das Setting wissen und sagen, verändert sich mit der Story (Capability API 1.348). Jeder Eintrag wird dem Game Master als etwas mitgeteilt, das die Person bei passender Gelegenheit sagen darf, wenn in diesem Zug:

- seine Bedingungen erfüllt sind,
- seine `person` in der Szene ist: in der letzten Antwort oder der Nachricht des Spielers genannt oder mit der Gruppe unterwegs,
- und, falls er `keys` hat, dort auch einer davon genannt wird. Ein Eintrag ohne Person braucht Schlüsselwörter und wird allein durch sie eingebracht.

Pro Zug werden höchstens 12 Einträge mitgeteilt. Ab 1.361 sind sie nach Vorrang geordnet: zuerst die in der Szene genannten Personen, dann die durch ihre Wörter eingebrachten Einträge ohne Person, danach die nur mitreisenden Begleiter. Innerhalb jeder Gruppe werden die Einträge reihum auf die Personen verteilt, damit ein gesprächiger Begleiter die anderen nie verdrängt. Für mitreisende Begleiter bleiben immer zwei der 12 Plätze reserviert, egal wie voll die Szene ist; sie werden genauso verteilt.

```json
"knowledge": [
  { "id": "hob-self", "person": "p3-4", "text": "Hob was a miller's boy before the year stopped." },
  { "id": "hob-mill", "person": "p3-4", "if": [{ "flag": "act", "is": ">=", "value": 2 }],
    "text": "Since the second act, Hob is afraid of the mill." },
  { "id": "hob-bells", "person": "p3-4", "keys": ["bells"], "text": "Hob thinks the bells are a lie." },
  { "id": "wheel", "keys": ["mill", "millwheel"], "text": "The mill's wheel has not turned in a hundred autumns." }
]
```

Ein Skript enthält bis zu 600 Einträge. Pro Zug werden höchstens 12 in der Reihenfolge des Skripts mitgeteilt; setz die wichtigsten deshalb nach vorn.

### Ereignisse

Ein Ereignis ist etwas, das geschieht: Wenn sein Auslöser greift und seine Bedingungen erfüllt sind, führt es seine Aktionen aus.

```json
{
  "id": "gates",
  "when": { "on": "arrive", "place": "p11" },
  "if": [{ "flag": "banished", "is": "=", "value": false }],
  "do": [{ "cutscene": "gates" }, { "set": "arrived", "value": true }, { "show": "key" }]
}
```

Ein Ereignis geschieht einmal, es sei denn, es hat `"repeat": true` (was `start`, `turn` und `day` ignorieren). In einem Zug geschehen höchstens 32 Ereignisse, jedes höchstens einmal, in der Reihenfolge, in der das Skript sie aufführt.

**Auslöser** (`when.on`); alle richten sich nach dem, was das Spiel aufgezeichnet hat:

| Auslöser | Greift |
| --- | --- |
| `start` | Bei der ersten Antwort des Spiels. |
| `turn` | Bei oder nach der Antwort Nummer `turn` des Game Master im gesamten Spiel, über alle Sitzungen hinweg. |
| `day` | Sobald der Tag der Welt `day` oder später ist. Der Tag rückt weiter, wenn der Game Master Zeit vergehen lässt und wenn die Gruppe Wege zurücklegt. |
| `arrive` | Solange die Gruppe in `place` (einer Orts-ID) oder einem Ort darin ist und dorthin gelangt ist, indem sie dort begonnen hat, über einen Weg auf der Oberwelt, über einen Besuch in der Stadt oder über einen Ort, den der Game Master nennt. Mit `repeat` erneut jedes Mal, wenn sie von anderswo zurückkehrt. |
| `meet` | Sobald eine Antwort `person` (eine Personen-ID wie `p11-3` oder `p11-e1` für eine von Hand hinzugefügte Person) mit vollem Namen genannt hat. Mit `repeat` erneut bei jeder Antwort, die die Person nennt. Nach Namen werden nur die Antworten dieser Sitzung durchsucht. |
| `deed` | Sobald die Welt eine Tat der Gruppe aufgezeichnet hat, von der Art `deed` und, falls angegeben, an `place`. Mit `repeat` erneut bei jeder Antwort, die eine solche Tat aufzeichnet. |
| `fight` | Wenn ein Kampf mit `outcome` endet: `victory`, `defeat` oder `flee`. Mit `fight` (einem der Kämpfe des Skripts, 1.358) nur, wenn dieser Kampf so endet: der Kampf, den die letzte Antwort des Game Master durch die `fight`-Aktion der Story oder sein eigenes Auslösen begonnen hat. |
| `leave` | Wenn die Gruppe `place` (eine Orts-ID) und alle Orte darin verlässt (1.358): durch einen Weg, einen Besuch, einen vom Game Master genannten Ort oder das `move` der Story, in der letzten Antwort oder diesem Zug. Mit `repeat` erneut jedes Mal, wenn sie den Ort verlässt. |
| `broke` | Wenn ein Kampf das Requisit namens `prop` zerstört hat (Capability API 1.316); Groß-/Kleinschreibung spielt beim Vergleich keine Rolle. Nur ein Requisit, das auf eines der Schlachtfelder der Welt gemalt wurde, kann genannt werden. |
| `flags` | Wenn seine Bedingungen erfüllt sind. Mit `repeat` erneut jedes Mal, wenn sie erfüllt werden, nachdem sie es nicht waren. |
| `gm` | Nur wenn der Game Master es auslöst (das Ereignis braucht `"gm": true`). |
| `rest` | Nach einer Antwort, in der die Gruppe gerastet hat: einem `[sheet: op="rest"]`, das die Antwort des Game Master ausgeführt hat, von der durch `rest` genannten Regelsatz-Rast (ihre ID oder Beschriftung, etwa `long`) oder einer beliebigen (1.349). |
| `travel` | In einem Zug, in dem die Gruppe von einem Ort zu einem anderen aufbricht, aus dem Bereich von `from` in den von `to`, falls angegeben (1.349). |
| `idle` | Nach `turns` Antworten in Folge, in denen nichts geschieht: kein Story-Ereignis, kein Weg und kein Kampf (1.349). |
| `step` | Wenn ein Weg über die Zelle `x`, `y` (ab 0, von oben links gezählt) von `place` führt: über die Stadt einer Siedlung (der Weg eines Besuchs, von Tür zu Tür) oder über eine von Hand erstellte Karte eines Ortes (ein Weg darauf). Die Zelle muss eine sein, die die Gruppe betreten kann: in einer Stadt Boden, den man vom Platz aus erreicht, und kein freies Grundstück, auf dem die Story bauen darf; auf einer Karte Boden, den man von ihrem Eingang aus erreicht. Eine generierte Karte hat keine Zellen, die sich nennen lassen. Mit `repeat` erneut in jedem Zug, dessen Weg darüber führt. |

Manuelle Änderungen, die einem `step`-Ereignis seine Zelle wegnehmen (ein darauf gesetztes Gebäude, zugemauerter Boden auf einer Karte), werden beim Speichern abgelehnt; die Meldung nennt das Ereignis.

Ein wiederholbares `meet`-Ereignis, dessen eigene Szene diese Person nennt, oder ein wiederholbares `deed`-Ereignis, das selbst die Tat vollbringt, auf die es wartet, würde sich in jedem Zug selbst auslösen; die Engine lehnt es deshalb ab.

**Aktionen** (`do`):

| Aktion | Wirkung |
| --- | --- |
| `{ "set": "<flag>", "value": <value> }` | Setzt ein Flag. |
| `{ "add": "<flag>", "amount": <number> }` | Addiert einen Betrag zu einem Zahlen-Flag. |
| `{ "tell": "<text>" }` | Bittet den Game Master einmalig in diesem Zug um etwas. |
| `{ "cutscene": "<id>" }` | Spielt eine Zwischensequenz ab. |
| `{ "show": "<flag>" }` | Zeigt ein verborgenes Quest-Ziel im Journal an. |
| `{ "world": { "deed": "<kind>", "group": "...", "with": "...", "place": "<place id>", "who": "..." } }` | Zeichnet eine Tat in der Welt auf; sie wird so beantwortet, wie eine eigene Tat des Game Master beantwortet würde. |
| `{ "give": { "item": "<catalog/entry or a name>", "count": 1, "who": "...", "summary": "..." } }` | Vergibt einen Gegenstand (1.343): einen Regelsatzgegenstand des Spiels über seine ID oder jeden anderen über seinen Namen (mit einer Beschreibung in `summary`), in die Tasche des Spielers oder zu dem in `who` genannten Gruppenmitglied. Er wird wie ein vom Game Master vergebener Gegenstand aufgenommen, also nach den Regeln des Inventars. Eine ID, die der Regelsatz des Spiels nicht anbietet, wird abgelehnt, mit Begründung in der Antwort. |
| `{ "fight": "<fight id>" }` | Beginnt einen der Kämpfe des Skripts (1.343). Der Game Master wird gebeten, ihn einzuleiten; der folgende Kampf hat die Gegner der Story. |
| `{ "move": "<place id>" }` | Versetzt die Gruppe wie ein Weg an einen Ort der Welt (1.343); ein dadurch ausgelöstes `arrive`-Ereignis geschieht im selben Zug. |
| `{ "ending": "<ending id>" }` | Beendet das Spiel mit einem der Enden des Skripts (1.343): Seine Szene wird abgespielt, der Game Master schließt mit seinem Epilog, und der Spieler sieht das Ende und erhält das Angebot, die Sitzung zu beenden. Danach geschieht nichts mehr in der Story. |
| `{ "music": "<track id>" }` oder `{ "music": null }` | Spielt einen Titel der Experience anstelle der Ortsmusik ab (1.345), bis ein anderer Titel angefordert wird oder `null` wieder die Ortsmusik übernimmt. Der Titel muss zu `music` des Kartenpakets gehören. |
| `{ "recruit": "<person id>" }` | Nimmt einen der Begleiter der Experience mit seinem Bogen für den Regelsatz des Spiels in die Gruppe auf (1.347). Der Game Master wird gebeten, den Beitritt darzustellen. |
| `{ "dismiss": "<person id>" }` | Entlässt einen Begleiter aus der Gruppe (1.347). |
| `{ "season": { "place": "<place id>", "to": "winter" } }` | Hält einen Ort und alle Orte darin unabhängig vom Datum in einer Jahreszeit fest (1.351); ohne `place` die ganze Welt. `"to": null` lässt ihn zu den eigenen `seasons` des Skripts oder zur Jahreszeit des Datums zurückkehren. |
| `{ "sheet": { "condition": "<id>", "state": "on" }` oder `{ "sheet": { "track": "<id>", "by": 1, "upTo": 3 } }` | Legt jedem Gruppenmitglied einen Bogenzustand auf oder entfernt ihn (`"off"`), oder verschiebt eine Leiste auf jedem Bogen, begrenzt durch `upTo` (1.368): etwa die Kälte von Rime Edge, die keine Rast heilt, über einen Zustand, dessen Kampfzustand `cannot-heal-nonmagical` hat. Ein Auslösen durch die Engine wendet dies mit der von ihr geschriebenen Antwort an; eines durch den Game Master im Zug nach seiner Markierung. |

Jede Aktion kann ein eigenes `if` haben (Capability API 1.358): Sie wird nur ausgeführt, wenn ihre Bedingungen erfüllt sind, sobald das Ereignis sie erreicht, nachdem dessen frühere Aktionen ausgeführt wurden. So kann ein Ereignis verzweigen.

```json
"do": [
  { "add": "approval", "amount": 2 },
  { "tell": "Hob warms to the party.", "if": [{ "flag": "approval", "is": ">=", "value": 5 }] },
  { "tell": "Hob keeps his distance.", "if": [{ "flag": "approval", "is": "<", "value": 5 }] }
]
```

Welche Aktionen ausgeführt wurden, wird beim Auslösen aufgezeichnet. Deshalb kommen Szenen und Bitten eines `gm`-Ereignisses im nächsten Zug so an, wie sie beim Markieren durch den Game Master ausgeführt wurden.

Jede Story-Funktion braucht eine bestimmte Minor-Version der Capability API:

- Uhren brauchen 1.342;
- Kämpfe, Enden und die Aktionen `give`, `fight`, `move` und `ending` brauchen 1.343;
- Musikeinsätze brauchen 1.345;
- das Aufnehmen oder Entlassen von Begleitern braucht 1.347;
- Wissen braucht 1.348;
- `rest`-, `travel`- und `idle`-Ereignisse, eine `priority`, eine `party`-Bedingung oder mehr als 128 Ereignisse brauchen 1.349;
- `seasons` und die Aktion `season` brauchen 1.351;
- mehr als 64 Flags brauchen 1.353;
- Kampf-`variants` brauchen 1.356;
- `any`-Bedingungen, ein `fight`-Ereignis mit benanntem Kampf, ein `leave`-Ereignis, `min` oder `max` eines Flags sowie ein `if` an einer Aktion oder Seite brauchen 1.358;
- eine `partySize`-Bedingung, eine Variante für eine Gruppe über 6 oder ohne Obergrenze oder mehr als 6 Varianten brauchen 1.360;
- eine `season`-Aktion mit `over` für alles darin braucht 1.361;
- `exposures` brauchen 1.362;
- Kampfkreaturen mit `adjust` brauchen 1.363;
- ein `save` einer Belastung oder das `upTo` einer Leiste braucht 1.364;
- das `sparedByShade` einer Belastung braucht 1.365;
- `heldGround` braucht 1.366;
- eine `sheet`-Aktion braucht 1.368;
- ein `release` für Held Ground braucht 1.369;
- die Vergabe einer Liste von Alternativen braucht 1.370 (eine einzelne reine Eintrags-ID, ab 1.370 aus dem Katalog vergeben, der sie enthält, gilt für eine ältere Engine als Name);
- Kampfkreaturen mit `adjust` für `calls` oder `levels` brauchen 1.371.

Ein Begleiter ist eine entsprechend markierte Person in der Personendatei des Pakets (siehe die Personen des Kartenpakets in [optionale Agent-Pakete](../development/optional-agent-packages.md)).

Von den `rest`-, `travel`- und `idle`-Ereignissen, die in einem Zug geschehen könnten, geschieht nur eines: das mit der höchsten `priority` (eine ganze Zahl von -100 bis 100, ohne Angabe 0; bei Gleichstand das erste im Skript). So häufen sich das Lagerfeuergespräch eines Begleiters, ein Streit zweier Begleiter auf der Straße oder der Besuch eines Begleiters beim Spieler in einer ruhigen Stunde nie an. Mit einer `party`-Bedingung geschieht eine solche Szene nur, solange diese Begleiter mit der Gruppe reisen. Ab 1.349 darf ein Skript 256 Ereignisse haben (vorher 128).

### Belastungen

Was der Aufenthalt an einem Ort mit der Zeit mit der Gruppe macht (Capability API 1.362), etwa ein Feld aus Mittagslicht, das Reisende außerhalb eines Kampfes ebenso schwächt wie die Lichtregel eines Spielfelds innerhalb eines Kampfes:

```json
"exposures": [
  { "id": "noonfield", "place": "e9", "label": "Noonfield's light", "hours": 1,
    "tracks": [{ "track": "exhaustion", "by": 1 }], "applies": ["sunstruck"],
    "if": [{ "flag": "darkness_carried", "is": "=", "value": false }],
    "tell": "The light presses on them; darkness would be a mercy." }
]
```

Maßgeblich ist die Spieluhr: Der erste Zug, in dem die Gruppe in `place` (oder darin) ist und `if` erfüllt ist, startet die Belastung. Jeder spätere Zug zählt, wie viele `hours` dort seitdem vergangen sind. Jedes Mal, wenn sie verstrichen sind, verschiebt die Engine für jedes Gruppenmitglied die `tracks` um `by` und legt ihm die Zustände aus `applies` auf. Ihre eigenen Bogenbefehle werden zusammen mit denen der Antwort angewendet, und der Game Master wird mit `tell` informiert. Das Verlassen des Ortes oder ein nicht mehr erfülltes `if` beendet die Belastung; beim nächsten Mal beginnt sie neu. Sie wird einmalig in der Antwort aufgezeichnet (`[story: exposure=...]`).

Eine Leiste kann an einer Obergrenze stoppen (Capability API 1.364): `{ "track": "exhaustion", "by": 1, "upTo": 3 }` bringt sie nie über 3 und verändert eine bereits darüber liegende Leiste nie. Eine Belastung kann einen Rettungswurf verlangen, statt alle zu treffen (1.364), im selben Format wie das `save` der Lichtregel eines Kampfspielfelds (1.321):

```json
"save": { "save": "con_save", "difficulty": 12, "against": { "conditions": ["noon_light"] } }
```

Jedes Mal, wenn sie wirkt, würfelt die Engine diesen Rettungswurf für jedes Gruppenmitglied anhand seines eigenen Bogens. Nur wer scheitert, erhält die Leistenänderungen und Zustände, jeweils über einen eigenen Bogenbefehl. `against` gibt an, wogegen der Rettungswurf erfolgt. Ein darauf beschränkter Rettungswurfmodifikator gilt also außerhalb eines Kampfes genauso wie darin: Ein Strohhut aus einem Overlay mit `{ "to": "saves", "mode": "advantage", "against": { "conditions": ["noon_light"] } }` gibt seinem Träger Vorteil. Der Game Master erfährt mit den Gesamtergebnissen, wer bestanden hat und wer gescheitert ist.

Mit `"sparedByShade": true` (Capability API 1.365) hält ein von einem beliebigen Gruppenmitglied mitgeführter, entzündeter Schattenspender die Belastung ab, wie ein nicht erfülltes `if`: ein Gegenstand, dessen getragenes oder mitgeführtes `light` ein `"shade": true` hat (die Lantern of Dusk aus dem Showcase-Beispiel), bei einem Gegenstand mit Schalter nur, solange er eingeschaltet ist. Ihn zu entzünden beendet die Belastung; ihn zu löschen lässt sie neu beginnen.

### Held Ground

Wo der Tod aufgehalten wird (Capability API 1.366), wie im Tal des Showcase-Beispiels:

```json
"heldGround": [
  { "id": "valley", "place": "p0", "label": "The Held Autumn", "condition": "felled",
    "marks": [{ "track": "owing", "by": 1 }],
    "if": [{ "flag": "year_turned", "is": "=", "value": false }],
    "tell": "Nobody here has died in forty years." }
]
```

Solange die Gruppe in `place` (oder darin; ohne Angabe in der ganzen Welt) ist und `if` erfüllt ist, wird ein dort begonnener Regelsatzkampf auf Held Ground ausgetragen (1.323): Wer keine Gesundheit mehr hat, wird stattdessen gefällt, scheidet aus dem Kampf aus, bleibt stabil und stirbt nie. Er steht später wieder auf, sofern ihn nicht etwas gefällt hat, das erntet. `condition` wird den Gefällten auferlegt, und bei jedem gefällten Charakter werden die Leisten aus `marks` verschoben (ein Owing-Mal). Der erste passende Eintrag gilt. Die Story zeichnet auf, wann die Gruppe diesen Boden betritt und verlässt (`[story: held=...]`), und informiert jedes Mal den Game Master (mit `tell`); in jedem Zug, in dem er gilt, wird der Game Master an seine Bedeutung erinnert.

Held Ground kann aufgegeben werden (Capability API 1.369): im Showcase-Beispiel, wenn das Jahr sich wendet. Sein `release` sagt, was dann fällig wird:

```json
"release": { "felled": "die", "owing": { "track": "owing", "bonus": { "flag": "hymn_bonus" } } }
```

`felled` bestimmt, was mit den Gefällten geschieht: Sie sterben (`"die"`, der Standard) oder gehen zu Boden und beginnen nach der eigenen Regel des Regelsatzes zu sterben (`"down"`). Durch `owing` würfelt jedes Gruppenmitglied für jedes Mal auf `track` einen Todesrettungswurf des Regelsatzes (ohne Angabe die erste von Held Ground markierte Leiste), jeweils mit `bonus` (einer Zahl oder einem beim Loslassen gelesenen Zahlen-Flag), bis die Male aufgebraucht sind oder das Ergebnis feststeht. Die Male werden verbraucht, und drei Fehlschläge bedeuten den Tod. In einem noch laufenden Regelsatzkampf darauf lässt der Boden genau in dem Schritt los, der ihn verändert: die Benutzung eines Gegenstands, die die von seinem `if` gelesene Story-Zahl ausgibt (1.359), oder ein zerstörtes Requisit, auf das ein `broke`-Ereignis reagiert (1.316), sowie die dadurch ausgelösten Flag-Ereignisse. Gefällte und Owing werden in dieser Runde durch die eigene Freigabe des Kampfes abgewickelt (1.330). Außerhalb eines Kampfes würfelt der Story-Zug, der die Freigabe aufzeichnet, das Owing jedes Mitglieds anhand seines eigenen Bogens aus und teilt dem Game Master mit, wer gelebt hat und wer gestorben ist. Ein darauf unvollendet gebliebener Kampf lässt beim nächsten Schritt los. Was ein Kampf bereits freigegeben hat, wird nie zweimal ausgewürfelt.

<a id="seasons"></a>

### Jahreszeiten

Die Jahreszeiten einer Welt folgen ihrem Kalender, jeweils 90 Tage lang. Eine Story kann Orte unabhängig vom Datum in einer Jahreszeit festhalten (Capability API 1.351): ein im Herbst gefangenes Tal, ein im Winter festgehaltener Hügel.

```json
"seasons": [{ "place": "p3", "season": "autumn" }, { "season": "summer" }]
```

Jeder Eintrag hält einen Ort und alle Orte darin fest; einer ohne `place` die ganze Welt. Der innerste festgehaltene Ort entscheidet: In einem im Winter festgehaltenen Dorf innerhalb einer im Herbst festgehaltenen Region ist Winter. Die Aktion `season` verändert eine Festlegung während des Spiels oder hebt sie auf. Eine mit `over` für alles darin geltende Festlegung (1.361) ist die Ausnahme: Sie hat Vorrang vor jeder Jahreszeit dort, sowohl den eigenen des Skripts als auch jeder anderen Festlegung (die äußerste solche Festlegung zuerst). So wendet `{ "season": { "to": "spring", "over": true } }` die ganze Welt auf einmal. Wo die Jahreszeit am Aufenthaltsort der Gruppe festgehalten ist, erfährt der Game Master die Jahreszeit und dass sie festgehalten ist; das Wetter wird dafür erzeugt. Die Oberwelt zeichnet jede Zelle in der Jahreszeit des nächstgelegenen Ortes (mit den `<id>@<season>`-Tiles eines Tile-Packs), eine Stadt in ihrer eigenen.

Auch ein von Hand gemaltes Schlachtfeld der Welt kann mit Jahreszeiten bemalt werden: eine `seasons`-Zeile pro Tile-Zeile, ein Buchstabe oder `.` pro Tile, mit `seasonKeys` für die Buchstaben (`{ "a": "autumn", "w": "winter" }`). Ein bei `.` belassenes Tile hat die Jahreszeit des Kampf-Ortes. Die Tiles eines Kampfes beginnen damit, und seine Kartenereignisse pro Runde können sie ändern, etwa als sich ausbreitender Frostring oder als darüber hinwegziehende Frühlingslinie.

### Kämpfe

Ein von der Story festgelegter Kampf: gegen wen gekämpft wird und wo, wenn in der Welt ein Spielfeld dafür gemalt ist.

```json
{
  "id": "granary",
  "name": "The Granary",
  "creatures": [
    { "creature": "creatures/scarecrow", "count": 3 },
    { "creature": "The Owed", "name": "The Owed" }
  ],
  "battlefield": "b2",
  "note": "The jars break when hit."
}
```

Jede Kreatur ist eine Bestiariumskreatur des Spielregelsatzes, über ihre ID (`catalog/entry`) oder ihren Namen, in der Anzahl `count` (bei mehreren nummeriert) und, falls angegeben, im Kampf mit `name` benannt. `battlefield` ist ein von Hand in der Welt gemaltes Spielfeld (`b<n>`), auf dem unabhängig vom Startort gekämpft wird; ohne Angabe findet der Kampf wie jeder andere dort statt, wo er beginnt. `note` erklärt dem Game Master, wie er zustande kommt. Eine ID, die der Regelsatz des Spiels nicht hat, wird abgelehnt: Diese Kreaturen werden aus dem Kampf weggelassen und die Ablehnung protokolliert. Ein Kampf ohne verbleibende Kreaturen beginnt trotzdem wie von der Story festgelegt auf seinem Schlachtfeld, aber der Game Master wählt seine Gegner.

Ein Kampf kann für Gruppen anderer Größen eingerichtet werden (Capability API 1.356). Die Gruppe umfasst den Spielercharakter und alle mitreisenden Begleiter außer einem mit `noncombatant` markierten Begleiter (1.360).

```json
"variants": [
  { "party": { "min": 3, "max": 4 }, "creatures": [{ "creature": "creatures/scarecrow", "count": 4 }] },
  { "party": 5, "creatures": [{ "creature": "creatures/scarecrow", "count": 5 }], "battlefield": "b3",
    "note": "The Owed wakes in the loft." }
]
```

Gekämpft wird gegen die Variante, deren `party` auf die Gruppengröße zutrifft, mit ihren eigenen Kreaturen und, falls angegeben, ihrem eigenen `battlefield` und ihrer eigenen `note` (sonst denen des Kampfes). Eine Gruppe, auf die keine Variante zutrifft, kämpft gegen den unveränderten Kampf. Auf keine Größe dürfen zwei Varianten zutreffen.

Ein Kreatureneintrag eines Kampfes oder einer Variante kann die Kreatur für diesen Kampf mit `adjust` anpassen (Capability API 1.363). So skaliert ein Boss mit der Gruppe, ohne eine eigene Kreatur zu brauchen: `"adjust": { "legendaryResistance": 2, "maxHp": 40 }` gibt ihr diese Legendary Resistance (0 entfernt sie) und diese Gesundheit (eine feste Zahl anstelle der gesamten Gesundheitsangabe ihres Werteblocks samt Würfeln). Der Game Master erfährt dies neben der Kreatur. Das `calls` einer Anpassung ändert, wen die Aktionen der Kreatur herbeirufen (Capability API 1.371): `[{ "action": "shelves_lean", "creature": "creatures/wraith" }]`, über ID oder Namen der Aktion, für eine herbeirufende Aktion (1.325). Ihre `levels` ändern diese Werte ab einer Gruppenstufe aufwärts, jeder Eintrag aufbauend auf dem vorherigen: `"levels": [{ "from": 8, "calls": [{ "action": "shelves_lean", "creature":
"creatures/wraith" }] }]`. Die Gruppenstufe ist die höchste erreichte Stufe eines ihrer Mitglieder, gelesen aus den Stufenfeldern, die die Begleiterbögen der Experience für den Spielregelsatz nennen. Ohne solche Felder wird `levels` nicht gelesen. Ein `party` benennt Größen bis 32; ein Bereich ohne `max` (`{ "min": 7 }`, Capability API 1.360) gilt für jede Gruppe ab seinem `min`, egal wie groß. Der Game Master erfährt bei Kampfbeginn und erneut nach der Zusammenfassung, für welche Gruppengröße der Kampf eingerichtet wurde.

### Enden

```json
{ "id": "kept", "title": "The Year Kept", "cutscene": "bells", "epilogue": "The valley stays held." }
```

`cutscene` ist eine der Szenen des Skripts, die zu Beginn des Endes abgespielt wird; `epilogue` ist das, womit der Game Master das Spiel abschließt und was der Spieler liest, wenn das Ende angezeigt wird.

### Zwischensequenzen

Eine Zwischensequenz wird dem Spieler entweder genau so gezeigt, wie sie geschrieben ist, oder dem Game Master zum Erzählen übergeben.

```json
{
  "id": "gates",
  "kind": "pages",
  "background": "backgrounds:generated:town-gates",
  "pages": [
    { "text": "The gates creak open." },
    { "speaker": "p11-3", "expression": "happy", "text": "Welcome, travellers." },
    { "speaker": "player", "text": "We come in peace." }
  ]
}
```

Eine `pages`-Zwischensequenz läuft vor der Antwort des Game Master in der Erzählung ab, eine Seite nach der anderen: Eine Seite ohne Sprecher ist Erzähltext, eine Seite mit Sprecher ist die Zeile dieser Person, unter ihrem Namen in der Welt (oder unter dem des Spielers bei `player`) und mit einer `expression` aus der eigenen Liste des Game Master. Ein `background` ist ein Hintergrund, den das Spiel hat, oder `backgrounds:generated:<words>`, um einen erzeugen zu lassen, wenn die Bildgenerierung eingeschaltet ist. Der Game Master erfährt, dass die Szene gezeigt wurde, und macht von dort aus weiter.

Eine Seite kann ein `if` haben (Capability API 1.358): Sie wird nur gezeigt, wenn ihre Bedingungen beim Abspielen der Szene erfüllt sind. So kann eine Lagerszene jedem Begleiter nur dann eine Zeile geben, wenn er mit der Gruppe reist.

```json
{ "speaker": "p11-3", "text": "Another night.", "if": [{ "party": "p11-3", "is": "in" }] }
```

Eine Szene, deren sämtliche Seiten zurückgehalten werden, zeigt nichts.

```json
{ "id": "dusk", "kind": "beats", "beats": ["Lamps are lit.", "A bell tolls."] }
```

Eine `beats`-Zwischensequenz erzählt der Game Master in diesem Zug in eigenen Worten, Beat für Beat. Die Beats eines `gm`-Ereignisses erhält der Game Master zusammen mit dem Ereignis und erzählt sie in der Antwort, die den Moment markiert. Eine Beats-Szene, die ein `gm`-Ereignis verwendet, kennt der Game Master also von Anfang an, auch wenn ein Ereignis der Engine sie ebenfalls abspielt. Da er sie in jedem Zug mitgeteilt bekommt, sind die Beats aller `gm`-Ereignisse zusammen auf 16.000 Zeichen begrenzt.

<a id="the-intro-message"></a>

### Die Intro-Nachricht

`intro` (Capability API 1.339) legt fest, wie das Spiel beginnt – dieselbe Wahl, die die GM-Einrichtung jedem Spiel bietet:

```json
"intro": { "mode": "defined", "text": "The leaves have not fallen in Hollowmere for nine years.", "locked": true }
```

Mit `"defined"` ist die erste Nachricht des Spiels genau `text`; der Game Master schreibt dafür nichts, und eine Neugenerierung liefert denselben Text. `"guided"` formt nur die Eröffnung, die der Game Master schreibt, als Leitlinie, die er allein für diese erste Antwort liest. `text` umfasst 1 bis 8.000 Zeichen und darf Zeilenumbrüche enthalten (als einziger Text in einer Story), aber nie `{{`; ein Text für `"guided"` darf außerdem keine eckigen Klammern enthalten. Mit `locked` sieht der Spieler das Intro in der GM-Einrichtung und kann es nicht ändern; ohne `locked` füllt das Intro nur das Feld der Einrichtung vor, und der Spieler darf es ändern oder leeren. Ein Spiel, dessen erste Antwort bereits geschrieben wurde oder das seine Gruppe aus einem früheren Spiel übernimmt, hat kein Intro. Eine Experience kann ihr Intro auch neben ihren anderen GM-Einrichtungswerten setzen (`contributions.gameSurface.setup.defaults.intro`, 1.372); dieses wird zuerst gelesen.

## So läuft eine Story ab

Einmal pro Zug, bevor der Game Master antwortet, liest die Engine, was die Story bisher bewirkt hat und was dieser Zug bringt (einen Weg, einen Besuch, das Ende eines Kampfes), und lässt die Ereignisse geschehen. Was geschieht, wird an den Anfang dieser Antwort geschrieben: ein Tag, das jedes Ereignis und die von ihm gesetzten Werte festhält, und jede Szene, die wie geschrieben gezeigt wird. Weil die Story aus den Antworten zurückgelesen wird, nimmt ein Swipe (eine alternative Antwort) oder eine Neugenerierung zurück, was die jeweilige Antwort bewirkt hat, und eine mitten im Spiel geänderte Story schreibt nie um, was bereits geschehen ist. Die Story wird in die nächste Sitzung des Spiels übernommen.

<a id="the-game-masters-tags"></a>

### Die Tags des Game Master

In jedem Zug erfährt der Game Master die Werte der Story (die vor dem Spieler verborgen sind) und die geltenden Anweisungen. Vom Rest des Skripts erfährt er nur, was das Skript ihm überlässt: die `gm`-Ereignisse (mit ihrer `note` und allen `beats`, die er mit ihnen erzählen soll) und die `gm`-Flags, außerdem, welche dieser Ereignisse er gerade nicht markieren kann (weil sie erledigt sind oder ihre Bedingungen sie zurückhalten). Er markiert sie in seiner Antwort:

- `[story: event="<id>"]` löst ein `gm`-Ereignis aus, dessen Bedingungen erfüllt sind (einmal, sofern es sich nicht wiederholt).
- `[story: flag="<id>" value="<value>"]` oder bei einem Zahlen-Flag `add="<number>"` setzt ein `gm`-Flag.

Gaben, Kampf und Bewegung eines `gm`-Ereignisses werden mit seinem Tag in die Antwort aufgenommen; seine Endszene und sein Epilog kommen am Anfang der nächsten Antwort.

Die Engine beantwortet jedes Tag an Ort und Stelle, ein Ereignis höchstens einmal pro Zug, und lehnt alles andere mit Begründung ab. In einem Spiel ohne Story wird jedes Story-Tag abgelehnt. Was der Game Master auslöst, wirkt sofort (die Flags und Taten des Ereignisses); dessen Szenen und Bitten kommen am Anfang der nächsten Antwort, ausgenommen seine `beats` (die der Game Master ja zusammen mit dem Moment erzählen sollte). Schreib die `pages` eines `gm`-Ereignisses als das, was auf den Moment folgt, denn den Moment selbst hat der Game Master bereits erzählt.

## Eine Story ausprobieren

Speichere sie mit `PUT /api/game/:chatId/story` und `{ "story": { ... } }` in einem Spiel: Eine Story, die nicht passt, wird mit allen Gründen abgelehnt. Der Tab **World** des Spiels listet die Ziele und Uhren auf, die die Story bereits angezeigt hat, und der Prompt des Game Master enthält in jedem Zug die Werte und Anweisungen der Story.
