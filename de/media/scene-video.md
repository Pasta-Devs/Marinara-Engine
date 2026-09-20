# Szenenvideos generieren

In dieser Anleitung erfährst du, wie Marinara Engine aus einer Szenen-Illustration einen kurzen MP4-Videoclip macht. Sie behandelt die Video-Anbieter, die Generierung eines Clips aus der Galerie, die Bedienelemente im Game Mode und die Video-Einstellungen. Ein Szenenvideo ist ein kurzer animierter Clip, der aus einem einzelnen Standbild entsteht.

## Was ein Szenenvideo macht

Ein Szenenvideo nimmt ein vorhandenes Bild aus der Galerie und animiert es zu einem kurzen MP4-Clip. Das Standbild wird zum ersten Bild, die KI ergänzt die Bewegung. Szenenvideos funktionieren in **Roleplay**- und **Game-Mode**-Chats.

Ohne Bild geht nichts. Aus reinem Text lässt sich kein Szenenvideo generieren. Erst muss ein Galeriebild da sein – generiert oder hochgeladen –, dann kannst du es animieren.

Szenenvideos laufen über einen eigenen Verbindungstyp namens **Video Generation** (Videogenerierung). Mit der normalen Bildgenerierung hat das nichts zu tun. Die fertigen Clips landen beim Chat und erscheinen in der Galerie. Dort kannst du sie anheften, herunterladen oder ansehen.

## Verbindungen vom Typ Video Generation

Für Szenenvideos legst du zuerst eine Verbindung an, die Videos generieren kann. Das läuft über dasselbe **Connections**-Panel (Verbindungen) wie bei Chat- und Bildverbindungen.

1. Öffne **Settings** (Einstellungen) und dann **Connections**.
2. Klick auf **Add Connection** (Verbindung hinzufügen).
3. Stell den Anbietertyp auf **Video Generation**.
4. Wähl unter **Video Service** (Videodienst) einen der sechs Dienste weiter unten.
5. Gib den API-Key für einen Cloud-Dienst ein – den geheimen Zugangscode, ähnlich einem Passwort. Ein lokales ComfyUI braucht keinen.
6. Wähl bei Cloud-Diensten ein Modell oder behalte den Standard des Anbieters. Bei ComfyUI lässt du das Modell leer, außer der Workflow verwendet `%model%`.
7. Speichere die Verbindung.

Die Auswahl unter **Video Service** bietet sechs Möglichkeiten. Jede trägt eine Standard-Webadresse ein und, wo sinnvoll, ein Standardmodell:

| Video Service        | Standardmodell                    | Hinweise                                                                     |
| -------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| **Google AI Studio** | `gemini-omni-flash-preview`       | Nutzt die Videomodelle Gemini Omni und Veo über die Gemini-API.              |
| **xAI Imagine**      | `grok-imagine-video-1.5`          | Grok-Imagine-Video über die xAI-Videos-API.                                  |
| **OpenRouter Video** | `google/veo-3.1`                  | Videomodelle über OpenRouter. Jede OpenRouter-Video-Modell-ID ist eintippbar. |
| **Atlas Cloud**      | `google/veo3.1/text-to-video`     | Gehostete Text-zu-Video- und Bild-zu-Video-Modelle über Atlas Cloud.         |
| **Seedance 2.0**     | `seedance-2-0`                    | Videomodi für Text, erstes Bild sowie erstes und letztes Bild.               |
| **ComfyUI**          | Vom Workflow vorgegeben           | Lokale WAN- und andere Video-Workflows, exportiert im API-Format.            |

**Google AI Studio** deckt zwei Modellfamilien ab. **Gemini Omni** nutzt `gemini-omni-flash-preview`, **Google Veo** nutzt `veo-3.1-generate-preview`. Welche davon läuft, entscheidet das Modell, das du in der Verbindung auswählst.

