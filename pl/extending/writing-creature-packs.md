# Pisanie pakietów stworzeń

**Pakiet stworzeń** to grafika dla stworzeń, z którymi walczy się w trybie Game Mode. Gdy pakiet jest wybrany, wróg, dla którego zawiera on grafikę, jest rysowany na planszy bitwy właśnie tą grafiką, a nie jako okrągły żeton. Grafika jest zwrócona w kierunku ostatniego ruchu wroga i ma rozmiar właściwy dla danego stworzenia. Wróg, dla którego pakiet nie ma grafiki, pozostaje żetonem. Jak to wygląda w grze, opisuje sekcja [Walka taktyczna i teren](../game/combat.md#tactical-battles-and-terrain).

Pakiet to jeden plik JSON (`.creatures.json`). Najłatwiej utworzyć go w zakładce **Creatures** (stworzenia) narzędzia Pixelforge, która buduje plik z jednego obrazka na każde stworzenie. Ta strona opisuje sam plik, z myślą o osobach, które tworzą pakiety w inny sposób.

## Plik

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

| Pole | Znaczenie |
| --- | --- |
| `creaturePackVersion` | Zawsze `1`. |
| `id` | Małe litery, cyfry, `_` i `-`. Biblioteka zapisuje zaimportowany pakiet pod `local/<id>`. |
| `name`, `author` | Wyświetlane w bibliotece. `author` jest opcjonalne. |
| `version` | Liczba całkowita. Raz zapisanej wersji nigdy się nie nadpisuje: aby zmienić pakiet, podnieś jego wersję. Ponowny import tego samego pliku niczego nie zmienia. |
| `tileSize` | Rozmiar jednego pola w pikselach, wielokrotność 16 od 16 do 96. Siatka trybu Game Mode ma 48. |
| `sheets` | Do 64 obrazów, każdy o boku najwyżej 8192 pikseli. |
| `creatures` | Do 2000 stworzeń. |

## Arkusze

Wartość `png` arkusza musi być **adresem data URL** obrazu PNG: `data:image/png;base64,`, a po nim base64 i nic więcej. Odnośnik do obrazu umieszczonego gdzie indziej zostaje odrzucony, tak samo jak cokolwiek po base64. Dzięki temu pakiet może pokazywać wyłącznie własne obrazy. `width` i `height` muszą odpowiadać rzeczywistemu rozmiarowi PNG: Engine odczytuje go z nagłówka obrazu i odrzuca pakiet, którego arkusze podają inne wartości.

## Stworzenie

| Pole | Znaczenie |
| --- | --- |
| `id` | Identyfikator stworzenia w pakiecie, unikalny. |
| `match` | Do czego służy grafika: od 1 do 16 wpisów. Wpis to stworzenie z zestawu zasad, nazwa albo oba rodzaje obok siebie. |
| `size` | `tiny`, `small`, `medium`, `large`, `huge` lub `gargantuan`. Wpływa tylko na wygląd: każda jednostka nadal zajmuje jedno pole. |
| `w`, `h` | Rozmiar jednej klatki w polach, każdy od 1 do 6. |
| `frames` | `1` dla nieruchomego stworzenia, `3` dla chodzącego (krok, postawa, krok). |
| `variants` | Jego **warianty wyglądu**, od 1 do 8, każdy wskazujący, gdzie na arkuszu zaczyna się jego blok: `sheet` oraz lewe górne pole `x`, `y`. |

### Co wskazuje `match`

- **Stworzenie z zestawu zasad:** `<catalog>/<entry>` (na przykład `creatures/goblin`) pasuje do tego wpisu bestiariusza w dowolnym zestawie zasad. `<ruleset>/<catalog>/<entry>` (na przykład `5e-2014/creatures/goblin`) pasuje do niego tylko w tym jednym zestawie zasad.
- **Nazwa:** pasuje do wroga o tej nazwie. Wielkość liter i interpunkcja nie mają znaczenia, podobnie jak liczba na końcu, więc "Goblin 2" to goblin.

Uczestnik walki z bestiariusza zestawu zasad jest dopasowywany najpierw po wpisie, a dopiero potem po nazwie. Jeśli dwa stworzenia pasują do tego samego, wygrywa to, które w pakiecie występuje wcześniej; Engine odnotowuje to podczas importu pakietu.

### Rozmiary

Klatki liczy się w polach, a stworzenie jest rysowane wyśrodkowane, tak że stoi na dolnej krawędzi swojego pola, więc duże stworzenie zachodzi na sąsiednie pola. Na siatce 48-pikselowej dobrze wyglądają takie rozmiary:

| Stworzenie | Klatka (`w` na `h`) |
| --- | --- |
| Drobne albo małe lub średnie czworonożne | 1 na 1 |
| Małe lub średnie, stojące prosto | 1 na 2 |
| Duże | 2 na 2 albo 2 na 3, jeśli stoi prosto (ogr, golem) |
| Ogromne | 3 na 3 albo 3 na 4, jeśli stoi prosto (olbrzym) |
| Gigantyczne | 4 na 4 |

### Blok: wiersze i klatki

Każdy wariant wyglądu to **blok** na jego arkuszu. Blok ma szerokość `frames` klatek i wysokość 4 wierszy, a każda klatka ma `w` na `h` pól. Wiersze odpowiadają kierunkom, w które zwrócone jest stworzenie, w tej kolejności:

1. w dół (w stronę patrzącego)
2. w lewo
3. w prawo
4. w górę (widok od tyłu)

Nieruchome stworzenie (`frames: 1`) to jedna kolumna z czterema kierunkami. Chodzące (`frames: 3`) ma w każdym wierszu krok, postawę i krok, tak jak chodząca postać w programie RPG Maker. Każdy blok musi w całości mieścić się na swoim arkuszu; Engine wymienia każdy, który wychodzi poza krawędź.

### Warianty wyglądu

Gdy stworzenie ma kilka wariantów wyglądu (inne ubrania, kolory albo broń), każdy uczestnik walki tego rodzaju dostaje jeden z nich. Uczestnik walki przy każdym rysowaniu zachowuje ten sam wariant, a dwa gobliny w jednej walce mogą się różnić. Wszystkie warianty wyglądu danego stworzenia mają ten sam rozmiar.

W zakładce **Creatures** narzędzia Pixelforge przycisk **Add looks** (dodanie wariantów wyglądu) obok stworzenia dodaje kolejne obrazy o tym samym rozmiarze co pierwszy, łącznie do ośmiu.

## Używanie pakietu

W zakładce **Creatures** narzędzia Pixelforge kliknij **Import a creature pack file** (import pliku pakietu stworzeń) – a w przypadku pakietu utworzonego na miejscu **Save to the library** (zapis w bibliotece) – a potem **Use for fights** (użycie w walkach). Wszystkie walki rysuje jeden pakiet. Usunięcie wybranego pakietu albo **Use tokens instead** (użycie żetonów) przywraca żetony.
