# LTX-Storyboard Image-to-Video

Status: Vereinfachung als Folgearbeit, derzeit in lokaler Prüfung.

## Problem

Die erste Integration von **LTX Director Storyboard** (Vorlage für die Storyboard-Planung) in Marinara zerlegte jede geplante Aufnahme in einen festen globalen Prompt und mehrere lokale Prompts, getrennt durch Pipe-Zeichen. Die Storyboard-Route erkannte anschließend die IDs der mitgelieferten Vorlagen, umging den üblichen Vertrag für Video-Prompts und baute stattdessen ein LTX-spezifisches Payload zusammen.

Dieses Design machte das Anpassen von Prompts unberechenbar: Wer eine mitgelieferte Vorlage kopierte oder bearbeitete, änderte damit deren ID und schaltete die Sonderübergabe stillschweigend ab. Außerdem verleitete es den Planer dazu, zu viele Aktionen auf einen kurzen Clip zu verteilen. Schlug die Planung fehl, konnte das generische Fallback-Storyboard einen großen Ausschnitt der rohen Erzählung an die Videogenerierung weiterreichen – so entstanden die überladenen Prompts, die in den Logs zur Laufzeit auftauchen.

Der funktionierende lokale ComfyUI-Workflow braucht diese zeitliche Prompt-Ebene gar nicht. LTX 2.3 animiert das übergebene erste Bild aus einem einzigen direkten Image-to-Video-Prompt.

## Produktentscheidung

Die bestehenden Vorlagen-IDs und die zugehörigen Bedienelemente in den Einstellungen bleiben erhalten, damit gespeicherte Chats weiter funktionieren. Ihr Vertrag wird aber vereinfacht:

- **LTX Director Storyboard** plant pro Aufnahme das erste Bild und genau einen vollständigen LTX-2.3-Prompt für Image-to-Video.
- **Storyboard First Frame** (Storyboard-Startbild) formatiert genau die Illustration bei T=0, die als Referenzbild dient.
- **Narration Passthrough** (Storyboard-Videovorlage) besteht nur aus `${narrationSummary}` und reicht den fertigen Prompt des Planers deshalb über denselben universellen Video-Vorlagen-Pfad weiter, den auch jeder andere Workflow nutzt.

Die Storyboard-Route darf diese Vorlagen-IDs nicht auswerten, keine lokalen Segmente erzeugen und kein LTX-spezifisches Prompt-Payload anhängen. Die gewählte Video-Vorlage bleibt vollständig anpassbar.

## Vertrag für den Planer

Die bestehende JSON-Struktur des Storyboards bleibt unverändert:

- `imagePrompt` beschreibt ausschließlich das exakte erste Bild bei T=0.
- `narrationBeat` ist der vollständige Prompt, der zusammen mit diesem Bild an das Video-Modell geht.
- Abschnittsanker und `characters` behalten ihre bisherige Bedeutung.

