# Anleitung zum Storyboard-Agenten

Der herunterladbare Agent **Storyboard** macht aus fertigem Erzähltext geordnete Keyframe-Bilder und auf Wunsch kurze Bild-zu-Video-Clips. Unterstützt werden **Roleplay** und **Game Mode**. Conversation-Chats nutzen kein Storyboard.

So läuft es heute: komplett über den Agenten. Das Storyboard-Paket liefert die Planungs-Prompts, die Standardwerte und die Bedienelemente pro Chat. Marinara Engine kümmert sich um die Einbindung in der App, erzeugt die Medien, legt sie in der Gallery (Galerie) ab und zeigt sie im Chat oder im Game-Viewer an.

## Roleplay und Game Mode im Überblick

| | Roleplay | Game Mode |
| --- | --- | --- |
| Quelle der Geschichte | Abgeschlossene Nachrichten von dir und von der KI seit der letzten erfolgreichen Episode | Ein abgeschlossener Erzählzug des Game Masters (GM) |
| Automatik-Optionen | **Manual only**, **Still images** oder **Animations** | Getrennte Schalter **Automatic Storyboard Illustrations** und **Automatic Storyboard Animations** |
| Manuelle Aktion | **Gallery > Create storyboard** für die zuletzt abgeschlossene KI-Antwort | **Gallery > Create storyboard** für den zuletzt abgeschlossenen GM-Zug |
| Anzeige | Direkt im Chat unter der KI-Antwort, die die Episode abschließt | Schwebender Viewer oder Game-Hintergrund, synchron zur Erzählung |
| Planungs-Prompts | Episode contract, Visual style, optionales Animation addon und Output contract | Getrennte Planner für Standbild und Animation |
| Gemeinsame finale Prompts | Bild-Prompt für die Illustration und Video-Prompt für die Animation | Bild-Prompt für die Illustration und Video-Prompt für die Animation |

Beide Modi legen die Keyframe-Bilder im Tab **Images** der Gallery ab und die Clips im Tab **Videos**.

## Den Agenten installieren

1. Öffne über das Sparkles-Symbol das Panel **Agents** (Agenten).
2. Wähle **Download Agents** (Agenten herunterladen).
3. Öffne **Storyboard** und klick auf **Install** (Installieren).
4. Öffne einen Roleplay- oder Game-Chat und geh dort zu **Chat Settings > Agents** (Chat-Einstellungen).
5. Aktiviere **Enable Agents** (Agenten aktivieren) und danach **Enable Storyboards** in der Karte Storyboard.

Die Installation stellt das Paket in passenden Chats bereit – aktiv ist es damit noch lange nicht. Ein Neustart von Marinara ist beim aktuellen Paket nicht nötig.

Taucht Storyboard in den Chat Settings nicht auf, prüf zwei Dinge: Ist das Paket installiert, und läuft der Chat im Roleplay oder im Game Mode?

## Einstellungen des Storyboard-Agenten

Öffne das Panel **Agents**, wähle **Storyboard** und ruf die Einrichtung auf. Diese Werte gelten als Standard für alle Chats ohne eigene Überschreibungen.

### Standardwerte für Generierung und Medien

| Einstellung | Standard | Zweck |
| --- | --- | --- |
| Agent connection | Die gewählte Agent-Verbindung | Plant das Storyboard mit einem LLM (großes Sprachmodell) |
| **Image connection** | Use the Game image connection | Erzeugt jedes Keyframe; irgendwo in der Fallback-Kette muss eine Bild-Verbindung stehen |
| **Video connection** | Use the Game video connection | Erzeugt Clips, sobald Animationen aktiv sind |
| **Automatic generation** | Still images | Legt fest, wie sich frisch aktivierte Chats automatisch verhalten |
| **Keyframes per turn** | 3, Bereich 1 bis 6 | Legt die Zielzahl der geordneten Bilder fest |
| **Clip seconds** | 5, Bereich 1 bis 15 | Legt die gewünschte Länge jedes Clips fest |
| **Viewer display** | Floating viewer | Standard für den Viewer im Game Mode; im Roleplay erscheinen Storyboards immer direkt im Chat |
| **Default Roleplay episode interval** | 1, Bereich 1 bis 100 | Legt fest, wie viel neuer Roleplay-Stoff sich zwischen zwei automatischen Episoden ansammelt |
| **Attach Card Appearance** | On | Ergänzt die Bild-Prompts um das Aussehen der erkannten Charaktere |
| **Send Avatar References** | On | Schickt die Avatare der erkannten Charaktere und Personas mit, sofern der Bild-Anbieter Referenzen unterstützt |
| **Use the final image template** | On | Formatiert ein geplantes Bild, bevor es an den Bild-Anbieter geht |
| **Use NovelAI character prompts** | On | Nutzt die native Charakter-Prompt-Funktion offizieller NovelAI-V4/V4.5-Verbindungen |

