# Regelsätze für Game Mode schreiben

Ein Regelsatz erklärt Game Mode, wie ein Tischrollenspiel funktioniert: welche Würfel eine Probe wirft, was auf dem Charakterbogen steht, welche Ressourcen verbraucht werden und was eine Rast wiederherstellt. Dieser Leitfaden richtet sich an alle, die eigene Regelsätze schreiben und teilen möchten. Wenn du mit einem fremden Regelsatz spielen möchtest, beginne bei [Mit einem Regelsatz spielen](../game/rulesets.md).

Ein Regelsatz besteht aus einer JSON-Datei. Sie enthält Daten, keinen Code. Nichts darin wird ausgeführt; der Import kann daher keine Aktionen auf deinem Computer ausführen. Lies vor dem Import einer fremden Datei vor allem den Text für den Game Master sorgfältig: Er wird in jedem Spiel mit diesem Regelsatz an das Modell gesendet.

## Zuerst lesen: Was ein Regelsatz kann und was nicht

Ein Regelsatz kann nur eine Mechanik ausgestalten, die die Engine bereits kennt. Derzeit kennt die Engine fünf Arten, eine Probe aufzulösen. Deine Datei wählt eine davon mit `resolution.kind`:

- **`dice-sum`**: Würfel werfen, Zahlen vom Bogen addieren und einen Schwierigkeitswert erreichen oder übertreffen. Das deckt d20-Systeme, Systeme mit 2d6 plus Attribut und viele weitere ab.
- **`dice-pool`**: Die eigene Würfelanzahl des Charakters werfen und die Würfel zählen, die einen Zielwert erreichen. Das deckt Systeme ab, in denen ein Wert für eine Handvoll Würfel statt für einen Bonus steht.

- **`dice-highest`**: Einen Pool werfen und seinen höchsten Würfel ablesen oder seine höchsten paar Würfel addieren. Das deckt Blades in the Dark und Trophy Dark ab.
- **`roll-against`**: Auf oder unter (oder über) die Zahl vom Bogen würfeln. Das deckt Prozentfertigkeiten und GURPS-Proben ab.
- **`symbol-pool`**: Erzählwürfel zusammenstellen und aufwerten und dann gegnerische Symbole gegeneinander aufheben. Das deckt Genesys-Proben ab und seit Capability API 1.382 auch dessen Kämpfe.

