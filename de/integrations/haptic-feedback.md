# Haptisches Feedback einrichten

Mit haptischem Feedback schickt ein KI-Charakter während eines Chats Berührungsimpulse an ein angeschlossenes haptisches Gerät (ein intimes Spielzeug). In dieser Anleitung erfährst du, wie du die Begleit-App installierst, den Agenten **Haptic Feedback** einem Chat hinzufügst, dich mit deinem Gerät verbindest und die Einstellungen für Berührungen anpasst.

Marinara Engine spricht das Gerät nicht direkt an. Es schickt Befehle an die kostenlose Begleit-App **Intiface Central**, die dann dein Gerät steuert. Intiface Central beherrscht **Buttplug.io**, einen offenen Standard, den viele Spielzeuge und Apps unterstützen. Marinara verbindet sich über eine Netzwerkadresse mit der App. Haptisches Feedback ist ein Chat-Agent (ein KI-Helfer, den du einem Chat hinzufügst). Es funktioniert in Conversation, Roleplay und Game Mode.

## Bevor du loslegst

1. Installiere **Intiface Central** von `https://intiface.com/central/`.
2. Öffne die App und starte ihren Server mit der Schaltfläche zum Serverstart.
3. Kopple dein Gerät in Intiface Central, damit die App es sieht.

Läuft Intiface Central nicht mit gestartetem Server, kann Marinara keine Berührungsimpulse schicken. Außerdem muss der Agent **Haptic Feedback** installiert sein. Siehe [Agenten im Überblick](../agents/agents-overview.md).

## Den Haptic-Feedback-Agenten hinzufügen

1. Öffne einen Conversation-, Roleplay- oder Game-Chat.
2. Öffne **Chat Settings** (Chat-Einstellungen) und wechsle zu **Agents**.
3. Füge den Agenten **Haptic Feedback** hinzu. In der Liste **Agents** erscheint eine Karte **Haptic Feedback**.
4. Schalte oben auf der Karte den Schalter **Haptic Feedback** an.

Standardmäßig ist der Schalter aus. Ist er aus, steht in der Beschreibung „Allow this agent to send touch cues during the chat.“ Ist er an, steht dort „Touch cues are enabled for this chat.“ Bei eingeschaltetem Schalter schickt die KI beim Schreiben verdeckte Berührungsimpulse. Als Chat-Text erscheinen sie nicht. Sie gehen an jedes verbundene Gerät.

## Verbinden und suchen

Öffnest du die Karte, versucht Marinara, sich über die gespeicherte Adresse mit Intiface Central zu verbinden. Die Statuszeile zeigt einen grünen Punkt, wenn eine Verbindung besteht, und einen roten, wenn nicht. Daneben steht **Connect** (Verbinden), solange keine Verbindung besteht, und **Disconnect** (Trennen), sobald sie steht.

1. Klick auf **Connect**. Klappt es, zeigt die Zeile „Connected“ samt Serveradresse.
2. Klick auf **Scan for devices** (nach Geräten suchen), um erneut zu suchen. Während der Suche steht auf der Schaltfläche „Scanning...“.

Die Karte zeigt „No devices found“ oder die Anzahl der Geräte und listet jedes mit seinem exakten Intiface-Namen und den unterstützten Aktionen auf. Marinara gibt dem Haptic Agent außerdem diesen Namen, einen aus den Fähigkeiten des Geräts abgeleiteten Spielzeugtyp und seine Aktionen weiter. So wählt er das richtige Gerät und die richtige Aktion, statt anzunehmen, dass jedes Spielzeug vibriert.

Wenn es nicht funktioniert hat: Schlägt die Verbindung fehl, erscheint eine Meldung mit einem Link zur Website von Intiface Central. Sie bittet dich zu prüfen, ob Intiface Central läuft und sein Server gestartet ist.

## Unterstützte Aktionen und Muster

Marinara nutzt jede Ausgabeart, die Intiface für ein Gerät meldet: Vibration, Rotation, Oszillation, Verengung, Aufblasen, lineare Position, Temperatur, Sprühen und Beleuchtung. Die lineare Position steuert streichende, stoßende oder pumpende Geräte. Das Aufblasen steuert Geräte mit Luftdruckpumpe.

Der Agent kann die Muster **Steady**, **Tap**, **Pulse**, **Wave**, **Ramp** oder **Impact** auf jede Aktion anwenden, die kein Stopp-Befehl ist. Positionsmuster wechseln zwischen echten Bewegungszielen ab, sodass ein Pump- oder Streichmuster über die Zeit abläuft, statt mehrere Bewegungen auf einmal zu senden.

