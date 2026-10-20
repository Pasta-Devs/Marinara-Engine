# Anbieter für Bildgenerierung und Einrichtung

In dieser Anleitung erfährst du, wie du einen Dienst für Bildgenerierung mit Marinara Engine verbindest. Außerdem steht hier, was die Dienste jeweils brauchen. Die Bildgenerierung liefert Szenenillustrationen, Selfies, Szenenhintergründe sowie generierte Avatare, Porträts und Sprites.

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

Die Dienste teilen sich in drei Gruppen. Cloud-Dienste brauchen ein Konto, die meisten zusätzlich einen API-Key. Kostenlose Dienste brauchen keinen Key. Lokale Dienste lassen die Bildsoftware auf dem eigenen Rechner laufen.

Die Tabelle zeigt alle Dienste auf einen Blick. Details und Eigenheiten folgen weiter unten im Abschnitt zum jeweiligen Dienst.

| Dienst | API-Key | Wo er läuft |
| --- | --- | --- |
| OpenAI (DALL-E) | Ja | Cloud |
| ChatGPT (Codex login) | Nein, nutzt deine Anmeldung per `codex login` | Cloud |
| Stability AI | Ja | Cloud |
| Together AI | Ja | Cloud |
| Arli AI | Ja | Cloud |
| NovelAI | Ja | Cloud |
| OpenRouter Images | Ja | Cloud |
| xAI / Grok Imagine | Ja | Cloud |
| Venice.ai | Ja | Cloud |
| Z.AI | Ja | Cloud |
| Atlas Cloud | Ja | Cloud |
| fal.ai | Ja | Cloud |
| SpicyAPI | Ja | Cloud |
| NanoGPT | Ja | Cloud |
| Block Entropy | Ja | Cloud |
| RunPod Serverless (ComfyUI) | Ja | Cloud |
| Pollinations | Nein | Kostenlose Cloud |
| Stable Horde | Optional | Kostenlose Cloud |
| SD Web UI (AUTOMATIC1111 / Forge) | Nein | Lokal |
| ComfyUI | Nein | Lokal |
| SwarmUI | Optional | Lokal |
| Draw Things | Nein | Lokal |

## OpenAI (DALL-E)

Cloud-Dienst mit der Standard-Base-URL `https://api.openai.com/v1`. Nötig ist ein API-Key aus dem OpenAI-Konto. Zur Auswahl stehen DALL-E- und GPT-Image-Modelle. GPT-Image-Modelle nehmen bis zu 16 Referenzbilder an, DALL-E-Modelle keine.

## ChatGPT (Codex login)

