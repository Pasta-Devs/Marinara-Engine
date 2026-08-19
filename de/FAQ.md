# Häufige Fragen

Hier findest du Antworten auf die Fragen, die zu Marinara Engine am häufigsten gestellt werden. Die Antworten sind nach Themen sortiert. Zu jeder gibt es einen Link auf die ausführliche Anleitung.

## Wie erreiche ich Marinara Engine vom Handy oder von einem anderen Gerät aus?

Marinara Engine läuft als lokaler Server auf einem Computer. Geöffnet wird die App im Webbrowser. Diese Antwort erklärt den Zugriff von Handy, Tablet oder einem anderen Computer im selben Netzwerk.

Die Startskripte (`start.sh`, `start.bat` und `start-termux.sh`) binden den Server bereits an alle Netzwerkschnittstellen (`0.0.0.0`). Andere Geräte erreichen den Server also über das Netzwerk – die Zugriffskontrolle blockiert sie aber standardmäßig. Solange du den Zugriff auf dem Host-Computer nicht eingerichtet hast, sieht ein entferntes Gerät nur eine Seite mit dem Hinweis **Access blocked** (Zugriff blockiert) und einer Einrichtungsanleitung.

So geht’s:

1. Lass Marinara auf dem Host-Computer laufen.
2. Richte auf dem Host-Computer die Zugriffskontrolle ein: entweder Basic Auth (Benutzername und Passwort) oder eine IP-Allowlist (eine Liste erlaubter Geräteadressen). [Fernzugriff](REMOTE_ACCESS.md) erklärt beide Wege – samt einer Ausnahme für vollständig vertrauenswürdige private Netzwerke.
3. Ermittle die lokale IP-Adresse des Host-Computers. Unter Windows führst du diesen Befehl aus und liest die **IPv4 Address** ab:

```
ipconfig
```

Unter macOS oder Linux führst du diesen Befehl aus:

```
hostname -I
```

4. Öffne auf dem anderen Gerät einen Webbrowser und rufe die Host-IP samt Port auf. Der Standard-Port ist `7860`:

```
http://192.168.1.42:7860
```

Ersetze `192.168.1.42` durch die eigene Host-IP-Adresse.

5. Melde dich an, falls der Browser nach Benutzername und Passwort für Basic Auth fragt. Erscheint stattdessen die Seite **Access blocked**, fehlt noch Schritt 2 auf dem Host.

Bei gewöhnlichen Desktop-Installationen brauchst du auf demselben Computer (`127.0.0.1`) kein Passwort. Von der APK verwaltete Android-Installationen fügen eine private Anmeldung für localhost hinzu, damit sich keine andere Android-App als Marinara ausgeben kann; der Android-Wrapper erzeugt und verwendet diese Zugangsdaten jedoch automatisch. Andere Geräte bleiben blockiert, bis du die Zugriffskontrolle einrichtest (Basic Auth oder eine IP-Allowlist). Beide Wege erklärt [Fernzugriff](REMOTE_ACCESS.md).

Liegen die beiden Geräte nicht im selben Netzwerk, hilft ein Werkzeug wie Tailscale. Tailscale gibt jedem Gerät eine feste private Adresse. Damit verbindest du dich von überall, ohne Marinara im öffentlichen Internet freizugeben. Klappt die Verbindung nicht, hilft [Fehlerbehebung](TROUBLESHOOTING.md) weiter.

## Gibt es eine Handy-App für Marinara?

Eine eigene native Handy-App gibt es nicht. Auf Handy und Tablet nutzt du dieselbe Web-App im Browser. Die meisten mobilen Browser bieten **Add to Home Screen** (Zum Startbildschirm hinzufügen) oder **Install App** (App installieren) an – damit fühlt sich Marinara wie eine echte App an, ganz ohne Browserleiste. Das nennt sich PWA (Progressive Web App, eine Website, die sich wie eine App installieren lässt).

Unter Android kannst du außerdem [die neueste APK direkt herunterladen](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). Marinara läuft damit über Termux lokal auf dem Handy. Für die Installation brauchst du weder Signaturschlüssel noch Passwort oder Geheimwert für den lokalen Zugriff; die nötigen Android-Berechtigungsabfragen erklärt die [Android-Installation](installation/android-termux.md). Für iPhone und iPad gibt es die [iOS-PWA-Anleitung](installation/ios-pwa.md).

