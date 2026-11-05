# Szenen: Ein Roleplay verzweigen

Eine Szene ist ein kurzes Roleplay, das von einem Conversation-Chat abzweigt. Nutze eine für eine Rückblende, ein Date oder einen Kampf, ohne den Hauptstrang zu verlieren.

Jede Szene ist ein eigener Roleplay-Chat mit eigenem Hintergrund, eigenen Charakteren und eigener Eröffnungsnachricht. Solange sie offen ist, zeigt der ursprüngliche Conversation-Chat eine Karte mit dem Text **A scene is in progress** und der Schaltfläche **Go to Scene** (zur Szene springen).

Solange eine Szene läuft, antworten ihre Charaktere im Conversation-Chat nicht, und ein Hinweis sagt, dass sie in einer aktiven Szene sind. Damit sie dir dort trotzdem antworten, schalte auf der Karte **Allow replies here** (Antworten hier erlauben) ein. Anfangs ist das aus. Ist es an, antworten Szenen-Charaktere, wenn du ihnen schreibst, schicken aber weiterhin nicht von sich aus Nachrichten.

## Eine Szene starten

Bevor du anfängst: Öffne einen Conversation-Chat, in dem schon ein paar Nachrichten stehen. Siehe [Conversation Mode: Erste Schritte](../conversation/getting-started.md).