### Prompt-Bibliothek für den Game Mode

Die Bibliothek für den Game Mode kennt zwei getrennte Planungswege. Welcher greift, hängt davon ab, ob das Spiel gerade Standbilder oder Clips erzeugt.

| Einstellung | Standard | Zweck |
| --- | --- | --- |
| **Still planner** | Still Keyframes | Zerlegt einen abgeschlossenen GM-Zug in fertige Standbild-Momente |
| **Animation planner** | Comic Page Animation | Erzeugt animationsfertige Ausgangsbilder und Bewegungsanweisungen passend zur Cliplänge |

Das Paket bringt außerdem Planner für NovelAI, Comic, farbigen Manga, Schwarz-Weiß-Manga, Anime-Episoden und LTX mit. Den Prompt-Text jedes Planners bearbeitest du in der globalen Agent-Einrichtung. Welche Standbild- und Animationsoption ein Game-Chat nutzt, legst du unter **Chat Settings > Agents > Storyboards** fest.

### Prompt-Bibliothek für Roleplay

Im Roleplay setzt Marinara vier ausgewählte Prompts zu einer einzigen Planungsanfrage zusammen.

| Einstellung | Standard | Zweck |
| --- | --- | --- |
| **Episode contract** | Completed Roleplay Episode | Wählt abgeschlossene, vom Text gedeckte Handlungsmomente und behält deren Reihenfolge bei |
| **Visual style** | Normal / Anime | Legt die optische Umsetzung jedes Keyframes fest |
| **Animation addon** | Simple Storyboard Motion | Ergänzt nur für Clips Bewegung, Kameraführung, vom Text gedeckten Dialog und Geräusche, Atmosphäre und einen ruhigen Schluss |
| **Output contract** | Roleplay Keyframe JSON | Legt fest, welche strukturierten Keyframe-Felder der Planner zurückliefert |

Öffne die eingeklappte **Prompt library** (Prompt-Bibliothek) in Stage 1, um diese vollständigen Sammlungen zu bearbeiten. Über **Add option** (Option hinzufügen) legst du einen eigenen Prompt an, benennst ihn um, ergänzt eine kurze Beschreibung und schreibst den Prompt-Text. Die mitgelieferten Optionen lassen sich jederzeit auf den Paket-Standard zurücksetzen.

### Gemeinsame Formatierer für die Anbieter

Sobald ein Modus seine Bilder geplant hat, bauen gemeinsame Formatierer daraus die fertigen Anfragen an die Anbieter.

| Einstellung | Standard | Zweck |
| --- | --- | --- |
| **Default image prompt** | Game Scene Illustration | Formatiert jedes geplante Keyframe für den Bild-Anbieter |
| **Default video prompt** | Cinematic Scene Video | Formatiert das Ausgangsbild und den Bewegungsplan für den Video-Anbieter |

Jede nummerierte Stufe besitzt ihre eigene eingeklappte **Prompt library**: Stage 2 enthält die Bildformatierer, Stage 3 die bildgestützten Bewegungsplaner und Stage 4 die Videoformatierer zur direkten Weitergabe. Bei den Bildern stehen außerdem **Storyboard Illustration** und **Storyboard First Frame** zur Wahl. Bei den Videos gibt es **Anime Game Video**, **Comic Page Video** und **Narration Passthrough**. Game- und Roleplay-Chats dürfen unterschiedliche Formatierer nutzen, ohne die gemeinsame Prompt-Sammlung dahinter zu verändern.

### Globale Standardwerte und Überschreibungen pro Chat

