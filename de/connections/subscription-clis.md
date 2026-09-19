# Abo-Verbindungen für Claude, ChatGPT und Grok

In dieser Anleitung erfährst du, wie die drei Verbindungen funktionieren, die sich über ein Konto statt über einen API-Key anmelden: **Claude (Subscription)**, **OpenAI (ChatGPT)** und **Grok CLI (Subscription)**. Du installierst ein kleines Kommandozeilen-Programm, meldest dich einmal an, und Marinara Engine nutzt dieses Konto zum Chatten. Ein Kommandozeilen-Programm (CLI) ist ein Programm, das du per Befehl in einem Terminal-Fenster startest.

## Was Abo-Verbindungen sind

Die meisten Verbindungen in Marinara Engine laufen über einen API-Key. Ein API-Key ist eine geheime Zeichenfolge, ähnlich einem Passwort. Du fügst sie in die Verbindung ein, damit der KI-Dienst dein Konto abrechnen kann.

Bei diesen drei Verbindungen läuft es anders: Sie nutzen eine lokale Anmeldung statt eines API-Keys. Du meldest dich auf dem eigenen Rechner in einer CLI an, und Marinara verwendet genau diese Anmeldung weiter. In Marinara selbst fügst du nichts ein.

Eine Abo-Verbindung lohnt sich, wenn dein Konto den Zugriff über eine dieser CLIs bereits enthält:

- **Claude (Subscription)** nutzt dein Anthropic-Abo **Pro** oder **Max**.
- **OpenAI (ChatGPT)** nutzt dein ChatGPT-Konto.
- **Grok CLI (Subscription)** nutzt dein Konto bei **SuperGrok** oder **X Premium+**.

## Was du vorher brauchst

Welches Konto nötig ist, hängt vom Anbieter ab.

- **Claude (Subscription)** braucht einen Claude-Tarif, den die Abo-Anmeldung von Claude Code unterstützt.
- **OpenAI (ChatGPT)** unterstützt berechtigte kostenlose und kostenpflichtige ChatGPT-Tarife. Die Nutzungsgrenzen fallen je nach Tarif unterschiedlich aus.
- **Grok CLI (Subscription)** braucht SuperGrok oder X Premium+.

Bei allen drei Anbietern muss die CLI auf demselben Rechner installiert und angemeldet sein, auf dem der Marinara-Server läuft. Das ist nicht der Browser oder das Handy, mit dem du Marinara ansiehst. Marinara startet die CLI lokal, deshalb muss die Anmeldung direkt neben dem Server liegen.

Läuft Marinara auf deinem eigenen Computer, ist dieser Computer der Server. Läuft es auf einem anderen Rechner oder in Docker, installiere die CLI dort und melde dich dort an.

## Claude (Subscription)

Dafür brauchst du ein Anthropic-Abo Pro oder Max. Es ist dieselbe Anmeldung, die auch Visual Studio Code und andere Anthropic-Werkzeuge verwenden.

1. Installiere die Claude Code CLI auf dem Rechner, auf dem Marinara läuft:

```
npm i -g @anthropic-ai/claude-code
```

2. Melde dich einmal an:

```
claude auth login
```

3. Öffne in Marinara das Panel **Connections** (Verbindungen) und klick auf **New** (Neu).
4. Gib im Fenster **Create Connection** (Verbindung erstellen) einen Namen ein, wähle den Anbieter **Claude (Subscription)** und klick auf **Create** (Erstellen).
5. Im Editor gibt es weder ein Feld **API Key** noch ein Feld **Base URL**. Ein Info-Panel bestätigt, dass beides nicht nötig ist.
6. Wähle im Dropdown-Menü **Model** (Modell) ein Claude-Modell, etwa ein Opus- oder Sonnet-Modell.
7. Klick auf **Save** (Speichern) und danach auf **Send Test Message** (Testnachricht senden). Kommt eine kurze Antwort zurück, funktioniert die Anmeldung.

Claude-Abo-Verbindungen unterstützen ausschließlich Text-Chat. Diese Verbindung hat zwei zusätzliche Bedienelemente, **Fast Mode** und **Diagnose Model Routing**, die weiter unten beschrieben sind.

## OpenAI (ChatGPT)

Dafür brauchst du ein ChatGPT-Konto. Marinara leitet den Chat über die Anmeldung der Codex CLI.

1. Installiere die Codex CLI auf dem Rechner, auf dem Marinara läuft:

```
npm i -g @openai/codex
```

2. Melde dich einmal an:

```
codex login
```

3. Öffne in Marinara das Panel **Connections** und klick auf **New**.
4. Gib im Fenster **Create Connection** einen Namen ein, wähle den Anbieter **OpenAI (ChatGPT)** und klick auf **Create**.
5. Wähle im Dropdown-Menü **Model** ein Modell. Die Liste stammt aus der ChatGPT-Sitzung, sofern verfügbar, sonst aus einer eingebauten Liste.
6. Klick auf **Save** und danach auf **Send Test Message**, um eine Antwort zu bestätigen.

Marinara liest die lokale Codex-Anmeldedatei und frischt die Sitzung auf, sobald das möglich ist.

## Grok CLI (Subscription)

Dafür brauchst du ein Konto bei SuperGrok oder X Premium+.

1. Installiere die Grok CLI auf dem Rechner, auf dem Marinara läuft:

```
curl -fsSL https://x.ai/cli/install.sh | bash
```

2. Melde dich einmal an:

```
grok login
```

