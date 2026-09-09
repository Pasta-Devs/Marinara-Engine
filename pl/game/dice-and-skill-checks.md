# Game Mode: rzuty kośćmi i testy umiejętności

Z tego przewodnika dowiesz się, jak działają rzuty kośćmi w trybie Game Mode w aplikacji Marinara Engine. Opisuje on szybkie menu kości, własny zapis rzutu i ograniczenia takich rzutów. Wyjaśnia też, jak postać Game Master (mistrz gry) przeprowadza test umiejętności przeciwko poziomowi trudności (DC).

## Rzucanie kośćmi

Pasek wpisywania wiadomości w czacie w trybie Game Mode ma przycisk z kością. Po najechaniu na niego pojawia się podpowiedź **Roll dice** (rzut kośćmi). Kliknięcie otwiera szybkie menu kości.

W menu czeka osiem presetów dostępnych jednym kliknięciem:

| Preset | Rzut |
|---|---|
| d20 | jedna kość 20-ścienna |
| d6 | jedna kość 6-ścienna |
| 2d6 | dwie kości 6-ścienne |
| d10 | jedna kość 10-ścienna |
| d100 | jedna kość 100-ścienna |
| d4 | jedna kość 4-ścienna |
| d8 | jedna kość 8-ścienna |
| d12 | jedna kość 12-ścienna |

Szybki rzut wykonuje się tak:

1. Otwórz pasek wpisywania wiadomości w czacie w trybie Game Mode.
2. Kliknij przycisk z kością.
3. Kliknij jeden z ośmiu presetów, na przykład **d20**.
4. W pasku wpisywania pojawia się mały kafelek, na przykład `🎲 d20`.

Rzut nie wysyła się od razu – trafia do kolejki. Żeby usunąć rzut z kolejki, kliknij przycisk czyszczenia na kafelku. Jego podpowiedź to **Clear queued roll** (usunięcie rzutu z kolejki).

Kości liczą się dopiero przy wysłaniu kolejnej wiadomości. Aplikacja dokleja wynik na końcu wiadomości jako znacznik. Pojedyncza kość bez premii wygląda tak:

```
[dice: d20 = 14]
```

Rzut kilkoma kośćmi albo rzut z premią pokazuje też części składowe:

```
[dice: 3d8+2 = 18 (4, 6, 6 +2)]
```

Postać Game Master czyta ten znacznik i buduje wokół wyniku swoją narrację.

Gdy postać Game Master wykonuje kilka rzutów w jednej turze, każda karta rzutu zajmuje osobne miejsce w kolejce. Zamknij kartę, aby zobaczyć następną. Wszystkie rzuty zapisują się w aktywnym swipe'ie (alternatywnej odpowiedzi) tej tury i pozostają w **Logs** (dzienniku) po ponownym załadowaniu. Kontynuowanie tury zachowuje wcześniejsze rzuty; ponowne generowanie tworzy osobny zestaw dla nowego swipe'a.

Postać Game Master może też zażądać rzutu w narracji przez `[dice: 3d8+2]`. Silnik podaje rzeczywiste wyniki i pokazuje tę samą animowaną kartę. Działa to na połączeniach obsługujących wyłącznie tekst, w tym subskrypcjach Claude i Grok. Obowiązują ten sam zapis i te same limity co w menu kości.

## Własny zapis rzutu

W menu kości jest też pole tekstowe na własny rzut. Obowiązuje w nim standardowy zapis `NdM`. `N` to liczba kości, a `M` to liczba ścianek każdej z nich. Na końcu można dopisać premię albo karę.

Tekst zastępczy w polu podaje przykład: `3d8+2`. Oznacza on rzut trzema kośćmi 8-ściennymi i dodanie 2 do sumy.

Własny rzut wykonuje się tak:

1. Kliknij przycisk z kością, żeby otworzyć menu.
2. Wpisz zapis w polu tekstowym, na przykład `2d6+1`.
3. Naciśnij Enter albo kliknij mały przycisk z samolocikiem (wysyłka) obok pola.
4. Rzut czeka w kolejce jako kafelek, gotowy do wysłania.

Kilka innych przykładów do wpisania:

- `d20` to rzut jedną kością 20-ścienną.
- `4d8-1` to rzut czterema kośćmi 8-ściennymi i odjęcie 1.
- `2d6+3` to rzut dwiema kośćmi 6-ściennymi i dodanie 3.

Obowiązują dwa sztywne ograniczenia. Naraz można rzucić najwyżej 100 kośćmi, a każda kość ma najwyżej 1000 ścianek. Przy większych wartościach aplikacja nie odrzuca żądania, tylko przycina je do tych limitów. Jeśli tekst nie jest poprawnym zapisem `NdM`, rzut się nie udaje i pojawia się błąd z nazwą oczekiwanego formatu.

## Testy umiejętności

Test umiejętności sprawdza, czy ryzykowne działanie się powiedzie – skradanie, dostrzeżenie poszlaki albo przekonanie postaci NPC (postaci niezależnej). Testu umiejętności nie zaczyna się samodzielnie. Wywołuje go postać Game Master w swojej narracji. Aplikacja zamienia to na animowany rzut kością 20-ścienną z banerem wyniku.

