# Memory Recall und Chat-Zusammenfassungen

Diese Anleitung erklärt **Memory Recall** (Suche in früheren Nachrichten), das optionale **Advanced Memory Recall (Alpha)** (erweiterter Erinnerungsabruf) für die automatische Kontextverwaltung in Roleplay, **Chat Summary** und **Automatic Summarization** in Conversation.

## Die zwei Gedächtnissysteme

Jedes KI-Modell kann immer nur eine begrenzte Textmenge auf einmal lesen. Diese Grenze heißt Kontextfenster. Wird ein Chat lang, fallen die ältesten Nachrichten aus dem Fenster heraus und die KI vergisst sie. Marinara Engine (im Folgenden nur Marinara) hat dafür zwei getrennte Systeme.

- **Memory Recall** durchsucht die älteren Nachrichten nach den Stellen, die am besten zu deiner letzten Eingabe passen, und schiebt sie unauffällig zurück in den Prompt – also in den Text, den Marinara an die KI schickt. Das funktioniert in jedem Chat-Modus.
- Zusammenfassungen pressen alte Nachrichten zu kurzen Rückblicken zusammen, die im Prompt an die Stelle der Originalnachrichten treten. In Roleplay-Chats übernimmt das **Chat Summary**, in Conversation-Chats **Automatic Summarization**.

Game-Mode-Chats bekommen ausschließlich **Memory Recall**. Beide Zusammenfassungs-Funktionen fehlen dort.

Beide Systeme lassen sich gleichzeitig nutzen. Sie erledigen unterschiedliche Aufgaben und kommen sich nicht in die Quere.

## Memory Recall einrichten

**Memory Recall** sucht passende Bruchstücke aus dem bisherigen Chat und fügt sie als Erinnerungen in den Prompt ein. Grundlage ist ein Embedding: ein numerischer Fingerabdruck der Bedeutung einer Nachricht. Marinara vergleicht den Fingerabdruck deiner neuen Nachricht mit den gespeicherten Fingerabdrücken früherer Nachrichten und ergänzt die ähnlichsten Treffer.

### Memory Recall aktivieren

1. Öffne einen Chat und klick auf die Schaltfläche **Chat Settings** (Chat-Einstellungen) in der Kopfzeile des Chats.
2. Such den Abschnitt **Memory Recall** (Symbol: ein Gehirn).
3. Aktiviere den Schalter **Enable Memory Recall**.

**Enable Memory Recall** gilt pro Chat. Der Standard hängt vom Modus ab:

- In Conversation-Chats standardmäßig an.
- In Roleplay- oder Game-Chats mit aktiver Szene standardmäßig an.
- In allen übrigen Chats standardmäßig aus.

Schaltest du den Schalter aus, landen keine abgerufenen Erinnerungen mehr im Prompt. Bereits Gespeichertes bleibt aber erhalten.

### Die Embedding-Quelle

Für die Bedeutungs-Fingerabdrücke braucht **Memory Recall** eine Embedding-Quelle. Die legst du an einer Verbindung fest, nicht in den Chat-Einstellungen. Eine Verbindung ist eine gespeicherte Anbindung an einen KI-Anbieter.

1. Öffne das Panel **Connections** (Verbindungen) und bearbeite eine Verbindung.
2. Such den Abschnitt **Semantic Search (Embeddings)**.
3. Trag im Modellfeld den Namen eines Embedding-Modells ein, zum Beispiel `text-embedding-3-small`.
4. Optional legst du unter **Embedding Endpoint URL** eine abweichende Adresse fest.
5. Optional borgst du dir über das Dropdown-Menü **Embedding Connection** Key und Adresse einer anderen Verbindung. Zur Auswahl stehen unter anderem **Same as this connection** und **Local Model (sidecar)**.

Manche Anbieter bieten gar keine Embeddings an. Dann weist Marinara mit einem Hinweis darauf hin, dass du eine eigene Embedding-Verbindung wählen sollst – etwa eine OpenAI-kompatible, Google oder das Local Model.

