# Aus SillyTavern importieren

Hol deine SillyTavern-Daten in Marinara Engine. Importiere jeweils eine Datei oder lass einen ganzen SillyTavern-Ordner durchsuchen und importiere alles auf einmal.

## Was du übernehmen kannst

| SillyTavern-Daten | In Marinara |
| --- | --- |
| Charaktere | Charaktere |
| Chats und Gruppenchats | Chats |
| Presets | Presets (die Abschnitte des Prompts und die Sampler-Einstellungen des Presets) |
| World Info | Lorebooks (Notizen, die die KI liest, wenn bestimmte Wörter vorkommen) |
| Hintergründe | Chat-Hintergründe |
| Personas | Personas (das Profil, das dich vertritt) |
| Regex-Skripte | Regex-Skripte: die eigenen jeder Karte und die globalen aus `settings.json` (Ordnerimport) |

## Schneller Import einzelner Dateien

1. Öffne **Settings → Imports**.
2. Klicke unter **SillyTavern Import** auf die Schaltfläche für deinen Dateityp.
3. Wähle die Datei. **Charakter importieren**, **Preset importieren** und **Lorebook importieren** öffnen dasselbe Fenster wie die Schaltfläche **Importieren** im jeweiligen Panel, mit denselben Auswahlmöglichkeiten und demselben Bericht darüber, was übernommen wurde und was nicht.

| Schaltfläche | Datei |
| --- | --- |
| **Import Character (JSON/PNG)** | Eine `.json`- oder `.png`-Charakterkarte. |
| **Import Chat (JSONL)** | Ein `.jsonl`-Chatprotokoll (ein JSON-Eintrag pro Zeile, das Format, in dem SillyTavern Chats speichert). |
| **Import Preset (JSON)** | Ein `.json`-Preset. |
| **Import Lorebook (JSON)** | Eine `.json`-World-Info-Datei. |

Ein Regex-Skript ist eine Suchen-und-Ersetzen-Regel für Text. Siehe [Charakterkarten importieren und exportieren](../characters/import-export.md).

Enthält eine Charakterkarte ein Lorebook, fragt das Fenster „Charakter importieren“, was damit geschehen soll: **Lorebook importieren** behält es als wiederverwendbares Lorebook, **Skip lorebook** importiert nur den Charakter.

**Chat importieren (JSONL)** erstellt einen Roleplay-Chat, sofern die Datei keinen anderen Modus festhält, und öffnet ihn. Eine kurze Meldung nennt, was übernommen wurde: die Autorennotiz, die Persona und Nachrichten, die vor der KI verborgen bleiben.

### Einen Chat aus der Chatliste importieren

Du kannst auch die Import-Schaltfläche oben in der Chatliste nutzen. Ihr Tooltip lautet **Import SillyTavern or Marinara chat JSONL**. Sie funktioniert genauso: Der Chat öffnet sich in dem Modus, den die Datei festhält, oder als Roleplay-Chat, wenn sie keinen angibt. Siehe [Chats exportieren und importieren](../chats/export-import.md).

## Einen SillyTavern-Ordner importieren

Bevor du anfängst: Der Assistent liest Dateien auf dem Server-Rechner. Liegt SillyTavern auf einem anderen Rechner, kopiere zuerst seinen Ordner (den, in dem du SillyTavern installiert hast) auf den Marinara-Rechner. Auf dem Rechner mit Marinara funktioniert der Assistent sofort. Von einem anderen Gerät aus musst du das Admin-Secret auf dem Server festlegen und unter **Settings → Advanced → Admin Access** eingeben. Siehe [Marinara sichern und wiederherstellen](backup-and-restore.md) und den Abschnitt „Privileged APIs (ADMIN_SECRET)“ der [Referenz zur Server-Konfiguration](../CONFIGURATION.md).

