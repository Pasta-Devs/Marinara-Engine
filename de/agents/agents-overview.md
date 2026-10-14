# Agenten: KI-Helfer für deine Chats

In dieser Anleitung erfährst du, was Agenten in Marinara Engine sind, wie du sie herunterlädst, wann sie laufen und wie du sie für einen Chat aktivierst. Es geht um das **Agents**-Panel (Agenten), den offiziellen Katalog, die Einstellungen pro Chat und die Frage, woran du erkennst, dass ein Agent gelaufen ist. Den kompletten Erstanbieter-Katalog findest du am Ende unter „Verwandte Anleitungen“.

## Was Agenten sind

Agenten sind kleine KI-Helfer, die rund um die Hauptantwort im Chat automatisch mitlaufen. Sie erledigen eng umrissene Aufgaben, während du mit einem Charakter sprichst. Ein Agent führt zum Beispiel Uhrzeit und Wetter mit oder wählt einen Gesichtsausdruck für den Charakter. Ein anderer schreibt die Antwort um und entfernt Wortwiederholungen. Wieder andere generieren ein Bild für einen wichtigen Moment.

Agenten werden pro Chat aktiviert, nicht pro Charakter. Auf einer Charakterkarte gibt es keinen Schalter für Agenten. Zwei Chats mit demselben Charakter können völlig unterschiedliche Agenten nutzen. Welche Agenten laufen, legst du in den Einstellungen des jeweiligen Chats fest.

