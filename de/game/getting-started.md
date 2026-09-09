# Game Mode: Erste Schritte

Game Mode macht aus Marinara Engine ein Einzelspieler-Rollenspiel, das eine KI als Game Master leitet. In dieser Anleitung erfährst du, was Game Mode ist und was du zum Start brauchst. Danach geht es Schritt für Schritt durch den Einrichtungsassistenten, und du siehst, wo die einzelnen Spielfunktionen zu finden sind. Lies sie einmal durch, starte ein Spiel und folge am Ende den Links zu den vertiefenden Themen.

## Was Game Mode ist

Game Mode ist einer der Chat-Modi von Marinara. Die anderen beiden heißen Conversation und Roleplay.

In Game Mode leitet ein KI-Game-Master (GM) eine Geschichte für dich – also die KI, die die Welt erzählt, jeden Charakter spielt, dem du begegnest, und entscheidet, wie es weitergeht. Das funktioniert wie der Dungeon Master am Spieltisch.

Die Engine führt den Spielzustand über alle Züge hinweg mit. Dazu gehören die Karte, deine Party (deine Abenteuergruppe), Nicht-Spieler-Charaktere (NPCs), Gegenstände, Quests, die Zeit in der Spielwelt und das Wetter. Gespielt wird über viele Züge hinweg. Ein langes Spiel lässt sich in mehrere **Sitzungen** aufteilen – so wie eine Tischrunde eine Kampagne über mehrere Spieleabende verteilt. Die Kampagne ist die gesamte fortlaufende Geschichte.

Du musst nicht jede Mechanik nutzen. Manche Spielerinnen und Spieler lassen Kampf und Würfelwürfe weg und nutzen Game Mode für erzählerisches, visuelles Spiel. Die Rollenspielsysteme sind da, wenn du sie willst.

## Bevor du startest

Für den Spielstart brauchst du genau eine Sache: eine Verbindung zu einem KI-Anbieter für den GM. Eine Verbindung koppelt Marinara an einen KI-Anbieter, damit Text generiert werden kann. Falls noch keine eingerichtet ist, hilft [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).

Alles Weitere ist optional und standardmäßig aus. Nachrüsten kannst du jederzeit:

- **Bildgenerierung.** Game Mode hat ein visuelles Layout mit Hintergründen und Charakterbildern. Zum Füllen brauchst du eine Verbindung zur Bildgenerierung. Die Einstellung **Visual Generation** (visuelle Generierung) im Assistenten ist standardmäßig aus und muss von Hand aktiviert werden. Ohne sie bekommst du weiterhin Geschichte, Zustandsverfolgung und Kampf, aber die visuellen Flächen bleiben leer.
- **Ein lokales Modell für Szeneneffekte.** Marinara kann ein kleines Modell auf dem eigenen Rechner laufen lassen; es heißt **Local Model (Gemma)**. Es liefert Vorschläge für Hintergrund und Musik, ohne Zusatzkosten. Im Assistenten ist es die Standardwahl. Mehr dazu unter [Lokales Modell einrichten](../connections/local-model.md).
- **Der Storyboard-Agent.** Installiere ihn über **Agents > Download Agents** (Agenten herunterladen) und aktiviere ihn danach für das fertige Spiel unter **Chat Settings > Agents**, wenn du Storyboards als Standbilder oder Animationen willst.
- **Eine Verbindung zur Videogenerierung.** Die brauchst du nur für Szenenvideos oder animierte Storyboards.
- **Musik.** Der Agent **Music DJ** kann Spielmusik abspielen. Er benötigt Spotify oder einen lokalen Musikordner und ist standardmäßig aus.

## Der Einrichtungsassistent

Beim Anlegen eines Game-Mode-Chats öffnet sich ein Einrichtungsassistent mit sieben Schritten. Pflicht ist nur ein einziges Feld: die GM-Verbindung im ersten Schritt. Alles andere ist sinnvoll vorbelegt. Du kannst also zügig durchklicken und den Rest Marinara überlassen.

