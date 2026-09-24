# Gruppenchats und Gruppen-Conversations

In dieser Anleitung erfährst du alles über Gruppenchats in Marinara Engine – also Chats mit zwei oder mehr Charakteren gleichzeitig. Sie zeigt, wie du einen Gruppenchat anlegst und Mitglieder hinzufügst oder entfernst. Außerdem erfährst du, wie du im Conversation Mode und im Roleplay Mode steuerst, wer spricht.

## Was ein Gruppenchat ist

Ein Gruppenchat ist jeder Chat mit zwei oder mehr Charakteren. Eine eigene Schaltfläche dafür gibt es nicht. Sobald du einem normalen Chat einen zweiten Charakter hinzufügst, wird er automatisch zum Gruppenchat.

Gruppenchats laufen in zwei Modi: **Conversation** und **Roleplay**. Der Game Mode bringt sein eigenes Party-System mit und bleibt hier außen vor.

Das Wort „Gruppe“ steht in Marinara für mehrere Dinge. Ein Gruppenchat versammelt viele Charaktere in einem Chat. Etwas anderes sind **Folders** (Ordner) – gespeicherte Charakterlisten zur Wiederverwendung. Und wieder etwas anderes sind **Chat Branches** (Chat-Verzweigungen), also alternative Fassungen desselben Chats. Hier geht es ausschließlich um Gruppenchats.

## Einen Gruppenchat anlegen

Einen Gruppenchat legst du mit demselben Einrichtungsassistenten an wie jeden anderen Chat. Du wählst einfach mehr als einen Charakter aus.

1. Klick in der Seitenleiste auf die Schaltfläche für einen neuen Chat im gewünschten Modus. Sie heißt **New Conversation** (Neue Conversation) oder **New Roleplay** (Neues Roleplay).
2. Wechsle zum Schritt **Persona & Characters** (Persona und Charaktere).
3. Such über das Feld **Search characters...** (Charaktere suchen) einen Charakter und klick auf den Avatar oder den Namen, um ihn aufzunehmen.
4. Nimm einen zweiten Charakter genauso auf. Die Anzahl ist beliebig.
5. Schließ den Assistenten ab, um den Chat zu öffnen.

Sobald ein zweiter Charakter dabei ist, ändert sich die Beschriftung über der Auswahl. Im Conversation Mode steht dort **Group Chat** samt Mitgliederzahl, im Roleplay Mode **Characters** samt Anzahl.

Eine feste Obergrenze für die Anzahl der Charaktere gibt es nicht. In der Praxis gilt: Je mehr Charaktere, desto länger der Prompt – also der Text, den Marinara an die KI schickt – und desto teurer jede Antwort. Nimm nur die Charaktere auf, die die Szene wirklich braucht.

Benennst du den Chat nicht selbst um, setzt Marinara die Charakternamen mit Kommas zum Chatnamen zusammen, zum Beispiel „Alice, Bob, Carol“.

### Viele Charaktere auf einmal über Folders aufnehmen

Hast du bereits einen Ordner mit Charakteren angelegt, holst du ihn komplett in einem Schritt in den Chat. Ordner sind gespeicherte Charakterlisten, die du im Panel **Characters** zusammenstellst. Für Gruppenchats, die du öfter verwenden willst, sind sie der schnellste Weg.

1. Öffne im Schritt **Persona & Characters** das Dropdown-Menü **Add from Folder** (Aus Ordner hinzufügen).
2. Wähl einen Ordner aus der Liste.
3. Klick auf **Add** (Hinzufügen) neben dem Dropdown-Menü.

Marinara nimmt jeden Charakter aus diesem Ordner auf, der noch nicht im Chat ist. Das Bedienelement **Add from Folder** erscheint nur, wenn mindestens ein Ordner existiert. Wie du Ordner anlegst und verwaltest, steht in der unten verlinkten Anleitung zur Charakterbibliothek.

Möglich ist außerdem ein Klick auf die Zeile **Random** (Zufall, beschriftet mit **Dice pick**): Sie nimmt einen zufälligen Charakter auf, der noch nicht im Chat ist.

