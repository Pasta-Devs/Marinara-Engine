# Regelsätze für Game Mode schreiben

Ein Regelsatz erklärt Game Mode, wie ein Tischrollenspiel funktioniert: welche Würfel eine Probe wirft, was auf dem Charakterbogen steht, welche Ressourcen verbraucht werden und was eine Rast wiederherstellt. Dieser Leitfaden richtet sich an alle, die eigene Regelsätze schreiben und teilen möchten. Wenn du mit einem fremden Regelsatz spielen möchtest, beginne bei [Regeln auswählen](../game/getting-started.md#choosing-rules).

Ein Regelsatz besteht aus einer JSON-Datei. Sie enthält Daten, keinen Code. Nichts darin wird ausgeführt; der Import kann daher keine Aktionen auf deinem Computer ausführen. Lies vor dem Import einer fremden Datei vor allem den Text für den Game Master sorgfältig: Er wird in jedem Spiel mit diesem Regelsatz an das Modell gesendet.

## Zuerst lesen: Was ein Regelsatz kann und was nicht

Ein Regelsatz kann nur eine Mechanik ausgestalten, die die Engine bereits kennt. Derzeit kennt die Engine fünf Arten, eine Probe aufzulösen. Deine Datei wählt eine davon mit `resolution.kind`:

- **`dice-sum`**: Würfel werfen, Zahlen vom Bogen addieren und einen Schwierigkeitswert erreichen oder übertreffen. Das deckt d20-Systeme, Systeme mit 2d6 plus Attribut und viele weitere ab.
- **`dice-pool`**: Die eigene Würfelanzahl des Charakters werfen und die Würfel zählen, die einen Zielwert erreichen. Das deckt Systeme ab, in denen ein Wert für eine Handvoll Würfel statt für einen Bonus steht.

- **`dice-highest`**: Einen Pool werfen und seinen höchsten Würfel ablesen oder seine höchsten paar Würfel addieren. Das deckt Blades in the Dark und Trophy Dark ab.
- **`roll-against`**: Auf oder unter (oder über) die Zahl vom Bogen würfeln. Das deckt Prozentfertigkeiten und GURPS-Proben ab.
- **`symbol-pool`**: Erzählwürfel zusammenstellen und aufwerten und dann gegnerische Symbole gegeneinander aufheben. Das deckt Genesys-Proben ab.

Alle fünf werden unter [Auflösungsarten](#resolution-kinds) vollständig beschrieben.

Eine Mechanik, die in keine dieser Formen passt, lässt sich nicht in einer Regelsatzdatei ausdrücken. Vergleichende Pools sind ein Beispiel. Jede solche Mechanik braucht eine neue Auflösungsart in der Engine, also einen Codebeitrag mit Tests statt einer JSON-Datei. Wenn dein System so etwas benötigt, öffne einen Funktionswunsch im Engine-Repository und beschreibe die Mechanik anhand einiger durchgerechneter Würfe. Diese Beispiele werden zu den Tests.

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
| `items` | Optional. Die Begriffe, in denen deine Gegenstände geschrieben sind: Kategorien, Seltenheiten, Werte, Trageplätze, Geld. |
| `battle` | Optional. Was ein Kampf vom Bogen lesen und danach zurückschreiben darf. |
| `combat` | Optional. Wie deine eigenen Regeln einen Kampf auflösen und was der Kampfbildschirm anschließend ausspielt. |
| `layers` | Optional. Varianten deines Regelsatzes, die ein Spieler bei der Spielerstellung einschaltet. |

Die Datei darf bis zu 512 KB groß sein (vor Capability API 1.340 waren es 256 KB). Text, der in einem Prompt landet – Namen, Beschriftungen und Game-Master-Text –, darf keine Zeilenumbrüche, eckigen Klammern oder doppelten geschweiften Klammern enthalten.

IDs innerhalb des Bogens, etwa für Attribute, Fertigkeiten, Felder und Pools, bestehen aus Kleinbuchstaben, Ziffern und Unterstrichen und beginnen mit einem Buchstaben, zum Beispiel `grit_max`.

<a id="resolution-kinds"></a>

### Auflösungsarten

`resolution.kind` wählt, wie eine Probe gewürfelt wird. Alle Arten lesen denselben Charakterbogen und teilen drei Schlüssel. Die Bestandteile unterhalb von `resolution` ändern sich beim Wechsel deshalb nicht:

- `abilityModifier`: Wie ein Bogenwert zu einer Zahl wird. Bei `identity` ist der Wert selbst die Zahl. `floorHalfMinusTen` ist die 5e-Regel. Mit `stepTable` kannst du eigene Schwellen als `[[score, number], ...]` auflisten.
- `proficiencyTiers`: Die Ausbildungsstufen einer Fertigkeit oder eines Rettungswurfs. Eine nicht eingetragene Fertigkeit bekommt die erste Stufe. Eine Stufe addiert `flat`, das `multiplier`-Fache eines Übungsbonus oder beides. Wenn dein System einen Übungsbonus hat, gib seine Herkunft mit `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }` an.
- `proficiency`: Optional und nur für eine multiplizierende Stufe nötig.

Was die berechnete Zahl bedeutet, bestimmt die Auflösungsart: `dice-sum` addiert sie zum Wurf, `dice-pool` und `dice-highest` werfen entsprechend viele Würfel. `symbol-pool` hält Attribut und Ausbildung getrennt, um Erzählwürfel zusammenzustellen und aufzuwerten.

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
- `dice.faces`: Was jede Seite wert ist, die niedrigste Seite zuerst, wenn die Seiten nicht ihre eigenen Zahlen sind (Capability API 1.136). Die vier Fudge-Würfel von Fate sind `{ "count": 4, "sides": 3, "faces": [-1, 0, 1] }`: Die Karte zeigt −, leer und + und addiert sie, und die Wahrscheinlichkeiten entsprechen genau denen von Fate. Gib einen Wert pro Seite an.
- `openEnded`: Ein einzelner Würfel, der weiterrollt (1.136). Eine Augenzahl ab `high` wird erneut gewürfelt und addiert, und das wiederholt sich, solange der neue Würfel `high` oder mehr zeigt. Eine Augenzahl bis einschließlich `low` wird erneut gewürfelt und abgezogen, und dieser Wurf setzt sich bei `high` auf dieselbe Weise fort. Der offene Prozentwurf von Rolemaster ist `{ "high": 96, "low": 5 }` auf einem d100. Ein Wurf wirft höchstens 20 Würfel. Die besonderen Augenzahlen und die Verschiebung der Ergebnisbereiche lesen den ersten Würfel.
- `unmodified`: Augenzahlen eines einzelnen Würfels, die der Datensatz markiert, wenn der erste Würfel sie zeigt (1.136). So lassen sich Tabellen anwenden, die „eine unmodifizierte 66“ gesondert behandeln: `[66, 100]`. Der Datensatz sagt `unmodified="66"`, die Karte zeigt es, und der Game Master wird angewiesen anzuwenden, was die Regeln dazu sagen.
- `difficultyLadder`: Die Schwierigkeitswerte, aus denen der Game Master wählen soll. `dc` ist die Zahl, die die Summe erreichen muss. Statt die Zahl zu schreiben, darf der Game Master auch eine Stufe nennen, etwa `difficulty="Hard"`; die Engine liest die Zahl dann an der Stufe ab.

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
  "pool": { "min": 1, "max": 15, "abilityPlusAbility": true },
  "target": { "default": 7, "min": 5, "max": 9 },
  "explode": { "from": 10, "min": 8 },
  "cancel": { "upTo": 1 },
  "botch": { "upTo": 1 },
  "exceptional": { "successes": 5 },
  "situationalDice": { "min": -3, "max": 3 },
  "reroll": [{ "id": "careful", "upTo": 6, "mode": "once" }],
  "difficultyLadder": [
    { "label": "Plain work", "successes": 1, "target": 6 },
    { "label": "Grim", "successes": 3, "target": 8 }
  ]
}
```

- `die`: Wie viele Seiten ein Würfel des Pools hat, von 2 bis 100.
- `pool`: Der Bereich, auf den die Zahl vom Bogen vor allen Explosionen begrenzt wird. Ein `min` von 0 lässt einen leeren Pool ohne Wurf scheitern. `max` darf höchstens 100 sein. Mit `abilityPlusAbility: true` darf eine Attributsprobe über `with=` ein zweites Attribut nennen und beide werfen – für Systeme, die zwei Attribute zusammen würfeln. Ohne diese Angabe bedeutet `with=` bei einer Attributsprobe nichts.
- `target`: Die Augenzahl, die ein Würfel erreichen muss, um zu zählen. Setze `min` unter `max`, damit der Game Master sie mit `threshold=` je Probe verändern darf. Setze alle drei Werte gleich, um sie festzulegen.
- `double`: Optional. Eine Augenzahl ab `from` zählt doppelt.
- `explode`: Optional. Eine Augenzahl ab `from` wirft einen weiteren Würfel, der seinerseits explodieren kann. Zusätzlich zum ursprünglichen Pool sind höchstens `pool.max` weitere Würfel erlaubt. Eine Probe wirft daher höchstens zweimal `pool.max` Würfel, und ein niedriger `from`-Wert kann nicht endlos weiterwürfeln.
- Beide dürfen ein `min` tragen: die niedrigste Augenzahl, auf die eine Probe die Regel mit `explode="N"` oder `double="N"` am Tag oder über einen vom Charakter genutzten Eintrag senken darf. Mit einem `min` darfst du `from` weglassen; die Regel greift dann nur bei einer Probe, die sie verlangt. Eine Spezialisierung, durch die Zehnen bei einer einzigen Fertigkeit erneut würfeln, ist `"explode": { "min": 10 }`. `from` darf nicht unter `min` liegen.
- `cancel`: Optional. Eine Augenzahl bis einschließlich `upTo` zieht einen Erfolg ab. Die Anzahl sinkt nie unter null.
- `botch`: Optional. Wenn **kein** Würfel erfolgreich war und eine Augenzahl bis einschließlich `upTo` vorkam, ist die Probe ein Patzer. Ein Pool, dessen einziger Erfolg nachträglich gestrichen wurde, ist gescheitert, aber kein Patzer. `"rule": "halfOrMore"` liest den Patzer anders: Zeigt mindestens die Hälfte der zuerst geworfenen Würfel (Explosionen nicht mitgezählt) eine Augenzahl bis einschließlich `upTo`, ist das ein Patzer, wenn kein Würfel erfolgreich war. Andernfalls bleibt das Ergebnis bestehen und wird mit `complication="true"` markiert: Neben dem Ergebnis geht etwas schief. `"noSuccesses"` ist der Standard.
- `exceptional`: Optional. Eine erfolgreiche Probe mit mindestens so vielen verbleibenden Erfolgen ist ein kritischer Erfolg.
- `situationalDice`: Optional. Wie viele Würfel der Game Master bei einer Probe mit `bonus=` hinzufügen oder abziehen darf, etwa für Kunststücke, Wunden oder schlechtes Licht.
- `reroll`: Optional. Wiederholungswürfe, die das System gewährt, ohne dass jemand dafür bezahlt – bis zu sechs, jeweils mit einer `id`, die der Game Master bei einer Probe mit `reroll=` nennt. Augenzahlen bis einschließlich `upTo` werden erneut geworfen: mit `"once"` einmal, und die neue Augenzahl bleibt, wie sie fällt, mit `"until"` so lange, bis sie höher ausfällt. `upTo` reicht von 1 bis eins unter der Seitenzahl des Würfels, weil ein erneuter Wurf jeder Augenzahl nie enden würde; ein `until` endet ohnehin nach hundert erneuten Würfen bei einer Probe. Geworfen wird nur ein Wiederholungswurf, den die Probe nennt. Eine Probe wirft genau einen Wiederholungswurf: Hat auch ein Einsatz oder ein vom Charakter genutzter Eintrag einen gekauft, wird derjenige geworfen, der mehr Augenzahlen erfasst; bei gleicher Reichweite geht `until` vor `once`.
- `difficultyLadder`: `successes` gibt die nötigen Erfolge an. Eine Stufe darf auch ein `target` nennen, aber nur, wenn der Zielwert veränderlich ist, und nur innerhalb seines Bereichs. Mit diesem Zielwert zählt eine Probe auf dieser Stufe: wenn der Game Master die Stufe mit `difficulty=` nennt oder ein `dc=` schreibt, das genau eine Stufe verlangt. Verlangen mehrere Stufen dieselbe Zahl an Erfolgen, kann `dc=` allein nicht sagen, welche gemeint war, und der Zielwert bleibt beim Standard. Nenne dann die Stufe.

- `target.from`: Optional. Liest den Zielwert jedes Charakters von seinem Bogen, wie die Number in Lasers & Feelings, die ein Charakter einmal wählt (ein beliebiger Wertverweis: ein Attribut, ein Feld, ein abgeleiteter Wert). Er wird innerhalb von `min`..`max` gehalten, und `threshold=` verschiebt ihn nicht, weil die Zahl dem Charakter gehört; einen Zielwert, den ein vom Charakter genutzter Eintrag gekauft hat, gibt es dagegen weiterhin. Das `threshold=` im Datensatz nennt, was verwendet wurde.
- `stances`: Optional. Bis zu sechs, jede mit `id`, `label`, `count` (`"below"` oder `"above"`) und den `skills`, die sie abdeckt. Eine Probe mit einer dieser Fertigkeiten zählt die Würfel **unter** dem Zielwert oder **über** ihm statt der Würfel, die ihn erreichen oder übertreffen: Lasers & Feelings hat eine Haltung Lasers, die nach unten zählt, und eine Haltung Feelings, die nach oben zählt, und jede Fertigkeit gehört zu einer davon. Eine Fertigkeit darf nur in einer Haltung stehen. Haltungen lassen `explode`, `double`, `cancel` und `botch` weg, weil diese gegen „erreicht oder übertrifft“ gelesen werden.
- `exact`: Optional. Ein Würfel, der genau den Zielwert zeigt: `label` benennt ihn (`"LASER FEELINGS"`), `text` darf sagen, was er am Spieltisch bewirkt, und er zählt als ein Erfolg, sofern `counts` nicht `false` ist. Der Datensatz trägt `exact="N"`, die Zahl solcher Würfel, und die Würfelkarte zeigt sie neben dem Ergebnis. So kann der Game Master dem Spieler die Einsicht geben, die das einbringt.

Die Augenzahlen für `cancel` und `botch` müssen unter dem niedrigsten Zielwert liegen. Jede von diesen Regeln genannte Augenzahl muss auf dem Würfel vorkommen können. Eine Regel, die nie greifen könnte, wird beim Import abgelehnt, statt erst im Spiel aufzufallen.

Ein als Paket ausgelieferter Pool-Regelsatz braucht Capability API 1.24; ein `min` bei `explode` oder `double`, `pool.abilityPlusAbility` und `botch.rule` brauchen 1.37, `reroll` braucht 1.38; `target.from`, `stances` und `exact` brauchen 1.137. Ein importierter Community-Regelsatz wird von der Engine geprüft, die ihn liest, und braucht deshalb keine solche Angabe.

#### Was der Game Master bei einer Pool-Probe schreiben darf

```
[skill_check: skill="Ward" dc="2" who="Bram the Quiet" threshold="8" bonus="-2" with="Sinew"]
[skill_check: skill="Ward" difficulty="Grim" explode="9"]
[skill_check: skill="Nerve" dc="1" with="Warmth"]
[skill_check: skill="Ward" dc="2" reroll="careful"]
```

- `dc` ist die Zahl der nötigen **Erfolge**, kein Zielwert. Sie darf von 1 bis zum größtmöglichen Ergebnis eines Wurfs reichen: das Maximum des Pools, verdoppelt bei explodierenden Würfeln und erneut verdoppelt bei doppelt zählenden Augenzahlen.
- `threshold=` verändert den Zielwert je Würfel und wird nur angeboten, solange `target.min` unter `target.max` liegt.
- `bonus=` fügt Würfel hinzu oder zieht sie ab und wird nur angeboten, wenn `situationalDice` deklariert ist.
- `with=` würfelt eine Fertigkeit oder einen Rettungswurf mit einem anderen als dem zugeordneten Attribut. Das funktioniert bei beiden Arten; ein 5e-Regelsatz erhält über dasselbe Tag-Attribut also „Strength (Intimidation)“. Bei einer Attributsprobe fügt es stattdessen ein zweites Attribut hinzu, sofern `pool.abilityPlusAbility` eingeschaltet ist.
- `difficulty=` nennt bei beiden Arten anstelle von `dc=` eine Stufe der Skala: ihre Erfolge (bei einer Summe ihre Schwierigkeit) und bei einem Pool ihren Zielwert. Ein daneben geschriebenes `dc=` hat bei der Zahl weiterhin Vorrang, `threshold=` beim Zielwert. Ein Name, auf den keine Stufe passt oder den sich zwei Stufen teilen, wird ignoriert.
- `explode=` und `double=` verschieben die Augenzahlen dieser Regeln für diese Probe und werden nur angeboten, wenn die Regel ein `min` hat.
- `reroll=` nennt einen deiner `reroll`-Einträge für diese Probe und wird nur angeboten, wenn du welche deklariert hast. Ein Name, auf den keiner passt, wird ignoriert.

Alle Angaben bleiben innerhalb deiner Dateivorgaben: Ein Wert außerhalb des Bereichs wird auf die nächste Grenze gesetzt. Ein vom Regelsatz nicht angebotenes Tag-Attribut wird ignoriert, statt die Probe abzulehnen. Der gespeicherte Datensatz zeigt anschließend, was der Wurf tatsächlich verwendet hat: Schwierigkeit und Schwelle als Zahlen, die zusätzlichen Würfel nach Anwendung deiner Grenzen, `with=` nur dann, wenn das Attribut wirklich ausgetauscht oder hinzugefügt wurde, eine Augenzahl nur, wenn die Probe sie verschoben hat, `reroll=` nur, wenn der genannte Wiederholungswurf der geworfene war und tatsächlich etwas geworfen hat, und `complication="true"`, wenn bei einem `halfOrMore`-Patzer neben einem Ergebnis etwas schiefging. Die Engine wirft die Würfel immer selbst. Ein vom Modell geschriebenes Pool-Ergebnis wird ersetzt. `mode="advantage"` wird ignoriert, weil diese Auflösungsart keinen Vorteil kennt. Ein vor dem Zug vom Spieler gewürfelter Würfel wird nicht verwendet.

#### `dice-highest`: Würfel werfen und den höchsten ablesen

Blades in the Dark und Trophy Dark werfen eine Handvoll d6 und lesen nur den höchsten davon ab. Capability API 1.138.

```json
"resolution": {
  "kind": "dice-highest",
  "die": { "sides": 6 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [{ "id": "rating_0", "label": "0" }, { "id": "rating_1", "label": "1", "flat": 1 }],
  "pool": { "min": 0, "max": 6 },
  "zeroDice": "lowest-of-two",
  "critical": { "count": 2 },
  "situationalDice": { "min": -1, "max": 2 },
  "difficultyLadder": [{ "label": "Partial", "dc": 4 }, { "label": "Full", "dc": 6 }],
  "outcomes": {
    "by": "total",
    "tiers": [
      { "id": "critical", "label": "Critical", "on": "critical-success", "success": true },
      { "id": "full", "label": "Full success", "atLeast": 6, "success": true },
      { "id": "partial", "label": "Partial success", "atLeast": 4, "success": true, "text": "You do it, with a consequence." },
      { "id": "bad", "label": "Bad outcome" }
    ]
  }
}
```

- Die Zahl vom Bogen gibt wie bei einem Pool an, wie viele Würfel geworfen werden, und wird auf `pool` begrenzt (höchstens 20). Wunden, `adjust`, Zustände und Gegenstände fügen Würfel hinzu oder nehmen welche weg.
- `keep`: Optional, 1 bis 3, Standard 1. Wie viele der höchsten Würfel addiert werden: 1 ist Blades, 2 sind die Kämpfe in Trophy Dark.
- `zeroDice`: Was ein Charakter ohne Würfel tut. `"lowest-of-two"` (Standard) wirft zwei, behält den niedrigeren und kann nie kritisch sein; `"fail"` scheitert ohne Wurf.
- `critical`: Optional. `count` Würfel mit der höchsten Seite (oder mit `face` und darüber) sind ein kritischer Erfolg: die zwei Sechsen von Blades.
- `dark`: Optional, die dunklen Würfel von Trophy Dark. `label`, `max` (1 bis 10) und `text`. Der Game Master fügt sie einer Probe mit `dark="N"` hinzu. `outcome` ist standardmäßig `"all"`: Sie werden zusammen mit den übrigen gelesen. Mit `"outcome": "light"` (Capability API **1.149**) entscheiden nur die hellen Würfel über die behaltenen Würfel, die Summe, die Ergebnisbereiche und kritische Erfolge. Gibt es keine hellen Würfel, gilt `zeroDice` für die helle Seite: zwei helle Würfel werfen und den niedrigeren behalten oder scheitern, wobei die dunklen Würfel trotzdem geworfen werden. Dunkle Würfel werden immer geworfen und zuletzt festgehalten. `darkHighest="true"` bedeutet, dass ein dunkler Würfel jeden hellen Würfel echt übertroffen hat (auch helle Ersatzwürfel; wurde kein heller Würfel geworfen, gewinnt jeder dunkle Würfel). Was das kostet (Ruin), wendet der Game Master an. Wer `dark.outcome` deklariert, auch als `"all"`, braucht capabilityApi 1.149.
- `situationalDice`: Optional, die Würfel, die der Game Master mit `bonus=` hinzufügen oder wegnehmen darf (Unterstützung, ein Kraftakt).
- `spend` darf nur Würfel kaufen.
- `difficultyLadder`: Stufen mit `dc`, der Zahl, die die behaltenen Würfel erreichen müssen. `dc=` an einer Probe ist diese Zahl, von 1 bis `keep` mal die Seitenzahl des Würfels.
- `outcomes` lesen mit `by: "total"` die behaltenen Würfel, und ein Ergebnisbereich mit `on: "critical-success"` fängt den kritischen Erfolg ab.

Der Datensatz behält die Form einer Summe (`resolution="sum"`, `modifier="0"`, die behaltenen Würfel als Summe) und ergänzt `highest="1"`, dazu `zeroDice="true"` und `dark="N"`, wo sie zutreffen; die dunklen Würfel stehen zuletzt in `rolls`. Ein Ergebnis nur aus hellen Würfeln hält außerdem `darkOutcome="light"` fest, damit die Karte nur behaltene helle Würfel hervorhebt, auch nach einem Neuladen. Ein Regelsatz dieser Art hat keinen eigenen Kampf; `combat` wird daneben deshalb abgelehnt.

#### `roll-against`: Höchstens (oder mindestens) die Zahl vom Bogen würfeln

Call of Cthulhu, GURPS und die Prozentwerte eines Diebes alter Schule würfeln gegen eine Zahl auf dem Bogen, statt etwas zu den Würfeln zu addieren. Capability API 1.139.

```json
"resolution": {
  "kind": "roll-against",
  "dice": { "count": 1, "sides": 100 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [{ "id": "base", "label": "Base" }],
  "against": "at-most",
  "criticalSuccess": [{ "from": 1, "to": 1 }],
  "criticalFailure": [{ "from": 100, "to": 100 }, { "from": 96, "whenTarget": { "below": 50 } }],
  "tens": { "max": 2 },
  "difficultyLadder": [
    { "label": "Regular", "dc": 0 },
    { "label": "Hard", "dc": 0, "divide": 2 },
    { "label": "Extreme", "dc": 0, "divide": 5 }
  ],
  "outcomes": {
    "by": "fraction",
    "tiers": [
      { "id": "critical", "label": "Critical", "on": "critical-success", "success": true },
      { "id": "extreme", "label": "Extreme success", "atLeast": 5, "success": true },
      { "id": "hard", "label": "Hard success", "atLeast": 2, "success": true },
      { "id": "regular", "label": "Regular success", "atLeast": 1, "success": true },
      { "id": "fail", "label": "Failure" },
      { "id": "fumble", "label": "Fumble", "on": "critical-failure" }
    ]
  }
}
```

- Die Zahl vom Bogen für die Probe ist der Zielwert. Der Prozentwert einer Fertigkeit ist der Bonus, den der Bogen für diese Fertigkeit führt (`bonusRange` reicht bis 100), ohne Attribut und ohne Bonus aus der Ausbildungsstufe; eine GURPS-Fertigkeit ist ihr Attribut plus dieser Bonus.
- `dice`: Was gewürfelt und addiert wird, standardmäßig 1d100 (3d6 für GURPS, 1d20 für einen Rettungswurf).
- `against`: `"at-most"` (Standard) gelingt auf oder unter dem Zielwert, `"at-least"` auf oder über ihm.
- `difficultyLadder`: Das `dc` jeder Stufe verschiebt den Zielwert, und `divide` (2 bis 10) teilt vorher die Zahl vom Bogen. Der Game Master nennt eine Stufe mit `difficulty=`; ein `dc=` am Tag verschiebt die Zahl, von -100 bis 100. Das `dc` im Datensatz ist die Zahl, gegen die der Wurf gelesen wurde, und der Datensatz sagt `against="at-most"`.
- `criticalSuccess` und `criticalFailure`: Jeweils bis zu sechs Regeln. Eine Regel nennt Augenzahlen (`from`, `to`; beide dürfen offen bleiben) oder, bei einem Fehlschlag, `pastTarget`, einen Wurf, der mindestens so weit auf der misslungenen Seite liegt. `whenTarget` (`atLeast`, `below`) beschränkt eine Regel auf bestimmte Zielwerte: Die 5 ist in GURPS nur bei 15 oder mehr ein kritischer Erfolg. Ein kritischer Erfolg gelingt immer, und ein kritischer Fehlschlag misslingt immer.
- `tens`: Optional und nur bei einem einzelnen d100. `bonus="+N"` wirft N weitere Zehnerwürfel und behält den besten Wurf, `bonus="-N"` den schlechtesten, bis zu `max`.
- `outcomes` dürfen bei einem `at-most`-Wurf `by: "fraction"` lesen: Das `atLeast` jedes Ergebnisbereichs teilt den Zielwert, und ein Wurf auf oder unter diesem Anteil landet in dem Bereich. Die Maße `margin` (wie weit unter dem Zielwert) und `total` funktionieren ebenfalls.

#### `symbol-pool`: Erzählwürfel werfen und die Symbole ablesen

Genesys stellt einen Pool aus einer Charakteristik und einem Fertigkeitsrang zusammen und fügt dann gegnerische Würfel hinzu. Die Seiten tragen statt Zahlen Erfolg, Vorteil, Triumph, Misserfolg, Bedrohung und Verzweiflung. Capability API 1.141.

```json
"resolution": {
  "kind": "symbol-pool",
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "untrained", "label": "Untrained", "flat": 0 },
    { "id": "rank_one", "label": "Rank 1", "flat": 1 }
  ],
  "symbols": [
    { "id": "s", "label": "Success" },
    { "id": "f", "label": "Failure", "cancels": "s" },
    { "id": "a", "label": "Advantage" },
    { "id": "h", "label": "Threat", "cancels": "a" },
    { "id": "t", "label": "Triumph", "counts": "s" },
    { "id": "d", "label": "Despair", "counts": "f" }
  ],
  "dice": [
    { "id": "ability", "label": "Ability", "faces": [[], ["s"], ["s"], ["s", "s"], ["a"], ["a"], ["s", "a"], ["a", "a"]] },
    { "id": "proficiency", "label": "Proficiency", "faces": [[], ["s"], ["s"], ["s", "s"], ["s", "s"], ["a"], ["s", "a"], ["s", "a"], ["s", "a"], ["a", "a"], ["a", "a"], ["t"]] },
    { "id": "difficulty", "label": "Difficulty", "faces": [[], ["f"], ["f", "f"], ["h"], ["h"], ["h"], ["h", "h"], ["f", "h"]] },
    { "id": "challenge", "label": "Challenge", "faces": [[], ["f"], ["f"], ["f", "f"], ["f", "f"], ["h"], ["h"], ["f", "h"], ["f", "h"], ["h", "h"], ["h", "h"], ["d"]] },
    { "id": "boost", "label": "Boost", "faces": [[], [], ["s"], ["s", "a"], ["a", "a"], ["a"]] },
    { "id": "setback", "label": "Setback", "faces": [[], [], ["f"], ["f"], ["h"], ["h"]] }
  ],
  "success": { "symbol": "s", "needed": 1 },
  "pool": { "die": "ability", "upgrade": "proficiency", "max": 6 },
  "difficulty": { "die": "difficulty", "upgrade": "challenge", "max": 5 },
  "boost": { "die": "boost", "max": 3 },
  "setback": { "die": "setback", "max": 3 },
  "criticalSuccess": "t",
  "criticalFailure": "d",
  "difficultyLadder": [{ "label": "Easy", "dc": 1 }, { "label": "Average", "dc": 2 }, { "label": "Hard", "dc": 3 }]
}
```

- `symbols`: 2 bis 10 benannte Symbole. `counts` fügt vor dem Aufheben zusätzlich eines eines anderen Symbols hinzu: Ein Triumph fügt einen Erfolg hinzu und bleibt ein Triumph. Es nennt ein Symbol ohne eigenes `counts`; Ketten und Selbstverweise werden abgelehnt. `cancels` hebt zwei Symbole eins zu eins gegeneinander auf, mit höchstens einem Partner für jedes. Die umgekehrte Angabe ist optional. `text` erklärt dem Game Master ein Symbol.
- `dice`: 2 bis 8 benannte Würfel mit je 2 bis 20 Seiten. Seiten sind Arrays aus bis zu drei Symbol-IDs; `[]` ist leer, und wiederholte IDs zählen doppelt. Alle Verweise müssen existieren.
- `pool`: `larger-upgraded` (Standard) wirft die größere Zahl aus Attribut und Rang und wertet so viele davon auf, wie die kleinere Zahl angibt, wenn `upgrade` deklariert ist. `sum` addiert beide und wertet nichts auf. `max` ist standardmäßig 6 und darf 12 nicht überschreiten. Das Attribut verwendet `abilityModifier`; nimm für die Charakteristiken von Genesys also `identity`. Der Rang stammt aus der Ausbildungsstufe der Fertigkeit oder des Rettungswurfs; eine reine Attributsprobe hat Rang null. `with=` tauscht die Charakteristik wie bei anderen Proben aus. Boni vom Bogen, Wunden, Anpassungen und Wirkungen fügen über den unten beschriebenen vorzeichenbehafteten Bonus Verstärkungs- oder Komplikationswürfel hinzu.
- `difficulty`: `dc=` zählt gegnerische Würfel von 0 bis `max` (Standard 5, Obergrenze 12). `difficulty=` nennt stattdessen eine Stufe der Skala. `upgrade="N"` ersetzt so viele gegnerische Würfel durch den Aufwertungswürfel, begrenzt auf die tatsächlich geworfene Zahl. Es fügt nie Würfel über die Schwierigkeit hinaus hinzu.
- `boost` und `setback`: Optionale Würfel, die `bonus="+N"` beziehungsweise `bonus="-N"` hinzufügen, bis zum jeweiligen `max` (Standard 3, Obergrenze 6). Vorzeichenbehaftete Anpassungen werden verrechnet, bevor diese Grenze greift. Capability API **1.150** nimmt außerdem `setback="N"` unabhängig davon an: `bonus="2" setback="1"` wirft beide Seiten. Ein negativer Bonus kommt zu `setback` hinzu, und die zusammengezählte Zahl der Komplikationswürfel wird auf `setback.max` begrenzt; Verstärkungswürfel bleiben durch `boost.max` begrenzt.
- `allowOwnUpgrade`: Optional, ohne Angabe false. Mit `true` wertet `upgradeOwn="N"` N weitere Würfel des Charakters zu `pool.upgrade` auf (das deklariert sein muss), nach den Aufwertungen vom Bogen und den gekauften Würfeln. Sind alle vorhandenen Würfel aufgewertet, fügt jede weitere Aufwertung einen aufgewerteten Würfel hinzu, weiterhin begrenzt durch `pool.max`. Das funktioniert auch mit `pool.build: "sum"`. Wer diesen Schlüssel deklariert, auch als `false`, braucht capabilityApi **1.150**. Die Namen der Tag-Attribute verwenden wie `zeroDice` Camel Case; `upgradeOwn` betrifft den Würfelnden, und `upgrade` betrifft weiterhin nur Schwierigkeitswürfel. `setback` und `upgradeOwn` nehmen beide nicht negative ganze Zahlen und werden außerhalb von Symbolpools ignoriert; `upgradeOwn` wird außerdem ignoriert, solange es nicht eingeschaltet ist.
- `success`: Braucht nach dem Aufheben so viele seines Symbols, standardmäßig eines. Kritischer Erfolg und kritischer Fehlschlag markieren jedes Vorkommen ihres benannten Symbols, auch wenn sein hinzugefügter Erfolg oder Fehlschlag aufgehoben wird. Beide Markierungen können zusammen vorkommen, und keine von beiden ändert, ob die Netto-Erfolge die Probe bestanden haben.
- `outcomes` können die Zahl der Netto-Erfolge (`total`) oder `net successes - needed + 1` (`margin`) lesen. Ergebnisbereiche entscheiden weiterhin auf ihre übliche Weise über den Erfolg; die ursprünglichen kritischen Symbole bleiben markiert. `spend` kauft nur zusätzliche Grundwürfel des Charakters innerhalb von `pool.max`. Kämpfe sind wie bei `dice-highest` ausgenommen.
- Der Datensatz behält `resolution="sum"`, mit `symbols="2s 1a 1t"`, mit `thrown=`, das jeden Würfel benennt, und mit `rolls=`, das seine Seite ab 1 gezählt enthält. Kodierte `symbolDetails` bewahren Beschriftungen, Seitensymbole und beide kritischen Markierungen. `setback` hält die unabhängigen Komplikationswürfel fest, die nach der gemeinsamen Komplikationsgrenze tatsächlich hinzugefügt wurden, und `upgradeOwn` die zusätzlichen Aufwertungen, die tatsächlich angewendet wurden; ignorierte oder nullwertige Zusätze werden weggelassen. Karte und Zusammenfassung nennen die Netto-Symbole, auch ein leeres Ergebnis, statt Seitenzahlen zu addieren. Überschreibungen können die Regeln dieser Art ändern, aber `symbols` oder `dice` nicht ersetzen.

#### Was nicht abgedeckt ist und warum

Diese Mechaniken brauchen weiterhin eine eigene Auflösungsart:

- **Vergleichende Pools** lösen zwei Charaktere gleichzeitig auf; eine Probe hat nur einen würfelnden Charakter.
- **Summenpools mit einem besonderen Würfel**, wie in OpenD6, addieren die Würfel und behandeln einen davon gesondert.

Die beiden früher fehlenden Möglichkeiten dieser Auflösungsart sind inzwischen modelliert. Der folgende Abschnitt zum Ausgeben von Ressourcen erklärt sie. Eine allgemeine Systemregel wie „einen Punkt für einen Erfolg ausgeben“ oder „einen Punkt ausgeben, um die Fehlschläge erneut zu werfen“ wird mit `resolution.spend` beschrieben. Einen Wiederholungswurf, den das System kostenlos gewährt, wenn die Situation es verlangt, beschreibt `resolution.reroll` (siehe oben). Ein Wiederholungswurf, der zu etwas gehört, das ein Charakter ausgewählt hat, steht als `mechanics.check` an einem Katalogeintrag und wird mit dessen eigenen Kosten bezahlt.

### Ergebnisbereiche: Mehr als Erfolg oder Fehlschlag

Viele Systeme lesen eine Probe als eines von mehreren Ergebnissen statt als bloßes Gelingen oder Misslingen: die vier Erfolgsgrade von Pathfinder, ein „knapp“, das mit einem Preis gelingt, die schweren und extremen Erfolge von Call of Cthulhu, der „Erfolg mit Stil“ von Fate. `resolution.outcomes` benennt diese Bereiche, und die Engine sagt bei jeder Probe, in welchem sie gelandet ist (Capability API 1.135). Das funktioniert mit jeder Auflösungsart.

```json
"outcomes": {
  "by": "margin",
  "naturals": "shift",
  "tiers": [
    { "id": "critical_success", "label": "Critical success", "atLeast": 10, "success": true, "critical": true },
    { "id": "success", "label": "Success", "atLeast": 0, "success": true },
    { "id": "failure", "label": "Failure", "atLeast": -9 },
    { "id": "critical_failure", "label": "Critical failure", "critical": true }
  ]
}
```

- `by`: Woraus die Bereiche gelesen werden. `"margin"` (Standard) ist, wie weit das Ergebnis über dem liegt, was die Probe brauchte: eine Summe minus ihre Schwierigkeit oder die Netto-Erfolge eines Pools minus die nötigen Erfolge. `"total"` ist das Ergebnis selbst: die Summe oder die Netto-Erfolge, gleich, wie hoch die Schwierigkeit war.
- `tiers`: Zwei bis acht Bereiche, **der beste zuerst**. `atLeast` ist die niedrigste Zahl, die in einem Bereich landet. Jeder Bereich hat eine niedrigere als der vorige, und der letzte Bereich hat keine, weil er alles darunter auffängt. `success` gibt an, ob der Bereich ein Erfolg ist, und `critical` markiert ihn als kritische Ausprägung seiner Art (ein kritischer Erfolg, wenn `success` true ist, sonst ein kritischer Fehlschlag). Mindestens ein Bereich muss gelingen und mindestens einer misslingen. `text` ist eine optionale Zeile mit bis zu 200 Zeichen, die dem Game Master sagt, was der Bereich am Spieltisch bedeutet („Du schaffst es, aber der Game Master fügt eine Komplikation hinzu“).
- `on`: `"critical-success"` oder `"critical-failure"` macht einen Bereich zu dem, in dem ein kritisches Ergebnis landet, egal was die Zahl sagt, und sonst landet dort nie etwas. Er hat kein `atLeast`. Ein Bereich für einen kritischen Erfolg ist ein Erfolg, einer für einen kritischen Fehlschlag nicht, und es gibt höchstens einen von jedem. Die „zwei Sechsen“ von Blades in the Dark sind ein Bereich für einen kritischen Erfolg über dem Bereich für eine einzelne Sechs; die anderen Bereiche, die aus der Zahl gelesen werden, folgen untereinander den obigen Regeln.
- `naturals: "shift"`: Die höchste Seite eines einzelnen Würfels verschiebt das Ergebnis um einen Bereich nach oben, die niedrigste um einen nach unten, nie über die Enden hinaus. Das braucht einen einzelnen Würfel und ersetzt `resolution.naturals`; setze daneben also beide auf `none`.

Der Bereich entscheidet über das Ergebnis: Erfolg und die beiden kritischen Ergebnisse stammen aus ihm, nie aus dem bloßen Vergleich. Machen die `naturals` eines Summen-Regelsatzes eine Augenzahl zu einem automatischen Erfolg oder Fehlschlag, landet diese Augenzahl im Bereich für dieses kritische Ergebnis, sonst im besten beziehungsweise schlechtesten Bereich, und bleibt kritisch. Der Patzer eines Pools tut dasselbe am unteren Ende, und ein Pool mit Bereichen lässt `exceptional` weg, weil die Bereiche schon sagen, was ein kritischer Erfolg ist.

Mit einem Pool, der mit `by: "total"` gelesen wird, drückt ein System mit fester Schwierigkeit seine Ergebnisse aus: „1 Erfolg: Du schaffst es knapp, 2: Du schaffst es gut, 3: kritischer Erfolg“ aus Lasers & Feelings sind drei Bereiche bei 3, 2 und 1 Erfolgen und ein Fehlschlag darunter.

Der Datensatz nennt den Bereich mit `outcome="Critical success"`, die Würfelkarte zeigt ihn anstelle des einfachen Worts, und der Game Master lernt die Bereiche und ihren `text` kennen und wird angewiesen, den Bereich zu erzählen. Ein als Paket ausgelieferter Regelsatz, der Bereiche deklariert, braucht Capability API 1.135.

### Proben, die auf ihre eigene Art würfeln

Manche Spiele würfeln die meisten Proben auf eine Art und einige wenige auf eine andere: Ein Spiel alter Schule würfelt mit einem d20 unter einen Attributswert, die Diebesfertigkeiten aber mit einem d100 und Open Doors mit einem d6. `resolution.overrides` benennt diese Proben und die Auflösungsschlüssel, mit denen sie stattdessen würfeln. Capability API 1.140.

```json
"overrides": [
  { "id": "thief", "label": "Thief skills", "skills": ["open_locks", "pick_pockets"], "set": { "dice": { "count": 1, "sides": 100 } } },
  { "id": "x_in_6", "label": "X-in-6", "skills": ["open_doors", "listen"], "set": { "dice": { "count": 1, "sides": 6 } } },
  { "id": "favored", "label": "Favored", "skills": ["athletics"], "when": { "field": "favored_athletics" }, "set": { "cancel": null } }
]
```

- Jede Überschreibung nennt `skills`, `saves` oder `abilities` (eines oder mehrere der drei), ein `label` und optional `text` für den Game Master.
- `set` enthält Auflösungsschlüssel der eigenen Art des Regelsatzes, die für diese Proben die des Regelsatzes ersetzen. `null` nimmt einen Schlüssel weg: Die 1en in exwod, die bei einem bevorzugten Attribut keine Erfolge streichen, sind `"cancel": null`. Die Art, die Bogenrechnung (`abilityModifier`, `proficiency`, `proficiencyTiers`, `penaltyFrom`, `spend`, `adjust`) und die `difficultyLadder` lassen sich nicht ändern. Ein Symbolpool sperrt außerdem seine `symbols` und `dice`. Die Auflösung, die eine Überschreibung ergibt, wird wie die eigene des Regelsatzes geprüft; eine Augenzahl, die sie nennt, muss also auf ihren Würfeln vorkommen.
- `when`: Optional. Ein Wert vom Bogen des Würfelnden; die Überschreibung gilt nur, wo er nicht 0 ist, etwa bei einem Zahlenfeld mit 0 oder 1 für ein bevorzugtes Attribut. Ohne diese Angabe gilt die Überschreibung immer.
- Verwendet wird die erste Überschreibung, die die Probe nennt und deren `when` zutrifft. Eine Probe erscheint in höchstens einer Überschreibung ohne `when`.

### Ressourcen ausgeben, um einen Wurf zu verändern

Manche Systeme lassen Spieler vor einem Wurf dafür bezahlen, etwa einen Willenspunkt für einen automatischen Erfolg. `resolution.spend` beschreibt dies als allgemeine Systemregel, nicht als etwas, das ein Charakter erst erwerben musste:

```json
"spend": [{ "pool": "resolve", "amount": 1, "successes": 1, "perCheck": 2 }]
```

- `pool` ist einer deiner `live.pools`. Er darf nicht leer starten, denn dann wäre zu Spielbeginn nichts zum Ausgeben darin.
- `amount` ist der Preis für EINEN Kauf. `successes`, `dice` und `reroll` geben an, was er kauft; mindestens eines davon muss er liefern. Erfolge werden erst nach dem Zählen der Würfel und nach dem Streichen von Erfolgen hinzugefügt, weil niemand sie gewürfelt hat. Zusätzliche Würfel werden innerhalb der Pool-Grenzen mitgeworfen. Ein `reroll` lautet `{ "upTo": 6, "mode": "once" }`, wird wie `resolution.reroll` gelesen und nur einmal gekauft, egal wie viele Käufe die Probe macht: Ein zweimal erneut geworfener Würfel ist immer noch ein Wiederholungswurf.
- `perCheck` bestimmt, wie viele Käufe eine Probe machen darf. Sie kann also höchstens für `amount * perCheck` Punkte einkaufen. Diese Grenze verhindert, dass ein voller Ressourcenpool einen unfehlbaren Wurf kauft. Erlaubt sind eine Zahl von 1 bis 10, ein Wert vom Bogen in derselben Form, die ein abgeleiteter Wert liest (`{ "abilityScore": "nerve" }`, `{ "derived": "focus" }`), oder `"pool"`: so viele, wie die Probe Würfel hat, also die Zahl vom Bogen dafür vor Wunden, Bonuswürfeln oder Modifikatoren. Ein Wert vom Bogen wird für den jeweils würfelnden Charakter gelesen, abgerundet und zwischen 0 und 100 gehalten. Ein Charakter, dessen Grenze 0 ergibt, kauft nichts und bezahlt nichts.
- Ein `dice-pool`-Regelsatz kann Erfolge, Würfel oder erneute Würfe kaufen. `dice-highest` und `symbol-pool` kaufen nur Würfel. Die anderen Arten können kein `spend` deklarieren.
- Bis zu vier Einträge sind erlaubt, und zwei davon dürfen nicht denselben Pool nennen, sonst könnte eine Probe nicht sagen, welchen sie meint.
- Ein Einsatz, der einen `reroll` kauft, ein `perCheck`, das keine Zahl ist, und mehr als zwei Einträge brauchen bei einem als Paket ausgelieferten Regelsatz Capability API 1.38.

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
- `explode` und `double` verschieben die Augenzahlen dieser Regeln für diesen einen Wurf, und zwar nur, wenn deine Regel ein `min` hat, und nur innerhalb davon: `"check": { "explode": 8 }` ist ein Eintrag, durch den Achten erneut würfeln. Wie `threshold` haben sie Vorrang vor dem, was der Game Master ins Tag geschrieben hat. Capability API 1.37.
- Mindestens eine dieser Angaben ist nötig. Sonst beschreibt der Eintrag nichts und wird abgelehnt.
- Nur ein `dice-pool`-Regelsatz kann diese Angaben umsetzen. Ein `dice-sum`-Regelsatz mit `mechanics.check` wird deshalb beim Import abgelehnt.

**Bezahlt werden die eigenen `cost` des Eintrags**, über denselben Ablauf wie bei jeder anderen Nutzung: der Pool sowie je eine Nutzung jedes Zählers, den derselbe Eintrag angelegt hat. `perCostStep` sagt aus, dass der Eintrag SKALIERT. Ein Eintrag mit dieser Angabe wird so oft gekauft, wie sein Preis bezahlt wurde. Ohne diese Angabe wird er einmal gekauft, unabhängig vom angebotenen Betrag.

**Der Game Master nennt ihn direkt an der Probe:** `[skill_check: skill="Brawl" dc="3" use="Potence" spend="blood:3"]`. Auch hier gibt es keinen getrennten Bogenbefehl, denn die Würfel werden vor der Buchführung geworfen.

**Alles oder nichts.** Reicht der Pool nicht aus, findet kein Kauf statt und nichts wird abgezogen. Der Wurf bleibt genau derselbe wie ohne Kauf. Auch Punkte, die keiner ganzen Zahl von Käufen entsprechen, kaufen nichts. Eine Anforderung über `perCheck` wird begrenzt statt abgelehnt; bezahlt wird nur das erlaubte Maximum. Die Engine berechnet all das. Der Game Master nennt den vom Spieler angekündigten Einsatz und fasst die Würfel nie an. Der Datensatz nennt den tatsächlich bezahlten Betrag, den angewendeten Eintrag, die ungewürfelten Erfolge und die Anzahl erneut geworfener Würfel. Ein nicht ausgewählter Talisman oder einer, dessen Katalog die Engine nicht lesen kann, bewirkt gar nichts; seine Angaben werden nicht ungeprüft übernommen.

### Der Bogen

- `sections` gruppiert die Einträge im Editor. Felder, abgeleitete Werte und Listen nennen mit `section` den Abschnitt, in dem sie stehen; Attribute, Fertigkeiten und Rettungswürfe dürfen das ebenfalls. Der Editor, der Bogen im Spiel und der Bogenblock des Game Master zeigen sie dann unter dieser Überschrift. Ein Bogen, der bei ihnen keinen Abschnitt nennt, zeigt sie genau wie bisher. Ein Abschnitt kann außerdem eine `untrained`-Regel tragen (siehe unten).
- `abilities` enthält die Grundwerte. `skills` und `saves` können jeweils das Attribut nennen, mit dem sie würfeln, sowie ein `cap` und eine `untrained`-Regel (siehe unten).
- `fields` enthält einzelne Werte. Typen: `number`, `text`, `longtext`, `boolean`, `enum` (eine feste Auswahlliste) und `dice` (Text wie `1d8`).
- `derived`-Werte werden aus anderen Werten berechnet und können nicht überschrieben werden. Ein Bogen darf bis zu 400 davon haben (Capability API 1.111; 240 ab 1.88, 120 ab 1.84, davor 60); ein Paket mit mehr als 240 deklariert 1.111. Die Operationen sind `sum`, `min`, `max`, `scale` (mit einer festen Zahl multiplizieren und runden), `multiply` (zwei bis sechs Werte miteinander multipliziert, etwa ein Constitution-Modifikator mal die Stufe; Capability API 1.82), `stepTable` (einen Wert in Schwellen nachschlagen, etwa den Übungsbonus anhand der Stufe) und `enumTable` (eine Zahl für jeden Wert eines Enum-Felds oder eines Live-Zustands; siehe unten „Live-Zustände“).
- `lists` enthält Tabellen mit eigenen Spalten, etwa für Ausrüstung, Zauber oder Merkmale. Eine Liste hat bis zu 24 Spalten; ein Paket mit einer Liste von mehr als 12 Spalten deklariert Capability API 1.165. Eine Liste mit `pools` macht jede Zeile zu einer Ressource mit eigenem Maximum, etwa für Klassenmerkmale mit begrenzten Nutzungen. Eine Zahlenspalte kann durch einen Wurf gefüllt werden: `"roll": { "count": 1, "sides": 8 }`, wobei `sides` eine Zahl ist, eine andere Spalte derselben Zeile (`{ "column": "die" }`, eine Zahlenspalte oder ein Enum, dessen Werte sich als Würfel wie `d8` lesen) oder ein Wert vom Bogen. Der Bogeneditor zeigt eine Roll-Schaltfläche, die die eigenen Würfel der Engine wirft und die Summe einträgt, begrenzt auf `min` und `max` der Spalte (Capability API 1.85).
- `live` enthält, was sich im Spiel verändert: `pools` (Trefferpunkte, Zauberplätze, Grit), `tracks` (eine Zahl auf einer Skala, etwa Erschöpfung, oder eine Wundleiste mit ankreuzbaren Kästchen), `text` (kurze Notizen, etwa zur Konzentration eines Charakters), `conditions` und `states` (ein Wert aus einer geschlossenen Menge, etwa eine Gestalt oder eine Haltung).

Alles, was eine Zahl liest, benennt sie über einen Wertverweis: ein Objekt mit genau einem Schlüssel aus `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod`, `saveMod`, `listSum`, `livePool`, `liveTrack` oder `itemStat`. Beispiel für einen Pool mit abgeleitetem Maximum: `"max": { "derived": "grit_max" }`.

- `listSum` addiert eine Zahlenspalte einer Liste: `{ "listSum": { "list": "gear", "column": "bulk", "onlyWhen": "packed" } }`. `onlyWhen` ist optional und nennt eine boolesche Spalte; nur die Zeilen, in denen sie gesetzt ist, zählen. Eine leere Zelle zählt mit dem Standardwert ihrer Spalte, und eine von `hideWhen` ausgeblendete Liste trägt nichts bei. Ember Roads berechnet so Burden aus der Ausrüstung, die ein Charakter eingepackt hat. Anders als eine eingetippte Zahl kann der Wert dadurch nie von der Liste abweichen. Die skalierte Spalte eines Katalogs kann keine Listensumme lesen, auch nicht über einen abgeleiteten Wert: Eine Liste kann skalierte Zellen enthalten, eigene oder solche, die die Summe zurücklesen, und die Neuberechnung käme nie zur Ruhe.
- `livePool` liest, was in einem deiner `live.pools` übrig ist (der Pool einer Listenzeile gehört nicht dazu). `liveTrack` liest eine deiner `live.tracks`, mit einem optionalen `read`: `"value"`, ihr aktueller Stand (Standard); `"filled"`, wie weit sie über ihrem `min` steht; `"remaining"`, wie weit sie unter ihrem `max` steht; oder, nur bei einer Wundleiste, `"penalty"`, der geltende Abzug. Ein ausgeblendeter Pool und eine ausgeblendete Leiste lesen 0. „Harm still to take“ in Gravewatch ist `{ "liveTrack": "harm", "read": "remaining" }`.
- Ein Live-Lesezugriff liest den Live-Zustand so, wie er steht, wenn eine Probe gewürfelt wird, ein Kampf beginnt oder der Bogenblock des Game Master geschrieben wird. Gibt es noch keinen (im Bogeneditor, in einer Importprüfung), liest er den Zustand, mit dem das Spiel beginnt: einen Pool voll oder leer, wie es sein `start` vorgibt, eine Leiste auf ihrem `default`, eine Wundleiste ohne Markierung.
- Nichts, was berechnet wird, bevor es einen Live-Zustand gibt, darf einen lesen: das `max` eines Pools oder einer Leiste, der Übungsbonus sowie die skalierte Spalte oder Skalierung eines Katalogs. Das gilt auch über einen abgeleiteten Wert, der einen liest, und über eine Fertigkeit, die ein Live-Wert begrenzt. Der Import nennt den Wert, der das tut.
- Bei einem als Paket ausgelieferten Regelsatz brauchen diese drei Capability API 1.39.
- `itemStat` liest die Gegenstände, die der Charakter besitzt, etwa den Guard-Wert der getragenen Rüstung, und unterliegt derselben Regel wie ein Live-Lesezugriff. Siehe [Gegenstände auf dem Bogen](#items-on-the-sheet). Capability API 1.52.

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

### Live-Zustände: Eine Gestalt, eine Haltung, ein Licht

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

### Wundleisten: Gesundheit als Leiste statt als Zahl

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

#### Nummerierte Kästchen statt benannter Stufen

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

#### Füllen nach Kästchen und Leisten, die ablehnen

- `"fill": "indexed"` setzt eine Markierung auf das Kästchen, das der Befehl mit `box=` nennt (ohne Angabe auf das erste), oder auf das nächste freie darüber, und verschiebt eine gesetzte Markierung nie. Eine Heilung entfernt die höchste der leichtesten Markierungen. Auf dem Bogenbildschirm kann ein Spieler jedes freie Kästchen anklicken.
- `"onFull": "refuse"` lehnt eine Markierung ab, für die kein Kästchen frei ist, statt die leichteste Markierung zu erhöhen. Abgelehnt wird der gesamte Befehl: Drei Markierungen bei zwei freien Kästchen setzen gar keine. Eine Leiste, die nach Kästchen gefüllt wird, lehnt immer ab; gib das mit `"onFull": "refuse"` daneben an.

#### Stufen, die eine Liste hinzufügt

`"extra": { "list": "scars", "countColumn": "levels", "penaltyColumn": "penalty" }` an einer Leiste mit benannten Stufen lässt eine Liste auf dem Bogen sie je Charakter verlängern. Jede Zeile fügt der Reihe nach ihre Anzahl an Stufen (höchstens 16) mit ihrem Abzug hinzu, und zwar hinter der letzten Stufe, deren Abzug mindestens genauso gut ist. Stimmen die Abzüge überein, werden die neuen Stufen nach dieser Stufe benannt, sonst nach ihrem Abzug. Die Narben in Gravewatch funktionieren so. Eine vom Bogen ausgeblendete Liste fügt nichts hinzu. Wird eine Zeile gelöscht, während ihre Stufen markiert sind, bleiben die nicht mehr passenden Markierungen als Überlauf erhalten: Schaden wird nicht durch Bearbeiten des Bogens rückgängig gemacht.

`boxes`, `fill`, `onFull`, `extra` und die `kind` eines Rast-Schritts brauchen bei einem als Paket ausgelieferten Regelsatz Capability API 1.40.

### Der Abzug auf deine Würfe

`resolution.penaltyFrom` nennt die Wundleiste, deren Abzug für jede Probe dieses Regelsatzes gilt. Die Angabe wird deklariert, nicht vorausgesetzt. Ohne sie würfelt ein Regelsatz daher genauso wie vor der Einführung von Wundleisten.

Was der Abzug BEWIRKT, bestimmt wie beim eigenen Bogenwert die Auflösungsart:

- Bei `dice-pool` werden **Würfel aus dem Pool entfernt**, höchstens bis zu deinem `pool.min`. Bei `pool.min` gleich 1 wirft selbst ein Charakter auf der untersten Stufe einen Würfel. Bei `pool.min` gleich 0 wirft er keinen und scheitert ohne Wurf.
- Bei `dice-sum` gilt ein **fester Modifikator auf den Wurf**, verrechnet mit derselben Zahl, die bereits Attribut und Ausbildung addieren.

Die genannte Leiste muss eine Wundleiste sein. Eine einfache Zahlenleiste hat keinen anzuwendenden Abzug; ein Verweis darauf wird beim Import abgelehnt. Das Ergebnis nennt den angewendeten Abzug, damit Spieler die kleinere Würfelanzahl nachvollziehen können. Auch der Bogenblock des Game Master zeigt die Stufe und ihren Abzug.

### Modifikatoren vom Bogen

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

### Rasten

Eine Rast ist eine Liste von Wiederherstellungsschritten und zu entfernenden Dingen. Jeder Schritt nennt genau ein Ziel (`pool`, `poolGroup`, `listPools`, `track` oder `state`) und setzt es entweder auf einen Wert (`"to": "max"`, `"to": "min"` oder eine Zahl) oder verändert es (`"by": { "const": 1 }` oder `"by": { "fractionOfMax": 0.5 }`). Ein Schritt für eine Wundleiste kann sie nur heilen, sein `by` ist daher negativ; siehe oben. Ein Schritt für einen Live-Zustand setzt ihn nur, und zwar auf `"default"` oder einen seiner Werte. Ein `poolGroup`-Schritt mit `fractionOfMax` verändert jeden Pool der Gruppe um seinen eigenen Anteil. Mit `"shared": true` (Capability API 1.77) wird der Anteil stattdessen aus dem Maximum der ganzen Gruppe berechnet und in der Reihenfolge, in der der Bogen die Pools auflistet, auf die Pools der Gruppe verteilt, jeder bis zu dem, was ihm fehlt. Die lange Rast in 5e, „die Hälfte der Gesamtzahl der“ Trefferwürfel des Charakters, gehalten in einem Pool pro Würfeltyp, ist `{ "poolGroup": "hit_dice", "by": { "fractionOfMax": 0.5, "round": "down", "min": 1 }, "shared": true }`.

### Text für den Game Master

- `checkGuidance` ersetzt den eingebauten Absatz, der dem Game Master erklärt, wie er eine Probe anfordert. Nenne das System und beschreibe, wann gewürfelt werden soll. Der Game Master nennt nur Fertigkeit und Schwierigkeit. Die Engine würfelt und rechnet anhand des Bogens; fordere das Modell deshalb nicht zum Rechnen auf.
- `sheetGuidance` stellt die Charakterbögen im Prompt vor. Erkläre darin, welche Ressourcen wichtig sind und wann sie verbraucht werden sollen.
- `worldGuidance` ist optional und wird einmal bei der Welterzeugung gelesen. So passt die vom Game Master erfundene Welt zu deinen Regeln: kein Schießpulver, seltene Magie, wandelnde Tote. Der Text gelangt nie in einen Zug.
- `sheetSummary` wählt die Felder, abgeleiteten Werte und Listenzeilen, die der Game Master pro Charakter sieht. Die Engine zeigt immer Attributsmodifikatoren, ausgebildete Fertigkeiten und Rettungswürfe sowie laufende Werte. Halte den Rest kurz, denn er wird in jedem Zug gesendet. Die `nameColumn` einer Zusammenfassungsliste darf eine Text- oder Enum-Spalte sein (ein Enum zeigt die Beschriftung seines Werts), und `columns` nennt bis zu drei weitere Spalten der Zeile, die nach dem Namen ausgegeben werden. Der Block lautet dann `Gear: Crowbar 1d6` statt nur Namen. Eine boolesche Spalte gibt ihre Beschriftung aus, wenn sie gesetzt ist. Beides braucht bei einem als Paket ausgelieferten Regelsatz Capability API 1.37.
- Den Bogenbefehl musst du in `sheetGuidance` nicht erklären. Die Engine bringt dem Game Master jeden Befehl selbst bei, mit den Namen, die deine Datei deklariert. Hat dein Regelsatz eine Wundleiste, ergänzt sie den Befehl `op="damage"` zum Markieren und listet die Stufen und Schadensarten der Leiste auf. Hat er Live-Zustände, ergänzt sie den Befehl `op="state"` und listet die möglichen Werte jedes Live-Zustands auf.

### Vollständige Regelreferenz für den Game Master (Capability API 1.145)

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
- `holds`: `"rows"` (Standard und der Wert aller vor dieser Veröffentlichung geschriebenen Kataloge), `"creatures"` oder `"items"`. Ein Kreaturenkatalog ist ein Bestiarium für Kämpfe, und ein Gegenstandskatalog listet Dinge auf, die eine Gruppe mit sich führt. Keiner von beiden schreibt etwas auf einen Bogen, deklariert `feeds` oder wird je in der Auswahl angeboten. Siehe unten [Kreaturen](#creatures-a-bestiary-a-fight-reads) und [Gegenstände](#items-what-a-party-carries).
- `feeds`: Die Listen deines Bogens, in die Einträge dieses Katalogs schreiben dürfen, mindestens eine und höchstens acht. Für Zeilenkataloge erforderlich, bei Kreaturen- und Gegenstandskatalogen nicht erlaubt. Ein Eintrag kann niemals in eine hier nicht genannte Liste schreiben oder einen Wert ablegen, den die Spalten der Liste nicht aufnehmen können.
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
- Eine Zeile mit `scaled` muss entweder die einzige Zeile dieses Eintrags für die betreffende Liste sein, sodass eine markierte Bogenzeile immer zu genau einer Vorgabe passt, oder (Capability API 1.92) jede Zeile, die der Eintrag in diese Liste schreibt, muss ihren eigenen Namen in der Namensspalte der Liste tragen (der `nameColumn` ihrer Pools, sonst ihrer ersten Textspalte). Die Zeile auf dem Bogen wird dann über diesen Namen ihrer Vorgabe zugeordnet. So kann ein Merkmal zwei Nutzungen geben, die jeweils für sich wachsen; eine Zeile, die der Spieler umbenennt, bleibt unverändert.

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

Ein Eintrag kann einen optionalen `mechanics`-Block mit seinen Wirkungen in Zahlen tragen: `kind` (`attack`, `heal`, `buff`, `debuff`, `utility`, `rider`), `range`, `area`, `targets`, `targetCount`, `friendlyFire`, `amount` (Würfel wie `2d6` oder eine feste Zahl), `amountAdd` (ein Wert vom Bogen des Nutzers, der zur Menge addiert wird, etwa `{ "field": "level_fighter" }` für einen Second Wind von 1d10 plus der Kämpferstufe; braucht ein `amount`, wird nur in den eigenen Kämpfen des Regelsatzes gelesen – die Classic- und Tactical-Kämpfe der Engine verwenden die Menge so, wie sie geschrieben ist – und ist Capability API 1.83), `damageType`, `attackRoll`, `autoHit`, `save` (einer der Rettungswürfe des Bogens samt Erfolgswirkung), `applies` (Zustände für betroffene Ziele), `temporary` (temporäre Punkte auf dem Gesundheitspool), `scales` (eine mit dem Bogen wachsende Menge), `cost` (der bei Nutzung belastete Pool), `perCostStep`, `targetsPerCostStep`, `budget` (der verbrauchte Teil des Aktionsbudgets), `concentration`, `reaction`, `plus`, `free`, `gives`, `standard`, `rider` und `check`.

Ein Angriff, der auf Gegner zielt, kann mit `summons` etwas zurücklassen, das in späteren Zügen zuschlägt (Capability API 1.122). Für Spiritual Weapon setzt du `"summons": { "budget": "bonus", "rounds": 10, "move": 20, "reach": 5 }` an seinen Angriffseintrag. Das Wirken führt den ersten Angriff aus und lässt die Waffe neben ihrem ersten Ziel zurück, sobald die Reaktionen abgeschlossen sind; ein abgebrochenes Wirken lässt nichts zurück. Spätere Angriffe verbrauchen nur das deklarierte Budget, behalten für die Skalierung des Schadens die Stufe, auf der das Wirken bezahlt wurde, und öffnen dieselben Reaktionsfenster. Entfernungen verwenden die Einheit des Katalogs; fehlt die Bewegung, ist sie null, fehlt die Reichweite, ist sie eine Zelle. Auf einem Brett kann die Waffe einen Gegner innerhalb von Bewegung plus Reichweite treffen, ohne Wände zu beachten, und bewegt sich neben ihn. Ohne Brett ist jeder stehende Gegner in Reichweite. Runden zählen am Ende der Züge ihres Besitzers herunter, den Zug des Wirkens ausgenommen. Die Beschwörung endet bei null, wenn ihr Besitzer besiegt wird oder wenn die Konzentration ihres Eintrags endet. Wird derselbe Eintrag erneut gewirkt, ersetzt das seine Beschwörung.

Ein Eintrag mit `area` kann mit `zone` bestehen bleiben (Capability API 1.172): `{ "rounds", "anchor", "triggers", "atCast" }`. Die Zone besteht `rounds` (1 bis 1.000) Züge ihres Wirkenden lang, gezählt wie bei einer Beschwörung, und endet früher, wenn die Konzentration endet, die sie aufrechterhält, oder wenn ihr Wirkender besiegt wird. `anchor: "point"` (Standard) behält die Zellen, auf die sie gewirkt wurde; `anchor: "caster"` ist eine Kreisfläche um ihren Wirkenden, die mit ihm mitgeht, ihre Reichweite ist also 0. `triggers` nennt, wann sie die eigene Wirkung des Eintrags (amount, plus, save, applies) erneut auf eine Kreatur anwendet: `enter` (die Kreatur bewegt sich hinein, oder eine vom Wirkenden mitgeführte Zone erreicht sie), `turn-start` oder `turn-end` (sie beginnt oder beendet ihren Zug darin). Eine Kreatur wird höchstens einmal pro Zug erfasst, egal durch welchen Auslöser, und wen das Wirken selbst erfasst hat, der gilt in diesem Zug als erfasst. Wen die Zone erfasst, richtet sich nach dem Eintrag: `friendlyFire: false` lässt die Seite des Wirkenden aus, eine Heilung oder ein Eintrag für Verbündete bleibt bei ihr, und eine vom Wirkenden mitgeführte Zone erfasst ihn nie. `atCast: false` bewirkt beim Erscheinen nichts. Wird der Eintrag erneut gewirkt, ersetzt das seine Zone. Das Brett färbt ihre Zellen ein, der Kampf listet sie mit ihren verbleibenden Zügen auf, und das Protokoll nennt jede Erfassung. Ohne Brett hält sie fest, auf wen sie gewirkt wurde, und `turn-start` und `turn-end` erfassen diese Kreaturen.

```json
"mechanics": { "kind": "attack", "area": { "shape": "burst", "size": 20 }, "range": 120,
  "amount": { "dice": "5d8" }, "damageType": "poison", "save": { "save": "con_save", "onSuccess": "half" },
  "concentration": true, "zone": { "rounds": 100, "triggers": ["enter", "turn-start"] } }
```

Das ist Cloudkill. Spirit Guardians ist `"area": { "shape": "burst", "size": 15 }, "range": 0, "friendlyFire": false` mit `"zone": { "rounds": 100, "anchor": "caster", "triggers": ["enter", "turn-start"], "atCast": false }`; Moonbeam ist eine Kreisfläche von 5 Fuß mit `"triggers": ["enter", "turn-start"]`.

Eine an einem Punkt gehaltene Zone kann sich bewegen und ihren Boden verändern (Capability API 1.173). `move: { "budget", "distance" }` lässt ihren Wirkenden sie in seinem Zug bewegen: Der Kampf bietet für dieses Budget „Move <zone>“ an, auf dem Brett wie ein Gang ausgewählt, auf jede Zelle innerhalb von `distance` um ihren Mittelpunkt. `drift: { "distance" }` bewegt sie zu Beginn jedes Zuges ihres Wirkenden so weit geradewegs von ihm weg und hält am Rand des Bretts an. In beiden Fällen wird jeder, den sie jetzt bedeckt und vorher nicht bedeckt hat, so erfasst, wie `enter` es angibt. Nur eine an einem Punkt gehaltene Kreisfläche bewegt sich oder treibt. `terrain: { "difficult": true }` lässt jede ihrer Zellen für jeden, den sie erfasst, beim Betreten doppelt kosten (Boden, der ohnehin schwieriges Gelände ist, wird nicht noch einmal verdoppelt), und `terrain: { "perDistance": { "every", "amount", "damageType" } }` fügt jedem, den sie erfasst, für jede Strecke von `every`, die er sich darin bewegt, `amount` zu (Würfel und fester Wert wie beim Eintrag selbst), ohne Rettungswurf und über mehrere Gänge hinweg gezählt. Das Protokoll nennt jede Bewegung, jedes Treiben und jeden Schaden.

```json
{
  "id": "moonbeam",
  "name": "Moonbeam",
  "mechanics": {
    "kind": "attack",
    "range": 120,
    "area": { "shape": "burst", "size": 5 },
    "amount": { "dice": "2d10" },
    "damageType": "radiant",
    "save": { "save": "con_save", "onSuccess": "half" },
    "concentration": true,
    "zone": { "rounds": 10, "triggers": ["enter", "turn-start"], "move": { "budget": "action", "distance": 60 } }
  }
}
```

Cloudkill ergänzt `"drift": { "distance": 10 }`. Spike Growth ist eine Kreisfläche von 20 Fuß ohne eigene Menge, mit `"triggers": []` (ihr Boden ist alles, was sie bewirkt), `"atCast": false` und `"terrain": { "difficult": true, "perDistance": { "every": 5, "amount": { "dice": "2d4" }, "damageType": "piercing" } }`.

Eine Zone kann bei denen, die sie erfasst, mehr bewirken (Capability API 1.174). `breaksConcentration: true` lässt eine Kreatur, die sie erfasst, während sie sich konzentriert, vor der Wirkung des Eintrags den Konzentrationsrettungswurf des Regelsatzes gegen die eigene Rettungswurfschwierigkeit des Eintrags würfeln; bei einem Fehlschlag verliert sie ihre Konzentration. Der Eintrag braucht dafür ein `save`. `damageCap` beendet die Zone, sobald sie nach ihrem Erscheinen insgesamt so viel Schaden verursacht hat, ihre Erfassungen und ihren Boden mitgezählt. Sleet Storm ist eine Kreisfläche von 40 Fuß mit `"save": { "save": "dex" }`, `"applies": [{ "condition": "prone", "duration": "instant" }]` und `"zone": { "rounds": 10, "triggers": ["enter", "turn-start"], "breaksConcentration": true, "terrain": { "difficult": true } }`. Guardian of Faith ist eine Kreisfläche mit `"friendlyFire": false`, `"amount": { "flat": 20 }` und `"zone": { "rounds": 1000, "triggers": ["enter", "turn-start"], "atCast": false, "damageCap": 60 }`.

Wogegen man sich aus einem von einem Eintrag auferlegten Zustand befreit, kann die eigene Rettungswurfschwierigkeit des Eintrags sein (1.174): `"escapeDc": "save"` am `applies`-Eintrag, neben einer vergleichenden Probe, deren `from.holding` dieser Zustand ist. Web und Black Tentacles setzen mit `{ "condition": "restrained", "duration": "until-save", "escapeDc": "save" }` fest, und die vergleichende Probe der festgesetzten Kreatur zum Befreien wird gegen die Rettungswurfschwierigkeit der Zauber des Wirkenden gewürfelt. Hat etwas den Zustand ohne Rettungswurfschwierigkeit auferlegt, läuft die Befreiung so ab, wie die vergleichende Probe es angibt, gegen den, der den Zustand hält.

Auch das `use` eines Gegenstands kann `concentration` und `zone` tragen (1.174), wie ein Katalogeintrag; eine Zauberschriftrolle mit Cloudkill oder Moonbeam behält also ihre bleibende Fläche und wird durch die Konzentration ihres Lesers aufrechterhalten.

Eine bewegte Zone kann rammen, und ihr Boden kann mehr kosten (Capability API 1.175). `move: { ..., "ram": true }` schickt sie Zelle für Zelle geradewegs dorthin, wohin sie bewegt wurde. Auf der ersten Zelle, auf der sie jemanden erreicht, den sie vorher nicht bedeckt hat, hält sie an, erfasst ihn wie bei einem Rammen (egal, was ihre Auslöser sagen) und kann in diesem Zug nicht erneut bewegt werden. Kreaturen, die in sie hineingehen, werden nur so erfasst, wie ihre Auslöser es angeben. Flaming Sphere ist eine Kreisfläche von 5 Fuß mit `"triggers": ["turn-end"]` und `"move": { "budget": "bonus", "distance": 30, "ram": true }`. `terrain.costTimes` (2 bis 10) lässt jeden Schritt hinein so viele einfache Schritte kosten, und Boden, der ohnehin schwieriges Gelände ist, kostet nicht mehr als das: Plant Growth ist `"terrain": { "costTimes": 4 }`. Es ersetzt `difficult`, das `costTimes: 2` entspricht. `terrain.halvesSpeed: true` lässt jeden Schritt darin noch einmal doppelt kosten, zusätzlich zu schwierigem Gelände: Spirit Guardians ist `"terrain": { "halvesSpeed": true }`.

Zustände, mit denen ein Zauber jemanden festhält, lassen sich nur so brechen, wie der Zauber es sagt (ebenfalls 1.175). Eine vergleichende Probe zum Losreißen mit `"from": { "holding": "restrained", "escapable": true }` wird nur gegen ein Festhalten angeboten, das ein `escapeDc` nennt; dieselbe vergleichende Probe zerreißt also ein Netz, aber nie eine Versteinerung. `applies[].escapeChecks` nennt die Probenwerte der vergleichenden Probe, mit denen sich dieses Festhalten brechen lässt, anstelle der eigenen Angreiferwerte der vergleichenden Probe: Black Tentacles setzt mit `"escapeDc": "save", "escapeChecks": ["might", "agility"]` fest und Web mit `"escapeChecks": ["might"]`. `zone.whileHeld: { "condition", "amount", "damageType" }` fügt ihre Menge ohne Rettungswurf und anstelle der eigenen Wirkung der Zone jedem zu, der einen Zug darin beginnt und bereits durch diesen Zustand von ihrem Wirkenden festgehalten wird: das `"whileHeld": { "condition": "restrained", "amount": { "dice": "3d6" }, "damageType": "bludgeoning" }` von Black Tentacles.

Ein Eintrag oder die Nutzung eines Gegenstands kann kurieren (Capability API 1.176). `ends: { "conditions": [...], "count"? }` nimmt diese Zustände in der genannten Reihenfolge von seinem Ziel, höchstens `count` davon: Lesser Restoration ist `"ends": { "conditions": ["blinded", "deafened", "paralyzed", "poisoned"], "count": 1 }`. `stabilizes: true` stabilisiert ein sterbendes Ziel, das danach keine Todesrettungswürfe mehr würfelt, und braucht einen Kampfblock mit einer `dying`-Regel: Spare the Dying. `revives: { "withinRounds", "health" }` wird nur auf jemanden gerichtet, der vor höchstens so vielen Runden gestorben ist, und bringt ihn mit dieser Menge zurück: Revivify ist `"revives": { "withinRounds": 10, "health": { "flat": 1 } }`. Ein Eintrag, der nur Zustände beendet oder stabilisiert, wird nur gegen jemanden angeboten, dem er helfen würde; einer der Art `utility`, der sonst nichts zu tun hat, wird angeboten, solange er etwas kuriert.

Flächen können Quadrate sein und bleibende Flächen Wände (Capability API 1.177). `area.shape: "box"` ist ein Quadrat mit der Seitenlänge `size`, dessen nahe Ecke auf der anvisierten Zelle liegt und das sich von seinem Urheber weg erstreckt; entlang einer Achse, auf der sein Urheber auf gleicher Höhe steht, ist es stattdessen auf diese Zelle zentriert. Ohne `range` liegt es direkt an seinem Urheber an. Web ist `"area": { "shape": "box", "size": 20 }` mit einer Reichweite von 60. `area.shape: "wall"` bleibt immer bestehen und braucht daher eine `zone`: Sie ist `size` lang und `width` dick (ohne Angabe eine Zelle) und verläuft durch die anvisierte Zelle quer zur Linie von ihrem Urheber oder von dort in Richtung der Zelle `toward` der Auswahl. Mit `"ring": <diameter>` kann ihr Wirkender sie stattdessen als Ring dieses Durchmessers um die anvisierte Zelle legen, wenn die Auswahl `"ring": true` angibt. Eine Wand braucht keinen Auslöser: Wind Wall wirkt nur beim Erscheinen. Eine Wand wird nie bewegt, treibt nicht und folgt nicht ihrem Urheber. `zone.blocks: ["move", "sight"]` sperrt ihre Zellen, solange sie steht, für Bewegung, für Sicht oder für beides, und wer dort steht, wo sie entsteht, wird auf die nächste freie Zelle gesetzt (auf ihre gewählte Seite, wenn eine solche ebenso nah ist): Wall of Stone blockiert beides, Wall of Force die Bewegung, Wall of Fire die Sicht. `zone.side: { "distance", "triggers" }` lässt neben den eigenen Zellen der Wand die Zellen innerhalb von `distance` auf einer Seite so erfassen, wie ihre eigenen `triggers` es angeben. Das `side` der Auswahl sagt, welche Seite: `near` zu ihrem Urheber (innerhalb eines Rings) oder `far` (außerhalb), ohne Angabe die ferne Seite. Wall of Fire ist `"area": { "shape": "wall", "size": 60, "ring": 20 }`, `"zone": { "rounds": 10, "triggers": ["enter", "turn-end"], "blocks": ["sight"], "side": { "distance": 10, "triggers": ["turn-end"] } }`.

Sehen zählt (Capability API 1.178). `combat.senses` listet die Sinne auf, die dort sehen, wo Augen es nicht können, jeweils `{ "id", "label", "sheet"?, "blind"? }`: Die Reichweite eines Charakters wird über `sheet` von seinem Bogen gelesen (bei null keine), eine Kreatur trägt ihre eigenen als `"senses": { "darkvision": 60 }` in der Entfernungseinheit des Regelsatzes, und ein `blind`-Sinn (Blindsicht, Erschütterungssinn) funktioniert ohne Augen. Der Block braucht dann `combat.distance`. Eine Zone mit `obscures` verbirgt alles darin und alles, was durch sie hindurch gesehen wird, vor jedem, der keinen der in `pierced` genannten Sinne in Reichweite hat: Fog Cloud ist `"obscures": {}`, Darkness `"obscures": { "pierced": ["blindsight", "truesight"] }`. Eine solche Zone braucht keinen Auslöser, und ein `utility`-Eintrag, der nur eine Fläche stehen lässt (Fog Cloud, Darkness, eine Wand), steht im Menü und wird abgelegt, wo sein Wirkender es wählt. Ein Eintrag in `combat.conditions` mit `unseen` verbirgt seinen Betroffenen auf dieselbe Weise: unsichtbar ist `"unseen": { "pierced": ["blindsight", "truesight"] }`. `combat.sight` legt fest, was das bewirkt: `unseenAttacks: true` gibt einem Angriff Vorteil, wenn sein Ziel den Angreifer nicht sehen kann, und Nachteil, wenn der Angreifer sein Ziel nicht sehen kann, und `eyes` nennt den Sinn, der das Sehen ist (so wie das `lacks` eines Zustands ihn nennt); eine geblendete Kreatur sieht also nur über einen `blind`-Sinn. Ein Eintrag oder eine Kreaturenaktion mit `seen: true` darf nur Ziele wählen, die ihr Urheber sehen kann, wie es „eine Kreatur in Reichweite, die du sehen kannst“ verlangt. Eine Kreisfläche oder ein Quadrat kann mit `area.copies` (2 bis 10) mehrmals gleichzeitig abgelegt werden, wobei jede Kopie eine andere berührt, und der Spieler platziert jede einzeln: Fire Storm ist `"area": { "shape": "box", "size": 10, "copies": 10 }`. Eine mehrmals abgelegte Zone bleibt, wo sie gewirkt wurde.

Zonen können auf jeden wirken, der in ihnen steht (Capability API 1.179). `combat.components` nennt, was die Nutzung von etwas erfordern kann, jeweils `{ "id", "label" }` (in 5e verbal, Geste, Material), und ein Eintrag oder die Aktion einer Kreatur listet ihre eigenen in `components` auf. Das `inside` einer Zone legt jedem darin die `conditions` auf und hält die Schadensarten in `immune` von ihm fern, solange er darin bleibt. Ihr `forbids: { "components": [...] }` verhindert, dass darin etwas genutzt wird, das diese erfordert, so wie das `forbids` eines Zustands es für dessen Betroffenen tut (geknebelt). Silence ist `"inside": { "conditions": ["deafened"], "immune": ["thunder"] }, "forbids": { "components": ["verbal"] }`. Die `wards: { "catalogs": [...], "maxLevel": N }` einer Zone halten von jedem darin alles aus diesen Katalogen fern, das von außerhalb auf Stufe N oder niedriger genutzt wird, gemessen an der Stufe, auf der es bezahlt wurde: Globe of Invulnerability ist `"wards": { "catalogs": ["spells"], "maxLevel": 5 }`. Ein Zustand, der Budgets wegnimmt (`budgets` mit negativem `flat`) und während des eigenen Zuges seines Betroffenen auferlegt wird, nimmt sie auch diesem Zug weg; ein misslungener Rettungswurf gegen Stinking Cloud zu Beginn des Zuges kostet also die Aktion dieses Zuges.

Sinne und Sehen gehen weiter (Capability API 1.180). Ein von einem Eintrag auferlegter Zustand kann enden, wenn sein Betroffener handelt: `"endsWhenHolder": { "attacks": true, "casts": ["spells"] }` entfernt ihn, sobald dieser einen Angriff ausgeführt oder einen Eintrag eines genannten Katalogs genutzt hat, und eine Gegenstandsnutzung mit `"casts": "spells"` (eine Schriftrolle, ein Zauberstab) zählt als Wirken aus diesem Katalog. Der Angriff oder Zauber, der ihn beendet hat, hatte ihn noch; Invisibility gibt diesem einen Angriff also Vorteil und ist danach weg. Was eine stehende Zone von selbst tut, ist keine Handlung ihres Wirkenden. Ein Zustand in `combat.conditions` oder die `worn`- oder `carried`-Wirkung eines Gegenstands kann Sinne mit einer Reichweite in der Entfernungseinheit des Regelsatzes geben, `"senses": { "darkvision": 60 }`; solange er besteht, zählt die längere aus dieser und der eigenen Reichweite des Betroffenen. So funktionieren der Zauber Darkvision, True Seeing (`{ "truesight": 120 }`) und eine Brille der Nacht. Ein Zustand mit `"cancelsUnseen": true` lässt jeden seinen Betroffenen sehen, egal welcher Zustand ihn verbirgt, so wie Faerie Fire Unsichtbare umreißt; verdeckende Zonen und Wände verbergen ihn weiterhin.

Schutz, Rettungswürfe, Zauberwirken von Monstern und Schriftrollen gehen weiter (Capability API 1.181). Die `wards` einer Zone vergleichen die Stufe, auf der ein Zauber bezahlt wurde, sofern sie nicht `"by": "base"` angeben; das vergleicht die eigene Stufe des Zaubers, egal wie er bezahlt wurde, wie Globe of Invulnerability es tut. `"maxLevelPerCostStep": 1` hält für jede Stufe, um die das eigene Wirken des Schutzes über seiner Basis bezahlt wurde, eine Stufe mehr fern. Das `save` eines Eintrags oder einer Kreaturenaktion kann angeben, wogegen es außerdem zählt, `"against": { "damage": ["poison"] }`, sodass ein Rettungswurfmodifikator mit `against` Gift darauf angewendet wird, und wer ohne Wurf besteht: `"succeeds": { "immune": ["poison"], "conditionImmune": ["poisoned"], "is": { "tags": ["nonbreathing"] } }` (eines davon genügt), wie Stinking Cloud es braucht. Das `spellcasting` einer Kreatur kann anstelle der eigenen `components` jedes Eintrags angeben, was ihre Zauber brauchen, für das ganze Merkmal oder pro Zauber, mit `[]` für angeborenes Zauberwirken ohne Komponenten, sodass Silence es nicht verhindert. Eine Gegenstandsnutzung darf `"kind": "utility"` sein, wenn sie nur eine Fläche stehen lässt (eine Schriftrolle mit Fog Cloud, Darkness, Silence oder Globe of Invulnerability); sie braucht dann ein `area` und eine `zone`.

Stöße, Winde und Brillen (Capability API 1.182). Das `"push": 15` eines Eintrags stößt jeden, den er trifft und der ihm nicht mit einem Rettungswurf entgeht, 15 Einheiten der Katalogentfernung geradewegs von seinem Urheber weg und hält an allem Festen oder an jedem Stehenden an; eine Zone stößt jeden, den sie erfasst, auf dieselbe Weise. Eine Zone, die ihr Wirkender hält (`"anchor": "caster"`), darf jetzt auch eine Linie oder ein Kegel statt einer Kreisfläche sein: Sie zeigt in die Richtung, in die sie gewirkt wurde, und geht mit ihrem Wirkenden mit, und `"turn": { "budget": "bonus" }` lässt ihn in seinem Zug dieses Budget ausgeben, um sie in eine andere Richtung zu drehen. Dabei erfasst sie jeden, den sie jetzt bedeckt, als wäre er in sie hineingegangen (Gust of Wind in 5e). Das `terrain` einer Zone mit `"towardCaster": true` lässt ihr schwieriges Gelände nur für einen Schritt zählen, der den Gehenden näher an ihren Wirkenden bringt. Ein Sinn, den ein Zustand oder ein Gegenstand gibt, kann statt einer Reichweite `{ "add": 60 }` sein; das wird zur eigenen Reichweite des Betroffenen für diesen Sinn addiert oder gibt jemandem ohne diesen Sinn 60 (die Brille der Nacht in 5e).

Zonen, die später losgehen oder wegbrennen (Capability API 1.183). Eine Zone mit `"detonates"` bewirkt nichts, solange sie steht, und nichts beim Wirken: Wenn sie endet, weil ihre Konzentration endete, ihre Runden abgelaufen sind oder sie erneut gewirkt wurde, wendet sie die eigene Wirkung des Eintrags einmal auf jeden darin an. `"grows": { "dice": "1d6" }` addiert am Ende jedes Zuges ihres Wirkenden so viel zu ihrer Menge, auch im Zug des Wirkens; es würfelt also dieselben Würfel wie die eigene Menge des Eintrags. `"touched": true` lässt jeden, der sich auf ihre Mitte bewegt, den Rettungswurf des Eintrags würfeln, und bei einem Fehlschlag löst sie aus (Delayed Blast Fireball in 5e). Sie bleibt, wo sie gewirkt wurde. Eine Zone mit `"burns": { "by": ["fire"], "amount": { "dice": "2d4" }, "damageType": "fire" }` wird durch Schaden einer dieser Arten entzündet, der auf einer ihrer Zellen oder bei jemandem darin landet. Sie brennt weg, wenn der Zug ihres Wirkenden wieder an der Reihe ist, beendet damit den Zauber und fügt in der Zwischenzeit jedem anderen, der einen Zug darin beginnt, ihre Menge ohne Rettungswurf zu (Web in 5e).

Auch Kreaturen stoßen (Capability API 1.184). Die Aktion einer Kreatur nimmt wie ein Katalogeintrag `"push": 60` in der eigenen Entfernungseinheit des Regelsatzes an: Wen sie trifft, der wird so weit geradewegs von der Kreatur weggestoßen, und mit einem `save` nur, wenn er ihn nicht schafft. `"onSuccess": "none"` behält also den Schaden und erspart nur den Stoß und das, was `applies` auferlegt (Tail einer Drachenschildkröte). Eine Gegenstandsnutzung kann einer Linie ihre `width` geben, wie bei den 60 mal 10 Fuß einer Schriftrolle mit Gust of Wind.

Was eine Kreatur ist, zählt mehr (Capability API 1.185). Ein Rettungswurf kann `"modes": [{ "is": { "types": ["undead"] }, "mode": "disadvantage" }]` angeben, sodass ein Ziel dieser Art ihn zweimal würfelt und den schlechteren behält (Sunbeam); das `"maxAgainst": { "types": ["plant"] }` eines Eintrags verursacht bei einem Ziel dieser Art den höchstmöglichen Schaden (Blight). `targetTypes` kann außerdem `"abilityAtMost": { "int": 3 }` angeben, für ein Ziel, dessen Wert höchstens so hoch ist (eine ohne diesen Wert geschriebene Kreatur wird nicht ausgeschlossen), und `"notImmuneTo": ["charmed"]` (Sleep). Der Modifikator eines Zustands kann Angriffe zweimal würfeln lassen: `{ "to": "attacks", "mode": "disadvantage", "atSource": true }` sind die eigenen Angriffe des Betroffenen gegen den, der ihm den Zustand auferlegt hat (Chill Touch), und `{ "to": "attacks-taken", "mode": "disadvantage", "from": { "types": ["fiend", "undead"] } }` sind Angriffe gegen den Betroffenen von Angreifern dieser Art (Protection from Evil and Good). Eine Änderung an Rettungswürfen kann `"against": { "from": { "types": ["dragon"] } }` sein, was auf jeden Rettungswurf gegen etwas passt, das eine Kreatur dieser Art getan hat (Dragon Scale Mail).

Die Aktionen einer Kreatur können gemeinsam wieder aufladen (Capability API 1.186): Gib jedem `"recharge"` dieselbe `"group"` und dieselben Würfel. Die Nutzung einer davon verbraucht beide, und ein Wurf zu Beginn des Zuges der Kreatur bringt beide zurück (die zwei Odemwaffen eines metallischen Drachen). Ein Schlag kann `"charge"` haben: `{ "atLeast": 10, "plus": [{ "dice": "2d8", "type": "piercing" }], "save": { "save": "str_save", "difficulty": 14 }, "push": 10, "applies": [{ "condition": "prone", "duration": "instant" }] }` fügt seine Bestandteile hinzu, wenn der Gang der Kreatur in diesem Zug mit einem Anlauf von mindestens `atLeast` geradewegs auf den Getroffenen endete, jeder Schritt ein Feld näher an ihn heran. Dann würfelt das Ziel den Rettungswurf und wird bei einem Fehlschlag (oder ohne Rettungswurf immer) gestoßen und erhält die Zustände (Charge eines Minotaurus). Ein Sturmangriff hängt an einem Schlag gegen ein Ziel und wird nur auf einem Brett gemessen.

Das `attack` eines Gegenstands kann mehr darüber sagen, was es trifft (Capability API 1.187). `"against": [{ "is": { "types": ["construct"] }, "toHit": 2 }]` addiert etwas zum Treffen gegen ein Ziel dieser Art (ein Streitkolben des Zerschmetterns). Ein `plus`-Bestandteil kann `"not": { "types": ["construct", "undead"] }` angeben, um Ziele dieser Art zu überspringen, `"blow": "ranged"`, um nur bei einem Wurf oder Schuss zu zählen (ein Zwergenwerfer), oder `"melee"` nur bei einem Schlag in Reichweite, und `"tempHp": true`, um dem Träger temporäre Trefferpunkte in Höhe des verursachten Schadens zu geben (ein Schwert des Lebensraubs). Ein `onHit`-Zustand kann `"targetIs"` nennen (ein Riesentöter, der einen Riesen umwirft) und `"oncePerTurn": true` (ein Schwert der Verwundung). `"slay": [{ "when": "critical", "not": { "types": ["construct", "undead"] }, "healthAtMost": 99, "save": { "save": "con_save", "difficulty": 15 }, "charges": 1 }]` tötet ein Ziel, das der Treffer bei `healthAtMost` oder weniger zurückgelassen hat, sofort, bei einem misslungenen Rettungswurf, wo es einen gibt, und verbraucht dabei die Ladungen des Gegenstands (ein Neun-Leben-Dieb); `"immuneTo": ["slashing"]` verschont ein Ziel, das dagegen immun ist (ein Vorpalschwert). Die Gesundheit wird nach dem Schaden des Schlags gelesen.

`live.conditions` eines Bogens, `clear.conditions` einer Rast und `combat.conditions` fassen bis zu 320 Einträge (Capability API 1.269; 160 ab 1.188, davor 80). Ein Modifikator `to: "attacks"` kann `"ability": "str"` nennen, damit er nur Angriffe mit diesem Attribut verändert (Weakening Breath eines Golddrachen), und ein Modifikator `to: "checks"` kann `"abilities": ["str"]` nennen, damit er nur Attributsproben mit einem davon verändert, einschließlich vergleichender Proben und Fertigkeitsproben dieses Attributs (Rage eines Barbaren). Die Werteblockaktionen einer Kreatur nennen kein Attribut; ein auf ein Attribut eingegrenzter Angriffsmodifikator erreicht sie also nie.

Ein Zustand in `combat.conditions` kann seinem Betroffenen schaden (Capability API 1.189): `"harms": { "at": "turn-start", "dice": "1d4", "type": "necrotic" }` fügt das zu Beginn jedes seiner Züge zu (oder mit `"turn-end"` am Ende), ausgehend von dem, der ihn auferlegt hat, vor jedem Rettungswurf, der ihn beendet. `"stacks": 10` lässt ihn erneut auferlegen, solange er besteht, bis zu so oft, und sein Schaden wird für jede Auflage einmal zugefügt (ein Schwert der Verwundung); ihn zu beenden beendet alle. `"onePerSource": true` hält ihn pro Quelle bei einem einzigen Betroffenen: Wird er jemand anderem auferlegt, verlässt er den, der ihn von derselben Quelle hatte (der Schwurfeind eines Schwurbogens). Ein `against`-Eintrag eines Gegenstandsangriffs kann statt oder neben `is` `"marked": "sworn"` nennen, was auf ein Ziel passt, das diesen Zustand vom Träger trägt, und neben `toHit` `"mode": "advantage"`, `"ignoresCover": true` (Deckung unterhalb vollständiger Deckung zählt nicht) und `"ignoresLongRange": true` angeben; auch ein `plus`-Bestandteil kann `"marked": "sworn"` angeben (die 3d6 Stichschaden des Schwurbogens). Die Werteblockaktion einer Kreatur kann `"ability": "str"` nennen, das Attribut, mit dem ihr Angriff ausgeführt wird, damit auf ein Attribut eingegrenzte Änderungen an Angriffen oder Schaden sie erreichen.

Ein `modes`-Eintrag eines Gegenstandsangriffs kann eine völlig andere Art sein, die Waffe zu nutzen (Capability API 1.190): `"range": { "normal": 120 }` gibt an, wie weit sie in diesem Modus reicht, in der eigenen Entfernungseinheit des Regelsatzes; `"plus"` fügt einem Treffer Bestandteile hinzu, wie die eigenen des Angriffs; `"line": { "dice": "4d6", "type": "lightning", "save": { "save": "dex_save", "difficulty": 13, "onSuccess": "half" } }` ist ein Blitzstrahl, gegen den jeder, der zwischen Träger und Ziel steht (keiner der beiden selbst), einen Rettungswurf ablegt, bevor der Angriff gewürfelt wird; und `"charges": 1` verbraucht so viele der eigenen Ladungen des Gegenstands, sodass der Modus nur angeboten wird, solange er sie hat (ein Blitzwurfspeer: `charges.max` 1 und `stack` 1 am Gegenstand). Eine Linie braucht ein Brett, über das sie verlaufen kann.

Ein Kampfzustand mit der Wirkung `"cannot-heal"` hält jede Heilung von seinem Betroffenen fern, solange er besteht, und das Protokoll sagt das (Capability API 1.191): Chill Touch in 5e. `"conditionImmunitiesFrom": [{ "conditions": ["charmed", "frightened"], "from": { "types": ["fiend", "undead"] } }]` an einem Kampfzustand hält diese Zustände nur fern, wenn eine Kreatur, die `from` entspricht, sie auferlegt; ein bereits bestehender bleibt (Protection from Evil and Good). `targetTypes.abilityAtLeast` eines Zaubers ist die Untergrenze zur Obergrenze `abilityAtMost`: `{ "int": 5 }` übergeht eine Kreatur mit Intelligence 4 oder weniger (Hideous Laughter), und eine ohne diesen Wert geschriebene Kreatur wird nicht ausgeschlossen. Das `against.actions` eines Rettungswurfmodifikators nennt Aktionen per ID, Name oder gemeinsamer Wiederaufladegruppe, ohne Beachtung der Groß- und Kleinschreibung, und grenzt alles andere ein, was `against` sagt: `{ "from": { "types": ["dragon"] }, "actions": ["frightful_presence", "breath_weapons"] }` ist der Odem oder Frightful Presence eines Drachen und nie sein Wing Attack, und der wiederholte Rettungswurf zum Beenden eines Zustands, den eine davon auferlegt hat, zählt ebenfalls.

Ein Gegenstandsangriff kann weitere Zusatzeffekte tragen (Capability API 1.192). `"ignoresResistance": true` lässt seinen Schaden durch die Resistenz des Ziels gegen die eigene Schadensart des Angriffs hindurch, einschließlich Resistenz gegen alles, während ein `plus`-Bestandteil einer anderen Art weiterhin halbiert wird (der Hiebschaden eines Vorpalschwerts); Immunität gilt weiterhin. Das `"saved"` eines `slay`-Eintrags listet Zustände in derselben Form wie `applies` auf, die ein Ziel, das den Rettungswurf gegen das Töten schafft, stattdessen erhält: `[{ "condition": "frightened", "duration": { "rounds": 1, "of": "source" } }]` ist der Unhold eines Streitkolbens der Zerstörung, der bis zum Ende des nächsten Zuges des Trägers vor diesem verängstigt ist. `"othersWhileMarked": { "condition": "sworn", "mode": "disadvantage" }` lässt jeden anderen Waffenangriff des Trägers mit diesem Modus würfeln, solange eine Kreatur, der er `sworn` auferlegt hat, noch steht, oder mit `"ranged": true` nur die Fernangriffe (ein Schwurbogen). Und in einem Kampf ohne Brett kann eine Flächenaktion (einer Kreatur oder eines Zaubers) auf Personen beider Seiten gerichtet werden, nie auf ihren Urheber, weil sie jede Kreatur darin erfasst; `friendlyFire: false` beschränkt sie wie auf einem Brett auf die andere Seite.

Eine vergleichende Probe kann statt eines Kräftemessens eine Probe gegen eine feste Zahl sein (Capability API 1.193). Lass `defender` weg und gib `"difficulty": 15` an; der Handelnde würfelt den besten seiner `attacker`-Werte und gewinnt, wenn er die Zahl erreicht. `"targets"` gibt an, bei wem sie angewendet werden darf: `"enemy"` (Standard), `"ally"` oder `"any"`, einschließlich des Handelnden. `"targetHolds": "wounded"` bietet sie nur bei einem Ziel an, das diesen Zustand hat, und `"targetDying": true` nur bei einem, das im Sterben liegt und noch nicht stabil ist. `onWin.stabilizes` stabilisiert ein sterbendes Ziel. Eine Probe auf Wisdom (Medicine) mit Schwierigkeit 15, die die Wunden eines Schwerts der Verwundung beendet, ist also `{ "difficulty": 15, "targets": "any", "targetHolds": "wounded", "onWin": { "ends": [{ "condition": "wounded", "on": "target" }] } }`, und die mit Schwierigkeit 10, die Sterbende rettet, ist `{ "difficulty": 10, "targets": "ally", "targetDying": true, "onWin": { "stabilizes": true } }`. Ein Pool-Kampf zählt Erfolge und lehnt `difficulty` daher ab. Das `"healedOnlyByRest": true` eines Gegenstandsangriffs versiegelt die Trefferpunkte, die er nimmt: Keine Heilung bringt den Betroffenen über sein Maximum abzüglich des Versiegelten, und jede Rast stellt sie wieder her und hebt die Versiegelung auf. Das `harms` eines Kampfzustands nimmt dasselbe `"healedOnlyByRest": true` an; auch die Wunden, die das Schwert hinterlässt, versiegeln also, was sie nehmen.

Eine Größe kann mehr als eine Zelle füllen (Capability API 1.194). Gib einem Eintrag von `combat.sizes.order` eine Anzahl `"cells"`, `{ "id": "large", "label": "Large", "cells": 2 }`, und eine Kreatur dieser Größe füllt auf einem Brett so viele Zellen pro Seite, wobei ihre eigene Zelle die obere linke ist: Large ist in 5e 2, Huge 3 und Gargantuan 4. Sie wird dort abgesetzt, wo sie ganz hineinpasst, an der nächsten solchen Stelle zu der, an der sie stehen sollte. Reichweiten gehen von der nächsten Zelle aus, die sie füllt, und zu ihr hin; ein Schwert erreicht einen Oger also von neben jeder seiner vier Zellen. Sie geht nur dorthin, wo sie ganz hineinpasst, und niemand geht durch einen Teil von ihr hindurch; eine Fläche erfasst sie, wenn eine ihrer Zellen darin liegt; ein Stoß bewegt sie ganz; und sie wird von der freiesten ihrer Zellen aus gesehen und ist so gedeckt wie diese. Eine Größe ohne `cells` füllt eine Zelle, genau wie bisher.

Ein Zustand kann seinen Betroffenen größer oder kleiner machen (Capability API 1.195). Gib einem Eintrag von `combat.conditions` ein `"size": { "steps": 1 }`, und solange er besteht, ist sein Betroffener so viele Größen weiter entlang von `combat.sizes.order`, bei einer negativen Zahl entsprechend zurück, nie über die erste oder letzte hinaus: Enlarge ist in 5e `1` und Reduce `-1`. Seine Reichweite, ob Flächen ihn erfassen, und alles, was nach seiner Größe fragt, lesen die neue; endet der Zustand, hat er wieder seine eigene Größe. Wer auf einem Brett wächst, füllt seine neue Größe über jeder Zelle, auf der er stand, sofern sie dort auf freiem Boden ohne andere hineinpasst, sonst die größte kleinere Größe, die hineinpasst; ein in einem Korridor vergrößerter Oger wächst also nur so weit, wie der Korridor es zulässt. Wer schrumpft, behält seine obere linke Zelle. Das Protokoll nennt, wer sich verändert hat und wozu. Das braucht `combat.sizes`; kombiniere es mit einem `damage`-Modifikator für die Waffenwürfel und einem Modus für `checks` und `saves` auf Strength für den Rest des Zaubers.

Ein Eintrag kann seine Ziele danach auswählen, wie viel Gesundheit sie noch haben (Capability API 1.196). `"healthPool": { "dice": "5d8" }` in seinen `mechanics` wird beim Einsatz einmal gewürfelt und vom Ziel mit der wenigsten verbleibenden Gesundheit aufwärts verteilt: Jedes ist nur betroffen, solange seine Gesundheit nicht über dem Rest liegt, den es dann aufbraucht, und die übrigen bleiben völlig unberührt, so wie Sleep und Color Spray in 5e funktionieren; `perCostStep` erhöht den Wert, wenn höher gewirkt wird. `"healthAtMost": 150` betrifft nur ein Ziel mit so viel Gesundheit oder weniger, wie Power Word Stun; `"kills": true` tötet jeden Betroffenen sofort, Power Word Kill ist also `"healthAtMost": 100, "kills": true`. Beide lesen die verbleibende Gesundheit eines Ziels, nachdem `targetTypes` festgelegt hat, wen es überhaupt treffen darf. Das Protokoll nennt, was ein Pool gewürfelt hat und für wen er gereicht hat.

Ein Schadensmodifikator kann die eigenen Würfel eines Schlags öfter werfen (Capability API 1.197). `{ "to": "damage", "attacks": "weapon", "ability": "str", "diceTimes": 2 }` an einem Zustand lässt die 1d8 + 2 einer Kriegshacke 2d8 + 2 verursachen, solange er besteht, wie bei den Waffen eines vergrößerten Duergar. Der feste Anteil bleibt, wie er war, ein kritischer Treffer verdoppelt die zusätzlichen Würfel wie den Rest, und der Durchschnitt im Menü zählt sie mit. Das verändert den Schaden eines Schlags und sonst nichts. Eine Kreaturenaktion mit `"self": true`, die im eigenen Zug ausgeführt wird, wirkt jetzt auf die Kreatur selbst, wie bereits in einer Reaktion; ihre `applies` werden also auferlegt.

Eine Zone kann bei ihren Auslösern eine andere Schadensart verursachen als bei ihrem Erscheinen (Capability API 1.198). `"zone": { "rounds": 100, "triggers": ["enter"], "atCast": true, "damageType": "slashing" }` an einem Eintrag, dessen eigenes `damageType` `"piercing"` ist, verursacht bei jedem, um den die Wand entsteht, Stichschaden und bei jedem, der sich später hineinbewegt, Hiebschaden, wie Wall of Thorns in 5e. Das braucht die eigene `amount` des Eintrags sowie einen Auslöser, eine Seite oder ein Rammen, bei dem es wirkt, und nennt eine der `combat.damageTypes`, wo der Regelsatz welche deklariert.

Ein Gesundheitspool für die Zielauswahl kann einige seiner Ziele überspringen (Capability API 1.199). `"healthPoolSkips": { "conditions": ["unconscious"] }` neben einem `healthPool` lässt jeden in Ruhe, der einen dieser Zustände hat, und verbraucht nichts vom Pool für ihn, so wie Sleep in 5e Bewusstlose ignoriert; `"unseeing": true` tut dasselbe für jeden, der den Urheber des Eintrags nicht sehen kann (geblendet oder ohne Sichtlinie zu ihm), so wie Color Spray Kreaturen ignoriert, die nicht sehen können. Es nennt `conditions`, `unseeing` oder beides und braucht einen `healthPool`.

Eine Wand kann aus Abschnitten bestehen, die einzeln getroffen und zerstört werden (Capability API 1.200). `"zone": { "rounds": 100, "triggers": [], "blocks": ["move", "sight"], "sections": { "every": 10, "health": 30, "defense": 12, "vulnerable": ["fire"], "broken": { "triggers": ["enter"], "amount": { "dice": "5d6" }, "damageType": "cold", "save": "con_save", "onSave": "half" } } }` ist Wall of Ice in 5e: Jeder 10 Fuß lange Abschnitt hat AC 12 und 30 Trefferpunkte und erleidet doppelten Feuerschaden (`resist` und `immune` funktionieren genauso). Ein Angriff, der auf einen Gegner oder auf irgendjemanden gerichtet ist und Schaden verursacht, kann stattdessen auf einen Abschnitt gerichtet werden: Seine Option listet die Zellen, die er treffen kann, als `walls` auf, und die Auswahl nennt eine davon als `wall`. Der Angriff wird gewürfelt und sein Schaden zugefügt wie gegen eine Kreatur, und das Protokoll nennt, was der Abschnitt erlitten hat und was ihm bleibt. Ein auf 0 gebrachter Abschnitt ist zerstört: Er blockiert nicht mehr, und wer ihn betritt (oder dort einen Zug beginnt oder beendet, wie seine `triggers` es angeben), erleidet einmal pro Zug seine `amount` und würfelt mit seinem `save` gegen die eigene Schwierigkeit des Eintrags für die Hälfte (`onSave: "none"` für nichts). Abschnitte brauchen eine Wand mit `blocks`, und ein `save` des zerstörten Abschnitts braucht das eigene `save` des Eintrags.

Ein Eintrag kann die laufenden Leisten des Bogens verschieben und versiegelte Gesundheit zurückgeben (Capability API 1.201). `"tracks": [{ "track": "exhaustion", "by": -1 }]` nimmt jedem, den er trifft, eine Erschöpfungsstufe ab, wie Greater Restoration in 5e, und `"by": 1` an einem Eintrag mit Rettungswurf (Sickening Radiance) fügt jedem, der ihn nicht schafft, eine hinzu. Jede Leiste bleibt in ihren eigenen Grenzen, Stufen, die das Gesundheitsmaximum halbieren, greifen sofort, und das Erreichen einer Stufe mit `defeats` tötet. `"unseals": true` gibt die Gesundheit zurück, die sonst nur eine Rast zurückgäbe (was ein `seals`-Schlag abgezogen hat), so wie Greater Restoration eine Senkung des Trefferpunktemaximums beendet. Ein Eintrag, der nur auf diese Weise kuriert, wird nur bei jemandem angeboten, dem er helfen würde. Das `broken` eines Wandabschnitts kann ein eigenes `perCostStep` tragen, das für jede Stufe, um die das Wirken über seiner Basis bezahlt wurde, einmal addiert wird: die eisige Luft von Wall of Ice, `{ "dice": "1d6" }`. Leisten sind einfache Leisten, keine Wundleisten, und `unseals` braucht Gesundheit in Punkten.

Ein Zustand, den ein Eintrag auferlegt, kann zusammen mit einem anderen enden, den er auferlegt (Capability API 1.202). In `"applies": [{ "condition": "charmed", "duration": { "rounds": 10 }, "saveEnds": { "save": "wis_save", "at": "damaged" } }, { "condition": "incapacitated", "duration": "instant", "endsWith": "charmed" }]`, Hypnotic Pattern in 5e, endet die Kampfunfähigkeit, sobald die Bezauberung endet: durch einen Rettungswurf, eine Kur, das Brechen der Konzentration des Wirkenden, einen Verbündeten, der den Betroffenen wachrüttelt, oder das Ende des Kampfes. Nur der von derselben Nutzung auferlegte Zustand endet mit, und das Protokoll nennt den Grund. `endsWith` nennt einen anderen Zustand derselben `applies`-Liste (oder derselben `onEnd`-, `charge`- oder `saved`-Liste), nie sich selbst.

Die Aktion einer Kreatur kann das Gesundheitsmaximum ihres Ziels senken (Capability API 1.203). `"reducesMax": { "save": "con_save", "difficulty": 14 }` am Life Drain eines Todesalbs lässt das Ziel diesen Rettungswurf würfeln, wenn der Schlag trifft. Bei einem Fehlschlag wird der erlittene Schaden sowohl von seiner Gesundheit als auch von seinem Maximum abgezogen, und keine Heilung gibt ihn vor einer Rast zurück. Mit `"lasting": true` (Slam eines Lehmgolems) gibt ihn nicht einmal eine Rast zurück, sondern nur ein Eintrag mit `unseals` (Greater Restoration). Ein Ziel, dessen Maximum auf diese Weise auf 0 sinkt, stirbt. Ein Bogen führt, was keine Rast zurückgibt, als `lasting` seines Pools innerhalb von `sealed`. Das braucht Gesundheit in Punkten.

Eine Kur kann eine ihrer Wirkungen statt aller ausführen (Capability API 1.204). Mit `"cureOneOf": true` tut ein Eintrag, der Zustände mit `ends` beendet, `tracks` verschiebt und `unseals` hat (Greater Restoration in 5e: bezaubert, versteinert, eine Erschöpfungsstufe oder das Trefferpunktemaximum), genau eines davon: Jedes wird als Modus der Option angeboten (ein Zustand, eine Leiste oder der Gesundheitspool, nach seiner Beschriftung), wie die Modi einer Waffe, und eine Nutzung ohne gewählten Modus tut das erste davon, in dieser Reihenfolge, wofür das Ziel etwas hat. Das braucht mindestens zwei Kuren zur Auswahl.

Ein gesenktes Maximum kann ohne eigenen Rettungswurf auskommen (Capability API 1.235). Ein `reducesMax` ohne `save` und `difficulty` senkt das Maximum um den Schaden jedes treffenden Schlags (Bite eines Vampirs in 5e); mit `"onFailedSave": true` nur, wenn das Ziel den eigenen Rettungswurf des Eintrags nicht geschafft hat (Harm in 5e, ein Katalogeintrag mit Rettungswurf; dort hat `reducesMax` nie einen eigenen Rettungswurf). `damageType` zählt nur Schaden dieser Art (den nekrotischen des Bite), und `"heals": true` gibt seinem Urheber so viele Trefferpunkte zurück, wie es gesenkt hat. Auch Katalogmechaniken nehmen `reducesMax` an, und `leavesAtLeast` verhindert, dass der Schaden des Eintrags das Ziel unter so viele Trefferpunkte bringt (Harm lässt 1 übrig). `targetHolds` an einer Kreaturenaktion oder einer Katalogmechanik begrenzt, auf wen sie gerichtet werden darf: auf jemanden, der einen ihrer `conditions` hat, oder einen ihrer `fromSelf`, den der Urheber der Aktion ihm auferlegt hat (der Bite: vom Vampir gepackt oder kampfunfähig oder festgesetzt).

Ein Zustand kann seinem Betroffenen eigene Nutzungen geben (Capability API 1.236). Die `actions` eines Kampfzustands listen Katalogeinträge auf (`spells/break-enchantment`), die sein Betroffener nutzen darf, solange er ihn hat: Sie stehen nur dann im Menü, kosten nichts vom Bogen außer dem Budget, das jeder verbraucht, und werden mit den eigenen Zahlen des Betroffenen gewürfelt, wie seine Zauber (eine Kreatur, die zaubert, verwendet die ihres Zauberwirkens). Ein Eintrag mit `"endsCondition": "<condition>"` beendet diesen Zustand bei seinem Nutzer, sobald er genutzt wurde, und ebenso die Konzentration, die ihn hält, wenn es die eigene des Nutzers ist: Dispel Evil and Good in 5e, dessen Break Enchantment und Dismissal jeweils den Zauber beenden. `ends.from` (eine Prüfung auf Art und Tag) kuriert nur, was eine Kreatur auferlegt hat, die diese Prüfung besteht: Break Enchantment beendet eine Bezauberung oder Angst durch einen Himmlischen, ein Elementar, ein Feenwesen, einen Unhold oder einen Untoten und lässt eine durch jemand anderen bestehen. `dismisses` schickt jeden, den es trifft und der keinen Rettungswurf schafft, lebend aus dem Kampf, vom Brett und aus der Zugreihenfolge: `true` dauerhaft (Dismissal) oder `{ "while": "<condition>" }` so lange, wie er diesen Zustand hat, den derselbe Eintrag auferlegen muss (Banishment in 5e). Dessen Uhr läuft dann in den Zügen des Wirkenden, und wenn er endet, durch Zeitablauf, einen Rettungswurf oder die Konzentration des Wirkenden, kehrt der Betroffene dorthin zurück, wo er war, oder auf den nächsten freien Platz, auf den er passt. Mit `gone` (eine Prüfung auf Art und Tag) bleibt einer, der sie besteht und den Zustand seine volle Zeit erlebt hat, fort.

Ein Kampf kann damit beginnen, dass einige Beteiligte überrascht werden (Capability API 1.237). Die Szene sagt, wer: Die Begegnung, aus der er entsteht, markiert sie mit `"surprised": true`, ob Gruppe oder Gegner. In ihrem ersten Zug können sie sich weder bewegen noch handeln, und ihr Menü enthält nur das Beenden des Zuges; sie nehmen keine Reaktion und keine legendäre Nutzung, bis dieser Zug oder die erste Runde vorbei ist, je nachdem, was zuerst eintritt. Ein Kampfzustand mit `"cannotBeSurprised": true` verhindert, dass sein Betroffener je überrascht wird: Foresight in 5e. Ein Katalogeintrag mit `"ignoresSurpriseWith": "<catalog>/<entry>"` nennt eine Nutzung, die sein Besitzer auch überrascht noch nehmen darf. Sie beendet die Überraschung sofort, sodass der Rest des Zuges ihm gehört: Feral Instinct in 5e, das einen überraschten Barbaren normal handeln lässt, wenn er zuerst in Kampfrausch verfällt.

Ein Katalogeintrag kann seinem Besitzer in der ersten Runde eines Kampfes einen zweiten Zug geben (Capability API 1.238). `"extraFirstTurn": { "initiative": -10 }` an einem Eintrag, der auf einer Liste des Bogens steht, setzt diesen zweiten Zug auf die eigene Initiative des Besitzers plus die Zahl, nach allen, die bei dieser Zahl oder darüber stehen. Jeder der beiden ist ein vollständiger Zug, und ab der zweiten Runde nimmt er wie üblich einen Zug pro Runde. Ein Besitzer, der vor dem zweiten Zug ausgeschaltet wird, verpasst ihn einfach. Mit `"unlessSurprised": true` gibt es keinen zweiten Zug für jemanden, der den Kampf überrascht beginnt: Thief's Reflexes in 5e.

Ein Kampfzustand kann eingrenzen, was sein gewährtes Budget kauft, nämlich auf einen Schlag in Reichweite, und beim Enden eine Spur auf den Leisten seines Betroffenen hinterlassen (Capability API 1.239). Mit `"grants": { "budget": "bonus", "attacks": true, "melee": true }` wird der eine Angriff, den dieses Budget bezahlt, nur mit einer Waffe ausgeführt, die in Reichweite zuschlägt, und eine Wurfwaffe nur gegen jemanden in ihrer Reichweite, da sie geschwungen und nicht geworfen wird; eine Waffe mit Fernkampfreichweite und ohne Nahkampfreichweite wird nicht angeboten. `"onEnd": { "tracks": [{ "track": "exhaustion", "by": 1 }] }` verschiebt beim Enden des Zustands die laufenden Leisten seines Betroffenen um Stufen, wie auch immer er endet, so wie `tracks` an einem Katalogeintrag; `applies` und `tracks` dürfen zusammen oder allein stehen. Das `"usesOf": "<row name>"` eines Katalogeintrags verbraucht die Nutzungen des Eintrags dieser Zeile (seiner Zählerzeile) statt der eigenen. Frenzy in 5e ist dann ein Eintrag eines Berserkers, Frenzied Rage, mit `"usesOf": "Rage"`, der den Kampfrausch und einen Zustand `frenzied` auferlegt, der mit ihm endet (`endsWith`) und beide Angaben trägt.

Die Initiative kann zweimal geworfen werden, wobei der bessere oder der schlechtere Wurf zählt (Capability API 1.240). `combat.initiative.checkAbility` sagt, dass die Initiative eine Probe mit diesem Attribut ist; alles, was eine solche Probe zweimal würfeln lässt, lässt also auch die Initiative zweimal würfeln: ein Zustand mit `own-checks-advantage` (Foresight in 5e) oder ein `checks`-Modifikator mit `mode`, eingegrenzt auf dieses Attribut oder auf keines (Cat's Grace von Enhance Ability auf Dexterity). Ein Katalogeintrag auf einer Liste des Bogens mit `"initiativeMode": "advantage"` (oder `"disadvantage"`) wirft die Initiative seines Besitzers zweimal, egal was dieser sonst hat: Feral Instinct in 5e. Vorteil und Nachteil heben sich wie bei jedem Wurf auf; der Initiativeeintrag im Protokoll trägt `mode` und den verworfenen Wurf (`dropped`). Ein Kampf, der die Initiative jede Runde wirft, wirft sie jede Runde zweimal. Das gilt nur für geworfene Würfel: Die Initiative eines Pools wird nicht zweimal geworfen.

Eine Reaktion kann darauf antworten, dass der EIGENE Angriff ihres Besitzers trifft (Capability API 1.241): Eine `"hit"`-Reaktion mit `"by": "self"` wird dem Angreifer angeboten, sobald sein Wurf getroffen hat und alle, die der Schlag getroffen hat, geantwortet haben, und richtet sich auf den Getroffenen (schreib `"at": "target"`). `"weapon": true` grenzt jeden Treffermoment auf den Schlag einer Waffe ein: einen Angriff oder die Einzelzielaktion einer Kreatur, die aus keinem Katalog stammt. Eine Reaktion auf den eigenen Treffer wird nicht durch das aufgehalten, was Reaktionen aufhält, weil ihre Wahl Teil des Angriffs ist; markiere sie als `"free"`, sofern sie nicht wirklich ein Budget verbraucht. Stunning Strike in 5e ist so eine: `"reaction": { "on": "hit", "by": "self", "weapon": true, "blow": "melee", "at": "target" }`, kostenlos, mit Ki-Kosten, einem Constitution-Rettungswurf und `stunned` bis zum Ende des nächsten Zuges des Mönchs. Mit `"addsToBlow": true` kommt die Menge eines Angriffseintrags zu diesem Schlag hinzu, statt für sich zugefügt zu werden: gewürfelt, wenn der Schlag trifft, verdoppelt durch dessen kritischen Treffer, ihre Bestandteile nur bei einem Ziel, das sie erreichen. Divine Smite in 5e ist 2d8 gleißend, `perCostStep` 1d8, ein Bestandteil von 1d8 gleißend mit `targetIs` Unhold oder Untoter und `"perCostStepsMax": 3`: die höchste Zahl an Stufen höherer Kosten, die zählt, für jeden Eintrag mit `perCostStep` oder `targetsPerCostStep`. Ein Angriff innerhalb eines anderen Fensters (ein Angriff auf jemanden, der sich entfernt) wird nie für seinen Treffer angehalten; ihm wird also nichts hinzugefügt.

Was ein Bogen enthält, kann seine Angriffszeilen verändern, Angriffe gewähren und auf die Angriffsaktion warten (Capability API 1.242). Ein Katalogeintrag auf einer Liste des Bogens mit `attackRows` verändert die Zeilen, deren Namen er auflistet (ohne Beachtung der Groß- und Kleinschreibung abgeglichen), solange seine `when`-Grenzen gelten (ein Wert vom Bogen, etwa getragene Rüstung höchstens 0): `abilities` verwendet zum Treffen das beste aus dem eigenen Attribut der Zeile und diesen und, wo der Schaden der Zeile dasselbe Attribut addiert, auch für den Schaden; `die` (`from` einem Wert vom Bogen über eine Stufentabelle `table` zu einer Seitenzahl) wirft einen Würfel dieser Größe anstelle der Würfel der Zeile, wo das den besseren Durchschnitt ergibt; `qualities` ergänzen, was die Schläge an einer Resistenz vorbeibringen. Martial Arts ist in 5e `{ "names": ["Unarmed Strike", "Shortsword", ...], "abilities": ["str", "dex"], "die": { "from": { "field": "level_monk" }, "table": [[1, 4], [5, 6], [11, 8], [17, 10]] }, "when": { "value": { "derived": "armor_worn" }, "atMost": 0 } }`, und Ki-Empowered Strikes ist `{ "names": ["Unarmed Strike"], "qualities": ["magical"] }`. Das `grantsStrike` eines gehaltenen Eintrags lässt seinen Besitzer einen Angriff mit einem anderen Budget kaufen, sobald das eigene Budget eines Angriffs verbraucht ist, genau wie das `grants.attacks` eines Zustands: `names` grenzt es auf diese Angriffe ein, `melee` auf Reichweite und `afterAttack` auf einen Zug, in dem die Angriffsaktion ausgeführt wurde (`true` oder `{ "names": [...] }` für eine Angriffsaktion mit einem davon). Der zusätzliche waffenlose Schlag von Martial Arts ist `{ "budget": "bonus", "names": ["Unarmed Strike"], "afterAttack": { "names": [...the monk weapons] } }`. Das `grants` eines Zustands nimmt dieselben `names` und `afterAttack` an. Ein Eintrag mit `afterAttack` wird nur nach der Angriffsaktion angeboten: Flurry of Blows ist ein `utility`-Eintrag auf dem Bonusbudget, der ein Ki verbraucht, mit `afterAttack`, mit `gives` 2 eines Budgets, das mit Anzahl 0 deklariert ist, und mit einem `grantsStrike` von Unarmed Strike auf diesem Budget. Die Angriffsaktion ist jeder Angriff aus einer Angriffsliste oder mit einem Gegenstand, der sein eigenes Budget oder einen bereits gekauften Angriff bezahlt, nie einer, den eine Gewährung bezahlt hat.

Ein Gelegenheitsangriff wird bei einem Treffer genauso angehalten wie ein Angriff in einem Zug (Capability API 1.243): Jeder, der eine Antwort auf diesen Treffer hat, wird gefragt, sein Urheber zuletzt für das, was er hinzufügt (Divine Smite, Stunning Strike), und das eigene Fenster des Gangs, in dem der Angreifer bereits geantwortet hat, wird weiter befragt, sobald der Schlag gelandet ist. Wer unterwegs festgehalten wird (ein Zustand mit `speed-zero`, etwa betäubt oder gepackt), geht nicht weiter als bis zu der Zelle, in der er getroffen wurde. Ein Eintrag, der eine Reaktion ist oder einem anderen Schlag hinzugefügt wird, wird nie selbst als Gelegenheitsangriff gewählt.

Angriffsregeln erreichen gehaltene Waffen, und eine Angriffsliste kann jedem Bogen eine Zeile geben (Capability API 1.244). `combat.attacks[].always` listet bis zu 4 Zeilen in den Spalten dieser Liste auf, die der Kampf jedes Bogens zusätzlich zu dessen eigenen hat; eine Bogenzeile gleichen Namens wird an ihrer Stelle verwendet. Der waffenlose Schlag in 5e ist `{ "name": "Unarmed Strike", "ability": "str", "proficient": true, "bonus": 0, "damage": "1", "damage_type": "bludgeoning", "reach": 5 }`. Die `names` einer `attackRows`-Regel passen jetzt auch auf eine gehaltene Waffe über den Namen, unter dem ihr Angriff läuft, und ihre `items` passen auf gehaltene Waffen über Tags: alle aus `tags` und keines aus `notTags` (`{ "tags": ["simple", "melee"], "notTags": ["two_handed", "heavy"] }`, sodass ein Dolch +1 zählt); eine Regel nennt `names`, `items` oder beides. `wielding: { "only": {...} }` mit denselben `names`, `tags` und `notTags` behält eine Regel nur, solange jede gehaltene Waffe eine davon ist oder keine gehalten wird: „waffenlos oder nur mit Mönchswaffen“. Ein `grantsStrike` nimmt dasselbe `wielding` an und ein `when` wie das einer `attackRows`-Regel; der Bonusangriff von Martial Arts wird in Rüstung also nicht angeboten.

Mehrere Nutzungen auf einmal, ein Rettungswurf, der auf 0 fallen lässt, Treffer durch benannte Angriffe und Schaden beim Enden eines Zustands (Capability API 1.245). Das `usesSpent` eines Eintrags verbraucht in einer Nutzung so viele der Nutzungen seiner Zeile (oder der von `usesOf`) und wird nur angeboten, solange so viele übrig sind: die 3 Ki von Quivering Palm. Die `names` einer `"hit"`-Reaktion antworten nur auf einen Treffer durch diese Angriffe, ohne Beachtung der Groß- und Kleinschreibung nach Namen abgeglichen: Quivering Palm ist `{ "on": "hit", "by": "self", "names": ["Unarmed Strike"], "at": "target" }` und legt einen lang anhaltenden Zustand `quivering` auf. `dropsOnFailedSave` an einem Eintrag mit Rettungswurf lässt ein Ziel, das ihn nicht schafft, auf 0 Gesundheit fallen, statt seine Menge zuzufügen (eine Kreatur scheidet aus, ein Charakter liegt im Sterben, wo der Regelsatz eine Sterberegel hat); ein Ziel, das ihn schafft, erleidet die Menge so, wie `onSuccess` des Rettungswurfs es angibt. Das Beenden der Vibrationen ist eine Aktion mit `targetHolds: { "fromSelf": ["quivering"] }`, 10d10 nekrotisch, einem Constitution-Rettungswurf mit `onSuccess: "none"` und `dropsOnFailedSave`. Das `onEnd.harm` eines Zustands (`dice`, `flat`, `type`, `unless`) fügt seinem Betroffenen beim Enden Schaden zu, ausgehend von dem, der ihn auferlegt hat, sofern der Betroffene nicht ist, was `unless` nennt: Hurl Through Hell ist eine Treffer-Reaktion mit `dismisses: { "while": "hurled" }` und einem `hurled`, das `{ "rounds": 1, "of": "source" }` dauert, und das `onEnd` des Zustands `hurled` ist `{ "harm": { "dice": "10d10", "type": "psychic", "unless": { "types": ["fiend"] } } }`.

`afterAttack` passt auch über Tags auf die Waffe, mit der die Angriffsaktion ausgeführt wurde (Capability API 1.246): `{ "names": [...], "items": { "tags": ["simple", "melee"], "notTags": ["two_handed", "heavy"] } }` gilt nach einem Angriff mit einem dieser Namen oder mit einer gehaltenen Waffe, die alle aus `tags` und keines aus `notTags` hat, egal wie sie heißt; ein Dolch +1 zählt also. Es nennt `names`, `items` oder beides, an einem Eintrag ebenso wie an einem `grantsStrike` oder einer Gewährung eines Zustands.

Rücksichtslose und brutale Schläge (Capability API 1.247). Ein Eintrag mit `beforeAttack` wird nur im eigenen Zug seines Besitzers angeboten, bevor dieser darin angegriffen hat: Reckless Attack ist ein kostenloser `buff` auf den Barbaren mit `beforeAttack`, der `reckless` für `{ "rounds": 1 }` und `exposed` für `{ "rounds": 1, "at": "turn-start" }` auferlegt. Eine Änderung an Angriffen nimmt wie eine Änderung am Schaden `attacks` (`weapon`, `spell` oder `any`) und `blow` (`melee` oder `ranged`) an, dazu `ability`: `reckless` ist `{ "to": "attacks", "mode": "advantage", "ability": "str", "attacks": "weapon", "blow": "melee" }`, und `exposed` hat die Wirkung `attacks-against-advantage`. Das `criticalDice` einer Schadensänderung fügt nur bei einem kritischen Treffer so viele der eigenen Schadenswürfel des Schlags hinzu, nicht verdoppelt: Brutal Critical ist eine Stufe auf einem abgeleiteten Wert des Barbaren mit `{ "to": "damage", "criticalDice": 1, "attacks": "weapon", "blow": "melee" }`, eine Stufe pro Würfel.

Antworten auf die Treffer eines Schlaghagels (Capability API 1.248). Das `budget` eines `hit`-Moments grenzt ihn auf Treffer durch einen Angriff ein, der aus diesem Budget bezahlt wurde: Open Hand Technique antwortet auf `{ "on": "hit", "by": "self", "budget": "flurry" }`, das Budget, das Flurry of Blows mit `gives` gibt und dessen `grantsStrike` verbraucht. Das `oneOf` einer Reaktion benennt eine Gruppe von Antworten auf den eigenen Treffer ihres Besitzers, von denen pro Treffer nur eine genommen wird: Open Hand Technique sind drei kostenlose Einträge mit gemeinsamem `"oneOf": "open-hand"`, einer mit einem Dexterity-`save`, der `prone` auferlegt, einer mit einem Strength-`save` und `push` von 15 und einer, der einen Zustand mit der Wirkung `cannot-react` für `{ "rounds": 1, "at": "turn-start" }` auferlegt. Wer einen nimmt, verbraucht die anderen beiden für diesen Treffer; der nächste Treffer bietet wieder alle drei an. `oneOf` steht an einem `hit`-Moment mit `by` `self` und ohne `also`.

Rettungen nach dem Wurf (Capability API 1.249). Eine Änderung an `attacks`, `saves` oder `checks` mit `"rescue": true` wird vom Wurf zurückgehalten: Nur wenn der eigene Wurf ihres Besitzers zu kurz ausfällt und ihr Höchstwert (der feste Anteil und jeder Würfel auf seiner höchsten Seite) den Unterschied ausgleichen könnte, wird sie gewürfelt und addiert, und der Zustand, aus dem sie stammt, ist verbraucht. Ein Wurf, den sie nicht drehen könnte, behält sie. Bardic Inspiration ist ein Zustand, der einem Verbündeten mit `{ "to": "saves", "dice": "1d6", "rescue": true }` und demselben für `attacks` und `checks` auferlegt wird (ein Zustand pro Würfelgröße, gewählt nach der Stufe des Barden wie andere Stufenbereiche); Guidance ist `checks` mit `1d4`, Resistance `saves` mit `1d4`. Ein natürlicher Fehlschlag wird nie gerettet, und ein Kampf mit Würfelpools hält nichts zurück. Das `rescue` eines Eintrags nimmt ihn aus dem Menü: Er wird mit seinen Nutzungen und Kosten verbraucht, wenn der eigene Wurf dieser Art seines Besitzers misslungen ist. `{ "roll": "saves", "by": "reroll" }` würfelt den Rettungswurf erneut, und der neue Wurf gilt (Indomitable mit eigenen Nutzungen; Diamond Soul mit `usesOf` Ki); `{ "roll": "attacks", "by": "success" }` macht aus einem Fehlschlag einen Treffer und `{ "roll": "checks", "by": "success" }` aus einer misslungenen Probe einen Erfolg (Stroke of Luck). Zurückgehaltene Änderungen werden zuerst versucht.

Cutting Words und Evasion (Capability API 1.250). Das `lowersRoll` eines Eintrags wird genommen, wenn der Angriff eines anderen trifft, an einer `hit`-Reaktion ohne `by` (mit `for` und `within`, um für Verbündete zu antworten): Seine `dice` oder ein einzelner `die`, dessen Größe wie bei Martial Arts ein Wert bestimmt (`{ "from": { "field": "level" }, "table": [[1, 6], [5, 8], [10, 10], [15, 12]] }`), werden vom Wurf abgezogen, der dann erneut gegen die Verteidigung geprüft wird; ein natürlicher Treffer trifft weiterhin. Cutting Words ist ein kostenloser `debuff` mit `{ "on": "hit", "for": "ally", "within": 60 }` und `usesOf` dem Inspirationszähler des Barden. Das `evasion` eines Kampfzustands oder einer Stufe nennt Rettungswürfe: Gegen etwas, das bei Erfolg die Hälfte verursacht, erleidet ein geschaffter Rettungswurf nichts und ein misslungener die Hälfte. Evasion ist eine Stufe auf der Stufe des Schurken oder Mönchs mit `"evasion": ["dex_save"]`.

Lay on Hands (Capability API 1.251). Das `usesChosen` eines Eintrags lässt seinen Nutzer wählen, wie viele seiner Nutzungen eine Nutzung verbraucht, von einer bis zu dem, was übrig ist, und heilt entsprechend oft seine Menge. Die Option trägt `amount: { max }`, und die Auswahl sendet `amount`; ohne Angabe verbraucht sie so viel, wie das erste Ziel im Durchschnitt vollständig heilt. Das ist für einen `heal` ohne `usesSpent` gedacht. Lay on Hands ist ein `heal` mit `"amount": { "flat": 1 }`, `usesOf` einem Zähler von fünf pro Paladinstufe, `usesChosen` und `"targetTypes": { "not": { "types": ["undead", "construct"] } }`.

Font of Magic (Capability API 1.252). Das `restore` eines Eintrags gibt einem Pool dessen, den er trifft, etwas zurück, an einem `heal` oder einem `buff`: einem laufenden Pool per ID oder dem Pool einer Listenzeile über ihren Namen (`"Sorcery Points"`). Mit einer `cost` in einer Pool-Familie addiert `perCostStep` für jede Stufe über der günstigsten etwas dazu; ein Zauberplatz eines Zauberers wird so zu Sorcery Points in Höhe seiner Stufe: ein `buff` auf sich selbst, der `slots_1` kostet, mit `"restore": { "pool": "Sorcery Points", "amount": { "flat": 1 } }` und `"perCostStep": { "flat": 1 }`. `overMax` lässt es über das Maximum des Pools hinausgehen; was darüber liegt, wird getrennt geführt und verschwindet, wenn eine Rast den Pool auf sein Maximum zurücksetzt. Ein aus Punkten erzeugter Zauberplatz ist ein Eintrag pro Stufe, `usesOf` den Punkten mit `usesSpent` seinem Preis und `"restore": { "pool": "slots_2", "amount": { "flat": 1 }, "overMax": true }`. Ein Eintrag, der seinem eigenen Nutzer einen Pool wiederherstellt, den dieser nicht hat, steht nicht in dessen Menü.

Metamagie (Capability API 1.253). Das `alters` eines Eintrags verändert, wie ein Eintrag seiner `catalogs` genutzt wird: Es steht nie in einem eigenen Menü, sondern wird mit jedem Eintrag angeboten, zu dem es passt, beim Nutzen dieses Eintrags gewählt und mit seinen eigenen Nutzungen bezahlt (`usesOf` den Sorcery Points mit `usesSpent` oder `usesSpentByLevel` für die Stufe, auf der der Zauber bezahlt wird, mindestens eine). Es ist ein `utility` ohne Reaktion. Nur eines pro Nutzung, sofern es sich nicht mit `joins` einem anderen anschließt. Was es verändert, wobei jedes nur zu einem Zauber passt, an dem es etwas zu verändern gibt: `spares` (ein Wert vom Bogen: so viele seines Nutzers und dessen Verbündeter, die er erfasst, schaffen seinen Rettungswurf ohne Wurf: Careful), `range` (`{ "times": 2, "touch": 30 }`: Distant), `rerolls` (so viele seiner unterdurchschnittlichen Schadenswürfel werden erneut geworfen, die niedrigsten zuerst: Empowered, mit `joins`), `lasts` (was er für eine Minute oder länger auferlegt, hält so viel mal länger, nie über einen Tag hinaus: Extended), `heightens` (sein erstes Ziel würfelt seinen ersten Rettungswurf mit Nachteil: Heightened), `budget` (`{ "from": "action", "to": "bonus" }`: Quickened), `drops` (die Komponenten, die er dann nicht mehr braucht, und niemand kann darauf antworten, dass er gewirkt wird: Subtle) und `twins` (ein weiteres Ziel für einen Zauber mit einem Ziel, der nicht nur seinen Nutzer betrifft und durch einen höheren Platz nichts gewinnt: Twinned). Ein Zauber, der im Moment nur mit einem davon gewirkt werden kann (Quickened, wenn die Aktion verbraucht ist, Subtle unter Silence), wird mit `alterNeeded` angeboten, und die Auswahl muss es tragen. Die Auswahl sendet `alters`, die IDs aus dem `alters` der Option; das Protokoll sagt `altered`.

Metamagie bei der Auswahl (Capability API 1.254). `rerolls` wirft die niedrigsten aller Schadenswürfel eines Zaubers erneut, insgesamt nie mehr als so viele: seine eigenen, die jedes Bestandteils in `plus` und bei einem kritischen Treffer die zusätzlichen mit dem, was übrig ist. Ein Angriffszauber würfelt sie für jedes Ziel, das er trifft. Erfasst eine `spares`-Veränderung mehr von der Seite ihres Nutzers, als sie verschont, wählt ihr Nutzer, wen: Das `alters`-Angebot der Option trägt `spares` (wie viele), und die Auswahl sendet `spares`, die IDs derer auf der Seite ihres Nutzers, die verschont werden sollen (gar keine verschont niemanden). Ohne Angabe verschont sie die ersten, die sie erfasst. Die Wahl gilt auch durch ein Fenster hindurch, das auf das Wirken antwortet. `spares` ohne eine Veränderung, die jemanden verschont, mehr IDs, als sie verschont, eine ID doppelt oder eine der anderen Seite wird als `bad-alter` abgelehnt.

Das Ziel von Heightened und Acid Arrow (Capability API 1.255). Erfasst eine `heightens`-Veränderung mehr als eines, wählt ihr Nutzer, wer seinen ersten Rettungswurf mit Nachteil würfelt: Das `alters`-Angebot der Option trägt `heightens: true`, und die Auswahl sendet `heightens`, die ID eines Kampfbeteiligten (eines, auf das er gerichtet ist, wo er auf einige gerichtet ist, und nie sein Nutzer). Ohne Angabe ist es das erste, das er erfasst. Ein Eintrag mit `halfOnMiss: true` (er braucht `attackRoll` und ein `amount`) verursacht bei einem Fehlschlag weiterhin die Hälfte seines Schadens, auch den seiner Bestandteile, und nichts anderes, was er bei einem Treffer bewirkt. Das `harmsPerCostStep` eines `applies`-Eintrags (`{ "dice": "1d4" }`) addiert für jede Stufe höherer Kosten, mit denen der Zustand auferlegt wurde, so viel zu dem, was er mit `harms` zufügt: die spätere Säure von Acid Arrow, 1d4 mehr pro Zauberplatzstufe über dem 2. Grad.

Eigene Rettungen eines Besitzers, Einträge nie auf ihren Nutzer und Zustände einzeln (Capability API 1.256). Das `rescue` eines Eintrags kann auch `by: "twenty"` sein (nur mit `roll: "checks"`): Der d20 einer misslungenen Probe zählt als 20, und das wird nur verbraucht, wo es die Probe gelingen lässt, so wie Stroke of Luck es bei einer Attributsprobe tut. `by: "die"` fügt einen eigenen Würfel des Besitzers hinzu, wo nichts, was ihm gegeben wurde, den Unterschied ausgleichen könnte, dieser Würfel aber schon: `dice` (`"1d10"`, Dark One's Own Luck) oder ein einzelner `die`, dessen Größe ein Wert vom Bogen bestimmt, `{ "from": { "field": "level" }, "table": [[1, 6], [5, 8], [10, 10], [15, 12]] }` (Peerless Skill). Ein ihm gegebener Zustand wird zuerst versucht. `notSelf: true` an einem Eintrag, der auf eine Kreatur `ally` oder `any` gerichtet ist, hält ihn von seinem eigenen Nutzer fern: Bardic Inspiration. Das `oneAtATime` eines Kampfzustands nennt eine Gruppe (`"bardic"`): Solange eine Kreatur einen Zustand dieser Gruppe hat, wird ihr kein weiterer davon auferlegt, auch nicht derselbe; das Zustandsereignis sagt `already`.

Antworten auf mehr Arten von Würfen (Capability API 1.257). `lowersRoll` kann auch `"also": ["checks", "damage"]` auflisten: Neben einem Angriffswurf, der getroffen hat, werden seine Würfel von der Attributsprobe eines anderen (einer vergleichenden Probe wie einem Packen, der Probe eines Gegenstands, der Probe von Counterspell) oder von dessen Schadenswurf abgezogen, während dieser gewürfelt wird. Das wird von selbst verbraucht, mit Budget, Nutzungen und Kosten des Eintrags, und zwar vom ersten auf der anderen Seite, dessen Eintrag den Würfelnden erreicht, und nur dort, wo sein Höchstwert den Wurf drehen könnte: eine Probe, die gelingen würde und dann misslingen könnte, oder Schaden, der jemanden auf der Seite seines Besitzers zu Boden bringen würde und ihn dann stehen lassen könnte. Cutting Words ist `{ "dice": "1d6", "also": ["checks", "damage"] }` mit nach Stufe bemessenem Würfel, `needs: ["hearing"]` und `targetTypes: { "notImmuneTo": ["charmed"] }`. Eine Rettung kann `saves` nennen (nur eine Rettung von `saves`): Sie wird nur bei diesen Rettungswürfen verbraucht. Mit `budget` nimmt sie außerdem eines dieses Budgets und wird ohne es nicht verbraucht: Ein Ring des Ausweichens ist `{ "roll": "saves", "by": "success", "saves": ["dex_save"], "budget": "reaction" }` mit seinen Ladungen als Nutzungen. Auch die Nutzung eines Gegenstands kann `halfOnMiss` tragen, mit `attackRoll` und einem `amount`: eine Schriftrolle mit Acid Arrow.

Krankheiten (Capability API 1.258). Die `kinds` eines Kampfzustands (`["disease"]`) sagen, welche Art Zustand er ist. Eine Art ist nie die eigene ID eines Zustands. Das `ends` einer Kur kann statt Zuständen eine Art nennen: Jeder Zustand dieser Art zählt, und ihr `count` nimmt weiterhin nur so viele; die „eine Krankheit“ von Lesser Restoration ist also `{ "conditions": ["disease", "blinded", "deafened", "paralyzed", "poisoned"], "count": 1 }`. Auch eine Immunität (die `conditionImmunities` einer Kreatur oder eines Gegenstands oder die eines Zustands oder einer Stufe) kann eine Art nennen: Divine Health ist ein Zustand mit `"conditionImmunities": ["disease"]`. Ein `saveEnds` kann zählen: `successes` (2 bis 10) gibt an, wie viele Erfolge ihn beenden, und `failures` (`{ "count": 3, "becomes": "blinding_sickness" }`) legt an seiner Stelle `becomes` auf, ohne Uhr und ohne weitere Rettungswürfe, sobald so viele Rettungswürfe misslungen sind. Das Zustandsereignis sagt `worsened`. Das ist Contagion: ein `until-save`-Zustand, gegen den am Ende jedes Zuges ein Rettungswurf abgelegt wird, mit drei in jede Richtung. Ein Zustand ohne Uhr wird beim Ende des Kampfes nicht aufgehoben; eine ausgebrochene Krankheit überdauert ihn also, bis etwas sie kuriert.

Rettungen über getragene Gegenstände (Capability API 1.259). Das `use` eines Gegenstands kann wie die Mechanik eines Eintrags ein `rescue` tragen, einschließlich `saves` und `budget`. Es steht nie im Menü und wird nur verbraucht, solange der Gegenstand getragen wird (wo er Trageplätze hat) und die `charges` hat, die seine Nutzung verbraucht. Das Verbrauchen nimmt eine dieser Ladungen. Ein Ring des Ausweichens ist ein Gegenstand mit `"charges": { "max": 3 }` und `"use": { "kind": "buff", "targets": "self", "free": true, "charges": 1, "rescue": { "roll": "saves", "by": "success", "saves": ["dex_save"], "budget": "reaction" } }`. Seine Ladungen kehren zurück, wie das `recharge` des Gegenstands es angibt.

Krankheiten zwischen Kämpfen (Capability API 1.260). Ein Kampfzustand kann `onRest: { "rests": [restId], "lowersMax": { "dice": "3d6", "flat": 0 }, "lasting": true }` tragen: Jedes Mal, wenn sein Betroffener eine dieser Rasten macht, während er den Zustand hat, sinkt das Gesundheitsmaximum um so viel, gewürfelt dort, wo die Rast gemacht wird, nachdem die Rast zurückgegeben hat, was sie zurückgibt. Ohne `lasting` gibt die nächste Rast es zurück, mit dieser Angabe nur etwas, das die Versiegelung aufhebt. Ein `onRest.save: { "save": saveId, "difficulty": 15, "cures": true }` wird zuerst gewürfelt, wie die Proben des Regelsatzes und mit dem eigenen Modifikator des Bogens: Nur ein Fehlschlag senkt das Maximum, und mit `cures` beendet ein Erfolg den Zustand (die Krankheit des Otyughs). Nur Gesundheit in Punkten hat ein Maximum, das sinken kann. Mummy Rot in 5e ist ein Zustand ohne Uhr mit `"onRest": { "rests": ["long"], "lowersMax": { "dice": "3d6" }, "lasting": true }`. Ein Rettungswurf, der bis zu einem Ende oder zu dem, was daraus wird, gezählt wird (1.258), hört nicht mehr mit dem Kampf auf: Wenn ein Kampf endet, auch durch Flucht, werden die verbleibenden Zugrettungswürfe seines Betroffenen ausgewürfelt; Contagion ist bis dahin also entweder abgeschüttelt oder ausgebrochen. Ein Rettungswurf, der nur bei Schaden abgelegt wird, wartet auf Schaden.

Krankheitsstadien (Capability API 1.261). Ein Kampfzustand kann `onDamaged: { "applies": [...] }` tragen, das seinem Betroffenen jedes Mal auferlegt wird, wenn er Schaden erleidet, mit einer Uhr wie die von `onEnd` (die Betäubung von Slimy Doom bis zum Ende des nächsten Zuges des Betroffenen); `expires: { "becomes": conditionId }`, zu dem er ohne Uhr wird, wenn seine eigene Uhr abläuft, auch beim Ende eines Kampfes, aber nicht, wenn er auf andere Weise beendet wird (die Tentakelkrankheit eines Abolethen nach ihrer Minute); und `curedOnlyBy: { "catalogs": [catalogId], "minLevel": 6 }`, sodass ihn nur eine Kur aus diesen Katalogen beendet, die auf dieser Stufe oder höher bezahlt wurde. `onRest.restoredWhenCured: true` (mit `lasting`) gibt zurück, was die Rasten dieses Zustands vom Maximum abgezogen haben, wenn er endet, wie auch immer, einschließlich eines geschafften eigenen Rettungswurfs. Die Wirkung `cannot-heal-nonmagical` hält jede Heilung außer einer magischen fern: im Kampf eine Aktion, deren Qualitäten `"magical"` sagen, außerhalb eines Kampfes eine Wiederherstellung mit `"magical": true` (ein mit `magical` getaggter Trank ist eine) und nie eine Rast; eine abgelehnte Wiederherstellung sagt `cannot-heal`. Eine Werteblockaktion kann wie ein Katalogeintrag `ends` tragen, einschließlich Arten: Healing Touch eines Einhorns ist `"heal": { "dice": "2d8", "flat": 2 }, "ends": { "conditions": ["disease", "poisoned"] }, "targets": "ally"`. Eine Kur, bei der der Wirkende unter ihren Zuständen wählt, ein Fluch unter mehreren, ist `cureOneOf` (1.204).

Qualitäten an der Aktion einer Kreatur (Capability API 1.262). Eine Werteblockaktion kann wie ein Katalogeintrag `qualities` tragen, Gegenstands-Tags, die der Regelsatz deklariert: `["magical"]` macht ihre Heilung zu einer magischen, die `cannot-heal-nonmagical` durchlässt, und einen Rettungswurf dagegen zu einem Rettungswurf gegen Magie. Die Nutzung eines Gegenstands trägt im Kampf auf dieselbe Weise die eigenen Tags des Gegenstands; ein mit `magical` getaggter Trank heilt dort also magisch, so wie auf dem Bogen.

Auren (Capability API 1.263). Ein Kampfzustand kann `auras` tragen, bis zu vier: Jede überträgt ihre `conditions` auf jeden, der innerhalb von `distance` um den Betroffenen steht, auf der Seite (`side`) `allies`, `enemies` oder `all`, und mit `self: true` auch auf den Betroffenen selbst (nicht mit `enemies`). `when` liest einen der Bogenwerte des Betroffenen mit `atLeast` oder `atMost`; eine Aura kann sich also ab einer Stufe öffnen. Ein Betroffener, der am Boden liegt, besiegt ist oder die Wirkung `cannot-act` hat, überträgt nichts. Was eine Aura überträgt, wird mit jedem Schritt des Kampfes auferlegt, endet, wenn sich die beiden trennen (das Protokoll sagt `aura` und `parted`), wird nie auf einen Bogen geschrieben und verschwindet, wenn der Kampf endet; ein Zustand, den eine Aura überträgt, kann keine eigene Aura tragen. Ohne Brett erreicht die Aura jeden auf ihrer Seite. Soll der Betroffene jeden Kampf mit dem Zustand beginnen, gib der Mechanik eines Katalogeintrags oder einem Werteblock `keepsOn`: die Zustände, die er den ganzen Kampf über hat, ebenfalls nie auf einen Bogen geschrieben. Aura of Protection in 5e ist ein dauerhaft gehaltenes `aura-of-protection`, dessen Aura einen Zustand überträgt, der das Charisma des Paladins zu Rettungswürfen addiert; Holy Nimbus ist eine Aura auf Gegnern, deren Zustand zu Beginn ihres Zuges Schaden zufügt.

Erzwungenes Verhalten (Capability API 1.264). Ein Kampfzustand kann `behavior` tragen, das entscheidet, was sein Betroffener mit seinem Zug tut. `only` listet alles auf, was der Zug neben seinem Ende enthalten darf: `move` (gehen und aufstehen), `escape` (sich aus einem Griff losreißen) und Standardaktionen, die der Regelsatz deklariert; eine leere Liste lässt nur das Beenden des Zuges übrig (das Halt von Command). `onlyWhenStuck` nennt Standardaktionen, die nur erlaubt sind, solange man nirgendwohin gehen kann (das Ausweichen von Turn Undead). `moves: "away"` geht nur von dem weg, der den Zustand auferlegt hat, nie einen Schritt näher, und endet weiter entfernt; `moves: "toward"` geht nur näher heran (das Herankommen von Command, Sympathy). `table` wird zu Beginn jedes Zuges des Betroffenen gewürfelt, `{dice, rows: [{atMost, does}]}`, und die erste Zeile, deren Wert der Wurf nicht übersteigt, entscheidet den Zug: `wander` geht mit der ganzen Geschwindigkeit in eine Richtung, die ein d8 wählt, und beendet den Zug, `nothing` beendet ihn, `strike` erlaubt nur einen Nahkampfangriff auf eine Kreatur in Reichweite, die die Würfel wählen (Freund oder Feind; nichts, wenn niemand da ist), und `normal` lässt den Zug wie ein Wurf über jeder Zeile unverändert (Confusion, Mindfire). Das Protokoll zeigt den Wurf als `compelled`-Ereignis, und alles andere wird als `compelled` abgelehnt. Ein Rettungswurf, der einen Zustand beendet, kann auch `at: "action"` sein: Sein Betroffener verbraucht seine Aktion, um ihn zu würfeln (Irresistible Dance).

Mehr von Auren (Capability API 1.265). Die `conditions` einer Aura sind jetzt optional, solange sie Zustände überträgt, Schaden zufügt oder einen Rettungswurf verlangt. `needs` listet Sinne auf, die ein Empfänger haben muss, und weder der Betroffene noch der Empfänger darf in einer Zone stehen, deren `inside.conditions` diese Sinne wegnehmen: Countercharm mit `needs: ["hearing"]` endet an Silence. `harms` `{dice, flat, type}` wird vom Betroffenen zu Beginn jedes seiner eigenen Züge jedem zugefügt, den die Aura erreicht (Fire Aura eines Balors). `save` `{save, difficulty, applies, seen?, immuneOnSuccess?}` wird von jedem, den die Aura erreicht, zu Beginn seines eigenen Zuges abgelegt: Ein Fehlschlag legt `applies` vom Betroffenen mit dieser Schwierigkeit auf, `seen` verlangt ihn nur, solange die beiden einander sehen können (der Blick eines Basilisken), und `immuneOnSuccess` hält die Aura dieses Betroffenen nach einem Erfolg für den Rest des Kampfes von ihm fern (Fear Aura eines Grubenteufels). Das `against.casts` eines Rettungswurfmodifikators grenzt ihn auf Rettungswürfe gegen das ein, was aus diesen Katalogen gewirkt wird, einschließlich der Nutzung eines Gegenstands, die aus einem davon wirkt, und dann auf alles andere, was er nennt: Der Vorteil von Holy Nimbus gegen Zauber von Unholden oder Untoten ist `against: { casts: ["spells"], from: { types: ["fiend", "undead"] } }`.

Mehr erzwungenes Verhalten (Capability API 1.266). Ein `behavior` kann `drops` `{slots?, tags?, at, pickUp?}` tragen: Sein Betroffener lässt jeden getragenen Gegenstand fallen, der einen der `slots` belegt oder eines der `tags` trägt, sowie jede Werteblockaktion, deren `qualities` eines der `tags` tragen, entweder beim Auferlegen des Zustands (`at: "applied"`, Fears „lässt fallen, was es hält“) oder zu Beginn jedes Zuges des Betroffenen (`at: "turn-start"`, Commands „Lass fallen“). Was gefallen ist, liegt auf der Zelle, auf der er stand: Keine seiner Aktionen gehört ihm mehr (abgelehnt als `dropped`), es gibt nichts mehr von dem, was es beim Tragen gab, und sein Anteil an der Verteidigung des Betroffenen ist weg (die 2 eines Schilds). Er hebt es auf, wenn er auf dieser Zelle oder daneben steht, mit dem einen kostenlosen Aufheben des Zuges oder mit dem Budget `pickUp`, wenn der Zustand eines nennt; das Protokoll zeigt `letFall` und `pickedUp`. `onlyWhenStuck: "any"` überlässt einen Zug, der beginnt, ohne dass der Zustand seinen Betroffenen irgendwohin gehen lässt, ganz dem Betroffenen (Fears „es sei denn, es gibt keinen Ort, an den es sich bewegen kann“). `keepsOut` ist eine Entfernung zu dem, der den Zustand auferlegt hat: Innerhalb davon tritt der Betroffene nur weiter weg, und er bleibt nur außerhalb davon stehen, solange ein Ort außerhalb in Reichweite ist (Turn Undeads „kann sich nicht willentlich an einen Ort innerhalb von 30 Fuß um dich bewegen“). Ein Rettungswurf, der einen Zustand beendet, kann `unseen: true` sein und wird nur gewürfelt, solange sein Betroffener den nicht sehen kann, der ihn auferlegt hat (der Rettungswurf von Fear außerhalb der Sichtlinie). Die `applies` eines Eintrags können `destroysUpTo` `[{tier, when?}]` tragen: Eine Kreatur, die den Rettungswurf nicht schafft und deren Bedrohungsstufe höchstens so hoch ist wie das höchste `tier`, dessen `when` auf dem Bogen des Nutzers zutrifft, wird stattdessen sofort zerstört (Destroy Undead, HG 1/2 ab Kleriker 5 bis HG 4 ab Stufe 17); ein Charakter oder eine Kreatur ohne Stufe wird es nie.

Zielauswahl über einen beliebigen Sinn, Ziele nahe beieinander, wachsende Flächen, mehr Nutzungen und gehaltene Dinge (Capability API 1.267). Ein Eintrag oder eine Kreaturenaktion, die Sinne verlangt (`needs`), kann `needsAny: true` ergänzen: Ein Ziel, das einen davon behält, kommt infrage, und nur eines, dem alle fehlen, wird abgelehnt (Turn Undeads „jeder Untote, der dich sehen oder hören kann“). `targetsWithin` ist eine Entfernung, innerhalb derer jedes Paar gewählter Ziele stehen muss, sonst wird die Auswahl als `targets-apart` abgelehnt (die Kreaturen von Command bei höheren Zauberplätzen „innerhalb von 30 Fuß zueinander“). Eine `area` kann `sizePerCostStep` tragen, die Entfernung, um die ihre Größe für jede Stufe wächst, um die ihre Kosten erhöht werden (die Kugel von Confusion, die pro Zauberplatzstufe um 5 Fuß wächst); eine Wand wächst nie. Ein Gegenstand mit `use` kann `moreUses` `[{label, use}]` auflisten: Jede ist ein weiterer Menüeintrag, benannt nach dem Gegenstand und ihrem `label`, verbraucht dieselben Ladungen und wird mit dem Gegenstand fallen gelassen (ein Zauberstab mit mehreren Zaubern). Eine Kreatur kann `held` `[{label, tags, defense?}]` auflisten, Dinge, die sie hält und die keine eigene Aktion sind (ein abgedruckter Schild): Ein Zustand, dessen `drops` eines ihrer `tags` nennt, lässt sie samt ihren getaggten Aktionen fallen, ihre `defense` fehlt der eigenen Verteidigung, bis die Kreatur sie aufhebt, und jedes wird wie ein fallen gelassener Gegenstand aufgehoben.

Blicke und Auren nach Empfänger (Capability API 1.268). Eine Aura kann `targetTypes` tragen, gelesen wie die eines Eintrags: Sie erreicht nur, wer so beschaffen ist (Horrific Appearance einer Seevettel, nur Humanoide). `sourcesOf` nennt Zustände: Sie erreicht nur, wer einen davon ihrem Betroffenen auferlegt hat (Barbed Hide eines Stachelteufels, der jedem schadet, der ihn packt). Das `save` einer Aura kann `failedBy` `{atLeast, applies}` tragen: Ein Fehlschlag um mindestens so viel legt stattdessen diese auf (der Blick einer Medusa, bei einem Fehlschlag um 5 oder mehr sofort versteinert). Ein `seen`-Rettungswurf kann `avert: true` tragen: Wen er erreicht, der darf in seinem Zug kostenlos den Blick von ihrem Betroffenen abwenden. Bis er wieder hinsieht (ebenfalls seine freie Wahl), überspringt er diesen Rettungswurf und kann den Betroffenen nicht sehen; seine Angriffe auf ihn erfolgen also ungesehen. Das Protokoll zeigt `averted`, und die Kampfsteuerung lässt ihre Kreaturen den Blick abgewandt halten, solange noch jemand anderes zum Kämpfen übrig ist. Ein Rettungswurf, der einen Zustand beendet, kann `seenLean` tragen (`"advantage"` oder `"disadvantage"`): So wird er gewürfelt, solange sein Betroffener den sehen kann, der den Zustand auferlegt hat (der wiederholte Rettungswurf gegen die Seevettel, mit Nachteil, solange sie in Sicht ist).

Stäbe wirken mit den Zahlen ihres Besitzers (Capability API 1.269). Das `use` eines Gegenstands kann seine Rettungswurfschwierigkeit mit `sheetDifficulty` statt `saveDifficulty` vom Bogen seines Besitzers lesen, ein Wert, wie ihn `toHit.sheetBonus` liest (`{ "derived": "spell_save_dc" }`); sein Angriffsbonus wird bereits auf dieselbe Weise vom Bogen gelesen, mit `toHit.sheetBonus` (`{ "derived": "spell_attack" }`) und ohne Attribute. Eine Nutzung mit `charges` kann `chargeStep` `{max, amount?, targets?}` tragen: Ihr Nutzer darf bis zu `max` weitere Ladungen ausgeben, jede eine Stufe höherer Kosten, die `amount` und `targets` addiert, so wie ein höherer Zauberplatz `perCostStep` und `targetsPerCostStep` addiert, und eine Fläche mit `sizePerCostStep` wachsen lässt (der Zauber eines Staff of Power auf höherer Stufe, die 1d6 Energie pro Ladung eines Staff of Striking). Das Menü bietet sie als Zahlungen namens `charges:<how many more>` an, nur so viele, wie der Gegenstand noch hält. Dieselbe Nebenversion erhöht die Zahl der Zustände, die ein Regelsatz deklarieren darf, auf 320, und das `save` einer Aura kann `immuneWhenEnds: true` tragen: Sobald endet, was ein Fehlschlag auferlegt hat, wie auch immer es endet (ein Rettungswurf, seine Uhr, eine Kur), bleibt die Aura dieses Betroffenen für den Rest des Kampfes von ihm fern, so wie `immuneOnSuccess` sie nach einem geschafften Rettungswurf fernhält (das „ist erfolgreich oder der Effekt endet für ihn“ einer Seevettel).

Eine beim Wirken benannte Art (Capability API 1.270). Die `mechanics` eines Katalogeintrags mit `applies` können `kindChoice: true` tragen: Ihr Nutzer nennt beim Nutzen eine der `combat.creatureTypes` (einen Typ oder ein Tag), angeboten als Modi `kind-<id>`, und was der Eintrag auferlegt, merkt sich diese Art. Eine Aura dessen, was er auferlegt hat, mit `chosenKind: true` erreicht nur Kreaturen dieser Art, und eine mit `orSeen: true` erreicht außerdem jeden, der ihren Betroffenen sehen kann, egal wie weit entfernt. Antipathy in 5e legt seinem Ziel also einen Zustand auf, dessen Aura mit `side: "all"` die gewählte Art innerhalb von 60 Fuß oder in Sicht verängstigt, und die Verängstigten bewegen sich weg (`moves: "away"`), während sich die Bezauberten von Sympathy darauf zubewegen. Das `saveEnds` eines Zustands kann `beyond` tragen, in der Entfernungseinheit des Regelsatzes: Sein Rettungswurf wird nur gewürfelt, solange sein Betroffener weiter als so weit von dem entfernt steht, der ihn auferlegt hat, mit `unseen` zusätzlich außerhalb von dessen Sicht (das „nicht innerhalb von 60 Fuß um das Ziel und nicht in der Lage, es zu sehen“ von Antipathy).

Mehr von dem, was Stäbe und Ringe tun (Capability API 1.271). Das `use` eines Gegenstands kann `label` tragen, das neben dem Namen des Gegenstands angezeigt wird, wie die Beschriftung eines `moreUses`-Eintrags („Staff of Fire: Burning Hands“); eine weitere Nutzung wird nach ihrem eigenen `label` benannt. Eine Nutzung kann `amountAdd` tragen, einen Wert vom Bogen ihres Besitzers, der zu ihrer Menge addiert wird, wie bei einem Katalogeintrag (Cure Wounds eines Staff of Healing, `{ "abilityModFromField": "spellcasting_ability" }`), im Kampf und außerhalb. Ein `chargeStep` kann `push` tragen, in der Entfernungseinheit des Regelsatzes: Jede weitere Ladung stößt das Ziel so viel weiter, zusätzlich zum eigenen `push` der Nutzung (die 5 Fuß pro Ladung eines Ring of the Ram). Das `charges.breaksOn` eines Gegenstands kann `regains` `{atLeast, amount}` tragen: Wird seine letzte Ladung verbraucht und zeigt sein Würfel `atLeast` oder mehr, erhält der Gegenstand stattdessen `amount` Ladungen zurück (die 1d12 + 1 eines Staff of the Magi bei einer 20), im Kampf, außerhalb und wenn das Inventar eine Ladung verbraucht; `atMost` darf dann bei einem Gegenstand, der nie zerbricht, weggelassen werden.

Ein Gegenstand, der zu einem anderen wird (Capability API 1.272). Das `charges.breaksOn` eines Gegenstands kann neben `atMost` `becomes` tragen, einen anderen Gegenstand des Regelsatzes als `<catalog>/<entry>`: Bei den Augenzahlen, die ihn zerbrechen würden, wird der Gegenstand stattdessen zu diesem (der nichtmagische Kampfstab eines Staff of Striking oder ein Staff of Power, der nur sein +2 behält, als Gegenstand geschrieben, der nur das hat). Im Kampf verschwinden seine Nutzungen, er schlägt von da an als der neue Gegenstand zu, und der Kampf schreibt den Stapel als diesen Gegenstand zurück, unter dessen Namen und ohne Ladungen; außerhalb eines Kampfes und wenn das Inventar eine Ladung verbraucht, ändert sich der Stapel auf dieselbe Weise. Der genannte Gegenstand muss ein anderer Gegenstand des Regelsatzes sein, egal in welcher Katalogdatei er steht.

Bei einem Treffer verbrauchte Ladungen (Capability API 1.273). Das `attack.spends` einer Waffe listet bis zu vier Wege auf, wie ihr Besitzer die Ladungen des Gegenstands ausgeben darf, sobald ein Schlag damit getroffen hat: Jeder hat ein `label`, die `charges`, die er kostet, eine `amount` aus Würfeln und einem festen Anteil, die dem Schlag mit eigener Schadensart (`type`) hinzugefügt wird (der der Waffe, wenn keine genannt ist), und optional `blow` (nur ein `melee`- oder `ranged`-Schlag), `chargeStep` (`max` weitere Ladungen, die jeweils ihre `amount` erneut addieren: die 1d6 Energie pro Ladung eines Staff of Striking, bis zu drei) und `onHit` (bis zu zwei Zustände, die der Getroffene erhält, jeweils mit `rounds`, einem `save`, der ihn fernhält, oder `saveEnds`: der Constitution-Rettungswurf eines Staff of Withering). Im Kampf wird jeder dem Besitzer bei seinem eigenen Treffer mit dieser Waffe und keiner anderen angeboten, nachdem der Getroffene geantwortet hat; seine Würfel werden mit dem Schlag gewürfelt und durch dessen kritischen Treffer verdoppelt, und der Würfel für die letzte Ladung des Gegenstands wird wie bei einer Nutzung gewürfelt. Der Gegenstand hält Ladungen.

Zahlen, die vom Auferlegenden eines Zustands festgelegt werden (Capability API 1.274). Ein Zustand, den ein Eintrag mit `applies` auferlegt, kann einen `value` tragen, einen Wertverweis, der beim Auferlegen vom Bogen dessen gelesen wird, der ihn auferlegt (das `{ "abilityModFromField": "spellcasting_ability" }` von Heroism), und das `temporary` eines Kampfzustands gibt seinem Betroffenen zu Beginn oder am Ende jedes seiner Züge (`at`) temporäre Punkte: `dice` und `flat`, plus diesen Wert mit `value: true`, und mit `lostWhenEnds` verschwindet beim Enden des Zustands, was davon übrig ist, sofern der Betroffene nicht aus etwas anderem mehr hat, als er gab. `save.appliedDifficulty` einer Aura würfelt ihren Rettungswurf gegen die Rettungswurfschwierigkeit dessen, was dem Betroffenen den Zustand der Aura auferlegt hat, festgelegt beim Auferlegen (die Zauberrettungswurfschwierigkeit des Wirkenden von Antipathy/Sympathy); ihr `difficulty` bleibt für eine Aura, die nichts auferlegt hat. Ein Rettungswurf, der einen Zustand mit `at: "damaged"` beendet, kann `bySource` angeben: Er wird nur bei Schaden durch den gewürfelt, der den Zustand auferlegt hat (der Rettungswurf von Sympathy, wenn das Ziel ihrem Betroffenen schadet). `behavior.keepsIn` eines Zustands verhindert, dass sich sein Betroffener, sobald er innerhalb dieser Entfernung zu dem ist, der ihn auferlegt hat, je weiter entfernt (Sympathys „kann sich nicht willentlich entfernen“). Und das `use` eines Gegenstands kann wie die Mechanik eines Eintrags `kindChoice` tragen (1.270); eine Schriftrolle mit Antipathy/Sympathy nennt ihre Art also beim Nutzen.

Ausgesetzte statt beendeter Zustände (Capability API 1.275). Neben `whileSourceInSight` hält `orSourceWithin` eines Kampfzustands (eine Entfernung in den eigenen Einheiten des Regelsatzes) ihn aufrecht, solange sein Betroffener so nah bei dem steht, der ihn auferlegt hat, ob sichtbar oder nicht: Außer Sicht und außer Reichweite ist er ausgesetzt, bleibt aber mit laufender Uhr auf seinem Betroffenen und gilt wieder, sobald eines von beidem zutrifft (die Furcht von Antipathy, innerhalb von 60 Fuß oder in Sicht). Die `suppresses` eines Kampfzustands listen andere Zustände auf, die er aussetzt, solange er besteht: Was sie bewirken, hört auf, sie bleiben bestehen und gelten wieder, sobald er endet (die Bezauberung und Furcht von Calm Emotions, die von Mindless Rage).

Teleportationen (Capability API 1.276). Ein `mechanics.teleport` eines Katalogeintrags, ein `use.teleport` eines Gegenstands oder das `teleport` einer Kreaturenaktion bewegt ihren Nutzer sofort an einen freien Ort innerhalb von `distance` (in den eigenen Einheiten des Regelsatzes): ohne Schritt dazwischen, sodass niemand beim Weggehen einen Angriff gegen ihn erhält, und eine Zone, in der er landet, erfasst ihn so, als wäre er hineingegangen. Das gibt es nur auf einem Brett und braucht daher `combat.distance`; ohne Brett wird eine Aktion, die nur teleportiert, nicht angeboten. Mit `seen` nur an einen Ort, den ihr Nutzer jetzt sehen kann (eine Wand, ein Nebel oder eine Blindheit, die die Augen nimmt, hält die Zellen dahinter von der Liste fern): Misty Step in 5e, `{ "distance": 30, "seen": true }`. `carries` (1 bis 8) nimmt so viele willige Kreaturen der Seite ihres Nutzers mit, nicht größer als ihr Nutzer, von innerhalb von `carriesWithin` (ohne Angabe in Berührung), und jede landet so nahe an ihrem Nutzer, wie Platz ist: Dimension Door, `{ "distance": 500, "carries": 1, "carriesWithin": 5 }`. Eine Kreaturenaktion mit einer Teleportation wirkt auf die Kreatur selbst (Teleport eines Blinkhunds). Die Option listet die Zellen, an die sie führen kann, als `teleport.cells` auf und wer mitkommen darf als `teleport.carries`; eine Auswahl nennt die Zelle als `at` und ihre Begleitung als `carries`. Eine Teleportation ist nie eine Fläche oder eine Reaktion.

Sechs Zustände auf einmal und Sicht, die wirklich Sehen ist (Capability API 1.277). `applies` fasst an der Mechanik eines Katalogeintrags, an der Nutzung eines Gegenstands und an einer Kreaturenaktion bis zu 6 Einträge (vorher 4): Rage und Frenzy ergänzen neben ihren vier jeweils den Zustand von Mindless Rage. Und `whileSourceInSight` (mit `orSourceWithin` daneben) liest jetzt die eigene Sicht des Betroffenen, wie das `orSeen` einer Aura: Eine freie Linie auf dem Brett ist weiterhin nötig, und darüber hinaus muss der Betroffene seine Quelle mit seinen Augen oder Sinnen sehen. Eine Blindheit, die die Augen nimmt, ein verdeckender Nebel, die Dunkelheit jenseits dessen, worin er sieht, oder eine für ihn ungesehene Quelle (unsichtbar) unterbrechen sie also alle wie eine Wand.

Calm Emotions (Capability API 1.278). Ein Rettungswurf kann `alliesMayFail: true` angeben (am `save` eines Katalogeintrags, einer Gegenstandsnutzung oder einer Kreaturenaktion): Ein Ziel auf der eigenen Seite seines Nutzers lässt ihn zu und scheitert ohne Wurf, und das Protokoll sagt das, während alle anderen wie gewohnt würfeln. Die `effects` eines Zustands können `cannot-target-source-side` tragen: Sein Betroffener richtet nichts auf den, der ihn ihm auferlegt hat, oder auf jemanden auf dessen Seite, sofern diese Seite nicht seine eigene ist (dann hält sie niemanden fern). `endsWhen` nimmt neben `damaged` und `harmed-by-source-side` zwei weitere Enden an, bis zu allen vier: `attacked`, ein Angriffswurf, den irgendjemand gegen seinen Betroffenen macht, ob Treffer oder nicht (eine Aktion, die ohne Wurf trifft, zählt nicht), und `ally-harmed-in-sight`, Schaden an jemand anderem auf der Seite seines Betroffenen, den dieser sieht (eine freie Linie auf dem Brett und seine eigenen Augen oder Sinne). Und `endsWhenHarmedFrom` listet Kataloge auf: Schaden an seinem Betroffenen durch irgendetwas, das aus einem davon gewirkt wurde, von wem auch immer, einschließlich des Zaubers einer Schriftrolle und einer stehenden Zone, beendet ihn. Schaden bedeutet Schaden oder das Ziel einer schädlichen Aktion zu sein, wie bei `harmed-by-source-side`, und das erneute Wirken genau desselben Zustands frischt ihn auf, statt ihn zu beenden. Jedes davon wartet, bis der Schritt abgeschlossen ist, der es ausgelöst hat. Und ein Zustand, den der eigene aktive Zustand seines Betroffenen mit `suppresses` aussetzt, wird nicht mehr durch eine Immunität beendet, die derselbe Zustand gibt: Er ist ausgesetzt, nicht kuriert. Eine Furcht, die schon bestand, als ein gegen Furcht immun machender Kampfrausch begann, kehrt also zurück, wenn der Kampfrausch endet (Mindless Rage in 5e), während neue Furcht weiterhin nicht wirken kann.

Teleportationen aus dem Kampf, gesehene Mitreisende und Rauch (Capability API 1.279). Ein `teleport` (an einem Katalogeintrag, einer Gegenstandsnutzung oder einer Kreaturenaktion) nimmt drei weitere Schlüssel an. `leaves: true`: Es darf seinen Nutzer ganz aus dem Kampf bringen, die Meile eines Einhorns, statt auf eine Zelle; die Auswahl nennt dann kein `at` (das Menü zeigt eine Schaltfläche „Leave the fight“), und sein Nutzer und alle, die mitkommen, sind lebend fort (angezeigt als „Left the fight“, ihre Gesundheit bleibt erhalten, und nichts bringt sie zurück). Ohne Brett ist das Verlassen der einzige Ort, an den es führt, und jeder, der auf der Seite seines Nutzers steht, darf mitkommen, da nichts misst, wer in der Nähe steht. Eine Gruppe, die aus dem Kampf heraus ist, weil jemand von ihr auf diese Weise gegangen ist, ist geflohen (das Ergebnis `fled`, das den Kampf wie eine Flucht beendet); ein Gegner, der auf diese Weise gegangen ist, ist weder geschlagen noch steht er noch, sondern ist entkommen, und der Rückblick sagt das. Die eigenen Kreaturen der Kampfsteuerung gehen bei einem Viertel ihrer Gesundheit oder weniger und nehmen mit, wen sie können. `carriesSeen: true` (mit `carries`): Nur wer für ihren Nutzer sichtbar ist, darf mitkommen, die „willigen Kreaturen, die es sehen kann“ eines Einhorns. Und `smoke` (`{}` oder `{ "pierced": [senses] }`): Eine Wolke steht auf den Zellen, die ihr Nutzer verlassen hat, und auf denen, auf denen er landet, und verdeckt wie das `obscures` einer Zone, vom Moment der Landung bis zum Ende des nächsten Zuges ihres Nutzers, der Rauch des Cape of the Mountebank.

Eine Teleportation, die zuschlägt (Capability API 1.280). Die Teleportation einer Kreatur kann eine ihrer eigenen Aktionen als `strike` nennen (ihre `id`): „Vor oder nach dem Teleportieren kann der Hund einen Bissangriff ausführen“ eines Blinkhunds. Das Teleportieren lässt diese Aktion dann in diesem Zug einmal kostenlos folgen (das Menü sagt „Free, part of the same action“), und das Menü bietet es auch andersherum an, als „Bite, then Teleport“ auf dem Budget der Teleportation, wonach die Teleportation einmal kostenlos folgt. Keines führt zu einem dritten. Der zuerst ausgeführte Schlag verbraucht zusammen mit seinen eigenen die Nutzungen und die Wiederaufladung der Teleportation und wird nur angeboten, solange beide übrig sind. Der Schlag ist eine andere einfache Aktion derselben Kreatur: nicht die Teleportation selbst, keine Folge, keine andere Teleportation, keine Reaktion und nichts, was mit Punkten gekauft wird. Nur die Teleportation einer Kreatur nennt einen; die eines Katalogeintrags oder einer Gegenstandsnutzung wird abgelehnt. In einem Kampf, der keine Entfernung misst, führt eine Teleportation nirgendwohin, also wird nichts gepaart. Auch die Kampfsteuerung nutzt das: Eine Kreatur, die zu weit entfernt ist, um zu ihrer Beute zu gehen, teleportiert sich daneben und beißt im selben Zug.

Auszehrende Schläge (Capability API 1.281). Die `mechanics` eines Katalogeintrags oder die Aktion einer Kreatur können `drain` tragen: Ihr Nutzer erhält Gesundheit in Höhe des Schadens zurück, den der Schlag jedem Ziel nach Resistenzen zugefügt hat, abgerundet und nie über sein Maximum hinaus, und vom Maximum des Ziels wird nichts abgezogen (dafür siehe `reducesMax`). `share` (über 0, bis 1, ohne Angabe alles) gibt an, wie viel davon zurückkommt, und `damageType` zählt nur Schaden dieser Art: Psychic Drain eines Abolethen ist `drain: {}`, Vampiric Touch `drain: { "share": 0.5, "damageType": "necrotic" }`. Was Heilung verhindert, verhindert auch das. Ein Auszehren braucht Schaden, den es zurückgeben kann; eines an einem Eintrag ohne `amount`, an einer Heilung oder an einer Kreaturenaktion ohne `damage` wird abgelehnt.

Kreisflächen um ihren Nutzer (Capability API 1.282). Eine `area` (die eines Katalogeintrags oder einer Kreaturenaktion) kann `around: true` angeben: eine Kreisfläche der Größe `size`, zentriert auf ihren Nutzer und nie gezielt. Jeder innerhalb von `size` um den Nutzer wird beim Einsatz erfasst, Freund wie Feind, sofern `friendlyFire` nicht false ist (eine heilende nur die eigene Seite ihres Nutzers), und nie der Nutzer selbst. Eine Wand dazwischen hält eine Kreatur heraus, es sei denn, die Fläche gibt auch `throughWalls: true` an: Channel Negative Energy eines Mumienfürsten, „auch solche hinter Barrieren und um Ecken“. In einem Kampf ohne Brett erfasst sie jeden. Sie ist auf niemanden gerichtet und funktioniert daher als zwischen den Zügen gekaufte Signaturaktion ebenso wie in einem Zug. Nur eine einzelne Kreisfläche wird auf ihren Nutzer zentriert (keine `copies`), `throughWalls` gibt es nur mit `around`, und die Kreisfläche eines Eintrags um seinen Nutzer wirkt sofort und hinterlässt daher keine `zone`. Channel Negative Energy ist eine Kreaturenaktion mit `signature: { "cost": 2 }`, `area: { "shape": "burst", "size": 60, "around": true, "throughWalls": true }` und `applies` eines Zustands mit der Wirkung `cannot-heal` für `{ "rounds": 1, "of": "source" }`, bis zum Ende des nächsten Zuges des Mumienfürsten. Die Kampfsteuerung wägt eine solche Fläche danach ab, wen sie erfasst, so wie sie eine gezielte Form abwägt.

Legendäre Bewegungen (Capability API 1.283). Eine Kreaturenaktion mit `signature`-Kosten kann `move` angeben und sonst nichts bewirken: Ihr Urheber geht zwischen den Zügen und wählt dabei ein Feld auf dem Brett wie bei einem Gang im eigenen Zug, mit einem Kontingent, das nur für diese Bewegung geliehen wird; die Bewegung seines eigenen Zuges bleibt also unberührt. `move: { "share": 0.5 }` ist ein Anteil seiner Geschwindigkeit (eine Tarraske „bewegt sich bis zur Hälfte ihrer Geschwindigkeit“), `move: { "distance": 60 }` eine Entfernung in der eigenen Einheit des Regelsatzes und `move: {}` seine ganze Geschwindigkeit; nicht `share` und `distance` zugleich. Beim Verlassen der Reichweite eines anderen wird sie wie jeder Gang angegriffen, und das Fenster, in dem sie gekauft wurde, wird weiter befragt, sobald der Angriff gelandet ist. `noOpportunity: true` provoziert niemanden (ein Vampir „bewegt sich bis zu seiner Geschwindigkeit, ohne Gelegenheitsangriffe zu provozieren“). `untouchable: true` ist eine Bewegung, die nichts verletzen oder festhalten kann (Whirlwind of Sand eines Mumienfürsten, `{ "distance": 60, "untouchable": true }`): Was ihren Urheber festhält, lässt ihn zuerst los, niemand greift sie an, und keine Zone und kein Boden, den sie überquert, bewirkt etwas an ihr. Eine festgehaltene Kreatur oder eine ohne Geschwindigkeit kann mit jeder anderen Bewegung nirgendwohin. Ohne Brett wird nichts angeboten. Die Kampfsteuerung kauft eine solche Bewegung wie eine Teleportation: um von einem Gegner neben ihr freizukommen, wenn sie schwer verletzt ist, oder um zu einem aufzuschließen, wenn keiner in Reichweite ist.

Legendäres Wirken (Capability API 1.284). Eine Kreaturenaktion mit `signature`-Kosten kann `casting` angeben und sonst nichts bewirken: Zwischen den Zügen bietet sie jeden Zauber an, den ihr Urheber in seinem eigenen Zug mit dem `budget` der Aktion wirken könnte, aus seinem `spellcasting` oder den Zaubern seines Bogens, benannt „Cast a Spell: Fireball“ und so weiter. Jeder wird genau wie im Zug der Kreatur gezielt, bezahlt und aufgelöst (Ziele, eine Zelle für eine Fläche, ein Platz oder eine Nutzung wie immer verbraucht), und statt des Budgets werden die Punkte ausgegeben; ihr eigener Zug behält also jedes Budget, das er hatte. `casting: { "cantripsOnly": true }` bietet nur Zaubertricks an (Zauber, die aus keinem Pool bezahlt werden): Cantrip eines Lichs, `signature: { "cost": 1 }`. Cast a Spell einer Sphinx ist `casting: {}` mit `signature: { "cost": 3 }`. Was der Zauber öffnet (ein Counterspell, eine Reaktion darauf, durch ihn verletzt zu werden), wird wie in einem Zug beantwortet, und das Fenster, in dem er gekauft wurde, wird weiter befragt, sobald all das geschlossen ist. Die Kampfsteuerung kauft einen, wenn der Zauber die Punkte wert ist, so wie sie jede andere Signaturaktion abwägt.

Bewegung nach der Aktion und mit einer bestimmten Geschwindigkeit (Capability API 1.285). Eine Signaturaktion, die etwas bewirkt (Schaden, eine Fläche, einen Rettungswurf, einen Zustand), kann zusätzlich ein `move` tragen: Was sie bewirkt, wirkt zuerst, dann darf sich ihr Urheber auf ein Feld bewegen, das das Menü angeboten hat und das mit der Aktion gewählt wird. Keines zu wählen ist ebenfalls eine Wahl, und ein Feld, das nach ihrer Wirkung nicht mehr erreichbar ist, wird einfach nicht begangen. Ein `move` kann mit `speed` auch eine Bewegungsart nennen (`walk`, `fly`, `swim`, `climb` oder `burrow`): Sein `share` wird allein aus dieser Geschwindigkeit gelesen, es bewegt sich nur auf diese Art, und eine Kreatur ohne diese Geschwindigkeit kann nirgendwohin. Wing Attack eines Drachen ist seine Kreisfläche um ihn (`area: { "shape": "burst", "size": 10, "around": true }`, sein Rettungswurf und sein Liegend) mit `move: { "share": 0.5, "speed": "fly" }`: „Der Drache kann dann bis zur Hälfte seiner Fluggeschwindigkeit fliegen.“ Ein `move` trägt weiterhin kein `teleport`, `sequence`, `reaction` oder `charge`. Die Kampfsteuerung fliegt nach dem Flügelschlag davon, wenn sie neben einem Gegner schwer verletzt ist, oder schließt zu einem außerhalb ihrer Reichweite auf.

Leichte Verdeckung und der Wind (Capability API 1.286). Das `obscures` einer Zone oder der `smoke` einer Teleportation kann `light: true` angeben: Dann verbirgt es niemanden und verdeckt nur leicht, wer durch es hindurch oder in ihm gesehen wird, wie das dämmrige Licht in 5e oder der Rauch eines Cape of the Mountebank (die Engine weiß, wer so gesehen wird; Hide und Perception lesen das). Es kann auch `dispersed: true` angeben: Eine Zone, deren Regel `disperses: true` angibt, beendet es dann, wo immer die beiden aufeinandertreffen, nach jeder Aktion, zusammen mit der Konzentration, die es hält. Fog Cloud ist in 5e `obscures: { "dispersed": true }`, Gust of Wind eine Zone mit `disperses: true`; Darkness gibt keines von beiden an, also lässt der Wind es bestehen. Eine Zone, die nur zerstreut, braucht keinen Auslöser.

Verstecken, Search und Detect (Capability API 1.287). `combat.hiding` macht die Standardaktion `hide` echt: `{ "stealth": "stealth", "perception": "perception", "noisy": ["verbal"] }` nennt zwei der `combat.checks` und optional `passive` (10), `lightly` (5) und die `combat.components`, die Lärm machen. Hide würfelt `stealth` mit den eigenen Würfeln des Kampfes; danach ist der Nutzer vor jedem Gegner versteckt, der ihn nicht klar sieht (hinter einer Wand, in einem Nebel, unsichtbar oder nur leicht verdeckt) und dessen passive Perception, `passive` plus sein `perception`-Wert und `lightly` weniger, wenn er ihn nur leicht verdeckt sieht, von der Summe erreicht wird. Ein Gegner, vor dem er versteckt ist, sieht ihn nicht, kann also nichts auf ihn richten, er greift ihn als jemand Ungesehenes an, und `combat.sight.unseenAttacks` gibt diesem Angriff Vorteil. Das Verstecken hält über Züge hinweg an und endet: für alle, sobald sein Nutzer angreift, eine vergleichende Probe macht, jemandem schadet oder einen Rettungswurf verlangt oder etwas nutzt, das eine `noisy`-Komponente braucht (ein Zauber ohne verbale Komponente oder ein abgelegter Nebel lässt ihn versteckt); und für jeden Gegner, der ihn klar zu sehen bekommt oder dessen passiver Wert jetzt die Summe übertrifft, nach jedem Schritt und auf jeder Zelle eines Gangs. Die Standardaktion `search` (ergänze sie in `combat.standard`; sie braucht `combat.hiding`) würfelt `perception` und findet für den Suchenden jeden, der vor ihm versteckt ist und dessen Summe sie erreicht. Eine Kreaturenaktion mit `search: true` tut dasselbe und sonst nichts: Ein legendäres Detect ist `{ "name": "Detect", "budget": "action", "signature": { "cost": 1 }, "search": true }`. Eine Kreatur liest beide Werte aus ihren eigenen `checks`. Die Kampfsteuerung sucht, wenn jeder ihrer Gegner vor ihr versteckt ist, und nutzt zwischen den Zügen ein Detect, wenn irgendeiner es ist. Ohne Brett kann niemand versteckt sein außer durch einen Zustand, der ihn bereits verbirgt.

Ready (Capability API 1.288). `combat.readying: { "budget": "reaction" }` macht die Aktion Ready echt: Für jede Option, die ihr Nutzer jetzt mit seinem `standard`-Budget nehmen könnte (ein Angriff, ein Zauber, eine Kreaturenaktion), und für einen Gang bietet das Menü zwei Einträge an, bereitgehalten für den Moment, in dem ein Gegner in Reichweite kommt (`comes`), oder für den, in dem einer handelt (`acts`). Einen davon zu nehmen verbraucht das Standardbudget und hält diese Option bis zum Beginn des nächsten Zuges ihres Nutzers bereit. Bringt der Gang eines Gegners ihn bei irgendeinem Schritt dorthin, wo die bereitgehaltene Option auf ihn gerichtet werden könnte (und ihr Halter ihn sieht), oder beendet ein Gegner dort irgendetwas, was er tut, fragt ein Fenster den Halter, der die Option namens `readied` mit `budget` nimmt (die Reaktion in 5e) oder sie verstreichen lässt und auf diesem Gang nicht erneut gefragt wird. Ein bereitgehaltener Gang reicht so weit, wie die ganze Geschwindigkeit seines Halters reicht, und das Verlassen einer Reichweite auf ihm löst wie bei jedem Gang Gelegenheitsangriffe aus. Mit `"concentrates": true` (das braucht `combat.concentration`) wird ein Zauber beim Bereithalten bezahlt und durch Konzentration gehalten: Löst er aus, wird er nicht noch einmal bezahlt, geht die Konzentration verloren, ist er verloren, und einer, der nie auslöst, bleibt verbraucht. Alles andere bereitzuhalten kostet nichts, bis es auslöst. In 5e ist es `{ "budget": "reaction", "concentrates": true }`.

Langsames Zerstreuen (Capability API 1.289). Das `dispersed` eines Nebels kann statt `true` auch `{ "after": N }` sein: Ein Wind, der ihn erreicht, beendet ihn dann erst, wenn er N volle Runden am Stück auf ihn geblasen hat, gezählt ab dem Zug, in dem er ihn zuerst erreicht hat. Ein Wind, der ihn vorher nicht mehr erreicht, weil er bewegt, beendet oder weg ist, beginnt die Zählung neu, wenn wieder einer ihn erreicht. Stinking Cloud in 5e, das ein starker Wind wie Gust of Wind nach 1 Runde zerstreut, ist `"obscures": { "dispersed": { "after": 1 } }`.

Die Suche nach Versteckten, abgewogen (Capability API 1.290). Ein Probenwert des Kampfes, der aus einer Fertigkeit gelesen wird (`{ "skillMod": "stealth" }`), zählt jetzt bei seinem Wurf als Probe dieser Fertigkeit; eine Änderung, die mit `skills` darauf eingegrenzt ist, gilt also bei Hide, Search und vergleichenden Proben: der Nachteil schwerer Rüstung auf Stealth, die +10 von Pass without Trace, der Vorteil von Eyes of the Eagle auf Perception. `combat.hiding.passiveMode` (in 5e 5) wird zu einer passiven Perception mit Vorteil addiert und von einer mit Nachteil abgezogen; ohne diese Angabe liest ein passiver Wert keinen Modus. Eine Änderung `{ "to": "checks-taken", "skills": ["perception"], "mode": "disadvantage" }` legt diesen Modus auf Proben, die gemacht werden, um ihren Betroffenen zu finden, sowohl den passiven Wert eines Gegners als auch dessen Search; sie nimmt einen `mode` an und sonst nichts. Cloak of Elvenkind in 5e. Findet ein Search, dass jemand verändert, wie für ihn gewürfelt wird, würfelt es für ihn allein erneut, und das Protokoll zeigt auch diesen Wurf.

Die eigenen Arten einer Kreatur, sich zu verstecken und zu suchen (Capability API 1.291). Eine Kreaturenaktion kann eine Erlaubnis sein, `"standard": { "actions": ["disengage", "hide"] }`: diese Standardaktionen (aus `combat.standard`), ausgeführt mit dem eigenen Budget dieser Aktion, wie Nimble Escape des Goblins in 5e mit der Bonusaktion. Mit `"while": "obscured"` gilt sie nur, solange die Kreatur in einem Nebel oder Dunst steht oder in einem Kampf, der in dämmrigem Licht oder Dunkelheit stattfindet: Shadow Stealth des Schattens. Die `checkModes` einer Kreatur lassen ihre eigenen Proben mit bestimmten Fertigkeiten zweimal würfeln: `{ "skills": ["perception"], "mode": "advantage", "sight": true }` nur, solange sie sehen kann (Keen Sight), mit `"light": ["sunlight"]` nur in diesem Licht (Sunlight Sensitivity, mit `"mode": "disadvantage"`) und mit `"terrain": ["snow"]` nur auf einem Brettfeld oder an einer Art Ort, die sie nennt (Snow Camouflage; die Orte sind die des taktischen Generators: Schnee, Höhle, Gebirge, Wasser und die übrigen). Das `passive` einer Kreatur ist ihre abgedruckte passive Perception, verwendet anstelle von `hiding.passive` plus ihrem Probenwert (es braucht `combat.hiding`). Das Licht, in dem ein Kampf stattfindet, stammt aus der Tageszeit der Szene: Sonnenlicht tagsüber im Freien, dämmriges Licht bei Morgen- und Abenddämmerung, Dunkelheit in der Nacht und helles Licht, das nicht von der Sonne stammt, in Innenräumen oder wenn die Zeit nichts sagt, was die Engine liest. Das Licht wirkt sich nur auf das aus, was es liest (diese Modi und `while: "obscured"`). Ohne `combat.sight.darkness` (1.294) ändert es nicht, wer wen sehen kann.

Die eigenen Arten von jemandem, sich zu verstecken und Versteckte zu finden (Capability API 1.292). `mechanics.hiding` eines Katalogeintrags (jeder Art, auch `utility`) und das `hiding` einer Kreatur sind Erlaubnisse, die dort gelesen werden, wo `combat.hiding` wirklich versteckt. `"behindLarger": true` lässt ihren Besitzer sich hinter jemandem verstecken, der mindestens eine Größe größer ist und zwischen ihm und dem Betrachter steht, auf jeder Linie zwischen ihnen (Naturally Stealthy eines Halblings; braucht `combat.sizes`). `"still": 10` addiert beim Verstecken so viel zu seiner Stealth-Summe, und das wird wieder abgezogen, sobald er sich bewegt oder eine Aktion nimmt (Hide in Plain Sight eines Waldläufers). `"slow": "advantage"` würfelt sein Hide mit Vorteil, wenn er sich in diesem Zug nicht mehr als die Hälfte seiner Geschwindigkeit bewegt hat (Supreme Sneak eines Diebes). `"aware": { "within": 10, "lostWith": ["deafened"] }` bedeutet, dass niemand innerhalb dieser Entfernung, in der eigenen Einheit des Regelsatzes, vor ihm versteckt ist, sofern er keinen dieser Zustände hat (Blindsense eines Schurken). Das `"starts": 15` einer Kreatur lässt sie den Kampf mit dieser Summe offen sichtbar versteckt beginnen, vor jedem, dessen passive Perception sie nicht übertrifft, ob er sie klar sieht oder nicht, bis sie sich bewegt, und sie versteckt sich auf dieselbe Weise erneut mit der Aktion Hide (Transparent eines Gallertwürfels).

Die eigenen Angriffswürfe einer Kreatur zweimal gewürfelt (Capability API 1.293). Die `attackModes` einer Kreatur gelten dort, wo ihre `checkModes` gelten würden: `{ "mode": "disadvantage", "sight": true, "light": ["sunlight"] }` ist Sunlight Sensitivity in 5e, Nachteil auf ihre Angriffe, solange sie sehen kann und der Kampf in Sonnenlicht stattfindet. Jeder Modus sagt mit `sight`, `light` oder `terrain`, wo er gilt. Der Modus kommt zu jedem anderen Vorteil und Nachteil des Wurfs hinzu; die beiden heben sich also weiterhin auf.

Die Dunkelheit (Capability API 1.294). Mit `combat.sight.darkness` hindert das Licht, in dem ein Kampf stattfindet, Augen am Sehen: `{ "seeIn": ["darkvision"], "pierced": ["truesight"], "carried": { "bright": 20, "dim": 20 } }`. Niemand in Dunkelheit wird gesehen und niemand in dämmrigem Licht klar gesehen, außer durch einen Sinn aus `seeIn` innerhalb seiner Reichweite, der Dunkelheit als dämmriges Licht und dämmriges Licht als helles sieht, oder durch einen `blind`-Sinn oder einen aus `pierced` innerhalb seiner Reichweite, die unabhängig vom Licht sehen. Was die Dunkelheit erhellt: `carried`, das Licht, das jeder trägt, der von einem Bogen aus kämpft, sofern kein Sinn aus `seeIn` für ihn reicht (eine Fackel); `light` an einem Zustand (der Zaubertrick Light), an der `worn`- oder `carried`-Wirkung eines Gegenstands (eine Laterne) oder an einer Kreatur (Banditen mit Fackeln, ein Feuerelementar). Jedes ist `{ "bright": N, "dim": N }` in der eigenen Entfernungseinheit des Regelsatzes: helles Licht so weit und dämmriges Licht noch einmal so weit. Wände halten Licht ab, und wer niedergestreckt ist, gibt keines ab. Wo die Dunkelheit echt ist, liest alles, was das Licht liest, es dort, wo jemand steht: wer wen sieht (Angriffe auf Ungesehene, Verstecken, eine Kreatur, die du sehen kannst), das Stehen in Verdeckung (`while: "obscured"`) sowie die `checkModes` und `attackModes` einer Kreatur. Ein Kampf in einer Höhle oder einem Dungeon findet zu jeder Stunde in Dunkelheit statt.

Ein Licht löschen und wieder entzünden (Capability API 1.295). Wer das `carried`-Licht trägt, hat dafür einen Schalter in seinem Menü, benannt nach dessen `label` (`"Torch"`; „Light“, wenn es keines nennt). Er kostet sein `budget`, wo eines genannt ist, und ist sonst einmal pro Zug kostenlos. Ein gelöschtes Licht gibt nichts ab; sein Träger kann also in der Dunkelheit ungesehen bleiben. Wieder entzündet wird er gesehen und gefunden, falls er sich versteckt hatte. Ein Gegenstand mit `toggle` gibt das `light` seiner Wirkung nur ab, solange er eingeschaltet ist, wie eine Kapuzenlaterne.

Von Kreaturen und Gegenständen geschaltete Lichter (Capability API 1.296). Eine Kreaturenaktion mit `"sheds": { "bright": 10, "dim": 10 }` legt das Licht fest, das ihr Nutzer von da an abgibt, und `"sheds": "out"` löscht es. Sie bewirkt sonst nichts und ist auf niemanden gerichtet: Ignited Illumination des Magmins sind zwei solche Aktionen auf seiner Bonusaktion, und Variable Illumination eines Irrlichts ist eine Aktion pro Reichweite. Eine Kreatur mit `"unlit": true` beginnt den Kampf mit gelöschtem `light`, das eine ihrer Aktionen entzünden muss. Das `toggle.offLight` eines Gegenstands ist das Licht, das er ausgeschaltet abgibt, anstelle dessen seiner Wirkung: Eine Kapuzenlaterne mit heruntergelassener Kapuze gibt `{ "bright": 0, "dim": 5 }` ab. Ein Licht ohne helle Reichweite gibt nur dämmriges Licht ab, selbst dort, wo es gehalten wird.

Licht aus Zonen und Licht, das Dunkelheit beendet oder Unsichtbare zeigt (Capability API 1.297). Das `lights` einer Zauberzone (in Fuß wie jedes `light`) gibt nur über die eigenen Zellen der Zone Licht ab, gemessen von ihrer Mitte: dem Punkt, auf den eine Kreisfläche gewirkt wird, oder bei einer Zone, die ihr Wirkender hält, diesem selbst. Eine Blendlaterne ist also ein auf ihren Wirkenden verankerter Kegel von 60 Fuß mit `"lights": { "bright": 60, "dim": 60 }`, der nichts hinter ihr erhellt. Dancing Lights ist eine bewegliche Punktzone mit `{ "bright": 0, "dim": 10 }`. Eine verdeckende Zone mit `"obscures": { "darkness": true }` ist magische Dunkelheit, und eine Zone mit `"dispelsDark": { "upTo": 3 }` beendet jede solche Dunkelheit, auf die ihre Zellen treffen und deren Zauberplatz diese Stufe oder niedriger hatte, wenn eine der beiden gewirkt wird: Daylight. Ein Licht mit `"reveals": true` an einer Zone, einer Gegenstandswirkung, einem Zustand oder einer Kreatur zeigt jeden, der durch einen Zustand ungesehen ist und in seinem hellen Licht steht: eine Laterne der Enthüllung. Jedes davon braucht Capability API 1.297.

Unter einem Zustand verborgenes Licht und Sonnenlicht (Capability API 1.298). Das `"lightOutWhile": ["invisible"]` einer Kreatur löscht ihr eigenes Licht, egal was ihre Aktionen zuletzt festgelegt haben, solange einer dieser Zustände auf ihr liegt, und bringt es zurück, wenn der Zustand endet: Die Invisibility eines Irrlichts verbirgt auch sein Licht. Ein Licht mit `"sunlight": true` an einer Kreatur, einer Gegenstandswirkung, einem Zustand oder einer Zone macht sein helles Licht zu Sonnenlicht, das `"light": ["sunlight"]` in einem Proben- oder Angriffsmodus liest: eine Sonnenklinge gegen Sunlight Sensitivity. Sein Sonnenlicht zählt auch auf einem bereits hellen Brett.

Magische Dunkelheit gegen Licht (Capability API 1.299). Eine Zone magischer Dunkelheit (`"obscures": { "darkness": true }`) mit `"dispelsLight": { "upTo": 2 }` löscht das Licht, das ein Zauber dieser Stufe oder niedriger erzeugt hat, wo immer die beiden aufeinandertreffen und egal, was zuerst da war: das `lights` einer Zone oder das von einem Zauber auferlegte `light` eines Zustands, das mit der Konzentration des Zaubers endet, wo diese ihn hält (Darkness auf Flame Blade in 5e). Nur magisches Licht erhellt die Zellen einer magischen Dunkelheit, egal in welchem Licht der Kampf stattfindet: Das Licht eines Zaubers an einer Zone oder einem Zustand ist es immer, und jedes andere Licht ist es, wenn es `"magical": true` angibt (das einer Sonnenklinge); eine Fackel innerhalb der Dunkelheit erhellt dort nichts. Ein `dispelsDark` mit `"within": 60` beendet nur Dunkelheit so nahe an seiner Mitte: die helle Kugel von Daylight, nicht ihr dämmriges Licht darüber hinaus. Jedes davon braucht Capability API 1.299.

Das Mehr höherer Kosten nur alle so viele Stufen (Capability API 1.300). `"perCostStepsEvery": 2` addiert `perCostStep` einmal für je zwei Stufen höherer Kosten statt für jede. Eine Aktion, die ein Zustand gibt (1.236), wächst jetzt mit den Kosten, zu denen der Zauber bezahlt wurde, der den Zustand auferlegt hat, mit eigenem `perCostStep`, `perCostStepsEvery` und `perCostStepsMax`: Der Schlag von Flame Blade in 5e ist `3d6` mit `"perCostStep": { "dice": "1d6" }, "perCostStepsEvery": 2`; eine mit einem Zauberplatz des 4. Grades herbeigerufene Klinge schlägt also mit 4d6 zu. `perCostStepsEvery` braucht Capability API 1.300.

Mit jemandem mitgetragene Zonen und getrennt abgelegte Kopien (Capability API 1.301). Das `"carried": "any"` einer Zone lässt eine Kreisfläche, die auf eine Zelle gelegt wird, auf der jemand steht, überall mitgehen, wohin dieser geht, auf ihn zentriert: Darkness oder Daylight in 5e auf einem Gegenstand, den er hält. Mit `"own"` zählt nur eine Zelle, auf der ihr Wirkender steht, für einen Zauber, der nur auf einen eigenen gehaltenen Gegenstand des Wirkenden gewirkt werden darf. Auf eine leere Zelle gelegt, bleibt sie dort. Eine mitgetragene Zone ist eine einzelne Kreisfläche an einem Punkt und wird nie von selbst bewegt. Das `"copiesWithin": 20` einer Fläche legt ihre `copies` so ab, dass jede Mitte innerhalb von 20 Fuß um die einer anderen liegt, statt dass sie sich berühren, und eine Zone aus Kopien, die ihr Wirkender mit `move` bewegen darf, bewegt alle auf dieselbe Weise: Dancing Lights in 5e ist eine Kreisfläche von 10 Fuß mit `"copies": 4, "copiesWithin": 20` und `"lights": { "bright": 0, "dim": 10 }`. Beides braucht Capability API 1.301.

Einträge, die einen anderen verändern (Capability API 1.302). Ein Eintrag auf einer Liste des Bogens mit `"amends": [{ "entry": "spells/eldritch-blast", ... }]` verändert diesen Eintrag seines Besitzers bei jeder Nutzung, und mehrere addieren sich. `"damageAdd"` (ein Wert wie `{ "abilityMod": "cha" }`) wird bei jedem Treffer zu seinem Schaden addiert: Agonizing Blast. `"range"` (in der Entfernungseinheit des Regelsatzes) ist seine Reichweite, wo diese größer ist: die 300 Fuß von Eldritch Spear. `"push"` stößt jeden, den er trifft, so weit geradewegs weg, und `"pushOptional": true` bietet ihn außerdem als „Eldritch Blast (no push)“ an: Repelling Blast. Eine Reichweite oder ein Stoß braucht `combat.distance`, und der genannte Eintrag muss existieren. Braucht Capability API 1.302.

Nutzungen nur in bestimmtem Licht und Zustände, die Bewegung oder Handeln beendet (Capability API 1.303). Ein Eintrag mit `"usableIn": { "light": ["dark", "dim"] }` wird nur angeboten, solange sein Nutzer in einem dieser Lichter steht: One with Shadows. Das `endsWhenHolder` eines Zustands kann neben `attacks` und `casts` auch `"moves": true` angeben (er endet, wenn sein Betroffener sich bewegt) oder `"acts": true` (er endet, wenn sein Betroffener eine Aktion nimmt, angreift oder wirkt): Die Schatten verbergen einen Hexenmeister, der stillhält. Braucht Capability API 1.303.

Einmal pro Kreatur bis zu einer Rast (Capability API 1.304). Ein Eintrag mit `"oncePerTarget": { "until": "long" }` (eine Rast, die der Regelsatz deklariert) wird gegen eine Kreatur, gegen die er bereits genutzt wurde, nicht angeboten, bis sein Nutzer diese Rast macht, egal wie viele Kämpfe dazwischen liegen: Chains of Carceri. Gegen wen er genutzt wurde, wird namentlich auf dem laufenden Bogen des Nutzers festgehalten, und nur diese Rast löscht es. Nicht an einer Fläche oder einem Eintrag, der auf seinen Nutzer gerichtet ist. Braucht Capability API 1.304.

Ziele, die mit dem Bogen wachsen, und dasselbe Ziel erneut (Capability API 1.305). `"targetsScale": { "from": { "field": "level" }, "table": [[1, 0], [5, 1], [11, 2], [17, 3]] }` fügt bei jeder Stufe des gelesenen Werts so viele Ziele hinzu, so wie `scales` Würfel hinzufügt. Mit `"targetsRepeat": true` darf dasselbe Ziel mehr als einmal gewählt werden, und jede Wahl ist ein eigener Angriff mit eigenem Wurf, der alles trägt, was den Eintrag verändert: die Strahlen von Eldritch Blast, jeder mit dem Schaden von Agonizing Blast und dem Stoß von Repelling Blast. Die Zielauswahl des Kampfes fügt pro Klick einen Strahl hinzu, solange Platz ist, und die Engine legt, wenn sie einen Kampfbeteiligten spielt, übrige Strahlen auf das Ziel, das sie gewählt hat. Keines von beiden gibt es an einer Fläche oder einem Eintrag, der auf seinen Nutzer gerichtet ist. Braucht Capability API 1.305.

Eine Waffe in die Hand gelegt (Capability API 1.306). Ein `"utility"`-Eintrag mit `"conjures": { "items": ["gear/longsword", ...], "proficient": true, "qualities": ["magical"], "binds": { "tags": ["magic"] } }` legt seinem Nutzer für den Rest des Kampfes eine dieser Nahkampfwaffen in die Hand, beim Nutzen gewählt wie der Modus einer Waffe; `binds` bietet außerdem jede gehaltene Waffe an, auf die es passt und die dann als diese zählt. Mit `proficient` wird sie mit Übung genutzt, und ihre Schläge tragen `qualities`. Eine weitere Nutzung ersetzt sie, und eine gebundene Waffe wird wieder, was sie war. Veränderungen des herbeirufenden Eintrags erreichen die Waffe: Das `"damagePlus": { "add": { "abilityMod": "cha" }, "type": "necrotic", "atLeast": 1 }` einer Veränderung fügt bei einem Treffer Schaden eigener Art hinzu (Lifedrinker), und `"strikes": 2` lässt einen Verbrauch des Angriffsbudgets so viele Angriffe kaufen (Thirsting Blade). Spielt die Engine einen Kampfbeteiligten, legt sie ihm einmal die Waffe in die Hand, die am härtesten trifft. Braucht Capability API 1.306: Pact of the Blade.

Was sein eigener Nutzer hält (Capability API 1.307). Die eigene Aktion einer Kreatur kann wie ein Katalogeintrag `"concentration": true` angeben: Was sie auferlegt, endet, wenn diese Konzentration endet, und Schaden prüft sie wie üblich. Die Invisibility eines Imps oder eines Quasits. Das `endsWhenHolder` eines Zustands kann auch `"uses": ["scare", "spells/bolt"]` angeben: Er endet, wenn sein Betroffener eines davon nutzt, die eigenen Aktionen einer Kreatur per ID oder Katalogeinträge als `<catalog>/<entry>`. Die Unsichtbarkeit eines Quasits endet, wenn er sein Scare nutzt. Das `"appliesSelf": [{ "condition": "mote", "duration": { "rounds": 10 } }]` eines Eintrags legt diese Zustände beim Nutzen seinem eigenen Nutzer auf, egal was mit seinen Zielen geschieht, gehalten durch seine Konzentration, wenn er eine hat, auf der Stufe, auf der er gewirkt wurde: der Lichtfleck von Sunbeam, ein Kampfzustand mit `light` und `"actions": ["spells/sunbeam-line"]` für die späteren Strahlen. Eine Kreatur, die immer unsichtbar ist, braucht nichts Neues: `keepsOn: ["invisible"]` (1.263) hält das aufrecht. Braucht Capability API 1.307.

Übrig gebliebenes aus 1.303 bis 1.306 (Capability API 1.308). Das `use` einer Schriftrolle oder eines Zauberstabs kann `targetsScale` und `targetsRepeat` tragen, gelesen vom Bogen seines Nutzers: Eine Schriftrolle mit Eldritch Blast feuert ab der 5. Stufe ihres Lesers einen Strahl mehr ab, und die Geschosse eines Zauberstabs dürfen alle auf eine Kreatur gehen. Braucht Capability API 1.308. Drei Änderungen brauchen keinen neuen Schlüssel. Eine Reaktion ist Handeln: Ein Zustand, dessen `endsWhenHolder` `"acts": true` angibt, endet auch bei jeder Reaktion seines Betroffenen, so wie One with Shadows bei „einer Reaktion“ endet. `oncePerTarget` unterscheidet zwei Kreaturen gleichen Namens: Chains of Carceri auf einem Imp lässt den anderen Imp frei, und der Imp eines späteren Kampfes ist nur gesperrt, wenn der Name zu genau dieser einen Kreatur gehörte. Eine in die Hand gelegte Waffe (1.306) kann eine Nahkampfwurfwaffe sein (ein Angriff mit `reach` und `range`, etwa ein Dolch oder ein Wurfspeer). Sie wird ohne Aktion über das Menü des Kampfes entlassen und verschwindet, wenn ihr Urheber stirbt. Sie ist nie mehr als 5 Fuß von ihrem Urheber entfernt, weil ein Kampf sie ihm nie aus der Hand nimmt.

Was das Verstecken braucht, Feral Senses, Überraschung und das Bindungsritual (Capability API 1.309). Ein `hiding` mit `still` kann `"stillWhile": { "holds": "camouflaged", "wall": true }` angeben: Der Bonus zählt nur, solange sein Besitzer diesen Zustand hat (die vorher angelegte Tarnung, mit einem einminütigen Hilfseintrag oder vor dem Kampf gesetzt) und mit `wall` neben einer Zelle steht, die die Sicht blockiert. Das ist Hide in Plain Sight. `"unseenStrikes": true` nimmt den Nachteil beim Angriff auf jemanden weg, den sein Besitzer nicht sehen kann; das ist die erste Hälfte von Feral Senses. Die zweite Hälfte braucht nichts, weil ein Kampf bereits weiß, wo jede Kreatur ist, die nicht versteckt ist. Das `hiding` einer Kreatur mit `starts` kann `"surprises": true` angeben: Wer sie versteckt beginnt, beginnt den Kampf überrascht, wie bei Transparent eines Gallertwürfels. Ein `conjures` mit `binds` kann in `"boundIn"` ein laufendes Textfeld nennen: Nur die gehaltene Waffe, die dort eingetragen ist, wird gebunden, und keine, solange es leer ist. Den Namen dort einzutragen ist das stundenlange Ritual, das außerhalb des Kampfes während einer kurzen Rast vollzogen wird. Braucht Capability API 1.309.

Wiederholungen und Zustände, die auf Entfernung enden (Capability API 1.310). Die Mechanik eines Konzentrationseintrags kann `"repeats": { "budget": "action" }` angeben: Solange sich ihr Nutzer darauf konzentriert, wird ihre Wirkung auf diesem Budget erneut angeboten, kostet nichts vom Bogen, beginnt keine neue Konzentration und legt ihrem Nutzer nichts erneut auf, auf der Stufe und der Kostenstufe, zu der das Wirken bezahlt wurde. Das Menü zeigt sie als „Vampiric Touch again“. `"notSaved": true` bietet sie nie gegen eine Kreatur an, die einen Rettungswurf gegen dieses Wirken geschafft hat (Eyebite), und `"sameTargets": true` bietet sie nur gegen die an, auf die das Wirken gerichtet war (Heat Metal, auf einer Bonusaktion). `repeats` braucht `concentration` und ein bekanntes Budget. Ein `applies` kann `"endsAway": { "beyond": 60, "unseen": true }` angeben: Der Zustand endet, sobald sein Betroffener weiter als so weit von dem entfernt steht, der ihn auferlegt hat, und ihn mit `unseen` nicht sehen kann. Das ist die Panik von Eyebite. Das wird bei jedem Schritt eines Gangs geprüft, egal wessen, und am Ende jedes Zuges. Braucht Capability API 1.310.

Übrig gebliebenes aus 1.307 und 1.309 (Capability API 1.311). Das `use` eines Gegenstands kann wie die Mechanik eines Eintrags `appliesSelf` tragen: Eine Schriftrolle mit Sunbeam lässt den Lichtfleck und damit die späteren Strahlen in der Hand ihres Lesers, gehalten durch die Konzentration des Lesens. Die Aktion einer Kreatur kann `"dyingOnly": true` angeben (nur eine Kreatur ohne Gesundheit, die noch lebt, darf gewählt werden), `"slaysOnFailedSave": true` (ein Ziel, das den eigenen Rettungswurf der Aktion nicht schafft, stirbt) und `"healsOnSlay": { "dice": "3d6" }` (die Kreatur erhält für jedes, das stirbt, so viel zurück). Das ist Consume Life eines Irrlichts. `slaysOnFailedSave` braucht ein `save`, und `healsOnSlay` braucht `slaysOnFailedSave`. Eine Regel in `combat.conditions` kann `"endsWhenHolder": { "moves": true, "acts": true }` angeben: Der Zustand verschwindet von seinem Betroffenen und von dessen Bogen bei seinem ersten Schritt (`moves`) oder bei allem, was er tut, außer Hide, einschließlich Reaktionen (`acts`), egal wie er auferlegt wurde. Das ist die Tarnung von Hide in Plain Sight, vor dem Kampf auf dem Bogen angekreuzt. Braucht Capability API 1.311.

Ein Donnerschlag um einen Treffer (Capability API 1.312). Der Modus einer Waffe kann `"aroundHit": { "within": 30, "save": { "save": "con_save", "difficulty": 17 }, "condition": "stunned", "rounds": 1, "of": "source" }` angeben. Ein Treffer in diesem Modus lässt den Getroffenen und jeden, der innerhalb von `within` um ihn steht, einen Rettungswurf ablegen oder `condition` erhalten. Das schließt Verbündete und den Träger ein, wenn sie so nah stehen. `rounds` zählt ihre eigenen Züge oder mit `of: "source"` die des Trägers; `rounds: 1, of: "source"` ist also „bis zum Ende deines nächsten Zuges“. `of` braucht `rounds`. Ohne Brett legt nur der Getroffene einen Rettungswurf ab. Zusammen mit `range` und `charges` des Modus ist das ein Hammer of Thunderbolts, für eine Ladung geschleudert. Sein Giant's Bane ist das `slay` der Waffe mit `when: "critical"`. Braucht Capability API 1.312.

Maze, Expeditious Retreat, die Wahlmöglichkeiten eines Wirkens und begrenzte Attributserhöhungen (Capability API 1.313). Ein `dismisses` mit `while` kann `"turns": true` angeben. Die Kreatur ist aus dem Kampf, nimmt aber weiterhin ihre Züge, und in ihnen wird ihr nur angeboten, was den Zustand beendet, der sie fernhält, oder das Beenden des Zuges. Ein `applies` kann `"checkEnds": { "check": "intellect", "difficulty": 20, "passes": { "types": ["monstrosity"] } }` tragen: Sein Betroffener darf das Standardbudget für diese Probe aus `combat.checks` gegen die Zahl ausgeben, um ihn zu beenden. Eine Kreatur, die `passes` entspricht, schafft es ohne Wurf. Zusammen sind das Maze in 5e und sein Minotaurus, der wieder dort ist, wo er war, wenn die Probe gelingt. Die Mechanik eines Eintrags kann `"takes": ["dash"]` (oder `disengage`, `dodge`) angeben, und ihr Nutzer nimmt diese Standardaktionen beim Nutzen: Expeditious Retreat sprintet beim Wirken. Die späteren Sprints als Bonusaktion stammen aus dem `grants` seines Zustands. Ein `repeats` kann eine `group` nennen: Einträge einer Gruppe sind die Wahlmöglichkeiten eines Wirkens, und solange sich auf irgendeinen von ihnen konzentriert wird, wird jeder davon erneut angeboten. `notSaved` und die Stufe des Wirkens werden geteilt, wie bei schlafend, panisch und krank durch Eyebite. Die Attributsänderung `{ "add": 4, "max": 30 }` eines Gegenstands kommt zu dem Wert hinzu, den jedes `set` übrig lässt, bis zu `max`, und senkt nie einen Wert, der bereits darüber liegt. Ohne `max` funktioniert eine Addition wie bisher. Das `"binds": { "needsWorn": [{ "anyOf": ["magic_items/belt-of-hill-giant-strength", ...] }, { "anyOf": ["magic_items/gauntlets-of-ogre-power"] }] }` eines Gegenstands lässt ihn nur binden, solange derselbe Charakter einen Gegenstand jeder Gruppe trägt, gebunden, wo dieser Gegenstand gebunden wird, und löst die Bindung, sobald einer davon abgelegt, gelöst wird oder seine Tasche verlässt. Mit `"worn": { "abilities": { "str": { "add": 4, "max": 30 } } }` ist das ein Hammer of Thunderbolts. Braucht Capability API 1.313.

Resilient Sphere (Capability API 1.314). Ein Eintrag in `combat.conditions` kann `"sealed": { "rolls": { "budget": "action", "share": 0.5 }, "lifted": { "budget": "action" }, "brokenBy": ["spells/disintegrate"] }` tragen. Solange der Zustand besteht, ist sein Betroffener von allen anderen abgeschlossen. Niemand sonst kann etwas auf ihn richten, eine Fläche oder Kreisfläche geht an ihm vorbei, und nichts von jemand anderem schadet ihm, heilt ihn oder legt ihm einen Zustand auf, einschließlich Zonen und Auren. Auch nichts von ihm erreicht jemand anderen, und niemand greift ihn an, wenn er sich bewegt, noch er jemanden. Seine eigene Bewegung ist null, aber mit `rolls` darf er dieses Budget ausgeben, um sich bis zu `share` seiner Geschwindigkeit zu bewegen. Mit `lifted` darf jemand, der neben ihm steht, dieses Budget ausgeben, um ihn hochzuheben. Danach geht der Betroffene überall hin, wohin der Tragende geht, bis dieser ihn kostenlos absetzt oder der Zustand endet. Die Einträge in `brokenBy` dürfen weiterhin auf den Betroffenen gerichtet werden, und statt zu tun, was sie tun, beenden sie den Zustand und die Konzentration, die ihn hält: Disintegrate auf die Kugel. Die Mechanik eines Eintrags kann `"targetsUpTo": "large"` angeben, eine der `combat.sizes`, und er wird dann nur auf Kreaturen dieser Größe oder kleiner gerichtet. Das ist das „Größe Large oder kleiner“ von Resilient Sphere. Braucht Capability API 1.314.

Hortaktionen (Capability API 1.315). Eine Kreaturenaktion kann `"lair": true` tragen und die Kreatur `"lairInitiative"` (ohne Angabe 20). Solange die Kreatur in ihrem Hort kämpft (das `"inLair": true` des Game Master an diesem Gegner oder die `inLair`-Liste einer Begegnung), nimmt sie eine Hortaktion pro Runde, wenn der Zähler des Kampfes die Zahl ihres Horts passiert, und verliert Gleichstände: zwischen den beiden Zügen, zwischen die diese Zahl fällt, nach dem letzten Zug der Runde, wenn alle bei dieser Zahl oder darüber stehen, oder vor dem allerersten Zug, wenn alle darunter liegen. Sie darf nicht zwei Runden hintereinander dieselbe Hortaktion nehmen. Eine Hortaktion wird wie im eigenen Zug gezielt und aufgelöst, mit ihrem dafür geliehenen `budget`, und verbraucht nichts vom eigenen Zug der Kreatur. Sie steht nie im Menü des eigenen Zuges der Kreatur und wird nicht genommen, solange die Kreatur am Boden liegt oder nicht handeln kann. Eine Hortaktion ist weder eine Reaktion noch mit Punkten gekauft, eine Folge nennt nie eine, und `lairInitiative` braucht mindestens eine Hortaktion. Die Drachen in 5e nehmen ihre bei Initiativezähler 20.

Requisiten (Capability API 1.316). Auf dem Brett eines Kampfes können Requisiten stehen, die zerstört werden können: das `board.props` einer Begegnung oder die gemalten `props` eines Weltschlachtfelds. Jede hat ein `label`, die `cells`, die sie füllt, ihre `health`, eine `defense` (ohne Angabe 10) und optional Schadensarten für `resist`, `vulnerable` und `immune`. `blocks` sperrt ihre Zellen, solange sie steht, für Bewegung (`move`), für Sicht (`sight`) oder für beides, und niemand beginnt den Kampf darin. Eine `fragile` Requisite wird durch alles zerstört, was sie trifft. Ein Angriff, der den Abschnitt einer Wand treffen darf, darf stattdessen eine Requisite treffen: Sie wird unter den `walls` der Option aufgeführt, und das `wall` der Auswahl nennt ihre Zelle. Eine Fläche erfasst jede Requisite, die sie erreicht, und verursacht denselben Schaden, den sie für alle anderen würfelt; eine Requisite legt nie einen Rettungswurf ab. Eine Requisite bei 0 ist zerstört: Sie sperrt nichts mehr, und ihre Beschriftung kommt auf die `broken`-Liste des Bretts, in die Zusammenfassung des Kampfes und in den Rückblick, den der Game Master liest (`Broken: Sluice Gate; Oil Jar`). Der `broke`-Auslöser einer Geschichte löst dabei aus.

Legendary Resistance (Capability API 1.317). Das `"legendaryResistance": 3` einer Kreatur verwandelt ihre ersten drei misslungenen Rettungswürfe in einem Kampf in Erfolge, „Misslingt dem Drachen ein Rettungswurf, kann er stattdessen entscheiden, dass er gelingt“ (3/Tag) in 5e. Die Engine entscheidet sich immer dafür, bei jedem Rettungswurf, auch bei einem, den ein Zustand ohne Wurf scheitern lässt; nie, solange die Kreatur am Boden liegt. Der Rettungswurf wird wie gewürfelt protokolliert, gefolgt von einer Zeile, die sagt, dass er stattdessen gelungen ist und wie viele noch übrig sind. Eine ganze Zahl von 1 bis 20.

Auch die Nutzung eines Gegenstands kann `"targetsUpTo"` tragen (Capability API 1.317), so wie die Mechanik eines Eintrags seit 1.314: Das `"targetsUpTo": "large"` einer Schriftrolle mit Resilient Sphere erreicht nur eine Kreatur dieser Größe oder kleiner. Es liest `combat.sizes` und ist für eine Nutzung gedacht, die auf eine Kreatur gerichtet ist, nicht auf eine Fläche.

Brettereignisse und Bewuchs (Capability API 1.318). Das Brett eines Kampfes kann sich im Laufe der Runden von selbst verändern: die `board.events` einer Begegnung oder die gemalten `events` eines Weltschlachtfelds. Jedes Ereignis hat eine `id`, ein optionales `label` und geschieht `at` `"round-start"` oder `"round-end"`, `from` einer Runde (ohne Angabe 2 bei Rundenbeginn, 1 bei Rundenende), `every` so viele Runden (1) und `until` einer Runde, wenn es das angibt. `where` nennt seine Zellen: `cells`, einen `block` (`x`, `y`, `w`, `h`), einen `ring` um eine Zelle (`x`, `y`), der beim ersten Mal `start` Felder weit reicht und danach jedes Mal `step` Felder weiter, ein `sweep` von einem Rand herein (`from` `north`, `south`, `east` oder `west`) mit denselben `start` und `step` oder `{"spread": "growth"}`, jede freie Zelle neben Bewuchs. Ein Ring oder Sweep erreicht nur sein neuestes Band, `step` Felder tief (mindestens eines), auch beim ersten Mal; ein Ring mit `start` 3 lässt seine Mitte also in Ruhe. `filled` erreicht alles darin. `onlyOn` beschränkt es auf Zellen dieser Geländearten. `change` sagt, was dort geschieht, mindestens eines davon: `terrain`, `height` (0 bis 3), `light` (`bright`, `dim`, `dark`, `sunlight` oder `clear`), `obscured` (`light`, `heavy` oder `clear`), `growth` (true oder false), `season` (ein Name oder null, um sie zu entfernen), `rotate` (nur ein quadratischer `block`, 1, 2 oder 3 Vierteldrehungen im Uhrzeigersinn gedreht, mit seinen Feldern, Höhen, seinem Boden, den Requisiten, die ganz darin liegen, und allen, die ganz darin stehen) und `tell`, die Zeile, die das Protokoll anstelle der einfachen sagt. Wer dort stehen bleibt, wo niemand stehen darf (zu Wasser zerbrochenes Eis), wird auf die nächste freie Zelle gesetzt. Ein Brett fasst bis zu 32 Ereignisse.

Mitgerissen (Capability API 1.329). Das `change` eines Brettereignisses kann auch `push` angeben, `{"toward": "east", "squares": 3}` (ein Rand, `north`, `south`, `east` oder `west`, und 1 bis 6 Felder): Wer auf seinen Zellen auf dem Boden steht, wird Feld für Feld in diese Richtung mitgerissen, nie vom Brett, in eine Wand oder eine geschlossene Requisite, auf Boden, auf dem niemand stehen darf, oder in jemand anderen, und niemand greift ihn dafür an. Wer diesem Rand am nächsten ist, geht zuerst, und wer in der Luft ist, bleibt unberührt. Das Protokoll nennt, wen es mitgerissen hat. Der Mühlgraben der Mill of Hours. Oder `drift` in derselben Form: Was seine Zellen verdeckt (leicht oder schwer), wird in diese Richtung geweht und kommt auf der anderen Seite seines `block` wieder herein oder, bei jedem anderen `where`, auf der anderen Seite des Bretts; sonst bewegt sich nichts auf den Zellen, und schwere Verdeckung bleibt, wo leichte auf sie geweht wird. Die Verwehungen des Leaffall. Die gemalten Ereignisse eines Schlachtfelds nehmen beides an.

Bewuchs auf einer Zelle kostet beim Betreten doppelt (nicht mehr als anderes schwieriges Gelände) und verdeckt leicht, wer darin steht. Ein Schlag, dessen Schadensart Bewuchs schneidet (Hiebschaden, sofern das `growth.cutBy` des Bretts nichts anderes sagt), kann auf eine Zelle mit Bewuchs gerichtet werden, die er erreicht, aufgeführt unter den `walls` der Option: Er räumt diese Zelle ohne Wurf und verbraucht die Aktion. Schaden einer Art, die Bewuchs verbrennt (Feuer, sofern `growth.burnedBy` nichts anderes sagt), brennt ihn auf jeder Zelle weg, auf der er landet, auf der ganzen Reichweite einer Fläche oder auf der Zelle dessen, den er trifft. Die Mechanik eines Eintrags oder die Nutzung eines Gegenstands mit `"clears": "growth"` und einer `area` räumt Bewuchs aus dieser Fläche: eine Astschere, `{"kind": "utility", "area": {"shape": "box", "size": 15}, "clears": "growth"}`. Das `board.ground` einer Begegnung malt Bewuchs, Licht, Verdeckung und Jahreszeiten zu Beginn auf Zellen; ein Weltschlachtfeld malt Bewuchs als `growth`-Zeilen aus `g` und `.` und seine Jahreszeiten so, wie Experiences es tun.

Schatten, Lichtregeln, Windspiele und Lichtscheue (Capability API 1.319). Ein Licht mit `"shade": true` spendet Schatten: dämmriges Licht, so weit sein `dim` reicht, und helles Licht und Sonnenlicht sind dort ebenfalls dämmrig, egal was sie sonst erhellt. Es hat kein helles Licht und ist weder `reveals` noch `sunlight`. Schatten reicht nie in magische Dunkelheit hinein. Die Lantern of Dusk aus dem Showcase-Beispiel ist ein mitgeführter Gegenstand mit `{"light": {"bright": 0, "dim": 15, "shade": true}}`. Das eigene Licht einer Zelle (1.318) und Schatten sind auch das, was Augen dort lesen: Auf einem hellen Brett wird eine Kreatur, die in einer dunklen Zelle steht, nur von einem Sinn gesehen, der im Dunkeln sieht.

Das Brett eines Kampfes kann eine Lichtregel haben: das `board.lightRule` einer Begegnung oder das gemalte `lightRule` eines Weltschlachtfelds. Am Ende jeder Runde zählt jeder, der ganz in einem ihrer Lichter steht (`in`, ohne Angabe helles Licht und Sonnenlicht; helles Licht schließt Sonnenlicht ein), dort ein weiteres Rundenende, und bei jedem `rounds`-ten (ohne Angabe 1) verschieben sich seine `tracks` um `by`, und ihre `applies`-Zustände werden ihm auferlegt. Wer heraustritt, selbst nur in den Schatten einer Zelle, beginnt die Zählung von vorn. `spares` nennt die Kreaturen-`types` und `tags`, die sie nie berührt. Eine Regel, die keine Leiste verschiebt, die der Bogen hat, und keinen Zustand auferlegt, den der Kampf kennt, bewirkt nichts und wird verworfen. Noonfield ist `{"label": "Noonfield", "rounds": 10, "tracks": [{"track": "exhaustion", "by": 1}]}`: eine Erschöpfungsstufe pro Minute in der Sonne.

Rettungswürfe gegen Lichtregeln (Capability API 1.321). Das `save` einer Lichtregel (`save`, `difficulty`) wird von jeder Kreatur gewürfelt, die sie gleich berühren wird, und ein geschaffter Rettungswurf entgeht ihr dieses Mal; die Zählung beginnt so oder so von vorn. Ihr `against` (`conditions`, die der Kampf kennt, `damage`-Arten) gibt an, wogegen der Rettungswurf zählt, sodass ein Rettungswurfmodifikator mit passendem `against` gilt: ein getragener oder mitgeführter Strohhut mit `{"to": "saves", "mode": "advantage", "against": {"conditions": ["noon_light"]}}`. Das `upTo` eines Leisteneintrags ist, wie weit die Regel die Leiste verschiebt; Erschöpfung, die darüber hinausginge, hält also dort an, und sobald es erreicht ist, kommt gar keine mehr hinzu. Noonfield, wie geschrieben: `{"label": "Noonfield", "rounds": 10, "tracks": [{"track": "exhaustion", "by": 1, "upTo": 3}], "save": {"save": "con_save", "difficulty": 12, "against": {"conditions": ["noon_light"]}}}`, mit einem Zustand `noon_light`, den die Experience ergänzt, damit der Hut ihn nennen kann.

Gegenstandsnutzungen als Reaktionen (Capability API 1.322). Das `use` eines Gegenstands (oder eines seiner `moreUses`) kann eine `reaction` tragen, angegeben wie bei einem Katalogeintrag, und wird dann nur angeboten, wenn sich dieser Moment öffnet, bezahlt aus `budget` (der Reaktion des Trägers) und aus seinen Ladungen oder dem Gegenstand selbst wie jede Nutzung. Liesl's Coffin, einmal am Tag, wenn eine Kreatur innerhalb von 5 Fuß um seinen Träger getroffen wird, +5 AC auf sie bis zum Beginn des nächsten Zuges des Trägers, auch gegen diesen Treffer: `{"kind": "buff", "budget": "reaction", "targets": "any", "charges": 1, "reaction": {"on": "hit", "at": "target", "for": "any", "within": 5}, "applies": [{"condition": "coffin_ward", "duration": {"rounds": 1, "at": "turn-start", "of": "source"}}]}` an einem Gegenstand mit `"charges": {"max": 1, "recharge": {"rests": ["long"], "amount": "max"}}`. Der Straw Proxy, ein auf seinen Besitzer gerichteter Angriff verloren und der Stellvertreter verbrannt: `{"kind": "buff", "budget": "reaction", "targets": "self", "consumes": true, "reaction": {"on": "aimed", "cancels": true, "for": "self"}}`. Die Nutzung eines Gegenstands nennt ihren Moment: `"reaction": true` wird abgelehnt.

Held Ground und Ernten (Capability API 1.323). Ein Kampf kann auf Held Ground ausgetragen werden, einem Ort, an dem der Tod festgehalten wird: das `heldGround` des Kampfes (`label`, eine `condition` und `marks` als `[{"track", "by"}]`), das ihm die Regionsregel der Geschichte übergibt. Dort wird jeder, der keine Gesundheit mehr hat, gefällt, statt zu sterben oder zu Boden zu gehen: Ein Gegner scheidet aus dem Kampf aus; ein Charakter liegt stabil, würfelt nie, um zu sterben, und erhält keine Fehlschläge durch Verletzungen und kann wie üblich geheilt werden. Die Gefällten erhalten ihre `condition` (und ein Charakter den eigenen Zustand des Regelsatzes für am Boden liegen), und jeder mit einem Bogen verschiebt seine `marks`-Leisten: das Owing-Mal aus dem Showcase-Beispiel. Was sofort töten würde, fällt stattdessen. Ein Schlag mit `reaps`, an der Aktion einer Kreatur oder am Angriff eines Gegenstands, erntet jeden, den er fällt: Diese bleiben am Boden, erhalten keinen Zustand und kein Mal, und ein geernteter Charakter ist tot. Der Reaping Hook ist eine Waffe, deren `attack` `"reaps": true` hat. Gefällte und geerntete Kampfbeteiligte tragen `felled` und `reaped`, damit die Geschichte die Gefällten später wieder aufrichten kann.

Held Ground aufgegeben (Capability API 1.330). Die Geschichte kann Held Ground mitten in einem Kampf aufgeben, wenn sich das Jahr wendet: das `releaseRulesetHeldGround(definition, state, release)` der Kampfsteuerung (darunter das gemeinsame `rulesetReleaseHeldGround`). Von da an stirbt jeder, der keine Gesundheit mehr hat, oder geht zu Boden wie überall sonst. Die Gefällten, die nicht geerntet wurden, sterben, Gegner wie Charaktere, sofern `release.felled` nicht `"down"` ist; dann geht ein Charakter stattdessen zu Boden und beginnt nach der eigenen Regel des Regelsatzes zu sterben. Mit `release.owing` (`{"track"?, "bonus"?}`, die Leiste ohne Angabe die erste markierte von Held Ground) werden die Male jedes Charakters darauf fällig: einer der Todesrettungswürfe des Regelsatzes pro Mal, jeweils mit `bonus` addiert (die Debts Settled der Gruppe), gewürfelt, bis die Male aufgebraucht sind oder die Zählung entschieden ist, mit natürlichen Augenzahlen, wie die Sterberegel es sagt; danach sind die Male verbraucht. Drei Fehlschläge (das obere Ende der Fehlschlagleiste) bedeuten den Tod. Das Protokoll nennt, wer gestorben ist, wer zu Boden gegangen ist, und die Würfe jedes Charakters. Ein Kampf, der nicht auf Held Ground stattfindet, bleibt, wie er war.

Kreaturenflächen und Boden (Capability API 1.324). Eine Kreaturenaktion mit `area` kann diese Fläche mit `zone` stehen lassen, geschrieben wie die Zone eines Katalogeintrags (`rounds`, `triggers`, `obscures`, `terrain` und die übrigen): der Freezing Fog von The Owed, der Mehlwürfel von Scatter Flour, der Boden, der zu schwierigem Gelände gefriert. Eine Zone mit `"untilLair": true` endet außerdem, wenn der Hortzähler ihres Urhebers das nächste Mal an der Reihe ist, bevor diese Hortaktion gewählt wird, sofern ihre `rounds` sie nicht vorher beendet haben: „bis zur nächsten Hortaktion“. Eine Kreaturenaktion kann stattdessen mit `ground` den Boden, den ihre Fläche bedeckt, dauerhaft verändern, angegeben wie das `change` eines Brettereignisses (`terrain`, `height` 0 bis 3, `light`, `obscured`, `growth`, `season` und ein `tell` für das Protokoll): Das Lagerfeuer erlischt (`"light": "dark"`), das Eis bricht (`"terrain": "water"`); wer auf einer Zelle zurückbleibt, auf der niemand stehen darf, wird auf die nächste freie gesetzt. Beides braucht die `area` der Aktion, und ein `ground` verändert etwas. Ein Regelsatz, der eines davon oder irgendwo `untilLair` verwendet, braucht Capability API 1.324.

In einen Kampf gerufene Kreaturen (Capability API 1.325). Eine Kreaturenaktion kann `"calls": { "creature": "creatures/zombie", "count": { "dice": "1d4" } }` angeben: Beim Einsatz treten so viele der genannten Bestiariumkreatur (ein `"<catalogId>/<entryId>"` aus den Katalogen des Regelsatzes oder dem Bestiarium, das dem Kampf übergeben wurde; `count` ist `{"dice"}`, `{"flat"}` oder beides, jedes Mal höchstens acht) auf der Seite ihres Nutzers in den Kampf ein, gebaut, wie der Kampf seine eigenen gebaut hat, und einzeln benannt („Zombie 1“, „Zombie 2“). Mit einer `area` werden sie dort abgesetzt, wohin sie gezielt ist, und so nahe daran, wie Platz ist, sobald sie voll ist; ohne Fläche neben ihrem Rufer, und die Aktion ist auf niemanden gerichtet. Sie würfeln ihre eigene Initiative und nehmen ihren Platz in der Reihenfolge ein: Ein Platz, den die Züge dieser Runde schon passiert haben, ist einer der nächsten Runde. Mit `"initiative": "after"` kommen ihre Züge stattdessen direkt nach dem ihres Rufers. Eine Hortaktion kann rufen (Shelves Lean), und der Zug, zwischen den ihr Zähler fiel, geht weiter, wie er war. Eine Kreatur, die beim Beginn des Kampfes nirgends gefunden wird, ruft niemanden, und ein Kampf fasst höchstens 40. Das Protokoll nennt, wer gekommen ist. Ein Regelsatz, der `calls` verwendet, braucht Capability API 1.325.

Zu einer Kreatur hingezogen (Capability API 1.326). Eine Kreaturenaktion kann `"draws": { "spends": "reaction" }` angeben: Wen sie trifft (mit einem `save` nur bei einem misslungenen), der verbraucht sofort dieses Budget, um bis zu seiner Geschwindigkeit auf die Kreatur zuzugehen, auf dem offenen Weg zu der erreichbaren Zelle, die ihr am nächsten liegt, ohne Angriffe auf sich zu ziehen. Wer nichts mehr von diesem Budget hat oder nicht näher kommen könnte, verbraucht nichts und bleibt. Whisper a Name von The Owed. `spends` ist eines der Budgets der Aktionsökonomie. Ein Regelsatz, der `draws` verwendet, braucht Capability API 1.326.

Hort-Timing (Capability API 1.327). Eine Kreaturenaktion mit `"actedOnly": true` darf nur auf jemanden gerichtet werden, der in dieser Runde seinen Zug bereits begonnen hat, einschließlich dessen, der gerade läuft; vor dem allerersten Zug des Kampfes, während ein Hort vor allen anderen handelt, hat das niemand. Das ist das „eine Kreatur, die in dieser Runde bereits gehandelt hat“ der Hour Bell. Die Dauer eines Zustands kann zu ihren `rounds` `"untilLair": true` ergänzen: Er endet außerdem, wenn der, der ihn auferlegt hat, das nächste Mal den Zähler seines Horts erreicht, bevor diese Hortaktion gewählt wird („bis zur nächsten Hortaktion“ der Hour Bell). Eine Kreaturenaktion, die durch ihre `concentration` gehalten wird, kann `"brokenNextLair"` nennen, eine ihrer eigenen Hortaktionen: Sobald diese Konzentration gebrochen ist (durch Schaden, durch Zu-Boden-Gehen oder durch das, was eine Zone bewirkt, nie dadurch, dass ihr Inhaber sie beendet oder eine andere beginnt), ist diese Hortaktion die nächste, die sie nimmt, und die einzige angebotene, egal was sie in der Runde davor genommen hat; ist sie genommen, ist die Wahl wieder frei. Litany of Keeping von Father Ivo und die sich neigenden Regale. Ein Regelsatz, der eines davon verwendet, braucht Capability API 1.327.

Durch einen Zustand verschobene Rettungswurfschwierigkeit (Capability API 1.328). Die Änderung `{ "to": "save-difficulty", "flat": -2 }` eines Zustands verschiebt die Schwierigkeit jedes Rettungswurfs, den sein Betroffener verlangt, solange er den Zustand hat: die eigenen Rettungswürfe seiner Aktionen und die angegebene Rettungswurfschwierigkeit für Rettungswürfe, die beenden, was diese Aktionen auferlegen. Sie nimmt einen `flat`-Betrag an und sonst nichts, und sie berührt nie die Schwierigkeit einer Probe, einen Konzentrationsrettungswurf (der durch den Schaden festgelegt wird) oder die Kreaturen, die eine Aktion in den Kampf ruft. Un-age des Miller of Hours: eine um 2 niedrigere Zauberrettungswurfschwierigkeit. Ein Regelsatz, der das verwendet, braucht Capability API 1.328.

Requisiten und Nähren (Capability API 1.331). Ein Kampfzustand kann `"whileNearProp": {"prop": "Year-Wheel", "within": 10}` angeben: Er gilt nur, solange sein Betroffener innerhalb dieser Entfernung (in der eigenen Einheit des Regelsatzes) um eine stehende Requisite des Bretts mit dieser Beschriftung steht, und ist überall sonst oder sobald diese Requisite zerstört ist, ausgesetzt, nicht beendet; ein Kampf ohne Brett hält ihn aufrecht. The Wheel's Favour. Die Kreisfläche (`area`) einer Kreaturenaktion kann `"aroundProp": "Shelf"` angeben: Wohin sie auch gezielt wird, sie bedeckt jede Zelle innerhalb ihrer `size` um eine stehende Requisite mit dieser Beschriftung, auch dahinter. Shelves Lean um die Regalreihen des Kornspeichers. Eine Aura kann `"feeds": 15` angeben: Ihr Betroffener erhält so viele Trefferpunkte zurück, wann immer jemand, den die Aura erreicht, gefällt wird, zu Boden geht oder getötet wird, und eine Aura darf auch nur das tun. Collector von The Owed. Ein Regelsatz, der eines davon verwendet, braucht Capability API 1.331.

Wieder entzünden, Einbrechen und Nutzungen neben einer Requisite (Capability API 1.332). Eine Requisite des Bretts (das `board.props` einer Begegnung oder eine auf einem Schlachtfeld gemalte) kann `"relight": {"light": "bright", "squares": 2, "budget"?: "action"}` angeben: Solange irgendeine Zelle innerhalb von `squares` um sie nicht in diesem Licht liegt, wie der Kampf es liest, wird jemandem, der neben ihr steht, für dieses Budget (ohne Angabe `action`) „Light it again“ angeboten, was jede dieser Zellen in dieses Licht taucht. Das Lagerfeuer von The Owed nach Bonfire Gutters. Der `ground` einer Kreaturenaktion kann mit seinem `terrain` `"occupants": "stay"` angeben: Wer dort steht, wo der Boden zu etwas wird, auf dem niemand steht, bleibt dort, durch das Eis ins Wasser eingebrochen, statt auf die nächste freie Zelle bewegt zu werden (`"shove"`, der Standard). Ein Katalogeintrag oder die Nutzung eines Gegenstands kann `"usableNear": {"prop": "Year-Wheel", "within": 5}` angeben: Er wird nur angeboten, solange sein Nutzer innerhalb dieser Entfernung um eine stehende Requisite steht, die per ID oder Beschriftung genannt ist, nie in einem Kampf ohne Brett. Fennick's Hymnal am Year-Wheel. Ab 1.332 nennen `whileNearProp`, `aroundProp` und `usableNear` eine Requisite alle auf dieselbe Weise: per ID (`"p1"`) oder über ihre lose gelesene Beschriftung, ohne Beachtung der Groß- und Kleinschreibung, eines führenden „the“ und von allem außer Buchstaben und Ziffern; `"Year-Wheel"` findet also eine Requisite mit der Beschriftung „The Year-Wheel“. Ein Regelsatz, der `usableNear` oder `occupants` verwendet, braucht Capability API 1.332.

Grafik für das Kampfbrett (Capability API 1.333). Das Brett eines Kampfes kann aus einem Brettpaket gezeichnet werden: PNG-Bögen auf einem Zellenraster (48 Pixel für den RPG-Maker-Look) mit Kacheln unter festen IDs, erstellt in Pixelforge und in der Bibliothek abgelegt (`POST /api/game-tile-packs/boards`). `bt_plains`, `bt_forest`, `bt_mountain`, `bt_ruin`, `bt_water` und `bt_wall` sind die Geländearten, jeweils bis zu acht Varianten, die pro Zelle gewählt werden, oder ein Muster, das größer als eine Zelle ist und über das Brett gelegt wird; `bt_edge_water` und `bt_edge_wall` sind Dual-Grid-Blöcke aus sechzehn Teilen, vier mal vier Zellen, angeordnet wie die `edge_`-Blöcke von Pixelforge, die Wasser und Wände in die angrenzende Ebene übergehen lassen; `bt_height1` bis `bt_height3` sind Ränder über erhöhtem Boden. `bo_dim`, `bo_dark`, `bo_sunlight`, `bo_fog_light`, `bo_fog_heavy`, `bo_growth`, `bo_ice` (eine Zelle im Winter), `bo_zone`, `bo_aim` und `bo_reach` werden anstelle der bisherigen Einfärbungen über eine Zelle gezeichnet. Das Sprite einer Requisite ist `bp_<name>` über ihre Zellen (`"art": "bp_bonfire"` an der Requisite oder, ohne Angabe, ihre Beschriftung in kleingeschriebenen, mit `_` verbundenen Wörtern ohne führendes „the“; „The Year-Wheel“ ist also `bp_year_wheel`) und `bp_<name>_broken`, sobald sie zerstört ist. Ein gemaltes Schlachtfeld oder das Brett einer Begegnung kann sein Paket mit `"pack": "local/<id>"` nennen; ohne Angabe wird es mit dem Paket der Bibliothek für seine Umgebung gezeichnet (das `environment` eines Pakets), dann mit dem eingebauten `board/<environment>` und dann wie bisher, und Requisiten werden außerdem im Requisitenpaket der Bibliothek (`"environment": "props"`) und dann im eingebauten `board/props` gesucht. Eine Kachel, die einem Paket fehlt, wird wie bisher gezeichnet. Eine Katalogzone kann `"art": "bz_<name>"` angeben: Jede Zelle, die sie bedeckt, wird mit dieser Kachel des Brettpakets gezeichnet, sonst mit `bo_zone`. Ein Regelsatz, der Zonen-`art` verwendet, braucht Capability API 1.333.

Mehr vom Zug durch einen Gegenstand (Capability API 1.334). Die Nutzung eines Gegenstands kann wie die Mechanik eines Katalogeintrags `"gives": [{"budget": "action", "count": 1}]` angeben (Action Surge): Ihre Nutzung gibt ihrem Nutzer sofort so viel mehr vom Zug, begrenzt dort, wo es ankommt, sodass nichts für später aufgespart wird. Der Time-Flour Loaf, als Bonusaktion gegessen, gibt jetzt eine Aktion mehr. Ein Regelsatz, der das verwendet, braucht Capability API 1.334.

Bei einer Rast ausgegebene Würfel (Capability API 1.335). Eine Rast kann `"dice": {"pool": "hit_dice", "die": {"field": "hit_die"}, "add": {"abilityMod": "con"}, "heals": "hp", "extra"?: {"die": {...}, "add"?: {...}}}` angeben: Das `[sheet: op="rest" rest="short" dice="2"]` des Game Master (oder eines für die ganze Gruppe) gibt dann zuerst so viele aus `pool` aus, würfelt jeden Würfel (`die` ist ein beliebiger Wert oder ein Enum-Feld, geschrieben als „d8“) plus `add`, nie unter 0 pro Würfel, und gibt so viel als nichtmagische Heilung an `heals` zurück, bevor die Rast tut, was sie angibt. `extra` ist ein weiterer Würfel für jeden, der überhaupt etwas ausgibt: Das Gruppenmitglied, dessen `die` die meisten Seiten liest, würfelt ihn für jeden, plus sein eigenes `add`. Song of Rest in 5e und die +1 auf jeden seiner Würfel von Pell's Brown Teapot als Gegenstandswert, den `add` liest. Ein Regelsatz, der Rast-`dice` verwendet, braucht Capability API 1.335.

Rastwürfel über mehrere Pools (Capability API 1.337). Das `"dice"` einer Rast kann eine Liste sein, ein Eintrag pro Pool, jeder mit eigenem `die`, `add`, `heals` und `extra`: `[{"pool": "hit_dice_d10", "die": {"const": 10}, ...}, {"pool": "hit_dice_d6", "die": {"const": 6}, ...}]`; ein Kämpfer 1 / Magier 1 gibt also einen d10 und einen d6 aus. `[sheet: op="rest" rest="short" dice="N" pool="hit_dice_d6"]` gibt nur aus diesem Pool aus; ohne `pool` kommen die Würfel aus dem ersten aufgeführten Pool, der welche hat, dann aus dem nächsten, und insgesamt zu wenige werden abgelehnt, ohne dass etwas ausgegeben wird. Der zusätzliche Würfel (Song of Rest) ist der des ersten Eintrags, der einen hat, einmal für die ganze Ausgabe gewürfelt, und er heilt, was der erste Pool, aus dem ausgegeben wurde, heilt; er kommt auch, wenn nur ein späterer Pool bezahlt. In einem Spiel lesen die Würfel einer Rast, was jeder Charakter mitführt; ein `itemStat` in `add` oder im `add` des zusätzlichen Würfels zählt also: Pell's Teapot, `{"itemStat": {"stat": "song_of_rest_add", "from": "carried", "pick": "max", "default": 0}}`. Ein Regelsatz mit einer Liste an dieser Stelle braucht Capability API 1.337.

Symbole (Capability API 1.338). Ein Katalogeintrag und ein Bogenzustand können ihr Symbol nennen, `"icon": "ic_poison_cloud"`: eine Kachel des Symbolpakets des Spiels (ein Brettpaket der Art `icons`; siehe packages/server/src/assets/board-packs/README.md). Ohne Angabe sucht die Engine den abgeleiteten Namen: bei einem Zustand `ic_cond_<id>`, bei einem Gegenstand `ic_item_<entry id>` (oder `ic_item_<name>` für einen, den der Game Master erfunden hat), bei jedem anderen Katalogeintrag `ic_<catalog id>_<entry id>` (`ic_spells_fireball`), Bindestriche als `_`. Ohne beides wird der bisherige Buchstabe oder Text angezeigt. Ein Regelsatz, der ein Symbol nennt, braucht Capability API 1.338.

Eine Liste von Hortaktionen für eine gebrochene Konzentration (Capability API 1.336). `"brokenNextLair"` kann statt einer eine Liste ihrer eigenen Hortaktionen sein, jede einmal: `["shelves_lean_north", "shelves_lean_south"]`. Sobald diese Konzentration gebrochen ist, ist die nächste Hortaktion eine davon und keine andere, egal was sie in der Runde davor genommen hat, und wer die Kreatur führt, wählt, welche. Eine Kreatur, die die Engine führt, nimmt die, die die meisten ihrer Gegner erfassen würde; zwischen gleichwertigen wägt sie ab, wie sie alles andere abwägt. Ist sie genommen, ist die Wahl wieder frei. Ein Regelsatz mit einer Liste an dieser Stelle braucht Capability API 1.336.

Ein Zustand oder ein getragener oder mitgeführter Gegenstand mit `"alerts": 15` verrät jeden, der sich versteckt innerhalb dieser Entfernung um seinen Besitzer bewegt: Er ist vor niemandem versteckt und wird als von seinem Besitzer verraten protokolliert. Das Wind-Chime aus dem Showcase-Beispiel ist ein mitgeführter Gegenstand mit `{"alerts": 15}`. Das `"stillIn": ["bright"]` einer Kreatur hindert sie an der Bewegung, solange eine ihrer Zellen in einem dieser Lichter liegt: Dort steht kein Gehen in ihrem Menü. Der Lantern-Shy aus dem Showcase-Beispiel.

Wachsende Auren, Festhalten mit einem Höchstwert, Losreißen und Durchhalten (Capability API 1.320). Das `"grows": {"by": 10, "upTo": 40}` einer Aura reicht zu Beginn jedes Zuges ihres Betroffenen um `by` weiter, bis höchstens `upTo`, was mehr als ihre `distance` ist; das Protokoll nennt, wie weit sie jetzt reicht. Ihr `harms` kann `"on": "their-turn"` angeben: zugefügt zu Beginn jedes Zuges dessen, den sie erreicht, statt auf einmal zu Beginn des Zuges ihres Betroffenen. `"lingers": true` lässt das, was sie überträgt, bei jedem, den sie nicht mehr erreicht, bis zum Beginn seines nächsten Zuges bestehen, und die Aura hält es wieder aufrecht, wenn sie ihn vorher erreicht. Frost Debt von The Owed ist `{"distance": 20, "side": "enemies", "conditions": ["no_heal"], "grows": {"by": 10, "upTo": 40}, "lingers": true, "harms": {"dice": "2d6", "type": "cold", "on": "their-turn"}}`.

Was eine Aktion auferlegt, kann `"heldAtMost": 2` tragen: Solange seine Quelle so viele andere damit festhält, wird es keinem dritten auferlegt (als nicht auferlegt protokolliert), wie bei Grasps von The Owed. Das `shakeOff` eines Zustands mit `"self": true` lässt auch seinen Betroffenen ihn beenden, indem er das Budget ohne Probe ausgibt: der Seed Hopper, `{"budget": "action", "self": true}`, losgerissen vom Festgehaltenen oder einem Verbündeten neben ihm. Das `"hangsOn": {"uses": 1, "extraTurn": true, "label": "Hourglass"}` einer Kreatur lässt sie bei 1 Trefferpunkt, statt auf 0 zu fallen, `uses`-mal pro Kampf, aber nicht gegen das, was sofort tötet; mit `extraTurn` nimmt sie direkt nach dem Zug, in dem es geschah, einen eigenen Zug, und die Reihenfolge ist wieder wie zuvor, sobald dieser Zug vorbei ist.

Die Auswahl zeigt diesen Block als einzelne Zeile. Wer den Rest liest, hängt vom gewählten Regelsatzblock ab:

- Mit einem [`combat`-Block](#combat-a-fight-your-own-rules-resolve) liest der Kampf dessen Kampfwirkungen. `range`, `area` und `friendlyFire` gelten auf einem Schlachtfeld mit Positionen. `reaction` markiert einen Eintrag als Antwort auf etwas statt als Aktion in einem Zug und nennt den Moment, auf den er wartet (siehe [Fenster](#windows-holding-the-fight-open)). Ein nur mit `true` markierter Eintrag nennt keinen Moment und erscheint in keinem Menü. `check` gilt wie oben beschrieben für Fertigkeitsproben.
- Mit ausschließlich einem [`battle`-Block](#battles-lending-the-sheet-to-marinaras-combat) liest der Kampf `kind`, `range`, `area`, `friendlyFire`, `amount`, `damageType` und `cost`, weil Marinaras eigenes Kampfsystem genau diese Angaben aufnehmen kann.

Das Vokabular ist geschlossen. Ein nicht in der obigen Liste enthaltener Schlüssel oder Wert wird deshalb abgelehnt statt still ignoriert.

`cost` bezahlt auch der `use`-Befehl des Game Master außerhalb eines Kampfes. Darum geht es im nächsten Abschnitt.

### Bogenbefehle: Dauerhafter Fortschritt (Capability API 1.142)

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

### Direkt in der Regelsatzdatei oder als eigene Datei

Ein kleiner Katalog steht direkt in `ruleset.json`, im Feld `entries` des Katalogkopfs. Ein langer Katalog liegt in einer eigenen Datei, die der Kopf stattdessen mit `asset` nennt. Ein Katalog enthält genau eines von beiden.

```json
{ "id": "knacks", "label": "Knacks", "feeds": ["knacks"], "asset": "catalogs/knacks.json" }
```

Der Pfad ist immer `catalogs/<the catalog's id>.json`. Die Datei selbst sieht so aus:

```json
{ "schemaVersion": 1, "catalog": "knacks", "entries": [] }
```

Separate Katalogdateien gibt es in einem Paket: einem, das über den offiziellen Katalog veröffentlicht wird, oder einer Regelsatz-Paketdatei, die du selbst importierst (siehe [Deinen Regelsatz teilen](#sharing-your-ruleset)). Das Paket führt die Datei in `contributions.assets.paths` neben `ruleset.json` auf und braucht Capability API 1.21. Ein Kreaturenkatalog braucht Capability API 1.27, unabhängig davon, ob er direkt eingebettet ist oder eine eigene Datei hat, und ein Gegenstandskatalog braucht 1.49. **Ein als Einzeldatei importierter oder über ein GitHub-Repository geteilter Regelsatz enthält seine Kataloge direkt in der Datei.** Sie müssen daher in die 512-KB-Grenze der gesamten Regelsatzdatei passen. Das reicht für einige Hundert kurze Einträge.

Die Grenzen sind 12 Kataloge pro Regelsatz, in beiden Formen 2000 Einträge je Katalog und 2 MB für eine Katalogdatei. Ein Paket, dessen `ruleset.json` größer als 256 KB ist oder das eine Katalogdatei über 1 MB enthält, braucht Capability API 1.340, mit der beide Grenzen angehoben wurden.

### Der geführte Erstellungsassistent: Einen Charakter in Schritten erstellen

Ein Bogen kann `sheet.builder` deklarieren (Capability API 1.86). Der Bogeneditor öffnet sich dann im Charakter- und im Persona-Editor sowie unter **Edit sheet** (Bogen bearbeiten) in einem Spiel in der Ansicht **Guided** (geführt) neben dem vollständigen Formular **All fields** (alle Felder): oben die Schritte, jeder mit einem Badge, das die Entscheidungen zählt, auf die er noch wartet, dazu **Back** (zurück) und **Next** (weiter), die nie blockieren (ein Spieler darf Entscheidungen auf später verschieben), und daneben der Charakter, wie er gerade ist: was die Schritte geschrieben haben, die Attributswerte, die Werte, die `gm.sheetSummary` nennt (Rüstungsklasse, Übungsbonus), und die ausgebildeten Rettungswürfe und Fertigkeiten.

```json
"builder": {
  "tier": "proficient",
  "steps": [
    { "id": "race", "label": "Race", "kind": "catalog", "catalog": "races", "field": "race" },
    { "id": "subrace", "label": "Subrace", "kind": "catalog", "catalog": "races", "min": 0,
      "within": { "step": "race", "filter": "parent" } },
    { "id": "class", "label": "Class", "kind": "catalog", "catalog": "classes", "field": "class" },
    { "id": "level", "label": "Level", "kind": "fields", "fields": ["level", "background"] },
    { "id": "scores", "label": "Ability Scores", "kind": "abilities", "methods": {
      "pointBuy": { "budget": 27, "costs": [[8, 0], [9, 1], [10, 2], [11, 3], [12, 4], [13, 5], [14, 7], [15, 9]] },
      "standardArray": [15, 14, 13, 12, 10, 8],
      "roll": { "count": 4, "sides": 6, "keep": 3 },
      "manual": true } },
    { "id": "skills", "label": "Proficiencies", "kind": "trained" },
    { "id": "gear", "label": "Equipment", "kind": "startingGear" }
  ]
}
```

Bis zu 24 Schritte, jeweils `{ id, label, kind, ... }`; ein Paket mit mehr als 16 deklariert Capability API 1.112:

- `catalog`: Einträge eines Zeilenkatalogs, als Karten angezeigt, mit ihrer `summary` hinter **Info**. `min` (Standard 1) gibt an, wie viele der Schritt verlangt, und `max` (Standard 1), wie viele er höchstens nimmt; bei `max` 1 ersetzt eine neue Wahl die alte. Beide dürfen bis 40 gehen; ein Paket, bei dem einer davon über 20 liegt, deklariert Capability API 1.110. `field` nennt ein Text- oder Enum-Feld, in das die Beschriftungen der gewählten Einträge geschrieben werden (ein Enum-Feld nimmt die ID oder die Beschriftung des Eintrags, je nachdem, welche davon einer seiner Werte ist). `filters` legt Werte der Katalogfilter fest, und `within: { step, filter }` bietet nur Einträge an, deren `filter` einen in diesem früheren Schritt gewählten Eintrag nennt, so wie eine Unterrasse ihre Rasse nennt; wird die Rasse abgewählt, zählt ihre Unterrasse nichts mehr. `upTo: { filter, value }` (Capability API 1.87) bietet nur Einträge an, deren Zahlenfilter `filter` höchstens `value` beträgt, einen Wert, der vom Bogen in seinem aktuellen Stand gelesen wird, etwa Merkmale bis zur Stufe des Charakters (`{ "filter": "level", "value": { "derived": "level" } }`). Ein Eintrag ohne diesen Filter wird immer angeboten, und eine Wahl, unter die der Bogen inzwischen gefallen ist, zählt nichts, bleibt aber erhalten. Eine Wahl, die den gelesenen Wert ändert (eine Klasse, die die Stufe setzt), wird in derselben Änderung verrechnet, ebenso ein in **All fields** geänderter Wert (eine dort gesenkte Stufe nimmt sofort zurück, was ein Merkmal darüber gegeben hat). `countFrom` (Capability API 1.90) ist ein auf dieselbe Weise vom Bogen gelesener Wert, der zugleich für `min` und `max` steht: wie viele Einträge der Schritt verlangt und wie viele er höchstens nimmt, abgerundet und nie über `max`, etwa die Zauber, die eine Klasse auf der Stufe des Charakters kennt (`{ "derived": "spells_known" }`). Wahlen darüber hinaus bleiben erhalten, zählen aber nichts, bis die Anzahl wieder steigt.
  Ein Katalogschritt kann außerdem `stamp` tragen (Capability API 1.108), 1 bis 4 Spaltenwerte, die in jede Zeile geschrieben werden, die er hinzufügt, etwa `"stamp": { "class": "wizard" }` am Zauberschritt des Magiers und `"stamp": { "class": "cleric" }` an dem des Klerikers. Jeder Schlüssel muss eine Spalte in jeder Liste sein, die der Katalog befüllt; Werte sind Zeichenfolgen, Zahlen oder boolesche Werte. Der Stempel ersetzt den Anfangswert des Katalogs. Bestehende Zeilen und spätere Bearbeitungen in **All fields** bleiben Sache des Spielers. Mit Capability API 1.130 kann ein Stempelwert stattdessen ein Objekt sein, dessen `fromWithin` `"id"`, `"label"` oder eine vom übergeordneten Katalog deklarierte Filter-ID ist: Es liest den ersten passenden übergeordneten Eintrag in Wahlreihenfolge, schreibt beim Hinzufügen der Zeile einmal eine Zeichenfolge oder Zahl und lässt diese Spalte ungestempelt, wenn kein übergeordneter Eintrag passt oder dessen Filter fehlt oder ein Array ist.

  ```json
  {
    "id": "spells",
    "label": "Spells",
    "kind": "catalog",
    "catalog": "spells",
    "within": { "step": "class", "filter": "class_ids" },
    "stamp": { "class": { "fromWithin": "label" } }
  }
  ```

- `fields`: Ein kurzes Formular aus benannten Feldern. Sein Badge zählt die noch leeren, außer denen in `optional` (eine Unterklasse, die auf einer späteren Stufe gewählt wird). `shownWhen: { "field_id": { "field": "level" } }` (Capability API 1.107) zeigt und zählt ein benanntes Feld des Schritts nur, solange sein Wertverweis auf dem Bogen in seinem aktuellen Stand über 0 liest; ausgeblendete Felder behalten ihre Werte. `total: { "fields": ["level_bard", "level_other"], "max": 20 }` (1.107) hält mindestens zwei Zahlenfelder des Schritts auf einem gemeinsamen Maximum (eine ganze Zahl von 1 bis 1.000), senkt das Maximum jeder Eingabe um die aktuellen Werte der anderen, ohne unter ihr eigenes Minimum zu gehen, und erhöht das Badge um eins, wenn die Summe über der Grenze liegt; **Next** funktioniert trotzdem.
- `abilities`: Die Attributswerte (`abilities`, ohne Angabe alle), gesetzt mit einer der `methods`: `pointBuy` (ein `budget`, das nicht höher ist als die Kosten, jeden Wert ganz nach oben zu kaufen, und die Kosten jedes Werts vom niedrigsten an, bei dem jeder Wert beginnt, jeweils eins höher; ein von Hand eingetippter Wert beginnt beim nächstgelegenen Wert der Tabelle), `standardArray` (je ein Wert für jedes Attribut), `roll` (`count` Würfel mit `sides` Seiten, von denen die höchsten `keep` behalten werden, geworfen mit den eigenen Würfeln der Engine, ein Wurf pro Wert und dann wie eine Reihe verteilt) und `manual`. `manual: true` behält die bestehenden Grenzen der Werte bei; `manual: { min, max }` (Capability API 1.110) begrenzt eingetippte Grundwerte vor Gewährungen auf diese ganzzahligen Grenzen, mit min mindestens -100, max höchstens 1.000 und min höchstens max, während die eigenen Grenzen jedes Attributs weiterhin die Summe begrenzen. `default` (1.87) ist die Methode, mit der ein Charakter beginnt, den der Erstellungsassistent von einem leeren Bogen aus startet (und die er behält, auch wenn sich der Standard des Regelsatzes später ändert); ein Anfänger sieht also etwa den Punktekauf, bis er eine andere Methode wählt. Ein beschriebener Charakter übernimmt ihn nie, und seine Werte bleiben, wie sie sind, bis der Spieler nach dem Beschreiben eine Methode wählt. **Manual entry** (manuelle Eingabe) bleibt die eingetippte Bearbeitung innerhalb ihrer Grenzen, und **All fields** ist immer da. Was die Wahlen hinzufügen, kommt obendrauf: Der Schritt zeigt Grundwert, Bonus, Summe und Modifikator. Höchstens ein Attributsschritt.
- `allocate` (Capability API 1.152): Punkte in Phasen mit Prioritätskontingenten oder Gruppenbudgets, unten beschrieben.
- `trained`: Die Fertigkeits- und Rettungswurfauswahlen, die die Wahlen anbieten, und das eigene `choose: [{ "what": "skills", "count": 2, "from": [...] }]` des Schritts (ohne `from` jede davon).
- `startingGear`: Listet die Startausrüstung des Regelsatzes auf. Ausrüstung wird wie immer im Spiel aus dem Inventar genommen.
- `choices` (Capability API 1.91): `catalog` nennt einen Zeilenkatalog, und in diesem Schritt werden die Einträge gewählt, die die Wahlen daraus gewähren (`grants.entries`, unten), etwa eine Sprache deiner Wahl.

Ein Startausrüstungsschritt kann `"strict": true` tragen (Capability API 1.109). Im Modus nur regelkonform, dem Standard, bietet er nur Ausrüstung an, deren `fits` auf dem Bogen in seinem aktuellen Stand ohne Live-Zustand wahr ergibt, sowie Ausrüstung ohne `fits`; eine Liste „Other gear“ gibt es nicht. Für 5e setzt du `fits: { "value": { "field": "wizard_level" }, "atLeast": 1 }` an das Wizard-Paket und das entsprechende Klassenstufenfeld an jedes andere Klassenpaket; lass `fits` beim Acolyte-Paket weg, damit es zu jedem passt. Die freie Bearbeitung bietet wieder jedes Paket an. Die Auswahl im Inventar hebt eine Auswahl auf, die nach einem Klassenwechsel oder dem Verlassen der freien Bearbeitung nicht mehr passt, und sagt, warum; sie prüft außerdem die Passung, bevor die Ausrüstung genommen wird. Ohne passende Ausrüstung zeigt der Schritt seinen leeren Zustand, und Next bleibt offen. Schritte ohne `strict` bieten weiterhin jedes Paket an. Der Modus gilt lokal für jeden Bildschirm, wird nicht mit einem gespeicherten Aufbau festgehalten und nicht an den Server gesendet.

Was eine Wahl gibt, sind die `grants` ihres Eintrags, die nur der Erstellungsassistent liest:

```json
{
  "id": "half-elf",
  "label": "Half-Elf",
  "grants": {
    "abilities": { "add": { "cha": 2 }, "choose": [{ "count": 2, "amount": 1, "except": ["cha"] }] },
    "trained": { "skills": [], "saves": [], "choose": [{ "what": "skills", "count": 2 }] },
    "sets": { "speed": 30 }
  }
}
```

- `abilities.add` addiert zu Attributswerten; `abilities.choose` lässt den Spieler `count` Attribute wählen (nie eines doppelt, nie eines aus `except`), die jeweils `amount` erhalten. Mit `"repeat": true` (Capability API 1.93) darf ein Attribut mehrmals gewählt werden, jedes Mal `amount`; `{ "count": 2, "amount": 1, "repeat": true }` ist also die +2 auf ein Attribut oder +1 auf zwei Attribute einer Attributswerterhöhung, und der Schritt zeigt neben einem Attribut ein Minus, um eine Wahl zurückzunehmen. So oder so geht kein Wert über sein `max` hinaus. `upTo` (Capability API 1.96) begrenzt, worauf die Auswahl selbst einen Wert anheben darf, nach dem, was jede andere Gewährung addiert: `{ "count": 2, "amount": 1, "repeat": true, "upTo": 20 }` ist die Erhöhung des SRD, die „einen Attributswert nicht über 20 erhöhen kann“; der Schritt deaktiviert ein Attribut, das bereits dort steht. Die Auswahl wird im Attributsschritt angezeigt oder, wenn es keinen gibt, dort, wo der Eintrag gewählt wurde.
- `trained` bildet Fertigkeiten und Rettungswürfe aus und bietet Auswahlen an, angezeigt im ersten Ausbildungsschritt oder dort, wo der Eintrag gewählt wurde. Sie werden auf die `tier` der Gewährung ausgebildet, sonst auf die `tier` des Erstellungsassistenten, sonst auf die erste Stufe über „ohne Ausbildung“, die der Bogen für Fertigkeiten oder Rettungswürfe anbietet. Eine Auswahl bietet nie an, was die Wahlen bereits auf ihre Stufe oder höher ausbilden, direkt oder über eine frühere Auswahl (Capability API 1.104): Ein Hintergrund, der Insight ausbildet, überlässt die Fertigkeitsauswahl einer Klasse den anderen Fertigkeiten, wie das SRD es verlangt. Eine Auswahl, die gespeichert wurde, bevor sie auf diese Weise vergeben war, zählt nichts, der Schritt fragt also nach einer anderen, und eine Auswahl, die nichts mehr anzubieten hat, wird nicht angezeigt. Eine Auswahl kann `"held": "<tier>"` angeben (Capability API 1.105): Sie bietet nur an, was die Wahlen auf diese Stufe oder höher ausbilden oder was eine Auswahl unterhalb ihrer eigenen Stufe dort hält, so wie Expertise in 5e zwei Fertigkeiten sind, in denen du geübt bist: `{ "tier": "expertise", "choose": [{ "what": "skills", "count": 2, "held": "proficient" }] }`. `held` liegt unter der Stufe, auf die die Auswahl ausbildet.
- `sets` schreibt Feldwerte: den Trefferwürfel einer Klasse, ihr Zauberwirkungsattribut.
- Ein Katalogeintrag kann angeben, wann ein Schritt des Erstellungsassistenten ihn anbietet: `offeredWhen` (Capability API 1.99) ist ein Wert, der vom Bogen in seinem aktuellen Stand gelesen wird, und der Eintrag wird nur angeboten, solange er über 0 liest, so wie 5e eine zweite Klasse nur anbietet, wenn ihre Voraussetzungen für Mehrfachklassen erfüllt sind (ein abgeleiteter Wert pro Klasse). Eine Wahl, die später 0 liest, zählt nichts und bleibt erhalten, wie bei `upTo`. Ein Eintrag, dessen eigene Wahl ändert, was sein `offeredWhen` liest (ein Wert, den er erhöht, ein Feld, das er setzt, eine Fertigkeit, die er ausbildet, eine Liste, in die er schreibt, direkt oder über einen abgeleiteten Wert), wird abgelehnt, weil er sich selbst anbieten, sich selbst zurücknehmen und sich wieder anbieten würde. Ein Eintrag mit einer `exclusive`-Gruppe wird auf dem Bogen ohne die Wahlen gelesen, die der Schritt in dieser Gruppe gespeichert hat (Capability API 1.100), weil seine Wahl diese verwirft: Ein Talent, das anstelle einer Attributswerterhöhung genommen wird und Strength 13 voraussetzt, wird nicht auf der Strength angeboten, die diese Erhöhung gegeben hat. Eine Auswahl, die ein Eintrag gewährt (`grants.entries.choose`), hält ihre Optionen auf dieselbe Weise an deren `offeredWhen` (Capability API 1.106). Die Katalogauswahl in **All fields** bietet wie immer jeden Eintrag an.
- Ein Katalogeintrag kann eine `exclusive`-Gruppe nennen (Capability API 1.94): Ein Schritt des Erstellungsassistenten behält eine Wahl jeder Gruppe; die Wahl eines Eintrags verwirft also die andere Wahl des Schritts aus dieser Gruppe, und nur die neueste zählt. Ein Talent, das anstelle einer Attributswerterhöhung genommen wird, teilt sich mit ihr eine Gruppe: `"exclusive": "fighter-asi-4"`.
- `entries` (Capability API 1.91) bietet Einträge eines anderen Zeilenkatalogs zur Wahl an: `{ "choose": [{ "catalog": "languages", "count": 1 }] }`, höchstens sechs Auswahlen. `filters` legt Werte der Filter dieses Katalogs fest, und `ids` listet die einzigen angebotenen Einträge auf (`{ "catalog": "tools", "count": 1, "ids": ["smiths-tools", "brewers-supplies", "masons-tools"] }`). Sie werden im `choices`-Schritt des Erstellungsassistenten für diesen Katalog gewählt (eine Gewährung, die einen Katalog ohne einen solchen Schritt nennt, wird abgelehnt). Nur Einträge, die Zeilen schreiben, werden angeboten, und ihre Zeilen kommen auf den Bogen; ein Eintrag, der für eine Gewährung gewählt wurde, wird keiner anderen angeboten. Ihre eigenen Gewährungen werden nicht angewendet.
- Eine Wahl schreibt außerdem einmal die `rows` des Eintrags. Ein Eintrag kann `grants` und überhaupt keine `rows` tragen (eine Klasse, deren Merkmale aus einem anderen Katalog stammen), und ein Katalog, dessen Einträge alle nur gewähren, braucht kein `feeds`; die Katalogauswahl bietet solche Einträge nie an.

Abwählen nimmt zurück, was eine Wahl gegeben hat, und nur das: ihre Erhöhungen (so weit die Grenzen eines Werts sie steigen ließen), ihre Ausbildung, ihre Feldwerte und ihre Zeilen. Was der Bogen bereits vom Spieler selbst hatte (eine von Hand ausgebildete Fertigkeit, eine aus der Katalogauswahl hinzugefügte Zeile), bleibt seins, und eine in **All fields** vorgenommene Bearbeitung bleibt, bis sich die eigene Antwort des Erstellungsassistenten für diesen Wert ändert. Ein Eintrag, der in zwei Schritten aus einem Katalog gewählt wurde, gewährt einmal, und einer, den die Ebenen eines Spiels ausblenden, zählt weiterhin für das, was er gegeben hat. Ein Feld, das eine Wahl mit `sets` setzt, wird nur geschrieben, solange es noch leer ist oder solange der Erstellungsassistent bereits dafür zuständig ist; eine von Hand eingetippte Stufe wird also nie überschrieben. Ein Wert, für den der Erstellungsassistent zuständig ist und den der Spieler in dessen eigenem Feldschritt ändert, bleibt beim Erstellungsassistenten und verschwindet, wenn eine spätere Wahl ihn nicht mehr verlangt. Die Entscheidungen des Spielers werden neben dem Bogen aufbewahrt, sodass ein Schritt später wieder geöffnet werden kann.

**Verteilung von Werten in Phasen (Capability API 1.152).** Ein `allocate`-Schritt kauft einen Punkt pro Budgetpunkt, mit eigenem Budget und eigenen Erstellungsobergrenzen. Er ändert weder die Methode noch die gespeicherten Antworten des einen `abilities`-Schritts. Verwende getrennte Schritte für Attribute, Tugenden und spätere Bonuspunkte:

```json
{
  "id": "attributes",
  "label": "Attributes",
  "kind": "allocate",
  "priorities": [7, 5, 3],
  "annotations": true,
  "groups": [
    {
      "id": "physical",
      "label": "Physical",
      "targets": [{ "ability": "strength" }, { "ability": "dexterity" }, { "ability": "stamina" }],
      "base": 1,
      "min": 1,
      "max": 5
    },
    {
      "id": "social",
      "label": "Social",
      "targets": [{ "ability": "charisma" }, { "ability": "manipulation" }, { "ability": "appearance" }],
      "base": 1,
      "min": 1,
      "max": 5
    },
    {
      "id": "mental",
      "label": "Mental",
      "targets": [{ "ability": "perception" }, { "ability": "intelligence" }, { "ability": "wits" }],
      "base": 1,
      "min": 1,
      "max": 5
    }
  ]
}
```

Es gibt 1–12 Gruppen, jede mit einer stabilen `id`, einem `label` und 1–120 Zielen. Ziele kommen im ganzen Schritt nur einmal vor. Ein Ziel nennt genau ein vorhandenes `{ ability }`, ein numerisches `{ field }`, `{ skill }`, `{ save }` oder `{ bonus }`; ein Bonus ist der numerische Eintrag in `build.bonuses` für eine vorhandene Fertigkeit oder einen vorhandenen Rettungswurf. Gruppen verwenden genau eine Budgetart: Entweder hat `priorities` ein nicht negatives ganzzahliges Kontingent pro Gruppe (Duplikate erlaubt), oder **jede** Gruppe deklariert `budget: Ref`. Prioritätsplätze werden ausdrücklich zugewiesen, und das Zuweisen eines belegten Platzes tauscht die Gruppen. Die Reihenfolge des Arrays benennt primär, sekundär, tertiär und dann nummerierte Prioritäten; setze größere Kontingente nach vorn, wenn diese Namen der Größe folgen sollen. Budgets betragen höchstens 1.200.000 Punkte.

`base` ist optional; `min` und `max` sind erforderlich. Jeder dieser Schlüssel nimmt eine ganze Zahl oder einen nicht laufenden `Ref` an, etwa `{ "derived": "archetype_floor" }`. Werte müssen sich zu ganzen Zahlen von 0 bis 10.000 auflösen und in die Speichergrenzen oder die Stufenzuordnung des Ziels passen. Die erste Basis ersetzt den Standardwert eines leeren Ziels und behält vorhandene Methodenwerte und Gewährungen; eine spätere Basis ist eine Untergrenze für frühere Phasen. Ohne Basis beginnt die Phase beim vorhandenen Wert. Gleiche Werte für min und max legen den Erstellungswert fest: `base: 0, min: 0, max: 0` drückt eine feste Appearance aus. Minima kaufen nicht automatisch Punkte. Budgets und Grenzen können die vorhandenen Operatoren abgeleiteter Werte verwenden, aber keine Ziele lesen, die durch diesen oder einen späteren Schritt verändert werden, auch nicht über abgeleitete Werte. Bedingungen für kostenlose Gewährungen können ebenfalls keine Werte in einer Verteilungsgruppe lesen, die sie verändern können, einschließlich verbundener Gruppen in anderen Phasen. Preise über Formeln werden nicht unterstützt: Jede bezahlte Erhöhung kostet einen Punkt. Eine nicht auflösbare oder ungültige Quelle wird als **not configured** angezeigt.

Fertigkeits- und Rettungswurfziele brauchen `sheet.builder.ratingTiers`, für jedes Ziel einzeln:

```json
"ratingTiers": [
  { "target": { "skill": "athletics" }, "tiers": ["none", "trained", "expert"] },
  { "target": { "save": "will" }, "tiers": ["none", "trained"] }
]
```

Der Array-Index ist der numerische Wert. Zuordnungen haben 1–12 vorhandene, aufsteigende angebotene Stufen-IDs, beginnend bei der Stufe ohne Ausbildung des Regelsatzes; sie werden nie aus Stufenboni abgeleitet. Verschiedene Ziele dürfen verschiedene Zuordnungen verwenden. Setze Ziele mit unterschiedlichen Erstellungsobergrenzen in getrennte Gruppen.

Die `grants.ratings` eines Katalogs liefern kostenlose Punkte vor **allen** bezahlten Phasen:

```json
"ratings": [
  { "target": { "skill": "athletics" }, "add": 1 },
  { "target": { "save": "will" }, "set": 1 }
]
```

Jede Gewährung hat entweder ein positives `add` oder ein nicht negatives `set`, nie beides. Alle `set`-Gewährungen sind Untergrenzen: Die höchste gewinnt, dann addieren sich alle Additionen und halten an der Speichergrenze des Ziels an. Zwei kostenlose Rangadditionen erreichen also Rang zwei, ohne das bezahlte Budget zu belasten. Vorhandene Ausbildung und Feld- oder Attributsgewährungen werden vor diesen Wertgewährungen verrechnet. Eintragsauswahlen schreiben weiterhin nur Zeilen; sie wenden die Gewährungen des gewählten Eintrags nie rekursiv an.

Die Oberfläche zeigt Basis- bzw. vorherigen Wert, kostenlose, gekaufte und gesamte Werte, den Erstellungsbereich und das verbleibende Budget. Plus ist an einer Obergrenze, ohne Budget oder solange ungültige Käufe oder manuelle Überschreibungen Aufmerksamkeit brauchen, deaktiviert. Nicht ausgeschöpfte Budgets, unmögliche Minima und Überschreibungen erhalten Badges; Back und Next bleiben verfügbar. Das Neuzuweisen einer Priorität behält die gespeicherten Erhöhungen der Gruppe. Eine überzogene Gruppe wird als Ganzes inaktiv; ein Kauf über der Obergrenze seines Ziels wird für dieses Ziel inaktiv. Verringere oder lösche diese Antworten, um sie zu reparieren, oder stelle das frühere Kontingent wieder her, um sie wieder zu aktivieren. Spätere Phasen dürfen frühere Erstellungsobergrenzen überschreiten. **All fields** bleibt die freie Bearbeitung, wobei Überschreibungen ausdrücklich angezeigt statt auf die Erstellungsregeln begrenzt werden.

Das gespeicherte `builder.allocations[stepId]` enthält Indizes der Prioritätsplätze nach Gruppen-ID, bezahlte `bought`-Erhöhungen und optionale `notes` nach stabilen Zielschlüsseln der Form `kind/id` (zum Beispiel `ability/strength`). `annotations: true` bietet bis zu 1.000 Zeichen pro Ziel für Erläuterungen zur Herkunft oder für Spezialisierungen; der Erstellungsassistent bewertet diesen Text nicht. Angewendete Erhöhungen gehören getrennt der jeweiligen Phase. Wiederöffnen vergibt Gewährungen nie erneut und füllt keine Ressourcen auf, und das Beschreiben eines bestehenden Bogens hält die Entscheidungen fest, ohne ihn umzuschreiben, auch wenn das Beschreiben endet. Abwählen berechnet die kostenlosen Werte und die bezahlten Phasen neu und bewahrt dabei manuelle Abweichungen.

**Gemeinsame Budgets und Käufe mit Preis (Capability API 1.153).** Deklariere bis zu 12 Erstellungspools in `sheet.builder.pools`. Mehrere `spend`-Schritte dürfen einen Pool verwenden; getrennte Pools halten Berufspunkte und Punkte für persönliche Interessen unabhängig voneinander. Budgets sind nicht laufende Wertverweise, einschließlich der vorhandenen Berechnungen `sum`, `scale`, `multiply`, `min`, `max`, `stepTable`, `enumTable` und `listSum`. Ihr aufgelöster Wert muss endlich sein und zwischen 0 und 100.000 liegen. Eine fehlende Quelle ist „not configured“.

```json
{
  "pools": [
    { "id": "occupation", "label": "Occupation", "budget": { "derived": "occupation_points" }, "creditLimit": 0 },
    { "id": "interest", "label": "Personal interest", "budget": { "derived": "interest_points" } }
  ],
  "steps": [
    {
      "id": "occupation_skills",
      "label": "Occupation skills",
      "kind": "spend",
      "pool": "occupation",
      "offers": [
        {
          "id": "accounting",
          "label": "Accounting",
          "target": { "field": "accounting_value" },
          "cost": { "flat": 1 },
          "min": 5,
          "max": 99
        }
      ]
    }
  ]
}
```

Jeder Schritt hat bis zu 120 Angebote mit stabiler `id` und stabilem `label`. Ziele verwenden denselben Vertrag mit genau einem von `ability`, numerischem `field`, zugeordnetem `skill`/`save` oder `bonus` wie Verteilungsphasen. Käufe von Listenzeilen sind der Funktion für Zeilenidentität (F4) vorbehalten; diese API identifiziert Zeilen nicht über ihre Position im Array. Grenzen müssen in die Speichergrenzen des Ziels passen. Startwerte und kostenlose Gewährungen bleiben erhalten und werden nie erneut berechnet: Ein Background mit zwei kostenlosen und fünf bezahlten Punkten hat sieben.

Ein Preis ist genau eines von:

- `{ "flat": 1 }`: ein Punkt pro Werterhöhung.
- `{ "perRank": 5 }`: das Fünffache des nächsten Rangs; 2 auf 3 zu erhöhen kostet also 15.
- `{ "table": [[5, 0], [5.25, 5], [5.5, 12]] }`: kumulative Preise bei steigenden Werten.
  Der nächste Kauf geht zum benachbarten Wert und kostet die Differenz (hier 5, dann 7).
  Gebrochene Werte brauchen ein nicht ganzzahliges Zahlenfeld; Tabellen umfassen beide Grenzen des Angebots.

Das optionale `overrides: [{ "when": { "derived": "career_affinity" }, "cost": { "perRank": 2 } }]` enthält höchstens 12 Einträge. Die erste positive Bedingung gewinnt. Bedingungen lesen den Bogen vor den Käufen; ohne Treffer gilt der Grundpreis. Budgets und Bedingungen können gekaufte Ziele nicht lesen, auch nicht über abgeleitete Werte, und nicht von späteren Entscheidungen abhängen. Kostenlose Gewährungen und Verteilungsphasen werden vor Käufen mit Preis angewendet.

Preise sind positiv, außer bei ausdrücklich deklarierten Gutschriften. Für einen Makel, dessen Wert steigt, verwende `"credit": true, "cost": { "flat": -1 }`. Für eine Senkung von einer deklarierten Basis aus verwende `"credit": true, "baseline": 10, "min": 6, "max": 10, "cost": { "flat": 1 }`: Ein Kauf senkt 10 auf 9 und hält eine Gutschrift von einem Punkt fest. Der Startwert muss der Basis entsprechen. Ein Gutschriftziel hat im gesamten Erstellungsassistenten nur ein Angebot, was Kreisläufe aus Kauf und Gutschrift verhindert.

Pools haben standardmäßig keine Gutschrift. Setze `creditLimit` auf die höchste Gesamtgutschrift und ergänze optional bis zu 12 `caps: [{ "filter": "flaw", "maxCredit": 2 }]`. Filter nennen `tags: ["flaw"]` von Angeboten; Gutschriften für Makel und für Nachteile können also getrennte Obergrenzen haben. Obergrenzen zählen Bruttogutschriften, unabhängig von positiven Ausgaben. Eigene Grenzen für die Anzahl von Eigenheiten bleiben Einschränkungen für Auswahlen oder Zeilen.

**Gezählte und passende Zeilen (Capability API 1.205).** Ein `listSum` kann `where:
{ "column", "equals" }` tragen, um nur die Zeilen zu lesen, deren Zelle einem Wert entspricht (eine leere Zelle liest den Standardwert ihrer Spalte), und `count: true` anstelle von `column`, um die Zeilen zu zählen, statt eine Spalte zu addieren. Die Talentpyramide von Genesys besteht aus zwei abgeleiteten Zählungen und einer Erstellungsregel:

```json
{
  "id": "tier2",
  "label": "Tier 2 talents",
  "op": "sum",
  "of": [{ "listSum": { "list": "talents", "count": true, "where": { "column": "tier", "equals": 2 } } }]
}
```

mit einer Regel, deren `value` `tier2` liest und deren `max` die Anzahl der Stufe 1 minus eins liest.

**Pro Zeile berechnete Zeilenpreise (Capability API 1.206).** Das Objekt `cost` eines Zeilenschritts kann seine `column` mit `times` skalieren und `add` addieren; `{ "column": "tier", "times": 5 }` bepreist also ein Genesys-Talent mit 5 EP pro Stufe, und `add` allein ist ein fester Preis, als Objekt geschrieben. `overrides` (bis zu 4) gibt einen Preis an, der stattdessen gilt, wenn ein abgeleiteter Wert, den ein Präfix und die eigene Zelle der Zeile benennen, auf dem Bogen über 0 liest: `{ "add": 5, "overrides": [{ "derived": { "prefix": "affinity_", "cell": "ability" }, "cost": 4 }] }` bepreist ein Charm in Exalted mit 4 Bonuspunkten, wenn `affinity_<its Ability>` über 0 liegt. Eine Enum-Zelle muss für jeden Wert, den sie annehmen kann, einen abgeleiteten Wert haben.

**Angebote ohne Preis (Capability API 1.207).** Die `cost` eines Ausgabeangebots (oder einer Überschreibung) kann `{ "unpriced": true }` sein, solange die Quelle den Preis nicht geliefert hat: Das Angebot erscheint mit einem Hinweis, belastet den Pool für nichts und wird nie gekauft. Ein Kauf, der unter einem Preis gespeichert wurde, der später ohne Preis ist, wird inaktiv und zur Reparatur aufbewahrt.

**Mehr Felder (Capability API 1.208).** Ein Bogen darf bis zu 240 Felder deklarieren; vor 1.208 liegt die Obergrenze bei 160. Fertigkeitsränge, Kategorieränge, Potenziale und Summen in Rolemaster brauchen den Platz.

**In ein Attribut geschriebene Würfe (Capability API 1.209).** Der Wurf eines `roll`-Schritts kann statt `field` ein `ability` nennen (genau eines von beiden). Das Ergebnis wird in den eigenen Grenzen des Attributs gehalten. Mit `gain` wird die Probe gegen den Wert gewürfelt, und nur ein Ergebnis darüber addiert den Zugewinn, den der Erstellungsassistent dann als Erhöhung behält: Wird der Wert erneut gewürfelt oder gekauft, bleibt die Verbesserung obendrauf. Ohne `gain` wird das Ergebnis wie ein eingetippter Wert geschrieben und behalten, bis sich die eigene Antwort des Erstellungsassistenten für diesen Wert ändert. Ein berechnetes Attribut kann nicht gewürfelt werden, und jedes Attribut wird pro Schritt höchstens einmal gewürfelt.

**Berechnete Listenspalten (Capability API 1.210).** Eine Zahlenspalte kann `sum` nennen: bis zu sechs andere Zahlenspalten derselben Zeile, addiert (eine leere Zelle liest den Standardwert ihrer Spalte) und in `min` und `max` der Spalte gehalten. Die Zelle wird schreibgeschützt angezeigt, bei jedem Lesen eines gespeicherten Bogens ausgefüllt und von Summen, Zeilenproben und allem anderen wie eine eingetippte Zelle gelesen. Eine berechnete Spalte wird nicht gewürfelt und addiert nie eine andere berechnete Spalte. Der Wert einer Spezialisierung in CoC ist `"sum": ["base", "occupation", "interest"]`.

**Teilweise Erhöhungen von Werten (Capability API 1.211).** Das `abilities.choose` einer Gewährung kann `partialFrom` nennen. Ein Wert, der bereits auf oder über dieser Marke liegt, wenn die Auswahl kommt, erhält eine teilweise Erhöhung, und zwei teilweise Erhöhungen ergeben einmal `amount`. Auswahlen zählen in der Reihenfolge, in der der Erstellungsassistent sie trifft, nach jeder ganzen Erhöhung; die späteren Boosts in Pathfinder 2e lauten also `"amount": 1, "partialFrom": 4`: Ein Modifikator von +4 braucht zwei Boosts, um +5 zu erreichen. Das lässt sich mit `upTo` kombinieren.

**Zeilenproben in einer Haltung (Capability API 1.212).** Ein Eintrag in `checks[]` einer Liste kann `stance` nennen, eine der `resolution.stances` des Würfelpools. Die Probe jeder Zeile steht dann in dieser Haltung, wie eine Fertigkeit, die die Haltung auflistet: Die Beschäftigungen in Stewpot zählen Würfel auf die STILLNESS-Art. Die Erinnerung des Game Master nennt die Zeilen mit den Fertigkeiten der Haltung.

**Attributsspezialisierungen (Capability API 1.213).** Das `contextual` einer Liste kann `"abilities": true` setzen. Ihre `skill`-Zelle darf dann neben einer Fertigkeit auch ein Attribut nennen (per ID, Beschriftung oder Kurzform), und die Zeile gilt für jede Probe, die mit diesem Attribut gewürfelt wird: eine reine Attributsprobe, eine Fertigkeit, deren eigenes Attribut es ist, oder eine Fertigkeit, die `with=` darauf umstellt. Eine Attributsspezialisierung in World of Darkness, „Strength: lifting“, ist eine Zeile namens „lifting“, deren Fertigkeitszelle „Strength“ lautet.

**Streichen ausgeschaltet (Capability API 1.214).** Ein kontextbezogenes `check` (am `contextual` einer Liste oder am `mechanics.contextual` eines Eintrags) kann `"cancel": false` setzen. Bei einem Wurf, auf den es angewendet wird, streichen Augenzahlen bis einschließlich `resolution.cancel.upTo` keine Erfolge; ein Patzer liest sie weiterhin. Der Regelsatz muss ein `resolution.cancel` haben, das sich ausschalten lässt.

**Gegenstände verfügbar, ohne sie mitzuführen (Capability API 1.215).** Das `grants.itemAccess` eines Katalogeintrags listet bis zu 48 Gegenstände des Regelsatzes auf (`<catalog>/<entry>`, nie eine Dienstleistung). Die Wahl des Eintrags im geführten Erstellungsassistenten macht sie für den Charakter verfügbar: Der Bogen und der Bogenblock des Game Master führen sie als nicht mitgeführt auf, und nichts kommt in die Tasche. Der Game Master fügt einen dem Inventar hinzu, wenn er genommen wird, so wie ein Charakter in Blades zu Beginn eines Coups seine Last angibt.

**Zeilenpunkte bei der Erstellung (Capability API 1.216).** Eine `allocate`-Gruppe kann `rows` nennen, bis zu vier Paare `{list, column}`: Die Punkte in dieser Zahlenspalte über die Zeilen der Liste werden neben ihren Zielen auf das Budget der Gruppe angerechnet. Die Zeilen werden in der Liste bearbeitet; eine Gruppe mit mehr Zeilenpunkten als Budget wartet auf den Spieler. Die Preisüberschreibung eines Zeilenschritts kann statt einer festen `cost` ein `times` angeben, einen Satz pro Einheit für die Preisspalte. Die Craft-Zeilen in Exalted rechnen „dots“ auf die 28 Ability-Punkte an und bepreisen „bought“-Punkte mit `times: 2`, überschrieben zu `times: 1`, wo `affinity_<ability>` gesetzt ist; eine berechnete Wertspalte (1.210) addiert beide.

**Der beste Wert (Capability API 1.217).** Ein kontextbezogenes `check` kann `"best": true` setzen: Eine Fertigkeitsprobe, auf die es angewendet wird, würfelt den besten Fertigkeitswert des Charakters, wenn dieser höher als der verlangte ist. Ein `dice-highest`-Regelsatz darf eine kontextbezogene Probe verwenden, die nur das tut; jede andere Probenwirkung braucht weiterhin einen Würfelpool. Rook's Gambit in Blades ist eine Zeile mit besonderer Fähigkeit mit `"check": {"best": true}`, angewendet per Name.

**Kosten, die eine Leiste markieren (Capability API 1.218).** Ein kontextbezogener `cost`-Eintrag kann neben `{"pool", "amount"}` auch `{"track": "<id>", "by": N}` sein: Die Anwendung der Zeile oder des Eintrags markiert diese einfache laufende Leiste um N, so weit ihre Grenzen es zulassen (eine Wundleiste wird nicht auf diese Weise markiert). Auch das `contextual` einer Liste kann eine `cost` tragen. Rook's Gambit in Blades ist eine Zeile mit `"check": {"best": true}` und `"cost": [{"track": "stress", "by": 2}]`. Per `apply=` angewendete Namen lesen gebogene und gerade Apostrophe und Anführungszeichen gleich.

**Geliehene Kataloge (Capability API 1.220).** Ein Katalog kann den Katalog eines anderen installierten Regelsatzes ausleihen, statt einen eigenen mitzuführen: `{ "id": "creatures", "label": "Creatures", "holds": "creatures", "from": { "ruleset": "5e-2014", "catalog": "creatures" } }`. Der Verleiher wird über seine ID gefunden, allein oder unter einem Community-Namensraum, und seine Einträge werden gegen den ausleihenden Regelsatz gelesen. Ein Eintrag, der etwas nennt, das der Ausleiher nicht deklariert (einen Zustand, eine Bedrohungsstufe, einen Sinn), wird also weggelassen und protokolliert, während der Rest durchkommt. `entries` neben `from` ergänzen die geliehenen oder ersetzen einen mit derselben ID; sie werden beim Lesen des Regelsatzes geprüft, daher nennt der Katalogkopf alle `filters`, die sie tragen (ein Kopf ohne Filter übernimmt die des Verleihers). Eine geliehene Kreatur, die als Bogen geschrieben ist, verwendet die IDs des Verleihers; `from.sheet` gibt an, wie sie im Ausleiher gelesen werden: `fields` ordnet ein Feld einer anderen ID zu (oder `null`, um es wegzulassen), `values` ordnet die Werte eines Felds zu, und `tiers` ordnet Ausbildungsstufen zu (die einer Kreatur und die, die irgendein Eintrag gewährt oder verlangt), wie in `"sheet": { "fields": { "ac": "ac_typed", "size": null }, "values": { "hp_method": { "by_hand": "manual" } }, "tiers": { "proficient": "trained" } }`. Jeder geliehene Eintrag, auch Gegenstände, kann zwei weitere Angaben tragen: `refs` liest einen abgeleiteten Wert des Verleihers als einen der Werte des Ausleihers (`"refs": { "prof_martial_weapons": { "field": "martial_weapons" }, "armor_speed_strength": { "abilityScore": "str" } }`), und `slots` legt den Trageplatz eines Gegenstands unter den Namen des Ausleihers (`"slots": { "body": "armor" }`). Ein Katalog kann nicht aus seinem eigenen Regelsatz ausleihen oder aus einem Katalog, der seinerseits ausleiht. Die Grafik einer geliehenen Kreatur wird wie die des Verleihers zugeordnet (`5e-2014/creatures/<id>` in einem Kreaturenpaket). Verweise in einen geliehenen Katalog, etwa die Zauber einer Kreatur, werden beim Lesen des Katalogs geprüft, nicht beim Lesen des Regelsatzes.

**Längere Fortschrittslisten (Capability API 1.219).** `sheet.advancement.fields` nimmt bis zu 64 Felder an (vorher 24). Ein Spiel, in dem eine Stufe viele Felder erhöht, etwa Zauberplätze für jeden Zaubergrad und Übungslisten, kann den GM also alle davon erhöhen lassen. Eine Liste mit mehr als 24 Feldern braucht 1.219.

**Käufe in beide Richtungen, in eigenem Besitz und im Tausch (Capability API 1.164).** `"direction": "both"` lässt ein Angebot seinen Wert von seinem Ausgangspunkt aus erhöhen und senken (seine `baseline` muss, wenn sie deklariert ist, dem Bogen entsprechen): Jeder Schritt nach oben kostet den Preis der Kurve, und jeder Schritt nach unten über den Ausgangspunkt hinaus bringt ihn als Gutschrift zurück, begrenzt auf `creditLimit` und die Obergrenzen des Pools. Das Kassenbuch läuft immer nur in eine Richtung: Das Senken eines gekauften Werts nimmt den letzten Kauf zu dem Preis zurück, zu dem er bezahlt wurde, und das Erhöhen eines gesenkten Werts zahlt seine Gutschrift zurück; Kaufen und Senken erzeugt nie Gutschriften. Ein solches Ziel hat im gesamten Erstellungsassistenten ein einziges Angebot. ST in GURPS ist `{ "target": { "ability": "st" }, "direction": "both", "baseline": 10, "min": 7, "max": 14,
"cost": { "flat": 10 } }`; ein Tabellenpreis bepreist gebrochene Schritte wie Basic Speed. `"direction": "increase"` und `"decrease"` benennen ausdrücklich ein Angebot in nur eine Richtung (`"decrease"` ist die oben beschriebene Senkung mit Basis und Gutschrift).

`"effect": "ownership"` bepreist ein Angebot auf seiner eigenen Leiter, von seiner `baseline` (oder seinem `min`) aufwärts, und der Bogen behält den höheren Wert aus seinem eigenen Wert und der gekauften Stufe: Eine Vertrautheit von einem Punkt in GURPS wird bezahlt und aufgeführt, auch wenn ein Standardwert bereits besser ist, und ihre Erstattung kostet den Bogen nichts.

`"exchange": { "from": <rating>, "units": 2, "gain": 1, "floor": 9 }` macht aus einem Angebot einen geschlossenen Tausch bei der Erstellung: Jeder Kauf senkt `from` um `units` und erhöht das Ziel um `gain` (Standard 1), ohne `from` je unter `floor` oder das Ziel über `max` zu bringen. Er kostet den Pool nichts und lässt `cost` daher weg. Getauschte Punkte werden nie weitergetauscht: Sobald ein Tausch einen Wert erhöht hat, senkt ihn kein anderer Tausch, und sobald einer einen Wert gesenkt hat, erhöht ihn kein anderer Tausch. Tauschgeschäfte, die eine Klasse nicht nehmen kann (`when`), dürfen dieselben Werte in umgekehrter Richtung nennen. Eine Erstattung setzt beide Werte zurück. Der Tausch der Hauptattribute in OSE ist ein Angebot pro gesenktem Wert:

```json
{
  "id": "wis_to_int",
  "label": "Lower Wisdom to raise Intelligence",
  "target": { "ability": "int" },
  "exchange": { "from": { "ability": "wis" }, "units": 2, "floor": 9 },
  "min": 3,
  "max": 18
}
```

Der Erstellungsassistent speichert vorzeichenbehaftete bezahlte Änderungen und ihre ursprünglichen Preise unter stabilen Schritt- und Angebots-IDs, mit höchstens 1.000 Kaufzeilen pro Angebot. Eine Erstattung entfernt die neueste Zeile und macht genau ihren Beitrag und ihren festgehaltenen Preis rückgängig, einschließlich des Entfernens einer Gutschrift. Sie erstattet nie einen kostenlosen Wert. Es werden keine laufenden EP, kein Inventar, keine Währung und keine Gruppenressourcen ausgegeben.

Ein Wechsel des Berufs, der kostenlosen Gewährungen oder der Budgetquellen behält das Kassenbuch. Ungültige Käufe sind inaktiv; der Pool zeigt seine ursprünglichen Ausgaben, bei Überziehung negative verbleibende Punkte und den vorgeschlagenen neuen Preis. Gemeinsame Ziele setzen außerdem abhängige Käufe in anderen Pools aus. **Reprice saved purchases** (gespeicherte Käufe neu bepreisen) übernimmt ausdrücklich einen zulässigen neuen Preis für den Pool; andernfalls erstatte Zeilen, um ihn zu reparieren. Kein Kauf wird still gelöscht oder verkauft. Nicht ausgegebene Punkte dienen nur der Information. Back und Next bleiben verfügbar, und **All fields** bewahrt sichtbare manuelle Überschreibungen innerhalb der Schemagrenzen. Das Beschreiben eines bestehenden Charakters und das Wiederöffnen gespeicherter Entscheidungen vergeben nie erneut Punkte.

**Benannte Zeilen (Capability API 1.154).** Ein `rows`-Schritt lässt den Spieler beim Erstellen eigene Zeilen in einer der Listen des Bogens hinzufügen, bearbeiten und entfernen: Gefolgsleute, Kontakte, Rituale und ihre Zutaten oder alles andere, was ein Katalog nicht auflistet.

```json
{
  "id": "retainers",
  "label": "Retainers",
  "kind": "rows",
  "list": "retainers",
  "columns": ["name", "role", "loyalty"],
  "required": ["name"],
  "min": 1,
  "max": 4,
  "defaults": { "role": "Hireling" }
}
```

`columns` ist die Teilmenge der Spalten der Liste, die der Schritt bearbeitet (ohne Angabe alle). `required` nennt die Spalten, die eine Zeile ausfüllen muss, um zu zählen. Das Badge zählt die ganzen Zeilen, die noch unter `min` (0 bis 20) fehlen, plus jede Zeile mit einer leeren Pflichtzelle; eine halb geschriebene Zutat bleibt also offen. `max` stoppt **Add a row** (Zeile hinzufügen) und überschreitet nie das `maxItems` der Liste. Eine neue Zeile beginnt mit den eigenen Standardwerten der Spalten und dann mit `defaults`, die zu jeder Spalte passen müssen.

Der Schritt bearbeitet die Liste dort, wo jede Zeile steht; zwei Gefolgsleute mit demselben Namen bleiben also zwei Zeilen, und das Entfernen eines davon behält den anderen. Zeilen, die eine Katalogwahl geschrieben hat, werden schreibgeschützt mit dem Hinweis „Added by a pick“ angezeigt und kommen und gehen mit der Wahl. **All fields** bearbeitet wie bisher jede Zeile.

**Bedingte Angebote, vom Bogen gelesene Grenzen und Erstellungsregeln (Capability API 1.155).** Ein Ausgabeangebot kann außerdem Folgendes tragen:

- `when: Ref`: Wird nur angeboten, solange es auf dem Bogen vor den Käufen über 0 liest, etwa die eigenen Fertigkeiten eines Berufs oder ein Background, den ein Stamm nehmen darf. Ein nie gekauftes Angebot lässt den Pool, wie er ist; gespeicherte Käufe für ein Angebot, das der Charakter nicht mehr nehmen kann, bleiben inaktiv zur Reparatur erhalten.
- `minFrom: Ref` und `maxFrom: Ref`: Eine Untergrenze und eine Obergrenze, vom Bogen gelesen und innerhalb von `min` und `max` gehalten. Credit Rating übernimmt den Bereich seines Berufs; Dodge endet bei DEX. Ein Wert unter der Untergrenze wird in einem Kauf auf sie angehoben.
- `allowedRatings: number[]`: Die einzigen Werte, auf denen ein Kauf enden darf, etwa ein Merit, das zu 1, 3 oder 5 Punkten verkauft wird. Jeder Kauf geht direkt zum nächsten erlaubten Wert zum Preis der Kurve.

Wie Budgets und Überschreibungen dürfen diese kein gekauftes Ziel lesen. Eine Ausbildungsauswahl mit `onDuplicate: "replace"` kann `replacementFrom` nennen, die Fertigkeiten (oder Rettungswürfe), durch die ein Duplikat ersetzt werden darf, anstelle aller, die der Bogen hat; das gilt für das, was angezeigt, gespeichert und angewendet wird.

`sheet.builder.constraints` enthält bis zu 40 Erstellungsregeln. Jede nennt den `step`, dessen Badge sie trägt, und das `label`, das dort angezeigt wird, solange sie nicht erfüllt ist, ein optionales `when: Ref` und genau eines von:

- `value: Ref` mit `min` und/oder `max` (jeweils eine Zahl oder ein Ref).
- `rows: { list, filter?, sum? }` mit `min` und/oder `max`: die Zahl der Zeilen der Liste oder die Summe der Zahlenspalte `sum` über die Zeilen, die `filter` behält (`{ column, equals?, below?, above? }`).
- `distinct: { list, column }`: Keine zwei Zeilen teilen sich einen ausgefüllten Wert (ohne Beachtung der Groß- und Kleinschreibung und von Leerzeichen).
- `approved: fieldId`: Ein boolesches Feld, das eingeschaltet sein muss, etwa die Zustimmung eines Storytellers.

```json
{
  "constraints": [
    {
      "id": "disadvantage_cap",
      "label": "Disadvantages give at most 50 points.",
      "step": "traits",
      "rows": { "list": "traits", "filter": { "column": "cost", "below": 0 }, "sum": "cost" },
      "min": -50
    }
  ]
}
```

Eine nicht erfüllte Regel blockiert nie Back, Next oder **All fields**.

**Berechnete Werte und Wirkungen für einen einzelnen Wurf (Capability API 1.156).** Ein Attribut kann `value: Ref[]` (1 bis 8) tragen: Sein Wert ist deren Summe, in seinem `min` und `max` gehalten und schreibgeschützt angezeigt. Ein Attribut in Blades ist die Summe seiner markierten Aktionen; Perception in GURPS ist `[{ "abilityScore": "iq" }, { "field": "perception_bought" }]`, und Fertigkeiten, die damit würfeln, folgen dem, was gekauft wurde. Abgeleitete Werte, Obergrenzen und Fertigkeiten dürfen einen berechneten Wert lesen, aber keiner davon darf einen anderen lesen, auch nicht über einen abgeleiteten Wert. Der Erstellungsassistent setzt nie einen, und alles, was dafür gespeichert ist, wird ignoriert.

Eine Liste kann `contextual` deklarieren, damit ihre Zeilen für einen Wurf gelten, wenn der Game Master sie nennt:

```json
{
  "id": "stunts",
  "label": "Stunts",
  "maxItems": 10,
  "columns": [
    { "id": "name", "label": "Name", "type": "text", "maxLength": 80 },
    { "id": "skill", "label": "Skill", "type": "text", "maxLength": 40 },
    { "id": "bonus", "label": "Bonus", "type": "number", "min": -5, "max": 5, "default": 2 }
  ],
  "contextual": { "name": "name", "skill": "skill", "bonus": "bonus" }
}
```

`name` ist die Spalte, über die der Game Master eine Zeile nennt. `skill` (optional) enthält die Fertigkeit, für die eine Zeile gilt, per ID oder Beschriftung; eine leere Zelle gilt für jede Probe. `bonus` (eine Zahlenspalte) und `dice` (eine Würfelspalte) addieren zur Probe, bei einem Pool-Regelsatz als Würfel. `to: "saves"` lässt Zeilen stattdessen für Rettungswürfe gelten. Bei einem Pool-Regelsatz gibt `check: { dice?, successes?, double?, explode? }` jeder angewendeten Zeile dieselbe Wirkung auf den Pool, etwa eine Spezialisierung, deren Zehnen explodieren.

Ein Katalogeintrag kann `mechanics.contextual` tragen, mit `effects` (`own-checks-advantage` und die anderen Proben- und Rettungswurfwirkungen), `modifiers` für `checks` oder `saves`, eingrenzenden `skills` und `saves`, einer `check`-Wirkung für Pools und `cost: [{ "pool": "...", "amount": 1 }]`, einmal bei dem Wurf bezahlt, auf den sie angewendet wird. Der Game Master schreibt `apply="Strong Back; Quick Eye"` (bis zu vier Namen) an eine Probe. Nur Namen, die für diese Probe gelten, verändern sie: Eine Zeile für eine andere Fertigkeit, ein Name, den sich zwei Zeilen teilen, und Kosten, die der Pool nicht decken kann, ändern nichts. Eine Zeile zu besitzen, verändert nie von selbst einen Wurf. Der Datensatz listet in `from` auf, was angewendet wurde.

**Gewürfeltes und vom Bogen gelesenes Startgeld (Capability API 1.157).** Eine Münzzeile der Startausrüstung kann statt `count` ein `roll` (Würfel wie `"2d6"`) oder ein `countFrom` (ein vom Bogen des Besitzers gelesener Ref) tragen, nie beides, und `times` (1 bis 10.000) multipliziert beides:

```json
{ "coins": "gold", "roll": "5d4", "times": 10 }
```

Die Auswahl zeigt die Würfel an („5d4 gold, rolled when taken“). Der Wurf geschieht einmal, wenn die Gruppe oder der Besitzer das Paket nimmt; ein erneutes Öffnen der Auswahl kann also nicht noch einmal würfeln. `countFrom` liest den eigenen Bogen des Besitzers, etwa ein Feld Credit Rating; ein Besitzer ohne Bogen wird abgelehnt, und ein Betrag von 0 fügt nichts hinzu. Gegenstandszeilen behalten ihr festes `count`.

**Einmal gesetzte Startwerte (Capability API 1.158).** Ein Schritt des Erstellungsassistenten mit `kind: "initialize"` schreibt Startwerte, wenn der Spieler sie bestätigt, und nie wieder von selbst:

```json
{
  "id": "start",
  "label": "Starting values",
  "kind": "initialize",
  "writes": [
    { "field": "san_start", "value": { "abilityScore": "pow" } },
    { "field": "xp", "remaining": "creation" }
  ]
}
```

Jeder Schreibvorgang nennt ein Bogenfeld und entweder einen `value` (einen festen Wert oder bei einem Zahlenfeld einen Ref) oder `remaining`, was ein Pool des Erstellungsassistenten noch nicht ausgegeben hat. Der Schritt zeigt jedes Feld jetzt und worauf es gesetzt wird; sein Badge wartet, bis der Spieler sie setzt. Die geschriebenen Werte werden mit dem Erstellungsassistenten gespeichert; ihn erneut zu öffnen, den Charakter zu importieren oder POW später zu ändern, schreibt sie also nie wieder. Hat sich der Bogen seitdem geändert, zeigt der Schritt, was ein erneutes Setzen ersetzen würde, und nur **Set again** (erneut setzen) durch den Spieler tut es. In einen Charakter, der so beschrieben wird, wie er bereits ist, wird nie geschrieben.

Ein laufender Pool kann `startFrom: Ref` deklarieren, um bei einem vom Bogen gelesenen Wert statt voll oder leer zu beginnen, gehalten zwischen 0 und seinem Maximum, und eine einfache Leiste kann `startFrom` anstelle von `default` deklarieren. Zeigt es auf ein Feld, das ein Initialisierungsschritt geschrieben hat, beginnt SAN bei dem POW, aus dem es gesetzt wurde, und bleibt, wo das Spiel es hinterlässt: Ein gespeicherter laufender Wert hat immer Vorrang vor dem Startwert des Pools.

**Wahlen und Zeilen mit Preis (Capability API 1.159).** Ein Katalogschritt oder ein Zeilenschritt kann einen `pool` des Erstellungsassistenten und eine `cost` nennen; was der Spieler wählt oder schreibt, wird dann aus demselben Pool bezahlt wie die Ausgabeschritte. Die Kosten eines Katalogschritts sind eine Zahl oder `{ "filter": "tier" }`, der eigene Zahlenfilter des Eintrags. Die Kosten eines Zeilenschritts sind eine Zahl oder `{ "column": "cost" }`, aus jeder Zeile gelesen; ein negativer Preis ist eine Gutschrift, begrenzt auf das `creditLimit` des Pools, sodass ein Makel Eigenschaften finanziert. Ein Zeilenschritt kann außerdem `from` nennen, einen Zeilenkatalog, der seine Liste befüllt: Der Spieler fügt beliebig oft eine Kopie der Zeile eines Eintrags hinzu, und jede Kopie ist seine eigene Zeile, einzeln bepreist und entfernt:

```json
{
  "id": "charms",
  "label": "Charms",
  "kind": "rows",
  "list": "charms",
  "pool": "bonus",
  "cost": { "column": "cost" },
  "from": "charm_book"
}
```

Eine Wahl, die der Pool nicht bezahlen kann, wird nicht angeboten. Wahlen und Zeilen mit Preis werden zuerst bezahlt und nie für den Spieler verkauft: Überzieht das Entfernen eines Makels den Pool, gelten die Käufe der Ausgabeschritte nicht mehr, bis der Spieler das repariert, und das Badge jedes Schritts mit Preis zählt die Reparatur. Eine Summe, die eine Spalte nicht überschreiten darf (Ritualstufen), ist eine Erstellungsregel (1.155) mit `rows.sum` und `max`.

**Erstellungsprofile und frühere Phasen (Capability API 1.160).** `sheet.builder.profiles` (bis zu 16) lässt einen Charaktertyp, einen Beruf oder ein Paket eigene Schritte und Budgets mitbringen:

```json
"profiles": [
  { "id": "dragon", "label": "Dragon-Blooded", "when": { "field": "dragon" },
    "steps": ["aspect_gifts"], "budgets": { "bonus": { "const": 15 } } },
  { "id": "lunar", "label": "Lunar", "when": { "field": "lunar" },
    "steps": ["moon_gifts"], "budgets": { "bonus": { "const": 18 } } }
]
```

Das erste Profil, dessen `when` über 0 liest, ist das des Charakters, und der Erstellungsassistent sagt, welches. Ein Schritt, den irgendein Profil auflistet, wird nur angezeigt, solange ein Profil, das ihn auflistet, das des Charakters ist; seine Antworten bleiben erhalten, während er ausgeblendet ist, und gewähren nichts. Die `budgets` eines Profils ersetzen die eigenen dieser Pools; ein Typwechsel behält also nie das Budget des anderen Typs, und Käufe, die es nicht mehr deckt, gelten nicht mehr, bis der Spieler sie repariert.

Ein Katalogschritt oder ein Initialisierungsschritt kann `reads: { "before": "step_id" }` deklarieren. Das `offeredWhen` seiner Einträge und sein `upTo` (oder die Werte des Initialisierungsschritts) lesen den Bogen dann so, wie die Schritte vor diesem Schritt ihn ergeben: Alles, was spätere Schritte gewählt, gewährt oder gekauft haben, wird zurückgenommen, und was der Spieler eingetippt hat, bleibt erhalten. Ein Mehrfachklassenschritt liest die Attributswerte vor der Erhöhung dieser Stufe; ein Snapshot der Humanity liest die Tugenden vor den Bonuspunkten, egal wie oft der Spieler zwischen den Schritten hin und her gewechselt ist.

**Zeilen, die eigene Proben sind (Capability API 1.161).** Eine Liste kann bis zu vier `checks` deklarieren; jede Zeile, die der Spieler schreibt, ist dann eine Probe, die der Game Master über ihren Namen verlangen kann:

```json
"checks": [{ "id": "science", "name": "name", "rating": "rating", "ability": "edu" }]
```

`name` ist die Textspalte, über die eine Zeile aufgerufen wird, und `rating` die Zahlenspalte, die ihr Wert ist; `ability` (optional) wird so addiert wie das Attribut einer Fertigkeit. Science (Physics) und Science (Biology) sind zwei Zeilen und zwei Proben mit jeweils eigenem Wert. Zwei Proben in einer Liste sind zwei Haltungen, die auf einem Wert beruhen, jede mit einem `label`, das der Game Master nach dem Namen der Zeile sagt: „Fire stew (bold)“ und „Fire stew (careful)“. Die eigenen Fertigkeiten, Rettungswürfe und Attribute des Bogens werden zuerst abgeglichen. Ein Name, den sich zwei Zeilen teilen, ist überhaupt keine Probe, bis eine davon umbenannt wird, und die Probe einer gelöschten Zeile verschwindet mit ihr. Der Bogenblock des Game Master listet jede Zeilenprobe mit ihrer Zahl auf, und `with=` funktioniert wie bei einer Fertigkeit. Ein Zeilenschritt, der über die Wertspalte bepreist wird (1.159), kauft die Werte aus dem Erstellungspool.

**Erstellungswürfe mit ihren Würfeln aufbewahrt (Capability API 1.162).** Erstellungswürfel sind `{ "count", "sides", "keep"?, "add"?, "multiplier"? }`: die höchsten `keep` Augenzahlen plus `add`, mal `multiplier`; `(2d6+6) x 5` in CoC ist also `{ "count": 2, "sides": 6, "add": 6, "multiplier": 5 }`.

Das `methods.rolls` eines Attributsschritts würfelt jeden Wert der Reihe nach, jeden mit den Würfeln seiner eigenen Gruppe, und lässt nie einen Wurf zu einem anderen Wert wechseln (Methode `"rolls"`):

```json
"rolls": [
  { "abilities": ["str", "con", "dex", "app", "pow"], "dice": { "count": 3, "sides": 6, "multiplier": 5 } },
  { "abilities": ["siz", "int", "edu"], "dice": { "count": 2, "sides": 6, "add": 6, "multiplier": 5 } }
]
```

Ein Schritt mit `kind: "roll"` listet bis zu 12 `rolls` auf, jeder in ein Zahlenfeld (`field`) geschrieben: Luck, Trefferpunkte, Startgeld. `best` (2 oder 3) würfelt so oft und behält den besten Wurf; `floor` (eine Zahl oder ein Ref) ist das Mindeste, was das Ergebnis sein darf, etwa 1 Trefferpunkt oder ein Potenzial nie unter seinem Wert; `gain` macht daraus stattdessen eine Verbesserungsprobe, gewürfelt gegen das Feld, die `gain` nur addiert, wenn der Wurf darüber liegt, wie bei der EDU-Verbesserung in CoC. Jeder Wurf wird mit seinen Augenzahlen aufbewahrt und mit ihnen angezeigt. Ein bereits gemachter Wurf bleibt bestehen; das erneute Öffnen des Erstellungsassistenten würfelt nie noch einmal, und nur ein Schritt mit `retry: true` bietet das an. Für einen beschriebenen Charakter wird nie gewürfelt.

**Gezählte Auswahlen und Einschränkungen bei der Erstellung (Capability API 1.151).** Jeder Schritt kann `when: Ref` tragen (nur anzeigen und anwenden, solange der nicht laufende Bogenwert über null liegt) und `requiredWhen: Ref` (unerledigte Auswahlen nur in seinem Badge zählen, solange der Wert über null liegt). Ausgeblendete Schritte behalten ihre gespeicherten Antworten. Next und Back bleiben auch bei unvollständigen oder ungültigen Auswahlen verfügbar; All fields bleibt die freie Bearbeitung.

Katalogschritte können bis zu 12 `quotas` deklarieren, jede mit einem der typisierten Filter des Katalogs:

```json
{
  "id": "ratings",
  "label": "Skill ratings",
  "kind": "catalog",
  "catalog": "ratings",
  "min": 10,
  "max": 10,
  "distinctBy": "skill",
  "quotas": [
    { "filter": "rating", "value": 4, "min": 1, "max": 1 },
    { "filter": "rating", "value": 3, "min": 2, "max": 2 },
    { "filter": "rating", "value": 2, "min": 3, "max": 3 },
    { "filter": "rating", "value": 1, "min": 4, "max": 4 }
  ]
}
```

Das ist eine Pyramide im Stil von Fate, wenn der Katalog jede Fertigkeit auf jedem Wert anbietet. Einträge deklarieren ihre Ausbildungsgewährungen mit ausdrücklichen IDs der Ausbildungsstufen; numerische Filterwerte erfinden nie eine Stufenzuordnung. Für eine Quote gilt `0 <= min <= max <=` das Maximum des Schritts. Minima wirken sich auf das Badge aus; Maxima deaktivieren weitere passende Wahlen. `distinctBy` nennt einen vorhandenen Filter: Wahlen dürfen sich dessen Wert (oder bei einem Tag-Filter irgendein Tag) nicht teilen, und ein Eintrag, dem dieser Filter fehlt, kann nicht zählen. Ansonsten richtet sich die Verschiedenheit nach der Eintrags-ID. `quotaBelow: { "filter": "tier" }` verlangt für positive ganzzahlige Stufen über 1 echt mehr aktive Wahlen auf Stufe n−1 als auf Stufe n. Stufe 1 ist die Basis. Das Entfernen einer tragenden Wahl macht überzählige höhere Wahlen inaktiv, nimmt ihre Gewährungen zurück und behält ihre Antworten zur Reparatur.

Die Plätze `abilities.choose`, `trained.choose`, `choose` eines Ausbildungsschritts und `entries.choose` nehmen an:

- `id`: Eine stabile Bogen-ID. Neue Plätze sollten sie verwenden; gespeicherte Antworten überstehen dann ein Umsortieren. Alte Plätze ohne IDs behalten ihre positionsbezogenen Schlüssel. IDs sind über alle Auswahlen, die ein Quellschritt anbietet, eindeutig.
- `countFrom: Ref`, mit einem ausdrücklichen `max` (1–20, bei Attributen höchstens 6). `count` bleibt die feste Anzahl, wenn `countFrom` fehlt. Eine dynamische Anzahl wird abgerundet und zwischen null und `max` begrenzt. Sie liest vorhandene Operatoren abgeleiteter Werte, nie ausführbare Ausdrücke.
- `excludeChoices: ["background/restricted"]`: IDs früherer Auswahlen derselben Art, geschrieben als `source_step/choice_id`. Diese schließen die aktiven Antworten der früheren Auswahl aus, einschließlich Ersetzungen. Verweise müssen in der Definition oder in derselben Katalogdatei überprüfbar sein. Direkt eingebettete frühere Auswahlen von Gewährungen oder ausdrückliche Ausbildungsschritte können also eine spätere Katalogdatei speisen; Verweise in eine andere externe Katalogdatei werden abgelehnt. Auswahl-IDs über alternative Einträge eines Schritts hinweg müssen ebenfalls eindeutig sein.

Attributsauswahlen nehmen zusätzlich `from` an, geschnitten mit den Attributen des Bogens und `except`. Für verschiedene Boosts in PF2e kann eine Auswahl `restricted` `["str", "dex"]` anbieten, gefolgt von einer Auswahl `free_boost`, die `background/restricted` ausschließt. Eintragsauswahlen nehmen dieselben `quotas`, `distinctBy` und `quotaBelow` an wie Katalogschritte, begrenzt durch `max` oder `count`; sie schreiben weiterhin Zeilen, ohne die eigenen Gewährungen der gewählten Einträge anzuwenden.

Ausbildungsauswahlen nehmen zusätzlich `tier` an (eine angebotene Stufe über „ohne Ausbildung“, die die Stufe der Gewährung oder des Erstellungsassistenten überschreibt), `only: "any" | "trained" | "untrained"` und `onDuplicate: "replace"`. Die Berechtigung liest manuelle Ausbildung und frühere aktive Gewährungen, ohne die eigenen vorherigen Schreibvorgänge des Erstellungsassistenten. Eine gewählte Fertigkeit, die durch diese Quellen bereits ausgebildet ist, öffnet einen getrennten Ersatzplatz unter den nicht ausgebildeten Fertigkeiten derselben Art und behält die ursprüngliche Antwort. Ersetzungen beachten die Ausschlüsse und die Stufe der Auswahl. Ihr gespeicherter Schlüssel ist der Schlüssel des ursprünglichen Platzes plus `/replacement`. Die Ränge eines Menschen außerhalb seiner Karriere können eine frühere Karriereauswahl ausschließen und `only: "untrained"` verwenden; ein Karrierewechsel behält ungültige spätere Antworten.

Bedingungen und neue Platzanzahlen dürfen nur Werte lesen, die frühere Schritte verändert haben; das verhindert sich selbst freischaltende oder zyklische Gewährungen. Eine Platzanzahl kann keine Bogenwerte lesen, wenn eine spätere externe Katalogdatei sie verändern könnte; setze ihren Quellschritt früher an oder lass diesen Katalog direkt eingebettet. Eine Bedingung kann ein vorhandenes abgeleitetes `enumTable` verwenden, um einen Unterrassenschritt nur für eine Abstammung verpflichtend zu machen. `requiredWhen` wirkt sich nur auf Badges aus und darf jeden gültigen nicht laufenden Wert lesen. Neue eingeschränkte Auswahlen bleiben offen, wenn passender Inhalt fehlt, mit der Erklärung „not configured“. Sie senken ihre verlangte Anzahl nie still auf den verfügbaren Inhalt. Manuelle Bearbeitungen des Bogens und beschriebene Charaktere behalten die bestehenden Zuständigkeitsregeln des Erstellungsassistenten.

Ein Charakter, der ohne den Erstellungsassistenten erstellt wurde (ein Bogen, der nicht leer ist und noch keine Entscheidungen im Erstellungsassistenten hat), öffnet sich **described** (beschrieben): Wahlen halten fest, was der Charakter bereits ist (die Erhöhungen seiner Rasse gelten als bereits in seinen Werten enthalten), und ändern nichts auf dem Bogen, bis der Spieler **Done: let picks change the sheet** (fertig: Wahlen dürfen den Bogen ändern) wählt. Von da an nimmt das Ändern einer Wahl zurück, was die beschriebene gegeben hat.

Ohne `tier` geht die Ausbildung auf die erste Stufe über „ohne Ausbildung“, die der Bogen anbietet; ein Bogen, der eine halbe Stufe anbietet (wie die Fertigkeiten in 5e), setzt `"tier": "proficient"`.

<a id="items-what-a-party-carries"></a>

## Gegenstände: Was eine Gruppe mit sich führt

Rüstungen, Waffen, Tränke, Ausrüstung, Munition und Geld sind Gegenstände. Ein optionaler `items`-Block deklariert die Begriffe, in denen jeder Gegenstand deines Regelsatzes geschrieben ist, und ein Katalog mit `holds: "items"` listet die Gegenstände selbst auf. Beides braucht Capability API 1.49. Darüber hinaus brauchen: `rarityCaps` und `propose` des Blocks, die die vom Game Master erfundenen Gegenstände regeln, 1.51; ein Wert, der die Gegenstände eines Charakters liest (`itemStat`), 1.52; was ein Gegenstand beim Tragen oder Mitführen an Proben bewirkt, samt den `bonus`-Grenzen des Blocks, 1.53; was ein Gegenstand von seinem Träger verlangt und die Attribute, die er verändert, 1.54; der `attack` einer Waffe 1.55; was ein Gegenstand im Kampf bewirkt, 1.56; was eine Waffe verschießt und geladen hält, 1.57; die Modi einer Waffe, ihr Angriff mit der Nebenhand, ihr Mindestschaden und ihre Zustände bei einem Treffer 1.58; was die Nutzung eines Gegenstands im Kampf bewirkt, samt der Ladungen, die er hält, 1.59; eine Nutzung, die einen Pool wiederherstellt, 1.60; bei einer Rast zurückgewonnene Ladungen oder ein Gegenstand, der zerbricht, wenn er leer ist, 1.61; eine Nutzung, die zuerst eine Probe verlangt (`gate`), 1.62; Beutetabellen und die Beute einer Kreatur 1.63; eine Beutezeile, die Münzen fallen lässt, oder eine Ebene, die Münzen herausnimmt, 1.64; ein Markt, der `sold`-Ort eines Gegenstands und ein `service` 1.65; ein Markttag (eine Kasse, `buyBack`, der `stock` eines Händlers, eine `limited`-Anzahl oder ein `sold` ohne Ort) 1.69; ein Zusatzeffekt, der bei gehaltenen Waffen auslöst (`weapons`), 1.70; Startausrüstung (`startingGear`) 1.78; und ein riskanter Gegenstand, eine Fälschung oder ein unehrlicher Händler 1.79.

### Der Gegenstandsblock

Der Block steht in `items` auf der obersten Ebene der Datei. Hier der Block aus Ember Roads, leicht gekürzt:

```json
"items": {
  "categories": [
    { "id": "weapon", "label": "Weapon" },
    { "id": "armor", "label": "Armor" },
    { "id": "ammunition", "label": "Ammunition" }
  ],
  "rarities": [
    { "id": "common", "label": "Common" },
    { "id": "storied", "label": "Storied" }
  ],
  "tags": [
    { "id": "thrown", "label": "Thrown" },
    { "id": "ranged", "label": "Ranged" },
    { "id": "two_handed", "label": "Two-handed" },
    { "id": "arrow", "label": "Arrow" }
  ],
  "stats": [
    { "id": "bulk", "label": "Bulk", "type": "number", "min": 0, "max": 10, "default": 0 },
    { "id": "guard", "label": "Guard", "type": "number", "min": 0, "max": 4, "default": 0 },
    { "id": "damage", "label": "Damage", "type": "dice", "example": "1d6" },
    { "id": "swing", "label": "Rolls with", "type": "enum", "values": ["brawn", "wits", "heart"], "default": "brawn" },
    { "id": "reach", "label": "Reach", "type": "enum", "values": ["close", "near", "far"], "default": "close" }
  ],
  "slots": [
    { "id": "body", "label": "Body", "count": 1 },
    { "id": "hands", "label": "Hands", "count": 2 }
  ],
  "carry": { "stat": "bulk", "encumberedAbove": { "derived": "load" }, "limit": { "const": 12 } },
  "rarityCaps": [
    { "rarity": "common", "stats": { "guard": 1 }, "bonus": 1 },
    { "rarity": "storied", "stats": { "guard": 3 }, "bonus": 2 }
  ],
  "currencies": [
    {
      "id": "coin",
      "label": "Coin",
      "perWeight": 100,
      "units": [
        { "id": "bit", "label": "bits", "value": 1 },
        { "id": "mark", "label": "marks", "value": 10 },
        { "id": "sovereign", "label": "sovereigns", "value": 100 }
      ]
    },
    {
      "id": "salt",
      "label": "Salt",
      "perWeight": 10,
      "units": [
        { "id": "pinch", "label": "pinches", "value": 1 },
        { "id": "cake", "label": "cakes", "value": 20 }
      ]
    }
  ]
}
```

- `categories`: Eine bis 24. Jeder Gegenstand hat genau eine, etwa Rüstung, Waffe oder Trank.
- `rarities`: Optional, höchstens 12. Liste sie von der häufigsten bis zur seltensten auf.
- `tags`: Optional, höchstens 48. Eigenschaften, die ein Gegenstand haben kann, etwa „geworfen“ oder „versilbert“.
- `stats`: Optional, höchstens 24. Die Zahlen und Wörter, die ein Gegenstand trägt, genau wie eine Listenspalte deklariert: `number`, `text`, `boolean`, `enum` oder `dice`, mit Bereich, Werten und Standardwert, sofern der Typ sie hat. `promptVisible` (Standard `true`) legt fest, ob der Game Master den Gegenstandswert neben dem Gegenstand sieht. Setze es auf `false` für etwas, das nur der Spieler sehen soll, etwa wo ein Gegenstand versteckt ist.
- `slots`: Optional, höchstens 12. Wo ein Gegenstand getragen oder gehalten wird und wie viele dieser Trageplätze ein Charakter hat, von 1 bis 20.
- `binding`: Optional. Einstimmung, Investitur oder alles andere, was begrenzt, wie viele Gegenstände ein Charakter gleichzeitig gebunden haben darf. `label` ist die Bezeichnung, und `max` ist ein vom Bogen des Charakters gelesener Wert, etwa `{ "abilityScore": "nerve" }` oder ein abgeleiteter Wert. Er kann den Live-Zustand nicht lesen, denn wie viele Gegenstände ein Charakter binden darf, ändert sich nicht mit jedem Treffer.
- `carry`: Optional. `stat` nennt den Zahlenwert, der das Gewicht eines Gegenstands ist; sein `min` ist 0 oder mehr. `encumberedAbove` gibt an, wie viel ein Charakter tragen kann, bevor er belastet ist, und `limit` (optional), wie viel er überhaupt tragen kann. Beides wird wie `binding.max` vom Bogen gelesen. Ohne `carry` bedeutet Gewicht nichts, und niemand ist je belastet.
- `currencies`: Optional, höchstens sechs Familien mit je einer bis zehn Münzen.
  - Münzen einer Familie werden nach `value` ineinander umgerechnet, gezählt in der kleinsten Münze der Familie. Die kleinste Münze ist also 1 wert, und keine zwei Münzen einer Familie sind gleich viel wert.
  - Zwei Familien werden nie ineinander umgerechnet. Die Münze einer zweiten Nation oder die Gefälligkeiten eines Settings bilden eine eigene Familie.
  - Die ID einer Münze ist über alle Familien hinweg eindeutig, weil die Kosten eines Gegenstands nur die Münze nennen.
  - Das `label` einer Münze ist ihr Name für eine beliebige Anzahl davon (`pennies`); `one` (Capability API 1.89) ist ihr Name für genau eine (`penny`), verwendet überall, wo ein Preis, ein Geldbeutel oder ein Markt eine einzelne Münze nennt. Ohne diese Angabe steht das `label` auch für eine einzelne Münze.
  - `perWeight` (optional und nur neben `carry`) gibt an, wie viele Münzen der Familie eine Einheit des Traglastwerts wiegen.
  - Münzen sind das Geld der Gruppe und werden wie jeder Gegenstand in den Taschen getragen (siehe unten „Geld“).
- `rarityCaps`: Optional, höchstens einer je Seltenheit. Das Höchste, was ein vom Game Master erfundener Gegenstand bei dieser Seltenheit geben darf: den größten Wert jedes in `stats` genannten Zahlenwerts, innerhalb des eigenen Bereichs dieses Werts und als ganze Zahl bei einem Wert, der ganze Zahlen nimmt, sowie `bonus` (Capability API 1.53), den größten festen Bonus, den einer seiner Modifikatoren beim Tragen oder Mitführen addieren darf. Bei einer Seltenheit mit `bonus` wird ein Bonus in Würfeln weggelassen, weil sich Würfel nicht auf eine Zahl begrenzen lassen; ein Abzug wird nie begrenzt. Ein erfundener Gegenstand wird darauf begrenzt; die Gegenstände in deinen Katalogen gehören dir und werden nie begrenzt.
- `propose`: Standardmäßig `true`. `false` verbietet dem Game Master, Gegenstände deines Regelsatzes zu erfinden.
- `native`: Standardmäßig `true`. `false` schaltet in den Spielen deines Regelsatzes die eigenen untypisierten Gegenstände von Game Mode ab (siehe **Was Gegenstände liest**). Der Game Master kann weiterhin Gegenstände erfinden, geschrieben in den Begriffen deines Regelsatzes.
- `freeform`: Was aus einem Gegenstand wird, den der Spieler eintippt. `"plain"` (Standard) behält ihn wie bisher als Gegenstand ohne Regeln. `"refuse"` erlaubt nur Gegenstände deines Regelsatzes.
- `lootTables` (Capability API 1.63): Optional, höchstens 24. Was die Kreaturen eines gewonnenen Kampfes und das `[loot:]` des Game Master fallen lassen (siehe unten „Beute“).

### Ein Gegenstand

Ein Gegenstandskatalog deklariert kein `feeds`:

```json
{ "id": "outfitter", "label": "Outfitter", "holds": "items", "entries": [] }
```

Jeder Eintrag trägt ein `item` statt `rows` oder einer `creature`:

```json
{
  "id": "hunting-bow",
  "label": "Hunting bow",
  "summary": "Yew, waxed string, and a grip worn smooth by someone else's hand.",
  "item": {
    "category": "weapon",
    "rarity": "common",
    "tags": ["ranged", "two_handed"],
    "stats": { "bulk": 2, "damage": "1d8", "swing": "wits", "reach": "far" },
    "slots": { "hands": 2 },
    "cost": { "amount": 3, "unit": "sovereign" }
  }
}
```

- `id`, `label`, `summary` und `filters` funktionieren wie bei jedem Eintrag. Die Beschriftung ist der Name des Gegenstands.
- `category` ist erforderlich. `rarity` und `tags` sind optional, und alle drei nennen die eigenen IDs des Blocks. Eine Seltenheit kann ein Gegenstand nur haben, wenn der Block welche deklariert.
- `stats`: Werte für die Gegenstandswerte des Blocks. Jeder muss ein Wert sein, den der jeweilige Gegenstandswert annehmen kann.
- `slots`: wie viele Trageplätze jeder Art der Gegenstand belegt, nie mehr, als ein Charakter hat.
- `stack`: wie viele ein Stapel höchstens fasst, von 1 bis 999.999. Ohne Angabe fasst ein Stapel so viele wie jeder Stapel in Game Mode. Ein Gegenstand mit `charges` bildet immer einen Stapel für sich allein.
- `cost`: ein ganzzahliger `amount` einer Münze, benannt über ihre `unit`-ID. Die Auswahl zeigt ihn, und der Game Master sieht ihn neben dem Gegenstand (siehe unten „Geld“).
- `sold` (Capability API 1.65): `{ "place": "city" }`, der kleinste Ort deines Markts, der den Gegenstand verkauft, mit Vorrang vor jeder Regel, die etwas anderes sagen würde. Mit 1.69 darf es stattdessen oder zusätzlich angeben, wie viele ein Ort an einem Tag vorrätig hat (`"limited": 2` oder `"limited": "1d3"`) (siehe unten „Märkte“).
- `service` (Capability API 1.65): `true` für Unterkunft, Überfahrt, einen Segen: wie ein Gegenstand gekauft, aber nie mitgeführt. Der Kauf bezahlt nur; nichts anderes legt eine Dienstleistung in eine Tasche (ein Hinzufügen wird als `service` abgelehnt), und die Auswahl lässt Dienstleistungen weg. Eine Dienstleistung hat eine `cost` und nichts, was das Tragen oder Nutzen betrifft (`slots`, `stack`, `binds`, `worn`, `carried`, `requires`, `attack`, `use`, `charges`).
- `binds`: Der Gegenstand muss gebunden sein, bevor er beim Tragen etwas bewirkt. `restriction` (optional) beschreibt in Worten, wer ihn binden darf, und `cursed: true` markiert einen, der nicht mehr loslässt. Nur ein Regelsatz mit `binding` kann Gegenstände haben, die gebunden werden.
- `worn` und `carried` (optional, Capability API 1.53): was der Gegenstand an den Proben und Rettungswürfen seines Besitzers bewirkt, solange er getragen wird und solange er nur mitgeführt wird, (1.54) die Attribute, die er setzt oder erhöht, und (1.56) was er im Kampf bewirkt. Siehe [Proben außerhalb eines Kampfes](#checks-outside-a-fight) und [Rüstung und getragene Wirkungen im Kampf](#armor-and-worn-effects-in-a-fight).
- `requires` (optional, Capability API 1.54): was der Gegenstand von seinem Träger verlangt und was gilt, solange dieser die Anforderung nicht erfüllt. Siehe [Proben außerhalb eines Kampfes](#checks-outside-a-fight).
- `attack` (optional, Capability API 1.55): was der Gegenstand als Waffe im Kampf bewirkt, solange er getragen wird, (1.57) was er verschießt und geladen hält und (1.58) seine anderen Modi, ein Angriff mit der Nebenhand, eine Untergrenze für seinen Schaden und die Zustände, die er bei einem Treffer verursacht. Siehe [Waffen im Kampf](#weapons-in-a-fight), [Munition und Nachladen](#ammunition-and-reloading) und [Modi, eine zweite Waffe, eine Untergrenze und Zustände bei einem Treffer](#modes-a-second-weapon-a-floor-and-conditions-on-a-hit).
- `toggle` (optional, Capability API 1.170): ein Schalter, den der Gegenstand trägt, `{ "label", "budget" }`. Ein Kampf bietet ihn als Option auf diesem Budget an („Turn on Flame Tongue: Flames“), das Inventar als Schaltfläche mit der Beschriftung, und die Stellung, in der er zuletzt war, bleibt zwischen Kämpfen am Stapel erhalten; anfangs ist er aus. Ein Gegenstand mit Schalter bildet, solange dieser eingeschaltet ist, einen Stapel für sich allein. Ein `plus`-Bestandteil einer Waffe mit `when: "toggled"` wird nur zugefügt, solange er eingeschaltet ist. Die Flammenzunge in 5e: `"toggle": { "label": "Flames", "budget": "bonus" }` und `"plus": [{ "dice": "2d6", "type": "fire", "when": "toggled" }]`.
- `use` und `charges` (optional, Capability API 1.59): was die Nutzung des Gegenstands bewirkt, im Kampf und außerhalb, und die Ladungen, die er für diese Nutzung bereithält, sowie (1.60) ein Pool, den er wiederherstellt. Siehe [Gegenstände im Kampf nutzen](#using-items-in-a-fight) und [Gegenstände außerhalb eines Kampfes nutzen](#using-items-outside-a-fight).

Ein Gegenstand trägt kein `mechanics`: Was er bewirkt, steht in seinem `item`-Block.

### Was Gegenstände liest

Alles oben Genannte wird beim Import des Regelsatzes geprüft, und deine Gegenstandskataloge werden mit ihm ausgeliefert. Im Spiel liest das Inventar von Game Mode sie:

- **Deine Gegenstände liegen in der Tasche.** Ein Stapel kann einer deiner Gegenstände sein und bleibt dieser Gegenstand, wie auch immer der Spieler ihn nennt. Die Schaltfläche **From the ruleset** (aus dem Regelsatz) im Inventar öffnet eine Auswahl aller Gegenstände, die deine Kataloge auflisten, mit Suche und Filtern des Katalogs. Ein Eintrag, den eine Ebene ausblendet, ist auch dort ausgeblendet.
- **Namen finden deine Gegenstände.** Ein Name, den der Spieler eintippt oder den der Game Master in `[inventory: action="add"]` schreibt und der ohne Beachtung der Groß- und Kleinschreibung dem `label` eines deiner Gegenstände entspricht, fügt diesen Gegenstand hinzu. Teilen sich zwei Gegenstände eine Beschriftung, findet ein Name den, den deine Kataloge zuerst auflisten.
- **`stack`** wird eingehalten: Hinzufügen, Setzen, Zusammenführen oder Weitergeben über die Grenze hinaus füllt den Stapel und beginnt einen neuen.
- **`freeform: "refuse"`** lässt dem Spieler nur deine Gegenstände: die Auswahl und Namen, die deine Gegenstände sind.
- **`native: false`** lässt dem Game Master nur deine Gegenstände und die, die er erfindet: Ein Name, der keines von beiden ist, wird abgelehnt (`not-ruleset-item`). Mehr von etwas bereits Vorhandenem kann weiterhin hinzugefügt werden, und seine Anweisungen sagen ihm das. Ein Kampf fragt kein Modell mehr, was die Gegenstände im Inventar bewirken; es kämpfen also nur deine Gegenstände: in einem Regelsatzkampf deine gehaltenen Waffen und die Nutzungen deiner Gegenstände (siehe unten „Waffen im Kampf“), in einem Classic- oder Tactical-Kampf deine Gegenstände mit `use` (siehe unten „Gegenstände in Classic- und Tactical-Kämpfen“). Was der Spieler eintippt, folgt weiterhin `freeform`, und was die Gruppe mit sich führte, kehrt in jedem Fall in einer neuen Sitzung zurück.
- **Was ein Gegenstand ist**, zeigt der ausgewählte Stapel: Kategorie, Seltenheit und Tags mit ihren Beschriftungen, die Werte, die er gibt, seine Zusammenfassung und wie viele ein Stapel fasst. Die Auswahl zeigt außerdem seine `cost`. Der Game Master sieht jeden deiner Gegenstände im Inventar mit Kategorie, Seltenheit, Tags und den Werten, die du `promptVisible` gelassen hast, etwa `Hand axe [Weapon, Common, Thrown; Damage 1d6, Reach close]`.

- **`slots`**: Ein Gegenstand, der Trageplätze belegt, kann von seinem Träger angelegt werden, solange dieser die Plätze frei hat. Aus einem größeren Stapel wird dafür ein Stück in einen eigenen Stapel genommen. Das Inventar zeigt für jeden Charakter die belegten Trageplätze.
- **`binding`**: Ein Gegenstand mit `binds` kann gebunden werden, bis zu `binding.max`, gelesen vom eigenen Bogen seines Trägers (ein Charakter ohne Bogen liest einen leeren). Ein `cursed`-Gegenstand bleibt nach dem Binden gebunden: Der Spieler kann ihn nicht lösen, ablegen, weggeben oder entfernen, und nur der Game Master kann den Fluch beenden.
- **`carry`**: Ein Gegenstand wiegt seinen Wert von `carry.stat` (ein Gegenstand ohne diesen Wert wiegt nichts), und die Last eines Charakters ist das Gewicht seiner Tasche, gemessen an `encumberedAbove` und `limit` von seinem eigenen Bogen. Ein Gegenstand, der in die gemeinsame Ansicht des Inventars kommt – durch den Spieler oder durch den Game Master ohne `who=` –, geht an den, der ihn tragen kann, ohne belastet zu werden (zuerst der Spieler, dann die Gruppe der Reihe nach). Kann niemand alles nehmen, wird nach dem Platz verteilt, der jedem noch bleibt. Nichts geht über das `limit` von irgendjemandem hinaus: Was niemand tragen kann, bleibt zurück, und der Game Master erfährt das. Gib einem Gewichtswert `"integer": false` für Gewichte wie ein Viertelpfund.
- **Der Game Master erfindet Gegenstände in deinen Begriffen.** Sofern du nicht `propose: false` setzt, kann sein `[inventory: action="add"]` einen neuen Gegenstand beschreiben: `like=` einen deiner Gegenstände als Ausgangspunkt, dann beliebige von `category=`, `rarity=`, `tags=`, `stats=` (`id=value`-Paare), `slots=` (`id=count`), `binds=` (`yes`, `cursed` oder `no`), `worn=` und `carried=` (Änderungen, getrennt durch `;`, jeweils `+N`, `-N`, `advantage`, `disadvantage` oder bei Rettungswürfen `fails`, auf Fertigkeiten oder Rettungswürfe nach Namen oder auf `checks` oder `saves` für alle; `+N` oder `-N` auf den Namen eines Attributs, um es zu erhöhen oder zu senken; und, wo du Kämpfe hast, `+N`, `-N`, Vorteil oder Nachteil auf Angriffe und `+N` oder `-N` auf die Verteidigung oder dein Wort dafür: `worn="+1 Sneak; disadvantage on Sway checks"`, `carried="+1 Brawn"`, `worn="+1 Guard"` oder `none`) und `summary=`, jeder Teil per ID oder Beschriftung. Ein Gegenstandswert, den deine Verteidigung bereits zählt (Guard in Ember Roads addiert den `guard` des Getragenen), ist der Weg, auf dem Rüstung sie erhöht. Eine getragene Änderung der Verteidigung neben einem solchen Wert wird deshalb weggelassen, und die Antwort sagt das: Ein kleines Modell schreibt `guard=1` und `+1 Guard` für ein einziges +1. Gelesen wird auch, was ein kleines Modell oft stattdessen schreibt: eine Zahl nach dem Namen (`Brawn +1`), „bonus“ nach Angriffen oder Verteidigung (`+1 attack roll bonus`), `none` für eine leere Liste von Tags, Werten oder Trageplätzen sowie `worn=`, `carried=` oder `summary=` innerhalb von `stats=`, wenn du keinen Wert dieses Namens hast. Die Engine behält nur, was dein Block hat: Eine unbekannte Kategorie, ein unbekanntes Tag, ein unbekannter Wert, Trageplatz, eine unbekannte Fertigkeit oder ein unbekannter Rettungswurf wird weggelassen, eine Seltenheit, die du nicht hast, wird zu deiner niedrigsten, eine Zahl wird auf den Bereich ihres Werts und dann auf `rarityCaps` für ihre Seltenheit begrenzt, ein Bonus beim Tragen oder Mitführen auf den `bonus` ihrer Seltenheit (auch der Teil, den `like` mitgebracht hat), und ein Name, der einer deiner Gegenstände ist, ist einfach dieser Gegenstand. Die Antwort teilt dem Game Master mit, was geändert wurde (nie bei einem Wert, den du ihm nicht zeigst), und die Details des Gegenstands zeigen dem Spieler jede Änderung. Das Spiel behält den Gegenstand, sodass derselbe Name für den Rest des Spiels dieser Gegenstand ist, und eine neue Sitzung behält ihn, solange noch jemand ihn besitzt.
- Der Game Master kann deine Gegenstände mit seinem Inventarbefehl per `equip` und `unequip` anlegen und ablegen, wenn du `slots` hast, und per `bind` und `unbind` binden und lösen, wenn du `binding` hast; er erfährt nur von den Befehlen, die dein Regelsatz hat. Er sieht die Last, die gebundenen Gegenstände und die Trageplätze jedes Charakters sowie, was getragen oder gebunden ist.

- **Was ein Gegenstand beim Tragen oder Mitführen bewirkt**, zeigen der ausgewählte Stapel und die Auswahl („While worn: -1 on checks (Sneak)“), und der Game Master sieht es neben dem Gegenstand (`worn: -1 on checks (Sneak)`). Proben außerhalb eines Kampfes wenden es an (siehe unten „Proben außerhalb eines Kampfes“).
- **Was eine Waffe bewirkt**, wird auf dieselbe Weise angezeigt („Attack (Action): Brawn to hit, 1d6 + Brawn cut damage“), und ein Kampf bietet sie an, solange sie gehalten wird (siehe unten „Waffen im Kampf“).
- **Was die Nutzung eines Gegenstands bewirkt**, wird ebenso angezeigt („Use (Action): heals 1d4 + 1, range 0 paces, used up“), zusammen mit den verbleibenden Ladungen. Ein Kampf bietet sie an, ebenso die Schaltfläche **Use** (nutzen) im Inventar und das `[inventory: action="use"]` des Game Master (siehe unten „Gegenstände im Kampf nutzen“ und „Gegenstände außerhalb eines Kampfes nutzen“).

In einem Classic- oder Tactical-Kampf tut jeder deiner Gegenstände mit `use` dort, was dieses angibt, und einer ohne wird nicht angeboten (siehe unten „Gegenstände in Classic- und Tactical-Kämpfen“). Unabhängig von `native` kann der Bogen deine Gegenstände lesen (siehe unten), eine gehaltene Waffe ist in einem Regelsatzkampf ein Angriff und verschießt, was sie aus der Tasche nimmt, was ein Gegenstand beim Tragen oder Mitführen bewirkt, zählt dort (siehe unten „Rüstung und getragene Wirkungen im Kampf“), ein Gegenstand mit `use` wird nach seinen eigenen Regeln genutzt, im Kampf und außerhalb (siehe unten „Gegenstände im Kampf nutzen“ und „Gegenstände außerhalb eines Kampfes nutzen“), und deine `currencies` sind das Geld der Gruppe (siehe unten „Geld“).

<a id="items-on-the-sheet"></a>

### Gegenstände auf dem Bogen

Ein Wertverweis kann mit `itemStat` (Capability API 1.52) die Gegenstände lesen, die ein Charakter besitzt. Ember Roads addiert den Guard-Wert der Rüstung, die ein Reisender trägt, zu seinem Guard, also zu dem Wert, den ein Treffer übertreffen muss:

```json
{
  "id": "guard",
  "label": "Guard",
  "op": "sum",
  "of": [{ "const": 6 }, { "abilityMod": "wits" }, { "itemStat": { "stat": "guard", "from": "worn", "pick": "sum" } }]
}
```

- `from`: `"worn"` sind die Gegenstände am Charakter: ein Gegenstand, der Trageplätze belegt, solange er angelegt ist, einer mit `binds`, solange er gebunden ist, und einer mit beidem, solange beides gilt. Ein Gegenstand, der keines von beiden tut, wird nie getragen. `"carried"` ist der Rest dessen, was der Charakter besitzt, und `"all"` ist beides.
- `pick`: `"sum"` addiert den Wert jedes Gegenstands mal seiner Anzahl, `"max"` und `"min"` lesen den höchsten oder niedrigsten Einzelwert, und `"count"` zählt die Gegenstände nach ihrer Anzahl.
- `stat` nennt einen deiner Gegenstandswerte. `sum`, `max` und `min` brauchen einen `number`-Wert. `count` darf ihn weglassen, um jeden Gegenstand zu zählen, oder einen beliebigen Wert nennen, um nur die Gegenstände zu zählen, die ihn geben.
- `slot`, `category` und `tag` (jeweils optional) behalten nur die Gegenstände, die diesen Trageplatz belegen, zu dieser Kategorie gehören oder dieses Tag tragen.
- `default` (optional, ohne Angabe 0) ist der gelesene Wert, wenn kein Gegenstand ausgewählt ist oder keiner davon den Wert gibt.

Gegenstände ändern sich im Spiel. `itemStat` unterliegt daher derselben Regel wie ein Live-Lesezugriff: Das `max` eines Pools oder einer Leiste, der Übungsbonus, `binding.max`, die `carry`-Zahlen und die skalierte Spalte oder Skalierung eines Katalogs können es nicht lesen, auch nicht über einen abgeleiteten Wert. Überall sonst, wo eine Zahl gelesen wird, geht es: in einem abgeleiteten Wert, im `adjust` einer Probe, im `cap` einer Fertigkeit sowie bei Verteidigung, Schadensminderung oder Initiative eines Kampfes.

Die Gegenstände eines Charakters sind die in seiner eigenen Tasche. Die Karte des Spielers (die Karte mit dem Namen, unter dem im Chat gespielt wird, sonst die erste) liest die Tasche des Spielers, jede andere Karte ihre eigene. Nur die Gegenstände deines Regelsatzes zählen, weil ein einfacher Gegenstand keine Werte zum Lesen hat. Der Bogen auf dem Bildschirm, eine Probe, der Bogenblock des Game Master und ein Kampf bei seinem Beginn lesen alle, was jeder Charakter genau in diesem Moment besitzt. Außerhalb eines Spiels, im Bogeneditor oder in einer Importprüfung, besitzt niemand etwas, und `itemStat` liest seinen `default`.

<a id="checks-outside-a-fight"></a>

### Proben außerhalb eines Kampfes

Eine Probe oder ein Rettungswurf, den der Game Master außerhalb eines Kampfes verlangt, liest mehr als den Bogen: die eigenen aktiven Zustände des Charakters, die Stufen, die er erreicht hat, was seine Gegenstände beim Tragen oder Mitführen bewirken und was die Anforderung eines getragenen Gegenstands kostet, solange er sie nicht erfüllt. Es ist dasselbe Vokabular, das die Zustände eines Kampfes verwenden (Capability API 1.53 für die Gegenstandsschlüssel und die Eingrenzung).

Ein Gegenstand gibt mit `worn` an, was er bewirkt, solange er angelegt (und, wo er gebunden wird, gebunden) ist, und mit `carried`, was er bewirkt, solange er nur mitgeführt wird. Der Ledermantel aus Ember Roads knarrt beim Schleichen, und ein Wegstein bringt Karawanenleute dazu, dir zu vertrauen:

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["sneak"], "flat": -1 }] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }] }
```

Beide nehmen die Teile eines Zustands auf, die eine Probe liest:

- `effects`: `own-checks-advantage`, `own-checks-disadvantage`, `own-saves-advantage` und `own-saves-disadvantage`.
- `modifiers`: Änderungen mit `to` an Proben oder Rettungswürfen, mit `flat`, `dice` (und `minus`), `mode` und eigenen `skills` oder `saves`, genau wie bei einem Zustand.
- `failsSaves`: Rettungswürfe, die der Besitzer ohne Wurf nicht schafft.
- `skills` und `saves`: welche Fertigkeiten oder Rettungswürfe die Wirkungen und die Modifikatoren betreffen, die selbst keine nennen.
- `abilities` (Capability API 1.54): Attribute, die er verändert, per ID, jeweils `{ "set": N }` (mindestens N: ein höherer Wert bleibt) oder `{ "add": N }` (eine negative Zahl senkt es). Sie gelten, bevor der Bogen berechnet wird. Alles, was das Attribut liest, liest also das veränderte: der Bogen auf dem Bildschirm, abgeleitete Werte, Proben, der Bogenblock des Game Master und ein Kampf bei seinem Beginn. Zuerst werden die Additionen angewendet, dann das höchste `set`, und `min` und `max` des Attributs gelten weiter. Das Maximum eines Pools oder einer Leiste und der Übungsbonus werden allein aus dem Bogen berechnet; ein Gegenstand verschiebt sie also nicht.

Die Ochsenleder-Handschuhe aus Ember Roads verleihen einem schwachen Griff den eines Viehtreibers:

```json
"worn": { "abilities": { "brawn": { "set": 2 } } }
```

Was ein Gegenstand im Kampf bewirkt (Verteidigung, Angriffe, Geschwindigkeit, die übrigen Kampfwirkungen sowie der Schaden und die Zustände, die er abhält), steht unter [Rüstung und getragene Wirkungen im Kampf](#armor-and-worn-effects-in-a-fight); eine Probe außerhalb eines Kampfes liest nur die oben genannten Teile. Ein Gegenstand gilt einmal, egal wie viele Stapel davon jemand besitzt.

Ein Gegenstand kann von seinem Träger mit `requires` auch etwas verlangen: einen Wert von dessen Bogen (`value`, ein beliebiger Wertverweis, gelesen wie alles im Spiel), das Mindestmaß (`atLeast`) und was gilt, solange der Träger es nicht erreicht (`otherwise`, im selben Vokabular, nur dass es kein Attribut verändern kann, weil die Anforderung eines lesen kann). Bis zu vier. Der Grabspaten aus Gravewatch ist schwere Arbeit für einen schwachen Wächter:

```json
"requires": [
  {
    "value": { "abilityScore": "sinew" },
    "atLeast": 3,
    "otherwise": { "modifiers": [{ "to": "checks", "skills": ["dig"], "flat": -1 }] }
  }
]
```

Eine Anforderung liest das Attribut so, wie die Gegenstände des Trägers es hinterlassen. Handschuhe, die Sinew auf 3 setzen, erfüllen also die des Spatens.

Bei einer Probe gilt:

- Jeder Modifikator, der sie betrifft, addiert seine Zahl, und seine Würfel werden geworfen: eine feste Zahl bei einer Summenprobe, Würfel bei einem Pool. Eine Attributsprobe und eine Probe, die der Regelsatz nicht benennen kann, lesen nur, was nicht eingegrenzt ist, und ein Rettungswurf liest nur, was Rettungswürfe betrifft.
- Vorteil und Nachteil aus allen Quellen, darunter das `mode=` des Game Master, heben sich auf: Ist von beidem etwas da, wird die Probe einmal gewürfelt. Nur ein Regelsatz, der überhaupt zweimal würfelt (`resolution.advantage`), neigt sich in eine Richtung.
- Ein Rettungswurf, den ein Zustand oder Gegenstand scheitern lässt, scheitert ohne Wurf, und dafür wird nichts ausgegeben.
- Der Datensatz nennt, was die Probe verändert hat: `effects="-1"` für die Zahl, `from="Leather coat"` für das, was sie verändert hat, und `automatic="true"` für einen ohne Wurf gescheiterten Rettungswurf. Die Würfelkarte zeigt dasselbe, und der Game Master liest es im nächsten Zug. Ihm wird gesagt, dass die Engine diese Änderungen anwendet, damit er sie nicht noch einmal addiert.

Gravewatch zeigt dasselbe bei einem Pool: Die gebundene Dawn bell fügt Ward einen Würfel hinzu, und Rattled nimmt Soothe und Barter je einen weg.

### Typisierte Verteidigungen aus Zuständen, Stufen, Gegenständen und Bogenzeilen (Capability API 1.132)

`combat.conditions[]` und `combat.levels[]` können `resist`, `vulnerable`, `immune` (je 1–30 Einträge) und `conditionImmunities` (1–40 Zustands-IDs) gewähren. Sie gelten, solange der Zustand besteht oder die Schwelle der Stufe erreicht ist. Eine neu gewonnene Zustandsimmunität beendet diesen Zustand, wenn er bereits aktiv ist, und verhindert, dass er erneut auferlegt wird. Immunität hat Vorrang vor Resistenz; Resistenz und Verwundbarkeit heben sich auf. Mehrere Resistenzen halbieren den Schaden nie zweimal.

`resist` und `immune` verwenden die Kreaturenform: ein Schadenswort oder `{ "type": "bludgeoning",
"except": ["magical"] }`. Jedes benannte Tag am Schlag umgeht diesen Eintrag. `vulnerable` bleibt bei einfachen Schadenswörtern. Dieselbe Ausnahmeform funktioniert bei den `worn`- und `carried`-Wirkungen von Gegenständen. Deklariere die Ausnahme-Tags in `items.tags` und setze sie in die Qualitäten der Waffe oder des Zaubers. Stoneskin ist zum Beispiel eine Zustandszuordnung:

```json
{
  "condition": "stoneskin",
  "resist": [
    { "type": "bludgeoning", "except": ["magical"] },
    { "type": "piercing", "except": ["magical"] },
    { "type": "slashing", "except": ["magical"] }
  ]
}
```

Die Rüstung der Unverwundbarkeit verwendet dasselbe `resist`-Array in ihrer `worn`-Wirkung. Protection from Energy kann `resist: ["fire"]` gewähren; ein Merkmal wie Brave kann `conditionImmunities: ["frightened"]` gewähren. Eine Stufe kann an ihrer Schwelle `resist: ["poison"]` gewähren. Unbekannte statische Schadenswörter werden wie bei Kreaturen gemeldet, wenn `combat.damageTypes` das Vokabular deklariert; ohne diese Deklaration sind Schadenswörter freier Text.

Für Merkmale aus Abstammung oder Katalog enthält `combat.sheetHides` bis zu acht Quellen (ein leeres Array ist erlaubt). Jede nennt eine Bogenliste, eine Text- oder Enum-Spalte dieser Liste und eine der vier Arten. Für einen Zwerg, dessen Merkmalszeile `"poison"` in einer Spalte `resistance` enthält:

```json
"sheetHides": [{ "list": "traits", "column": "resistance", "kind": "resist" }]
```

Jede Zeile trägt durch Kommas getrennte Wörter bei, an den Rändern bereinigt und ohne Beachtung der Groß- und Kleinschreibung abgeglichen; leere Wörter werden übersprungen. Eine Zeile mit `"fire"` hinzuzufügen, fügt Feuerresistenz hinzu; sie zu löschen, entfernt diese Quelle. Resistenz- und Immunitätswörter dürfen `except` enthalten, wie in `"bludgeoning except magical silvered"`. Verwundbarkeiten und Zustandsimmunitäten sind einfache Wörter. Unbekannte deklarierte Schadenswörter im Bogentext werden ignoriert, ebenso unbekannte Zustands-IDs; eine Enum-Spalte für Zustandsimmunitäten darf beim Import nur Zustands-IDs deklarieren. Die Zusammenfassungen für Bogen, Kampf und Game Master enthalten diese Verteidigungen und ihre Ausnahmen.

<a id="weapons-in-a-fight"></a>

### Waffen im Kampf

Ein Gegenstand kann eine Waffe sein (Capability API 1.55). Sein `attack` hat die Form der [Angriffszeilen](#combat-a-fight-your-own-rules-resolve) eines Kampfblocks, mit Werten statt Spalten, und ein [Regelsatzkampf](#combat-a-fight-your-own-rules-resolve) bietet ihn als Angriff an, solange der Gegenstand getragen wird: in den Händen gehalten, die er belegt, und gebunden, wo er gebunden wird. Ein weggesteckter oder nur mitgeführter Gegenstand bietet nichts an, und die Angriffszeilen und die eigenen Aktionen einer Kreatur funktionieren genau wie bisher. Die Handaxt aus Ember Roads:

```json
"attack": {
  "budget": "act",
  "toHit": { "abilities": { "stat": "swing" } },
  "damage": { "dice": { "stat": "damage" }, "abilities": { "stat": "swing" }, "type": "cut" },
  "reach": 2,
  "range": { "normal": 10, "long": 20 }
}
```

- `budget`: das Budget, das er verbraucht, eines aus `combat.economy.budgets`.
- `toHit`: was er zum Treffen addiert. `abilities` sind eine oder mehrere Attributs-IDs, und die beste davon zählt (eine Finesse-Waffe listet zwei). `skill` addiert, was eine Probe dieser Fertigkeit addiert, mit dem Attribut des Angriffs statt dem der Fertigkeit, wie bei einer Angriffszeile. `proficiency` ist ein Wert vom Bogen des Trägers: Liegt er über 0, wird der Übungsbonus des Regelsatzes addiert (`{ "const": 1 }` für immer). `bonus` ist eine Zahl. `sheetBonus` ist eine vom Bogen des Trägers gelesene Zahl, die so addiert wird, wie sie ist, für das, was der Träger zu jeder Waffe einer Art mitbringt, statt für das, was die Waffe ist: Der Kampfstil Archery in 5e gibt jeder Fernkampfwaffe `{ "derived": "archery" }`, einen abgeleiteten Wert, der für einen Bogenschützen 2 und für alle anderen 0 ist (Capability API 1.95; die Angaben des Gegenstands nennen ihn über seinen Namen auf dem Bogen). `target` ist der eigene Zielwert je Würfel eines Pool-Kampfes für den Angriff dieser Waffe (der Spaten aus Gravewatch zählt jeden Würfel ab 6 statt ab der 7 des Pools), und nur ein `dice-pool`-Regelsatz mit veränderlichem `target` darf einen angeben; in einem Summenkampf drückt sein `bonus` dasselbe aus.
- `damage`: die `dice`, die er verursacht, das beste seiner Schadens-`abilities` addiert, ein `bonus` und ein `type`. Ein Summenkampf braucht `dice`; in einem Pool-Kampf verursacht ein Treffer seine Erfolge, und `dice` fügt entsprechend viele weitere Würfel vom Würfeltyp des Pools hinzu. `sheetBonus` (Capability API 1.97) ist eine Zahl vom Bogen des Trägers, die wie beim `toHit` zum Schaden addiert wird, und mit `"oneHanded": true` zählt sie nur, solange die Waffe in einer Hand gehalten wird: nicht bei einer zweihändig geführten `versatile`-Waffe und nicht bei einer, die zwei Trageplätze einer Art belegt. Dueling in 5e gibt `{ "derived": "dueling" }`, 2 für einen Duellanten, der eine Waffe hält. `rerollUpTo` (Capability API 1.98) ist ein Wert vom Bogen des Trägers: Die eigenen Schadenswürfel der Waffe bis einschließlich dieses Werts werden einmal erneut geworfen, und die neue Augenzahl gilt, auch bei den zusätzlichen Würfeln eines kritischen Treffers, aber nur, solange die Waffe zweihändig geführt wird (eine `versatile`-Waffe mit freien Händen oder eine, die zwei Trageplätze einer Art belegt), und nur in einem Summenkampf. Great Weapon Fighting in 5e gibt `{ "derived": "great_weapon_fighting" }`, 2 mit dem Stil.
- `reach` und `range` (`normal` und `long` für das, was darüber hinaus noch reicht) sind in deiner `combat.distance`-Einheit angegeben und brauchen eine solche. Eine Waffe mit beidem wird geworfen, wie eine Angriffszeile: ein Schlag aus der Nähe, ein Wurf darüber hinaus. Ohne beides reicht sie eine Zelle weit.
- `versatile`: die `dice`, die sie stattdessen verursacht, solange in jedem Trageplatz, den sie belegt, unter dem, was ihr Träger trägt, noch einmal so viel Platz frei ist: ein Speer in einer Hand, während die andere frei ist.
- `strikes`: wie viele Angriffe ein Verbrauch kauft, gelesen vom Bogen des Trägers, wie das `strikes` einer Angriffszeile. Eine Waffe ohne diese Angabe ist ein Angriff pro Verbrauch, egal wie viele Angriffe ihr Träger hat.

Jede dieser Zahlen und Wörter kann stattdessen einen eigenen Wert des Gegenstands lesen: `{ "stat": "damage" }` ist der `damage`-Wert des Gegenstands, und ein Wert, für den der Gegenstand nichts angibt, gilt, als wäre die Angabe nicht geschrieben. `abilities` und `skill` lesen einen Enum-Wert, dessen Wörter Attributs- oder Fertigkeits-IDs sind, und `type` einen Text- oder Enum-Wert. Ein Gegenstand, den der Game Master `like=` einer Waffe erfindet, ist also ebenfalls eine Waffe, kämpft mit seinen eigenen Werten und wird wie jeder Wert auf `rarityCaps` begrenzt (ein ausdrücklich geschriebener Wert wird so übernommen, wie er ist). Einer, der ohne Trageplatz und ohne Bindung erfunden wird, wird nie getragen und entsteht deshalb ohne Angriff. Ein kleines Modell beschreibt oft eine Waffe und lässt `like=` weg. Ein Gegenstand, der in einer Kategorie deiner Waffen ohne Ausgangspunkt erfunden wird, kämpft deshalb wie deine Waffe dieser Kategorie, der er dem Namen nach am ähnlichsten ist (ein in beide Richtungen gemeinsames Wort, ein „crossbow“ ist also wie ein „bow“), oder wie die erste davon. Er übernimmt jeden Wert, den dieser Angriff liest und den der Vorschlag ausgelassen hat, und die Antwort sagt das („It fights as Hand axe does.“). Das Vorschlagsformular des Game Master sagt ihm außerdem, dass eine nach dem Vorbild einer Waffe erfundene Waffe auch wie diese kämpft.

Die Tags einer Waffe gehen mit jedem ihrer Treffer mit. Der `resist`- oder `immune`-Eintrag einer Kreatur kann angeben, was hindurchkommt: Mit `{ "type": "tearing", "except": ["silver"] }` erleidet die Kreatur den Schaden einer Waffe mit dem Tag `silver` voll und widersteht allem anderen. Der Grabwiedergänger aus Gravewatch ist so geschrieben, und der silberne Sargnagel des Regelsatzes kommt hindurch. Schaden, der nicht von einer Gegenstandswaffe stammt, nennt mit `qualities` (Capability API 1.101) in denselben Gegenstands-Tags, was er trägt: an den `mechanics` eines Katalogeintrags (ein Zauber) und am `damage` einer Kreaturenaktion (der Streitkolben eines Deva). Die „Resistenz gegen Wucht-, Stich- und Hiebschaden durch nichtmagische Angriffe“ in 5e ist `{ "type": "slashing", "except": ["magical"] }` neben demselben für die anderen beiden, mit `magical` in den Tags der magischen Waffen und `"qualities": ["magical"]` an den Zaubern und an den Kreaturenangriffen, die das SRD magisch nennt.

Die Details der Waffe und die Zeile für den Game Master nennen, was sie tut: `attack (Action): Brawn to hit, 1d6 + Brawn cut, reach 2 paces, range 10 to 20 paces`, mit `1d8 with a hand free` für den Eberspieß aus Ember Roads und `at 6` neben dem Spaten aus Gravewatch.

<a id="ammunition-and-reloading"></a>

#### Munition und Nachladen

Eine Waffe kann etwas verschießen und eine eigene geladene Anzahl führen (Capability API 1.57). Der Jagdbogen aus Ember Roads verschießt Pfeile, und die Wachpistole aus Gravewatch hält eine Kugel, geladen aus dem Kugel- und Pulvervorrat des Wächters:

```json
"ammo": { "tag": "arrow", "recover": 0.5 }
```

```json
"ammo": { "tag": "shot" },
"clip": { "max": 1, "reload": "act" }
```

- `ammo`: was die Waffe verschießt, benannt über eines deiner Gegenstands-`tags`. Jeder Angriff nimmt `perAttack` (1 ohne Angabe) der Gegenstände mit diesem Tag, die ihr Träger mitführt, getragen oder nicht, aus dem ersten solchen Stapel in seiner Tasche, dann aus dem nächsten. Die Waffe wird nur angeboten, solange er genug davon mitführt, und das Kampfmenü nennt, wie viele übrig sind. Nach einem Kampf, den die Gruppe gewinnt, kehrt der Anteil `recover` (von 0 bis 1) dessen, was jeder verschossen hat, zu dem Stapel zurück, aus dem es kam. Der Anteil wird über den ganzen Kampf zusammengezählt und für jeden Stapel einmal abgerundet; die Hälfte von fünf aus einem Köcher verschossenen Pfeilen ist also zwei. Ein verlorener Kampf oder einer, aus dem die Gruppe geflohen ist, gibt nichts zurück.
- `clip`: eine geladene Anzahl, die die Waffe selbst führt. `max` gibt an, wie viel sie fasst, ausdrücklich angegeben oder aus einem Zahlenwert des Gegenstands gelesen, und `reload` ist das Budget, das ein Nachladen verbraucht. Ein Angriff verbraucht dann das Geladene, statt aus der Tasche zu nehmen, und die Waffe wird nur angeboten, solange sie genug für einen Angriff enthält. Eine Option **Reload** (nachladen) im Kampfmenü verbraucht `reload` und füllt sie: aus der Tasche, wenn sie `ammo` hat (so viel, wie die Tasche noch enthält, falls das weniger ist), und vollständig, wenn sie keine hat. Die Anzahl wird am Inventarstapel der Waffe gespeichert; eine in einem Kampf leer geschossene Pistole ist also auch im nächsten leer. Eine Waffe, die noch niemand abgefeuert hat, ist geladen, ebenso eine, die ein Spieler in einen Stapel mit mehreren davon legt, denn eine geladene Anzahl gehört zu einer einzelnen Waffe. Die Munition eines Magazins wird nach einem Kampf nicht aufgesammelt; `recover` ist also für eine Waffe ohne Magazin gedacht.

Was ein Kampf verschießt, lädt und aufsammelt, wird bei jedem Schritt ins Inventar geschrieben, so wie die Gesundheit der Gruppe, und das Journal nennt, was verbraucht wurde. Ein Schritt, dessen Stapel verschwunden ist oder weniger enthält, als der Kampf angenommen hat, wird abgelehnt, genau wie ein verbrauchter Gegenstand, den der Kampf nicht findet. Das Kampfprotokoll nennt jeden Schuss, jedes Nachladen und jedes Aufsammeln („Hunting bow: noch 2 Schuss.“, „Ada lädt 1 in Watch pistol: 1 von 1 geladen.“), und die Details des Gegenstands sowie die Zeile für den Game Master nennen, was die Waffe verschießt und fasst: `ammunition Arrow (1 an attack, 50% picked up after a won fight)` und `holds 1, reload (Act)`.

<a id="modes-a-second-weapon-a-floor-and-conditions-on-a-hit"></a>

#### Modi, eine zweite Waffe, eine Untergrenze und Zustände bei einem Treffer

Eine Waffe kann weitere Arten haben, ihren Angriff auszuführen, einen Partner in der Nebenhand, einen Mindestschaden und Zustände, die sie dem Getroffenen zufügt (Capability API 1.58). Der Jagdbogen aus Ember Roads kann eine Salve abgeben, und der silberne Sargnagel aus Gravewatch kann in jeder Hand gehalten werden und markiert, was er tief trifft:

```json
"modes": [{ "id": "volley", "label": "Volley", "ammo": 2, "toHit": -2, "targets": 2 }]
```

```json
"offHand": true,
"onHit": [{ "condition": "marked", "atLeast": 2, "rounds": 2 }]
```

- `modes`: bis zu sechs weitere Arten, den Angriff auszuführen, jede mit `id`, `label` und dem, was sie ändert. `ammo` gibt an, wie viel ein Angriff in diesem Modus verschießt; die Waffe braucht also `ammo` oder einen `clip`, aus dem sie schießt. `toHit` ist, was er zum Treffen addiert: Würfel in einem Pool-Kampf, eine Zahl in einem Summenkampf. `target` verschiebt den Zielwert je Würfel eines Pool-Kampfes um diesen Betrag (ausgehend vom eigenen der Waffe, sonst von dem des Pools; `+1` ist schwerer), sofern der Zielwert des Pools veränderlich ist. `targets` gibt an, auf wie viele Ziele er gerichtet werden darf, jedes mit eigenem Angriffswurf. Sobald der Angriff ausgewählt ist (nach seinem Initiativestil, wo es Stile gibt), fragt das Kampfmenü nach der Art, jeweils mit dem erwarteten Ergebnis, und bietet nur die Modi an, für die der Träger die Schüsse hat. Ein von der Engine gespieltes Gruppenmitglied wägt jeden auf ein Ziel gerichteten Modus ab und überlässt einen Modus für mehrere Ziele dem Spieler. In einem Fenster wird ein Angriff unverändert ausgeführt.
- `offHand`: eine Waffe für die Nebenhand. Der Kampfblock nennt das Budget, das ein zweiter Angriff verbraucht, und ob dessen Schaden ein positives Attribut behält:

  ```json
  "offHand": { "budget": "quick", "ability": "full" }
  ```

  Hat ihr Träger in diesem Zug mit einer als `offHand` markierten Waffe angegriffen, bietet jede andere solche Waffe, die er trägt, einen zweiten Angriff mit diesem Budget an, im Menü „Silver coffin nail, off hand“ genannt. `ability` ist `full` (Standard) oder `penalty-only`; bei Letzterem wird das Schadensattribut nur addiert, wenn es etwas abzieht, wie beim Kampf mit zwei Waffen in 5e. Ein Angriff mit der Nebenhand ist ein einzelner Schlag, egal wie viele Angriffe der Hauptangriff kauft, und nie ein Angriff auf jemanden, der sich entfernt. Eine als `offHand` markierte Waffe braucht das `offHand` des Kampfblocks. `fullWhen` (Capability API 1.97) ist ein Wert vom Bogen des Kämpfers: Über 0 behält die Nebenhand dieses Kämpfers das volle Attribut, egal was `ability` sagt, wie beim Kampfstil Two-Weapon Fighting in 5e.

- `floor`: das Mindeste, was ein Treffer verursacht, ausdrücklich angegeben oder aus einem Zahlenwert des Gegenstands gelesen. Der Schaden eines Pool-Kampfes nach der Schadensminderung oder der Schaden eines Summenkampfes wird darauf angehoben, bevor eine Resistenz ihn halbiert, und das Protokoll sagt das. Ein Schlag im ausgebenden Stil wirft die Zahl seines Urhebers und wird nie angehoben.
- `onHit`: bis zu vier deiner Zustände, die das Ziel erhält, wenn der Schaden des Schlags `atLeast` erreicht hat, für `rounds` seiner eigenen Züge oder, ohne diese Angabe, bis etwas sie entfernt. Gemeint ist der Schaden, der nach Schadensminderung und Resistenzen ankam; ein Schlag im nehmenden Stil nimmt Initiative statt Schaden und verursacht daher keinen.
  Ein Eintrag kann außerdem `save: { "save": <save id>, "difficulty": n }` tragen, den das Ziel würfelt, wenn der Zustand auferlegt würde, wobei ein Erfolg ihn fernhält, sowie `saveEnds: { "save", "difficulty", "at": "turn-start" | "turn-end" | "damaged" }`, das ihn bestehen lässt, bis sein Betroffener diesen Rettungswurf zu Beginn oder am Ende jedes seiner Züge oder bei Schaden über null schafft (er hat dann kein `rounds`). Beides zählt als Rettungswurf gegen diesen Zustand und gegen Magie, wenn die Waffe magisch ist (Capability API 1.169). Das Schwert der Verwundung in 5e: `{ "condition": "wounded", "atLeast": 1, "saveEnds": { "save": "con_save", "difficulty": 15, "at": "turn-start" } }`.
- `plus`: Bis zu drei weitere Mengen bei jedem Treffer, jede `{ "dice", "flat", "type", "save", "targetIs", "when" }` und für sich gewürfelt, typisiert und gegen Resistenzen geprüft (Capability API 1.169). `save` nennt eigene `difficulty` und `onSuccess` (`half` oder `none`). `targetIs` fügt sie nur einem Ziel dieser Kreaturentypen oder Tags zu (siehe „Kreaturentypen und Zielprüfungen“). `when: "critical"` fügt sie nur bei einem kritischen Treffer zu; die Würfel jedes Bestandteils werden bei einem kritischen Treffer wie die der Waffe verdoppelt. Ein Blitzwurfspeer ist `{ "dice": "4d6", "type": "lightning" }`, ein Drachentöter `{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }`, ein Schwert der Schärfe `{ "flat": 14, "type": "slashing", "when": "critical" }`. Eine Vorhersage zählt einen Bestandteil nur gegen ein Ziel, das er erreicht, und nie einen, der nur bei kritischen Treffern gilt. `when: "toggled"` fügt ihn nur zu, solange der Schalter des Gegenstands eingeschaltet ist (Capability API 1.170, siehe unten `toggle`).

Die Details der Waffe und die Zeile für den Game Master nennen alles davon: `modes Volley (2 shots, -2 to hit, up to 2 targets)`, `off hand (Quick)`, `at least 1 on a hit before resistance`, `+3d6 slashing against Dragon` und `Marked for 2 rounds when a hit deals 2 or more`.

<a id="armor-and-worn-effects-in-a-fight"></a>

### Rüstung und getragene Wirkungen im Kampf

Was ein Gegenstand beim Tragen oder Mitführen bewirkt, kann auch einen Kampf verändern (Capability API 1.56), und zwar für seinen Besitzer, neben dessen Zuständen und Stufen. Beide nehmen die Teile eines Zustands auf, die ein Kampf liest:

- `effects`: alle Wirkungen eines Zustands außer den fünf, die eine Stufe nicht haben kann (`half-move-to-stand`, `ends-on-damage`, `cannot-target-source`, `cannot-target-source-side`, `cannot-approach-source`), weil niemand dem Besitzer den Gegenstand auferlegt hat und er nie von selbst endet: `own-attacks-advantage`, `attacks-against-disadvantage`, `resist-all`, `speed-zero` und die übrigen.
- `modifiers`: Änderungen mit `to` an Verteidigung, Angriffen und Geschwindigkeit sowie an Proben und Rettungswürfen, genau wie bei einem Zustand; in einem `dice-pool`-Kampf ist eine Änderung an Angriffen eine feste Zahl von Würfeln, wie bei einem Zustand.
- `resist`, `vulnerable` und `immune`: Schadensarten, von denen der Besitzer die Hälfte, das Doppelte oder nichts erleidet, wie bei einer Kreatur (und gegen `combat.damageTypes` geprüft, wenn du welche deklarierst). `conditionImmunities`: deine eigenen Zustände, die dem Besitzer nie auferlegt werden.

Der verfluchte Witwenring aus Gravewatch kostet bei jedem Angriff einen Würfel, die gebundene Dawn bell schützt ihren Träger davor, Rattled zu werden, und ein mitgeführter Wegstein aus Ember Roads hält die Hitze ab:

```json
"worn": { "modifiers": [{ "to": "attacks", "flat": -1 }] }
```

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["ward"], "flat": 1 }], "conditionImmunities": ["rattled"] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }], "resist": ["burn"] }
```

Ein Kampf liest jeden Gegenstand einmal, benannt nach dem Stapel („Widow's ring“ neben einem Wurf im Protokoll und bei einer Verteidigung), so wie eine Probe. Das `otherwise` einer unerfüllten Anforderung zählt auch im Kampf; eine für ihren Träger zu schwere Rüstung kann also Geschwindigkeit kosten. Die Details eines Gegenstands und die Zeile für den Game Master nennen alles davon („While worn: -1 on attacks“, „worn: +1 on checks (Ward), immune to Rattled“). Rüstung, die einfach zu einer Verteidigung oder einer Schadensminderung addiert, ist ein Gegenstandswert, der mit `itemStat` gelesen wird (siehe „Gegenstände auf dem Bogen“), so wie Guard in Ember Roads den getragenen Mantel liest.

**Härte.** Wo Initiative eine Zahl ist, die Angriffe verschieben, ist `combat.pool.hardness` die Härte eines Kämpfers, zu Kampfbeginn von seinem Bogen gelesen (die seiner Rüstung, über `itemStat`), und eine Kreatur gibt ihre eigene `hardness` an. Ein Schlag im ausgebenden Stil, dessen Würfel darunter liegen, trifft und bewirkt nichts: Die Zahl des Angreifers fällt trotzdem auf die Basis zurück, das Protokoll sagt das („Adas Grave spade trifft den Wächter mit 5 Würfeln, unter einer Härte von 6, und bewirkt nichts.“), und das Menü sagt dafür keinen Schaden voraus. Nur ein Regelsatz mit einem ausgebenden Stil darf sie haben, und eine als Bogen geschriebene Kreatur nimmt sie aus dem Bogen.

<a id="using-items-in-a-fight"></a>

### Gegenstände im Kampf nutzen

Ein Gegenstand kann im Kampf genutzt werden (Capability API 1.59): ein auf eine Schnittwunde gedrückter Umschlag, ein geschluckter Trank, eine geläutete Glocke. Sein `use` beschreibt, was die Nutzung bewirkt, in den Begriffen, die der `mechanics`-Block eines Katalogeintrags verwendet (siehe [Was ein Kampf aus `mechanics` liest](#what-a-fight-reads-from-mechanics)): `kind` (`heal`, `attack`, `buff` oder `debuff`), `amount`, `damageType`, `plus`, `attackRoll`, `save`, `applies`, `temporary`, `range`, `area`, `targets`, `targetCount`, `friendlyFire` und seit Capability API 1.174 `concentration` und `zone`, mit dem `budget`, das sie verbraucht, oder `free`. Der Umschlag aus Ember Roads sowie der wärmende Trank und die Morgenglocke aus Gravewatch:

```json
"use": { "kind": "heal", "budget": "act", "range": 0, "targets": "ally", "amount": { "dice": "1d4", "flat": 1 }, "consumes": true }
```

```json
"use": { "kind": "heal", "budget": "quick", "targets": "self", "amount": { "flat": 1 }, "consumes": true }
```

```json
"stack": 1,
"use": {
  "kind": "debuff",
  "budget": "act",
  "targets": "enemy",
  "save": { "save": "steel", "onSuccess": "negates" },
  "saveDifficulty": 7,
  "applies": [{ "condition": "rattled", "duration": { "rounds": 2 } }],
  "charges": 1
},
"charges": { "max": 3 }
```

- Eine Nutzung steht im Kampfmenü unter **Items** (Gegenstände) und ist nach dem Gegenstand benannt („Poultice“), egal wie der Stapel heißt. Ein Gegenstand, der Trageplätze belegt oder gebunden wird, wird genutzt, solange er getragen (und, wo er gebunden wird, gebunden) ist, wie die Glocke; jeder andere, solange er mitgeführt wird.
- Sie verbraucht ein Budget oder ist `free` und bezahlt mit sich selbst: `cost`, `perCostStep`, `check`, `concentration`, `reaction`, `scales`, `gives`, `standard` und `rider` sind für einen Katalogeintrag auf einem Bogen gedacht und werden bei einer Nutzung abgelehnt.
- `toHit` bei einer Nutzung mit `attackRoll` ist, was sie zum Treffen addiert, so wie das `toHit` einer Waffe es angibt (siehe „Waffen im Kampf“): Attribute, eine Fertigkeit, ein Bonus und in einem Pool-Kampf ein Zielwert je Würfel. Ohne diese Angabe addiert der Wurf nichts.
- `saveDifficulty`: die Zahl, gegen die ein verlangter Rettungswurf gewürfelt wird (der eigene der Nutzung, einer, der einen auferlegten Zustand beendet, oder der eines Schadensbestandteils ohne `difficulty`), ausdrücklich angegeben oder aus einem Zahlenwert des Gegenstands gelesen. Ein Eintrag auf einem Bogen liest diese Zahl aus der Quelle seines Katalogs; ein Gegenstand hat keine und gibt sie deshalb selbst an.
- `consumes: true` nimmt bei jeder Nutzung ein Stück vom Stapel des Gegenstands, und das Menü nennt, wie viele übrig sind. Das zuletzt genutzte Stück nimmt den Stapel mit.
- `restore` (Capability API 1.60) gibt jedem Bogen, auf den die Nutzung wirkt, einen Teil eines Pools zurück, so wie ein Blutbeutel Blut zurückgibt: `{ "pool": "resolve", "amount": { "flat": 1 } }`, mit `dice` und `flat` wie bei einem `amount`. Es nennt einen deiner laufenden Pools, nie den Gesundheitspool (Gesundheit kehrt mit einer Heilung zurück), und steht an einer helfenden Nutzung, einem `heal` oder einem `buff`. Eine Kreatur hat keine Pools und erhält daher nichts. Das Protokoll sagt es („Ada erhält 1 Resolve zurück und steht bei 3 von 4.“), und ein von der Engine gespieltes Gruppenmitglied lässt einen vollen Pool in Ruhe. Der wärmende Trank aus Gravewatch stellt neben seiner Heilung einen Punkt Resolve wieder her.
- `charges` verbraucht so viele der eigenen `charges` des Gegenstands, dessen `max` angibt, wie viele er fasst, von 1 bis 100, ausdrücklich angegeben oder aus einem Zahlenwert des Gegenstands gelesen (ein Gegenstand, der diesen Wert unter 1 angibt, wird abgelehnt, und einer über 100 fasst 100). Die Anzahl wird am Inventarstapel des Gegenstands gespeichert; eine Glocke, die in einem Kampf zweimal geläutet wurde, hat im nächsten also noch eine Ladung, und eine, die noch niemand geläutet hat, ist voll. Ladungen gehören zu einem einzelnen Gegenstand; ein Gegenstand mit Ladungen hat daher einen `stack` von 1. Eine Nutzung verbraucht den Gegenstand oder Ladungen, nie beides, und die Ladungen eines Gegenstands werden immer von seiner Nutzung verbraucht. Zwei weitere Schlüssel gehören zu `charges` (Capability API 1.61), wie bei der Morgenglocke aus Gravewatch:

  ```json
  "charges": { "max": 3, "recharge": { "rests": ["vigil"], "amount": "max" }, "breaksOn": { "die": 20, "atMost": 1 } }
  ```

  - `recharge`: welche deiner `rests` die Ladungen zurückbringen und wie viele: `"max"` füllt den Gegenstand, und eine Menge (`{ "dice": "1d6", "flat": 1 }`) gibt so viele zurück, nie über `max` hinaus. Eine Rast bringt die Ladungen jedes Gegenstands zurück, den ihr Charakter mitführt und der sie nennt, egal ob die Rast-Schaltfläche des Bogens sie auslöst oder das `[sheet: op="rest"]` des Game Master. Bogen und Tasche werden gemeinsam geschrieben, und eine neu generierte Antwort lädt nur einmal auf. Der Bogen nennt nach der Rast, was zurückkam („Dawn bell 3/3 charges“), und der Game Master sieht neben jedem Gegenstand im Inventar die verbleibenden Ladungen („2 of 3 charges left“).
  - `breaksOn`: Verbraucht eine Nutzung die letzte Ladung, würfelt die Engine einen d`die`, und bei höchstens `atMost` zerbricht der Gegenstand und verschwindet aus der Tasche, im Kampf und außerhalb. Das Kampfprotokoll sagt das („Dawn bell zerbricht (eine 1 auf ihrem Würfel).“), der Bericht der Schaltfläche **Use** ebenfalls („Mit der letzten Ladung zerbricht sie.“), und das Journal zählt den Gegenstand als verloren.

- `gate` (Capability API 1.62) ist eine Probe, die der Nutzer bestehen muss, bevor der Gegenstand wirkt, so wie eine Schriftrolle mit einem Zauber über dem eigenen Niveau des Lesers eine verlangt. `check` nennt, was gewürfelt wird: `{ "skill": "ward" }`, `{ "ability": "wits" }` oder einen Wert vom Bogen (`{ "value": { "derived": "spell_mod" } }`, für eine Zahl, die sich von Charakter zu Charakter unterscheidet, wie der Zauberwirkungsmodifikator eines 5e-Zauberwirkers). `difficulty` reicht von 1 bis 100, ausdrücklich angegeben oder aus einem Zahlenwert des Gegenstands gelesen (ein Gegenstand, der ihn nicht angibt, fehlt im Menü, und seine Schaltfläche **Use** sagt das deutlich). `unless` überspringt die Probe, wenn ein Wert auf dem Bogen des Nutzers mindestens `atLeast` beträgt. Eine misslungene Probe verbraucht den Gegenstand (oder seine Ladungen) für nichts. Im Kampf wird die Probe gewürfelt, sobald der Gegenstand verbraucht wird, mit den eigenen Würfeln des Kampfes (einem Pool in einem Pool-Kampf, wo `difficulty` die nötigen Erfolge angibt) und der zu Kampfbeginn gelesenen Zahl vom Bogen. Was die Zustände und getragenen Gegenstände des Nutzers zu dieser Probe beitragen, zählt mit, einschließlich dessen, was nur für die Fertigkeit gilt. Das Protokoll sagt es („Ada würfelt Ward, um Page of the vigil litany zu nutzen: 2 Erfolge aus 2 Würfeln bei 7 oder mehr (8, 9), 2 Erfolge nötig, ein Erfolg.“). Die Seite der Vigil-Litanei aus Gravewatch hat eine solche Probe:

  ```json
  "gate": { "check": { "skill": "ward" }, "difficulty": 2, "unless": { "value": { "abilityScore": "nerve" }, "atLeast": 3 } }
  ```

Was ein Kampf verbraucht und welche Ladungen er übrig lässt, wird bei jedem Schritt ins Inventar geschrieben, wie die Schüsse einer Waffe, und das Journal nennt, was verbraucht wurde. Das Kampfprotokoll nennt jede Nutzung („Poultice: 1 von 2 übrig.“, „Dawn bell: 2 von 3 übrig.“). Ein von der Engine gespieltes Gruppenmitglied setzt eine Heilung nur bei Verletzten ein, und niemand nutzt einen Gegenstand für einen Angriff auf jemanden, der sich entfernt. Die Details des Gegenstands und die Zeile für den Game Master nennen, was seine Nutzung bewirkt: „Use (Action): heals 1d4 + 1, range 0 paces, used up“ und `use (Act): Steel 7 save negates it, Rattled, 1 of 3 charges`, und die Details zeigen die verbleibenden Ladungen. Ein Gegenstand, den der Game Master `like=` einem deiner Gegenstände erfindet, wird wie dieser genutzt, samt Ladungen.

### Gegenstände in Classic- und Tactical-Kämpfen

Ein Regelsatz, der seine Kämpfe nicht selbst auflöst, überlässt sie den eigenen Classic- und Tactical-Kämpfen von Game Mode, in denen zu Kampfbeginn ein Modell gefragt wird, was die Gegenstände im Inventar bewirken. Deine Gegenstände werden nicht geraten: Jeder mit `use` tut, was dort steht, mit den eigenen Zahlen der Engine, und die Einschätzung des Game Master wird nur für Gegenstände erfragt, die nicht deine sind (und bei `native: false` für keine).

- Ein `heal` heilt und ein `attack` verletzt um einen Anteil der maximalen Gesundheit des Ziels, ausgehend vom Durchschnitt seines `amount`: Ein Durchschnitt von 7, die `1d8+3` einer einfachen Waffe, ist etwas mehr als ein Fünftel davon, nie weniger als ein Zwanzigstel und höchstens alles. Auf dieser Skala liest die Kampfanbindung die Zahlen eines Katalogeintrags. Der `damageType` ist das Element.
- Der erste Zustand in `applies` wird als Status unter seinem eigenen Namen auferlegt, für seine `rounds` (ohne Angabe 2), und ein `buff` oder `debuff` ist allein dieser Status, der die Verteidigung erhöht oder senkt, wie die eigenen Status der Engine.
- `targets` gibt an, auf wen die Nutzung zielt. Ohne Angabe geht eine Heilung oder Verstärkung an einen Freund und ein Angriff oder eine Schwächung an einen Gegner.
- `consumes: true` nimmt ein Stück vom Stapel, und eine Nutzung ohne diese Angabe lässt den Gegenstand, wo er ist.
- Ein Angriffswurf, ein Rettungswurf, eine Fläche, temporäre Punkte und ein wiederhergestellter Pool haben in diesen Kämpfen keinen Platz, wie die `mechanics` eines Katalogeintrags dort: Die Beschreibung des Gegenstands im Menü nennt sie trotzdem.
- Ein Gegenstand, der Trageplätze belegt, wird nur genutzt, solange er getragen wird, und einer, der gebunden wird, nur, solange er gebunden ist, wie in einem Regelsatzkampf. Ein verbrauchter Gegenstand wird aus dem Getragenen genommen, nie aus einem Ersatzstück in der Tasche.
- Ein Gegenstand, dessen Nutzung `charges` verbraucht, wird angeboten, solange eine Nutzung übrig ist, und das Menü **Items** zählt seine Nutzungen. Jede Nutzung verbraucht sie aus dem Stapel des Gegenstands, zuerst aus dem eigenen des Spielers, und die zuletzt verbrauchte würfelt ihr `breaksOn`: Zerbrochen verschwindet der Gegenstand aus der Tasche, und das Journal zählt ihn als verloren.
- Ein Gegenstand, der zuerst eine Probe verlangt (`gate`), lässt sie auf dem Server würfeln, wenn ein Gruppenmitglied ihn nutzt, mit dem Bogen dieses Mitglieds und dem, was es trägt (ein Begleiter ohne eigene Karte würfelt auf einem leeren Bogen, und nur die eigene Einheit des Spielers greift auf die Karte des Spielers zurück), so wie die Schaltfläche **Use** würfelt; trifft `unless` zu, wird sie übersprungen. Misslingt sie, ist der Gegenstand verbraucht (oder seine Ladungen sind es) und bewirkt nichts, und das Protokoll sagt das: „Ada würfelt Ward, um Page of the vigil litany zu nutzen: 0 gegen 2, misslungen, und der Gegenstand ist umsonst verbraucht.“
- Ein Gegenstand ohne `use` wird in diesen Kämpfen nicht angeboten, ebenso wenig eine Heilung ohne `amount`.

Die Engine berechnet die Wirkung jedes Gegenstands selbst; was der Bildschirm sendet, entscheidet also nie, was einer deiner Gegenstände bewirkt.

### Beute

Ein gewonnener Kampf lässt in jedem Game-Mode-Spiel einmal Beute fallen, direkt in die Taschen der Gruppe. Ohne Regelsatz stammt sie aus den eigenen Tabellen von Game Mode (mehr und seltener bei höherer Schwierigkeit), ebenso bei einem Regelsatz, der keine Beutetabellen deklariert und `native` eingeschaltet lässt. Ein Regelsatz, der Beutetabellen deklariert, lässt stattdessen seine eigenen Gegenstände fallen, und einer mit `native: false` und ohne Tabellen lässt nichts fallen.

`lootTables` im `items`-Block (Capability API 1.63) listet sie auf, wie die Grabbeigaben aus Gravewatch:

```json
"lootTables": [
  {
    "id": "grave_goods",
    "label": "Grave goods",
    "rolls": "1d2",
    "entries": [
      { "item": "kit/shot-and-powder", "weight": 4, "count": "1d4" },
      { "item": "kit/warming-tonic", "weight": 3 },
      { "item": "kit/litany-page", "weight": 2 },
      { "filter": { "category": "arm" }, "weight": 1 },
      { "coins": "shilling", "weight": 2, "count": "1d6" }
    ]
  }
]
```

- `rolls` gibt an, wie viele Ziehungen die Tabelle macht: eine Zahl von 0 bis 20 oder Würfel (`"1d2"`), standardmäßig 1.
- Jede Ziehung wählt eine Zeile nach ihrem `weight` (standardmäßig 1) im Verhältnis zu den anderen. Eine Zeile nennt einen deiner Gegenstände als `<catalog>/<entry>`, einen `filter` nach `rarity`, `category` und `tag`, der gleichmäßig unter allen passenden Gegenständen wählt, oder (Capability API 1.64) `coins`, eine deiner Münzen per ID. `count` gibt an, wie viele fallen, eine Zahl oder Würfel, standardmäßig 1. Ein Gegenstand oder eine Münze, die eine Ebene herausnimmt, fällt nicht, ebenso wenig ein Filter, der nichts findet.
- Eine Bestiariumkreatur nennt mit `loot` die Tabelle, die sie trägt (siehe unten „Kreaturen“). Ein gewonnener Regelsatzkampf würfelt die Tabelle jeder besiegten Kreatur. Ein Kampf, den die Engine nicht nach deinen Regeln auflöst, hat keine Bestiariumkreaturen und lässt daher nichts fallen.
- Was fällt, kommt wie ein Hinzufügen in die gemeinsame Ansicht, wobei zuerst die Tasche des Spielers gefragt wird, und was niemand tragen kann, bleibt zurück. Die Zusammenfassung für den Game Master nennt, was gefallen ist und dass es schon in den Taschen liegt, das Journal sagt das, und eine Benachrichtigung zeigt es an.
- Der Game Master würfelt eine Tabelle in der Geschichte mit `[loot: table="grave_goods" who="Ada"]` (`who=` für die Tasche eines einzelnen Charakters), gemessen ab dem Beginn des Zuges wie seine Inventar-Tags, sodass eine neu generierte Antwort nur einmal Beute fallen lässt. Jeder fallende Gegenstand wird wie ein Hinzufügen beantwortet, und seine Anweisungen listen deine Tabellen auf.

### Geld

Deine `currencies` sind das Geld der Gruppe. Eine Münze ist ein Gegenstand in den Taschen, ein Stapel jeder Münze wie jeder andere, benannt nach ihrem `label`:

- Sie wiegt je `perWeight` Münzen ihrer Familie eine Einheit deines Traglastwerts, zählt zur Last ihres Trägers und wird beim Eingang nach der Tragregel verteilt. Eine Familie ohne `perWeight` wiegt nichts.
- Der Spieler fügt Münzen über die Liste **Coins** (Münzen) der Auswahl hinzu und teilt, gibt und führt sie zusammen wie jeden Stapel.
- Eine Zeile über den Stapeln des Inventars zeigt die sichtbaren Münzen jeder Familie und ihren Wert in der kleinsten Münze der Familie. Der Game Master sieht diesen Wert neben jeder Tasche (`Coin worth 432 pennies` oder `no coins` für einen leeren Geldbeutel, wobei die Tasche des Spielers auch dann aufgeführt wird, wenn sie nichts enthält) und die `cost` eines Gegenstands neben dem Gegenstand (`costs 3 shillings`).
- Der Game Master bezahlt mit `[inventory: action="pay" amount="3 shillings" who="Ada"]` und wird mit `action="earn"` bezahlt. `amount` ist eine Anzahl und eine Münze, per ID oder Beschriftung, Einzahl oder Mehrzahl, ohne Beachtung der Groß- und Kleinschreibung (`1 penny`, `12 pennies`). Eine Zahlung kommt aus einer einzigen Tasche (ohne `who=` aus der des Spielers) und nur in der eigenen Familie der Münze: Zuerst gehen die größten passenden Münzen, dann wird die kleinste verbleibende Münze gewechselt, die den Restbetrag deckt, und das Wechselgeld kommt in den kleineren Münzen der Familie zurück, die größten zuerst. Die Antwort nennt, was bezahlt wurde und was zurückkam: 3 shillings aus einem Geldbeutel mit einer einzigen crown ergeben `Paid with crowns ×1; shillings ×2 back.` Eine Zahlung, die die Tasche nicht leisten kann, wird abgelehnt (`cannot-afford`), ebenso eine Münze, die du nicht hast (`unknown-coin`), und jede Zahlung in einem Regelsatz ohne Währungen (`no-currencies`). Ein Verdienst ist ein Hinzufügen dieser Münze, in die Tasche von `who` oder nach der Tragregel verteilt. Das Journal listet Ausgaben und Einnahmen auf, und eine Benachrichtigung zeigt sie an. Die Anweisungen des Game Master listen deine Münzen auf; diese Befehle erhält nur ein Regelsatz mit Münzen.
- Kaufen ist eine Zahlung und anschließend ein Hinzufügen oder, in einem Regelsatz mit Markt, ein `buy` (siehe unten). Einen Ladenbildschirm gibt es nicht.

### Startausrüstung

`items.startingGear` (Capability API 1.78) listet Ausrüstung auf, die ein Charakter zu Beginn in seine Tasche nehmen darf: das Paket einer Klasse, eines Hintergrunds, einer Berufung. Sie wird nie von selbst vergeben. Das Inventar zeigt eine Zeile **Starting gear** (Startausrüstung), und der Spieler wählt ein Paket, für jede seiner Auswahlen eine Option und aus jeder Liste einen Gegenstand und nimmt es dann in die Tasche des Spielers oder eines Gruppenmitglieds. Ausrüstung, zu der der Bogen des Charakters passt (`fits`), wird zuerst aufgeführt, danach Ausrüstung ohne `fits` (für jeden Charakter, etwa die eines Hintergrunds). Jede Ausrüstung wird angeboten, weil das Konzept eines Charakters Sache der Absprache zwischen Spieler und Game Master ist.

```json
"startingGear": [
  {
    "id": "fighter", "label": "Fighter", "group": "class",
    "fits": { "value": { "field": "level_fighter" }, "atLeast": 1 },
    "lines": [{ "item": "equipment/shield", "equip": true }],
    "choices": [
      {
        "label": "Armor",
        "options": [
          { "label": "Chain mail", "lines": [{ "item": "equipment/chain-mail", "equip": true }] },
          { "label": "Leather armor and a longbow", "lines": [
            { "item": "equipment/leather-armor", "equip": true },
            { "item": "equipment/longbow" }, { "item": "equipment/arrow", "count": 20 }
          ] }
        ]
      },
      { "label": "A martial weapon", "options": [
        { "label": "Pick one", "lines": [{ "oneOf": ["equipment/longsword", "equipment/battleaxe"] }] },
        { "label": "A greataxe", "lines": [{ "item": "equipment/greataxe" }] }
      ] }
    ]
  },
  { "id": "acolyte", "label": "Acolyte", "group": "background", "lines": [{ "coins": "gp", "count": 15 }, { "name": "Vestments" }] }
]
```

- Eine Zeile ist einer der Gegenstände des Regelsatzes (`item`), Münzen (`coins`, eine Münz-ID), ein Gegenstand, den der Spieler aus einer festen Liste wählt (`oneOf`, 2 bis 48 Gegenstände), oder ein einfacher Gegenstand per Name (`name`, wo `freeform` einfache Gegenstände erlaubt; er unterliegt den Regeln einer Beschriftung, also keine Klammern, `{{` oder Zeilenumbrüche). `count` ist 1 bis 999; `equip: true` legt einen Gegenstand beim Nehmen an, wo seine Trageplätze frei sind, sodass Rüstung von Anfang an zählt.
- `choices` sind 0 bis 8, jede mit 2 bis 6 Optionen aus eigenen Zeilen.
- `group`: Ausrüstung, die ein Charakter einmal pro Gruppe nimmt (die einer Klasse und die eines Hintergrunds). Dieselbe Gruppe erneut zu nehmen, ist eine Entscheidung, die der Spieler im Dialog trifft, und ergänzt, was bereits in der Tasche ist. Ausrüstung ohne Gruppe ist ihre eigene Gruppe und nie dieselbe wie eine gleichnamige Gruppe.
- `fits` liest den Bogen ohne seinen Live-Zustand, wie das Tragen. Es bestimmt nur die Reihenfolge der Liste.
- Das Nehmen gilt ganz oder gar nicht: Ausrüstung, die für ihren Träger zu schwer ist, wird ganz abgelehnt, und der Dialog nennt ihr Gewicht und wie viel er noch tragen kann. Ein Gegenstand, den eine Ebene aus dem Spiel nimmt, wird weggelassen und genannt, ebenso eine Liste, deren Gegenstände sie alle herausnimmt; Münzen einer Münze, die eine Ebene herausnimmt, werden in der größten verbleibenden Münze gleichen Werts ausgezahlt, und der Dialog zeigt sie so an. Ausrüstung, von der nichts übrig bleibt, wird abgelehnt, damit sie nie umsonst als genommen markiert wird. Eine Dienstleistung wird nie aus einer Liste angeboten.
- Der Import prüft jeden Gegenstand (in einem direkt eingebetteten Katalog; ein Katalog in eigener Datei wird geprüft, wenn die Ausrüstung genommen wird), jede Münze, jeden einfachen Gegenstand und jeden `fits`-Verweis, lehnt eine Dienstleistung ab und lehnt eine Anzahl ab, die mehr Stapel bräuchte, als eine Tasche auf einmal aufnimmt.

### Märkte

Ein `market` im `items`-Block (Capability API 1.65) legt fest, was ein Ort zu welchem Preis verkauft, statt dass jeder Laden alles zu seinem Listenpreis verkauft. Der Markt aus Gravewatch, leicht gekürzt:

```json
"market": {
  "prices": [
    { "id": "cheap", "label": "cheap", "times": 0.75 },
    { "id": "fair", "label": "fair", "times": 1, "default": true },
    { "id": "dear", "label": "dear", "times": 1.5 }
  ],
  "places": [
    { "id": "hamlet", "label": "hamlet" },
    { "id": "village", "label": "village" },
    { "id": "town", "label": "market town" },
    { "id": "city", "label": "city" }
  ],
  "sold": [
    { "filter": { "rarity": "rare" }, "place": "town" },
    { "filter": { "category": "arm" }, "place": "village" }
  ],
  "sellers": [
    { "id": "chandler", "label": "chandler", "sells": [{ "category": "coat" }, { "category": "tonic" }] },
    { "id": "smith", "label": "smith", "sells": [{ "category": "arm" }], "place": "village" },
    {
      "id": "chapel",
      "label": "chapel of the Vigil",
      "sells": [{ "category": "page" }],
      "place": "town",
      "only": { "value": { "abilityScore": "nerve" }, "atLeast": 3, "label": "wardens of Nerve 3 or more" }
    }
  ]
}
```

- `prices`: eine bis acht Preisstufen, jede ein Multiplikator (`times`, über 0) auf die `cost` eines Gegenstands, und eine davon ist der `default`. Ein Preis ist die Kosten in der kleinsten Münze der Familie mal der Stufe, auf diese Münze gerundet (nie unter eine Münze für etwas, das überhaupt etwas kostet). Angegeben wird er in der Münze, in der die Kosten geschrieben sind, sofern diese ihn genau bezahlt, sonst in der größten Münze, die deine Ebenen übrig lassen und die ihn genau bezahlt: Bei `dear` kostet ein Mantel für 8 shillings 12 shillings, und ein 5e-Trank für 50 gp kostet 50 gold pieces, nie 5 platinum. Feilschen oder die Laune eines Händlers verschieben die Stufe, nie die Zahl.
- `places`: eine bis zwölf Ortsgrößen, die kleinste zuerst, in deinen eigenen Worten.
- `sold`: Regeln für den kleinsten Ort, der verkauft, was ein Filter auswählt. Ein Filter nennt `rarity`, `category` und `tag`, beliebig viele davon, und passt auf einen Gegenstand, der alles Genannte hat; die erste Regel, die auf einen Gegenstand passt, entscheidet. Das eigene `sold` eines Gegenstands hat Vorrang vor den Regeln, und ein Gegenstand, den nichts nennt, wird überall verkauft.
- `sellers`: Arten von Händlern, jede mit dem, was sie verkauft (`sells`: Filter, von denen jeder einen Gegenstand auswählen kann), dem kleinsten Ort (`place`), an dem es sie gibt (ohne Angabe überall), und optional mit `only`, an wen allein sie verkauft: ein Wert vom Bogen des Käufers, einschließlich seines Live-Zustands und seiner mitgeführten Gegenstände, mindestens `atLeast`, dem Game Master als `label` genannt. Ohne `sellers` verkauft jeder an einem Ort, was dieser Ort verkauft.
- Ein Gegenstand ohne `cost` ist unverkäuflich, ebenso einer, den eine Ebene ausblendet, oder einer, dessen Münzen eine Ebene herausgenommen hat.

**Wo die Gruppe ist.** Der Game Master nennt mit `[place: name="Millbrook" size="market town"]` den Ort einer Szene und seine Größe, die Größe per ID oder Beschriftung, und lässt die Größe für einen Ort ohne Markt weg (eine Straße, die Wildnis). Die Engine beantwortet jedes Tag direkt und lehnt eine Größe ab, die du nicht hast. Der zuletzt in den für den Spieler sichtbaren Antworten des Game Master beantwortete Ort, gezählt ab dem jüngsten Gesprächsbeginn, gilt, bis ein anderer genannt wird. Ein Orts-Tag, das ein Spieler eintippt, zählt nie. Eine neu generierte Antwort liest nur, was vor der Angabe kam, die sie ersetzt.

**Kaufen.** Der Game Master kauft mit `[inventory: action="buy" item="Hand axe" count="1" level="dear" seller="smith" who="Ada"]`; `level` (ohne Angabe die Standardstufe) und `seller` (ohne Angabe jeder Händler hier, der den Gegenstand verkauft) sind optional. Die Engine berechnet den Preis an dem Ort, der beim Ende der Antwort gilt, nimmt ihn wie bei einer Zahlung samt Wechselgeld aus dem Geldbeutel des Käufers (ohne `who=` aus dem des Spielers) und legt den Gegenstand in seine Tasche, oder sie bezahlt bei einer Dienstleistung nur. Entweder geschieht beides oder nichts. Die Antwort nennt, was es gekostet hat (`price="12 shillings"`) und was bezahlt und zurückgegeben wurde, und eine Benachrichtigung zeigt es an. Ein Kauf wird abgelehnt und ändert nichts, wenn kein Ort genannt ist (`no-place`), bei einer Stufe, einem Gegenstand oder Händler, den du nicht hast (`unknown-level`, `unknown-item`), ohne Preis (`not-for-sale`), bei einem für den Gegenstand zu kleinen Ort (`not-here`), wenn hier kein Händler ihn verkauft (`no-seller`), bei einem Händler, dessen `only` der Käufer nicht erfüllt (`not-to-you`), bei einem Geldbeutel, der den Preis nicht decken kann (`cannot-afford`), oder bei einer Tasche, die den Gegenstand nicht tragen kann.

**Was der Game Master sieht.** Solange eine Szene an einem Ort mit Markt spielt, nennt ein MARKET-Block den Ort und seine Größe, die Preisstufen und jeden Händler dort mit einem Dutzend seiner Waren zur Standardstufe, die günstigsten zuerst; alles, was sie verkaufen, kann per Name gekauft werden. Seine Anweisungen bringen dem Game Master `[place:]` und `buy` bei, und nur ein Regelsatz mit Markt hat sie.

#### Ein Markttag

Ein Markttag (Capability API 1.69) lässt die Regale eines Ortes wechseln und leer werden und erlaubt der Gruppe, Gegenstände zurückzuverkaufen. Der Markttag aus Gravewatch, leicht gekürzt:

```json
"places": [
  { "id": "hamlet", "label": "hamlet", "purse": { "amount": 10, "unit": "shilling" } },
  { "id": "town", "label": "market town", "purse": { "amount": 100, "unit": "shilling" } }
],
"buyBack": 0.5,
"sold": [{ "filter": { "rarity": "rare" }, "place": "town", "limited": "1d2" }],
"sellers": [
  { "id": "smith", "label": "smith", "sells": [{ "category": "arm" }], "stock": { "table": "smiths_odd_lot" } }
]
```

- **Der Tag.** Ein Tag an einem Ort dauert, bis der Game Master einen anderen Ort nennt. Einen neuen Tag am selben Ort beginnt er, indem er ihn mit `day="new"` erneut nennt (`[place: name="Millbrook" size="market town" day="new"]`). Alles Folgende wird je Tag aus den Antworten des Game Master berechnet, die der Spieler sieht. Ein Swipe, eine neu generierte Antwort oder eine Verzweigung braucht also nichts Gespeichertes, und ein Tag würfelt immer dasselbe Regal.
- **`limited`** an einer `sold`-Regel oder am eigenen `sold` eines Gegenstands: wie viele ein Ort an einem Tag vorrätig hat, eine Zahl oder Würfel, die für den Tag gewürfelt werden. Eine Regel darf ein Limit ohne Ort nennen (überall verkauft, einige wenige auf einmal); der Ort eines Gegenstands stammt aus der ersten Regel, die einen Ort nennt, und sein Limit aus der ersten, die ein Limit nennt. Sind sie verkauft, wird ein Kauf bis zu einem neuen Tag abgelehnt (`sold-out`).
- **`stock`** an einem Händler: eine deiner Beutetabellen, einmal am Tag gewürfelt für das, was dieser Händler zusätzlich zu seinem Sortiment vorrätig hat. Was sie ergibt (nur Gegenstände, nie Münzen), verkauft allein dieser Händler, so viele wie gewürfelt, unabhängig von `sells` und `sold`; das `only` eines Händlers gilt weiterhin.
- **`buyBack`**: der Anteil (über 0, höchstens 1) am Standardpreis eines Gegenstands, den ein Händler dafür zahlt. Ein Händler hier, der diese Art von Ware verkauft, kauft sie an (ohne Händler jeder). Ohne `buyBack` kauft niemand etwas zurück.
- **`purse`** an einer Ortsgröße: das Höchste, was die Händler dort an einem Tag zusammen auszahlen, in einer deiner Münzen. Verkäufe, die in der Familie dieser Münze bezahlt werden, werden darauf angerechnet; ohne Kasse kaufen die Händler unbegrenzt an.
- **Verkaufen.** Der Game Master verkauft mit `[inventory: action="sell" item="Silver coffin nail" count="1" seller="smith" who="Ada"]`. Die Engine berechnet den Preis, nimmt den Gegenstand aus der Tasche des Verkäufers (ohne `who=` aus der des Spielers; nie einen gebundenen verfluchten Gegenstand) und zahlt die Münzen ein, die größten zuerst, oder lehnt ab und ändert nichts: kein Ort genannt, hier kauft niemand ihn an (`not-bought`), kein Preis (`not-for-sale`), die heutige Kasse ist erschöpft (`purse-spent`), keiner vorhanden oder Münzen, die die Tasche nicht tragen kann. Die Antwort nennt den Erlös (`price="4 shillings"`), das Journal führt den Gegenstand als verkauft, und eine Benachrichtigung zeigt es an.
- Der MARKET-Block ergänzt, was jeder Händler heute vorrätig hat, wie viele von einem begrenzten Gegenstand übrig sind, was die Händler hier zahlen und wie viel von der heutigen Kasse übrig ist; seine Anweisungen bringen dem Game Master `sell` und `day="new"` bei.

#### Ehrliche und unehrliche Händler

Capability API 1.79 lässt einen Gegenstand riskant oder eine Fälschung sein und einen Händler unehrlich.

```json
"items": { "market": { "sellers": [
  { "id": "fence", "label": "Fence", "sells": [{ "tag": "magical" }], "place": "town", "honest": false, "stock": { "table": "fences_odd_lot" } }
] } }
```

```json
{ "id": "bag-of-devouring", "label": "Bag of Devouring", "item": { "category": "wondrous", "passesFor": "magic_items/bag-of-holding", "cost": { "amount": 5, "unit": "gp" } } }
{ "id": "wand-of-wonder", "label": "Wand of Wonder", "item": { "category": "wand", "risky": "every wave is a gamble; some effects turn on the one who waves it" } }
```

- **`risky`** an einem Gegenstand: Wovor ein ehrlicher Händler warnt, bevor er ihn verkauft. Der MARKET-Block führt ihn neben der Ware eines ehrlichen Händlers mit „(warn the buyer first: ...)“ auf; ein unehrlicher Händler sagt nichts.
- **`passesFor`** an einem Gegenstand macht ihn zur Fälschung eines anderen Gegenstands (`<catalog>/<entry>`): eines echten, verkäuflichen Gegenstands derselben Kategorie, in denselben Trageplätzen getragen, der gebunden wird, wenn die Fälschung gebunden wird. Das wird beim Import geprüft, wo beide lesbar sind, bei der Installation für jede Katalogdatei und erneut, wenn ein Markt sie anbietet; eine Fälschung, deren Ziel fehlt oder von einer Ebene ausgeblendet wird, wird also nie verkauft. Ein verfluchter Gegenstand (`binds.cursed`) oder eine Fälschung gehört nie zu den Waren irgendeines Händlers und nie zum Vorrat eines ehrlichen Händlers.
- **`honest: false`** an einem Händler: Eine Fälschung, die seine `stock`-Tabelle ergibt, wird als der Gegenstand angeboten, für den sie sich ausgibt, zu dessen Preis, und der MARKET-Block zeigt dem Game Master daneben die Wahrheit. Ein Kauf, der diesen Händler und diesen Gegenstand nennt, erhält die Fälschung; ein Kauf, der keinen Händler nennt, nie.
- **Eine Fälschung in der Tasche** erscheint überall, wo der Spieler hinsieht (in der Tasche, im Journal, in Benachrichtigungen, in Kämpfen), als der Gegenstand, für den sie sich ausgibt, und behält, was sie wirklich ist. Der Inventarblock des Game Master markiert sie mit `[FAKE: really ...]` und bittet ihn, sie weiter bei dem Namen zu nennen, unter dem sie angezeigt wird.
- **Entdeckt** wird sie durch `[inventory: action="reveal" item="Bag of Holding" who="Ada"]`, durch Binden (Einstimmen zeigt einen Fluch), durch Nutzen (es geschieht, was sie wirklich bewirkt; wenn die Regeln dabei nichts berechnen, erzählt es der Game Master) oder durch den Verkauf an einen ehrlichen Käufer, der sagt, was sie wirklich ist, und zahlt, was das wert ist (ihre eigene `cost`), oder ablehnt, wo sie keine hat. Ein unehrlicher Käufer nimmt eine Fälschung als das, was sie zu sein scheint. Von da an ist sie ihr wahrer Gegenstand.
- **Getragen oder mitgeführt**: Eine Fälschung bewirkt auf dem Bogen des Charakters, was sie wirklich bewirkt (ihre `worn`- oder `carried`-Wirkungen und ihre Werte). Die erste Inventaränderung, nach der der Bogen eine Zahl zeigt oder eine Probe etwas addiert, was der Gegenstand, für den sie sich ausgibt, nicht täte, deckt sie auf, und Journal und Bildschirm sagen, was sie war. Ein Unterschied, den nur ein Kampf liest (eine Resistenz), deckt sie nicht auf, ebenso wenig eine Änderung allein am Bogen bis zur nächsten Inventaränderung. Im Kampf greift eine getragene gefälschte Waffe weiterhin als die Waffe an, für die sie sich ausgibt.
- Im Vertrauensmodus für Einzelspieler zeigt Peek Prompt die Sicht des Game Master, einschließlich der Wahrheit.

<a id="using-items-outside-a-fight"></a>

### Gegenstände außerhalb eines Kampfes nutzen

Dasselbe `use` funktioniert auch außerhalb eines Kampfes (Capability API 1.60 für `restore`; der Rest braucht nichts Neues). Die Schaltfläche **Use** im Inventar bei einem deiner Gegenstände mit `use` und das `[inventory: action="use" item="Poultice" who="Juno"]` des Game Master bewirken beide mit den Würfeln der Engine, was der Gegenstand bei dem tut, der ihn mitführt:

- Eine Heilung gibt Gesundheit zurück: die Menge bei einem Gesundheitspool oder eine entfernte Markierung bei einer Wundleiste, wie eine Heilung im Kampf. `temporary`-Punkte kommen auf einen Gesundheitspool, `restore` gibt seinen Pool zurück, und jeder Zustand, den die Nutzung mit `applies` auferlegt, wird gesetzt, bis etwas ihn entfernt.
- Eine Nutzung, die schadet oder auf die andere Seite zielt (`kind` `attack` oder `debuff` oder `targets` `enemy`), trifft niemanden: Außerhalb eines Kampfes steht niemand auf dem Brett, den man treffen könnte. Der Gegenstand wird trotzdem genutzt, und der Game Master erfährt, was er bewirkt, damit er es erzählen kann.
- Sie nimmt ein Stück vom Stapel oder verbraucht seine Ladungen genau wie ein Kampf. Ein Gegenstand ohne verbleibende Nutzung oder einer, der einen Trageplatz belegt oder gebunden wird und nicht getragen wird, wird abgelehnt und ändert nichts. Bogen und Tasche werden gemeinsam geschrieben.
- Ein `gate` wird zuerst gewürfelt, wie eine Probe: mit den eigenen Würfeln des Regelsatzes und der Zahl vom Bogen, dem Wundabzug des Nutzers und dem, was seine Zustände und getragenen oder mitgeführten Gegenstände an dieser Probe bewirken. Eine misslungene Probe verbraucht den Gegenstand für nichts, und die Zeile sagt das („Ada nutzt Page of the vigil litany: Ward-Probe 1 gegen 2, misslungen; der Gegenstand ist umsonst verbraucht. Noch 1 übrig.“).

Was geschehen ist, steht in einer Zeile: „Juno nutzt Poultice: heilt 4 (Grit 6/11). Noch 1 übrig.“ Die Schaltfläche **Use** schickt sie dem Game Master in einem `[item_used]`-Block nach „I use my Poultice.“, den der Chat als Badge anzeigt. Das eigene Tag des Game Master wird damit beantwortet, gemessen ab dem Beginn des Zuges wie seine anderen Tags, sodass eine neu generierte Antwort einen Gegenstand nie zweimal nutzt. Ein Gegenstand ohne `use` oder in einem Spiel ohne Regelsatz wird weiterhin einfach genannt: „I use my rope.“

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

Der obige `battle`-Block stellt einem Kampf die Zahlen des Bogens bereit, während Marinara weiter rechnet. Der optionale `combat`-Block beschreibt dagegen, wie deine Regeln einen Kampf AUFLÖSEN. Er parametrisiert eine von der Engine bereitgestellte Kampfart, genauso wie `resolution` eine Probenart parametrisiert. Jeder Name darin stammt von dir. Es gibt zwei Kampfarten: `attack-vs-defense`, bei der Würfel addiert und mit einer Zahl verglichen werden, und `dice-pool`, bei der ein Kampf die eigenen Pools deines `dice-pool`-Regelsatzes wirft und Erfolge zählt (siehe unten „Ein Kampf mit Würfelpools“).

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

- `kind`: `"attack-vs-defense"` (eine Seite würfelt gegen die Verteidigung der anderen; ein Treffer verursacht Schaden) oder `"dice-pool"` (siehe „Ein Kampf mit Würfelpools“). Jeder folgende Schlüssel bedeutet bei beiden dasselbe und wird so gelesen, wie die jeweilige Art Zahlen liest.
- `health`: Erforderlich. Was der Kampf abzieht. Entweder `{ "pool": "grit" }`, ein laufender Pool, den er verringert und dessen etwaiger temporärer Puffer zuerst Schaden aufnimmt, oder `{ "track": "harm" }`, eine Wundleiste, die er MARKIERT. Eine Leiste braucht daneben `damageKinds` und gewährt keine temporären Punkte.
- `defense`: Erforderlicher Wertverweis. Ein vom Spieler eingegebenes Feld oder ein von dir berechneter abgeleiteter Wert.
- `initiative`: Erforderlich. Die zu Beginn einmal gewürfelten Würfel und ein optionaler Modifikatorverweis. Bei Gleichstand gewinnt der höhere Modifikator, danach die Reihenfolge beim Aufstellen des Kampfes. `"each": "round"` würfelt die Initiative aller zu Beginn jeder neuen Runde erneut, mit dem Modifikator, wie er dann steht (ein Modifikator, der eine Wundleiste liest, ist bei Verwundung also langsamer), und die Runde beginnt bei dem, der in der neuen Reihenfolge vorn liegt. Capability API 1.47. Ein `dice-pool`-Kampf kann die Initiative stattdessen als Pool werfen: `pool` (ein Wertverweis) gibt die Zahl der Würfel an, und deren Erfolge plus `plus` ergeben die Zahl, ohne `dice` oder `modifier` daneben. `resource`, das `pool` braucht, behält diese Zahl und lässt Angriffe sie verschieben (siehe unten „Initiative, die Angriffe verschieben“). Capability API 1.48.
- `attackRoll`: Erforderlich bei `attack-vs-defense` und abgelehnt bei `dice-pool`, das die eigenen Pools deiner Auflösung wirft. Die Würfel; ob zweimal gewürfelt und ein Wurf behalten wird (`advantage`); die Wirkung der äußersten Seiten eines einzelnen Würfels (`naturals.max`: `critical`, `hit` oder `none`; `naturals.min`: `miss` oder `none`); und die Wirkung eines kritischen Treffers auf den Schaden (`critical`: `double-dice` würfelt die Schadenswürfel erneut, `max-dice` addiert ihre höchsten Augenzahlen einmal, `none` ist ein gewöhnlicher Treffer). Besondere Augenzahlen setzen wie bei Proben einen einzelnen Würfel voraus. Rettungswürfe im Kampf verwenden dieselben Würfel. `criticalFrom` erweitert den Bereich kritischer Augenzahlen: ein vom Bogen des Angreifers gelesener Wert, der die niedrigste natürliche Augenzahl angibt, die als kritischer Treffer zählt, etwa `{ "field": "critical_from" }` für einen Champion in 5e, auf dessen Bogen 19 steht. Er wird auf die höchste Seite des Würfels begrenzt, ein Wert unter 2 bedeutet überhaupt keinen Bereich (nur die höchste Seite, wie bei einem Charakter, dessen Feld auf 0 belassen ist), und er braucht einen einzelnen Würfel mit `naturals.max` auf `critical`. Capability API 1.81.
- `economy`: Erforderlich. `budgets` beschreibt, was ein Zug enthalten darf: ID, Beschriftung, `per` (`turn` füllt zu Beginn des eigenen Zuges auf, `round` zu Beginn einer neuen Runde) und `count`. Das ZUERST deklarierte Budget ist das Hauptbudget; es bezahlt Standardaktionen. `movement` ist ein optionaler Wertverweis für die Bewegungsweite eines Zuges in deiner eigenen Entfernungseinheit. Er wird bei Kämpfen auf einem Brett gelesen; siehe Positionen.
- `attacks`: Optional. Bogenlisten, deren Zeilen Waffen sind. `name` nennt die Textspalte für den Zeilennamen, `damage.dice` die Würfelspalte. `toHit.ability`, `toHit.proficiency`, `toHit.bonus`, `damage.ability`, `damage.bonus` und `damage.type` nennen jeweils eine Spalte derselben Liste. Eine `ability`-Spalte ist ein `enum` mit einer deiner Attributs-IDs; andere Werte addieren nichts. Eine `proficiency`-Spalte ist ein `boolean`; ist sie gesetzt, wird dein Übungsbonus addiert. Eine Zeile ohne lesbare Würfel ist kein Angriff. Ein Seil in derselben Liste bleibt also einfach ein Seil. `toHit.skill` nennt eine `enum`-Spalte mit einer deiner Fertigkeits-IDs: Die Zeile addiert, was eine Probe dieser Fertigkeit addiert, und nennt die Zeile ein eigenes `ability`, tritt dieses an die Stelle des Attributs der Fertigkeit, genau wie `with=` es bei einer Probe austauscht (Capability API 1.47). `strikes` ist ein optionaler Wertverweis, der angibt, wie viele Angriffe EIN Verbrauch des Listenbudgets kauft. Wählt der Charakter eine Zeile, während er keine Angriffe in Reserve hat, wird das Budget verbraucht und der Rest vorgemerkt. Solange Angriffe vorgemerkt sind, kostet jede Zeile mit `strikes` überhaupt kein Budget. Andere Waffen, andere Ziele und Bewegung dazwischen ergeben sich so von selbst aus dem Menü. `strikesCappedBy` nennt eine boolesche Spalte, die IHRE EIGENE Zeile auf einen einzelnen Angriff begrenzt, egal wie viele die Liste kauft. Das ist für Waffen gedacht, die pro Zug nur einmal schießen, unabhängig von der Angriffsanzahl ihres Trägers; dafür steht die Loading-Eigenschaft von SRD 5.1. Bei einer Liste, die ohnehin nur einen Angriff pro Budgetverbrauch kauft, wäre das bedeutungslos und wird abgelehnt. Die vorgemerkten Angriffe gehören dem KÄMPFER, nicht einer Liste. Deklarieren zwei Waffenlisten eines Charakters beide `strikes`, greifen ihre Zeilen auf denselben Vorrat zu. Er wird am Ende des Zuges gelöscht, der ihn gekauft hat. Ohne Angabe kauft die Liste einen Angriff pro Budgetverbrauch, wie alle Kämpfe vor dieser Erweiterung.

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
  Mit Capability API 1.108 wählt `byColumn: { "column": "class", "values": { "cleric": { "toHit": { "derived": "spell_attack_cleric" }, "saveDifficulty": { "derived": "spell_dc_cleric" } }, "wizard": { "toHit": { "derived": "spell_attack_wizard" }, "saveDifficulty": { "derived": "spell_dc_wizard" } } }` die Verweise nach der Klasse einer Zeile aus. Ein Kleriker 3 / Magier 2 kann den Angriff des Klerikers aus Übungsbonus plus Wisdom und die Schwierigkeit aus 8 plus diesem Angriff ableiten und die des Magiers stattdessen aus Intelligence. Die Spalte muss in der Liste der Quelle existieren, und `values` enthält 1 bis 20 Einträge. Jeder Eintrag kann einen der beiden Verweise ersetzen; ein ausgelassener Verweis, ein fehlender Spaltenwert oder ein nicht aufgeführter Wert behält den eigenen Verweis der Quelle. Der Kampf, die Zeilenzusammenfassung des Bogens und die Zusammenfassung des Game Master lesen dieselben Zahlen pro Zeile. Sowohl `stamp` als auch `byColumn` erfordern schemaVersion 2 und capabilityApi 1.108 oder neuer.
- `standard`: Optional, aus der geschlossenen Liste `dash`, `disengage`, `dodge`, `help`, `hide`, `ready`. `dodge` (Angriffe gegen den Ausweichenden werden zweimal gewürfelt, der schlechtere Wurf zählt) und `help` (der nächste Angriff des unterstützten Verbündeten wird zweimal gewürfelt, der bessere zählt) werden immer aufgelöst. `dash` (noch einmal dieselbe Bewegungsweite) und `disengage` (in diesem Zug greift dich niemand für das Weggehen an) werden auf einem Brett aufgelöst und ohne Brett nur protokolliert. `hide` und `ready` werden angenommen, bewirken aber noch nichts.
- `standardEffects`: Optional, für den Teil einer Standardaktion, den ihr Kennzeichen nicht ausdrückt. Derzeit gibt es das nur für `dodge`: `{ "dodge": { "saves": ["dex_save"] } }` nennt die Rettungswürfe, die ein ausweichender Charakter für die Dauer des Ausweichens zweimal würfelt, wobei der bessere zählt. Nenne nur auf dem Bogen deklarierte Rettungswürfe und nur dann, wenn `standard` auch `dodge` enthält. Ohne diese Angabe bleibt Ausweichen wie bisher: schwerer zu treffen und sonst nichts.
- `conditions`: Optional. Bildet DEINE Zustands-IDs auf ihre Wirkungen ab. Bogen und Kampf verwenden dadurch dieselben Zustände, und ein vergifteter Charakter bleibt danach vergiftet. Die Wirkungsliste ist geschlossen: `own-attacks-advantage`, `own-attacks-disadvantage`, `attacks-against-advantage`, `attacks-against-disadvantage`, `attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `cannot-act`, `cannot-react`, `speed-zero`, `half-move-to-stand`, `ends-on-damage`, `own-saves-advantage`, `own-saves-disadvantage`, `own-checks-advantage`, `own-checks-disadvantage`, `resist-all`, `cannot-target-source`, `cannot-target-source-side` (1.278) und `cannot-approach-source`. `failsSaves` nennt Rettungswürfe, die der Zustand ohne Wurf scheitern lässt. Die sechs Wirkungen mit Entfernungs- oder Bewegungsbezug (`attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `speed-zero`, `half-move-to-stand`, `cannot-approach-source`) werden auf einem Brett gelesen und sagen ohne Brett nichts aus; siehe Positionen. `cannot-react` hält den betroffenen Charakter aus dem durch Bewegung geöffneten Fenster heraus; er wird nie gefragt. Vier weitere Schlüssel stehen neben den Wirkungen:
  - `modifiers`: Die Zahlen, die der Zustand verändert, solange er besteht. Siehe unten „Zahlen, die ein Zustand verändert“.
  - `saves`: Welche deiner Rettungswürfe die beiden Rettungswurfwirkungen und jeder Modifikator für Rettungswürfe betreffen. Ohne Angabe gelten sie für alle. Eine Angabe, neben der keines von beidem steht, wird abgelehnt.
  - `skills`: Welche deiner Fertigkeiten die beiden Probenwirkungen und jeder Modifikator für Proben betreffen, der keine eigenen Fertigkeiten nennt. Ohne Angabe gelten sie für alle. Eine Angabe, neben der keines von beidem steht, wird abgelehnt. Die vergleichenden Proben eines Kampfes würfeln die eigenen Probenwerte des Kampfes, keine Fertigkeiten; etwas, das auf Fertigkeiten eingegrenzt ist, erreicht sie also nie. Eine Probe außerhalb eines Kampfes mit einer dieser Fertigkeiten liest es (siehe unten „Proben außerhalb eines Kampfes“). Capability API 1.53.
  - `whileSourceInSight`: Was nur gilt, solange der Verursacher im Sichtfeld des Betroffenen ist. `true` macht den gesamten Zustand davon abhängig. Eine Liste eigener Wirkungen begrenzt nur diese und lässt den Rest bestehen. Das braucht etwa eine Furchtwirkung, die weiteres Annähern unabhängig davon verhindert, ob die Quelle sichtbar ist. Eine nicht im Zustand enthaltene Wirkung wird abgelehnt. Ohne Brett kann keine Sichtlinie unterbrochen werden; dann gilt alles in beiden Fällen.
  - `endsWhenSourceDown`: Der Zustand endet, sobald sein Verursacher zu Boden geht.
  - Sinne (Capability API 1.127): Das `lacks` eines Zustands nennt Sinne, die sein Betroffener nicht hat, und das `mechanics.needs` eines Katalogeintrags oder das `needs` einer Kreaturenaktion nennt Sinne, die ein Ziel haben muss, damit sie auf es wirken. Für Deafened in 5e schreibst du `"lacks": ["hearing"]`, für Command `"needs": ["hearing"]` in seine Mechanik. Ein tauber Betroffener fehlt im Zielmenü von Command. Eine Fläche oder Wirkung auf mehrere Ziele, die Gehör braucht, überspringt dieses Ziel vollständig: kein Rettungswurf, kein Schaden, keine Zustände. Sobald Deafened endet, ist das Ziel wieder zulässig. Jede Liste hat ein bis vier verschiedene Sinn-IDs in den eigenen Worten des Regelsatzes; die Engine kennt keine Namen von Sinnen.
  - Nur nutzbar, solange der Bogen es zulässt (Capability API 1.166): Das `mechanics.usableWhen` eines Katalogeintrags ist `{ "value": <value reference>, "atLeast": n, "atMost": n }` (eine Grenze oder beide). Im Kampf wird der Eintrag im Zug seines Besitzers oder in einem Reaktionsfenster nur angeboten, solange der vom Bogen, Live-Zustand und den Gegenständen seines Besitzers gelesene Wert innerhalb der Grenzen liegt; er wird bei jedem Zeichnen des Menüs gelesen. Protection in 5e braucht einen Schild in der Hand: `"usableWhen": { "value": { "itemStat": { "from": "worn", "pick": "count", "category": "shield" } }, "atLeast": 1 }`. Das „keine schwere Rüstung“ von Rage ist dasselbe mit `"atMost": 0` auf der Zahl schwerer Rüstungen. Eine als Werteblock geschriebene Kreatur hat keinen Bogen, also hält sie nichts zurück.
  - Zustände, die nur auferlegt werden, solange der Bogen des Auferlegenden es zulässt (Capability API 1.167): Ein `applies`-Eintrag an der Mechanik eines Katalogeintrags oder an der Nutzung eines Gegenstands kann `"when"` tragen, in derselben Form wie `usableWhen`. Es wird in dem Moment, in dem der Zustand auferlegt würde, vom Bogen, Live-Zustand und den Gegenständen dessen gelesen, der ihn auferlegt, und ein Eintrag außerhalb seiner Grenzen wird übersprungen; die anderen gelten weiterhin. Rage in 5e legt innerhalb der Grenze von vier Einträgen `raging` und einen von drei Schadenszuständen auf: `{ "condition": "raging_damage_2", "duration": { "rounds": 10 }, "when": { "value": { "derived": "barbarian_level" }, "atMost": 8 } }`, dann `raging_damage_3` mit `"atLeast": 9, "atMost": 15` und `raging_damage_4` mit `"atLeast": 16`. Wer ohne Bogen auferlegt, legt jeden Eintrag auf. Der Werteblock einer Kreatur und das `onEnd` eines Zustands haben keinen Bogen eines Auferlegenden zum Lesen; `when` wird dort daher abgelehnt. Erfordert schemaVersion 2 und capabilityApi 1.167 oder neuer.
  - Kreaturentypen und Zielprüfungen (Capability API 1.168): `combat.creatureTypes` listet auf, was ein Kampfbeteiligter sein kann, `{ "types": [{ "id": "dragon", "label": "Dragon" }, ...], "tags": [{ "id":
"devil", "label": "devil" }], "field": "race", "default": "humanoid" }`. Eine Kreatur nennt ihren eigenen `type` und ihre `tags`; der Typ eines Charakters ist der Wert des Text- oder Auswahlfelds `field`, wenn er einer der Typen ist, sonst `default` (Charaktere in 5e sind Humanoide). Eine Zielprüfung ist `{ "types": [...], "tags": [...] }` und besteht bei jeder einzelnen Übereinstimmung; ein Kampfbeteiligter ohne Typ und ohne Tags passt nie. Sie steht an drei Stellen: Das `targetIs` eines Schadensbestandteils fügt diesen Bestandteil nur einem passenden Ziel zu (ein Drachentöter: `"plus": [{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }]`, Weihwasser: `{ "dice": "2d6", "type": "radiant", "targetIs": { "types": ["fiend", "undead"] } }`); das `targetIs` eines `applies`-Eintrags legt diesen Zustand nur einem passenden Ziel auf; und `mechanics.targetTypes: { "is": test, "not": test }` sagt, wer überhaupt gewählt oder erfasst werden darf (Animal Friendship: `{ "is": { "types": ["beast"] } }`; Sleep: `{ "not": { "types": ["undead"] } }`). Eine Fläche übergeht jeden, den `targetTypes` ausschließt. Eine Vorhersage zählt einen `targetIs`-Bestandteil nur gegen ein Ziel, das er erreichen würde; der einfache Durchschnitt auf dem Bogen lässt ihn weg. Das Kampfpanel und der Game Master sehen Typ und Tags jedes Kampfbeteiligten. Erfordert schemaVersion 2 und capabilityApi 1.168 oder neuer.
  - Enden von Zuständen (Capability API 1.125): Charm Person verwendet `"endsWhen": ["harmed-by-source-side"]`. Schaden über null durch den, der ihn auferlegt hat, oder durch jemanden auf dessen Seite, oder ein Angriff, ein Rettungswurf oder ein schädlicher Zustand, den diese auf seinen Betroffenen richten, beendet ihn, nachdem die schädliche Aktion vollständig aufgelöst ist, auch wenn der Angriff verfehlt oder der Rettungswurf gelingt. `"saveWhenDamaged": true` wiederholt einen Zugrettungswurf bei Schaden: Jeder Schaden über null wiederholt das `saveEnds` der auferlegenden Aktion mit deren gespeicherter Schwierigkeit; ein Erfolg beendet ihn. Ohne gespeicherten Rettungswurf oder gespeicherte Schwierigkeit wird nichts gewürfelt. Hypnotic Pattern verwendet `"endsWhen": ["damaged"]` und `"shakeOff": { "budget": "action" }`: Jeder Schaden über null beendet ihn sofort, oder ein anderer Kampfbeteiligter auf der Seite des Betroffenen kann in seinem eigenen Zug dieses Budget ausgeben, um ihn zu beenden. `shakeOff.reach` ist in der Entfernungseinheit des Regelsatzes angegeben und beträgt standardmäßig eine Zelle; ohne Brett wird keine Entfernung gemessen. Die Aktionsökonomie muss ihr Budget deklarieren. `endsWhen` hat einen oder zwei verschiedene Einträge. Diese Schlüssel lassen das Enden beim Zu-Boden-Gehen der Quelle und das Enden der Konzentration unverändert. Für einen Rettungswurf nur bei Schaden über null, nie zu Beginn oder am Ende eines Zuges, verwende `saveEnds.at: "damaged"` (Capability API 1.129): Der Eintrag für Dominate Person ist `{"condition":"dominated","duration":"until-save","saveEnds":{"save":"wis_save","at":"damaged"}}` und würfelt einmal pro Schlag mit der gespeicherten Schwierigkeit der auferlegenden Aktion, ohne `saveWhenDamaged` zu brauchen.
  - Die Aktionsökonomie (Capability API 1.76), wie Haste und Slow sie verändern:
    - `budgets`: `[{ "budget": "haste", "flat": 1 }]` gibt seinem Betroffenen in jedem Zug so viel mehr (oder weniger) eines Zugbudgets, nie unter null. Nur ein Budget, das sich mit `per` pro Zug auffüllt, lässt sich so verändern. Ein Budget kann mit `"count": 0` für eines deklariert werden, das nur ein Zustand füllt, und der Bildschirm zeigt es nur, solange jemand etwas davon hat. Ein erfundener Gegner gibt nie eines aus.
    - `grants`: `{ "budget": "haste", "standard": ["dash", "disengage", "hide"], "attacks": true,
"items": true }` sagt, wofür dieses Budget ausgegeben werden darf: für die genannten Standardaktionen (aus der eigenen `standard`-Liste des Regelsatzes, nie auf dem ersten Budget, wo jede Standardaktion bereits liegt), für einen Waffenangriff mit einem einzelnen Schlag (egal wie viele Angriffe eine Aktion sonst in die Hand geben würde; bei einer Kreatur ein Angriff ihres Werteblocks auf ein Ziel, nie ein Mehrfachangriff) und für die Nutzung eines Gegenstands: `true` für jeden Gegenstand oder `{ "tags": ["mundane"] }` nur für einen Gegenstand mit einem dieser Gegenstands-Tags (Use an Object in 5e ist die Nutzung eines gewöhnlichen Gegenstands, nie die Aktivierung eines magischen Gegenstands). Sie werden angeboten, sobald das Budget, das sie sonst verbrauchen würden, aufgebraucht ist, und nur im eigenen Zug des Betroffenen: Eine Gewährung bezahlt nie eine Reaktion.
    - `exclusive`: `["action", "bonus"]`, zwei Budgets, von denen ein Zug nur eines ausgibt: Wird eines ausgegeben, leert das das andere.
    - `attacksPerTurn`: Wie viele Angriffe (Aktionen, die zum Treffen würfeln, jeder angreifende Teil einer Folge und eine vergleichende Probe, die die Stelle eines Angriffs einnimmt, etwa ein Packen) sein Betroffener in seinem eigenen Zug ausführt, egal was eine Aktion geben würde. Eine Reaktion im Zug eines anderen wird weder begrenzt noch gezählt.
    - `onEnd`: `{ "applies": [{ "condition": "lethargic", "duration": { "rounds": 1 } }] }`, was er hinterlässt, wenn er endgültig endet (er läuft ab, ein Rettungswurf oder Schaden beendet ihn, die Konzentration bricht), nie, wenn er erneut auferlegt wird. Es hält einige `rounds` (nie `"until-save"` oder `"instant"`). Wird es mitten im eigenen Zug des Betroffenen hinterlassen, beginnen seine Runden mit dem nächsten Zug; eine Runde ist also der ganze nächste Zug.
  - Wenn ein Kampf endet, wie auch immer er endet, verschwindet jeder Zustand, den er mit einer Uhr, einem `endsAfter` oder einer Konzentration auferlegt hat, vom Bogen, ohne etwas zu hinterlassen, und die Konzentration endet. Ein Zustand ohne Uhr (das Liegen nach einem Sturz) bleibt.

  `own-saves-advantage` und sein Gegenstück würfeln den Rettungswurf wie einen Angriff zweimal und behalten einen Wurf; sie heben sich gegenseitig auf. `own-checks-advantage` und sein Gegenstück tun dasselbe mit der Seite des Betroffenen in einer vergleichenden Probe, wo ein Kampf seine Attributsproben ablegt, und mit seinen Proben außerhalb eines Kampfes. `resist-all` halbiert jede Schadensart zusätzlich zu den eigenen Resistenzen des Ziels und hebt sich auf dieselbe Weise mit einer Verwundbarkeit auf. `cannot-target-source` verhindert, dass der Betroffene irgendetwas auf den Verursacher richtet (`cannot-target-source-side`, 1.278: oder auf jemanden auf dessen Seite, sofern diese nicht seine eigene ist). `cannot-approach-source` verhindert, dass er näher an diese Person herangeht als seine aktuelle Zelle, einschließlich des gesamten Weges. Ein Umweg zu einer ebenso weit entfernten Zelle wird weiterhin angeboten; ein Weg, der zwischendurch näher vorbeiführt und auf der anderen Seite endet, nicht.

  ```json
  { "condition": "restrained", "effects": ["own-saves-disadvantage"], "saves": ["dex_save"] }
  ```

  **Schaden, den ein Zustand verändert (Capability API 1.133).** `damage` verändert, was sein Betroffener verursacht; `damage-taken` verändert, was sein Betroffener erleidet. Beide nehmen `flat`, `dice` (und `minus`) oder `times: 0.5 | 2` an. Additionen erfolgen einmal pro Angriffstreffer, auch wenn der Treffer mehrere Schadensbestandteile hat; kritische Treffer verdoppeln die hinzugefügten Würfel so, wie der Regelsatz seine anderen Würfel verdoppelt. Rettungswürfe und automatische Treffer erhalten keine. `times` verändert den ganzen Treffer nach den Additionen und vor der Resistenz und rundet die Summe über seine Bestandteile hinweg einmal ab. Hinzugefügte Mengen treffen mit ihrem eigenen `damageType` auf Resistenz, ohne Angabe mit der Art des Treffers. Additionen derselben Art kommen vor der Resistenz zu dieser Menge hinzu.

  `attacks` ist `weapon`, `spell` oder `any` (Standard). Zeilen von Angriffslisten und Angriffe angelegter Gegenstände sind Waffen, ebenso Angriffswürfe von Werteblöcken gegen ein einzelnes Ziel; Katalogfähigkeiten (einschließlich des Zauberwirkens von Kreaturen) und Gegenstandsnutzungen sind Zauber- oder andere Angriffe. `blow: "melee" | "ranged"` folgt 1.118; eine Wurfwaffe in Reichweite gilt also als Nahkampf. `ability` nennt das Attribut, das für den Angriffswurf tatsächlich gewählt wurde: das Attribut einer Zeile oder das erste beste Attribut, das ein Gegenstand anbietet (einschließlich Finesse). Einfache Werteblockaktionen haben keines und passen nie zu einer Attributseinschränkung. Diese Schlüssel und `damageType` werden bei anderen Modifikatorzielen abgelehnt. `fromSource: true` gibt es nur für `damage-taken`: Der Treffer muss von dem kommen, der den verfolgten Zustand auferlegt hat. Ein nicht verfolgter Zustand, eine Stufe oder ein Gegenstand hat keine auferlegende Quelle und kann nicht passen.

  Deklariere in 5e diese Zustands-IDs auf dem Bogen und setze dann diese Einträge in `combat.conditions`:

  ```json
  [
    {
      "condition": "divine_favor",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "dice": "1d4", "damageType": "radiant" }]
    },
    {
      "condition": "rage",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "blow": "melee", "ability": "str", "flat": 2 }]
    },
    {
      "condition": "enfeebled",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "ability": "str", "times": 0.5 }]
    },
    {
      "condition": "hunters_mark",
      "modifiers": [{ "to": "damage-taken", "attacks": "weapon", "fromSource": true, "dice": "1d6" }]
    }
  ]
  ```

  Divine Favor und Rage kommen auf ihren Wirkenden, Ray of Enfeeblement und Hunter's Mark auf ihr Ziel. Hex verwendet den `damage-taken`-Eintrag der Markierung mit `attacks: "any"` und `damageType: "necrotic"`. Stufen und bei Gegenständen die Wirkungen von `worn`, `carried` und dem `otherwise` einer Anforderung teilen sich diese Modifikatoren. Das Angriffsmenü zählt nur die eigenen Additionen und Multiplikatoren des Betroffenen; die Markierung eines Ziels wird dort nie versprochen. Bogen- und Promptzusammenfassungen beschreiben die eigenen Schadensmodifikatoren des Betroffenen, und die Kampfansicht beschreibt auch eingehende. Pakete, die eines der beiden Ziele verwenden, erfordern schemaVersion 2 und capabilityApi 1.133 oder neuer, auch wenn der Gegenstand in einer separaten Katalogdatei liegt.

  **Zahlen, die ein Zustand verändert.** Jeder Eintrag in `modifiers` nennt, was er verändert (`to`), und um wie viel:
  - `defense`: die Zahl, die ein Angriff gegen den Betroffenen erreichen muss. Nur eine feste Zahl.
  - `attacks`, `saves`, `checks`: die eigenen Angriffswürfe, Rettungswürfe und Proben des Betroffenen in vergleichenden Proben. Eine feste Zahl oder `dice`, die bei jedem dieser Würfe gewürfelt werden (`"1d4"`); `minus: true` zieht die Würfel ab, statt sie zu addieren.
  - `speed`: wie weit der Betroffene geht, in deiner eigenen Entfernungseinheit (`flat`), oder `times` 0,5 oder 2 für die Hälfte oder das Doppelte, angewendet nach allen festen Änderungen. Wird wie `speed-zero` nur auf einem Brett gelesen.
  - `health-max`: `times` 0,5 und nichts anderes halbiert das Gesundheitsmaximum des Betroffenen, abgerundet und nie unter 1 (Capability API 1.115). Eine Gesundheitsleiste aus Kästchen hat kein Maximum, das sich halbieren ließe. Gesundheit über dem halbierten Maximum geht bei Kampfbeginn verloren, und Heilung geht nie darüber hinaus.

  Ein Modifikator für `checks` darf eigene `skills` nennen und einer für `saves` eigene `saves`; sie grenzen ihn dann anstelle der Angaben des Zustands ein. Beide dürfen mit `mode: "advantage"` oder `"disadvantage"` zweimal würfeln lassen. Das zählt zusammen mit den gleichnamigen Wirkungen und hebt sich wie diese auf, mit oder ohne Zahl daneben; ein Zustand kann also Sneak erschweren und zugleich Climb erleichtern. Diese drei Schlüssel brauchen Capability API 1.53.

  ```json
  { "condition": "muddy", "modifiers": [{ "to": "checks", "skills": ["sneak"], "mode": "disadvantage" }] }
  ```

  Eine feste Zahl trägt ihr eigenes Vorzeichen, und 0 wird abgelehnt. Jeder Modifikator erscheint im Protokoll neben dem Wurf, den er verändert hat, mit dem Namen des Zustands („12 + 5 + 3 (Blessed) = 20“), und Trefferchance und Gewinnchance im Menü berücksichtigen ihn. Verschiedene Zustände addieren sich; derselbe Zustand zweimal bleibt ein einziger Zustand.

  ```json
  "conditions": [
    { "condition": "blessed", "modifiers": [{ "to": "attacks", "dice": "1d4" }, { "to": "saves", "dice": "1d4" }] },
    { "condition": "shielded", "modifiers": [{ "to": "defense", "flat": 5 }] },
    { "condition": "slowed", "modifiers": [{ "to": "speed", "times": 0.5 }, { "to": "defense", "flat": -2 }] }
  ]
  ```

- `levels`: Optional. Stufen einer laufenden Leiste, die als Zustände zählen, solange die Leiste hoch genug steht. So drückt man einen Zustand aus, der sich in Stufen verschlimmert, etwa Erschöpfung. Jeder Eintrag nennt eine einfache `track` (keine Wundleiste), die Stufe `at`, ab der er beginnt, und was er bewirkt, mit denselben `effects`, `modifiers`, `failsSaves`, `saves` und `skills` wie ein Zustand. Jede von der Leiste erreichte Stufe zählt; sie addieren sich also, während die Leiste steigt. Eine Stufe hat keine Quelle und endet nur, wenn das Gelesene sinkt. `half-move-to-stand`, `ends-on-damage`, `cannot-target-source`, `cannot-target-source-side` und `cannot-approach-source` werden daher bei einer Stufe abgelehnt. Nur ein Kämpfer mit Bogen hat Leisten. Das Protokoll nennt eine Stufe nach ihrer Leiste und Zahl („- 1 (Heat 3)“).

  Anstelle von `track` kann eine Stufe einen `derived`-Wert lesen (Capability API 1.54), der mit Live-Zustand und Gegenständen des Charakters berechnet wird, sodass niemand etwas ankreuzen muss: Ember Roads verlangsamt jeden, der 10 Bulk oder mehr trägt.

  ```json
  {
    "derived": "bulk_carried",
    "at": 10,
    "modifiers": [
      { "to": "speed", "flat": -2 },
      { "to": "checks", "skills": ["sneak"], "flat": -1 }
    ]
  }
  ```

  Eine Schwelle, die sich von Charakter zu Charakter unterscheidet („mehr als das Fünffache von Strength“), ist ein abgeleiteter Wert, der sie abzieht: `scale` mit -1 ergibt den abzuziehenden Teil, und eine `sum` aus beidem ist das, was die Stufe liest.

  ```json
  "levels": [
    { "track": "exhaustion", "at": 1, "effects": ["own-checks-disadvantage"] },
    { "track": "exhaustion", "at": 2, "modifiers": [{ "to": "speed", "times": 0.5 }] },
    { "track": "exhaustion", "at": 3, "effects": ["own-attacks-disadvantage", "own-saves-disadvantage"] },
    { "track": "exhaustion", "at": 4, "modifiers": [{ "to": "health-max", "times": 0.5 }] },
    { "track": "exhaustion", "at": 5, "effects": ["speed-zero"] },
    { "track": "exhaustion", "at": 6, "defeats": true }
  ]
  ```

  `"defeats": true` nimmt den Betroffenen bei Kampfbeginn endgültig aus dem Kampf, bevor sich jemand bewegt (Capability API 1.115). Das und die verlorene Gesundheit eines halbierten Maximums werden einmal bei Kampfbeginn abgerechnet; jede andere Stufe wird gelesen, sobald die Zahl gelesen wird, die sie verändert.

  Auch Gegner führen Leisten (Capability API 1.115). Einer ohne Bogen beginnt mit den `tracks`, die ihm gegeben werden, nach deinen Leisten-IDs: Eine Kreatur, die der Game Master vorschlägt, kann sie nennen (`"tracks": { "exhaustion": 2 }`), ebenso ein Bestiariumgegner, der in einen Kampf gestellt wird. Die `conditionImmunities` einer Kreatur können eine Leiste nennen, die eine Stufe liest; dann berührt sie keine Stufe dieser Leiste, mit Bogen oder ohne: die gegen Erschöpfung immunen Untoten und Konstrukte in 5e.

  Modifikatoren, Stufen und die Probenwirkungen brauchen Capability API 1.45.

- `checks` und `contests`: Optional. Was eine vergleichende Probe liest, und die vergleichenden Proben, die jeder im Kampf beginnen darf: Packen, Stoßen, Losreißen. Siehe unten „Vergleichende Proben“. Capability API 1.43.
- `concentration`: Optional. Das laufende `text`-Feld für die aufrechterhaltene Wirkung, der durch Schaden erzwungene `save`, die Untergrenze `floor` der Schwierigkeit und `fromDamage`, der Anteil des erlittenen Schadens, der sie bei einem höheren Wert bestimmt. Der Beginn einer zweiten Konzentrationsfähigkeit beendet die erste. Ein misslungener Rettungswurf beendet sie und entfernt die von ihr aufrechterhaltenen Zustände.
- `dying`: Optional, `kind: "saves"`. Die beiden Leisten für die Würfe – die nötige Anzahl entspricht jeweils ihrem Maximum –, die `dice`, `succeedAt`, die Wirkungen der äußersten Augenzahlen (`naturals.max`: `revive-1` oder `success`; `naturals.min`: `one-failure` oder `two-failures`), die Kosten von Schaden am Boden (`damageWhileDown`, `criticalWhileDown`) und die `condition` eines niedergestreckten Charakters. Ohne diesen Block liegt ein Charakter bei null einfach am Boden und wird durch Heilung wieder aufgerichtet.
- `damageTypes`: Optional. Die Schadenstypen deines Systems, ohne Beachtung der Groß- und Kleinschreibung abgeglichen.
- `damageKinds`: Erforderlich, wenn `health` eine Wundleiste nennt, und bei einem Pool abgelehnt. Nur eine Markierung trägt eine Art; ein Punktepool hat keinen Speicherplatz dafür. Siehe Wundleisten oben. Der Block bestimmt, welche der `kinds` der Leiste ein Treffer markiert und wie viele Kästchen er ankreuzt. `default` gilt für alles nicht Zugeordnete, einschließlich Treffern ganz ohne Typ. `byType` bildet deine `damageTypes` auf Arten ab. Die Schlüssel werden wie die Typen ohne Beachtung der Groß- und Kleinschreibung abgeglichen; `"Fire"` und `"fire"` sind daher ein Schlüssel, und die Angabe beider wird abgelehnt. `marks` hat keinen Standard, weil die beiden Antworten gegensätzlich sind: `"per-point"`, wenn der Schadenswurf Gesundheitsstufen zählt – drei Schaden markieren drei Kästchen, und ein Punkt Schadensminderung lohnt sich –, oder `"per-blow"`, wenn nur zählt, ob ein Treffer ankommt – dann markiert er unabhängig von seiner Stärke ein Kästchen. Auch ein Treffer mit mehreren Schadensbestandteilen markiert dabei nur ein Kästchen und verwendet die schwerste angekommene Art. Gib an, welches Modell dein System nutzt. `{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`.
- `pool`: Erforderlich bei `dice-pool`, abgelehnt bei `attack-vs-defense`. Siehe „Ein Kampf mit Würfelpools“.
- `spendLimits`: Optional. Wie viel eines laufenden Pools ein Kämpfer im Kampf pro `turn` oder pro `round` ausgeben darf, gleich welcher Kampfart: `[{ "pool": "blood", "max": { "derived": "blood_per_turn" }, "per": "turn" }]`. `max` wird einmal zu Kampfbeginn gelesen. Kosten über das hinaus, was vom Limit übrig ist, sind nicht bezahlbar und fehlen daher im Menü, egal wie viel im Pool ist. Ein Limit pro Zug beginnt zu Beginn des eigenen Zuges seines Besitzers neu, eines pro Runde, wenn eine Runde beginnt. Ein mit direkten Zahlen geschriebener Gegner bezahlt nichts von einem Bogen, ein Limit bindet ihn also nie; ein als Bogen geschriebener Gegner bezahlt aus seinen eigenen Pools und unterliegt dem Limit wie jeder andere. Capability API 1.47.
- `threat`: Optional und für ein Bestiarium erforderlich. `tiers` ist die Skala für die Gegnerauswahl: ID, Beschriftung, `health`-Bereich, `defense`, `toHit`, `damagePerRound`-Bereich und `saveDifficulty`. Jede ausgelieferte Kreatur nennt eine dieser Stufen. Ein nicht vorab geschriebener Gegner wird auf die vom Game Master gewünschte Stufe begrenzt, damit nichts außerhalb deiner Skala landet. Der Bereich `damagePerRound` beschreibt den Schaden einer Kreatur gegen EIN Ziel pro Runde, einschließlich ihrer gesamten Angriffsfolge.

### Rettungswürfe gegen Zustände, Schaden oder Magie (Capability API 1.134)

Ein Modifikator mit `to: "saves"` kann `against` tragen. Es braucht mindestens eines von `conditions` (Zustands-IDs des Bogens), `damage` (Schadensarten) oder `magic: true`. Eine einzelne Übereinstimmung genügt; `saves` grenzt den Rettungswurf weiterhin zusätzlich ein (als UND). Verwende den `mode: "advantage"` des Modifikators, nicht `effects`, um Vorteil auf diese Weise einzugrenzen. Diese Modifikatoren funktionieren bei Zuständen, bei erreichten Stufen von Leisten oder abgeleiteten Werten und bei Gegenstandswirkungen. Für Rassenmerkmale leitest du einen Wert aus der Rassenwahl des Bogens ab und hängst den Modifikator an eine Stufe, die erreicht ist, wenn dieser Wert 1 ist. Beispielmodifikatoren:

```json
[
  {
    "$comment": "Dwarven Resilience",
    "to": "saves",
    "mode": "advantage",
    "against": { "conditions": ["poisoned"], "damage": ["poison"] }
  },
  { "$comment": "Fey Ancestry", "to": "saves", "mode": "advantage", "against": { "conditions": ["charmed"] } },
  {
    "$comment": "Gnome Cunning",
    "to": "saves",
    "saves": ["int_save", "wis_save", "cha_save"],
    "mode": "advantage",
    "against": { "magic": true }
  }
]
```

Brave verwendet `conditions: ["frightened"]`. Magic Resistance verwendet `magic: true` ohne `saves`, an einer aus dem Bogen abgeleiteten Stufe oder einer Leistenstufe einer Kreatur. Das `applies` einer Aktion zählt, auch wenn der Rettungswurf den Zustand verhindert; ihr Schaden umfasst jeden `plus`-Bestandteil. Schadensnamen werden ohne Beachtung der Groß- und Kleinschreibung abgeglichen. Magie bedeutet die Qualität `"magical"` aus 1.101: `mechanics.qualities` eines Katalogeintrags (auch ohne Schaden), `damage.qualities` einer Kreaturenaktion oder die Tags einer Gegenstandswaffe. Ein Zauber muss diese Qualität tragen; sein Name oder sein Katalog allein macht ihn nicht magisch. Ein Rettungswurf zum Beenden eines Zustands, einschließlich `saveWhenDamaged` und `saveEnds.at: "damaged"`, richtet sich nur gegen diesen Zustand. Konzentrations- und Todesrettungswürfe richten sich gegen nichts. Außerhalb eines Kampfes tragen Rettungswurfanforderungen des Game Master weder eine strukturierte Quelle noch einen Zustand; `against` passt nie auf solche Anforderungen. Bogen, Gegenstandsdetails, Kampfdetails und die Bogenzusammenfassung des Game Master zeigen diese Einschränkungen. Erfordert schemaVersion 2 und capabilityApi 1.134 oder neuer.

### Ein Kampf mit Würfelpools: `dice-pool`

Ein `dice-pool`-Regelsatz zählt Erfolge, statt Würfel zu addieren, und seine Kämpfe können das auch. `"kind": "dice-pool"` setzt voraus, dass `resolution.kind` den Wert `"dice-pool"` hat, und liest den Bogen so, wie es deine Pool-Proben bereits tun: **Jede Zahl, die ein Wurf addiert, ist eine Anzahl Würfel, und jede Zahl, die er erreichen muss, ist eine Anzahl Erfolge.** Umbenannt wird also nichts:

- Ein Trefferwert (der einer Angriffszeile, das `toHit` einer Fähigkeitsliste, der einer Kreaturenaktion) ist der Pool, den ein Angriff wirft. Der Würfel, der Zielwert, den ein Würfel erreichen muss, und die Augenzahlen, bei denen verdoppelt, explodiert, gestrichen und gepatzt wird, stammen aus deiner `resolution`. Die Wundleiste, die dein `resolution.penaltyFrom` nennt, zieht ihren Abzug vom Pool ab, wie bei einer Probe.
- `defense` ist die Zahl der Erfolge, die ein Angriff braucht, und nie weniger als einer. Der Modifikator eines Zustands für `defense` und Deckung (`cover.bonus` oder `cover.threeQuarters`) addieren sich dazu.
- Jeder Erfolg über die benötigten hinaus fügt einen Schadenswürfel hinzu. Ein Patzer verfehlt, egal was er gezählt hat. Kritische Treffer gibt es nicht: Ein starker Treffer ist seine zusätzlichen Würfel wert.
- Die Zahl eines Rettungswurfs ist sein Pool und seine Schwierigkeit die Zahl der nötigen Erfolge. Eine vergleichende Probe wirft die Probe jeder Seite als Pool, und die Seite mit mehr Erfolgen gewinnt.
- Der Modifikator eines Zustands für Angriffe, Rettungswürfe oder Proben besteht aus hinzugefügten oder abgezogenen Würfeln; er ist also eine `flat`-Zahl, und ein gewürfelter Modifikator (`dice`) wird abgelehnt.
- Schaden sind Würfel deines Würfeltyps: Das `dice` einer Menge (einer Kreatur, eines Eintrags) gibt an, wie viele, und muss von deinem Würfeltyp sein, und ihr `flat`-Teil sind automatische Erfolge, die nie geworfen werden. Bei der Schadenswürfelspalte einer Angriffszeile wird die Anzahl gelesen, `damage.ability` addiert den Wert dieses Attributs als Würfel, und `damage.bonus` addiert automatische Erfolge. `perCostStep` und `scales` fügen wie bisher Würfel hinzu. Heilung und temporäre Punkte sind Mengen und werden wie bisher addiert.
- Initiative ist eine Summe (`initiative.dice` und `modifier`) oder ein Pool, wenn du einen verlangst (`initiative.pool`, siehe unten), und eine Sterberegel behält ihre eigenen Würfel.

Was ein Pool-Kampf darüber hinaus würfelt, steht in seinem `pool`-Block:

```json
"pool": {
  "advantage": true,
  "damageTarget": 6,
  "soak": { "roll": true, "byKind": { "knock": { "abilityMod": "sinew" } } }
}
```

- `advantage`: ob ein Wurf, der sich in eine Richtung neigt, zweimal geworfen wird und der mit mehr Erfolgen zählt (ein Patzer zählt weniger als jeder Wurf ohne Patzer). Ohne diese Angabe wirft ein Kampf einmal, egal was ein Zustand sagt.
- `damageTarget`: der Zielwert je Würfel, gegen den Schadens- und Schadensminderungswürfel geworfen werden. Ohne Angabe der Standardzielwert deiner Auflösung. Diese Würfel zählen jede Augenzahl ab diesem Wert einmal und sonst nichts: Bei ihnen wird nichts verdoppelt, nichts explodiert, nichts gestrichen und nichts gepatzt.
- `soak`: was ein Ziel vom Schaden eines Treffers abzieht, nach Schadensart. `all` ist ein Wertverweis für jede Art und `byKind` einer pro Art deiner Gesundheitsleiste, der für seine Art Vorrang vor `all` hat; eine Art, die von keinem der beiden erfasst wird, wird nicht absorbiert. Mit `"roll": true` wirft das Ziel so viele Würfel gegen den Schadenszielwert, und jeder Erfolg zieht einen Punkt ab. Mit `"roll": false` wird die Zahl von den Schadenswürfeln abgezogen, bevor sie geworfen werden; sie berührt also nie automatische Erfolge, die eine geworfene Schadensminderung wie jeden anderen Erfolg abzieht. Nichts sinkt unter null, und für einen Schlag, der nichts gezählt hat, wird keine Schadensminderung geworfen. Eine Kreatur gibt ihre eigenen Zahlen als `soak: { "all": 1, "byKind": { "knock": 3 } }` an; dafür muss das `soak` des Blocks festlegen, wie Schadensminderung genommen wird. Resistenz, Verwundbarkeit, Immunität und `resist-all` gelten nach der Schadensminderung für den Rest.
- `hardness`: ein Wertverweis für die Härte eines Kämpfers, wo Initiative eine Zahl ist, die Angriffe verschieben. Siehe [Rüstung und getragene Wirkungen im Kampf](#armor-and-worn-effects-in-a-fight).

Der Schaden für jedes Ziel wird für dieses Ziel geworfen, denn was ein Treffer über die nötigen Erfolge hinaus verdient hat und was das Ziel absorbiert, gehört zu ihm. Der zweite Bestandteil eines Schlags und ein Zusatzeffekt sind jeweils ein eigener Schadenspool ihrer eigenen Art, ohne zusätzliche Würfel aus dem Treffer. Das Menü sagt einen Pool exakt voraus: die Chance, die nötigen Erfolge zu erreichen, und was die Schadenswürfel nach der Schadensminderung des ersten Ziels wert sind.

Gravewatch ist so geschrieben: Seine Wächter werfen einen Grundwert und eine Tätigkeit, absorbieren Knock-Schaden mit Sinew und Tear-Schaden überhaupt nicht, dürfen pro Zug einen Punkt Resolve ausgeben und würfeln die Initiative jede Runde neu.

**Ansagen in umgekehrter Reihenfolge ist nicht umgesetzt.** Manche Systeme lassen alle ihre Aktion ansagen, bevor jemand handelt, die Langsamsten zuerst. In einem Kampf, in dem jeder Kämpfer eine Aktion wählt, sobald er an der Reihe ist, ändert eine vorherige Ansage nichts, was eine Regel liest; ein Schlüssel hätte also nichts auszudrücken.

### Mindestschadenswürfel (Capability API 1.146)

Ein Pool-Kampf kann selbst gegen starke Schadensminderung Würfel behalten, wie **Overwhelming** in Exalted:

```json
"damage": { "minimum": { "derived": "overwhelming" } }
```

Das ist `combat.damage.minimum`, ein Wertverweis, der vom aktuellen Bogen des **Angreifers** gelesen wird. Nachdem statische Schadensminderung Würfel vom ersten Schadenspool eines Treffers abgezogen hat, wird der Pool auf mindestens diese Zahl angehoben. Es sind ganze Würfel, abgerundet und zwischen null und `resolution.pool.max` begrenzt, keine automatischen Erfolge: Jeder verbleibende Würfel kann scheitern. Gewürfelte Schadensminderung zieht nach dem Schadenswurf weiterhin Erfolge ab; sie verkleinert keinen Würfelpool, das Minimum schützt Erfolge also nicht vor ihr. Resistenz und Immunität gelten weiterhin. Schläge im ausgebenden Stil ignorieren das Minimum, so wie sie Waffenschaden und Schadensminderung ignorieren; Schläge im nehmenden Stil verwenden es.

Eine Waffe kann das gemeinsame Minimum mit `item.attack.damage.minimum` überschreiben. Es nimmt dieselben Wertverweise auf ihren Träger an oder `{ "stat": "overwhelming" }` für einen der eigenen Zahlenwerte des Gegenstands. Auch eine deklarierte Null überschreibt das gemeinsame Minimum. Das unterscheidet sich vom bestehenden `floor` einer Waffe, das eine Schadensmenge nach der Schadensminderung garantiert. Zusätzliche Schadensbestandteile und Zusatzeffekte erhalten kein weiteres Minimum. Der Kampfdatensatz und das Protokoll zeigen das aufgelöste Minimum neben den Würfeln. Sowohl der Kampfschlüssel als auch der Waffenschlüssel brauchen in einem Paket **Capability API 1.146**, auch für Waffen in externen Katalogdateien.

### Ein Treffer, der benommen macht (Capability API 1.147)

```json
"daze": {
  "over": { "abilityScore": "stamina" },
  "measure": "damage",
  "condition": "dazed",
  "text": "The blow leaves them reeling until their next turn passes."
}
```

`combat.daze` ist für Pool-Kämpfe gedacht. `over` liest den aktuellen Bogen des **Ziels** unmittelbar vor dem Treffer. Ein einzelner Treffer muss nach Schadensminderung, Rettungswürfen und Resistenz **echt mehr** Schaden verursachen als diese Zahl. Seine Schadensbestandteile zählen zusammen; getrennte Treffer summieren sich nie zu einer Benommenheit. Auf einer Leiste, die pro Schlag markiert, zählt ein schadender Treffer als eine Stufe. Ein Schlag, der Initiative statt Gesundheit nimmt, kann nicht benommen machen. `measure` ist derzeit nur `"damage"`.

Das Ziel setzt genau seinen nächsten Zug aus. Weitere benommen machende Treffer vor diesem Zug lassen nicht noch mehr Züge aussetzen. Der ausgesetzte Zug lässt die Uhren von Zuständen und die übrige Zugbuchhaltung weiterlaufen, einschließlich Rundenwechseln und neu gewürfelter Initiative. Speichern und Neuladen des Kampfes bewahrt das anstehende Aussetzen. `condition` nennt, wenn angegeben, einen deklarierten Bogenzustand. Der Kampf markiert ihn, bis der ausgesetzte Zug vorbei ist oder der Kampf endet. Ein bereits vorhandener Zustand bleibt bestehen; Zustandsimmunität verhindert die Markierung, aber nicht das Aussetzen. `text` ist optionaler Erzähltext, keine weitere Wirkung. Das Protokoll und der Kampfkontext des Game Master halten den Treffer und das Aussetzen fest. Der Schlüssel braucht **Capability API 1.147**.

### Das Ziel bestimmt die Wundart (Capability API 1.148)

Ergänze `remap` in der bestehenden Zuordnung `combat.damageKinds`; behalte ihr `default`, `byType` und `marks`:

```json
"damageKinds": {
  "default": "bashing",
  "byType": { "bullet": "lethal", "fire": "aggravated" },
  "marks": "per-point",
  "remap": [
    { "when": { "field": "vampire" }, "from": "lethal", "to": "bashing", "tags": ["firearm"] }
  ]
}
```

Ein Pool-Kampf bestimmt zuerst mit seiner gewöhnlichen Zuordnung die Art des Angriffs und liest dann das `when` jeder Umordnung am **Ziel**. Eine Zahl ungleich null schaltet die Regel ein. `from` und `to` müssen beide Arten der Gesundheitswundleiste sein. Die erste passende Regel gewinnt; Umordnungen werden nicht verkettet. Höchstens 12 dürfen angegeben werden. Mit `tags` muss mindestens eines zum Angriff passen: Eine Waffe trägt bereits `item.tags`, und Katalogmechaniken und Kreaturenschaden tragen bereits `qualities`. Diese Namen stammen aus `items.tags`. Ohne `tags` kann jeder Angriff dieser Art passen. Ein neues Feld für Angriffs-Tags ist nicht nötig.

Die sich ergebende Art bestimmt sowohl die **Schadensminderung** als auch die Wundmarkierungen. So kann der tödliche Treffer einer Schusswaffe gegen einen Vampir zu Schlagschaden werden und die Schadensminderung für Schlagschaden verwenden; dieselbe Schusswaffe gegen jemand anderen oder eine Klinge gegen diesen Vampir behält ihre gewöhnliche Art. Der ursprüngliche _Schadenstyp_ des Angriffs bleibt für Resistenz und Immunität unverändert. Jeder Schadensbestandteil verwendet seine eigene Art und die Tags des Angriffs. Der Kampfdatensatz und das Protokoll zeigen die ursprüngliche und die umgeordnete Art, und die Schadensvorhersage liest dieselbe Regel. Eine einfache Kreatur ohne Bogen kann einen konstanten Verweis erfüllen, aber keine Bogenwerte für diese Regeln liefern; gib ihr dafür einen Kreaturenbogen. Nur der neue Schlüssel `remap` braucht **Capability API 1.148**; ältere Zuordnungen von Schadensarten behalten ihre bisherige Kompatibilität.

### Initiative, die Angriffe verschieben

Manche Pool-Systeme führen die Initiative den ganzen Kampf über als Zahl und lassen Angriffe sie verschieben: Eine Angriffsart nimmt sie dem Ziel weg, eine andere gibt die eigene des Angreifers als Schaden aus, und wer auf eine festgelegte Linie fällt, ist zusammengebrochen. Ein `dice-pool`-Kampf kann das ausdrücken (Capability API 1.48):

```json
"initiative": {
  "pool": { "abilityMod": "nerve" },
  "plus": 3,
  "resource": {
    "base": 3,
    "styles": [
      { "id": "press", "label": "Press", "takes": { "gain": 1 } },
      { "id": "telling", "label": "Telling blow", "spends": { "onMiss": [[0, 1], [6, 2], [11, 3]] } }
    ],
    "crash": { "at": 0, "condition": "reeling", "bonus": 5, "recoverAfter": 3 }
  }
}
```

- **Die Eröffnung.** Jeder wirft zu Kampfbeginn `pool` Würfel, und die Erfolge plus `plus` sind seine Zahl. `resource` braucht daher `pool`: Addierte Würfel ergeben eine Reihenfolge, keine Anzahl Würfel. Das `initiativeModifier` einer Kreatur ist ihr Pool, weil jede Zahl, die ein Pool-Kampf addiert, aus Würfeln besteht. Die Zahl bleibt erhalten: Sie wird nie neu geworfen (`each` wird neben `resource` abgelehnt), und zu Beginn jeder Runde wird die Reihenfolge nach den aktuellen Zahlen sortiert.
- **Stile.** Jeder Angriff (eine Angriffszeile, eine Fähigkeit oder ein Katalogeintrag, der zum Treffen würfelt und Schaden verursacht, eine Kreaturenaktion, die das tut, und eine aus anderen Aktionen zusammengesetzte Aktion) wird einmal pro Stil angeboten, und ein Spieler wählt den Stil vor dem Ziel. Bis zu vier Stile; jeder nimmt oder gibt aus, und mindestens einer nimmt. Eine Wahl ohne Stil erfolgt im ersten; eine Wahl in einem Stil, in dem der Angriff nicht angeboten wird, wird abgelehnt. Ein Angriff behält den Stil, in dem er ausgeführt wurde, bis er vorbei ist, auch wenn eine Antwort die Zahl seines Urhebers ändert, bevor er trifft.
- **Ein nehmender Stil.** Bei einem Treffer wird der Schaden wie üblich geworfen (die zusätzlichen Würfel aus dem Treffer, die Würfel der Waffe, Schadensminderung nach Art, automatische Erfolge), und was er zählt, wird von der Zahl des Ziels statt von seiner Gesundheit abgezogen. Der Angreifer gewinnt alles davon plus `gain`.
- **Ein ausgebender Stil.** Wird nur angeboten, solange die Zahl des Angreifers über der Zusammenbruchslinie liegt (0 ohne `crash`), und nie für eine aus anderen Aktionen zusammengesetzte Aktion, weil eine Zahl für einen einzelnen Schlag ausgegeben wird. Bei einem Treffer ist der Schaden die Zahl des Angreifers zum Zeitpunkt des Angriffs, als Würfel gegen den Schadenszielwert, und sonst nichts: keine Waffenwürfel, keine zusätzlichen Würfel aus dem Treffer, keine automatischen Erfolge, keine Schadensminderung. Er markiert Gesundheit mit der eigenen Schadensart des Angriffs. Ist der Angriff vorbei, kehrt eine Zahl, die irgendwo getroffen hat, zu `base` zurück, und eine, die nirgends getroffen hat, verliert, was `onMiss` bei der Zahl vorgibt, mit der sie eingesetzt wurde (eine Stufentabelle: aufsteigende Paare `[at least, lose]`; unter der ersten Stufe nichts).
- **Zusammenbruch.** Eine Zahl, die auf `crash.at` oder darunter fällt, ist zusammengebrochen: Die `condition` (einer deiner eigenen Zustände, optional) wird dem Betroffenen auferlegt, und wer ihn dorthin gebracht hat, gewinnt `bonus`. Ein Fehlschlag, der seinen eigenen Urheber zusammenbrechen lässt, gibt niemandem einen Bonus. Ein zusammengebrochener Kämpfer kann nicht ausgeben. Der Zusammenbruch endet samt Zustand, wenn seine Zahl wieder über die Linie steigt, nach `recoverAfter` seiner eigenen Züge (seine Zahl kehrt zu Beginn dieses Zuges zu `base` zurück) und wenn der Kampf endet, wie auch immer er endet. Wer mit seinem Eröffnungswurf auf oder unter der Linie liegt, beginnt den Kampf zusammengebrochen. `base` muss über `crash.at` liegen, sonst würde die Rückkehr dorthin den Kämpfer erneut zusammenbrechen lassen.

Das Menü zeigt für jeden Stil eine eigene Vorhersage: die Trefferchance und was ein nehmender Stil nehmen oder welchen Schaden ein ausgebender verursachen würde. Die Statusanzeige zeigt die Zahl aller Beteiligten, und das Protokoll nennt jede Änderung samt Grund: „Ada gewinnt 5 Initiative für den Zusammenbruch von Rats und steht bei 14.“ Die Auswahl der Engine wägt einen Schlag im nehmenden Stil einen Zug voraus ab: erst nehmen und dann ausgeben gegen jetzt ausgeben und danach erneut von der Basis aus.

<a id="what-a-fight-reads-from-mechanics"></a>

### Was ein Kampf aus `mechanics` liest

`kind` entscheidet, ob `amount` Schaden oder Heilung bedeutet. Alles mit `reaction` fehlt im Menü, ebenso `utility`, sofern der Eintrag nicht verändert, was der Zug selbst enthalten darf; siehe unten. `attackRoll` würfelt mit dem `toHit` der Liste gegen die Verteidigung des Ziels; `autoHit` überspringt das vollständig. `save` würfelt den eigenen Rettungswurf des Ziels gegen die `saveDifficulty` der Liste. `onSuccess` legt fest, ob bei Erfolg die Hälfte oder nichts übrig bleibt. `targetCount` bestimmt die Zahl der Ziele. Eine Fähigkeit ohne Angriffswurf – etwa eine Fläche mit Rettungswürfen für alle oder ein automatischer Treffer – würfelt ihre Würfel EINMAL für alle Ziele. Eine Fähigkeit mit Angriffswurf je Ziel würfelt ihren Schaden bei jedem Treffer neu. `applies` setzt Zustände auf die betroffenen Ziele. Jeder hat eine `duration` von `instant` (ohne eigene Zeitbegrenzung; er bleibt, bis etwas ihn entfernt), `until-save` (braucht daneben `saveEnds`) oder `{ "rounds": n }`. Optional nennt `saveEnds` den Rettungswurf und dessen Wiederholung bei `turn-end` oder `turn-start`. Runden zählen die eigenen Züge des Betroffenen jeweils an deren Ende herunter; `{ "rounds": 1, "at": "turn-start" }` zählt sie jeweils an deren Beginn, und so drückt man „bis zum Beginn deines nächsten Zuges“ aus. `"of": "source"` (Capability API 1.119) zählt stattdessen die Züge dessen, der ihn auferlegt hat, beginnend mit dessen nächstem; so drückt man „bis zum Ende deines nächsten Zuges“ für jemand anderen aus. Das `{ "duration": { "rounds": 1, "of": "source" }, "endsAfter": "attacked" }` von Guiding Bolt gibt dem nächsten Angriffswurf gegen sein Ziel vor dem Ende des nächsten Zuges des Wirkenden Vorteil. Verlässt die Quelle den Kampf, zählen die Runden in den eigenen Zügen des Betroffenen. Das `delays` eines Kampfzustands (Capability API 1.120) hält zurück, was sein Betroffener nutzt: Eine Aktion aus einem seiner `catalogs`, bezahlt mit seinem `budget`, würfelt einen Würfel mit `chance.sides` Seiten, und bei `chance.atLeast` oder mehr geschieht sie noch nicht. Zu Beginn des nächsten Zuges des Betroffenen wird sie mit demselben Budget abgeschlossen und läuft weiter, wie sie gelaufen wäre, samt Antworten; kann er nicht handeln oder hat er nichts von diesem Budget, ist sie verloren. Was sie gekostet hat, bleibt in jedem Fall verbraucht. Slow in 5e ist `"delays": { "catalogs": ["spells"], "budget": "action", "chance": { "sides": 20, "atLeast": 11 } }`. `endsAfter` entfernt den Zustand nach dem ersten `own-attack` (dem nächsten Angriffswurf des Betroffenen), `attacked` (dem nächsten Angriffswurf gegen den Betroffenen) oder `own-save` (dem nächsten Rettungswurf des Betroffenen), egal was seine Uhr sagt; `{ "duration": { "rounds": 1 }, "endsAfter": "own-attack" }` bedeutet also „bei seinem nächsten Angriff vor dem Ende seines nächsten Zuges“. Ein Zustand, der einen Angriff lang hält, hält den ganzen Angriff einschließlich seines Schadens, und ein frischer, den derselbe Schlag auferlegt, bleibt bestehen. Beides braucht Capability API 1.45. `temporary` gewährt temporäre Punkte auf dem Gesundheitspool. Sie addieren sich nie; der größere Puffer bleibt. `scales` erhöht die Menge um die zusätzlichen WÜRFEL, die seine Tabelle für den gelesenen Wert vorgibt. `cost` wird über den eigenen `use`-Befehl des Bogens bezahlt. `budget` überschreibt den verbrauchten Teil des Aktionsbudgets.

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
    "when": ["advantage", "ally-adjacent-no-disadvantage"],
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

`sources` nennt die Angriffslisten, von denen der Effekt ausgeht, und `requires` eine als wahr gewertete Spalte ihrer Zeilen. So kann ein Zusatzeffekt seine Einschränkung auf bestimmte Waffen beschreiben, ohne dass die Engine wissen muss, was eine Waffe ist. Fehlen beide Angaben, gilt jeder Treffer des Besitzers. Eine aus der Tasche gehaltene Waffe ist keine Zeile; `weapons` (Capability API 1.70) nennt daher zusätzlich die Gegenstands-Tags, bei denen der Effekt auslöst: `"weapons": { "tags": ["finesse",
"ranged"] }` löst bei einem Treffer mit einer gehaltenen Waffe aus, die eines dieser Tags trägt, einschließlich ihres Schlags mit der Nebenhand. Wer nur `weapons` nennt, löst bei keiner Zeile aus, und wer nur Zeilen nennt, bei keiner gehaltenen Waffe. Bei `when` reicht EINE Bedingung: `advantage` ist der letztlich angewendete Vorteil des Angriffswurfs. `ally-adjacent` ist ein aufrecht stehender, handlungsfähiger Verbündeter des Angreifers, auf einem Brett höchstens eine Zelle vom Ziel entfernt und ohne Brett an beliebiger Position. `ally-adjacent-no-disadvantage` (Capability API 1.126) verlangt außerdem, dass der endgültige Wurf nach dem Aufheben von Vorteil und Nachteil nicht mit Nachteil erfolgt; das obige Beispiel verwendet es für Sneak Attack. `oncePer` ist `turn` (frisch zu Beginn jedes Zuges, damit auch ein Angriff während eines fremden Zuges einen Zusatzeffekt tragen kann) oder `round`. `amount` wächst mit den eigenen `scales` des Eintrags. `type` ist die Schadensart und verwendet standardmäßig die des Treffers.

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

Die folgenden Zahlen sind die direkte Schreibweise für eine Kreatur. Eine in den eigenen Begriffen deines Regelsatzes als `sheet` geschriebene Kreatur liest `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves`, `checks`, `soak` und `hardness` stattdessen aus diesem Bogen; siehe unten "Eine Kreatur in den eigenen Begriffen deines Regelsatzes".

- `health`: Eine Zahl oder `{ "dice": "3d6", "flat": 2 }`, einmal beim Erstellen des Kampfes gewürfelt. Eine Vorschau verwendet den Durchschnitt, damit das Menü keinen ungewürfelten Wert verspricht.
- `defense`, `initiativeModifier`, `speed`: Der Zielwert eines Angriffs, der Initiativmodifikator (oder, wo Initiative als Pool geworfen wird, die Zahl der Würfel, die sie wirft) und die Bewegungsweite pro Zug in deiner eigenen Entfernungseinheit.
- `abilities` und `saves`: Zuordnungen anhand der Attributs- und Rettungswurf-IDs deines Bogens. Ein nicht genannter Rettungswurf wird als null gelesen.
- `checks`: Was sie in einer vergleichenden Probe addiert, mit den IDs von `combat.checks` als Schlüssel. Ein nicht genannter Wert wird als null gelesen. Capability API 1.43.
- `soak`: Nur in einem `dice-pool`-Kampf; was sie absorbiert: `all` für jeden Schaden, `byKind` für eine Art deiner Gesundheitsleiste. Capability API 1.47.
- `hardness`: Wo Initiative eine Zahl ist, die Angriffe verschieben, bewirkt ein Schlag im ausgebenden Stil, dessen Würfel darunter liegen, nichts. Capability API 1.56.
- `speeds` und `hover`: Wie sie sich außer durch Gehen bewegt (siehe „Andere Arten der Bewegung“ unter Positionen). Capability API 1.113.
- `shield: true`: Ihre Hände sind voll; die Alternative `twoHanded` einer Aktion gilt also nicht. Capability API 1.102.
- `size`: Eine der `combat.sizes` per ID, die das `maxSizeAbove` einer vergleichenden Probe liest (siehe „Größen und Befreiungsschwierigkeiten“). Capability API 1.103.
- `type` und `tags`: Einer der `combat.creatureTypes.types` und bis zu acht seiner `tags` per ID, die Zielprüfungen lesen (siehe „Kreaturentypen und Zielprüfungen“). Capability API 1.168.
- `resist`, `vulnerable`, `immune`: Schadenstypen, ohne Beachtung der Groß- und Kleinschreibung abgeglichen und bei vorhandener Deklaration gegen `combat.damageTypes` geprüft. Ein `resist`- oder `immune`-Eintrag kann außerdem angeben, was hindurchkommt, `{ "type": "tearing", "except": ["silver"] }`: Der Schlag einer Gegenstandswaffe, die eines dieser Gegenstands-Tags trägt, wird voll erlitten (Capability API 1.55, siehe [Waffen im Kampf](#weapons-in-a-fight)), ebenso der Schlag einer Aktion, deren `damage.qualities` eines davon nennt, oder eines Katalogeintrags, dessen `mechanics.qualities` eines davon nennt (Capability API 1.101). `conditionImmunities` nennt deine eigenen Zustände oder eine Leiste, die deine `combat.levels` lesen (Capability API 1.115).
- `tier`: Die zugehörige Stufe von `combat.threat`.
- `loot` (Capability API 1.63): Die ID der Beutetabelle, die ein gewonnener Kampf für sie würfelt (siehe oben „Beute“).
- `traits`: Kurze Paare aus Name und Text für den Game Master. Sie werden nie regeltechnisch aufgelöst. Alles mit Zahlen gehört deshalb in eine Aktion.
- `signaturePoints`: Punkte, die zu Beginn des eigenen Zuges zurückkehren und für `signature`-Aktionen ausgegeben werden.
- `riders`: Bis zu vier Zusatzeffekte wie `rider` an einem Katalogeintrag, hier direkt im Block. Jeder hat die Form `{ "id": "pack", "name": "Pack", "on": "hit", "oncePer": "turn" | "round", "amount": { "dice": "1d6" } }`, mit optionalem `type` und optionalen `actions` für die eigenen Aktionen dieses Blocks, bei denen er auslöst. Ein Block-Zusatzeffekt liest keine Bogenliste; deshalb hat er die Schlüssel `sources` und `requires` nicht. Eine als Bogen geschriebene Kreatur erhält wie ein Charakter die Zusatzeffekte ihrer Listen.
- `actions`: Bis zu zwölf, jeweils mit eigener `id`. Eine Aktion enthält die Angaben eines handgeschriebenen Werteblocks (`toHit`, `autoHit`, `damage`, `save`, `applies`, `targetCount`, `reach`, `range`, `area`) sowie vier nur für Kreaturen vorgesehene Angaben. `reach` ist die Nahkampfreichweite, `range` die Wurf- oder Schussreichweite und `area` die betroffene Form, alles in deiner eigenen Entfernungseinheit. `range` darf eine einfache Zahl sein oder `{ "normal": 30, "long": 120 }`, wenn größere Entfernung mit einem Abzug erreichbar bleibt. `area` lautet `{ "shape": "burst" | "cone" | "line", "size": n, "friendlyFire": false }`; siehe Positionen:
  - `uses`: `{ "per": "encounter" | "day", "count": n }`. Sind die Nutzungen aufgebraucht, verschwindet die Aktion aus dem Menü.
  - `recharge`: `{ "dice": { "count": 1, "sides": 6 }, "from": 5 }`. Die Aktion beginnt verfügbar, wird bei Nutzung verbraucht und würfelt zu Beginn des eigenen Zuges der Kreatur. `from` oder höher stellt sie wieder her. Das Protokoll zeigt die Würfel in beiden Fällen.
  - `damage.alternatives` (Capability API 1.102): Bis zu vier Mengen, die sie anstelle ihrer ersten verursacht, jede `{ "when": ..., "dice": "1d10", "flat": 3 }`; die erste, die zutrifft, gewinnt. Art, Bestandteile und Qualitäten bleiben die der Aktion. `"when": "twoHanded"` trifft zu, sofern die Kreatur nicht `"shield": true` hat; das ist „oder 8 (1d10 + 3) Hiebschaden, wenn mit zwei Händen geführt“ in 5e. `"when": { "selfHealthAtMost": 0.5 }` trifft zu, solange ihre Gesundheit höchstens diesen Anteil ihres Höchstwerts beträgt; das ist das „oder 5 (2d4) Stichschaden, wenn der Schwarm die Hälfte seiner Trefferpunkte oder weniger hat“ eines Schwarms. Die Vorhersage des Menüs und der Schlag lesen sie beide so, wie sie gerade steht.
  - `sequence`: Andere Aktionen desselben Blocks in Reihenfolge, jede mit eigenem Ziel. **So wird eine Kreatur geschrieben, die mit einer Aktion zweimal angreift.** Ein Budget bezahlt die gesamte Folge. Eine Folge hat keine eigenen Wirkungen und darf nie eine andere Folge nennen.
  - `signature`: `{ "cost": n }`, bezahlt mit den eigenen Punkten der Kreatur statt mit einem Budget und nur, während jemand anderes handelt. Der Kampf bietet sie im Fenster zwischen zwei Zügen an; siehe Fenster.
  - `reaction`: Dasselbe Objekt wie `mechanics.reaction` eines Katalogeintrags (siehe Fenster): Die Aktion steht in keinem Zugmenü und wird stattdessen in dem Moment angeboten, den sie nennt. Eine Reaktion ist nicht zugleich eine Signaturaktion, und keine Folge darf eine enthalten.
  - `self: true`: Sie wirkt auf die Kreatur selbst statt auf jemand anderen und nimmt daher weder `targetCount` noch `area`. Beides braucht Capability API 1.46. Eine Parade (Parry) ist beides, mit einem Zustand `parrying`, der 2 zur Verteidigung addiert:

    ```json
    {
      "id": "parry",
      "name": "Parry",
      "budget": "reaction",
      "self": true,
      "reaction": { "on": "hit" },
      "applies": [{ "condition": "parrying", "duration": { "rounds": 1 }, "endsAfter": "attacked" }]
    }
    ```
- Ein Rettungswurf braucht eine Schwierigkeit an der Aktion selbst: `save.difficulty` für einen durch die Aktion erzwungenen Rettungswurf oder `saveDifficulty` für einen durch Rettungswurf endenden Zustand, wenn die Aktion keinen eigenen Rettungswurf hat. Auch bei einer Kreatur mit Bogen wird eine Blockaktion in direkten Zahlen geschrieben; die Schwierigkeit steht daher an der Aktion. Der eigene Rettungswurf eines Schadensbestandteils darf seine `difficulty` auslassen und auf dieselbe Zahl zurückgreifen.
- `damage.plus` ist dieselbe Liste von Schadensbestandteilen wie `plus` an einem Katalogeintrag und wird genauso gelesen: `"damage": { "dice": "1d6", "flat": 2, "type": "piercing", "plus": [{ "dice": "1d4", "type": "fire" }] }` beschreibt einen Biss mit eigenem Feuerschaden, auf den Resistenzen und Verdopplung getrennt angewendet werden.

Eine Kreaturenaktion kann mit `heal` Trefferpunkte zurückgeben (Würfel, ein fester Betrag oder beides), begrenzt auf das Maximum ihres Ziels. `targets: "ally"` erreicht ihre eigene Seite, einschließlich ihrer selbst; `targets: "any"` erreicht beide Seiten. Ohne `targets` erreicht sie wie bisher die andere Seite. Diese Schlüssel brauchen Capability API 1.121. Eine Heilung trägt kein `damage`, `toHit`, `save` oder `area`; `targets` nimmt kein `self` oder `sequence` an, und eine Folge trägt keinen der beiden Schlüssel. Healing Touch eines Deva ist:

```json
{
  "id": "healing_touch",
  "name": "Healing Touch",
  "budget": "action",
  "heal": { "dice": "4d8", "flat": 2 },
  "targets": "ally",
  "uses": { "per": "day", "count": 3 }
}
```

Das `spellcasting` einer Kreatur (Capability API 1.123) wirkt Katalogzauber, ohne Zauberplätze oder Punkte auszugeben. Seine `saveDifficulty` und sein `toHit` liefern die Zahlen des Zaubers; eine Kreatur mit `sheet` kann sie weglassen, um die Zauberwirkungswerte ihres Bogens zu verwenden. Eine einfache Kreatur muss jede Zahl liefern, die ihre Zauber brauchen. Jedes `entry` nennt einen vorhandenen Katalogeintrag mit `mechanics`. Ohne `uses` ist ein Zauber beliebig oft nutzbar; `level` ist die Wirkstufe für die Skalierung über `perCostStep`, ohne Angabe die Basis des Eintrags. Der Eintrag liefert weiterhin Budget, Ziele, Konzentration, Reaktionen, Flächen und Beschwörungen. Die Liste einer Dryade könnte so geschrieben werden; diese Zauber-IDs sind Beispiele und müssen in einem Katalog `spells` vorhanden sein:

```json
"spellcasting": {
  "saveDifficulty": 14,
  "spells": [
    { "entry": "spells/druidcraft" },
    { "entry": "spells/entangle", "uses": { "per": "day", "count": 3 } },
    { "entry": "spells/goodberry", "uses": { "per": "day", "count": 3 } },
    { "entry": "spells/barkskin", "uses": { "per": "day", "count": 1 } },
    { "entry": "spells/pass-without-trace", "uses": { "per": "day", "count": 1 } },
    { "entry": "spells/shillelagh", "uses": { "per": "day", "count": 1 } }
  ]
}
```

Für einen Vettelzirkel ergänzt du neben `spells` `"coven": { "id": "marsh_hags", "size": 3, "within": 30 }` und an jedem gemeinsamen Zauber `"coven": true`. Diese Zauber werden nur angeboten, solange mindestens drei stehende Kampfbeteiligte auf der Seite des Wirkenden diese Zirkel-ID tragen, jeder innerhalb von 30 Entfernungseinheiten des Regelsatzes um den Wirkenden, gemessen als einfache Zellenentfernung. Ohne Brett zählen alle stehenden Mitglieder. Die Nutzungen jedes Zaubers bilden einen gemeinsamen Pool für den Zirkel, geschlüsselt nach Zirkel-ID und Eintrag. Ein Zirkelblock braucht einen Zirkelzauber und ein Zirkelzauber den Block; doppelte Einträge werden abgelehnt. Eine vom Game Master vorgeschlagene Kreatur verliert beim Begrenzen ihr `spellcasting`, weil eine Bedrohungsskala eine Zauberliste nicht begrenzen kann.

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
- **Jede Zahl hat genau eine Quelle.** Eine Kreatur mit Bogen gibt nicht zusätzlich `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves` oder `checks` an. Tut sie es doch, lehnt die Engine die Datei ab. Sie darf ohne eigene `actions` auskommen, weil ihre Listen ihr Handeln beschreiben. Eine Kreatur ohne Bogen gibt weiterhin die ersten drei Werte und mindestens eine Aktion an.
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
"cover": { "bonus": 2, "threeQuarters": 5, "saves": ["dex_save"], "creatures": true },
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

**Andere Arten der Bewegung** (Capability API 1.113). Die `speeds` einer Kreatur geben an, wie sie sich außer durch Gehen bewegt, `{ "fly": 60, "swim": 30, "climb": 30, "burrow": 20 }` in deiner Einheit, und `"hover": true` sagt, dass ein Flieger keine Bewegung braucht, um in der Luft zu bleiben (das braucht eine `fly`-Geschwindigkeit). Die eines Gruppenmitglieds kommen über `economy.movementModes` vom Bogen, Wertverweise mit denselben Schlüsseln, so wie die Schwimmgeschwindigkeit einer Rasse oder die Fluggeschwindigkeit eines Zaubers; eine Null bedeutet keine Bewegung auf diese Art. `speed` und `economy.movement` bleiben das Gehen. Auf einem Brett gilt:

- Die Bewegungsweite ist die der schnellsten Art, auf die sich jemand bewegt, und jede bewegte Zelle wird von allen Arten zugleich abgezogen. Eine Kreatur, die 30 geht und 60 fliegt, kann also 10 gehen und dann 40 fliegen und nie mehr als 30 gehen.
- Ein Flieger betritt für eine Zelle alles, was nicht fest ist, einschließlich Wasser und Absätzen beliebiger Höhe.
- Ein Schwimmer durchquert Wasser für eine Zelle und geht an Land.
- Ein Kletterer nimmt einen Absatz beliebiger Höhe für das, was der betretene Boden kostet.
- Die Grabgeschwindigkeit wird für den Game Master mitgeführt und bewegt sich wie ein Gang, da ein Brett keinen Boden hat, durch den man graben könnte.

Jeder Schritt wird auf die günstigste Art gemacht, von der noch genug übrig ist. Ein Kampf ohne Brett liest nichts davon, und wer nur geht, bewegt sich genau wie bisher.

**Flughöhe** (Capability API 1.114). Auf einem Brett, dessen Regelsatz `combat.elevation.levelHeight` und `combat.distance.perCell` angibt, werden einem Flieger dort, wo er steht, Fly up und Fly down angeboten, die jeweils eine Höhenstufe seines Flugs kosten (eine Höhenstufe von 5 Fuß auf Zellen von 5 Fuß ist eine Zelle). Er kann bis zu 20 Höhenstufen über dem Boden steigen, über dem er sich befindet. Solange er oben ist:

- Er fliegt nur, eine Zelle pro Schritt über allem, was nicht fest ist.
- Die Entfernung zwischen ihm und jemand anderem ist der größere Wert aus ebener Entfernung und Höhenunterschied. Ein Schwert mit 5 Fuß Reichweite kann einen Drachen 30 Fuß über dem Boden also nicht berühren, und auch dessen eigener Biss erreicht den Ritter nicht.
- Er hat gegenüber jedem, der tiefer ist, die Anhöhe, wie ein Hügel sie ihm geben würde.
- Das Verlassen der Reichweite von jemandem, für den er zu hoch ist, zieht keinen Angriff auf sich.
- Niedergeschlagen, zu Boden geworfen oder auf eine Geschwindigkeit von null gehalten, fällt er auf den Boden darunter, wie `falling` es angibt, sofern er nicht `hover` hat.

Fliegt er auf Boden, der so hoch ist wie er oder höher, landet er dort, so wie ein Flieger am Boden auf eine Klippe fliegt. Es gibt keinen neuen Schlüssel: Eine Engine vor 1.114 hält Flieger am Boden; ein Paket, das sich auf Höhe verlässt, deklariert also 1.114.

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

Eine Linie in der `mechanics.area` eines Eintrags oder in der `area` einer Kreaturenaktion kann `width` in derselben Einheit wie `size` tragen, auf Zellen gerundet, mindestens eine (Capability API 1.128), zum Beispiel `{ "shape": "line", "size": 60, "width": 10 }` für eine 60 Fuß lange und 10 Fuß breite Linie; lass es für eine Zelle weg. Bei einer geraden Zellenbreite liegt die zusätzliche Spalte links vom Wirkenden.

**Sichtlinie und Deckung.** Zwischen beiden wird eine gerade Linie von Zellen betrachtet: Eine Wand oder ein Berg darauf blockiert einen Fernangriff und die weitere Ausbreitung einer Fläche, und das Ziel erscheint dann gar nicht im Menü. Über Wasser hinweg wird gesehen: Ein Schuss überquert einen Fluss, und eine Linienfläche setzt sich darüber fort. Die eigenen Kämpfe der Engine verwenden dieselbe Sichtprüfung.

Deckung wird vom Standort des Angreifers aus gelesen, nach den Eckenlinien der optionalen Rasterregel des DMG: von der besten Ecke des Angreifers je eine Linie zu jeder Ecke der Zelle des Ziels. Drei oder vier Linien durch eine Wand oder einen Berg sind Dreivierteldeckung; jede Linie durch eines davon oder durch Gelände, das als Deckung zählt (Wald, Ruinen), ist halbe Deckung; niedriges Gelände allein ist nie mehr als halbe Deckung. Ein Ziel, das der Angreifer überhaupt nicht sehen kann, hat vollständige Deckung und erscheint nicht im Menü. Gegen einen Angriff hat ein Ziel, das auf als Deckung zählendem Gelände steht, wie bisher mindestens halbe Deckung; einem Rettungswurf hilft nur, was zwischen dem Ziel und der Wirkung liegt.

- `cover.bonus` ist, was halbe Deckung zur Verteidigung addiert, gegen die ein Angriff gewürfelt wird, und das Protokoll nennt es.
- `cover.threeQuarters` (Capability API 1.74) ist, was Dreivierteldeckung addiert; ohne diese Angabe gilt `bonus` für beide.
- `cover.saves` (1.74) nennt die Rettungswürfe, denen Deckung ebenfalls hilft, gegen den eigenen Rettungswurf einer Aktion (nie gegen einen Rettungswurf, der einen Zustand beendet oder die Konzentration erhält): vom Landepunkt einer Kreisfläche aus und bei allem anderen von ihrem Urheber aus. Auch das nennt das Protokoll.
- `cover.creatures` (1.74) macht jeden, der im Weg steht, zu halber Deckung, Freund wie Feind.
- Ein Rettungswurf, dessen Text sagt, dass das Ziel keinen Vorteil aus Deckung zieht (Sacred Flame in 5e), gibt `"ignoresCover": true` an (1.74), am `mechanics.save` eines Eintrags, am `save` einer Kreaturenaktion oder am `save` einer Gegenstandsnutzung.

**Höhe.** Ein Brett kann Höhe haben, bis zu drei Höhenstufen, und jeder Kampf mit Positionen geht und sieht danach, egal was der Regelsatz sagt: Eine Höhenstufe hinaufzusteigen kostet eine Zelle mehr, hinunter kostet nichts, ein Absatz von zwei Höhenstufen oder mehr ist eine Klippe, die niemand begeht (und niemand wird hinaufgestoßen), und Gelände, das höher als beide Enden ist, blockiert die Sicht. Beim Schießen von höherem Gelände nach unten verbirgt niedrige Deckung dazwischen nichts. Ein Regelsatz gibt mit `elevation` an, was sein System hinzufügt (Capability API 1.75; das braucht `distance`):

```json
"elevation": {
  "levelHeight": 5,
  "highGround": "advantage",
  "rangeBonus": 1,
  "falling": { "per": 10, "dice": { "count": 1, "sides": 6 }, "max": 20, "type": "bludgeoning", "prone": "prone" }
}
```

- `levelHeight` gibt an, wie hoch eine Höhenstufe in der eigenen Entfernungseinheit des Regelsatzes ist.
- `highGround` ist, was ein Schlag von höherem Gelände nach unten einem Angriffswurf gibt: `"advantage"` oder `{ "bonus": n }`, abgezogen von der Verteidigung, gegen die der Angriff gewürfelt wird. Ohne Angabe gibt es nichts.
- `rangeBonus` gibt an, wie viele Zellen weiter ein Schuss von höherem Gelände reicht.
- `falling` ist, was ein Sturz bewirkt: Wer von einem Absatz von zwei Höhenstufen oder mehr gestoßen wird, landet unten und erleidet `dice` für jede Strecke `per` des Falls (Höhenstufen mal `levelHeight`), höchstens `max` Würfel der Art `type`, und erhält danach den Zustand aus `prone`, wenn einer angegeben ist. Die Würfel werden so geworfen, wie das System Schaden wirft: addiert oder bei `dice-pool` als Erfolge gezählt, abzüglich der Schadensminderung. Ein Sturz ist ein Schlag wie jeder andere; er kann also jemanden zu Boden bringen oder seine Konzentration brechen. Das Protokoll nennt, wie tief jemand gefallen ist. Ohne `falling` wird der Sturz vermerkt und bewirkt nichts.

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

Der Kampf läuft auf dem Kampfbildschirm in deinen Begriffen. Das Menü enthält deine Angriffe, Fähigkeiten, vergleichenden Proben und aufgeführten Standardaktionen, jeweils mit Kosten aus deinen Budgets und Pools. Angezeigt werden Zugreihenfolge, Runde, alle benannten Zustände mit verbleibenden Runden, temporäre Punkte, Konzentration und die beiden Zähler deiner Sterberegel. Das Protokoll zeigt die echte Rechnung in deinen Begriffen, etwa: "Juno greift Rust jackal mit Road axe an: 8 (5 + 3) + 3 = 11 gegen Guard 6, ein Treffer." Jede angenommene Aktion wird sofort auf den Bogen geschrieben. Neuladen mitten im Kampf ist daher exakt, und der Game Master wird anschließend angewiesen, diese Zahlen nicht erneut zu verändern.

Ein Kampf mit Positionen erscheint auf dem Brett statt auf der Porträtbühne. Siehe Positionen für die Bedienung. Jede Entfernung auf dem Brett, im Menü und im Protokoll verwendet DEINE Einheit, etwa: "Juno bewegt sich für 6 Schritte auf 4, 6 und hat noch 2 Schritte übrig."

### Vergleichende Proben: Packen, Stoßen, Losreißen

Manche Züge sind kein Angriff gegen eine Verteidigung, sondern eine vergleichende Probe: Beide Seiten würfeln, und wer besser abschneidet, setzt sich durch. Jemanden packen, ihn umstoßen oder wegstoßen und sich losreißen haben alle dieselbe Form; ein Regelsatz beschreibt daher jede davon als Daten:

```json
"checks": [
  { "id": "brawn", "label": "Brawn", "value": { "abilityMod": "brawn" } },
  { "id": "wits", "label": "Wits", "value": { "abilityMod": "wits" } }
],
"contests": [
  {
    "id": "grab",
    "label": "Grab",
    "budget": "act",
    "attacker": { "checks": ["brawn"] },
    "defender": { "checks": ["brawn", "wits"] },
    "onWin": { "applies": [{ "condition": "held" }] }
  },
  {
    "id": "break_free",
    "label": "Break free",
    "budget": "act",
    "attacker": { "checks": ["brawn", "wits"] },
    "defender": { "checks": ["brawn"] },
    "from": { "holding": "held" },
    "onWin": { "ends": [{ "condition": "held", "on": "actor" }] }
  },
  {
    "id": "shove",
    "label": "Shove back",
    "budget": "act",
    "attacker": { "checks": ["brawn"] },
    "defender": { "checks": ["brawn"] },
    "ties": "attacker",
    "onWin": { "push": 4 }
  }
]
```

- **`checks`** sind die Zahlen, die eine vergleichende Probe liest, jeweils ein Wert vom Bogen, der einmal zu Kampfbeginn gelesen wird, wie eine Verteidigung oder ein Rettungswurf. Eine mit direkten Zahlen geschriebene Kreatur gibt ihre eigenen an (`"checks": { "brawn": 2 }`); eine mit Bogen liest sie daraus. Bis zu zwölf.
- **Der Wurf.** Beide Seiten werfen deine `attackRoll.dice` und addieren den besten der Werte, die sie hier verwenden dürfen (`attacker.checks`, `defender.checks`). Die höhere Summe gewinnt; bei Gleichstand gewinnt der Verteidiger, sofern `ties` nicht `"attacker"` angibt. Das Protokoll nennt beide Seiten: „Juno versucht Grab bei Ash-hound: 12 (6 + 6) + 3 = 15 mit Brawn gegen 2 (1 + 1) + 2 = 4 mit Brawn und gewinnt.“
- **Gewinnen** bewirkt, was `onWin` angibt, mindestens eine Sache:
  - `applies` erlegt dem Verlierer Zustände auf, mit dem Gewinner als Quelle; ein Zustand, den du mit `endsWhenSourceDown` markierst, endet also, wenn der Festhaltende zu Boden geht. `rounds` gibt einem Zustand eine Uhr; ohne diese Angabe hält er, bis etwas ihn beendet.
  - `ends` entfernt Zustände vom Handelnden oder vom Ziel.
  - `push` bewegt den Verlierer so weit in deiner Entfernungseinheit geradewegs vom Gewinner weg und hält vor allem Festen, vor jedem Stehenden, am Rand des Bretts und an einer Ecke, die zu eng zum Hindurchzwängen ist. Die Bewegung ist erzwungen: Sie verbraucht nichts von seiner Bewegung, und niemand greift ihn dabei an. Ein Kampf ohne Brett bewegt niemanden.
    Verlieren bewirkt nichts; genau das ist ein misslungenes Packen.
- **`from: { "holding": "held" }`** richtet eine vergleichende Probe nur auf den, der dem Handelnden diesen Zustand auferlegt hat, und bringt sie nur ins Menü, solange er besteht: So drückt man Losreißen aus.
- **`reach`**, in deiner Entfernungseinheit, gibt an, wie weit sie reicht; ohne Angabe bis in die Nachbarzelle. `reach` und `push` brauchen `combat.distance`.
- **`strike: true`** lässt sie die Stelle eines Angriffs einnehmen, wenn eine Aktion mehrere kauft, so wie ein Angriff: Als Erstes gewählt verbraucht sie das Budget und lässt die übrigen Angriffe vorgemerkt; mit vorgemerkten Angriffen gewählt kostet sie einen davon. Die 5e-Referenz packt und stößt auf diese Weise.
- **Im Menü** hat eine vergleichende Probe eine eigene Gruppe und nennt ihre Gewinnchance. Ein von der Engine gespielter Gegner wägt sie wie alles andere ab, aber zurückhaltend: Packen oder Stoßen bereitet etwas vor, und Losreißen ist am meisten wert, jedoch nur, solange man festgehalten wird. Ein Game Master, der einen Gegner spielt, wählt sie aus demselben Menü.
- Bei einem vom Game Master erfundenen Gegner werden die Probenwerte auf seine Stufe begrenzt, wie seine Trefferchance.

Vergleichende Proben brauchen bei einem als Paket ausgelieferten Regelsatz Capability API 1.43.

<a id="windows-holding-the-fight-open"></a>

### Fenster: Den Kampf für eine Entscheidung anhalten

Manche Momente gehören einer anderen Person als der gerade handelnden. Die Engine hält den Kampf für sie an, statt für sie zu entscheiden. Diese Pause ist ein Fenster.

Sieben Situationen öffnen eines. Zwei davon ergeben sich aus deinen vorhandenen Deklarationen:

- **Jemand löst sich aus dem Nahkampf.** Verlässt eine Bewegung die Reichweite eines angreifenden Gegners, stoppt sie bei diesem Schritt und fragt ihn. Siehe oben "Angriffe auf Weggehende".
- **Zwischen zwei Zügen.** Endet ein Zug, wird vor dem nächsten jeder Gegner mit `signaturePoints` gefragt, der eine eigene `signature`-Aktion bezahlen kann. Nur in diesem Moment werden solche Aktionen gekauft. Sie erscheinen auf keinem Zugmenü, auch nicht dem eigenen.
- **Jemand nutzt etwas.** Vor der Auflösung wird jeder Beteiligte der ANDEREN Seite gefragt, der einen auf diesen Moment wartenden Eintrag besitzt, egal auf wen die Nutzung zielt, sofern dieser Eintrag den Nutzenden erreicht. Eine Standardaktion und eine vergleichende Probe öffnen keinen solchen Moment.
- **Etwas wird auf jemanden gerichtet.** Vor der Auflösung wird jeder anvisierte Beteiligte der ANDEREN Seite gefragt, der einen auf diesen Moment wartenden Eintrag besitzt. Heilung durch einen Freund ist keine zu beantwortende Bedrohung; eine befreundete Aktion öffnet daher kein Fenster.
- **Ein Angriffswurf trifft jemanden.** Vor dem Schaden wird der Getroffene gefragt, wenn er einen auf diesen Moment wartenden Eintrag besitzt. Was er einsetzt, zählt für diesen Angriff; siehe unten „Der Moment nach einem Treffer“.
- **Etwas hat jemanden verletzt.** Nach der Auflösung wird jeder Geschädigte gefragt, der einen auf DIESEN Moment wartenden Eintrag besitzt, unabhängig vom Verursacher. Verletzt zu sein betrifft dich selbst. Ein auf den Verursacher zurückgerichteter Eintrag darf trotzdem nicht auf einen Freund zielen.
- **Jemand fällt.** Vor dem Schaden und dem Liegen, für jeden, der eine Reaktion besitzt, die den Fallenden erreicht und dessen Seite zulässt (Capability API 1.124).

- **Jemand beginnt seinen Zug.** Bevor er handelt, für einen Eintrag, der ihn auf seiner Zielseite erreicht (Capability API 1.131).

Die letzten sechs Momente fordert ein Katalogeintrag oder eine eigene Aktion einer Kreatur an, indem er oder sie benennt, worauf gewartet wird. Öffnet eine Aktion sowohl `used` als auch `aimed`, wird zuerst zur Nutzung gefragt; bricht niemand sie ab, werden als Nächstes die Anvisierten gefragt, und aufgelöst wird sie, sobald beide Fragen beantwortet sind. Zum Getroffenwerden wird jedes Mal gefragt, wenn einer ihrer Würfe trifft, zum Verletztwerden erst, wenn die ganze Aktion vorbei ist.

Was ein Fenster unabhängig vom Auslöser tut:

- **Solange es offen ist, geschieht nichts anderes.** Weder handelt die Person am Zug weiter, noch endet ihr Zug, noch öffnet sich ein weiteres Fenster. Der Kampf wartet. Ein Sturz hält seine Landung zurück, bis der Aktionsschritt, der ihn verursacht hat, abgeschlossen ist; nach weiteren Stürzen wird danach gefragt.
- **Es fragt nacheinander** in Zugreihenfolge, jeden genau einmal. Passen ist immer möglich und kostenlos. Wer befragt würde, aber keine ausführbare Option hat, wird übersprungen.
- **Es setzt exakt am angehaltenen Punkt fort.** Eine Bewegung durchläuft die noch ausstehenden Zellen und bezahlt jede tatsächlich betretene.
- **Die steuernde Instanz antwortet.** Das Fenster deines Gruppenmitglieds gehört dir, mit der Option und **Pass** daneben im Menü. Für einen Gegner antwortet seine steuernde Instanz. Ein Boss des Game Master wird über den Game Master gefragt, mit Verstreichenlassen als möglicher Antwort.
- **Es wird mit dem Kampf gespeichert.** Nach dem Schließen mitten in einer Bewegung bleiben beim Fortsetzen dieselben Personen zu befragen und dieselben Zellen zu durchlaufen.

Für die ersten beiden Fenster deklarierst du nichts zusätzlich: Ein Regelsatz mit `opportunity.budget` erhält das eine, ein Bestiarium mit `signaturePoints` das andere. Ohne beide Angaben erscheinen sie nie.

**Den Moment benennen, auf den ein Eintrag wartet.** Schreibe `mechanics.reaction` als Objekt statt als `true`:

```json
"reaction": { "on": "aimed", "at": "source", "cancels": true }
```

- `on` ist `used`, `aimed`, `hit`, `harmed`, `falls` oder `turn-start` und bringt den Eintrag auf das Menü dieses Fensters. Nur diese sechs Momente beobachtet die Engine. Ein Eintrag mit bloßem `"reaction": true` sagt nur, dass er nicht während eines Zuges gewählt wird. Das reicht für kein Angebot; er bleibt in keinem Menü.
- `at` ist `source` (Standard), `target` oder `chosen`. `source` richtet die Aktion auf den Verursacher des Moments und setzt das Ziel selbst, ohne Auswahlfrage. `chosen` behält die eigenen Ziele des Eintrags bei und fragt nach. `target` richtet sich auf die Kreatur, um die es in dem Moment geht. Eine Antwort auf `falls` wirkt auf die gewählten Fallenden.
- `cancels` verhindert vollständig, was das Fenster angehalten hat. Nur ein `used`- oder `aimed`-Eintrag darf es angeben: Ein bereits eingetretener Moment lässt sich nicht absagen, und ein Treffer ist bereits gewürfelt.
- `against` beschränkt, worauf der Eintrag antwortet, auf Dinge, die aus bestimmten Katalogen genutzt werden: `"against": { "catalogs": ["spells"] }` antwortet auf einen Zauber und auf nichts anderes. Eine Aktion ohne Eintrag dahinter (eine Waffe auf einer Liste, die eigene Aktion einer Kreatur) stammt aus keinem Katalog und öffnet den Moment daher nie für einen Eintrag, der Kataloge nennt. Lässt du `against` weg, antwortet der Eintrag auf alles.

Gib auch ein `budget` an, sonst wird das Standardbudget der Liste verbraucht. Eine Reaktion verwendet fast immer ein eigenes Budget. Das verhindert mehrere davon in einem Zug.

**Die Kosten werden vor der ersten Nachfrage bezahlt.** Eine abgebrochene Aktion wird an ihrer Wirkung gehindert, nicht am Kauf: Budget und Pool-Ressourcen sind bereits verbraucht. Falls dein System sie erstattet, lässt sich das noch nicht ausdrücken.

Ein Konter wird so geschrieben und antwortet auf einem Brett nur jemandem innerhalb seiner eigenen `range`:

```json
"mechanics": {
  "kind": "utility",
  "range": 8,
  "free": true,
  "cost": [{ "pool": "luck", "amount": 1 }],
  "reaction": { "on": "used", "cancels": true, "against": { "catalogs": ["knacks"] } }
}
```

**Ein Konter, der nur so hoch reicht** (Capability API 1.116). `"upTo": "paid"` an einer `used`-Reaktion, die abbricht, stoppt nur, was nicht höher bezahlt wurde als die Antwort selbst, und `"above": { "check": <value>, "dc": 10 }` ist die Probe, die etwas Höheres trotzdem stoppt, gegen `dc` plus dessen Stufe. Counterspell in 5e stoppt einen Zauber der Stufe seines Zauberplatzes oder niedriger, verlangt darüber eine Probe mit dem Zauberwirkungsattribut gegen 10 + die Stufe des Zaubers und kann wie jeder Zauber höher gewirkt werden:

```json
"reaction": {
  "on": "used",
  "cancels": true,
  "against": { "catalogs": ["spells"] },
  "upTo": "paid",
  "above": { "check": { "abilityModFromField": "spellcasting_ability" }, "dc": 10 }
}
```

Die Stufe von allem Bezahlten ist die Stufe des Pools, aus dem es stammt: das eigene `level` eines Pools, ein vom Bogen seines Besitzers gelesener Wert, wenn er einen nennt (die Paktplätze in 5e, gewirkt auf der Platzstufe des Hexenmeisters), und sonst sein Platz in seiner Gruppe, wobei der erste Pool 1 ist. Was nichts gekostet hat oder aus einem Pool ohne Gruppe stammt, hat Stufe 0; jeder solche Konter stoppt es also. Die Probe verwendet die eigenen Würfel des Kampfes mit den Zuständen des Antwortenden, die auf Proben wirken; ein `dice-pool`-Kampf hat keine Schwierigkeit zu erreichen und lehnt `above` ab. Eine Kreatur ohne Bogen schreibt ihre Probe als `{ "const": n }`. Das Protokoll nennt die Stufe und den Wurf, wann immer die Antwort über sich selbst hinausreicht, und die übliche Zeile folgt, wenn sie stoppt. Ohne `above` wird etwas Höheres einfach nicht gestoppt, und was die Antwort gekostet hat, bleibt verbraucht.

**Der Moment nach einem Treffer.** Mit einem Eintrag für `hit` drückt man Shield, eine Parade und Uncanny Dodge aus. Der Angriff wird nach seinem Wurf angehalten, und der Getroffene wird gefragt, bevor Schaden verursacht wird. Was er einsetzt, zählt für diesen Angriff: Sein Wurf wird nicht wiederholt, aber erneut geprüft, und zwar gegen die Verteidigung des Getroffenen, wie sie jetzt steht. Ein Zustand, der zur Verteidigung addiert, kann den Treffer also in einen Fehlschlag verwandeln, und eine besondere Augenzahl, die immer trifft, trifft weiterhin. Ein Zustand, der einen Angriff lang hält (`endsAfter: "attacked"`) und als Antwort auferlegt wird, deckt diesen Angriff samt seinem Schaden ab und wird durch ihn verbraucht. So drückt man „halbiere den Schaden dieses Angriffs“ aus: `resist-all` für einen Angriff.

```json
"mechanics": {
  "kind": "buff",
  "targets": "self",
  "budget": "reaction",
  "reaction": { "on": "hit" },
  "applies": [{ "condition": "shielded", "duration": { "rounds": 1, "at": "turn-start" } }]
}
```

Der Angriff setzt genau dort fort, wo er angehalten wurde: mit seinen übrigen Zielen und, bei einer aus anderen Aktionen zusammengesetzten Aktion einer Kreatur, mit ihren übrigen Teilen. Jeder Wurf, der jemanden mit einer solchen Antwort trifft, wird an seiner Stelle angehalten, und ein Kampf, der bei offenem Fenster gespeichert wird, kommt genauso zurück. Ein innerhalb eines Fensters ausgeführter Angriff (ein Angriff auf jemanden, der sich entfernt, eine Signaturaktion, eine Antwort) wird nie angehalten, weil nichts, was innerhalb eines Fensters geöffnet wird, ein weiteres öffnet. Das Protokoll zeigt beim Öffnen des Fensters den Wurf und wogegen er gewürfelt wurde und, wenn die Antwort die Verteidigung verändert hat, ob er jetzt verfehlt. Von der Engine gespielte Gegner setzen eine Abwehr nur ein, wenn sie den Treffer in einen Fehlschlag verwandelt.

Ein Paket, das einen solchen Moment nennt, braucht Capability API 1.33, eines mit `used` oder `against` braucht 1.44 und eines, das auf `hit` wartet, 1.46.

**Einen Zauber beim Namen beantworten** (Capability API 1.117). `against` kann neben `catalogs` auch `entries` als `<catalog>/<entry>` nennen, und eine Übereinstimmung mit einem von beiden öffnet den Moment. `also` nimmt dieselbe Antwort bei bis zu drei weiteren Momenten an, jeder mit eigenem `against`. Das `noDamageFrom` eines Zustands hält den Schaden dieser Einträge vollständig von seinem Betroffenen fern, solange er besteht, egal welcher Art der Schaden ist. Shield in 5e wird genommen, wenn ein Angriff trifft und wenn Magic Missile auf seinen Wirkenden gerichtet wird, und darunter bewirkt Magic Missile nichts:

```json
"reaction": {
  "on": "hit",
  "also": [{ "on": "aimed", "against": { "entries": ["spells/magic-missile"] } }]
}
```

```json
{
  "condition": "shielded",
  "modifiers": [{ "to": "defense", "flat": 5 }],
  "noDamageFrom": ["spells/magic-missile"]
}
```

Nur der erste Moment darf abbrechen; eine Reaktion, die abbricht, hat also kein `also`. Der Katalog, den ein Eintrag nennt, muss einer sein, den der Regelsatz hat. Ein Eintrag, der nicht darin steht, öffnet den Moment einfach nie. Ein so ferngehaltener Schlag erscheint im Protokoll als einer, gegen den das Ziel immun ist.

**Nur auf manche Schläge antworten** (Capability API 1.118). Ein `hit`-Moment kann `"blow": "melee"` oder `"blow": "ranged"` angeben. Ein Schlag ist Nahkampf, solange sein Ziel in der Reichweite der Waffe steht; ein aus der Ferne geworfener Dolch ist also Fernkampf und derselbe Dolch neben seinem Ziel Nahkampf. Eine Waffe mit Nahkampfreichweite und ohne Fernkampfreichweite ist immer Nahkampf, eine mit Fernkampfreichweite und ohne Nahkampfreichweite immer Fernkampf. In einem Kampf ohne Brett gilt eine Waffe mit Nahkampfreichweite als in der Hand geschwungen. `"seesSource": true` öffnet jeden Moment außer `falls` nur, solange sein Besitzer den Verursacher sieht. Das bedeutet eine Sichtlinie zwischen ihnen auf dem Brett (ohne Brett sieht jeder jeden) und nie jemanden, der die Standardaktion Hide genommen hat, bis diese zu Beginn seines nächsten Zuges endet. Parry in 5e ist beides:

```json
"reaction": { "on": "hit", "blow": "melee", "seesSource": true }
```

Beide Schlüssel dürfen auch an einem Moment in `also` stehen, `blow` jedoch nur an einem `hit`-Moment.

**Einen Sturz auffangen** (Capability API 1.124). Eine Reaktion auf `falls`, auch in `also`, antwortet auf eine Kreatur, die von einem Absatz fällt, oder auf einen Flieger, der zu Boden gezwungen wird, bevor der Sturz Schaden verursacht oder sie liegen lässt. Ihre Reichweite und Zielseite werden gegen den Fallenden geprüft, und ihre Antwort wirkt auf diese Kreatur. Für Feather Fall gibst du dem Eintrag diese Mechanik und deklarierst `feather_falling` in den laufenden Zuständen des Bogens:

```json
{
  "kind": "buff",
  "targets": "ally",
  "range": 60,
  "budget": "reaction",
  "cost": [{ "pool": "slots_1", "amount": 1 }],
  "reaction": { "on": "falls" },
  "applies": [{ "condition": "feather_falling", "duration": { "rounds": 10 } }]
}
```

Sein Eintrag in `combat.conditions` ist `{ "condition": "feather_falling", "fallsSafely": true }`. Solange dieser Zustand besteht, verhindert er Sturzschaden und das Liegen, das ein Sturz auferlegen würde; er entfernt keinen Zustand, der den Sturz verursacht hat. Verwende `targets: "self"` für eine Antwort nur auf den eigenen Sturz des Wirkenden. Ein Sturz hat keinen Quelleintrag; seine Reaktion kann also kein `cancels`, `blow`, `seesSource` oder `against` tragen. Ein Eintrag mit einem einzigen Ziel fragt bei jedem Sturz einzeln. Das löst die Landung auf; einen verlangsamten Abstieg verfolgt es nicht.

**Für eine andere Kreatur antworten** (Capability API 1.131). `for` ist standardmäßig `self`; `ally` schließt den Besitzer aus, `any` schließt ihn ein. Beide fragen Besitzer auf der Seite des Ziels innerhalb des verlangten `within`, in der Entfernungseinheit des Katalogs, und nur bei `aimed` oder `hit`. Diese Schlüssel funktionieren auch an jedem `also`-Moment. `seesSource` verlangt weiterhin Sicht auf den Angreifer. Protection legt der Quelle `own-attacks-disadvantage` auf, bevor die Angriffswürfel geworfen werden. Seine Dauer `this-action` endet, wenn die Aktion aufgelöst oder abgebrochen wird. Ohne ausdrückliche Reichweite zur Quelle erreicht die Antwort eines Umstehenden diese Quelle; `within` misst die Entfernung zur geschützten Kreatur. Deklariere `protected_attack` auf dem Bogen und gib seinem Kampfzustand diese Wirkung:

```json
{
  "kind": "debuff",
  "targets": "enemy",
  "budget": "reaction",
  "reaction": { "on": "aimed", "for": "ally", "within": 5, "at": "source", "seesSource": true },
  "applies": [{ "condition": "protected_attack", "duration": "this-action" }]
}
```

**Die Antwort auf das Ziel legen.** `at: "target"` wirkt auf die angegriffene Kreatur, während `source` der Angreifer bleibt. Shield Guardian bildet den Träger des Amuletts als Verbündeten innerhalb von 5 ab; `parrying` gewährt `+2` Verteidigung. Der angehaltene Treffer prüft nach der Antwort die Verteidigung dieses Verbündeten erneut:

```json
{
  "kind": "buff",
  "targets": "ally",
  "range": 5,
  "budget": "reaction",
  "reaction": { "on": "hit", "for": "ally", "within": 5, "at": "target" },
  "applies": [{ "condition": "parrying", "duration": "this-action" }]
}
```

**Zu Beginn eines Zuges.** `on: "turn-start"` fragt, wenn eine Kreatur auf der Zielseite des Eintrags innerhalb seiner Reichweite ihren Zug beginnt, bevor sie handelt. Diese Kreatur ist die `source`. Ein schädlicher Eintrag antwortet der anderen Seite, ein hilfreicher Eintrag seiner eigenen. Er kann kein `cancels`, `blow`, `against` oder `upTo` tragen. Die Kreaturenaktion Unnerving Mask verlangt einen Wisdom-Rettungswurf; eine Runde auf der Uhr der betroffenen Kreatur hält durch diesen Zug und läuft an seinem Ende ab (lass `of: "source"` weg):

```json
{
  "id": "unnerving_mask",
  "name": "Unnerving Mask",
  "range": 30,
  "budget": "reaction",
  "reaction": { "on": "turn-start", "at": "source", "seesSource": true },
  "save": { "save": "wis_save", "difficulty": 14, "onSuccess": "negates" },
  "applies": [{ "condition": "frightened", "duration": { "rounds": 1 } }]
}
```

**Bei einem Rettungswurf abbrechen.** `cancelSave: { save, dc }` braucht `cancels`; der Besitzer würfelt mit seinen üblichen Rettungswurfmodifikatoren. Ein Erfolg bricht ab, ein Fehlschlag lässt die ursprüngliche Aktion aufgelöst werden, und in beiden Fällen ist die Reaktion verbraucht. `against.actions` nennt eine bis zwölf Werteblockaktionen und gleicht den ganzen Namen ohne Beachtung der Groß- und Kleinschreibung ab (höchstens 80 Zeichen je Name). Rock Catching bildet das Fangen des Felsens ab, indem es den ganzen Angriff einschließlich seines gesamten Schadens abbricht, statt nur seinen Wuchtschaden. Rettungswurf-IDs sind die deines Regelsatzes (`dex` hier; `dex_save` im mitgelieferten 5e-Beispiel):

```json
{
  "on": "aimed",
  "cancels": true,
  "cancelSave": { "save": "dex", "dc": 10 },
  "against": { "actions": ["Rock"] }
}
```

**Mehrere Fallende auffangen.** Ein `falls`-Eintrag mit einem `targetCount` größer als eins bietet die berechtigten Kreaturen an, die durch einen Schlag oder eine Wirkung fallen, innerhalb der Reichweite und auf seiner Zielseite. Menü und Kampfsteuerung wählen standardmäßig alle Berechtigten bis zur Anzahl, die nächsten zuerst; der Spieler kann die Auswahl ändern. Ein späterer Sturz ist ein eigenes Ereignis. Feather Fall verwendet denselben `fallsSafely`-Zustand wie oben:

```json
{
  "kind": "buff",
  "targets": "ally",
  "targetCount": 5,
  "range": 60,
  "budget": "reaction",
  "reaction": { "on": "falls" },
  "applies": [{ "condition": "feather_falling", "duration": { "rounds": 10 } }]
}
```

### Noch nicht umgesetzt

Die Grenzen werden ausdrücklich genannt, damit ein Regelsatz nichts behauptet, was die Engine nicht tut:

- **Jenseits des einfachen Bretts**: kein Überfliegen von Hindernissen, kein Hindurchzwängen und keine Reittiere. Eine Kreatur wird nur durch ihren eigenen Gang, eine Teleportation und das bewegt, was sie stößt (eine vergleichende Probe, ein Eintrag, die Aktion einer Kreatur oder eine Zone). Niemand zieht eine Kreatur mit sich, die er festhält.
- **Eine vergleichende Probe ist einfach gehalten.** Ihr Wurf öffnet kein Fenster, aber auf einen Sturz, den sie verursacht, darf geantwortet werden.
- **Ein Eintrag kann nur auf sechs Momente warten**, `used`, `aimed`, `hit`, `harmed`, `falls` und `turn-start`; siehe Fenster oben. Diese Momente beobachtet die Engine für einen Eintrag. Die beiden anderen Fenster – Weggehen und die Pause zwischen Zügen – öffnet der Kampf selbst; Einträge können sie nicht anfordern. Es gibt keinen Moment für einen Rettungswurf oder einen Tod.
- **Keine Verkettung.** Der Kampf hält ein einzelnes Fenster statt eines Stapels. Innerhalb eines Fensters öffnet deshalb nichts ein weiteres: Ein Konter kann nicht selbst gekontert werden, der Schaden einer Reaktion löst keinen weiteren Moment aus, und ein innerhalb eines Fensters ausgeführter Angriff wird bei einem Treffer nicht angehalten. Ein beantwortbarer Sturz, der während eines Fensters verursacht wird, wird zurückgehalten, bis es sich schließt, und dann der Reihe nach erfragt.
- **Nur ein Angriffswurf ist ein Treffer.** Was ohne Angriffswurf trifft (Geschosse, die einfach treffen, eine Fläche, gegen die alle einen Rettungswurf ablegen), öffnet keinen `hit`-Moment.
- **Schadensmodifikatoren gehören zu Angriffstreffern.** Eine Antwort kann ihrem Besitzer einen Schadensmodifikator geben oder eingehenden Schaden mit `resist-all` halbieren; Schadensmodifikatoren verändern nie eine Wirkung, die nur auf einem Rettungswurf beruht.
- **Es gibt keine Erstattung.** Die Kosten einer abgebrochenen Aktion bleiben verbraucht.
- **Was ein Zustand verändert, ist eine geschlossene Liste.** Verteidigung, Angriffswürfe, Rettungswürfe, Proben in vergleichenden Proben, Geschwindigkeit, Gesundheitsmaximum sowie verursachter und erlittener Schaden (auch bei Stufen und Gegenstandswirkungen). Schadensmodifikatoren verändern nur Angriffstreffer; sie addieren nie etwas zu Schaden aus Rettungswürfen oder zu automatischen Treffern.
- **Eine mit direkten Zahlen geschriebene Kreatur hat keine Wundleiste.** Verwendet der Regelsatz Gesundheit als Leiste, verliert eine solche Kreatur weiterhin Punkte. Mit einem `sheet` markieren Treffer dagegen Kästchen, nachdem ihre eigenen `resist`, `vulnerable` und `immune` angewendet wurden.
- **Ein Zusatzeffekt löst selbstständig aus.** `on` hat nur den Wert `hit`. Daher verbraucht der erste passende Treffer des Zeitraums den Effekt. Es gibt keinen Moment, in dem du nach seiner Nutzung gefragt wirst.
- **Eine Zahl, die Angriffe verschieben, ist einfach gehalten.** Ein Schlag im ausgebenden Stil wirft die Zahl und sonst nichts; keine Waffe verändert sie, auch nicht ihr `floor` (ein robustes Ziel absorbiert einen Schlag im nehmenden Stil, und seine Härte stoppt einen im ausgebenden Stil, doch sonst verkleinert nichts den einen oder den anderen). Ein Zusammenbruch endet nach einer festen Zahl von Zügen, egal wie tief er war, und ein in einem Fenster ausgeführter Angriff (ein Angriff auf jemanden, der sich losreißt, eine Reaktion, eine Signaturaktion) erfolgt im ersten Stil.
- **Ein erfundener Gegner absorbiert nichts und hat keine Härte.** Eine Kreatur, die der Game Master für einen Kampf erfindet, wird auf deine Bedrohungsskala begrenzt, und diese sagt nichts über Schadensminderung oder Härte aus; die Kreatur hat daher keines von beidem.

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
- `currencies` nimmt Münzen heraus: `removeUnits` nennt einzelne Münzen und `removeFamilies` ganze Familien. Die kleinste Münze einer Familie fällt nur mit ihrer ganzen Familie weg, damit jede verbleibende Familie weiterhin bezahlen und Wechselgeld geben kann. Solange die Ebene aktiv ist, verdient, bezahlt, wählt oder erbeutet niemand eine herausgenommene Münze, und die Geldzeile lässt sie weg. Ein Preis, der in einer solchen Münze angegeben ist, wird zum selben Wert in der größten verbleibenden Münze genannt, die ihn genau bezahlt: Die Ebene „The long night“ in Gravewatch nimmt die crown heraus, und eine Wachpistole für 3 crowns kostet dann 15 shillings. Ein Gegenstand, dessen ganze Familie fehlt, hat keinen Preis.

**Was eine Ebene nicht kann.** Sie kann weder Enum-Werte, Felder, Fertigkeiten, Pools oder Rasten hinzufügen noch die Auflösungsart ändern, laufenden Zustand oder Kampfzahlen verändern oder einen Modellaufruf ergänzen. Ein von einer Ebene _hinzugefügter_ Wert wäre allen anderen Lesern des Bogens unbekannt. Deshalb können Werte nur entfallen. Alles außerhalb dieser Liste ist eine Änderung des Regelsatzes selbst oder ein zweiter Regelsatz.

**Konflikte.** `conflicts` nennt Ebenen, die nicht gleichzeitig aktiv sein dürfen. Die Angabe auf einer Seite des Paares reicht. Der Assistent deaktiviert den anderen Schalter. Enthält eine gespeicherte Auswahl dennoch beide, entfällt die **später** deklarierte. Dieselben zwei Auswahlen ergeben dadurch immer dieselben Regeln.

**Ein Bogen mit einem entfernten Wert behält ihn.** Kein Charakter wird umgeschrieben. Der Editor bietet den Wert lediglich nicht mehr an; bei einem Charakter, der ihn schon hatte, zeigt er ihn weiterhin an. Wird die Ebene in einem neuen Spiel ausgeschaltet, steht der Wert wieder zur Auswahl. Dasselbe gilt für einen ausgeblendeten Katalogeintrag: Er fehlt in der Auswahl, doch bereits ausgewählte Zeilen bleiben auf dem Bogen. Münzen, die eine Ebene herausnimmt und die jemand bereits mitführt, bleiben in seiner Tasche.

**Grenzen.** 12 Ebenen pro Regelsatz und 4000 Zeichen Anleitungstext je Ebene, beide Zeichenfolgen zusammengezählt. Ein als Paket ausgelieferter Regelsatz mit `layers` oder einem grundlegenden `gm.worldGuidance` braucht Capability API 1.25, und einer, dessen Ebenen Münzen herausnehmen, braucht 1.64. Ein importierter Regelsatz wird von der lesenden Engine geprüft und braucht keine solche Angabe.

**Von anderen geschriebene Ebenen**, etwa eine separat ausgelieferte Ebene für seltene Magie zu einem fremden Regelsatz, sind für später vorgesehen. Derzeit wird eine Ebene im zugehörigen Regelsatz ausgeliefert.

<a id="trying-your-ruleset"></a>

## Deinen Regelsatz ausprobieren

Community-Regelsätze verwenden denselben Schalter wie importierte Agenten. Öffne **Settings** > **Advanced** > **Danger Zone** (Einstellungen > Erweitert > Gefahrenbereich) und aktiviere **Allow custom Agent imports** (eigene Agentenimporte erlauben). Der Import braucht außerdem Zugriff über localhost oder eingerichteten **Admin Access** (Administratorzugriff).

1. Öffne das Panel **Agents** und wähle **Import agents** (Agenten importieren), das Download-Symbol in der oberen Schaltflächenreihe.
2. Wähle **Game Mode ruleset** (Regelsatz für Game Mode) und deine JSON-Datei oder eine Regelsatz-Paketdatei mit der Endung `.ruleset.json` (siehe [Deinen Regelsatz teilen](#sharing-your-ruleset)).
3. Lies die Prüfung. Sie zeigt Name, Version, Lizenz, Umfang des Regelsatzes und den Text für den Game Master. Wähle **Import** (importieren).

Dein Regelsatz erscheint im Bereich **Rules** des Panels und in der Auswahl **Rules** des Assistenten für neue Spiele. Ein aus einer Datei importierter Regelsatz wird als `local/<your id>` abgelegt. Er kann dadurch nie mit einem offiziellen oder fremden Regelsatz verwechselt werden.

### Einen bereits importierten Regelsatz ändern

Eine importierte Version wird niemals überschrieben. Änderst du die Datei und importierst sie mit derselben `version` erneut, wird der Import abgelehnt und fordert eine höhere Nummer. Das ist beabsichtigt: Ein Spiel ist an genau die Version gebunden, mit der es erstellt wurde. Eine laufende Kampagne wacht deshalb nie mit anderer Mathematik auf.

Beim Entwerfen lautet die Folge daher: bearbeiten, `version` erhöhen, importieren, neues Spiel beginnen. Alte Versionen bleiben neben der neuen installiert, bis du den Regelsatz aus dem Bereich **Rules** entfernst. Verwendet ein Spiel einen entfernten Regelsatz noch, meldet es ihn als fehlend, bis du ihn erneut importierst.

Änderst du die Form des Bogens durch Hinzufügen, Entfernen oder Umbenennen von Einträgen, erhöhe auch `sheet.version`. Vorhandene Bögen werden tolerant gelesen: Dem neuen Bogen unbekannte Werte bleiben erhalten, fehlende Werte verwenden ihre Standards.

### Werte auf neue IDs verschieben: `sheet.migrations`

Hinzufügen braucht nichts weiter. Verschiebt eine neue Form des Bogens einen Wert an eine andere Stelle (ein umbenanntes Feld, eine Stufe, die zu einer Stufe pro Klasse wird, ein Pool von Trefferwürfeln, der zu einem Pool pro Würfeltyp wird), gib in `sheet.migrations` (Capability API 1.77) an, wie; so behält jeder Charakter, der auf der alten Form erstellt wurde, seine Zahlen: in der Bibliothek, in Spielen, in alten Spielständen, Verzweigungen und Checkpoints und in importierten Karten.

```json
"migrations": [
  {
    "from": 3,
    "steps": [
      { "rename": "field", "from": "xp", "to": "experience" },
      {
        "route": "level",
        "by": "class",
        "cases": [
          { "words": ["fighter"], "to": "level_fighter" },
          { "words": ["wizard"], "to": "level_wizard" }
        ],
        "else": "level_other",
        "default": 1
      },
      {
        "routeLive": "pool",
        "from": "hit_dice",
        "cases": ["hit_dice_d6", "hit_dice_d8", "hit_dice_d10", "hit_dice_d12"],
        "else": "hit_dice_d8"
      }
    ]
  }
]
```

- Jeder Eintrag bringt einen gespeicherten Bogen von Version `from` auf `from + 1` und läuft der Reihe nach für jeden Bogen, der in dieser oder einer älteren Version gespeichert ist. Entferne nie einen, sobald er ausgeliefert ist: Ein vor langer Zeit gespeicherter Bogen braucht ihn noch. Eine Version, die nur hinzufügt, braucht keinen.
- `rename` (ein `ability`, `skill`, `save` oder `field`): Der Wert wird auf seine neue ID kopiert. Eine Fertigkeit oder ein Rettungswurf nimmt ihren Bonus mit. Eine Umbenennung darf eine aus einem früheren Eintrag fortsetzen oder ein Feld speisen, das ein späteres `route` weiterleitet; der Import folgt der Kette bis zu ihrem Ende.
- `route`: Der Wert eines Felds geht in das Feld, das der Text eines anderen Felds nennt. Ein Fall gewinnt, wenn seine Wörter als ganze Wörter im Text von `by` vorkommen (nur Buchstaben bilden ein Wort, „Fighter3“ nennt also einen Fighter), ohne Beachtung der Groß- und Kleinschreibung, und genau ein Fall das tut. Trifft keiner oder treffen mehrere zu („Fighter 3 / Wizard 2“, wo sich eine Zahl nicht ohne Nachfrage aufteilen lässt), geht der Wert an `else`. `default` steht für einen Bogen, der den Wert nie gespeichert hat. `by` ist ein Feld, das der Bogen hat, oder eines, das eine frühere Form umbenannt hat. Die Ziele sind Zahlen- oder Textfelder ohne Standardwert oder mit einem Standardwert von 0 oder leer: Der Wert landet in einem davon, und jedes andere behält seinen Standardwert; jeder andere Standardwert würde sich also wie eine Stufe lesen, die niemand vergeben hat. Einem Ziel, das eine spätere Umbenennung weiterverschiebt, wird dorthin gefolgt.
- `routeLive` (ein `pool` oder `track` des Live-Zustands): Der gespeicherte Wert geht an den Fall aus `cases`, den der migrierte Bogen zeigt (einen Pool mit einem Maximum über 0, eine Leiste, die der Bogen nicht ausblendet), sonst an `else`. Die Leisten, an die ein Wert geht, sind alle Wundleisten (er trägt die Markierungen) oder alle einfache Leisten (er trägt die Zahl).
- Jeder Schritt für den Aufbau des Bogens kopiert: Der alte Wert bleibt, wo er war, damit eine ältere Version deines Regelsatzes den Bogen weiterhin so liest wie zuvor. Ein Schritt überschreibt nie einen Wert, der bereits in seinem Ziel steht.
- Der Import lehnt ab: einen Eintrag auf oder über `sheet.version`, zwei Einträge aus derselben Version, einen Schritt, der in eine ID schreibt, die der Bogen nicht hat, einen doppelt aufgeführten Fall sowie ein `rename` oder `routeLive`, das aus einer ID liest, die der Bogen noch hat (eine verschobene ID wird nie wieder verwendet; das macht diese Schritte sicher für eine Wiederholung).
- Bögen werden bei jedem Lesen migriert, und die neue Form wird bei der nächsten Bearbeitung gespeichert. Der Live-Zustand hat keine eigene Version; `routeLive` läuft also bei jedem Lesen: Der alte Schlüssel wird verworfen, und sein Wert wird nur verschoben, solange der neue Schlüssel noch nicht vorhanden ist; ein seitdem ausgegebener oder bei einer Rast zurückgesetzter Wert wird also nie überschrieben. Wohin er ging, legt der erste Schreibvorgang nach dem Update fest: Ein später korrigierter Bogen (eine von Hand verschobene Klassenstufe) verschiebt ihn nicht erneut. Ein Kampf, der beim Eintreffen der neuen Version bereits läuft, endet wie bisher.

<a id="sharing-your-ruleset"></a>

## Deinen Regelsatz teilen

**Als Datei.** Schick die JSON-Datei an einen Freund. Er importiert sie genauso wie du.

**Als Paketdatei.** Ein Regelsatz, der für eine einzelne Datei zu groß ist und Kataloge in eigenen Dateien hat, reist als eine einfache JSON-Datei namens `<name>.ruleset.json`. Sie enthält das Paketmanifest und die Dokumente des Regelsatzes, jedes als seine genauen Bytes in Base64:

```json
{
  "format": "marinara-ruleset",
  "version": 1,
  "manifest": { "kind": ["ruleset"], "…": "the package manifest" },
  "files": {
    "ruleset.json": "<base64>",
    "catalogs/spells.json": "<base64>"
  }
}
```

Das Manifest führt `ruleset.json` und jedes `catalogs/<id>.json` in `contributions.assets.paths` und in `files` auf, jeweils mit Größe und sha256. Ein Regelsatz-Editor wie Pixelforge erstellt eine solche Datei. **Import agents** → **Game Mode ruleset** nimmt die Datei an und zeigt dieselbe Prüfung wie für eine Regelsatzdatei, mit jedem Katalog und der Zahl seiner Einträge. Nichts darin ist komprimiert; sie enthält also nie mehr als ihre eigene Größe. Sie wird als Daten gelesen und nie als Paket installiert: Sie wird mit Begründung abgelehnt, wenn sie etwas anderes enthält (einen anderen Schlüssel, eine andere Datei, ein Dokument, das nicht striktes Base64 oder kein UTF-8-Text ist), wenn ihr Manifest mehr als das eines Regelsatzes ist (Code, Berechtigungen oder andere Beiträge), wenn eine Datei nicht die ist, die das Manifest aufführt, wenn ein `$comment` länger als 2.000 Zeichen ist oder `$schema` etwas anderes als das eigene Schema der Engine nennt oder wenn sich der Regelsatz oder ein Katalog nicht lesen lässt. Sie wird wie eine Regelsatzdatei als `local/<its id>` abgelegt, ist höchstens 24 MB groß und hat höchstens 12 Katalogdateien zu je 2 MB. Eine Version umfasst ihren Regelsatz und ihre Kataloge zusammen; ein geänderter Katalog braucht also ebenfalls eine höhere `version`. Regelsatzpakete werden nicht als ZIP-Dateien angenommen.

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
