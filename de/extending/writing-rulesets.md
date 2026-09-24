# Regelsätze für Game Mode schreiben

Ein Regelsatz erklärt Game Mode, wie ein Tischrollenspiel funktioniert: welche Würfel eine Probe wirft, was auf dem Charakterbogen steht, welche Ressourcen verbraucht werden und was eine Rast wiederherstellt. Dieser Leitfaden richtet sich an alle, die eigene Regelsätze schreiben und teilen möchten. Wenn du mit einem fremden Regelsatz spielen möchtest, beginne bei [Regeln auswählen](../game/getting-started.md#choosing-rules).

Ein Regelsatz besteht aus einer JSON-Datei. Sie enthält Daten, keinen Code. Nichts darin wird ausgeführt; der Import kann daher keine Aktionen auf deinem Computer ausführen. Lies vor dem Import einer fremden Datei vor allem den Text für den Game Master sorgfältig: Er wird in jedem Spiel mit diesem Regelsatz an das Modell gesendet.

## Zuerst lesen: Was ein Regelsatz kann und was nicht

Ein Regelsatz kann nur eine Mechanik ausgestalten, die die Engine bereits kennt. Derzeit kennt die Engine zwei Arten, eine Probe aufzulösen. Deine Datei wählt eine davon mit `resolution.kind`:

- **`dice-sum`**: Würfel werfen, Zahlen vom Bogen addieren und einen Schwierigkeitswert erreichen oder übertreffen. Das deckt d20-Systeme, Systeme mit 2d6 plus Attribut und viele weitere ab.
- **`dice-pool`**: Die eigene Würfelanzahl des Charakters werfen und die Würfel zählen, die einen Zielwert erreichen. Das deckt Systeme ab, in denen ein Wert für eine Handvoll Würfel statt für einen Bonus steht.

Beide werden unter [Auflösungsarten](#resolution-kinds) vollständig beschrieben.

Eine Mechanik, die in keine dieser Formen passt, lässt sich nicht in einer Regelsatzdatei ausdrücken. Beispiele sind der höchste Würfel eines Pools, Prozentproben mit Unterwürfeln, Symbolwürfel und vergleichende Pools. Jede dieser Mechaniken braucht eine neue Auflösungsart in der Engine, also einen Codebeitrag mit Tests statt einer JSON-Datei. Wenn dein System so etwas benötigt, öffne einen Funktionswunsch im Engine-Repository und beschreibe die Mechanik anhand einiger durchgerechneter Würfe. Diese Beispiele werden zu den Tests.

Game Mode kann einen Kampf nach den eigenen Kampfregeln von Marinara oder nach deinem Regelsatz auflösen. Ein optionaler `battle`-Block stellt Marinaras Kampfsystem die Zahlen deiner Charakterbögen bereit; siehe [Kämpfe](#battles-lending-the-sheet-to-marinaras-combat). Ein optionaler `combat`-Block legt dagegen fest, wie der Regelsatz den Kampf auflöst; siehe [Kampfregeln](#combat-a-fight-your-own-rules-resolve). Die Engine spielt diese Regeln bereits aus. **Combat Preference** (Kampfpräferenz) wählt die Darstellung **Classic** oder, wenn der Regelsatz Entfernungen definiert, ein Schlachtfeld in **Tactical**.

## Schnellstart

1. Kopiere die Beispieldatei, deren Würfelmechanik zu deinem System passt. [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json) ist ein kleines 2d6-System mit drei Werten. Es zeigt, dass das Format weder einen d20 noch sechs Attribute voraussetzt. [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json) ist ein kleiner Pool mit zehnseitigen Würfeln, drei Grundwerten und sechs Tätigkeiten. Ein vollständiges Beispiel ist die Datei für 5e (SRD 5.1) in [`ruleset-5e-2014.example.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/ruleset-5e-2014.example.json).
2. Ersetze `id` durch deine eigene ID. Sie besteht aus Kleinbuchstaben, Ziffern und einzelnen Bindestrichen, etwa `ember-roads`.
3. Bearbeite den Bogen, die Rasten und den Text für den Game Master.
4. Importiere die Datei; siehe [Deinen Regelsatz ausprobieren](#trying-your-ruleset). Der Import prüft die gesamte Datei und nennt dir Zeile für Zeile die Fehler, bevor etwas gespeichert wird.
5. Erstelle ein neues Spiel, wähle deinen Regelsatz unter **Rules** (Regeln) und spiele einige Proben.

Damit dein Editor dir beim Schreiben hilft, verweise auf das JSON-Schema. Füge dazu folgende Zeile als erste Zeile innerhalb der äußeren geschweiften Klammern der Datei ein:

```json
"$schema": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json",
```

Das Schema erkennt beim Schreiben falsch geschriebene Schlüssel und falsche Typen. Es kann nicht prüfen, ob die Namen in deiner Datei auf vorhandene Dinge verweisen, etwa ob eine Fertigkeit ein existierendes Attribut nennt. Das prüft der Import.

Du kannst in jedem Objekt der Datei eine Zeile `"$comment": "..."` als Notiz ergänzen. Die Engine ignoriert sie.

## Die Bestandteile der Datei

| Schlüssel | Inhalt |
| --- | --- |
| `schemaVersion` | Immer `1`. |
| `id`, `version` | Der Name deines Regelsatzes für die Engine und eine ganze Zahl, die du bei jeder veröffentlichten Änderung erhöhst. |
| `name` | Der im Einrichtungsassistenten sichtbare Name. |
| `edition` | Optional. Eine Zeile zur Ausgabe oder zum Entwurf. |
| `license` | Optional. Eine SPDX-ID und der von deiner Quelle verlangte Urheberhinweis. |
| `coverage` | Was der Regelsatz abdeckt, mit einer einzeiligen Zusammenfassung für den Einrichtungsassistenten. |
| `resolution` | Wie eine Probe oder ein Rettungswurf gewürfelt wird. |
| `sheet` | Alles auf dem Charakterbogen. |
| `rests` | Was jede Art von Rast wiederherstellt und entfernt. |
| `gm` | Der Text für das Game-Master-Modell und die Bogenwerte, die es für jeden Charakter sieht. |
| `catalogs` | Optional. Fertige Einträge im Bogeneditor, damit Spieler lange Listen nicht von Hand eingeben müssen. |
| `battle` | Optional. Was ein Kampf vom Bogen lesen und danach zurückschreiben darf. |
| `combat` | Optional. Wie deine eigenen Regeln einen Kampf auflösen und was der Kampfbildschirm anschließend ausspielt. |
| `layers` | Optional. Varianten deines Regelsatzes, die ein Spieler bei der Spielerstellung einschaltet. |

Die Datei darf bis zu 256 KB groß sein. Text, der in einem Prompt landet – Namen, Beschriftungen und Game-Master-Text –, darf keine Zeilenumbrüche, eckigen Klammern oder doppelten geschweiften Klammern enthalten.

IDs innerhalb des Bogens, etwa für Attribute, Fertigkeiten, Felder und Pools, bestehen aus Kleinbuchstaben, Ziffern und Unterstrichen und beginnen mit einem Buchstaben, zum Beispiel `grit_max`.

<a id="resolution-kinds"></a>

### Auflösungsarten

`resolution.kind` wählt, wie eine Probe gewürfelt wird. Beide Arten lesen denselben Charakterbogen und teilen drei Schlüssel. Die Bestandteile unterhalb von `resolution` ändern sich beim Wechsel deshalb nicht:

- `abilityModifier`: Wie ein Bogenwert zu einer Zahl wird. Bei `identity` ist der Wert selbst die Zahl. `floorHalfMinusTen` ist die 5e-Regel. Mit `stepTable` kannst du eigene Schwellen als `[[score, number], ...]` auflisten.
- `proficiencyTiers`: Die Ausbildungsstufen einer Fertigkeit oder eines Rettungswurfs. Eine nicht eingetragene Fertigkeit bekommt die erste Stufe. Eine Stufe addiert `flat`, das `multiplier`-Fache eines Übungsbonus oder beides. Wenn dein System einen Übungsbonus hat, gib seine Herkunft mit `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }` an.
- `proficiency`: Optional und nur für eine multiplizierende Stufe nötig.

Was die berechnete Zahl bedeutet, bestimmt die Auflösungsart: `dice-sum` addiert sie zum Wurf, `dice-pool` wirft entsprechend viele Würfel.

#### `dice-sum`: Würfel addieren

```json
"resolution": {
  "kind": "dice-sum",
  "dice": { "count": 2, "sides": 6 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "untrained", "label": "Untrained" },
    { "id": "trained", "label": "Trained", "flat": 1 }
  ],
  "advantage": false,
  "difficultyLadder": [
    { "label": "Easy", "dc": 6 },
    { "label": "Hard", "dc": 10 }
  ]
}
```

- `dice`: Die Anzahl und Seitenzahl der Würfel. Ihre Summe wird mit der Schwierigkeit verglichen.
- `advantage`: Ob der Game Master verlangen darf, zweimal zu würfeln und einen Wurf zu behalten.
- `naturals`: Was die höchste und niedrigste Seite eines einzelnen Würfels bei Proben und Rettungswürfen bewirken: `none`, `both`, `max-only` oder `min-only`. Lass den Eintrag weg, wenn nur gerechnet werden soll. Er setzt einen einzelnen Würfel voraus; ein 2d6-System muss daher `none` verwenden.
- `difficultyLadder`: Die Schwierigkeitswerte, aus denen der Game Master wählen soll. `dc` ist die Zahl, die die Summe erreichen muss.

#### `dice-pool`: Würfel werfen und zählen

Die Zahl auf dem Bogen ist die **Größe des Pools**, kein zusätzlicher Bonus. Ein Grundwert von 3 und eine Tätigkeit mit Wert 2 ergeben fünf Würfel. Mehr steckt nicht dahinter: Es braucht weder neue Bogenbegriffe noch einen neuen Editor. Ein System, dessen Werte eine Handvoll Würfel bedeuten, wird mit denselben `abilities`, `skills` und `proficiencyTiers` geschrieben wie jedes andere.

```json
"resolution": {
  "kind": "dice-pool",
  "die": { "sides": 10 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "rating_0", "label": "Untried" },
    { "id": "rating_1", "label": "Shown once", "flat": 1 }
  ],
  "pool": { "min": 1, "max": 15 },
  "target": { "default": 7, "min": 5, "max": 9 },
  "explode": { "from": 10 },
  "cancel": { "upTo": 1 },
  "botch": { "upTo": 1 },
  "exceptional": { "successes": 5 },
  "situationalDice": { "min": -3, "max": 3 },
  "difficultyLadder": [
    { "label": "Plain work", "successes": 1, "target": 6 },
    { "label": "Grim", "successes": 3, "target": 8 }
  ]
}
```

- `die`: Wie viele Seiten ein Würfel des Pools hat, von 2 bis 100.
- `pool`: Der Bereich, auf den die Zahl vom Bogen vor allen Explosionen begrenzt wird. Ein `min` von 0 lässt einen leeren Pool ohne Wurf scheitern. `max` darf höchstens 100 sein.
- `target`: Die Augenzahl, die ein Würfel erreichen muss, um zu zählen. Setze `min` unter `max`, damit der Game Master sie mit `threshold=` je Probe verändern darf. Setze alle drei Werte gleich, um sie festzulegen.
- `double`: Optional. Eine Augenzahl ab `from` zählt doppelt.
- `explode`: Optional. Eine Augenzahl ab `from` wirft einen weiteren Würfel, der seinerseits explodieren kann. Zusätzlich zum ursprünglichen Pool sind höchstens `pool.max` weitere Würfel erlaubt. Eine Probe wirft daher höchstens zweimal `pool.max` Würfel, und ein niedriger `from`-Wert kann nicht endlos weiterwürfeln.
- `cancel`: Optional. Eine Augenzahl bis einschließlich `upTo` zieht einen Erfolg ab. Die Anzahl sinkt nie unter null.
- `botch`: Optional. Wenn **kein** Würfel erfolgreich war und eine Augenzahl bis einschließlich `upTo` vorkam, ist die Probe ein Patzer. Ein Pool, dessen einziger Erfolg nachträglich gestrichen wurde, ist gescheitert, aber kein Patzer.
- `exceptional`: Optional. Eine erfolgreiche Probe mit mindestens so vielen verbleibenden Erfolgen ist ein kritischer Erfolg.
- `situationalDice`: Optional. Wie viele Würfel der Game Master bei einer Probe mit `bonus=` hinzufügen oder abziehen darf, etwa für Kunststücke, Wunden oder schlechtes Licht.
- `difficultyLadder`: `successes` gibt die nötigen Erfolge an. Eine Stufe darf auch ein `target` nennen, aber nur, wenn der Zielwert veränderlich ist, und nur innerhalb seines Bereichs.

Die Augenzahlen für `cancel` und `botch` müssen unter dem niedrigsten Zielwert liegen. Jede von diesen Regeln genannte Augenzahl muss auf dem Würfel vorkommen können. Eine Regel, die nie greifen könnte, wird beim Import abgelehnt, statt erst im Spiel aufzufallen.

Ein als Paket ausgelieferter Pool-Regelsatz braucht Capability API 1.24. Ein importierter Community-Regelsatz wird von der Engine geprüft, die ihn liest, und braucht deshalb keine solche Angabe.

#### Was der Game Master bei einer Pool-Probe schreiben darf

```
[skill_check: skill="Ward" dc="2" who="Bram the Quiet" threshold="8" bonus="-2" with="Sinew"]
```

- `dc` ist die Zahl der nötigen **Erfolge**, kein Zielwert. Sie darf von 1 bis zum größtmöglichen Ergebnis eines Wurfs reichen: das Maximum des Pools, verdoppelt bei explodierenden Würfeln und erneut verdoppelt bei doppelt zählenden Augenzahlen.
- `threshold=` verändert den Zielwert je Würfel und wird nur angeboten, solange `target.min` unter `target.max` liegt.
- `bonus=` fügt Würfel hinzu oder zieht sie ab und wird nur angeboten, wenn `situationalDice` deklariert ist.
- `with=` würfelt eine Fertigkeit oder einen Rettungswurf mit einem anderen als dem zugeordneten Attribut. Das funktioniert bei beiden Arten; ein 5e-Regelsatz erhält über dasselbe Tag-Attribut also "Strength (Intimidation)".

Alle Angaben bleiben innerhalb deiner Dateivorgaben: Ein Wert außerhalb des Bereichs wird auf die nächste Grenze gesetzt. Ein vom Regelsatz nicht angebotenes Tag-Attribut wird ignoriert, statt die Probe abzulehnen. Der gespeicherte Datensatz zeigt anschließend, was der Wurf tatsächlich verwendet hat: die Schwelle und die zusätzlichen Würfel nach Anwendung deiner Grenzen sowie `with=` nur dann, wenn das Attribut wirklich ausgetauscht wurde. Die Engine wirft die Würfel immer selbst. Ein vom Modell geschriebenes Pool-Ergebnis wird ersetzt. `mode="advantage"` wird ignoriert, weil diese Auflösungsart keinen Vorteil kennt. Ein vor dem Zug vom Spieler gewürfelter Würfel wird nicht verwendet.

#### Was nicht abgedeckt ist und warum

Jede der folgenden Mechaniken braucht eine eigene Auflösungsart, weil sie sich nicht durch das Zählen von Würfeln gegen einen Zielwert ausdrücken lässt:

- **Den höchsten Würfel nehmen**, wie in Blades in the Dark, braucht eine Stufe für Teilerfolge, die ein Probenergebnis nicht hat.
- **Haltungspools mit einem Wert vergleichen**, wie in Lasers and Feelings, entscheidet je Probe über "darüber oder darunter" und ist damit ein anderer Vergleich.
- **Symbolwürfel**, wie in Genesys, liefern überhaupt keine Zahlen.
- **Vergleichende Pools** lösen zwei Charaktere gleichzeitig auf; eine Probe hat nur einen würfelnden Charakter.
- **Unterwürfeln und offene Prozentwürfe** vergleichen in die andere Richtung.
- **Summenpools mit einem besonderen Würfel**, wie in OpenD6, addieren die Würfel und behandeln einen davon gesondert.

Die beiden früher fehlenden Möglichkeiten dieser Auflösungsart sind inzwischen modelliert. Der folgende Abschnitt zum Ausgeben von Ressourcen erklärt sie. Eine allgemeine Systemregel wie "einen Punkt für einen Erfolg ausgeben" wird mit `resolution.spend` beschrieben: Sie kauft Erfolge oder Würfel, niemals einen Wiederholungswurf. Ein Wiederholungswurf gehört zu etwas, das ein Charakter ausgewählt hat. Deshalb steht er als `mechanics.check` an einem Katalogeintrag und wird mit dessen eigenen Kosten bezahlt.

### Ressourcen ausgeben, um einen Wurf zu verändern

Manche Systeme lassen Spieler vor einem Wurf dafür bezahlen, etwa einen Willenspunkt für einen automatischen Erfolg. `resolution.spend` beschreibt dies als allgemeine Systemregel, nicht als etwas, das ein Charakter erst erwerben musste:

```json
"spend": [{ "pool": "resolve", "amount": 1, "successes": 1, "perCheck": 2 }]
```

- `pool` ist einer deiner `live.pools`. Er darf nicht leer starten, denn dann wäre zu Spielbeginn nichts zum Ausgeben darin.
- `amount` ist der Preis für EINEN Kauf. `successes` und `dice` geben an, was er kauft; mindestens eines davon muss er liefern. Erfolge werden erst nach dem Zählen der Würfel und nach dem Streichen von Erfolgen hinzugefügt, weil niemand sie gewürfelt hat. Zusätzliche Würfel werden innerhalb der Pool-Grenzen mitgeworfen.
- `perCheck` bestimmt, wie viele Käufe eine Probe machen darf. Sie kann also höchstens für `amount * perCheck` Punkte einkaufen. Diese Grenze verhindert, dass ein voller Ressourcenpool einen unfehlbaren Wurf kauft.
- Das ist nur für einen `dice-pool`-Regelsatz möglich. Ein Summenwurf hat weder Erfolge zum Hinzufügen noch einen Würfelpool zum Vergrößern. Ein `dice-sum`-Regelsatz mit `spend` wird deshalb beim Import abgelehnt.
- Zwei Einträge dürfen nicht denselben Pool nennen, sonst könnte eine Probe nicht sagen, welchen sie meint.

**Die Angabe steht direkt an der Probe.** Der Game Master schreibt `[skill_check: skill="Nerve" dc="2" spend="resolve:1"]`, keinen getrennten `[sheet:]`-Befehl. Die Würfel werden vor den Bogenbefehlen geworfen; danach gäbe es nichts mehr zu verändern. Dieselbe Auflösung würfelt und bezahlt die Änderung.

### Ein Talisman, der einen Wurf verändert

`resolution.spend` ist eine Systemregel. Auch ein Eintrag, den ein Charakter tatsächlich AUSGEWÄHLT hat, kann eine Probe verändern: mit `mechanics.check` am Katalogeintrag.

```json
"mechanics": {
  "kind": "utility",
  "cost": [{ "pool": "blood", "amount": 1 }],
  "perCostStep": { "flat": 1 },
  "check": { "reroll": { "upTo": 1, "mode": "once" }, "successes": 1 }
}
```

- `reroll` wirft Würfel mit Augenzahlen bis einschließlich `upTo` erneut. `once` ersetzt jeden einmal und behält die neue Augenzahl; `until` wiederholt weiter. `upTo` muss unter der höchsten Würfelseite liegen, sonst würde der gesamte Pool endlos neu geworfen. Unabhängig von der Datei begrenzt die Engine, wie viele Würfel eine Probe erneut werfen darf.
- `dice` fügt vor dem Wurf Würfel hinzu, `successes` nach dem Zählen Erfolge. `threshold` setzt den Zielwert je Würfel für diesen einen Wurf innerhalb des von `target` erlaubten Bereichs.
- Mindestens eine der vier Angaben ist nötig. Sonst beschreibt der Eintrag nichts und wird abgelehnt.
- Nur ein `dice-pool`-Regelsatz kann diese Angaben umsetzen. Ein `dice-sum`-Regelsatz mit `mechanics.check` wird deshalb beim Import abgelehnt.

**Bezahlt werden die eigenen `cost` des Eintrags**, über denselben Ablauf wie bei jeder anderen Nutzung: der Pool sowie je eine Nutzung jedes Zählers, den derselbe Eintrag angelegt hat. `perCostStep` sagt aus, dass der Eintrag SKALIERT. Ein Eintrag mit dieser Angabe wird so oft gekauft, wie sein Preis bezahlt wurde. Ohne diese Angabe wird er einmal gekauft, unabhängig vom angebotenen Betrag.

**Der Game Master nennt ihn direkt an der Probe:** `[skill_check: skill="Brawl" dc="3" use="Potence" spend="blood:3"]`. Auch hier gibt es keinen getrennten Bogenbefehl, denn die Würfel werden vor der Buchführung geworfen.

**Alles oder nichts.** Reicht der Pool nicht aus, findet kein Kauf statt und nichts wird abgezogen. Der Wurf bleibt genau derselbe wie ohne Kauf. Auch Punkte, die keiner ganzen Zahl von Käufen entsprechen, kaufen nichts. Eine Anforderung über `perCheck` wird begrenzt statt abgelehnt; bezahlt wird nur das erlaubte Maximum. Die Engine berechnet all das. Der Game Master nennt den vom Spieler angekündigten Einsatz und fasst die Würfel nie an. Der Datensatz nennt den tatsächlich bezahlten Betrag, den angewendeten Eintrag, die ungewürfelten Erfolge und die Anzahl erneut geworfener Würfel. Ein nicht ausgewählter Talisman oder einer, dessen Katalog die Engine nicht lesen kann, bewirkt gar nichts; seine Angaben werden nicht ungeprüft übernommen.

### Der Bogen

- `sections` gruppiert die Einträge im Editor.
- `abilities` enthält die Grundwerte. `skills` und `saves` können jeweils das Attribut nennen, mit dem sie würfeln.
- `fields` enthält einzelne Werte. Typen: `number`, `text`, `longtext`, `boolean`, `enum` (eine feste Auswahlliste) und `dice` (Text wie `1d8`).
- `derived`-Werte werden aus anderen Werten berechnet und können nicht überschrieben werden. Die Operationen sind `sum`, `min`, `max`, `scale` (multiplizieren und runden) sowie `stepTable` (einen Wert in Schwellen nachschlagen, etwa den Übungsbonus anhand der Stufe).
- `lists` enthält Tabellen mit eigenen Spalten, etwa für Ausrüstung, Zauber oder Merkmale. Eine Liste mit `pools` macht jede Zeile zu einer Ressource mit eigenem Maximum, etwa für Klassenmerkmale mit begrenzten Nutzungen.
- `live` enthält, was sich im Spiel verändert: `pools` (Trefferpunkte, Zauberplätze, Grit), `tracks` (eine Zahl auf einer Skala, etwa Erschöpfung, oder eine Wundleiste mit ankreuzbaren Kästchen), `text` (kurze Notizen, etwa zur Konzentration eines Charakters) und `conditions`.

Alles, was eine Zahl liest, benennt sie über einen Wertverweis: ein Objekt mit genau einem Schlüssel aus `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod` oder `saveMod`. Beispiel für einen Pool mit abgeleitetem Maximum: `"max": { "derived": "grit_max" }`.

`hideWhen` blendet ein Feld, eine Liste oder einen Pool aus, wenn ein anderes Feld einen bestimmten Wert hat. Die 5e-Datei blendet damit Zauberplätze bei Charakteren ohne Zauber aus.

### Wundleisten: Gesundheit als Leiste statt als Zahl

Viele Systeme zählen überhaupt keine Trefferpunkte. Sie haben eine Spalte aus Kästchen, jedes schlimmer als das vorige, und bei einer Verletzung wird eines markiert. Gib einem Eintrag in `live.tracks` die Angaben `levels` und `kinds`; damit wird aus einer Zahl auf einer Skala eine solche Leiste:

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
- Beides gehört zusammen. `kinds` ohne `levels` wird abgelehnt, weil es nichts zu markieren gäbe. `levels` ohne `kinds` wird abgelehnt, weil jede Markierung eine Art braucht.
- **Trenne die beiden Begriffe.** `kinds` definiert, was eine Markierung laut Regelsatz SEIN darf. Eine MARKIERUNG ist eine dieser Arten auf der Leiste während des Spiels. Die Definition enthält Arten; der Charakterbogen enthält Markierungen.
- Die Länge einer Wundleiste entspricht ihren Stufen. Daher ist `min` gleich 0 und `max` gleich `levels.length`. Eine anderslautende Datei wird abgelehnt statt still korrigiert, damit sie niemals zwei widersprüchliche Längen enthält.

**Die genauen Regeln**, denn eine ungenaue Auslegung führt zur falschen Leiste:

- Markierungen bleiben sortiert, **die schwerste zuerst**. Eine Leiste mit sieben Stufen hält höchstens sieben Markierungen.
- Eine Markierung wird **nach Schweregrad einsortiert**, niemals einfach hinten angehängt. Sie nimmt die höchste ihrem Schweregrad zustehende Position ein und schiebt leichtere Markierungen nach unten.
- Es gilt der Abzug der **untersten markierten Stufe**, niemals die Summe der markierten Stufen. Drei Markierungen auf der obigen Leiste ergeben `-3`, nicht `0 + -1 + -3`.
- `amount` nennt eine Anzahl Markierungen einer Art, die **einzeln nacheinander angewendet** werden. Eine währenddessen voll werdende Leiste folgt damit derselben Regel wie eine schon vorher volle.
- Eine Markierung auf einer **vollen** Leiste **erhöht deren leichteste Markierung um eine Stufe**, statt eine weitere hinzuzufügen: genau eine Stufe auf deiner eigenen Rangfolge der Schadensarten, unabhängig von der neu hinzukommenden Art.
- Eine Markierung, die über den höchsten Schweregrad hinaus erhöht würde, bleibt beim höchsten. Die nicht mehr untergebrachte Markierung zählt als **Überlauf**. Dieser wird gespeichert, damit ein Neuladen bereits erlittenen Schaden nicht vergisst.
- **Heilung verwendet denselben Befehl mit negativer Menge.** Sie entfernt zuerst die leichtesten Markierungen und vor allen Markierungen zunächst den Überlauf.

**Im Spiel markieren.** Der Game Master schreibt `[sheet: op="damage" track="harm" kind="knock" amount="1"]` und heilt mit negativem `amount`. Die Pool-Form von `damage`, die stattdessen `pool=` nennt, bleibt unverändert. Der einfache `track`-Befehl wird für Wundleisten abgelehnt: Eine bloße Zahl kann die Art der neuen Markierungen nicht nennen. Spieler können Kästchen auch von Hand auf dem Bogen markieren und leeren, wie es solche Systeme vorsehen.

**Auch ein Kampf kann eine Wundleiste markieren.** Verweise mit `combat.health` auf die Leiste statt auf einen Pool. Ein ankommender Treffer markiert dann so viele Kästchen, wie `combat.damageKinds.marks` vorgibt, und verwendet die Art, auf die dieser Block den Schadenstyp abbildet. Ein Charakter mit voller Leiste geht zu Boden; das liest deine Sterberegel. Heilung entfernt eine Markierung. Temporäre Punkte werden abgelehnt, weil eine Leiste keinen Puffer dafür hat. Die Engine liest eine Leiste als ihre VERBLEIBENDEN Stufen. Alles andere am Kampf – zu Boden gehen, wiederbelebt werden, Protokoll und Rückblick – bleibt dadurch unverändert.

**Eine Rast kann eine Wundleiste heilen.** Ein Wiederherstellungsschritt mit `"to"` reduziert sie einschließlich Überlauf auf so viele Markierungen. Ein Schritt mit `"by"` entfernt die genannte Anzahl, zuerst den Überlauf. Ein Schritt, der Markierungen HINZUFÜGEN würde, tut nichts, weil eine Rast keine Schadensart dafür nennt.

### Der Abzug auf deine Würfe

`resolution.penaltyFrom` nennt die Wundleiste, deren Abzug für jede Probe dieses Regelsatzes gilt. Die Angabe wird deklariert, nicht vorausgesetzt. Ohne sie würfelt ein Regelsatz daher genauso wie vor der Einführung von Wundleisten.

Was der Abzug BEWIRKT, bestimmt wie beim eigenen Bogenwert die Auflösungsart:

- Bei `dice-pool` werden **Würfel aus dem Pool entfernt**, höchstens bis zu deinem `pool.min`. Bei `pool.min` gleich 1 wirft selbst ein Charakter auf der untersten Stufe einen Würfel. Bei `pool.min` gleich 0 wirft er keinen und scheitert ohne Wurf.
- Bei `dice-sum` gilt ein **fester Modifikator auf den Wurf**, verrechnet mit derselben Zahl, die bereits Attribut und Ausbildung addieren.

Die genannte Leiste muss eine Wundleiste sein. Eine einfache Zahlenleiste hat keinen anzuwendenden Abzug; ein Verweis darauf wird beim Import abgelehnt. Das Ergebnis nennt den angewendeten Abzug, damit Spieler die kleinere Würfelanzahl nachvollziehen können. Auch der Bogenblock des Game Master zeigt die Stufe und ihren Abzug.

### Rasten

Eine Rast ist eine Liste von Wiederherstellungsschritten und zu entfernenden Dingen. Jeder Schritt nennt genau ein Ziel (`pool`, `poolGroup`, `listPools` oder `track`) und setzt es entweder auf einen Wert (`"to": "max"`, `"to": "min"` oder eine Zahl) oder verändert es (`"by": { "const": 1 }` oder `"by": { "fractionOfMax": 0.5 }`). Ein Schritt für eine Wundleiste kann sie nur heilen; siehe oben.

### Text für den Game Master

- `checkGuidance` ersetzt den eingebauten Absatz, der dem Game Master erklärt, wie er eine Probe anfordert. Nenne das System und beschreibe, wann gewürfelt werden soll. Der Game Master nennt nur Fertigkeit und Schwierigkeit. Die Engine würfelt und rechnet anhand des Bogens; fordere das Modell deshalb nicht zum Rechnen auf.
- `sheetGuidance` stellt die Charakterbögen im Prompt vor. Erkläre darin, welche Ressourcen wichtig sind und wann sie verbraucht werden sollen.
- `worldGuidance` ist optional und wird einmal bei der Welterzeugung gelesen. So passt die vom Game Master erfundene Welt zu deinen Regeln: kein Schießpulver, seltene Magie, wandelnde Tote. Der Text gelangt nie in einen Zug.
- `sheetSummary` wählt die Felder, abgeleiteten Werte und Listenzeilen, die der Game Master pro Charakter sieht. Die Engine zeigt immer Attributsmodifikatoren, ausgebildete Fertigkeiten und Rettungswürfe sowie laufende Werte. Halte den Rest kurz, denn er wird in jedem Zug gesendet.

## Kataloge: Fertige Einträge für die Listen des Bogens

Zauberlisten, Ausrüstungstabellen oder seitenlange Klassenmerkmale Zeile für Zeile einzugeben, ist mühsam. Ein Katalog ist eine benannte Sammlung fertiger Einträge, die du mit dem Regelsatz auslieferst. Der Bogeneditor bietet sie in einer Auswahl an jeder vom Katalog befüllten Liste an. Die Auswahl eines Eintrags füllt die Zeile aus.

Kataloge sind optional. Ein Regelsatz darf bis zu zwölf enthalten. Die Engine kennt den Inhalt keines davon: Jede ID, Spalte, jeder Filter und jedes Wort stammt aus deiner Datei.

### Der Katalogkopf

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
- `holds`: `"rows"` (Standard und der Wert aller vor dieser Veröffentlichung geschriebenen Kataloge) oder `"creatures"`. Ein Kreaturenkatalog ist ein Bestiarium für Kämpfe. Er schreibt nichts auf einen Bogen, deklariert kein `feeds` und wird nie in der Auswahl angeboten. Siehe unten [Kreaturen](#creatures-a-bestiary-a-fight-reads).
- `feeds`: Die Listen deines Bogens, in die Einträge dieses Katalogs schreiben dürfen, mindestens eine und höchstens acht. Für Zeilenkataloge erforderlich, bei Kreaturenkatalogen nicht erlaubt. Ein Eintrag kann niemals in eine hier nicht genannte Liste schreiben oder einen Wert ablegen, den die Spalten der Liste nicht aufnehmen können.
- `filters`: Optional, höchstens acht. Die Filter, mit denen die Auswahl eingegrenzt werden kann. Ein Filter ist `number`, ein `text`-Wert oder `tags` (mehrere Wörter). `startFrom` nennt ein Bogenfeld, mit dessen Wert die Auswahl startet. Hat ein Charakter die Berufung Tinker, sieht er dadurch zuerst Tinker-Einträge.
- `units`: Optional. Was eine Reichweite oder Flächengröße im `mechanics`-Block eines Eintrags in deinem System bedeutet.

### Ein Eintrag

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

### Ein Eintrag, mehrere Listen

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

### Werte, die der Regelsatz aktuell hält

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
- Eine Zeile mit `scaled` muss die einzige Zeile dieses Eintrags für die betreffende Liste sein. Dadurch passt eine markierte Bogenzeile immer zu genau einer Vorgabe.

Der Wert wird beim Bearbeiten des Bogens berechnet, niemals beim Lesen. Eine gespeicherte Zeile enthält daher immer tatsächlich die angegebene Zahl. Sie wird an die Zielspalte angepasst: auf deren `min` und `max` begrenzt und bei Ganzzahlspalten abgerundet. Im obigen Beispiel hat ein Charakter mit Heart 3 drei Nutzungen, einer mit Heart 0 oder weniger keine. Die Zeile bleibt mit 0 Nutzungen auf seinem Bogen. Da ein Zähler mit Maximum 0 kein Pool ist, kann im Spiel nichts daraus verbraucht werden.

Skalierte Spalten brauchen bei einem als Paket ausgelieferten Regelsatz Capability API 1.23. Ein importierter Community-Regelsatz wird von der lesenden Engine geprüft und braucht keine solche Angabe.

### Ausgewählte Zeilen sind Kopien

Jede ausgewählte Zeile wird mit einem zusätzlichen Schlüssel `_catalog` auf den Bogen kopiert. Er enthält `<catalog id>/<entry id>`. Spalten-IDs beginnen immer mit einem Buchstaben; dieser Schlüssel kann deshalb nie mit einem deiner Schlüssel zusammenfallen.

Die Kopie gehört dem Charakter. Spieler können anschließend alles daran bearbeiten. Der Bogen funktioniert weiter, wenn dein Regelsatz nicht installiert ist, und eine neue veröffentlichte Regelsatzversion schreibt niemals einen Charakter um. Anhand der Markierung zeigt die Auswahl, was der Bogen bereits enthält. Auch die nachfolgend beschriebene Aktualisierung liest sie.

### Aus dem Regelsatz aktualisieren

Weil eine ausgewählte Zeile ihre Markierung behält, kann der Bogeneditor auf abweichende neuere Texte hinweisen. Eine kurze Zeile unter der Liste nennt die Zahl der Zeilen mit neuerem Text. **Review** (prüfen) zeigt für jede davon den Bogeninhalt neben der Regelsatzfassung sowie ein Auswahlkästchen je Zeile. Erst mit **Update selected** (Auswahl aktualisieren) wird etwas geschrieben, und nur die abweichenden Spalten der ausgewählten Zeilen. Alles andere in der Zeile bleibt erhalten, einschließlich der Markierung.

Der Vergleich ist absichtlich eng begrenzt:

- Vorhandene Werte werden nur in Spalten der Typen `text`, `longtext`, `dice` und `enum` verglichen. Vorhandene `number`- und `boolean`-Werte gehören dem Spieler und bleiben erhalten, auch 0 und false. Eine noch nicht in der Zeile enthaltene Spalte kann mit ihrem typisierten Wert angeboten werden, einschließlich Zahlen und Schaltern. Skalierte Spalten sind ausgenommen, weil sie bereits dem Bogen folgen.
- Nur Spalten, die dein Eintrag setzt, werden betrachtet. Eine ausgelassene Spalte wird nie verändert, unabhängig von ihrem Bogeninhalt.
- Ein von der Spalte selbst abgelehnter Wert wird übersprungen statt geschrieben, etwa ein nicht mehr angebotenes `enum`-Element oder Text über `maxLength`.
- Eine Zeile wird ihrer ursprünglichen Eintragszeile anhand ihrer Position unter den gleich markierten Zeilen dieser Liste zugeordnet. Das funktioniert, solange der Bogen noch genau so viele davon enthält, wie dein Eintrag schreibt. Andernfalls ist die Zuordnung nur möglich, wenn dein Eintrag genau eine Zeile für diese Liste schreibt. Hat ein Spieler eine Zeile eines zweizeiligen Eintrags gelöscht, bleibt der Eintrag unverändert, statt die Zuordnung zu erraten.
- Eine Zeile, deren Eintrag dein Katalog nicht mehr enthält, bleibt still unverändert.

Umformulierungen und Umbenennungen können also nach Zustimmung des Spielers auch Charaktere erreichen, die den Eintrag schon ausgewählt haben. Eine Änderung der Bedeutung einer Zahl kann und wird das nicht: Sobald die Zeile dem Spieler gehört, gehört ihm auch diese Spalte.

### `mechanics`: Was ein Eintrag in Zahlen bewirkt

Ein Eintrag kann einen optionalen `mechanics`-Block mit seinen Wirkungen in Zahlen tragen: `kind` (`attack`, `heal`, `buff`, `debuff`, `utility`, `rider`), `range`, `area`, `targets`, `targetCount`, `friendlyFire`, `amount` (Würfel wie `2d6` oder eine feste Zahl), `damageType`, `attackRoll`, `autoHit`, `save` (einer der Rettungswürfe des Bogens samt Erfolgswirkung), `applies` (Zustände für betroffene Ziele), `temporary` (temporäre Punkte auf dem Gesundheitspool), `scales` (eine mit dem Bogen wachsende Menge), `cost` (der bei Nutzung belastete Pool), `perCostStep`, `budget` (der verbrauchte Teil des Aktionsbudgets), `concentration`, `reaction`, `plus`, `free`, `gives`, `standard`, `rider` und `check`.

Die Auswahl zeigt diesen Block als einzelne Zeile. Wer den Rest liest, hängt vom gewählten Regelsatzblock ab:

- Mit einem [`combat`-Block](#combat-a-fight-your-own-rules-resolve) liest der Kampf dessen Kampfwirkungen. `range`, `area` und `friendlyFire` gelten auf einem Schlachtfeld mit Positionen. `reaction` markiert einen Eintrag als Reaktion auf etwas. Solange ein Eintrag seinen Auslöser nicht benennen kann, erscheint ein so markierter Eintrag in keinem Menü. `check` gilt wie oben beschrieben für Fertigkeitsproben.
- Mit ausschließlich einem [`battle`-Block](#battles-lending-the-sheet-to-marinaras-combat) liest der Kampf `kind`, `range`, `area`, `friendlyFire`, `amount`, `damageType` und `cost`, weil Marinaras eigenes Kampfsystem genau diese Angaben aufnehmen kann.

Das Vokabular ist geschlossen. Ein nicht in der obigen Liste enthaltener Schlüssel oder Wert wird deshalb abgelehnt statt still ignoriert.

`cost` bezahlt auch der `use`-Befehl des Game Master außerhalb eines Kampfes. Darum geht es im nächsten Abschnitt.

### Der `use`-Befehl: Den Game Master einen von dir festgelegten Preis bezahlen lassen

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

`pool=` ermöglicht das Verstärken durch einen anderen Pool: derselbe einzelne Preis, bezahlt aus einem anderen Pool derselben Gruppe. Das wird nur akzeptiert, wenn die Kosten genau einen Bestandteil haben und der genannte Pool zu dessen Gruppe gehört. Alles andere wird abgelehnt statt umgedeutet.

Es gilt alles oder nichts. Kann ein Teil nicht bezahlt werden, wird der gesamte Befehl abgelehnt, nichts verändert und der Spieler informiert. Ein völlig kostenloser Eintrag, etwa ein Zaubertrick oder ein passives Merkmal, wird angenommen und verändert nichts.

### Direkt in der Regelsatzdatei oder als eigene Datei

Ein kleiner Katalog steht direkt in `ruleset.json`, im Feld `entries` des Katalogkopfs. Ein langer Katalog liegt in einer eigenen Datei, die der Kopf stattdessen mit `asset` nennt. Ein Katalog enthält genau eines von beiden.

```json
{ "id": "knacks", "label": "Knacks", "feeds": ["knacks"], "asset": "catalogs/knacks.json" }
```

Der Pfad ist immer `catalogs/<the catalog's id>.json`. Die Datei selbst sieht so aus:

```json
{ "schemaVersion": 1, "catalog": "knacks", "entries": [] }
```

Separate Katalogdateien gibt es für Pakete, die über den offiziellen Katalog veröffentlicht werden. Das Paket führt die Datei in `contributions.assets.paths` neben `ruleset.json` auf und braucht Capability API 1.21. Ein Kreaturenkatalog braucht Capability API 1.27, unabhängig davon, ob er direkt eingebettet ist oder eine eigene Datei hat. **Ein als Einzeldatei importierter oder über ein GitHub-Repository geteilter Regelsatz enthält seine Kataloge direkt in der Datei.** Sie müssen daher in die 256-KB-Grenze der gesamten Regelsatzdatei passen. Das reicht für einige Hundert kurze Einträge.

Die Grenzen sind 12 Kataloge pro Regelsatz, in beiden Formen 2000 Einträge je Katalog und 1 MB für eine Katalogdatei.

<a id="battles-lending-the-sheet-to-marinaras-combat"></a>

## Kämpfe: Den Bogen Marinaras Kampfsystem bereitstellen

Standardmäßig weiß ein Kampf nichts vom Bogen. Er erstellt seine Kämpfer wie bisher. Ein Charakter kann einen Kampf daher verlassen, ohne dass sich die Trefferpunkte auf seinem Bogen verändert haben.

Ein optionaler `battle`-Block ändert das in genau einer Hinsicht: Er stellt dem Kampf die Zahlen des Bogens bereit und schreibt das Kampfergebnis zurück. **Dadurch folgt der Kampf nicht deinen Regeln.** Würfelberechnung, Treffer und Schadenshöhe bestimmt weiterhin Marinara. Deshalb wird Gesundheit als Anteil des Maximums übertragen, nicht als deine eigene Zahl. Ein auf dem Bogen halb gesunder Charakter beginnt den Kampf mit der Hälfte der von Marinara erzeugten Gesundheitsleiste. Dein Gesundheitspool von 9 Punkten wird nie direkt in einen Kampf übernommen, in dem ein Treffer 12 Schaden verursacht.

```json
"battle": {
  "health": { "pool": "grit" },
  "energy": { "pool": "luck" },
  "skills": [{ "list": "knacks" }]
}
```

- `health`: Erforderlich. Der laufende Pool für die Trefferpunkte des Charakters im Kampf. Er muss zu `sheet.live.pools` gehören und darf keine Liste mit Pool-Zeilen sein.
- `energy`: Optional. Ein vom Kampf verbrauchbarer laufender Pool, der zur MP-Leiste wird. Er muss sich von `health` unterscheiden, weil der Kampf keine Trefferpunkte als Energie verbrauchen kann.
- `slots`: Optional. Laufende Pools, aus denen ein Kampf jeweils einen Platz verbraucht, mit einer `level`-Angabe von 1 bis 9: `[{ "pool": "slots_1", "level": 1 }]`. Jede Stufe und jeder Pool dürfen nur einmal vorkommen.
- `skills`: Optional, höchstens acht. Die Bogenlisten, deren Zeilen zu Kampffertigkeiten werden. Es zählen nur Zeilen aus einem deiner Kataloge und nur dann, wenn ihr ursprünglicher Eintrag einen `mechanics`-Block hat. Eine von Hand eingegebene Zeile beschreibt keine Wirkung in Zahlen. `onlyWhen` nennt eine gesetzte boolesche Spalte, etwa für einen vorbereiteten Zauber. `alwaysWhen` nennt eine Spalte samt Wert, die eine Zeile trotzdem zulassen, etwa Zauber, die ohne Vorbereitung gewirkt werden. Das ist eine Ausnahme zu `onlyWhen` und wird ohne diese danebenstehende Angabe abgelehnt.

### Was in den Kampf hinein- und aus ihm herausgetragen wird

**Hinein**, für jedes Gruppenmitglied mit im Spiel vorhandenem Bogen: Der Anteil des Gesundheitspools an seinem Maximum bestimmt die Ausgangsposition auf Marinaras Gesundheitsleiste. Der Energiepool wird zu MP, jeder Platzpool zu den Plätzen seiner Stufe und die markierten Zeilen zu Fertigkeiten. Maximale Trefferpunkte, Angriff, Verteidigung, Geschwindigkeit und Stufe bleiben Marinaras eigene Zahlen. Ein Charakter mit null im Gesundheitspool beginnt am Boden, weil der Bogen das vorgibt. Ein Charakter über null beginnt nie mit weniger als einem Trefferpunkt, damit ein kleiner Anteil niemanden durch Rundung außer Gefecht setzt.

**Heraus**, sobald der Kampf endet: Der verbliebene Anteil der Gesundheitsleiste wird auf die eigene Skala des Gesundheitspools zurückgerechnet. Die Differenz zum Kampfbeginn wird als Schaden oder Heilung angewendet. Energie und Plätze sind Anzahlen statt Anteile und werden unverändert zurückgeschrieben. Alles folgt denselben Regeln wie die Schaltflächen des Bogens. Eine vom Bogen abgelehnte Änderung wird übersprungen und gemeldet, nicht erzwungen. Hat ein Kampf die Trefferpunkte eines Kämpfers nicht verändert, schreibt er überhaupt keine Gesundheitsänderung. Die beiden Umrechnungen können deshalb nicht von selbst einen Bogen verändern.

**In keiner Richtung**: Angriffswürfe, Rettungswürfe, Konzentration und die Zusatzwirkung höherer Kosten. Diese Angaben stehen im `mechanics`-Block für ein echtes Kampfsystem, das sie eines Tages liest. Diese Verbindung wendet sie nicht an; ein Regelsatz sollte das auch nicht behaupten.

Ein abgebrochener Kampf schreibt nichts zurück. Löschst du die Nachricht, in der er begonnen hat, oder erreicht der Kampf sein Ende nicht, bleibt der Bogen genau wie zuvor: Der Kampf hat nicht stattgefunden.

### Wie aus einem Eintrag eine Fertigkeit wird

Der `mechanics`-Block eines Katalogeintrags wird so gelesen:

- `kind` wird zum Typ der Fertigkeit. `utility`-Einträge und alles mit `reaction` entfallen, weil Marinaras Kampfsystem dafür keinen Platz hat.
- `amount` bestimmt die Stärke als Multiplikator des eigenen Angriffs des Kämpfers, nicht als Schadenszahl. Größere Würfel treffen niemals schwächer. Der Multiplikator bleibt im Bereich, den bereits generierte Fertigkeiten verwenden.
- `range` und `area.size` werden durch `units.distance.perCell` des Katalogs geteilt, um Rasterzellen zu erhalten. Sie werden nie auf null abgerundet. Eine Explosion verwendet ihren Radius, ein Kegel dessen Hälfte, eine Linie eine Zelle. Flächeneffekte treffen alle abgedeckten Gegner und beachten `friendlyFire`.
- `damageType` wird zum Element der Fertigkeit. `targets` wird nicht übertragen: Marinaras Kampfsystem entscheidet anhand des Fertigkeitstyps, auf wen Heilung, Verstärkung oder Angriff zielen dürfen.
- `cost` auf dem Energiepool wird zu MP-Kosten; mehrere Energiekosten werden addiert. `cost` von genau einem Zauberplatz verbraucht einen Platz dieser Stufe. Marinaras Kampfsystem berechnet eine Energiemenge oder einen Platz, nie beides. Einträge mit Kosten von zwei Plätzen, Plätzen zweier Stufen oder einem Platz plus Energie werden deshalb im Kampf ausgelassen. Dasselbe gilt für Kosten auf anderen Pools, etwa Trefferpunkten oder Klassenressourcen, weil die Engine sie sonst kostenlos gewähren würde.
- `buff` oder `debuff` wird zu Marinaras eigener Verstärkung oder Schwächung. Andere im Eintragstext versprochene Wirkungen, etwa das Entfernen eines Zustands auf dem Bogen, werden im Kampf nicht angewendet. Lass `mechanics` bei Einträgen weg, deren Wirkung nur außerhalb eines Kampfes sinnvoll ist.

`coverage.combat` bleibt davon getrennt und behält seine Bedeutung: Setze es nur, wenn Kämpfe tatsächlich deinen Systemregeln folgen.

<a id="combat-a-fight-your-own-rules-resolve"></a>

## Kampfregeln: Ein Kampf, den deine eigenen Regeln auflösen

Der obige `battle`-Block stellt einem Kampf die Zahlen des Bogens bereit, während Marinara weiter rechnet. Der optionale `combat`-Block beschreibt dagegen, wie deine Regeln einen Kampf AUFLÖSEN. Er parametrisiert eine von der Engine bereitgestellte Kampfart, genauso wie `resolution` eine Probenart parametrisiert. Jeder Name darin stammt von dir. Derzeit gibt es eine Kampfart.

**Ein Spiel mit einem Regelsatz, der `combat` deklariert, kämpft nach deinem Block.** Die Werte der Gruppe kommen von ihren eigenen Bögen, die Gegner aus deinem Bestiarium oder deiner Bedrohungsskala. Jeder Zug wird mit deinen Würfeln aufgelöst. Alles, was ein Charakter verbraucht oder verliert, wird unmittelbar auf seinen Bogen zurückgeschrieben; das Schließen des Tabs mitten im Kampf verliert also nichts. Der Kampfbildschirm spielt das in deinen Begriffen aus: deine Angriffe und Fähigkeiten im Menü, deine Budgets, deine Zustände und ein Protokoll mit der tatsächlichen Rechnung. Was noch fehlt, steht unter "Noch nicht umgesetzt".

```json
"combat": {
  "kind": "attack-vs-defense",
  "health": { "pool": "grit" },
  "defense": { "derived": "guard" },
  "initiative": { "dice": { "count": 2, "sides": 6 }, "modifier": { "abilityMod": "wits" } },
  "attackRoll": { "dice": { "count": 2, "sides": 6 } },
  "economy": { "budgets": [{ "id": "act", "label": "Action", "per": "turn", "count": 1 }] },
  "attacks": [
    {
      "list": "gear",
      "budget": "act",
      "name": "name",
      "toHit": { "ability": { "column": "swing" } },
      "damage": { "dice": { "column": "damage" }, "ability": { "column": "swing" }, "type": { "column": "harm" } }
    }
  ],
  "abilities": [{ "list": "knacks", "budget": "act" }],
  "standard": ["dodge", "help"],
  "conditions": [
    { "condition": "shaken", "effects": ["own-attacks-disadvantage", "ends-on-damage"] },
    { "condition": "pinned", "effects": ["cannot-act", "speed-zero"] }
  ]
}
```

Das ist der vollständige Ember-Roads-Block, nach dem ein Spiel mit Ember Roads kämpft. Der 5e-Entwurf verwendet dieselben Schlüssel für ein d20-System:

```json
"combat": {
  "kind": "attack-vs-defense",
  "health": { "pool": "hp" },
  "defense": { "field": "ac" },
  "initiative": { "dice": { "count": 1, "sides": 20 }, "modifier": { "derived": "initiative" } },
  "attackRoll": {
    "dice": { "count": 1, "sides": 20 },
    "advantage": true,
    "naturals": { "max": "critical", "min": "miss" },
    "critical": "double-dice"
  },
  "economy": {
    "budgets": [
      { "id": "action", "label": "Action", "per": "turn", "count": 1 },
      { "id": "bonus", "label": "Bonus action", "per": "turn", "count": 1 },
      { "id": "reaction", "label": "Reaction", "per": "turn", "count": 1 }
    ],
    "movement": { "field": "speed" }
  },
  "abilities": [
    {
      "list": "spells",
      "onlyWhen": "prepared",
      "alwaysWhen": { "column": "level", "equals": 0 },
      "budget": "action",
      "toHit": { "derived": "spell_attack" },
      "saveDifficulty": { "derived": "spell_save_dc" }
    }
  ],
  "concentration": { "text": "concentration", "save": "con_save", "floor": 10, "fromDamage": 0.5 }
}
```

### Alle Schlüssel

- `kind`: `"attack-vs-defense"`. Eine Seite würfelt gegen die Verteidigung der anderen; ein Treffer verursacht Schaden.
- `health`: Erforderlich. Was der Kampf abzieht. Entweder `{ "pool": "grit" }`, ein laufender Pool, den er verringert und dessen etwaiger temporärer Puffer zuerst Schaden aufnimmt, oder `{ "track": "harm" }`, eine Wundleiste, die er MARKIERT. Eine Leiste braucht daneben `damageKinds` und gewährt keine temporären Punkte.
- `defense`: Erforderlicher Wertverweis. Ein vom Spieler eingegebenes Feld oder ein von dir berechneter abgeleiteter Wert.
- `initiative`: Erforderlich. Die zu Beginn einmal gewürfelten Würfel und ein optionaler Modifikatorverweis. Bei Gleichstand gewinnt der höhere Modifikator, danach die Reihenfolge beim Aufstellen des Kampfes.
- `attackRoll`: Erforderlich. Die Würfel; ob zweimal gewürfelt und ein Wurf behalten wird (`advantage`); die Wirkung der äußersten Seiten eines einzelnen Würfels (`naturals.max`: `critical`, `hit` oder `none`; `naturals.min`: `miss` oder `none`); und die Wirkung eines kritischen Treffers auf den Schaden (`critical`: `double-dice` würfelt die Schadenswürfel erneut, `max-dice` addiert ihre höchsten Augenzahlen einmal, `none` ist ein gewöhnlicher Treffer). Besondere Augenzahlen setzen wie bei Proben einen einzelnen Würfel voraus. Rettungswürfe im Kampf verwenden dieselben Würfel.
- `economy`: Erforderlich. `budgets` beschreibt, was ein Zug enthalten darf: ID, Beschriftung, `per` (`turn` füllt zu Beginn des eigenen Zuges auf, `round` zu Beginn einer neuen Runde) und `count`. Das ZUERST deklarierte Budget ist das Hauptbudget; es bezahlt Standardaktionen. `movement` ist ein optionaler Wertverweis für die Bewegungsweite eines Zuges in deiner eigenen Entfernungseinheit. Er wird bei Kämpfen auf einem Brett gelesen; siehe Positionen.
- `attacks`: Optional. Bogenlisten, deren Zeilen Waffen sind. `name` nennt die Textspalte für den Zeilennamen, `damage.dice` die Würfelspalte. `toHit.ability`, `toHit.proficiency`, `toHit.bonus`, `damage.ability`, `damage.bonus` und `damage.type` nennen jeweils eine Spalte derselben Liste. Eine `ability`-Spalte ist ein `enum` mit einer deiner Attributs-IDs; andere Werte addieren nichts. Eine `proficiency`-Spalte ist ein `boolean`; ist sie gesetzt, wird dein Übungsbonus addiert. Eine Zeile ohne lesbare Würfel ist kein Angriff. Ein Seil in derselben Liste bleibt also einfach ein Seil. `strikes` ist ein optionaler Wertverweis, der angibt, wie viele Angriffe EIN Verbrauch des Listenbudgets kauft. Wählt der Charakter eine Zeile, während er keine Angriffe in Reserve hat, wird das Budget verbraucht und der Rest vorgemerkt. Solange Angriffe vorgemerkt sind, kostet jede Zeile mit `strikes` überhaupt kein Budget. Andere Waffen, andere Ziele und Bewegung dazwischen ergeben sich so von selbst aus dem Menü. `strikesCappedBy` nennt eine boolesche Spalte, die IHRE EIGENE Zeile auf einen einzelnen Angriff begrenzt, egal wie viele die Liste kauft. Das ist für Waffen gedacht, die pro Zug nur einmal schießen, unabhängig von der Angriffsanzahl ihres Trägers; dafür steht die Loading-Eigenschaft von SRD 5.1. Bei einer Liste, die ohnehin nur einen Angriff pro Budgetverbrauch kauft, wäre das bedeutungslos und wird abgelehnt. Die vorgemerkten Angriffe gehören dem KÄMPFER, nicht einer Liste. Deklarieren zwei Waffenlisten eines Charakters beide `strikes`, greifen ihre Zeilen auf denselben Vorrat zu. Er wird am Ende des Zuges gelöscht, der ihn gekauft hat. Ohne Angabe kauft die Liste einen Angriff pro Budgetverbrauch, wie alle Kämpfe vor dieser Erweiterung.

  ```json
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "strikes": { "field": "attacks_per_action" },
    "damage": { "dice": { "column": "damage" } }
  }
  ```

- `abilities`: Optional. Bogenlisten, deren katalogmarkierte Zeilen Fähigkeiten sind, mit denselben Filtern `onlyWhen` und `alwaysWhen` wie `battle.skills`. Die Wirkung bestimmt `mechanics` des jeweiligen Eintrags. Der Block legt das standardmäßig verbrauchte `budget`, den addierten `toHit` eines Angriffswurfs und die `saveDifficulty` für Rettungswürfe gegen den Eintrag fest. Ein Eintrag mit einem eigenen Rettungswurf oder einem zum Beenden eines angewendeten Zustands wird abgelehnt, wenn seine Zielliste keine `saveDifficulty` hat: Ein Rettungswurf gegen nichts wäre immer erfolgreich.
- `standard`: Optional, aus der geschlossenen Liste `dash`, `disengage`, `dodge`, `help`, `hide`, `ready`. `dodge` (Angriffe gegen den Ausweichenden werden zweimal gewürfelt, der schlechtere Wurf zählt) und `help` (der nächste Angriff des unterstützten Verbündeten wird zweimal gewürfelt, der bessere zählt) werden immer aufgelöst. `dash` (noch einmal dieselbe Bewegungsweite) und `disengage` (in diesem Zug greift dich niemand für das Weggehen an) werden auf einem Brett aufgelöst und ohne Brett nur protokolliert. `hide` und `ready` werden angenommen, bewirken aber noch nichts.
- `standardEffects`: Optional, für den Teil einer Standardaktion, den ihr Kennzeichen nicht ausdrückt. Derzeit gibt es das nur für `dodge`: `{ "dodge": { "saves": ["dex_save"] } }` nennt die Rettungswürfe, die ein ausweichender Charakter für die Dauer des Ausweichens zweimal würfelt, wobei der bessere zählt. Nenne nur auf dem Bogen deklarierte Rettungswürfe und nur dann, wenn `standard` auch `dodge` enthält. Ohne diese Angabe bleibt Ausweichen wie bisher: schwerer zu treffen und sonst nichts.
- `conditions`: Optional. Bildet DEINE Zustands-IDs auf ihre Wirkungen ab. Bogen und Kampf verwenden dadurch dieselben Zustände, und ein vergifteter Charakter bleibt danach vergiftet. Die Wirkungsliste ist geschlossen: `own-attacks-advantage`, `own-attacks-disadvantage`, `attacks-against-advantage`, `attacks-against-disadvantage`, `attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `cannot-act`, `cannot-react`, `speed-zero`, `half-move-to-stand`, `ends-on-damage`, `own-saves-advantage`, `own-saves-disadvantage`, `resist-all`, `cannot-target-source` und `cannot-approach-source`. `failsSaves` nennt Rettungswürfe, die der Zustand ohne Wurf scheitern lässt. Die sechs Wirkungen mit Entfernungs- oder Bewegungsbezug (`attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `speed-zero`, `half-move-to-stand`, `cannot-approach-source`) werden auf einem Brett gelesen und sagen ohne Brett nichts aus; siehe Positionen. `cannot-react` hält den betroffenen Charakter aus dem durch Bewegung geöffneten Fenster heraus; er wird nie gefragt. Drei weitere Schlüssel stehen neben den Wirkungen:
  - `saves`: Welche deiner Rettungswürfe die beiden Rettungswurfwirkungen betreffen. Ohne Angabe gelten sie für alle. Eine Angabe ohne eine dieser beiden Wirkungen wird abgelehnt.
  - `whileSourceInSight`: Was nur gilt, solange der Verursacher im Sichtfeld des Betroffenen ist. `true` macht den gesamten Zustand davon abhängig. Eine Liste eigener Wirkungen begrenzt nur diese und lässt den Rest bestehen. Das braucht etwa eine Furchtwirkung, die weiteres Annähern unabhängig davon verhindert, ob die Quelle sichtbar ist. Eine nicht im Zustand enthaltene Wirkung wird abgelehnt. Ohne Brett kann keine Sichtlinie unterbrochen werden; dann gilt alles in beiden Fällen.
  - `endsWhenSourceDown`: Der Zustand endet, sobald sein Verursacher zu Boden geht.

  `own-saves-advantage` und sein Gegenstück würfeln den Rettungswurf wie einen Angriff zweimal und behalten einen Wurf; sie heben sich gegenseitig auf. `resist-all` halbiert jede Schadensart zusätzlich zu den eigenen Resistenzen des Ziels und hebt sich auf dieselbe Weise mit einer Verwundbarkeit auf. `cannot-target-source` verhindert, dass der Betroffene irgendetwas auf den Verursacher richtet. `cannot-approach-source` verhindert, dass er näher an diese Person herangeht als seine aktuelle Zelle, einschließlich des gesamten Weges. Ein Umweg zu einer ebenso weit entfernten Zelle wird weiterhin angeboten; ein Weg, der zwischendurch näher vorbeiführt und auf der anderen Seite endet, nicht.

  ```json
  { "condition": "restrained", "effects": ["own-saves-disadvantage"], "saves": ["dex_save"] }
  ```