Trägst du überhaupt keine Embedding-Verbindung ein, greift Marinara auf ein eingebautes lokales Embedding-Modell zurück. Es lädt dieses Modell einmalig herunter und führt es auf dem eigenen Rechner aus, ganz ohne API-Key. Mehr zum eingebauten Modell steht unter [Local Model einrichten](../connections/local-model.md).

Dieselbe Einstellung **Semantic Search (Embeddings)** treibt auch die semantische Suche in Lorebooks an. Einmal eingerichtet, profitieren also beide Funktionen davon.

### Memories for This Chat

Um die Erinnerungen eines Chats anzusehen, öffne **Chat Settings**, gehe zum Bereich **Memory Recall** und klicke auf **Access memories for this chat**. Bei aktiviertem Advanced Memory bleibt die Ansicht in der Roleplay-Seitenleiste; andernfalls öffnet sich das Fenster **Memories for This Chat**.

Das Fenster nennt die Anzahl gespeicherter Chunks – also abgelegter Textabschnitte – und eine grobe Schätzung in Tokens, den kleinen Textstücken, in denen KI-Modelle rechnen. Jede Chunk-Karte zeigt den abgedeckten Zeitraum, die Anzahl der Nachrichten, einen Status und den Zeitpunkt der Erstellung. Als Status erscheint eines von drei Kürzeln:

- **Vectorized**: Der Fingerabdruck steht und ist durchsuchbar.
- **Waiting for vector**: Der Fingerabdruck entsteht gerade noch.
- **Embedding unavailable**: Keine Embedding-Quelle konnte ihn erzeugen.

Über die Symbolleiste exportierst und importierst du Erinnerungen, baust sie neu auf oder löschst alle auf einmal. Zusätzlich hat jeder Chunk ein eigenes Papierkorb-Symbol, um nur ihn zu vergessen.

- Das Papierkorb-Symbol eines Chunks öffnet das Dialogfenster **Forget Memory**. Bestätige mit **Forget**.
- Das Papierkorb-Symbol für alle öffnet das Dialogfenster **Clear Memories**. Bestätige mit **Clear**. Das entfernt die Erinnerungen, nicht aber die Nachrichten im Chat.
- Das Aktualisieren-Symbol baut sämtliche Chunks aus den aktuellen Chat-Nachrichten neu auf. Nutze es, nachdem du das Embedding-Modell gewechselt hast.
- Der Export legt eine `.marinara.json`-Datei an. Der Import akzeptiert `.json`- oder `.marinara`-Dateien und führt sie mit den vorhandenen Erinnerungen zusammen.

### Wie sich Memory Recall verhält

Behalte diese Punkte im Hinterkopf:

- Sobald eine Embedding-Quelle bereitsteht, legt Marinara im Hintergrund Chunks an – auch bei ausgeschaltetem **Enable Memory Recall**. Der Schalter steuert nur, ob gespeicherte Erinnerungen eingefügt werden. Willst du das Speichern ganz unterbinden, entferne die Embedding-Quelle oder leere die Erinnerungen von Zeit zu Zeit.
- Ein Chunk entsteht erst ab 5 neuen Nachrichten. Kleinere Häppchen warten auf die nächste Antwort.
- Abgerufene Bruchstücke müssen eine Ähnlichkeitsprüfung bestehen. Schwache Treffer fallen weg – der Abruf kann also leer ausgehen, obwohl Erinnerungen vorhanden sind.
- Für abgerufene Erinnerungen steht nur ein kleines Budget im Prompt bereit. Es landen also immer nur die relevantesten paar darin.
- Wechselst du das Embedding-Modell, nachdem bereits Erinnerungen existieren, passen die alten Chunks nicht mehr. Bau sie über das Aktualisieren-Symbol neu auf.
- Löschst du die Nachrichten eines Chats, verschwinden auch dessen Chunks.

Einige Container-Builds von Marinara, bekannt als Marinara Lite, deaktivieren **Memory Recall** vollständig. Dort taucht der Abschnitt **Memory Recall** überhaupt nicht auf.

## Advanced Memory Recall (Alpha, Roleplay)

