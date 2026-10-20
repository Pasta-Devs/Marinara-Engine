# Lorebooks – Überblick

In dieser Anleitung erfährst du, was ein Lorebook in Marinara Engine ist, wie das **Lorebooks**-Panel funktioniert und wie ein Lorebook in einem Chat aktiv wird. Außerdem legst du Schritt für Schritt dein erstes Lorebook samt erstem Eintrag an. Tiefergehende Themen wie Schlüsselwörter, Timing und semantische Suche haben eigene Anleitungen, verlinkt am Ende.

## Was ein Lorebook ist

Ein Lorebook ist eine kleine Wissensdatenbank, aus der die KI während eines Chats schöpfen kann. Es heißt auch **World Info** – beide Namen meinen dasselbe. Jedes Lorebook enthält eine Liste von Einträgen. Ein Eintrag besteht aus zwei Teilen: ein paar auslösenden Schlüsselwörtern und einem Textblock.

Taucht ein Schlüsselwort im jüngsten Chatverlauf auf, fügt Marinara Engine den Text dieses Eintrags in den Prompt ein. Der Prompt besteht aus den verborgenen Anweisungen und dem Verlauf, die für jede Antwort an die KI gehen. So nutzt die KI Fakten, die im Chat nie direkt genannt wurden.

Ein einfaches Beispiel: Du legst einen Lorebook-Eintrag mit dem Schlüsselwort `Eldoria` und diesem Text an:

```
Eldoria is a rainy port city ruled by a council of nine merchants.
```

Sobald du oder ein Charakter Eldoria erwähnt, erhält die KI diesen Fakt. Sie antwortet dann, als hätte sie die Stadt schon immer gekannt. Ohne den Eintrag müsste sie raten.

Lorebooks eignen sich für Weltwissen, Charakter-Vorgeschichten, Ortsnamen, Fraktionen, Regeln und alle Fakten, an die sich die KI erinnern soll. Du musst diese Fakten nicht in jeder Nachricht wiederholen. Das Lorebook liefert sie nur dann, wenn sie relevant sind, und spart so Platz im Prompt.

Der Abgleich über Schlüsselwörter funktioniert mit jeder KI-Verbindung und braucht keine zusätzliche Einrichtung. Marinara gleicht Einträge auf Wunsch auch nach Bedeutung ab, über die optionale semantische Suche. Diese Funktion ist separat, muss eigens aktiviert werden und hat eine eigene Anleitung.

## Das Lorebooks-Panel

Das **Lorebooks**-Panel ist die Bibliothek: Hier durchstöberst, durchsuchst und verwaltest du alle Lorebooks. Öffne es über die Seitenleiste der App. Jedes Lorebook erscheint mit Bild, Namen und einer kurzen Beschreibung.

Oben im Panel sitzen drei Symbol-Schaltflächen. Sie zeigen nur ein Symbol, ganz ohne Textbeschriftung. Zeig mit der Maus darauf, um den Namen einzublenden.

- **New** (Neu, ein Pluszeichen) öffnet das Fenster **Create Lorebook** (Lorebook erstellen), in dem du ein Lorebook anlegst.
- **Import** (Importieren, ein Pfeil nach unten) öffnet das Fenster **Import Lorebook** (Lorebook importieren), um eine Lorebook-Datei zu laden.
- **Select** (Auswählen, ein Häkchen) schaltet die Mehrfachauswahl ein, damit du mehrere Lorebooks auf einmal exportieren oder löschen kannst.

Unter den Schaltflächen liegt ein Suchfeld mit dem Platzhaltertext **Search lorebooks** (Lorebooks durchsuchen). Es filtert die Liste nach Name, Beschreibung, verknüpften Charakter- oder Persona-Namen und Tags (Schlagwörtern). Daneben steht das Dropdown-Menü **Sort order** (Sortierreihenfolge) mit diesen Optionen: **Manual order** (manuelle Reihenfolge), **A-Z**, **Z-A**, **Newest**, **Oldest** und **Token Budget**. Mit **Manual order** ziehst du die Lorebooks in die gewünschte Reihenfolge oder verschiebst eines mit Alt+Pfeil nach oben und Alt+Pfeil nach unten auf der Tastatur. Deine Reihenfolge bleibt erhalten.

Jede Lorebook-Zeile zeigt eine Schaltfläche **Copy** (Kopieren) und eine Schaltfläche **Delete** (Löschen). Sie erscheinen, sobald du mit der Maus über die Zeile fährst. Auf dem Handy sind sie immer sichtbar. **Copy** dupliziert das Lorebook. Ein ausgeschaltetes Lorebook trägt ein kleines **OFF**-Badge. Klick auf das Bild, um es hochzuladen oder zu ersetzen.