Jeder Chat darf die Standardwerte des Agenten überschreiben. Geerbte Werte kennzeichnen die Chat Settings mit **Using agent default**; sobald eine Überschreibung existiert, erscheint eine Schaltfläche zum Zurücksetzen.

Bei den Verbindungen gilt je nach Modus eine leicht andere Rangfolge:

- Roleplay bietet pro Chat eigene Auswahlfelder für Prompt, Bild und Video. **Use global default** übernimmt die globale Storyboard-Einrichtung.
- Der Game Mode nutzt zuerst die spielspezifischen Verbindungen für Planung, Bild und Video, sofern gesetzt, und fällt sonst auf die Standardwerte des Storyboard-Agenten zurück.

Für Standbilder ist eine Bild-Verbindung Pflicht. Animationen brauchen zusätzlich ein erfolgreich erzeugtes Keyframe-Bild und eine Video-Verbindung.

## Roleplay-Storyboards

Roleplay-Storyboards bündeln abgeschlossene Wortwechsel zu einer bebilderten Episode und zeigen sie unter der KI-Antwort, die die Episode abschließt.

### Schnellstart

1. Installiere Storyboard und aktiviere es für den Roleplay-Chat.
2. Wähle unter **Chat Settings > Agents > Storyboards** eine **Prompt connection** und eine **Image connection** – oder lass beide auf **Use global default**, wenn die globale Einrichtung vollständig ist.
3. Wähle einen **Automatic mode**:
   - **Manual only**: keine automatische Episode; **Create storyboard** (Storyboard erstellen) baut auf Zuruf eine Standbild-Episode.
   - **Still images**: erzeugt automatisch eine bebilderte Episode.
   - **Animations**: erzeugt automatisch Keyframe-Bilder und zu jedem Bild einen Clip; dafür ist eine Video-Verbindung nötig.
4. Stell **Messages per episode** und **Keyframes per episode** ein.
5. Lass eine neue KI-Antwort fertig laufen – oder öffne die Gallery und klick auf **Create storyboard**.

Umfasst ein Storyboard mehrere Keyframes, blätterst du mit den Pfeilen zwischen den Bildern. Ein animiertes Keyframe spielt seinen Clip direkt im Chat ab und zeigt so lange das Bild, wie der Clip noch aussteht oder fehlt.

### So funktioniert das Episodenintervall

Das Intervall bestimmt, wie viele neue Nachrichten von dir und von der KI sich zwischen zwei erfolgreichen automatischen Storyboards ansammeln. Beide Nachrichtenarten zählen mit, und die Episode nimmt die neuen Nachrichten in zeitlicher Reihenfolge auf.

Der Standard ist 1: Schon die nächste fertige KI-Antwort kann also eine Episode auslösen. Ein höherer Wert lässt Dialog und Handlung erst einmal anwachsen. Als Quelle dienen höchstens die jüngsten 20 Nachrichten und 12.000 Zeichen – so ufert die Planungsanfrage auch in einem alten oder sehr langen Chat nicht aus.

Der Ankerpunkt des Takts rückt erst weiter, wenn ein vollständiges oder teilweises Storyboard gespeichert ist. Eine fehlgeschlagene Episode verbraucht das Ausgangsmaterial nicht. Beim Öffnen eines bestehenden Chats holt Marinara alte Antworten nicht nach; die Automatik wartet auf eine neu abgeschlossene KI-Antwort.

### Die Prompt-Kette im Roleplay

Vor den gemeinsamen Formatierern für die Anbieter durchläuft Roleplay vier Planungsebenen:

1. **Episode contract** wählt abgeschlossene, vom Text gedeckte Handlungsmomente aus und verankert sie in den übergebenen Nachrichten.
2. **Visual style** bestimmt die Umsetzung: Normal/Anime, NovelAI, Comic, Colored Manga oder B&W Manga.
3. **Animation addon** kommt nur bei animierten Storyboards dazu. Es beschreibt eine machbare Handlung, die Kameraführung, vom Text gedeckten Dialog und Geräusche, die Atmosphäre und einen ruhigen Schluss.
4. **Output contract** legt fest, welches strukturierte Keyframe-Ergebnis der Planner zurückgibt.

Anschließend gießt der **Storyboard Illustration Prompt** jedes geplante Ausgangsbild in die Anfrage an den Bild-Anbieter. Sind Clips aktiv, formatiert der **Storyboard Video Prompt** den Bewegungsplan für den Video-Anbieter.