Öffne **Chat Settings → Memory Recall** und aktiviere **Advanced Memory Recall (Alpha)**. Dieser optionale Modus verwaltet das aktuelle Verlaufsfenster, Kontinuitätszusammenfassungen und relevante ältere Auszüge gemeinsam. Einstellungen, Einrichtungsfortschritt und Archivansicht bleiben auf Desktop und Mobilgeräten in der Chat-Settings-Seitenleiste.

### Einrichtung

- Wähle einen **maximum context** (maximalen Kontext), den dein Chatmodell unterstützt. Die Grenze umfasst geschätzte Prompt-Tokens, Werkzeuge, Anhänge, Antwortplatz und Sicherheitsreserve. Sie ist eine Schätzung, kein exakter Tokenizer oder Abrechnungslimit.
- Wähle innerhalb dieser Grenze das **constant-summary budget** (Budget der dauerhaften Zusammenfassung). Eine kurze Kontinuitätsübersicht wird einmal pro Anfrage eingefügt. Jüngste Nachrichten bleiben ungekürzt, solange die gesamte Anfrage hineinpasst.
- Die **helper connection** (Hilfsverbindung) trifft kleine Szenenentscheidungen. Standardmäßig nutzt sie die Agentenverbindung, ersatzweise die Chatverbindung. Die erste Verarbeitung des Verlaufs kann das Haupt- oder Hilfsmodell verwenden; die tatsächlich gewählten Modelle werden vor der Vorbereitung angezeigt.
- Szenenzusammenfassungen und Verdichtung verwenden dein vorhandenes **Summaries**-Modell (Zusammenfassungen) und dessen Prompts. Advanced Memory läuft unabhängig vom Hauptschalter Agents und benötigt keinen herunterladbaren Agenten.
- Der bevorzugte Bereich benachbarter Nachrichten beträgt standardmäßig **3–10**. Relevanz, Charakterzugriff und verfügbarer Platz können zu weniger Nachrichten führen, auch zu keiner.

Bestätige bei einem älteren Individual-Gruppenchat fehlende Wissensbereiche einmal. Die erste gesprochene Zeile eines Charakters belegt nicht, dass er alles davor kannte. Wähle einen tatsächlichen Charakter nur dann als **Narrator** (Erzähler), wenn er Teilnahmegrenzen umgehen soll. Ausdrücklich ausgeblendete Nachrichten und manuelle Startmarkierungen schränken die Erinnerung weiterhin ein. Du kannst diese Bereiche später korrigieren; neu hinzugefügte Charaktere benötigen eine eigene Bestätigung.

Die Vorbereitung verarbeitet ältere Nachrichten stapelweise und zeigt den aktuellen Schritt neben Professor Maris Hamsterrad. **Cancel** (Abbrechen) behält abgeschlossene Arbeit; **Resume** (Fortsetzen) macht nach dem Schließen der Seitenleiste oder einem Serverneustart weiter. Ein fehlgeschlagener Modellaufruf bewahrt bisher gültige Erinnerungen und zeigt einen Fehler zum erneuten Versuch.

### Während des Chats

Erreicht die vollständige Anfrage die Grenze, entfernt Advanced Memory zuerst optionale Abrufe und übernimmt dann ältere abgeschlossene Szenen in die Kontinuität. Ist eine einzelne offene Szene zu groß, fasst es vorübergehend deren älteren Teil zusammen, ohne die Szene zu schließen. Originalnachrichten sowie manuelle Start- und Sichtbarkeitseinstellungen bleiben erhalten.

Das Archiv kann relevante Szenenzusammenfassungen und wortgetreue Dialoge mit ursprünglichen Nachrichtennummern und Sprechern abrufen. Persona- und Charakternachrichten zählen gleichermaßen. Die Neugenerierung einer früheren Antwort verwendet nur Quellen vor dem Ziel, auch wenn dieses vor dem aktuell verwalteten Fenster liegt. Bearbeiten, Variantenwechsel, Ausblenden oder Löschen von Quellnachrichten löst vor der Nutzung eine erneute Prüfung der betroffenen abgeleiteten Erinnerungen aus.

