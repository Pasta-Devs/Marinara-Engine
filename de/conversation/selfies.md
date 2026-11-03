# Selfies

Ein Selfie ist ein Bild, das ein Charakter von sich selbst erzeugt und in einen Conversation-Chat sendet, wie ein Foto in einer Messenger-App. Diese Anleitung zeigt, wie du Selfies aktivierst, ihr Aussehen festlegst, von Hand eines anforderst und wie Videonachrichten funktionieren.

Selfies kommen aus dem optionalen Paket **Illustrator** und nutzen die Bildgenerierung. Jedes Selfie ist eine Bildanfrage an den Dienst, den du wählst, deshalb bleiben sie aus, bis du sie einschaltest. Sie unterscheiden sich von den Szenenbildern in Roleplay und Game Mode.

## Selfies aktivieren

Bevor du anfängst: Installiere **Illustrator** unter **Agents → Agent Organizer** und füge ein Bild-Konto hinzu, also ein Konto bei einem Dienst, der Bilder erzeugt (siehe [Anbieter für Bildgenerierung und deren Einrichtung](../media/image-providers.md)).

1. Öffne einen Conversation-Chat und dann die **Chat Settings**.
2. Suche den Bereich **Agents** und öffne **Illustrator Settings**.
3. Schalte **Generated Selfies** an. Darunter erscheinen die Selfie-Einstellungen.
4. Wähle unter **Selfie model** dein Bild-Konto.

Wenn du **Generated Selfies** einschaltest, schaltest du auch den Hauptschalter **Commands** für den Chat ein. Charaktere senden Selfies erst, wenn **Selfie model** gesetzt ist. Bis dahin zeigt der Chat „Choose a Selfie Provider to let characters generate selfie images.“

