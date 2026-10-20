# Animierte Gesichtsausdrücke

In dieser Anleitung erfährst du, wie animierte Gesichtsausdrücke in Marinara Engine funktionieren: kurze Animationen in Endlosschleife, die als Porträt-Sprites eines Charakters dienen. Ein Sprite ist das stehende Charakterbild, das Marinara während eines Chats anzeigt. Mit animierten Gesichtsausdrücken bewegen sich diese Porträts, statt still dazustehen.

## Was animierte Gesichtsausdrücke sind

Ein normales Sprite für einen Gesichtsausdruck ist ein Standbild – etwa ein fröhliches oder ein wütendes Gesicht. Ein animierter Gesichtsausdruck ist stattdessen eine kurze Animation in Endlosschleife. Marinara speichert jede davon als GIF-Sprite. Ein GIF ist eine Bilddatei, die eine kurze Animation von allein wiederholt.

Marinara erstellt einen animierten Gesichtsausdruck in zwei Schritten. Zuerst lässt eine **Video Generation**-Verbindung (Videogenerierung) einen kurzen Videoclip des Gesichtsausdrucks erzeugen. Danach wandelt Marinara diesen Clip auf dem eigenen Rechner in ein GIF-Sprite mit Endlosschleife um.

Einmal gespeichert, verhält sich ein animierter Gesichtsausdruck wie jedes andere Sprite. Der herunterladbare Agent **Expression Engine** wählt ihn aus und zeigt ihn, sobald die Szene diese Emotion verlangt. Wie Sprites angezeigt werden, steht unter [Charakter-Sprites](../characters/sprites.md); zur Expression Engine siehe [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md).

## Bevor du loslegst

Zwei Dinge müssen eingerichtet sein, bevor sich animierte Gesichtsausdrücke generieren lassen.

1. Eine **Video Generation**-Verbindung. Das ist eine gespeicherte Verbindung zu einem Anbieter, der Videos erzeugen kann. Wie du eine anlegst, steht unter [Szenen-Videogenerierung](scene-video.md).
2. ffmpeg, installiert auf dem Rechner, auf dem Marinara läuft. ffmpeg ist ein kostenloses Medienwerkzeug und wandelt den Videoclip in ein GIF-Sprite um.

Fehlt ffmpeg, bricht die Generierung sofort mit dieser Meldung ab:

```
Animated expression GIF conversion requires ffmpeg. Install ffmpeg and make it available on PATH, or set FFMPEG_PATH.
```

Abhilfe: Installiere ffmpeg und achte darauf, dass das System es findet. Alternativ trägst du in der Umgebungsvariable `FFMPEG_PATH` den vollständigen Pfad zum ffmpeg-Programm ein. Eine Umgebungsvariable ist eine Einstellung, die du dem Server vor dem Start mitgibst.

## Animierte Porträts einschalten

Animierte Gesichtsausdrücke entstehen im selben Fenster wie die statischen Sprites.

1. Öffne den **Character Editor** (Charakter-Editor) für den Charakter oder den **Persona Editor** (Persona-Editor) für eine Persona.
2. Wechsle zum Tab **Sprites** und dort in die Kategorie **Facial Expressions** (Gesichtsausdrücke).
3. Klick auf **Generate Sprite** (Sprite generieren). Das Fenster **Generate Sprites** öffnet sich.
4. Setze das Häkchen bei **Generate animated portraits** (animierte Porträts generieren). Das Fenster schaltet in den Animationsmodus um:
   - Die Verbindungsauswahl wechselt von **Image Generation Connection** zu **Video Generation Connection**.
   - Die Raster-Einstellungen für statische Sprite-Sheets verschwinden.
   - Marinara generiert nun einen Gesichtsausdruck nach dem anderen statt ein komplettes Sheet.
5. Wähle im Dropdown-Menü die **Video Generation Connection** aus.
6. Fülle die **Appearance Description** (Aussehensbeschreibung) aus, damit der Anbieter weiß, wie der Charakter aussieht.
7. Wähle aus, welche Gesichtsausdrücke entstehen sollen.
8. Klick auf **Generate Animated Portrait** für einen einzelnen Gesichtsausdruck oder auf **Generate Animated Portraits** für mehrere.