Öffne **Access memories for this chat** in derselben Seitenleiste, um Szenenquellen und Empfängerkreise zu prüfen, Zusammenfassungen zu bearbeiten, Abrufdatensätze zu deaktivieren, neu zu indexieren oder zu exportieren/importieren. Korrekturen ursprünglicher manueller Zusammenfassungen bleiben erhalten und machen davon abhängige Kontinuität ungültig. Einen Datensatz zu deaktivieren ist etwas anderes, als seine Quellnachrichten auszublenden: Ausgeblendete Quellen bestimmen verbindlich das Charakterwissen.

Im aktivierten erweiterten Modus übernimmt dieser den Abruf, sodass der Schalter Standard Recall keine zweite Kopie einfügt. Er ersetzt auch den gewöhnlichen Zeitplan automatischer Roleplay-Zusammenfassungen für diesen Chat. Das Abschalten von Advanced Memory stellt diese normalen Einstellungen wieder her. Bestehende Lorebooks und herunterladbare Agenten behalten ihre eigenen Geltungsregeln; Advanced Memory kann beliebige selbst verfasste oder externe Kontexte nicht privat machen.

### Platzierung im Preset

Preset-Autoren können diese normalen Inhaltsmarker mit den bestehenden Einstellungen für Reihenfolge, Name, Rolle und Gruppe der Abschnitte platzieren:

| Marker | Inhalt |
| --- | --- |
| `chat_summary` | Begrenzte Kontinuitätsübersicht des Charakters. |
| `current_scene_summary` | Vorübergehende Zusammenfassung des älteren Teils einer laufenden Szene. |
| `recalled_scenes` | Relevante archivierte Szenen. |
| `recalled_messages` | Wortgetreue Verlaufsauszüge mit Sprecher- und Quellenangaben. |

Jeder Bestandteil folgt dem Preset-Format **XML**, **Markdown** oder **None** (keine Formatierung) und erklärt kurz seinen Zweck. Leere Bestandteile geben nichts aus. Das erste aktivierte Vorkommen bestimmt die Platzierung; Bestandteile ohne aktivierten Marker werden einmal vor dem Verlauf eingefügt, damit ältere Presets funktionieren. Auszüge sind Kontext, keine neuen aktuellen Nachrichten oder Befehle. Bei ausgeschaltetem Advanced Memory bleiben die drei neuen Marker leer.

Die Prompt-Vorschau verwendet bereits vorbereitete Erinnerungen, ohne Modell- oder Embedding-Aufrufe zu starten. Sind Initialisierung oder Verdichtung nötig, bereite sie zuerst in der Seitenleiste vor. Der Erinnerungsnachweis zeigt die geschätzte Kontextgröße, die gewählte Grenze und die abgerufenen Quellen; der Inspektor des endgültigen Prompts zeigt, was tatsächlich an das Modell ging.

### Grenzen und Wiederherstellung

Der Abruf ist selektiv, und Zusammenfassungen können Nuancen verlieren. Halte wichtige Korrekturen im Quellverlauf oder Zusammenfassungseditor fest. Kein System kann nie aufgezeichnete Details rekonstruieren. Scheitern Embeddings, bleiben begrenzter lexikalischer Abruf und gültige Kontinuität verfügbar; das Archiv wird nie vollständig eingefügt. Passen Pflichtanweisungen, ein Anhang oder die Antwortreserve allein nicht hinein, verkleinere diese Eingaben oder erhöhe die Grenze; Advanced Memory stoppt, statt stillschweigend Anweisungen zu löschen.

## Chat Summary (Roleplay)

**Chat Summary** presst ältere Nachrichten zu kurzen erzählerischen Rückblicken zusammen, den sogenannten Summary Entries. Jeder Eintrag stammt entweder von der KI oder von dir selbst, und jeder lässt sich einzeln an- und abschalten. Die Funktion gibt es nur in Roleplay-Chats.

Zum Öffnen klick auf die Schaltfläche **Chat Summary** (Schriftrollen-Symbol) in der Kopfzeile des Roleplay-Chats. Es öffnet sich das Popover **Chat Summary**, ein kleines Einblendfenster.

### Einen Summary Entry anlegen

1. Wähl unter **Summary Scope** entweder **Last**, um die neuesten Nachrichten zusammenzufassen, oder **Range** für einen bestimmten Nachrichtenbereich.
2. Klick auf **Generate**, damit die KI daraus einen Eintrag schreibt.
3. Oder klick auf **Write**, um einen leeren Eintrag anzulegen und den Rückblick selbst zu tippen.