- `concentration`: Optional. Das laufende `text`-Feld für die aufrechterhaltene Wirkung, der durch Schaden erzwungene `save`, die Untergrenze `floor` der Schwierigkeit und `fromDamage`, der Anteil des erlittenen Schadens, der sie bei einem höheren Wert bestimmt. Der Beginn einer zweiten Konzentrationsfähigkeit beendet die erste. Ein misslungener Rettungswurf beendet sie und entfernt die von ihr aufrechterhaltenen Zustände.
- `dying`: Optional, `kind: "saves"`. Die beiden Leisten für die Würfe – die nötige Anzahl entspricht jeweils ihrem Maximum –, die `dice`, `succeedAt`, die Wirkungen der äußersten Augenzahlen (`naturals.max`: `revive-1` oder `success`; `naturals.min`: `one-failure` oder `two-failures`), die Kosten von Schaden am Boden (`damageWhileDown`, `criticalWhileDown`) und die `condition` eines niedergestreckten Charakters. Ohne diesen Block liegt ein Charakter bei null einfach am Boden und wird durch Heilung wieder aufgerichtet.
- `damageTypes`: Optional. Die Schadenstypen deines Systems, ohne Beachtung der Groß- und Kleinschreibung abgeglichen.
- `damageKinds`: Erforderlich, wenn `health` eine Wundleiste nennt, und bei einem Pool abgelehnt. Nur eine Markierung trägt eine Art; ein Punktepool hat keinen Speicherplatz dafür. Siehe Wundleisten oben. Der Block bestimmt, welche der `kinds` der Leiste ein Treffer markiert und wie viele Kästchen er ankreuzt. `default` gilt für alles nicht Zugeordnete, einschließlich Treffern ganz ohne Typ. `byType` bildet deine `damageTypes` auf Arten ab. Die Schlüssel werden wie die Typen ohne Beachtung der Groß- und Kleinschreibung abgeglichen; `"Fire"` und `"fire"` sind daher ein Schlüssel, und die Angabe beider wird abgelehnt. `marks` hat keinen Standard, weil die beiden Antworten gegensätzlich sind: `"per-point"`, wenn der Schadenswurf Gesundheitsstufen zählt – drei Schaden markieren drei Kästchen, und ein Punkt Schadensminderung lohnt sich –, oder `"per-blow"`, wenn nur zählt, ob ein Treffer ankommt – dann markiert er unabhängig von seiner Stärke ein Kästchen. Auch ein Treffer mit mehreren Schadensbestandteilen markiert dabei nur ein Kästchen und verwendet die schwerste angekommene Art. Gib an, welches Modell dein System nutzt. `{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`.
- `threat`: Optional und für ein Bestiarium erforderlich. `tiers` ist die Skala für die Gegnerauswahl: ID, Beschriftung, `health`-Bereich, `defense`, `toHit`, `damagePerRound`-Bereich und `saveDifficulty`. Jede ausgelieferte Kreatur nennt eine dieser Stufen. Ein nicht vorab geschriebener Gegner wird auf die vom Game Master gewünschte Stufe begrenzt, damit nichts außerhalb deiner Skala landet. Der Bereich `damagePerRound` beschreibt den Schaden einer Kreatur gegen EIN Ziel pro Runde, einschließlich ihrer gesamten Angriffsfolge.

