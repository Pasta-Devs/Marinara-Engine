# Selfies

In dieser Anleitung erfährst du, wie Selfies im Conversation Mode funktionieren. Ein Selfie ist ein Bild, das ein Charakter von sich selbst generiert und in den Chat schickt – wie ein Foto in einem Messenger. Die Anleitung zeigt, wie du Selfies aktivierst, einrichtest und von Hand anforderst.

## Was Selfies sind

Selfies gehören zum Conversation Mode. Ein Charakter kann mitten im normalen Chat ein generiertes Bild von sich verschicken. Das ist etwas anderes als die Szenenbilder im Roleplay Mode und im Game Mode. Selfies passen zum Messenger-Gefühl des Conversation Mode.

Selfies brauchen Bildgenerierung. Jedes Selfie kostet eine Bildgenerierungs-Anfrage bei der Verbindung, die du auswählst. Deshalb sind Selfies so lange deaktiviert, bis du sie einrichtest.

Selfies kommen aus dem optionalen Paket **Illustrator**. Installiere Illustrator über **Agents → Download Agents** (Agenten herunterladen), bevor du sie einrichtest.

## Selfies aktivieren

Selfies stecken in den **Illustrator Settings** (Illustrator-Einstellungen) im Bereich **Agents** eines Conversation-Chats. **Commands** (Befehle) sind verborgene Aktionen, die ein Charakter von sich aus ausführen kann – etwa ein Selfie schicken oder ein Lied abspielen. Die Bedienelemente dafür tauchen in **Agents** auf, sobald ein Paket mit Befehlen installiert ist.

So aktivierst du Selfies:

1. Öffne einen Conversation-Chat.
2. Öffne **Chat Settings** (Chat-Einstellungen, das Schieberegler-Symbol).
3. Suche den Bereich **Agents**.
4. Aktiviere darin den übergeordneten Schalter **Commands**. Solange er aus ist, kann kein Charakter eine verborgene Aktion nutzen.
5. Suche die **Illustrator Settings**.
6. Aktiviere den Schalter **Generated Selfies** (generierte Selfies).

Sobald **Generated Selfies** an ist, erscheinen darunter die Selfie-Einstellungen. Zu sehen sind Felder für die Verbindung, das Prompt-Modell, den Stil und die Referenzen. Die Schaltflächen unter **Resolution** erscheinen erst, wenn du eine **Selfie Connection** ausgewählt hast.

## Selfie-Einstellungen

Sind Selfies aktiv, legst du fest, wie sie aussehen und welcher Dienst sie erzeugt. Alle diese Einstellungen findest du in den **Illustrator Settings** unter **Chat Settings → Agents**. Sie gelten nur für den aktuellen Chat.

### Selfie Connection

**Selfie Connection** (Selfie-Verbindung) bestimmt, welcher Bildgenerierungs-Dienst das Bild zeichnet. Der Standard ist **None (selfies disabled)** – es ist also noch kein Dienst ausgewählt. Wähle hier eine deiner eingerichteten Bild-Verbindungen.

Ohne eine **Selfie Connection** können Charaktere keine Selfies schicken. Zeigt Marinara den Hinweis "Choose a Selfie Connection to let characters generate selfie images", ist das Feld noch leer.

Wie du eine Bild-Verbindung anlegst, steht unter [Anbieter für Bildgenerierung und deren Einrichtung](../media/image-providers.md).

### Prompt Model

**Prompt Model** (Prompt-Modell) bestimmt, welches Textmodell die Beschreibung des Selfies schreibt. Die Bild-Verbindung zeichnet anschließend genau diese Beschreibung. Der Standard ist **Main chat model** und nutzt damit dasselbe Modell wie der Chat. Soll ein anderes Modell die Selfie-Beschreibung schreiben, wähle eine andere Text-Verbindung.

### Image Style

**Image Style** (Bildstil) wählt ein Style Profile für das Selfie. Ein Style Profile ist ein gespeicherter Satz an Stil-Begriffen, zum Beispiel "anime" oder "realistic photo". Der Standard ist **Use default style from Style Profiles in Advanced settings** und folgt damit deinem globalen Standardstil.

