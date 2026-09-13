# Text to Speech (TTS) einrichten

In dieser Anleitung erfährst du, wie du Text to Speech in Marinara Engine einrichtest, damit die App Nachrichten und Spielerzählungen laut vorliest. Text to Speech (TTS) ist die Sprachausgabe: Sie verwandelt geschriebenen Chat-Text in gesprochenes Audio. Es geht um die Wahl eines Sprachanbieters, um Stimmen, um die automatische Wiedergabe und um die Steuerung pro Nachricht.

## Wo die TTS-Einstellungen liegen

Fast alles zu TTS steckt an einer einzigen Stelle. Öffne das Panel **Connections** (Verbindungen) und such die Karte **Text to Speech**. Sie ist standardmäßig zugeklappt – klick auf die Kopfzeile, um sie aufzuklappen.

Die App schickt TTS-Anfragen über den eigenen Server. Marinara speichert den API-Key des Anbieters verschlüsselt auf dem Server. Nach dem Speichern zeigt das Feld nur noch eine Punktreihe statt des echten Keys. Der echte Key geht nie an den Browser zurück.

TTS einzuschalten bringt noch nichts zum Sprechen. Es blendet lediglich die Schaltfläche **Speak** (Vorlesen) an jeder Nachricht und die Optionen unter **Auto-play** (automatische Wiedergabe) ein. Was wann vorgelesen wird, entscheidest weiterhin du.

In denselben Wiedergabeeinstellungen kannst du auch **Skip text inside HTML and custom tags** (Text in HTML- und eigenen Tags überspringen), **Skip fenced code blocks** (abgegrenzte Codeblöcke überspringen) oder **Skip text inside square brackets** (Text in eckigen Klammern überspringen) aktivieren. Codeblöcke werden standardmäßig übersprungen; die anderen beiden Filter sind zunächst ausgeschaltet. Der Tag-Filter entfernt den eingeschlossenen Text, etwa einen verborgenen Block `<simulation>...</simulation>`, behält aber Sprecher-Tags für die Stimmenauswahl bei. Die Filter gelten für manuelle und automatische Wiedergabe, einschließlich Game-Erzählung und Sprechererkennung in Roleplay.

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

## Schritt 2: Base URL, API Key und Model eintragen

Jede Source braucht eine Webadresse und – bei den meisten – einen API-Key. Ein API-Key ist ein geheimer Code vom Anbieter, der die Anfrage als deine ausweist.

1. Prüf das Feld **Base URL**. Jede Source trägt einen sinnvollen Standard ein, siehe Tabelle unten. Ändere ihn nur, wenn du einen Proxy oder einen selbst gehosteten Server nutzt.
2. Füge den Key des Anbieters in das Feld **API Key** ein. Soll ein vorhandener Key bleiben, lass die maskierten Punkte stehen. Zum Entfernen leerst du das Feld.
3. Prüf das Feld **Model**. Jede Source trägt ein Standardmodell ein. Du kannst auch einen anderen Modellnamen eintippen, den der Anbieter unterstützt.

Diese Standardwerte setzt die App je Source:

| Source            | Standard-Base-URL         | Standardmodell         | Von der App vorbelegte Stimme |
| ----------------- | ------------------------- | ---------------------- | ----------------------------- |
| OpenAI-compatible | https://api.openai.com/v1 | tts-1                  | alloy                         |
| ElevenLabs        | https://api.elevenlabs.io | eleven_multilingual_v2 | keine (du musst eine wählen)  |
| PocketTTS         | http://localhost:49112    | pocket-tts             | alba                          |
| xAI Voice         | https://api.x.ai/v1       | grok-tts               | eve                           |

Bei **ElevenLabs** lädt das Feld **Model** alle sprachfähigen Modelle, die über die Verbindung erreichbar sind, und zeigt beim Öffnen stets die vollständige Liste. Wähle ein normales Sprachmodell. Modell-IDs mit `ttv` sind Voice-Design-Modelle und können keinen Text vorlesen. Greifst du versehentlich zu einem davon, scheitert die Wiedergabe mit einer Fehlermeldung, die auf ein Sprachmodell verweist.

### PocketTTS ist ein eigenes Programm

