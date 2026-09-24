# Versionierte Kampfregelsätze: Implementierungsübergabe

> **Statushinweis vom 19. September 2026.** Der hier vorgesehene Adapter `5e-2014` entsteht als DATENGESTEUERTE Kampfart, nicht als systemspezifischer TypeScript-Adapter: Ein Regelsatz deklariert einen optionalen `combat`-Block; die Engine besitzt die zugehörige Auflösung ebenso wie die Auflösungsarten für Proben. Begründung, Architektur und Arbeitsschritte stehen in `game-rulesets-and-sheets-implementation.md`, Abschnitt Real ruleset combat; verfolgt wird die Arbeit in [Issue #6361](https://github.com/Pasta-Devs/Marinara-Engine/issues/6361). Der übrige Inhalt bleibt gültig: Traditional und sein angenommenes Geschwindigkeitsverhalten, der Produktvertrag, Schwierigkeit als Teil des Regelsatzes statt als Schadensmultiplikator, das gemeinsame servereigene Protokoll des Directors, Reaktions- und legendäre Aktionsfenster sowie Speicher-, UI- und Einführungsvertrag.
> Seit C3a ist die Kampfart ANGEBUNDEN: Sie läuft auf dem bestehenden Director-Protokoll als dritter `style` neben `classic` und `tactical`, mit derselben Revision, Idempotenz, Sperre und einem einzelnen Modellaufruf zur Kandidaten-ID-Auswahl. Seit C3b ist sie SICHTBAR: Ein Spiel mit `combat` verwendet die Classic-Oberfläche mit Menü und Begriffen des Regelsatzes sowie tatsächlicher Rechnung im Protokoll. Bögen werden während des Kampfes geschrieben, nicht erst danach.
> Seit C4a gibt es POSITIONEN: Mit `combat.distance` läuft der Kampf auf einem vom Tactical-System erzeugten Brett. Bewegung, Reichweite, Kreis-, Kegel- und Linienflächen, Sichtlinien, Deckung und Angriffe auf sich entfernende Gegner folgen den Regelsatzwerten; Gegner bewegen sich ebenfalls. Seit C4b ist dieses Brett SICHTBAR: Gelände, erreichbare Felder und Kosten, Weg, provozierte Gegner, wählbare Ziele und Flächenziele stammen aus der Serveransicht und verwenden die Entfernungseinheit des Regelsatzes. Reaktionen und Fenster für Spezialaktionen sind für C5 noch vorgesehen.
> Das Spielfeld wird seit C4b angezeigt. Seit C5a kann ein ZUG wie ein Tischrollenspielzug ablaufen: Ein Treffer trägt einen zweiten Schadensteil, ein Aktionsverbrauch kauft mehrere Angriffe, eine Fähigkeit kostet kein Budget, gibt eines zurück oder kauft eine Standardaktion mit einem anderen. Ein automatischer Zusatzeffekt kann beim ersten passenden Treffer eines Zeitraums greifen. Zustände können eigene Rettungswürfe verändern, alle Schadensarten halbieren, Angriffe oder Annäherung an den Verursacher verhindern, nur bei Sichtkontakt gelten oder bei dessen Ausfall enden.
> Seit C5b kann der Kampf ANGEHALTEN werden: Wer eine gegnerische Reichweite verlässt, hält an und der Gegner entscheidet über einen Angriff, statt ihn automatisch auszuführen. Zwischen zwei Akteuren werden alle Werteblöcke mit Spezialpunkten gefragt, ob sie eine eigene Aktion kaufen. Solange ein Fenster offen ist, bewegt sich nichts anderes; danach geht es genau an der angehaltenen Stelle weiter. Seit C5c benennt ein Katalogeintrag den ERWARTETEN MOMENT: `aimed` vor dem Auftreffen auf seinen Träger, wobei die Reaktion das Ereignis absagen kann, oder `harmed` nach einer Verletzung, mit Ziel auf den Verursacher. Bezahlt wird vor der Nachfrage; eine abgesagte Aktion findet nicht statt, bleibt aber bezahlt. Verkettung steht noch aus: Es gibt ein einzelnes Fenster statt eines Stapels; ein Konter kann daher nicht selbst gekontert werden.

Status: Implementierungsvorschlag vom 17. September 2026. Die KI-Überarbeitung implementiert diese Regelsätze nicht. Die Anforderung geschwindigkeitsbedingter Folgeangriffe für Traditional ist eine angenommene Produktentscheidung; Schwellenwerte und weitere Standardwerte unten sind Abstimmungsvorschläge. Implementiere auf dem aktuellen `staging`, nachdem du verwandte Arbeiten geprüft hast.

## Produktvertrag

Halte vier Entscheidungen unabhängig:

| Entscheidung | Was sie steuert | Beispiele |
| --- | --- | --- |
| Darstellung | Räumliche Informationen und Eingabe | Classic-Menüs; Tactical-Raster |
| Teilnahme | Wer kämpft | Gruppe; künftig Summoning |
| Regelsatz | Zulässige Aktionen, Ressourcen, Zugzeitpunkte, Auflösung | Traditional; ausdrücklich versioniertes 5e; V20 |
| Steuerung | Wer eine zulässige Aktion wählt | Spieler; lokale KI; GM-Bosse |

Ein Cautious Mage muss in beiden Darstellungen vorsichtig bleiben. Ein Regelsatzwechsel verändert seine Handlungsmöglichkeiten, nicht seine Persönlichkeit. Summoning ist ein Teilnahmesystem, keine dritte Regel-Engine; seine erste Darstellung kann ohne Raumbezug auskommen. Kein Modus darf Rasterentfernungen erfinden, wenn kein Positionsmodell existiert.

Zeige verständliche Beschreibungen in der Produktoberfläche. Vermeide Vergleiche mit anderen Spielen in der Traditional- oder Tactical-Beschreibung. Regelsätze, die bewusst nach einem implementierten System benannt sind, müssen die genaue unterstützte Ausgabe und den Umfang nennen.

### Schwierigkeit muss zum Regelsatz gehören

Die aktuellen gegnerischen Schadensmultiplikatoren der Engine (Casual 0,6, Normal 1, Hard 1,3, Brutal 1,6) sind ausschließlich für Traditional bestimmt. Prüfe sie bei alternativen Regelsätzen neu: 5e, V20 und spätere Adapter dürfen sie nicht automatisch übernehmen. Definiere die Schwierigkeit anhand des eigenen Begegnungs- und Auflösungsmodells jedes Regelsatzes. Trenne die Abstimmung gegnerischer KI-Entscheidungen von der rechnerischen Schadensskalierung. Ergänze eine Adapter-Regression, die belegt, dass ein alternativer Regelsatz nicht stillschweigend die Traditional-Tabelle anwendet. Dieser Hinweis benennt die bestehenden älteren Mechaniken nicht in einen implementierten Traditional-Regelsatz um.

## Aktueller Quellcode und Einschränkungen

- `packages/shared/src/types/game.ts`: `Combatant`, `CombatSkill`, Classic-Ergebnisse und Snapshots. Aktuelle Werte sind allgemeine Zahlen; `speed` ist weder ein Tabletop-Geschicklichkeitswert noch Bewegung in Fuß.
- `packages/server/src/services/game/combat.service.ts`: Classic würfelt die Initiative jede Runde, löst einen Befehl je Teilnehmer auf und nutzt allgemeine Schadensformeln. Ältere Spiele reichen den Zustand über den Client hin und zurück; neue Assistenten-Spiele nutzen das serverseitig verwaltete Aktionsprotokoll der Kampfsteuerung.
- `packages/shared/src/features/tactical-combat/{engine,math,types}.ts`: abwechselnde Gruppen-/Gegnerphasen, klassenabhängige Reichweite und aus Geschwindigkeit abgeleitete Bewegung, Konter, noch keine geschwindigkeitsbedingten Folgeangriffe.
- `packages/shared/src/features/combat-ai.ts` und Modusadapter: Prioritäten über verfügbare Aktionen. Gewöhnliche KI behält ihre Informationsgrenze; GM-Bosse erhalten Gruppenbögen/Ressourcen zur Vorhersage, aber keiner sieht künftige Würfe oder Spielerentscheidungen vor deren Erklärung.
- `packages/server/src/routes/combat-director.routes.ts` und `services/game/combat-director.service.ts`: versionierter maßgeblicher Begegnungszustand, Aktivierungszeiger, ausstehende Reaktionen, legendäre Budgets und Schutz vor doppelten/veralteten Antworten. Erweitere diesen Pfad angenommener Aktionen für Regelsatzadapter, statt ein zweites Protokoll zu erstellen. Aktuelle Counterspell-Chance, Zauberplatzkosten und Abbruchkosten sind allgemeine Engine-Regeln, keine 5e-Regeln.
- `packages/server/src/routes/game.routes.ts`: ältere Runden-/Start-/Aktionsvalidierung. `GameCombatUI`, `TacticalCombatUI` und `use-game.ts`: Eingaben, Vorschauen, angenommene Ergebnisse und Speicherung.
- `GameSurface.tsx`: Überführung generierter Baupläne in Laufzeitdaten und Kampf-Snapshots. `encounter.routes.ts`: Begegnungsgenerierungs-Prompt. `game-setup-share.ts`: wiederverwendbarer Einrichtungsimport/-export.

Benenne die heutige Schadensformel nicht in Traditional um, ohne das angenommene Geschwindigkeitsverhalten zu implementieren und zu prüfen. Bezeichne einen d20-Wurf zusammen mit aktuellen Engine-Werten nicht als 5e-konform.

## Minimale Architektur

Beginne mit einer geschlossenen Registrierung eingebauter, reiner TypeScript-Adapter. Ergänze weder eine Skriptsprache noch beliebig ausführbare Regelpakete. Nutze vorhandene Typen für zulässige Aktionen und Ergebnisse wieder; extrahiere eine gemeinsame Hilfsfunktion erst, wenn beide Aufrufer sie benötigen.

Speichere eine festgeschriebene Referenz an jeder neuen Begegnung:

```ts
type RulesetRef = {
  id: "engine-legacy" | "traditional" | "5e-2014" | "v20";
  version: number;
  options: Record<string, boolean | number | string>;
};
```

Jeder Adapter validiert sein eigenes geschlossenes Optionsschema, statt den Beispiel-Record uneingeschränkt anzunehmen. Füge eine Liste unterstützter Fähigkeiten hinzu: Bewegung, Konter, Zauberplätze, Blutverbrauch, Beschwörungen, Boss-Reaktionen. Lehne eine nicht unterstützte explizite Option mit einer hilfreichen Fehlermeldung ab. Fehlende Regelsatzdaten bedeuten `engine-legacy`, niemals automatische Migration zu Traditional.

Eine kleine Schnittstelle sollte Folgendes abdecken:

1. Einen regelspezifischen Charakterbogen validieren/normalisieren, ohne Umrechnungen zu erraten.
2. Eine Begegnung starten und die Reihenfolge einmal zum regelgemäß richtigen Zeitpunkt auswürfeln oder festlegen.
3. Eine Aktivierung beginnen: zulässige Budgets auffüllen, passende Statuszustände fortschreiben.
4. Zulässige Aktionen und optionale Reaktionen samt Zielmengen, Reichweite, Kosten und Zeitfenster aufzählen, einschließlich Passen.
5. Eine schreibgeschützte Vorschau erzeugen, ohne RNG zu verbrauchen.
6. Eine Aktionserklärung annehmen, ihre Ressourcenbindung erfassen und unterstützte Auslösefenster vor der Wirkungsauflösung bereitstellen.
7. Ausstehende Wirkungen/Reaktionen in geordnete Ereignisse und Ressourcenänderungen auflösen; Boss-Fenster zu Aktivierungsbeginn/nach Aktivierung nur bei Aktivierung bereitstellen.
8. Eine Runde beenden, wenn ihre Teilnehmer aufgebraucht sind; rundenbegrenzte Wirkungen einmal fortschreiben.

Derselbe Adapter versorgt Spielereingaben, gewöhnliche KI, GM-Auswahlmenüs und Vorschauen. Der GM darf keine endgültigen HP, erfundenen Fähigkeits-IDs, neue Zugreihenfolge oder kostenlosen Ressourcenänderungen liefern. Die Regelprüfung nutzt den angenommenen Zustand; Entscheidungskontexte zeigen die zur Steuerung und zum Zeitfenster passenden Informationen. GM-Bosse kennen Gruppenfähigkeiten, Zauberpunkte/-plätze, Abklingzeiten und nutzbares Inventar zur Bedrohungsvorhersage. Unbestätigte Auswahl und andere vorgemerkte Aktionen bleiben bis zu ihrer Erklärung privat. Eine Vorschau liefert Erwartungswerte, keine künftigen Würfelergebnisse.

Halte regelsatzspezifische Bögen in einer diskriminierten Union. Presse nicht alle Ressourcen in `mp`: MP, Zauberplatzzahlen, Blood Pool, Willpower, Ausgaben pro Runde und Nutzungen pro Rast haben unterschiedliche Bedeutungen. UI-Balken und Fähigkeitskosten lesen Beschreibungen vom gewählten Adapter. Speichere aktuelle und maximale Ressourcen getrennt; normalisiere Namen nur für die Anzeige, niemals als Ressourcenidentität.

## Traditional v1: angenommenes Geschwindigkeitsverhalten

**Jeder lebende berechtigte Teilnehmer erhält höchstens eine gewöhnliche Aktivierung und eine Kampferöffnung pro Runde. Ein geschwindigkeitsbedingter Folgeangriff ist ein weiterer Schlag innerhalb dieses Schlagabtauschs, keine weitere Aktivierung.**

Vorgeschlagene anfängliche Abstimmung:

| Regel | Vorgeschlagenes v1-Verhalten |
| --- | --- |
| Initiative | Absteigende effektive Geschwindigkeit, stabile Begegnungsreihenfolge bei Gleichstand; keine zusätzliche Aktivierung bei Gleichstand oder hoher Geschwindigkeit |
| Tactical-Ablauf | Gruppenphase vor Gegnerphase; der Spieler darf noch nicht aktivierte Gruppenmitglieder wählen, automatische Einheiten nutzen die Geschwindigkeitsreihenfolge |
| Classic-Ablauf | Gemeinsame absteigende Reihenfolge nach effektiver Geschwindigkeit; die UI sammelt manuelle Befehle, dann werden aktuelle zulässige Ziele an jedem Zugplatz aufgelöst |
| Bewegung | Explizites, von Geschwindigkeit unabhängiges Bewegungsbudget. Vorgeschlagener Standard: 4 Felder mit begrenzten Klassen-/Fähigkeitsanpassungen |
| Angriffsgeschwindigkeit | Effektive Geschwindigkeit nur mit ausdrücklich modellierten Abzügen/Boni; kein erfundenes Waffengewicht |
| Folgeangriffsschwelle | Angriffsgeschwindigkeit des Angreifers mindestens die des Verteidigers + 5; nur als validierte Regelsatzoption konfigurierbar |
| Berechtigte Aktion | Standardangriff oder ausdrücklich mit `allowsSpeedFollowUp` markierte Fähigkeit; für Fähigkeiten standardmäßig falsch |
| Schlagabtausch | Schlag des Initiators → zulässiger Konter des überlebenden Verteidigers → zulässiger Folgeangriff des überlebenden Initiators |
| Schnellerer Verteidiger | Ein zulässiger Konter in v1; ein Folgeangriff des Verteidigers ist eine getrennte Abstimmungsoption, standardmäßig aus |
| MP | Expliziter Vorrat und Kosten je Fähigkeit, einmal pro gewählter Fähigkeitsaktivierung abgezogen; Folgeangriffskosten muss die Fähigkeit festlegen |
| Bewegungsauffrischung | Einmal bei der nächsten gewöhnlichen Aktivierung; Konter/Folgeangriffe frischen sie niemals auf |

Die Schwelle 5 und die Reihenfolge des Schlagabtauschs sind Marinara-Vorschläge, kein Anspruch, die Regeln eines bestimmten Spiels nachzubilden. Gewünscht war, dass die schnellere angreifende Einheit zweimal zuschlägt; eine defensive Verdoppelung verlangt diese Anforderung nicht.

Prüfe zwischen Schlägen erneut Lebendstatus, Zielgültigkeit, Reichweite, handlungsverhindernde Zustände und verbleibende Budgets. Eine durch den Konter getötete Einheit kann nicht nachschlagen. Ein verfehlter erster Schlag verhindert für sich allein keinen geschwindigkeitsbedingten Folgeangriff. Ein besiegtes Ziel darf innerhalb desselben Schlagabtauschs nicht erneut getroffen oder stillschweigend ersetzt werden. Verhindere rekursive Konter auf Konter. Ein Konter verbraucht weder die gewöhnliche Kampferöffnung des Verteidigers noch gewährt er eine weitere. Heilung, Verstärkungen, Gegenstände, Beschwörungen und legendäre Aktionen verdoppeln sich nicht, außer eine ausdrücklich unterstützte Fähigkeit definiert diese Ausnahme.

Berechne die Berechtigung aus den angenommenen effektiven Werten zu Beginn des Schlagabtauschs; wende handlungsverhindernde Wirkungen innerhalb des Austauschs sofort an, füge aber nach einer Geschwindigkeitsverstärkung währenddessen nicht rückwirkend weitere Schläge hinzu. Schreibe das Ergebnis in die Ereignisliste; die Vorschau zeigt einen oder zwei Schläge und die Konterberechtigung. Neuladen während einer Animation spielt angenommene Ereignisse erneut ab und würfelt oder bezahlt niemals doppelt.

Classic hat keine Bewegungsreichweite: Lasse Bewegung weg oder definiere ein getrenntes Bindungsmodell. Traditional-Konter in Classic erfordern eine explizite `canCounter`-Regel; übertrage keine Rasterreichweitenprüfung auf Array-Positionen. Für v1 wird empfohlen, Classic-Konter bis zur Definition grundlegender Nah-/Fernkampfbindung abzuschalten, die geschwindigkeitsbedingten Folgeangriffe der angreifenden Einheit aber beizubehalten.

## 5e-Profil: Ausgabe vor dem Programmieren benennen

Empfohlenes erstes Ziel: `5e-2014`, festgeschrieben auf SRD 5.1. Ein späteres 2024-/SRD-5.2-Profil benötigt eine eigene Kennung/Version und Tests; vermische die Ausgaben nicht stillschweigend. Der offizielle [SRD-Index](https://www.dndbeyond.com/srd) veröffentlicht die Versionen, und [SRD 5.1](https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf) ist die Primärquelle für das erste Ziel.

Prüfe vor der Implementierung die Primärquelle: geschicklichkeitsbasierte Initiative; Bewegung als Entfernung; Verfügbarkeit von Aktion, Bonusaktion und Reaktion; Zauberplätze; Konzentration und Zustände; getrennte Angriffs- und Rettungswürfe. Dafür sind eigene Bogenfelder und Auflösungs-Testaufbauten nötig. Allgemeine Engine-Werte für Stufe/Angriff/Verteidigung ersetzen sie nicht. Zauberpunkte sind eine ausdrücklich gewählte Variante mit eigener geprüfter Quelle und Grenzen, kein umbenannter Zauberplatzvorrat.

Liefere zunächst eine ehrlich benannte Teilmenge aus, etwa einfache Waffenangriffe, Bewegung, Dodge und eine kleine unterstützte Zauberliste; nicht unterstützte Aktionen bleiben unverfügbar. Behaupte nicht aufgrund einer einzigen Initiativeformel einen vollständigen 5e-Regelsatz. Lasse die Traditional-Verdoppelung deaktiviert; zusätzliche Angriffe entstehen nur aus implementierten Profilfähigkeiten.

## V20-Profil: eigene Prüfung erforderlich

Ziel ist Vampire: The Masquerade 20th Anniversary Edition, nicht V5 oder V20 Dark Ages. Beschaffe die passende primäre Regelquelle, bevor du genaue Initiative, Erklärungsreihenfolge, Mehrfachaktionen, Celerity, Schaden/Schadensabsorption, Wundabzüge und Ressourcenausgabelimits programmierst. Diese Übergabe genehmigt keine konkrete V20-Formel.

Reserviere einen regelspezifischen Bogen für Attributes/Abilities, Gesundheitsstufen, Blood Pool und Willpower, gegebenenfalls mit Ausgabelimits je Zug. Wandle Blood Pool nicht in allgemeine MP und Celerity nicht in Traditional-Geschwindigkeitsverdoppelung um. Tests müssen die verwendete Ausgabe und Regelstelle nennen; eine Forenantwort oder Dark-Ages-Vorschau reicht nicht als Grundlage für modernes V20-Verhalten. Kläre Wiederverwendung und Quellenangabe anhand der tatsächlich gewählten Quelle, bevor du kopierte Texte oder Werteblöcke verteilst; dieses Dokument liefert solche Inhalte nicht.

## Legendäre Aktionen, Vorhersage und Reaktionen

Angenommene Richtung: GM-Bosse dürfen auch unter Traditional oder anderen Nicht-5e-Regelsätzen legendäre Aktionen besitzen. Das ist ein ausdrücklicher **Boss-Begegnungsmodifikator**, unabhängig von gewöhnlicher Initiative, Temperament und Teilnahme. Siehe den Boss-Abschnitt im KI-Designdokument.

Der Adapter stellt `afterActivation` bereit; ein aktivierter Marinara-Vorhersagemodifikator kann zusätzlich `activationStarted` bereitstellen, sobald eine Figur ihren Zugbeginn verbindlich bestätigt. Beide legendären Fenster verbrauchen **denselben** endlichen Boss-Vorrat. Bloße Klicks, Inspektion, abgebrochene Menüs und Neuladen öffnen keine weiteren Fenster. Der GM darf Fireball anhand verfügbarer Fähigkeiten/Ressourcen des Magiers und tatsächlicher Flächen-/Eigenbeschussregeln vorhersagen, bevor der Spieler einen Zauber erklärt; er darf keinen künftigen Befehl lesen. Diese Vorhersage ist eine auf die Begegnung festgeschriebene Hausregelerweiterung des 5e-Zeitpunkts nach dem Zug. Ein originalgetreues Profil behält seinen nativen Zeitpunkt, solange der Modifikator deaktiviert ist.

Traditionals Regel einer Kampferöffnung gilt für gewöhnliche Aktivierungen; eine verfasste legendäre Aktion gewährt weder eine gewöhnliche Aktivierung noch einen geschwindigkeitsbedingten Folgeangriff. Classic muss am Initiativeplatz der Figur anhalten, statt früh zu unterbrechen, während die UI noch Befehle für eine ganze Runde sammelt. Prüfe vorgemerkte Befehle nach einer Unterbrechung erneut und fordere Ersatz an, wenn sie vor der Bindung unzulässig werden. Tactical benötigt eine eigene verbindliche Bestätigung des Aktivierungsbeginns, damit das Durchsehen von Einheiten sicher ist und erneute Auswahl keine Unterbrechungen vervielfacht.

Reaktionen wie Counterspell gehören zu unterstützten **Ereignisauslösern**, unabhängig vom legendären Status. Definiere mindestens Auslöseereignis, Zeitpunkt vor/nach Wirkung, Sichtbarkeit/Reichweite, Ressourcenkosten, Reaktionsbudget/-auffrischung, Ergebnis sowie Abbruch-/Erstattungsverhalten der ursprünglichen Aktion. Boss-GM und gewöhnliche KI nutzen dieselben zulässigen Fenster; manuelle Einheiten erhalten React/Pass zur Auswahl. Die KI bewertet das Fenster automatisch und darf je nach Temperament, Bedrohungswert, Erfolgsschätzung, MP-/Zauberplatzknappheit und Kosten des Reaktionsverlusts passen. Verfügbarkeit allein erzwingt niemals Ausgaben. Eine gewöhnliche Einheit darf reagieren, ohne zum Boss zu werden.

Counterspell benötigt einen ausstehenden Zauber, nicht bloß einen ausgewählten Magier. Halte MP-/Punkte-/Zauberplatzressourcen getrennt. Der [Zauber von 2014](https://www.dndbeyond.com/spells/2051-counterspell) verwendet Zaubergrad-/Probenregeln; der [Zauber von 2024](https://www.dndbeyond.com/spells/2619072-counterspell) einen Konstitutionsrettungswurf und legt fest, dass ein erfolgreich unterbrochener Zauber mit Zauberplatzkosten seinen Platz nicht verbraucht. Übertrage die Erstattung des ursprünglichen Zaubers von 2024 nicht auf alle Ausgaben oder die Zahlung des reagierenden Zaubernden. Traditional benötigt eine ausdrücklich abgestimmte Unterbrechungsoperation; V20 sollte eigene reaktive Fähigkeiten abbilden, statt Counterspell dem Namen nach zu übernehmen.

Reserviere und verbuche Ressourcen atomar mit angenommenen Erklärungen/Reaktionen und erfasse regelspezifische Erstattungen getrennt. Vorgeschlagener Traditional-Standard: eine Reaktion, anfangs verfügbar, sofern keine ausdrückliche Begegnungsbedingung sie verhindert, aufgefüllt zu Beginn der gewöhnlichen Aktivierung der Einheit. Andere Adapter definieren ihre eigene Budget-/Auffrischungsgrenze. Legendäre Aktionen und Folgeangriffe frischen sie niemals implizit auf. Halte vorhandene Schlagabtauschkonter getrennt, sofern sie nicht ausdrücklich zugeordnet werden. Wirkt eine legendäre Option einen Zauber, stelle Zauberreaktionen nur im vom gewählten Regelsatz erlaubten Umfang bereit.

Nutze einen begrenzten gespeicherten Stapel ausstehender Aktionen mit Eltern-/Auslöser-IDs für unterstützte verschachtelte Reaktionen, stabiler Reaktionsreihenfolge und erneuter Validierung nach jeder Antwort. Ein bereits abgebrochener Zauber kann nicht erneut gekontert werden. Passen schließt die Gelegenheit dieser Einheit für diesen Auslöser. Ein eingeschränkter Adapter muss nicht unterstützte Gegenreaktionsketten offenlegen. Löse angenommene Ereignisse einmal auf und leite die Erzählung daraus ab; die umkehrbare Textunterbrechung in [PR #6110](https://github.com/Pasta-Devs/Marinara-Engine/pull/6110) ist ein Vorbild für Speicherung/Kontext, keine Erlaubnis, Kämpfe durch Abschneiden von Prosa zurückzusetzen. Den vollständigen Lebenszyklus und die Akzeptanzmatrix beschreibt Abschnitt 16 des KI-Designs.

## Vertrag für Speichern, UI und Einführung

- Schreibe Regelsatz-ID, Version, wirksame Optionen, Einheitensteuerungen, Bögen, Anfangsreihenfolge, aktuelle/festgeschriebene Aktivierung, legendäre/Reaktionsbudgets und Auffrischungspunkte, Stapel ausstehender Aktionen, Auslöser-/Entscheidungs-IDs, Ressourcenbindungen/-erstattungen, Abklingzeiten, RNG-Zustand und angenommene Unterbrechungsentscheidungen im Begegnungs-Snapshot fest.
- Verlange ein serverseitig verwaltetes Revisions-/Aktionsprotokoll vor asynchronen GM-Entscheidungen. Lehne veraltete gleichzeitige Einreichungen ab und mache Wiederholungen idempotent. Eine im Browser gespeicherte Kandidaten-ID genügt nicht.
- Geänderte Spieleinstellungen betreffen die nächste Begegnung. Bewahre die festgeschriebenen Regeln des aktiven Kampfes, auch nach Import, Checkpoint-/Zweigwiederherstellung, erneuter Verbindung und Update.
- Belasse alte laufende Kämpfe auf `engine-legacy`. Biete eine ausdrückliche Umwandlung für einen künftigen Kampf mit Vorschau nicht zugeordneter Werte/Ressourcen an; überschreibe niemals stillschweigend Bögen oder gespeicherte Vorräte.
- Unbekannte Regelversionen sind schreibgeschützt/wiederherstellbar und werden nicht stillschweigend als neueste Version interpretiert.
- Führe eine lokalisierte Auswahl **Combat rules** (Kampfregeln) getrennt von **Combat presentation** (Kampfdarstellung) und künftig **Participation** (Teilnahme) ein. Beschreibe Reihenfolge, Ressourcen und Kernverhalten kurz; zeige Kompatibilitätsgrenzen vor dem Start.
- Fordere fehlende Pflichtfelder des Bogens vor dem Kampf an; verwende ältere Regeln nur nach ausdrücklicher Auswahl. Lasse die Generierung keine maßgeblichen Charakterwerte erfinden.

## Implementierungsreihenfolge und Abschlussnachweise

| Schritt | Arbeit | Kleinster nützlicher Nachweis |
| --- | --- | --- |
| 1 | Vorhandene Auflöser erfassen, festgeschriebene Identität und Legacy-Adapter definieren | Alte Spielstände und beide aktuellen Darstellungen reproduzieren ihr bisheriges Verhalten |
| 2 | Traditional-Aktivierung/-Schlagabtausch und ausdrückliche Ressourcenabrechnung implementieren | Geschwindigkeitsgrenzmatrix; eine Kampferöffnung/Runde; MP- und Abklingzeitabrechnung |
| 3 | Vorschauen, UI-Auswahl und gespeicherte angenommene Ereignisse verbinden | Übereinstimmung von Vorschau/Auflösung; Neulade-/Import-/Checkpoint-Tests; Desktop-/Mobil-Screenshots |
| 4 | Erklärungs-/Wirkungsgrenzen, optionale Reaktionen, Boss-Vorhersage und Fenster nach dem Zug ergänzen | Keine Auswahlausbeutung oder Offenlegung künftiger Befehle; KI darf passen; korrekte Kosten/Auffrischung/Erstattung; kein zusätzlicher gewöhnlicher Zug und keine Verdoppelung |
| 5 | Eine benannte Teilmenge von 5e-2014 anhand von Primärquellen implementieren | Ausgabenspezifische positive/negative Beispiele für jede unterstützte Aktion |
| 6 | Eine benannte V20-Teilmenge prüfen und implementieren | Geprüfte Beispiele für Initiative, Ressourcenlimits und Schaden; keine versehentliche 5e-/Traditional-Rechnung |
| 7 | Summoning-Budgets/Befehlszuständigkeit anpassen | Zeitpunkte für Erscheinen/Entlassen/Tod, Einheitenobergrenze und keine Aktionsvervielfachung durch Beschwörungen |

Traditional-Akzeptanzfälle: Geschwindigkeitsabstand 4 gegenüber 5; gleiche Geschwindigkeit; Konter tötet Angreifer; erster Schlag tötet Ziel; erster Schlag verfehlt; Handlungsunfähigkeit während des Schlagabtauschs; Fernkonter unverfügbar; Abklingzeit/MP unzureichend; Spieler/KI/GM nutzen dieselbe Regelprüfung; zwei schnelle Einheiten eröffnen weiterhin je nur einmal; legendäre Aktion setzt diese Kennzeichen nicht zurück; Rundenauffrischung stellt Budgets einmal wieder her; unbekannte Version scheitert sicher.

Reaktions-/Vorhersage-Akzeptanzfälle: Figurenauswahl gegenüber verbindlicher Aktivierung; wiederholte Auswahl/Neuladen; genauer Classic-Zugplatz; bezahlbare Fireball-Bedrohung gegenüber erschöpftem Magier; Vorhersage darf falsch sein; optionales Passen bei schwachem Zauber gegenüber wertvollem Konter; unzureichende Reaktion/MP/Zauberplätze; gescheiterter Konter wird dennoch bezahlt; ausgabenspezifische Erstattung des ursprünglichen Zaubers; Auslöser außerhalb der Reichweite/unsichtbar; mehrere Reagierende; unterstützter verschachtelter Konter und Stapelgrenzen; veraltete Antwort nach Tod des Ziels; erneute Prüfung unterbrochener vorgemerkter Auswahl; nativer gegenüber Hausregelzeitpunkt; keine verborgenen vorgemerkten Befehle oder künftige RNG-Ergebnisse in Steuerungs-Prompts.

Führe `pnpm install`, `pnpm check`, gezielte `*.regression.ts`-Nachweise, bei GM-/Schema-Prompt-Änderungen Prompt-Regressionen und UI-Smoke-Prüfungen für beide Darstellungen aus. Befolge den Issue-/PR-Ablauf des Repositorys und ergänze lokalisierte UI-Texte, Changelog, Übersetzungsfolgearbeit und CodeRabbit vor dem Review. Lasse manuelle Prüfkästchen im PR unangekreuzt.
