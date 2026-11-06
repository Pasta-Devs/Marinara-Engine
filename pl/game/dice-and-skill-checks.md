# Game Mode: rzuty kośćmi i testy umiejętności

Przycisk z kością pozwala w trybie Game Mode rzucać kośćmi dla postaci Game Master (GM, mistrz gry). Ten przewodnik pokazuje też, jak GM przeprowadza test umiejętności przeciwko poziomowi trudności (DC, Difficulty Class), czyli liczbie, którą rzut musi osiągnąć albo przebić.

## Rzucanie kośćmi

Pasek wpisywania wiadomości ma przycisk z kością. Jego podpowiedź to **Roll dice** (rzut kośćmi).

1. Kliknij przycisk z kością, żeby otworzyć szybkie menu kości.
2. Kliknij preset: d20, d6, 2d6, d10, d100, d4, d8 albo d12.
3. W pasku wpisywania pojawia się kafelek, na przykład `🎲 d20`. Rzut trafia do kolejki i nie jest jeszcze wysłany.
4. Wyślij wiadomość. Marinara rzuca i dokleja wynik na końcu wiadomości jako znacznik, który GM czyta i wokół którego buduje narrację.

Żeby usunąć rzut z kolejki przed wysłaniem, kliknij **Clear queued roll** (usunięcie rzutu z kolejki) na kafelku.

Pojedyncza kość bez premii wygląda tak:

```text
[dice: d20 = 14]
```

Rzut kilkoma kośćmi albo rzut z premią pokazuje też części składowe:

```text
[dice: 3d8+2 = 18 (4, 6, 6 +2)]
```

GM może też zażądać rzutu w narracji przez `[dice: 3d8+2]`. Marinara podaje rzeczywiste liczby i pokazuje tę samą animowaną kartę. Działa to na połączeniach obsługujących wyłącznie tekst, w tym na subskrypcjach Claude i Grok. Gdy GM rzuca kilka razy w jednej turze, każda karta rzutu czeka na swoją kolej: zamknij jedną, żeby zobaczyć następną. Wszystkie rzuty zapisują się w aktywnym swipe'ie (alternatywnej odpowiedzi) tej tury i pozostają w **Logs** (dzienniku) po ponownym załadowaniu. Kontynuowanie tury zachowuje jej wcześniejsze rzuty. Ponowne generowanie tworzy nowy zestaw dla nowego swipe'a.

## Własny rzut kośćmi

Menu kości ma pole tekstowe na własny rzut w zapisie `NdM`: `N` kości, z których każda ma `M` ścianek, z opcjonalną premią albo karą na końcu. Pole pokazuje przykład `3d8+2` (trzy kości 8-ścienne, dodaj 2).

1. Otwórz menu kości.
2. Wpisz zapis, na przykład `2d6+1`.
3. Naciśnij <kbd>Enter</kbd> albo kliknij przycisk z samolocikiem. Rzut trafia do kolejki jako kafelek.

| Zapis | Znaczenie |
| --- | --- |
| `d20` | Jedna kość 20-ścienna |
| `4d8-1` | Cztery kości 8-ścienne, odejmij 1 |
| `4d6kh3` | Rzuć czterema kośćmi 6-ściennymi, zachowaj trzy najwyższe |
| `2d20kl1` | Zachowaj najniższą: rzut z utrudnieniem |
| `4d6dl1+2` | Odrzuć najniższą kość, dodaj 2 |

`kh` i `kl` zachowują najwyższe albo najniższe kości. `dh` i `dl` je odrzucają. Zapisuje się każdą rzuconą kość, a sumuje się tylko zachowane.

Jeśli to nie zadziałało: tekst, który nie jest zapisem `NdM` ani samym `dM`, opcjonalnie z następującym po nim `kh`, `kl`, `dh` lub `dl` i liczbą, kończy się błędem, który podaje oczekiwany format.

