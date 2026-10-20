# Wissensquellen: die Agenten Knowledge Retrieval und Knowledge Router

In dieser Anleitung erfährst du, wie die beiden Wissens-Agenten in Marinara Engine arbeiten: **Knowledge Retrieval** (Wissensabruf) und **Knowledge Router** (Wissensverteiler). Beide holen Fakten aus den Lorebooks in den Chat – aber nur dann, wenn die Szene sie wirklich braucht. So muss nicht jedes Detail in jedem Prompt stehen, also in jedem Text, den Marinara an die KI schickt.

## Was diese Agenten leisten

Ein Lorebook ist eine Sammlung von Weltwissen: Notizen zur Welt oder zu Charakteren, die du vorab schreibst. Jede einzelne Notiz heißt Eintrag. Je länger ein Chat wird, desto teurer wird es, in jedem Zug alle Einträge mitzuschicken – das kostet unnötig Tokens. Ein Token ist ein kleines Textstück, das die KI liest, und mehr Tokens bedeuten höhere Kosten. Außerdem bringt zu viel Material die KI leicht durcheinander.

Wissens-Agenten lösen das mit RAG. RAG steht für retrieval-augmented generation. Dahinter steckt eine einfache Idee: Die App sucht die Einträge heraus, die zur aktuellen Szene passen, und hängt nur diese an den Prompt für genau diesen einen Zug.

Marinara bietet dafür zwei optionale Agenten:

- **Knowledge Retrieval** liest die ausgewählten Quellen, fasst die wichtigen Fakten zusammen und ergänzt den Prompt um diese Zusammenfassung.
- **Knowledge Router** liest eine kurze Liste der Einträge, wählt die passenden aus und fügt sie wortwörtlich ein.

Beide Agenten funktionieren ausschließlich in **Roleplay**-Chats. In Conversation Mode und Game Mode lassen sie sich nicht hinzufügen. Aktiv ist standardmäßig keiner von beiden – du fügst den gewünschten Agenten selbst zu einem Chat hinzu.

## Knowledge Retrieval oder Knowledge Router?

Diese Tabelle hilft bei der Wahl. Lies vor der Entscheidung auch die Hinweise darunter.

| Frage | Knowledge Retrieval | Knowledge Router |
|---|---|---|
| Art der Ergänzung | Fasst die Quellen zuerst zusammen | Fügt die gewählten Einträge wortwörtlich ein |
| Kosten pro Zug | Höher | Niedriger |
| Liest hochgeladene Dateien | Ja | Nein |
| Ideal für | Kleinere Quellen oder eine aufgeräumte Zusammenfassung | Große Lorebooks mit guten Eintragsbeschreibungen |

**Knowledge Retrieval** liest jeden aktivierten Eintrag der gewählten Lorebooks sowie den Text aller hochgeladenen Dateien. Anschließend lässt der Agent die KI eine kurze Zusammenfassung der Fakten schreiben, die zu den letzten Nachrichten passen. Das kostet pro Zug mehr, weil die KI das komplette Quellmaterial liest.

**Knowledge Router** ist die günstigere Variante. Er legt einen kleinen Katalog der Einträge an. Jede Katalogzeile enthält eine ID, einen Namen, ein paar Schlüsselwörter und eine kurze Zusammenfassung. Die KI liest diesen Katalog, wählt die passenden Einträge aus, und Marinara fügt sie vollständig ein. Die KI bekommt nie alle Einträge in voller Länge zu sehen – deshalb bleibt der Router auch bei einem großen Lorebook günstig.

Du kannst beide Agenten in einem Chat einsetzen. Dann überschneiden sich die Inhalte aber leicht, und die Token-Kosten steigen. Der Agent-Editor warnt dich, sobald beide eingerichtet sind. Für aufgeräumte Prompts nimm nur einen.

## Einen Wissens-Agenten zu einem Chat hinzufügen

Das geht nur innerhalb eines **Roleplay**-Chats.

1. Öffne **Chat Settings** (Chat-Einstellungen).
2. Geh zum Bereich **Agents** (Agenten).
3. Schalte **Enable Agents** (Agenten aktivieren) ein. Damit wird die Agentenliste freigegeben.
4. Klick auf **Add Agent** (Agent hinzufügen).
5. Öffne die Gruppe **Writer Agents**.
6. Wähle **Knowledge Retrieval** oder **Knowledge Router**.

Es öffnet sich ein Einrichtungsfenster, in dem du direkt die Quellen festlegst. Nach dem Hinzufügen erscheint die Einstellungskarte des Agenten im Bereich **Agents**. Ab dann läuft der Agent bei jedem neuen Zug von selbst mit.

Während **Knowledge Retrieval** arbeitet, zeigt die Fortschrittsanzeige gelegentlich die Phase **Retrieving knowledge...** an.

Hinweis: Wenn du eine vorhandene Antwort neu generierst, laufen diese Agenten nicht noch einmal. Sie laufen ausschließlich bei neuen Zügen.

## Dateien für Knowledge Retrieval hochladen

Hochgeladene Dateien liest nur **Knowledge Retrieval**. **Knowledge Router** arbeitet allein mit Lorebooks.

In den Einstellungen von **Knowledge Retrieval** findest du eine Dateiliste und die Schaltfläche **Upload file** (Datei hochladen). Hochgeladene Dateien stehen allen Chats zur Verfügung, die **Knowledge Retrieval** nutzen – nicht nur dem aktuellen.

