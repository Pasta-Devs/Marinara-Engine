# Proben im Regelsatz

Diese Seite gehört zu [Regelsätze für Game Mode schreiben](writing-rulesets.md). Wie ein Regelsatz eine Probe oder einen Rettungswurf würfelt: die fünf Auflösungsarten, Ergebnisbereiche, Proben, die auf ihre eigene Art würfeln, und Ressourcenausgaben oder Talismane, die einen Wurf verändern.

<a id="resolution-kinds"></a>

## Auflösungsarten

`resolution.kind` wählt, wie eine Probe gewürfelt wird. Alle Arten lesen denselben Charakterbogen und teilen drei Schlüssel. Die Bestandteile unterhalb von `resolution` ändern sich beim Wechsel deshalb nicht:

- `abilityModifier`: Wie ein Bogenwert zu einer Zahl wird. Bei `identity` ist der Wert selbst die Zahl. `floorHalfMinusTen` ist die 5e-Regel. Mit `stepTable` kannst du eigene Schwellen als `[[score, number], ...]` auflisten.
- `proficiencyTiers`: Die Ausbildungsstufen einer Fertigkeit oder eines Rettungswurfs. Eine nicht eingetragene Fertigkeit bekommt die erste Stufe. Eine Stufe addiert `flat`, das `multiplier`-Fache eines Übungsbonus oder beides. Wenn dein System einen Übungsbonus hat, gib seine Herkunft mit `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }` an.
- `proficiency`: Optional und nur für eine multiplizierende Stufe nötig.

Was die berechnete Zahl bedeutet, bestimmt die Auflösungsart: `dice-sum` addiert sie zum Wurf, `dice-pool` und `dice-highest` werfen entsprechend viele Würfel. `symbol-pool` hält Attribut und Ausbildung getrennt, um Erzählwürfel zusammenzustellen und aufzuwerten.

### `dice-sum`: Würfel addieren

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

### `dice-pool`: Würfel werfen und zählen

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

### Was der Game Master bei einer Pool-Probe schreiben darf

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

### `dice-highest`: Würfel werfen und den höchsten ablesen

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

### `roll-against`: Höchstens (oder mindestens) die Zahl vom Bogen würfeln

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

### `symbol-pool`: Erzählwürfel werfen und die Symbole ablesen

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
- `outcomes` können die Zahl der Netto-Erfolge (`total`) oder `net successes - needed + 1` (`margin`) lesen. Ergebnisbereiche entscheiden weiterhin auf ihre übliche Weise über den Erfolg; die ursprünglichen kritischen Symbole bleiben markiert. `spend` kauft nur zusätzliche Grundwürfel des Charakters innerhalb von `pool.max`. Seine Kämpfe sind `symbol-pool`-Kämpfe (Capability API 1.382, siehe [Ein Kampf mit Symbolwürfeln](ruleset-combat.md#a-fight-thrown-in-symbol-dice-symbol-pool)); jede andere Kampfart wird daneben abgelehnt.
- Außerhalb einer Probe kann ein Spiel mit diesem Regelsatz seine Würfel nach Namen werfen: Das Feld für eigene Würfe im Eingabebereich und das Tool `roll_dice` des Game Masters lesen `2 ability 1 proficiency vs 2 difficulty` (`id` oder `label` jedes Würfels, unabhängig von Groß- und Kleinschreibung) und zählen und verrechnen Symbole wie bei einer Probe, ohne Bogen, Aufwertungen oder Schwierigkeitsleiter. Dafür muss kein Schlüssel gesetzt werden.
- Der Datensatz behält `resolution="sum"`, mit `symbols="2s 1a 1t"`, mit `thrown=`, das jeden Würfel benennt, und mit `rolls=`, das seine Seite ab 1 gezählt enthält. Kodierte `symbolDetails` bewahren Beschriftungen, Seitensymbole und beide kritischen Markierungen. `setback` hält die unabhängigen Komplikationswürfel fest, die nach der gemeinsamen Komplikationsgrenze tatsächlich hinzugefügt wurden, und `upgradeOwn` die zusätzlichen Aufwertungen, die tatsächlich angewendet wurden; ignorierte oder nullwertige Zusätze werden weggelassen. Karte und Zusammenfassung nennen die Netto-Symbole, auch ein leeres Ergebnis, statt Seitenzahlen zu addieren. Überschreibungen können die Regeln dieser Art ändern, aber `symbols` oder `dice` nicht ersetzen.

### Was nicht abgedeckt ist und warum

Diese Mechaniken brauchen weiterhin eine eigene Auflösungsart:

- **Vergleichende Pools** lösen zwei Charaktere gleichzeitig auf; eine Probe hat nur einen würfelnden Charakter.
- **Summenpools mit einem besonderen Würfel**, wie in OpenD6, addieren die Würfel und behandeln einen davon gesondert.

Die beiden früher fehlenden Möglichkeiten dieser Auflösungsart sind inzwischen modelliert. Der folgende Abschnitt zum Ausgeben von Ressourcen erklärt sie. Eine allgemeine Systemregel wie „einen Punkt für einen Erfolg ausgeben“ oder „einen Punkt ausgeben, um die Fehlschläge erneut zu werfen“ wird mit `resolution.spend` beschrieben. Einen Wiederholungswurf, den das System kostenlos gewährt, wenn die Situation es verlangt, beschreibt `resolution.reroll` (siehe oben). Ein Wiederholungswurf, der zu etwas gehört, das ein Charakter ausgewählt hat, steht als `mechanics.check` an einem Katalogeintrag und wird mit dessen eigenen Kosten bezahlt.

## Ergebnisbereiche: Mehr als Erfolg oder Fehlschlag

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

## Proben, die auf ihre eigene Art würfeln

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

## Ressourcen ausgeben, um einen Wurf zu verändern

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

## Ein Talisman, der einen Wurf verändert

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
