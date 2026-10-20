# Conversation Mode: Erste Schritte

In dieser Anleitung erfährst du, wie Conversation Mode in Marinara Engine funktioniert – der Chat-Modus im Messenger-Stil. Es geht darum, was der Modus ausmacht und wie der vierstufige Einrichtungsassistent abläuft. Dazu kommen die Funktionen, die es nur hier gibt: autonome Nachrichten, Anwesenheitsstatus, Reaktionen, Selfies und Tischspiele.

## Was Conversation Mode ist

Conversation Mode ist einer der Chat-Modi von Marinara Engine. Er funktioniert wie ein Messenger: ein oder mehrere Charaktere, eine Eingabeleiste und ein scrollender Nachrichtenverlauf.

Stell dir Direktnachrichten vor – kurz DMs –, so wie du einer Freundin schreibst. Es gibt keinen Game Master, keine Szenenbilder und keine vorgeschriebene Spielmechanik. Damit ist es der leichteste Chat-Modus, und viele Nutzende verbringen hier die meiste Zeit.

Conversation Mode bringt Funktionen mit, die nur in einer laufenden Messenger-Beziehung Sinn ergeben. Charaktere sind online oder abwesend und folgen wöchentlichen Zeitplänen. Sie schreiben von sich aus, schicken Selfies, reagieren mit Emojis und spielen Tischspiele. Außerdem bekommt jeder Charakter und jede Persona ein kleines Profil im Discord-Stil mit Anzeigename und Über-mich-Text. Die einzelnen Profilfelder findest du unter [Profile in Conversation Mode](profiles.md).

Keine dieser Conversation-Funktionen greift in Roleplay oder Game Mode – auch dann nicht, wenn du dort dieselbe Charakterkarte verwendest.