3. Öffne in Marinara das Panel **Connections** und klick auf **New**.
4. Gib im Fenster **Create Connection** einen Namen ein, wähle den Anbieter **Grok CLI (Subscription)** und klick auf **Create**.
5. Wähle ein Modell, oder lass das Feld **Model** leer, dann greift der Standard der CLI. Für Roleplay ist meist `grok-composer-2.5-fast` die sicherste Wahl.
6. Klick auf **Save** und danach auf **Send Test Message**. Diese Verbindung führt den Test auch ohne gesetztes Modell aus.

Zwei Dinge sind bei der Grok CLI besonders. Sie beherrscht kein Streaming, die Antwort erscheint also am Stück statt Wort für Wort. Und das Kontextfenster liegt standardmäßig bei 32000 Tokens, also niedriger als bei anderen Anbietern, weil sehr große Prompts an das eigene Zug-Limit der CLI stoßen können.

Grok-Modelle lädst du über die Schaltfläche **Fetch Models from Grok CLI** (Modelle aus der Grok CLI laden) im Abschnitt **Model**.

## Dauer des Claude-Prompt-Caches

Im Claude-Verbindungseditor fordert **Prompt Caching → Extended token caching (1 hour)** einen Cache für eine Stunde an, damit längere Pausen zwischen Nachrichten möglich sind. Dafür brauchst du Claude Code **2.1.242 oder neuer**. Marinara übergibt die Einstellung nur für diese Anfrage und ändert deine gespeicherten Claude-Einstellungen nicht.

Ist der Schalter aus, gilt Claudes Standard für Hauptkonversationen und Agent-SDK-Anfragen: derzeit eine Stunde bei Abo-Nutzung innerhalb der Tarifgrenzen und fünf Minuten bei zusätzlicher Nutzung, Guthaben oder API-Abrechnung. Claude Codes eigene Subagents verwenden ohne separate Konfiguration fünf Minuten; ausgewählte serverseitig gesteuerte Hilfsanfragen können eine Stunde verwenden. Vorhandene CLI-Umgebungsvariablen, die diesen Wert überschreiben, haben weiterhin Vorrang. Siehe [Prompt-Caching in Claude Code](https://code.claude.com/docs/en/prompt-caching).

Die Debug-Logs unterscheiden anhand der SDK-Nutzungsdaten zwischen Cache-Schreibvorgängen für fünf Minuten und eine Stunde. Die Kostenäquivalente verwenden die üblichen API-Token-Multiplikatoren, nicht deine Abo-Rechnung. Meldet das SDK keine Aufschlüsselung nach Cache-Dauer, bleibt die Schätzung unbekannt.

## Warum es kein Feld für den API-Key gibt

Bei allen drei Abo-Anbietern sind die Felder **API Key** und **Base URL** ausgeblendet. Das ist Absicht. Die Anmeldung steckt in der CLI auf dem Server-Rechner, in Marinara gibt es also nichts einzutippen.

Hast du versehentlich den falschen Anbieter gewählt und siehst deshalb kein Key-Feld, wechsle im Anbieter-Raster zurück zum gewünschten Anbieter. Bei API-basierten Anbietern erscheint das Key-Feld wieder.

## Fast Mode (nur Claude)

Der Editor von **Claude (Subscription)** enthält den Abschnitt **Fast Mode** mit einem einzigen Schalter, **Use Claude Code fast-mode routing**. Er ist standardmäßig aus.

Lass ihn aus. Die App selbst beschreibt die Funktion als derzeit wirkungslos. Sie fragt bei Claude Code eine schnellere Modellklasse an, doch die aktuellen Claude-Modelle bieten so etwas nicht mehr. Einschalten bringt nichts und kostet womöglich zusätzliche Zeit. Der Schalter bleibt nur für den Fall in der Oberfläche, dass Anthropic die Funktion zurückbringt.

Beim Versuch, ihn einzuschalten, erscheint ein Dialogfenster mit dem Titel **YOU DON'T WANT THIS SETTING ON!**. Wähle dort **Keep it off**.

## Diagnose Model Routing (nur Claude)

Der Editor von **Claude (Subscription)** hat im Testbereich die Schaltfläche **Diagnose Model Routing** (Modell-Routing prüfen). Nutze sie, wenn du ein bestimmtes Claude-Modell angefragt hast, aber ein kleineres vermutest.

1. Wähle ein Modell und klick auf **Save**. Die Schaltfläche bleibt gesperrt, solange kein Modell gewählt ist.
2. Klick auf **Diagnose Model Routing**.
3. Lies das Ergebnis. Marinara schickt einen echten Prompt durch die Claude-Code-Anmeldung. Danach meldet es, welches Modell deinem Konto tatsächlich berechnet wurde.

So fällt eine stille Herabstufung auf: Du forderst ein größeres Modell wie Opus an und bekommst klammheimlich Sonnet oder Haiku.

## Diese Einschränkungen solltest du kennen

- Diese Verbindungen setzen ein kostenpflichtiges Abo voraus, und die CLI muss auf dem Server-Rechner angemeldet sein.
- Embeddings gibt es bei keiner der drei. Die semantische Lorebook-Suche und Memory Recall brauchen dafür eine eigene Verbindung.
- **Claude (Subscription)** unterstützt ausschließlich Text-Chat.
- **Grok CLI (Subscription)** beherrscht kein Streaming und startet mit einem kleineren Kontextfenster.
- **Send Test Message** braucht ein zuvor gewähltes Modell – außer bei der Grok CLI, die auch ohne testen kann.

## Verwandte Anleitungen

- [Mit einem KI-Anbieter verbinden](connecting-to-a-provider.md)
- [Unterstützte KI-Anbieter](providers-reference.md)