Die sieben Schritte:

1. **Connection.** Vergib den Spielnamen, wähle die GM-Verbindung und optional eine Verbindung für Szeneneffekte. Für Szeneneffekte ist **Local Model (Gemma)** vorbelegt.
2. **World.** Lege Genre, Schauplatz, Ton, Schwierigkeit, Inhaltsfreigabe und Sprache fest.
3. **Party.** Wähle deine Persona (den Charakter, den du spielst), den **Game Master Mode** und eventuelle Partymitglieder.
4. **Goals.** Sag dem GM, was du dir vom Abenteuer erhoffst.
5. **Lorebooks.** Hänge die Lorebooks an, deren Fakten der GM als verbindlich behandeln soll. Ein Lorebook ist eine Sammlung von Hintergrundwissen zur Welt. Mehr dazu unter [Lorebooks](../lorebooks/overview.md).
6. **Features.** Aktiviere optionale Systeme wie Visual Generation, Music DJ und HUD-Widgets. Installierbare Agenten aktivierst du nach dem Anlegen des Spiels in den Chat Settings.
7. **GM.** Wähle den Präsentationsstil und sieh dir die erweiterten GM-Anweisungen an, bevor die Welt gebaut wird.

Zum Schluss klickst du auf **Start Game**.

### Standardwerte, die du kennen solltest

Das sind die Startwerte in den Schritten **World**, **Party** und **Features**. Ändern lässt sich jeder davon.

| Einstellung | Standard | Hinweise |
|---|---|---|
| Genre | Fantasy | Mehrfachauswahl, eigene Einträge möglich |
| Tone | Heroic | Mehrfachauswahl |
| Difficulty | Normal | Casual, Normal, Hard oder Brutal; höhere Stufen machen den Kampf härter |
| Content Rating | SFW | SFW oder NSFW; NSFW erlaubt Inhalte für Erwachsene, erzwingt sie aber nicht |
| Language | English | Der gesamte Text im Spiel wird in dieser Sprache geschrieben |
| Game Master Mode | Standalone GM | Standalone GM baut dir einen GM; Character GM nutzt eine deiner Charakterkarten als GM |
| Visual Generation | Off | Für Bilder einschalten; braucht eine Verbindung zur Bildgenerierung |
| Game Presentation | Standard | **Storyboard Optimized** nutzt den Storyboard Game Prompt, um die Erzählung des GM zu formen; der Storyboard-Agent wird dadurch weder installiert noch aktiviert |
| Music DJ | Off | Braucht Spotify oder einen lokalen Musikordner |
| Custom HUD Widgets | On | Nutzt die von der KI erzeugten Status-Widgets der neuen Welt |
| Start Muted | Off | Startet das Spiel stummgeschaltet |

Neu in Game Mode? Dann lass **Game Master Mode** auf **Standalone GM**. Marinara baut dir einen fairen, leicht schnippischen GM, und du kannst den Modus in Ruhe ausprobieren, bevor du eine eigene GM-Karte schreibst.

Wähle im letzten Schritt **Storyboard Optimized**, wenn GM-Züge als verfilmbare visuelle Momente geschrieben werden sollen. Damit greift das eingebaute Preset **Storyboard Game Prompt** für die Erzählung des GM. Der Storyboard-Agent wird dadurch weder installiert noch aktiviert. Bild- oder Videogenerierung schaltet die Auswahl nicht ein, an den gewählten Verbindungen ändert sie nichts, und die Standardwerte des Agenten für Planner und Formatierung bleiben ebenfalls erhalten. Installiere und aktiviere Storyboard nach dem Anlegen des Spiels separat. Seine Einstellungen für Keyframes, Planner, Bild und Video legst du unter **Chat Settings > Agents > Storyboards** fest.

Die alternative Anime-Kombination aus einem Guss bleibt nach der Einrichtung verfügbar: Wähle **Anime Episode Director** für den Animation Planner und **Anime Game Video** für den Storyboard Video Prompt.

