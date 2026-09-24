# Game Mode: Party und NPCs

In dieser Anleitung geht es um die Leute in der Game-Mode-Kampagne: um die Partymitglieder und um die NPCs (Nicht-Spieler-Charaktere), die der Game Master einführt. Du erfährst, wie du Charakterblätter der Party öffnest, bearbeitest oder neu generierst und wie du das Adventure Journal liest – inklusive der Ruf-Stufen von NPCs. Außerdem erklärt sie die zwei Game-Master-Modi.

Game Mode ist einer der Chat-Modi von Marinara Engine. Dahinter steckt ein Einzelspieler-RPG (Rollenspiel) mit einer KI als Game Master – kurz GM, also die KI, die das Spiel leitet. Einrichtung und Grundlagen stehen unter [Game Mode: Erste Schritte](getting-started.md).

## Die Party-Leiste

Die Party-Leiste zeigt die Charaktere, die mit dir reisen. Sie sitzt im oberen Bereich des Spielbildschirms.

Am Desktop ist sie eine waagerechte Reihe kleiner Charakter-Porträts. Auf dem Handy schrumpft die Leiste zu einem einzigen Avatar. Bei mehr als einem Partymitglied trägt dieser Avatar eine kleine Zahl mit der Anzahl. Tipp darauf, um die Liste der Partymitglieder zu öffnen. Gibt es nur ein Mitglied, öffnet ein Tippen direkt dessen Charakterblatt.

Mit der Party-Leiste kannst du Folgendes tun:

1. Klick oder tipp auf ein Porträt, um das Charakterblatt dieses Charakters zu öffnen.
2. Zeig am Desktop mit der Maus auf ein Porträt – dann erscheint eine kleine Schaltfläche **X**.
3. Klick auf das **X**, um den Charakter aus der Party zu entfernen.

Jeden Gefährten, den der Game Master angeworben hat, kannst du wieder entfernen – egal ob er bei der Einrichtung oder später in der Geschichte dazugestoßen ist. Deine eigene Persona ist der Charakter, den du spielst. Sie hat kein **X**, dich selbst kannst du also nicht aus der Party werfen.

## Charakterblätter

Ein Charakterblatt ist eine spielbezogene Übersicht zu einem Partymitglied. Es ist etwas anderes als die Charakterkarte. Der Game Master schreibt es aus dem Charakter und der aktuellen Geschichte.

Ein Klick auf das Porträt in der Party-Leiste öffnet das passende Blatt. Angezeigt werden alle diese Abschnitte, sofern sie Inhalt haben:

- **Attributes** (Attribute): Werte im Tabletop-Stil wie STR, DEX und CON, jeweils mit Modifikator.
- **Stats** (Statuswerte): Ressourcenbalken wie HP oder MP.
- **Abilities** (Fähigkeiten): was der Charakter kann.
- **Strengths** (Stärken) und **Weaknesses** (Schwächen): kurze Listen.
- **Details**: Zusatzangaben wie Skills, Weapon oder Faction.
- **Inventory** (Inventar): was der Charakter mit sich trägt.
- **Traits** (Merkmale): weitere eigene Felder.

Bei einem neuen Charakter steht dort womöglich „Character data will populate as the story progresses“ (die Daten kommen erst im Lauf der Geschichte dazu). Das Blatt füllt sich beim Spielen.

### Ein Blatt per KI neu generieren

Klick auf **Regenerate Sheet** (Blatt neu generieren), damit die KI das Charakterblatt neu schreibt. Grundlage sind der Charakter und der aktuelle Spielkontext. Das lohnt sich, wenn die Geschichte einen Charakter stark verändert hat.

### Ein Blatt von Hand bearbeiten

Klick auf **Edit Sheet** (Blatt bearbeiten), um selbst Hand anzulegen. Im Bearbeitungsmodus stellst du Folgendes ein:

- **Class** (Klasse) und eine kurze Beschreibung unter **Sheet Details** (Blatt-Details).
- **RPG Attributes** (RPG-Attribute): Schalte **Enable** (Aktivieren) ein, um Pools nach HP-Art und Attribute mitzuführen. Über **Add Pool** (Pool hinzufügen) kommt ein Balken dazu – mit Name, aktuellem Wert, Maximalwert und Farbe. Über **Add Attribute** (Attribut hinzufügen) fügst du einen Wert wie STR hinzu.
- **Abilities**, **Strengths** und **Weaknesses**: Mit **Add** (Hinzufügen) hängst du eine Zeile an.
- **Details**: Mit **Add Detail** (Detail hinzufügen) kommt eine beschriftete Angabe dazu.

