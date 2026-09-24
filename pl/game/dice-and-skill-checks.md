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

Obowiązują dwa sztywne limity. Możesz rzucić najwyżej 100 kośćmi naraz, a każda kość może mieć najwyżej 1000 ścianek. Jeśli poprosisz o więcej, aplikacja ograniczy żądanie do tych limitów zamiast je odrzucać, a karta wyniku pokaże ograniczoną notację: wpisanie `500d6` daje więc kartę `100d6` dla stu kości, którymi faktycznie rzucono. Jeśli tekst nie jest poprawną notacją kości, czyli `NdM` lub samym `dM`, takim jak `d20`, rzut nie powiedzie się i pojawi się błąd wskazujący wymagany format.

## Testy umiejętności

Test umiejętności sprawdza, czy ryzykowne działanie się powiedzie – skradanie, dostrzeżenie poszlaki albo przekonanie postaci NPC (postaci niezależnej). Testu umiejętności nie zaczyna się samodzielnie. Wywołuje go postać Game Master w swojej narracji. Aplikacja zamienia to na animowany rzut kością 20-ścienną z banerem wyniku.

Test zażądany w tekście zaczyna się od próby działania. Silnik rozstrzyga rzut, a następnie wykonuje jedno dodatkowe żądanie do modelu z rzeczywistymi wynikami, aby postać Game Master mogła opisać rezultat w tej samej turze. Poprawia to również szkic, który zgadywał wynik przed rzutem. Dodatkowe żądanie ponownie wysyła prompt i zużywa więcej tokenów wejściowych oraz wyjściowych. Jeśli zawiedzie, tura zachowuje rozstrzygnięte wyniki w dzienniku, bez zapisywania zgadywanego lub częściowego rezultatu. Przy turze pozostaje komunikat z przyciskiem **Regenerate turn** (wygeneruj turę ponownie), także po ponownym załadowaniu czatu.

Wyłącz **Narrate dice outcomes immediately** (natychmiast opisuj wyniki rzutów) w **Chat Settings → Function Calling**, aby zachować rzeczywiste wyniki na kolejną turę bez tego dodatkowego żądania. To ustawienie jest domyślnie włączone. Żądania, które nie prowadzą do żadnego rzeczywistego rzutu, nigdy nie uruchamiają dodatkowego żądania narracji.

