# LTX-2.3-Storyboards im Game Mode

In dieser Anleitung erfährst du, wie du einen lokalen LTX-2.3-Workflow für Bild-zu-Video in ComfyUI mit den Storyboards im Game Mode verbindest, sodass aus jedem Bild des Storyboards ein kurzer Videoclip wird. Das ist ein Setup für Fortgeschrittene, für Spieler mit eigener GPU und ComfyUI. Manche Spieler nennen das Story Mode. In Marinara heißen die Bedienelemente **Game Mode** und **Storyboards**.

Das Setup entstand mit Erstbildern von **Krea 2** und dem Image Style (Bildstil) **Z-Image Turbo Narrative**. Andere Bildkonten sollten ebenfalls funktionieren, wenn sie beschreibende Szenen-Prompts in natürlicher Sprache annehmen. Das LTX-Video rendert lokal in ComfyUI. Ob das erste Bild lokal oder bei einem gehosteten Dienst entsteht, hängt von dem Bildkonto ab, das du wählst.

Der fertige Ablauf hat diese Schritte:

1. Der GM schreibt einen Zug mit Erzähltext.
2. Der Animation Planner liefert einen `imagePrompt` und einen `narrationBeat`.
3. Der `imagePrompt` geht an das Bildkonto und wird zur Erstbild-Illustration.
4. Der `narrationBeat` läuft durch **Narration Passthrough** und wird zu `%prompt%`.
5. Erstes Bild und Prompt gehen an den LTX-2.3-Workflow in ComfyUI, der daraus einen MP4-Clip macht.

Die Illustration ist das erste Bild des Clips. LTX bekommt also ein Startbild und dazu einen Prompt darüber, was sich als Nächstes bewegt. Klappt alles, erscheint ein Clip im Tab **Videos** der Galerie.

## Bevor du loslegst

Du brauchst:

1. Ein funktionierendes lokales ComfyUI, das Marinara erreichen kann. Siehe [ComfyUI-Workflow einrichten](../media/comfyui.md).
2. Eine GPU mit genug VRAM (dem Speicher auf deiner Grafikkarte). Für einen ersten Test mit 480p und einem Keyframe kann eine Karte mit 8 GB reichen.
3. Den bearbeitbaren Workflow `ltx-director-simple` oder einen gleichwertigen LTX-2.3-Graphen für Bild-zu-Video, der in ComfyUI durchläuft, und dazu seinen Export im API-Format, `ltx-director-simple-api`.
4. Ein Bildkonto in Marinara für die Erstbild-Illustrationen.
5. Den Agenten **Storyboard**, heruntergeladen über **Agents → Agent Organizer** und für das Spiel unter **Chat Settings → Agents** eingeschaltet. Siehe [Anleitung zum Storyboard-Agenten](storyboard.md).

Der bearbeitbare Workflow und sein API-Export sind zwei verschiedene Dateien. Öffne `ltx-director-simple` in ComfyUI, installiere jede Custom Node, die der ComfyUI Manager als fehlend meldet, und teste den Graphen dort. Importiere `ltx-director-simple-api` in Marinara. Nach jeder Änderung an Nodes oder Modellen exportierst du den Graphen erneut im API-Format und ersetzt das JSON im Konto in Marinara. Füge nicht den normalen Workflow aus dem visuellen Editor in Marinara ein.

## Den ComfyUI-API-Workflow vorbereiten

Stell den bearbeitbaren Workflow zuerst in ComfyUI in die Warteschlange, mit einem echten Quellbild und einem einfachen Prompt. Prüf, dass er eine MP4-Datei mit Ton speichert.

Der einfache Marinara-Pfad legt einen einzigen vollständigen Prompt in den globalen Prompt-Eingang des LTX Director:

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

Die LTX-Director-Node kann weiterhin Bildkonditionierung, Guide-Daten, Audio und die beiden Sampling-Stufen übernehmen. „Simple“ heißt hier: Marinara schickt einen zusammenhängenden Absatz für Bild-zu-Video statt einer Prompt-Relay-Timeline.

