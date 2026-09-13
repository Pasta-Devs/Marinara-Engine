# Szenen: Eine Roleplay-Verzweigung

In dieser Anleitung erfährst du, wie Szenen in Marinara Engine funktionieren. Eine Szene ist ein kurzes, in sich geschlossenes Roleplay, das von einem Conversation-Chat abzweigt. Es geht darum, wie du eine Szene startest, spielst und am Ende beendest, verwirfst, abzweigst oder umwandelst.

## Was eine Szene ist

Eine Szene ist ein Neben-Roleplay, das aus einem Conversation-Chat heraus entsteht. Der Conversation-Chat ist der Modus im Messenger-Stil, also der direkte Nachrichtenaustausch. In einer Szene treten du und ein Charakter aus diesem Chat heraus und spielt einen konzentrierten Roleplay-Moment. Das kann eine Rückblende sein, ein Date oder ein Kampf. Der Hauptstrang bleibt dabei erhalten.

Jede Szene ist ein eigener Roleplay-Chat. Sie hat einen eigenen Hintergrund, eigene Charaktere auf der Bühne und eine eigene Eröffnungsnachricht. Den Aufbau schreibt der Charakter oder die Geschichte selbst, sobald die Szene beginnt.

Eine Szene ist bewusst nur vorübergehend gedacht. Solange sie läuft, zeigt der ursprüngliche Conversation-Chat eine kleine Karte mit dem Text **A scene is in progress** (eine Szene läuft gerade). Auf dieser Karte führt die Schaltfläche **Go to Scene** (zur Szene springen) direkt in die aktive Szene.

Am Ende entscheidest du, was mit der Szene passiert. Möglich sind drei Wege: eine Zusammenfassung zurück in den Conversation-Chat speichern, die Szene wegwerfen oder sie als eigenständiges Roleplay dauerhaft behalten. Diese Möglichkeiten sind weiter unten erklärt.

## Eine Szene starten

Szenen startest du innerhalb eines Conversation-Chats mit dem Befehl `/scene`. Dafür gibt es den gleichbedeutenden Kurzbefehl `/rp`.

So geht's:

1. Öffne einen Conversation-Chat, in dem schon ein paar Nachrichten stehen.
2. Tippe den Szenen-Befehl ins Nachrichtenfeld. Dahinter kannst du kurz beschreiben, worum es gehen soll.

```
/scene we sneak into the old library at midnight
```

3. Drück Enter. Das Fenster **Scene Prompt Setup** (Szenen-Einrichtung) öffnet sich.
4. Wähle eine **Prompt preset** (Prompt-Vorlage) für die neue Szene oder lasse **None** (keine) ausgewählt. Marinara merkt sich diese Auswahl für die nächste Szene. Die eigenen Anweisungen der Szene gelten weiterhin zusammen mit der ausgewählten Vorlage.
5. Leg unter **POV** die Erzählperspektive fest: **First Person**, **Second Person** oder **Third Person**.
6. Wähl unter **Tense** die Zeitform: **Past**, **Present** oder **Future**.
7. Ins Feld **Extra instructions** (zusätzliche Anweisungen) kannst du optional Notizen schreiben, um die Szene zu lenken.
8. Klick auf **Plan Scene**.

Marinara plant die Szene und öffnet sie als neuen Roleplay-Chat. Die neue Szene taucht in der Chatliste auf und öffnet sich automatisch, mit einer Eröffnungsnachricht, die die Situation setzt. Wenn du es dir im Einrichtungsfenster anders überlegst, klick auf **Cancel** – dann entsteht keine Szene.

Eine Szene lässt sich auch ohne Beschreibung starten. Tipp einfach nur den Befehl, sofern der Chat schon genug Vorgeschichte hat, auf der die Szene aufbauen kann.

```
/scene
```

Stehen im Chat noch gar keine Nachrichten, bittet Marinara dich, erst eine Beschreibung zu ergänzen oder zu chatten, bevor eine Szene geplant werden kann.

Auch ein Charakter kann von sich aus eine Szene vorschlagen. Dann öffnet sich dasselbe Fenster **Scene Prompt Setup**, mit einer Zeile wie „[Character] wants to start a scene“. Wähl **Prompt preset**, **POV** und **Tense** und klick genauso auf **Plan Scene** – oder lehn mit **Cancel** ab.

## Die Szenenleiste: End Scene, Discard, Convert und Back to conversation

In einer laufenden Szene sitzt direkt über dem Nachrichtenfeld eine Leiste. Dort stehen die Bedienelemente, die über das Schicksal der Szene entscheiden. Welche Schaltflächen genau erscheinen, hängt davon ab, ob die Szene mit einem Conversation-Chat verknüpft ist.

