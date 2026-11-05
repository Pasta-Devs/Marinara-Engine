# Anbieter für Bildgenerierung und Einrichtung

Die Bildgenerierung liefert Szenenillustrationen, Selfies, Szenenhintergründe sowie generierte Avatare, Porträts und Sprites. In dieser Anleitung erfährst du, wie du einen Bilddienst hinzufügst und was die einzelnen Dienste jeweils brauchen. Sobald ein Bildmodell funktioniert, kann jede Bildfunktion der App es nutzen.

## Einen Bilddienst hinzufügen

Ein API-Key ist ein geheimer Code, den dir ein Dienst gibt, damit Marinara dein Konto dort nutzen kann. Die Webadresse jedes Dienstes trägt Marinara selbst ein, du musst also nur selten eine eintippen.

1. Klick in der oberen Leiste auf **Connections** (Verbindungen) und dann auf **Add** (Hinzufügen). Das Fenster **Add account** (Konto hinzufügen) öffnet sich.
2. Such den Dienst heraus. Die Liste hat einen Abschnitt **Images & video** (Bilder und Video), und mit **Search providers** (Anbieter suchen) findest du einen Dienst schneller.
3. Füge deinen Key in das Feld **API key** ein. Kostenlose und lokale Dienste brauchen keinen. Für einen Server, den du selbst betreibst, füllst du das Adressfeld aus.
4. Klick auf **Connect** (Verbinden). Marinara testet das Konto.
5. Wähle ein Bildmodell aus der Liste oder tipp eine Modell-ID ein. Das ist dein Bildmodell. Es erscheint im Panel **Connections** unter dem Konto.
6. Öffne das Bildmodell und klick auf **Test image** (Bild testen). Marinara erzeugt ein kleines Testbild.
7. Soll die App dieses Modell für Bilder verwenden, setze oben im Panel **Connections** unter **Defaults** (Standardwerte) die Aufgabe **Images** (Bilder).

Um einem Konto ein weiteres Bildmodell hinzuzufügen, öffne sein Menü **⋯** und klick auf **Add image model** (Bildmodell hinzufügen). Das vollständige Fenster beschreibt [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).

Wenn es nicht funktioniert hat: **Test image** schlägt fehl, wenn Key oder Adresse falsch sind. Prüf zuerst beides. **Test provider** (Anbieter testen) prüft nur, ob Marinara den Dienst erreichen kann. **Test image** erzeugt ein echtes Bild und kann Guthaben verbrauchen.

## Ein Bild im Chat erzeugen

Ist ein Bildmodell als Aufgabe **Images** gesetzt, kannst du in einem Chat ein Bild anfordern.

1. Füge den Agenten Illustrator einem Roleplay-Chat hinzu. Siehe [Illustrator-Agent](illustrator-agent.md).
2. Öffne **Chat Settings** (Chat-Einstellungen), klapp **Gallery** (Galerie) auf und klick auf **Illustrate** (Illustrieren).
3. Warte, bis **Generating...** fertig ist. Das Bild erscheint in der Gallery.

In einem Roleplay-Chat kannst du auch den Befehl `/illustrate` nutzen. Siehe [Slash-Befehle](../chats/slash-commands.md).

## Den passenden Dienst auswählen

Die Adresse jedes Dienstes trägt Marinara für dich ein. Cloud-Dienste brauchen ein Konto, die meisten zusätzlich einen API-Key. Kostenlose Dienste brauchen keinen Key. Lokale Dienste lassen die Bildsoftware auf deinem eigenen Rechner laufen.

**Der einfachste Einstieg:** Wähle **Pollinations**. Der Dienst ist kostenlos und braucht weder Konto noch Key. Willst du bessere Bilder, nimm später einen stärkeren Dienst.

| Dienst | API-Key | Wo er läuft |
| --- | --- | --- |
| OpenAI (DALL-E) | Ja | Cloud |
| ChatGPT (Codex login) | Nein, nutzt `codex login` | Cloud |
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

Hinweise zu den einfachen Diensten:

- **OpenAI (DALL-E)**: bietet DALL-E- und GPT-Image-Modelle. Nur GPT Image 2.6 erzeugt GIFs in Endlosschleife. Siehe [GPT Image 2.6](#gpt-image-26).
- **Stability AI**: Stable-Diffusion- und Stable-Image-Modelle.
- **Together AI**: FLUX und weitere offene Bildmodelle.
- **OpenRouter Images**: erreicht Bildmodelle über die Chat-Schnittstelle von OpenRouter, deshalb unterscheiden sich die Modelle von Konto zu Konto.
- **xAI / Grok Imagine**: nutzt Grok Imagine.
- **NanoGPT**: bündelt mehrere Anbieter, nutze also seine Modellliste.
- **Pollinations**: der schnellste Weg, die Bildgenerierung auszuprobieren. Ein Konto ist nicht nötig.
- **Stable Horde**: ein Netzwerk aus freiwillig geteilter Rechenleistung. Ein kostenloser Key bringt dich in der Warteschlange weiter nach vorn.
- **SD Web UI** und **Draw Things**: Starte die Software mit eingeschalteter Programmierschnittstelle. Marinara behandelt Draw Things wie einen AUTOMATIC1111-Server (die App läuft unter macOS oder iOS).
- **Block Entropy**: Marinara hat dafür keine eigene Behandlung und schickt deshalb OpenAI-kompatible Anfragen. Ob das zusammenpasst, ist nicht bestätigt. Teste den Dienst mit **Test image**, bevor du dich darauf verlässt.

## Dienste mit besonderer Einrichtung

### GPT Image 2.6

GPT Image 2.6 läuft über ein Konto für **OpenAI (DALL-E)**. **GPT Image 2.6 Flare** ist das schnellere Modell. **GPT Image 2.6 Sunburst** liefert höhere Qualität und bleibt über Bearbeitungen hinweg stabiler. Beide unterstützen dieselben Größen und transparenten Hintergründe wie GPT Image 2.5, und **Image quality** (Bildqualität) reicht bis **Max**.

Das Modell plant jedes Bild, bevor es zeichnet. Soll es weniger planen, füge `{"complexity": "low"}` oder `{"complexity": "medium"}` zu den **Custom Parameters** (eigene Parameter) des Bildmodells hinzu. Der Standard ist `high`. Eine höhere Komplexität kann länger dauern und bei einer Bearbeitung mehr verändern, als du verlangt hast.

GPT Image 2.6 kann auch ein kurzes GIF in Endlosschleife erzeugen. Marinara fordert eines nur dort an, wo eine Funktion oder ein heruntergeladener Agent GIFs anbietet:

| Limit | Wert |
| --- | --- |
| Konto | **OpenAI (DALL-E)** mit API-Key |
| Modelle | GPT Image 2.6 Flare oder Sunburst |
| Frames | 2 bis 12, standardmäßig 9 |
| Dauer pro Frame | 20 bis 2.000 ms, standardmäßig 200 ms |
| Frame-Größe | Rund 0,66 MP: 816x816 quadratisch, 608x1088 im Hochformat |
| Gesendete Bilder | Keine. Ein GIF entsteht allein aus dem Prompt |
| Transparenter Hintergrund | Nein |

OpenAI erlaubt mehr Frames, veröffentlicht aber nicht, wie viele Pixel ein GIF haben darf. Deshalb bleibt Marinara bei 12 kleinen Frames. **ChatGPT (Codex login)**, **OpenRouter Images**, **NanoGPT**, ToAPIs und andere Dienste können keine GIFs erzeugen. Marinara lehnt solche Anfragen ab, bevor es irgendetwas sendet, du zahlst also nichts. Bei einem Konto vom Typ **OpenAI-compatible** (OpenAI-kompatibel) versucht Marinara es wie bei OpenAI.

Ein gescheitertes GIF wird nie durch ein Standbild ersetzt. Antwortet der Dienst mit einem Standbild, schlägt die Anfrage fehl. Das Modell, das bei der Aufgabe **Images** unter **If it fails** (falls es fehlschlägt) eingetragen ist, wird nur versucht, wenn es GIFs erzeugen kann.

> **Warnung:** OpenAI veröffentlicht keinen Preis für ein GIF. Rechne damit, dass ein GIF so viel kostet wie mehrere Bilder, und auch ein Standbild, das stattdessen zurückkommt, wird berechnet.

### ChatGPT (Codex login)

Dieser Dienst nutzt statt eines API-Keys deinen ChatGPT-Tarif. Für Bilder brauchst du also kein API-Guthaben bei OpenAI.

1. Installiere auf dem Rechner, auf dem Marinara läuft, die Codex CLI und führ einmal `codex login` aus. Es ist dieselbe Anmeldung, die auch das ChatGPT-Konto für Chats nutzt. Siehe [Abo-Verbindungen für Claude, ChatGPT und Grok](../connections/subscription-clis.md#openai-chatgpt).
2. Wähle den Dienst. Key oder Adresse musst du nicht eintragen. Marinara trägt das Modell `gpt-image-2` ein, das auch Codex für Bilder verwendet.

**Test provider** prüft nur, ob Marinara deine Codex-Anmeldung lesen kann. **Test image** erzeugt ein echtes Bild und wird auf deine Bildlimits bei ChatGPT angerechnet. Dieser Dienst kann keine GIFs erzeugen, auch nicht mit einer Modell-ID von GPT Image 2.6. Sind Referenzbilder dabei, sendet Marinara eine Bearbeitungsanfrage mit bis zu 16 davon. ChatGPT liefert unter Umständen eine andere Pixelgröße, deshalb nennt Marinara das gewünschte Seitenverhältnis zusätzlich im Prompt. Dieser Dienst nutzt den Bild-Endpunkt von ChatGPT, den auch Codex nutzt, und nicht die öffentliche OpenAI-API. OpenAI kann ihn deshalb ohne Vorankündigung ändern.

### Arli AI

Der Dienst führt gehostete Stable-Diffusion-Modelle aus. Ein Modell ist Pflicht, tipp also den Namen des gewünschten Bildmodells von Arli AI ein. Er nutzt dieselben Felder unter **Local Image Defaults** (Standardwerte für lokale Bilder) wie SD Web UI, siehe [Local Image Defaults](#local-image-defaults-per-connection). Das erste Referenzbild dient als Ausgangsbild. Dieser Dienst ist nur für Bilder gedacht. Für Chat-Modelle von Arli AI siehe [Unterstützte KI-Anbieter](../connections/providers-reference.md#arli-ai).

### NovelAI

NovelAI hat seinen Schwerpunkt auf Artwork im Anime-Stil. Bei V4-, V4.5- und V5-Modellen sendet Marinara für Storyboards und Illustrator-Szenen mit mehreren Figuren native Figuren-Prompts samt Positionen. Präzise Referenzbilder funktionieren nur auf einem V4.5-Modell.

### Venice.ai

Marinara nutzt den nativen Bild-Endpunkt von Venice, schaltet den optionalen Safe-Mode-Weichzeichner von Venice ab und rechnet die gewünschten Maße in das Größenformat des jeweiligen Modells um. Die eigenen Richtlinien oder Modellgrenzen von Venice können eine Anfrage trotzdem ablehnen.

### Z.AI

Nutze einen allgemeinen API-Key von Z.AI. Keys aus dem GLM Coding Plan und die Adresse `/api/coding/paas/v4` funktionieren für Bilder nicht. Wähle **GLM-Image** oder **CogView 4**. Marinara rechnet das Seitenverhältnis in eine Größe um, die das Modell unterstützt, und lädt das temporäre Ergebnis in den lokalen Speicher herunter. Der Dienst beherrscht nur Text-to-Image und schickt keine Referenzbilder mit.

### Atlas Cloud

Marinara lädt den aktuellen Katalog von Atlas Cloud für Text-to-Image und Image-to-Image. Klappt das nicht, zeigt Marinara eine Startliste (Nano Banana, Gemini Flash Image, FLUX 1.1 Pro). Du kannst jederzeit eine genaue Modell-ID eintippen. Aufträge laufen asynchron: Marinara startet den Auftrag und fragt nach, bis das Bild fertig ist. Referenzbilder werden an Modell-IDs gesendet, die Image-to-Image, Bearbeitung oder Kontext-Verhalten ausweisen. Die Modellschemas von Atlas unterscheiden sich, prüf bei anderen IDs also die Dokumentation von Atlas Cloud zum jeweiligen Modell.

### fal.ai

Erstelle bei [fal.ai](https://fal.ai/dashboard/keys) einen API-Key. Die Startliste enthält `fal-ai/flux/schnell` und `fal-ai/flux/dev`. Du kannst die ID eines anderen Text-to-Image-Endpunkts mit kompatibler Ein- und Ausgabe eintippen. **Test provider** prüft nur die Einrichtung. **Test image** sendet eine echte Anfrage und verbraucht fal.ai-Guthaben.

Marinara sendet den Prompt und die Maße und lädt das erste zurückgegebene Bild herunter. Negative Prompts werden als Text angehängt. Nutze **Custom Parameters** für Modelloptionen wie `seed`, `num_inference_steps` oder `image_size`. Der Dienst nutzt synchrone Text-to-Image-Anfragen, sendet keine Referenzbilder und setzt unterbrochene Aufträge nicht fort. Siehe die [API-Referenz](https://fal.ai/models/fal-ai/flux/schnell/api) des Modells.

### SpicyAPI

Erstelle in der [SpicyAPI-Konsole](https://spicyapi.ai/console/keys) einen Key und wähle **SpicyAPI**. Marinara trägt das Modell `alibaba/z-image-spicy-pro/text-to-image` ein. Du kannst eine andere ID eintippen, etwa `bytedance/seedream-5.0-pro/text-to-image`. **Test provider** liest die Modellliste, das kostet also nichts. **Test image** erzeugt ein echtes Bild und verbraucht dein Guthaben.

Wähle den Dienst **SpicyAPI**. Nutze weder **OpenAI (DALL-E)** noch ein OpenAI-kompatibles Konto mit einer SpicyAPI-Adresse. Die Adresse im OpenAI-Stil von SpicyAPI verarbeitet nur Text.

Jedes Modell hat eigene Einstellungen. Marinara fragt bei SpicyAPI nach, welche das Modell akzeptiert, und sendet nur diese, in der nächstliegenden Form, die das Modell anbietet (Seitenverhältnis, Breite und Höhe oder eine feste Größe). Hat ein Modell kein Feld für einen negativen Prompt, wird der negative Prompt ans Ende des Prompts angehängt. Nutze **Custom Parameters** für weitere Optionen wie `seed`, `resolution` oder `loras`.

Jedes Bild ist ein Auftrag. Marinara wartet, fragt nach etwa einer Minute erneut nach und lädt dann das Ergebnis herunter. Bricht die Verbindung ab, nimmt Marinara denselben Auftrag wieder auf, statt für einen neuen zu bezahlen. Edit-Modelle (IDs, die auf `/edit` enden) erhalten deine Referenzbilder. SpicyAPI nimmt bis zu 1 MB pro Bild und 2 MB pro Anfrage an, deshalb verkleinert Marinara größere Bilder und lässt überzählige weg, die nicht hineinpassen.

### SwarmUI

SwarmUI kann ComfyUI-Arbeit über seine eigene Warteschlange verteilen. Ein lokaler Server ohne Benutzerkonten braucht keinen Key. Verlangt dein Server ein Konto, füge ein Swarm Auth Token in **API key** ein. Die Modellliste zeigt die Modelle auf deinem SwarmUI-Server.

Das Feld **ComfyUI workflow (optional)** kann leer bleiben. Lass es leer, um die eigenen Bildeinstellungen von SwarmUI zu nutzen, oder füge einen Workflow ein (siehe unten). Schalte **Save images in SwarmUI** (Bilder in SwarmUI speichern) unter **Local Image Defaults** ein, um jedes Bild zusätzlich im Ausgabeordner von SwarmUI abzulegen. Marinara behält in jedem Fall eine eigene Kopie.

### Lokale Dienste im eigenen Netzwerk

`localhost` meint den Rechner, auf dem Marinara läuft. Lokale Bildserver auf diesem Rechner funktionieren ohne weitere Einrichtung. Läuft der Server auf einem anderen Rechner in deinem Netzwerk, gib lokale Netzwerkadressen in der Serverkonfiguration frei. Siehe die [Referenz zur Server-Konfiguration](../CONFIGURATION.md).

Liefert ein Dienst statt der Bilddaten eine URL, lädt Marinara öffentliche CDN-URLs über die üblichen Prüfungen für ausgehende Anfragen herunter. Eine private oder Loopback-URL als Ergebnis akzeptiert Marinara nur, wenn Schema, Hostname und Port exakt zum eingerichteten Bilddienst passen. Weiterleitungen von dieser Adresse dürfen nicht zu einem anderen lokalen Dienst springen. Legt ein lokaler Proxy die Ergebnisse unter einer anderen privaten Adresse ab, richte ihn so ein, dass er diese Dateien über dieselbe Adresse wie seine Bild-API ausliefert.

## ComfyUI-Workflow-JSON und RunPod

Bei **ComfyUI**, **SwarmUI** und **RunPod Serverless (ComfyUI)** erscheint ein Feld **ComfyUI workflow (optional)** oder **(required)**. Füge dort ein Workflow-JSON ein, das du in ComfyUI über **Save (API Format)**, **Export (API)** oder **Export to API** exportiert hast, je nach ComfyUI-Version. Bei ComfyUI und SwarmUI ist es optional, bei RunPod Pflicht. RunPod braucht dein RunPod-API-Token als API-Key, eine **RunPod endpoint ID** und den Workflow.

Setze diese Textmarker an die Stellen im Workflow, an denen Marinara einen Wert einfüllen soll:

- `%prompt%` und `%negative_prompt%` für die Prompts.
- `%width%`, `%height%` und `%seed%` für Bildgröße und Seed.
- `%model%`, `%steps%`, `%cfg%`, `%sampler%`, `%scheduler%` und `%denoise%` für die Einstellungen der Generierung.
- `%reference_image%` sowie `%reference_image_01%` bis `%reference_image_04%` für die Bilddaten der Referenzbilder.
- `%reference_image_name%` sowie `%reference_image_name_01%` bis `%reference_image_name_04%`, um Referenzbilder hochzuladen und ihre Dateinamen für einen lokalen LoadImage-Node in ComfyUI einzufügen.

Am wichtigsten ist `%prompt%`. Fehlt er, warnt dich der Editor. Bei ComfyUI nutzt ein leeres Feld einen eingebauten Standard-Workflow. Bei SwarmUI gelten dann die eigenen Einstellungen von SwarmUI. RunPod hat keinen Standard, deshalb ist der Workflow dort Pflicht. Alle drei nehmen bis zu 4 rohe base64-Referenzbilder an. Die Platzhalter für den Dateinamen-Upload funktionieren nur beim lokalen ComfyUI.

Die vollständigen Exportschritte, Beispiele, die Regeln für Anführungszeichen, Referenzbilder, charakterspezifische Workflows, den Netzwerkzugriff und die Fehlerbehebung findest du unter [ComfyUI-Workflow einrichten](comfyui.md).

<a id="local-image-defaults-per-connection"></a>

## Local Image Defaults pro Verbindung

Bei **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **NovelAI**, **Draw Things**, **Arli AI**, **SwarmUI** und **RunPod Serverless (ComfyUI)** erscheint an einem Bildmodell das Panel **Local image defaults**. Draw Things und Arli AI zeigen die Felder von SD Web UI. SwarmUI und RunPod zeigen die Felder von ComfyUI. Diese Werte gelten nur, wenn dieses Modell ein Bild erzeugt. **Reset** (Zurücksetzen) stellt die eingebauten Werte wieder her.

Jeder Dienst hat ein Feld **Seed**. Mit -1 bleibt jedes Bild zufällig. Jede andere Zahl nutzt jedes Mal genau diesen Seed. Die übrigen Felder hängen vom Dienst ab.

| Dienst | Feld | Standard |
| --- | --- | --- |
| AUTOMATIC1111 / Forge | Steps | 20 |
| AUTOMATIC1111 / Forge | CFG scale | 7 |
| AUTOMATIC1111 / Forge | Sampler | Euler a |
| AUTOMATIC1111 / Forge | Img2img denoise | 0.6 |
| ComfyUI | Steps | 20 |
| ComfyUI | CFG scale | 7 |
| ComfyUI | Sampler | euler_ancestral |
| ComfyUI | Scheduler | normal |
| ComfyUI | Denoise | 1 |
| NovelAI | Steps | 28 |
| NovelAI | Prompt guidance | 6 |
| NovelAI | Sampler | k_euler_ancestral |
| NovelAI | Noise schedule | karras |

Jeder Dienst hat außerdem die Felder **Prompt prefix** und **Negative prefix**. Text darin wird jedem Prompt dieses Modells vorangestellt. AUTOMATIC1111 / Forge und ComfyUI haben ein Feld **Clip skip**. AUTOMATIC1111 / Forge ergänzt den Schalter **Restore faces**. ComfyUI ergänzt einen Schalter, der einen 1x1-Platzhalter hochlädt, wenn kein Referenzbild mitkommt. Er spielt nur bei eigenen Workflows mit Referenz-Platzhaltern eine Rolle. NovelAI ergänzt **Guidance rescale** und **UC preset**.

## Referenzbilder je nach Dienst

Ein Referenzbild ist ein vorhandenes Bild, das du zusammen mit dem Prompt schickst. So behält das neue Bild etwa das Gesicht eines Charakters oder einen Kunststil bei.

| Dienst | Referenzbilder |
| --- | --- |
| OpenAI (DALL-E) | Bis zu 16, nur GPT-Image-Modelle. Keine für ein GIF |
| ChatGPT (Codex login) | Bis zu 16 |
| NovelAI | Bis zu 16, nur V4.5-Modell |
| xAI / Grok Imagine | Bis zu 3 |
| NanoGPT | Bis zu 3 |
| ComfyUI, RunPod Serverless (ComfyUI), SwarmUI | Bis zu 4, über Workflow-Platzhalter |
| Stability AI, Arli AI, SD Web UI, Draw Things | Nur das erste Bild, als Image-to-Image |
| Atlas Cloud | Erstes Bild, bei passenden Modell-IDs für Image-to-Image, Edit oder Kontext |
| SpicyAPI | Nur Edit-Modelle, bis zum Limit des Modells, passend verkleinert |
| OpenRouter Images | Unterstützt, ohne feste Obergrenze |
| Venice.ai, Z.AI | Bei Text-to-Image nicht unterstützt |
| Together AI, Pollinations, Stable Horde, fal.ai | Nicht unterstützt |

Präzise Referenzbilder funktionieren bei NovelAI nur auf einem V4.5-Modell wie `nai-diffusion-4-5-full`. NovelAI hat Precise Reference für V5 noch nicht veröffentlicht. Forderst du Referenzen auf einem anderen Modell an, erzeugt Marinara das Bild ohne sie und schreibt eine Warnung ins Server-Log.

## Anfragen zur Mediengenerierung in die Warteschlange stellen

Der Schalter **Queue media generation requests** (Anfragen zur Mediengenerierung in die Warteschlange stellen) sitzt unter **Settings → Generations → Overall Generations**. Standardmäßig ist er an.

Ist er an, schickt Marinara Bildaufträge an jedes Bildkonto einzeln nacheinander und Videoaufträge an jedes Videokonto ebenso, jeweils in einer eigenen Warteschlange. Ein Bild und ein Video für dasselbe Konto können gleichzeitig laufen. Das gilt für jede Funktion, die sie anfordert: den Illustrator, Tracker, Befehle, die Gallery, Game-Assets und heruntergeladene Agenten wie Slurp. Zwei Modelle mit derselben Adresse und demselben API-Key teilen sich eine Warteschlange. Verschiedene Konten laufen weiterhin gleichzeitig. Bei NovelAI kommt außerdem eine kurze Pause zwischen den Aufträgen hinzu. Antwortet NovelAI, dass es ausgelastet ist, wartet Marinara und versucht es noch zweimal.

Lass ihn an bei Diensten, die zwei gleichzeitige Anfragen ablehnen. Schalte ihn nur aus, wenn dein Dienst viele Anfragen gleichzeitig verkraftet und es schneller gehen soll.

## Verwandte Anleitungen

- [ComfyUI-Workflow einrichten](comfyui.md)
- [Illustrator-Agent](illustrator-agent.md)
- [Bild-Stilprofile](style-profiles.md)
- [Szenen-Hintergründe und die Gallery](scene-backgrounds.md)
- [Selfies](../conversation/selfies.md)
- [Unterstützte KI-Anbieter](../connections/providers-reference.md)
