# Memory Recall und Chat-Zusammenfassungen

Diese Anleitung erklärt **Memory Recall** (Suche in früheren Nachrichten), das optionale **Advanced Memory Recall** (erweiterter Erinnerungsabruf) für die automatische Kontextverwaltung in Roleplay, **Chat Summary** und **Automatic Summarization** in Conversation.

## Die zwei Gedächtnissysteme

Jedes KI-Modell kann immer nur eine begrenzte Textmenge auf einmal lesen. Diese Grenze heißt Kontextfenster. Wird ein Chat lang, fallen die ältesten Nachrichten aus dem Fenster heraus und die KI vergisst sie. Marinara Engine (im Folgenden nur Marinara) hat dafür zwei getrennte Systeme.

- **Memory Recall** durchsucht die älteren Nachrichten nach den Stellen, die am besten zu deiner letzten Eingabe passen, und schiebt sie unauffällig zurück in den Prompt – also in den Text, den Marinara an die KI schickt. Das funktioniert in jedem Chat-Modus.
- Zusammenfassungen pressen alte Nachrichten zu kurzen Rückblicken zusammen, die im Prompt an die Stelle der Originalnachrichten treten. In Roleplay-Chats übernimmt das **Chat Summary**, in Conversation-Chats **Automatic Summarization**.

Game-Mode-Chats bekommen ausschließlich **Memory Recall**. Beide Zusammenfassungs-Funktionen fehlen dort.

Beide Systeme lassen sich gleichzeitig nutzen. Sie erledigen unterschiedliche Aufgaben und kommen sich nicht in die Quere.

## Memory Recall einrichten

**Memory Recall** sucht passende Bruchstücke aus dem bisherigen Chat und fügt sie als Erinnerungen in den Prompt ein. Grundlage ist ein Embedding: ein numerischer Fingerabdruck der Bedeutung einer Nachricht. Marinara vergleicht den Fingerabdruck deiner neuen Nachricht mit den gespeicherten Fingerabdrücken früherer Nachrichten und ergänzt die ähnlichsten Treffer.

### Memory Recall aktivieren

1. Öffne einen Chat und klick auf die Schaltfläche **Chat Settings** (Chat-Einstellungen) im Chat (anfangs oben rechts).
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

## Advanced Memory Recall (Roleplay)

Öffne **Chat Settings → Memory Recall** und aktiviere **Advanced Memory Recall**. Du kannst auch **Automatic context and memory handling** (automatische Kontext- und Speicherverwaltung) unter Agents im Roleplay-Einrichtungsassistenten aktivieren. Dieser optionale Modus verwaltet das aktuelle Verlaufsfenster, Kontinuitätszusammenfassungen und relevante ältere Auszüge gemeinsam. Einstellungen und Einrichtungsfortschritt sind sowohl im Assistenten als auch in der Chat-Settings-Seitenleiste auf Desktop und Mobilgeräten verfügbar. Die Archivansicht bleibt in der Chat-Settings-Seitenleiste.

### Einrichtung

- Wähle **Maximum allowed context before compression (tokens)** innerhalb des unterstützten Chat-Modellkontexts. Die Grenze gilt für den geschätzten ausgehenden Prompt einschließlich Anweisungen, Nachrichten, abgerufener Inhalte, Tools und Anhänge, sowohl für Chat- als auch für Speicherverarbeitung. Antwort-Tokens und Sicherheitsreserve werden getrennt berechnet. Die gesamte Kontextgrenze des Modells bleibt gültig; dies ist keine exakte Tokenizer- oder Abrechnungsgrenze.
- Wähle **Summary and recall budget (tokens)** (Budget für Zusammenfassungen und Abruf) innerhalb dieser Grenze. Aktive konstante Zusammenfassungen sollen höchstens **70%** davon belegen. Zuerst kommen Konstanten, dann ausgewählte Szenenzusammenfassungen, zuletzt Nachrichtenauszüge. Der gesamte Speicher darf bei Bedarf **2,000 zusätzliche Tokens** nutzen, sofern der vollständige Kontext Platz bietet. Bei 10k sind das höchstens 7k als Ziel für Konstanten und bis zu 12k insgesamt; dieselben Anteile gelten für andere Werte. Live-Nachrichten zählen nicht zum konstanten Anteil und lösen keine Konsolidierung aus.
- Standardmäßig: **Helper model** (Hilfsmodell) übernimmt eigenständige Szenenentscheidungen, Szenenzusammenfassungen und komprimierte Kontinuität. Standard ist die Agent-Verbindung, ersatzweise die Chat-Verbindung. Historische Szenenerkennung kann Haupt- oder Hilfsmodell nutzen; Zusammenfassungen nutzen immer das Hilfsmodell. Die aufgelösten Modelle erscheinen vor der Vorbereitung.
- Alle Speicherzusammenfassungen verwenden **Chat Summary → Maximum output size**, mit mindestens **8,196 Ausgabe-Tokens** als Platz für das Nachdenken. Das gilt für Szenenzusammenfassungen und die Konsolidierung von Konstanten; größere Einstellungen bleiben erhalten. Das gewöhnliche Antwortlimit der Hilfsverbindung ersetzt diesen Wert nicht. Eingabe und Antwortreserve müssen weiterhin in den Gesamtkontext des Modells passen.
- Eine Szenenzusammenfassung erhält die Zusammenfassungsanweisungen, die zugänglichen Nachrichten dieser Szene samt passenden bereichsbezogenen Korrekturen und das JSON-Ausgabeformat. Zu große Szenen werden in gespeicherten Teilmengen verarbeitet und anschließend kombiniert. Szenenrückblicke sollen **2–3 Absätze** umfassen. Der Standard-Prompt erzeugt einen historischen Rückblick ohne Abschnitte zur aktuellen Situation oder zu offenen Spannungen; eigene Prompts unter **Summaries** gelten weiterhin. Advanced Memory arbeitet unabhängig vom Hauptschalter Agents und benötigt keinen heruntergeladenen Agenten.
- **Maximum recalled scenes** (maximal abgerufene Szenen) ist standardmäßig **3**, als Obergrenze ohne schwache Treffer. **0** deaktiviert optionalen Szenenabruf und erhält erforderliche Kontinuität. Jede ausgewählte Szene liefert ihre Zusammenfassung, gefolgt von höchstens einem Auszug.
- **Moving context** (beweglicher Kontext) bestimmt Nachrichten pro Auszug, standardmäßig **3–10**. Beide Grenzen auf **0** ergeben Zusammenfassungen ohne Auszüge; nur das Minimum auf **0** macht Auszüge optional. Relevanz, Figurenzugriff und Platz können die Anzahl bis auf null reduzieren. Jede abgerufene Szene erhält ihren Mindestauszug, bevor irgendein Auszug wächst. Bleibt eine abgerufene Szene trotzdem ohne Auszug, nennt der Abrufbericht den Grund: Nach den Zusammenfassungen war kein Platz mehr, oder keine ihrer Nachrichten lässt sich zitieren.

