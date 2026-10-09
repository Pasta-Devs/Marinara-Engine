# Bild-Stilprofile

In dieser Anleitung erfährst du, wie Bild-Stilprofile in Marinara Engine funktionieren. Ein Stilprofil ist ein wiederverwendbarer „Hausstil“, der jeden Bild-Prompt (der Text, den Marinara an die KI schickt) formt, bevor er beim Bild-Anbieter landet. So sehen Avatare, Porträts, Selfies, Hintergründe, Illustrationen und Sprites (Charakterbilder auf der Bühne) einheitlich aus.

## Was ein Stilprofil ist

Marinara Engine generiert Bilder in vielen Varianten: Avatare für Charaktere und Personas, Porträts, Selfies im Conversation Mode, Szenen-Hintergründe, Illustrationen innerhalb einer Szene und Charakter-Sprites. Jedes dieser Bilder beginnt als Text-Prompt.

Ein Stilprofil ist ein gespeicherter Satz Regeln, den Marinara diesem Text-Prompt hinzufügt. Es kann positive Wörter (was du willst), negative Wörter (was du vermeiden willst) und einen bevorzugten Prompt-Stil beisteuern. Dadurch bleibt der Look über alle Bilder hinweg gleich – dieselben Stilwörter jedes Mal neu einzutippen, entfällt.

Ein Profil legst du app-weit als Standard fest. Für einen einzelnen Chat oder eine einzelne Bild-Verbindung lässt es sich überschreiben. Wie das geht, steht weiter unten.

So findest du den Editor:

1. Öffne **Settings** (Einstellungen).
2. Öffne den Tab **Generations** (Generierungen).
3. Suche den Abschnitt **Image Generation** (Bildgenerierung).
4. Scroll zu **Style Profiles** (Stilprofile).

## Die mitgelieferten Profile

Marinara bringt 10 fertige Stilprofile mit. **Auto** ist der Standard. Jedes davon lässt sich bearbeiten, und ein mitgeliefertes Profil kannst du jederzeit auf seine ursprünglichen Werte zurücksetzen.

Ein paar Begriffe dazu:

- SDXL steht für Stable Diffusion XL. Das ist ein verbreitetes offenes Bildmodell, das du auf dem eigenen Rechner oder über einen Cloud-Dienst laufen lassen kannst.
- Ein Checkpoint ist eine einzelne trainierte Bildmodell-Datei. Für unterschiedliche Bildstile lädt man unterschiedliche Checkpoints herunter. In diesen Profilen tauchen Illustrious, Pony und NovelAI namentlich auf.
- Danbooru ist eine große Anime-Bildwebsite. Ihre kurzen, kommagetrennten Tags (etwa „1girl, long hair, smile“) haben sich als gängige Art etabliert, Anime-Bildmodelle zu prompten.

Die mitgelieferten Profile:

- **Off**: fügt keinen Hausstil hinzu. Der Prompt geht fast genau so raus, wie du ihn geschrieben hast.
- **Auto**: leitet einen stimmigen Look aus Charakter, Spiel, Szene und gewähltem Bildmodell ab. Das ist das Standardprofil.
- **Anime**: allgemeine Anime-Tags für saubere Charakter-Artworks.
- **Danbooru / Illustrious**: Tags im Danbooru-Stil, zugeschnitten auf Anime-Checkpoints für SDXL wie Illustrious, Pony und NovelAI.
- **Realistic SDXL**: Realismus in natürlicher Sprache für SDXL-Modelle.
- **Photorealistic**: Prompts im Fotostil mit glaubwürdiger Haut, Beleuchtung und Materialwirkung.
- **Cinematic**: dramatisches Licht und kräftige Bildkomposition für Key-Art.
- **Digital Painting**: Pinselduktus wie in Concept-Art, mit bewusst gesetztem Licht.
- **Painterly Fantasy**: weiche, malerische Fantasy-Illustration.
- **Z-Image Turbo Narrative**: knapper Fließtext für Z-Image-Turbo-Modelle, die schlichte Sätze gut verstehen.