Wenn es nicht funktioniert hat: **Illustrator Settings** erscheint nur, wenn Illustrator installiert ist. Außerdem muss der Befehl **Selfies** an sein (siehe [Wählen, welche Commands ein Charakter nutzen darf](getting-started.md#choose-which-commands-a-character-can-use)).

## Selfie-Einstellungen

Alle liegen in den **Illustrator Settings** und gelten nur für den aktuellen Chat.

- **Selfie model**: das Bild-Konto, das das Bild zeichnet. Standard ist **None (selfies disabled)**.
- **Prompt Model**: das Textmodell, das die Bildbeschreibung schreibt. Standard ist **Agent default**.
- **Image Style**: ein gespeicherter Satz von Kunststil-Wörtern, etwa „anime“. Standard ist der Standardstil aus den Style Profiles unter Advanced settings. Siehe [Stilprofile für Bilder](../media/style-profiles.md).
- **Images Per Generation**: wie viele Varianten pro Illustration oder Selfie entstehen.
- **Resolution**: die Bildgröße. Sie erscheint erst, wenn du **Selfie model** gesetzt hast. Standard ist 896x1152.
- **Send Avatar References**: sendet den Avatar oder das Sprite des Charakters als Referenzbild. Standardmäßig aus. Es funktioniert nur, wenn der Bilddienst Referenzbilder akzeptiert.
- **Attach Card Appearance**: fügt dem Prompt den Text **Appearance** der Karte jedes genannten Charakters hinzu. Standardmäßig aus.

Die Optionen für **Resolution** sind 512x512, 512x768, 768x768, 768x1024, 896x1152 und 1024x1024. 896x1152 ist ein hohes Porträtformat, das zu den meisten Selfies passt.

**Send Avatar References** und **Attach Card Appearance** bieten jeweils **Off**, **Images only**, **Videos only** und **Images and videos**.

Hat die Karte oder Persona **Image Appearance Override** eingeschaltet (im Editor unter **Appearance**), sendet Marinara diesen Text statt **Appearance**. Nutze ihn, wenn **Appearance** für die Geschichte geschrieben ist, nicht für Bilder.

## Ein Selfie von Hand anfordern

1. Öffne die **Chat Settings** und klappe den Abschnitt **Gallery** auf.
2. Klicke auf **Selfie**. Sind mehrere Charaktere im Chat, wähle in der Liste neben der Schaltfläche den aus, der das Selfie machen soll.
3. Ist **Expose media prompts before sending** unter **Settings → Generations → Overall Generations** an, prüfe oder bearbeite den Prompt und klicke auf **Generate**. Beim Abbrechen wird keine Anfrage gesendet.
4. Warte, solange die Schaltfläche **Generating...** zeigt.
5. Du siehst „Selfie generated.“ und das Bild erscheint im Chat. Eine manuelle Anfrage nutzt **Selfie model** und kostet eine Bildanfrage.

## Wie Charaktere Selfies senden

Ein Charakter entscheidet selbst, wann er ein Selfie sendet. Du musst nichts tippen. Marinara erzeugt das Bild und stellt es ein, und spätere Antworten sehen eine kurze Notiz darüber, was es zeigte.

Wenn es nicht funktioniert hat: Siehst du den Text `[selfie...]` wörtlich in einer Nachricht, prüfe, ob der Chat in Conversation Mode ist, **Commands** und **Selfies** an sind, **Generated Selfies** an ist und **Selfie model** gesetzt ist. Beginnt die Generierung und schlägt dann fehl, lies die Fehlermeldung zum Bild-Konto.

## Ein Selfie erneut erstellen

1. Klicke im Chat auf ein Selfie, um es zu öffnen.
2. Klicke auf **Regenerate image** (der Kreispfeil neben der Schaltfläche zum Anheften).
3. Bearbeite die Prompts, wenn du willst, auch die **Character prompts**. Wähle ein **Image model**, oder behalte den **Chat's image provider**.
4. Klicke auf **Generate image**.

Das neue Bild ersetzt das alte in der Nachricht. Das alte bleibt in der Gallery. Jeder Versuch ist eine Bildanfrage. Bilder, die vor dieser Option entstanden, nutzten das Selfie-Konto des Chats, und ihre negativen und Charakter-Prompts wurden nicht gespeichert.

<a id="video-messages"></a>

## Videonachrichten

Ein Charakter kann einen kurzen Videoclip senden. Installiere zuerst Illustrator. Selfies können aus bleiben.

Um selbst einen anzufordern, tippe `/video` oder `/video Aster`, um einen Charakter auszuwählen. Oder klicke in der **Gallery** des Chats auf **Video**, das den dort gewählten Charakter nutzt. Der Clip kommt als neue Nachricht und läuft im Chat. Er zeigt den neuesten Moment des Gesprächs: Das Modell, das ihn schreibt, liest so viele aktuelle Nachrichten, wie Illustrator es für ein Bild tut (sein **Agent Budget**). Du kannst auch ein Bild aus der Gallery animieren. Der Clip führt dieses Bild fort und gesellt sich zur neuesten Antwort.

Lässt sich ein Clip nicht zum Chat hinzufügen, ist er trotzdem unter dem Tab **Videos** der Gallery gespeichert. Die eigene Gallery eines Charakters listet ein Video nur, wenn der Clip diesen Charakter zeigt (siehe [Galerien von Charakteren und Personas](../characters/galleries.md)).

### Video-Einstellungen

Öffne **Chat Settings → Agents → Illustrator Settings**, **Video messages**.

- **Generated Videos**: lässt Charaktere von sich aus Videonachrichten senden. In neuen Chats standardmäßig aus, weil jeder Clip eine Videoanfrage ist. Sie zeigt auch **Videos** in der Liste **Commands**.
- **Video Run Interval**: erscheint, sobald **Generated Videos** an ist. Wie viele Nachrichten zwischen Clips liegen müssen. **0** stoppt es.
- **Video model**: das Video-Konto. **Default video provider** nutzt deinen Standard.
- **First frame**: das Bild, mit dem der Clip beginnt (siehe unten).

`/video` und die Gallery-Schaltfläche **Video** funktionieren in beiden Fällen und ignorieren das Intervall. Wischst du über eine Antwort, die einen Clip gesendet hat, lässt der neue Swipe seinen eigenen Clip senden. In einem Gruppenchat kann jeder Charakter pro Antwort einen Clip senden, bis zu **Videos per reply** (standardmäßig 3) unter **Settings → Generations → Video Generation**.

Optionen für **First frame**:

- **New selfie, or the avatar if no selfie provider** (Standard): ein neues Selfie, wenn Selfies an sind und **Selfie model** gesetzt ist, sonst der Avatar.
- **New selfie, then animate it**: immer ein neues Selfie, auch in der Gallery gespeichert. Es braucht eingeschaltete Selfies und **Selfie model**.
- **Avatar or sprite**: der Avatar, oder ein Ganzkörper-Sprite, wenn es keinen Avatar gibt.
- **Prompt only (no picture)**: kein Bild. Manche ComfyUI-Workflows schlagen ohne eines fehl. Schließt **Send Avatar References** Videos ein, heißt diese Option **Prompt only (avatar from Send Avatar References)** und beginnt vom Avatar aus.

Ist **Expose media prompts before sending** an, prüfst du den Selfie-Prompt zusammen mit dem Clip-Prompt.

Bilder in anderen Formaten, etwa WebP, werden für den Videodienst umgewandelt. Eine Videonachricht ist eine Videoanfrage, plus eine Bildanfrage, wenn sie mit einem neuen Selfie beginnt. Dein **Prompt Model** schreibt den Videoprompt, und **Settings → Generations → Video Generation Prompt Overrides → Conversation Video Message** enthält seine Anweisungen.

## Referenz: das Selfie-Tag

Charaktere fordern ein Selfie mit einem Tag in ihrer Antwort an. Du tippst es nie selbst. Es sieht aus wie `[selfie]`, optional mit Kontext:

```text
[selfie: context="standing beside the river at sunset"]
```

`[selfie: "standing beside the river"]` und `[selfie: standing beside the river]` funktionieren ebenfalls, in beliebiger Groß- und Kleinschreibung. Marinara entfernt das Tag und stellt das Bild ein.

## Verwandte Anleitungen

- [Conversation Mode: Erste Schritte](getting-started.md)
- [Anbieter für Bildgenerierung und deren Einrichtung](../media/image-providers.md)
- [Stilprofile für Bilder](../media/style-profiles.md)