Test wywołany tekstem zaczyna się od próby działania. Silnik rozstrzyga rzuty, a potem wysyła jedno dodatkowe zapytanie do modelu z rzeczywistymi wynikami, aby postać Game Master mogła dokończyć opis skutków w tej samej turze. Koryguje to również szkic, który zgadywał skutek przed rzutem. Dodatkowe zapytanie ponownie wysyła prompt i zużywa więcej tokenów wejściowych i wyjściowych. Jeśli się nie powiedzie, tura zachowuje rozstrzygnięte wyniki bez zapisywania zgadywanego lub niepełnego opisu skutków.

Na połączeniu obsługującym narzędzie kości postać Game Master może uzyskać rzeczywisty rzut już podczas generowania. Karta rzutu pojawia się po zwróceniu wyniku przez narzędzie; zakończony test zapisuje ten wynik bez ponownego rzucania. Każdy rozstrzygnięty test umiejętności dostaje osobny baner, po kartach rzutów czekających w kolejce.

Baner pokazuje umiejętność i liczbę do osiągnięcia, na przykład **Stealth Check** (test skradania), a obok **DC 15**. DC to skrót od Difficulty Class, czyli poziomu trudności. Tę liczbę rzut musi osiągnąć albo przebić.

### Jak liczy się wynik

Test rzuca jedną kością 20-ścienną i dodaje dwa modyfikatory:

- Modyfikator umiejętności, wyliczony z poziomu umiejętności, jaki gra prowadzi dla twojej postaci. Jeśli gra nie ma jeszcze poziomu dla tej umiejętności, modyfikator wynosi 0.
- Modyfikator atrybutu, wyliczony z atrybutu przypisanego do tej umiejętności.

Wynik rzutu plus oba modyfikatory daje sumę. Suma równa DC albo wyższa oznacza zdany test, a niższa – test niezdany. Każda umiejętność ma automatycznie przypisany atrybut. Na przykład Stealth korzysta z Dexterity, Perception z Wisdom, a Persuasion z Charisma. Umiejętność, której aplikacja nie rozpoznaje, korzysta domyślnie z atrybutu Intelligence.

### Sukces krytyczny i porażka krytyczna

Dwa wyniki rzutu unieważniają całe liczenie:

- Naturalna 20 (na samej kości wypada 20) to **CRITICAL SUCCESS** (sukces krytyczny). Test zawsze się udaje, nawet przy wysokim DC.
- Naturalna 1 (na samej kości wypada 1) to **CRITICAL FAILURE** (porażka krytyczna). Test zawsze kończy się porażką, nawet przy dużych modyfikatorach.

Baner pokazuje jeden z czterech wyników: **CRITICAL SUCCESS**, **SUCCESS**, **FAILURE** albo **CRITICAL FAILURE**.

### Inne systemy kości

Postać Game Master może podać inny zapis, na przykład `[skill_check: skill="Endurance" dc="12" dice="3d6+2"]`. Takie testy korzystają ze stałego modyfikatora z zapisu zamiast modyfikatorów d20 z arkusza postaci i kończą się sukcesem, gdy suma osiągnie DC. Zasady naturalnej 1 i naturalnej 20 dotyczą tylko standardowego testu d20 opisanego powyżej.

Pula sukcesów wymaga podania zarówno progu dla pojedynczej kości, jak i wymaganej liczby sukcesów: `[skill_check: skill="Intimidation" dc="4" dice="6d10" resolution="successes" threshold="6"]` rzuca sześcioma kośćmi d10, liczy każdą kość z wynikiem co najmniej 6 jako jeden sukces i zdaje test przy co najmniej czterech sukcesach. Silnik nie zgaduje brakującego progu ani nie implementuje eksplodujących kości, pechów czy innych specjalnych zasad puli. Pula bez poprawnego progu pozostaje nierozstrzygnięta, a liczby wymyślone przez model są usuwane.

### Ułatwienie i utrudnienie

Postać Game Master może wywołać test z ułatwieniem albo z utrudnieniem. Nigdy nie występują one w jednym teście naraz.

- Przy ułatwieniu aplikacja rzuca dwiema kośćmi 20-ściennymi i bierze wyższy wynik.
- Przy utrudnieniu aplikacja rzuca dwiema kośćmi i bierze niższy wynik.

Kiedy jedno z nich działa, baner pokazuje ten wariant obok DC i zaznacza, którą kość wzięto pod uwagę.

### Rzut kością z wyprzedzeniem

Własny rzut `d20` można wstawić do kolejki z menu kości jeszcze przed testem. Wtedy test umiejętności korzysta z wylosowanej liczby zamiast rzucać nową kością. Modyfikatory umiejętności i atrybutu doliczają się do niej normalnie.

## Powiązane przewodniki

- [Game Mode: walka](combat.md)
- [Game Mode: pierwsze kroki](getting-started.md)
- [Game Mode: drużyna i postacie NPC](party-and-npcs.md)