Die Prompt-Bibliothek für Roleplay ist von der Planner-Bibliothek des Game Mode getrennt. Änderst du einen Visual style im Roleplay, bleiben die Standbild- und Animations-Planner des Game Mode unangetastet.

### Storyboard und Illustrator zusammen

Storyboard und Illustrator sind zwei verschiedene Agenten. Die manuellen Aktionen des Illustrators und seine übrigen Medien bleiben verfügbar. Steht das Roleplay-Storyboard auf **Still images** oder **Animations**, unterdrückt Marinara für diese fertige Antwort das übliche automatische Vordergrundbild des Illustrators. So liefern nicht beide Agenten konkurrierende Medien zur selben Antwort. Bei **Manual only** bleibt der gewohnte Illustrator-Ablauf unverändert.

## Game-Mode-Storyboards

Im Game Mode stützt sich ein Storyboard auf genau einen abgeschlossenen GM-Erzählzug. Marinara entfernt die versteckten GM-Befehls-Tags, plant geordnete Bilder und hängt jedes Bild an einen Bereich lesbarer Abschnitte des Zuges. Beim Lesen wechselt der Viewer passend zum jeweiligen Abschnitt das Bild.

### Schnellstart

1. Installiere Storyboard.
2. Erstelle oder öffne einen Game-Mode-Chat.
3. Öffne **Chat Settings > Agents**, aktiviere **Enable Agents** und danach **Enable Storyboards**.
4. Prüf, ob das Spiel eine Bild-Verbindung hat oder die globale Storyboard-Einrichtung eine liefert.
5. Lass einen GM-Erzählzug fertig laufen.
6. Öffne die **Gallery** und klick auf **Create storyboard**.

Hast du den Viewer im Spiel geschlossen, holst du ihn über **View storyboard** (Storyboard ansehen) in der Gallery zurück. Von Hand erzeugte Storyboards richten sich nach der aktuellen Animationseinstellung: Ist **Automatic Storyboard Animations** an, fordert auch das manuelle Storyboard Clips an.

### Automatische Storyboards im Game Mode

Die Karte Storyboard hat zwei Schalter für die Automatik:

- **Automatic Storyboard Illustrations** erzeugt nach einem abgeschlossenen GM-Zug Standbild-Keyframes.
- **Automatic Storyboard Animations** ergänzt zu jedem Keyframe einen Clip. Wer Animationen aktiviert, aktiviert damit auch die Illustrationen; wer die Illustrationen abschaltet, schaltet die Animationen mit ab.

Die Automatik läuft nur, wenn der Storyboard-Agent für dieses Spiel aktiv ist. Für einen Zug, der schon ein Storyboard hat, legt sie kein zweites an. Willst du für den aktuellen Zug bewusst ein weiteres, nimm die manuelle Aktion in der Gallery.

Ist **Expose image prompts before sending** (Bild-Prompts vor dem Senden anzeigen) unter den Generation-Einstellungen aktiv, zeigt ein manuell erstelltes Game-Storyboard die fertig kompilierten Bild-Prompts zur Prüfung. Automatische Storyboards laufen ohne Prüffenster durch, damit das Spiel nicht stockt.

### Game-Einstellungen

Öffne **Chat Settings > Agents > Storyboards**.

| Einstellung | Agent-Standard | Wirkung |
| --- | --- | --- |
| **Enable Storyboards** | Off pro Chat | Aktiviert den installierten Agenten für dieses Spiel |
| **Automatic Storyboard Illustrations** | Ergibt sich aus Automatic generation | Standbild-Keyframes nach jedem fertigen GM-Zug |
| **Automatic Storyboard Animations** | Ergibt sich aus Automatic generation | MP4-Clips zu jedem Keyframe |
| **Keyframes per Turn** | 3, Bereich 1 bis 6 | Zielzahl der Bilder; bei kurzen Zügen werden es womöglich weniger |
| **Animation Clip Duration** | 5 Sekunden, Bereich 1 bis 15 | Gewünschte Länge jedes Clips; manche Anbieter kappen sie |
| **Viewer Display** | Floating | Verschiebbarer Viewer oder vollflächiger Game-Hintergrund |
| **Still Planner** | Still Keyframes | Plant fertige Standbild-Illustrationen |
| **Animation Planner** | Comic Page Animation | Plant animationsfertige Ausgangsbilder und Bewegungsanweisungen |
| **Use Storyboard Template** | On | Wendet den gewählten finalen Illustrations-Formatierer an |
| **Storyboard Illustration Prompt** | Game Scene Illustration | Formatiert das geplante Bild für den Bild-Anbieter |
| **Storyboard Video Prompt** | Cinematic Scene Video | Formatiert Ausgangsbild und Bewegungsplan für den Video-Anbieter |

