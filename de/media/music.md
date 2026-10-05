# Music DJ: Spotify, YouTube und lokale Musik

In dieser Anleitung erfährst du, wie du mit dem **Music DJ** (Musik-DJ) Hintergrundmusik in Marinara Engine abspielst. Du lernst, wie du Spotify, YouTube oder eigene lokale Musikdateien anbindest. Außerdem geht es um den Musikplayer, den Playlist-Bauer **DJ Mari** und die Musik im Game Mode.

## Was der Music DJ ist

**Music DJ** ist ein optionaler Agent zum Herunterladen. Ein Agent ist ein Helfer, der im Hintergrund eines Chats automatisch mitläuft. Öffne **Agents** (Agenten), wähle **Download Agents** (Agenten herunterladen) und installiere **Music DJ**, bevor du ihn einrichtest. Nach jeder Antwort liest Music DJ die Stimmung der Szene und spielt dazu passende Hintergrundmusik.

**Music DJ** kennt drei Musikquellen:

- **Spotify**: steuert die Wiedergabe auf deinem echten Spotify-Konto und deinen Geräten.
- **YouTube**: durchsucht YouTube und spielt den Treffer in einem kleinen Player in der App ab. Ein Login ist nicht nötig.
- **Custom**: spielt eigene Audiodateien aus einem Ordner auf dem Rechner ab, der Marinara ausführt.

Welche Quelle gerade aktiv ist, zeigt der kleine **Music Player** (Musikplayer) oben in der Leiste der App. Auf dem Handy und in schmalen Fenstern wird daraus ein kleines rundes Widget, das du frei verschieben kannst.

Direkt nach der Installation ist **Music DJ** ausgeschaltet. Du aktivierst ihn pro Chat wie jeden anderen Agenten. Verfügbar ist er in **Roleplay**-Chats und über einen eigenen Schalter im **Game Mode** (siehe „Music DJ im Game Mode“ weiter unten). Im **Conversation Mode** übernimmt stattdessen der Befehl **Music** (siehe „Der Music-Befehl im Conversation Mode“ weiter unten).

Eingerichtet wird **Music DJ** an einer einzigen gemeinsamen Stelle. Öffne rechts das Panel **Agents** und dann **Music DJ**. Alternativ klickst du auf das Zahnrad im Miniplayer. Sein Tooltip (Kurzhinweis beim Draufzeigen) lautet **Music DJ setup**.

### Musikquelle auswählen

Im Editor von **Music DJ** hat das Feld **Music Player** drei Schaltflächen: **Spotify**, **YouTube** und **Custom**. Der Hilfetext lautet „Choose which service Music DJ should use for future music picks. The same choice switches the visible player surface.“

Unter den Schaltflächen steht, welche Quelle gerade läuft, zum Beispiel „Visible player: Spotify. Saved provider: Spotify.“ Diese Auswahl gilt app-weit und wird nicht pro Chat gespeichert.

Zur schnellen Orientierung:

| Quelle | Konto nötig | Kosten | Am besten für |
|---|---|---|---|
| **Spotify** | eigenes Spotify-Konto, für die Wiedergabe zusätzlich Spotify Premium | Einrichtung kostenlos, Wiedergabe nur mit Premium | echte, namentlich genannte Songs auf den eigenen Geräten |
| **YouTube** | ein kostenloser Google-API-Key | kostenlos | Wiedergabe ohne Login und ohne Premium |
| **Custom** | keins | kostenlos | eigene lokale Audiodateien |

## Spotify einrichten

Spotify läuft über eine eigene, kostenlose Spotify-Entwickler-App. Du fügst nur eine **Spotify Client ID** ein. Ein Client Secret brauchst du nicht.

Öffne den Editor von **Music DJ** und suche das Feld **Spotify Connection** (Spotify-Verbindung). Und so funktioniert's:

1. Öffne das **Spotify Developer Dashboard** über den Link in der App.
2. Lege eine neue App an und wähle „Web API“.
3. Trag bei den Redirect URIs der App genau die Weiterleitungsadresse ein, die Marinara dir in Schritt 3 des Einrichtungsfelds anzeigt. Eine Weiterleitungsadresse ist die Webadresse, an die Spotify dich nach dem Login zurückschickt.
4. Kopiere die **Client ID** aus deiner Spotify-App und füge sie in das Feld **Spotify Client ID** ein.
5. Speichere den Agenten und klick dann auf **Connect Spotify Account** (Spotify-Konto verbinden).

