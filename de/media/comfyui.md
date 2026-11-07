# ComfyUI-Workflow einrichten

Marinara Engine kann Bild- und Videoanfragen an einen lokalen ComfyUI-Server schicken, Bildanfragen außerdem an einen RunPod-Serverless-Endpunkt, auf dem ComfyUI läuft. Ein lokales Bildmodell kann den eingebauten Basis-Workflow von Marinara nutzen. Video und anspruchsvollere Bild-Setups nutzen deinen eigenen Workflow im API-Format, also einen Workflow, den du aus ComfyUI als JSON exportiert hast.

Das JSON, das du in Marinara einfügst, ist eine Momentaufnahme. Eine lebende Verbindung zum Workflow, der in ComfyUI offen ist, hält Marinara nicht. Änderst du den Workflow in ComfyUI, teste ihn, exportiere ihn erneut und ersetze das in Marinara gespeicherte JSON.

## Bevor du loslegst

Installiere ComfyUI, ergänze die Checkpoints und Custom Nodes, die der Workflow braucht, und starte den Server. Die übliche lokale Adresse lautet `http://127.0.0.1:8188`.

Läuft ComfyUI auf einem anderen Rechner im Heimnetzwerk, muss dessen Server auf einer Adresse lauschen, die Marinara erreichen kann. Bildkonten brauchen zusätzlich `IMAGE_LOCAL_URLS_ENABLED=true` in der `.env` von Marinara; siehe die [Referenz zur Server-Konfiguration](../CONFIGURATION.md). Klappt die Verbindung weiterhin nicht, prüf die Firewall des anderen Rechners.

Ein lokales Sprachmodell und ein Bildmodell passen unter Umständen nicht gleichzeitig in den GPU-Speicher, vor allem auf einer 8-GB-Karte. Die Bild-Warteschlange von Marinara verhindert zwar, dass Bildaufträge gleichzeitig laufen, aber zwei geladene Modelle passen dadurch nicht in denselben VRAM. Wenn der Speicher knapp wird, nimm ein Sprachmodell aus der Cloud, betreib ComfyUI auf einem anderen Gerät oder entlade das eine Modell, bevor du das andere nutzt.

## Die Marinara-Verbindung anlegen

