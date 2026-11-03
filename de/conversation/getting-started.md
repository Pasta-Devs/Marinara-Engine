# Conversation Mode: Erste Schritte

Conversation Mode ist der Chat-Modus im Messenger-Stil: ein oder mehrere Charaktere, eine Eingabeleiste und ein scrollender Verlauf, wie beim Schreiben mit einer Freundin. Er hat keinen Game Master und keine Szenenbilder. Charaktere können dir auch zuerst schreiben, wöchentlichen Zeitplänen folgen, Selfies senden und Tischspiele spielen. Diese Funktionen gibt es nur in diesem Modus.

## Einen Conversation-Chat starten

Bevor du anfängst: Füge unter **Connections** ein Konto hinzu (siehe [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md)) und lege mindestens einen Charakter an. Eine Persona, die Charakterkarte, die dich vertritt, ist optional (siehe [Nutzer-Personas](../characters/personas.md)).

1. Öffne in der Chat-Seitenleiste den Tab **CONVO** und klicke auf **New Conversation**. Ein Einrichtungsassistent mit vier Seiten öffnet sich.
2. Gib auf der ersten Seite unter **Name & Connection** dem Chat einen Namen und wähle das Konto, das die Antworten schreibt.
3. Wähle auf der zweiten Seite unter **Prompt Preset** das Preset für den Conversation-Prompt, oder behalte den Standard.
4. Wähle auf der dritten Seite unter **Persona & Characters** deine Persona und einen oder mehrere Charaktere.
5. Lege auf der letzten Seite unter **Automation** fest, wie viel die Charaktere von sich aus tun (siehe die Tabelle unten).
6. Klicke auf **Start Chatting**.

Ein Charakter ergibt einen privaten Chat. Zwei oder mehr ergeben einen Gruppenchat, dafür ist nichts Zusätzliches nötig. Siehe [Gruppenchats](../chats/group-chats.md) für das Abwechseln beim Sprechen.

Wenn es nicht funktioniert hat: **Start Chatting** braucht ein Konto und mindestens einen Charakter. Du kannst den Assistenten schließen und alles später in den **Chat Settings** (Chat-Einstellungen) festlegen.

## Automation-Optionen wählen

| Option | Standard | Was sie bewirkt |
| --- | --- | --- |
| **Autonomous Messages** | An | Charaktere schreiben dir zuerst, wenn du eine Weile still warst. |
| **Generate Schedules** | Aus | Erstellt für jeden Charakter eine wöchentliche Routine. Erscheint nur, wenn **Autonomous Messages** an ist. |
| **Commands** | Aus | Hauptschalter für Aktionen, die ein Charakter von sich aus ausführt. |

Schalte **Generate Schedules** an und wähle dann im erscheinenden Feld deine Zeitzone. In den **Chat Settings** heißt derselbe Schalter **Schedules**. Zeitpläne und Check-in-Limits stehen in [Zeitpläne der Charaktere und autonome Nachrichten](schedules.md).

Du kannst das später unter **Chat Settings → Autonomous Messaging** ändern. Schreiben Charaktere zu oft, schalte dort **Autonomous Messages** aus oder setze deinen Status auf **Do Not Disturb**.

<a id="choose-which-commands-a-character-can-use"></a>

## Wählen, welche Commands ein Charakter nutzen darf

Commands sind Aktionen, die der Charakter selbst auszuführen beschließt. Du tippst sie nicht ein. Öffne nach der Einrichtung **Chat Settings → Agents → Commands**. Der Hauptschalter **Commands** steuert alle Familien: Ist er aus, funktioniert keine Familie. Jede Familie hat einen eigenen Schalter. Alle sind zunächst an, außer **Videos**, das du selbst einschalten musst. Familien, die zu einem optionalen Agenten gehören, erscheinen nur, wenn du diesen Agenten unter **Agents → Agent Organizer** installierst.

| Familie | Was ein Charakter tun kann | Braucht einen Agenten |
| --- | --- | --- |
| **Schedule Updates** | Seinen aktuellen Status ändern. | Nein |
| **Cross-Post** | Eine Nachricht in einen anderen Chat senden. | Nein |
| **Memories** | Erinnerungen für andere Charaktere erstellen. | Nein |
| **Scenes** | Eine immersive Szene starten. | Nein |
| **Influence** | Einen verbundenen Chat beeinflussen. | Nein |
| **Notes** | Dauerhafte Notizen für einen verbundenen Chat speichern. | Nein |
| **Reactions** | Auf Nachrichten mit Emoji-Badges reagieren. | Nein |
| **Selfies** | Ein generiertes Selfie anfordern. | Illustrator |
| **Videos** | Kurze Videonachrichten senden. | Illustrator |
| **Music** | Songs über den aktiven Music Player abspielen. | Music DJ |
| **Haptics** | Verbundene Haptik-Geräte steuern. | Haptic Feedback |
| **Calls** | Dich für einen Anruf anklingeln. | Calls |
| **UNO** | Eine Partie UNO starten oder annehmen. | UNO |
| **Chess** | Eine Schachpartie annehmen. | Chess |
| **Poker** | Sich zu Texas Hold'em setzen. | Poker |
| **8-Ball Pool** | Eine Partie Pool aufbauen. | 8-Ball Pool |
| **Tic-Tac-Toe** | Eine Tic-Tac-Toe-Partie annehmen. | Tic-Tac-Toe |
| **Rock-Paper-Scissors** | Eine Partie annehmen. | Rock-Paper-Scissors |

