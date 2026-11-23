# Bild-Stilprofile

Ein Stilprofil ist ein wiederverwendbarer „Hausstil“, der jeden Bild-Prompt formt, bevor Marinara ihn an deinen Bilddienst schickt. Damit sehen Avatare, Porträts, Selfies, Hintergründe, Illustrationen und Sprites einheitlich aus. In dieser Anleitung erfährst du, wie du ein Stilprofil auswählst, bearbeitest und testest.

## Was ein Stilprofil ist

Jedes generierte Bild beginnt als Text-Prompt: Avatare, Porträts, Selfies in Conversation, Szenen-Hintergründe, Illustrationen und Sprites. Ein Stilprofil ist ein gespeicherter Satz Regeln, den Marinara diesem Prompt hinzufügt. Es kann positive Wörter (was du willst), negative Wörter (was du vermeiden willst) und einen bevorzugten Prompt-Stil beisteuern. Ein Profil legst du als app-weiten Standard fest. Für einen einzelnen Chat oder ein einzelnes Bildmodell kannst du es überschreiben.

Den Editor findest du unter **Settings → Generations → Image Generation** (Einstellungen → Generierungen → Bildgenerierung). Scroll dort zu **Style Profiles** (Stilprofile).

## Die mitgelieferten Profile

Marinara bringt 10 fertige Stilprofile mit. **Auto** ist der Standard. Jedes davon lässt sich bearbeiten, und ein mitgeliefertes Profil kannst du jederzeit auf seine ursprünglichen Werte zurücksetzen.

Begriffe, die unten vorkommen:

- SDXL steht für Stable Diffusion XL, ein verbreitetes offenes Bildmodell, das du auf deinem Rechner oder über einen Cloud-Dienst laufen lassen kannst.
- Ein Checkpoint ist eine einzelne trainierte Bildmodell-Datei. Illustrious, Pony und NovelAI sind Beispiele, die hier vorkommen.
- Danbooru ist eine große Anime-Bildwebsite. Ihre kurzen, kommagetrennten Tags wie „1girl, long hair, smile“ haben sich als gängige Art etabliert, Anime-Bildmodelle zu prompten.

Die mitgelieferten Profile:

- **Aus**: fügt keinen eigenen Stil hinzu und verwendet standardmäßig die Grammatik **Aus**, die den zusammengesetzten Prompt-Text ohne Bereinigung beibehält. Hast du eine gespeicherte Version dieses Profils, wähle unter **Prompt-Grammatik** die Option **Aus** oder nutze **Zurücksetzen**, um den neuen Standard zu übernehmen.
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

Das Standardprofil gilt für jedes Bild, solange kein Chat und kein Bildmodell es überschreibt.

1. Öffne **Settings → Generations → Image Generation → Style Profiles**.
2. Öffne die Liste **Default style** (Standardstil).
3. Wähl ein Profil.

Deine Auswahl wird sofort gespeichert, und neue Bilder verwenden sie.

## Ein Profil klonen und anpassen

Ein mitgeliefertes Profil kannst du direkt bearbeiten, oder du nutzt **Clone** (Klonen), um das Original zu behalten und dir ein eigenes zu bauen.

1. Öffne das Dropdown-Menü **Editing** (Bearbeiten) und wähl das Profil, das deiner Vorstellung am nächsten kommt.
2. Klick auf **Clone**. Marinara erstellt eine Kopie, wählt sie zum Bearbeiten aus und macht sie sofort zu deinem app-weiten Standardstil.
3. Ändere das Feld **Name** in etwas, das du wiedererkennst.
4. Wähl eine **Prompt grammar** (Prompt-Grammatik, siehe nächster Abschnitt).
5. Beschreibe unter **Style text** (Stiltext) den gewünschten Look in einfachen Worten. Schreibt eine KI den Bild-Prompt, wie beim Illustrator, bei Selfies und in Noodle, richtet sie sich nach deinem Stiltext, statt ihn zu kopieren. Andere Bilder, etwa Avatare, bekommen den Stiltext unter Umständen unverändert angehängt.
6. Ergänze **Positive tags** (einzuschließende Wörter) und **Negative tags** (zu vermeidende Wörter).
7. Öffne den Abschnitt **Per-image tags** (Tags pro Bildart), um für jede Bildart zusätzliche Tags zu hinterlegen (Avatar, Porträt, Selfie, Hintergrund, Illustration, Sprite).
8. Dein Klon ist seit Schritt 2 der app-weite Standard. Willst du diese Rolle wieder an ein anderes Profil abgeben, öffne **Default style** und wähl das gewünschte Profil.