Das Paket liefert außerdem Planner für NovelAI, Comic, Manga, Anime und LTX. Ein Animation Planner allein schaltet die Videogenerierung noch nicht ein: Dafür brauchst du weiterhin **Automatic Storyboard Animations** und eine Video-Verbindung.

### Die Prompt-Kette im Game Mode

Für Standbilder und für animierte Ergebnisse hält der Game Mode getrennte Planner bereit:

```text
completed GM narration
  -> Still Planner or Animation Planner
  -> Storyboard Illustration Prompt
  -> image connection
  -> optional Storyboard Video Prompt
  -> video connection
```

Der Planner wählt die Handlungsmomente aus und bringt sie in eine Reihenfolge. Der Illustration Prompt ist reiner Formatierer Richtung Anbieter, kein zweiter Story-Planner. Bei aktiven Animationen liefert der Animation Planner beides: eine exakte Beschreibung des Ausgangsbildes und eine Bewegungsanweisung. Aus dieser Bewegungsanweisung baut der Video Prompt die fertige Anfrage.

### Überarbeitete Rezepte für den Game Mode

Diese Rezepte kombinieren eine vom Paket gesetzte Storyboard-Kette mit den übrigen Einstellungen für Spiel und Anbieter. Bietet dein Paket die genannte Kette an, wende sie an; sonst stellst du die aufgeführten Werte von Hand ein.

#### Google-Comic-Storyboards

Vom Paket gesetzte Kette:

- **Illustration Planner**: Still Keyframes
- **Animation Planner**: Comic Page Animation
- **Storyboard Illustration Prompt**: Game Scene Illustration
- **Storyboard Video Prompt**: Comic Page Video
- **Use Storyboard Template**: On

Checkliste fürs Spiel:

- **Visual Generation**: On
- **Image Connection**: Google/Nano Banana
- **Image Style**: Default
- Behalte den bei der Einrichtung erzeugten Kunststil bei.
- **Automatic Storyboard Illustrations**: On
- **Automatic Storyboard Animations**: Off
- **Keyframes per Turn**: 3
- **Video Connection**: None

So entstehen ganz normale Standbild-Storyboards. Die gespeicherte Comic-Page-Animationskette greift erst, wenn du später eine Video-Verbindung wählst und **Automatic Storyboard Animations** aktivierst.

#### NovelAI mit direkten Tags

Vom Paket gesetzte Kette:

- **Illustration Planner**: NovelAI Keyframes
- **Storyboard Illustration Prompt**: Leg eine eigene Option an, deren Prompt ausschließlich dies enthält:

  ```text
  ${scenePrompt}
  ```

- **Use Storyboard Template**: On
- Animation Planner und Storyboard Video Prompt bleiben unverändert.

Checkliste fürs Spiel:

- **Image Style**: Danbooru
- **Use Campaign Art Style**: Off
- **Attach Card Appearance**: Off
- **Send Avatar References**: Off
- **Use NovelAI Character Prompts**: Off
- **Queue media generation requests**: On
- Entferne den Fließtext unter **Style Text** aus dem Danbooru-Profil.
- Pass die positiven und negativen Tags sowie die Illustrations-Tags nach Bedarf an.

Die eigene Durchreich-Vorlage schickt die kompakten NovelAI-Tags des Planners direkt los, ohne sie in den üblichen Fließtext-Formatierer zu verpacken.

#### Lokal: Krea 2 + LTX 2.3

Vom Paket gesetzte Kette:

- **Illustration Planner**: Still Keyframes als Rückfalloption für reine Standbilder
- **Animation Planner**: LTX Simple Image-to-Video
- **Storyboard Illustration Prompt**: Storyboard First Frame
- **Storyboard Video Prompt**: Narration Passthrough
- **Use Storyboard Template**: On

