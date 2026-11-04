# Nachrichtenübersetzung

Marinara Engine kann Chat-Nachrichten zwischen Sprachen übersetzen. In dieser Anleitung erfährst du, wie du einen Übersetzungsdienst auswählst, die Sprachen festlegst, die automatische Übersetzung einschaltest und eine einzelne Nachricht übersetzt.

Die Übersetzung wird pro Chat eingestellt. Jeder Chat behält seinen eigenen Dienst, seine eigenen Sprachen und Keys. Damit neue Chats mit denselben Einstellungen beginnen, speicherst du sie als [Übersetzungs-Standardwerte](#translator-defaults-for-new-chats).

## Wo die Übersetzungseinstellungen liegen

1. Öffne einen Chat in einem beliebigen Modus (Conversation, Roleplay oder Game).
2. Öffne **Chat Settings** (Chat-Einstellungen).
3. Such den Abschnitt **Translation** (Übersetzung).

Alle unten beschriebenen Einstellungen liegen in diesem Abschnitt.

## Einen Anbieter auswählen

Die Liste **Provider** (Anbieter) bietet vier Optionen.

| Anbieter | Was nötig ist | Hinweise |
| --- | --- | --- |
| **Google Translate** | Nichts | Der Standard. Kostenlos, ohne Key. Bis zu 5.000 Zeichen pro Anfrage. |
| **DeepL API** | Ein DeepL-API-Key | Bessere Qualität. Kostenlose und kostenpflichtige Keys funktionieren beide. |
| **DeepLX (self-hosted)** | Eine DeepLX-Server-URL | Für einen DeepLX-Server, den du selbst betreibst. |
| **AI (via connection)** | Ein KI-Konto | Übersetzt mit einem deiner KI-Modelle. |

Google Translate funktioniert ohne Einrichtung. Wähl einen anderen Anbieter nur, wenn du brauchst, was er bietet.

### Die Sprachen festlegen

Zwei Felder legen die Sprachen fest. Beide stehen standardmäßig auf `en` (Englisch).

- **Model Language** (Sprache des Modells) ist die Sprache, die das KI-Modell versteht und in der es antwortet. Schreibst du in deiner eigenen Sprache, wird deine Nachricht in diese Sprache übersetzt, bevor die KI sie liest. **Translate My Messages** (eigene Nachrichten übersetzen) und **Translate draft** (Entwurf übersetzen) nutzen sie.
- **My Language** (meine Sprache) ist die Sprache, die du liest. KI-Antworten werden in diese Sprache übersetzt. **Auto-Translate Responses** (KI-Antworten automatisch übersetzen) und die Schaltfläche **Translate** (Übersetzen) an jeder Nachricht nutzen sie.

Ein Beispiel: Schreibst du auf Spanisch und arbeitet die KI am besten auf Englisch, setz **Model Language** auf `en` und **My Language** auf `es`.

Bei Google Translate, DeepL API und DeepLX trägst du ein kurzes Kürzel ein, etwa `en`, `ja`, `es`, `de`, `fr`, `zh` oder `ko`. Bei AI (via connection) trägst du den Namen einer Sprache ein, etwa `English`, `Japanese` oder `Spanish`.

Falls es nicht geklappt hat: Ein falsches Kürzel oder ein falscher Name führt zu einem Fehler oder zu unverändertem Text. Prüf das Format für deinen Anbieter.

### DeepL API

Wähl **DeepL API** und füg den Key aus deinem DeepL-Konto in **DeepL API Key** ein. Ein Key, der auf `:fx` endet, gehört zum kostenlosen Tarif, und Marinara schickt ihn an den Gratis-Dienst von DeepL. Jeder andere Key gilt als kostenpflichtig.

```text
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
```

### DeepLX

DeepLX ist ein kostenloser Übersetzungsserver, den du selbst betreibst. Wähl **DeepLX (self-hosted)** und trag die Adresse deines Servers in **DeepLX URL** ein, zum Beispiel `http://localhost:1188`.

Ein DeepLX-Server auf deinem eigenen Rechner oder in deinem lokalen Netzwerk hat eine lokale Adresse. Aus Sicherheitsgründen blockiert Marinara lokale Adressen standardmäßig. Um sie zu erlauben, füg diese Zeile in deine `.env`-Datei ein und speicher sie. Ein Neustart ist nicht nötig. Die Einstellung greift meist innerhalb von Sekunden, spätestens nach etwa 30 Sekunden. Wo die Datei liegt, zeigt die [Referenz zur Server-Konfiguration](../CONFIGURATION.md).

```text
DEEPLX_LOCAL_URLS_ENABLED=true
```

Ein DeepLX-Server unter einer öffentlichen Internetadresse braucht diese Einstellung nicht.

### AI (via connection)

Wähl **AI (via connection)**, um eines deiner KI-Modelle zu nutzen. Dann erscheinen drei Felder.

- **Connection** (Verbindung): welches KI-Konto übersetzt. Das Feld ist Pflicht. Bleibt es leer, schlägt die Übersetzung mit „Connection ID is required for AI translation“ fehl. Siehe [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).
- **Outgoing Message Prompt** (Prompt für ausgehende Nachrichten) und **Incoming Response Prompt** (Prompt für eingehende Antworten): die Anweisungen, die die KI bekommt, wenn sie deine Nachrichten und ihre eigenen Antworten übersetzt. Beide beginnen mit einem eingebauten Standard, den du für diesen Chat bearbeiten kannst. `{{targetLanguage}}` wird zu **Model Language** oder **My Language**. Hast du einen Prompt geändert, setzt **Restore** (Wiederherstellen) ihn zurück. Der Standard-Prompt lautet:

```text
You are a translator. Translate the given text accurately into {{targetLanguage}},
preserving formatting, markdown, and any special characters like *asterisks* for actions.
Output ONLY the translated text, nothing else -- no explanations, no extra commentary.
```

## Automatische Übersetzung einschalten

Unter den Anbieter-Einstellungen sitzen vier Schalter. Alle sind anfangs aus.

- **Auto-Translate Responses**: übersetzt jede KI-Antwort direkt nach der Generierung. Im Game Mode entfernt Marinara vorher die Tags aus der Erzählung, die nur für den Game Master bestimmt sind.
- **Translate My Messages**: übersetzt deine Nachricht in die **Model Language**, kurz bevor sie an die KI geht, und ersetzt dabei deinen getippten Text. Scheitert die Übersetzung, schickt Marinara deinen Originaltext und zeigt einen Fehler.
- **Show Draft Translate Button** (Schaltfläche zum Übersetzen des Entwurfs anzeigen): setzt neben **Send** (Senden) eine Schaltfläche **Translate draft**, damit du die Übersetzung vor dem Absenden prüfen und bearbeiten kannst. Das ist die manuelle Alternative zu **Translate My Messages**.
- **Show Only Translation** (nur Übersetzung anzeigen): zeigt bei einer übersetzten Nachricht die Übersetzung anstelle des Originals statt beider zusammen.

In Conversation kannst du einen noch nicht gesendeten Entwurf jederzeit übersetzen, über die Smiley-Schaltfläche im Eingabefeld und dann **Tools → Translate draft**, am Desktop wie auf dem Handy. Keiner der beiden Schalter muss dafür aktiv sein. Die Aktion nutzt die Eingabe-Übersetzungseinstellungen dieses Chats und ersetzt den Entwurf, damit du ihn prüfen kannst. Gesendet wird dabei nichts. Scheitert die Übersetzung, bleibt der Entwurf, wie er war.

<a id="translator-defaults-for-new-chats"></a>

## Übersetzungs-Standardwerte für neue Chats

**Save translator defaults** (Übersetzungs-Standardwerte speichern) unter den Schaltern speichert die Übersetzungseinstellungen dieses Chats für neue Chats in jedem Modus. Einstellungen aus dem Einrichtungsassistenten und aus einem Einstellungsprofil haben Vorrang. Bestehende Chats behalten ihre eigenen Einstellungen. **Forget saved defaults** (gespeicherte Standardwerte vergessen) löscht sie. [Noodle](../agents/noodle-settings.md#translation) nutzt dieselben Standardwerte.

Der DeepL-API-Key und die DeepLX-URL bleiben in dieser Marinara-Installation. Chat-Exporte, exportierte Einstellungsprofile und Dateien aus **Export Profile** (Profil exportieren) lassen sie weg, und der Import dieser Dateien setzt sie nie. Trag sie erneut ein, nachdem du einen Chat in eine andere Installation umgezogen hast.

## Eine einzelne Nachricht übersetzen

Jede Nachricht, ob von dir oder von der KI, hat in ihrer Aktionsleiste eine Schaltfläche **Translate** mit einem Sprachen-Symbol. Sie funktioniert ohne einen der Schalter von oben.

1. Zeig mit dem Mauszeiger auf die Nachricht oder tipp sie auf dem Handy an, damit ihre Aktionsleiste erscheint.
2. Klick auf **Translate**.
3. Die Übersetzung erscheint unter der Nachricht oder, mit eingeschaltetem **Show Only Translation**, an ihrer Stelle.
4. Klick erneut auf die Schaltfläche, um die Übersetzung auszublenden. Ihre Beschriftung lautet dann **Hide translation**.

Die Übersetzung wird mit der Nachricht gespeichert und übersteht ein Neuladen der Seite und einen Chatwechsel. Sie nutzt denselben Anbieter und dieselbe **My Language** wie der Abschnitt oben.

## Grenzen der Anbieter

- **Google Translate** lehnt Text über 5.000 Zeichen mit „Text too long for Google Translate (max 5000 characters). Use DeepL or AI provider for longer texts.“ ab.
- **DeepL API**, **DeepLX (self-hosted)** und **AI (via connection)** nehmen längeren Text an, bis zu einem Serverlimit von 50.000 Zeichen pro Anfrage.
- **Google Translate**, **DeepL API** und **DeepLX (self-hosted)** brechen nach 15 Sekunden mit einem Fehler ab.
- **AI (via connection)** richtet sich nach dem eigenen Zeitlimit deines KI-Modells, nicht nach der 15-Sekunden-Grenze.
- **DeepLX (self-hosted)** an einer lokalen Adresse bleibt blockiert, solange `DEEPLX_LOCAL_URLS_ENABLED=true` nicht gesetzt ist.

## Verwandte Anleitungen

- [Aktionen für Nachrichten: bearbeiten, löschen, Swipes, neu generieren](../chats/messages.md)
- [Chat Settings im Überblick](../chats/chat-settings.md)
- [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md)
- [Referenz zur Server-Konfiguration](../CONFIGURATION.md)
