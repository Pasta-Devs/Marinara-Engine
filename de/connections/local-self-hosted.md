# Ein lokales oder selbst gehostetes Modell verbinden

In dieser Anleitung erfährst du, wie du Marinara Engine mit einem KI-Modell verbindest, das auf deinem eigenen Rechner oder Server läuft, über ein Programm wie Ollama, LM Studio, KoboldCpp oder llama.cpp. Zum kleinen Modell, das Marinara ohne separaten Server selbst ausführt, siehe [Eingebautes Modell einrichten](local-model.md).

## Eine Custom-Verbindung einrichten

In der App heißt diese Art von Konto **OpenAI-compatible** (OpenAI-kompatibel). Das bedeutet, dass der Server dasselbe Anfrageformat akzeptiert wie die Chat-API von OpenAI. Ollama, LM Studio, KoboldCpp und llama.cpp tun das alle.

Bevor du anfängst, installiere einen Modellserver, starte ihn und lade ein Modell darin. Lade zum Beispiel Ollama von `ollama.com` herunter und folge seinen Schritten, um ein Modell zu holen. Marinara verbindet sich mit dem Server, startet ihn aber nicht für dich. Der Server beantwortet Anfragen unter einer Webadresse auf deinem Rechner, dem sogenannten Endpunkt.

1. Klick in der oberen Leiste auf **Connections** (Verbindungen) und dann auf **Add** (Hinzufügen). Das Fenster **Add account** (Konto hinzufügen) öffnet sich.
2. Klick unter **Chat** auf deinen Server: **Ollama**, **LM Studio**, **KoboldCpp** oder **llama.cpp**. Diese Kacheln tragen die Markierung **Self-hosted**. Für jeden anderen Server klick auf **OpenAI-compatible address** (OpenAI-kompatible Adresse).
3. Prüf **Server address** (Serveradresse). Bei den vier genannten Servern ist sie schon eingetragen. Bei einem anderen Server tippst du seine Adresse ein. Siehe die Tabelle unten.
4. Lass **API key (optional)** leer. Die meisten lokalen Server brauchen keinen Key. Um dem Konto einen Namen zu geben, tipp ihn unter **Name (optional)** ein.
5. Klick auf **Connect** (Verbinden). Marinara testet die Adresse. **Connected** bedeutet, dass Marinara den Server erreicht hat.
6. Wie es weitergeht, hängt davon ab, ob du schon ein Main-Modell hast. Hast du keines oder hast du Add aus einem neuen Chat geöffnet, zeigt das Fenster die Modelle, die dein Server meldet. Wähl eines oder tipp eine Modell-ID in **Search or enter model ID…** (Modell-ID suchen oder eingeben) und klick dann auf **Done** (Fertig). Hast du schon ein Main-Modell, schließt sich das Fenster, und eine Meldung sagt, dass das Konto hinzugefügt wurde. Klick dann am Konto auf **⋯** und wähl **Add model** (Modell hinzufügen).

