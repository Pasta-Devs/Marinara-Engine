# Audio- und Videoanrufe in Conversation

In dieser Anleitung erfährst du, wie Anrufe in Conversation funktionieren, wie du einen Anruf einrichtest, wie du während eines Anrufs sprichst und wie du typische Probleme löst.

Anrufe gibt es ausschließlich im Conversation Mode. Roleplay- und Game-Chats haben keinen Anrufbildschirm.

Calls ist ein optionales Agent-Paket. Installiere **Calls** über **Agents → Download Agents** (Agenten herunterladen), bevor du die Einrichtung unten durchgehst, und starte Marinara neu, sobald der Katalog dich dazu auffordert.

## Was ein Anruf ist

Ein Anruf öffnet einen Live-Bildschirm im Discord-Stil, auf dem du mit einem oder mehreren Charakteren sprichst. Während der Anruf läuft, liegt er über dem normalen Conversation-Chat.

Während eines Anrufs gilt:

- Charaktere mit einer funktionierenden Text to Speech (TTS)-Stimme sprechen ihre Zeilen hörbar aus. Text to Speech bedeutet Sprachausgabe: Text wird in gesprochenen Ton umgewandelt.
- Charaktere ohne Stimme antworten als geschriebene Nachricht im Anruf-Chat.
- Du antwortest per Mikrofon oder tippst.
- Auf Wunsch siehst du statt eines Standbilds einen KI-generierten Videoclip in Dauerschleife.

Ein Anruf ist kein Peer-to-Peer-Telefonat. Marinara nimmt Mikrofon oder Kamera im lokalen Browser auf. Diese Eingabe geht an das Modell, das du für diese Conversation ausgewählt hast. Die Antworten spricht der TTS-Anbieter, und alle Anrufdaten bleiben auf dem eigenen Rechner.

Endet der Anruf, schreibt Marinara eine kurze Zusammenfassung des Audioanrufs zurück in die normale Conversation. Das vollständige Anrufprotokoll bleibt in einem eigenen Anrufspeicher und wandert nicht Nachricht für Nachricht in den Hauptchat.

## Bevor du loslegst

Für einen funktionierenden Sprachanruf richtest du diese Bausteine der Reihe nach ein. Die mit „Optional“ markierten Schritte kannst du überspringen.

1. Ein Chat im Conversation Mode mit mindestens einem Charakter.
2. Eine normale Modell-Verbindung, die für diesen Chat ausgewählt ist. Dieses Modell schreibt während des Anrufs die Charakterantworten.
3. **Audio/Video Calls** (Audio- und Videoanrufe) für diesen Chat aktiviert, siehe den Abschnitt „Anrufe für einen Chat aktivieren“ weiter unten.
4. **Call Audio Pipeline** aktiviert. Ohne diese Einstellung startet kein Anruf, selbst wenn du nur tippst oder nur zuhörst. Sie schaltet außerdem die Mikrofoneingabe frei.
5. Text to Speech eingerichtet, damit Charaktere sprechen können. Ohne TTS nimmt jeder Charakter nur per Text teil.
6. Optional: Local Whisper, nach der Installation von Calls über Connections heruntergeladen, falls der Browser keine zuverlässige Spracherkennung bietet (bei Firefox nötig). Oder statt Local Whisper ein eigener Speech-to-Text-Server.
7. Optional: eine Video-Verbindung und generierte Clips, wenn du **Character Video Presence** nutzen willst.
8. Optional: eine Bild-Verbindung als Selfie Connection des Chats, wenn Charaktere im Anruf Selfies schicken sollen.

### Text to Speech einrichten

Text to Speech legt fest, welche Charaktere sprechen können und welche Stimme sie dabei nutzen. Weil die Funktion auch anderswo greift, hat sie eine eigene Anleitung.