Es öffnet sich ein Fenster für Login und Berechtigung. Nach der Bestätigung erscheint kurz eine Seite mit „Spotify Connected!“, dann schließt sich das Fenster. Zurück in Marinara siehst du eine grüne Plakette **Connected to Spotify**. Über **Disconnect** löschst du die gespeicherte Verbindung.

Die App weist darauf hin: „Requires Spotify Premium. Tokens refresh automatically, no need to reconnect.“ Ein kostenloses Spotify-Konto lässt sich zwar verbinden, aber Abspielen, Pausieren, Überspringen und Lautstärkeregelung setzen Spotify Premium voraus. Premium ist der kostenpflichtige Spotify-Tarif.

### Hinweise zu Spotify-Geräten

Spotify spielt immer über ein Gerät ab, etwa dein Handy, die Spotify-App auf dem Desktop oder einen Player in der App.

Am Desktop lässt sich der Browser-Tab selbst in ein Spotify-Gerät verwandeln. Klick dazu auf das Laptop-Symbol im Miniplayer. Sein Tooltip lautet **Enable Marinara player** oder **Use Marinara player**. Damit meldet sich ein Spotify-Gerät namens „Marinara Engine“ an, und die Musik läuft im Tab. Auch dafür ist Spotify Premium nötig.

Auf dem Handy bevorzugt der Player das Spotify-Gerät des Handys. Ein Tipp auf Play spielt die Musik also auf dem Handy ab, nicht im Browser-Tab im Hintergrund.

Erlaubt ein Spotify-Gerät keine Fernsteuerung der Lautstärke, ersetzt die Schaltfläche **Use device volume** den Regler. Nutze dann die Lautstärketasten des Geräts.

### Spotify auf einem anderen Rechner

Spotify akzeptiert nur sichere `https://`-Weiterleitungsadressen oder die Loopback-Adresse `http://127.0.0.1`. Loopback heißt: derselbe Rechner. Läuft Marinara auf einem anderen Rechner über einfaches `http`, lädt das Login-Fenster womöglich gar nicht.

Dafür gibt es zwei Wege:

- Öffne während des Verbindens den Bereich „Browser couldn't reach the callback?“ unter der Schaltfläche **Connect Spotify Account**. Kopiere die vollständige Adresse aus dem fehlgeschlagenen Fenster, füge sie in das Feld ein und klick auf **Complete connection**.
- Oder lege eine feste Weiterleitungsadresse über eine Umgebungsvariable auf dem Server fest. Eine Umgebungsvariable ist eine Servereinstellung, die beim Start gelesen wird.

```
SPOTIFY_REDIRECT_URI=https://your-address/api/spotify/callback
```

Wie du Umgebungsvariablen setzt, steht in der [Referenz zur Serverkonfiguration](../CONFIGURATION.md).

## YouTube einrichten

Der YouTube-Modus braucht einen kostenlosen YouTube-Data-API-Key. Ein API-Key ist ein geheimer Zugangscode, mit dem Marinara einen Dienst in deinem Namen nutzen darf. Ein YouTube-Login oder Premium ist nicht nötig.

Öffne den Editor von **Music DJ** und suche das Feld **YouTube Connection** (YouTube-Verbindung). Und so funktioniert's:

1. Öffne die **Google Cloud Console** über den Link in der App und lege ein Projekt an oder wähle eines aus.
2. Aktiviere die **YouTube Data API v3**.
3. Geh zu „Credentials“, dann „Create credentials“, dann „API key“.
4. Füge den Key in das Feld **YouTube Data API Key** ein.
5. Klick auf **Save Key** (Key speichern). Danach heißt die Schaltfläche **Update Key**, und eine grüne Plakette „API key configured“ erscheint. Über den Link **Remove** löschst du den Key.

Lass den Key ohne Einschränkung, oder beschränke ihn ausschließlich nach API und wähle dort YouTube Data API v3. Beschränke ihn nicht nach HTTP-Referrer: Die Suche läuft auf dem Server, eine Referrer-Beschränkung würde sie blockieren.

Die App weist darauf hin: „The free quota (~100 searches/day) is plenty for a personal DJ.“ Quota meint das tägliche Nutzungslimit. Diese Zahl stammt aus dem Text der App und kann sich mit der Zeit ändern. Der Key bleibt auf dem Server und wird verschlüsselt gespeichert.

## Eigene (lokale) Musik

Der Custom-Modus spielt eigene Audiodateien von dem Rechner ab, auf dem der Marinara-Server läuft. Unterstützt werden `.mp3`, `.ogg`, `.wav`, `.flac`, `.m4a`, `.aac` und `.webm`.

Öffne den Editor von **Music DJ** und suche das Feld **Custom Music Library**. Es enthält genau einen Schalter: **Use Game Assets music folder**.

