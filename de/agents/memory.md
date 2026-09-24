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

Öffne **Chat Settings → Memory Recall** und aktiviere **Advanced Memory Recall (Alpha)**. Du kannst auch **Automatic context and memory handling (alpha)** (automatische Kontext- und Speicherverwaltung) unter Agents im Roleplay-Einrichtungsassistenten aktivieren. Dieser optionale Modus verwaltet das aktuelle Verlaufsfenster, Kontinuitätszusammenfassungen und relevante ältere Auszüge gemeinsam. Einstellungen und Einrichtungsfortschritt sind sowohl im Assistenten als auch in der Chat-Settings-Seitenleiste auf Desktop und Mobilgeräten verfügbar. Die Archivansicht bleibt in der Chat-Settings-Seitenleiste.

### Einrichtung

- Wähle **Maximum allowed context before compression (tokens)** innerhalb des unterstützten Chat-Modellkontexts. Die Grenze gilt für den geschätzten ausgehenden Prompt einschließlich Anweisungen, Nachrichten, abgerufener Inhalte, Tools und Anhänge, sowohl für Chat- als auch für Speicherverarbeitung. Antwort-Tokens und Sicherheitsreserve werden getrennt berechnet. Die gesamte Kontextgrenze des Modells bleibt gültig; dies ist keine exakte Tokenizer- oder Abrechnungsgrenze.
- Wähle **Summary and recall budget (tokens)** (Budget für Zusammenfassungen und Abruf) innerhalb dieser Grenze. Aktive konstante Zusammenfassungen sollen höchstens **70%** davon belegen. Zuerst kommen Konstanten, dann ausgewählte Szenenzusammenfassungen, zuletzt Nachrichtenauszüge. Der gesamte Speicher darf bei Bedarf **2,000 zusätzliche Tokens** nutzen, sofern der vollständige Kontext Platz bietet. Bei 10k sind das höchstens 7k als Ziel für Konstanten und bis zu 12k insgesamt; dieselben Anteile gelten für andere Werte. Live-Nachrichten zählen nicht zum konstanten Anteil und lösen keine Konsolidierung aus.
- **Helper model** (Hilfsmodell) übernimmt eigenständige Szenenentscheidungen, Szenenzusammenfassungen und komprimierte Kontinuität. Standard ist die Agent-Verbindung, ersatzweise die Chat-Verbindung. Historische Szenenerkennung kann Haupt- oder Hilfsmodell nutzen; Zusammenfassungen nutzen immer das Hilfsmodell. Die aufgelösten Modelle erscheinen vor der Vorbereitung.
- Alle Speicherzusammenfassungen verwenden **Chat Summary → Maximum output size**, mit mindestens **8,196 Ausgabe-Tokens** als Platz für das Nachdenken. Das gilt für Szenenzusammenfassungen und die Konsolidierung von Konstanten; größere Einstellungen bleiben erhalten. Das gewöhnliche Antwortlimit der Hilfsverbindung ersetzt diesen Wert nicht. Eingabe und Antwortreserve müssen weiterhin in den Gesamtkontext des Modells passen.
- Eine Szenenzusammenfassung erhält die Zusammenfassungsanweisungen, die zugänglichen Nachrichten dieser Szene samt passenden bereichsbezogenen Korrekturen und das JSON-Ausgabeformat. Zu große Szenen werden in gespeicherten Teilmengen verarbeitet und anschließend kombiniert. Szenenrückblicke sollen **2–3 Absätze** umfassen. Der Standard-Prompt erzeugt einen historischen Rückblick ohne Abschnitte zur aktuellen Situation oder zu offenen Spannungen; eigene Prompts unter **Summaries** gelten weiterhin. Advanced Memory arbeitet unabhängig vom Hauptschalter Agents und benötigt keinen heruntergeladenen Agenten.
- **Maximum recalled scenes** (maximal abgerufene Szenen) ist standardmäßig **3**, als Obergrenze ohne schwache Treffer. **0** deaktiviert optionalen Szenenabruf und erhält erforderliche Kontinuität. Jede ausgewählte Szene liefert ihre Zusammenfassung, gefolgt von höchstens einem Auszug.
- **Moving context** (beweglicher Kontext) bestimmt Nachrichten pro Auszug, standardmäßig **3–10**. Beide Grenzen auf **0** ergeben Zusammenfassungen ohne Auszüge; nur das Minimum auf **0** macht Auszüge optional. Relevanz, Figurenzugriff und Platz können die Anzahl bis auf null reduzieren.