- **Back to conversation** (zurück zum Chat) bringt dich in den Conversation-Chat zurück, aus dem die Szene entstanden ist. Die Szene bleibt offen und aktiv, du kannst also später weitermachen. Diese Schaltfläche erscheint nur, wenn die Szene einen Ursprungs-Chat hat.
- **End Scene** (Szene beenden) schließt die Szene ab und speichert eine Zusammenfassung. Nach dem Klick fragt die Leiste **End and save summary?** und bietet **Yes** und **No** an. Bestätige mit **Yes**. Währenddessen zeigt die Schaltfläche den Zustand **Saving...**. Marinara schreibt eine kurze Zusammenfassung der Szene als Erinnerung in den Ursprungs-Chat zurück und bringt dich dorthin, wo dieser Chat aufgehört hat.
- **Discard** (verwerfen) wirft die Szene weg, ohne irgendetwas zu speichern. Nach dem Klick fragt die Leiste **Discard scene?** und bietet **Yes** und **No** an. Mit **Yes** löschst du die Szene und landest wieder im Chat. Zurückgeschrieben wird nichts.
- **Convert** (umwandeln) macht aus der Szene einen eigenständigen Roleplay-Chat. Weil das die Szene dauerhaft verändert, hat diese Funktion weiter unten einen eigenen Abschnitt.

Überleg dir **End Scene** und **Discard** in Ruhe, denn beide entfernen die Szene aus dem Chat. **End Scene** hinterlässt immerhin eine Erinnerung an das Geschehene. **Discard** hinterlässt nichts.

## Eine Szene ab einer Nachricht klonen

In einem Szenen-Chat hat jede Nachricht eine kleine Aktionsschaltfläche mit dem Tooltip **Clone from here** (Kurzhinweis beim Draufzeigen: ab hier klonen). Damit zweigst du den Szeneninhalt in einen komplett neuen Roleplay-Chat ab – kopiert wird alles bis einschließlich dieser Nachricht.

Und so funktioniert's:

1. Zeig mit der Maus auf die Nachricht, ab der du verzweigen willst.
2. Klick auf die Aktion **Clone from here**.

Marinara legt aus der Szene ein frisches, eigenständiges Roleplay an und kopiert die Nachrichten bis zu diesem Punkt. Die ursprüngliche Szene bleibt offen und aktiv – so kannst du gefahrlos einen anderen Weg ausprobieren. Eine Bestätigung meldet, dass die Szene als Roleplay geklont wurde, und der neue Chat öffnet sich.

Beim Klonen bleibt die ursprüngliche Szene erhalten. Beim Umwandeln, das gleich beschrieben wird, nicht.

## Eine Szene in ein eigenständiges Roleplay umwandeln

Die Schaltfläche **Convert** in der Szenenleiste löst die Szene ab und macht daraus einen dauerhaften, eigenständigen Roleplay-Chat. Nach einem Klick auf **Convert** öffnet sich ein Bestätigungsfenster mit dem Titel **Convert this scene into a standalone roleplay?**

Das Fenster erklärt, was passiert: Aus der aktuellen Szene entsteht ein neuer Roleplay-Chat, und die ursprüngliche Szene wird von ihrem Chat gelöst. Weder eine Szenen-Zusammenfassung noch eine Charakter-Erinnerung landen im ursprünglichen Chat. Klick auf **Convert**, um fortzufahren, oder auf **Cancel**, um alles so zu lassen, wie es ist.

**Convert** passt, wenn aus einer Szene eine Geschichte geworden ist, die du behalten und als normales Roleplay weiterspielen willst. **Clone from here** passt, wenn du eine Kopie willst, die ursprüngliche Szene aber bestehen bleiben soll.

Damit der Unterschied zwischen den beiden Wegen klar bleibt: Mit **Clone from here** zweigst du Szenen ab, während das Original aktiv bleibt. Mit **Convert** wandelst du Szenenzweige in ein eigenständiges Roleplay um – und das Original verschwindet aus seinem Chat.

## Warum Szenen den Kontext verbundener Chats nicht erben

Ein Conversation-Chat lässt sich mit einem Roleplay verbinden, sodass Kontext zwischen beiden fließt. Bei Szenen ist das absichtlich anders. Eine Szene steht für sich.

Eine Szene zieht den Gesprächskontext eines verbundenen Chats nicht automatisch heran – selbst dann nicht, wenn der übergeordnete Chat genau das tut. Ein verbundener Conversation-Chat kann im Hintergrund kurze Steuerungshinweise an ein verknüpftes Roleplay weitergeben und dessen Handlung so anstoßen; eine Szene ignoriert diese Hinweise. Dadurch bleibt die Szene auf ihren eigenen Moment konzentriert, statt den ganzen Chat mitzuschleppen.

Genau deshalb liest sich eine Szene sauber als eigene kleine Geschichte. Wenn du die dauerhafte Verbindung in beide Richtungen zwischen Chat und Roleplay willst, nimm einen verbundenen Chat statt einer Szene. Die unten verlinkte Anleitung zu verbundenen Chats beschreibt diese Funktion.

## Verwandte Anleitungen

- [Roleplay Mode: Erste Schritte](getting-started.md)
- [Chat-Verzweigungen](../chats/branches.md)
- [Einen Conversation-Chat mit einem Roleplay oder Game verbinden](../chats/connected-chats.md)