Zum Schluss klickst du auf **Save Sheet** (Blatt speichern). **Cancel** (Abbrechen) verwirft die Änderungen.

<a id="the-ruleset-sheet"></a>

### Der Regelsatzbogen

In einem [Spiel mit Regelsatz](dice-and-skill-checks.md#games-that-use-a-ruleset) beginnt jeder Charakterbogen mit **Ruleset sheet** (Regelsatzbogen). Der Regelsatz bestimmt den Aufbau. Ohne Regelsatz erscheint dieser Bereich nicht.

- **Resources** zeigt aktuellen Wert und Maximum, etwa Gesundheit, Zauberplätze oder Klassenressourcen. Nutze Plus, Minus oder die direkte Eingabe. **Temp** bezeichnet einen temporären Puffer.
- **Tracks** sind begrenzte Zähler, etwa für Erschöpfung.
- **Wound tracks** (Wundleisten) sind Reihen von Kästchen für Systeme, die Schaden markieren statt zählen. Jedes nennt seine Verletzungsstufe und den Abzug auf Würfe. Wähle bei mehreren Schadensarten zuerst die Art und dann **Mark** (markieren) oder **Clear one** (eine Markierung entfernen). Auch das nächste freie Kästchen fügt eine Markierung hinzu, das letzte markierte entfernt eine; andere Kästchen reagieren nicht. Schwerere Verletzungen belegen das höhere Kästchen und schieben leichtere nach unten. Darunter stehen der wirksame Abzug und Schaden, der nicht mehr auf die Leiste passte. Wenn der Regelsatz es vorsieht, gilt der Abzug für Proben: Er entfernt Würfel aus einem Pool oder wird auf eine Würfelsumme angewendet. Die Würfelkarte nennt den angewendeten Wert.

- **Notes** sind kurze Notizen, etwa zur Konzentration.
- **Conditions** schaltet Zustände ein und aus.
- Rastschaltflächen stellen die im Regelsatz genannten Werte wieder her. Eine lange Rast in 5e (SRD 5.1) stellt Gesundheit, Zauberplätze und die Hälfte der Trefferwürfel wieder her, mindestens einen.
- Darunter stehen Attribute, ausgebildete Fertigkeiten und Rettungswürfe sowie ausgewählte Werte wie Rüstungsklasse.

Der GM kann Ressourcenverbrauch, Schaden, Heilung, Zustände und Rasten eintragen. Die Engine prüft jede Änderung. Unzulässige Änderungen, etwa ein Zauber ohne freien Platz, werden mit einem Hinweis vollständig abgelehnt.

Die Nutzung eines Katalogeintrags bezahlt den ganzen Preis und je eine Nutzung jedes zugehörigen Zeilenzählers. Ein Zauberplatz wird auf der angegebenen Stufe verbraucht. Der GM kann eine höhere Stufe verlangen; die Engine stuft nie selbst hoch. Fehlt irgendein Bestandteil, wird nichts verbraucht. Kostenlose Aktionen wie Zaubertricks werden nur erzählt. Stufenabhängige Maxima und attributabhängige Nutzungen werden beim Bearbeiten neu berechnet.

Der Zustand gehört zur Nachricht. Beim Wechsel der Antwortvariante oder Neugenerieren wird der Bogen auf den Stand vor der Runde zurückgesetzt, damit nichts doppelt verbraucht wird. **Edit sheet** bearbeitet Konfiguration, Listen, Ausbildung und Boni mit demselben Editor und denselben Katalogen wie die Karte, einschließlich schreibgeschützter Werte und **Review** für neue Texte. **Save sheet** speichert nur die Kopie dieses Spiels. Das separate **Edit Sheet** bearbeitet weiterhin den allgemeinen Bogen. Ein fehlendes oder zu altes Paket zeigt eine Warnung und sperrt Proben bis zur Wiederherstellung.

## Partymitglieder anwerben und entfernen

Wer zur Party gehört, entscheidet der Game Master im Lauf der Geschichte. Eine Schaltfläche zum manuellen Hinzufügen von Gefährten gibt es nicht. Stattdessen nimmt der GM Partymitglieder über die Erzählung auf oder schickt sie weg – je nachdem, was in der Szene passiert.

Willst du selbst einen Gefährten ziehen lassen, nutz das **X** in der Party-Leiste wie oben beschrieben. Die eigene Persona lässt sich so nicht entfernen.

## Das Adventure Journal

Das Adventure Journal (Abenteuer-Tagebuch) protokolliert die Kampagne fortlaufend. Es entsteht aus gespeicherten Spielereignissen und stammt nicht von der KI – deshalb bleibt es sachlich.

Klick in der oberen Werkzeugleiste auf die Schaltfläche **Session** (Sitzung) und wähl dann den Tab **Journal**. Es öffnet sich ein Journal-Panel mit diesen Tabs:

- **Timeline** (Zeitleiste): eine Liste der Ereignisse – gefundene Orte, Treffen mit NPCs, Kampfergebnisse, Quests und alles rund um Gegenstände.
- **NPCs**: die NPCs, denen du begegnet bist, mit Porträt und Ruf-Stufe (siehe unten).
- **Map** (Karte): eine schlichte Liste der Orte, die du entdeckt hast.
- **Items** (Gegenstände): ein Protokoll darüber, was du erhalten, benutzt, verloren oder abgelegt hast.
- **Library** (Bibliothek): Notizen und Bücher aus der Spielwelt, die der Game Master dir gezeigt hat – gespeichert zum Nachlesen.
- **Notes** (Notizen): dein eigener Notizblock für freien Text.

### Spielernotizen

Der Tab **Notes** ist dein persönlicher Notizblock. Links tippst du, rechts erscheint eine formatierte Vorschau. Ein Hinweis über dem Notizblock warnt: Game Master und Partymitglieder können die Notizen sehen. Alles, was du hier schreibst, kann also die Geschichte beeinflussen.

Kurz nachdem du zu tippen aufhörst, speichert Marinara die Notizen von allein. Währenddessen zeigt ein kleiner Hinweis **Saving...**, danach **Saved**.

## Ruf-Stufen von NPCs

Der Tab **NPCs** im Adventure Journal führt mit, wie jeder NPC zu dir steht. Zu jedem Eintrag gehören ein Porträt, ein Name und eine Ruf-Stufe.

Die Ruf-Stufe verschiebt sich mit deinem Verhalten in der Geschichte. Es gibt sieben Stufen, von der besten bis zur schlechtesten:

| Stufe | Bedeutung |
|---|---|
| **Devoted** | Tief mit dir verbunden |
| **Allied** | Starker Verbündeter |
| **Friendly** | Positiv gestimmt |
| **Neutral** | Ohne klare Haltung |
| **Unfriendly** | Negativ gestimmt |
| **Hostile** | Gegen dich gewandt |
| **Enemy** | Offener Gegner |

Eine Stufe erscheint erst, wenn sich der Ruf eines NPC vom Startwert weg bewegt hat. Ein brandneuer NPC mit unverändertem Ruf zeigt noch keine Stufe.

Ein NPC taucht in diesem Tab auf, sobald der Game Master ihn beschrieben, ihm einen Ruf gegeben oder eine Beziehungsnotiz festgehalten hat. Jede NPC-Zeile bietet außerdem diese Aktionen:

- Das Porträt des NPC hochladen oder ersetzen.
- Ein Porträt per KI generieren, sofern die Bildgenerierung aktiv ist.
- Den NPC aus dem Journal entfernen.

## Game-Master-Modi

Wer das Spiel leitet, legst du im Einrichtungsassistenten fest – im Schritt **Party** unter **Game Master Mode** (Game-Master-Modus). Zur Wahl stehen zwei Optionen:

- **Standalone GM**: der Standard. Marinara baut dir einen Game Master. Der Einrichtungsassistent beschreibt ihn als **A snarky narrator running the show**, also als schnippischen Erzähler, der die Fäden zieht. Eine Charakterkarte brauchst du dafür nicht.
- **Character GM**: Eine deiner eigenen Charakterkarten übernimmt den Game Master. Die Engine weist das Modell an, sich wie dieser Charakter zu verhalten und dabei weiter das Spiel zu leiten. Gut, wenn du eine bestimmte Erzählstimme willst.

Für das erste Spiel ist **Standalone GM** die richtige Wahl. Den Modus legst du beim Anlegen des Spiels fest. Die komplette Einrichtung Schritt für Schritt steht unter [Game Mode: Erste Schritte](getting-started.md).

## Verwandte Anleitungen

- [Game Mode: Erste Schritte](getting-started.md)
- [Game Mode: Sitzungen und Spielstände](sessions-and-saves.md)
