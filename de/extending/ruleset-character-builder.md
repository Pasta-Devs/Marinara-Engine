# Charaktererstellung im Regelsatz

Diese Seite gehört zu [Regelsätze für Game Mode schreiben](writing-rulesets.md). Der geführte Erstellungsassistent: einen Charakter schrittweise erstellen, von Volk und Klasse bis zu Werten, Ausbildungen, Zaubern und Ausrüstung.

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

Bis zu 32 Schritte, jeweils `{ id, label, kind, ... }`; ein Paket mit mehr als 16 deklariert Capability API 1.112 und eines mit mehr als 24 Capability API 1.768:

- `catalog`: Einträge eines Zeilenkatalogs, als Karten angezeigt, mit ihrer `summary` hinter **Info**. `min` (Standard 1) gibt an, wie viele der Schritt verlangt, und `max` (Standard 1), wie viele er höchstens nimmt; bei `max` 1 ersetzt eine neue Wahl die alte. Beide dürfen bis 60 gehen; ein Paket, bei dem einer davon über 20 liegt, deklariert Capability API 1.110 und eines, bei dem einer davon über 40 liegt, Capability API 1.768 (das Zauberbuch eines Magiers auf der 20. Stufe enthält 44 Zauber). `field` nennt ein Text- oder Enum-Feld, in das die Beschriftungen der gewählten Einträge geschrieben werden (ein Enum-Feld nimmt die ID oder die Beschriftung des Eintrags, je nachdem, welche davon einer seiner Werte ist). `filters` legt Werte der Katalogfilter fest, und `within: { step, filter }` bietet nur Einträge an, deren `filter` einen in diesem früheren Schritt gewählten Eintrag nennt, so wie eine Unterrasse ihre Rasse nennt; wird die Rasse abgewählt, zählt ihre Unterrasse nichts mehr. `upTo: { filter, value }` (Capability API 1.87) bietet nur Einträge an, deren Zahlenfilter `filter` höchstens `value` beträgt, einen Wert, der vom Bogen in seinem aktuellen Stand gelesen wird, etwa Merkmale bis zur Stufe des Charakters (`{ "filter": "level", "value": { "derived": "level" } }`). Ein Eintrag ohne diesen Filter wird immer angeboten, und eine Wahl, unter die der Bogen inzwischen gefallen ist, zählt nichts, bleibt aber erhalten. Eine Wahl, die den gelesenen Wert ändert (eine Klasse, die die Stufe setzt), wird in derselben Änderung verrechnet, ebenso ein in **All fields** geänderter Wert (eine dort gesenkte Stufe nimmt sofort zurück, was ein Merkmal darüber gegeben hat). `countFrom` (Capability API 1.90) ist ein auf dieselbe Weise vom Bogen gelesener Wert, der zugleich für `min` und `max` steht: wie viele Einträge der Schritt verlangt und wie viele er höchstens nimmt, abgerundet und nie über `max`, etwa die Zauber, die eine Klasse auf der Stufe des Charakters kennt (`{ "derived": "spells_known" }`). Wahlen darüber hinaus bleiben erhalten, zählen aber nichts, bis die Anzahl wieder steigt.
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
- Ein Katalogeintrag kann eine `exclusive`-Gruppe nennen (Capability API 1.94): Ein Schritt des Erstellungsassistenten behält eine Wahl jeder Gruppe; die Wahl eines Eintrags verwirft also die andere Wahl des Schritts aus dieser Gruppe, und nur die neueste zählt. Ein Talent, das anstelle einer Attributswerterhöhung genommen wird, teilt sich mit ihr eine Gruppe: `"exclusive": "fighter-asi-4"`. `"exclusiveDefault": true` (Capability API 1.772) macht einen Eintrag zu demjenigen, den ein Schritt, der alles Angebotene übernimmt, aus seiner Gruppe übernimmt, bis der Spieler einen anderen wählt.
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

Ein Zeilenschritt kann mit `countFrom` (Capability API 1.799), einem vom Bogen gelesenen Wert, angeben, wie viele Zeilen er verlangt: die Trefferpunktwürfe aus 5e, einer pro Stufe nach der 1. Stufe. Wenn der Schritt angezeigt wird, fügt der Erstellungsassistent Zeilen hinzu, jede so, wie **Add a row** (Zeile hinzufügen) sie erstellt, bis die eigenen Zeilen des Spielers diese Anzahl erreichen, nie über `max` oder das `maxItems` der Liste hinaus; er nimmt nie eine Zeile weg, und eine dort entfernte Zeile bleibt entfernt, bis der Schritt erneut angezeigt wird. Ein Charakter, der gerade beschrieben wird, erhält durch das Betrachten des Schritts keine Zeilen. Der Schritt wartet dann wie bei `min` auf diese Anzahl vollständiger Zeilen, auf die größere der beiden Anzahlen, wenn beide angegeben sind, und zeigt denselben Zähler „N von M“. Ein Regelsatz, der dies verwendet, braucht Capability API 1.799.

```json
{
  "id": "hit_point_rolls",
  "label": "Hit point rolls",
  "kind": "rows",
  "list": "hp_rolls",
  "required": ["die", "roll"],
  "countFrom": { "derived": "hp_rolls_due" }
}
```

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
