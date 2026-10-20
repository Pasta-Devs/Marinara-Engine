# Kampf-KI in Game Mode: Gegner, Begleiter und GM-Bosse

**Status: Gewöhnliche KI und die erste Implementierung von GM-Bossen/Reaktionen sind lokal vorhanden; Summoning und benannte Regelsätze bleiben Vorschläge.** Erstellt am 17. September 2026 anhand des durch [PR #6266](https://github.com/Pasta-Devs/Marinara-Engine/pull/6266) nach staging übernommenen Kampfcodes. Ursprünglich geprüfter staging-Stand: `1f2e965c34f77b19a1457439f61e291300e163c7`; Checkout `025442b1722b090b4640e0f078d1e08a4435f965` hatte dieselbe relevante Kampfimplementierung. Die aktuelle lokale Implementierung zweigt von staging `abe61d30a` ab. Prüfe staging vor Folgeimplementierungen erneut; die Zeilennummern der ursprünglichen Prüfung beziehen sich auf den früheren Stand.

Dieses eigenständige Dokument ermöglicht die Fortsetzung durch eine andere Entwicklungsaufgabe ohne das ursprüngliche Gespräch. Es hält Anforderungen des Maintainers, Quellcodeprüfung, empfohlene Standardwerte, Implementierungsgrenzen und Akzeptanzszenarien fest. Vorgeschlagene Zahlen und Felder außerhalb des implementierten Umfangs in Abschnitt 13 sind keine bestehenden Verträge oder durch Spieltests belegten Gleichgewichtsangaben. Implementierung und Übergaben sind lokale Arbeit; es wurde kein Issue oder PR eingereicht.

## Umfangsaktualisierung vom 17. September

Der Maintainer genehmigte gewöhnliche KI in Classic und Tactical sowie optionale KI-Begleitersteuerung und anschließend die Implementierung der GM-Boss-/Reaktionsfolgearbeit. Verfasste Bosse dürfen legendäre Aktionen unabhängig von der Wahl eines 5e-Regelsatzes nutzen. Der GM erhält Kampfbögen/Ressourcen der Gruppe und kann wahrscheinliche Aktionen vorwegnehmen, wenn eine Einheit ihre Aktivierung beginnt. Ressourcenverbrauchende Reaktionen wie Counterspell erfordern eine Entscheidung der Steuerung und werden nicht bedingungslos bei jeder Verfügbarkeit eingesetzt. Summoning bleibt eine Designerweiterung. Die ursprüngliche Quellcodeprüfung und das ausführlichere Design bleiben unten erhalten; Abschnitte 13–17 legen die aktuellen Entscheidungen fest und ersetzen die Beschränkung der Reihenfolge auf Tactical, den Vorschlag von acht Adjektiven zum Start, frühere Aussagen zur reinen Erkundungsphase und den ursprünglichen Boss-Prompt mit ausschließlich beobachtetem Zustand.

Die Laufzeitarbeit ist eine erste nutzwertbasierte Entscheidungsimplementierung, nicht die Erfüllung aller Akzeptanzszenarien dieses Dokuments. Ihre Grenzen stehen in Abschnitten 13 und 16. Die getrennte [Implementierungsübergabe für Regelsätze](game-combat-rulesets-implementation.md) behandelt Traditional-Folgeangriffe durch Geschwindigkeit, Zug-/Bewegungsreihenfolge, Ressourcenvorräte und künftige ausgabenspezifische Profile.

## 1. Anforderungen des Maintainers

- Gewöhnliche Gegner nutzen Engine-gesteuertes Verhalten, beschrieben durch **ein Adjektiv plus Kampfrolle**, etwa Reckless Bruiser oder Cautious Spellcaster.
- **Nur Bosse erhalten GM-Steuerung für einzelne Züge.** Die Engine bestimmt weiterhin zulässige Aktionen und löst deren Ergebnisse auf. Boss-Steuerung bedeutet Aktionswahl während des Kampfes, nicht bloß ein zuvor generiertes Skript.
- Die Adjektivzuweisung gewichtet Erfahrung/Stufe, Rolle und bekannte Persönlichkeit mit etwas Zufall. Erfahrene Gegner sollen häufiger rollengerechte Gewohnheiten haben, ohne alle Veteranen gleichzumachen.
- **Jede Beast und Monstrosity ist Mindless.** Sie verfolgt das nächste Gruppenmitglied über den kürzesten zulässigen Weg und ignoriert Zielgesundheit sowie Geländevor-/-nachteile. Nimm Bosse oder benannte Kreaturen nicht stillschweigend aus.
- Optimiere für strategischen Spielspaß, plausibles Verhalten und Wiederspielwert, besonders im taktischen und künftigen Tabletop-ähnlichen Spiel. Die KI-Änderung muss dafür weder 5e- noch V20-Regeln implementieren.
- Bewahre ein ausführliches Design für die spätere Implementierung. Der ursprüngliche Erkundungsumfang wurde inzwischen um gewöhnliche KI und Begleitersteuerung erweitert; siehe die Umfangsaktualisierung oben.

Verwandte Vorgaben stehen im [Kampfplan](game-combat-roadmap.md): Schlachtfeldregeln, Gruppen-/Summoning-Teilnahme und Tabletop-Regelprofile sind unabhängige Entscheidungen. Auch Gegnertaktik soll unabhängig bleiben. Summoning bleibt nachrangig.

### Empfohlene Standardwerte, die noch Designannahme benötigen

1. Beginne mit acht Adjektiven: Mindless, Reckless, Cautious, Opportunistic, Protective, Supportive, Disciplined, Cowardly.
2. Zeige Adjektiv und Rolle mit einer kurzen Erklärung in der Gegnerinspektion. Halte Wahrscheinlichkeiten, Nutzwertgewichte und rohe Persönlichkeitsanalyse aus der normalen UI heraus.
3. Interpretiere den kürzesten Mindless-Weg als **wenigste zulässige räumliche Schritte**, nicht als geringste Geländebewegungskosten. Die Kreatur darf einen kürzeren Waldweg nehmen, obwohl ein längerer offener Weg schneller wäre. Bewegung verbraucht dennoch die tatsächlichen Geländekosten.
4. Ein Beast-/Monstrosity-Boss bleibt Mindless. Der GM wählt nur Aktionen, die dessen zwingendem Ziel- und Verfolgungsverhalten entsprechen.
5. Gewöhnliche Profile werden einmal gezogen und gespeichert. Ein wiederkehrender benannter NPC behält sein festgelegtes Temperament; ein Stufenaufstieg allein würfelt die Persönlichkeit nicht neu aus.
6. Implementiere gewöhnliche KI im revidierten Umfang gemeinsam in Tactical und Classic. Zum vollständigen gewünschten System gehören tatsächliche GM-Boss-Züge; ein reiner Engine-Meilenstein darf nicht als ganze Funktion beschrieben werden.

## 2. Quellcodeprüfung vor der Überarbeitung

Die zweite Vermutung des Maintainers trifft am ehesten zu: Jede aktive Kampf-Engine hat eine gemeinsame automatische Strategie. Der GM verfasst die Begegnung, wählt aber keine einzelnen Züge in den aktiven Kampfoberflächen von Game Mode.

| Bereich                    | Classic Game Mode                                                         | Tactical Game Mode                                                            |
| ----------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Zugreihenfolge              | Initiativewürfe plus Geschwindigkeit; alle Kämpfenden nehmen teil                   | In neuen Spielen nach Initiative (eine Einheit nach der anderen, Reihenfolge einmal ausgewürfelt, combat C6c); in älteren nach Seite (Spielerphase, dann Gegner nach Geschwindigkeit) |
| Gegnerstrategie            | Gemeinsame Fähigkeitsheuristik, sonst zufälliges lebendes gegnerisches Ziel           | Gemeinsame Strategie: zuerst heilen, bewerteter Angriff, dann Annäherung                        |
| Klassenunterschiede       | Keine klassenspezifische Entscheidungsstrategie                                         | Sechs Klassen ändern Reichweite, Bewegung und kritische Treffer; alle nutzen dieselbe Entscheidungsstrategie |
| Persönlichkeit/Erfahrung | Kein gespeichertes Modell für taktische Persönlichkeit oder Ausbildung                          | Kein gespeichertes Modell für taktische Persönlichkeit oder Ausbildung                              |
| Boss-Entscheidungen          | Gleiche gewöhnliche Strategie plus unterstützte geskriptete Mechaniken                   | Gleiche gewöhnliche Strategie; Boss-Kennzeichnung beeinflusst Platzierung/UI                         |
| GM während jedes Zugs     | Nicht im aktiven Auflöser                                                | Nicht im aktiven Auflöser                                                    |
| Reproduzierbarkeit         | Entscheidungen/Würfe mit nicht durch Seed bestimmtem Zufall                                      | Seed plus Aktionszähler bestimmen Entscheidungen und Kampfwürfe                   |
| Speicherung             | Client stellt Kampf-Snapshot wieder her; Runden-/Animationszustand nicht vollständig gespeichert | Client speichert vollständigen Tactical-Snapshot in Chat-Metadaten               |

Daneben gibt es ein getrenntes Begegnungsdialogsystem mit modellgesteuerter Route `/encounter/action` und Kampfaktionstypen. Es wird vom allgemeinen Chat-`EncounterModal` über `useEncounter` genutzt, nicht von der aktuellen `GameCombatUI` in Game Mode. Dieses Modell darf umgeschriebenen Kampfzustand zurückgeben; nutze es nicht unverändert für die vorgeschlagene Engine-validierte Boss-Steuerung. Verfolge tatsächliche Aufrufer vor Wiederverwendung oder Löschung.

Classics ausdrückliches Manöver **Special** (Spezialaktion) bittet ebenfalls den GM, eine erzählerische Aktion zu beurteilen, und erlaubt unterstützte Status-/Element-Tags. Es löst keine gewöhnliche Runde auf und wählt keine routinemäßigen Gegnerzüge. Bewahre diesen Unterschied bei GM-Prompt-Änderungen; „Zugsteuerung nur für Bosse“ verbietet weder Begegnungsgenerierung noch erzählerische Beurteilung oder Nachkampferzählung.

### Classic-Strategie

In `combat.service.ts` ruft `resolveCombatRound` für automatische Verbündete und Gegner `chooseAutoSkill` auf:

1. Eine Fähigkeit gilt als nutzbar, wenn MP reichen und ihre Abklingzeit eine Prüfung per Rundenmodulo besteht.
2. Heile den am stärksten verletzten berechtigten Verbündeten bei höchstens 75 % HP, sofern eine Heilfähigkeit verfügbar ist.
3. Wähle andernfalls mit 45 % Wahrscheinlichkeit eine zufällige Nichtheilfähigkeit und ein zufälliges gegnerisches Ziel.
4. Greife andernfalls einen zufälligen Gegner an.

Gegner übergeben nur sich selbst als Verbündetenliste und heilen über diese Strategie derzeit keine anderen Gegner. Nichtheilfähigkeiten umfassen Verstärkungen ebenso wie Angriffe/Schwächungen; jeder Ersatz muss die Zielseite pro Fähigkeit validieren, statt diese Gruppierung beizubehalten. Praktisch verhindert die unten beschriebene MP-Auslassung bei generierten Gegnern deren kostenpflichtige Fähigkeiten, sodass Standardangriffe gegen zufällige Ziele bleiben. Die erste lebende Figur auf Spielerseite erhält den eingereichten Spielerbefehl; andere Verbündete handeln automatisch. Geänderte Gegnertaktik darf Begleitersteuerung oder Spieleridentität nicht stillschweigend verändern.

Generierte Mechaniken werden getrennt nach normalen Aktionen verarbeitet. Derzeit werden nur `round_interval` und `hp_threshold` ausgeführt; akzeptierte Auslöser `on_hit`, `on_attack` und `passive` nicht. HP-Schwellenmechaniken wiederholen sich in späteren passenden Runden, und `damage_one` wählt das erste gegnerische Ziel. Das ist kein live vom GM gewählter Boss-Zug. Unterscheide einmalige und wiederkehrende Wirkungen ausdrücklich, bevor du sie anpasst.

Classic löst Nichtheilfähigkeiten zudem über einen schadensorientierten Pfad auf; Verstärkungen/Schwächungen entsprechen nicht den Tactical-Unterstützungsoperationen, obwohl ein benannter Status einen Treffer begleiten kann. Echte Unterstützungs-/Kontrollsemantik und ein Abklingzustand pro Nutzung sind Voraussetzungen, um dieses Classic-Verhalten anzubieten. Automatische Abwehr-/Warteaktionen brauchen ebenfalls Auflöserunterstützung; derzeit gehört Abwehr zum Initiativeplatz des gesteuerten Spielers, sodass schnellere Gegner vorher handeln. Die Schwierigkeit skaliert im gemeinsamen Auflöser derzeit den Angriffsschaden beider Seiten, nicht die Entscheidungsqualität. Bewahre oder ändere das getrennt von der Temperamentabstimmung.

Eine weitere bestehende Abweichung bei der Spielersteuerung braucht einen eigenen Nachweis: Ist Platz null KO, überträgt der Server Befehle auf den ersten lebenden Verbündeten, während der aktive Spielerindex der UI null bleibt. Eine unverfügbare Fähigkeits-ID kann dann auf einen Standardangriff zurückfallen. Erfasse/behebe das unabhängig vom Gegnertemperament.

### Tactical-Strategie

`packages/shared/src/features/tactical-combat/ai.ts` arbeitet derzeit so:

1. Versucht die erste bereite Heilfähigkeit auf den Verbündeten mit dem niedrigsten HP-Anteil innerhalb von zwei Feldern, sofern er höchstens 60 % HP hat. Bewegt sich vorher nicht in Heilreichweite.
2. Bewertet erreichbare Bewegungsziele gegenüber lebenden Gegnern und berücksichtigt Standardangriffe sowie bereite Angriffsfähigkeiten.
3. Bewertet Angriffe als `1000 * likelyKill + expectedDamage - 0.75 * counterRisk`. Dabei bedeutet likelyKill, dass der prognostizierte Schaden die aktuellen HP erreicht und die Trefferchance mindestens 50 % beträgt; es ist kein sicherer Kill.
4. Ersetzt gelegentlich den besten nicht tödlichen Angriff durch einen anderen zufälligen zulässigen Angriff. Die Wahrscheinlichkeiten sind 60 % casual, 30 % normal, 10 % hard, 0 % brutal. Heilungsannahme beträgt entsprechend 50 %, 80 %, 100 %, 100 %.
5. Nähert sich, wenn kein Angriff verfügbar ist, dem nach Manhattan-Distanz nächsten Gegner über das erreichbare Feld mit kleinster Manhattan-Distanz. Das ist keine kürzeste Verfolgung über das gesamte Brett und kann an Hindernissen ohne Fortschritt bleiben.

Gelände beeinflusst Bewegung und Schadens-/Treffervorschauen, aber die Strategie bewertet nicht allgemein, wo die Einheit in der nächsten Spielerphase gefährdet sein wird. Sie wählt nicht gezielt Verstärkungen, Schwächungen, Abwehr oder Gegenstände. Fähigkeitsreichweite ist vereinfacht. Generierte AoE-Beschreibungen bilden keinen vollständigen räumlichen Flächenwirkungsauflöser.

Die Klassen sind Fighter, Knight, Rogue, Archer, Mage und Healer. Die Ableitung nutzt einen ausdrücklichen Hinweis, Heilfähigkeiten, Namens-/Fähigkeitsschlüsselwörter, Elementarangriffe und Werteheuristiken. Eine Rollenbezeichnung allein schafft keine Fähigkeiten.

### Grundlegende Lücken, die ein Persönlichkeitssystem untergraben würden

Dies sind Befunde aus der Quellcodeprüfung, keine Aussagen aus einer ausgeführten Browser-Reproduktion:

| Lücke                                                     | Nachweis und Folge                                                                                                                                                    | Eng begrenzter nächster Schritt                                                                                                                                                         |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Generierte Gegner haben keine MP                            | `generatedEnemyToCombatant` lässt MP/maxMP aus; generierte Nichtstandardfähigkeiten kosten MP. Beide Engines behandeln fehlende MP als null. Solche Gegner können diese Fähigkeiten nicht nutzen. | Ergänze eine Regression über die tatsächliche Bauplanüberführung; bewahre explizite Ressourcendaten oder wende eine dokumentierte Ressourcenregel für generierte Gegner an. Gewähre keine unbegrenzten Zauber. |
| Stufe wird aus HP abgeleitet                               | Die Stufe generierter Gegner stammt normalerweise aus gerundeten maxHP/20. Eine widerstandsfähige Kreatur ist nicht zwangsläufig taktisch ausgebildet.                                                       | Ergänze einen begrenzten Erfahrungshinweis; nutze die Stufe nur als erklärten Rückfall, bis Regelprofile richtige Ausbildungsdaten liefern.                                                  |
| Boss-Identität ist heuristisch                              | Tactical kennzeichnet den stärksten Gegner in Gruppen ab zwei anhand von maxHP + level\*10 + attack. Ein Einzelgegner wird dadurch nie markiert.                               | Ergänze ausdrückliche Boss-Identität pro Gegner. Die Musikstufe einer Begegnung identifiziert nicht, welche Einheit GM-Züge erhält.                                                               |
| Generierte Boss-Mechaniken erreichen Tactical nicht          | Classic erhält Mechanik-Props; Tactical verarbeitet die generierte Mechanikliste nicht.                                                                                       | Ordne unterstützte Mechaniken validierten taktischen Operationen mit gespeichertem Phasen-/Auslösezustand zu. Kennzeichne nicht unterstützte Mechaniken, statt sie als ausgeführt zu erzählen.          |
| Kreaturentyp und Persönlichkeit sind keine Laufzeitverträge | Die Gegnerbeschreibung steht im Bauplan, geht bei der Laufzeitüberführung aber verloren; Beast/Monstrosity sind keine typisierten Kategorien.                                                | Führe ausdrückliche Kategorie und begrenzte Zuweisungseingaben durch alle Umwandlungs- und Speichergrenzen.                                                                 |
| Sicht und Deckung sind in Tactical gemeinsam (combat C6)        | Eine Wand oder ein Berg blockiert die Sicht in nativen Kämpfen und Regelsatz-Kämpfen gleichermaßen, und Deckung wird mit demselben Test abgestuft (halb, drei Viertel): Vorschauen, Aktionen, Konter, Flächen, Reaktionen, Bedrohungsanzeigen und die KI nutzen `hasLineOfSight` und `coverTier`. | Behalte einen Sichttest und einen Deckungstest für alle Aufrufer.                                                                                                                 |
| KI-Kandidatenprognosen lesen das Kandidatenfeld        | Beide KIs prognostizieren einen Angriff und den Konter, den er riskiert, von dem Feld aus, von dem sie zuschlagen würden. So wird Deckung (combat C6a-2) so gewichtet, wie sie gewürfelt wird. | Halte Prognosen und Auflösung auf demselben `hitChance`.                                                                                                                      |

Eine weitere Umwandlungslücke betrifft beide Engines: Der generierte Angriffstyp wird aus englischen Schlüsselwörtern in Name/Beschreibung abgeleitet, obwohl Begegnungsprosa andere Sprachen nutzen kann. Auch das Bauplan-Kennzeichen `AoE`/`both` bleibt nicht als tatsächliches Mehrzielverhalten erhalten. Explizite validierte Fähigkeitsfelder sollen künftige Rollenableitung versorgen; übersetzte Namen dürfen nicht entscheiden, ob ein Zauber heilt oder angreift.

Bündele keine vollständige Kampfneufassung in diese Voraussetzungen. Ergänze kleinste Nachweise, korrigiere den betroffenen Ablauf und nutze vorhandene Hilfen für Bewegung, Vorschau, Fähigkeitsbereitschaft und Aktionsauflösung wieder.

## 3. Fähigkeit, Temperament und Steuerung trennen

Jeder Gegner benötigt Antworten auf unterschiedliche Fragen:

| Dimension           | Bedeutung                                          | Beispiel                                                                |
| ------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| Kreaturenkategorie   | Wendet zwingende Typregeln an                      | Beast erzwingt Mindless                                                  |
| Rolle                | Wofür die tatsächliche Ausstattung geeignet ist           | Supporter hat nutzbare Heil-/Verstärkungsfähigkeiten                            |
| Temperament         | Was bei der Auswahl zulässiger Aktionen wichtig ist | Cautious bewertet das Meiden von Gefahr hoch                                  |
| Erfahrung         | Wie beständig Gewohnheiten umgesetzt werden          | Ein erfahrener Reckless Bruiser riskiert weiterhin viel, verschwendet aber weniger Aktionen |
| Steuerung          | Wer die Aktion wählt                           | Engine für gewöhnliche Gegner; GM für ausdrückliche Bosse                    |
| Begegnungsziel | Was die Seite erreichen will               | Jetzt die Gruppe besiegen; später schützen/entkommen/gefangen nehmen                         |

Nutze zunächst ein primäres Adjektiv. Führe keine beliebige Eigenschaftsstapelung, keinen Persönlichkeitsvektoreditor, keine Verhaltensbaumabhängigkeiten und kein allgemeines Planungsframework ein. Eine kleine Profiltabelle um gemeinsame zulässige Kandidaten genügt.

### Rollen anhand von Fähigkeiten

Behalte vorhandene taktische Klassen als Geometrie-/Wertevorgaben. Eine kleine Zuordnung von Entscheidungsrollen kann sie bei passender Ausstattung verfeinern:

| Vorgeschlagene Rolle | Fähigkeitsnachweis                                | Typische Aufgabe                                          | Wahrscheinliche Adjektive                    |
| ------------- | -------------------------------------------------- | ---------------------------------------------------- | ------------------------------------ |
| Bruiser       | Starke Nahkampfangriffe                         | Aufschließen und Schaden austauschen                               | Reckless, Disciplined, Opportunistic |
| Bulwark       | Widerstandsfähige Nahkampfausstattung                                  | Nützliche Position nahe verletzlichen Verbündeten halten        | Protective, Disciplined, Cautious    |
| Skirmisher    | Beweglichkeit plus nützlicher Nahkampfschaden            | Günstige Gefechte wählen                           | Opportunistic, Cautious, Reckless    |
| Marksman      | Anhaltende Fernangriffe, eventuell Mindestreichweite | Nützliche Schussentfernung halten                    | Cautious, Disciplined, Opportunistic |
| Spellcaster   | Nutzbare Angriffsmagie und deren Ressourcenvorrat       | Fernkampfdruck ohne Verschwendung begrenzter Fähigkeiten | Cautious, Disciplined, Opportunistic |
| Controller    | Nutzbare Schwächungs-/Kontrolleffekte                     | Relevante Bedrohung schwächen                             | Disciplined, Opportunistic, Cautious |
| Supporter     | Nutzbare Heil-/Verstärkungsausstattung                            | Die Gruppe handlungsfähig halten                             | Supportive, Protective, Cautious     |

Dies sind Vorwahrscheinlichkeiten, keine Verbote. Ein Cowardly Fighter oder Reckless Spellcaster muss möglich bleiben. Ein Cleric mit Rüstung und Nahkampffähigkeiten kann Bulwark sein; ein Heiler mag die hintere Reihe bevorzugen. Leite Temperament nicht allein aus Klassenstereotypen ab. Vorübergehende MP-Erschöpfung verändert zulässige Aktionen, nicht gespeicherte Rolle oder Adjektiv. Weise Supportive keiner Ausstattung zu, die niemals Unterstützungsfähigkeiten hatte.

## 4. Adjektivkatalog

### Die anfänglichen acht

| Adjektiv         | Zielvorliebe                                                             | Positionierung und Risiko                                                                                    | Fähigkeiten-/Ressourcenverhalten                                                                                      | Was der Spieler lernen kann                                   |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **Mindless**      | Nächstes lebendes erreichbares Gruppenmitglied gemäß Abschnitt 6               | Kürzester zulässiger räumlicher Weg; ignoriert Geländenutzen, Gefährdung und Formation                           | Einfacher zulässiger Angriff auf dieses Ziel; keine Heilpriorisierung, Feuerkonzentration oder Ressourcenoptimierung                   | Mit Nähe, Gelände und Engpässen ködern             |
| **Reckless**      | Sofortiger Schaden und erreichbarer Druck; nicht automatisch das schwächste Opfer | Schließt aggressiv auf, nimmt Konter und ungeschützte Ziele in Kauf                                  | Nutzt starke verfügbare Angriffe bereitwillig; hält selten zur Abwehr inne                                             | Überdehnung bestrafen und in ungünstige Schlagabtausche locken            |
| **Cautious**      | Ziele, die bei begrenztem Gegenschaden bedroht werden können                          | Schätzt sichere Ziele, nützliche Reichweite und defensives Gelände                                            | Schont knappe Ressourcen, wenn ein Standardangriff fast ebenso nützlich ist; heilt/wehrt bei Bedarf ab                | Sicheren Raum unter Druck setzen; Zurückhaltung beim Festlegen ausnutzen   |
| **Opportunistic** | Verwundete, ungeschützte oder bereits beeinträchtigte Ziele; verlässliche Abschlusschancen   | Akzeptiert etwas Risiko für eine konkrete Gelegenheit                                                                | Schätzt Fähigkeiten, die solche Gelegenheiten schaffen oder nutzen                                                      | Verletzliche Verbündete schützen und einfache abschließende Angriffe verhindern   |
| **Protective**    | Bedrohungen eines bestimmten verletzlichen Verbündeten oder einer nahen unterstützten Gruppe          | Bleibt in Unterstützungsreichweite; besetzt bei Zulässigkeit nützliche blockierende Felder                                    | Nutzt Abwehr/Unterstützung zum Erhalt des Schützlings; greift an, wenn Schutz nicht dringend ist              | Gruppe auseinanderziehen oder aus mehreren Richtungen angreifen   |
| **Supportive**    | Gesundheit der Verbündeten und nützliche Verstärkungen vor eigenem Schaden                           | Bewegt sich in zulässige Unterstützungsreichweite und vermeidet unnötige Gefährdung                                        | Heilt nennenswert fehlende HP, vermeidet nutzlose Überheilung/doppelte Verstärkungen, greift bei geringem Unterstützungsnutzen an | Unterstützungseinheit bedrängen oder von Begünstigten trennen |
| **Disciplined**   | Rollengerechte Ziele, vernünftige Abschlussgelegenheiten                      | Wägt Schaden, Sicherheit, Positionierung und Ressourcen ab; mäßige Zielbindung                            | Verlässliche Rollengrundlagen ohne extremes Spezialverhalten                                               | Rolle stören und ungünstige Entscheidungen erzwingen              |
| **Cowardly**      | Sicher erreichbare Ziele, die keinen Gegenschlag einladen                       | Selbsterhaltung steigt bei Verwundung oder lokaler Unterzahl stark; zieht sich in sichereren verbündeten Raum zurück | Heilt sich/wehrt eher ab und vermeidet kostspielige Bindungen                                                | Sicheren Rückzug abschneiden und anhaltenden Fernkampfdruck ausüben    |

Protective leitet Schaden nicht magisch um, provoziert keine Ziele, fängt keine Angriffe ab und erhält keine Reaktionen. Aktuelle Belegung erlaubt Positionsblockaden; stärkerer Schutz braucht tatsächliche Fähigkeiten. Cowardly darf zurückweichen und abwehren, doch die vorhandene Tactical-Aktion `flee` beendet den gesamten Kampf. **Nutze globale Flucht niemals als Flucht eines einzelnen Gegners.** Rückzug/Aufgabe je Einheit erfordert neue ausdrückliche Regeln.

Cautious und Cowardly sollen unterschiedliche Ergebnisse liefern: Ein gesunder Cautious Marksman nimmt eine gute Schussposition ein; ein verwundeter Cowardly Marksman kann zum Selbstschutz auf einen guten Schuss verzichten. Protective und Supportive unterscheiden sich ähnlich: Einer bewacht eine Person oder Position, der andere maximiert nützliche Unterstützungsaktionen.

### Mögliche Erweiterungen nur mit eigenständigem Verhalten und Nachweis

| Adjektiv   | Eigenständiges Verhalten                                                                                         | Vor Auslieferung erforderlich                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Vengeful    | Bindet sich an den letzten Angreifer oder den beobachteten Mörder eines Verbündeten, auch wenn ein anderes Ziel etwas besser wäre | Kleines gespeichertes Kampfgedächtnis; regelkonformer Zielwechsel bei unverfügbarem Ziel      |
| Patient     | Hält eine wertvolle Position und lässt Gegner in günstige Reichweite kommen                                          | Begrenzte Halte-/Gefechtsregeln und Fortschrittsschutz gegen endloses Warten           |
| Predatory   | Lauert isolierten Zielen auf und schlägt bei entstehender Gelegenheit zu                                              | Isolationsmaß; darf zwingendes Mindless bei Beast/Monstrosity nicht überschreiben           |
| Fanatical   | Opfert Sicherheit für ein ausdrückliches Ritual, einen Anführer oder eine Mission                                               | Begegnungsziele mit sichtbarem Fortschritt und Scheiterbedingungen                     |
| Methodical  | Baut eine unterstützte Schwächungs-/Angriffsfolge auf, statt sofortigem Schaden nachzujagen                            | Explizite Kombinationsabhängigkeiten, begrenztes Gedächtnis und klarer Unterschied zu Disciplined |
| Coordinated | Berücksichtigt verbündete Absichten und reduziert redundante Angriffe/Unterstützung                                      | Begrenzte Teamabsicht ohne allwissende perfekte Koordination                          |
| Territorial | Verteidigt einen Ort und verfolgt nicht über eine Grenze hinaus                                                    | Gespeichertes Gebiet/Ziel und verständliches Abbruchverhalten                       |
| Deceptive   | Nutzt echte Finten-, Köder- oder Tarnfähigkeiten zur Irreführung                                              | Unterstützte Täuschungs-/Wahrnehmungsmechaniken; Erzählung allein erzeugt keine Wirkung     |

Vermeide Synonyme mit identischer Bewertung. Cruel ist überwiegend Opportunistic, solange die Regeln kein eigenes Ziel unterstützen. Strategic sollte tatsächlicher begrenzter Planung vorbehalten bleiben, statt allgemein bessere Leistung zu bedeuten. Mut und Intelligenz müssen keine Gegenpole derselben Skala sein.

## 5. Profilzuweisung: Rolle, Erfahrung, Persönlichkeit, dann Seed-bestimmte Vielfalt

### Vorrang

1. Validiere die explizite Kreaturenkategorie. Beast oder Monstrosity erzwingt Mindless unabhängig von Stufe, Persönlichkeit, Schwierigkeit oder Boss-Status. Widersprüchliche modellgenerierte Adjektivhinweise werden mit Zuweisungsherkunft verworfen. Ein widersprüchliches ausdrücklich verfasstes/importiertes aufgelöstes Profil wird mit behebbarer Fehlermeldung abgelehnt; schreibe eine gespeicherte verfasste Auswahl nicht stillschweigend um.
2. Bewahre ein bereits aufgelöstes gültiges Profil beim Fortsetzen einer Begegnung. Bewahre das etablierte Temperament eines bekannten wiederkehrenden NPC, wenn stabile Identität vorliegt.
3. Beachte ein verfasstes Profil anderer Kreaturen, wenn es zur Ausstattung passt. Nicht unterstützte oder widersprüchliche explizite Eingaben erhalten einen klaren Validierungsfehler; fehlende Eingaben Standardwerte.
4. Leite die Rolle aus tatsächlichen Fähigkeiten ab, bei mehrdeutiger Ausstattung mit validiertem Rollenhinweis.
5. Berechne Erfahrung, Rollenvorwahrscheinlichkeiten und begrenzte Persönlichkeitsanpassungen.
6. Ziehe ein Profil per Seed-bestimmter gewichteter Auswahl; speichere Ergebnis und Strategieversion.

Mindless ist anfangs von gewöhnlicher Zufallszuweisung ausgeschlossen. Künftiges verfasstes Untoten-/Konstruktverhalten darf es nutzen, aber die zwingende Beast-/Monstrosity-Regel muss bestehen bleiben. Nutze bei älteren Gegnern unbekannter Kategorie ausdrücklich `unknown`; rate nicht, dass „beast“ im Namen eine taxonomische Angabe sei.

### Erfahrung ist weder HP noch Schwierigkeit oder moralischer Wert

Bevorzuge eine Ausbildungsstufe aus dem Regelprofil oder zuverlässige NPC-Bogendaten. Nutze danach einen ausdrücklich validierten Begegnungshinweis. Falle nur ohne beides auf die Stufe zurück und erfasse diese Quelle. Die derzeit aus HP abgeleitete Stufe ist ein schwacher Rückfall und darf nicht stillschweigend zum maßgeblichen Intelligenzmaß werden.

Für eine erste regelneutrale Implementierung könnten novice/trained/veteran/master der Kompetenz `c = 0, 0.35, 0.7, 1` entsprechen. Ein konkreter vorläufiger Engine-Stufenrückfall wäre 1–2 novice, 3–7 trained, 8–14 veteran, 15+ master. Das ist eine abstimmbare Spieldesignkurve, keine Tabletop-Regel; kennzeichne die Quelle als `level-fallback`, besonders solange Stufen aus HP stammen. Binde die Zuordnung an die Zuweisungsversion und ersetze sie durch Regelprofilzuordnungen, sobald diese existieren. Setze den 5e-Herausforderungsgrad nicht mit Charakterstufe gleich und zwinge V20-ähnlichen Spielen keine einheitliche Stufenskala auf.

Erfahrung beeinflusst **sowohl** die Chance auf rollengerechtes Temperament bei Erstzuweisung **als auch** dessen beständige Umsetzung. Für gewöhnliche lokale KI offenbart sie weder verborgene Spielerfähigkeiten noch vorgemerkte Befehle. GM-Bosse erhalten die breitere Kenntnis der Gruppenbögen aus Abschnitt 16; keine Steuerung sieht künftige Zufallswürfe oder unbestätigte Spielerentscheidungen. Die Überlebensannahme ist eine nützliche Weltbau-Tendenz, kein Tatsachengesetz, dass alle erfahrenen Zauberer vorsichtig seien.

### Konkretes Gewichtungsmodell

Nutze eine kleine Rollen-/Adjektivtabelle und eine begrenzte Formel. Beispielhafte Ausgangswerte für Spieltests:

```text
w[a] = baseRoleWeight[role,a] * exp(1.2*c*roleAffinity[role,a] + 1.5*q*personalityMatch[a])
P[a] = 0.94 * w[a]/sum(w) + 0.06/N
```

- `c`: Kompetenz, 0..1.
- `roleAffinity`: verfasste Eignung von -1..1; einige Persönlichkeiten sind für mehrere Rollen wirksam.
- `personalityMatch`: begrenzte Hinweise von -1..1, keine uneingeschränkten Modellzahlen.
- `q`: Vertrauen in bekannte Persönlichkeit, 0..1; null bei unbekannter Persönlichkeit.
- `N`: Zahl kompatibler Adjektive; entferne inkompatible Profile vor der Normalisierung. Bleibt keines, nutze einen validierten Disciplined-/Standardrückfall und erfasse das Eingabeproblem.
- Die Beimischung von 6 % gibt jedem kompatiblen seltenen Profil eine kleine Chance. Sie schwächt niemals harte Typregeln.

Beispiel eines **vielseitigen Zaubernden mit Unterstützungsfähigkeit**, ohne Persönlichkeitshinweise:

| Adjektiv     | Grundgewicht | Rolleneignung | Wahrscheinlichkeit novice | Wahrscheinlichkeit master |
| ------------- | ----------- | ------------- | ------------------ | ------------------ |
| Cautious      | 4           | 1             | 23,0 %              | 35,8 %              |
| Disciplined   | 4           | 1             | 23,0 %              | 35,8 %              |
| Opportunistic | 3           | 0,5           | 17,4 %              | 15,2 %              |
| Supportive    | 1           | 0             | 6,4 %               | 3,5 %               |
| Protective    | 1           | 0             | 6,4 %               | 3,5 %               |
| Reckless      | 2           | -1            | 11,9 %              | 2,4 %               |
| Cowardly      | 2           | -0,5          | 11,9 %              | 3,7 %               |

Rundung kann eine Summe von genau 100 % verhindern. Eine bekannte rücksichtslose Persönlichkeit erhöht Reckless auch bei hoher Kompetenz. Das bestehende Adjektiv eines benannten NPC soll nicht bei jeder Stufenänderung neu gezogen werden. Die Zahlen verdeutlichen die gewünschte Tendenz, nicht endgültiges Gleichgewicht.

### Persönlichkeitsextraktion ohne Modellaufruf für jeden gewöhnlichen Zug

Nutze den bestehenden Begegnungsgenerierungsaufruf, um bekannte Charakter-/NPC-Persönlichkeit in höchstens drei Hinweise einer geschlossenen Aufzählung umzusetzen, jeweils mit Vertrauen low/medium/high und begrenzter Quellenreferenz. Beispiele: loyal, risikosuchend, selbsterhaltend, mitfühlend, geduldig. Die Engine ordnet Hinweise Zahlengewichten zu. Bitte das Modell nicht um beliebige Wahrscheinlichkeiten oder Laufzeitcode.

Nutze tatsächlich bekannte Persönlichkeit. Ein Aussehen wie „ein vernarbter Zauberer“ belegt keine Vorsicht. Verneinung zählt: „nicht feige“ darf Cowardly nicht verstärken. Mehrsprachige und widersprüchliche Beschreibungen brauchen Regressionsfälle. Fehlt die Extraktion, ist sie fehlerhaft oder nicht unterstützt, verwende keine Persönlichkeitsanpassung; Rolle plus Erfahrung plus RNG genügt. Reiner Schlüsselwortabgleich darf nicht als semantisches Verständnis beworben werden.

Speichere angenommene Hinweise/Herkunft zur Erklärung der Zuweisung, keine Denkprotokolle des Modells. Stabile NPC-Identität muss aus bestehenden Entitätsreferenzen stammen, nicht nur aus Anzeigenamen. Anonyme wiederholte Monster dürfen neue Begegnungsprofile erhalten; wiederkehrende benannte Figuren brauchen ein identitätsgestütztes Profil, bevor sitzungsübergreifende Konsistenz versprochen wird.

### Zufallsgrenzen

- Leite einen KI-Zuweisungs-Seed aus Begegnungs-Seed, stabiler Gegner-ID und Zuweisungsversion ab. Trenne dessen Domäne von Geländegenerierung und Kampfwürfen.
- Verbrauche beim bloßen Aufzählen/Bewerten von Kandidaten oder Anzeigen von Vorschauen keinen Kampf-RNG.
- Speichere das aufgelöste Profil. Neuladen, Wiederholung, Import, Rückkehr zu einem Checkpoint und Neustart desselben Kampfes dürfen nicht versehentlich ein neues Temperament ziehen.
- Neue Begegnungen/Seeds dürfen Zusammensetzung und Temperamente variieren. Bewusstes Neuwürfeln soll eine neue Begegnungsrevision erstellen, nicht heimlich den aktuellen Kampf ändern.
- Tactical teilt derzeit einen Seed-bestimmten Zeiger zwischen Entscheidungen und Ergebnissen. Eine geänderte Nutzung ist eine versionierte Verhaltensänderung; bewahre das alte Verhalten laufender Kämpfe oder biete eine ausdrückliche getestete Migration.
- Classics Auflöser ohne Seed braucht einen getrennten RNG-/Speicheradapter, bevor exakte Wiedergabe behauptet werden darf.

## 6. Mindless: genauer Verfolgungsvertrag

Dies ist eine gewünschte Projektregel für Beast/Monstrosity, keine Behauptung über offizielle Tabletop-Regeln oder tatsächliches Tierverhalten hinter diesen Bezeichnungen.

### Ziel und Weg

1. Betrachte lebende Gruppenmitglieder und zulässige Positionen, von denen der festgelegte einfache Angriff jedes erreichen kann. Das belegte Zielfeld ist kein zulässiges Bewegungsziel.
2. Suche für Gehen auf dem gesamten Brett nach kürzesten zulässigen Wegen in **Rasterschritten**, ohne Geländeaufschläge bei der Rangfolge. Wände, Wasser und Berge blockieren gewöhnliche Fußgänger weiterhin. Verbündete dürfen nach aktuellen Regeln durchquert werden; belegte Endpositionen bleiben verboten.
3. Bevorzuge das Gruppenmitglied mit den wenigsten Schritten bis zu einer zulässigen Angriffsposition. Bei gleich erreichbaren Angriffszielen folgen räumliche Nähe, stabile Ziel-ID und Koordinatenreihenfolge. Löse Gleichstände nie anhand von HP, Verteidigung, Ausweichen, Klasse oder prognostiziertem Schaden.
4. Folge dem gewählten Weg so weit wie das tatsächliche Bewegungsbudget dieses Zugs erlaubt. Wald kostet weiterhin zwei Bewegungspunkte. Wähle den entferntesten zulässigen unbelegten Haltepunkt auf diesem Weg, keine billigere Abkürzung daneben aus taktischem Vorteil.
5. Nutze nach der Bewegung in zulässiger Angriffsreichweite den festgelegten einfachen Angriff gegen dieses Ziel. Warte sonst nach der Bewegung. Standard ist der Grundangriff; bei Erstellung darf ein validierter angeborener Signaturangriff bestimmt werden. Suche nicht die schadensstärkste Fähigkeit und wechsle das Ziel nicht für einen AoE-Verbund.
6. Berechne bei der nächsten Aktivierung anhand des aktualisierten Bretts neu. Ist ein Weg blockiert, wähle das nächste erreichbare Ziel. Ist keines erreichbar, warte; greife niemals durch eine unzulässige Bewegungsabkürzung an und laufe nicht endlos im Kreis.

Ziel ist ein bewusst anspruchsloser Verfolger, kein Wegfindungsfehler. Eine U-förmige Wand kann vorübergehend größere Manhattan-Distanz verlangen. Eine Suche über das ganze Brett soll diesen Weg finden.

**Geländebeispiel:** Weg A umfasst drei zulässige Waldschritte, Weg B fünf über Ebenen. Mindless wählt A, auch bei höheren Bewegungspunktkosten. Die Einheit erhält am Wald-Endpunkt weiterhin Waldverteidigung/-ausweichen und zahlt die Waldbewegungskosten. Ein Cautious-Gegner kann absichtlich eine defensive Waldposition bevorzugen; Mindless erhält denselben Bonus beiläufig.

Nutze für Flug und Teleportation deren tatsächlichen Bewegungsvertrag. Flug überquert blockierten Boden und belegte Felder und darf über sonst unpassierbarem Gelände schweben; Teleportation überwindet dazwischenliegende Hindernisse, verlangt aber zulässiges Landegelände. Beide dürfen nicht auf belegten Feldern enden. Nach aktuellen flachen Rasterregeln gilt Manhattan-Distanz, nicht „ein Teleportsprung überallhin“. Über mehrere Züge braucht Teleportverfolgung einen Weg über erreichbare zulässige Landepositionen; wähle kein scheinbar nahes Ziel hinter einer Lücke, die breiter als alle zulässigen Sprünge ist. Gelände-Verteidigung/-Ausweichen bleibt für jede Bewegungsart wirksam.

Implementiere keine parallelen, subtil abweichenden Durchquerungsrechte nur für Mindless. Extrahiere/nutze vorhandene Bewegungsprädikate. Die Wegvorliebe darf Kosten ignorieren, während die Ausführung normale Zulässigkeit und Kosten nutzt.

### Harte Ausschlüsse und Boss-Vorrang

Mindless prüft keine Ziel-HP zur Opferwahl, optimiert keine Tötungschance, sucht keine Deckung, koordiniert kein konzentriertes Feuer, heilt keine verletzten Verbündeten, zieht sich nicht aus Angst zurück und wechselt nicht wegen einer wertvolleren Klasse das Ziel. Schwierigkeit und Erfahrung dürfen diese Verhaltensweisen nicht wiederherstellen.

Begrenze bei einem Mindless-Boss das GM-Auswahlmenü auf dieses gewählte Ziel und die vorgeschriebene Verfolgung, mit zulässigen Signatur-/Phasenoptionen, die diese Grenzen nicht umgehen. Bleibt nur eine Aktion, führe sie ohne sinnlosen Modellaufruf aus. Eine künftige Ausnahme für intelligente Beast-/Monstrosity-Bosse wäre eine bewusste Produktregeländerung mit Zustimmung des Maintainers, keine Implementierungsbequemlichkeit.

Classic hat keine räumliche Entfernung und kann „am nächsten über den kürzesten Weg“ nicht originalgetreu umsetzen. Eine vorgeschlagene Anpassung ist eine gespeicherte, Seed-bestimmte Gefechtsreihenfolge ohne HP-/Geländegewichtung mit dem ersten lebenden Eintrag als Ziel. **Die revidierte nicht räumliche Implementierung nutzt diese Abstraktion** und muss so bezeichnet werden; sie erfüllt die genaue räumliche Anforderung nicht. Beschreibe die Abstraktion nicht als Entfernung; eine echte Nächstes-Ziel-Regel bräuchte künftig ein Formations-/Positionsmodell. Eine spätere Vorder-/Hinterformation könnte das ermöglichen; Array-Reihenfolge darf nicht stillschweigend Entfernung werden. Die Tactical-Wegregel bleibt das maßgebliche Mindless-Verhalten dieses Vorschlags.

## 7. Gewöhnliche Gegnerentscheidungen

### Auflöser wiederverwenden, Prioritäten variieren

Erzeuge zunächst zulässige Aktionskandidaten und bewerte sie dann mit Rollen- und Adjektivgewichten. Nutze vorhandene Hilfen für Bewegung, Vorschau und Bereitschaft; ergänze die kleinste gemeinsame Zulässigkeitsfunktion für Engine-KI und GM-gesteuerte Einheiten. Rufe das ausschließlich verändernde `performUnitAction` nicht mit unvalidierten Modelleingaben auf.

Kandidaten sollen umfassen:

- Standardangriff und nutzbare Angriffsfähigkeiten einschließlich zulässiger Ziele für Bewegung vor Aktion.
- Heilung, Verstärkung und Schwächung gegen die richtige Seite einschließlich Bewegung in Unterstützungsreichweite.
- Abwehr, Warten und zielgerichtete Bewegung, wenn kein nützlicher Angriff und keine Unterstützung verfügbar sind.

Nimm nur tatsächlich vom Auflöser unterstützte Mechaniken auf. Gegnergegenstände brauchen zuerst echtes Inventar/Abrechnung. AoE-Geometrie, Beschwörungen, Provokationen, neue Reaktionen, Gelegenheitsangriffe, Deckung und Flucht darf die Bewertung nicht erfinden. Tactical besitzt bereits Konter und Abwehr/Warten; Classic braucht ausdrückliche automatische Abwehr-/Warte- und richtige Verstärkungs-/Schwächungsoperationen für gleichwertige Profile. Das ist Auflöserarbeit, nicht bloß veränderte Gewichtung.

Nutze normalisierte Faktoren für erwarteten Schaden, Abschlusswahrscheinlichkeit, nützliche Heilung/Unterstützung, sofortiges Konterrisiko, Gefährdung in der nächsten Phase, Fortschritt zur rollengerechten Gefechtsreichweite und Ressourcenkosten. Multipliziere sie mit einer kleinen Profiltabelle. Ein sehr großer universeller Kill-Bonus würde Temperamentunterschiede auslöschen; ersetze ihn für die neue Strategie durch einen begrenzten profilabhängigen Abschlusswert.

Dies ist ein kleiner nutzwertbasierter Ansatz: Vergleiche zulässige Aktionen mit konsistenten Skalen und variiere Prioritäten nach Persönlichkeit. Den allgemeinen Ansatz und Entscheidungsträgheit beschreibt David „Rez“ Graham in [Einführung in die Nutzwerttheorie](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf). Konkrete Profile, Formel, Standardwerte und Anbindungsplan hier sind Marinara-spezifische Designempfehlungen.

### Praktische Leitplanken

- Berechne Vorschauen aus der hypothetischen Zielposition einschließlich ihres Geländes, ohne Live-Zustand oder RNG zu verändern. Die Konterwahrscheinlichkeit muss tatsächlichen Treffer-/Überlebens-/Konterregeln entsprechen; bezeichne einen 50-%-Schuss nicht als sicheren Kill.
- Schätze die Gefahr der nächsten Phase aus aktuell beobachtbaren Positionen und bekannten Angriffen. Kein Blick auf künftigen RNG oder ausstehende Spielerbefehle. Begrenze die Bedrohungsschätzung zunächst auf eine Aktivierung, bevor du tiefere Suche erwägst.
- Vermeide Heilspam: Bewerte wirksame Heilung, Dringlichkeit, Opportunitätskosten und MP. Ein Kratzer von einem HP darf eine wichtige Aktion nicht automatisch überwiegen. Frische eine noch nützliche Verstärkung nicht ohne Nutzen auf.
- Vermeide ständiges Umplanen: Behalte ein gültiges Ziel/einen Schützling, solange keine andere Option deutlich besser ist. Speichere nur das tatsächlich genutzte kleine Gedächtnis. Mindless folgt stattdessen seinem Nächstes-Ziel-Vertrag.
- Vermeide endloses Distanzhalten/Abwehren: Ohne sinnvolle Unterstützung oder Rückzugsfortschritt bevorzuge ein nützliches Gefecht. Nutze einen begrenzten Stillstandsschutz; zwinge eine Cowardly-Einheit nicht allein für kürzere Züge zum Selbstmordangriff.
- Lasse nicht jede Einheit einen identischen vorberechneten Phasenplan wählen. Löse in aktueller Reihenfolge auf und bewerte die nächste Einheit anhand des aktualisierten Zustands; das reduziert verschwendete Heilungen und Angriffe auf besiegte Ziele.
- Protective wählt anhand Rolle/Bedarf einen lebenden Verbündeten und behält ihn als Schützling, bis er ungültig oder klar ungeeignet wird. Schutz eines ausdrücklichen Bosses darf ein Einrichtungshinweis sein, ist aber kein allgemeines Verhalten aller Begleitgegner.
- Nutze kleine Seed-bestimmte Abweichungen zwischen fast besten Aktionen **innerhalb des gewählten Temperaments**. Übernimm nicht die heutige gleichverteilte Zufallswahl aller übrigen Angriffe, die Persönlichkeit auslöschen kann.

Vorgeschlagene Anfangsabstimmung: Normalisiere den Strategienutzen auf eine feste Skala; Anfänger wählen aus Optionen innerhalb von 0,15 des besten Profilwerts, Meister innerhalb von 0,03, mit interpolierten Zwischenstufen. Ergänze eine kleine dokumentierte Schwierigkeitsanpassung, so begrenzt, dass Schwierigkeit nie das Temperament wechselt. Diese Schwellen brauchen Simulation und Spieltests; sie sind keine belegten Gleichgewichtswerte.

## 8. Vom GM gesteuerte Boss-Züge

### Identität und Verantwortung

Ergänze ausdrückliche Boss-Identität pro Einheit in Begegnungsdaten. Mache nicht automatisch das stärkste Mitglied jeder Gruppe zum GM-Boss. Vorgeschlagene Ränge sind ordinary, elite, boss; elite bleibt Engine-gesteuert, solange nicht ausdrücklich als Boss ausgewiesen. Die vorhandene begegnungsweite Musikklassifikation kann getrennt bleiben.

Der GM wählt eine zulässige Aktion anhand etablierter Persönlichkeit, Begegnungsabsicht, aktuellem Brett, Gruppenfähigkeiten/-ressourcen/-gegenständen und unterstützten Mechaniken. Diese breitere Kenntnis dient Vorhersage, nicht dem Wissen über eine unbestätigte Spielerwahl; Abschnitt 16 definiert den Informations- und Unterbrechungsvertrag. Reichweite, Bewegung, Ressourcen, Würfe, Schaden, Zustände und Zugbudgets gehören der Engine. Gewöhnliche Begleitgegner bleiben auch neben einem Boss Engine-gesteuert.

Empfohlene Einrichtung: Aktiviere das neue Taktiksystem für neue Spiele bei Auslieferung der vollständigen Funktion und biete „GM directs bosses“ als klar erklärte Einstellung mit der konfigurierten GM-Verbindung an. Erkläre, dass Boss-Züge eine Modellantwort und die normale Anbieternutzung des Nutzers erfordern können. Bestehende Spiele behalten ihr Verhalten bis zur bewussten Aktivierung; schreibe die Wahl beim Begegnungsstart fest. Eine reine Engine-/Offline-Option nutzt dieselben Boss-Profile. Ergänze dafür keinen anderen Kampfstil-Enum und ändere die Steuerung nicht stillschweigend mitten im Kampf.

### Zugorchestrierung

Halte Anbieteraufrufe in einem serverseitigen Orchestrierungsdienst außerhalb der reinen gemeinsamen Engine:

1. Nimm eine Spieleraktion mit Begegnungsidentität, Aktions-ID und erwarteter Revision an. Validiere gegen den angenommenen Kampfzustand.
2. Gehe in bestehender Reihenfolge zur nächsten gewöhnlichen Aktion oder Unterbrechungsentscheidung weiter. Trenne Erklärung von Wirkungsauflösung, damit eine Reaktion einen ausstehenden Zauber unterbrechen kann; löse nicht erst eine ganze Runde auf, um sie danach umzuschreiben.
3. Speichere ausstehende Aktivierung/Fenster: Einheiten-ID, Revision, Zugzeiger, auslösende/ausstehende Aktion, Strategieversion und begrenztes Menü zulässiger Kandidaten.
4. Fordere von der GM-Verbindung eine strukturierte Kandidaten-ID oder Passen an. Füge aktuellen Gruppenbogen-Snapshot, Boss-Absicht, unterstützte Mechaniken und nur die für dieses Fenster vorgesehenen Aktionsinformationen gemäß Abschnitt 16 hinzu. Eine kurze optionale Erzählung darf keinen Zustand verändern.
5. Validiere Antwort, aktuelle Revision, Einheit, Kandidatenzugehörigkeit und aktuelle Zulässigkeit. Erfasse die Entscheidung atomar und wende die Aktion einmal an.
6. Setze unterbrochene Aktion/Aktivierung aus dem aktualisierten Zustand fort, dann die übrigen Teilnehmer. Validiere nach Unterbrechungen erneut; schreibe jedes Budget/jede Wirkung genau einmal an ihrer regeldefinierten Grenze fort und gib dann die Kontrolle zurück.

Kandidaten-IDs sollen vollständig bestimmte Engine-Aktionen identifizieren, keine beliebigen Modellkoordinaten. Große Bretter erzeugen viele fast gleiche Kandidaten. Baue ein deterministisches begrenztes Menü, das nützliche Aktionsfamilien bewahrt: Signaturzüge, Angriffsziele, Unterstützung, Abwehr und Bewegung. Etwa 8–16 vielfältige Kandidaten sind ein anfängliches Benchmark-Ziel. Entferne nicht jede Alternative mit einem allgemeinen Profil, bevor der GM sie sieht.

### Latenz, Ausfall und wiederholte Anfragen

Ein Anbieteraufruf pro eigenständigem Boss-Entscheidungsfenster ist die anfängliche Obergrenze; keine Aufrufe für gewöhnliche Begleitgegner, bloße Auswahlklicks oder Fenster ohne nützliche zulässige Wahl. Gewöhnliche Züge, Vorhersage, legendäre Aktionen nach dem Zug und ausgelöste Reaktionen können unterschiedliche Fenster erzeugen; begrenze daher die gesamte Aktivierungs-/Phasenlatenz bei mehreren Bossen. Beginne mit einem konfigurierbaren weichen Ziel um fünf Sekunden und einem harten Zeitlimit um zehn Sekunden je Aufruf; stimme danach an tatsächlich unterstützten Anbietern ab. Das sind Designziele, keine gemessenen Antwortgarantien. Erfasse einen deterministischen Rückfall oder Passen bei erschöpftem Gesamtbudget, statt unbegrenzt aufzurufen.

Zeitüberschreitung, unverfügbarer Anbieter, fehlerhafte Ausgabe oder ungültiger Kandidat sollen dieselbe gespeicherte deterministische Rückfallstrategie nutzen. Speichere den Rückfall als Entscheidung; eine späte Modellantwort darf ihn weder ersetzen noch einen zusätzlichen Zug auslösen. Halte die UI bedienbar, zeige einen einfachen Boss-Denkzustand und erlaube Abbruch zum angenommenen Rückfall ohne Neustart der gesamten Begegnung.

Wiederholungen derselben Aktions-ID liefern das gespeicherte Ergebnis. Ein neu geladener Tab schließt sich der ausstehenden Entscheidung an. Gleichzeitige Tabs können denselben Boss nicht zweimal voranschreiten lassen. Chatwechsel dürfen Antworten keiner anderen Begegnung zuordnen. Checkpoint-Rückkehr/Verzweigung erstellt oder restauriert kohärente Kampfidentität und Entscheidungshistorie; wiederhole externe Aufrufe nicht allein wegen neu gestarteter Animation.

**Speichervoraussetzung:** Aktuelle Tactical-Anfragen nehmen Client-Zustand an und liefern einen neuen Snapshot; ein maßgebliches serverseitiges Zugprotokoll fehlt. Classic nimmt ebenso vollständige clientgelieferte Kämpfende/Mechaniken an, ohne Vergleich mit einer maßgeblich gespeicherten Runde. Eine Kandidaten-ID nur im Browser löst Wiederholungen oder Parallelität nicht. Führe vor externen Boss-Entscheidungen in beiden Modi den kleinsten serverseitigen Revisions-/Entscheidungsspeicher ein und nutze passende vorhandene Speicherwarteschlangen. Serverseitige Begegnungseinstellungen und angenommene Boss-Identität entscheiden über Modellaufrufe; ein Client-Kennzeichen darf sie nicht einschalten. Prüfe Turn-Game-/Experience-Namensräume, bevor du `game_engine_state` als richtigen Speicher annimmst. Das ist eine begrenzte Kampfzustandsänderung, kein Grund für eine komplette Neugestaltung der Spielspeicherung.

### Boss-Mechaniken und Verständlichkeit

Überführe nur unterstützte generierte Mechaniken in strukturierte Operationen. Gib einmaligen Phasenübergängen stabile IDs und gespeicherten Auslösezustand. Unterscheide normale Aktion, Phasenübergang und ausdrücklich unterstützte Zusatzaktion; eine atmosphärische Boss-Beschreibung erlaubt keinen kostenlosen Schaden.

Kündige große Angriffe in UI/Log vor der Auflösung an, wenn die Mechanik eine Warnung verlangt. Der GM darf angenommene Ereignisse ausschmücken, muss aber tatsächliche Ergebnisse erzählen. Erlernte Boss-Persönlichkeit und Signaturausstattung sollen über Wiederholungen erkennbar bleiben, auch wenn zulässige Entscheidungen variieren.

Zeige bei deaktivierter oder unverfügbarer GM-Steuerung den Engine-Rückfall an, statt die Entscheidung dem GM zuzuschreiben. Reproduzierbarkeit mit GM bedeutet Wiedergabe gespeicherter Entscheidungen und Würfe, nicht identische neue Modellantworten aus demselben Seed.

## 9. Daten- und Anbindungsvertrag

Bevorzuge ein kleines gemeinsames Metadatenobjekt, das durch den vorhandenen Kampfablauf geführt wird. Beispiel einer aufgelösten Form:

```ts
type ResolvedEnemyTactics = {
  version: 1;
  creatureCategory: "beast" | "monstrosity" | "other" | "unknown";
  role: EnemyRole;
  adjective: EnemyAdjective;
  proficiency: "novice" | "trained" | "veteran" | "master";
};
```

Diese minimale Kategorie unterscheidet zwingende Regeln, ohne eine vollständige 5e-Kreaturentaxonomie vorzutäuschen. Behalte eine reichere kanonische Kategorie, falls anderswo eingeführt. Speichere ausdrücklichen Begegnungsrang getrennt, damit Boss-Identität nicht in Persönlichkeit kodiert wird. Leite die Steuerung aus Rang plus festgeschriebener Boss-Steuerungseinstellung ab; vermeide zwei unabhängig bearbeitbare Wahrheitsquellen.

Bauplan-Zuweisungshinweise und aufgelöste Laufzeitdaten sind unterschiedliche Verträge. Der Bauplan darf begrenzte Rollen-/Erfahrungs-/Persönlichkeitshinweise und eine stabile NPC-Referenz enthalten. Die Engine löst sie einmal zum gespeicherten Profil auf. Speichere Zuweisungsherkunft einmal mit der Begegnung und kleines Entscheidungsgedächtnis nur für tatsächlich darauf angewiesene Strategien. Speichere keine doppelten rohen Persönlichkeitsbeschreibungen für jede Einheit in jedem Zug.

Classic benötigt zusätzlich Profildurchleitung durch `sanitizeCombatantForRound`, das Rundenanfrageschema und `CombatantStats`. Sein aktueller Snapshot lässt Runden-/Initiative-/Aktionswarteschlangenzustand absichtlich aus; allein ein Temperamentfeld ermöglicht daher keine fortsetzbaren GM-Züge, echten Abklingzeiten oder deterministische Wiedergabe. Speichere den nötigen maßgeblichen Runden-/Aktivierungszustand; Animationen müssen angenommene Ergebnisse verbrauchen, statt neu aufzulösen.

Verfolge die vollständige Grenze:

```text
known NPC/card data + scene
  -> encounter prompt/schema and generated blueprint
  -> accepted assignment inputs and explicit boss identity
  -> generatedEnemyToCombatant / fallback encounter construction
  -> Classic request OR Tactical start request
  -> resolved units + pinned AI version + encounter identity
  -> action resolution / optional server boss decision
  -> snapshot, checkpoint/branch restore, import/export, post-combat summary
```

Validiere Aufzählungen und begrenzte Werte an jeder externen Grenze. `.passthrough()` validiert keine neuen KI-Felder. Bewahre ausgelassene Felder alter Spielstände; lehne fehlerhafte explizite Werte mit hilfreicher Fehlermeldung ab, statt das Temperament still zu ändern. Eine neue Strategieversion darf keinen alten Snapshot versehentlich neu interpretieren.

Behalte für ältere laufende Begegnungen standardmäßig die alte Strategie und wende das neue System auf neue Kämpfe an. Alte Snapshots ohne Taxonomie lassen sich nachträglich nicht zuverlässig klassifizieren; täusche keine Prüfung der zwingenden Typregel vor. Eine neu bekannte Beast/Monstrosity unter der neuen Strategie muss Mindless erhalten.

Jeder Gegnererstellungspfad zählt: generierte Begegnungen, manueller/Rückfallkampf, wiederhergestellte Spielstände und künftige Beschwörungen. Ergänze Felder nicht nur in der TypeScript-Schnittstelle, um sie beim ausdrücklichen Eigenschaftskopieren wieder zu verlieren.

## 10. Spielspaß, Realismus und Wiederspielwert prüfen

**Spielspaß:** Gegner sollen erkennbare und ausnutzbare Gewohnheiten haben. Ein Sieg durch Trennung eines Protective-Wächters von einem Supportive-Heiler ist befriedigender als einer durch den zufälligen Fehlzug einer Universalbewertung. Mache nicht alle Gegner zu perfekten Maschinen für konzentriertes Feuer.

**Realismus:** Nutze glaubwürdige Ziele, begrenztes Wissen und gegnergerechte Kompetenz. Feigheit, Loyalität, Aggression und Ausbildung sind verschiedene Eigenschaften. Mindless ist die gewünschte Vereinfachung für zwei Kreaturenkategorien. Künftige Moral-/Zielsysteme dürfen Aufgabe, Gebietsverteidigung und Flucht ergänzen, ohne deren heutige Existenz vorzutäuschen.

**Wiederspielwert:** Variiere Profile und Begegnungszusammensetzung zwischen Seeds und bewahre Identität innerhalb eines Kampfes und für wiederkehrende NPCs. Gelände, Rollenkombinationen, Gegnerressourcen und Ziele sollen mehr Variation als andere kritische Treffer schaffen. Schwierigkeit soll die Herausforderung vorhersehbar verändern, ohne eine Mindless Beast plötzlich Heiler jagen zu lassen.

Beispielbegegnung auf derselben Karte:

- Ein Reckless Bruiser verlässt sein sicheres Feld, um eine erreichbare Frontlinieneinheit zu bedrängen.
- Ein Protective Bulwark bleibt nahe dem Supportive-Zaubernden, statt mitzustürmen.
- Ein Cautious Marksman hält eine Schussbahn und vermeidet eine ungeschützte Zielposition.
- Eine Mindless Beast nimmt den kürzeren Waldweg zum nächsten erreichbaren Gruppenmitglied und ignoriert den weiter entfernten verwundeten Zaubernden.
- Ein benannter humanoider Boss erhält einen GM-Zug zur Wahl zwischen zulässigem Signaturdruck und Schutz seines Rückzugswegs. Seine Begleitgegner nutzen weiter ihre eigenen Profile.

Ein anderer Seed kann Cowardly Bruiser und Opportunistic Marksman erzeugen und damit das Gefecht verändern. Neuladen darf das nicht. Ein späteres Auftreten desselben benannten Bosses soll etablierte Gewohnheiten bewahren, solange Geschichte oder ausdrückliche Bearbeitung sie nicht ändern.

## 11. Vorgeschlagene Implementierungsschritte

Diese große Funktion verändert gespeicherte Verträge, Prompts, Gegnerentscheidungen und asynchrone Orchestrierung. Stimme das Design ab und implementiere dann kleine überprüfbare Schritte auf aktuellem staging.

| Schritt                                  | Ergebnis                                                                                                                    | Abschlussnachweis                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| A. Grundlagen für Fähigkeiten und Identität | Ressourcenverlust generierter Gegner belegen/beheben; ausdrückliche Kategorie-/Rang-/Erfahrungshinweise; Felder durch alle Erstellungspfade bewahren  | Generierter Zaubernder nutzt und verbraucht echte Ressourcen; Einzelboss-Identität übersteht Wiederherstellung |
| B. Zuweisung und Speicherung          | Rollenvorwahrscheinlichkeiten, Persönlichkeitshinweise, Seed-bestimmtes gespeichertes Adjektiv, versioniertes Altverhalten                                              | Zuweisungstendenzen, harter Typvorrang, stabiles Neulade-/Import-/Checkpoint-Verhalten                  |
| C. Gewöhnliche Tactical-Gegner           | Gemeinsame zulässige Kandidaten, genaue Mindless-Verfolgung, acht unterschiedliche Profile, Inspektionstexte                                      | Verhaltensmatrix, Vorschaugleichheit, Mobil-/Browsernachweise, begrenzter Aufwand           |
| D. GM-Boss-Züge                       | Serverseitige Revisions-/Idempotenzgrenze, fortsetzbare Gegnerphase, validierte Kandidatenantwort, gespeicherter Rückfall, unterstützte Mechaniken | Zeitlimit-/Wiederholungs-/Parallelitäts-/Wiederherstellungstests und manueller Boss-Kampf mit echtem Anbieter                        |
| E. Classic-Anpassung                  | Nicht räumliche Profilsemantik, richtige Verbündeten-/Unterstützungsvorräte, Seed-bestimmter Entscheidungs-/Wurfzustand und Boss-Initiativeanbindung           | Classic-Runden-/Ressourcenregressionen und Wiederherstellungs-/Wiedergabenachweis; keine falsche Behauptung über Rasterverhalten        |

Schritte A–C sind ein nützlicher erster Meilenstein, **erfüllen für sich aber keine GM-gesteuerten Bosse**. In Classic muss die Boss-Entscheidung nach vorherigen Aktionen am richtigen Initiativeplatz angefragt werden, nicht anhand eines veralteten Bretts vom Rundenbeginn. Nutze Profiltabellen und Zuweisungslogik wieder, ohne räumliche und nicht räumliche Engines in einen riesigen Auflöser zu pressen.

Spätere getrennte Arbeiten: gemeinsame Sichtlinie/Deckung, echte AoE-Zielwahl, Moral/Flucht je Einheit, Ziele, weitere Adjektive, Koordination, Summoning-KI und regelprofilspezifische Aktionsökonomie. Tabletop-Regeln bestimmen Zulässigkeit; Gegnertemperament entscheidet über die Nutzung zulässiger Optionen.

### Quellcodeübersicht für die Implementierung

| Datei / Symbol                                                                                                                                                                                                                                    | Bedeutung                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| [Gemeinsame Kampftypen](../../packages/shared/src/types/game.ts), `Combatant`, `GameCombatStateSnapshot`                                                                                                                                           | Laufzeitmetadaten und Classic-Wiederherstellungsvertrag                                              |
| [Begegnungstypen](../../packages/shared/src/types/combat-encounter.ts), `CombatEnemy`, `CombatInitState`                                                                                                                                         | Generierter Bauplan, Mechaniken und getrennte Begegnungsdialogtypen                          |
| [Begegnungsrouten](../../packages/server/src/routes/encounter.routes.ts)                                                                                                                                                                         | Generierungs-Prompts/-Schemas und bestehender Charakterkontext; getrennte Dialogaktionsroute     |
| [GM-Prompts](../../packages/server/src/services/game/gm-prompts.ts)                                                                                                                                                                              | Sagen dem GM derzeit, dass die UI Kampfmechaniken behandelt                             |
| [GameSurface](../../packages/client/src/components/game/GameSurface.tsx), `generatedEnemyToCombatant`                                                                                                                                            | Verwirft Beschreibung und lässt Gegner-MP aus; ausdrückliche Überführungs- und Wiederherstellungs-/Erstellungspfade        |
| [Classic-UI](../../packages/client/src/components/game/GameCombatUI.tsx) und [Spiel-Hooks](../../packages/client/src/hooks/use-game.ts)                                                                                                           | Aktive Classic-Anfragen, Runden-/Animationsverhalten und Spieleraktionsablauf                   |
| [Classic-Dienst](../../packages/server/src/services/game/combat.service.ts), `chooseAutoSkill`, `resolveCombatRound`                                                                                                                            | Gemeinsame automatische Strategie, RNG, Mechaniken und Initiative                                     |
| [Spielrouten](../../packages/server/src/routes/game.routes.ts), `/combat/round`, `/combat/tactical/start`, `/combat/tactical/action`                                                                                                             | Schemas und Orchestrierungsgrenze; Zustand hin/zurück über den Client                                |
| [Tactical-KI](../../packages/shared/src/features/tactical-combat/ai.ts), `decide`, `runEnemyPhase`                                                                                                                                               | Aktuelle Strategie und Phasenschleife über alle Gegner zugleich                                          |
| [Tactical-Engine](../../packages/shared/src/features/tactical-combat/engine.ts)                                                                                                                                                                  | Einheitenumwandlung, Boss-Heuristik, Bewegung, Zulässigkeit, Auflösung, Vorschauen und Rundenfortschreibung |
| [Tactical-Klassen](../../packages/shared/src/features/tactical-combat/classes.ts)                                                                                                                                                                | Vorhandene sechs Klassen und Fähigkeitsableitung                                             |
| [Tactical-Typen](../../packages/shared/src/features/tactical-combat/types.ts), [Mathematik](../../packages/shared/src/features/tactical-combat/math.ts), [RNG](../../packages/shared/src/features/tactical-combat/rng.ts)                              | Snapshot-/Aktionsverträge, Geländevorschauen und deterministischer Strom                      |
| [Tactical-UI](../../packages/client/src/components/game/TacticalCombatUI.tsx) und [Chat-Metadaten](../../packages/shared/src/types/chat.ts)                                                                                                       | Gespeicherter Tactical-Snapshot, Beschäftigtzustände und Wiederaufnahme ausstehender Boss-Entscheidungen                             |
| [Vorhandene Geländeregressionen](../../scripts/regressions/hybrid-terrain.regression.ts), [Routennachweis](../../scripts/regressions/hybrid-terrain-route.regression.ts), [Einrichtungsnachweis](../../scripts/regressions/hybrid-terrain-setup.regression.ts) | Bestehende ausführbare Nachweismuster zur passenden Erweiterung                                  |

Suche vor der Implementierung Issues, offene/Entwurfs-PRs, verknüpfte Branches und Projekteinträge gegen Doppelarbeit. Der frühere Kampfplan nennt den geschlossenen/nicht gemergten PR #4391 als Vorarbeit; prüfe Status und Zuständigkeit erneut und mache nicht die gesamte Erweiterung zur Voraussetzung. Befolge aktuelle `AGENTS.md`, `CONTRIBUTING.md`, Paketanweisungen und die Chai-Ablaufergänzung. Implementiere nicht allein anhand veralteter Zeilennummern.

## 12. Akzeptanz- und Validierungsplan

Nutze kleine ausführbare `*.regression.ts`-Nachweise im vorhandenen Runner. Behalte keine temporären `.test.ts`-Dateien. Zusicherungen sollen Verhalten belegen, nicht bloß Gewichtskonstanten spiegeln.

| Szenario                                                                                        | Erforderliches Ergebnis                                                                                                           |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Beast/Monstrosity mit widersprüchlichem Adjektiv, Meisterkompetenz, bekannter Persönlichkeit oder Boss-Rang | Generierte Hinweise ergeben immer Mindless; widersprüchliche verfasste/importierte aufgelöste Profile erhalten hilfreichen Fehler |
| Nächster gesunder Tank gegenüber weiter entferntem verwundetem Zaubernden                                              | Mindless verfolgt den Tank; Opportunistic darf den Zaubernden wählen                                                            |
| Kurzer Waldweg gegenüber längerem offenen Weg                                                     | Mindless wählt weniger Schritte bei tatsächlichen Bewegungskosten und erhält beiläufige Geländeboni normal              |
| Wand mit vorübergehendem Wegführen; unerreichbarer Gegner                                      | Verfolgung findet zulässigen Umweg oder anderes erreichbares Ziel; kein Manhattan-Stillstand                                         |
| Fliegende/teleportierende Mindless-Einheiten                                                               | Eigene Durchquerungs-/Lande-/Belegungsregeln und Zugreichweite; keine unmögliche verkettete Landefolge                       |
| Verwundeter Verbündeter außerhalb aktueller Heilreichweite                                                      | Supportive bewegt sich und heilt zulässig; fehlende MP/Abklingzeit blockieren die Fähigkeit                                               |
| Protective-Einheit ohne Provokations-/Abfangfähigkeit                                           | Nur Positionierung; keine erfundene Schadensumleitung                                                                          |
| Verwundeter Cowardly-Gegner                                                                          | Darf zurückweichen/abwehren; löst niemals globale Gruppenflucht aus                                                                      |
| Hohe Kompetenz über große feste Seed-Menge                                                     | Rollengerechte Profile häufiger, seltene kompatible Profile bleiben; Seed-spezifische Ergebnisse stabil                |
| Bekannte Persönlichkeit, verneinte Eigenschaft, widersprüchliche, fehlende/ungültige Hinweise, nicht englischer Text  | Begrenzte dokumentierte Anpassungen; keine beliebige Zahlensteuerung oder versehentliche Beschränkung auf Englisch                             |
| Vorübergehende MP-Erschöpfung                                                                         | Rolle/Adjektiv unverändert; nur zulässige Aktionswahl ändert sich                                                                |
| Zwei Gegner zielen auf verletzte Einheit, der erste besiegt sie                                             | Zweiter bewertet aktualisierten Zustand; kein Angriff auf tote Ziele oder doppelt reservierte Heilung                                |
| Zielgelände unterscheidet sich vom Ausgangsgelände                                               | Kandidatenvorschauen und tatsächliche Konter stimmen bei Positionen, Gelände und Regeln überein                                             |
| GM erfindet Koordinaten, Fähigkeiten, kostenlose Aktionen, Ziel-IDs oder unzulässige Ressourcen                   | Keine Zustandsänderung; nur gespeicherter zulässiger Rückfall oder gültiger Kandidat                                                                 |
| GM-Zeitlimit mit späterem Erfolg, Neuladen, doppelter Anfrage oder parallelen Tabs            | Genau eine angenommene Boss-Aktion und ein Ressourcenabzug; veraltete Antwort verworfen                                     |
| Gruppensieg/-niederlage während angehaltener Gegnerphase                                          | Richtiges Endergebnis; kein weiterer Boss-/Begleitgegnerzug nach Kampfende                                                     |
| Checkpoint-Wiederherstellung, Verzweigung, Import/Export, alter Spielstand, wiederkehrender NPC                        | Angenommene Profile und richtige Kampfidentität bleiben; keine unbeabsichtigten Neuziehungen oder doppelten externen Entscheidungen             |
| Classic Mindless und GM-Boss                                                                    | Ausdrückliche nicht räumliche Zielregel und richtiger Initiativeplatz; keine Behauptung über Raster-/Geländeverhalten                        |

Messe Entscheidungskosten mit den unterstützten Anfragegrenzen von 40 Einheiten / 64 mal 64 Feldern, gemischten Bewegungsarten, vielen Fähigkeiten und dichten Hindernissen. Zwischenspeichere begründet Bewegungs-/Bedrohungsberechnungen je Entscheidung und verwerfe sie nach Zustandsänderungen. Lege erst nach Profilierung der aktuellen Engine auf Desktop und repräsentativem Mobilgerät ein messbares Zeitbudget für gewöhnliche Phasen fest. Behaupte kein Millisekundenbudget ohne Messung und ergänze vor der Profilierung keine tiefe Voraussuche.

Für die Implementierung: Beginne mit `pnpm install`; führe `pnpm check`, gezielte Kampf-/Routenregressionen, bei Prompt-Änderungen `pnpm regression:prompt` und für UI-Texte `pnpm localization:check` aus. Nutze Browserregressionen für tatsächlichen Kampfablauf, Neuladen, Boss-Warten/-Ausfall, Tastaturzugang, kleine Bildschirme und helles/dunkles Design. Ergänze passende `[Unreleased]`-Changelog-Einträge. Lies vor Client-Änderungen `packages/client/.instructions.md`. Protokolliere Anbieter-Prompts/-Ergebnisse über vorhandene Debug-Funktionen und Pino, ohne fremde Geheimnisse offenzulegen.

Führe vor angefordertem PR-Review CodeRabbit lokal aus, behebe wesentliche Befunde und wiederhole die Prüfung. Dokumentiere codegestützte Ablehnungen falscher oder rein pedantischer Vorschläge; laufe nicht endlos im Kreis. Lasse PR-Testplankästchen für den menschlichen Beitragenden unangekreuzt. Wenn dieses Dokument in einem PR veröffentlicht wird, füge die erforderliche `[docs-i18n]`-Folgearbeit oder passende Übersetzungen hinzu.

### Was die ursprüngliche Erkundung geprüft hat

Die Beschreibungen des damaligen Verhaltens stammen aus Quellcodeverfolgung von aktivem Client, Routen und Auflösern mit getrennten Classic-/Tactical-Prüfungen. Das Wahrscheinlichkeitsbeispiel wurde direkt berechnet. Es wurde kein Kampf-KI-Code geändert, keine neue Strategie simuliert und kein Browser- oder Boss-Ablauf mit echtem Anbieter ausgeführt. Das sind Akzeptanzanforderungen der Implementierung, keine durch dieses Design gelieferten Nachweise.

## 13. Aktueller Umfang der gewöhnlichen KI-Implementierung

Implementiertes Strategievokabular: Mindless, Reckless, Cautious, Opportunistic, Protective, Supportive, Disciplined, Cowardly, **Patient, Methodical und Coordinated**. Weitere Adjektive unten sind Ideen, keine verborgenen Laufzeiteinstellungen.

Der gemeinsame Vertrag `features/combat-ai.ts` trennt gespeicherte Rolle, Adjektiv, Ausbildungsstufe und Seed von der Steuerung. Neue Kämpfe erhalten gespeicherte Zuweisungen; wiederhergestellte Kämpfe ohne Profil behalten die bisherige automatische Strategie. Ein Steuerungswechsel für einen Begleiter würfelt sein Adjektiv nicht neu. Generierte endliche MP-Vorräte sowie ausdrückliche Fähigkeitstypen/-kosten erreichen die Laufzeit; ausgelassene Gegner-MP nutzen denselben vorläufigen Vorrat `20 + 3 × level` wie Verbündete ohne Werte, unter Wahrung ausdrücklicher null. Das ist ein allgemeiner Engine-Rückfall, keine Tabletop-Ressourcenregel.

Die v1-Zuweisung ist bewusst kleiner als die Formel in Abschnitt 5: Kompatible Profile beginnen mit positivem Gewicht, rollengünstige erhalten einen ausbildungsabhängigen Bonus, ein optionaler Persönlichkeitshinweis aus geschlossener Aufzählung eine begrenzte Vorliebe. Kategorievorrang erzwingt Mindless; ein ausdrücklicher Mindless-Hinweis wählt es auch für andere Kategorien. Der bestehende Begegnungsgenerierungsaufruf liefert Hinweise in beiden Sprachen; die Engine liest Persönlichkeit nicht selbst aus Prosa. Andere Temperamenthinweise sind Vorlieben, keine Garantien; das Modellverständnis von Verneinung/mehrsprachiger Charakterisierung braucht weiterhin Anbieterbewertung. Vollständige Herkunft und identitätsgestützte Persönlichkeit wiederkehrender NPCs über Begegnungen hinweg bleiben Folgearbeit. Aus HP abgeleitete Stufe bleibt ohne Hinweis ein schwacher Ausbildungsersatz.

Jeder Modus zählt ausführbare Standardangriffe, Fähigkeiten und Abwehroptionen auf und bewertet Schaden, Abschluss, wirksame Heilung, Unterstützung, Kosten und relevante taktische Faktoren. Es kommt kein Modellaufruf je gewöhnlichem Zug hinzu. Profile gewähren niemals unverfügbare Fähigkeiten, unbegrenzte MP, zusätzliche Aktivierungen oder nicht vorhandene Geländemechaniken.

- **Classic:** keine räumliche Bewertung. Mindless nutzt eine stabile Seed-bestimmte Reihenfolge lebender Gegner unabhängig von HP. Unterstützung nutzt den richtigen Verbündetenvorrat. Verstärkungs-/Schwächungsfähigkeiten wenden einen echten benannten Verteidigungsmodifikator statt einer reinen Schadensannäherung an. Neue Profile haben Abklingzeiten pro Nutzung. Manuelle Begleiter merken Angriff/Fähigkeit/Abwehr für ihren eigenen Initiativeplatz vor; Gruppeninventar und erzählerische Aktionen bleiben beim aktiven Anführer. Andere Begleiter nutzen standardmäßig KI entsprechend Classics bestehender Bedienung. Eingereichte Befehle benennen die handelnde Figur, auch bei KO des ursprünglichen Anführers.
- **Tactical:** zulässige erreichbare Angriffs-/Unterstützungsziele versorgen die Strategie. Mindless folgt dem Weg mit wenigsten Schritten bei tatsächlichen Bewegungskosten; Flug und Teleportation behalten ihre Durchquerungs-/Landeregeln. Unterstützung darf vor dem Wirken laufen. Neue Konterschätzungen nutzen das geplante Ziel. Eine konservative Reichweitenschätzung aus öffentlichem Zustand liefert Gefährdung; das ist keine vollständige Wegfindung des nächsten Zugs. Eine Wand oder ein Berg blockiert bei jedem Schlag die Sicht (combat C6).
- **Patient:** bevorzugt begrenztes defensives Halten gegenüber ungünstigem Gefecht; Classic wartet auf fast abgelaufene Abklingzeiten statt auf erfundene Bewegung. Bei vorhandener nützlicher Aktion darf es nicht unbegrenzt warten.
- **Methodical:** bevorzugt unterstützte Verteidigungssenkung als Vorbereitung, behält das Ziel und greift bei wirksamem Status an. Kein erfundener Kombinationsbaum oder Suche nach künftigen Würfen.
- **Coordinated:** berücksichtigt erfasste Ziele der Verbündeten und nützliche Schwächungen und berechnet nach jeder angenommenen Aktion neu. Kein allwissender Teamplaner und keine Reservierung nicht eingereichter Spieleraktionen.
- **Begleiter:** lokalisierte Player-/AI-Auswahl pro Mitglied im Kampf; der aktive Anführer bleibt manuell. Tactical-Begleiter handeln nach verbleibenden manuellen Befehlen oder bei **End Turn** (Zug beenden). Manuelle Übersteuerung bleibt bis zu ihrer Aktion möglich. Steuerungswechsel, Profile und Gedächtnis bleiben in Kämpfenden-/Tactical-Snapshots gespeichert.
- **Classic-Speicherung:** Angenommene Rundenergebnisse und nächste Rundennummer gehen vor kosmetischer Animation an den bestehenden Snapshot-Callback. Echte Abklingzeiten pro Nutzung überstehen diesen Umlauf. Classic nutzt weiterhin seine bestehenden zufälligen Kampfwürfe; das ist keine exakte Wurfwiedergabe oder serverseitiges idempotentes Aktionsprotokoll. Garantien für parallele Tabs gehören zur künftigen maßgeblichen Boss-Arbeit.

Der erste Meilenstein endete vor Boss-Anbieteraufrufen und Reaktionen; Abschnitt 16 hält deren folgende Implementierung fest. Verbleibende Grenzen umfassen Flucht je Einheit, Provokation, reichere Ziele, regelsatzspezifische Initiative, vollständige Bogenressourcennormalisierung und eine wiederkehrende NPC-Profilregistrierung. Nicht implementierte Teile des ursprünglichen Vorschlags bleiben Akzeptanzarbeit und gelten nicht implizit als ausgeliefert. Synthetische Desktop-Messungen sind keine Kalibrierung realer Mobilgeräte.

## 14. Weitere Adjektive mit klassenabhängigem Verhalten

Behalte ein sichtbares Adjektiv plus fähigkeitsabgeleitete Rolle. Das sind unterschiedliche Prioritäten, keine Synonyme für „klug“. Erlaube ungewöhnliche, aber mechanisch gültige Kombinationen.

| Adjektiv | Fighter / Knight | Rogue / Archer | Mage / Healer | Unterschied und Voraussetzung |
| --- | --- | --- | --- | --- |
| **Frugal** | Nutzt einen normalen Schlag vor einer begrenzten Kampftechnik | Spart Spezialmunition oder Stoßfähigkeiten für wichtige Ziele | Nutzt effiziente Zauber; reserviert teure Heilung für deutlich fehlende HP | Ressourceneffizienz auch in Sicherheit; anders als Cautious. Braucht echte endliche Ressourcenkosten |
| **Relentless** | Hält Druck auf einen gewählten Gegner | Verfolgt oder bedrängt ein Ziel anhaltend aus der Ferne | Setzt unterstützte Schadens-/Kontrollfolge gegen dieselbe Bedrohung fort | Starke Zielbindung statt Reckless-Risiko; braucht gespeichertes Ziel und Ausstieg bei ungültigem Ziel/fehlendem Fortschritt |
| **Disruptive** | Nutzt verfügbare Entwaffnung, Unterbrechung oder handlungshemmenden Schlag | Bricht unterstütztes Kanalisieren eines exponierten Zaubernden oder schwächt ihn | Priorisiert nützliches Bannen, Verstummen, Reinigen oder Kontrollieren | Verhindert wichtige Aktionen statt Schaden zu maximieren. Nur echte unterstützte Wirkungen, kein durch Namen erfundenes Verstummen |
| **Vengeful** | Vergilt dem Gegner, der es verletzte oder seinen Schützling fällte | Markiert letzten Angreifer und sucht eine zulässige Gelegenheit | Verflucht diesen Angreifer oder schützt dessen vorgesehenes Opfer | Ereignisbezogener Groll statt Schwächstes-Ziel-Wahl. Braucht begrenztes Gedächtnis für letzten Angreifer/besiegten Verbündeten |
| **Adaptive** | Ändert Taktik nach beobachteter Resistenz oder gescheitertem Gefecht | Wiederholt unwirksame Angriffe nicht endlos | Wechselt Element oder Unterstützungsplan nach beobachteten Ergebnissen | Lernt nur öffentliche Hinweise. Braucht begrenzte Beobachtungshistorie; keinen Zugriff auf verborgene Resistenztabellen |
| **Opportunistic** (bereits enthalten) | Wählt sicheren Abschluss statt längeren Zweikampf | Nutzt verwundetes/exponiertes Ziel | Nutzt einen Zauber für eine echte Gelegenheit | Vorhandenes Profil als Grundlage; ergänze „Cruel“ nicht mit derselben Bewertung |
| **Resolute** | Erfüllt zugewiesene Rolle trotz geringer Gesundheit | Hält nützliche Schussposition unter Druck | Vollendet wichtige Heilung oder unterstütztes Kanalisieren | Ruhe bei niedrigen HP statt Reckless-Aggression; braucht Absicht/Bindung und Notfallinvalidierung |
| **Territorial** | Hält verfasstes Tor oder Schutzobjekt | Bewacht definierten Zugang und verfolgt nicht darüber hinaus | Unterstützt Verbündete im verteidigten Gebiet | Braucht echtes Ziel/Begrenzung in Tactical. In Classic benanntes Ziel verteidigen, keine imaginären Koordinaten |
| **Zealous** | Priorisiert ausdrücklich bestimmten Anführer oder Zweck vor eigenem Überleben | Verbraucht knappe Stoßressourcen gegen Bedrohungen dieses Ziels | Bindet Unterstützung/Ressourcen auch unter Eigenrisiko an die Mission | Zieltreue statt allgemeinem Supportive-Verhalten; braucht Ziel-/Rangmetadaten |
| **Deceptive** | Nutzt unterstützte Finte oder Haltungswechsel | Nutzt echte Tarnung, Köder oder Zielirreführung | Erzeugt unterstützte Illusions- oder Köderfähigkeit | Braucht Wahrnehmungs-/Täuschungsmechaniken mit erkennbaren Gegenmitteln. Erzählerische Behauptungen allein wirken nicht |
| **Merciful** | Wählt unterstützten nicht tödlichen Abschluss | Macht bei möglicher Aufgabe handlungsunfähig statt zu töten | Nutzt Zurückhaltung/Kontrolle und nimmt Aufgabe an | Braucht nicht tödliche Ergebnisse und Aufgaberegeln; keine Angriffe auf besiegte Ziele oder erfundene Gnadenwirkung |
| **Selective** | Ruft nur bei Bedarf einen widerstandsfähigen Beschützer | Ruft für aktuelle Gelegenheit einen Verfolger oder Fernkämpfer | Wählt zu sichtbaren Bedrohungen passende Elementar-/Unterstützungsbeschwörung | Künftige Beschwörungsauswahlstrategie statt allgemeiner Schadensvorliebe; braucht Beschwörungsabrechnung |

Beste nächste Ergänzungen nach den heutigen elf: **Frugal, Relentless, Disruptive und Vengeful**. Frugal und Relentless passen mit kleinen Zustandsänderungen zu vorhandenen Fähigkeiten. Disruptive braucht echte Handlungshemmungs-/Bannsemantik; Vengeful Kampfereignisgedächtnis. Adaptive und Territorial bieten hohen Wiederspielwert, aber größere Voraussetzungen. Prüfe Resolute und Zealous vor Erweiterung des öffentlichen Vokabulars auf Überschneidung.

Auch die drei gewünschten Ergänzungen unterscheiden sich je Klasse:

| Adjektiv | Bruiser / Bulwark | Skirmisher / Marksman | Spellcaster / Supporter |
| --- | --- | --- | --- |
| Patient | Macht sich bereit, bis ein ungünstiger Schlagabtausch besser wird; hält in Tactical einen wertvollen Zugang | Wartet auf zulässige nützliche Reichweite, statt einen schwachen Schuss zu erzwingen | Spart einen Zug für einen bald bereiten Zauber oder vermeidet nutzlose Heilung; wartet nie auf nicht vorhandene Manaregeneration |
| Methodical | Wendet echte Schwächungstechnik an und greift dann diesen Gegner an | Bereitet unterstützte Verwundbarkeit vor dem Schadensstoß vor | Schwächt vor Schaden oder bereitet unterstützte Abwehrfolge vor; nützliche aktive Wirkungen werden nicht neu angewandt |
| Coordinated | Bedrängt aktuelles Ziel eines Verbündeten oder liefert nützliche Vorbereitung | Besiegt ein bereits vom Team bedrohtes Ziel | Liefert nicht redundante Unterstützung oder nutzbare Schwächung; berechnet nach jeder Aktion neu |

Diese Beschreibungen sind Abstimmungsziele. Die erste Implementierung nutzt das allgemeine unterstützte Verteidigungsverstärkungs-/-schwächungsmodell; reichere Klassenkombinationen brauchen entsprechende Fähigkeiten und Regressionsszenarien.

## 15. Designerweiterung Summoning

Beginne ohne Raster. Eine Beschwörung ist eine tatsächliche kämpfende Einheit mit stabiler Begegnungs-ID, Besitzerreferenz, Seite, Profil, Steuerung, Dauer, Ressourcenkosten und ausdrücklichem Aktivierungsbudget. Die Klasse verändert zulässige Ausstattung, das Adjektiv Prioritäten wie in Classic.

Trenne die **Beschwörungsauswahl** des Beschwörenden von der **Kampfstrategie** der beschworenen Einheit. Ein Patient-Beschwörender kann einen Platz für spätere Bedrohungen sparen; ein Protective-Knight schützt durch unterstützte Aktionen; ein Methodical-Mage bereitet Schwächung vor; ein Coordinated-Heiler vermeidet doppelte Heilung. Beast-/Monstrosity-Beschwörungen bleiben nach aktueller Projektregel auch als Verbündete Mindless.

Der Regelsatz bestimmt, ob Befehle die Aktion des Besitzers verbrauchen, ob eine Beschwörung sofort oder nächste Runde handelt, Initiative teilt und ohne Befehl tätig wird. Empfohlener allgemeiner Standard: Beschwören verbraucht die gewöhnliche Besitzeraktion; die neue Einheit aktiviert sich erstmals nächste Runde und nutzt Engine-KI, sofern nicht ausdrücklich steuerbar. Entlassen/Neubeschwören derselben Einheit darf keinen neuen gewöhnlichen Zug gewähren. Erzwinge Einheitenobergrenze und stabile Abrechnung einer Aktivierung pro Runde vor Schwarmfähigkeiten.

Besitzer-KO, Bezauberungs-/Seitenwechsel, Entlassung, Ablauf der Dauer, Gruppenniederlage und Begegnungsende brauchen jeweils ausdrückliche Aufräumregeln. Speichere Besitz und Restdauer über Neuladen/Import hinweg. Eine besiegte Beschwörung ist weder Inventargegenstand noch dauerhaftes Gruppenmitglied. Zauber-/MP-Kosten werden einmal für angenommene Erstellung abgebucht. Beschwörungsaktionen dürfen keine legendären Fenster außerhalb der Berechtigungsregeln des festgeschriebenen Boss-Modifikators erzeugen.

## 16. GM-Bosse, legendäre Aktionen und Reaktionen

### Implementierter allgemeiner Engine-Adapter

Neue im Einrichtungsassistenten erstellte Spiele aktivieren servergesteuerten Kampf. **GM directs bosses** (GM steuert Bosse) bestimmt die Anbieternutzung; gewöhnliche Gegner und KI-Begleiter laufen weiterhin lokal. Bestehende Spiele ohne `combatDirector` behalten ihren alten Auflöser. Die Begegnungseinrichtung schreibt GM-Schalter, Schwierigkeit, Seed, Gelände und Ausstattung fest, damit Einstellungsänderungen angenommene Regeln nicht mitten im Kampf umschreiben. Der Begegnungsgenerator muss `boss` ausdrücklich verfassen; hohe HP oder ein sichtbares Boss-Zeichen allein gewähren keine Zusatzaktionen. Ein Einzelboss wird unterstützt.

`combat-director.routes.ts` speichert einen versionierten serverseitigen Snapshot im bestehenden Spielzustandsspeicher unter `experience:marinara-engine.combat`, verankert an der Startnachricht der Begegnung. Er umfasst Initiativezeiger, Stapel ausstehender Wirkungen, verfügbare Optionen, Reaktions-/legendäre Budgets, Ressourcen, angenommene Anfrage-IDs und jüngstes Ereignisprotokoll. Befehle tragen Begegnungs-ID, Speicherinstanz-ID und Revision; doppelte oder veraltete Einreichungen liefern angenommenen Zustand. Inventarverbrauch und Kampfspeicherung teilen eine Transaktion. Anbieterantworten werden ebenfalls gegen gespeicherte Zeilenidentität, Revision und Fenster geprüft; späte Antworten können daher keinen Rückfall, keine Checkpoint-Wiederherstellung und keinen Zweig überqueren.

- **Classic:** Einzelne Initiativeplätze pausieren nun für manuelle Charakter- oder Boss-Entscheidungen. Die Kampfsteuerung löst eine Figur nach der anderen auf und führt vorhandene Rundenendmechaniken/-statusfortschreibung einmal aus. Ältere Spiele behalten ihre ursprüngliche vorgemerkte Rundensteuerung.
- **Tactical:** Inspektion/Auswahl einer Figur ist kostenlos. **Begin [name]'s turn** (Zug von [name] beginnen) bestätigt die Aktivierung verbindlich und öffnet eine mögliche Vorhersagegelegenheit. Bewegung allein erzeugt keine weitere Aktivierung und kein legendäres Fenster. KI-Begleiter und Gegner behalten die Phasenstruktur. Angenommene Geländebeschreibungen, Begegnungs-Seeds und Einrichtungsgröße bleiben maßgeblich. Neue Begegnungen ignorieren veraltete Kampagnen-Seed-Einstellungen.
- **Bosse:** Das anfängliche verfasste Budget beträgt normalerweise drei legendäre Punkte; jede angebotene Zusatzaktion kostet einen positiven Wert. Punkte werden bei gewöhnlicher Boss-Aktivierung aufgefüllt. Vorhersage und Gelegenheiten nach dem Zug teilen diesen Vorrat; Zusatzaktionen und Reaktionen erzeugen keine eigene legendäre Kette. Der Generator verfasst zulässige Angriffs-/Abwehr-/Bewegungs- und Fähigkeitskosten. Ein Mindless-Boss gehorcht Verfolgungsgrenzen; eine einzige zulässige Aktion läuft lokal.
- **Anbieter:** Nutze die konfigurierte GM-Werkzeugverbindung, ersatzweise die Chat-Verbindung. Liefere aktuelle Gruppen-/Gegnerfähigkeiten, Ressourcen, Gegenstandsmengen, Zustände, Profile, Positionen und angenommene Ereignisse. Sende niemals ausstehende private Befehle, RNG-Zustand oder getippte/überfahrene Spieleroptionen. Der GM gibt eine zulässige Kandidaten-ID zurück, niemals umgeschriebenen Zustand. Debug-Protokollierung für Prompt/Ergebnis folgt den vorhandenen Host-Funktionen. Eine Entscheidung läuft nach zehn Sekunden ab; zwölf Aufrufe je Runde sind die aktuelle Gesamtgrenze. Gewöhnlicher Rückfall nutzt lokale KI; optionale legendäre Fenster passen. Die UI kennzeichnet Rückfallereignisse und bietet lokalen Rückfall, während der GM aussteht. Das sind feste Anfangsgrenzen, keine konfigurierbaren Latenzgarantien.
- **Reaktionen:** Ausdrücklich mit `counterspell` und `guard` markierte Fähigkeiten besitzen Auslösefenster. Manuelle Charaktere erhalten Fähigkeits-/Ziel-/Kostenoptionen und **Pass** (passen); lokale KI bewertet Bedrohung/Knappheit, GM-Bosse wählen über denselben Anbietervertrag. Eine Einheit hat eine Reaktion, erneuert bei ihrer Aktivierung; ausdrückliche Abklingzeiten gelten weiterhin. Counterspells dürfen selbst Zauber sein und gekontert werden. Stabile Einheitenreihenfolge und gespeicherter Elternstapel begrenzen die Auflösung auf das Begegnungslimit von vierzig Einheiten. Passen verbraucht nichts.
- **Kosten:** Reserviere/verbrauche MP oder einen Zauberplatz exakt passenden Grades der erklärten Fähigkeit vor Reaktionen, ohne Doppelabbuchung bei Auflösung. Der allgemeine Adapter verbraucht diese Kosten auch bei gescheitertem Zauber oder Counterspell. Eine Reaktion verbraucht zusätzlich ihr Budget; legendäre Fähigkeiten zahlen verfasste Fähigkeitskosten und legendäre Punkte. Zauberplätze sind optionale ausdrückliche Ausstattungsdaten, nicht aus Klasse oder Fähigkeitsname abgeleitet. Höherstufiges Wirken oder ausgabenspezifische Erstattungsregeln sind nicht implementiert.
- **Allgemeine Wirkungen:** Counterspell hat eine Seed-bestimmte Chance von `clamp(65% + 3% × level difference, 20%, 95%)` und bricht nur ausstehende Wirkungen ab. Guard wendet die vorhandene Schadensreduktion beim Abwehren vorübergehend für diesen Angriff auf einen bedrohten Verbündeten an. Tactical-Reaktionen prüfen verfasste Reichweite und die gemeinsame Sichtlinie (combat C6), wie gewöhnliche Angriffe auch. Explizite `areaRadius` und `friendlyFire` ermöglichen Tactical-Angriffsflächen, während Classic mit `targetScope: all-enemies` einen einmal bezahlten Zauber auf die Gegengruppe anwendet. Das sind bewusst allgemeine Regeln, keine der beiden 5e-Counterspell-Ausgaben.
- **Bedienung:** Bestehende Kampfoberflächen zeigen maßgeblichen angenommenen Zustand, Reaktions-/legendäre Budgets und ein fokussiertes, per Tastatur bedienbares Auswahlpanel. Tactical-Inventar bietet tatsächlich unterstützte Gegenstände statt des alten unbegrenzten Platzhaltertranks. Neuladen stellt ausstehende Entscheidung wieder her. Die Korrektur Zurücksetzen vor Wiederherstellen bewahrt Begegnungsanker und Mechaniken, auch bei wiederholtem React-Einhängen in der Entwicklung. Ressourcensummen stehen im Kampfbericht.

**Aktuelle Grenzen:** Die Kampfsteuerung bietet weder das alte freie Manöver **Special** noch Kampfneustart an Ort und Stelle, da beiden noch ein maßgeblicher Aktions-/Rückspulvertrag fehlt; ältere Kämpfe behalten diese Steuerungen. Nutze vorhandene Geschichten-/Checkpoint-Funktionen zur Wiederherstellung. Das GM-Auswahlmenü ist auf sechzehn gewöhnliche/legendäre Optionen begrenzt; nur wenige neue Positionsziele werden angeboten. Guard ist Schadensreduktion, keine Bewegung/Abfangen oder Gelegenheitsangriff. Vorhandene Tactical-Vergeltung bleibt ein eigener automatischer Schlagabtausch, keine Zauberreaktion. Classic behält aktuelle Zufallswürfel und bestehende geskriptete Mechaniken; Tactical erhält Classics geskriptete Mechaniken nicht. Es gibt keinen vollständigen Tabletop-Adapter, keine Wiederbelebung, Beschwörungszuständigkeit, allgemeine Konzentration, höherstufiges Wirken oder wiederkehrende NPC-Profilregistrierung. Vollständige Bogennormalisierung und dauerhafte Ressourcen zwischen getrennten Begegnungen gehören weiter zur Regelsatzarbeit. Anbieterqualität und Spieltempo auf echten Geräten brauchen Spieltests.

### Angenommene Designanforderungen

**Angenommen:** Verfasste Bosse sollen legendäre Aktionen unabhängig von einem 5e-Regelsatz nutzen können. Der GM kennt Kampffähigkeiten/Ressourcen der Gruppe und kann vor einer gewöhnlichen Aktion aufgrund plausibler Vorhersage handeln. KI-Einheiten bewerten optionale Reaktionen und dürfen zum Ressourcensparen ablehnen. Dafür gibt es nun eine erste allgemeine Engine-Implementierung getrennt von der gewöhnlichen Zugstrategie.

### GM-Wissen und Vorhersage

Gib dem GM einen revisionsgebundenen Snapshot jedes Gruppenmitglieds: Fähigkeiten/Zauber, zulässige Reichweiten und unterstützte Flächenformen, aktuelle/maximale HP und MP/Zauberpunkte, Zauberplätze nach Grad, Abklingzeiten, Zustände, Ausrüstung, nutzbare Gegenstandszahlen und Restnutzungen. Ergänze gemeinsames Inventar mit Besitz/Zugriff, gegebenenfalls aktuelle Positionen, Beschwörungen, jüngste angenommene Aktionen und die Einheit bei Aktivierungsbeginn. Fehlende Daten sind unbekannt, nicht null oder unbegrenzt. Beziehe sie aus angenommenen Bögen und Inventar, nicht aus einer vom Modell erfundenen Zusammenfassung. Leserecht auf Gruppengegenstände gewährt dem Boss keine Nutzung oder Entfernung.

Der GM darf mit dieser breiteren Begegnungskenntnis Bedrohungen vorhersagen und zur Persönlichkeit/Erfahrung des Bosses passend handeln. Gewöhnliche lokale KI behält ihre bestehende Informationsgrenze. Keiner erhält künftigen RNG, private getippte Entwürfe, überfahrene Fähigkeiten/Ziele oder vorgemerkte Befehle anderer Einheiten vor deren Erklärung. Ein tatsächlich erklärter Zauber liefert nur regelgemäß sichtbare Auslösedetails; Kenntnis der Zauberliste belegt nicht, welchen Zauber die Figur wählen wird. Der Server darf den vollständigen Zustand validieren und dabei den Entscheidungskontext der Steuerung filtern.

**Fireball-Beispiel:** Der gewählte Magier hat Fireball verfügbar, genügend Ressourcen und eine zulässige Explosion, die den Boss bedroht, ohne Verbündete des Magiers zu treffen. Der GM darf daraus eine hohe Fireball-Wahrscheinlichkeit ableiten und einen legendären Punkt für zulässige Positionsänderung, Schutz oder Druck ausgeben. Er darf falschliegen und muss auch erwägen, weshalb ein Einzelzielzauber oder eine andere Aktion besser sein könnte. Er darf weder Ausweichen noch Verstummen oder kostenlose Bewegung erfinden. Nutze echte AoE-, Eigenbeschuss- und Sichtbarkeitsregeln der Engine; die ursprüngliche Einzelzielannäherung konnte diese räumliche Vorschau nicht tragen. Die Kampfsteuerung unterstützt nun ausdrücklich verfasste Angriffsflächen. Nutze in Classic/Summoning tatsächliche nicht räumliche Zielgruppen und Bedrohungen statt erfundener Rasterreichweite.

### Drei unterschiedliche Zeitfenster

Referenzverhalten: Die [Regeln für legendäre Aktionen von 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/monsters) platzieren diese nach dem Zug einer anderen Kreatur und erneuern das Budget im eigenen Boss-Zug. Den neu gewählten Magier **vor** seiner Aktion vorwegzunehmen ist eine bewusste Marinara-Erweiterung, kein normaler 5e-Zeitpunkt. Halte sie über einen ausdrücklichen, begegnungsgebundenen Boss-Modifikator unabhängig vom Regelsatz verfügbar; ein originalgetreues 5e-Profil nutzt den nativen Zeitpunkt, solange die Hausregel deaktiviert ist. Vermische dies nicht stillschweigend mit den [Monsterregeln von 2024](https://www.dndbeyond.com/sources/dnd/br-2024/how-to-use-a-monster).

| Fenster | Auslöser und verfügbare Informationen | Budget und Fortsetzung |
| --- | --- | --- |
| Vorwegnehmende legendäre Aktion | Aktivierung einer anderen Einheit beginnt; GM sieht Figur, Bögen und aktuellen Zustand, nicht deren unbestätigte Aktion | Aus vorhandenem legendärem Vorrat zahlen, dann Figur ihre Aktion wählen/neu prüfen lassen |
| Ausgelöste Reaktion | Unterstütztes Ereignis tritt ein, etwa Zauberbeginn; nur zulässige Auslösedetails offenlegen | Reaktionsbudget plus MP-/Zauberplatz-/Nutzungskosten zahlen, dann ausstehende Aktion regelgemäß fortsetzen oder abbrechen |
| Legendäre Aktion nach dem Zug | Andere Einheit beendet gewöhnliche Aktivierung | Aus demselben legendären Vorrat zahlen, dann nächste gewöhnliche Aktivierung beginnen |

Unterscheide in Tactical Inspektion/Auswahl einer Einheit vom **Beginn ihrer Aktivierung**. Die erste verbindliche Auswahl zum Handeln darf vor Bewegung/Aktion das Vorhersagefenster einmal pro Aktivierung öffnen. Nach Annahme dürfen Auswahlwechsel, Menüabbruch, Neuladen oder andere Eingabemethode es nicht erneut öffnen oder zur Ausbeutung weiterer Entscheidungen auf eine andere Figur wechseln. Bloße Inspektion bleibt kostenlos. Mache die Verbindlichkeit sichtbar; nach der Unterbrechung behält die gewählte Einheit ihre gewöhnliche Aktion, sofern kein echter handlungsverhindernder Effekt entgegensteht. Ein kurzer Hinweis ist besser als ein Boss-Angriff bei jedem Klick.

Classic sammelt derzeit Befehle vor der Auflösung einer gesamten Initiativerunde. Auswahl zur Befehlseingabe ist nicht die tatsächliche Aktivierung. Der künftige Auflöser muss am Initiativeplatz pausieren, die aktive Figur ohne ihren vorgemerkten Befehl zeigen, Vorhersage auflösen und danach den Befehl validieren/erklären. Wird eine vorgemerkte Wahl durch Unterbrechung unzulässig, fordere vor Zauberbeginn eine neue manuelle Wahl an oder bewerte KI neu. Rufe den GM nicht bei jeder Menüauswahl auf und ziehe keinen künftigen Initiativeplatz vor. Derselbe Lebenszyklus gilt für KI-Begleiter und künftige Beschwörungen.

Vorgeschlagene allgemeine Modifikatorstandards:

- Verfasse ausdrückliche Boss-Identität und ein kleines zulässiges legendäres Menü; leite GM-Rechte nicht aus höchsten HP ab.
- Beginne mit sichtbarem Budget von 3 Punkten, Aktionskosten 1–3, erneuert zu Beginn gewöhnlicher Boss-Aktivierung. Schreibe Anfangsbudget und Regeln für Überraschung/Handlungsunfähigkeit beim Begegnungsstart fest. Das ist Marinaras Abstimmungsvorschlag, keine Pflicht zum Kopieren eines veröffentlichten Monsters.
- Erlaube je Boss und berechtigter fremder Aktivierung höchstens eine vorwegnehmende und eine legendäre Wahl nach dem Zug, beide aus demselben endlichen Vorrat. So entsteht die gewünschte Vorhersage ohne mehr Punkte. Passen schließt ebenfalls das Fenster. Löse das vorige Fenster nach dem Zug vor Beginn der nächsten Aktivierung auf.
- In Tactical folgt das Fenster nach dem Zug auf Bewegung plus Aktion oder Wait, nicht auf Bewegungsklicks, jeden Schlag, Konter, Animationsbilder oder die ganze Spielerphase. In Classic folgt es auf den aufgelösten Initiativeplatz. End Turn schließt jede berechtigte übersprungene Aktivierung höchstens einmal; Beschwörungen folgen festgeschriebenen Berechtigungsregeln.
- Biete `pass` und ausschließlich zulässige Kandidaten im Budget an. Keine legendäre Aktion öffnet ein weiteres legendäres Fenster oder gewährt Geschwindigkeitsverdoppelung. Ein legendär gewirkter Zauber darf Counterspell nur bei Unterstützung durch den gewählten Regeladapter auslösen; Budgets bleiben getrennt.
- Prüfe vor Anfrage und Annahme erneut Lebend-/Handlungsstatus des Bosses, Zielzulässigkeit und Kampfende. Ein besiegter Boss darf keine späte Antwort ausgeben. Mindless-Kategoriegrenzen gelten weiterhin für Zielwahl/Verfolgung einschließlich legendärer Optionen.
- Unterscheide gewöhnliche Aktion, Reaktion, legendäre Aktion und Hort-/Phasenereignis. Sie haben getrennte Budgets/Auslöser; eine Beschreibung darf keinen neuen Schaden oder kostenlose Aktivierung schaffen.
- Gewöhnliche Begleitgegner bleiben lokale KI. GM-Aufrufe erfolgen nur in Boss-Fenstern mit sinnvoller Wahl. Nutze konfigurierte GM-Verbindung, Debug-Protokollierung, gespeicherten Rückfall und Gesamtlatenzlimit aus Abschnitt 8 wieder.

### Counterspell und weitere optionale Reaktionen

**Automatisch bewerten, gezielt ausgeben.** Counterspell zu besitzen bedeutet nicht, ihn gegen jeden Zauber zu wirken. Ein Auslöser öffnet die Wahl zwischen berechtigten Reaktionen und `pass`. KI-Begleiter und gewöhnliche Gegner wählen lokal anhand Ausstattung, Adjektiv, Erfahrung, aktuellen Vorräten und dem Wert, genau diese Wirkung zu verhindern. GM-Bosse nutzen ihre GM-Steuerung im selben zulässigen Fenster. Spielerfiguren erhalten React/Pass mit Kosten; verbrauche ihre knappen Zauberplätze nicht stillschweigend wegen des bloßen Fähigkeitsbesitzes. Zwingende passive Wirkungen folgen eigenen Regeln und werden nicht als freiwillige Reaktionen ausgegeben.

Bewerte erwarteten verhinderten Schaden/Kontrolle, vermiedene Niederlage eines Verbündeten, verhinderte wertvolle Gegnerheilung/-vorbereitung, geschätzten Erfolg und Opportunitätskosten sowohl der Ressource als auch der Reaktion bis zur nächsten Auffrischung. Counterspell darf, wenn regelgemäß, auch Heil-/Nutzzauber treffen, nicht nur Angriffe. Prüfe keine künftigen Würfe oder noch privaten Entscheidungen. Eine teure Reaktion auf einen harmlosen Zauber kann gegen Passen verlieren; der letzte Platz kann die Vermeidung einer Gruppenauslöschung wert sein. Reservevorlieben sind weiche Prioritäten, sofern der Spieler keine ausdrückliche harte Grenze festlegt.

| Stil / Ausstattung | Beispielhafte Reaktionspriorität |
| --- | --- |
| Protective Knight oder Mage | Verbündetenbedrohenden Schlag abfangen oder tödlichen Zauber kontern, nur mit entsprechender echter Fähigkeit |
| Cautious oder Patient Mage | Bei schwachem Zauber passen, um Reaktion und knappe Ressourcen für ernste Bedrohung zu behalten |
| Methodical Mage | Unterstützten Reinigungs-, Heil- oder Kontrollzauber verhindern, der den etablierten Plan brechen würde |
| Coordinated-Unterstützungszaubernder | Nach verbündeter Reaktion neu bewerten; keinen bereits aufgehobenen Zauber kontern und keine Reaktion doppelt reservieren |
| Reckless-Zaubernder | Bereitwilliger für offensiven Druck zahlen; kann dennoch bei erschöpftem Ressourcen-/Reaktionsbudget nicht wirken |
| Frugal-Zaubernder (vorgeschlagenes Adjektiv) | Billigere ausreichende Antwort oder Passen bevorzugen; letzten Platz gegen späteren Heil-/Schadensbedarf abwägen |

Nutze Fähigkeits-IDs und ausdrückliche Auslöse-/Wirkungsmetadaten, niemals das übersetzte Wort „Counterspell“. Jede Reaktion braucht Auslöser, Zeitpunkt, Ziel-/Sichtbarkeitsanforderungen, Ressourcenkosten, Reaktionskosten/-auffrischungsregel und Auflösungsoperation. Halte MP, Zauberpunkte und Zauberplätze getrennt. Counterspell wird beim Zauberbeginn vor seinen Wirkungen ausgelöst; Magierauswahl oder Öffnen seines Zaubermenüs genügt nicht. [Counterspell von 2014](https://www.dndbeyond.com/spells/2051-counterspell) und [Counterspell von 2024](https://www.dndbeyond.com/spells/2619072-counterspell) haben unterschiedliche Erfolgs-/Ressourcenergebnisse; der Adapter muss diese ausdrücklich definieren. Traditional braucht eine eigene dokumentierte Unterbrechungsformel/-kosten statt einer zufälligen Mischung.

Validiere vor Bindung erneut Auslöser, Lebend-/Handlungsstatus, Sichtbarkeit/Reichweite, Ziel und Mittel. Ziehe die gewählten Reaktionskosten auch bei gescheitertem Konter einmal ab, außer eine implementierte Regel erstattet sie. Kosten und Aktionsverbrauch des ausstehenden ursprünglichen Zaubers folgen getrennt von der Konterzahlung dessen eigenem Regelsatz. Passen verbraucht beides nicht. Keine automatische Erstattung wegen Animationsabbruchs. Vorgeschlagener Traditional-Standard: eine Reaktion pro Einheit, anfangs verfügbar ohne ausdrückliche Gegenbedingung, erneuert zu Beginn gewöhnlicher Aktivierung. Andere Adapter definieren eigene Menge/Auffrischungsgrenze; Unterbrechung oder geschwindigkeitsbedingter Folgeangriff frischt nie implizit auf. Vorhandene Tactical-Schlagabtauschkonter sind nicht automatisch Zauberreaktionen; bewahre ihre Semantik bis zur ausdrücklichen Regelsatzzuordnung.

### Unterbrechungsauflösung und Speicherung

[PR #6110](https://github.com/Pasta-Devs/Marinara-Engine/pull/6110) liefert ein nützliches Vorbild: ursprünglichen Aktionsversuch bewahren, angenommene Unterbrechung zeigen, folgenden Kontext sofort aktualisieren und Wiederherstellung/Wiederholung vor Überschreiben späterer Änderungen schützen. Die Roleplay-Implementierung schneidet Text an einer validierten wörtlichen Phrase ab; dieser Parser ist keine Engine für Kampfzeitpunkte oder Ressourcen. Nutze Speicher-/Sichtbarkeitsprinzipien wieder, nicht Textkürzung zur Entscheidung, ob Schaden geschah.

Stelle eine gewöhnliche Aktion als gespeicherte Erklärung, ausstehende Wirkungen und Auflösungsergebnis dar. Vorgeschlagene Folge: Aktivierungsbeginn und Budgetauffrischung → optionale Vorhersage → zulässige Aktionserklärung/Ressourcenbindung → berechtigte Reaktionsfenster → verbleibende Wirkungen → Aktivierungsende → legendäres Fenster nach dem Zug. Counterspell darf ausstehende Wirkungen abbrechen, niemals bereits angenommenen Schaden rückgängig machen. Validiere nach zustandsändernder Antwort den Rest der Aktion neu, einschließlich Ziele, Reichweite und handlungsverhindernde Zustände. Vor Zauberbeginn darf eine ungültig gewordene vorgemerkte Wahl ohne Kosten ersetzt werden; nach Beginn folgen Abbruch/Erstattung der gewählten Regel. Logs und GM-Erzählung müssen angenommene Ereignisse beschreiben, nicht die unausgeführte Fortsetzung eines versuchten Manövers.

Mehrere berechtigte Reagierende nutzen eine regeldefinierte stabile Priorität und prüfen nach jeder angenommenen Antwort erneut Zulässigkeit. Unterstütze verschachtelte Reaktionen wie Counterspell auf Counterspell nur durch ausdrückliche Regelsatzfähigkeit und begrenzten Stapel ausstehender Aktionen. Jeder Eintrag trägt Eltern-/Auslöser-ID; eine Einheit darf pro Auslöser einmal antworten und braucht verbleibendes Reaktionsbudget. Schließe erschöpfte, abgebrochene oder schon aufgelöste Auslöser. Keine unbegrenzte Rekursion, wiederholten Passen-Abfragen, doppelten Ausgaben oder legendären Ketten. Ein bewusst begrenzter erster Adapter muss nicht unterstützte Reaktionsketten offenlegen, statt vollständiges 5e-Verhalten zu behaupten.

Minimaler Speichervertrag: Begegnungs-ID, Revision, Aktivierungs-ID/-zeiger, bestätigte Figur, Fenstertyp/-ID, Auslöseereignis und ausstehende Aktions-/Eltern-IDs, Kontextrevision der Steuerung, Kandidatenrevision, Reihenfolge berechtigter/abgearbeiteter Reagierender, legendäre/Reaktionsbudgets, reservierte/gebuchte/erstattete Ressourcenänderungen, angenommene Wahl/Passen, Auflösungsstatus, Anbieteranfrage-/Rückfallergebnis und Restwirkungen. Nimm Entscheidungen samt Kosten/Ergebnissen atomar an. Späte oder doppelte Antworten dürfen nicht erneut zahlen. Wiederherstellung setzt ausstehendes Fenster fort oder spielt angenommenes Ergebnis ab; Verzweigung/Rückspulen isoliert das gesamte Kampfprotokoll, nicht nur Erzählung. Kein reines Text-Restore erstattet angenommene Reaktionen. Das unten beschriebene Serverprotokoll liefert die erste Implementierung; Abschnitt 8 behält den längerfristigen Vertrag.

UI: Zeige verbleibende legendäre Punkte, Reaktionsverfügbarkeit und angebotene Fähigkeitskosten; unterscheide Vorhersage und ausgelöste Reaktion. Zeige Unterbrechungsgrund und ob der ursprüngliche Zauber aufgelöst wird, scheitert oder neue Auswahl braucht. Mache Denken/Warten, Wiederholung/Rückfall und Abbruch barrierefrei zugänglich. Kündige aufgeladene Angriffe an, wo nötig. Behaupte niemals, der GM habe einen lokalen Rückfall gewählt. Halte interne Bewertungen/Prompts aus dem Spieleraktionsmenü heraus.

Erforderliche Nachweise: richtige Gruppenzauber/-ressourcen/-gegenstände im GM-Kontext; Vorschau bei erschöpften Ressourcen; plausible, aber falsche Fireball-Vorhersage; keine Entwurfs-/Befehlslecks; keine Ausbeutung bloßer Klicks/Neuauswahl; Spieler ändert zulässige Aktion nach Vorhersage; nativer 5e-Zeitpunkt gegenüber aktivierter Hausregel; Counterspell erst nach zulässigem Zauberauslöser; schwacher Zauber passiert, tödlicher wird angefochten; keine MP/Zauberplätze/Reaktion übrig; Kosten einmal bei gescheitertem Konter; regelspezifische Erstattung des Ursprungszaubers; unzulässige Sichtbarkeit/Reichweite; mehrere Reagierende und gekonterte Konter; kein zusätzliches legendäres Fenster bei Bewegung/Folgeangriff/Reaktion; richtiger Classic-Initiativeplatz; ungültig gewordene vorgemerkte manuelle Aktion; übersprungene Tactical-Einheiten/Beschwörungsberechtigung; erschöpftes legendäres Budget; genau einmalige Auffrischung; Tod/Ergebnis während Wartezeit; doppelte Anfragen; Zeitlimit mit spätem Erfolg; Neuladen, parallele Tabs, Verzweigung/Rückspulen und Einstellungsänderungen. Ergänze nach deterministischen Routentests echtes Anbieterverhalten und repräsentative Prüfung des Mobilspieltempos.

## 17. Übergabe für einen Begegnungsumgebungs-Agenten

Das Textfeld **Terrain guidance** (Geländehinweise) und seine Zusammenfassungszeile werden aus der Spielerstellung entfernt. Alte Einrichtungsdateien dürfen das Feld aus Kompatibilitätsgründen behalten, doch die Begegnungsgenerierung fügt es nicht mehr jedem Kampf hinzu. Battlefield Size bleibt eine wiederverwendbare Einrichtungsvorliebe. Neue Kämpfe erhalten eigene interne Seeds; gespeicherte Karten und Neustarts bewahren angenommene Seeds. Die Tactical-Bezeichnung beschreibt Bewegung, Gelände und Vorschauen ohne den Namen eines anderen Spiels.

Ein künftiger Agent **Battlefield Scout** soll bei Vorbereitung einer Begegnung den aktuellen Spielerort, jüngste Szene/Umgebung, verfasste Kartendetails, Wetter und relevante jüngste Ereignisse nutzen. Er sendet dem GM vor Begegnungsgenerierung eine knappe Umgebungsbeschreibung, nicht bei Welterstellung oder einmal pro gewöhnlichem Zug.

Grenze:

| Zuständig | Arbeit |
| --- | --- |
| `Pasta-Devs/Marinara-Agents`, `staging` | Agentendefinition, Standard-Prompt, Paketlaufzeit, Katalog/Manifest, Assets und eigene Einstellungen des Agenten |
| Marinara Engine, `staging` | Hook zur Begegnungsvorbereitung, begrenzter Szeneneingabevertrag, validierte Agentenergebnisübergabe, konfiguriertes Anbieter-Routing, Zwischenspeicherung und Rückfall, gespeicherte Geländeherkunft |

Eingaben müssen Begegnungs-/Ortsrevision tragen und beobachtete Fakten von unsicheren Vorschlägen unterscheiden. Ausgabe: kurze Zusammenfassung unterstützter Umgebungen, begrenzte Geländemerkmale gegebenenfalls nach vorhandenem Schema `TacticalBattlefieldBrief` und Quellenreferenzen. Keine ausführbaren Regeln, beliebigen Feldkoordinaten, erfundenen Ressourcen, Boss-Rechte oder HP-Änderungen. Classic darf beschreibende Gefahren/Kontext erhalten, aber keine Rastermodifikatoren ohne Auflöserunterstützung.

Der GM erhält angenommenen Kontext und erzeugt weiterhin die Begegnung; die Engine validiert das endgültige Gelände. Zwischenspeichere nach Begegnungs-/Ortsrevision, verwirf veraltete Antworten nach Reise/Szenenänderung und vermeide wiederholte kostenpflichtige Aufrufe bei Wiederholung. Bei Deaktivierung, Fehlen oder Zeitüberschreitung nutze aktuellen Generierungskontext mit gewöhnlichem prozeduralem Gelände-Rückfall. Speichere angenommenes Gelände, statt beim Neuladen neu zu generieren. Ergänze Debug-Prompt-Protokollierung und Schema-/Zeitlimit-/Veralteter-Ort-Tests. Dieser Agent wird hier dokumentiert, nicht innerhalb der Engine implementiert oder stillschweigend installiert.

### Prüfprotokoll der ersten Implementierung

Die lokale Basisprüfung `pnpm check` besteht, ebenso gezielte Kampf-KI-Regression, vorhandene Hybridgelände-Routen-/Einrichtungs-/Engine-Regressionen und `pnpm regression:prompt`. Gezielte Browsertests über tatsächliche Classic-/Tactical-Routen prüfen Begleiterauswahl, vorgemerkte manuelle Befehle, automatische Begleiteraktionen, angenommene Rundenspeicherung und Neuladen. Einrichtungs-/Überführungsprüfungen decken Entfernung der Geländehinweise, Seed null, ausdrückliche nicht englische Zaubertypen und ausdrücklich null MP ab. Desktop-Chromium im hellen und Chromium in Android-Größe im dunklen Design bestanden; WebKit konnte wegen fehlender Systembibliotheken nicht starten. Screenshots sind lokale Testartefakte, keine eingecheckten Dokumentationsassets.

Ein synthetisches offenes Brett mit 40 Einheiten und 64×64 Feldern, gemischtem Gehen/Fliegen/Teleportieren und Unterstützungsfähigkeiten benötigte auf diesem Host etwa 400–440 ms für eine gewöhnliche Gegnerphase. Das ist weder ein Worst-Case-Budget mit dichten Hindernissen noch eine Messung auf einem echten Telefon. Gleichgewicht und vollständiges Begegnungstempo brauchen weiter Spieltests. Diese Messungen betreffen nur den ersten Meilenstein; sie belegen keine Boss-Fensterlatenz oder künftigen Regelsatz.


### Prüfprotokoll der Boss-/Reaktionsimplementierung

`pnpm check` und `pnpm regression:prompt` bestehen. Die bestehende unabhängige Hook-Warnung in `GameNarration` bleibt. Gezielte Regressionen für gewöhnliche KI, Kampfsteuerung, Routen und Anbieter prüfen verbindliche Aktivierung, Erhalt normaler Züge, verschachtelte Konter, Passen, Zahlung gescheiterter Konter, leere MP/Zauberplätze, Flächenschutz, wandblockierte Reaktionen, gesperrte Züge, Inventartransaktionen, doppelte/veraltete Befehle, tatsächliches hartes Zeitlimit, Rundenaufruflimits und Checkpoint-/Zweigidentität. Der Anbieteradapter wurde gegen einen lokalen HTTP-Testaufbau ausgeführt, einschließlich tatsächlichem ausgehenden Kontext und Ablehnung fehlerhafter/unbekannter Auswahl. Das belegt Anbindung, keine strategische Qualität eines kostenpflichtigen Modells.

Sechzehn Desktop-/Mobil-Chromium-Prüfungen bestehen für alte und gesteuerte Classic-/Tactical-Begleitersteuerungen, echte Menüaktionen, Abschluss gewöhnlicher Runden, Neuladen ausstehender Reaktionen, genau einmaligen Verbrauch des letzten Zauberplatzes, Überführung generierter Fähigkeiten und Einrichtungsbereinigung. Screenshots wurden im hellen Desktop- und dunklen Mobildesign geprüft; das Reaktionspanel ist sichtbar, fokussiert und bedienbar. Leistung echter Geräte, aktuelle WebKit-Abdeckung und Qualität/Tempo realer Anbieter bleiben ungeprüft. Der erweiterte Routennachweis führt auch das tatsächliche Zehnsekundenlimit aus und verwirft spätere Antworten. Diese Validierung nutzte keinen Live-Spielmodellaufruf. Der Maintainer genehmigte anschließend externes CodeRabbit-Review als Teil des erwarteten Projektablaufs; das erste lokale Review endete mit 15 Befunden.


### Lokale CodeRabbit-Nacharbeit

Der erste Durchlauf führte zu Korrekturen bei angenommenem Classic-Gegenstandsverbrauch nach Wiederholungen/übersprungenen Zügen, Tactical-Fähigkeitsstärkenvorschauen, einem abwärtskompatiblen öffentlichen KI-Einstieg, reinen Gegner-Boss-Metadaten, fehlerhaften Zustandsabfragen und importierten Entscheidungskosten, fehlenden automatischen Gegnerphasenereignissen, fehlender Maximum-MP-Normalisierung, ungültigen gesteuerten Einheiten-IDs, Menüs reiner Reaktionsfähigkeiten, Anbieter-Testaufbau-Bereinigung und gemeinsamer Verbindungsauflösung auf Dienstebene. Der Gegenstandsbericht nahm mehrere Gruppen-Gegenstandsmenüs an; derzeit hat nur der Anführer eines. Das Entfernen der veralteten Gegenstandsreferenz behebt dennoch ein echtes Problem abgebrochener Wiederholungen. Verbrauch folgt nun angenommenen Befehlen und tatsächlichen Aktionsergebnissen.

Geprüfte, mit codegestützter Begründung beibehaltene Entscheidungen:

- Zauberplätze nehmen absichtlich nur Grade 1–9 an. Nicht unterstützte Schlüssel aus generierten Bauplänen stillschweigend zu verwerfen könnte ungültige verfasste Ausstattung verbergen; das bestehende Schema lehnt sie ab. Zaubertricks und benanntes Regelsatzverhalten gehören zum getrennten Regelsatzvertrag.
- Gewöhnliche KI-Kosten fallen jetzt bei fehlendem Maximum von maximalen auf aktuelle MP zurück. Reaktionsknappheit dividiert absichtlich durch **verbleibende** MP: Ein Counterspell, der die letzten Punkte verbraucht, muss auch bei ursprünglich großem Vorrat als teuer gelten.
- Boss-Kandidatenzählung erstellt ihre Liste erreichbarer Felder bereits einmal. Jeder Kandidat passiert weiterhin die maßgebliche Aktionsvalidierung. Wiederholte Zulässigkeitsprüfungen zu entfernen oder getrennt zu cachen braucht Leistungsnachweise und muss diese Grenze bewahren; das war ein Leistungsvorschlag, kein beobachteter Fehler unzulässiger Aktionen.
- `CombatAttackResult` hat keine bestehende Kennzeichnung des Grundes einer gescheiterten Aktion. Der neue profilgestützte Auflöser lehnt unverfügbare Fähigkeiten vor Ausführung ab, die Kampfsteuerung validiert vor Zahlung. Ein neues Ergebnis-/UI-Protokoll allein für den älteren wirkungslosen Rückfall bleibt eine Darstellungsverbesserung für später; der Rückfall wirkt nicht und verbraucht keine Ressourcen.

Der zweite vollständige lokale Durchlauf endete mit sechs Befunden. Korrigiert wurden Zusammenführung angenommener Zauberplätze und Zurücksetzen veralteter Props im eigenständigen Classic-Bildschirm, direkte Profilzuweisung bei Einheitenerstellung, GM-Charakterisierung aus Kartenfeldern statt serialisierten Metadaten, Blockierung von Reaktionsfähigkeiten in beiden älteren gewöhnlichen Befehlspfaden und automatischer Auswahl sowie wiederherstellbare Fehlermeldung bei fehlerhaften gespeicherten Zustandslesevorgängen.

Der übrige Bauplanvorschlag ist nicht anwendbar: `CombatAttack[]` in gemeinsamen Begegnungstypen, der generierte Begegnungs-Prompt und `combatSkillsFromGeneratedAttacks` verlangen Angriffsobjekte mit Namen. Reine Zeichenketteneinträge besitzen keine unterstützte Laufzeitüberführung. Das Objektschema bleibt streng, statt Daten anzunehmen, die der Kampfbildschirm nicht nutzen kann.

Nach den Korrekturen bestehen `pnpm check` und `pnpm regression:prompt`. Vier Kampfregressionen und die Hybridgelände-Routenregression bestehen, einschließlich tatsächlicher Anbieterkontextextraktion ohne Kartenkommentare/Bearbeitungsnotizen. Sechzehn Desktop-/Mobil-Kampfprüfungen bestanden nach den ersten Korrekturen; die letzten acht Classic-Browserprüfungen bestehen ebenfalls mit ausdrücklicher Abdeckung von Gegenstandswiederholung, übersprungenem Gegenstand und Erschöpfung des letzten Platzes. Ein Build-/Neuladezusammenstoß unterbrach einen früheren Browserlauf; der erfolgreiche Wiederholungslauf fand nach Build-Ende statt. Das dritte Review fand die leere Classic-Fähigkeitsanzeige bei ausschließlich Reaktionsfähigkeiten, nun in beiden Layouts korrigiert. Der entsprechende ältere Tactical-Heil-/Auflösungspfad lehnt reine Reaktionsfähigkeiten ebenfalls ab. Die abschließende Review-Prüfung steht unten.


Weitere Review-Entscheidungen:

- Der Tactical-Aktionsendpunkt führt Steuerungswechsel bereits über `applyTacticalTurn` und `applyAction`; `applyAction` verbietet KI-Zuweisung zur ersten lebenden Gruppeneinheit. Die Routenregression führt diese Anfrage nun aus und prüft HTTP 400 mit dem Fehler für den manuellen Anführer. Eine doppelte Regel in der Route würde eine zweite Wahrheitsquelle schaffen.
- KI-Hinweise und Unterbrechungsfelder dürfen fehlen. Wenn angegeben, müssen sie ihre ausdrücklichen Schemas erfüllen. Fehlerhafte Fähigkeiten still abzufangen und zu verwerfen würde generierten Counterspell, Kosten oder Boss-Ausstattung ohne Erklärung in andere Regeln verwandeln. Der Vorschlag, jede optionale Fähigkeit gegenüber ungültigen Werten tolerant zu machen, ist eine bewusste Verhaltensänderung, keine fehlende Schutzprüfung.
- Ein engerer exportierter Alias `TacticalUnitAction` ist eine Typbereinigung. Die Laufzeitsteuerung kehrt in `applyAction` bereits vor gewöhnlicher Validierung/Ausführung zurück, und die Aktionsschemas der Kampfsteuerung schließen Steuerungsänderungen aus. Das blockiert die Funktion nicht; eine spätere API-Bereinigung darf die interne Union ohne Verhaltensänderung verengen.


Die Inventarspeicherung älterer Kämpfe bleibt eine getrennte Folgearbeit. Das Review stellte fest, dass `GameCombatUI` den Inventar-Callback nach einem alten Rundenergebnis entkoppelt. Das besteht bereits in der Basisrevision, die ebenfalls `void onInventoryItemUsed?.(usedItemName)` nutzt. Bloßes Warten darauf ist keine idempotente Korrektur: `handleUseCombatInventoryItem` behandelt Fehler intern, und alten Runden fehlt eine maßgebliche gespeicherte Anfrage-/Ergebnistransaktion zur Wiederholung. Neue gesteuerte Kämpfe umgehen diesen Callback und nutzen atomaren Inventarabzug plus Speicherung angenommenen Zustands im Serverprotokoll. Bestehende ältere Kämpfe behalten die alte Grenze; gemeinsame Migration ihrer Runden- und Inventarspeicherung braucht eine ausdrückliche Kompatibilitätsmigration. Diese Grenze ist dokumentiert und wird nicht durch Gegenstandswiederholungs-/Befehlsvormerkungsänderungen als behoben behauptet.

Die Reaktionsverfügbarkeitsanzeige nutzt nun Singular-/Pluralvarianten des Lokalisierungskatalogs. Abschließende gezielte Kampfregressionen, Client-Typen, Workspace-Lint und der Anführersteuerungs-Routennachweis bestehen nach den kleinen Reaktionsschutzprüfungen; die bestehende Hook-Warnung in `GameNarration` bleibt.


Die Abschlussprüfung führte außerdem zu deterministischen Standardaktions-/Abwehrrückfällen für Classic-Einheiten ohne gespeichertes Profil oder verbleibende Gegner sowie begrenzten Gruppenbefehlskennungen, die lebende Gruppenfiguren benennen müssen. Die gezielten Regressionen und Server-Typprüfungen bestehen; Lokalisierungsvalidierung für Reaktionszahlplurale besteht.

Verbleibende Vorschläge ohne Verhaltenswirkung sind zurückgestellt: identische Zauberplatzschemas deduplizieren, eine ID ausstehender Aktionen zurückgeben statt unmittelbar nach synchroner Erklärung den neuesten Eintrag zu nutzen, interne Aktionstypen verengen und die Sortierung der Teleport-Suchfront durch Minimumsuche ersetzen. Der aktuelle Code hat ausdrückliche Grenzen, bewahrt Einzelaktionsvalidierung, und zwischen Einfügen und Auswahl des ausstehenden Eintrags liegt keine andere Erklärung. Die Vorschläge belegen kein geändertes Kampfergebnis. Ebenso wird ältere Abklingzeit 0/fehlend vorübergehend als 1 gespeichert und am Ende desselben Ganzrundenauflösers gesenkt; die Fähigkeit ist bei nächster Aktivierung verfügbar. Die Kampfsteuerung nutzt einen getrennten Zahlungspfad je Aktivierung direkt mit 0. Gleiche Zwischenwerte sind für identisches Verfügbarkeitsverhalten nicht nötig.


Die vorgeschlagene Cache-Änderung nimmt an, `/director/start` sei nicht idempotent. Für angenommenen Chat/Anker ist die Route idempotent: Die serialisierte Route lädt und liefert das vorhandene Protokoll vor Erstellung/Zahlung, und die Routenregression prüft, dass Startwiederholung mit veralteten Client-Kämpfenden genau die angenommene Sitzung zurückgibt. Auffrischung bei erneutem Einhängen/Verbinden lässt den Client wiederhergestellten oder aktualisierten Serverzustand sehen. Deaktivierung würde veraltete Kämpfe im Cache halten; ausdrückliche Aktualisierung bleibt verfügbar, Wiederholungen sind deaktiviert.

Der vierte lokale Durchlauf endete mit 15 Befunden einschließlich Wiederholungen und optionaler Bereinigung. Seine verbleibende Verhaltenskorrektur beachtet ausdrückliche Mindless-Hinweise für andere/unbekannte Kategorien; die gezielte Regression reproduzierte den ignorierten Hinweis vor der Korrektur. Gespeicherte Profile behalten ihr etabliertes Verhalten. Die vorgeschlagene Obergrenze 40 für die Map ausstehender Aktionen würde einen gültigen letzten Stapeleintrag ablehnen: Die Erklärung fügt zuerst ein und unterdrückt weitere Reaktionsaufgaben erst bei mehr als 40, daher ist die Speichergrenze 41. Flächenradius 0 bedeutet bewusst keine Flächenerweiterung und entspricht beiden Auflösern. Den geerbten dynamischen Anbieterimport der Verbindungshilfe in einen statischen zu ändern ist optionale Bereinigung. Es wird kein Review ohne Befunde behauptet; die bestehende Folgearbeit zur alten Inventarspeicherung oben bleibt offen.

Abschließende Validierung nach allen Review-Korrekturen: `pnpm check` besteht einschließlich Lokalisierung, Formatierung, Typen, Lint und Produktions-Builds; die gezielte Kampf-KI-Regression besteht nach vorherigem Nachweis des Mindless-Hinweisfehlers. Frühere Prompt-, Kampfsteuerungs-/Routen-/Anbieter- und Desktop-/Mobil-Browserergebnisse gelten wie oben festgehalten. Die letzten kleinen Review-Korrekturen wurden lokal geprüft, gefolgt von einem weiteren externen Review bei der PR-Vorbereitung.


### Review zur PR-Vorbereitung

Implementierungszuständigkeit und Umfang werden in [#6299](https://github.com/Pasta-Devs/Marinara-Engine/issues/6299) verfolgt; Übersetzungsparität dieser beiden Entwicklungsübergaben in [#6300](https://github.com/Pasta-Devs/Marinara-Engine/issues/6300). Der gemeinsame Skill-Symlink löst auf, und alle 52 Skill-Dateien wurden bytegenau mit ihren vorherigen Git-Inhalten verglichen. `pnpm check` besteht nach dem Verschieben. `AGENTS.md` ist eine getrennte Codex-Anpassung von `CLAUDE.md` mit ausdrücklichem Übergang von Entwurf zu bereit, sobald Implementierung, erforderliche lokale Validierung und lokales Review abgeschlossen sind.

Entscheidungen der Veröffentlichungsreviewrunde:

- Der Impeccable-Skill liegt in `.agents/skills/impeccable`. Die Kopie unter `.claude/skills` und ihr Alias `.agents/skills` wurden am 2026-10-07 entfernt; die Impeccable-Projektprüfung liest den Skill aus `.agents/skills`.
- Befunde zu Impeccable-Beispielen, Wortwahl, Herkunft des übernommenen Bundles und bestehenden Live-Werkzeuginterna betreffen ohne Inhaltsänderung verschobene Dateien. Sie sind keine Regressionen dieses PR. Die Migration bewahrt den installierten Skill, statt ein getrenntes vorgelagertes Skill-Wartungsprojekt einzubeziehen.
- Tactical-Gegenstandsumfang `any` wird von `CombatItemEffect`, Routenvalidierung und Zielprüfungen der Kampfsteuerung ausdrücklich unterstützt. Jeden Nicht-selbst-/Nicht-gegnerisch-Umfang durch `ally` zu ersetzen würde unterstütztes Verhalten brechen. Der bestehende Standard gilt nur bei fehlendem Umfang.
- Vorzeitige Verfolgungsberechnung ist begrenzt und verändert nicht, welche zulässige Aktion gewinnt. Sie erst bei Bedarf auszuführen ist optionale Leistungsoptimierung; die protokollierte Phasenmessung mit gemischter Bewegung bleibt aktueller Nachweis, keine Behauptung, weitere Optimierung sei unmöglich.
- Generierte Angriffsfähigkeiten werden durch das Begegnungsschema und erneut durch Start-/Aktionsschemas der Kampfsteuerung validiert. Fehlerhafte ausdrückliche Kosten/Fähigkeiten bei Laufzeitüberführung durch Standardwerte zu ersetzen würde verfasste Ausstattung still ändern. Halte fehlende Felder kompatibel und angegebene validiert, wie oben beschrieben.
- Die wiederholte Forderung, Startabfrage-Aktualisierungen zu deaktivieren, wird aus den genannten Idempotenz-/Veralteter-Zustand-Gründen abgelehnt; der tatsächliche Routenwiederholungsnachweis bleibt maßgeblich.

Das Veröffentlichungsreview endete mit 34 Befunden: 30 im unverändert verschobenen Skill und vier im Kampfcode. Alle vier Kampfvorschläge sind durch obige Entscheidungen abgedeckt: bedarfsabhängige Verfolgung, unterstützte `any`-Gegenstandszielwahl, idempotente Start-Neuabfragen und ausdrückliche Fähigkeitsvalidierung. Diese Runde erforderte keine weitere Implementierungsänderung. Frühere angenommene Befunde bleiben behoben und getestet. Dies ist ein geprüftes Ergebnis mit begründeten Entscheidungen, keine Behauptung von null Befunden.

## Folgearbeit zu Schwierigkeit und Wetter

Siehe [Kampfschwierigkeit und Wetter](game-combat-difficulty-weather.md) zur Implementierung von #6305: normalisierte Schwierigkeit, ausschließlich gegnerische Traditional-Schadensmodifikatoren, Seed-bestimmte Entscheidungsbeständigkeit, angenommenes Wetter in beiden Modi, ausdrückliche Angriffseigenschaften, Neutralität geschützter/unbekannter Exposition und feste Bedingungen über Neuladen hinweg. Alternative Regelsätze müssen vor Übernahme der Schadensskalierung ihre eigene Schwierigkeitsregel festlegen.