- Schalter an: Der Custom-Modus liest Audiodateien, die du in Game Assets hochgeladen hast. Game Assets ist Marinaras eingebaute Medienbibliothek für den Game Mode. Über das Feld **Game Assets music folder** wählst du einen Ordner. Trag `music` für die gesamte Musikbibliothek ein oder einen Unterordner wie `music/combat`. Die Schaltfläche **Open Folder** öffnet diesen Ordner auf dem Server-Rechner.
- Schalter aus: Der Custom-Modus liest einen Ordner auf dem Server-Gerät. Über **Select Folder** öffnest du dort eine Ordnerauswahl, oder du fügst den Pfad direkt in das Feld **Music folder on this device** ein.

In Roleplay- und Game-Chats erscheint dieselbe gewählte Quelle. Hast du einen Ordner auf dem Server-Gerät gewählt, zeigen die Music-DJ-Einstellungen des Chats diesen gespeicherten Pfad und eine Schaltfläche **Choose Folder** – statt nach einem Game-Assets-Pfad zu fragen.

Für die Wiedergabe aus einem Ordner außerhalb von Game Assets ist lokaler Zugriff auf dem Server nötig. Nutzt du Marinara von einem anderen Gerät ohne Passwort oder Admin-Secret, kann genau diese Funktion blockiert sein. Siehe [Fernzugriff: Basic Auth und IP-Allowlist](../REMOTE_ACCESS.md).

## Den Musikplayer bedienen

Der **Music Player** erscheint am Desktop als kleine Plakette in der oberen Leiste, auf dem Handy als frei verschiebbares Widget. Per Einstellung lässt er sich ein- oder ausblenden.

Öffne **Settings** (Einstellungen), geh auf den Tab **General** und such den Bereich **App Behavior**. Dort schaltest du **Music Player** ein oder aus. Der Hilfetext lautet „Shows the compact Music Player. Switch between Spotify, YouTube, and Custom from the player itself or the Music DJ agent settings.“ Dieser Schalter steht immer zur Verfügung und ist standardmäßig an. Ist er aktiv, ohne dass Music DJ installiert ist, zeigt der Player am Desktop wie auf dem Handy stattdessen **Download Music DJ Agent to configure** und eine Schaltfläche **Download Agents**.

In einem frischen Profil startet die sichtbare Quelle als **YouTube**. Ändern lässt sie sich auf drei Wegen:

- über den kleinen runden Quellen-Umschalter am Player. Sein Tooltip lautet „Switch to ... player“.
- über die Schaltflächen **Music Player** im Editor von **Music DJ**.
- über die **Music DJ**-Einstellungen eines Chats.

Der Player zeigt Cover oder Vorschaubild des laufenden Titels sowie Titel und Interpret beziehungsweise Kanal. Welche Bedienelemente es gibt, hängt von der Quelle ab.

- Spotify: Zufallswiedergabe, **Previous**, Play/Pause, **Next**, Wiederholung, ein Lautstärkeregler mit Stummschaltung, die Schaltfläche **DJ**, die Laptop-Schaltfläche **Marinara player** und das Zahnrad **Music DJ setup**.
- YouTube: Play/Pause, ein Pfeil, der ein kleines 16:9-Videopanel aufklappt, eine Schaltfläche **Stop** und ein Lautstärkeregler mit Stummschaltung.
- Custom: Play/Pause und Lautstärke für die lokalen Dateien.

Ist Spotify noch nicht verbunden, steht im Player „Spotify not connected“; ein Tipp darauf öffnet **Music DJ setup**.

### Spotify-Quelle pro Chat

Läuft **Music DJ** in einem **Roleplay**-Chat, zeigt seine Einstellungskarte ein Dropdown-Menü **Spotify source** mit vier Optionen.

- **Liked Songs**: greift zuerst auf deine gespeicherten Titel zurück.
- **Playlist**: bleibt innerhalb einer Spotify-Playlist. Ein Dropdown-Menü **Playlist** listet deine Playlists auf.
- **Artist**: sucht nur im Umfeld eines genannten Interpreten. Dafür erscheint ein Textfeld **Artist**.
- **Any Spotify**: lässt den DJ die Spotify-Suche nutzen, wann immer es passt.

## DJ Mari: Playlists von der KI

Die Schaltfläche **DJ** im Spotify-Miniplayer baut dir eine Playlist nach Thema. Ihr Tooltip lautet „DJ Mari composes a playlist for you!“

**DJ Mari** lässt das verbundene KI-Modell eine Playlist zusammenstellen – auf Basis deiner Persona, deines meistgenutzten Charakters und der jüngsten Nachrichten aus allen Chats. Die gefundenen Songs landen anschließend in einer neuen Spotify-Playlist namens „DJ Mari“ plus Datum von heute, die sofort losspielt.