Jeder Eintrag in der Liste zeigt einen Titel, den Quellbereich oder die Anzahl der Nachrichten sowie die geschätzte Größe in Tokens. Einträge lassen sich aktivieren und deaktivieren, ausklappen, über **Edit** bearbeiten oder mit **Delete** entfernen. Sammel-Schaltflächen blenden inaktive Einträge mit **Show Inactive** und **Hide Inactive** ein oder aus und schalten mit **Activate All** und **Deactivate All** alle auf einmal um.

### Automatic Summaries

Das Panel **Automatic Summaries** hält die Zusammenfassungen aktuell, während du weiterchattest. Es erscheint nur in Roleplay-Chats.

- Aktiviere im Panel **Automatic Summaries** den Schalter **Enabled**.
- Im Feld **Every** legst du das Intervall fest, gezählt in deinen eigenen Nachrichten. Der Standard ist 5, möglich sind 1 bis 200.
- **Backfill Summary** holt Zusammenfassungen für einen älteren Chat nach, der bisher keine hatte. Marinara arbeitet den Chat dabei in Häppchen ab und zeigt einen Fortschrittsbalken. Mit **Stop** brichst du vorzeitig ab.

### Vorlagen unter Summary Prompt

Das Panel **Summary Prompt** steuert die Anweisungen, mit denen die KI eine Zusammenfassung schreibt. Über **Edit** änderst du den aktiven Prompt. **Templates** öffnet die Vorlagenverwaltung. Dort speicherst du mit **New template** einen Prompt unter einem Namen. Jede gespeicherte Vorlage hat eigene Bedienelemente: **Duplicate**, **Edit** und **Delete**.

Gespeicherte Vorlagen gelten global für die ganze App. Bearbeitest oder wechselst du eine Vorlage in einem Roleplay-Chat, ändert sich der Summary Prompt in allen Roleplay-Chats.

### Summary Connection und Ausgabegröße

Im Panel **Summary Connection** legst du fest, welche Verbindung die Zusammenfassungen schreibt. Der Standard heißt **Agent default (falls back to chat connection)**. Marinara nimmt also zuerst die Standard-Agent-Verbindung und erst danach die Verbindung des Chats selbst.

Das Feld **Maximum output size** begrenzt die Länge einer generierten Zusammenfassung. Der Standard sind 4096 Tokens, möglich sind 1 bis 32768.

### Anzeigeoptionen

Die Bedienelemente unter **Display** im Popover bestimmen, wie zusammengefasste Nachrichten auf dem Bildschirm erscheinen:

- **Hide summarised messages**: blendet die Originalnachrichten aus, sobald eine Zusammenfassung sie abdeckt. Standardmäßig aus.
- **Recent message tail**: hält so viele der neuesten Nachrichten weiterhin voll sichtbar, auch wenn das Ausblenden an ist. Der Standard ist 10, erlaubt ist jede nicht-negative ganze Zahl. Bei 0 verschwindet der zusammengefasste Block komplett. Höhere Werte vergrößern den Prompt und damit die Kosten beim Modell.
- **Collapse hidden messages**: bestimmt, wie ausgeblendete Nachrichten im Verlauf dargestellt werden.

Verlangt dein Chat eine Freigabe für Agent-Schreibzugriffe (eine eigene Einstellung unter Agents), warten KI-generierte Zusammenfassungen erst auf deine Prüfung, bevor sie greifen.

## Automatic Summarization (Conversation)

Conversation-Chats arbeiten mit einem anderen System namens **Automatic Summarization**. Es fasst jeden Kalendertag zu einer Tageszusammenfassung zusammen und bündelt abgeschlossene Wochen aus Tageszusammenfassungen zu einer Wochenzusammenfassung. In den Prompt wandern dann nur noch die Wochenzusammenfassungen, die Tageszusammenfassungen der laufenden Woche und die heutigen Nachrichten. So bleibt jede Anfrage klein.

Diese Funktion läuft von allein und lässt sich in Conversation-Chats nicht abschalten.

