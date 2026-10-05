# Token-Budgets und Rekursion bei Lorebooks

In dieser Anleitung erfährst du, wie Marinara Engine begrenzt, wie viel Lorebook-Text bei der KI ankommt. Es geht um das **Token Budget** (Token-Budget) und das **Entry Limit** (Eintragsgrenze) jedes einzelnen Lorebooks sowie um das chatweite **Lorebook Token Budget** (Token-Budget für Lorebooks). Außerdem erfährst du, wie Marinara Einträge aussortiert, sobald ein Budget voll ist, und was die Option **Recursive** (rekursiv) beim Durchsuchen bewirkt.

Ein Token ist ein kleines Textstück, ungefähr ein paar Zeichen lang. Jedes Modell hat ein begrenztes Kontextfenster – also eine Obergrenze dafür, wie viel Text es auf einmal lesen kann. Budgets sorgen dafür, dass die Lorebooks dieses Fenster nicht füllen und den eigentlichen Chat verdrängen.

## Zwei Token-Budgets

Marinara wendet bei jedem Prompt zwei getrennte Token-Budgets an. Würde ein Eintrag eines der beiden Budgets überschreiten, überspringt Marinara ihn.

1. Jedes Lorebook hat ein eigenes **Token Budget**. Es begrenzt, wie viel Text dieses eine Lorebook pro Antwort beisteuern darf.
2. Der Chat hat ein einziges **Lorebook Token Budget**. Es begrenzt den Text aus allen aktiven Lorebooks dieses Chats zusammen.

Beide Grenzen gelten gleichzeitig. Ein einzelner Eintrag kann am Lorebook-Budget scheitern, am Chat-Budget oder an beiden.

## Token Budget und Entry Limit eines Lorebooks festlegen

Öffne ein Lorebook im Panel **Lorebooks** und wechsle in den Tab **Overview** (Übersicht). Direkt bei den Sucheinstellungen findest du zwei Zahlenfelder.

- **Token Budget** (Standard **2048**): die maximale Anzahl Tokens, die dieses Lorebook pro Antwort beisteuern darf. **0** bedeutet unbegrenzt.
- **Entry Limit** (Standard **100**): die maximale Anzahl Einträge, die dieses Lorebook pro Antwort beisteuern darf. Möglich sind Werte von **1** bis **1000**.

Das **Entry Limit** ist eine eigenständige Grenze neben dem Token-Budget. Es zählt Einträge, nicht Tokens. Auch wenn im Token-Budget noch Platz ist: Sobald diese Grenze erreicht ist, fügt das Lorebook keine weiteren Einträge mehr hinzu. Umgekehrt kann das Token-Budget schon Einträge überspringen, während das Lorebook sein **Entry Limit** noch gar nicht ausgeschöpft hat.

Ein Beispiel: Ein Lorebook hat ein **Token Budget** von **2048** und einen Eintrag mit 3000 Tokens. Dieser Eintrag kommt nie durch. Senke das Budget nur dann, wenn ein Lorebook zu viel Platz belegt. Erhöhe es, wenn wichtige Einträge ständig übersprungen werden.

## Das chatweite Lorebook Token Budget

Die Grenze auf Chat-Ebene steckt im Panel **Settings** (Einstellungen) des Chats, im Abschnitt **Lorebooks**.

1. Öffne einen Chat.
2. Öffne das Panel **Settings** des Chats.
3. Suche den Abschnitt **Lorebooks**.
4. Trag einen Wert im Feld **Lorebook Token Budget** ein.

Der Standard ist **8192**. **0** bedeutet unbegrenzt. Dieses Budget gilt für alle Lorebooks zusammen, die in diesem Chat aktiv sind – zusätzlich zum eigenen **Token Budget** jedes Lorebooks.

## So werden Einträge aussortiert

Passen mehr Einträge, als ein Budget zulässt, behält Marinara die wichtigsten und verwirft den Rest. Vor dem Aussortieren sortiert Marinara die Einträge, damit genau die überleben, die du am ehesten brauchst.

