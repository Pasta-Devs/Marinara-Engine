# Anbieter für Bildgenerierung und Einrichtung

In dieser Anleitung erfährst du, wie du einen Dienst für Bildgenerierung mit Marinara Engine verbindest. Außerdem steht hier, was die 17 Dienste jeweils brauchen. Die Bildgenerierung liefert Szenenillustrationen, Selfies, Szenenhintergründe sowie generierte Avatare, Porträts und Sprites.

Die Bildgenerierung richtest du als besondere Art von Verbindung ein. Sobald eine Bildverbindung läuft, greift jede Bildfunktion der App darauf zu.

## Verbindung für die Bildgenerierung anlegen

Ein **API-Key** ist ein geheimes Passwort vom Anbieter, mit dem Marinara dein Konto nutzen darf. Die **Base URL** ist die Webadresse der Programmierschnittstelle des Dienstes. Sobald du einen Dienst auswählst, trägt Marinara die passende Base URL automatisch ein.

So legst du eine Bildverbindung an:

1. Öffne das Panel **Connections** (Verbindungen).
2. Klick auf **New** (Neu), um das Fenster **Create Connection** (Verbindung erstellen) zu öffnen.
3. Gib einen Namen ein und wähle dann den Anbieter **Image Generation** (Bildgenerierung).
4. Wähle im Verbindungseditor im Raster einen **Service** (Dienst) aus.
5. Füge den **API Key** ein, falls der Dienst einen braucht. Kostenlose und lokale Dienste kommen ohne aus.
6. Wähle ein **Model** (Modell) aus der Liste oder tippe eine Modell-ID ein. Manche Dienste bieten **Fetch Models from API** (Modelle über die API laden) an, um die aktuelle Liste zu holen.
7. Klick auf **Save** (Speichern).
8. Klick auf **Test Image** (Testbild), um die Verbindung zu prüfen. Marinara generiert dann ein kleines Testbild.

Liefert **Test Image** ein Bild, ist die Verbindung einsatzbereit. Schlägt der Test fehl, prüfe API-Key und Base URL.

## Den passenden Dienst auswählen

Die 17 Dienste teilen sich in drei Gruppen. Cloud-Dienste brauchen einen API-Key und ein Konto. Kostenlose Dienste brauchen keinen Key. Lokale Dienste lassen die Bildsoftware auf dem eigenen Rechner laufen.

Die Tabelle zeigt alle Dienste auf einen Blick. Details und Eigenheiten folgen weiter unten im Abschnitt zum jeweiligen Dienst.

| Dienst | API-Key | Wo er läuft |
| --- | --- | --- |
| OpenAI (DALL-E) | Ja | Cloud |
| Stability AI | Ja | Cloud |
| Together AI | Ja | Cloud |
| NovelAI | Ja | Cloud |
| OpenRouter Images | Ja | Cloud |
| xAI / Grok Imagine | Ja | Cloud |
| Venice.ai | Ja | Cloud |
| Z.AI | Ja | Cloud |
| Atlas Cloud | Ja | Cloud |
| NanoGPT | Ja | Cloud |
| Block Entropy | Ja | Cloud |
| RunPod Serverless (ComfyUI) | Ja | Cloud |
| Pollinations | Nein | Kostenlose Cloud |
| Stable Horde | Optional | Kostenlose Cloud |
| SD Web UI (AUTOMATIC1111 / Forge) | Nein | Lokal |
| ComfyUI | Nein | Lokal |
| Draw Things | Nein | Lokal |

## OpenAI (DALL-E)

Cloud-Dienst mit der Standard-Base-URL `https://api.openai.com/v1`. Nötig ist ein API-Key aus dem OpenAI-Konto. Zur Auswahl stehen DALL-E- und GPT-Image-Modelle. Bis zu 16 Referenzbilder sind möglich.

## Stability AI

Cloud-Dienst mit der Standard-Base-URL `https://api.stability.ai/v2beta`. Nötig ist ein API-Key von Stability AI. Zur Auswahl stehen Stable-Diffusion- und Stable-Image-Modelle.

## Together AI

Cloud-Dienst mit der Standard-Base-URL `https://api.together.xyz/v1`. Nötig ist ein API-Key von Together AI. Zur Auswahl stehen FLUX und weitere offene Bildmodelle.

## NovelAI

Cloud-Dienst mit der Standard-Base-URL `https://image.novelai.net`. Nötig ist ein API-Key von NovelAI. Der Schwerpunkt liegt auf Artwork im Anime-Stil. Bei V4-, V4.5- und V5-Modellen sendet Marinara für Storyboard- und Illustrator-Szenen mit mehreren Figuren native Figuren-Prompts samt Positionen. Einige neuere Funktionen wie präzise Referenzbilder laufen nur auf einem V4.5-Modell.

