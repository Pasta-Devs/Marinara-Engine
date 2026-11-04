# Unterstützte KI-Anbieter

Diese Seite ist ein Nachschlagewerk zu den wichtigsten Diensten, mit denen sich Marinara Engine verbinden kann: wo du den API-Key bekommst, welche Adresse standardmäßig gilt und welche Besonderheiten es gibt. Wie du ein Konto Schritt für Schritt hinzufügst, erklärt [Verbindung zu einem KI-Anbieter herstellen](connecting-to-a-provider.md) – lies das zuerst.

Den Dienst wählst du im Fenster **Add account** (Konto hinzufügen), im Abschnitt für seine Aufgabe: **Chat**, **Images & video** (Bilder und Video), **Voice** (Stimme) oder **Decisions** (Entscheidungen). Die Kachel trägt den Namen, der unten steht. Die Adresse ist die Webadresse, an die Marinara die Anfragen schickt. Im Konto-Editor heißt sie **Address** (Adresse), im Modell-Editor **Base URL**. Bei bekannten Diensten trägt Marinara sie selbst ein. Ändere sie nur für einen Proxy oder einen Server, den du betreibst.

Modelle ändern sich oft, deshalb listet diese Seite keine auf. Nach dem Verbinden lädt die Modellliste in der Auswahl. Klick in der Auswahl auf **Refresh model list** (Modellliste aktualisieren), um sie neu zu laden.

## Chat-Dienste

Diese Dienste nutzen einen API-Key, außer den drei Abo-Diensten, die eine Anmeldung auf deinem Rechner nutzen.

| Dienst | Wo du einen Key bekommst |
| --- | --- |
| LinkAPI | `linkapi.ai` |
| OpenAI | `platform.openai.com/api-keys` |
| Anthropic | `console.anthropic.com/settings/keys` |
| Google Gemini | `aistudio.google.com/apikey` |
| Google Vertex AI | `cloud.google.com/vertex-ai/docs/authentication` (Anleitung zu den Zugangsdaten) |
| Mistral | `console.mistral.ai/api-keys` |
| Cohere | `dashboard.cohere.com/api-keys` |
| OpenRouter | `openrouter.ai/keys` |
| NanoGPT | `nano-gpt.com/api` |
| xAI / Grok | `console.x.ai` |
| Arli AI | `www.arliai.com/account` |
| Z.AI | `z.ai/manage-apikey/apikey-list` |
| DeepSeek | `platform.deepseek.com/api_keys` |
| OpenAI-compatible, Claude (Subscription), OpenAI (ChatGPT), Grok CLI (Subscription) | Keine Key-Seite. Siehe die Hinweise unten. |

Standardadressen, die Marinara für dich einträgt:

- LinkAPI: `https://linkapi.ai/v1` (ein OpenAI-kompatibles Gateway mit eigenem Key)
- OpenAI: `https://api.openai.com/v1`
- Anthropic: `https://api.anthropic.com/v1`
- Google Gemini: `https://generativelanguage.googleapis.com/v1beta`
- Google Vertex AI:
  `https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`
- Mistral: `https://api.mistral.ai/v1`
- Cohere: `https://api.cohere.ai/compatibility/v1`
- OpenRouter: `https://openrouter.ai/api/v1`
- NanoGPT: `https://nano-gpt.com/api/v1`
- xAI / Grok: `https://api.x.ai/v1`
- Arli AI: `https://api.arliai.com/v1`
- Z.AI: `https://api.z.ai/api/paas/v4`
- DeepSeek: `https://api.deepseek.com/v1`
- OpenAI-compatible und die Abo-Dienste: keine. Du trägst eine Adresse ein, oder es wird keine gebraucht.

Alle Key-Seiten beginnen mit `https://`.

Die drei Abo-Dienste blenden die Felder **API key** und Adresse aus. Embeddings bieten sie nicht. Installation und Anmeldung beschreibt [Abo-Verbindungen für Claude, ChatGPT und Grok](subscription-clis.md); dort steht auch der Planverbrauch.

Ein Aggregator ist ein Dienst, bei dem ein einziger Key Modelle vieler Firmen erreicht. OpenRouter und NanoGPT sind Aggregatoren. Ein Gateway ist dieselbe Idee für einen Proxy, den du betreibst oder mietest.

## Hinweise zu den Diensten

### OpenAI

**OpenAI** betreibt die GPT-Modelle. Für DALL-E-Bilder fügst du **OpenAI** hinzu und wählst im selben Konto Modelle vom Typ **Image** (Bild). Das gilt auch für die anderen Dienste, die mit demselben Key Bilder erzeugen.