### Platzhalter

Ersetze im API-Export die passenden Werte durch diese Marinara-Platzhalter in Anführungszeichen:

| Platzhalter | Wert, den Marinara liefert |
| --- | --- |
| `%prompt%` | Der vollständige Prompt aus Animation Planner und Video-Vorlage |
| `%reference_image_name%` | Das erste Bild, hochgeladen nach ComfyUI |
| `%duration_seconds%` | Die Clip-Dauer in Sekunden |
| `%length%` | Die Dauer als Anzahl Frames bei Marinaras Standard von 16 FPS |
| `%fps%` | Die Bildrate, die Marinara verwendet |
| `%width%`, `%height%` | Maße aus Auflösung und Seitenverhältnis des Videokontos |
| `%seed%` | Ein neuer Zufalls-Seed für jede Anfrage |
| `%model%` | Optionaler Modellwert aus dem Konto, falls der Workflow sein Loader-Modell nicht festlegt |

Marinara kann außerdem `%length_s%`, `%global_prompt%`, `%local_prompts%` und `%segment_lengths%` füllen. Diese vier sind optional. Der einfache Pfad braucht sie nicht und schickt seinen Prompt über `%prompt%`.

Das Referenzbild gehört in das Array `segments` in `timeline_data` des LTX Director, das im API-Workflow ein serialisierter JSON-String ist. `%length%` hält die Clip-Länge über `normalDurationFrames` dynamisch. Das Referenzbild-Segment bei Frame null behält seinen eigenen festen Wert `"length":16`.

```json
{
  "timeline_data": "{\"global_prompt\":\"\",\"normalStartFrame\":0,\"normalDurationFrames\":%length%,\"segments\":[{\"id\":\"marinara-reference\",\"start\":0,\"length\":16,\"prompt\":\"\",\"type\":\"image\",\"imageFile\":\"%reference_image_name%\",\"isEndFrame\":false}],\"motionSegments\":[],\"audioSegments\":[]}"
}
```

- Setz `%reference_image_name%` nicht neben `timeline_data` und nicht in ein eigenes Bildfeld auf oberster Ebene.
- Lass String-Platzhalter wie `%reference_image_name%` in Anführungszeichen.
- Bei numerischen Node-Eingängen dürfen `%length%`, `%duration_seconds%` und `%fps%` in Anführungszeichen stehen, weil Marinara sie in Zahlen umwandelt. Im serialisierten String `timeline_data` bleibt `%length%` wie gezeigt ohne Anführungszeichen, damit der dekodierte Wert eine Zahl ist.
- Halte Frame-Anzahl, Sekunden und Bildrate an diese Platzhalter gebunden. Die Zahlen, die ein bearbeitbarer ComfyUI-Graph zeigt, sind keine Marinara-Standardwerte.

### Nach jeder Änderung exportieren

1. Stell den bearbeitbaren Workflow in ComfyUI in die Warteschlange und prüf, dass er eine abspielbare MP4-Datei erzeugt.
2. Wähle je nach ComfyUI-Version **Save (API Format)**, **Export (API)** oder **Export to API**.
3. Ergänze oder kontrollier die Platzhalter im neuen API-JSON.
4. Ersetze den Workflow, der im Konto in Marinara gespeichert ist.

Löschst du eine Node und nutzt weiter einen älteren Export, bleiben Verweise auf eine Node zurück, die es nicht mehr gibt. ComfyUI weist die Anfrage dann ab.

## Das Videokonto anlegen

1. Öffne **Settings → Connections** (Einstellungen → Verbindungen).
2. Klick auf **Add account** (Konto hinzufügen) und wähl ein Konto vom Typ **Video Generation** (Videogenerierung).
3. Wähle **ComfyUI**.
4. Trag die **Base URL** ein, normalerweise `http://127.0.0.1:8188`, wenn ComfyUI auf demselben Rechner läuft.
5. Füge den vollständigen Workflow im API-Format in **ComfyUI workflow** ein.
6. Wähle für den ersten Test mit wenig VRAM sechs Sekunden Standarddauer, **16:9** und 480p.
7. Speichere das Konto.

