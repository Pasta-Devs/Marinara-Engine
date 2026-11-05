# Wissensquellen: die Agenten Knowledge Retrieval und Knowledge Router

**Knowledge Retrieval** (Wissensabruf) und **Knowledge Router** (Wissensverteiler) holen Fakten aus deinen Lorebooks nur dann in einen Chat, wenn eine Szene sie braucht. So musst du nicht jedes Detail in jeden Prompt packen. Beide Agenten funktionieren nur in Roleplay-Chats, und keiner von beiden ist standardmäßig an.

## Wozu sie gut sind

Ein Lorebook ist eine Sammlung von Notizen zur Welt oder zu Charakteren. Jede Notiz ist ein Eintrag. Jeden Eintrag in jedem Zug mitzuschicken, verschwendet Tokens (die kleinen Textstücke, die ein Modell liest und für die du bezahlst) und kann die KI durcheinanderbringen.

Diese Agenten nutzen retrieval-augmented generation (RAG): Marinara sucht die Einträge heraus, die zur aktuellen Szene passen, und fügt nur diese dem Prompt für diesen Zug hinzu.

## Retrieval oder Router wählen

| Frage | Knowledge Retrieval | Knowledge Router |
| --- | --- | --- |
| Art der Ergänzung | Fasst die Quellen zuerst zusammen | Fügt die gewählten Einträge wortwörtlich ein |
| Kosten pro Zug | Höher | Niedriger |
| Liest hochgeladene Dateien | Ja | Nein |
| Ideal für | Kleinere Quellen oder eine aufgeräumte Zusammenfassung | Große Lorebooks mit guten Eintragsbeschreibungen |

- **Knowledge Retrieval** liest jeden aktivierten Eintrag in deinen gewählten Lorebooks, dazu hochgeladene Dateien, und lässt die KI die Fakten zusammenfassen, die zu den letzten Nachrichten passen. Das kostet mehr, weil die KI den gesamten Quelltext liest.
- **Knowledge Router** legt einen kleinen Katalog deiner Einträge an. Jede Zeile enthält eine ID, einen Namen, ein paar Schlüsselwörter und eine kurze Zusammenfassung. Die KI wählt Einträge aus dem Katalog, und Marinara fügt sie vollständig ein. Die KI liest nie jeden Eintrag, deshalb bleibt der Router auch bei einem großen Lorebook günstig.

Du kannst beide einem Chat hinzufügen, aber sie überschneiden sich und treiben die Kosten hoch. Der Agent-Editor warnt dich, wenn beide eingerichtet sind. Nimm nur einen.

## Einen Wissens-Agenten zu einem Chat hinzufügen

Bevor du anfängst: Installiere den Agenten über den **Agent Organizer** (Agentenverwaltung). Siehe [Agenten im Überblick](agents-overview.md).

1. Öffne in einem Roleplay-Chat **Chat Settings** (Chat-Einstellungen).
2. Such den Bereich **Agents** und schalte **Enable Agents** (Agenten aktivieren) ein.
3. Klick auf **Add Agent** (Agent hinzufügen).
4. Öffne die Gruppe **Writer Agents** und wähle **Knowledge Retrieval** oder **Knowledge Router**.
5. Wähle im Einrichtungsfenster deine Quellen (siehe unten).

Danach erscheint die Einstellungskarte des Agenten unter **Agents**, und er läuft bei jedem neuen Zug mit. Während Knowledge Retrieval arbeitet, kann die Fortschrittsanzeige **Retrieving knowledge...** zeigen.

> **Hinweis:** Diese Agenten laufen nur bei neuen Zügen. Wenn du eine Antwort neu generierst, laufen sie nicht noch einmal.

## Die Quellen wählen

Beide Agenten teilen sich dieselben Quellen-Einstellungen.

- **Use chat-active lorebooks** (aktive Lorebooks des Chats verwenden) ist standardmäßig an. Im Agent-Editor heißt derselbe Schalter **Use this chat's active lorebooks**. Solange er an ist und du keine festen Lorebooks wählst, liest der Agent die Lorebooks, die im aktuellen Chat aktiv sind.
- **Fixed source override** (feste Quellenvorgabe) – im Einrichtungsfenster **Fixed Source Lorebooks** – bindet den Agenten fest an die Lorebooks, die du auswählst. Eine feste Auswahl hat immer Vorrang vor den aktiven Lorebooks des Chats, und zwar in jedem Chat, der diesen Agenten nutzt.

