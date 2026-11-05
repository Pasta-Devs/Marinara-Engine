# Discord-Nachrichten-Mirror

Der Discord-Nachrichten-Mirror kopiert deine Chat-Nachrichten in einen Discord-Kanal, während du chattest. Das klappt in Conversation, Roleplay und Game Mode.

Er leitet nur in eine Richtung weiter. Marinara schickt Nachrichten hinaus, und Discord kann nichts zurückschicken. Ein Zwei-Wege-Bot ist das also nicht. Der Mirror nutzt einen Discord-Webhook, eine spezielle URL, über die eine App Nachrichten in einen Discord-Kanal schreiben darf. Der Mirror gilt pro Chat. Jeder Chat hat seine eigene Webhook-URL, und alle anderen Chats bleiben aus, bis du auch dort jeweils eine URL einfügst.

## Eine Discord-Webhook-URL anlegen

Den Webhook legst du in Discord an, nicht in Marinara. Dafür brauchst du die Berechtigung, den gewünschten Discord-Kanal zu verwalten.

1. Öffne den Discord-Server und wähle den Kanal, in dem die Nachrichten erscheinen sollen.
2. Öffne die Einstellungen dieses Kanals, dann **Integrations** (Integrationen) und dort **Webhooks**.
3. Lege einen neuen Webhook an und kopiere dessen Webhook-URL.

Eine Discord-Webhook-URL sieht so aus:

```text
https://discord.com/api/webhooks/123456789012345678/AbCdEf-example-token
```

Behandle diese URL vertraulich. Wer sie hat, kann in deinen Discord-Kanal schreiben.

## Den Mirror einschalten

Das Feld für den Webhook steckt in den Einstellungen des jeweiligen Chats, im Bereich **Connected Chats** (verknüpfte Chats). Es ist mit **Discord Mirror** beschriftet, sein Platzhalter lautet `https://discord.com/api/webhooks/...`.

1. Öffne den Chat, den du spiegeln willst.
2. Öffne **Chat Settings** (Chat-Einstellungen).
3. Suche den Bereich **Connected Chats**.
4. Füge die Webhook-URL in das Eingabefeld weiter unten in diesem Bereich ein.

Damit ist der Mirror für diesen Chat an. Zum Ausschalten leerst du das Feld.

Wenn es nicht funktioniert hat: Ist die URL kein gültiger Discord-Webhook, erscheint unter dem Feld der rote Text „Invalid webhook URL format“. Korrigiere die URL, dann wird der Mirror gespeichert. Marinara prüft die URL beim Speichern noch einmal auf dem Server.

Die Webhook-URL bleibt in dieser Marinara-Installation. Chat-Exporte, exportierte Einstellungsprofile und Dateien aus **Export Profile** (Profil exportieren) lassen sie weg, und der Import dieser Dateien schaltet nie einen Mirror ein. Um einen Chat zu spiegeln, den du in eine andere Installation umgezogen hast, füge die URL dort erneut ein. Ein Einstellungsprofil, das du in dieser Installation gespeichert hast, setzt deinen Mirror beim Anwenden weiterhin.

## Was gesendet wird

Marinara spiegelt deine Nachrichten und die KI-Antworten, sobald sie entstehen.

- Absendername: Deine Nachrichten laufen unter dem Namen deiner aktiven Persona, die der KI unter dem Charakternamen.
- Im Game Mode gehen Züge von Partymitgliedern oder NPCs (Nicht-Spieler-Charakteren) unter dem Namen „Party“ raus. Die Erzählung läuft unter „Narrator“. Nutzt dein Spiel die Option **Character GM**, erscheinen die Antworten des Game Masters stattdessen unter dem Namen dieses Charakters.
- Bilder werden nicht mitgeschickt. Discord zeigt nur den Absendernamen und den Text.
- Lange Nachrichten: Discord begrenzt jede Nachricht auf 2.000 Zeichen. Eine Nachricht mit mehr als 1.997 Zeichen wird gekürzt, und die gespiegelte Kopie endet dann mit „...“.
- Erwähnungen wie @everyone oder @here im Text lösen in deinem Discord-Kanal keine Benachrichtigung aus.

## Was nicht gesendet wird

- Neu generierte Antworten und Swipes werden nicht noch einmal gespiegelt. Ein Swipe ist eine weitere Antwort, die an derselben Nachricht aufbewahrt wird. Pro Zug geht nur die erste Antwort raus.
- Nachrichten aus Impersonate werden nicht gespiegelt. Impersonate ist die Funktion, bei der die KI eine Nachricht an deiner Stelle schreibt.
- Schlägt ein Sendeversuch fehl, wird er nicht wiederholt. Auch ein Sendeversuch, den Discord mit einem Tempolimit (429) beantwortet, wird nicht wiederholt; siehe unten. Ein fehlgeschlagener Sendeversuch zeigt im Chat keinen Fehler. Fehlschläge, die kein Tempolimit sind, werden nur auf dem Server protokolliert.

## Tempolimit

Discord begrenzt, wie schnell eine App posten darf. Marinara schickt pro Webhook höchstens etwa alle 1,2 Sekunden eine Nachricht. Das sind rund 50 Nachrichten pro Minute. Weitere Nachrichten warten in einer Warteschlange und gehen der Reihe nach raus. Beantwortet Discord einen Sendeversuch mit 429 (langsamer werden), wird diese Nachricht nicht erneut gesendet. Marinara wartet die Retry-After-Zeit ab, die Discord angibt, und macht dann mit der nächsten Nachricht in der Warteschlange weiter.

## Verwandte Anleitungen

- [Eine Conversation mit einem Roleplay oder Game verknüpfen](../chats/connected-chats.md)
