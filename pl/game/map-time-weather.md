# Game Mode: mapa, czas i pogoda

Panel mapy pokazuje, gdzie jest twoja drużyna, i pozwala ją przemieszczać. Ten przewodnik opisuje też systemy, które śledzą świat wokół drużyny: dzień i godzinę, pogodę oraz morale drużyny.

## Panel mapy

Game Mode pokazuje na ekranie gry panel mapy. Panel podaje nazwę bieżącej mapy, dzień gry i ikonę nieba oznaczającą porę dnia.

- **Na komputerze** mapa jest wbudowanym panelem, który widać od razu. Panel da się przeciągać i zablokować w wybranym miejscu. Zasady działania przeciąganych paneli opisuje przewodnik [Game Mode: widgety HUD](hud-widgets.md).
- **Na telefonie** dotknij **Map** (Mapa), żeby otworzyć panel. Jego przycisk zaczyna w pobliżu lewego górnego rogu i można go przeciągać po czacie. Użyj **Lock window** (Zablokuj okno), żeby przycisk pozostał na miejscu, a **Close** (Zamknij), żeby do niego wrócić. Położenie zapisuje się razem z czatem. Mapa na telefonie korzysta ze stylu widgetów czatu z **Settings → Appearance → App** (ustawienia, wygląd, aplikacja), a jej przycisk pozostaje osobno, poza menu **Chat tools** (narzędzia czatu) z trzema kropkami.

### Widok siatki i widok węzłów

Marinara sama dobiera widok do rodzaju miejsca, które pokazuje mapa. Widoków nie przełącza się ręcznie.

- Widok **grid** (siatka) służy do otwartych przestrzeni, takich jak region albo miasto. Pokazuje kwadraty pokolorowane według terenu: trawa, las, woda, góry, pustynia, śnieg, miasteczko, droga i jaskinia.
- Widok **node** (węzły) służy do zamkniętych przestrzeni, takich jak lochy i wnętrza. Pokazuje lokalizacje jako kółka połączone liniami. Nieodkryta lokalizacja ma znak zapytania. Linia przerywana to ścieżka jeszcze nieprzebyta, a linia ciągła to ścieżka już przebyta.

## Poruszanie drużyną

Wybrać można tylko niektóre miejsca. Na mapie siatki kwadrat musi sąsiadować z drużyną i być już odkryty. Na mapie węzłów węzeł musi łączyć się z bieżącą lokalizacją albo być już odkryty. Pozostałe kwadraty i węzły nie reagują na kliknięcie.

1. Kliknij kwadrat siatki albo węzeł na mapie węzłów.
2. Nad polem wiadomości pojawia się kafelek **Map position:** (pozycja na mapie) z nazwą miejsca.
3. Wpisz wiadomość i wyślij ją. Marinara dopisuje na jej początku krótką linijkę w rodzaju `*moves to <place>*`.

Żeby zrezygnować, kliknij przycisk czyszczenia (X) na kafelku **Map position:**. Jego podpowiedź brzmi **Clear destination** (wyczyszczenie celu).

Na telefonie dotknij węzła raz, żeby go zaznaczyć, a potem dotknij **Set destination** (ustawienie celu) na dole. Węzeł oznaczony jako **You are here** to twoja bieżąca lokalizacja.

Jeśli to nie zadziałało, sprawdź, czy kwadrat sąsiaduje z drużyną i jest odkryty albo czy węzeł łączy się z miejscem, w którym jesteś.

### Przybliżanie, przełączanie i generowanie map

- **Przybliżanie.** Użyj przycisków **Zoom in** (plus) i **Zoom out** (minus) w prawym górnym rogu. Powiększenie mieści się w zakresie od 75% do 180%, ze skokiem co 25%.
- **Przełączanie map.** Gdy gra ma więcej niż jedną mapę albo region, lista rozwijana u góry panelu pozwala obejrzeć inną. Mapa, na której jesteś, ma dopisek **(Current)**.
- **Generowanie mapy.** Kliknij przycisk z różdżką **Generate another map** (wygenerowanie kolejnej mapy) w lewym górnym rogu, żeby zastąpić bieżącą mapę nową. Gra bez mapy pokazuje napis **No map yet** i przycisk **Generate**, który robi to samo.

## Ręczne ustawianie dnia i godziny

Sterowanie dniem i godziną znajduje się u góry panelu mapy. Widać tam napis **Day** z liczbą oraz ikonę nieba.

1. Kliknij pole **Day** (dzień).
2. Wpisz numer dnia od 1 do 9999.
3. Wybierz porę dnia: **Dawn**, **Morning**, **Afternoon**, **Evening**, **Night** albo **Midnight**.
4. Kliknij poza polem albo naciśnij <kbd>Enter</kbd>, żeby zapisać.

To ustawienie ręczne, niezależne od automatycznego zegara. Zegar potrafi też sam pokazać **Noon**, ale tej pory nie da się wybrać ręcznie.

## Jak płynie czas

Zegar gry opiera się na sztywnych obliczeniach, a nie na AI. Każda nowa gra zaczyna się w dniu 1 o godzinie 08:00. Każde działanie przesuwa zegar do przodu:

| Działanie | Doliczany czas |
| --- | --- |
| Rozmowa | 15 minut |
| Eksploracja | 30 minut |
| Runda walki | 5 minut |
| Krótki odpoczynek | 1 godzina |
| Długi odpoczynek | 8 godzin |
| Podróż | 2 godziny |

Kiedy zegar minie północ, numer dnia rośnie o jeden.

## Pogoda

Gra prowadzi pogodę na sztywnych obliczeniach, a nie przez AI. Pogoda zależy od biomu (rodzaju miejsca, w którym przebywa drużyna, na przykład pustyni, arktyki, wybrzeża albo gór) i pory roku. Przykłady to bezchmurne niebo, zachmurzenie, deszcz, burza, śnieg, zamieć, mgła i burza piaskowa. Pogoda zmienia się najczęściej podczas podróży i długiego odpoczynku, czasem przy eksploracji, a poza tym rzadko. Nadaje koloryt opisom scen tworzonym przez GM.

Żeby zobaczyć pogodę na ekranie, włącz w ustawieniach wyglądu przełącznik **Dynamic weather effects (rain, snow, fog, etc.)**. Domyślnie jest włączony. Nad grą pojawiają się wtedy cząsteczki deszczu, śniegu i mgły, dopasowane do pogody i pory dnia. Zobacz [Ustawienia wyglądu](../appearance/appearance-settings.md).

## Morale drużyny

Gra prowadzi ukryty wskaźnik morale drużyny w skali od 0 do 100. Ma on pięć poziomów, od najniższego do najwyższego: Broken, Low, Steady, High i Inspired.

Morale rośnie, gdy drużyna wygrywa walkę, kończy zadanie albo znajduje skarb. Spada, gdy drużyna przegrywa walkę, nie wykonuje zadania albo traci sojusznika. Z czasem morale wraca w okolice środka skali. Gra nie pokazuje go jako liczby. Morale zabarwia opisy nastroju drużyny tworzone przez GM. Nie zmienia twoich rzutów kośćmi.

<a id="dungeons-caves-and-stations"></a>

## Powiązane przewodniki

- [Game Mode: pierwsze kroki](getting-started.md)
- [Game Mode: widgety HUD](hud-widgets.md)
- [Ustawienia wyglądu](../appearance/appearance-settings.md)
