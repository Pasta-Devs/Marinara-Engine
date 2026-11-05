# Game-Assets: Musik, Sound, Sprites und Hintergründe

Game-Assets sind die Mediendateien, die der Game Mode abspielt und anzeigt: Musik, Sound, Charakterbilder und Szenen-Hintergründe. Diese Anleitung zeigt, wie du das Starter-Set nutzt, eigene Dateien im **Asset Browser** hochlädst, einschränkst, welche Assets ein Spiel nutzen darf, und Soundeffekte und Musik generierst.

Der Game Mode liest die Bibliothek selbstständig aus. Musik, Umgebungsgeräusche und Hintergründe wählt er passend zur Szene, von Hand zuweisen musst du während des Spiels also nichts.

| Kategorie | Was sie ist |
| --- | --- |
| **Music** | Hintergrundmusik, die mit der Szene wechselt. |
| **Ambient** | Umgebungsgeräusche in Endlosschleife, etwa aus Natur, Stadt oder Innenräumen. |
| **Sound Effects** (SFX) | Kurze Geräusche für Menüs, Kampf und Erkundung. |
| **Sprites** | Charakter- und Objektbilder, die auf dem Bildschirm erscheinen. |
| **Backgrounds** | Szenenbilder hinter der Geschichte. |

## Das Starter-Set

Beim ersten Serverstart installiert Marinara eine kostenlose Starter-Bibliothek und frischt sie bei späteren Starts auf, wenn sich das mitgelieferte Set ändert. Sie enthält:

- Fünf **Music**-Titel für verschiedene Szenenstimmungen.
- **Ambient**-Schleifen in den Ordnern `nature`, `urban` und `interior`.
- **Sound Effects** für Menüs, Kampf und Erkundung.

Die Ordner **Backgrounds** und **Sprites** im Asset Browser sind anfangs leer. Charakter-Sprites liegen keine bei, ergänze also Bilder, die zu deinen eigenen Spielen passen. Für Hintergründe greift der Game Mode außerdem auf die Hintergrundbibliothek der App zurück. Bei einer Neuinstallation enthält sie 13 Starter-Bilder und ein schlichtes `Black.jpg`, und Spiele können sie ohne Upload nutzen. Lagen in diesem Ordner schon Bilder, wird nur `Black.jpg` wiederhergestellt. Generierte Szenenbilder und deine Uploads kommen dazu.

Alles mitgelieferte Audio steht unter CC0 (gemeinfrei, frei verwendbar). Die Credits zu jeder Datei stehen in einer Datei `CREDITS.md`, die zusammen mit den Assets auf der Festplatte liegt. In der App wird sie nicht angezeigt.

Mitgelieferte Dateien und Ordner sind geschützt. Im **Asset Browser** kannst du sie weder löschen noch verschieben, umbenennen und kopieren aber schon.

## Den Asset Browser öffnen

Der **Asset Browser** ist ein Dateimanager für Game-Assets. Öffne ihn über **Settings** (Einstellungen):

1. Öffne **Settings**.
2. Wechsle zum Tab **Imports**.
3. Such **Game Assets** und klick auf **Asset Browser**.

Oder öffne ihn aus einem Spiel:

1. Öffne einen Game-Chat.
2. Klick oder tipp auf die Schaltfläche **Game Assets** (das Ordnersymbol) nahe der oberen rechten Ecke des Chats. Am Computer oder Handy kannst du sie an eine andere Stelle ziehen.

Die Schaltfläche erscheint nur in Game-Chats. Sie öffnet **Game Assets** mit dem **Asset Browser** darin, am Computer als verschiebbares Fenster, am Handy als Panel über die ganze Breite. Hast du es mit **Put back in Chat Settings** (zurück in die Chat-Einstellungen) verschoben, öffne stattdessen den Abschnitt **Game Assets** in Chat Settings.

Die Werkzeugleiste zeigt eine Brotkrumen-Navigation, die bei **Game Assets** beginnt, einen Umschalter zwischen **Grid view** (Kachelansicht) und **List view** (Listenansicht), **Upload** (Hochladen), **New** (Neu), **Rescan** (Neu einlesen), **Open in system folder** (Im Systemordner öffnen) und ein Suchfeld **Search in folder** (Im Ordner suchen). Auf breiteren Bildschirmen springst du über einen Ordnerbaum links zwischen den Kategorien.

## Eigene Assets hochladen

