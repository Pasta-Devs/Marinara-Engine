# Regelsatzebenen, Übersetzungen und Migrationen

Diese Seite gehört zu [Regelsätze für Game Mode schreiben](writing-rulesets.md). Hier geht es um Varianten, die ein Spieler für ein einzelnes Spiel einschaltet, Übersetzungen der Texte eines Regelsatzes und das Verschieben von Werten auf neue IDs, wenn sich ein Bogen ändert.

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

## Übersetzungen

**Übersetzungen** (Capability API 1.811). Die Anzeigetexte eines Regelsatzes in einer anderen Sprache bilden eine Übersetzung pro Sprache, benannt nach dem Sprachcode wie die eigenen Sprachpakete der Engine (`ru`, `pt-BR`, `zh-Hans`). Im offiziellen Agentenkatalog ist jede davon ein Sprachpaket neben der Regelsatzdatei (siehe unten). Eine Regelsatz-Paketdatei, die du teilst, kann sie stattdessen in sich tragen, eine Datei pro Sprache neben `ruleset.json`: `locales/<language>.json`, wie die anderen Dateien im Manifest aufgeführt. In beiden Fällen ist jede ein Lokalisierungskatalog für das Paket mit einem Abschnitt `ruleset`: Jeder Schlüssel ist ein Anzeigetext des Regelsatzes oder seiner Kataloge, Wort für Wort auf Englisch, und sein Wert ist dieser Text in der Sprache der Datei.

```json
{
  "_meta": { "locale": "ru", "direction": "ltr" },
  "package": { "name": "5e (SRD 5.1)" },
  "ruleset": { "Prone": "Лежащий", "Fire Bolt": "Огненный снаряд", "Goblin": "Гоблин" }
}
```

`_meta.locale` muss die Sprache sein, nach der die Datei benannt ist, und die Datei enthält `$schema`, `_meta`, `package` und `ruleset` und nichts anderes, jeden Wert als Text. Ein leer gelassener Text ist noch nicht übersetzt und erscheint auf Englisch; eine Datei ohne Abschnitt `ruleset` (der eigene englische Eintrag eines Pakets, `locales/en.json`) übersetzt nichts. Übersetzungen dienen nur der Anzeige: Die Regeln, die Charakterbogenbefehle und alles, was dem Game Master mitgeteilt wird, lesen weiterhin das Englische. Der Kampfbildschirm (Namen, Zustände, Aktionen, Zauber, das Protokoll und die Zugreihenfolge) zeigt jeden Text in der Sprache des Spielers, sofern die Übersetzung des Regelsatzes ihn enthält, zuerst aus der Datei dieser Sprache selbst und dann aus der Datei der Sprache, von der sie eine Variante ist (`pt` für `pt-BR`), und andernfalls auf Englisch; „Goblin 2“ zeigt die Übersetzung von „Goblin“ mit ihrer Zahl. Eine Paketdatei mit Übersetzungen braucht Capability API 1.811. Beim Import wird nur die Übersetzung in der Sprache behalten, auf die die Engine eingestellt ist (oder der Sprache, von der sie eine Variante ist), und der Rest verworfen; um den Regelsatz in einer anderen Sprache zu lesen, ändere die Sprache der Engine und importiere die Datei erneut, wodurch die behaltene Übersetzung ersetzt wird. Übersetzungen sind kein Teil der Version; ein erneuter Import derselben Version mit einer korrigierten Übersetzung ersetzt diese also ebenfalls, und eine Datei dieser Version ohne Übersetzung lässt die behaltene bestehen.

Ein Katalogregelsatz enthält nie `locales/<language>.json` in seiner Datei (einer, der dies tut, wird vor dem Herunterladen abgelehnt). Seine Übersetzungen sind Sprachpakete (Capability API 1.811): eine JSON-Datei pro Sprache, `<id>-<version>.<language>.json`, neben `<id>-<version>.ruleset.json` veröffentlicht und mit genau dem Inhalt einer `locales/<language>.json` (`_meta.locale` mit der Sprache, nach der sie benannt ist, sowie ein Abschnitt `ruleset`). Der Katalogeintrag führt sie neben seinem `artifact` auf:

```json
"locales": {
  "ru": {
    "url": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts/ember-roads-1.0.0.ru.json",
    "sha256": "<64 hex>",
    "bytes": 812345,
    "name": "Угольные дороги",
    "description": "<the store card's description in Russian>"
  }
}
```

Jedes Paket ist eine https-URL in derselben Form wie die des Artefakts, benannt nach seiner Version und Sprache, mit seinem sha256 und seiner Größe (höchstens 8 MB); ein Regelsatz führt höchstens 40 auf, nie `en` (das Englische ist der Regelsatz selbst), und sein Manifest deklariert Capability API 1.811. `name` und `description` sind die Texte der Store-Karte in dieser Sprache, sodass die Karte in der Sprache der Engine angezeigt wird, ohne das Paket abzurufen. Eine Installation ruft die Regelsatzdatei ab und dann nur das Paket in der Sprache, auf die die Engine eingestellt ist (oder der Sprache, von der sie eine Variante ist), prüft seine Größe, Prüfsumme und Sprache und behält es zusammen mit der installierten Version. Wenn sich die Sprache der Engine ändert (und jedes Mal, wenn darin eine Seite geöffnet wird), ruft jeder installierte Katalogregelsatz, der ein Paket in der neuen Sprache aufführt, dieses ab, und das Paket der alten Sprache wird entfernt. Ist ein Paket nicht verfügbar (offline, keines aufgeführt oder nicht die vom Katalog aufgeführte Datei), bleibt der Regelsatz auf Englisch; die nächste Installation oder Sprachänderung versucht es erneut. Ein Update behält die vorherige Version für einen Rollback, ohne ihr Paket: Nach einem Rollback ruft die nächste Sprachänderung das Paket dieser Version erneut ab, sofern der Katalog es noch aufführt.

## Werte auf neue IDs verschieben: `sheet.migrations`

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
- `setColumn` (Capability API 1.794): `{ "setColumn": { "list": "attacks", "where": { "name": ["Dagger", "Rapier"], "ability": ["str", "dex"] }, "column": "ability", "to": "finesse" } }` setzt in einer Liste den Wert einer Spalte für jede Zeile, bei der jede der `where`-Spalten einen der aufgeführten Werte enthält (Text wird ohne Beachtung der Groß- und Kleinschreibung und der Leerzeichen an seinen Enden abgeglichen; eine Zahl muss genau übereinstimmen). Nutze dies, um Zeilen zu korrigieren, die erstellt wurden, bevor dein Regelsatz es besser wusste, etwa Angriffszeilen, die vor der Einführung der Attributswahl einer Waffe erstellt wurden. Die Liste und jede genannte Spalte müssen auf dem Bogen vorhanden sein.
- Jeder andere Schritt für den Aufbau des Bogens kopiert: Der alte Wert bleibt, wo er war, damit eine ältere Version deines Regelsatzes den Bogen weiterhin so liest wie zuvor, und der Schritt überschreibt nie einen Wert, der bereits in seinem Ziel steht. `setColumn` ist der einzige Schritt, der überschreibt.
- Der Import lehnt ab: einen Eintrag auf oder über `sheet.version`, zwei Einträge aus derselben Version, einen Schritt, der in eine ID schreibt, die der Bogen nicht hat, einen doppelt aufgeführten Fall sowie ein `rename` oder `routeLive`, das aus einer ID liest, die der Bogen noch hat (eine verschobene ID wird nie wieder verwendet; das macht diese Schritte sicher für eine Wiederholung).
- Bögen werden bei jedem Lesen migriert, und die neue Form wird bei der nächsten Bearbeitung gespeichert. Der Live-Zustand hat keine eigene Version; `routeLive` läuft also bei jedem Lesen: Der alte Schlüssel wird verworfen, und sein Wert wird nur verschoben, solange der neue Schlüssel noch nicht vorhanden ist; ein seitdem ausgegebener oder bei einer Rast zurückgesetzter Wert wird also nie überschrieben. Wohin er ging, legt der erste Schreibvorgang nach dem Update fest: Ein später korrigierter Bogen (eine von Hand verschobene Klassenstufe) verschiebt ihn nicht erneut. Ein Kampf, der beim Eintreffen der neuen Version bereits läuft, endet wie bisher.
