# Semantische Suche für Lorebooks

Mit der semantischen Suche wird ein Lorebook-Eintrag über seine Bedeutung aktiv, nicht nur bei exakten Schlüsselwörtern. Ein Eintrag mit dem Schlüsselwort „sword“ passt dann auch auf eine Nachricht, in der „blade“ steht. Nutze sie, wenn du für dieselbe Idee viele verschiedene Wörter verwendest.

Sie arbeitet mit Embeddings, also Zahlenreihen, die die Bedeutung eines Texts erfassen. Marinara speichert für jeden Eintrag ein Embedding, auch Vektor genannt. Das Erzeugen dieser Embeddings heißt Vektorisieren. Im Chat berechnet Marinara ein Embedding für deine letzten Nachrichten und sucht die Einträge, die ihnen am nächsten kommen.

Die semantische Suche liefert zusätzliche Treffer. Deine Schlüsselwörter funktionieren weiter. Unter den Budgets haben Schlüsselwort- und semantische Treffer den gleichen Rang. Passt nicht alles hinein, entscheidet der Wert **Order** (Reihenfolge) der Einträge.

## Die semantische Suche einrichten

Du brauchst zuerst eine Embedding-Quelle, dann den Schalter **Vectors** (Vektoren) und dann einen Vektorisierungsdurchlauf.

### Schritt 1: Eine Embedding-Quelle wählen

Bevor du anfängst: Du brauchst entweder ein Konto, dessen Dienst Embeddings anbietet, oder das eingebaute Modell. Nicht jeder Dienst bietet Embeddings an. Tut deiner das nicht, weist dich der Editor darauf hin, ein eigenes Embedding-Konto zu wählen.

Weg 1: ein Konto mit Embedding-Modell.

1. Öffne das Panel **Connections** (Verbindungen) und öffne ein Konto zum Bearbeiten.
2. Öffne **Advanced** (Erweitert), dann **More** (Mehr), und suche **Semantic search (embeddings)** (semantische Suche).
3. Gib den Namen eines Embedding-Modells ein, etwa `text-embedding-3-small`. Bist du dir beim Namen unsicher, schau in der Dokumentation deines Dienstes nach oder nimm stattdessen das eingebaute Modell.
4. Speichere das Konto.
5. Klick zur Prüfung auf **Test embedding** (Embedding testen). Marinara speichert zuerst, bettet einen kurzen Beispieltext ein und zeigt die Vektorgröße an, etwa „1536 dimensions“, oder den Fehler, den der Dienst zurückgegeben hat.

Um Embedding-Anfragen über den Key und die Adresse eines anderen Kontos zu schicken, wähle dieses Konto unter **Embedding provider** (Embedding-Anbieter). Der Standard ist **Same as this provider** (wie dieser Anbieter). Hat das gewählte Konto ein eigenes Embedding-Modell, nutzt Marinara dieses. Andernfalls nutzt es den hier eingetippten Modellnamen.

Weg 2: das eingebaute Modell. Es läuft auf deinem Rechner, braucht keinen API-Key und heißt in der Auswahl **Built-in model** (eingebautes Modell). Es erscheint, nachdem du es heruntergeladen hast, und ist in Lite-Builds ausgeblendet. Siehe [Eingebautes Modell einrichten](../connections/local-model.md).

Um eine Quelle zum Standard für jedes Konto zu machen, das keine eigene festlegt, öffne **Connections** und wähle sie in der Aufgabe **Embeddings**. Die Einstellung eines Kontos hat weiterhin Vorrang. Der Standardeintrag **Marinara's own search** (Marinaras eigene Suche) behält den eingebauten Rückfall bei.

### Schritt 2: Vectors einschalten

Bei neuen Lorebooks ist die semantische Suche aus.

1. Öffne das Lorebook und bleib auf dem Tab **Overview** (Übersicht).
2. Schalte **Vectors** ein. Ist der Schalter an, lassen sich Einträge auch über ihre Bedeutung finden. Ist er aus, funktionieren Schlüsselwörter weiter, und das Lorebook wird nicht vektorisiert.

Solange **Vectors** aus ist, zeigt das Panel „Semantic search is disabled by the lorebook-level Vectors toggle.“

### Schritt 3: Die Einträge vektorisieren

1. Wähle im Panel **Semantic search (embeddings)** im Dropdown-Menü eine Quelle. Die erste Option ist **No semantic search** (keine semantische Suche). Danach folgt **Built-in model**, sofern verfügbar, und dann deine geeigneten Konten.
2. Klick auf **Vectorize N missing**, zum Beispiel „Vectorize 5 missing“.
3. Warte. Ein Chip zeigt den Fortschritt, etwa „8/12 entries vectorized“, und wird grün, sobald alle fertig sind.