### Was ein Kampf aus `mechanics` liest

`kind` entscheidet, ob `amount` Schaden oder Heilung bedeutet. Alles mit `reaction` fehlt im Menü, ebenso `utility`, sofern der Eintrag nicht verändert, was der Zug selbst enthalten darf; siehe unten. `attackRoll` würfelt mit dem `toHit` der Liste gegen die Verteidigung des Ziels; `autoHit` überspringt das vollständig. `save` würfelt den eigenen Rettungswurf des Ziels gegen die `saveDifficulty` der Liste. `onSuccess` legt fest, ob bei Erfolg die Hälfte oder nichts übrig bleibt. `targetCount` bestimmt die Zahl der Ziele. Eine Fähigkeit ohne Angriffswurf – etwa eine Fläche mit Rettungswürfen für alle oder ein automatischer Treffer – würfelt ihre Würfel EINMAL für alle Ziele. Eine Fähigkeit mit Angriffswurf je Ziel würfelt ihren Schaden bei jedem Treffer neu. `applies` setzt Zustände auf die betroffenen Ziele. Jeder hat eine `duration` von `instant` (ohne eigene Zeitbegrenzung; er bleibt, bis etwas ihn entfernt), `until-save` (braucht daneben `saveEnds`) oder `{ "rounds": n }`. Optional nennt `saveEnds` den Rettungswurf und dessen Wiederholung bei `turn-end` oder `turn-start`. `temporary` gewährt temporäre Punkte auf dem Gesundheitspool. Sie addieren sich nie; der größere Puffer bleibt. `scales` erhöht die Menge um die zusätzlichen WÜRFEL, die seine Tabelle für den gelesenen Wert vorgibt. `cost` wird über den eigenen `use`-Befehl des Bogens bezahlt. `budget` überschreibt den verbrauchten Teil des Aktionsbudgets.

