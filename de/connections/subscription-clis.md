# Abo-Verbindungen für Claude, ChatGPT und Grok

Bei drei Diensten chattest du statt mit einem API-Key über einen Tarif, für den du schon bezahlst: **Claude (Subscription)**, **OpenAI (ChatGPT)** und **Grok CLI (Subscription)**. Du installierst ein kleines Kommandozeilen-Programm (CLI) und meldest dich einmal an. Marinara Engine verwendet diese Anmeldung dann weiter. In Marinara fügst du nichts ein.

Welchen Tarif du brauchst:

- **Claude (Subscription)**: Anthropic Pro oder Max oder einen anderen Tarif, den Claude Code akzeptiert.
- **OpenAI (ChatGPT)**: ein ChatGPT-Konto. Die Nutzungsgrenzen hängen vom Tarif ab.
- **Grok CLI (Subscription)**: SuperGrok oder X Premium+.

## Ein Abo-Konto hinzufügen

Bevor du anfängst: Die CLI muss auf dem Rechner installiert und angemeldet sein, auf dem der Marinara-Server läuft. Das ist nicht das Handy oder der Browser, mit dem du Marinara ansiehst. Läuft Marinara auf einem anderen Rechner oder in Docker, erledige die Schritte 1 und 2 dort. Die `npm`-Befehle brauchen Node.js, das du hast, wenn du Marinara aus dem Quellcode installiert hast. Siehe [Installation](../INSTALLATION.md).

1. Öffne ein Terminal auf dem Rechner, auf dem Marinara läuft. Ein Terminal ist das Fenster, in das du Befehle eintippst. Unter Windows öffnest du PowerShell, unter macOS das Terminal.
2. Führ den Installationsbefehl für deinen Dienst aus und danach seinen Anmeldebefehl. Das Programm zeigt seine eigenen Anmeldeschritte, meist eine Webseite, auf der du dich anmeldest.

| Dienst | Installieren | Anmelden |
| --- | --- | --- |
| Claude | `npm i -g @anthropic-ai/claude-code` | `claude login` |
| ChatGPT | `npm i -g @openai/codex` | `codex login` |
| Grok | siehe unten | `grok login` |

Für Grok zeigt die App diesen Installationsbefehl. Läuft er auf deinem System nicht, folge den Anleitungen von x.ai für die Grok CLI.

```bash
curl -fsSL https://x.ai/cli/install.sh | bash
```

