# Charakterbögen im Regelsatz

Diese Seite gehört zu [Regelsätze für Game Mode schreiben](writing-rulesets.md). Was auf den Charakterbogen eines Regelsatzes gehört: Attribute, Fertigkeiten, Felder und Listen, Live-Zustände, Wundleisten, Abzüge, Rasten und der Text für den Game Master sowie der Gruppenbogen und Fortschrittsuhren.

## Der Bogen

- `sections` gruppiert die Einträge im Editor. Felder, abgeleitete Werte und Listen nennen mit `section` den Abschnitt, in dem sie stehen; Attribute, Fertigkeiten und Rettungswürfe dürfen das ebenfalls. Der Editor, der Bogen im Spiel und der Bogenblock des Game Master zeigen sie dann unter dieser Überschrift. Ein Bogen, der bei ihnen keinen Abschnitt nennt, zeigt sie genau wie bisher. Ein Abschnitt kann außerdem eine `untrained`-Regel tragen (siehe unten).
- `abilities` enthält die Grundwerte. `skills` und `saves` können jeweils das Attribut nennen, mit dem sie würfeln, sowie ein `cap` und eine `untrained`-Regel (siehe unten).
- `fields` enthält einzelne Werte. Typen: `number`, `text`, `longtext`, `boolean`, `enum` (eine feste Auswahlliste) und `dice` (Text wie `1d8`). Ein `text`-Feld oder eine Listenspalte kann `suggestions` ergänzen (Capability API 1.796): bis zu 40 Wörter, die darunter als Chips angeboten werden. Jedes wird dem bereits geschriebenen Text hinzugefügt; das Feld lässt sich weiterhin frei ausfüllen, etwa mit den bevorzugten Feinden eines Waldläufers aus den Kreaturentypen. Ein solches Feld kann mit `pick` auch die Anzahl der auszuwählenden Einträge angeben (Capability API 1.797), einen vom Bogen gelesenen Wert, etwa eine abgeleitete Anzahl, die mit der Klassenstufe steigt: Der Editor zeigt „Choose N“ und die Anzahl der ausgewählten Einträge an und bietet keine weiteren Chips mehr an, sobald N ausgewählt sind. Eingegebener Text wird jedoch nie abgelehnt.
- `derived`-Werte werden aus anderen Werten berechnet und können nicht überschrieben werden. Ein Bogen darf bis zu 800 davon haben (Capability API 1.729; 400 ab 1.111, 240 ab 1.88, 120 ab 1.84, davor 60); ein Paket mit mehr als 240 deklariert 1.111 und eines mit mehr als 400 deklariert 1.729. Die Operationen sind `sum`, `min`, `max`, `scale` (mit einer festen Zahl multiplizieren und runden), `multiply` (zwei bis sechs Werte miteinander multipliziert, etwa ein Constitution-Modifikator mal die Stufe; Capability API 1.82), `stepTable` (einen Wert in Schwellen nachschlagen, etwa den Übungsbonus anhand der Stufe) und `enumTable` (eine Zahl für jeden Wert eines Enum-Felds oder eines Live-Zustands; siehe unten „Live-Zustände“).
- `lists` enthält Tabellen mit eigenen Spalten, etwa für Ausrüstung, Zauber oder Merkmale. Eine Liste hat bis zu 24 Spalten; ein Paket mit einer Liste von mehr als 12 Spalten deklariert Capability API 1.165. Eine Liste mit `pools` macht jede Zeile zu einer Ressource mit eigenem Maximum, etwa für Klassenmerkmale mit begrenzten Nutzungen. Eine Zahlenspalte kann durch einen Wurf gefüllt werden: `"roll": { "count": 1, "sides": 8 }`, wobei `sides` eine Zahl ist, eine andere Spalte derselben Zeile (`{ "column": "die" }`, eine Zahlenspalte oder ein Enum, dessen Werte sich als Würfel wie `d8` lesen) oder ein Wert vom Bogen. Der Bogeneditor zeigt eine Roll-Schaltfläche, die die eigenen Würfel der Engine wirft und die Summe einträgt, begrenzt auf `min` und `max` der Spalte (Capability API 1.85).
- `live` enthält, was sich im Spiel verändert: `pools` (Trefferpunkte, Zauberplätze, Grit), `tracks` (eine Zahl auf einer Skala, etwa Erschöpfung, oder eine Wundleiste mit ankreuzbaren Kästchen), `text` (kurze Notizen, etwa zur Konzentration eines Charakters), `conditions` und `states` (ein Wert aus einer geschlossenen Menge, etwa eine Gestalt oder eine Haltung).

Alles, was eine Zahl liest, benennt sie über einen Wertverweis: ein Objekt mit genau einem Schlüssel aus `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod`, `saveMod`, `listSum`, `livePool`, `liveTrack` oder `itemStat`. Beispiel für einen Pool mit abgeleitetem Maximum: `"max": { "derived": "grit_max" }`.

