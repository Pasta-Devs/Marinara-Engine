# Game Mode: widgety HUD

Widgety HUD to małe panele przy lewej i prawej krawędzi ekranu gry. Śledzą na przykład pasek zdrowia, licznik złota albo poziom zaufania sojusznika. Skrót HUD oznacza heads-up display, czyli pasek informacji. Każda gra ma własne widgety, niezależne od trackerów paska HUD w trybie Roleplay (zobacz [Pasek HUD i trackery w trybie Roleplay](../roleplay/hud-and-trackers.md)).

Gra może mieć łącznie maksymalnie 4 widgety, rozdzielone między lewą i prawą stronę tak, jak chcesz. Widgety działają tylko wtedy, gdy w danej grze włączona jest opcja **Custom HUD Widgets** (własne widgety HUD). W kreatorze konfiguracji jest ona domyślnie włączona. Game Master (GM, mistrz gry) projektuje wtedy początkowy zestaw widgetów w trakcie budowania świata.

## Typy widgetów

GM dobiera typ do każdego tworzonego widgetu. Przy ręcznym budowaniu widgetów typ możesz wybrać samodzielnie.

| Typ widgetu | Co pokazuje |
| --- | --- |
| **Progress Bar** | Poziomy pasek wartości z określonym maksimum, na przykład zdrowia lub wytrzymałości. |
| **Gauge** | Półokrągły wskaźnik wartości z określonym maksimum. |
| **Relationship Meter** | Pasek ze znacznikami kamieni milowych i etykietą, dobry do zaufania postaci NPC albo do więzi. |
| **Counter** | Jedna duża liczba, na przykład złoto, liczba dni albo pokonanych przeciwników. |
| **Stat Block** | Mała siatka nazwanych pól z wartościami, na przykład STR i DEX albo słowo opisujące stan. |
| **List** | Krótka lista punktowana, na przykład aktywne cele. |
| **Inventory Grid** | Siatka miejsc na przedmioty, opcjonalnie z zakładkami kategorii i liczbą sztuk. |
| **Timer** | Zegar odliczający minuty i sekundy, który może tykać na żywo. |

## Przegląd widgetów przed startem gry

Gdy istnieją własne widgety, pod przyciskiem **Start Game** (rozpoczęcie gry) na ekranie gry znajduje się przycisk **Review Starting Widgets** (przegląd widgetów początkowych). Kliknięcie go otwiera okno **Review Starting Widgets** przed startem gry. Okno zawiera listę wszystkich widgetów startowych, więc możesz je poprawić, zanim gra je utrwali.

1. Naciśnij **Edit** (edycja) przy widgecie, żeby zmienić jego wartości początkowe albo nazwy pól typu **Stat Block**.
2. Naciśnij **Remove** (usunięcie), żeby wyrzucić niepotrzebny widget.
3. Naciśnij **Start Game**, żeby zacząć grę z widgetami w pokazanej postaci. Naciśnij **Back** (powrót), żeby zamknąć okno bez rozpoczynania gry.

Podobne okno, **Prepare Next Session Widgets** (przygotowanie widgetów na kolejną sesję), pojawia się przy rozpoczynaniu nowej sesji w trwającej grze. Ma przycisk **Start Next Session** zamiast **Start Game** i **Cancel** zamiast **Back**.

## Edytowanie widgetu w trakcie gry

GM aktualizuje wartości widgetów wraz z rozwojem historii. Jeśli pominie aktualizację, popraw widget ręcznie.

1. Znajdź panel widgetu przy lewej lub prawej krawędzi ekranu.
2. Kliknij przycisk z ołówkiem (**Edit**) w nagłówku widgetu.
3. Zmień wartości w oknie edytora, na przykład **Maximum value** paska.
4. Kliknij **Save Changes** (zapisanie zmian).

Kliknij nagłówek widgetu, żeby zwinąć lub rozwinąć jego zawartość.

## Przesuwanie i blokowanie paneli

Panele widgetów są domyślnie zablokowane w miejscu. Każdy ma w nagłówku ikonę kłódki.

1. Kliknij ikonę kłódki, żeby odblokować panel. Delikatny obrys pokazuje, że panel da się przesuwać.
2. Przeciągnij panel w nowe miejsce.
3. Kliknij ikonę kłódki ponownie, żeby go zablokować.

Aby przywrócić panel na domyślne miejsce, kliknij dwukrotnie jego ikonę kłódki albo naciśnij <kbd>R</kbd>, gdy ikona jest zaznaczona. Każdy panel zapamiętuje położenie i stan blokady osobno dla każdej gry. Układ nie przenosi się do innych gier.

Na telefonie widgety wyświetlają się jako małe kafelki zamiast pełnych paneli. Dotknij kafelka, żeby otworzyć dany widget, i dotknij znaku X, żeby go zamknąć.

## Budowanie własnych widgetów

Zamiast zdawać się na GM, możesz zaprojektować widgety samodzielnie. Ręczny edytor otwiera się w jednym z dwóch miejsc:

- W kreatorze konfiguracji: włącz **Custom HUD Widgets**, a potem **Build Widget Setup**. Edytor pojawia się poniżej.
- W istniejącej grze: otwórz **Chat Settings** (ustawienia czatu), a potem sekcję **Widgets**.

1. Wybierz typ widgetu z listy rozwijanej i naciśnij **Add** (dodanie).
2. Ustaw **Icon** (krótki symbol lub emoji), **Label**, **Type**, **Side** (**Left HUD** albo **Right HUD**) i **Accent** (kolor).
3. Wypełnij pola danego typu: pasek korzysta z pól **Value** i **Max**, licznik z pola **Count**, siatka ekwipunku z pól **Slots** i **Contents**, a zegar z pól **Seconds** i **Running**.
4. W panelu **Chat Settings** naciśnij **Save Widgets** (zapisanie widgetów), żeby zastosować zmiany. **Reset** cofa niezapisane poprawki.

Edytor pokazuje, ile z 4 dozwolonych widgetów już wykorzystano.

## Udostępnianie widgetów przez import i eksport

Układ widgetów da się zapisać do pliku i wczytać w innej grze. Te przyciski znajdziesz zarówno w kreatorze konfiguracji, jak i w sekcji **Widgets** panelu **Chat Settings**.

1. Naciśnij **Export Widgets** (eksport widgetów), żeby pobrać widgety jako plik JSON (format danych zapisywany zwykłym tekstem).
2. W innej grze naciśnij **Import Widgets** (import widgetów) i wskaż ten plik.
3. W panelu **Chat Settings** naciśnij **Save Widgets**, żeby wczytane widgety zaczęły obowiązywać.

## Powiązane przewodniki

- [Game Mode: pierwsze kroki](getting-started.md)
- [Pasek HUD i trackery w trybie Roleplay](../roleplay/hud-and-trackers.md)
