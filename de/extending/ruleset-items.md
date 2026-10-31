# Gegenstände im Regelsatz

Diese Seite gehört zu [Regelsätze für Game Mode schreiben](writing-rulesets.md). Was eine Gruppe mit sich führt: Kategorien, Waffen, Rüstungen, Munition, Beute, Geld, Startausrüstung und Märkte.

Rüstungen, Waffen, Tränke, Ausrüstung, Munition und Geld sind Gegenstände. Ein optionaler `items`-Block deklariert die Begriffe, in denen jeder Gegenstand deines Regelsatzes geschrieben ist, und ein Katalog mit `holds: "items"` listet die Gegenstände selbst auf. Beides braucht Capability API 1.49. Darüber hinaus brauchen: `rarityCaps` und `propose` des Blocks, die die vom Game Master erfundenen Gegenstände regeln, 1.51; ein Wert, der die Gegenstände eines Charakters liest (`itemStat`), 1.52; was ein Gegenstand beim Tragen oder Mitführen an Proben bewirkt, samt den `bonus`-Grenzen des Blocks, 1.53; was ein Gegenstand von seinem Träger verlangt und die Attribute, die er verändert, 1.54; der `attack` einer Waffe 1.55; was ein Gegenstand im Kampf bewirkt, 1.56; was eine Waffe verschießt und geladen hält, 1.57; die Modi einer Waffe, ihr Angriff mit der Nebenhand, ihr Mindestschaden und ihre Zustände bei einem Treffer 1.58; was die Nutzung eines Gegenstands im Kampf bewirkt, samt der Ladungen, die er hält, 1.59; eine Nutzung, die einen Pool wiederherstellt, 1.60; bei einer Rast zurückgewonnene Ladungen oder ein Gegenstand, der zerbricht, wenn er leer ist, 1.61; eine Nutzung, die zuerst eine Probe verlangt (`gate`), 1.62; Beutetabellen und die Beute einer Kreatur 1.63; eine Beutezeile, die Münzen fallen lässt, oder eine Ebene, die Münzen herausnimmt, 1.64; ein Markt, der `sold`-Ort eines Gegenstands und ein `service` 1.65; ein Markttag (eine Kasse, `buyBack`, der `stock` eines Händlers, eine `limited`-Anzahl oder ein `sold` ohne Ort) 1.69; ein Zusatzeffekt, der bei gehaltenen Waffen auslöst (`weapons`), 1.70; Startausrüstung (`startingGear`) 1.78; und ein riskanter Gegenstand, eine Fälschung oder ein unehrlicher Händler 1.79.

## Der Gegenstandsblock

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
- `carry`: Optional. `stat` nennt den Zahlenwert, der das Gewicht eines Gegenstands ist; sein `min` ist 0 oder mehr. `encumberedAbove` gibt an, wie viel ein Charakter tragen kann, bevor er belastet ist, und `limit` (optional), wie viel er überhaupt tragen kann. Beides wird wie `binding.max` vom Bogen gelesen. Ohne `carry` bedeutet Gewicht nichts, und niemand ist je belastet. `unit` (optional, bis zu 12 Buchstaben, Capability API 1.791) gibt an, in welcher Einheit ein Gewicht gezählt wird, etwa `"lb"`: Die Traglast im Inventar, die Gewichte in der Auswahl der Startausrüstung und das Gewicht einer Ausrüstungsset-Option nennen sie nach der Zahl.
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

## Ein Gegenstand

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

## Was Gegenstände liest

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

## Gegenstände auf dem Bogen

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

## Proben außerhalb eines Kampfes

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

## Typisierte Verteidigungen aus Zuständen, Stufen, Gegenständen und Bogenzeilen

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

## Waffen im Kampf

