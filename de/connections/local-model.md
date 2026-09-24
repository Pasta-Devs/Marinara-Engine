# Local Model einrichten

In dieser Anleitung erfährst du, wie das eingebaute **Local Model** (lokales Modell) funktioniert – ein kleines KI-Modell, das Marinara Engine herunterlädt und direkt auf dem eigenen Rechner ausführt. Es braucht weder einen API-Key noch ein Online-Konto. Beschrieben werden die Einrichtung, die **Runtime Settings** (Laufzeit-Einstellungen) und die Hilfsaufgaben, die das Local Model übernimmt: Tracker-Agenten, Szeneneffekte im Game Mode und die Transkription von Anrufen ohne Internet.

## Was das Local Model ist

Das **Local Model** ist ein kompaktes Sprachmodell (Gemma), das komplett auf dem eigenen Rechner läuft. Ein API-Key ist ein geheimer Zugangscode, ähnlich einem Passwort, mit dem Marinara einen Online-KI-Dienst anspricht. Das Local Model braucht keinen API-Key, denn nichts verlässt den eigenen Rechner.

Das Local Model ist bewusst klein gehalten. Gedacht ist es für Hilfsaufgaben im Hintergrund, nicht für den Haupt-Chat oder das Roleplay. Marinara setzt es für diese Aufgaben ein:

- Tracker-Agenten im Roleplay Mode.
- Szeneneffekte im Game Mode, etwa Hintergründe, Musik und Wetter.
- Lorebook-Embeddings für die semantische Suche.
- Mikrofon-Transkription in Conversation-Anrufen, über ein separates Sprachmodell.

Im Einrichtungsfenster heißt es **Local AI Model**. In den Verbindungs-Dropdowns heißt es **Local Model (sidecar)**. Gemeint ist beide Male dasselbe.

Für Haupt-Chat, Roleplay, die Erzählung des Game Master oder Bearbeitungen durch Professor Mari eignet sich das Local Model nicht. Dafür ist es schlicht zu klein. Nimm hier eine stärkere Verbindung. Siehe [Verbindung zu einem KI-Anbieter herstellen](connecting-to-a-provider.md).

## Die Local-Model-Karte öffnen

Das Local Model findest du im Panel **Connections** (Verbindungen).

1. Öffne das Panel **Connections**.
2. Suche die Karte mit dem Titel **Local Model**.
3. Klick auf die Karte oder auf ihre Zahnrad-Schaltfläche **Open local model settings** (lokale Modell-Einstellungen öffnen).

Die Zahnrad-Schaltfläche öffnet das vollständige Einrichtungsfenster **Local AI Model**. Ist noch kein Modell heruntergeladen, zeigt die Karte zusätzlich die Schaltflächen **Download now** (jetzt herunterladen) und **Choose model options** (Modell-Optionen wählen). Beide führen zum selben Einrichtungsfenster.

Im Einrichtungsfenster erscheint ein Warnhinweis mit dem Titel **Local Model is for helpers, not main roleplay**. Er wiederholt, dass das Modell nur für Hilfsaufgaben gedacht ist.

## Unterstützte Hardware und Betriebssysteme

Das Local Model lädt eine Runtime (das Programm, das das Modell ausführt) und eine Modelldatei herunter. Für beides braucht der Rechner genug freien Speicherplatz und Arbeitsspeicher (RAM).

Was unterstützt wird, hängt vom Betriebssystem ab:

- **Windows (64 Bit) und Linux (64 Bit)**: Hier steht die vollständige Auswahl **Runtime Target** bereit. Du wählst also die Familie deiner Grafikkarte (GPU) oder lässt alles auf dem Prozessor (CPU) laufen.
- **Windows on ARM und Linux on ARM**: Weniger Optionen, überwiegend auf CPU-Basis.
- **macOS auf Apple Silicon**: Marinara nutzt die MLX-Runtime, abgestimmt auf Apple-Chips. Eigene Modelle sind hier HuggingFace-Repositories statt einzelner Dateien.
- **macOS auf Intel und Android**: Praktisch nur CPU.

In „Lite“-Installationen gibt es das Local Model nicht. Eine Lite-Installation ist eine abgespeckte Version, die die lokale Runtime weglässt und so Platz spart. Dort erscheint die Local-Model-Karte gar nicht erst.

## Ersteinrichtung