## Mitglieder nachträglich verwalten

Charaktere fügst du im Panel **Chat Settings** (Chat-Einstellungen) hinzu, entfernst sie dort und sortierst sie um. Öffne es über das Zahnradsymbol in der Chat-Kopfzeile. Der Tooltip – der Kurzhinweis beim Draufzeigen – lautet **Chat Settings**.

Im Panel findest du den Abschnitt **Characters**. Er zeigt die Mitgliederzahl und den Hilfetext „Characters in this chat. Each character has their own personality that the AI roleplays as.“ Jede Mitgliederzeile besteht aus Avatar, Charakternamen, Ziehpunkt, Augensymbol und Papierkorbsymbol.

- Für einen weiteren Charakter klick auf **Add Character** (Charakter hinzufügen) und such nach ihm.
- Für einen kompletten Ordner klick auf **Add from Folder** und wähl einen aus.
- Zum Entfernen klick auf das Papierkorbsymbol. Sein Tooltip lautet **Remove from chat**.
- Zum Umsortieren zieh ein Mitglied am Ziehpunkt nach oben oder unten. Dessen Tooltip lautet **Drag to reorder**.

Die Reihenfolge der Mitglieder ist wichtig. Bei der Antwortreihenfolge **Sequential** (siehe unten) antworten die Charaktere genau in der Reihenfolge, in der sie hier stehen. Zieh ein Mitglied an eine andere Stelle, und es kommt früher oder später zu Wort.

Im Game Mode fehlt der Abschnitt **Characters**. Dort wird die Party an anderer Stelle verwaltet.

### Ein Mitglied stummschalten, statt es zu entfernen

Manchmal soll ein Charakter eine Weile pausieren, aber in der Liste bleiben. Dafür ist das Augensymbol in seiner Mitgliederzeile da.

- Ein Klick auf das Auge deaktiviert den Charakter. Der Tooltip wechselt zu **Disable in chat**, und das Auge wird durchgestrichen.
- Ein zweiter Klick holt ihn zurück. Der Tooltip lautet dann **Enable in chat**.

Ein deaktivierter Charakter bleibt in der Mitgliederliste, hält sich aber aus jeder Antwort heraus. Marinara schickt seine Charakterkarte nicht ans Modell, und er lässt sich auch nicht als Sprecher auswählen.

Eine Absicherung gibt es: Deaktivierst du alle Charaktere im Chat, behandelt Marinara wieder alle als aktiv. So kommt keine Antwort ganz ohne Charaktere zustande.

Diesen Zustand speichert Marinara pro Chat. Am Charakter selbst ändert sich an keiner anderen Stelle der App etwas.

## Wer spricht: Roleplay Mode

Im Roleplay Mode bekommt ein Gruppenchat in den **Chat Settings** einen Abschnitt **Group Chat**. Er taucht nur auf, wenn mindestens zwei Charaktere im Chat sind. Dort legst du fest, wie die Charaktere antworten.

### Merged (Narrator) oder Individual

Die Einstellung **Mode** ist ein Schalter mit zwei Positionen.

- **Merged (Narrator)** ist der Standard. Eine einzige Antwort spricht für alle Charaktere und enthält zusätzlich die Erzählung.
- **Individual** lässt jeden Charakter eine eigene Antwort generieren.

### Color Dialogues (nur bei Merged)

Steht **Mode** auf **Merged (Narrator)**, kannst du **Color Dialogues** einschalten. Standardmäßig ist die Option aus. Ist sie an, erscheinen die Zeilen jedes Charakters in dessen eigenen Farben. Diese Farben stammen aus dem Tab **Colors** im Charakter-Editor. Dort stellst du Namensfarbe, Dialogfarbe und Boxfarbe ein. Wie das geht, steht in der Anleitung zum Bearbeiten von Charakteren.

<a id="response-order-individual-only"></a>

### Response Order (nur bei Individual)

Steht **Mode** auf **Individual**, erscheint die Einstellung **Response Order** (Antwortreihenfolge) – ein Schalter mit drei Positionen.

