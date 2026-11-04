# Gruppenchats und Gruppen-Conversations

Ein Gruppenchat ist jeder Conversation- oder Roleplay-Chat mit zwei oder mehr Charakteren. In dieser Anleitung erfährst du, wie du einen anlegst, seine Mitglieder verwaltest und festlegst, wer spricht. Der Game Mode hat ein eigenes Party-System und wird hier nicht behandelt.

Eine eigene Schaltfläche „Gruppenchat“ gibt es nicht. Ein Chat wird zum Gruppenchat, sobald du einen zweiten Charakter hinzufügst. Ein Gruppenchat ist weder ein **Folder** (Ordner, eine gespeicherte Charakterliste, die du wiederverwenden kannst) noch eine **Chat Branch** (Chat-Verzweigung, eine alternative Fassung eines Chats).

## Einen Gruppenchat anlegen

1. Klick im Panel **Chats** auf die Schaltfläche **+** für den gewünschten Modus: **New Conversation** (neue Conversation) oder **New Roleplay** (neues Roleplay).
2. Ein Einrichtungsassistent öffnet sich. Tipp im Schritt **Persona & Characters** (Persona und Charaktere) in **Search characters...** (Charaktere suchen) und klick auf einen Charakter, um ihn hinzuzufügen.
3. Füg einen zweiten Charakter auf dieselbe Weise hinzu.
4. Schließ den Assistenten ab, um den Chat zu öffnen.

Die Beschriftung über der Auswahl ändert sich. In Conversation steht dort **Group Chat** mit der Mitgliederzahl. In Roleplay steht dort **Characters** mit der Anzahl. Benennst du den Chat nicht um, benennt Marinara ihn nach den Charakteren, zum Beispiel „Alice, Bob, Carol“.

Eine feste Obergrenze für Charaktere gibt es nicht. Mehr Charaktere bedeuten einen längeren Prompt und höhere Kosten pro Antwort. Nimm deshalb nur die Charaktere auf, die die Szene braucht.

Um einen ganzen Ordner auf einmal hinzuzufügen, öffne im selben Schritt **Add from Folder** (aus Ordner hinzufügen), wähl einen Ordner und klick auf **Add** (Hinzufügen). Charaktere, die schon im Chat sind, werden übersprungen. Das Bedienelement erscheint nur, wenn du mindestens einen Ordner hast. Siehe [Die Charakter-Bibliothek organisieren](../characters/library-organization.md). Die Zeile **Random** (Zufall, beschriftet mit **Dice pick**) fügt einen zufälligen Charakter hinzu, der noch nicht im Chat ist.

## Mitglieder verwalten

Öffne **Chat Settings** (Chat-Einstellungen) und such den Abschnitt **Characters**. Im Game Mode gibt es ihn nicht. Jede Mitgliederzeile hat einen Avatar, einen Namen, einen Ziehpunkt, ein Augensymbol und ein Papierkorbsymbol.

| Vorhaben | So geht's |
| --- | --- |
| Einen Charakter hinzufügen | Klick auf **Add Character** (Charakter hinzufügen) und such ihn. |
| Einen Ordner hinzufügen | Klick auf **Add Character** und dann in der Ordnerzeile auf **Add all** (alle hinzufügen). |
| Mehrere auf einmal ändern | Klick auf den Namen eines Mitglieds. Es öffnet sich dieselbe Auswahl. |
| Einen Charakter entfernen | Klick auf das Papierkorbsymbol (**Remove from chat**). |
| Umsortieren | Zieh den Ziehpunkt (**Drag to reorder**). Bei der Reihenfolge **Sequential** antworten die Charaktere in dieser Reihenfolge. |
| Vorübergehend ausschalten | Klick auf das Auge (**Disable in chat**). Ein erneuter Klick schaltet ihn wieder ein (**Enable in chat**). |

