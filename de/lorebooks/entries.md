# Lorebook-Einträge: Schlüsselwörter, Position und Timing

In dieser Anleitung erfährst du, wie du die Einträge in einem Lorebook aufbaust. Es geht um den Tab **Entries** (Einträge), um auslösende Schlüsselwörter und um die drei Eintragstypen. Außerdem klärt sie, an welcher Stelle im Prompt – dem Text, den Marinara an die KI schickt – ein Eintrag landet und welche Timing-Einstellungen über den Auslösezeitpunkt entscheiden. Sind Lorebooks, also Sammlungen von Weltwissen, für dich neu, lies zuerst [Lorebooks im Überblick](overview.md).

Ein Eintrag besteht aus einem Textblock und den Regeln dafür, wann Marinara Engine diesen Text in den Prompt an die KI einbaut. Löst ein Eintrag aus, fügt Marinara seinen Inhalt ein – und die KI „erinnert“ sich an etwas, das nie im Chat stand.

## Der Entries-Tab

Öffne ein Lorebook im Panel **Lorebooks**, um zum seitenfüllenden Editor zu gelangen. Der Editor hat zwei seitliche Tabs: **Overview** (Übersicht) und **Entries**. Klick auf **Entries**, um die Liste der Einträge zu sehen. Das Badge am Tab zeigt, wie viele Einträge das Lorebook enthält.

Die Werkzeugleiste oben im Tab **Entries** bietet diese Bedienelemente:

- Das Feld **Search entries…** (Einträge durchsuchen): filtert die Liste nach Name, Schlüsselwörtern oder Inhalt.
- Ein Sortier-Dropdown-Menü mit **Order**, **Entries**, **Name A→Z**, **Name Z→A**, **Tokens ↓**, **Keys ↓**, **Newest** und **Oldest**. Die ↓-Optionen sortieren absteigend.
- **Select** (Auswählen): schaltet die Mehrfachauswahl ein, damit du mehrere Einträge auf einmal kopieren, verschieben oder löschen kannst.
- **Add Folder** (Ordner hinzufügen): legt einen Ordner an, der Einträge gruppiert (siehe den Abschnitt zu den Eintrags-Ordnern weiter unten).
- **Add Entry** (Eintrag hinzufügen): erstellt ganz oben in der Liste einen neuen, leeren Eintrag.

Darunter fasst eine Zeile zusammen, wie viele Einträge und Ordner es gibt und wie groß der gesamte Inhalt geschätzt in Tokens – kleinen Textstücken – ist.

## Einträge anlegen und bearbeiten

So legst du einen Eintrag an:

1. Öffne das Lorebook und klick auf den Tab **Entries**.
2. Klick auf **Add Entry**. Eine neue Zeile erscheint in der Liste.
3. Trag im Namensfeld der Zeile einen Namen ein. Jeder Eintrag braucht einen Namen.
4. Klick auf die Zeile (oder auf ihren Pfeil), um das vollständige Editor-Panel aufzuklappen.
5. Füll die Schlüsselwörter und den Inhalt aus – beides beschreiben die folgenden Abschnitte.

Änderungen speichert Marinara automatisch. Während du tippst, zeigt das Panel erst **Autosaving…**, dann **Saving…** und schließlich **Saved automatically**. Schlägt das Speichern fehl, bleibt der Text erhalten, und Marinara versucht es bei der nächsten Änderung erneut. Eine eigene Speichern-Schaltfläche brauchen Einträge nicht.

Jeder Eintrag belegt in der Liste genau eine kompakte Zeile. Dort sitzen die am häufigsten gebrauchten Bedienelemente. Alles Weitere erreichst du, indem du die Zeile aufklappst.

Zum Duplizieren zeigst du auf die Zeile und klickst auf die Schaltfläche **Duplicate** (Duplizieren). Zum Entfernen klickst du auf **Delete** (Löschen). Marinara fragt zur Sicherheit nach: **Delete this lorebook entry?**

## Eintragsinhalt und Schlüsselwörter

Klapp einen Eintrag auf, um seine Hauptfelder zu bearbeiten.

- **Primary Keys** (Hauptschlüsselwörter): die Schlüsselwörter, die diesen Eintrag auslösen. Sobald eines davon im jüngsten Chatverlauf auftaucht, wird der Eintrag aktiv. Tipp ein Schlüsselwort ein und drück Enter, um es als Chip anzulegen.
- **Content** (Inhalt): der Text, den Marinara beim Auslösen in den Prompt an die KI einfügt. Formulier ihn als schlichte Tatsache, die die KI kennen soll. Im Inhalt funktionieren Prompt-Makros; unter dem Feld steht eine laufende Token-Schätzung.
- **Secondary Keys** (Zweitschlüsselwörter): weitere Schlüsselwörter, die nur beim Eintragstyp **Selective** greifen. Siehe den Abschnitt zu den Eintragstypen weiter unten.
- **Description** (Beschreibung): eine kurze Zusammenfassung des Eintrags. Nur der Agent **Knowledge Router** liest sie und entscheidet damit, ob er den Eintrag einfügt. An die eigentliche KI geht sie nie als Inhalt. Siehe [Wissensquellen](../agents/knowledge-sources.md).

Ein einfaches Beispiel:

- Name: `Silverhaven`
- Primary Keys: `Silverhaven`, `the capital`
- Content: `Silverhaven is the mountain capital. Its people mine blue crystal and distrust outsiders.`

Fällt im Chat `Silverhaven` oder `the capital` – von dir oder von der KI –, bekommt die KI diese Tatsache automatisch mitgeliefert.

Einfacher geht ein Eintrag nicht: ein Name, zwei, drei Schlüsselwörter und eine Tatsache. Wann sich die übrigen Bedienelemente lohnen, zeigen weiter unten die Abschnitte **Schreibstrategie** und **Praxisbeispiel** – dort entsteht eine kleine Welt von Grund auf.