Marinara prüft jeden Upload gegen die Regeln unter [Dateitypen und Größen](#file-types-and-sizes). Nimm einen der beiden Wege.

### Upload über den Asset Browser

1. Öffne den **Asset Browser**.
2. Öffne einen der fünf Kategorie-Ordner oder einen Unterordner darin.
3. Klick auf **Upload** und wähle Dateien aus, oder zieh Dateien in den Dateibereich.

Du musst dich in einem Kategorie-Ordner befinden. Legst du Dateien auf der obersten Ebene ab, bittet dich die App, zuerst einen zu öffnen.

### Upload über Settings

1. Öffne **Settings** und wechsle zum Tab **Imports**.
2. Wähle in **Game Assets** unter **Type** (Typ) eine Kategorie: **Music**, **Ambient**, **Sound Effects**, **Sprites** oder **Backgrounds**.
3. Leg unter **Folder** (Ordner) das Ziel fest, oder behalte den Standard.
4. Klick auf **Choose Files** (Dateien auswählen) und wähle deine Dateien aus.
5. Klick auf **Upload to Server** (Auf den Server hochladen).

Hat es nicht funktioniert, listet die Fehlermeldung die erlaubten Dateitypen für diese Kategorie auf. Prüf bei Musik den Ordnerpfad (siehe [Die Ordnerregel für Musik](#the-music-folder-rule)).

Standardwerte für **Folder**:

| Typ | Standardordner |
| --- | --- |
| **Music** | `exploration/fantasy/calm` |
| **Ambient** | `nature` |
| **Sound Effects** | `exploration` |
| **Sprites** | `generic-fantasy` |
| **Backgrounds** | `custom` |

<a id="file-types-and-sizes"></a>

### Dateitypen und Größen

| Kategorie | Erlaubte Dateitypen |
| --- | --- |
| Music, Ambient, Sound Effects | MP3, OGG, WAV, FLAC, M4A, AAC, WebM |
| Sprites | PNG, JPG, JPEG, GIF, WebP, AVIF, SVG |
| Backgrounds | PNG, JPG, JPEG, GIF, WebP, AVIF |

Audio- und Bilddateien dürfen jeweils bis zu 50 MB groß sein, Textdateien bis zu 10 MB.

<a id="the-music-folder-rule"></a>

### Die Ordnerregel für Musik

Jeder Musiktitel muss in einem dreistufigen Pfad `state/genre/intensity` liegen, zum Beispiel `exploration/fantasy/calm`. Passt der Pfad nicht, schlägt der Upload fehl. An diesem Aufbau erkennt der Game Mode, wann er welchen Titel abspielt.

- State: `exploration`, `dialogue`, `combat`, `travel_rest`.
- Genre: `fantasy`, `horror`, `romance`, `mystery`, `scifi`, `modern`, `slice_of_life`, `adventure`, `drama`, `custom` oder die Familie eines Settings (siehe unten), zum Beispiel `wuxia`.
- Intensity: `calm`, `tense`, `intense`.

Für Ambient-, Soundeffekt-, Sprite- und Hintergrund-Ordner gilt keine solche Regel. Ihre Unterordner darfst du frei benennen.

## Assets organisieren

Am Computer führt ein Rechtsklick auf eine Datei oder einen Ordner zu den Aktionen, alternativ das Menü „...“.

| Dateiaktion | Was sie tut |
| --- | --- |
| **Rename** (Umbenennen) | Schlägt fehl, wenn der Name in diesem Ordner schon vergeben ist. |
| **Move** (Verschieben), **Copy** (Kopieren) | Legt die Datei über eine Ordnerauswahl in einen anderen Ordner. |
| **Delete** (Löschen), **Download** (Herunterladen) | Entfernt die Datei oder speichert sie auf deinem Gerät. |

| Ordneraktion | Was sie tut |
| --- | --- |
| **Create subfolder** (Unterordner anlegen) | Legt einen neuen Ordner darin an. |
| **Open in system folder** | Zeigt ihn im Dateimanager deines Computers. |
| **Delete folder** (Ordner löschen) | Liegen Dateien darin, kreuz zuerst **Delete everything inside** (Alles darin löschen) an. |

**New** in der Werkzeugleiste legt im aktuellen Ordner **New folder** (Neuer Ordner), **New text file** (Neue Textdatei) oder **New markdown file** (Neue Markdown-Datei) an. Für viele Dateien auf einmal setzt du Häkchen in ihren Kontrollkästchen. Eine Leiste zeigt, wie viele ausgewählt sind, mit **Select all** (Alle auswählen), **Move**, **Copy** und **Delete**. Große Ordner laden in Teilen, mit einer Schaltfläche **Load more** (Mehr laden).

Jeder Ordner kann eine kurze Notiz tragen. Klick auf den Beschreibungstext oder auf den Hinweis **Add description...** (Beschreibung hinzufügen), um eine zu schreiben. Die fünf Kategorie-Ordner haben feste Beschreibungen.

### Neu einlesen nach Änderungen von außen

Marinara führt intern eine Liste der Assets, damit der Game Mode sie schnell findet. Uploads über die App aktualisieren sie automatisch. Kopierst du außerhalb der App Dateien in den Game-Asset-Ordner auf deinem Computer, klick auf **Rescan**, um den Ordner neu einzulesen. **Rescan** findest du in der Werkzeugleiste des **Asset Browser** und in **Game Assets** unter **Settings**.

### Den Ordner am Computer öffnen

**Open in system folder** funktioniert nur, wenn du die App auf demselben Computer nutzt, auf dem der Server läuft. Auf Handy, Tablet oder einem anderen Computer sagt dir die App, dass sich Systemordner nur auf dem Gerät öffnen lassen, das Marinara hostet.

## Auswählen, welche Assets ein Spiel nutzen darf

Ein Game-Chat kann nur einen Teil deiner Asset-Ordner nutzen, etwa damit deine fröhliche Musik aus einem Horrorspiel herausbleibt.

1. Klapp während der Einrichtung im Schritt **Features** den Bereich **Adjust Game Assets for this Game** (Game-Assets für dieses Spiel anpassen) auf. Bei einem bestehenden Spiel öffnest du dessen Fenster **Game Assets**.
2. Klick auf **Game assets**. Die Schaltfläche heißt dann **Selecting**.
3. Über das kleine Statuselement an jedem Ordner nimmst du ihn auf oder schließt ihn aus.

Eine Leiste zeigt „All folders included“ oder wie viele Ordner ausgeschlossen sind. **Reset to all** (Alle wieder aufnehmen) nimmt wieder alles auf. Die Auswahl wird nur für diesen Chat gespeichert. Sie ändert, aus welchen Ordnern der Game Mode wählen darf, löscht oder versteckt aber keine Datei.

<a id="a-settings-own-art-and-music"></a>

### Eigene Grafik und Musik eines Settings

Ein Spiel, das mit einem Setting-Kit gestartet wurde, hat eine Stilfamilie für Grafik und Musik. Du siehst sie unter **Art and music** (Grafik und Musik), wenn du die Wörter des Kits änderst: `fantasy`, `scifi`, `modern`, `wuxia`, `jazz_age`, `wasteland` oder eine eigene Familie des Kits. Das Spiel nutzt die Ordner, die nach seiner Familie benannt sind, und jeden Ordner, der nach keiner Familie benannt ist, und lässt die Ordner anderer Familien weg. Ein Cyberpunk-Spiel spielt nie Fantasy-Kampfmusik und zeigt nie den verzauberten Wald. Passt nichts aus seiner Familie oder den gemeinsamen Ordnern, läuft lieber gar nichts als ein Titel einer anderen Familie. Ein Spiel ohne Setting-Kit nutzt jeden Ordner.

- **Music**: Lege die Titel des Settings unter `music/<state>/<family>/<intensity>` ab, zum Beispiel `combat/wuxia/intense`. Sie haben Vorrang vor gemeinsamen Titeln.
- **Backgrounds**: `backgrounds/<family>`. Hintergründe, die in einem Spiel mit Setting-Kit generiert werden, landen ebenfalls dort.
- **Kampfgeräusche**: Ein Geräusch in `sfx/combat/<family>`, das genauso heißt wie ein mitgeliefertes, etwa `sword-swing`, ersetzt dieses in Spielen dieser Familie. Die mitgelieferten Kampfgeräusche sind Fantasy, die Kämpfe anderer Familien bleiben also still, bis du eigene Geräusche für sie hinzufügst.

Die mitgelieferten Starter-Hintergründe gelten als gemeinsam, außer den Fantasy-Hintergründen (`ancient_library`, `castle_cliff`, `enchanted_forest`) und dem modernen `city_night`. Ein Setting-Kit, das gespeichert wurde, bevor es Stilfamilien gab, funktioniert weiter: Eines, das aus einem Starter-Kit entstanden ist, nutzt dessen Familie, und jedes andere nutzt jeden Ordner, bis du unter **Art and music** eine Familie auswählst. Die Auswahlleiste oben nennt die Familie des geöffneten Spiels.

<a id="generated-sound-effects-and-music"></a>

## Generierte Soundeffekte und Musik

Der Game Mode kann Soundeffekte und Musik über ein Konto vom Typ **Music & Sound Effects** (Musik und Soundeffekte) generieren. Wähle ElevenLabs, SunoAPI oder einen eigenen kompatiblen Server. Jeder neue Sound oder Titel nutzt dieses Dienstkonto. Mitgeliefertes Audio bleibt ohne Generierung verfügbar.

**Bevor du anfängst:** Du brauchst ein Konto vom Typ **Music & Sound Effects**. Im Fenster **Add account** (Konto hinzufügen) gibt es keine Kachel dafür. Solche Konten entstehen durch ein Upgrade oder einen Import, mit **Import a backup** (Backup importieren) in **Connections** (Verbindungen). Siehe [Anbietereinrichtung und Grenzen](../connections/providers-reference.md#music--sound-effects).

1. Öffne in **Connections** das Modell des Kontos mit **Edit model** (Modell bearbeiten).
2. Wähle den Dienst, trag seinen Key ein und wähle die Modelle für Musik und Soundeffekte. SunoAPI-Musik braucht außerdem eine öffentliche HTTPS-Callback-URL. Ein eigener Server braucht seine Endpunktpfade.
3. Schalte **Sound-effect generation** (Soundeffektgenerierung), **Music generation** (Musikgenerierung) oder beides ein.
4. Speichere das Konto. Siehe [Anbietereinrichtung und Grenzen](../connections/providers-reference.md#music--sound-effects).

Schalte die Funktion dann beim Anlegen eines Spiels ein:

1. Such im Schritt **Features** des Einrichtungsassistenten die Karte **Game Audio**.
2. Wähle in der Kontoauswahl dein Konto aus, oder behalte **Use the default Music & Sound Effects account** (Standardkonto für Musik und Soundeffekte verwenden).
3. Lass **Sound effects** (Soundeffekte) und **Music** (Musik) eingeschaltet, oder schalte aus, was du nicht möchtest.

Jeder Schalter setzt voraus, dass die passende Funktion im gewählten Konto eingeschaltet ist. Ein Audio-Konto nur für Sprachausgabe wird nicht zur Generierung verwendet.

Während des Spiels:

- **Sound effects.** Nach GM-Zügen fordert Marinara beim Dienst kurze Geräusche an, die zur Szene passen.
- **Music.** Marinara komponiert für jeden Ort, den die Party besucht, und für jede Art von Kampf, etwa einen Bosskampf, einen Instrumentaltitel von etwa zwei Minuten. Jeder Titel wird einmal erzeugt und wiederverwendet. Der Titel eines neuen Ortes beginnt erst bei einem späteren Szenenwechsel, damit die Musik nicht mitten in eine Szene hineinplatzt. Der Titel eines Kampfes wird eingeblendet, sobald er fertig ist.

Generierte Sounds und Titel werden bei deinen Game-Assets gespeichert, damit derselbe Sound nicht zweimal erzeugt wird. Spielt **Music DJ** die Musik für das Spiel, generiert der Game Mode keine Musik.

## Eigener Musikordner für den Music DJ

**Music DJ** ist ein Hilfs-Agent, der während eines Spiels Musik abspielen kann. Im Modus Custom spielt er Titel aus einem Ordner deiner Wahl. Aktivierst du **Music DJ** für einen Chat, richtet sich das Einrichtungsformular nach der Quelle, die im Agenten gespeichert ist. **Game Assets** zeigt einen Pfad innerhalb deiner Game-Assets, etwa `music` oder `music/combat`. **Folder on this device** (Ordner auf diesem Gerät) zeigt den gespeicherten Pfad auf dem Server-Gerät und eine Schaltfläche **Choose Folder** (Ordner wählen).

Der vollständige Editor von **Music DJ** hat einen Bereich **Custom Music Library** (Eigene Musikbibliothek). **Use Game Assets music folder** (Musikordner aus den Game-Assets verwenden) wechselt zwischen zwei Modi:

- An: Das Feld **Game Assets music folder** liest einen Ordner innerhalb deiner Game-Assets. **Open Folder** (Ordner öffnen) öffnet ihn auf dem Server-Rechner.
- Aus: **Music folder on this device** spielt Musik aus jedem Ordner auf dem Rechner, auf dem der Server läuft. Klick auf **Select Folder** (Ordner auswählen) oder füge den Pfad ein.

Für einen Ordner außerhalb der App braucht es erweiterte Rechte. Auf demselben Rechner wie der Server klappt das ohne zusätzliche Einrichtung. Von einem anderen Gerät oder per Fernzugriff musst du zuerst den Admin-Zugang einrichten. Siehe [Fernzugriff](../REMOTE_ACCESS.md). Alles Weitere zum Musikplayer findest du unter [Music DJ](../media/music.md).

## Verwandte Anleitungen

- [Music DJ: Spotify, YouTube und lokale Musik](../media/music.md)
- [Unterstützte KI-Anbieter](../connections/providers-reference.md)
- [Game Mode: Erste Schritte](getting-started.md)
- [Fernzugriff: Anmeldung und IP-Allowlist](../REMOTE_ACCESS.md)
