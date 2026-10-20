# Semantische Suche für Lorebooks

In dieser Anleitung erfährst du, wie die semantische Suche für Lorebooks in Marinara Engine funktioniert. Ein Lorebook ist eine Sammlung von Weltwissen. Mit semantischer Suche wird ein Lorebook-Eintrag nach Bedeutung aktiv, nicht nur bei exakten Schlüsselwörtern. Du richtest eine Embedding-Quelle ein, vektorisierst die Einträge und stellst die Trefferschwelle ein.

## Was die semantische Suche zusätzlich leistet

Ein Lorebook besteht aus Einträgen. Jeder Eintrag hat auslösende Schlüsselwörter und einen Textblock. Normalerweise wird ein Eintrag nur aktiv, wenn eines seiner exakten Schlüsselwörter im jüngsten Chat auftaucht. Steht dort ein anderes Wort, bleibt der Eintrag stumm.

Genau das löst die semantische Suche. Sie vergleicht die Bedeutung des jüngsten Chats mit der Bedeutung der Einträge. Ein Eintrag wird dann auch ohne exakten Schlüsselwort-Treffer aktiv. Ein Eintrag mit dem Schlüsselwort „sword“ passt so zum Beispiel auch auf eine Nachricht, in der nur „blade“ steht.

Dahinter stecken Embeddings. Ein Embedding ist eine numerische Darstellung von Text – eine Zahlenreihe, die dessen Bedeutung erfasst. Marinara speichert pro Eintrag ein Embedding, auch Vektor genannt. Dieser Schritt heißt Vektorisierung. Im Chat berechnet Marinara ein Embedding für die letzten Nachrichten und sucht die Einträge mit der ähnlichsten Bedeutung.

Die Schlüsselwort-Suche bleibt bei aktiver semantischer Suche bestehen. Die semantische Suche liefert nur zusätzliche Treffer. Sie ersetzt die Schlüsselwörter nicht.

Beim Anwenden der Eintrags- und Token-Budgets eines Lorebooks behandelt Marinara Schlüsselwort- und semantische Treffer gleichrangig. Passen nicht alle Treffer hinein, entscheidet die von dir festgelegte Reihenfolge der Einträge – die Art der Auslösung gibt nicht den Ausschlag.

## Vorbereitung: Embedding-Quelle auswählen

Die semantische Suche braucht ein Modell, das Embeddings erzeugen kann. Dafür gibt es zwei Wege.

Du kannst die Quelle, für die du dich entscheidest, zum Standard für die ganze App machen: Öffne **Connections** (Verbindungen), dann **Defaults** (Standardwerte), und wähle sie unter **Embeddings**. Jede Verbindung, die kein eigenes Embedding-Modell und keine eigene **Embedding Connection** (Embedding-Verbindung) festlegt, verwendet sie dann. Die Einstellung einer Verbindung hat weiterhin Vorrang, und die Zeile zeigt dir, wie viele Verbindungen stattdessen ihre eigenen Einstellungen nutzen. Mit **None** bleibt das eingebaute lokale Modell als Rückfall erhalten.

Weg 1: eine Verbindung mit Embedding-Modell.

1. Öffne das Panel **Connections** (Verbindungen).
2. Öffne eine Verbindung zum Bearbeiten.
3. Suche den Abschnitt **Semantic Search (Embeddings)** (semantische Suche).
4. Trag im Modellfeld den Namen eines Embedding-Modells ein. Gängig ist `text-embedding-3-small`.
5. Speichere die Verbindung.

Eine Verbindung kann ihre Embedding-Anfragen auch über den API-Key und die Adresse einer anderen Verbindung schicken. Wähle diese Verbindung im selben Abschnitt unter **Embedding Connection**. Der Standard ist **Same as this connection** (wie diese Verbindung). Hat die gewählte Verbindung ein eigenes Embedding-Modell, nutzt Marinara dieses; andernfalls das hier eingetippte Modell. Das gilt sowohl beim Vektorisieren als auch im Chat.

Nicht jeder Anbieter bietet Embeddings an. Kann der Anbieter das nicht, weist dich der Editor darauf hin, stattdessen eine eigene Embedding-Verbindung zu wählen.

Weg 2: das eingebaute lokale Modell.

