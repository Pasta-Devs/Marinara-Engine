# Ein lokales oder selbst gehostetes Modell verbinden

In dieser Anleitung erfährst du, wie du Marinara Engine mit einem KI-Modell verbindest, das auf dem eigenen Rechner oder dem eigenen Server läuft. Sie behandelt verbreitete lokale Modellserver wie Ollama, LM Studio und KoboldCpp – und die Einstellungen, mit denen sie funktionieren.

## Was „selbst gehostet“ bedeutet

Ein selbst gehostetes Modell läuft auf Hardware, die dir gehört. Du installierst einen lokalen Modellserver, dieser Server lädt ein Modell und beantwortet Anfragen unter einer Webadresse auf deinem Rechner. Marinara Engine spricht dann mit dieser Adresse statt mit einem kostenpflichtigen Cloud-Dienst.

Zu den verbreiteten lokalen Modellservern zählen Ollama, LM Studio und KoboldCpp. Jeder davon läuft auf dem eigenen Rechner und stellt einen privaten Endpoint bereit. Ein Endpoint ist die Webadresse, unter der ein Server auf Anfragen wartet.

Diese Anleitung dreht sich um externe lokale Server, die du selbst installierst und startest. Marinara bringt außerdem ein eigenes kleines Modell mit, das keinen separaten Server braucht. Wenn du lieber das nutzen möchtest, hilft die Anleitung [Einrichtung des lokalen Modells](local-model.md) weiter.

Achte vorab darauf, dass der lokale Modellserver bereits installiert ist, läuft und ein Modell geladen hat. Marinara startet diesen Server nicht – es verbindet sich nur damit.

## Eine Custom-Verbindung einrichten

Marinara verbindet sich mit lokalen Servern über den Anbieter **Custom (OAI-Compatible)**. „OAI-kompatibel“ heißt: Der Server versteht dasselbe Anfrageformat wie die OpenAI Chat Completions API. Ollama, LM Studio und KoboldCpp bieten dieses Format alle an.

So legst du die Verbindung an:

1. Öffne rechts in der App das Panel **Connections** (Verbindungen).
2. Klick auf **Add** (Hinzufügen). Das Fenster **Add account** (Konto hinzufügen) geht auf.
3. Wähle in Schritt 1 **Custom (OAI-Compatible)**. Es steht unter **On your computer** (auf deinem Rechner).
4. Trag in Schritt 2 im Feld **Address** (Adresse) die Adresse des lokalen Servers ein (siehe Tabelle unten).
5. Lass das Feld **API key** leer. Die meisten lokalen Server brauchen keinen API-Key – also keinen geheimen Zugangscode, ähnlich einem Passwort. Willst du der Verbindung einen Namen wie `Ollama Local` geben, öffne **More options** (Weitere Optionen) und tipp ihn unter **Name (optional)** ein.
6. Klick auf **Connect** (Verbinden).
7. Wähle in Schritt 3 ein Modell aus der Liste, die der Server meldet. Möglich ist auch, eine Modell-ID von Hand einzutippen. Klick auf **Done** (Fertig).

Die Verbindung erscheint jetzt im Panel **Connections**, ihr Modell darunter gruppiert. Prüfe sie, bevor du sie in einem Chat einsetzt. Wie das geht, steht unten im Abschnitt „Die Verbindung prüfen“.

Das Feld **API Key** ist bei lokalen Servern optional. Beim Anbieter **Custom (OAI-Compatible)** blendet der Editor unter diesem Feld einen Hinweis ein: Für lokale Modelle wie Ollama, LM Studio und KoboldCpp darf der Key leer bleiben. Es genügt, stattdessen die **Address** zu setzen.

## Base URLs verbreiteter lokaler Server

Die **Address** (auch Base URL genannt) sagt Marinara, wo der lokale Server lauscht. Jeder Server hat eine Standardadresse und einen Standardport. Ein Port ist der nummerierte Kanal, den ein Server auf dem Rechner belegt. Nimm die Adresse des Servers, den du betreibst.

| Lokaler Server | Endpunkt |
|---|---|
| Ollama | `http://localhost:11434/v1` |
| LM Studio | `http://localhost:1234/v1` |
| KoboldCpp | `http://localhost:5001/v1` |

`localhost` bedeutet hier „genau dieser Rechner“. Läuft Marinara auf demselben Rechner wie der Modellserver, funktionieren diese Adressen unverändert.

Beim Feld **Address** steht ein Sicherheitshinweis: "Only use URLs from providers you trust. A malicious endpoint could intercept your messages and API keys." Trag also nur eine Adresse ein, die du selbst eingerichtet hast oder der du voll vertraust.

### Hinweis zur Windows-Firewall

Unter Windows kann ein lokaler Server blockiert sein, obwohl er läuft. Der Editor zeigt beim Anbieter **Custom (OAI-Compatible)** folgenden Hinweis: Wird der Proxy oder der lokale Server nicht erkannt, blockiert womöglich die Windows Defender Firewall die Verbindung. Abhilfe: Öffne Windows-Sicherheit, dann Firewall- und Netzwerkschutz, dann „Zugriff von App durch Firewall zulassen“, und füge Node.js oder die Server-Anwendung hinzu.

