# Audio- und Videoanrufe in Conversation

Ein Anruf ist ein Live-Bildschirm, wie in einer Voice-Chat-App, in dem du per Mikrofon oder Tippen mit einem oder mehreren Charakteren sprichst. Er liegt über dem normalen Conversation-Chat, solange er läuft. Anrufe gibt es nur in Conversation Mode.

Anrufe sind ein optionales Paket. Installiere **Calls** über **Agents → Agent Organizer**. Fordert der Katalog dich zu einem Neustart auf, stoppe Marinara und starte es so wieder, wie du es normalerweise startest (siehe [Installation](../INSTALLATION.md)).

Während eines Anrufs sprechen Charaktere mit einer funktionierenden Text-to-Speech-Stimme (TTS, Text wird in gesprochenes Audio umgewandelt) laut. Charaktere ohne Stimme antworten als getippte Nachrichten im Anruf-Chat. Du kannst auch wiederholte KI-Videoclips eines Charakters statt eines Standbilds zeigen.

Marinara nimmt dein Mikrofon oder deine Kamera in deinem Browser auf. Je nach Eingabemodus (unten) wird deine Sprache auf deinem eigenen Rechner in Text umgewandelt oder an das Modell gesendet, das du gewählt hast. Antworten werden über deinen TTS-Dienst gesprochen. Endet der Anruf, geht eine kurze Zusammenfassung zurück in die Conversation. Das vollständige Transkript bleibt in einem eigenen Anrufspeicher.

## Was du brauchst