1. Tippe ins Nachrichtenfeld `/scene` und eine kurze Beschreibung. `/rp` bewirkt dasselbe. Zum Beispiel: `/scene we sneak into the old library at midnight`
2. Drück <kbd>Enter</kbd>. **Scene Prompt Setup** (Szenen-Einrichtung) öffnet sich.
3. Siehst du **Scene persona** (Szenen-Persona), wähle, wer dich spielt. **Use the Conversation persona** (Persona der Conversation verwenden) behält die Persona der Conversation bei.
4. Siehst du **Scene characters** (Szenen-Charaktere), lass **Let the scene planner choose characters** (Charaktere vom Szenenplaner wählen lassen) an, damit Marinara auswählt. Oder schalte es aus und wähle mindestens einen Charakter.
5. Wähle ein **Prompt preset** (Prompt-Preset). Lass es auf **None** (keines), um das Preset deines [Einstellungsprofils](../chats/settings-profiles.md#choosing-the-default-profile) zu verwenden, das für Roleplay als Standard festgelegt ist. Marinara merkt sich deine Auswahl für die nächste Szene.
6. Wähl unter **POV** (Erzählperspektive) **First Person**, **Second Person** oder **Third Person**.
7. Wähl unter **Tense** (Zeitform) **Past**, **Present** oder **Future**.
8. Optional: Schreib Notizen in **Extra instructions** (zusätzliche Anweisungen), um die Szene zu lenken.
9. Klick auf **Plan Scene** (Szene planen).

Die Szene öffnet sich als neuer Roleplay-Chat in deiner Chatliste, mit einer Eröffnungsnachricht, die die Situation setzt. Klick im Einrichtungsfenster auf **Cancel** (Abbrechen), um abzubrechen, ohne eine Szene anzulegen.

`/scene` allein funktioniert auch, wenn die Conversation genug Vorgeschichte hat. Hat die Conversation noch keine Nachrichten, bittet Marinara dich, erst eine Beschreibung zu ergänzen oder zu chatten.

Ein Charakter kann auch vorschlagen, eine Szene zu starten. Neben seiner Antwort erscheint dann eine Einladung **Set up scene** (Szene einrichten). Klick darauf, um **Scene Prompt Setup** zu öffnen, und mach dann ab Schritt 3 weiter. **Cancel** schließt die Einrichtung, und die Einladung bleibt verfügbar, auch nach einem Neuladen.

So beginnt die Szene:

- Sie geht von deinem Standard-Einstellungsprofil für Roleplay aus, wie jeder neue Roleplay-Chat. Ein [Einstellungsprofil](../chats/settings-profiles.md) ist ein gespeicherter Satz von Chat-Einstellungen.
- Wenn der Szenenplan sie enthält, wird zuerst ein kurzer Hinweis, wie die Szene zu spielen ist, als Erzählernachricht gepostet und danach die Beschreibung der Szene als zweite Erzählernachricht. Fehlt eines davon im Plan, entfällt es.
- Bei einem einzelnen Charakter ist die Eröffnung im Tonfall dieses Charakters verfasst, mit gesprochenen Worten in doppelten Anführungszeichen, sofern deine Schreibanweisungen keinen anderen Stil vorgeben.
- In einer Gruppenszene richtet sich die Eröffnung nach dem Gruppenmodus des Profils. **Merged (Narrator)** ist der Standard: Eine Antwort spricht für alle Charaktere. Im Modus **Individual** (einzeln) schreibt der Charakter die Eröffnung, der die Szene beginnt. Siehe [Gruppenchats](../chats/group-chats.md#choose-who-speaks).

## Die Szenenleiste nutzen

In einer Szene sitzt über dem Nachrichtenfeld eine Leiste, mit der du entscheidest, was mit der Szene passiert. Welche Schaltflächen erscheinen, hängt davon ab, ob die Szene eine Ursprungs-Conversation hat.

| Schaltfläche | Was sie bewirkt |
| --- | --- |
| **Back to conversation** (zurück zur Conversation) | Bringt dich zurück in den Conversation-Chat, der die Szene gestartet hat. Die Szene bleibt offen. Erscheint nur, wenn es eine Ursprungs-Conversation gibt. |
| **End Scene** (Szene beenden) | Speichert eine Zusammenfassung und schließt die Szene ab. Klick bei **End and save summary?** auf **Yes**. |
| **Discard** (verwerfen) | Löscht die Szene und speichert nichts. Klick bei **Discard scene?** auf **Yes**. |
| **Convert** (umwandeln) | Macht aus der Szene ein eigenständiges Roleplay. Siehe unten. |

**End Scene** zeigt **Saving...**, schreibt eine kurze Zusammenfassung als Erinnerung in die Conversation und bringt dich dorthin zurück. **Discard** behält nichts. Beide entfernen die Szene aus deiner Conversation.

## Eine Szene ab einer Nachricht klonen

So kopierst du eine Szene bis zu einer bestimmten Nachricht und spielst sie getrennt weiter, während das Original offen bleibt:

1. Zeig mit der Maus auf die Nachricht, ab der du verzweigen willst.
2. Klick auf ihre Aktion **Clone from here** (ab hier klonen).

Marinara legt ein neues, eigenständiges Roleplay mit den Nachrichten bis einschließlich dieser an, zeigt eine Bestätigung und öffnet es.

## Eine Szene in ein Roleplay umwandeln

Nutze **Convert**, wenn aus einer Szene eine Geschichte geworden ist, die du als normales Roleplay behalten willst.

1. Klick in der Szenenleiste auf **Convert**.
2. Lies die Frage **Convert this scene into a standalone roleplay?** Die Umwandlung macht aus der Szene einen neuen Roleplay-Chat und löst die ursprüngliche Szene von ihrer Conversation. Weder eine Szenen-Zusammenfassung noch eine Erinnerung für einen Charakter wird zurückgeschrieben.
3. Klick auf **Convert** oder auf **Cancel**, um nichts zu ändern.

Beim Klonen bleibt die ursprüngliche Szene offen. Beim Umwandeln nicht.

## Szenen und verknüpfte Chats

Eine Szene steht für sich. Sie zieht keinen Kontext aus einer verknüpften Conversation, auch dann nicht, wenn der übergeordnete Chat das tut, und sie ignoriert die kurzen Steuerungshinweise, die eine verknüpfte Conversation an ein verknüpftes Roleplay schicken kann. Für eine dauerhafte Verbindung in beide Richtungen zwischen einer Conversation und einem Roleplay nimm einen verknüpften Chat. Siehe [Eine Conversation mit einem Roleplay oder Game verknüpfen](../chats/connected-chats.md).

## Verwandte Anleitungen

- [Roleplay Mode: Erste Schritte](getting-started.md)
- [Chat-Verzweigungen](../chats/branches.md)
- [Eine Conversation mit einem Roleplay oder Game verknüpfen](../chats/connected-chats.md)