## OpenRouter Images

Cloud-Dienst mit der Standard-Base-URL `https://openrouter.ai/api/v1`. Nötig ist ein API-Key von OpenRouter. Die Bildmodelle laufen über die Chat-Schnittstelle von OpenRouter, deshalb unterscheidet sich das verfügbare Angebot von Konto zu Konto.

## xAI / Grok Imagine

Cloud-Dienst mit der Standard-Base-URL `https://api.x.ai/v1`. Nötig ist ein API-Key von xAI. Für die Bildgenerierung kommt Grok Imagine zum Einsatz.

## Venice.ai

Cloud-Dienst mit der Standard-Base-URL `https://api.venice.ai/api/v1`. Nötig ist ein API-Key von Venice. Mit **Fetch Models from API** lädst du die Bildmodelle, die dein Konto freischaltet. Marinara nutzt den nativen Bild-Endpunkt von Venice, schaltet den optionalen Safe-Mode-Weichzeichner ab und rechnet die gewünschten Maße automatisch in das Größenformat des jeweiligen Modells um: Pixel, Seitenverhältnis oder Auflösungsstufe. Trotzdem kann eine Anfrage an den Richtlinien des Anbieters oder an Modellgrenzen scheitern.

## Z.AI

Cloud-Dienst mit der Standard-Base-URL `https://api.z.ai/api/paas/v4`. Nötig ist ein allgemeiner API-Key von Z.AI; Keys aus dem GLM Coding Plan und der Endpunkt `/api/coding/paas/v4` taugen nicht für die Bildgenerierung. Mit **Fetch Models from API** wählst du **GLM-Image** oder **CogView 4** aus. Marinara rechnet das gewünschte Seitenverhältnis in eine Größe um, die das gewählte Modell unterstützt, schickt die Anfrage an den nativen Bild-Endpunkt von Z.AI und lädt die temporäre Ergebnis-URL in den lokalen Speicher. Diese erste Fassung beherrscht nur Text-to-Image und schickt keine Referenzbilder mit.

## Atlas Cloud

Cloud-Dienst mit der Standard-Base-URL `https://api.atlascloud.ai/api/v1`. Nötig ist ein API-Key von Atlas Cloud. Marinara bringt einen kleinen Startkatalog für Nano Banana, Gemini Flash Image und FLUX 1.1 Pro mit; alternativ tippst du die exakte ID eines anderen Atlas-Cloud-Bildmodells ein. Die Aufträge laufen asynchron: Marinara startet die Generierung und fragt bei Atlas Cloud so lange nach, bis das Bild fertig ist. Gängige Text-to-Image-Regler ordnet Marinara automatisch zu; Referenzbilder gehen an Modell-IDs, die Image-to-Image, Edit oder Kontext unterstützen. Da sich die Schemata der Atlas-Modelle unterscheiden, lohnt bei einer anderen Modell-ID ein Blick in die Atlas-Cloud-Dokumentation zum gewählten Modell.

## NanoGPT

Cloud-Dienst mit der Standard-Base-URL `https://nano-gpt.com/api/v1`. Nötig ist ein API-Key von NanoGPT. NanoGPT bündelt mehrere Anbieter, deshalb lädst du die Modellliste am besten mit **Fetch Models from API**.

## Block Entropy

Cloud-Dienst mit der Standard-Base-URL `https://api.blockentropy.ai`. Nötig ist ein API-Key. Marinara hat für Block Entropy keine eigene Behandlung und schickt die Anfragen deshalb im OpenAI-kompatiblen Format. Ob das tatsächlich zusammenpasst, ist nicht bestätigt: Teste den Dienst also mit **Test Image**, bevor du dich darauf verlässt.

## RunPod Serverless (ComfyUI)

Cloud-Dienst mit der Standard-Base-URL `https://api.runpod.ai/v2`. Er führt einen ComfyUI-Workflow auf einem serverlosen RunPod-Endpunkt aus. Dafür sind drei Angaben nötig: das RunPod-API-Token als **API Key**, eine **RunPod Endpoint ID** und ein **ComfyUI Workflow** als JSON. Mehr dazu im Abschnitt zum ComfyUI-Workflow weiter unten.

## Pollinations

Kostenloser Cloud-Dienst mit der Standard-Base-URL `https://image.pollinations.ai`. Weder Konto noch API-Key sind nötig. Schneller kommst du nicht zur ersten Bildgenerierung.

## Stable Horde

Kostenloser Cloud-Dienst mit der Standard-Base-URL `https://stablehorde.net/api/v2`. Dahinter steckt ein Netzwerk aus freiwillig geteilter Rechenleistung. Ein API-Key ist optional. Ein kostenloser Key bringt dich in der Warteschlange weiter nach vorn.