- **Calls** installiert.
- Ein Conversation-Chat mit mindestens einem Charakter und ein Konto für das Modell, das Antworten schreibt.
- **Audio/Video Calls** und **Call Audio Pipeline** in den Einstellungen des Chats eingeschaltet.
- Optional: ein Text-to-Speech-Konto, damit Charaktere sprechen. Ohne es antworten sie als Text.
- Optional: Das Standard-Mikrofon braucht einen einmaligen Download von Local Whisper (siehe [Local Whisper herunterladen](#download-local-whisper)). Du kannst stattdessen im Anruf-Chat tippen.

## Deinen ersten Anruf einrichten

Bevor du anfängst: Du brauchst einen Conversation-Chat mit mindestens einem Charakter und ein Konto für das Modell, das die Antworten schreibt (siehe [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md)).

1. Optional: Richte Text to Speech ein (siehe [Text to Speech einrichten](#set-up-text-to-speech)). Ohne es treten alle Charaktere nur als Text bei.
2. Öffne den Chat und dann **Chat Settings → Agents → Calls**.
3. Schalte **Audio/Video Calls** an. Neben dem Namen der Conversation erscheint eine Anruf-Schaltfläche.
4. Schalte **Call Audio Pipeline** an. Ohne sie startet kein Anruf, auch wenn du nur tippst oder zuhörst. Sie schaltet außerdem das Mikrofon frei.
5. Wähle einen **Audio input mode** (unten).
6. Klicke auf **Start call**.

Wenn es nicht funktioniert hat: Siehst du „Conversation call audio is not enabled in Chat Settings“, ist **Call Audio Pipeline** aus. Es ist eine globale Einstellung, also schaltet sie das Einschalten in einem Chat für alle Conversation-Anrufe ein.

Schließe bei einem neuen Chat zuerst den Einrichtungsassistenten ab und öffne dann die **Chat Settings** dieses Chats. Die Einstellungen für Calls erscheinen nur, wenn Calls installiert ist.

Zwei Schalter sehen ähnlich aus, tun aber Verschiedenes:

- **Audio/Video Calls** zeigt die Anruf-Schaltfläche, damit du einen Charakter anrufen kannst.
- Der Befehl **Calls** lässt Charaktere dich zuerst anklingeln. Ist er aus, kannst du weiterhin selbst Anrufe starten.

Der Hauptschalter **Commands** im selben Bereich muss für Befehle im Anruf an sein. Der Anruf selbst kann damit auch aus starten.

<a id="set-up-text-to-speech"></a>

### Text to Speech einrichten

Text to Speech legt fest, welche Charaktere mit welcher Stimme sprechen können. Lies [Text to Speech (TTS) einrichten](../media/tts-setup.md) für die vollständige Anleitung. Kurz gefasst: Öffne **Connections**, klicke auf **Add account** und wähle **Text to speech**. Steht es schon unter **On this device**, öffne es dort. Dann:

1. Schalte Text to Speech an.
2. Wähle eine Quelle: **OpenAI-compatible**, **ElevenLabs**, **PocketTTS** oder **xAI Voice**.
3. Gib den API-Key oder die lokale Serveradresse für diese Quelle ein.
4. Wähle ein Modell und eine Stimme.
5. Setze **Voice option** auf **One voice for all** oder **Selected per character or persona**. Stimmen pro Charakter machen Gruppenanrufe leichter zu verfolgen.
6. Speichere und prüfe dann mit der Vorschau-Schaltfläche, dass du Audio hörst.

Findet Marinara für einen Charakter keine Stimme, die es auflösen kann, nimmt dieser Charakter nur als Text am Anruf teil.

### Einen Audio input mode wählen

Ist **Call Audio Pipeline** an, listet **Audio input mode** vier Optionen. Bist du unsicher, behalte den Standard.

| Modus | Was er bewirkt |
| --- | --- |
| **Mic recording + Local Whisper** (Standard) | Nimmt auf, solange du nicht stummgeschaltet bist, ignoriert Stille und wandelt deine Sprache auf deinem Rechner in Text um. Am besten für Firefox. |
| **Browser speech recognition** | Nutzt das Sprachwerkzeug deines Browsers. Die Unterstützung variiert. Marinara fällt auf Local Whisper zurück, wenn es fehlt. |
| **Manual system dictation** | Setzt nur den Cursor in das Anruf-Textfeld, damit die Diktierfunktion deines Betriebssystems dort tippen kann. Marinara nimmt nicht auf. |
| **Provider-native audio/video** | Sendet dein aufgenommenes Audio oder Video direkt an das Modell, wenn das Modell Medien akzeptiert. |

Die Kamera- und Bildschirm-Schaltflächen brauchen **Camera and screen input** an und funktionieren nur im Modus **Provider-native audio/video**. In anderen Modi sind sie sichtbar, bleiben aber deaktiviert.

## Einen Anruf starten, annehmen und beenden

**Einen Anruf starten.** Mit eingeschalteten Anrufen sitzt neben dem Namen der Conversation eine Telefon-Schaltfläche. Ihr Tooltip lautet **Start call**, oder **Open call**, wenn ein Anruf läuft. Klicke darauf oder auf die Anrufbildschirm-Schaltflächen. Pro Chat kann nur ein Anruf aktiv oder klingelnd sein. Einen weiteren zu starten öffnet den aktuellen erneut.

**Einen Anruf annehmen.** Ein Charakter kann dich anklingeln, wenn der Befehl **Calls** an ist. In diesem Chat erscheint über dem Nachrichtenfeld ein Banner **Incoming call** mit **Decline call** und **Answer call**. Anderswo in Marinara bekommst du eine Benachrichtigung über einen eingehenden Anruf und einen kurzen Klingelton. Marinara nimmt nie für dich ab. Nur verfügbare Charaktere treten bei: Ein Charakter, dessen Zeitplan oder Status offline ist, tut es nicht.

**Einen Anruf beenden.** Klicke auf die rote Schaltfläche **End call** auf dem Anrufbildschirm oder im minimierten Popout. Ein Charakter kann den Anruf auch mit einem Befehl im Anruf verlassen oder beenden. Marinara stoppt dann die Aufnahme und fügt der Conversation eine Karte hinzu.

## Der Anrufbildschirm

Die Bühne zeigt pro Teilnehmer eine Kachel, deine Persona und jeden verfügbaren Charakter, und hebt hervor, wer spricht. Der Anruf-Chat enthält getippte Nachrichten und Antworten nur als Text. Gesprochene Zeilen werden nicht wiederholt. Auf dem Desktop ist er ein Seitenpanel. Auf einem Handy öffnet er sich als Schublade mit **Open call chat** und schließt sich mit **Close call chat**.

Das Eingabefeld im Anruf hat ein Feld **Message in call**, **Send**, eine Auswahl für Emojis, GIFs und Sticker und einen schnellen Modellwechsler. Dateianhänge werden im Anruf-Chat nicht unterstützt.

| Steuerung | Was sie bewirkt |
| --- | --- |
| Mikrofon | Schaltet stumm oder hebt die Stummschaltung auf. Der Tooltip wechselt je nach Modus, zum Beispiel **Unmute microphone with Local Whisper**. |
| **Turn camera on** / **Turn camera off** | Nur im Modus Provider-native audio/video mit **Camera and screen input** an. |
| **Share screen** / **Stop sharing screen** | Dieselbe Regel wie bei der Kamera. |
| **Character volume** | Eine Stummschalt-Schaltfläche und ein Regler von 0 bis 100. Standard 100, im Browser gespeichert. |
| **Soundboard** | Eine Liste von Tönen mit einer Steuerung **Upload**. |
| **End call** | Die rote Auflegen-Schaltfläche. |

Bleibst du eine Weile stummgeschaltet, siehst du „You are muted! Remember to unmute yourself first if you want to talk.“

Verlässt du die Conversation während eines Anrufs, schrumpft sie zu einem schwebenden Popout mit dem Chat-Namen, der verstrichenen Zeit und **End call**. Klicke auf das Popout, um zurückzukehren. Der Anruf läuft weiter, während du stöberst.

### Soundboard

Das Soundboard hat vier eingebaute Töne, die du nicht löschen kannst: **Soft Chime**, **Tap**, **Sparkle** und **Pop**. Klicke auf **Upload**, um eigene hinzuzufügen (mp3, wav, ogg, webm oder m4a, jeweils bis zu 8 MB). Du kannst deine eigenen Uploads löschen. Charaktere können mit dem Soundboard-Befehl einen Ton abspielen.

## Character Video Presence

Dieser Teil ist optional und fortgeschritten. **Character video presence** ersetzt eine Standbild-Avatarkachel durch einen wiederholten KI-Videoclip des Charakters. Es ist standardmäßig aus. Der Schalter liegt unter **Chat Settings → Agents → Calls**.

Bevor du anfängst: Füge unter **Connections** ein Konto vom Typ Video Generation hinzu und markiere es als **Default for Videos** oder wähle jedes Mal eines aus.

1. Öffne den Editor eines Charakters oder einer Persona.
2. Öffne den Tab **Sprites** und dann den Unter-Tab **Clips**.
3. Klicke auf **Generate Clips**, oder auf **Upload extra**, um einen eigenen hinzuzufügen.
4. Wähle im Fenster **Generate Call Clips** unter **Video Generation Connection** ein Konto und wähle **Use avatar as reference**.
5. Wähle die Standard-Clips, die entstehen sollen: **Idle**, **Talking**, **Laughing**, **Angry**, **Crying**, **Sighing**. Du kannst auch einen eigenen Clip mit einem **Clip name** und einer Aktionsbeschreibung festlegen.

Während eines gesprochenen Zugs liest Marinara Sprachhinweise in einer Zeile, etwa `[sighs]`, wählt einen passenden Reaktionsclip und kehrt dann zu Idle zurück. Ein fehlender Clip blockiert nie einen Anruf: Der Charakter zeigt stattdessen einen statischen Avatar. Ein zugeschnittener Clip wiederholt sich innerhalb seines Schnittbereichs. Siehe [Charakter-Sprites (Ausdrücke und Ganzkörper)](../characters/sprites.md).

Zwei weitere Schalter erscheinen unter **Character video presence**, wenn sie an ist:

- **Automatic video clips generation** (standardmäßig aus) erzeugt nur **Idle** und **Talking** für einen Teilnehmer, der sie braucht. Reaktions- und eigene Clips entstehen nie automatisch.
- **Custom clips** (standardmäßig aus) lässt einen Charakter selten einen einmaligen Clip in einem Live-Anruf anfordern und einen fertigen eigenen Clip wiedergeben. Er ist für besondere Anfragen, nicht für jede Stimmung.

Schaltest du **Character video presence** aus, schaltet das auch beide aus. Clips sind hier wiederverwendbare Präsenzschleifen, nicht Gallery-**Videos**, die Szenenvideos enthalten.

## Speech-to-Text einrichten (fortgeschritten)

Nur nötig für den Modus **Mic recording + Local Whisper**, oder wenn du einen eigenen Speech-to-Text-Server willst.

<a id="download-local-whisper"></a>

### Local Whisper herunterladen

Local Whisper wandelt deine Sprache auf dem Rechner, auf dem Marinara läuft, in Text um. Dein Mikrofon-Audio verlässt diesen Rechner dafür nicht. Der Text geht trotzdem als Teil des Anrufs an dein Modell. Es ist der zuverlässigste Mikrofonweg für Browser mit schwacher Spracherkennung, etwa Firefox.

Bevor du anfängst: Installiere Calls. Der Bereich ist ohne es verborgen.

1. Öffne **Connections** und suche **Speech to text** unter **On this device**. Steht es nicht dort, klicke auf **Add account** und wähle **Speech to text**.
2. Suche **Local speech model** auf dieser Seite.
3. Wähle ein Modell:
   - **Whisper Tiny (Multilingual)**: etwa 180 MB Download und 350 MB Arbeitsspeicher. Am besten für Handys und ältere Rechner.
   - **Whisper Base (Multilingual)**: etwa 320 MB Download und 650 MB Arbeitsspeicher. Besser bei unsauberer Sprache.
4. Klicke auf **Download Whisper** und warte auf den Fortschrittsbalken.
5. Starte Marinara vollständig neu, bevor du Calls nutzt.

Ein Papierkorbsymbol, **Delete Local Whisper**, entfernt das Modell. Calls zu deinstallieren löscht auch heruntergeladene Whisper-Modelle. Eine Neuinstallation lädt ein Modell erst wieder herunter, wenn du es wählst.

Wenn es nicht funktioniert hat: In einem Lite-Build von Marinara siehst du „Local Whisper is disabled in Lite mode. Use a full Marinara install to download and run the local speech model.“ Siehst du eine Meldung über die „native ONNX runtime“, fehlt die Sprach-Engine für deine Plattform. Installiere die Abhängigkeiten mit demselben Node-Build neu, mit dem du Marinara ausführst, und starte dann neu.

<a id="use-your-own-speech-to-text-server"></a>

### Einen eigenen Speech-to-Text-Server nutzen

Kommt Local Whisper mit deiner Sprache oder deinem Akzent schlecht zurecht, sende deine Stimme stattdessen an einen anderen Speech-to-Text-Server. Jeder Server, der das OpenAI-Speech-to-Text-Format akzeptiert (die Adresse `/audio/transcriptions`), funktioniert, ob du ihn selbst betreibst oder einen Dienst wie OpenAI oder Groq nutzt.

1. Öffne **Connections** und öffne **Speech to text** unter **On this device**. Steht es nicht dort, klicke auf **Add account** und wähle **Speech to text**. Es ist verborgen, solange Calls nicht installiert ist.
2. Gib die **Server URL** ein, zum Beispiel `http://localhost:8000/v1`.
3. Gib einen **API key** ein, wenn der Server einen braucht. Er wird verschlüsselt gespeichert und maskiert angezeigt.
4. Gib den **Model**-Namen ein, den dein Server nutzt. Lass es leer, um `whisper-1` zu senden.
5. Optional: Gib einen **Language**-Code wie `pl` oder `de` ein. Lass es leer, damit der Server die Sprache selbst erkennt.
6. Klicke auf **Test**. Marinara sendet einen einsekündigen stillen Clip. Du siehst „The server answered.“ oder „The test failed.“
7. Schalte **Use your own speech-to-text server** an.

Solange er an ist, sendet **Mic recording + Local Whisper** deine Sprache an diesen Server, und du musst Local Whisper nicht herunterladen. Dein Audio geht an diesen Server, also nutze einen, dem du vertraust.

Ein Server auf demselben Rechner funktioniert ohne Weiteres. Ein Server auf einem anderen Rechner in deinem Netzwerk wird abgelehnt, es sei denn, du setzt `STT_LOCAL_URLS_ENABLED=true` in `.env` (siehe [Referenz zur Server-Konfiguration](../CONFIGURATION.md)).

Wenn es nicht funktioniert hat: Lies die Meldung unter **Test**. „Could not reach the speech-to-text server“ heißt, dass die Adresse falsch ist oder der Server aus ist. Eine Meldung, die `STT_LOCAL_URLS_ENABLED` nennt, heißt, dass der Server auf einem anderen Rechner liegt. Eine Zahl kommt von deinem Server: 401 heißt meist ein falscher API-Key, 404 eine falsche Adresse oder ein falscher Modellname. Verwenden Anrufe noch Local Whisper, aktualisiere Calls über **Agents → Agent Organizer**.

## Einstellungen und Standardwerte

Einstellungen **Per chat** gelten für einen Chat. Einstellungen **Global** gelten für jeden Conversation-Anruf.

| Einstellung | Geltungsbereich | Standard |
| --- | --- | --- |
| **Audio/Video Calls** | Pro Chat | Aus |
| **Calls** (Befehl) | Pro Chat | An |
| **Generate voice cues in [tags]** | Pro Chat | An |
| **Call Audio Pipeline** | Global | Aus |
| **Audio input mode** | Global | Mic recording + Local Whisper |
| **Camera and screen input** | Global | Aus |
| **Character video presence** | Global | Aus |
| **Automatic video clips generation** | Global | Aus |
| **Custom clips** | Global | Aus |

Eine globale Einstellung, die du in einem Chat änderst, ändert sich für jeden Conversation-Anruf. **Generate voice cues in [tags]** bittet das Modell, kurze Hinweise wie `[whispering]`, `[laughing]` oder `[sighs]` in gesprochene Zeilen einzubauen. Sie prägen, wie TTS die Zeile liest, und helfen bei der Wahl von Reaktionsclips. Schalte sie aus, um gesprochene Zeilen schlicht zu halten.

## Befehle in einem Anruf

Charaktere nutzen im Anruf dieselben verborgenen Befehle wie in normalen Nachrichten. Jeder braucht seinen Schalter unter **Chat Settings → Agents → Commands** und den Hauptschalter **Commands** an. Siehe [Wählen, welche Commands ein Charakter nutzen darf](getting-started.md#choose-which-commands-a-character-can-use). Sie laufen still und werden nie gesprochen.

Zwei Extras funktionieren in einem Anruf: **Soundboard** (ein Charakter spielt einen Soundboard-Ton ab) und Verlassen oder Beenden (ein Charakter verlässt den Anruf oder beendet ihn für alle). **Notes** und **Influence** erscheinen nur, wenn der Chat einen verbundenen Chat hat (siehe [Eine Conversation mit einem Roleplay oder Game verknüpfen](../chats/connected-chats.md)). Ein Selfie braucht ein **Selfie model** (siehe [Selfies](selfies.md)). Manche Befehle fügen dem Anruf-Chat einen kleinen Eintrag hinzu, etwa „sent a selfie“ mit dem Bild.

## Die Zusammenfassung nach dem Anruf

Endet ein Anruf, erscheint in der Conversation eine Karte. Ihr Titel lautet **Call Started**, **Incoming Call**, **Call Ended** (mit der Länge), **Call Declined** oder **Missed Call**. Ist nach **Call Ended** etwas Bedeutsames passiert, schreibt Marinara im Hintergrund eine kurze Zusammenfassung und fügt sie als verborgenen Kontext hinzu, den das Modell lesen kann. So bleibt das Modell über den Anruf im Bild, ohne ihn in den sichtbaren Chat zu kopieren.

## Fehlerbehebung

| Symptom | Lösung |
| --- | --- |
| Charaktere hören mich nicht | Prüfe, dass **Call Audio Pipeline** an ist und dein Browser das Mikrofon für die Marinara-Seite erlaubt. Lade in Firefox oder wenn die Browser-Spracherkennung nicht funktioniert Local Whisper herunter und nutze **Mic recording + Local Whisper**. |
| Die Browser-Spracheingabe bewirkt nichts | Firefox hat die Web Speech Recognition nicht, die Chromium- und Safari-Browser haben. Nutze **Mic recording + Local Whisper** oder **Manual system dictation**. |
| Ein Charakter tippt, statt zu sprechen | Prüfe deine Text-to-Speech-Einstellungen und Stimmzuweisungen. Siehe [Text to Speech (TTS) einrichten](../media/tts-setup.md). |
| Das Modell versteht meine Sprache falsch | Probiere **Whisper Base (Multilingual)**, verringere Rauschen oder nutze **Provider-native audio/video**, wenn dein Modell es unterstützt. Bei einer Sprache, die Whisper schlecht beherrscht, [nutze einen eigenen Speech-to-Text-Server](#use-your-own-speech-to-text-server) und setze **Language**. |
| Die Kamera- oder Bildschirm-Schaltfläche ist deaktiviert | Nutze den Modus **Provider-native audio/video** und schalte **Camera and screen input** an. Dein Modell muss außerdem Kamera- oder Bildschirmeingabe akzeptieren. |
| Ein Charakter hört mitten im Anruf auf zu antworten | Prüfe das Modell-Konto für den Chat, sende eine Nachricht im Anruf-Chat und starte den Anruf erneut. |
| Der Anruf funktioniert auf meinem Handy nicht | Der Anruf-Chat öffnet sich mit **Open call chat**. Für Sprache bestätige, dass TTS eingerichtet ist. Für das Mikrofon gelten dieselben Schritte zu Local Whisper und Berechtigungen. |

## Verwandte Anleitungen

- [Text to Speech (TTS) einrichten](../media/tts-setup.md)
- [Eingebautes Modell einrichten](../connections/local-model.md)
- [Charakter-Sprites (Ausdrücke und Ganzkörper)](../characters/sprites.md)
- [Conversation Mode: Erste Schritte](getting-started.md)