Marinara kann ein kleines Embedding-Modell direkt auf dem eigenen Rechner ausführen, ganz ohne API-Key. Im Dropdown-Menü des Lorebooks heißt diese Option **Local Model (sidecar)**. Sie erscheint erst, nachdem du das lokale Modell heruntergeladen hast. Wie du es installierst, steht unter [Lokales Modell einrichten](../connections/local-model.md).

In einem Marinara-Lite-Build ist die Option **Local Model (sidecar)** ausgeblendet. Unter Lite braucht die semantische Suche eine Verbindung mit Embedding-Modell.

## Vectors für ein Lorebook aktivieren

Bei neuen Lorebooks ist die semantische Suche standardmäßig aus. Du aktivierst sie pro Lorebook.

1. Öffne das Lorebook, das nach Bedeutung durchsucht werden soll.
2. Bleib auf dem Tab **Overview** (Übersicht).
3. Suche den Schalter **Vectors** (Vektoren) und aktiviere ihn.

Der Hilfetext zu **Vectors** lautet: "When on, entries in this lorebook may use semantic embeddings. When off, keyword matching still works and vectorization skips this lorebook."

Solange **Vectors** aus ist, zeigt das semantische Panel diesen Hinweis: "Semantic search is disabled by the lorebook-level Vectors toggle."

## Das Panel Semantic Search (Embeddings)

Ist **Vectors** aktiv, erscheint auf dem Tab **Overview** das Panel **Semantic Search (Embeddings)**. Ein Status-Chip zeigt, wie viele Einträge vektorisiert sind, etwa "8/12 entries vectorized". Sobald alle Einträge fertig sind, wird er grün und bekommt ein Häkchen.

Das Panel hat drei Zahlenwerte.

| Einstellung | Wirkung | Standard | Bereich |
|---|---|---|---|
| **Query Messages** | Wie viele der letzten Chat-Nachrichten für die Suche in diesem Lorebook eingebettet werden. | 10 | 0 bis 100 |
| **Score Threshold** | Mindestähnlichkeit (kalibriert), die ein Eintrag zum Auslösen braucht. Höher heißt strenger. | 0.3 | 0 bis 1 |
| **Vector Limit** | Höchstzahl semantischer Treffer, die dieses Lorebook zu einer Generierung beisteuert. | 10 | 1 bis 100 |

Steht **Query Messages** auf 0, durchsucht Marinara den kompletten Chatverlauf statt nur der letzten Nachrichten.

**Score Threshold** legt fest, wie nah sich die Bedeutungen sein müssen. Ein niedriger Wert wie 0.2 lässt mehr Einträge durch, holt aber auch Themenfremdes herein. Ein hoher Wert wie 0.5 ist strenger und trifft nur enge Bedeutungen. Beginne mit dem Standard und passe nach, wenn es zu viele oder zu wenige Treffer gibt.

Marinara kalibriert diesen Wert gegen mehrere zusammenhanglose, neutrale Textpassagen aus demselben Embedding-Modell. Das entfernt den ungewöhnlich hohen gemeinsamen Cosinus-Sockel, den manche lokalen und OpenAI-kompatiblen Embedding-Backends erzeugen – dort landen selbst unzusammenhängende Texte sonst alle bei etwa 0.95 oder darüber. So bleibt die Einstellung über verschiedene Embedding-Modelle hinweg brauchbar, statt einen modellspezifischen Grenzwert nahe 1.0 zu verlangen.

**Vector Limit** begrenzt ausschließlich die semantischen Treffer. Die normalen Token-Budgets gelten zusätzlich.

## Einträge vektorisieren

Vektorisieren heißt: für jeden Eintrag ein Embedding berechnen und speichern. Ohne diesen Schritt funktioniert die semantische Suche nicht.

1. Aktiviere **Vectors** für das Lorebook.
2. Wähle im Panel **Semantic Search (Embeddings)** im Dropdown-Menü eine Embedding-Quelle. Die erste Option ist **No semantic search** (keine semantische Suche). Danach folgt **Local Model (sidecar)**, sofern verfügbar. Anschließend stehen die geeigneten Verbindungen.
3. Klick auf die Schaltfläche zum Vektorisieren. Fehlt einigen Einträgen der Vektor, heißt sie **Vectorize N missing**, zum Beispiel "Vectorize 5 missing".
4. Warte, bis der Durchlauf fertig ist. Der Status-Chip zeigt danach alle Einträge als vektorisiert.