`plus` enthält neben `amount` bis zu drei WEITERE Mengen desselben Treffers. Jede wird getrennt gewürfelt und typisiert, etwa "und 2d6 Feuer". Ein Bestandteil lautet `{ "dice": "2d6", "flat": 1, "type": "fire" }` und kann einen eigenen `save` tragen: `{ "save": "con_save", "difficulty": 13, "onSuccess": "none" | "half" }`. Diesen würfelt das ZIEL unabhängig von den bisherigen Anforderungen der Aktion. Bei Erfolg lässt `none` nichts von diesem Bestandteil übrig und `half` die Hälfte; der Rest des Treffers bleibt in beiden Fällen unberührt. Ohne `difficulty` wird die Zahl des Rettungswurfs der Aktion verwendet, danach die `saveDifficulty` der Liste. Ein kritischer Treffer verdoppelt die Würfel jedes Bestandteils nach derselben Regel wie die der ersten Menge. Ein Bestandteil ohne `type` verwendet die Schadensart des Treffers. Der gesamte Treffer bleibt EINE Konzentrationsprüfung mit dem summierten Schaden und eine Prüfung auf Niedergeschlagenwerden. Ein Bestandteil braucht ein `amount`, zu dem er gehört; `heal` trägt keinen.

```json
{
  "kind": "attack",
  "attackRoll": true,
  "amount": { "dice": "1d8" },
  "damageType": "piercing",
  "plus": [{ "dice": "2d6", "type": "fire" }]
}
```

