# Game-Assets: Musik, Sound, Sprites und Hintergründe

In dieser Anleitung erfährst du, wie die Game-Asset-Bibliothek funktioniert, aus der sich der Game Mode für Musik, Sound, Charakterbilder und Szenen-Hintergründe bedient. Es geht um das mitgelieferte Starter-Set, den Dateimanager **Asset Browser**, das Hochladen eigener Dateien, die Auswahl, welche Assets ein Spiel nutzen darf, sowie Soundeffekte und Musik, die der Game Mode für dich generieren kann.

## Was Game-Assets sind

Game-Assets sind die Mediendateien, die der Game Mode während einer Sitzung abspielt und anzeigt. Marinara Engine sortiert sie in fünf Kategorien:

- **Music**: Hintergrundmusik, die mit der Szene wechselt.
- **Ambient**: Umgebungsgeräusche in Endlosschleife, etwa aus Natur, Stadt oder Innenräumen.
- **Sound Effects** (kurz SFX): kurze Geräusche für Menüs, Kampf und Erkundung.
- **Sprites**: Charakter- und Objektbilder, die auf dem Bildschirm erscheinen.
- **Backgrounds**: Szenenbilder hinter der Geschichte.

Der Game Mode liest diese Bibliothek selbstständig aus. Musik, Umgebungsgeräusche und Hintergründe wählt er passend zur Szene automatisch – von Hand zuweisen musst du während des Spiels also nichts.

## Das mitgelieferte Starter-Set

Beim ersten Serverstart installiert Marinara eine kostenlose Starter-Bibliothek. Ändert sich das mitgelieferte Set, frischt Marinara die Dateien bei späteren Starts auf. Enthalten sind:

- Fünf **Music**-Titel, jeweils einer für eine bestimmte Szenenstimmung.
- Mehrere **Ambient**-Schleifen in den Ordnern nature, urban und interior.
- **Sound Effects** für Menüs, Kampf und Erkundung.

**Backgrounds** liegen keine bei. Die Hintergrund-Ordner sind anfangs leer. Sie füllen sich erst, wenn du Bilder hochlädst oder der Game Mode Szenenbilder generiert.
Auch Charakter-**Sprites** sind nicht dabei. Ergänze nur die Charakterbilder, die zu deinen eigenen Spielen passen.

Alle mitgelieferten Dateien stehen unter CC0 – sie sind also gemeinfrei und frei verwendbar. Die vollständigen Credits zu jeder Datei stehen in der Textdatei `CREDITS.md`, die zusammen mit den Assets auf der Festplatte liegt. In der App wird sie nicht angezeigt.

Mitgelieferte Dateien und Ordner sind geschützt: Im **Asset Browser** lassen sie sich weder löschen noch verschieben, damit die Starter-Bibliothek intakt bleibt. Umbenennen und Kopieren geht trotzdem.

## Den Asset Browser öffnen

Der **Asset Browser** ist ein Dateimanager für die Game-Assets. Zwei Wege führen dorthin.

Über **Settings** (Einstellungen):

1. Öffne **Settings**.
2. Wechsle zum Tab **Imports**.
3. Such den Bereich **Game Assets**.
4. Klick auf die Schaltfläche **Asset Browser**.

Aus einem Spiel heraus:

1. Öffne einen Game-Mode-Chat.
2. Klick oder tippe auf **Game Assets** (das Ordnersymbol). Die Schaltfläche liegt anfangs nahe der oberen rechten Ecke des Chats. Du kannst sie am Computer oder Telefon an eine andere Stelle ziehen.

Die Schaltfläche erscheint nur in Chats mit Game Mode. Sie öffnet **Game Assets** mit dem **Asset Browser** darin: am Computer als verschiebbares Fenster, am Telefon als Panel über die ganze Breite.

Hast du dieses Fenster mit **Put back in Chat Settings** verschoben, öffne stattdessen den Abschnitt **Game Assets** in Chat Settings.