3. Klick in Marinara in der oberen Leiste auf **Connections** (Verbindungen) und dann auf **Add** (Hinzufügen).
4. Klick unter **Chat** auf deinen Dienst. Diese Dienste tragen die Markierung **Sign in**.
5. Das Fenster zeigt **Sign in first** und nennt den Befehl. Ein Key-Feld gibt es nicht. Klick auf **Connect** (Verbinden). Marinara testet die Anmeldung. **Connected** bedeutet, dass sie funktioniert.
6. Wähl ein Modell aus der Liste und klick dann auf **Done** (Fertig). Bei der Grok CLI kannst du das Modell auch leer lassen; dann gilt der eigene Standard der CLI (siehe [Grok CLI (Subscription)](#grok-cli-subscription)).

Schick zur Kontrolle eine Nachricht in einem Chat. Kommt eine Antwort, funktioniert es.

Wenn es nicht funktioniert hat:

- **Marinara could not use the login on this computer.** Die CLI ist auf dem Marinara-Rechner nicht installiert oder nicht angemeldet. Führ dort den Anmeldebefehl aus und klick dann auf **Try again** (erneut versuchen).

## Claude (Subscription)

Ab hier geht es um optionale Einstellungen. Zum Chatten brauchst du sie nicht.

Dieser Dienst nutzt deinen Claude-Tarif über Claude Code. Im Modell-Editor **Edit model** (Modell bearbeiten) hat er drei zusätzliche Bedienelemente: Prompt-Caching, **Fast mode** und **Diagnose model routing** (Modell-Routing prüfen).

### Erweitertes Token-Caching

Mit Prompt-Caching kann Claude den Anfang deines Prompts wiederverwenden, sodass wiederholte Anfragen weniger von deinem Limit verbrauchen. **Prompt caching → Extended token caching (1 hour)** fordert einen Cache für eine Stunde an. Das hilft, wenn du zwischen Nachrichten Pausen machst. Dafür brauchst du Claude Code 2.1.242 oder neuer. Marinara schickt die Einstellung mit der Anfrage mit und ändert deine gespeicherten Claude-Einstellungen nicht.

Ist die Einstellung aus, nutzt Claude seinen eigenen Standard für dein Konto. Siehe [Prompt-Caching in Claude Code](https://code.claude.com/docs/en/prompt-caching).

### Fast mode

**Fast mode → Use Claude Code fast-mode routing** ist standardmäßig aus. Lass es aus. Die Option fragt bei Claude Code eine schnellere Modellklasse an, doch laut App bieten aktuelle Modelle so etwas nicht mehr. Einschalten bringt also nichts und kann zusätzlichen Aufwand verursachen. Versuchst du, sie einzuschalten, erscheint ein Dialogfenster mit dem Titel **Turn on fast mode?**. Klick auf **Keep it off** (ausgeschaltet lassen).

### Modell-Routing prüfen

Nutze **Diagnose model routing**, wenn du ein großes Modell wie Opus angefragt hast, aber vermutest, dass du ein kleineres bekommen hast.

1. Wähl ein Modell. Die Schaltfläche bleibt gesperrt, bis ein Modell gesetzt ist.
2. Klick auf **Diagnose model routing**. Marinara speichert zuerst ungespeicherte Änderungen.
3. Lies das Ergebnis. Marinara schickt einen echten Prompt über deine Claude-Code-Anmeldung und meldet, welches Modell deinem Konto berechnet wurde.

## OpenAI (ChatGPT)

Dieser Dienst nutzt dein ChatGPT-Konto über die Codex CLI. Marinara liest die lokale Codex-Anmeldedatei und frischt die Sitzung auf, wenn es möglich ist.

Wie lange Codex vor der Antwort nachdenkt, stellst du so ein: Öffne **Edit model**, schalte **Use custom defaults for this model** (eigene Standardwerte für dieses Modell verwenden) ein und wähl bei **Reasoning Effort** (Denkaufwand) eine Stufe. Anfangs steht dort **Default** (Standard); damit bleibt die Stufe, die Codex selbst für das Modell nutzt. Ein Chat kann unter **Advanced Parameters** (Erweiterte Parameter) eine eigene Stufe wählen. Die Stufe in einem Preset ändert daran nichts. Ein als Fallback genutztes Codex-Modell richtet sich nur nach seiner eigenen Stufe, und Agenten auf dem Modell verwenden die Stufe des Modells. Die angezeigten Stufen entsprechen denen, die für das gewählte Modell verfügbar sind.

## Grok CLI (Subscription)

Dieser Dienst führt die Grok CLI auf dem Marinara-Rechner aus. Zwei Dinge sind anders als bei anderen Diensten:

- Er beherrscht kein Streaming. Eine Antwort erscheint am Stück statt Wort für Wort.
- Sein Kontextfenster liegt standardmäßig bei 32.000 Tokens. Tokens sind kleine Textstücke, die Modelle zählen. Große Prompts können an das eigene Zug-Limit der CLI stoßen, deshalb bleibt der Standard niedrig. Am Modell kannst du ein größeres **Max Context Window** (maximales Kontextfenster) einstellen.

Im Modell-Editor lässt **Use the Grok CLI default** (Standard der Grok CLI verwenden) das Modell leer, sodass die CLI ihr eigenes wählt. Der Editor nennt `grok-composer-2.5-fast` als meist sicherstes Modell für Roleplay, weil Marinara die CLI im Headless-Modus ausführt und Groks eigene Tools, Gedächtnis, Websuche, Pläne und Subagents dabei abgeschaltet sind.

## Tarifnutzung

Konten für Claude (Subscription) und OpenAI (ChatGPT) können anzeigen, wie viel von den Limits deines Tarifs du schon verbraucht hast.

1. Klick in der Zeile des Kontos auf **⋯**, wähl **Edit account** (Konto bearbeiten) und öffne **Usage and balance** (Nutzung und Guthaben).
2. Sind externe Abfragen ausgeschaltet, klick auf **Turn on** (einschalten).
3. Schalte **Show the usage meter on the card** (Nutzungsanzeige auf der Karte zeigen) ein und speichere dann.

Jedes Limit-Zeitfenster bekommt einen Balken mit dem verbrauchten Prozentsatz und dem Zeitpunkt des Zurücksetzens, zum Beispiel `58% · resets in 2h`. Dieselben Balken erscheinen in der Verbindungsauswahl eines Chats und in den Einstellungen unter **Connection** (Verbindung) des Chats, solange dieses Konto aktiv ist. Bei **Shuffle** (Zufallsauswahl) erscheinen sie nicht.

- Die Balken zählen alles in deinem Tarif, nicht nur Marinara. Bei Claude gehören Claude Code und claude.ai dazu. Bei ChatGPT gehört jede Codex-Nutzung dazu, etwa die Codex CLI. Chats auf chatgpt.com haben eigene Limits und zählen nicht mit.
- Die Dienste melden für jedes Zeitfenster einen Prozentwert und keine Token-Zahlen.
- Eine Abfrage holt von der CLI auf dem Marinara-Rechner dieselben Daten, die ihr eigener Nutzungsbefehl anzeigt. Sie schickt keine Nachricht an ein Modell und verbraucht nichts von deinem Tarif. Die Aktualisieren-Schaltfläche fragt die Daten erneut ab.
- Ein Tarif mit nur einem Zeitfenster zeigt einen Balken.
- Claude Code kennzeichnet seine Nutzungsdaten als experimentell. Ändert eine neue Version sie, zeigen die Balken einen Fehler und eine Schaltfläche zum erneuten Versuchen statt einer falschen Zahl.

## Grenzen dieser Dienste

- Diese Dienste brauchen einen kostenpflichtigen Tarif (oder einen berechtigten ChatGPT-Tarif) und die angemeldete CLI auf dem Marinara-Rechner.
- Keiner von ihnen bietet Embeddings. Die semantische Lorebook-Suche und Memory Recall brauchen dafür ein eigenes Konto.
- **Send test message** (Testnachricht senden) braucht ein zuvor gewähltes Modell, außer bei der Grok CLI.

## Verwandte Anleitungen

- [Verbindung zu einem KI-Anbieter herstellen](connecting-to-a-provider.md)
- [Unterstützte KI-Anbieter](providers-reference.md)