Możesz rzucić najwyżej 100 kośćmi naraz, a każda kość może mieć najwyżej 1000 ścianek. Zwykły rzut powyżej tych limitów zostaje do nich przycięty, a karta pokazuje przyciętą notację, więc `500d6` daje kartę `100d6`. Rzut z zachowywaniem lub odrzucaniem kości powyżej limitów, taki jak `101d6kh3`, zostaje odrzucony z błędem przekroczenia zakresu, ponieważ przycięcie zmieniłoby to, które kości zostają zachowane.

<a id="skill-checks"></a>

## Testy umiejętności

Test umiejętności sprawdza coś ryzykownego, na przykład skradanie, dostrzeżenie poszlaki albo przekonanie postaci NPC (postaci niezależnej). Testu nie zaczynasz samodzielnie. GM wywołuje go w swojej narracji, a Marinara zamienia go w animowany rzut d20 z banerem wyniku. Baner pokazuje umiejętność i liczbę do osiągnięcia, na przykład **Stealth Check** (test skradania) z **DC 15**. Każdy rozstrzygnięty test dostaje osobny baner, po kartach rzutów czekających w kolejce.

<a id="how-the-result-is-decided"></a>

### Jak liczy się wynik

Test rzuca jedną kością d20 i dodaje dwa modyfikatory:

- Modyfikator umiejętności, wyliczony z poziomu umiejętności, jaki gra prowadzi dla twojej postaci. Jeśli gra nie ma jeszcze poziomu dla tej umiejętności, wynosi 0.
- Modyfikator atrybutu, wyliczony z atrybutu przypisanego do umiejętności. Każda umiejętność ma automatycznie przypisany jeden atrybut: Stealth korzysta z Dexterity, Perception z Wisdom, a Persuasion z Charisma. Umiejętność, której Marinara nie rozpoznaje, korzysta z Intelligence.

W grze z klasami **MRPG** modyfikator atrybutu pochodzi zamiast tego ze statystyk MRPG postaci, które daje jej aktywna klasa (zobacz [Klasy MRPG](mrpg-classes.md)). Ewentualne atrybuty Legacy pozostawione na ulepszonej karcie nie są używane. Każda umiejętność opiera się na jednej statystyce:

| Statystyka | Umiejętności |
| --- | --- |
| Strength | Athletics, Intimidation |
| Speed | Acrobatics, Stealth |
| Skill | Sleight of Hand, Investigation, Perception, Medicine, Survival, Animal Handling i każda umiejętność niewymieniona tutaj |
| Defense | Endurance, Constitution |
| Magic | Arcana, History, Nature, Intelligence |
| Resistance | Insight, Religion, Wisdom |
| Luck | Persuasion, Deception, Performance, Charisma |

Test dodaje jedną trzecią tej statystyki, zaokrągloną w dół, minus jeden. Oznacza to około +1 lub +2 dla najlepszej statystyki nowej postaci, +3 lub +4 na poziomie 10 oraz +8 na najwyższym poziomie.

Jeśli suma osiągnie DC albo je przebije, test się udaje. Dwa wyniki rzutu unieważniają liczenie:

- Naturalna 20 to **CRITICAL SUCCESS** (sukces krytyczny) i zawsze oznacza zdany test.
- Naturalna 1 to **CRITICAL FAILURE** (porażka krytyczna) i zawsze oznacza niezdany test.

Baner pokazuje **CRITICAL SUCCESS**, **SUCCESS** (sukces), **FAILURE** (porażka) albo **CRITICAL FAILURE**.

### Ułatwienie i utrudnienie

GM może wywołać test z ułatwieniem (rzut dwiema kośćmi d20, liczy się wyższy wynik) albo z utrudnieniem (liczy się niższy). Baner pokazuje ten wariant obok DC i zaznacza, której kości użyto. Jeśli GM poprosi o oba naraz, Marinara zostawia ten test bez zmian zamiast zgadywać, więc nie dostajesz dla niego banera.

### Własny rzut d20 z wyprzedzeniem