- `listSum` addiert eine Zahlenspalte einer Liste: `{ "listSum": { "list": "gear", "column": "bulk", "onlyWhen": "packed" } }`. `onlyWhen` ist optional und nennt eine boolesche Spalte; nur die Zeilen, in denen sie gesetzt ist, zählen. Eine leere Zelle zählt mit dem Standardwert ihrer Spalte, und eine von `hideWhen` ausgeblendete Liste trägt nichts bei. Ember Roads berechnet so Burden aus der Ausrüstung, die ein Charakter eingepackt hat. Anders als eine eingetippte Zahl kann der Wert dadurch nie von der Liste abweichen. Die skalierte Spalte eines Katalogs kann keine Listensumme lesen, auch nicht über einen abgeleiteten Wert: Eine Liste kann skalierte Zellen enthalten, eigene oder solche, die die Summe zurücklesen, und die Neuberechnung käme nie zur Ruhe.
- `livePool` liest, was in einem deiner `live.pools` übrig ist (der Pool einer Listenzeile gehört nicht dazu). `liveTrack` liest eine deiner `live.tracks`, mit einem optionalen `read`: `"value"`, ihr aktueller Stand (Standard); `"filled"`, wie weit sie über ihrem `min` steht; `"remaining"`, wie weit sie unter ihrem `max` steht; oder, nur bei einer Wundleiste, `"penalty"`, der geltende Abzug. Ein ausgeblendeter Pool und eine ausgeblendete Leiste lesen 0. „Harm still to take“ in Gravewatch ist `{ "liveTrack": "harm", "read": "remaining" }`.
- Ein Live-Lesezugriff liest den Live-Zustand so, wie er steht, wenn eine Probe gewürfelt wird, ein Kampf beginnt oder der Bogenblock des Game Master geschrieben wird. Gibt es noch keinen (im Bogeneditor, in einer Importprüfung), liest er den Zustand, mit dem das Spiel beginnt: einen Pool voll oder leer, wie es sein `start` vorgibt, eine Leiste auf ihrem `default`, eine Wundleiste ohne Markierung.
- Nichts, was berechnet wird, bevor es einen Live-Zustand gibt, darf einen lesen: das `max` eines Pools oder einer Leiste, der Übungsbonus sowie die skalierte Spalte oder Skalierung eines Katalogs. Das gilt auch über einen abgeleiteten Wert, der einen liest, und über eine Fertigkeit, die ein Live-Wert begrenzt. Der Import nennt den Wert, der das tut.
- Bei einem als Paket ausgelieferten Regelsatz brauchen diese drei Capability API 1.39.
- `itemStat` liest die Gegenstände, die der Charakter besitzt, etwa den Guard-Wert der getragenen Rüstung, und unterliegt derselben Regel wie ein Live-Lesezugriff. Siehe [Gegenstände auf dem Bogen](ruleset-items.md#items-on-the-sheet). Capability API 1.52.

**Was eine Probe ohne Ausbildung tut.** Eine Fertigkeit oder ein Rettungswurf, in dem der Charakter keine Ausbildung hat (seine Stufe ist die erste), wird wie gewohnt gewürfelt, sofern der Regelsatz nichts anderes sagt. Das geschieht mit `untrained` an der Fertigkeit, am Rettungswurf oder an dem Abschnitt, in dem sie stehen; die eigene Regel der Fertigkeit oder des Rettungswurfs hat Vorrang:

```json
"sections": [{ "id": "labour", "label": "Labour", "untrained": { "by": -1 } }],
"skills": [
  { "id": "dig", "label": "Dig", "ability": "sinew", "section": "labour", "untrained": "refuse" },
  { "id": "listen", "label": "Listen", "ability": "nerve", "untrained": "harder" }
]
```

- `"normal"`: wie gewohnt (Standard).
- `{ "by": -3 }`: wird zur Zahl der Probe addiert, von -20 bis 20: Würfel bei einem Pool, ein fester Betrag bei einer Summe. Der Wert gehört zu der Zahl, die der Bogen zeigt und mit der jede Probe würfelt, und gilt vor einem etwaigen `cap`.
- `"harder"`: eine Stufe schwerer. Bei einem Pool steigt der Zielwert je Würfel um eins (und bleibt innerhalb seines Bereichs). Das braucht also einen Pool-Regelsatz mit veränderlichem Zielwert; überall sonst wird es beim Import abgelehnt, weil es nie einen Wurf verändern könnte.
- `"refuse"`: Die Probe wird gar nicht gewürfelt. Die Engine schreibt die Anforderung des Game Master mit `reason="untrained"` zurück, und damit ist sie erledigt: Nichts würfelt sie später, der Game Master erfährt, dass der Charakter sie nicht versuchen konnte, und die Erzählung sagt das. Der Endpunkt für Fertigkeitsproben beantwortet eine solche Probe mit 400 (`skill_check_untrained`), und eine Verzweigung daraus übernimmt keine der beiden Hälften. Der Bogeneditor zeigt dafür keine Zahl.
- Für einen Charakter ohne Bogen gibt es keine Ausbildung zu lesen; für ihn gilt daher keine Regel für fehlende Ausbildung.
- Die Erinnerung für den Game Master listet die Regeln für fehlende Ausbildung nach Abschnitt oder Fertigkeit auf, damit er nur Proben verlangt, die ein Charakter ablegen kann.

Abschnitte an Attributen, Fertigkeiten und Rettungswürfen sowie `untrained` an beliebiger Stelle brauchen bei einem als Paket ausgelieferten Regelsatz Capability API 1.41.

Eine Fertigkeit oder ein Rettungswurf kann ein `cap` tragen: einen Wertverweis auf das Höchste, was ihre Probe je ergeben darf – einen Wert, über den sie nicht hinauswachsen kann, oder eine Leiste, die sie niederhält. Gravewatch begrenzt Soothe auf das verbleibende Resolve eines Wächters: `"cap": { "livePool": "resolve" }`. Die begrenzte Zahl zeigt der Bogen, und mit ihr würfelt jede Probe. Ein Tausch mit `with=` wird mit der Zahl vor der Begrenzung berechnet und danach erneut begrenzt. Eine solche Obergrenze kann keinen Fertigkeits- oder Rettungswurfmodifikator lesen, ebenso wenig der abgeleitete Wert, den sie liest, oder ein davor deklarierter abgeleiteter Wert. So wird der Bogen weiterhin einmal von oben nach unten berechnet. Capability API 1.39.

`hideWhen` blendet ein Feld, einen abgeleiteten Wert, eine Liste, einen Pool oder eine einfache Leiste anhand des Werts eines anderen Feldes aus, und zwar auf genau eine von drei Arten: `equals` einem Wert, `notEquals` einem Wert (ausgeblendet, sobald das Feld etwas anderes enthält; so drückt man „nur für diese Art Charakter“ aus) oder `in` einer Liste von Werten. Jeder genannte Wert muss einer sein, den das Feld annehmen kann, sonst könnte die Regel nie zutreffen. Das wird Wert für Wert geprüft; bei `notEquals` und `in` gehören dazu auch der Bereich eines Zahlenfelds und die Länge eines Textfelds. Die Regel liest den Wert, den der Bogeneditor zeigt: Ein nicht gesetztes Feld hat den Wert, mit dem ein leerer Bogen beginnt, und ein Enum-Wert, den der Regelsatz nicht mehr anbietet, gilt als Standardwert des Feldes. Die 5e-Datei blendet mit `equals` Zauberplätze bei Charakteren ohne Zauber aus. Gravewatch hält Lampenöl mit `"hideWhen": { "field": "watch", "notEquals": "night" }` vom Bogen jedes Wächters fern, der nicht zur Nachtwache gehört. Eine Ebene kann keinen Wert entfernen, mit dem eine dieser Regeln vergleicht. Eine Wundleiste kann nicht ausgeblendet werden, weil Würfe und Kämpfe sie unabhängig von der Anzeige des Bogens lesen. `notEquals` und `in` brauchen Capability API 1.39.

Das `max` einer einfachen Leiste darf statt einer Zahl ein Wertverweis sein; ein Wert des Charakters legt dann fest, wie weit sie reicht: `"max": { "field": "willpower_rating" }`. `min` und `default` bleiben Zahlen. Eine Wundleiste mit benannten Stufen hat ein `max` gleich der Anzahl ihrer Stufen; eine Leiste mit nummerierten Kästchen ist so lang wie ihr eigenes `max` (siehe unten „Nummerierte Kästchen“). `alwaysShow: true` gibt eine Leiste auch auf ihrem Standardwert im Bogenblock des Game Master aus, für einen Wert, der in jedem Zug zählt. Ohne diese Angabe wird eine Leiste auf ihrem Standardwert weggelassen, weil drei Todesrettungswürfe auf null nichts aussagen. Bei einem als Paket ausgelieferten Regelsatz brauchen diese drei Capability API 1.37.

## Live-Zustände: Eine Gestalt, eine Haltung, ein Licht

Ein Enum-Feld wird beim Erstellen eines Charakters gewählt und bleibt dann so, und ein Zustand ist nur an oder aus. Ein **Live-Zustand** ist dagegen ein Wert aus einer geschlossenen Menge, der sich im Spiel ändert: die Gestalt eines Gestaltwandlers, eine Kampfhaltung, wie hell eine Laterne brennt.

```json
"live": {
  "states": [
    {
      "id": "stance",
      "label": "Stance",
      "values": ["guarded", "steady", "reckless"],
      "valueLabels": { "guarded": "Guarded", "steady": "Steady", "reckless": "Reckless" },
      "default": "steady"
    }
  ]
}
```

- `values` sind zwei bis vierzig Werte, jeweils angezeigt als ihr Eintrag in `valueLabels` oder als der Wert selbst. Sie folgen der Regel für jede Beschriftung (eine Zeile, keine eckigen Klammern, keine Makro-Klammern) und enthalten nie ein doppeltes Anführungszeichen, weil der Bogenbefehl sie in Anführungszeichen setzt. Bis zu zwölf Live-Zustände.
- `default` ist der Startwert jedes Bogens; ohne Angabe ist es der erste Wert. Gespeichert wird nur ein Live-Zustand, der von seinem Standardwert abweicht, und ein gespeicherter Wert, den der Live-Zustand nicht mehr anbietet, gilt als Standardwert.
- `hideWhen` nimmt einen Live-Zustand anhand eines Feldwerts vom Bogen, wie bei einem Pool: Er wird nicht angezeigt, durch keinen Befehl gesetzt und von einer Tabelle (siehe unten) als gar kein Wert gelesen.
- Der Game Master setzt einen mit `[sheet: who="Name" op="state" state="Stance" value="Reckless"]`. Den Live-Zustand nennt er per ID oder Beschriftung, den Wert direkt oder per Beschriftung. Ein Live-Zustand oder ein Wert, den der Bogen nicht hat, wird abgelehnt (`unknown-state`, `unknown-value`). Die Engine bringt dem Game Master den Befehl nur bei und listet jeden Wert nur auf, wenn dein Regelsatz einen Live-Zustand hat. Jeder Bogenblock nennt den Wert jedes Live-Zustands, auch den Standardwert, denn „in menschlicher Gestalt“ ist eine Tatsache, die die Erzählung in jedem Zug braucht.
- Der Bogenbildschirm des Spiels zeigt für jeden Live-Zustand eine Auswahl.
- Eine Rast setzt einen mit einem Wiederherstellungsschritt zurück, der ihn nennt: `{ "state": "stance", "to": "default" }` oder `"to"` mit einem seiner Werte.

**Zahlen, die folgen.** Ein abgeleiteter Wert mit `"op": "enumTable"` liefert eine Zahl für jeden Wert eines Enum-Felds oder eines Live-Zustands:

```json
{
  "id": "stance_brawn",
  "label": "Stance on Brawn",
  "op": "enumTable",
  "from": { "liveState": "stance" },
  "table": { "guarded": -1, "reckless": 2 },
  "default": 0
}
```

- `from` nennt genau eines von `field` (ein Enum-Feld) oder `liveState`. Jede Zeile von `table` ist ein Wert, den dieses annehmen kann, eine bis vierzig davon. Ein von der Tabelle ausgelassener Wert und ein vom Bogen ausgeblendeter Live-Zustand lesen `default` (0, wenn du ihn weglässt).
- Ein Feld steht fest, sobald der Charakter erstellt ist. Eine darauf beruhende Tabelle darf daher ein Maximum speisen: Gravewatch gibt einem Wächter der Morgenwache ein Resolve mehr. Ein Live-Zustand ändert sich im Spiel. Eine darauf beruhende Tabelle ist daher wie `liveTrack` ein Live-Lesezugriff: Nichts, was berechnet wird, bevor es einen Live-Zustand gibt, darf sie lesen, weder direkt noch über einen anderen abgeleiteten Wert. Deshalb heißt der Schlüssel `liveState` und nicht `state`: Jeder Lesezugriff auf den Live-Zustand trägt `live` im Namen. Daran erkennen du und der Import, was ein Maximum nicht verwenden darf.
- Um die Zahl auf die Würfel zu bringen, verweise mit `resolution.adjust` darauf (siehe „Modifikatoren vom Bogen“). Ember Roads addiert seine Stance zu jedem Brawn-Wurf; Gravewatch zieht eine abgeblendete oder dunkle Laterne von jedem Nerve-Wurf ab.
- Eine Ebene darf aus einem Feld einen Wert entfernen, für den eine Tabelle eine Zeile hat. Solange die Ebene aktiv ist, wird diese Zeile einfach nie gelesen.

Live-Zustände, `enumTable` und ein Rast-Schritt, der einen `state` nennt, brauchen bei einem als Paket ausgelieferten Regelsatz Capability API 1.42.

<a id="wound-tracks-health-that-is-a-track-not-a-number"></a>

## Wundleisten: Gesundheit als Leiste statt als Zahl

Viele Systeme zählen überhaupt keine Trefferpunkte. Sie haben eine Spalte aus Kästchen, jedes schlimmer als das vorige, und bei einer Verletzung wird eines markiert. Gib einem Eintrag in `live.tracks` die Angabe `kinds` und entweder benannte `levels` oder nummerierte `boxes` (siehe unten); damit wird aus einer Zahl auf einer Skala eine solche Leiste:

**Welche Form braucht dein System?** Ein Pool erfasst, WIE VIEL Schaden ankam. Eine Leiste erfasst die Menge UND die Art jeder einzelnen Verletzung. Wenn dein System zwischen Schlagschaden, tödlichem und schwer heilbarem Schaden unterscheidet und die Art nach dem Treffer weiter wichtig ist – weil schwer heilbarer Schaden langsamer heilt, nicht absorbiert werden kann oder schließlich tötet –, muss diese Art nach dem Wurf irgendwo gespeichert bleiben. Das kann nur eine Markierung. Ein Punktepool kann es nicht: Nach dem Abzug bleibt nur eine kleinere Zahl, und der Bogen weiß nicht mehr, welche Punkte welche Art hatten. Deshalb wird `combat.damageKinds` bei Gesundheit als Pool abgelehnt, statt still ignoriert. Ein Pool kann weiterhin `damageTypes` haben, gegen die ein Gegner resistent oder immun ist. Dabei geht es um die Menge des ankommenden Schadens, nicht um die Art der danach verbleibenden Wunde.

```json
{
  "id": "harm",
  "label": "Harm",
  "min": 0,
  "max": 4,
  "levels": [
    { "label": "Scuffed", "penalty": 0 },
    { "label": "Winded", "penalty": -1 },
    { "label": "Bleeding", "penalty": -3 },
    { "label": "Down", "penalty": -99 }
  ],
  "kinds": [
    { "id": "knock", "label": "K", "severity": 0 },
    { "id": "tear", "label": "T", "severity": 1 }
  ]
}
```

- `levels` enthält 1 bis 16 Stufen, die beste zuerst und die schlechteste zuletzt. Jede hat ein `label` und einen ganzzahligen `penalty` von höchstens 0. Eine große negative Zahl bedeutet in solchen Systemen "du bist außer Gefecht"; `-99` ist also erlaubt.
- `kinds` enthält 1 bis 6 Schadensarten, die die Leiste aufnehmen kann, jeweils mit `id`, kurzem `label` für das Kästchen und `severity`. Die Schweregrade müssen unterschiedlich sein. Ihre Zahlen legen nur die Reihenfolge fest; die Abstände kannst du frei wählen.
- Beides gehört zusammen. `kinds` ohne `levels` oder `boxes` wird abgelehnt, weil es nichts zu markieren gäbe. `levels` oder `boxes` ohne `kinds` wird abgelehnt, weil jede Markierung eine Art braucht. Eine Leiste hat `levels` oder `boxes`, nie beides.
- **Trenne die beiden Begriffe.** `kinds` definiert, was eine Markierung laut Regelsatz SEIN darf. Eine MARKIERUNG ist eine dieser Arten auf der Leiste während des Spiels. Die Definition enthält Arten; der Charakterbogen enthält Markierungen.
- Eine Wundleiste beginnt ohne Markierung; ihr `min` ist daher 0. Eine Leiste mit benannten Stufen ist so lang wie ihre Stufen, ihr `max` ist also `levels.length`. Eine anderslautende Datei wird abgelehnt statt still korrigiert, damit sie niemals zwei widersprüchliche Längen enthält. Eine Leiste mit Kästchen ist so lang wie ihr eigenes `max`, das ein vom Bogen berechneter Wert sein darf (siehe unten „Nummerierte Kästchen“).

**Die genauen Regeln**, denn eine ungenaue Auslegung führt zur falschen Leiste:

- Markierungen bleiben sortiert, **die schwerste zuerst**. Eine Leiste mit sieben Stufen hält höchstens sieben Markierungen.
- Eine Markierung wird **nach Schweregrad einsortiert**, niemals einfach hinten angehängt. Sie nimmt die höchste ihrem Schweregrad zustehende Position ein und schiebt leichtere Markierungen nach unten.
- Es gilt der Abzug der **untersten markierten Stufe**, niemals die Summe der markierten Stufen. Drei Markierungen auf der obigen Leiste ergeben `-3`, nicht `0 + -1 + -3`.
- `amount` nennt eine Anzahl Markierungen einer Art, die **einzeln nacheinander angewendet** werden. Eine währenddessen voll werdende Leiste folgt damit derselben Regel wie eine schon vorher volle.
- Eine Markierung auf einer **vollen** Leiste **erhöht deren leichteste Markierung um eine Stufe**, statt eine weitere hinzuzufügen: genau eine Stufe auf deiner eigenen Rangfolge der Schadensarten, unabhängig von der neu hinzukommenden Art.
- Eine Markierung, die über den höchsten Schweregrad hinaus erhöht würde, bleibt beim höchsten. Die nicht mehr untergebrachte Markierung zählt als **Überlauf**. Dieser wird gespeichert, damit ein Neuladen bereits erlittenen Schaden nicht vergisst.
- **Heilung verwendet denselben Befehl mit negativer Menge.** Sie entfernt den Überlauf vor jeder Markierung. Eine Heilung, die eine der Arten der Leiste nennt, entfernt nur Markierungen dieser Art. „Der Schlagschaden heilt, der tödliche bleibt“ ist also `kind="bashing"` mit negativer Menge. Eine Heilung, die keine Art der Leiste nennt, entfernt zuerst die leichtesten Markierungen.

**Im Spiel markieren.** Der Game Master schreibt `[sheet: op="damage" track="harm" kind="knock" amount="1"]` und heilt mit negativem `amount`. Bei einer Leiste, die nach Kästchen gefüllt wird, ergänzt er `box="3"` für das Kästchen, auf das der Treffer fällt. Die Pool-Form von `damage`, die stattdessen `pool=` nennt, bleibt unverändert. Der einfache `track`-Befehl wird für Wundleisten abgelehnt: Eine bloße Zahl kann die Art der neuen Markierungen nicht nennen. Spieler können Kästchen auch von Hand auf dem Bogen markieren und leeren, wie es solche Systeme vorsehen.

**Auch ein Kampf kann eine Wundleiste markieren.** Verweise mit `combat.health` auf die Leiste statt auf einen Pool. Ein ankommender Treffer markiert dann so viele Kästchen, wie `combat.damageKinds.marks` vorgibt, und verwendet die Art, auf die dieser Block den Schadenstyp abbildet. Ein Charakter mit voller Leiste geht zu Boden; das liest deine Sterberegel. Bei einer Leiste, die nach Kästchen gefüllt wird, nennt `per-point`-Schaden das Kästchen, auf das er fällt, und `per-blow` zielt auf das erste. Ein Treffer, den kein Kästchen mehr aufnehmen kann, schickt den Charakter zu Boden – genau das bedeutet Ausgeschaltetsein in den Systemen mit einer solchen Leiste. Heilung entfernt eine Markierung, die leichteste, gleich welcher Art. Temporäre Punkte werden abgelehnt, weil eine Leiste keinen Puffer dafür hat. Die Engine liest eine Leiste als ihre VERBLEIBENDEN Stufen. Alles andere am Kampf – zu Boden gehen, wiederbelebt werden, Protokoll und Rückblick – bleibt dadurch unverändert.

**Eine Rast kann eine Wundleiste heilen.** Ein Wiederherstellungsschritt mit `"to"` reduziert sie einschließlich Überlauf auf so viele Markierungen. Ein Schritt mit NEGATIVEM `"by"` entfernt die genannte Anzahl, zuerst den Überlauf; `"by": { "const": -2 }` entfernt also zwei. Ein Schritt, der zusätzlich eine `kind` nennt, entfernt nur Markierungen dieser Art: „Catch your breath“ in Gravewatch ist `{ "track": "harm", "kind": "knock", "to": "min" }`; das heilt die Knock-Markierungen und lässt die Tear-Markierungen stehen. Ein Schritt, der Markierungen HINZUFÜGEN würde, tut nichts, weil eine Rast keinen Schaden markiert. Das gilt auch für ein positives `"by"`: Es wird kommentarlos übersprungen. Schreib also das Minuszeichen.

### Nummerierte Kästchen statt benannter Stufen

Ist eine Leiste so lang, wie ein Charakter zäh ist, gib ihr `boxes` statt `levels`. Sie hat so viele Kästchen wie ihr eigenes `max`, höchstens 64. Dieser Wert darf vom Bogen berechnet werden, aber nie den Live-Zustand lesen:

```json
{
  "id": "strain",
  "label": "Strain",
  "min": 0,
  "max": { "derived": "strain_boxes" },
  "boxes": {
    "penalty": {
      "by": "remaining",
      "table": [
        [0, -1],
        [1, 0]
      ]
    }
  },
  "kinds": [{ "id": "strain", "label": "S", "severity": 0 }],
  "fill": "indexed",
  "onFull": "refuse"
}
```

- Der geltende Abzug wird in `table` nachgeschlagen (eine Stufentabelle wie bei einem abgeleiteten Wert, mit Abzügen von höchstens 0), und zwar bei der Zahl der markierten (`filled`) oder freien (`remaining`) Kästchen, wie hoch sie auch ist. Eine Tabelle kann also auch ohne jede Markierung etwas kosten. Welche Kästchen markiert sind, spielt für den Abzug keine Rolle.
- Die Kästchen sind nummeriert: Der Bogen zeigt „Box 3“, und der Bogenblock des Game Master nennt, wie viele von wie vielen markiert sind, statt eine Stufe zu nennen.

### Füllen nach Kästchen und Leisten, die ablehnen

- `"fill": "indexed"` setzt eine Markierung auf das Kästchen, das der Befehl mit `box=` nennt (ohne Angabe auf das erste), oder auf das nächste freie darüber, und verschiebt eine gesetzte Markierung nie. Eine Heilung entfernt die höchste der leichtesten Markierungen. Auf dem Bogenbildschirm kann ein Spieler jedes freie Kästchen anklicken.
- `"onFull": "refuse"` lehnt eine Markierung ab, für die kein Kästchen frei ist, statt die leichteste Markierung zu erhöhen. Abgelehnt wird der gesamte Befehl: Drei Markierungen bei zwei freien Kästchen setzen gar keine. Eine Leiste, die nach Kästchen gefüllt wird, lehnt immer ab; gib das mit `"onFull": "refuse"` daneben an.

### Stufen, die eine Liste hinzufügt

`"extra": { "list": "scars", "countColumn": "levels", "penaltyColumn": "penalty" }` an einer Leiste mit benannten Stufen lässt eine Liste auf dem Bogen sie je Charakter verlängern. Jede Zeile fügt der Reihe nach ihre Anzahl an Stufen (höchstens 16) mit ihrem Abzug hinzu, und zwar hinter der letzten Stufe, deren Abzug mindestens genauso gut ist. Stimmen die Abzüge überein, werden die neuen Stufen nach dieser Stufe benannt, sonst nach ihrem Abzug. Die Narben in Gravewatch funktionieren so. Eine vom Bogen ausgeblendete Liste fügt nichts hinzu. Wird eine Zeile gelöscht, während ihre Stufen markiert sind, bleiben die nicht mehr passenden Markierungen als Überlauf erhalten: Schaden wird nicht durch Bearbeiten des Bogens rückgängig gemacht.

`boxes`, `fill`, `onFull`, `extra` und die `kind` eines Rast-Schritts brauchen bei einem als Paket ausgelieferten Regelsatz Capability API 1.40.

## Der Abzug auf deine Würfe

`resolution.penaltyFrom` nennt die Wundleiste, deren Abzug für jede Probe dieses Regelsatzes gilt. Die Angabe wird deklariert, nicht vorausgesetzt. Ohne sie würfelt ein Regelsatz daher genauso wie vor der Einführung von Wundleisten.

Was der Abzug BEWIRKT, bestimmt wie beim eigenen Bogenwert die Auflösungsart:

- Bei `dice-pool` werden **Würfel aus dem Pool entfernt**, höchstens bis zu deinem `pool.min`. Bei `pool.min` gleich 1 wirft selbst ein Charakter auf der untersten Stufe einen Würfel. Bei `pool.min` gleich 0 wirft er keinen und scheitert ohne Wurf.
- Bei `dice-sum` gilt ein **fester Modifikator auf den Wurf**, verrechnet mit derselben Zahl, die bereits Attribut und Ausbildung addieren.

Die genannte Leiste muss eine Wundleiste sein. Eine einfache Zahlenleiste hat keinen anzuwendenden Abzug; ein Verweis darauf wird beim Import abgelehnt. Das Ergebnis nennt den angewendeten Abzug, damit Spieler die kleinere Würfelanzahl nachvollziehen können. Auch der Bogenblock des Game Master zeigt die Stufe und ihren Abzug.

## Modifikatoren vom Bogen

Manche Zahlen auf einem Bogen fahren bei jedem Wurf mit, den sie betreffen: ein schwerer Rucksack bei jedem Klettern, ein Rüstungsabzug bei jedem Schleichen, ein Segen bei allem. `resolution.adjust` drückt das bei beiden Auflösungsarten aus:

```json
"adjust": [{ "value": { "derived": "burdened" }, "abilities": ["brawn"] }]
```

- `value` ist ein Wert vom Bogen in derselben Form, die ein abgeleiteter Wert liest, einschließlich des Live-Zustands. Eine negative Zahl zieht ab. Ember Roads addiert den Bulk-Wert der eingepackten Ausrüstung eines Charakters zu Burden, und eine Stufentabelle macht aus je drei Punkten davon einen Abzug von eins auf jeden Brawn-Wurf. Über eine Tabelle, die auf einem Live-Zustand beruht, wirkt sich eine Gestalt oder Haltung auf die Würfel aus (siehe „Live-Zustände“).
- `abilities` ist optional. Mit dieser Angabe gilt der Modifikator nur für eine Probe, die mit einem dieser Attribute würfelt: das Attribut selbst, eine Fertigkeit oder ein Rettungswurf mit diesem Attribut, eine per `with=` damit gewürfelte Fertigkeit oder ein Attributspaar, das es enthält. Ohne die Angabe gilt er für jede Probe.
- Er wird dort angewendet, wo auch der Wundabzug gilt: als Würfel bei einem Pool, mit derselben Untergrenze `pool.min`, und als feste Zahl bei einer Summe, innerhalb des Modifikators, den der Datensatz zusammenzählt. Bis zu acht Einträge, die für jede Probe addiert werden.
- Ein Regelsatzkampf addiert ihn zu Kampfbeginn zu jedem Wurf, den er aus einem Bogen bildet: Ein mit einem Attribut oder einer Fertigkeit gewürfelter Angriff, ein Rettungswurf sowie eine Probe in einer vergleichenden Probe und eine Initiative, die aus einem Attribut, einer Fertigkeit oder einem Rettungswurf gelesen werden, erhalten die Einträge für dieses Attribut. Alles andere, was gewürfelt wird, erhält nur die Einträge für jeden Wurf.
- Ein Charakter ohne Bogen erhält nichts davon, genauso wie er keinen Modifikator erhält.

Das Ergebnis nennt, was der Bogen hinzugefügt hat (`adjust="-2"` im Datensatz und eine Zeile auf der Würfelkarte), damit Spieler nachvollziehen können, warum ein Wurf so ausgefallen ist. Bei einem als Paket ausgelieferten Regelsatz braucht das Capability API 1.38.

## Rasten

Eine Rast ist eine Liste von Wiederherstellungsschritten und zu entfernenden Dingen. Jeder Schritt nennt genau ein Ziel (`pool`, `poolGroup`, `listPools`, `track` oder `state`) und setzt es entweder auf einen Wert (`"to": "max"`, `"to": "min"` oder eine Zahl) oder verändert es (`"by": { "const": 1 }` oder `"by": { "fractionOfMax": 0.5 }`). Ein Schritt für eine Wundleiste kann sie nur heilen, sein `by` ist daher negativ; siehe oben. Ein Schritt für einen Live-Zustand setzt ihn nur, und zwar auf `"default"` oder einen seiner Werte. Ein `poolGroup`-Schritt mit `fractionOfMax` verändert jeden Pool der Gruppe um seinen eigenen Anteil. Mit `"shared": true` (Capability API 1.77) wird der Anteil stattdessen aus dem Maximum der ganzen Gruppe berechnet und in der Reihenfolge, in der der Bogen die Pools auflistet, auf die Pools der Gruppe verteilt, jeder bis zu dem, was ihm fehlt. Die lange Rast in 5e, „die Hälfte der Gesamtzahl der“ Trefferwürfel des Charakters, gehalten in einem Pool pro Würfeltyp, ist `{ "poolGroup": "hit_dice", "by": { "fractionOfMax": 0.5, "round": "down", "min": 1 }, "shared": true }`.

## Text für den Game Master

- `checkGuidance` ersetzt den eingebauten Absatz, der dem Game Master erklärt, wie er eine Probe anfordert. Nenne das System und beschreibe, wann gewürfelt werden soll. Der Game Master nennt nur Fertigkeit und Schwierigkeit. Die Engine würfelt und rechnet anhand des Bogens; fordere das Modell deshalb nicht zum Rechnen auf.
- `sheetGuidance` stellt die Charakterbögen im Prompt vor. Erkläre darin, welche Ressourcen wichtig sind und wann sie verbraucht werden sollen.
- `worldGuidance` ist optional und wird einmal bei der Welterzeugung gelesen. So passt die vom Game Master erfundene Welt zu deinen Regeln: kein Schießpulver, seltene Magie, wandelnde Tote. Der Text gelangt nie in einen Zug.
- `opposition` legt fest, wer die andere Seite eines Kampfes spielt (Capability API 1.774). `"game-master"` überlässt jeden Zug eines Gegners dem Game Master, der eine der von der Engine angebotenen Optionen wählt. Antwortet er nicht, übernimmt die eigene Auswahlsteuerung der Engine. Das gilt nur in einem Spiel, dessen Spieler dem Game Master erlaubt hat, Bosse zu spielen, und in jedem Kampfstil, einschließlich eines Kampfes im Stil Classic oder Tactical für einen Regelsatz ohne `combat`-Block. Nutze das für ein erzählerisches System, dessen Gegenseite nach der Fiktion statt nach der Schadenssumme gespielt wird: Fate, Blades in the Dark, Trophy, Lasers & Feelings. `"engine"` oder das Weglassen der Angabe behält die Auswahlsteuerung der Engine bei; Bosse (und auf Wunsch des Spielers auch benannte und genial denkende Gegner) übernimmt der Game Master. Ein Regelsatz, der den Schlüssel verwendet, braucht Capability API 1.774.
- `sheetSummary` wählt die Felder, abgeleiteten Werte und Listenzeilen, die der Game Master pro Charakter sieht. Die Engine zeigt immer Attributsmodifikatoren, ausgebildete Fertigkeiten und Rettungswürfe sowie laufende Werte. Halte den Rest kurz, denn er wird in jedem Zug gesendet. Die `nameColumn` einer Zusammenfassungsliste darf eine Text- oder Enum-Spalte sein (ein Enum zeigt die Beschriftung seines Werts), und `columns` nennt bis zu drei weitere Spalten der Zeile, die nach dem Namen ausgegeben werden. Der Block lautet dann `Gear: Crowbar 1d6` statt nur Namen. Eine boolesche Spalte gibt ihre Beschriftung aus, wenn sie gesetzt ist. Beides braucht bei einem als Paket ausgelieferten Regelsatz Capability API 1.37.
- Den Bogenbefehl musst du in `sheetGuidance` nicht erklären. Die Engine bringt dem Game Master jeden Befehl selbst bei, mit den Namen, die deine Datei deklariert. Hat dein Regelsatz eine Wundleiste, ergänzt sie den Befehl `op="damage"` zum Markieren und listet die Stufen und Schadensarten der Leiste auf. Hat er Live-Zustände, ergänzt sie den Befehl `op="state"` und listet die möglichen Werte jedes Live-Zustands auf.

## Vollständige Regelreferenz für den Game Master

Das optionale `gmReference` auf der **obersten Ebene** enthält die vollständige Regelreferenz deines Regelsatzes für den Game Master, bis zu 16.000 Zeichen. Schreib ausführliche Entscheidungsregeln hierher und lass die kurzen Anweisungen zu Proben und Ressourcen in `gm.checkGuidance` und `gm.sheetGuidance`. Für diese Felder und für `gm.worldGuidance` gelten weiterhin ihre Grenzen von 1.500 Zeichen; auch der Anleitungstext von Ebenen behält seine bisherigen Grenzen.

```json
"gmReference": "When a journey crosses hostile country, judge supplies, shelter and exposure before the next leg. A failed navigation check costs time rather than silently moving the party to its destination."
```

Die Referenz erscheint unter **Game Master rules reference** im stabilen Systemprompt, einmal pro Anfrage. Sie wird nie in die Erinnerung des jeweiligen Zuges kopiert. Wie anderer promptsichere Text muss sie eine einzige Zeile sein, ohne Steuerzeichen, eckige Klammern oder Makro-Klammern (`{{` und `}}`). Überschreitet die Anfrage nach den üblichen Anpassungen an Verlauf und Antwortbudget noch immer die Kontextgrenze, wird die Referenz mit einer markierten Kürzung gekürzt, bevor Kernanweisungen gekürzt werden. Lass sie weg, um die bisherigen Prompts beizubehalten. Ein Paket, das sie verwendet, muss im Manifest `schemaVersion: 2` und `capabilityApi: { "major": 1, "minor": 145 }` oder neuer deklarieren.

## Fortschrittsuhren für Gruppe und Szene (`clocks`)

Capability API **1.143** ergänzt ein optionales `clocks`-Objekt auf der obersten Ebene. Lass es weg, damit die Uhrbefehle ausgeschaltet bleiben. Das Objekt ist streng: Nur diese drei Schlüssel werden angenommen.

```json
"clocks": {
  "sizes": [4, 6, 8],
  "max": 8,
  "text": "Create clocks for looming threats and long projects. Tick them when the fiction advances."
}
```

`sizes` erlaubt ein bis sechs verschiedene ganzzahlige Segmentanzahlen, jede von 2 bis 12; der Standard ist `[4, 6, 8]`. `max` ist die Höchstzahl gleichzeitig geführter Uhren, von 1 bis 12, standardmäßig 8. Das optionale `text` ist eine promptsichere Zeile mit bis zu 400 Zeichen, die erklärt, wann der GM Uhren anlegen und vorrücken soll. Ein leeres Objekt schaltet die Standardwerte ein.

Uhren gehören zur Gruppe beziehungsweise zur Szene, nicht zu einem Charakter. Die Erinnerung des GM nennt in jedem Zug ihre Namen und ihren Füllstand und bringt ihm diese Befehle bei:

- `[clock: name="Alarm raised" size="6"]` legt eine leere Uhr an. Eine nicht erlaubte Größe, ein bereits vorhandener Name (ohne Beachtung der Groß- und Kleinschreibung) oder das Erreichen von `max` verhindert das Anlegen.
- `[clock: name="Alarm raised" tick="2"]` füllt Segmente. Negative Werte leeren sie wieder; der Füllstand bleibt innerhalb von `0..size`. Eine volle Uhr ist abgeschlossen, bleibt sichtbar und zählt zu `max`, bis sie entfernt wird. Ein negativer Wert kann sie wieder öffnen.
- `[clock: name="Alarm raised" clear]` entfernt die genannte Uhr.

Namen sind einzelne Zeilen mit 1–100 Zeichen ohne doppelte Anführungszeichen, eckige Klammern, Steuerzeichen oder Makro-Klammern. Jedes Tag verlangt genau eine Aktion. Befehle werden in der Reihenfolge der Antwort angewendet; eine Uhr kann also in derselben Antwort angelegt und vorgerückt werden. Die Engine schreibt jedes Tag mit `result="ok" now="4/6"` (oder `now="cleared"`) oder mit `result="refused" reason="..."` neu. Vom Modell gelieferte Ergebnisattribute werden verworfen. Unbekannte Uhren und fehlerhafte Anfragen werden abgelehnt; pro Antwort werden höchstens 40 Befehle angewendet.

Game Mode zeigt neben dem Gruppenstatus einen segmentierten Kreis, den Namen und den Füllstand. Die Tags bleiben als Belege in der gespeicherten Antwort und werden in der Erzählung ausgeblendet. Uhren werden in jedem Snapshot des Spielzustands als `rulesetClocks` gespeichert; fehlende Daten bedeuten, dass es keine Uhren gibt. Eine neu generierte Antwort beginnt beim vorherigen Snapshot, ein Fortsetzen beim aktuellen, und das Auswählen oder Entfernen von Swipes oder Nachrichten stellt die Uhren zusammen mit dem Rest dieses Snapshots wieder her.

## Gruppenbogen: Eine Crew, ein Schiff oder gemeinsame Story Points

Capability API **1.144** ergänzt neben `sheet` ein optionales `party` auf der obersten Ebene. Es enthält einen gemeinsamen Bogen pro Spiel, etwa eine Crew in Blades, ein Schiff in Lasers & Feelings oder die Story Points von Genesys:

```json
"party": {
  "label": "Crew",
  "fields": [
    { "id": "heat", "label": "Heat", "type": "number", "min": 0, "max": 9, "default": 0 },
    { "id": "vault", "label": "Vault capacity", "type": "number", "min": 0, "max": 16, "default": 8 },
    { "id": "upgrades", "label": "Upgrades", "type": "text", "maxLength": 400 }
  ],
  "pools": [{ "id": "coin", "label": "Coin", "max": { "field": "vault" }, "start": "empty" }],
  "advancement": { "fields": ["heat", "vault", "upgrades"], "text": "Record heat after a score." },
  "text": "Coin belongs to the crew."
}
```

`fields` verwendet dasselbe Feldschema wie `sheet.fields`, `pools` das von `sheet.live.pools`, einschließlich `start`, `group`, `hideWhen` und `allowTemp`. Mindestens ein Feld oder ein Pool ist nötig, und ihre IDs müssen innerhalb des Gruppenbogens eindeutig sein. IDs von Charakter und Gruppe dürfen übereinstimmen. Gruppenbögen haben in dieser Nebenversion keine Abschnitte, Listen, Attribute, abgeleiteten Werte oder Migrationen des Charakterbogens. Das `max` eines Pools liest eine Konstante oder ein Zahlenfeld der Gruppe. Formeln eines Charakters können keine Gruppenwerte lesen, und Formeln der Gruppe keine Charakterwerte. Auch `hideWhen` nennt nur Felder der Gruppe.

`advancement.fields` nennt Zahlen-, Text- oder Langtextfelder, die der GM dauerhaft ändern darf. `advancement.text` und `text` nehmen je eine promptsichere Zeile mit höchstens 400 Zeichen. Das optionale `summary` verwendet `gm.sheetSummary` wieder: Seine `fields` wählen Felder der Gruppe aus; `derived` und `lists` müssen leer sein. Ohne Zusammenfassung werden alle sichtbaren Felder der Gruppe gezeigt. Pools erscheinen immer.

```text
[sheet: sheet="party" op="restore" pool="coin" amount="3"]
[sheet: sheet="party" op="spend" pool="coin" amount="2"]
[sheet: sheet="party" op="advance" field="heat" by="2"]
[sheet: sheet="party" op="advance" field="upgrades" to="Hidden vault"]
```

`sheet="party"` wählt den gemeinsamen Bogen; lass `who` weg. Das bisherige `who="party"` gilt weiterhin für jeden **Charakter** und ändert nie den gemeinsamen Bogen. Diese Nebenversion erlaubt auf dem Gruppenbogen `spend`, `restore` und `advance` für Felder. Unbekannte Bögen, nicht unterstützte Operationen, nicht ausreichende Pools, nicht deklarierter Fortschritt und ungültige Werte werden abgelehnt und mit dem Ergebnis der Engine neu geschrieben. Gruppenpools folgen derselben Rechnung aus aktuellem Wert und Maximum und denselben Standardwerten wie Charakterpools.

Der GM erhält in jedem Zug neben den Bogenblöcken der Charaktere die Beschriftung, die Felder und die Pools der Gruppe. Game Mode bietet neben den Charakterporträts einen einklappbaren, schreibgeschützten Gruppenbogen in derselben Bogendarstellung an. Dauerhafte Werte liegen einmal in den Chat-Metadaten (`gamePartySheet`), neben `gameCharacterCards`, und teilen sich die Belege für Fortschritte. Live-Pools verwenden den reservierten Eintrag `$party` von `rulesetLive`; normalisierte Charakternamen können nicht mit ihm kollidieren. Neu generieren setzt vor der Antwort an, und das Auswählen oder Löschen eines Swipes stellt über den bestehenden Verlauf sowohl dauerhafte als auch Live-Werte wieder her. Regelsätze ohne `party` verhalten sich wie bisher.

**Gemeinsame Gruppenerstellung (Capability API 1.163).** Ein Gruppenbogen darf `lists` tragen (bis zu 12, geschrieben wie die Listen des Charakterbogens), einen eigenen geführten `builder` und `fromMembers`: bis zu 8 Zahlenfelder der Gruppe, die von den Charakteren der Gruppe gelesen werden, jeweils `{ "field", "count": true }` (wie viele Charaktere es gibt) oder `{ "field", "sum": "<character number field>" }` (was deren Werte zusammen ergeben, etwa Totem-Punkte). Mitgliederfelder werden bei jedem Lesen des gemeinsamen Bogens aus den Charakteren berechnet, wie sie gerade sind; ein Charakter, der dazukommt oder geht, ändert sie also sofort. Mit Listen darf das `summary.lists` der Gruppe sie nennen.

Der Erstellungsassistent wird genau wie der eines Charakters geschrieben (Pools, Schritte, Zeilen mit Preis, Ausgabeangebote, Profile) und unterliegt denselben Regeln, bezogen auf die eigenen Felder und Listen der Gruppe. Seine Katalog- und Zeilenkopierschritte dürfen die Kataloge des Regelsatzes lesen, die Gruppenlisten befüllen. In Game Mode öffnet jeder Spieler die Bearbeitung (Edit) des gemeinsamen Bogens, die die geführte Einrichtung anbietet, und speichert sie für die ganze Gruppe. Jedes Speichern nennt die Revision, auf der es geöffnet wurde (`gamePartySheetRevision` in den Chat-Metadaten, erhöht durch jedes Speichern und durch Änderungen der Geschichte selbst): Ein Speichern, das geöffnet wurde, bevor das eines anderen ankam, wird abgelehnt, der neuere Bogen wird angezeigt, und der Entwurf des Spielers bleibt offen. Erneutes Speichern ist dann seine bewusste Entscheidung, den neueren Bogen zu ersetzen.

```json
"party": {
  "label": "The Crew",
  "fields": [
    { "id": "tier", "label": "Tier", "type": "number", "min": 0, "max": 4, "default": 0 },
    { "id": "size", "label": "Crew size", "type": "number", "min": 0, "max": 12, "default": 0 }
  ],
  "lists": [{ "id": "upgrades", "label": "Upgrades", "columns": [{ "id": "name", "label": "Name", "type": "text" }] }],
  "builder": { "steps": [{ "id": "upgrades", "label": "Upgrades", "kind": "rows", "list": "upgrades" }] },
  "fromMembers": [{ "field": "size", "count": true }]
}
```
