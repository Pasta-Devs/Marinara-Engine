# Funktionsschalter

Manche Serververhaltensweisen sind optional. Du aktivierst sie unter **Settings > Advanced > Features** (Einstellungen > Erweitert > Funktionen). Jeder Schalter ist anfangs aus. Wird dieser Bereich nie geöffnet, verhält sich der Server wie zuvor.

Änderungen gelten sofort. Weder Serverneustart noch Neuladen der Seite ist nötig.

<a id="overview"></a>

## Überblick

| Schalter | Einstellungsschlüssel | Standard | Umgebungsvariable |
| --- | --- | --- | --- |
| **Stable lorebook picks** (stabile Lorebook-Auswahl) | `stableLorebookGroupPicks` | Aus | `LOREBOOK_STABLE_GROUP_WINNERS` |
| **Retry failed provider calls** (fehlgeschlagene Anbieteraufrufe wiederholen) | `providerRetry` | Aus | `PROVIDER_RETRY_TRANSIENT_ERRORS` |
| **Lorebook activation stats** (Lorebook-Aktivierungsstatistik) | `usageAndActivationStats` | Aus | keine |
| **Recover deleted chat messages** (gelöschte Chat-Nachrichten wiederherstellen) | `messageTrash` | Aus | keine |

Die Einstellungssuche nach `features` führt zu diesem Bereich.

<a id="where-the-settings-are-stored"></a>

## Speicherort der Einstellungen

Alle Schalter werden gemeinsam als JSON-Objekt mit booleschen Werten in der App-Einstellung `features` gespeichert. Nur Abweichungen vom Standard werden gespeichert. Ein fehlender Schlüssel, ein leeres Objekt oder ein unlesbarer Wert bedeutet den Standard: alle Schalter aus.

Der Server hält eine Kopie im Arbeitsspeicher, damit häufige Prüfungen bei Anbieteraufrufen und Lorebook-Scans nichts zusätzlich laden müssen. Speichern in Settings oder jede andere Änderung der `features`-Zeile aktualisiert diese Kopie sofort.

Die API ist `GET` und `PUT /api/app-settings/features`. `PUT` ersetzt das gesamte Objekt und lehnt unbekannte Schlüssel und nicht-boolesche Werte ab.

<a id="switches"></a>

## Schalter

<a id="stable-lorebook-picks"></a>

### Stabile Lorebook-Auswahl

Einstellungsschlüssel: `stableLorebookGroupPicks`. Umgebungsvariable: `LOREBOOK_STABLE_GROUP_WINNERS`.

An: Eine Lorebook-Einschlussgruppe behält im Chat denselben Gewinner, solange die passenden Kandidaten gleich bleiben. Andere Chats und Kandidatenmengen können anders auswählen.

Aus: Der Gewinner wird bei jeder Generierung neu ausgelost.

<a id="retry-failed-provider-calls"></a>

### Fehlgeschlagene Anbieteraufrufe wiederholen

Einstellungsschlüssel: `providerRetry`. Umgebungsvariable: `PROVIDER_RETRY_TRANSIENT_ERRORS`.

An: Abgelehnte oder nicht erreichbare Verbindungen sowie Gateway-Fehler 502/503 werden höchstens zweimal nach einer kurzen zufällig variierten Wartezeit wiederholt, und nur bevor Text bei dir angekommen ist. 504 und abgebrochene Verbindungen werden nie wiederholt. Hat die Verbindung einen Fallback, wird stattdessen sofort dieser versucht.

Aus: Wie bisher werden nur Anfragen mit Ratenbegrenzung wiederholt.

<a id="lorebook-activation-stats"></a>

### Lorebook-Aktivierungsstatistik

Einstellungsschlüssel: `usageAndActivationStats`. Keine Umgebungsvariable.

An: Sobald eine Antwort erfolgreich gespeichert ist, hält Marinara fest, welche Lorebook-Einträge aktiviert wurden, sodass du Einträge im Lorebook-Editor nach ihrer Nutzung sortieren und filtern kannst. Textstücke, die über Continue angehängt werden, legen keine Aktivierungseinträge an.

Aus: Es wird nichts festgehalten, und der Lorebook-Editor blendet seine Aktivierungsstatistik aus.

<a id="recover-deleted-chat-messages"></a>

### Gelöschte Chat-Nachrichten wiederherstellen

Einstellungsschlüssel: `messageTrash`. Keine Umgebungsvariable.

An: Gelöschte Chat-Nachrichten landen im Tab **Trash** (Papierkorb) der Chat-Suche. Dort holst du sie innerhalb von 30 Tagen mit **Restore** (Wiederherstellen) zurück; danach werden sie endgültig entfernt. Game-Nachrichten und Löschungen durch ein Zurücksetzen bleiben weiterhin endgültig.

Aus: Gelöschte Nachrichten werden sofort entfernt.

<a id="precedence"></a>

## Vorrang

1. **Umgebungsvariable.** Ist sie gesetzt, überschreibt sie den gespeicherten Schalter sowohl beim Ein- als auch beim Ausschalten. Settings zeigt den Schalter mit dem Variablennamen gesperrt. Ein leerer Wert gilt als nicht gesetzt.
2. **Gespeicherter Schalter.** Der Wert unter Settings > Advanced > Features.
3. **Standard.** Aus.

| Variable | Steuert | Werte |
| --- | --- | --- |
| `LOREBOOK_STABLE_GROUP_WINNERS` | Stabile Lorebook-Auswahl | `true`, `1`, `yes` oder `on` schalten ein. Jeder andere Wert schaltet aus. |
| `PROVIDER_RETRY_TRANSIENT_ERRORS` | Wiederholung fehlgeschlagener Anbieteraufrufe | `true`, `1`, `yes` oder `on` schalten ein. Jeder andere Wert schaltet aus. |

Umgebungsvariablen werden bei jeder Prüfung gelesen. Änderungen an `.env` gelten daher ohne Neustart.

<a id="for-developers"></a>

## Für Entwickler

Die Registry ist `packages/shared/src/schemas/feature-settings.schema.ts`: Namen und Standardwerte der Schalter. Ergänze einen Schalter dort in `FEATURE_SWITCH_NAMES`, `FEATURE_SWITCH_DEFAULTS` und `featureSettingsSchema`, füge Beschriftung und Hilfetext unter `settings.features.<key>` im englischen Sprachkatalog hinzu und trage ihn in `SERVER_SWITCHES` in `packages/client/src/components/panels/settings/FeatureSwitchesSettings.tsx` ein, damit er in Settings erscheint. Serverseitig prüfst du ihn mit `isFeatureEnabled("<key>")` aus `packages/server/src/services/features/feature-settings.ts`. Im Client nutzt du `useFeatureEnabled("<key>")` aus `packages/client/src/hooks/use-feature-settings.ts`.
