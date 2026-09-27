# Referenz der Slash-Befehle

In dieser Anleitung findest du alle Slash-Befehle, die sich in einem Marinara-Engine-Chat eintippen lassen. Ein Slash-Befehl ist eine Abkürzung, die du mit einem Schrägstrich beginnend ins Nachrichtenfeld schreibst, um schnell etwas zu erledigen. Manche Befehle wirken sofort auf dem Bildschirm, andere lassen die KI etwas schreiben.

## So funktionieren Slash-Befehle

Tipp den Befehl unten im Chat ins Nachrichtenfeld und klick dann auf **Send** (Senden). Auch Enter sendet, sofern **Send on Enter** (mit Enter senden) für den jeweiligen Chat-Modus unter **Settings** (Einstellungen) aktiv ist. Standardmäßig sendet Enter in Conversation-Chats; in Roleplay-Chats beginnt es dagegen eine neue Zeile. Das Nachrichtenfeld weist selbst auf die Befehle hin. In einem Roleplay-Chat lautet der Platzhaltertext **Write your response, / for commands** („Schreib deine Antwort, / für Befehle“). In einem Conversation-Chat steht dort der Charaktername, etwa „Message @Alice, / for commands“. Sind mehrere Charaktere beteiligt, erscheint stattdessen der Chatname.

Sobald du einen Schrägstrich tippst, öffnet sich über dem Feld ein kleines Menü mit passenden Befehlen. Jede Zeile zeigt das Befehlsformat mit seinen Argumenten und eine kurze Beschreibung. Ein Klick oder Tipp auf eine Zeile setzt den Befehl ins Feld ein – danach ergänzt du noch weiteren Text und schickst ihn ab.

Ersetze die Platzhalter in eckigen Klammern, etwa `[name]` oder `[range]`, durch deine Werte; tippe die Klammern nicht mit. Mit `(optional)` markierte Angaben kannst du weglassen. Ein `|` trennt Alternativen: einzelne Werte wie `prompt|reset` oder vollständige Befehlsformate.

Viele Befehle haben kürzere Alternativen. `/continue` und die Kurzform `/cont` bewirken zum Beispiel genau dasselbe. Die vollständige Liste zeigt dir die App jederzeit über diesen Befehl:

```
/help
```

Manche Befehle laufen direkt im Browser und ändern den Chat sofort, ganz ohne Kosten. Andere lassen die KI Text generieren; das läuft über den verbundenen Anbieter und verbraucht unter Umständen Tokens. Ein Token ist die Einheit, mit der die meisten KI-Anbieter Text messen und abrechnen. Die Tabellen unten halten fest, was der jeweilige Befehl macht.

Slash-Befehle funktionieren in den Nachrichtenfeldern von **Conversation** und **Roleplay**. Im Modus **Game** wirkt nur `/illustrate` als Slash-Befehl. Alles andere mit einem Schrägstrich am Anfang geht dort als ganz normaler Text raus.

Mehrere Befehle arbeiten mit Nachrichtennummern. Marinara zählt ab der ersten Nachricht im Chat: 1, dann 2, dann 3 und so weiter. Befehle wie `/goto`, `/hide` und `/unhide` greifen auf diese Nummern zu.

## Befehle für Chat und Nachrichten

Diese Befehle helfen dir beim Verwalten des Chats und seiner Nachrichten. Sie funktionieren in **Conversation**- und **Roleplay**-Chats.

| Befehl | Auch als | Was er macht |
|---|---|---|
| `/help` | | Listet alle Slash-Befehle auf. |
| `/send [message]` | | Postet eine Nachricht im Namen deiner Persona, ohne eine Generierung auszulösen. |
| `/continue` | `/cont` | Hängt weiteren Text an die letzte KI-Antwort an, ohne eine neue Nachricht zu senden. Die Option **Add a new line before /continue text** unter **Settings → General → Responses** legt fest, ob der Text nach einer Leerzeile beginnt oder direkt an der Abbruchstelle. |
| `/goto [number]` | `/jump`, `/scroll` | Springt im Chat zu einer Nachricht mit der angegebenen Nummer. |
| `/hide [range] [name (optional)]` | | Blendet eine oder mehrere Nachrichten für die KI aus, sodass sie in kommenden Zügen unsichtbar bleiben. |
| `/unhide [range]` | | Holt ausgeblendete Nachrichten wieder in die Sicht der KI zurück. |
| `/sys [message]` | `/system` | Fügt eine Systemnachricht ein. Der Hinweis erscheint im Chat und lenkt die KI, stammt aber von keinem Charakter. |
| `/macros` | `/macro` | Listet die unterstützten Prompt-Makros auf, etwa `{{user}}` und `{{char}}`. |
| `/remind [time] [message]` | `/reminder`, `/timer` | Stellt einen Timer und postet danach eine Erinnerung im Chat. |

