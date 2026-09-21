# Charakter-Zeitpläne und autonome Nachrichten

In dieser Anleitung erfährst du, wie Charaktere im Conversation Mode von sich aus schreiben und wie du den Zeitpunkt steuerst. Es geht um autonome Nachrichten, Charakter-Zeitpläne, den Befehl **/status** und deinen eigenen Anwesenheitsstatus. All das funktioniert ausschließlich im Conversation Mode.

## Wozu autonome Nachrichten und Zeitpläne gut sind

Eine autonome Nachricht schreibt ein Charakter von sich aus, ohne dass du vorher etwas eingibst. Marinara Engine (kurz Marinara) verschickt sie, wenn du länger nichts von dir hören lässt. So fühlt sich ein Chat an wie eine echte Beziehung im Messenger.

Zwei Einstellungen steuern dieses Verhalten:

- **Autonomous Messages** (autonome Nachrichten) legt fest, ob Charaktere überhaupt von sich aus schreiben dürfen.
- **Schedules** (Zeitpläne) gibt jedem Charakter einen Wochenablauf. Dadurch wirkt er je nach Uhrzeit wach, beschäftigt oder schlafend.

Zeitpläne sind optional. Sind autonome Nachrichten aktiv und Zeitpläne nicht, melden sich Charaktere trotzdem – abhängig von ihrer Gesprächigkeit und deinem Status. Die Gesprächigkeit ist eine Einstellung pro Charakter dafür, wie oft er ein Gespräch selbst beginnt.

## Autonome Nachrichten aktivieren

Gesteuert wird das im Chat, nicht auf der Charakterkarte. Alle Bedienelemente dafür stehen im Bereich **Autonomous Messaging** der **Chat Settings** (Chat-Einstellungen).

1. Öffne einen Conversation-Chat.
2. Öffne die **Chat Settings** (Zahnradsymbol).
3. Suche den Bereich **Autonomous Messaging**.
4. Aktiviere den Schalter **Autonomous Messages**.

Im Einrichtungsassistenten für neue Chats ist **Autonomous Messages** standardmäßig aktiv. Abschalten lässt sich das jederzeit in den **Chat Settings**.

### Chat Check-In Cap

Unter dem Schalter begrenzt **Chat Check-In Cap** (Obergrenze für Meldungen im Chat), wie oft sich Charaktere pro Tag in diesem Chat melden dürfen.

- Standard ist die Option **Default chat ceiling (talkativeness-based)**. Die Grenze ergibt sich dann aus der Gesprächigkeit des jeweiligen Charakters.
- Mit **Numeric value** erscheint ein Zahlenfeld, in das du jede positive ganze Zahl als Obergrenze einträgst. Hohe Werte erzeugen viele Modellanfragen und Benachrichtigungen.

Diese Grenze gilt für den gesamten Chat. Der eigene Wert eines Charakters aus seinem Zeitplan kann sie nur senken, niemals anheben.

Der Standard nach Gesprächigkeit sieht so aus:

| Gesprächigkeit des Charakters | Meldungen pro Tag (Standard) |
|---|---|
| 80 oder höher | 8 |
| 60 bis 79 | 6 |
| 40 bis 59 | 5 |
| 20 bis 39 | 3 |
| unter 20 | 2 |

### Zeitpläne aktivieren

Der Schalter **Schedules** (Zeitpläne) befindet sich unter **Autonomous Messaging**. Gespeicherte Routinen gehören den Figuren und werden in Conversation-Chats wiederverwendet, auch beim Hinzufügen einer Figur zu einem bestehenden Chat. Explizites Ausschalten in einem Chat gilt weiter nur dort und löscht die Routine nicht.

1. Aktiviere den Schalter **Schedules**.
2. Vorhandene Figurenroutinen erscheinen sofort. Einschalten erzeugt keine neuen Routinen; klicke dafür auf **Generate**.
3. Sobald Abläufe vorliegen, erscheint die Liste **Edit schedules** (Zeitpläne bearbeiten) mit einer Zeile pro Charakter.