Zanim dojdzie do testu, dodaj do kolejki `d20` z menu kości. Test użyje wtedy twojej liczby zamiast rzucać nową kością. Modyfikatory umiejętności i atrybutu nadal się doliczają.

Jak GM kończy turę po rzucie i ile to kosztuje, opisuje część [Jak opisywana jest tura z rzutem](#how-a-rolled-turn-is-narrated).

<a id="games-that-use-a-ruleset"></a>

### Gry z zestawem zasad

W grze z zestawem zasad, na przykład 5e (SRD 5.1), testy korzystają z kości, skali trudności i modyfikatorów arkusza postaci określonych przez zestaw, a w niektórych zestawach zasad – z puli kości lub kości z symbolami. Zobacz [Testy z zestawem zasad](rulesets.md#checks-on-a-ruleset).

## Szczegóły

<a id="how-a-rolled-turn-is-narrated"></a>

### Jak opisywana jest tura z rzutem

Gdy GM wywołuje test w tekście, Marinara rozstrzyga rzut i ma trzy sposoby dokończenia wyniku. Wszystkie trzy są w **Chat Settings → Function Calling**.

| Ustawienie | Domyślnie | Co się dzieje |
| --- | --- | --- |
| **Finish rolled turns in one request** (kończenie tur z rzutami jednym żądaniem) | On | Jedno żądanie. GM pisze wynik bez liczb, a Marinara je uzupełnia. Zobacz niżej. |
| **Narrate dice outcomes immediately** (natychmiast opisuj wyniki rzutów) | On | Dwa żądania. GM pisze szkic, Marinara rzuca, a potem kolejne żądanie ponownie wysyła prompt z rzeczywistymi wynikami, żeby GM dokończył wynik w tej samej turze. Kosztuje to więcej tokenów wejściowych i wyjściowych. |
| Oba wyłączone | | Rzeczywiste wyniki zostają zachowane na następną turę, bez dodatkowego żądania. |

Przy **Narrate dice outcomes immediately**, jeśli dodatkowe żądanie się nie powiedzie, tura zachowuje rozstrzygnięte wyniki w dzienniku, bez zapisywania zgadywanego lub częściowego wyniku. Przy turze pozostaje komunikat z przyciskiem **Regenerate turn** (wygeneruj turę ponownie), także po ponownym załadowaniu. Żądanie bez żadnego rzeczywistego rzutu nigdy nie uruchamia dodatkowego żądania.

Na połączeniu obsługującym narzędzie kości GM może zamiast tego uzyskać rzeczywisty rzut już podczas generowania. Karta rzutu pojawia się, gdy tylko narzędzie zwróci wynik, a zakończony test zapisuje ten wynik bez ponownego rzucania.

<a id="finishing-a-rolled-turn-in-one-request"></a>

#### Kończenie tury z rzutami jednym żądaniem

Bez tej opcji tura z rzutem kosztuje dwa żądania. **Finish rolled turns in one request** usuwa drugie. Opcja jest domyślnie włączona. Wyłącz ją w czacie, żeby zamiast tego ten czat przepisywał każdą turę z rzutem z rzeczywistymi liczbami.

Działa to, bo GM ustala swój tekst, zanim powstanie jakakolwiek liczba. Nigdy nie widzi rzutu, zanim zdecyduje, co się dzieje, więc nie może sterować wynikiem. Marinara rzuca dopiero potem i sama zapisuje wynik. Gdy przełącznik jest włączony, GM zapisuje test na jeden z trzech sposobów:

- **Dwa wyniki.** GM pisze test bez liczb, a potem wiersz sukcesu i wiersz porażki. Marinara rzuca, zachowuje połowę wybraną przez rzut i usuwa drugą, zanim przeczytasz turę.
- **Tylko liczba.** Przy obrażeniach, leczeniu, złocie, czasie trwania, liczbie sztuk albo odległości GM wpisuje w środku zdania znacznik, na przykład `[[roll: 2d6+3]]`, a Marinara wstawia w jego miejsce liczbę. Znacznik może wskazywać modyfikator arkusza, jak w `[[roll: 1d8+STR]]`. Ta forma jest dostępna tylko wtedy, gdy gra ma arkusz do odczytu, a nazwa, której Marinara nie umie rozpoznać, zostaje odrzucona, a nie potraktowana jako zero. Najedź na liczbę ze znacznika, żeby zobaczyć jej kości. Każda taka liczba pojawia się też w **Logs** jako osobny wiersz rzutu.
- **Trzy lub więcej zakończeń.** GM prosi o wartość i przerywa pisanie. Marinara rzuca i zapisuje wynik, tura kończy się bez opisu skutku, a GM opisuje znaczenie liczby na początku następnej tury.

Test zapisany w żadnej z tych form przechodzi na ostatnie z tych zachowań, więc nic nie pozostaje nierozstrzygnięte i nic nie jest wymyślane.

- **Narrate dice outcomes immediately** nie jest używane, gdy ta opcja jest włączona. Pozostaje widoczne, ale nieaktywne, a jego zapisana wartość zostaje zachowana na czas, gdy tę opcję wyłączysz.
- Istniejące tury się nie zmieniają. Przełącznik dotyczy tylko tur wygenerowanych po jego włączeniu.
- Tura nadal może kosztować więcej niż jedno żądanie w dwóch przypadkach: gdy **Enable Tool Use** (zezwolenie na korzystanie z narzędzi) jest włączone, a narzędzie kości jest na twojej liście narzędzi (wywołanie narzędzia kosztuje pełną dodatkową rundę), albo gdy **Game tool provider** (dostawca dla narzędzi gry) jest ustawiony na coś innego niż **Same as narrator** (takie samo jak narrator), bo wtedy zawsze wykonuje się żądanie planowania.
- Gdy czegoś nie da się rzucić, liczbę zastępuje krótki komunikat, a nigdy wymyślona wartość. **Logs** podaje, co pominięto.
- Podczas pisania tury znaczniki i bloki rozgałęzień są wstrzymywane w strumieniowanym tekście, więc nigdy nie widzisz, jak liczba się zmienia.

<a id="symbol-dice-by-name"></a>

### Kości symboliczne po nazwie

W grze, której zestaw zasad rzuca kośćmi symbolicznymi (zestaw `symbol-pool`, na przykład system w stylu Genesys), pole własnego rzutu przyjmuje też nazwy tych kości. Dla każdego rodzaju podaj liczbę i nazwę kości, na przykład `2 ability 1 proficiency vs 2 difficulty`. Nazwą może być identyfikator kości lub jej etykieta, bez rozróżniania wielkości liter, a rodzaje oddziela się spacjami, przecinkami, `+` lub `vs`. Rzut może wskazywać najwyżej 40 kości.

Karta pokazuje każdą kość z symbolami na jej ściance, następnie symbole pozostałe po anulowaniu oraz informację, czy oznacza to sukces. Znacznik w wiadomości zawiera to samo, na przykład `[dice: 2 ability vs 1 difficulty = 1 Success, 1 Advantage; success]`. Narzędzie kości GM też przyjmuje te nazwy. Zwykły zapis `NdM` nadal działa w każdej grze.

### Inne kości w teście umiejętności

GM może podać inny zapis, na przykład `[skill_check: skill="Endurance" dc="12" dice="3d6+2"]`. Takie testy korzystają ze stałego modyfikatora z zapisu zamiast modyfikatorów d20 z arkusza i kończą się sukcesem, gdy suma osiągnie DC. Zasady naturalnej 1 i naturalnej 20 dotyczą tylko standardowego testu d20.

Pula sukcesów musi podawać zarówno próg dla pojedynczej kości, jak i wymaganą liczbę sukcesów: `[skill_check: skill="Intimidation" dc="4" dice="6d10" resolution="successes" threshold="6"]` rzuca sześcioma kośćmi d10, liczy każdą kość z wynikiem co najmniej 6 i kończy się sukcesem przy co najmniej czterech. Marinara nie zgaduje brakującego progu ani nie obsługuje eksplodujących kości, pechów czy innych specjalnych zasad puli. Pula bez poprawnego progu pozostaje nierozstrzygnięta, a wymyślone liczby są usuwane.

Taką pulę dostaje gra bez zestawu zasad. Gra z zestawem zasad opartym na pulach kości działa inaczej: zobacz [Testy z zestawem zasad](rulesets.md#checks-on-a-ruleset).

Atrybut `dice=` testu przyjmuje tylko zwykły zapis `NdM`. Żądania takie jak `4d6kh3`, `3d6!` lub `4dF` nie powodują rzutu: Marinara zapisuje nieobsługiwaną notację w logu i usuwa wymyślone liczby, a wynik pozostaje otwarty.

### Pokazanie GM jednej kości każdego rozmiaru

**Let the Game Master see one die of each size** (pozwól GM zobaczyć jedną kość każdego rozmiaru) znajduje się pod **Finish rolled turns in one request**. Domyślnie jest wyłączone. Obsługuje jeden przypadek, którego nie obejmują formy pisane w ciemno: liczbę, która musi wybrać jedno z co najmniej trzech zakończeń, na przykład margines sukcesu albo tabelę miejsc trafienia. Bez tej opcji taki test kończy turę i jest opisywany w następnej turze.

Po włączeniu Marinara przed turą rzuca jedną kością każdego standardowego rozmiaru i pokazuje GM następną wartość każdej z nich, żeby GM mógł opisać jej znaczenie w tym samym przebiegu.

> **Ostrzeżenie:** GM widzi wtedy liczbę, zanim zdecyduje, co testować i jak trudny ma być test. Może wybrać trudność, którą pokona kość, jaką trzyma, albo unikać wywołania testu, gdy trzyma słabą liczbę. Marinara nie umie ocenić, czy trudność pasuje do fabuły, więc nie może tego wykryć. Podejrzanie bohaterska sesja może być efektem naginania szczęścia.

Niezależnie od współpracy GM Marinara wymusza:

- Wartości są wydawane po kolei i żadna nie pada dwa razy.
- Każda liczba w zapisie pochodzi od aplikacji Marinara. Rzut, modyfikator, suma i wynik są przeliczane z kolejki i twojego arkusza. Niezgodna liczba zostaje zastąpiona, a **Logs** to odnotowuje.
- Trudność pozostaje w zakresie od 1 do 40. Gra z zestawem zasad może sięgać tak daleko, jak skala trudności jej zestawu.
- Swipe, ponowne generowanie i kontynuacja tej samej tury dostają te same wartości, więc nie da się ponawiać rzutów dla szczęścia.
- **Values shown per size** (wartości pokazywane dla rozmiaru) określa, ile wartości każdego rozmiaru widzi GM. Domyślnie 1. Dalsze rzuty tego rozmiaru w jednej turze pozostają niewidoczne i są opisywane w następnej turze.
- **Rethrow after idle turns** (ponowny rzut po nieużywanych turach, domyślnie 3) ponownie rzuca niewykorzystaną kością po tylu turach. Bez tego niska wartość mogłaby stać na przodzie kolejki przez resztę czatu. Ustaw 0, żeby wyłączyć ponowne rzucanie.
- Jeśli GM poprosi o więcej rzutów, niż mieści kolejka, test zachowuje pytanie, traci wszystkie liczby i jest opisywany w następnej turze. **Logs** podaje, w której turze to nastąpiło.

## Powiązane przewodniki

- [Game Mode: gra z zestawem zasad](rulesets.md)
- [Game Mode: walka](combat.md)
- [Game Mode: pierwsze kroki](getting-started.md)
- [Game Mode: drużyna i postacie NPC](party-and-npcs.md)