Bestätige bei einem älteren Individual-Gruppenchat fehlende Wissensbereiche einmal. Die erste gesprochene Zeile eines Charakters belegt nicht, dass er alles davor kannte. Wähle einen tatsächlichen Charakter nur dann als **Narrator** (Erzähler), wenn er Teilnahmegrenzen umgehen soll. Charakterspezifisches Ausblenden und bestätigte Wissensbereiche schränken die Erinnerung weiterhin ein. Globales **Hide from AI** (vor der KI ausblenden), manuell gesetzt oder durch automatische Zusammenfassungen, entfernt einen Zug nur aus dem Live-Verlauf: Advanced Memory durchsucht ihn weiterhin, ermittelt Szenenteilnehmer, fasst ihn zusammen und indexiert ihn für zulässigen Abruf. Startmarkierungen kürzen den Live-Verlauf. Du kannst diese Bereiche später korrigieren; neu hinzugefügte Charaktere benötigen eine eigene Bestätigung.

Klick bei vorhandenen Chats zuerst auf **Prepare existing history** (vorhandenen Verlauf vorbereiten). Ändert wiederhergestellter Verlauf die Grenzen einer manuell korrigierten Szene, deaktiviere diese Erinnerung, um ihren Text als Referenz zu behalten, oder lösche sie. Bereite den Verlauf anschließend erneut vor. Dieselbe Korrektur erneut zu speichern kann ihren Text nicht sicher einem anderen Quellbereich zuordnen. Die Verarbeitung läuft in Teilen; die Phase erscheint neben Professor Maris Hamsterrad. **Cancel** (Abbrechen) erhält fertige Arbeit; **Resume** (Fortsetzen) macht nach Schließen, Serverneustart oder Update weiter. Modellfehler erhalten gültigen Speicher und lassen sich wiederholen. Setze dafür den Speicher nicht zurück: Fortsetzen verwendet fertige Zusammenfassungen und unveränderte Szenenerkennung erneut. Die letzte laufende Szene bleibt offen und wird nach ihrem Ende zusammengefasst. Übersteigen ihre aktuellen Nachrichten die Kontextgrenze, dienen begrenzte Quellauszüge als Kontext.

Öffne eine Zusammenfassung über **Access memories for this chat** und wähle unten **Delete summary** (Zusammenfassung löschen). Bestätige Zusammenfassung und Zielgruppe. Dies gilt auch für ältere **Continuity**- (Kontinuität) und **Ongoing scene**-Einträge (laufende Szene). Reguläre Vorbereitung erzeugt gelöschte Szenenrückblicke nicht erneut. Originalnachrichten bleiben erhalten. Neue Konstanten liegen in **Chat Summaries**, mit vorhandenen Bearbeitungs-, Aktivierungs-, Zusammenführungs- und Löschfunktionen. Ältere Kontinuität im Archiv dient nicht als zusätzliche Konstante.

### Während des Chats