Automatische wöchentliche Erneuerung bleibt aus, bis du sie für die Figur im **Character Schedule Manager** (Figuren-Zeitplanmanager) aktivierst. Ein fehlgeschlagener Versuch wird beim erneuten Öffnen nicht ständig wiederholt; nutze die Generierungsfunktionen für einen neuen Versuch.

Jede Zeile zeigt, wie viele Tage belegt sind, etwa **3 days scheduled**, oder **Create schedule**, falls für diesen Charakter noch nichts existiert. Die Schaltfläche **Generate** (heißt **Regenerate**, sobald Abläufe vorliegen) baut die Abläufe jederzeit neu auf.

## Der Zeitplan-Editor

Klick auf die Zeile eines Charakters in der Liste **Edit schedules**, um den Zeitplan-Editor zu öffnen. Im Fenstertitel steht **Edit**, danach der Charaktername und **Schedule**.

Ganz oben fasst der Bereich **Routine profile** die Woche in verständlicher Sprache zusammen. Erzeugt wird sie über die Schaltfläche **Generate summary**, aktualisiert über **Refresh summary**. Änderst du den Zeitplan nach dem Erzeugen, erscheint der Hinweis **Summary may be stale**.

### Tuning

Im Bereich **Tuning** (Feinabstimmung) stehen die wichtigsten Bedienelemente.

- **Chat talkativeness** ist ein Schieberegler mit fünf Stufen: **Rare**, **Quiet**, **Balanced**, **Social** und **Very frequent**. **Balanced** ist der mittlere Standard. Dieser Wert überschreibt die Standard-Gesprächigkeit des Charakters überall dort, wo sein Zeitplan verwendet wird. Er beeinflusst, wie oft der Charakter Nachrichten beginnt, nachfasst und sich am Gruppengeplauder beteiligt. Außerdem legt er das tägliche Standardlimit des Charakters fest.
- **Wait before checking in** ist die Ruhezeit in Minuten, bevor sich dieser Charakter melden darf. Möglich sind 15 bis 360 Minuten, der Standard ist **120**.
- **Check-in moments** sind die Anlässe, zu denen sich der Charakter melden darf. Zur Wahl stehen die Chips **Morning**, **Goodnight**, **Meal breaks**, **After busy** und **Long absence**. Alle sind standardmäßig aktiv. Ein Klick schaltet einen davon ab.

### Advanced timing

Innerhalb von **Tuning** verbergen sich unter **Advanced timing** (erweiterte Zeitsteuerung) drei weitere Bedienelemente.

- **Daily safety limit** ist eine harte Obergrenze für genau diesen Charakter, entweder **Default** oder eine Zahl von 1 bis 8 pro Tag. Sie kann die Chat-Obergrenze nur senken, nicht anheben. Lass sie im Normalfall auf **Default**.
- **Delay while you're away** bestimmt, wie viele Minuten dieser Charakter wartet, solange sein eigener Status **Away** lautet. Bleibt das Feld leer, gilt der Standard: zufällige 1 bis 3 Minuten. Möglich sind 0 bis 120 Minuten.
- **Delay while you're busy** macht dasselbe für den Status **Busy**. Bleibt das Feld leer, gilt der Standard: zufällige 2 bis 5 Minuten. Möglich sind 0 bis 120 Minuten.

### Schedule AI: die Woche neu entwerfen

Im Bereich **Schedule AI** lässt du den Ablauf vom Modell umschreiben. Wähle eine **Week action**:

- **Rewrite** entwirft die komplette Woche neu.
- **Adjust** behält den Ablauf weitgehend bei und setzt deine Vorgaben um.
- **Vary** macht die Woche deutlich anders, aber weiterhin glaubwürdig.
- **Repair** schließt Lücken und behebt offensichtliche Probleme mit kleinen Änderungen.