1. Öffne **Settings → Imports → SillyTavern Import**.
2. Klicke auf **Import from SillyTavern Folder**.
3. Wähle deinen SillyTavern-Ordner. Nimm den Hauptordner, meist den, der `data/` oder `public/` enthält. Nutze einen dieser Wege:
   - Klicke auf **Browse** und wähle den Ordner.
   - Gibt es keine Ordnerauswahl (ein entfernter Server), öffnet sich ein Ordner-Browser in der App. Er listet nur Ordner im Home-Ordner des Benutzers, der den Server betreibt. Klicke auf **Select This Folder**.
   - Gib den Pfad in **Pfad zum SillyTavern-Ordner** ein, zum Beispiel `/home/you/SillyTavern`. Ein eingegebener Pfad funktioniert, wenn er innerhalb des Home-Ordners des Benutzers liegt, der den Server ausführt. Ist die Server-Einstellung `IMPORT_ALLOWED_ROOTS` gesetzt, muss er stattdessen in einem der dort angegebenen Ordner liegen.
4. Klicke auf **Scan Folder**. Marinara zeigt, wie viele Elemente es in jeder Kategorie gefunden hat.
5. Wähle unter **Choose exactly what to import** die gewünschten Elemente aus. Jede Kategorie hat die Schaltflächen **All** und **None** sowie einen Schalter **Show** oder **Hide** für die einzelnen Elemente.
6. Klicke auf **Import Selected**. Ein Fortschrittsbalken zeigt das aktuelle Element und eine Zahl pro Kategorie.
7. Wenn du **Import abgeschlossen!** siehst, lies die Zahl für jede Kategorie und klick auf **Fertig**. Unter den Zahlen steht eine kurze Liste: wie viele Chats ihre Autorennotiz und Persona behalten haben, zu welchen SillyTavern-Benutzernamen es hier keine Persona gab, wo Presets World Info platzieren und welche Preset-Einstellungen ausgelassen wurden.

**Bereits Vorhandenes überspringen** (standardmäßig an) lässt Charaktere, Chats und Personas aus, die du schon hast – ob aus einem früheren Ordnerimport oder aus einzeln importierten Dateien. Eine SillyTavern-Persona mit demselben Namen wie eine deiner Personas wird nicht kopiert: Ihre Chats werden mit deiner verknüpft. Vor dieser Änderung einzeln importierte Chats werden nicht erkannt und noch einmal importiert.

Die meisten Elemente sind vorausgewählt. Die Standard-Presets von SillyTavern, etwa `deterministic`, `neutral` und die `universal-*`-Presets, lässt Marinara unmarkiert, und ein Banner weist darauf hin. Lass sie unmarkiert, solange du keine Kopien willst.

Findet die Suche Charaktere, erscheinen zwei weitere Optionen:

**Importierte Charakter-Tags** (Standard **Alle Tags**):

- **Alle Tags** behält die Tags der Quelle.
- **Keine Tags** überspringt sie.
- **Nur vorhandene** behält nur Tags, die du schon hast.

**Importierte Regex-Skripte** (Standard **Nur Charakter**):