PocketTTS steckt nicht in Marinara Engine. Der Adapter von Marinara nutzt den [OpenAI-kompatiblen PocketTTS-Server](https://github.com/teddybear082/pocket-tts-openai_streaming_server), der beide von Marinara benötigten Endpunkte bereitstellt: Sprachausgabe und Stimmenliste. Installiere und starte diesen Server nach dessen Anleitung – Marinara lädt ihn weder herunter noch verwaltet sie ihn.

Der kompatible Server läuft standardmäßig auf `http://localhost:49112`. Lass **Base URL** auf diesem Wert, sofern du den Server-Port nicht geändert hast. Bereits vorhandene eigene PocketTTS-Adressen bleiben unverändert.

## Schritt 3: Eine Stimme wählen (Voice Option)

Die Einstellung **Voice Option** legt fest, wie Stimmen zugewiesen werden:

- **One voice for all characters**: Alle Sprechenden nutzen dieselbe Stimme. Das ist der Standard.
- **Selected per character**: Ausgewählte Charaktere bekommen eigene Stimmen.

### One voice for all characters

Wähle die Stimme im Feld **All Characters Voice**. Bei PocketTTS erscheinen die vom Server gelieferten Stimmen in einem Dropdown-Menü; daneben bleibt ein Textfeld für eine eigene Voice-ID, URL oder Pfadangabe.

Für die echte Stimmenliste des Anbieters trägst du die Verbindungsdaten ein und klickst auf die Schaltfläche **Refresh voices** (Stimmen neu laden, Symbol mit Kreispfeil). Das geht schon, bevor die Wiedergabe aktiv ist. Der Vorgang speichert zuerst die Karte, damit ein frisch eingetragener API-Key sofort greift. Vor dem Verbinden zeigt die App eine kurze eingebaute Ersatzliste, damit das Feld nicht leer bleibt. Ein Fehler des Anbieters erscheint als Fehlermeldung – die Ersatzliste wird nie stillschweigend als geglücktes Neuladen ausgegeben.

Bei **ElevenLabs** musst du eine Stimme wählen. Marinara lädt die seitenweise Bibliothek des Kontos, inklusive persönlicher, Workspace-, gespeicherter und Standardstimmen. Die Auswahl hat ein Suchfeld und eine dauerhaft sichtbare Bildlaufleiste, sobald die Bibliothek länger als das Panel ist. Außerdem meldet sie, wie viele Stimmen geladen wurden. Sie startet auf „Select an ElevenLabs voice“; bis du eine echte Stimme wählst, bleibt die Wiedergabe gesperrt.

### Selected per character

1. Stell **Voice Option** auf **Selected per character**.
2. Die Tabelle **Character Voices** erscheint, mit den Spalten **Character** und **Voice**.
3. Klick auf **Add character voice** (Charakterstimme hinzufügen), um eine Zeile anzulegen.
4. Wähle links einen Charakter und rechts eine Stimme.
5. Wiederhol das für jeden Charakter, der eine eigene Stimme bekommen soll.

Die Schaltfläche **Refresh** im Bereich Character Voices lädt dieselbe Anbieter-Bibliothek neu, ohne zurück in den Modus mit einer Stimme zu wechseln. Die Charaktere müssen vorher angelegt sein. Fehlen sie noch, weist die App darauf hin, zuerst im Tab Characters Charaktere anzulegen. Charaktere ohne eigene Stimme greifen auf die globale Stimme zurück. Siehe [Charaktere erstellen und bearbeiten](../characters/creating-and-editing-characters.md).

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

- OpenAI-compatible und PocketTTS: 0,25- bis 4,0-fache Normalgeschwindigkeit.
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

Die automatische Wiedergabe greift genau einmal, bei der neuesten Antwort, im Moment ihrer Fertigstellung. Alte Nachrichten liest sie nicht erneut vor, wenn du einen Chat wieder öffnest oder scrollst.

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
- Game Mode nutzt den Schalter **Game narration**. Der Game Mode hat zudem ein eigenes Mischpult mit dem Kanal **TTS** neben **Master**, **Music**, **Sound Effects** und **Ambient**. Dieser Kanal regelt die Gesamtlautstärke des gesprochenen Spiel-Audios und startet bei 100 Prozent. Siehe [Game Mode: Erste Schritte](../game/getting-started.md).

## Phonetic name (Aussprache in Anrufen)

Wird ein Charakter- oder Persona-Name so geschrieben, dass die Stimme ihn falsch ausspricht, hilft ein **Phonetic name** (phonetischer Name). Im **Character Editor** steht das Feld neben dem Feld **Name** des Charakters. Im **Persona Editor** liegt es bei den übrigen Basisangaben. Trag dort ein, wie der Name klingen soll.

Diese Vorgabe greift ausschließlich bei Audio- und Videoanrufen in Conversation. Die normale Schaltfläche **Speak** an einer Nachricht, die automatische Wiedergabe im Chat und die Erzählung im Game Mode lesen das Feld nicht aus.

## Fehlerbehebung

- Nichts wird gesprochen: Prüf, ob der Schalter **Enable TTS** an ist. Kontrollier dann den passenden **Auto-play**-Schalter für den Modus oder nutze die Schaltfläche **Speak** an der Nachricht. **Speak** und die Auto-play-Optionen erscheinen erst, nachdem TTS aktiviert ist.
- Keine Stimmen im Dropdown-Menü: Speicher die Karte mit aktiviertem TTS und gültigem API-Key und klick dann auf **Refresh voices**. Bei PocketTTS prüf zusätzlich, ob `<Base URL>/v1/voices` vom kompatiblen Server antwortet.
- ElevenLabs spricht nicht: Achte darauf, dass eine echte Stimme gewählt ist und nicht der Platzhalter „Select an ElevenLabs voice“. Prüf außerdem, ob unter **Model** ein Sprachmodell steht und kein Voice-Design-Modell, dessen ID `ttv` enthält.
- Ein selbst gehosteter TTS-Server auf einer lokalen Adresse wird blockiert: Aktiviere die Server-Einstellung `TTS_LOCAL_URLS_ENABLED`. Damit erreicht die App lokale oder private Adressen für OpenAI-kompatible oder ElevenLabs-artige Server. PocketTTS braucht diese Einstellung nicht. Siehe [Referenz der Server-Konfiguration](../CONFIGURATION.md).
- Einrichtung schnell testen: Klick auf die Schaltfläche **Preview** in der Karte, um mit den aktuellen Einstellungen eine kurze Beispielzeile abzuspielen.

## Weiterführende Anleitungen

- [Audio- und Videoanrufe in Conversation](../conversation/calls.md)
- [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md)
- [Game Mode: Erste Schritte](../game/getting-started.md)
- [Unterstützte KI-Anbieter](../connections/providers-reference.md)
- [Charaktere erstellen und bearbeiten](../characters/creating-and-editing-characters.md)
- [Referenz der Server-Konfiguration](../CONFIGURATION.md)