Oben in der Werkzeugleiste steht eine Brotkrumen-Navigation, die bei **Game Assets** beginnt. Daneben liegen ein Umschalter zwischen **Grid view** (Kachelansicht) und **List view** (Listenansicht), eine Schaltfläche **Upload** (Hochladen) und eine Schaltfläche **New** (Neu). Dazu kommen eine Schaltfläche **Rescan** (Neu einlesen), eine Schaltfläche **Open in system folder** (Im Systemordner öffnen) und ein Suchfeld **Search in folder** (Im Ordner suchen). Auf breiteren Bildschirmen wechselst du über einen Ordnerbaum links zwischen den Kategorien.

## Eigene Assets hochladen

Für den Upload gibt es zwei Wege. Nimm den, der dir leichter fällt.

### Upload über den Asset Browser

1. Öffne den **Asset Browser**.
2. Klick dich in einen der fünf Kategorie-Ordner oder in einen Unterordner darin.
3. Klick auf **Upload** und wähle die Dateien aus, oder zieh sie in den Dateibereich.

Du musst dich zuerst in einem Kategorie-Ordner befinden. Legst du Dateien auf der obersten Ebene ab, fordert dich die App auf, vorher einen Kategorie-Ordner zu öffnen.

### Upload über Settings

1. Öffne **Settings** und wechsle zum Tab **Imports**.
2. Such den Bereich **Game Assets**.
3. Wähle im Menü **Type** (Typ) eine Kategorie: **Music**, **Ambient**, **Sound Effects**, **Sprites** oder **Backgrounds**.
4. Leg im Feld **Folder** (Ordner) das Ziel fest, oder behalte den Vorschlag bei.
5. Klick auf **Choose Files** (Dateien auswählen) und wähle die Dateien aus.
6. Klick auf **Upload to Server** (Auf den Server hochladen).

Jeder **Type** füllt das Feld **Folder** mit einem sinnvollen Standard. Die Standardwerte:

- **Music**: `exploration/fantasy/calm`
- **Ambient**: `nature`
- **Sound Effects**: `exploration`
- **Sprites**: `generic-fantasy`
- **Backgrounds**: `custom`

### Regeln für Dateityp und Größe

Der Server prüft jeden Upload gegen diese Regeln. Sie gelten für beide Upload-Wege.

| Kategorie                     | Erlaubte Dateitypen                  |
| ----------------------------- | ------------------------------------ |
| Music, Ambient, Sound Effects | MP3, OGG, WAV, FLAC, M4A, AAC, WebM  |
| Sprites                       | PNG, JPG, JPEG, GIF, WebP, AVIF, SVG |
| Backgrounds                   | PNG, JPG, JPEG, GIF, WebP, AVIF      |

Audio- und Bilddateien dürfen jeweils bis zu 50 MB groß sein, Textdateien bis zu 10 MB. Dateitypen, die nicht zur Kategorie passen, weist der Server ab. Die Fehlermeldung listet die erlaubten Typen auf.

### Die Ordnerregel für Musik

Musik folgt einem strikten Ordnerschema. Jeder Musiktitel muss in einem dreistufigen Pfad nach dem Muster `state/genre/intensity` liegen, zum Beispiel `exploration/fantasy/calm`. Passt der Pfad nicht, schlägt der Upload fehl.

Erlaubt sind diese Werte:

- State: `exploration`, `dialogue`, `combat`, `travel_rest`.
- Genre: `fantasy`, `horror`, `romance`, `mystery`, `scifi`, `modern`, `slice_of_life`, `adventure`, `drama`, `custom` oder die Familie eines Settings (siehe unten), zum Beispiel `wuxia`.
- Intensity: `calm`, `tense`, `intense`.

An diesem Schema erkennt der Game Mode, wann er welchen Titel abspielt. Für Ambient-, Soundeffekt-, Sprite- und Hintergrund-Ordner gilt die Regel nicht – deren Unterordner darfst du frei benennen.

<a id="a-settings-own-art-and-music"></a>

### Eigene Grafik und Musik eines Settings