## Das Feld Intiface URL

**Intiface URL** ist die WebSocket-Adresse deines Intiface-Central-Servers. Eine WebSocket-Adresse ist ein Link, über den sich die beiden Apps unterhalten. Der Standard lautet:

```text
ws://127.0.0.1:12345
```

`127.0.0.1` bedeutet: genau dieser Computer. Bleibt das Feld leer, nutzt Marinara den Standard des Servers, den du mit der Umgebungsvariable `INTIFACE_URL` in `.env` ändern kannst. Siehe die [Referenz zur Server-Konfiguration](../CONFIGURATION.md). Marinara speichert deine Adresse mit dem Chat und merkt sie sich in diesem Browser, sodass andere Chats, die du hier öffnest, mit ihr beginnen.

Die Adresse bleibt in dieser Marinara-Installation. Chat-Exporte, exportierte Einstellungsprofile und Dateien aus **Export Profile** (Profil exportieren) lassen sie weg, und der Import dieser Dateien setzt sie nie. Trag sie erneut ein, nachdem du einen Chat in eine andere Installation umgezogen hast.

Läuft Marinara in Docker oder öffnest du es im Browser eines anderen Geräts, erreicht `127.0.0.1` Intiface Central nicht. Trag die Adresse des Computers ein, auf dem die App läuft, und ersetze die Zahlen durch seine echte Adresse:

```text
ws://192.168.1.50:12345
```

## Berührungsempfindlichkeit

Die Karte zeigt in jedem Chat-Modus das Bedienelement **Touch sensitivity** (Berührungsempfindlichkeit). Es lenkt, wie bereitwillig der Agent sanfte oder starke Ausgaben wählt. Eine Obergrenze ist es nicht: Jede Stufe kann den vollen Intensitätsbereich `0.0-1.0` nutzen, wenn die Aktion es verlangt. Marinara prüft jeden Befehl gegen den physischen Bereich von Intiface.

| Stufe | Wirkung |
| --- | --- |
| **Subtle** | Bevorzugt sanfteres Feedback. |
| **Standard** | Ausgewogenes Feedback für die meisten Szenen. Das ist der Standard. |
| **Intense** | Wählt eher stärkeres Feedback. |

## Beiläufige Berührungen

Der Schalter **Incidental contact** (beiläufige Berührung) mit der Beschreibung „Tiny taps for accidental brushes and bumps.“ ist standardmäßig aus. Ist er aus, ignoriert die KI kleine, zufällige Berührungen und schickt Impulse nur bei bewusstem oder festem Kontakt. Schalte ihn an, wenn auch Streifen und Anstoßen kleine Impulse auslösen sollen.

<a id="use-it-from-another-device"></a>

## Von einem anderen Gerät aus nutzen

Standardmäßig nimmt Marinara haptische Befehle nur von dem Computer an, auf dem der Marinara-Server läuft. So bleibt die Gerätesteuerung privat. Deshalb funktioniert haptisches Feedback nicht, wenn du Marinara vom Handy oder von einem anderen Gerät aus öffnest, das auf einen Server an einem anderen Ort zugreift. Verbinden, Suchen und Befehle werden abgelehnt.

Um das zu erlauben, aktivierst du die Server-Einstellung `HAPTICS_ALLOW_REMOTE` und richtest einen Zugriffsschutz ein: eine Anmeldung oder ein Admin-Secret. Siehe die [Referenz zur Server-Konfiguration](../CONFIGURATION.md) und die [Anleitung zum Fernzugriff](../REMOTE_ACCESS.md). Den Admin-Zugang trägst du unter **Settings → Advanced → Admin Access** ein.

## Wenn etwas nicht funktioniert

Löst die KI dein Gerät nie aus, prüf der Reihe nach:

1. Intiface Central ist geöffnet und sein Server ist gestartet.
2. Dein Gerät ist gekoppelt und erscheint nach **Scan for devices** in der Liste.
3. Der Statuspunkt ist grün und der Schalter **Haptic Feedback** ist an.
4. Bist du am Handy oder an einem entfernten Gerät, siehe [Von einem anderen Gerät aus nutzen](#use-it-from-another-device).

Ist Intiface Central nicht verbunden oder kein Gerät angeschlossen, überspringt Marinara den Impuls stillschweigend und zeigt im Chat keinen Fehler an.

## Verwandte Anleitungen

- [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md)
- [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md)
- [Fernzugriff: Anmeldung und IP-Allowlist](../REMOTE_ACCESS.md)
