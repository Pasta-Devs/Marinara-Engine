# Kolory postaci i statystyki RPG

Ten przewodnik wyjaśnia, jak działają zakładki **Colors** (kolory) i **Stats** (statystyki) w aplikacji Marinara Engine. Obie znajdują się w edytorze postaci i w edytorze persony. Kolory decydują o tym, jak postać albo persona wygląda na czacie. Statystyki służą do śledzenia wartości takich jak zdrowie czy głód.

## Zakładka **Colors**

Każda postać i każda persona ma w swoim edytorze zakładkę **Colors**. Ustawia się w niej trzy kolory: kolor imienia, kolor dialogu i kolor pola wiadomości. Puste pole oznacza, że dana część wygląda tak, jak przewiduje domyślny motyw aplikacji.

Aby otworzyć zakładkę **Colors**:

1. Otwórz postać w edytorze postaci albo personę w edytorze persony.
2. Kliknij zakładkę **Colors** na liście zakładek.
3. Powinien pojawić się panel **Preview** (podgląd) z podglądem na żywo, a pod nim trzy pola kolorów.

Panel **Preview** pokazuje przykładowe imię i przykładowy dymek wiadomości. Odświeża się przy każdej zmianie koloru, więc efekt widać jeszcze przed zapisem.

### Przycisk **Extract Colors from Avatar**

Przycisk **Extract Colors from Avatar** (pobranie kolorów z awatara) sam dobiera kolor imienia, kolor dialogu i kolor pola wiadomości na podstawie obrazka awatara. Działa dopiero wtedy, gdy awatar istnieje. Zanim awatar zostanie wgrany, przycisk jest nieaktywny i ma napis **Upload an avatar first**. Po pobraniu kolorów każdy z tych trzech nadal da się zmienić ręcznie.

### Trzy kolory

Każdy kolor ustaw w polu wyboru koloru albo wpisz wartość:

- **Name Display Color**: kolor imienia. To pole przyjmuje też gradient CSS. Gradient to płynne przejście między kolorami. Przykładowa wartość: `linear-gradient(90deg, #f59e0b, #ef4444)`.
- **Dialogue Highlight Color**: kolor tekstu w cudzysłowach dialogowych. Przykładowa wartość: `#ffd700`.
- **Message Box Color**: kolor tła dymka wiadomości na czacie. Najlepiej wygląda kolor półprzezroczysty. Przykładowa wartość: `rgba(0, 0, 0, 0.5)`.

Kolor półprzezroczysty przepuszcza część tła przez dymek. Format `rgba` to kolejno czerwony, zielony, niebieski oraz wartość alfa od 0 (pełna przezroczystość) do 1 (kolor kryjący).

<a id="where-your-colors-show"></a>

## Gdzie widać ustawione kolory

Każdy kolor działa w innym miejscu czatu:

- Kolor imienia koloruje wyświetlaną nazwę w wiadomościach na czacie. U postaci koloruje dodatkowo nazwę na zakładkach paska bocznego. U persony koloruje też nazwę na listach wyboru persony.
- Kolor dialogu koloruje tekst w cudzysłowach dialogowych. Działa zarówno z prostymi cudzysłowami, jak i z innymi ich stylami. Ten tekst da się dodatkowo pogrubić w sekcji **Settings** (Ustawienia). Czaty Conversation z niego nie korzystają.
- Kolor pola wiadomości ustawia tło dymków danej postaci albo persony w czatach Roleplay. Czaty Conversation i Game z niego nie korzystają.

## Zakładka **Stats**

Każda postać i każda persona ma również zakładkę **Stats**. Statystyki to liczby takie jak HP (punkty zdrowia), STR (siła) czy pasek głodu. Po ich włączeniu Marinara dopisuje wartości do promptu, czyli tekstu wysyłanego do AI, dzięki czemu model zna aktualny stan. Wartości ustawione w tej zakładce to punkt wyjścia dla nowych czatów. Później mogą je zmieniać agenci. Więcej na ten temat znajdziesz w sekcji o agentach poniżej.