Für jeden `narrationBeat` gilt die offizielle [LTX-Anleitung zu Image-to-Video](https://docs.ltx.io/open-source-model/usage-guides/image-to-video) sowie der [Leitfaden zum Prompting](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide):

- schreib einen durchgehenden Absatz im Präsens – etwa 2-4 kurze Sätze für 1-6 Sekunden, 3-5 für 7-10 Sekunden und 4-8 für 11-15 Sekunden, Letzteres nur, wenn die Handlung so viel Detail trägt;
- beginne bei dem Zustand, den `imagePrompt` zeigt, und beschreibe, was als Nächstes passiert;
- nutze eine Hauptaktion und eine Kameraeinstellung für 1-6 Sekunden, bis zu zwei verbundene Phasen und Kameraeinstellungen für 7-10 Sekunden und bis zu drei für 11-15 Sekunden;
- beschreibe jede Kamerabewegung im Verhältnis zum Motiv und wechsle den Blickwinkel nur, wenn die Dauer den Übergang klar zeigen kann;
- drücke Reaktionen über sichtbare Mimik, Blick, Haltung, Atmung oder Gesten aus;
- baue zurückhaltende Bewegung in der Umgebung ein, dazu passende Geräusche oder einen kurzen wörtlich zitierten Dialog;
- lass die Aktion am Ende abschließen, ausklingen oder innehalten;
- verlass dich beim statischen Erscheinungsbild auf das Ausgangsbild: Komposition, Schauplatz, Licht, Farbpalette, Textur und Stil;
- vermeide Szenenwechsel, neue Motive, überladene Aktionen, komplexe Physik, lesbaren Text, UI-Elemente, erfundene Ereignisse sowie jeden Schnitt oder Kamerawechsel, der in der Dauer nicht klar unterzubringen ist.

Fang einfach an. Vier Sätze reichen, wenn sie die Aufnahme vollständig anleiten; der Planer darf eine einfache Aktion nicht aufblähen, nur um mehr Bewegung unterzubringen.

Beispiel:

```text
She opens the door and walks outside as the camera follows behind her. A light breeze moves her hair. She glances toward the street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

## Datenfluss

1. Der Planer liefert pro Aufnahme einen `imagePrompt` für T=0 und einen vollständigen `narrationBeat`.
2. Die Storyboard-Bildgenerierung erzeugt die Referenz-Illustration für das erste Bild.
3. Die Vorlage **Narration Passthrough** löst `${narrationSummary}` zum `narrationBeat` dieser Aufnahme auf.
4. Die normale Anfrage zur Videogenerierung trägt das Ergebnis in ihrem bestehenden Feld `prompt`.
5. Der ComfyUI-Adapter ersetzt `%prompt%` im gespeicherten Workflow und liefert das vorhandene Referenzbild sowie Maße, Dauer, Bildanzahl, Seed und Modellwerte.

Einen LTX-eigenen Zweig der Storyboard-Route gibt es in diesem Ablauf nicht.

## ComfyUI-Vertrag

Verwende den erprobten LTX-2.3-Workflow für Image-to-Video mit den üblichen Marinara-Platzhaltern. Seine Director-Eingaben sehen so aus:

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

Lass `%reference_image_name%`, `%duration_seconds%`, `%length%`, `%width%`, `%height%`, `%seed%` und `%model%` dort stehen, wo der Workflow sie ohnehin erwartet. Eine Anfrage über sechs Sekunden ergibt weiterhin 96 Einzelbilder, denn Marinara rechnet unverändert mit 16 FPS.

Ältere gespeicherte Workflows mit `%global_prompt%`, `%local_prompts%` und `%segment_lengths%` bleiben kompatibel: Der Adapter schreibt den gewöhnlichen Prompt der Anfrage in den globalen Wert und lässt lokale Prompts und Segmentlängen leer. Diese Platzhalter dienen nur der Kompatibilität und sind nicht die empfohlene Storyboard-Konfiguration.

## Verhalten im Fehlerfall

- Trennt sich der Client oder bricht der Planer ab, reich den Abbruch weiter. Erzeuge keine Fallback-Medien mehr.
- Scheitert der Planer tatsächlich, darf der bestehende Fallback-Planer das Verhalten für Standbilder erhalten – die Videogenerierung für diese Anfrage entfällt jedoch. Rohe Erzählung ist kein sicherer Image-to-Video-Prompt.
- Ein geprüftes, vom Client geliefertes Storyboard bleibt für die Videogenerierung zugelassen, weil sein Prompt schon vorher geprüft wurde.

## Umfang

Diese Änderung führt keinen zweiten Durchlauf eines Vision-Modells über das erzeugte Referenzbild ein. Der Planer legt bereits das erste Bild und dessen unmittelbare Bewegung fest, und das Bild selbst konditioniert LTX zum Zeitpunkt der Generierung. Eine spätere, bildbewusste Umschreibung lässt sich separat bewerten, falls das erste Bild spürbar abdriftet.

Arbeiten an der Client-Oberfläche, der Lokalisierung, dem Speicherschema, an Migrationen, Versionen, Dienst-Neustarts oder an Marinara-Agents sind nicht nötig.

## Abnahmekriterien

- Der LTX-Storyboard-Planer fordert genau einen vollständigen, auf die Dauer abgestimmten Image-to-Video-Prompt an – mit nachvollziehbaren Aktionsphasen, relativer Kameraführung und optionalem Ton oder Dialog.
- Die Vorlage **Narration Passthrough** besteht exakt aus `${narrationSummary}`.
- Die Storyboard-Route enthält keine Umgehung über exakte Vorlagen-IDs, keinen Bereiniger für lokale Prompts und keine LTX-spezifische Übergabe.
- Ein Workflow mit `global_prompt: "%prompt%"` erhält den vollständigen Prompt des Planers; `local_prompts` und `segment_lengths` bleiben leer.
- Bestehende `%global_prompt%`-Workflows erhalten als Kompatibilitäts-Fallback weiterhin den normalen Prompt der Anfrage.
- Ein Abbruch des Planers stoppt den Vorgang, und echte Fallback-Planung überspringt die Videogenerierung.
- `pnpm regression:prompt`, `pnpm check` und `git diff --check` decken den finalen Patch ab.