Unterstützt werden die Dateitypen .txt, .md, .csv, .json, .xml, .html, .htm, .log, .yaml, .yml, .tsv und .pdf. Andere Typen lässt die Dateiauswahl gar nicht erst zu. Zu jeder Datei in der Liste stehen Name und Größe, daneben eine Schaltfläche zum Löschen.

Zwei Grenzen solltest du kennen:

- Außer PDFs liest Marinara jede Datei als reinen Text. Eine Datei, die in Wahrheit kein Text ist – etwa ein in .txt umbenanntes Bild –, lässt sich zwar hochladen, liefert aber nur wirren, unlesbaren Inhalt.
- Ein gescanntes PDF oder ein reines Bild-PDF hat keine Textebene und bleibt für den Agenten unlesbar. Scheitert die Textextraktion, setzt der Agent statt echter Inhalte einen Platzhalter ein. Nimm also ein PDF mit markierbarem Text.

## Quellen festlegen: feste Vorgabe oder Chat-Lorebooks

Beide Agenten teilen sich dieselben Quellen-Einstellungen auf ihrer Einstellungskarte.

Der Schalter **Use chat-active lorebooks** (aktive Lorebooks des Chats verwenden) ist standardmäßig eingeschaltet. Im Agent-Editor heißt derselbe Schalter **Use this chat's active lorebooks**. Solange er aktiv ist und du kein festes Lorebook wählst, nutzt der Agent genau die Lorebooks, die im aktuellen Chat aktiv sind.

Darunter liegt **Fixed source override** (feste Quellenvorgabe), im Einrichtungsfenster **Fixed Source Lorebooks** genannt. Wähle hier ein oder mehrere Lorebooks aus, um den Agenten fest auf diesen Satz zu binden. Eine feste Auswahl hat immer Vorrang vor den aktiven Lorebooks des Chats – und zwar in jedem Chat, der diesen Agenten verwendet.

Feste Quellen lohnen sich, wenn ein Agent stets dasselbe Referenz-Lorebook lesen soll. Lass den Schalter ohne feste Auswahl an, wenn der Agent dem folgen soll, was der Chat gerade nutzt.

## Gute Eintragsbeschreibungen schreiben

Dieser Abschnitt zählt vor allem für **Knowledge Router**. Der Router entscheidet anhand der **Description** (Beschreibung) jedes Eintrags, was er einfügt. Eine gute Beschreibung ist der Schlüssel zur richtigen Auswahl.

Geschrieben wird sie im Editor für Lorebook-Einträge, im Feld **Description**. Halte sie kurz und konkret: eine knappe Zusammenfassung dessen, worum es im Eintrag geht. Der Router nutzt diesen Text ausschließlich zur Auswahl. An die Haupt-KI geht er nicht als Story-Inhalt.

Fehlt einem Eintrag die Beschreibung, greift der Router auf den Anfang des Eintragsinhalts zurück. Dieser Ersatz trifft deutlich ungenauer. Fülle das Feld also bei jedem Eintrag aus, den der Router finden soll.

Sobald du Quell-Lorebooks für den Router auswählst, erscheint neben **Fixed source override** ein kleines Abdeckungs-Badge. Es zeigt als Prozentwert und als Anzahl, wie viele Einträge eine Beschreibung haben, zum Beispiel **75% described (9/12)**. Der Punkt leuchtet grün ab 75 Prozent, gelb zwischen 25 und 74 Prozent und rot unter 25 Prozent. Sind die gewählten Lorebooks leer, steht dort **No entries yet**. Ziel ist Grün.

## Optionale semantische Vorauswahl

**Knowledge Router** kann Einträge auch nach Bedeutung finden, nicht nur nach Schlüsselwort. Das nennt sich semantische Suche. Dafür braucht er einen Embedder – ein kleines Modell, das Text in Zahlen umwandelt, damit die App Bedeutungen vergleichen kann. Dieser Schritt ist optional; der Router funktioniert auch ohne ihn.

Dazu musst du das Lorebook vektorisieren. Beim Vektorisieren lässt die App den Embedder einmal über jeden Eintrag laufen und speichert die Ergebnisse. Öffne den Lorebook-Editor und geh zum Abschnitt **Semantic Search (Embeddings)** (semantische Suche). Wähle eine Verbindung mit einem Embedding-Modell – ein Embedding ist die numerische Darstellung von Text – oder eine **Embedding Connection** (Embedding-Verbindung). Hast du unter **Connections** (Verbindungen) bei **Defaults** (Standardwerte) einen **Embeddings**-Standard gewählt, ist er bereits ausgewählt, sofern du nicht vorher eine andere Quelle gewählt hast. Prüf die ausgewählte Quelle vor dem Vektorisieren und nutze dieselbe Embedding-Quelle wie deine Chat-Verbindung; Vektoren mit einer anderen Größe werden bei der semantischen Suche übersprungen. Klick dann auf **Vectorize N missing**; N steht für die Zahl der Einträge, denen noch Vektoren fehlen. Mit **Re-vectorize** lässt sich außerdem alles neu berechnen. Details stehen in der unten verlinkten Anleitung zur semantischen Suche.

Hat ein Lorebook keine Vektoren oder ist kein Embedder verfügbar, stellt der Router seine Kandidatenliste per Schlüsselwort zusammen. Kaputt geht dabei nichts – er verlässt sich dann eben allein auf Schlüsselwörter.

## Verwandte Anleitungen

- [Semantische Suche für Lorebooks](../lorebooks/semantic-search.md)
- [Lorebooks im Überblick](../lorebooks/overview.md)
- [Agenten: KI-Helfer für deine Chats](agents-overview.md)
