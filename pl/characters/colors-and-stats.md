# Kolory postaci i statystyki fabularne

Zakładki **Colors** (kolory) i **Stats** (statystyki) znajdują się zarówno w edytorze postaci, jak i w edytorze persony. Kolory zmieniają wygląd postaci albo persony na czacie. Statystyki ustawiają wartości, które da się śledzić, takie jak zdrowie czy głód.

## Zakładka **Colors**

Zakładka **Colors** ustawia trzy kolory: kolor imienia, kolor dialogu i kolor pola wiadomości. Zostaw pole puste, żeby dana część używała koloru z motywu aplikacji.

1. Otwórz postać albo personę w jej edytorze.
2. Kliknij zakładkę **Colors**.
3. Panel **Preview** (podgląd) z podglądem na żywo pokazuje przykładowe imię i dymek wiadomości, a pod nim są pola kolorów. Podgląd odświeża się przy każdej zmianie koloru, jeszcze przed zapisem.

### Przycisk **Extract Colors from Avatar**

**Extract Colors from Avatar** (pobranie kolorów z awatara) dobiera wszystkie trzy kolory na podstawie obrazka awatara. Zanim awatar zostanie dodany, przycisk jest nieaktywny i ma napis **Upload an avatar first**. Potem każdy kolor nadal da się zmienić ręcznie.

### Trzy kolory

Każdy z nich ustaw w polu wyboru koloru albo wpisz wartość:

| Pole | Co koloruje | Przykładowa wartość |
| --- | --- | --- |
| **Name Display Color** | Imię. Przyjmuje też gradient, zobacz niżej. | `#f59e0b` |
| **Dialogue Highlight Color** | Tekst w cudzysłowach dialogowych. | `#ffd700` |
| **Message Box Color** | Tło dymka wiadomości w trybie Roleplay. | `#123456` |

**Name Display Color** przyjmuje też gradient CSS, czyli płynne przejście między kolorami:

```text
linear-gradient(90deg, #f59e0b, #ef4444)
```

Zakładka **Colors** postaci ma też pole **Name Aliases** (aliasy imienia). Wpisz dodatkowe imiona albo przezwiska rozdzielone przecinkami, na przykład `Kate, Kitty, Katherine`. Gdy pojawiają się w wiadomościach na czacie, dostają kolor imienia postaci. Główne imię jest zawsze uwzględnione. Funkcję włącza się osobno dla każdego czatu w **Chat Settings → Characters** (ustawienia czatu, postacie).

Przezroczystość zmienisz w **Settings → Appearance → Roleplay Presentation → Roleplay Messages Background Opacity** (ustawienia, wygląd, prezentacja trybu Roleplay, nieprzezroczystość tła wiadomości w trybie Roleplay).

Suwak zastępuje przezroczystość zapisaną w kolorach tła postaci, persony i presetu, także w kolorach pobranych z awatara. Zapisane wartości kolorów pozostają bez zmian. Ustawienie nie wpływa na kolor imienia ani dialogu.

Punkty zaczepienia tła w niestandardowym motywie oraz CSS karty nadal mogą nadpisać styl dymków aplikacji.

<a id="where-your-colors-show"></a>

### Gdzie widać ustawione kolory

- Kolor imienia koloruje wyświetlaną nazwę w wiadomościach na czacie. U postaci koloruje też nazwę na zakładkach paska bocznego. U persony koloruje też nazwę w oknach wyboru persony.
- Kolor dialogu koloruje tekst w cudzysłowach dialogowych, zarówno w prostych cudzysłowach, jak i w innych ich stylach. Ten tekst da się też pogrubić w sekcji **Settings** (Ustawienia). Czaty Conversation z niego nie korzystają.
- Kolor pola wiadomości ustawia tło dymków wiadomości danej postaci albo persony w czatach Roleplay. Czaty Conversation i Game z niego nie korzystają.

## Zakładka **Stats**

