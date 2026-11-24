# Text to Speech (TTS) einrichten

Text to Speech (TTS) liest Chat-Nachrichten und Spielerzählungen laut vor. In dieser Anleitung erfährst du, wie du es einschaltest, einen Sprachdienst und Stimmen wählst, die automatische Wiedergabe einrichtest und die Steuerung an einzelnen Nachrichten nutzt.

## Schnellstart

1. Klick in der oberen Leiste auf **Connections** (Verbindungen) und dann auf **Add** (Hinzufügen).
2. Klick bei den Typfiltern auf **Voice** (Stimme), wähl einen Dienst und füg deinen Key unter **API key** ein. Klick auf **Connect** (Verbinden).
3. Hake unter **Found in … — use it for:** die Option **Voice** an und klick auf **Done** (Fertig). Ein Voice-Modell zu wählen, schaltet die Sprachausgabe ein.
4. Klick auf der Seite **Jobs** (Aufgaben) auf das Zahnrad neben **Voice** und dann auf **Preview** (Vorschau), um eine Probe zu hören. In einem Chat klickst du unter einer Nachricht auf **Speak** (Vorlesen).

## Text to Speech einschalten

Ein Modell für die Aufgabe **Voice** zu wählen, schaltet die Sprachausgabe ein. Dadurch wird noch nichts von selbst vorgelesen. Auf jeder Nachricht erscheint die Schaltfläche **Speak**, und die Optionen für **Auto-play** werden sichtbar. Du wählst weiterhin, was wann vorgelesen wird.

1. Klick in der oberen Leiste auf **Connections** und dann unter **Jobs** auf **All jobs** (alle Aufgaben). Such dort **Voice**.
2. Klick auf die Zeile und wähl ein Sprachmodell oder einen Sprachdienst. Die Zeile zeigt deine Auswahl.
3. Klick auf das Zahnrad der Zeile, um die Stimmeinstellungen zu öffnen. Hast du noch kein Sprachkonto, klick in der Zeile auf **Add** oder füge wie im Schnellstart eines hinzu.
4. Um die Sprachausgabe auszuschalten, klick auf die Zeile und wähl **Turn voice off** (Sprachausgabe ausschalten). Die Zeile zeigt **Off** (Aus), und es wird nichts vorgelesen.

Ein Sprachdienst ist der Dienst, der das Audio erzeugt. Marinara unterstützt diese:

- **OpenAI-compatible**: OpenAI oder jeder Server, der das TTS-Format von OpenAI nachbildet. Das ist der Standard.
- **ElevenLabs**: der Sprachdienst von ElevenLabs.
- **PocketTTS**: ein kostenloser Sprachserver, den du auf deinem eigenen Rechner betreibst.
- **xAI Voice**: der Sprachdienst von xAI.

Marinara speichert für jeden Sprachdienst ein eigenes Profil: Key, Adresse, Modell, Stimmen und Parameter. Wechselst du den Dienst, kehrt dessen frühere Einrichtung zurück. Ein Dienst, den du noch nicht eingerichtet hast, startet mit Standardwerten.

Anfragen laufen über Marinaras eigenen Server. Dein API-Key wird verschlüsselt auf dem Server gespeichert. Nach dem Speichern zeigt das Feld nur maskierte Punkte, und der echte Key geht nie an deinen Browser zurück.

<a id="use-an-audio-connection"></a><a id="use-a-voice-model-from-an-account"></a>

### Ein Voice-Modell aus einem Konto verwenden