Cloud-Dienst, der statt eines API-Keys deinen ChatGPT-Tarif nutzt. Für Bilder brauchst du also kein API-Guthaben bei OpenAI. Installiere auf dem Rechner, auf dem der Marinara-Server läuft, die Codex CLI und führ einmal `codex login` aus. Es ist dieselbe Anmeldung, die auch die Chat-Verbindung **OpenAI (ChatGPT)** verwendet; die einzelnen Schritte beschreibt [Abo-Verbindungen für Claude, ChatGPT und Grok](../connections/subscription-clis.md#openai-chatgpt). Einen API-Key oder eine Base URL musst du nicht eintragen. Marinara trägt das Modell `gpt-image-2` ein, das auch Codex selbst für Bilder verwendet.

**Test Connection** (Verbindung testen) prüft nur, ob Marinara deine Codex-Anmeldung lesen kann. **Test Image** erzeugt ein echtes Bild und wird auf deine Bildlimits bei ChatGPT angerechnet. Sind Referenzbilder dabei, sendet Marinara eine Bearbeitungsanfrage mit bis zu 16 davon. ChatGPT liefert unter Umständen eine andere Pixelgröße als die angeforderte, deshalb nennt Marinara das gewünschte Seitenverhältnis zusätzlich im Prompt.

Dieser Dienst spricht nicht mit der öffentlichen OpenAI-API, sondern mit dem Bild-Endpunkt von ChatGPT, den auch Codex nutzt. OpenAI kann ihn deshalb ohne Vorankündigung ändern.

## Stability AI

Cloud-Dienst mit der Standard-Base-URL `https://api.stability.ai/v2beta`. Nötig ist ein API-Key von Stability AI. Zur Auswahl stehen Stable-Diffusion- und Stable-Image-Modelle.

## Together AI

Cloud-Dienst mit der Standard-Base-URL `https://api.together.xyz/v1`. Nötig ist ein API-Key von Together AI. Zur Auswahl stehen FLUX und weitere offene Bildmodelle.

## Arli AI

Cloud-Dienst mit der Standard-Base-URL `https://api.arliai.com/v1`. Nötig ist ein API-Key von Arli AI. Der Dienst führt gehostete Stable-Diffusion-Modelle aus. Ein **Model** ist Pflicht, gib also den Namen des gewünschten Bildmodells von Arli AI ein. Er nutzt dieselben Felder unter **Local Image Defaults** wie **SD Web UI (AUTOMATIC1111 / Forge)**, siehe weiter unten. Schickst du Referenzbilder mit, verwendet Marinara das erste als Ausgangsbild (Image-to-Image).

Der Dienst **Arli AI** ist hier nur für Bilder gedacht. Für Chat-Modelle von Arli AI nutzt du stattdessen den Chat-Anbieter **Arli AI**; siehe [Unterstützte KI-Anbieter](../connections/providers-reference.md#arli-ai).

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

Cloud-Dienst mit der Standard-Base-URL `https://api.atlascloud.ai/api/v1`. Nötig ist ein API-Key von Atlas Cloud. **Fetch Models** (Modelle abrufen) lädt den aktuellen Katalog von Atlas Cloud für Text-to-Image und Image-to-Image. Ist der Katalog nicht erreichbar, zeigt Marinara stattdessen eine kleine Startliste mit Nano Banana, Gemini Flash Image und FLUX 1.1 Pro. Du kannst jederzeit die genaue ID eines Bildmodells von Atlas Cloud eingeben. Aufträge laufen asynchron: Marinara startet die Generierung und fragt Atlas Cloud ab, bis das Bild fertig ist. Übliche Einstellungen für Text-to-Image werden automatisch zugeordnet; Referenzbilder werden an Modell-IDs gesendet, die Image-to-Image, Bearbeitung oder Kontext-Verhalten ausweisen. Da sich die Schemas unterscheiden können, prüf bei einer anderen Modell-ID die Dokumentation von Atlas Cloud zum gewählten Modell.

## fal.ai

Cloud-Dienst mit der standardmäßigen **Base URL** `https://fal.run`. Erstelle bei [fal.ai](https://fal.ai/dashboard/keys) einen API-Key und wähle **fal.ai** im Raster der Bilddienste. Die anfängliche **Model**-Liste bietet `fal-ai/flux/schnell` und `fal-ai/flux/dev`; du kannst die ID eines anderen Text-to-Image-Endpunkts mit kompatiblem Ein- und Ausgabeschema eingeben. **Test Connection** prüft nur die Konfiguration. **Test Image** sendet eine echte Generierungsanfrage und verbraucht dein fal.ai-Guthaben.

Marinara sendet den Prompt und die gewünschten Abmessungen und lädt dann das erste zurückgegebene Bild in den bestehenden Bildablauf herunter. Negative Prompts werden als Textanweisungen angehängt. Nutze **Custom Parameters** (benutzerdefinierte Parameter) für modellspezifische Optionen wie `seed`, `num_inference_steps` oder `image_size`. Die Integration nutzt synchrone Text-to-Image-Anfragen; sie sendet keine Referenzbilder und setzt unterbrochene Aufträge nicht fort. Welche Eingaben das gewählte Modell unterstützt, steht in seiner [API-Referenz](https://fal.ai/models/fal-ai/flux/schnell/api).

## SpicyAPI

Cloud-Dienst mit der standardmäßigen **Base URL** `https://api.spicyapi.ai/api/v1`. Erstelle in der [SpicyAPI-Konsole](https://spicyapi.ai/console/keys) einen API-Key und wähle dann **SpicyAPI** im Raster der Bilddienste. Marinara trägt das Modell `alibaba/z-image-spicy-pro/text-to-image` ein. Klick auf **Fetch Models from API**, um alle Text-to-Image- und Edit-Modelle von SpicyAPI zu laden, oder gib eine Modell-ID wie `bytedance/seedream-5.0-pro/text-to-image` ein. **Test Connection** prüft deinen Key, indem die Modellliste abgerufen wird; das kostet nichts. **Test Image** erzeugt ein echtes Bild und verbraucht dein SpicyAPI-Guthaben.

Wähl den Dienst **SpicyAPI**. Nutze weder **OpenAI (DALL-E)** noch eine Verbindung vom Typ **Custom (OAI-Compatible)** mit einer SpicyAPI-Adresse. Die Adresse im OpenAI-Stil von SpicyAPI verarbeitet nur Text, deshalb können diese Verbindungen keine Bilder erzeugen.

Jedes SpicyAPI-Modell hat eigene Einstellungen. Marinara fragt bei SpicyAPI nach, welche das gewählte Modell akzeptiert, und sendet nur diese. Dabei wählt Marinara die nächstliegende Form, die das Modell anbietet, etwa ein Seitenverhältnis, Breite und Höhe oder eine feste Größe. Hat das Modell kein Feld für einen negativen Prompt, wird der negative Prompt als Text ans Ende des Prompts angehängt. Nutze **Custom Parameters** für weitere Modelloptionen wie `seed`, `resolution` oder `loras`.

SpicyAPI bearbeitet jedes Bild als Auftrag. Marinara wartet, bis der Auftrag fertig ist, fragt erneut nach, wenn er länger als etwa eine Minute dauert, und lädt dann das Ergebnis herunter. Bricht die Verbindung ab, nimmt Marinara denselben Auftrag wieder auf, statt für einen neuen zu bezahlen. Edit-Modelle (IDs, die auf `/edit` enden) erhalten deine Referenzbilder. SpicyAPI nimmt Referenzbilder bis 1 MB pro Bild und 2 MB pro Anfrage an. Deshalb verkleinert Marinara größere Bilder und lässt überzählige weg, die nicht mehr hineinpassen.

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

## SwarmUI

Lokaler Dienst mit der Standard-Base-URL `http://127.0.0.1:7801`. Er spricht mit einem SwarmUI-Server, der ComfyUI-Aufträge über seine eigene Warteschlange verteilen kann. Bei einem lokalen Server ohne Benutzerkonten ist kein API-Key nötig. Verlangt dein SwarmUI-Server ein Konto, füge ein Swarm Auth Token in **API Key** ein. **Fetch Models from API** listet die Modelle auf deinem SwarmUI-Server auf.

Das Feld **ComfyUI Workflow** ist bei SwarmUI optional. Lass es leer, um die eigenen Bildeinstellungen von SwarmUI zu verwenden, oder füge einen Workflow ein, wie weiter unten beschrieben. Aktiviere **Save images in SwarmUI** (Bilder in SwarmUI speichern) unter **Local Image Defaults**, um jedes Bild zusätzlich im Ausgabeordner von SwarmUI abzulegen. Marinara behält in jedem Fall eine eigene Kopie.

## Draw Things

Lokaler Dienst mit der Standard-Base-URL `http://localhost:7860`. Er spricht mit der Draw-Things-App unter macOS oder iOS. Marinara behandelt sie wie einen AUTOMATIC1111-Server. Ein API-Key ist nicht nötig.

## Lokale Dienste im eigenen Netzwerk

Das Wort `localhost` (auch Loopback genannt) meint denselben Rechner, auf dem Marinara läuft. Lokale Bildserver auf genau diesem Rechner brauchen keine weitere Einrichtung.

Läuft der Bildserver auf einem anderen Rechner im Heimnetzwerk, musst du lokale Netzwerkadressen in der Serverkonfiguration freigeben. Wie das geht, steht in der [Referenz zur Serverkonfiguration](../CONFIGURATION.md).

Liefert ein Anbieter statt der Bilddaten eine URL, lädt Marinara öffentliche CDN-URLs über die üblichen Sicherheitsprüfungen für ausgehende Anfragen herunter. Eine private oder Loopback-URL akzeptiert Marinara nur, wenn Schema, Hostname und Port exakt zum eingerichteten Bildanbieter passen. Weiterleitungen von dieser privaten Adresse dürfen nicht zu einem anderen lokalen Dienst springen. Legt ein lokaler Proxy die Ergebnisse auf einer anderen privaten Adresse ab, richte ihn so ein, dass er diese Dateien über dieselbe Adresse wie seine Bild-API ausliefert.

## ComfyUI-Workflow-JSON und RunPod

Bei **ComfyUI**, **SwarmUI** und **RunPod Serverless (ComfyUI)** erscheint das Feld **ComfyUI Workflow**. Füge dort ein Workflow-JSON ein, das du in ComfyUI über **Save (API Format)**, **Export (API)** oder **Export to API** exportiert hast – je nach Version des Frontends. Bei **ComfyUI** und **SwarmUI** ist das Feld als Optional markiert, bei **RunPod Serverless (ComfyUI)** als Required.

Marinara füllt den Workflow über Platzhalter. Setze diese Textmarker an die Stellen im Workflow, an denen der jeweilige Wert landen soll.

- `%prompt%` und `%negative_prompt%` für die Prompts.
- `%width%`, `%height%` und `%seed%` für Bildgröße und Seed.
- `%model%`, `%steps%`, `%cfg%`, `%sampler%`, `%scheduler%` und `%denoise%` für die Einstellungen der Generierung.
- `%reference_image%` sowie `%reference_image_01%` bis `%reference_image_04%` fügen die Bilddaten der Referenzbilder ein.
- `%reference_image_name%` sowie `%reference_image_name_01%` bis `%reference_image_name_04%` laden Referenzbilder hoch und fügen deren Dateinamen für einen lokalen LoadImage-Knoten in ComfyUI ein.

Der wichtigste Platzhalter ist `%prompt%`. Fehlt er, warnt der Editor. Bei **ComfyUI** greift ein eingebauter Standard-Workflow, solange das Feld leer bleibt. Bei **SwarmUI** gelten bei leerem Feld die eigenen Bildeinstellungen von SwarmUI. Bei **RunPod Serverless (ComfyUI)** ist der Workflow Pflicht, denn der Endpunkt hat keinen Standard. Alle drei verarbeiten bis zu 4 rohe base64-Referenzbilder; die Platzhalter für den Dateinamen-Upload gibt es nur beim lokalen ComfyUI.

Den kompletten Exportvorgang, JSON-Beispiele, die Zitierregeln für Platzhalter, die Einrichtung von Referenzbildern, charakterspezifische Workflows, den LAN-Zugriff und die Fehlerbehebung findest du unter [ComfyUI-Workflow einrichten](comfyui.md).

## Local Image Defaults pro Verbindung

Steht der Dienst auf **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **NovelAI**, **Draw Things**, **Arli AI**, **SwarmUI** oder **RunPod Serverless (ComfyUI)**, erscheint bei der Verbindung das Panel **Local Image Defaults** (lokale Bildstandards). Bei **Draw Things** und **Arli AI** zeigt das Panel dieselben Felder und Standardwerte wie bei **SD Web UI (AUTOMATIC1111 / Forge)**. Bei **SwarmUI** und **RunPod Serverless (ComfyUI)** zeigt es dieselben Felder und Standardwerte wie bei **ComfyUI**. Diese Einstellungen greifen nur, wenn genau diese Verbindung ein Bild generiert. Die Schaltfläche **Reset** (Zurücksetzen) stellt die eingebauten Werte wieder her.

Alle diese Dienste zeigen ein Feld **Seed**. Der Wert -1 hält jedes Bild zufällig. Jede andere Zahl nutzt jedes Mal exakt denselben Seed.

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
| OpenAI (DALL-E) | Bis zu 16, nur GPT-Image-Modelle |
| ChatGPT (Codex login) | Bis zu 16 |
| NovelAI | Bis zu 16, nur V4.5-Modell |
| xAI / Grok Imagine | Bis zu 3 |
| Venice.ai | Bei Text-to-Image-Generierung nicht unterstützt |
| Z.AI | In der aktuellen Text-to-Image-Integration nicht unterstützt |
| Atlas Cloud | Erstes Bild bei passenden Modell-IDs für Image-to-Image, Edit oder Kontext |
| SpicyAPI | Nur Edit-Modelle, bis zum Limit des Modells; größere Bilder werden passend verkleinert |
| NanoGPT | Bis zu 3 |
| Stability AI | Nur das erste Bild, als Image-to-Image genutzt |
| Arli AI | Nur das erste Bild, als Image-to-Image genutzt |
| SD Web UI (AUTOMATIC1111 / Forge) und Draw Things | Nur das erste Bild, als Image-to-Image genutzt |
| OpenRouter Images | Unterstützt, ohne feste Obergrenze |
| ComfyUI und RunPod Serverless (ComfyUI) | Bis zu 4, über Workflow-Platzhalter |
| SwarmUI | Bis zu 4 |
| Together AI, Pollinations, Stable Horde, fal.ai | Nicht unterstützt |

Präzise Referenzbilder funktionieren bei NovelAI nur auf einem V4.5-Modell, etwa `nai-diffusion-4-5-full`. NovelAI hat Precise Reference für V5 noch nicht veröffentlicht. Forderst du Referenzen auf einem anderen Modell an, erzeugt Marinara das Bild ohne sie und schreibt eine Warnung ins Server-Log.

## Anfragen zur Mediengenerierung in die Warteschlange stellen

Der Schalter **Queue media generation requests** (Anfragen zur Mediengenerierung in die Warteschlange stellen) sitzt unter **Settings** (Einstellungen), dann **Generations**, dann **Overall Generations**. Standardmäßig ist er aktiv.

Ist er aktiv, schickt Marinara Bildaufträge an jedes Konto bei einem Bildanbieter einzeln nacheinander und Videoaufträge an jedes Konto bei einem Videoanbieter ebenso, jeweils in einer eigenen Warteschlange. Ein Bild und ein Video für dasselbe Konto können gleichzeitig laufen. Das gilt unabhängig davon, welche Funktion sie anfordert: der Illustrator, Tracker, Befehle, die Galerie, Game-Assets und heruntergeladene Agenten wie Slurp. Zwei Verbindungen mit derselben Adresse und demselben API-Key teilen sich die jeweilige Warteschlange. Verschiedene Konten und Anbieter arbeiten weiterhin gleichzeitig. Bei NovelAI kommt außerdem eine kurze Pause zwischen den Aufträgen hinzu. Antwortet NovelAI, dass es ausgelastet ist, wartet Marinara und versucht es noch zweimal, statt das Bild scheitern zu lassen.

Lass ihn an bei Diensten, die zwei gleichzeitige Anfragen ablehnen. Schalte ihn nur aus, wenn dein Dienst viele Anfragen parallel verkraftet und es schneller gehen soll.

## Verwandte Anleitungen

- [ComfyUI-Workflow einrichten](comfyui.md) erklärt das Workflow-JSON für lokale Installationen und RunPod Schritt für Schritt.
- [Illustrator-Agent](illustrator-agent.md) richtet automatische Szenenillustrationen ein.
- [Bildstil-Profile](style-profiles.md) prägen den Look jedes generierten Bildes.
- [Szenenhintergründe und die Galerie](scene-backgrounds.md) behandelt generierte Szenenhintergründe.
- [Selfies](../conversation/selfies.md) beschreibt den Befehl für Charakter-Selfies im Conversation Mode.
- [Unterstützte KI-Anbieter](../connections/providers-reference.md) listet alle Anbieter für Chat, Bild und Video auf.
