# Häufige Fragen

Kurze Antworten auf häufige Fragen zu Marinara Engine. Jede verlinkt auf die Anleitung mit den vollständigen Schritten.

<a id="how-do-i-access-marinara-engine-from-my-phone-or-another-device"></a>

## Wie erreiche ich Marinara Engine vom Handy oder von einem anderen Gerät aus?

Marinara läuft als Server auf einem Computer, und du öffnest die App im Browser. Die Startskripte lassen andere Geräte den Server erreichen, die Zugriffskontrolle blockiert sie aber, bis du auf dem Host-Computer eine Anmeldung (einen Benutzernamen und ein Passwort) einrichtest. Bis dahin sieht ein entferntes Gerät nur die Seite **Access blocked**.

1. Lass Marinara auf dem Host-Computer laufen.
2. Ermittle die lokale IP-Adresse des Hosts. Unter Windows führst du `ipconfig` aus und liest **IPv4 Address** ab. Unter macOS oder Linux führst du `hostname -I` aus.
3. Öffne auf dem anderen Gerät `http://<host IP>:7860` im Browser, zum Beispiel `http://192.168.1.42:7860`. `7860` ist der Standard-Port.
4. Richte eine Anmeldung ein. Öffne Marinara auf dem anderen Gerät: Die blockierte Seite hat ein Formular **Setup code** (Einrichtungscode). Den einmaligen Code findest du im Server-Log auf dem Host-Computer (unter Docker führst du `docker logs <container> 2>&1 | grep "setup code"` aus). Gib ihn dann zusammen mit einem neuen Benutzernamen und Passwort ein. Oder öffne in einem Browser, der auf dem Host schon angemeldet ist, **Settings → Advanced → Access** (Einstellungen → Erweitert → Zugriff).
5. Melde dich an. Um weitere Geräte ohne Passworteingabe hinzuzufügen, nutze **Add a device** (Gerät hinzufügen) in **Settings → Advanced → Access**.