Der Android-Wrapper meldet sich automatisch bei seinem von der APK verwalteten Termux-Server an. Die privaten Zugangsdaten werden nur sichtbar, wenn du den Server absichtlich in einem anderen Browser auf demselben Handy öffnest: Öffne `/android-login`, führ in Termux `cat ~/.marinara-engine/android-secret` aus und füge den angezeigten Wert ein. Die lokale `mari`-CLI liest denselben vom Launcher verwalteten Geheimwert automatisch. Manuelle Termux-Installationen behalten die normalen Regeln für localhost und Netzwerkzugriff.

## Was sind die drei Chat-Modi?

Marinara hat drei Chat-Modi, die beim Öffnen der Chatliste als Tabs erscheinen:

- **Conversation**: ein Chat im Stil von SMS oder Direktnachrichten, so als würdest du einem Charakter im Messenger schreiben.
- **Roleplay**: eine dichte Story-Szene mit Erzählung, Charakter-Avataren und optionalen Charakterbildern.
- **Game Mode**: ein geführtes Textabenteuer unter der Leitung eines Game Masters, mit optionalen Szenenbildern und Videos.

Jeder Modus hat seine eigene Einstiegsanleitung. Fang mit dem Modus an, der dich interessiert, und arbeite dich dann durch die vertiefenden Anleitungen.

## Wie ändere ich die Zeitzone für Conversation-Zeitpläne?

Öffne einen Conversation-Chat und wähle in den **Chat Settings** (Chat-Einstellungen) den Punkt **Schedule timezone** (Zeitzone für Zeitpläne). Alternativ legst du sie beim Anlegen der Zeitpläne im Conversation-Einrichtungsablauf fest. Marinara übernimmt zunächst die Zeitzone des Geräts; du kannst jede unterstützte IANA-Zeitzone auswählen oder mit **Use device** auf die Gerätezeitzone zurückspringen. Diese Einstellung gilt global für alle Conversation-Chats, auch für autonome Nachrichten vom Server, und sie synchronisiert sich auf alle Geräte am selben Marinara-Server.

## Brauche ich einen API-Key für Marinara?

Fast immer ja. Eine **Verbindung** ist ein gespeicherter Eintrag, der Marinara den Weg zu genau einem KI-Dienst zeigt: welcher Anbieter, welches Modell und die Zugangsdaten dafür. Ein **API-Key** ist ein geheimer Zugangscode, ähnlich einem Passwort. Du bekommst ihn von einem KI-Anbieter, damit Marinara in deinem Namen mit diesem Anbieter sprechen kann.

Ohne mindestens eine Verbindung startet kein Chat. Öffne zum Anlegen das Panel **Connections** (Verbindungen), klick auf **New**, wähle einen Anbieter, füge den **API Key** ein und wähle ein Modell. Die vollständige Anleitung steht in [Mit einem KI-Anbieter verbinden](connections/connecting-to-a-provider.md).

Ein paar Anbieter kommen ganz ohne API-Key aus. Die Abo-Optionen (Claude, ChatGPT und Grok) melden sich stattdessen über ein Kommandozeilenwerkzeug an, und das eingebaute Local Model läuft ohne Key auf dem eigenen Rechner.

## Welche KI-Anbieter werden unterstützt?

Marinara unterstützt viele Anbieter. Pro Verbindung wählst du genau einen aus.

Für Chat- und Roleplay-Text stehen zur Wahl: **OpenAI**, **OpenAI (ChatGPT)**, **Anthropic**, **Claude (Subscription)**, **Grok CLI (Subscription)**, **Google Gemini**, **Google Vertex AI**, **Mistral**, **Cohere**, **OpenRouter**, **NanoGPT**, **xAI / Grok** sowie **Custom (OAI-Compatible)** für lokale oder selbst gehostete Modelle wie Ollama, LM Studio und KoboldCpp.

Für die Bildgenerierung stehen unter anderem zur Wahl: **OpenAI (DALL-E)**, **Stability AI**, **Together AI**, **NovelAI**, **OpenRouter Images**, **xAI / Grok Imagine**, **Venice.ai**, **Atlas Cloud**, **Pollinations**, **Stable Horde**, **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **RunPod Serverless (ComfyUI)**, **Draw Things**, **NanoGPT** und **Block Entropy**.

Für die Videogenerierung stehen zur Wahl: **Google AI Studio**, **xAI Imagine**, **OpenRouter Video**, **Atlas Cloud**, **Seedance 2.0** und lokale ComfyUI-Workflows im API-Format.