## Regeln für Schlüsselwort-Treffer

Standardmäßig greift ein Primary Key, sobald das Wort irgendwo im jüngsten Chattext vorkommt; Groß- und Kleinschreibung spielt dabei keine Rolle. Drei Bedienelemente ändern dieses Verhalten. **Whole Words** und **Case Sensitive** stehen im aufgeklappten Panel. Der Schalter **Regex** ist das kleine Symbol in der kompakten Zeile und färbt sich orange, sobald er an ist.

| Bedienelement | Wo | Standard | Wirkung |
|---|---|---|---|
| **Whole Words** | Eintrags-Panel | Off | Das Schlüsselwort muss ein ganzes Wort treffen, nicht nur einen Teil eines längeren Worts. |
| **Case Sensitive** | Eintrags-Panel | Off | Groß- und Kleinschreibung müssen exakt übereinstimmen. |
| **Regex** | Kompakte Zeile | Off | Behandelt jedes Schlüsselwort als regulären Ausdruck statt als einfachen Text. |

Ein regulärer Ausdruck (Regex) ist eine Mustersprache für Text. Nutz ihn nur, wenn du dich mit Regex auskennst. Marinara führt jedes Regex-Schlüsselwort mit einem kurzen Sicherheits-Zeitlimit aus. Ein Muster, das zu lange läuft, trifft bei diesem Durchlauf nicht – halte Muster deshalb einfach.

## Eintragstypen: Normal, Constant, Selective

Jeder Eintrag hat einen Typ. Klick auf den kleinen farbigen Punkt in der Eintragszeile, um das Typmenü zu öffnen und einen auszuwählen.

- **Normal** (grüner Punkt): löst aus, wenn ein Primary Key im gescannten Text vorkommt. Das ist der Standard.
- **Constant** (gelber Punkt): wird jedes Mal eingefügt, solange das Lorebook aktiv ist – ganz ohne Schlüsselwort. Gedacht für Fakten, die immer präsent sein müssen.
- **Selective** (roter Punkt): die Primary Keys müssen treffen, und zusätzlich muss die Logik der Secondary Keys aufgehen.

Auch ein **Constant**-Eintrag hält sich an Timing, Wahrscheinlichkeit und alle gesetzten Filter. Er braucht lediglich kein Schlüsselwort.

Steht ein Eintrag auf **Selective**, legst du ein oder mehrere **Secondary Keys** an und wählst im Panel eine **Logic**-Schaltfläche (Verknüpfung):

- **AND Any**: mindestens eines der Secondary Keys muss ebenfalls vorkommen.
- **AND All**: jedes Secondary Key muss ebenfalls vorkommen.
- **NOT Any**: der Eintrag wird blockiert, sobald irgendein Secondary Key vorkommt.
- **NOT All**: der Eintrag wird nur blockiert, wenn alle Secondary Keys vorkommen.

Ein Beispiel: ein **Selective**-Eintrag mit dem Primary Key `king`, dem Secondary Key `Silverhaven` und der Einstellung **AND Any**. Er löst nur aus, wenn im Chat der König und Silverhaven gemeinsam vorkommen. So löst ein Allerweltswort wie `king` nicht in der falschen Szene aus.

## Position, Depth und Order

Diese Bedienelemente legen fest, wo ein ausgelöster Eintrag im Prompt landet. Auf breiten Bildschirmen sitzen sie in der kompakten Zeile. Auf schmalen Bildschirmen tippst du auf die Schnellzugriff-Schaltfläche der Zeile.

- **Position**: zur Wahl stehen **Before chat**, **After chat**, **@ Depth** und **Outlet**. Before chat und After chat setzen den Eintrag vor beziehungsweise hinter den Chatverlauf. **@ Depth** fügt ihn mitten in den Chatverlauf ein. **Outlet** – eine benannte Ausgabestelle im Prompt – fügt gar nichts automatisch ein, sondern stellt den aktivierten Inhalt einem benannten Makro `{{outlet::name}}` bereit. Auf breiten Bildschirmen zeigt die Zeile die ersten drei Positionen als Kurzbeschriftungen **↑Char**, **↓Char** und **@Depth**.
- **Depth**: erscheint nur, wenn **Position** auf **@ Depth** steht. Der Wert bestimmt, wie viele Nachrichten vor der neuesten der Eintrag eingefügt wird. Der Standard ist 4.
- **Order**: die Reihenfolge beim Einfügen, wenn mehrere Einträge gleichzeitig auslösen. Ein niedrigerer Wert steht früher im Prompt. Der Standard ist 100.

Setz **@ Depth** sparsam und mit Absicht ein. Der Eintrag landet *mitten* in den jüngsten Nachrichten statt davor oder dahinter. Der Text wirkt dann wie ein Zwischenruf mitten im Chat:

> **John:** Lass uns Vlads Burg besuchen.
> **Bob:** Machen wir.
> *Die Schwäche des Grafen ist Knoblauch – eine extreme Allergie, die er um jeden Preis verbirgt.*
> **John:** Super, wollen wir morgen? Ich habe frei.

Greif nur dann dazu, wenn ein Hinweis wirklich direkt neben dem letzten Zug stehen muss – eine Regel, die das Modell ständig vergisst, oder eine Tatsache, die sich gerade geändert hat. Gewöhnliches Weltwissen bleibt bei **Before chat** oder **After chat**.

Wählst du **Outlet**, erscheint das Feld **Outlet name** (Outlet-Name). Trag dort einen exakten Namen ein – Groß- und Kleinschreibung zählt –, etwa `character_rules`, und setz dann `{{outlet::character_rules}}` in einen Prompt-Abschnitt. Jeder Eintrag mit diesem Outlet folgt weiterhin seinen üblichen Regeln für Schlüsselwörter, Constant, Wahrscheinlichkeit, Filter, Timing, Eintragslimit und Token-Budget. Gesammelt werden nur die Einträge, die für die aktuelle Generierung ausgelöst haben. Einträge mit demselben Outlet-Namen hängt Marinara in der Reihenfolge von **Order** aneinander, getrennt durch Zeilenumbrüche.