Die komplette Schritt-für-Schritt-Beschreibung findest du unter [Text to Speech (TTS) einrichten](../media/tts-setup.md). Kurz gefasst: Öffne **Connections** (Verbindungen) und dann **Text to Speech**. Danach gehst du so vor:

1. Schalte Text to Speech ein.
2. Wähle eine Quelle: **OpenAI-compatible**, **ElevenLabs**, **PocketTTS** oder **xAI Voice**.
3. Trage den Anbieter-Key oder die lokale Serveradresse für diese Quelle ein.
4. Wähle ein Modell und eine Stimme.
5. Stell **Voice Option** auf **One voice for all characters** oder **Selected per character**.
6. Speichere und prüfe über die Vorschau-Schaltfläche, ob du Ton hörst.

In einem Gruppenanruf machen eigene Stimmen pro Charakter das Zuordnen deutlich leichter. Findet Marinara für einen Charakter keine Stimme, nimmt dieser Charakter nur per Text am Anruf teil.

### Eingabemodus für das Mikrofon wählen

Ist **Call Audio Pipeline** aktiv, erscheint das Dropdown-Menü **Audio input mode** (Audio-Eingabemodus) mit vier Optionen. Wähle die Option, die zu Browser und Anbieter passt.

- **Mic recording + Local Whisper**: nimmt auf, solange du nicht stummgeschaltet bist, ignoriert Stille und wandelt Sprache auf dem eigenen Rechner in Text um. Das ist der Standard und die beste Wahl für Firefox.
- **Browser speech recognition**: nutzt die Web-Speech-Funktion des Browsers. Die Web Speech API ist ein eingebautes Browser-Werkzeug, das Sprache in Text umwandelt. Wie gut sie funktioniert, hängt vom Browser ab; fehlt sie, greift Marinara auf Local Whisper zurück.
- **Manual system dictation**: setzt lediglich den Cursor in das Anruf-Textfeld, damit die Diktierfunktion des Betriebssystems dort schreiben kann. In diesem Modus nimmt Marinara das Mikrofon nicht selbst auf.
- **Provider-native audio/video**: schickt die aufgenommene Audio- oder Videospur direkt an das Conversation-Modell, sofern das Modell Medien unmittelbar verarbeitet. Kann es das nicht, nimm stattdessen Local Whisper oder die Browser-Spracherkennung.

Die Schaltflächen für Kamera und Bildschirm tauchen nur auf, wenn **Camera and screen input** aktiv ist. Sie funktionieren ausschließlich im Modus **Provider-native audio/video**. In allen anderen Modi sind sie zwar sichtbar, aber ausgegraut.

### Local Whisper herunterladen

Local Whisper wandelt Sprache direkt auf dem Rechner in Text um, auf dem Marinara läuft. Für die Transkription verlässt das Mikrofon-Audio diesen Rechner nie. Der entstandene Text geht anschließend trotzdem als Teil des Anrufs an das Conversation-Modell.

Local Whisper gehört zum Calls-Paket und ist der zuverlässigste Mikrofonweg für Browser mit schwacher Sprachunterstützung, Firefox eingeschlossen. Öffne nach der Installation von Calls **Connections**, dann **Local Model**, klapp die Karte auf und suche **Local Speech Model**. Ohne installiertes Calls bleibt dieser Bereich verborgen. Mehr zur Local-Model-Karte allgemein findest du unter [Local Model einrichten](../connections/local-model.md).

1. Wähle ein Modell. **Whisper Tiny (Multilingual)** ist der Standard. Der Download umfasst rund 180 MB, im Betrieb belegt das Modell etwa 350 MB Arbeitsspeicher. Für Handys und ältere Rechner ist es die beste erste Wahl.
2. Oder nimm **Whisper Base (Multilingual)** für bessere Treffer bei undeutlicher Sprache. Der Download umfasst rund 320 MB, im Betrieb belegt das Modell etwa 650 MB.
3. Klick auf **Download Whisper**.
4. Warte, bis der Fortschrittsbalken durchgelaufen ist.

