# Charaktere anlegen und bearbeiten

In dieser Anleitung erfährst du, wie du in Marinara Engine einen Charakter anlegst. Sie zeigt außerdem, wie du im Character Editor Kartenversionen schreibst, speicherst und verwaltest. Thema sind die Tabs **Metadata**, **Card** und **Advanced**, dazu Avatare und der gespeicherte Versionsverlauf.

## Was eine Charakterkarte ist

Eine Charakterkarte ist die Datei, die einen KI-Charakter definiert. Sie hält fest, wer er ist, wie er spricht, wie er aussieht und wie ein Chat mit ihm beginnt. Geschrieben wird all das im Character Editor. Eine Karte lässt sich von Grund auf neu bauen, aus einer anderen App importieren oder zum Teilen exportieren.

Der größte Teil deiner Schreibarbeit landet in wenigen Textfeldern. Die KI liest diese Felder bei jeder Antwort mit – klare, konkrete Formulierungen ergeben also einen deutlich stimmigeren Charakter.

## Einen Charakter anlegen

1. Öffne das Panel **Characters** (Charaktere) über die Seitenleiste.
2. Klick auf **New** (Neu, das Plus-Symbol). Das Fenster **Create Character** (Charakter anlegen) öffnet sich.
3. Klick auf den runden Avatar-Kreis, um ein Bild hochzuladen. Dieser Schritt ist optional.
4. Gib im Feld **Name \*** einen Namen ein. Ein Name ist Pflicht.
5. Klick auf **Create** (Anlegen).

Die neue Karte wird mit leeren Feldern gespeichert. Danach öffnet sich der vollständige Character Editor, damit du den Rest ausfüllen kannst. Wenn du bereits eine Kartendatei hast, starte statt mit **New** einfach mit **Import** (Importieren). Siehe [Charakterkarten importieren und exportieren](import-export.md).

## Der Character Editor im Überblick

Der Character Editor ersetzt den Chatbereich durch einen seitenfüllenden Arbeitsbereich. Die Kopfzeile läuft oben durch und enthält die Elemente, die du am häufigsten brauchst.

Oben links findest du den Pfeil **Back** (Zurück), die Avatar-Kachel, ein Namensfeld sowie ein Feld für Titel oder Kommentar. Das Kommentarfeld ist für eine kurze Kennzeichnung wie `Modern AU version` gedacht. Darunter steht eine schmale Zeile mit Ersteller und Version.

Oben rechts liegen diese Schaltflächen:

- **Save** (Speichern). Diese Schaltfläche ist inaktiv, bis du etwas änderst. Die Beschriftung zeigt den aktuellen Stand: **Uploading…**, **Embedding…** oder **Saving…**.
- Der Stern **Favorite**, der die Karte als Favorit markiert.
- **Export character** (Charakter exportieren).
- **Import character as persona** (Charakter als Persona importieren) – kopiert die Karte in eine neue Persona.
- **Duplicate character** (Charakter duplizieren).
- **Delete character** (Charakter löschen).

Willst du den Editor mit ungespeicherter Arbeit verlassen, erscheint ein Hinweisbanner: `You have unsaved changes. Close without saving?` Zur Auswahl stehen **Keep editing**, **Discard & close** und **Save & close**.

Der Editor ist in Tabs unterteilt. Auf einem breiten Bildschirm laufen sie links senkrecht herunter, auf einem schmalen werden sie zu einem scrollbaren Streifen am oberen Rand. Die Reihenfolge lautet **Metadata**, **Card**, **Convo**, **Lorebook**, **Sprites**, **Gallery**, **Colors**, **Stats** und **Advanced**.

Diese Anleitung behandelt **Metadata**, **Card** und **Advanced** sowie Avatare und den Versionsverlauf. Für die übrigen Tabs gibt es eigene Anleitungen:

- **Convo**: [Profile für den Conversation Mode](../conversation/profiles.md).
- **Lorebook**: [Lorebooks mit Charakteren verknüpfen](../lorebooks/linking-to-characters.md).
- **Sprites**: [Charakter-Sprites](sprites.md).
- **Gallery**: [Charakter- und Persona-Galerien](galleries.md).
- **Colors** und **Stats**: [Charakterfarben und RPG-Werte](colors-and-stats.md).

## Tab „Metadata“

Der Tab **Metadata** enthält Angaben zu Identität und Organisation. Sie helfen beim Sortieren, Teilen und Nachverfolgen einer Karte, gehen aber größtenteils nicht an die KI.

- **Character ID**. Ein schreibgeschützter Wert, der erst nach dem Speichern erscheint. Mit **Copy** kopierst du ihn.
- **Name**. Der angezeigte Name. In Prompts – also im Text, den Marinara an die KI schickt – steht er als `{{char}}`.
- **Phonetic name**. Eine optionale Schreibweise, die ausschließlich die Aussprache für die Sprachausgabe (Text to Speech) korrigiert. Lass das Feld leer, um den normalen Namen zu verwenden.
- **Creator**. Die Person, die die Karte erstellt hat – für die Namensnennung beim Teilen.
- **Version**. Eine Versionsnummer deiner Wahl, etwa `1.0`.
- **Talkativeness**. Ein Schieberegler von 0 bis 100 Prozent. Er legt fest, wie oft dieser Charakter in Gruppenchats zu Wort kommt. Der Standard sind 50 Prozent.
- **Tags**. Gib ein oder mehrere Tags (Schlagwörter) in das Feld ein und drück Enter oder klick auf **Add**. Mehrere Tags auf einmal trennst du mit Kommas. Ein einzelnes Tag entfernst du über sein X, alle zusammen über **Remove All**.
- **Creator Notes**. Private Notizen, die nie an die KI gehen. In der Bibliothek erscheinen sie trotzdem als Kurzbeschreibung.

Auf diesem Tab liegt auch das Panel **Version history** (Versionsverlauf). Es ist weiter unten im Abschnitt zum Speichern und Versionsverlauf beschrieben.

## Tab „Card“

Der Tab **Card** ist der eigentliche Schreibarbeitsbereich. Hier stehen die Felder, die die KI liest, um den Charakter zu spielen. Über die Sprunglinks oben gelangst du direkt zu jedem Abschnitt. Jedes Feld hat einen mitlaufenden Zeichenzähler.

- **Description**. Identität und Rolle des Charakters im Allgemeinen. Dieser Text geht in jeden Prompt ein.
- **Personality**. Eine kurze Zusammenfassung von Temperament, Sprechgewohnheiten und Verhaltensmustern.
- **Backstory**. Vorgeschichte, Herkunft und wichtige Beziehungen.
- **Appearance**. Körperliche Beschreibung, Kleidung und optische Details. Marinara nutzt diesen Text außerdem als Grundlage für einen KI-Avatar-Prompt.
- **Scenario**. Der Standardrahmen für neue Chats mit diesem Charakter.

Der Abschnitt **Dialogue & Greetings** legt fest, wie ein Chat beginnt und wie der Charakter klingt:

- **First Message**. Die Eröffnungsnachricht, die zum Start eines neuen Chats erscheint.
- **Alternate Greetings**. Zusätzliche Eröffnungsnachrichten. Beim Start eines Chats wählst du aus, welche Begrüßung zum Einsatz kommt. Mit den Pfeilen nach oben und unten sortierst du sie um, mit dem X entfernst du eine.
- **Example Dialogue**. Beispielwechsel, die die Stimme des Charakters vermitteln. Trenn die einzelnen Wechsel mit `<START>`. Als Platzhalter dienen `{{user}}` und `{{char}}`.