Ein Outlet-Makro ohne passende aktive Einträge löst sich zu nichts auf. Outlet-Inhalte können kein weiteres Outlet-Makro aufrufen; damit sind rekursive Outlet-Schleifen ausgeschlossen. Outlet-Makros funktionieren in den Prompt-Abschnitten der Modi Conversation, Roleplay und Game Mode.

## Auslöse-Wahrscheinlichkeit

Jeder Eintrag hat einen Wert **Probability** (Wahrscheinlichkeit), den die Zeile als Prozentwert anzeigt. Der Standard sind 100 % – der Eintrag löst also immer aus, wenn seine Schlüsselwörter treffen. Ein niedrigerer Wert lässt ihn nur manchmal auslösen. Bei 25 % etwa liegt die Chance bei eins zu vier, jedes Mal, wenn die Schlüsselwörter treffen.

## Timing: Sticky, Cooldown, Delay, Ephemeral

Die **Timing**-Felder im Panel steuern, wie sich ein Eintrag über mehrere Nachrichten hinweg verhält. **Sticky**, **Cooldown** und **Delay** zählen in Nachrichten, **Ephemeral** zählt Aktivierungen. Alle vier stehen anfangs auf 0 und sind damit aus.

- **Sticky**: Nach dem Auslösen bleibt der Eintrag noch so viele Nachrichten lang aktiv, auch ohne frischen Schlüsselwort-Treffer.
- **Cooldown**: Nach dem Auslösen wartet der Eintrag so viele Nachrichten, bevor er erneut auslösen kann.
- **Delay**: Der Eintrag wartet so viele Nachrichten im Chat ab, bevor er zum ersten Mal aktiv werden kann.
- **Ephemeral**: Nach so vielen Aktivierungen schaltet sich der Eintrag selbst ab. Der Wert 0 bedeutet unbegrenzt.

Setz **Sticky** zum Beispiel auf 3, damit eine Tatsache nach ihrem Auftauchen noch ein paar Züge im Prompt bleibt. So vergisst die KI sie nicht mitten in der Szene.

## Weitere Eintragsoptionen

Im aufgeklappten Panel warten noch ein paar Felder.

- **Role** (Rolle): legt fest, ob der eingefügte Text als **System**, **User** oder **Assistant** gekennzeichnet wird. Das wirkt sich nur aus, wenn **Position** auf **@ Depth** steht. Der Standard ist **System**.
- **Group** und **Tag**: Steck Einträge in dieselbe **Group** (Gruppe), damit von ihnen immer nur einer gleichzeitig aktiv wird. **Tag** ist ein frei wählbares Schlagwort für deine eigene Sortierung.
- **Locked** (Gesperrt): verhindert, dass der Agent **Lorebook Keeper** diesen Eintrag verändert. Siehe [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md).
- **No Vector** und das Vektor-Status-Badge gehören zur semantischen Suche. Siehe [Semantische Suche für Lorebooks](semantic-search.md).

Das Panel enthält außerdem den Abschnitt **Context filters & matching sources** (Kontextfilter und Trefferquellen). Dort schränkst du einen Eintrag auf bestimmte Charaktere, Charakter-Tags oder Generierungsarten ein. Möglich ist außerdem, weitere Felder der Charakterkarte – etwa die Charakterbeschreibung – nach den Schlüsselwörtern des Eintrags zu durchsuchen.

## Schreibstrategie: den richtigen Eintrag wählen

Die Abschnitte oben erklären, was jedes Bedienelement tut. Hier geht es um die Entscheidungen beim Schreiben eines Lorebooks: welcher Typ passt, wann ein Schlüsselwort enger gefasst werden muss und wie der Prompt schlank bleibt. Alles beginnt mit einer Frage – *wann soll die KI diese Tatsache sehen?*

- **Sie muss immer gelten** – die Prämisse der Welt, das Jahr, der Ton, eine Regel, die jede Szene färbt. Nimm **Constant**: Der Eintrag wird jedes Mal eingefügt, solange das Lorebook aktiv ist, ganz ohne Schlüsselwort. Bleib dabei sparsam. Jeder Constant-Eintrag kostet bei jeder Nachricht Tokens, und eine ganze Seite davon verdrängt den eigentlichen Chat.
- **Sie zählt nur, wenn sie zur Sprache kommt** – eine Person, ein Ort, eine Fraktion, ein Gegenstand. Nimm den Standardtyp **Normal** mit drei bis acht konkreten **Primary Keys**: dem Namen und den Bezeichnungen, die die Charaktere wirklich benutzen (`Castle Dracul`, `the castle`, `the fortress`). Das ist das Arbeitspferd; die meisten Einträge sind Normal.
- **Ihr Schlüsselwort ist ein Allerweltswort**, das in der falschen Szene auslöst (`king`, `home`, `hunter`) – schalt **Whole Words** ein, damit `art` nicht mehr in `start` trifft, oder stell den Eintrag auf **Selective** und ergänze **Secondary Keys**, die ihn an den richtigen Zusammenhang binden.
- **Mehrere Einträge füllen denselben Platz und dürfen nie zusammen auftauchen** – drei Fassungen einer Burg, zwei alternative Vorgeschichten. Gib ihnen dieselbe **Group**, dann wird immer nur einer davon geladen.
- **Sie ist wichtig, wird aber selten beim Namen genannt** – ein Motiv, eine Beziehung, eine Regel, die niemand ausspricht. Lass sie auf **Normal** und schalt den Abgleich nach Bedeutung ein (siehe [Semantische Suche](semantic-search.md)). Dieser Abgleich braucht ein Embedding-Modell. Ohne eines bleibt **Constant** – wenn die Tatsache wirklich immer präsent sein muss – oder es müssen breitere Schlüsselwörter her.