Für **ComfyUI** nimmst du die übliche lokale Adresse `http://127.0.0.1:8188` und fügst einen Video-Workflow im API-Format in **ComfyUI Workflow** ein. Ohne diesen Workflow geht es nicht. Platzhalter und Anforderungen an den Ausgabe-Node stehen unter [ComfyUI-Workflow einrichten](comfyui.md#comfyui-video-workflows).

### Als Standard-Videoverbindung festlegen

Der Verbindungseditor zeigt bei einer Video-Generation-Verbindung die Gruppe **Default for Videos** (Standard für Videos). Aktiviere **Use as default video connection** (Als Standard-Videoverbindung verwenden), damit Marinara auf diese Verbindung zurückgreift, wenn ein Chat keine eigene Videoverbindung hat. Markiere immer nur eine einzige Verbindung als Standard.

### Video-Standardwerte der Verbindung

Jede Video-Generation-Verbindung hat im Verbindungseditor ein eigenes Panel **Video Generation Defaults** (Standardwerte für die Videogenerierung). Dort legst du Cliplänge, Seitenverhältnis und Auflösung für diese Verbindung fest. Diese Werte pro Verbindung haben Vorrang vor der app-weiten Ausweichlänge.

| Dienst           | Standardlänge  | Längenbereich | Seitenverhältnis | Auflösung        |
| ---------------- | -------------- | ------------ | ------------ | ---------------- |
| Gemini Omni      | 10 s           | 1 bis 60 s   | 16:9         | Standard des Anbieters |
| Google Veo       | 8 s            | 4, 6 oder 8 s | 16:9        | 720p             |
| xAI Imagine      | 10 s           | 1 bis 15 s   | 16:9         | 720p             |
| OpenRouter Video | 10 s           | 1 bis 60 s   | 16:9         | 720p             |
| Atlas Cloud      | 8 s            | 1 bis 60 s   | 16:9         | 720p             |
| Seedance 2.0     | 5 s            | 4 bis 15 s   | 16:9         | 720p             |
| ComfyUI          | 5 s            | 1 bis 60 s   | 16:9         | 720p             |

Gemini Omni hat kein Auflösungsfeld, und die Länge steht im Prompt-Text statt in einer eigenen Einstellung – der Prompt ist der Text, den Marinara an die KI schickt. Google Veo erzwingt 8 Sekunden, sobald ein Referenzbild animiert wird: Für die Überblendung von erstem und letztem Bild braucht das Modell genau diese 8 Sekunden.

### Referenzbilder bei Seedance

Seedance muss das Referenzbild über einen öffentlichen Weblink abrufen, bevor es animieren kann. Ein lokaler Marinara-Server hat keinen solchen Link, deshalb ist bei rein lokalen Setups ein Zwischenschritt nötig.

Öffne die Seedance-Verbindung und aktiviere **Upload Seedance reference frames temporarily** (Seedance-Referenzbilder vorübergehend hochladen). Marinara lädt das Referenzbild dann auf einen temporären öffentlichen Link, den Seedance lesen kann. Wie lange dieser Link gilt, stellst du unter **Temporary link lifetime** (Gültigkeit des temporären Links) ein; standardmäßig sind es 12 Stunden.

Hat der Marinara-Server bereits eine öffentliche Webadresse, kannst du statt der temporären Uploads eine Umgebungsvariable setzen. Die passende Einstellung für Videoreferenzen findest du in der [Referenz zur Serverkonfiguration](../CONFIGURATION.md).

## Den passenden Anbieter wählen

Alle sechs Dienste machen kurze Clips aus einem Bild. Unterschiede gibt es bei Tempo, Cliplänge und im Umgang mit Referenzbildern.

- **Google AI Studio (Gemini Omni)**: flexible Länge bis 60 Sekunden. Die Länge steckt im Prompt, nicht in einem eigenen Bedienelement.
- **Google AI Studio (Veo)**: starke Qualität, aber fest auf 4, 6 oder 8 Sekunden. Beim Animieren eines Bildes sind es 8 Sekunden.
- **xAI Imagine**: Clips von 1 bis 15 Sekunden. Die Prompt-Länge ist stärker begrenzt als bei den anderen Diensten.
- **OpenRouter Video**: 1 bis 60 Sekunden, und du kannst jedes Videomodell eintippen, das dein OpenRouter-Konto unterstützt.
- **Atlas Cloud**: **Fetch Models** (Modelle abrufen) lädt den aktuellen Videokatalog von Atlas Cloud. Bild-zu-Video-Modelle stehen zuerst, jeweils mit dem Einstiegspreis pro Sekunde Ausgabevideo. Ist der Katalog nicht erreichbar, zeigt Marinara stattdessen die Startmodelle Veo 3.1 und Seedance 2.0. Du kannst auch eine genaue Atlas Cloud-Videomodell-ID eingeben; die jeweiligen Grenzen für Dauer, Auflösung und Referenzbilder gelten weiterhin.
- **Seedance 2.0**: Clips von 4 bis 15 Sekunden, mit Modi für das erste Bild sowie für erstes und letztes Bild. Braucht einen öffentlichen Link zum Referenzbild.
- **ComfyUI**: lokale Generierung über einen eigenen Workflow im API-Format. Marinara lädt das Referenzbild direkt zu ComfyUI hoch, wenn der Workflow `%reference_image_name%` verwendet.

Videoaufträge dauern. Der Anbieter startet den Auftrag, Marinara wartet und fragt so lange nach, bis der Clip fertig ist. Pro Clip können das mehrere Minuten sein – deutlich länger als bei einem Standbild. Große lokale WAN-Modelle sprengen manchmal das Zeitlimit von standardmäßig 30 Minuten; dann erhöhe `VIDEO_GEN_TIMEOUT_MS` und starte Marinara neu.

### Unterschiede zwischen Atlas Cloud-Modellen

Atlas Cloud-Modelle akzeptieren nicht alle dieselben Einstellungen. Vor jeder Anfrage liest Marinara das veröffentlichte Eingabeschema des Modells von `static.atlascloud.ai` und passt deine Verbindungsstandards daran an:

- Die Ausgangsillustration wird im Bildfeld gesendet, das dieses Modell verwendet.
- Die Cliplänge wird auf die nächstgelegene unterstützte Länge gesetzt. Ein Modell mit nur 5 oder 10 Sekunden macht aus einem Standard von 8 Sekunden einen Clip mit 10 Sekunden.
- Die Auflösung wird auf die nächstgelegene unterstützte Stufe gesetzt. Modelle mit Pixelmaßen erhalten stattdessen die passendste Angabe `width*height` für dein Seitenverhältnis und deine Auflösung.
- Einstellungen, die das Modell nicht kennt, werden weggelassen, damit sein eigener Standard gilt.

Das Serverlog nennt jede geänderte Angabe in einer Zeile, die mit `[video-gen/atlas-cloud] fitted request` beginnt. Kann das Schema nicht gelesen werden, sendet Marinara dieselbe allgemeine Anfrage wie bisher.

Wähl für Szenenvideos ein **image-to-video**-Modell (Bild zu Video). Ein Text-zu-Video-Modell hat kein Bildfeld: Es ignoriert deine Illustration und erzeugt nur aus dem Prompt einen unabhängigen Clip. Das Serverlog meldet diesen Fall.

**Test Video** (Video testen) sendet einen einfachen Farbverlauf als erstes Bild, wenn das gewählte Atlas Cloud-Modell ein Bild verlangt. So können auch Bild-zu-Video-Modelle den Verbindungstest bestehen.

### Modelloptionen von Atlas Cloud

Viele Atlas Cloud-Modelle haben eigene Eingaben wie `negative_prompt`, `seed`, `generate_audio`, `shot_type`, `enable_prompt_expansion` oder LoRA-Listen. Der Verbindungseditor zeigt sie für dein gewähltes Modell:

1. Öffne die Atlas Cloud-Verbindung und wähl ein Modell aus oder gib es ein.
2. Klapp **Video Defaults** (Videostandards) und dann **Atlas Cloud setup** (Atlas Cloud-Einrichtung) auf.
3. Unter Cliplänge, Seitenverhältnis und Auflösung findest du **Model options** (Modelloptionen).

Oben in **Model options** stehen die unterstützten Cliplängen, Auflösungen, Bildgrößen und Seitenverhältnisse. Bei einem Text-zu-Video-Modell erscheint dort auch eine Warnung, weil es dein Galeriebild nicht verwenden kann.

Jede Option trägt den genauen Namen und die Beschreibung von Atlas Cloud. Alle Optionen beginnen mit **Model default** (Modellstandard); der Standardwert des Anbieters steht in Klammern. Eine Option auf **Model default** wird nicht gesendet, also entscheidet Atlas Cloud. Änderst du sie, wird dein Wert bei jedem Video dieser Verbindung gesendet, auch bei **Test Video**. Listen und Objekte, etwa LoRAs, werden als JSON eingegeben.

Die Auswahl wird pro Modell gespeichert. Wechselst du zu einem anderen Modell und zurück, bleiben die jeweiligen Optionen erhalten. **Reset model options** (Modelloptionen zurücksetzen) löscht die Auswahl für das aktuelle Modell. Klick in der Verbindung auf **Save** (Speichern), um deine Änderungen zu behalten.

Passt eine gespeicherte Option nicht mehr zum Modell, etwa weil Atlas Cloud dessen Eingaben geändert hat, lässt Marinara sie in der Anfrage weg und nennt sie in der Logzeile `[video-gen/atlas-cloud] fitted request`.

## Ein Video aus der Galerie generieren

Sowohl **Roleplay**- als auch **Game-Mode**-Chats erzeugen Szenenvideos über das **Gallery**-Panel (Galerie). Öffne es über das Bild- oder Galeriesymbol im Chat. Game-Mode-Chats haben dafür noch eine zweite Stelle, das **Game Assets**-Panel – dazu weiter unten mehr.

Die Galerie hat einen Tab **Images** (Bilder) und einen Tab **Videos**, jeweils mit Anzahl. Standbilder liegen unter **Images**, fertige Clips unter **Videos**.

So animierst du das neueste Bild:

1. Achte darauf, dass unter **Images** mindestens ein Bild liegt. Nutze sonst **Illustrate** (Illustrieren) oder lade ein Bild hoch.
2. Klick auf **Video** in der Aktionsleiste oben in der Galerie.
3. Ist **Expose media prompts before sending** unter **Settings**, **Generations**, **Overall Generations** aktiviert, prüfst oder bearbeitest du jetzt den fertig zusammengesetzten Animations-Prompt und klickst auf **Generate**. Brichst du dieses Fenster ab, geht keine Anfrage an den Anbieter.
4. Die Schaltfläche wechselt zu **Generating...**, und ein Banner meldet die laufende Videogenerierung.
5. Ist alles fertig, erscheint der Clip unter dem Tab **Videos**.

So animierst du stattdessen ein bestimmtes Bild:

1. Öffne den Tab **Images**.
2. Zeig mit der Maus auf das gewünschte Bild.
3. Klick in den eingeblendeten Bedienelementen auf **Animate illustration** (Illustration animieren, das Filmsymbol).

Bei aktivierter Prompt-Prüfung erscheint auch für **Animate illustration** dasselbe Fenster **Review Video Prompt** (Video-Prompt prüfen). Es zeigt genau den Prompt, den der Server zusammengesetzt hat, dazu Dauer, Seitenverhältnis und Auflösung für das gewählte Bild. Deine Änderung gilt nur für diese eine Generierung. Im Roleplay steuerst du die wiederverwendbaren Anweisungen hinter diesem Prompt separat über **Roleplay Gallery Animation Director** unter **Settings**, **Generations**, **Video Generation Prompt Overrides**.

Unter **Videos** läuft jeder Clip direkt im Panel und zeigt Länge und Modellnamen an. Mit **Pin video to chat** (Video an den Chat anheften) heftest du einen Clip fest, mit **Download scene video** (Szenenvideo herunterladen) speicherst du ihn. Gibt es noch keine Clips, steht dort **No videos yet**.

Versuchst du ein Video ohne Bild im Chat, meldet Marinara: „Add or generate a gallery image before generating a scene video.“ Generiere oder lade also erst ein Bild hoch und versuch es dann erneut.

## Szenenvideos im Game Mode

Im Game Mode gibt es eine zweite Stelle für Szenenvideos: das **Game Assets**-Panel. Du öffnest es über die Schaltfläche **Game Assets** in den Spielsteuerungen.

1. Öffne das **Game Assets**-Panel.
2. Klick auf **Generate video** (Video generieren). Der Tooltip – der Kurzhinweis beim Draufzeigen – lautet „Generate a scene video from the latest illustration.“
3. Sobald der neueste Clip fertig ist, läuft er im Panel.

Die Schaltfläche **Generate video** bleibt inaktiv, solange dem Spiel eine Videoverbindung oder eine Szenen-Illustration fehlt. Klickst du zu früh, erscheint womöglich eine dieser Meldungen:

- „Choose a Video Generation connection in Game Settings first.“ Leg eine Videoverbindung für das Spiel fest.
- „Generate a scene illustration before generating a scene video.“ Erzeug zuerst ein Bild.

Scheitert ein Clip, zeigt das Panel „Scene video generation failed.“ Versuch es noch einmal, und prüf Verbindung und API-Key, falls es dabei bleibt.

## Eine Videoverbindung für einen Chat wählen

Jeder Chat wählt seine eigene Videoverbindung. Das stellst du unter **Chat Settings** (Chat-Einstellungen), dann **Agents**, dann **Scene Videos** ein.

**Roleplay**-Chats zeigen eine Karte **Scene Videos** mit der Beschreibung „Generate manual MP4 scene videos from gallery images.“ Sie hat ein einziges Bedienelement, das Dropdown-Menü **Video Connection**. Dort wählst du die Video-Generation-Verbindung.

**Game-Mode**-Chats zeigen eine Karte **Scene Videos** mit der Beschreibung „Generate MP4 scene videos from game illustrations.“ Sie hat mehr Bedienelemente:

- **Video Connection**: die Video-Generation-Verbindung dieses Spiels.
- **Game Video Prompt**: die Prompt-Vorlage, die bestimmt, wie sich das Bild bewegt. Der eingebaute Standard heißt **Cinematic Scene Video**.
- **Edit Video Presets**: eigene Kopien der Video-Prompt-Vorlage für diesen Chat anlegen und bearbeiten.

Der **Game Video Prompt** steuert weiterhin die manuellen Videos aus Galerie und Game Assets im Game Mode. Galerie-Animationen im Roleplay nutzen stattdessen **Roleplay Gallery Animation Director**. Der installierte Storyboard-Agent bringt einen eigenen Standard für den **Storyboard Video Prompt** mit, und jeder Roleplay- oder Game-Chat kann ihn unter **Chat Settings > Agents > Storyboards** überschreiben. Setzt du diese Auswahl zurück, gilt wieder der Standard des Storyboard-Agenten; den Prompt eines anderen Chats übernimmt der Chat dabei nicht.

Beim Anlegen eines Game-Mode-Chats bietet auch der Einrichtungsassistent eine Auswahl **Video Generation Connection**. Sie steht im Schritt **Features** und erscheint, sobald du **Visual Generation** aktivierst.

Hat ein Chat keine eigene Videoverbindung, greift Marinara auf die Verbindung zurück, die du mit **Use as default video connection** markiert hast. Fehlen beide, warnen die Video-Aktionen und bitten dich, eine auszuwählen.

## Einstellungen zur Videogenerierung

Ein Teil der Video-Standardwerte steckt in den App-Einstellungen statt in einer Verbindung. Öffne **Settings**, dann **Generations**, dann den Bereich **Video Generation**. Er ist beschrieben als „Set default clip lengths and edit reusable video prompts for Game, Gallery, and Calls.“

Die wichtigste Szenenvideo-Einstellung dort ist **Scene video fallback length** (Ausweichlänge für Szenenvideos), standardmäßig 10 Sekunden. Sie greift nur, wenn die gewählte Videoverbindung keine eigene Länge mitbringt. Einstellbar sind 1 bis 60 Sekunden.

Im selben Bereich liegen die **Video Generation Prompt Overrides**, wo du die wiederverwendbaren Video-Prompt-Vorlagen bearbeitest. **Roleplay Gallery Animation Director** steuert die Anweisungen, die vor einem Galerie-Clip im Roleplay an das gewählte Prompt Model gehen. Die Variable `${durationSeconds}` darin wird durch die gewählte Cliplänge ersetzt. Das ist der fortgeschrittene Weg, die Bewegung der Clips zu ändern, ganz ohne Code.

Ebenfalls dort steht die Einstellung **Animated expression length**. Sie gehört zu einer anderen Funktion, den animierten Porträt-Sprites – den Charakterbildern auf der Bühne. Dazu mehr unter [Animierte Gesichtsausdrücke](animated-expressions.md).

## Storyboards

Der herunterladbare Storyboard-Agent kann in Roleplay und Game Mode geordnete Keyframe-Bilder und Clips erzeugen. Im Game Mode nutzt er genau einen abgeschlossenen Zug des Game Masters (GM); im Roleplay fasst er abgeschlossene Wortwechsel zu einer eingebetteten Episode zusammen. Sind Animationen aktiv, animiert Marinara jedes erfolgreiche Keyframe über die gewählte Videoverbindung und den **Storyboard Video Prompt** des Agenten.

Storyboards haben eigene Bedienelemente und eine eigene Anleitung. Installation und die Abläufe in beiden Modi stehen in der [Anleitung zum Storyboard-Agenten](../game/storyboard.md).

## Fehlerbehebung

### „Choose a Video Generation connection“

Für den Chat ist keine Videoverbindung ausgewählt. Öffne **Chat Settings**, dann **Agents**, dann **Scene Videos**, und wähl eine Verbindung. Ist das Dropdown-Menü leer, leg unter **Settings**, dann **Connections**, eine an.

### „Add or generate a gallery image before generating a scene video“

Ein Szenenvideo animiert immer ein vorhandenes Bild. Nutze **Illustrate**, lade ein Bild hoch, oder klick bei einem vorhandenen Bild auf **Animate illustration**.

### Das Video dauert lange

Das ist normal. Der Anbieter startet den Auftrag, Marinara wartet und fragt nach, bis der Clip fertig ist. Veo, xAI, OpenRouter, Atlas Cloud und Seedance arbeiten alle so, und ein Clip kann mehrere Minuten brauchen.

### Seedance kann das Referenzbild nicht lesen

Seedance braucht einen öffentlichen Link zum Bild. Öffne auf einem lokalen Server die Seedance-Verbindung und aktiviere **Upload Seedance reference frames temporarily**. Siehe den Seedance-Abschnitt weiter oben.

### Eine Videoanfrage scheitert immer wieder

Prüf, ob die Verbindung einen gültigen API-Key hat und ob dein Konto Videozugriff besitzt. Öffne die Verbindung unter **Settings**, dann **Connections**, und kontrollier Key und Modell. Serverseitige Zeitlimits für Video behandelt die [Referenz zur Serverkonfiguration](../CONFIGURATION.md).

## Verwandte Anleitungen

- [Animierte Gesichtsausdrücke](animated-expressions.md)
- [Anleitung zum Storyboard-Agenten](../game/storyboard.md)
- [LTX-2.3-Storyboards im Game Mode](../game/ltx-2-3-storyboards.md)
- [Unterstützte KI-Anbieter](../connections/providers-reference.md)
- [Referenz zur Serverkonfiguration](../CONFIGURATION.md)
