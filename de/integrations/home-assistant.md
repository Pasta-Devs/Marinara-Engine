# Home-Assistant-Integration

Mit dieser Integration steuern deine KI-Charaktere echte Smart-Home-Geräte direkt aus einem Chat heraus, etwa Licht, Klima, Rollläden und Media-Player. Umgekehrt können Home-Assistant-Automationen Nachrichten an Marinara Engine schicken. Home Assistant ist eine kostenlose Open-Source-Plattform für Smart-Home-Geräte. Nutzt du es nicht, brauchst du diese Anleitung nicht.

## Was die Integration hinzufügt

Die Integration ist ein kleines Programm, das in Home Assistant installiert wird und es mit deinem Marinara-Server verbindet. Beim ersten Einrichten legt sie Folgendes für dich an. Tool-Adressen musst du nie kopieren und Tools nie von Hand einrichten.

- Smart-Home-Tools im Bereich **Functions** (Funktionen) des Presets-Panels. Siehe [Eigene Tools](../extending/custom-tools.md).
- Einen Agenten namens **Home Assistant**, einen KI-Helfer, der neben deinem Chat mitläuft. Siehe [Agenten im Überblick](../agents/agents-overview.md).
- Home-Assistant-Entitäten (Geräte, Sensoren und Bedienelemente), mit denen du Marinara von Home Assistant aus beobachten und steuern kannst.

## Bevor du loslegst

- Home Assistant in Version 2024.1.0 oder neuer.
- HACS, in Home Assistant installiert. HACS ist der Home Assistant Community Store, über den du benutzerdefinierte Integrationen installierst.
- Marinara läuft und ist vom Home-Assistant-Rechner aus erreichbar. Die Standardadresse ist `localhost:7860`.
- `WEBHOOK_LOCAL_URLS_ENABLED=true` in der `.env`-Datei von Marinara.

Die `.env`-Datei ist die Klartext-Einstellungsdatei des Marinara-Servers. Wo sie liegt, steht unter [Server-Konfiguration](../CONFIGURATION.md). Die Integration nutzt einen Webhook, eine Webadresse, über die eine App Daten an eine andere schickt. Der Webhook von Home Assistant ist eine lokale, unverschlüsselte `http`-Adresse, und solche Adressen blockiert Marinara aus Sicherheitsgründen standardmäßig. Diese Einstellung erlaubt sie. Füg diese Zeile hinzu und speicher die Datei. Sie greift ohne Neustart, meist innerhalb von Sekunden (spätestens nach etwa 30 Sekunden):

```text
WEBHOOK_LOCAL_URLS_ENABLED=true
```

### Wenn Home Assistant auf einem anderen Gerät läuft

Die Integration verbindet sich ohne Benutzernamen und Passwort, und im Einrichtungsformular gibt es kein Feld dafür.

- Derselbe Rechner: Die Verbindung klappt sofort.
- Anderes Gerät: Marinara blockiert die Verbindung standardmäßig. Trag die IP-Adresse dieses Geräts (seine Nummernadresse in deinem Netzwerk) in `IP_ALLOWLIST` in `.env` ein. In einem vollständig vertrauenswürdigen Heimnetzwerk kannst du stattdessen `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true` setzen.
- Nutzt Marinara `BASIC_AUTH_USER` und `BASIC_AUTH_PASS` (die Anmeldung), kann sich die Integration nicht anmelden. Sie funktioniert dann nur vom selben Rechner aus oder von einem Gerät in `IP_ALLOWLIST`.

Welche Option die richtige ist, steht unter [Fernzugriff](../REMOTE_ACCESS.md).

## Die Integration installieren

### In HACS hinzufügen

1. Öffne in Home Assistant **HACS**.
2. Öffne das Drei-Punkte-Menü und klick auf **Custom repositories** (eigene Quellen).
3. Trag in das Feld für die Quelle `https://github.com/Pasta-Devs/Marinara-Engine` ein.
4. Setz die Kategorie auf **Integration** und klick auf **Add** (Hinzufügen).
5. Such nach **Marinara Engine** und installier die Integration.
6. Starte Home Assistant neu.

### Einrichten

1. Geh zu **Settings → Devices & Services** (Einstellungen → Geräte und Dienste) und klick auf **Add Integration** (Integration hinzufügen).
2. Such nach **Marinara Engine**.
3. Trag unter **Host** und **Port** ein, wo Marinara läuft. Die Standardwerte sind `localhost` und `7860`.
4. Klick auf **Submit** (Absenden).

