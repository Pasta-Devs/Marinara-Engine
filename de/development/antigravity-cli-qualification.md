# Voraussetzungen für eine Antigravity-CLI-Abonnementintegration

Dies ist eine Recherche für Entwickler zu [#8143](https://github.com/Pasta-Devs/Marinara-Engine/issues/8143), geprüft am 2026-10-23. Marinara Engine implementiert **keine** Antigravity-Abonnementverbindung. Es fehlt weiterhin ein unterstützter, überprüfbarer Weg, der verhindert, dass CLI-Tools und globale Anpassungen einschließlich Lebenszyklus-Hooks während einer Textgenerierungsanfrage der Engine ausgeführt werden.

## Belegte offizielle Schnittstellen

Die offizielle CLI `agy` unterstützt die Kontoanmeldung mit gespeicherten Anmeldedaten und die Textgenerierung ohne interaktive Oberfläche. Ihr dokumentiertes Protokoll umfasst die Ereignisse `init`, `step_update` und `result`; für die Streaming-Eingabe werden JSON-Benutzernachrichten über stdin übergeben. `agy models` listet verfügbare Modelle auf, darunter die dokumentierten Beispiele `gemini-4-argon-high` und `gemini-4-argon-medium`. Welche Modelle das Konto nutzen kann, muss die installierte CLI liefern; das darf nicht aus diesen Beispielen abgeleitet werden. `--print-timeout 0` wartet bis zum Abschluss, und `--disable-slash-commands` deaktiviert die Befehlsexpansion im Print-Modus. Siehe [Betrieb ohne interaktive Oberfläche](https://www.antigravity.google/docs/cli/headless/) und die [Referenz der CLI-Optionen](https://www.antigravity.google/docs/cli/reference/).

Die Kontoanmeldung der CLI nutzt den Anmeldedatenspeicher des Betriebssystems. Ihr gesonderter Gemini-API-Schlüsselmodus erfordert `modelProvider: "gemini"` und `GEMINI_API_KEY`; ein Abonnementadapter darf diesen Abrechnungsweg nicht stillschweigend wählen. Die dokumentierten Methoden zur programmatischen Authentifizierung des Python-SDK sind Gemini-API-Schlüssel, Vertex-/Google-Cloud-Anmeldedaten und lokale Modelle. Diese Methoden belegen keine Authentifizierung über ein Endkundenabonnement für einen SDK-basierten Ersatz. Siehe [Authentifizierung](https://www.antigravity.google/docs/install/#programmatic-authentication) und die [SDK-Übersicht](https://www.antigravity.google/docs/sdk/overview/).

## Fehlende Zusicherung der Ausführungsisolation

Die offiziellen Definitionen eigener Agenten bieten Einstellungen für Tools, MCP und Anpassungen. Das Änderungsprotokoll dokumentiert außerdem `inheritCustomizations`, `inheritMcp` und `excludeDefaultComponents`. Die Ankündigung von `excludeDefaultComponents: true` behält jedoch ausdrücklich Hooks nach dem Modellaufruf bei. Diese Einstellung allein belegt deshalb nicht, dass eine Textgenerierungsanfrage sämtliche ausführbaren Hooks ausschließt. Siehe [Eigene Unteragenten](https://www.antigravity.google/docs/subagents/) und das [CLI-Änderungsprotokoll](https://www.antigravity.google/docs/changelog).

Hooks können aus einem Arbeitsbereich, der globalen Datei `~/.gemini/config/hooks.json` und installierten Plugins stammen. Sie umfassen Sitzungs-, Modellaufruf-, Tool- und Stoppereignisse. Die aktuelle Einstellungsdokumentation und das [offizielle Einstellungsschema](https://antigravity.google/schemas/v1/settings.json) besagen ausdrücklich, dass ein Eintrag `hooks` in `settings.json` nicht geladen wird. Ein leerer Eintrag dort würde die tatsächlichen Hook-Quellen nicht deaktivieren. Siehe [Hooks](https://www.antigravity.google/docs/hooks) und [CLI-Einstellungen](https://www.antigravity.google/docs/settings?tab=cli).

Die dokumentierten CLI-Optionen und Einstellungen bieten weder eine anfragebezogene Hook-Deaktivierung noch ein isoliertes Konfigurations-/Profilverzeichnis, das die Kontoauthentifizierung beibehält. Die schreibgeschützte Bestandsaufnahme mit `/hooks` liefert nützliche Hinweise; ihre Dokumentation belegt aber nicht, dass ein späterer Modellaufruf eine unveränderliche Konfiguration ohne Hooks nutzt. Ein Verzeichniswechsel, eine leere Liste `tools`, die Anweisung, keine Tools zu nutzen, oder ein Abbruch nach dem Start reichen als Nachweis der Ausführungsisolation nicht aus.

Berichte über Integrationen von Drittanbietern sind Ansatzpunkte für die Untersuchung. Ihre Aussagen über wirkungslose Tools, Protokolle zur Agentenauflösung oder die Übernahme von Anpassungen müssen mit der offiziellen Veröffentlichung reproduziert werden, bevor die Engine sich darauf stützen darf.

## Lokale Prüfung der Veröffentlichung

Das [offizielle Installationsskript](https://antigravity.google/cli/install.sh) und sein [Veröffentlichungsmanifest für Darwin ARM64](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/darwin_arm64.json) wurden geprüft, ohne das Installationsskript auszuführen. Das Manifest wählte das [versionierte `agy`-Archiv 1.4.6 für Darwin ARM64](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.6-4884751325200384/darwin-arm/cli_mac_arm64.tar.gz) mit dieser SHA-512-Prüfsumme:

```text
25af49004dd6d6013e6231278e2711b95641c8e54b661be871b3519c0a850053d4e707f46b47aa66e84ff9480041b13908194b48b1a97f84f2a22071d9c9fd3f
```

Die Archivprüfsumme stimmte überein. Die Binärdatei wurde in ein temporäres Verzeichnis dieser Aufgabe entpackt. Ausgeführt wurden nur `--version` und `--help`, in einer macOS-Sandbox, die Netzwerkzugriff, Lese- und Schreibzugriff auf das Benutzerverzeichnis sowie den Zugriff auf den Schlüsselbunddienst verweigerte. Beide Aufrufe endeten erfolgreich. Die Hilfe führte keine Option zum Deaktivieren von Hooks und kein isoliertes Profil- oder Konfigurationsverzeichnis auf.

Diese Prüfung hat die CLI **nicht** installiert oder authentifiziert, keine Anmeldedaten eingesehen, kein Modell aufgerufen, keine Modelle eines angemeldeten Kontos aufgelistet und keine Hook-Ausführung getestet. Sie bestätigt die öffentliche Optionsliste; sie beweist weder, dass Isolation unmöglich ist, noch validiert sie die Generierung über ein Abonnement.

## Erforderliche Nachweise vor der Auslieferung eines Adapters

1. Belege einen unterstützten Weg, globale und arbeitsbereichsbezogene Hooks, Plugins, Skills, Regeln, Unteragenten, MCP-Server und handlungsfähige Tools auszuschließen, bevor eine Anfrage sie ausführen kann. Die normale Kontoanmeldung bleibt in der offiziellen CLI; extrahiere oder kopiere keine Tokens.
2. Prüfe diesen Mechanismus mit der tatsächlichen offiziellen CLI gegen kontrollierte lokale Modell-Testumgebungen. Richte beobachtbare Testmarker für globale und arbeitsbereichsbezogene Hooks sowie Plugins/MCP ein, dazu Regeln und Tool-Anfragen. Prüfe sowohl den isolierten Lauf als auch Negativkontrollen, die zeigen, dass die Testmarker ohne Isolation beobachtbar sind.
3. Belege vor der Ausführung, dass der ausgewählte eigene Agent tatsächlich aufgelöst wird. Lehne nicht unterstützte Versionen, nicht aufgelöste Agentennamen, unbekannte Bestandsformate und uneindeutige Isolationsprüfungen ab; verlasse dich weder auf interne Protokollformulierungen noch auf eine scheinbar leere Tool-Liste beim Start.
4. Ergänze begrenzte Ein-/Ausgabe für Unterprozesse, private temporäre Dateien samt Bereinigung, Abbruch, die Behandlung von Fehler-Exitcodes und Ergebnisfehlern sowie Tests für aktivitätsabhängige Zeitlimits – auch für langes Nachdenken ohne sichtbaren Text. Rufe kontospezifische Modelle über den offiziellen Befehl ab und behalte das ausgewählte Modell sowie den unterstützten Denkaufwand bei.
5. Nutze die bestehenden Verbindungs-/Anbieterverträge. SDK-Optionen von Claude wie `settingSources: []` sind anbieterspezifisch; sie sind keine Optionen, die auf `agy` übertragen werden dürfen. Benenne verbleibende Prüflücken bei echter Authentifizierung, Abonnementabrechnung und physischen Plattformen ausdrücklich.

Bis diese Ausführungsgrenze belegt ist, bleibt #8143 offen und es darf kein Laufzeitanbieter hinzugefügt werden.