Die Szenenerkennung läuft nach dem Speichern der Hauptantwort in Roleplay. **Standalone scene check interval (messages)** ist standardmäßig **5**. Der Prüfer erhält die nummerierten letzten Nachrichten, eine vorherige Nachricht als Kontext, Szenenanweisungen und das Ausgabeformat. Er nennt die genaue Abschlussnachricht jeder Szene oder keine Enden, wenn die Szene weiterläuft. Persona- und Charakternachrichten zählen beide. Der Rhythmus ist unabhängig von Tracker-Zeitplänen. Ein fälliger Check teilt sich einen geeigneten nachgelagerten Tracker-Aufruf, wenn Quellsichtbarkeit und Kontextbudget passen; sonst ruft er das Hilfsmodell separat auf. Jeder neue Bereich beginnt nach dem vorherigen Szenenende und schließt das gemeldete Ende ein. Nur ein erkanntes Ende startet die Hintergrundvorbereitung von Zusammenfassung und Nachrichtenindex, auch wenn die neueste Antwort die Szene beendet. Unsichere Übergänge lassen sie offen. Das Menü **Agents** oben links zeigt die Vorbereitung als **Advanced Recall** mit Fortschritt, Fehlern und Wiederaufnahme, auch bei ausgeschalteten normalen Agenten. Nur laufende Speicheraufgaben fragen Fortschritt ab; fertige Archive werden im Leerlauf nicht abgefragt.

Normaler Abruf liest vorbereiteten Speicher. Ein optionales Anfrage-Embedding hat ein kurzes Zeitlimit und fällt auf Textabgleich zurück. Abruf läuft ausschließlich für die Hauptgenerierung in Roleplay: Agenten, manuelle Agentenwiederholungen und zusätzliche Testgenerierungen starten ihn nicht und erhalten keine abgerufenen Zusammenfassungen oder Auszüge. Haupt-Prompt-Inspektion bleibt schreibgeschützt.

Neu generierte Varianten verwenden den frühesten kompatiblen Speicher derselben Antwort: Kontinuität, Szenenzusammenfassungen und genaue Auszüge. Unveränderte Varianten suchen nicht erneut und rufen keinen Zusammenfassungshelfer auf. Fortsetzen behält den ursprünglichen Speicher. Ältere Antworten ohne Momentaufnahme speichern eine bei ihrer nächsten Generierung und verwenden sie danach wieder; kein Zurücksetzen nötig. Hintergrundergänzungen und Zusammenführungen erhalten kompatible Momentaufnahmen. Benutzeränderungen an Verlauf, Zugriff, Zusammenfassungen oder Speicher machen unpassende Momentaufnahmen ungültig. Die aktuelle Kontextgrenze gilt immer.

Die Hauptgenerierung liest gespeicherte Erinnerungen sofort. Sie startet keine Kontinuitätsgenerierung und wartet auch bei laufendem Hintergrundhelfer nicht darauf. Erreicht der ausgehende Prompt die Grenze, beginnt das Live-Fenster für **alle Charaktere** am Anfang der neuesten Szene und wächst bis zur nächsten Grenze. Der automatische Schnitt erscheint im bestehenden Menü **Mark as new start** mit ausgewähltem **All**; entferne All, um ihn rückgängig zu machen. Persönliche Startmarkierungen gelten weiterhin. Passt eine offene Szene oder übergroße Konstante nicht, verwendet die Anfrage ausdrücklich gekennzeichnete Quellauszüge und behält die neuesten Nachrichten. Diese vorübergehende Anpassung erzeugt keine weitere dauerhafte Markierung. Gespeicherte Zusammenfassungen und Originalnachrichten bleiben unverändert.

