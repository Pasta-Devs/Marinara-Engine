# Charakterkarten importieren und exportieren

Eine Charakterkarte ist eine Datei mit genau einem Charakter darin: Name, Beschreibung, Persönlichkeit, Begrüßungen und oft ein Avatar-Bild. Importiere Karten, um Charaktere aus anderen Apps und von anderen Seiten hinzuzufügen. Exportiere deine eigenen Charaktere, um sie zu sichern oder weiterzugeben.

## Einen Charakter importieren

Bevor du anfängst: Du brauchst eine Charakterkarten-Datei auf deinem Gerät. Willst du stattdessen online nach Karten suchen, siehe [Card Browser](bot-browser.md).

1. Klick in der oberen Navigationsleiste auf **Characters** (Charaktere). Siehst du den Eintrag nicht, öffne zuerst **More** (Mehr).
2. Klick in der Werkzeugleiste auf **Import** (Importieren) – das Symbol mit dem Download-Pfeil. Das Fenster **Import Character** (Charakter importieren) öffnet sich.
3. Stell die Importoptionen unten ein. Sie gelten für jede Datei dieses Durchgangs.
4. Leg deine Dateien auf dem Fenster ab oder tipp bzw. klick darauf, um die Dateiauswahl deines Geräts zu öffnen. Du kannst mehrere Dateien auswählen, auch gemischte Typen.
5. Warte die Ergebnisliste ab. Jede Datei zeigt einen grünen Haken oder eine rote Markierung mit einer Fehlermeldung. Der Text lautet `Imported "Name"`, `Imported "Name" with its embedded lorebook` oder `Imported "Name" without creating the embedded lorebook`.
6. Du findest den neuen Charakter unter **Characters**.

Marinara nimmt vier Dateitypen an:

| Dateityp | Was es ist |
| --- | --- |
| **.json** | Eine als Text gespeicherte Karte. Marinara-Exporte (`.marinara.json`) sind ebenfalls .json-Dateien. |
| **.png** | Ein Kartenbild, dessen Kartendaten im Bild versteckt liegen. |
| **.charx** | Ein Kartenpaket, gespeichert als ZIP-Datei. |
| **.marinara** | Eine Marinara-Exportdatei. |

Ein Marinara-Export behält die meisten Details. Die anderen Typen stammen aus SillyTavern, Chub, Risu und ähnlichen Werkzeugen.

Wenn es nicht funktioniert hat: Lies die rote Meldung neben der Datei. Die übrigen Dateien des Durchgangs werden trotzdem importiert.

<a id="import-options"></a>

### Importoptionen

| Option | Möglichkeiten |
| --- | --- |
| **Imported card tags** (Tags der importierten Karte) | **All tags** (Standard): jedes Tag behalten. |
| | **No tags**: die Tags überspringen. |
| | **Existing only**: nur Tags behalten, die es in deiner Bibliothek schon gibt. |
| **Imported regex scripts** (importierte Regex-Skripte) | **Character only** (Standard): Die Regeln laufen für diesen Charakter. |
| | **Global**: Die Regeln landen unter **Presets → Regexes** und laufen in jedem Chat. |
| **Split description into fields** (Beschreibung in Felder aufteilen) | Standardmäßig aus. Hake es an, um gekennzeichneten Text zu Persönlichkeit, Aussehen und Ähnlichem aus **Description** (Beschreibung) in eigene Felder zu verschieben. |

Regex-Skripte sind kleine Regeln, die Text ersetzen. Bleib bei **Character only**, solange du die Regeln nicht überall haben willst. Karten für Erzähler, Welten oder mehrere Charaktere bleiben beim Aufteilen unverändert.

### Karten mit eingebautem Lorebook

Ein Lorebook ist eine Sammlung von Hintergrundwissen, das die KI während eines Chats nachschlägt. Hat eine Karte ein eingebautes Lorebook, hält der Import an und zeigt **Embedded lorebook found** (eingebettetes Lorebook gefunden). Dort steht jede Datei mit der Anzahl ihrer Einträge. Wähle eine Option für den gesamten Durchgang:

- **Import Lorebook** legt zusätzlich ein eigenständiges Marinara-Lorebook an, das mit dem Charakter verknüpft ist.
- **No Import** belässt das Lorebook nur innerhalb der Karte.

### Einen kompletten SillyTavern-Ordner importieren

Um eine komplette SillyTavern-Installation zu übernehmen, nimm den Massenimport unter **Settings** (Einstellungen) im Tab **Imports**. Er bringt Charaktere, Chats, Presets und Lorebooks gemeinsam mit. Siehe [Aus SillyTavern importieren](../data/importing-from-sillytavern.md).

## Einen Charakter exportieren

1. Öffne den Charakter im Editor.
2. Klick in der Kopfzeile auf **Export character** (Charakter exportieren). Das Fenster **Export Character** öffnet sich.
3. Wähl ein Format. Marinara lädt die Datei herunter.

| Format | Was du bekommst | Am besten für |
| --- | --- | --- |
| **Marinara Native** | Eine `.marinara.json`-Datei mit Marinara-Metadaten, Sprites, Galeriebildern und angehängten Lorebooks. | Einen Charakter mit allen Details zwischen Marinara-Installationen umziehen. |
| **Compatible JSON** | Eine einfache Kartendatei, die andere Apps lesen können. Marinara-eigene Extras wie Sprites und Galeriebilder fehlen darin. | Andere Apps, die JSON-Karten lesen. |
| **Compatible PNG Card** | Ein Kartenbild mit den Daten im Bild. Es enthält deine Sprites, aber keine Galeriebilder. | Apps und Seiten, die eine PNG-Karte erwarten, etwa SillyTavern, Chub und Risu. |

Beide **Compatible**-Formate hängen nicht leere Felder **Backstory** (Vorgeschichte) und **Appearance** (Aussehen) an die normale **Description** an, damit andere Apps diese Angaben behalten. Deine gespeicherte Karte ändert sich nicht.

Das [interaktive Onboarding](interactive-onboarding.md) einer Karte bleibt bei **Marinara Native** und **Compatible PNG Card** erhalten. So stellt die Karte ihre Fragen weiterhin, wenn jemand sie in Marinara importiert. **Compatible JSON** lässt es weg.

## Viele Charaktere auf einmal exportieren

1. Klick in der oberen Navigationsleiste auf **Characters** (oder zuerst auf **More**, falls der Eintrag nicht angezeigt wird).
2. Klick in der Werkzeugleiste auf **Select** (Auswählen) – das Häkchen-Symbol – und hake die gewünschten Charaktere an.
3. Klick in der Leiste unten auf **Export** (Exportieren). Marinara lädt `marinara-characters.zip` herunter.

Das ZIP enthält pro Charakter eine **Marinara Native**-Datei. Der Massenexport bietet weder PNG noch JSON an. Dafür exportierst du die Charaktere einzeln. Weitere Wege, Charaktere auszuwählen, stehen unter [Die Charakter-Bibliothek organisieren](library-organization.md#export-or-delete-many-characters).

## Verwandte Anleitungen

- [Charaktere anlegen und bearbeiten](creating-and-editing-characters.md)
- [Card Browser: Charaktere finden und importieren](bot-browser.md)
- [Aus SillyTavern importieren](../data/importing-from-sillytavern.md)
