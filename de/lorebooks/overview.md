# Lorebooks – Überblick

Ein Lorebook ist eine Sammlung von Fakten über deine Welt, die die KI liest, sobald ihre Schlüsselwörter im Chat auftauchen. Nutze eines für Orte, Fraktionen, Vorgeschichten und Regeln, damit du sie nicht in jeder Nachricht wiederholen musst.

Jedes Lorebook enthält Einträge. Ein Eintrag hat auslösende Schlüsselwörter und einen Textblock. Taucht ein Schlüsselwort im jüngsten Chatverlauf auf, fügt Marinara den Text des Eintrags in den Prompt ein, also in den Text, der für eine Antwort an das Modell geht. In anderen Tools heißen Lorebooks auch World Info.

Ein Beispiel: Ein Eintrag mit dem Schlüsselwort `Eldoria` und dem folgenden Text sorgt dafür, dass die KI die Stadt kennt, sobald jemand sie erwähnt.

```text
Eldoria is a rainy port city ruled by a council of nine merchants.
```

Der Abgleich über Schlüsselwörter funktioniert mit jedem Modell und braucht keine Einrichtung. Wie du nach Bedeutung statt nach exakten Wörtern abgleichst, steht unter [Semantische Suche für Lorebooks](semantic-search.md).

## Ein Lorebook anlegen und einen Eintrag hinzufügen

1. Öffne das Panel **Lorebooks** über die Seitenleiste.
2. Klick auf **New** (Neu, das Plus-Symbol). Das Fenster **Create Lorebook** (Lorebook erstellen) öffnet sich.
3. Gib im Feld **Name** einen Namen ein. Dieses Feld ist Pflicht.
4. Ergänze bei Bedarf eine **Description** (Beschreibung).
5. Wähle eine **Category** (Kategorie). Der Standard ist **Other**. Willst du dieses Lorebook mit einem Charakter verknüpfen, wähle **Character**, denn die Auswahl beim Charakter listet nur diese Kategorie.
6. Klick auf **Create Lorebook**. Das neue Lorebook erscheint in der Liste.
7. Klick auf die Zeile des Lorebooks. Der ganzseitige Editor öffnet sich.
8. Klick auf den Tab **Entries** (Einträge).
9. Klick auf **Add Entry** (Eintrag hinzufügen). Eine neue, leere Eintragszeile erscheint.
10. Gib in der Zeile einen Namen ein, etwa `Eldoria`, und klick dann auf die Zeile, um sie zu öffnen.
11. Gib in **Primary Keys** (Hauptschlüsselwörter) `Eldoria` ein und drück <kbd>Enter</kbd>.
12. Schreib in **Content** (Inhalt) den Text für die KI.

Kurz nachdem du aufhörst zu tippen, speichert sich der Eintrag von selbst, und du siehst **Saved automatically**. Ab jetzt kommt der Eintrag in den Prompt, sobald sein Schlüsselwort passt. Schlüsselwörter, Position und Timing erklärt [Lorebook-Einträge: Schlüsselwörter, Position und Timing](entries.md).

Wenn es nicht funktioniert hat: Prüf, ob das Lorebook im Chat aktiv ist (siehe unten), ob sein Schalter **Enabled** (Aktiviert) an ist und ob das Schlüsselwort in den letzten Nachrichten vorkommt. Marinara durchsucht nur so viele Nachrichten, wie die Einstellung **Scan Depth** angibt.

## Ein Lorebook in einem Chat aktiv machen

Ein Lorebook speist die KI nur, wenn es im geöffneten Chat aktiv ist. Dafür gibt es drei Wege.

| Weg | Wo du ihn einstellst | Aktiv in |
| --- | --- | --- |
| Global | Schalter **Global** im Tab **Overview** (Übersicht) des Lorebooks | Jedem Chat |
| Verknüpft | Tab **Overview** des Lorebooks oder Charakter- bzw. Persona-Editor | Chats mit diesem Charakter oder dieser Persona |
| Zu einem Chat hinzugefügt | **Chat Settings → Lorebooks** | Nur diesem Chat |

Ein Lorebook kann nicht zugleich global und verknüpft sein. Schaltest du **Global** ein, entfernt Marinara beim Speichern seine Charakter- und Persona-Verknüpfungen.

Auch ein aktives Lorebook braucht einen eingeschalteten Schalter **Enabled**. Wie du Lorebooks verknüpfst, steht unter [Lorebooks mit Charakteren und Personas verknüpfen](linking-to-characters.md).

## Die Einstellungen im Tab Overview

Öffne ein Lorebook und klick auf **Overview**, um festzulegen, wie sich das ganze Lorebook verhält.

