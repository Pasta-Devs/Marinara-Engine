# Eine Conversation mit einem Roleplay oder Game verknüpfen

In dieser Anleitung erfährst du, wie du einen Conversation-Chat mit einem Roleplay- oder Game-Chat verknüpfst, damit beide denselben Kontext teilen. Es geht außerdem um **Cross-Chat Awareness** (chatübergreifendes Erinnern), um die besonderen Tags, die Informationen über eine Verknüpfung hinweg weiterreichen, und um den schnellen Wechsel zwischen verknüpften Chats.

Marinara Engine (im Folgenden Marinara) hat zwei getrennte Funktionen, mit denen Chats voneinander wissen. Die eine läuft automatisch. Die andere ist eine ausdrückliche Eins-zu-eins-Verknüpfung, die du selbst einrichtest. Diese Anleitung hält beide auseinander, denn sie arbeiten völlig unterschiedlich.

## Was Connected Chats leisten

**Connected Chats** (verknüpfte Chats) koppeln einen Conversation-Chat an einen Roleplay- oder Game-Chat. Die Verknüpfung ist eins zu eins. Jeder Chat lässt sich immer nur mit einem einzigen anderen Chat verknüpfen.

Sobald die Verknüpfung steht, liest die Conversation-Seite automatisch die letzten Nachrichten des verknüpften Story-Chats. Sie zieht sie in jedem Zug in den eigenen Kontext. Das ist die automatische Richtung der Verknüpfung.

Umgekehrt liest der Story-Chat (das Roleplay oder Game) die Nachrichten der Conversation nicht automatisch mit. Für den Weg zurück nutzt ein Charakter besondere Tags. Diese Tags beschreibt der Abschnitt weiter unten.

Ein typischer Fall: Du spielst ein packendes Roleplay oder Game in einem Chat und führst nebenher eine lockere Out-of-Character-Direktnachricht (OOC) in einer Conversation. Der OOC-Chat bleibt über die Story informiert, sodass du dich währenddessen darüber austauschen kannst.

## Cross-Chat Awareness ist keine Verknüpfung

Zwei Funktionen werden leicht verwechselt. Lies diesen Abschnitt, bevor du etwas einrichtest.

**Cross-Chat Awareness** läuft automatisch. Es ist eine Einstellung des Conversation Mode. Taucht ein Charakter in mehreren Conversation-Chats auf, kann er sich an das Geschehen in den anderen Chats erinnern und darauf Bezug nehmen. Von Hand verknüpfst du dabei nichts. Die Einstellung ist standardmäßig aktiv.

Zu finden ist sie im Abschnitt **Cross-Chat Awareness** der **Chat Settings** (Chat-Einstellungen). Der Hilfetext lautet: „Characters remember and reference conversations from other chats they're in. Pulls recent messages from sibling chats and injects them as context.“ Marinara ordnet diese Geschwister-Chats über den gemeinsamen Charakter zu, nicht über den gemeinsamen Nutzer.

Eine **Connected Chats**-Verknüpfung funktioniert anders. Du legst sie bewusst an. Sie koppelt genau eine Conversation an genau einen Roleplay- oder Game-Chat. Über sie laufen der Story-Kontext und die unten beschriebenen Tags.

Kurz gesagt: **Cross-Chat Awareness** verbindet einen Charakter automatisch über seine eigenen Conversation-Chats hinweg. Eine **Connected Chats**-Verknüpfung stellst du selbst zwischen einer Conversation und einem Story-Chat her.

## Eine Conversation mit einem Roleplay- oder Game-Chat verknüpfen

Die Verknüpfung startest du entweder im Conversation-Chat oder in einem Game-Chat. So geht's von der Conversation-Seite aus:

1. Öffne den Conversation-Chat, den du verknüpfen willst.
2. Öffne **Chat Settings** über die Schaltfläche im Chat. Sie liegt oben rechts, solange du sie nicht verschoben hast.
3. Such den Abschnitt **Connected Chats**.
4. Klick auf **Link to Roleplay or Game** (mit einem Roleplay oder Game verknüpfen).
5. Such den Roleplay- oder Game-Chat in der Auswahl und klick ihn an.

Im Abschnitt **Connected Chats** stehen jetzt der Name des verknüpften Chats und dessen Modus. Daneben sitzt eine kleine Schaltfläche zum Lösen der Verknüpfung.

Willst du stattdessen in einem Game-Chat starten, öffne dort die **Chat Settings**, geh zu **Connected Chats** und klick auf **Link to Conversation** (mit einer Conversation verknüpfen). Wähle danach die Conversation aus.

Ein Roleplay-Chat hat keine eigene Schaltfläche zum Verknüpfen. Er zeigt eine bestehende Verknüpfung zwar an, anlegen musst du sie aber auf der Conversation-Seite.

In der Auswahl erscheinen nur Chats, die noch nicht verknüpft sind. Pro Chat ist immer nur eine Verknüpfung möglich.

### Eine Verknüpfung lösen

