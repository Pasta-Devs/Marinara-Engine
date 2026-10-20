# Prompt Overrides für Bild und Video

In dieser Anleitung erfährst du, wie **Prompt Overrides** (Prompt-Überschreibungen) funktionieren: die Editoren für die Vorlagen, aus denen Marinara Engine die Prompts für die Bild- und Videogenerierung baut. Du erfährst, wo die Editoren liegen, was sich darin bearbeiten lässt und wie du eine eigene Vorlage gefahrlos speicherst.

## Was Prompt Overrides sind

Ein **Prompt Override** ist eine wiederverwendbare Vorlage für einen Medien-Prompt. Bevor Marinara ein Bild oder ein Video generiert, baut die App zuerst einen Text-Prompt für das Bild- oder Videomodell. Genau diese Vorlagen lassen sich über Prompt Overrides bearbeiten.

Die Funktion betrifft ausschließlich Bild- und Video-Prompts. Der Text-Prompt, der im Chat an das Chat-Modell geht, bleibt in Conversation und Roleplay unverändert. Diese Verwechslung passiert häufig. Für den Prompt an ein Chat-Modell nimmst du stattdessen ein Prompt-Preset und die Generierungsparameter. Siehe [Preset-Editor und Prompt Manager](presets.md) und [Generierungsparameter](generation-parameters.md).

Ein paar Begriffe, die unten vorkommen:

- Ein **Sprite** ist ein Stück Charakterkunst, etwa ein Gesichtsausdruck oder eine Ganzkörperpose.
- Ein **Storyboard** ist eine Folge illustrierter Einzelbilder, die aus einem Zug im Game Mode oder aus einer abgeschlossenen Roleplay-Episode entstehen.

## Wo du sie findest

Die Editoren stecken in den App-Einstellungen.

1. Öffne **Settings** (Einstellungen).
2. Klick auf den Tab **Generations**.
3. Scroll zum Bereich **Prompt Overrides**, der als "Reusable image and video prompt templates" beschrieben ist.

Dort warten zwei aufklappbare Editoren.

## Die beiden Editoren

Ein Klick auf den Titel eines Editors klappt ihn auf.

**Video Generation Prompt Overrides** enthält die wiederverwendbaren Vorlagen für Szenenvideos in Game und Galerie, für Videonachrichten in Conversation, für Charakter-Clips in Conversation-Anrufen und für animierte Ausdrucksporträts. Jede Video-Prompt-Vorlage bestimmt, wie eine Art von Clip dem Videomodell beschrieben wird.

**Image Generation Prompt Overrides** enthält die Vorlagen für Bild-, Sprite-, Game- und Prompt-Builder-Systeme. Dazu zählen Selfies in Conversation, NPC-Porträts im Game Mode, Szenenkunst, Storyboard-Prompts, die Vorlage **Noodle Post Image** für Noodle-Beiträge und weitere registrierte Bild-Builder. Jede Bild-Prompt-Vorlage bestimmt, wie eine Art von Bild dem Bildmodell beschrieben wird.

Zusammen decken die beiden Editoren also die Prompts für Porträts, Selfies, Sprites, Szenenkunst, Storyboards und Videoclips ab.

## Eine Vorlage bearbeiten

Beide Editoren funktionieren gleich. So geht's:

1. Öffne den gewünschten Editor.
2. Wähle im Dropdown-Menü **Registered prompt** (registrierter Prompt) eine Vorlage aus. Welche Vorlagen zur Auswahl stehen, hängt vom geöffneten Editor ab.
3. Sieh dir die Status-Plakette neben dem Dropdown-Menü an. **Default** heißt: Es ist keine eigene Vorlage gespeichert. **Custom active** heißt: Deine gespeicherte Vorlage ist im Einsatz. **Custom paused** heißt: Deine Vorlage ist gespeichert, aber abgeschaltet.
4. Lies die kurze Beschreibung unter dem Dropdown-Menü, damit klar ist, wofür diese Vorlage zuständig ist.
5. Unter **Available variables** (verfügbare Variablen) fügst du per Klick auf eine Variablen-Plakette die Variable in die Vorlage ein. Variablen haben die Form `${name}`, zum Beispiel `${charName}`.
6. Bearbeite den Text im Feld **Template** (Vorlage).
7. Wirf einen Blick auf das Feld **Rendered preview** (gerenderte Vorschau) darunter. Die Vorschau füllt die Vorlage mit Beispielwerten, sodass du das Ergebnis siehst.
8. Zeigt die Vorschau die Warnung **Unknown variables** (unbekannte Variablen), korrigiere den Tippfehler im Variablennamen. Ein Name, der nicht in der Liste **Available variables** steht, wird nicht gefüllt.
9. Klick auf **Save** (speichern).

Es erscheint die Meldung "Prompt override saved", und die Status-Plakette wechselt zu **Custom active**.

## Eine Vorlage aufheben, ohne sie zu nutzen

Unter der Vorschau sitzt der Schalter **Apply this override** (diese Überschreibung anwenden). Sein Hilfetext lautet "Turn this off to keep the template saved without using it." Schalte ihn aus, und dein Entwurf bleibt gespeichert, während die Funktion weiterhin den eingebauten Standard verwendet. Die Status-Plakette zeigt dann **Custom paused**.

## Zurück zur eingebauten Vorlage

Mit **Reset to Default** (auf Standard zurücksetzen) verwirfst du deine eigene Vorlage und nutzt wieder die eingebaute. Existiert eine gespeicherte Überschreibung, fragt die App vorher nach. Die Status-Plakette steht danach wieder auf **Default**.

## Wann Overrides greifen

Ein Prompt Override spielt nur für Funktionen eine Rolle, die tatsächlich Bilder oder Videos generieren: Game-Assets, Selfies und Anrufe in Conversation, Sprites und Noodle-Beitragsbilder. Diese Funktionen brauchen außerdem eine eingerichtete Verbindung für die Bild- oder Videogenerierung. Ohne funktionierende Verbindung läuft nichts, und die Vorlage kommt nie zum Einsatz. Siehe [Anbieter und Einrichtung der Bildgenerierung](../media/image-providers.md) und [Szenen-Videogenerierung](../media/scene-video.md).

## Verwandte Anleitungen

- [Anbieter und Einrichtung der Bildgenerierung](../media/image-providers.md)
- [Szenen-Videogenerierung](../media/scene-video.md)
- [Bildstil-Profile](../media/style-profiles.md)
- [Noodle-Einstellungen und Chat-Übernahme](../noodle/settings.md)
- [Preset-Editor und Prompt Manager](presets.md)
- [Generierungsparameter](generation-parameters.md)