Wenn es nicht funktioniert hat: Hat kein Konto ein Embedding-Modell, zeigt das Panel „No connections with an embedding model configured. Set an Embedding Model on a connection first.“ Schließ Schritt 1 ab und versuch es erneut.

## Das Panel Semantic search (embeddings)

Nachdem du **Vectors** eingeschaltet hast, erscheint das Panel auf dem Tab **Overview** mit diesen Einstellungen.

| Einstellung | Wirkung | Standard | Bereich |
| --- | --- | --- | --- |
| **Query Messages** | Mit wie vielen deiner letzten Nachrichten gesucht wird. 0 nutzt alle verfügbaren Nachrichten. | 10 | 0 bis 100 |
| **Score Threshold** | Die Ähnlichkeit, die ein Eintrag zum Aktivieren braucht. Höher heißt strenger. | 0.3 | 0 bis 1 |
| **Vector Limit** | Die Höchstzahl an Einträgen, die dieses Lorebook in einer Antwort über die Bedeutung beisteuern kann. | 10 | 1 bis 100 |

**Include character context** (Charakterkontext einbeziehen) durchsucht zusätzlich die letzten Antworten der Charaktere, getrennt von deinen Nachrichten, und behält den stärkeren Treffer. Die Option bettet zusätzlichen Text ein und ist standardmäßig aus. **Query Messages** gilt dann auch für die Antworten der Charaktere.

Ein niedriger **Score Threshold** wie 0.2 lässt mehr Einträge durch, riskiert aber themenfremde Treffer. Ein hoher wie 0.5 trifft nur eng verwandte Bedeutungen. Beginne mit dem Standard.

**Vector Limit** zählt nur Treffer über die Bedeutung. Deine normalen Token-Budgets gelten weiterhin.

## Neu vektorisieren, löschen und auslassen

- **Re-vectorize N entries** erscheint, wenn jeder Eintrag einen Vektor hat. Die Schaltfläche berechnet nach deiner Bestätigung alle Vektoren neu.
- **Re-vectorize all** erscheint, wenn manche Einträge Vektoren haben und andere nicht. Damit baust du alles in einem Durchlauf neu auf.
- **Delete vectors** entfernt nur die gespeicherten Vektoren. Eintragstexte und Schlüsselwörter bleiben, und die Schlüsselwörter funktionieren weiter.
- **No Vector** (kein Vektor) an einem Eintrag lässt ihn aus. Laut seinem Hilfetext überspringt das Vektorisieren aller Einträge diesen Eintrag und entfernt ein gespeichertes Embedding. Der Eintrag wird weiterhin über Schlüsselwörter aktiv.

### Nach einem Wechsel des Embedding-Modells

Gespeicherte Vektoren gehören zu dem Modell, das sie erzeugt hat. Nutze nach einem Modellwechsel **Re-vectorize N entries** oder **Re-vectorize all**, damit alle Einträge dasselbe Modell verwenden. Ein Durchlauf nur für fehlende Einträge, der eine andere Vektorgröße liefert, wird mit dieser Meldung abgelehnt: „Embedding dimensions changed. Use Re-vectorize all entries instead of only missing entries before switching embedding models.“

Ein Fehlerfall tritt ohne Meldung auf. Im Chat bettet Marinara deine Nachrichten mit dem Embedding-Modell des aktiven Kontos ein oder mit dem Modell aus seinem **Embedding provider**. Legt das Konto keins von beiden fest, nutzt Marinara die Quelle der Aufgabe **Embeddings** oder das eingebaute Modell. Weicht die Vektorgröße dieses Modells von den Vektoren deiner Einträge ab, überspringt Marinara diese Einträge bei der semantischen Suche und zeigt keinen Fehler. Vektorisiere mit derselben Quelle, die du im Chat nutzt, und vektorisiere nach jedem Modellwechsel neu.

## Semantische Suche und der Knowledge Router

Ist ein Lorebook vektorisiert, nutzt auch der Agent **Knowledge Router** Treffer über die Bedeutung, um seine Vorauswahl zusammenzustellen. Ohne Vektoren nutzt er nur Schlüsselwort-Treffer. Siehe [Wissensquellen: die Agenten Knowledge Retrieval und Knowledge Router](../agents/knowledge-sources.md).

## Verwandte Anleitungen

- [Lorebooks – Überblick](overview.md)
- [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md)
- [Eingebautes Modell einrichten](../connections/local-model.md)
- [Wissensquellen: die Agenten Knowledge Retrieval und Knowledge Router](../agents/knowledge-sources.md)