Nach dem Download erscheint das Bedienelement **Delete Local Whisper** (Papierkorb-Symbol), falls du das Modell wieder entfernen willst.

Beim Deinstallieren von Calls verschwinden auch alle heruntergeladenen Whisper-Modelle samt gespeicherter Auswahl. Der belegte Speicherplatz wird damit frei. Eine erneute Installation bringt die Download-Bedienelemente zurück, lädt aber erst wieder ein Modell, wenn du eines auswählst.

<a id="use-your-own-speech-to-text-server"></a>

### Eigenen Speech-to-Text-Server verwenden

Kommt Local Whisper mit deiner Sprache oder deinem Akzent schlecht zurecht, kannst du deine aufgenommene Stimme stattdessen an ein anderes Speech-to-Text-Modell schicken. Das klappt mit jedem Server, der den Endpunkt `/audio/transcriptions` im OpenAI-Stil anbietet. Dazu gehören selbst gehostete Server wie Speaches, faster-whisper-Server, LocalAI und der whisper.cpp-Server (gestartet mit `--inference-path /v1/audio/transcriptions`), aber auch Anbieter wie OpenAI oder Groq.

1. Installiere Calls, öffne dann **Connections** und such die Karte **Speech to Text** (Spracherkennung). Solange Calls nicht installiert ist, bleibt die Karte verborgen.
2. Klapp die Karte auf und trag die **Server URL** ein, zum Beispiel `http://localhost:8000/v1` für einen Server auf dem eigenen Rechner.
3. Trag einen **API key** (API-Key) ein, falls dein Server oder Anbieter einen verlangt. Er wird verschlüsselt gespeichert, und die Karte zeigt ihn nur maskiert an.
4. Trag unter **Model** (Modell) den Modellnamen ein, den dein Server verwendet. Bleibt das Feld leer, sendet Marinara `whisper-1`.
5. Optional: Trag unter **Language** (Sprache) einen Sprachcode ein, etwa `pl` oder `de`. Gibst du dem Modell deine Sprache vor, transkribiert es meist genauer. Bleibt das Feld leer, ermittelt der Server die Sprache selbst.
6. Klick auf **Test**. Marinara schickt einen einsekündigen stillen Clip und zeigt dir, ob der Server geantwortet hat.
7. Schalte die Karte über ihren Schalter ein.

Solange der Schalter an ist, schickt **Mic recording + Local Whisper** deine Sprache an diesen Server statt an Local Whisper. Local Whisper musst du dafür nicht herunterladen. Schaltest du den Schalter wieder aus, übernimmt erneut Local Whisper. Deine Aufnahmen gehen an den Server, den du eingetragen hast – nutze also nur einen Server, dem du vertraust.

Ein Server auf demselben Rechner wie Marinara funktioniert ohne Weiteres. Ein Server auf einem anderen Rechner in deinem Heimnetz wird abgelehnt, solange du nicht `STT_LOCAL_URLS_ENABLED=true` in der `.env`-Datei von Marinara setzt. Siehe [Referenz zur Server-Konfiguration](../CONFIGURATION.md).

Dafür brauchst du eine Calls-Version, die diese Funktion unterstützt. Nutzen Anrufe nach dem Einschalten weiterhin Local Whisper, aktualisiere Calls über **Agents → Download Agents**.

## Anrufe für einen Chat aktivieren

Anrufe lassen sich schon beim Anlegen einer neuen Conversation aktivieren oder später über die Chat-Einstellungen.

Bei einer neuen Conversation schließt du zuerst den Einrichtungsassistenten ab, öffnest dann die Einstellungen dieses Chats und gehst die Schritte unten durch. Die Einstellungen der optionalen Pakete erscheinen erst, wenn Calls installiert ist.

Bei einer bestehenden Conversation:

1. Öffne den Chat.
2. Öffne **Chat Settings** (Chat-Einstellungen).
3. Wechsle in den Bereich **Agents**.
4. Öffne **Calls**.
5. Aktiviere **Audio/Video Calls**. Neben dem Namen der Conversation erscheint nun eine Anruf-Schaltfläche.
6. Aktiviere **Call Audio Pipeline**. Ohne diese Einstellung startet kein Anruf, auch wenn du nie ein Mikrofon benutzt.
7. Wähle einen **Audio input mode**.

**Audio/Video Calls** und der Befehl **Calls** sind zwei verschiedene Einstellungen. **Audio/Video Calls** blendet die Anruf-Schaltfläche ein, mit der du einen Charakter anrufst. Der Befehl **Calls** erlaubt Charakteren, dich von sich aus anzurufen. Schaltest du **Calls** ab, kannst du weiterhin selbst anrufen, aber Charaktere sollten keine eingehenden Anrufe mehr starten.

Im Bereich **Agents** sitzt außerdem ein übergeordneter Schalter **Commands**, sobald ein Paket mit Befehlen installiert ist. Er muss aktiv sein, damit versteckte Befehle im Anruf greifen. Der Anruf selbst startet auch ohne ihn.

### Einstellungen und Standardwerte

Die meisten Anruf-Einstellungen liegen unter **Chat Settings**, dann **Agents**, dann **Calls**. Einige davon gelten global: Änderst du sie in einem Chat, ändern sie sich für jeden Conversation-Anruf in der App.

| Einstellung | Geltungsbereich | Standard |
|---|---|---|
| **Audio/Video Calls** | Pro Chat | Off |
| **Calls** (Befehl) | Pro Chat | On |
| **Generate voice cues in [tags]** | Pro Chat | On |
| **Call Audio Pipeline** | Global | Off |
| **Audio input mode** | Global | Mic recording + Local Whisper |
| **Camera and screen input** | Global | Off |
| **Character video presence** | Global | Off |
| **Automatic video clips generation** | Global | Off |
| **Custom clips** | Global | Off |

**Generate voice cues in [tags]** bittet das Modell, kurze Hinweise in eckigen Klammern in gesprochene Zeilen einzubauen, etwa `[whispering]`, `[laughing]` oder `[sighs]`. Diese Hinweise prägen den Vortrag der TTS und helfen bei der Auswahl passender Reaktionsclips. Standardmäßig ist die Einstellung aktiv. Schalte sie ab, wenn gesprochene Zeilen schlicht bleiben sollen.

## Anruf starten, annehmen und beenden

### Einen Anruf starten

Sind Anrufe für einen Chat aktiv, erscheint neben dem Namen der Conversation eine Telefon-Schaltfläche. Ihr Tooltip (Kurzhinweis beim Draufzeigen) lautet **Start call**, solange kein Anruf läuft, und **Open call**, wenn bereits einer aktiv ist.

Klick auf **Start call**. Der vollständige Anrufbildschirm öffnet sich sofort.

Pro Chat kann immer nur ein Anruf aktiv sein oder klingeln. Startest du einen Anruf, während schon einer läuft, öffnet Marinara den laufenden Anruf erneut, statt einen neuen anzulegen.

### Eingehende Anrufe von Charakteren

Ein Charakter kann dich anrufen, sofern der Befehl **Calls** aktiv ist. Passiert das, während du in diesem Chat bist, erscheint über dem Nachrichtenfeld das Banner **Incoming call**. Im Banner liegen die Schaltflächen **Decline call** und **Answer call**.

Bist du gerade woanders in Marinara unterwegs, erscheint eine Benachrichtigung über den eingehenden Anruf, ähnlich der Benachrichtigung bei einer autonomen Nachricht. Dazu ertönt ein kurzer Klingelton. Marinara nimmt niemals für dich ab, du musst also selbst auf **Answer call** klicken.

