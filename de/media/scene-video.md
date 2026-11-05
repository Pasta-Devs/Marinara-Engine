# Szenenvideos generieren

Ein Szenenvideo ist ein kurzer MP4-Clip der Szene. Es kann ein Bild aus der Galerie animieren: Das Bild wird zum ersten Frame, und die KI ergänzt die Bewegung. In Roleplay kann es auch allein aus der Geschichte entstehen. In dieser Anleitung erfährst du, wie du einen Videodienst einrichtest, Clips aus der Galerie und im Game Mode erstellst und die Video-Einstellungen änderst.

Szenenvideos funktionieren in Roleplay- und Game-Chats. Conversation-Chats verschicken stattdessen Videonachrichten. Siehe [Videonachrichten](../conversation/selfies.md#video-messages).

Game Mode und **Animate illustration** (Illustration animieren) beginnen immer mit einem Bild. Generiere oder lade also zuerst eines hoch. In Roleplay folgen `/video` und die Schaltfläche **Video** der Galerie Illustrators Einstellung **First frame** (Startbild). Ist kein Startbild gewählt, brauchen sie kein Bild.

Szenenvideos laufen über eine eigene Kontoart, **Video Generation** (Videogenerierung), nicht über die normale Bildgenerierung. Fertige Clips werden mit dem Chat gespeichert und in der Galerie angezeigt. Dort kannst du sie anheften, herunterladen oder ansehen.

## Einen Videodienst einrichten

1. Klick in der oberen Leiste auf **Connections** (Verbindungen) und dann auf **Add** (Hinzufügen). Das Fenster **Add account** (Konto hinzufügen) öffnet sich.
2. Wähle einen Dienst im Abschnitt **Images & video** (Bilder und Video). Die Dienste stehen unten.
3. Füge bei einem Cloud-Dienst den API-Key ein. Ein lokales ComfyUI braucht keinen. SwarmUI braucht ein Swarm Auth Token nur, wenn dein Server ein Konto verlangt.
4. Klick auf **Connect** (Verbinden) und wähle dann ein Modell oder behalte den Standard. NanoGPT hat keinen Standard, wähl also eines aus seiner Liste. Bei ComfyUI lässt du das Modell leer, außer der Workflow verwendet `%model%`. Bei SwarmUI ist das Modell optional.
5. Öffne das Videomodell und klick auf **Test video** (Video testen), um es zu prüfen.

Jeder Dienst trägt eine Standardadresse und, wo sinnvoll, ein Standardmodell ein. NanoGPT hat kein Standardmodell, wähl also eines aus.

| Videodienst | Standardmodell | Hinweise |
| --- | --- | --- |
| **Google AI Studio** | `gemini-omni-flash-preview` | Nutzt Gemini-Omni- und Veo-Modelle über die Gemini-API. |
| **xAI Imagine** | `grok-imagine-video-1.5` | Grok-Imagine-Video über die xAI-Videos-API. |
| **OpenRouter Video** | `google/veo-3.1` | Du kannst jede Videomodell-ID von OpenRouter eintippen. |
| **NanoGPT** | keines, wähl eines | Videomodelle über NanoGPT. |
| **Atlas Cloud** | `google/veo3.1/text-to-video` | Gehostete Text-zu-Video- und Bild-zu-Video-Modelle. |
| **Seedance 2.0** | `seedance-2-0` | Modi für Text, Startbild sowie Start- und Endbild. |
| **ComfyUI** | vom Workflow vorgegeben | Lokale WAN- und andere Video-Workflows im API-Format. |
| **SwarmUI** | vom Workflow vorgegeben | ComfyUI-Video-Workflows über deinen SwarmUI-Server. |

**Google AI Studio** deckt zwei Modellfamilien ab. **Gemini Omni** nutzt `gemini-omni-flash-preview`. **Google Veo** nutzt `veo-3.1-generate-preview`. Welche davon läuft, entscheidet das Modell, das du wählst.

Für **ComfyUI** nimmst du `http://127.0.0.1:8188` und fügst einen Video-Workflow im API-Format in **ComfyUI workflow (required)** ein. Er ist Pflicht. Platzhalter und Ausgabe-Nodes stehen unter [ComfyUI-Workflow einrichten](comfyui.md#comfyui-video-workflows).

Für **SwarmUI** trägt Marinara `http://127.0.0.1:7801` ein. Füge einen Video-Workflow im API-Format in **ComfyUI workflow (required)** ein. Er ist Pflicht. SwarmUI kann die Platzhalter `%reference_image_name%` nicht verwenden, nimm also `%reference_image%`. Verlangt dein Server ein Konto, füge ein Swarm Auth Token in **API key** ein.

### Als Standard-Videomodell festlegen

Soll ein Videomodell gelten, wenn ein Chat kein eigenes hat, setze die Aufgabe **Video** unter **Defaults** (Standardwerte) oben im Panel **Connections**. In den Chat-Einstellungen erscheint sie als **Default video provider**. Fehlen ein Chat-Modell und ein Standard, warnen die Video-Aktionen und bitten dich, eines zu wählen.

### Anweisungen für Video-Prompts

Jedes Videomodell hat ein Feld **Video prompting instructions** (Anweisungen für Video-Prompts). Damit sagst du der KI, die deine Video-Prompts schreibt, was dein Videomodell erwartet, etwa Kamerabewegungen, Prompt-Länge oder Ton. Es lenkt Animationen aus der Roleplay-Galerie, Videonachrichten in Conversation und die **Image-aware shot planning** (bildgestützte Planung der Kameraeinstellungen) von Storyboard. Übernimmt die KI einen ganzen Satz daraus in den Prompt, entfernt Marinara diesen Satz. Szenenvideos im Game Mode, Clips für Anrufe und animierte Gesichtsausdrücke schreiben ihre Prompts getrennt und ignorieren das Feld.

### Video-Standardwerte pro Modell

Ein Videomodell hat ein Panel **Video defaults** (Video-Standardwerte) für Standard-Cliplänge, Seitenverhältnis und Auflösung. Diese Werte haben Vorrang vor der app-weiten Ausweichlänge.

Standardlänge, Bereich, Seitenverhältnis und Auflösung je Dienst:

- Gemini Omni: 10 s, 1 bis 60 s, 16:9, Standardauflösung des Anbieters.
- Google Veo: 8 s, 4, 6 oder 8 s, 16:9, 720p.
- xAI Imagine: 10 s, 1 bis 15 s, 16:9, 720p.
- OpenRouter Video: 10 s, 1 bis 60 s, 16:9, 720p.
- Atlas Cloud: 8 s, 1 bis 60 s, 16:9, 720p.
- Seedance 2.0: 5 s, 4 bis 15 s, 16:9, 720p.
- ComfyUI und SwarmUI: 5 s, 1 bis 60 s, 16:9, 720p.

Gemini Omni hat kein Auflösungsfeld, und seine Länge steht im Prompt-Text. Google Veo erzwingt 8 Sekunden, sobald es ein Referenzbild animiert, weil es 8 Sekunden braucht, um erstes und letztes Bild zu überblenden.

<a id="seedance-reference-frames"></a>

### Referenzbilder bei Seedance

Seedance muss dein Referenzbild über einen öffentlichen Weblink abrufen. Ein lokaler Marinara-Server hat keinen, deshalb brauchen rein lokale Setups einen zusätzlichen Schritt.

1. Öffne das Seedance-Modell.
2. Schalte **Upload Seedance reference frames temporarily** (Seedance-Referenzbilder vorübergehend hochladen) ein. Das Bild geht an einen temporären öffentlichen Link.
3. Optional: Stell **Temporary link lifetime** (Gültigkeit des temporären Links) ein. Standardmäßig sind es 12 Stunden.

Hat dein Marinara-Server bereits eine öffentliche Adresse, kannst du stattdessen eine Umgebungsvariable setzen. Siehe die [Referenz zur Server-Konfiguration](../CONFIGURATION.md).

## Ein Video aus der Galerie erstellen

Roleplay- und Game-Chats können Szenenvideos aus der Galerie erstellen. Öffne **Chat Settings** (Chat-Einstellungen) und klapp **Gallery** (Galerie) auf. Die Galerie hat einen Tab **Images** (Bilder) und einen Tab **Videos**, jeweils mit Anzahl.

### In Roleplay

**Video** in der Aktionsleiste oben in der Galerie erstellt einen Clip der neuesten Antwort, genau wie `/video`. Füge hinter `/video` eine Beschreibung hinzu, um festzulegen, was der Clip zeigen soll.

- **First frame**: folgt Illustrators Einstellung **First frame**. Das ist ein neues Illustrator-Bild der neuesten Antwort (erst gezeichnet, dann animiert), der Avatar oder das Sprite des Charakters oder gar kein Bild. Ist keines gewählt, entsteht der Clip allein aus der Geschichte.
- **Avatar**: Der Clip beginnt mit der Person, die deine Beschreibung zuerst nennt, einschließlich deiner Persona. Ein Namensteil, den niemand sonst teilt, genügt, wenn er großgeschrieben ist („Lena“ für „Dr. Lena Kowalski“). Ist niemand genannt, beginnt er mit dem Charakter des Chats.
- **Prüfen**: Ist **Expose media prompts before sending** (Medien-Prompts vor dem Senden anzeigen) eingeschaltet, kannst du den Prompt des Clips vorher prüfen und bearbeiten.
- **Kontext**: Die KI liest so viele aktuelle Nachrichten wie Illustrator für ein Bild (Illustrators **Context Size** unter **Agent Budget** auf seinem Setup-Bildschirm).
- **Ohne Bild**: Beginnt der Clip ohne Bild oder mit einem Avatar, beschreibt die KI die Szene selbst. Ihre Anweisungen stehen unter **Roleplay Clip Director** (Clip-Regie für Roleplay) in **Settings → Generations → Video Generation Prompt Overrides** (Einstellungen → Generierungen → Überschreibungen für Video-Prompts).

Der fertige Clip läuft direkt im Chat unter der neuesten Antwort, auch wenn das Bild aus einer früheren stammt. Clips öffnen sich nicht von selbst in einem schwebenden Fenster. Soll einer schweben, nutze **Pin video to chat** (Video an den Chat anheften) unter **Videos**. Über seine Schaltfläche **X** entfernst du einen Clip aus einer Nachricht. In der Galerie bleibt er erhalten.

### Im Game Mode

1. Achte darauf, dass unter **Images** mindestens ein Bild liegt. Nutze **Illustrate** (Illustrieren) oder lade eines hoch.
2. Klick auf **Video** in der Aktionsleiste oben in der Galerie.
3. Ist **Expose media prompts before sending** eingeschaltet (**Settings → Generations → Overall Generations**), prüf oder bearbeite den Prompt und klick auf **Generate** (Generieren). Brichst du ab, wird keine Anfrage gestartet.
4. Die Schaltfläche zeigt **Generating...**, und ein Banner meldet die laufende Videogenerierung.
5. Ist sie fertig, erscheint der Clip unter **Videos**.

Gibt es kein Bild, meldet Marinara „Add or generate a gallery image before generating a scene video.“ Erstell oder lade eines hoch und versuch es erneut.

### Ein einzelnes Bild animieren

1. Öffne den Tab **Images**.
2. Zeig mit der Maus auf das Bild.
3. Klick auf **Animate illustration** (das Filmsymbol).

Ist die Prompt-Prüfung eingeschaltet, zeigt ein Fenster genau den zusammengesetzten Prompt, dazu Dauer, Seitenverhältnis und Auflösung für dieses Bild. Deine Änderung gilt nur für diesen Clip. In Roleplay liest die KI, die die Bewegung plant, so viele aktuelle Nachrichten wie Illustrator, bis einschließlich der Antwort, zu der das Bild gehört. Ihre wiederverwendbaren Anweisungen stehen unter **Roleplay Gallery Animation Director** in **Settings → Generations → Video Generation Prompt Overrides**.

Jeder Clip unter **Videos** läuft eingebettet und zeigt Länge und Modellnamen. Nutze **Pin video to chat** oder **Download scene video** (Szenenvideo herunterladen). Gibt es keine Clips, zeigt der Tab **No videos yet**.

## Einen Dienst wählen

Alle acht Dienste erstellen kurze Clips aus deinem Bild.

- **Google AI Studio (Gemini Omni)**: Länge bis 60 Sekunden, in den Prompt geschrieben.
- **Google AI Studio (Veo)**: starke Qualität, fest auf 4, 6 oder 8 Sekunden. Beim Animieren eines Bildes nutzt es 8.
- **xAI Imagine**: 1 bis 15 Sekunden, mit einem kürzeren Prompt-Limit als die anderen.
- **OpenRouter Video**: 1 bis 60 Sekunden, mit jedem Videomodell, das dein Konto unterstützt.
- **NanoGPT**: 1 bis 60 Sekunden, kein Standardmodell.
- **Atlas Cloud**: lädt den aktuellen Videokatalog von Atlas Cloud, Bild-zu-Video-Modelle zuerst, jeweils mit dem Einstiegspreis pro Sekunde Ausgabe. Klappt das nicht, zeigt Marinara die Startmodelle Veo 3.1 und Seedance 2.0. Du kannst eine genaue Modell-ID eintippen. Die Grenzen des Modells gelten weiterhin.
- **Seedance 2.0**: 4 bis 15 Sekunden, mit Modi für Startbild sowie Start- und Endbild. Braucht einen öffentlichen Link zu deinem Referenzbild.
- **ComfyUI**: lokal, über deinen Workflow im API-Format. Marinara lädt das Referenzbild direkt hoch, wenn der Workflow `%reference_image_name%` verwendet.
- **SwarmUI**: lokal, über deinen Workflow und deinen SwarmUI-Server. Das Referenzbild gelangt über `%reference_image%` hinein.

Videoaufträge dauern. Der Dienst startet den Auftrag, und Marinara wartet und fragt nach, bis der Clip fertig ist. Ein Clip kann mehrere Minuten brauchen. Große lokale WAN-Modelle brauchen eventuell mehr als die standardmäßigen 30 Minuten. Erhöhe dann `VIDEO_GEN_TIMEOUT_MS` und starte Marinara neu.

### Unterschiede zwischen Atlas-Cloud-Modellen

Nicht alle Atlas-Cloud-Modelle akzeptieren dieselben Einstellungen. Vor jeder Anfrage liest Marinara das veröffentlichte Eingabeschema des Modells von `static.atlascloud.ai` und passt deine Standardwerte daran an.

- Das Ausgangsbild kommt in das Bildfeld, das dieses Modell verwendet.
- Die Cliplänge wird auf die nächstgelegene Länge gesetzt, die das Modell anbietet. Ein Modell mit nur 5 oder 10 Sekunden macht aus einem Standard von 8 Sekunden 10.
- Die Auflösung wird auf die nächstgelegene Stufe gesetzt, die das Modell anbietet. Modelle, die eine Pixelgröße erwarten, erhalten die passendste Angabe `width*height` für dein Seitenverhältnis und deine Auflösung.
- Eine Einstellung, die das Modell nicht kennt, wird weggelassen, sodass der Standard des Modells gilt.

Das Serverlog nennt jeden geänderten Wert in einer Zeile, die mit `[video-gen/atlas-cloud] fitted request` beginnt. Lässt sich das Schema nicht lesen, sendet Marinara dieselbe allgemeine Anfrage wie bisher.

Wähle für Szenenvideos ein Bild-zu-Video-Modell. Ein Text-zu-Video-Modell hat kein Bildfeld. Es ignoriert dein Bild und erzeugt aus dem Prompt einen Clip, der nichts damit zu tun hat, und das Serverlog meldet das. **Test video** sendet einen einfachen Farbverlauf als Startbild, wenn das Modell ein Bild verlangt, damit auch Bild-zu-Video-Modelle den Test bestehen.

Viele Atlas-Cloud-Modelle haben eigene Eingaben wie `negative_prompt`, `seed`, `generate_audio`, `shot_type`, `enable_prompt_expansion` oder LoRA-Listen.

1. Öffne das Atlas-Cloud-Modell und wähle ein Modell aus oder tipp eines ein.
2. Klapp **Video defaults** und dann **Atlas Cloud setup** (Atlas-Cloud-Einrichtung) auf.
3. Unter den Reglern für Länge, Seitenverhältnis und Auflösung findest du **Model options** (Modelloptionen).

Oben in **Model options** stehen die Längen, Auflösungen, Bildgrößen und Seitenverhältnisse, die das Modell akzeptiert. Bei einem Text-zu-Video-Modell erscheint zusätzlich eine Warnung. Jede Option trägt den Namen und die Beschreibung von Atlas Cloud und beginnt auf **Model default** (Modellstandard), mit dem Standardwert in Klammern. Eine Option auf **Model default** wird nicht gesendet. Änderst du eine, wird dein Wert bei jedem Video dieses Modells gesendet, auch bei **Test video**. Listen- und Objekteingaben, etwa LoRAs, werden als JSON eingegeben.

Die Auswahl wird pro Modell gespeichert. **Reset model options** (Modelloptionen zurücksetzen) löscht sie für das aktuelle Modell. Klick auf **Save** (Speichern), um deine Änderungen zu behalten. Passt eine gespeicherte Option nicht mehr zum Modell, lässt Marinara sie weg und nennt sie in der Logzeile.

## Ein Video in Game Assets erstellen

Im Game Mode gibt es eine zweite Stelle für Szenenvideos: **Game Assets**. Klick auf seine Schaltfläche mit dem Ordnersymbol, nahe der oberen rechten Ecke des Chats. Am Computer öffnet es sich als Fenster, am Telefon als Panel über die ganze Breite. Hast du es in die Chat-Einstellungen verschoben, öffne dort den Abschnitt **Game Assets**.

1. Öffne **Game Assets**.
2. Klick auf **Generate video** (Video generieren, „Generate a scene video from the latest illustration“).
3. Sobald der neueste Clip fertig ist, läuft er dort.

**Generate video** bleibt inaktiv, bis das Spiel sowohl ein Videomodell als auch eine Szenen-Illustration hat. Klickst du zu früh, siehst du womöglich „Choose a Video Generation connection in Game Settings first.“ (leg ein Videomodell für das Spiel fest) oder „Generate a scene illustration before generating a scene video.“ Scheitert ein Clip, zeigt das Panel „Scene video generation failed.“ Versuch es erneut, und prüf deinen Key, falls es weiter scheitert.

## Ein Videomodell für einen Chat wählen

Jeder Chat wählt sein eigenes Videomodell unter **Chat Settings → Agents → Scene Videos**.

- **Roleplay** zeigt eine Karte **Scene Videos** („Generate manual MP4 scene videos from gallery images“). Sie hat ein einziges Bedienelement, die Liste der Videomodelle.
- **Game Mode** zeigt eine Karte **Scene Videos** („Generate MP4 scene videos from game illustrations“) mit mehr Bedienelementen. Die Liste der Videomodelle wählt das Modell. **Game Video Prompt** ist die Vorlage, die bestimmt, wie sich das Bild bewegt. Der eingebaute Standard ist **Cinematic Scene Video**. **Edit Video Prompt Presets** (Video-Prompt-Presets bearbeiten) legt eigene Kopien für diesen Chat an und bearbeitet sie.

**Game Video Prompt** steuert die manuellen Videos aus Galerie und Game Assets im Game Mode. Galerie-Animationen in Roleplay nutzen stattdessen **Roleplay Gallery Animation Director**. Der Storyboard-Agent hat einen eigenen Standard für den **Storyboard Video Prompt**. Jeder Chat kann ihn unter **Chat Settings → Agents → Storyboards** überschreiben. Beim Zurücksetzen gilt wieder der Standard des Storyboard-Agenten.

Beim Anlegen eines Game-Chats bietet der Einrichtungsassistent im Schritt **Features** eine Auswahl für das Videomodell, sobald du die visuelle Generierung einschaltest.

## Einstellungen zur Videogenerierung

Einige Video-Standardwerte gelten app-weit. Öffne **Settings → Generations** und such den Bereich **Video Generation** („Set default clip lengths and edit reusable video prompts for Game, Gallery, and Calls“).

- **Scene video fallback length** (Ausweichlänge für Szenenvideos): greift nur, wenn das gewählte Videomodell keine eigene Länge hat. Standard sind 10 Sekunden. Möglich sind 1 bis 60.
- **Video Generation Prompt Overrides**: Hier bearbeitest du die wiederverwendbaren Vorlagen für Video-Prompts. **Roleplay Gallery Animation Director** legt die Anweisungen fest, die vor einem Galerie-Clip in Roleplay an das Prompt Model gehen. Seine Variable `${durationSeconds}` wird zur Cliplänge.
- **Videos per reply** (Videos pro Antwort): wie viele Videonachrichten Conversation-Charaktere in einer Antwort senden können und wie viele Clips Illustrator einer Roleplay-Antwort hinzufügt. Standard ist 3. Möglich sind 1 bis 10. Jeder Conversation-Charakter sendet höchstens eine. Die Einstellung ist für Gruppenchats gedacht und für Anfragen nach mehreren Videos auf einmal. Erhöhe den Wert, damit mehr Charaktere einen Clip senden können. Senke ihn, um Anfragen zu sparen. Clips über dem Limit werden übersprungen. `/video` und die Schaltfläche **Video** der Galerie zählen nicht dazu.
- **Animated expression length** gehört zu den animierten Porträt-Sprites. Siehe [Animierte Gesichtsausdrücke](animated-expressions.md).

## Storyboards

Der herunterladbare Storyboard-Agent erzeugt in Roleplay und Game Mode geordnete Keyframe-Bilder und Clips. Sind Animationen eingeschaltet, animiert Marinara jedes erfolgreiche Keyframe mit dem gewählten Videomodell und dem **Storyboard Video Prompt** des Agenten. Siehe die [Anleitung zum Storyboard-Agenten](../game/storyboard.md).

## Fehlerbehebung

### „Choose a Video Generation connection“

Dein Chat hat kein Videomodell. Öffne **Chat Settings → Agents → Scene Videos** und wähle eines. Ist die Liste leer, füge unter **Connections** eines hinzu.

### „Add or generate a gallery image before generating a scene video“

Game Mode und **Animate illustration** brauchen ein vorhandenes Bild. Roleplay kann einen Clip allein aus der Geschichte erstellen, wenn kein Startbild gewählt ist. Nutze **Illustrate**, lade ein Bild hoch oder klick bei einem vorhandenen Bild auf **Animate illustration**.

### Das Video dauert lange

Das ist normal. Google, xAI, OpenRouter, NanoGPT, Atlas Cloud und Seedance starten alle einen Auftrag, und Marinara wartet darauf. Ein Clip kann mehrere Minuten brauchen.

### Seedance kann das Referenzbild nicht lesen

Seedance braucht einen öffentlichen Link zu deinem Bild. Schalte auf einem lokalen Server beim Seedance-Modell **Upload Seedance reference frames temporarily** ein. Siehe [Referenzbilder bei Seedance](#seedance-reference-frames).

### Eine Videoanfrage scheitert immer wieder

Prüf, ob das Konto einen gültigen API-Key und Videozugriff hat. Öffne das Konto in **Connections** und kontrollier Key und Modell. Zu serverseitigen Zeitlimits siehe die [Referenz zur Server-Konfiguration](../CONFIGURATION.md).

## Verwandte Anleitungen

- [Animierte Gesichtsausdrücke](animated-expressions.md)
- [Anleitung zum Storyboard-Agenten](../game/storyboard.md)
- [LTX-2.3-Storyboards im Game Mode](../game/ltx-2-3-storyboards.md)
- [Unterstützte KI-Anbieter](../connections/providers-reference.md)
- [Referenz zur Server-Konfiguration](../CONFIGURATION.md)
