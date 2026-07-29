# Agenten: KI-Helfer für deine Chats

In dieser Anleitung erfährst du, was Agenten in Marinara Engine sind, wie du sie herunterlädst, wann sie laufen und wie du sie für einen Chat aktivierst. Es geht um das **Agents**-Panel (Agenten), den offiziellen Katalog, die Einstellungen pro Chat und die Frage, woran du erkennst, dass ein Agent gelaufen ist. Den kompletten Erstanbieter-Katalog findest du am Ende unter „Verwandte Anleitungen“.

## Was Agenten sind

Agenten sind kleine KI-Helfer, die rund um die Hauptantwort im Chat automatisch mitlaufen. Sie erledigen eng umrissene Aufgaben, während du mit einem Charakter sprichst. Ein Agent führt zum Beispiel Uhrzeit und Wetter mit oder wählt einen Gesichtsausdruck für den Charakter. Ein anderer schreibt die Antwort um und entfernt Wortwiederholungen. Wieder andere generieren ein Bild für einen wichtigen Moment.

Agenten werden pro Chat aktiviert, nicht pro Charakter. Auf einer Charakterkarte gibt es keinen Schalter für Agenten. Zwei Chats mit demselben Charakter können völlig unterschiedliche Agenten nutzen. Welche Agenten laufen, legst du in den Einstellungen des jeweiligen Chats fest.