## Den globalen Stil ändern

Das globale Standardprofil gilt für jedes generierte Bild, solange kein Chat und keine Verbindung es überschreibt. So änderst du es:

1. Öffne **Settings**, dann den Tab **Generations**, dann **Image Generation**, dann **Style Profiles**.
2. Öffne das Dropdown-Menü **Default style** (Standardstil).
3. Wähle das Profil, das app-weit gelten soll.

Die Auswahl speichert Marinara sofort. Neue Bilder verwenden das gewählte Profil.

## Ein Profil klonen und anpassen

Ein mitgeliefertes Profil lässt sich direkt bearbeiten. Mit der Schaltfläche **Clone** (Klonen) bleibt das Original dagegen erhalten, und du baust dir eine eigene Version. So legst du ein Profil an und passt es an:

1. Öffne das Dropdown-Menü **Editing** (Bearbeiten) und wähle das Profil, das deiner Vorstellung am nächsten kommt.
2. Klick auf **Clone**. Marinara erstellt eine Kopie, öffnet sie zur Bearbeitung und macht sie sofort zum app-weiten Standardstil.
3. Ändere das Feld **Name** in etwas, das du wiedererkennst.
4. Wähle eine **Prompt grammar** (Prompt-Grammatik, siehe nächster Abschnitt).
5. Beschreibe unter **Style text** (Stiltext) den gewünschten Look in einfachen Worten. Schreibt eine KI den Bild-Prompt, wie beim Illustrator, bei Selfies und in Noodle, richtet sie sich nach deinem Stiltext, statt ihn zu kopieren. Andere Bilder, etwa Avatare, bekommen den Stiltext unter Umständen unverändert angehängt.
6. Ergänze **Positive tags** (einzuschließende Wörter) und **Negative tags** (zu vermeidende Wörter).
7. Öffne den Abschnitt **Per-image tags** (Tags pro Bildart), um für jede Bildart zusätzliche Tags zu hinterlegen (Avatar, Porträt, Selfie, Hintergrund, Illustration, Sprite).
8. Dein Klon ist seit Schritt 2 der app-weite Standard. Willst du diese Rolle wieder an ein anderes Profil abgeben, öffne **Default style** und wähle das gewünschte Profil.

Zwei Schaltflächen helfen bei der Verwaltung:

- **Reset** (Zurücksetzen) greift nur bei mitgelieferten Profilen und stellt deren ursprüngliche Werte wieder her.
- **Delete** (Löschen) greift nur bei selbst erstellten Profilen – und nur, solange mehr als ein Profil vorhanden ist.

## Die Modi der Prompt-Grammatik

Das Dropdown-Menü **Prompt grammar** sagt Marinara, in welcher Form das Bildmodell einen Prompt am liebsten liest. Wähle den Modus, der zum Bildmodell passt. Es gibt vier Modi.

- **Hybrid**: eine Mischung aus Sätzen und Tags. Eine sichere Allroundwahl.
- **Danbooru tags**: kurze, kommagetrennte Tags im Danbooru-Stil. Ideal für Anime-Checkpoints auf SDXL-Basis wie Illustrious, Pony und NovelAI.
- **Tags**: kurze, kommagetrennte Schlüsselwörter ohne die Danbooru-Konvention.
- **Natural language**: schlichte Sätze. Ideal für Modelle, die Fließtext lesen, etwa DALL-E und Z-Image-Turbo-Modelle.

## Die Test bench

Im Abschnitt **Test bench** (Testlabor) siehst du genau, was Marinara verschicken würde – ganz ohne ein echtes Bild zu generieren. Du findest ihn im Editor unter Style Profiles. So nutzt du ihn:

1. Wähle eine **Image kind** (Bildart, zum Beispiel Porträt oder Hintergrund).
2. Tipp einen groben Prompt in **Sample input** (Beispieleingabe).
3. Lies die Felder **Final positive prompt** und **Final negative prompt**.