Ein paar Gewohnheiten halten ein Lorebook gesund:

- **Jeder Eintrag braucht einen Auslöser.** Ein **Normal**-Eintrag ohne Schlüsselwörter bietet dem Abgleich keinen Anhaltspunkt. Er wird nur aktiv, wenn die semantische Suche ihn nach Bedeutung findet – dafür braucht es ein vektorisiertes Lorebook und ein Embedding-Modell (siehe [Semantische Suche](semantic-search.md)). Soll eine Tatsache immer präsent sein, nimm **Constant**; sonst gib ihr Schlüsselwörter, damit sie ohne semantische Suche auslöst.
- **Bevorzuge konkrete Schlüsselwörter.** Ein Schlüsselwort wie `he`, `it` oder `the city` trifft in fast jeder Nachricht und verschwendet Budget. Nimm exakte Namen, **Whole Words** oder **Selective** mit Secondary Keys, sobald ein Schlüsselwort zu breit streut.
- **Füll die Description aus**, wenn der Agent **Knowledge Router** den Eintrag auswählen soll – für die Relevanz liest er die Beschreibung, nicht den Inhalt (siehe [Wissensquellen](../agents/knowledge-sources.md)).
- **Lass Position, Depth, Order und Role auf ihren Standardwerten**, solange du keinen Grund für etwas anderes hast. **Order** lohnt sich, wenn viele Einträge auslösen und das Budget knapp ist: Ein Eintrag mit niedrigerem Wert wird zuerst geladen und übersteht das Kürzen. **@ Depth** bleibt der seltenen Erinnerung vorbehalten, die neben der letzten Nachricht stehen muss – siehe den Warnhinweis oben. Behalte dabei **Token Budget** und **Entry Limit** des Lorebooks im Blick (siehe [Token-Budgets und Rekursion](token-budgets.md)).

### Weltwissen als Baum strukturieren

Bei großen Welten hilft eine Baumstruktur mehr als ein flacher Haufen von Einträgen. Leg neben den Einträgen für einzelne Charaktere, Orte oder Gegenstände auch **Hub-Einträge** für die Gruppen an, zu denen sie gehören: einen Eintrag über *Das Imperium*, der es beschreibt und seine wichtigsten Mitglieder nennt, oder einen über ein Königreich mit seinen bedeutenden Städten. Ein Hub gibt der KI eine Landkarte: Kommt das Imperium zur Sprache, sieht das Modell, was es ist und wer dazugehört – ohne dass der volle Eintrag jedes Mitglieds den Prompt füllt.

Bei Hubs bleibt die Rekursion aus. Der Schalter **Recursive** des Lorebooks und der Schalter **Recursion** eines Eintrags stehen standardmäßig auf aus, und genau das will ein Hub: Er reicht dem Modell seine Übersicht, und der eigene Eintrag jedes Mitglieds erscheint erst, wenn dieses Mitglied wirklich genannt wird. Schaltest du die Rekursion anderswo ein, um verwandtes Weltwissen zu verketten, lass sie bei Hub-Einträgen aus. Sonst zieht schon der Name der Gruppe alle Mitglieder mit vollem Eintrag in den Prompt – Tausende Tokens an Details, die noch gar nicht relevant sind.

### Weltwissen über Charaktere und Chats hinweg wiederverwenden

Wo ein Lorebook liegt, entscheidet darüber, welche Chats es sehen. Wähl den Ablageort deshalb passend zur Art des Weltwissens:

- **Regeln einer gemeinsamen Welt** – die Welt, zu der alles in deiner Bibliothek gehört – kommen in ein **Global**-Lorebook. Es ist in jedem Chat aktiv (schalt dafür **Global** im Tab **Overview** des Lorebooks ein).
- **Das eigene Weltwissen eines Charakters** – Vorgeschichte, Geheimnisse, Beziehungen – kommt in ein Lorebook, das mit diesem Charakter **verknüpft** ist. So schaltet es sich in seinen Chats von selbst ein und sonst nirgends. Teilen sich mehrere Charaktere ein Buch, setz bei den Einträgen, die nur zu einem gehören, einen Charakter-**Filter**.
- **Eine Karte, die du weitergeben willst** – **bette** das Lorebook in die Charakterkarte ein, damit die World Info beim Export mitreist. Einbetten geht nur bei Charakteren, und eine Karte trägt jeweils ein eingebettetes Lorebook.
- **Weltwissen für eine einzelne Geschichte** – heft das Lorebook über die Chat-Einstellungen an genau diesen Chat.

Wie die Aktivierung funktioniert, steht in [Lorebooks im Überblick](overview.md); die Bedienelemente zum Zuweisen, Eingrenzen und Einbetten erklärt [Lorebooks mit Charakteren und Personas verknüpfen](linking-to-characters.md).

## Praxisbeispiel: eine kleine Welt

Angenommen, du spielst ein Gothic-Horror-Roleplay in der Walachei der 1890er-Jahre. Ein dürftiges Lorebook wäre bloß ein Stapel aus Namen und Inhalten. Ein gut gebautes nutzt die Bedienelemente von oben, damit jede Tatsache genau dann auftaucht, wenn sie gebraucht wird. So könnte eine Handvoll Einträge aussehen – und das steckt dahinter.

Fang mit dem Fundament an: einer Tatsache, die immer gilt, und ein paar Details mit Schlüsselwörtern.

**Die Prämisse** – *Constant.*

- Content: `The year is 1890. Vampires are real and hunt the Carpathian nights; the living bar their windows after dark.`
- Warum **Constant**: Die Grundregeln färben jede Antwort, also ist dieser Eintrag ohne Schlüsselwort immer dabei. Er ist der eine, bei dem sich Dauerpräsenz rechtfertigen lässt – widersteh der Versuchung, weitere auf Constant zu stellen.

**Castle Dracul** – *Normal.*

