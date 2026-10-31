# Kämpfe im Regelsatz

Diese Seite gehört zu [Regelsätze für Game Mode schreiben](writing-rulesets.md). Wie ein Regelsatz an einem Kampf beteiligt ist: der `battle`-Block, der Marinaras Kampfsystem den Charakterbogen bereitstellt, und der `combat`-Block, der den gesamten Kampf nach den eigenen Regeln des Regelsatzes auflöst, mit dessen Bestiarium, Brett, Reaktionen und vergleichenden Proben.

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

Der obige `battle`-Block stellt einem Kampf die Zahlen des Bogens bereit, während Marinara weiter rechnet. Der optionale `combat`-Block beschreibt dagegen, wie deine Regeln einen Kampf AUFLÖSEN. Er parametrisiert eine von der Engine bereitgestellte Kampfart, genauso wie `resolution` eine Probenart parametrisiert. Jeder Name darin stammt von dir. Es gibt drei Kampfarten: `attack-vs-defense`, bei der Würfel addiert und mit einer Zahl verglichen werden, `dice-pool`, bei der ein Kampf die eigenen Pools deines `dice-pool`-Regelsatzes wirft und Erfolge zählt (siehe unten „Ein Kampf mit Würfelpools“), und `symbol-pool`, bei der ein Kampf die Erzählwürfel deines `symbol-pool`-Regelsatzes wirft und die verbleibenden Symbole ausgibt (siehe unten „Ein Kampf mit Symbolwürfeln“).

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

<a id="every-key"></a>

### Alle Schlüssel