Zwei Schaltflächen helfen bei der Verwaltung:

- **Reset** (Zurücksetzen) greift nur bei mitgelieferten Profilen und stellt deren ursprüngliche Werte wieder her.
- **Delete** (Löschen) greift nur bei selbst erstellten Profilen – und nur, solange mehr als ein Profil vorhanden ist.

## Die Modi der Prompt-Grammatik

**Prompt grammar** sagt Marinara, in welcher Form das Bildmodell einen Prompt am liebsten liest. Wähl den Modus, der zu deinem Modell passt.

- **Hybrid**: eine Mischung aus Sätzen und Tags. Eine sichere Allroundwahl.
- **Danbooru tags**: kurze, kommagetrennte Tags im Danbooru-Stil. Ideal für Anime-Checkpoints auf SDXL-Basis wie Illustrious, Pony und NovelAI.
- **Tags**: kurze, kommagetrennte Schlüsselwörter ohne die Danbooru-Konvention.
- **Natural language**: schlichte Sätze. Ideal für Modelle, die Fließtext lesen, etwa DALL-E und Z-Image-Turbo-Modelle.
- **Aus**: behält den zusammengesetzten Prompt-Text in seiner ursprünglichen Reihenfolge bei, auch wiederholte Tags. Wähle dies, wenn dein Bildmodell genaue Tag-Abfolgen braucht.

### Prompt-Grammatik: Aus

Wähle **Aus**, um die Grammatikverarbeitung und Prompt-Bereinigung für ein beliebiges Stilprofil abzuschalten. Marinara teilt den gelieferten Text nicht auf und schreibt ihn nicht um, entfernt keine Duplikate, gleicht keine Geschlechts-Tags ab und verschiebt Ausdrücke wie `no watermark` nicht in den negativen Prompt. Leerzeichen, Zeilenumbrüche und Satzzeichen innerhalb jeder Quelle bleiben wie angegeben.

In dieser Abfolge bleibt zum Beispiel jede Teilnehmermarkierung neben ihrer Beschreibung:

```text
2boys, 3girls, 1boy, black hair, 1boy, brown hair, 1girl, long hair, 1girl, short hair, 1girl, red hair
```

Marinara setzt eingerichtete Quellen weiterhin zusammen, etwa Verbindungspräfixe, Profil-Tags, generierten Text und deine Aussehensüberschreibungen. Zwischen den Quellen fügt es ein Komma und ein Leerzeichen ein. **Aus** verhindert außerdem, dass kopierte Stilvorgaben aus der Ausgabe der Bild-Prompt-Schreiber entfernt werden. Es bestimmt nicht, was das Modell erzeugt, das den Prompt schreibt.

Mit **Aus** behält Illustrator deine eingestellten **Illustration**-Tags bei, auch wenn seine Prompt-Vorlage Panels oder Comic-Layouts erwähnt. Auch der zusammengesetzte negative Prompt bleibt unverändert, statt wiederholte Ausschlüsse zu entfernen oder Standardverbote für Text hinzuzufügen.

Du kannst die Grammatik **Aus** auch für ein Profil wählen, das Stil-Tags hinzufügt. Das eingebaute Profil **Aus** lässt außerdem seine Stilfelder leer. Deine gespeicherten Profile behalten ihre bisherige Grammatik, bis du sie änderst.

## Die Test bench

Die **Test bench** (Testlabor) im Editor für Style Profiles zeigt dir vorab genau, was Marinara verschicken würde, ohne dass ein echtes Bild entsteht.

1. Wähl eine **Image kind** (Bildart, zum Beispiel Porträt oder Hintergrund).
2. Tipp einen groben Prompt in **Sample input** (Beispieleingabe).
3. Lies die Felder **Final positive prompt** und **Final negative prompt**.

Die Test bench zeigt außerdem einen kurzen Hinweis zur Bereinigung. Ändert sie nichts, steht dort „No cleanup needed for this sample.“ Bearbeitet sie deinen Prompt, nennt sie, wie viele doppelte oder falsch platzierte Fragmente sie bereinigt hat.