Jest też trzecia możliwość: zachowanie wyniku w tej samej turze bez drugiego żądania. Zobacz niżej [Kończenie tury z rzutami jednym żądaniem](#finishing-a-rolled-turn-in-one-request).

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

Ta pula pozostaje bez zmian w grach **bez zestawu zasad**. Gra korzystająca z zestawu z pulą kości przestrzega natomiast zasad wykonywanych przez silnik; zobacz niżej [Gry z zestawem zasad](#games-that-use-a-ruleset).

Nieobsługiwane żądania, takie jak `4d6kh3`, `3d6!` lub `4dF`, nie powodują rzutu. Silnik zapisuje nieobsługiwaną notację w logu i usuwa wymyślone liczby z rekordów testów. Te wyniki pozostają nierozstrzygnięte; silnik nie podmienia po cichu systemu kości.

### Ułatwienie i utrudnienie

Postać Game Master może wywołać test z ułatwieniem albo z utrudnieniem. Nigdy nie występują one w jednym teście naraz.

- Przy ułatwieniu aplikacja rzuca dwiema kośćmi 20-ściennymi i bierze wyższy wynik.
- Przy utrudnieniu aplikacja rzuca dwiema kośćmi i bierze niższy wynik.

Jeśli GM poprosi o oba naraz, aplikacja pozostawia test bez zmian zamiast zgadywać jego zamiar; nie pojawi się dla niego baner.

Kiedy jedno z nich działa, baner pokazuje ten wariant obok DC i zaznacza, którą kość wzięto pod uwagę.

### Rzut kością z wyprzedzeniem

Własny rzut `d20` można wstawić do kolejki z menu kości jeszcze przed testem. Wtedy test umiejętności korzysta z wylosowanej liczby zamiast rzucać nową kością. Modyfikatory umiejętności i atrybutu doliczają się do niej normalnie.

<a id="games-that-use-a-ruleset"></a>

## Gry z zestawem zasad

Zestaw wybiera się raz przy tworzeniu gry w polu **Rules**; zobacz [Wybór zasad](getting-started.md#choosing-rules). Gra bez zestawu zachowuje opisane wyżej reguły, w tym proste pule sukcesów bez eksplodujących kości i innych reguł specjalnych.

- GM podaje umiejętność lub rzut obronny oraz trudność według skali zestawu. Ta skala może przekraczać zakres 1–40; awaryjne rozliczanie testu zaległego w zapisanej turze nadal używa 1–40.
- Silnik rzuca kośćmi zestawu. Modyfikator bierze z jego arkusza: cechy, wyszkolenia (wielokrotność premii biegłości, stała wartość lub oba składniki) i dodatkowej premii. Nie używa wbudowanych atrybutów ani premii umiejętności.
- `who="Name"` wskazuje członka drużyny; brak `who` oznacza gracza. Członek bez arkusza używa wartości domyślnych. Nieznana lub niejednoznaczna nazwa daje rzut bez modyfikatora. Wyjątkiem jest imię persony: zawsze wskazuje gracza, nawet gdy ktoś w drużynie ma to samo imię. Silnik nigdy nie pożycza cudzego arkusza.
- Wyniki naturalne zależą od zestawu. W 5e (SRD 5.1) naturalne 20 i 1 nie mają specjalnego skutku w testach i rzutach obronnych; naturalne 20 może więc nie wystarczyć.
- Liczby wpisane przez GM są sprawdzane. Błędny modyfikator, liczba lub rodzaj kości, wybrana kość albo nieobsługiwany wynik naturalny powodują ponowny rzut i zastąpienie wyniku.
- Wcześniejszy własny rzut jest używany tylko przy pojedynczej d20. Inne kości, np. 2d6 lub pula, są rzucane od nowa.
- `with="Ability"` pozwala użyć innej cechy zadeklarowanej przez zestaw dla testu lub rzutu obronnego. Nieznana cecha jest ignorowana. Znaczniki rzutów mogą nazywać cechy, umiejętności, rzuty obronne i `PROF`, jeśli zestaw ma premię biegłości.
- Brak pakietu lub zbyt stara wersja pozostawia test bez liczb jako zaległy. Silnik nie zastępuje zasad innym systemem. Zasoby, stany i odpoczynki opisuje [Arkusz zestawu zasad](party-and-npcs.md#the-ruleset-sheet).

- Gdy coś w arkuszu zmienia rzut, np. talizman pozwalający ponownie rzucić nieudanymi kośćmi, GM wskazuje to przy teście. Silnik pobiera koszt, stosuje efekt i rzuca. Niewybrany talizman lub taki, którego kosztu nie da się zapłacić, nie działa i nic nie kosztuje.
- Jeżeli zestaw pozwala wydać zasób na poprawę testu, GM wskazuje to przy teście. Silnik pobiera punkty, dodaje kupiony efekt i rzuca. Gdy zasobu nie wystarcza, nic nie zostaje wydane, a rzut przebiega normalnie. Dziennik pokazuje rzeczywiście zapłaconą wartość, a nie żądaną.
- Jeżeli zestaw ma tor ran z karą do rzutów, obrażenia utrudniają każdy test. Zestaw z pulą odejmuje tyle kości, nie schodząc poniżej dozwolonego minimum, które w niektórych systemach wynosi zero. Zestaw sumujący kości stosuje stałą karę do rzutu. Test pokazuje jej wartość, aby było jasne, dlaczego kości jest mniej. Zobacz [Arkusz zestawu zasad](party-and-npcs.md#the-ruleset-sheet).

### Zestawy z pulą kości

W takim zestawie wynik arkusza określa liczbę kości: cecha 3 i umiejętność 2 dają pięć kości. Edytor i tekst dla GM pokazują "5 dice" zamiast "+5". Trudność oznacza liczbę wymaganych sukcesów, np. trzy, a nie sumę 15.

Silnik ustala wyniki według zestawu: próg sukcesu, podwójne sukcesy, eksplozje, odejmowanie sukcesów przez niskie wyniki, pech i wyjątkowy sukces. Karta pokazuje wszystkie kości, wyróżnia udane wyniki i porównuje sukcesy z wymaganą liczbą. Duże pule przechodzą do kolejnych wierszy bez zmniejszania kości; nie pojawia się fikcyjna suma.

GM może zmienić próg pojedynczej kości lub liczbę kości za okoliczności tylko w granicach zestawu. Wynik puli wymyślony przez model zawsze zastępuje rzeczywisty rzut. Przewaga, wcześniejszy własny rzut i pokazywane GM kości d20 nie dotyczą tych testów: silnik rzuca pulą w ciemno.

<a id="finishing-a-rolled-turn-in-one-request"></a>

## Kończenie tury z rzutami jednym żądaniem

Domyślnie tura z rzutem kosztuje dwa żądania do modelu: jedno na szkic i drugie na przepisanie wyniku z prawdziwymi liczbami. **Finish rolled turns in one request** (kończenie tur z rzutami jednym żądaniem) w **Chat Settings → Function Calling** usuwa drugie. Domyślnie jest wyłączone i dotyczy tylko czatu, w którym je włączysz.

GM ustala tekst, zanim powstanie jakakolwiek liczba. Nie widzi rzutu przed wyborem zdarzeń, więc nie może dopasować wyniku do otrzymanej kości. Silnik rzuca później i zapisuje własny wynik.

Po włączeniu GM wybiera jeden z trzech sposobów zapisu testu zależnie od rodzaju wyniku.

**Przy dwóch możliwych wynikach pisze oba.** Po teście bez liczb umieszcza blok z tekstem sukcesu i porażki. Silnik rzuca, zachowuje wybraną połowę i usuwa drugą, zanim przeczytasz turę. Widzisz jeden wynik, tak jak po rzucie wykonanym najpierw.

**Gdy wynikiem jest tylko liczba, wpisuje znacznik i pisze dalej.** Obrażenia, leczenie, złoto, czas, liczba sztuk czy odległość: GM wpisuje w zdaniu `[[roll: 2d6+3]]`, a silnik zastępuje to liczbą. Znacznik może zamiast wartości wskazywać modyfikator arkusza, np. `[[roll: 1d8+STR]]`; silnik sam go doda. Ten zapis jest dostępny tylko wtedy, gdy gra ma arkusz do odczytu. Nieznana nazwa powoduje odrzucenie, a nie przyjęcie zera. Najedź na wstawioną liczbę, aby zobaczyć kości; każdy rzut ma też osobny wiersz w **Logs** (dziennikach).

**Gdy sama liczba wybiera co najmniej trzy wyniki, pyta o nią i zatrzymuje tekst.** To taki sam krótki test lub żądanie `[dice:]` jak dotąd. Silnik rzuca i zapisuje wynik, a tura kończy się bez opisu skutku. GM opisuje jego znaczenie na początku następnej tury, tak jak przy wyłączonym **Narrate dice outcomes immediately**.

Test niemieszczący się w tych formach używa tego samego zachowania awaryjnego: nic nie pozostaje bez rzutu i nic nie jest wymyślane.

Przed włączeniem pamiętaj:

- **Narrate dice outcomes immediately nie działa, gdy ta opcja jest włączona.** Przełącznik pozostaje widoczny, ale nieaktywny, z wyjaśnieniem. Zapisana wartość zostaje; po wyłączeniu tur z jednym żądaniem wraca wcześniejsze ustawienie.
- **Istniejące tury nie zmieniają się.** Opcja dotyczy tylko generowanych później tur i nie przerabia zapisanej historii.
- **W dwóch przypadkach tura nadal może kosztować kilka żądań.** Gdy **Enable Tool Use** jest włączone, a narzędzie kości znajduje się na liście, GM nadal może je wywołać, co kosztuje pełną dodatkową rundę. **Game tool connection** inne niż **Same as narrator** zawsze wykonuje własne żądanie planowania. Żaden z tych przypadków nie jest przepisywaniem wyniku, które usuwa ta opcja.
- **Dowiesz się, gdy czegoś nie da się rzucić.** Nieczytelna liczba zostaje zastąpiona krótkim komunikatem, nie wymyśloną wartością. Nieczytelny blok pozostawia zapisany rzut i usuwa oba teksty. W obu przypadkach **Logs** podaje, co pominięto.
- **W trakcie pisania** znaczniki i bloki rozgałęzień są ukryte w strumieniu tekstu. Nie zobaczysz liczby, która później się zmieni. Gotowe zdanie pojawi się po zakończeniu tury.

### Pokazanie GM jednej kości każdego rozmiaru

Poniżej znajduje się **Let the Game Master see one die of each size** (pozwól GM zobaczyć jedną kość każdego rozmiaru), także domyślnie wyłączone. Obsługuje przypadek, którego nie obejmują dwa sposoby zapisu w ciemno: liczba wybiera co najmniej trzy wyniki, np. margines sukcesu, pozycję w tabeli trafień lub rzut reakcji. Bez tej opcji taki test kończy turę, a narracja czeka do początku następnej.

Po włączeniu silnik przed turą rzuca jedną kością każdego standardowego rozmiaru i pokazuje GM następną wartość każdej z nich. GM może zużyć jedną i opisać jej znaczenie w tym samym przebiegu.

**Uważnie przeczytaj ten kompromis.** GM widzi liczbę, zanim wybierze test i jego trudność. Może więc kierować wynikiem w sposób niemożliwy przy formach pisanych w ciemno: wybrać trudność osiągalną dla znanej kości albo nie zażądać testu, gdy trzyma słabą wartość. Silnik nie umie ocenić, czy trudność pasuje do fabuły, więc nie może tego wykryć. Gracz, który nie wie, że GM widział kości, może uznać podejrzanie bohaterską sesję za szczęście.

Niezależnie od współpracy GM silnik wymusza:

- **Wartości są wydawane po kolei i tylko raz.** Silnik posiada kolejkę i wydaje następną wartość niezależnie od tekstu tury.
- **Każda zapisana liczba pochodzi z silnika.** Rzut, modyfikator, suma i wynik są przeliczane z kolejki i arkusza. Niezgodna liczba GM zostaje zastąpiona, a **Logs** to odnotowuje.
- **Trudność ma granice.** Pozostaje w zakresie 1–40, czego wcześniej nie wymagano od testów zapisanych w tekście. Gra z zestawem zasad może zamiast tego wykorzystać jego skalę trudności.
- **Ponowne pytanie nie poprawia szczęścia.** Swipe, ponowna generacja i kontynuacja tej samej tury dostają te same wartości; nie można ponawiać rzutów aż do dobrego wyniku.
- **Widoczna jest tylko następna wartość każdego rozmiaru.** Steruje tym **Values shown per size** (wartości pokazywane dla rozmiaru), domyślnie 1. Dalsze rzuty tego samego rozmiaru w turze pozostają niewidoczne i są opisywane dopiero w następnej turze.
- **Nieużywana kość po pewnym czasie jest rzucana ponownie.** Steruje tym **Rethrow after idle turns** (ponowny rzut po nieużywanych turach), domyślnie 3. Inaczej niska liczba mogłaby zajmować przód kolejki przez cały czat, gdy GM unika tego rozmiaru. Wartość 0 wyłącza ponawianie i znów pozwala na takie zachowanie.
- **Żądanie ponad zapas nie daje rzutu.** Test zachowuje pytanie, traci liczby i jest opisywany w następnej turze. **Logs** wskazuje turę, w której to nastąpiło.

## Powiązane przewodniki

- [Game Mode: walka](combat.md)
- [Game Mode: pierwsze kroki](getting-started.md)
- [Game Mode: drużyna i postacie NPC](party-and-npcs.md)