Hat keine Verbindung ein Embedding-Modell oder eine **Embedding Connection**, erscheint statt des Dropdown-Menüs dieser Hinweis: "No connections with an embedding model configured. Set an Embedding Model on a connection first." Richte dann zuerst eine Embedding-Quelle ein, wie oben beschrieben.

Haben bereits alle Einträge einen Vektor, heißt die Hauptschaltfläche **Re-vectorize N entries**. Damit werden sämtliche gespeicherten Vektoren neu berechnet. Vor dem Überschreiben fragt Marinara nach.

Eine eigene Schaltfläche **Re-vectorize all** erscheint, wenn manche Einträge Vektoren haben und andere noch nicht. Damit baust du alles in einem Durchlauf neu auf.

Um die gespeicherten Vektoren zu löschen, klick auf **Delete vectors**. Das entfernt nur die Embeddings. Eintragstexte und Schlüsselwörter bleiben unverändert. Die Schlüsselwort-Suche funktioniert auch nach dem Löschen weiter.

### Einen einzelnen Eintrag auslassen

Du kannst einen einzelnen Eintrag von der Vektorisierung ausnehmen und den Rest normal behandeln. Öffne den Eintrag und aktiviere dort den Schalter **No Vector** (kein Vektor). Sein Hilfetext lautet: "When enabled, bulk vectorization skips this entry and removes any stored embedding." Dieser Eintrag wird weiterhin über Schlüsselwörter aktiv – nur eben nicht über die Bedeutung.

## Neu vektorisieren nach einem Modellwechsel

Die gespeicherten Vektoren gehören fest zu dem Embedding-Modell, das sie erzeugt hat. Wechselst du das Embedding-Modell, passen die alten Vektoren womöglich nicht mehr.

Berechne nach jedem Wechsel des Embedding-Modells alle Vektoren neu. Nutze **Re-vectorize N entries** oder **Re-vectorize all**, damit alle Einträge dasselbe Modell verwenden.

Führe nach einem Modellwechsel keinen Teildurchlauf aus. Liefert ein Durchlauf für nur fehlende Einträge eine andere Vektorgröße als die gespeicherten Vektoren, lehnt der Server ihn mit dieser Meldung ab: "Embedding dimensions changed. Use Re-vectorize all entries instead of only missing entries before switching embedding models."

Ein stiller Fehlerfall ist wichtig zu kennen. Im Chat bettet Marinara die letzten Nachrichten mit einem Abfragemodell ein. Das Abfragemodell ist das Embedding-Modell der aktiven Verbindung oder, falls sie eines festlegt, das Modell ihrer **Embedding Connection**. Legt die Verbindung keins von beiden fest, verwendet Marinara den **Embeddings**-Standard unter **Defaults** in **Connections** oder, wenn dort **None** steht, das eingebaute lokale Modell. Das Abfragemodell kann eine andere Vektorgröße liefern als das Modell, das die Einträge vektorisiert hat. Marinara überspringt diese Einträge dann bei der semantischen Suche. Eine Fehlermeldung siehst du nicht. Vektorisiere die Einträge deshalb mit derselben Embedding-Quelle, die auch im Chat zum Einsatz kommt. Ein **Embeddings**-Standard hilft: Die Auswahl beim Vektorisieren startet darauf, solange du vorher nichts anderes gewählt hast, und Verbindungen ohne eigene Embedding-Einstellungen fragen damit ab. Und vektorisiere nach jedem Modellwechsel neu.

## Was der Knowledge-Router-Agent davon hat

Die semantische Suche hilft auch dem Agenten **Knowledge Router**. Dieser Agent wählt bei großen Lorebooks die passenden Einträge aus und fügt sie in den Prompt ein. Ist ein Lorebook vektorisiert, stellt der Router seine Vorauswahl an Kandidaten aus semantischen Treffern und Schlüsselwort-Treffern zusammen.

Für den Router ist dieser Schritt optional. Ist das Lorebook nicht vektorisiert oder keine Embedding-Quelle verfügbar, arbeitet er allein mit Schlüsselwort-Treffern. Die Vektorisierung liefert ihm schlicht eine bessere Vorauswahl. Wie dieser Agent arbeitet, steht unter [Wissensquellen: Retrieval- und Router-Agenten](../agents/knowledge-sources.md).

## Verwandte Anleitungen

- [Lorebooks im Überblick](overview.md)
- [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md)
- [Lokales Modell einrichten](../connections/local-model.md)
- [Wissensquellen: Retrieval- und Router-Agenten](../agents/knowledge-sources.md)