- **Constant**-Einträge kommen zuerst. Das sind Einträge, die Marinara immer einfügt, solange das Lorebook aktiv ist.
- Danach folgen die Einträge, die zur letzten Nachricht gepasst haben.
- Die übrigen Einträge schließen sich in ihrer normalen Reihenfolge an.

Marinara arbeitet diese Liste von oben nach unten ab und nimmt jeden Eintrag mit, der noch hineinpasst. Würde ein Eintrag ein Budget überschreiten, überspringt Marinara ihn und macht weiter. Alle Einträge darunter werden trotzdem geprüft. Ein kleinerer Eintrag kann es also noch schaffen, nachdem ein größerer herausgefallen ist.

<a id="seeing-skipped-entries-in-active-context"></a>

## Übersprungene Einträge im Active Context sehen

Du musst nicht raten, welche Einträge herausgefallen sind. Öffne **Chat Settings** und klapp den Abschnitt **Active Context** (aktiver Kontext) auf. Dort steht das aktuelle Ergebnis der letzten Lorebook-Suche.

Wurden passende Einträge übersprungen, erscheint oben ein bernsteinfarbener Hinweis. Er lautet "N matching lore entries were skipped by token budget." Klapp ihn auf, um jeden übersprungenen Eintrag zu sehen.

Bei jedem übersprungenen Eintrag stehen das Lorebook, aus dem er stammt, und der Grund für die Blockade. Der Grund ist einer von diesen:

- **lorebook budget**: Der Eintrag passte nicht ins **Token Budget** dieses einen Lorebooks.
- **chat budget**: Der Eintrag passte nicht ins chatweite **Lorebook Token Budget**.
- **lorebook and chat budgets**: Beide Grenzen waren bereits ausgeschöpft.

Klapp einen übersprungenen Eintrag auf, um Details zu sehen. Dort stehen die passenden Schlüsselwörter, die geschätzte Größe in Tokens und der bereits verbrauchte Anteil des Budgets. Fallen große Lorebooks immer wieder heraus, empfiehlt **Active Context** die Agenten **Knowledge Retrieval** und **Knowledge Router**. Damit lassen sich große Lorebooks meist besser bändigen als durch höhere Grenzwerte.

## Rekursives Durchsuchen

Normalerweise durchsucht Marinara nur die letzten Nachrichten nach passenden Schlüsselwörtern. Ist **Recursive** aktiv, kommt der Text der gerade aktivierten Einträge dazu. So kann ein aktivierter Eintrag verwandte Einträge nachziehen, deren Schlüsselwörter in seinem Text vorkommen.

Aktivieren lässt sich das im Lorebook-Tab **Overview**.

1. Öffne das Lorebook.
2. Öffne den Tab **Overview**.
3. Aktiviere den Schalter **Recursive**. Standardmäßig ist er aus.
4. Passe **Max Depth** an, wenn du die Kettenlänge ändern willst.

**Max Depth** (Standard **3**) legt fest, wie viele zusätzliche Suchdurchläufe stattfinden. Jeder Durchlauf prüft die neu aktivierten Einträge auf weitere Schlüsselwörter. Möglich sind Werte von **1** bis **10**. Höhere Werte finden mehr zusammenhängendes Wissen, brauchen aber mehr Rechenzeit.

Auch pro Eintrag ist Rekursion Opt-in. Im aufgeklappten Panel eines Eintrags steuert der Schalter **Recursion** (Rekursion), ob dessen Inhalt weitere Einträge auslösen darf. Standardmäßig ist er aus. Lass ihn aus, solange dieser Eintrag keine weiteren Einträge nachziehen soll. Alle Einstellungen eines Eintrags findest du unter [Lorebook-Einträge: Schlüsselwörter, Position und Zeitpunkt](entries.md).

Rekursion umgeht die Budgets nicht. Einträge aus einem rekursiven Durchlauf zählen genauso auf das **Token Budget**, das **Entry Limit** und das chatweite **Lorebook Token Budget** wie alle anderen.

## Verwandte Anleitungen

- [Lorebook-Einträge: Schlüsselwörter, Position und Zeitpunkt](entries.md)
- [Lorebooks im Überblick](overview.md)
- [Wissensquellen: Retrieval- und Router-Agenten](../agents/knowledge-sources.md)