Ein deaktivierter Charakter bleibt in der Liste, wird aber bei jeder Antwort ausgelassen. Seine Karte wird nicht an das Modell gesendet, und er kann nicht als Sprecher gewählt werden. Deaktivierst du alle Charaktere, behandelt Marinara alle als aktiv, damit eine Antwort nie leer bleibt. Das wird pro Chat gespeichert und ändert an keiner anderen Stelle etwas. In einer Roleplay-Gruppe im Modus Merged kann [Automate active characters](#automate-active-characters-merged-only) (aktive Charaktere automatisieren) das für dich übernehmen.

<a id="choose-who-speaks"></a>

## Festlegen, wer spricht

Öffne **Chat Settings → Group Chat**. Der Abschnitt erscheint nur, wenn der Chat zwei oder mehr Charaktere hat. Beide Modi nutzen denselben Schalter **Mode** (Modus).

- Eine Antwort spricht für alle Charaktere. In Roleplay heißt das **Merged (Narrator)**, in Conversation **Grouped**. Das ist der Standard. In Roleplay ist der Erzähler eine Erzählstimme, die die Szene beschreibt, und er ist Teil derselben Antwort.
- **Individual** gibt jedem Charakter eine eigene Antwort.

In Conversation zeigt der Wechsel zu **Individual** eine Warnung: **Individual replies can use many tokens**. Jeder antwortende Charakter nutzt eine eigene Modellanfrage, und große Gruppen mit Autonomous Messaging verbrauchen schnell Tokens.

### Automate active characters (Roleplay, nur bei Merged)

Diese Einstellung schaltet in einer großen Besetzung Charaktere für dich ein und aus. Siehe [Automate active characters](#automate-active-characters-merged-only) am Ende dieser Anleitung.

### Color Dialogues (Roleplay, nur bei Merged)

**Color Dialogues** (Dialoge einfärben) ist standardmäßig aus. Ist die Option an, erscheinen die Zeilen jedes Charakters in dessen eigenen Farben aus dem Tab **Colors** (Farben) im Charakter-Editor. In einer Conversation-Gruppe werden die Zeilen automatisch nach Sprecher eingefärbt, und es gibt keinen Schalter.

<a id="response-order-individual-only"></a>

### Response Order (nur bei Individual)

Steht **Mode** auf **Individual**, erscheint **Response Order** (Antwortreihenfolge). **Sequential** ist der Standard.

| Reihenfolge | Was passiert |
| --- | --- |
| **Sequential** | Die Charaktere antworten nacheinander, in der Reihenfolge der Liste **Characters**. In Conversation werden Charaktere übersprungen, die offline sind. |
| **Smart** | Ein kurzer, verborgener Modellaufruf wählt, wer als Nächstes antwortet, meist ein einzelner Charakter. Eine Erwähnung wie `@Alice` in deiner Nachricht hat Vorrang. In Conversation berücksichtigt er das Gespräch, den Zeitplanstatus und die Gesprächigkeit. |
| **Manual** | Niemand antwortet von selbst. In Roleplay nutzt du die Auswahl **Trigger Response** (Antwort auslösen). In Conversation erwähnst du einen oder mehrere Charaktere per `@mention` oder nutzt die Auswahl. |

Bei der Reihenfolge **Smart** kann das Modell mehrere Charaktere in eine Warteschlange stellen. Nur der erste antwortet sofort. Nutze die Auswahl **Trigger Response** oder schick eine leere Nachricht, um den nächsten Charakter aus der Warteschlange antworten zu lassen.

Hast du ein [Decision-Modell](../connections/decision-models.md) gewählt, kannst du darunter **Also use it to pick who speaks in Smart response order** (auch die Sprecherwahl bei Smart-Reihenfolge übernehmen) einschalten. Die Smart-Reihenfolge fragt dann für jeden Kandidaten eine Ja-oder-Nein-Bewertung ab.

- Die Fragen teilen sich die letzten fünf Nachrichten und eine Liste mit Name, Status, Aktivität, Gesprächigkeit und einem kurzen Auszug aus der Persönlichkeit jedes Kandidaten. Ein gehosteter Dienst erhält diese Liste ebenfalls. Siehe [Was das Modell sieht](../connections/decision-models.md#what-the-model-sees).
- Geschwindigkeit und Kosten hängen vom Modell und der Zahl der Kandidaten ab.
- In Roleplay wählt Marinara den wahrscheinlichsten Sprecher. In Conversation antworten alle mit einem Anlass, die wahrscheinlichsten zuerst. Wer gerade gesprochen hat, wartet, wenn jemand anderes einen Grund zum Antworten hat.
- Liefert das Decision-Modell keine Antwort, macht die Smart-Reihenfolge ihren gewöhnlichen Modellaufruf.

In Roleplay im Modus **Individual** mit der Reihenfolge **Smart** oder **Manual** ist die erste Option der Auswahl **Smart**, markiert mit einem Personengruppen-Symbol. Damit wählt das Modell den nächsten Sprecher für diese eine Antwort. Deine gespeicherte Reihenfolge bleibt unverändert.

### Eine Antwort von Hand auslösen

Mit der Auswahl **Trigger Response** wählst du einen Sprecher. Am Computer ist das eine Schaltfläche neben **Send** (Senden) mit der Beschriftung **Trigger character response**. Am Telefon steht sie unter **Trigger Response** im Werkzeugfach, das du über die Nachrichtenleiste öffnest. Um einen Sprecher im Text zu nennen, tipp `@` und den Namen des Charakters. Eine Vorschlagsliste erscheint.

### Weitere Einstellungen für Individual

- **Add Turn To Prompt** ist standardmäßig an. Der Schalter ergänzt eine kurze Anweisung, die nennt, welcher Charakter antworten soll.
- **Name Prefix History** (nur Roleplay) ist standardmäßig aus. Der Schalter ändert, wie vergangene Nachrichten mit Sprechernamen versehen werden. Lass ihn aus, solange kein Charakter immer wieder durcheinanderbringt, wer was gesagt hat.

### Scenario Override (Roleplay)

**Scenario Override** (Szenario überschreiben) gibt der ganzen Gruppe ein gemeinsames Szenario. Text im Feld ersetzt im Prompt das eigene Szenario jedes Charakters. Ein leeres Feld lässt jedes Szenario, wie es ist. Einen Schalter gibt es nicht. Um in einem größeren Fenster zu bearbeiten, klick auf das Symbol zum Aufklappen (**Expand editor**, mit dem Titel **Group Scenario Override**). Dieser Text bleibt bei einem einzelnen Chat und wird nicht in Einstellungsprofile übernommen.

### Character Exchanges (Conversation)

Schalte **Character Exchanges** (Charaktere untereinander) unter **Chat Settings → Autonomous Messaging** ein, damit Charaktere miteinander reden, während du weg bist. Die Option ist standardmäßig aus und erscheint nur in einem Gruppenchat. Sie läuft nur, solange Marinara in deinem Browser geöffnet ist, und teilt sich das tägliche Nachrichtenlimit der autonomen Nachrichten. Sie funktioniert mit und ohne Charakter-Zeitpläne. In einer Gruppe im Modus **Individual** verbrauchen Wortwechsel und Antworten auf eine `@mention` nie die letzte Meldung, die der Gruppe an einem Tag zusteht.

## Einstellungen und Standardwerte

| Einstellung | Wo | Standard |
| --- | --- | --- |
| **Mode** | Abschnitt Group Chat | **Merged (Narrator)** in Roleplay, **Grouped** in Conversation |
| **Color Dialogues** | Roleplay, Merged | Aus |
| **Automate active characters** | Roleplay, Merged | Aus |
| **Response Order** | Individual | Sequential |
| **Add Turn To Prompt** | Individual | An |
| **Name Prefix History** | Roleplay, Individual | Aus |
| **Scenario Override** | Roleplay | Leer |
| **Character Exchanges** | Conversation, Autonomous Messaging | Aus |

Einstellungsprofile speichern diese Werte, außer **Scenario Override** und den Anheftungen der Automatik. Siehe [Einstellungsprofile](settings-profiles.md).

## Referenz

<a id="automate-active-characters-merged-only"></a>

### Automate active characters (nur bei Merged)

Im Modus Merged steckt die Karte jedes aktiven Charakters bei jeder Antwort im Prompt. In Roleplay kann **Automate active characters** Karten für dich ein- und ausschalten, damit eine große Besetzung den Kontext nicht füllt. Die Einstellung hat drei Optionen und ist standardmäßig **Off**.

| Option | Was sie macht |
| --- | --- |
| **Off** | Du wählst mit den Augen-Schaltern, wer aktiv ist. |
| **Decision model** (Entscheidungsmodell) | Vor jeder Antwort beantwortet dein [Decision-Modell](../connections/decision-models.md) pro Charakter eine Ja-oder-Nein-Frage: Ist dieser Charakter in der Szene, die die Antwort fortsetzt, oder betritt er sie? Ein Charakter, der nur erwähnt wird oder an den nur jemand zurückdenkt, bleibt aus. |
| **Character Tracker** | Die anwesenden Charaktere aus der letzten Antwort laut [Character Tracker](../agents/built-in-agents.md#character-tracker) bestimmen, wer aktiv ist. Das braucht keinen zusätzlichen Modellaufruf, läuft aber eine Runde hinterher: Ein Charakter, der jetzt hereinkommt, wird erst für die nächste Antwort eingeschaltet. |

Ein Hinweis unter der Einstellung sagt dir, wenn etwas fehlt: kein Decision-Modell gewählt, der Character Tracker in diesem Chat aus oder ein Tracker, der manuell läuft und die Liste erst ändert, nachdem du ihn ausgeführt hast.

- **Anheftungen.** Solange die Automatik an ist, zeigt jede Charakterzeile links neben dem Auge eine Stecknadel. Klick darauf, um den Charakter so anzuheften, wie er gerade ist, an oder aus; die Automatik lässt ihn dann in Ruhe. Schaltest du ein Auge von Hand um, wird dieser Charakter ebenfalls angeheftet. Klick erneut auf eine Stecknadel, um die Anheftung zu lösen. Schaltest du die Automatik auf **Off**, werden alle Anheftungen gelöscht.
- **Der Erzähler bleibt aktiv.** Der ernannte Narrator (Erzähler) wird nie ausgeschaltet.
- **Ohne Antwort bleibt die Liste.** Liefert das Modell im Modus **Decision model** keine Antwort, wird die letzte Szene des Character Trackers verwendet, sofern es eine gibt. Das gilt auch für ein Modell, das zuerst nachdenkt, außer **Also gate agents that run before the reply** (auch Agenten vor der Antwort prüfen) ist eingeschaltet, und für eine Besetzung, die zu groß für die Eingabe des Decision-Modells ist. Kommt von keinem der beiden eine Antwort, bleibt die Liste, wie sie ist.
- **Niemand aktiv wird ignoriert.** Ein Ergebnis, das alle ausschalten würde, wird nicht übernommen.
- **Ein Character-Activity-Agent hat Vorrang.** Hat ein Chat einen eigenen Agenten mit dem Ergebnistyp **Character Activity**, bleibt dieser Agent zuständig.

Der Character Tracker schreibt für jeden Charakter einen eigenen Namen. Marinara ordnet ihn einer Karte zu, zuerst über die ID der Karte, dann über den Namen und dann über die Namensaliasse im Tab **Colors**. Eine Tracker-Liste, die keinen der Charaktere des Chats nennt, lässt die aktuelle Liste unverändert. Die Automatik läuft vor jeder Antwort, jedem Swipe und jedem Neugenerieren und überspringt **Continue** und Impersonation. Die Einstellung wird in Einstellungsprofilen gespeichert. Anheftungen bleiben bei dem einen Chat.
