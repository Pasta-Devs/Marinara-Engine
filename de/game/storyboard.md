# Anleitung zum Storyboard-Agenten

Der herunterladbare Agent **Storyboard** macht aus fertigem Erzähltext geordnete Keyframe-Bilder und auf Wunsch kurze Bild-zu-Video-Clips. Er funktioniert im Game Mode und in Roleplay. Conversation-Chats nutzen ihn nicht.

Das Storyboard-Paket liefert die Planungs-Prompts, die Standardwerte und die Bedienelemente pro Chat. Marinara erzeugt die Medien, legt die Ergebnisse in der Gallery (Galerie) ab und zeigt sie im Chat oder im Game-Viewer an. Diese Anleitung behandelt zuerst den Game Mode. Der Ablauf für Roleplay folgt unter [Roleplay-Storyboards](#roleplay-storyboards). Alles Weitere zu Roleplay steht unter [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md).

- **Game Mode** nutzt einen abgeschlossenen Erzählzug des Game Masters (GM). Er hat getrennte Schalter **Automatic Storyboard Illustrations** und **Automatic Storyboard Animations** sowie **Gallery → Create storyboard** (Galerie → Storyboard erstellen) für den letzten GM-Zug. Das Storyboard erscheint in einem schwebenden Viewer oder als Game-Hintergrund, synchron zur Erzählung, und für Standbilder und Animationen gibt es getrennte Planner.
- **Roleplay** nutzt die abgeschlossenen Nachrichten seit der letzten erfolgreichen Episode. Die Automatik-Optionen sind **Manual only**, **Still images** oder **Animations**, und **Gallery → Create storyboard** arbeitet mit der zuletzt abgeschlossenen KI-Antwort. Das Storyboard erscheint direkt im Chat unter der Antwort, die die Episode abschließt, und nutzt einen Episode contract, einen Visual style, ein optionales Animation addon und einen Output contract.

Beide Modi legen die Keyframe-Bilder im Tab **Images** der Gallery ab und die Clips im Tab **Videos**.

## Den Agenten installieren

1. Öffne über das Sparkles-Symbol das Panel **Agents** (Agenten).
2. Wähle **Agent Organizer** (Agentenverwaltung).
3. Öffne **Storyboard** und klick auf **Install** (Installieren).
4. Öffne einen Game- oder Roleplay-Chat und dann **Chat Settings → Agents** (Chat-Einstellungen → Agenten).
5. Schalte **Enable Agents** (Agenten aktivieren) ein und danach in der Karte Storyboard **Enable Storyboards** (Storyboards aktivieren).

Die Installation macht den Agenten verfügbar, schaltet ihn aber nicht in jedem Chat ein. Ein Neustart von Marinara ist nicht nötig.

Wenn es nicht funktioniert hat und Storyboard in den Chat Settings fehlt, prüf, ob das Paket installiert ist, ob der Chat ein Game- oder Roleplay-Chat ist und ob die Paketversion zu deiner Marinara-Version passt.

## Game-Mode-Storyboards

Ein Storyboard im Game Mode nutzt genau einen abgeschlossenen GM-Erzählzug als Quelle der Geschichte. Es entfernt die versteckten GM-Befehls-Tags, plant geordnete Bilder und hängt jedes Bild an einen Bereich lesbarer Abschnitte des Zuges. Der Viewer wechselt das Bild, während du beim Lesen durch diese Abschnitte gehst.

### Ein Game-Storyboard erstellen

**Bevor du anfängst:** Das Spiel braucht ein Bildkonto (sein eigenes oder eines aus der globalen Storyboard-Einrichtung). Siehe [Anbieter für Bildgenerierung und Einrichtung](../media/image-providers.md).

1. Installiere Storyboard und öffne einen Game-Chat.
2. Öffne **Chat Settings → Agents**, schalte **Enable Agents** ein und danach **Enable Storyboards**.
3. Lass einen GM-Erzählzug fertig laufen.
4. Öffne **Chat Settings → Gallery** und klick auf **Create storyboard**.

Hast du den Viewer geschlossen, holst du ihn über **View storyboard** (Storyboard ansehen) in der Gallery zurück. Die manuelle Generierung richtet sich nach der aktuellen Animationseinstellung: Ist **Automatic Storyboard Animations** an, fordert auch ein manuelles Storyboard Clips an.

Wenn es nicht funktioniert hat, sieh unter [Fehlerbehebung](#troubleshooting) nach.

### Automatische Storyboards im Game Mode

Die Karte Storyboard hat zwei Schalter:

- **Automatic Storyboard Illustrations** erzeugt nach einem abgeschlossenen GM-Zug Standbild-Keyframes.
- **Automatic Storyboard Animations** erzeugt zusätzlich zu jedem Keyframe einen Clip. Schaltest du die Animationen ein, gehen auch die Illustrationen an; schaltest du die Illustrationen aus, gehen auch die Animationen aus.

Die Automatik läuft nur, solange der Agent für dieses Spiel aktiv ist, und legt für einen Zug, der schon ein Storyboard hat, kein neues an. Willst du für den letzten Zug ein weiteres, nimm die manuelle Aktion in der Gallery.

Ist **Expose media prompts before sending** (Medien-Prompts vor dem Senden anzeigen) in den Generation-Einstellungen an, kann ein manuelles Game-Storyboard seine kompilierten Bild-Prompts zur Prüfung zeigen. Automatische Storyboards überspringen die Prüfung, damit das Spiel nicht stockt.

### Game-Einstellungen

Öffne **Chat Settings → Agents → Storyboards**.

| Einstellung | Agent-Standard | Wirkung |
| --- | --- | --- |
| **Enable Storyboards** | Off pro Chat | Schaltet den installierten Agenten für dieses Spiel ein. |
| **Automatic Storyboard Illustrations** | Ergibt sich aus Automatic generation | Standbild-Keyframes nach jedem GM-Zug. |
| **Automatic Storyboard Animations** | Ergibt sich aus Automatic generation | MP4-Clips zu jedem Keyframe. |
| **Keyframes per Turn** | 3 (1 bis 200) | Zielzahl der Bilder. Kurze Züge ergeben womöglich weniger. |
| **Animation Clip Duration** | 5 Sekunden (1 bis 15) | Gewünschte Länge jedes Clips. Ein Dienst kann sie kappen. |
| **Viewer Display** | Floating | Verschiebbarer Viewer oder vollflächiger Game-Hintergrund. |
| **Illustration Planner** | Still Keyframes | Plant fertige Standbild-Illustrationen. |
| **Animation Planner** | Comic Page Animation | Plant animationsfertige Ausgangsbilder und Bewegungsanweisungen. |
| **Use Storyboard Template** | On | Wendet den gewählten finalen Illustrations-Formatierer an. |
| **Storyboard Illustration Prompt** | Game Scene Illustration | Formatiert das geplante Bild für den Bilddienst. |
| **Storyboard Video Prompt** | Cinematic Scene Video | Formatiert Ausgangsbild und Bewegungsplan für den Videodienst. |

Das Paket liefert außerdem Planner für NovelAI, Comic, Manga, Anime und LTX. Die Wahl eines Animation Planners schaltet Video nicht von selbst ein. **Automatic Storyboard Animations** und ein Videokonto sind weiterhin nötig.

Jeder Chat kann die Standardwerte des Agenten überschreiben. Geerbte Werte kennzeichnen die Chat Settings mit **Using agent default**, und sobald du einen Wert überschreibst, erscheint eine Schaltfläche zum Zurücksetzen.

### So entsteht ein Game-Storyboard

Der Game Mode hält getrennte Planner für Standbilder und Animationen bereit.

```text
completed GM narration
  -> still or animation planner
  -> Storyboard Illustration Prompt
  -> image account
  -> optional Storyboard Video Prompt
  -> video account
```

Der Planner wählt die Handlungsmomente aus und bringt sie in eine Reihenfolge. Der Illustrations-Prompt ist ein Formatierer für den Dienst, kein weiterer Planner. Sind Animationen an, liefert der Animation Planner eine exakte Beschreibung des Ausgangsbildes und eine Bewegungsanweisung, und der Video-Prompt macht aus der Bewegungsanweisung die fertige Anfrage.

### Der Viewer im Game Mode

- **Floating viewer** ist ein verschiebbares, in der Größe veränderbares Panel über dem Spiel. Es folgt deiner Leseposition in der Erzählung und zeigt das passende Bild. Ein Video läuft, sobald es fertig ist, sonst erscheint das Bild des Keyframes. Schließt du den Viewer, bleibt er für den aktuellen Zug verborgen. Über **Gallery → View storyboard** öffnest du ihn wieder.
- **Game background** legt das aktive Bild hinter den restlichen Bildschirm. Solange diese Option an ist, ersetzt sie den erzeugten Szenen-Hintergrund, deshalb ist **Generate background** (Hintergrund erzeugen) nicht verfügbar. Hintergrund-Clips laufen einmal durch und bleiben auf ihrem letzten Bild stehen.

Für Wiederholung, Wiedergabe/Pause und Stummschaltung öffnest du **Game controls** (Spielsteuerung), die Schaltfläche mit dem Gamecontroller nahe der oberen rechten Ecke des Chats. Am Computer öffnet sie sich als Fenster, am Telefon als Panel. Hast du die Steuerung in die Chat Settings verschoben, öffne dort den Abschnitt **Game controls**.

### Storyboard Optimized ist nicht der Agent-Schalter

Die Präsentation **Storyboard Optimized** im Einrichtungsassistenten ändert den Erzähl-Prompt des GM, damit die Züge stärkere, verfilmbare Bildanker enthalten. Sie installiert oder aktiviert Storyboard nicht, schaltet keine automatischen Medien ein und wählt weder Bild- noch Videokonto. Du kannst den Agenten mit **Standard** genauso nutzen wie mit **Storyboard Optimized**. Installieren und einschalten musst du den Agenten separat.

### Rezepte für den Game Mode

Jedes Rezept kombiniert eine Storyboard-Kette mit den übrigen Einstellungen für Spiel und Dienst. Bietet dein Paket die genannte Kette an, wende sie an; sonst wählst du die aufgeführten Optionen von Hand.

#### Google-Comic-Storyboards

Kette: **Illustration Planner** Still Keyframes, **Animation Planner** Comic Page Animation, **Storyboard Illustration Prompt** Game Scene Illustration, **Storyboard Video Prompt** Comic Page Video, **Use Storyboard Template** On.

Checkliste fürs Spiel:

- **Illustrator**: On (Schritt Features im Assistenten)
- Bildkonto: Google/Nano Banana, **Image Style** (Bildstil): Default, und behalte den bei der Einrichtung erzeugten Kunststil bei
- **Automatic Storyboard Illustrations**: On
- **Automatic Storyboard Animations**: Off
- **Keyframes per Turn**: 3
- Videokonto: None

So entstehen ganz normale Standbild-Storyboards. Die gespeicherte Comic-Page-Animationskette greift erst, wenn du später ein Videokonto wählst und **Automatic Storyboard Animations** einschaltest.

#### NovelAI mit direkten Tags

Kette: **Illustration Planner** NovelAI Keyframes. Leg für **Storyboard Illustration Prompt** eine eigene Option an, deren Prompt nur den folgenden Text enthält. Stell **Use Storyboard Template** auf On. Lass Animation Planner und Video Prompt unverändert.

```text
${scenePrompt}
```

Checkliste fürs Spiel:

- **Image Style**: Danbooru, und entferne den Fließtext unter **Style text** aus dem Danbooru-Profil
- **Use Campaign Art Style**: Off
- **Attach Card Appearance**: Off
- **Send Avatar References**: Off
- **Use NovelAI Character Prompts**: Off
- **Queue media generation requests**: On
- Pass die positiven und negativen Tags sowie die Illustrations-Tags nach Bedarf an

Die Durchreich-Vorlage schickt die kompakten NovelAI-Tags des Planners los, ohne sie in den üblichen Fließtext-Formatierer zu verpacken.

#### Lokal: Krea 2 + LTX 2.3

Kette: **Illustration Planner** Still Keyframes als Rückfalloption für reine Standbilder, **Animation Planner** LTX Simple Image-to-Video, **Storyboard Illustration Prompt** Storyboard First Frame, **Storyboard Video Prompt** Narration Passthrough, **Use Storyboard Template** On.

Bei einer GPU mit 8 GB VRAM startest du mit einem einzigen Keyframe in 480p. Läuft das, gehst du in Richtung drei Keyframes und größerer Auflösungen. Das ComfyUI-Konto, die Platzhalter und den vollständigen Test findest du unter [LTX-2.3-Storyboards im Game Mode](ltx-2-3-storyboards.md).

## Roleplay-Storyboards

Roleplay-Storyboards bündeln abgeschlossene Wortwechsel zu einer bebilderten Episode, die unter der KI-Antwort erscheint, die sie abschließt.

### Ein Roleplay-Storyboard erstellen

1. Installiere Storyboard und schalte es für den Roleplay-Chat ein.
2. Wähle unter **Chat Settings → Agents → Storyboards** eine **Prompt connection** und ein **Image model** – oder lass beide auf **Use global default**, wenn die globale Einrichtung vollständig ist.
3. Wähle einen **Automatic mode**:
   - **Manual only**: keine automatische Episode. **Create storyboard** erzeugt auf Zuruf eine Standbild-Episode.
   - **Still images**: erzeugt automatisch eine bebilderte Episode.
   - **Animations**: erzeugt automatisch Keyframe-Bilder und zu jedem Bild einen Clip. Dafür ist ein Videokonto nötig.
4. Stell **Messages per episode** und **Keyframes per episode** ein.
5. Lass eine neue KI-Antwort fertig laufen, oder öffne **Chat Settings → Gallery** und klick auf **Create storyboard**.

Umfasst ein Storyboard mehrere Keyframes, wechselst du mit den Pfeilen zwischen den Bildern. Ein animiertes Bild zeigt seinen Clip direkt im Chat und weicht auf sein Standbild aus, solange der Clip noch aussteht oder nicht verfügbar ist.

### So funktioniert das Episodenintervall

Das Intervall gibt an, wie viele neue Nachrichten von dir und von der KI sich zwischen zwei erfolgreichen automatischen Storyboards ansammeln müssen. Beide Seiten zählen mit, und die Episode nimmt die neuen Nachrichten in ihrer Reihenfolge auf. Der Standard ist 1, also kann schon die nächste abgeschlossene KI-Antwort sofort eine Episode erzeugen. Ein höherer Wert lässt mehr Dialog und Handlung zusammenkommen. Die Quelle ist auf die letzten 20 Nachrichten und 12.000 Zeichen begrenzt, damit ein langer Chat keine unbegrenzte Planungsanfrage auslöst.

Der Zähler rückt erst weiter, wenn ein vollständiges oder teilweises Storyboard gespeichert ist; eine fehlgeschlagene Episode verbraucht die Quelle also nicht. Beim Öffnen eines bestehenden Chats holt Marinara alte Antworten nicht nach. Die Automatik wartet auf eine neu abgeschlossene KI-Antwort.

### Prompt-Bibliothek für Roleplay

Roleplay setzt aus vier ausgewählten Prompts eine Planungsanfrage zusammen:

| Einstellung | Standard | Zweck |
| --- | --- | --- |
| **Episode contract** | Completed Roleplay Episode | Wählt vom Text gedeckte Handlungsmomente und behält ihre Reihenfolge in den Nachrichten bei. |
| **Visual style** | Normal / Anime | Der Look jedes Keyframes. Weitere: NovelAI, Comic, Colored Manga, B&W Manga. |
| **Animation addon** | Simple Storyboard Motion | Nur für Clips. Ergänzt eine machbare Handlung, die Kameraführung, vom Text gedeckten Dialog und Geräusche, die Atmosphäre und einen ruhigen Schluss. |
| **Output contract** | Roleplay Keyframe JSON | Die strukturierten Keyframe-Felder, die der Planner zurückgibt. |

Anschließend formatiert der **Storyboard Illustration Prompt** jedes Ausgangsbild für den Bilddienst, und sind Clips an, formatiert der **Storyboard Video Prompt** den Bewegungsplan. Öffne die eingeklappte **Prompt library** (Prompt-Bibliothek) in Stage 1, um diese Prompts zu bearbeiten. Über **Add option** (Option hinzufügen) legst du einen eigenen Prompt an, benennst ihn dann um, ergänzt eine kurze Beschreibung und bearbeitest den Prompt-Text. Die mitgelieferten Optionen kannst du auf ihren Standard zurücksetzen. Änderst du einen Visual style im Roleplay, bleiben die Planner des Game Mode unverändert.

### Storyboard und Illustrator zusammen

Storyboard ist vom Illustrator getrennt, und die manuellen Aktionen des Illustrators bleiben verfügbar. Steht das Roleplay-Storyboard auf **Still images** oder **Animations**, lässt Marinara für diese Antwort das übliche automatische Illustrator-Bild aus, damit die beiden keine konkurrierenden Medien erzeugen. Bei **Manual only** bleibt der Illustrator-Ablauf unverändert.

## Einstellungen des Storyboard-Agenten

Öffne das Panel **Agents**, wähle **Storyboard** und öffne seine Einrichtung. Diese Werte sind die Standardwerte für Chats ohne eigene Überschreibungen.

| Einstellung | Standard | Zweck |
| --- | --- | --- |
| Agent connection | Das Konto, das du für Agenten gewählt hast | Plant das Storyboard mit einem Modell. |
| **Image model** | **Use the chat image connection** | Erzeugt jedes Keyframe. Irgendwo in der Fallback-Kette muss ein Bildkonto stehen. |
| **Video connection** | **Use the chat video connection** | Erzeugt Clips, wenn Animationen an sind. |
| **Automatic generation** | Still images | Das automatische Startverhalten für neu aktivierte Chats. |
| **Keyframes per turn** | 3 (1 bis 200) | Zielzahl der geordneten Bilder. |
| **Clip seconds** | 5 (1 bis 15) | Gewünschte Länge jedes Clips. |
| **Viewer display** | Floating viewer | Der Standard für den Game-Viewer. Roleplay zeigt Storyboards immer direkt im Chat. |
| **Default Roleplay episode interval** | 1 (1 bis 100) | Wie viel neuer Roleplay-Stoff zwischen zwei automatischen Episoden nötig ist. |
| **Attach Card Appearance** | On | Ergänzt die Bild-Prompts um das Aussehen der erkannten Charaktere. Eine Karte oder Persona mit eingeschaltetem **Image Appearance Override** (eigene Aussehensbeschreibung für Bilder) liefert diesen Text statt ihres Felds **Appearance**. |
| **Send Avatar References** | On | Schickt die Avatare der erkannten Charaktere und Personas mit, wenn der Bilddienst Referenzen annimmt. |
| **Use the final image template** | On | Formatiert ein geplantes Bild, bevor es an den Bilddienst geht. In einem Game-Chat heißt die Einstellung **Use Storyboard Template**. |
| **Use NovelAI character prompts** | On | Native Prompts pro Charakter, nur bei unterstützten offiziellen NovelAI-Konten mit V4 und V4.5. Andere Dienste nutzen den gemeinsamen Prompt-Pfad. |

Für den Game Mode hat die Bibliothek zwei Planungswege. Welcher greift, hängt davon ab, ob das Spiel Standbilder oder Clips erzeugt: **Still planner** (Standard: Still Keyframes) und **Animation planner** (Standard: Comic Page Animation). Den Planner-Text bearbeitest du in der globalen Agent-Einrichtung, und jeder Game-Chat wählt in seinen eigenen Einstellungen unter den Optionen aus.

Nach der Planung bauen gemeinsame Formatierer die fertigen Anfragen: **Default image prompt** (Game Scene Illustration) und **Default video prompt** (Cinematic Scene Video). Jede nummerierte Stufe hat ihre eigene eingeklappte **Prompt library**: Stage 2 für Bildformatierer, Stage 3 für bildgestützte Bewegungsplaner und Stage 4 für Videoformatierer zur direkten Weitergabe. Bei den Bildern stehen außerdem **Storyboard Illustration** und **Storyboard First Frame** zur Wahl. Bei den Videos gibt es **Anime Game Video**, **Comic Page Video** und **Narration Passthrough**. Game- und Roleplay-Chats können unterschiedliche Formatierer wählen.

**Image-aware shot planning** (bildgestützte Planung der Kameraeinstellungen) in Stage 3 folgt außerdem den **Video prompting instructions** (Anweisungen für Video-Prompts) des Videokontos. Beschreibe in diesem Feld im Konto-Editor, was dein Videomodell erwartet, etwa Formulierungen für die Kamera, die Länge des Prompts oder Hinweise auf Ton.

Konten werden je nach Modus etwas anders gewählt. Roleplay hat pro Chat eigene Auswahlfelder für Prompt, Bild und Video, und **Use global default** übernimmt die Storyboard-Einrichtung. Der Game Mode nutzt seine eigenen Konten für Planung, Bild und Video, sofern gesetzt, und fällt sonst auf die Standardwerte des Agenten zurück. Standbilder brauchen ein Bildkonto. Animationen brauchen ein erfolgreich erzeugtes Keyframe-Bild und ein Videokonto.

## Bild-Prompts und einheitliche Charaktere

Der Planner entscheidet, welche Momente zu sehen sind, und schreibt den Bildinhalt jedes Keyframes. Die finale Bildvorlage ergänzt die Struktur für den Dienst, das Aussehen der erkannten Charaktere, den Umgang mit Referenzen, den Kontext des Orts, die Kunstrichtung der Kampagne und die Bildanweisungen.

Liefert ein Planner bereits genau die Syntax, die der Bilddienst bekommen soll, nimm eine Durchreich-Vorlage wie `${scenePrompt}`. **Use the final image template** schaltest du nur ab, wenn du den Formatierer bewusst umgehen willst. Die zwingenden Bildanweisungen gelten weiterhin.

Für gleichbleibende Charaktere:

- Halte die Appearance-Felder der Charakterkarten konkret und aktuell.
- Lass **Attach Card Appearance** an, außer der Planner wiederholt die nötigen Angaben ohnehin.
- Lass **Send Avatar References** an, wenn der Dienst Referenzen annimmt und die Avatare zum gewünschten Look passen.
- Halte die Besetzung pro Bild klein und klar sichtbar. Storyboard nimmt nur erkannte, sichtbare Charaktere und Personas mit, nicht jeden im Chat.

## Kosten und Leistung

Jedes Keyframe ist ein eigener Bildauftrag. Animierte Storyboards fügen pro erfolgreichem Keyframe einen Videoauftrag hinzu, ein animiertes Storyboard mit drei Bildern kann also drei Bild- und drei Videoanfragen auslösen. Testest du einen neuen Dienst oder ein lokales Setup, fang mit Standbildern und einem einzigen Keyframe an. Bildzahl, Cliplänge und Automatik-Intervall erhöhst du erst, wenn der Grundablauf funktioniert.

## Spiele aus dem älteren Storyboard-System

Bestehende Game-Chats können noch Einstellungen aus der älteren, eingebauten Storyboard-Oberfläche enthalten. Marinara behält sie bei der Installation des Pakets als Überschreibungen pro Chat, deshalb kann sich ein älteres Spiel anders verhalten, als es die aktuellen Standardwerte des Agenten vorgeben. Öffne **Chat Settings → Agents → Storyboards** und nutze bei jedem Feld die Schaltfläche zum Zurücksetzen, damit es wieder dem Standard des Agenten folgt. Diese Einstellungen sind reine Migrationsdaten. Für die Generierung muss das Paket weiterhin installiert und für das Spiel eingeschaltet sein.

<a id="troubleshooting"></a>

## Fehlerbehebung

### Create storyboard ist da, aber die Generierung schlägt fehl

- Schalte **Enable Agents** und **Enable Storyboards** für den Chat ein.
- Wähle ein gültiges Konto für Bildgenerierung: in der Roleplay-Karte Storyboard, in den Game-Einstellungen oder in der globalen Storyboard-Einrichtung.
- Warte, bis die Antwort der KI beziehungsweise des GM fertig ist, und versuch es dann erneut.

### Roleplay hat keine automatische Episode erzeugt

- Wähle **Still images** oder **Animations**, nicht **Manual only**.
- Warte auf eine neu abgeschlossene KI-Antwort. Beim Öffnen eines Chats holt Marinara alte Nachrichten nicht nach.
- Prüf **Messages per episode**. Es müssen sich genug neue Nachrichten von dir und von der KI ansammeln.
- Ein fehlgeschlagener Durchlauf rückt den Zähler nicht weiter; schau also im Server-Log nach dem ursprünglichen Dienst- oder Parsing-Fehler.

### Bilder erscheinen, Videos nicht

- Wähle im Roleplay **Animations**. Im Game Mode schaltest du **Automatic Storyboard Animations** ein.
- Wähle ein Konto für Videogenerierung, das Bild-zu-Video-Eingaben unterstützt.
- Schau im Tab **Videos** der Gallery nach. Ein Clip kann erst nach seinem Keyframe-Bild fertig werden.
- Ist die Planung nach einem Fehler des Modells auf eine Notlösung ausgewichen, kann Marinara Ersatzbilder behalten und die Videos für diesen Durchlauf auslassen.

### Ein Storyboard ist unvollständig oder hängt

Ein Auftrag beim Dienst ist vielleicht fehlgeschlagen, ins Zeitlimit gelaufen oder an ein Anfrage- oder Inhaltslimit gestoßen. Läuft der Dienst störungsfrei, aber langsam, erhöh `IMAGE_GEN_TIMEOUT_MS` oder `VIDEO_GEN_TIMEOUT_MS` in der `.env` und starte Marinara dann neu, denn diese Werte werden beim Start gelesen. Siehe [Konfiguration](../CONFIGURATION.md).

Schalte den Debug-Modus ein und such im Server-Log nach `storyboard`, um Planner, kompilierten Bild-Prompt, Auswahl der Referenzen und Video-Prompt zu sehen. Debug-Logs können private Chat-Texte enthalten, also bereinige sie, bevor du sie weitergibst.

## Verwandte Anleitungen

- [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md)
- [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md)
- [Game Mode: Erste Schritte](getting-started.md)
- [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md)
- [Anbieter für Bildgenerierung und Einrichtung](../media/image-providers.md)
- [Szenenvideos generieren](../media/scene-video.md)
- [LTX-2.3-Storyboards im Game Mode](ltx-2-3-storyboards.md)