### Anthropic

**Anthropic** betreibt die Claude-Modelle. Mit Prompt-Caching kann der Dienst den Anfang deines Prompts wiederverwenden, was lange Chats günstiger machen kann. Schalte es im Modell-Editor mit **Enable prompt caching** (Prompt-Caching aktivieren) ein. **Anthropic** bietet keine Embeddings (siehe [Embeddings](#embeddings)).

### Google Gemini und Google Vertex AI

**Google Gemini** betreibt die Gemini-Modelle über Google AI Studio. Es ist die einfachere der beiden Google-Optionen. Bei beiden Google-Optionen schaltet Marinara die einstellbaren Sicherheitsfilter von Google aus, außer für Kategorien, die du selbst unter **Custom Parameters** (eigene Parameter) festlegst. Die grundlegenden Schutzmaßnahmen von Google, etwa zum Schutz von Kindern, gelten weiterhin.

**Google Vertex AI** betreibt Gemini über ein Google-Cloud-Projekt und braucht mehr Einrichtung. Bearbeite die Adresse und ersetze `YOUR_PROJECT_ID` durch deine Projekt-ID. Ändere die Region, falls sie nicht `us-central1` lautet. Das Feld **API key** akzeptiert jede der folgenden Arten von Zugangsdaten, und Marinara erkennt, welche du eingefügt hast:

1. Einen Service-Account-JSON-Key (eine Datei von Google Cloud, die einen Service-Account benennt).
2. Ein OAuth-Zugriffstoken, zum Beispiel aus `gcloud auth print-access-token`.
3. Einen Vertex-API-Key.

**Gemini 4 Argon** läuft laut einem Hinweis im Code von Marinara, der der Dokumentation von Google folgt, nur an den Standorten `global`, `us` und `eu`, nicht in einer einzelnen Region wie `us-central1`. Um es zu nutzen, setz die Adresse auf `https://aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/global`. Bei einem anderen Standort gibt Google einen Fehler zurück, und Marinara zeigt ihn an.

### Cohere

**Cohere** nutzt seinen OpenAI-kompatiblen Endpunkt. Fügst du eine ältere Cohere-v2-Adresse ein, stellt Marinara sie für dich auf den Kompatibilitäts-Endpunkt um.

### OpenRouter

**OpenRouter** ist ein Aggregator mit zwei zusätzlichen Optionen im Modell-Editor:

- **Preferred provider** (bevorzugter Anbieter) zwingt die Weiterleitung zu genau einem benannten Backend. Der Name muss dem auf der OpenRouter-Modellseite entsprechen. Lass das Feld für automatische Weiterleitung leer.
- **Enable prompt caching** schickt Caching-Hinweise für Claude-Modelle, die über OpenRouter laufen. Die meisten anderen Modelle speichern von selbst zwischen.

### NanoGPT

**NanoGPT** ist ein Aggregator ohne eingebaute Modellliste. Nach dem Verbinden lädt die Auswahl die Modelle, die dein Konto nutzen kann. Sie liest den detaillierten Katalog von NanoGPT und kennzeichnet, welche Modelle dein Abonnement abdeckt:

| Kennzeichen | Bedeutung |
| --- | --- |
| `1x` in Grün | Im Abonnement enthalten, zum normalen Satz. |
| Ein höherer Wert wie `2x` | Enthalten, aber jedes Eingabetoken verbraucht entsprechend viele Tokens deines Kontingents. |
| **Paid** | Nicht enthalten. Die Nutzung wird über dein bezahltes Guthaben abgerechnet. |
| Kein Kennzeichen | NanoGPT hatte keine Abonnementdaten dazu. |

#### Abonnementverbrauch

Mit einem NanoGPT-Abonnement kann das Konto dein aktuelles Kontingent anzeigen.

1. Klick in der Zeile des Kontos auf **⋯**, wähl **Edit account** (Konto bearbeiten) und öffne **Usage and balance** (Nutzung und Guthaben).
2. Sind Abfragen von außen ausgeschaltet, klick auf **Turn on** (einschalten). Um einen Verwaltungs-Key hinzuzufügen, klick auf **Add a usage-only key** (Key nur für die Nutzung hinzufügen), füge ihn ein und klick auf **Show usage** (Nutzung anzeigen).
3. Schalte **Show the usage meter on the card** (Nutzungsanzeige auf der Karte zeigen) ein und speichere.

Die Anzeige zeigt deine wöchentlichen und täglichen Eingabetoken-Kontingente, jeweils mit dem Rest und dem Zeitpunkt der Zurücksetzung, zum Beispiel `42M remaining · resets in 4d`. Ein Kontingent, das NanoGPT nicht melden kann, erscheint als unbekannt, nicht als ungenutzt. Ein inaktives Abonnement wird ausdrücklich gekennzeichnet, statt als voll dargestellt zu werden. Die Aktualisierungsschaltfläche liest es erneut.

Zwei Zugangsdaten können die Nutzung lesen:

- **Management key** (empfohlen). Erstelle unter `https://nano-gpt.com/settings#management-api-tokens` einen Key nur für Nutzungsabfragen. Er liest Kontingente, kann aber keine Modelle ausführen und kein Guthaben ausgeben. Marinara speichert ihn verschlüsselt und sendet ihn nur an den Verwaltungsendpunkt von NanoGPT.
- **Dein API-Key**, der verwendet wird, wenn kein Management key gespeichert ist. Das funktioniert, aber die Kontingentabfrage nutzt dann einen Key, mit dem sich dein Guthaben ausgeben lässt.

Dieselbe Anzeige erscheint unter dem Kontextbalken in der Verbindungsauswahl eines Chats und in dessen Einstellungen unter **Connection** (Verbindung). Sie erscheint nur, wenn das Modell des Chats ein NanoGPT-Modell mit eingeschalteter Anzeige ist, und nicht bei **Shuffle** (Zufallsauswahl).

### xAI / Grok

**xAI / Grok** betreibt die Grok-Modelle. Grok 4.6 und 4.7 haben ein Kontextfenster von 500.000 Tokens und Reasoning bis **Extra high**. Sie unterstützen die Chat-Tools einschließlich **Web Search** (Websuche), sodass Suchergebnisse in die fertige Antwort einfließen können.

### Arli AI

**Arli AI** ist ein gehosteter Chat-Dienst ohne eingebaute Modellliste. Nach dem Verbinden lädt die Auswahl seine Modelle. Für Bilder von Arli AI fügst du **Arli AI** hinzu und wählst im selben Konto Modelle vom Typ **Image**.

### Z.AI

**Z.AI** stellt die GLM-Modelle (GLM 5.3, GLM 5.3 Flash und frühere) über eine eigene API bereit. Modelle der Reihen GLM 5.2 und 5.3 akzeptieren die Reasoning-Stufe **Maximum**. Die Standardadresse führt zum nutzungsabhängig abgerechneten Endpunkt. Der Coding Plan von Z.AI nutzt einen anderen Endpunkt, daher funktioniert ein Key für den Coding Plan hier möglicherweise nicht.

### DeepSeek

**DeepSeek** stellt `deepseek-flash` und `deepseek-v4-pro` bereit. DeepSeek denkt standardmäßig nach. **Reasoning Effort** (Denkaufwand) nutzt hier die eigenen Stufen von DeepSeek, und **Off** (aus) schaltet das Nachdenken für diese Anfrage ab. Eine Anfrage mit mittlerer Stufe behandelt DeepSeek wie High. Das Nachdenken erscheint in der Antwort mit der üblichen Gedankenanzeige.

Manche Parameter gelten nicht, deshalb lässt das Panel sie weg: **Verbosity**, **Top K** und die Wiederholungsstrafen sind abgeschafft und werden ignoriert. **Temperature** und **Top P** bilden ein Paar, weil DeepSeek jeweils nur einen davon nutzt. **Temperature** siehst du, wenn das Nachdenken aus ist, **Top P**, wenn es an ist.

Verbinde DeepSeek über seine eigene Kachel, statt **OpenAI** auf die Adresse von DeepSeek zu richten. Der OpenAI-Dienst erwartet die Modelle von OpenAI. Bei einem DeepSeek-Modell blendet er deshalb die Regler für die Generierung aus und sendet fast keine deiner Einstellungen mit.

### OpenAI-compatible

**OpenAI-compatible** verbindet einen Server oder Proxy, der das Anfrageformat von OpenAI akzeptiert, etwa Ollama, LM Studio oder KoboldCpp. Im Fenster **Add account** erscheint der Dienst als **OpenAI-compatible address** (OpenAI-kompatible Adresse). Bei den meisten lokalen Servern kann der Key leer bleiben. Die Adresse trägst du selbst ein. Siehe [Ein lokales oder selbst gehostetes Modell verbinden](local-self-hosted.md). Zum kleinen Modell, das Marinara selbst ausführt, siehe [Eingebautes Modell einrichten](local-model.md).

## Bilder und Video

Unter **Images & video** hat jede Kachel ihre eigene Adresse und ihre eigene Regel dazu, ob ein Key nötig ist. Die Kacheln sind Stability AI, Together AI, NovelAI, Venice.ai, Atlas Cloud, fal.ai, SpicyAPI, Pollinations, Stable Horde, Seedance 2.0 und lokale Server: ComfyUI, SD Web UI (AUTOMATIC1111 / Forge), SwarmUI, RunPod Serverless (ComfyUI), Draw Things und Block Entropy. Draw Things, ComfyUI, SwarmUI, SD Web UI und RunPod tragen das Kennzeichen **Self-hosted**.

Bild- und Videomodelle von OpenAI, OpenRouter, xAI, NanoGPT, Arli AI, Z.AI und Google kommen aus deinem Chat-Konto für diesen Dienst. Füge das Chat-Konto hinzu und wähle darin Modelle vom Typ **Image** oder **Video**.

Siehe [Anbieter für Bildgenerierung und Einrichtung](../media/image-providers.md) und [Szenenvideos generieren](../media/scene-video.md).

## Decision

Unter **Decisions** stehen die Kacheln **TypeSafe** (Standardadresse `https://api.typesafe.ai`), **Own decision server** (eigener Decision-Server) und **Built-in model (decisions)**. Chat-Dienste, die das Chatformat von OpenAI nutzen, können ebenfalls Decisions beantworten, aber nur mit einem Modell, das Log-Wahrscheinlichkeiten liefert (Werte für jede mögliche Antwort). Ein Decision-Modell beantwortet Ja/Nein-Fragen zu deinem Chat. Siehe [Decision-Modelle](decision-models.md).

## Audio

Unter **Voice** spricht ein Audiodienst Charakterstimmen und Erzähltext. Wähle eine **Audio source** (Audioquelle):

| Quelle | Was sie ist |
| --- | --- |
| ElevenLabs | Charakterstimmen und Erzähltext. |
| OpenAI-compatible | OpenAI oder jeder Server, der das Sprachformat von OpenAI nachbildet. |
| PocketTTS | Ein kostenloser Sprachserver, den du auf deinem eigenen Rechner betreibst. |
| xAI Voice | Der Sprachdienst von xAI. |

Jede Quelle trägt eine Standardadresse und ein Standardmodell ein. **Default voice** (Standardstimme) ist die Stimme, die gilt, solange nichts Spezifischeres festgelegt ist, etwa eine eigene Stimme pro Charakter. **Request timeout (seconds)** legt fest, wie lange Marinara auf eine gesprochene Zeile wartet. Erhöhe den Wert bei einem langsamen Sprachserver.

Um das Sprachkonto festzulegen, das Marinara standardmäßig nutzt, klick im Bereich **Jobs** (Aufgaben) auf die Zeile **Voice (Text to Speech)**. Um damit Nachrichten vorlesen zu lassen, wähle es in der Karte **Text to Speech** als **Source** (Quelle). Siehe [Text to Speech (TTS) einrichten](../media/tts-setup.md) und [Eine Audioverbindung verwenden](../media/tts-setup.md#use-an-audio-connection).

<a id="music--sound-effects"></a>

## Musik und Soundeffekte

Dieser Kontotyp erzeugt Instrumentalmusik und Soundeffekte getrennt von der Sprachausgabe. Im Fenster **Add account** gibt es keine Kachel dafür. Solche Konten entstehen durch ein Upgrade (siehe unten) oder einen Import. Bearbeiten kannst du eines mit **Edit model** (Modell bearbeiten); dort wählst du seinen Dienst und schaltest **Music generation** (Musikgenerierung), **Sound-effect generation** (Soundeffektgenerierung) oder beides ein. Die Game-Einrichtung fragt unter **Music & Sound Effects account** (Konto für Musik und Soundeffekte) nach einem solchen Konto; die Standardauswahl ist **Use the default Music & Sound Effects account** (Standardkonto für Musik und Soundeffekte verwenden).

Die Dienste:

- **ElevenLabs**: Standardadresse `https://api.elevenlabs.io`. Braucht einen ElevenLabs-Key. Musik und Soundeffekte haben getrennte Modellfelder.
- **SunoAPI**: Standardadresse `https://apibox.erweima.ai`. Braucht einen Key von [sunoapi.org](https://sunoapi.org/) und, wenn Musik eingeschaltet ist, eine öffentliche HTTPS-Adresse unter **SunoAPI music callback URL** (Callback-URL für SunoAPI-Musik). Das ist der eigene Dienst von SunoAPI, nicht die Anmeldung mit einem Suno-Abo.
- **Custom compatible server** (eigener kompatibler Server): die Adresse deines Servers. Braucht einen ausdrücklichen Endpunktpfad für Musik oder Soundeffekte und ein unterstütztes Anfrageformat. Siehe [kompatible Audioverträge](../media/tts-setup.md#game-music-and-sound-effects-on-a-compatible-audio-server).

Hinweise:

- SunoAPI braucht die Callback-Adresse, obwohl Marinara selbst prüft, wann der Titel fertig ist. Die Adresse stellst du bereit. Marinara erstellt keine.
- Musikstil-Prompts dürfen bis zu 1.000 Zeichen lang sein, Soundeffekt-Prompts bis zu 500.
- Jede Anfrage kann bei deinem Anbieter Geld kosten. Siehe die [Musik-API](https://docs.sunoapi.org/suno-api/generate-music) und die [Soundeffekt-API](https://docs.sunoapi.org/suno-api/generate-sounds). SunoAPI-Soundeffekte wurden noch nicht mit einem kostenpflichtigen Konto geprüft.

Beim Upgrade bekommt jedes Audio-Konto mit eingeschalteter Generierung ein separates Konto für Music & Sound Effects. Ältere eigenständige ElevenLabs-Einstellungen für Game können ein eigenes erzeugen, sodass du mehr als eines sehen kannst. Sprachkonten und Stimmenzuweisungen bleiben unverändert, und gespeicherte Game-Konto-IDs ändern sich nicht. Die Generierung funktioniert nur, wenn das passende migrierte Konto verfügbar ist und darin die Option für Musik oder Soundeffekte eingeschaltet ist. Wähle andernfalls ein anderes geeignetes Konto. Entfernst du ein migriertes Konto, wird es beim Neustart nicht neu angelegt. Aus einem Profil wiederhergestellte Endpunkte bleiben unverfügbar, bis du sie lokal geprüft und gespeichert hast.

Schalte generiertes Audio für jedes Game einzeln ein, oder schalte **Sound effects** (Soundeffekte) in den Befehlseinstellungen von Roleplay ein, um `[sound: description]` zu verwenden. Gacha Forge hat eine eigene Einstellung für generatives Audio. Die mitgelieferten Game-Sounds bleiben verfügbar, wenn die Generierung aus ist.

## Embeddings

Embeddings verwandeln Text in Zahlenlisten, damit Marinara verwandten Text finden kann. Sie treiben die semantische Suche in Lorebooks und Memory Recall an. Bei den meisten Chat-Diensten kannst du im Modell-Editor unter **Semantic search (embeddings)** (semantische Suche) ein Embedding-Modell und optional eine **Embedding endpoint URL** angeben.

**Anthropic**, **Claude (Subscription)**, **OpenAI (ChatGPT)** und **Grok CLI (Subscription)** können keine Embeddings erzeugen. Nutze dort das Dropdown-Menü **Embedding provider** (Embedding-Anbieter), um ein anderes Konto mitzuverwenden, etwa ein OpenAI-kompatibles, **Google Gemini** oder das **Built-in model** (eingebautes Modell).

Um eine Embedding-Quelle für jedes Konto ohne eigene Embedding-Einstellungen zu nutzen, klick im Bereich **Jobs** auf die Zeile **Embeddings**. **Marinara's own search** (Marinaras eigene Suche) behält das eingebaute Embedding-Modell bei. Das eigene Embedding-Modell oder der **Embedding provider** eines Kontos hat weiterhin Vorrang. Vektorisiere deine Lorebooks und Erinnerungen neu, nachdem du die Quelle geändert hast. Siehe [Semantische Suche für Lorebooks](../lorebooks/semantic-search.md).

## Zeitlimits

Langsame Modelle können an die Zeitlimits des Servers für Chat-Antworten und Agentenaufrufe stoßen. Die Servereinstellungen dafür stehen unter [Server-Konfiguration](../CONFIGURATION.md).

## Verwandte Anleitungen

- [Verbindung zu einem KI-Anbieter herstellen](connecting-to-a-provider.md)
- [Abo-Verbindungen für Claude, ChatGPT und Grok](subscription-clis.md)
- [Ein lokales oder selbst gehostetes Modell verbinden](local-self-hosted.md)
- [Anbieter für Bildgenerierung und Einrichtung](../media/image-providers.md)
- [Szenenvideos generieren](../media/scene-video.md)
- [Decision-Modelle](decision-models.md)
- [Text to Speech (TTS) einrichten](../media/tts-setup.md)