Bestätige bei einem älteren Individual-Gruppenchat fehlende Wissensbereiche einmal. Die erste gesprochene Zeile eines Charakters belegt nicht, dass er alles davor kannte. Wähle einen tatsächlichen Charakter nur dann als **Narrator** (Erzähler), wenn er Teilnahmegrenzen umgehen soll. Charakterspezifisches Ausblenden und bestätigte Wissensbereiche schränken die Erinnerung weiterhin ein. Globales **Hide from AI** (vor der KI ausblenden), manuell gesetzt oder durch automatische Zusammenfassungen, entfernt einen Zug nur aus dem Live-Verlauf: Advanced Memory durchsucht ihn weiterhin, ermittelt Szenenteilnehmer, fasst ihn zusammen und indexiert ihn für zulässigen Abruf. Startmarkierungen kürzen den Live-Verlauf. Du kannst diese Bereiche später korrigieren; neu hinzugefügte Charaktere benötigen eine eigene Bestätigung.

Klick bei vorhandenen Chats zuerst auf **Prepare existing history** (vorhandenen Verlauf vorbereiten). Ändert wiederhergestellter Verlauf die Grenzen einer manuell korrigierten Szene, deaktiviere diese Erinnerung, um ihren Text als Referenz zu behalten, oder lösche sie. Bereite den Verlauf anschließend erneut vor. **Fix** (Beheben) überspringt eine solche Szene dagegen und listet sie auf, statt anzuhalten; siehe [Gedächtnisprobleme beheben](#fixing-memory-problems). Dieselbe Korrektur erneut zu speichern kann ihren Text nicht sicher einem anderen Quellbereich zuordnen. Die Verarbeitung läuft in Teilen; die Phase erscheint neben Professor Maris Hamsterrad. **Cancel** (Abbrechen) erhält fertige Arbeit; **Resume** (Fortsetzen) macht nach Schließen, Serverneustart oder Update weiter. Modellfehler erhalten gültigen Speicher und lassen sich wiederholen. Setze dafür den Speicher nicht zurück: Fortsetzen verwendet fertige Zusammenfassungen und unveränderte Szenenerkennung erneut. Die letzte laufende Szene bleibt offen und wird nach ihrem Ende zusammengefasst. Übersteigen ihre aktuellen Nachrichten die Kontextgrenze, dienen begrenzte Quellauszüge als Kontext.

Öffne eine Zusammenfassung über **Access memories for this chat** und wähle unten **Delete summary** (Zusammenfassung löschen). Bestätige Zusammenfassung und Zielgruppe. Dies gilt auch für ältere **Continuity**- (Kontinuität) und **Ongoing scene**-Einträge (laufende Szene). Reguläre Vorbereitung erzeugt gelöschte Szenenrückblicke nicht erneut. Originalnachrichten bleiben erhalten. Neue Konstanten liegen in **Chat Summaries**, mit vorhandenen Bearbeitungs-, Aktivierungs-, Zusammenführungs- und Löschfunktionen. Ältere Kontinuität im Archiv dient nicht als zusätzliche Konstante.

<a id="fixing-memory-problems"></a>

### Gedächtnisprobleme beheben

Ist im Gedächtnis eines Chats etwas kaputt, siehst du das, ohne die Gedächtniseinstellungen zu öffnen. In einer Ecke der Schaltfläche **Chat Settings** erscheint ein ruhig leuchtender Punkt in deiner Akzentfarbe, und ein Hinweis nennt, bei wie vielen Szenen es Probleme gibt. Jede Gruppe von Problemen wird nur einmal gemeldet; der Punkt bleibt, bis sie erledigt sind. Unter **Chat Settings → Memory Recall** stehen dieselben Probleme über den Einstellungen, und **Access memories for this chat** zeigt denselben Punkt.

Klick im Hinweis oder in dieser Liste auf **Fix**, um alle markierten Szenen in einem Durchgang zu reparieren. Die Reparatur nutzt das **Helper model** und den gewohnten Fortschrittsbalken. **Pause processing** (Verarbeitung pausieren) hält sie an, und **Resume processing** (Verarbeitung fortsetzen) setzt sie fort; bereits erledigte Arbeit bleibt erhalten. Fix:

- fragt den Helfer bei Szenen mit der Markierung **Check who was there** erneut, wer dabei war, und speichert eine eindeutige Antwort. Kann der Helfer es weiterhin nicht sagen, bekommt niemand neuen Zugriff: Die Szene behält nur Charaktere, die sie schon hatte und die der Helfer nicht ausgelassen hat, und sie wird zur Prüfung für dich aufgelistet;
- prüft, wer an älteren Szenen beteiligt war, die gespeichert wurden, bevor es Teilnehmerprüfungen gab – auch an solchen, deren automatische Prüfung fehlgeschlagen ist;
- schreibt neue Zusammenfassungen für Szenen, deren Nachrichten, verborgene Nachrichten, Charakternamen oder zugrunde liegende Zusammenfassungen sich geändert haben, und für abgeschlossene Szenen ohne Zusammenfassung. Zusammenfassungen, die du gelöscht hast, bleiben gelöscht;
- setzt Speicheraufgaben fort, die mit einem Fehler stehen geblieben sind.

Eine Zusammenfassung, die du von Hand bearbeitet hast, schreibt Fix nie um. Passt eine solche nicht mehr zu ihren Nachrichten, fehlen ihr wieder eingeblendete Nachrichten oder haben sich ihre Szenengrenzen verschoben, lässt Fix sie unangetastet, führt sie unter **need your review** auf und macht mit den übrigen Szenen weiter. Einstellungen, die Fix nicht für dich ändern kann, etwa die Bestätigung des Wissensbereichs jedes Charakters oder die Wahl einer funktionierenden Entscheidungsverbindung, bleiben aufgelistet, bis du sie änderst.

Am Ende zeigt Fix die Meldung **Fixed N scenes** und listet die Szenen unter **need your review** als Szenennummern auf. Wähl eine Nummer, um diese Szene in **Access memories for this chat** zu öffnen. War Chat Settings geschlossen, bringt dich ein Hinweis mit **Show** (Anzeigen) dorthin. Bei einer Szene, über die Fix nicht entscheiden konnte, fragt der nächste Durchgang nicht noch einmal nach; speichere ihren Charakterzugriff selbst.

<a id="optional-jev-decisions"></a>
<a id="optional-decision-model"></a>

### Optionales Decision-Modell

Aktiviere **Use Decision model** (Entscheidungsmodell verwenden) in Advanced Memory und wähle dann unter **Memory Decision connection** (Entscheidungsverbindung für Erinnerungen) ein Modell. Unter **Local models** (lokale Modelle) stehen dort dieselben lokalen Modelle wie beim globalen **Decision model** (Entscheidungsmodell), etwa das **Primary local model** (primäres lokales Modell), das du unter **Local Model** laufen lässt. Ein Modell, das noch nicht antworten kann, bleibt samt Begründung ausgegraut, und ein gestopptes Modell startet, sobald Advanced Memory es anfragt. Unter **Connections** stehen deine gespeicherten Entscheidungsverbindungen. Eine neue erstellst du unter **Connections** mit TypeSafe, OpenRouter oder einer kompatiblen Entscheidungsquelle; siehe [Entscheidungsmodelle](../connections/decision-models.md). Die Option ist standardmäßig aus und wird pro Roleplay-Chat gespeichert. Ihre Auswahl ist unabhängig von der globalen Entscheidungsvorgabe.

Das ausgewählte Modell erkennt Szenengrenzen bei der Vorbereitung des Verlaufs und bei laufenden Szenenprüfungen. Vor einer neuen Antwort wählt es Erinnerungen in zwei Durchgängen aus. Zuerst stellt der normale Abruf per Textabgleich und, wo gespeicherte Vektoren vorhanden sind, per Embeddings eine Vorauswahl von bis zu 24 Szenenzusammenfassungen zusammen – oder bis zu **Maximum recalled scenes**, falls dieser Wert höher ist. Das Modell wählt aus dieser Vorauswahl die relevanten Szenen und beurteilt dann für jede gewählte Szene bis zu 12 ihrer Originalnachrichten, nämlich ihre besten Texttreffer, um den Auszug dieser Szene auszuwählen. Die beste Wahl bildet den Mittelpunkt, die übrigen verlängern den Auszug bis zu **Maximum messages per excerpt** (maximale Nachrichten pro Auszug). Akzeptiert es keine Nachricht einer Szene, legt der Textabgleich den Mittelpunkt des Auszugs fest, und der Abrufbericht weist darauf hin. Passt in einer Szene keine dieser Nachrichten für sich allein in den Platz, den die Zusammenfassungen übrig lassen, kann diese Szene keinen Auszug erhalten; das Modell beurteilt ihre Nachrichten dann gar nicht erst. Gilt das für alle gewählten Szenen, entfällt die zweite Anfrage. Unsichere Grenzen lassen die Szene offen. Das **Helper model** schreibt weiterhin alle Zusammenfassungen und Kontinuitätsaktualisierungen. Bestehende Grenzen für Szenenanzahl, Auszugslänge, Charakterzugriff und Tokenbudgets gelten weiter. Eine gültige Entscheidung darf nichts auswählen.

Gehostete Anbieter erhalten den jüngsten Gesprächsverlauf und die vorausgewählten Zusammenfassungen oder Nachrichten zur Bewertung. Pro Antwort können mehrere kostenpflichtige Anfragen entstehen. Vor dem Senden prüft der Abruf den Charakterzugriff und wertet Bedingungen für private Zusammenfassungsabschnitte aus. Von einer Szene sendet er nur Originalnachrichten, die die abrufenden Charaktere im Chat gesehen haben, und jeder Charakter erhält weiterhin nur die Teile einer Zusammenfassung, die für ihn bestimmt sind. Anfragen werden in begrenzte Pakete innerhalb des Kontextbudgets der Verbindung aufgeteilt; das beworbene Kontextfenster eines Jev-Chat-Routers wird nicht als Grenze für Entscheidungsanfragen angenommen.

Jeder Abrufdurchgang hat ein eigenes Entscheidungslimit von 10 Sekunden. Fehlende Verbindungen, unvollständige Antworten, zu große Kandidaten, Fehler und Zeitüberschreitungen führen zum normalen Abruf: Die eigene Rangfolge der Vorauswahl bestimmt die Szenen, der Textabgleich die Auszüge. Nicht verfügbare Szenenentscheidungen führen zum bisherigen Szenenprüfer. Bei aktivierter Option indiziert die Vorbereitung Text ohne neue Embeddings. Vorhandene Vektoren bleiben als Rückfall verfügbar. Nutze nach dem Ausschalten **Reindex**, wenn du Embeddings für im Entscheidungsmodus vorbereitete Einträge möchtest.

Die Prompt-Inspektion bleibt schreibgeschützt und zeigt normalen Abruf ohne Aufruf des Entscheidungsanbieters. Unter **Peek Prompt → Decision diagnostics** (Peek Prompt → Entscheidungsdiagnose) zeigt **Advanced Memory activity** (Advanced-Memory-Aktivität) gespeicherte Ergebnisse des letzten Abrufs und der letzten Szenenendprüfung: Modell, Zeit, Werte, ausgewählte Erinnerungen oder Enden, verwendetes Ersatzverfahren und warum eine abgerufene Szene keinen Auszug hat. Berichte werden für neue Aufrufe nach diesem Update gespeichert und enthalten bis zu 128 Ergebnisse, ausgewählte zuerst. Sie beschreiben vergangene Aktivität, keine Vorhersage für die Vorschau. Weder das Öffnen des Panels noch ein Test von Prompt-Aussagen führt Speicherentscheidungen erneut aus. Szenenendprüfungen durch das Decision-Modell verwenden immer eine eigene Anfrage, getrennt von Tracker- und Agentenpaketen. Der Abrufbericht nennt Entscheidungen und Rückfälle. Kompatible Antwortvarianten und Fortsetzungen verwenden die gespeicherte Auswahl erneut; geänderte Einstellungen machen unvereinbare Speicherstände ungültig.

<a id="deciding-who-sees-new-messages"></a>

### Entscheiden, wer neue Nachrichten sieht

In einem Roleplay-Gruppenchat, in dem die Charaktere einzeln nacheinander antworten, kann Advanced Memory entscheiden, welche Charaktere jede neue Nachricht sehen. So musst du nicht jede Zeile selbst vor einem Charakter verbergen, der die Szene verlassen hat. Schalte dazu in Advanced Memory **Decide who sees new messages** (entscheiden, wer neue Nachrichten sieht) ein. Die Option ist standardmäßig aus und erscheint nur in Gruppenchats, in denen die Charaktere einzeln nacheinander antworten; Gruppenchats mit zusammengeführten Antworten und Chats mit nur einem Charakter bieten sie nicht an.

Ist sie an, wird jede neue Nachricht – deine oder die eines Charakters – vor den Charakteren verborgen, die nicht in dieser Szene sind. Das Ergebnis nutzt dasselbe charakterspezifische **Hide from AI** wie die Schaltfläche an der Nachricht selbst, daher zeigt die durchgestrichene Augenmarkierung, wer sie nicht sehen kann. Über deine eigene Nachricht wird entschieden, sobald du sie abschickst, auch wenn kein Charakter antwortet. Bevor der nächste Charakter antwortet, ist über die vorherigen Nachrichten bereits entschieden, sodass er nie eine Zeile liest, die er nicht lesen sollte.

- Der hier gewählte **Narrator** und der unter **Roleplay Commands** gewählte **Narrator character** (Erzählercharakter) sehen immer jede Nachricht. Wer eine Nachricht geschrieben hat, sieht sie immer. Ist der Empfänger einer Flüsternachricht nicht in der Szene, verliert er den Rest der Nachricht, erhält die Flüsternachricht aber trotzdem.
- Ist **Use Decision model** an, wird das Decision-Modell für jeden Charakter gefragt, ob er die Nachricht eindeutig nicht sehen oder hören kann, etwa weil er woanders ist oder die Szene verlassen hat. Ein Charakter, den die Geschichte nie in die Szene bringt, gilt als woanders. Ein anwesender Charakter, an den eine Flüsternachricht nicht gerichtet ist, sieht den Rest der Nachricht trotzdem. Sonst entscheidet das **Helper model**. In beiden Fällen wird eine Nachricht nur verborgen, wenn sich das Modell sicher ist; ist es unsicher, sieht der Charakter sie weiterhin. Ist nach einer Antwort eine Szenenprüfung fällig, klärt dieselbe Anfrage auch, wer anwesend ist, sodass für diese Nachrichten kein zusätzlicher Aufruf nötig ist.
- Das Modell liest die bisherigen Nachrichten der aktuellen Szene und immer mindestens die letzten paar davor, auch wenn gerade eine neue Szene begonnen hat. Außerdem erhält es eine Liste der Charaktere, die seit Beginn der aktuellen Szene gesprochen haben. Diese Liste ist nur ein Hinweis: Ein Charakter, der still zuhört, gilt trotzdem als anwesend, auch wenn er nichts gesagt hat.
- Änderst du bei einer Nachricht selbst **Hide from AI** oder wendest `/hide` oder `/unhide` auf sie an – vor oder nach der automatischen Auswahl –, bleibt deine Wahl bestehen, und Advanced Memory ändert diese Nachricht nie wieder. Nachrichten, die du bereits vor jemandem verborgen hattest, bleiben unangetastet.
- Über jede Nachricht wird nur einmal entschieden. Schlägt das Modell fehl oder antwortet es nicht rechtzeitig, wird bei dieser Nachricht nichts verborgen, und der Fehler erscheint im Server-Log.

### Während des Chats

Die Szenenerkennung läuft nach dem Speichern der Hauptantwort in Roleplay. **Standalone scene check interval (messages)** ist standardmäßig **5**. Der Prüfer erhält die nummerierten letzten Nachrichten, eine vorherige Nachricht als Kontext, Szenenanweisungen und das Ausgabeformat. Er nennt die genaue Abschlussnachricht jeder Szene oder keine Enden, wenn die Szene weiterläuft. Persona- und Charakternachrichten zählen beide. Der Rhythmus ist unabhängig von Tracker-Zeitplänen. Bei ausgeschaltetem Entscheidungsmodus teilt ein fälliger Check sich einen geeigneten nachgelagerten Tracker-Aufruf, wenn Quellsichtbarkeit und Kontextbudget passen; sonst ruft er das Hilfsmodell separat auf. Jeder neue Bereich beginnt nach dem vorherigen Szenenende und schließt das gemeldete Ende ein. Nur ein erkanntes Ende startet die Hintergrundvorbereitung von Zusammenfassung und Nachrichtenindex, auch wenn die neueste Antwort die Szene beendet. Unsichere Übergänge lassen sie offen. Der Abschnitt **Agent activity** in **Chat Settings** zeigt die Vorbereitung als **Advanced Recall** mit Fortschritt, Fehlern und Wiederaufnahme, auch bei ausgeschalteten normalen Agenten. Nur laufende Speicheraufgaben fragen Fortschritt ab; fertige Archive werden im Leerlauf nicht abgefragt. Bei aktiviertem Entscheidungsmodus übernimmt die ausgewählte Entscheidungsverbindung diese Prüfung.

Bei ausgeschaltetem Entscheidungsmodus: Normaler Abruf liest vorbereiteten Speicher. Ein optionales Anfrage-Embedding hat ein kurzes Zeitlimit und fällt auf Textabgleich zurück. Der Textabgleich gewichtet charakteristische Begriffe in der neuesten Nutzernachricht stärker, damit ein kurzes Detail eine lange Szenenzusammenfassung finden kann. Am stärksten zählt ein darin genannter Name, etwa der eines Haustiers. Die Namen der antwortenden Charaktere und deiner Persona zählen dagegen nicht, ebenso wenig ein Name, der in den meisten Erinnerungen vorkommt. Indizierte Originalnachrichten können Szenen auch dann finden, wenn die Ausgabe von Auszügen ausgeschaltet ist. Beides benötigt keinen zusätzlichen Modellaufruf. Abruf läuft ausschließlich für die Hauptgenerierung in Roleplay: Agenten, manuelle Agentenwiederholungen und zusätzliche Testgenerierungen starten ihn nicht und erhalten keine abgerufenen Zusammenfassungen oder Auszüge. Haupt-Prompt-Inspektion bleibt schreibgeschützt.

Neu generierte Varianten verwenden den frühesten kompatiblen Speicher derselben Antwort: Kontinuität, Szenenzusammenfassungen und genaue Auszüge. Unveränderte Varianten suchen nicht erneut und rufen keinen Zusammenfassungshelfer auf. Fortsetzen behält den ursprünglichen Speicher. Ältere Antworten ohne Momentaufnahme speichern eine bei ihrer nächsten Generierung und verwenden sie danach wieder; kein Zurücksetzen nötig. Hintergrundergänzungen und Zusammenführungen erhalten kompatible Momentaufnahmen. Benutzeränderungen an Verlauf, Zugriff, Zusammenfassungen oder Speicher machen unpassende Momentaufnahmen ungültig. Die aktuelle Kontextgrenze gilt immer. Eine neue Variante ruft außerdem erneut Erinnerungen ab, wenn seit dieser Antwort eine frühere Szene, die ihr Charakter abrufen konnte, gespeichert, bearbeitet, aktiviert oder deaktiviert wurde. Eine Szene, die noch zum Chatverlauf dieser Antwort gehört, lässt sich noch nicht abrufen; ihr Speichern löst daher keinen erneuten Abruf aus.

Die Hauptgenerierung liest gespeicherte Erinnerungen sofort. Sie startet keine Kontinuitätsgenerierung und wartet auch bei laufendem Hintergrundhelfer nicht darauf. Erreicht der ausgehende Prompt die Grenze, beginnt das Live-Fenster für **alle Charaktere** am Anfang der neuesten Szene und wächst bis zur nächsten Grenze. Der automatische Schnitt erscheint im bestehenden Menü **Mark as new start** mit ausgewähltem **All**; entferne All, um ihn rückgängig zu machen. Persönliche Startmarkierungen gelten weiterhin. Passt eine offene Szene oder übergroße Konstante nicht, verwendet die Anfrage ausdrücklich gekennzeichnete Quellauszüge und behält die neuesten Nachrichten. Diese vorübergehende Anpassung erzeugt keine weitere dauerhafte Markierung. Gespeicherte Zusammenfassungen und Originalnachrichten bleiben unverändert.

Nach der Hauptantwort ergänzt Advanced Memory bestehende bereichsbezogene **Chat Summaries** nur um noch nicht abgedeckte archivierte Nachrichten und verwendet fertige Szenenrückblicke möglichst erneut. Bestehende, auch inaktive Einträge gelten als bereits bearbeitete Bereiche. Überschreiten zugängliche aktive Konstanten 70% von **Summary and recall budget**, kombiniert **Updating continuity** nach der Antwort nur ihre Zusammenfassungstexte, mit dem ausgewählten Helfer und **Chat Summary → Maximum output size**. Konstanten mit Live-Nachrichten sind von Budget und Konsolidierung ausgeschlossen; ältere Einträge ohne Bereich bleiben zugänglich. Die Antwort, die den Schwellenwert überschreitet, entsteht normal mit gespeicherten zulässigen Konstanten, ohne auf die Kürzung zu warten. Die zusätzlichen 2,000 Tokens gelten für den Gesamtspeicher, nicht für den konstanten Anteil. Zusammenfassungen, die Advanced Memory mit privaten Teilen für einzelne Charaktere in `{{#if char == "Name"}}…{{/if}}`-Abschnitten geschrieben hat, werden mit den anderen Zusammenfassungen kombiniert, die dieselben Charaktere lesen. Der Helfer erhält sie samt diesen Bedingungen und deinem **Combine prompt** (Prompt zum Kombinieren) und muss jeden privaten Teil genau für die Charaktere bewahren, die ihn kannten. Würde sein Ergebnis ändern, wer einen privaten Teil lesen kann, wird es nicht gespeichert: Diese Zusammenfassungen bleiben, wie sie sind, und nur die übrigen werden gekürzt. Zusammenfassungen, die du selbst geschrieben oder bearbeitet hast, und andere mit je Charakter unterschiedlich aufgelösten Makros bleiben unverändert; überschreiten sie allein das Ziel, müssen sie manuell bearbeitet werden. Andere Gruppen erhalten proportionale Längenvorgaben statt einer harten Ablehnungsgrenze. Ein kürzerer, vollständig erzeugter Ersatz erhält einen Nachrichtenbereich als Titel und wird zusammen mit der Deaktivierung der ersetzten Einträge gespeichert. Fehlgeschlagene oder unvollständige Ergebnisse werden nicht gespeichert; bestehende Einträge bleiben nutzbar und **Resume processing** wiederholt unerledigte Arbeit. Szenenrückblicke bleiben im Tresor.

Das Archiv ruft passende Szenenzusammenfassungen und genaue Dialoge mit ursprünglichen Nachrichtennummern und Sprechern ab. Ein Abschnitt **Recalled Scenes** enthält jede Zusammenfassung unmittelbar vor ihrem verfügbaren Auszug mit einer gemeinsamen Bereichsüberschrift. Szenen ohne Auszug bleiben darin. Der Block nennt den aktuellen Live-Bereich und die letzte Nutzernachricht. Szenenrückblicke kommen nur hinzu, wenn alle Quellen außerhalb der gesendeten Live-Historie liegen; auch Auszüge schließen Live-Nachrichten aus. Bereichsbezogene **Chat Summaries** werden ebenfalls ausgelassen, solange eine ihrer Nachrichten live bleibt. Sie bleiben gespeichert und aktiviert und werden wieder zulässig, sobald der ganze Bereich archiviert ist. Zulässige Konstanten haben Vorrang vor optionalem Abruf und behalten ihre Charakterbedingungen. Alle ausgewählten Szenenzusammenfassungen reservieren Platz vor den Auszügen. Charakterzugriff und historische Quellgrenzen gelten weiter. Illustrationsanhänge und Bildbeschriftungen fehlen in abgerufenen Nachrichten und neuen Zusammenfassungseingaben; lesbare Textanhänge bleiben verfügbar. Persona- und Charakternachrichten zählen beide. Historische Neugenerierung nutzt nur Quellen vor der Zielantwort, auch vor dem verwalteten Fenster. Bearbeiten, Swipen, Verbergen oder Löschen von Quellen löst vor der Nutzung eine erneute Prüfung abgeleiteter Erinnerungen aus.

Öffne **Access memories for this chat** in derselben Seitenleiste, um chronologisch nummerierte Szenenzusammenfassungen zu durchsuchen, ihre Zeiträume und Empfängerkreise zu prüfen, **Summary text** (Zusammenfassungstext) zu bearbeiten oder mit **Inspect source messages** (Quellnachrichten prüfen) die vollständigen Originalnachrichten zu lesen. Interne wortgetreue Auszüge sind keine eigenen Szenenzusammenfassungen. Quellenbasierte Zeitangaben der Handlung begleiten den abgerufenen Kontext; unbekannte Daten bleiben unbekannt. Du kannst Abrufdatensätze deaktivieren, neu indexieren, exportieren/importieren oder **Delete all memories** (alle Erinnerungen löschen) bestätigen, um die Vorbereitung neu zu beginnen und dabei Originalchat und Einstellungen zu behalten. Korrekturen ursprünglicher manueller Zusammenfassungen bleiben erhalten und machen davon abhängige Kontinuität ungültig. Um eine Szene vom Abruf auszuschließen, deaktiviere ihren Erinnerungseintrag. Charakterspezifisches Ausblenden der Quellen steuert weiterhin den Zugriff; globales Ausblenden entfernt sie nicht aus dem Archiv.

Jede Szenenzusammenfassung hält außerdem fest, wer daran teilgenommen hat. Weicht ein Teilnehmername von der Charakterkarte ab, etwa „Kaito“ für **Kaito Nakamura**, zählt er trotzdem, wenn er auf genau einen Charakter passt und nicht der Name deiner Persona sein kann. Namen, die zwei Charaktere oder ein Charakter und deine Persona gemeinsam haben, Beschreibungen wie „Kaitos Schwester“ und Namen mit Anmerkungen wie „(erwähnt)“ geben einem Charakter nie Zugriff. Der Name deiner eigenen Persona ist kein Fehler und gibt keinem Charakter Zugriff. Sagt der Helfer nicht, wer beteiligt war, geht die Szene an alle Charaktere: in einem Chat mit nur einem Charakter an diesen einen, in einem Gruppenchat an alle. In einem Gruppenchat zählt Advanced Memory das dann als Gedächtnisproblem und markiert die Szene in **Access memories** mit **Check who was there**. So kannst du mit **Edit character access** (Charakterzugriff bearbeiten) alle entfernen, die nicht dabei waren, oder **Fix** den Helfer erneut fragen lassen. Namen, die zu keinem Charakter passen, geben keinen Zugriff und werden genauso markiert, damit du die Teilnehmer der Szene festlegen kannst. Gibt der Helfer ausdrücklich an, dass nur du in einer Szene vorkommst, bleibt sie dem Erzähler vorbehalten. Szenenzusammenfassungen, die gespeichert wurden, bevor es Teilnehmerprüfungen gab, bleiben bis zu ihrer Prüfung dem Erzähler vorbehalten: **Fix** und **Prepare existing history** prüfen sie alle, und jede Antwort, die eine Szene abschließt, prüft zusätzlich bis zu drei davon. Eine Szene, deren automatische Prüfung fehlschlägt, wartet auf **Fix** oder **Prepare existing history**.

Ein Charakter, der nur an einem Teil einer Szene teilgenommen hat, kann den Zugriff auf ihre Erinnerung mit anderen Beteiligten teilen, auch wenn einige Nachrichten vor ihm verborgen sind. Eine Szene ohne zugängliche Quellnachrichten bleibt unzugänglich. Neue Anweisungen für Zusammenfassungen kennzeichnen die Sichtbarkeit der Nachrichten, beschreiben gemeinsame Ereignisse als normalen Text und verwenden `{{#if character == "Name"}}…{{/if}}` nur für private Abschnitte. Die Erwähnung eines abwesenden Charakters macht ihn nicht zum Teilnehmer. Ändert sich die Sichtbarkeit der Quellen oder der Name eines Charakters, für den die Zusammenfassung geschrieben wurde, bleibt eine alte Zusammenfassung für Leser mit Teilzugriff gesperrt, bis du die Szene erneut vorbereitest (**Fix** erledigt das für jede solche Szene) oder ihre privaten Bedingungen prüfst und den korrigierten Text speicherst. Ein Charakter, der dem Chat erst später hinzugefügt wird, zählt nicht als Änderung, es sei denn, nur ein Teil der Szene ist für ihn sichtbar. Zusammenfassungen, die frühere Versionen gespeichert haben, halten nicht fest, für welche Charaktere sie geschrieben wurden; sie brauchen deshalb einmal **Fix**, nachdem ein Charakter hinzugekommen ist. Ältere Zusammenfassungen ohne gespeicherte Sichtbarkeitsinformationen brauchen vor einem Teilzugriff dieselbe Prüfung; nur die Zielgruppe zu ändern bestätigt den Text nicht. Leser mit Zugriff auf jede Quellnachricht können die Erinnerung weiterhin abrufen, und manuell korrigierter Text wird nie stillschweigend umgeschrieben. Diese Prüfungen rufen beim Abruf kein Modell auf. Datum und Zeitraum einer Szene sind gemeinsame Metadaten für alle zugewiesenen Teilnehmer, auch wenn einzelne Quellnachrichten verborgen sind. Wörtliche Auszüge enthalten nie vor einem Charakter verborgene Nachrichten oder Flüsternachrichten. Auch eine Zusammenfassung mit Teilen, die nur für einzelne Charaktere bestimmt sind, erhält einen Auszug: Er zitiert nur die Nachrichten, die der jeweilige Charakter im Chat gesehen hat, und verrät ihm daher nichts, was er nicht schon gesehen hat. Um eine Nachricht aus der Erinnerung eines Charakters herauszuhalten, verbirg sie vor diesem Charakter. Konstante Chat Summaries enthalten weiterhin vor der KI verborgene Nachrichten; Charakterbedingungen regeln den Zugriff auf private Details, ohne diese Nachrichten aus dem zusammengefassten Bereich zu entfernen.

In einem Gruppenchat mit zusammengeführten Antworten kann eine einzige Antwort für alle Charaktere sprechen. Der Abruf umfasst daher alles, woran sich mindestens ein Charakter im Chat erinnert. Szenen und private Teile von Zusammenfassungen, die nicht jeder Charakter im Chat kennt, werden mit den Charakteren gekennzeichnet, die sie kennen, etwa „known only to Kaito“ (nur Kaito bekannt). Kommt mitten im Chat ein Charakter hinzu, verbirgt das frühere Erinnerungen nicht mehr vor den anderen. Eine vor einem Charakter verborgene Nachricht fehlt weiterhin im gemeinsamen Live-Verlauf, doch die Charaktere, die sie sehen konnten, behalten die Erinnerung, als ihre eigene gekennzeichnet. Der Auszug einer abgerufenen Szene zitiert nur Nachrichten, die jeder Charakter gesehen hat, der sich an diese Szene erinnert. Erinnerungen, die kein Charakter im Chat hat, etwa dem Erzähler vorbehaltene Szenen, bleiben außen vor. In Gruppenchats, in denen die Charaktere einzeln nacheinander antworten, ruft jeder Charakter weiterhin nur seine eigenen Erinnerungen ab.

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

Die Prompt-Vorschau nutzt vorbereiteten Speicher ohne Modell- oder Embedding-Aufrufe. Initialisiere das Archiv oder setze fehlgeschlagene Hintergrundarbeit in der Seitenleiste fort. Der Speicherbeleg zeigt geschätzte Kontextgröße, gewählte Grenze und Quellen. Wurde nichts abgerufen, gibt er an, ob keine früheren Szenen zum Abrufen verfügbar waren, ob in der Anfrage kein Platz mehr blieb oder ob nichts relevant war. Der abschließende Prompt-Inspektor zeigt die tatsächlich gesendete Anfrage.

### Grenzen und Wiederherstellung

Abruf ist selektiv und Zusammenfassungen können Nuancen verlieren. Bewahre wichtige Korrekturen im Quelltranskript oder Zusammenfassungseditor auf. Kein System rekonstruiert nie erfasste Details. Fallen Embeddings aus, bleiben begrenzter lexikalischer Abruf und gültige Kontinuität verfügbar; das Archiv wird nie vollständig eingefügt. Passen Pflichtanweisungen oder ein Anhang nicht in die Prompt-Grenze, verkleinere sie oder erhöhe die Grenze. Passt die Antwortreserve nicht in den Gesamtkontext des Modells, senke die Ausgabegröße oder wähle ein Modell mit größerem Kontext. Advanced Memory stoppt, statt Anweisungen still zu löschen.

<a id="chat-summary-roleplay"></a>

## Chat Summary (Roleplay)

**Chat Summary** presst ältere Nachrichten zu kurzen erzählerischen Rückblicken zusammen, den sogenannten Summary Entries. Jeder Eintrag stammt entweder von der KI oder von dir selbst, und jeder lässt sich einzeln an- und abschalten. Die Funktion gibt es nur in Roleplay-Chats. Das Speichern eines Schalters lässt andere Einträge bedienbar; Activate All und Deactivate All speichern die Auswahl gemeinsam.

Öffne **Chat Settings** und klapp den Abschnitt **Chat Summary** unter **Lorebooks** auf. Am Computer kannst du ihn in einem eigenen Fenster öffnen (siehe [Chat Settings im Überblick](../chats/chat-settings.md#popping-a-section-out-into-its-own-window)).

### Einen Summary Entry anlegen

1. Wähl unter **Summary Scope** entweder **Last**, um die neuesten Nachrichten zusammenzufassen, oder **Range** für einen bestimmten Nachrichtenbereich.
2. Klick auf **Generate**, damit die KI daraus einen Eintrag schreibt.
3. Oder klick auf **Write**, um einen leeren Eintrag anzulegen und den Rückblick selbst zu tippen.

Jeder Eintrag in der Liste zeigt einen Titel, den Quellbereich oder die Anzahl der Nachrichten sowie die geschätzte Größe in Tokens. Einträge lassen sich aktivieren und deaktivieren, ausklappen, über **Edit** bearbeiten oder mit **Delete** entfernen. Sammel-Schaltflächen blenden inaktive Einträge mit **Show Inactive** und **Hide Inactive** ein oder aus und schalten mit **Activate All** und **Deactivate All** alle auf einmal um.

Hak Einträge an, um sie auszuwählen. Am Computer wählst du mit Shift-Klick auf einen weiteren Eintrag den sichtbaren Bereich dazwischen aus. Mit **Enable selected** oder **Disable selected** änderst du dann nur die ausgewählten Einträge.

In einem Gruppenchat mit zusammengeführten Antworten kann eine einzige Antwort für alle Charaktere sprechen. Teile eines Eintrags, die für bestimmte Charaktere geschrieben sind, etwa `{{#if char == "Kaito"}}…{{/if}}`, bleiben für jeden Charakter im Chat erhalten, für den sie gelten, und werden mit den Charakteren gekennzeichnet, die sie kennen, etwa „known only to Kaito“ (nur Kaito bekannt). Teile, die nur der **Narrator** von Advanced Memory erhält, bleiben außen vor. In Gruppenchats, in denen die Charaktere einzeln nacheinander antworten, und in Chats mit nur einem Charakter liest jeder Charakter die Einträge wie bisher.

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

Die Bedienelemente unter **Display** in **Chat Summary** bestimmen, wie zusammengefasste Nachrichten auf dem Bildschirm erscheinen:

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