Frisch installierte Marinara-Engine-Versionen bringen keine optionalen Agenten mit. Das hält die Basis-App und die Termux-Installation klein. **Download Agents** (Agenten herunterladen) sortiert die offiziellen Pakete zum Installieren per Klick in **Apps**, **Writer Agents**, **Tracker Agents** und **Misc Agents**. Der Katalog enthält Long-Term Memory, World Maps, Calls, Inventory Tracker und alle sechs Conversation-Spiele. Quellcode, Manifeste, herunterladbare Artefakte und der Katalog auf Repository-Ebene sind öffentlich einsehbar unter [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Die vollständige Beschreibung jedes einzelnen Agenten steht in der [Referenz der herunterladbaren Agenten](built-in-agents.md). Wie du eigene baust, zeigt [Eigene Agenten erstellen](custom-agents.md).

## Die drei Phasen

Jeder Agent läuft an einem von drei Punkten rund um die Antwort. Dieser Punkt heißt **pipeline phase** (Pipeline-Phase). Du stellst ihn im Agent-Editor ein; jeder mitgelieferte Agent bringt bereits einen sinnvollen Standard mit.

- **Pre-Generation**: läuft, bevor die KI ihre Antwort schreibt. So kann der Agent dem Prompt vorab nützlichen Kontext hinzufügen – der Prompt ist der Text, den Marinara an die KI schickt. Agenten, die Wissen nachschlagen, laufen hier.
- **Parallel**: läuft gleichzeitig mit der Antwort. Der Agent wartet die Antwort nicht ab und kann sie auch nicht verändern. Ein Agent für Live-Publikumsreaktionen läuft hier.
- **Post-Processing**: läuft, wenn die Antwort fertig ist. Der Agent kann sie lesen und – bei umschreibenden Agenten – auch bearbeiten. Die meisten Tracker, der Agent zur Textbereinigung und der Bild-Agent laufen hier.

## Das Agents-Panel

Öffne das **Agents**-Panel über die Tabs des rechten Panels (Symbol mit den Funkeln). Hier durchsuchst, erstellst und sortierst du Agenten. Das ist deine Bibliothek – und nicht der Schalter, mit dem du einen Agenten für einen einzelnen Chat ein- oder ausschaltest.

Ein Klick auf **Download Agents** oben öffnet den offiziellen Katalog im Vollbild. Das funktioniert am Rechner wie am Handy. Wähle einen Eintrag aus, und du siehst Beschreibung, unterstützten Funktionstyp, Download-Größe, Berechtigungen, Versionskompatibilität und Dokumentation. Über **Install** (Installieren) fügst du ihn hinzu; derselbe Bildschirm bietet sofortige manuelle Updates sowie **Uninstall** (Deinstallieren) für bereits vorhandene Pakete.

Hinter dem Katalog in der App steht das öffentliche [Repository Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Dort lässt sich jedes Paket und jedes Artefakt einsehen. Für den Normalfall gilt trotzdem: über **Download Agents** installieren, damit Marinara Kompatibilität, Berechtigungen, Hashes, Archivinhalte und nötige Neustarts prüfen kann.

Der Katalog umfasst Chat-Agenten aus erster Hand, World Maps, Audio- und Videoanrufe für Conversation sowie sämtliche optionalen Conversation-Spiele. Installierte Agenten sind in **Apps**, **Writer Agents**, **Tracker Agents** und **Misc Agents** gruppiert, dazu kommt ein Bereich **Custom Agents** für selbst gebaute. **Apps** sind Pakete mit einem eigenen Home-Tab, etwa Noodle und Slurp, die du eigenständig nutzt, statt sie einem Chat hinzuzufügen. Deinstallierst du ein Katalogpaket, verschwinden Code und Einstellungen aus der Engine – Nachrichten und Chatverlauf bleiben erhalten. Löschst du einen eigenen Agenten, ist er endgültig weg.

Ein mit **Rules** gekennzeichnetes Paket liefert einen Game Mode-Regelsatz wie 5e (SRD 5.1), keinen Agenten. Du wählst es beim Anlegen eines Spiels unter **Rules**; siehe [Regeln auswählen](../game/getting-started.md#choosing-rules). Im Chat gibt es dafür keinen Aktivierungsschalter. Das 5e-Paket ist eine Vorschau und erscheint derzeit nur im Katalog einer Engine aus dem Branch `staging`.

Kommst du von einer Engine-Version, die diese Funktionen noch fest mitbrachte, lädt Marinara die passenden Pakete einmalig herunter. Chat-Auswahl, Agent-Einstellungen, gespeicherte Laufzeitdaten und Verlauf bleiben dabei bestehen. Erreicht diese Migration den Katalog nicht, versucht sie es beim nächsten Start erneut, statt irgendetwas zu verwerfen.

<a id="updating-packages"></a>

### Pakete aktualisieren

Marinara aktualisiert ein Paket nur nach Rückfrage. Gibt es für ein installiertes Paket eine neuere kompatible Version, erscheint das Fenster **Agent updates available**. Es listet jedes Update mit seiner neuen Version auf und zeigt, ob ein Neustart nötig ist. Veröffentlicht das Paket Release Notes, zeigt **What changed** (Was sich geändert hat) sie an. Ein Punkt markiert eine Änderung, die dir auffallen wird; Updates ohne Punkt sind routinemäßige Fehlerbehebungen.

- Klick auf **Update all** (Alle aktualisieren), um alle aufgeführten Updates zu installieren. Starte Marinara Engine neu, wenn du dazu aufgefordert wirst.
- Klick auf **Not now** (Jetzt nicht), um deine aktuellen Versionen zu behalten. Zu einer übersprungenen Version fragt Marinara nicht noch einmal nach.

Aktualisieren kannst du jedes Paket auch später noch über **Download Agents**. Installierte Pakete laufen in ihrer aktuellen Version weiter, bis du sie aktualisierst – auch wenn der Katalog nicht erreichbar ist.

Updates betreffen nur Pakete, die du bereits installiert hast. Installationen auf dem Rechner, unter Docker und unter Android/Termux halten ihre Pakete auf ihrem lokalen Server. iOS, iPadOS und andere Browser-Clients nutzen die Pakete, die auf ihrem verbundenen Marinara-Server installiert sind.

## Agenten für einen Chat aktivieren

Agenten schaltest du innerhalb jedes Chats ein, im Panel **Chat Settings** (Chat-Einstellungen).

1. Öffne den gewünschten Chat.
2. Öffne **Chat Settings** (Chat-Einstellungen).
3. Geh zum Abschnitt **Agents**.
4. Aktiviere **Enable Agents** (Agenten aktivieren). Das ist der Hauptschalter. Steht er aus, läuft in diesem Chat kein einziger Agent.
5. Füge aus den Listen unter dem Schalter die gewünschten Agenten hinzu oder entferne die, die du nicht brauchst.

Die hinzugefügten Agenten erscheinen anschließend als aktiv, jeweils mit einer kleinen Schaltfläche zum Entfernen.

Der Abschnitt **Agents** bietet noch ein paar weitere Bedienelemente:

- **Agent Menus** (Agent-Menüs, nur in Roleplay-Chats): sitzt direkt unter **Enable Agents**. Ein Klick auf den Namen eines Agenten bringt dich zu seinen Einstellungen.
- **Trackers Control** (Tracker-Steuerung, nur in Roleplay-Chats): eine Karte, die anfangs zugeklappt ist. Klick darauf, um diese Einstellungen aufzuklappen:
  - **Attach chat summaries** (Chat-Zusammenfassungen anhängen): standardmäßig aus, auch in bestehenden Chats ohne gespeicherte Auswahl. Aktiviere die Option, um gespeicherte Zusammenfassungen an Agent-Anfragen anzuhängen, auch bei der Nachverarbeitung und manuellen Wiederholungen. Zusammenfassungen bleiben für die Hauptantwort verfügbar und werden weiterhin erzeugt. Agenten mit ausdrücklich gewährtem Zugriff auf den vollständigen Hauptprompt können darin enthaltene Zusammenfassungen weiterhin lesen.
  - **Attach Lorebooks to Trackers** (Lorebooks an Tracker anhängen): Ist das aktiv, bekommen Tracker-Agenten zusätzlich die Lorebook-Einträge, die für die Hauptantwort verwendet wurden. Ein Lorebook ist eine Sammlung von Weltwissen. Die Option erscheint, sobald der Chat einen Tracker-Agenten hat.
  - **Review Agent Outputs** (Agent-Ausgaben prüfen): wird im eigenen Punkt nach dieser Liste beschrieben.
  - **Individual tracker schedule** (Zeitplan pro Tracker): Schalte einen Tracker ein, damit er nicht mehr nach jeder Antwort läuft. Du startest ihn dann von Hand über eine Schaltfläche im HUD. HUD steht für Heads-up-Display, die Info-Leiste am oberen Chatrand in Roleplay. Die Option erscheint, sobald der Chat einen Tracker-Agenten hat.
- **Review Agent Outputs**: Ist das aktiv, warten Änderungen an Lorebook, Zusammenfassung und Charakterkarte auf deine Freigabe, bevor sie gespeichert werden. Ist die Option aus, speichern sich Lorebook- und Zusammenfassungs-Änderungen selbst – Bearbeitungen an der Charakterkarte fragen aber weiterhin bei dir nach. Mehr dazu unter [Agent-Freigaben und die Agent Suite](approvals-and-agent-suite.md). In Roleplay-Chats steckt die Option in **Trackers Control**.
- **Agent Suite**: öffnet eine Ansicht, in der du alles lesen und bearbeiten kannst, was die Agenten für diesen Chat gespeichert haben.

### Der Kostenhinweis

Agenten kosten zusätzliche Tokens und zusätzliche Modellaufrufe – ein Token ist ein kleines Textstück. Jeder Agent bringt eigene Anweisungen mit, oft auch einen eigenen Modellaufruf. Wo möglich, bündelt Marinara Agenten mit derselben Verbindung in einem einzigen Aufruf. Über der Agentenliste schätzt eine Anzeige die Last deiner aktuellen Auswahl. Sie nennt ungefähr, wie viele Tokens an Agent-Anweisungen dazukommen und wie viele zusätzliche Aufrufe pro Zug anfallen.

Klick oder tippe auf das Hilfesymbol neben der Anzeige, um die Erklärung auf dem Computer oder Smartphone zu öffnen. Wird die Last hoch, färbt sich diese Anzeige bernsteinfarben und zeigt ein Warnsymbol. Die tatsächlichen Kosten pro Zug liegen über dem angezeigten Wert, denn mit jedem Aufruf gehen auch Chatverlauf und Charakterdetails mit. Erscheint die Warnung, entferne nicht benötigte Agenten oder verschiebe einige auf eine günstigere oder lokale Verbindung. Das Limit für die letzten Nachrichten betrifft nur Chatnachrichten; Agent-Anweisungen, Charakterdetails und angehängte Zusammenfassungen kommen als zusätzlicher Kontext dazu. Ein für die Verbindung gespeicherter **Reasoning Effort** (Denkaufwand) gilt auch für ihre Agenten. Eine hohe Stufe macht daher jeden ihrer Aufrufe langsamer und teurer. Siehe [Parameter für Agenten](../prompts/generation-parameters.md#parameters-for-agents).

## Womit die einzelnen Modi starten

Eine frische Installation startet ohne installierte oder aktive optionale Agenten. Jeder Chat-Modus zeigt nur die installierten Pakete, die zu ihm passen.

- **Roleplay**: Installiere Roleplay-Agenten aus dem Katalog und füge sie dann in Chat Settings hinzu. World Maps taucht dort auf wie jeder andere unterstützte Agent.
- **Conversation**: Installiere Calls oder einzelne Tischspiele aus dem Katalog. Spiele erscheinen in der Spieleauswahl und melden ihre Slash-Befehle an; Anrufe ergänzen ihre Symbolleiste und ihre Bedienelemente in Chat Settings.
- **Game Mode**: Installierte Game-kompatible Agenten lassen sich beim Anlegen eines Spiels auswählen oder später ergänzen. World Maps steuert Kartenarbeitsfläche und Weltkartenansicht nur bei, wenn es für dieses Spiel aktiv ist.

Kompatible Agenten kannst du jederzeit hinzufügen oder entfernen.

## Erkennen, ob ein Agent gelaufen ist

Manche Agenten verändern sofort etwas Sichtbares, andere arbeiten unauffällig. So findest du es heraus.

- Tracker-Agenten schreiben ins HUD und in die Tracker-Panels. Haben sich Zeit, Ort, Stimmung oder Werte geändert, war ein Tracker-Agent am Werk.
- Eine schwebende Statusanzeige zeigt kurze Denk-Meldungen der Agenten, während sie arbeiten – du siehst ihnen also in Echtzeit zu.
- Die Agenten **Prose Guardian** und **Continuity Checker** verändern den Antworttext selbst. Eine geglättete oder korrigierte Antwort ist ein Zeichen dafür, dass sie gelaufen sind.
- Für eine lückenlose Spur aktiviere den **Debug mode** (Debug-Modus) unter **Settings** (Einstellungen), dann **Advanced**, dann **Message Tools**. Er protokolliert Prompt und Antwort jedes Agenten in der Server-Konsole und blendet zusätzlich ein **Agent Debug**-Overlay mit Aufrufen, Tokens und Zeiten pro Agent ein.

Ein erwarteter Agent ist nicht gelaufen? Prüf, ob **Enable Agents** an ist. Prüf, ob der Agent für diesen Chat aktiv ist. Prüf, ob dein Chat-Modus ihn zulässt.

## Verwandte Anleitungen

- [Referenz der herunterladbaren Agenten](built-in-agents.md)
- [2D- und 3D-Avatare](avatars.md)
- [Offizielles Marinara-Agents-Repository](https://github.com/Pasta-Devs/Marinara-Agents)
- [Eigene Agenten erstellen](custom-agents.md)
- [Agent-Freigaben und die Agent Suite](approvals-and-agent-suite.md)
- [Roleplay-HUD und Tracker](../roleplay/hud-and-trackers.md)
