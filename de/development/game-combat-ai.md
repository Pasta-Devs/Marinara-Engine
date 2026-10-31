# Kampf-KI im Game Mode

Wie die Engine entscheidet, was Gegner und KI-gesteuerte Begleiter in Classic, Tactical und Regelsatz-Kämpfen tun, und wie der Game Master Bosse spielt. Der Code steht in `packages/shared/src/features/combat-ai.ts`, `combat-minds.ts`, `tactical-combat/ai.ts` und `tactical-combat/profile-ai.ts`; die Serverseite steht in `packages/server/src/services/game/combat-director.service.ts`, `combat-ai.service.ts`, `combat-boss.service.ts` und `ruleset-combat-director.service.ts`. Wie der Kampf in Game Mode als Ganzes eingebettet ist, erfährst du unter [Architektur von Game Mode](game-mode-architecture.md).

Zahlen in den Implementierungsabschnitten ([Aktueller Umfang der gewöhnlichen KI-Implementierung](#current-ordinary-ai-implementation-boundary) und den Abschnitten zu benannten Konstanten) geben die aktuelle Abstimmung der Engine wieder. Als Beispiel, Vorschlag, vorläufig oder Designziel gekennzeichnete Zahlen tun das nicht; keine dieser Zahlen stellt eine durch Spieltests belegte Aussage zur Spielbalance dar. Beschwörungen in Marinaras eigenem Classic- und Tactical-Kampf sind weiterhin ein Vorschlag ([Designerweiterung Summoning](#summoning-design-extension)); Regelsatz-Kämpfe beschwören über ihre eigenen `summons`-Regeln.

## Fähigkeit, Temperament und Steuerung trennen

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

## Adjektivkatalog

### Die anfänglichen acht

| Adjektiv         | Zielvorliebe                                                             | Positionierung und Risiko                                                                                    | Fähigkeiten-/Ressourcenverhalten                                                                                      | Was der Spieler lernen kann                                   |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **Mindless**      | Nächstes lebendes erreichbares Gruppenmitglied gemäß der Regel in [Mindless: genauer Verfolgungsvertrag](#mindless-an-exact-pursuit-contract)               | Kürzester zulässiger räumlicher Weg; ignoriert Geländenutzen, Gefährdung und Formation                           | Einfacher zulässiger Angriff auf dieses Ziel; keine Heilpriorisierung, Feuerkonzentration oder Ressourcenoptimierung                   | Mit Nähe, Gelände und Engpässen ködern             |
| **Reckless**      | Sofortiger Schaden und erreichbarer Druck; nicht automatisch das schwächste Opfer | Schließt aggressiv auf, nimmt Konter und ungeschützte Ziele in Kauf                                  | Nutzt starke verfügbare Angriffe bereitwillig; hält selten zur Abwehr inne                                             | Überdehnung bestrafen und in ungünstige Schlagabtausche locken            |
| **Cautious**      | Ziele, die bei begrenztem Gegenschaden bedroht werden können                          | Schätzt sichere Ziele, nützliche Reichweite und defensives Gelände                                            | Schont knappe Ressourcen, wenn ein Standardangriff fast ebenso nützlich ist; heilt/wehrt bei Bedarf ab                | Sicheren Raum unter Druck setzen; Zurückhaltung beim Festlegen ausnutzen   |
| **Opportunistic** | Verwundete, ungeschützte oder bereits beeinträchtigte Ziele; verlässliche Abschlusschancen   | Akzeptiert etwas Risiko für eine konkrete Gelegenheit                                                                | Schätzt Fähigkeiten, die solche Gelegenheiten schaffen oder nutzen                                                      | Verletzliche Verbündete schützen und einfache abschließende Angriffe verhindern   |
| **Protective**    | Bedrohungen eines bestimmten verletzlichen Verbündeten oder einer nahen unterstützten Gruppe          | Bleibt in Unterstützungsreichweite; besetzt bei Zulässigkeit nützliche blockierende Felder                                    | Nutzt Abwehr/Unterstützung zum Erhalt des Schützlings; greift an, wenn Schutz nicht dringend ist              | Gruppe auseinanderziehen oder aus mehreren Richtungen angreifen   |
| **Supportive**    | Gesundheit der Verbündeten und nützliche Verstärkungen vor eigenem Schaden                           | Bewegt sich in zulässige Unterstützungsreichweite und vermeidet unnötige Gefährdung                                        | Heilt nennenswert fehlende HP, vermeidet nutzlose Überheilung/doppelte Verstärkungen, greift bei geringem Unterstützungsnutzen an | Unterstützungseinheit bedrängen oder von Begünstigten trennen |
| **Disciplined**   | Rollengerechte Ziele, vernünftige Abschlussgelegenheiten                      | Wägt Schaden, Sicherheit, Positionierung und Ressourcen ab; mäßige Zielbindung                            | Verlässliche Rollengrundlagen ohne extremes Spezialverhalten                                               | Rolle stören und ungünstige Entscheidungen erzwingen              |
| **Cowardly**      | Sicher erreichbare Ziele, die keinen Gegenschlag einladen                       | Selbsterhaltung steigt bei Verwundung oder lokaler Unterzahl stark; zieht sich in sichereren verbündeten Raum zurück | Heilt sich/wehrt eher ab und vermeidet kostspielige Bindungen                                                | Sicheren Rückzug abschneiden und anhaltenden Fernkampfdruck ausüben    |

Protective leitet Schaden nicht magisch um, provoziert keine Ziele, fängt keine Angriffe ab und erhält keine Reaktionen. Aktuelle Belegung erlaubt Positionsblockaden; stärkerer Schutz braucht tatsächliche Fähigkeiten. Cowardly darf zurückweichen und abwehren, doch die vorhandene Tactical-Aktion `flee` beendet den gesamten Kampf. **Nutze globale Flucht niemals als Flucht eines einzelnen Gegners.** Ein einzelner Gegner verlässt einen Kampf nur durch Moral („Den Mut verlieren in Classic und Tactical“ unter [Praktische Leitplanken](#practical-guardrails)) oder durch eine Flucht nach den Regeln des Regelsatzes.

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

<a id="assigning-profiles-role-experience-personality-then-seeded-variety"></a>

## Profilzuweisung: Rolle, Erfahrung, Persönlichkeit, dann Seed-bestimmte Vielfalt

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

Erfahrung beeinflusst **sowohl** die Chance auf rollengerechtes Temperament bei Erstzuweisung als auch dessen beständige Umsetzung. Für gewöhnliche lokale KI offenbart sie weder verborgene Spielerfähigkeiten noch vorgemerkte Befehle. GM-Bosse erhalten die breitere Kenntnis der Gruppenbögen aus [GM-Bosse, legendäre Aktionen und Reaktionen](#gm-bosses-legendary-actions-and-reactions); keine Steuerung sieht künftige Zufallswürfe oder unbestätigte Spielerentscheidungen. Die Überlebensannahme ist eine nützliche Weltbau-Tendenz, kein Tatsachengesetz, dass alle erfahrenen Zauberer vorsichtig seien.

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
- Wie stark eine Einheit schwankt, bemisst sich daran, wie viel ihr Zug voraussichtlich einbringt; die volle Schwankung gilt, sobald der beste Kandidat etwa ein Drittel eines Gegners einbringt. Gegen eine Gruppe, die zu widerstandsfähig ist, als dass ein einzelner Schlag ihr viel anhaben könnte, macht jeder Schlag nur einen kleinen Anteil eines Gegners aus, und eine pauschale Schwankung würde zwischen einem vollen Multiattack und zwei mit Nachteil geworfenen Dolchen entscheiden. Der Drang einer methodischen Einheit zu ihrem letzten Ziel schrumpft ebenso und zusätzlich danach, wie viel weniger der Schlag gegen dieses Ziel wert ist.
- Ein Schlag, der deutlich weniger einbringt als der beste verfügbare (unter 97 Hundertstel) und bereits schlechter bewertet wird, erhält überhaupt keine Schwankung, sodass ein Anfänger nie zwei Dolche, die 93 Hundertstel eines Multiattack wert sind, durch Schwankung darüber hebt.
- Was eine Einheit an einem Ziel bevorzugt (der Fokus ihres Verstands: das gefährlichste, das schwächste), gibt nur zwischen Schlägen den Ausschlag, die ähnlich viel Schaden anrichten: Ein Schlag, der weniger als 97 Hundertstel des Schadens ihres härtesten anrichtet, erhält davon nichts.
- In Regelsatz-Kämpfen zählt bei der Gefahr, der eine Einheit dort ausgesetzt ist, wo sie zum Kämpfen bleibt, ein Gegner, der zu ihr gehen und sie dort schlagen kann, fast als so gefährlich wie einer neben ihr (am äußersten Ende seines Gangs ein Zehntel weniger), sodass es nie sicherer erscheint, sich sechs Felder von einem Ritter zu entfernen, um aus großer Entfernung zu werfen, als an ihn heranzutreten. Bei einer Flucht gilt das äußerste Ende eines Gangs weiterhin als wesentlich sicherer, und sie führt nie in einen Durchgang, in den sich die Einheit zwängen müsste, wenn sie auch ungehindert Platz findet.
- Ein Leibwächter außerhalb seines Bewegungsradius führt keinen Gang mit anschließendem Schlag aus, der außerhalb des Radius endet, selbst wenn er näher endet als sein jetziger Standort: Stattdessen geht er zurück.
- Ein Multiattack, dessen Ziel während der Ausführung zu Boden geht, richtet seine übrigen Teile auf den jeweils nächsten anderen Gegner, den jeder Teil erreicht (keiner: Die Teile werden nicht ausgeführt); einer, der auf jemanden zielt, der bereits am Boden ist, wird wie gewählt ausgeführt, und eine grausame Kreatur macht bei den Gefallenen weiter.
- Das Kampfprotokoll nennt vor dem Wurf, was eine Moralprüfung ausgelöst hat, einen Temperamentwechsel und dessen Auslöser, wen ein Gang mitgeschleift hat, eine territoriale Kreatur, die ihr Gebiet hält, und die Aufgabe einer Gruppe. Eine Kreatur, die sich ergeben hat, bleibt dort auf dem Brett, wo sie aufgegeben hat.
- In Regelsatz-Kämpfen ist der Schadenswert eines Schlags sein erwarteter Schaden im Verhältnis zur mittleren Gesundheit der Zielseite, unabhängig davon, wen er trifft, sodass die höhere Gesundheit eines Ritters einen Multiattack gegen ihn nicht weniger wert macht als denselben Schaden gegen den Zauberer. Ein Schlag, der sein Ziel zu Boden bringen würde, wird nach der eigenen Gesundheit des Ziels gewichtet, wobei es nie als gebrechlicher als drei Viertel dieses Mittelwerts gilt.

<a id="mindless-an-exact-pursuit-contract"></a>

## Mindless: genauer Verfolgungsvertrag

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

## Gewöhnliche Gegnerentscheidungen

### Auflöser wiederverwenden, Prioritäten variieren

Erzeuge zunächst zulässige Aktionskandidaten und bewerte sie dann mit Rollen- und Adjektivgewichten. Nutze vorhandene Hilfen für Bewegung, Vorschau und Bereitschaft; ergänze die kleinste gemeinsame Zulässigkeitsfunktion für Engine-KI und GM-gesteuerte Einheiten. Rufe das ausschließlich verändernde `performUnitAction` nicht mit unvalidierten Modelleingaben auf.

Kandidaten sollen umfassen:

- Standardangriff und nutzbare Angriffsfähigkeiten einschließlich zulässiger Ziele für Bewegung vor Aktion.
- Heilung, Verstärkung und Schwächung gegen die richtige Seite einschließlich Bewegung in Unterstützungsreichweite.
- Abwehr, Warten und zielgerichtete Bewegung, wenn kein nützlicher Angriff und keine Unterstützung verfügbar sind.

Nimm nur tatsächlich vom Auflöser unterstützte Mechaniken auf. Gegnergegenstände brauchen zuerst echtes Inventar/Abrechnung. AoE-Geometrie, Beschwörungen, Provokationen, neue Reaktionen, Gelegenheitsangriffe, Deckung und Flucht darf die Bewertung nicht erfinden. Tactical besitzt bereits Konter und Abwehr/Warten; Classic braucht ausdrückliche automatische Abwehr-/Warte- und richtige Verstärkungs-/Schwächungsoperationen für gleichwertige Profile. Das ist Auflöserarbeit, nicht bloß veränderte Gewichtung.

Nutze normalisierte Faktoren für erwarteten Schaden, Abschlusswahrscheinlichkeit, nützliche Heilung/Unterstützung, sofortiges Konterrisiko, Gefährdung in der nächsten Phase, Fortschritt zur rollengerechten Gefechtsreichweite und Ressourcenkosten. Multipliziere sie mit einer kleinen Profiltabelle. Ein sehr großer universeller Kill-Bonus würde Temperamentunterschiede auslöschen; ersetze ihn für die neue Strategie durch einen begrenzten profilabhängigen Abschlusswert.

Dies ist ein kleiner nutzwertbasierter Ansatz: Vergleiche zulässige Aktionen mit konsistenten Skalen und variiere Prioritäten nach Persönlichkeit. Den allgemeinen Ansatz und Entscheidungsträgheit beschreibt David „Rez“ Graham in [Einführung in die Nutzwerttheorie](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf). Konkrete Profile, Formel, Standardwerte und Anbindungsplan hier sind Marinara-spezifische Designempfehlungen.

<a id="practical-guardrails"></a>

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

**Den Mut verlieren in Classic und Tactical (Kampf-KI E1, E2).** Ein gesteuerter Kampf in Classic oder Tactical wendet die Moralregel der alten Spiele auf jeden Gegner an, der weder Boss noch Mindless ist. Jeder Gegner hat einen Moralwert auf der Skala von 2 bis 12: `aiHints.morale` aus dem Bauplan, wenn die Geschichte einen angibt, sonst 7 für einen instinktiven oder gewitzten Verstand, 8 für einen taktischen und 9 für einen genialen, verändert durch das Temperament (feige −3, vorsichtig −1, schützend +1, rücksichtslos und diszipliniert +2) und um einen weiteren Punkt für einen Anführer. Zu Beginn eines seiner Züge prüft er jeweils einmal und in dieser Reihenfolge, ob er überrascht wurde (`surprised` im Bauplan), sein Anführer am Boden ist (`aiHints.leader` oder ein Boss), die Hälfte seiner Seite am Boden ist, der erste seiner Seite am Boden ist und seine Gesundheit durch Verletzungen unter die Hälfte gefallen ist. Übersteigt die Summe zweier Würfel seinen Wert, bricht seine Moral. Ein denkender Gegner mit einem Gegner neben sich (in Classic, das kein Brett hat, immer) ergibt sich; ein Tier oder ein Gegner mit freiem Raum flieht, geht zum nächsten Brettrand und entkommt, sobald einer seiner Züge dort beginnt. In beiden Fällen verlässt er den Kampf lebend: Der Kampf ist gewonnen, wenn kein Gegner mehr übrig ist, die Zusammenfassung teilt dem Game Master mit, wer geflohen ist und wer sich ergeben hat, und die Beute eines Gegners, der sich ergeben hat, fällt zusammen mit der Beute der Gefallenen an. Dasselbe `aiHints.leader` kennzeichnet den Gegner eines Regelsatz-Kampfs als Anführer für die `leader-down`-Moralprüfungen seines Regelsatzes. Kämpfe, die vor Einführung der Moral gespeichert wurden, laufen weiter ohne sie.

**Was jede Rolle tut (Kampf-KI A1-A3).** Die Rolle beeinflusst nun in allen drei Stilen die gemeinsame Gewichtung, außer bei Mindless-Gegnern: Ein bulwark gewichtet Schutz am stärksten und erhält eine Aufwertung dafür, seinen Gang neben einem bedrohten Freund zu beenden; ein skirmisher gewichtet das Besiegen und die Koordination stärker und erhält eine Aufwertung dafür, von der einem Freund gegenüberliegenden Seite auf ein Ziel einzuschlagen, an dem dieser Freund bereits steht; ein marksman achtet stärker auf Gefahr; ein spellcaster spart seine teuren Optionen für Situationen, in denen sie zählen; ein controller gewichtet Vorbereitung am stärksten; ein supporter gewichtet Hilfe stärker und erhält eine Aufwertung dafür, neben einem verletzten Freund zu enden; und ein solo (eine Regelsatz-Kreatur mit Signaturaktionen oder legendärer Resistenz oder ein Boss in Classic/Tactical) gibt großzügig aus, schlägt härter zu und achtet weniger auf Gefahr. Die Rolle einer Regelsatz-Kreatur wird daraus abgeleitet, was sie tun kann (siehe die Absätze zu 1.763/1.776 in writing-rulesets.md), und ihr Temperament wird mit dieser Rolle erneut gezogen, wenn sie von der ersten Einschätzung abweicht, außer wenn die Geschichte oder die Daten ein Temperament nennen oder wenn es sich um einen Gegner mit Charakterbogen handelt (dessen offene Entscheidungen mit seinem vorgegebenen Temperament ergänzt wurden).

**Hinein und wieder hinaus (Kampf-KI A4).** Eine Regelsatz-Kreatur, die in diesem Zug aus nächster Nähe zugeschlagen hat und ein skirmisher oder vorsichtig oder feige ist, nutzt ihren übrigen Gang, um Abstand zu gewinnen: mit einem Disengage, das sie sich noch leisten kann (das als Bonusaktion von Nimble Escape), und dann zu ihrer Fluchtzelle, oder ohne eines nur zu einer Zelle, die nichts provoziert und neben der kein Gegner steht. Das wird über ein Fenster hinweg gespeichert, in dem ein Mensch antwortet (`turnSoFar.struckClose`).

**Leibwächter (Kampf-KI A5, Capability API 1.777).** Ein Gegner, dessen `behavior.guards` `leader`, `casters` oder `healers` nennt, erhält den Begleiterbefehl `protect` für den nächsten aufrecht stehenden Freund dieser Art (`rulesetBodyguardOrders`): denselben Bewegungsradius von drei Feldern, den Fokus auf jeden, der seinen Schützling bedrängt, und seinen Gang zurück zum Schützling im Leerlauf. Auch ein Mindless-Leibwächter behält den Befehl: Vor der Mindless-Regel für das nächste Ziel werden seine Kandidaten auf Schläge gegen diejenigen eingeschränkt, die neben seinem Schützling stehen, sofern es solche gibt. Eine Zielvorliebe `leader` berücksichtigt nun auch einen Kampfteilnehmer, den die Geschichte als Anführer kennzeichnet (E2).

**Anführer (Kampf-KI A6).** In Regelsatz-Kämpfen gewichtet ein Anführer (`block.leader` oder der `leader` aus E2) Hilfe für seine ganze Seite (Optionen für Verbündete mit zwei oder mehr Zielen oder einer Fläche) in den Runden 1-2 mit +0.6 Fokus (`weighRulesetLeadership`); der Rest seiner Seite (nur Gegner; Begleiter haben den Folgebefehl) erhält +0.3 Fokus auf sein letztes Ziel; und zu Beginn des Anführerzugs verlieren in die Flucht geschlagene Verbündete innerhalb von sechs Feldern `routed`, und der Auslöser, der ihre Moral gebrochen hat, wird aus `moraleChecked` entfernt, sodass sie in ihrem nächsten Zug erneut prüfen (`rallyRulesetSide`). Als Hilfe für die ganze Seite zählt auch eine Option, die ihm selbst einen Zustand auferlegt, dessen `auras` seine Seite erreichen (Leadership in 5e), und `rulesetEffectWorth` bewertet eine solche Aura mit dem Wert ihrer vorgegebenen Zustände je Freund in Reichweite; der Eröffnungsbonus beträgt +1 Fokus. Die Moral in Classic und Tactical kennt noch kein erneutes Sammeln.

**Diszipliniert und fanatisch (Kampf-KI T1, T2).** `disciplined` hat nun Koordinationsgewicht 1 (Formation), +0.6 statt +0.3 Fokus auf das letzte Ziel seines Anführers und überspringt den Regelsatz-Moralauslöser `first-fall`. `fanatical` (in `COMBAT_NAMED_TEMPERAMENTS`, wird ohne einen Hinweis oder Daten, die es nennen, nie gezogen) gewichtet Schaden mit 2, Risiko mit 0.05 und Schutz mit 1, hat keinen Moralwert in Classic/Tactical und führt nie eine Regelsatz-Moralprüfung aus. Der Director spiegelt das Temperament, das er spielt, für diese Regelprüfungen auf `RulesetCombatant.temperament`.

**Temperamentwechsel (Kampf-KI T7, Capability API 1.779).** `aiHints.shifts` (die Geschichte) oder ein Regelsatz-`behavior.shifts` nennt bis zu vier `{on, to}`; `shiftCombatTemperament` wendet zu Beginn des Zugs der Einheit einmalig (`tactics.shifted`) den ersten an, dessen Auslöser eingetreten ist: `shiftTurn` in Classic/Tactical (in die Enge getrieben bedeutet dort unter einem Viertel der Gesundheit mit einem angrenzenden Gruppenmitglied, in Classic immer angrenzend) und `shiftRulesetTemperament` in Regelsatz-Kämpfen (in die Enge getrieben setzt zusätzlich voraus, dass es keine Rückzugszelle gibt). Eine Einheit, die gewechselt hat, behält ihr neues Temperament anstelle des in ihren Daten angegebenen, und die Regelsatz-Spiegelung folgt ihm.

**Arrogant (Kampf-KI T5, Capability API 1.780).** Ein Temperament, das nur bei ausdrücklicher Nennung vorkommt (`COMBAT_NAMED_TEMPERAMENTS`): Risiko 0.2, Vorbereitung 0.05, Kosten 2 (eine `solo`-Rolle behält diese Kosten bei, statt sie auf null zu setzen), Haltevorliebe offensiv. Ohne eigene `shifts` nutzt es `COMBAT_ARROGANT_SHIFTS` (verwundet oder Verbündeter am Boden → methodisch); `tactics.shiftedFrom` merkt es sich. In Regelsatz-Kämpfen lässt `retreatAloft` einen legendären arroganten (oder früher arroganten) Flieger bei weniger als einem Viertel seiner Gesundheit nach oben fliegen und hindert ihn daran, auf jemanden zuzugehen.

**Territorial (Kampf-KI T4, Capability API 1.781).** Ein Temperament, das nur bei ausdrücklicher Nennung vorkommt. `syncRulesetCombatants` speichert in `tactics.home`, wo es zuerst steht; `rulesetTerritoryLeash` macht aus `behavior.territory` (Standard 6) um diesen Punkt denselben Bewegungsradius wie bei einem wachenden Begleiter (ein stellvertretender Kampfteilnehmer am Heimatpunkt), den `walkTowardsTrouble` nutzt und mit dem Kandidaten ausgeschlossen werden, die weiter aus seinem Gebiet herausgehen. Der Bewegungsradius wird aufgehoben, solange `harmedBy` außerhalb seines Gebiets steht. Eine Mindless-Kreatur, deren Daten `territorial` angeben, bleibt in ihrem Gebiet (`rulesetTerritorial`), und `tactics.home` bleibt bei einer erneuten Taktikziehung erhalten.

**Cruel (Kampf-KI T3, Capability API 1.782).** Ein Temperament, das nur bei ausdrücklicher Nennung vorkommt: Besiegen 3 (wie opportunistic), Vorbereitung 0.8. `cruelOpponents` aus der Spieleinrichtung (standardmäßig aus) wird zu `CombatDirectorState.cruel`; nur dann spiegelt `syncRulesetCombatants` `cruel` auf den Regelsatz-Kampfteilnehmer (sonst `opportunistic`), und `rulesetCandidatesFrom` lässt einen Kampfteilnehmer, dessen gespiegeltes Temperament `cruel` ist, schädigende Schläge gegen einen Gegner gewichten, der am Boden und nicht besiegt ist. Kämpfe in Classic und Tactical haben keinen Zustand für am Boden liegende, aber lebende Kampfteilnehmer, daher gelten dort nur die Gewichtungen.

**Honourable (Kampf-KI T6, Capability API 1.783).** Ein Temperament, das nur bei ausdrücklicher Nennung vorkommt: Besiegen 0.2. In Regelsatz-Kämpfen verwirft seine Auswahl Kandidaten, die auf einen in die Flucht geschlagenen Gegner, einen Gegner am Boden oder einen Gegner zielen, der sich ergeben hat (wenn noch etwas anderes übrig ist), und gibt +0.6 Fokus auf den Gegner, der es zuletzt verletzt hat, sowie +0.3 auf einen Gegner neben ihm. Der Befehl `yield` der Gruppe (als `DirectedRulesetView.canYield` angeboten, solange jeder aufrecht stehende Gegner ehrenhaft ist) beendet den Kampf als `defeat` mit `CombatSummary.yielded`, was die Zusammenfassung dem Game Master als angenommene Aufgabe mitteilt.

**Hungry (Kampf-KI T8, Capability API 1.784).** Ein Temperament, das nur bei ausdrücklicher Nennung vorkommt: Besiegen 2, Vorbereitung 1. Seine Auswahl gibt +0.6 Fokus auf `tactics.targetId`. Zu Beginn seines Regelsatz-Zugs ermittelt `dragOffPrey` die Gegner, die es schleift (`rulesetDragging`), macht den ersten zu seinem Ziel und geht unter Missachtung dieser Gegner zu `rulesetRetreatCell`, sodass es sie mitschleift; danach geht es in diesem Zug auf niemanden mehr zu.

**Flieger halten ihre Höhe (Kampf-KI A7).** Wenn der Zug eines Regelsatz-Fliegers am Boden in den Leerlauf geht (`keepAloft`) und er fliegen kann, eine verfügbare schädigende Fernkampfaktion hat, weder bruiser noch rücksichtslos noch Mindless ist und ein Gegner aufrecht steht, der nicht fliegen kann, führt er Fly up aus, sofern das Brett Höhenstufen hat, und setzt dann seinen Zug (einen Schuss, sein Abstandhalten) aus der Luft fort.

**Wasserzellen, enge Durchgänge, Beute und Schüsse aus der Ferne.** Eine gespeicherte Position auf einer Wasserzelle wird geladen (die Prüfung des Spielstands zählt Wasser nicht mehr als blockiert). Eine Flucht (`rulesetRetreatCell`) endet bei einer Kreatur, die größer als eine Zelle ist, nie in einem Durchgang, durch den sie sich zwängen müsste. Eine hungrige Kreatur schleift nur aufrecht stehende Beute, und sobald jeder andere aufrecht stehende Gegner weiter entfernt ist als ihr Gang plus eine Zelle, bleibt sie stehen, statt weiterzuschleifen. Ein Kampfteilnehmer, der sich ergeben hat, zeigt eine weiße Flagge auf seinem Token und „Surrendered“ auf seiner Karte statt eines Totenschädels für Besiegte. Eine denkende Kreatur, deren bester Schlag aus nächster Nähe im Durchschnitt mehr als das Eineinhalbfache ihres Schusses erzielt (`rulesetShotFromAfar`), schießt nur, solange sie nicht herankommt, und geht dann heran, statt an ihrem Standort zu bleiben. Es zählen nur Aktionen, die sie jetzt ausführen darf: Ein gewährter Schlag mit Flame Blade, die sie noch nicht herbeigerufen hat, wird nicht gezählt.

**Gefallene loslassen und Gefangene.** Ein Betroffener lässt kostenlos (`rulesetLetGoOfHeld`) von ihm gehaltene Gegner los, die am Boden sind, solange noch ein anderer Gegner aufrecht steht, außer wenn er grausam ist und das Spiel Schläge auf Gefallene erlaubt. Jemanden zu stoßen oder zu packen, den er bereits hält, ist nichts wert, ebenso ein Stoß ohne einen Ort, an den er das Ziel befördern kann, sodass ein Krokodil den Gegner in seinem Maul beißt. Der Fokus einer hungrigen Kreatur auf ihre gehaltene Beute zählt nur bei Schlägen. Ein Gefangener behält sein Feld: Es darf durchquert werden, aber man darf nicht darauf stehen bleiben, wie beim Feld eines Kampfteilnehmers am Boden; sein Token hat einen weißen Ring und eine größere Flagge.

**Multiattack-Schüsse und offenes Gelände.** Der Vergleich für Schüsse aus der Ferne zählt jeden Schlag eines Multiattack so oft, wie er ausgeführt wird, und stellt den besten nutzbaren Nahkampfangriff dem besten nutzbaren Fernkampfangriff gegenüber, sodass die zwei Longbow-Schüsse eines Spähers seine zwei Shortswords überwiegen. Eine Kreatur, die größer als eine Zelle ist, wählt bei gleicher Entfernung offenes Gelände statt eines Durchgangs, durch den sie sich zwängen müsste; Schläge aus einem solchen Durchgang sind das 0.6-Fache derselben Schläge aus offenem Gelände wert (`RULESET_SQUEEZED_BLOWS`), und sobald sie eingeengt ist, sind Schläge aus offenem Gelände entsprechend mehr wert, sodass sie zum Zuschlagen heraustritt.

<a id="boss-turns-controlled-by-the-gm"></a>

## Vom GM gesteuerte Boss-Züge

### Identität und Verantwortung

Ergänze ausdrückliche Boss-Identität pro Einheit in Begegnungsdaten. Mache nicht automatisch das stärkste Mitglied jeder Gruppe zum GM-Boss. Vorgeschlagene Ränge sind ordinary, elite, boss; elite bleibt Engine-gesteuert, solange nicht ausdrücklich als Boss ausgewiesen. Die vorhandene begegnungsweite Musikklassifikation kann getrennt bleiben.

Der GM wählt eine zulässige Aktion anhand etablierter Persönlichkeit, Begegnungsabsicht, aktuellem Brett, Gruppenfähigkeiten/-ressourcen/-gegenständen und unterstützten Mechaniken. Diese breitere Kenntnis dient Vorhersage, nicht dem Wissen über eine unbestätigte Spielerwahl; [GM-Bosse, legendäre Aktionen und Reaktionen](#gm-bosses-legendary-actions-and-reactions) definiert den Informations- und Unterbrechungsvertrag. Reichweite, Bewegung, Ressourcen, Würfe, Schaden, Zustände und Zugbudgets gehören der Engine. Gewöhnliche Begleitgegner bleiben auch neben einem Boss Engine-gesteuert.

**Benannte und brillante Gegner (Kampf-KI P9).** In einem Spiel kann der GM auch jeden benannten Gegner (das `aiHints.named` des Begegnungsbauplans, nur an benannte Einzelpersonen der Geschichte vergeben) und jeden Gegner mit einem `genius`-Verstand spielen (nach `aiHints.mind` der Geschichte, sonst nach seinen eigenen Regelsatz-Daten). Das `aiHints.mind` der Geschichte kann gegenüber den eigenen Daten einer Kreatur nur Denkvermögen wegnehmen (bei einer beherrschten oder wahnsinnig gewordenen Kreatur) oder einspringen, wenn ihre Daten keinen Verstand angeben: Ein beiläufiger Hinweis macht aus einem Wolf nie einen Taktiker. Die Einrichtungsoption ist `gmNamedControl`, wird unter der Boss-Steuerung angeboten und zusammen mit ihr beim Kampfbeginn festgeschrieben; fehlt sie, gilt die Steuerung nur für Bosse. Diese Gegner erhalten denselben Vertrag zur Auswahl genau einer ID aus dem Menü, dasselbe Zeitlimit und dieselbe Rückfalllösung wie ein Boss, aber kein legendäres Budget, das sie nicht besitzen. In einem Regelsatz-Kampf enthält der Prompt außerdem das Profil des Gegners (Verstand, Temperament, Rolle, Ausbildung und sein Regelsatz-`behavior`), die nach Bedrohung geordnete andere Seite und die Begleiterbefehle der Gruppe.

**Die eigenen Vorschläge der Engine.** Im Zug eines Game Masters in einem Regelsatz-Kampf bewertet die Engine die Kandidaten des Gegners genau wie ihre eigene Auswahl (`rankRulesetChoices`, dieselben Gewichte wie bei `chooseCombatCandidate`) und kennzeichnet ihre besten drei unter den Optionen der Entscheidung als `suggested: { rank, reason }`; sie ergänzt alle, die auf der Auswahlliste fehlten. Der Prompt führt sie als `engineSuggestions`, je eine Zeile in einer festen Grammatik: `1. CANDIDATE: <id> ACTION: <label> -> <targets> REASON: <why>`. Die Begründung nennt die größten Anteile der Bewertung (Schaden mit seiner Vorhersage, eine wahrscheinliche Tötung, wen sie am liebsten am Boden sähe, eine Vorbereitung, Hilfe, die aufgewendeten Kosten, die Gefahr am Standort) und den Gang, den sie zuerst unternimmt. Ein Modell, das den Regelsatz nicht kennt, sieht so dennoch, warum ein Zauber einen anderen übertrifft; es darf jeden angebotenen Kandidaten wählen und wird angewiesen, einem Vorschlag zu folgen, sofern nicht die Persönlichkeit des Gegners, die Geschichte oder ein besserer Spielzug dagegensprechen. Es sind keine Tool-Aufrufe beteiligt. Kämpfe in Classic und Tactical verfahren genauso: Wenn sich das gewöhnliche Fenster eines Game Masters öffnet, ordnet `chooseClassicAction` oder `decideProfileAction` die Kandidaten der Einheit, ohne eine Auswahl zu treffen, und die besten drei passenden Auswahlmöglichkeiten tragen `suggested`, das in diesem Prompt als `engineSuggestions` in derselben Grammatik angezeigt wird.

Empfohlene Einrichtung: Aktiviere das neue Taktiksystem für neue Spiele bei Auslieferung der vollständigen Funktion und biete „GM directs bosses“ als klar erklärte Einstellung mit der konfigurierten GM-Verbindung an. Erkläre, dass Boss-Züge eine Modellantwort und die normale Anbieternutzung des Nutzers erfordern können. Bestehende Spiele behalten ihr Verhalten bis zur bewussten Aktivierung; schreibe die Wahl beim Begegnungsstart fest. Eine reine Engine-/Offline-Option nutzt dieselben Boss-Profile. Ergänze dafür keinen anderen Kampfstil-Enum und ändere die Steuerung nicht stillschweigend mitten im Kampf.

### Zugorchestrierung

Halte Anbieteraufrufe in einem serverseitigen Orchestrierungsdienst außerhalb der reinen gemeinsamen Engine:

1. Nimm eine Spieleraktion mit Begegnungsidentität, Aktions-ID und erwarteter Revision an. Validiere gegen den angenommenen Kampfzustand.
2. Gehe in bestehender Reihenfolge zur nächsten gewöhnlichen Aktion oder Unterbrechungsentscheidung weiter. Trenne Erklärung von Wirkungsauflösung, damit eine Reaktion einen ausstehenden Zauber unterbrechen kann; löse nicht erst eine ganze Runde auf, um sie danach umzuschreiben.
3. Speichere ausstehende Aktivierung/Fenster: Einheiten-ID, Revision, Zugzeiger, auslösende/ausstehende Aktion, Strategieversion und begrenztes Menü zulässiger Kandidaten.
4. Fordere von der GM-Verbindung eine strukturierte Kandidaten-ID oder Passen an. Füge aktuellen Gruppenbogen-Snapshot, Boss-Absicht, unterstützte Mechaniken und nur die für dieses Fenster vorgesehenen Aktionsinformationen gemäß [GM-Bosse, legendäre Aktionen und Reaktionen](#gm-bosses-legendary-actions-and-reactions) hinzu. Eine kurze optionale Erzählung darf keinen Zustand verändern.
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

## Daten- und Anbindungsvertrag

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

## Spielspaß, Realismus und Wiederspielwert prüfen

**Spielspaß:** Gegner sollen erkennbare und ausnutzbare Gewohnheiten haben. Ein Sieg durch Trennung eines Protective-Wächters von einem Supportive-Heiler ist befriedigender als einer durch den zufälligen Fehlzug einer Universalbewertung. Mache nicht alle Gegner zu perfekten Maschinen für konzentriertes Feuer.

**Realismus:** Nutze glaubwürdige Ziele, begrenztes Wissen und gegnergerechte Kompetenz. Feigheit, Loyalität, Aggression und Ausbildung sind verschiedene Eigenschaften. Mindless ist die gewünschte Vereinfachung für zwei Kreaturenkategorien. Moral (Aufgabe und Flucht) und das territoriale Temperament gibt es inzwischen unter [Praktische Leitplanken](#practical-guardrails); weitergehende Ziele noch nicht.

**Wiederspielwert:** Variiere Profile und Begegnungszusammensetzung zwischen Seeds und bewahre Identität innerhalb eines Kampfes und für wiederkehrende NPCs. Gelände, Rollenkombinationen, Gegnerressourcen und Ziele sollen mehr Variation als andere kritische Treffer schaffen. Schwierigkeit soll die Herausforderung vorhersehbar verändern, ohne eine Mindless Beast plötzlich Heiler jagen zu lassen.

Beispielbegegnung auf derselben Karte:

- Ein Reckless Bruiser verlässt sein sicheres Feld, um eine erreichbare Frontlinieneinheit zu bedrängen.
- Ein Protective Bulwark bleibt nahe dem Supportive-Zaubernden, statt mitzustürmen.
- Ein Cautious Marksman hält eine Schussbahn und vermeidet eine ungeschützte Zielposition.
- Eine Mindless Beast nimmt den kürzeren Waldweg zum nächsten erreichbaren Gruppenmitglied und ignoriert den weiter entfernten verwundeten Zaubernden.
- Ein benannter humanoider Boss erhält einen GM-Zug zur Wahl zwischen zulässigem Signaturdruck und Schutz seines Rückzugswegs. Seine Begleitgegner nutzen weiter ihre eigenen Profile.

Ein anderer Seed kann Cowardly Bruiser und Opportunistic Marksman erzeugen und damit das Gefecht verändern. Neuladen darf das nicht. Ein späteres Auftreten desselben benannten Bosses soll etablierte Gewohnheiten bewahren, solange Geschichte oder ausdrückliche Bearbeitung sie nicht ändern.

<a id="current-ordinary-ai-implementation-boundary"></a>

## Aktueller Umfang der gewöhnlichen KI-Implementierung

Implementiertes Strategievokabular: Mindless, Reckless, Cautious, Opportunistic, Protective, Supportive, Disciplined, Cowardly, **Patient, Methodical und Coordinated**. Weitere Adjektive unten sind Ideen, keine verborgenen Laufzeiteinstellungen.

Der gemeinsame Vertrag `features/combat-ai.ts` trennt gespeicherte Rolle, Adjektiv, Ausbildungsstufe und Seed von der Steuerung. Neue Kämpfe erhalten gespeicherte Zuweisungen; wiederhergestellte Kämpfe ohne Profil behalten die bisherige automatische Strategie. Ein Steuerungswechsel für einen Begleiter würfelt sein Adjektiv nicht neu. Generierte endliche MP-Vorräte sowie ausdrückliche Fähigkeitstypen/-kosten erreichen die Laufzeit; ausgelassene Gegner-MP nutzen denselben vorläufigen Vorrat `20 + 3 × level` wie Verbündete ohne Werte, unter Wahrung ausdrücklicher null. Das ist ein allgemeiner Engine-Rückfall, keine Tabletop-Ressourcenregel.

Die v1-Zuweisung ist bewusst kleiner als die in [Profilzuweisung: Rolle, Erfahrung, Persönlichkeit, dann Seed-bestimmte Vielfalt](#assigning-profiles-role-experience-personality-then-seeded-variety) vorgeschlagene Formel: Kompatible Profile beginnen mit positivem Gewicht, rollengünstige erhalten einen ausbildungsabhängigen Bonus, ein optionaler Persönlichkeitshinweis aus geschlossener Aufzählung eine begrenzte Vorliebe. Kategorievorrang erzwingt Mindless; ein ausdrücklicher Mindless-Hinweis wählt es auch für andere Kategorien. Der bestehende Begegnungsgenerierungsaufruf liefert Hinweise in beiden Sprachen; die Engine liest Persönlichkeit nicht selbst aus Prosa. Andere Temperamenthinweise sind Vorlieben, keine Garantien; das Modellverständnis von Verneinung/mehrsprachiger Charakterisierung braucht weiterhin Anbieterbewertung. Vollständige Herkunft und identitätsgestützte Persönlichkeit wiederkehrender NPCs über Begegnungen hinweg bleiben Folgearbeit. Aus HP abgeleitete Stufe bleibt ohne Hinweis ein schwacher Ausbildungsersatz.

Jeder Modus zählt ausführbare Standardangriffe, Fähigkeiten und Abwehroptionen auf und bewertet Schaden, Abschluss, wirksame Heilung, Unterstützung, Kosten und relevante taktische Faktoren. Es kommt kein Modellaufruf je gewöhnlichem Zug hinzu. Profile gewähren niemals unverfügbare Fähigkeiten, unbegrenzte MP, zusätzliche Aktivierungen oder nicht vorhandene Geländemechaniken.

- **Classic:** keine räumliche Bewertung. Mindless nutzt eine stabile Seed-bestimmte Reihenfolge lebender Gegner unabhängig von HP. Unterstützung nutzt den richtigen Verbündetenvorrat. Verstärkungs-/Schwächungsfähigkeiten wenden einen echten benannten Verteidigungsmodifikator statt einer reinen Schadensannäherung an. Neue Profile haben Abklingzeiten pro Nutzung. Manuelle Begleiter merken Angriff/Fähigkeit/Abwehr für ihren eigenen Initiativeplatz vor; Gruppeninventar und erzählerische Aktionen bleiben beim aktiven Anführer. Andere Begleiter nutzen standardmäßig KI entsprechend Classics bestehender Bedienung. Eingereichte Befehle benennen die handelnde Figur, auch bei KO des ursprünglichen Anführers.
- **Tactical:** zulässige erreichbare Angriffs-/Unterstützungsziele versorgen die Strategie. Mindless folgt dem Weg mit wenigsten Schritten bei tatsächlichen Bewegungskosten; Flug und Teleportation behalten ihre Durchquerungs-/Landeregeln. Unterstützung darf vor dem Wirken laufen. Neue Konterschätzungen nutzen das geplante Ziel. Eine konservative Reichweitenschätzung aus öffentlichem Zustand liefert Gefährdung; das ist keine vollständige Wegfindung des nächsten Zugs. Eine Wand oder ein Berg blockiert bei jedem Schlag die Sicht (combat C6).
- **Patient:** bevorzugt begrenztes defensives Halten gegenüber ungünstigem Gefecht; Classic wartet auf fast abgelaufene Abklingzeiten statt auf erfundene Bewegung. Bei vorhandener nützlicher Aktion darf es nicht unbegrenzt warten.
- **Methodical:** bevorzugt unterstützte Verteidigungssenkung als Vorbereitung, behält das Ziel und greift bei wirksamem Status an. Kein erfundener Kombinationsbaum oder Suche nach künftigen Würfen.
- **Coordinated:** berücksichtigt erfasste Ziele der Verbündeten und nützliche Schwächungen und berechnet nach jeder angenommenen Aktion neu. Kein allwissender Teamplaner und keine Reservierung nicht eingereichter Spieleraktionen.
- **Begleiter:** lokalisierte Player-/AI-Auswahl pro Mitglied im Kampf; der aktive Anführer bleibt manuell. Tactical-Begleiter handeln nach verbleibenden manuellen Befehlen oder bei **End Turn** (Zug beenden). Manuelle Übersteuerung bleibt bis zu ihrer Aktion möglich. Steuerungswechsel, Profile und Gedächtnis bleiben in Kämpfenden-/Tactical-Snapshots gespeichert.
- **Classic-Speicherung:** Angenommene Rundenergebnisse und nächste Rundennummer gehen vor kosmetischer Animation an den bestehenden Snapshot-Callback. Echte Abklingzeiten pro Nutzung überstehen diesen Umlauf. Classic nutzt weiterhin seine bestehenden zufälligen Kampfwürfe; das ist keine exakte Wurfwiedergabe oder serverseitiges idempotentes Aktionsprotokoll. Garantien für parallele Tabs gehören zur künftigen maßgeblichen Boss-Arbeit.

Der erste Meilenstein endete vor Boss-Anbieteraufrufen und Reaktionen; [GM-Bosse, legendäre Aktionen und Reaktionen](#gm-bosses-legendary-actions-and-reactions) hält deren folgende Implementierung fest. Verbleibende Grenzen umfassen Provokation, reichere Ziele, regelsatzspezifische Initiative, vollständige Bogenressourcennormalisierung und eine wiederkehrende NPC-Profilregistrierung. Nicht implementierte Teile des ursprünglichen Vorschlags bleiben Akzeptanzarbeit und gelten nicht implizit als ausgeliefert. Synthetische Desktop-Messungen sind keine Kalibrierung realer Mobilgeräte.

## Weitere Adjektive mit klassenabhängigem Verhalten

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

Beste nächste Ergänzungen nach den heutigen elf: **Frugal, Relentless, Disruptive und Vengeful**. Frugal und Relentless passen mit kleinen Zustandsänderungen zu vorhandenen Fähigkeiten. Disruptive braucht echte Handlungshemmungs-/Bannsemantik; Vengeful Kampfereignisgedächtnis. Adaptive bietet hohen Wiederspielwert, aber größere Voraussetzungen. Territorial ist inzwischen für Regelsatz-Kämpfe als Temperament verfügbar, das nur bei ausdrücklicher Nennung vorkommt (Kampf-KI T4, oben). Prüfe Resolute und Zealous vor Erweiterung des öffentlichen Vokabulars auf Überschneidung.

Auch die drei gewünschten Ergänzungen unterscheiden sich je Klasse:

| Adjektiv | Bruiser / Bulwark | Skirmisher / Marksman | Spellcaster / Supporter |
| --- | --- | --- | --- |
| Patient | Macht sich bereit, bis ein ungünstiger Schlagabtausch besser wird; hält in Tactical einen wertvollen Zugang | Wartet auf zulässige nützliche Reichweite, statt einen schwachen Schuss zu erzwingen | Spart einen Zug für einen bald bereiten Zauber oder vermeidet nutzlose Heilung; wartet nie auf nicht vorhandene Manaregeneration |
| Methodical | Wendet echte Schwächungstechnik an und greift dann diesen Gegner an | Bereitet unterstützte Verwundbarkeit vor dem Schadensstoß vor | Schwächt vor Schaden oder bereitet unterstützte Abwehrfolge vor; nützliche aktive Wirkungen werden nicht neu angewandt |
| Coordinated | Bedrängt aktuelles Ziel eines Verbündeten oder liefert nützliche Vorbereitung | Besiegt ein bereits vom Team bedrohtes Ziel | Liefert nicht redundante Unterstützung oder nutzbare Schwächung; berechnet nach jeder Aktion neu |

Diese Beschreibungen sind Abstimmungsziele. Die erste Implementierung nutzt das allgemeine unterstützte Verteidigungsverstärkungs-/-schwächungsmodell; reichere Klassenkombinationen brauchen entsprechende Fähigkeiten und Regressionsszenarien.

<a id="summoning-design-extension"></a>

## Designerweiterung Summoning

Beginne ohne Raster. Eine Beschwörung ist eine tatsächliche kämpfende Einheit mit stabiler Begegnungs-ID, Besitzerreferenz, Seite, Profil, Steuerung, Dauer, Ressourcenkosten und ausdrücklichem Aktivierungsbudget. Die Klasse verändert zulässige Ausstattung, das Adjektiv Prioritäten wie in Classic.

Trenne die **Beschwörungsauswahl** des Beschwörenden von der **Kampfstrategie** der beschworenen Einheit. Ein Patient-Beschwörender kann einen Platz für spätere Bedrohungen sparen; ein Protective-Knight schützt durch unterstützte Aktionen; ein Methodical-Mage bereitet Schwächung vor; ein Coordinated-Heiler vermeidet doppelte Heilung. Beast-/Monstrosity-Beschwörungen bleiben nach aktueller Projektregel auch als Verbündete Mindless.

Der Regelsatz bestimmt, ob Befehle die Aktion des Besitzers verbrauchen, ob eine Beschwörung sofort oder nächste Runde handelt, Initiative teilt und ohne Befehl tätig wird. Empfohlener allgemeiner Standard: Beschwören verbraucht die gewöhnliche Besitzeraktion; die neue Einheit aktiviert sich erstmals nächste Runde und nutzt Engine-KI, sofern nicht ausdrücklich steuerbar. Entlassen/Neubeschwören derselben Einheit darf keinen neuen gewöhnlichen Zug gewähren. Erzwinge Einheitenobergrenze und stabile Abrechnung einer Aktivierung pro Runde vor Schwarmfähigkeiten.

Besitzer-KO, Bezauberungs-/Seitenwechsel, Entlassung, Ablauf der Dauer, Gruppenniederlage und Begegnungsende brauchen jeweils ausdrückliche Aufräumregeln. Speichere Besitz und Restdauer über Neuladen/Import hinweg. Eine besiegte Beschwörung ist weder Inventargegenstand noch dauerhaftes Gruppenmitglied. Zauber-/MP-Kosten werden einmal für angenommene Erstellung abgebucht. Beschwörungsaktionen dürfen keine legendären Fenster außerhalb der Berechtigungsregeln des festgeschriebenen Boss-Modifikators erzeugen.

<a id="gm-bosses-legendary-actions-and-reactions"></a>

## GM-Bosse, legendäre Aktionen und Reaktionen

<a id="implemented-generic-engine-adapter"></a>

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
- Gewöhnliche Begleitgegner bleiben lokale KI. GM-Aufrufe erfolgen nur in Boss-Fenstern mit sinnvoller Wahl. Nutze konfigurierte GM-Verbindung, Debug-Protokollierung, gespeicherten Rückfall und Gesamtlatenzlimit aus [Vom GM gesteuerte Boss-Züge](#boss-turns-controlled-by-the-gm) wieder.

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

Minimaler Speichervertrag: Begegnungs-ID, Revision, Aktivierungs-ID/-zeiger, bestätigte Figur, Fenstertyp/-ID, Auslöseereignis und ausstehende Aktions-/Eltern-IDs, Kontextrevision der Steuerung, Kandidatenrevision, Reihenfolge berechtigter/abgearbeiteter Reagierender, legendäre/Reaktionsbudgets, reservierte/gebuchte/erstattete Ressourcenänderungen, angenommene Wahl/Passen, Auflösungsstatus, Anbieteranfrage-/Rückfallergebnis und Restwirkungen. Nimm Entscheidungen samt Kosten/Ergebnissen atomar an. Späte oder doppelte Antworten dürfen nicht erneut zahlen. Wiederherstellung setzt ausstehendes Fenster fort oder spielt angenommenes Ergebnis ab; Verzweigung/Rückspulen isoliert das gesamte Kampfprotokoll, nicht nur Erzählung. Kein reines Text-Restore erstattet angenommene Reaktionen. Das in [Implementierter allgemeiner Engine-Adapter](#implemented-generic-engine-adapter) beschriebene Serverprotokoll liefert die erste Implementierung; [Vom GM gesteuerte Boss-Züge](#boss-turns-controlled-by-the-gm) behält den längerfristigen Vertrag.

UI: Zeige verbleibende legendäre Punkte, Reaktionsverfügbarkeit und angebotene Fähigkeitskosten; unterscheide Vorhersage und ausgelöste Reaktion. Zeige Unterbrechungsgrund und ob der ursprüngliche Zauber aufgelöst wird, scheitert oder neue Auswahl braucht. Mache Denken/Warten, Wiederholung/Rückfall und Abbruch barrierefrei zugänglich. Kündige aufgeladene Angriffe an, wo nötig. Behaupte niemals, der GM habe einen lokalen Rückfall gewählt. Halte interne Bewertungen/Prompts aus dem Spieleraktionsmenü heraus.

Erforderliche Nachweise: richtige Gruppenzauber/-ressourcen/-gegenstände im GM-Kontext; Vorschau bei erschöpften Ressourcen; plausible, aber falsche Fireball-Vorhersage; keine Entwurfs-/Befehlslecks; keine Ausbeutung bloßer Klicks/Neuauswahl; Spieler ändert zulässige Aktion nach Vorhersage; nativer 5e-Zeitpunkt gegenüber aktivierter Hausregel; Counterspell erst nach zulässigem Zauberauslöser; schwacher Zauber passiert, tödlicher wird angefochten; keine MP/Zauberplätze/Reaktion übrig; Kosten einmal bei gescheitertem Konter; regelspezifische Erstattung des Ursprungszaubers; unzulässige Sichtbarkeit/Reichweite; mehrere Reagierende und gekonterte Konter; kein zusätzliches legendäres Fenster bei Bewegung/Folgeangriff/Reaktion; richtiger Classic-Initiativeplatz; ungültig gewordene vorgemerkte manuelle Aktion; übersprungene Tactical-Einheiten/Beschwörungsberechtigung; erschöpftes legendäres Budget; genau einmalige Auffrischung; Tod/Ergebnis während Wartezeit; doppelte Anfragen; Zeitlimit mit spätem Erfolg; Neuladen, parallele Tabs, Verzweigung/Rückspulen und Einstellungsänderungen. Ergänze nach deterministischen Routentests echtes Anbieterverhalten und repräsentative Prüfung des Mobilspieltempos.

<a id="encounter-environment-agent-handoff"></a>

## Übergabe für einen Begegnungsumgebungs-Agenten

Das Textfeld **Terrain guidance** (Geländehinweise) und seine Zusammenfassungszeile werden aus der Spielerstellung entfernt. Alte Einrichtungsdateien dürfen das Feld aus Kompatibilitätsgründen behalten, doch die Begegnungsgenerierung fügt es nicht mehr jedem Kampf hinzu. Battlefield Size bleibt eine wiederverwendbare Einrichtungsvorliebe. Neue Kämpfe erhalten eigene interne Seeds; gespeicherte Karten und Neustarts bewahren angenommene Seeds. Die Tactical-Bezeichnung beschreibt Bewegung, Gelände und Vorschauen ohne den Namen eines anderen Spiels.

Ein künftiger Agent **Battlefield Scout** soll bei Vorbereitung einer Begegnung den aktuellen Spielerort, jüngste Szene/Umgebung, verfasste Kartendetails, Wetter und relevante jüngste Ereignisse nutzen. Er sendet dem GM vor Begegnungsgenerierung eine knappe Umgebungsbeschreibung, nicht bei Welterstellung oder einmal pro gewöhnlichem Zug.

Grenze:

| Zuständig | Arbeit |
| --- | --- |
| `Pasta-Devs/Marinara-Agents`, `staging` | Agentendefinition, Standard-Prompt, Paketlaufzeit, Katalog/Manifest, Assets und eigene Einstellungen des Agenten |
| Marinara Engine, `staging` | Hook zur Begegnungsvorbereitung, begrenzter Szeneneingabevertrag, validierte Agentenergebnisübergabe, konfiguriertes Anbieter-Routing, Zwischenspeicherung und Rückfall, gespeicherte Geländeherkunft |

Eingaben müssen Begegnungs-/Ortsrevision tragen und beobachtete Fakten von unsicheren Vorschlägen unterscheiden. Ausgabe: kurze Zusammenfassung unterstützter Umgebungen, begrenzte Geländemerkmale gegebenenfalls nach vorhandenem Schema `TacticalBattlefieldBrief` und Quellenreferenzen. Keine ausführbaren Regeln, beliebigen Feldkoordinaten, erfundenen Ressourcen, Boss-Rechte oder HP-Änderungen. Classic darf beschreibende Gefahren/Kontext erhalten, aber keine Rastermodifikatoren ohne Auflöserunterstützung.

Der GM erhält angenommenen Kontext und erzeugt weiterhin die Begegnung; die Engine validiert das endgültige Gelände. Zwischenspeichere nach Begegnungs-/Ortsrevision, verwirf veraltete Antworten nach Reise/Szenenänderung und vermeide wiederholte kostenpflichtige Aufrufe bei Wiederholung. Bei Deaktivierung, Fehlen oder Zeitüberschreitung nutze aktuellen Generierungskontext mit gewöhnlichem prozeduralem Gelände-Rückfall. Speichere angenommenes Gelände, statt beim Neuladen neu zu generieren. Ergänze Debug-Prompt-Protokollierung und Schema-/Zeitlimit-/Veralteter-Ort-Tests. Dieser Agent wird hier dokumentiert, nicht innerhalb der Engine implementiert oder stillschweigend installiert.

## Schwierigkeit und Wetter

### Einrichtung und Schwierigkeit

Entferne das Feld **Battlefield Seed** (Seed des Schlachtfelds) und dessen Zusammenfassung, behalte **Battlefield Size** (Größe des Schlachtfelds) aber bei. Neue Begegnungen erhalten interne Zufalls-Seeds. Ignoriere veraltete Kampagnen-Seed-Einstellungen beim Start künftiger Kämpfe; behalte angenommene Kampf-Seeds, Raster und das Neustartverhalten bei. Ändere die Classic-Beschreibung zu „Cinematic menu battles.“.

Normalisiere die Schwierigkeit mit einer gemeinsamen Hilfsfunktion, auch bei älteren Einrichtungen mit großgeschriebenem Anfangsbuchstaben. Behalte die gegnerischen Schadensmultiplikatoren Casual 0,6, Normal 1, Hard 1,3 und Brutal 1,6 bei. Classic darf wie Tactical nur gegnerischen Schaden skalieren. Prüfe Begegnungen und Beute auf denselben Groß-/Kleinschreibungsfehler. Schreibe die Schwierigkeit beim Erstellen der Begegnung fest, statt sie bei geänderten Einstellungen während des Kampfes anzupassen.

Diese Schadensmultiplikatoren gehören ausschließlich zu Traditional, den derzeitigen älteren Engine-Mechaniken. Prüfe die Schwierigkeit bei der Implementierung von 5e, V20 oder anderen Regelsätzen anhand der jeweiligen eigenen Regeln neu. Übernimm die Traditional-Multiplikatoren nicht standardmäßig. Die Abstimmung der KI-Entscheidungen ist von der Schadensskalierung unabhängig.

### Wetter

Nutze das vorhandene Kampagnenwetter und die anhand der Umgebung bestimmte Wetterexposition der Begegnung. Speichere das angenommene Wetter mit der Begegnung; ein fehlendes Feld in einem alten Kampfspielstand bedeutet neutrale Mechaniken. Unbekannte Exposition ist neutral. Geschlossene Umgebungen sind geschützt. Aktuelle Wetter-Aliase müssen auf die vorhandenen Wettertypen normalisiert werden; beim Setzen eines Typs müssen passende Wind- und Sichtverhältnisse entstehen.

Die anfänglichen Regeln gelten gleichermaßen für beide Seiten: Regen senkt Feuerschaden leicht und erhöht Blitzschaden; starker Wind beeinträchtigt ausdrücklich als Projektil markierte Angriffe; schlechte Sicht beeinträchtigt ausdrücklich sichtabhängige Angriffe; Schnee erhöht die Bewegungskosten beim Gehen in Tactical. Fliegen und Teleportation behalten ihre Bewegungssemantik. Fähigkeiten ohne Kennzeichnung erhalten keine aus ihrem Namen abgeleitete Projektil- oder Sichteigenschaft. Klares/bewölktes Wetter ist normalerweise neutral. Gemeinsame Hilfsfunktionen müssen Vorschauen, Auflösung und KI-Schätzungen steuern, ohne künftige Kampfwürfe zu verbrauchen.

Zeige die angenommenen Bedingungen und Auswirkungen in beiden Kampfoberflächen. Kosmetische Wettereinstellungen dürfen die Mechaniken nicht abschalten. Das Wetter bleibt während einer Begegnung unverändert; wetterändernde Fähigkeiten, regelmäßige Wetterwechsel, zufällige Blitzeinschläge und Hitzeerschöpfung sind zurückgestellt. Summoning und künftige Regelsätze können den gemeinsamen Wettervertrag wiederverwenden, ohne einen unfertigen UI-Modus einzuführen.

### Gegnerische Entscheidungen

Behalte Rolle, Adjektiv, Erfahrung, Regelkonformität und Ressourcenabrechnung bei. Die Schwierigkeit verändert begrenzte, durch einen Seed bestimmte Entscheidungsabweichungen: Casual erlaubt mehr plausible Fehler, Normal bleibt nahe dem bisherigen Ausgangswert, Hard entscheidet beständiger und Brutal minimiert Fehler unter Wahrung der Erfahrungsunterschiede. Die Entscheidungsabstimmung der Begleiter nutzt bei jeder Schwierigkeit einen festen Normal-Ausgangswert; Begleiter reagieren weiterhin auf tatsächliches Wetter und Gefahren. Die Mindless-Einschränkungen bleiben bestehen.

Nutze wetterabhängige Bewertungen für Angriffe, Unterstützung, Positionierung und Reaktionen. Counterspell und Abwehr konkurrieren je nach Bedrohung, Kosten und Persönlichkeit mit dem Passen. Keine Schwierigkeit gewährt verborgene Befehle, künftige Würfe, kostenlose Ressourcen oder zusätzliche Aktionen. Der GM-Boss-Prompt erhält angenommene Schwierigkeit und Wetter sowie Hinweise zu Druck und Gelegenheitsauswahl; die Engine erzwingt weiterhin die angebotenen zulässigen Optionen und Budgets. Bei Anbieterausfall bleibt der lokale Rückfall erhalten.

### Implementierungsdetails

Gemeinsame Bedingungen liegen in `packages/shared/src/features/combat-conditions.ts`. Die Schwierigkeit wird beim Import/Erstellen der Einrichtung und bei den Verbrauchern für Begegnungen, Beute, Classic und Tactical normalisiert. Gegnerische Entscheidungsabweichungen werden für Casual / Normal / Hard / Brutal mit 2,5 / 1 / 0,4 / 0,15 multipliziert; gespeicherte Erfahrung und Persönlichkeit bleiben wirksam. Classic-Schätzungen nutzen dieselbe Trefferwahrscheinlichkeit gegeneinander gewürfelter d20 wie die Auflösung, Tactical-Schätzungen die gemeinsame Angriffsvorschau. Die Tactical-Verfolgung bewertet Wege für gewöhnliche Profile nach Gelände- und Wetterkosten. Mindless-Einheiten wählen dagegen den zulässigen Weg mit den wenigsten räumlichen Schritten; beide Strategien zahlen bei der Bewegung die tatsächlichen Gelände- und Wetterkosten. Reaktionen berücksichtigen erwartete Bedrohung und Ressourcenknappheit mit derselben ausschließlich gegnerischen Abweichungsregel.

Bei ungeschützter Exposition multiplizieren Regen, starker Regen und Stürme Feuerschaden mit 0,85 und Blitzschaden mit 1,15. Explizite Projektile verlieren bei starkem Wind 10 Genauigkeitspunkte, bei Sturmwind 15. Explizit sichtabhängige Angriffe verlieren bei eingeschränkter Sicht 5 Punkte, bei schlechter Sicht 15. Kombinierte Abzüge sind auf 25 Punkte begrenzt. Classic wandelt diese in Modifikatoren für vergleichende Angriffswürfe um, einen Punkt pro fünf Genauigkeitspunkte, und benennt diese Wurfabzüge in der Bedingungsanzeige. Ungeschützter Schnee/Schneesturm in Tactical kostet beim Gehen einen zusätzlichen Bewegungspunkt je betretenem Feld; Flug und Teleportation bleiben unberührt. Gegenstände mit Elementarschaden erhalten ebenfalls Regenmodifikatoren; Heilung und Statusdauer nicht.

Die Begegnungsgenerierung erstellt die booleschen Werte `projectile` / `requiresSight` für Standardangriffe und Fähigkeiten sowie `battlefield.terrainBrief.exposure`. Fehlende Angriffseigenschaften sind neutral. Explizite Exposition hat Vorrang; erkannte geschlossene Umgebungen sind geschützt, erkannte Außenumgebungen ungeschützt und mehrdeutige Umgebungen unbekannt. Kampagnenwetter stammt aus dem gespeicherten Wettersystem; fehlt es, dient ein festgeschriebener Szenenwetterwert als Rückfall. Kampfstart-Tags in Nachrichten unterdrücken den Wetterfortschritt im Hintergrund, bevor der angezeigte Modus nachzieht. Angenommene Bedingungen werden in Kampfsteuerung und Tactical-Zustand gespeichert; widersprüchliche oder fehlerhafte Importe werden abgelehnt. Vorhandene Spielstände ohne Wetter bleiben neutral. Ältere Tactical-Neustarts übergeben angenommene Bedingungen einschließlich neutraler Abwesenheit, statt geändertes Kampagnenwetter neu abzufragen.

Die Einrichtung validiert veraltete Felder beim Import weiterhin aus Kompatibilitäts- und Sicherheitsgründen, entfernt sie aber aus normalisierten Einrichtungsexporten. Die Engine behält explizite Begegnungs-Seeds für Wiederherstellung/Neustart und die Reproduktion von Regressionen. Experience-Welt-Seeds werden dadurch nicht entfernt; sie erfüllen einen anderen Zweck.
