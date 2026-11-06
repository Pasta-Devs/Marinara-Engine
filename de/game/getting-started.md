# Game Mode: Erste Schritte

Game Mode macht aus Marinara Engine ein Einzelspieler-Rollenspiel, das eine KI als Game Master leitet. In dieser Anleitung erfährst du, wie du ein Spiel startest, den ersten Zug spielst und die Bedienelemente findest.

Game Mode ist einer der drei Chat-Modi (Conversation, Roleplay und Game Mode). Der Game Master (GM) ist die KI, die die Welt erzählt, jeden Charakter spielt, dem du begegnest, und entscheidet, wie es weitergeht – wie der Dungeon Master am Spieltisch. Marinara führt die Karte, deine Party (deine Abenteuergruppe), Nicht-Spieler-Charaktere (NPCs), Gegenstände, Quests, die Zeit in der Spielwelt und das Wetter mit. Ein langes Spiel lässt sich in mehrere **Sitzungen** aufteilen, wie die Spieleabende einer Kampagne.

Du musst nicht jede Mechanik nutzen. Du kannst Kampf und Würfel weglassen und für die Geschichte spielen.

## Bevor du startest

Du brauchst genau eine Sache: ein KI-Konto für den Game Master. Falls du noch keins hinzugefügt hast, siehe [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).

Alles Weitere ist optional und standardmäßig aus. Du kannst es später ergänzen:

- **Bilder.** Der Agent **Illustrator** zeichnet NPC-Porträts, Hintergründe für Orte und Szenenbilder. Lade ihn unter **Agents → Agent Organizer** (Agenten → Agentenverwaltung) herunter. Er braucht ein Bildkonto. Ohne ihn bekommst du weiterhin die Geschichte, die Zustandsverfolgung und den Kampf, aber die visuellen Flächen bleiben leer.
- **Szeneneffekte vom eingebauten Modell.** Marinara kann ein kleines Modell auf deinem eigenen Computer laufen lassen, das kostenlos Hintergründe und Musik auswählt. Sobald du es heruntergeladen hast, wird es zum Standard für **Scene effects model** (Modell für Szeneneffekte). Bis dahin ist der Standard **Skip - use inline tags from GM** (überspringen, Inline-Tags des GM nutzen). Siehe [Eingebautes Modell einrichten](../connections/local-model.md).
- **Storyboards.** Lade den Storyboard-Agenten herunter und schalte ihn dann für das Spiel ein. Siehe [Anleitung zum Storyboard-Agenten](storyboard.md).
- **Video.** Ein Videokonto brauchst du nur für Szenenvideos oder animierte Storyboards.
- **Musik.** Der Agent **Music DJ** spielt Musik von Spotify oder aus einem lokalen Musikordner.

## Ein Spiel starten