- **Sequential** ist der Standard. Alle Charaktere antworten nacheinander, in der Reihenfolge der Liste **Characters**. Sortier die Mitglieder um, und die Zugfolge ändert sich mit.
- **Smart** entscheidet über einen kurzen, verborgenen KI-Aufruf, welcher Charakter als Nächstes antwortet. Dabei fließen die letzten Nachrichten und die Details aller Charaktere ein; meist fällt die Wahl auf einen einzigen Sprecher. Schreibst du eine At-Erwähnung wie `@Alice` in die Nachricht, hat sie Vorrang vor dieser Wahl.
  Hast du ein **Decision model** (Entscheidungsmodell) ausgewählt (siehe [Decision-Modelle](../connections/decision-models.md)), kannst du darunter **Also use it to pick who speaks in Smart response order** (auch die Sprecherwahl bei Smart-Reihenfolge übernehmen) aktivieren. Smart lässt dann jeden Kandidaten einzeln mit ja oder nein bewerten. Die Fragen teilen sich die letzten fünf Nachrichten und eine Liste mit Namen, Status, Aktivität, Gesprächigkeit sowie einem kurzen Auszug aus Persönlichkeit oder Beschreibung. Ein gehosteter Anbieter erhält auch diese Liste; siehe [Was das Modell sieht](../connections/decision-models.md#what-the-model-sees).

  Diese Bewertungen können schneller vorliegen als eine vollständige KI-Antwort; Geschwindigkeit und Kosten hängen aber vom Modell und der Kandidatenzahl ab. In Roleplay wählt Marinara den wahrscheinlichsten Sprecher. In Conversation antworten alle mit einem Anlass, die wahrscheinlichsten zuerst. Wer gerade gesprochen hat, wartet, wenn jemand anderes einen Grund zum Antworten hat. Antwortet das Decision-Modell nicht, verwendet Smart seinen gewöhnlichen KI-Aufruf.

- **Manual** unterbindet jede automatische Antwort. Wer antwortet, bestimmst du über die Auswahl **Trigger Response** in der Nachrichtenleiste.

Bei **Smart** kann die KI mehrere Charaktere in eine Warteschlange stellen. Sofort antwortet nur der erste. Wer als Nächstes spricht, wählst du über die Auswahl **Trigger Response** in der Nachrichtenleiste. Alternativ schickst du eine leere Nachricht ab, dann kommt der nächste Charakter aus der Warteschlange dran.

Im Modus **Individual** kommen zwei weitere Schalter dazu:

- **Add Turn To Prompt** ist standardmäßig an. Der Schalter ergänzt eine kurze Anweisung, die den Charakter für diesen Zug benennt.
- **Name Prefix History** ist standardmäßig aus. Der Schalter ändert, wie vergangene Nachrichten vor dem Versand ans Modell mit Sprechernamen versehen werden. Lass ihn aus, solange kein Charakter durcheinanderbringt, wer was gesagt hat.

### Scenario Override

Über das Feld **Scenario Override** (Szenario überschreiben) gibst du der ganzen Gruppe ein gemeinsames Szenario. Der eingetippte Text ersetzt im Prompt das jeweils eigene Szenario jedes Charakters. Bleibt das Feld leer, behält jeder Charakter wie gewohnt sein eigenes Szenario.

Einen Schalter zum Ein- und Ausschalten gibt es nicht: Text eintippen aktiviert die Funktion, Text löschen deaktiviert sie. Für ein größeres Fenster klick auf das Symbol zum Aufklappen (Tooltip **Expand editor**). Der größere Editor trägt den Titel **Group Scenario Override**.

Ein Hinweis zur Wiederverwendung: Der Text in **Scenario Override** hängt an genau diesem einen Chat. Einstellungsprofile nehmen ihn nicht mit, er wandert also nicht mit einem Profil in einen neuen Chat.

### Einstellungen und Standardwerte (Roleplay)

| Einstellung | Wo | Standard |
|---|---|---|
| **Mode** (**Merged (Narrator)** / **Individual**) | Abschnitt Group Chat | Merged (Narrator) |
| **Color Dialogues** | Abschnitt Group Chat, Modus Merged | Off |
| **Response Order** (Sequential / Smart / Manual) | Abschnitt Group Chat, Modus Individual | Sequential |
| **Add Turn To Prompt** | Abschnitt Group Chat, Modus Individual | On |
| **Name Prefix History** | Abschnitt Group Chat, Modus Individual | Off |
| **Scenario Override** | Abschnitt Group Chat | Leer (aus) |

Die meisten dieser Einstellungen landen in den Einstellungsprofilen und lassen sich so wiederverwenden. Die einzige Ausnahme ist **Scenario Override**: Sie bleibt beim einzelnen Chat.

## Wer spricht: Conversation Mode

Der Conversation Mode unterstützt dieselben Gruppenchats, zeigt aber keinen Abschnitt **Group Chat**. Seine Bedienelemente sitzen stattdessen im Abschnitt **Autonomous Messaging** (Autonome Nachrichten) der **Chat Settings**.

Standardmäßig verhält sich eine Gruppen-Conversation wie der Modus Merged. Eine Antwort kann für mehrere Charaktere sprechen, und ihre Zeilen färbt Marinara automatisch nach Sprecher ein. Einen eigenen Schalter für Farben gibt es im Conversation Mode nicht.

### Reply When Mentioned

Schalte **Reply When Mentioned** (Nur bei Erwähnung antworten) ein, damit im Chat immer nur ein Charakter zur Zeit spricht. Ist die Option an, antworten Charaktere ausschließlich, wenn du sie namentlich nennst oder von Hand auslöst. Die Beschreibung des Schalters lautet „Characters wait for direct mentions or manual response triggers.“

Einen Charakter nennst du über eine At-Erwähnung. Tipp `@` gefolgt vom Charakternamen ins Nachrichtenfeld, und eine Vorschlagsliste klappt auf. Es antworten genau die Charaktere, die du erwähnst.

Willst du einen Sprecher ohne Erwähnung bestimmen, nutz die Auswahl **Trigger Response**.

- Am Desktop ist das eine Schaltfläche neben Send.
- Auf dem Handy findest du sie unter der Überschrift **Trigger Response** im Werkzeugfach, das du über die Nachrichtenleiste öffnest.

Der Tooltip der Schaltfläche lautet „Trigger character response“.

### Character Exchanges

Schalte **Character Exchanges** (Charaktere untereinander) ein, damit die Charaktere von sich aus miteinander reden. Standardmäßig ist die Option aus. Die Beschreibung lautet „Characters chat with each other in group chats.“

Ist sie an, antworten die Charaktere auch einander, während du weg bist – nicht nur dir. Das läuft nur, solange Marinara im Browser geöffnet ist. Schließt du die App, hören die Wortwechsel auf. Außerdem zählen sie auf dasselbe tägliche Nachrichtenlimit wie autonome Nachrichten.

## Zugfolge auf einen Blick

| Modus und Einstellung | Was passiert | So steuerst du es |
|---|---|---|
| Roleplay, Merged | Eine Antwort spricht für alle Charaktere | Immer alle Charaktere gemeinsam |
| Roleplay, Individual, Sequential | Jeder Charakter antwortet in Mitgliederreihenfolge | Mitglieder per Ziehen umsortieren |
| Roleplay, Individual, Smart | Die KI wählt den nächsten Sprecher oder die nächsten Sprecher | Die Erwähnung `@Name` hat Vorrang |
| Roleplay, Individual, Manual | Niemand antwortet von selbst | Auswahl **Trigger Response** nutzen |
| Conversation, Standard | Eine Antwort kann für mehrere Charaktere sprechen | Die Erwähnung `@Name` spricht einen Charakter an |
| Conversation, Reply When Mentioned an | Ohne Erwähnung oder Auslöser antwortet niemand | Erwähnung `@Name` oder Auswahl **Trigger Response** |
| Conversation, Character Exchanges an | Charaktere schreiben auch einander | Zum Beenden wieder ausschalten |

## Verwandte Anleitungen

- [Charakterbibliothek organisieren](../characters/library-organization.md)
- [Conversation Mode: Erste Schritte](../conversation/getting-started.md)
- [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md)
