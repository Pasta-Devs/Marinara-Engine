# Optionaler Mehrspielermodus

Implementierung: [#6790](https://github.com/Pasta-Devs/Marinara-Engine/issues/6790). Dieses Dokument beschreibt die Grenzen der Implementierung und die erforderlichen Nachweise. Es behauptet weder, dass der Mehrspielermodus verfügbar ist, noch dass eine Plattform Tests bestanden hat.

<a id="smallest-architecture"></a>

## Kleinste Architektur

Ein Host besitzt einen neuen geteilten Chat, den gespeicherten Spielzustand und die KI-Verbindungen. Er wählt Menschen und KI-Charaktere ohne feste Teilnehmer- oder Kartenobergrenze. Conversation, Roleplay und Game behalten ihre Modi. Eine Einladung macht keinen alten privaten Verlauf öffentlich.

Der Transport nutzt einen eigenen HTTPS-Listener mit kleinen JSON-Aktionen und begrenztem Long Polling. Fastify, Node HTTPS und Zod sind bereits installiert. WebRTC würde Signalisierung, ICE/TURN-Konfiguration und Fragen zur Lebensdauer mobiler Host-Tabs hinzufügen; WebSocket bräuchte eine weitere Serverabhängigkeit und einen Streaming-Parser. Private geteilte Chats verwenden stattdessen das vorhandene HTTPS. Es ist der einzige Raumtransport. Der Listener registriert nur Raumoperationen, nie die normale Engine-API. Gäste verbinden sich direkt mit dem Host, ohne zentrales Relay. Einladungen geben keinem Teilnehmer Zugriff auf Dateien, Bibliotheken, Einstellungen, Zugangsdaten oder andere Chats des Gegenübers. Halte den normalen Engine-Verwaltungsport privat; nur der separate Raumport gehört in die Einladung.

Die eigene vertrauenswürdige Engine des Gasts verbindet sich mit dem Host. TLS muss Zertifikatskette und Hostnamen erfolgreich prüfen; die Einladung bindet zusätzlich den Zertifikatsfingerabdruck des Hosts. Prüfe diese Bindung, bevor Passwort oder Persona gesendet werden. Folge keinen Weiterleitungen, wechsle nicht auf HTTP, deaktiviere keine Zertifikatsprüfung und richte keine automatische Routerweiterleitung ein. Der Host konfiguriert HTTPS-Adresse und Zertifikat mit den vorhandenen TLS-Funktionen.

Die Gastansicht ist vertrauenswürdiger mitgelieferter Code in einer Sandbox mit opaker Origin, ohne Netzwerk, Downloads, Navigation, Speicher, native Bridge oder Verwaltungszugriff. Ein authentifizierter MessageChannel überträgt nur validierte Raumansichten und eine kleine ausdrücklich definierte Menge von Aktionen. Das übergeordnete Fenster liefert lokale Darstellungspräferenzen; Teilnehmer dürfen keine Styles, Assets, ausführbaren Code, abzurufenden URLs oder beliebigen API-Aufrufe liefern. Text von Teilnehmern wird als Text dargestellt. Bestehende Rich-Chat-Renderer liegen außerhalb dieser Grenze. Der Android-Wrapper injiziert eine native Bridge in jeden Frame und muss für Gäste gesperrt bleiben, bis ein Kontext ohne Bridge implementiert und auf einem echten Gerät geprüft ist.

<a id="trust-boundaries"></a>

## Vertrauensgrenzen

| Grenze | Durchsetzung |
| --- | --- |
| Lokaler Administrator zum Raumcontroller | Bestehende Prüfungen für Basic Auth, CSRF, Host und native lokale Authentifizierung bleiben erhalten. |
| Gast-Engine zum Teilnehmer-Listener | HTTPS, Fingerabdruckbindung, separates Raumpasswort, Aufnahmebestätigung, zufällige ablaufende Sitzungen und begrenzte Anfragen. |
| Teilnehmer zum vertrauenswürdigen Gast | Strikte versionierte Schemas auf beiden Empfangsseiten, reine Textansicht, opake Sandbox und restriktive CSP. |
| Teilnehmer zum Chat-/Spielzustand | Identität und Besitz aus der authentifizierten Sitzung ableiten; keine vom Teilnehmer gewählte Rolle, Route oder Generierungsanfrage annehmen. |
| Raum zu Generierung und Tools | Vom Host kontrollierte Operationszuordnung, bestehende Generierungssperre, ausdrückliche Raumregeln für Befehle/Tools und Game-Bereitschaftsbarriere. |
| Gemeinsamer Zustand zum Verlauf | Sichtbare Felder ausdrücklich erlauben; Zugangsdaten, Debug-Prompts, Denken, private Notizen, fremde Bibliotheken und versteckten GM-Zustand ausschließen. |

Auch ein authentifizierter Teilnehmer bleibt nicht vertrauenswürdig. Prompt-Text bleibt unverändert; Berechtigungen werden im Code durchgesetzt, nicht durch Escaping oder Aufforderungen an ein Modell, sicher zu handeln. Der Host und seine KI-Anbieter können geteilte Inhalte lesen. Wie jede direkte Verbindung zeigt diese Architektur dem Host die IP-Adresse der verbindenden Engine. Andere Bibliotheks- oder Gerätedaten des Gasts sind nicht Teil des Protokolls. Schutz vor jeder Browser- oder Betriebssystemlücke wird nicht versprochen.

<a id="activation-and-lifetime"></a>

## Aktivierung und Lebensdauer

`MULTIPLAYER_ENABLED=true` ist eine Voraussetzung, die einen Neustart erfordert. Fehlende, falsche oder ungültige Werte deaktivieren den Mehrspielermodus. Zusätzlich ist die Aktivierung in Settings nötig; keine der beiden Einstellungen startet Netzwerkverkehr. Hosten und Beitreten erfordern jeweils eine ausdrückliche Aktion. Ein Neustart stellt keinen laufenden Raum wieder her. Stop, Kick und Leave widerrufen die jeweiligen Zugangsdaten und verhindern spätere Aktionen oder verspätete Zustellungen.

Solange eine der beiden Freigaben fehlt, gibt es keine Sitzungsdurchsuchungen, Zertifikatsverfügbarkeitsprüfungen, Host-/Gast-Abfragen oder autonomen Raumaufgaben. Der Server liest die Aktivierungsflags, der Client speichert eine Verfügbarkeitsabfrage zwischen; ausdrückliche Settings-Aktionen können sie aktualisieren. Direkte API-Anfragen bei deaktivierter Funktion werden weiterhin abgelehnt. Die Bereinigung gespeicherter Sitzungen wartet bis zur Aktivierung und nimmt keinen Netzwerkverkehr wieder auf.

<a id="proof-before-enabling-the-feature"></a>

## Nachweise vor der Aktivierung

- Nachweisen, dass bösartiger Teilnehmertext im unterstützten Gastkontext weder ausgeführt wird noch Assets abruft, navigiert, herunterlädt, lokale APIs erreicht oder native Bridges aufruft.
- Nachweisen, dass deaktivierte Freigaben, nicht authentifizierte Aufnahme, Besitzrechte, private Zustandsansichten, begrenzter Verkehr und Widerruf im Zweifel sperren.
- Generierung, Befehle und Autonomie über einen Host-Koordinator wiederverwenden. Die Kompatibilitätstabelle pro Befehl mit ausdrücklichen Einschränkungen veröffentlichen.
- Nachweisen, dass zwei Game-Spieler erst nach beider Einreichung oder ausdrücklichem Passen genau eine Runde auslösen; Wiederholungen, Trennungen, Abbruch und Neustart dürfen Zustand nicht doppelt anwenden.
- Bestehende Einrichtung, Drawer, Sidebar und Eingabe auf Desktop und Mobilgeräten prüfen, einschließlich klarer Leave-/Stop- und Wiederherstellungsbedienung. Lücken bei echten Geräten festhalten.

Unvollständige Ausbaustufen bleiben deaktiviert. Alle drei Modi und ihre Sicherheitsgrenzen müssen fertig sein, bevor #6790 als abgeschlossen gilt.

<a id="command-and-feature-compatibility"></a>

## Befehls- und Funktionskompatibilität

Raumaktionen laufen über den authentifizierten Host-Koordinator. Diese Tabelle beschreibt die Grenze, nicht die Erlaubnis, beliebige Befehle beim Gegenüber auszuführen. Abgelehnte Befehle werden im Eingabefeld erklärt und nie vom Gast ausgeführt.

| Funktion | Aufrufer und Ausführung | Geteiltes Ergebnis und Rundenregel |
| --- | --- | --- |
| Menschliche Nachrichten, `/send` | Aufgenommener Teilnehmer; der Host erstellt eine zugeordnete Benutzernachricht. `/send` unterdrückt eine automatische Antwort. | Öffentlicher Text. Conversation/Roleplay koordinieren angenommene Beiträge sequenziell mit der Generierung; bei Auslastung behält der Absender seinen Entwurf. Game sendet nur über die Rundensammlung. |
| `/roll`, `/r`, `/dice` | Aufgenommener Teilnehmer; vorhandener begrenzter Engine-Würfelparser und Würfler laufen auf dem Host. | Zugeordnetes Textergebnis. In Game bleibt ein Wurf die eingereichte Aktion dieses Spielers bis zum Rundenabschluss. |
| Generieren, `/trigger` | Aufgenommener Teilnehmer; ein gespeicherter exklusiver Host-Generierungsauftrag und die vorhandene Generierungssperre. | Gefilterte gespeicherte KI-Erzählung. Game lehnt unabhängige Trigger ab; nur Bereitschaft löst die Rundenauswertung aus. |
| Andere Slash-Befehle | Erst verfügbar, wenn ihre Raumberechtigung geprüft und ausdrücklich ergänzt wurde. | Keine Systemrollen-Einfügung, Identitätsübernahme, Navigation/Bearbeitung privater Chats, Galeriearbeit, Geräteaktion oder beliebige lokale Befehlsausführung. |
| Gruppenantworten | Vom Host ausgewählte zugelassene KI-Besetzung und bestehende sequenzielle/Smart/manuelle Generierung. | KI-Identität bleibt von menschlichen Persona-Snapshots getrennt. `{{user}}` verwendet die geprüfte Host-Persona, nie den zuletzt sprechenden Gast. |
| Conversation-Zeitpläne und Autonomie | Bestehender Server-Scheduler, Kandidaten-/Absichtslogik, Abkling- und Auslastungsverzögerungen; Ausführung über denselben Raumauftrag. | Kein Gast-Scheduler. Gestoppte/pausierte Räume und Game generieren nicht über Timer. Wird 45 Sekunden lang keine menschliche Ansicht oder aufgenommene Gegenstelle gesehen, pausiert die Raumautonomie. |
| Conversation `schedule_update`, `memory`, `react` | Bestehende Engine-Handler unter den Raumregeln. | Zeitplan-/Gedächtnisänderungen bleiben im Raum; Reaktionen müssen diesen Chat betreffen und dürfen kein eigenes Bild-Asset enthalten. Keine globalen Charaktergedächtnis- oder Präsenzupdates. |
| Roleplay-Notizen, Erinnerungen, Würfe und Flüstern | Bestehende Befehlsauswertung und Host-Handler; zugelassene Teilnehmer-IDs bestimmen die Empfänger. | Private Notizen bleiben privat. Flüstern erscheint nur im gefilterten Snapshot des Empfängers; der Host besitzt weiterhin die gespeicherten Daten. Agenten des Raums lesen nie Flüstern, da jeder Teilnehmer ihre Ausgaben sieht. |
| Chatübergreifende Szenen und Browsererinnerungen | Eingeschränkt, weil der normale Ablauf verknüpfte private Chats erstellt/öffnet oder einen browserlokalen Timer nutzt. | Beschreibe Szenen im geteilten Verlauf; nutze vom Host koordinierte Conversation-Zeitpläne für autonome Nachrichten. Kein empfangener Befehl erzeugt einen privaten Chat oder eine lokale Erinnerung. |
| Lorebooks und Erinnerungen | Vom Host geprüfte angehängte/raumeigene Bücher und raumlokale Conversation-Erinnerungen. | Nur Prompt-Kontext, keine Bibliotheksexporte. Implizite globale Bücher, verknüpfte private Chats und globale Kartenerinnerungen bleiben ausgeschlossen. |
| Engine-Tracker, Würfel, Zustand, Zusammenfassungen und Variablen | Ausdrückliche Positivlisten im echten Tool-/Agenten-Executor, nicht nur in Modell-Prompts. | Sichere öffentliche Felder dürfen erscheinen; rohe Agentenausgaben, verstecktes Denken, Debug-Prompts und private GM-Felder bleiben verborgen. Game-Effekte bleiben an den Rundenauftrag gebunden. |
| Game-Aktionen, Auswahlen, Proben, Inventar und Bögen | Game-Einrichtung/-Start durch den Host und bestehende Generierung; deterministische Nachzugeffekte werden einmal gespeichert. | Besitz menschlicher Aktionen folgt dem authentifizierten Teilnehmer. Auswahlen füllen einen Entwurf und umgehen nie die Einreichungsbereitschaft. |
| Medien, eigene/Paket-Tools, Game Experiences und Geräteintegrationen | Für Raumgenerierung nicht verfügbar. | Keine Teilnehmerdateien, Bilder, Audio, Video, entfernten Styles, Downloads, nativen Befehle oder paketgelieferte Gastoberflächen. Sie erfordern einen eigenen Sicherheitsschritt. |

Das erste geteilte Game ist der synchronisierte Erzähl-/Aktionsablauf. Rein clientseitige Taktik-/Minispieloberflächen, eigene Game Experiences sowie Szenen-/Mediendarstellung werden nicht als Gastfunktionen angeboten. Die normale Game-Einrichtung wird mit ausdrücklichen Einschränkungen dieser Optionen wiederverwendet. Kein vom Host gelieferter Renderer schließt eine Kompatibilitätslücke.

<a id="recovery-and-limits"></a>

## Wiederherstellung und Grenzen

Jeder authentifizierte Teilnehmer hat eine gespeicherte monoton steigende Aktionssequenz und begrenzte Operationsbelege. Eine Wiederholung liefert das vorige Ergebnis; ein Replay bleibt veraltet, auch nachdem sein Beleg aus dem Cache mit 128 Einträgen gefallen ist. Persona-Snapshots an Nachrichten ändern sich nicht mit späteren Persona-Wechseln. Namen menschlicher und KI-Personas müssen für gezieltes Flüstern und Proben eindeutig sein.

Anzeige- und Persona-Namen sind öffentlich und beweisen daher nie, wem ein Platz gehört. Ein Spieler, der geht oder verstummt, bekommt seinen alten Platz nur zurück, wenn seine Engine den privaten Wiederbeitrittsschlüssel dieses Platzes vorlegt: das Sitzungstoken aus der Aufnahme, die ihm den Platz ursprünglich zugewiesen hat, erneut als Bearer der neuen Beitrittsanfrage gesendet. Ohne ihn erhält eine Anfrage mit denselben Namen einen Namenskonflikt, und die Sitzungen des Platzes bleiben unberührt. Beide Engines halten den Schlüssel nur im Arbeitsspeicher. Nach einem Neustart der Gast-Engine entfernt der Host den alten Platz, bevor dieser Spieler dieselbe Persona wieder verwenden kann.

Persona-Wechsel in Game gelten ab der nächsten Rundengrenze. Vorhandene Bögen, aktuelle Werte, Inventarbesitz und Tracker-Datenschutzschlüssel folgen der stabilen Teilnehmeridentität; alte Nachrichten behalten ihre ursprüngliche Zuordnung. Belegt ein NPC vorher den gewünschten Namen, bleibt die alte Persona aktiv und der Spieler sieht einen Namenskonflikt. Vom Host veranlasstes Passen, Entfernen, Pausieren und Fortsetzen hinterlässt lokalisierte Ereignisse im selben Verlauf.

Game speichert erforderliche Teilnehmer, jede Einreichungsrevision und einen eindeutigen Auswertungsauftrag in den bestehenden Chat-Metadaten. Sammlung und Speicherung zugeordneter Nachrichten nutzen erst die vorhandene Metadatenwarteschlange, dann die Speichertransaktion. Anbieteraufrufe laufen außerhalb dieser Transaktion. Stop bricht das vertrauenswürdige Operationssignal ab; verspätete Raumschreibvorgänge müssen weiterhin zu seinem aktiven Auftrag passen. Unterbrochene Züge werden nicht automatisch wiederholt. Ausdrückliches Fortsetzen geht zur nächsten Sammlungsgrenze, ohne gespeicherte Effekte zu wiederholen. Fehlgeschlagene Einrichtung bleibt zur ausdrücklichen Prüfung oder zum Neustart in der Lobby.

Es gibt keine feste Obergrenze für Menschen oder KI-Charaktere. Protokollversion 1 begrenzt Aktionen auf 16 KiB, Snapshots auf 256 KiB und 100 aktuelle Nachrichten sowie Textnachrichten auf 8.000 Zeichen. Aufnahme-Warteschlangen, Listener-Sockets, Anfragen, Long Polls, Sitzungen, Passwortableitungen und Generierungsarbeit sind begrenzt. Pro Sitzung läuft eine Teilnehmerabfrage, pro Gast-Engine eine Connector-Abfrage. Komprimierung und Weiterleitungen werden nicht akzeptiert. Passwörter/Tokens stehen nie in URLs oder geteilten Snapshots.

Größere Räume hängen von Host-Ressourcen, Verbindungsdurchsatz und Modellkontext ab. Mitglieder werden nie stillschweigend entfernt, damit ein Update passt. Überschreitet ein geteiltes Update das Transportbudget, behält der Gast den letzten gültigen Zustand und kann gehen; der Host kann den Raum weiter verwalten und die Datenmenge verringern, damit Abfragen wieder funktionieren.

<a id="verification-record"></a>

## Prüfbericht

Automatisierte Nachweise verwenden temporären Speicher, eine lokale Test-CA und simulierte Modellanbieter. Sie ändern keine Zertifikate, Daten oder konfigurierten KI-Verbindungen eines Nutzers.

- `multiplayer-peer-security.regression.ts`: Prüfung von TLS-Kette, Hostname und Fingerabdruck vor HTTP-Datenoffenlegung; fehlerhafte/zu große/weiterleitende Antworten und Abbruch.
- `multiplayer-peer-server-security.regression.ts`: ausschließlich Raumrouten; Grenzen für Body, Header, Ausgabe, Rate und Parallelität sowie sofortiges Beenden des Listeners.
- `multiplayer-seat-key-security.regression.ts`: kopierte Namen oder ein falscher Wiederbeitrittsschlüssel übernehmen nie einen Platz oder dessen Flüstern; der Schlüsselinhaber kehrt auf denselben Platz zurück, und der Schlüssel erreicht nie andere Teilnehmer oder gespeicherte Chat-Daten.
- `multiplayer-room.regression.ts`: zwei Engines, Aufnahme, Besitzrechte, gefilterter Verlauf, Widerruf/Replay, sequenzielle Generierung und Game-Runden/Wiederherstellung für zwei Spieler.
- `multiplayer-session-flows.regression.ts`: zwei Engines über HTTPS mit echter Generierung und Game-Runtimes, simuliertem Anbieter und vollständigen Conversation-, Roleplay- und Game-Runden.
- `multiplayer-generation-policy.regression.ts` und `generation-output.regression.ts`: Executor-Einschränkungen, Ausschluss privater Bibliotheken, promptlokale Identitäten, gemeinsame Generierungssperre und Abschlusssemantik.
- `multiplayer-autonomy-security.regression.ts`: Wiederverwendung des Schedulers, Raumaktivitätsuhr, eine einzige Autorität und Stop-Rennen.
- `multiplayer-game-runtime.regression.ts`: Game-Einrichtung/Start/Intro, deterministische Zugeffekte, veraltete Schreibvorgänge und unterbrochene Einrichtung.
- `multiplayer-game-persona.regression.ts` und `multiplayer-game-projection.regression.ts`: Übertragung des Persona-Besitzes, Konfliktbehebung, Empfängerfilterung und begrenzte öffentliche Tracker.
- `e2e/multiplayer-guest-isolation.e2e.ts`: produktives Gast-Bundle mit bösartigem Text und versuchtem lokalem/Netzwerk-/nativem Zugriff in Desktop-Chromium, mobilem Chromium und mobilem WebKit.
- Gezielte Browsertests für Einrichtung und Bedienung prüfen Aufnahmewarnungen, Players, Game-Lobby, Touch-Layouts, hell/dunkel und Entwürfe/Wiederholungen.

Vor dem Merge `pnpm check`, relevante Node-Regressionen, `pnpm regression:prompt`, `pnpm smoke:ui` und die gezielte Browsermatrix am finalen Kandidaten erneut ausführen. Tatsächliche Ergebnisse und Revision im PR festhalten, CodeRabbit und eine gezielte Sicherheitsprüfung abschließen und unterstützte echte Geräte prüfen. Browseremulation ist kein Nachweis für den Home Screen echter iPhones/iPads oder Android-Geräte. Der native Android-Wrapper bleibt als Gast deaktiviert. Echte Geräte gelten bis zur Dokumentation ihrer Ergebnisse als ungeprüft; eine Viewport-Voreinstellung ist kein Unterstützungsnachweis.

Der Gast wird als klassische IIFE gebaut, weil ES-Modulladen mit opaker Origin sonst eine Lockerung von CORS erfordern würde. Produktions- und Entwicklungsstart bauen die festen lokalen Gast-Assets. Nach Änderungen am Gastcode bei laufendem Entwicklungsserver `node packages/client/scripts/build-multiplayer-guest.mjs` ausführen und die Gastansicht neu laden. Die Vollständigkeitsprüfung des Launchers umfasst beide isolierten Assets.

Folgeaufgabe für Übersetzungen: [#6854](https://github.com/Pasta-Devs/Marinara-Engine/issues/6854).