Hast du bereits ein **Audio**-Konto hinzugefügt (siehe [Unterstützte KI-Anbieter](../connections/providers-reference.md#audio)), musst du seine Daten nicht noch einmal eintragen. Seine Sprachmodelle erscheinen in der Auswahl für **Voice**.

1. Klick auf der Seite **Jobs** auf **Voice** und wähl das Modell.
2. Klick auf das Zahnrad der Zeile. Wähl deine Stimmen und die übrigen Einstellungen.

Marinara verwendet dann Adresse, Key, Modell und **Request timeout (seconds)** dieses Kontos, deshalb zeigen die Stimmeinstellungen diese Felder nicht. Der Key bleibt im Konto. Er wird weder in die Stimmeinstellungen kopiert noch an deinen Browser geschickt. Änderungen am Konto, etwa ein neuer Key, gelten sofort.

Stimmen, Tempo und die übrigen Spracheinstellungen werden für jedes Konto getrennt gespeichert. Zwei Konten derselben Art teilen sie nie. Deine Einstellungen für die vier regulären Sprachdienste bleiben, wie sie waren.

Wird das gewählte Konto gelöscht oder lässt es sich nicht verwenden, zeigt die Zeile **The voice account is missing** (Das Sprachkonto fehlt), und es wird nichts gesprochen, bis du ein anderes Sprachmodell wählst. Marinara wechselt nie von selbst.

## Adresse, Key und Modell festlegen

Das Fenster **Add account** (Konto hinzufügen) fragt nur nach Key oder Adresse. Um sie später zu ändern, klick im Panel **Connections** am Konto auf **⋯** und dann auf **Edit account** (Konto bearbeiten). Überspring diesen Abschnitt, wenn du ein Audio-Konto gewählt hast. Das Konto liefert diese Angaben.

1. Prüf **Address** (Adresse). Jeder Dienst trägt einen Standard ein (Tabelle unten). Ändere ihn nur für einen Proxy oder einen Server, den du selbst betreibst.
2. Füge deinen Key in **API key** ein. Soll ein vorhandener Key bleiben, lass die maskierten Punkte stehen. Zum Entfernen leerst du das Feld.
3. Wähl das Modell oder tipp eine andere Modell-ID ein, die dein Dienst unterstützt.

| Sprachdienst | Standardadresse | Standardmodell | Standardstimme |
| --- | --- | --- | --- |
| OpenAI-compatible | `https://api.openai.com/v1` | `tts-1` | `alloy` |
| ElevenLabs | `https://api.elevenlabs.io` | `eleven_multilingual_v2` | keine, du musst eine wählen |
| PocketTTS | `http://localhost:8000` | `pocket-tts` | `alba` |
| xAI Voice | `https://api.x.ai/v1` | `grok-tts` | `eve` |

Bei **ElevenLabs** lädt die Modellliste die Sprachmodelle, die dein Konto nutzen kann. Wähle ein normales Sprachmodell. Modell-IDs mit `ttv` sind Voice-Design-Modelle, die keinen Text vorlesen können. Wählst du eines davon, scheitert die Wiedergabe mit einer Fehlermeldung, die dich auffordert, ein Sprachmodell zu verwenden.

### PocketTTS

PocketTTS ist nicht in Marinara eingebaut. Installiere [den offiziellen PocketTTS-Server](https://github.com/kyutai-labs/pocket-tts) separat und starte ihn mit `uvx pocket-tts serve`. Marinara lädt ihn weder herunter, noch verwaltet es ihn. Der offizielle Server verwendet `http://localhost:8000`. Lass **Address** auf diesem Wert, sofern du Host oder Port nicht geändert hast. Marinara erkennt die offizielle Multipart-API `/tts`. Eigene URLs für den [OpenAI-kompatiblen PocketTTS-Wrapper](https://github.com/teddybear082/pocket-tts-openai_streaming_server) funktionieren weiterhin.

<a id="request-timeout"></a>

### Zeitlimit für Anfragen

Marinara wartet bis zu 60 Sekunden auf jede gesprochene Zeile. Ein Sprachserver auf deinem eigenen Rechner, vor allem auf einem Laptop, kann für eine lange Zeile länger brauchen. Erhöhe **Request timeout (seconds)** unter **More** (Mehr) in **Voice settings** (Stimmeinstellungen; das Zahnrad neben **Voice** auf der Seite **Jobs**). Möglich sind 10 bis 3.600 Sekunden.

Ein Audio-Konto hat ein eigenes Feld **Request timeout (seconds)**, unter **Default voice** (Standardstimme) im Fenster **Edit model** (Modell bearbeiten) seines Modells und in **Voice settings**. Chats, die über ein Audio-Konto sprechen, auch über eines, das für die Aufgabe **Voice** gewählt ist, nutzen dieses Limit. Das Limit in **Voice settings** gilt für Sprachausgabe mit diesen Einstellungen, einschließlich **Preview**. Dauert eine Zeile zu lange, nennt die Fehlermeldung, wie viele Sekunden Marinara gewartet hat und welche Einstellung du erhöhen solltest.

## Stimmen wählen

Alle Sprechenden nutzen **Shared voice** (gemeinsame Stimme), bis du einem Charakter oder einer Persona eine eigene Stimme gibst. Beide Optionen stehen im Abschnitt **Who speaks** (Wer spricht) von **Voice settings**.

### One voice for all

Wähle die Stimme in **Shared voice**. Um die echte Stimmenliste deines Dienstes zu laden, klick auf **Refresh voices from provider** (Stimmen vom Anbieter neu laden, das Symbol mit dem Kreispfeil). Bevor du verbunden bist, zeigt die App eine kurze eingebaute Liste, damit das Feld nicht leer bleibt. Ein Fehler des Dienstes wird angezeigt, statt die Ersatzliste als geglücktes Neuladen auszugeben.

Der offizielle PocketTTS-Server hat keinen Endpunkt für eine Stimmenliste. Marinara zeigt deshalb seine eingebauten Stimmen und daneben ein Textfeld für einen anderen eingebauten Namen oder eine unterstützte Stimmen-URL. Kompatible Wrapper-Server können eine eigene Liste liefern und eigene IDs oder Pfade annehmen.

Bei **ElevenLabs** musst du eine Stimme wählen. Marinara lädt die gesamte Bibliothek des Kontos: persönliche, Workspace-, gespeicherte und Standardstimmen. Die Auswahl hat ein Suchfeld und zeigt, wie viele Stimmen geladen sind. Sie startet auf „Select an ElevenLabs voice“, und die Wiedergabe bleibt gesperrt, bis du eine echte Stimme wählst.

### Selected per character or persona

1. Klick in **Character and persona voices** (Charakter- und Persona-Stimmen) auf **Add voice** (Stimme hinzufügen).
2. Wähle in der linken Liste einen Charakter oder eine Persona und in der rechten Liste eine Stimme.
3. Wiederhol das für jeden weiteren Eintrag.

Die Stimme eines Charakters kannst du auch im **Character Editor** auf dem Tab **Voice** festlegen. Das ändert dieselbe Zeile. Solange die Charaktere eine Stimme teilen, steht auf dem Tab **All characters share one voice right now.** Klick auf **Use a voice per character**, um umzuschalten, und wähl dann eine Stimme. Über **Open Text to Speech settings** öffnest du **Voice settings**. **Refresh** (Aktualisieren) in **Character and persona voices** lädt die Stimmenliste neu. Leg deine Charaktere zuerst an. Gibt es noch keine, weist die App dich darauf hin, vor dem Zuweisen von Stimmen einen Charakter oder eine Persona hinzuzufügen.

Ein Charakter ohne eigene Stimme verwendet die Stimme einer Karte mit passendem Namen, etwa die des Originals einer AU-Kopie. Andernfalls nutzt er die gemeinsame Stimme. Siehe [Charaktere anlegen und bearbeiten](../characters/creating-and-editing-characters.md).

### Erzählerstimme

Erzählung ist Text, den kein einzelner Charakter spricht, etwa eine Szenenbeschreibung oder die Zeilen eines Game Masters.

1. Schalte in **Narrator voice** (Erzählerstimme) die Option **Use separate narrator voice** (eigene Erzählerstimme verwenden) ein.
2. Wähle eine Stimme.

Sie wird verwendet, wenn der Sprecher einer Zeile Narrator, GM, Game Master oder System ist, in Nachrichten in Roleplay und Conversation sowie bei Erzählung im Game Mode ohne benannten Sprecher. Bei ElevenLabs wählst du hier eine Erzählerstimme. Lässt du das Feld leer, greift die Erzählung nur dann auf eine Ersatzstimme zurück, wenn eine globale Stimme gesetzt ist.

### Zufällige NPC-Stimmen (nur im Game Mode)

Damit bekommen Nebencharaktere, die der Game Mode mitführt, übrige Stimmen. In Roleplay und Conversation hat das keine Wirkung.

1. Schalte in **Random NPC voices** (zufällige NPC-Stimmen) die Option **Use default voices for random NPCs** (Standardstimmen für zufällige NPCs verwenden) ein.
2. Setz Häkchen bei Stimmen in **Male NPC defaults** und **Female NPC defaults**.

Ein mitgeführter NPC (Nicht-Spieler-Charakter) ohne eigene Stimme bekommt eine feste Zuteilung aus dem passenden Pool und behält sie für die Sitzung. Ein NPC mit zugewiesener Stimme behält diese Stimme. NPCs mit unklarem Geschlecht wählen aus beiden Pools. Findet die App keine als männlich oder weiblich gekennzeichneten Stimmen, nutzt jeder Pool die vollständige Liste.

## Audioformat und Tempo

**Audio format** (Audioformat) ist **MP3** (Standard) oder **WAV**. Nimm WAV für lokale Server, die kein MP3 erzeugen können. Bei ElevenLabs ist das Steuerelement ausgeblendet, dort läuft immer MP3. Bei xAI Voice erscheint es, bleibt aber wirkungslos, weil xAI immer MP3 liefert.

Der Bereich des Reglers **Speed** (Tempo) hängt vom Sprachdienst ab:

| Sprachdienst | Bereich |
| --- | --- |
| OpenAI-compatible | 0,25- bis 4,0-fach |
| PocketTTS | 0,25 bis 4,0 bei kompatiblen Wrappern. Der offizielle Server steuert das Tempo selbst. |
| ElevenLabs | 0,7- bis 1,2-fach |
| xAI Voice | 0,7- bis 1,5-fach |

Ein gespeichertes Tempo außerhalb des Bereichs wird auf den nächstliegenden erlaubten Wert begrenzt. Bei ElevenLabs gibt es zwei weitere Steuerelemente: **Language** (Sprache) erzwingt eine Sprache oder bleibt auf **Auto detect**, und **Stability** (Stabilität) reicht von ausdrucksstärker bis gleichmäßiger.

## Auto-play

Jeder Schalter für **Auto-play** liest eine Art neuer Nachricht vor, sobald deren Generierung fertig ist. Dafür muss die Aufgabe **Voice** ein Modell haben. Alle Schalter sind anfangs aus.

- **Roleplay messages**: neue Antworten in Roleplay.
- **Conversation messages**: neue Antworten in Conversation.
- **Game narration**: neue Erzähl- und Kampfzeilen im Game Mode.
- **Progressive playback**: startet bei einer Antwort aus mehreren Zeilen sofort die erste Zeile, statt auf die ganze Antwort zu warten.
- **Only read dialogues**: liest nur zitierte oder markierte Sprechzeilen und überspringt reine Erzählung.

Die automatische Wiedergabe greift genau einmal, bei der neuesten Antwort, sobald sie fertig ist. Alte Nachrichten liest sie nicht erneut vor, wenn du einen Chat wieder öffnest oder scrollst.

In Roleplay beginnt die Vorbereitung der Sprachausgabe, sobald die Hauptantwort gespeichert ist. Schreibt ein aktivierter Agent wie Prose Guardian die Antwort um, wartet Marinara auf den endgültigen Text.

### Textfilter und Emotionsanweisungen

Diese Filter gelten für die manuelle und die automatische Wiedergabe, einschließlich Game-Erzählung und Sprechererkennung in Roleplay. Codeblöcke werden standardmäßig übersprungen. Die anderen beiden Filter sind anfangs aus.

- **Skip text inside HTML and custom tags** (Text in HTML- und eigenen Tags überspringen): entfernt den eingeschlossenen Text, etwa einen verborgenen Block `<simulation>...</simulation>`. Sprecher-Tags für die Stimmenwahl bleiben erhalten.
- **Skip fenced code blocks** (abgegrenzte Codeblöcke überspringen).
- **Skip text inside square brackets** (Text in eckigen Klammern überspringen).

Schalte **Roleplay speaker extractor** (Sprechererkennung in Roleplay) ein, damit **Enable emotion indicators** (Emotionshinweise aktivieren) erscheint. Damit kommen Sprechanweisungen hinzu, ohne dass sich der Wortlaut der Dialoge ändert. Sind die Emotionshinweise eingeschaltet, geht Text in eckigen Klammern an den Sprachdienst, auch wenn **Skip text inside square brackets** eingeschaltet ist. Das kann auch Notizen einschließen. Sollen Notizen in Klammern nicht vorgelesen werden, schalte die Emotionshinweise aus und lass das Überspringen eingeschaltet. Anweisungen wie `[Low, steady voice, restrained urgency]` bleiben vollständig, wenn eine lange Zeile aufgeteilt wird. Bekannte Sprecher- und Szenenmarkierungen werden weiterhin entfernt. Das Sprachmodell entscheidet, wie es jede Anweisung umsetzt. Ist für die Aufgabe **Voice** ein Modell gewählt und sind **Game narration** und die Emotionshinweise eingeschaltet, können auch Szenen-, Party- und Kampfdialoge im Game Mode Anweisungen enthalten.

## Eine einzelne Nachricht vorlesen

Sobald für die Aufgabe **Voice** ein Modell gewählt ist, erscheint in der Werkzeugleiste unter jeder Charakter- oder Erzählernachricht die Schaltfläche **Speak** (ein Mikrofonsymbol).

- Klick auf **Speak**, um die Nachricht vorzulesen. Während das Audio geladen wird, zeigt die Schaltfläche einen Ladezustand.
- Ein erneuter Klick während der Wiedergabe stoppt sie. Der Tooltip lautet dann **Stop speaking**.
- Eine Nachricht ohne lesbaren Text, etwa nur mit einem Bild, zeigt **No dialogue to speak** und bleibt deaktiviert.

Während eine Nachricht gesprochen wird, erscheinen die Schaltflächen **Pause speaking**, **Resume speaking** und **Restart speaking**. Die Schaltfläche mit dem Lautsprechersymbol öffnet den Regler **Line volume** (Zeilenlautstärke) von 0 bis 100 Prozent (Standard 50). Er ist unabhängig vom Mischpult im Game Mode und von der Anruflautstärke in Conversation.

Wenn es nicht funktioniert hat, sieh unter [Fehlerbehebung](#troubleshooting) nach.

## Zwischengespeicherte Clips

Marinara legt generiertes Audio in deinem Browser ab, damit dieselbe Zeile nicht zweimal generiert wird. Der Abschnitt **Cached clips** (zwischengespeicherte Clips) in **Voice settings** zeigt Anzahl und Gesamtgröße in Echtzeit. Klick auf **Export cached TTS clips** (zwischengespeicherte TTS-Clips exportieren, das Download-Symbol), um alle zwischengespeicherten Clips als einzelne Audiodateien zu sichern. Der Cache entfernt seine ältesten Clips von selbst. Eine Schaltfläche zum Leeren gibt es in der App nicht. Lösch deine Browserdaten, um ihn zu leeren.

## TTS in den einzelnen Chat-Modi

- **Roleplay** nutzt den Schalter **Roleplay messages** und die **Speak**-Steuerung. Siehe [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md).
- **Conversation** nutzt den Schalter **Conversation messages** und dieselbe Steuerung. Audioanrufe sind in [Audio- und Videoanrufe in Conversation](../conversation/calls.md) beschrieben.
- **Game Mode** nutzt den Schalter **Game narration**. Sein Mischpult hat einen Kanal **TTS** neben **Master**, **Music**, **Sound Effects** und **Ambient**. Er regelt die Lautstärke des gesprochenen Spiel-Audios und startet bei 100 Prozent. Siehe [Die Bedienelemente des Spiels](../game/getting-started.md#the-games-controls).

### Phonetic name (Aussprache in Anrufen)

Spricht die Stimme einen Charakter- oder Persona-Namen falsch aus, füge einen **Phonetic name** (phonetischer Name) hinzu und tipp ein, wie er klingen soll. Im **Character Editor** liegt das Feld auf dem Tab **Voice**. Im **Persona Editor** steht es bei den Basisangaben. Es wird nur bei Audio- und Videoanrufen in Conversation verwendet. **Speak**, die automatische Wiedergabe und die Erzählung im Game Mode ignorieren es.

<a id="troubleshooting"></a>

## Fehlerbehebung

- **Es wird nichts vorgelesen**: Prüf, ob **Voice** auf der Seite **Jobs** nicht unter **Off** steht. Prüf dann den passenden Schalter für **Auto-play** oder nutze **Speak** an einer Nachricht.
- **Die Zeile Voice zeigt The voice account is missing**: Das Konto hinter dem Sprachmodell wurde gelöscht oder lässt sich nicht verwenden. Wähl ein anderes Sprachmodell. Siehe [Ein Voice-Modell aus einem Konto verwenden](#use-a-voice-model-from-an-account).
- **Keine Stimmen in der Liste**: Prüf, ob die Zeile **Voice** ein Modell und einen gültigen Key hat, und klick auf **Refresh voices from provider**. Der offizielle PocketTTS-Server nutzt Marinaras eingebaute Liste. Bei einem kompatiblen PocketTTS-Wrapper prüfst du, ob `<Base URL>/v1/voices` antwortet.
- **ElevenLabs spricht nicht**: Wähl eine echte Stimme, nicht den Platzhalter „Select an ElevenLabs voice“. Prüf, ob das Modell ein Sprachmodell ist und kein Voice-Design-Modell, dessen ID `ttv` enthält.
- **Eine Zeile bricht mit „No audio after 60 s“ ab**: Der Sprachserver braucht mehr Zeit. Erhöhe **Request timeout (seconds)** dort, wo die Meldung es angibt. Siehe [Zeitlimit für Anfragen](#request-timeout).
- **Ein selbst gehosteter Server auf einer lokalen Adresse wird blockiert**: Schalte `TTS_LOCAL_URLS_ENABLED` in `.env` ein. Damit erreicht Marinara lokale oder private Adressen für OpenAI-kompatible oder ElevenLabs-artige Server. PocketTTS braucht das nicht. Siehe [Referenz zur Server-Konfiguration](../CONFIGURATION.md).
- **Schnell testen**: Klick in **Voice settings** auf **Preview**, um mit deinen aktuellen Einstellungen eine kurze Hörprobe abzuspielen.

## Referenz: Musik, Soundeffekte und Gacha Forge

Diese Abschnitte sind für fortgeschrittene Setups gedacht.

<a id="game-music-and-sound-effects-on-a-compatible-audio-server"></a>

### Game-Musik und Soundeffekte über einen kompatiblen Audioserver

1. Öffne in **Connections** dein Konto für **Music & Sound Effects** (Musik und Soundeffekte) mit **Edit model** (Modell bearbeiten) und wähle **Custom compatible server** (eigener kompatibler Server). Im Fenster **Add account** gibt es keine Kachel für diese Kontoart; solche Konten entstehen durch ein Upgrade oder einen Import (siehe [die Kontoreferenz](../connections/providers-reference.md#music--sound-effects)).
2. Trag Adresse, Key und Modell deines Musik- oder Soundeffektservers ein.
3. Lege **Generation API format** (API-Format für die Generierung) fest und trag die Endpunktpfade ein, die dein Server anbietet. Ein leerer Pfad lässt die jeweilige Funktion unverfügbar.
4. Schalte **Music generation** (Musikgenerierung), **Sound-effect generation** (Soundeffektgenerierung) oder beides ein.
5. Wähle dieses Konto in der Game-Einrichtung oder in den Audioeinstellungen des Games. Lass dein Sprachkonto separat in den Stimmeinstellungen der Aufgabe **Voice** ausgewählt.

Endpunktpfade werden an die Base URL des Kontos angehängt. Verwende bei `http://localhost:8002/v1` den Pfad `chat/completions`, um `/v1/chat/completions` zu erreichen. Lokale HTTP-Endpunkte brauchen wie andere lokale kompatible Audioanfragen `TTS_LOCAL_URLS_ENABLED=true` in `.env`.

Zwei API-Formate werden unterstützt:

- **Prompt JSON → MP3 audio** sendet `{ "model": "your-model", "prompt": "the requested sound", "duration": 5, "response_format": "mp3" }` und erwartet MP3-Bytes. Game-Musik verwendet die Dauer des Kontexttracks (standardmäßig 120 Sekunden). Soundeffekte fordern 5 Sekunden an.
- **Chat Completions → inline audio (ACE-Step compatible)** sendet `model`, einen Benutzereintrag in `messages`, `stream: false` und `audio_config` mit `duration`, `instrumental: true` und `format: "mp3"`. Es nimmt Inline-MP3 aus `choices[0].message.audio` an: entweder ein ACE-Step-Array von Audio-URLs mit einer Base64-Daten-URL oder ein Objekt mit Base64-`data`. Siehe den [ACE-Step-kompatiblen API-Vertrag](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/Openrouter_API_DOC.md). Entfernte Ergebnis-URLs und asynchrone Job-APIs werden nicht unterstützt.

Schalte nur ein, was dein Server tatsächlich umsetzt. Ein OpenAI-kompatibler Sprachendpunkt allein heißt nicht, dass er Musik oder Soundeffekte unterstützt. Ein Dienst wie Infermatic muss eines dieser Formate bereitstellen oder einen Adapter liefern. Sein tatsächlicher Musikendpunkt wurde hier nicht geprüft. Für native Generierung über ElevenLabs oder SunoAPI wählst du die entsprechende Quelle unter **Music & Sound Effects**. Siehe [die Kontoreferenz](../connections/providers-reference.md#music--sound-effects).

Generierte Kontextmusik wird einmal pro Gebiet oder Begegnungsstufe komponiert und wiederverwendet. Wiederholte Soundeffekte nutzen den Audiocache. Nach einem Generierungsfehler bleibt der Cache für einen erneuten Versuch verfügbar.

<a id="gacha-forge-dialogue-and-audio"></a>

### Dialoge und Audio in Gacha Forge

Gacha Forge ab Version 1.11.0 verwendet das für die Aufgabe **Voice** gewählte Konto und dessen Stimmenzuweisungen pro Charakter.

- Schalte **Read character dialogue** (Charakterdialoge vorlesen) ein, um Dialoge importierter Charaktere mit zugewiesener Stimme vorlesen zu lassen. Die Option steht bei einer neuen Welt im Einrichtungsschritt **Lore** (Hintergrundwissen) und bei einer bestehenden Welt in den eigenen Welteinstellungen von Gacha Forge. Erzähltext, Gedanken, generierte Einheiten ohne Engine-Charakter-ID und Charaktere ohne Stimme bleiben stumm. Ein Name allein übernimmt nie die Stimme eines anderen Charakters.

- Ein gewähltes Audio-Konto lässt sich verwenden, wenn die Aufgabe **Voice** nicht auf **Off** steht.
- Die mitgelieferte Game-Musik und die Soundeffekte brauchen kein Generierungskonto. Um neue Titel zu komponieren, schalte in Gacha Forge **Generate music and sound effects** (Musik und Soundeffekte generieren) ein und wähle unter **Audio connection** (Audioverbindung) ein Konto für Music & Sound Effects. Diese Auswahl erscheint, wenn die Generierung eingeschaltet ist. Titel für Home, Kampf, Boss, Story-Szenen und Charaktergeschichten werden beim ersten Bedarf erzeugt und danach wiederverwendet. Diese Anfragen laufen über dein Konto bei dem jeweiligen Dienst.
- Die Stummschaltung oben rechts schaltet Musik, Dialoge und Soundeffekte gemeinsam stumm. Die visuellen Einstellungen von Gacha Forge haben getrennte Lautstärkeregler für alle drei, auch bis auf null, und dazu die Pause beim automatischen Weiterblättern (standardmäßig **3 Sekunden**, nach dem Einblenden des Textes und einem möglichen gesprochenen Dialog). Entscheidungen warten weiterhin auf den Spieler. Gesprochene Dialoge werden abgebrochen, wenn du eine Szene verlässt. Beim Verlassen der Welt stoppt ihr Audio.

Aktualisiere neben der Engine auch das installierte Gacha-Forge-Paket, um diese Bedienelemente zu erhalten.

## Weiterführende Anleitungen

- [Audio- und Videoanrufe in Conversation](../conversation/calls.md)
- [Lippensynchronisation mit Sprachausgabe](../agents/avatars.md#lip-sync-with-text-to-speech) für 2D- und 3D-Avatare
- [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md)
- [Game Mode: Erste Schritte](../game/getting-started.md)
- [Unterstützte KI-Anbieter](../connections/providers-reference.md)
- [Charaktere anlegen und bearbeiten](../characters/creating-and-editing-characters.md)
- [Referenz zur Server-Konfiguration](../CONFIGURATION.md)