Begrüßungen und Beispielnachrichten können auch Bilder aus der Galerie des Charakters anzeigen; siehe [Charaktergalerien → Ein Galeriebild in Nachrichten und Begrüßungen wiederverwenden](galleries.md#reuse-a-gallery-image-in-messages-and-greetings).

Ein kurzer Eintrag unter Example Dialogue sieht so aus:

```
<START>
{{user}}: Hello!
{{char}}: *waves excitedly* Hey there!
```

## Einen Avatar hinzufügen

Der Avatar ist das Bild, das im Chat und in der Bibliothek für den Charakter erscheint. Du kannst eines hochladen, seinen Bildausschnitt anpassen oder eines per KI generieren.

### Ein Bild hochladen

1. Klick auf die Avatar-Kachel in der Kopfzeile des Editors.
2. Wähl eine Bilddatei aus. Das neue Bild erscheint sofort.

Sobald ein Charakter einen Avatar hat, erscheint auf dem Tab **Metadata** ein Zuschneidewerkzeug. Damit verschiebst oder zoomst du das Bild innerhalb seines Kreises, ohne die Datei erneut hochzuladen. Über dasselbe Werkzeug lässt sich der Avatar auch entfernen.

### Einen Avatar per KI generieren

Die KI-Avatar-Option erscheint nur, wenn mindestens eine Verbindung zur Bildgenerierung eingerichtet ist. Siehe [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md).

1. Zeig mit der Maus auf die Avatar-Kachel und klick auf die kleine Zauberstab-Schaltfläche **Generate avatar** (Avatar generieren).
2. Das Fenster **Generate Character Avatar** öffnet sich.
3. Wähl eine **Image Generation Connection** (Verbindung zur Bildgenerierung).
4. Prüf den **Avatar Prompt** und passe ihn bei Bedarf an. Er ist mit dem Text aus Appearance vorbelegt. Ist Appearance leer, greift Marinara auf Description und danach auf Personality zurück.
5. Hat die Karte bereits einen Avatar, kannst du **Use current avatar as a reference** ankreuzen.
6. Klick auf **Generate**. Für einen weiteren Versuch klick auf **Regenerate**.
7. Gefällt dir das Ergebnis, klick auf **Use Avatar**.

Die Bildgröße stammt aus der Einstellung **Portraits** in den Einstellungen zur Bildgenerierung; standardmäßig sind das 1024 mal 1024. Ist **Expose media prompts before sending** aktiviert, kommt vor jeder Anfrage noch ein Prüfschritt für den Prompt dazu.

## Tab „Advanced“

Der Tab **Advanced** enthält Prompt-Steuerungen für fortgeschrittene Nutzende. Für einen normalen Charakter dürfen alle Felder leer bleiben.

Diese vom Charakter mitgebrachten Prompt-Steuerungen greifen in den Modi Conversation, Roleplay und Game. Ein gewähltes Conversation- oder Game-Preset ändert zwar den umgebenden Prompt, schaltet die Post-History Instructions oder den Depth Prompt des Charakters aber nicht ab.

- **System Prompt**. Charakterspezifische Anweisungen, die je nach Situation über den Charakterblock des aktiven Presets, den Conversation-Charakterkontext oder die Game-Charakter- bzw. GM-Karte hinzukommen. Der Haupt-System-Prompt des Chats wird dadurch nicht ersetzt.
- **Post-History Instructions**. Text, der nahe am Ende des Prompts steht, also kurz vor der Generierung. Üblich ist eine kurze Erinnerung wie „Stay in character“.
- **Depth Prompt**. Text, der an einer gewählten Stelle im Chatverlauf eingefügt wird. **Depth** bestimmt, wie viele Nachrichten weit zurück das geschieht. Tiefe 0 liegt direkt hinter der neuesten Nachricht, Tiefe 4 vier Nachrichten davor. Der Standard ist Tiefe 4. **Role** legt fest, ob der Text als **System**, **User** oder **Assistant** eingefügt wird. Der Standard ist System.

Der Abschnitt **Regex Scripts** auf diesem Tab enthält Suchen-und-Ersetzen-Skripte, die nur für diesen einen Charakter gelten. Sie nutzen die gemeinsame Regex-Engine. Wie das funktioniert, steht unter [Regex-Skripte](../extending/regex-scripts.md).

## Speichern und Versionsverlauf

Klick in der Kopfzeile auf **Save**, um deine Änderungen zu sichern. Die Schaltfläche bleibt inaktiv, bis du etwas bearbeitest, und wird dann aktiv.

Jedes Speichern kann eine Momentaufnahme zu **Version history** auf dem Tab **Metadata** hinzufügen. Vor deiner ersten weiteren Bearbeitung steht im Panel `Previous card states will appear here after the next edit.` Ein Zähler zeigt, wie viele Momentaufnahmen gespeichert sind.

So vergleichst du eine gespeicherte Version mit der aktuellen Karte:

1. Öffne den Tab **Metadata**.
2. Klick unter **Version history** auf eine gespeicherte Version.
3. Das Fenster **Compare** (Vergleichen) öffnet sich. Es stellt Felder wie Name, Description, Personality, Scenario, First Message und Example Dialogue nebeneinander und markiert jedes geänderte Feld.

So kehrst du zu einer älteren Version zurück:

1. Öffne das Fenster **Compare** für die gewünschte Version oder klick in der Liste auf ihr Wiederherstellen-Symbol.
2. Klick auf **Restore this version** und bestätige.

Beim Wiederherstellen ersetzt die Momentaufnahme die aktuelle Karte. Ein neuer Eintrag im Verlauf entsteht dabei nicht. Mit dem Stift-Symbol korrigierst du die Versionsbezeichnung einer gespeicherten Momentaufnahme, ohne sie wiederherzustellen. Momentaufnahmen lassen sich außerdem aus der Liste löschen; an der aktuellen Karte ändert das nichts.

Über **Reset** in der Kopfzeile von **Version history** startest du die Versionierung der Karte neu. Nach der Bestätigung löscht Marinara sämtliche gespeicherten Momentaufnahmen und setzt die aktuelle Kartenversion auf `0.0`. Das lässt sich nicht rückgängig machen.

## Von Agenten vorgeschlagene Kartenänderungen prüfen

In einem Roleplay-Chat kann ein optionaler Agent kleine Änderungen an Kartenfeldern vorschlagen – abgeleitet aus dem, was in der Szene passiert ist. Dann erscheint das Fenster **Review Character Card Updates** (Kartenänderungen prüfen), damit die Kontrolle bei dir bleibt. Du entscheidest, was übernommen wird.

Zu jedem Vorschlag hast du diese Möglichkeiten:

- **Approve**. Übernimmt die Änderung. Dabei steigt auch die Versionsnummer, und im Versionsverlauf entsteht ein Eintrag.
- **Regenerate**. Lässt den Agenten einen neuen Versuch unternehmen.
- **Reject**. Verwirft den Vorschlag.

Hat sich der zugrunde liegende Text seit dem Vorschlag geändert, warnt dich die App, bevor du die Änderung erzwingen kannst. Wie du solche Agenten ein- und ausschaltest, steht unter [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md).

## Ein Hinweis zu Professor Mari

**Professor Mari** ist ein eingebauter Assistenz-Charakter, der mit Marinara ausgeliefert wird. Löschen lässt sie sich nicht. Bei einem Versuch blockiert die App und weist darauf hin, dass es sich um einen eingebauten Charakter handelt. Was sie alles kann, steht unter [Professor Mari, deine Assistentin in der App](../home/professor-mari.md).

## Verwandte Anleitungen

- [Personas anlegen und bearbeiten](personas.md)
- [Charakter-Sprites](sprites.md)
- [Charakter- und Persona-Galerien](galleries.md)
- [Charakterkarten importieren und exportieren](import-export.md)
- [Charakterfarben und RPG-Werte](colors-and-stats.md)
- [Profile für den Conversation Mode](../conversation/profiles.md)
- [Lorebooks mit Charakteren verknüpfen](../lorebooks/linking-to-characters.md)