Manche Kartenfelder wirken umgekehrt. Ein Conversation-Chat beginnt nicht mit der **First Message** (erste Nachricht) der Karte oder einer anderen Begrüßung; das tun nur Roleplay-Chats. Er nutzt auch weder die **Dialogue Highlight Color** (Hervorhebung für Dialoge) noch die **Message Box Color** (Farbe der Nachrichtenbox) der Karte. Die **Name Display Color** (Namensfarbe) färbt weiterhin den Namen des Charakters über jeder Nachricht. Siehe [Wo die Farben auftauchen](../characters/colors-and-stats.md#where-your-colors-show).

### Wann sich Conversation Mode lohnt

Nimm Conversation Mode, wenn du eines davon willst:

- Mit einem Charakter schreiben wie per DM mit einer Freundin: Text rein, Text raus.
- Mit mehreren Charakteren gleichzeitig in einem einzigen Verlauf reden.
- Charaktere eigenständig handeln lassen – sie schreiben, halten Zeitpläne ein und reagieren im Lauf der Zeit.

Für Szenenbilder wie Sprites und Hintergründe oder für ausgebaute Spielmechanik sind Roleplay und Game Mode die bessere Wahl.

## Der vierstufige Einrichtungsassistent

Beim Start eines neuen Conversation-Chats öffnet sich der vierstufige Einrichtungsassistent. Du kannst ihn auch schließen und alles später im **Chat Settings**-Panel (Chat-Einstellungen) erledigen. Die vier Schritte:

1. **Name & Connection** (Name und Verbindung): Benenne den Chat und wähle die KI-Verbindung, die die Charaktere nutzen. Eine Verbindung ist eine gespeicherte Verknüpfung zu einem KI-Anbieter. Siehe [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md).
2. **Prompt Preset** (Prompt-Preset): Wähle, welches Preset den Conversation-Prompt liefert, oder bleib beim Standard.
3. **Persona & Characters** (Persona und Charaktere): Wähle deine Persona und einen oder mehrere Charaktere.
4. **Automation** (Automatisierung): Lege fest, wie viel die Charaktere von sich aus tun dürfen.

Die Persona ist die Rolle, die du selbst spielst. Siehe [Nutzer-Personas](../characters/personas.md).

Wie viele Charaktere du wählst, bestimmt die Form des Chats. Ein Charakter ergibt eine private DM. Ab zwei Charakteren wird daraus ein Gruppenchat – ganz ohne zusätzlichen Modus. Die Steuerung dafür beschreibt [Gruppenchats](../chats/group-chats.md).

Sobald eine Verbindung und mindestens ein Charakter stehen, öffnest du den Chat mit **Start Chatting** (Chat starten).

### Der Schritt Automation

Der Schritt **Automation** enthält immer diese Schalter:

| Schalter | Standard | Wirkung |
|---|---|---|
| **Autonomous Messages** | On | Charaktere schreiben von sich aus, wenn du gerade inaktiv bist. |
| **Generate Schedules** | Off | Erzeugt optionale Wochenroutinen. Erscheint nur, wenn Autonomous Messages aktiv ist. |

Hast du ein Agent-Paket installiert, das Conversation-Befehle mitbringt, zeigt der Schritt zusätzlich **Commands** (Befehle). Anrufe, Illustrator-Selfies, Music DJ, Haptic Feedback und die einzelnen Tischspiele tauchen nur auf, wenn das passende Paket installiert ist. Zu Anrufen siehe [Audio- und Videoanrufe in Conversation](calls.md).

### Das Raster der Commands

Ist **Commands** verfügbar und aktiv, erscheint ein Raster mit bis zu 17 Befehlsfamilien. Jede davon ist eine verdeckte Aktion, die ein Charakter von sich aus ausführen kann. Einträge aus Paketen erscheinen nur bei installiertem Paket. Jede sichtbare Familie ist zunächst aktiv. Deaktivierst du einen Schalter, fällt nur diese eine Familie weg. Befehle steuert das Modell – du tippst sie nicht selbst ein.

Das ist die vollständige Liste der Befehlsfamilien:

- **Schedule Updates**: Charaktere dürfen ihren aktuellen Status ändern.
- **Cross-Post**: Charaktere dürfen eine Nachricht in einen anderen Chat umleiten.
- **Selfies**: Charaktere dürfen generierte Selfies anfordern.
- **Memories**: Charaktere dürfen Erinnerungen für andere Charaktere anlegen.
- **Scenes**: Charaktere dürfen eine immersive Szene starten.
- **Music**: Charaktere dürfen Songs über den aktiven Music Player abspielen.
- **Haptics**: Charaktere dürfen verbundene Haptik-Geräte ansteuern.
- **Influence**: Charaktere dürfen einen verbundenen Chat beeinflussen.
- **Notes**: Charaktere dürfen dauerhafte Notizen für einen verbundenen Chat speichern.
- **Calls**: Charaktere dürfen dich für einen Conversation-Anruf anklingeln.
- **Reactions**: Charaktere dürfen auf Nachrichten mit Emoji-Badges reagieren.
- **UNO**: Charaktere dürfen am Tisch eine Partie UNO starten, wenn du zusagst.
- **Chess**: Charaktere dürfen am Tisch eine Schachpartie zu zweit annehmen.
- **Poker**: Charaktere dürfen sich am Tisch zu einer Partie Texas Hold'em setzen.
- **8-Ball Pool**: Charaktere dürfen am Tisch eine Partie 8-Ball-Pool aufbauen.
- **Tic-Tac-Toe**: Charaktere dürfen eine Partie Tic-Tac-Toe zu zweit annehmen.
- **Rock-Paper-Scissors**: Charaktere dürfen eine Partie Schere, Stein, Papier zu zweit annehmen.

Über allem steht ein Hauptschalter **Commands**. Steht er auf Off, funktioniert keine einzige Befehlsfamilie – auch wenn sie aktiv aussieht.

## Autonome Nachrichten und dein Anwesenheitsstatus

Autonome Nachrichten erlauben einem Charakter, den ersten Schritt zu machen. Ist **Autonomous Messages** aktiv, meldet sich ein Charakter, nachdem du eine Weile still warst. Dabei zählt, wie gesprächig der Charakter angelegt ist – und bei aktiven Zeitplänen auch, ob er gerade verfügbar ist. Nach dem Einrichtungsassistenten ist die Funktion standardmäßig aktiv.

Den Schalter kannst du jederzeit ändern. Öffne dazu das **Chat Settings**-Panel und geh zum Abschnitt **Autonomous Messaging**.

### Dein Anwesenheitsstatus

Dein Anwesenheitsstatus beeinflusst, wann Charaktere auf dich zukommen. Er sitzt als farbige Statusanzeige am Fuß der Seitenleiste und zeigt den aktuellen Zustand. Ein Klick darauf öffnet vier Optionen:

- **Active**: Du bist online und ansprechbar.
- **Idle**: Wird automatisch gesetzt, wenn du abwesend bist.
- **Do Not Disturb**: Unterdrückt autonome Nachrichten.
- **Invisible**: Verbirgt deinen Status vor den Charakteren.

Direkt daneben liegt das Feld **What are you doing?** (Was machst du gerade?). Trag dort kurz eine eigene Tätigkeit ein, wenn die Charaktere wissen sollen, was du gerade treibst. Der Anwesenheitsstatus gilt global und bleibt in jedem Chat gleich.

## Reaktionen und Benachrichtigungen

Jede Conversation-Nachricht lässt sich mit einem Emoji versehen. Deine eigene Reaktion setzt du über die Schaltfläche an der Nachricht. Marinara speichert sie als Notiz der Form `[User reacted with ...]`, sodass spätere Antworten sie sehen. So kann ein Charakter mitbekommen, dass du reagiert hast.

Ist die Befehlsfamilie **Reactions** aktiv, reagieren auch die Charaktere – auf deine Nachrichten und auf die der anderen. In Gruppenchats ist das praktisch: Ein Charakter kann kurz reagieren, ohne gleich eine ganze Nachricht zu schreiben.

Schreibt dir ein Charakter in einem Chat, den du gerade nicht offen hast, taucht am Bildschirmrand eine schwebende Avatar-Blase auf. Ein Klick springt zu diesem Chat, das X blendet sie aus. Auf dem Handy fassen sich mehrere offene Blasen zu einer antippbaren Gruppe zusammen.

## Selfies

Charaktere können dir Selfies schicken, also KI-generierte Fotos von sich selbst. Anders als die Szenenbilder in Roleplay und Game Mode gehört ein Selfie immer zu genau einem Charakter.

Für Selfies installierst du **Illustrator** über **Agents → Download Agents**. Öffne danach das **Chat Settings**-Panel, geh zu **Agents → Illustrator Settings** und leg eine **Selfie Connection** fest. Eine Selfie-Verbindung ist ein Anbieter für Bildgenerierung. Jedes Selfie kostet einen Aufruf der Bildgenerierung.

Die komplette Einrichtung mit Stil, Auflösung und der Schaltfläche für manuelle Anfragen beschreibt [Selfies](selfies.md).

## Tischspiele

Conversation Mode kennt sechs optionale Tischspiel-Pakete: **UNO**, **Chess**, **Poker**, **8-Ball Pool**, **Tic-Tac-Toe** und **Rock-Paper-Scissors**. Installiere die gewünschten Spiele über **Agents → Download Agents**. Die App teilt aus, achtet auf die Regeln und lässt jeden Charakter seine Züge in der eigenen Rolle erzählen. Tischspiele laufen ausschließlich in Conversation-Chats.

Eine Partie startest du auf drei Wegen:

1. Tipp einen Slash-Befehl ins Nachrichtenfeld und drück Enter.
2. Schreib eine ganz normale Nachricht wie „lass uns UNO spielen“.
3. Lass dich von einem Charakter einladen, sofern dessen Befehlsfamilie aktiv ist.

Diese Slash-Befehle gibt es:

```
/uno
```

```
/chess
```

```
/poker
```

```
/8ball
```

```
/tictactoe
```

```
/rps
```

Jedes Spiel hat ein eigenes Einrichtungsfenster mit Optionen. Alle Regeln, Einrichtungsfenster und Spielbretter stehen unter [Tischspiele](table-games.md).

## Zeitpläne der Charaktere

Jeder Charakter in einem Conversation-Chat kann einen wöchentlichen Zeitplan bekommen. Der Zeitplan legt Status und Tätigkeit in einem Raster über 7 Tage und 24 Stunden fest. Dadurch wirken autonome Nachrichten alltagsnah: Ein als abwesend markierter Charakter meldet sich in diesen Stunden nicht.

Einen Zeitplan erzeugst du schon bei der Einrichtung über **Generate Schedules**. Genauso gut legst du ihn später im Abschnitt **Autonomous Messaging** des **Chat Settings**-Panels an oder bearbeitest ihn dort. [Zeitpläne der Charaktere und autonome Nachrichten](schedules.md) beschreibt den vollständigen Editor, die Tageslimits und den Befehl `/status` zum Übersteuern.

## Fehlerbehebung

### Autonome Nachrichten kommen zu häufig

Öffne das **Chat Settings**-Panel und schalte **Autonomous Messages** im Abschnitt **Autonomous Messaging** ab. Alternativ setzt du den Anwesenheitsstatus auf **Do Not Disturb** – das unterdrückt autonome Nachrichten. Arbeitest du mit Zeitplänen, markiere mehr Stunden als abwesend, siehe [Zeitpläne der Charaktere und autonome Nachrichten](schedules.md).

### Ein Charakter antwortet im Gruppenchat auf alles

Gruppenchats haben eigene Regeln für die Sprechreihenfolge, etwa **Reply When Mentioned**. Unter [Gruppenchats](../chats/group-chats.md) legst du fest, wer wann spricht.

### Ein Charakter vergisst frühere Dinge

Lange Chats füllen das Gedächtnis des Modells. Probier ein Modell mit größerem Kontextfenster, oder pack wichtige Fakten in einen Lorebook-Eintrag, damit sie im Kontext bleiben. Auch ein frischer Chat mit demselben Charakter und derselben Persona hilft. Mehr dazu unter [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md).

### Ein Selfie sieht dem Charakter nicht ähnlich

Öffne die Einstellungen unter **Selfies** und setze **Attach Card Appearance** auf **Images only** (nur Bilder) oder **Images and videos** (Bilder und Videos). Unterstützt der Bild-Anbieter Referenzbilder, stell zusätzlich **Send Avatar References** ein. Details stehen unter [Selfies](selfies.md).

## Verwandte Anleitungen

- [Audio- und Videoanrufe in Conversation](calls.md)
- [Zeitpläne der Charaktere und autonome Nachrichten](schedules.md)
- [Profile in Conversation Mode](profiles.md)
- [Selfies](selfies.md)
- [Eigene Emojis, Sticker und GIFs](emoji-stickers-gifs.md)
- [Tischspiele](table-games.md)
- [Eine Conversation mit einem Roleplay oder Game verbinden](../chats/connected-chats.md)