Nur gerade verfügbare Charaktere nehmen an einem Anruf teil. Markiert ein Zeitplan oder ein Status einen Charakter als offline, bleibt er dem Anruf fern, obwohl er zum Chat gehört.

### Einen Anruf beenden

Über die rote Schaltfläche **End call** beendest du einen Anruf jederzeit. Sie liegt auf dem Anrufbildschirm und im verkleinerten Mini-Fenster. Auch ein Charakter kann den Anruf per Befehl verlassen oder beenden.

Endet der Anruf, stoppt Marinara die Aufnahme, schließt die Medien sauber und fügt der normalen Conversation eine Karte hinzu.

## Anrufbildschirm und Bedienelemente

Die Anruf-Bühne zeigt eine Kachel pro Teilnehmer, also deine Persona und jeden verfügbaren Charakter. Wer gerade spricht, wird hervorgehoben.

Der Anruf-Chat sammelt getippte Nachrichten und Textantworten von Charakteren. Am Desktop sitzt er in einem seitlichen Panel. Auf dem Handy versteckt er sich hinter der Schaltfläche **Open call chat**. Der Chat öffnet sich dann über die volle Fläche, und mit **Close call chat** schließt du ihn wieder. Gesprochene Zeilen dienen dem Ton und tauchen nicht zusätzlich als eigene Chatblasen auf.

Die Eingabezeile im Anruf besteht aus dem Feld **Message in call** und der Schaltfläche **Send**. Dazu kommen eine Auswahl für Emojis, GIFs und Sticker sowie ein schneller Verbindungswechsler. Datei-Anhänge unterstützt der Anruf-Chat bisher nicht.

Die Steuerleiste am unteren Rand der Bühne enthält Symbol-Schaltflächen:

- Mikrofon: schaltet dich stumm oder wieder frei. Der Tooltip richtet sich nach dem Eingabemodus, etwa **Unmute microphone with Local Whisper**.
- **Turn camera on** und **Turn camera off**: nur im Modus **Provider-native audio/video** mit aktivem **Camera and screen input** nutzbar.
- **Share screen** und **Stop sharing screen**: dieselbe Regel wie bei der Kamera.
- **Character volume**: öffnet ein Popover (kleines Einblendfenster) mit Stummschalter und einem Lautstärkeregler von 0 bis 100. Der Standard liegt bei 100 Prozent, deine Wahl merkt sich der Browser.
- **Soundboard**: öffnet eine Liste von Klängen samt Bedienelement **Upload**.
- **End call**: die rote Auflegen-Schaltfläche.

Bleibst du längere Zeit stummgeschaltet, erscheint ein Hinweis: „You are muted! Remember to unmute yourself first if you want to talk.“

Verlässt du die Conversation, während ein Anruf läuft, schrumpft er zu einem kleinen schwebenden Mini-Fenster. Darin stehen der Chatname, die bisherige Dauer und eine rote Schaltfläche **End call**. Ein Klick auf das Mini-Fenster bringt dich zurück zum vollen Anrufbildschirm. Marinara hält den Anruf am Laufen, während du dich durch andere Panels bewegst.

### Soundboard

Das Soundboard ist eine kleine Sammlung von Klängen, die du in jedem Anruf abspielen kannst. Standardmäßig sind vier Klänge dabei: **Soft Chime**, **Tap**, **Sparkle** und **Pop**. Diese eingebauten Klänge lassen sich nicht löschen.

Eigene Klänge lädst du über die Schaltfläche **Upload** hoch. Erlaubt sind mp3, wav, ogg, webm und m4a mit jeweils bis zu 8 MB. Selbst hochgeladene Klänge haben ein Bedienelement zum Löschen. Auch Charaktere können per Soundboard-Befehl einen Klang abspielen.

## Character Video Presence und Videoclips für Anrufe

