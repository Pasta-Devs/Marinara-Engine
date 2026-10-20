# ComfyUI-Workflow einrichten

Marinara Engine schickt Anfragen zur Bild- und Videogenerierung an einen lokalen ComfyUI-Server, Bildanfragen außerdem an einen RunPod-Serverless-Endpunkt, auf dem ComfyUI läuft. Eine lokale Bildverbindung kommt mit dem eingebauten Basis-Workflow von Marinara aus. Videoverbindungen und anspruchsvollere Bild-Setups brauchen dagegen einen eigenen Workflow im API-Format.

Das Workflow-JSON, das du in Marinara einfügst, ist nur eine Momentaufnahme. Eine lebende Verbindung zum Workflow in ComfyUI gibt es nicht. Sobald du den Workflow in ComfyUI änderst, teste ihn erneut, exportiere ihn erneut und ersetze das JSON, das in der Marinara-Verbindung gespeichert ist.

## Bevor du loslegst

Installiere ComfyUI, ergänze die Checkpoints und Custom Nodes, die der Workflow braucht, und starte den Server. Die übliche lokale Adresse lautet `http://127.0.0.1:8188`.

Läuft ComfyUI auf einem anderen Rechner im Heimnetzwerk, muss dessen Server auf einer Adresse lauschen, die Marinara erreichen kann. Bildverbindungen brauchen zusätzlich `IMAGE_LOCAL_URLS_ENABLED=true` in der `.env` von Marinara; Details dazu in der [Referenz zur Server-Konfiguration](../CONFIGURATION.md). Klappt die Verbindung weiterhin nicht, prüf die Firewall des anderen Rechners.

Ein lokales Sprachmodell und ein Bildmodell passen unter Umständen nicht gleichzeitig in den GPU-Speicher, vor allem auf einer 8-GB-Karte. Die Bild-Warteschlange von Marinara verhindert zwar, dass mehrere Bildaufträge parallel laufen, aber zwei geladene Modelle passen dadurch nicht in denselben VRAM. Wenn der Speicher knapp wird, nimm ein Sprachmodell aus der Cloud oder von einem separaten Host, betreib ComfyUI auf einem anderen Gerät oder entlade das eine Modell, bevor du das andere nutzt.

## Die Marinara-Verbindung anlegen

1. Öffne **Connections** (Verbindungen) und leg eine neue Verbindung vom Typ **Image Generation** (Bildgenerierung) an.
2. Wähl **ComfyUI** für einen lokalen Server oder **RunPod Serverless (ComfyUI)** für einen RunPod-Endpunkt.
3. Für lokales ComfyUI trägst du die Base URL ein. Ein API-Key ist nicht nötig. Bleibt das Feld **ComfyUI Workflow** leer, nutzt Marinara einen eingebauten Basis-Workflow für Text-zu-Bild.
4. Für RunPod trägst du den API-Key (geheimer Zugangscode, ähnlich einem Passwort) und die Endpoint ID ein. Hier ist ein eigener Workflow Pflicht.
5. Richte die **Local Image Defaults** (Standardwerte für lokale Bilder) ein. Diese Werte ersetzen die passenden Platzhalter im Workflow.
6. Speicher die Verbindung und nutz **Test Image** (Bild testen), sobald der Workflow eingetragen ist.

## Workflow bauen und exportieren

1. Leg in ComfyUI einen eigenen Workflow für Marinara an.
2. Konfiguriere und verbinde Checkpoint, LoRAs, VAE, Prompt-Encoder, Latent-Image- oder Bild-Eingabe-Nodes, Sampler und Ausgabe-Nodes wie gewohnt.
3. Stell den Workflow in ComfyUI in die Warteschlange und prüf, ob das erwartete Bild herauskommt.
4. Bau einen Ausgabe-Node ein. **SaveImage** ist die sicherste Wahl, weil Marinara fertige Bilder und Animationen aus dem Workflow-Verlauf von ComfyUI liest.
5. Speicher den bearbeitbaren Workflow unter einem wiedererkennbaren Namen, etwa `Marinara_Workflow`.
6. Exportier den Workflow im API-Format. Je nach Version des ComfyUI-Frontends heißt die Aktion **Save (API Format)**, **Export (API)** oder **Export to API**. Taucht sie nicht auf, aktivier in ComfyUI die Entwickler- bzw. Dev-Mode-Optionen.
7. Öffne die exportierte `.json`-Datei in einem Texteditor.

Ein Workflow im API-Format unterscheidet sich vom normalen Workflow aus dem visuellen Editor. Seine obersten Schlüssel sind Node-IDs, und jeder Node enthält in der Regel `class_type` und `inputs`. Exportier die API-Variante – die reguläre Workflow-Datei mit dem visuellen Layout des Editors gehört nicht hinein.