Falls es nicht geklappt hat: Home Assistant zeigt einen Fehler, wenn es Marinara nicht erreicht. Siehe [Fehlerbehebung](#troubleshooting).

Klappt die Einrichtung, registriert die Integration einen privaten Webhook in Home Assistant, legt im Bereich **Functions** von Marinara die Tools an, die auf diesen Webhook zeigen, legt den Agenten **Home Assistant** mit allen aktivierten Tools an und erstellt die unten beschriebenen Entitäten.

## Den Agenten zu einem Chat hinzufügen

Dass der Agent angelegt ist, heißt nicht, dass er in jedem Chat mitläuft. Füg ihn jedem Chat hinzu, in dem du die Smart-Home-Steuerung nutzen willst.

1. Öffne den Chat und klick auf **Chat Settings** (Chat-Einstellungen).
2. Öffne den Bereich **Agents** (Agenten).
3. Füg den Agenten **Home Assistant** hinzu.

Er funktioniert in Roleplay-, Conversation- und Game-Chats. Sobald er hinzugefügt ist, stehen der KI in diesem Chat die Tools zur Verfügung. Sonst musst du nichts einschalten.

### Prüfen, ob es funktioniert

1. Tipp in diesem Chat eine ganz normale Bitte ein, zum Beispiel `Turn on the office lights`, und schick sie ab.
2. Die KI sollte ein Tool wie `ha_turn_on` aufrufen, das Licht sollte angehen, und die KI bestätigt es.

Passiert nichts, prüf, ob `WEBHOOK_LOCAL_URLS_ENABLED=true` gesetzt ist, und sieh unter [Fehlerbehebung](#troubleshooting) nach.

## Festlegen, welche Tools die KI nutzen darf

Die Tools sind in acht Kategorien sortiert. Um festzulegen, welche davon Marinara nutzen darf, öffne **Settings → Devices & Services**, klick auf **Marinara Engine** und dann auf **Configure** (Konfigurieren). Dort gibt es zwei Optionen:

- **Primary Chat** (Haupt-Chat): der Standard-Chat, auf den die Home-Assistant-Dienste wirken.
- **Exposed Tool Categories** (freigegebene Tool-Kategorien): die Kategorien, die Marinara nutzen darf.

| Kategorie | Standard | Tools |
| --- | --- | --- |
| Lights & Switches | An | ha_turn_on, ha_turn_off, ha_toggle, ha_set_brightness, ha_set_color, ha_set_color_temp |
| Climate | An | ha_set_temperature, ha_set_hvac_mode |
| Covers (Blinds & Garage) | An | ha_open_cover, ha_close_cover, ha_set_cover_position |
| Locks | Aus | ha_lock, ha_unlock |
| Media Players | An | ha_media_play, ha_media_pause, ha_set_volume |
| Scenes & Scripts | An | ha_activate_scene, ha_run_script |
| Query | An | ha_get_state, ha_list_areas, ha_list_entities, ha_notify |
| Generic Service Calls (Advanced) | Aus | ha_call_service |

> **Warnung:** Mit **Generic Service Calls (Advanced)** kann die KI jeden beliebigen Home-Assistant-Dienst aufrufen. Mit **Locks** kann sie Türen ab- und aufschließen. Beides ist standardmäßig aus. Schalte es nur ein, wenn du es wirklich willst.

Die meisten Tools akzeptieren ein einzelnes Gerät oder einen Raumnamen. Bei einem Raumnamen wirkt das Tool auf alle passenden Geräte in diesem Raum. Änderungen an den Kategorien greifen, sobald du **Marinara Sync HA Tools** drückst oder Home Assistant neu startest.

## Entitäten in Home Assistant

Die Integration legt diese Entitäten unter einem Gerät namens **Marinara Engine** an.

| Entität | Typ | Funktion |
| --- | --- | --- |
| Marinara Chat Count | Sensor | Gesamtzahl der Marinara-Chats |
| Marinara Active Agent Count | Sensor | Wie viele Marinara-Agenten aktiviert sind |
| Marinara Active Chat | Select | Legt fest, auf welchen Chat die Dienste wirken |
| Marinara Agent: (Name) | Switch | Schaltet einen Agenten ein oder aus, ein Schalter pro Agent |
| Marinara Abort Generation | Button | Bricht jede gerade laufende KI-Antwort ab |
| Marinara Sync HA Tools | Button | Schickt alle Tools erneut und baut den Home-Assistant-Agenten neu auf |

Die Integration fragt alle 30 Sekunden bei Marinara nach neuen Chats und Agenten. Was du gerade angelegt hast, kann also bis zu 30 Sekunden brauchen, bis es hier erscheint.

### Nach Einstellungsänderungen synchronisieren

Drück auf der Geräteseite von **Marinara Engine** auf **Marinara Sync HA Tools**. Das aktualisiert bestehende Tools an Ort und Stelle, baut den Agenten **Home Assistant** neu auf, falls du ihn gelöscht hast, und deaktiviert Tools aus Kategorien, die du abgeschaltet hast (gelöscht werden sie nicht). Bearbeite die Home-Assistant-Tools in Marinara nicht von Hand. Die nächste Synchronisierung überschreibt deine Änderungen und schaltet die Tools wieder ein.

## Marinara aus Automationen steuern

Die Integration ergänzt zwei Home-Assistant-Dienste für Automationen. Sie laufen in Home Assistant, nicht in Marinara. Beide wirken standardmäßig auf deinen **Primary Chat**.

### Send Message (marinara_engine.send_message)

- `message`: der Nachrichtentext. Pflichtangabe.
- `chat_id`: an welchen Chat gesendet wird. Bleibt das Feld leer, wird der Primary Chat verwendet.
- `role`: `user`, `assistant`, `system` oder `narrator`. Standard ist `user`.
- `trigger_generation`: bei true antwortet die KI zusätzlich. Standard ist false.

Diese Automation meldet der KI, wenn die Haustür aufgeht:

```yaml
automation:
  trigger:
    platform: state
    entity_id: binary_sensor.front_door
    to: "on"
  action:
    service: marinara_engine.send_message
    data:
      message: "Someone has arrived at the front door."
      trigger_generation: true
```

### Trigger Generation (marinara_engine.trigger_generation)

Damit startest du eine KI-Antwort ohne sichtbare Nachricht.

- `chat_id`: welcher Chat. Bleibt das Feld leer, wird der Primary Chat verwendet.
- `user_message`: eine optionale Nachricht, die dem Antwortzug beiliegt.

<a id="troubleshooting"></a>

## Fehlerbehebung

### Das Einrichtungsformular meldet, dass keine Verbindung möglich ist

Prüf, ob Marinara läuft und ob **Host** und **Port** zu der Adresse passen, auf der es lauscht (Standard `localhost` und `7860`). Läuft Home Assistant auf einem anderen Gerät, blockiert Marinara es, solange das Gerät nicht in `IP_ALLOWLIST` steht. Die Integration kann kein Passwort mitschicken, deshalb weist ein per Anmeldung geschütztes Marinara sie ebenfalls ab. Siehe [Fernzugriff](../REMOTE_ACCESS.md). Diese Regeln gelten auch nach der Einrichtung. Blockiert Marinara das Gerät später, hören die Sensoren und die Chatliste still und leise auf, sich zu aktualisieren.

### Die KI versucht ein Geräte-Tool, aber nichts passiert

Wahrscheinlich wird der Webhook-Aufruf blockiert. Trag `WEBHOOK_LOCAL_URLS_ENABLED=true` in `.env` ein und speicher die Datei. Ohne diese Einstellung können Tool-Aufrufe mit einer Meldung scheitern, dass `http` nicht erlaubt ist oder eine private Adresse abgelehnt wurde. Laufen Marinara und Home Assistant auf demselben Rechner, nutzt die Integration automatisch die interne Adresse. Läuft Marinara auf einem anderen Gerät, achte darauf, dass die lokale Adresse von Home Assistant von dort aus erreichbar ist.

### Die Tools erscheinen nicht unter Functions

Drück auf **Marinara Sync HA Tools** oder starte Home Assistant neu. Sieh dann im Presets-Panel unter **Functions** nach.

### Der Home-Assistant-Agent fehlt in meinem Chat

Prüf, ob es den Agenten in Marinara unter Agents gibt. Falls nicht, drück auf **Marinara Sync HA Tools**, um ihn neu aufzubauen. Füg ihn dann unter **Chat Settings → Agents** hinzu.

### Die Webhook-Adresse von Hand finden

Das brauchst du selten, denn jedes Tool hat die Adresse bereits hinterlegt. Öffne in Home Assistant **Settings → Devices & Services → Marinara Engine**. Der Webhook folgt diesem Muster, wobei 8123 der Standard-Port von Home Assistant ist:

```text
http://<homeassistant-ip>:8123/api/webhook/<webhook-id>
```

## Deinstallieren

Lösch die Integration in Home Assistant unter **Settings → Devices & Services → Marinara Engine**. Damit verschwinden die Entitäten. Die Tools im Bereich **Functions** von Marinara und der Agent **Home Assistant** bleiben erhalten. Lösch sie von Hand in Marinara, wenn du sie nicht mehr brauchst.

## Verwandte Anleitungen

- [Eigene Tools](../extending/custom-tools.md)
- [Agenten im Überblick](../agents/agents-overview.md)
- [Server-Konfiguration](../CONFIGURATION.md)
- [Fernzugriff](../REMOTE_ACCESS.md)