- Primary Keys: `Castle Dracul`, `the castle`, `the fortress`
- Content: `A black-stone fortress on the ridge above the village, the seat of the vampire count.`
- Warum **Normal** mit diesen Schlüsselwörtern: Die Burg zählt nur, wenn sie im Spiel ist, also wartet sie auf ein Schlüsselwort. Die Schlüsselwörter decken ihren Namen und die Bezeichnungen ab, die die Charaktere für sie benutzen.

**Count Vlad** – *Normal, mit eingeschaltetem Whole Words.*

- Primary Keys: `Vlad`
- Description: `The setting's central vampire.`
- Content: `The immortal count who rules Wallachia after dark — charming, patient, and without mercy.`
- Warum **Whole Words**: `Vlad` ist kurz und könnte in einem anderen Wort stecken; der Abgleich auf ganze Wörter verhindert Fehltreffer. Die **Description** ist ausgefüllt, damit der Knowledge Router den Eintrag heranziehen kann, falls du diesen Agenten nutzt.

### Mehrere Bedienelemente auf einem Eintrag kombinieren

Die meisten Einträge brauchen ein oder zwei Bedienelemente, ein paar wenige verdienen mehrere auf einmal. Nimm die Regel, wie sich der Schurke wirklich töten lässt – eine Tatsache, die die KI im dümmsten Moment vergisst:

**Die Schwäche des Grafen** – *Selective (AND Any), Whole Words an, Order 10, mit Description.*

- Primary Keys: `weakness`, `kill`, `destroy`, `stake`
- Secondary Keys: `Vlad`, `the count`
- Description: `How Count Vlad can actually be destroyed.`
- Content: `Vlad can only be destroyed by a blackthorn stake through the heart, driven at dawn. Sunlight alone merely weakens him.`

Warum dieser eine Eintrag gleich mehrere fortgeschrittene Bedienelemente verdient:

- **Selective** mit diesen Secondary Keys – `weakness`, `kill` und `destroy` sind allgemeine Kampfwörter und fallen bei jedem Gefecht. Die Secondary Keys binden den Eintrag an den Grafen. Er bleibt still, wenn die Party einen Wolf erlegt oder gegen einen Rivalen intrigiert, und löst nur aus, wenn es um *seinen* Tod geht.
- **Whole Words** – ohne den Schalter träfe `stake` in `mistake` und `kill` in `skill`. Kurze, häufige Schlüsselwörter wollen fast immer den Abgleich auf ganze Wörter.
- **Order 10** – eine Höhepunktszene löst viele Einträge gleichzeitig aus und sprengt schnell das Token-Budget. Ein niedriger Order-Wert lädt diesen Eintrag zuerst; wird das Ende gekürzt, überlebt die eine Tatsache, an der die Szene hängt.
- **Description** – der Agent Knowledge Router liest sie und wählt den Eintrag nach Bedeutung aus. So kann die Regel auch dann auftauchen, wenn die exakten Schlüsselwörter in der letzten Nachricht fehlen.

### Alternative Fassungen, die sich nicht stapeln sollen

Der Dorfklatsch über den Grafen soll widersprüchlich wirken – aber nie sollen zwei einander widersprechende Gerüchte in derselben Antwort stehen. Steck beide in eine **Group** und halt sie über die Wahrscheinlichkeit selten:

**Gerücht: der Pakt** und **Gerücht: die Blutlinie** – *beide in Group `count-rumor`, Probability 40 %.*

- Beide mit den Schlüsselwörtern: `rumor`, `they say`, `the count`
- Inhalte: `They say the count was once a crusader who bargained with something in the dark.` und `They say the count is not one man but a line of them, each wearing the last one's face.`
- Warum **Group** `count-rumor`: Einträge derselben Gruppe schließen sich gegenseitig aus – pro Generierung wird nur einer aktiv –, also widersprechen sich die beiden Gerüchte nie in derselben Nachricht. Warum **Probability 40 %**: Ein Gerücht, das bei jeder Erwähnung auftaucht, fühlt sich nicht mehr wie eines an; niedrigere Chancen machen daraus einen gelegentlichen, farbigen Einwurf.

Über das ganze Lorebook hinweg steht nur die Prämisse auf Constant, ein Eintrag verbindet selektive Logik mit niedrigem Order-Wert, und alles andere wartet schlicht auf seine Schlüsselwörter. Genau das hält den Prompt schlank und legt der KI trotzdem im richtigen Moment die richtige Tatsache vor.

## Anwendungsfälle nach Parameter

Die Strategie und das Praxisbeispiel oben zeigen diese Bedienelemente im Zusammenspiel. Dieser Abschnitt ist die Kurzreferenz dazu: wofür jedes Bedienelement *da ist*, mit je einem Beispiel.

### Abgleich

**Whole Words** – verhindert, dass ein Schlüsselwort innerhalb eines längeren Worts trifft.

- Gut für: kurze oder einsilbige Schlüsselwörter, Abkürzungen oder Schlüsselwörter, die in anderen Wörtern stecken.
- *Beispiel:* Das Schlüsselwort `Ash` (ein Charakter) trifft „Ash“, aber nicht „ashes“ oder „cash“.

**Case Sensitive** – das Schlüsselwort muss in der Groß- und Kleinschreibung exakt passen.

- Gut für: ein Schlüsselwort, das zugleich ein häufiges kleingeschriebenes Wort ist; Abkürzungen und Initialwörter; Codes, bei denen die Schreibweise Bedeutung trägt.
- *Beispiel:* `IT` (die IT-Abteilung) trifft „IT“, aber nicht das Wort „it“.

**Regex** – behandelt das Schlüsselwort als regulären Ausdruck.

- Gut für: mehrere Schreibweisen oder Formen auf einmal, optionale Endungen oder Zahlen und Codes mit Muster. Halte die Muster einfach – jedes läuft unter einem kurzen Sicherheits-Zeitlimit.
- *Beispiel:* `\bVlad(?:'s)?\b` trifft „Vlad“ und „Vlad's“ jeweils als ganzes Wort.

