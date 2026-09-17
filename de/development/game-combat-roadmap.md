# Entwicklungsplan für Kämpfe im Game Mode

Dieser Plan hält die vereinbarte Richtung für [hybrides Gelände #6265](https://github.com/Pasta-Devs/Marinara-Engine/issues/6265) und spätere Kampferweiterungen fest. Er trennt geplantes Verhalten vom aktuellen Spiel. Die Implementierung beginnt auf `staging`; nicht alle hier beschriebenen Fähigkeiten sind bereits ausgeliefert.

## Teilnahme und Schlachtfeldregeln getrennt halten

Die aktuellen Werte für `combatStyle` sind `classic` und `tactical`. Behalte sie bei. Künftige Beschwörungen gehören in eine eigene Teilnahme-Einstellung, die bei älteren Konfigurationen und Spielständen standardmäßig Gruppenkämpfe auswählt. Erstellungs-Presets können beide Werte setzen, ohne einen weiteren gespeicherten Modus-Enum einzuführen:

| Preset | Teilnahme | Schlachtfeld |
| --- | --- | --- |
| Gruppe | Spieler und Begleiter | Classic-Menüs |
| Beschwörung (geplant) | Gesteuerte Kreaturen; Trainer außerhalb des Kampfes | Classic-Menüs |
| Taktisch | Spieler und Begleiter | Tactical-Raster |
| Taktische Beschwörung (später) | Gesteuerte Kreaturen; Trainer außerhalb des Kampfes | Tactical-Raster |

Zeige unfertige Kombinationen nicht an. Erzählerische Begleiter und Kampfeinheiten sind unterschiedliche Konzepte; die Array-Position des ersten Gruppenmitglieds darf nicht zur dauerhaften Identität der gesteuerten Figur werden.

## Aktueller Implementierungsschwerpunkt: hybrides Gelände

Der GM liefert eine kleine, strukturierte Vorgabe aus der Szene. Die Engine bestimmt anhand eines Seeds das genaue Gelände und die Startpositionen, validiert das Spielfeld und speichert das Ergebnis. Danach beschreibt der GM das akzeptierte Schlachtfeld. Normale Bewegungen und Angriffe benötigen keine Modellaufrufe.

Erweitere den bestehenden Umgebungs- und Formationsablauf um optionale Kartengröße, markante Orte, Geländehinweise des Spielers und einen wiederverwendbaren Seed. Alte Konfigurationen müssen gültig bleiben. Speichere das akzeptierte Raster samt Angaben zur Generierung, damit ein später geänderter Generator bestehende Kämpfe nicht neu zeichnet. Gespeicherte Seeds reproduzieren die Generierung bei gleicher Vorgabe und gleichen Kämpfern; beliebige Modellausgaben werden dadurch nicht deterministisch.

Generiertes Gelände darf zur Sicherung der Erreichbarkeit repariert werden, aber vorgegebene Einschränkungen dürfen nicht stillschweigend verschwinden. Begrenze Modellausgabe, Feld- und Einheitenzahl sowie Elementabmessungen. Lehne unmögliche Vorgaben mit einem hilfreichen Grund ab und biete ausdrücklich generiertes Ersatzgelände an. Ein vollständiger Mal- und Platzierungseditor sowie beliebige selbst erstellte Karten folgen später und müssen dieselben Validierungsregeln verwenden.

### Bewegungsfähigkeiten

Gehen, Fliegen und Teleportation benötigen eindeutige Bewegungsregeln. Flug und Teleportation dürfen Wände, Wasser und Berge überqueren und die zusätzlichen Bewegungskosten des Waldes umgehen. Verteidigungs- und Ausweichboni bleiben vom Bewegungsmodus unabhängig.

Fehlt der Bewegungsmodus, gilt für ältere Begegnungen Gehen. Ein ausdrücklich angegebener, nicht unterstützter Modus wird mit einem Fehler abgelehnt; ersetze eine angeforderte Fähigkeit nicht stillschweigend durch Gehen. Das gilt für generierte Baupläne und taktische API-Eingaben.

Trenne Durchquerung, erlaubte Ziele und Belegung. Durch eine Wand teleportieren zu können erlaubt nicht, darin zu enden. Das anfängliche flache Raster kann Höhe, Decken, zauberspezifische Sichtanforderungen oder begrenzte Flugdauer nicht darstellen. Dokumentiere diese Grenze, statt vollständige Tabletop-Bewegungsregeln zu behaupten. Verwende dieselbe Bewegungsprüfung für Vorschau, Auflösung, Pfadanimation und Gegner-KI.

## Tabletop-Regeln: integrierte Profile und Nachschlagewerkzeuge für den GM

Priorisiere 5e- und V20-ähnliche Spiele gegenüber einem vollständigen Kreaturensammelspiel. Ergänze später klar begrenzte, versionierte Regelprofile. Lege die genaue Edition und den unterstützten Umfang fest, bevor du ein Profil als Implementierung eines Regelwerks bezeichnest.

Die Engine sollte echte Würfe, erlaubte Ziele, Bewegung, Aktionsbudgets, Ressourcenverbrauch und Zahlenwerte bestimmen. Der GM interpretiert die Fiktion, wählt eine unterstützte Operation, liefert NPC-Absichten und erzählt das tatsächliche Ergebnis. Abgerufene Lorebook-Texte können Referenzen und Kampagnenregeln liefern, dürfen aber die Regelauswertung nicht umgehen oder Würfelergebnisse umschreiben.

[Issue #5955](https://github.com/Pasta-Devs/Marinara-Engine/issues/5955) behandelt semantische Lorebook-Suche und einen optionalen Werkzeugzugang. Die Suche ergänzt Regelprofile: Sie hilft dem GM, relevante Informationen zu finden; explizite Profile machen häufige Mechaniken konsistent und testbar. Vermeide eine gesonderte Suche für jeden gewöhnlichen Würfelwurf.

Beginne mit unterstützten Grundbausteinen für Proben, Züge und Ressourcen. Ein d20-Profil und ein d10-Pool-Profil benötigen unterschiedliche Auswertungsregeln; sie sind nicht bloß Umbenennungen voneinander. Später sollten Initiative, vergleichende Proben, Schaden und Schadensminderung, Zustände und Ressourcenverbrauch folgen. Dokumentiere nicht unterstützte Fälle und kennzeichne GM-Entscheidungen ausdrücklich.

Taktische Tabletop-Regeln benötigen außerdem gemeinsame Sichtlinien- und Deckungsregeln. Das aktuelle Raster verhindert Bewegung durch Wände, doch distanzbasierte Fernangriffe können sie durchqueren. Aktualisiere Regelauswertung, KI, Gegenangriffe, Prognosen und Bedrohungsanzeigen gemeinsam. Behalte Gruppen- und Gegnerphasen bei; individuelle Initiative ist ein gesondert auswählbares Regelprofil.

## Beschwörungen: Entwurf behalten, größeres System verschieben

Der erste Schritt kann klein bleiben: eine aktive Kreatur je Seite, eigene Reserven, ein nicht kämpfender Trainer, ein freiwilliger Wechsel, der den Befehl verbraucht, und eine gespeicherte Ersatzpause nach Kampfunfähigkeit. Niederlage tritt ein, wenn keine einsetzbare Kreatur übrig ist. Trainergegenstände dürfen keine zusätzliche Kreaturenaktion gewähren.

Halte einen Kader mit stabilen IDs und separaten IDs für aktive Plätze. Leite Reserven und Kampfunfähigkeit daraus ab, statt konkurrierende Arrays zu pflegen. HP, Ressourcen und Zustände eigener Kreaturen bleiben erhalten; die Begegnungsgenerierung darf diese Werte nicht bei jedem Kampf neu erfinden. Lege die Zustandsfortschreibung für Reserven ausdrücklich fest.

Fangen, Entwicklung, Zucht, Doppelkämpfe, zeitlich begrenzte Beschwörungen und taktische Beschwörungen sind getrennte Ergänzungen. Die GM-Zusammenfassung muss eine kampfunfähige Kreatur von einem verletzten Trainer unterscheiden.

## Speicherung und Nachweise

Fixiere die geltenden Begegnungsregeln beim Kampfbeginn. Neue optionale Felder müssen alte Classic- und Tactical-Spielstände erhalten. Konfigurationsimporte, unveränderliche Erstellungs-Snapshots und Zusammenfassungen müssen neue Entscheidungen bewahren. Neuladen, Neustart, Übernahme in die nächste Sitzung, Antwortvarianten, Verzweigungen und Wiederherstellung von Kontrollpunkten benötigen jeweils ausdrückliche Tests.

Ein künftig serverseitiger Kampfzustand sollte Kampf- und Kaderänderungen gemeinsam übernehmen, mit Begegnungs-IDs, Revisionen und idempotenten Aktions-IDs. Nutze bestehende Schreibwarteschlangen, wo sie passen. Prüfe die Namensräume von rundenbasierten Spielen und Experiences vor der Wiederverwendung von `game_engine_state`; dieser Speicher ist nicht automatisch für Kämpfe geeignet.

Ergänze für jede neue Regel den kleinsten ausführbaren `*.regression.ts`-Nachweis, einschließlich abgelehnter Aktionen und alter Eingaben. Browsertests müssen Einrichtung, eine echte taktische Aktion, Neuladen, kleine Bildschirme, Theme-Kontrast, Fokus und Tastaturzugang sowie hilfreiche Fehlerzustände abdecken. Halte Lokalisierung und Nutzerdokumentation mit der Implementierung zusammen.

## Vorarbeiten und Einstiegspunkte

[Der geschlossene, nicht gemergte PR #4391](https://github.com/Pasta-Devs/Marinara-Engine/pull/4391) auf `feat/game-mode-combat-expansion` enthält eine umfassendere Erweiterung für Kampfsitzungen, Manöver, Ziele und Bosse. Er ist nützliche Vorarbeit, kein aktuelles staging-Verhalten. Prüfe Zuständigkeit und Status, bevor du die Arbeit fortsetzt; merge nicht die gesamte Erweiterung als Voraussetzung für Gelände.

Zentrale Engine-Dateien sind `packages/shared/src/features/tactical-combat/`, `packages/server/src/routes/encounter.routes.ts`, `packages/server/src/routes/game.routes.ts`, `packages/client/src/components/game/GameSetupWizard.tsx`, `GameSurface.tsx` und `TacticalCombatUI.tsx`. Herunterladbare Agenten- und Experience-Definitionen sowie paketeigene Prompts gehören nach Marinara-Agents, falls spätere Arbeiten sie betreffen.