Der Editor **GM Prompt** zeigt eine Vorschau des Prompts, der für die gewählte Präsentation tatsächlich greift – ein Prompt ist der Text, den Marinara an die KI schickt. Bei ausgewähltem **Storyboard Optimized** erscheint im Editor der Storyboard Game Prompt samt Makro für die Keyframe-Anzahl. Lässt du den Text unverändert, bleibt das eingebaute Preset aktiv; bearbeitest du ihn, entsteht ein eigener Prompt, der das Präsentations-Preset überschreibt.

## Die drei Arten von KI-Aufruf

Game Mode nutzt drei verschiedene Arten von KI-Aufruf. Wer sie kennt, versteht besser, woher Kosten und Fehler kommen.

1. **Weltgenerierung.** Sie läuft genau einmal, nämlich beim Klick auf **Start Game**. Die GM-Verbindung liefert ein einziges großes, strukturiertes Dokument im Format JSON zurück. Darin stecken der Weltüberblick, die Startkarte, NPCs, die Spielbögen deiner Party und die Widgets auf dem Bildschirm. JSON ist ein striktes Textformat, das die KI exakt einhalten muss – sonst kann das Spiel nichts damit anfangen. Das ist der anspruchsvollste Schritt, und deshalb zählt die Modellwahl hier am meisten.
2. **Spielzüge.** Jede Nachricht, die du abschickst, baut einen frischen Prompt mit dem aktuellen Zustand. Danach erzählt der GM weiter und aktualisiert die Welt. Die Berechnungen der Kampfrunden übernimmt die Engine, nicht das Modell – so bleiben die Ergebnisse fair und einheitlich.
3. **Sitzungszusammenfassungen.** Beendest du eine Sitzung, schreibt der GM eine strukturierte Rückschau samt Notizen zur Kontinuität. Beim Start einer neuen Sitzung verfasst er eine kurze Überleitung, damit das nächste Kapitel sauber anschließt. Ältere Sitzungen werden zu Zusammenfassungen verdichtet, damit lange Kampagnen das Modell nicht überfordern.

## Adressierung: mit wem du gerade sprichst

In der Eingabeleiste sitzt neben der Schaltfläche für Dateianhänge eine kleine Sprechblasen-Schaltfläche. Ihr Tooltip lautet **Choose who to address** – ein Tooltip ist der Kurzhinweis, der beim Draufzeigen erscheint. Diese Schaltfläche legt fest, an wen deine Nachricht geht, und kennt drei Zustände.

- Standardmäßig geht deine Nachricht in die Szene. Sie gilt als normale Handlung oder Dialogzeile im Spiel. Der GM und deine Party reagieren innerhalb der Geschichte.
- **Talk to Party** ergänzt die Markierung `[To the party]` und richtet das Wort direkt an deine Begleiter. Nutze das für taktische Absprachen wie „Was machen wir hier jetzt?“ Diese Option erscheint nur, wenn deine Party nicht leer ist.
- **Talk to GM** ergänzt die Markierung `[To the GM]` und wendet sich außerhalb der Rolle an den GM. Nutze das für Fragen wie „Weiß mein Charakter etwas über den Tempel?“ oder für Wünsche zum Erzähltempo.

Der aktive Modus trägt im Menü die Markierung **On**. Um **Talk to Party** oder **Talk to GM** wieder abzuschalten, klick denselben Menüeintrag noch einmal an. Danach landen deine Nachrichten wieder in der Szene.

## Optionale Tool-Planung und Lorebook-Suche

Öffne während des Spiels **Chat Settings → Function Calling** (Chat-Einstellungen → Funktionsaufrufe). Mit **Let the GM search lore** (GM im Weltwissen suchen lassen) kann der GM Informationen nach ihrer Bedeutung suchen, ohne alle anderen optionalen Tools einzuschalten. Aktiviere zunächst die Vektorisierung für die betreffenden Lorebooks und vektorisiere ihre Einträge. Die Suche berücksichtigt aktivierte Bücher, Ordner und die Eintragsschalter des jeweiligen Chats. Sie nutzt die konfigurierte Embedding-Verbindung und kann eine weitere Modellanfrage auslösen.

