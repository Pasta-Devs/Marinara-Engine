# Text to Speech (TTS) einrichten

In dieser Anleitung erfährst du, wie du Text to Speech in Marinara Engine einrichtest, damit die App Nachrichten und Spielerzählungen laut vorliest. Text to Speech (TTS) ist die Sprachausgabe: Sie verwandelt geschriebenen Chat-Text in gesprochenes Audio. Es geht um die Wahl eines Sprachanbieters, um Stimmen, um die automatische Wiedergabe und um die Steuerung pro Nachricht.

## Wo die TTS-Einstellungen liegen

Fast alles zu TTS steckt an einer einzigen Stelle. Öffne das Panel **Connections** (Verbindungen) und such die Karte **Text to Speech**. Sie ist standardmäßig zugeklappt – klick auf die Kopfzeile, um sie aufzuklappen.

Die App schickt TTS-Anfragen über den eigenen Server. Marinara speichert den API-Key des Anbieters verschlüsselt auf dem Server. Nach dem Speichern zeigt das Feld nur noch eine Punktreihe statt des echten Keys. Der echte Key geht nie an den Browser zurück.

TTS einzuschalten bringt noch nichts zum Sprechen. Es blendet lediglich die Schaltfläche **Speak** (Vorlesen) an jeder Nachricht und die Optionen unter **Auto-play** (automatische Wiedergabe) ein. Was wann vorgelesen wird, entscheidest weiterhin du.

## Schritt 1: TTS aktivieren und eine Source wählen

1. Öffne das Panel **Connections** und klapp die Karte **Text to Speech** auf.
2. Klick auf den Schalter in der Kopfzeile der Karte, um TTS zu aktivieren. Zeig auf den Schalter, dann erscheint sein Tooltip (Kurzhinweis beim Draufzeigen): **Enable TTS** im ausgeschalteten Zustand, **Disable TTS** im eingeschalteten.
3. Öffne das Dropdown-Menü **Source** und wähle den Anbieter.

Eine **Source** (Quelle) ist der Dienst, der das Audio generiert. Zur Wahl stehen vier:

- **OpenAI-compatible**: OpenAI oder jeder Server, der das TTS-Format von OpenAI nachbildet.
- **ElevenLabs**: der Sprachdienst von ElevenLabs.
- **PocketTTS**: ein kostenloser Sprachserver, den du auf dem eigenen Rechner betreibst.
- **xAI Voice**: der Sprachdienst von xAI.

Standard ist **OpenAI-compatible**. Marinara bewahrt für jede Source ein eigenes Profil auf – mit verschlüsseltem API-Key, Endpunkt, Modell, Stimmen und Anbieter-Parametern. Beim Wechsel kehrt die frühere Einrichtung dieser Source zurück; eine noch nicht konfigurierte Source startet mit ihren Standardwerten.

<a id="use-an-audio-connection"></a>

### Eine Audioverbindung verwenden