- `kind`: `"attack-vs-defense"` (eine Seite würfelt gegen die Verteidigung der anderen; ein Treffer verursacht Schaden), `"dice-pool"` (siehe „Ein Kampf mit Würfelpools“) oder `"symbol-pool"` (siehe „Ein Kampf mit Symbolwürfeln“). Jeder folgende Schlüssel bedeutet bei allen dasselbe und wird so gelesen, wie die jeweilige Art Zahlen liest.
- `health`: Erforderlich. Was der Kampf abzieht. Entweder `{ "pool": "grit" }`, ein laufender Pool, den er verringert und dessen etwaiger temporärer Puffer zuerst Schaden aufnimmt, oder `{ "track": "harm" }`, eine Wundleiste, die er MARKIERT. Eine Wundleiste braucht daneben `damageKinds`. Oder `{ "track": "wounds" }` für eine einfache Leiste (ohne `levels` oder `boxes`), die sich von ihrem `min` bis zu ihrem `max` FÜLLT (Capability API 1.383): Schaden addiert die Punkte, Heilung zieht sie ab, und eine Leiste auf ihrem `max` bedeutet das Aus im Kampf, wie ein Pool auf null. Wounds in Genesys ist eine solche Leiste, mit dem Wound Threshold als `max`; geht man in einem System erst JENSEITS der Schwelle zu Boden, liegt das `max` um eins darüber. Eine einfache Gesundheitsleiste beginnt auf ihrem `default` (nicht auf einem `startFrom`), darf nicht auf ihrem `max` beginnen und nimmt kein `damageKinds` an. Ein vom Bogen berechnetes `max` gehört jeweils dem Charakter selbst, wie das Maximum eines Pools. Keine Leiste gewährt temporäre Punkte.
- `defense`: Erforderlicher Wertverweis. Ein vom Spieler eingegebenes Feld oder ein von dir berechneter abgeleiteter Wert.
- `initiative`: Erforderlich. Die zu Beginn einmal gewürfelten Würfel und ein optionaler Modifikatorverweis. Bei Gleichstand gewinnt der höhere Modifikator, danach die Reihenfolge beim Aufstellen des Kampfes. `"each": "round"` würfelt die Initiative aller zu Beginn jeder neuen Runde erneut, mit dem Modifikator, wie er dann steht (ein Modifikator, der eine Wundleiste liest, ist bei Verwundung also langsamer), und die Runde beginnt bei dem, der in der neuen Reihenfolge vorn liegt. Capability API 1.47. Ein `dice-pool`-Kampf kann die Initiative stattdessen als Pool werfen: `pool` (ein Wertverweis) gibt die Zahl der Würfel an, und deren Erfolge plus `plus` ergeben die Zahl, ohne `dice` oder `modifier` daneben. `resource`, das `pool` braucht, behält diese Zahl und lässt Angriffe sie verschieben (siehe unten „Initiative, die Angriffe verschieben“). Capability API 1.48.
- `attackRoll`: Erforderlich bei `attack-vs-defense` und abgelehnt bei `dice-pool`, das die eigenen Pools deiner Auflösung wirft. Die Würfel; ob zweimal gewürfelt und ein Wurf behalten wird (`advantage`); die Wirkung der äußersten Seiten eines einzelnen Würfels (`naturals.max`: `critical`, `hit` oder `none`; `naturals.min`: `miss` oder `none`); und die Wirkung eines kritischen Treffers auf den Schaden (`critical`: `double-dice` würfelt die Schadenswürfel erneut, `max-dice` addiert ihre höchsten Augenzahlen einmal, `none` ist ein gewöhnlicher Treffer). Besondere Augenzahlen setzen wie bei Proben einen einzelnen Würfel voraus. Rettungswürfe im Kampf verwenden dieselben Würfel. `criticalFrom` erweitert den Bereich kritischer Augenzahlen: ein vom Bogen des Angreifers gelesener Wert, der die niedrigste natürliche Augenzahl angibt, die als kritischer Treffer zählt, etwa `{ "field": "critical_from" }` für einen Champion in 5e, auf dessen Bogen 19 steht. Er wird auf die höchste Seite des Würfels begrenzt, ein Wert unter 2 bedeutet überhaupt keinen Bereich (nur die höchste Seite, wie bei einem Charakter, dessen Feld auf 0 belassen ist), und er braucht einen einzelnen Würfel mit `naturals.max` auf `critical`. Capability API 1.81.
- `economy`: Erforderlich. `budgets` beschreibt, was ein Zug enthalten darf: ID, Beschriftung, `per` (`turn` füllt zu Beginn des eigenen Zuges auf, `round` zu Beginn einer neuen Runde) und `count`. Das ZUERST deklarierte Budget ist das Hauptbudget; es bezahlt Standardaktionen. `movement` ist ein optionaler Wertverweis für die Bewegungsweite eines Zuges in deiner eigenen Entfernungseinheit. Er wird bei Kämpfen auf einem Brett gelesen; siehe Positionen.
- `attacks`: Optional. Bogenlisten, deren Zeilen Waffen sind. `name` nennt die Textspalte für den Zeilennamen, `damage.dice` die Würfelspalte. `toHit.ability`, `toHit.proficiency`, `toHit.bonus`, `damage.ability`, `damage.bonus` und `damage.type` nennen jeweils eine Spalte derselben Liste. Eine `ability`-Spalte ist ein `enum` mit einer deiner Attributs-IDs; andere Werte addieren nichts. Eine `proficiency`-Spalte ist ein `boolean`; ist sie gesetzt, wird dein Übungsbonus addiert. Eine Zeile ohne lesbare Würfel ist kein Angriff. Ein Seil in derselben Liste bleibt also einfach ein Seil. `toHit.skill` nennt eine `enum`-Spalte mit einer deiner Fertigkeits-IDs: Die Zeile addiert, was eine Probe dieser Fertigkeit addiert, und nennt die Zeile ein eigenes `ability`, tritt dieses an die Stelle des Attributs der Fertigkeit, genau wie `with=` es bei einer Probe austauscht (Capability API 1.47). `abilityChoices` ordnet einem Wert der Attributsspalte der Zeile zwei oder mehr deiner Attributs-IDs zu (Capability API 1.793): Eine Zeile, die diesen Wert liest, greift mit dem Attribut an, das den höchsten Bonus zum Treffen liefert, und verursacht ihren Schaden mit demselben Attribut. Dafür steht Finesse aus SRD 5.1, geschrieben als `{ "finesse": ["str", "dex"] }` mit `finesse` unter den Werten der Spalte. Der Wert wird abgelehnt, wenn er selbst ein Attribut ist, eines nennt, das deinem Charakterbogen fehlt, oder von keiner Attributsspalte angeboten wird. `toHit.sheetBonus` (Capability API 1.800) addiert eine Zahl vom Bogen zum Treffen: `value` ist ein beliebiger Wertverweis, und `when: { "column": ..., "equals": ... }` beschränkt ihn auf die Zeilen, deren Spalte diesen Wert enthält. Archery aus SRD 5.1, „+2 Bonus auf Angriffswürfe mit Fernkampfwaffen“, liest das `listSum` einer Merkmalsspalte bei Zeilen, deren `reach` 0 ist; ein geworfener Dolch erhält also keinen Bonus. `strikes` ist ein optionaler Wertverweis, der angibt, wie viele Angriffe EIN Verbrauch des Listenbudgets kauft. Wählt der Charakter eine Zeile, während er keine Angriffe in Reserve hat, wird das Budget verbraucht und der Rest vorgemerkt. Solange Angriffe vorgemerkt sind, kostet jede Zeile mit `strikes` überhaupt kein Budget. Andere Waffen, andere Ziele und Bewegung dazwischen ergeben sich so von selbst aus dem Menü. `strikesCappedBy` nennt eine boolesche Spalte, die IHRE EIGENE Zeile auf einen einzelnen Angriff begrenzt, egal wie viele die Liste kauft. Das ist für Waffen gedacht, die pro Zug nur einmal schießen, unabhängig von der Angriffsanzahl ihres Trägers; dafür steht die Loading-Eigenschaft von SRD 5.1. Bei einer Liste, die ohnehin nur einen Angriff pro Budgetverbrauch kauft, wäre das bedeutungslos und wird abgelehnt. Die vorgemerkten Angriffe gehören dem KÄMPFER, nicht einer Liste. Deklarieren zwei Waffenlisten eines Charakters beide `strikes`, greifen ihre Zeilen auf denselben Vorrat zu. Er wird am Ende des Zuges gelöscht, der ihn gekauft hat. Ohne Angabe kauft die Liste einen Angriff pro Budgetverbrauch, wie alle Kämpfe vor dieser Erweiterung.

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
- `standardEffects`: Optional, für den Teil einer Standardaktion, den ihr Kennzeichen nicht ausdrückt. Derzeit gibt es das nur für `dodge`: `{ "dodge": { "saves": ["dex_save"] } }` nennt die Rettungswürfe, die ein ausweichender Charakter für die Dauer des Ausweichens zweimal würfelt, wobei der bessere zählt. Nenne nur auf dem Bogen deklarierte Rettungswürfe und nur dann, wenn `standard` auch `dodge` enthält. Ohne diese Angabe bleibt Ausweichen wie bisher: schwerer zu treffen und sonst nichts. `{ "help": { "beside": true } }` (Capability API 1.771) bietet Help nur neben einem Gegner an, und die Hilfe gilt nur gegen einen Gegner, der neben dem Helfer stand; dafür muss `help` in deiner `standard`-Liste stehen.
- `conditions`: Optional. Bildet DEINE Zustands-IDs auf ihre Wirkungen ab. Bogen und Kampf verwenden dadurch dieselben Zustände, und ein vergifteter Charakter bleibt danach vergiftet. Die Wirkungsliste ist geschlossen: `own-attacks-advantage`, `own-attacks-disadvantage`, `attacks-against-advantage`, `attacks-against-disadvantage`, `attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `cannot-act`, `cannot-react`, `speed-zero`, `half-move-to-stand`, `ends-on-damage`, `own-saves-advantage`, `own-saves-disadvantage`, `own-checks-advantage`, `own-checks-disadvantage`, `resist-all`, `cannot-target-source`, `cannot-target-source-side` (1.278) und `cannot-approach-source`. `failsSaves` nennt Rettungswürfe, die der Zustand ohne Wurf scheitern lässt. Die sechs Wirkungen mit Entfernungs- oder Bewegungsbezug (`attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `speed-zero`, `half-move-to-stand`, `cannot-approach-source`) werden auf einem Brett gelesen und sagen ohne Brett nichts aus; siehe Positionen. `cannot-react` hält den betroffenen Charakter aus dem durch Bewegung geöffneten Fenster heraus; er wird nie gefragt. Vier weitere Schlüssel stehen neben den Wirkungen:
  - `modifiers`: Die Zahlen, die der Zustand verändert, solange er besteht. Siehe unten „Zahlen, die ein Zustand verändert“.
  - `saves`: Welche deiner Rettungswürfe die beiden Rettungswurfwirkungen und jeder Modifikator für Rettungswürfe betreffen. Ohne Angabe gelten sie für alle. Eine Angabe, neben der keines von beidem steht, wird abgelehnt.
  - `skills`: Welche deiner Fertigkeiten die beiden Probenwirkungen und jeder Modifikator für Proben betreffen, der keine eigenen Fertigkeiten nennt. Ohne Angabe gelten sie für alle. Eine Angabe, neben der keines von beidem steht, wird abgelehnt. Die vergleichenden Proben eines Kampfes würfeln die eigenen Probenwerte des Kampfes, keine Fertigkeiten; etwas, das auf Fertigkeiten eingegrenzt ist, erreicht sie also nie. Eine Probe außerhalb eines Kampfes mit einer dieser Fertigkeiten liest es (siehe [Proben außerhalb eines Kampfes](ruleset-items.md#checks-outside-a-fight)). Capability API 1.53.
  - `whileSourceInSight`: Was nur gilt, solange der Verursacher im Sichtfeld des Betroffenen ist. `true` macht den gesamten Zustand davon abhängig. Eine Liste eigener Wirkungen begrenzt nur diese und lässt den Rest bestehen. Das braucht etwa eine Furchtwirkung, die weiteres Annähern unabhängig davon verhindert, ob die Quelle sichtbar ist. Eine nicht im Zustand enthaltene Wirkung wird abgelehnt. Ohne Brett kann keine Sichtlinie unterbrochen werden; dann gilt alles in beiden Fällen.
  - `endsWhenSourceDown`: Der Zustand endet, sobald sein Verursacher zu Boden geht.
  - Sinne (Capability API 1.127): Das `lacks` eines Zustands nennt Sinne, die sein Betroffener nicht hat, und das `mechanics.needs` eines Katalogeintrags oder das `needs` einer Kreaturenaktion nennt Sinne, die ein Ziel haben muss, damit sie auf es wirken. Für Deafened in 5e schreibst du `"lacks": ["hearing"]`, für Command `"needs": ["hearing"]` in seine Mechanik. Ein tauber Betroffener fehlt im Zielmenü von Command. Eine Fläche oder Wirkung auf mehrere Ziele, die Gehör braucht, überspringt dieses Ziel vollständig: kein Rettungswurf, kein Schaden, keine Zustände. Sobald Deafened endet, ist das Ziel wieder zulässig. Jede Liste hat ein bis vier verschiedene Sinn-IDs in den eigenen Worten des Regelsatzes; die Engine kennt keine Namen von Sinnen.
  - Nur nutzbar, solange der Bogen es zulässt (Capability API 1.166): Das `mechanics.usableWhen` eines Katalogeintrags ist `{ "value": <value reference>, "atLeast": n, "atMost": n }` (eine Grenze oder beide). Im Kampf wird der Eintrag im Zug seines Besitzers oder in einem Reaktionsfenster nur angeboten, solange der vom Bogen, Live-Zustand und den Gegenständen seines Besitzers gelesene Wert innerhalb der Grenzen liegt; er wird bei jedem Zeichnen des Menüs gelesen. Protection in 5e braucht einen Schild in der Hand: `"usableWhen": { "value": { "itemStat": { "from": "worn", "pick": "count", "category": "shield" } }, "atLeast": 1 }`. Das „keine schwere Rüstung“ von Rage ist dasselbe mit `"atMost": 0` auf der Zahl schwerer Rüstungen. Eine als Werteblock geschriebene Kreatur hat keinen Bogen, also hält sie nichts zurück.
  - Zustände, die nur auferlegt werden, solange der Bogen des Auferlegenden es zulässt (Capability API 1.167): Ein `applies`-Eintrag an der Mechanik eines Katalogeintrags oder an der Nutzung eines Gegenstands kann `"when"` tragen, in derselben Form wie `usableWhen`. Es wird in dem Moment, in dem der Zustand auferlegt würde, vom Bogen, Live-Zustand und den Gegenständen dessen gelesen, der ihn auferlegt, und ein Eintrag außerhalb seiner Grenzen wird übersprungen; die anderen gelten weiterhin. Rage in 5e legt innerhalb der Grenze von vier Einträgen `raging` und einen von drei Schadenszuständen auf: `{ "condition": "raging_damage_2", "duration": { "rounds": 10 }, "when": { "value": { "derived": "barbarian_level" }, "atMost": 8 } }`, dann `raging_damage_3` mit `"atLeast": 9, "atMost": 15` und `raging_damage_4` mit `"atLeast": 16`. Wer ohne Bogen auferlegt, legt jeden Eintrag auf. Der Werteblock einer Kreatur und das `onEnd` eines Zustands haben keinen Bogen eines Auferlegenden zum Lesen; `when` wird dort daher abgelehnt. Erfordert schemaVersion 2 und capabilityApi 1.167 oder neuer.
  - Kreaturentypen und Zielprüfungen (Capability API 1.168): `combat.creatureTypes` listet auf, was ein Kampfbeteiligter sein kann, `{ "types": [{ "id": "dragon", "label": "Dragon" }, ...], "tags": [{ "id":
"devil", "label": "devil" }], "field": "race", "default": "humanoid" }`.
    Eine Kreatur nennt ihren eigenen `type` und ihre `tags`; der Typ eines Charakters ist der Wert des Text- oder Auswahlfelds `field`, wenn er einer der Typen ist, sonst `default` (Charaktere in 5e sind Humanoide). Eine Zielprüfung ist `{ "types": [...], "tags": [...] }` und besteht bei jeder einzelnen Übereinstimmung; ein Kampfbeteiligter ohne Typ und ohne Tags passt nie. Sie steht an drei Stellen: Das `targetIs` eines Schadensbestandteils fügt diesen Bestandteil nur einem passenden Ziel zu (ein Drachentöter: `"plus": [{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }]`, Weihwasser: `{ "dice": "2d6", "type": "radiant", "targetIs": { "types": ["fiend", "undead"] } }`); das `targetIs` eines `applies`-Eintrags legt diesen Zustand nur einem passenden Ziel auf; und `mechanics.targetTypes: { "is": test, "not": test }` sagt, wer überhaupt gewählt oder erfasst werden darf (Animal Friendship: `{ "is": { "types": ["beast"] } }`; Sleep: `{ "not": { "types": ["undead"] } }`). Eine Fläche übergeht jeden, den `targetTypes` ausschließt. Eine Vorhersage zählt einen `targetIs`-Bestandteil nur gegen ein Ziel, das er erreichen würde; der einfache Durchschnitt auf dem Bogen lässt ihn weg. Das Kampfpanel und der Game Master sehen Typ und Tags jedes Kampfbeteiligten. Erfordert schemaVersion 2 und capabilityApi 1.168 oder neuer.
  - Enden von Zuständen (Capability API 1.125): Charm Person verwendet `"endsWhen": ["harmed-by-source-side"]`. Schaden über null durch den, der ihn auferlegt hat, oder durch jemanden auf dessen Seite, oder ein Angriff, ein Rettungswurf oder ein schädlicher Zustand, den diese auf seinen Betroffenen richten, beendet ihn, nachdem die schädliche Aktion vollständig aufgelöst ist, auch wenn der Angriff verfehlt oder der Rettungswurf gelingt. `"saveWhenDamaged": true` wiederholt einen Zugrettungswurf bei Schaden: Jeder Schaden über null wiederholt das `saveEnds` der auferlegenden Aktion mit deren gespeicherter Schwierigkeit; ein Erfolg beendet ihn. Ohne gespeicherten Rettungswurf oder gespeicherte Schwierigkeit wird nichts gewürfelt. Hypnotic Pattern verwendet `"endsWhen": ["damaged"]` und `"shakeOff": { "budget": "action" }`: Jeder Schaden über null beendet ihn sofort, oder ein anderer Kampfbeteiligter auf der Seite des Betroffenen kann in seinem eigenen Zug dieses Budget ausgeben, um ihn zu beenden. `shakeOff.reach` ist in der Entfernungseinheit des Regelsatzes angegeben und beträgt standardmäßig eine Zelle; ohne Brett wird keine Entfernung gemessen. Die Aktionsökonomie muss ihr Budget deklarieren. `endsWhen` hat einen oder zwei verschiedene Einträge. Diese Schlüssel lassen das Enden beim Zu-Boden-Gehen der Quelle und das Enden der Konzentration unverändert. Für einen Rettungswurf nur bei Schaden über null, nie zu Beginn oder am Ende eines Zuges, verwende `saveEnds.at: "damaged"` (Capability API 1.129): Der Eintrag für Dominate Person ist `{"condition":"dominated","duration":"until-save","saveEnds":{"save":"wis_save","at":"damaged"}}` und würfelt einmal pro Schlag mit der gespeicherten Schwierigkeit der auferlegenden Aktion, ohne `saveWhenDamaged` zu brauchen.
  - Die Aktionsökonomie (Capability API 1.76), wie Haste und Slow sie verändern:
    - `budgets`: `[{ "budget": "haste", "flat": 1 }]` gibt seinem Betroffenen in jedem Zug so viel mehr (oder weniger) eines Zugbudgets, nie unter null. Nur ein Budget, das sich mit `per` pro Zug auffüllt, lässt sich so verändern. Ein Budget kann mit `"count": 0` für eines deklariert werden, das nur ein Zustand füllt, und der Bildschirm zeigt es nur, solange jemand etwas davon hat. Ein erfundener Gegner gibt nie eines aus.
    - `grants`: `{ "budget": "haste", "standard": ["dash", "disengage", "hide"], "attacks": true,
"items": true }`
      sagt, wofür dieses Budget ausgegeben werden darf: für die genannten Standardaktionen (aus der eigenen `standard`-Liste des Regelsatzes, nie auf dem ersten Budget, wo jede Standardaktion bereits liegt), für einen Waffenangriff mit einem einzelnen Schlag (egal wie viele Angriffe eine Aktion sonst in die Hand geben würde; bei einer Kreatur ein Angriff ihres Werteblocks auf ein Ziel, nie ein Mehrfachangriff) und für die Nutzung eines Gegenstands: `true` für jeden Gegenstand oder `{ "tags": ["mundane"] }` nur für einen Gegenstand mit einem dieser Gegenstands-Tags (Use an Object in 5e ist die Nutzung eines gewöhnlichen Gegenstands, nie die Aktivierung eines magischen Gegenstands). Sie werden angeboten, sobald das Budget, das sie sonst verbrauchen würden, aufgebraucht ist, und nur im eigenen Zug des Betroffenen: Eine Gewährung bezahlt nie eine Reaktion.
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
- `damageKinds`: Erforderlich, wenn `health` eine Wundleiste nennt, und bei einem Pool abgelehnt. Nur eine Markierung trägt eine Art; ein Punktepool hat keinen Speicherplatz dafür. Siehe [Wundleisten](ruleset-sheets.md#wound-tracks-health-that-is-a-track-not-a-number). Der Block bestimmt, welche der `kinds` der Leiste ein Treffer markiert und wie viele Kästchen er ankreuzt. `default` gilt für alles nicht Zugeordnete, einschließlich Treffern ganz ohne Typ. `byType` bildet deine `damageTypes` auf Arten ab. Die Schlüssel werden wie die Typen ohne Beachtung der Groß- und Kleinschreibung abgeglichen; `"Fire"` und `"fire"` sind daher ein Schlüssel, und die Angabe beider wird abgelehnt. `marks` hat keinen Standard, weil die beiden Antworten gegensätzlich sind: `"per-point"`, wenn der Schadenswurf Gesundheitsstufen zählt – drei Schaden markieren drei Kästchen, und ein Punkt Schadensminderung lohnt sich –, oder `"per-blow"`, wenn nur zählt, ob ein Treffer ankommt – dann markiert er unabhängig von seiner Stärke ein Kästchen. Auch ein Treffer mit mehreren Schadensbestandteilen markiert dabei nur ein Kästchen und verwendet die schwerste angekommene Art. Gib an, welches Modell dein System nutzt. `{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`.
- `pool`: Erforderlich bei `dice-pool`, abgelehnt bei `attack-vs-defense`. Siehe „Ein Kampf mit Würfelpools“.
- `spendLimits`: Optional. Wie viel eines laufenden Pools ein Kämpfer im Kampf pro `turn` oder pro `round` ausgeben darf, gleich welcher Kampfart: `[{ "pool": "blood", "max": { "derived": "blood_per_turn" }, "per": "turn" }]`. `max` wird einmal zu Kampfbeginn gelesen. Kosten über das hinaus, was vom Limit übrig ist, sind nicht bezahlbar und fehlen daher im Menü, egal wie viel im Pool ist. Ein Limit pro Zug beginnt zu Beginn des eigenen Zuges seines Besitzers neu, eines pro Runde, wenn eine Runde beginnt. Ein mit direkten Zahlen geschriebener Gegner bezahlt nichts von einem Bogen, ein Limit bindet ihn also nie; ein als Bogen geschriebener Gegner bezahlt aus seinen eigenen Pools und unterliegt dem Limit wie jeder andere. Capability API 1.47.
- `threat`: Optional und für ein Bestiarium erforderlich. `tiers` ist die Skala für die Gegnerauswahl: ID, Beschriftung, `health`-Bereich, `defense`, `toHit`, `damagePerRound`-Bereich und `saveDifficulty`. Jede ausgelieferte Kreatur nennt eine dieser Stufen. Ein nicht vorab geschriebener Gegner wird auf die vom Game Master gewünschte Stufe begrenzt, damit nichts außerhalb deiner Skala landet. Der Bereich `damagePerRound` beschreibt den Schaden einer Kreatur gegen EIN Ziel pro Runde, einschließlich ihrer gesamten Angriffsfolge.
  Eine Stufe kann `worth` tragen, den Wert, mit dem eine Kreatur dieser Stufe auf ein Begegnungsbudget angerechnet wird (die Erfahrungspunkte nach Herausforderungsgrad in 5e), und `threat` kann `budget` tragen, das festlegt, was ein Kampf für die Gruppe, die ihn bestreitet, enthalten darf (Capability API 1.803):
  - `level`: die Zahlenfelder, deren Summe die Stufe eines Mitglieds ergibt (5e: eines pro Klasse).
  - `steps`: die Schwierigkeitsschritte, beginnend mit dem niedrigsten, jeweils `{ "id", "label" }`.
  - `byLevel`: `[{ "level": 5, "worth": [500, 750, 1100] }]`, ein Wert je Schritt für ein Mitglied ab dieser Stufe, mit aufsteigenden Stufen.
  - `crowd`: optional, `[{ "from": 2, "times": 1.5 }]`, der Faktor, mit dem der Wert der Gegner multipliziert wird, sobald es mindestens so viele sind; `smallParty` und `largeParty` lassen bei einer Gruppe unterhalb der ersten Grenze eine Zeile weiter oben lesen und bei einer Gruppe oberhalb der zweiten eine Zeile weiter unten (die Multiplikatoren von 5e 2014). Lass es für das Budget von SRD 5.2 weg, das die Werte unverändert addiert.
  - `forGame`: optional, der Schritt, auf dem jede Game-Schwierigkeit (`casual`, `normal`, `hard`, `brutal`) gespielt wird. Ohne Angabe nehmen sie die Schritte der Reihe nach; alle, die über den letzten hinausgehen, werden auf dem letzten gespielt.

  Der Game Master erfährt den Wert jeder Stufe und das Budget der Gruppe, bevor er einen Kampf schreibt. Ein von ihm erfundener Kampf mit einem höheren Wert wird herabgestuft: Der erfundene Gegner mit dem höchsten Wert wird um eine Stufe herabgesetzt, und das wird wiederholt, bis der Kampf ins Budget passt; ein Kampf mit einem Boss darf den nächsthöheren Schritt erreichen. Eine Kreatur aus dem Bestiarium und eine, die aus einem früheren Kampf zurückkehrt, werden mit ihren bestehenden Werten gezählt, und ein Story-Kampf bleibt seinem Autor überlassen. Was herabgestuft wurde, steht in den Anpassungen des Kampfes.

### Rettungswürfe gegen Zustände, Schaden oder Magie

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
- `hardness`: ein Wertverweis für die Härte eines Kämpfers, wo Initiative eine Zahl ist, die Angriffe verschieben. Siehe [Rüstung und getragene Wirkungen im Kampf](ruleset-items.md#armor-and-worn-effects-in-a-fight).

Der Schaden für jedes Ziel wird für dieses Ziel geworfen, denn was ein Treffer über die nötigen Erfolge hinaus verdient hat und was das Ziel absorbiert, gehört zu ihm. Der zweite Bestandteil eines Schlags und ein Zusatzeffekt sind jeweils ein eigener Schadenspool ihrer eigenen Art, ohne zusätzliche Würfel aus dem Treffer. Das Menü sagt einen Pool exakt voraus: die Chance, die nötigen Erfolge zu erreichen, und was die Schadenswürfel nach der Schadensminderung des ersten Ziels wert sind.

Gravewatch ist so geschrieben: Seine Wächter werfen einen Grundwert und eine Tätigkeit, absorbieren Knock-Schaden mit Sinew und Tear-Schaden überhaupt nicht, dürfen pro Zug einen Punkt Resolve ausgeben und würfeln die Initiative jede Runde neu.

**Ansagen in umgekehrter Reihenfolge ist nicht umgesetzt.** Manche Systeme lassen alle ihre Aktion ansagen, bevor jemand handelt, die Langsamsten zuerst. In einem Kampf, in dem jeder Kämpfer eine Aktion wählt, sobald er an der Reihe ist, ändert eine vorherige Ansage nichts, was eine Regel liest; ein Schlüssel hätte also nichts auszudrücken.

<a id="a-fight-thrown-in-symbol-dice-symbol-pool"></a>

### Ein Kampf mit Symbolwürfeln: `symbol-pool`

Ein `symbol-pool`-Regelsatz liest Symbole statt Zahlen, und seine Kämpfe können das ebenfalls. Die Engine führt damit den gesamten Kampf aus, ohne den Game Master zu fragen, was ein Vorteil bewirkt. `"kind": "symbol-pool"` setzt voraus, dass `resolution.kind` den Wert `"symbol-pool"` hat und liest den Bogen so, wie deine Symbolproben es bereits tun:

- Ein Trefferwert gibt die Würfel des Angreifers an. Auf einem Bogen besteht die Zahl einer Angriffszeile aus ihrem Attribut und den Rängen ihrer Fertigkeit zusammen: Die größere Zahl gibt an, wie viele Würfel geworfen werden, die kleinere, wie viele davon aufgewertet werden, so wie `pool.build: "larger-upgraded"` eine Probe zusammenstellt. Eine Kreaturenaktion gibt das mit `toHit` (ihren Würfeln) und `upgrades` (wie viele davon aufgewertet werden) an. Das braucht einen Pool mit einem `upgrade`-Würfel, der nicht mit `sum` zusammengestellt wird.
- `defense` gibt an, wie viele Schwierigkeitswürfel gegen die Würfel des Angreifers geworfen werden. Die `defense` einer Kreatur ist ihre eigene Anzahl davon. Deckung und der Modifikator eines Zustands auf `defense` fügen Schwierigkeitswürfel hinzu.
- Der Modifikator eines Zustands auf Angriffe, Rettungswürfe oder Proben sowie der von deinem `penaltyFrom` genannte Wundabzug sind Verstärkungswürfel, wenn sie helfen, und Komplikationswürfel, wenn sie behindern. Sie sind daher `flat`-Zahlen; ein gewürfelter Modifikator (`dice`) wird abgelehnt. Ein Wurf mit Nachteil (große Entfernung, Nachteil durch einen Zustand) wirft einen weiteren Komplikationswürfel, ein Wurf mit Vorteil einen weiteren Verstärkungswürfel.
- Netto-Erfolge (so viele, wie dein `success.needed` angibt) lassen einen Schlag treffen. Die Zahl eines Rettungswurfs steht für seine Würfel, seine Schwierigkeit für die gegnerischen Würfel. Eine vergleichende Probe wirft die Würfel beider Seiten, und die mit mehr Netto-Erfolgen gewinnt. Initiative darf als Pool geworfen werden (`initiative.pool`); ihre Netto-Erfolge sind die Zahl.
- Schaden wird wie in einem `attack-vs-defense`-Kampf addiert. Jeder Netto-Erfolg fügt einem Treffer `damage.perSuccess` (eins) hinzu, entweder jeder Erfolg (`"counts": "all"`) oder nur die über die zum Treffen nötigen hinaus (`"beyond"`). Die Schadensminderung des Ziels wird vom gesamten Schlag abgezogen, nie unter null.
- Es gibt weder Patzer noch eine Verdopplung eines Schadenswurfs. Ein kritischer Treffer wird durch eine Ausgabe gekauft.

Was die Symbole bewirken, legt der `symbols`-Block fest:

```json
"symbols": {
  "damage": { "perSuccess": 1, "counts": "all" },
  "soak": { "all": { "derived": "soak" } },
  "spends": [
    { "id": "boost", "label": "Boost an ally", "by": "attacker", "symbol": "a", "cost": 1, "boost": { "dice": 1, "on": "attacker-ally" } },
    { "id": "crit", "label": "Critical", "by": "attacker", "symbol": "a", "cost": 2, "when": "hit", "critical": true, "condition": { "id": "injured", "on": "target", "rounds": 3 } },
    { "id": "triumph", "label": "Triumphant blow", "by": "attacker", "symbol": "t", "cost": 1, "when": "hit", "critical": true, "damage": 2 },
    { "id": "strain", "label": "Overextend", "by": "target", "symbol": "h", "cost": 2, "track": { "id": "strain", "by": 1, "on": "attacker" } },
    { "id": "setback", "label": "Opening", "by": "target", "symbol": "h", "cost": 1, "setback": { "dice": 1, "on": "attacker" } },
    { "id": "despair", "label": "Weapon slips", "by": "target", "symbol": "d", "cost": 1, "condition": { "id": "disarmed", "on": "attacker" } }
  ]
}
```

- `soak`: Was ein Ziel von jedem Treffer abzieht, von seinem Bogen gelesen. `all` ist ein Wertverweis für jede Schadensart und `byKind` einer je Art deiner Gesundheitsleiste, der für seine Art Vorrang vor `all` hat. Eine Kreatur gibt ihre eigene Schadensminderung als `soak: { "all": 2 }` an; dafür muss dieses `soak` deklariert sein.
- `spends`: Bis zu 16 Optionen, die mit den nach einem Angriffswurf übrig gebliebenen Symbolen gekauft werden können. Für `cost` Einheiten von `symbol` wird eine Option einmal gekauft, und `max` (eins) sagt, wie oft ein Wurf sie kaufen darf. Eine Ausgabe, die eine `condition` oder einen `critical` gibt, wirkt einmal, ihr `max` bleibt also eins. Keine zwei Ausgaben legen bei demselben Wurf denselben Zustand (oder zwei derselben `oneAtATime`-Art) demselben Ziel auf. Eine Ausgabe wird nicht gekauft, wenn sie nichts bewirken würde: Ihr Zustand würde nicht auferlegt (abgehalten oder eine seiner Art bereits vorhanden), oder ihre Leiste hat keinen Platz für einen ganzen Schritt in diese Richtung (Platz, den eine frühere Ausgabe desselben Wurfs bereits verbraucht haben kann). `by` sagt, welche Seite sie wählt: Der Angreifer gibt die ihm günstigen Symbole aus (Vorteil, Triumph), das Ziel die ihm günstigen (Bedrohung, Verzweiflung). Ein bestimmtes Symbol wird von einer Seite ausgegeben; eine Ausgabe kauft nie mit den Erfolgen, die bereits den Schlag treffen lassen und seinen Schaden erhöhen.
- `when`: Wird nur bei einem `hit`, nur bei einem `miss` oder bei beidem gekauft (`any`, der Standard). `damage` (Schaden, der vor der Schadensminderung zum Treffer hinzukommt) und `critical` (der Treffer ist kritisch, sodass eine Klausel mit `onCritical` greift und das Protokoll ihn als kritisch ausweist) brauchen `"when": "hit"` und `"by": "attacker"`.
- Was eine Ausgabe bewirkt, beliebig kombiniert: `condition` legt jemandem einen deiner Zustände auf, für `rounds` oder bis etwas ihn beendet; `track` verschiebt eine einfache Live-Leiste um `by` (Anstrengung, Stress), nie die Gesundheitsleiste; `boost` und `setback` fügen dem nächsten Wurf des Betroffenen in diesem Kampf so viele Würfel hinzu, die dieser Wurf verbraucht. `on` ist `attacker`, `target`, `attacker-ally` oder `target-ally`. Ein Verbündeter ist der nächste dieser Seite, der einen Zug macht; eine Ausgabe, für die es keinen solchen Verbündeten gibt, wird nicht gekauft.
- `worth`: Optional. Der Wert, den die KI der Ausgabe in Schadenspunkten beimisst. Ohne Angabe berechnet die Engine ihn aus den Wirkungen: Schaden zählt seine Punkte, ein Zustand ist zwei wert, ein Würfel auf den nächsten Wurf etwas mehr als einen halben, ein Leistenschritt einen halben, gegen die andere Seite oder für die eigene Seite des Wählenden, wenn er dort eine Leiste senkt oder Verstärkungswürfel hinzufügt. Eine Ausgabe, die ihrem Wählenden nichts wert ist, wird nie gekauft.

Die Engine kauft für jede Seite die Ausgaben, die für ihre vorhandenen Symbole am meisten wert sind, für Spieler wie für Gegner, und nennt jede im Protokoll. Ein Spieler kann stattdessen selbst wählen: Ist auf dem Kampfbildschirm „Choose my own symbol spends“ angekreuzt, wartet ein Wurf, der einem von ihm gespielten Gruppenmitglied etwas zum Kaufen lässt, während er Ausgaben einzeln auswählt, für den Rest die Auswahl der Engine übernimmt oder nichts weiter ausgibt. Seine Wahl unterliegt denselben Regeln wie die der Engine (Kosten, `max`, `when` und was tatsächlich wirken würde). Für alle anderen wählt weiterhin die Engine. Ein Regelsatz braucht dafür nichts. Symbole, die niemand ausgibt, bleiben auf dem Wurf, damit der Game Master sie erzählen kann. Die Menüvorhersage zählt jeden möglichen Ausgang des Wurfs: die Trefferchance und den Schaden eines Treffers mit seinen Erfolgen und Ausgaben nach Schadensminderung. Die KI bewertet jeden Angriff danach und zieht ab, was die Ausgaben der Gegenseite sie kosten würden.

**Was beim Game Master bleibt.** Die Kosten einer Ausgabe gehören dem Regelsatz, nicht der einzelnen Waffe. Eine Waffe mit eigenem kritischem Wert wird daher als Ausgabe geschrieben, die der ganze Regelsatz teilt; die eigene Tabelle eines kritischen Treffers würfelt der Game Master. Vorteil auf einem Rettungswurf, einer Probe oder einer vergleichenden Probe kauft nichts: Nur der Wurf eines Angriffs wird ausgegeben. Eine Aufwertung der Schwierigkeitswürfel im Kampf ist nicht umgesetzt.

### Mindestschadenswürfel

Ein Pool-Kampf kann selbst gegen starke Schadensminderung Würfel behalten, wie **Overwhelming** in Exalted:

```json
"damage": { "minimum": { "derived": "overwhelming" } }
```

Das ist `combat.damage.minimum`, ein Wertverweis, der vom aktuellen Bogen des **Angreifers** gelesen wird. Nachdem statische Schadensminderung Würfel vom ersten Schadenspool eines Treffers abgezogen hat, wird der Pool auf mindestens diese Zahl angehoben. Es sind ganze Würfel, abgerundet und zwischen null und `resolution.pool.max` begrenzt, keine automatischen Erfolge: Jeder verbleibende Würfel kann scheitern. Gewürfelte Schadensminderung zieht nach dem Schadenswurf weiterhin Erfolge ab; sie verkleinert keinen Würfelpool, das Minimum schützt Erfolge also nicht vor ihr. Resistenz und Immunität gelten weiterhin. Schläge im ausgebenden Stil ignorieren das Minimum, so wie sie Waffenschaden und Schadensminderung ignorieren; Schläge im nehmenden Stil verwenden es.

Eine Waffe kann das gemeinsame Minimum mit `item.attack.damage.minimum` überschreiben. Es nimmt dieselben Wertverweise auf ihren Träger an oder `{ "stat": "overwhelming" }` für einen der eigenen Zahlenwerte des Gegenstands. Auch eine deklarierte Null überschreibt das gemeinsame Minimum. Das unterscheidet sich vom bestehenden `floor` einer Waffe, das eine Schadensmenge nach der Schadensminderung garantiert. Zusätzliche Schadensbestandteile und Zusatzeffekte erhalten kein weiteres Minimum. Der Kampfdatensatz und das Protokoll zeigen das aufgelöste Minimum neben den Würfeln. Sowohl der Kampfschlüssel als auch der Waffenschlüssel brauchen in einem Paket **Capability API 1.146**, auch für Waffen in externen Katalogdateien.

### Ein Treffer, der benommen macht

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

### Das Ziel bestimmt die Wundart

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
- `resist`, `vulnerable`, `immune`: Schadenstypen, ohne Beachtung der Groß- und Kleinschreibung abgeglichen und bei vorhandener Deklaration gegen `combat.damageTypes` geprüft. Ein `resist`- oder `immune`-Eintrag kann außerdem angeben, was hindurchkommt, `{ "type": "tearing", "except": ["silver"] }`: Der Schlag einer Gegenstandswaffe, die eines dieser Gegenstands-Tags trägt, wird voll erlitten (Capability API 1.55, siehe [Waffen im Kampf](ruleset-items.md#weapons-in-a-fight)), ebenso der Schlag einer Aktion, deren `damage.qualities` eines davon nennt, oder eines Katalogeintrags, dessen `mechanics.qualities` eines davon nennt (Capability API 1.101). `conditionImmunities` nennt deine eigenen Zustände oder eine Leiste, die deine `combat.levels` lesen (Capability API 1.115).
- `tier`: Die zugehörige Stufe von `combat.threat`.
- `loot` (Capability API 1.63): Die ID der Beutetabelle, die ein gewonnener Kampf für sie würfelt (siehe [Beute](ruleset-items.md#loot)).
- `inventory` (Capability API 1.795): Was sie bei Kampfbeginn bei sich haben kann, bis zu 16 Zeilen. Jede Zeile nennt einen deiner Gegenstände (`item`, als `<catalog>/<entry>`) oder eine deiner Beutetabellen (`table`), mit `chance` (von hundert, Standardwert 100) und `count` (eine Zahl oder Würfel, Standardwert 1; eine Tabelle wird so oft gewürfelt). Sie nutzt im Kampf, was sie nutzen kann: Eine Kreatur mit einem `sheet` nutzt ihre Gegenstände wie ein Gruppenmitglied, und ein einfacher Werteblock nutzt einen Gegenstand, dessen `use` den Gegenstand bei der Nutzung verbraucht und nichts von dessen Nutzer liest (einen Trank, ein Öl). Was sie übrig hat, lässt sie fallen, wenn sie besiegt wird, zusätzlich zu ihrer `loot`; eine Kreatur, die davonläuft, nimmt es mit. Der Game Master kann einem Gegner stattdessen eigene Gegenstände geben (`carrying` in der Begegnung), die an die Stelle dieser Zeilen treten.
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

Die Testkopie eines 5e-Entwurfs der Engine, `docs/development/ruleset-5e-2014.example.json`, enthält ein Bestiarium mit fünf handgeschriebenen Kreaturen. Sie decken eine Aktionsfolge, Wiederaufladung, einen Rettungswurf mit Zustand, Resistenzen und Immunitäten, begrenzte Nutzungen, Signaturpunkte und eine als Bogen geschriebene Kreatur ab. Das vollständige SRD-Bestiarium findest du in `catalogs/creatures.json` des offiziellen [Pakets 5e (SRD 5.1)](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014).

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

**Welche Stile ein Spiel verwenden darf.** `combat.styles` nennt die Kampfstile, die ein Spiel mit deinem Regelsatz verwenden darf, per ID: `classic`, `tactical` oder einen von einem Client registrierten Stil (bis zu 8, jeden einmal und mindestens einen von `classic` und `tactical`). Ohne Angabe werden wie bisher alle Stile angeboten. Ein Regelsatz, dessen Regeln ein Brett brauchen (Flächen, Reichweite, Deckung, Flankieren), gibt `"styles": ["tactical"]` an: Der Assistent für ein neues Spiel und die Spieleinstellungen bieten dann nur **Tactical** an, sodass seine Kämpfe immer Positionen haben. Ein Spiel, das bereits mit einem nicht aufgeführten Stil gespeichert wurde, verwendet den ersten aufgeführten Stil, den der Client darstellen kann (auf einem Client ohne einen der aufgeführten registrierten Stile den ersten aufgeführten eingebauten Stil). Ein Spiel kann weder mit einem ausgelassenen Stil erstellt noch in seinen Einstellungen auf einen solchen umgestellt werden. Ein bereits laufender Kampf behält den Stil, mit dem er begonnen hat. Die Liste gilt unabhängig davon, ob der Combat Director eingeschaltet ist; sie schränkt damit auch Marinaras eigene Classic- und Tactical-Kämpfe mit deinem Regelsatz ein. Ein Regelsatz, der `styles` verwendet, braucht Capability API 1.379.

```json
"combat": {
  "kind": "attack-vs-defense",
  "styles": ["tactical"],
  "distance": { "label": "feet", "perCell": 5 }
}
```

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

**In der Luft** (Capability API 1.354). Auf jedem Brett wird gesondert festgehalten, ob ein Flieger in der Luft ist: Ein Flieger ohne Gehbewegung oder mit `hover` beginnt in der Luft. Einer am Boden hebt mit der kostenlosen Option „Take off“ ab, indem er nach oben fliegt oder einen Schritt macht, den er nur fliegend zurücklegen kann (über Wasser oder dort, wo Fliegen billiger ist als Gehen). Er landet mit der kostenlosen Option „Land“ (nur mit Gehbewegung) oder wenn er zu Boden geht, umgestoßen oder auf Geschwindigkeit null festgehalten wird, sofern er nicht schwebt. Zum Boden hinunterzufliegen hält ihn auf Bodenhöhe in der Luft, bis er landet. Solange er in der Luft ist, verwendet er seine Fluggrafik als Kreaturengrafik. Sonst liest noch nichts in den Regeln diesen Zustand.

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
- **Zwischen zwei Zügen.** Endet ein Zug, wird vor dem nächsten jeder Gegner mit `signaturePoints` gefragt, der eine eigene `signature`-Aktion bezahlen kann. Nur in diesem Moment werden solche Aktionen gekauft, sofern `combat.signatureAtTurnStart` nichts anderes festlegt. Sie erscheinen auf keinem Zugmenü, auch nicht dem eigenen.
- **Der Zug eines Gegners beginnt** (Capability API 1.805). Mit `"combat": {"signatureAtTurnStart": true}` wird jeder mit `signaturePoints` auch zu Beginn des Zugs eines Gegners gefragt, nachdem alles geschehen ist, was dieser Beginn auslöst (Zustände, Rettungswürfe, Reaktionen), und bevor der Gegner handelt: Ein Boss antwortet dem Helden, der gleich handeln wird, wie bei der Vorwegnahme in einem generischen Kampf. Hortaktionen behalten ihren eigenen Zähler und werden dort nicht angeboten. Ohne diese Angabe werden Signaturaktionen nur zwischen Zügen gekauft, wie die legendären Aktionen in 5e. Ein Regelsatz, der dies nutzt, braucht Capability API 1.805.
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

- **Jenseits des einfachen Bretts**: kein Überfliegen von Hindernissen. Eine Kreatur wird nur durch ihren eigenen Gang, den Gang eines Reittiers, eine Teleportation, das, was sie stößt (eine vergleichende Probe, ein Eintrag, die Aktion einer Kreatur oder eine Zone), und jemanden, der sie mit sich zieht, bewegt.
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