Zu **Influence** und **Notes** siehe [Eine Conversation mit einem Roleplay oder Game verknüpfen](../chats/connected-chats.md). Die letzte Spalte nennt den Agenten, den du im **Agent Organizer** installierst.

<a id="your-presence-status"></a>

## Dein Anwesenheitsstatus

Dein Anwesenheitsstatus ist eine farbige Statusanzeige am Fuß der Seitenleiste. Er ist in jedem Chat gleich. Klicke darauf, um zu wählen:

| Status | Bedeutung |
| --- | --- |
| **Active** | Du bist online. |
| **Idle** | Du bist abwesend. |
| **Do Not Disturb** | Unterdrückt autonome Nachrichten. |
| **Invisible** | Verbirgt deinen Status vor den Modellen. |

Bleibst du auf **Active** und tust 10 Minuten lang nichts, setzt Marinara dich auf **Idle** und wieder auf **Active**, wenn du zurückkehrst. Wählst du selbst einen Status, endet diese automatische Änderung, bis du wieder **Active** wählst. **Idle** stoppt keine Check-ins.

Neben der Anzeige liegt das Statusfeld, das „What's up?“ zeigt, wenn es leer ist. Tippe dort deine aktuelle Tätigkeit ein (bis zu 120 Zeichen), damit Charaktere Bescheid wissen. Aktuelle Einträge erscheinen unter **Recent status**, damit du sie wiederverwenden kannst.

<a id="react-and-get-notified"></a>

## Reagieren und benachrichtigt werden

Nutze **Add reaction** an einer Nachricht, um mit einem Emoji zu reagieren. Spätere Antworten sehen deine Reaktion. Ist der Befehl **Reactions** an, können Charaktere auf deine Nachrichten und auf die der anderen reagieren.

Schreibt ein Charakter in einem Chat, den du gerade nicht ansiehst, erscheint am Bildschirmrand eine Avatar-Blase. Klicke darauf, um diesen Chat zu öffnen, oder auf ihr X, um sie auszublenden. Auf dem Handy fassen sich mehrere Blasen zu einer Gruppe zusammen, die du antippen kannst.

## Gut zu wissen

Ein Conversation-Chat nutzt weder die **First Message** der Charakterkarte noch ihre **Dialogue Highlight Color** und **Message Box Color**. Die **Name Display Color** färbt weiterhin den Namen über jeder Nachricht. Siehe [Wo deine Farben auftauchen](../characters/colors-and-stats.md#where-your-colors-show).

## Verwandte Funktionen

- [Selfies](selfies.md): Charaktere senden generierte Fotos von sich selbst.
- [Audio- und Videoanrufe in Conversation](calls.md)
- [Tischspiele](table-games.md): Starte eine Partie mit `/uno`, `/chess`, `/poker`, `/8ball`, `/tictactoe` oder `/rps`.
- [Zeitpläne der Charaktere und autonome Nachrichten](schedules.md)
- [Profile in Conversation Mode](profiles.md)
- [Eigene Emojis, Sticker und GIFs](emoji-stickers-gifs.md)
- [Eine Conversation mit einem Roleplay oder Game verknüpfen](../chats/connected-chats.md)

## Fehlerbehebung

| Symptom | Lösung |
| --- | --- |
| Charaktere schreiben zu oft | Schalte **Autonomous Messages** aus, setze **Do Not Disturb** oder markiere mehr Stunden als abwesend in [Zeitpläne](schedules.md). |
| Ein Charakter antwortet in einer Gruppe auf alles | Lege unter [Gruppenchats](../chats/group-chats.md) fest, wer spricht. |
| Ein Charakter vergisst frühere Chats | Nutze ein Modell mit einem größeren Kontextfenster (wie viel Text es auf einmal lesen kann) oder lege wichtige Fakten in einem Lorebook-Eintrag ab. |
| Ein Selfie sieht dem Charakter nicht ähnlich | Siehe [Selfies](selfies.md). |

Mehr Hilfe: [Fehlerbehebung bei Marinara Engine](../TROUBLESHOOTING.md).