Mehr zu Stilen erfährst du unter [Style Profiles für Bilder](../media/style-profiles.md).

### Send Avatar References

**Send Avatar References** (Avatar-Referenzen senden) ist ein Schalter und standardmäßig aus. Ist er an, schickt Marinara den Avatar oder das Sprite des Charakters als Referenzbild an den Bilddienst. So ähnelt das Selfie dem Charakter deutlich stärker. Das klappt nur, wenn der Anbieter Referenzbilder unterstützt.

### Attach Card Appearance

**Attach Card Appearance** (Aussehen der Karte anhängen) ist ein Schalter und standardmäßig aus. Ist er an, ergänzt Marinara die Selfie-Beschreibung um den Aussehens-Text der Charakterkarte. Das Modell weiß dann genauer, wie der Charakter aussieht.

Ist auf der Charakterkarte oder bei der Persona auch **Image Appearance Override** (eigene Aussehensbeschreibung für Bilder) eingeschaltet und das zugehörige Feld ausgefüllt, sendet Marinara diesen Text statt **Appearance**. Du findest den Schalter unter **Appearance** im Charakter- oder Persona-Editor. Nutze ihn, wenn die ausführliche Beschreibung für den Erzähler gedacht ist und sich für ein Bildmodell weniger eignet.

### Resolution

**Resolution** (Auflösung) legt die Größe des Selfie-Bildes fest. Die Schaltflächen unter **Resolution** erscheinen erst, wenn du eine **Selfie Connection** ausgewählt hast. Wähle eine der Schnellauswahl-Schaltflächen. Standard ist **896x1152**, ein hohes Hochformat, das zu den meisten Selfies passt.

Zur Auswahl stehen:

| Auflösung | Format               |
| ---------- | ------------------ |
| 512x512    | Quadratisch             |
| 512x768    | Hochformat           |
| 768x768    | Quadratisch             |
| 768x1024   | Hochformat           |
| 896x1152   | Hochformat (Standard) |
| 1024x1024  | Quadratisch             |

## Wie ein Charakter ein Selfie verschickt

Sind Selfies eingerichtet, entscheidet der Charakter im Chat selbst, wann er eines schickt. Du tippst dafür keinen Befehl. Der Charakter wählt den Moment, Marinara generiert das Bild und stellt es in den Chat.

Die Modellantwort nutzt `[selfie]`, optional mit Kontext:

```text
Here is a picture from my walk!
[selfie: context="standing beside the river at sunset"]
```

Auch `[selfie: "standing beside the river"]` und `[selfie: standing beside the river]` funktionieren. Groß- und Kleinschreibung spielen keine Rolle; `[SELFIE:xxxxx.]` ist also gültige Syntax. Es ist ein Conversation-Befehl, kein Bildauslöser für Roleplay oder Game Mode. Bleibt der Marker wörtlich in der Nachricht stehen, läuft der Chat möglicherweise in einem anderen Modus oder **Commands** ist deaktiviert. Prüfe, ob Illustrator installiert, **Generated Selfies** aktiviert und eine **Selfie Connection** ausgewählt ist. Startet die Generierung und schlägt dann fehl, prüfe den gemeldeten Verbindungs- oder Bildanbieterfehler. Eine andere Großschreibung des Markers behebt ihn nicht.

## Ein Selfie von Hand anfordern

Alternativ forderst du ein Selfie selbst an, statt auf den Charakter zu warten.

1. Öffne **Chat Settings** und klapp den Abschnitt **Gallery** (Galerie) auf.
2. Klick auf die Schaltfläche **Selfie** (das Kamera-Symbol).
3. Sind mehrere Charaktere im Chat, wähle in der Charakterliste neben der Schaltfläche aus, wer das Selfie machen soll.
4. Ist **Expose media prompts before sending** unter **Settings**, **Generations**, **Image Generation** aktiviert, prüfe oder bearbeite den fertig zusammengesetzten Selfie-Prompt und klick auf **Generate**. Brichst du die Prüfung ab, geht keine Bild-Anfrage raus.
5. Warte, solange die Schaltfläche **Generating...** anzeigt.