Zakładka **Stats** u postaci i zakładka **Stats** u persony wyglądają inaczej, dlatego każda z nich jest opisana osobno.

### Statystyki postaci: **Enable RPG Stats**

Postać ma jeden przełącznik: **Enable RPG Stats** (włączenie statystyk RPG). Kiedy jest wyłączony, nic poniżej nie jest widoczne ani wysyłane. Po włączeniu pojawiają się dwie sekcje:

- **Pools**: nazwane paski z wartością bieżącą, wartością maksymalną i kolorem. Nowe postacie mają na starcie pulę HP i pulę MP, obie na poziomie 100 ze 100. Kliknij przycisk **Add**, aby dodać kolejną pulę. Kliknij X w wierszu, aby go usunąć.
- **Attributes**: nazwane wartości liczbowe. Nowe postacie mają na starcie STR, DEX, CON, INT, WIS i CHA, każdą o wartości 10. Kliknij przycisk **Add**, aby dodać kolejny atrybut. Kliknij X w wierszu, aby go usunąć.

### Statystyki persony: dwie sekcje

Zakładka **Stats** persony składa się z dwóch osobnych bloków, każdy z własnym przełącznikiem.

Pierwszy blok to **Persona Status Bars**, włączany przełącznikiem **Enable Persona Stats**. Te paski śledzą potrzeby fizyczne i psychiczne. Po włączeniu bloku dostępne są paski startowe Satiety, Energy, Hygiene i Mood, każdy na poziomie 100 ze 100. Listą zarządza się w sekcji **Status Bars**. Każdy pasek ma nazwę, wartość bieżącą, wartość maksymalną i kolor. Kliknij przycisk **Add**, aby dodać pasek, a X, aby go usunąć.

Drugi blok to **RPG Attributes**, włączany przełącznikiem **Enable RPG Attributes**. Działa tak samo jak w karcie postaci. Daje personie sekcję **Pools** (na starcie HP i MP na poziomie 100 ze 100) oraz sekcję **Attributes** (na starcie STR, DEX, CON, INT, WIS i CHA o wartości 10).

<a id="ruleset-sheets"></a>

### Arkusze zestawów zasad

Po instalacji zestawu zasad Game Mode, np. 5e (SRD 5.1), obie zakładki **Stats** otrzymują pod opisanymi wyżej sekcjami blok **Ruleset sheets** (arkusze zestawów zasad), po jednym rozwijanym wpisie na każdy zainstalowany zestaw. Blok jest widoczny również wtedy, gdy karta przechowuje arkusz nieobecnego już zestawu.

1. Otwórz wpis i kliknij **Add a sheet** (dodaj arkusz). Dostaniesz pusty arkusz, w którym każda wartość ma ustawienie domyślne zestawu zasad.
2. Wypełnij go. Układ pochodzi z samego zestawu zasad: wartości cech z ich modyfikatorami, pola pogrupowane w sekcje, listy takie jak ataki i zaklęcia oraz umiejętności i rzuty obronne, każde z poziomem wyszkolenia i dodatkową premią. Wartości obliczane, np. premia biegłości lub pasywna Percepcja, aktualizują się podczas pisania i nie podlegają bezpośredniej edycji.
3. Zapisz postać lub personę jak zwykle.

Arkusz w tym miejscu to **początkowa konfiguracja** tej postaci dla danego zestawu zasad. Nowa gra na tym zestawie zasad bierze jego kopię. Zmiany wprowadzone w grze zostają w tej grze i nigdy nie wracają na kartę.

Niektóre zestawy zasad zawierają gotowe zaklęcia, ataki i zdolności. Listy, które wypełniają, mają przycisk **Add from catalog** (dodaj z katalogu) otwierający wyszukiwarkę, a dodane w ten sposób wiersze są kopiami, które da się edytować jak każde inne. Wynikają z tego dwie rzeczy:

- Komórka, którą zestaw zasad prowadzi za ciebie, na przykład liczba użyć zależna od wartości cechy albo zasób klasy rosnący wraz z poziomem, jest widoczna na swoim miejscu, ale nie da się w niej pisać; ma dopisek "Set by the ruleset". Jest wyliczana z reszty arkusza przy każdej jego edycji.
- Gdy własny tekst zestawu zasad dla jednego z tych wierszy zmienił się od chwili, gdy go wybrano, linia pod listą podaje, ile wierszy ma nowszy tekst, i pokazuje przycisk **Review** (przejrzyj). Przegląd pokazuje każdy wiersz z treścią twojego arkusza obok treści z zestawu zasad oraz pole wyboru przy każdym wierszu. **Update selected** (aktualizuj wybrane) zapisuje zaznaczone wiersze i nic więcej. Porównywany jest tylko tekst: liczby, przełączniki i wszystko, co wpisano w innej kolumnie, pozostają nietknięte, podobnie jak każdy odznaczony wiersz.

Arkusz zestawu zasad, którego nie masz zainstalowanego, zostaje zachowany, a nie usunięty. Wyświetla się jako jedna linia z przyciskiem **Remove** (usuń), nigdy nie trafia do AI i znów da się go edytować po zainstalowaniu tego zestawu zasad. Przenosi się też razem z kartą przy eksporcie. Każdy arkusz może mieć najwyżej 64 KB.

Arkusz zainstalowanego zestawu zasad, którego ta wersja aplikacji Marinara Engine nie potrafi odczytać, na przykład zapisany przez nowszą wersję, również zostaje zachowany bez zmian. Jego wpis oferuje tylko **Remove this sheet** (usuń ten arkusz), więc dodanie nowego arkusza nigdy go przypadkiem nie nadpisze.

Arkusze zestawów zasad są niezależne od **Enable RPG Stats** i **Enable RPG Attributes**. Gra korzystająca z własnych zasad aplikacji Marinara Engine je pomija, a gra na zestawie zasad używa ich do testów zamiast opisanych wyżej atrybutów.

## Jak agenci aktualizują statystyki

Wartości w zakładce **Stats** stają się stanem początkowym czatu. Agenci mogą aktualizować opisane niżej wartości należące do trackerów. Atrybuty RPG, takie jak STR i DEX, są kontekstem karty, a nie wartościami trackerów zarządzanymi przez agentów.

- Agent **Character Tracker** zmienia śledzone statystyki postaci, w tym pule takie jak HP, na podstawie walki, leczenia i wydarzeń fabularnych. Nie śledzi persony gracza.
- Agent **Persona Stats** aktualizuje sekcję **Persona Status Bars** po każdej wiadomości, zgodnie z tym, co dzieje się w historii.
- Sekcje **RPG Attributes** postaci i persony są wysyłane razem z ich kartą w walce i w trybie Game Mode oraz przy opcjonalnych rzutach w trybie Roleplay lub Game Mode. Agenci nie aktualizują tych atrybutów.

Jeśli nie włączysz odpowiedniego agenta trackera, wartości należące do trackerów pozostają takie, jakie zostały ustawione. Sama zakładka **Stats** niczego nie aktualizuje. Sposób włączania tych agentów opisuje przewodnik po wbudowanych agentach.

## Jak statystyki wyglądają na pasku HUD

Włączone statystyki pojawiają się w trakcie czatu w widgecie HUD. HUD to skrót od heads-up display – niewielki panel z aktualnymi wartościami. Paski mają gradienty z kolorami przypisanymi do poziomów, więc wystarczy jedno spojrzenie. Pełny opis wyświetlania oraz przenoszenia i ukrywania paska znajduje się w przewodniku po HUD.

## Powiązane przewodniki

- [Tworzenie i edycja postaci](creating-and-editing-characters.md)
- [Persony użytkownika: tworzenie i edycja](personas.md)
- [HUD i trackery](../roleplay/hud-and-trackers.md)
- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)
