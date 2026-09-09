# Unterstützte KI-Anbieter

Diese Anleitung listet jeden KI-Anbieter auf, mit dem sich Marinara Engine verbinden kann. Zu jedem steht hier, wo du einen API-Key bekommst, welche Base URL standardmäßig gilt und welche Besonderheiten es gibt. Ein API-Key ist ein geheimes Passwort vom Anbieter, mit dem Marinara dessen KI-Dienst ansprechen darf.

Wie eine Verbindung grundsätzlich entsteht, erklärt [Mit einem KI-Anbieter verbinden](connecting-to-a-provider.md) – lies das zuerst. Diese Seite ist ein Nachschlagewerk für Details zu einzelnen Anbietern.

## So liest du diese Seite

Den Anbieter wählst du beim Anlegen einer Verbindung im Panel **Connections** (Verbindungen). Jeder Anbieter hat im Fenster **Create Connection** (Verbindung anlegen) eine eigene **Provider**-Schaltfläche (Anbieter), beschriftet genau mit dem Namen aus der Liste unten.

Die meisten Anbieter auf dieser Seite sind Cloud-Dienste und hosten die KI für dich. Du legst beim Anbieter ein Konto an, kopierst einen API-Key und fügst ihn in das Feld **API Key** ein. Drei Abo-Anbieter arbeiten statt mit einem Key mit einer lokalen Anmeldung. Ihre Abschnitte weisen darauf hin.

Zwei Begriffe tauchen immer wieder auf:

- Base URL: die Webadresse, an die Marinara die Anfragen schickt. Die meisten Anbieter tragen sie automatisch ein. Ändern musst du sie nur bei lokalen oder eigenen Servern.
- Modell: das konkrete KI-Modell, das du nach der Anbieterwahl aussuchst. Weil sich das Angebot ständig ändert, listet diese Seite keine Modelle auf. Die aktuelle Auswahl zeigen das Dropdown-Menü **Model** und die Schaltfläche **Fetch Models from API** (Modelle über die API laden) im Verbindungs-Editor.

## OpenAI

- Key bekommst du hier: `https://platform.openai.com/api-keys`
- Standard-Base-URL: `https://api.openai.com/v1`

**OpenAI** betreibt die GPT-Modellfamilie. Nach dem Einfügen des Keys wählst du ein Modell aus dem Dropdown-Menü oder klickst auf **Fetch Models from API**, um die aktuelle Liste zu laden. Diese Verbindung ist ausschließlich für Chat-Modelle gedacht. Für DALL-E-Bilder nimmst du stattdessen den Anbieter **Image Generation** (Bildgenerierung) und dessen Dienst **OpenAI (DALL-E)**.

## Anthropic

- Key bekommst du hier: `https://console.anthropic.com/settings/keys`
- Standard-Base-URL: `https://api.anthropic.com/v1`

**Anthropic** betreibt die Claude-Modelle. Der Anbieter unterstützt Prompt-Caching, was lange Chats günstiger machen kann. Einschalten lässt es sich über den Schalter **Enable prompt caching** (Prompt-Caching aktivieren) im Verbindungs-Editor.

**Anthropic** bietet keine Embeddings. Embeddings verwandeln Text in Zahlenlisten, damit Marinara Lorebooks (Sammlungen von Weltwissen) und das Gedächtnis durchsuchen kann. Dafür brauchst du eine separate Embedding-Verbindung (siehe Abschnitt „Embeddings“ weiter unten).

## Google Gemini

- Key bekommst du hier: `https://aistudio.google.com/apikey`
- Standard-Base-URL: `https://generativelanguage.googleapis.com/v1beta`

**Google Gemini** betreibt die Gemini-Modelle über Google AI Studio. Von den beiden Google-Optionen ist das die einfachere.

## Google Vertex AI

- Doku zu den Zugangsdaten: `https://cloud.google.com/vertex-ai/docs/authentication`
- Standard-Base-URL: `https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`

**Google Vertex AI** betreibt Gemini-Modelle über ein Google-Cloud-Projekt. Die Einrichtung ist aufwendiger als bei **Google Gemini**. Du musst die **Base URL** bearbeiten und `YOUR_PROJECT_ID` durch die echte Projekt-ID ersetzen. Ändere außerdem die Region, falls sie nicht `us-central1` lautet.

Das Feld **API Key** akzeptiert drei Arten von Zugangsdaten, und Marinara erkennt automatisch, welche davon du eingefügt hast:

1. Einen Service-Account-JSON-Key.
2. Ein OAuth-Zugriffstoken, zum Beispiel aus `gcloud auth print-access-token`.
3. Einen Vertex-API-Key.

