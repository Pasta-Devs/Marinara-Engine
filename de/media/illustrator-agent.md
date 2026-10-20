# Illustrator-Agent

In dieser Anleitung geht es um den **Illustrator** – einen eingebauten Helfer, der während des Chats Bilder zu den Szenen zeichnet. Du erfährst, was er macht, wie du ihn aktivierst, welche Kunststile er beherrscht und welche zwei Verbindungen er braucht.

## Was der Illustrator-Agent macht

Ein Agent ist ein kleiner KI-Helfer, der automatisch in einem einzelnen Chat mitläuft. Der **Illustrator** ist ein Nachbearbeitungs-Agent: Er startet, sobald die KI eine Antwort fertig geschrieben hat. Er liest die letzte Antwort und entscheidet, ob der Moment ein Bild verdient. Wenn ja, schreibt der Illustrator einen Prompt für das Bild und schickt ihn an den Bild-Anbieter. Ein Prompt ist die Textbeschreibung, die einem Bildmodell sagt, was es zeichnen soll.

Der Illustrator zeichnet nicht zu jeder Nachricht. Standardmäßig wartet er nach einem Bild 5 angenommene Nachrichten von dir und der KI ab, bevor das nächste entstehen kann. Jeder Roleplay-Chat kann diese Zahl ändern. Swipes oder neu generierte Fassungen derselben Antwort zählen dabei nicht mit. Hält er einen Moment nicht für bildwürdig, überspringt er ihn und erzeugt kein Bild. Jedes fertige Bild landet in der **Gallery** (Galerie) des Chats.

