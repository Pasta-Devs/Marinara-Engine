# Memory Recall und Chat-Zusammenfassungen

Jedes KI-Modell kann immer nur eine begrenzte Textmenge auf einmal lesen. Diese Grenze heißt Kontextfenster. In einem langen Chat fallen die ältesten Nachrichten heraus, und die KI vergisst sie. Marinara Engine (im Folgenden nur Marinara) kann diesen Verlauf auf mehreren Wegen zurückholen. In dieser Anleitung erfährst du, wie du jeden davon einschaltest und Probleme behebst, wenn er nicht funktioniert.

## Welche Gedächtnisfunktion brauche ich?

Fang mit **Memory Recall** an. Es funktioniert ohne zusätzliche Einrichtung, weil Marinara ein eingebautes Embedding-Modell auf deinem Rechner nutzen kann. Nimm Zusammenfassungen dazu, wenn Chats sehr lang werden.

| Funktion | Was sie tut | Gilt für |
| --- | --- | --- |
| **Memory Recall** | Durchsucht ältere Nachrichten nach den Stellen, die zu deiner letzten Eingabe passen, und fügt sie in den Prompt ein. | Alle Modi |
| **Chat Summary** | Ersetzt alte Nachrichten durch kurze Rückblicke. | Roleplay |
| **Automatic Summarization** | Fasst jeden Tag zusammen, dann jede Woche. Immer an. | Conversation |
| **Advanced Memory Recall** (erweiterter Erinnerungsabruf) | Verwaltet Live-Verlauf, Szenenzusammenfassungen und abgerufene Auszüge gemeinsam. Optional. | Roleplay und Game Mode |