Nach der Hauptantwort ergänzt Advanced Memory bestehende bereichsbezogene **Chat Summaries** nur um noch nicht abgedeckte archivierte Nachrichten und verwendet fertige Szenenrückblicke möglichst erneut. Bestehende, auch inaktive Einträge gelten als bereits bearbeitete Bereiche. Überschreiten zugängliche aktive Konstanten 70% von **Summary and recall budget**, kombiniert **Updating continuity** nach der Antwort nur ihre Zusammenfassungstexte, mit dem ausgewählten Helfer und **Chat Summary → Maximum output size**. Konstanten mit Live-Nachrichten sind von Budget und Konsolidierung ausgeschlossen; ältere Einträge ohne Bereich bleiben zugänglich. Die Antwort, die den Schwellenwert überschreitet, entsteht normal mit gespeicherten zulässigen Konstanten, ohne auf die Kürzung zu warten. Die zusätzlichen 2,000 Tokens gelten für den Gesamtspeicher, nicht für den konstanten Anteil. Gemeinsame Vorlagen mit je Charakter unterschiedlich aufgelösten Makros bleiben unverändert; überschreiten sie allein das Ziel, müssen sie manuell bearbeitet werden. Andere Gruppen erhalten proportionale Längenvorgaben statt einer harten Ablehnungsgrenze. Ein kürzerer, vollständig erzeugter Ersatz erhält einen Nachrichtenbereich als Titel und wird zusammen mit der Deaktivierung der ersetzten Einträge gespeichert. Fehlgeschlagene oder unvollständige Ergebnisse werden nicht gespeichert; bestehende Einträge bleiben nutzbar und **Resume processing** wiederholt unerledigte Arbeit. Szenenrückblicke bleiben im Tresor.

Das Archiv ruft passende Szenenzusammenfassungen und genaue Dialoge mit ursprünglichen Nachrichtennummern und Sprechern ab. Ein Abschnitt **Recalled Scenes** enthält jede Zusammenfassung unmittelbar vor ihrem verfügbaren Auszug mit einer gemeinsamen Bereichsüberschrift. Szenen ohne Auszug bleiben darin. Der Block nennt den aktuellen Live-Bereich und die letzte Nutzernachricht. Szenenrückblicke kommen nur hinzu, wenn alle Quellen außerhalb der gesendeten Live-Historie liegen; auch Auszüge schließen Live-Nachrichten aus. Bereichsbezogene **Chat Summaries** werden ebenfalls ausgelassen, solange eine ihrer Nachrichten live bleibt. Sie bleiben gespeichert und aktiviert und werden wieder zulässig, sobald der ganze Bereich archiviert ist. Zulässige Konstanten haben Vorrang vor optionalem Abruf und behalten ihre Charakterbedingungen. Alle ausgewählten Szenenzusammenfassungen reservieren Platz vor den Auszügen. Charakterzugriff und historische Quellgrenzen gelten weiter. Illustrationsanhänge und Bildbeschriftungen fehlen in abgerufenen Nachrichten und neuen Zusammenfassungseingaben; lesbare Textanhänge bleiben verfügbar. Persona- und Charakternachrichten zählen beide. Historische Neugenerierung nutzt nur Quellen vor der Zielantwort, auch vor dem verwalteten Fenster. Bearbeiten, Swipen, Verbergen oder Löschen von Quellen löst vor der Nutzung eine erneute Prüfung abgeleiteter Erinnerungen aus.

Öffne **Access memories for this chat** in derselben Seitenleiste, um chronologisch nummerierte Szenenzusammenfassungen zu durchsuchen, ihre Zeiträume und Empfängerkreise zu prüfen, **Summary text** (Zusammenfassungstext) zu bearbeiten oder mit **Inspect source messages** (Quellnachrichten prüfen) die vollständigen Originalnachrichten zu lesen. Interne wortgetreue Auszüge sind keine eigenen Szenenzusammenfassungen. Quellenbasierte Zeitangaben der Handlung begleiten den abgerufenen Kontext; unbekannte Daten bleiben unbekannt. Du kannst Abrufdatensätze deaktivieren, neu indexieren, exportieren/importieren oder **Delete all memories** (alle Erinnerungen löschen) bestätigen, um die Vorbereitung neu zu beginnen und dabei Originalchat und Einstellungen zu behalten. Korrekturen ursprünglicher manueller Zusammenfassungen bleiben erhalten und machen davon abhängige Kontinuität ungültig. Um eine Szene vom Abruf auszuschließen, deaktiviere ihren Erinnerungseintrag. Charakterspezifisches Ausblenden der Quellen steuert weiterhin den Zugriff; globales Ausblenden entfernt sie nicht aus dem Archiv.