| Einstellung | Was sie bewirkt | Standard |
| --- | --- | --- |
| **Scan Depth** | Wie viele der letzten Nachrichten Marinara auf Schlüsselwörter prüft. 0 durchsucht den ganzen Chat. | 2 |
| **Token Budget** | Die Höchstzahl an Tokens, die dieses Lorebook zu einer Antwort beisteuern kann. 0 bedeutet keine Grenze. | 2048 |
| **Entry Limit** | Die Höchstzahl an Einträgen, die dieses Lorebook zu einer Antwort beisteuern kann. Bereich 1 bis 1000. | 100 |
| **Max Depth** | Zusätzliche Durchläufe für die Rekursion. Erscheint nur, wenn **Recursive** an ist. Bereich 1 bis 10. | 3 |

Tokens sind kleine Textstücke, die Modelle zählen; im Englischen entspricht ein Token etwa drei Vierteln eines Worts. Was jede Grenze bewirkt und was Rekursion bedeutet, steht unter [Token-Budgets und Rekursion bei Lorebooks](token-budgets.md).

Der Tab hat außerdem diese Schalter.

- **Enabled** schaltet das ganze Lorebook ein oder aus. Standardmäßig ist es an.
- **Global** macht das Lorebook in jedem Chat aktiv.
- **Recursive** erlaubt, dass der Text eines aktivierten Eintrags weitere Einträge auslöst. Standardmäßig ist es aus.
- **Vectors** erlaubt Einträgen, auch über ihre Bedeutung zu passen. Standardmäßig ist es aus, und Schlüsselwörter funktionieren in jedem Fall.

Das Panel **Semantic search (embeddings)** unter den Schaltern beschreibt [Semantische Suche für Lorebooks](semantic-search.md).

## Das Lorebooks-Panel

Oben im Panel sitzen drei Symbol-Schaltflächen. Zeig mit der Maus darauf, um ihren Namen einzublenden.

- **New** öffnet das Fenster **Create Lorebook**.
- **Import** (Importieren) öffnet das Fenster **Import Lorebook** (Lorebook importieren). Siehe [Lorebooks importieren und exportieren](import-export.md).
- **Select** (Auswählen) schaltet die Mehrfachauswahl ein, damit du mehrere Lorebooks auf einmal exportieren oder löschen kannst.

Unter den Schaltflächen:

- **Search lorebooks** (Lorebooks durchsuchen) filtert nach Name, Beschreibung, verknüpften Charakter- oder Persona-Namen und Tags (Schlagwörtern).
- **Sort order** (Sortierreihenfolge) bietet **Manual order** (manuelle Reihenfolge), **A-Z**, **Z-A**, **Newest**, **Oldest** und **Token Budget**. Mit **Manual order** ziehst du die Lorebooks an ihren Platz oder nutzt <kbd>Alt</kbd>+<kbd>Pfeil nach oben</kbd> und <kbd>Alt</kbd>+<kbd>Pfeil nach unten</kbd>.
- **New Folder** (Neuer Ordner) legt einen Bibliotheksordner an. Zieh ein Lorebook darauf. Auf dem Handy hältst du das Lorebook gedrückt und ziehst es dann. Diese Ordner sind unabhängig von den Eintragsordnern innerhalb eines Lorebooks.

Jede Zeile hat die Schaltflächen **Copy** (Kopieren; dupliziert das Lorebook) und **Delete** (Löschen). Sie erscheinen, wenn du mit der Maus über die Zeile fährst, und sind auf Mobilgeräten immer sichtbar. Ein ausgeschaltetes Lorebook zeigt ein **OFF**-Badge. Klick auf das Bild, um es hochzuladen oder zu ersetzen.

### Kategorien

Eine Kategorie ist eine Beschriftung für deine Bibliothek. Sie ändert nichts daran, wann das Lorebook aktiv wird. Die Tabs sind **All**, **Active** (Lorebooks, die für den geöffneten Chat relevant sind), **World**, **Character**, **NPC**, **Spellbook** und **Other**. Die Kategorie eines Lorebooks änderst du in seinem Tab **Overview**, wo **Other** **Uncategorized** heißt.

## Verwandte Anleitungen

- [Lorebook-Einträge: Schlüsselwörter, Position und Timing](entries.md)
- [Token-Budgets und Rekursion bei Lorebooks](token-budgets.md)
- [Semantische Suche für Lorebooks](semantic-search.md)
- [Lorebooks mit Charakteren und Personas verknüpfen](linking-to-characters.md)
- [Lorebooks importieren und exportieren](import-export.md)
- [Wissensquellen: die Agenten Knowledge Retrieval und Knowledge Router](../agents/knowledge-sources.md)