Richte zuerst die Runtime ein und wähle danach ein Modell.

1. Öffne das Einrichtungsfenster **Local AI Model**.
2. Klick auf **Install Runtime** (Runtime installieren). Auf Apple Silicon heißt die Schaltfläche **Install MLX Runtime**.
3. Warte, bis die Runtime fertig installiert ist. Ein Fortschrittsbalken zeigt den Download an.
4. Wähle ein Modell – wie das geht, steht unten im Abschnitt „Ein Modell herunterladen“.
5. Warte, bis der Modell-Download abgeschlossen ist.
6. Sobald der Status **Ready** anzeigt, klick auf **Done** (fertig).

Wenn du noch nicht abschließen willst, klick auf **Skip for Now** (vorerst überspringen). Sobald ein Modell vorhanden ist, heißt diese Schaltfläche stattdessen **Close** (schließen).

Das Installieren oder Neuinstallieren der Runtime ist eine geschützte Aktion. Bei Ein-Klick-Installationen unter Windows ist sie automatisch freigeschaltet. Unter macOS, Linux und Docker musst du sie eventuell erst erlauben. Siehe den Abschnitt „Fehlerbehebung“ weiter unten.

Marinara lädt ausschließlich die llama.cpp-, MLX- und uv-Versionen herunter, die für deine Engine-Version freigegeben sind. Vor dem Entpacken oder Ausführen prüft Marinara die exakte Dateigröße und die SHA-256-Prüfsumme. Auch die Python-Abhängigkeiten für MLX sind auf feste Versionen und Hashes festgelegt; erst danach installiert Marinara die geprüfte mlx-lm-Quelle, ohne zusätzliche Pakete aufzulösen. Neue Runtime-Versionen kommen deshalb über geprüfte Marinara-Updates und nicht still über einen „latest“-Build von upstream.

## Ein Modell herunterladen

- Aktivierungsfragen und Decision-Bedingungen beantworten, wenn du es als Decision-Modell auswählst. Siehe [Decision-Modelle](decision-models.md).

Das Einrichtungsfenster bietet zwei Wege zu einem Modell.

### Kuratierte Presets

Unter **Curated Gemma 4 Presets** (kuratierte Presets) wählst du eine von zwei fertigen Varianten. Ein Preset ist eine gespeicherte Vorlage. Auf Nicht-Apple-Hardware nutzen beide das GGUF-Format:

| Preset | Download-Größe | RAM im Betrieb |
| --- | --- | --- |
| Q8 (Best Quality) | rund 5,4 GB | rund 5,8 GB |
| Q4_K_M (Smaller, Faster) | rund 3,2 GB | rund 3,6 GB |

Die Variante Q8 trägt die Kennzeichnung **Recommended** (empfohlen) und liefert die beste Qualität. Q4_K_M ist kleiner, schneller und braucht weniger Arbeitsspeicher.

Auf Apple Silicon werden daraus MLX-Presets. Das 8-Bit-MLX-Preset braucht rund 5,9 GB Download und rund 7,5 GB RAM. Das 4-Bit-MLX-Preset braucht rund 3,6 GB Download und rund 4,8 GB RAM.

So lädst du ein Preset herunter:

1. Wähle das gewünschte Preset aus.
2. Klick auf **Use Curated Preset** (kuratiertes Preset verwenden). Ist bereits ein Modell vorhanden, heißt die Schaltfläche **Switch to Curated Preset**.

### Eigenes Modell mitbringen

Unter **Use Your Own Model From HuggingFace** (eigenes Modell von HuggingFace nutzen) bindest du ein eigenes Modell von HuggingFace ein, einer öffentlichen Plattform zum Teilen von Modellen.

1. Tipp den Namen des Repositorys in das Feld. Das Format lautet `owner/repo`.
2. Klick auf **List Models** (Modelle auflisten). Auf Apple Silicon heißt die Schaltfläche **Validate Repo**.
3. Auf Nicht-Apple-Hardware wählst du im Dropdown-Menü eine bestimmte Datei aus und klickst dann auf **Download Selected GGUF**.
4. Auf Apple Silicon klickst du nach erfolgreicher Prüfung des Repositorys auf **Use Validated MLX Repo**.