Hast du bereits eine Verbindung mit dem Anbieter **Audio** eingerichtet (siehe [Unterstützte KI-Anbieter](../connections/providers-reference.md#audio)), musst du ihre Daten hier nicht noch einmal eintragen. Deine Audioverbindungen stehen im Dropdown-Menü **Source** unter **Audio connections** (Audioverbindungen), jeweils mit der Art ihrer Quelle in Klammern.

1. Öffne das Dropdown-Menü **Source** und wähle die Verbindung.
2. Wähle wie gewohnt ihre Stimmen und die übrigen Einstellungen weiter unten.

Marinara spricht dann mit der Base URL, dem API-Key, dem Modell und dem **Request timeout (seconds)** (Zeitlimit für Anfragen in Sekunden) dieser Verbindung, deshalb blendet die Karte diese Felder aus. Der Key bleibt in der Verbindung: Er wird weder in die Einstellungen der Karte kopiert noch an deinen Browser geschickt. Änderungen an der Verbindung, etwa ein neuer Key, gelten sofort.

Stimmen, Tempo und die übrigen Spracheinstellungen werden für jede Verbindung getrennt gespeichert. Zwei Verbindungen derselben Art, etwa zwei OpenAI-kompatible Server, teilen sie nie. Deine Einstellungen für die vier regulären Sources bleiben, wie sie waren, sodass du jederzeit zurückwechseln kannst. Der Schalter in der Kopfzeile der Karte schaltet Text to Speech weiterhin ein und aus, und die eigene Audioverbindung eines Spiels erzeugt weiterhin dessen Soundeffekte und Musik.

Wird die gewählte Verbindung gelöscht oder lässt sie sich nicht verwenden, zeigt die Karte **Missing Audio connection**, und es wird nichts gesprochen, bis du eine andere Source wählst. Marinara wechselt nie von selbst zu einer anderen Verbindung.

Liefert die Verbindung eine Liste ihrer Stimmen, nennt die Karte jede gespeicherte Stimme, die nicht auf dieser Liste steht, damit du eine wählen kannst, die die Verbindung anbietet.

<a id="game-music-and-sound-effects-on-a-compatible-audio-server"></a>

## Game-Musik und Soundeffekte über einen kompatiblen Audioserver

Erstelle oder öffne unter **Connections** eine **Audio**-Verbindung und wähle **OpenAI-compatible**. Verwende Adresse, Schlüssel und Modell deines Musik- oder Soundeffektservers. Lege **Generation API format** fest, trage die vom Server angebotenen Endpunktpfade ein und aktiviere **Game music** oder **Game sound effects**. Ein leerer Pfad lässt die jeweilige Funktion unverfügbar. Wähle diese Audio-Verbindung beim Einrichten des Games oder in dessen Audioeinstellungen. Ein reines Musikmodell ist kein Sprachmodell; lass die Verbindung für Sprachausgabe im Text-to-Speech-Bereich separat ausgewählt.

Endpunktpfade werden an die Base URL der Verbindung angehängt: Verwende bei `http://localhost:8002/v1` den Pfad `chat/completions`, um `/v1/chat/completions` zu erreichen. Ein neuer Anbietereintrag ist nicht nötig. Lokale HTTP-Endpunkte benötigen wie andere lokale kompatible Audioanfragen `TTS_LOCAL_URLS_ENABLED=true` in `.env`.

Zwei ausdrücklich festgelegte API-Verträge werden unterstützt:

- **Prompt JSON → MP3 audio** sendet `{ "model": "your-model", "prompt": "the requested sound", "duration": 5, "response_format": "mp3" }` und erwartet MP3-Bytes. Game-Musik verwendet die Dauer des Kontexttracks (standardmäßig 120 Sekunden); Soundeffekte fordern 5 Sekunden an. Verwende einen Endpunkt oder Adapter, der diese Felder annimmt.
- **Chat Completions → inline audio (ACE-Step compatible)** sendet `model`, einen Benutzereintrag in `messages`, `stream: false` und `audio_config` mit `duration`, `instrumental: true` und `format: "mp3"`. Inline-MP3-Audio wird aus `choices[0].message.audio` gelesen: entweder aus einem ACE-Step-Array von Audio-URLs mit einer Base64-Daten-URL oder aus einem Objekt mit Base64-`data`. Siehe den [ACE-Step-kompatiblen API-Vertrag](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/Openrouter_API_DOC.md). Entfernte Ergebnis-URLs und asynchrone Job-APIs werden von diesen Verträgen nicht unterstützt.

Aktiviere nur Funktionen, die dein Server tatsächlich anbietet. Ein OpenAI-kompatibler Sprachendpunkt allein bedeutet keine Unterstützung für Musik oder Soundeffekte. Ein Anbieter wie Infermatic muss einen der obigen Verträge oder einen Adapter bereitstellen; sein tatsächlicher Musikendpunkt wurde hier nicht geprüft. ElevenLabs behält seine bisherigen nativen Musik- und Soundeffektanfragen.

Kontextmusik wird weiterhin einmal pro Gebiet oder Begegnungsstufe komponiert und wiederverwendet. Wiederholte Soundeffekte nutzen den Audiocache. Nach einem Generierungsfehler bleibt der Cache für einen erneuten Versuch verfügbar.

## Schritt 2: Base URL, API Key und Model eintragen

Überspring diesen Schritt, wenn du eine Audioverbindung als Source gewählt hast: Marinara verwendet dann die eigenen Einstellungen der Verbindung.

Jede Source braucht eine Webadresse und – bei den meisten – einen API-Key. Ein API-Key ist ein geheimer Code vom Anbieter, der die Anfrage als deine ausweist.

1. Prüf das Feld **Base URL**. Jede Source trägt einen sinnvollen Standard ein, siehe Tabelle unten. Ändere ihn nur, wenn du einen Proxy oder einen selbst gehosteten Server nutzt.
2. Füge den Key des Anbieters in das Feld **API Key** ein. Soll ein vorhandener Key bleiben, lass die maskierten Punkte stehen. Zum Entfernen leerst du das Feld.
3. Prüf das Feld **Model**. Jede Source trägt ein Standardmodell ein. Du kannst auch einen anderen Modellnamen eintippen, den der Anbieter unterstützt.

Diese Standardwerte setzt die App je Source:

| Source            | Standard-Base-URL         | Standardmodell         | Von der App vorbelegte Stimme |
| ----------------- | ------------------------- | ---------------------- | ----------------------------- |
| OpenAI-compatible | https://api.openai.com/v1 | tts-1                  | alloy                         |
| ElevenLabs        | https://api.elevenlabs.io | eleven_multilingual_v2 | keine (du musst eine wählen)  |
| PocketTTS         | http://localhost:8000    | pocket-tts             | alba                          |
| xAI Voice         | https://api.x.ai/v1       | grok-tts               | eve                           |

Bei **ElevenLabs** lädt das Feld **Model** alle sprachfähigen Modelle, die über die Verbindung erreichbar sind, und zeigt beim Öffnen stets die vollständige Liste. Wähle ein normales Sprachmodell. Modell-IDs mit `ttv` sind Voice-Design-Modelle und können keinen Text vorlesen. Greifst du versehentlich zu einem davon, scheitert die Wiedergabe mit einer Fehlermeldung, die auf ein Sprachmodell verweist.

### PocketTTS ist ein eigenes Programm

PocketTTS ist nicht in Marinara Engine eingebaut. Installiere den [offiziellen PocketTTS-Server](https://github.com/kyutai-labs/pocket-tts) separat und starte ihn mit `uvx pocket-tts serve`. Marinara Engine lädt ihn weder herunter noch verwaltet den Server.

Der offizielle Server verwendet standardmäßig `http://localhost:8000`. Lass **Base URL** auf diesem Wert, sofern du Host oder Port nicht geändert hast. Marinara erkennt die offizielle Multipart-API `/tts` automatisch. Bestehende eigene URLs für den [OpenAI-kompatiblen PocketTTS-Wrapper](https://github.com/teddybear082/pocket-tts-openai_streaming_server) werden weiterhin unterstützt.

<a id="request-timeout"></a>

### Zeitlimit für Anfragen

Standardmäßig wartet Marinara bis zu 60 Sekunden auf jede gesprochene Zeile. Ein Sprachserver auf deinem eigenen Computer, vor allem auf einem Laptop, kann für eine lange Zeile länger brauchen. Um länger zu warten, erhöhe in der Karte unter **Model** den Wert **Request timeout (seconds)**. Möglich sind 10 bis 3.600 Sekunden.

Eine Audioverbindung hat ein eigenes Feld **Request timeout (seconds)**, im Verbindungs-Editor unter **Default Voice** (Standardstimme). Sprechen Chats über eine Audioverbindung, auch über eine, die als **Source** der Karte gewählt ist, gilt das Limit dieser Verbindung. Das Limit der Karte gilt für Sprachausgabe mit den eigenen Einstellungen der Karte, einschließlich ihrer Schaltfläche **Preview** (Vorschau).

Dauert eine Zeile zu lange, nennt die Fehlermeldung, wie viele Sekunden Marinara gewartet hat und welche Einstellung du erhöhen solltest.

## Schritt 3: Eine Stimme wählen (Voice Option)

Die Einstellung **Voice Option** legt fest, wie Stimmen zugewiesen werden:

- **One voice for all characters**: Alle Sprechenden nutzen dieselbe Stimme. Das ist der Standard.
- **Selected per character**: Ausgewählte Charaktere bekommen eigene Stimmen.

### One voice for all characters

Wähle die Stimme im Feld **All Characters Voice**. Der offizielle PocketTTS-Server bietet keinen Endpunkt für eine Stimmenliste. Marinara zeigt deshalb seine eingebauten Stimmen und daneben ein Textfeld für einen anderen eingebauten Namen oder eine unterstützte Stimmen-URL. Kompatible Wrapper-Server können weiterhin eigene Stimmenlisten liefern und eigene IDs oder Pfade akzeptieren.

Für die echte Stimmenliste des Anbieters trägst du die Verbindungsdaten ein und klickst auf die Schaltfläche **Refresh voices** (Stimmen neu laden, Symbol mit Kreispfeil). Das geht schon, bevor die Wiedergabe aktiv ist. Der Vorgang speichert zuerst die Karte, damit ein frisch eingetragener API-Key sofort greift. Vor dem Verbinden zeigt die App eine kurze eingebaute Ersatzliste, damit das Feld nicht leer bleibt. Ein Fehler des Anbieters erscheint als Fehlermeldung – die Ersatzliste wird nie stillschweigend als geglücktes Neuladen ausgegeben.

Bei **ElevenLabs** musst du eine Stimme wählen. Marinara lädt die seitenweise Bibliothek des Kontos, inklusive persönlicher, Workspace-, gespeicherter und Standardstimmen. Die Auswahl hat ein Suchfeld und eine dauerhaft sichtbare Bildlaufleiste, sobald die Bibliothek länger als das Panel ist. Außerdem meldet sie, wie viele Stimmen geladen wurden. Sie startet auf „Select an ElevenLabs voice“; bis du eine echte Stimme wählst, bleibt die Wiedergabe gesperrt.

### Selected per character

1. Stell **Voice Option** auf **Selected per character**.
2. Die Tabelle **Character Voices** erscheint, mit den Spalten **Character** und **Voice**.
3. Klick auf **Add character voice** (Charakterstimme hinzufügen), um eine Zeile anzulegen.
4. Wähle links einen Charakter und rechts eine Stimme.
5. Wiederhol das für jeden Charakter, der eine eigene Stimme bekommen soll.

Die Stimme eines Charakters kannst du auch im **Character Editor** auf dem Tab **Voice** wählen. Die Auswahl dort ändert dieselbe Zeile, deshalb zeigen beide Stellen immer dieselbe Stimme.

Die Schaltfläche **Refresh** im Bereich Character Voices lädt dieselbe Anbieter-Bibliothek neu, ohne zurück in den Modus mit einer Stimme zu wechseln. Die Charaktere müssen vorher angelegt sein. Fehlen sie noch, weist die App darauf hin, zuerst im Tab Characters Charaktere anzulegen. Ein Charakter ohne eigene Stimme verwendet die Stimme, die für eine Karte mit passendem Namen festgelegt ist – etwa für das Original einer AU-Kopie. Andernfalls greift er auf die globale Stimme zurück. Siehe [Charaktere anlegen und bearbeiten](../characters/creating-and-editing-characters.md).

## Narrator Voice

Erzählung ist Text, den kein einzelner Charakter spricht – etwa eine Szenenbeschreibung oder die Zeilen eines Game Master. Sie kann eine eigene Stimme bekommen.

1. Aktiviere im Bereich **Narrator Voice** die Option **Use separate narrator voice**.
2. Wähle eine Stimme in der Auswahl, die daraufhin erscheint.

Die App nutzt diese Stimme, sobald als Sprecher Narrator, GM, Game Master oder System hinterlegt ist. Das gilt für Nachrichten in Roleplay und Conversation. Ebenso erfasst sind Erzählzeilen im Game Mode ohne benannten Sprecher. Bei ElevenLabs wählst du hier eine Erzählerstimme. Bleibt das Feld leer, greift die Erzählung nur dann auf eine Ersatzstimme zurück, wenn eine globale Stimme gesetzt ist.

## Random NPC Voices (nur im Game Mode)

Diese Funktion verteilt übrige Stimmen an Nebencharaktere im Spiel. Sie wirkt nur im Game Mode und nur bei NPCs (Nicht-Spieler-Charakteren), die der Game Mode mitführt. In Roleplay und Conversation bleibt sie ohne Wirkung.

1. Aktiviere im Bereich **Random NPC Voices** die Option **Use default voices for random NPCs**.
2. Es erscheinen zwei Raster mit Kontrollkästchen: **Male NPC defaults** und **Female NPC defaults**.
3. Setz ein Häkchen bei den Stimmen, aus denen der jeweilige Pool schöpfen soll.

Ein mitgeführter NPC ohne eigene Stimme bekommt eine feste Zuteilung aus dem passenden Pool. Während einer Sitzung behält derselbe NPC dieselbe Stimme. Ein NPC mit zugewiesener Charakterstimme behält immer diese. Erkennt die App keine als männlich oder weiblich gekennzeichneten Stimmen, nutzt jeder Pool die vollständige Stimmenliste.

## Audio Format und Speed

Die Einstellung **Audio Format** wählt zwischen **MP3** (Standard) und **WAV**. WAV ist für lokale oder selbst gehostete Server gedacht, die kein MP3 liefern können. Zwei Hinweise:

- Bei ElevenLabs ist das Steuerelement **Audio Format** ausgeblendet – dort läuft immer MP3.
- Bei xAI Voice erscheint es zwar, bleibt aber wirkungslos: xAI Voice liefert immer MP3.

Der Schieberegler **Speed** bestimmt das Sprechtempo. Der zulässige Bereich hängt von der Source ab:

- OpenAI-compatible: 0,25- bis 4,0-fache Normalgeschwindigkeit.
- PocketTTS: Kompatible Wrapper können die Einstellung von 0,25 bis 4,0 verwenden; der offizielle Server steuert die Synthesegeschwindigkeit derzeit selbst.
- ElevenLabs: 0,7- bis 1,2-fach.
- xAI Voice: 0,7- bis 1,5-fach.

Liegt ein gespeichertes Tempo außerhalb des Bereichs der aktuellen Source, begrenzt die App es beim Sprechen auf den nächstliegenden erlaubten Wert.

Nur bei **ElevenLabs** kommen zwei weitere Steuerelemente dazu. **Language** erzwingt eine gesprochene Sprache oder bleibt auf **Auto detect**. **Stability** regelt zwischen ausdrucksstarker und gleichmäßiger Sprache.

## Auto-play: Nachrichten automatisch vorlesen

Unter der Überschrift **Auto-play** sorgt jeder Schalter dafür, dass eine bestimmte Art neuer Nachricht direkt nach der Generierung vorgelesen wird. Alle setzen voraus, dass **Enable TTS** an ist. Jeder Schalter startet ausgeschaltet.

- **Roleplay messages**: liest neue Antworten im Roleplay vor.
- **Conversation messages**: liest neue Antworten im Conversation Mode vor.
- **Game narration**: liest neue Erzähl- und Kampfzeilen im Game Mode vor.
- **Progressive playback**: Bei einer Antwort aus mehreren Zeilen startet die erste Zeile sofort, statt auf die ganze Antwort zu warten.
- **Only read dialogues**: liest nur zitierte oder markierte Sprechzeilen und überspringt reine Erzählung.

In Roleplay beginnt die Vorbereitung der Sprachausgabe, sobald die Hauptantwort gespeichert ist. Sprecher und Emotionen werden aus diesem Text ermittelt, ohne auf andere, davon unabhängige Agenten zu warten. Schreibt ein aktivierter Agent wie Prose Guardian die Antwort um, wartet Marinara vor der Sprachvorbereitung auf den endgültigen überarbeiteten Text.

Die automatische Wiedergabe greift genau einmal, bei der neuesten Antwort, im Moment ihrer Fertigstellung. Alte Nachrichten liest sie nicht erneut vor, wenn du einen Chat wieder öffnest oder scrollst.

Dieselben Wiedergabeeinstellungen bieten außerdem **Skip text inside HTML and custom tags** (Text in HTML- und eigenen Tags überspringen), **Skip fenced code blocks** (abgegrenzte Codeblöcke überspringen) und **Skip text inside square brackets** (Text in eckigen Klammern überspringen). Codeblöcke werden standardmäßig übersprungen; die anderen beiden Filter sind zunächst aus. Der Tag-Filter entfernt eingeschlossenen Text, etwa einen verborgenen Block `<simulation>...</simulation>`, behält aber Sprecher-Tags für die Stimmenwahl. Die Filter gelten für manuelle und automatische Wiedergabe, einschließlich Game-Erzählung und Sprechererkennung in Roleplay.

Schalte **Roleplay speaker extractor** (Sprechererkennung in Roleplay) ein, damit **Enable emotion indicators** (Emotionshinweise aktivieren) erscheint. Wenn die Emotionshinweise eingeschaltet sind, bleibt Text in eckigen Klammern für den Sprachdienst erhalten, auch wenn **Skip text inside square brackets** eingeschaltet ist. Das kann auch Notizen einschließen. Sollen Notizen in Klammern nicht vorgelesen werden, schalte die Emotionshinweise aus und lass die Option zum Überspringen eingeschaltet.

Sprechanweisungen wie `[Low, steady voice, restrained urgency]` bleiben vollständig erhalten, wenn eine lange Zeile für die Sprachausgabe aufgeteilt wird. Bekannte Sprecher- und Szenenmarkierungen werden weiterhin entfernt. Das Sprachmodell entscheidet, wie es die einzelnen Anweisungen umsetzt.

Der **Roleplay speaker extractor** ergänzt Sprechanweisungen, ohne den Wortlaut der ursprünglichen Dialoge zu ändern. Wenn **Enable TTS**, **Game narration** und die Emotionshinweise eingeschaltet sind, können auch Szenen-, Party- und Kampfdialoge im Game Mode solche Anweisungen enthalten.

## Eine einzelne Nachricht vorlesen

Sobald TTS aktiv ist, erscheint in der Werkzeugleiste unter jeder Charakter- oder Erzählernachricht eine Schaltfläche **Speak** (Mikrofonsymbol). Sie liest genau diese eine Nachricht auf Zuruf vor.

- Klick auf **Speak**, um die Nachricht vorzulesen. Während die App das Audio holt, zeigt die Schaltfläche einen Ladezustand.
- Ein erneuter Klick während der Wiedergabe stoppt sie. Der Tooltip lautet dann **Stop speaking**.
- Eine Nachricht ohne lesbaren Text – etwa nur ein Bild – zeigt **No dialogue to speak** und bleibt deaktiviert.

Während eine Nachricht spricht, kommen zwei weitere Schaltflächen dazu. **Pause speaking** und **Resume speaking** halten die Wiedergabe an und setzen sie fort. **Restart speaking** beginnt die Nachricht von vorn.

Die Schaltfläche mit dem Lautsprechersymbol öffnet den Regler **Line volume** von 0 bis 100 Prozent, Standard 50. Diese Lautstärke wird eigenständig gespeichert. Sie ist unabhängig vom Mischpult im Game Mode und von der Anruflautstärke in Conversation – eine Änderung wirkt sich nicht auf die anderen aus.

## Zwischengespeicherte Clips

Die App legt generiertes Audio im Browser ab, damit dieselbe Zeile nicht zweimal generiert werden muss. Das Panel **Cached clips** zeigt Anzahl und Gesamtgröße in Echtzeit.

Klick auf die Schaltfläche **Export cached TTS clips** (Download-Symbol), um alle zwischengespeicherten Clips als einzelne Audiodateien auf dem Gerät zu sichern. Der Zwischenspeicher entfernt die ältesten Clips von selbst. Eine Schaltfläche zum manuellen Leeren gibt es in der App nicht – lösch dafür die Browserdaten.

## TTS in den einzelnen Chat-Modi

Dieselbe TTS-Einrichtung bedient alle Modi, mit ein paar Extras je Modus:

- Roleplay nutzt den Auto-play-Schalter **Roleplay messages** und die **Speak**-Steuerung an jeder Nachricht. Siehe [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md).
- Conversation Mode nutzt den Schalter **Conversation messages** und dieselbe **Speak**-Steuerung. Gesprochene Anrufe sind eine größere Funktion und in [Audio- und Videoanrufe in Conversation](../conversation/calls.md) beschrieben.
- Game Mode nutzt den Schalter **Game narration**. Der Game Mode hat zudem ein eigenes Mischpult mit dem Kanal **TTS** neben **Master**, **Music**, **Sound Effects** und **Ambient**. Dieser Kanal regelt die Gesamtlautstärke des gesprochenen Spiel-Audios und startet bei 100 Prozent. Siehe [Game Mode: Erste Schritte](../game/getting-started.md#the-games-controls).

## Phonetic name (Aussprache in Anrufen)

Wird ein Charakter- oder Persona-Name so geschrieben, dass die Stimme ihn falsch ausspricht, hilft ein **Phonetic name** (phonetischer Name). Im **Character Editor** findest du das Feld auf dem Tab **Voice**. Im **Persona Editor** liegt es bei den übrigen Basisangaben. Trag dort ein, wie der Name klingen soll.

Diese Vorgabe greift ausschließlich bei Audio- und Videoanrufen in Conversation. Die normale Schaltfläche **Speak** an einer Nachricht, die automatische Wiedergabe im Chat und die Erzählung im Game Mode lesen das Feld nicht aus.

## Fehlerbehebung

- Die Karte zeigt **Missing Audio connection**: Die als Source gewählte Audioverbindung wurde gelöscht oder lässt sich nicht verwenden. Wähle eine andere Source. Siehe [Eine Audioverbindung verwenden](#use-an-audio-connection).
- Nichts wird gesprochen: Prüf, ob der Schalter **Enable TTS** an ist. Kontrollier dann den passenden **Auto-play**-Schalter für den Modus oder nutze die Schaltfläche **Speak** an der Nachricht. **Speak** und die Auto-play-Optionen erscheinen erst, nachdem TTS aktiviert ist.
- Keine Stimmen im Dropdown-Menü: Speicher die Karte mit aktiviertem TTS und, falls der Anbieter einen verlangt, gültigem API-Key und klick dann auf **Refresh voices**. Der offizielle PocketTTS-Server verwendet Marinaras eingebaute Stimmenliste, weil er keinen Endpunkt für eine Stimmenliste hat. Bei einem kompatiblen PocketTTS-Wrapper prüf, ob `<Base URL>/v1/voices` antwortet.
- ElevenLabs spricht nicht: Achte darauf, dass eine echte Stimme gewählt ist und nicht der Platzhalter „Select an ElevenLabs voice“. Prüf außerdem, ob unter **Model** ein Sprachmodell steht und kein Voice-Design-Modell, dessen ID `ttv` enthält.
- Eine Zeile bricht mit **No audio after 60 s** ab: Der Sprachserver braucht mehr Zeit. Erhöhe **Request timeout (seconds)** dort, wo die Meldung es angibt. Siehe [Zeitlimit für Anfragen](#request-timeout).
- Ein selbst gehosteter TTS-Server auf einer lokalen Adresse wird blockiert: Aktiviere die Server-Einstellung `TTS_LOCAL_URLS_ENABLED`. Damit erreicht die App lokale oder private Adressen für OpenAI-kompatible oder ElevenLabs-artige Server. PocketTTS braucht diese Einstellung nicht. Siehe [Referenz der Server-Konfiguration](../CONFIGURATION.md).
- Einrichtung schnell testen: Klick auf die Schaltfläche **Preview** in der Karte, um mit den aktuellen Einstellungen eine kurze Beispielzeile abzuspielen.

## Weiterführende Anleitungen

- [Audio- und Videoanrufe in Conversation](../conversation/calls.md)
- [Lippensynchronisation mit Sprachausgabe](../agents/avatars.md#lip-sync-with-text-to-speech) für 2D- und 3D-Avatare
- [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md)
- [Game Mode: Erste Schritte](../game/getting-started.md)
- [Unterstützte KI-Anbieter](../connections/providers-reference.md)
- [Charaktere anlegen und bearbeiten](../characters/creating-and-editing-characters.md)
- [Referenz der Server-Konfiguration](../CONFIGURATION.md)
