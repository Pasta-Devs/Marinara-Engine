# Animierte Gesichtsausdrücke

Animierte Gesichtsausdrücke sind kurze Animationen in Endlosschleife, die als Porträt-Sprites eines Charakters dienen. Ein Sprite ist das stehende Charakterbild, das Marinara während eines Chats anzeigt. Ein normales Sprite für einen Gesichtsausdruck ist ein Standbild, etwa ein fröhliches Gesicht. Ein animierter Gesichtsausdruck läuft an seiner Stelle und wird als GIF gespeichert, eine Bilddatei, die eine kurze Animation von allein wiederholt.

Marinara erstellt ihn in zwei Schritten. Es bittet ein Konto für **Video Generation** (Videogenerierung) um einen kurzen Clip des Gesichtsausdrucks und wandelt den Clip dann auf deinem Computer in ein GIF in Endlosschleife um. Einmal gespeichert, verhält er sich wie jedes andere Sprite. Der herunterladbare Agent **Expression Engine** zeigt ihn, sobald die Szene diese Emotion verlangt. Siehe [Charakter-Sprites](../characters/sprites.md) und [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md).

<a id="before-you-start"></a>

## Bevor du loslegst

Du brauchst zwei Dinge.

1. Ein Videokonto. Wie du eins hinzufügst, steht unter [Szenenvideos generieren](scene-video.md).
2. ffmpeg auf dem Computer, auf dem Marinara läuft. ffmpeg ist ein kostenloses Medienwerkzeug, das den Clip in ein GIF umwandelt.

Fehlt ffmpeg, bricht die Generierung sofort mit dieser Meldung ab:

```text
Animated expression GIF conversion requires ffmpeg. Install ffmpeg and make it available on PATH, or set FFMPEG_PATH.
```

Installiere ffmpeg so, dass dein System es findet, oder setz die Umgebungsvariable `FFMPEG_PATH` auf den vollständigen Pfad zum ffmpeg-Programm. Eine Umgebungsvariable ist eine Einstellung, die du dem Server vor dem Start mitgibst.

## Animierte Gesichtsausdrücke generieren

Du nutzt dasselbe Fenster wie für statische Sprites.

1. Öffne den **Character Editor** (Charakter-Editor) für einen Charakter oder den **Persona Editor** (Persona-Editor) für eine Persona.
2. Öffne den Tab **Sprites** und dann die Kategorie **Facial Expressions** (Gesichtsausdrücke).
3. Klick auf **Generate Sprite** (Sprite generieren). Das Fenster **Generate Sprites** öffnet sich.
4. Setz das Häkchen bei **Generate animated portraits** (animierte Porträts generieren). Das Fenster schaltet in den Animationsmodus um. Die Bildauswahl wird zur Videoauswahl, die Raster-Einstellungen für Sprite-Sheets verschwinden, und Marinara erstellt einen Gesichtsausdruck nach dem anderen.
5. Wähl dein Videokonto.
6. Füll **Appearance Description** (Aussehensbeschreibung) aus, damit der Dienst weiß, wie der Charakter aussieht.
7. Wähl die Gesichtsausdrücke aus, die entstehen sollen.
8. Klick auf **Generate Animated Portrait** für einen Gesichtsausdruck oder auf **Generate Animated Portraits** für mehrere.

Während des Vorgangs siehst du „Generating animated portrait GIFs...“. Ist er fertig, prüf die Ergebnisse und klick auf die Speichern-Schaltfläche, um sie dem Charakter oder der Persona hinzuzufügen. Scheitert ein Gesichtsausdruck, behält Marinara die fertigen und listet die gescheiterten Namen auf, damit du sie erneut versuchen kannst.

Animierte Gesichtsausdrücke dauern länger als statische Sprites, weil sie einzeln nacheinander entstehen. Fang mit wenigen an.

Ist **Expose media prompts before sending** (Medien-Prompts vor dem Senden anzeigen) an – zu finden unter **Settings → Generations → Overall Generations** –, hält Marinara an, damit du jeden Prompt lesen und bearbeiten kannst, bevor er an den Dienst geht.

## Länge und Format

Jeder animierte Gesichtsausdruck ist ein hochformatiger Porträtclip im Seitenverhältnis 9:16, das sich nicht ändern lässt. Um festzulegen, wie lange jeder Clip läuft, öffne **Settings → Generations**, such **Video Generation** und stell **Animated expression length** ein. Der Standard sind 3 Sekunden, möglich sind 1 bis 8 Sekunden. Marinara speichert ein kleines GIF in Endlosschleife, 512 Pixel breit. Ein kürzerer Clip ergibt eine kleinere Datei und eine knappere Schleife.

<a id="backgrounds-are-not-removed"></a>

## Hintergründe werden nicht entfernt

Bei statischen Sprites lässt sich der Hintergrund entfernen, sodass der Charakter frei über der Szene schwebt. Bei animierten Gesichtsausdrücken entfällt diese Bereinigung. Im Animationsmodus fügt das Kontrollkästchen **Prefer clean transparent-style background** dem Video-Prompt nur einen Hinweis hinzu. Sein Hilfetext lautet „GIF transparency is not guaranteed.“ Der Prüfschritt weist darauf hin, dass Hintergrundbereinigung, das Zerschneiden von Sheets und das Zuschneiden von Frames bei GIF-Ausgaben übersprungen werden. Ein animierter Gesichtsausdruck behält unter Umständen einen sichtbaren Hintergrund. Für ein saubereres Ergebnis verlang in **Appearance Description** einen schlichten Hintergrund.

## Fehlerbehebung

- **Die Generierung bricht mit einer Meldung zu ffmpeg ab**: Installiere ffmpeg oder setz `FFMPEG_PATH`. Siehe [Bevor du loslegst](#before-you-start).
- **Die Auswahl meldet, dass keine Videokonten gefunden wurden**: Füge zuerst eins hinzu. Siehe [Szenenvideos generieren](scene-video.md).
- **Die Schaltfläche Generate Sprite ist deaktiviert**: Auf manchen Geräten, etwa bei einigen Android- und Termux-Installationen, kann Marinara seine Bildbibliothek nicht laden. Damit ist die gesamte Sprite-Generierung abgeschaltet, animierte Gesichtsausdrücke eingeschlossen.
- **Das gespeicherte GIF zeigt weiterhin einen Hintergrund**: Das ist so vorgesehen. Siehe [Hintergründe werden nicht entfernt](#backgrounds-are-not-removed).

## Verwandte Anleitungen

- [Charakter-Sprites](../characters/sprites.md)
- [Szenenvideos generieren](scene-video.md)
- [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md)