## ComfyUI-Video-Workflows

Leg eine Verbindung vom Typ **Video Generation** (Videogenerierung) an, wähl **ComfyUI** und füg einen Workflow im API-Format in das Pflichtfeld **ComfyUI Workflow** ein. WAN 2.2 und andere lokale Video-Graphen funktionieren, solange derselbe Workflow in ComfyUI durchläuft und über eine Ausgabe wie den Core-Node **SaveVideo** eine MP4-Datei speichert.

In Video-Workflows stehen diese Platzhalter in Anführungszeichen zur Verfügung:

| Platzhalter              | Wert, den Marinara liefert                                          |
| ------------------------ | ------------------------------------------------------------------- |
| `%prompt%`               | Der kompilierte Szenen- oder Animations-Prompt.                     |
| `%width%`, `%height%`    | `832×480` für 480p oder `1280×720` für 720p, für 9:16 vertauscht.   |
| `%seed%`                 | Ein neuer zufälliger 32-Bit-Seed.                                   |
| `%length%`               | Cliplänge als Bildanzahl bei 16 fps.                                |
| `%model%`                | Der Model-Wert der Verbindung, sofern gesetzt.                      |
| `%reference_image_name%` | Der Dateiname des hochgeladenen ersten Bildes für einen ComfyUI-**LoadImage**-Node. |

Marinara stellt den Workflow über `/prompt` in die Warteschlange, fragt `/history` ab und lädt die MP4-Datei herunter, die in einer `gifs`- oder `images`-Ausgabe steht. Bild-zu-Video-Aktionen liefern `%reference_image_name%`, reine Textverbindungstests dagegen nicht. Halt diesen Eingang deshalb optional, wenn derselbe Workflow beides können soll.

Lokale WAN-Renderings dauern auf Mittelklasse-GPUs schon mal länger als 30 Minuten. ComfyUI-Videoaufträge richten sich nach `VIDEO_GEN_TIMEOUT_MS`, nicht nach dem reinen Bild-Zeitlimit `COMFYUI_GEN_TIMEOUT`. Bricht ein gültiger Workflow zu früh ab, erhöh das Video-Zeitlimit und starte Marinara neu.

## Marinara-Platzhalter einbauen

Ersetz die Werte, die Marinara steuern soll, durch die folgenden Platzhalter.

Bei einer **lokalen ComfyUI**-Verbindung bleibt jeder Platzhalter in JSON-Anführungszeichen. Marinara wertet den Workflow zuerst aus und wandelt einen exakt numerischen Platzhalter wie `"%width%"` danach in eine echte Zahl um. Dadurch bleibt er auch für Nodes gültig, die eine Zahl erwarten.

Bei einer **RunPod Serverless (ComfyUI)**-Verbindung bleiben Text-Platzhalter wie `"%prompt%"`, `"%model%"` und `"%sampler%"` in Anführungszeichen, numerische Platzhalter wie `%width%`, `%height%`, `%seed%`, `%steps%`, `%cfg%`, `%denoise%` und `%clip_skip%` dagegen ohne. Bei RunPod wird nämlich schon ersetzt, bevor Marinara den Workflow auswertet – die eingesetzte Zahl macht das übermittelte JSON also gültig. Der Verbindungs-Editor markiert diese Vorlage womöglich vorübergehend als ungültiges JSON, weil das Token ohne Anführungszeichen erst zur Generierung ersetzt wird. Speichern lässt sie sich trotz dieser Warnung.

Die relevanten Teile eines einfachen **lokalen** API-Workflows sehen etwa so aus:

```json
{
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": "%seed%",
      "steps": "%steps%",
      "cfg": "%cfg%",
      "sampler_name": "%sampler%",
      "scheduler": "%scheduler%",
      "denoise": "%denoise%"
    }
  },
  "5": {
    "class_type": "EmptyLatentImage",
    "inputs": {
      "width": "%width%",
      "height": "%height%",
      "batch_size": 1
    }
  },
  "6": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "portrait, %prompt%, masterpiece"
    }
  },
  "7": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "watermark, %negative_prompt%"
    }
  }
}
```

Das ist nur ein Ausschnitt: Die Node-Verknüpfungen und die übrigen Eingaben aus dem exportierten Workflow bleiben erhalten. Prompt-Platzhalter darfst du in einen längeren Text einbetten, um feste Tags (Schlagwörter) davor oder dahinter zu setzen. Ein numerischer Platzhalter sollte dagegen normalerweise der komplette Wert sein. In der RunPod-Fassung des Workflows entfernst du die Anführungszeichen um diese numerischen Tokens. Und jede Einstellung, die Marinaras Verbindungs-Standardwerte nicht anfassen sollen, lässt du einfach fest im Workflow stehen.