Ein Spiel, das mit einem Setting-Kit gestartet wurde, hat eine Stilfamilie für Grafik und Musik. Du siehst sie unter **Art and music** (Grafik und Musik), wenn du die Wörter des Kits änderst: `fantasy`, `scifi`, `modern`, `wuxia`, `jazz_age`, `wasteland` oder eine eigene Familie des Kits. Das Spiel nutzt die Ordner, die nach seiner Familie benannt sind, und jeden Ordner, der nach keiner Familie benannt ist. Die Ordner der anderen Familien lässt es weg. So spielt ein Cyberpunk-Spiel nie Fantasy-Kampfmusik und zeigt nie den verzauberten Wald. Passt nichts aus der eigenen Familie oder den gemeinsamen Ordnern, läuft lieber gar nichts als ein Titel einer anderen Familie.

- **Music**: Lege die Titel des Settings unter `music/<state>/<family>/<intensity>` ab, zum Beispiel `combat/wuxia/intense`. Sie haben Vorrang vor gemeinsamen Titeln.
- **Backgrounds**: `backgrounds/<family>`. Hintergründe, die während eines Spiels mit Setting-Kit generiert werden, landen ebenfalls dort.
- **Kampfgeräusche**: Ein Geräusch in `sfx/combat/<family>`, das genauso heißt wie ein mitgeliefertes, etwa `sword-swing`, ersetzt dieses in Spielen dieser Familie. Die mitgelieferten Kampfgeräusche sind Fantasy. Die Kämpfe einer anderen Familie bleiben deshalb still, bis du eigene Geräusche für sie hinzufügst.

