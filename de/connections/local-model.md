# Eingebautes Modell einrichten

Das **Built-in model** (eingebautes Modell) ist ein kleines KI-Modell, das Marinara herunterlädt und auf deinem eigenen Rechner ausführt. Es braucht weder einen API-Key noch ein Online-Konto, und nichts verlässt deinen Rechner.

Weil es klein ist, eignet es sich für Hilfsaufgaben im Hintergrund: Tracker-Agenten (Helfer, die Details der Geschichte festhalten), Szeneneffekte im Game Mode, Lorebook-Embeddings und Decision-Prüfungen. Für gutes Roleplay oder Bearbeitungen durch Professor Mari ist es zu schwach. Nimm dafür ein stärkeres Konto. Siehe [Verbindung zu einem KI-Anbieter herstellen](connecting-to-a-provider.md).

Fehlt die Karte **Built-in model**, hast du eine „Lite“-Installation, eine abgespeckte Version ohne die lokale Runtime.

## Das eingebaute Modell herunterladen

Bevor du anfängst, stell sicher, dass du genug freien Speicherplatz und Arbeitsspeicher (RAM) für das Modell hast. Die Größen stehen in der Tabelle unten.

1. Klick in der oberen Leiste auf **Connections** (Verbindungen).
2. Such unter dem Bereich **Jobs** (Aufgaben) die Karte **Built-in model**. Sie zeigt **Not downloaded**.
3. Klick auf die Karte oder auf ihre Schaltfläche **Download** (Herunterladen). Ein Fenster mit dem Titel **Built-in model** öffnet sich.
4. Wähl unter **Which model?** ein Modell. **Gemma 4 E2B — Q8 (Best Quality)** trägt die Kennzeichnung **Recommended** (empfohlen). Hat dein Rechner wenig Arbeitsspeicher, wähl **Q4_K_M**. Es braucht rund 3,4 GB RAM statt 5,4 GB.
5. Klick unten auf die Schaltfläche **Download**. Sie zeigt die Modellgröße, zum Beispiel **Download 5.0 GB**.
6. Warte. Das Fenster zeigt drei Schritte: **Install runtime**, **Download model** und **Start and test**. Eine Runtime ist das Programm, das das Modell ausführt. Fehlt sie, installiert Marinara sie zuerst.
7. Zeigt das Fenster den Modellnamen mit einem grünen Punkt, klick auf **Test**. Ein Feld mit dem Titel **Local test message** meldet **Succeeded** und zeigt, wie lange die Antwort gedauert hat.
8. Klick auf **Done** (Fertig).

Die Karte zeigt jetzt **Ready**, dazu die Modellgröße und die Aufgaben, die das Modell übernimmt.

Wenn es nicht funktioniert hat:

- **Sidecar runtime install is disabled** (eine Fehlermeldung). Das Installieren der Runtime ist eine geschützte Aktion. Siehe [Runtime-Installationen erlauben](#allow-runtime-installs).
- **Local runtime failed to start.** Siehe [Fehlerbehebung](#troubleshooting).
- **Download failed.** Das Fenster zeigt den Fehler. Prüf deine Internetverbindung und den freien Speicherplatz und klick dann erneut auf die Download-Schaltfläche.

Du erreichst dieses Fenster auch über **Add** (Hinzufügen) im Panel **Connections**, unter **Built-in model** im Fenster **Add account** (Konto hinzufügen).

### Kuratierte Presets

Das Fenster bietet zwei fertige Presets von Gemma 4 E2B an, einem kleinen Modell von Google. Rechner mit Apple Silicon bekommen statt GGUF-Dateien MLX-Versionen. GGUF und MLX sind zwei Dateiformate für lokale Modelle. Die Größen unten entsprechen der Anzeige im Fenster (in GB, wobei 1 GB 1024 × 1024 × 1024 Bytes sind).

| Preset | Download | RAM im Betrieb |
| --- | --- | --- |
| Q8 (Best Quality) | 5,0 GB | 5,4 GB |
| Q4_K_M (Smaller, Faster) | 3,0 GB | 3,4 GB |

Auf Apple Silicon erscheinen stattdessen zwei MLX-Presets:

| Preset | Download | RAM im Betrieb |
| --- | --- | --- |
| 8-bit MLX (Best Quality) | 5,5 GB | 7,0 GB |
| 4-bit MLX (Smaller, Faster) | 3,4 GB | 4,5 GB |

Marinara behält immer nur ein eingebautes Modell auf der Festplatte. Wählst du ein anderes Modell, ersetzt es das erste. Um später zu wechseln, öffne die Karte und klick im Fenster **Built-in model** auf **Change model** (Modell wechseln). Auf der Seite der Karte wechseln die Schaltflächen neben **Model** (Modell) zwischen den Presets und bitten dich vorher, die Download-Größe zu bestätigen.

### Ein eigenes Modell nutzen

Unter **Your own model** (eigenes Modell) kannst du ein GGUF-Modell von Hugging Face (einer öffentlichen Plattform zum Teilen von Modellen) oder eine Datei auf dem Rechner nutzen, auf dem Marinara läuft.

1. Klick auf **Your own model** und wähl dann einen Tab: **Hugging Face** oder **File on the server** (Datei auf dem Server).
2. Tipp auf **Hugging Face** den Namen des Repositorys im Format `owner/repo` ein und klick dann auf **Find files** (Dateien suchen). Wähl eine Datei aus der Liste.
3. Tipp auf **File on the server** den vollständigen Pfad zur `.gguf`-Datei ein. Marinara nutzt die Datei an ihrem Ort und kopiert sie nicht.
4. Klick unten auf die Schaltfläche: **Download** oder, bei einer Datei auf dem Server, **Use this file** (diese Datei verwenden).

Auf Apple Silicon heißt **Find files** stattdessen **Validate repo**, und das Repository muss MLX-nativ sein. Eine GGUF-Datei auf dem Server funktioniert dort trotzdem und nutzt llama.cpp statt MLX.

## Das eingebaute Modell für Hilfsaufgaben nutzen

Öffne die Karte **Built-in model**, nachdem das Modell heruntergeladen ist. Ihre Seite zeigt den Zustand, den Arbeitsspeicherverbrauch und **Used by** (genutzt von) und hat diese Bedienelemente:

| Bedienelement | Funktion |
| --- | --- |
| **Use for tracker agents (roleplay)** | Hält das Modell für Tracker-Agenten am Laufen. Standardmäßig aus. |
| **Use for game scene analysis** | Hält es für Szeneneffekte im Game Mode wie Hintergründe, Musik und Wetter am Laufen. Standardmäßig an. |
| **Use the built-in model for all tracker agents** | Richtet alle eingebauten Tracker-Agenten auf dieses Modell aus. Die Agenten selbst schaltet es nicht ein. |
| **Change in Defaults** | Öffnet den Bereich **Jobs**, in dem du dem Modell weitere Aufgaben geben kannst. |

Sind beide Schalter aus, startet das Modell nicht von selbst. Es startet, sobald du einen davon einschaltest oder ein Chat oder eine Aufgabe es nutzt. Wie du Agenten aktivierst, steht unter [Memory Recall und Chat-Zusammenfassungen](../agents/memory.md).

In der Game-Einrichtung kann **Scene effects model** (Modell für Szeneneffekte) das eingebaute Modell nutzen. Siehe [Game Mode: Erste Schritte](../game/getting-started.md).

### Lorebook-Embeddings

Embeddings sind Zahlen, mit denen ein Lorebook nach Bedeutung suchen kann. Um sie mit dem eingebauten Modell zu erzeugen, wähl **Built-in model (on this device)** als Vektorisierungsmodell des Lorebooks. Schalte vorher **Use for tracker agents (roleplay)** oder **Use for game scene analysis** ein, sonst schlägt die Anfrage fehl. Dieser Weg braucht die GGUF-Runtime und funktioniert daher nicht auf Apple Silicon mit MLX. Siehe [Semantische Suche für Lorebooks](../lorebooks/semantic-search.md).

### Decision-Modell

Du kannst das eingebaute Modell auch als Decision-Modell wählen. Siehe [Decision-Modelle](decision-models.md).

### Chat-Modell

So chattest du mit dem eingebauten Modell:

1. Öffne einen Chat und klick im Eingabebereich des Chats auf die Modell-Schaltfläche (das Link-Symbol).
2. Wähl in **Model for this chat** (Modell für diesen Chat) den Eintrag **Built-in model (on this device)**. Er steht ganz unten in der Liste und erscheint, sobald das Modell heruntergeladen ist.
3. Schick eine Nachricht. Eine Warnung weist darauf hin, dass das Modell klein ist und Antworten deshalb langsam, kurz oder von geringer Qualität sein können.

## Runtime-Einstellungen

Um sie zu öffnen, klick auf der Seite der Karte auf **Runtime settings** (Runtime-Einstellungen) oder im Fenster **Built-in model** auf **Settings** (Einstellungen). Sie sind in vier Gruppen aufgeteilt. Dropdown-Menüs und Schalter speichern sofort. Die Zahlenfelder speichern, wenn du auf **Apply settings** (Einstellungen übernehmen) klickst. **Physical batch size** und **Custom GPU layers** haben jeweils ein eigenes **Apply** (Übernehmen).

**Speed** (Geschwindigkeit)

| Einstellung | Standard | Funktion |
| --- | --- | --- |
| **Runtime target** | Auto detect | Für welche Grafikkartenfamilie Marinara installiert. |
| **GPU offload** | Auto offload | Wie viel Arbeit die Grafikkarte übernimmt. Zur Wahl stehen **Auto offload**, **CPU only** und **Custom GPU layers** (1 bis 1024). |

**Memory** (Arbeitsspeicher)

| Einstellung | Standard | Funktion |
| --- | --- | --- |
| **Context window** | 8192 | Wie viel Text das Modell auf einmal liest, in Tokens. 512 oder mehr. |
| **KV cache type** | f16 | Wie das Modell speichert, was es gelesen hat. Zur Wahl stehen f16, q8_0 und q4_0. Die letzten beiden brauchen weniger Arbeitsspeicher und setzen Unterstützung für Flash Attention voraus. |

**Replies** (Antworten)

| Einstellung | Standard | Funktion |
| --- | --- | --- |
| **Max response tokens** | 4096 | Die längste Antwort, die das Modell schreiben darf. 64 oder mehr. |
| **Temperature** | 0.3 | Wie zufällig die Antworten ausfallen. 0 bis 2. |
| **Top P** | 0.95 | Eine Grenze für die Wortwahl. Über 0, bis 1. |
| **Top K** | 64 | Eine Grenze für die Wortwahl. 0 bis 500. |

**Expert** (Experte)

| Einstellung | Standard | Funktion |
| --- | --- | --- |
| **Native tool calls** | On | Erlaubt dem Modell, Tools zu nutzen. Professor Mari und eigene Agenten brauchen die Option eingeschaltet. |
| **Max parallel agent jobs** | 2 | Wie viele Aufgaben gleichzeitig laufen. 1 bis 16. |
| **Pooling type** | None | Wie das Modell Text für die Lorebook-Suche in Zahlen umwandelt. Wähl **Mean** für Lorebook-Embeddings. |
| **Physical batch size** | 512 | Textmenge pro Batch für Lorebook-Embeddings. 128 bis 32768. Erhöhe den Wert, wenn lange Einträge scheitern. Gemma funktioniert oft mit 1024. |

Manche Einstellungen unterscheiden sich je nach System:

- **Runtime target** bietet unter Windows und Linux (x64) Auto detect, NVIDIA GPU, AMD GPU, Intel GPU, Vulkan GPU, CPU only und System llama-server. Andere Systeme bieten weniger Optionen.
- Auf Apple Silicon wählt MLX den Beschleuniger selbst. **Runtime target**, **GPU offload**, **KV cache type**, **Native tool calls**, **Pooling type** und **Physical batch size** erscheinen dort nicht.
- **Max response tokens** begrenzt die Szenenanalyse im Game Mode nicht; sie hat eine eigene Obergrenze.
- **Diagnostics** (Diagnose) in **Expert** zeigt den Runtime-Build, die erkannte Grafikkarte und den letzten Startbefehl.

<a id="allow-runtime-installs"></a>

### Runtime-Installationen erlauben

Das Installieren oder Neuinstallieren der Runtime ist eine geschützte Aktion. Bei Ein-Klick-Installationen unter Windows ist sie bereits erlaubt. Unter macOS, Linux und Docker erledigst du einen dieser Schritte und versuchst es dann erneut:

- Gib das Admin-Secret unter **Settings → Advanced → Admin Access** (Einstellungen → Erweitert → Admin-Zugriff) ein. Das Admin-Secret ist ein zweites Passwort für riskante Aktionen. Du erstellst es unter **Admin Access** auf dem Server-Rechner selbst oder legst es in der `.env`-Datei des Servers als `ADMIN_SECRET` fest. Siehe [Admin Access](../REMOTE_ACCESS.md#admin-access-and-privileged-actions).
- Ergänze `SIDECAR_RUNTIME_INSTALL_ENABLED=true` in der `.env`-Datei des Servers und starte Marinara dann neu. Die `.env`-Datei ist eine Textdatei im Marinara-Ordner. Siehe [Die Datei .env bearbeiten](../CONFIGURATION.md#edit-the-env-file).

Marinara lädt nur die llama.cpp-, MLX- und uv-Versionen herunter, die für deine Version freigegeben sind, und prüft Größe und SHA-256-Prüfsumme jeder Datei, bevor es etwas ausführt.

## Lokales Sprachmodell

Das **Local speech model** (lokales Sprachmodell) wandelt für Conversation-Anrufe deine Stimme auf deinem eigenen Rechner in Text um. Es ist ein Whisper-Modell, also ein Speech-to-Text-Modell. Es braucht das Agentenpaket **Calls**, das du unter **Agents → Agent Organizer** installierst.

1. Öffne das Panel **Connections** und klick unter **On this device** (auf diesem Gerät) auf den Eintrag **Speech to text** (Spracherkennung).
2. Wähl unter **Local speech model** ein Modell im Dropdown-Menü.
3. Klick auf **Download Whisper**.
4. Warte auf **Ready**. Starte Marinara vollständig neu, bevor du Calls nutzt.

| Modell | Download | RAM im Betrieb |
| --- | --- | --- |
| Whisper Tiny (Multilingual) | rund 180 MB | rund 350 MB |
| Whisper Base (Multilingual) | rund 320 MB | rund 650 MB |

Tiny ist die beste erste Wahl für Handys und ältere Rechner. Base ist bei undeutlicher Sprache genauer, startet aber langsamer. Um das heruntergeladene Modell zu entfernen, klick auf **Delete Local Whisper** (die Papierkorb-Schaltfläche). Deinstallierst du Calls, wird es ebenfalls entfernt.

Dein Audio bleibt auf deinem Rechner. Nur der Text geht an dein Chat-Modell. Um es in einem Anruf zu nutzen, stell die Audioeingabe des Anrufs auf Local Whisper. Siehe [Audio- und Videoanrufe in Conversation](../conversation/calls.md). Schaltest du stattdessen den Server unter **Speech to text** ein, schicken Anrufe deine Sprache dorthin. Siehe [Einen eigenen Speech-to-Text-Server nutzen](../conversation/calls.md#use-your-own-speech-to-text-server).

<a id="troubleshooting"></a>

## Fehlerbehebung

| Symptom | Lösung |
| --- | --- |
| **Sidecar runtime install is disabled** (eine Fehlermeldung). | Siehe [Runtime-Installationen erlauben](#allow-runtime-installs). |
| **Local runtime failed to start.** Das Fenster zeigt den Fehler und einen Pfad zur Log-Datei. Die Karte zeigt **Local runtime unavailable**. | Klick auf **Retry startup** (Start wiederholen). Klappt das nicht, klick auf **Reinstall runtime** (Runtime neu installieren) oder wähl ein anderes **Runtime target**. **Continue without local AI** (ohne lokale KI weitermachen) schaltet die Hilfs-Schalter aus, und Marinara funktioniert ohne das Modell weiter. |
| Der Runtime-Download meldet eine abweichende Größe oder SHA-256-Prüfsumme. | Marinara hat die Datei verworfen. Aktualisiere Marinara und versuch es erneut. Scheitert es weiterhin, öffne die Datei nicht selbst. Melde das Runtime Target und den Fehler. |
| Die Lorebook-Suche meldet, das lokale Modell sei nicht aktiviert. | Schalte **Use for tracker agents (roleplay)** oder **Use for game scene analysis** ein und vektorisiere dann erneut. |
| Ein Banner im Game Mode meldet **Local scene helper failed to start**. | Klick im Banner auf **Open Local AI Model**, um es erneut zu versuchen, das Modell zu wechseln oder die lokale Szenenanalyse abzuschalten. |

Weitere Hilfe findest du unter [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md).

## Verwandte Anleitungen

- [Verbindung zu einem KI-Anbieter herstellen](connecting-to-a-provider.md)
- [Decision-Modelle](decision-models.md)
- [Ein lokales oder selbst gehostetes Modell verbinden](local-self-hosted.md)
- [Memory Recall und Chat-Zusammenfassungen](../agents/memory.md)
- [Audio- und Videoanrufe in Conversation](../conversation/calls.md)
- [Game Mode: Erste Schritte](../game/getting-started.md)
- [Semantische Suche für Lorebooks](../lorebooks/semantic-search.md)