| Platzhalter           | Wert, den Marinara liefert                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `%prompt%`            | Positiver Bild-Prompt. Fehlt er, warnt der Verbindungs-Editor.                              |
| `%negative_prompt%`   | Negativer Bild-Prompt.                                                                      |
| `%width%`, `%height%` | Gewünschte Bildmaße.                                                                        |
| `%seed%`              | Seed aus der Verbindung; `-1` erzeugt jedes Mal einen neuen Zufalls-Seed.                   |
| `%model%`             | Das in der Verbindung gespeicherte Modell. Nimm genau den Checkpoint-Wert, den der Loader-Node erwartet. |
| `%steps%`             | Sampling-Schritte.                                                                          |
| `%cfg%`               | CFG-Scale. `%cfg_scale%` und `%scale%` funktionieren ebenfalls.                             |
| `%sampler%`           | Name des Samplers.                                                                          |
| `%scheduler%`         | Name des Schedulers.                                                                        |
| `%denoise%`           | Denoising-Stärke. `%denoising_strength%` funktioniert ebenfalls.                            |
| `%clip_skip%`         | Clip-Skip-Wert für einen kompatiblen Node.                                                  |

Speicher das JSON nach dem Bearbeiten, kopier die komplette Datei, füg sie unter **ComfyUI Workflow** in der Bildverbindung ein, speicher die Verbindung und klick auf **Test Image**.

## Referenzbilder nutzen

Marinara kann bis zu vier Referenzbilder mitgeben, sofern die auslösende Funktion überhaupt Bilder zu senden hat. Ein eigener Workflow braucht dafür passende Eingabe-Nodes und Platzhalter – ein Platzhalter allein legt diese Nodes weder an noch verbindet er sie.

### Lokales ComfyUI: Dateinamen für LoadImage hochladen

Für einen normalen ComfyUI-**LoadImage**-Node nimmst du einen Dateinamen-Platzhalter:

```json
{
  "12": {
    "class_type": "LoadImage",
    "inputs": {
      "image": "%reference_image_name%",
      "upload": "image"
    }
  }
}
```

Marinara lädt das Referenzbild in das Input-Verzeichnis von ComfyUI hoch und ersetzt den Platzhalter durch den Dateinamen, den ComfyUI zurückmeldet. `%reference_image_name%` steht für das erste Bild. Workflows mit mehreren Referenz-Eingängen nutzen `%reference_image_name_01%` bis `%reference_image_name_04%`.

Verlangt der Workflow zwingend ein Bild, aktivier **Upload a 1x1 placeholder when no reference image is provided** (1×1-Platzhalter hochladen, wenn kein Referenzbild vorliegt) unter **Local Image Defaults**. Marinara schiebt dann ein winziges Platzhalterbild nach, wenn die Anfrage keine echte Referenz enthält.

### Rohe Base64-Bilddaten

Für das erste rohe Base64-Bild nimmst du `%reference_image%`, für nummerierte Eingänge `%reference_image_01%` bis `%reference_image_04%`. Diese Werte enthalten Base64-Daten ohne `data:image/...`-Präfix und funktionieren nur mit Custom Nodes, die genau dieses Format direkt annehmen.

RunPod-Workflows unterstützen die rohen Base64-Platzhalter. Die Platzhalter für hochgeladene Dateinamen sind dagegen dem lokalen ComfyUI vorbehalten und über den RunPod-Handler nicht verfügbar.

## Workflows pro Charakter pflegen

Für jeden Charakter, der einen bestimmten Checkpoint, LoRA-Stapel, ControlNet-Aufbau oder ein eigenes Referenzbild-Layout braucht, kannst du einen separaten exportierten Workflow samt eigener Marinara-Bildverbindung anlegen. Wähl die passende Bildverbindung überall dort aus, wo dieser Charakter oder die jeweilige Bildfunktion die Auswahl anbietet.

Das liefert oft gleichmäßigere Ergebnisse als ein einziger Allzweck-Workflow, allerdings hält jede Verbindung weiterhin ihre eigene JSON-Kopie. Nach jeder Änderung am Workflow eines Charakters in ComfyUI wiederholst du für diese Verbindung also Export, Bearbeitung, Kopieren und Einfügen.

## Fehlerbehebung

