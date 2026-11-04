# Die Charakter-Bibliothek organisieren

Das Panel **Characters** (Charaktere) ist die Liste in der Seitenleiste mit jedem Charakter, den du erstellt oder importiert hast. Darin suchst und sortierst du, gruppierst Charaktere in Ordner, markierst Favoriten, filterst nach Tags und exportierst oder löschst mehrere Charaktere auf einmal.

## Das Panel „Characters“

Oben im Panel hast du diese Möglichkeiten:

- Klick auf **Download** (Herunterladen), um den [Card Browser](bot-browser.md) zu öffnen und Charaktere auf öffentlichen Seiten zu finden.
- Klick auf **Open Library** (Bibliothek öffnen), um dieselben Charaktere in einem größeren Raster über die ganze Seite zu öffnen.
- Klick auf **New** (Neu, das Plus-Symbol), um das Fenster **Create Character** (Charakter erstellen) zu öffnen.
- Klick auf **Import** (Importieren, das Download-Symbol), um eine Charakterdatei zu importieren. Siehe [Charakterkarten importieren und exportieren](import-export.md).
- Klick auf **Select** (Auswählen, das Haken-Symbol), um den Auswahlmodus für Sammelaktionen einzuschalten.

Öffnest du einen Charakter zum Bearbeiten und kehrst zurück, behält die vollständige Bibliothek die ausgewählte Karte, die Sortierreihenfolge und die Scroll-Position.

Jede Zeile zeigt den Avatar, den Namen, optional eine Titelzeile, Ersteller und Version, bis zu 3 Tags und eine grobe Token-Schätzung. Ein kleines Stern-Abzeichen kennzeichnet einen Favoriten. Zeigst du auf eine Zeile, erscheinen **Duplicate** (Duplizieren) und **Delete** (Löschen). Hast du viele Charaktere, klick unten auf **Load more** (Mehr laden), um die nächste Seite zu laden.

<a id="search"></a>

## Suche

Tippe in das Suchfeld oben. Der Platzhaltertext lautet **Search characters/tags** (Charaktere/Tags durchsuchen). Einfacher Text wird ohne Rücksicht auf Groß- und Kleinschreibung mit Name, Titel, Beschreibung und Tags eines Charakters abgeglichen. Tippst du `knight`, erscheint jeder Charakter, bei dem „knight“ in einem dieser Felder steht.

| Suche | Was sie findet |
| --- | --- |
| `male genshin` oder `male,genshin` | Karten mit beiden exakten Tags. |
| `male "Modern AU"` | Setz ein Tag mit Leerzeichen oder Kommas in Anführungszeichen. |
| `-tag:"slow burn"` | Blendet jede Karte mit diesem Tag aus, auch wenn der Rest deiner Suche passt. |
| `-vampire` | Dasselbe für ein Tag aus einem Wort. Die Anführungszeichen kannst du weglassen. |
| `mage -tag:"villain"` | Karten, die zu „mage“ passen, ohne die mit „villain“ getaggten. |

Gewöhnliche Phrasensuchen funktionieren weiterhin. Dieselbe Suche funktioniert auch in der ganzseitigen Charakter-Bibliothek und für Personas.

## Sortierung

Wähle im Sortier-Dropdown neben dem Suchfeld eine Reihenfolge.

| Option | Wirkung |
| --- | --- |
| **Manual order** (manuelle Reihenfolge) | Die Reihenfolge, die du selbst festlegst. |
| **A-Z** | Namen von A bis Z. |
| **Z-A** | Namen von Z bis A. |
| **Newest** | Zuletzt erstellte zuerst. |
| **Oldest** | Zuerst erstellte zuerst. |
| **Favorites** | Favoriten zuerst, dann der Rest. |

Für eine manuelle Reihenfolge ziehst du eine Zeile nach oben oder unten oder drückst auf einer fokussierten Zeile <kbd>Alt</kbd>+<kbd>Up</kbd> oder <kbd>Alt</kbd>+<kbd>Down</kbd>. Beides stellt die Sortierung auf **Manual order** um.

## Ordner

Ordner gruppieren verwandte Charaktere, etwa nach Geschichte oder Serie, sodass sich eine lange Liste leichter überblicken lässt. Sie sind optional.

1. Klick auf **New Folder** (Neuer Ordner). Ein Ordner namens **unnamed** erscheint.
2. Benenn ihn um: Doppelklick oder doppeltes Tippen darauf, oder wähl ihn aus und drück <kbd>F2</kbd>. Tipp den neuen Namen ein und drück <kbd>Enter</kbd>.
3. Zieh eine Charakterzeile auf den Ordner, um den Charakter hineinzulegen. Sobald es einen Ordner gibt, erscheint der Hinweis **Drag and drop characters to folders, double-click or double-tap to rename**.

