# Charakter-Zeitpläne und autonome Nachrichten

Autonome Nachrichten sind Nachrichten, die ein Charakter dir zuerst schickt, nachdem du eine Weile still warst. Ein Zeitplan ist der Wochenplan eines Charakters, durch den er je nach Uhrzeit wach, beschäftigt oder schlafend wirkt. Beides funktioniert nur in Conversation Mode.

Zeitpläne sind optional. Ohne Zeitpläne melden sich Charaktere trotzdem, je nach ihrer Gesprächigkeit (wie oft ein Charakter ein Gespräch beginnt) und deinem Status. Springe zu: [Zeitpläne aktivieren](#turn-on-schedules), wenn du nur einen Zeitplan willst.

## Autonome Nachrichten aktivieren

Bevor du anfängst: Öffne einen Conversation-Chat. Neue Chats starten mit dieser Option an (siehe [Conversation Mode: Erste Schritte](getting-started.md)).

1. Öffne die **Chat Settings** im Chat.
2. Suche den Bereich **Autonomous Messaging**.
3. Schalte **Autonomous Messages** an.

Wenn es nicht funktioniert hat: Charaktere bleiben still, solange dein Status **Do Not Disturb** ist (siehe [Dein Anwesenheitsstatus](getting-started.md#your-presence-status)).

### Das Check-in-Limit festlegen

Unter **Chat Settings → Autonomous Messaging** begrenzt **Chat Check-In Cap**, wie viele Check-ins Charaktere in diesem Chat pro Tag senden dürfen.

- **Default chat ceiling (talkativeness-based)** übernimmt das Limit aus der Gesprächigkeit jedes Charakters (Tabelle unten).
- **Numeric value** zeigt ein Zahlenfeld. Gib eine beliebige ganze Zahl ab 1 ein. Hohe Zahlen können viele Modellanfragen und Benachrichtigungen bedeuten.

Ein Charakter kann auch ein eigenes **Daily safety limit** haben (in seinem Zeitplan festgelegt). Das Limit für einen Charakter funktioniert so:

- Chat-Limit auf **Numeric value** und **Daily safety limit** gesetzt: Die niedrigere Zahl gilt.
- Nur eines von beiden gesetzt: Diese Zahl gilt, auch wenn sie höher ist als die Zahl der Gesprächigkeit unten.
- Keines von beiden gesetzt: Die Zahl stammt aus der Gesprächigkeit des Charakters.

| Gesprächigkeit des Charakters | Check-ins pro Tag |
| --- | --- |
| 80 oder höher | 8 |
| 60 bis 79 | 6 |
| 40 bis 59 | 5 |
| 20 bis 39 | 3 |
| unter 20 | 2 |

<a id="turn-on-schedules"></a>

## Zeitpläne aktivieren

Bevor du anfängst: Schalte **Autonomous Messages** an.

1. Schalte unter **Chat Settings → Autonomous Messaging** **Schedules** an. (Im Einrichtungsassistenten für neue Chats heißt dieselbe Option **Generate Schedules**.) Bereits vorhandene Zeitpläne erscheinen sofort.
2. Wähle im Feld darunter deine Zeitzone.
3. Klicke auf **Generate**, um Zeitpläne für Charaktere ohne Zeitplan zu erstellen. Die Schaltfläche heißt **Regenerate**, sobald Zeitpläne vorliegen.
4. Warte, bis es fertig ist. Dann erscheint die Liste **Edit schedules** mit einer Zeile pro Charakter. Eine Zeile nennt, wie viele Tage gefüllt sind (zum Beispiel **3 days scheduled**), oder **Create schedule**. Die Liste erscheint nur, sobald Zeitpläne vorliegen.
5. Klicke auf die Zeile eines Charakters, um seinen Zeitplan-Editor zu öffnen (nächster Abschnitt).

Ein Zeitplan gehört dem Charakter und wird in jedem Conversation-Chat wiederverwendet. Schaltest du **Schedules** in einem Chat aus, bleibt er dort erhalten, und der Zeitplan bleibt gespeichert.

Die automatische wöchentliche Erneuerung ist aus, solange du nicht **Renew weekly** für diesen Charakter im **Character Schedule Manager** einschaltest. Öffne ihn über die Kalenderschaltfläche in der Fußzeile der Seitenleiste, neben dem Statusfeld. Marinara versucht bei jedem Laden der App einmal pro Chat eine Erneuerung. Schlägt sie fehl, versucht es Marinara erst nach einem Neuladen der Seite wieder. Klicke auf **Generate**, um es erneut zu versuchen.

**Schedule generation preferences** im selben Bereich **Schedules** der **Chat Settings** enthalten Freitext-Vorgaben dafür, wie Zeitpläne geschrieben werden. Sie gelten für jeden Conversation-Chat, wenn das nächste Mal Zeitpläne erstellt werden. Beispiel:

```text
Make everyone go to sleep before midnight. I work 9-5 on weekdays.
```

## Der Zeitplan-Editor

Der Titel des Editors lautet **Edit** plus Charaktername und **Schedule**.

Oben zeigt **Routine profile** eine Zusammenfassung der Woche in einfacher Sprache. Klicke auf **Generate summary**, um sie zu erstellen, oder auf **Refresh summary**, um sie zu aktualisieren. Nach einer Änderung des Zeitplans erscheint **Summary may be stale**. **Generation model** wählt das Modell, das Zeitpläne schreibt.

### Tuning

Öffne **Tuning** für die Hauptregler.

- **Chat talkativeness**: ein Regler mit **Rare**, **Quiet**, **Balanced**, **Social** und **Very frequent**. Standard ist **Balanced**. Er legt fest, wie oft der Charakter Nachrichten beginnt und in Gruppengesprächen mitredet, sowie sein Standard-Tageslimit.
- **Wait before checking in**: Ruheminuten, bevor sich der Charakter melden darf. Standard ist 120. Du kannst 15 bis 360 nutzen.
- **Check-in moments**: Chips für **Morning**, **Goodnight**, **Meal breaks**, **After busy** und **Long absence**. Alle sind an. Klicke auf einen, um ihn auszuschalten.

Öffne **Advanced timing** in **Tuning** für drei weitere Regler.

- **Daily safety limit**: die meisten Check-ins pro Tag für diesen Charakter. Lass es auf **Default**, oder gib eine ganze Zahl ab 1 ein. Hat auch der Chat ein Zahlenlimit, gilt die niedrigere Zahl. Sonst ersetzt dieses Limit die Zahl der Gesprächigkeit.
- **Delay while you're away**: zusätzliche Minuten, bevor der Charakter antwortet, während sein Status **Away** ist. Lass es leer für zufällige 1 bis 3 Minuten. Du kannst 0 bis 120 nutzen.
- **Delay while you're busy**: dasselbe, während sein Status **Busy** ist. Lass es leer für zufällige 2 bis 5 Minuten. Du kannst 0 bis 120 nutzen.

### Schedule AI: die Woche neu entwerfen

Öffne **Schedule AI**, damit das Modell den Zeitplan neu schreibt. Wähle eine **Week action**:

| Aktion | Ergebnis |
| --- | --- |
| **Rewrite** | Ein frischer Entwurf für die ganze Woche. |
| **Adjust** | Behält das meiste des Zeitplans bei und wendet deine Vorgaben an. |
| **Vary** | Eine deutlich andere Woche, die trotzdem glaubwürdig ist. |
| **Repair** | Behebt Lücken und offensichtliche Probleme mit kleinen Änderungen. |

1. Wähle eine **Week action**.
2. Wähle unter **Weekly generation** **Entire week in one request** oder **One request per day**. Eine Anfrage pro Tag macht kleinere Anfragen und kann mehr Tokens verbrauchen (die kleinen Textstücke, die Modelle zählen).
3. Tippe optionale Hinweise in **Week guidance**, zum Beispiel `make weekdays more nocturnal, keep weekends social`.
4. Klicke auf die Schaltfläche mit dem Namen deiner Aktion, etwa **Rewrite week**.
5. Klicke auf **Save schedule**, um das Ergebnis zu behalten. Bis dahin ist es nur ein Entwurf (**Unsaved draft**).

Wenn es nicht funktioniert hat: Dein Entwurf bleibt erhalten. Ein fehlgeschlagener Aufruf wird nicht wiederholt, also klicke erneut auf die Schaltfläche. Klicke auf **Stop** oder schließe den Editor, um eine laufende Anfrage abzubrechen. Wenn der Editor unter **Edit generated schedule JSON** Text zeigt, den das Modell zurückgab und den er nicht lesen konnte, korrigiere den Text und klicke auf **Apply to draft**.

### Tagesblöcke

Jeder Tag von Montag bis Sonntag hat eine eigene Zeile. Ein leerer Tag zeigt **No blocks scheduled for this day**. Jeder Block hat einen Status, eine Zeitspanne wie `09:00-11:30` und eine kurze Tätigkeit wie `at work`.

1. Klicke unter einem Tag auf **Add block**.
2. Wähle einen Status: **Online**, **Away**, **Busy** oder **Offline**.
3. Tippe die Zeitspanne und die Tätigkeit ein.
4. Klicke auf **Save schedule**. **Cancel** schließt den Editor ohne Speichern.

Nutze das Papierkorbsymbol, um einen Block zu entfernen. Um einen Tag neu zu entwerfen, tippe einen Hinweis in **Guide Monday** (oder den Tag deiner Wahl) und klicke auf **Regenerate Monday**.

Während eines **Offline**-Blocks schreibt der Charakter nie zuerst. Während eines **Busy**-Blocks wartet er dreimal so lange wie sonst.

### Einen Zeitplan zwischen Charakteren verschieben

Klicke auf **Export schedule**, um den Entwurf als JSON-Datei herunterzuladen (Blöcke der Woche, Zusammenfassung, Gesprächigkeit, Check-in-Momente und Timing). Klicke im Editor eines anderen Charakters auf **Import schedule**, um sie zu laden. Marinara prüft die Datei und verschiebt den Zeitplan auf die aktuelle Woche. Nichts wird gespeichert, bis du auf **Save schedule** klickst.

## Einen Status mit /status setzen

`/status` setzt oder löscht einen vorübergehenden Status für einen Charakter, ohne seinen gespeicherten Zeitplan zu ändern. Es funktioniert nur in Conversation Mode. Der Status gehört dem Charakter, gilt also in jedem Chat, in dem dieser Charakter ist.

Tippe eines davon in das Nachrichtenfeld:

```text
/status dnd Mira
/status clear Mira
```

Das erste setzt Mira auf beschäftigt. Das zweite gibt sie an ihren Zeitplan zurück. Bei nur einem Charakter im Chat kannst du den Namen weglassen. `/status` allein listet die Charaktere und die Verwendung.

Die volle Form steht unten. `idle` bedeutet **Away** und `dnd` bedeutet **Busy**. Eckige Klammern bedeuten, dass der Name optional ist.

```text
/status online|idle|dnd|offline|clear [character name]
```

Ein Status, den du setzt, bleibt, bis du ihn löschst, und ein Charakter kann ihn nicht ersetzen.

<a id="characters-can-change-their-own-status"></a>

## Charaktere ihren eigenen Status ändern lassen

Ist **Schedule Updates** unter **Chat Settings → Agents → Commands** an, kann ein Charakter selbst einen vorübergehenden Status und eine Tätigkeit setzen. Bittest du ihn zum Beispiel, sich eine Stunde lang zu konzentrieren, kann er auf **Busy** mit der Tätigkeit „Studying“ wechseln.

- Die Änderung gilt so lange, wie der Charakter sagt, oder eine Stunde, wenn er nichts sagt. Das Maximum sind sieben Tage.
- Ist die Zeit um, kehrt der Charakter zu seinem Zeitplan zurück, oder zu **Online**, wenn er keinen hat.
- Er ändert nie den gespeicherten Zeitplan.

## Wie Check-ins getaktet werden

| Regel | Detail |
| --- | --- |
| Erster Check-in | Der Charakter wartet, bis du so lange still warst, wie unter **Wait before checking in** steht (standardmäßig 120 Minuten). |
| Reaktion | Eine Reaktion von dir ohne neue Nachricht löst eine kürzere Wartezeit aus. |
| Status **Offline** | Kein Check-in. |
| Status **Busy** | Die Wartezeit ist dreimal so lang. |
| Folge-Check-ins | Bis zu zwei weitere, solange du still bleibst, insgesamt drei. Der erste Folge-Check-in kommt nach der doppelten Wartezeit, der zweite nach der vierfachen. |
| Deine Antwort | Die Zählung beginnt von vorn. |
| Mehrere Charaktere bereit | Der mit der höchsten Gesprächigkeit und dem besten Timing kommt zuerst. Ein Charakter mit Status **Online** hat Vorrang. |

In einem Gruppenchat, in dem jeder Charakter in einer eigenen Antwort antwortet (siehe [Gruppenchats](../chats/group-chats.md)), teilen sich die Charaktere ein Tageslimit und ein Tempo. Nachdem sich irgendein Charakter gemeldet hat, wartet der nächste Check-in von jedem wie ein Folge-Check-in. Jeder Charakter, dessen eigene Wartezeit abgelaufen ist, darf sich melden, und der mit den wenigsten Check-ins an diesem Tag kommt zuerst. Nach einer langen Abwesenheit meldet sich nur ein Charakter.

## Verwandte Anleitungen

- [Conversation Mode: Erste Schritte](getting-started.md)
- [Conversation-Mode-Profile (Display Name, About Me, Behavior)](profiles.md)
- [Chat Settings im Überblick](../chats/chat-settings.md)