| Problem                                          | Was du prüfen solltest                                                                                                                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marinara meldet ungültiges Workflow-JSON         | Bei lokalem ComfyUI prüf Anführungszeichen, Kommas und Klammern, nachdem du Platzhalter eingebaut hast. Bei RunPod dürfen nur numerische Platzhalter ohne Anführungszeichen stehen; alle Text-Platzhalter und der Rest der Vorlage brauchen weiterhin korrekte JSON-Syntax. |
| Der Prompt oder Platzhalter landet wörtlich in einem Node | Prüf, ob das Token exakt so geschrieben ist wie angegeben und ob der eingefügte Workflow wirklich die neu exportierte API-Version ist.                                                                                 |
| Das Bild ignoriert die gewünschten Maße          | Setz `%width%` und `%height%` in den Latent-Image-Node oder den entsprechenden Größen-Node, der den Sampler tatsächlich speist.                                                                                               |
| ComfyUI findet das Modell nicht                  | Nimm exakt den Checkpoint-Namen, den der Loader erwartet, oder lass den Checkpoint fest im Workflow stehen, statt `%model%` zu nutzen.                                                                                        |
| ComfyUI meldet einen fehlenden Node oder Eingang | Installier dieselben Custom-Node-Pakete, mit denen der Workflow gebaut wurde, und prüf, ob sich deren Eingangsnamen geändert haben.                                                                                           |
| Der Auftrag läuft durch, aber Marinara bekommt kein Bild | Ergänz einen verbundenen **SaveImage**-Ausgang und teste den Workflow noch einmal direkt in ComfyUI.                                                                                                                  |
| Ein Referenzbild-Node schlägt fehl               | Für einen normalen lokalen **LoadImage**-Node nimmst du einen `%reference_image_name...%`-Platzhalter. Rohes Base64 nur mit einem Node verwenden, der dafür gebaut ist – und prüf, ob die Marinara-Funktion überhaupt eine Referenz geliefert hat. |
| Eine ComfyUI-URL aus dem LAN oder aus der Ferne wird blockiert | Aktivier für Bildverbindungen `IMAGE_LOCAL_URLS_ENABLED`. Lass ComfyUI auf der Netzwerkschnittstelle lauschen und prüf die Firewall des Hosts. Ein ComfyUI-Server ohne Authentifizierung gehört niemals offen ins Internet. |
| Fehler: `Outbound response exceeded N bytes`      | Die Antwort hat das eingestellte Limit überschritten, das standardmäßig bei 30 MiB liegt. Eingebettete Metadaten zum Workflow oder zu Referenzbildern können das verursachen. Schalte die Metadaten in ComfyUI aus oder erhöh `IMAGE_GEN_MAX_RESPONSE_BYTES` in der `.env` von Marinara und starte Marinara neu. |
| Eine lange Bildgenerierung läuft in ein Zeitlimit | Erhöh `COMFYUI_GEN_TIMEOUT` in der `.env` von Marinara. Der Wert zählt in Sekunden, Standard ist `2400`.                                                                                                                     |
| Eine lange Videogenerierung läuft in ein Zeitlimit | Erhöh `VIDEO_GEN_TIMEOUT_MS` in der `.env` von Marinara. Der Wert zählt in Millisekunden, Standard ist `1800000` (30 Minuten).                                                                                              |
| Der GPU-Speicher reicht für die Generierung nicht | Verringer Bildmaße oder Modellgröße, entlade das lokale Sprachmodell, nimm ein entferntes Sprachmodell oder verschieb ComfyUI auf ein anderes Gerät.                                                                         |

## Verwandte Anleitungen

- [Anbieter und Einrichtung für die Bildgenerierung](image-providers.md) behandelt alle unterstützten Bilddienste und die gemeinsamen Bildeinstellungen.
- [Szenen-Videogenerierung](scene-video.md) behandelt Videoverbindungen und alle Oberflächen für Szenenvideos.
- [LTX-2.3-Storyboards im Game Mode](../game/ltx-2-3-storyboards.md) behandelt einen LTX-Director-API-Workflow, die Platzhalter und die empfohlenen Game-Einstellungen.
- [Bildstil-Profile](style-profiles.md) erklärt die wiederverwendbaren Prompt-Stile von Marinara.
- [Illustrator-Agent](illustrator-agent.md) behandelt die automatische Szenenillustration.
- [Referenz zur Server-Konfiguration](../CONFIGURATION.md) dokumentiert den Zugriff im lokalen Netzwerk und die ComfyUI-Zeitlimits.
- [ComfyUI-Workflow-Konzepte](https://docs.comfy.org/development/core-concepts/workflow) erklärt Workflows in der offiziellen ComfyUI-Dokumentation.