- **Nur Charakter** wendet die Skripte auf den jeweiligen Charakter an.
- **Global** fügt sie unter **Voreinstellungen → Regex-Skripte** hinzu, wo du Skripte verwaltest, die chatübergreifend laufen. Siehe [Regex-Skripte](../extending/regex-scripts.md#manage-your-scripts).

Wenn es nicht funktioniert hat:

- „Could not find SillyTavern data directory.“ heißt, dass Marinara diesen Ordner nicht lesen kann. Wähle den SillyTavern-Hauptordner.
- „Marinara can only read folders inside your home folder“ bedeutet, dass der Ordner außerhalb des Home-Ordners des Benutzers liegt, der den Server ausführt. Verschiebe den SillyTavern-Ordner dorthin oder bitte den Serverbetreiber, seinen Speicherort mit `IMPORT_ALLOWED_ROOTS` zu erlauben. Ist diese Einstellung gesetzt, muss auch ein ausgewählter Ordner innerhalb eines ihrer Ordner liegen. Siehe die [Server-Konfiguration – Referenz](../CONFIGURATION.md).
- Erhält **Durchsuchen** einen eingegebenen Pfad außerhalb des Home-Ordners, öffnet sich der Ordnerbrowser stattdessen im Home-Ordner.
- Schlägt ein Element fehl, überspringt Marinara es, macht weiter und listet es im letzten Schritt unter den Warnungen auf, zum Beispiel `Character "Foo": error message`.

## Was mit deinen Daten passiert

- Chatdateien, die zu einem Charakter gehören, werden als Verzweigungen eines Chats importiert. Eine Verzweigung ist eine Kopie eines Chats, die du getrennt fortsetzt. Jeder Chat erhält den Namen seiner SillyTavern-Datei, genau wie beim Einzelimport. Heißt eine Datei noch „New Chat“, bekommt sie den Namen des Charakters.
- Gruppenchats werden als Roleplay-Chats im Modus **Einzeln** importiert. So antwortet jeder Charakter der Reihe nach, in der Sprechreihenfolge aus SillyTavern.
- Nachrichten, die in SillyTavern vor der KI verborgen sind, bleiben verborgen.
- Importierte Einträge behalten das Datum der letzten Änderung der Quelldatei, nicht das Importdatum. Jede Chat-Nachricht behält das Datum, mit dem SillyTavern sie gespeichert hat.
- Die **Autorennotiz** eines Chats wird samt ihrer Tiefe übernommen. Hatte SillyTavern dafür eine andere Häufigkeit, Position oder Rolle, fügt Marinara sie trotzdem bei jeder Antwort in dieser Tiefe ein und weist beim Import darauf hin. Eine in SillyTavern ausgeschaltete Notiz bleibt aus.
- Ein Chat wird mit der Persona verknüpft, die SillyTavern verwendet hat: mit der fest zugewiesenen Persona, sonst mit der Persona, die genauso heißt wie der Benutzer des Chats. Importiere Personas im selben Durchlauf oder lege vorher eine mit diesem Namen an. Gibt es keine passende, bleibt der Chat ohne Persona, und der Import nennt die fehlende Persona.
- Ein Preset behält die beiden World-Info-Positionen aus SillyTavern. **World Info (before)** und **World Info (after)** werden zu eigenen Abschnitten, damit Einträge, die nach dem Charakter stehen sollen, weiterhin danach stehen. Schaltet ein Preset eine dieser Positionen aus, lässt es die zugehörigen Einträge weg, genau wie SillyTavern. Ein Preset mit nur einer World-Info-Position erhält einen Abschnitt **World Info**, der beide sendet. Ein vor dieser Änderung importiertes Preset hat einen Abschnitt **World Info**. Um das zu korrigieren, importiere es erneut oder füge in seinen Abschnitten **Lorebook Marker (Before)** und **Lorebook Marker (After)** an den gewünschten Stellen ein und entferne den alten Abschnitt **World Info**.
- World-Info-Einträge, die um SillyTaverns Autorennotiz herum stehen, werden in Tiefe 4 als System eingefügt, wo die Autorennotiz steht (Einträge nach der Notiz kommen direkt hinter die Einträge davor). Einträge um die Beispielnachrichten werden nach den Charakterdefinitionen eingefügt. Der Import nennt die Anzahl der verschobenen Einträge.
- Ein Preset bringt seine Sampler-Einstellungen mit: Temperatur, Top P, Top K, Min P, Frequency und Presence Penalty sowie Reasoning Effort. Sie sind die Anfangswerte für Chats, die dieses Preset verwenden; eigene Werte der Verbindung oder des Chats haben weiterhin Vorrang. Maximale Antwortlänge und Kontextgröße bleiben bei deiner Verbindung. Für Top A und Repetition Penalty gibt es hier keine Einstellung; sie werden ausgelassen.

## Was sich nicht übernehmen lässt

Der Assistent liest nur die Kategorien aus der ersten Tabelle. Andere SillyTavern-Daten, etwa globale App-Einstellungen und Verbindungsprofile, werden nicht importiert. Die Liste **Nicht übernommen** im Ergebnis des Ordnerimports zählt, was gefunden wurde, hier aber keine entsprechende Funktion hat: Quick-Reply-Sets, Instruct-Vorlagen, Kontextvorlagen und System-Prompts. Chats, die vor dieser Korrektur importiert wurden, haben den Importzeitpunkt als Nachrichtendatum erhalten. Um einen zu korrigieren, lösche ihn und importiere seine Datei erneut (bei einem Ordnerimport nimm den Haken bei **Bereits Vorhandenes überspringen** heraus).

## Verwandte Anleitungen

- [Charakterkarten importieren und exportieren](../characters/import-export.md)
- [Lorebooks importieren und exportieren](../lorebooks/import-export.md)
- [Chats exportieren und importieren](../chats/export-import.md)
- [Regex-Skripte](../extending/regex-scripts.md)