1. Klick auf **Connections** (Verbindungen) und dann auf **Add** (Hinzufügen). Wähle im Fenster **Add account** (Konto hinzufügen) unter **Images & video** (Bilder und Video) **ComfyUI** für einen lokalen Server oder **RunPod Serverless (ComfyUI)** für einen RunPod-Endpunkt.
2. Für lokales ComfyUI trägst du seine Adresse ein (`http://127.0.0.1:8188`). Ein API-Key ist nicht nötig, es sei denn, ein Proxy vor ComfyUI verlangt einen (siehe [Proxy mit Authentifizierung nutzen](#use-an-authenticated-proxy)). Bleibt das Feld **ComfyUI workflow (optional)** leer, nutzt Marinara einen eingebauten Basis-Workflow für Text-zu-Bild.
3. Für RunPod trägst du deinen API-Key und die **RunPod endpoint ID** ein. Ein eigener Workflow ist Pflicht.
4. Richte am Bildmodell die **Local image defaults** (lokale Bild-Standardwerte) ein. Diese Werte ersetzen die passenden Platzhalter in deinem Workflow.
5. Füge den Workflow ein, speichere und klick auf **Test image** (Bild testen).

Wenn es nicht funktioniert hat, sieh unter [Fehlerbehebung](#troubleshooting) nach.

<a id="use-an-authenticated-proxy"></a>

## Proxy mit Authentifizierung nutzen

ComfyUI selbst hat keine Anmeldung. Verlangt ein vorgeschalteter Proxy ein Token oder zusätzliche Header, sendet Marinara sie bei jeder Anfrage an ComfyUI mit: beim Einreihen in die Warteschlange, beim Abfragen des Verlaufs, beim Herunterladen von Bildern, beim Hochladen von Referenzbildern und beim Auflisten der Modelle. Das Token wird am Konto gespeichert, die Header am Bild- oder Videomodell.

1. Prüft der Proxy ein Token, öffne **Connections**, bearbeite das ComfyUI-Konto und trag das Token unter **API key** ein. Marinara sendet es als `Authorization: Bearer`-Header. Ein Wert, der schon ein Schema enthält, etwa `Basic ...`, wird unverändert gesendet.
2. Speichere das Konto.
3. Braucht der Proxy zusätzliche Header, die keine Geheimwerte enthalten, öffne das Bild- oder Videomodell und klapp **Local image defaults** oder **Video defaults** (Video-Standardwerte) auf. Trag unter **Custom Request Headers** (eigene Anfrage-Header) ein JSON-Objekt ein.
4. Speichere das Modell und klick auf **Test image** oder **Test video** (Video testen). Kommt ein 401 oder 403 zurück, hat der Proxy die Zugangsdaten abgelehnt.

> **Warnung:** Füg niemals Geheimwerte in **Custom Request Headers** ein. Geheimwerte gehören in **API key**. Kontoexporte enthalten den Key nicht.

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

Füge unter **Images & video** ein Konto für **ComfyUI** hinzu und öffne sein Videomodell. Füge einen Workflow im API-Format in das Pflichtfeld **ComfyUI workflow (optional)** ein. WAN 2.2 und andere lokale Video-Graphen funktionieren, solange derselbe Workflow in ComfyUI durchläuft und über eine Ausgabe wie den Core-Node **SaveVideo** eine MP4-Datei speichert.

Video-Workflows können diese Platzhalter nutzen, jeweils in Anführungszeichen:

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

Das ist nur ein Ausschnitt: Die Node-Verknüpfungen und die übrigen Eingaben aus dem exportierten Workflow bleiben erhalten. Prompt-Platzhalter darfst du in einen längeren Text einbetten, um feste Tags davor oder dahinter zu setzen. Ein numerischer Platzhalter sollte dagegen normalerweise der komplette Wert sein. In der RunPod-Fassung des Workflows entfernst du die Anführungszeichen um diese numerischen Tokens. Und jede Einstellung, die Marinaras Verbindungs-Standardwerte nicht ändern sollen, lässt du einfach fest im Workflow stehen.

| Platzhalter           | Wert, den Marinara liefert                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `%prompt%`            | Positiver Bild-Prompt. Fehlt er, warnt der Verbindungs-Editor.                              |
| `%negative_prompt%`   | Negativer Bild-Prompt.                                                                      |
| `%width%`, `%height%` | Gewünschte Bildmaße.                                                                        |
| `%seed%`              | Seed aus der Verbindung; `-1` erzeugt einen neuen Zufalls-Seed.                             |
| `%model%`             | Das in der Verbindung gespeicherte Modell. Nimm genau den Checkpoint-Wert, den der Loader-Node erwartet. |
| `%steps%`             | Sampling-Schritte.                                                                          |
| `%cfg%`               | CFG-Scale. `%cfg_scale%` und `%scale%` funktionieren ebenfalls.                             |
| `%sampler%`           | Name des Samplers.                                                                          |
| `%scheduler%`         | Name des Schedulers.                                                                        |
| `%denoise%`           | Denoising-Stärke. `%denoising_strength%` funktioniert ebenfalls.                            |
| `%clip_skip%`         | Clip-Skip-Wert für einen kompatiblen Node.                                                  |

Speicher das JSON nach dem Bearbeiten, kopier die komplette Datei, füg sie am Bildmodell unter **ComfyUI workflow (optional)** ein, speichere und klick auf **Test image**.

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

Verlangt der Workflow zwingend einen Bildeingang, schalte unter **Local image defaults** die Option zum Hochladen eines 1x1-Platzhalters ein. Marinara schiebt dann ein winziges Platzhalterbild nach, wenn die Anfrage keine echte Referenz enthält.

### Rohe Base64-Bilddaten

Für das erste rohe Base64-Bild nimmst du `%reference_image%`, für nummerierte Eingänge `%reference_image_01%` bis `%reference_image_04%`. Diese Werte enthalten Base64-Daten ohne `data:image/...`-Präfix und funktionieren nur mit Custom Nodes, die genau dieses Format direkt annehmen.

RunPod-Workflows unterstützen die rohen Base64-Platzhalter. Die Platzhalter für hochgeladene Dateinamen sind dagegen dem lokalen ComfyUI vorbehalten und über den RunPod-Handler nicht verfügbar.

## Workflows pro Charakter pflegen

Für jeden Charakter, der einen bestimmten Checkpoint, LoRA-Stapel, ControlNet-Aufbau oder ein eigenes Referenzbild-Layout braucht, kannst du einen separaten exportierten Workflow samt eigener Marinara-Bildverbindung anlegen. Wähl das passende Bildmodell überall dort aus, wo dieser Charakter oder die jeweilige Bildfunktion die Auswahl anbietet.

Das kann gleichmäßigere Ergebnisse liefern als ein einziger Allzweck-Workflow, allerdings hält jedes Modell weiterhin seine eigene Kopie des JSON. Nach jeder Änderung am Workflow eines Charakters in ComfyUI wiederholst du für diese Verbindung also Export, Bearbeitung, Kopieren und Einfügen.

<a id="troubleshooting"></a>

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
| ComfyUI antwortet mit 401 oder 403 | Der Proxy vor ComfyUI hat die Anfrage abgelehnt. Trag seine Zugangsdaten in **API key** und etwaige zusätzliche Header unter **Custom Request Headers** ein und klick dann noch einmal auf **Test image**. Siehe [Proxy mit Authentifizierung nutzen](#use-an-authenticated-proxy). |
| Fehler: `Outbound response exceeded N bytes`      | Die Antwort hat das eingestellte Limit überschritten, das standardmäßig bei 30 MiB liegt. Eingebettete Metadaten zum Workflow oder zu Referenzbildern können das verursachen. Schalte die Metadaten in ComfyUI aus oder erhöh `IMAGE_GEN_MAX_RESPONSE_BYTES` in der `.env` von Marinara und starte Marinara neu. |
| Eine lange Bildgenerierung läuft in ein Zeitlimit | Erhöh `COMFYUI_GEN_TIMEOUT` in der `.env` von Marinara. Der Wert zählt in Sekunden, Standard ist `2400`.                                                                                                                     |
| Eine lange Videogenerierung läuft in ein Zeitlimit | Erhöh `VIDEO_GEN_TIMEOUT_MS` in der `.env` von Marinara. Der Wert zählt in Millisekunden, Standard ist `1800000` (30 Minuten).                                                                                              |
| Der GPU-Speicher reicht für die Generierung nicht | Verringer Bildmaße oder Modellgröße, entlade das lokale Sprachmodell, nimm ein entferntes Sprachmodell oder verschieb ComfyUI auf ein anderes Gerät.                                                                         |

## Verwandte Anleitungen

- [Anbieter für Bildgenerierung und Einrichtung](image-providers.md) behandelt alle unterstützten Bilddienste und die gemeinsamen Bildeinstellungen.
- [Szenenvideos generieren](scene-video.md) behandelt Videoverbindungen und alle Oberflächen für Szenenvideos.
- [LTX-2.3-Storyboards im Game Mode](../game/ltx-2-3-storyboards.md) behandelt einen LTX-Director-API-Workflow, die Platzhalter und die empfohlenen Game-Einstellungen.
- [Bild-Stilprofile](style-profiles.md) erklärt die wiederverwendbaren Prompt-Stile von Marinara.
- [Illustrator-Agent](illustrator-agent.md) behandelt die automatische Szenenillustration.
- [Referenz zur Server-Konfiguration](../CONFIGURATION.md) dokumentiert den Zugriff im lokalen Netzwerk und die ComfyUI-Zeitlimits.
- [ComfyUI-Workflow-Konzepte](https://docs.comfy.org/development/core-concepts/workflow) erklärt Workflows in der offiziellen ComfyUI-Dokumentation.
