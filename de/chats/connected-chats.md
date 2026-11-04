# Eine Conversation mit einem Roleplay oder Game verknüpfen

Verknüpfe einen Conversation-Chat mit einem Roleplay- oder Game-Chat, damit beide denselben Kontext teilen. Ein typischer Fall: Du spielst eine Story in einem Chat und sprichst in einer Conversation, die über die Story im Bilde bleibt, außerhalb der Rolle (Out of Character, OOC) darüber.

Der Abschnitt **Connected Chats** (verknüpfte Chats) in den **Chat Settings** (Chat-Einstellungen) enthält zwei verschiedene Funktionen. Eine **Connected Chats**-Verknüpfung gilt eins zu eins, und du richtest sie von Hand ein. **Cross-Chat Awareness** (chatübergreifendes Erinnern) ist ein Schalter, der für sich allein funktioniert und einen Charakter sich an seine anderen Conversation-Chats erinnern lässt.

## So funktioniert eine Verknüpfung

Eine Verknüpfung koppelt eine Conversation an einen Roleplay- oder Game-Chat. Jeder Chat kann immer nur eine Verknüpfung haben.

- Die Conversation liest in jedem Zug automatisch die letzten Nachrichten des verknüpften Story-Chats.
- Der Story-Chat liest die Conversation nicht zurück. In die andere Richtung reichen Charaktere Informationen mit Tags weiter, die weiter unten beschrieben sind.

## Eine Conversation mit einem Roleplay- oder Game-Chat verknüpfen

Bevor du anfängst: Beide Chats sollten schon angelegt sein. Siehe [Die Chatliste verwalten](managing-chats.md).

1. Öffne den Conversation-Chat und öffne die **Chat Settings**. Siehe [Chat Settings im Überblick](chat-settings.md).
2. Öffne den Abschnitt **Connected Chats**.
3. Klick auf **Link to Roleplay or Game** (mit einem Roleplay oder Game verknüpfen).
4. Such den Chat in der Auswahl und klick ihn an.

Der Abschnitt zeigt jetzt Namen und Modus des verknüpften Chats, dazu eine kleine Schaltfläche zum Lösen der Verknüpfung.

Wenn es nicht funktioniert hat: In der Auswahl erscheinen nur Chats, die noch nicht verknüpft sind. Löse zuerst die Verknüpfung des anderen Chats.

Willst du in einem Game-Chat starten, öffne dort **Chat Settings → Connected Chats**, klick auf **Link to Conversation** (mit einer Conversation verknüpfen) und wähle die Conversation aus. Ein Roleplay-Chat hat keine Schaltfläche zum Verknüpfen. Er zeigt eine Verknüpfung an, sobald es eine gibt, also leg sie auf der Conversation-Seite an.

### Eine Verknüpfung lösen

Öffne **Chat Settings → Connected Chats** und klick auf die Schaltfläche zum Lösen der Verknüpfung, beschriftet mit **Disconnect** (Trennen). Dabei verwirft Marinara auch offene Einflüsse und gespeicherte Notizen dieser Verknüpfung. Auch das Löschen eines Chats trennt seine Verknüpfung.

## Cross-Chat Awareness

**Cross-Chat Awareness** ist ein Schalter im Abschnitt **Connected Chats** einer Conversation. Seine Beschreibung lautet „Characters know what happens in their other chats“. Ist ein Charakter in mehr als einem Conversation-Chat, kann er sich an das Geschehen in den anderen erinnern und es erwähnen. Marinara ordnet diese Chats über den gemeinsamen Charakter zu, nicht über den gemeinsamen Nutzer. Der Schalter ist standardmäßig an und braucht keine Verknüpfung.

## Informationen über die Verknüpfung weiterreichen

Charaktere schreiben diese Tags in ihre Nachrichten. Du musst nichts tun. So sprechen die beiden Chats miteinander.

| Tag | Was es bewirkt |
| --- | --- |
| `<influence>` | Ein einmaliger Impuls aus der Conversation in den verknüpften Story-Chat. Er wirkt im nächsten verknüpften Zug und ist danach verbraucht. |
| `<note>` | Speichert einen dauerhaften Fakt aus der Conversation im Story-Chat. Er bleibt in jedem Zug im Prompt des Story-Chats, bis du ihn löschst. |
| `<ooc>` | Lässt einen Roleplay-Charakter aus der Story heraustreten und der verknüpften Conversation antworten. Marinara schreibt den Text dorthin. |

### Conversation Notes

Gespeicherte `<note>`-Fakten erscheinen im Abschnitt **Conversation Notes** (Notizen aus der Conversation) in den **Chat Settings** des Story-Chats. Jede Notiz hat eine Schaltfläche zum Löschen. **Clear all notes** (alle Notizen löschen) entfernt nach deiner Bestätigung alle Notizen, und das lässt sich nicht rückgängig machen. Ohne Notizen steht im Abschnitt, dass hier Notizen erscheinen, die in ein `<note>`-Tag eingefasst sind.

<a id="switching-between-connected-chats"></a>

## Zwischen verknüpften Chats wechseln

Steht eine Verknüpfung, erscheint in beiden Chats eine Schaltfläche **Connected chat** (verknüpfter Chat) mit einem Doppelpfeil-Symbol. Am Computer sitzt sie anfangs oben rechts, und du kannst sie an eine andere Stelle ziehen. Auf dem Handy öffnest du das Drei-Punkte-Menü **Chat tools** (Chat-Tools), dann **Connected chat**, und wählst **Switch to** und den Namen des anderen Chats.

Um die Steuerung in den Chat Settings zu behalten, wähle **Put back in Chat Settings** (zurück in die Chat-Einstellungen). Sie erscheint dann als eigener Abschnitt **Connected chat**. Mit der Schaltfläche zum Herauslösen in diesem Abschnitt machst du sie wieder zu einem eigenen Fenster.

## Weitere Bedienelemente in diesem Abschnitt

- **Discord webhook URL**: ein Feld ohne Beschriftung, nur mit einem Platzhalter, der mit `https://discord.com/api/webhooks/` beginnt. Füg eine Webhook-URL ein, um die Nachrichten des Chats in einen Discord-Kanal zu spiegeln. Dafür gibt es eine eigene Anleitung.
- **Allow Noodle references** (Noodle-Bezüge erlauben): erlaubt der Noodle-Timeline, die letzten Nachrichten aus diesem Chat zu holen. Der Schalter ist standardmäßig aus und erscheint nur, wenn Noodle installiert ist.
- **Allow character DMs** (Direktnachrichten von Charakteren erlauben) im Roleplay: lässt einen Roleplay-Charakter aus der Story heraus eine neue Conversation als Direktnachricht mit dir eröffnen. Der Schalter ist standardmäßig aus und funktioniert auch ohne Verknüpfung.