## Der Schalter Treat as local/custom endpoint

Der Verbindungs-Editor enthält den Bereich **Local / Custom Endpoint** mit dem Schalter **Treat as local/custom endpoint** (als lokalen/eigenen Endpoint behandeln). Standardmäßig ist er aus. Aktiviere ihn für selbst gehostete oder über einen Proxy laufende Endpoints – besonders bei einer eigenen Webadresse, die auf einen Modellserver im lokalen Netzwerk zeigt.

Ist der Schalter aus, geht Marinara bei Modellen, die es nicht kennt, vorsichtig mit Tool-Aufrufen um. Aktiviert weist er Marinara an, Tool-Aufrufe immer zu versuchen. Außerdem nutzt Professor Mari dann ein Ersatzverfahren für Tools (ein JSON-Tool-Protokoll) statt ausschließlich nativer Tool-Aufrufe. Professor Mari ist die Assistentin in der App.

Aktiviere den Schalter, wenn Professor Mari nach einem Tool-Einsatz stehen bleibt. Aktiviere ihn ebenso, wenn der Endpoint zwar OpenAI-Kompatibilität verspricht, Tool-Aufrufe aber nicht zuverlässig beherrscht. Läuft das lokale Modell auch ohne ihn rund, kann er aus bleiben.

## Einen Server auf einem anderen Rechner erreichen

Verbindungen zum eigenen Rechner erlaubt Marinara immer. Adressen wie `localhost` und `127.0.0.1` heißen Loopback-Adressen und bedeuten „genau dieser Rechner“. Sie funktionieren für eine Verbindung stets ohne zusätzliche Einrichtung.

Läuft der Modellserver auf einem anderen Rechner im Heim- oder Büronetz, handelt es sich um eine private Netzwerkadresse. Solche Adressen blockiert Marinara aus Sicherheitsgründen standardmäßig. Zum Freischalten muss die Person, die den Marinara-Server betreibt, eine Umgebungsvariable setzen. Eine Umgebungsvariable ist eine Einstellung, die der Server beim Start ausliest.

Ergänze diese Zeile in der Datei `.env` des Servers:

```
PROVIDER_LOCAL_URLS_ENABLED=true
```

Speichere die Datei und starte den Marinara-Server neu, damit die Änderung greift. Danach darf die Base URL auf einen anderen Rechner im Netzwerk zeigen, etwa `http://192.168.1.50:11434/v1`.

Unter Android ist diese Einstellung standardmäßig aktiv, solange du sie nicht setzt. Mehr zur Datei `.env` und zu den Server-Einstellungen steht in der [Referenz zur Server-Konfiguration](../CONFIGURATION.md).

## Die Verbindung prüfen

**Connect** hat die Verbindung beim Hinzufügen bereits geprüft. Für eine zweite Prüfung sitzt ganz unten im Modell-Editor die Karte **Connection Tests** (Verbindungstests). Nutze sie, bevor du dich im Chat auf die Verbindung verlässt.

1. Klick im Panel **Connections** auf dein Modell. Der Modell-Editor öffnet sich.
2. Klick auf **Test Connection** (Verbindung testen). Das prüft, ob Base URL und Einrichtung erreichbar sind, und meldet die benötigte Zeit.
3. Wähle ein Modell, falls noch keines gesetzt ist.
4. Klick auf **Send Test Message** (Testnachricht senden). Das schickt das Wort „hi“ an das gewählte Modell und zeigt die Antwort.

Bestehen beide Tests, lässt sich das lokale Modell im Chat verwenden. Öffne einen Chat, öffne dessen Einstellungen und wähle diese Verbindung, oder nutze das Menü **Connections** im Eingabebereich des Chats.

Dasselbe Modell kann auch Entscheidungen beantworten, etwa Aktivierungsfragen für Agenten, ohne dass Marinara eine zweite Kopie lädt. Klick in den Verbindungseinstellungen auf **Use this model for decisions** (dieses Modell für Entscheidungen verwenden); siehe [Entscheidungsmodelle](decision-models.md#on-a-server-you-already-run).

Schlägt ein Test fehl, prüfe zuerst, ob der lokale Server noch läuft und das Modell geladen ist. Prüfe dann, ob die **Address** exakt zu Adresse und Port des Servers passt. Bei einem Server auf einem anderen Rechner gilt zusätzlich: Vergewissere dich, dass `PROVIDER_LOCAL_URLS_ENABLED` gesetzt ist und dass du den Marinara-Server neu gestartet hast.

## Verwandte Anleitungen

- [Mit einem KI-Anbieter verbinden](connecting-to-a-provider.md)
- [Einrichtung des lokalen Modells](local-model.md)
- [Entscheidungsmodelle](decision-models.md)
- [Referenz zur Server-Konfiguration](../CONFIGURATION.md)
