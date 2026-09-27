# Nachrichtenübersetzung

Marinara Engine übersetzt Chat-Nachrichten zwischen Sprachen. In dieser Anleitung erfährst du, welche vier Übersetzungs-Anbieter zur Auswahl stehen, wie die automatischen Schalter arbeiten, was die **Translate**-Schaltfläche an jeder Nachricht tut und wo die Grenzen der einzelnen Anbieter liegen.

Die Übersetzung wird pro Chat eingerichtet. Jeder Chat hat einen eigenen Anbieter, eine eigene Zielsprache und eigene API-Keys. Eine Einstellung aus einem Chat gilt nicht automatisch in einem anderen.

## Wo die Übersetzungseinstellungen liegen

1. Öffne einen Chat in einem beliebigen Modus (Conversation, Roleplay oder Game).
2. Öffne für diesen Chat das Panel **Chat Settings** (Chat-Einstellungen).
3. Such den Abschnitt **Translation** (Übersetzung).

Sämtliche Anbieter- und Schalter-Einstellungen, die unten beschrieben sind, sitzen in diesem Abschnitt **Translation**.

## Den Anbieter auswählen

Das Dropdown-Menü **Provider** (Anbieter) bietet vier Optionen:

| Anbieter | Was nötig ist | Hinweise |
|---|---|---|
| **Google Translate** | Nichts | Standard. Kostenlos, ohne API-Key. Maximal 5000 Zeichen pro Anfrage. |
| **DeepL API** | Ein DeepL-API-Key | Bessere Qualität. Kostenlose und kostenpflichtige Keys funktionieren beide. |
| **DeepLX (self-hosted)** | Eine DeepLX-Server-URL | Für eine DeepLX-Instanz, die du selbst betreibst. |
| **AI (via connection)** | Eine KI-Verbindung | Übersetzt über einen deiner KI-Anbieter. |

**Google Translate** ist standardmäßig ausgewählt und braucht keine Einrichtung. Wähle nur dann einen anderen Anbieter, wenn du eine der folgenden Eigenschaften brauchst.

### Target Language

Im Feld **Target Language** (Zielsprache) legst du fest, in welche Sprache übersetzt wird. Der Standard ist `en` (Englisch).

Das Format hängt vom Anbieter ab:

- Bei **Google Translate**, **DeepL API** und **DeepLX (self-hosted)** trägst du ein kurzes Sprachkürzel ein. Beispiele: `en`, `ja`, `es`, `de`, `fr`, `zh`, `ko`.
- Bei **AI (via connection)** trägst du den Namen der Sprache ein. Beispiele: `English`, `Japanese`, `Spanish`.

### DeepL API einrichten

Sobald du **DeepL API** wählst, erscheint das Feld **DeepL API Key**. Füge dort den Key aus deinem DeepL-Konto ein. DeepL-Keys sehen so aus:

```
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
```

Ein Key, der auf `:fx` endet, gehört zum kostenlosen Tarif. Marinara schickt ihn an den Gratis-Dienst von DeepL. Jeder andere Key gilt als kostenpflichtiger Key.

### DeepLX einrichten

DeepLX ist ein kostenloser Übersetzungsserver, den du selbst hostest. Sobald du **DeepLX (self-hosted)** wählst, erscheint das Feld **DeepLX URL**. Trag dort die Adresse deines DeepLX-Servers ein, zum Beispiel:

```
http://localhost:1188
```

Läuft der DeepLX-Server auf dem eigenen Rechner oder im lokalen Netzwerk, ist die Adresse eine lokale Adresse. Aus Sicherheitsgründen blockiert Marinara Anfragen an lokale Adressen standardmäßig. Damit sie durchgehen, trag diese Zeile in die Datei `.env` ein und speichere die Datei:

```
DEEPLX_LOCAL_URLS_ENABLED=true
```

Die Datei `.env` ist die Einstellungsdatei des Servers. Wo sie liegt, steht in der [Server-Konfigurationsreferenz](../CONFIGURATION.md). Ein Neustart des Servers ist nicht nötig. Die Änderung greift innerhalb weniger Sekunden.

Ein DeepLX-Server unter einer öffentlichen Internetadresse braucht diese Einstellung nicht. Blockiert sind standardmäßig nur lokale und private Netzwerkadressen.

### KI-Übersetzung einrichten

Wählst du **AI (via connection)**, übersetzt Marinara über einen deiner KI-Anbieter. Dafür erscheinen zwei zusätzliche Felder.

Im Dropdown-Menü **Connection** (Verbindung) legst du fest, welche KI-Verbindung die Übersetzung übernimmt. Das Feld ist Pflicht. Bleibt es leer, schlägt die Übersetzung mit der Meldung „Connection ID is required for AI translation“ fehl. Eine Verbindung ist ein gespeicherter Eintrag für einen KI-Anbieter. Wie du eine anlegst, steht in der Verbindungs-Anleitung weiter unten.