### Eintragstyp

**Constant** – wird bei jedem Zug eingefügt, ohne Schlüsselwort.

- Gut für: die Prämisse und die Grundregeln der Welt, eine Vorgabe zu Ton oder Stil oder eine Tatsache, die der KI nie fehlen darf.
- *Beispiel:* Ein Constant-Eintrag ohne Schlüsselwörter – „Everyone speaks in period 1800s English.“ – steckt in jeder Antwort.

**Selective (Secondary Keys + Logik)** – legt über die Primary Keys eine zweite Schlüsselwort-Bedingung.

- Gut für: ein häufiges Primary Key, das in der falschen Szene auslöst; Weltwissen, das nur bei einer bestimmten Themenkombination erscheinen soll; oder das Blockieren eines Eintrags, sobald ein bestimmter Begriff fällt.
- *Beispiel (AND Any):* primär `king`, sekundär `Silverhaven` – der Eintrag zum König löst nur aus, wenn auch Silverhaven fällt.
- *Beispiel (NOT Any):* primär `the prophecy`, sekundär `fulfilled` – der Eintrag zur unerfüllten Prophezeiung ist blockiert, sobald sich die Prophezeiung erfüllt hat.

### Platzierung

**Before chat / After chat** – wo der Eintrag relativ zum Chat sitzt.

- Gut für: das meiste Weltwissen (Before chat, der Standard); einen Hinweis, der möglichst nah an der nächsten Antwort des Modells stehen soll (After chat).
- *Beispiel:* eine Fraktions-Zusammenfassung bei Before chat; eine kurze Erinnerung „stay in character“ bei After chat.

**@ Depth (mit Depth und Role)** – fügt den Eintrag *mitten* in die jüngsten Nachrichten ein. Sparsam einsetzen – siehe den Warnhinweis unter **Position, Depth und Order** weiter oben.

- Gut für: eine Regel, die das Modell mitten in der Szene ständig vergisst, oder eine Tatsache, die sich gerade geändert hat und neben dem letzten Zug landen muss. **Role** kennzeichnet die eingefügte Zeile als **System**, **User** oder **Assistant**.
- *Beispiel:* „The tavern is now on fire.“ bei @ Depth 1, Role System.

**Order** – die Reihenfolge, in der ausgelöste Einträge laden.

- Gut für: einem Eintrag den Vorzug geben, wenn mehrere auslösen und das Budget knapp ist, oder die Reihenfolge verwandter Einträge steuern.
- *Beispiel:* Eine handlungswichtige Regel bei Order 10 lädt vor Stimmungs-Einträgen beim Standard 100 und übersteht das Kürzen.

**Outlet** – sammelt ausgelöste Einträge in einem benannten Makro, statt sie direkt einzufügen.

- Gut für: mehrere Einträge an einer Stelle des Prompts bündeln oder einen dynamischen Block bauen, den du selbst platzierst.
- *Beispiel:* drei Einträge mit Position Outlet und dem Namen `house_rules`; setz `{{outlet::house_rules}}` in einen Prompt-Abschnitt, und dort erscheinen nur die Einträge, die in diesem Zug ausgelöst haben – aneinandergehängt nach Order.

### Wann und wie oft ein Eintrag auslöst

**Probability** – die prozentuale Chance, dass der Eintrag bei passenden Schlüsselwörtern auslöst.

- Gut für: gelegentliche Stimmung, Zufallsereignisse oder eine Eigenheit, die nur ab und zu durchkommen soll.
- *Beispiel:* „the innkeeper is in a foul mood today“ bei Probability 30 %.

**Sticky** – hält den Eintrag nach dem Auslösen für eine feste Zahl an Nachrichten aktiv.

- Gut für: eine Tatsache ein paar Züge im Prompt halten, damit das Modell sie mitten in der Szene nicht vergisst.
- *Beispiel:* Ein enthülltes Geheimnis bei Sticky 3 bleibt nach seinem Auftauchen drei Nachrichten lang aktiv.

**Cooldown** – sperrt den Eintrag nach dem Auslösen für eine feste Zahl an Nachrichten.

- Gut für: verhindern, dass ein dramatischer oder wuchtiger Eintrag in jeder Nachricht auftaucht, oder ein wiederkehrendes Ereignis takten.
- *Beispiel:* Ein Omen „the ground trembles“ bei Cooldown 5 löst höchstens alle fünf Nachrichten aus.

**Delay** – der Eintrag kann erst nach einer festen Zahl an Nachrichten im Chat auslösen.

- Gut für: Weltwissen, das nicht gleich am Anfang auftauchen soll; eine Wendung oder eine späte Tatsache, die auf die Entwicklung der Geschichte wartet.
- *Beispiel:* ein Eintrag „the mentor was the traitor all along“ bei Delay 20.

**Ephemeral** – der Eintrag schaltet sich nach einer festen Zahl an Aktivierungen selbst ab.

- Gut für: Inhalte, die nur ein- oder zweimal auftauchen sollen – ein Intro, eine Notiz zum ersten Treffen, ein Tutorial-Hinweis.
- *Beispiel:* „You wake with no memory of how you got here.“ bei Ephemeral 1 löst einmal aus und schaltet sich dann ab.

### Organisation und Steuerung

**Group** – schließt Einträge gegenseitig aus; pro Antwort wird nur einer aus einer Gruppe aktiv.

- Gut für: Alternativen (eines von mehreren Gerüchten, Stimmungen oder Fassungen) oder einen Zufallspool.
- *Beispiel:* drei Einträge „weather today“ in Group `weather` – genau einer wird pro Antwort gewählt.

**Tag** – ein frei wählbares Schlagwort für deine eigene Sortierung. Auf das Auslösen wirkt es sich nicht aus.

- Gut für: Einträge im Editor ordnen und filtern.
- *Beispiel:* Tags wie `npc`, `location` oder `wip` helfen beim schnellen Finden und Verwalten.