Memory Recall und Zusammenfassungen erledigen unterschiedliche Aufgaben und können gleichzeitig laufen. Game Mode hat Memory Recall und auf Wunsch Advanced Memory Recall (siehe [In Game Mode](#in-game-mode)). Eine eigene Zusammenfassungsfunktion hat er nicht.

## Memory Recall

Memory Recall arbeitet mit Embeddings. Ein Embedding ist ein numerischer Fingerabdruck der Bedeutung einer Nachricht. Marinara speichert frühere Nachrichten in kleinen Gruppen, den sogenannten Chunks. Es vergleicht den Fingerabdruck deiner neuen Nachricht mit den gespeicherten Fingerabdrücken und fügt die ähnlichsten Chunks in den Prompt ein.

### Memory Recall aktivieren

1. Öffne einen Chat und klick auf **Chat Settings** (Chat-Einstellungen).
2. Such den Abschnitt **Memory Recall**.
3. Schalte **Enable Memory Recall** ein.

Die Einstellung gilt pro Chat. In Conversation-Chats ist sie anfangs an, ebenso in Roleplay- oder Game-Chats mit aktiver Szene. In allen anderen Chats ist sie anfangs aus. Schaltest du sie aus, endet der Abruf, gespeicherte Erinnerungen werden aber nicht gelöscht.

Wenn es nicht funktioniert hat: Memory Recall braucht eine Embedding-Quelle (nächster Abschnitt). Legst du keine fest, nutzt Marinara sein eingebautes Modell, die meisten können diesen Abschnitt also überspringen. Prüf, ob **Memory Recall** überhaupt erscheint. Einige Container-Builds, bekannt als Marinara Lite, schalten es vollständig ab.

### Die Embedding-Quelle festlegen (optional)

Memory Recall braucht ein Modell, das die Fingerabdrücke erzeugt. Legst du nichts fest, nutzt Marinara das eingebaute Embedding-Modell (siehe unten). Für die meisten ist das die einfachste Lösung. Willst du stattdessen einen Dienst nutzen, legst du ihn an einem Konto fest, nicht in den Chat-Einstellungen.

Bevor du anfängst: Du brauchst ein Konto, das Embeddings anbietet. Siehe [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).

1. Öffne **Connections** (Verbindungen) und bearbeite das Konto.
2. Such den Abschnitt **Semantic search (embeddings)**.
3. Trag den Namen eines Embedding-Modells ein, zum Beispiel `text-embedding-3-small`.
4. Optional: Leg unter **Embedding endpoint URL** eine andere Adresse fest.
5. Optional: Leih dir über **Embedding provider** (Embedding-Anbieter) Key und Adresse eines anderen Kontos. **Same as this provider** (wie dieser Anbieter) behält die eigenen dieses Kontos.

Manche Dienste bieten keine Embeddings an. Marinara bittet dich dann, ein eigenes Embedding-Konto zu wählen, etwa ein OpenAI-kompatibles, Google oder das eingebaute Modell.

Willst du überall dieselbe Quelle nutzen, wähl sie unter **Embeddings** in **Connections → Defaults** (Standardwerte). Konten ohne eigenes Embedding-Modell verwenden sie dann. Die Einstellung eines Kontos hat weiterhin Vorrang.

Gibt es weder ein Embedding-Konto noch einen **Embeddings**-Standard, greift Marinara auf ein eingebautes Embedding-Modell zurück. Es wird einmal heruntergeladen und läuft ohne API-Key auf deinem Rechner. Siehe [Eingebautes Modell einrichten](../connections/local-model.md).

Dieselbe Einstellung treibt auch die semantische Suche in Lorebooks an, du richtest sie also einmal für beides ein.

### Gespeicherte Erinnerungen ansehen und verwalten

1. Öffne **Chat Settings → Memory Recall**.
2. Klick auf **Access memories for this chat**. Das Fenster **Memories for This Chat** öffnet sich. Ist Advanced Memory an, bleibt die Ansicht in der Roleplay-Seitenleiste.

Das Fenster zeigt die Anzahl gespeicherter Chunks und eine grobe Schätzung in Tokens. Jede Chunk-Karte zeigt ihren Zeitraum, die Anzahl der Nachrichten, den Erstellungszeitpunkt und einen Status.

| Status | Bedeutung |
| --- | --- |
| **Vectorized** | Der Fingerabdruck steht und ist durchsuchbar. |
| **Waiting for vector** | Der Fingerabdruck entsteht gerade noch. |
| **Embedding unavailable** | Keine Embedding-Quelle konnte ihn erzeugen. |

Die Symbolleiste hat Symbole zum Exportieren, Importieren, Neuaufbauen und Leeren der Erinnerungen.

- Das Papierkorb-Symbol eines Chunks öffnet **Forget Memory**. Bestätige mit **Forget**.
- Das Symbol zum Leeren aller Erinnerungen öffnet **Clear Memories**. Bestätige mit **Clear**. Das entfernt die Erinnerungen für den Abruf, nicht deine Chat-Nachrichten.
- Das Aktualisieren-Symbol baut jeden Chunk aus den aktuellen Nachrichten neu auf. Nutze es, nachdem du das Embedding-Modell gewechselt hast.
- Der Export speichert eine `.marinara.json`-Datei. Der Import akzeptiert `.json`- oder `.marinara`-Dateien und führt sie mit den vorhandenen Erinnerungen zusammen.

### Wie sich Memory Recall verhält

- Marinara speichert Chunks im Hintergrund, sobald eine Embedding-Quelle vorhanden ist, auch wenn **Enable Memory Recall** aus ist. Der Schalter steuert nur, ob Erinnerungen in den Prompt eingefügt werden.
- Ein Chunk entsteht erst, wenn mindestens 5 neue Nachrichten vorliegen.
- Schwache Treffer werden übersprungen, der Abruf kann also leer ausgehen, obwohl Erinnerungen vorhanden sind. Für abgerufene Erinnerungen wird nur ein kleiner Teil des Prompts genutzt.
- Nachdem du das Embedding-Modell gewechselt hast, passen alte Chunks nicht mehr. Bau sie neu auf.
- Löschst du die Nachrichten eines Chats, werden auch dessen Chunks gelöscht.

<a id="chat-summary-roleplay"></a>

## Chat Summary (Roleplay)

Chat Summary presst ältere Nachrichten zu kurzen Rückblicken zusammen, den sogenannten Summary Entries. Jeder Eintrag kann von der KI oder von dir geschrieben werden, und jeder lässt sich an- und abschalten. Die Funktion gibt es nur in Roleplay-Chats.

Öffne **Chat Settings** und klapp **Chat Summary** unter **Lorebooks** auf. Am Computer kannst du den Abschnitt in einem eigenen Fenster öffnen. Siehe [Chat Settings im Überblick](../chats/chat-settings.md#popping-a-section-out-into-its-own-window).

### Einen Summary Entry anlegen

1. Wähl unter **Summary Scope** entweder **Last** für die neuesten Nachrichten oder **Range** für einen Nachrichtenbereich.
2. Klick auf **Generate**, damit die KI einen Eintrag schreibt, oder auf **Write**, um selbst einen zu tippen.

Jeder Eintrag zeigt einen Titel, seinen Quellbereich oder die Anzahl der Nachrichten und eine Token-Schätzung. Du kannst ihn an- oder abschalten, ausklappen, mit **Edit** bearbeiten oder mit **Delete** (Löschen) entfernen. **Show Inactive** und **Hide Inactive** ändern, was die Liste zeigt. **Activate All** und **Deactivate All** schalten alle Einträge auf einmal um.

Um mehrere Einträge zu ändern, hak sie an (am Computer wählst du mit Shift-Klick einen Bereich aus) und nutze dann **Enable selected** oder **Disable selected**.

Ist **Review Agent Outputs** an, warten KI-Zusammenfassungen auf deine Freigabe. Siehe [Agent-Freigaben und die Agent Suite](approvals-and-agent-suite.md).

### Automatic Summaries

Das Panel **Automatic Summaries** hält die Zusammenfassungen aktuell, während du chattest.

1. Schalte **Enabled** ein.
2. Leg unter **Every** fest, wie viele Nutzernachrichten zwischen zwei Zusammenfassungen liegen. Der Standard ist 5, möglich sind 1 bis 200.
3. Optional: Klick auf **Backfill Summary**, um einen älteren Chat zusammenzufassen, der nie Zusammenfassungen hatte. Ein Fortschrittsbalken erscheint. Mit **Stop** brichst du vorzeitig ab.

### Summary Prompt, Summary Provider und Ausgabegröße

- **Summary Prompt**: Klick auf **Edit**, um die Anweisungen zu ändern, die die KI verwendet. Mit **Templates** verwaltest du gespeicherte Prompts über **New template**, **Duplicate**, **Edit** und **Delete**. Vorlagen gelten global: Wählst du in einem Roleplay-Chat eine aus, ändert sich der Prompt für jeden Roleplay-Chat.
- **Summary Provider**: das Konto, das die Zusammenfassungen schreibt. Es nimmt zuerst dein Standard-Agent-Konto und danach das Konto des Chats selbst.
- **Maximum output size**: wie lang eine Zusammenfassung sein darf. Der Standard sind 4096 Tokens, möglich sind 1 bis 32768.

### Anzeigeoptionen

- **Hide summarised messages**: blendet die Originalnachrichten aus, sobald eine Zusammenfassung sie abdeckt. Standardmäßig aus.
- **Recent message tail**: hält so viele der neuesten Nachrichten sichtbar, auch wenn das Ausblenden an ist. Der Standard ist 10. Jede ganze Zahl ab 0 ist möglich. Bei 0 wird der ganze zusammengefasste Block ausgeblendet. Höhere Werte machen Prompts größer und teurer.
- **Collapse hidden messages**: ändert, wie ausgeblendete Nachrichten im Verlauf aussehen.

**Recent message tail** begrenzt zusammengefasste Nachrichten. Eine zusammengefasste Nachricht, die älter ist als diese neuesten Nachrichten, bleibt sofort aus dem Prompt heraus, noch bevor die nächste Zusammenfassung sie ausblendet. Eine ältere Nachricht, die noch keine Zusammenfassung abdeckt, wird weiterhin gesendet, weil sie sonst verloren ginge. Gibt es solche Nachrichten, zeigt Chat Summary unter dieser Einstellung an, wie viele es sind. Klick auf **Backfill Summary**, um sie zusammenzufassen.

### Gruppenchats mit zusammengeführten Antworten

In einem Gruppenchat mit zusammengeführten Antworten spricht eine einzige Antwort für alle Charaktere. Ein Teil eines Eintrags, der für bestimmte Charaktere geschrieben ist, etwa `{{#if char == "Kaito"}}…{{/if}}`, bleibt für jeden Charakter erhalten, für den er gilt, und wird mit den Charakteren gekennzeichnet, die ihn kennen, etwa „known only to Kaito“ (nur Kaito bekannt). Teile, die nur der **Narrator** (Erzähler) von Advanced Memory erhält, bleiben außen vor. In Gruppenchats, in denen die Charaktere einzeln nacheinander antworten, und in Chats mit nur einem Charakter liest jeder Charakter die Einträge wie bisher, und der Narrator liest jeden Teil.

## Automatic Summarization (Conversation)

Conversation-Chats fassen jeden Kalendertag zusammen und bündeln abgeschlossene Wochen dann zu einer Wochenzusammenfassung. In den Prompt wandern danach nur noch die Wochenzusammenfassungen, die Tageszusammenfassungen der laufenden Woche und die heutigen Nachrichten. Das läuft von allein und lässt sich nicht abschalten.

### Zusammenfassungen bearbeiten

1. Öffne einen Conversation-Chat und klick auf **Chat Settings**.
2. Such **Automatic Summarization**.
3. Klick auf **Edit Summaries**.

Das Fenster listet zuerst die Wochen auf, danach die Tage, die noch in keiner Woche stecken. Klapp einen Eintrag auf, um den Text unter **Summary** und die Zeilen unter **Key Details** zu bearbeiten.

### Festlegen, wann ein Tag endet

- **Day Rollover Hour**: die Stunde, ab der für Zusammenfassungen ein neuer Tag beginnt. Der Standard ist 4 AM. Du kannst jede Stunde von 12 AM (Mitternacht) bis 11 AM wählen. Nachrichten vor dieser Uhrzeit zählen zum Vortag. Wähl eine Zeit, zu der du nicht chattest. Änderst du sie, obwohl schon Zusammenfassungen existieren, warnt dich Marinara, dass ältere Zusammenfassungen die vorherige Stunde verwendet haben.
- **Recent Message Tail**: wie viele der neuesten Nachrichten von heute wortgetreu erhalten bleiben, nachdem sie zusammengefasst wurden. Der Standard ist 10. Höhere Werte machen Prompts größer und teurer.

### Fehlende Tage nachtragen

Ein Tag kann ohne Zusammenfassung bleiben, etwa nachdem du einen alten Chat importiert hast. Im Fenster hat das Panel **Missing Summaries** eine Schaltfläche **Backfill**. Sie versucht es für bis zu 14 zurückliegende Tage auf einmal erneut. Wechselst du das Modell für die Zusammenfassungen, werden vorhandene Tages- oder Wocheneinträge nicht neu geschrieben.

<a id="advanced-memory-recall-roleplay-and-game-mode"></a>

## Advanced Memory Recall (Roleplay und Game Mode)

Advanced Memory Recall ist ein optionaler Modus, der das Live-Verlaufsfenster, Kontinuitätszusammenfassungen und alte Auszüge gemeinsam verwaltet. Er teilt den Chat in Szenen auf, fasst jede abgeschlossene Szene zusammen und ruft für jede Antwort die Szenen und genauen Nachrichten ab, auf die es ankommt. Er läuft ohne den Schalter Agents und braucht keinen herunterladbaren Agenten.

### Einschalten

1. Öffne **Chat Settings → Memory Recall**.
2. Schalte **Advanced Memory Recall** ein. Du kannst auch **Automatic context and memory handling** (automatische Kontext- und Gedächtnisverwaltung) einschalten, unter Agents im Roleplay-Einrichtungsassistenten.
3. Leg **Maximum allowed context before compression (tokens)** (maximal erlaubter Kontext vor der Komprimierung) innerhalb des Kontextfensters deines Modells fest.
4. Leg **Summary and recall budget (tokens)** (Budget für Zusammenfassungen und Abruf) innerhalb dieser Grenze fest.
5. Optional: Wähl ein **Helper model** (Hilfsmodell).

Hat ein Chat schon einen Verlauf, klick zuerst auf **Prepare existing history** (vorhandenen Verlauf vorbereiten); mehr dazu unten. Einstellungen und Fortschritt erscheinen sowohl im Assistenten als auch in der Seitenleiste von **Chat Settings**, auf Desktop und Mobilgeräten. Die Archivansicht bleibt in der Seitenleiste.

### Einstellungen

| Einstellung | Standard | Was sie tut |
| --- | --- | --- |
| **Maximum allowed context before compression (tokens)** | 65.000 | Erreicht der ausgehende Prompt diese Größe, wird älterer Kontext abgeschnitten und für den Abruf zusammengefasst. |
| **Summary and recall budget (tokens)** | 6.500 | Wie viel vom Kontext auf Erinnerungen entfällt. Empfohlen sind mindestens 10 % des Maximums. |
| **Helper model** | Agent-Konto, dann Chat-Konto | Übernimmt Szenenentscheidungen, Zusammenfassungen und Kontinuität. |
| **Maximum recalled scenes** (maximal abgerufene Szenen) | 3 | Obergrenze der abgerufenen Szenen pro Antwort. 0 schaltet den optionalen Szenenabruf ab. |
| **Moving context** (beweglicher Kontext) | 3 bis 5 Nachrichten | Nachrichten in jedem abgerufenen Auszug. Beide Grenzen auf 0 ergeben Zusammenfassungen ohne Auszüge. |
| **Standalone scene check interval (messages)** | 5 | Wie viele neue Nachrichten zwischen zwei Szenenprüfungen liegen. |
| **Use Decision model** (Entscheidungsmodell verwenden) | Aus | Lässt ein Decision-Modell Szenenenden finden und Erinnerungen auswählen. |
| **Decide who sees new messages** (entscheiden, wer neue Nachrichten sieht) | Aus | Nur in Gruppenchats, in denen die Charaktere einzeln nacheinander antworten. |
| **Character recollections** (Charaktererinnerungen) | Aus | Gibt jedem Charakter seine eigene Erinnerung an eine Szene. |

Das Standardbudget beträgt 10 % des Standardmaximums. Eine spätere Änderung des Maximums ändert es nicht. Die Obergrenze umfasst den gesamten geschätzten ausgehenden Prompt: Anweisungen, Nachrichten, abgerufenen Kontext, Tools und Anhänge. Antwort-Tokens und Sicherheitsreserve werden getrennt berechnet. Es ist eine Schätzung, keine exakte Tokenizer- oder Abrechnungsgrenze.

Alle Aufrufe für Gedächtniszusammenfassungen verwenden **Chat Summary → Maximum output size**, mit mindestens 8.196 Ausgabe-Tokens als Platz für das Nachdenken.

### Vorhandenen Verlauf vorbereiten

1. Klick auf **Prepare existing history**. Bevor es losgeht, werden die aufgelösten Modelle angezeigt.
2. Warte. Der ältere Verlauf wird in Teilen abgearbeitet, und die aktuelle Phase wird angezeigt.
3. Mit **Cancel** (Abbrechen) hältst du an. Fertige Arbeit bleibt erhalten. Mit **Resume** (Fortsetzen) machst du weiter, auch nachdem du die Seitenleiste geschlossen, den Server neu gestartet oder die App aktualisiert hast.

Ein fehlgeschlagener Modellaufruf behält das bisherige gültige Gedächtnis und zeigt einen Fehler, den du wiederholen kannst. Setz das Gedächtnis nach einem Fehler nicht zurück: **Resume** verwendet fertige Zusammenfassungen erneut. Die letzte laufende Szene bleibt offen und wird zusammengefasst, wenn sie endet.

Ändert wiederhergestellter Verlauf eine Szene, die eine manuelle Korrektur abdeckt, schalte diese Erinnerung aus, um ihren Text als Referenz zu behalten, oder lösche sie, und bereite den Verlauf dann erneut vor. **Fix** (Beheben) überspringt eine solche Szene und listet sie auf, statt anzuhalten.

Eine Verzweigung, die aus einem vorbereiteten Chat entsteht, etwa mit **Branch from here** (ab hier verzweigen), behält ihr Advanced Memory. Eine Verzweigung mitten in einer Szene öffnet diese Szene wieder: Ihre alte Zusammenfassung wird verworfen, und eine neue wird geschrieben, wenn die Szene endet. Ein als neue Verzweigung importierter Chat wird wie gewohnt vorbereitet.

<a id="fixing-memory-problems"></a>

### Gedächtnisprobleme beheben

Ist im Gedächtnis eines Chats etwas kaputt, erscheint auf der Schaltfläche **Chat Settings** ein ruhig leuchtender Punkt in deiner Akzentfarbe, und ein Hinweis nennt, bei wie vielen Szenen es Probleme gibt. Jede Gruppe von Problemen wird nur einmal gemeldet, und der Punkt bleibt, bis sie erledigt sind. Unter **Chat Settings → Memory Recall** stehen die Probleme über den Einstellungen. **Access memories for this chat** zeigt denselben Punkt.

Drück **Fix** im Hinweis oder in der Liste, um alle markierten Szenen in einem Durchgang zu reparieren. Dafür wird das **Helper model** genutzt. **Pause processing** (Verarbeitung pausieren) hält die Reparatur an, und **Resume processing** (Verarbeitung fortsetzen) setzt sie fort. Fix:

- fragt den Helfer bei Szenen mit der Markierung **Check who was there** erneut, wer dabei war. Kann er es weiterhin nicht sagen, bekommt niemand neuen Zugriff, und die Szene wird für dich aufgelistet;
- prüft, wer an älteren Szenen beteiligt war, die gespeichert wurden, bevor es Teilnehmerprüfungen gab;
- schreibt neue Zusammenfassungen für Szenen, deren Nachrichten, verborgene Nachrichten, Charakternamen oder zugrunde liegende Zusammenfassungen sich geändert haben, und für abgeschlossene Szenen ohne Zusammenfassung. Zusammenfassungen, die du gelöscht hast, bleiben gelöscht;
- setzt Gedächtnisaufgaben fort, die mit einem Fehler stehen geblieben sind.

Eine Zusammenfassung, die du von Hand bearbeitet hast, schreibt Fix nie um. Solche Zusammenfassungen führt Fix unter **need your review** auf und macht weiter. Einstellungen kann Fix nicht für dich ändern, etwa den Wissensbereich eines Charakters oder eine funktionierende Decision-Verbindung.

Ist Fix fertig, zeigt es „Advanced Memory fixed N scenes“ und die Nummern der Szenen, die eine Prüfung brauchen. Wähl eine Nummer, um diese Szene in **Access memories for this chat** zu öffnen. War Chat Settings geschlossen, bringt dich ein Hinweis mit **Show** (Anzeigen) dorthin. Nach einer Szene, über die Fix nicht entscheiden konnte, fragt der nächste Fix-Durchgang nicht noch einmal, speichere ihren Charakterzugriff also selbst.

### Szenen neu durchsuchen

Wurden Szenenwechsel übersehen, etwa weil eine Szene nie endete, nutze **Re-scan scenes** (Szenen neu durchsuchen) unter **Chat Settings → Memory Recall**.

1. Gib die Nummern der ersten und der letzten zu prüfenden Nachricht ein. Anfangs ist die laufende Szene eingetragen.
2. Drück **Re-scan** (neu durchsuchen).

Advanced Memory sucht in diesen Nachrichten erneut nach Szenenwechseln und fasst die geänderten Szenen neu zusammen. Ist **Use Decision model** an, nutzt es dafür das Decision-Modell, sonst das Hilfsmodell. Szenen außerhalb des Bereichs behalten ihre Grenzen und Zusammenfassungen. Würde sich eine von dir bearbeitete Zusammenfassung ändern, hält der Durchgang an und nennt diese Szene.

<a id="optional-decision-model"></a>

### Optionales Decision-Modell

Ein Decision-Modell ist ein kleines Modell, das Ja-oder-Nein-Fragen beantwortet. Die Option ist standardmäßig aus und wird pro Roleplay-Chat gespeichert.

1. Schalte in Advanced Memory **Use Decision model** ein.
2. Wähl unter **Memory Decision connection** (Entscheidungsverbindung für Erinnerungen) ein Modell. Unter **Built-in model** (eingebautes Modell) stehen dieselben Modelle wie beim globalen **Decision model** (Entscheidungsmodell). Ein Modell, das noch nicht antworten kann, ist samt Begründung ausgegraut, und ein gestopptes startet, sobald es angefragt wird. Unter **Connections** stehen deine gespeicherten Decision-Konten. Siehe [Decision-Modelle](../connections/decision-models.md).

Diese Auswahl ist unabhängig vom globalen Decision-Standard.

Das Modell findet Szenengrenzen, während der Verlauf vorbereitet wird und laufende Szenen geprüft werden. Vor einer neuen Antwort wählt es Erinnerungen in zwei Durchgängen aus. Die Einzelheiten stehen unter [Wie der Abruf per Decision-Modell funktioniert](#how-decision-recall-works).

Gehostete Konten erhalten den jüngsten Gesprächstext und die vorausgewählten Rückblicke oder Nachrichten, die bewertet werden, und können pro Antwort mehrere Anfragen berechnen. Der Abruf prüft den Charakterzugriff, bevor er Kandidaten sendet.

<a id="deciding-who-sees-new-messages"></a>

### Entscheiden, wer neue Nachrichten sieht

In einem Roleplay-Gruppenchat, in dem die Charaktere einzeln nacheinander antworten, kann Advanced Memory entscheiden, welche Charaktere jede neue Nachricht sehen. Dann musst du nicht jede Zeile selbst vor einem Charakter verbergen, der die Szene verlassen hat. Gruppenchats mit zusammengeführten Antworten und Chats mit nur einem Charakter bieten die Option nicht an.

1. Schalte in Advanced Memory **Decide who sees new messages** ein.

Jede neue Nachricht, deine oder die eines Charakters, wird vor den Charakteren verborgen, die nicht in der Szene sind. Dafür wird dasselbe charakterspezifische **Hide from AI** (vor der KI verbergen) genutzt wie bei der Schaltfläche an der Nachricht selbst, daher zeigt die durchgestrichene Augenmarkierung, wer sie nicht sehen kann. Über deine Nachricht wird entschieden, sobald du sie abschickst. Über frühere Nachrichten wird entschieden, bevor der nächste Charakter antwortet.

- Der hier gewählte **Narrator** und der in den Einstellungen für Roleplay Commands gewählte **Narrator character** (Erzählercharakter) sehen jede Nachricht. Wer eine Nachricht geschrieben hat, sieht sie immer. Ist der Empfänger einer Flüsternachricht nicht in der Szene, erhält er die Flüsternachricht trotzdem.
- Ist **Use Decision model** an, wird das Decision-Modell für jeden Charakter gefragt, ob er die Nachricht eindeutig nicht sehen oder hören kann. Ein Charakter, den die Geschichte nie in die Szene bringt, gilt als woanders. Sonst entscheidet das **Helper model**. Eine Nachricht wird nur verborgen, wenn sich das Modell sicher ist.
- Das Modell liest die bisherigen Nachrichten der aktuellen Szene und mindestens die letzten paar davor. Außerdem erhält es eine Liste der Charaktere, die seit Beginn der Szene gesprochen haben. Diese Liste ist nur ein Hinweis: Ein Charakter, der still zuhört, gilt trotzdem als anwesend.
- Änderst du **Hide from AI** an einer Nachricht selbst oder nutzt `/hide` oder `/unhide`, bleibt deine Wahl bestehen, und Advanced Memory ändert diese Nachricht nie wieder.
- Über jede Nachricht wird nur einmal entschieden. Schlägt das Modell fehl oder überschreitet es die Zeit, wird nichts verborgen, und der Fehler landet im Server-Log.

Ist Advanced Memory an, kann eine neue Charakterantwort mit einer Trennzeile wie `***`, `---` oder `* * *` die Szene oder die Perspektive wechseln. Die Antwort wird dann als separate Nachrichten desselben Charakters gespeichert, eine pro Teil.

- Jeder Teil hat sein eigenes Publikum. **Decide who sees new messages**, **Hide from AI** und Flüsternachrichten gelten für jeden Teil einzeln.
- Der Charakter, der die Antwort geschrieben hat, sieht weiterhin jeden Teil. Soll er einen Teil nicht sehen, verbirg ihn selbst vor ihm.
- Die Trennzeile steht oben im Teil, der auf sie folgt. Eine Trennzeile in einem Codeblock oder einem HTML-Block wie `<details>` zählt nicht.
- Der Denktext der Antwort erscheint am ersten Teil. Er geht nicht zurück an das Modell, auch wenn **Exclude Past Reasoning** (früheres Reasoning ausschließen) aus ist.
- Infos zur Nachricht, Tracker und Ergebnisse der Agenten gehören zum letzten Teil.
- Umschreibende Agenten wie Prose Guardian schreiben jeden Teil einzeln um. Ist **Hold Message Until Rewrite** an, wartet jeder Teil auf seine eigene Umschreibung. Schlägt eine Umschreibung fehl, bleibt dieser Teil so, wie er geschrieben wurde.
- Die automatische Sprachausgabe liest alle Teile der Reihe nach vor.
- Ein Swipe oder ein Neugenerieren an einem Teil erzeugt nur für diese eine Nachricht eine neue Fassung. Bei einem früheren Teil behält die neue Fassung nur den Text vor der ersten Trennzeile.
- Fortsetzen und Impersonate teilen eine Antwort nie auf.

<a id="character-recollections"></a>

### Charaktererinnerungen

Schalte **Character recollections** ein, damit jeder Charakter seine eigene Erinnerung an eine Szene bekommt. Die Option ist standardmäßig aus.

- Jeder Charakter, der in einer abgeschlossenen Szene dabei war, bekommt eine kurze Erinnerung daran, etwa 50 bis 100 Wörter lang, in der Ich-Form und in seinem eigenen Tonfall. Seine Charakterkarte bestimmt, worauf er achtet. Der **Narrator**, deine Persona und Charaktere, die woanders waren, bekommen keine.
- Das Modell darf nur verwenden, was der jeweilige Charakter wissen konnte. Eine Charaktererinnerung, die vier Wörter am Stück aus etwas übernimmt, das ihr Charakter nicht wissen konnte, wird weggelassen. Gegen eine Tatsache, die mit anderen Worten wiedergegeben wird, schützen nur die Anweisungen.

So bleiben sie korrekt:

- Eine Charaktererinnerung gilt nur, solange ihr Charakter genau das lesen kann, was er lesen konnte, als sie geschrieben wurde. Wird eine Nachricht der Szene später vor ihm verborgen oder für ihn eingeblendet, wird eine generierte Charaktererinnerung neu geschrieben. Eine von dir bearbeitete bleibt aus den Prompts heraus, bis du sie prüfst und erneut speicherst.
- Die Charaktererinnerungen einer neuen Szene entstehen in derselben Anfrage wie ihre Zusammenfassung. Ist eine Charakterkarte dafür zu groß, folgen sie in eigenen Anfragen. Ein Charakter, dessen Karte mehr als die Hälfte des Platzes einnimmt, den der Helfer für die Szene hat, bekommt keine.
- Schaltest du die Option in einem Chat mit bereits zusammengefassten Szenen ein, kommen Charaktererinnerungen Szene für Szene hinzu, angezeigt als **Writing character recollections**. Szenenzusammenfassungen ändern sich dabei nie. **Resume** versucht fehlgeschlagene Szenen erneut.
- Schreibt das Modell nichts Brauchbares, behält die Szene eine leere Charaktererinnerung, bis sich ihre Zusammenfassung oder der lesbare Text ändert. Du kannst selbst eine in **Access memories for this chat** schreiben.

Wo sie erscheinen und was sie kosten:

- Charaktererinnerungen erscheinen nur bei abgerufenen Szenen, unter der Zusammenfassung der Szene und vor ihrem Auszug, eine Zeile pro Charakter. In einem Gruppenchat, in dem die Charaktere einzeln nacheinander antworten, sieht ein Charakter nur seine eigene. In einer zusammengeführten Antwort erscheinen die Charaktererinnerungen aller anwesenden Charaktere, die sich an die Szene erinnern, mit ihrem Namen.
- Sie zählen zum **Summary and recall budget**. Zuerst kommen Zusammenfassungen, dann Charaktererinnerungen, dann Auszüge. Zuerst schrumpfen die Auszüge, danach fallen ganze Charaktererinnerungen weg. Eine Charaktererinnerung wird nie gekürzt.
- Charaktererinnerungen kommen nie in **Chat Summaries** und entscheiden nie darüber, welche Szenen abgerufen werden.
- Ändert sich die Zusammenfassung einer Szene, werden ihre generierten Charaktererinnerungen neu geschrieben, nach jeder Antwort für bis zu drei Szenen, die neuesten zuerst. **Prepare existing history**, **Re-scan scenes** und **Resume** erledigen das für alle.

Bearbeiten und Ausschalten:

- Öffne in **Access memories for this chat** eine Szene, um jede Charaktererinnerung zu lesen und zu bearbeiten. Eine bearbeitete wird mit **Manually edited** markiert und nie ersetzt. **Delete** nimmt sie endgültig aus den Prompts, du kannst aber eine neue eintippen.
- Schaltest du die Einstellung aus, bleiben gespeicherte Charaktererinnerungen erhalten, landen aber nicht mehr in den Prompts. Export, Import und Verzweigungen schließen sie ein.

<a id="in-game-mode"></a>

### In Game Mode

In Game-Chats schaltest du Advanced Memory Recall genauso unter **Chat Settings → Memory Recall** ein. Ohne die Funktion sendet eine Game-Sitzung bei jedem Zug ihren gesamten Verlauf bis zur Kontextgrenze, eine lange Sitzung kostet pro Zug also weit mehr Eingabe-Tokens. Mit ihr bleibt der Prompt unter **Maximum allowed context before compression**. Die aktuelle Szene geht als Live-Nachrichten mit, frühere Szenen als Rückblicke plus die Momente, die der Abruf auswählt.

- **Der Game Master liest jede Erinnerung.** Es gibt keine Narrator-Auswahl, keine Wissensbereiche, keine automatische Nachrichtensichtbarkeit und keine Charaktererinnerungen.
- **Platzierung.** Rückblicke und abgerufene Szenen stehen nach dem Verlauf, direkt vor den Zuganweisungen des GM. Die Anweisungen und der Verlauf davor bleiben von Zug zu Zug gleich, sodass eine Verbindung mit Prompt-Cache sie wiederverwenden kann. Endet eine Szene, verfehlt eine Anfrage den Cache.
- **Quelle.** Rückblicke folgen der Geschichte, wie du sie siehst: Deine Segmentbearbeitungen gelten, und die Befehlstags des GM werden weggelassen.
- **Sitzungen.** Eine neue Sitzung behält deine Einstellungen, beginnt aber ihr eigenes Archiv. Der GM bekommt weiterhin Rückblicke früherer Sitzungen.
- **Decision-Modell.** Optional und standardmäßig aus. Siehe [Optionales Decision-Modell](#optional-decision-model). Es fügt jedem Zug kleine Anfragen hinzu.
- **Kosten.** Das Hilfsmodell schreibt einen Rückblick pro Szene und prüft alle paar Züge auf einen Szenenwechsel. Diese Anfragen sind klein im Vergleich zum erneuten Senden einer langen Sitzung.
- Die Prompt-Vorschau für einen Game-Chat zeigt Advanced Memory noch nicht. Nutze den abschließenden Prompt-Inspektor.

## Fehlerbehebung

| Problem | Lösung |
| --- | --- |
| Memory Recall ruft nichts ab | Prüf, ob eine Embedding-Quelle eingerichtet ist. Zeigen die Chunks **Embedding unavailable**, leg ein Modell unter **Semantic search (embeddings)** fest oder nutze das eingebaute Modell. Siehe [Eingebautes Modell einrichten](../connections/local-model.md). |
| Chunks zeigen **Waiting for vector** | Gib ihnen etwas Zeit. Die Fingerabdrücke entstehen nach den Antworten. |
| Nichts scheint zu passen | Der Abruf ergänzt nur eng passende Erinnerungen. Dass nichts dazukommt, ist normal. |
| Der Abruf ist nach einem Wechsel des Embedding-Modells schlechter geworden | Nutze das Symbol zum Neuaufbauen in **Memories for This Chat**. |
| Es entstehen keine Zusammenfassungen | Der Chat braucht ein funktionierendes Textkonto. Chat Summary nutzt den **Summary Provider**. Funktioniert keins, entfällt die Generierung. |
| KI-Zusammenfassungen erscheinen nie | **Review Agent Outputs** wartet vielleicht auf deine Freigabe. |
| Eine Zusammenfassung hängt fest | Fehlgeschlagene Zusammenfassungen werden nach einer Weile erneut versucht. Starte **Backfill Summary** (Roleplay) oder **Backfill** (Conversation). |
| Eine Szene ist mit **Check who was there** markiert | Drück **Fix**, oder öffne sie in **Access memories for this chat** und nutze **Edit character access** (Charakterzugriff bearbeiten). |

Für andere Probleme siehe [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md).

## Referenz zu Advanced Memory

Einzelheiten, die die meisten nicht brauchen. Die Einstellungen oben funktionieren, ohne dass du diesen Teil liest.

### Wie Szenen erkannt und zusammengefasst werden

- Die Szenenerkennung läuft, nachdem die Hauptantwort in Roleplay gespeichert wurde. Sobald so viele neue Nachrichten eingegangen sind, wie das Intervall vorgibt, erhält der Prüfer jede Nachricht seit der letzten Prüfung (höchstens doppelt so viele wie das Intervall), die Nachricht, bei der die letzte Prüfung endete, Szenenanweisungen und das Ausgabeformat. Er nennt die genaue Nachricht, mit der jede Szene endet, oder keine, wenn die Szene weiterläuft. Persona- und Charakternachrichten zählen beide.
- Bei ausgeschaltetem Decision-Modus teilt sich eine fällige Prüfung einen geeigneten nachgelagerten Tracker-Aufruf, wenn Sichtbarkeit und Kontextbudget es erlauben. Sonst macht der Helfer einen eigenen Aufruf. Unsichere Übergänge lassen die Szene offen.
- Nur ein erkanntes Ende startet im Hintergrund die Vorbereitung von Zusammenfassung und Nachrichtenindex dieser Szene. **Chat Settings → Agent activity** zeigt den Fortschritt als **Advanced Recall**, auch wenn normale Agenten aus sind.
- Jede Anfrage für eine Szenenzusammenfassung enthält die Zusammenfassungsanweisungen, die zulässigen Nachrichten der Szene, passende Bereichskorrekturen und das JSON-Ausgabeformat. Szenen, die für eine Anfrage zu groß sind, werden in gespeicherten Teilen verarbeitet und dann kombiniert. Rückblicke sollen 2 bis 3 Absätze umfassen. Der Standard-Prompt schreibt einen historischen Rückblick ohne Abschnitt zur aktuellen Situation. Eigene Prompts, die unter **Summaries** ausgewählt sind, gelten weiterhin.
- Die Szenenerkennung beim ersten Vorbereiten des Verlaufs kann Haupt- oder Hilfsmodell nutzen. Zusammenfassungen nutzen immer das Hilfsmodell.
- Jede Zusammenfassung hält außerdem fest, wer daran teilgenommen hat. Ein Teilnehmername, der von der Karte abweicht, etwa „Kaito“ für **Kaito Nakamura**, zählt, wenn er auf genau einen Charakter passt und nicht der Name deiner Persona ist. Gemeinsame Namen, Beschreibungen wie „Kaitos Schwester“ und Namen mit Anmerkungen wie „(erwähnt)“ geben keinen Zugriff. Sagt der Helfer nicht, wer beteiligt war, geht die Szene an jeden Charakter, und in einem Gruppenchat wird sie mit **Check who was there** markiert. Eine Szene, die nur dich nennt, bleibt dem Erzähler vorbehalten. Szenen, die gespeichert wurden, bevor es Teilnehmerprüfungen gab, bleiben dem Erzähler vorbehalten, bis **Fix** oder **Prepare existing history** sie prüft. Jede Antwort, die eine Szene abschließt, prüft außerdem bis zu drei davon.
- Bestätige bei einem älteren Gruppenchat, in dem die Charaktere einzeln nacheinander antworten, fehlende Wissensbereiche einmal. Die erste Zeile eines Charakters belegt nicht, dass er alles davor kannte. Wähle einen tatsächlichen Charakter nur dann als **Narrator**, wenn er Teilnahmegrenzen umgehen soll. Globales **Hide from AI** entfernt einen Zug nur aus dem Live-Verlauf. Advanced Memory durchsucht ihn weiterhin, fasst ihn zusammen und indexiert ihn. Startmarkierungen kürzen den Live-Verlauf.

### Das Live-Fenster und das Budget

- Die Reihenfolge im Prompt ist: Konstanten (immer aktive Zusammenfassungen), dann ausgewählte Szenenzusammenfassungen, dann Charaktererinnerungen, dann Nachrichtenauszüge. Konstanten sollen höchstens 70 % des Budgets belegen. Das gesamte Gedächtnis darf bei Bedarf bis zu 2.000 zusätzliche Tokens nutzen, innerhalb der Kontextgrenze. Live-Nachrichten zählen nicht zum konstanten Anteil.
- Erreicht der ausgehende Prompt die Grenze, beginnt das Live-Fenster für alle Charaktere am Anfang der neuesten Szene und wächst dann wieder. Folgeanfragen nach Funktionsaufrufen und Würfen zählen nicht. Der Schnitt erscheint in **Mark as new start** mit ausgewähltem **All**. Entferne den Haken bei All, um ihn rückgängig zu machen. Persönliche Startmarkierungen gelten weiterhin. Passt eine unvollendete Szene oder eine übergroße Konstante nicht, verwendet die Anfrage gekennzeichnete Quellauszüge und behält die neuesten Nachrichten. Gespeicherte Zusammenfassungen und Nachrichten werden nie überschrieben.
- Die Hauptgenerierung liest gespeicherte Erinnerungen sofort. Sie wartet nie auf eine Kontinuitätsaufgabe.
- Nach der Hauptantwort ergänzt Advanced Memory **Chat Summaries** für archivierte Nachrichten, die noch keine Zusammenfassung abdeckt. In einem Gruppenchat, in dem die Charaktere einzeln nacheinander antworten, teilen sich alle, die eine Szene gelesen haben, eine Zusammenfassung davon.
- Überschreiten die aktiven Zusammenfassungen, die ein Charakter liest, 70 % des Budgets, kombiniert **Updating continuity** sie nach der Antwort zu einer einzigen Zusammenfassung, die etwa halb so groß ist wie sie zusammen, und nutzt dafür den Helfer. Die Antwort wartet nie darauf. Eine Zusammenfassung, die noch Live-Nachrichten abdeckt, wartet, bis diese das Live-Fenster verlassen haben. Liegt die kombinierte Zusammenfassung danach noch über dem Anteil, halbiert die nächste Aktualisierung sie erneut.
- Jede Anfrage enthält nur deinen **Combine prompt** (Prompt zum Zusammenführen), eine Zeile, die um etwa die halbe Länge bittet, und den Text der Zusammenfassungen. Enthält der Text Makros wie `{{user}}`, bittet diese Zeile außerdem darum, sie so zu lassen, wie sie geschrieben sind. Ein Text, der für eine Anfrage zu lang ist, wird in Teilen gesendet, und jeder Teil wird halbiert. Die Antwort des Helfers darf so lang sein wie der Text plus 1.024 Tokens, höchstens aber 8.196 Tokens oder **Chat Summary → Maximum output size**, falls dieser Wert größer ist.
- Zusammenfassungen, die verschiedene Charaktere lesen, werden zu einer kombiniert, auch solche, die du geschrieben hast. Private Teile bleiben in ihren `{{#if char == "Name"}}…{{/if}}`-Abschnitten, genau für die Charaktere, die sie kannten. Der Text, den jede Gruppe von Charakteren liest, wird ohne seine Bedingung in einer eigenen Anfrage gekürzt und kommt danach wieder in dieselbe Bedingung. Die Gruppen folgen der Reihenfolge, in der jede zum ersten Mal vorkommt. Ein Teil unter 64 Tokens bleibt ohne Anfrage, wie er ist. Zusammenfassungen, die andere Makros verwenden, bleiben, wie sie sind. Füllen allein sie den Anteil eines Charakters, kürze sie von Hand oder erhöhe das Budget. Ersetzte Einträge werden inaktiv, sodass du sie wieder einschalten kannst.
- Wenn die Antwort des Helfers an ihrem Limit abgeschnitten wird, leer ist, nicht kürzer ist oder ein Makro hinzufügt oder wenn das Ergebnis ändern würde, wer einen Teil lesen kann, bleiben die Zusammenfassungen, wie sie sind, und die Aktualisierung wird trotzdem abgeschlossen. Dieselben Zusammenfassungen werden erst wieder gesendet, wenn sich eine von ihnen ändert oder du das Hilfsmodell oder den **Combine prompt** änderst. **Resume processing** versucht eine Aktualisierung erneut, die mit einem Fehler abgebrochen ist.
- Der Prompt eines Charakters zeigt Nachrichtenbereich und Datumsangaben einer Zusammenfassung nur aus Nachrichten, die dieser Charakter sehen kann. Der Narrator liest, wenn er allein antwortet, jeden Teil einmal.

### Was der Abruf liefert

- Ein Abschnitt **Recalled Scenes** enthält jede Zusammenfassung, gefolgt von ihrem Auszug, falls vorhanden, unter einer Bereichsüberschrift. Der Block nennt den aktuellen Bereich des Live-Verlaufs und die Nummer der letzten Nutzernachricht, damit frühere Ereignisse nicht mit dem aktuellen Zug verwechselt werden.
- Eine Szene wird nur abgerufen, wenn alle ihre Quellnachrichten außerhalb des gesendeten Live-Verlaufs liegen. Bereichsbezogene **Chat Summaries** werden ausgelassen, solange eine der abgedeckten Nachrichten live ist. Sie bleiben gespeichert und aktiviert. Zulässige Konstanten haben Vorrang vor optionalem Abruf. Alle ausgewählten Zusammenfassungen reservieren Platz vor jedem Auszug.
- Illustrationsanhänge und Bildbeschriftungen fehlen in abgerufenem Text und neuen Zusammenfassungseingaben. Lesbare Textanhänge bleiben.
- Bei ausgeschaltetem Decision-Modus liest der Abruf vorbereitete Erinnerungen. Ein Anfrage-Embedding hat ein kurzes Zeitlimit und fällt auf Textabgleich zurück. Der Textabgleich gibt charakteristischen Begriffen in deinen Nachrichten seit der letzten Wortmeldung des antwortenden Charakters mehr Gewicht. Am stärksten zählt ein Name, den du darin nennst. Die Namen der antwortenden Charaktere und deiner Persona zählen nicht, ebenso wenig ein Name, der in den meisten Erinnerungen vorkommt. Der Textabgleich braucht keinen zusätzlichen Modellaufruf.
- Der Abruf läuft nur für die Hauptgenerierung in Roleplay. Agentenaufrufe, manuelle Agentenwiederholungen und Testläufe lösen ihn weder aus noch erhalten sie ihn.
- Swipes verwenden das früheste kompatible gespeicherte Gedächtnis dieser Antwort erneut. Ein Swipe ruft erneut ab, wenn seitdem eine frühere Szene, die sein Charakter abrufen konnte, gespeichert, bearbeitet, ein- oder ausgeschaltet wurde. Eine fortgesetzte Antwort behält das Gedächtnis, mit dem sie begonnen hat. Änderungen an Verlauf, Zugriffseinstellungen, Zusammenfassungen oder Erinnerungen machen gespeicherte Snapshots ungültig.
- Bearbeiten, Swipen, Verbergen oder Löschen von Quellnachrichten führt dazu, dass betroffene Erinnerungen vor der Nutzung erneut geprüft werden. Historische Neugenerierung nutzt nur Quellen vor der Zielantwort.
- Der Speicherbeleg zeigt die geschätzte Kontextgröße, die gewählte Grenze und die abgerufenen Quellen. Wurde nichts abgerufen, gibt er an, ob es keine früheren Szenen gab, kein Platz mehr blieb oder nichts relevant war. Die Prompt-Vorschau nutzt das vorbereitete Gedächtnis und startet keine Modellaufrufe. Der abschließende Prompt-Inspektor zeigt, was an das Modell ging.
- Hat eine abgerufene Szene keinen Auszug, nennt der Beleg den Grund: Nach den Zusammenfassungen war kein Platz mehr, oder keine ihrer Nachrichten lässt sich zitieren.

### Access memories for this chat

Öffne diese Ansicht, um nummerierte Szenenzusammenfassungen zu durchsuchen, ihre Zeiträume und Empfängerkreise anzusehen, **Summary text** (Zusammenfassungstext) zu bearbeiten oder mit **Inspect source messages** (Quellnachrichten prüfen) die Originale zu lesen. Du kannst Einträge ausschalten, **Reindex** (neu indexieren) nutzen, exportieren und importieren oder mit **Delete all memories** (alle Erinnerungen löschen) die Vorbereitung neu beginnen und dabei Chat und Einstellungen behalten. Korrekturen an manuellen Zusammenfassungen bleiben erhalten und machen davon abhängige Kontinuität ungültig. **Delete summary** (Zusammenfassung löschen) unten an einer Zusammenfassung entfernt sie, nachdem du Zusammenfassung und Zielgruppe bestätigt hast. Das funktioniert auch für alte Einträge vom Typ **Continuity** (Kontinuität) und **Ongoing scene** (laufende Szene). Gelöschte Rückblicke werden bei der regulären Vorbereitung nicht neu erzeugt.

Um eine Szene vom Abruf auszuschließen, schalte ihren Erinnerungseintrag aus. Charakterspezifisches Ausblenden steuert weiterhin, wer darauf zugreifen kann. Globales Ausblenden entfernt sie nicht aus dem Archiv.

### Wer eine Szene lesen kann

- Ein Charakter, der bei einem Teil einer Szene anwesend war, teilt sich den Zugriff auf ihre Erinnerung, auch wenn einige Nachrichten vor ihm verborgen sind. Eine Szene ohne zugängliche Quellnachrichten ist nicht verfügbar. Die Erwähnung eines abwesenden Charakters macht ihn nicht zum Teilnehmer.
- Neue Rückblicke kennzeichnen die Sichtbarkeit der Nachrichten, beschreiben gemeinsame Ereignisse als normalen Text und verwenden `{{#if character == "Name"}}…{{/if}}` für private Abschnitte. Ändert sich die Sichtbarkeit oder der Zielcharakter eines Rückblicks, bleibt der alte Rückblick für Leser mit Teilzugriff gesperrt, bis du die Szene erneut vorbereitest (**Fix** erledigt das für jede solche Szene) oder ihre privaten Bedingungen prüfst und speicherst. Ein Charakter, der später hinzukommt, zählt nicht, es sei denn, nur ein Teil der Szene ist für ihn sichtbar. Ältere Rückblicke brauchen einmal **Fix**, nachdem ein Charakter hinzugekommen ist. Leser mit Zugriff auf jede Quellnachricht können sie weiterhin abrufen. Manuell korrigierter Text wird nie stillschweigend umgeschrieben.
- Die Daten einer Szene gelten für alle zugewiesenen Teilnehmer gemeinsam. Wörtliche Auszüge enthalten nie vor einem Charakter verborgene Nachrichten oder Flüsternachrichten. Auch eine Zusammenfassung mit Teilen, die nur für einzelne Charaktere bestimmt sind, erhält einen Auszug, der nur zitiert, was dieser Charakter gesehen hat. Um eine Nachricht aus der Erinnerung eines Charakters herauszuhalten, verbirg sie vor ihm.
- In einem Gruppenchat mit zusammengeführten Antworten umfasst der Abruf, woran sich mindestens ein Charakter erinnert. Eine Szene oder ein privater Teil, den nicht jeder Charakter kennt, wird gekennzeichnet, etwa mit „known only to Kaito“. Ein Auszug zitiert nur Nachrichten, die jeder sich erinnernde Charakter gesehen hat. Erinnerungen, die kein Charakter hat, etwa dem Erzähler vorbehaltene Szenen, bleiben außen vor. In Gruppenchats, in denen die Charaktere einzeln nacheinander antworten, ruft jeder Charakter nur seine eigenen Erinnerungen ab.

<a id="how-decision-recall-works"></a>

### Wie der Abruf per Decision-Modell funktioniert

- Der normale Abruf stellt zuerst eine Vorauswahl von bis zu 24 Szenenrückblicken zusammen, oder bis zu **Maximum recalled scenes**, falls dieser Wert höher ist. Die Vorauswahl verbindet Textabgleich und Embeddings. Die Embeddings vergleichen jede Szene mit bis zu sechs deiner Nachrichten, seit der antwortende Charakter zuletzt gesprochen hat. Bei einer ersten Antwort wird deine neueste Nachricht verwendet. Solange nicht fast jede Szene Embeddings hat, nutzt die Vorauswahl die Rangfolge des normalen Abrufs. Auch die Szene direkt nach jeder der besten drei bekommt einen Platz.
- Jeder Rückblick, den das Modell beurteilt, beginnt mit einer Zeile: Nachrichtenbereich, Datum der Handlung und wer gesprochen hat. Das Modell wählt die relevanten Szenen und beurteilt dann für jede gewählte Szene bis zu 12 ihrer am besten passenden Originalnachrichten, um ihren Auszug auszuwählen. Die beste Wahl bildet den Mittelpunkt, die übrigen verlängern den Auszug bis zu **Maximum messages per excerpt** (maximale Nachrichten pro Auszug).
- Bei jeder neuen Nachricht prüft das Modell außerdem, ob die Geschichte an einen anderen Ort oder in eine andere Zeit springt, zu Charakteren wechselt, die woanders sind, oder auf eine Szenentrennzeile folgt. Dabei sieht es die drei vorherigen Nachrichten und wer sie geschrieben hat. Unsichere Grenzen lassen die Szene offen. Eine gültige Entscheidung darf nichts auswählen.
- Zeitlimits: Jeder Durchgang bekommt ungefähr so viel Zeit, wie das Modell pro Frage braucht, mal die Anzahl der Fragen und dann noch einmal die Hälfte dazu, mindestens 10 und höchstens 25 Sekunden. Beide Durchgänge zusammen bekommen höchstens 40 Sekunden pro Antwort. Schafft ein Modell nicht alle Fragen, beurteilt es weniger, die besten Treffer zuerst. Die Anfragen sind kurz, sodass rechtzeitig eintreffende Antworten trotzdem zählen. Währenddessen zeigt die Antwort ihren üblichen Platzhalter **Thinking…**.
- Schlägt eine Anfrage fehl, überschreitet sie die Zeit oder ist sie zu groß, fallen nur diese Erinnerungen auf den normalen Abruf zurück, nach den Szenen, die das Modell gewählt hat, und der Beleg weist darauf hin. Eine fehlende Verbindung oder ein Durchgang ohne Antwort fällt vollständig auf die Rangfolge der Vorauswahl und den Textabgleich zurück. Nicht verfügbare Szenenentscheidungen fallen auf den normalen Szenenprüfer zurück.
- Auch in diesem Modus entstehen Embeddings. Eine neu zusammengefasste Szene bekommt sie sofort. Ältere Szenen und solche, die mit einem anderen Embedding-Modell erstellt wurden, bekommen sie im Lauf der folgenden Antworten, jeweils einige auf einmal. **Reindex** erstellt sie alle auf einmal.
- **Peek Prompt → Decision diagnostics → Advanced Memory activity** (Peek Prompt → Entscheidungsdiagnose → Advanced-Memory-Aktivität) zeigt gespeicherte Ergebnisse des letzten Abrufs und der letzten Szenenprüfung: Modell, Zeit, Werte, ausgewählte Erinnerungen oder Szenenanfänge, Status des Ersatzverfahrens und warum eine Szene keinen Auszug hat. Die Ansicht behält bis zu 128 Ergebnisse. Sie beschreiben vergangene Aktivität, keine Vorhersagen. Das Öffnen führt keine Entscheidungen erneut aus. Kompatible Swipes verwenden die gespeicherte Auswahl erneut. Eine Fortsetzung wählt ihre Erinnerungen neu aus.
- Gehostete Decision-Konten erhalten begrenzte Pakete innerhalb ihres Kontextbudgets. Verwaltete Open-Jev-Modelle nutzen ihre gemessene Zeit pro Frage, und ein Decision-Konto beantwortet die Fragen einer Anfrage gemeinsam und zählt deshalb jede Anfrage einmal.

### Platzierung im Preset

Preset-Autoren können diese Inhaltsmarker mit den üblichen Einstellungen für Reihenfolge, Name, Rolle und Gruppe der Abschnitte platzieren:

| Marker | Inhalt |
| --- | --- |
| `chat_summary` | Zulässige konstante Einträge aus Chat Summaries. |
| `current_scene_summary` | Quellauszüge aus dem älteren Teil einer laufenden Szene. |
| `recalled_scenes` | Alle ausgewählten Szenenzusammenfassungen, jeweils gefolgt von ihrem Auszug. |

Jeder folgt dem Preset-Format **XML**, **Markdown** oder **None**. Leere Bestandteile erzeugen nichts. Der erste aktivierte Marker bestimmt den Ort. Bestandteile ohne aktivierten Marker erscheinen ersatzweise einmal vor dem Verlauf, damit ältere Presets funktionieren. Die Preset-Auswahl bietet nur **Recalled Scenes** an. Ein alter `recalled_messages`-Marker ist ein Alias, und ein aktivierter `recalled_scenes`-Marker hat Vorrang. Diese Marker bleiben leer, wenn Advanced Memory aus ist.

### Grenzen

Der Abruf ist selektiv, und Zusammenfassungen können Nuancen verlieren. Bewahre wichtige Korrekturen im Quelltranskript oder im Zusammenfassungseditor auf. Fallen Embeddings aus, bleiben begrenzter Textabruf und gültige Kontinuität erhalten. Das Archiv wird nie vollständig eingefügt. Passen Anweisungen oder ein Anhang nicht in die Grenze, verkleinere sie oder erhöhe die Grenze. Passt die Antwortreserve nicht in den Gesamtkontext des Modells, senke die Ausgabegröße oder wähle ein Modell mit größerem Kontext. Advanced Memory stoppt, statt Anweisungen stillschweigend zu löschen.

Solange der erweiterte Modus an ist, übernimmt er den Abruf, sodass Standard Recall keine zweite Kopie einfügt. Er ersetzt außerdem den üblichen Zeitplan automatischer Roleplay-Zusammenfassungen für diesen Chat. Schaltest du ihn aus, gelten wieder die normalen Einstellungen. Bestehende Lorebooks und herunterladbare Agenten behalten ihre eigenen Geltungsregeln.

## Verwandte Anleitungen

- [Eingebautes Modell einrichten](../connections/local-model.md)
- [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md)
- [Conversation Mode: Erste Schritte](../conversation/getting-started.md)
- [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md)
- [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md)