Bei einer GPU mit 8 GB VRAM startest du mit einem einzigen Keyframe in 480p. Läuft das sauber durch, steigerst du auf drei Keyframes und höhere Auflösungen. ComfyUI-Verbindung, Platzhalter und das komplette Prüfverfahren stehen unter [LTX-2.3-Storyboards im Game Mode](ltx-2-3-storyboards.md).

### Die Präsentation Storyboard Optimized ist nicht der Agent-Schalter

Die Präsentation **Storyboard Optimized** im Einrichtungsassistenten des Spiels ändert den Erzähl-Prompt des GM, damit die Züge klarere, verfilmbare Bildanker enthalten. Sie installiert oder aktiviert Storyboard aber nicht, schaltet keine automatischen Medien frei und wählt weder Bild- noch Video-Verbindung.

Der Storyboard-Agent funktioniert mit der Präsentation Standard genauso wie mit Storyboard Optimized. Installieren und aktivieren musst du ihn in jedem Fall separat.

### Der Viewer im Game Mode

**Floating viewer** ist ein verschiebbares, in der Größe veränderbares Panel über dem Spiel. Es folgt deiner Leseposition in der GM-Erzählung und zeigt das passende Bild. Ein Video läuft, sobald es fertig ist; sonst erscheint das Standbild des Keyframes.

**Game background** legt das aktive Bild hinter die Spielbedienelemente. Solange dieser Modus läuft, ersetzt er den sonst erzeugten Szenen-Hintergrund; die gewohnte Aktion **Generate background** (Hintergrund erzeugen) ist dann nicht verfügbar. Hintergrund-Clips laufen einmal durch und bleiben auf dem letzten Bild stehen; über die Spielbedienelemente steuerst du Wiederholung, Wiedergabe/Pause und Stummschaltung.

Schließt du den schwebenden Viewer, bleibt er nur für den aktuellen Zug verborgen. Über **Gallery > View storyboard** holst du ihn zurück.

## Bild-Prompts und einheitliche Charaktere

Der gewählte Planner und der finale Bild-Prompt haben verschiedene Aufgaben:

- Der Planner entscheidet, welche Momente zu sehen sind, und beschreibt den Bildinhalt jedes Keyframes.
- Die finale Bildvorlage ergänzt die Struktur für den Anbieter, das Aussehen der erkannten Charaktere, die Referenzbilder, den Ort, den Kunststil der Kampagne und die Bildanweisungen.

Liefert ein Planner bereits genau die Prompt-Syntax, die der Bild-Anbieter erwarten soll, nimm eine Durchreich-Vorlage wie `${scenePrompt}`. **Use the final image template** schaltest du nur ab, wenn du den gewählten Formatierer bewusst umgehen willst. Die zwingenden Bildanweisungen gelten weiterhin.

Für gleichbleibende Charaktere:

- Halte das Feld Appearance auf der Charakterkarte konkret und aktuell.
- Lass **Attach Card Appearance** an, außer der gewählte Planner wiederholt ohnehin alle nötigen Angaben zum Aussehen.
- Lass **Send Avatar References** an, wenn der Anbieter Referenzen annimmt und die Avatare zum gewünschten Look passen.
- Halte die Besetzung pro Bild klein und klar sichtbar. Storyboard nimmt nur Referenzen der erkannten, sichtbaren Charaktere und Personas mit, nicht jeden Charakter im Chat.

**Use NovelAI character prompts** wirkt ausschließlich bei Anfragen über offizielle NovelAI-V4/V4.5-Verbindungen. Bei allen anderen Anbietern läuft die Anfrage über den gemeinsamen Prompt-Pfad, auch wenn der Schalter an ist.

## Kosten und Leistung

Jedes Keyframe ist ein eigener Bild-Auftrag. Bei animierten Storyboards kommt pro erfolgreichem Keyframe ein Video-Auftrag dazu. Ein animiertes Storyboard mit drei Bildern löst also drei Bild- und drei Video-Anfragen aus.

Beim Test eines neuen Anbieters oder eines lokalen Workflows fängst du am besten mit Standbildern und einem einzigen Keyframe an. Bildzahl, Cliplänge und Automatik-Takt erhöhst du erst, wenn der Grundablauf zuverlässig läuft.