Du kannst beliebig viele Verbindungen gleichzeitig speichern und jedem Chat eine andere zuweisen. Siehe [Mit einem KI-Anbieter verbinden](connections/connecting-to-a-provider.md).

## Kostet die Nutzung von Marinara etwas?

Marinara selbst ist kostenlos und läuft auf dem eigenen Computer. Bezahlt wird nur, was der gewählte KI-Anbieter verlangt – und das unterscheidet sich je nach Anbieter und Modell.

Manche Optionen kosten im Test gar nichts. Die Bildgenerierung über **Pollinations** braucht keinen Key. **Stable Horde** ist kostenlos, ein Key sorgt nur optional für höhere Priorität. Das eingebaute **Local Model** läuft ohne Key auf dem eigenen Rechner. Die Abo-Optionen (Claude, ChatGPT und Grok) nutzen einen bezahlten Tarif, den du vielleicht ohnehin schon hast, statt eines API-Keys mit Abrechnung pro Nutzung.

## Sind meine API-Keys sicher?

Ja. Marinara verschlüsselt jeden API-Key mit AES-256, bevor er auf die Festplatte geschrieben wird. Beim Export von
Verbindungen und Profilen bleiben geheime Werte außen vor. Ein vollständiges Backup ist etwas anderes: Es enthält die
verschlüsselten Datensätze und, falls vorhanden, die Schlüsseldatei zum Entsperren – behandle Backup-ZIPs also vertraulich.

Weil der Profil-Import geheime Werte absichtlich ausspart, musst du nach dem Import jeden API-Key neu eintragen – auch
dann, wenn du **Import Profile** (Profil importieren) auf ein vollständiges Backup-ZIP anwendest. Stellst du den Daten-Ordner
dagegen manuell komplett wieder her, bleiben die verschlüsselten Keys erhalten, sofern du die passende Schlüsseldatei mit zurückspielst.

## Was ist eine Charakterkarte?

Eine **Charakterkarte** ist das gespeicherte Profil eines KI-Charakters: Name, Avatar, Persönlichkeit, Vorgeschichte und Begrüßung. Angelegt und bearbeitet werden Karten im **Character Editor** (Charakter-Editor). Karten aus anderen Apps lassen sich außerdem importieren. Siehe [Charaktere erstellen und bearbeiten](characters/creating-and-editing-characters.md).

## Was ist ein Lorebook, und wie nutze ich eines für mehrere Charaktere?

Ein **Lorebook** ist eine Sammlung von Einträgen mit Weltwissen (World Info). Jeder Eintrag ergänzt den Prompt – also den Text, den Marinara an die KI schickt – nur dann um Fakten, wenn seine Auslöser im Chat auftauchen. Das spart Tokens und hält die Welt konsistent. Für die Reichweite eines Lorebooks gibt es drei Wege. Nimm den, der passt:

1. Verknüpfe es mit Charakteren oder Personas. Trage im Lorebook-Editor **Linked Characters** (verknüpfte Charaktere) oder **Linked Personas** (verknüpfte Personas) ein. Das Lorebook wird dann in jedem Chat aktiv, an dem ein verknüpfter Charakter beteiligt ist oder in dem eine verknüpfte Persona genutzt wird. Beide Felder nehmen mehrere Einträge auf – trag also jeden gewünschten Charakter ein.
2. Häng es an einen einzelnen Chat. Öffne die **Chat Settings**, geh zum Abschnitt **Lorebooks** und nutze **Add Lorebook** (Lorebook hinzufügen). Das passt, wenn das Weltwissen nur zu diesem einen Chat gehört.
3. Filtere einzelne Einträge nach Charakter. Innerhalb eines gemeinsam genutzten Lorebooks kannst du jeden Eintrag so markieren, dass er nur bei bestimmten anwesenden Charakteren auslöst. Das eignet sich für ein großes Welt-Lorebook, in dem manche Einträge charakterspezifisch sind.

Alles zur Funktion steht unter [Lorebooks](lorebooks/overview.md).

## Was ist ein Agent?