Im aktivierten erweiterten Modus übernimmt dieser den Abruf, sodass der Schalter Standard Recall keine zweite Kopie einfügt. Er ersetzt auch den gewöhnlichen Zeitplan automatischer Roleplay-Zusammenfassungen für diesen Chat. Das Abschalten von Advanced Memory stellt diese normalen Einstellungen wieder her. Bestehende Lorebooks und herunterladbare Agenten behalten ihre eigenen Geltungsregeln; Advanced Memory kann beliebige selbst verfasste oder externe Kontexte nicht privat machen.

### Platzierung im Preset

Preset-Autoren können diese normalen Inhaltsmarker mit den bestehenden Einstellungen für Reihenfolge, Name, Rolle und Gruppe der Abschnitte platzieren:

| Marker | Inhalt |
| --- | --- |
| `chat_summary` | Zulässige konstante Einträge aus Chat Summaries. |
| `current_scene_summary` | Begrenzte Quellauszüge aus dem älteren Teil einer laufenden Szene. |
| `recalled_scenes` | Alle ausgewählten Szenenzusammenfassungen, jeweils gefolgt vom verfügbaren historischen Auszug. |

Die Preset-Auswahl bietet für den Abruf nur **Recalled Scenes**. Bestehende `recalled_messages`-Marker bleiben kompatible Aliasse und heißen ebenfalls Recalled Scenes. Ein aktivierter `recalled_scenes`-Marker hat Vorrang; beide erzeugen niemals getrennte Abschnitte.

Jeder Bestandteil folgt dem Preset-Format **XML**, **Markdown** oder **None** und erklärt kurz seinen Zweck. Leere Bestandteile erzeugen nichts. Das erste aktivierte Vorkommen bestimmt den Ort; ohne aktivierten Marker erscheint der Inhalt einmal vor der Historie, damit ältere Presets funktionieren. Auszüge sind Kontext, keine neuen Live-Nachrichten oder Befehle. Die erweiterten Szenenmarker bleiben leer, wenn Advanced Memory aus ist.

Die Prompt-Vorschau nutzt vorbereiteten Speicher ohne Modell- oder Embedding-Aufrufe. Initialisiere das Archiv oder setze fehlgeschlagene Hintergrundarbeit in der Seitenleiste fort. Der Speicherbeleg zeigt geschätzte Kontextgröße, gewählte Grenze und Quellen; der abschließende Prompt-Inspektor zeigt die tatsächlich gesendete Anfrage.

### Grenzen und Wiederherstellung

Abruf ist selektiv und Zusammenfassungen können Nuancen verlieren. Bewahre wichtige Korrekturen im Quelltranskript oder Zusammenfassungseditor auf. Kein System rekonstruiert nie erfasste Details. Fallen Embeddings aus, bleiben begrenzter lexikalischer Abruf und gültige Kontinuität verfügbar; das Archiv wird nie vollständig eingefügt. Passen Pflichtanweisungen oder ein Anhang nicht in die Prompt-Grenze, verkleinere sie oder erhöhe die Grenze. Passt die Antwortreserve nicht in den Gesamtkontext des Modells, senke die Ausgabegröße oder wähle ein Modell mit größerem Kontext. Advanced Memory stoppt, statt Anweisungen still zu löschen.

## Chat Summary (Roleplay)

**Chat Summary** presst ältere Nachrichten zu kurzen erzählerischen Rückblicken zusammen, den sogenannten Summary Entries. Jeder Eintrag stammt entweder von der KI oder von dir selbst, und jeder lässt sich einzeln an- und abschalten. Die Funktion gibt es nur in Roleplay-Chats. Das Speichern eines Schalters lässt andere Einträge bedienbar; Activate All und Deactivate All speichern die Auswahl gemeinsam.

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