## Mistral

- Key bekommst du hier: `https://console.mistral.ai/api-keys`
- Standard-Base-URL: `https://api.mistral.ai/v1`

**Mistral** betreibt die Mistral-Modellfamilie. Außer dem API-Key ist nichts einzurichten.

## Cohere

- Key bekommst du hier: `https://dashboard.cohere.com/api-keys`
- Standard-Base-URL: `https://api.cohere.ai/compatibility/v1`

**Cohere** nutzt standardmäßig seinen OpenAI-kompatiblen Endpunkt. Fügst du eine ältere Cohere-v2-URL ein, stellt Marinara sie automatisch auf den Kompatibilitäts-Endpunkt um. Die Anfragen funktionieren trotzdem.

## OpenRouter

- Key bekommst du hier: `https://openrouter.ai/keys`
- Standard-Base-URL: `https://openrouter.ai/api/v1`

**OpenRouter** ist ein Aggregator. Ein einziger Key öffnet dir viele Modelle vieler Firmen. Im Verbindungs-Editor kommen zwei zusätzliche Optionen dazu:

- **Preferred Provider** (bevorzugter Anbieter): ein Textfeld, das **OpenRouter** zu genau einem benannten Backend zwingt. Der Name muss exakt dem auf der OpenRouter-Modellseite entsprechen. Leer lassen heißt automatische Weiterleitung.
- **Enable prompt caching**: schickt Caching-Hinweise für Claude-Modelle, die über **OpenRouter** laufen. Die meisten anderen Modelle bei **OpenRouter** cachen selbst und brauchen das nicht.

## NanoGPT

- Key bekommst du hier: `https://nano-gpt.com/api`
- Standard-Base-URL: `https://nano-gpt.com/api/v1`

**NanoGPT** ist ebenfalls ein Aggregator. Eine eingebaute Modellliste gibt es nicht, deshalb bleibt das Dropdown-Menü **Model** zunächst leer. Klick nach dem Einfügen des Keys auf **Fetch Models from API**, um die für dein Konto verfügbaren Modelle zu laden.

## xAI / Grok

- Key bekommst du hier: `https://console.x.ai`
- Standard-Base-URL: `https://api.x.ai/v1`

**xAI / Grok** betreibt die Grok-Modelle. Wählst du diesen Anbieter im Fenster **Create Connection**, trägt Marinara Grok 4.5 als Modell vor. Ändern lässt sich das jederzeit.

## Z.AI

- Key bekommst du hier: `https://z.ai/manage-apikey/apikey-list`
- Standard-Base-URL: `https://api.z.ai/api/paas/v4`

**Z.AI** stellt die GLM-Modelle (GLM 5.3, GLM 5.3 Flash und frühere) über eine eigene API bereit. Die Dropdown-Liste **Model** zeigt die aktuellen GLM-Modelle; **Fetch Models from API** aktualisiert sie anhand deines Kontos. Modelle der Reihe GLM 5.3 nutzen immer Reasoning: **Reasoning Effort** (Denkaufwand) in deinem Preset wird auf die drei von Z.AI unterstützten Stufen abgebildet: **Low** (niedrig), **High** (hoch) und **Maximum** (maximal). Lässt du die Einstellung offen, gilt der Standard von Z.AI: **Maximum**. Die Standard-Base-URL führt zum nutzungsabhängig abgerechneten Endpoint. Der Coding Plan von Z.AI verwendet einen anderen Endpoint, den die Nutzungsrichtlinie den Tools auf der Liste des Anbieters vorbehält. Ein Key für den Coding Plan funktioniert hier daher voraussichtlich nicht.

## Claude (Subscription)

- API-Key: keiner. Stattdessen meldest du dich in einem lokalen Werkzeug an.

**Claude (Subscription)** nutzt dein Anthropic-Pro- oder -Max-Abo über das Werkzeug Claude Code. Das Werkzeug läuft auf dem Rechner mit dem Marinara-Server, und du meldest dich einmalig an. Die Felder **API Key** und **Base URL** sind bei diesem Anbieter ausgeblendet. Embeddings bietet er nicht (siehe Abschnitt „Embeddings“ weiter unten).

Installation und Anmeldung beschreibt [Abo-Verbindungen für Claude, ChatGPT und Grok](subscription-clis.md).

## OpenAI (ChatGPT)

- API-Key: keiner. Stattdessen meldest du dich in einem lokalen Werkzeug an.