Drei Schlüssel beschreiben die Wirkung eines Eintrags auf das Aktionsbudget des Zuges. Ein `utility`-Eintrag mit mindestens einem davon wird angeboten statt verworfen:

- `free`: Der Eintrag kostet überhaupt kein Budget. Die unter `cost` genannten Ressourcen werden trotzdem bezahlt. Gleichzeitig darf kein `budget` angegeben sein.
- `gives`: Bis zu vier Angaben wie `[{ "budget": "action", "count": 1 }]`. Die Nutzung erhöht diese Budgets sofort. Der neue Bestand ist auf das normale Zugbudget plus Zugabe begrenzt, damit sich nichts für spätere Züge ansparen lässt.
- `standard`: `{ "actions": ["dash", "disengage", "hide"], "budget": "bonus" }`. Der Besitzer darf diese Standardaktionen mit DIESEM Budget bezahlen. Sie werden neben den gewöhnlichen Aktionen als `standard:<id>@<budget>` angeboten. Besteht der Eintrag nur aus dieser Erlaubnis, bleibt er selbst dem Menü fern, denn eine Erlaubnis ist keine auswählbare Aktion.

Ein Eintrag mit dem neuen `kind: "rider"` ist PASSIV: Niemand wählt ihn aus, er steht nie im Menü und fügt dem ersten passenden Treffer eines Zeitraums automatisch einen weiteren Schadensbestandteil hinzu. Er trägt `rider` und keine anderen aktiv auszuführenden Angaben:

```json
{
  "kind": "rider",
  "rider": {
    "on": "hit",
    "sources": ["attacks"],
    "requires": { "column": "finesse" },
    "when": ["advantage", "ally-adjacent"],
    "oncePer": "turn",
    "amount": { "dice": "1d6" }
  },
  "scales": {
    "from": { "field": "level" },
    "table": [
      [1, 0],
      [3, 1]
    ]
  }
}
```

`sources` nennt die Angriffslisten, von denen der Effekt ausgeht, und `requires` eine als wahr gewertete Spalte ihrer Zeilen. So kann ein Zusatzeffekt seine Einschränkung auf bestimmte Waffen beschreiben, ohne dass die Engine wissen muss, was eine Waffe ist. Fehlen beide Angaben, gilt jeder Treffer des Besitzers. Bei `when` reicht EINE Bedingung: `advantage` ist der letztlich angewendete Vorteil des Angriffswurfs. `ally-adjacent` ist ein aufrecht stehender, handlungsfähiger Verbündeter des Angreifers, auf einem Brett höchstens eine Zelle vom Ziel entfernt und ohne Brett an beliebiger Position. `oncePer` ist `turn` (frisch zu Beginn jedes Zuges, damit auch ein Angriff während eines fremden Zuges einen Zusatzeffekt tragen kann) oder `round`. `amount` wächst mit den eigenen `scales` des Eintrags. `type` ist die Schadensart und verwendet standardmäßig die des Treffers.

<a id="creatures-a-bestiary-a-fight-reads"></a>

### Kreaturen: Ein Bestiarium für Kämpfe

Ein Katalog mit `"holds": "creatures"` enthält Gegner statt Bogenzeilen. Er befüllt keine Liste, wird nie in der Auswahl des Bogeneditors angeboten und verwendet für jede Zahl die bereits von deinem `combat`-Block deklarierten Schlüssel. Er braucht einen `combat`-Block und eine `threat`-Skala, weil jede Kreatur einer deiner eigenen Stufen zugeordnet wird.

```json
{
  "id": "road_trouble",
  "label": "Road trouble",
  "holds": "creatures",
  "filters": [{ "id": "tier", "label": "How bad", "type": "text" }],
  "entries": [
    {
      "id": "rust-jackal",
      "label": "Rust Jackal",
      "summary": "A lean thing that lives on the metal roads.",
      "filters": { "tier": "Pack trouble" },
      "creature": {
        "health": { "dice": "3d6" },
        "defense": 6,
        "initiativeModifier": 1,
        "speed": 16,
        "abilities": { "brawn": 1, "wits": 0, "heart": -1 },
        "tier": "pack",
        "actions": [
          {
            "id": "bite",
            "name": "Bite",
            "budget": "act",
            "toHit": 2,
            "damage": { "dice": "1d6", "flat": 1, "type": "cut" },
            "reach": 2
          },
          {
            "id": "worry",
            "name": "Worry",
            "budget": "act",
            "toHit": 2,
            "damage": { "dice": "1d4", "type": "cut" },
            "applies": [{ "condition": "shaken", "duration": { "rounds": 2 } }]
          },
          {
            "id": "snap_and_worry",
            "name": "Snap and worry",
            "budget": "act",
            "sequence": [
              { "action": "bite", "times": 1 },
              { "action": "worry", "times": 1 }
            ]
          }
        ]
      }
    }
  ]
}
```

Die folgenden Zahlen sind die direkte Schreibweise für eine Kreatur. Eine in den eigenen Begriffen deines Regelsatzes als `sheet` geschriebene Kreatur liest `health`, `defense`, `initiativeModifier`, `speed`, `abilities` und `saves` stattdessen aus diesem Bogen; siehe unten "Eine Kreatur in den eigenen Begriffen deines Regelsatzes".

- `health`: Eine Zahl oder `{ "dice": "3d6", "flat": 2 }`, einmal beim Erstellen des Kampfes gewürfelt. Eine Vorschau verwendet den Durchschnitt, damit das Menü keinen ungewürfelten Wert verspricht.
- `defense`, `initiativeModifier`, `speed`: Der Zielwert eines Angriffs, der Initiativmodifikator und die Bewegungsweite pro Zug in deiner eigenen Entfernungseinheit.
- `abilities` und `saves`: Zuordnungen anhand der Attributs- und Rettungswurf-IDs deines Bogens. Ein nicht genannter Rettungswurf wird als null gelesen.
- `resist`, `vulnerable`, `immune`: Schadenstypen, ohne Beachtung der Groß- und Kleinschreibung abgeglichen und bei vorhandener Deklaration gegen `combat.damageTypes` geprüft. `conditionImmunities` nennt deine eigenen Zustände.
- `tier`: Die zugehörige Stufe von `combat.threat`.
- `traits`: Kurze Paare aus Name und Text für den Game Master. Sie werden nie regeltechnisch aufgelöst. Alles mit Zahlen gehört deshalb in eine Aktion.
- `signaturePoints`: Punkte, die zu Beginn des eigenen Zuges zurückkehren und für `signature`-Aktionen ausgegeben werden.
- `riders`: Bis zu vier Zusatzeffekte wie `rider` an einem Katalogeintrag, hier direkt im Block. Jeder hat die Form `{ "id": "pack", "name": "Pack", "on": "hit", "oncePer": "turn" | "round", "amount": { "dice": "1d6" } }`, mit optionalem `type` und optionalen `actions` für die eigenen Aktionen dieses Blocks, bei denen er auslöst. Ein Block-Zusatzeffekt liest keine Bogenliste; deshalb hat er die Schlüssel `sources` und `requires` nicht. Eine als Bogen geschriebene Kreatur erhält wie ein Charakter die Zusatzeffekte ihrer Listen.
- `actions`: Bis zu zwölf, jeweils mit eigener `id`. Eine Aktion enthält die Angaben eines handgeschriebenen Werteblocks (`toHit`, `autoHit`, `damage`, `save`, `applies`, `targetCount`, `reach`, `range`, `area`) sowie vier nur für Kreaturen vorgesehene Angaben. `reach` ist die Nahkampfreichweite, `range` die Wurf- oder Schussreichweite und `area` die betroffene Form, alles in deiner eigenen Entfernungseinheit. `range` darf eine einfache Zahl sein oder `{ "normal": 30, "long": 120 }`, wenn größere Entfernung mit einem Abzug erreichbar bleibt. `area` lautet `{ "shape": "burst" | "cone" | "line", "size": n, "friendlyFire": false }`; siehe Positionen:
  - `uses`: `{ "per": "encounter" | "day", "count": n }`. Sind die Nutzungen aufgebraucht, verschwindet die Aktion aus dem Menü.
  - `recharge`: `{ "dice": { "count": 1, "sides": 6 }, "from": 5 }`. Die Aktion beginnt verfügbar, wird bei Nutzung verbraucht und würfelt zu Beginn des eigenen Zuges der Kreatur. `from` oder höher stellt sie wieder her. Das Protokoll zeigt die Würfel in beiden Fällen.
  - `sequence`: Andere Aktionen desselben Blocks in Reihenfolge, jede mit eigenem Ziel. **So wird eine Kreatur geschrieben, die mit einer Aktion zweimal angreift.** Ein Budget bezahlt die gesamte Folge. Eine Folge hat keine eigenen Wirkungen und darf nie eine andere Folge nennen.
  - `signature`: `{ "cost": n }`, bezahlt mit den eigenen Punkten der Kreatur statt mit einem Budget und nur, während jemand anderes handelt. Der Kampf bietet sie im Fenster zwischen zwei Zügen an; siehe Fenster.