Einsetzen lässt sich der Illustrator in **Roleplay**- und **Game Mode**-Chats; installiert schaltet er außerdem die Selfies und [Videonachrichten](../conversation/selfies.md#video-messages) im Conversation Mode frei. Die Kurzbeschreibung in der App lautet: „Responsible for image and video generations.“ Die Einrichtungsschritte und Einstellungen in dieser Anleitung beziehen sich auf Roleplay-Chats. Game Mode arbeitet stattdessen mit einem einzigen Schalter – dazu weiter unten der Abschnitt zum Game Mode.

## Bevor du loslegst

Den Prompt für das Bild schreibt der Illustrator selbst, zeichnen kann er es aber nicht: Dafür braucht er eine eigene Bild-Verbindung. Eine Bild-Verbindung ist eine gespeicherte Verbindung zu einem Bild-Anbieter, etwa OpenAI oder einem lokalen Stable-Diffusion-Server.

Richte also zuerst eine Bild-Verbindung ein. Dafür gibt es zwei Wege:

1. Markiere eine Bild-Verbindung als Standard. Öffne das Panel **Connections** (Verbindungen), klapp **Defaults** auf und wähle sie unter **Images** aus.
2. Oder gib dem Illustrator im vollständigen Einrichtungsfenster eine eigene Bild-Verbindung (siehe **Open Setup** weiter unten).

Findet die App keine Bild-Verbindung, schlägt das Bild fehl und du wirst zur Auswahl aufgefordert. Wie du einen Anbieter hinzufügst, steht unter [Anbieter für Bildgenerierung und Einrichtung](image-providers.md).

## Den Illustrator aktivieren

Der Illustrator ist standardmäßig aus. In einem **Roleplay**-Chat fügst du ihn so hinzu:

1. Öffne den Chat, den du illustrieren möchtest.
2. Öffne **Chat Settings** (Chat-Einstellungen) über die Schaltfläche im Chat; anfangs liegt sie oben rechts.
3. Geh zum Abschnitt **Agents** und aktiviere **Enable Agents**.
4. Such in der Gruppe **Misc Agents** den Eintrag **Illustrator** und füge ihn über die Plus-Schaltfläche hinzu.

Jetzt erscheint eine **Illustrator**-Einstellungskarte mit eigenen Optionen. Ein zusätzlicher Agent verbraucht zusätzliche Tokens und kann pro Zug weitere KI-Aufrufe auslösen. Die Token-Schätzungen beziehen sich nur auf die Agent-Anweisungen, nicht auf die laufenden Kosten.

### Game Mode: der Schalter Game Illustrator

Im Game Mode gelten die Schritte oben nicht, und die Optionen **Prompt Mode** und **Prompt Model** erscheinen dort gar nicht. Öffne stattdessen die **Chat Settings** des Spiels und aktiviere den einzelnen Schalter **Game Illustrator**. Seine Beschreibung lautet: „Auto-generate scene illustrations, NPC portraits, and location backgrounds during gameplay.“

## Prompt-Modi

Über die Auswahl **Prompt Mode** legst du den Kunststil fest, in dem der Illustrator jeden Prompt schreibt. Auf der Agent-Karte heißt diese Auswahl **Prompt**. Darunter steht die Zeile: „Prompt mode controls how Illustrator writes image prompts for this chat.“

Zur Wahl stehen diese Stile:

- **Illustration**: ein einzelnes, ausgearbeitetes Szenenbild. Der Allzweck-Stil.
- **Comic Page**: eine Comicseite mit Bildfeldern, Sprechblasen, Textkästen und Soundeffekten.
- **Colored Manga**: eine kolorierte Manga-Szene mit stilisierten Sprechblasen und Soundeffekten.
- **B&W Manga**: eine Schwarz-Weiß-Mangaseite mit getuschten Linien und Rasterton-Schattierung.
- **Background**: ein Schauplatz oder eine Establishing-Aufnahme, in der keine Charaktere vorkommen.
- **Selfie**: ein Selfie in der Rolle oder ein lockeres Porträt.

Ein neu hinzugefügter Illustrator startet mit dem Stil **Background**. Den Stil kannst du jederzeit über die Auswahl ändern. Wie das fertige Bild insgesamt wirkt, hängt zusätzlich vom Stilprofil ab. Einstellen lässt es sich unter [Bild-Stilprofile](style-profiles.md).

## Prompt Model und die Bild-Verbindung

Der Illustrator nutzt zwei verschiedene Verbindungen – die solltest du gut auseinanderhalten.

Das **Prompt Model** ist das Textmodell, das den Prompt für das Bild schreibt. Es zeichnet das Bild nicht. Wähle es im Dropdown-Menü **Prompt Model** auf der Illustrator-Karte. Standard ist **Main chat model**: Damit läuft alles über die Verbindung, die der Chat ohnehin nutzt. Soll ein anderes Modell die Prompts schreiben, wähle eine andere Text-Verbindung.

Die Bild-Verbindung ist der Bild-Anbieter, der das fertige Bild zeichnet. Eingestellt wird sie wie unter **Bevor du loslegst** beschrieben – entweder unter **Defaults → Images** oder im eigenen Einrichtungsfenster des Agenten.

## Attach Card Appearance und Send Avatar References

Zwei Einstellungen auf der Illustrator-Karte sorgen dafür, dass Charaktere durchgängig gleich aussehen. Beide sind standardmäßig aus.

Bei Bildern hängt **Attach Card Appearance** (Aussehen der Karte anhängen) den gespeicherten Aussehen-Text jedes sichtbaren Charakters an den Prompt für das Bild an. Video-Prompts bekommen ihn nur, wenn du Videos einschließt, wie unten beschrieben. Der Hilfetext lautet: „Append matched character appearance lines to image prompts, using only visible/generated names.“ Schalte die Einstellung ein, wenn das Bild dazu passen soll, wie ein Charakter beschrieben ist.

In den **Chat Settings** eines Roleplay-Chats ist **Attach Card Appearance** ein Auswahlmenü mit vier Optionen:

- **Off** (aus)
- **Images only** (nur Bilder), das übliche Verhalten.
- **Videos only** (nur Videos). Ein Clip aus der Galerie bekommt den Aussehen-Text der Charaktere, die seine Bewegungsanweisung nennt.
- **Images and videos** (Bilder und Videos) macht beides.

Wenn **Attach Card Appearance** eingeschaltet ist, liefern Karten und Personas mit aktiviertem **Image Appearance Override** (eigene Aussehensbeschreibung für Bilder) diesen Text statt **Appearance**. Das hilft, wenn **Appearance** für den Erzähler geschrieben ist, das Bildmodell den Text aber schlecht umsetzt: Lass die ausführliche Beschreibung in **Appearance** und schreibe eine kürzere Fassung mit Tags in das zusätzliche Feld. Ist der Schalter aus oder das Feld leer, verwenden Bild-Prompts weiterhin **Appearance**. Der Erzähler bekommt in beiden Fällen den vollständigen Text aus **Appearance**. Der Schalter steht unter **Appearance** im Charakter- und Persona-Editor.

**Send Avatar References** (Avatar-Referenzen senden) schickt die Avatare von Charakteren und Personas – oder deren Sprites – als Referenzbilder an den Bild-Anbieter. Der Hilfetext lautet: „Send matching character and persona avatars or sprites as reference images when the provider supports them.“ So kann das Bildmodell ein Gesicht oder ein Outfit übernehmen. Nicht jeder Anbieter akzeptiert Referenzbilder; die Wirkung hängt also vom gewählten Anbieter ab. In Roleplay bleibt es ein Schalter und wirkt nur auf Bilder, weil ein Roleplay-Clip ohnehin mit einem Bild beginnt.

## Mehrere Figuren mit NovelAI

Nutzt die Bild-Verbindung des Illustrators NovelAI mit einem V4-, V4.5- oder V5-Modell, soll das promptschreibende Modell für jede sichtbare Figur eine zusätzliche Beschreibung erstellen. Jede Beschreibung enthält das Aussehen, den Gesichtsausdruck, die Pose und die ungefähre Position dieser Figur im Bild. Marinara gleicht die Beschreibungen mit der Figurenliste der Szene ab, verwirft nicht zuordenbare Einträge und sendet die übrigen als native Figuren-Prompts zusammen mit dem Haupt-Prompt der Szene an NovelAI. So vermischen sich Haare, Kleidung und andere Merkmale in Gruppenszenen nicht zwischen den Figuren. Bilder über die Schaltfläche **Illustrate** (Illustrieren) und über den Befehl `[illustrate]` eines Charakters bekommen dieselben Beschreibungen.

Die Zahl der Beschreibungen hängt vom Modell ab. V5 unterstützt bis zu 22 Figuren, V4 und V4.5 bis zu 6. Sind mehr Figuren sichtbar, bleiben die wichtigsten erhalten; die übrigen werden als namenloser Hintergrund behandelt.

Das promptschreibende Modell erhält auch Vorgaben dazu, woher die Details kommen. Feste Merkmale stammen aus dem Feld **Appearance** (Aussehen) der Figur oder Persona: Bereits vorhandene Danbooru-Tags werden unverändert kopiert, Fließtext wird in Tags umgewandelt. Die Kleidung stammt aus dem aktuellen Outfit im Figuren-Tracker, sofern dieser läuft, und wird ebenfalls in Tags umgewandelt.

Bei aktiviertem **Attach Card Appearance** (Aussehen aus der Karte anhängen) erhält das Modell außerdem den vollständigen Appearance-Text jeder Karte und Persona im Chat als Referenz, damit lange Karten und Karten mit mehreren Figuren nicht gekürzt werden. Karten, die mehrere Figuren in einem Appearance-Feld als `[NAME] tags | [NAME] tags` beschreiben, werden nach Figuren aufgeteilt. Das Modell entscheidet, was es verwendet: Es kopiert feste Merkmale in die passende Beschreibung, behandelt Kleidungs-Tags aus der Karte als Vorgabe, die der Tracker oder die Szene überschreiben kann, und ignoriert Figuren, die nicht in der Szene vorkommen. Liefert das Modell Figurenbeschreibungen zurück, hängt Marinara nichts mehr an den Prompt an. Liefert es keine zurück, wie bei einer einzelnen Figur, wird die übliche Aussehenszeile wie bisher an den Haupt-Prompt angehängt.

Du musst dafür nichts einstellen. Die Beschreibungen werden nur bei einer NovelAI-Verbindung zum eigenen Host des Anbieters verwendet; Proxys und andere Anbieter sind nicht betroffen. Ist **Expose media prompts before sending** (Medien-Prompts vor dem Senden anzeigen) aktiviert, zeigt der Prüfdialog die Beschreibungen unter dem Haupt-Prompt an, damit du siehst, was gesendet wird. Dort sind sie schreibgeschützt; den Haupt-Prompt kannst du wie gewohnt bearbeiten.

## Weitere Einstellungen und manueller Start

Auf der Illustrator-Karte sitzt die Schaltfläche **Open Setup** (Einrichtung öffnen). Sie öffnet das vollständige Einrichtungsfenster des Agenten. Dort legst du den Standardwert dafür fest, wie oft der Agent läuft, und gibst ihm eine eigene Bild-Verbindung.

Jeder Roleplay-Chat hat auf der Illustrator-Karte in **Chat Settings** ein eigenes **Run Interval** (Laufintervall). Sein Hilfetext lautet: „Messages between automatic images in this chat. 0 means only when you ask.“ Ein Chat ohne eigenen Wert nutzt das **Run Interval** aus dem Einrichtungsfenster; das liegt bei **5**, solange du es nicht änderst. Die Karte zeigt entweder **Using agent default** oder **Chat override**. Mit **Use agent default** (Agent-Standard verwenden) kehrst du zum Wert aus dem Einrichtungsfenster zurück. Fügst du den Illustrator einem Chat hinzu, zeigt das Fenster zum Hinzufügen dasselbe Feld und speichert deine Auswahl nur für diesen Chat.

Setze **Run Interval** auf **0**, um ausschließlich manuell zu generieren. Damit stoppst du automatische Illustrator-Läufe einschließlich automatischer Szenenhintergründe. Der Agent bleibt installiert und für Galerieaktionen verfügbar. Ein positiver Wert aktiviert automatische Läufe wieder.

Ein Bild lässt sich auch jederzeit von Hand erzeugen, statt darauf zu warten. Öffne dazu den Abschnitt **Gallery** in **Chat Settings** und klick auf die Schaltfläche **Illustrate**. Der Illustrator läuft dann sofort einmal durch, währenddessen steht auf der Schaltfläche **Generating...**. Praktisch, wenn du ein Bild vom aktuellen Moment willst und der Agent noch keines gezeichnet hat.

## Galeriespeicherung und Prompt-Ansicht

Unter **Settings → Generations → Image Generation** (Einstellungen → Generierung → Bilderzeugung) ist **Automatically save generated images to character galleries** (Erzeugte Bilder automatisch in Charaktergalerien speichern) standardmäßig aktiv. Schalte es aus, um Chat-Illustrationen und Selfies nicht mehr automatisch in die Galerien der dargestellten Charaktere und Personas aufzunehmen. Die Bilder bleiben im Gespräch und in der Chat-Galerie sichtbar; ausdrückliches Speichern in einer Galerie bleibt möglich. Vorhandene Einträge ändern sich nicht. Galerien teilen sich die Bilddateien: Die Einstellung steuert die Galeriezuordnung und löscht keine Bilddatei des Chats.

Bei neuen, von Illustrator mit NovelAI erzeugten Illustrationen zeigt die Bildansicht den Szenen- oder Stilprompt und anschließend die positiven Charakterbeschreibungen, getrennt durch ` | `. Das gilt auch für den gespeicherten Galerieprompt.

Um eine Illustration mit geändertem Prompt neu zu zeichnen, ohne die Antwort neu zu generieren, öffne sie und nutze **Regenerate image** (Bild neu generieren). Siehe [Ein Bild neu generieren](scene-backgrounds.md#regenerating-an-image).

Für eine frühere Roleplay-Nachricht oder einen Bereich nutze `/illustrate range=12` oder `/illustrate range=12-18`. Nummerierung und Grenzen stehen unter [Slash-Befehle](../chats/slash-commands.md).

## Verwandte Anleitungen

- [Anbieter für Bildgenerierung und Einrichtung](image-providers.md)
- [Bild-Stilprofile](style-profiles.md)
- [Szenenhintergründe und die Galerie](scene-backgrounds.md)
- [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md)
- [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md)