Die Test bench zeigt außerdem einen kurzen Hinweis zur Bereinigung. Ändert sie nichts, steht dort **No cleanup needed for this sample**. Bearbeitet sie den Prompt, nennt sie die Anzahl der doppelten oder falsch platzierten Fragmente, die sie bereinigt hat.

## Wie Marinara den Prompt bereinigt

Bevor eine Bildanfrage Marinara verlässt, setzt die App den Prompt mit dem aktiven Profil zusammen. Dabei passiert Folgendes:

- Beinahe identische Tags fliegen raus, etwa ein doppelt vorhandenes Qualitäts-Tag.
- Einfache Negativ-Formulierungen (wie „avoid text“ oder „no watermark“) wandern in den negativen Prompt.
- Bei Hintergrund-, Illustrations- und Selfie-Bildern bleibt deine eigene Formulierung erhalten. Bei Porträt-, Avatar- und Sprite-Bildern destilliert Marinara deine Wörter zu kurzen, bekannten visuellen Tags.
- Die Tags des Profils für die jeweilige Bildart kommen hinzu.

## Beispiel: vorher und nachher

Angenommen, du wählst das Profil **Danbooru / Illustrious**, setzt **Image kind** auf Porträt und tippst das hier in **Sample input**:

```
masterpiece, masterpiece, red-haired knight, no watermark
```

Die Test bench zeigt daraufhin diesen **Final positive prompt**:

```
detailed eyes, solo, upper body, portrait, looking at viewer, anime screencap, masterpiece, best quality, absurdres
```

Drei Dinge sind passiert:

- „no watermark“ ist aus dem positiven Prompt in den **Final negative prompt** gewandert. Der Bereinigungshinweis zählt diese Änderung mit.
- Das Profil hat seine eigenen Stil-Tags, seine Porträt-Tags und seine Qualitäts-Tags ergänzt. Das „masterpiece“ im Ergebnis stammt aus den Tags des Profils, nicht aus deiner Eingabe.
- Deine Wörter wurden destilliert. Bei Porträts behält Marinara nur Fragmente, die es als eindeutige visuelle Hinweise erkennt. „red-haired knight“ gehört nicht dazu und fiel deshalb weg.

Verschwinden bei Porträt, Avatar oder Sprite die Wörter zum Motiv, probier stattdessen die Bildart **illustration**. Sie behält deine eigene Formulierung bei.

## Rangfolge der Einstellungen: Chat, Verbindung, dann global

Marinara zieht das Stilprofil aus drei Quellen. Die spezifischste Wahl gewinnt. Die Reihenfolge lautet:

1. Ein Profil, das ausdrücklich für den aktuellen Chat oder das aktuelle Spiel gewählt wurde.
2. Das **Style Profile** (Stilprofil) an der Bild-Verbindung (unter **Local Image Defaults** im Verbindungs-Editor).
3. Der globale **Default style** aus den **Settings**.

Der Abschnitt **Local Image Defaults** (lokale Bild-Standardwerte) erscheint nur bei lokalen Stable-Diffusion-Verbindungen (AUTOMATIC1111 / SD Web UI, ComfyUI und NovelAI). Bei allen anderen Anbietern greift direkt der globale **Default style**. Für ein Profil pro Verbindung öffnest du die Verbindung, klappst **Local Image Defaults** auf und wählst im Dropdown-Menü **Style Profile** ein Profil. Steht dort **Use global default**, gilt weiterhin die globale Wahl. Kann Marinara aus dem Modellnamen der Verbindung ein passendes Profil erraten, erscheint eine Schaltfläche "Use ...", die es mit einem Klick übernimmt.

## Verwandte Anleitungen

- [Anbieter und Einrichtung für die Bildgenerierung](image-providers.md)
- [Illustrator-Agent](illustrator-agent.md)
- [Selfies](../conversation/selfies.md)