- Ein Rettungswurf braucht eine Schwierigkeit an der Aktion selbst: `save.difficulty` für einen durch die Aktion erzwungenen Rettungswurf oder `saveDifficulty` für einen durch Rettungswurf endenden Zustand, wenn die Aktion keinen eigenen Rettungswurf hat. Auch bei einer Kreatur mit Bogen wird eine Blockaktion in direkten Zahlen geschrieben; die Schwierigkeit steht daher an der Aktion. Der eigene Rettungswurf eines Schadensbestandteils darf seine `difficulty` auslassen und auf dieselbe Zahl zurückgreifen.
- `damage.plus` ist dieselbe Liste von Schadensbestandteilen wie `plus` an einem Katalogeintrag und wird genauso gelesen: `"damage": { "dice": "1d6", "flat": 2, "type": "piercing", "plus": [{ "dice": "1d4", "type": "fire" }] }` beschreibt einen Biss mit eigenem Feuerschaden, auf den Resistenzen und Verdopplung getrennt angewendet werden.

Das Bestiarium des 5e-Entwurfs enthält fünf handgeschriebene Kreaturen in `docs/development/ruleset-5e-2014.example.json`. Sie decken eine Aktionsfolge, Wiederaufladung, einen Rettungswurf mit Zustand, Resistenzen und Immunitäten, begrenzte Nutzungen, Signaturpunkte und eine als Bogen geschriebene Kreatur ab.

#### Eine Kreatur in den eigenen Begriffen deines Regelsatzes

Eine Kreatur muss nicht mit direkten Zahlen geschrieben werden. Gib ihr stattdessen ein `sheet` mit genau derselben Form wie ein Charakterbogen. Der Kampf baut sie dann wie ein Gruppenmitglied: Gesundheit, Verteidigung, Rettungswürfe, Initiative, Geschwindigkeit sowie sämtliche Angriffe und Fähigkeiten ihrer Listen ergeben sich aus deinen Bogenformeln. So sagt ein Regelsatz, dass seine Gegner dieselben Attribute, Fertigkeiten und Listen wie seine Charaktere haben, unabhängig von deren Ausgestaltung. Der Toll Warden aus Ember Roads:

```json
{
  "id": "toll-warden",
  "label": "Toll Warden",
  "creature": {
    "tier": "pack",
    "traits": [{ "name": "Knows the road", "text": "It will not follow anyone past the last milestone." }],
    "sheet": {
      "abilities": { "brawn": 2, "wits": 1, "heart": 1 },
      "skills": { "sway": "trained" },
      "fields": { "calling": "Hauler", "toughness": 3 },
      "lists": {
        "gear": [{ "name": "Toll hook", "swing": "brawn", "damage": "1d6", "harm": "cut" }],
        "knacks": [{ "name": "Hold the Line", "_catalog": "knacks/hold-the-line" }]
      }
    }
  }
}
```

- **Jeder Teil ist optional**: `abilities`, `skills`, `saves`, `bonuses`, `fields` und `lists`, mit den vom Bogen deklarierten IDs als Schlüssel. Ausgelassene Angaben verwenden die eigenen Bogenstandards, genau wie ein leerer Charakter. Grit des Wächters ist 9, weil dein `grit_max` 4, seine Toughness und sein Brawn addiert. Guard ist aus einem ähnlichen Grund 7.
- **Jede Zahl hat genau eine Quelle.** Eine Kreatur mit Bogen gibt nicht zusätzlich `health`, `defense`, `initiativeModifier`, `speed`, `abilities` oder `saves` an. Tut sie es doch, lehnt die Engine die Datei ab. Sie darf ohne eigene `actions` auskommen, weil ihre Listen ihr Handeln beschreiben. Eine Kreatur ohne Bogen gibt weiterhin die ersten drei Werte und mindestens eine Aktion an.
- **Die Angaben werden als verfasste Daten geprüft.** Jede ID muss im Bogen deklariert sein. Eine Fertigkeit oder ein Rettungswurf verwendet eine dafür angebotene Ausbildungsstufe. Ein Feld, Wert, Bonus oder eine Spalte enthält genau den deklarierten Typ – eine ganze Zahl im erlaubten Bereich, einen angebotenen Auswahlwert und so weiter. Eine Liste enthält höchstens die erlaubte Zeilenzahl. Es gibt keinen `live`-Teil, denn den Verbrauch einer Kreatur verwaltet der Kampf.
- **Eine Zeile kann aus einem Katalog stammen.** `_catalog: "<catalog>/<entry>"` nennt wie auf einem Charakterbogen den gewählten Eintrag. Von dort liest der Kampf Kosten und Wirkung der Zeile. Der Katalog muss diese Liste befüllen. Bei einem direkt eingebetteten Katalog muss der Eintrag vorhanden sein. Bei einer separaten Katalogdatei gewährt eine Zeile mit nicht vorhandenem Eintrag der Kreatur schlicht nichts. Die von Bestiariumbögen genannten Kataloge werden zusammen mit dem Bestiarium für den Kampf geladen.
- **Die Angaben neben dem Bogen gelten weiter**: `tier`, `traits`, `actions`, `signaturePoints`, `riders`, `resist`, `vulnerable`, `immune` und `conditionImmunities`.
- **Sie bezahlt aus ihren eigenen Pools.** Diese starten voll und bezahlen, was ihre Listen anbieten. Größere Zahlungsmöglichkeiten, etwa ein Zauber aus einem höheren Platz, werden genauso wie bei Gruppenmitgliedern angeboten – unabhängig davon, ob die Engine oder der Game Master entscheidet. Hold the Line kostet den Wächter Luck.
- **Bei einer Wundleiste ist die Leiste ihre Gesundheit.** Ein Treffer markiert die eigene Leiste der Kreatur nach deinen `damageKinds`, nachdem `resist`, `vulnerable` und `immune` angewendet wurden. Eine gegen eine Schadensart immune Kreatur erhält dadurch keine Markierung.
- **Sie bleibt ein Gegner.** Bei null scheidet sie aus, statt im Sterben zu liegen, und macht nie Todesrettungswürfe. Der Bildschirm zeigt die üblichen Gegnerangaben und nichts von ihrem Bogen. Verbrauch wird nirgendwo zurückgeschrieben, auch nicht bei einem namensgleichen Charakter.
- **Ein Bogen, der insgesamt keine Gesundheit ergibt**, wird aus dem Kampf ausgelassen und im Eröffnungsprotokoll begründet, statt als unverwundbares Wesen aufzutreten.
- Eine Ebene, die einen Wert aus einem deiner Enum-Felder entfernt, entfernt niemals eine Kreatur, die ihn verwendet. Solange die Ebene aktiv ist, liest dieses Feld für die Kreatur wie für einen Charakter seinen Standardwert. Die Kreatur wird deswegen nicht abgelehnt.
- Auch der Game Master kann eine solche Kreatur erfinden. Sie wird auf ihre Stufe begrenzt; siehe "Nicht vorab geschriebene Gegner".
- Ein Paket mit einer solchen Kreatur deklariert Capability API 1.34.

Der Toll Sergeant des 5e-Entwurfs setzt dasselbe auf einem d20-Bogen um: Rüstungsklasse, Trefferpunkte, Rettungswürfe und zwei Angriffe pro Aktion stammen alle aus seinen eigenen Feldern und seiner Angriffsliste.

#### Nicht vorab geschriebene Gegner

Erfindet der Game Master einen Gegner, begrenzt die Engine den Vorschlag vor jedem Wurf auf deine `threat`-Skala: Gesundheit auf den Stufenbereich, Verteidigung, Trefferbonus und Rettungswurfschwierigkeiten auf höchstens zwei über den jeweiligen Stufenwert. Der Schaden wird so weit verringert, bis die beste Runde der Kreatur – ihre stärkste Folge oder Einzelaktion gegen ein Ziel – innerhalb von `damagePerRound` der Stufe liegt. Zuerst sinkt die Würfelzahl, dann der feste Anteil, dann wird ein Angriff aus einer Folge entfernt und erst danach die Würfelgröße reduziert. Nichts wird auf null reduziert. Im Regelsatz unbekannte Namen werden entfernt: unbekannte Schadenstypen, Zustände und Rettungswürfe sowie alles nach den ersten sechs Aktionen. Eine nicht deklarierte Stufe fällt auf die unterste deiner Skala zurück. Jede Änderung wird als einfacher Satz zurückgegeben, damit das Protokoll sie erklären kann.

Auch eine erfundene Kreatur darf wie eine Bestiariumkreatur als `sheet` geschrieben sein. So erhält ein erfundener Magier Plätze und Zauber. Der Game Master sieht die IDs deines Bogens samt erlaubten Inhalten, die vom Kampf gelesenen Listen und die dafür in deinen Katalogen angebotenen Namen. Ein Zauber wird dadurch benannt statt beschrieben: Eine Zeile, die einen Katalogeintrag ohne Beachtung der Groß- und Kleinschreibung nennt, wird zu diesem Eintrag. Die eigenen Werte des Game Master, etwa ob der Zauber vorbereitet ist, werden darübergelegt. Der Bogen wird nachsichtig gelesen, weil er von einem Modell stammt. Unbekannte Namen entfallen, Werte werden an ihr Feld oder ihre Spalte angepasst, und neben dem Bogen geschriebene Zahlen werden nicht verwendet.

Eine erfundene Kreatur, die kein Boss ist, bleibt auf das vom Regelsatz Erlaubte beschränkt. Ein Katalogfilter mit `startFrom` nennt das Bogenfeld, nach dem seine Einträge geordnet sind – etwa `class` für die Zauberliste des 5e-Pakets. Eine erfundene Kreatur behält nur Einträge, deren Filter zu ihrem eigenen Feldwert passt, mit demselben Abgleich wie beim Öffnen der Auswahl. Ein Sorcerer erhält also niemals die gesamte Zauberliste. Ohne Klassenangabe erhält eine Kreatur nichts aus einem nach Klassen geordneten Katalog. Offengelassene Entscheidungen werden anschließend ohne erneute Anfrage an den Game Master ergänzt. Für jede Liste, deren Zeilen erst nach Auswahl zählen (`onlyWhen` an einer Kampffähigkeitsquelle), werden aus den erlaubten und aus eigenen Pools bezahlbaren Einträgen einige je vorhandenen Pool ausgewählt, ebenso für beliebig oft nutzbare Fähigkeiten. Kompetentere Kreaturen erhalten mehr Einträge. Die Auswahl berücksichtigt dasselbe Temperament und dieselbe Kompetenz wie ihr Kampfverhalten: schützende oder unterstützende Kreaturen bevorzugen Hilfen für ihre Seite, rücksichtslose Schaden, methodische oder geduldige die Behinderung von Gegnern. Mit steigender Kompetenz werden Reaktionen, Gegenzauber und andere Eingriffe in den Zug wahrscheinlicher. Die Auswahl verwendet den Seed des Kampfes; derselbe Kampf wird deshalb immer gleich ergänzt. Eine vom Game Master genannte Zeile aus einer solchen Liste gilt als ausgewählt.

Einen Boss darf der Game Master als mögliche Ausnahme vollständig selbst schreiben. Bei ihm wird nichts entfernt und nichts ergänzt.

Danach werden beide auf ihre Stufe begrenzt:

- Gesundheit wird über das einzelne Feld, aus dem sie gelesen wird, in den Stufenbereich gebracht. Das Pool-Maximum ist dieses Feld oder eine `sum` mit genau einem Feld darin, etwa das Trefferpunktemaximum in 5e oder Toughness in Ember Roads. Eine Gesundheitsformel ohne ein solches einzelnes Feld bleibt unverändert; das Protokoll erklärt das. Die Länge einer Wundleiste stammt von dir und wird nie verändert.
- Nach dem Aufbau der Kreatur werden Verteidigung, Trefferbonus und Rettungswurfschwierigkeiten auf zwei über dem Stufenwert begrenzt. Der Schaden sinkt, bis ihre beste Runde innerhalb von `damagePerRound` liegt, unter Berücksichtigung der höchsten bezahlbaren Kosten. Zuerst wird die Zusatzwirkung höherer Zahlungen reduziert, dann die Würfel, der feste Anteil, ein Angriff und erst zuletzt die Würfelgröße.

Dein eigenes Bestiarium wird niemals begrenzt. Seine Daten stammen von dir; die Engine übernimmt sie so, wie du sie geschrieben hast.

### Positionen: Ein Kampf auf einem Brett

Ein Kampf bleibt in der Vorstellung, bis dein Block den Wert einer Brettzelle angibt. Mit `distance` kann er auf einem Raster stattfinden. Dann bekommen Bewegung, Nah- und Fernkampfreichweiten, Flächen, Sichtlinien, Deckung und Angriffe auf Weggehende eine Bedeutung. Jede Zahl stammt von dir; die Engine stellt nur das Brett bereit.

```json
"distance": { "label": "ft", "perCell": 5 },
"ranged": { "long": "disadvantage", "adjacentFoe": "disadvantage" },
"cover": { "bonus": 2 },
"opportunity": { "budget": "reaction" }
```

Ember Roads deklariert davon eine einzige Zeile und sonst nichts. Genau darum geht es: Der Rest ist nicht erforderlich.

```json
"distance": { "label": "paces", "perCell": 2 }
```

**Die Zelle.** `distance.perCell` gibt an, wie viel DEINER Einheit eine Zelle entspricht. `label` benennt diese Einheit. Alle Entfernungen des Blocks verwenden sie: `economy.movement`, `speed` einer Kreatur, `reach` und `range` einer Waffe sowie `reach` und `range` einer Kreaturenaktion. Ein Katalog mit eigenen `units.distance` rechnet seine `mechanics.range` und `area.size` mit seinem eigenen `perCell` um; ohne eigene Angabe verwendet er diese. Eine positive Entfernung wird auf die nächste Zelle gerundet, niemals auf null. Alles mit einer positiven Zahl reicht daher mindestens eine Zelle weit. Null ist keine kurze Entfernung, sondern behält ihre eigene Bedeutung: `mechanics.range` gleich 0 bedeutet selbst oder Berührung; eine Berührung eines anderen reicht bis in die Nachbarzelle. Eine Waffenzeile mit 0 in ihrer `reach`- oder `range`-Spalte hat dagegen keine entsprechende Entfernung.

