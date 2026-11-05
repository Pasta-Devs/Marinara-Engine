# Game Mode: walki z zestawem zasad

Niektóre zestawy zasad, na przykład 5e (SRD 5.1), rozstrzygają całą bitwę według własnych zasad, zamiast udostępniać systemowi walki aplikacji Marinara Engine kilka liczb. Ten przewodnik pokazuje, jak wygląda taka walka i jak rozegrać swoją turę. Jeśli grasz według własnych zasad aplikacji Marinara Engine, zobacz [Game Mode: walka](combat.md). Wybór zestawu zasad opisuje przewodnik [Gra z zestawem zasad](rulesets.md).

Tych walk nie rozpoczynasz. Game Master (GM, mistrz gry) rozpoczyna walkę, gdy wymaga tego fabuła, jak w każdej grze. Marinara buduje ją na podstawie arkuszy postaci z drużyny i stworzeń z zestawu zasad albo z przeciwników, których GM opisuje w terminach zestawu zasad.

## Ekran walki

Ekran należy do zestawu zasad:

- **Menu** wymienia ataki i zdolności twojej postaci. Przy każdej widać, co zużywa z ekonomii akcji zestawu (tego, co możesz zrobić w każdej turze) i z jego pul (zasobów takich jak komórki zaklęć).
- **Panel poniżej** pokazuje kolejność tur, rundę, stany wszystkich uczestników pod nazwami z zestawu i to, co zostało z każdego budżetu.
- **Dziennik** wypisuje rzeczywiste obliczenia, na przykład "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit."

Każde działanie zapisuje się w arkuszu postaci w chwili, gdy dochodzi do skutku. Zamknięcie karty przeglądarki w trakcie walki niczego nie gubi, a GM dostaje potem informację, że liczby są już rozstrzygnięte.

## Rozgrywanie tury

1. Odczytaj z dziennika i panelu rundę, kolejność i swoje budżety.
2. Wybierz atak albo zdolność z menu.
3. Jeśli wymaga celu, wybierz go z listy. Na polu bitwy możesz też kliknąć cel na planszy.
4. Przeczytaj wiersz dziennika, żeby zobaczyć, co się stało.
5. Gdy nie zostało nic do zrobienia albo chcesz pominąć turę, wybierz **Pass** (pominięcie).

Jeśli nie możesz działać, akcji może celowo brakować w menu. Sprawdź te możliwości:

- Akcja kosztuje więcej, niż ci zostało. Sprawdź budżety (to, co zostało z każdej puli i akcji) w panelu.
- Akcja przekracza limit zasobu na turę. Pojawi się znowu w twojej następnej turze.
- To sposób na wyrwanie się, który widać tylko wtedy, gdy coś cię trzyma.
- Akcja wymaga celu, a nikt nie jest w zasięgu. Menu pokazuje wtedy **Nobody is in reach. Move closer.** (nikt nie jest w zasięgu; podejdź bliżej). Zobacz [Na polu bitwy](#on-a-battlefield).

Menu grupuje opcje pod takimi nagłówkami, jeśli zestaw zasad je ma:

| Grupa | Co zawiera |
| --- | --- |
| **Attacks**, **Abilities**, **Items** | Twoje ataki, zdolności i przedmioty. |
| **Standard actions** | Typowe akcje zestawu zasad. |
| **Stat block actions** | Akcje wymienione w bloku statystyk stworzenia. |
| **Contests** | Chwyty, pchnięcia i wyrywanie się (zobacz [Testy przeciwstawne](#contests)). |
| **Movement** | Chodzenie po polu bitwy (zobacz [Na polu bitwy](#on-a-battlefield)). |
| **Spend symbols** | To, co dają pozostałe symbole, w zestawie zasad z kośćmi symboli. |
| **Reload**, **Switches** | Przeładowanie i przełączniki zdefiniowane przez zestaw zasad. |
| **End of turn** | Zakończenie tury. |

## Co może obejmować tura

O tym, co mieści się w jednej turze, decyduje zestaw zasad.

- Cios może zadawać kilka rodzajów obrażeń. Każda część ma własny rzut, odporność i rzut obronny, ale całość nadal jest jednym ciosem.
- Jeden wydatek akcji może dać kilka uderzeń. Dopóki zostają, menu oferuje je bez dodatkowego kosztu i pokazuje, ile ich masz w zapasie, więc możesz uderzyć ponownie, użyć czegoś innego albo przejść między uderzeniami.
- Zdolność może nic nie kosztować, dać drugą akcję tylko na tę turę albo pozwolić na sprint, wycofanie się lub ukrycie mniejszą częścią tury.
- Coś, co twoja postać robi zawsze, na przykład dodatkowe obrażenia przy pierwszym skutecznym ciosie w turze, dodaje się samo i odnotowuje to w dzienniku.

## Stany

Stan to trwały efekt nałożony na uczestnika walki. Zależnie od zestawu zasad może utrudniać lub ułatwiać twoje rzuty obronne (rzuty na oparcie się efektowi), zmniejszać o połowę wszystkie rodzaje obrażeń, nie pozwalać ci atakować tego, kto go nałożył, ani się do niego zbliżać albo znikać, gdy tamten padnie. Może też zmieniać liczbę: dodawać do obrony, dodawać albo odejmować kości w atakach, rzutach obronnych i testach przeciwstawnych albo cię spowalniać. Dziennik pokazuje każdy taki stan obok rzutu, który zmienił, a szanse w menu go uwzględniają. Niektóre stany trwają do początku twojej następnej tury albo tylko do najbliższego ataku lub rzutu obronnego, którego dotyczą. Zestaw zasad może też liczyć coś takiego jak wyczerpanie na torze w twoim arkuszu, tak że każdy poziom nieco pogarsza sytuację, dopóki trwa.

## Zestawy z pulą kości

Zestaw zasad, którego testy polegają na rzucie garścią kości i liczeniu tych, które osiągnęły próg, walczy w ten sam sposób.

- **Ataki.** Atak rzuca twoją pulą i do trafienia potrzebuje określonej liczby sukcesów, nigdy mniej niż jednego. Każdy sukces ponad tę liczbę dodaje kość do obrażeń. Obrażenia też rzuca się kośćmi.
- **Pochłanianie.** Cel może pochłonąć część obrażeń zależnie od ich rodzaju. Pochłanianie to obrona, która albo rzuca kośćmi, z których każda odejmuje jeden punkt, albo odejmuje kości przed rzutem na obrażenia. To, co zostanie, zaznacza rany celu.
- **Kary i stany.** Twoja kara za rany odejmuje kości z twoich pul tak samo jak z testów, a stan dodaje albo odejmuje kości. Rzuty obronne i testy przeciwstawne też są pulami.
- **Dziennik** podaje, ile kości weszło do rzutu, jaki próg miały osiągnąć, ile sukcesów dały i ile odjęło pochłanianie.
- **Inicjatywa i limity.** Taki zestaw może rzucać na inicjatywę od nowa w każdej rundzie i ograniczać, ile zasobu możesz wydać w jednej turze.

Niektóre zestawy z pulą prowadzą inicjatywę jako jedną liczbę na całą walkę, którą przesuwają ataki. Przy każdym ataku wybierasz, jak go wykonać: zabrać dla siebie część liczby celu zamiast zadawać mu obrażenia albo wydać własną liczbę jako kości obrażeń. Atak z wydaniem, który trafi, resetuje twoją liczbę. Chybiony kosztuje cię tyle, ile określa zestaw. Kto spadnie do progu załamania zestawu (jego własnej dolnej granicy tej liczby), ulega załamaniu i nie może wydawać, dopóki nie dojdzie do siebie. Kolejność w każdej rundzie wynika z tych liczb, a liczba każdej postaci jest widoczna obok jej zdrowia.

Zestaw zasad, który rzuca kośćmi narracyjnymi z symbolami, na przykład system w stylu Genesys, używa ich także w walce. Przy ataku twoje kości rzuca się przeciw kościom trudności celu, symbole anulują się tak jak przy teście, a to, co pozostanie, decyduje o trafieniu. Zestaw zasad określa, co dają pozostałe symbole, więc nigdy nie pyta się o to GM.

<a id="contests"></a>

## Testy przeciwstawne

Zestaw zasad może pozwolić każdemu uczestnikowi walki rozpocząć test przeciwstawny: rzut przeciw przeciwnikowi. Możesz chwycić kogoś, przewrócić go albo odepchnąć lub wyrwać się z chwytu. Obie strony rzucają i dodają własną wartość, wygrywa wyższa suma, a menu przed wyborem pokazuje twoją szansę na wygraną.

- Wygrany chwyt unieruchamia przeciwnika, dopóki się nie wyrwie albo ty nie padniesz. Przegrany nic nie zmienia.
- Wyrwanie się jest w menu tylko wtedy, gdy coś cię trzyma, i tylko wobec tego, kto cię trzyma.
- Odepchnięcie przesuwa kogoś tylko na polu bitwy i zatrzymuje się na ścianach oraz na każdym, kto stoi na drodze.

## Odpowiadanie na cudzy ruch

Niektóre zdolności są odpowiedzią na ruch innego uczestnika walki, zamiast być używane we własnej turze. Walka zatrzymuje się, a menu oferuje twoją odpowiedź obok **Pass**, gdy:

- przeciwnik zamierza czegoś użyć,
- coś jest wymierzone w ciebie,
- atak właśnie cię trafił albo
- coś właśnie zadało ci obrażenia,

a ty masz odpowiedź na ten moment. Po trafieniu dziennik podaje wynik rzutu ataku i wartość, przeciwko której go wykonano, więc widać, czy odpowiedź taka jak Shield zamieniłaby go w chybienie. Jeśli jej użyjesz, ten sam rzut jest sprawdzany ponownie, a dziennik podaje, czy nadal trafia.

Przeciwnicy też mogą odpowiadać, na przykład własną paradą. Kontra może powstrzymać zdolność przeciwnika, zanim zadziała, niezależnie od tego, w kogo była wymierzona, o ile przeciwnik jest w zasięgu kontry. Zestaw zasad może określić, że kontra odpowiada tylko na niektóre rodzaje zdolności, na przykład zaklęcia. Koszt powstrzymanej zdolności i tak zostaje wydany, a na kontrę nic nie może odpowiedzieć.

<a id="on-a-battlefield"></a>

## Na polu bitwy

Zestaw zasad może określać, ile jedno pole planszy jest warte we własnej odległości: w stopach, krokach albo własnej jednostce. Jeżeli tak jest, a **Combat Preference** (preferowany rodzaj walki) twojej gry to **Tactical**, walka odbywa się na polu bitwy: z tymi samymi planszami (wygenerowanymi albo ręcznie wykonanymi dla danego miejsca), terenem i rozstawieniem co własna [walka taktyczna](combat.md#tactical-battles-and-terrain) aplikacji Marinara Engine. Zestaw zasad bez odległości albo gra ustawiona na **Classic** prowadzi walkę bez pozycji, a każdy może wskazać jako cel każdego.

Na polu bitwy o wszystkim decydują liczby zestawu zasad:

- Zasięg ruchu w turze wynika z reguły ruchu zestawu albo z szybkości stworzenia.
- To, jak daleko sięga albo niesie broń, wynika z jej własnych wpisów.
- Obszar zdolności staje się rzeczywistą eksplozją, stożkiem albo linią, a ściana zatrzymuje strzał.
- Stanie za czymś daje to, co według zestawu zasad daje osłona.
- Wyjście z czyjegoś zasięgu pozwala mu uderzyć, gdy zestaw zasad przypisuje takiemu uderzeniu koszt.
- Ruch odbywa się w ośmiu kierunkach po jednym polu, tak jak na planszach stołowych. To nie jest model czterech kierunków z własnej walki taktycznej aplikacji Marinara Engine.

Korzystanie z planszy:

1. Każde pole to osobny przycisk. Używaj wskaźnika albo klawiszy strzałek. Każde pole opisuje teren, to, kto na nim stoi, i koszt dojścia.
2. Wybierz **Move** (ruch). Pola, do których możesz dojść, podświetlają się z kosztem w jednostce zestawu. Droga pojawia się, gdy najedziesz na pole albo ustawisz na nim fokus. Kolor bursztynowy oznacza pole, na którego drodze ktoś by uderzył, a te osoby są wymienione pod planszą.
3. Wybierz coś, co wymaga celu. Dozwolone cele podświetlają się i możesz je kliknąć na planszy albo na liście.
4. Zdolnością obszarową wyceluj w pole. Pola, w które możesz celować, są podświetlone, a pole pod wskaźnikiem pokazuje, kogo by objęło, łącznie z sojusznikami.
5. Naciśnij <kbd>Esc</kbd>, żeby porzucić niedokończony wybór i przenieść obsługę klawiatury z powrotem do menu.

Ruch możesz wydawać przed akcją i po niej. Menu wraca z tym, co zostało, a panel pokazuje resztę jako **Movement** w jednostce zestawu.

Zestaw zasad może korzystać z większej części pola bitwy: stopniowanej osłony aż do osłony w trzech czwartych, wyższego terenu, który zmienia ataki i upadki, stworzeń, które latają, pływają, wspinają się albo ryją w ziemi, akcji **Hide** (ukrycie) i **Search** (szukanie) w menu oraz pauzy, w której przeciwnik decyduje, czy uderzyć, gdy ktoś się od niego odrywa. To, z których z tych możliwości korzysta walka, zależy od zestawu. Zestaw zasad może też pozwalać stworzeniu przeciskać się przez mniejszą przestrzeń, dosiadać wierzchowca albo ciągnąć postać, którą trzyma. Przelatywanie nad przeszkodami nie jest jeszcze zaimplementowane: latające stworzenie porusza się jak każde inne.

## Powiązane przewodniki

- [Game Mode: gra z zestawem zasad](rulesets.md)
- [Game Mode: walka](combat.md)
- [Game Mode: rzuty kośćmi i testy umiejętności](dice-and-skill-checks.md)
- [Pisanie zestawów zasad Game Mode](../extending/writing-rulesets.md)