Zakładka **Stats** ustawia liczby takie jak HP (punkty zdrowia), STR (siła) czy pasek głodu. Po włączeniu statystyk Marinara dopisuje wartości do promptu (prompt to tekst, który Marinara wysyła do AI), dzięki czemu AI zna aktualny stan. Ustawione wartości są domyślnymi wartościami startowymi dla nowych czatów. Później agenci mogą zmieniać część z nich w trakcie gry (zobacz [Jak agenci aktualizują statystyki](#how-agents-update-your-stats)).

Zakładki **Stats** postaci i persony mają różny układ.

### Statystyki postaci

Postać ma jeden przełącznik, **Enable story stats** (włączenie statystyk fabularnych). Gdy jest wyłączony, nic poniżej nie jest widoczne ani wysyłane. Po włączeniu pojawiają się dwie sekcje:

- **Pools** (pule) to nazwane paski z wartością bieżącą, wartością maksymalną i kolorem. Nowe postacie mają na starcie HP i MP, każde na poziomie 100 ze 100.
- **Attributes** (atrybuty) to nazwane liczby. Nowe postacie mają na starcie STR, DEX, CON, INT, WIS i CHA, każdy o wartości 10.

Kliknij **Add** (dodaj), aby dodać pulę albo atrybut, i X w wierszu, aby go usunąć.

### Statystyki persony

Zakładka **Stats** persony ma dwa osobne bloki, każdy z własnym przełącznikiem.

- **Persona Status Bars** (paski stanu persony), włączane przełącznikiem **Enable Persona Stats** (włączenie statystyk persony), śledzą potrzeby fizyczne i psychiczne. Paski startowe to Satiety, Energy, Hygiene i Mood, każdy na poziomie 100 ze 100. W sekcji **Status Bars** każdy pasek ma nazwę, wartość bieżącą, wartość maksymalną i kolor. Kliknij **Add**, aby dodać pasek, a X, aby go usunąć.
- **Enable story stats** (włączenie statystyk fabularnych) działa tak samo jak w karcie postaci. Daje personie sekcję **Pools** (na starcie HP i MP na poziomie 100 ze 100) oraz sekcję **Attributes** (na starcie STR, DEX, CON, INT, WIS i CHA o wartości 10).

<a id="mrpg-picks-on-a-card"></a>

### Wybory MRPG na karcie

Obie zakładki **Stats** mają sekcję **Game Mode** (tryb Game Mode) z blokiem **MRPG** dla gier korzystających z klas MRPG (czyli każdej nowej gry). Gra losuje statystyki MRPG każdej postaci od nowa, więc karta nie przechowuje liczb, a tylko trzy wybory:

- **Starting tree** (drzewko początkowe): drzewko, w którym postać zaczyna. Opcja **Auto** (automatycznie) odczytuje je z opisu i osobowości na karcie oraz pokazuje, które drzewko z nich wynika.
- **Strong in** (mocne statystyki): maksymalnie dwie statystyki, w których postać dobrze się rozwija.
- **Weak in** (słaba statystyka): jedna statystyka, w której postać rozwija się słabo.

Blok pokazuje podgląd klasy, z którą postać rozpocznie nową grę na poziomie 1, wraz z jej szeregiem oraz początkowymi wartościami HP, MP i Stamina. Wybór mocnych i słabej statystyki wpływa na ukryty rozwój postaci w każdej grze. Jej siostrzane drzewko wynika z temperamentu w grze, a nie z karty. Zobacz [Game Mode: klasy MRPG](../game/mrpg-classes.md#choose-a-characters-trees).

Na karcie postaci znajdująca się niżej sekcja **Story stats** (statystyki fabularne) skrywa opisane wyżej pule i atrybuty. Korzystają z nich czaty Roleplay i gry Legacy. Gra MRPG używa zamiast nich bloku klasy i nigdy nie tworzy na ich podstawie arkusza.

<a id="game-mode-icon"></a>

### Ikona trybu Game Mode

Obie zakładki **Stats** mają blok **Game Mode Icon** (ikona trybu Game Mode). Ustawia on obraz na okrągłym tokenie tej postaci lub persony na planszy podczas walki w trybie Game Mode. Mały token obok opcji pokazuje, co pojawi się na planszy.

- **Avatar** (awatar) to opcja domyślna. Używa awatara, a gdy go nie ma, inicjałów.
- **Custom image** (własny obraz) używa obrazu z galerii danej karty. Wybierz jeden z pokazanych tam obrazów albo prześlij nowy, który zostanie dodany do galerii. Zanim z tego skorzystasz, zapisz kartę co najmniej raz.
- **Initials** (inicjały) zawsze pokazuje inicjały, nawet gdy jest awatar.

Ten sam obraz pojawia się dla tej postaci w innych stylach walki. Jeśli usuniesz wybrany obraz z galerii, blok o tym poinformuje. Wybierz inny albo wróć do **Avatar**.

<a id="ruleset-sheets"></a>

### Arkusze zestawów zasad

Po instalacji zestawu zasad Game Mode, na przykład 5e (SRD 5.1), obie zakładki **Stats** dostają pod opisanymi wyżej sekcjami blok **Ruleset sheets** (arkusze zestawów zasad). Ma on po jednym rozwijanym wpisie na każdy zainstalowany zestaw. Pojawia się też wtedy, gdy karta nadal przechowuje arkusz zestawu, którego już nie masz.

Arkusz to początkowa konfiguracja tej postaci dla danego zestawu zasad. Nowa gra na tym zestawie bierze jego kopię. Zmiany wprowadzone w grze zostają w tej grze i nigdy nie wracają na kartę.

1. Otwórz wpis i kliknij **Add a sheet** (dodaj arkusz). Dostaniesz pusty arkusz, w którym każda wartość ma ustawienie domyślne zestawu zasad.
2. Wypełnij go. Układ pochodzi z zestawu zasad: wartości cech z ich modyfikatorami, pola pogrupowane w sekcje, listy takie jak ataki i zaklęcia oraz umiejętności i rzuty obronne z poziomem wyszkolenia i dodatkową premią. Wartości obliczane, na przykład premia biegłości albo pasywna Percepcja, aktualizują się podczas pisania i nie da się ich edytować.
3. Zapisz postać albo personę jak zwykle.

Możesz też poprosić asystentkę Professor Mari o wypełnienie albo zmianę arkusza, na przykład "ustaw postaci Rook wartość Brawn na 2 i dodaj łom do ekwipunku postaci Rook". Asystentka zapisuje tylko arkusz tego zestawu zasad, utrzymuje każdą wartość w granicach zestawu i pokazuje zmianę na karcie zmiany.

Niektóre zestawy zasad zawierają gotowe zaklęcia, ataki i zdolności. Listy, które wypełniają, mają przycisk **Add from catalog** (dodaj z katalogu), który otwiera okno wyboru z wyszukiwaniem. Dodane w ten sposób wiersze są kopiami, które da się edytować jak każde inne.

- Komórka, którą zestaw zasad prowadzi za ciebie, na przykład liczba użyć zależna od wartości cechy albo zasób klasy rosnący wraz z poziomem, jest widoczna na swoim miejscu, ale nie da się w niej pisać. Ma dopisek "Set by the ruleset" i jest wyliczana od nowa przy każdej edycji arkusza.
- Gdy własny tekst zestawu zasad dla jednego z tych wierszy zmienił się od chwili, gdy go wybrano, linia pod listą podaje, ile wierszy ma nowszy tekst, i pokazuje przycisk **Review** (przejrzyj). Przegląd pokazuje każdy wiersz z twoim tekstem obok tekstu zestawu zasad oraz pole wyboru przy każdym wierszu. **Update selected** (aktualizuj wybrane) zapisuje tylko zaznaczone wiersze. Porównywany jest tylko tekst. Liczby, przełączniki i wszystko, co wpisano w innej kolumnie, pozostają nietknięte.

Arkusz zestawu zasad, którego nie masz zainstalowanego, zostaje zachowany. Wyświetla się jako jedna linia z przyciskiem **Remove** (usuń), nigdy nie trafia do AI, znów da się go edytować po zainstalowaniu tego zestawu i przenosi się razem z kartą przy eksporcie. Arkusz zainstalowanego zestawu zasad, którego ta wersja aplikacji nie potrafi odczytać, na przykład zapisany przez nowszą wersję, również zostaje zachowany bez zmian. Jego wpis oferuje tylko **Remove this sheet** (usuń ten arkusz), więc nowy arkusz nigdy go przypadkiem nie nadpisze. Każdy arkusz może mieć najwyżej 64 KB.

Arkusze zestawów zasad są niezależne od **Enable story stats** (włączenie statystyk fabularnych). Gra na własnych zasadach aplikacji Marinara Engine je pomija. Gra na zestawie zasad używa do testów arkusza zamiast opisanych wyżej atrybutów (Attributes).

<a id="how-agents-update-your-stats"></a>

## Jak agenci aktualizują statystyki

Zakładka **Stats** ustawia stan początkowy czatu. Agenci aktualizują tylko wartości należące do trackerów.

| Wartość | Kto ją zmienia |
| --- | --- |
| **Pools** postaci, takie jak HP | Agent **Character Tracker**, na podstawie walki, leczenia i wydarzeń fabularnych. Nie śledzi persony gracza. |
| **Persona Status Bars** | Agent **Persona Stats**, po każdej wiadomości. |
| **Story stats** (statystyki fabularne), takie jak STR i DEX | Żaden agent. Są wysyłane razem z kartą na potrzeby walki i trybu Game Mode oraz opcjonalnych rzutów w trybie Roleplay lub Game Mode. |

Jeśli nie włączysz odpowiedniego agenta, wartości należące do trackerów pozostają na ustawionych przez ciebie wartościach domyślnych. Sama zakładka **Stats** niczego nie aktualizuje w trakcie gry. Sposób włączania tych agentów opisuje przewodnik [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md).

## Jak statystyki wyglądają na pasku HUD

Włączone statystyki pojawiają się w trakcie czatu na pasku HUD. Pasek HUD to niewielki panel z bieżącymi wartościami. Paski są wyświetlane jako gradienty z kolorami przypisanymi do poziomów. Jak przenieść albo ukryć pasek HUD, opisuje przewodnik [Pasek HUD i trackery](../roleplay/hud-and-trackers.md).

## Powiązane przewodniki

- [Tworzenie i edycja postaci](creating-and-editing-characters.md)
- [Persony](personas.md)
- [Pasek HUD i trackery](../roleplay/hud-and-trackers.md)
- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)