**Ob ein Kampf auf einem Brett stattfindet.** Zwei Voraussetzungen müssen erfüllt sein: Dein Block deklariert `distance`, und das Spiel ist auf den Kampfstil **Tactical** eingestellt. Mit **Classic** oder einem Regelsatz ohne `distance` bleibt der Kampf wie bisher in der Vorstellung: Jeder kann jeden anvisieren, und nichts von den folgenden Angaben wird gelesen.

**Was Spieler sehen.** Das Brett wird mit dem Gelände des taktischen Stils gezeichnet. Jedes Feld ist eine Schaltfläche, per Zeiger oder Pfeiltasten erreichbar, und nennt seine Art, seine Belegung und seine Bedeutung für die angefangene Auswahl. Bei Bewegung leuchten die vom Menü angebotenen Felder auf, jeweils mit Kosten IN DEINER EINHEIT. Der Weg wird eingezeichnet. Felder, deren Weg einen Angriff provoziert, erscheinen bernsteinfarben; unter dem Brett werden die Angreifer genannt. Eine Option mit Zielauswahl hebt erlaubte Ziele gleichzeitig auf dem Brett und in der Liste hervor. Eine Option mit `area` zielt auf ein Feld. Das Feld unter dem Zeiger zeigt die Betroffenen, einschließlich Verbündeter. Die verbleibende Bewegungsweite steht neben deinen Budgets, wieder in deiner Einheit. Der Bildschirm misst nichts davon selbst: Jedes Feld, jede Kostenangabe, jeder Weg, jedes Ziel und jeder Zielpunkt kommen vom Server.

**Bewegung.** Die Zugreichweite ist `economy.movement` eines Gruppenmitglieds oder `speed` der Kreatur, geteilt durch `perCell` und ABGERUNDET, mindestens aber eine Zelle, solange Bewegung überhaupt möglich ist. Sie füllt sich zu Beginn des eigenen Zuges auf und darf vor, zwischen und nach Aktionen verbraucht werden: gehen, angreifen, weitergehen. Ein Feld kostet beim Betreten einen Punkt, schwieriges Gelände mehr. Es gibt acht Richtungen mit gleichen Kosten, wie auf den dafür vorgesehenen Tischrollenspielrastern. Verbündete dürfen passiert werden, doch auf niemandem darf die Bewegung enden. Gegner gelten als Wände. Feste Hindernisse dürfen weder betreten noch diagonal zwischen zwei solchen Zellen umgangen werden.

**Nah- und Fernkampfreichweite.** Eine Waffenzeile liest sie aus `combat.attacks[].reach` und `.range`, jeweils eine Spalte derselben Liste oder dieselbe Zahl für jede Zeile:

```json
"attacks": [
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "toHit": { "ability": { "column": "ability" } },
    "damage": { "dice": { "column": "damage" } },
    "reach": { "column": "reach" },
    "range": { "normal": { "column": "range" }, "long": { "column": "long_range" } }
  }
]
```

Liest eine Spalte für eine Zeile 0, hat die Zeile keine entsprechende Reichweite. So können ein gewöhnliches Schwert und eine Wurfaxt in derselben Liste stehen. Eine Zeile ganz ohne Nahkampfreichweite reicht eine Zelle weit. Eine Kreaturenaktion verwendet ihre eigene `reach` oder `range`, eine Katalogfähigkeit ihre `mechanics.range`. Dabei bedeutet 0 selbst oder Berührung, bei einem anderen Ziel also eine Zelle.

Eine Zeile mit BEIDEN Angaben ist eine Wurfwaffe: innerhalb ihrer Nahkampfreichweite ein Schlag, außerhalb ein Wurf. Die folgenden Fernkampfregeln betreffen sie also nicht im Nahkampf. Sie kann auch einen Weggehenden treffen, anders als ein Bogen.

Eine Kreaturenaktion darf ihre `area` in deiner Einheit angeben: `{ "shape": "cone",
"size": 15 }`, mit `"friendlyFire": false`, um die eigene Seite zu verschonen. So wird eine Atemwaffe auf dem Brett zu einem echten Kegel statt zu einer Zielanzahl. Eine Aktionsfolge hat keine eigene Form; ihre einzelnen Aktionen tragen ihre Formen. Ein Kampf ohne Brett ignoriert die Form und verwendet `targetCount`. Ein Kreatureneintrag kann deshalb beides enthalten und in beiden Darstellungen zutreffen.

**Wie weit eine Form geschickt werden darf.** Das legt `range` fest: Eine hundert Fuß weit geworfene Kugel hat eine solche Angabe. Ohne Reichweite explodiert eine Kreisfläche dort, wo sie abgelegt wird, auf der eigenen Zelle des Handelnden. Ein Kegel oder eine Linie darf innerhalb der eigenen Länge anvisiert werden, weil das Zielfeld hier nur die Richtung angibt. Das gilt für `mechanics.area` eines Katalogeintrags genauso wie für Kreaturen.

`ranged` legt den Nachteil eines Fernangriffs jenseits seiner gewöhnlichen Entfernung `normal` oder bei einem Gegner in der Nachbarzelle fest. Beide Angaben sind `"disadvantage"` oder `"normal"`. Ohne den Block kostet beides nichts. Ein Nahkampfschlag ist kein Fernangriff und wird von keiner Regel betroffen; dasselbe gilt für eine Wurfwaffe innerhalb ihrer Nahkampfreichweite.

**Flächen.** `mechanics.area` eines Eintrags wird zu einer echten Form auf dem Brett, die auf eine Zelle statt auf eine Person zielt. `targetCount` sagt darüber nichts aus: Die Form bestimmt die Zahl der Betroffenen. Alle in den erfassten Zellen werden getroffen, Freund wie Feind, außer der Eintrag setzt `"friendlyFire": false`.

```
burst, size 2, aimed at X        cone, size 3, aimed right      line, size 3, aimed right
. . . . .                        . . . .                        . . . .
. # # # .                        . . # .                        A # # #
. # X # .                        A # # #                        . . . .
. # # # .                        . . # .
. . . . .                        . . . .
```

Eine Kreisfläche umfasst jede Zelle innerhalb ihrer Größe um den Zielpunkt. Ein Kegel verläuft vom Handelnden zum Zielfeld und ist bei jedem Schritt so breit wie weit entfernt. Eine Linie verläuft ebenso, aber eine Zelle breit. Alle drei enden an festen Hindernissen.

**Sichtlinie und Deckung.** Zwischen beiden wird eine gerade Linie von Zellen betrachtet. Jedes feste Hindernis darauf blockiert einen Fernangriff und die weitere Ausbreitung einer Fläche; das Ziel erscheint dann gar nicht im Menü. Als Deckung zählendes Gelände addiert `cover.bonus` auf die Verteidigung gegen den Angriff, und das Protokoll nennt den Bonus. Es gibt weder Dreiviertel- noch vollständige Deckung und keine Höhenunterschiede.

**Angriffe auf Weggehende.** Mit `opportunity.budget` gilt: Verlässt ein Kämpfer die Reichweite eines aufrecht stehenden, handlungsfähigen Gegners, der dieses Budget und einen Nahkampfangriff hat, STOPPT die Bewegung an dieser Stelle. Der Gegner wird gefragt, ob er angreifen möchte. Der Angriff verbraucht das Budget und wird genau wie derselbe Angriff im eigenen Zug aufgelöst. Verstreichenlassen kostet nichts. Anschließend wird die Bewegung dort fortgesetzt, wo sie angehalten wurde, und bezahlt jede tatsächlich betretene Zelle. Streckt der Angriff den Gehenden nieder, endet die Bewegung an seinem Sturzort. Jeder Gegner bekommt für eine gesamte Bewegung eine Gelegenheit, unabhängig davon, wie oft der Weg seine Reichweite verlässt. `disengage` verhindert das für den Rest des Zuges. Ohne `opportunity` kennt der Regelsatz diesen Ablauf überhaupt nicht.

Die Nachfrage ist ein FENSTER, das den gesamten Kampf anhält. Nichts anderes bewegt sich, bis alle Befragten geantwortet haben. Das Fenster eines Gruppenmitglieds beantwortet der Spieler mit dem Angriff oder der danebenstehenden Option **Pass** (passen). Für alle anderen antwortet ihre steuernde Instanz, bei einem Boss des Game Master dessen eigene Entscheidung. Siehe Fenster unten.

**Was ein Gegner auf dem Brett tut.** Ein nicht fremdgesteuerter Gegner bewertet jede erreichbare Zelle zusammen mit jeder von dort möglichen Option. Für jeden provozierten Angriff zieht er Wert ab. Kann er seine beste Aktion bereits vom aktuellen Standort ausführen, bleibt er vorzugsweise stehen. Ist nichts in Reichweite, nähert er sich und sprintet zuerst, sofern deine `standard`-Liste `dash` enthält.

**Mögliche Ablehnungen.** `out-of-reach` (außerhalb der Reichweite), `no-line-of-sight` (ein festes Hindernis steht im Weg), `unreachable` (ein Feld ist nicht bezahlbar oder kein erlaubtes Bewegungsende) und `bad-cell` (ein unerlaubter Zielpunkt für eine Fläche).

### Was der Server im Kampf mit deinem Block macht

Ein Spiel mit einem Regelsatz, der `combat` deklariert, erhält einen entsprechend aufgelösten Kampf im selben gespeicherten Kampfdatensatz wie bisher:

- **Wer teilnimmt.** Der Game Master nennt die Beteiligten. Die Engine liest die Werte jedes Gruppenmitglieds vom eigenen Bogen. Ein Mitglied ohne Bogen für deinen Regelsatz wird namentlich abgelehnt, statt nicht von dir verfasste Zahlen zu erhalten.
- **Woher die Gegnerwerte stammen**, in dieser Reihenfolge: die vom Game Master benannte Bestiariumkreatur; eine Kreatur, deren Beschriftung dem Gegnernamen entspricht; ein vom Game Master für diesen Kampf vorgeschlagener und auf deine Bedrohungsskala begrenzter Werteblock; zuletzt eine einfache Kreatur aus den Zahlen der Stufe. Jeder Rückgriff und jede Begrenzung wird in einfachen Worten protokolliert. Ohne Bestiariumeintrag, Vorschlag und Bedrohungsskala lehnt ein Regelsatz den Kampf ab, statt Werte zu erfinden.
- **Deine Bögen sind der Datensatz.** Gesundheit, Pools, Zustände, Konzentration und Zähler deiner Sterberegel werden nach jeder angenommenen Aktion über die Bogenregeln geschrieben. Ein Neuladen mitten im Kampf zeigt dadurch exakt den hinterlassenen Zustand. Es gibt keine abschließende Kampfabrechnung, die davon abweichen könnte.
- **Dein Menü allein bestimmt die Erlaubnis.** Jeder Handelnde, Spieler wie Gegner, wählt eine ID aus demselben von deinem Block erzeugten Menü. Ein von der Engine gesteuerter Gegner verwendet ihre Taktik. Ein vom Game Master gesteuerter Gegner soll eine ID aus genau diesem Menü wählen, sieht deine Zahlen und erfährt nie vorab das Würfelergebnis.
- **Deine Würfel.** Ein Kampf führt seinen eigenen Seed und Positionszähler. Nach dem Laden von der Festplatte setzt er damit dieselbe Würfelfolge fort.

### Auf dem Bildschirm

Der Kampf läuft auf dem Kampfbildschirm in deinen Begriffen. Das Menü enthält deine Angriffe, Fähigkeiten und aufgeführten Standardaktionen, jeweils mit Kosten aus deinen Budgets und Pools. Angezeigt werden Zugreihenfolge, Runde, alle benannten Zustände mit verbleibenden Runden, temporäre Punkte, Konzentration und die beiden Zähler deiner Sterberegel. Das Protokoll zeigt die echte Rechnung in deinen Begriffen, etwa: "Juno greift Rust jackal mit Road axe an: 8 (5 + 3) + 3 = 11 gegen Guard 6, ein Treffer." Jede angenommene Aktion wird sofort auf den Bogen geschrieben. Neuladen mitten im Kampf ist daher exakt, und der Game Master wird anschließend angewiesen, diese Zahlen nicht erneut zu verändern.

Ein Kampf mit Positionen erscheint auf dem Brett statt auf der Porträtbühne. Siehe Positionen für die Bedienung. Jede Entfernung auf dem Brett, im Menü und im Protokoll verwendet DEINE Einheit, etwa: "Juno bewegt sich für 6 Schritte auf 4, 6 und hat noch 2 Schritte übrig."

### Fenster: Den Kampf für eine Entscheidung anhalten

Manche Momente gehören einer anderen Person als der gerade handelnden. Die Engine hält den Kampf für sie an, statt für sie zu entscheiden. Diese Pause ist ein Fenster.

Vier Situationen öffnen eines. Zwei davon ergeben sich aus deinen vorhandenen Deklarationen:

- **Jemand löst sich aus dem Nahkampf.** Verlässt eine Bewegung die Reichweite eines angreifenden Gegners, stoppt sie bei diesem Schritt und fragt ihn. Siehe oben "Angriffe auf Weggehende".
- **Zwischen zwei Zügen.** Endet ein Zug, wird vor dem nächsten jeder Gegner mit `signaturePoints` gefragt, der eine eigene `signature`-Aktion bezahlen kann. Nur in diesem Moment werden solche Aktionen gekauft. Sie erscheinen auf keinem Zugmenü, auch nicht dem eigenen.
- **Etwas wird auf jemanden gerichtet.** Vor der Auflösung wird jeder anvisierte Beteiligte der ANDEREN Seite gefragt, der einen auf diesen Moment wartenden Eintrag besitzt. Heilung durch einen Freund ist keine zu beantwortende Bedrohung; eine befreundete Aktion öffnet daher kein Fenster.
- **Etwas hat jemanden verletzt.** Nach der Auflösung wird jeder Geschädigte gefragt, der einen auf DIESEN Moment wartenden Eintrag besitzt, unabhängig vom Verursacher. Verletzt zu sein betrifft dich selbst. Ein auf den Verursacher zurückgerichteter Eintrag darf trotzdem nicht auf einen Freund zielen.

Die letzten beiden Momente fordert ein Katalogeintrag an, indem er benennt, worauf er wartet.

Was ein Fenster unabhängig vom Auslöser tut:

- **Solange es offen ist, geschieht nichts anderes.** Weder handelt die Person am Zug weiter, noch endet ihr Zug, noch öffnet sich ein weiteres Fenster. Der Kampf wartet.
- **Es fragt nacheinander** in Zugreihenfolge, jeden genau einmal. Passen ist immer möglich und kostenlos. Wer befragt würde, aber keine ausführbare Option hat, wird übersprungen.
- **Es setzt exakt am angehaltenen Punkt fort.** Eine Bewegung durchläuft die noch ausstehenden Zellen und bezahlt jede tatsächlich betretene.
- **Die steuernde Instanz antwortet.** Das Fenster deines Gruppenmitglieds gehört dir, mit der Option und **Pass** daneben im Menü. Für einen Gegner antwortet seine steuernde Instanz. Ein Boss des Game Master wird über den Game Master gefragt, mit Verstreichenlassen als möglicher Antwort.
- **Es wird mit dem Kampf gespeichert.** Nach dem Schließen mitten in einer Bewegung bleiben beim Fortsetzen dieselben Personen zu befragen und dieselben Zellen zu durchlaufen.