Ein reiner Text-Verbindungstest kann `%reference_image_name%` nicht prüfen. Teste Bild-zu-Video nach dem Speichern mit einem Bild aus der Galerie oder mit einem Storyboard.

## Den Game-Chat einrichten

Öffne den Game-Chat und dann **Chat Settings → Agents**. Schalte zuerst **Enable Agents** (Agenten aktivieren) und **Enable Storyboards** (Storyboards aktivieren) ein. Die Präsentation Storyboard Optimized aus dem Einrichtungsassistenten schaltet den Agenten nicht ein.

### Illustrator

| Einstellung | Empfohlener Wert |
| --- | --- |
| **Game Illustrator** | On |
| **Image model** | **Krea 2** |
| **Image Style** | **Z-Image Turbo Narrative** |
| **Use Campaign Art Style** | Off |
| **Attach Card Appearance** | Off |
| **Send Avatar References** | Off für diesen getesteten Workflow |

Der Animation Planner bekommt das Aussehen der Charaktere aus dem Zug ohnehin mitgeliefert. Deshalb bleibt **Attach Card Appearance** aus, damit es nicht doppelt im Prompt landet. Auch **Storyboard First Frame** verzichtet darauf, den Kunststil der Kampagne rund um die fertige Erstbild-Szene des Planners zu wiederholen.

**Send Avatar References** steuert die Referenzbilder, die an den Bilddienst für das erste Bild gehen. Das Eingangsbild von LTX steuert es nicht: LTX bekommt die fertige Illustration über `%reference_image_name%`. Schalte Avatar-Referenzen erst ein, wenn du geprüft hast, dass dein Bildkonto sie unterstützt und dass sie helfen.

Das erste Bild beeinflusst die Animationsqualität stark. Es sollte genau den Moment vor der geplanten Bewegung zeigen, mit klar erkennbarem Motiv, Weg, Händen, Tür, Requisite oder Ziel.

### Scene Videos

| Einstellung | Empfohlener Wert |
| --- | --- |
| **Video model** | Das LTX-2.3-Konto für ComfyUI, das du angelegt hast |
| **Game Video Prompt** | **Narration Passthrough** |

**Game Video Prompt** steuert manuelle Animationen in der Galerie und in Game Assets. Storyboard-Clips können einen eigenen Prompt nutzen, ohne diese zu verändern.

### Storyboards

| Einstellung | Empfohlener Startwert |
| --- | --- |
| **Automatic Storyboard Illustrations** | On |
| **Automatic Storyboard Animations** | On |
| **Use NovelAI Character Prompts** | Off |
| **Keyframes per Turn** | Normalerweise 3. Beim ersten Test mit 8 GB VRAM mit 1 beginnen. |
| **Animation Clip Duration** | 5 Sekunden |
| **Viewer Display** | Floating, solange du testest |
| **Illustration Planner** | **Still Keyframes** (die Rückfalloption für Züge ohne Video) |
| **Animation Planner** | **LTX Simple Image-to-Video** |
| **Use Storyboard Template** | On |
| **Storyboard Illustration Prompt** | **Storyboard First Frame** |
| **Storyboard Video Prompt** | **Narration Passthrough** |

- **LTX Simple Image-to-Video** ist der empfohlene Planner. Er plant ein animationsfertiges erstes Bild und einen direkten Bewegungs-Prompt aus 4 bis 8 Sätzen, mit einer Hauptaktion, einem Kameraverhalten, zurückhaltender Bewegung drumherum und passendem Ton oder kurzem Dialog.
- **LTX Director Storyboard** ist eine Option für Fortgeschrittene, mit ausführlicherer, an der Dauer orientierter Regie und Regeln für den Anschluss. Probier sie aus, sobald der einfache Pfad stabil läuft, oder wenn ein längerer Clip mehr verbundene Phasen braucht. Beide nutzen denselben Vertrag über `%prompt%`.
- Sind Animationen an, schreibt **LTX Simple Image-to-Video** beide Ausgaben: einen `imagePrompt` für Krea und einen `narrationBeat` für LTX. **Still Keyframes** kommt nur bei Zügen ohne Videos zum Einsatz.
- **Storyboard First Frame** schickt die vollständige natürlichsprachige Erstbild-Szene des Planners an Krea, ohne Keyframe-Titel, Prompt-Beschriftungen, wiederholte Notizen zum Aussehen oder den Kunststil der Kampagne. Lass **Use Storyboard Template** an, damit es greift.
- **Narration Passthrough** reicht den fertigen `narrationBeat` des Planners durch den Video-Prompt-Vertrag, ohne eine weitere Zusammenfassung der Szene.