Ein **Agent** ist ein optionaler KI-Helfer, der während eines Chats eine eng umrissene Aufgabe übernimmt. Er führt zum Beispiel die aktuelle Szene mit, achtet auf die Schreibqualität, ergänzt Karten oder Anrufe oder leitet ein Tischspiel im Conversation Mode. Neue Installationen bringen keine optionalen Agenten mit. Öffne das Panel **Agents** (Agenten), klick auf **Download Agents** (Agenten herunterladen), lies dir die Details eines Eintrags durch und installiere ihn. Danach aktivierst du passende Agenten pro Chat in den **Chat Settings**. Gibt es für ein installiertes offizielles Paket ein kompatibles Update, fragt Marinara vor dem Herunterladen nach. Mit **No** bleibt die aktuelle Version bestehen, und **Update** steht in Download Agents weiterhin für später bereit. Ist der Host offline oder schlägt die Prüfung fehl, läuft die installierte Version einfach weiter. Der Katalog kann Pakete auch vollständig entfernen. Siehe [Agenten](agents/agents-overview.md) und das öffentliche [Marinara-Agents-Repository](https://github.com/Pasta-Devs/Marinara-Agents).

## Wie richte ich Noodle ein?

Noodle ist das lokale, fiktive soziale Netzwerk von Marinara für deine Charaktere. Öffne den Tab **Noodle** und darin die **Settings** (Einstellungen). Lade Charaktere oder Charakter-Ordner ein, wähle unter **Refresh** (Aktualisieren) eine Verbindung für die Generierung und starte mit **Refresh now** (Jetzt aktualisieren) die erste Aktivität. Einstellbar sind außerdem automatische Aktualisierungszeiten, Bildgenerierung, Zufallsnutzende und die Übernahme in deine Chats.

Die vollständigen Anleitungen findest du unter [Noodle: die In-App-Timeline](noodle/overview.md) und [Noodle-Einstellungen und Chat-Übernahme](noodle/settings.md).

## Warum erinnert sich mein Charakter nicht an frühere Nachrichten?

KI-Modelle können immer nur eine begrenzte Textmenge auf einmal überblicken. In langen Chats rutschen alte Nachrichten deshalb aus dem Blickfeld. Marinara hat zwei Gedächtnissysteme, die dagegen helfen:

- **Memory Recall** (Gedächtnis-Abruf) durchsucht frühere Nachrichten und schiebt die passendsten Stellen unauffällig wieder in den Prompt. Einschalten kannst du das in den **Chat Settings** unter **Memory Recall**.
- Zusammenfassungen verdichten alte Nachrichten zu kurzen Rückblicken. Roleplay-Chats nutzen dafür **Chat Summary**, Conversation-Chats **Automatic Summarization**.

Einrichtung und Details stehen unter [Gedächtnis und Zusammenfassungen](agents/memory.md).

## Wie sichere ich meine Daten?

Öffne die **Settings** (Einstellungen), wechsle zum Tab **Advanced**, geh zum Abschnitt **Backup & Export** und klick auf **Download Backup** (Backup herunterladen). Marinara legt daraufhin ein einzelnes `.zip`-Archiv mit deinen Daten und deinen hochgeladenen Dateien an. Zum Wiederherstellen nutzt du später **Import Profile (JSON/ZIP)** in den **Settings** unter dem Tab **Imports** und wählst dieselbe `.zip`-Datei.

Im selben Abschnitt lässt sich auch ein rotierendes automatisches Backup einrichten – täglich, wöchentlich oder monatlich.
Vollständige Backup-ZIPs können die verschlüsselten Datensätze und die Schlüsseldatei zum Entsperren enthalten, behandle
sie also vertraulich. **Import Profile** lässt Anbieter-Geheimnisse weiterhin leer; trag die Keys nach dem Import also erneut
ein. Die vollständige Anleitung steht unter [Sichern und Wiederherstellen](data/backup-and-restore.md).

## Wie funktionieren Erweiterungen, und kann ich fremden Code importieren?

Standardmäßig kann nur Professor Mari einen Entwurf für eine Personal Extension für dich anlegen. Der Entwurf startet deaktiviert, und du musst erst den Code prüfen und den exakten SHA-256-Hash freigeben, bevor er läuft.

Browser-Code läuft standardmäßig in einem eigenen Worker innerhalb eines iframes mit undurchsichtigem Origin. Neben den eng begrenzten Rechten für Logging, privaten Speicher, Timer, Aufräumarbeiten und deklarative Oberflächen bekommt er die undurchsichtigen IDs des gerade aktiven Chats und der beteiligten Charaktere. So können Erweiterungen wie Notepad Daten pro Chat behalten. Eine Browser Extension darf zusätzlich begrenzte Momentaufnahmen anfordern: nur von den Charakterkarten dieses Chats und/oder von der dort gewählten Persona. Diese Berechtigungen siehst du bei der Freigabe des exakten Hashes; ohne sie fehlen die entsprechenden Datensätze. Abgeschottete Erweiterungen bekommen niemals Nachrichten, ganze Charakter- oder Persona-Bibliotheken, nicht deklarierte Felder, Chat-Metadaten, DOM-Zugriff, Netzwerkzugriff oder APIs zum Ändern von Daten. Server-Code läuft auf unterstützten macOS- und Linux-Hosts in einem getrennten, vom Betriebssystem abgeschotteten Prozess und bekommt keinen Chat-Kontext aus dem Browser.

Importe von Fremdanbietern sind standardmäßig ausgeblendet. Zuerst muss der Host-Betreiber `ENABLE_EXTERNAL_EXTENSIONS=true` in der `.env` setzen, danach muss der Nutzende die Warnung unter **Settings → Advanced → Danger Zone** bestätigen. Solange nicht beide Schranken offen sind, tauchen externe Datensätze gar nicht erst auf – auch manuell abgelegte und per Profil importierte nicht – und lassen sich weder freigeben noch ausführen.

Eine External Extension darf **Full page access** (Vollzugriff auf die Seite) anfordern, wenn ältere Erweiterungen wirklich das DOM von Marinara brauchen. Abgeschottet ist das nicht: Der exakt freigegebene Code läuft direkt in der Marinara-Seite und kommt an Seiteninhalte, Browser-Speicher, Netzwerk-APIs und die aktuelle Sitzung derselben Herkunft. Entwürfe von Professor Mari können das nicht anfordern. Gib es erst frei, wenn du genau diese Version geprüft hast und ihr vertraust. Lade die Seite nach dem Deaktivieren neu, falls noch nicht registrierte Änderungen zurückbleiben. Siehe [Personal Extensions](extending/personal-extensions.md).

## Wo werden meine Daten gespeichert?

Alles bleibt auf dem Computer, auf dem Marinara läuft, und zwar im Ordner `data` der Installation. Charaktere, Chats, Personas, Lorebooks, Presets und Einstellungen liegen dort. Nichts landet in der Cloud. Siehe [Wo deine Daten liegen](data/where-data-is-stored.md).

## Verliere ich beim Update meine Daten?

Nein. Ein Update von Marinara lässt Charaktere, Chats und Einstellungen unangetastet. Vor einem großen Update ist ein Backup trotzdem klug – sicher ist sicher. Die Update-Schritte je Plattform stehen unter [Aktualisieren](UPGRADING.md).

## Was kann Professor Mari?

Professor Mari ist die eingebaute Assistentin auf dem Home-Bildschirm. Du öffnest sie über die Schaltfläche **Ask Professor Mari**. Sie erklärt die App und hilft bei der Einrichtung. Auf Zuruf in normaler Sprache legt sie außerdem Daten an oder bearbeitet sie: Charaktere, Personas, Lorebooks, Prompt-Presets (gespeicherte Prompt-Vorlagen) und neue Chats.

Über dem Eingabefeld blendet sie zusätzlich Vorschlags-Chips für Schnellantworten ein. Damit führt sie dich durch mehrstufige Erstellungen und Änderungen, ohne dass du jedes Detail selbst tippen musst.

Ändert sie deine Daten, erscheint eine Prüfkarte mit den Schaltflächen **Keep** (Behalten) und **Restore** (Wiederherstellen) – alles Unerwünschte lässt sich also zurücknehmen. Sie ist eine Hilfe, aber kein Ersatz für diese Anleitungen, sobald es um Versionsspezifisches geht. Die vollständige Liste ihrer Fähigkeiten steht unter [Professor Mari](home/professor-mari.md).

Professor Mari darf weiterhin gewöhnliche Marinara-Quelldateien bearbeiten. Abhängigkeitsdateien, Starter, Installer und CI-Workflows warten dagegen auf eine ausdrückliche Freigabe. Braucht ihre Änderung eine öffentliche npm-Bibliothek, zeigt Marinara vor der Installation die exakt aufgelöste Version und die Registry-Integrität an – und installiert dann mit deaktivierten Lifecycle-Skripten.

Hinweis: Über eine gewöhnliche entfernte Adresse brauchen die datenändernden Aktionen von Professor Mari sowohl Basic Auth als auch ein Admin-Geheimnis. Vertrauenswürdige Netzwerkrouten und solche auf der Allowlist können die Ausnahmen nutzen, die [Fernzugriff](REMOTE_ACCESS.md) beschreibt.

## Was ist der Storyboard-Agent, und wie nutze ich ihn im Game Mode?

Der herunterladbare Agent **Storyboard** macht aus fertigem Erzähltext eine geordnete Folge von Keyframe-Bildern und kann jedes Keyframe zu einem kurzen Clip animieren. Im **Game Mode** bebildert er genau einen fertigen Erzählzug des Game Masters (GM). Die Bilder zeigt er in einem schwebenden Viewer oder als Hintergrund des Spiels. Im **Roleplay** fasst er neu abgeschlossene Wortwechsel zu einer eingebetteten Episode zusammen.

So nutzt du ihn im Game Mode: Installiere **Storyboard** über **Agents > Download Agents**. Öffne das Spiel, geh zu **Chat Settings > Agents** und schalte **Enable Agents** (Agenten aktivieren) und **Enable Storyboards** (Storyboards aktivieren) ein. Leg außerdem eine Verbindung für Bildgenerierung im Spiel oder in der globalen Storyboard-Einrichtung fest. Beende einen Erzählzug des GM, öffne dann die **Gallery** (Galerie) und klick auf **Create storyboard** (Storyboard erstellen). Mit **View storyboard** (Storyboard ansehen) holst du den Viewer zurück.

Für automatische Storyboards im Spiel schaltest du **Automatic Storyboard Illustrations** ein. Willst du auch Clips, schalte zusätzlich **Automatic Storyboard Animations** ein und wähl eine Verbindung für Videogenerierung. Die Präsentation **Storyboard Optimized** aus dem Einrichtungsassistenten für neue Spiele prägt nur die Erzählung des GM; sie installiert oder aktiviert den Agenten nicht. Einrichtung in Game und Roleplay, Prompts, Viewer, Migrationsverhalten und Fehlerbehebung stehen in der [Anleitung zum Storyboard-Agenten](game/storyboard.md).

## Können Charaktere in einem Anruf laut sprechen?

Ja, im Modus **Conversation**. Audio- und Videoanrufe gibt es nur dort. Damit ein Charakter spricht, richtest du zuerst **Text to Speech** (Sprachausgabe) im Panel **Connections** ein.

Willst du per Mikrofon antworten und arbeitet die Spracherkennung des Browsers unzuverlässig, installiere zuerst **Calls** über **Agents > Download Agents**. Öffne danach das Panel **Connections**, klapp die Karte **Local Model** auf, such **Local Speech Model**, wähle **Whisper Tiny (Multilingual)** oder **Whisper Base (Multilingual)** und klick auf **Download Whisper**. Beim Deinstallieren von Calls verschwinden auch dessen Whisper-Downloads, was Speicherplatz freigibt. Die komplette Einrichtung steht unter [Anrufe](conversation/calls.md).

## Kann Marinara Bilder generieren?

Ja. Leg eine Verbindung für Bildgenerierung an, etwa **Pollinations** (braucht keinen Key) oder einen kostenpflichtigen Anbieter. Danach erstellt Marinara Charakter-Avatare, Szenenbilder, Selfies und Keyframes des Storyboard-Agenten im Roleplay oder im Game Mode. Wie du eine anlegst, steht unter [Mit einem KI-Anbieter verbinden](connections/connecting-to-a-provider.md).

## Wie lese ich die Dokumentation innerhalb der App?

Jede Installation bringt sämtliche Anleitungen mit. Lesen kannst du sie, ohne die App zu verlassen:

- Klick auf dem Home-Bildschirm in der Fußzeile auf die Schaltfläche **Documentation** (Dokumentation), direkt neben **Replay Tutorial**.
- Öffne in der FAQ auf dem Home-Bildschirm die Frage zur Dokumentation und klick auf **Open Documentation** (Dokumentation öffnen).

Beide Schaltflächen öffnen denselben Betrachter in der App. Er listet jede Anleitung auf und stellt sie direkt in Marinara dar.

## Wo bekomme ich Hilfe oder melde einen Fehler?

Fang mit [Fehlerbehebung](TROUBLESHOOTING.md) an – dort ist alles nach Symptomen sortiert. In der Fußzeile des Home-Bildschirms öffnet die Schaltfläche **Discord** den Community-Chat und die Schaltfläche **Support** die Support-Seite des Projekts. Fehler und Funktionswünsche gehören auf die GitHub-Seite des Projekts.

## Verwandte Anleitungen

- [Fehlerbehebung](TROUBLESHOOTING.md)
- [Installation](INSTALLATION.md)
- [Fernzugriff](REMOTE_ACCESS.md)
- [Mit einem KI-Anbieter verbinden](connections/connecting-to-a-provider.md)
