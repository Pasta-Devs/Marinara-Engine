# Prompt Overrides für Bild und Video

Prompt Overrides sind Editoren für die Vorlagen, mit denen Marinara die Prompts für Bild- und Videomodelle schreibt. Mit ihnen änderst du, wie Porträts, Selfies, Sprites, Szenenkunst, Storyboards oder Videoclips dem Modell beschrieben werden.

Den Prompt an dein Chat-Modell ändern sie nicht. Dafür nimmst du ein Preset. Siehe [Preset-Editor und Prompt-Manager](presets.md) und [Generierungsparameter](generation-parameters.md).

Ein Sprite ist ein Stück Charakterkunst, etwa ein Gesichtsausdruck oder eine Pose. Ein Storyboard ist eine Folge illustrierter Einzelbilder aus einem Zug im Game Mode oder aus einer abgeschlossenen Roleplay-Episode.

Bevor du anfängst: Prompt Overrides spielen nur für Funktionen eine Rolle, die Bilder oder Videos generieren, und die brauchen zuerst ein Konto für die Bild- oder Videogenerierung. Ohne ein solches Konto kommt die Vorlage nie zum Einsatz. Siehe [Anbieter für Bildgenerierung und Einrichtung](../media/image-providers.md) und [Szenenvideos generieren](../media/scene-video.md).

## Die Editoren finden

1. Öffne **Settings** (Einstellungen).
2. Klick auf den Tab **Generations**.
3. Scroll zum Bereich **Prompt Overrides** (Prompt-Überschreibungen), der als „Reusable image and video prompt templates“ beschrieben ist.

Dort gibt es zwei Editoren. Klick auf einen Titel, um ihn aufzuklappen.

| Editor | Vorlagen, die er abdeckt |
| --- | --- |
| **Video Generation Prompt Overrides** | Szenenvideos in Game und Galerie, Videonachrichten in Conversation, Charakter-Clips in Conversation-Anrufen, animierte Ausdrucksporträts. |
| **Image Generation Prompt Overrides** | Selfies in Conversation, NPC-Porträts im Game Mode, Szenenkunst, Storyboard-Prompts, die Vorlage **Noodle Post Image** und weitere Bild-Builder. |

## Eine Vorlage bearbeiten

1. Öffne einen Editor.
2. Wähle unter **Registered prompt** (registrierter Prompt) eine Vorlage aus. Die Liste hängt vom Editor ab.
3. Sieh dir die Status-Plakette daneben an und lies die kurze Beschreibung unter dem Dropdown-Menü.
4. Klick unter **Available variables** (verfügbare Variablen) auf eine Variablen-Plakette, um die Variable einzufügen. Variablen sehen so aus: `${charName}`.
5. Bearbeite den Text im Feld **Template** (Vorlage).
6. Prüf **Rendered preview** (gerenderte Vorschau). Die Vorschau füllt deine Vorlage mit Beispielwerten.
7. Behebe jede Warnung **Unknown variables** (unbekannte Variablen). Ein Name, der nicht in der Liste **Available variables** steht, wird nicht gefüllt.
8. Klick auf **Save** (Speichern).

Es erscheint „Prompt override saved“, und die Plakette wechselt zu **Custom active**.

| Status-Plakette | Bedeutung |
| --- | --- |
| **Default** | Es ist keine eigene Vorlage gespeichert. |
| **Custom active** | Deine gespeicherte Vorlage ist im Einsatz. |
| **Custom paused** | Deine Vorlage ist gespeichert, aber abgeschaltet. |

## Eine Vorlage aufheben, ohne sie zu nutzen

Schalte **Apply this override** (diese Überschreibung anwenden) unter der Vorschau aus. Sein Hilfetext lautet „Turn this off to keep the template saved without using it.“ Marinara verwendet weiter die eingebaute Vorlage, und die Plakette zeigt **Custom paused**.

## Zurück zur eingebauten Vorlage

Klick auf **Reset to Default** (auf Standard zurücksetzen). Ist eine Überschreibung gespeichert, bittet Marinara dich um Bestätigung. Die Plakette steht danach wieder auf **Default**.

## Verwandte Anleitungen

- [Anbieter für Bildgenerierung und Einrichtung](../media/image-providers.md)
- [Szenenvideos generieren](../media/scene-video.md)
- [Bild-Stilprofile](../media/style-profiles.md)
- [Noodle-Einstellungen und Chat-Carryover](../agents/noodle-settings.md)
- [Preset-Editor und Prompt-Manager](presets.md)
- [Generierungsparameter](generation-parameters.md)