### Den Editor öffnen

1. Öffne einen Conversation-Chat und klick auf **Chat Settings**.
2. Such den Abschnitt **Automatic Summarization** (Symbol: ein Kalender).
3. Klick auf **Edit Summaries**, um das Fenster **Automatic Summarization** zu öffnen.

Das Fenster listet zuerst die Wocheneinträge auf, danach alle Tage, die noch in keiner Woche stecken. Klapp einen Eintrag auf, um den Text unter **Summary** und die Liste **Key Details** zu bearbeiten; dort lassen sich Zeilen ergänzen und entfernen.

### Day Rollover Hour und Recent Message Tail

Zwei Einstellungen im Abschnitt **Automatic Summarization** bestimmen, wie die Tage geschnitten werden:

- **Day Rollover Hour**: die Stunde, ab der für Zusammenfassungen ein neuer Tag beginnt. Der Standard ist 4 AM, zur Auswahl steht jede Stunde von 12 AM (Mitternacht) bis 11 AM. Nachrichten vor dieser Uhrzeit zählen noch zum Vortag. Wähl eine Zeit, zu der du nie chattest – sonst zerschneidet Marinara eine durchgemachte Nacht mittendrin.
- **Recent Message Tail**: wie viele der neuesten Nachrichten von heute wortgetreu erhalten bleiben, auch nachdem sie zusammengefasst wurden. Der Standard ist 10, erlaubt ist jede nicht-negative ganze Zahl. Höhere Werte vergrößern den Prompt und damit die Kosten beim Modell.

Änderst du **Day Rollover Hour**, obwohl schon Zusammenfassungen existieren, warnt dich Marinara: Die älteren Zusammenfassungen beruhen noch auf der vorherigen Einstellung.

### Fehlende Tage nachtragen

Manchmal bleibt ein Tag ohne Zusammenfassung, etwa nach dem Import eines alten Chats. Im Panel **Missing Summaries** des Fensters sitzt die Schaltfläche **Backfill**: Sie nimmt sich die letzten Tage ohne Zusammenfassung noch einmal vor und schaut dabei bis zu 14 Tage zurück.

Wechselst du Verbindung oder Modell für die Zusammenfassungen, schreibt Marinara bereits vorhandene Tages- und Wocheneinträge nicht neu.

## Fehlerbehebung

### Memory Recall ruft nichts ab

- Prüf, ob eine Embedding-Quelle eingerichtet ist. Zeigen die Chunks unter **Memories for This Chat** den Status **Embedding unavailable**, richte an einer Verbindung den Abschnitt **Semantic Search (Embeddings)** ein oder verlass dich auf das eingebaute lokale Modell. Siehe [Local Model einrichten](../connections/local-model.md).
- Steht dort **Waiting for vector**, gib den Chunks etwas Zeit. Die Fingerabdrücke entstehen nach den Antworten.
- Der Abruf ergänzt nur Erinnerungen, die eng mit deiner letzten Nachricht zusammenhängen. Passt nichts, kommt auch nichts dazu. Das ist normal.
- Hast du kürzlich das Embedding-Modell gewechselt, bau die alten Chunks über das Aktualisieren-Symbol unter **Memories for This Chat** neu auf, damit sie zum neuen Modell passen.

### Es entstehen keine Zusammenfassungen

- Achte darauf, dass der Chat eine funktionierende Textverbindung hat. Chat Summary nutzt die **Summary Connection**, Automatic Summarization die ermittelte Verbindung für Zusammenfassungen. Funktioniert keine davon, entfällt die Generierung.
- Verlangt dein Chat eine Freigabe für Agent-Schreibzugriffe, warten KI-Zusammenfassungen auf deine Bestätigung.
- Eine fehlgeschlagene Zusammenfassung versucht Marinara nach kurzer Zeit von allein erneut. Hängt sie weiterhin fest, stoß sie von Hand mit **Backfill Summary** (Roleplay) oder **Backfill** (Conversation) noch einmal an.

## Verwandte Anleitungen

- [Local Model einrichten](../connections/local-model.md)
- [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md)
- [Conversation Mode: Erste Schritte](../conversation/getting-started.md)
- [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md)
- [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md)