Ins Feld **Week guidance** kannst du optional Hinweise eintragen, zum Beispiel:

```
make weekdays more nocturnal, keep weekends social
```

Klick anschließend auf die Schaltfläche mit dem Namen deiner Aktion, etwa **Rewrite week**. Das Ergebnis ist zunächst nur ein Entwurf. Gespeichert wird erst mit einem Klick auf **Save schedule**. Ungültiges Modell-JSON kannst du unter **Edit generated schedule JSON** (generiertes Zeitplan-JSON bearbeiten) korrigieren und mit **Apply to draft** (auf Entwurf anwenden) prüfen. Gültige Reparaturen und erfolgreich generierte Tage bleiben bis zum Speichern im Entwurf. Fehler stoppen den Aufruf ohne automatische Wiederholung. **Stop** oder Schließen des Editors bricht aktive Anfragen ab. Auch Schließen des Zeitplanmanagers oder der Chat-Einstellungen beendet dort gestartete Generierung.

### Tagesblöcke

Unter den Bereichen hat jeder Tag von Montag bis Sonntag eine eigene Zeile. Ist für einen Tag nichts hinterlegt, steht dort **No blocks scheduled for this day**.

Jeder Block besteht aus drei Teilen, beschriftet mit **Status, time & activity**:

- Ein **Status** zur Auswahl: **Online**, **Away**, **Busy** oder **Offline**.
- Eine Zeitspanne in der Schreibweise `09:00-11:30`.
- Eine kurze Notiz zur Aktivität, etwa `at work`.

Über **Add block** kommt eine Zeitspanne hinzu, über das Papierkorbsymbol verschwindet eine wieder. Jeder Tag hat außerdem ein eigenes Hinweisfeld, beschriftet mit **Guide Monday**, **Guide Tuesday** und so weiter. Trag dort einen Hinweis ein und klick auf die passende Schaltfläche, etwa **Regenerate Monday**, um nur diesen einen Tag neu zu entwerfen.

Der Status eines Blocks entscheidet, was der Charakter tut, wenn der Zeitpunkt zum Melden gekommen ist. Bei einem **Offline**-Block schreibt er in dieser Zeit nie zuerst. Bei einem **Busy**-Block wartet er dreimal so lange wie sonst, bevor er sich meldet.

Zum Schluss klick auf **Save schedule**. **Cancel** schließt den Editor, ohne zu speichern.

### Einen Zeitplan zwischen Charakteren oder Installationen übertragen

Über **Export schedule** (Zeitplan exportieren) ganz unten im Editor lädst du den aktuellen Entwurf als JSON-Datei herunter – JSON ist ein schlichtes Textformat. Der Export enthält die Blöcke der Woche, die Zusammenfassung der Routine, die Gesprächigkeit, die **Check-in moments** und die Einstellungen unter **Advanced timing**.

Öffne den Zeitplan-Editor eines anderen Charakters und wähle dort **Import schedule** (Zeitplan importieren), um diese Datei zu laden. Marinara prüft die Datei, bevor sie den Entwurf im Editor ersetzt, und schiebt die importierte Routine auf die aktuelle Woche. Gespeichert wird der Import nicht automatisch: Mit **Save schedule** behältst du ihn, mit **Cancel** bleibt der bisherige Zeitplan des Charakters unverändert.

### Schedule generation preferences

Zurück in den **Chat Settings**: Das Feld **Schedule generation preferences** (Vorgaben für die Zeitplan-Erstellung) nimmt frei formulierte Hinweise dazu auf, wie die Abläufe geschrieben werden. Diese Einstellung gilt global. Sie greift in jedem Conversation-Chat, sobald das nächste Mal Zeitpläne entstehen – von Hand oder durch die App. Zum Beispiel:

```
Make everyone go to sleep before midnight. I work 9-5 on weekdays.
```

## Einen einmaligen Status mit /status setzen

Der Befehl **/status** setzt oder löscht einen vorübergehenden Status für einen Charakter, ohne den gespeicherten Zeitplan anzurühren. Er funktioniert nur im Conversation Mode.

Der Befehl hat diese Form:

```
/status <online|idle|dnd|offline|clear> [character name]
```

`idle` steht für Away, `dnd` für Busy. Es sind dieselben vier Status wie in den Zeitplan-Blöcken. Damit ein Charakter namens Mira gerade jetzt beschäftigt wirkt:

```
/status dnd Mira
```

Und so hebst du das wieder auf, sodass für Mira wieder ihr Zeitplan gilt:

```
/status clear Mira
```

Gibt es im Chat nur einen Charakter, kannst du den Namen weglassen. **/status** ohne weitere Angaben zeigt die Liste der Charaktere und eine kurze Hilfe.

## Wie autonome Nachrichten getaktet werden

Marinara taktet autonome Nachrichten so, dass dich kein Charakter zuspammt. Grundlage der folgenden Regeln ist der jeweils eigene Zeitplan.

- Ein Charakter wartet, bis du so lange geschwiegen hast, wie unter **Wait before checking in** hinterlegt ist. Der Standard sind 120 Minuten.
- Ein Charakter mit dem aktuellen Status **Offline** schreibt nicht zuerst.
- Ein Charakter mit dem aktuellen Status **Busy** wartet dreimal so lange.
- Nach der ersten Nachricht darf ein Charakter noch zwei weitere schicken, solange du schweigst. Macht drei Nachrichten pro Schweigephase.
- Jede weitere Nachricht wartet länger als die vorige: die erste das Doppelte der Grundzeit, die zweite das Vierfache.
- Sobald du antwortest, beginnt die Zählung von vorn. Die nächste Stille startet bei null.

Sind mehrere Charaktere gleichzeitig bereit, kommt der mit der höchsten Gesprächigkeit und dem besten Timing zuerst.

## Dein Anwesenheitsstatus

Dein eigener Status verrät den Charakteren, ob du gerade da bist. Das Bedienelement dafür sitzt unten in der Seitenleiste und bleibt in jedem Chat-Modus sichtbar. Auf die Nachrichten wirkt es sich nur im Conversation Mode aus.

Klick auf die Statusanzeige, um vier Möglichkeiten zu öffnen:

- **Active**: du bist online und ansprechbar.
- **Idle**: erscheint, wenn du abwesend bist.
- **Do Not Disturb**: stoppt alle autonomen Nachrichten.
- **Invisible**: verbirgt deinen Status vor den Charakteren.

**Idle** läuft größtenteils automatisch. Steht dein Status auf **Active** und passiert 10 Minuten lang nichts, setzt Marinara dich auf **Idle**. Bei deiner Rückkehr geht es zurück auf **Active**. Du kannst **Idle** auch selbst im Einblendfenster wählen. Wählst du einen Status von Hand, ruht die Automatik, bis du wieder **Active** wählst.

Setz **Do Not Disturb**, wenn du Ruhe willst. Solange das aktiv ist, schreibt dir kein Charakter zuerst. **Idle** blockiert autonome Nachrichten dagegen nicht. Charaktere melden sich also auch während deiner Abwesenheit.

Neben der Statusanzeige liegt das Feld **What are you doing?**. Trag dort eine kurze eigene Aktivität ein, bis zu 120 Zeichen. Zuletzt genutzte Einträge sammelt die Liste **Recent status**, sodass du sie wiederverwenden kannst.

## Verwandte Anleitungen

- [Conversation Mode: Erste Schritte](getting-started.md)
- [Conversation-Mode-Profile (Display Name, About Me, Behavior)](profiles.md)
- [Chat Settings im Überblick](../chats/chat-settings.md)