**Description** – eine Zusammenfassung, die der Agent Knowledge Router für seine Auswahl liest; an die KI geht sie nie als Inhalt.

- Gut für: einem dichten oder makrolastigen Eintrag eine klare Zusammenfassung geben, die der Router nach Bedeutung findet, oder eine Notiz an dich selbst.
- *Beispiel:* Ein Eintrag voller Formatierungs-Makros bekommt die Description „die Regeln der Duellarena“.

**Recursion (pro Eintrag)** – lässt den Inhalt dieses Eintrags weitere Einträge auslösen. Standardmäßig aus.

- Gut für: einen Eintrag, der *bewusst* eine überschaubare Kette verwandten Weltwissens nach sich zieht. Bei Hub-Einträgen bleibt der Schalter aus (siehe **Weltwissen als Baum strukturieren** oben).
- *Beispiel:* „The party enters the Thornwood.“ mit eingeschalteter Recursion und einem Inhalt, der die Wahrzeichen des Waldes nennt – so werden auch deren Einträge aktiv.

**No Vector** – schließt den Eintrag von der semantischen Suche aus.

- Gut für: verhindern, dass ein allgemeiner oder formelhafter Eintrag die bedeutungsbasierten Treffer verwässert, oder einen Eintrag, der nur über seine exakten Schlüsselwörter auslösen soll.
- *Beispiel:* Markier einen Eintrag mit Formatierungsanweisungen als No Vector, damit er nie als semantischer Treffer für verwandtes Weltwissen auftaucht.

**Locked** – schützt den Eintrag vor dem Agenten Lorebook Keeper.

- Gut für: einen von Hand fein abgestimmten Eintrag, den ein automatischer Durchlauf nicht umschreiben soll.
- *Beispiel:* Sperr deine sorgfältig formulierte Prämisse, damit der Keeper sie nicht bearbeiten kann.

**Context filters** – schränken einen Eintrag auf bestimmte Charaktere, Charakter-Tags oder Generierungsarten ein.

- Gut für: Weltwissen, das nur für einige Charaktere oder nur für bestimmte Generierungsarten gilt.
- Ein Filter auf einen Charakter versteckt den Eintrag nicht nur vor anderen Chats: Im Gruppenchat hält er ihn auch aus den Antworten *der anderen* Charaktere heraus. Der Eintrag wird nur aktiv, wenn der gefilterte Charakter gerade antwortet. Damit eignet er sich ideal für private Vorgeschichten, Geheimnisse und Wissen, das nur ein Charakter besitzt und die anderen nicht kennen sollen.
- *Beispiel:* Filtere die geheime Loyalität einer Spionin auf sie selbst. So prägt der Eintrag ihre eigenen Antworten, sickert aber nie in die Antworten der Charaktere durch, die sie täuscht.

## Makros im Eintragsinhalt nutzen

Der **Content** eines Eintrags wird wie jeder andere Prompt-Text ausgewertet: Prompt-Makros lösen sich auf, bevor Marinara den Inhalt einfügt. Ein paar davon sind in Lorebook-Einträgen besonders praktisch:

- `{{char}}` und `{{user}}` – der Name des aktuellen Charakters und dein eigener Name beziehungsweise der deiner Persona, damit ein geteilter Eintrag in jedem Chat natürlich klingt.
- `{{random::a::b::c}}` und `{{roll:1d6}}` – eine zufällige Option ziehen oder würfeln, für Details, die bei jedem Auslösen anders ausfallen. Mit `@`-Gewichten wie in `{{random::common@3::rare@1}}` machst du einzelne Optionen wahrscheinlicher.
- `{{#if ...}}...{{else}}...{{/if}}` – den Text ändern, je nachdem, wer spricht, wie eine Variable steht oder welcher Charakter aktiv ist.
- `{{getvar::name}}` und `{{setvar::name::value}}` – eine chatlokale dauerhafte Variable lesen oder setzen, damit ein Eintrag über spätere Züge hinweg auf den Zustand reagiert oder ihn steuert, ohne ihn in andere Chats zu übertragen.

Gewichteter Zufall passt gut zu **Probability**: Damit steckt eine ganze Tabelle in einem einzigen Eintrag. Statt einer Gruppe aus zwanzig Monster-Einträgen gib einem Eintrag für zufällige Begegnungen eine niedrige **Probability** – so bleibt die Begegnung selten – und eine gewichtete Liste dessen, was auftaucht:

`{{random::a lone wolf@5::a bandit scout@3::a wounded traveler@2::a displacer beast@1}}`

Der Eintrag löst nur manchmal aus, und dann wählt er genau eine Begegnung – gewichtet, damit gewöhnliche Gegner häufiger erscheinen als seltene. Ein Kompendium einzelner Einträge brauchst du dafür nicht.

Mit dem **Kommentar-Makro** hinterlässt du eine Notiz, die nie bei der KI ankommt:

- `{{// draft wording, revisit later}}` – alles innerhalb von `{{// ... }}` fällt vor der Ausgabe weg.

**Ein Hinweis zur Rekursion.** Ist für das Lorebook der Schalter **Recursive** an (siehe [Token-Budgets und Rekursion](token-budgets.md)), durchsucht Marinara den *aufgelösten* Inhalt ausgelöster Einträge erneut nach Schlüsselwörtern. Weil Makros zuerst aufgelöst werden, kann der von einem Makro erzeugte Text weitere Einträge auslösen – ein Inhalt, der zu einem Namen wird, aktiviert etwa den Eintrag mit genau diesem Schlüsselwort. Ein `{{// comment}}` ist die Ausnahme: Er fällt vor dem erneuten Durchlauf ersatzlos weg und kann deshalb nie etwas auslösen. Kommentare sind nur für Notizen; soll ein Text die Rekursion füttern, schreib ihn normal in den Inhalt.

## Typische Stolperfallen