Ein Gegenstand kann eine Waffe sein (Capability API 1.55). Sein `attack` hat die Form der [Angriffszeilen](ruleset-combat.md#combat-a-fight-your-own-rules-resolve) eines Kampfblocks, mit Werten statt Spalten, und ein [Regelsatzkampf](ruleset-combat.md#combat-a-fight-your-own-rules-resolve) bietet ihn als Angriff an, solange der Gegenstand getragen wird: in den Händen gehalten, die er belegt, und gebunden, wo er gebunden wird. Ein weggesteckter oder nur mitgeführter Gegenstand bietet nichts an, und die Angriffszeilen und die eigenen Aktionen einer Kreatur funktionieren genau wie bisher. Die Handaxt aus Ember Roads:

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

### Munition und Nachladen

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

### Modi, eine zweite Waffe, eine Untergrenze und Zustände bei einem Treffer

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
- `plus`: Bis zu drei weitere Mengen bei jedem Treffer, jede `{ "dice", "flat", "type", "save", "targetIs", "when" }` und für sich gewürfelt, typisiert und gegen Resistenzen geprüft (Capability API 1.169). `save` nennt eigene `difficulty` und `onSuccess` (`half` oder `none`). `targetIs` fügt sie nur einem Ziel dieser Kreaturentypen oder Tags zu (siehe „Kreaturentypen und Zielprüfungen“ unter [Alle Schlüssel](ruleset-combat.md#every-key) auf der Kampfseite). `when: "critical"` fügt sie nur bei einem kritischen Treffer zu; die Würfel jedes Bestandteils werden bei einem kritischen Treffer wie die der Waffe verdoppelt. Ein Blitzwurfspeer ist `{ "dice": "4d6", "type": "lightning" }`, ein Drachentöter `{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }`, ein Schwert der Schärfe `{ "flat": 14, "type": "slashing", "when": "critical" }`. Eine Vorhersage zählt einen Bestandteil nur gegen ein Ziel, das er erreicht, und nie einen, der nur bei kritischen Treffern gilt. `when: "toggled"` fügt ihn nur zu, solange der Schalter des Gegenstands eingeschaltet ist (Capability API 1.170, siehe unten `toggle`).

Die Details der Waffe und die Zeile für den Game Master nennen alles davon: `modes Volley (2 shots, -2 to hit, up to 2 targets)`, `off hand (Quick)`, `at least 1 on a hit before resistance`, `+3d6 slashing against Dragon` und `Marked for 2 rounds when a hit deals 2 or more`.

<a id="armor-and-worn-effects-in-a-fight"></a>

## Rüstung und getragene Wirkungen im Kampf

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

## Gegenstände im Kampf nutzen

Ein Gegenstand kann im Kampf genutzt werden (Capability API 1.59): ein auf eine Schnittwunde gedrückter Umschlag, ein geschluckter Trank, eine geläutete Glocke. Sein `use` beschreibt, was die Nutzung bewirkt, in den Begriffen, die der `mechanics`-Block eines Katalogeintrags verwendet (siehe [Was ein Kampf aus `mechanics` liest](ruleset-combat.md#what-a-fight-reads-from-mechanics)): `kind` (`heal`, `attack`, `buff` oder `debuff`), `amount`, `damageType`, `plus`, `attackRoll`, `save`, `applies`, `temporary`, `range`, `area`, `targets`, `targetCount`, `friendlyFire` und seit Capability API 1.174 `concentration` und `zone`, mit dem `budget`, das sie verbraucht, oder `free`. Der Umschlag aus Ember Roads sowie der wärmende Trank und die Morgenglocke aus Gravewatch:

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

## Gegenstände in Classic- und Tactical-Kämpfen

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

<a id="loot"></a>

## Beute

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
- Eine Bestiariumkreatur nennt mit `loot` die Tabelle, die sie trägt (siehe [Kreaturen](ruleset-combat.md#creatures-a-bestiary-a-fight-reads)). Ein gewonnener Regelsatzkampf würfelt die Tabelle jeder besiegten Kreatur. Ein Kampf, den die Engine nicht nach deinen Regeln auflöst, hat keine Bestiariumkreaturen und lässt daher nichts fallen.
- Was fällt, kommt wie ein Hinzufügen in die gemeinsame Ansicht, wobei zuerst die Tasche des Spielers gefragt wird, und was niemand tragen kann, bleibt zurück. Die Zusammenfassung für den Game Master nennt, was gefallen ist und dass es schon in den Taschen liegt, das Journal sagt das, und eine Benachrichtigung zeigt es an.
- Der Game Master würfelt eine Tabelle in der Geschichte mit `[loot: table="grave_goods" who="Ada"]` (`who=` für die Tasche eines einzelnen Charakters), gemessen ab dem Beginn des Zuges wie seine Inventar-Tags, sodass eine neu generierte Antwort nur einmal Beute fallen lässt. Jeder fallende Gegenstand wird wie ein Hinzufügen beantwortet, und seine Anweisungen listen deine Tabellen auf.

## Geld

Deine `currencies` sind das Geld der Gruppe. Eine Münze ist ein Gegenstand in den Taschen, ein Stapel jeder Münze wie jeder andere, benannt nach ihrem `label`:

- Sie wiegt je `perWeight` Münzen ihrer Familie eine Einheit deines Traglastwerts, zählt zur Last ihres Trägers und wird beim Eingang nach der Tragregel verteilt. Eine Familie ohne `perWeight` wiegt nichts.
- Der Spieler fügt Münzen über die Liste **Coins** (Münzen) der Auswahl hinzu und teilt, gibt und führt sie zusammen wie jeden Stapel.
- Eine Zeile über den Stapeln des Inventars zeigt die sichtbaren Münzen jeder Familie und ihren Wert in der kleinsten Münze der Familie. Der Game Master sieht diesen Wert neben jeder Tasche (`Coin worth 432 pennies` oder `no coins` für einen leeren Geldbeutel, wobei die Tasche des Spielers auch dann aufgeführt wird, wenn sie nichts enthält) und die `cost` eines Gegenstands neben dem Gegenstand (`costs 3 shillings`).
- Der Game Master bezahlt mit `[inventory: action="pay" amount="3 shillings" who="Ada"]` und wird mit `action="earn"` bezahlt. `amount` ist eine Anzahl und eine Münze, per ID oder Beschriftung, Einzahl oder Mehrzahl, ohne Beachtung der Groß- und Kleinschreibung (`1 penny`, `12 pennies`). Eine Zahlung kommt aus einer einzigen Tasche (ohne `who=` aus der des Spielers) und nur in der eigenen Familie der Münze: Zuerst gehen die größten passenden Münzen, dann wird die kleinste verbleibende Münze gewechselt, die den Restbetrag deckt, und das Wechselgeld kommt in den kleineren Münzen der Familie zurück, die größten zuerst. Die Antwort nennt, was bezahlt wurde und was zurückkam: 3 shillings aus einem Geldbeutel mit einer einzigen crown ergeben `Paid with crowns ×1; shillings ×2 back.` Eine Zahlung, die die Tasche nicht leisten kann, wird abgelehnt (`cannot-afford`), ebenso eine Münze, die du nicht hast (`unknown-coin`), und jede Zahlung in einem Regelsatz ohne Währungen (`no-currencies`). Ein Verdienst ist ein Hinzufügen dieser Münze, in die Tasche von `who` oder nach der Tragregel verteilt. Das Journal listet Ausgaben und Einnahmen auf, und eine Benachrichtigung zeigt sie an. Die Anweisungen des Game Master listen deine Münzen auf; diese Befehle erhält nur ein Regelsatz mit Münzen.
- Kaufen ist eine Zahlung und anschließend ein Hinzufügen oder, in einem Regelsatz mit Markt, ein `buy` (siehe unten). Einen Ladenbildschirm gibt es nicht.

## Startausrüstung

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

## Märkte

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

### Ein Markttag

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

### Ehrliche und unehrliche Händler

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

<a id="spotting-fakes"></a>

### Fälschungen erkennen

Mit Capability API 1.802 kann ein Charakter eine Fälschung als solche erkennen, durch eine Probe oder dadurch, dass er sie bemerkt, bevor jemand bezahlt. Die Engine kennt keine der Proben beim Namen: Der Regelsatz legt sie fest.

```json
{
  "id": "potion-of-poison",
  "label": "Potion of Poison",
  "item": {
    "category": "potion",
    "passesFor": "magic_items/potion-of-healing",
    "tells": [
      {
        "check": { "value": { "derived": "poisoners_kit_check" } },
        "dc": 13,
        "carries": { "anyOf": ["gear/poisoners-kit"] },
        "says": "a faint bitterness under the sweetness"
      },
      { "check": { "skill": "arcana" }, "dc": 18, "says": "its magic does not feel like healing magic" }
    ],
    "foolsReveal": ["identify"]
  }
}
```

```json
"items": {
  "namesItAt": 5,
  "revealsFakes": [{ "id": "identify", "label": "Identify" }, { "id": "detect-poison", "label": "Detect Poison and Disease", "items": ["magic_items/potion-of-poison"] }],
  "market": { "sellers": [
    { "id": "fence", "label": "Fence", "honest": false, "sells": [{ "tag": "magical" }],
      "manner": { "check": { "skill": "insight" }, "dc": 13, "advantageIf": [{ "value": { "derived": "knows_trade" }, "atLeast": 1 }], "says": "their eyes slide away when you ask about it" } }
  ] }
}
```

- **`tells`** an einer Fälschung (bis zu sechs): jeweils eine Probe, die jeder ablegen darf (`check` ist eine Fertigkeit, ein Attribut oder ein Wert vom Bogen, so wie das `gate` einer Nutzung eines davon nennt), ihre Schwierigkeit `dc` und das, was ein Erfolg erkennen lässt (`says`). `needs` gibt an, was der Charakterbogen erfüllen muss, damit die Probe überhaupt möglich ist (mit `needsAny` genügt eine der Anforderungen), und `carries` einen Gegenstand, den der Prüfende in seiner eigenen Tasche haben muss, etwa das Werkzeugset für eine Werkzeugprobe. Ist auch nur eine Zeile von `advantageIf` erfüllt, wird mit Vorteil gewürfelt, bei auch nur einer von `disadvantageIf` mit Nachteil.
- **`manner`** an einem unehrlichen Händler: eine Probe mit denselben Bestandteilen, die sich auf den Händler statt auf den Gegenstand bezieht. Ein Erfolg verrät, dass etwas mit seiner Ware nicht stimmt, aber nie, was es ist.
- **Untersuchen**: `[inventory: action="inspect" item="Potion of Healing" who="Mira"]` untersucht einen Gegenstand in Miras Tasche, und `seller="Fence"` untersucht eine Ware, die ein Händler hier heute anbietet, bevor jemand sie kauft. Die Schaltfläche **Inspect** (Untersuchen) im Inventar, die ein Regelsatz anbietet, dessen Fälschungen sich erkennen lassen, sagt „Ich sehe mir meinen Potion of Healing genau an, bevor ich ihm vertraue.“, damit der Game Master den Tag schreibt. Die Engine würfelt mit den eigenen Würfeln des Regelsatzes die beste Probe, die der Charakter dazu ablegen kann: auf die verräterischen Merkmale einer Fälschung und das Verhalten eines unehrlichen Händlers. Ein Erfolg bei einer Fälschung macht sie verdächtig: Die Antwort sagt, was der Charakter gesehen hat, und die Tasche zeigt „Mira hält es für eine Fälschung“, während der Gegenstand weiterhin so heißt wie der, für den er sich ausgibt. Ein Erfolg bei einem verräterischen Merkmal um mindestens `items.namesItAt` (5 in 5e) benennt sie auch, und von da an ist sie ihr wahrer Gegenstand. Bei einem echten Gegenstand werden die Proben auf die verräterischen Merkmale der Fälschungen gewürfelt, die sich für ihn ausgeben, damit die Nachfrage nichts verrät; ein Erfolg sagt, dass er echt aussieht. Jeder Charakter hat pro Gegenstand einen Versuch (ein Stapel merkt sich, wer schon einen unternommen hat; bei einer Ware wird es für den Markttag gespeichert); ein Misserfolg sagt, dass der Charakter es nicht beurteilen kann. Ein Gegenstand, den nichts verraten könnte oder den ein Charakter überhaupt nicht prüfen kann, wird mit `nothing-to-check` abgelehnt, und der Versuch wird nicht verbraucht.
- **Bemerken vor einem Kauf**: Würde ein Kauf bei einem unehrlichen Händler eine Fälschung ergeben, wertet jedes andere Gruppenmitglied jede Probe aus, die es dazu und zum Händler ablegen kann, ohne Würfel: `items.passiveBase` (standardmäßig 10) und sein Wert, 5 mehr mit Vorteil und 5 weniger mit Nachteil. Wer zuerst eine Schwierigkeit erreicht, hat etwas bemerkt: Es wird nichts bezahlt, und der Kauf wird mit `reason="held"` beantwortet, zusammen mit der Angabe, wer was bemerkt hat. Der Game Master wird gebeten, auszuspielen, wie dieser Gefährte den Käufer in seiner Rolle warnt, ohne den Händler direkt zu beschuldigen, sofern die Persönlichkeit des Gefährten das nicht nahelegt, und den Käufer entscheiden zu lassen. Dem Spieler wird nichts Weiteres mitgeteilt. Wird derselbe Kauf bei diesem Händler an diesem Tag erneut angefragt, wird er ausgeführt. `items.warnBy: "roll"` würfelt diese Proben stattdessen.
- **Fälschungen durchschauen**: `items.revealsFakes` listet die Methoden auf, mit denen ein Charakter Fälschungen durchschauen kann und die er auf einen Gegenstand wirken darf (einen Zauber, ein Ritual), jeweils mit einer `id`, ihrer `label` und, bei einer Methode, die nur manche Fälschungen durchschaut, deren `tags` oder den Fälschungen selbst per Verweis (`items`, wo nur Fälschungen erlaubt sind). Die Fälschungen zu nennen erspart ihnen einen verräterischen Tag: Ein Gifttrank mit dem Tag „poison“ würde sich neben dem Heiltrank verraten, für den er sich ausgibt. `[inventory: action="inspect" item="Potion of Healing" who="Mira" with="Identify"]` nennt eine solche Methode: Eine Fälschung, die sie durchschaut, wird benannt; eine, deren `foolsReveal` die Methode aufführt, erscheint als das, wofür sie sich ausgibt; und eine Fälschung, die sie nicht durchschauen kann, oder ein echter Gegenstand zeigt nichts („genuine“ bei einer Methode, die jede Fälschung durchschaut, sonst „unsure“). Das verbraucht keinen Versuch; welche Kosten das Wirken hat, liegt wie bei jedem Zauber beim Game Master.
- Ein Regelsatz, der etwas davon nutzt, braucht Capability API 1.802. Bei der Installation werden abgelehnt: die Angaben `tells` oder `foolsReveal` einer Fälschung an einem Gegenstand, der keine Fälschung ist; ein Gegenstand unter `carries` oder `revealsFakes`, der nicht zu denen des Regelsatzes gehört (bei `items` muss es eine Fälschung sein); und eine `foolsReveal`-ID, die `revealsFakes` nicht aufführt.

<a id="using-items-outside-a-fight"></a>

## Gegenstände außerhalb eines Kampfes nutzen

Dasselbe `use` funktioniert auch außerhalb eines Kampfes (Capability API 1.60 für `restore`; der Rest braucht nichts Neues). Die Schaltfläche **Use** im Inventar bei einem deiner Gegenstände mit `use` und das `[inventory: action="use" item="Poultice" who="Juno"]` des Game Master bewirken beide mit den Würfeln der Engine, was der Gegenstand bei dem tut, der ihn mitführt:

- Eine Heilung gibt Gesundheit zurück: die Menge bei einem Gesundheitspool oder einer einfachen Gesundheitsleiste oder eine entfernte Markierung bei einer Wundleiste, wie eine Heilung im Kampf. `temporary`-Punkte kommen auf einen Gesundheitspool, `restore` gibt seinen Pool zurück, und jeder Zustand, den die Nutzung mit `applies` auferlegt, wird gesetzt, bis etwas ihn entfernt.
- Eine Nutzung, die schadet oder auf die andere Seite zielt (`kind` `attack` oder `debuff` oder `targets` `enemy`), trifft niemanden: Außerhalb eines Kampfes steht niemand auf dem Brett, den man treffen könnte. Der Gegenstand wird trotzdem genutzt, und der Game Master erfährt, was er bewirkt, damit er es erzählen kann.
- Sie nimmt ein Stück vom Stapel oder verbraucht seine Ladungen genau wie ein Kampf. Ein Gegenstand ohne verbleibende Nutzung oder einer, der einen Trageplatz belegt oder gebunden wird und nicht getragen wird, wird abgelehnt und ändert nichts. Bogen und Tasche werden gemeinsam geschrieben.
- Ein `gate` wird zuerst gewürfelt, wie eine Probe: mit den eigenen Würfeln des Regelsatzes und der Zahl vom Bogen, dem Wundabzug des Nutzers und dem, was seine Zustände und getragenen oder mitgeführten Gegenstände an dieser Probe bewirken. Eine misslungene Probe verbraucht den Gegenstand für nichts, und die Zeile sagt das („Ada nutzt Page of the vigil litany: Ward-Probe 1 gegen 2, misslungen; der Gegenstand ist umsonst verbraucht. Noch 1 übrig.“).

Was geschehen ist, steht in einer Zeile: „Juno nutzt Poultice: heilt 4 (Grit 6/11). Noch 1 übrig.“ Die Schaltfläche **Use** schickt sie dem Game Master in einem `[item_used]`-Block nach „I use my Poultice.“, den der Chat als Badge anzeigt. Das eigene Tag des Game Master wird damit beantwortet, gemessen ab dem Beginn des Zuges wie seine anderen Tags, sodass eine neu generierte Antwort einen Gegenstand nie zweimal nutzt. Ein Gegenstand ohne `use` oder in einem Spiel ohne Regelsatz wird weiterhin einfach genannt: „I use my rope.“
