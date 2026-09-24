# LTX-2.3-Storyboards im Game Mode

Diese Anleitung verbindet einen lokalen LTX-2.3-Workflow für Bild-zu-Video in ComfyUI mit den Storyboards im **Game Mode** von Marinara Engine. Manche Spielenden nennen das Story Mode; in Marinara heißen die Bedienelemente **Game Mode** und **Storyboards**.

Die folgende Konfiguration entstand mit der Erstbild-Generierung von **Krea 2** und dem natürlichsprachigen **Image Style** (Bildstil) **Z-Image Turbo Narrative**. Andere Bildverbindungen sollten ebenfalls funktionieren, sofern sie beschreibende Szenen-Prompts in natürlicher Sprache annehmen. Das LTX-Video rendert lokal in ComfyUI; ob das erste Bild lokal oder auf einem gehosteten Dienst entsteht, hängt von der gewählten Bildverbindung ab.

Der fertige Ablauf sieht so aus:

```text
GM narration
  -> Animation Planner
     -> imagePrompt -> image connection -> first-frame illustration
     -> narrationBeat -> Narration Passthrough -> %prompt%
  -> first frame + prompt -> ComfyUI LTX 2.3 workflow -> MP4 clip
```

Die generierte Illustration ist das erste Bild des Clips. LTX bekommt damit einen visuellen Ausgangspunkt und zusätzlich einen Prompt (den Text, den Marinara an die KI schickt), der sich ganz auf die folgende Bewegung konzentriert.

## Bevor du loslegst

Du brauchst:

1. Eine funktionierende lokale ComfyUI-Installation, die Marinara erreichen kann.
2. Den bearbeitbaren Workflow `ltx-director-simple` oder einen gleichwertigen LTX-2.3-Graphen für Bild-zu-Video, der in ComfyUI fehlerfrei durchläuft.
3. Dessen API-Export `ltx-director-simple-api` für die Marinara-Verbindung.
4. Eine Marinara-Verbindung zur Bildgenerierung für die Erstbild-Illustrationen.
5. Den Agenten **Storyboard**, installiert über **Agents > Download Agents** (Agenten herunterladen) und für das Spiel unter **Chat Settings > Agents** aktiviert.

Der bearbeitbare ComfyUI-Workflow und sein API-Export sind zwei verschiedene Dateien. Öffne `ltx-director-simple` in ComfyUI, installiere jede fehlende Custom Node, die der ComfyUI Manager meldet, und teste den Graphen dort. Importiere `ltx-director-simple-api` in die Marinara-Verbindung. Nach jeder Änderung an Nodes oder Modellen exportierst du den Graphen erneut im API-Format und ersetzt das JSON (das gespeicherte Datenformat des Workflows) auf der Verbindung. Füge niemals den normalen Workflow aus dem visuellen Editor in Marinara ein.

Den allgemeinen Ablauf für Export und Verbindung beschreibt [ComfyUI-Workflow einrichten](../media/comfyui.md).

## Ein LTX-2.3-Modell wählen

Wähle das Modellformat passend zur GPU-Architektur und zu dem Speicher, der frei bleibt, nachdem ComfyUI Text-Encoder, VAEs und Upscaler geladen hat. Das sind Startpunkte, keine Zusicherung, dass jeder Workflow auf jede Karte passt.

| GPU-Familie | Praktischer Startpunkt | Hinweise |
| --- | --- | --- |
| RTX-30-Reihe (Ampere) | INT8 ConvRot | Der speicherschonende Startpunkt für Karten der Klassen 3070, 3080 und 3090. |
| RTX-40-Reihe mit 16–24 GB | FP8 input-scaled | Nutzt den beschleunigten FP8-Pfad, den Ada-Hardware bietet. |
| RTX-40-Reihe mit 8–12 GB | INT8 ConvRot, falls FP8-Offloading zu langsam ist | Vergleich beides am echten Workflow; verfügbarer VRAM und Offloading-Verhalten bleiben entscheidend. |
| RTX-50-Reihe (Blackwell) | NVFP4-Dev-Workflow | Setzt ComfyUI, CUDA und einen Node-Stack mit NVFP4-Unterstützung voraus. |
| RTX 50 mit dem vorhandenen destillierten Workflow | FP8 input-scaled | Dieser Kompatibilitätspfad gilt, bis ein offizieller destillierter NVFP4-Checkpoint verfügbar ist. |

Der getestete Workflow auf einer RTX 3080 verwendet:

```text
ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors
```