Marinara behält immer nur eine einzige Local-Model-Datei auf der Festplatte. Ein neuer Download löscht also zuerst das alte Modell. Eine eigene Schaltfläche zum Löschen des Local Model gibt es nicht. Zum Entfernen lädst du einfach ein anderes Modell darüber.

## Referenz der Runtime Settings

Öffne im Einrichtungsfenster den Abschnitt **Runtime Settings**, um das Verhalten des Modells anzupassen. Die Felder werden unterschiedlich gespeichert:

- Die Dropdown-Menüs und der Schalter **Native Tool Calls** greifen sofort bei der Änderung.
- **Context Window**, **Max Response Tokens**, **Temperature**, **Top P** und **Top K** wirken erst nach einem Klick auf **Apply Settings** (Einstellungen übernehmen).
- **Physical Batch Size** hat eine eigene Schaltfläche **Apply**. Dasselbe gilt für das Feld mit der Schichtanzahl, das erscheint, sobald **GPU Offload** auf **Custom GPU layers** steht.

| Einstellung | Standard | Steuert |
| --- | --- | --- |
| Runtime Target | Auto detect | Für welche GPU-Familie Marinara installiert |
| GPU Offload | Auto offload | Wie viel Arbeit die GPU übernimmt |
| Native Tool Calls | On | Erlaubt dem Modell Werkzeuge und Funktionsaufrufe |
| Pooling Type | None | Embedding-Berechnung für die Lorebook-Suche |
| Physical Batch Size | 512 | Batch-Größe für Lorebook-Embedding-Anfragen |
| Context Window | 8192 | Wie viel Text das Modell auf einmal lesen kann |
| Max Response Tokens | 4096 | Maximale Länge einer Antwort |
| Temperature | 0.3 | Wie zufällig die Antworten ausfallen |
| Top P | 0.95 | Eine Sampling-Grenze für die Wortwahl |
| Top K | 64 | Eine Sampling-Grenze für die Wortwahl |

Hinweise zu den kniffligeren Feldern:

- **Runtime Target** und **GPU Offload** erscheinen nur bei der GGUF-Runtime. Auf Apple Silicon wählt MLX den Beschleuniger selbst aus.
- **Pooling Type** und **Physical Batch Size** erscheinen ebenfalls nur bei der GGUF-Runtime, unter der Überschrift **Embedding Endpoint**. Sie betreffen ausschließlich Lorebook-Embeddings und ändern nichts an normalen Chat-Antworten.
- **Pooling Type** steht standardmäßig auf **None**. Stell es auf **Mean**, sobald du das Local Model für Lorebook-Embeddings nutzt.
- **Physical Batch Size** legt fest, wie viel Text der Embedding-Endpunkt in einem Durchgang verarbeitet. Erhöhe den Wert, wenn sich lange Lorebook-Einträge nicht vektorisieren lassen. Für Gemma schlägt die App 1024 vor.
- **Native Tool Calls** muss aktiv sein, damit Werkzeuge funktionieren. Der Warnhinweis erklärt, dass Professor Mari und eigene Agenten diese Option brauchen, bevor das lokale Modell Werkzeuge nutzen kann. Auf der MLX-Runtime steht die Option nicht zur Verfügung.
- **Max Response Tokens** begrenzt normale Chat- und Agent-Antworten. Die Szenenanalyse im Game Mode bleibt davon unberührt – sie hat ihre eigene interne Obergrenze.

## Send Test Message

Mit **Send Test Message** (Testnachricht senden) prüfst du, ob die Runtime funktioniert. Die Schaltfläche sitzt im Runtime-Abschnitt und bleibt inaktiv, bis ein Modell heruntergeladen und die Runtime installiert ist.

1. Klick auf **Send Test Message**.
2. Warte auf das Ergebnisfeld.
3. Bei Erfolg erscheint **Local Test Message Succeeded** samt Antwortzeit.
4. Bei einem Fehler erscheint **Local Test Message Failed** samt Fehlermeldung.

Der Test verwendet einen festen Prompt – also den Text, den Marinara an die KI schickt. Deine Einstellungen für Temperature und Tokens ignoriert er. So prüfst du sauber, ob das Modell überhaupt antwortet.

## Das Local Model für Hilfsaufgaben nutzen

Sobald ein Modell heruntergeladen ist, zeigt die Local-Model-Karte zwei Schalter:

- **Use for tracker agents (roleplay)** (für Tracker-Agenten im Roleplay nutzen). Standardmäßig aus.
- **Use for game scene analysis** (für die Szenenanalyse im Game Mode nutzen). Standardmäßig an.

Diese beiden Schalter entscheiden, ob Marinara das Local Model im Hintergrund laufen lässt. Sind beide aus, startet die Runtime nicht von selbst. Sobald einer von beiden an ist, startet Marinara den lokalen Server automatisch. Der erste Start danach kann einen Moment dauern.

Auf der Karte sitzt außerdem die Schaltfläche **Use local model for all tracker agents** (lokales Modell für alle Tracker-Agenten nutzen). Ein Klick richtet sämtliche eingebauten Tracker-Agenten auf das Local Model aus. Eine Zeile darunter zeigt, wie viele Tracker-Agenten auf das lokale Modell zeigen, zum Beispiel „3/7 built-in tracker agents currently point at the local model.“ Das ändert nur das verwendete Modell. Die Agenten selbst schaltet es nicht ein. Wie du Agenten aktivierst, steht unter [Gedächtnis-Abruf und Chat-Zusammenfassungen](../agents/memory.md) sowie in der Anleitung zum jeweiligen Modus.

Auch im Game Mode lässt sich die Szenenarbeit über das Local Model abwickeln. In der Game-Einrichtung bietet das Dropdown-Menü **Scene Effects Connection** den Eintrag **Local Model (Gemma)**. Wählst du ihn, schaltet sich **Use for game scene analysis** automatisch ein. Siehe [Game Mode: Erste Schritte](../game/getting-started.md).

### Local Model für Lorebook-Embeddings

Das Local Model kann auch die semantische Suche in Lorebooks antreiben – also in den Sammlungen von Weltwissen. Wähle dazu in den Vektorisierungs-Optionen eines Lorebooks **Local Model (sidecar)** als Verbindung. Voraussetzung ist, dass vorher **Use for tracker agents (roleplay)** oder **Use for game scene analysis** aktiv ist. Sind beide aus, schlägt die Anfrage mit dem Hinweis fehl, dass das lokale Modell für Tracker oder die Szenenanalyse aktiviert sein muss. Dieser Weg läuft über die GGUF-Runtime und steht auf Apple Silicon mit MLX nicht zur Verfügung. Siehe [Semantische Suche für Lorebooks](../lorebooks/semantic-search.md).

## Das Local Model als Chat-Verbindung nutzen

Sobald ein Modell heruntergeladen ist, taucht das Local Model unten in den meisten Verbindungs-Auswahllisten auf. Es erscheint als **Local Model (sidecar)** oder als **Local Model** mit dem Modellnamen in Klammern, sofern der Name bekannt ist.

Wählst du es für einen normalen Chat, erscheint eine Warnung. Sie weist darauf hin, dass das Local Model winzig und für Hilfsaufgaben gedacht ist. Außerdem warnt sie, dass Antworten im Haupt-Chat und im Roleplay langsam, kurz oder von geringer Qualität sein können. Dieser Eintrag ist keine echte gespeicherte Verbindung – Verbindungs-Standards lassen sich dafür also nicht sichern.

Wählst du es für einen Chat aus, startet der lokale Server bei Bedarf, selbst wenn beide Hilfs-Schalter aus sind. Im Hauptmodell-Dropdown des Game Mode taucht es nicht auf. Der Game Mode nutzt das Local Model ausschließlich über **Scene Effects Connection**.

## Local Speech Model für Anrufe

Das **Local Speech Model** (lokales Sprachmodell) ist ein optionaler Download für Calls und transkribiert das Mikrofon ohne Internet. Es kommt in Conversation-Anrufen zum Einsatz, wenn du deine Stimme auf dem eigenen Rechner transkribieren lassen willst. Es handelt sich um ein Whisper-Modell – ein Speech-to-Text-Modell, das gesprochene Worte in Text verwandelt.

Installiere zuerst **Calls** über **Agents > Download Agents**. Danach verwaltest du Whisper auf der Karte **Local Model** in den Connections, unter der Überschrift **Local Speech Model**. Ohne installiertes Calls bleiben die Überschrift und die Download-Bedienelemente ausgeblendet.

Zur Auswahl stehen zwei Varianten:

- **Whisper Tiny (Multilingual)**: rund 180 MB Download, rund 350 MB RAM. Die beste erste Wahl für Handys und ältere Rechner.
- **Whisper Base (Multilingual)**: rund 320 MB Download, rund 650 MB RAM. Genauer bei undeutlicher Sprache, startet dafür langsamer.

So richtest du es ein:

1. Öffne die Karte **Local Model** und klapp sie auf.
2. Wähle unter **Local Speech Model** ein Modell im Dropdown-Menü.
3. Klick auf **Download Whisper**.
4. Sobald **Ready** dasteht, ist alles eingerichtet.

Um nur das ausgewählte Modell zu entfernen, klick auf die Papierkorb-Schaltfläche **Delete Local Whisper**. Deinstallierst du Calls, verschwinden automatisch alle heruntergeladenen Whisper-Varianten samt gespeicherter Auswahl und geben ihren Speicherplatz frei. Installierst du Calls später erneut, kehren die Bedienelemente für das Local Speech Model zurück und du kannst Whisper wieder herunterladen.

Die Audioaufnahme verlässt den eigenen Rechner nie. An die gewählte Chat-Verbindung geht nur der transkribierte Text. Für den Einsatz im Anruf stellst du die Audioeingabe des Anrufs auf die Option „Local Whisper“ um. Siehe [Audio- und Videoanrufe in Conversation](../conversation/calls.md).

## Fehlerbehebung

**„Sidecar runtime install is disabled.“** Das Installieren oder Neuinstallieren der Runtime ist eine geschützte Aktion. Bei Ein-Klick-Installationen unter Windows ist sie bereits freigeschaltet. Unter macOS, Linux und Docker hast du zwei Möglichkeiten. Setze `SIDECAR_RUNTIME_INSTALL_ENABLED=true` in der Datei `.env` des Servers, zum Beispiel so:

```
SIDECAR_RUNTIME_INSTALL_ENABLED=true
```

Oder gib einmalig dein Admin-Access-Geheimnis unter **Settings -> Advanced -> Admin Access** ein und versuch es erneut. Siehe [Referenz der Server-Konfiguration](../CONFIGURATION.md).

**Die Runtime startet nicht.** Das Einrichtungsfenster zeigt ein Feld mit dem Titel **Local runtime failed to start**, dazu den Fehler und einen Pfad zur Log-Datei. Klick auf **Retry Startup** (Start wiederholen). Bleibt es dabei, klick auf **Reinstall Runtime** oder probier ein anderes **Runtime Target**. Mit **Continue Without Local AI** nutzt du Marinara ohne das Local Model weiter. Auf der Connections-Karte erscheint dasselbe Problem als **Local runtime unavailable**.

**Der Runtime-Download meldet eine abweichende Größe oder SHA-256-Prüfsumme.** Marinara hat den Download vor dem Entpacken verworfen. Aktualisiere zuerst Marinara und versuch es dann erneut, damit das freigegebene Runtime-Manifest und der Download zusammenpassen. Scheitert dieselbe Version weiterhin, entpack oder starte das Archiv nicht von Hand. Melde stattdessen das **Runtime Target** und den Fehler an die Maintainer.

**Die Lorebook-Suche meldet, das lokale Modell sei nicht aktiviert.** Schalte auf der Local-Model-Karte **Use for tracker agents (roleplay)** oder **Use for game scene analysis** ein und starte die Vektorisierung erneut.

**Ein Banner im Game Mode meldet „Local scene helper failed to start.“** Klick im Banner auf **Open Local AI Model**, um es erneut zu versuchen, das Modell zu wechseln oder die lokale Szenenanalyse abzuschalten.

Weitere Hilfe findest du unter [Fehlerbehebung für Marinara Engine](../TROUBLESHOOTING.md).

## Verwandte Anleitungen

- [Decision-Modelle](decision-models.md)

- [Verbindung zu einem KI-Anbieter herstellen](connecting-to-a-provider.md)
- [Ein lokales oder selbst gehostetes Modell verbinden](local-self-hosted.md)
- [Gedächtnis-Abruf und Chat-Zusammenfassungen](../agents/memory.md)
- [Audio- und Videoanrufe in Conversation](../conversation/calls.md)
- [Game Mode: Erste Schritte](../game/getting-started.md)
- [Semantische Suche für Lorebooks](../lorebooks/semantic-search.md)
