# Illustrator-Agent

Der **Illustrator** ist ein herunterladbarer Agent, der während des Chats Bilder zu deinen Szenen zeichnet. In dieser Anleitung erfährst du, wie du ihn aktivierst, einen Kunststil und ein Bildmodell wählst und Clips erzeugst. Ein Agent ist ein kleiner KI-Helfer, der automatisch in einem einzelnen Chat mitläuft.

## Was der Illustrator macht

Der Illustrator ist ein Nachbearbeitungs-Agent und läuft daher, sobald die KI eine Antwort fertig geschrieben hat. Er liest die letzte Antwort und entscheidet, ob der Moment ein Bild verdient. Wenn ja, schreibt er einen Bild-Prompt (den Text, der einem Bildmodell sagt, was es zeichnen soll) und schickt ihn an deinen Bilddienst. Jedes Bild, das er erzeugt, wird in der **Gallery** (Galerie) des Chats gespeichert.

Er zeichnet nicht zu jeder Nachricht. Nach einem Bild wartet er standardmäßig 5 angenommene Nachrichten von dir und der KI ab, bevor er das nächste erzeugen kann. Jeder Roleplay-Chat kann diese Zahl ändern. Swipes oder das Neugenerieren einer Antwort zählen dabei nicht mit. Hält er einen Moment nicht für bildwürdig, überspringt er ihn.

