# Lorebooks mit Charakteren und Personas verknüpfen

Verknüpfe ein Lorebook mit einem Charakter oder einer Persona, und es schaltet sich in den richtigen Chats von selbst ein. Du kannst ein Lorebook auch in eine Charakterkarte einbetten und Lorebooks für einen einzelnen Chat steuern. Neu bei Lorebooks? Fang mit [Lorebooks – Überblick](overview.md) an.

## Verknüpfen oder einbetten

| Merkmal | Verknüpfen (zuweisen) | Einbetten |
| --- | --- | --- |
| Was passiert | Der Charakter oder die Persona verweist auf ein Lorebook in deiner Bibliothek. | Das Lorebook wird in die Charakterkarte geschrieben. |
| Schaltet sich ein | In Chats mit diesem Charakter oder dieser Persona. | Ebenso, und es reist mit der Karte mit. |
| Wird mit der Karte exportiert | Nein | Ja |
| Verfügbar für | Charaktere und Personas | Nur Charaktere |

Meistens ist Verknüpfen die richtige Wahl. Bette nur ein, wenn du die Karte mitsamt Lorebook weitergeben willst.

## Der Lorebook-Tab im Editor

Sowohl der Charakter-Editor als auch der Persona-Editor haben einen Tab **Lorebook**.

1. Öffne einen Charakter oder eine Persona zum Bearbeiten.
2. Klick auf den Tab **Lorebook**. Der Bereich **Lorebooks** hat zwei Schaltflächen: **New** (Neu) und **Assign Lorebook** (Lorebook zuweisen).

**New** legt ein Lorebook an, das bereits mit diesem Charakter oder dieser Persona verknüpft ist und dessen Kategorie auf **Character** steht. **Assign Lorebook** verknüpft ein Lorebook, das du schon hast.

## Ein vorhandenes Lorebook zuweisen

Bevor du anfängst: Die Auswahl zeigt nur Lorebooks, deren **Category** (Kategorie) **Character** ist, auch bei Personas. Fehlt ein Lorebook, öffne es, setz im Tab **Overview** (Übersicht) die **Category** auf **Character** und versuch es erneut.

1. Klick im Tab **Lorebook** auf **Assign Lorebook**.
2. Tipp einen Teil des Namens ins Suchfeld.
3. Klick auf das Lorebook. Ein Häkchen erscheint.
4. Lass **Scope** (Geltungsbereich) auf **All chats with** mit dem Namen stehen oder ändere ihn (siehe unten).
5. Klick auf **Assign** (Zuweisen).

Das Lorebook steht jetzt in der Liste der zugewiesenen Lorebooks. Mit der Schaltfläche **Scope** in seiner Zeile änderst du den Geltungsbereich, mit dem Papierkorb-Symbol löst du die Verknüpfung. Klick auf den Namen, um das Lorebook zu öffnen.

Ein globales Lorebook kann nicht zusätzlich verknüpft werden. Siehe [Lorebooks – Überblick](overview.md).

### Scope

**Scope** legt fest, welche Chats das verknüpfte Lorebook nutzen dürfen. Infrage kommen immer nur Chats mit diesem Charakter oder mit dieser Persona.

| Scope | Ergebnis |
| --- | --- |
| **All chats with** (der Name) | Der Standard. Das Lorebook schaltet sich in jedem dieser Chats ein. |
| **Disabled for all chats** | Die Verknüpfung bleibt, aber das Lorebook schaltet sich nie ein. Nutze das zum Pausieren. |
| **Specific chats** | Nur die Chats, die du in der Liste anhakst. Du musst mindestens einen anhaken, bevor du speichern kannst. |

Um den Geltungsbereich später zu ändern, klick in der Zeile auf **Scope**, pass ihn an und klick erneut auf **Assign**.

## Ein Lorebook in eine Charakterkarte einbetten

Bevor du anfängst: Weise das Lorebook zuerst dem Charakter zu (siehe oben).

1. Öffne den Charakter und klick auf den Tab **Lorebook**.
2. Klick in der Zeile des Lorebooks auf **Embed into card** (in Karte einbetten).