## Wie Marinara den Prompt bereinigt

Bevor eine Bildanfrage Marinara verlässt, stellt es deinen Prompt mit dem aktiven Profil zusammen. Mit der Grammatik **Aus** setzt es Quellen ohne Bereinigung zusammen. In den anderen Grammatikmodi macht der Compiler Folgendes:

- entfernt beinahe doppelte Tags, etwa ein wiederholtes Qualitäts-Tag;
- verschiebt einfache Negativ-Formulierungen wie „avoid text“ oder „no watermark“ in den negativen Prompt;
- behält bei Hintergrund-, Illustrations- und Selfie-Bildern deine eigene Formulierung bei, destilliert deine Wörter bei Porträt-, Avatar- und Sprite-Bildern aber zu kurzen visuellen Tags, die er erkennt; und
- fügt die Tags des Profils für die Bildart hinzu, die gerade entsteht.

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
- Das Profil hat seine eigenen Stil-Tags, seine Porträt-Tags pro Bildart und seine Qualitäts-Tags ergänzt. Das „masterpiece“ im Ergebnis stammt aus den Tags des Profils, nicht aus deiner Eingabe.
- Deine Wörter wurden destilliert. Bei Porträts behält der Compiler nur Fragmente, die er als eindeutige visuelle Hinweise erkennt. „red-haired knight“ gehört nicht dazu und fiel deshalb weg.

Verschwinden bei Porträt, Avatar oder Sprite die Wörter zum Motiv, probier stattdessen die Bildart **illustration**. Sie behält deine eigene Formulierung bei.

## Rangfolge der Einstellungen: Chat, Verbindung, dann global

Marinara kann das Stilprofil aus drei Quellen nehmen. Die spezifischste Wahl gewinnt.

1. Ein Profil, das für den aktuellen Chat oder das aktuelle Spiel gewählt wurde.
2. Das Stilprofil am Bildmodell, unter **Local image defaults** (lokale Bild-Standardwerte) in dessen Editor.
3. Der globale **Default style** in **Settings**.

Der Abschnitt **Local image defaults** erscheint nur bei AUTOMATIC1111 / SD Web UI, ComfyUI und NovelAI. Bei allen anderen Diensten greift direkt der globale **Default style**. Für ein Profil pro Modell öffnest du das Bildmodell, klappst **Local image defaults** auf und wählst in der Liste der Stilprofile ein Profil. Bleibt die Liste auf **Use global default** (globalen Standard verwenden), gilt weiterhin die globale Wahl. Kann Marinara aus dem Namen des Modells ein passendes Profil erraten, zeigt es eine Schaltfläche „Use ...“, die es mit einem Klick übernimmt.

## Bilder von Professor Mari

Professor Mari schreibt ihre Bild-Prompts selbst. Ihr Befehl `mari images` sendet sie genau so an dein Bildmodell, wie sie sie geschrieben hat. Dabei werden weder ein Stilprofil noch Tags pro Bildart oder ein Prompt-Präfix der Verbindung hinzugefügt. Bittest du sie, deinen Stil zu verwenden, ergänzt sie `--style`. Das wendet das oben gewählte Profil an (zuerst das eigene Profil des Bildmodells, dann den globalen **Default style**). Mit `--style <name>` wählt sie ein bestimmtes Profil. Sie kann deine Profile auflisten und ein Profil vollständig lesen, bevor sie sich entscheidet.

Für jedes Bild speichert sie ihren ursprünglichen Prompt, das verwendete Profil (falls vorhanden) und den genauen Prompt, der gesendet wurde. So kann sie dir zeigen, was ein Stil verändert hat.

Bei einem NovelAI-Modell ab V4 gibt sie jedem Charakter im Bild einen eigenen Prompt. Dabei folgt sie denselben Regeln wie der Illustrator, damit sich das Aussehen der Charaktere nicht vermischt. Die von ihr angeforderte Größe bleibt erhalten, auch wenn am Modell **Auflösung nach Anzahl der Charaktere wählen** eingeschaltet ist. Diese Einstellung bestimmt die Größe nur dann, wenn sie die Wahl dem Modell überlässt.

## Verwandte Anleitungen

- [Anbieter für Bildgenerierung und Einrichtung](image-providers.md)
- [Illustrator-Agent](illustrator-agent.md)
- [Selfies](../conversation/selfies.md)