Diese Endungen bezeichnen unterschiedliche quantisierte Modellformate und Ausführungspfade – keine Qualitätsstufen, die sich beliebig gegeneinander austauschen lassen:

- **INT8 ConvRot** ist der bewährte speicherschonende Community-Pfad für Karten der RTX-30-Reihe und kleinere Ada-Karten.
- **FP8 input-scaled** nutzt beschleunigte FP8-Matrixoperationen auf ungefähr RTX-40-Hardware von NVIDIA und neuer.
- **NVFP4** ist der Blackwell-eigene Vier-Bit-Pfad des Workflows für die RTX-50-Reihe.
- **Dev**- und **destillierte** Workflows gehen von unterschiedlichem Sampling aus. Setz keinen Dev-Checkpoint in den beiliegenden destillierten Graphen ein, ohne den Workflow entsprechend anzupassen.

Eine 8-GB-Karte startet für den ersten Integrationstest am besten mit 480p und einem Keyframe. Dass der Checkpoint hineinpasst, heißt nicht, dass auch ein längeres oder höher aufgelöstes Video hineinpasst: Video-Latents, Text-Encoder, VAEs, Audio und Upscaling belegen ebenfalls Speicher.

Der offizielle Einsteiger-Workflow nutzt diese Komponenten:

- `ltx-2.3-22b-dev-fp8.safetensors`
- `ltx-2.3-22b-distilled-lora-384.safetensors`
- `gemma_3_12B_it_fp4_mixed.safetensors`
- `ltx-2.3-spatial-upscaler-x2-1.1.safetensors`

Eigene Workflows nutzen mitunter einen destillierten v1.1-Checkpoint, eine Quantisierung von Dritten, andere Loader-Nodes oder andere Modellordner. Die im API-Workflow gespeicherten Dateinamen müssen exakt zu den Dateien passen, die ComfyUI sieht.

Offizielle Referenzen:

- [LTX 2.3: Anleitung für Bild-zu-Video](https://docs.ltx.io/open-source-model/usage-guides/image-to-video)
- [LTX-Leitfaden zum Prompten](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide)
- [LTX-2.3-Modellkarte](https://huggingface.co/Lightricks/LTX-2.3)
- [LTX-2.3-NVFP4-Modellkarte](https://huggingface.co/Lightricks/LTX-2.3-nvfp4)
- [Offizielle LTX-2.3-Beispiele für ComfyUI](https://github.com/Lightricks/ComfyUI-LTXVideo/tree/master/example_workflows/2.3)
- [Community-Gewichte: nach ComfyUI aufgeteilt und in FP8](https://huggingface.co/Kijai/LTX2.3_comfy)

## Den ComfyUI-API-Workflow vorbereiten

Stell den bearbeitbaren Workflow zuerst direkt in ComfyUI in die Warteschlange, mit einem echten Quellbild und einem einfachen Prompt. Prüf, dass dabei eine MP4-Datei mit Ton entsteht, bevor du den API-Export für Marinara anpasst.

Der einfache Marinara-Pfad nutzt einen einzigen vollständigen Prompt im globalen Prompt-Eingang des LTX Director:

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

Die LTX-Director-Node darf weiterhin Bildkonditionierung, Guide-Daten, Audio und die beiden Sampling-Stufen übernehmen. „Einfach“ bezieht sich auf den Prompt-Vertrag: Marinara schickt einen zusammenhängenden Absatz für Bild-zu-Video statt einer Prompt-Relay-Timeline.

### Erforderliche Platzhalter

Ersetze die entsprechenden Werte im API-Export durch die Marinara-Platzhalter in Anführungszeichen:

| Platzhalter | Gelieferter Wert |
| --- | --- |
| `%prompt%` | Der vollständige Prompt aus dem gewählten Storyboard-Animation-Planner und der Video-Vorlage |
| `%reference_image_name%` | Das erste Bild, das nach ComfyUI hochgeladen wurde |
| `%duration_seconds%` | Die Clip-Dauer des Storyboards in Sekunden |
| `%length%` | Die Dauer, umgerechnet auf Marinaras Bildraten-Vertrag von 16 FPS |
| `%fps%` | Die Bildrate, die Marinara für den Clip verwendet |
| `%width%`, `%height%` | Maße aus Auflösung und Seitenverhältnis der Videoverbindung |
| `%seed%` | Ein neuer Zufalls-Seed für die Anfrage |
| `%model%` | Optionaler Modellwert aus der Verbindung, falls der Workflow sein Loader-Modell nicht fest verdrahtet |

Das Referenzbild gehört in das `segments`-Array von `timeline_data` des LTX Director. Im API-Workflow ist `timeline_data` ein serialisierter JSON-String. `%length%` hält die Clip-Länge über `normalDurationFrames` dynamisch; das Referenzbild-Segment bei Frame null behält bewusst seinen eigenen festen kurzen Wert `"length":16`:

```json
{
  "timeline_data": "{\"global_prompt\":\"\",\"normalStartFrame\":0,\"normalDurationFrames\":%length%,\"segments\":[{\"id\":\"marinara-reference\",\"start\":0,\"length\":16,\"prompt\":\"\",\"type\":\"image\",\"imageFile\":\"%reference_image_name%\",\"isEndFrame\":false}],\"motionSegments\":[],\"audioSegments\":[]}"
}
```

Setz `%reference_image_name%` nicht neben `timeline_data` und nicht in ein separates Bildfeld auf oberster Ebene. Halte Bildanzahl, Sekunden und Bildrate über `%length%`, `%duration_seconds%` und `%fps%` mit den externen Eingängen des Workflows verbunden; die Zahlenwerte in einem bearbeitbaren ComfyUI-Graphen sind keine Marinara-Standardwerte.

Lass String-Platzhalter wie `%reference_image_name%` in Anführungszeichen. Bei exakt numerischen Node-Eingängen dürfen `%length%`, `%duration_seconds%` und `%fps%` in Anführungszeichen stehen, weil Marinara sie in Zahlen umwandelt. Im serialisierten `timeline_data`-String bleibt `%length%` wie gezeigt ohne Anführungszeichen, damit der dekodierte Timeline-Wert numerisch ist.

### Nach jeder Änderung exportieren

1. Stell den bearbeitbaren Workflow in ComfyUI in die Warteschlange.
2. Prüf, dass der aktuelle Graph eine abspielbare MP4-Datei erzeugt.
3. Wähle **Save (API Format)**, **Export (API)** oder **Export to API**.
4. Ergänze oder kontrollier die Platzhalter im neuen API-JSON.
5. Ersetze den Workflow, der auf der Marinara-Verbindung gespeichert ist.

Wer eine Node löscht und weiter einen älteren API-Export verwendet, behält Verweise auf eine Node, die es nicht mehr gibt. ComfyUI weist die Anfrage dann ab, noch bevor die Generierung beginnt.

## Die Marinara-Videoverbindung anlegen

1. Öffne **Settings** (Einstellungen) und dann **Connections** (Verbindungen).
2. Füge eine Verbindung vom Typ **Video Generation** (Videogenerierung) hinzu.
3. Wähle **ComfyUI**.
4. Trag die Basis-URL von ComfyUI ein, normalerweise `http://127.0.0.1:8188`, wenn es auf demselben Rechner läuft.
5. Füge den vollständigen Workflow im API-Format in **ComfyUI Workflow** ein.
6. Wähle für den ersten Test mit wenig VRAM sechs Sekunden Standarddauer, **16:9** und 480p.
7. Speichere die Verbindung.

Ein reiner Text-Verbindungstest kann `%reference_image_name%` nicht prüfen. Teste Bild-zu-Video nach dem Speichern der Verbindung über ein Bild aus der Galerie oder über ein Storyboard.

## Den Game-Mode-Chat einrichten

Öffne den Game-Mode-Chat, dann **Chat Settings** (Chat-Einstellungen) und wähle **Agents** (Agenten). Schalte **Enable Agents** (Agenten aktivieren) und **Enable Storyboards** (Storyboards aktivieren) ein, bevor du die folgenden Abschnitte einrichtest. Die Präsentation Storyboard Optimized aus dem Einrichtungsassistenten für neue Spiele aktiviert den Agenten nicht.

### Illustrator

| Einstellung | Empfohlener Wert |
| --- | --- |
| **Game Illustrator** | On |
| **Image Connection** | **Krea 2** |
| **Image Style** | **Z-Image Turbo Narrative** |
| **Use Campaign Art Style** | Off |
| **Attach Card Appearance** | Off |
| **Send Avatar References** | Off für diesen getesteten Workflow |

Der Animation Planner bekommt das Aussehen der Charaktere aus dem Storyboard-Zug ohnehin mitgeliefert. Deshalb bleibt **Attach Card Appearance** hier aus – sonst stünde dieselbe Information beim finalen Formatieren des Bildes ein zweites Mal im Prompt. Auch **Storyboard First Frame** verzichtet darauf, den Kunststil der Kampagne rund um die fertige T=0-Szene des Planners zu wiederholen.

**Send Avatar References** steuert die Referenzbilder an den Anbieter für das erste Bild, nicht das Eingangsbild von LTX. LTX bekommt die fertige Storyboard-Illustration über `%reference_image_name%`. Lass die Avatar-Referenzen bei diesem getesteten Krea-Setup aus. Schalte sie erst separat ein, wenn feststeht, dass die gewählte Bildverbindung sie unterstützt und davon profitiert.

Das erste Bild beeinflusst die Animationsqualität stark. Es sollte genau den Moment unmittelbar vor der geplanten Bewegung zeigen, mit klar erkennbarem Motiv, Weg, Händen, Tür, Requisite oder Ziel.

### Scene Videos

| Einstellung | Empfohlener Wert |
| --- | --- |
| **Video Connection** | Die oben angelegte LTX-2.3-Verbindung zu ComfyUI |
| **Game Video Prompt** | **Narration Passthrough** |

Das allgemeine **Game Video Prompt** steuert manuelle Animationen in der Galerie und bei den Game Assets. Storyboard-Clips wählen einen eigenen Prompt, ohne diese anderen Animationsaktionen zu verändern.

### Storyboards

Nutze dieses Startprofil:

| Einstellung | Empfohlener Startwert |
| --- | --- |
| **Automatic Storyboard Illustrations** | On |
| **Automatic Storyboard Animations** | On |
| **Use NovelAI Character Prompts** | Off |
| **Keyframes per Turn** | normalerweise 3; beim ersten Test mit 8 GB VRAM zunächst 1 |
| **Animation Clip Duration** | 5 Sekunden |
| **Viewer Display** | Zum Testen **Floating** |
| **Illustration Planner** | **Still Keyframes**; bleibt als Rückfalloption für reine Standbilder |
| **Animation Planner** | **LTX Simple Image-to-Video** |
| **Use Storyboard Template** | On |
| **Storyboard Illustration Prompt** | **Storyboard First Frame** |
| **Storyboard Video Prompt** | **Narration Passthrough** |

**LTX Simple Image-to-Video** ist der empfohlene Standard. Es plant ein animationsfertiges erstes Bild und einen direkten Bewegungs-Prompt aus 4–8 Sätzen. Bevorzugt werden eine Hauptaktion, ein Kameraverhalten, zurückhaltende Bewegung in der Umgebung sowie passender Ton oder ein kurzer Dialog.

**LTX Director Storyboard** bleibt als fortgeschrittene Option verfügbar. Es liefert eine ausführlichere, an der Dauer orientierte Regie samt Regeln für den Anschluss. Probier es aus, sobald der einfache Pfad stabil läuft, oder wenn ein längerer Clip wirklich mehrere verbundene Phasen braucht. Beide Planner nutzen denselben Workflow-Vertrag über `%prompt%`.

**Illustration Planner: Still Keyframes** erzeugt den Prompt für Krea nicht, solange Animationen aktiv sind. Im Animationsmodus erzeugt **LTX Simple Image-to-Video** beide Ausgaben: einen natürlichsprachigen `imagePrompt` für Krea und einen `narrationBeat` für LTX. Still Keyframes bleibt nur für Züge ausgewählt, die ohne Videos generiert werden.

**Storyboard First Frame** reicht die vollständige natürlichsprachige T=0-Szene des Animation Planners direkt an Krea weiter – ohne Keyframe-Titel, Prompt-Beschriftungen, wiederholte Notizen zum Aussehen oder Kunststil der Kampagne. Lass **Use Storyboard Template** an, damit diese Formatierung überhaupt greift.

**Narration Passthrough** ist bewusst schlank. Es reicht den fertigen `narrationBeat` des Animation Planners durch den universellen Video-Prompt-Vertrag, ohne ihn mit einer weiteren Szenen-Zusammenfassung zu umgeben.

Jedes Keyframe erzeugt einen Bildauftrag bei Krea und einen lokalen Videoauftrag bei LTX. Drei Keyframes starten also drei Erstbild-Renderings und drei Video-Renderings. Bei einer GPU mit 8 GB VRAM beginnst du mit einem Keyframe in 480p. Klappt das, gehst du schrittweise auf drei Keyframes und höhere Auflösungen.

## Den ersten Test fahren

Nimm einen abgeschlossenen Zug des Game Master (GM – die KI, die das Spiel leitet) mit einer eindeutigen sichtbaren Aktion: eine Tür öffnen, zu einem Geräusch blicken, ein paar Schritte gehen oder einen kurzen Satz sagen.

1. Für den schnellsten Test mit wenig VRAM setzt du **Keyframes per Turn** vorübergehend auf 1 und lässt **Animation Clip Duration** bei 5 Sekunden. Das normale getestete Profil nutzt 3 Keyframes.
2. Schalte beide automatischen Storyboard-Einstellungen erst ein, wenn der aktuelle GM-Zug bereits abgeschlossen ist.
3. Öffne die Galerie und wähle **Create storyboard** (Storyboard erstellen) für diesen abgeschlossenen GM-Zug. Damit startest du den kompletten Pfad aus Illustration und Animation von Hand, ohne auf einen weiteren Zug zu warten.
4. Falls die Prompt-Anzeige aktiv ist, prüf den Prompt für das erste Bild vor dem Absenden.
5. Prüf, ob das erzeugte erste Bild eine physisch brauchbare Ausgangspose zeigt.
6. Warte, bis das erste Bild und danach der Clip in ComfyUI fertig gerendert sind.
7. Setz **Keyframes per Turn** wieder auf 3 und lass beide automatischen Einstellungen für spätere Züge an, sobald der manuelle Pfad funktioniert.

Nutze beim Einrichten den Viewer-Modus **Floating**, denn so lassen sich Bilder und Clips leichter im Einzelnen prüfen. Wechsel zu **Background**, sobald der Workflow zuverlässig läuft und du die Storyboard-Medien in die Game-Mode-Szene einbetten willst.

## So funktioniert die Prompt-Übergabe

Für jedes Keyframe liefert der Animation Planner:

- `imagePrompt`: nur das sichtbare erste Bild zum Zeitpunkt T=0;
- `narrationBeat`: den vollständigen LTX-Prompt für Bild-zu-Video, der beschreibt, was als Nächstes passiert.

Der gewählte Animation Planner schreibt beide Felder. **Storyboard First Frame** formatiert `imagePrompt` und schickt diese natürlichsprachige T=0-Szene an Krea 2. Sobald das Bild vorliegt, löst **Narration Passthrough** zu `narrationBeat` auf. Marinara setzt den Text in das Feld `prompt` der normalen Videoanfrage, ersetzt damit `%prompt%` im ComfyUI-Workflow, lädt das erste Bild hoch und ersetzt `%reference_image_name%` durch dessen ComfyUI-Dateinamen.

Zwei lokale Prompt-Segmente sind nicht nötig. Ein einziger globaler Prompt ist bei diesen Storyboard-Presets der Normalfall.

## Was einen guten LTX-Prompt ausmacht

Das Quellbild beschreibt bereits Aussehen der Charaktere, Bildaufbau, Schauplatz, Licht, Farbpalette und Textur. Der Video-Prompt sollte sich auf Bewegung konzentrieren:

- ein fließender Absatz im Präsens;
- eine klar umrissene Aktion, die zur Clip-Dauer passt;
- eine Kamerabewegung, beschrieben relativ zum Motiv;
- sichtbare Reaktionen über Blick, Mimik, Haltung, Atmung oder Geste;
- höchstens eine sinnvolle Bewegung in der Umgebung;
- Umgebungsgeräusche, Effekte, Musik oder ein kurzer wörtlicher Dialog, wenn er passt;
- ein natürlicher Abschluss, eine ausklingende Bewegung oder ein kurzes Halten am Ende.

Vermeide Szenenwechsel, Schnitte, Teleportation, mehrere unzusammenhängende Aktionen, komplexe Physik, überfüllte Choreografien, exakt lesbaren Text und erneute Aufzählungen von Details, die im ersten Bild ohnehin zu sehen sind.

Beispiel:

```text
She pushes the door open and walks outside as the camera follows closely behind her. A light breeze moves her hair while her pace remains steady. She glances toward the empty street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

## Ein reproduzierbares Setup festhalten

Ein „8-GB“-Ergebnis hängt von mehr ab als vom Checkpoint. Halte beim Teilen des Workflows fest:

- das genaue GPU-Modell und den VRAM;
- die ComfyUI-Version oder den Commit;
- die Versionen von NVIDIA-Treiber, CUDA, PyTorch und Python;
- die nötigen Custom-Node-Pakete samt Versionen;
- die exakten Modell-Dateinamen und ihre ComfyUI-Ordner;
- Ausgabeauflösung, Dauer, Anzahl der Keyframes und die ungefähre Renderzeit;
- ob Krea 2 in diesem Setup lokal läuft oder über eine gehostete Bildverbindung.

Das angehängte API-JSON speichert eine Momentaufnahme von Node-IDs, Modellpfaden und Eingangsnamen. Wer die Modelle in einem anderen Ordner ablegt, etwa unter `LTX2/`, muss die Loader-Werte anpassen und eine frische API-Kopie exportieren. Ein Workflow, der in der ComfyUI-Installation seiner Autorin läuft, kann anderswo trotzdem scheitern, wenn eine Custom Node oder ein Modellpfad abweicht.

## Fehlerbehebung

### ComfyUI meldet HTTP 400 oder „Prompt outputs failed validation“

Der API-Workflow passt nicht zum aktuell installierten Graphen. Such nach einer gelöschten Node, einer ins Leere zeigenden Node-ID, einer fehlenden Custom Node, einem durch ein Node-Update umbenannten Eingang oder einem Modell-Dateinamen, den es nicht mehr gibt. Exportier einen frischen API-Workflow aus dem funktionierenden ComfyUI-Graphen.

### Bilder entstehen, Videos nicht

Prüf **Automatic Storyboard Animations** und die **Video Connection** im Game Mode. Animationen brauchen beides: die Erstbild-Illustration und eine ausgewählte Videoverbindung.

### LTX bekommt kein Startbild

Vergewissere dich, dass `%reference_image_name%` im gespeicherten API-Workflow steht und das Bildsegment des LTX Director speist. Marinara lädt das erste Bild nur hoch, wenn dieser Platzhalter vorhanden ist.

### Der Clip verformt sich, tauscht Charaktere aus oder wird chaotisch

Kehr zu **LTX Simple Image-to-Video** zurück, nimm ein Keyframe und teste einen Zug mit einer einzigen Aktion. Ein Quellbild kann in einem kurzen durchgehenden Clip nicht sauber zu mehreren Orten, Posen und Ausgängen werden. Prüf außerdem das erste Bild: Eine unklare Ausgangspose macht die Animation selbst mit gutem Bewegungs-Prompt schwerer.

### Jede Generierung sieht gleich aus

Ersetz jeden fest eingetragenen Sampling-Seed durch `%seed%`. Sobald ein brauchbares Ergebnis da ist, fixierst du diesen Seed nur vorübergehend im Workflow – nämlich dann, wenn du Änderungen am Prompt oder am Sampling vergleichst.

### Der Generierung geht der Speicher aus

Starte mit 480p. Reduzier bei Bedarf als Nächstes die Dauer. Bleib beim Testen bei einem Keyframe pro Zug, schließ andere GPU-Anwendungen und lass kein lokales Sprachmodell auf derselben GPU mit wenig VRAM geladen. Ein quantisierter Checkpoint senkt den Modellspeicher, nicht aber den Speicher für Video-Latents, Text-Encoder, VAEs, Audio und Upscaling.

### Marinara wartet nicht mehr, ComfyUI rendert weiter

Wird die Browser-Anfrage geschlossen oder bricht die Client-Verbindung ab, kann Marinaras Abfrage stoppen, ohne einen bereits in ComfyUI eingereihten Auftrag abzubrechen. Prüf Warteschlange, Verlauf und Ausgabeordner von ComfyUI, bevor du dasselbe Rendering erneut startest.

### Der Workflow läuft in ComfyUI, scheitert aber aus Marinara heraus

Vergleich das gespeicherte Verbindungs-JSON mit dem neuesten API-Export. Kontrollier Basis-URL, Schreibweise der Platzhalter, nötige Custom Nodes, Modellpfade, Ausgabe-Node, Maße und Dauerfelder. Der bearbeitbare Graph kann funktionieren, während Marinara noch eine ältere exportierte Momentaufnahme hält.

Für ausführliche Server-Traces aktivierst du das Debug-Logging und achtest auf `[debug/game/storyboard-video]` und `[video-gen/comfyui]`. Eine fehlerfreie Anfrage zeigt den fertigen globalen Prompt, den Dateinamen des hochgeladenen Referenzbilds, die Dauer, die Bildanzahl und eine eingereihte ComfyUI-Prompt-ID.

## Verwandte Anleitungen

- [Anleitung zum Storyboard-Agenten](storyboard.md)
- [ComfyUI-Workflow einrichten](../media/comfyui.md)
- [Videogenerierung für Szenen](../media/scene-video.md)
- [Game Mode: Erste Schritte](getting-started.md)
