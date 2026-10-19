# Kreaturenpakete schreiben

Ein **Kreaturenpaket** enthält Grafiken für die Kreaturen, gegen die in Game Mode gekämpft wird. Ist ein Paket ausgewählt, wird ein Gegner, für den es eine Grafik hat, auf dem Schlachtfeld mit dieser Grafik statt als runde Spielmarke gezeichnet. Die Grafik blickt in die Richtung, in die sich der Gegner zuletzt bewegt hat, und erscheint in der eigenen Größe der Kreatur. Ein Gegner, für den das Paket keine Grafik hat, behält seine Spielmarke. Wie das im Spiel aussieht, zeigt [Taktische Kämpfe und Gelände](../game/combat.md#tactical-battles-and-terrain).

Ein Paket ist eine einzelne JSON-Datei (`.creatures.json`). Am einfachsten erstellst du eines im Tab **Creatures** (Kreaturen) von Pixelforge, der die Datei aus einem Bild pro Kreatur baut. Diese Seite beschreibt die Datei selbst – für alle, die Pakete auf anderem Weg bauen.

## Die Datei

```json
{
  "creaturePackVersion": 1,
  "id": "my-monsters",
  "name": "My monsters",
  "version": 1,
  "author": "Robin",
  "tileSize": 48,
  "sheets": [{ "id": "s1", "png": "data:image/png;base64,iVBORw0KGgo...", "width": 2048, "height": 1536 }],
  "creatures": [
    {
      "id": "goblin",
      "match": ["5e-2014/creatures/goblin", "Goblin"],
      "size": "small",
      "w": 1,
      "h": 2,
      "frames": 1,
      "variants": [
        { "sheet": "s1", "x": 0, "y": 0 },
        { "sheet": "s1", "x": 1, "y": 0 }
      ]
    }
  ]
}
```

| Feld | Bedeutung |
| --- | --- |
| `creaturePackVersion` | Immer `1`. |
| `id` | Kleinbuchstaben, Ziffern, `_` und `-`. Die Bibliothek legt ein importiertes Paket unter `local/<id>` ab. |
| `name`, `author` | Werden in der Bibliothek angezeigt. `author` ist optional. |
| `version` | Eine ganze Zahl. Eine Version wird nie überschrieben: Um ein Paket zu ändern, erhöhst du seine Version. Ein erneuter Import derselben Datei ändert nichts. |
| `tileSize` | Die Größe einer Zelle in Pixeln, ein Vielfaches von 16 von 16 bis 96. Das Raster von Game Mode hat 48 Pixel pro Zelle. |
| `sheets` | Bis zu 64 Bilder (Sprite-Sheets), jedes höchstens 8.192 Pixel pro Seite. |
| `creatures` | Bis zu 2.000 Kreaturen. |

## Sprite-Sheets

Das Feld `png` eines Sprite-Sheets muss eine PNG-**Daten-URL** sein: `data:image/png;base64,`, gefolgt von Base64-Daten und sonst nichts. Ein Link auf ein Bild an anderer Stelle wird abgelehnt, ebenso alles, was nach den Base64-Daten steht. So kann ein Paket immer nur seine eigenen Bilder zeigen. `width` und `height` müssen der tatsächlichen Größe des PNG entsprechen; die Engine liest sie aus dem Header des Bildes und lehnt ein Paket ab, dessen Sheets etwas anderes angeben.

## Eine Kreatur

| Feld | Bedeutung |
| --- | --- |
| `id` | Die ID der Kreatur im Paket, eindeutig. |
| `match` | Wofür die Grafik gedacht ist, 1 bis 16 Einträge. Ein Eintrag ist eine Kreatur aus einem Regelsatz oder ein Name; beide Arten dürfen nebeneinander stehen. |
| `size` | `tiny`, `small`, `medium`, `large`, `huge` oder `gargantuan`. Das betrifft nur das Aussehen; jede Einheit belegt weiterhin genau ein Feld. |
| `w`, `h` | Die Größe eines Einzelbilds in Zellen, jeweils 1 bis 6. |
| `frames` | `1` für eine stillstehende Kreatur, `3` für eine laufende (Schritt, Stand, Schritt). |
| `variants` | Ihre **Looks**, 1 bis 8. Jeder gibt an, wo sein Block auf einem Sheet beginnt: `sheet` und die obere linke Zelle `x`, `y`. |

### Was `match` benennt

- **Eine Kreatur aus einem Regelsatz:** `<catalog>/<entry>` (zum Beispiel `creatures/goblin`) erfasst diesen Bestiariumseintrag in jedem Regelsatz. `<ruleset>/<catalog>/<entry>` (zum Beispiel `5e-2014/creatures/goblin`) erfasst ihn nur in diesem einen Regelsatz.
- **Ein Name:** erfasst einen Gegner über seinen Namen. Groß-/Kleinschreibung und Satzzeichen werden ignoriert, ebenso eine angehängte Zahl, sodass „Goblin 2“ ein Goblin ist.

Ein Kämpfer aus dem Bestiarium eines Regelsatzes wird zuerst über seinen Eintrag und dann über seinen Namen zugeordnet. Passen zwei Kreaturen auf dasselbe, gewinnt die im Paket zuerst aufgeführte; die Engine weist beim Import des Pakets darauf hin.

### Größen

Einzelbilder werden in Zellen gemessen. Eine Kreatur wird zentriert auf dem unteren Rand ihres Feldes stehend gezeichnet, sodass eine große Kreatur über die umliegenden Felder hinausragt. Diese Größen sehen auf dem 48-Pixel-Raster richtig aus:

| Kreatur | Einzelbild (`w` × `h`) |
| --- | --- |
| Winzig, oder eine kleine bis mittelgroße vierbeinige Kreatur | 1 × 1 |
| Klein oder mittelgroß, aufrecht stehend | 1 × 2 |
| Groß | 2 × 2, oder 2 × 3, wenn sie aufrecht steht (ein Oger, ein Golem) |
| Riesig | 3 × 3, oder 3 × 4 aufrecht stehend (ein Riese) |
| Gigantisch | 4 × 4 |

### Der Block: Zeilen und Einzelbilder

Jeder Look ist ein **Block** auf seinem Sheet. Ein Block ist `frames` Einzelbilder breit und 4 Zeilen hoch, und jedes Einzelbild misst `w` × `h` Zellen. Die Zeilen sind die Blickrichtungen, in dieser Reihenfolge:

1. nach unten (zum Betrachter hin)
2. nach links
3. nach rechts
4. nach oben (von hinten gesehen)

Eine stillstehende Kreatur (`frames: 1`) ist eine einzige Spalte mit den vier Blickrichtungen. Eine laufende (`frames: 3`) hat in jeder Zeile Schritt, Stand und Schritt nebeneinander, so wie ein laufender Charakter im RPG Maker. Jeder Block muss vollständig innerhalb seines Sheets liegen; die Engine nennt jeden Block, der über den Rand hinausreicht.

### Looks

Eine Kreatur mit mehreren Looks (andere Kleidung, Farben oder Waffen) gibt jedem ihrer Kämpfer einen davon. Ein Kämpfer behält bei jedem Zeichnen denselben Look, und zwei Goblins im selben Kampf können verschieden aussehen. Alle Looks einer Kreatur haben dieselbe Größe.

Im Tab **Creatures** von Pixelforge fügt **Add looks** (Looks hinzufügen) neben einer Kreatur weitere Bilder in der Größe ihres ersten hinzu, bis zu acht insgesamt.

## Ein Paket verwenden

Wähle im Tab **Creatures** von Pixelforge **Import a creature pack file** (Kreaturenpaket-Datei importieren) – oder **Save to the library** (in der Bibliothek speichern) für ein dort erstelltes Paket – und danach **Use for fights** (für Kämpfe verwenden). Ein einziges Paket zeichnet alle Kämpfe. Wenn du das gewählte Paket entfernst oder **Use tokens instead** (stattdessen Spielmarken verwenden) wählst, werden wieder Spielmarken angezeigt.
