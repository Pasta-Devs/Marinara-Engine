# Token-Budgets und Rekursion bei Lorebooks

Budgets begrenzen, wie viel Lorebook-Text bei der KI ankommt, damit Lorebooks den Chat nicht verdrängen. In dieser Anleitung geht es um das **Token Budget** (Token-Budget) und das **Entry Limit** (Eintragsgrenze) jedes Lorebooks, um das **Lorebook Token Budget** (Token-Budget für Lorebooks) des Chats, darum, wie Marinara Einträge aussortiert, und um das rekursive Durchsuchen mit **Recursive** (rekursiv).

Tokens sind kleine Textstücke, die Modelle zählen. Das Kontextfenster eines Modells gibt an, wie viel Text es auf einmal lesen kann, gemessen in Tokens. Lorebook-Text teilt sich dieses Fenster mit dem restlichen Prompt.

## Zwei Token-Budgets

Marinara wendet jedes Mal, wenn es einen Prompt baut, zwei Budgets an. Würde ein Eintrag eines der beiden über seine Grenze bringen, wird er übersprungen.

- Jedes Lorebook hat ein eigenes **Token Budget**: die Höchstzahl an Tokens, die dieses Lorebook zu einer Antwort beisteuern kann.
- Jeder Chat hat ein einziges **Lorebook Token Budget**: die Höchstzahl an Tokens, die alle aktiven Lorebooks zusammen beisteuern können.

## Token Budget und Entry Limit eines Lorebooks festlegen

1. Öffne ein Lorebook im Panel **Lorebooks**.
2. Klick auf den Tab **Overview** (Übersicht).
3. Leg **Token Budget** und **Entry Limit** fest.

| Einstellung | Standard | Wirkung |
| --- | --- | --- |
| **Token Budget** | 2048 | Die Höchstzahl an Tokens, die dieses Lorebook zu einer Antwort beisteuert. 0 bedeutet unbegrenzt. |
| **Entry Limit** | 100 | Die Höchstzahl an Einträgen, die dieses Lorebook zu einer Antwort beisteuert. Möglich sind Werte von 1 bis 1000. |

Das **Entry Limit** zählt Einträge, nicht Tokens. Ein Lorebook fügt keine weiteren Einträge mehr hinzu, sobald es eine der beiden Grenzen erreicht.

Ein Beispiel: Bei einem **Token Budget** von 2048 kann ein einzelner Eintrag mit 3000 Tokens nie hinzukommen. Senke ein Budget, wenn ein Lorebook zu viel Platz belegt. Erhöhe es, wenn wichtige Einträge immer wieder übersprungen werden.

## Das Lorebook Token Budget des Chats festlegen

1. Öffne einen Chat.
2. Öffne **Chat Settings** (Chat-Einstellungen).
3. Suche den Abschnitt **Lorebooks** und trag einen Wert unter **Lorebook Token Budget** ein.

Der Standard ist 8192, 0 bedeutet unbegrenzt. Das ist die Summe für alle Lorebooks, die in diesem Chat aktiv sind – zusätzlich zum eigenen **Token Budget** jedes Lorebooks.

## So werden Einträge aussortiert

Passen mehr Einträge, als ein Budget zulässt, fügt Marinara die Einträge in dieser Reihenfolge hinzu.

1. **Constant**-Einträge.
2. Einträge, die zu den letzten Nachrichten gepasst haben.
3. Der Rest, in seiner Reihenfolge beim Einfügen (das Feld **Order** des Eintrags).

Marinara nimmt jeden Eintrag mit, der noch hineinpasst. Passt einer nicht, überspringt Marinara ihn und prüft die übrigen weiter. So kann ein kleinerer Eintrag noch hineinkommen, nachdem ein größerer übersprungen wurde.

<a id="seeing-skipped-entries-in-active-context"></a>

## Übersprungene Einträge im Active Context sehen

1. Öffne **Chat Settings**.
2. Klapp **Active Context** (aktiver Kontext) auf. Dort steht die letzte Lorebook-Suche.

Wurden passende Einträge übersprungen, steht oben ein Hinweis: „N matching lore entries were skipped by token budget.“ Er nennt jedes Budget, durch das Einträge übersprungen wurden, und wo du es änderst. Klapp ihn auf, um jeden übersprungenen Eintrag zu sehen, mit seinem Lorebook, seinen passenden Schlüsselwörtern, seiner geschätzten Größe und dem bereits verbrauchten Anteil des Budgets. Als Grund steht einer der folgenden da.

| Grund | Bedeutung |
| --- | --- |
| **lorebook budget** | Der Eintrag passte nicht ins **Token Budget** dieses Lorebooks. |
| **chat budget** | Der Eintrag passte nicht ins **Lorebook Token Budget** des Chats. |
| **lorebook and chat budgets** | Beide Grenzen waren bereits ausgeschöpft. |
| **current-location context cap** | Der Eintrag ist mit dem aktuellen Kartenort verknüpft, für den eine eigene, feste Grenze von 2.048 Tokens gilt. |

Ein Eintrag mit leerem Text oder mit Text, den Makros zu nichts machen, steht nicht in der Liste. Seine Makros laufen trotzdem, ein `{{setvar}}` darin setzt die Variable also weiterhin. Stehen beide Budgets auf 0, kann nur die Grenze für den Ort übersprungene Einträge aufführen.

Werden große Lorebooks immer wieder übersprungen, empfiehlt **Active Context** die Agenten **Knowledge Retrieval** oder **Knowledge Router**. Siehe [Wissensquellen](../agents/knowledge-sources.md). Für große Lorebooks eignen sie sich oft besser als eine höhere Grenze.

## Rekursives Durchsuchen

Normalerweise durchsucht Marinara nur deine letzten Nachrichten nach Schlüsselwörtern. Ist **Recursive** an, durchsucht es auch den Text neu aktivierter Einträge. So kann ein Eintrag verwandte Einträge nachziehen.

1. Öffne das Lorebook und klick auf **Overview**.
2. Schalte **Recursive** ein. Standardmäßig ist es aus.
3. Passe **Max Depth** an, wenn du ändern willst, wie weit die Verkettung reicht.

**Max Depth** ist die Anzahl zusätzlicher Suchdurchläufe. Der Standard ist 3, möglich sind Werte von 1 bis 10. Höhere Werte finden mehr zusammenhängendes Wissen und brauchen mehr Rechenzeit.

Jeder Eintrag hat außerdem einen eigenen Schalter **Recursion** (Rekursion), der standardmäßig aus ist. Er entscheidet, ob der Inhalt dieses Eintrags weitere Einträge auslösen kann. Lass ihn aus, solange der Eintrag keine weiteren nachziehen soll. Siehe [Lorebook-Einträge: Schlüsselwörter, Position und Timing](entries.md).

Rekursion umgeht die Budgets nicht. Einträge aus einem rekursiven Durchlauf zählen auf das **Token Budget**, das **Entry Limit** und das **Lorebook Token Budget** des Chats.

## Verwandte Anleitungen

- [Lorebook-Einträge: Schlüsselwörter, Position und Timing](entries.md)
- [Lorebooks – Überblick](overview.md)
- [Wissensquellen: die Agenten Knowledge Retrieval und Knowledge Router](../agents/knowledge-sources.md)