Das Feld **AI Prompt** enthält den Prompt für die Übersetzung – also den Text, den Marinara an die KI schickt. Ein eingebauter Standardtext steht bereits darin, den du für diesen Chat anpassen kannst. Sobald du etwas änderst, erscheint die Schaltfläche **Restore** (Wiederherstellen) und setzt das Feld auf den eingebauten Standard zurück. Der Standard-Prompt lautet:

```
You are a translator. Translate the given text accurately, preserving formatting, markdown, and any special characters like *asterisks* for actions. Output ONLY the translated text, nothing else -- no explanations, no extra commentary.
```

## Die Schalter für die automatische Übersetzung

Unter den Anbieter-Einstellungen sitzen drei Schalter. Alle drei sind standardmäßig aus.

**Auto-Translate Responses** (KI-Antworten automatisch übersetzen) übersetzt jede KI-Antwort direkt nach der Generierung. Im Game Mode entfernt Marinara vor dem Übersetzen die Tags aus der Erzählung, die nur für den Game Master bestimmt sind.

**Translate My Messages** (eigene Nachrichten übersetzen) übersetzt deine Nachricht in die Zielsprache, kurz bevor sie an die KI geht. Die Übersetzung ersetzt deinen getippten Text. Scheitert sie, schickt Marinara stattdessen den Originaltext und zeigt eine Fehlermeldung.

**Show Draft Translate Button** (Schaltfläche zum Übersetzen des Entwurfs anzeigen) setzt neben die Schaltfläche **Send** eine Schaltfläche **Translate draft**. So kannst du deine Nachricht übersetzen und das Ergebnis vor dem Absenden prüfen oder bearbeiten. Das ist die manuelle Alternative zu **Translate My Messages**, das beim Absenden übersetzt, ohne dass du noch einmal draufschauen kannst.

In **Conversation** kannst du einen noch nicht gesendeten Entwurf jederzeit über die Smiley-Schaltfläche im Eingabefeld → **Tools → Translate draft** (Werkzeuge → Entwurf übersetzen) übersetzen, am Desktop wie auf dem Smartphone. **Show Draft Translate Button** und automatische Übersetzung müssen dafür nicht aktiv sein. Die Aktion nutzt die Eingabe-Übersetzungseinstellungen des Chats und ersetzt den Entwurf zur Prüfung; sie sendet keine Nachricht. Bei einem Fehler bleibt der Entwurf unverändert.

## Die Translate-Schaltfläche an jeder Nachricht

Jede Chat-Nachricht hat in ihrer Aktionsleiste eine Schaltfläche **Translate** (Übersetzen) – egal, ob sie von dir oder von der KI stammt. Die Schaltfläche trägt ein Sprachen-Symbol. Sie arbeitet eigenständig und braucht keinen der Schalter von oben.

1. Zeig mit dem Mauszeiger auf eine Nachricht, damit ihre Aktionsleiste erscheint.
2. Klick auf die Schaltfläche **Translate**.
3. Die Übersetzung erscheint unter der Nachricht.
4. Ein Klick auf dieselbe Schaltfläche blendet die Übersetzung wieder aus. Der Kurzhinweis beim Draufzeigen lautet dann **Hide translation**.

Eine so erzeugte Übersetzung wird mit der Nachricht gespeichert. Sie übersteht ein Neuladen der Seite und ist noch da, wenn du den Chat wechselst und später zurückkommst.

Die Schaltfläche an der Nachricht nutzt denselben Anbieter und dieselbe Zielsprache wie im Abschnitt **Translation**.

## Grenzen der Anbieter

Behalte diese Grenzen im Kopf, wenn du dich für einen Anbieter entscheidest.

- **Google Translate** lehnt Text ab, der länger als 5000 Zeichen ist. Dann erscheint der Fehler „Text too long for Google Translate (max 5000 characters). Use DeepL or AI provider for longer texts.“ Für längeren Text wechsle zu DeepL oder zur KI-Übersetzung.
- **DeepL API**, **DeepLX (self-hosted)** und **AI (via connection)** nehmen längeren Text an, bis zum Serverlimit von 50000 Zeichen pro Anfrage.
- **Google Translate**, **DeepL API** und **DeepLX (self-hosted)** brechen jeweils mit einer Fehlermeldung ab, wenn sie länger als 15 Sekunden brauchen.
- **AI (via connection)** richtet sich nach Modell und Zeitlimit der gewählten Verbindung, nicht nach der 15-Sekunden-Grenze.
- **DeepLX (self-hosted)** an eine lokale Adresse bleibt blockiert, solange `DEEPLX_LOCAL_URLS_ENABLED=true` nicht wie oben beschrieben gesetzt ist.

## Verwandte Anleitungen

- [Nachrichten-Aktionen: Bearbeiten, Löschen, Swipe, neu generieren](../chats/messages.md)
- [Chat Settings im Überblick](../chats/chat-settings.md)
- [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md)
- [Server-Konfigurationsreferenz](../CONFIGURATION.md)