**DJ Mari** braucht zwei Dinge:

- eine Modellverbindung, die dem Agenten **Music DJ** zugewiesen ist. Fehlt sie, erscheint „Configure a model connection on the Music DJ agent before using DJ Mari.“ Siehe [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md).
- genug passende Spotify-Songs. Mindestens 25 müssen es sein, höchstens 50 werden übernommen. Findet DJ Mari weniger als 25, bittet er dich, mehr Liked Songs zu ergänzen und es erneut zu versuchen.

Klappt alles, erscheint die Meldung „DJ Mari playlist is ready“ mit einer Schaltfläche **Open playlist**.

## Music DJ im Game Mode

Der Game Mode bringt eigene Hintergrundmusik aus Game Assets mit. Willst du stattdessen **Music DJ** nutzen, aktiviere den Schalter **Music DJ** in der Game-Einrichtung. Seine Beschreibung lautet „Use the Music DJ for this game instead of local music assets.“ Standardmäßig ist der Schalter aus.

Ist er an, stehen dir dieselben Optionen **Spotify**, **YouTube** und **Custom** samt den jeweiligen Feldern zur Verfügung wie im Roleplay.

Spotify verhält sich im Game Mode etwas anders. Nach jeder Szene stellt der Server eine kurze Liste echter Songkandidaten aus der gewählten Quelle zusammen. Daraus wählt die KI dann einen Song aus. So kann sie sich keinen Song ausdenken, den es gar nicht gibt. Der Game Mode spielt immer genau einen Song in Schleife.

Öffne **Game controls** (Spielsteuerung) und wähle **Retry Music DJ**, um für die aktuelle Szene eine neue Auswahl anzufordern. Das geht am Computer und am Telefon. Siehe [Die Bedienelemente des Spiels](../game/getting-started.md#the-games-controls).

## Der Music-Befehl im Conversation Mode

Im **Conversation Mode** lässt sich **Music DJ** nicht als Agent hinzufügen. Charaktere können Songs dort über den Befehl **Music** abspielen.

Öffne den Bereich **Commands** des Chats. Aktiviere zuerst den Hauptschalter **Commands**, danach den Schalter **Music**. Seine Beschreibung lautet „Let characters play songs through the active Music Player.“

Jetzt kann ein Charakter einen Song für Spotify benennen oder einen Titel für YouTube beschreiben, und Marinara spielt ihn über die aktive Quelle ab. Das klappt selbst dann, wenn **Music DJ** nirgends aktiviert ist. Nötig ist nur eine verbundene Spotify-Verbindung oder ein gespeicherter YouTube-Key.

Ist Spotify nicht verbunden oder fehlt die Wiedergabeberechtigung, passiert beim Song-Befehl nichts – auch eine Fehlermeldung bleibt aus. Richte die Quelle also zuerst ein, wenn keine Songs laufen.

## Fehlerbehebung

- Der Miniplayer fehlt. Aktiviere **Music Player** unter **Settings**, Tab **General**, Bereich **App Behavior**.
- Spotify spielt nichts ab. Die Wiedergabesteuerung braucht Spotify Premium und ein aktives Spotify-Gerät. Öffne die Desktop-App auf einem Gerät oder klick am Desktop auf **Enable Marinara player**.
- Das Spotify-Login-Fenster schlägt auf einem anderen Rechner fehl. Nutze das Einfügefeld unter „Browser couldn't reach the callback?“ oder setze `SPOTIFY_REDIRECT_URI` auf dem Server.
- Die YouTube-Suche schlägt fehl. Prüfe, ob die **YouTube Data API v3** für das Projekt aktiviert und der Key nicht nach HTTP-Referrer beschränkt ist. Ist das Tageslimit erreicht, versuch es am nächsten Tag noch einmal oder nimm einen anderen Key.
- Eigene Musik aus einem Geräteordner spielt über Fernzugriff nicht ab. Dieser Ordner braucht lokalen Zugriff auf dem Server. Siehe [Fernzugriff: Basic Auth und IP-Allowlist](../REMOTE_ACCESS.md).
- Der Song-Befehl eines Charakters bewirkt im Conversation Mode nichts. Verbinde Spotify oder speichere einen YouTube-Key, und achte darauf, dass die Schalter **Commands** und **Music** an sind.

## Verwandte Anleitungen

- [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md)
- [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md)
- [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md)
- [Game Assets](../game/game-assets.md)
- [Conversation Mode: Erste Schritte](../conversation/getting-started.md)
