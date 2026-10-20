# Die Charakter-Bibliothek organisieren

In dieser Anleitung erfährst du alles über das **Characters panel** (Charakter-Panel) – die Seitenleiste, in der alle Charaktere liegen. Du lernst, wie du suchst, sortierst, Charaktere in Ordner gruppierst, Favoriten markierst, nach Tags filterst und mehrere Charaktere auf einmal exportierst oder löschst.

## Das Characters panel

Das **Characters panel** ist die Charakterliste im Seiten-Panel. Dort landet jeder Charakter, den du erstellt oder importiert hast. Am oberen Rand des Panels stehen dir diese Möglichkeiten offen:

- **Download** (Herunterladen) öffnet den [Card Browser](bot-browser.md), mit dem du Charaktere auf öffentlichen Seiten findest.
- **Open Library** (Bibliothek öffnen) zeigt dieselben Charaktere in einer größeren Rasteransicht über die ganze Seite.
- Die Schaltfläche **New** (Neu, das Plus-Symbol) öffnet das Fenster **Create Character** (Charakter erstellen).
- Die Schaltfläche **Import** (Importieren, das Download-Symbol) importiert eine Charakterdatei.
- Die Schaltfläche **Select** (Auswählen, das Haken-Symbol) schaltet den Mehrfachauswahl-Modus für Sammelaktionen ein.

Die vollständige Bibliothek übernimmt die Chroma-Textfarbe aus **Settings** (Einstellungen). Öffnest du einen Charakter zum Bearbeiten und kehrst zurück, bleiben die ausgewählte Karte, die Sortierreihenfolge und die Scroll-Position erhalten.

Jede Charakterzeile zeigt den Avatar, den Namen, optional eine Titelzeile, Ersteller und Version, bis zu 3 Tags (Schlagwörter) und eine grobe Token-Schätzung. Ein kleines Stern-Abzeichen kennzeichnet einen Favoriten. Zeigst du auf eine Zeile, erscheinen die Schaltflächen **Duplicate** (Duplizieren) und **Delete** (Löschen).

Bei vielen Charakteren taucht unten die Schaltfläche **Load more** (Mehr laden) auf. Ein Klick darauf lädt die nächste Seite mit Charakteren.

## Suche

Tippe in das Suchfeld oben im Panel, um die Liste zu filtern. Der Platzhaltertext lautet **Search characters or -tag:"tag name"**.

Einfacher Text wird mit Name, Titel, Beschreibung und Tags eines Charakters abgeglichen. Tippst du zum Beispiel `knight`, erscheint jeder Charakter, bei dem „knight“ in einem dieser Felder steht.

Möglich ist außerdem, Charaktere mit einem bestimmten Tag auszuschließen. Setz dafür ein Minuszeichen vor das Tag:

```
-tag:"tag name"
```

Zum Ausschließen von Tags solltest du ein paar Dinge wissen:

- Enthält das Tag ein Leerzeichen, brauchst du Anführungszeichen, etwa `-tag:"slow burn"`.
- Bei einem Tag aus nur einem Wort kannst du sie weglassen, etwa `-vampire`.
- Ein ausgeschlossenes Tag blendet jeden Charakter aus, der es trägt – auch dann, wenn der restliche Suchtext passt.

Beides lässt sich im selben Feld kombinieren. `mage -tag:"villain"` findet zum Beispiel alle Treffer für „mage“ und blendet dabei alles aus, was mit „villain“ getaggt ist.

## Sortierung

Neben dem Suchfeld sitzt das Sortier-Dropdown-Menü. Zur Wahl stehen diese Reihenfolgen:

| Option        | Wirkung                              |
| ------------- | ------------------------------------ |
| **Manual order** (manuelle Reihenfolge) | Die Reihenfolge, die du selbst festlegst. |
| **A-Z**       | Namen von A bis Z.                   |
| **Z-A**       | Namen von Z bis A.                   |
| **Newest**    | Zuletzt erstellte zuerst.            |
| **Oldest**    | Zuerst erstellte zuerst.             |
| **Favorites** | Favoriten zuerst, dann der Rest.     |

Für eine manuelle Reihenfolge ziehst du eine Charakterzeile nach oben oder unten. Du kannst auch auf einer fokussierten Zeile Alt+Pfeil nach oben oder Alt+Pfeil nach unten drücken. Beides stellt die Sortierung auf **Manual order** um.

## Ordner

Mit Ordnern gruppierst du verwandte Charaktere direkt im Panel. Pflicht sind sie nicht – wenn dir eine einzige flache Liste lieber ist, bleibt einfach alles darin.

So legst du einen Ordner an:

1. Klick auf die Schaltfläche **New Folder** (Neuer Ordner).
2. Ein neuer Ordner erscheint, standardmäßig mit dem Namen **unnamed**.
3. Benenn ihn sofort um oder später (siehe unten).

Zum Umbenennen machst du einen Doppelklick auf den Ordner, tippst zweimal darauf oder wählst ihn aus und drückst F2. Tipp den neuen Namen ein und drück Enter.

Um einen Charakter in einen Ordner zu legen, zieh die Charakterzeile auf den Ordner und lass sie dort los. Sobald mindestens ein Ordner existiert, erscheint der Hinweis **Drag and drop characters to folders, double-click or double-tap to rename**. Wieder heraus kommt ein Charakter, indem du im Ordner auf seine Zeile zeigst und auf die Schaltfläche zum Entfernen aus dem Ordner klickst – oder indem du ihn herausziehst.