Das Panel zeigt jetzt das Konto. Teste es, bevor du dich darauf verlässt (siehe [Die Verbindung testen](#test-the-connection)).

Wenn es nicht funktioniert hat:

- **Marinara could not reach** die Adresse. Prüf, ob der Server läuft und ob Adresse und Port stimmen. **Continue anyway** (trotzdem fortfahren) speichert das Konto ohne bestandenen Test.
- Die Adresse liegt auf einem anderen Rechner. Siehe [Einen Server auf einem anderen Rechner erreichen](#reach-a-server-on-another-computer).

## Adressen verbreiteter lokaler Server

Ein Port ist der nummerierte Kanal, den ein Server auf deinem Rechner belegt. `localhost` bedeutet „genau dieser Rechner“. Laufen Marinara und der Server auf demselben Rechner, funktionieren diese Adressen deshalb unverändert.

| Server | Adresse |
| --- | --- |
| Ollama | `http://localhost:11434/v1` |
| LM Studio | `http://localhost:1234/v1` |
| KoboldCpp | `http://localhost:5001/v1` |
| llama.cpp | `http://localhost:8080/v1` |

In **Edit model** (Modell bearbeiten) warnt das Adressfeld: „Only use URLs from providers you trust. A malicious endpoint could intercept your messages and API keys.“ Trag nur eine Adresse ein, die du selbst eingerichtet hast oder der du voll vertraust.

Unter Windows kann ein laufender Server trotzdem blockiert sein. Erkennt Marinara ihn nicht, blockiert ihn womöglich die Windows Defender Firewall. Öffne **Windows Security → Firewall & network protection → Allow an app through firewall** (Windows-Sicherheit → Firewall- und Netzwerkschutz → Zugriff von App durch Firewall zulassen) und füge Node.js oder dein Serverprogramm hinzu.

<a id="test-the-connection"></a>

## Die Verbindung testen

**Connect** hat die Adresse bereits geprüft. Für eine zweite Prüfung hat der Modell-Editor die Karte **Provider tests** (Anbietertests).

1. Klick im Panel **Connections** auf dein Modell. Der Modell-Editor öffnet sich.
2. Klick auf **Test provider** (Anbieter testen). Das prüft, ob die Adresse erreichbar ist, und zeigt, wie lange es gedauert hat.
3. Wähl ein Modell, falls noch keines gesetzt ist, und klick dann auf **Send test message** (Testnachricht senden). Das schickt eine kurze Nachricht und zeigt die Antwort.

Bestehen beide Tests, öffne einen Chat und wähl das Konto in **Model for this chat** (Modell für diesen Chat). Siehe [Ein Modell für einen einzelnen Chat wählen](connecting-to-a-provider.md#choosing-a-model-for-one-chat).

Schlägt ein Test fehl, prüf, ob der Server läuft und ein Modell geladen hat und ob Adresse und Port genau stimmen. Bei einem Server auf einem anderen Rechner prüf die Schritte unten.

<a id="reach-a-server-on-another-computer"></a>

## Einen Server auf einem anderen Rechner erreichen

Adressen wie `localhost` und `127.0.0.1` funktionieren immer. Liegt dein Modellserver auf einem anderen Rechner in deinem Netzwerk, blockiert Marinara diese private Adresse standardmäßig. Die Person, die den Marinara-Server betreibt, kann sie mit einer Umgebungsvariable freigeben, einer Einstellung, die der Server beim Start ausliest.

1. Öffne die `.env`-Datei des Servers. Bei einer normalen Installation liegt sie im Marinara-Projektordner. Für Docker und Podman siehe [Referenz zur Server-Konfiguration](../CONFIGURATION.md#edit-the-env-file).
2. Ergänze diese Zeile:

```
PROVIDER_LOCAL_URLS_ENABLED=true
```

3. Speichere die Datei und starte den Marinara-Server neu.
4. Nutze die Adresse des anderen Rechners, etwa `http://192.168.1.50:11434/v1`.

Unter Android ist diese Einstellung standardmäßig an, solange du sie nicht setzt.

## Das Modell für Entscheidungen nutzen

Dasselbe Modell kann auch Entscheidungsfragen beantworten, etwa Aktivierungsprüfungen für Agenten, ohne dass eine zweite Kopie geladen wird. Klick im Panel am Modell auf **⋯** und wähl **Use this model for decisions** (dieses Modell für Entscheidungen verwenden). Die Option erscheint bei einem OpenAI-kompatiblen Modell mit Modellnamen. Siehe [Decision-Modelle](decision-models.md#on-a-server-you-already-run).

## Der Schalter Treat as local/custom endpoint

In **Edit model** sitzt unter **Local / custom endpoint** ein Schalter namens **Treat as local/custom endpoint** (als lokalen/eigenen Endpunkt behandeln). Er ist standardmäßig aus. Er erscheint nur bei älteren Modellen, die an kein Konto gebunden sind. Bei Modellen, die du jetzt hinzufügst, erscheint er nie.

Schalte ihn für einen Proxy oder einen selbst gehosteten Server ein, der kein bekannter Dienst ist. Dann versucht Marinara Tool-Aufrufe immer, und Professor Mari darf statt ausschließlich nativer Tool-Aufrufe ein Ersatzverfahren für Tools nutzen (ein JSON-Tool-Protokoll). Schalte ihn ein, wenn Professor Mari nach einem Tool-Einsatz stehen bleibt oder wenn dein Server zwar OpenAI-Kompatibilität verspricht, Tool-Aufrufe aber nicht gut beherrscht. Funktioniert dein Modell ohne ihn, lass ihn aus.

## Verwandte Anleitungen

- [Verbindung zu einem KI-Anbieter herstellen](connecting-to-a-provider.md)
- [Eingebautes Modell einrichten](local-model.md)
- [Decision-Modelle](decision-models.md)
- [Referenz zur Server-Konfiguration](../CONFIGURATION.md)