Frisch installierte Marinara-Engine-Versionen bringen keine optionalen Agenten mit. Das hält die Basis-App und die Termux-Installation klein. Der offizielle Katalog ab v2.3.0 enthält 30 Pakete zum Installieren per Klick: 6 Writer Agents, 8 Tracker Agents und 16 Misc Agents, darunter Long-Term Memory, Maps, Calls und alle sechs Conversation-Spiele. Quellcode, Manifeste, herunterladbare Artefakte und der Katalog auf Repository-Ebene sind öffentlich einsehbar unter [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Die vollständige Beschreibung jedes einzelnen Agenten steht in der [Referenz der herunterladbaren Agenten](built-in-agents.md). Wie du eigene baust, zeigt [Eigene Agenten erstellen](custom-agents.md).

## Die drei Phasen

Jeder Agent läuft an einem von drei Punkten rund um die Antwort. Dieser Punkt heißt **pipeline phase** (Pipeline-Phase). Du stellst ihn im Agent-Editor ein; jeder mitgelieferte Agent bringt bereits einen sinnvollen Standard mit.

- **Pre-Generation**: läuft, bevor die KI ihre Antwort schreibt. So kann der Agent dem Prompt vorab nützlichen Kontext hinzufügen – der Prompt ist der Text, den Marinara an die KI schickt. Agenten, die Wissen nachschlagen, laufen hier.
- **Parallel**: läuft gleichzeitig mit der Antwort. Der Agent wartet die Antwort nicht ab und kann sie auch nicht verändern. Ein Agent für Live-Publikumsreaktionen läuft hier.
- **Post-Processing**: läuft, wenn die Antwort fertig ist. Der Agent kann sie lesen und – bei umschreibenden Agenten – auch bearbeiten. Die meisten Tracker, der Agent zur Textbereinigung und der Bild-Agent laufen hier.

## Das Agents-Panel

Öffne das **Agents**-Panel über die Tabs des rechten Panels (Symbol mit den Funkeln). Hier durchsuchst, erstellst und sortierst du Agenten. Das ist deine Bibliothek – und nicht der Schalter, mit dem du einen Agenten für einen einzelnen Chat ein- oder ausschaltest.

Ein Klick auf **Download Agents** (Agenten herunterladen) oben öffnet den offiziellen Katalog im Vollbild. Das funktioniert am Rechner wie am Handy. Wähle einen Eintrag aus, und du siehst Beschreibung, unterstützten Funktionstyp, Download-Größe, Berechtigungen, Versionskompatibilität und Dokumentation. Über **Install** (Installieren) fügst du ihn hinzu; derselbe Bildschirm bietet sofortige manuelle Updates sowie **Uninstall** (Deinstallieren) für bereits vorhandene Pakete. Zusätzlich prüft Marinara beim Serverstart jedes installierte offizielle Paket und hebt es auf die neueste kompatible Katalogversion an, bevor dessen Laufzeit startet. Ist der Host-Server offline oder lässt sich ein Update nicht verifizieren, laufen die Pakete einfach in ihrer aktuellen Version weiter.

Hinter dem Katalog in der App steht das öffentliche [Repository Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Dort lässt sich jedes Paket und jedes Artefakt einsehen. Für den Normalfall gilt trotzdem: über **Download Agents** installieren, damit Marinara Kompatibilität, Berechtigungen, Hashes, Archivinhalte und nötige Neustarts prüfen kann.

Der Katalog umfasst Chat-Agenten aus erster Hand, World Maps, Audio- und Videoanrufe für Conversation sowie sämtliche optionalen Conversation-Spiele. Installierte Agenten sind in **Writer Agents**, **Tracker Agents** und **Misc Agents** gruppiert, dazu kommt ein Bereich **Custom Agents** für selbst gebaute. Deinstallierst du ein Katalogpaket, verschwinden Code und Einstellungen aus der Engine – Nachrichten und Chatverlauf bleiben erhalten. Löschst du einen eigenen Agenten, ist er endgültig weg.

Kommst du von einer Engine-Version, die diese Funktionen noch fest mitbrachte, lädt Marinara die passenden Pakete einmalig herunter. Chat-Auswahl, Agent-Einstellungen, gespeicherte Laufzeitdaten und Verlauf bleiben dabei bestehen. Erreicht diese Migration den Katalog nicht, versucht sie es beim nächsten Start erneut, statt irgendetwas zu verwerfen.

Automatische Updates beim Start installieren nie ein Paket, das du nicht ausgewählt hast. Installationen auf dem Rechner, unter Docker und unter Android/Termux aktualisieren die Pakete ihres lokalen Servers. iOS, iPadOS und andere Browser-Clients nutzen die Pakete des Marinara-Servers, mit dem sie verbunden sind.

## Agenten für einen Chat aktivieren

Agenten schaltest du innerhalb jedes Chats ein, im Panel **Chat Settings** (Chat-Einstellungen).

1. Öffne den gewünschten Chat.
2. Öffne **Chat Settings** (Zahnrad).
3. Geh zum Abschnitt **Agents**.
4. Aktiviere **Enable Agents** (Agenten aktivieren). Das ist der Hauptschalter. Steht er aus, läuft in diesem Chat kein einziger Agent.
5. Füge aus den Listen unter dem Schalter die gewünschten Agenten hinzu oder entferne die, die du nicht brauchst.

Die hinzugefügten Agenten erscheinen anschließend als aktiv, jeweils mit einer kleinen Schaltfläche zum Entfernen.

Der Abschnitt **Agents** bietet noch ein paar weitere Bedienelemente:

- **Review Agent Outputs** (Agent-Ausgaben prüfen): Ist das aktiv, warten Änderungen an Lorebook, Zusammenfassung und Charakterkarte auf deine Freigabe, bevor sie gespeichert werden. Ein Lorebook ist eine Sammlung von Weltwissen. Ist die Option aus, speichern sich Lorebook- und Zusammenfassungs-Änderungen selbst – Bearbeitungen an der Charakterkarte fragen aber weiterhin bei dir nach. Mehr dazu unter [Agent-Freigaben und die Agent Suite](approvals-and-agent-suite.md).
- **Manual Trackers** (manuelle Tracker, nur in Roleplay-Chats): Ist das aktiv, laufen Tracker-Agenten nicht nach jeder Antwort. Du löst sie von Hand über eine Schaltfläche im HUD aus. HUD steht für Heads-up-Display, die Info-Leiste am oberen Chatrand in Roleplay.
- **Agent Suite**: öffnet eine Ansicht, in der du alles lesen und bearbeiten kannst, was die Agenten für diesen Chat gespeichert haben.

### Der Kostenhinweis

Agenten kosten zusätzliche Tokens und zusätzliche Modellaufrufe – ein Token ist ein kleines Textstück. Jeder Agent bringt eigene Anweisungen mit, oft auch einen eigenen Modellaufruf. Wo möglich, bündelt Marinara Agenten mit derselben Verbindung in einem einzigen Aufruf. Über der Agentenliste schätzt eine Anzeige die Last deiner aktuellen Auswahl. Sie nennt ungefähr, wie viele Tokens an Agent-Anweisungen dazukommen und wie viele zusätzliche Aufrufe pro Zug anfallen.

Wird die Last hoch, färbt sich diese Anzeige bernsteinfarben und zeigt ein Warnsymbol. Die tatsächlichen Kosten pro Zug liegen über dem angezeigten Wert, denn mit jedem Aufruf gehen auch Chatverlauf und Charakterdetails mit. Erscheint die Warnung, entferne nicht benötigte Agenten oder verschiebe einige auf eine günstigere oder lokale Verbindung.

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
- [Offizielles Marinara-Agents-Repository](https://github.com/Pasta-Devs/Marinara-Agents)
- [Eigene Agenten erstellen](custom-agents.md)
- [Agent-Freigaben und die Agent Suite](approvals-and-agent-suite.md)
- [Roleplay-HUD und Tracker](../roleplay/hud-and-trackers.md)
