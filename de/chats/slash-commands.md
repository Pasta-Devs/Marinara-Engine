# Referenz der Slash-Befehle

Ein Slash-Befehl ist eine Abkürzung, die du mit `/` beginnend ins Nachrichtenfeld tippst, um schnell etwas zu erledigen. Manche ändern sofort die Anzeige. Andere lassen das Modell etwas schreiben.

## So funktionieren Slash-Befehle

1. Tipp den Befehl unten im Chat ins Nachrichtenfeld.
2. Klick auf **Send** (Senden) oder drück <kbd>Enter</kbd>, wenn **Send on Enter** (mit Enter senden) für deinen Chat-Modus an ist. Siehe [Nachrichten senden und streamen](sending-and-streaming.md#send-on-enter).

Sobald du `/` tippst, erscheint über dem Feld ein Menü mit passenden Befehlen. Jede Zeile zeigt das Befehlsformat und eine kurze Beschreibung. Klick auf eine Zeile, um sie ins Feld einzusetzen, ergänze bei Bedarf weiteren Text und schick ihn ab. Auch der Platzhaltertext des Feldes weist auf die Befehle hin: **Write your response, / for commands** in Roleplay und „Message @Alice, / for commands“ in Conversation.

In den Tabellen steht das Format jedes Befehls in seiner Zeile. Ersetze Platzhalter in eckigen Klammern wie `[name]` oder `[range]` durch deine eigenen Werte und tippe die Klammern nicht mit. Mit `(optional)` markierte Angaben kannst du weglassen. Ein `|` trennt Alternativen. Viele Befehle haben kürzere Aliasse, etwa `/cont` für `/continue`. Um alle Befehle in der App zu sehen, tippst du:

```text
/help
```

Manche Befehle laufen in deinem Browser und kosten nichts. Andere lassen das Modell Text schreiben. Das läuft über dein Konto und verbraucht unter Umständen Tokens (die Einheiten, die Dienste zählen und abrechnen).

Slash-Befehle funktionieren in den Nachrichtenfeldern von Conversation und Roleplay. In Game funktioniert nur ein bloßes `/illustrate` (oder `/ill`) ohne Bereich und ohne Prompt, und auch nur, wenn Game-Illustrationen mit einem Bildkonto eingerichtet sind. Alles andere, was mit einem Schrägstrich beginnt, wird als normaler Text gesendet. In Roleplay und Conversation brauchen die Befehle `/illustrate`, `/selfie` und `/video` den Illustrator-Agenten und erscheinen nur, wenn er installiert ist.

Mehrere Befehle arbeiten mit Nachrichtennummern. Marinara zählt ab der ersten Nachricht im Chat als Nummer 1. `/goto`, `/hide` und `/unhide` verwenden diese Nummern. **Show message numbers** (Nachrichtennummern anzeigen) blendet sie ein. Siehe [Aktionen für Nachrichten](messages.md#message-display-toggles).

## Befehle für Chat und Nachrichten

Diese Befehle funktionieren in Conversation und Roleplay.

| Befehl | Was er macht |
| --- | --- |
| `/help` | Listet alle Slash-Befehle auf. |
| `/send` | Postet eine Nachricht im Namen deiner Persona, ohne eine Antwort anzufordern. Makros werden eingesetzt, wie bei **Send**. Format: `/send [message]`. |
| `/continue` | Hängt weiteren Text an die letzte KI-Antwort an, ohne neue Nachricht. Auch `/cont`. **Settings → General → Responses → Add a new line before /continue text** legt fest, ob der Text nach einer Leerzeile beginnt oder direkt an der Abbruchstelle. |
| `/goto` | Scrollt den Chat zu einer Nachrichtennummer. Auch `/jump`, `/scroll`. Format: `/goto [number]`. |
| `/hide` | Verbirgt Nachrichten in kommenden Zügen vor dem Modell. Format: `/hide [range] [name (optional)]`. |
| `/unhide` | Holt global verborgene Nachrichten zurück. Format: `/unhide [range]`. |
| `/sys` | Fügt eine Systemnachricht ein. Sie erscheint im Chat und lenkt das Modell, aber kein Charakter spricht sie. Auch `/system`. Format: `/sys [message]`. |
| `/macros` | Listet Prompt-Makros wie `{{user}}` und `{{char}}` auf. Auch `/macro`. |
| `/remind` | Stellt einen Timer und postet dann eine Erinnerung im Chat. Auch `/reminder`, `/timer`. Format: `/remind [time] [message]`. |

Beispiele:

```text
/goto 27
/hide 3-8
/remind 30m check the oven
```

`/hide` und `/unhide` nehmen eine einzelne Nummer, einen Bereich oder eine Mischung: `/hide 5`, `/hide 3-8`, `/hide 2-5,9,12`. Verborgene Nachrichten bleiben im Chat, aber das Modell liest sie nicht.

Füg in Roleplay nach dem Bereich einen Charakternamen hinzu, um die Nachrichten nur vor diesem Charakter zu verbergen. Andere Charaktere behalten den Zugriff.

```text
/hide 3-8 Maukie
/hide 2-5,9 "Powers That Be"
```

Setz Namen mit Leerzeichen in Anführungszeichen. Die älteren Formen mit dem Namen zuerst, etwa `/hide Maukie 3-8`, funktionieren weiterhin. Passt ein Name zu mehreren Charakteren, verwende den vollständigen Namen. Setz numerische Namen in Anführungszeichen, um sie von Nachrichtennummern zu unterscheiden, etwa `/hide 1 "123"`. Um das Verbergen vor bestimmten Charakteren zu prüfen oder aufzuheben, nutzt du in einem Roleplay-Gruppenchat die Avatar-Auswahl bei **Hide from AI** (vor der KI verbergen) an der Nachricht, in einem Chat mit nur einem Charakter **Unhide from AI** (für die KI wieder einblenden). `/unhide` hebt nur das globale Verbergen auf.

`/remind` erwartet eine Zeitangabe mit `h` (Stunden), `m` (Minuten) oder `s` (Sekunden) und dann eine Nachricht. Die Erinnerung lebt in deiner Browser-Sitzung. Lass den Tab also offen, bis sie fällig wird.

## Befehle für Story und Roleplay

| Befehl | Was er macht |
| --- | --- |
| `/guided` | Lenkt die nächste Antwort. Auch `/narrator`, `/narrate`, `/nar`. Format: `/guided [direction]`. |
| `/as` | Postet eine Nachricht als Charakter oder bittet diesen Charakter um eine Antwort. Auch `/respond`. Format: `/as [name] [message (optional)]`. |
| `/emote` | Listet Gesichtsausdrücke eines Sprites auf oder wechselt sie. Auch `/emotion`, `/sprite`. Format: `/emote [expression]`. |
| `/roll` | Würfelt und postet das Ergebnis. Auch `/r`, `/dice`. Format: `/roll [dice (optional)]`. |
| `/random` | Bittet das Modell, ein überraschendes Ereignis einzubauen. Auch `/rand`, `/event`. |
| `/scene` | Startet eine Roleplay-Szene, die sich von der Conversation abzweigt. Auch `/rp`. Format: `/scene [description (optional)]`. |
| `/illustrate` | Nur Roleplay. Generiert ein Galeriebild. Braucht den Illustrator-Agenten. Auch `/ill`. Format: `/illustrate [range=N-M] [prompt]`. |
| `/html` | Nur Roleplay. Erstellt am Ende der neuesten Antwort ein Artefakt aus der Spielwelt, zum Beispiel `a spellbook page`. Format: `/html [what you want]`. |
| `/video` | Nur Roleplay. Erstellt unter der neuesten Antwort einen kurzen Clip dieser Antwort oder deiner Beschreibung. Folgt Illustrators Einstellung **First frame** (Startbild). Braucht Illustrator. Format: `/video [description]`. |
| `/impersonate` | Schreibt eine Antwort im Namen deiner Persona. Auch `/imp`. Format: `/impersonate [direction (optional)]`. |
| `/impersonate_prompt` | Legt die Anweisung fest, die `/impersonate` in diesem Chat verwendet. Auch `/imp_prompt`. Format: `/impersonate_prompt [prompt or reset]`. |

Die meisten davon funktionieren in Roleplay am besten. `/scene` wird aus einer Conversation heraus ausgeführt. `/impersonate` und `/impersonate_prompt` stehen in Conversation nicht zur Verfügung.

### Eine Antwort lenken

```text
/guided make him confess he is lying
/guided respond as "Powers That Be" describe the approaching storm
```

Statt `respond as` funktionieren auch `reply as` und `respond for`. Siehe [Geführte Generierung und Impersonate](guided-and-impersonate.md).

### Als Charakter posten

Lässt du die Nachricht weg, schreibt das Modell die nächste Antwort dieses Charakters.

```text
/as Dottore "The experiment begins."
/as Dottore
```

### Würfeln

`/roll 2d6` würfelt zwei sechsseitige Würfel. Du kannst einen Modifikator ergänzen, etwa `/roll 1d20+5`. Ohne weitere Angabe würfelt `/roll` `1d20`. Um nur einen Teil der Würfel zu zählen, hänge `kh` (höchste behalten) oder `kl` (niedrigste behalten) und eine Zahl an: `/roll 4d6kh3` addiert die drei höchsten, und `/roll 2d20kl1` behält den niedrigeren von zwei. `dl` und `dh` entfernen stattdessen die niedrigsten oder höchsten, etwa bei `/roll 4d6dl1`. Würfel, die nicht zählen, werden weiterhin angezeigt, aber abgeblendet.

### Ein Sprite wechseln

Ein Sprite ist ein Charakterbild, das einen Gesichtsausdruck zeigt. Tipp `/emote` allein, um die verfügbaren Gesichtsausdrücke zu sehen, oder nenne einen davon:

```text
/emote joy
/emote "Powers That Be" joy
```

Mit einem Namen und ohne Gesichtsausdruck listet der Befehl die Gesichtsausdrücke dieses Charakters auf. Er braucht einen Roleplay-Chat mit hochgeladenen Sprites. Siehe [Charakter-Sprites](../characters/sprites.md).

### Illustrieren und Artefakte erstellen

`/illustrate range=12` illustriert Nachricht 12. `/illustrate range=12-18` übergibt die Nachrichten 12 bis 18 an Illustrator. Verwende dieselben Nachrichtennummern wie bei `/goto`, aufsteigend und mit höchstens 200 Nachrichten. Verborgene Nachrichten bleiben außen vor. Das Bild wird an die letzte sichtbare Nachricht im Bereich angehängt. Frühere Nachrichten bleiben mit eingeschaltetem Advanced Memory verfügbar. Ohne `range=` arbeitet der Befehl mit der aktuellen Szene. Ein Prompt, den du eintippst, wird unverändert verwendet.

`/html a terminal readout` braucht keinen Agenten und funktioniert unabhängig davon, ob **HTML Artifacts** (HTML-Artefakte) an ist. Der Erzähler kann dasselbe mit `[html: prompt="..."]` anfordern, wenn **HTML Artifacts** unter **Roleplay Commands** an ist. Siehe [Artefakte auf Abruf](../roleplay/getting-started.md#artifacts-on-demand).

### Deine Antwort schreiben

`/impersonate ask about the weather` schreibt eine Antwort im Tonfall deiner Persona. Deine Persona ist der Charakter, der dich vertritt; in Prompts steht dafür `{{user}}`. Diese beiden Befehle stehen in Conversation nicht zur Verfügung.

## Befehle für den Conversation Mode

Diese Befehle funktionieren nur in einem Conversation-Chat.

| Befehl | Was er macht |
| --- | --- |
| `/games` | Öffnet die Auswahl der installierten Spiele. `/game` und `/play` machen dasselbe. |
| `/selfie` | Generiert ein Selfie mit dem Illustrator-Agenten. Ergänze einen Namen, um einen Charakter auszuwählen. Format: `/selfie [name (optional)]`. |
| `/video` | Lässt einen Charakter eine kurze Videonachricht schicken, mit den Einstellungen unter **Video messages** (Videonachrichten) dieses Chats. Siehe [Videonachrichten](../conversation/selfies.md#video-messages). Format: `/video [name (optional)]`. |
| `/uno` | Startet eine Partie UNO mit den Charakteren im Chat. |
| `/chess` | Startet eine Schachpartie zu zweit mit einem Charakter. |
| `/poker` | Startet eine Runde Texas Hold'em mit den Charakteren. |
| `/8ball` | Startet eine 8-Ball-Poolpartie zu zweit mit einem Charakter. `/pool` macht dasselbe. |
| `/status` | Setzt den Anwesenheitsstatus eines Charakters oder hebt ihn auf. Format: `/status [online, idle, dnd, offline or clear] [name]`. |

Die Spielbefehle öffnen den Einrichtungsbildschirm des jeweiligen Spiels, und jeder erscheint nur, wenn der zugehörige Spiel-Agent installiert ist. In einem Chat kannst du immer nur ein Spiel gleichzeitig spielen. Siehe [Tischspiele in Conversation](../conversation/table-games.md).

`/status` überschreibt die Anwesenheit eines Charakters. Der Status kann `online`, `idle`, `dnd` (bitte nicht stören) oder `offline` sein. `clear` entfernt die Überschreibung. In einem Chat mit mehreren Charakteren hängst du den Namen hinten an.

```text
/status idle
/status online Alice
```