**Character Video Presence** ersetzt die Kachel mit dem Standbild-Avatar durch einen KI-generierten Videoclip des Charakters in Dauerschleife. Standardmäßig ist die Funktion aus. Der zugehörige Schalter heißt **Character video presence** und liegt unter **Chat Settings**, dann **Agents**, dann **Calls**.

So richtest du Videoclips für Anrufe ein:

1. Lege unter **Settings** (Einstellungen), dann **Connections**, eine Verbindung für die Videogenerierung an.
2. Markiere eine Verbindung als **Default for Videos** oder wähle bei jeder Generierung eine Video-Verbindung aus.
3. Öffne den Editor eines Charakters oder einer Persona.
4. Öffne den Tab **Sprites** und darin den Unter-Tab **Clips**.
5. Erzeuge über **Generate Clips** oder **Upload extra** die gewünschten Clips.

Mehr zu Sprites und zum Editor findest du unter [Charakter-Sprites (Gesichtsausdrücke und Ganzkörper)](../characters/sprites.md).

Die Schaltfläche **Generate Clips** öffnet das Fenster **Generate Call Clips**. Dort wählst du eine **Video Generation Connection** und entscheidest über **Use avatar as reference**. Anschließend legst du fest, welche Standardclips entstehen sollen. Zusätzlich kannst du einen eigenen Clip mit **Clip name** und einer Beschreibung der Handlung definieren.

Es gibt sechs Standard-Cliptypen: **Idle**, **Talking**, **Laughing**, **Angry**, **Crying** und **Sighing**. Spricht ein Charakter, liest Marinara die Stimmhinweise in der Zeile mit, etwa `[sighs]` oder `[laughs]`. Passend dazu läuft ein Reaktionsclip, danach kehrt der Charakter zu Idle zurück.

Ist **Character video presence** aktiv, erscheinen darunter zwei weitere Schalter:

- **Automatic video clips generation**: standardmäßig aus. Aktiv erzeugt Marinara nur die beiden Basisclips **Idle** und **Talking** für Anrufteilnehmer, denen sie fehlen. Reaktionsclips und eigene Clips entstehen nie automatisch; die legst du von Hand im Unter-Tab **Clips** an.
- **Custom clips**: standardmäßig aus. Aktiv darf ein Charakter in seltenen Fällen während eines laufenden Anrufs einen einmaligen Clip anfordern und einen fertigen eigenen Clip später erneut abspielen. Gedacht ist das für besondere visuelle Wünsche, nicht für jede Stimmung und jede Zeile.

Fehlende Clips blockieren einen Anruf nie. Der Charakter zeigt dann einfach das Standbild, bis ein Clip bereitsteht. Kürzt du einen Clip, läuft die Schleife innerhalb des gesetzten Ausschnitts.

Schaltest du **Character video presence** ab, gehen auch **Automatic video clips generation** und **Custom clips** aus.

Videoclips für Anrufe sind etwas anderes als die **Videos** in der Galerie. Dort liegen Szenenvideos aus Roleplay-, Game- oder Conversation-Chats. Im Unter-Tab **Clips** liegen dagegen die hier beschriebenen, wiederverwendbaren Präsenz-Schleifen.

## Versteckte Befehle im Anruf

Charaktere nutzen im Anruf dieselben versteckten Befehle in eckigen Klammern wie in normalen Conversation-Nachrichten. Jeder Befehl braucht seinen passenden Schalter unter **Chat Settings → Agents**, und der übergeordnete Schalter **Commands** in diesem Bereich muss aktiv sein. Die Befehle laufen still ab, werden nie gesprochen und nie als Text angezeigt.