Er funktioniert in Roleplay- und Game-Chats. Mit der Installation kommen außerdem Selfies und [Videonachrichten](../conversation/selfies.md#video-messages) in Conversation hinzu. Die Einrichtung in dieser Anleitung gilt für Roleplay. Game Mode nutzt einen einzigen Schalter (siehe [Game Mode](#game-mode-the-game-illustrator-toggle)).

## Bevor du loslegst

Den Prompt schreibt der Illustrator selbst, das Bild zeichnet aber ein separates Bildmodell. Du brauchst eines. Siehe [Anbieter für Bildgenerierung und Einrichtung](image-providers.md).

Ein Bildmodell gibst du ihm auf einem von zwei Wegen.

1. Leg im Panel **Connections** (Verbindungen) unter **Defaults** (Standardwerte) die Aufgabe **Images** (Bilder) fest.
2. Oder gib dem Illustrator im Fenster **Open Setup** (Einrichtung öffnen) ein eigenes Bildmodell.

Findet die App kein Bildmodell, schlägt das Bild fehl, und du wirst aufgefordert, eines auszuwählen.

## Den Illustrator aktivieren

Bevor du loslegst: Installiere **Illustrator** über **Agent Organizer** (Agentenverwaltung). Siehe [Agenten im Überblick](../agents/agents-overview.md).

1. Öffne den Roleplay-Chat, den du illustrieren möchtest.
2. Öffne die **Chat Settings** (Chat-Einstellungen) und such **Agents**.
3. Schalte **Enable Agents** (Agenten aktivieren) ein.
4. Such in der Gruppe **Misc Agents** den **Illustrator** und füge ihn über die Plus-Schaltfläche hinzu.

Eine **Illustrator**-Karte mit eigenen Optionen erscheint. Agenten verbrauchen zusätzliche Tokens und können pro Zug weitere Modellaufrufe auslösen. Die Token-Schätzungen beziehen sich nur auf die Agent-Anweisungen.

<a id="game-mode-the-game-illustrator-toggle"></a>

### Game Mode: der Schalter Game Illustrator

Im Game Mode gibt es die Optionen **Prompt Mode** und **Prompt Model** nicht. Öffne die **Chat Settings** des Spiels und schalte **Game Illustrator** ein („Auto-generate scene illustrations, NPC portraits, and location backgrounds during gameplay“).

## Einen Kunststil wählen

Die Auswahl **Prompt Mode** (auf der Karte heißt sie **Prompt**) legt den Kunststil für jeden Prompt fest, den der Illustrator schreibt. Ein neuer Illustrator startet mit **Background**.

| Stil | Was er zeichnet |
| --- | --- |
| **Illustration** | Ein einzelnes, ausgearbeitetes Szenenbild. Der Allzweck-Stil. |
| **Comic Page** | Eine Comicseite mit Bildfeldern, Sprechblasen, Textkästen und Soundeffekten. |
| **Colored Manga** | Eine kolorierte Manga-Szene mit stilisierten Sprechblasen und Soundeffekten. |
| **B&W Manga** | Eine Schwarz-Weiß-Mangaseite mit getuschten Linien und Rasterton-Schattierung. |
| **Background** | Ein Schauplatz oder eine Establishing-Aufnahme ohne Charaktere. |
| **Selfie** | Ein Selfie in der Rolle oder ein lockeres Porträt. |

Wie das fertige Bild aussieht, hängt außerdem von deinem Stilprofil ab. Siehe [Bild-Stilprofile](style-profiles.md).

## Das Prompt-Modell wählen

Das **Prompt Model** ist das Textmodell, das den Bild-Prompt schreibt. Es zeichnet nicht. Wähle es in der Liste **Prompt Model** auf der Karte. Standard ist **Main chat model**: Damit wird das Modell deines Chats mitgenutzt. Soll ein anderes Modell die Prompts schreiben, wähle ein anderes Textmodell.

Das Bild selbst zeichnet das Bildmodell, das du unter **Bevor du loslegst** festgelegt hast.

## Charaktere einheitlich halten

Zwei Einstellungen auf der Karte sorgen dafür, dass Charaktere auf allen Bildern gleich aussehen. Beide sind anfangs aus.

**Attach Card Appearance** (Aussehen der Karte anhängen) hängt den gespeicherten Aussehen-Text jedes sichtbaren Charakters an den Bild-Prompt an. In einem Roleplay-Chat ist es eine Liste mit vier Optionen.

- **Off** (aus)
- **Images only** (nur Bilder), das übliche Verhalten.
- **Videos only** (nur Videos): Ein Clip bekommt den Aussehen-Text der Charaktere, die er zeigt. Das ist vor allem bei einem **Prompt only**-Clip wichtig, der kein Bild hat.
- **Images and videos** (Bilder und Videos): beides.

Ist die Einstellung an, schickt eine Karte oder Persona mit eingeschaltetem **Image Appearance Override** (eigene Aussehensbeschreibung für Bilder) diesen Text statt ihres Texts unter **Appearance** (Aussehen). Nutze das, wenn **Appearance** für den Erzähler geschrieben ist, ein Bildmodell den Text aber schlecht umsetzt. Lass die vollständige Beschreibung in **Appearance** und schreib eine kürzere Fassung im Tag-Stil in das zusätzliche Feld. Ist der Schalter aus oder das Feld leer, verwenden Bild-Prompts **Appearance**. Der Erzähler sieht immer den vollständigen Text aus **Appearance**. Der Schalter steht unter **Appearance** im Charakter- und Persona-Editor.

**Send Avatar References** (Avatar-Referenzen senden) schickt die Avatare von Charakteren und Personas oder deren Sprites als Referenzbilder an den Bilddienst, damit das Modell ein Gesicht oder Outfit übernehmen kann. Nicht jeder Dienst akzeptiert sie. In einem Roleplay-Chat ist es eine Liste wie **Attach Card Appearance**. Sind Videos eingeschlossen, beginnt ein Clip, dessen **First frame** (Startbild) auf **Prompt only** steht, mit dem Avatar oder Sprite des Charakters, und die Option heißt dann **Prompt only (avatar from Send Avatar References)**.

## Festlegen, wie oft er zeichnet

Auf der Illustrator-Karte sitzt die Schaltfläche **Open Setup** für das vollständige Einrichtungsfenster. Dort legst du das Standard-Laufintervall fest und gibst ihm ein eigenes Bildmodell.

Jeder Roleplay-Chat hat auf der Karte in den **Chat Settings** ein eigenes **Image Run Interval** (Bild-Laufintervall). Sein Hilfetext lautet: „Messages between automatic images in this chat. 0 means only when you ask.“ Ein Chat ohne eigenen Wert nutzt den Wert aus dem Einrichtungsfenster, standardmäßig **5**. Die Karte zeigt **Using agent default** oder **Chat override**. Mit **Use agent default** (Agent-Standard verwenden) kehrst du zum Standard zurück. Fügst du den Illustrator einem Chat hinzu, zeigt das Fenster zum Hinzufügen dasselbe Feld und speichert den Wert nur für diesen Chat.

Setze **Image Run Interval** auf **0**, um nur noch manuell zu erzeugen. Das stoppt automatische Läufe einschließlich automatischer Szenenhintergründe, lässt den Agenten aber für Aktionen in der Gallery verfügbar. Mit einer positiven Zahl läuft er wieder automatisch.

Um sofort ein Bild zu erzeugen, öffne die **Chat Settings**, klapp **Gallery** auf und klick auf **Illustrate** (Illustrieren). Der Illustrator läuft sofort einmal durch, und die Schaltfläche zeigt **Generating...**.

## Clips erzeugen

In einem Roleplay-Chat gibt es unter **Chat Settings → Agents → Illustrator** die Einstellung **Illustrator makes** (was Illustrator erzeugt).

- **Pictures** (Standard): nur Bilder.
- **Pictures and clips**: Illustrator kann aus einem neuen Bild auch einen kurzen Clip machen, wenn die Bewegung den Moment ausmacht, etwa bei Action, einer Verfolgung oder etwas, das zerbricht. Das gilt auch für Bilder, die der Erzähler mit `[illustrate]` anfordert. Die Bewegung schreibt er selbst nach den **Video prompting instructions** (Anweisungen für Video-Prompts) des Videomodells. Das Bild erscheint zuerst, und der Clip kommt zur selben Nachricht hinzu, sobald er fertig ist.
- **Clips only**: Überall, wo Illustrator ein Bild zeigen würde, zeigt er einen kurzen Clip. Das Bild, das er zeichnet, wird zum Startbild des Clips und landet in der Gallery, nicht in der Antwort. Schlägt der Clip fehl, wird das Bild gezeigt.

Clips nutzen das Videomodell unter **Scene Videos** (Szenenvideos), und jeder Clip ist eine Video-Anfrage. Ohne funktionierendes Videomodell erzeugt Illustrator Bilder, auch mit **Clips only**. Eigene Agenten, die Bilder erzeugen, folgen derselben Einstellung. Siehe [Szenenvideos generieren](scene-video.md).

**Video Run Interval** (Video-Laufintervall) erscheint, sobald Illustrator Clips erzeugt. Es legt fest, wie viele Nachrichten von dir und der KI nach einem Clip bis zum nächsten vergehen müssen, und ist vom **Image Run Interval** unabhängig.

- Mit **Clips only** ist jeder Lauf ein Clip, das **Video Run Interval** bestimmt, wie oft Illustrator läuft, und das **Image Run Interval** wird ausgeblendet.
- Ein Chat ohne eigenen Wert nutzt das **Video Run Interval** aus dem Fenster **Open Setup**, sonst 5.
- **0**: keine Clips von sich aus, auch nicht für Bilder per `[illustrate]`; sie bekommen stattdessen ihr Bild.
- Eine Antwort erhält höchstens **Videos per reply** Clips. Die Einstellung steht unter **Settings → Generations → Video Generation** (Einstellungen → Generierungen → Videogenerierung).
- Du kannst weiterhin ein Bild aus der Gallery animieren. Mit **Clips only** erzeugt die Schaltfläche **Illustrate** einer Nachricht einen Clip.
- Ein Swipe einer Antwort mit Clip zählt als neue Antwort und kann einen eigenen Clip bekommen. Der frühere Swipe behält seinen Clip.

**First frame** im selben Abschnitt bestimmt, womit jeder Roleplay-Clip beginnt: Illustrators Clips, `/video` und die Schaltfläche **Video** in der Gallery. Zur Auswahl stehen ein neues Illustrator-Bild, der Avatar oder das Sprite des genannten Charakters, das Bild mit dem Avatar als Ersatz oder gar kein Bild. Videonachrichten in Conversation nutzen dieselbe Einstellung.

- **Clips only** mit Avatar oder ohne Bild: Es wird kein Bild gezeichnet. Der Clip entsteht aus Illustrators Szene und Bewegung.
- **Pictures and clips**: Das Bild wird weiterhin gezeigt; nur der Clip beginnt mit dem Avatar oder ohne Bild.
- Kein Startbild gewählt: Ein Clip lässt nie eigens ein Bild zeichnen. **Pictures and clips** animiert das Bild, das Illustrator gerade erzeugt hat. **Clips only**, `/video` und **Video** erzeugen den Clip allein aus der Szene.

Ein Clip ohne eigenes Bild beschreibt alle, die er nennt, einschließlich deiner Persona. Mit dem Avatar als Startbild beginnt er bei der zuerst genannten Person.

Auch ein erneuter Illustrator-Lauf über die Schaltfläche **Illustrate** einer Nachricht folgt **Illustrator makes** und **First frame**.

## Mehrere Charaktere mit NovelAI

Ist das Bildmodell des Illustrators NovelAI mit einem V4-, V4.5- oder V5-Modell, fügt das promptschreibende Modell für jeden sichtbaren Charakter eine Figurenbeschreibung hinzu. Jede Figurenbeschreibung enthält Aussehen, Gesichtsausdruck, Pose und ungefähre Position dieses Charakters im Bild. Marinara gleicht die Figurenbeschreibungen mit der Charakterliste der Szene ab, verwirft alle, die sich nicht zuordnen lassen, und schickt die übrigen als native Figuren-Prompts neben dem Haupt-Prompt an NovelAI. So vermischen sich Haare, Kleidung und andere Merkmale nicht zwischen den Charakteren. Bilder über **Illustrate** und über den Befehl `[illustrate]` eines Charakters bekommen dieselben Figurenbeschreibungen.

V5 akzeptiert bis zu 22 Charaktere. V4 und V4.5 akzeptieren bis zu 6. Sind mehr Charaktere sichtbar, bleiben die wichtigsten erhalten, und die übrigen werden zu namenlosem Hintergrund.

Feste Merkmale stammen aus dem Feld **Appearance**. Enthält es bereits Danbooru-Tags, werden sie unverändert kopiert. Ist es Fließtext, wandelt das promptschreibende Modell ihn in Tags um. Die Kleidung stammt aus dem aktuellen Outfit im Charakter-Tracker, sofern der Tracker läuft, und wird ebenfalls in Tags umgewandelt.

Ist **Attach Card Appearance** an, bekommt das Modell außerdem den vollständigen Appearance-Text jeder Karte und Persona im Chat, damit lange Karten und Ensemble-Karten nicht gekürzt werden. Ensemble-Karten, die mehrere Charaktere als `[NAME] tags | [NAME] tags` beschreiben, werden nach Charakteren aufgeteilt. Das Modell kopiert feste Merkmale in die passende Figurenbeschreibung, behandelt die Kleidungs-Tags der Karte als Vorgabe, die der Tracker oder die Szene überschreibt, und ignoriert Charaktere, die nicht in der Szene vorkommen. Kommen Figurenbeschreibungen zurück, fügt Marinara nichts weiter hinzu. Kommen keine zurück, wie bei einem einzelnen Charakter, wird die übliche Aussehenszeile wie bisher an den Haupt-Prompt angehängt.

Du musst nichts einstellen. Figurenbeschreibungen gibt es nur bei NovelAI auf dem eigenen Host des Anbieters; ein Proxy oder ein anderer Dienst ist nicht betroffen. Ist **Expose media prompts before sending** (Medien-Prompts vor dem Senden anzeigen) an, listet das Prüffenster die Figurenbeschreibungen schreibgeschützt unter dem Haupt-Prompt auf. Den Haupt-Prompt bearbeitest du wie gewohnt.

## Galeriespeicherung und Prompt-Ansicht

Unter **Settings → Generations → Image Generation** (Einstellungen → Generierungen → Bildgenerierung) ist **Automatically save generated images to character galleries** (Erzeugte Bilder automatisch in Charaktergalerien speichern) standardmäßig an. Schalte es aus, damit Chat-Illustrationen und Selfies nicht mehr in die Galerien der dargestellten Charaktere und Personas aufgenommen werden. Die Bilder erscheinen weiterhin im Gespräch und in der Gallery des Chats, und ausdrückliches Speichern in einer Galerie funktioniert weiterhin. Vorhandene Einträge bleiben unverändert. Galerien teilen sich die Bilddateien; die Einstellung steuert also die Zuordnung, nicht das Löschen.

Bei neuen NovelAI-Illustrationen zeigt die Bildansicht den Szenen- und Stil-Prompt und danach die positiven Figurenbeschreibungen, getrennt durch ` | `. Der gespeicherte Galerie-Prompt ist derselbe.

Um eine Illustration mit geändertem Prompt neu zu zeichnen, ohne die Antwort neu zu generieren, öffne sie und nutze **Regenerate image** (Bild neu generieren). Siehe [Ein Bild neu generieren](scene-backgrounds.md#regenerating-an-image).

Um eine frühere Roleplay-Nachricht oder einen Bereich zu illustrieren, nutze `/illustrate range=12` oder `/illustrate range=12-18`. Siehe [Slash-Befehle](../chats/slash-commands.md).

## Verwandte Anleitungen

- [Anbieter für Bildgenerierung und Einrichtung](image-providers.md)
- [Bild-Stilprofile](style-profiles.md)
- [Szenen-Hintergründe und die Gallery](scene-backgrounds.md)
- [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md)
- [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md)
