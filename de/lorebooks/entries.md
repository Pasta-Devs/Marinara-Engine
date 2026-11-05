# Lorebook-Einträge: Schlüsselwörter, Position und Timing

Ein Eintrag ist eine einzelne Tatsache in einem Lorebook, zusammen mit den Regeln, die entscheiden, wann Marinara sie in den Prompt einfügt. In dieser Anleitung erfährst du, wie du Einträge anlegst, Schlüsselwörter und Eintragstypen wählst, festlegst, wo ein Eintrag landet, und das Timing steuerst.

Bevor du anfängst: Leg ein Lorebook an und öffne es. Siehe [Lorebooks – Überblick](overview.md).

## Der Entries-Tab

Öffne ein Lorebook im Panel **Lorebooks**. Der Editor hat zwei Tabs, **Overview** (Übersicht) und **Entries** (Einträge). Klick auf **Entries**, um die Liste zu sehen. Das Badge am Tab zeigt, wie viele Einträge du hast.

Die Werkzeugleiste bietet diese Bedienelemente:

- **Search entries…** (Einträge durchsuchen) filtert nach Name, Schlüsselwörtern oder Inhalt.
- Das Sortiermenü bietet **Order**, **Entries**, **Name A→Z**, **Name Z→A**, **Tokens ↓**, **Keys ↓**, **Fired ↓**, **Newest** und **Oldest**. Die ↓-Optionen sortieren vom höchsten zum niedrigsten Wert.
- **Select** (Auswählen) schaltet die Mehrfachauswahl ein, damit du mehrere Einträge kopieren, verschieben oder löschen kannst.
- **Add Folder** (Ordner hinzufügen) legt einen Ordner an (siehe [Eintrags-Ordner](#entry-folders)).
- **Add Entry** (Eintrag hinzufügen) legt ganz oben einen leeren Eintrag an.

Eine Zeile unter der Werkzeugleiste zeigt die Anzahl der Einträge, die Anzahl der Ordner und die geschätzte Token-Summe aller Eintragsinhalte.

## Einträge anlegen und bearbeiten

1. Klick auf **Add Entry**. Eine neue Zeile erscheint.
2. Trag in der Zeile einen Namen ein. Jeder Eintrag braucht einen. Der Name ist für dich und für die Suche da, nicht für die KI.
3. Klick auf die Zeile oder auf ihren Pfeil. Unter der Zeile öffnet sich ein Panel mit allen Feldern.
4. Tipp ein Schlüsselwort in **Primary Keys** (Hauptschlüsselwörter) ein und drück <kbd>Enter</kbd>. Schreib dann den Text für die KI in **Content** (Inhalt). Siehe [Inhalt und Schlüsselwörter](#content-and-keys).

Änderungen speichern sich von selbst. Das aufgeklappte Panel zeigt **Autosaving…**, dann **Saving…** und dann **Saved automatically**. Schlägt das Speichern fehl, bleibt dein Text erhalten, und Marinara versucht es bei deiner nächsten Änderung erneut.

Zum Kopieren klickst du in der Zeile eines Eintrags auf **Duplicate entry** (Eintrag duplizieren). Zum Entfernen klickst du auf **Delete entry** (Eintrag löschen) und bestätigst. Am Computer erscheinen diese Schaltflächen, wenn du auf die Zeile zeigst.

<a id="content-and-keys"></a>

### Inhalt und Schlüsselwörter

| Feld | Was es ist |
| --- | --- |
| **Primary Keys** | Wörter, die den Eintrag auslösen. Tipp ein Schlüsselwort ein und drück <kbd>Enter</kbd>, um es hinzuzufügen. Schon ein einziger Treffer aktiviert einen **Normal**-Eintrag. |
| **Content** | Der Text, der an die KI geht. Schreib eine schlichte Tatsache. Er kann [Makros](../prompts/macros.md) verwenden, und unter dem Feld steht eine Token-Schätzung. |
| **Secondary Keys** | Zusätzliche Schlüsselwörter, die nur **Selective**-Einträge nutzen. |
| **Description** | Eine kurze Zusammenfassung, die nur der Agent **Knowledge Router** liest. Sie geht nie an das Hauptmodell. Siehe [Wissensquellen](../agents/knowledge-sources.md). |

Eine Liste mit mehr als 10 Schlüsselwörtern zeigt die ersten 10. Klick auf **Show N more** (N weitere anzeigen), um den Rest zu sehen, und auf **Collapse** (Einklappen), um ihn wieder auszublenden. Ausgeblendete Schlüsselwörter treffen weiterhin.

Ein Eintrag namens `Silverhaven` mit den Schlüsselwörtern `Silverhaven` und `the capital` und dem Inhalt `Silverhaven is the mountain capital. Its people mine blue crystal and distrust outsiders.` erreicht die KI zum Beispiel immer dann, wenn eines der beiden Schlüsselwörter im jüngsten Chatverlauf auftaucht.

### Regeln für Schlüsselwort-Treffer

Standardmäßig trifft ein Schlüsselwort, sobald es irgendwo im jüngsten Chatverlauf vorkommt; Groß- und Kleinschreibung spielt dabei keine Rolle. Drei Bedienelemente ändern das.

- **Whole Words** (Eintrags-Panel, standardmäßig aus): Das Schlüsselwort muss ein ganzes Wort sein. `Ash` trifft „Ash“, aber nicht „cash“.
- **Case Sensitive** (Eintrags-Panel, standardmäßig aus): Groß- und Kleinschreibung müssen übereinstimmen. `IT` trifft „IT“, aber nicht „it“.
- **Regex** (ein Symbol in der Zeile mit dem Tooltip **Enable regex key matching**, standardmäßig aus): Jedes Schlüsselwort gilt als regulärer Ausdruck, also als Muster, das Text abgleicht. Das Symbol färbt sich orange, wenn es an ist.

Nutz **Regex** nur, wenn du dich mit regulären Ausdrücken auskennst. Jedes Muster läuft mit einem kurzen Zeitlimit, und ein Muster, das zu lange läuft, trifft nicht – halte Muster deshalb einfach. `\bVlad(?:'s)?\b` trifft zum Beispiel „Vlad“ und „Vlad's“.

## Einen Eintragstyp wählen

Klick auf den farbigen Punkt in der Zeile, um das Typmenü zu öffnen.

- **Normal** (grüner Punkt, der Standard): wird aktiv, wenn ein Primary Key trifft. Nimm ihn für die meisten Einträge: Personen, Orte, Gegenstände. Gib jedem drei bis acht konkrete Schlüsselwörter.
- **Constant** (gelber Punkt): wird jedes Mal aktiv, solange das Lorebook aktiv ist – ganz ohne Schlüsselwort. Nimm ihn für die wenigen Tatsachen, die immer präsent sein müssen, etwa das Jahr oder den Ton. Timing, Wahrscheinlichkeit und Filter gelten trotzdem.
- **Selective** (roter Punkt): wird aktiv, wenn ein Primary Key trifft und die Logik der Secondary Keys aufgeht. Nimm ihn, wenn ein Allerweltswort sonst in der falschen Szene auslösen würde.

Jeder **Constant**-Eintrag kostet bei jeder Nachricht Tokens, also halte ihre Zahl klein.

Für einen **Selective**-Eintrag ergänzt du **Secondary Keys** (Zweitschlüsselwörter) und wählst eine **Logic**-Schaltfläche (Verknüpfung).

| Logic | Wann der Eintrag auslöst |
| --- | --- |
| **AND Any** | Mindestens ein Secondary Key kommt ebenfalls vor. |
| **AND All** | Jeder Secondary Key kommt ebenfalls vor. |
| **NOT Any** | Kein Secondary Key kommt vor. |
| **NOT All** | Nicht alle Secondary Keys kommen gemeinsam vor. |

Ein Eintrag mit dem Primary Key `king`, dem Secondary Key `Silverhaven` und **AND Any** löst zum Beispiel nur aus, wenn der Chat beide erwähnt.

Wenn es nicht funktioniert hat: Ein **Normal**-Eintrag ohne Schlüsselwörter bietet nichts, was treffen könnte. Ergänze Schlüsselwörter oder stell ihn auf **Constant**. Ein Eintrag ohne Schlüsselwörter lässt sich zwar trotzdem nach Bedeutung finden, aber nur bei vollständig eingerichteter [semantischer Suche](semantic-search.md).

## Position, Depth und Order

Diese Bedienelemente legen fest, wo ein aktivierter Eintrag im Prompt landet. Auf einem breiten Bildschirm sitzen sie in der kompakten Zeile. Auf einem schmalen Bildschirm tippst du in der Zeile auf die Schaltfläche **Entry quick controls** (Schnellsteuerung des Eintrags).

| Bedienelement | Was es tut |
| --- | --- |
| **Position** | Wohin der Eintrag kommt. Der Standard ist **Before character definitions**. |
| **Before character definitions** | Vor der Charakterkarte im Prompt. Kurzbeschriftung in der Zeile: **↑Char**. |
| **After character definitions** | Hinter der Charakterkarte. Kurzbeschriftung in der Zeile: **↓Char**. |
| **@ Depth** | Mitten im Chatverlauf. Kurzbeschriftung in der Zeile: **@Depth**. |
| **Outlet** | Nirgendwo automatisch (siehe unten). |
| **Depth** | Erscheint nur bei **@ Depth**. Wie viele Nachrichten vor der neuesten der Eintrag sitzt. Standard 4. |
| **Order** | Die Reihenfolge, wenn mehrere Einträge aktiv werden. Ein niedrigerer Wert kommt zuerst und übersteht das Kürzen, wenn das Budget knapp ist. Standard 100. |

Die Einstellung **Role** (Rolle) sitzt im aufgeklappten Eintrags-Panel, nicht in der Schnellsteuerung. Sie kennzeichnet den eingefügten Text als **System**, **User** oder **Assistant**, wirkt sich nur bei **@ Depth** aus und steht standardmäßig auf **System**.

Lass diese Einstellungen auf ihren Standardwerten, solange ein Eintrag nicht mehr braucht. Setz **@ Depth** sparsam ein. Der Text landet wie ein Zwischenruf zwischen den jüngsten Nachrichten, also heb es dir für eine Regel auf, die das Modell immer wieder vergisst, oder für eine Tatsache, die sich gerade erst geändert hat. Zum Beispiel „The tavern is now on fire.“ bei **@ Depth** 1.

### Outlet

Ein **Outlet**-Eintrag erscheint nur dort, wo du ein Makro platzierst.

1. Stell **Position** auf **Outlet**. Ein Feld **Outlet name** (Outlet-Name) erscheint.
2. Gib einen exakten Namen ein, etwa `character_rules`; Groß- und Kleinschreibung zählt.
3. Setz `{{outlet::character_rules}}` in einen Prompt-Abschnitt deines [Presets](../prompts/presets.md).

Einträge mit demselben Namen hängt Marinara in der Reihenfolge von **Order** aneinander, getrennt durch Zeilenumbrüche. Outlet-Makros funktionieren in Prompt-Abschnitten von Conversation-, Roleplay- und Game-Chats. Es erscheinen nur Einträge, die für diese Antwort aktiviert wurden. Sie unterliegen weiterhin den Regeln für Schlüsselwörter, Wahrscheinlichkeit, Filter, Timing, **Entry Limit** und **Token Budget**. Ohne aktive Einträge fügt das Makro nichts ein. Ein Outlet-Eintrag kann kein weiteres Outlet-Makro aufrufen. Zum Makro selbst siehe [Makros](../prompts/macros.md).

## Wahrscheinlichkeit und Timing

**Probability** (Wahrscheinlichkeit) ist die Chance, dass ein Eintrag auslöst, wenn seine Schlüsselwörter treffen. Der Standard ist 100 %. Mit 25 % liegt die Chance jedes Mal bei eins zu vier.

Die **Timing**-Felder steuern das Verhalten über mehrere Nachrichten hinweg. Alle vier sind anfangs nicht gesetzt, also aus.

| Feld | Was es tut | Beispiel |
| --- | --- | --- |
| **Sticky** | Nach dem Auslösen bleibt der Eintrag noch so viele Nachrichten lang aktiv, auch ohne Schlüsselwort-Treffer. | Ein enthülltes Geheimnis bei 3 bleibt drei Nachrichten lang drin. |
| **Cooldown** | Nach dem Auslösen wartet er so viele Nachrichten, bevor er erneut auslösen kann. | Ein Omen bei 5 löst höchstens alle fünf Nachrichten einmal aus. |
| **Delay** | Er kann erst auslösen, wenn der Chat so viele Nachrichten erreicht hat. | Eine Wendung bei 20 bleibt anfangs verborgen. |
| **Ephemeral** | Nach so vielen Aktivierungen schaltet er sich selbst ab. 0 bedeutet unbegrenzt. | Ein Intro-Hinweis bei 1 löst einmal aus. |

**Sticky**, **Cooldown** und **Delay** zählen Nachrichten. **Ephemeral** zählt Aktivierungen.

<a id="decision-activation"></a>

## Aktivierung mit Decisions

Über das Feld **Decision** entscheidet dein Decision-Modell – ein kleines Modell, das Ja-Nein-Fragen beantwortet –, ob ein Eintrag passt. Schreib eine Aussage über den jüngsten Chat, etwa `In the latest message, a dragon is physically present`, und wähl einen Modus.

| Modus | Wirkung |
| --- | --- |
| **Off** | Der Eintrag wird wie gewohnt aktiviert. Das ist der Standard. |
| **Require** | Der Eintrag wird wie gewohnt aktiviert, aber nur, wenn die Aussage außerdem wahr ist. Das filtert beiläufige Erwähnungen heraus. |
| **Trigger** | Die Aussage ist ein weiterer Weg, den Eintrag zu aktivieren, auch wenn kein Schlüsselwort vorkommt. Sie erfasst Umschreibungen und Situationen. |

In der Aussage kannst du Makros wie `{{user}}` und `{{char}}` verwenden.

Bevor du anfängst: Wähl im Panel **Connections** (Verbindungen) unter **Decision model** (Entscheidungsmodell) ein Decision-Modell. Ohne Decision-Modell oder ohne Antwort gilt die Aussage als nein. Der Editor warnt dich, wenn keines gewählt ist.

- **Require** lässt dann nie einen neuen Eintrag zu; eine bestehende **Sticky**-Haltezeit kann einen Eintrag aber aktiv halten.
- **Trigger** ergänzt keinen Aktivierungsweg, und der Eintrag kann weiterhin über seine Schlüsselwörter aktiviert werden.

Gib wichtigen Einträgen auch einen gewöhnlichen Aktivierungsweg, und nutz **Require** nur, um optionales Weltwissen zu filtern.

**Require** prüft nur einen Eintrag, der sich bereits über Schlüsselwörter, einen semantischen Treffer, **Constant** oder einen Kartenort qualifiziert, und lässt ihn dann nur zu, wenn die Aussage außerdem wahr ist. Bei einem **Constant**-Eintrag macht es den Eintrag situationsabhängig, etwa Kampfregeln mit `A fight is happening in the latest message`. Es durchsucht nicht jeden ungenutzten Eintrag.

Decision-Aussagen verursachen zusätzliche Modellanfragen und teilen sich das Limit **Decision statements per turn** (Decision-Aussagen pro Zug). Tipps zur Formulierung, Grenzen, Kosten und zur Wiederverwendung von Antworten findest du unter [Aussagen formulieren](../prompts/conditional-prompts.md#writing-statements), [Grenzen und Kosten](../prompts/conditional-prompts.md#limits-and-cost) und [Antworten wiederverwenden](../prompts/conditional-prompts.md#answer-reuse). Zur Einrichtung des Modells siehe [Decision-Modelle](../connections/decision-models.md).

Weitere Einzelheiten:

- Ein Eintrag, der **sticky** ist, wird während seiner Haltezeit nicht erneut gefragt, und ein Eintrag im Cooldown wird gar nicht gefragt.
- Die Liste aktiver Lorebooks zeigt **decision** bei einem Eintrag, den eine **Trigger**-Aussage aktiviert hat.
- **Peek Prompt** fragt nie selbst an. Es zeigt die Antworten, die für den Zug schon vorliegen.
- Decision-Aktivierung gilt nur für Chat-Züge. Die Game-Einrichtung und die Scans, die Agenten für sich selbst ausführen, werten Decision-Einträge als nein.
- Ein `{{#if decision:"..."}}` im Inhalt des Eintrags ist etwas anderes. Es kürzt den Text eines Eintrags, der bereits aktiviert wurde.

## Gruppen, Filter und weitere Optionen

Das aufgeklappte Panel enthält weitere Felder.

| Feld | Was es tut |
| --- | --- |
| **Group** | Einträge in derselben Gruppe schließen sich gegenseitig aus. Pro Antwort wird nur einer aktiv. Nimm es für Alternativen, etwa drei Einträge „weather today“. Kombinier es mit einer niedrigen **Probability**, damit Gerüchte nur gelegentlich auftauchen. |
| **Tag** | Ein frei wählbares Schlagwort für deine eigene Sortierung. Auf die Aktivierung wirkt es sich nicht aus. |
| **Locked** | Verhindert, dass der Agent **Lorebook Keeper** diesen Eintrag ändert. Siehe [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md). |
| **No Vector** | Nimmt den Eintrag von der semantischen Suche aus. Siehe [Semantische Suche für Lorebooks](semantic-search.md). |
| **Recursion** | Lässt den Inhalt dieses Eintrags weitere Einträge auslösen. Standardmäßig aus. Siehe [Token-Budgets und Rekursion bei Lorebooks](token-budgets.md). |

Der Abschnitt **Context filters & matching sources** (Kontextfilter und Trefferquellen) beschränkt einen Eintrag auf bestimmte Charaktere, Charakter-Tags oder Generierungsarten. Außerdem kannst du dort weitere Kartenfelder, etwa die Charakterbeschreibung, nach den Schlüsselwörtern des Eintrags durchsuchen lassen. In einem Gruppenchat im Modus **Individual** zählt bei jeder Antwort nur der Charakter, der sie schreibt; ein Charakterfilter hält den Eintrag also aus den Antworten anderer Charaktere heraus. Bei einer Antwort im Modus **Merged (Narrator)** zählt jeder Charakter im Chat; der Eintrag bleibt also drin, wenn irgendein gefilterter Charakter im Chat ist. Nutz das für Geheimnisse, die nur ein Charakter kennt.

## Einstellungen für eine Tatsache wählen

Frag dich, wann die KI die Tatsache sehen soll, und nimm dann diese Tabelle zu Hilfe.

| Die Tatsache | Einrichtung |
| --- | --- |
| Gilt immer | **Constant**. Davon nur wenige. |
| Zählt nur, wenn sie genannt wird | **Normal** mit konkreten Schlüsselwörtern wie `Castle Dracul`, `the castle`, `the fortress`. |
| Ihr Schlüsselwort ist ein Allerweltswort wie `king` oder `home` | **Whole Words** oder **Selective** mit Secondary Keys. |
| Wichtig, aber selten beim Namen genannt | **Normal** mit [semantischer Suche](semantic-search.md) oder breitere Schlüsselwörter. |
| Mehrere Fassungen, die nicht zusammen auftauchen dürfen | Dieselbe **Group**. |
| Eine Regel, die das Modell mitten in der Szene vergisst | **@ Depth** bei etwa 1 bis 4. |

Gewohnheiten, die ein Lorebook schlank halten:

- Nimm konkrete Schlüsselwörter. Ein Schlüsselwort wie `he` oder `the city` trifft fast jede Nachricht und verschwendet Budget.
- Füll **Description** bei jedem Eintrag aus, den der **Knowledge Router** auswählen soll. Er liest die Beschreibung, nicht den Inhalt.
- Bau große Welten als Baum auf. Leg neben einem Eintrag für jedes Mitglied einen Hub-Eintrag für die Gruppe an, etwa einen für das Imperium, der seine Mitglieder aufzählt.
- Lass **Recursion** bei Hubs aus. Sonst zieht schon der Name der Gruppe den vollständigen Eintrag jedes Mitglieds auf einmal in den Prompt.

Nimm zum Beispiel die Regel, wie sich der Schurke töten lässt – eine Tatsache, die die KI gern vergisst. Stell sie auf **Selective** mit **AND Any**, schalt **Whole Words** ein und setz **Order** auf 10. Nimm die Primary Keys `weakness`, `kill`, `destroy`, `stake` und die Secondary Keys `Vlad`, `the count`. Die Secondary Keys halten den Eintrag still, wenn die Party einen Wolf erlegt. **Whole Words** verhindert, dass `stake` in „mistake“ trifft. Der niedrige Order-Wert bewahrt ihn in einer vollen Szene vor dem Kürzen.

Wo ein Lorebook liegt, entscheidet darüber, welche Chats es sehen. Zu globalen, verknüpften und eingebetteten Lorebooks siehe [Lorebooks – Überblick](overview.md) und [Lorebooks mit Charakteren und Personas verknüpfen](linking-to-characters.md).

## Makros im Eintragsinhalt

**Content** wird vor dem Senden wie jeder andere Prompt-Text ausgewertet. Nützliche Makros:

- `{{char}}` und `{{user}}` liefern die Namen, damit ein geteilter Eintrag in jedem Chat gut klingt.
- `{{roll:1d6}}` wirft einen Würfel. `{{setvar::mood::angry}}` speichert einen Wert für diesen Chat, und `{{getvar::mood}}` liest ihn wieder aus.
- `{{random::a::b::c}}` wählt eine Option aus. Ergänze Gewichte, wie in `{{random::common@3::rare@1}}`. Zusammen mit einer niedrigen **Probability** passt so eine ganze Begegnungstabelle in einen einzigen Eintrag.
- `{{include::Entry name}}` fügt den Text eines anderen Eintrags aus demselben Lorebook ein, selbst eines ausgeschalteten. Siehe [Makro zum Einbinden von Lorebook-Einträgen](../prompts/macros.md#lorebook-include-macro).
- `{{// note}}` ist ein Kommentar. Er wird entfernt, bevor die KI ihn sieht und bevor die Rekursion den Text durchsucht; er kann also nie etwas auslösen.

Die vollständige Liste steht unter [Prompt-Makros](../prompts/macros.md).

Ist **Recursive** an, durchsucht Marinara den ausgewerteten Inhalt aktivierter Einträge erneut. Text, den ein Makro erzeugt, kann weitere Einträge auslösen.

## Das Werkzeug Keyword test

Das Panel **Keyword test** (Schlüsselwort-Test) oben im Tab **Entries** prüft deine Schlüsselwörter ohne Chat.

1. Klapp **Keyword test** auf.
2. Füg einen Beispielabsatz oder ein paar Nachrichten in das Feld ein.

Einträge, die treffen würden, bekommen einen grünen Akzent und den Chip **Would activate**. **Constant**-Einträge bekommen den Chip **Always active**. Eine Zählzeile zeigt, wie viele eingeschaltete Einträge aktiv würden. Der Schalter **Include other lorebooks** (andere Lorebooks einbeziehen) prüft zusätzlich die eingeschalteten Einträge in deinen anderen Lorebooks.

Der Test ignoriert Timing, Wahrscheinlichkeit, Charakter- und Persona-Filter sowie den Abgleich nach Bedeutung; ein echter Chat kann also trotzdem abweichen.

<a id="entry-folders"></a>

## Eintrags-Ordner

Ordner gruppieren Einträge innerhalb eines Lorebooks. Mit den Bibliotheks-Ordnern im Panel **Lorebooks** haben sie nichts zu tun.

- Klick auf **Add Folder** und benenn den Ordner direkt an Ort und Stelle um.
- Zieh einen Eintrag auf einen Ordner, oder nutz die Auswahl **Folder** (Ordner) im Eintrag – das klappt auch per Tippen.
- Zieh einen Ordner auf einen anderen, um ihn zu verschachteln, oder auf den oberen Streifen, um die Verschachtelung aufzuheben.
- Jeder Ordner hat einen Schalter zum Aktivieren (Tooltip „Folder enabled“). Ist er aus, wird kein Eintrag darin mehr aktiv.
- **Clone folder** (Ordner klonen) kopiert den Ordner samt allen Einträgen und Unterordnern.
- **Delete folder** (Ordner löschen) entfernt nur den Ordner. Sein Inhalt rückt auf die oberste Ebene.

Als Gruppen erscheinen Ordner nur, wenn du nach **Order** sortierst und keine Suche aktiv ist. Sonst siehst du eine flache Liste und den Hinweis **Folder view paused (clear search and sort by Order)**.

## Fehlerbehebung

| Symptom | Lösung |
| --- | --- |
| Ein Eintrag löst nie aus. | Gib ihm Schlüsselwörter oder stell ihn auf **Constant**. Prüf, ob das Lorebook eingeschaltet und im Chat aktiv ist. |
| Ein Schlüsselwort hat funktioniert und dann nicht mehr. | Marinara durchsucht nur die letzten paar Nachrichten (**Scan Depth**, Standard 2). Erhöh **Scan Depth**, ergänze **Sticky** oder stell den Eintrag auf **Constant**. |
| Ein Eintrag löst in den falschen Szenen aus. | Nutz **Whole Words**, Secondary Keys mit **Selective** oder einen Charakterfilter. |
| Wichtiges Weltwissen fällt weg. | Gib ihm einen niedrigeren **Order**-Wert oder erhöh das **Token Budget**. **Active Context** in **Chat Settings** (Chat-Einstellungen) zeigt, was übersprungen wurde und warum. Siehe [Token-Budgets und Rekursion bei Lorebooks](token-budgets.md). |
| Die KI ignoriert einen Eintrag. | Prüf in **Active Context**, ob er aktiviert wurde. Eine Tatsache weit weg von der neuesten Nachricht wirkt schwächer als eine, die mit **@ Depth** nahe an der neuesten Nachricht steht. |

## Verwandte Anleitungen

- [Lorebooks – Überblick](overview.md)
- [Decision-Modelle](../connections/decision-models.md)
- [Token-Budgets und Rekursion bei Lorebooks](token-budgets.md)
- [Semantische Suche für Lorebooks](semantic-search.md)
- [Wissensquellen: die Agenten Knowledge Retrieval und Knowledge Router](../agents/knowledge-sources.md)