In der Zeile erscheint ein **Embedded**-Badge, und die Einträge werden ab jetzt mit der Karte exportiert.

Eine Karte fasst ein eingebettetes Lorebook. Hat sie schon eines, ist **Embed into card** deaktiviert, und der Tooltip weist darauf hin, zuerst das aktuelle eingebettete Lorebook zu entfernen.

Nachdem du das verknüpfte Lorebook bearbeitet hast, klick in seiner Zeile auf **Refresh** (aktualisieren), um die eingebettete Kopie aus den aktuellen Einträgen neu zu schreiben.

### Ein eingebettetes Lorebook verwalten

Hat eine Karte ein eingebettetes Lorebook, erscheinen unter der Liste der zugewiesenen Lorebooks diese Bedienelemente, dazu eine schreibgeschützte Liste seiner Einträge.

- **Import Embedded Lorebook** (eingebettetes Lorebook importieren) macht aus den Einträgen der Karte ein normales Lorebook in deiner Bibliothek, das mit dem Charakter verknüpft ist. Gibt es bereits eine verknüpfte Kopie, heißt die Schaltfläche **Reimport Embedded Lorebook**.
- **Edit Embedded Lorebook** (eingebettetes Lorebook bearbeiten) öffnet dieses verknüpfte Lorebook. Deine Änderungen werden in die Kopie in der Karte übernommen.
- **Remove from card** (aus Karte entfernen) löscht die eingebettete Kopie. Ein separat verknüpftes Lorebook bleibt unangetastet.

Viele Karten aus anderen Tools bringen ein eingebettetes Lorebook mit. Klick auf **Import Embedded Lorebook**, um eine bearbeitbare Fassung zu bekommen.

## Der Bereich Lorebooks in den Chat Settings

Jeder Chat hat seine eigene Lorebook-Steuerung.

1. Öffne einen Chat.
2. Öffne **Chat Settings** (Chat-Einstellungen).
3. Suche den Bereich **Lorebooks**. Ein Badge zeigt, wie viele Lorebooks aktiv sind.

Jedes aktive Lorebook trägt ein Badge, das sagt, warum es an ist.

| Badge | Bedeutung |
| --- | --- |
| **Chat** | Du hast es diesem Chat hinzugefügt. |
| **Global** | Es ist ein globales Lorebook. |
| **Character** | Es ist mit einem Charakter in diesem Chat verknüpft. |
| **Persona** | Es ist mit der Persona dieses Chats verknüpft. |

Was aktiv ist, kannst du nur für diesen Chat ändern.

- **Add Lorebook** (Lorebook hinzufügen) fügt diesem Chat ein Lorebook hinzu. Es trägt dann das Badge **Chat**.
- Das Papierkorb-Symbol (**Remove from chat**, aus dem Chat entfernen) entfernt ein Lorebook, das du hinzugefügt hast.
- Das durchgestrichene Auge (**Disable in this chat**, in diesem Chat deaktivieren) blendet ein automatisches Lorebook hier aus, ohne die Verknüpfung zu lösen. Es zeigt dann einen durchgestrichenen Namen und ein Badge **Disabled**.
- Das Auge-Symbol (**Enable in this chat**, in diesem Chat aktivieren) schaltet es wieder ein.

### Lorebook Token Budget

**Lorebook Token Budget** begrenzt, wie viele Tokens Lorebook-Text dieser Chat hinzufügen kann. Der Standard ist 8192, und 0 bedeutet keine Grenze. Die Grenze gilt zusätzlich zum eigenen **Token Budget** jedes Lorebooks. Siehe [Token-Budgets und Rekursion bei Lorebooks](token-budgets.md).

## Verwandte Anleitungen

- [Lorebooks – Überblick](overview.md)
- [Token-Budgets und Rekursion bei Lorebooks](token-budgets.md)
- [Lorebooks importieren und exportieren](import-export.md)
- [Charaktere anlegen und bearbeiten](../characters/creating-and-editing-characters.md)
- [Chat Settings im Überblick](../chats/chat-settings.md)