Ist das Selfie fertig, erscheint die Meldung "Selfie generated." und das Bild landet im Chat. Auch diese manuelle Anfrage läuft über die gewählte **Selfie Connection** und kostet damit ebenfalls eine Bildgenerierungs-Anfrage.

<a id="video-messages"></a>

## Videonachrichten

Ein Charakter kann dir auch einen kurzen Videoclip schicken. Tipp `/video` ein, oder `/video Aster`, um einen Charakter auszuwählen, oder klick in der **Gallery** des Chats auf **Video** (das Filmsymbol); dann gilt der Charakter, der in der Galerie ausgewählt ist. **Video** funktioniert, sobald Illustrator installiert ist – auch wenn Selfies aus sind. Der Clip kommt als neue Nachricht dieses Charakters an und läuft direkt im Chat. Forderst du einen Clip auf diese Weise an, zeigt er den neuesten Moment im Chat: Die KI, die ihn beschreibt, liest so viele der letzten Nachrichten wie Illustrator für ein Bild – also die Kontextgröße aus dessen **Agent Budget** (Agent-Budget). Ein Selfie als erstes Bild beruht auf denselben Nachrichten, also setzt auch der Clip bei diesem Moment an. Spätere Antworten sehen eine kurze Notiz dazu, was der Clip zeigt. Du kannst auch ein Bild aus der Galerie animieren: Der Clip führt dieses Bild weiter, kommt von dem Charakter, der in der Galerie ausgewählt ist, und wird an die neueste Antwort angehängt. Lässt sich ein Clip nicht in den Chat einfügen, ist er trotzdem unter dem Tab **Videos** der Galerie gespeichert.

Eingerichtet wird das unter **Chat Settings**, **Agents**, **Illustrator Settings** im Abschnitt **Video messages** (Videonachrichten):

- **Video Connection** (Videoverbindung) wählt die Verbindung vom Typ Video Generation. Lass sie auf **Default video connection** (Standard-Videoverbindung), um deine Standardverbindung zu nutzen. Die **Video Prompting Instructions** (Anweisungen für Video-Prompts) einer Verbindung leiten die KI an, die den Video-Prompt schreibt.
- **First frame** (erstes Bild) wählt das Bild, mit dem der Clip beginnt:
  - **New selfie, or the avatar if no selfie connection** (neues Selfie, ohne Selfie-Verbindung der Avatar) ist der Standard. Sind Selfies an und ist eine **Selfie Connection** eingestellt, entsteht ein neues Selfie; sonst wird der Avatar verwendet.
  - **New selfie, then animate it** (neues Selfie, dann animieren) macht immer zuerst ein neues Selfie. Dafür müssen Selfies an sein und eine **Selfie Connection** eingestellt sein; das Selfie landet außerdem in der Galerie. Ist **Expose media prompts before sending** an, prüfst du den Prompt des Selfies zusammen mit dem des Clips.
  - **Avatar or sprite** (Avatar oder Sprite) beginnt mit dem Avatar des Charakters oder, wenn es keinen Avatar gibt, mit einem Ganzkörper-Sprite.
  - **Prompt only (no picture)** (nur Prompt, ohne Bild) sendet kein Bild, das Videomodell arbeitet also allein mit dem Prompt. Manche ComfyUI-Workflows brauchen ein Bild und schlagen ohne eines fehl.

Bilder in anderen Formaten, etwa WebP, werden für den Videodienst umgewandelt. Eine Videonachricht kostet eine Video-Anfrage und zusätzlich eine Bild-Anfrage, wenn sie mit einem neuen Selfie beginnt. Den Prompt schreibt dein **Prompt Model**; seine Anweisungen stehen unter **Settings**, **Generations**, **Video Generation Prompt Overrides**, **Conversation Video Message**.

## Verwandte Anleitungen

- [Conversation Mode: Erste Schritte](getting-started.md)
- [Anbieter für Bildgenerierung und deren Einrichtung](../media/image-providers.md)
- [Style Profiles für Bilder](../media/style-profiles.md)