- **Selfies**: Ein Charakter erzeugt ein Foto und schickt es in den Anruf-Chat. Dafür braucht der Chat eine gesetzte **Selfie Connection**. Siehe [Selfies](selfies.md).
- **Memories**: Ein Charakter speichert eine Erinnerung über einen anderen Charakter, gestützt auf den Anruf.
- **Music**: Ein Charakter spielt einen Song über den Music Player ab, sofern eine Musikquelle verbunden ist.
- **Haptics**: Ein Charakter steuert in intimen Momenten ein verbundenes haptisches Gerät an, sofern eines angeschlossen ist.
- **Reactions**: Ein Charakter reagiert mit einem Emoji auf deine letzte getippte Nachricht im Anruf.
- **Cross-Post**: Ein Charakter trägt das aktuelle Thema in eine andere gemeinsame Conversation.
- **Schedule Updates**: Ein Charakter ändert eine Zeit lang seinen eigenen Status – online, inaktiv, bitte nicht stören oder offline – samt Tätigkeit und kehrt danach zu seinem Zeitplan zurück. Siehe [Charakter-Zeitpläne und autonome Nachrichten](schedules.md#characters-can-change-their-own-status).
- **Notes** und **Influence**: Diese speichern eine dauerhafte Notiz oder einen einmaligen Anstoß und erscheinen nur, wenn für den Chat ein verbundener Chat eingerichtet ist.
- **Soundboard**: Ein Charakter spielt einen der Soundboard-Klänge des Anrufs ab.
- Verlassen und Beenden: Ein Charakter kann den Anruf allein verlassen oder ihn für alle beenden.

Manche Befehle hinterlassen einen kleinen Systemeintrag im Anruf-Chat. Bei einem Selfie steht dort etwa „sent a selfie“ samt Bild, und bei einem eigenen Clip erscheint ein Platzhalter, solange der Clip noch rendert.

## Die Zusammenfassung nach dem Anruf

Endet ein Anruf, fügt Marinara dem normalen Conversation-Verlauf eine Karte hinzu. Sie zeigt den Status des Anrufs. Diese Titel können auftauchen:

- **Call Started**
- **Incoming Call**
- **Call Ended**, mit der Dauer des Anrufs
- **Call Declined**
- **Missed Call**

Nach einer **Call Ended**-Karte erstellt Marinara im Hintergrund eine kurze Zusammenfassung des Audioanrufs, sofern etwas Nennenswertes passiert ist. Diese Zusammenfassung landet als verborgener Kontext in der Conversation, den das Modell lesen kann. So weiß das Modell, worum es ging, ohne dass der ganze Anruf im sichtbaren Chat steht.

Das ausführliche Anrufprotokoll bleibt im eigenen Anrufspeicher. Zurück in den normalen Chat fließt nur die kurze Zusammenfassung.

## Fehlerbehebung

### Der Anruf startet nicht und meldet, das Anruf-Audio sei nicht aktiviert

Klickst du auf **Start call** und liest „Conversation call audio is not enabled in Chat Settings“, dann aktiviere **Call Audio Pipeline**. Öffne dazu **Chat Settings**, dann **Agents**, dann **Calls**, und schalte die Einstellung ein. Sie ist für jeden Anruf nötig, auch für einen, in dem du nur tippst. Sie gilt global: Einmal aktiviert, greift sie für alle Conversation-Anrufe.

### Ich höre die Charaktere, aber sie hören mich nicht

Öffne **Chat Settings**, dann **Agents**, dann **Calls**, und prüfe, ob **Call Audio Pipeline** aktiv ist. Prüfe anschließend, ob der Browser der Marinara-Seite Zugriff auf das Mikrofon erlaubt hat.

Nutzt du Firefox oder klappt die Browser-Spracherkennung nicht, installiere Calls und lade Local Whisper herunter. Öffne **Connections**, dann **Local Model**, dann **Local Speech Model**. Wähle danach **Mic recording + Local Whisper**.

### Local Whisper meldet, es sei nicht verfügbar

Local Whisper braucht die native ONNX-Laufzeit für deine Plattform. ONNX ist die Engine, die das lokale Sprachmodell ausführt. Wurde das Modell für einen anderen Node-Build eingerichtet, installiere die Abhängigkeiten mit demselben Node-Build neu, mit dem du Marinara startest, und starte anschließend neu.

Läuft bei dir ein „Lite“-Build von Marinara, ist Local Whisper darin abgeschaltet. Die App meldet: „Local Whisper is disabled in Lite mode. Use a full Marinara install to download and run the local speech model.“ Für Local Whisper brauchst du eine vollständige Installation.

### Die Browser-Spracheingabe tut nichts

Die Browser-Spracherkennung hängt davon ab, was der Browser unterstützt. Firefox bietet die Web-Speech-Erkennung nicht in derselben Form wie Chromium- und Safari-Browser. Nimm **Mic recording + Local Whisper** für freihändiges Aufnehmen oder **Manual system dictation**, um mit der Diktierfunktion des Betriebssystems zu schreiben.

### Ein Charakter tippt nur, statt zu sprechen

Prüfe die Text-to-Speech-Einstellungen und die zugewiesenen Stimmen. Der Charakter braucht entweder die eine globale Stimme oder eine eigene Stimme, die der TTS-Anbieter auflösen kann. Siehe [Text to Speech (TTS) einrichten](../media/tts-setup.md).

### Das Modell versteht meine Sprache falsch

Probier **Whisper Base (Multilingual)** statt Whisper Tiny, das trifft genauer. Reduziere Hintergrundgeräusche und Musik. Unterstützt dein Modell es, stell **Audio input mode** auf **Provider-native audio/video**, damit das Modell den Ton direkt hört. Kommt Whisper mit deiner Sprache schlecht zurecht, [nutze einen eigenen Speech-to-Text-Server](#use-your-own-speech-to-text-server) mit einem Modell, das sie beherrscht, und trag dort unter **Language** ihren Sprachcode ein.

### Der Test unter Speech to Text schlägt fehl

Lies die Meldung unter der Schaltfläche **Test**. „Could not reach the speech-to-text server“ bedeutet, dass die Adresse falsch ist oder der Server nicht läuft. Nennt die Meldung `STT_LOCAL_URLS_ENABLED`, steht der Server auf einem anderen Rechner in deinem Netzwerk; setze diese Variable dann in der `.env` auf `true`. Eine Zahl wie 401 oder 404 stammt von deinem Server: 401 bedeutet meist einen falschen API-Key, 404 eine falsche Adresse oder einen falschen Modellnamen.

### Die Schaltfläche für Kamera oder Bildschirm ist ausgegraut

Diese Schaltflächen greifen nur im Modus **Provider-native audio/video** mit aktivem **Camera and screen input**. Stell den **Audio input mode** um, aktiviere **Camera and screen input** und versuch es erneut. Nützlich sind die Schaltflächen ohnehin nur, wenn das Modell Kamera- oder Bildschirmeingaben wirklich verarbeiten kann.

### Der Anruf funktioniert auf dem Handy nicht

Auf dem Handy öffnest du den Anruf-Chat mit **Open call chat** und schließt ihn mit **Close call chat**. Spricht ein Charakter nicht, prüfe die Einrichtung von Text to Speech. Bei Mikrofonproblemen gelten dieselben Schritte zu Local Whisper und Berechtigungen wie oben.

### Ein Charakter antwortet mitten im Anruf nicht mehr

Charaktere antworten nur, solange die für den Chat gewählte Modell-Verbindung funktioniert. Bleiben Antworten aus, prüfe diese Verbindung und schick danach erneut eine Nachricht im Anruf-Chat.

## Verwandte Anleitungen

- [Text to Speech (TTS) einrichten](../media/tts-setup.md)
- [Local Model einrichten](../connections/local-model.md)
- [Charakter-Sprites (Gesichtsausdrücke und Ganzkörper)](../characters/sprites.md)
- [Conversation Mode: Erste Schritte](getting-started.md)