**OpenAI (ChatGPT)** nutzt dein ChatGPT-Konto über das Werkzeug Codex. Das Werkzeug läuft auf dem Rechner mit dem Marinara-Server, und du meldest dich einmalig an. Die Felder **API Key** und **Base URL** sind bei diesem Anbieter ausgeblendet. Embeddings bietet er nicht (siehe Abschnitt „Embeddings“ weiter unten).

Installation und Anmeldung beschreibt [Abo-Verbindungen für Claude, ChatGPT und Grok](subscription-clis.md).

## Grok CLI (Subscription)

- API-Key: keiner. Stattdessen meldest du dich in einem lokalen Werkzeug an.

**Grok CLI (Subscription)** nutzt dein SuperGrok- oder X-Premium+-Konto über das Werkzeug Grok CLI. Das Werkzeug läuft auf dem Rechner mit dem Marinara-Server, und du meldest dich einmalig an. Die Felder **API Key** und **Base URL** sind bei diesem Anbieter ausgeblendet. Embeddings bietet er nicht (siehe Abschnitt „Embeddings“ weiter unten).

Installation und Anmeldung beschreibt [Abo-Verbindungen für Claude, ChatGPT und Grok](subscription-clis.md).

## Custom (OAI-Compatible)

- Standard-Base-URL: keine. Du musst selbst eine eintragen.

Wähle **Custom (OAI-Compatible)**, um einen lokalen oder selbst gehosteten Modell-Server zu verbinden, etwa Ollama, LM Studio oder KoboldCpp. Genauso funktioniert jeder gehostete Proxy, der das OpenAI-Chatformat spricht. Bei den meisten lokalen Servern bleibt das Feld **API Key** einfach leer. Als **Base URL** trägst du die Adresse deines Servers ein.

Die Einrichtung Schritt für Schritt und den Schalter **Treat as local/custom endpoint** (als lokalen/eigenen Endpunkt behandeln) erklärt [Ein lokales oder selbst gehostetes Modell verbinden](local-self-hosted.md). Zum kleinen Modell, das in Marinara mitgeliefert wird, siehe [Lokales Modell einrichten](local-model.md).

## Image Generation

**Image Generation** ist ein besonderer Anbieter. Nach der Auswahl legst du zusätzlich einen **Service** (Dienst) fest – das Bild-Backend, das die eigentliche Arbeit erledigt. Jeder Dienst bringt eine eigene Standard-Base-URL mit und regelt selbst, ob ein API-Key nötig ist. Dazu zählen kostenpflichtige Cloud-APIs wie **OpenAI (DALL-E)**, **Stability AI**, **NovelAI** und **Z.AI**. Daneben gibt es kostenlose Optionen wie **Pollinations** und **Stable Horde**. Lokale Server wie **ComfyUI** und **SD Web UI (AUTOMATIC1111 / Forge)** funktionieren ebenfalls.

Die vollständige Liste der Bilddienste, ihre Einrichtung und die Einstellungen zur Generierung findest du unter [Anbieter und Einrichtung der Bildgenerierung](../media/image-providers.md).

## Video Generation

**Video Generation** (Videogenerierung) ist ebenfalls ein besonderer Anbieter, mit einer eigenen Auswahl **Video Service**. Game Mode erzeugt damit kurze MP4-Szenenvideos. Zur Wahl stehen **Google AI Studio**, **xAI Imagine**, **OpenRouter Video** und **Seedance 2.0**. Jeder Dienst braucht einen API-Key.

Die komplette Einrichtung und die Grenzen jedes Videodienstes stehen unter [Szenenvideos generieren](../media/scene-video.md).

## Embeddings

Embeddings treiben die semantische Suche in Lorebooks und Memory Recall an. Sie verwandeln Text in Zahlenlisten, damit Marinara passende Einträge findet. Bei den meisten Chat-Anbietern kannst du im Verbindungs-Editor ein **Embedding Model** und optional eine **Embedding Endpoint URL** angeben.

Manche Anbieter liefern keine Embeddings. **Anthropic**, **Claude (Subscription)**, **OpenAI (ChatGPT)** und **Grok CLI (Subscription)** bieten sie nicht. Nutze dort das Dropdown-Menü **Embedding Connection**, um eine andere Verbindung mitzuverwenden – etwa eine OpenAI-kompatible, **Google Gemini** oder das eingebaute **Local Model**.

## Verwandte Anleitungen

- [Mit einem KI-Anbieter verbinden](connecting-to-a-provider.md)
- [Abo-Verbindungen für Claude, ChatGPT und Grok](subscription-clis.md)
- [Ein lokales oder selbst gehostetes Modell verbinden](local-self-hosted.md)
- [Anbieter und Einrichtung der Bildgenerierung](../media/image-providers.md)
- [Szenenvideos generieren](../media/scene-video.md)