Bei gewöhnlichen Desktop-Installationen braucht derselbe Computer (`127.0.0.1`) kein Passwort. Ein Reverse-Proxy auf demselben Computer zählt als entfernter Besucher und braucht die Anmeldung. Alle Optionen, Einrichtungscodes und Docker erklärt [Fernzugriff](REMOTE_ACCESS.md#option-1-login-recommended). Für Geräte in verschiedenen Netzwerken nimm Tailscale: siehe [Mit Tailscale von überall aus verbinden](REMOTE_ACCESS.md#connect-from-anywhere-with-tailscale). Klappt die Verbindung nicht, siehe [Fehlerbehebung](TROUBLESHOOTING.md).

## Gibt es eine Handy-App für Marinara?

Eine eigene native App gibt es nicht. Auf Handy und Tablet nutzt du die Web-App im Browser. Die meisten Browser bieten **Add to Home Screen** (Zum Startbildschirm hinzufügen) oder **Install App** (App installieren) an. Damit speicherst du sie als PWA, also als Website, die sich wie eine App öffnet, ohne Browserleiste.

Unter Android kannst du außerdem [die neueste APK herunterladen](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). Sie führt Marinara über Termux auf dem Handy aus. Siehe [Android-Installation](installation/android-termux.md). Für iPhone und iPad siehe die [iOS-PWA-Anleitung](installation/ios-pwa.md).

In der Android-App bietet der Launcher **Open in browser** (im Browser öffnen), **Retry connection** (Verbindung erneut versuchen) und **Install / Start Marinara** an. Um deine Auswahl später zu ändern, nutze **Settings → General → App Behavior → Open Android launcher (app or browser)**. Ältere APKs melden sich manuell unter `/android-login` an.

<a id="can-i-play-with-other-people"></a>

## Kann ich mit anderen Menschen spielen?

Ja. Mit dem optionalen Mehrspielermodus teilen sich mehrere Menschen einen Conversation-, Roleplay- oder Game-Chat. Alle schalten die Einstellung ein und hosten dann oder treten bei. Gäste brauchen keinen KI-Key. Ein Passwort macht einen unbekannten Host nicht sicher. Lies vor dem Einschalten [Einrichtung, Warnungen und Grenzen des Mehrspielermodus](CONFIGURATION.md#optional-multiplayer).

## Was sind die drei Chat-Modi?

- **Conversation**: ein Chat im Stil einer Messenger-App mit einem Charakter.
- **Roleplay**: eine dichte Story-Szene mit Erzählung und Charakter-Avataren.
- **Game**: ein Textabenteuer, das ein KI-Game-Master leitet.

Wie du einen auswählst, steht in [Erste Schritte mit Marinara Engine](home/welcome.md#choose-a-chat-mode).

## Wie ändere ich die Zeitzone für Conversation-Zeitpläne?

Öffne einen Conversation-Chat und wähl in den Chat-Einstellungen **Schedule timezone** (Zeitzone für Zeitpläne). **Use device** (Gerät verwenden) setzt sie auf die Zeitzone deines Geräts zurück. Es ist eine einzige globale Einstellung für alle Conversation-Chats, und sie synchronisiert sich auf andere Geräte am selben Server. Siehe [Conversation Mode: Erste Schritte](conversation/getting-started.md).

## Hat jeder Conversation-Chat einen eigenen Zeitplan?

Nein. Ein Zeitplan gehört zum Charakter, deshalb nutzt ihn jeder Conversation-Chat mit diesem Charakter. Du bearbeitest ihn unter **Character Editor → Convo → Weekly schedule** (Charakter-Editor → Convo → Wochenplan).

Für sofortige Antworten in einem einzelnen Chat schaltest du in dessen Chat-Einstellungen **Conversation schedules** (Conversation-Zeitpläne) aus. Eine manuelle Statusüberschreibung wie **dnd** gilt trotzdem, und sie gehört in jedem Chat zum Charakter. Mit **clear** entfernst du sie.

## Brauche ich einen API-Key für Marinara?

Ja, für Online-KI-Dienste. Ein **API-Key** ist ein geheimer Code eines KI-Dienstes, mit dem Marinara dein Konto dort nutzen kann. Bevor du einen Chat starten kannst, brauchst du mindestens ein Konto. Öffne **Connections** (Verbindungen), klick auf **Add** (Hinzufügen), wähl einen Dienst, füg deinen Key ein und klick auf **Connect** (Verbinden). Siehe [Verbindung zu einem KI-Anbieter herstellen](connections/connecting-to-a-provider.md).

Manche Optionen brauchen keinen Key. Die Abo-Optionen (Claude, ChatGPT und Grok) melden sich über ein Kommandozeilenwerkzeug an. Das **Built-in model** (eingebautes Modell) läuft auf deinem Computer. Siehe [Eingebautes Modell einrichten](connections/local-model.md).

## Welche KI-Anbieter werden unterstützt?

Marinara unterstützt OpenAI, Anthropic, Google Gemini, OpenRouter und viele weitere Dienste für Text-, Bild- und Videogenerierung, dazu Server, die **OpenAI-compatible** (OpenAI-kompatibel) sind, etwa Ollama, LM Studio und KoboldCpp. Die vollständige Liste steht in [Unterstützte KI-Anbieter](connections/providers-reference.md). Wie du einen hinzufügst, steht in [Verbindung zu einem KI-Anbieter herstellen](connections/connecting-to-a-provider.md).

## Kostet die Nutzung von Marinara etwas?

Marinara ist kostenlos. Du bezahlst, was dein KI-Dienst berechnet. Manche Optionen kosten zum Ausprobieren nichts: Bilder über **Pollinations** brauchen keinen Key, **Stable Horde** ist kostenlos, und das **Built-in model** läuft auf deinem Computer. Die Abo-Optionen nutzen einen bezahlten Tarif, den du vielleicht schon hast.

## Sind meine API-Keys sicher?

Ja. Jeder API-Key wird vor dem Speichern mit AES-256 verschlüsselt. Exporte von Konten und Profilen lassen geheime Werte weg. Trag deine Keys also neu ein, nachdem du **Import Profile** (Profil importieren) genutzt hast, auch bei einem vollständigen Backup-ZIP. Ein vollständiges Backup-ZIP enthält die verschlüsselten Datensätze und die Schlüsseldatei, die sie entsperrt, behandle es also vertraulich. Siehe [Marinara sichern und wiederherstellen](data/backup-and-restore.md).

## Was ist eine Charakterkarte?

Eine Charakterkarte ist das gespeicherte Profil eines KI-Charakters: Name, Avatar, Persönlichkeit, Vorgeschichte und Begrüßung. Karten legst du im **Character Editor** an oder importierst sie aus anderen Apps. Siehe [Charaktere anlegen und bearbeiten](characters/creating-and-editing-characters.md).

## Was ist ein Lorebook, und wie nutze ich eines für mehrere Charaktere?

Ein Lorebook ist eine Sammlung von Weltwissen. Jeder Eintrag kommt nur dann in den Prompt, wenn seine Auslösewörter im Chat auftauchen. Du kannst:

1. Im Lorebook-Editor **Linked Characters** (verknüpfte Charaktere) oder **Linked Personas** (verknüpfte Personas) ausfüllen. Dann wirkt es in jedem Chat mit ihnen.
2. **Chat Settings → Lorebooks → Add Lorebook** (Chat-Einstellungen → Lorebooks → Lorebook hinzufügen) öffnen, um es an einen einzelnen Chat zu hängen.
3. Einzelne Einträge auf bestimmte Charaktere beschränken.

Siehe [Lorebooks](lorebooks/overview.md).

## Was ist ein Agent?

Ein Agent ist ein optionaler KI-Helfer, der während eines Chats eine eng umrissene Aufgabe übernimmt, etwa die Szene mitführen oder Karten ergänzen. Neue Installationen haben keine. Öffne **Agents → Agent Organizer**, wähl einen aus und installiere ihn. Schalte ihn dann pro Chat in den **Chat Settings** ein. Siehe [Agenten](agents/agents-overview.md).

## Wie richte ich Noodle ein?

Noodle ist ein lokales, fiktives soziales Netzwerk für deine Charaktere. Installiere **Noodle** über **Agents → Agent Organizer**, starte Marinara neu, wenn du dazu aufgefordert wirst, und öffne dann **Home → Noodle**. Siehe [Noodle: die Social-Timeline in der App](agents/noodle.md).

## Warum antwortet mein Charakter nicht?

Meist hat der Chat kein Konto oder Modell, der API-Key ist falsch, oder das Guthaben des Kontos ist aufgebraucht. Siehe [Mein Charakter antwortet nicht](TROUBLESHOOTING.md#my-character-does-not-reply).

## Warum erinnert sich mein Charakter nicht an frühere Nachrichten?

Modelle können nur eine begrenzte Textmenge auf einmal lesen, deshalb fallen in langen Chats alte Nachrichten heraus. Zwei Funktionen helfen. **Memory Recall** holt passende ältere Nachrichten zurück, und Zusammenfassungen verdichten alte Nachrichten zu Rückblicken. Beides findest du in den **Chat Settings**. Für lange Roleplay-Chats nutze **Advanced Memory Recall** (erweiterter Erinnerungsabruf) unter **Chat Settings → Memory Recall**. Siehe [Gedächtnis und Zusammenfassungen](agents/memory.md).

## Wie sichere ich meine Daten?

Öffne **Settings → Advanced → Backup & Export** und klick auf **Download Backup** (Backup herunterladen). Dabei wird eine `.zip` mit deinen Daten und hochgeladenen Dateien gespeichert. Zum Wiederherstellen nutzt du **Import Profile (JSON/ZIP)** unter **Settings → Imports**. Im selben Abschnitt lässt sich ein tägliches, wöchentliches oder monatliches Backup einrichten. Siehe [Marinara sichern und wiederherstellen](data/backup-and-restore.md).

## Wie funktionieren Erweiterungen, und kann ich fremden Code importieren?

Standardmäßig legt nur Professor Mari Entwürfe für Personal Extensions (persönliche Erweiterungen) an. Ein Entwurf ist zunächst ausgeschaltet, und du gibst seinen exakten Code frei, bevor er läuft. Importe von Drittanbietern sind ausgeblendet, bis der Host `ENABLE_EXTERNAL_EXTENSIONS=true` in der `.env` setzt und du die Warnung unter **Settings → Advanced → Danger Zone** bestätigst. Siehe [Personal Extensions](extending/personal-extensions.md).

## Wo werden meine Daten gespeichert?

Auf dem Computer, auf dem Marinara läuft, im Ordner `data` deiner Installation. In der Cloud wird nichts gespeichert. Siehe [Wo Marinara deine Daten speichert](data/where-data-is-stored.md).

## Verliere ich beim Update meine Daten?

Nein. Ein Update behält deine Charaktere, Chats und Einstellungen. Mach trotzdem vorher ein Backup. Kehrst du zu einer älteren Version zurück, können Daten verloren gehen, die nur die neuere Version speichert. Siehe [Aktualisieren](UPGRADING.md) und [Downgrade auf eine ältere Version](UPGRADING.md#downgrading-to-an-older-version).

## Was kann Professor Mari?

Professor Mari ist die eingebaute Assistentin auf dem Home-Bildschirm. Sie erklärt die App und legt auf Wunsch Charaktere, Personas, Lorebooks und Presets an oder bearbeitet sie. Jede Änderung zeigt eine Karte mit **Undo** (rückgängig). Siehe [Professor Mari](home/professor-mari.md).

## Was ist der Storyboard-Agent, und wie nutze ich ihn im Game Mode?

Er macht aus fertigem Erzähltext Bilder. Installiere **Storyboard** über **Agents → Agent Organizer** und schalte ihn dann im Chat ein. Siehe die [Anleitung zum Storyboard-Agenten](game/storyboard.md).

## Können Charaktere in einem Anruf laut sprechen?

Ja, im Conversation Mode. Dafür muss **Text to Speech** (Sprachausgabe) unter **Connections** eingerichtet sein. Die Schritte, auch zur Spracherkennung für dein Mikrofon, stehen unter [Anrufe](conversation/calls.md).

## Kann Marinara Bilder generieren?

Ja. Leg ein Konto für Bildgenerierung an, etwa **Pollinations** (braucht keinen Key) oder einen kostenpflichtigen Dienst. Siehe [Verbindung zu einem KI-Anbieter herstellen](connections/connecting-to-a-provider.md).

## Wie lese ich die Dokumentation innerhalb der App?

Klick auf dem Home-Bildschirm in den Lesezeichen auf **Documentation** (Dokumentation). Auf dem Handy öffnest du zuerst das Lesezeichenmenü. In der FAQ auf dem Home-Bildschirm kannst du auch auf **Open Documentation** (Dokumentation öffnen) klicken.

## Wo bekomme ich Hilfe oder melde einen Fehler?

Fang mit [Fehlerbehebung](TROUBLESHOOTING.md) an. Auf Home öffnet **Discord** den Community-Chat und **Support** die Support-Seite des Projekts. Fehler und Funktionswünsche meldest du auf der GitHub-Seite des Projekts.

## Verwandte Anleitungen

- [Fehlerbehebung](TROUBLESHOOTING.md)
- [Installation](INSTALLATION.md)
- [Fernzugriff](REMOTE_ACCESS.md)
- [Verbindung zu einem KI-Anbieter herstellen](connections/connecting-to-a-provider.md)