Um einen Charakter wieder herauszunehmen, zeig im Ordner auf seine Zeile und klick auf die Schaltfläche zum Entfernen aus dem Ordner, oder zieh ihn heraus. Ein Klick auf einen Ordner klappt ihn auf oder zu. Die Zahl neben seinem Namen zeigt, wie viele Charaktere darin liegen.

Auf einem Touchscreen hältst du eine Zeile gedrückt, um sie aufzunehmen, und ziehst sie dann. Eine normale Wischbewegung scrollt weiterhin.

Um mehrere auf einmal zu verschieben, hältst du eine Zeile und tippst mit einem zweiten Finger auf weitere Zeilen, um sie als Stapel mitzunehmen. Lass den Stapel dann auf einem Ordner los.

Um einen Ordner zu löschen, zeig auf ihn und klick auf seine Papierkorb-Schaltfläche. Bei einem Ordner mit Charakteren kommt eine Rückfrage: **Delete "name"? Its N characters will stay in the library and move out of the folder.** Ein leerer Ordner verschwindet sofort. Das Löschen eines Ordners löscht nie die Charaktere darin.

### Einen Ordner als Besetzungsliste für Gruppenchats nutzen

Jeder Ordner ist zugleich eine gespeicherte Besetzungsliste für Gruppenchats. Richtest du einen Chat mit mehreren Charakteren ein, fügt **Add from Folder** (Aus Ordner hinzufügen) alle Charaktere eines Ordners in einem Schritt hinzu. Siehe [Gruppenchats und Gruppen-Conversations](../chats/group-chats.md).

## Favoriten und Tags

### Favoriten

Öffne einen Charakter und klick auf seinen Stern **Favorite** (Favorit), um ihn ein- oder auszuschalten. In der Panel-Liste lässt er sich nicht setzen. Favoriten tragen ein kleines Stern-Abzeichen. Unter dem Suchfeld filtern drei Schaltflächen die Liste:

- **All** zeigt alle Charaktere.
- **Favs** zeigt nur Favoriten.
- **Non-favs** zeigt nur Charaktere, die keine Favoriten sind.

Du kannst auch im Sortier-Dropdown **Favorites** wählen, um Favoriten nach oben zu holen.

### Tags

Tags sind Schlagwörter wie `fantasy` oder `slow burn`. Du legst sie im Charakter-Editor an. Siehe [Charaktere anlegen und bearbeiten](creating-and-editing-characters.md#metadata-tab). Klick im Panel in einer beliebigen Zeile auf einen Tag-Chip, um die Liste auf Charaktere mit diesem Tag zu filtern.

Haben deine Charaktere Tags, erscheint eine Schaltfläche **Tags** mit einer Anzahl, etwa **Tags (12)**. Klick darauf, um die vollständige Liste aufzuklappen:

- Klick auf ein Tag, um es als Filter aufzunehmen. Sind mehrere Tags ausgewählt, passt ein Charakter, wenn er eines davon hat.
- Klick auf das X an einem Tag, um dieses Tag bei jedem Charakter zu löschen, der es hat. Vorher kommt eine Rückfrage: **Remove tag "name" from all characters?**
- **Clear** (Zurücksetzen) erscheint, sobald ein Tag-Filter aktiv ist. Klick darauf, um die Tag-Filter zu leeren.

Willst du ein Tag stattdessen ausschließen, nutze `-tag:` im Suchfeld, wie unter [Suche](#search) gezeigt.

<a id="export-or-delete-many-characters"></a>

## Mehrere Charaktere exportieren oder löschen

1. Klick oben im Panel auf **Select**. In jeder Zeile erscheint ein Kontrollkästchen.
2. Klick die gewünschten Charaktere an. Die Panel-Kopfzeile zeigt, wie viele ausgewählt sind.
3. Nutze die Aktionsleiste am unteren Rand.

Die Aktionsleiste hat zwei Schaltflächen:

- **Export** lädt die ausgewählten Charaktere als eine ZIP-Datei namens `marinara-characters.zip` herunter, im nativen Format von Marinara.
- **Delete** entfernt die ausgewählten Charaktere. Vorher kommt eine Rückfrage: **Delete N characters?**

Im Auswahlmodus kannst du die ausgewählten Charaktere auch gemeinsam in einen Ordner ziehen. Zu den Dateiformaten siehe [Charakterkarten importieren und exportieren](import-export.md).

## Verwandte Anleitungen

- [Charakterkarten importieren und exportieren](import-export.md)
- [Charaktere anlegen und bearbeiten](creating-and-editing-characters.md)
- [Gruppenchats und Gruppen-Conversations](../chats/group-chats.md)