Alle fünf werden unter [Auflösungsarten](ruleset-checks.md#resolution-kinds) vollständig beschrieben.

Eine Mechanik, die in keine dieser Formen passt, lässt sich nicht in einer Regelsatzdatei ausdrücken. Vergleichende Pools sind ein Beispiel. Jede solche Mechanik braucht eine neue Auflösungsart in der Engine, also einen Codebeitrag mit Tests statt einer JSON-Datei. Wenn dein System so etwas benötigt, öffne einen Funktionswunsch im Engine-Repository und beschreibe die Mechanik anhand einiger durchgerechneter Würfe. Diese Beispiele werden zu den Tests.

Game Mode kann einen Kampf nach den eigenen Kampfregeln von Marinara oder nach deinem Regelsatz auflösen. Ein optionaler `battle`-Block stellt Marinaras Kampfsystem die Zahlen deiner Charakterbögen bereit; siehe [Kämpfe](ruleset-combat.md#battles-lending-the-sheet-to-marinaras-combat). Ein optionaler `combat`-Block legt dagegen fest, wie der Regelsatz den Kampf auflöst; siehe [Kampfregeln](ruleset-combat.md#combat-a-fight-your-own-rules-resolve). Die Engine spielt diese Regeln bereits aus. Combat Preference (Kampfpräferenz) wählt die Darstellung Classic oder, wenn der Regelsatz Entfernungen definiert, ein Schlachtfeld in Tactical. Ein Regelsatz kann mit `combat.styles` einschränken, welche dieser Stile seine Spiele verwenden dürfen (siehe [Welche Stile ein Spiel verwenden darf](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)).

## Schnellstart

1. Kopiere die Beispieldatei, deren Würfelmechanik zu deinem System passt. [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json) ist ein kleines 2d6-System mit drei Werten. Es zeigt, dass das Format weder einen d20 noch sechs Attribute voraussetzt. [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json) ist ein kleiner Pool mit zehnseitigen Würfeln, drei Grundwerten und sechs Tätigkeiten. Ein vollständiges Beispiel findest du im offiziellen [Paket für 5e (SRD 5.1)](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014): Der Agent Organizer installiert dessen `ruleset.json` und `catalogs/`.
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

## Die Seiten dieses Leitfadens

Diese Seite erklärt, was ein Regelsatz ist, wie du einen anlegst und wie du ihn ausprobierst und teilst. Der restliche Leitfaden ist nach Themen aufgeteilt:

- [Proben im Regelsatz](ruleset-checks.md): Wie ein Regelsatz eine Probe oder einen Rettungswurf würfelt: die fünf Auflösungsarten, Ergebnisbereiche, Proben, die auf ihre eigene Art würfeln, und Ressourcenausgaben oder Talismane, die einen Wurf verändern
- [Charakterbögen im Regelsatz](ruleset-sheets.md): Was auf den Charakterbogen eines Regelsatzes gehört: Attribute, Fertigkeiten, Felder und Listen, Live-Zustände, Wundleisten, Abzüge, Rasten und der Text für den Game Master sowie der Gruppenbogen und Fortschrittsuhren
- [Kataloge im Regelsatz](ruleset-catalogs.md): Vorgefertigte Einträge, die der Bogeneditor in einer Auswahl anbietet: der Katalogkopf, Einträge, Werte, die der Regelsatz aktuell hält, Bogenbefehle und der Nutzungsbefehl
- [Mechanik von Regelsatzeinträgen](ruleset-mechanics.md): Was ein Katalogeintrag in Zahlen bewirkt: der `mechanics`-Block eines Eintrags, den Proben, Rasten und Kämpfe lesen
- [Charaktererstellung im Regelsatz](ruleset-character-builder.md): Der geführte Erstellungsassistent: einen Charakter schrittweise erstellen, von Volk und Klasse bis zu Werten, Ausbildungen, Zaubern und Ausrüstung
- [Gegenstände im Regelsatz](ruleset-items.md): Was eine Gruppe mit sich führt: Kategorien, Waffen, Rüstungen, Munition, Beute, Geld, Startausrüstung und Märkte
- [Kämpfe im Regelsatz](ruleset-combat.md): Wie ein Regelsatz an einem Kampf beteiligt ist: der `battle`-Block, der Marinaras Kampfsystem den Charakterbogen bereitstellt, und der `combat`-Block, der den gesamten Kampf nach den eigenen Regeln des Regelsatzes auflöst, mit dessen Bestiarium, Brett, Reaktionen und vergleichenden Proben
- [Regelsatzebenen, Übersetzungen und Migrationen](ruleset-layers-and-translations.md): Varianten, die ein Spieler für ein einzelnes Spiel einschaltet, Übersetzungen der Texte eines Regelsatzes und das Übertragen von Werten auf neue IDs, wenn sich ein Charakterbogen ändert

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

Das Manifest führt `ruleset.json` und jedes `catalogs/<id>.json` in `contributions.assets.paths` und in `files` auf, jeweils mit Größe und sha256. Ein Regelsatz-Editor wie Pixelforge erstellt eine solche Datei. **Import agents** → **Game Mode ruleset** nimmt die Datei an und zeigt dieselbe Prüfung wie für eine Regelsatzdatei, mit jedem Katalog und der Zahl seiner Einträge. Nichts darin ist komprimiert; sie enthält also nie mehr als ihre eigene Größe. Sie wird als Daten gelesen und nie als Paket installiert: Sie wird mit Begründung abgelehnt, wenn sie etwas anderes enthält (einen anderen Schlüssel, eine andere Datei, ein Dokument, das nicht striktes Base64 oder kein UTF-8-Text ist), wenn ihr Manifest mehr als das eines Regelsatzes ist (Code, Berechtigungen oder andere Beiträge), wenn eine Datei nicht die ist, die das Manifest aufführt, wenn ein `$comment` länger als 2,000 Zeichen ist oder `$schema` etwas anderes als das eigene Schema der Engine nennt oder wenn sich der Regelsatz oder ein Katalog nicht lesen lässt. Sie wird wie eine Regelsatzdatei als `local/<its id>` abgelegt, ist höchstens 132 MB groß und hat höchstens 12 Katalogdateien zu je 2 MB und 40 Übersetzungen zu je 8 MB (siehe unten). Eine Version umfasst ihren Regelsatz und ihre Kataloge zusammen; ein geänderter Katalog braucht also ebenfalls eine höhere `version`. Regelsatzpakete werden nicht als ZIP-Dateien angenommen.

**Über den offiziellen Agentenkatalog.** Ein im Katalog veröffentlichter Regelsatz ist eine Regelsatz-Paketdatei genau dieser Form, `<id>.ruleset.json`, niemals ein Paket-Zip (Capability API 1.374). Sein Manifest deklariert Capability API 1.374 oder neuer, sodass er einer älteren Engine nie angeboten wird. Die Engine liest ihn mit demselben Leseverfahren und denselben Prüfungen wie eine importierte Paketdatei, prüft ihn gegen das vom Katalog aufgeführte Manifest und installiert ihn wie jedes Katalogpaket. Ein Katalogregelsatz, dessen Artefakt ein Zip ist, wird abgelehnt, bevor etwas heruntergeladen wird; bereits installierte Regelsätze funktionieren weiter.

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

**Im offiziellen Katalog.** Ein verbreitetes System mit geklärten Lizenzrechten kann über **Agent Organizer** (Agentenverwaltung) allen angeboten werden. Dafür öffnest du einen Pull Request im Repository [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Das dortige Paket `ruleset-5e-2014` zeigt die Verzeichnisstruktur.

## Lizenzierung

Veröffentliche nur Regeltexte, die du teilen darfst. Viele Systeme bieten ein Referenzdokument unter einer offenen Lizenz an; daraus darfst du kopieren. Trage unter `license` die Lizenz-ID und den verlangten Urheberhinweis ein. Kopiere keine Texte aus nicht offen lizenzierten Regelbüchern. Ein Regelsatz braucht vor allem Namen und Zahlen. Den Text für den Game Master solltest du selbst formulieren.

## Fehlerbehebung

- **Der Import meldet einen unbekannten Namen.** Etwas in der Datei verweist auf eine nicht deklarierte ID, etwa eine Fertigkeit auf ein entferntes Attribut. Die Meldung nennt den Pfad zur betroffenen Zeile.
- **Der Import meldet eine bereits installierte Version mit anderem Inhalt.** Erhöhe `version` und importiere erneut.
- **Mein Regelsatz fehlt im Einrichtungsassistenten.** Prüfe, ob **Allow custom Agent imports** eingeschaltet ist. Solange der Schalter aus ist, werden importierte Regelsätze für neue Spiele ausgeblendet. Bereits damit erstellte Spiele funktionieren weiter.
- **Ein Spiel meldet seinen Regelsatz als fehlend.** Die genaue Version, mit der es erstellt wurde, ist nicht installiert. Importiere diese Dateiversion erneut.