Während des Vorgangs erscheint die Meldung "Generating animated portrait GIFs...". Aus jedem Gesichtsausdruck wird zuerst ein kurzes Video, das Marinara anschließend in ein GIF-Sprite umwandelt.

Ist die Generierung fertig, prüfe die Ergebnisse und klick auf die Speichern-Schaltfläche, um sie dem Charakter oder der Persona hinzuzufügen. Scheitert ein einzelner Gesichtsausdruck, behält Marinara die fertigen. Die gescheiterten Namen listet Marinara auf, damit du sie erneut versuchen kannst.

## Länge und Format

Jeder animierte Gesichtsausdruck ist ein hochformatiger Porträtclip. Das Seitenverhältnis liegt fest bei 9:16 (Hochformat) und lässt sich nicht ändern.

Die Laufzeit jedes Clips ist dagegen einstellbar. Öffne **Settings** (Einstellungen) und suche den Abschnitt **Video Generation**. Die Einstellung heißt **Animated expression length**. Der Standard sind 3 Sekunden, möglich sind 1 bis 8 Sekunden.

Das Endergebnis speichert Marinara als kleines GIF in Endlosschleife, 512 Pixel breit. Ein kürzerer Clip bedeutet eine kleinere Datei und eine knappere, schnellere Schleife.

## Einschränkung bei der Transparenz

Bei statischen Sprites lässt sich der Hintergrund entfernen, sodass der Charakter frei über der Szene schwebt. Bei animierten Gesichtsausdrücken ist das anders: Marinara bereinigt hier den Hintergrund nicht.

Im Animationsmodus heißt das Kontrollkästchen für den transparenten Hintergrund **Prefer clean transparent-style background**. Es fügt dem Video-Prompt lediglich einen Hinweis hinzu – der Prompt ist der Text, den Marinara an die KI schickt. Der Hilfetext sagt es deutlich: "Adds a flat transparent-friendly background instruction to the video prompt. GIF transparency is not guaranteed."

Der Prüfschritt bestätigt dasselbe mit diesem Hinweis: "Animated portrait sprites are saved as looping GIFs. Static background cleanup, sheet slicing, and frame cropping are skipped for GIF output." Ein animierter Gesichtsausdruck behält also unter Umständen einen sichtbaren Hintergrund. Wenn du es sauberer möchtest, verlange in der **Appearance Description** ausdrücklich einen schlichten Hintergrund.

## Was dich erwartet

Animierte Gesichtsausdrücke dauern länger als statische Sprites. Marinara generiert sie einzeln nacheinander, nicht als Stapel. Viele Gesichtsausdrücke auf einmal ziehen sich entsprechend, fang deshalb mit wenigen an.

Ist **Expose media prompts before sending** (Medien-Prompts vor dem Senden anzeigen) aktiviert – zu finden unter **Settings** im Abschnitt **Overall Generations** –, hält Marinara vor dem Senden bei einem Prüfschritt an. Dort kannst du jeden Prompt lesen und bearbeiten, bevor er zum Anbieter geht. Bleibt die Einstellung aus, entfällt die Prüfung.

## Fehlerbehebung

Die Generierung bricht mit einer Meldung zu ffmpeg ab. Installiere ffmpeg und achte darauf, dass der Server es findet, oder setze die Umgebungsvariable `FFMPEG_PATH`. Siehe „Bevor du loslegst“ weiter oben.

Das Dropdown-Menü meldet, dass keine Verbindungen zur Videogenerierung gefunden wurden. Lege zuerst eine **Video Generation**-Verbindung an. Siehe [Szenen-Videogenerierung](scene-video.md).

Die Schaltfläche **Generate Sprite** ist deaktiviert. Auf manchen Geräten kann Marinara seine Bildbibliothek nicht laden; dann ist die komplette Sprite-Generierung abgeschaltet, animierte Gesichtsausdrücke eingeschlossen. Betroffen sind einige Android- und Termux-Installationen.

Das gespeicherte GIF zeigt weiterhin einen Hintergrund. Das ist so gewollt: Bei animierten Gesichtsausdrücken entfällt die Hintergrundbereinigung. Siehe „Einschränkung bei der Transparenz“ weiter oben.

## Verwandte Anleitungen

- [Charakter-Sprites](../characters/sprites.md)
- [Szenen-Videogenerierung](scene-video.md)
- [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md)