## SD Web UI (AUTOMATIC1111 / Forge)

Lokaler Dienst mit der Standard-Base-URL `http://localhost:7860`. Er spricht mit einer Stable Diffusion Web UI auf dem eigenen Rechner. Starte diese Software mit aktivierter Programmierschnittstelle. Ein API-Key ist nicht nötig.

## ComfyUI

Lokaler Dienst mit der Standard-Base-URL `http://127.0.0.1:8188`. Er spricht mit einem ComfyUI-Server auf dem eigenen Rechner. Eigene Workflows sind möglich, siehe weiter unten. Ein API-Key ist nicht nötig.

## Draw Things

Lokaler Dienst mit der Standard-Base-URL `http://localhost:7860`. Er spricht mit der Draw-Things-App unter macOS oder iOS. Marinara behandelt sie wie einen AUTOMATIC1111-Server. Ein API-Key ist nicht nötig.

## Lokale Dienste im eigenen Netzwerk

Das Wort `localhost` (auch Loopback genannt) meint denselben Rechner, auf dem Marinara läuft. Lokale Bildserver auf genau diesem Rechner brauchen keine weitere Einrichtung.

Läuft der Bildserver auf einem anderen Rechner im Heimnetzwerk, musst du lokale Netzwerkadressen in der Serverkonfiguration freigeben. Wie das geht, steht in der [Referenz zur Serverkonfiguration](../CONFIGURATION.md).

Liefert ein Anbieter statt der Bilddaten eine URL, lädt Marinara öffentliche CDN-URLs über die üblichen Sicherheitsprüfungen für ausgehende Anfragen herunter. Eine private oder Loopback-URL akzeptiert Marinara nur, wenn Schema, Hostname und Port exakt zum eingerichteten Bildanbieter passen. Weiterleitungen von dieser privaten Adresse dürfen nicht zu einem anderen lokalen Dienst springen. Legt ein lokaler Proxy die Ergebnisse auf einer anderen privaten Adresse ab, richte ihn so ein, dass er diese Dateien über dieselbe Adresse wie seine Bild-API ausliefert.

## ComfyUI-Workflow-JSON und RunPod

Bei **ComfyUI** und **RunPod Serverless (ComfyUI)** erscheint das Feld **ComfyUI Workflow**. Füge dort ein Workflow-JSON ein, das du in ComfyUI über **Save (API Format)**, **Export (API)** oder **Export to API** exportiert hast – je nach Version des Frontends. Bei **ComfyUI** ist das Feld als Optional markiert, bei **RunPod Serverless (ComfyUI)** als Required.

Marinara füllt den Workflow über Platzhalter. Setze diese Textmarker an die Stellen im Workflow, an denen der jeweilige Wert landen soll.

- `%prompt%` und `%negative_prompt%` für die Prompts.
- `%width%`, `%height%` und `%seed%` für Bildgröße und Seed.
- `%model%`, `%steps%`, `%cfg%`, `%sampler%`, `%scheduler%` und `%denoise%` für die Einstellungen der Generierung.
- `%reference_image%` sowie `%reference_image_01%` bis `%reference_image_04%` fügen die Bilddaten der Referenzbilder ein.
- `%reference_image_name%` sowie `%reference_image_name_01%` bis `%reference_image_name_04%` laden Referenzbilder hoch und fügen deren Dateinamen für einen lokalen LoadImage-Knoten in ComfyUI ein.

Der wichtigste Platzhalter ist `%prompt%`. Fehlt er, warnt der Editor. Bei **ComfyUI** greift ein eingebauter Standard-Workflow, solange das Feld leer bleibt. Bei **RunPod Serverless (ComfyUI)** ist der Workflow Pflicht, denn der Endpunkt hat keinen Standard. Beide verarbeiten bis zu 4 rohe base64-Referenzbilder; die Platzhalter für den Dateinamen-Upload gibt es nur beim lokalen ComfyUI.

Den kompletten Exportvorgang, JSON-Beispiele, die Zitierregeln für Platzhalter, die Einrichtung von Referenzbildern, charakterspezifische Workflows, den LAN-Zugriff und die Fehlerbehebung findest du unter [ComfyUI-Workflow einrichten](comfyui.md).

## Local Image Defaults pro Verbindung

Steht der Dienst auf **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **NovelAI** oder **Draw Things**, erscheint bei der Verbindung das Panel **Local Image Defaults** (lokale Bildstandards). Bei **Draw Things** zeigt das Panel dieselben Felder und Standardwerte wie bei **SD Web UI (AUTOMATIC1111 / Forge)**. Diese Einstellungen greifen nur, wenn genau diese Verbindung ein Bild generiert. Die Schaltfläche **Reset** (Zurücksetzen) stellt die eingebauten Werte wieder her.

