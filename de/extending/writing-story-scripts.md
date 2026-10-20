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
  "cutscenes": []
}
```

IDs bestehen aus 1 bis 40 Kleinbuchstaben, Ziffern, `_` oder `-` und sind innerhalb ihrer Liste eindeutig. Eine Story enthält höchstens 64 Flags, 64 Anweisungen, 128 Ereignisse und 64 Zwischensequenzen. Kein Text darin darf einen Zeilenumbruch, eckige Klammern oder `{{` enthalten, und Namen, die in ein Tag geschrieben werden (eine Gruppe, ein Hintergrund), dürfen kein doppeltes Anführungszeichen enthalten: Nichts, was eine Story sagt, kann sich als eines der Tags des Game Master ausgeben.

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

Ein Ja-Nein-Ziel ist erfüllt, wenn sein Flag wahr ist; ein Zahlenziel, wenn sein Flag den Zielwert `goal` erreicht (1, wenn keiner angegeben ist). Ist ein `goal` eingetragen, zeigt das Journal den Fortschritt an. Ein Ziel mit `"hidden": true` bleibt im Journal verborgen, bis ein Ereignis es anzeigt.

### Anweisungen

Eine Anweisung richtet sich dauerhaft an den Game Master und gilt, solange ihre Bedingungen erfüllt sind:

```json
{ "id": "wary", "text": "The town is wary of strangers.", "if": [{ "flag": "trust", "is": "<", "value": 2 }] }
```

### Bedingungen

`{ "flag": "<id>", "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <value> }`. Alle Bedingungen einer `if`-Liste müssen erfüllt sein. Ein Ja-Nein-Flag wird nur mit `=` oder `!=` verglichen.

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
| `fight` | Wenn ein Kampf mit `outcome` endet: `victory`, `defeat` oder `flee`. |
| `broke` | Wenn ein Kampf das Requisit namens `prop` zerstört hat (Capability API 1.316); Groß-/Kleinschreibung spielt beim Vergleich keine Rolle. Nur ein Requisit, das auf eines der Schlachtfelder der Welt gemalt wurde, kann genannt werden. |
| `flags` | Wenn seine Bedingungen erfüllt sind. Mit `repeat` erneut jedes Mal, wenn sie erfüllt werden, nachdem sie es nicht waren. |
| `gm` | Nur wenn der Game Master es auslöst (das Ereignis braucht `"gm": true`). |
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

Eine Story vergibt keine Gegenstände, beginnt keine Kämpfe, bewegt die Gruppe nicht und beendet das Spiel nicht: Das bleibt Sache des Game Master und des Spielers. Bitte den Game Master mit `tell` darum.

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

Mit `"defined"` ist die erste Nachricht des Spiels genau `text`; der Game Master schreibt dafür nichts, und eine Neugenerierung liefert denselben Text. `"guided"` formt nur die Eröffnung, die der Game Master schreibt, als Leitlinie, die er allein für diese erste Antwort liest. `text` umfasst 1 bis 8.000 Zeichen und darf Zeilenumbrüche enthalten (als einziger Text in einer Story), aber nie `{{`; ein Text für `"guided"` darf außerdem keine eckigen Klammern enthalten. Mit `locked` sieht der Spieler das Intro in der GM-Einrichtung und kann es nicht ändern; ohne `locked` füllt das Intro nur das Feld der Einrichtung vor, und der Spieler darf es ändern oder leeren. Ein Spiel, dessen erste Antwort bereits geschrieben wurde oder das seine Gruppe aus einem früheren Spiel übernimmt, hat kein Intro.

## So läuft eine Story ab

Einmal pro Zug, bevor der Game Master antwortet, liest die Engine, was die Story bisher bewirkt hat und was dieser Zug bringt (einen Weg, einen Besuch, das Ende eines Kampfes), und lässt die Ereignisse geschehen. Was geschieht, wird an den Anfang dieser Antwort geschrieben: ein Tag, das jedes Ereignis und die von ihm gesetzten Werte festhält, und jede Szene, die wie geschrieben gezeigt wird. Weil die Story aus den Antworten zurückgelesen wird, nimmt ein Swipe (eine alternative Antwort) oder eine Neugenerierung zurück, was die jeweilige Antwort bewirkt hat, und eine mitten im Spiel geänderte Story schreibt nie um, was bereits geschehen ist. Die Story wird in die nächste Sitzung des Spiels übernommen.

<a id="the-game-masters-tags"></a>

### Die Tags des Game Master

In jedem Zug erfährt der Game Master die Werte der Story (die vor dem Spieler verborgen sind) und die geltenden Anweisungen. Vom Rest des Skripts erfährt er nur, was das Skript ihm überlässt: die `gm`-Ereignisse (mit ihrer `note` und allen `beats`, die er mit ihnen erzählen soll) und die `gm`-Flags, außerdem, welche dieser Ereignisse er gerade nicht markieren kann (weil sie erledigt sind oder ihre Bedingungen sie zurückhalten). Er markiert sie in seiner Antwort:

- `[story: event="<id>"]` löst ein `gm`-Ereignis aus, dessen Bedingungen erfüllt sind (einmal, sofern es sich nicht wiederholt).
- `[story: flag="<id>" value="<value>"]` oder bei einem Zahlen-Flag `add="<number>"` setzt ein `gm`-Flag.

Die Engine beantwortet jedes Tag an Ort und Stelle, ein Ereignis höchstens einmal pro Zug, und lehnt alles andere mit Begründung ab. In einem Spiel ohne Story wird jedes Story-Tag abgelehnt. Was der Game Master auslöst, wirkt sofort (die Flags und Taten des Ereignisses); dessen Szenen und Bitten kommen am Anfang der nächsten Antwort, ausgenommen seine `beats` (die der Game Master ja zusammen mit dem Moment erzählen sollte). Schreib die `pages` eines `gm`-Ereignisses als das, was auf den Moment folgt, denn den Moment selbst hat der Game Master bereits erzählt.

## Eine Story ausprobieren

Speichere sie mit `PUT /api/game/:chatId/story` und `{ "story": { ... } }` in einem Spiel: Eine Story, die nicht passt, wird mit allen Gründen abgelehnt. Der Tab **World** (Welt) des Spiels listet die Ziele auf, die die Story bereits angezeigt hat, und der Prompt des Game Master enthält in jedem Zug die Werte und Anweisungen der Story.