Zum Lösen öffnest du die **Chat Settings**, gehst zu **Connected Chats** und klickst auf die Schaltfläche zum Trennen (ihr Tooltip, also der Kurzhinweis beim Draufzeigen, lautet **Disconnect**). Beim Trennen verwirft Marinara außerdem alle offenen Einflüsse und gespeicherten Notizen dieser Verknüpfung.

Löschst du einen Chat, trennt Marinara auch dessen Verknüpfung.

## Informationen über die Verknüpfung weiterreichen

Die Conversation liest den Story-Chat automatisch mit. Für die anderen Richtungen sind Tags zuständig. Diese Tags stehen in den Nachrichten eines Charakters. Geschrieben werden sie von der KI. Normalerweise tippst du sie nicht selbst, aber wer ihre Wirkung kennt, versteht die Brücke besser.

Musst du sie einmal erwähnen, schreib sie wörtlich aus. Jedes steht hier in Code-Schreibweise, damit es exakt so dargestellt wird.

- `<influence>` schickt einen einmaligen Impuls aus der Conversation in den verknüpften Story-Chat. Er wirkt genau im nächsten Zug dort und ist danach verbraucht.
- `<note>` speichert einen dauerhaften Fakt aus der Conversation im verknüpften Story-Chat. Er bleibt in jedem Zug im Prompt des Story-Chats – also in dem Text, den Marinara an die KI schickt –, bis du ihn löschst.
- `<ooc>` erlaubt einem Roleplay-Charakter, aus der Story herauszutreten und direkt in der verknüpften Conversation zu antworten. Marinara schreibt diesen Text in den verknüpften Direktnachrichten-Chat.

Ein Conversation-Charakter kann die Story also unauffällig lenken oder mit Wissen versorgen – über `<influence>` und `<note>`. Ein Roleplay-Charakter wiederum kann über `<ooc>` in die Conversation zurücksprechen.

## Conversation Notes

Speichert ein Conversation-Charakter eine dauerhafte `<note>`, taucht sie auf der Story-Seite auf. Der Roleplay- oder Game-Chat bekommt dann in seinen **Chat Settings** einen Abschnitt **Conversation Notes** (Notizen aus der Conversation).

Dieser Abschnitt listet alle gespeicherten Notizen. Jede Notiz hat eine Schaltfläche zum Löschen. Alle auf einmal entfernst du über **Clear all notes** (alle Notizen löschen). Marinara fragt vorher nach, und rückgängig machen lässt sich das nicht.

Hat noch kein Charakter eine Notiz gespeichert, erklärt der Abschnitt, dass hier alles erscheint, was in ein `<note>`-Tag eingefasst und gespeichert wurde.

<a id="switching-between-connected-chats"></a>

## Zwischen verknüpften Chats wechseln

Hat ein Chat eine Verknüpfung, erscheint oben rechts im Chat eine kleine Schaltfläche **Connected chat** (verknüpfter Chat) mit einem Doppelpfeil. Du kannst sie am Computer oder Telefon an eine andere Stelle ziehen. Klick oder tippe darauf, um ein kleines Fenster zu öffnen. Wähle darin **Switch to**, gefolgt vom Namen des anderen Chats.

So gelangst du direkt in den verknüpften Chat. Die Schaltfläche erscheint auf beiden Seiten der Verknüpfung.

Mit **Put back in Chat Settings** verschiebst du diese Steuerung in die Chat Settings. Dort erscheint sie als eigener Abschnitt **Connected chat**. Über dessen Schaltfläche zum Herauslösen öffnest du sie wieder in einem eigenen Fenster.

## Weitere Bedienelemente in diesem Abschnitt

Im Abschnitt **Connected Chats** sitzen außerdem zwei Bedienelemente, die eigentlich zu anderen Funktionen gehören. Sie stehen der Bequemlichkeit halber hier.

- Ein Feld für die **Discord webhook URL**. Es hat keine sichtbare Beschriftung, nur einen Platzhalter, der mit `https://discord.com/api/webhooks/` beginnt. Fügst du hier eine Discord-Webhook-URL ein, spiegelt Marinara die Nachrichten des Chats in einen Discord-Kanal. Das gehört zur Discord-Nachrichtenspiegelung, für die es eine eigene Anleitung gibt.
- Ein Schalter **Allow Noodle references** (Noodle-Bezüge erlauben), standardmäßig aus. Er erlaubt der Noodle-Zeitleiste in der App, die letzten Nachrichten aus diesem Chat zu holen. Zu Noodle gibt es eine eigene Anleitung.

Auf der Roleplay-Seite kommt ein Schalter **Allow character DMs** (Direktnachrichten von Charakteren erlauben) dazu, ebenfalls standardmäßig aus. Ist er an, kann ein Roleplay-Charakter aus der Story heraus eine neue Conversation als Direktnachricht mit dir eröffnen. Das klappt auch dann, wenn noch keine Conversation verknüpft ist.

## Verwandte Anleitungen

- [Conversation Mode: Erste Schritte](../conversation/getting-started.md)
- [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md)