Auf einem Touchscreen hältst du eine Zeile gedrückt, um sie aufzunehmen, und ziehst sie dann. Eine normale Wischbewegung scrollt weiterhin die Liste. Während du eine Zeile hältst, tippst du mit einem zweiten Finger auf weitere Zeilen, um sie als Stapel mitzunehmen, und lässt den Stapel dann auf einem Ordner los.

Ein Klick auf den Ordner klappt ihn auf oder zu. Die Zahl neben dem Ordnernamen zeigt, wie viele Charaktere darin liegen.

Zum Löschen zeigst du auf den Ordner und klickst auf seine Papierkorb-Schaltfläche. Liegen Charaktere darin, kommt eine Rückfrage: **Delete "name"? Its N characters will stay in the library and move out of the folder.** Ein leerer Ordner verschwindet sofort, ganz ohne Rückfrage. Das Löschen eines Ordners löscht nie die Charaktere darin. Sie wandern schlicht zurück in die Hauptliste.

## Favoriten und Tag-Chips

### Favoriten

Als Favorit markierte Charaktere findest du später schneller wieder. Den Favoriten-Stern setzt du im Charakter selbst, nicht in der Panel-Liste. Öffne dazu einen Charakter und klick auf den Stern **Favorite** (Favorit), um ihn ein- oder auszuschalten. Favorisierte Charaktere tragen im Panel ein kleines Stern-Abzeichen am Avatar.

Unter dem Suchbereich liegen drei Filter-Schaltflächen:

- **All** zeigt alle Charaktere.
- **Favs** zeigt nur die Favoriten.
- **Non-favs** zeigt nur die Charaktere, die keine Favoriten sind.

Alternativ wählst du im Sortier-Dropdown-Menü **Favorites**, damit alle Favoriten nach oben rutschen.

### Tags

Tags sind Schlagwörter, mit denen du einen Charakter beschreibst, etwa `fantasy` oder `slow burn`. Angelegt und bearbeitet werden sie im Charakter-Editor.

Im Panel zeigt jede Charakterzeile bis zu 3 ihrer Tags. Klick auf einen Tag-Chip in einer beliebigen Zeile, und die Liste zeigt nur noch Charaktere mit diesem Tag.

Sobald deine Charaktere Tags haben, erscheint in der Filterzeile die Schaltfläche **Tags** – mit der Gesamtzahl in Klammern, zum Beispiel **Tags (12)**. Ein Klick darauf klappt die vollständige Tag-Liste auf:

- Klick auf ein Tag in der aufgeklappten Liste, um damit zu filtern. Wählst du mehrere Tags, passen alle Charaktere, die eines der ausgewählten Tags tragen.
- Neben jedem Tag in der aufgeklappten Liste steht ein kleines X. Ein Klick darauf löscht dieses Tag bei jedem Charakter, der es hat. Vorher kommt eine Rückfrage: **Remove tag "name" from all characters?**
- Sobald ein Tag-Filter aktiv ist, erscheint die Schaltfläche **Clear** (Zurücksetzen). Ein Klick darauf leert alle Tag-Filter.

Willst du ein Tag ausschließen statt einschließen, nutz die Suchsyntax `-tag:` aus dem Abschnitt zur Suche weiter oben.

## Mehrfachauswahl, Export und Löschen

Wenn du mehrere Charaktere auf einmal bearbeiten willst, hilft der Auswahlmodus.

1. Klick oben im Panel auf die Schaltfläche **Select**.
2. In jeder Charakterzeile erscheint ein Kontrollkästchen.
3. Klick die gewünschten Charaktere an. Die Panel-Kopfzeile zeigt, wie viele ausgewählt sind.
4. Nutz die Aktionsleiste am unteren Rand des Panels.

Die Aktionsleiste hat zwei Schaltflächen:

- **Export** lädt alle ausgewählten Charaktere gemeinsam als eine einzige ZIP-Datei namens `marinara-characters.zip` herunter. Das ist ein Sammelexport im hauseigenen Format von Marinara Engine.
- **Delete** entfernt alle ausgewählten Charaktere. Vorher kommt eine Rückfrage: **Delete N characters?**

Im Auswahlmodus kannst du die ausgewählten Charaktere auch in einem Rutsch in einen Ordner ziehen, statt sie einzeln zu verschieben.

Die vollständige Liste der Import- und Exportformate steht in der Anleitung zum Importieren und Exportieren weiter unten.

## Ordner sind zugleich Besetzungslisten für Gruppenchats

Die Ordner, die du hier anlegst, haben noch einen zweiten Zweck: Jeder Ordner ist zugleich eine gespeicherte Besetzungsliste für einen Gruppenchat.

Richtest du einen Chat mit mehreren Charakteren ein, halt nach der Option **Add from Folder** (Aus Ordner hinzufügen) Ausschau. Sie fügt in einem Schritt alle Charaktere eines gewählten Ordners hinzu. Schneller kommst du zu keinem Gruppenchat mit einer Besetzung, die du oft zusammen spielst. Wie Gruppenchats funktionieren, steht in der Anleitung zu Gruppenchats weiter unten.

## Verwandte Anleitungen

- [Charakterkarten importieren und exportieren](import-export.md)
- [Charaktere anlegen und bearbeiten](creating-and-editing-characters.md)
- [Gruppenchats und Gruppengespräche](../chats/group-chats.md)