So springst du zu Nachricht 27:

```
/goto 27
```

`/hide` und `/unhide` nehmen eine einzelne Nummer, einen Bereich oder eine Mischung aus beidem. Dieses Beispiel blendet die Nachrichten 3 bis 8 aus:

```
/hide 3-8
```

Du kannst auch `/hide 5` für eine einzelne Nachricht oder `/hide 2-5,9,12` für mehrere schreiben. Ohne Charakternamen werden die Nachrichten vor allen verborgen. Verborgene Nachrichten bleiben im Chat, aber die KI liest sie in der nächsten Runde nicht. Mit `/unhide` und derselben Art von Nummernliste stellst du global verborgene Nachrichten wieder her.

Füge in **Roleplay** nach dem Bereich einen Charakternamen hinzu, um die Nachrichten nur vor diesem Charakter zu verbergen:

```
/hide 3-8 Maukie
/hide 2-5,9 "Powers That Be"
```

Der Zugriff anderer Charaktere bleibt unverändert. Steht der Name zuerst, setze Namen mit Leerzeichen in Anführungszeichen: Die älteren Formen `/hide Maukie 3-8` und `/hide "Powers That Be" 2-5,9` funktionieren weiterhin. Passt ein Name zu mehreren Charakteren, verwende den vollständigen Namen. Setze rein numerische Charakternamen in Anführungszeichen, um sie von Nachrichtennummern zu unterscheiden, etwa `/hide 1 "123"`. In einem Roleplay-Gruppenchat kannst du über die Avatar-Auswahl bei **Hide from AI** (vor der KI verbergen) prüfen oder aufheben, vor welchen Charakteren die Nachricht verborgen ist. In einem Roleplay-Chat mit nur einem Charakter verwendest du stattdessen **Unhide from AI** (für die KI wieder einblenden) an der Nachricht. `/unhide` hebt nur das globale Verbergen auf.

Der Befehl `/remind` erwartet erst eine Zeitangabe, dann eine Nachricht. Dabei steht `h` für Stunden, `m` für Minuten und `s` für Sekunden. Dieses Beispiel erinnert dich in 30 Minuten:

```
/remind 30m check the oven
```

Die Erinnerung lebt in der Browser-Sitzung. Lass den Tab also offen, bis sie fällig wird.

## Befehle für Story und Roleplay

Mit diesen Befehlen lenkst du die Geschichte, spielst einen Charakter und ergänzt Bilder. Die meisten entfalten ihre Stärke in einem **Roleplay**-Chat. Die Ausnahme ist `/scene`: Den startest du aus einem **Conversation**-Chat heraus.

| Befehl | Auch als | Was er macht |
|---|---|---|
| `/guided [direction]` \| `/guided respond for [name] [direction (optional)]` | `/narrator`, `/narrate`, `/nar` | Lenkt die nächste KI-Antwort in eine Richtung, die du vorgibst. |
| `/as [name] [message (optional)]` | `/respond` | Postet eine Nachricht als Charakter oder bittet einen Charakter um eine Antwort. |
| `/emote [expression (optional)]` \| `/emote "[name]" [expression (optional)]` | `/emotion`, `/sprite` | Zeigt die Gesichtsausdrücke eines Sprites an oder wechselt zwischen ihnen. |
| `/roll [dice (optional)]` | `/r`, `/dice` | Würfelt und postet das Ergebnis. |
| `/random` | `/rand`, `/event` | Bittet die KI, ein überraschendes Ereignis in die Geschichte einzubauen. |
| `/scene [description (optional)]` | `/rp` | Wird aus einem Conversation-Chat heraus ausgeführt. Startet eine neue Roleplay-Szene, die sich von diesem Chat verzweigt. |
| `/illustrate [range=N\|range=N-M (optional)] [prompt (optional)]` | `/ill` | Generiert ein Galeriebild für den aktuellen Chat. |
| `/impersonate [direction (optional)]` | `/imp` | Schreibt eine Antwort im Namen deiner Persona. |
| `/impersonate_prompt [prompt\|reset]` | `/imp_prompt` | Legt die Anweisung fest, die `/impersonate` in diesem Chat verwendet. |

