# Discord-Nachrichten-Mirror

In dieser Anleitung erfährst du, wie der Discord-Nachrichten-Mirror in Marinara Engine funktioniert. Der Mirror kopiert die Nachrichten aus dem Chat in einen Discord-Kanal – in eine Richtung, während du chattest. Das klappt in Conversation, Roleplay und Game Mode.

## Was der Mirror macht

Der Discord-Nachrichten-Mirror leitet nur in eine Richtung weiter: Marinara schickt Nachrichten an einen Discord-Kanal. Zurück kommt nichts. Ein Discord-Bot mit Gegenrichtung ist das also nicht.

Dafür nutzt der Mirror einen Discord-Webhook. Ein Webhook ist eine spezielle URL, über die eine App Nachrichten in einen Discord-Kanal schreiben darf.

Der Mirror gilt pro Chat. Jeder Chat hat seine eigene Webhook-URL. Fügst du in einem Chat eine URL ein, ist der Mirror dort aktiv. Alle anderen Chats bleiben aus, bis du auch dort eine URL einträgst.

## Eine Discord-Webhook-URL anlegen

Den Webhook legst du in Discord an, nicht in Marinara. Dafür brauchst du die Berechtigung, den gewünschten Discord-Kanal zu verwalten.

1. Öffne den Discord-Server und wähle den Kanal, in dem die Nachrichten erscheinen sollen.
2. Öffne die Einstellungen dieses Kanals, dann **Integrations** (Integrationen) und dort **Webhooks**.
3. Lege einen neuen Webhook an und kopiere dessen Webhook-URL.

Eine Discord-Webhook-URL sieht so aus:

```
https://discord.com/api/webhooks/123456789012345678/AbCdEf-example-token
```

Behandle diese URL vertraulich. Wer sie hat, kann in deinen Discord-Kanal schreiben.

## Den Mirror einschalten

Die Webhook-Einstellung steckt in den Einstellungen des jeweiligen Chats, im Bereich **Connected Chats** (verbundene Chats). Das Eingabefeld ist mit **Discord Mirror** beschriftet, sein Platzhaltertext lautet `https://discord.com/api/webhooks/...`.

1. Öffne den Chat, den du spiegeln willst.
2. Öffne **Chat Settings** (Chat-Einstellungen).
3. Suche den Bereich **Connected Chats**.
4. Füge die Webhook-URL in das Eingabefeld weiter unten in diesem Bereich ein.

Damit ist der Mirror für diesen Chat aktiv. Zum Ausschalten leerst du das Eingabefeld einfach wieder.

Ist die URL kein gültiger Discord-Webhook, erscheint unter dem Feld der rote Hinweis „Invalid webhook URL format“. Korrigiere die URL, dann wird der Mirror gespeichert. Marinara prüft die URL beim Speichern zusätzlich auf dem Server.

Die Webhook-URL bleibt in dieser Marinara-Installation. Chat-Exporte, exportierte Einstellungsprofile und Dateien aus **Export Profile** (Profil exportieren) lassen sie weg, und der Import dieser Dateien schaltet nie einen Mirror ein. Um einen Chat zu spiegeln, den du in eine andere Installation umgezogen hast, füge die URL dort erneut ein. Ein Einstellungsprofil, das du in dieser Installation gespeichert hast, setzt deinen Mirror beim Anwenden weiterhin.

## Was gesendet wird

Marinara spiegelt deine Nachrichten und die KI-Antworten, sobald sie entstehen.

- Absendername: Deine Nachrichten laufen unter dem Namen der aktiven Persona, die der KI unter dem Charakternamen.
- Im Game Mode geht die Erzählung unter dem Namen „Narrator“ raus. Züge von Partymitgliedern oder NPCs (Nicht-Spieler-Charakteren) laufen unter dem Namen „Party“. Nutzt dein Spiel die Option **Character GM**, erscheinen die Antworten des Game Masters stattdessen unter dem Namen dieses Charakters.
- Bilder werden nicht mitgeschickt. Discord zeigt nur den Absendernamen und den Text.
- Lange Nachrichten: Discord begrenzt jede Nachricht auf 2000 Zeichen. Alles über 1997 Zeichen wird gekürzt, die gespiegelte Kopie endet dann mit „...“.
- Erwähnungen wie @everyone oder @here im Text lösen in deinem Discord-Kanal keine Benachrichtigung aus.

## Was nicht gesendet wird

- Neu generierte Antworten und Swipes (alternative Antworten) wandern nicht noch einmal zu Discord. Pro Zug geht nur die erste Antwort raus.
- Nachrichten aus **Impersonate** werden nicht gespiegelt. Impersonate ist die Funktion, bei der die KI eine Nachricht an deiner Stelle schreibt.
- Schlägt das Senden an Discord fehl, zeigt Marinara keine Fehlermeldung und versucht es auch nicht erneut. Der Fehlschlag landet nur im Server-Log.

## Tempolimit

Discord begrenzt, wie schnell eine App posten darf. Marinara schickt pro Webhook höchstens etwa alle 1,2 Sekunden eine Nachricht – also rund 50 Nachrichten pro Minute. Weitere Nachrichten warten in einer Warteschlange und gehen der Reihe nach raus. Bittet Discord um eine Pause, wartet Marinara kurz und macht dann weiter.

## Verwandte Anleitungen

- [Eine Conversation mit einem Roleplay oder Spiel verbinden](../chats/connected-chats.md)
