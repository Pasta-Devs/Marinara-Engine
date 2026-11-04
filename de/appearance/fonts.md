# Eigene Schriftarten und Google Fonts

Wechsle die Schriftart, die Marinara überall in der App verwendet. Wähle die mitgelieferte Schriftart, füge eigene Schriftdateien hinzu oder lade eine Schriftart über ihren Namen von Google Fonts herunter.

## Schriftart für die App wählen

1. Öffne **Settings** (Einstellungen) und klick auf den Tab **Appearance** (Darstellung), dann auf die Schaltfläche **App**.
2. Suche den Abschnitt **Text & Scale** (Text und Skalierung).
3. Öffne das Dropdown-Menü **Font** (Schriftart) und wähle eine Schriftart.

Am einfachsten kommst du über [Google Fonts](#downloading-from-google-fonts) an eine neue Schriftart. Standard ist **Default (Inter)**, eine klare Schriftart, ausgelegt aufs Lesen am Bildschirm. Schriftarten, die du hinzufügst, erscheinen im selben Dropdown-Menü darunter.

Deine Schriftwahl wird zwischen Geräten synchronisiert. Jeder Browser, der mit demselben Marinara-Server verbunden ist, stellt auf sie um. Siehe [Überblick über die Einstellungen](../settings/settings-overview.md).

Chat-Widgets haben unter **Chat widget style** (Chat-Widget-Stil) eine eigene Auswahl **Font**. Schaltest du dort **Apply preset font** (Preset-Schrift anwenden) ein, gilt sie auch für Nachrichten, Eingabefelder und Chat-Bedienelemente. Siehe [Fertige Stile für Chat-Fenster](custom-css-themes.md#ready-made-chat-window-styles).

## Eigene Schriftarten hinzufügen

Bevor du anfängst: Schriftarten kommen in einen Ordner auf dem Server. Der Server ist der Rechner, auf dem Marinara läuft. Läuft Marinara auf deinem eigenen Rechner, ist das der Server, und der Datenordner ist der Ort, an dem Marinara deine Daten ablegt.

1. Klick neben dem Dropdown-Menü **Font** auf **Open Fonts Folder** (Schriftarten-Ordner öffnen), um `data/fonts/` auf dem Server zu öffnen. Oder such den Ordner `data/fonts/` selbst im Datenordner von Marinara.
2. Kopiere deine Schriftdatei hinein.
3. Geh zu **Settings → Appearance → App → Text & Scale**.
4. Öffne das Dropdown-Menü **Font**. Deine Schriftart steht in der Liste.
5. Wähle sie aus. Der Text der App ändert sich sofort.

Marinara liest Dateien vom Typ `.ttf`, `.otf`, `.woff` und `.woff2` und ignoriert andere Typen. Den Anzeigenamen leitet Marinara aus dem Dateinamen ab, aus `OpenSans-Bold.ttf` wird also „Open Sans“. Benenne deine Dateien eindeutig, damit die Liste aufgeräumt bleibt.

Jedes Gerät, das sich mit demselben Server verbindet, kann die Schriftarten in `data/fonts/` nutzen.

Wenn es nicht funktioniert hat: Prüf den Dateityp und ob die Datei in `data/fonts/` auf dem Server liegt, nicht auf dem Gerät, von dem aus du Marinara ansiehst.

<a id="downloading-from-google-fonts"></a>

## Von Google Fonts herunterladen

Dafür braucht der Server Internetzugang.

1. Geh zu **Settings → Appearance → App → Text & Scale**.
2. Tipp im Feld **Google Fonts** den exakten Namen der Schriftart ein, etwa `Fira Code` oder `Lora`.
3. Klick auf **Add** (Hinzufügen).
4. Warte, bis der Download fertig ist. Danach erscheint die Schriftart im Dropdown-Menü **Font**.

Der Link **Browse fonts at fonts.google.com →** (Schriftarten auf fonts.google.com durchsuchen) neben dem Feld öffnet die Google-Fonts-Website, damit du Namen nachschlagen kannst. Der Name darf nur Buchstaben, Ziffern und Leerzeichen enthalten. Lädst du dieselbe Schriftart erneut herunter, ersetzt der neue Download die alte Kopie.

Wenn es nicht funktioniert hat, lies die Fehlermeldung.

- Erreicht Marinara Google Fonts nicht, prüf deine Internetverbindung.
- Heißt es, die Schriftart sei nicht gefunden worden, prüf die Schreibweise und schau auf der Google-Fonts-Website nach, ob die Schriftart einen Regular-Schnitt (400) hat. Marinara lädt nur diesen Schnitt herunter.

## Open Fonts Folder

Die Schaltfläche **Open Fonts Folder** neben dem Dropdown-Menü **Font** öffnet `data/fonts/` im Dateimanager des Server-Rechners, nicht auf dem Gerät, das du gerade benutzt. Läuft Marinara auf deinem eigenen Rechner, öffnet sich der Ordner direkt bei dir. Vom Handy oder von einem zweiten Rechner aus kopierst du deine Schriftdateien selbst in den Ordner `data/fonts/` des Servers.

Solange die Standardschriftart eingestellt ist, verwenden die Prompt-Felder im Preset-Editor und das Feld Example Dialogue eines Charakters eine Monospace-Schriftart. Jede andere Schriftart gilt auch für sie. Andere Prompt-Felder, etwa die Prompt-Vorlage eines Agenten, bleiben bei Monospace.

## Verwandte Anleitungen

- [Darstellungseinstellungen](appearance-settings.md)