Jedes Keyframe erzeugt einen Bildauftrag bei Krea und einen lokalen Videoauftrag bei LTX. Drei Keyframes starten also drei Bild-Renderings und drei Video-Renderings.

## Den ersten Test fahren

Nimm einen abgeschlossenen GM-Zug mit einer eindeutigen sichtbaren Aktion, etwa eine Tür öffnen, zu einem Geräusch blicken oder einen kurzen Satz sagen.

1. Für den schnellsten Test mit wenig VRAM setzt du **Keyframes per Turn** auf 1 und lässt **Animation Clip Duration** bei 5 Sekunden.
2. Schalte beide automatischen Storyboard-Einstellungen ein, wenn der GM-Zug abgeschlossen ist.
3. Öffne **Chat Settings → Gallery** und wähle **Create storyboard** (Storyboard erstellen). Damit startet der komplette Pfad aus Illustration und Animation, ohne dass du auf einen weiteren Zug warten musst.
4. Ist die Prompt-Prüfung an, kontrollier den Prompt für das erste Bild, bevor du ihn absendest.
5. Prüf, ob das erste Bild eine physisch brauchbare Ausgangspose zeigt.
6. Warte auf das Rendering des ersten Bildes und dann auf den Clip aus ComfyUI.
7. Sobald der manuelle Pfad funktioniert, setz **Keyframes per Turn** wieder auf 3 und lass beide automatischen Einstellungen an.

Nutze beim Einrichten den Viewer **Floating**, damit du jedes Bild und jeden Clip prüfen kannst. Wechsel später zu **Background**, wenn du die Storyboard-Medien in der Game-Szene haben willst.

