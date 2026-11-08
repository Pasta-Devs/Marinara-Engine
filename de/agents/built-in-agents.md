# Referenz der herunterladbaren Agenten

Diese Anleitung stellt die offiziellen Erstanbieter-Agenten unter **Agents → Agent Organizer** (Agenten → Agentenverwaltung) vor, nach Gruppen sortiert. In einer frischen Installation sind keine Agenten enthalten. Ihre Quellen und ihr Katalog liegen öffentlich in [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Jeder Eintrag sagt, was der Agent tut, wann er läuft, wo er funktioniert und welche Einstellungen wichtig sind. Wie du Agenten installierst und einschaltest, steht in der [Agenten-Übersicht](agents-overview.md) – lies sie zuerst. Mit **staging only** (nur staging) markierte Einträge sind für Engine-Nutzer auf staging verfügbar; im stabilen Kanal erscheinen sie, sobald das Paket freigegeben ist.

## So liest du diese Referenz

Installiere einen Agenten aus dem **Agent Organizer** und füge ihn dann jedem Chat hinzu, in dem du ihn haben willst. Agenten werden pro Chat eingerichtet, nicht pro Charakterkarte. Installieren, Aktualisieren, die Einrichtung pro Chat und die Kosten behandelt die [Agenten-Übersicht](agents-overview.md).

Jeder Eintrag zeigt dieselben Kurzangaben.

- **Phase** oder **Integration**: wann ein Pipeline-Agent läuft. **Pre-Generation** (vor der Generierung) läuft vor der Antwort und kann Text in den Prompt einfügen. **Parallel** läuft gleichzeitig mit der Antwort und sieht den fertigen Text nicht. **Post-Processing** (Nachbearbeitung) läuft nach der Antwort und kann sie lesen. Manche können sie auch umschreiben. Feature-Pakete wie World Maps, Calls und die Conversation-Spiele klinken sich stattdessen in ihre Chat-Oberfläche ein. Apps öffnen sich in einem eigenen Tab in **Home**.
- **Einsatzbereich**: die Chat-Modi, die den Agenten zulassen. Die meisten Agenten funktionieren in Roleplay.
- **Wichtige Einstellungen**: die Einstellungen, die du am ehesten änderst, auf der Karte des Agenten in **Chat Settings** (Chat-Einstellungen).

Mit einem Laufintervall läuft ein Agent nur einmal alle paar Nutzer- und Assistenten-Nachrichten statt nach jeder Nachricht. Du kannst es auf bis zu 100 setzen.

In Roleplay legst du das Laufintervall von Illustrator pro Chat fest, auf seiner Karte in **Chat Settings**. Der Wert aus seiner Einrichtung ist der Standard für Chats ohne eigenen Wert. Illustrator akzeptiert auch **0**: Dann läuft er nie automatisch und bleibt für Galerieaktionen verfügbar.

## Apps

Apps haben einen eigenen Tab in **Home**. Du nutzt sie eigenständig, statt sie einem Chat hinzuzufügen. Nach der Installation bittet jede um einen Neustart.

### Noodle

Ergänzt die optionale lokale öffentliche Noodle-Timeline in einem eigenen Tab in **Home**. Noodle läuft nicht in der Chat-Agenten-Pipeline.

- **Integration**: Feature-Paket mit lokalen Routen, Generierungs- und Medienabläufen und Zeitplanern, die im Hintergrund laufen.
- **Einsatzbereich**: Home, optional mit Kontext aus Conversation-, Roleplay- und Game-Chats.
- **Wichtige Einstellungen**: Installiere es über **Agents → Agent Organizer** und starte neu, wenn du dazu aufgefordert wirst. In Noodle selbst legst du eingeladene Konten, Text- und Bildverbindungen, Timeline-Aktualisierungen, zufällige Nutzer und das Chat-Carryover fest.
- **Daten**: Nach einem Neustart entfernt eine Deinstallation den Tab und beendet die Zeitplaner. Deine Noodle-Daten bleiben für eine spätere Neuinstallation erhalten.
- **Vollständige Anleitung**: [Noodle: die Social-Timeline in der App](noodle.md).

### Slurp

Eine private Social-App für deine Charaktere. Mach Charaktere und Personas zu Creators, poste öffentliche oder gesperrte Fotos und sieh zu, wie ein simuliertes Publikum folgt, abonniert, kauft, kommentiert und Nachrichten schickt. Standardmäßig ist sie auf Inhalte für Erwachsene ausgelegt. Alles ist nur gespielt: Die Preise sind fiktiv, und es finden keine echten Zahlungen statt.

- **Integration**: App in einem eigenen Tab **Slurp** in **Home**.
- **Einsatzbereich**: Home.
- **Wichtige Einstellungen**: Installiere sie, starte neu, wenn du dazu aufgefordert wirst, und öffne dann **Home → Slurp**. Damit sich die Charaktere eines Chats an die letzten Slurp-Beiträge und -Nachrichten erinnern, schalte in den **Chat Settings** dieses Chats unter **Connected Chats** (verknüpfte Chats) **Include Slurp activity** (Slurp-Aktivität einbeziehen) ein. Zusätzlich muss in den Einstellungen von Slurp das Carryover für diesen Chat-Modus an sein. **Slurp Settings → Autopurge** löscht alte Slurp-Medien, um Speicherplatz zu sparen. Standardmäßig ist es aus.
- **Frühere Namen**: Ältere Kataloge führen sie als **Slurp Remastered**, neben dem eingestellten **Slurp Legacy**, das keine Updates mehr bekommt.
- **Vollständige Anleitung**: [Slurp-Paketanleitung](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/slurp2/README.md).

### Gacha Forge

Ein Gacha-Spiel, das aus einer Welt entsteht, die du beschreibst: Banner zum Ziehen, ein Ensemble, das das Modell schreibt und malt, Story-Kapitel, die ein Visual-Novel-Erzähler vorträgt, dazu Kämpfe, Ausrüstung und Events. Deine Lorebooks können die Welt speisen, aber ein selbst geschriebenes Szenario genügt.

- **Integration**: App in einem eigenen Tab **Gacha Forge** in **Home**.
- **Einsatzbereich**: Home.
- **Wichtige Einstellungen**: Installiere sie, starte neu, wenn du dazu aufgefordert wirst, und öffne dann **Home → Gacha Forge**. Eine Deinstallation entfernt den Tab nach einem Neustart.
- **Vollständige Anleitung**: [Gacha-Forge-Paketanleitung](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/gacha-forge/README.md).

### Modern Life Sim

Eine Lebenssimulation. Du lebst in einer Kleinstadt, in der die Uhr läuft: Du musst deinen Job behalten, Rechnungen bezahlen und auf Energie und Hunger achten. Die Menschen um dich herum stammen aus deinen Charakterkarten, und ein Visual-Novel-Erzähler erzählt die Szenen, auf die es ankommt.

- **Integration**: App in einem eigenen Tab **Life Sim** in **Home**.
- **Einsatzbereich**: Home.
- **Verfügbarkeit**: **Staging only**, ab Engine **2.4.4+** (unter 4.0.0). Die App ist eine Alpha-Version. Ändert ein Update etwas, wovon ein älterer Spielstand abhängt, sagt Life Sim dir das beim Öffnen dieses Spielstands. Du kannst ein neues Leben beginnen oder auf eigenes Risiko weiterspielen.
- **Wichtige Einstellungen**: Installiere sie, starte neu, wenn du dazu aufgefordert wirst, und öffne dann **Home → Life Sim**. Sie braucht eine Textverbindung. Eine Bildverbindung ist optional: Ohne sie zeigen Orte illustrierte Karten. Optionale Module bleiben aus, bis du sie für ein Leben einschaltest. Beim Modul **Adult** (Erwachsene) musst du bestätigen, dass du volljährig bist.
- **Vollständige Anleitung**: [Modern-Life-Sim-Paketanleitung](https://github.com/Pasta-Devs/Marinara-Agents/blob/staging/packages/modern-life-sim/README.md).

### Story Writer

Ein Buch, das du gemeinsam mit dem Modell schreibst. Richte Geschichte, Besetzung und Lorebooks in einer Seitenleiste ein, hinterlasse Autorenanweisungen auf einem Haftzettel, und das Modell schreibt das nächste Kapitel, wenn du darum bittest. Du kannst an jeder Stelle in den Text klicken, um ihn zu ändern, oder das erste Kapitel selbst schreiben.

- **Integration**: App in einem eigenen Tab **Story Writer** in **Home**.
- **Einsatzbereich**: Home.
- **Verfügbarkeit**: benötigt eine Version von Marinara Engine, die neuer ist als **v2.5.1** (die nächste Veröffentlichung oder einen aktuellen Staging-Build).
- **Wichtige Einstellungen**: Installiere sie, starte neu, wenn du dazu aufgefordert wirst, öffne dann **Home → Story Writer** und wähle in ihrer Seitenleiste eine Textverbindung. Geschichten werden auf deinem Marinara-Server gespeichert. Du kannst neue beginnen, zu alten zurückkehren und sie als Markdown oder Klartext herunterladen.
- **Vollständige Anleitung**: [Anleitung zum Paket Story Writer](https://github.com/Pasta-Devs/Marinara-Agents/blob/staging/packages/story-writer/README.md).

## Writer-Agenten

Writer-Agenten formen die Geschichte oder den Schreibstil. Sie geben vor der Antwort eine Richtung vor oder räumen die Antwort danach auf.

### Prose Guardian

Schreibt die letzte Antwort um, um verbotene Wörter und Wiederholungen zu entfernen, ohne die Bedeutung zu ändern. Damit hinderst du ein Modell daran, Formulierungen zu wiederholen oder ein Wort zu überstrapazieren.

- **Phase**: Post-Processing.
- **Einsatzbereich**: Roleplay.
- **Wichtige Einstellungen**: die Textfelder **Banned Words** (verbotene Wörter, Standard ist `ozone`), **Prefer In Writing** und **Remove From Writing**. **Hold Message Until Rewrite** (standardmäßig an) blendet die Antwort aus, bis das Aufräumen fertig ist. Ohne die Option erscheint zuerst die rohe Antwort und wird danach ausgetauscht.

### Continuity Checker

Behebt handfeste Logikfehler in der letzten Antwort, etwa einen Charakter an zwei Orten gleichzeitig oder eine widersprüchliche Zeitlinie. Findet er Probleme, zeigt er eine Checkliste, in der du auswählst, welche Korrekturen übernommen werden.

- **Phase**: Post-Processing.
- **Einsatzbereich**: Roleplay.
- **Wichtige Einstellungen**: der Schalter **Hold Message Until Rewrite**.

### Card Evolution Auditor

Beobachtet, wie sich ein Charakter im Spiel verändert, und schlägt Änderungen an seiner Karte vor. Er ändert nie automatisch etwas. Jeder Vorschlag öffnet das Fenster **Review Character Card Updates**, in dem du ihn annimmst oder ablehnst.

- **Phase**: Post-Processing.
- **Einsatzbereich**: Roleplay.
- **Wichtige Einstellungen**: Standardmäßig läuft er einmal alle 8 Nutzer- und Assistenten-Nachrichten. Siehe [Agent-Freigaben und die Agent Suite](approvals-and-agent-suite.md).

### Narrative Director

Gibt der Geschichte einen einmaligen Schubs, wenn du darum bittest. Ist dieser Agent in einem Roleplay-Chat aktiv, erscheint die Schaltfläche **Push Story**. Klick darauf, um die nächste Antwort scharf zu schalten: Sie treibt dann die Handlung voran oder bringt eine Überraschung ins Spiel.

- **Phase**: Pre-Generation.
- **Einsatzbereich**: nur Roleplay.
- **Wichtige Einstellungen**: **Story Push Mode** (**Natural** spinnt die laufenden Handlungsfäden weiter, **Random Event** bringt eine plausible Überraschung). Außerdem kann er einen verborgenen Langzeit-Handlungsbogen führen, den **Secret Plot**. Siehe [Narrative Director und Secret Plot](../roleplay/narrative-director.md).

### Knowledge Retrieval

Durchsucht vor der Antwort die Lorebooks, die du auswählst, und alle Dateien, die du hochlädst. Er fasst die relevanten Stellen zusammen und fügt diese Zusammenfassung in den Prompt ein. Ein Lorebook ist eine Sammlung von Hintergrundwissen über deine Welt. Die Suche ist schlank und braucht keine eigene Datenbank.

- **Phase**: Pre-Generation.
- **Einsatzbereich**: Roleplay.
- **Wichtige Einstellungen**: **Use chat-active lorebooks**, die Auswahl **Fixed Source Lorebooks** und ein Datei-Upload. Lass ihn nicht zusammen mit Knowledge Router laufen, denn die beiden überschneiden sich. Siehe [Wissensquellen](knowledge-sources.md).

### Knowledge Router

Eine günstigere Alternative zu Knowledge Retrieval. Er liest kurze Beschreibungen deiner Lorebook-Einträge und fügt die passenden Einträge wortwörtlich ein. Am besten funktioniert das, wenn die Einträge gute Beschreibungen haben.

- **Phase**: Pre-Generation.
- **Einsatzbereich**: Roleplay.
- **Wichtige Einstellungen**: **Use chat-active lorebooks** und die Auswahl **Fixed Source Lorebooks**. Ein Abdeckungs-Badge zeigt, wie viel Prozent der Quelleinträge eine Beschreibung haben. Siehe [Wissensquellen](knowledge-sources.md).

## Tracker-Agenten

Tracker-Agenten führen laufend Buch über die Szene, die Charaktere und deine Werte. **Add as Prompt Section** (als Prompt-Abschnitt hinzufügen) fügt die letzte Ausgabe eines Agenten in den Prompt ein, damit das Modell konsistent bleibt. Die Option ist bei allen Trackern außer Expression Engine und Background standardmäßig an.

### World State

Führt Datum, Uhrzeit, Wetter, Ort und die anwesenden Charaktere mit. Das hält die Szene geerdet, damit das Modell nicht vergisst, wo und wann die Geschichte spielt.

- **Phase**: Post-Processing.
- **Einsatzbereich**: Roleplay.
- **Wichtige Einstellungen**: **Add as Prompt Section** (standardmäßig an).

### Expression Engine

Liest die Emotion aus der letzten Antwort und wählt ein passendes Sprite oder einen passenden Gesichtsausdruck für den Charakter. Ein Sprite ist ein Charakterbild, das in der Szene angezeigt wird. Nutze ihn für stehende Charakterbilder, die sich mit der Stimmung ändern.

- **Phase**: Post-Processing.
- **Einsatzbereich**: Roleplay.
- **Wichtige Einstellungen**: **Sprite Source** (**Expressions**, **Full-body** oder beides), der Schalter **Expression Avatars**, die Auswahl **Sprite Owners** sowie Regler für Größe und Deckkraft. Siehe [Charakter-Sprites](../characters/sprites.md).

### Quest Tracker

Verwaltet Quest-Ziele, ihren Abschluss und die Belohnungen. Nutze ihn für abenteuerlastiges Spiel, bei dem du eine sichtbare Aufgabenliste willst.

- **Phase**: Post-Processing.
- **Einsatzbereich**: Roleplay.
- **Wichtige Einstellungen**: **Add as Prompt Section** (standardmäßig an).

### Background

Wählt aus deinen hochgeladenen Hintergründen den besten für die aktuelle Szene. Er erzeugt keine Bilder. Für generierte Szenenhintergründe nutzt du Illustrator.

- **Phase**: Post-Processing.
- **Einsatzbereich**: Roleplay.
- **Wichtige Einstellungen**: die üblichen Steuerelemente für Agent-Verbindung und Kontext. Er wählt nur aus Bildern, die schon in deiner Hintergrund-Bibliothek liegen.

### Character Tracker

Führt die anwesenden Charaktere mit, dazu ihre Stimmung, Handlungen, Aussehen, Kleidung, Gedanken und Werte pro Charakter wie HP. Für neue Charaktere ohne Porträt kann er außerdem Porträts erzeugen.

Eine Karte, die mehrere Personen beschreibt, etwa eine Szenariokarte mit einer Besetzung, lässt sich pro Person verfolgen. Kennzeichne jede Person im Kartentext mit einer Überschrift `[CHARACTER: Name]` oder einem Feld `Name:`. Jedes Mitglied behält seinen eigenen Namen, seine Stimmung, Kleidung, Gedanken und sein Porträt. Das Porträt der Karte teilen sie sich nicht. Ein alter Eintrag mit dem Namen der Karte bleibt bestehen, bis der Tracker ein einzelnes Mitglied meldet, das ihn ersetzt. Manuell hinzugefügte Charaktere behalten ihre manuelle Identität.

Kehrt ein Charakter zurück, nachdem er die Szene verlassen hat, übernimmt der Tracker seine zuletzt gespeicherten Werte und benutzerdefinierten Felder. Charaktere mit eigener Karte erhalten außerdem ihre konfigurierten RPG-Pools und Attribute. In einer Roleplay-Gruppe im Modus Merged können die anwesenden Charaktere auch festlegen, welche Charakterkarten bei der nächsten Antwort aktiv sind. Siehe [Aktive Charaktere automatisieren](../chats/group-chats.md#automate-active-characters-merged-only).

- **Phase**: Post-Processing.
- **Einsatzbereich**: Roleplay.
- **Wichtige Einstellungen**: **Add as Prompt Section** (standardmäßig an) und die optionale Einstellung **Auto-Generate NPC Avatars** mit einer eigenen Auswahl für die Bildverbindung. **Include the outfit in portraits** (Kleidung in Porträts einbeziehen) ist standardmäßig an. Schalte es aus, damit Porträts allein aus dem Aussehen entstehen.

### Beholder

Erfasst für jeden Charakter die Kleidung nach Körperbereich, gehaltene Gegenstände, Wunden, fehlende Körperteile, ausdrücklich unbedeckte Bereiche und nichtmenschliche Spezies. Sein neuester validierter Snapshot erscheint in Beholders Schublade in den **Chat Settings** eines Roleplay-Chats. Er geht an den nächsten Tracking-Aufruf von Beholder und an die nächste Hauptantwort.

- **Phase**: Post-Processing.
- **Einsatzbereich**: nur Roleplay.
- **Wichtige Einstellungen**: Füge ihn unter **Chat Settings → Agents → Tracker Agents** hinzu und öffne dann **Configure Beholder**, um Verbindung, Modell, Prompt, Kontext und Ausgabelimits zu wählen. **Add as Prompt Section** ist standardmäßig an.
- **Prompt-Vorlage**: Wähl die Vorlage, die zum Modell hinter Beholders Verbindung passt. Marinara kann das Modell nicht erkennen, deshalb wählst du sie von Hand. Eine falsche Wahl ist nicht fatal, liefert aber schlechtere Ergebnisse.
  - **SOTA model — one prompt** (SOTA-Modell, ein Prompt; Standard): ein Aufruf für alle erfassten Felder. Nimm ein starkes allgemeines Modell.
  - **Beholder local model — five passes** (lokales Beholder-Modell, fünf Durchläufe): fünf eng gefasste Aufrufe, einer pro erfasstem Bereich, für den eigens trainierten [Beholder](https://huggingface.co/GetBeholder/Beholder-GGUF)-Extraktor, der auf deinem Computer läuft (zum Beispiel `Beholder-Q8_0.gguf` hinter koboldcpp oder llama.cpp). Dieses Modell beantwortet jeweils nur einen Bereich, deshalb liefert die Einzel-Prompt-Vorlage nur einen Teilzustand. Es läuft offline und kostenlos.
- **Ursprung**: übernommen aus [GetBeholder/Beholder-ME](https://github.com/GetBeholder/Beholder-ME), lizenziert unter AGPL-3.0-only. Das offizielle Paket lädt weder das DOM noch die Polling- oder Local-Storage-Laufzeit der alten Erweiterung.

### Persona Stats

Führt Statusleisten für deinen eigenen Charakter mit, etwa Sättigung, Energie und Hygiene, dazu alle eigenen Leisten, die du hinzufügst. Nutze ihn für Survival- oder Lebenssimulations-Spiel.

- **Phase**: Post-Processing.
- **Einsatzbereich**: Roleplay.
- **Wichtige Einstellungen**: **Add as Prompt Section** (standardmäßig an). Siehe [Charakterfarben und Roleplay-Werte](../characters/colors-and-stats.md).

### Custom Tracker

Führt Felder mit, die du selbst definierst, etwa Währungen, Zähler oder Marker. Nutze ihn, wenn die eingebauten Tracker etwas nicht abdecken, das deine Geschichte braucht.

- **Phase**: Post-Processing.
- **Einsatzbereich**: Roleplay.
- **Wichtige Einstellungen**: **Add as Prompt Section** (standardmäßig an).

### Inventory Tracker

Führt Geld, angelegte Ausrüstung und mitgeführte Gegenstände in drei strukturierten Listen. Doppelte Namen werden zusammengeführt, und gesperrte Zeilen bleiben bei späteren Tracker-Durchläufen unverändert.

- **Phase**: Post-Processing.
- **Einsatzbereich**: Roleplay.
- **Wichtige Einstellungen**: **Add as Prompt Section** (standardmäßig an). Im HUD und im Tracker Panel kannst du jeden Namen und jede Menge bearbeiten und sperren.

### Quartermaster

Verwaltet das Inventar der aktiven Persona, Ausrüstungsplätze, Gegenstandsmengen, Lagerorte und gespeicherte Outfits. Er liest nach den Antworten die Geschichte und übernimmt Änderungen an Gegenständen. Über ein schwebendes Dock und das Tracker Panel bearbeitest du dasselbe Inventar von Hand. Bilder für Gegenstände und Outfits sind optional.

- **Phase**: Post-Processing; spätere Antworten erhalten den Inventarkontext.
- **Einsatzbereich**: Roleplay. Er verfolgt die aktive Persona, keine Gruppenmitglieder oder NPCs (Nicht-Spieler-Charaktere).
- **Verfügbarkeit**: benötigt Engine **2.4.6+**.
- **Einrichtung**: Installiere ihn und starte neu, wenn du dazu aufgefordert wirst. Schalte in jedem Roleplay-Chat unter **Chat Settings → Agents** die Agenten ein, füge Quartermaster unter **Tracker Agents** hinzu und wähle seine Modellverbindung. Öffne das Dock über die Schaltfläche oberhalb des Tracker Panel.
- **Wichtige Bedienelemente**: Gegenstände ausrüsten und einlagern, Outfits speichern, das Inventar wiederherstellen oder letzte Tracker-Änderungen zurücknehmen und die Einrichtung eines Chats exportieren oder importieren. Die Bilderzeugung nutzt eine eigene Bildverbindung. Lies die [Quartermaster-Paketanleitung](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/quartermaster/README.md), bevor du das Aussehensmakro oder das Ersetzen des Avatars einschaltest.

### Relationship Tracker

Pflegt ein bearbeitbares Beziehungsnetz für die Charakterkarten eines Roleplay-Gruppenchats, dazu die Sicht jedes Charakters auf die aktive Persona. Beziehungen sind positiv, neutral, negativ oder kompliziert. Manuelle Sperren schützen deine Bearbeitungen vor automatischen Änderungen.

- **Phase**: Post-Processing; spätere Antworten erhalten den Beziehungskontext.
- **Einsatzbereich**: Roleplay-Gruppenchats.
- **Verfügbarkeit**: benötigt Engine **2.4.4+** (unter 4.0.0).
- **Einrichtung**: Installiere ihn und starte neu, wenn du dazu aufgefordert wirst. Schalte in jedem Roleplay-Chat unter **Chat Settings → Agents** die Agenten ein, füge ihn unter **Tracker Agents** hinzu und wähle seine Modellverbindung. Das Netz erscheint im Tracker Panel. Wähle dort einmal **All relationships** (alle Beziehungen) oder **Scene-only relationships** (nur Beziehungen der Szene), um den Chat zu starten.
- **Wichtige Bedienelemente**: **All relationships** oder **Scene-only relationships** für den Prompt-Kontext, **Update from History** (aus dem Verlauf aktualisieren) für einen Scan der letzten Nachrichten, manuelles Bearbeiten und Sperren sowie **Resume automatic updates** (automatische Aktualisierungen fortsetzen). **Context Size** (Kontextgröße; standardmäßig 5 Nachrichten), **Presence lookback** (Rückblick für Anwesenheit; standardmäßig 15) und die Nachrichtenanzahl des Verlaufsscans sind getrennte Einstellungen. Siehe die [Relationship-Tracker-Paketanleitung](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/relationship-tracker/README.md).

### Memory Nag

Führt für jeden Roleplay-Chat einen kurzen, bearbeitbaren Erinnerungstresor. Er scannt den Chat in Stapeln, ordnet Erinnerungen nach aktuellen und früheren Beteiligten und verschiebt erledigte Erinnerungen in eine wiederherstellbare Liste „Resolved“. Wenn der genaue Wortlaut wichtig ist, kann eine Erinnerung eine kurze Dialogzeile wortwörtlich bewahren.

Nach jeder Antwort übergibt ein Wortabgleich dem Tracker nur die relevantesten aktiven Erinnerungen. Der Tracker entscheidet, ob die Szene nach einem Hinweis verlangt, und kann nur aus diesen Erinnerungen wählen. Beim Abruf kann er keine neue Erinnerung anlegen.

- **Phase**: Post-Processing.
- **Einsatzbereich**: nur Roleplay.
- **Wichtige Einstellungen**: **Vault scan connection** (Standard: die Agent-Verbindung), **Messages per batch** (20), **Maximum memories created per character** (10), **Maximum memories considered per character** (5) und **Maximum memories injected** (3). Nutze **Scan chat** für die erste Erfassung des bisherigen Verlaufs und **Open vault**, um Erinnerungen zu suchen, hinzuzufügen, zu bearbeiten, als erledigt zu markieren, wiederherzustellen oder zu löschen.
- **Prompt-Platzierung**: Ohne Preset-Marker landen ausgewählte Hinweise bei der nächsten Antwort in `<context><memory_nags>…</memory_nags></context>`. Füge einen Abschnitt „Memory Nag Agent“ hinzu, um sie selbst zu platzieren.
- **Daten**: Der Tresor gehört zu genau einem Chat und bleibt erhalten, wenn das Paket ausgeschaltet oder deinstalliert wird. Das Löschen einer Erinnerung ist endgültig und fragt immer vorher nach.

### World Maps

Ergänzt eine Geschichte um verschachtelte Orte und räumliche Verknüpfungen. Du legst Regionen, Gebiete, Räume und Verbindungen an, bewegst dich zwischen Orten, und die aktuelle Position fließt als räumlicher Kontext in die Generierung ein. Im Game Mode kommt außerdem eine Weltkarten-Ansicht dazu.

- **Integration**: Feature-Paket mit Kartenoberfläche und Chat-Kontext statt eines Agenten in einer Generierungsphase.
- **Einsatzbereich**: Roleplay und Game.
- **Wichtige Einstellungen**: Schalte es für einen Roleplay-Chat unter **Chat Settings → Agents** ein, oder wähle es beim Anlegen eines Spiels aus und verwalte es in den Einstellungen dieses Spiels. Installation und Entfernung erfordern einen Neustart.
- **Vollständige Anleitung**: [World Maps: Einrichten, Erstellen und Reisen](hierarchical-maps.md).

## Misc-Agenten

Misc-Agenten liefern Extras wie Bilder, Musik, Publikumsreaktionen und Aktualisierungen von Karten.

### Echo Chamber

Simuliert ein Live-Publikum, das auf deine Szene reagiert, in einem schwebenden **Echo**-Widget im Chatbereich. Alle 30 Sekunden zeigt er eine neue Reaktion.

- **Phase**: Parallel.
- **Einsatzbereich**: Roleplay.
- **Wichtige Einstellungen**: Wähl einen Stil wie **AO3 / Wattpad**, **Twitter / Reddit**, **4chan**, **Constructive**, **Hype Squad** oder **Harbingers**. Im Widget gibt es **Re-run Echo Chamber** und **Clear messages**.

### Long-Term Memory

Extrahiert dauerhafte Erinnerungen aus Chat-Zusammenfassungen, Charakteraufzeichnungen und Lorebooks in einen paketeigenen Tresor und ruft vor der Hauptantwort passenden Kontext ab. Er unterstützt das Durchsuchen des Tresors, den Import von Quellen, die Prüfung ausstehender Entwürfe und die Platzierung über Preset-Marker.

- **Integration**: Feature-Paket mit Kontext vor der Generierung und einer Oberfläche zur Verwaltung der Erinnerungen.
- **Einsatzbereich**: Conversation, Roleplay und Game.
- **Wichtige Einstellungen**: Token-Budget für den Abruf (128–16.384), Höchstzahl abgerufener Abschnitte (1–100), Bewertungsschwelle, Kontext der letzten Nachrichten (1–20), Abrufstil, Suchgewichtungen, Einbeziehung erledigter Erinnerungen, Abruf-Präambel, Extraktionseinstellungen, Quellengrenzen, Prompt-Vorlagen, KI-Schlüsselwortextraktion und Extraktion im Game Mode.
- **Daten**: Mit den Backup-Steuerelementen in Memory Settings exportierst oder ersetzt du Tresor, Entwürfe und Einstellungen. **Delete all data** entfernt Erinnerungen, Entwürfe, Aktivität und Indizes dauerhaft, behält aber die Einstellungen. Beim Deinstallieren bleibt der Tresor für eine spätere Neuinstallation erhalten. Installieren, Aktualisieren und Entfernen erfordern einen Neustart.
- **Kompatibilität**: Engine `2.3.5` bis ausschließlich `4.0.0`. Berechtigungen: `agent-runtime`, `chat-read`, `chat-write`, `routes`, `storage`, `ui`.

### Illustrator

Erzeugt Bilder und Videos. Er schreibt visuelle Prompts für wichtige Momente und schickt sie an deinen Bild- oder Videodienst.

- **Phase**: Post-Processing.
- **Einsatzbereich**: Roleplay.
- **Wichtige Einstellungen**: Illustrator läuft standardmäßig einmal alle 5 Nutzer- und Assistenten-Nachrichten. Um das zu ändern, setz **Image Run Interval** (Bild-Laufintervall) auf seiner Karte im jeweiligen Roleplay-Chat. Automatische Clips nutzen **Video Run Interval** (Video-Laufintervall), wenn **Illustrator makes** auf **Pictures and clips** oder **Clips only** steht. Setz **Video Run Interval** auf **0**, um automatische Clips auszuschalten. Zu den Einstellungen gehören **Prompt Model**, **Image Style**, **Attach Card Appearance** und **Send Avatar References**. Die komplette Einrichtung steht unter [Illustrator-Agent](../media/illustrator-agent.md).

### Lorebook Keeper

Legt aus wichtigen Fakten deines Chats Lorebook-Einträge an und aktualisiert sie, sodass deine Weltnotizen beim Spielen mitwachsen.

- **Phase**: Post-Processing.
- **Einsatzbereich**: Roleplay. Im Game Mode erledigt eine Variante für das Sitzungsende namens **Game Session Keeper** dieselbe Aufgabe.
- **Wichtige Einstellungen**: Läuft standardmäßig einmal alle 8 Nutzer- und Assistenten-Nachrichten. **Target Lorebook** bestimmt, wohin die Einträge gehen, auch mit einer Option zur automatischen Auswahl. Erweiterte Prompts können den Namen eines beschreibbaren Lorebooks oder einen Alias wie `world`, `npc`, `scene` oder `player` zurückgeben. Fehlende Alias-Ziele werden angelegt und mit dem Chat verknüpft. Ohne Ziel bleibt das Verhalten mit einem einzigen Lorebook bestehen.

### Combat

Verwaltet Kämpfe: Initiative, HP und Zugreihenfolge. Ist er aktiv, erscheint über dem Nachrichtenfeld die Schaltfläche **Encounter**.

- **Phase**: Parallel.
- **Einsatzbereich**: Roleplay.
- **Wichtige Einstellungen**: Er bringt ein Würfelwurf-Tool für die Auflösung der Züge mit.

### Immersive HTML

Ergänzt die letzte Antwort um visuelle Elemente aus der Spielwelt, etwa eine gestaltete Notiz oder einen Bildschirm, ohne die Geschichte zu verändern.

- **Phase**: Post-Processing.
- **Einsatzbereich**: nur Roleplay.
- **Wichtige Einstellungen**: der Schalter **Hold Message Until Rewrite**.

### Music DJ

Liest die Stimmung der Szene und spielt passende Musik. Möglich sind Spotify, YouTube oder lokale Audiodateien.

- **Phase**: Post-Processing.
- **Einsatzbereich**: Roleplay und Game.
- **Wichtige Einstellungen**: Die Einstellung **Music Player** wählt den Anbieter, und jeder Anbieter braucht seine eigene Einrichtung. Alle Schritte für Spotify, YouTube und lokale Musik stehen unter [Music DJ](../media/music.md).

### Haptic Feedback

Liest die Erzählung mit und steuert daraus in Echtzeit verbundene Intim-Spielzeuge über Intiface Central. Intiface Central muss bereits laufen und ein Spielzeug verbunden sein, bevor du diesen Agenten aktivierst.

- **Phase**: Post-Processing.
- **Einsatzbereich**: Conversation, Roleplay und Game.
- **Wichtige Einstellungen**: die Auswahl **Touch Sensitivity** (**Subtle**, **Standard** oder **Intense**) und das Feld **Intiface URL**. Die Empfindlichkeit lenkt die Entscheidungen des Agenten, ohne den verfügbaren Intensitätsbereich von `0.0-1.0` zu begrenzen. Die komplette Einrichtung steht unter [Haptisches Feedback einrichten](../integrations/haptic-feedback.md).

### CYOA Choices

Hängt nach jeder Antwort anklickbare Auswahlschaltflächen „What will you do?“ an, für ein Spielbuch-Gefühl. Jede Schaltfläche enthält eine vollständige Handlung, die du mit einem Klick abschickst.

- **Phase**: Post-Processing.
- **Einsatzbereich**: Roleplay.
- **Wichtige Einstellungen**: **Edit** schreibt die Auswahlmöglichkeiten um, **Re-roll** erzeugt neue. Sollen angeklickte Auswahlmöglichkeiten in deinem Nachrichtenfeld landen, schalte unter **Settings → General → Input & Editing** (Einstellungen → Allgemein → Eingabe und Bearbeitung) die Einstellung **Add CYOA choices to the message box instead of sending them** (CYOA-Auswahlmöglichkeiten ins Nachrichtenfeld einfügen, statt sie abzuschicken) ein.

### Storyboard

Plant Storyboards als Standbilder oder Animationen aus abgeschlossenen Roleplay-Wortwechseln und der Erzählung im Game Mode. Getrennte Planung und anbieterabhängige Formatierung erhalten die Reihenfolge der Geschichte, die Identität der Charaktere und den gewählten Stil über Keyframes und Videos hinweg.

- **Integration**: Agent-Paket; Game und Roleplay nutzen seine Prompt-Vorlagen und Einstellungen über die Storyboard-Integration der Engine.
- **Einsatzbereich**: Roleplay und Game.
- **Wichtige Einstellungen**: Planer für Standbild oder Animation, Bild- und Videoverbindungen, Anzahl der Keyframes, Dauer, Anzeigemodus, Umgang mit Charakterreferenzen, Episoden- und Stilvorlagen für Roleplay sowie Illustrations- und Videovorlagen für Game.
- **Kompatibilität**: Engine `2.3.5` bis ausschließlich `3.0.0`. Berechtigungen: `agent-runtime`, `chat-read`, `prompt-context`, `storage`, `ui`. Kein Neustart nötig.
- **Vollständige Anleitung**: [Anleitung zum Storyboard-Agenten](../game/storyboard.md).

### 2D Avatars

Zeigt Charaktere und Personas als animierte 2D-Avatare, die blinzeln, sprechen und mit jeder Antwort das Gesicht wechseln. Ein Avatar besteht entweder aus Sprites im PNGTuber-Stil (deinen Ausdrucks-Sprites mit Bildern zum Blinzeln und Sprechen) oder aus einer Mesh-Avatar-Datei (`.mavatar`).

- **Integration**: Agent-Paket. Die Engine zeichnet die Avatare. Während du chattest, schickt es keine zusätzlichen Anfragen an deine KI-Verbindungen.
- **Einsatzbereich**: Roleplay und Game, für Charaktere und Personas.
- **Verfügbarkeit**: bei jeder Installation im **Agent Organizer**. Benötigt Marinara Engine 2.5.1 oder neuer.
- **Wichtige Einstellungen**: Richte jeden Avatar auf der Seite des Agenten unter **Agents** ein. Der Agent bringt außerdem die Prompts mit, die aus einem Sprite Bilder zum Blinzeln und Sprechen sowie einen Mesh-Avatar machen.
- **Kompatibilität**: Engine `2.5.0` bis ausschließlich `4.0.0`, Capability API 1.73. Berechtigungen: `agent-runtime`, `chat-read`, `storage`, `ui`. Kein Neustart nötig.
- **Vollständige Anleitung**: [2D- und 3D-Avatare](avatars.md).

### 3D Avatars

Zeigt Charaktere und Personas als animierte 3D-Modelle, die blinzeln, sprechen und mit jeder Antwort das Gesicht wechseln. Er unterstützt VRM-Modelle (`.vrm`, Versionen 0.x und 1.0) mit einer optionalen Idle-Animation (`.vrma`), MMD-PMX-Modelle sowie geriggte GLB- und FBX-Modelle, deren Knochen über ihre Namen zugeordnet werden.

- **Integration**: Agent-Paket. Die Engine zeichnet die Avatare. Während du chattest, schickt es keine zusätzlichen Anfragen an deine KI-Verbindungen.
- **Einsatzbereich**: Roleplay und Game, für Charaktere und Personas.
- **Verfügbarkeit**: bei jeder Installation im **Agent Organizer**. Benötigt Marinara Engine 2.5.1 oder neuer.
- **Wichtige Einstellungen**: Richte jeden Avatar auf der Seite des Agenten unter **Agents** ein.
- **Kompatibilität**: wie bei 2D Avatars.
- **Vollständige Anleitung**: [2D- und 3D-Avatare](avatars.md).

### Calls

Ergänzt Live-Audio- und -Videoanrufe mit Conversation-Charakteren: selbst gestartete und eingehende Anrufe, reine Anruf-Transkripte, Text-to-Speech, Mikrofoneingabe und Videoclips von Charakteren.

- **Integration**: Conversation-Feature-Paket mit Steuerelementen in der Werkzeugleiste, im Chat und in den Chat Settings.
- **Einsatzbereich**: Conversation.
- **Wichtige Einstellungen**: Öffne **Chat Settings → Agents → Calls**, um Anrufe einzuschalten und Sprachausgabe, Mikrofon, Klingeln und Videoverhalten festzulegen. Siehe [Audio- und Videoanrufe in Conversation](../conversation/calls.md). Installation und Entfernung erfordern einen Neustart.

### UNO

Bringt einen regelgetreuen UNO-Tisch für dich und Conversation-Charaktere, mit Hausregeln und zwei bis zehn Mitspielenden.

- **Integration**: Conversation-Spielepaket.
- **Einsatzbereich**: Conversation.
- **Wichtige Einstellungen**: Starte es über die Spieleauswahl oder mit `/uno` und wähle dann Mitspielende und Hausregeln. Installation und Entfernung erfordern einen Neustart.

### Chess

Bringt ein Schachbrett für zwei, das nur legale Züge zulässt, Schach und Schachmatt erkennt, geschlagene Figuren zeigt und den Gegner im Charakter ziehen lässt.

- **Integration**: Conversation-Spielepaket.
- **Einsatzbereich**: Conversation.
- **Wichtige Einstellungen**: Starte es über die Spieleauswahl oder mit `/chess` und wähle dann den Gegner und deine Farbe. Installation und Entfernung erfordern einen Neustart.

### Poker

Bringt einen Texas-Hold'em-Tisch für zwei bis acht Mitspielende, mit Blinds, Setzrunden, Side Pots, Showdowns und Gegnern, die im Charakter bleiben.

- **Integration**: Conversation-Spielepaket.
- **Einsatzbereich**: Conversation.
- **Wichtige Einstellungen**: Starte es über die Spieleauswahl oder mit `/poker` und wähle dann Mitspielende, Start-Chips und Blinds. Installation und Entfernung erfordern einen Neustart.

### 8-Ball Pool

Bringt einen Billardtisch für zwei mit vollen und halben Kugeln, Zielen und Stoßstärke, Fouls, Ball-in-Hand und Stößen des Gegners im Charakter.

- **Integration**: Conversation-Spielepaket.
- **Einsatzbereich**: Conversation.
- **Wichtige Einstellungen**: Starte es über die Spieleauswahl oder mit `/8ball` und wähle dann den Gegner. Installation und Entfernung erfordern einen Neustart.

### Tic-Tac-Toe

Bringt ein Tic-Tac-Toe-Feld für zwei, mit gewählten oder zufälligen Zeichen, Zugabwicklung sowie Erkennung von Sieg und Unentschieden.

- **Integration**: Conversation-Spielepaket.
- **Einsatzbereich**: Conversation.
- **Wichtige Einstellungen**: Starte es über die Spieleauswahl oder mit `/tictactoe` (alternativ `/ttt`) und wähle dann Gegner und Zeichen. Installation und Entfernung erfordern einen Neustart.

### Rock-Paper-Scissors

Bringt eine Partie Schere-Stein-Papier für zwei, bei der beide Entscheidungen bis zur Auflösung verborgen bleiben.

- **Integration**: Conversation-Spielepaket.
- **Einsatzbereich**: Conversation.
- **Wichtige Einstellungen**: Starte es über die Spieleauswahl oder mit `/rps` und wähle dann den Gegner sowie ein Match über drei, fünf oder sieben Partien. Installation und Entfernung erfordern einen Neustart.

## Verwandte Anleitungen

- [Agenten im Überblick](agents-overview.md)
- [Illustrator-Agent](../media/illustrator-agent.md)
- [Music DJ](../media/music.md)
- [Haptisches Feedback einrichten](../integrations/haptic-feedback.md)
- [Wissensquellen](knowledge-sources.md)
- [Narrative Director und Secret Plot](../roleplay/narrative-director.md)
- [Audio- und Videoanrufe in Conversation](../conversation/calls.md)
- [Conversation-Tischspiele](../conversation/table-games.md)