Für die ersten beiden Fenster deklarierst du nichts zusätzlich: Ein Regelsatz mit `opportunity.budget` erhält das eine, ein Bestiarium mit `signaturePoints` das andere. Ohne beide Angaben erscheinen sie nie.

**Den Moment benennen, auf den ein Eintrag wartet.** Schreibe `mechanics.reaction` als Objekt statt als `true`:

```json
"reaction": { "on": "aimed", "at": "source", "cancels": true }
```

- `on` ist `aimed` oder `harmed` und bringt den Eintrag auf das Menü dieses Fensters. Nur diese beiden Momente beobachtet die Engine. Ein Eintrag mit bloßem `"reaction": true` sagt nur, dass er nicht während eines Zuges gewählt wird. Das reicht für kein Angebot; er bleibt in keinem Menü.
- `at` ist `source` (Standard) oder `chosen`. `source` richtet die Aktion auf den Verursacher des Moments und setzt das Ziel selbst, ohne Auswahlfrage. `chosen` behält die eigenen Ziele des Eintrags bei und fragt nach.
- `cancels` verhindert vollständig, was das Fenster angehalten hat. Nur ein `aimed`-Eintrag darf es angeben, denn ein bereits eingetretener Moment lässt sich nicht absagen.

Gib auch ein `budget` an, sonst wird das Standardbudget der Liste verbraucht. Eine Reaktion verwendet fast immer ein eigenes Budget. Das verhindert mehrere davon in einem Zug.

**Die Kosten werden vor der ersten Nachfrage bezahlt.** Eine abgebrochene Aktion wird an ihrer Wirkung gehindert, nicht am Kauf: Budget und Pool-Ressourcen sind bereits verbraucht. Falls dein System sie erstattet, lässt sich das noch nicht ausdrücken.

Ein Paket, das einen solchen Moment nennt, braucht Capability API 1.33.

### Noch nicht umgesetzt

Die Grenzen werden ausdrücklich genannt, damit ein Regelsatz nichts behauptet, was die Engine nicht tut:

- **Jenseits des einfachen Bretts**: keine Dreiviertel- oder vollständige Deckung, keine Höhenunterschiede, kein Überfliegen von Hindernissen, kein Hindurchzwängen, keine Reittiere, keine Bewegung durch Ringen oder Schubsen, kein Verstecken oder Überraschen und keine erzwungene Verschiebung von Figuren.
- **Ein Eintrag kann nur auf zwei Momente warten**, `aimed` und `harmed`; siehe Fenster oben. Diese Momente beobachtet die Engine für einen Eintrag. Die beiden anderen Fenster – Weggehen und die Pause zwischen Zügen – öffnet der Kampf selbst; Einträge können sie nicht anfordern. Es gibt keinen Moment für einen Rettungswurf, das Wirken eines Zaubers an sich, einen Tod, den Zugbeginn oder einen Sturz.
- **Keine Verkettung.** Der Kampf hält ein einzelnes Fenster statt eines Stapels. Innerhalb eines Fensters öffnet deshalb nichts ein weiteres. Ein Gegenangriff kann nicht selbst gekontert werden, und der Schaden einer Reaktion löst keinen weiteren Moment aus.
- **Eine Reaktion stoppt oder bewirkt etwas; sie verändert keine Zahl daran.** "Bis zu deinem nächsten Zug schwerer zu treffen" lässt sich nicht ausdrücken, weil ein Zustand ein Name aus einer geschlossenen Liste ist, kein Modifikator. Das ist eine Grenze der Zustände, nicht der Reaktionen.
- **Es gibt keine Erstattung.** Die Kosten einer abgebrochenen Aktion bleiben verbraucht.
- Zustände können nur die Wirkungen der geschlossenen Liste ausdrücken. Ein Zustand mit Nachteil auf AttributsPROBEN oder einer mit zunehmenden Stufen wie Erschöpfung ist derzeit ein bloßer Eintrag auf dem Bogen.
- **Eine mit direkten Zahlen geschriebene Kreatur hat keine Wundleiste.** Verwendet der Regelsatz Gesundheit als Leiste, verliert eine solche Kreatur weiterhin Punkte. Mit einem `sheet` markieren Treffer dagegen Kästchen, nachdem ihre eigenen `resist`, `vulnerable` und `immune` angewendet wurden.
- **Ein Zusatzeffekt löst selbstständig aus.** `on` hat nur den Wert `hit`. Daher verbraucht der erste passende Treffer des Zeitraums den Effekt. Es gibt keinen Moment, in dem du nach seiner Nutzung gefragt wirst.

## Ebenen: Varianten deines eigenen Regelsatzes

Eine Ebene ist eine benannte Variante deines Regelsatzes, die der Spieler bei der Spielerstellung einschaltet: seltene Magie, ein harter Winter oder ein härterer Schwierigkeitsgrad. Ebenen stehen in einem optionalen `layers`-Array in der Regelsatzdatei. Sie reisen dadurch mit ihr und können einem Spiel, das sie verwendet hat, nie fehlen. Der Assistent zeigt sie als Schalter unter deinem Regelsatz. Die Auswahl gilt wie der Regelsatz selbst für die gesamte Lebensdauer dieses Spiels.

```json
"layers": [
  {
    "id": "hard_winter",
    "label": "Hard winter",
    "summary": "Cold, hunger and short days. Everything is harder.",
    "conflicts": ["mud_season"],
    "gm": {
      "guidance": "Hard winter is on. Let a failed check cost warmth, food or daylight as well as progress.",
      "worldGuidance": "Hard winter is on. Build a world of closed roads, thin stores and rationed settlements."
    },
    "fields": [{ "id": "calling", "removeValues": ["Sailor"], "default": "Hauler" }],
    "difficultyLadder": [{ "label": "Easy", "dc": 7 }],
    "catalogs": [{ "id": "knacks", "hide": { "filter": "grit", "above": 0 } }]
  },
  {
    "id": "mud_season",
    "label": "Mud season",
    "summary": "Thaw, flooded roads and slow going."
  }
]
```

**Was eine Ebene kann.** Die Liste ist geschlossen. Jede Wirkung schränkt entweder etwas ein oder fügt Text hinzu:

- `gm.guidance` wird an `gm.checkGuidance` angehängt, nach deinem eigenen Text und nach allen früheren Ebenen. `gm.worldGuidance` wird auf dieselbe Weise an `gm.worldGuidance` angehängt.
- `fields` entfernt Werte aus einem **Enum**-Feld. `removeValues` nennt bereits vorhandene Feldwerte. Mindestens einer muss übrig bleiben. Wird auch `default` des Feldes entfernt, nennt die Ebene einen verbleibenden Wert als neuen `default`.
- `difficultyLadder` ersetzt deine Schwierigkeitsskala durch eine andere in der Form deiner eigenen Auflösungsart: `{label, dc}` für `dice-sum` und `{label, successes, target?}` für `dice-pool`. Es gelten genau dieselben Prüfungen wie für deine eigene Skala. Deklarieren mehrere aktive Ebenen eine, gewinnt die letzte.
- `catalogs` blendet Einträge aus der Auswahl des Bogeneditors aus. Jede Regel nennt einen der deklarierten `filters` dieses Katalogs und genau einen Vergleich: `above` oder `below` für einen `number`-Filter, `equals` oder `notIn` für `text` oder `tags`. Ein Eintrag, der den Filter überhaupt nicht setzt, wird niemals ausgeblendet.

**Was eine Ebene nicht kann.** Sie kann weder Enum-Werte, Felder, Fertigkeiten, Pools oder Rasten hinzufügen noch die Auflösungsart ändern, laufenden Zustand oder Kampfzahlen verändern oder einen Modellaufruf ergänzen. Ein von einer Ebene _hinzugefügter_ Wert wäre allen anderen Lesern des Bogens unbekannt. Deshalb können Werte nur entfallen. Alles außerhalb dieser Liste ist eine Änderung des Regelsatzes selbst oder ein zweiter Regelsatz.

**Konflikte.** `conflicts` nennt Ebenen, die nicht gleichzeitig aktiv sein dürfen. Die Angabe auf einer Seite des Paares reicht. Der Assistent deaktiviert den anderen Schalter. Enthält eine gespeicherte Auswahl dennoch beide, entfällt die **später** deklarierte. Dieselben zwei Auswahlen ergeben dadurch immer dieselben Regeln.

**Ein Bogen mit einem entfernten Wert behält ihn.** Kein Charakter wird umgeschrieben. Der Editor bietet den Wert lediglich nicht mehr an; bei einem Charakter, der ihn schon hatte, zeigt er ihn weiterhin an. Wird die Ebene in einem neuen Spiel ausgeschaltet, steht der Wert wieder zur Auswahl. Dasselbe gilt für einen ausgeblendeten Katalogeintrag: Er fehlt in der Auswahl, doch bereits ausgewählte Zeilen bleiben auf dem Bogen.

**Grenzen.** 12 Ebenen pro Regelsatz und 4000 Zeichen Anleitungstext je Ebene, beide Zeichenfolgen zusammengezählt. Ein als Paket ausgelieferter Regelsatz mit `layers` oder einem grundlegenden `gm.worldGuidance` braucht Capability API 1.25. Ein importierter Regelsatz wird von der lesenden Engine geprüft und braucht keine solche Angabe.

**Von anderen geschriebene Ebenen**, etwa eine separat ausgelieferte Ebene für seltene Magie zu einem fremden Regelsatz, sind für später vorgesehen. Derzeit wird eine Ebene im zugehörigen Regelsatz ausgeliefert.

<a id="trying-your-ruleset"></a>

## Deinen Regelsatz ausprobieren

Community-Regelsätze verwenden denselben Schalter wie importierte Agenten. Öffne **Settings** > **Advanced** > **Danger Zone** (Einstellungen > Erweitert > Gefahrenbereich) und aktiviere **Allow custom Agent imports** (eigene Agentenimporte erlauben). Der Import braucht außerdem Zugriff über localhost oder eingerichteten **Admin Access** (Administratorzugriff).

1. Öffne das Panel **Agents** und wähle **Import agents** (Agenten importieren), das Download-Symbol in der oberen Schaltflächenreihe.
2. Wähle **Game Mode ruleset** (Regelsatz für Game Mode) und deine JSON-Datei.
3. Lies die Prüfung. Sie zeigt Name, Version, Lizenz, Umfang des Regelsatzes und den Text für den Game Master. Wähle **Import** (importieren).

Dein Regelsatz erscheint im Bereich **Rules** des Panels und in der Auswahl **Rules** des Assistenten für neue Spiele. Ein aus einer Datei importierter Regelsatz wird als `local/<your id>` abgelegt. Er kann dadurch nie mit einem offiziellen oder fremden Regelsatz verwechselt werden.

### Einen bereits importierten Regelsatz ändern

Eine importierte Version wird niemals überschrieben. Änderst du die Datei und importierst sie mit derselben `version` erneut, wird der Import abgelehnt und fordert eine höhere Nummer. Das ist beabsichtigt: Ein Spiel ist an genau die Version gebunden, mit der es erstellt wurde. Eine laufende Kampagne wacht deshalb nie mit anderer Mathematik auf.

Beim Entwerfen lautet die Folge daher: bearbeiten, `version` erhöhen, importieren, neues Spiel beginnen. Alte Versionen bleiben neben der neuen installiert, bis du den Regelsatz aus dem Bereich **Rules** entfernst. Verwendet ein Spiel einen entfernten Regelsatz noch, meldet es ihn als fehlend, bis du ihn erneut importierst.

Änderst du die Form des Bogens durch Hinzufügen, Entfernen oder Umbenennen von Einträgen, erhöhe auch `sheet.version`. Vorhandene Bögen werden tolerant gelesen: Dem neuen Bogen unbekannte Werte bleiben erhalten, fehlende Werte verwenden ihre Standards.

## Deinen Regelsatz teilen

**Als Datei.** Schick die JSON-Datei an einen Freund. Er importiert sie genauso wie du.

**Aus einem GitHub-Repository.** Verwahrst du deine Arbeit in einem öffentlichen GitHub-Repository, lege jeden Regelsatz als eigene Datei in einen Ordner `rulesets` auf dessen oberster Ebene:

```text
your-repository/
  agents.json        (optional, only if you also share agents)
  rulesets/
    ember-roads.json
    another-system.json
```

Nutzer fügen dein Repository einmal über die Liste eigener Agenten-Repositories hinzu, prüfen seinen Inhalt und können es später synchronisieren, um neue Versionen zu erhalten. Diese Repository-Liste ist eine erweiterte Funktion, die der Serverbetreiber mit `ENABLE_CUSTOM_AGENT_REPOS=true` einschalten muss. Regelsätze aus einem Repository werden unter dem Namen seines Besitzers abgelegt, etwa `alice/ember-roads`. So können zwei Autoren jeweils einen Regelsatz namens `v20` veröffentlichen, ohne einander zu überschreiben.

Es gelten zwei Grenzen. Ein Repository darf höchstens 32 JSON-Dateien direkt in `rulesets` enthalten; mehr führen zur Ablehnung. Ein Konto namens `local` kann keine Regelsätze veröffentlichen, denn `local/` ist für Dateiimporte reserviert.

**Im offiziellen Katalog.** Ein verbreitetes System mit geklärten Lizenzrechten kann über **Download Agents** (Agenten herunterladen) allen angeboten werden. Dafür öffnest du einen Pull Request im Repository [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Das dortige Paket `ruleset-5e-2014` zeigt die Verzeichnisstruktur.

## Lizenzierung

Veröffentliche nur Regeltexte, die du teilen darfst. Viele Systeme bieten ein Referenzdokument unter einer offenen Lizenz an; daraus darfst du kopieren. Trage unter `license` die Lizenz-ID und den verlangten Urheberhinweis ein. Kopiere keine Texte aus nicht offen lizenzierten Regelbüchern. Ein Regelsatz braucht vor allem Namen und Zahlen. Den Text für den Game Master solltest du selbst formulieren.

## Fehlerbehebung

- **Der Import meldet einen unbekannten Namen.** Etwas in der Datei verweist auf eine nicht deklarierte ID, etwa eine Fertigkeit auf ein entferntes Attribut. Die Meldung nennt den Pfad zur betroffenen Zeile.
- **Der Import meldet eine bereits installierte Version mit anderem Inhalt.** Erhöhe `version` und importiere erneut.
- **Mein Regelsatz fehlt im Einrichtungsassistenten.** Prüfe, ob **Allow custom Agent imports** eingeschaltet ist. Solange der Schalter aus ist, werden importierte Regelsätze für neue Spiele ausgeblendet. Bereits damit erstellte Spiele funktionieren weiter.
- **Ein Spiel meldet seinen Regelsatz als fehlend.** Die genaue Version, mit der es erstellt wurde, ist nicht installiert. Importiere diese Dateiversion erneut.