**Game tool connection** (Verbindung für Game-Tools) steht standardmäßig auf **Same as narrator** (wie der Erzähler), wodurch die normale Tool-Schleife erhalten bleibt. Eine andere Verbindung führt vor der Erzählung genau eine separate Planungsanfrage aus. Dieses Modell wählt die Tools; der Erzähler erhält ihre tatsächlichen Ergebnisse als Text. Die zusätzliche Anfrage wird über die ausgewählte Verbindung abgerechnet. Ein günstigeres Modell kann die Tool-Kosten senken, aber andere Tools wählen. Dieser einzelne Planungsschritt kann aus dem ersten Ergebnis keine zweite Suche ableiten. Nutze **Same as narrator**, wenn der Erzähler mehrere Tool-Runden durchdenken soll.

Claude- und Grok-Abonnementverbindungen unterstützen keine nativen Tool-Aufrufe. Die betroffenen Bedienelemente erklären das und bleiben deaktiviert, bis eine unterstützte Game-Tool-Verbindung ausgewählt ist. Textbefehle und Würfel-Tags funktionieren weiterhin. Fehlt eine separate Verbindung oder schlägt ihre Anfrage fehl, meldet der Zug den Fehler, statt still ohne die angeforderte Tool-Arbeit zu erzählen.

## Agenten aktivieren

Agenten sind optionale KI-Helfer, die neben dem GM mitlaufen. Um sie im Spiel zu nutzen, öffne während des Spielens **Chat Settings** (Chat-Einstellungen), geh in den Bereich **Agents** und aktiviere **Enable Agents**. Laufende Agenten kosten extra, weil sie zusätzliche Aufrufe erzeugen.

Zwei Agenten lohnen sich für Game Mode besonders:

- **Game Session Keeper** hilft, die Kontinuität über mehrere Sitzungen hinweg zu wahren.
- **Music DJ** sucht die Hintergrundmusik aus. Er braucht Spotify oder einen lokalen Musikordner.

Game Mode nutzt außerdem **Review Agent Outputs**, damit du prüfen kannst, was ein Agent produziert hat. Das ganze Bild zu Agenten gibt es unter [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md).

## Ein Modell auswählen

Die Weltgenerierung ist der schwierigste Teil von Game Mode. Sie verlangt vom Modell ein einziges langes, striktes JSON-Dokument, in dem kein Feld fehlen darf. Ein Modell, das im normalen Chat glänzt, kann an diesem Schritt trotzdem scheitern.

Nimm für die Weltgenerierung ein leistungsfähiges, aktuelles Spitzenmodell über eine kostenpflichtige Verbindung. Stand 2026 berichten Spielende von guten Ergebnissen mit den Flaggschiff-Stufen der großen Anbieter, etwa Anthropic Claude, OpenAI GPT und Google Gemini. Konkrete Modellnamen ändern sich häufig – versteh das also als Beispiele, nicht als feste Liste.

Für die laufenden Spielzüge reicht manchmal ein günstigeres Modell, denn hier geht es um Erzählung statt um striktes JSON. Vergisst der GM plötzlich NPCs oder widerspricht früheren Details, dann wechsle wieder auf ein stärkeres Modell.

Finger weg von kostenlosen oder automatisch weiterleitenden Modellen für die Weltgenerierung. Sie landen womöglich bei einem kleineren Modell, das kein gültiges Weltgenerierungs-JSON liefert. Kleine Open-Weight-Modelle scheitern an diesem Schritt meist ebenfalls.

Die vollständige Referenz zu den Parametern findest du unter [Generierungsparameter](../prompts/generation-parameters.md).

## Wo welches Spielthema steht

Diese Anleitung bringt dich ins Spiel. Jedes tiefergehende Thema hat eine eigene Anleitung:

- [Game Mode: Kampf](combat.md) behandelt Begegnungen, das Aktionsmenü, die Schadensberechnung und Quick-Time-Events.
- [Game Mode: Party und NPCs](party-and-npcs.md) behandelt die Party-Leiste, Charakterbögen und das Adventure Journal.
- [Game Mode: Sitzungen und Spielstände](sessions-and-saves.md) behandelt das Beenden und Starten von Sitzungen sowie die Sitzungshistorie.
- [Game Mode: Karte, Zeit und Wetter](map-time-weather.md) behandelt die Kartenansichten sowie die automatische Uhr und das Wetter.
- [Game Mode: Würfel und Fertigkeitsproben](dice-and-skill-checks.md) behandelt das Würfelmenü und die Regeln für Fertigkeitsproben.
- [Game Mode: HUD-Widgets](hud-widgets.md) behandelt die Status-Widgets auf dem Bildschirm.
- [Spiel-Assets](game-assets.md) behandelt die Bibliothek für Musik, Sound, Sprites und Hintergründe.
- [Anleitung zum Storyboard-Agenten](storyboard.md) behandelt die Installation sowie Storyboards in Roleplay und Game Mode.

Author's Notes funktionieren hier genauso wie in den anderen Modi. Mehr dazu unter [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md).

## Fehlerbehebung

### Die Weltgenerierung scheitert mit einem JSON- oder 422-Fehler

Meistens liegt es daran, dass das Modell das vollständige strukturierte JSON nicht liefern konnte. Probier der Reihe nach Folgendes.

1. Prüf, welche Verbindung der GM benutzt. Zeigt sie auf ein kostenloses oder automatisch weiterleitendes Modell, wechsle auf ein leistungsfähiges kostenpflichtiges Modell.
2. Versuch es erneut. Manche Fehlschläge sind Einzelfälle, und dieselbe Konfiguration klappt im zweiten Anlauf.
3. Kürze ein sehr langes Feld für Schauplatz oder Vorlieben. Lange Eingaben lassen dem Modell weniger Platz für die JSON-Ausgabe.

Hat ein Aufruf fast geklappt und war das JSON nur leicht beschädigt, bietet Marinara das Fenster **Repair JSON** (JSON reparieren) an. Es öffnet einen Editor mit Zeilennummern und der Rohausgabe des Modells. Eine Statuszeile sagt dir, ob das JSON gültig ist, oder zeigt den Parse-Fehler. Klick auf **Format**, um gültiges JSON aufzuräumen. Klick danach auf **Apply Repaired JSON**, um deine korrigierte Fassung zu übernehmen, ohne einen kompletten neuen Versuch zu bezahlen. Die Option **Repair JSON** erscheint auch bei Sitzungszusammenfassungen und anderen strukturierten Aufrufen.

Weitere Symptome und Lösungen findest du unter [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md).

### Der GM erzählt fröhlich, obwohl du einen düsteren Ton gewählt hast

Manche Modelle bleiben gut gelaunt, egal welcher Ton eingestellt ist. Dafür gibt es zwei Wege. Trag im Vorlieben-Feld des Assistenten eine klare Anweisung ein, etwa „keep narration grim, do not soften failures“. Oder wechsle auf ein Modell, dessen Grundton zu dem passt, was du willst.

## Verwandte Anleitungen

- [Game Mode: Kampf](combat.md)
- [Game Mode: Party und NPCs](party-and-npcs.md)
- [Game Mode: Sitzungen und Spielstände](sessions-and-saves.md)
- [Game Mode: Karte, Zeit und Wetter](map-time-weather.md)
- [Game Mode: Würfel und Fertigkeitsproben](dice-and-skill-checks.md)
- [Game Mode: HUD-Widgets](hud-widgets.md)
- [Spiel-Assets](game-assets.md)
- [Anleitung zum Storyboard-Agenten](storyboard.md)
- [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md)
- [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md)
- [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md)
- [Generierungsparameter](../prompts/generation-parameters.md)
- [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md)
