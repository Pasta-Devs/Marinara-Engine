# Music DJ: Spotify, YouTube und lokale Musik

**Music DJ** spielt Hintergrundmusik, die zu deiner Szene passt. In dieser Anleitung erfährst du, wie du Spotify, YouTube oder eigene Audiodateien einrichtest, den Musikplayer bedienst und Musik in Game Mode und Conversation nutzt.

## Was Music DJ ist

**Music DJ** ist ein optionaler Agent zum Herunterladen. Ein Agent ist ein Helfer, der im Hintergrund eines Chats mitläuft. Nach jeder Antwort kann Music DJ die Stimmung der Szene lesen und passende Musik spielen.

Bevor du loslegst: Öffne **Agents** (Agenten), wähle **Agent Organizer** (Agentenverwaltung) und installiere **Music DJ**. Nach der Installation ist er aus. Du schaltest ihn für einen Chat ein wie jeden anderen Agenten. Er funktioniert in Roleplay-Chats, im Game Mode über einen eigenen Schalter ([Music DJ im Game Mode](#music-dj-in-game-mode)) und in Conversation über den Befehl **Music** ([Der Music-Befehl in Conversation](#the-conversation-music-command)).

Er spielt aus drei Quellen.

| Quelle | Konto nötig | Kosten | Am besten für |
| --- | --- | --- | --- |
| **Spotify** | Eigenes Spotify-Konto, zum Abspielen außerdem Spotify Premium | Einrichtung kostenlos, Abspielen nur mit Premium | Echte, namentlich genannte Songs auf deinen eigenen Geräten |
| **YouTube** | Ein kostenloser Google-API-Key | Kostenlos | Wiedergabe ohne Login und ohne Premium |
| **Custom** | Keins | Kostenlos | Deine eigenen Audiodateien |

Die aktive Quelle zeigt der kleine **Music Player** (Musikplayer), der oben in der Leiste angeheftet ist. Auf dem Handy und in schmalen Fenstern wird daraus ein kleines rundes, schwebendes Widget, das du verschieben kannst.

Eingerichtet wird Music DJ an einer einzigen gemeinsamen Stelle. Öffne rechts das Panel **Agents** und dann **Music DJ**. Du kannst auch auf das Zahnrad im Miniplayer klicken (Tooltip **Music DJ setup**).

### Musikquelle auswählen

Im Editor von **Music DJ** hat das Feld **Music Player** drei Schaltflächen: **Spotify**, **YouTube** und **Custom**. Eine Zeile darunter zeigt, was gerade aktiv ist, zum Beispiel „Visible player: Spotify. Saved provider: Spotify.“ Diese Auswahl gilt app-weit und wird nicht pro Chat gespeichert.

## Spotify einrichten

Spotify läuft über deine eigene, kostenlose Spotify-Entwickler-App. Du fügst nur eine **Spotify Client ID** ein. Ein Client Secret gibt es nicht.

1. Such im Editor von **Music DJ** das Feld **Spotify Connection** (Spotify-Verbindung).
2. Öffne das **Spotify Developer Dashboard** über den Link in der App.
3. Lege eine neue App an und wähle „Web API“.
4. Trag bei den Redirect URIs der App genau die Weiterleitungsadresse ein, die Marinara in Schritt 3 des Einrichtungsfelds in der App anzeigt. Eine Weiterleitungsadresse ist die Adresse, an die Spotify dich nach dem Login schickt.
5. Kopiere die **Client ID** und füge sie in **Spotify Client ID** ein.
6. Speichere den Agenten und klick dann auf **Connect Spotify Account** (Spotify-Konto verbinden).

Es öffnet sich ein Fenster für Spotify-Login und Berechtigung. Nach deiner Bestätigung zeigt es kurz eine Erfolgsseite und schließt sich. Marinara zeigt eine grüne Plakette **Connected to Spotify**. **Disconnect** (Trennen) löscht die gespeicherte Verbindung.

> **Hinweis:** Für Abspielen, Pausieren, Überspringen und Lautstärke ist Spotify Premium (der kostenpflichtige Tarif) nötig. Ein kostenloses Konto lässt sich verbinden. Tokens werden automatisch erneuert.

Wenn es nicht funktioniert hat: Auf einem anderen Rechner kann das Login-Fenster fehlschlagen (siehe unten). Prüf sonst, ob die Weiterleitungsadresse genau übereinstimmt.

### Spotify-Geräte

Spotify spielt über ein Gerät ab, etwa dein Handy, die Spotify-App auf dem Desktop oder einen Player in der App.

- Am Desktop klickst du auf das Laptop-Symbol im Miniplayer (**Enable Marinara player** oder **Use Marinara player**), um den Browser-Tab in ein Spotify-Gerät namens „Marinara Engine“ zu verwandeln. Das Streamen im Tab setzt Premium voraus.
- Auf dem Handy bevorzugt der Player das Spotify-Gerät des Handys. Die Wiedergabe läuft also auf dem Handy und nicht in einem Tab im Hintergrund.
- Erlaubt ein Gerät keine Fernsteuerung der Lautstärke, ersetzt **Use device volume** den Regler. Nutze dann die Lautstärketasten des Geräts.

### Spotify auf einem anderen Rechner

Spotify akzeptiert nur sichere `https://`-Weiterleitungsadressen oder die Loopback-Adresse `http://127.0.0.1` (derselbe Rechner). Läuft Marinara auf einem anderen Rechner über einfaches `http`, kann das Login-Fenster fehlschlagen. Zwei Lösungen:

- Öffne während des Verbindens „Browser couldn't reach the callback?“ unter **Connect Spotify Account**. Kopiere die vollständige Adresse aus dem fehlgeschlagenen Fenster, füge sie in das Feld ein und klick auf **Complete connection** (Verbindung abschließen).
- Oder lege eine feste Weiterleitungsadresse als Umgebungsvariable fest (eine Servereinstellung, die beim Start gelesen wird):

```text
SPOTIFY_REDIRECT_URI=https://your-address/api/spotify/callback
```

Siehe die [Referenz zur Server-Konfiguration](../CONFIGURATION.md).

### Festlegen, wo Spotify Songs aussucht (Roleplay)

Läuft Music DJ in einem Roleplay-Chat, hat seine Karte eine Liste **Spotify source** (Spotify-Quelle).

- **Liked Songs**: zuerst aus deinen gespeicherten Titeln wählen.
- **Playlist**: innerhalb einer Playlist bleiben, die du in der Liste **Playlist** auswählst.
- **Artist**: im Umfeld eines Interpreten suchen, den du im Feld **Artist** einträgst.
- **Any Spotify**: den DJ die Spotify-Suche nutzen lassen, wenn es passt.

## YouTube einrichten

Der YouTube-Modus braucht einen kostenlosen YouTube-Data-API-Key. Ein API-Key ist ein geheimer Code, mit dem Marinara einen Dienst für dich nutzen darf. Ein YouTube-Login oder Premium ist nicht nötig.

1. Such im Editor von **Music DJ** das Feld **YouTube Connection** (YouTube-Verbindung).
2. Öffne die **Google Cloud Console** über den Link in der App und lege ein Projekt an oder wähle eines aus.
3. Aktiviere die **YouTube Data API v3**.
4. Geh zu Credentials, Create credentials, API key.
5. Füge den Key in **YouTube Data API Key** ein.
6. Klick auf **Save Key** (Key speichern). Danach heißt die Schaltfläche **Update Key**, und eine grüne Plakette „API key configured“ erscheint. **Remove** löscht den Key.

Lass den Key ohne Einschränkung, oder beschränke ihn ausschließlich nach API auf YouTube Data API v3. Beschränke ihn nicht nach HTTP-Referrer. Die Suche läuft auf dem Server, eine Referrer-Beschränkung würde sie also blockieren. Laut App reicht das kostenlose Kontingent (etwa 100 Suchen am Tag) für einen persönlichen DJ völlig aus. Diese Zahl stammt aus dem Text der App und kann sich ändern. Dein Key bleibt verschlüsselt auf dem Server.

## Eigene Musikdateien nutzen

Der Custom-Modus spielt Audiodateien von dem Rechner ab, auf dem Marinara läuft. Unterstützt werden `.mp3`, `.ogg`, `.wav`, `.flac`, `.m4a`, `.aac` und `.webm`.

Such im Editor von **Music DJ** den Bereich **Custom Music Library**. Er hat genau einen Schalter: **Use Game Assets music folder**.

- **On**: Der Custom-Modus liest Audiodateien, die du in Game Assets hochgeladen hast, Marinaras Asset-Bibliothek für den Game Mode. Über **Game Assets music folder** wählst du einen Ordner. Trag `music` für die ganze Bibliothek ein oder einen Unterordner wie `music/combat`. **Open Folder** öffnet ihn auf dem Server-Rechner.
- **Off**: Der Custom-Modus liest einen Ordner auf dem Server-Gerät. Mit **Select Folder** öffnest du eine Ordnerauswahl auf dem Server-Rechner, oder du fügst den Pfad in **Music folder on this device** ein.

Die Einrichtung in Roleplay und Game zeigt dieselbe Quelle. Hast du einen Ordner auf dem Server-Gerät gewählt, zeigen die Music-DJ-Einstellungen des Chats diesen Pfad und eine Schaltfläche **Choose Folder**.

Für die Wiedergabe aus einem Ordner außerhalb von Game Assets ist lokaler Zugriff auf dem Server nötig. Von einem anderen Gerät ohne Login oder Admin-Secret kann diese Funktion blockiert sein. Siehe [Fernzugriff: Anmeldung und IP-Allowlist](../REMOTE_ACCESS.md).

## Den Musikplayer bedienen

Der **Music Player** ist am Desktop eine Plakette in der oberen Leiste und auf dem Handy ein verschiebbares Widget. Zum Ein- oder Ausblenden öffnest du **Settings → General → App Behavior** (Einstellungen → Allgemein → App-Verhalten) und schaltest **Music Player** um. Standardmäßig ist er an. Ist er an, ohne dass Music DJ installiert ist, zeigt der Player **Download Music DJ Agent to configure** und bietet eine Schaltfläche **Agent Organizer** an.

In einem frischen Profil startet die Quelle als **YouTube**. Ändern lässt sie sich über den runden Quellen-Umschalter am Player (Tooltip „Switch to ... player“), über die Schaltflächen **Music Player** im Editor oder über die **Music DJ**-Einstellungen eines Chats.

Der Player zeigt Cover oder Vorschaubild des Titels sowie Titel und Interpret oder Kanal. Welche Bedienelemente es gibt, hängt von der Quelle ab.

- **Spotify**: Zufallswiedergabe, **Previous**, Play oder Pause, **Next**, Wiederholung, Lautstärke mit Stummschaltung, **DJ**, die Laptop-Schaltfläche **Marinara player** und das Zahnrad **Music DJ setup**. Ist Spotify nicht verbunden, steht im Player „Spotify not connected“, und ein Tipp darauf öffnet **Music DJ setup**.
- **YouTube**: Play oder Pause, ein Pfeil, der ein kleines 16:9-Videopanel öffnet, **Stop** sowie Lautstärke mit Stummschaltung.
- **Custom**: Play oder Pause und Lautstärke.

## DJ Mari: Playlists von der KI

Die Schaltfläche **DJ** im Spotify-Miniplayer („DJ Mari composes a playlist for you!“) baut eine Playlist zu einem Thema. DJ Mari lässt dein verbundenes KI-Modell sie aus deiner Persona, deinem meistgenutzten Charakter und den jüngsten Chats aus allen Gesprächen zusammenstellen. Die gefundenen Songs landen in einer neuen Spotify-Playlist namens „DJ Mari“ plus dem heutigen Datum, die sofort startet.

Dafür braucht DJ Mari zwei Dinge.

- Ein Modell, das dem Agenten **Music DJ** zugewiesen ist. Ohne eines siehst du „Configure a model connection on the Music DJ agent before using DJ Mari.“ Siehe [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).
- Mindestens 25 passende Spotify-Songs. Übernommen werden höchstens 50. Bei weniger als 25 bittet DJ Mari dich, mehr Liked Songs hinzuzufügen und es erneut zu versuchen.

Klappt es, siehst du „DJ Mari playlist is ready“ mit einer Schaltfläche **Open playlist** (Playlist öffnen).

<a id="music-dj-in-game-mode"></a>

## Music DJ im Game Mode

Der Game Mode hat eigene Hintergrundmusik aus Game Assets. Willst du stattdessen Music DJ nutzen, schalte in der Game-Einrichtung den Schalter **Music DJ** ein („Use the Music DJ for this game instead of local music assets“). Standardmäßig ist er aus. Dann bekommst du dieselben Optionen **Spotify**, **YouTube** und **Custom** samt Feldern wie in Roleplay.

Mit Spotify stellt der Server nach jeder Szene aus deiner gewählten Quelle eine kurze Liste echter Songkandidaten zusammen, und die KI wählt einen davon. So kann sie sich keinen Song ausdenken. Der Game Mode spielt immer einen Song in Schleife. Für eine neue Auswahl zur aktuellen Szene öffnest du **Game controls** (Spielsteuerung) und wählst **Retry Music DJ**. Siehe [Die Bedienelemente des Spiels](../game/getting-started.md#the-games-controls).

<a id="the-conversation-music-command"></a>

## Der Music-Befehl in Conversation

In Conversation lässt sich Music DJ nicht als Agent hinzufügen. Charaktere spielen Songs stattdessen über den Befehl **Music** ab.

1. Öffne den Bereich **Commands** (Befehle) des Chats und schalte den Hauptschalter **Commands** ein.
2. Schalte **Music** ein („Let characters play songs through the active Music Player“).

Dann kann ein Charakter einen Song für Spotify nennen oder einen Titel für YouTube beschreiben, und Marinara spielt ihn über die aktive Quelle ab. Das klappt selbst dann, wenn Music DJ nirgends aktiviert ist. Nötig ist nur ein verbundenes Spotify oder ein gespeicherter YouTube-Key. Ist Spotify nicht verbunden oder fehlt die Wiedergabeberechtigung, bewirkt ein Spotify-Song-Befehl nichts und zeigt keinen Fehler an.

## Fehlerbehebung

- **Der Miniplayer fehlt**: Schalte **Music Player** unter **Settings → General → App Behavior** ein.
- **Spotify spielt nichts ab**: Die Wiedergabe braucht Spotify Premium und ein aktives Spotify-Gerät. Öffne die Desktop-App auf einem Gerät oder klick am Desktop auf **Enable Marinara player**.
- **Das Spotify-Login-Fenster schlägt auf einem anderen Rechner fehl**: Nutze das Einfügefeld unter „Browser couldn't reach the callback?“ oder setze `SPOTIFY_REDIRECT_URI` auf dem Server.
- **Die YouTube-Suche schlägt fehl**: Prüf, ob die **YouTube Data API v3** für dein Projekt aktiviert und der Key nicht nach HTTP-Referrer beschränkt ist. Ist das Tageskontingent erreicht, versuch es am nächsten Tag oder nimm einen anderen Key.
- **Eigene Musik aus einem Geräteordner spielt über Fernzugriff nicht ab**: Dieser Ordner braucht lokalen Zugriff auf dem Server. Siehe [Fernzugriff: Anmeldung und IP-Allowlist](../REMOTE_ACCESS.md).
- **Der Song-Befehl eines Charakters bewirkt in Conversation nichts**: Verbinde Spotify oder speichere einen YouTube-Key, und prüf, ob die Schalter **Commands** und **Music** an sind.

## Verwandte Anleitungen

- [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md)
- [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md)
- [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md)
- [Game Assets](../game/game-assets.md)
- [Conversation Mode: Erste Schritte](../conversation/getting-started.md)