In **Roleplay** illustriert `/illustrate range=12` Nachricht 12; `/illustrate range=12-18` übergibt die Nachrichten 12 bis 18 an Illustrator. Verwende dieselben Nachrichtennummern wie bei `/goto`, aufsteigend und mit höchstens 200 Nachrichten. Ausgeblendete Nachrichten bleiben ausgeschlossen. Das Bild wird an die letzte sichtbare Nachricht im Bereich angehängt; die Prompt-Prüfung behält diese Auswahl auch bei neu eintreffenden Nachrichten. Frühere Nachrichten bleiben mit aktiviertem Advanced Memory verfügbar. Ohne `range=` bleibt das gewohnte Verhalten für die aktuelle Szene erhalten. Ein optional eingegebener Prompt wird wie bisher direkt verwendet.

Um die nächste Antwort zu lenken, hängst du deine Vorgabe hinter `/guided`:

```
/guided make him confess he is lying
```

In einem Roleplay-Gruppenchat wählst du mit `/guided respond for [name] [direction (optional)]` den antwortenden Charakter. Zum Beispiel:

```
/guided respond for "Powers That Be" describe the approaching storm
```

Mit `/as [name] [message (optional)]` postest du Text im Namen eines Charakters. Lässt du die Nachricht weg, generiert das Modell stattdessen die nächste Antwort dieses Charakters:

```
/as Dottore "The experiment begins."
/as Dottore
```

Der Befehl `/roll` versteht Würfelnotation. So würfelst du zwei sechsseitige Würfel:

```
/roll 2d6
```

Ein Modifikator ist ebenfalls möglich, etwa `/roll 1d20+5`. Steht nach `/roll` nichts, würfelt Marinara `1d20`.

Ein Sprite ist ein Charakterbild auf der Bühne, das einen Gesichtsausdruck zeigt. Mit `/emote` wechselst du, welches davon zu sehen ist. Tipp `/emote` allein ein, um die verfügbaren Gesichtsausdrücke zu sehen, oder nenne einen davon direkt:

```
/emote joy
```

Für einen bestimmten Charakter verwendest du `/emote "[name]" [expression (optional)]`, etwa `/emote "Powers That Be" joy`. Lass den Gesichtsausdruck weg, um die verfügbaren Gesichtsausdrücke dieses Charakters aufzulisten.

Der Wechsel klappt nur in einem Roleplay-Chat, in dem Sprites hochgeladen sind. Wie du sie hinzufügst, steht unter [Charakter-Sprites](../characters/sprites.md).

Deine Persona ist der Charakter, der dich im Chat vertritt; in Prompts steht dafür `{{user}}`. Der Befehl `/impersonate` schreibt eine Antwort an deiner Stelle. Eine Richtungsvorgabe kannst du direkt anhängen:

```
/impersonate ask about the weather
```

In **Conversation**-Chats stehen `/impersonate` und `/impersonate_prompt` nicht zur Verfügung. Ausführlich beschrieben sind gelenkte Generierung und Impersonation unter [Gelenkte Generierung und Impersonate](guided-and-impersonate.md).

## Befehle für den Conversation Mode

Diese Befehle funktionieren ausschließlich in einem **Conversation**-Chat.

| Befehl | Was er macht |
|---|---|
| `/games` | Öffnet die Auswahl der installierten Conversation-Spiele. `/game` und `/play` machen dasselbe. |
| `/selfie [name (optional)]` | Generiert ein Selfie mit dem installierten Illustrator-Agenten. Ergänze einen Namen, um einen Charakter auszuwählen. |
| `/uno` | Startet eine Partie UNO mit den Charakteren im Chat. |
| `/chess` | Startet eine Schachpartie zu zweit mit einem Charakter. |
| `/poker` | Startet eine Runde Texas Hold'em mit den Charakteren. |
| `/8ball` | Startet eine 8-Ball-Poolpartie zu zweit mit einem Charakter. `/pool` macht dasselbe. |
| `/status [online\|idle\|dnd\|offline\|clear] [name (optional)]` | Setzt den Anwesenheitsstatus eines Charakters oder hebt ihn auf. |

`/uno`, `/chess`, `/poker` und `/8ball` öffnen jeweils den Einrichtungsbildschirm des Spiels. Pro Chat läuft immer nur ein Spiel gleichzeitig. Regeln und Optionen findest du unter [Tischspiele](../conversation/table-games.md).

Mit `/status` überschreibst du die Anwesenheit eines Charakters. Möglich sind `online`, `idle`, `dnd` (bitte nicht stören) und `offline`. `clear` entfernt die Überschreibung wieder. So setzt du den Charakter auf abwesend:

```
/status idle
```

Sind mehrere Charaktere im Chat, hängst du den Namen hinten an, etwa `/status online Alice`.

## Verwandte Anleitungen

- [Nachrichten-Aktionen](messages.md)
- [Gelenkte Generierung und Impersonate](guided-and-impersonate.md)
- [Tischspiele](../conversation/table-games.md)
- [Makros](../prompts/macros.md)
