# Leitfaden für Regelsatz-Autoren

In dieser Anleitung erfährst du, wie du einen Regelsatz für dein eigenes Tischrollenspiel in Game Mode planst, bevor du die Referenzseiten öffnest. Sie erklärt, wie die Bestandteile eines Regelsatzes zusammenpassen, welche Entscheidungen besonders wichtig sind und was wir bei der Umsetzung von 16 sehr unterschiedlichen Systemen gelernt haben. Die Referenz zu den einzelnen Schlüsseln beginnt unter [Regelsätze für Game Mode schreiben](../extending/writing-rulesets.md). Jeder Abschnitt unten verlinkt die Seite, die er zusammenfasst.

Ein Regelsatz ist eine JSON-Datei (oder ein Paket aus Dateien), die Marinara Engine erklärt, wie dein System funktioniert. Die Engine würfelt dann jede Probe, übernimmt jede Bogenänderung und kann ganze Kämpfe nach deinen Regeln ausführen. Ein Regelsatz enthält keinen Code. Du gestaltest ihn also, indem du Mechaniken ausfüllst, die die Engine bereits kennt. Für eine Mechanik, die sie nicht kennt, braucht es einen Funktionswunsch an die Engine.

Bei jedem Schlüssel unten steht die Capability-API-Minorversion, mit der er hinzukam. Ein Paket, das diesen Schlüssel nutzt, deklariert diese oder eine neuere Minorversion (siehe [Versionierung, Tests und Veröffentlichung](#versioning-testing-and-publishing)).

Zwei Begriffe lassen sich leicht verwechseln:

- **Classic und Tactical** sind _Kampfstile_: ein menügesteuerter Kampf mit vorderer und hinterer Reihe oder ein Kampf auf einem Brett. Jedes Spiel nutzt einen davon, mit oder ohne Regelsatz.
- **Marinaras eigene Regeln** verwendet ein Spiel, wenn es keinen Regelsatz hat. Ein Regelsatz ersetzt sie.

## Aufbau eines Regelsatzes

Ein Regelsatz ist eine JSON-Datei von höchstens 512 KB, die beim Import vollständig geprüft wird. Größere Regelsätze lagern ihre Kataloge in ein Paket aus. Kopiere zunächst das Beispiel, dessen Würfelmechanik deiner am nächsten kommt:

- [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json): 2d6 plus ein Wert.
- [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json): ein d10-Pool.
- Das vollständige [Paket für 5e (SRD 5.1)](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014) in Marinara-Agents.

Verweise deinen Editor mit einer `$schema`-Zeile auf das [JSON-Schema](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/extending/ruleset.schema.json), damit er automatisch vervollständigt und Tippfehler erkennt.

| Schlüssel | Inhalt | Referenz |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `id`, `version`, `name`, `edition`, `license` | Identität. `version` ist eine ganze Zahl, die bei jeder veröffentlichten Änderung erhöht wird | [Regelsätze schreiben](../extending/writing-rulesets.md) |
| `coverage` | Was der Regelsatz abdeckt (Proben, Kämpfe und so weiter) und die einzeilige Zusammenfassung im Einrichtungsassistenten | [Regelsätze schreiben](../extending/writing-rulesets.md) |
| `resolution` | Wie eine Probe gewürfelt wird: eine von fünf Arten, dazu Ergebnisbereiche, Ressourcenausgaben und Wiederholungswürfe | [Proben](../extending/ruleset-checks.md) |
| `sheet` | Attribute, Fertigkeiten, Felder, Listen, laufende Pools, Leisten, Zustände, Wundleisten, Abzüge, Migrationen | [Charakterbögen](../extending/ruleset-sheets.md) |
| `party`, `clocks` | Ein gemeinsamer Gruppenbogen (Crew, Schiff, Geschichtenpunkte) und Fortschrittsuhren | [Charakterbögen](../extending/ruleset-sheets.md) |
| `rests` | Was jede Rast wiederherstellt und entfernt | [Charakterbögen](../extending/ruleset-sheets.md) |
| `gm`, `gmReference` | Text für den Game Master, die Zusammenfassung pro Charakter, wer die Gegner spielt und eine Regelreferenz mit bis zu 16,000 Zeichen | [Charakterbögen](../extending/ruleset-sheets.md) |
| `catalogs` | Vorgefertigte Einträge (Zauber, Talente, Kreaturen), jeder mit einem optionalen `mechanics`-Block | [Kataloge](../extending/ruleset-catalogs.md), [Mechanik](../extending/ruleset-mechanics.md), [Charaktererstellung](../extending/ruleset-character-builder.md) |
| `items` | Kategorien, Waffen, Rüstungen, Munition, Beute, Geld, Startausrüstung, Märkte | [Gegenstände](../extending/ruleset-items.md) |
| `battle` | Stellt Marinaras eigenen Classic- und Tactical-Kämpfen die Zahlen deines Bogens bereit | [Kämpfe](../extending/ruleset-combat.md) |
| `combat` | Führt den gesamten Kampf nach deinen Regeln aus, mit Bestiarium, Brett, Reaktionen und vergleichenden Proben | [Kämpfe](../extending/ruleset-combat.md) |
| `layers` | Varianten, die ein Spieler für ein einzelnes Spiel einschaltet (Low magic, Hard winter) | [Ebenen und Übersetzungen](../extending/ruleset-layers-and-translations.md) |

**IDs.** Die Regelsatz-ID besteht aus Kleinbuchstaben, Ziffern und einzelnen Bindestrichen (`ember-roads`). IDs innerhalb des Bogens bestehen aus Kleinbuchstaben, Ziffern und Unterstrichen und beginnen mit einem Buchstaben (`grit_max`). Ändere IDs nach der Veröffentlichung nicht mehr, denn gespeicherte Charaktere, andere Regelsätze, die deine Kataloge übernehmen, und Experience-Overlays verweisen darauf.

**Text für Prompts.** Alles, was das Modell erreicht (Namen, Beschriftungen, Text für den Game Master), steht in einer einzigen Zeile, ohne eckige Klammern und ohne `{{` oder `}}`.

**Pakete.** Ein Regelsatz, der für eine einzelne Datei zu groß ist, wird als `<id>.ruleset.json` verteilt: ein Manifest samt `ruleset.json`, bis zu 12 Dateien `catalogs/<id>.json` mit jeweils 2 MB und bis zu 40 Übersetzungen, alles als Base64. ZIP-Dateien werden abgelehnt. Ein Regelsatz-Editor wie Pixelforge erstellt diese Datei für dich. Das Manifest deklariert die Capability-API-Minorversion, die dein Regelsatz braucht.

**Unter welchem Namen ein Regelsatz abgelegt wird.** Eine importierte Datei wird zu `local/<id>`, ein Regelsatz aus einem GitHub-Repository zu `<owner>/<id>`, und einer aus dem offiziellen Katalog behält seine reine ID. Zwei Autoren können jeweils einen `v20` veröffentlichen, ohne einander in die Quere zu kommen.

## Proben, Würfel und der Charakterbogen

Deine erste und wichtigste Entscheidung ist `resolution.kind`, denn sie bestimmt, wie alle weiteren Angaben ausgewertet werden. Der Game Master nennt nur eine Fertigkeit und eine Schwierigkeit. Die Engine würfelt, rechnet mit den Bogenwerten und teilt dem Modell das Ergebnis mit. Schreib deshalb niemals Text für den Game Master, der das Modell zum Rechnen auffordert.

| Art | Wie sie würfelt | Passende Systeme |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `dice-sum` | Würfel werfen, Bogenwerte addieren und eine Schwierigkeit erreichen oder übertreffen. Unterstützt werden eigene Würfelseiten, offene Wurfketten und explodierende Würfel | d20-Spiele, 2d6 plus Wert, Fate (4dF mit den Seiten −1/0/+1), Rolemaster |
| `dice-pool` | Eine vom Bogen vorgegebene Anzahl Würfel werfen und diejenigen zählen, die einen Zielwert erreichen. Der Zielwert kann vom Bogen kommen, pro Probe gelten und über- oder unterwürfelt werden | World of Darkness, Exalted, ähnliche Systeme wie Shadowrun, Lasers & Feelings |
| `dice-highest` | Einen Pool werfen und den höchsten Würfel ablesen oder die höchsten paar addieren. Unterstützt werden eine Regel für null Würfel und ein zweiter „dunkler“ Satz | Blades in the Dark und andere Forged-in-the-Dark-Spiele, Trophy Dark |
| `roll-against` | Auf oder unter (oder über) die Zahl vom Bogen würfeln | Call of Cthulhu, GURPS, BRP, X-aus-6 nach alter Schule |
| `symbol-pool` | Erzählwürfel zusammenstellen und aufwerten, gegnerische Symbole gegeneinander aufheben | Genesys und ähnliche Systeme |

Ergänze dann, was dein System braucht. Alles steht unter [Proben im Regelsatz](../extending/ruleset-checks.md):

- **Ergebnisbereiche** (`resolution.outcomes`, 1.135): zwei bis acht beschriftete Ergebnisse nach Erfolgsabstand oder Gesamtergebnis, etwa Erfolgsgrade, „Erfolg mit einem Preis“ oder schwierige und extreme Erfolge. Jeder Bereich kann eine Zeile enthalten, die dem Game Master erklärt, was er am Spieltisch bedeutet. Diese Funktion wurde bei den umgesetzten Systemen am häufigsten gebraucht.
- **Proben, die auf ihre eigene Art würfeln** (`resolution.overrides`, 1.140): einzelne Fertigkeiten mit anderen Würfeln, etwa Diebesfertigkeiten mit d100 und Open Doors mit d6 in einem d20-Spiel.
- **Ressourcen ausgeben, um einen Wurf zu ändern** (`resolution.spend`), und kostenlose Wiederholungswürfe (`resolution.reroll`): Willenskraft für einen Erfolg, Glück, Heldenpunkte. `perCheck` begrenzt, was ein einzelner Wurf kaufen kann, damit ein voller Pool keinen sicheren Erfolg kaufen kann.
- **Ein Talisman, der einen Wurf verändert**: Setze `mechanics.check` an den Katalogeintrag, den ein Charakter gewählt hat; bezahlt wird mit den eigenen Kosten dieses Eintrags.

**Was eine Probe noch nicht kann.** Vergleichende Pools (die Würfe zweier Beteiligter werden verglichen) und Summenpools mit einem Wildwürfel wie in OpenD6. Beide brauchen eine neue Auflösungsart innerhalb der Engine. Wenn dein System davon abhängt, öffne im Engine-Repository einen Funktionswunsch mit einigen durchgerechneten Würfen. Daraus werden die Tests.

**Der Charakterbogen** ([Charakterbögen im Regelsatz](../extending/ruleset-sheets.md)) enthält Attribute, Fertigkeiten, Felder, Listen und abgeleitete Werte sowie laufende Zustandsdaten, die die Engine während des Spiels verändert:

- **Pools** wie Trefferpunkte, Willenskraft, Essenz oder Zauberplätze, die durch Bogenbefehle und Rasten verbraucht und wiederhergestellt werden.
- **Leisten** wie Stress, Ruin oder XP, mit Auslösern, wenn sie sich füllen.
- **Wundleisten** für Gesundheit, die aus benannten Stufen oder nummerierten Kästchen statt einer Zahl besteht, mit Abzügen auf Würfe.
- **Live-Zustände** wie eine Gestalt, eine Haltung oder Anima, die Würfe verändern können, solange sie gelten.
- **Gruppenbogen und Uhren**: eine Crew, ein Schiff oder gemeinsame Geschichtenpunkte und Fortschrittsuhren mit 4, 6 oder 8 Segmenten.

Der Game Master ändert den Bogen durch Bogenbefehle, die ihm die Engine automatisch mit deinen eigenen IDs beibringt. Du erklärst sie also nicht in `gm.sheetGuidance`. Dauerhafte Entwicklung (XP, neue Punkte, Stufenaufstiege) nutzt Katalog-Bogenbefehle; siehe [Kataloge im Regelsatz](../extending/ruleset-catalogs.md).

**Charaktere erstellen.** Die [Charaktererstellung](../extending/ruleset-character-builder.md) führt einen Spieler durch Schritte, die du festlegst: Herkunft und Klasse, Werte (gewürfelt, gekauft oder zugewiesen), Ausbildungen, Zauber, Ausrüstung und Startgeld, mit Regelprüfungen und gemeinsamer Gruppenerstellung. Kataloge können mit `from` (1.220) den Katalog eines anderen installierten Regelsatzes übernehmen. So kann eine 5e-Variante die Kreaturen und Zauber des SRD wiederverwenden, statt sie zu kopieren.

**Text für den Game Master.** `gm.checkGuidance` und `gm.sheetGuidance` (jeweils 1,500 Zeichen) werden in jedem Zug gesendet, halte sie also knapp. `gm.worldGuidance` wird einmal gelesen, wenn die Welt erstellt wird („kein Schießpulver“, „Magie ist selten“). `gmReference` enthält bis zu 16,000 Zeichen ausführlicherer Regeln im stabilen System-Prompt. `gm.sheetSummary` wählt aus, was das Modell pro Charakter sieht, und alles darin kostet in jedem Zug Tokens. Formuliere alles selbst und kopiere keine Regelbuchtexte.

## Kämpfe

Ein Regelsatz beteiligt sich auf einer von drei Stufen am Kampf. Du kannst einfach anfangen und später mehr ausgestalten. Entscheide danach, wie stark die Eigenart deines Systems in seinen Kämpfen liegt.

| Umfang | Was du schreibst | Was im Kampf geschieht | Geeignet für |
| -------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Keiner | Kein `battle`- oder `combat`-Block | Marinaras eigener Classic- oder Tactical-Kampf erstellt die Kämpfer selbst. Der Bogen bleibt unberührt | Narrative Systeme, in denen Kämpfe erzählerisch ablaufen (Fate, Blades, Trophy) |
| Den Bogen bereitstellen | Ein `battle`-Block: Gesundheitspool, optionaler Energiepool, Zauberplätze, bis zu 8 Fertigkeitslisten | Marinaras Berechnungen und Würfel, aber die Gesundheit beginnt beim gleichen Anteil des Balkens wie auf dem Bogen, und das Ergebnis wird zurückgeschrieben | Einfache Systeme, in denen Folgen bestehen bleiben sollen |
| Eigene Regeln | Ein `combat`-Block | Deine Würfel lösen jeden Angriff, Rettungswurf und jede vergleichende Probe auf. Gegner stammen aus deinem Bestiarium oder deiner Bedrohungsskala, und alle Kosten werden sofort auf dem Bogen verbucht | Taktische Systeme mit vielen Detailregeln (5e, Pathfinder, Storyteller, Genesys) |

**Der `combat`-Block** legt die Parameter für eine von drei Arten fest, die die Engine kennt: `attack-vs-defense` (Würfel gegen einen Verteidigungswert), `dice-pool` (deine Pools, Erfolge zählen) oder `symbol-pool` (Erzählwürfel mit Ressourcenausgaben, 1.382). Die Grundlagen sind `health` (ein Pool, der heruntergezählt wird, eine Wundleiste, die markiert wird, oder eine gewöhnliche Leiste, die sich füllt, 1.383), `defense`, `initiative`, `attackRoll`, eine Aktionsökonomie unter `economy` und die Listen, aus denen `attacks` und `abilities` werden. Ein vollständiger kleiner Block umfasst ungefähr 25 Zeilen. Der Ember-Roads-Block unter [Kämpfe im Regelsatz](../extending/ruleset-combat.md#combat-a-fight-your-own-rules-resolve) ist eine gute Vorlage.

Ergänze über die Grundlagen hinaus, was dein System braucht:

- **Zustände**, mit Wirkungen aus einer geschlossenen Liste (Verteidigung, Angriffswürfe, Rettungswürfe, vergleichende Proben, Geschwindigkeit, maximale Gesundheit, verursachter und erlittener Schaden).
- **Rettungswürfe**, Konzentration, Sterberegeln und Reaktionen, die für bestimmte **Fenster** bereitgehalten werden (ein Eintrag kann auf `used`, `aimed`, `hit`, `harmed`, `falls` oder `turn-start` warten).
- **Vergleichende Proben** für Packen, Stoßen und Losreißen.
- **Kreaturen**: ein Bestiariumskatalog, den der Kampf liest, mit Werteblöcken, Aktionen, Sinnen und Zauberwirken. Eine **Bedrohungsskala** lässt den Game Master einen Gegner für einen einzelnen Kampf erfinden, und `combat.threat.budget` (1.803) erstellt Begegnungen mit einem Erfahrungspunktebudget pro Schwierigkeit.
- **Eintragsmechanik** an Katalogeinträgen: Flächenformen, bleibende Zonen, Wände, Beschwörungen, Kuren und Sinne. Siehe [Mechanik von Regelsatzeinträgen](../extending/ruleset-mechanics.md).

**Classic oder Tactical.** Deine eigenen Kämpfe erhalten nur dann ein Brett, wenn `combat` die Entfernung mit `distance` (`label`, `perCell`) deklariert und der Bogen oder die Kreaturen Bewegung vorgeben. Ohne diese Angaben spielt auch ein Tactical-Spiel deine Regeln im Kopfkino. Wenn deine Regeln von Positionen abhängen (Flächen, Reichweite, Flankieren), setze `"styles": ["tactical"]` (1.379), damit jedes Spiel mit deinem Regelsatz ein Brett hat.

**Kreaturengrafiken** sind von den Regeln getrennt: Ein [Kreaturenpaket](../extending/writing-creature-packs.md) (`.creatures.json`, am einfachsten in Pixelforge erstellt) zeichnet dein Bestiarium auf das Tactical-Brett, indem es Kreaturen-IDs zuordnet. Alles ohne Grafik behält einen Spielstein.

**Bekannte Grenzen** stehen unter [Noch nicht](../extending/ruleset-combat.md#not-yet). Bei den Umsetzungen betraf das am häufigsten vergleichende Verteidigungswürfe (Dodge und Fight Back, Parry und Block), Trefferzonen, Initiative pro Seite und Reaktionen auf Reaktionen. Der Game Master erzählt diese Dinge um den Kampf der Engine herum.

## Die Kampf-KI: Denkweisen, Temperamente und wer die Gegner spielt

Die Engine spielt jeden Gegner und KI-Begleiter, den niemand sonst steuert, ohne Modellaufruf pro Zug. Sie ist vom Regelsatz unabhängig: Wir haben sie mit Umsetzungen von Storyteller, Exalted, Systemen der alten Schule, Call of Cthulhu, GURPS und Genesys sowie 5e getestet. Sie funktioniert ohne die folgenden Schlüssel. Damit kämpfen deine Kreaturen jedoch ihrer Eigenart entsprechend. Alle stehen unter [Mechanik von Regelsatzeinträgen](../extending/ruleset-mechanics.md), das Design unter [Kampf-KI im Game Mode](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/game-combat-ai.md).

| Schlüssel | Was er steuert | API |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `mind` an einer Kreatur oder die an ein Attribut geknüpften Stufen in `combat.minds` | Wie überlegt sie vorgeht: `mindless`, `instinct`, `cunning`, `tactical`, `genius`. Bestien handeln standardmäßig instinktiv, Konstrukte und Schleime gedankenlos | 1.761 |
| `behavior.temperament` | Wie sie kämpft: reckless, cautious, opportunistic, protective, supportive, disciplined, cowardly, patient, methodical, coordinated | 1.763 |
| Nur für die Geschichte vergebene Temperamente | `fanatical` (verliert nie den Mut), `arrogant` (hält sich zurück, erhebt sich bei legendären Kreaturen in die Luft, wenn sie verlieren), `territorial`, `cruel`, `honourable` (bietet der Gruppe **Surrender** (Aufgeben) an), `hungry` (schleppt ein Opfer davon). Werden nie zufällig vergeben | 1.778 bis 1.784 |
| `behavior.role` | bruiser, bulwark, skirmisher, marksman, spellcaster, supporter, controller, `solo` (1.776). Wird aus ihren Fähigkeiten abgeleitet, wenn nicht angegeben | 1.763 |
| `behavior.targets`, `opens`, `pack`, `ambush` | Zielprioritäten, eine Eröffnungsaktion, Rudeltaktik, im Versteck warten | 1.763 |
| `behavior.shifts` | Ein Temperament, das sich bei schwerer Verwundung ändert, wenn ein Verbündeter oder der Anführer fällt oder wenn die Kreatur in die Enge getrieben wird | 1.779 |
| `combat.morale` | Wann und wie Gegner ihren Mut prüfen (2d6 unter einen Wert oder ein Rettungswurf) und wer sich ergibt | 1.762, 1.775 |
| `gm.opposition: "game-master"` | Der Game Master spielt jeden Gegner und wählt aus den zulässigen Optionen der Engine. Die Engine springt bei Bedarf ein | 1.774 |

`behavior` kann am gesamten `combat`-Block stehen, an einem Kreaturentyp oder an einem einzelnen Werteblock. Jede dieser Angaben überschreibt die vorherige. Beispiele aus dem SRD: ein Wolf `{"targets": ["wounded"], "pack": true}`, ein Goblin `{"temperament": "cowardly", "targets": ["weakest"]}`, ein Ghul `{"ambush": true}`.

**Für Kämpfe auf dem Brett braucht die KI** `combat.distance`, Bewegung (`combat.economy.movement` oder `speed` einer Kreatur), eine `range` an Fernkampfangriffen und Waffeneinträgen sowie eine `area` an allem, was eine Zone trifft. Ohne Reichweite funktioniert eine Pistole nur auf Armlänge. Ohne Flächen verteilt sich die KI nie über das Brett.

**Narrative Systeme.** Standardmäßig spielt die Engine gewöhnliche Gegner und der Game Master die Bosse. Bei einem System, dessen Gegenspiel über die Erzählung statt über Schaden funktioniert (Fate, Blades, Trophy, Lasers & Feelings), lässt `gm.opposition: "game-master"` das Modell jeden Gegner seiner Rolle entsprechend spielen. Das gilt nur, wenn der Spieler bei der Einrichtung „GM directs bosses“ eingeschaltet hat, denn damit stimmt er Modellaufrufen während der Kämpfe zu.

**Ohne Kampfblock** erhalten deine Spiele trotzdem Moral in Classic- und Tactical-Kämpfen: Jeder Gegner, der kein Boss ist und nicht gedankenlos handelt, bekommt anhand seiner Denkweise und seines Temperaments einen Wert von 2 bis 12. Denkende Gegner können sich ergeben. Der Autor einer Begegnung kann den `leader` einer Seite markieren.

**Temperament der Gruppe.** Jedes Gruppenmitglied erhält beim Spielstart anhand seiner **Description** (Beschreibung) ein Temperament. Dieses ändert sich nur aus Gründen der Geschichte bei der Nachbesprechung am Ende der Spielsitzung. KI-Begleiter kämpfen danach. Ein Regelsatz legt es nicht fest, aber dein Text für den Game Master kann darauf aufbauen.

## Ebenen, Overlays und Migrationen

Drei Mechanismen ändern einen Regelsatz, ohne ihn abzuspalten. Nutze eine Ebene für eine Variante, die der Spieler wählt, ein Overlay für Inhalte eines einzelnen Abenteuers und eine Migration, wenn du den Aufbau des Bogens änderst.

**Ebenen** (`layers`, bis zu 12) sind Schalter im Einrichtungsassistenten für neue Spiele und bleiben für die gesamte Dauer dieses Spiels festgelegt. Eine Ebene kann nur einschränken oder Text ergänzen, niemals Regeln hinzufügen:

- Anweisungen für den Game Master anhängen (`gm.guidance`, `gm.worldGuidance`; 4,000 Zeichen pro Ebene);
- Werte aus einem Aufzählungsfeld entfernen, die Schwierigkeitsskala ersetzen oder Katalogeinträge mit einem deklarierten Filter ausblenden;
- Münzen entfernen (1.64), Markthändler entfernen, Gegenstände als unverkäuflich markieren oder Beutetabellen austauschen (1.813);
- `conflicts` mit anderen Ebenen deklarieren.

Eine Ebene kann weder ein Feld, einen Wert, eine Fertigkeit, einen Pool, eine Rast, einen Händler oder eine Beutetabelle hinzufügen noch die Auflösungsart oder Kampfzahlen ändern. Charaktere behalten alles, was eine Ebene entfernt. Die Ebene **Low magic** des SRD ist ein gutes Vorbild: Zauber sind auf den 5. Grad begrenzt, Gegenstände oberhalb von ungewöhnlich sind seltener und normalerweise nicht im Handel, Kreaturen mit starker Magie werden aus Zufallsbegegnungen ausgeschlossen, und die Weltanweisungen bitten den Game Master zu erklären, warum Magie selten ist. Andere Autoren dürfen sie kopieren. Ebenen für den Regelsatz eines anderen Autors werden noch nicht unterstützt.

**Overlays** (1.355) lassen das Kartenpaket einer Experience Kreaturen, Zustände, Bogenzustände, Gegenstände und Leisten (1.367) zu deinem Regelsatz hinzufügen, solange diese Experience aktiv ist. Halte abenteuerspezifische Monster und Beute in einem Overlay statt im Basisregelsatz. Ein Overlay, das eine deiner IDs erneut verwendet oder nicht passt, wird vollständig verworfen. Auch deshalb sollten IDs stabil bleiben. Referenz: [Regelsatz-Overlays](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/optional-agent-packages.md#capability-api-1355-ruleset-overlays).

**Migrationen** (`sheet.migrations`, 1.77) legen fest, wie gespeicherte Charaktere übertragen werden, wenn du ein Feld umbenennst, eine einzelne Stufe in Stufen pro Klasse oder einen Pool aufteilst. Ergänzungen brauchen keine Migration. Erhöhe `sheet.version`, wenn sich der Aufbau des Bogens ändert. Referenz: [Ebenen, Übersetzungen und Migrationen](../extending/ruleset-layers-and-translations.md).

## Übersetzungen

Schreib den Regelsatz auf Englisch und liefere jede weitere Sprache als eigene Übersetzungsdatei aus (1.811). Übersetzungen betreffen nur die Anzeige: Regeln, Bogenbefehle und alles, was dem Game Master mitgeteilt wird, bleiben auf Englisch. Eine Übersetzung kann deshalb niemals ein Spiel beschädigen.

Die Schlüssel einer Übersetzung sind die wortgetreuen englischen Zeichenfolgen:

```json
{
  "_meta": { "locale": "ru", "direction": "ltr" },
  "package": { "name": "5e (SRD 5.1)" },
  "ruleset": { "Prone": "Лежащий", "Fire Bolt": "Огненный снаряд", "Goblin": "Гоблин" }
}
```

- Sprachcodes entsprechen denen der Engine (`ru`, `pt-BR`, `zh-Hans`). Eine fehlende oder leere Zeichenfolge wird auf Englisch angezeigt, und `pt-BR` greift zuerst auf `pt` zurück.
- **In einer geteilten Paketdatei** legst du sie unter `locales/<language>.json` ab, bis zu 40 mit jeweils 8 MB. Beim Import wird nur die aktuelle Sprache der Engine behalten. Zum Wechseln änderst du die Sprache und importierst erneut.
- **Im offiziellen Katalog** ist jede Sprache ein eigenes Paket, `<id>-<version>.<language>.json`, das unter `locales` im Katalogeintrag mit seiner URL, sha256, Größe sowie einem übersetzten Namen und einer Beschreibung für den Store aufgeführt wird. Die Engine lädt nur das Paket für ihre aktuelle Sprache herunter und tauscht es bei einem Sprachwechsel aus. Als alle 11 SRD-Sprachen in einer Datei ausgeliefert wurden, wuchs der Download von 7 MB auf 34 MB. Deshalb sind die Pakete getrennt.
- Eine korrigierte Übersetzung braucht keine neue `version`.

Das SRD-Paket liefert auf diese Weise 11 Sprachen aus und dient als Vorbild. Referenz: [Übersetzungen](../extending/ruleset-layers-and-translations.md#translations).

## Das Paket für 5e (SRD 5.1): ein vollständiges Beispiel

Das [Paket ruleset-5e-2014](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014) in Marinara-Agents nutzt fast jede Funktion dieser Seite. Schau dort nach, wenn du einen Schlüssel im tatsächlichen Einsatz sehen möchtest. Was du dir abschauen kannst:

- **Aufbau**: `ruleset.json` plus eine Datei pro Katalog unter `catalogs/` (Kreaturen, Zauber, magische Gegenstände und mehr), zusammengebaut zu einem `.ruleset.json`-Paket. Seine README und MODELING.md erklären, wie jede Regel abgebildet wurde.
- **Lizenzierung**: Urheberhinweis für CC BY 4.0 unter `license`, eine Zeile zur fehlenden Verbindung zum Rechteinhaber und keinerlei markenrechtlich geschützte Produktnamen.
- **Vollständige Kämpfe**: ein d20-Block mit `attack-vs-defense`, Budgets für Aktionen, Bonusaktionen und Reaktionen, Konzentration, Reaktionen wie Shield und Counterspell, einem Brett, einem vollständigen Bestiarium mit Denkweisen und Temperamenten sowie einem Begegnungsbudget.
- **Charaktererstellung**: Volk, Klasse, gewürfelte oder gekaufte Werte, Ausbildungen, Zauber und Startausrüstung.
- **Eine Ebene** (Low magic) und **11 Übersetzungen** als Pakete, die bei Bedarf geladen werden.
- **Stabile IDs**: Andere Regelsätze übernehmen seine Kreaturen und Zauber, deshalb ändern sich seine IDs nie.
- **Regressionstests** laufen bei jeder Änderung als eigene CI-Aufgabe.

Wenn dein System eine d20-Variante ist, erwäge, seine Kataloge mit `from` (1.220) zu übernehmen, statt sie zu kopieren.

## Ähnliche Systeme gestalten: Was wir aus den Umsetzungen gelernt haben

Wir haben 16 Systeme aus einer Community-Sammlung in dieses Format umgesetzt, von erzählerischen Spielen mit wenigen Regeln bis Rolemaster. Die wichtigste Erkenntnis: Ein Regelsatz wird hier durchgesetzt, nicht vorgeschlagen. Die Engine würfelt jede Probe und übernimmt jede Bogenänderung. Alles, was du mit „das regelt der GM“ abtust, bleibt also tatsächlich ungeregelt. Entscheide früh, was die Engine übernimmt und was der Game Master erzählt.

| Systemfamilie | Beispiele | Auflösung | Entscheidende Schlüssel | Dem Game Master überlassen |
| ------------------ | ----------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| d20- und d%-Systeme mit vielen Detailregeln | 5e, Pathfinder 2e, Rolemaster | `dice-sum` | Ergebnisbereiche für Erfolgsgrade; `openEnded` und `unmodified` für Rolemaster; `gmReference` für große Tabellen | Nicht kumulative Bonustypen bei Pathfinder; Rolemasters Tabellen für kritische Treffer jenseits der Ergebnisbereiche |
| Alte Schule | OSE | `dice-sum` | `resolution.overrides` für Diebesfertigkeiten (d100) und X-aus-6 (d6); 2d6 für Moral | Initiative pro Seite (wird als Einzelinitiative gespielt) |
| Unterwürfeln | Call of Cthulhu 7e, GURPS Lite | `roll-against` | `against`, Bonus- und Strafwürfel für `tens`, kritische Würfelseiten, schwierige und extreme Ergebnisbereiche | Vergleichende Würfe für Dodge, Fight Back, Parry; Trefferzonen bei GURPS |
| Storyteller-Pools | V20, W20, Exalted 3e, Exalted WoD | `dice-pool` | Wundleisten mit Abzügen, Live-Zustände (Gestalten, Anima), abweichende Regeln für 1er, die nichts aufheben, ein poolbasierter `combat`-Block | Disziplinen und Gaben mit Flächenwirkung, sofern sie nicht als Einträge verfasst sind |
| Forged in the Dark | Blades in the Dark, Trophy Dark | `dice-highest` | `keep`, `zeroDice`, ein `dark`-Würfelsatz, Ergebnisbereiche (6 / 4 bis 5 / 1 bis 3), Leisten mit `onFull`, Uhren, ein Gruppenbogen für die Crew | Kämpfe über `gm.opposition: "game-master"` |
| Pools mit Haltungen | Lasers & Feelings, ein eigenes Spiel | `dice-pool` | `target` vom Bogen gelesen, `stances` (darunter oder darüber), `exact` für einen genauen Treffer, ein Gruppenbogen für das Schiff | Kämpfe als Erzählung |
| Fate | Fate Core | `dice-sum` | Eigene Würfelseiten für 4dF, Ergebnisbereiche für Gleichstand und Erfolg mit Stil | Aspekte einsetzen und reizen als Erzählung; Kämpfe als Erzählung |
| Erzählwürfel | Genesys | `symbol-pool` | `combat.kind: "symbol-pool"` mit `symbols.spends`, Schadensminderung und Gesundheit auf einer sich füllenden Wounds-Leiste | Ressourcenausgaben bei Proben außerhalb von Kämpfen |

**Praktische Ratschläge aus diesen Umsetzungen:**

1. **Beginne mit den Würfeln, dann dem Bogen, dann dem Text für den Game Master.** Sorge dafür, dass eine Probe richtig würfelt, bevor du Kataloge oder Kämpfe ergänzt.
2. **Nutze Ergebnisbereiche überall dort, wo dein System sie hat.** Der `text` jedes Bereichs erklärt dem Modell, was am Spieltisch geschieht. Darauf kommt es bei narrativen Systemen an.
3. **Verzichte lieber auf einen Kampfblock, als einen nur halb passenden zu verwenden.** Ein narratives System spielt sich mit Marinaras eigenen Kämpfen (oder vom Game Master gespielten Gegnern) besser als mit einem Kampfblock, der seine Regeln nur halb abbildet.
4. **Wenn du Kämpfe definierst, gib ihnen die Grundlagen für das Brett**: `distance`, Bewegung, Reichweiten an Fernkampfwaffen und mindestens einen Flächenangriff. Bei jeder Umsetzung, die wir mit KI getestet haben, fehlte ein Teil davon. Die Kämpfe kamen dadurch zum Stillstand oder nutzten nie die Positionierung.
5. **Prüfe Bewegung im Verhältnis zu deinem Maßstab.** Bei 2 Metern pro Feld konnte eine Kreatur mit Geschwindigkeit 2 keine Hügel erklimmen, und Kämpfe kamen zum Stillstand.
6. **Notiere deine Quellen.** Führe für jeden Regelsatz eine Notizdatei, die jede Quellregel und ihre Umsetzung aufführt, besonders dort, wo du dich zwischen widersprüchlichen Auslegungen entschieden hast. Danach fragen Prüfer als Erstes.
7. **Wenn der Engine eine Mechanik tatsächlich fehlt**, überlasse sie in `gmReference` dem Game Master und öffne einen Funktionswunsch mit durchgerechneten Beispielen. Viele Funktionen dieser Seite (Ergebnisbereiche, `dice-highest`, `roll-against`, Kämpfe mit Symbolwürfeln, Uhren, Gruppenbögen) gibt es, weil sie für eine Umsetzung gebraucht wurden.

<a id="versioning-testing-and-publishing"></a>

## Versionierung, Tests und Veröffentlichung

**Zwei Versionsnummern sind wichtig.** Die `version` deines Regelsatzes ist eine ganze Zahl, die du bei jeder veröffentlichten Änderung erhöhst. Eine installierte Version wird nie überschrieben, und jedes Spiel bleibt an genau die Version gebunden, mit der es erstellt wurde. Deshalb ändern sich die Berechnungen einer laufenden Kampagne nie. Die Version der **Capability API** gibt an, welche Funktionen der Engine deine Datei braucht. Das Manifest eines Pakets deklariert `schemaVersion: 2` und `capabilityApi: { "major": 1, "minor": N }`, wobei N die höchste Minorversion aller verwendeten Schlüssel ist. So wird dein Regelsatz einer älteren Engine nie angeboten. Regelsätze im offiziellen Katalog brauchen mindestens 1.374. Eine einfache Datei, die du importierst, braucht keine solche Angabe, denn die Engine prüft sie beim Lesen.

**Der Ablauf beim Entwerfen.** Bearbeiten, `version` erhöhen, importieren, neues Spiel beginnen. Der Import derselben Version mit anderem Inhalt wird abgelehnt. Alte Versionen bleiben installiert, bis du den Regelsatz entfernst. Erhöhe `sheet.version`, wenn sich der Aufbau des Bogens ändert, und schreibe eine Migration, wenn Werte verschoben werden.

**Tests.**

- Nutze die `$schema`-Zeile, damit dein Editor Tippfehler und falsche Typen schon beim Schreiben erkennt.
- Importiere ihn: Schalte **Settings → Advanced → Danger Zone → Allow custom Agent imports** (Einstellungen → Erweitert → Gefahrenbereich → Import eigener Agenten erlauben) ein und nutze dann **Agents → Import agents → Game Mode ruleset** (Agenten → Agenten importieren → Regelsatz für Game Mode). Die Prüfung führt jedes Problem mit seinem Pfad auf, bevor etwas gespeichert wird, auch Namen, die auf nichts verweisen.
- Spiele einige Proben jeder deklarierten Art, einschließlich abweichender Regeln, Ressourcenausgaben und jedes Ergebnisbereichs. Das Protokoll zeigt die tatsächlichen Berechnungen.
- Wenn du einen `combat`-Block hast, kämpfe sowohl in Classic als auch in Tactical, mit KI-Begleitern und gegen Kreaturen jeder Denkweise. Achte auf Stillstand (niemand kann jemanden erreichen), Flächenschaden an Verbündeten und Gegner, die ihre besten Aktionen nie nutzen.
- Schalte jede Ebene ein und aus und wechsle die Sprache der Engine, wenn du Übersetzungen mitlieferst.
- Wenn eine Experience deinen Regelsatz durch ein Overlay ergänzt, meldet `POST /api/game/experience/check`, was nicht passt.
- Bitte einen Testspieler, der dein System nicht kennt, mit der Charaktererstellung einen Charakter anzulegen.

**Veröffentlichung.** Es gibt fünf Wege, beginnend mit dem einfachsten (Einzelheiten unter [Deinen Regelsatz teilen](../extending/writing-rulesets.md#sharing-your-ruleset)):

1. Verschicke die `.json`-Datei.
2. Verschicke ein `.ruleset.json`-Paket, das Kataloge und Übersetzungen enthält.
3. Lege ihn in einem öffentlichen GitHub-Repository unter `rulesets/` ab (höchstens 32 Dateien). Nutzer fügen das Repository als eigene Quelle hinzu, und der Regelsatz wird unter deinem GitHub-Namen abgelegt.
4. Schlage ihn mit einem Pull Request an [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) für den offiziellen Katalog vor, aufgebaut wie `ruleset-5e-2014`. Das ist für verbreitete Systeme mit geklärten Lizenzrechten gedacht.
5. Veröffentliche eine Experience, deren Kartenpaket deinen Regelsatz durch ein Overlay mit Abenteuerinhalten ergänzt.

**Lizenzierung.** Veröffentliche nur Regeltexte, die du teilen darfst. Viele Systeme haben ein offen lizenziertes Referenzdokument. Trage dessen SPDX-ID und den geforderten Urheberhinweis unter `license` ein. Ein Regelsatz braucht vor allem Namen und Zahlen. Formuliere deshalb den gesamten Text für den Game Master selbst.

### Bevor du ihn teilst

- [ ] IDs stehen endgültig fest und entsprechen den ID-Regeln.
- [ ] `license` enthält die SPDX-ID und den Urheberhinweis, und markenrechtlich geschützte Namen werden nicht ohne Erlaubnis verwendet.
- [ ] Jede Probenart, jede abweichende Regel, jede Ressourcenausgabe und jeder Ergebnisbereich wurden mindestens einmal im Spiel gewürfelt.
- [ ] `gm.checkGuidance` und `gm.sheetGuidance` sind kurz, fordern das Modell niemals zum Rechnen auf und sind selbst formuliert.
- [ ] Kämpfe wurden in jedem Stil gespielt, den dein Regelsatz erlaubt, oder `combat.styles` schränkt sie ein.
- [ ] Das Paketmanifest deklariert die richtige Capability-API-Minorversion.
- [ ] `version` wurde gegenüber der letzten Datei erhöht, die jemand anderes hat.
- [ ] Eine Notizdatei erklärt, wie jede Quellregel umgesetzt wurde.

## Weiterführende Anleitungen

- [Regelsätze für Game Mode schreiben](../extending/writing-rulesets.md)
- [Architektur von Game Mode](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/game-mode-architecture.md), um den Regelcode der Engine zu ändern
- [Kampf-KI im Game Mode](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/game-combat-ai.md)
- [Mit einem Regelsatz spielen](../game/rulesets.md)