Alle vier Dienste zeigen ein Feld **Seed**. Der Wert -1 hält jedes Bild zufällig. Jede andere Zahl nutzt jedes Mal exakt denselben Seed.

Die übrigen Felder hängen vom Dienst ab.

| Dienst | Feld | Standard |
| --- | --- | --- |
| AUTOMATIC1111 / Forge | Steps | 20 |
| AUTOMATIC1111 / Forge | CFG Scale | 7 |
| AUTOMATIC1111 / Forge | Sampler | Euler a |
| AUTOMATIC1111 / Forge | Img2Img Denoise | 0.6 |
| ComfyUI | Steps | 20 |
| ComfyUI | CFG Scale | 7 |
| ComfyUI | Sampler | euler_ancestral |
| ComfyUI | Scheduler | normal |
| ComfyUI | Denoise | 1 |
| NovelAI | Steps | 28 |
| NovelAI | Prompt Guidance | 6 |
| NovelAI | Sampler | k_euler_ancestral |
| NovelAI | Noise Schedule | karras |

Jeder Dienst hat außerdem die Textfelder **Prompt Prefix** und **Negative Prefix**. Was dort steht, stellt Marinara jedem Prompt dieser Verbindung voran. AUTOMATIC1111 / Forge und ComfyUI haben zusätzlich ein Feld **Clip Skip**. Bei AUTOMATIC1111 / Forge kommt der Schalter **Restore faces** dazu. ComfyUI ergänzt den Schalter **Upload a 1x1 placeholder when no reference image is provided**. Er spielt nur bei eigenen Workflows mit Referenzbild-Platzhaltern eine Rolle. NovelAI ergänzt die Felder **Guidance Rescale** und **UC Preset**.

## Referenzbilder je nach Anbieter

Ein **Referenzbild** ist ein vorhandenes Bild, das du zusammen mit dem Prompt schickst. Damit behält das neue Bild etwa das Gesicht eines Charakters oder einen Kunststil bei. Wie viele Referenzbilder erlaubt sind, unterscheidet sich je nach Anbieter.

| Anbieter | Referenzbilder |
| --- | --- |
| OpenAI (DALL-E) | Bis zu 16 |
| NovelAI | Bis zu 16, nur V4.5-Modell |
| xAI / Grok Imagine | Bis zu 3 |
| Venice.ai | Bei Text-to-Image-Generierung nicht unterstützt |
| Z.AI | In der aktuellen Text-to-Image-Integration nicht unterstützt |
| Atlas Cloud | Erstes Bild bei passenden Modell-IDs für Image-to-Image, Edit oder Kontext |
| NanoGPT | Bis zu 3 |
| Stability AI | Nur das erste Bild, als Image-to-Image genutzt |
| OpenRouter Images | Unterstützt, ohne feste Obergrenze |
| ComfyUI und RunPod Serverless (ComfyUI) | Bis zu 4, über Workflow-Platzhalter |
| Together AI, Pollinations, Stable Horde | Nicht unterstützt |

Präzise Referenzbilder funktionieren bei NovelAI nur auf einem V4.5-Modell, etwa `nai-diffusion-4-5-full`. NovelAI hat Precise Reference für V5 noch nicht veröffentlicht. Forderst du Referenzen auf einem anderen Modell an, erzeugt Marinara das Bild ohne sie und schreibt eine Warnung ins Server-Log.

## Bildanfragen in die Warteschlange stellen

Der Schalter **Queue image generation requests** (Bildanfragen in die Warteschlange stellen) sitzt unter **Settings** (Einstellungen), dann **Generations**, dann **Image Generation**. Standardmäßig ist er aktiv.

Ist er aktiv, schickt Marinara die Bildaufträge einzeln nacheinander. Lass ihn an bei Diensten, die zwei gleichzeitige Anfragen ablehnen. Schalte ihn nur aus, wenn dein Dienst viele Anfragen parallel verkraftet und es schneller gehen soll.

## Verwandte Anleitungen

- [ComfyUI-Workflow einrichten](comfyui.md) erklärt das Workflow-JSON für lokale Installationen und RunPod Schritt für Schritt.
- [Illustrator-Agent](illustrator-agent.md) richtet automatische Szenenillustrationen ein.
- [Bildstil-Profile](style-profiles.md) prägen den Look jedes generierten Bildes.
- [Szenenhintergründe und die Galerie](scene-backgrounds.md) behandelt generierte Szenenhintergründe.
- [Selfies](../conversation/selfies.md) beschreibt den Befehl für Charakter-Selfies im Conversation Mode.
- [Unterstützte KI-Anbieter](../connections/providers-reference.md) listet alle Anbieter für Chat, Bild und Video auf.