Mit der Schaltfläche **New Folder** (Neuer Ordner) legst du außerdem Bibliotheks-Ordner an. Zieh ein Lorebook auf einen Ordner, um es einzusortieren. So bleibt auch eine große Bibliothek übersichtlich. Auf dem Handy hältst du ein Lorebook kurz gedrückt und ziehst es dann. Diese Bibliotheks-Ordner haben nichts mit den Eintrags-Ordnern zu tun, die du innerhalb eines einzelnen Lorebooks anlegen kannst.

## Kategorien

Jedes Lorebook gehört zu genau einer Kategorie. Die Kategorie ist nur eine Beschriftung und hilft dir beim Ordnen der Bibliothek. Wie und wann ein Lorebook aktiv wird, ändert sie nicht.

Das Panel hat diese Kategorie-Tabs:

- **All** zeigt alle Lorebooks, nach Kategorie gruppiert.
- **Active** zeigt nur die Lorebooks, die für den gerade geöffneten Chat relevant sind.
- **World**, **Character**, **NPC**, **Spellbook** und **Other** zeigen jeweils nur die Lorebooks dieser einen Kategorie.

Beim Anlegen wählst du eine von fünf Kategorien: **World**, **Character**, **NPC**, **Spellbook** oder **Other**. Standard ist **Other**. Die Kategorie lässt sich später im Tab **Overview** (Übersicht) des Lorebooks ändern. Beachte: Im Tab **Overview** heißt genau diese Kategorie **Uncategorized** statt **Other**. Nutz die Beschriftungen so, wie sie für dich Sinn ergeben. Leg zum Beispiel Notizen zu Orten und Schauplätzen unter **World** ab und die Geschichte einer Begleiterin unter **Character**.

## Wie ein Lorebook aktiv wird

Ein Lorebook speist die KI nur, wenn es im aktuellen Chat aktiv ist. Dafür gibt es drei Wege. Such dir den passenden aus.

1. **Global.** Ein globales Lorebook ist in jedem Chat aktiv, solange es aktiviert ist. Aktivier dafür im Tab **Overview** des Lorebooks den Schalter **Global**. Das eignet sich für Fakten, die überall gelten, etwa die Regeln deiner gemeinsamen Welt.
2. **Mit einem Charakter oder einer Persona verknüpft.** Ein verknüpftes Lorebook wird automatisch in jedem Chat aktiv, an dem dieser Charakter beteiligt ist oder in dem diese Persona zum Einsatz kommt. Die Verknüpfungen setzt du im Tab **Overview** oder im Charakter- bzw. Persona-Editor. Für die eigene Vorgeschichte eines Charakters ist das die häufigste Wahl.
3. **An einen einzelnen Chat geheftet.** Über die Einstellungen eines Chats fügst du ein Lorebook nur diesem einen Chat hinzu. Aktiv bleibt es dann ausschließlich dort. Praktisch für Wissen, das zu einer Geschichte passt, aber nicht zur ganzen Bibliothek.

Ein globales und ein verknüpftes Lorebook können nicht dasselbe Lorebook sein. Schaltest du **Global** ein, entfernt Marinara beim Speichern alle Charakter- und Persona-Verknüpfungen. Beide Optionen schließen sich gegenseitig aus.

Auch ein aktives Lorebook richtet sich weiterhin nach seinem Schalter **Enabled** (Aktiviert). Ist ein Lorebook ausgeschaltet, wird kein einziger Eintrag aktiv, selbst wenn es global oder verknüpft ist. Welche Lorebooks im offenen Chat aktiv sind, siehst du in dessen Einstellungen im Abschnitt **Lorebooks**. Dort lässt sich die aktive Liste auch bearbeiten. Diesem Abschnitt widmet sich eine eigene Anleitung.

## Dein erstes Lorebook und dein erster Eintrag

So legst du ein Lorebook an und fügst einen Eintrag hinzu.

1. Öffne das **Lorebooks**-Panel und klick auf **New**. Das Fenster **Create Lorebook** geht auf.
2. Gib im Feld **Name** einen Namen ein. Dieses Feld ist Pflicht. Ein anschauliches Beispiel ist `Eldoria World Lore`.
3. Ergänze bei Bedarf eine kurze **Description** (Beschreibung). Sie ist optional und hilft dir nur, das Lorebook später wiederzufinden.
4. Wähl im Dropdown-Menü eine **Category** (Kategorie) aus oder belass es bei **Other**.
5. Klick auf die Schaltfläche **Create Lorebook**. Das neue Lorebook erscheint in der Liste im Panel.