1. Öffne in der Chat-Seitenleiste den Tab **GM** und klick auf die Schaltfläche **+** (**New Game**). Oder klick auf dem Home-Bildschirm auf **Game**. Der Einrichtungsassistent öffnet sich. Siehe [Die Chatliste verwalten](../chats/managing-chats.md).
2. Wähle im ersten Schritt das **Model** (Modell), auf dem der GM läuft. Nimm ein Konto, das du schon hinzugefügt hast. Ist die Liste leer, füge zuerst eines hinzu. Wähle für die Weltgenerierung ein starkes kostenpflichtiges Modell (siehe [Ein Modell auswählen](#choosing-a-model)).
3. Klick bei jedem Schritt auf **Next** (Weiter). Alle anderen Felder haben einen Standardwert, du kannst also einfach durchklicken.
4. Klick im letzten Schritt auf **Create world** (Welt erstellen). Die Schaltfläche zeigt **Generating World…**, während Marinara deine Welt baut. Das ist eine einzige große Anfrage an dein Modell, warte also, bis sie fertig ist.
5. Ist die Welt fertig, zeigt der Spielbildschirm **Start Game** (Spiel starten). Klick darauf. Danach schreibt der GM die erste Nachricht.

Sind eigene HUD-Widgets eingeschaltet (der Standard), sitzt unter **Start Game** eine Schaltfläche **Review Starting Widgets** (Start-Widgets prüfen). Du kannst sie überspringen oder damit zuerst die Start-Widgets ändern. Siehe [Game Mode: HUD-Widgets](hud-widgets.md).

> **Tipp:** Bist du neu in Game Mode, lass **Game Master Mode** (Game-Master-Modus) auf **Standalone GM**. Marinara baut dir einen schnippischen Erzähler.

Wenn es nicht funktioniert hat, siehe [Die Weltgenerierung scheitert mit einem JSON- oder 422-Fehler](#world-generation-fails-with-a-json-or-422-error).

### Der Einrichtungsassistent

| Schritt | Was du festlegst |
| --- | --- |
| **Connection** | **Game Name** (Spielname), das **Model**, auf dem der GM läuft, und optional ein **Scene effects model**. Die Karte **Game Mode** zeigt vorerst nur **VN** (siehe [VN oder Overworld](#vn-or-overworld)). |
| **World** | Genre, Schauplatz, Ton, Schwierigkeit, Inhaltsfreigabe und Sprache. **Combat Preference** (bevorzugte Kampfart) ist **Turn-Based** oder **Tactical**. Jedes neue Spiel nutzt **MRPG**-Klassen (Marinara RPG; siehe [MRPG-Klassen](mrpg-classes.md)). Ist ein Regelsatz installiert, erscheint eine Auswahl **Rules** (Regeln). Siehe [Regeln auswählen](#choose-rules). |
| **Party** | Deine Persona (der Charakter, den du spielst), **Game Master Mode**, Partymitglieder und **GM intro message** (Intro-Nachricht des GM). Siehe [Die Intro-Nachricht des GM](#the-gm-intro-message). |
| **Goals** | Was du dir vom Abenteuer wünschst. |
| **Lorebooks** | Lorebooks, die der GM als verbindlich behandelt. Ein Lorebook ist eine Sammlung von Hintergrundfakten zur Welt. Siehe [Lorebooks](../lorebooks/overview.md). |
| **Features** | **Enable Agents** (Agenten aktivieren), dann eine Karte für jeden heruntergeladenen Agenten (**Illustrator**, **Music DJ**, **Lorebook Keeper**), dazu **Custom HUD Widgets** (eigene HUD-Widgets), **Quick Time Events** und **Start Muted** (stumm starten). |
| **GM** | Der Präsentationsstil und der **GM Prompt**. |

Die Ideen, die unter dem Schauplatz und den Zielen angeboten werden, wechseln bei jedem Öffnen des Assistenten. In einem Tactical-Spiel schreibt der GM für jeden Kampf eine kurze Vorgabe, aus der Marinara ein Spielfeld baut. Siehe [Kampf](combat.md#tactical-battles-and-terrain).

Der Schritt **World** hat außerdem Kampfoptionen für Bosse. **GM directs bosses** (GM steuert Bosse) ist standardmäßig an. Damit entscheidet der GM die Züge der Bosse über deine GM-Verbindung, was einen Moment dauern kann. Gewöhnliche Gegner entscheiden selbst, außer **GM directs bosses** ist an und der Regelsatz des Spiels überlässt die Gegenseite dem Game Master (siehe [Text für den Game Master](../extending/ruleset-sheets.md#game-master-text)). Solange **GM directs bosses** an ist, lässt **Game Master also plays named and brilliant opponents** (Game Master spielt auch benannte und brillante Gegner, standardmäßig an) den GM auch benannte Charaktere und sehr kluge Gegner spielen. Zwei weitere Optionen werden immer angezeigt: **Companions fight on their own** (Begleiter kämpfen selbstständig) ist standardmäßig an; schalte es aus, um die ganze Party selbst zu spielen. **Let cruel opponents strike the fallen** (grausame Gegner auf Gefallene einschlagen lassen) ist standardmäßig aus. Siehe [Kampf](combat.md).

Ist der Agent **Hierarchical Maps** heruntergeladen (er heißt jetzt World Maps, siehe [World Maps](../agents/hierarchical-maps.md)) und **Enable Agents** an, kann der Schritt **Features** außerdem eine **Hierarchical world map** entwerfen, eine gespeicherte Kartenvorlage nutzen oder eine geteilte Welt verknüpfen.

### Standardwerte, die du kennen solltest

| Einstellung | Standard | Hinweise |
| --- | --- | --- |
| Genre | Fantasy | Mehrfachauswahl, eigene Einträge möglich. Ein zuerst gewähltes Setting-Kit setzt sein eigenes. |
| Tone | Heroic | Mehrfachauswahl. |
| Difficulty | Normal | **Casual**, **Normal**, **Hard** oder **Brutal**. Höhere Stufen lassen gegnerische Angriffe härter treffen (siehe [Kampf](combat.md#difficulty-scaling)). |
| Content Rating | SFW | **SFW** oder **NSFW**. NSFW erlaubt Inhalte für Erwachsene, erzwingt sie aber nicht. |
| Language | English | Der gesamte Text im Spiel wird in dieser Sprache geschrieben. |
| Game Master Mode | Standalone GM | **Character GM** nutzt eine deiner Charakterkarten als GM. |
| Scene effects model | Built-in model | Erst, wenn du es heruntergeladen hast. Bis dahin ist der Standard **Skip - use inline tags from GM**. |
| Enable Agents | Off | Einschalten, um die Agentenkarten zu sehen. |
| Illustrator | Off | Braucht den Agenten Illustrator und ein Bildkonto. |
| Music DJ | Off | Braucht Spotify oder einen lokalen Musikordner. |
| Custom HUD Widgets | On | Das Modell entwirft Status-Widgets für die neue Welt. |
| Quick Time Events | On | Für Screenreader oder Spiel ohne Zeitdruck ausschalten. |
| Start Muted | Off | Startet das Spiel mit stummgeschaltetem Audio. |
| Game Presentation | Standard | Siehe unten. |

<a id="choose-rules"></a>

### Regeln auswählen

**Rules** erscheint nur bei einem neuen Spiel und nur, wenn mindestens ein Regelsatz installiert ist. **Marinara's own rules** ist der Standard: die eingebauten d20-Proben und der Bogen mit sechs Attributen. Ein Regelsatz wie **5e (SRD 5.1)** ersetzt sie durch die eigenen Proben und den eigenen Charakterbogen eines Tischrollenspielsystems und kann auch Kämpfe nach seinen eigenen Regeln austragen. Der Assistent zeigt, was jeder Regelsatz abdeckt. Sobald das Spiel erstellt ist, steht die Wahl fest. Siehe [Mit einem Regelsatz spielen](rulesets.md).

<a id="the-gm-intro-message"></a>

### Die Intro-Nachricht des GM

**GM intro message** (im Schritt **Party**) entscheidet, wie das Spiel beginnt:

- **None** (keine, der Standard): Der GM eröffnet das Spiel so, wie er es für richtig hält.
- **Defined** (festgelegt): Tipp die erste Nachricht genau so ein, wie sie lauten soll. Das Spiel beginnt mit diesem Text, und eine Neugenerierung liefert denselben Text.
- **Guided** (geführt): Beschreib, wie der Anfang verlaufen soll, etwa wo er beginnt und wer da ist. Der GM schreibt die Eröffnung danach.

Der Text darf bis zu 8.000 Zeichen lang sein. Er darf keine doppelten geschweiften Klammern enthalten, ein **Guided**-Text auch keine eckigen Klammern. Das Feld sagt dir, wenn sich der Text nicht verwenden lässt. Die Story einer Welt kann ihr eigenes Intro festlegen. Das Feld zeigt es dann als gesperrt an, und du kannst es nicht ändern.

### Storyboard Optimized

Im Schritt **GM** kann **Game Presentation** (Spielpräsentation) **Standard** oder **Storyboard Optimized** sein. **Storyboard Optimized** nutzt den Storyboard Game Prompt, der GM-Züge zu verfilmbaren visuellen Momenten formt. Den Storyboard-Agenten lädt es weder herunter noch schaltet es ihn ein, es schaltet keine Bild- oder Videogenerierung ein und ändert deine Konten nicht. Richte das nach dem Anlegen des Spiels unter **Chat Settings → Agents → Storyboards** (Chat-Einstellungen → Agenten → Storyboards) ein.

Der Editor **GM Prompt** zeigt eine Vorschau des Prompts für die gewählte Präsentation. Lässt du den Text unverändert, bleibt das eingebaute Preset ausgewählt. Bearbeitest du ihn, überschreibt dein Text das Preset.

Eine alternative Anime-Kombination aus einem Guss bleibt nach der Einrichtung verfügbar: Wähle **Anime Episode Director** für den Animation Planner und **Anime Game Video** für den Storyboard Video Prompt.

## Deinen ersten Zug spielen

Tipp ein, was dein Charakter tut oder sagt, und schick es ab. Der GM antwortet, aktualisiert die Welt und verlangt vielleicht einen Würfelwurf oder beginnt einen Kampf.

Die Sprechblasen-Schaltfläche neben der Schaltfläche für Dateianhänge legt fest, an wen deine Nachricht geht. Ihr Tooltip lautet **Choose who to address** (wähle, wen du ansprichst).

| Modus | Was er macht |
| --- | --- |
| Standard | Deine Nachricht geht als Handlung oder Dialogzeile in die Szene. Der GM und deine Party reagieren innerhalb der Geschichte. |
| **Talk to Party** (mit der Party sprechen) | Ergänzt die Markierung `[To the party]` und spricht deine Begleiter an. Erscheint nur, wenn deine Party nicht leer ist. |
| **Talk to GM** (mit dem GM sprechen) | Ergänzt die Markierung `[To the GM]` und fragt den GM außerhalb der Rolle, etwa „Weiß mein Charakter etwas über den Tempel?“ |

Der aktive Modus trägt im Menü die Markierung **On**. Klick denselben Eintrag noch einmal an, um ihn auszuschalten.

<a id="the-games-controls"></a>

## Die Bedienelemente des Spiels

Am Computer öffnen sich die Bedienelemente über Schaltflächen nahe der oberen rechten Ecke des Chats. Am Handy findest du sie im verschiebbaren Drei-Punkte-Menü **Chat tools** (Chat-Tools).

| Bedienelement | Was es enthält |
| --- | --- |
| **Game controls** (Spielsteuerung, der Gamecontroller) | **Retry turn**, **Retry scene analysis**, **Retry Music DJ** (wenn Music DJ die Musik spielt) und **Retry assets image generation**. Bei einem Storyboard-Hintergrund außerdem Wiederholung, Wiedergabe/Pause und Stummschaltung. **Show the scene** (Szene zeigen), **Show the overworld** (Oberwelt zeigen) und **Show the map** (Karte zeigen) wechseln in Spielen, die diese Ansichten haben, die Ansicht. **Edit game data** (Spieldaten bearbeiten) korrigiert gespeicherte Daten von Hand (siehe [Spieldaten von Hand bearbeiten](sessions-and-saves.md#editing-game-data-by-hand)). **Checkpoints** kehrt zu einem früheren Moment zurück (siehe [Wie das Spiel speichert](sessions-and-saves.md#how-your-game-saves)). |
| **Session** (Sitzung, die Feder) | Sitzungsverlauf, Journal und Sitzungssteuerung. Siehe [Game Mode: Sitzungen und Spielstände](sessions-and-saves.md). |
| **Volume** (Lautstärke, der Lautsprecher) | Lautstärke für **Master**, **Music**, **Sound Effects**, **TTS** und **Ambient**. |
| **Game Assets** (Spielressourcen, der Ordner) | Szenenmedien und der Asset Browser. Siehe [Game-Assets](game-assets.md). |
| **Connected chat** (verknüpfter Chat) | Erscheint, wenn das Spiel mit einer Conversation verknüpft ist. Siehe [Verknüpfte Chats](../chats/connected-chats.md#switching-between-connected-chats). |

Wähl ein Tool, um es am Computer in einem verschiebbaren Fenster oder am Handy in einem Panel über die ganze Breite zu öffnen. Am Computer ziehst du die Schaltfläche eines Tools, um sie zu verschieben. Am Handy verschiebst du das Drei-Punkte-Menü oder entsperrst es, um die Tools darin neu anzuordnen. Siehe [Steuerungsfenster und ihre Schaltflächen](../chats/chat-settings.md#control-windows-and-their-buttons).

Du kannst ein Bedienelement auch in **Chat Settings** behalten. Öffne sein Fenster und wähle **Put back in Chat Settings** (zurück in die Chat-Einstellungen). Es erscheint dann dort als aufklappbarer Abschnitt, und über seine Schaltfläche zum Herauslösen wird es wieder ein Fenster. Jedes Spiel speichert deine Auswahl. **Reset View** (Ansicht zurücksetzen) stellt die ursprüngliche Anordnung wieder her.

**Character Profiles** (Charakterprofile) bleibt am Computer wie am Handy außerhalb von Chat tools. Zieh seine Porträt-Schaltfläche, wohin du willst, und öffne es dann, um ein Partymitglied zu wählen und seinen Charakterbogen anzusehen oder zu bearbeiten. Am Handy hat auch **Map** (Karte) eine eigene verschiebbare Schaltfläche. Beide folgen deinem Chat-Widget-Stil, speichern ihre Position für dieses Spiel und lassen sich aus ihrem geöffneten Fenster heraus sperren.

<a id="choosing-a-model"></a>

## Ein Modell auswählen

Die Weltgenerierung ist der schwierigste Teil von Game Mode. Sie verlangt vom Modell ein einziges langes, striktes JSON-Dokument (ein Textformat, das exakt stimmen muss, sonst kann das Spiel es nicht lesen), in dem kein Feld fehlen darf. Ein Modell, das gut chattet, kann an diesem Schritt trotzdem scheitern.

- Nimm für die Weltgenerierung ein leistungsfähiges, aktuelles Spitzenmodell über ein kostenpflichtiges Konto. Stand 2026 berichten Spielende von guten Ergebnissen mit den Flaggschiff-Stufen der großen Anbieter, etwa Anthropic Claude, OpenAI GPT und Google Gemini. Modellnamen ändern sich häufig – versteh sie also als Beispiele, nicht als feste Liste.
- Die günstigsten Modelle, die wir empfehlen, sind DeepSeek V4 Flash und Claude Haiku 5.5; beide wurden mit Stand vom 31. Oktober 2026 im Spiel getestet.
- Für spätere Züge reicht manchmal ein günstigeres Modell, denn Züge brauchen Erzählung, kein striktes JSON. Vergisst der GM NPCs oder widerspricht er früheren Details, wechsle wieder auf ein stärkeres Modell.
- Meide kostenlose oder automatisch weiterleitende Modelle für die Weltgenerierung. Sie können an ein kleines Modell weiterleiten, das kein gültiges JSON liefern kann. Kleine Open-Weight-Modelle scheitern meist ebenfalls.

Die vollständige Referenz zu den Parametern findest du unter [Generierungsparameter](../prompts/generation-parameters.md).

## Was ein Zug kostet

Game Mode stellt drei Arten von KI-Anfragen:

1. **Weltgenerierung.** Einmal, wenn du auf **Start Game** klickst. Eine große Anfrage, die den Weltüberblick, die Startkarte, NPCs, die Bögen der Party und die Widgets zurückliefert.
2. **Spielzüge.** Jede Nachricht baut einen frischen Prompt mit dem aktuellen Zustand. Der GM erzählt und aktualisiert die Welt. Die Berechnungen der Kampfrunden übernimmt die Engine, nicht das Modell, so bleiben die Ergebnisse fair.
3. **Sitzungszusammenfassungen.** Beendest du eine Sitzung, schreibt der GM eine Rückschau und Notizen zur Kontinuität. Startest du die nächste, schreibt er eine kurze Überleitung. Ältere Sitzungen werden zu Zusammenfassungen verdichtet, damit lange Kampagnen ins Modell passen.

<a id="optional-tool-planning-and-lore-searches"></a>

## Optionale Tool-Planung und Lorebook-Suche

Öffne während des Spiels **Chat Settings → Function Calling** (Chat-Einstellungen → Funktionsaufrufe).

- **Let the GM search lore** (GM im Weltwissen suchen lassen) lässt den GM Lorebook-Fakten nach ihrer Bedeutung nachschlagen. Schalte zuerst die Vektorisierung für die Lorebooks ein und vektorisiere ihre Einträge. Die Suche berücksichtigt aktivierte Bücher, Ordner und die Eintragsschalter des jeweiligen Chats. Sie nutzt dein Embedding-Konto und kann eine Modellanfrage hinzufügen. Game-Chats brauchen diesen Schalter für Lorebook-Abfragen, auch wenn **Enable Tool Use** an ist. Solange er aus ist, ist `search_lorebook` in der Tool-Auswahl nicht verfügbar.
- **Game tool provider** (Anbieter für Game-Tools) steht standardmäßig auf **Same as narrator** (wie der Erzähler), wodurch die normale Tool-Schleife (bis zu vier Tool-Runden pro Zug) erhalten bleibt. Wählst du ein anderes Konto, läuft vor der Erzählung eine separate Planungsanfrage. Dieses Modell wählt die Tools, und der Erzähler erhält ihre Ergebnisse als Text. Das kostet pro Zug eine zusätzliche Anfrage über dieses Konto. Ein günstigeres Modell kann die Kosten senken, wählt aber womöglich andere Tools. Ein einzelner Planungsdurchgang kann keine zweite Abfrage anschließen.
- **Finish rolled turns in one request** (gewürfelte Züge mit einer Anfrage abschließen) ist standardmäßig an und spart bei Zügen mit Würfelwürfen eine Anfrage. Siehe [Game Mode: Würfel und Fertigkeitsproben](dice-and-skill-checks.md#finishing-a-rolled-turn-in-one-request).

Claude- und Grok-Abonnementkonten unterstützen keine nativen Tool-Aufrufe. Die Bedienelemente erklären das und bleiben deaktiviert, solange kein unterstützter **Game tool provider** ausgewählt ist. Textbefehle und Würfel-Tags funktionieren weiterhin. Fehlt ein separates Konto oder schlägt seine Anfrage fehl, meldet der Zug den Fehler, statt ohne die Tool-Arbeit zu erzählen.

Teilen sich lokale Modelle begrenzten GPU-Speicher, öffne **Chat Settings → Agents** und schalte **Run Game tasks one at a time** (Game-Aufgaben nacheinander ausführen) ein. Erzählung, Agenten und Szenenmedien warten dann innerhalb dieses Game-Chats aufeinander. Die Option ist standardmäßig aus und reserviert die GPU nicht gegenüber anderen Chats oder Anwendungen.

## Agenten aktivieren

Agenten sind optionale KI-Helfer, die neben dem GM mitlaufen. Sie stellen zusätzliche Anfragen und kosten deshalb extra. Um sie zu nutzen, öffne während des Spiels **Chat Settings → Agents** und schalte **Enable Agents** ein. Zwei sind für Game Mode nützlich:

- **Game Session Keeper** hilft, die Kontinuität über Sitzungen hinweg zu wahren.
- **Music DJ** sucht die Hintergrundmusik aus.

Mit **Review Agent Outputs** (Agent-Ausgaben prüfen) kannst du prüfen, was ein Agent produziert hat. Siehe [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md).

## Fehlerbehebung

<a id="world-generation-fails-with-a-json-or-422-error"></a>

### Die Weltgenerierung scheitert mit einem JSON- oder 422-Fehler

Meistens konnte das Modell das vollständige JSON nicht liefern. Probier der Reihe nach Folgendes.

1. Prüf, welches Modell der GM benutzt. Ist es ein kostenloses oder automatisch weiterleitendes Modell, wechsle auf ein leistungsfähiges kostenpflichtiges.
2. Versuch es erneut. Manche Fehlschläge passieren nur einmal.
3. Kürze ein langes Feld für Schauplatz oder Vorlieben. Lange Eingaben lassen weniger Platz für das JSON.

Hat ein Aufruf fast geklappt, bietet Marinara das Fenster **Repair JSON** (JSON reparieren) mit der Rohausgabe des Modells in einem Editor mit Zeilennummern an. Eine Statuszeile sagt dir, ob das JSON gültig ist, oder zeigt den Parse-Fehler. Klick auf **Format**, um gültiges JSON aufzuräumen, und dann auf **Apply Repaired JSON**, um deine Korrektur zu übernehmen, ohne für einen neuen Versuch zu bezahlen. **Repair JSON** erscheint auch bei Sitzungszusammenfassungen und anderen strukturierten Aufrufen. Weitere Lösungen findest du unter [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md).

### Der GM erzählt fröhlich, obwohl du einen düsteren Ton gewählt hast

Manche Modelle bleiben gut gelaunt. Trag im Vorlieben-Feld des Assistenten eine klare Anweisung ein, etwa „keep narration grim, do not soften failures“. Oder wechsle auf ein Modell, dessen Grundton zum Ton passt.

## Wo welches Thema steht

- [Game Mode: Kampf](combat.md): Begegnungen, das Aktionsmenü, die Schadensberechnung und Quick-Time-Events.
- [Game Mode: MRPG-Klassen](mrpg-classes.md): Klassen, Stufen und den Charakterbogen, Neuzugänge und die Umstellung eines Legacy-Spiels.
- [Game Mode: Party und NPCs](party-and-npcs.md): Character Profiles, Charakterbögen und das Adventure Journal.
- [Game Mode: Sitzungen und Spielstände](sessions-and-saves.md): Sitzungen beenden und starten, Verlauf und Checkpoints.
- [Game Mode: Karte, Zeit und Wetter](map-time-weather.md): Kartenansichten, die Uhr, Wetter und Moral.
- [Game Mode: Würfel und Fertigkeitsproben](dice-and-skill-checks.md): das Würfelmenü und die Regeln für Fertigkeitsproben.
- [Game Mode: HUD-Widgets](hud-widgets.md): die Status-Widgets auf dem Bildschirm.
- [Game-Assets](game-assets.md): die Bibliothek für Musik, Sound, Sprites und Hintergründe.
- [Anleitung zum Storyboard-Agenten](storyboard.md): Storyboards für Game Mode und Roleplay.
- [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md): Author's Notes funktionieren hier genauso.

## Overworld

Die folgenden Abschnitte beschreiben **Overworld**-Spiele, die noch nicht verfügbar sind. Lies sie nur, wenn dein Server sie eingeschaltet hat.

<a id="vn-or-overworld"></a>

### VN oder Overworld

Ein neues Spiel läuft in einem von zwei Game Modes, die du im ersten Schritt wählst und die für alle seine Sitzungen gelten:

- **Overworld** ist eine für dein Setting gemachte Welt, die du auf einer Oberweltkarte durchwanderst, mit Städten, Orten zum Erkunden und Dungeons. Dafür braucht es ein Setting-Kit und eine Welt. Solange du kein Kit wählst, wird das für dein erstes Genre genommen (High Fantasy, wenn das Genre keines hat), und dafür wird eine Welt ausgewürfelt.
- **VN** ist Game Mode, wie er immer war, erzählt wie eine Visual Novel: Szene für Szene, mit der Szenenkarte und Kämpfen und ohne Setting-Kit, Welt, Oberwelt, Städte oder Dungeon-Karten.

Overworld ist gesperrt, solange der Server-Betreiber nicht `MARINARA_OVERWORLD_GAMES` setzt. Solange es gesperrt ist, ist seine Karte ausgegraut, mit dem Hinweis „Overworld games, with a setting kit and a generated world, are not ready yet. New games start as VN games.“ Jedes neue Spiel ist dann ein VN-Spiel, und die Auswahl für Setting-Kit und Welt erscheint nicht. Ein Spiel, das angelegt wurde, bevor es diese Wahl gab, läuft weiter wie bisher: mit einer Welt als Overworld-Spiel, ohne als VN-Spiel.

<a id="choosing-a-setting-kit"></a>

### Ein Setting-Kit wählen

Ein **Setting kit** (Setting-Kit) gibt dem GM die Wörter, in denen deine Art von Welt geschrieben ist: Ortsnamen und Siedlungsgrößen, Arten von Gruppen, wie die Leute reisen, Namen für ein Jahr und einen Tag, wie sich Völker selbst benennen, Geld und Waren, Elemente, Kampforte und welche Familie von Grafik und Musik es nutzt (siehe [Game-Assets](game-assets.md#a-settings-own-art-and-music)). Es legt außerdem fest, welche Arten von Veränderung die Welt erlaubt, etwa Rivalitäten, Verbrechen, Kriege oder Katastrophen, und wie schnell sie sich verändert. Eine ausgeschaltete Art wird nie eingebracht, sodass ein Streit ein Streit bleiben kann.

Es gibt acht Kits: High Fantasy, Wuxia und Xianxia, Gegenwart, übernatürliche Gegenwart, die 1920er-Jahre, Cyberpunk, Space Opera und Postapokalypse. Die Gegenwart ist standardmäßig sanft, ohne Verbrechen, Konflikte oder Katastrophen und in gemächlichem Tempo.

- Wählst du ein Kit vor einem Genre, setzt es das passende Genre. Ein Genre, das du selbst gewählt hast, bleibt.
- **Write it for my setting** (für mein Setting umschreiben) bittet dein GM-Modell, das Kit für dein Genre, deinen Schauplatz und deinen Ton umzuschreiben. Passt das Ergebnis nicht zusammen, wird das Modell noch einmal mit den Gründen gefragt. Scheitert es erneut, sagt dir der Assistent, was nicht stimmte, und behält dein bisheriges Kit.
- **Change its words** (Wörter ändern) öffnet jedes Wort des Kits. Tipp eine Liste in eine Zeile, durch Kommas getrennt. Ein Kit mit einem Problem, etwa einem leeren Namen oder ohne Siedlungen, sagt, was nicht stimmt, und das Spiel kann erst starten, wenn es behoben ist.
- **Download this kit** (dieses Kit herunterladen) speichert eine `.worldkit.json`-Datei zum Teilen. **Import a kit file** (Kit-Datei importieren) liest eine wieder ein.

Das Spiel behält das Kit, mit dem es angelegt wurde, und eine geteilte Setup-Datei bringt es mit. Eine Experience kann ihr eigenes Kartenpaket mitliefern (ein Kit, fertige Karten und Tiles). Ist diese Experience an, zeigt die Einrichtung ihr Kit als festgelegt und, falls sie Karten mitliefert, eine **Map** zur Auswahl. Schaltest du die Experience aus, bekommst du deine Entscheidungen zurück.

<a id="making-a-world"></a>

### Eine Welt erstellen

Ist ein Kit gewählt, legt **Your world** (deine Welt) vor Spielbeginn eine Welt in den Wörtern des Kits an: Regionen, Siedlungen jeder Größe, wofür jeder Ort bekannt ist, und die Wege zwischen ihnen (Straßen, Flüsse, Seewege, Sprungrouten) samt Reisedauer in Tagen.

Eine Welt entsteht aus einem **World seed** (Welt-Seed). Derselbe Seed, dasselbe Kit und dieselbe Vorgabe ergeben immer dieselbe Welt. **Roll** (würfeln) gibt dir eine andere, und eine wieder eingetippte Zahl holt eine zurück. Die Vorschau zeigt eine kleine Karte des Geländes und der Siedlungen, den Startpunkt der Party und eine Liste der Siedlungen nach Region.

- **Start from this lore** (von dieser Lore ausgehen) liest in den angehakten Lorebooks die Orte und datierten Ereignisse, die sie nennen, genau so, wie sie geschrieben sind. **Build around the lore** (um die Lore herum bauen) füllt die Welt um sie herum auf. **Only the lore's places** (nur die Orte der Lore) erschafft nichts daneben.
- **Write the world's brief** (Vorgabe der Welt schreiben) bittet dein GM-Modell um die Gegenwart, die wichtigsten Orte, die Gruppen, um die sich die Gegenwart dreht (was jede will und wer ihre Verbündeten und Rivalen sind), und Namen für Orte und Menschen im eigenen Klang jedes Volkes. Die Orte der Lore bleiben erhalten, was das Modell auch schreibt. Alles, was nicht zum Kit passt, wird weggelassen und gezählt. **Change the brief** (Vorgabe ändern) öffnet ihre Wörter, einschließlich der Vor- und Familiennamen jedes Volkes. Ohne Vorgabe sind Orte nummeriert, und Menschen heißen nach ihrem Beruf.

**Eine Welt hat eine Vergangenheit.** Vor Spielbeginn läuft die Welt Jahr für Jahr ab ihrer Gründung vorwärts. Siedlungen wachsen, Gruppen werden gegründet, bekommen und verlieren Anführer und verbünden oder entzweien sich. Wo es sie in der Welt gibt, hinterlassen Banditen, Kriege und Hungersnöte ihre Spuren. Eine schwere Veränderung kommt erst, nachdem sie sich angebahnt hat, und nur in den Arten, die das Kit erlaubt. Datierte Ereignisse aus deiner Lore oder der Vorgabe geschehen dann und dort, wo sie es sagen. Derselbe Seed und dieselbe Vorgabe ergeben dieselbe Vergangenheit.

**Was der GM weiß.** Der GM weiß immer, wo die Party ist, wohin sie gehen kann und wie lange jeder Weg dauert. Er erfährt die bemerkenswertesten Ereignisse der Vergangenheit, wer den aktuellen Ort anführt und die Geschichte dieses Ortes. Nach jedem anderen Ort und jeder anderen Gruppe kann er fragen und bekommt die Antwort in seinem nächsten Zug. Wohin die Party geht, benennt er mit einem Orts-Tag. Ein Ort, den die Welt aufführt, behält die Größe, die die Welt ihm gegeben hat. Ein Ort, den die Welt nicht aufführt, etwa ein Bauernhof, behält den Namen, den der GM ihm gibt. Jede Siedlung hat Bewohner, die der Seed auswürfelt, wenn die Party ankommt: mit einem Namen aus ihrer Kultur, einem Beruf, der zum Ort passt, einem Temperament, einer Sprechweise und einem Aussehen. Nennt der GM jemanden mit vollem Namen, wird diese Person in die verfolgten Charaktere aufgenommen.

**Was die Party tut, bleibt bestehen.** Hilft oder schadet die Party einer Gruppe, ändert sie, wie zwei Gruppen zueinander stehen, nimmt oder ruiniert sie einen Ort oder setzt sie jemanden an die Spitze einer Gruppe, hält der GM das in seiner Antwort fest. Jede Änderung wird gegen die Welt geprüft. Eine Änderung einer Art, die das Kit ausgeschaltet hat, oder eine, die einen Ort oder eine Gruppe nennt, die es in der Welt nicht gibt, wird abgelehnt. Von da an erfährt der GM die Welt so, wie die Geschichte sie hinterlassen hat. Ein Ort, den die Geschichte hinzugefügt hat, ist ein Ort, zu dem die Party gehen kann. Ein Swipe, eine Neugenerierung oder eine gelöschte Nachricht nimmt eine Änderung mit ihrer Antwort zurück.

**Die Welt dreht sich ohne die Party weiter.** Sagt der GM, dass Zeit vergeht, macht die Welt Schritte von jeweils einer Woche, nur in den Arten von Veränderung, die das Kit kennt. Katastrophen kommen nie von selbst: Nur der GM kann eine erzählen, und sie wird abgelehnt, wenn ihre Art ausgeschaltet ist. Dort, wo die Party ist, wird nichts entschieden. Nachrichten verbreiten sich: Der GM erfährt von einer fernen Veränderung, sobald die Tage vergangen sind, die die Wege brauchen. Die Taten der Party zählen umso mehr, je bekannter sie wird.

**Änderungen von Hand.** In einem Welteditor kannst du Orte umbenennen oder verschieben, das Gelände bemalen, Orte und Bewohner hinzufügen, das taktische Schlachtfeld eines Ortes bemalen (siehe [Kampf](combat.md#tactical-battles-and-terrain)) und eine Stadt anlegen (siehe [Die Stadt](map-time-weather.md#the-town)). Jeder Teil des Spiels sieht die Änderungen sofort. Ein umbenannter Ort hört weiterhin auf seinen alten Namen. Änderungen verändern die Welt ab jetzt, nie ihre Vergangenheit. Eine Stadt behält ihre Anlage, sodass Orte und Bewohner, die du hinzufügst, auf ihre nächsten freien Baugrundstücke und in ihre nächsten freien Wohnungen kommen.

**Weltdateien.** **Download this world** (diese Welt herunterladen, unter **Your world**) speichert die Welt, die du gerade erstellst, und **Download the world** (Welt herunterladen) auf dem Tab World eines Spiels speichert dessen Welt samt Änderungen von Hand als `.world.json`-Datei. **Import a world file** (Weltdatei importieren, neben dem Setting-Kit) liest eine in die Einrichtung eines neuen Spiels ein: Es wählt das Kit der Datei und erstellt ihre Welt. **Your worlds** (deine Welten) macht dasselbe mit einer Welt aus deiner Bibliothek. Eine Datei kann auch die Story der Welt mitbringen: Ereignisse und Szenen, die ihr Ersteller geschrieben hat. Die Szenen einer Story erscheinen in der Erzählung vor der Antwort des GM, genau so, wie sie geschrieben sind, und ihre Questziele stehen unter **Story** auf dem Tab World des Journals. Wie du eine schreibst, steht unter [Story-Skripte für Game Mode schreiben](../extending/writing-story-scripts.md). Änderungen von Hand und die Story gehören zu diesem Seed und dieser Vorgabe, sie fallen also weg, wenn du eines davon änderst. Eine Datei, die sich nicht lesen lässt, wird abgelehnt, und der Assistent sagt, warum. Passt der Inhalt einer Datei nicht zum Kit, wird er teilweise weggelassen, und der Assistent sagt, was.

**Später und gespeichert.** Ein Spiel, das ohne Welt angelegt wurde, kann später über den Tab **World** (Welt) des Journals mit **Make a world for this game** (eine Welt für dieses Spiel erstellen) eine bekommen. Die Welt beginnt mit dem nächsten Zug; die bisherigen Züge, die Karte und die Bewohner bleiben. Solange Overworld RPG gesperrt ist, ist die Schaltfläche ausgegraut. Ein Spiel behält seine Welt so, wie sie erstellt wurde, sodass eine neue Sitzung, eine Verzweigung und ein exportierter Chat dieselbe Welt behalten. Eine Welt, die eine frühere Version des Generators erstellt hat, läuft weiter, lässt sich aber nicht mehr bearbeiten.

Ein Spiel mit Welt öffnet sich auf der **Oberwelt**, einer Pixelkarte, auf der du die Party zwischen Siedlungen wandern lässt und Städte betrittst. Siehe [Die Oberwelt](map-time-weather.md#the-overworld).