Nimm feste Quellen, wenn ein Agent immer dasselbe Referenz-Lorebook lesen soll. Lass den Schalter ohne feste Auswahl an, damit der Agent dem folgt, was der Chat gerade nutzt.

## Dateien hochladen (nur Knowledge Retrieval)

Klick in den Einstellungen von **Knowledge Retrieval** auf **Upload file** (Datei hochladen). Hochgeladene Dateien stehen jedem Chat zur Verfügung, der Knowledge Retrieval nutzt.

Unterstützt werden `.txt`, `.md`, `.csv`, `.json`, `.xml`, `.html`, `.htm`, `.log`, `.yaml`, `.yml`, `.tsv` und `.pdf`. Andere Typen lässt die Dateiauswahl nicht zu. Jede Datei zeigt ihren Namen und ihre Größe, dazu eine Schaltfläche zum Löschen.

- Außer PDFs wird jede Datei als reiner Text gelesen. Eine Datei, die kein Text ist, etwa ein in `.txt` umbenanntes Bild, lässt sich hochladen, liefert aber unlesbaren Inhalt.
- Ein gescanntes PDF oder ein reines Bild-PDF hat keine Textebene. Der Agent setzt dann statt des Inhalts einen Platzhalter ein. Nimm ein PDF mit markierbarem Text.

## Gute Eintragsbeschreibungen schreiben

Das zählt vor allem für Knowledge Router, der Einträge anhand ihrer **Description** (Beschreibung) auswählt.

1. Öffne den Eintrag im Lorebook-Editor.
2. Füll **Description** mit einer kurzen, konkreten Zusammenfassung dessen aus, worum es im Eintrag geht.

Der Router nutzt die Beschreibung nur zur Auswahl. An die Haupt-KI geht sie nicht als Story-Inhalt. Fehlt die Beschreibung, greift der Router auf den Anfang des Eintragsinhalts zurück, und das trifft ungenauer.

Wählst du Quell-Lorebooks für den Router, erscheint neben **Fixed source override** ein Abdeckungs-Badge, zum Beispiel **75% described (9/12)**. Der Punkt ist grün ab 75 %, gelb von 25 % bis 74 % und rot unter 25 %. Bei leeren Lorebooks steht dort **No entries yet**. Ziel ist Grün.

## Optional: Vorauswahl nach Bedeutung

Knowledge Router kann infrage kommende Einträge auch nach Bedeutung finden, nicht nur nach Schlüsselwort. Dafür nutzt er einen Embedder, ein kleines Modell, das Text in Zahlen umwandelt, damit Marinara Bedeutungen vergleichen kann. Der Router funktioniert auch ohne ihn.

1. Öffne den Lorebook-Editor und such **Semantic search (embeddings)** (semantische Suche).
2. Wähl ein Konto mit einem Embedding-Modell. Hast du unter **Connections → Defaults** (Standardwerte) einen Standard für **Embeddings** festgelegt, ist er bereits ausgewählt, sofern du nicht vorher eine andere Quelle gewählt hast.
3. Nutze dieselbe Embedding-Quelle wie dein Chat-Konto. Vektoren mit einer anderen Größe werden übersprungen.
4. Klick auf die Schaltfläche zum Vektorisieren. Sie zeigt, wie vielen Einträgen noch Vektoren fehlen. **Re-vectorize all** (alle neu vektorisieren) berechnet jeden Eintrag neu.

Hat ein Lorebook keine Vektoren oder ist kein Embedder verfügbar, stellt der Router seine Kandidatenliste allein aus Schlüsselwörtern zusammen. Kaputt geht dabei nichts. Siehe [Semantische Suche für Lorebooks](../lorebooks/semantic-search.md).

## Verwandte Anleitungen

- [Semantische Suche für Lorebooks](../lorebooks/semantic-search.md)
- [Lorebooks – Überblick](../lorebooks/overview.md)
- [Agenten: KI-Helfer für deine Chats](agents-overview.md)