Einträge hat das Lorebook noch keine. Also leg jetzt einen an.

1. Klick im Panel auf die Zeile deines Lorebooks. Der ganzseitige Editor öffnet sich.
2. Klick auf den Tab **Entries** (Einträge). Das Badge daneben zeigt die Anzahl der Einträge.
3. Klick auf **Add Entry** (Eintrag hinzufügen). Ein neuer, leerer Eintrag erscheint.
4. Trag im Eintrag ein oder mehrere auslösende Schlüsselwörter ein, zum Beispiel `Eldoria`.
5. Schreib in das Feld **Content** (Inhalt) des Eintrags den Text, den die KI erhalten soll.

Kurz nachdem du aufhörst zu tippen, speichert der Eintrag von selbst. Ein kurzer Hinweis **Saved automatically** bestätigt das. Damit funktioniert das Lorebook: Passt ein Schlüsselwort zum jüngsten Chatverlauf, wandert der Inhalt des Eintrags in den Prompt. Die [Anleitung zu den Einträgen](entries.md) erklärt Schlüsselwörter, Abgleichregeln und Timing-Optionen. Ihre Abschnitte [Schreibstrategie](entries.md#authoring-strategy-choosing-the-right-entry) und [Praxisbeispiel](entries.md#worked-example-a-small-setting) zeigen, wie du für jeden Eintrag die passenden Bedienelemente wählst.

## Die Einstellungen im Tab Overview

Öffne ein Lorebook und klick auf den Tab **Overview**, um das Verhalten des gesamten Lorebooks festzulegen. Die wichtigsten Felder sind Name, Kategorie, Verknüpfungen und die oben beschriebenen Schalter. Dazu kommen diese Zahlenwerte.

| Einstellung | Was sie bewirkt | Standard |
|---|---|---|
| **Scan Depth** | Wie viele der letzten Nachrichten Marinara auf passende Schlüsselwörter prüft. Bei 0 durchsucht Marinara den ganzen Chat. | 2 |
| **Token Budget** | Die maximale Anzahl an Tokens, die dieses Lorebook zu einem Prompt beisteuern darf. Bei 0 gibt es keine Grenze. | 2048 |
| **Entry Limit** | Die maximale Anzahl an Einträgen, die dieses Lorebook zu einem Prompt beisteuern darf. Möglich sind 1 bis 1000. | 100 |
| **Max Depth** | Wie viele zusätzliche rekursive Durchläufe Marinara ausführt. Das Feld erscheint nur, wenn **Recursive** aktiv ist. Möglich sind 1 bis 10. | 3 |

Ein Token ist ein kleines Textstück von wenigen Zeichen. Der Platz für den Prompt ist bei der KI begrenzt, deshalb verhindert das **Token Budget**, dass ein einzelnes Lorebook ihn ausfüllt.

Der Tab hat außerdem drei Schalter:

- **Enabled** schaltet das gesamte Lorebook ein oder aus. Standardmäßig ist es an.
- **Recursive** erlaubt, dass der Text eines aktivierten Eintrags in weiteren Durchläufen zusätzliche Einträge auslöst. Standardmäßig ist es aus. Schalt es ein, wenn ein Stück Wissen weiteres, verwandtes Wissen nach sich ziehen soll.
- **Vectors** erlaubt Einträgen den Abgleich nach Bedeutung. Standardmäßig ist es aus. Der Abgleich über Schlüsselwörter funktioniert auch im ausgeschalteten Zustand.

Unter diesen Einstellungen liegt das Panel **Semantic Search (Embeddings)**. Es baut die Daten auf, die den bedeutungsbasierten Abgleich überhaupt erst möglich machen. Die Anleitung zur semantischen Suche behandelt Einrichtung, Embedding-Quellen und die Schaltflächen zum Vektorisieren.

Für die Feinheiten der Budgets, das **Entry Limit** und die Rekursion gibt es ebenfalls eine eigene Anleitung. Fang mit den Standardwerten oben an. Für die meisten Lorebooks passen sie gut, und anpassen kannst du sie später jederzeit.

## Verwandte Anleitungen

- [Lorebook-Einträge: Schlüsselwörter, Position und Timing](entries.md)
- [Lorebook-Token-Budgets und Rekursion](token-budgets.md)
- [Semantische Suche für Lorebooks](semantic-search.md)
- [Lorebooks mit Charakteren und Personas verknüpfen](linking-to-characters.md)
- [Lorebooks importieren und exportieren](import-export.md)
- [Wissensquellen: Retrieval- und Router-Agenten](../agents/knowledge-sources.md)
