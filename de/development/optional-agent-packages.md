# Optionale Agent- und Capability-Pakete

Status: umgesetzt im Entwicklungszyklus für v2.3.0, Issue #3612.

## Ziel

Die Basis-Auslieferung von Marinara Engine darf optionale Agent- und Capability-Implementierungen weder kompilieren noch mitliefern. Eine frische Installation startet ganz ohne optionale Pakete. Bei einem Update bleiben alle Fähigkeiten erhalten, die es schon vor diesem Paketsystem gab.

Der offizielle Katalog, die Paketquellen, reproduzierbare Artefakte, Prüfskripte und der Beitragsprozess liegen in [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Installierte Artefakte landen unterhalb des konfigurierten Marinara-Datenordners, damit ein Update der Anwendung sie nicht überschreiben kann.

## Paketmodell

Ein Agent-Paket kann einen oder mehrere deklarative Agenten beisteuern, dazu optional vertrauenswürdigen, ausführbaren Capability-Code:

- Server-Einstiegspunkte für Routen, Lifecycle-Hooks, Prompt-Provider, Result-Handler und Storage-Migrationen;
- Client-Einstiegspunkte für Panels, Chat-Oberflächen, Einstellungsbereiche, Auswahlpunkte in der Einrichtung, Laufzeitanzeigen und vollständige Game-Mode-Oberflächen;
- gemeinsam genutzte JSON-Schemas und stabile Wire-Contracts;
- paketeigene Assets, Dokumentation und Wissensfragmente für Professor Mari.

Pakete richten sich nach einer versionierten Marinara-Capability-API. Private Quellpfade der Engine dürfen sie nicht importieren.

Client-seitige Capability-Elemente erhalten die in der Engine gewählte UI-Sprache über ihre Attribute `lang` und `dir` sowie über
das Objekt `capabilityProps.localization`. Paketeigene Oberflächen bringen eigene Sprachdateien mit und fallen sonst auf das
Englisch des Pakets zurück; die Engine übersetzt weder Paket-Prompts noch maschinenlesbare Werte aus dem Paket. Ein Sprachwechsel
nutzt weiterhin das bestehende Event `marinara-capability-props` – eine installierte Oberfläche rendert also ohne Neustart der Engine neu.

### Bereitstellung und Caching

Installierte Paketdateien werden mit starken Validatoren ausgeliefert, die aus den SHA-256-Hashes pro Datei im Manifest abgeleitet sind – denselben Werten, mit denen die Engine die Bytes bei jedem Lesen erneut prüft. Das Client-Bundle (`/api/capability-packages/<id>/client`) und jedes Paket-Asset werden immer revalidiert (`no-cache` zusammen mit einem `ETag`). Eine unveränderte Datei antwortet deshalb mit `304 Not Modified`, statt erneut heruntergeladen zu werden, während eine neu veröffentlichte Datei sofort übernommen wird. Nichts wird als `immutable` ausgeliefert: Die Installationsrichtlinie erlaubt, dieselbe Version mit anderen Bytes erneut zu veröffentlichen, daher ist keine Paket-URL inhaltsadressiert.

Capability-API 1.1 ergänzt den Server-Aktivierungskontext um eine generische Runtime-Fassade.
Pakete lesen darüber den effektiven Agent-Debug-Status und schreiben über den Pino-Logger
der Engine, inklusive expliziter Debug-Modus-Überschreibungen – ohne den privaten Logger
oder die Module der Laufzeitkonfiguration zu importieren. Die Fassade stellt Operationen
bereit, nicht die dahinterliegenden Engine-Objekte.

Capability-API 1.2 ergänzt transaktionsgebundene Chat- und Nachrichten-Operationen,
eng begrenzte Schreibzugriffe auf Chat-Metadaten, Existenzprüfungen für Lorebook-Einträge
sowie den Kompatibilitätsspeicher für räumliche Snapshots. Pakete prüfen fachliche
Änderungen damit innerhalb einer Engine-Transaktion und schreiben Metadaten atomar
zusammen mit der zugehörigen Nachricht, einem Swipe oder einem räumlichen Snapshot fest –
ganz ohne Datenbank-Handle oder Tabellenobjekt. Rollback und Kompatibilität mit
historischen Speicherständen bleiben Sache der Engine, Validierung und Fachlogik Sache
der Pakete. Dieselbe API liefert außerdem normalisierte Chat- und Charakterdatensätze,
die Auswahl passender Lorebook-Einträge, das Parsen JSON-ähnlicher Antworten und aufgelöste
Sprachmodell-Aufrufe. Zugangsdaten von Verbindungen, Anbieter-Implementierungen,
Datenbank-Handles und Speicherobjekte bleiben der Engine vorbehalten.

### Capability API 1.7: Chat-Branches

Capability API 1.7 ergänzt `CapabilityChatRecord` um normalisierte Branch-Metadaten:

```ts
branch: {
  title: string | null;
  parentChatId: string | null;
  parentMessageId: string | null;
  childMessageId: string | null;
} | null;
```

`title` ist der getrimmte gespeicherte Branch-Name. Wurzel-Chats geben `null` zurück. Bekannte, von der Engine erstellte Branches nennen den unmittelbaren Eltern-Chat, die Quellnachricht der Abzweigung und die kopierte Kindnachricht. Leere Branches verwenden null-Nachrichtenanker. Alte Branches, fehlerhafte Metadaten und importierte Geschwister aus Gruppen ohne bekannte Beziehung geben null-Abstammungsfelder zurück; die Engine leitet historische Beziehungen nicht nachträglich her. Der generische Export und Import lässt Eltern- und Nachrichten-IDs weg, weil sich IDs zwischen Installationen ändern. Das Löschen des Eltern-Chats lässt die Abstammung des Kindes unverändert.

### Capability API 1.8: Game-Erlebnisse

Capability API 1.8 ergänzt paketbereitgestellte Game-Erlebnisse, Game-Prompt-Kontext pro Runde und Schreibzugriffe auf Ressourcen.

Ein Paket kann einen vollständigen Game Mode anstelle einer Erweiterung des eingebauten Modus bereitstellen. Es deklariert den Slot `game-surface` und wird beim Erstellen eines Spiels im Experiences-Bereich des Einrichtungsassistenten ausgewählt. Die Auswahl wird am Spiel gespeichert und bleibt für dessen gesamte Laufzeit fest, daher wird ein Erlebnis nie mitten in einem Durchlauf ein- oder ausgeschaltet. Die Oberfläche zeichnet ihr eigenes HUD, ihre Menüs und ihren Kampf über der gemeinsamen Erzählung und deklariert, welche eingebauten Systeme sie ersetzt. Alles nicht Deklarierte bleibt eingebaut, sodass ein Erlebnis nur das abschaltet, was es tatsächlich selbst umsetzt. Das optionale `contributions.gameSurface.surfaceClass` benennt eine Klasse, die die Engine während der Einbindung der Oberfläche auf den Spielbereich legt. So kann das Stylesheet des Pakets die gemeinsame, außerhalb des eigenen Elements gerenderte Oberfläche umgestalten.

Pakete mit der Berechtigung `prompt-context` tragen Text zum System-Prompt jeder generierten Game-Runde bei. Ein Paket mit eigenem Live-Zustand kann das Modell dadurch mit der Ansicht des Spielers abgleichen. Ein Beitrag kann auch deklarieren, welche eingebauten Spielsysteme er ersetzt; die Engine weist das Modell dann nicht mehr an, diese zu steuern. Beiträge werden pro Runde gesammelt und sind nie erforderlich: Ein leerer Beitrag wird übersprungen. Löst ein Beitrag einen Fehler aus oder wird er nicht innerhalb seiner Frist fertig, wird dies protokolliert und der Beitrag übersprungen, ohne die Generierung zu beeinflussen.

Die Ressourcen-Fassade bietet neben Lesezugriffen auch Schreibzugriffe. Der Einrichtungsablauf eines Pakets kann dadurch die Spieler-Persona und ihr Lorebook finden oder erstellen. Speicherung, Validierung und Identität bleiben bei der Engine; die fachlichen Inhalte bleiben bei den Paketen.

### Capability API 1.10: Paket-Assets

Capability API 1.10 ergänzt die allgemeine Bereitstellung paketeigener statischer Assets. Ein Manifest kann `contributions.assets.paths` deklarieren – eine Zulassungsliste mit bis zu 256 Bilddateien (`png`/`webp`/`gif`/`jpg`/`jpeg`) und JSON-Dateien aus dem Paket. Die Engine liefert sie unter `/api/capability-packages/<id>/assets/<path>` über dieselbe exakte Prüfkette aus, die bereits Symbole von Browser-Tabs verwenden: Pfadbegrenzung, Hash-Mitgliedschaft in `files[]`, eine passive Inhaltstyp-Zulassungsliste und erneute Integritätsprüfung bei jedem Lesen. Aktive Dokumenttypen (SVG, HTML, Skripte) werden vom Schema abgelehnt. Jeder deklarierte Pfad muss per Hash in `files[]` festgeschrieben sein, und die paketinterne `manifest.json` kann selbst bei Deklaration nie ausgeliefert werden. Für `contributions.assets` ist ein Manifest mit `schemaVersion` 2 und `capabilityApi` 1.10 oder neuer erforderlich – ein v1-Manifest kann es überhaupt nicht deklarieren. Assets werden immer revalidiert: Wie das Client-Bundle tragen sie einen starken Manifest-Hash-`ETag` und beantworten eine unveränderte Revalidierung mit `304 Not Modified` ohne Body. Ein mitgeliefertes Tileset wird somit nur erneut geladen, wenn sich seine Bytes tatsächlich ändern. Antworten sind bewusst nie `immutable`, weil die Installationsrichtlinie eine erneute Veröffentlichung derselben Version mit anderen Bytes zulässt und eine URL mit Versionskennung daher nicht inhaltsadressiert ist. So kann ein `game-surface`-Erlebnis echte Grafik mitbringen, statt sie in sein Client-Bundle einzubetten.

Ein Manifest, das diese Regeln verletzt, wird bei der Installation mit einer der folgenden Meldungen abgelehnt: "A declared package asset must be listed in the package file manifest", "contributions.assets requires schemaVersion 2 and capabilityApi 1.10 or newer", dem Schemafehler zur Erweiterung bei einem Pfad, der weder Bild noch JSON ist, oder – bei Archiven mit Dateinamen, die sich nur in der Groß- und Kleinschreibung unterscheiden und auf entsprechenden Dateisystemen in dieselbe Datei fallen würden – "Package contains duplicate file" / "Package manifest declares files that collide on case-insensitive filesystems".

Jedes Capability-Element erhält dafür eine eigene Identität: `capabilityProps.packageId` und `capabilityProps.packageVersion` kommen zusammen mit `localization`. Ein Bundle baut damit seine Asset-URLs als `/api/capability-packages/<packageId>/assets/<path>` auf, optional mit `?v=<packageVersion>`, damit eine neue Version jeden Zwischenspeicher umgeht. Die Liste installierter Pakete muss dafür weder erneut geladen noch die eigene Import-URL untersucht werden.

### Capability API 1.11: Kampfschnittstelle für Erlebnisse

Capability API 1.11 ergänzt die Capability-Props von `game-surface` um eine Kampfschnittstelle. `combatActive` meldet genau den Zeitpunkt, an dem die eingebaute Kampfoberfläche tatsächlich eingebunden wird. Anders als `chatMeta.gameActiveState`, der narrative Szenenzustand des GM, hängt dieser Wert dem Wechsel nicht hinterher und kann nicht "combat" melden, obwohl noch keine Begegnung existiert. `combatStyle` enthält den wirksamen Stil (`classic` oder `tactical`). `requestCombat()` bittet die Engine, eine Begegnung mit genau demselben Durchlauf wie die manuelle Schaltfläche Start Combat zu erzeugen, nur ohne Bestätigungsdialog, da die eigene Oberfläche des Erlebnisses die Absicht bereits ausgedrückt hat. Der Generierungsdurchlauf der Engine entscheidet weiterhin über die Begegnung. Bewusst nicht vorhanden ist eine Möglichkeit für Pakete, Kämpfer oder Kampfzustand direkt vorzugeben – der Kampf bleibt Eigentum der Engine.

`requestCombat()` besitzt eine stabile Identität, bleibt im Paketpfad still und gibt einen Code zurück, aus dem das Erlebnis seine eigene Rückmeldung erzeugt: `"started"` oder eine Ablehnung – `"combat-active"`, `"pending"` (eine Generierung läuft bereits), `"no-turn"` (der GM hat noch keine Runde geschrieben) oder `"unavailable"` (beendete Sitzung oder Wiederholung). `combatPending` und `combatError` spiegeln Fortschritt und Fehler der Generierung, sodass ein Paket nach einer fehlgeschlagenen Generierung nicht endlos auf `combatActive` wartet. Wie die Schnittstellen 1.7 und 1.8, aber anders als die hart begrenzten `contributions.assets` aus 1.10, werden diese Props an jedes `game-surface`-Paket geliefert, unabhängig von seiner deklarierten `capabilityApi`. Die Kennzeichnung 1.11 nennt nur den Zeitpunkt ihrer Einführung; ein Paket, das sie benötigt, deklariert 1.11 und wird von älteren Engines sauber abgelehnt.

### Capability API 1.12: räumliche Events für das besitzende Erlebnis

Capability API 1.12 adressiert räumliche Capability-Events zusätzlich an das Paket des Erlebnisses, dem das Spiel gehört. `spatial_transition_committed`, `spatial_transition_rejected` und der untypisierte Hinweis `spatial_context_refresh`, die zuvor im Fenster-Event `marinara-capability-server-event` nur an `hierarchical-maps` adressiert waren, werden nun auch mit der auf die `gameExperienceId` des Chats gesetzten `packageId` ausgeliefert. Die Payloads unterscheiden sich: Ein bestätigtes Event enthält `{ chatId, commandId, currentLocationId, definitionRevision, travel? }`; ein abgelehntes Event enthält `{ chatId, commandId, code?, message? }` ohne Ortsfelder, da keine Bewegung stattgefunden hat; der Aktualisierungshinweis enthält `data: null`. Ein Erlebnis, das über das Argument `pendingSpatialTransition` von `sendMessage` einen Reisebefehl gesendet hat, kann seine Reise deshalb bestätigen oder löschen, sobald der Host das Ergebnis kennt, statt es aus späteren Zustandsabfragen abzuleiten. 1.12 schließt außerdem eine Lücke, die World Maps selbst betraf: Übergänge, die über einen der beiden stillen HTTP-Pfade abgelehnt wurden – den Commit vor dem Streaming der Besitzerrunde innerhalb einer Generierung oder den eigenständigen REST-Commit –, erzeugten zuvor gar kein Event. Beide erzeugen nun `spatial_transition_rejected`, und zwar nur bei eindeutigen Belegen, also einem `spatial_*`-Fehlercode außer `already_applied`. Bei nicht eindeutigen Fehlern – etwa einem Netzwerkfehler, bei dem ein erfolgreicher Commit verloren gegangen sein könnte – wird stattdessen der untypisierte Hinweis `spatial_context_refresh` gesendet, damit Listener den Serverzustand abgleichen, statt einem erfundenen Ergebnis zu folgen. Ein bestätigtes Event mit `travel.mode` gleich `"step_by_step"` und `complete: false` bedeutet, dass die Reise weitergeht; behalte den ausstehenden Zustand bis zum abschließenden Event. Dies ist wie 1.11 eine weiche Schnittstelle: Events werden unabhängig von der deklarierten `capabilityApi` geliefert. Deklariere 1.12 nur, wenn dein Paket sie benötigt.

### Capability API 1.13: vorübergehendes Einklappen der Erzählung

Capability API 1.13 ergänzt die Chrome-Deklaration, die ein `game-surface`-Paket an `setExperienceChrome` übergibt, um `requestsCollapsedNarration`. Solange das Flag true ist, klappt das Erzählfeld im Game Mode auf seinen schmalen Griff zusammen. Ein Erlebnis kann den Bildschirm so für eine Zwischensequenz oder einen Vollbildmoment freigeben.

Es handelt sich um eine ANFRAGE, nicht um eine Einstellung. Die eigene Einklapp-Einstellung des Spielers wird nie geschrieben, und das Flag gilt nur, solange dein Erlebnis die aktive Oberfläche ist. Entferne das Flag oder verliere den Status als aktive Oberfläche, und das Feld kehrt zur Auswahl des Spielers zurück. Das ist die Garantie, dass es sich danach immer wieder öffnet; ein Paket kann das Einklappen bewusst nicht dauerhaft speichern.

Die Sicherheitsregeln der Engine haben Vorrang. Das Feld wird zwangsweise ausgeklappt, sobald die Texteingabe des Spielers sichtbar ist, auch ganz am Anfang einer Szene vor dem ersten Segment, und sobald die Steuerelemente zum Fortsetzen eines Segments aktiv sind. Diese Steuerelemente sind der einzige Weg, eine Runde zu beenden; könnte ein Paket sie verbergen, könnte es den Spieler dauerhaft festsetzen. Der Griff zeigt außerdem weiterhin seinen Aufmerksamkeitsindikator, wenn eine Szenenanalyse, Generierung oder Wiederholung der Kampf-Generierung aussteht. Klappt ein Spieler das Feld während einer Anfrage von Hand aus, bleibt es offen, bis die Anfrage endet. Wie die Schnittstellen 1.11 und 1.12 ist dies eine weiche Schnittstelle: Das Feld wird unabhängig von der deklarierten `capabilityApi` beachtet. Die Kennzeichnung 1.13 nennt nur den Zeitpunkt seiner Einführung, daher deklariert ein Paket, das es benötigt, 1.13.

## Erste Pakete

- alle bisher fest eingebauten Agenten;
- hierarchische räumliche Karten für Roleplay und Game;
- Audio- und Videoanrufe in Conversation;
- UNO;
- Chess;
- Poker;
- 8-Ball Pool;
- Tic-Tac-Toe;
- Rock-Paper-Scissors.

In der Basis bleiben nur der Paketmanager, der Katalog-Client, die generischen Verträge für die Agent-Pipeline, die generischen Verträge für Turn-Game-Hosts und die inerten Host-Schnittstellen. Die konkreten Implementierungen gehören in die Pakete.

## Vertrauen und Installation

Der offizielle Katalog ist ein schemavalidiertes, versioniertes JSON-Dokument und wird über HTTPS geladen. Jeder Release-Eintrag nennt unveränderliche Artefakt-URLs, SHA-256-Prüfsummen, Dateigrößen in Byte, die Engine-Kompatibilität, die Berechtigungen und ob die Laufzeit einen Neustart braucht.

Beim Serverstart lädt der Host den Katalog genau einmal, sofern mindestens ein offizielles Paket installiert ist. Er wählt nur neuere Versionen aus, die zur laufenden Engine und zur Capability-API passen, prüft sie über die normale Installationsstrecke und installiert sie, bevor die Paket-Laufzeiten aktiv werden. Fehler bleiben auf das jeweilige Paket beschränkt. Ist der Katalog offline oder schlägt eine Prüfung fehl, bleiben vorhandene Dateien und der Registry-Stand nutzbar; scheitert die Bereitschaft einer Server-Laufzeit, greift der Rollback auf die Vorgängerversion.

Der Installer muss:

1. privilegierten Loopback-/Admin-Zugriff verlangen;
2. HTTPS, Download-Grenzen und Zeitlimits durchsetzen;
3. vor dem Entpacken das Katalogvertrauen und die SHA-256-Prüfsumme des Artefakts verifizieren;
4. absolute Pfade, Traversal, Links, Gerätedateien und nicht deklarierte Dateien ablehnen;
5. das Manifest und die Engine-Kompatibilität validieren;
6. in einen temporären Nachbarordner entpacken;
7. erst nach erfolgreicher Validierung atomar aktivieren;
8. die Vorgängerversion behalten, bis die neue Laufzeit sauber startet;
9. die Aktivierung im Fehlerfall zurückrollen;
10. niemals Install-, Update- oder Uninstall-Skripte ausführen.

Der offizielle Katalog aktiviert ausschließlich vertrauenswürdige, ausführbare Pakete aus erster Hand. Ein späterer Weg für Drittanbieter braucht ein eigenes, ausdrückliches Vertrauenskonzept.

## Laufzeit- und Neustartverhalten

Der Server verwaltet die Registry der installierten Pakete und stellt den Clients die installierten Fähigkeiten bereit. Deklarative und nachladbare Module werden sofort aktiv. Nach der Aktivierung verwirft die Oberfläche die Abfragen zu Katalog, Agenten, Modus-Fähigkeiten und aktivem Chat.

`restartRequired` darf im Manifest nur stehen, wenn der Host diesen Einstiegspunkt nicht gefahrlos neu laden kann. Nach erfolgreicher Aktivierung im laufenden Betrieb meldet Marinara `Agent installed. It is ready to use.` Ist ein Neustart nötig, lautet die Meldung `Agent installed. Restart Marinara Engine to finish setup.`

Turn-Game-Pakete lassen sich im laufenden Betrieb neu laden: Die Installation registriert Server-Engine und manuellen Slash-Befehl sofort, die Deinstallation löst die Laufzeit ohne Neustart der Engine wieder ab. Die Einstellung **Conversation Commands** (Chat-Befehle) je Chat regelt nur, ob Charaktere den versteckten Befehl des Pakets auslösen dürfen – den eigenen Slash-Befehl schränkt sie nicht ein. Die aktuellen offiziellen Turn-Game-Manifeste tragen aus Vorsicht weiterhin die alte Neustart-Markierung, damit sie mit Engine 2.x kompatibel bleiben; Engine 3.x erkennt die Art `turn-game`, aktiviert sicher im laufenden Betrieb und meldet das Paket als aktiv und einsatzbereit.

## Kompatibilitäts-Migration

Beim ersten Start nach dem Update gilt:

- eigene Agenten bleiben unangetastet;
- jeder alte, fest eingebaute Agent, den diese Installation kennt, wird als installiert vermerkt;
- Karten, Conversation-Anrufe und Conversation-Spiele bleiben genauso verfügbar wie zuvor;
- vorhandene Chat-Konfiguration, Snapshots, Spielzustand, Anrufverlauf und Agent-Gedächtnis bleiben erhalten;
- die Migration ist wiederholbar und vermerkt ihren Abschluss erst, wenn alle alten Verfügbarkeitseinträge dauerhaft gespeichert sind.

Die alten Paket-Artefakte bleiben als Migrationsquelle im offiziellen Katalog verfügbar. Frische Installationen zeigen und aktivieren sie erst, wenn du sie selbst installierst.

## Deinstallation

Beim Deinstallieren entfernt Marinara das Paket aus der Auswahl aktiver Chats, löscht seine Agent-Konfiguration und die heruntergeladenen ausführbaren Dateien und löst seine Laufzeit bei Bedarf mit dem nächsten Neustart ab. Bisherige Chats, Nachrichten, Karten-Snapshots, Anrufzusammenfassungen und abgeschlossene Spielstände bleiben lesbar – das Entfernen eines Pakets kann deine Arbeit also nicht zerstören. Fachdaten aus der Historie endgültig zu löschen, ist ein separater, ausdrücklicher Schritt.

Jede Deinstallation muss bestätigt werden. Betroffene Chats fallen auf ihre gewöhnlichen Basis-Oberflächen zurück, ohne dass der Verlauf Schaden nimmt.

## Katalog-Oberfläche

Im **Agents**-Panel gibt es die Schaltfläche `Download Agents`, passend zum `Download Cards` im **Card Browser** (Kartenbrowser). Sie öffnet eine bildschirmfüllende, responsive Bibliothek mit Suche, Paketarten, Kompatibilitätsangaben, Installations- und Update-Status, Berechtigungen, Speicherbedarf, Dokumentation und Schaltflächen zum Deinstallieren.

Am Desktop steht neben der Übersichtsliste ein Detailbereich. Auf dem Handy gibt es nur ein Panel, dafür eine ausdrückliche Zurück-Navigation und fingerfreundliche Aktionen. Leere, offline, inkompatibel, beschädigter Download, abgebrochene Installation, Update, Rollback und „Neustart nötig“ sind vollwertige Zustände der Oberfläche.

## Kriterium für eine abgeschlossene Auslagerung

Eine Auslagerung gilt erst dann als abgeschlossen, wenn die produktiven Basis-Bundles von Client und Server die Paket-Implementierung nicht mehr enthalten, eine frische Installation sie ohne Download des Pakets nicht aktivieren kann, eine aktualisierte Installation sie behält und Installation, Update und Deinstallation des Pakets am Desktop, auf dem Handy und auf Termux-kompatiblen Dateisystemen durchlaufen.
