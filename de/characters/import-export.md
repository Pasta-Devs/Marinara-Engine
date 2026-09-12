# Charakterkarten importieren und exportieren

In dieser Anleitung erfährst du, wie Charakterkarten in Marinara Engine hineinkommen und wie du eigene Charaktere wieder herausbekommst. Es geht um die Dateitypen, die Marinara annimmt, um die Optionen im Import-Fenster und um die drei Export-Formate.

Eine Charakterkarte ist eine einzelne Datei mit genau einem Charakter darin: Name, Beschreibung, Persönlichkeit, Begrüßungen und meist auch ein Avatar-Bild. Über Karten wandert ein Charakter zwischen Marinara und anderen Roleplay-Apps.

## Import-Formate

Das Fenster **Import Character** (Charakter importieren) nimmt vier Dateitypen an. Du kannst mehrere Dateien auf einmal ablegen, auch gemischte Typen.

| Dateityp | Was es ist |
| --- | --- |
| **.json** | Eine reine Charakterkarte in Textform (Chara Card V2). |
| **.png** | Ein Charakterkarten-Bild, dessen Kartendaten im Bild versteckt liegen. |
| **.charx** | Ein Character-Card-V3-Paket (CharX), das ZIP-basierte Format von RisuAI. |
| **.marinara** | Ein natives Marinara-Export (auch als `.marinara.json` zu sehen). |

Am meisten Details behält eine **.marinara**-Datei, denn das ist Marinaras eigenes Format. Die anderen drei stammen aus SillyTavern, Chub, Risu und ähnlichen Werkzeugen.

## Einen Charakter importieren

So holst du eine oder mehrere Karten in die Bibliothek:

1. Öffne das Panel **Characters** (Charaktere).
2. Klick auf die Schaltfläche **Import** (Importieren) in der Werkzeugleiste – ein Symbol mit Download-Pfeil. Das Fenster **Import Character** öffnet sich.
3. Zieh die Dateien auf das Fenster oder klick hinein, um sie zu suchen. Zu sehen sein sollte „Drop one or more files here or click to browse“ (eine oder mehrere Dateien hier ablegen oder klicken zum Durchsuchen).
4. Stell die beiden Import-Optionen ein (siehe unten). Sie gelten für jede Datei dieses Durchgangs.
5. Warte die Ergebnisliste ab. Jede Datei zeigt entweder einen grünen Haken mit „Imported“ und dem Namen oder eine rote Markierung mit einer Fehlermeldung.

### Auswählen, welche Tags erhalten bleiben

Die Option **Imported card tags** (Tags der importierten Karte) bestimmt, was mit den Tags – also den Schlagwörtern – der eingehenden Karte passiert. Man nennt das den Tag-Import-Modus. Drei Möglichkeiten stehen zur Wahl:

- **All tags**: jedes Tag der Quellkarte behalten. Das ist der Standard.
- **No tags**: die Tags der Quelle überspringen.
- **Existing only**: nur Tags behalten, die es in der Bibliothek schon gibt.

### Auswählen, wohin Regex-Skripte gehen

Manche Karten bringen Regex-Skripte mit, also kleine Textersetzungs-Regeln. Die Option **Imported regex scripts** (importierte Regex-Skripte) legt deren Reichweite fest:

- **Character only**: Die Skripte laufen nur für diesen Charakter. Das ist der Standard.
- **Global**: Die Skripte landen unter **Presets** im Abschnitt **Regexes** und laufen in jedem Chat.

Nimm **Character only**, solange du die Regeln nicht bewusst überall haben willst.

### Karten mit eingebautem Lorebook

Ein Lorebook ist eine Sammlung von Hintergrundwissen, das die KI während eines Chats nachschlagen kann. Steckt in einer Karte bereits ein Lorebook, hält der Import an und zeigt das Panel **Embedded lorebook found** (eingebettetes Lorebook gefunden). Dort steht jede Datei mit der Anzahl ihrer Einträge. Wähle eine Option für den gesamten Durchgang:

- **Import Lorebook**: zusätzlich ein eigenständiges Marinara-Lorebook anlegen, das mit dem Charakter verknüpft ist.
- **No Import**: das Lorebook nur innerhalb der Karte belassen.

### Viele Karten auf einmal importieren

Dasselbe Fenster **Import Character** übernimmt auch Stapel-Importe. Wähle mehrere Dateien aus, und Marinara importiert sie nacheinander. Die Ergebnisliste hat pro Datei eine Zeile – so siehst du sofort, welche Karten geklappt haben und welche nicht.

## Einen Charakter exportieren

Öffne einen Charakter im Editor und klick dann oben in der Werkzeugleiste auf **Export character** (Charakter exportieren). Das Fenster **Export Character** bietet drei Formate an.

| Format | Was du bekommst | Am besten für |
| --- | --- | --- |
| **Marinara Native** | Eine `.marinara.json`-Datei mit allen Marinara-Metadaten, Sprites, Galerie-Bildern und angehängten Lorebooks. | Einen Charakter mit allen Details zwischen Marinara-Installationen umziehen. |
| **Compatible JSON** | Reines Chara-Card-V2-JSON ohne Marinara-Hülle. | Weitergabe an andere Apps, die JSON-Karten lesen. |
| **Compatible PNG Card** | Ein Chara-Card-V2-Bild mit den Kartendaten fest im Bild. | Apps und Seiten, die eine PNG-Karte erwarten, etwa SillyTavern, Chub und Risu. |

Nimm **Marinara Native**, wenn wirklich alles erhalten bleiben soll. Nimm eines der **Compatible**-Formate, wenn die Datei zu einem anderen Werkzeug wandert. Die beiden kompatiblen Formate lassen Marinara-eigene Extras wie Sprites und Galerie-Bilder weg. Nicht leere Felder **Backstory** (Hintergrundgeschichte) und **Appearance** (Aussehen) werden an die standardmäßige Description angehängt, damit andere V2-Programme diese Charakterinformationen behalten. Aus den exportierten Erweiterungen werden diese Felder entfernt, damit sie beim erneuten Import nicht doppelt vorkommen. Deine gespeicherte Karte bleibt unverändert; **Marinara Native** behält die getrennten Felder.

## Viele Charaktere auf einmal exportieren

Mehrere Charaktere lassen sich zusammen als eine einzige ZIP-Datei exportieren.

1. Öffne das Panel **Characters**.
2. Klick auf die Schaltfläche **Select** (Auswählen) in der Werkzeugleiste, um in den Auswahlmodus zu wechseln – ein Symbol mit Häkchen.
3. Hake die gewünschten Charaktere an.
4. Klick unten in der Aktionsleiste auf **Export**. Marinara lädt eine ZIP-Datei namens `marinara-characters.zip` herunter.

Das ZIP enthält pro Charakter eine **Marinara Native**-Datei. Für den Massen-Export gibt es weder PNG noch kompatibles JSON – brauchst du diese Formate, exportiere die Charaktere einzeln.

## Einen kompletten SillyTavern-Ordner importieren

Die Schritte oben gelten für Karten, die du selbst aussuchst. Um eine komplette SillyTavern-Installation auf einmal zu übernehmen, nimm stattdessen den Ordner-Massenimport. Er bringt Charaktere, Chats, Presets und Lorebooks gemeinsam mit. Zu finden ist er unter **Settings** (Einstellungen) im Tab **Imports**. Die vollständige Anleitung steht in [Aus SillyTavern importieren](../data/importing-from-sillytavern.md).

## Verwandte Anleitungen

- [Charaktere erstellen und bearbeiten](creating-and-editing-characters.md)
- [Card Browser: Charaktere finden und importieren](bot-browser.md)
- [Aus SillyTavern importieren](../data/importing-from-sillytavern.md)