Wenn es nicht funktioniert hat, siehe [Fehlerbehebung](#troubleshooting).

## So funktioniert die Prompt-Übergabe

Für jedes Keyframe liefert der Animation Planner `imagePrompt` (nur das sichtbare erste Bild zum Zeitpunkt T=0) und `narrationBeat` (den vollständigen LTX-Prompt für das, was als Nächstes passiert). **Storyboard First Frame** formatiert `imagePrompt` und schickt ihn an Krea 2. Sobald das Bild vorliegt, löst **Narration Passthrough** zu `narrationBeat` auf. Marinara setzt den Text in das Feld `prompt` der Videoanfrage, ersetzt `%prompt%` im ComfyUI-Workflow, lädt das erste Bild hoch und ersetzt `%reference_image_name%` durch dessen Dateinamen in ComfyUI. Zwei lokale Prompt-Segmente brauchst du nicht. Ein einziger globaler Prompt ist der Normalfall.

## Einen guten LTX-Prompt schreiben

Das Quellbild zeigt bereits Aussehen, Bildaufbau, Schauplatz, Licht und Stil. Im Video-Prompt sollte es um Bewegung gehen:

- Ein fließender Absatz im Präsens.
- Eine klar umrissene Aktion, die zur Clip-Länge passt.
- Eine Kamerabewegung, beschrieben relativ zum Motiv.
- Sichtbare Reaktionen über Blick, Mimik, Haltung, Atmung oder Geste.
- Höchstens eine sinnvolle Bewegung in der Umgebung.
- Umgebungsgeräusche, Effekte, Musik oder ein kurzer wörtlicher Dialog, wenn es passt.
- Ein natürliches Ende, eine ausklingende Bewegung oder ein kurzes Halten.

Vermeide Szenenwechsel, Schnitte, Teleportieren, mehrere unzusammenhängende Aktionen, komplexe Physik, überfüllte Choreografien, exakt lesbaren Text und Wiederholungen von Details, die im ersten Bild schon zu sehen sind.

```text
She pushes the door open and walks outside as the camera follows closely behind her. A light breeze moves her hair while her pace remains steady. She glances toward the empty street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

<a id="troubleshooting"></a>

## Fehlerbehebung

### ComfyUI meldet HTTP 400 oder „Prompt outputs failed validation“

Der API-Workflow passt nicht zum installierten Graphen. Such nach einer gelöschten Node, einer ins Leere zeigenden Node-ID, einer fehlenden Custom Node, einem Eingang, den ein Node-Update umbenannt hat, oder einem Modell-Dateinamen, den es nicht mehr gibt. Exportier einen frischen API-Workflow aus dem funktionierenden Graphen.

### Bilder entstehen, Videos nicht

Prüf **Automatic Storyboard Animations** und das **Video model** im Game Mode. Animationen brauchen beides: die Erstbild-Illustration und ein ausgewähltes Videokonto.

### LTX bekommt kein Startbild

Vergewissere dich, dass `%reference_image_name%` im gespeicherten API-Workflow steht und das Bildsegment des LTX Director speist. Marinara lädt das erste Bild nur hoch, wenn dieser Platzhalter vorhanden ist.

### Der Clip verformt sich, tauscht Charaktere aus oder wird chaotisch

Geh zurück zu **LTX Simple Image-to-Video**, nimm ein Keyframe und teste einen Zug mit einer einzigen Aktion. Ein einzelnes Bild kann in einem kurzen Clip nicht sauber zu mehreren Orten, Posen und Ausgängen werden. Prüf auch das erste Bild: Eine unklare Ausgangspose macht die Animation schwerer.

### Alle Generierungen sehen zu ähnlich aus

Ersetz jeden fest eingetragenen Sampling-Seed durch `%seed%`. Sobald du ein brauchbares Ergebnis hast, fixier diesen Seed vorübergehend im Workflow, und zwar nur, solange du Änderungen am Prompt oder am Sampling vergleichst.

### Der Generierung geht der Speicher aus

Starte mit 480p. Reduzier danach die Dauer. Bleib beim Testen bei einem Keyframe pro Zug, schließ andere GPU-Anwendungen und lass kein lokales Sprachmodell auf derselben GPU mit wenig VRAM geladen. Ein quantisierter Checkpoint senkt den Speicherbedarf des Modells, nicht aber den Speicher für Video-Latents, Text-Encoder, VAEs, Audio und Upscaling.

### Marinara wartet nicht mehr, ComfyUI rendert weiter

Wird die Browser-Anfrage geschlossen oder bricht die Verbindung ab, kann Marinaras Abfrage stoppen, ohne einen bereits in ComfyUI eingereihten Auftrag abzubrechen. Prüf Warteschlange, Verlauf und Ausgabeordner von ComfyUI, bevor du dasselbe Rendering erneut startest.

### Der Workflow läuft in ComfyUI, scheitert aber aus Marinara heraus

Vergleich das im Konto gespeicherte JSON mit deinem neuesten API-Export. Kontrollier Base URL, Schreibweise der Platzhalter, Custom Nodes, Modellpfade, Ausgabe-Node, Maße und Dauerfelder. Der bearbeitbare Graph kann funktionieren, während Marinara noch eine ältere exportierte Momentaufnahme hält.

Für Server-Traces schaltest du das Debug-Logging ein und achtest auf `[debug/game/storyboard-video]` und `[video-gen/comfyui]`. Eine fehlerfreie Anfrage zeigt den fertigen globalen Prompt, den Dateinamen eines hochgeladenen Referenzbilds, die Dauer, die Frame-Anzahl und eine eingereihte ComfyUI-Prompt-ID.

## Referenz: LTX-2.3-Modelle

Wähle das Modellformat passend zu deiner GPU-Familie und zu dem Speicher, der übrig bleibt, nachdem ComfyUI Text-Encoder, VAEs und Upscaler geladen hat. Das sind Startpunkte, keine Zusagen.

| GPU-Familie | Praktischer Startpunkt | Hinweise |
| --- | --- | --- |
| RTX-30-Reihe (Ampere) | INT8 ConvRot | Der speicherschonende Einstieg für Karten der Klassen 3070, 3080 und 3090. |
| RTX-40-Reihe, 16 bis 24 GB | FP8 input-scaled | Nutzt den beschleunigten FP8-Pfad auf Ada-Hardware. |
| RTX-40-Reihe, 8 bis 12 GB | INT8 ConvRot, wenn FP8-Offloading zu langsam ist | Vergleich beides an deinem Workflow. |
| RTX-50-Reihe (Blackwell) | NVFP4-Dev-Workflow | Braucht ComfyUI, CUDA und einen Node-Stack mit NVFP4-Unterstützung. |
| RTX 50, vorhandener destillierter Workflow | FP8 input-scaled | Nutze das, bis es einen offiziellen destillierten NVFP4-Checkpoint gibt. |

Der getestete Workflow auf einer RTX 3080 nutzt `ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors`. Diese Endungen stehen für unterschiedliche quantisierte Formate und Ausführungspfade, nicht für Qualitätsstufen, die sich immer gegeneinander austauschen lassen. **Dev**- und **destillierte** Workflows gehen von unterschiedlichem Sampling aus. Setz also keinen Dev-Checkpoint in den destillierten Graphen ein, ohne den Workflow anzupassen. Dass der Checkpoint hineinpasst, heißt nicht, dass auch ein längeres oder höher aufgelöstes Video hineinpasst.

Der offizielle Einsteiger-Workflow nutzt `ltx-2.3-22b-dev-fp8.safetensors`, `ltx-2.3-22b-distilled-lora-384.safetensors`, `gemma_3_12B_it_fp4_mixed.safetensors` und `ltx-2.3-spatial-upscaler-x2-1.1.safetensors`. Eigene Workflows können andere Checkpoints, Quantisierungen, Loader-Nodes oder Ordner verwenden. Die im API-Workflow gespeicherten Dateinamen müssen exakt zu den Dateien passen, die ComfyUI sieht. Liegen deine Modelle in einem anderen Ordner, etwa `LTX2/`, passe die Loader-Werte an und exportiere eine frische API-Kopie.

Wenn du einen Workflow teilst, halte fest: dein GPU-Modell und den VRAM, die ComfyUI-Version, die Versionen von NVIDIA-Treiber, CUDA, PyTorch und Python, die Custom Nodes samt Versionen, die Modell-Dateinamen und -Ordner, Auflösung, Dauer, Anzahl der Keyframes und Renderzeit sowie, ob Krea 2 lokal oder gehostet lief.

Offizielle Referenzen:

- [LTX 2.3: Anleitung für Bild-zu-Video](https://docs.ltx.io/open-source-model/usage-guides/image-to-video)
- [LTX-Leitfaden zum Prompten](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide)
- [LTX-2.3-Modellkarte](https://huggingface.co/Lightricks/LTX-2.3)
- [LTX-2.3-NVFP4-Modellkarte](https://huggingface.co/Lightricks/LTX-2.3-nvfp4)
- [Offizielle LTX-2.3-Beispiele für ComfyUI](https://github.com/Lightricks/ComfyUI-LTXVideo/tree/master/example_workflows/2.3)
- [Community-Gewichte: nach ComfyUI aufgeteilt und in FP8](https://huggingface.co/Kijai/LTX2.3_comfy)

## Verwandte Anleitungen

- [Anleitung zum Storyboard-Agenten](storyboard.md)
- [ComfyUI-Workflow einrichten](../media/comfyui.md)
- [Szenenvideos generieren](../media/scene-video.md)
- [Game Mode: Erste Schritte](getting-started.md)