- **Ein Eintrag löst nie aus.** Ein **Normal**-Eintrag ohne Schlüsselwörter bietet dem Abgleich keinen Anhaltspunkt – gib ihm Schlüsselwörter oder stell ihn auf **Constant**. (Nach Bedeutung lässt sich auch ein Eintrag ohne Schlüsselwörter finden, aber nur bei vollständig eingerichteter semantischer Suche: **Vectors** an, Embedding-Modell eingerichtet, Eintrag vektorisiert; siehe [Semantische Suche](semantic-search.md).) Prüf außerdem, ob das Lorebook aktiviert und im Chat aktiv ist.
- **Ein Schlüsselwort funktioniert plötzlich nicht mehr.** Marinara gleicht nur die letzten Nachrichten ab – die **Scan Depth** des Lorebooks (Standard 2). Rutscht das auslösende Wort aus diesem Fenster, bleibt der Eintrag still. Erhöh die **Scan Depth**, ergänze **Sticky**, damit eine Tatsache nach dem Auslösen nachwirkt, oder stell den Eintrag auf **Constant**.
- **Ein Eintrag löst in den falschen Szenen aus.** Ein breites Schlüsselwort wie `home` oder `king` trifft zu viel. Zieh es mit **Whole Words** enger, sichere es mit **Selective** und Secondary Keys ab oder filtere den Eintrag auf den richtigen Charakter.
- **Wichtiges Weltwissen fällt immer wieder weg.** Treffen mehr Einträge, als das Budget zulässt, kürzt Marinara das Ende. Gib den wichtigen Einträgen einen niedrigeren **Order**-Wert, erhöh das **Token Budget** oder verschieb umfangreiches Nachschlagewissen hinter den Agenten Knowledge Router. Was warum übersprungen wurde, zeigt das Panel **Active Context** (siehe [Token-Budgets und Rekursion](token-budgets.md)).
- **Die KI ignoriert dein Weltwissen.** Prüf in **Active Context**, ob der Eintrag wirklich ausgelöst hat. Und denk daran: Er konkurriert mit dem übrigen Prompt, und eine Tatsache weit weg vom letzten Zug wirkt schwächer als eine bei **After chat** oder – sparsam – bei **@ Depth**.

## Checkliste für jeden Eintrag

Ein kurzer Durchgang für jeden Eintrag, den du schreibst:

1. **Benenn ihn** klar – der Name ist für dich und die Suche da, nicht für die KI.
2. **Entscheide, wie er auslöst:** immer gültige Tatsache → **Constant**; alles andere → **Normal** mit drei bis acht konkreten **Schlüsselwörtern**.
3. **Zähme zu breite Schlüsselwörter** mit **Whole Words** oder verteil sie auf **Selective** mit Secondary Keys.
4. **Schreib den Inhalt** als schlichte Tatsache, in so wenigen Tokens wie möglich.
5. **Füll die Description aus**, falls du den Agenten Knowledge Router nutzt.
6. **Lass die Platzierung auf den Standardwerten**, außer der Eintrag braucht wirklich eine eigene **Position**, **Depth** oder **Order**.
7. **Gruppier** einander ausschließende Alternativen über **Group**; **filtere** charakterspezifisches Weltwissen auf seinen Charakter.
8. **Teste** ihn im Panel **Keyword test** und beobachte dann in einem echten Chat **Active Context**, ob er auslöst und ins Budget passt.

## Das Werkzeug Keyword test

Mit dem Panel **Keyword test** (Schlüsselwort-Test) oben im Tab **Entries** prüfst du die Schlüsselwörter, ohne einen Chat zu starten. Klapp es auf und füg einen Beispielabsatz oder ein paar Nachrichten in das Feld ein.

Einträge, deren Schlüsselwörter treffen würden, bekommen einen grünen Akzent und den Chip **Would activate**. **Constant**-Einträge erhalten den Chip **Always active**, weil sie unabhängig vom Text auslösen. Eine Zählzeile nennt, wie viele der eingeschalteten Einträge auslösen würden.

Der Test prüft ausschließlich die Schlüsselwort-Regeln. Timing, Wahrscheinlichkeit, Charakterfilter und semantische Treffer bleiben außen vor – der echte Chat kann also von der Vorschau abweichen.

## Eintrags-Ordner

Ordner gruppieren Einträge innerhalb eines einzelnen Lorebooks. Mit den Bibliotheks-Ordnern im Panel **Lorebooks** haben sie nichts zu tun.

- Klick auf **Add Folder**, um einen anzulegen, und benenn ihn direkt in der Liste um.
- Zieh einen Eintrag auf einen Ordner, um ihn dort abzulegen, oder nutz die Auswahl **Folder** (Ordner) im Eintrag.
- Zieh einen Ordner auf einen anderen, um ihn zu verschachteln, oder zieh ihn auf den oberen Streifen, um die Verschachtelung aufzuheben.
- Jeder Ordner hat einen Schalter **Enabled** (Aktiviert). Schaltest du einen Ordner aus, löst kein Eintrag darin mehr aus – auch dann nicht, wenn sein eigener Schalter an ist.
- Die Ordner-Kopfzeile bietet zusätzlich **Clone** (Klonen) und **Delete**. **Clone** kopiert den Ordner samt allen Einträgen und Unterordnern. **Delete** entfernt nur den Ordner selbst; seine Einträge und Unterordner rutschen eine Ebene nach oben.

Als Gruppen erscheinen Ordner nur, wenn du nach **Order** sortierst und keine Suche aktiv ist. Jede andere Sortierung und jede Suche schaltet auf eine flache Liste um und zeigt den Hinweis **Folder view paused (clear search and sort by Order)**.

## Verwandte Anleitungen

- [Lorebooks im Überblick](overview.md)
- [Lorebook-Token-Budgets und Rekursion](token-budgets.md)
- [Semantische Suche für Lorebooks](semantic-search.md)
- [Wissensquellen: Retrieval- und Router-Agenten](../agents/knowledge-sources.md)