## Bestehende Spiele aus dem alten Storyboard-System

Storyboard ist inzwischen ein herunterladbarer Agent. In bestehenden Game-Chats können aber noch Werte stecken, die die frühere Engine-eigene Storyboard-Oberfläche gesetzt hat. Marinara behält sie bei der Installation des Pakets als Überschreibungen pro Chat – eine funktionierende Spieleinrichtung geht dabei nicht verloren.

Ein älteres Spiel verhält sich deshalb womöglich anders, als es die aktuellen Standardwerte des Agenten vorgeben. Öffne **Chat Settings > Agents > Storyboards** und setz die betreffenden Felder einzeln zurück, damit sie wieder den Standard des Storyboard-Agenten erben.

Die alten Einstellungen sind reine Migrationsdaten, keine zweite Storyboard-Umsetzung. Erzeugt wird weiterhin nur, wenn das Storyboard-Paket installiert und für das Spiel aktiv ist.

## Fehlerbehebung

### Storyboard fehlt in den Chat Settings

- Installiere **Storyboard** über **Agents > Download Agents**.
- Nutze einen Roleplay- oder Game-Chat; Conversation wird nicht unterstützt.
- Prüf, ob die Paketversion zur installierten Engine-Version passt.

### Create storyboard ist da, aber die Generierung schlägt fehl

- Aktiviere **Enable Agents** und **Enable Storyboards** für den Chat.
- Wähle eine gültige Verbindung zur Bildgenerierung: in der Roleplay-Karte Storyboard, in den Game-Einstellungen oder in der globalen Storyboard-Einrichtung.
- Warte, bis die Antwort der KI beziehungsweise des GM fertig ist, und versuch es dann erneut.

### Roleplay erzeugt keine automatische Episode

- Wähle **Still images** oder **Animations**, nicht **Manual only**.
- Warte auf eine neu abgeschlossene KI-Antwort. Beim Öffnen eines Chats holt Marinara alte Nachrichten nicht nach.
- Prüf **Messages per episode**. Seit dem letzten erfolgreichen Ankerpunkt müssen genug neue Nachrichten von dir und von der KI zusammengekommen sein.
- Ein fehlgeschlagener Durchlauf rückt den Ankerpunkt nicht weiter; schau also im Server-Log nach dem ursprünglichen Anbieter- oder Parsing-Fehler.

### Bilder erscheinen, Videos nicht

- Wähle im Roleplay **Animations**. Im Game Mode aktivierst du **Automatic Storyboard Animations**.
- Wähle eine **Video Generation**-Verbindung.
- Prüf, ob die Video-Verbindung Bild-zu-Video-Eingaben unterstützt.
- Schau im Tab **Videos** der Gallery nach. Ein Clip wird oft erst nach seinem Keyframe-Bild fertig.
- Ist die Planung nach einem LLM-Fehler auf die Notlösung ausgewichen, behält Marinara die Ersatzbilder und lässt die Videos für diesen Durchlauf aus.

### Ein Storyboard ist unvollständig oder hängt

Dann sind meist ein oder mehrere Aufträge beim Anbieter fehlgeschlagen, ins Zeitlimit gelaufen oder an ein Anfrage- beziehungsweise Inhaltslimit gestoßen. Läuft der Anbieter störungsfrei, aber langsam, erhöh `IMAGE_GEN_TIMEOUT_MS` oder `VIDEO_GEN_TIMEOUT_MS` in der Datei `.env` und starte Marinara neu – diese Werte liest die App nur beim Start.

Für einen genaueren Blick aktivierst du den Debug-Modus und suchst im Server-Log nach `storyboard`. Dort stehen Planner, kompilierter Bild-Prompt, ausgewählte Referenzen und Video-Prompt. Debug-Logs können private Chat-Texte und Prompts enthalten: Bereinige sie, bevor du sie weitergibst.

## Verwandte Anleitungen

- [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md)
- [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md)
- [Game Mode: Erste Schritte](getting-started.md)
- [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md)
- [Anbieter für Bildgenerierung und Einrichtung](../media/image-providers.md)
- [Szenenvideos generieren](../media/scene-video.md)
- [LTX-2.3-Storyboards im Game Mode](ltx-2-3-storyboards.md)
