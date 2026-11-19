# Voraussetzungen für eine Antigravity-CLI-Abonnementintegration

Diese Recherche für Entwickler zu [#8143](https://github.com/Pasta-Devs/Marinara-Engine/issues/8143) wurde erstmals am 2026-10-23 und erneut am 2026-11-19 mit den offiziellen Windows-Versionen 1.5.11 und 1.5.12 von `agy` geprüft. Marinara Engine implementiert **keine** Antigravity-Abonnementverbindung. Das Issue bleibt als nicht geplant geschlossen. Die Ausschlüsse des eigenen Agenten unterdrückten die getesteten Hooks, doch der MCP-Unterprozess eines global gefundenen Plugins startete in beiden Versionen. Die Ausführungsisolation ist weiterhin nicht belegt.

## Belegte offizielle Schnittstellen

Die offizielle CLI `agy` unterstützt die Kontoanmeldung mit gespeicherten Anmeldedaten und die Textgenerierung ohne interaktive Oberfläche. Ihr dokumentiertes Protokoll umfasst `init`, `step_update` und `result`. Beim Streaming gehen JSON-Benutzernachrichten über stdin ein. Bei der Windows-Nachprüfung listete `agy models` das Modell `gemini-4-neon-high` auf. Zeitlich begrenzte Anfragen an dieses Modell waren mit der bestehenden Google AI Pro-Anmeldung erfolgreich. Welche Modelle ein Konto nutzen kann, muss die installierte CLI liefern. Das Beispiel allein gibt darüber keine Auskunft. `--print-timeout 0` wartet bis zum Abschluss, und `--disable-slash-commands` deaktiviert die Befehlsexpansion im Print-Modus. Siehe [Betrieb ohne interaktive Oberfläche](https://antigravity.google/docs/cli/headless/) und [Referenz der CLI-Optionen](https://antigravity.google/docs/cli/reference/).

Die Kontoanmeldung der CLI nutzt den Anmeldedatenspeicher des Betriebssystems. Ihr gesonderter Gemini-API-Schlüsselmodus erfordert `modelProvider: "gemini"` und `GEMINI_API_KEY`; ein Abonnementadapter darf diesen Abrechnungsweg nicht stillschweigend wählen. Die dokumentierten Methoden zur programmatischen Authentifizierung des Python-SDK sind Gemini-API-Schlüssel, Vertex-/Google-Cloud-Anmeldedaten und lokale Modelle. Diese Methoden belegen keine Authentifizierung über ein Endkundenabonnement für einen SDK-basierten Ersatz. Siehe [Authentifizierung](https://antigravity.google/docs/install/#programmatic-authentication) und die [SDK-Übersicht](https://antigravity.google/docs/sdk/overview/).

## Aktueller Befund zur Ausführungsisolation

Die offiziellen Definitionen eigener Agenten bieten Einstellungen für Tools, MCP und Anpassungen. Laut Plugin-Anleitung steuert `inheritCustomizations` die Übernahme von Skills, Regeln und Hooks und `inheritMcp` die Übernahme von MCP-Servern des Arbeitsbereichs. Die ursprüngliche Ankündigung von `excludeDefaultComponents: true` behält Hooks nach dem Modellaufruf bei. Diese Einstellung allein belegt daher keine Isolation. Die folgende kombinierte Konfiguration unterdrückte die für den Test eingerichteten Hooks in 1.5.11, verhinderte aber nicht jeden MCP-Unterprozessstart. Siehe [Eigene Unteragenten](https://antigravity.google/docs/subagents/), [Plugins entwickeln](https://antigravity.google/docs/build-plugins/) und das [CLI-Änderungsprotokoll](https://antigravity.google/docs/changelog).

Hooks können aus einem Arbeitsbereich, der globalen Datei `~/.gemini/config/hooks.json` und installierten Plugins stammen. Sie umfassen Sitzungs-, Modellaufruf-, Tool- und Stoppereignisse. Die aktuelle Einstellungsdokumentation und das [offizielle Einstellungsschema](https://antigravity.google/schemas/v1/settings.json) besagen ausdrücklich, dass ein Eintrag `hooks` in `settings.json` nicht geladen wird. Ein leerer Eintrag dort würde die tatsächlichen Hook-Quellen nicht deaktivieren. Siehe [Hooks](https://antigravity.google/docs/hooks) und [CLI-Einstellungen](https://antigravity.google/docs/settings?tab=cli).

Die Hilfe der installierten Version 1.5.11 dokumentiert `--settings` als Überschreibung der Schlüssel von `settings.json` für die laufende Sitzung, inline oder per Datei. So lassen sich die Vertrauenseinstellungen und Berechtigungen des Arbeitsbereichs vorübergehend ändern, ohne gespeicherte Einstellungen umzuschreiben. Daraus ergibt sich kein eigenes Konfigurationsprofil: `--settings '{"hooks":{}}'` endet mit Code 1 und `unknown setting "hooks"`. Die Hilfe nennt weder eine Option zum Abschalten von Hooks noch ein isoliertes Profil mit Kontoanmeldung.

Laut aktueller Einstellungsdokumentation kann `/hooks` Hooks hinzufügen, bearbeiten und umschalten. Änderungen werden in Konfigurationsdateien gespeichert. Bei der Nachprüfung lieferte `-p "/hooks" --output-format json` ohne interaktive Oberfläche eine strukturierte Bestandsaufnahme. Die Liste und die gespeicherten Schalter garantieren nicht, dass ein späterer Aufruf ausführbare Anpassungen ausschließt. Ein Verzeichniswechsel, eine leere `tools`-Liste, die Anweisung, keine Tools zu nutzen, oder ein Abbruch nach dem Start reichen als Isolationsnachweis nicht aus.

Berichte über Integrationen von Drittanbietern sind Ansatzpunkte für die Untersuchung. Ihre Aussagen über wirkungslose Tools, Protokolle zur Agentenauflösung oder die Übernahme von Anpassungen müssen mit der offiziellen Veröffentlichung reproduziert werden, bevor die Engine sich darauf stützen darf.

## Prüfung der Veröffentlichung im Oktober 2026

Das [offizielle Installationsskript](https://antigravity.google/cli/install.sh) und sein [Veröffentlichungsmanifest für Darwin ARM64](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/darwin_arm64.json) wurden geprüft, ohne das Installationsskript auszuführen. Das Manifest wählte das [versionierte `agy`-Archiv 1.4.6 für Darwin ARM64](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.6-4884751325200384/darwin-arm/cli_mac_arm64.tar.gz) mit dieser SHA-512-Prüfsumme:

```text
25af49004dd6d6013e6231278e2711b95641c8e54b661be871b3519c0a850053d4e707f46b47aa66e84ff9480041b13908194b48b1a97f84f2a22071d9c9fd3f
```

Die Archivprüfsumme stimmte überein. Die Binärdatei wurde in ein temporäres Verzeichnis dieser Aufgabe entpackt. Ausgeführt wurden nur `--version` und `--help`, in einer macOS-Sandbox, die Netzwerkzugriff, Lese- und Schreibzugriff auf das Benutzerverzeichnis sowie den Zugriff auf den Schlüsselbunddienst verweigerte. Beide Aufrufe endeten erfolgreich. Die Hilfe führte keine Option zum Deaktivieren von Hooks und kein isoliertes Profil- oder Konfigurationsverzeichnis auf.

Diese Prüfung hat die CLI **nicht** installiert oder authentifiziert, keine Anmeldedaten eingesehen, kein Modell aufgerufen, keine Modelle eines angemeldeten Kontos aufgelistet und keine Hook-Ausführung getestet. Sie bestätigt die öffentliche Optionsliste; sie beweist weder, dass Isolation unmöglich ist, noch validiert sie die Generierung über ein Abonnement.

## Windows-Prüfung im November 2026

Das installierte `agy` meldete 1.5.11. Sein SHA-512-Wert entsprach der beobachteten Prüfsumme im [offiziellen Manifest für Windows AMD64](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/windows_amd64.json). Die ursprüngliche Manifestantwort wurde nicht aufbewahrt, und das fortlaufend aktualisierte Manifest wechselte später auf 1.5.12. Bei der Überprüfung wurde die [versionierte Windows-Programmdatei 1.5.11](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.11-6132547114106880/windows-x64/cli_windows_x64.exe) unabhängig heruntergeladen und ohne Ausführung gehasht. Ihre 234.827.416 Byte ergaben denselben SHA-512-Wert wie die installierte Datei:

```text
7de2a90b3a351c5c1d089b50a773d4fc455062870fa62fc4d50ee2779d7b9f1b630a7025c31163671f6c82ae0426aeda838f98f67270a50fdd2c7de2f2d7eb3f
```

Die Tests liefen in einem temporären Arbeitsbereich der Aufgabe mit folgendem Frontmatter in `.agents/agents/me-isolation-probe.md`:

```yaml
name: me-isolation-probe
description: Harmless execution-isolation qualification fixture.
mainAgent: true
subagent: false
tools: []
inheritCustomizations: false
inheritMcp: false
excludeDefaultComponents: true
commandExecutionPolicy: off
```

Die offizielle [Frontmatter-Referenz für eigene Agenten](https://antigravity.google/docs/subagents/) dokumentiert `mainAgent`, `subagent`, `tools` und `commandExecutionPolicy`. Plugin-Anleitung und Änderungsprotokoll oben beschreiben Vererbung und Ausschlüsse. Die Prüfkonfiguration wurde als Ganzes getestet. Dass die Agentenauswahl gelang, belegt nicht, dass jedes Feld für sich durchgesetzt wurde.

Zur Generierung diente `--settings <session-settings-json> --agent me-isolation-probe --model gemini-4-neon-high --disable-slash-commands --print-timeout 40s --output-format stream-json -p <prompt>` mit einem separaten Zeitlimit von 55 Sekunden für den Unterprozess. Die Inline-JSON-Einstellungen stuften den temporären Arbeitsbereich als vertrauenswürdig ein, wählten den Standard-Agentenmodus und den unten genannten Berechtigungsmodus und deaktivierten eigene Status- und Titelskripte. Keine Berechtigungsprüfung wurde umgangen.

Das Einstellungsobjekt war wie folgt aufgebaut. `<temporary-workspace>` wurde durch das Prüfverzeichnis ersetzt, `toolPermission` durch den Berechtigungsmodus des jeweiligen Tests:

```json
{
  "trustedWorkspaces": ["<temporary-workspace>"],
  "agentMode": "",
  "toolPermission": "strict",
  "statusLine": { "enabled": false },
  "title": { "enabled": false }
}
```

Umgebungsvariablen für API-Schlüssel und ADC wurden aus der Umgebung des Test-Unterprozesses entfernt. Anmeldedaten wurden weder extrahiert noch kopiert.

Die Test-Hooks hängten für `SessionStart`, `PreInvocation`, `PostInvocation` und `Stop` die Ereignisnamen an separate Markerdateien an. Die lokalen Python-MCP-Testserver schrieben beim Start einen Marker, bevor sie `initialize` und `tools/list` über stdio beantworteten. Die MCP-Konfiguration des Arbeitsbereichs lag in `.agents/mcp_config.json`. Plugins enthielten `plugin.json`, `hooks.json` und `mcp_config.json` und wurden über ein `entries`-Manifest unter `.agents/plugins.json` oder `~/.gemini/config/plugins.json` gefunden. Siehe [Erkennung von Anpassungen](https://antigravity.google/docs/customization-discovery/). Die Kontrollläufe für Hooks, MCP und Dateizugriff ließen `--agent` weg und behielten Testdaten und Sitzungseinstellungen bei. Der Test mit nicht vorhandenem Namen verglich stattdessen `--agent me-isolation-probe` mit einem nicht auflösbaren Agentennamen.

| Test | Kontrolllauf | Eigener Agent |
| --- | --- | --- |
| Hooks im Arbeitsbereich und global sowie Hooks von im Arbeitsbereich gefundenen Plugins (Berechtigung `strict`) | Alle vier Ereignisse schrieben in jeder Quelle Marker | Keine Hook-Marker |
| MCP des Arbeitsbereichs und dort gefundener Plugins (Berechtigung `strict`) | Beide Unterprozesse schrieben Startmarker | Kein Startmarker |
| Hooks eines global gefundenen Plugins (Berechtigung `request-review`) | Alle vier Ereignisse schrieben Marker | Keine Hook-Marker |
| MCP eines global gefundenen Plugins (Berechtigung `request-review`) | Der Unterprozess schrieb seinen Startmarker | Der Unterprozess schrieb weiter seinen Startmarker |
| Explizite Anfrage mit `view_file` nach einem unvorhersehbaren Testwert (Berechtigung `request-review`) | Gab den Testwert zurück | Gab `FILE_UNAVAILABLE` zurück und lieferte den Testwert nicht |
| Nicht vorhandener Name für `--agent` (Berechtigung `strict`) | `--agent me-isolation-probe` schloss die Generierung ab | Der ungültige Name führte zu Code 1, einem Fehlerergebnis, null Verbrauch und keinen Hook- oder MCP-Markern |

Der MCP-Befund für das global gefundene Plugin wurde zweimal mit `strict`-Berechtigung wiederholt, jeweils mit einem neuen Pfad für den Startmarker. Beide Anfragen mit eigenem Agenten endeten mit Code 0, und beide Unterprozesse schrieben ihren Marker. Ein verzögerter Schreibzugriff aus dem früheren Kontrolllauf hätte diese neuen Pfade nicht treffen können. Dieser Unterprozessstart verhindert weiterhin die Freigabe, obwohl die generierte Antwort kein MCP-Tool nutzte.

Der Prompt für den Dateizugriff lautete `Use view_file to read <fixture-path> and reply with its exact contents. Do not guess.`. Eingesetzt wurde der absolute Pfad der temporären Testdatei. Der Markdown-Text des eigenen Agenten wies ihn an, `FILE_UNAVAILABLE` zu antworten, falls er die Datei nicht lesen konnte.

Als das offizielle Manifest während der Untersuchung aktualisiert wurde, wurde die [Windows-Programmdatei 1.5.12](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.12-5281398513336320/windows-x64/cli_windows_x64.exe) in das Prüfverzeichnis der Aufgabe heruntergeladen. Die installierte CLI wurde nicht ersetzt. Der SHA-512-Wert wurde anhand der folgenden aufbewahrten Manifestantwort geprüft:

```json
{
  "version": "1.5.12",
  "url": "https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.12-5281398513336320/windows-x64/cli_windows_x64.exe",
  "sha512": "64603ba45b2783587edc62fd9effa9228091593b440ed54368e098bb5fb3ee034bada58c4125e3c0e509ed460b327e454dc99971d04d47c7aee417f00f56d801"
}
```

Der Vergleich zwischen Kontrolllauf und eigenem Agenten für das global gefundene Plugin und den Dateizugriff wurde mit 1.5.12, derselben bestehenden Anmeldung und `request-review`-Berechtigung wiederholt. Im Kontrolllauf liefen alle Plugin-Hooks, der MCP-Unterprozess startete und die Antwort enthielt den Testwert. Der eigene Agent antwortete `FILE_UNAVAILABLE` und unterdrückte die Hooks. Der MCP-Unterprozess startete trotzdem. Beide Generierungen endeten mit Code 0. Die übrigen Tabellenzeilen wurden nur mit 1.5.11 getestet.

`init.agent` im Stream nannte den ausgewählten eigenen Agenten. Eine getrennte Anfrage mit 1.5.11 gab einen Marker zurück, der nur in seinem Markdown-Text stand. `init.tools` listete jedoch in beiden Läufen dieselben eingebauten Tools, darunter `run_command` und `view_file`. Die Liste lässt keine eindeutige Aussage über den tatsächlichen Zugriff zu. Der Dateitest belegt das beobachtete Verhalten eines Tools. Die anderen müssen noch geprüft werden.

Globale Testdateien wurden nur an zuvor freien Hook- und Manifestpfaden exklusiv angelegt. Vor dem Löschen wurde ihr Inhalt geprüft. Beide temporären globalen Dateien wurden entfernt, und die dauerhaften CLI-Einstellungen entsprachen ihren Prüfsummen vor dem Test. Die CLI behielt ihren normalen Chat-Zustand. Vorhandene globale Konfigurationen wurden nicht ersetzt.

Die Tests sahen keine Anmeldedaten ein. Die Authentifizierung blieb in der offiziellen CLI.

Diese Windows-Tests belegen die Generierung mit Abonnementanmeldung und grenzen das ursprüngliche Hook-Problem ein. Der Adapter bleibt ungeprüft, weil MCP-Unterprozesse global gefundener Plugins weiterhin starten. Ungeprüft sind auch eigenständige globale MCP-Server, geerbte Skills, Regeln und Unteragenten, die Gesamtheit der handlungsfähigen Tools, Abbruch, längere Phasen ohne Ausgabe sowie echte Läufe auf Linux und macOS. Die neueren Korrekturen an Plugin-Richtlinien und Sandbox aus dem CLI-Änderungsprotokoll belegen nicht, dass eine normale Anfrage über ein Endkundenabonnement jede ausführbare Anpassung ausschließt.

## Erforderliche Nachweise vor der Auslieferung eines Adapters

1. Belege einen unterstützten Weg, globale und arbeitsbereichsbezogene Hooks, Plugins, Skills, Regeln, Unteragenten, MCP-Server und handlungsfähige Tools auszuschließen, bevor eine Anfrage sie ausführen kann. Die normale Kontoanmeldung bleibt in der offiziellen CLI; extrahiere oder kopiere keine Tokens.
2. Prüfe diesen Mechanismus mit der tatsächlichen offiziellen CLI gegen kontrollierte lokale Modell-Testumgebungen. Richte beobachtbare Testmarker für globale und arbeitsbereichsbezogene Hooks sowie Plugins/MCP ein, dazu Regeln und Tool-Anfragen. Prüfe sowohl den isolierten Lauf als auch Negativkontrollen, die zeigen, dass die Testmarker ohne Isolation beobachtbar sind.
3. Belege vor der Ausführung, dass der ausgewählte eigene Agent tatsächlich aufgelöst wird. Lehne nicht unterstützte Versionen, nicht aufgelöste Agentennamen, unbekannte Bestandsformate und uneindeutige Isolationsprüfungen ab; verlasse dich weder auf interne Protokollformulierungen noch auf eine scheinbar leere Tool-Liste beim Start.
4. Ergänze begrenzte Ein-/Ausgabe für Unterprozesse, private temporäre Dateien samt Bereinigung, Abbruch, die Behandlung von Fehler-Exitcodes und Ergebnisfehlern sowie Tests für aktivitätsabhängige Zeitlimits – auch für langes Nachdenken ohne sichtbaren Text. Rufe kontospezifische Modelle über den offiziellen Befehl ab und behalte das ausgewählte Modell sowie den unterstützten Denkaufwand bei.
5. Nutze die bestehenden Verbindungs-/Anbieterverträge. SDK-Optionen von Claude wie `settingSources: []` sind anbieterspezifisch; sie sind keine Optionen, die auf `agy` übertragen werden dürfen. Benenne verbleibende Prüflücken bei echter Authentifizierung, Abonnementabrechnung und physischen Plattformen ausdrücklich.

Die Windows-Ergebnisse für 1.5.11 und 1.5.12 erfüllen einen Teil dieser Anforderungen. Der unerwünschte Unterprozessstart bleibt reproduzierbar. #8143 bleibt als nicht geplant geschlossen. Die Nachprüfung öffnet das Issue nicht erneut und gibt keine Laufzeitarbeit frei. Ein Laufzeitanbieter darf erst nach einer Entscheidung der Maintainer und abgeschlossener Prüfung hinzugefügt werden.