Die mitgelieferten Starter-Hintergründe gelten als gemeinsam, außer den Fantasy-Hintergründen (`ancient_library`, `castle_cliff`, `enchanted_forest`) und dem modernen `city_night`. Ein Spiel ohne Setting-Kit nutzt wie bisher jeden Ordner. Ein Setting-Kit, das gespeichert wurde, bevor es Stilfamilien gab, funktioniert weiter: Eines, das aus einem Starter-Kit entstanden ist, nutzt die Familie dieses Starter-Kits. Jedes andere nutzt jeden Ordner, bis du unter **Art and music** eine Familie auswählst. Die Auswahlleiste aus [Auswählen, welche Assets ein Spiel nutzen darf](#choosing-which-assets-a-game-can-use) nennt die Familie des geöffneten Spiels.

## Assets organisieren

Im **Asset Browser** hältst du die Dateien in Ordnung. Am Desktop führt ein Rechtsklick auf eine Datei oder einen Ordner zu den Aktionen, alternativ das Menü „...“.

Aktionen für eine Datei:

- **Rename** (Umbenennen): der Datei einen neuen Namen geben. Ist der Name im Ordner schon vergeben, schlägt das Umbenennen fehl.
- **Move** (Verschieben) und **Copy** (Kopieren): die Datei über eine Ordnerauswahl in einen anderen Ordner legen.
- **Delete** (Löschen): die Datei entfernen.
- **Download** (Herunterladen): die Datei auf dem Gerät speichern.

Aktionen für einen Ordner:

- **Create subfolder** (Unterordner anlegen): einen neuen Ordner darin anlegen.
- **Open in system folder**: den Ordner im Dateimanager des Computers anzeigen.
- **Delete folder** (Ordner löschen): den Ordner entfernen. Liegen noch Dateien darin, musst du zuerst **Delete everything inside** (Alles darin löschen) ankreuzen.

Auch die Schaltfläche **New** in der Werkzeugleiste legt Elemente im aktuellen Ordner an. Zur Wahl stehen **New folder** (Neuer Ordner), **New text file** (Neue Textdatei) und **New markdown file** (Neue Markdown-Datei).

Für mehrere Dateien auf einmal nutzt du die Kontrollkästchen an jeder Datei. Eine Leiste zeigt die Anzahl der ausgewählten Dateien und bietet die Schaltflächen **Select all** (Alle auswählen), **Move**, **Copy** und **Delete**. Große Ordner zeigen ihren Inhalt nur teilweise an – über **Load more** (Mehr laden) kommt der Rest nach.

Jeder Ordner kann eine kurze Notiz tragen. Klick auf den Beschreibungstext des Ordners oder auf den Hinweis **Add description...** (Beschreibung hinzufügen), um sie zu schreiben. Die fünf Kategorie-Ordner haben feste Beschreibungen, die sich nicht ändern lassen.

Denk daran: Mitgelieferte Starter-Dateien sind geschützt. Umbenennen und Kopieren ist erlaubt, Verschieben und Löschen nicht.

## Neu einlesen nach Änderungen von außen

Marinara führt intern eine Liste der Assets, damit der Game Mode sie schnell findet. Beim Upload über die App aktualisiert sich diese Liste von selbst.

Kopierst du Dateien direkt am Computer in den Game-Asset-Ordner, also außerhalb der App, bekommt die App davon zunächst nichts mit. Ein Klick auf **Rescan** liest den Ordner neu ein und nimmt die neuen Dateien auf. **Rescan** findest du sowohl in der Werkzeugleiste des **Asset Browser** als auch im Bereich **Game Assets** unter **Settings**.

<a id="choosing-which-assets-a-game-can-use"></a>

## Auswählen, welche Assets ein Spiel nutzen darf

Jeder Game-Mode-Chat kann sich auf einen Teil der Asset-Ordner beschränken. Praktisch ist das etwa, wenn ein Horrorspiel die fröhliche Musik überspringen soll.

Während der Einrichtung klappst du im Schritt **Features** den Bereich **Adjust Game Assets for this Game** (Game-Assets für dieses Spiel anpassen) auf. Bei einem laufenden Spiel öffnest du das Fenster **Game Assets**.

Dann:

1. Klick auf die Schaltfläche **Game assets**. Solange sie aktiv ist, heißt sie **Selecting**.
2. Über das kleine Statuselement an jedem Ordner nimmst du ihn auf oder schließt ihn aus.

Eine Leiste meldet „All folders included“ oder die Zahl der ausgeschlossenen Ordner, dazu holt die Schaltfläche **Reset to all** (Alle wieder aufnehmen) sämtliche Ordner zurück. Die Auswahl gilt nur für diesen einen Chat. Sie steuert, aus welchen Ordnern der Game Mode wählen darf, löscht oder versteckt aber keine Dateien. Außerhalb dieses Game-Mode-Chats hat sie keine Wirkung.

<a id="generated-sound-effects-and-music"></a>

## Generierte Soundeffekte und Musik

Der Game Mode kann mit ElevenLabs, einem KI-Audiodienst, auch neue Soundeffekte und Musik für deine Szenen erzeugen. Dafür brauchst du einen API-Key von ElevenLabs. Jeder neue Sound und jeder neue Titel ist eine Anfrage an ElevenLabs über dein Konto.

Richte zuerst eine Audioverbindung ein:

1. Öffne das Panel **Connections** (Verbindungen) und lege eine Verbindung mit dem Anbieter **Audio** an.
2. Wähle unter **Audio Source** (Audioquelle) **ElevenLabs** aus und füge dann deinen API-Key von ElevenLabs ein.
3. Aktiviere **Game sound effects** (Soundeffekte im Spiel), **Game music** (Musik im Spiel) oder beide. Diese Schalter erscheinen nur bei der Quelle **ElevenLabs**.
4. Speichere die Verbindung.

Schalte die Funktion dann beim Anlegen eines Spiels ein:

1. Such im Schritt **Features** des Einrichtungsassistenten die Karte **Game Audio**.
2. Wähle unter **Audio Connection** (Audioverbindung) deine ElevenLabs-Verbindung aus, oder behalte **Use the default audio connection** (Standard-Audioverbindung verwenden).
3. Lass **Sound effects** (Soundeffekte) und **Music** (Musik) eingeschaltet, oder schalte aus, was du nicht möchtest.

**Sound effects** oder **Music** lassen sich erst einschalten, wenn die gewählte Verbindung eine ElevenLabs-Verbindung ist, bei der der jeweilige Schalter aktiv ist. Die Karte zeigt dir an, wenn das noch nicht der Fall ist.

Während des Spiels:

- **Sound effects**: Nach GM-Zügen fordert Marinara bei ElevenLabs kurze Soundeffekte an, die zur Szene passen.
- **Music**: Marinara komponiert einen rund zweiminütigen Instrumentaltitel für jeden Ort, den die Party besucht, und für jede Art von Kampf, etwa einen Bosskampf. Jeder Titel wird nur einmal erzeugt und danach wiederverwendet. Der Titel eines neuen Ortes beginnt erst bei einem späteren Szenenwechsel, damit die Musik nicht mitten in eine Szene hineinplatzt. Der Titel eines Kampfes wird eingeblendet, sobald er fertig ist.

Generierte Sounds und Titel werden bei deinen Game-Assets gespeichert, damit derselbe Sound nicht zweimal erzeugt wird. Spielt **Music DJ** die Musik für das Spiel, generiert der Game Mode keine Musik.

## Eigener Musikordner für den Music DJ

**Music DJ** ist ein Hilfs-Agent, der während eines Spiels Musik abspielen kann. Im Modus Custom spielt er Titel aus einem Ordner deiner Wahl. Diesen Ordner legst du an zwei Stellen fest.

Aktivierst du **Music DJ** für einen Chat, richtet sich das Einrichtungsformular nach der Quelle, die im Music-DJ-Agenten gespeichert ist. **Game Assets** zeigt einen Pfad innerhalb der Game-Assets, etwa `music` oder `music/combat`. **Folder on this device** (Ordner auf diesem Gerät) zeigt den gespeicherten Pfad auf dem Server-Gerät sowie eine Schaltfläche **Choose Folder** (Ordner wählen).

Der vollständige Editor von **Music DJ** enthält den Bereich **Custom Music Library** (Eigene Musikbibliothek). Der Schalter **Use Game Assets music folder** (Musikordner aus den Game-Assets verwenden) wechselt zwischen zwei Modi:

- Schalter an: Das Feld **Game Assets music folder** verweist auf einen Ordner innerhalb der Game-Assets, etwa `music` oder `music/combat`. Die Schaltfläche **Open Folder** (Ordner öffnen) öffnet ihn auf dem Server-Rechner.
- Schalter aus: Über das Feld **Music folder on this device** spielt der Modus Custom Musik aus jedem beliebigen Ordner des Rechners, auf dem der Server läuft. Klick auf **Select Folder** (Ordner auswählen), um die Systemauswahl zu öffnen, oder füge den Ordnerpfad direkt ins Feld ein.

Für einen Ordner außerhalb der App braucht es erweiterte Rechte. Auf demselben Rechner wie der Server klappt das ohne Zusatzschritte. Von einem anderen Gerät oder per Fernzugriff musst du zuerst den Admin-Zugang einrichten. Wie du ihn aktivierst, steht unter [Fernzugriff](../REMOTE_ACCESS.md). Alles Weitere zum Musikplayer findest du unter [Music DJ](../media/music.md).

## Den Ordner am Computer öffnen

Die Schaltfläche **Open in system folder** öffnet den ausgewählten Asset-Ordner im normalen Dateimanager des Computers. Das funktioniert nur, wenn du die App auf demselben Rechner nutzt, auf dem der Server läuft. Auf Handy, Tablet oder einem anderen Computer weist dich die App darauf hin, dass sich Systemordner nur auf dem Gerät öffnen lassen, das Marinara hostet.

## Verwandte Anleitungen

- [Music DJ: Spotify, YouTube und lokale Musik](../media/music.md)
- [Unterstützte KI-Anbieter](../connections/providers-reference.md)
- [Game Mode: Erste Schritte](getting-started.md)
- [Fernzugriff: Basic Auth und IP-Allowlist](../REMOTE_ACCESS.md)
