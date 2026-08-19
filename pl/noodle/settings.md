# Ustawienia Noodle i przeniesienie do czatów

Ten przewodnik omawia panel **Noodle settings** (ustawienia Noodle) sekcja po sekcji, razem z każdą wartością domyślną i każdym limitem. Wyjaśnia też, jak połączyć Noodle z czatami. Służą do tego dwie funkcje: **Carryover to chats** (przeniesienie do czatów) oraz przełącznik **Allow Noodle references** (zezwolenie na odwołania do Noodle) ustawiany osobno dla każdego czatu. Działają w przeciwnych kierunkach.

Noodle to wbudowana w aplikację Marinara Engine oś czasu w stylu mediów społecznościowych. Na początek przeczytaj przewodnik [Noodle: wbudowana oś czasu społecznościowa](overview.md). Persona to postać, w którą się wcielasz na czacie. Połączenie to zapisany skrót do dostawcy AI, który generuje tekst lub obrazy. Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

## Otwieranie panelu ustawień Noodle

1. Otwórz Noodle z górnego paska.
2. Na pasku bocznym po lewej kliknij przycisk **Settings** (Ustawienia) z ikoną koła zębatego.
3. W nagłówku panelu widnieje napis **Noodle settings**.

Wszystkie ustawienia Noodle są globalne. Obejmują każdą personę i każdy czat, a nie pojedynczy czat. Zmiany zapisują się od razu.

## NoodleR Access

- **Enable NoodleR** (włączenie NoodleR): przełącznik, domyślnie **off**. Włącz go, żeby odsłonić centrum kont NoodleR. Dopóki jest wyłączony, otwarcie NoodleR pokazuje ekran zgody, zapytania o konta NoodleR są niedostępne, a dane kont NoodleR pozostają oddzielone od osi czasu Noodle.

NoodleR i Noodle to dwie osobne symulowane aplikacje, a każde konto należy dokładnie do jednej z nich. Ten podział trzyma treści NoodleR z dala od osi czasu Noodle, ale **nie** jest funkcją prywatności ani zabezpieczeniem. Tak czy inaczej wszystko zostaje na tym urządzeniu i każdy, kto ma dostęp do aplikacji lub jej folderu z danymi, może to przeczytać. To, kto może przeczytać konkretny wpis w NoodleR, ustawia się osobno dla każdego wpisu – zobacz sekcję **Subscriptions and post access** poniżej.

Ekran **Manage stage profiles** (zarządzanie profilami scenicznymi), dostępny przez **Noodle Settings** > **NoodleR Access**, wypisuje profile sceniczne dostępne w tej instalacji, razem ze stanami wczytywania, błędu i pustej listy. Profil sceniczny należy do jednej publicznej persony albo do konta postaci, ale ma własną nazwę, własny identyfikator, opis, głos sceniczny i tryb ujawniania. Konta NoodleR utworzone przed wprowadzeniem profili scenicznych pokazują **Setup needed**, dopóki ich profil nie zostanie uzupełniony.

### Ujawnianie tożsamości scenicznej

Ujawnianie decyduje o tym, jak powiązana publiczna tożsamość może pojawić się w profilu scenicznym i we wpisie wygenerowanym przez AI. Nie decyduje o tym, kto może zobaczyć profil albo wpis.

- **Publicly connected (Open)**: profil sceniczny może otwarcie być tą samą osobą. Generowany tekst i prompty obrazów mogą używać powiązanej publicznej nazwy, identyfikatora i rozpoznawalnej ciągłości.
- **Inspired alter ego (Hinted)**: ogólna osobowość, zainteresowania i motywy mogą się przenieść, ale dokładna publiczna nazwa i identyfikator znikają z kontekstu generowania, a przed zapisem wpisu są odfiltrowywane z wygenerowanego tekstu i promptów obrazów. Charakterystyczne cechy nadal mogą wydawać się rozpoznawalne. Na profilu twórcy najedź kursorem na plakietkę **Hinted**, zaznacz ją klawiaturą albo dotknij, żeby odsłonić powiązaną tożsamość Noodle.
- **Separate persona (Secret)**: powiązana tożsamość służy wyłącznie jako poufna inspiracja przy pisaniu. Generowanie profilu dostaje skrócony, nieidentyfikujący opis i omija kanoniczne zawody, relacje, miejsca, charakterystyczne powiedzonka i wyróżniające szczegóły. Dokładne identyfikatory są dodatkowo odfiltrowywane z wygenerowanego wyniku. To nie jest formalna gwarancja anonimowości, więc przejrzyj wersję roboczą przed zapisaniem.

Użyj przycisku **New profile** na ekranie **Manage stage profiles**, żeby wyszukać i wybrać pasującą postać albo personę. Konfiguracja wyjaśnia następnie zasady ujawniania i prosi o wybór Open, Hinted albo Secret, zanim pokaże edytowalny formularz profilu scenicznego. Formularz można wypełnić samodzielnie albo poprosić AI o wersję roboczą przygotowaną na podstawie postaci źródłowej, wybranego trybu ujawniania i opcjonalnych wskazówek. AI nigdy nie zapisuje wersji roboczej automatycznie – przejrzyj pola i samodzielnie wybierz **Save stage profile**. Otwórz istniejący profil i wybierz **Edit profile**, żeby zmienić jego prezentację albo ponownie wypełnić bieżącą wersję roboczą przy pomocy AI. Profile z trybem Hinted pokazują odwiedzającym tylko wyświetlaną nazwę i identyfikator powiązanej tożsamości, i to wyłącznie przez celową podpowiedź na plakietce; nie ujawniają identyfikatora konta. Profile z trybem Secret nie ujawniają odwiedzającym żadnych danych powiązanej tożsamości.

### Wpisy NoodleR z pomocą AI

Każdy profil sceniczny ma wbudowane, zwinięte pole tworzenia wpisów NoodleR. Wpisz opcjonalny tytuł i treść, a potem wybierz **Post**, żeby opublikować dokładnie te wartości bez udziału dostawcy. Wymagana jest treść, obraz albo ankieta, więc sam obraz lub sama ankieta z dwiema do czterech opcji też wystarczy do publikacji. Wgrane obrazy trafiają do własnego magazynu multimediów NoodleR, a nie do galerii Noodle.

Wybierz **Guide**, żeby przekształcić bieżący szkic tytułu i treści przez istniejący generator NoodleR. Zachowuje on wybrany obraz, ankietę, poziom dostępu i cenę PPV, a wygenerowany wynik obejmuje wyłącznie tytuł i treść – załączników nie generuje ani nie podmienia. Nieopublikowane pliki obrazów i adresy URL zostają w bieżącej wersji roboczej po stronie aplikacji, dopóki Post albo Guide się nie powiedzie. Jeśli Post, Guide lub zapis multimediów zawiedzie, bieżąca wersja robocza pozostaje dostępna do poprawienia albo ponownej próby.

Poziom dostępu wpisu chroni cały wpis. Zablokowane wpisy dla subskrybentów i wpisy PPV nie ujawniają swojego obrazu, opcji ankiety ani głosów. Odwiedzający, który może przeczytać wpis, może zagłosować raz i później zmienić ten głos; persona powiązana z twórcą nie może głosować na wpisie własnego profilu scenicznego.

## Subskrypcje i dostęp do wpisów

Centrum NoodleR zawsze pokazuje strony twórców z perspektywy persony wybranej globalnie. Subskrypcje i odblokowania PPV należą do tej persony, więc zmiana aktywnej persony może zmienić to, którzy twórcy i które wpisy są dostępne. Do tworzenia, edytowania i usuwania własnych profili scenicznych służy natomiast **Noodle Settings** > **NoodleR Access** > **Manage stage profiles**.

Przy przygotowywaniu wpisu przez Guide wybierz jeden poziom dostępu:

- **Public**: wpis może przeczytać każda persona, która widzi dany profil sceniczny.
- **Subscribers**: wpis pozostaje zablokowany, dopóki wybrana persona odwiedzającego nie zasubskrybuje tego profilu scenicznego.
- **PPV**: wpis ma symulowaną cenę i pozostaje zablokowany, dopóki ta persona go nie odblokuje. Żadna prawdziwa płatność nie jest realizowana.

Każdy profil sceniczny ma własne ustawienia **Subscriber access**. Opcja **Subscriptions include PPV** pozwala subskrybentom czytać wpisy PPV tego profilu bez odblokowywania każdego z osobna. Domyślnie jest wyłączona. Opcja **Hidden from personas** usuwa profil sceniczny i wszystkie jego wpisy z widoku wybranych person, razem z możliwością bezpośredniej subskrypcji i odblokowania. Ustawienia ukrycia dotyczą wyłącznie profilu scenicznego NoodleR i nie ukrywają powiązanego publicznego konta Noodle.

Użyj przycisku **Delete profile** przy zarządzanym profilu scenicznym, żeby usunąć ten profil, wszystkie opublikowane pod nim wpisy, jego subskrypcje oraz zapisy odblokowań PPV. Powiązane publiczne konto Noodle nie zostaje usunięte i może później posłużyć do utworzenia nowego profilu scenicznego.

## Invites

Sekcja **Invites** (zaproszenia) decyduje o tym, które postacie mogą wziąć udział w odświeżeniu Noodle. Odświeżenie to moment, w którym AI pisze paczkę wpisów, odpowiedzi, udostępnień i polubień dla zaproszonych kont.

- **Professor Mari participates** (udział Professor Mari): przełącznik, domyślnie **on**. Wyłącz go, żeby ukryć Professor Mari w wyszukiwarce kont Noodle i pominąć ją w przyszłych generowanych wpisach, odpowiedziach, reakcjach, wzmiankach, generowaniu profili oraz w przeniesieniu do czatów. Dotychczasowa historia osi czasu zostaje zachowana, a ponowne włączenie przełącznika przywraca jej konto.
- **Characters to Invite**: pole wyszukiwania. Wpisz tu tekst, żeby przefiltrować jednocześnie listę folderów i listę postaci pod nią.
- **Add from Folder**: kliknij, żeby rozwinąć listę folderów z postaciami. Zaznacz jeden lub więcej folderów, a potem kliknij przycisk zaproszenia na dole. Etykieta przycisku zmienia się zależnie od zaznaczenia:
  - **Select folders to invite**, gdy nic nie jest zaznaczone.
  - **Selected folder characters are invited**, gdy wszystko jest już zaproszone.
  - **Invite N characters**, gdy są nowe postacie do dodania.
- **Characters**: przewijana lista wszystkich postaci w bibliotece. Każdy wiersz ma przycisk zaproszenia albo usunięcia. Status pokazuje się jako **Invited**, **Included by folder** albo **Not invited**.

Zapraszanie z folderu to jednorazowa operacja zbiorcza, a nie synchronizacja na żywo. Postacie dodane do tego folderu później nie zostaną zaproszone automatycznie.

## Refresh

Sekcja **Refresh** (odświeżanie) steruje połączeniem AI, którym Noodle pisze, oraz częstotliwością samodzielnych odświeżeń.

- **Generation connection**: lista rozwijana. Wybierz połączenie, którego Noodle używa do pisania wpisów, odpowiedzi, udostępnień, polubień i tekstów profili. Na start jest pusta, z tekstem zastępczym **Choose connection**. Bez wybrania połączenia żadne odświeżenie nie ruszy. Modele rozpoznające obrazy dostają dodatkowo do ośmiu ostatnich, powiązanych obrazów z wpisów i komentarzy Noodle. Modele wyłącznie tekstowe, które odrzucają takie dane wejściowe, dostają automatycznie ponowne zapytanie bez obrazów.
- **Refreshes/day**: liczba od 0 do 24, domyślnie **2**. Tyle automatycznych odświeżeń Marinara uruchamia dziennie. Ustaw 0, żeby wyłączyć automatyczne odświeżanie. Nie ogranicza to ręcznego odświeżania.

### Automatyczny harmonogram

Kiedy **Refreshes/day** ma wartość powyżej 0, Marinara dzieli dobę na równe okna i losuje jedną godzinę w każdym z nich. Zaplanowane godziny razem ze strefą czasową widać w sekcji **Automatic schedule**. Kliknij ikonę ołówka obok przyszłej godziny, żeby przenieść ją na inną. Godzin minionych, zrealizowanych i powtórzonych nie da się wybrać.

Automatyczne odświeżenia działają wewnątrz serwera Marinara. Strona Noodle nie musi być otwarta, ale sama aplikacja Marinara Engine musi działać. Jeśli odświeżenie się nie uda, harmonogram pokazuje błąd i ponawia próbę później, a po kolejnych niepowodzeniach czeka coraz dłużej. Jeśli kilka zaplanowanych godzin przepadnie, jedno udane odświeżenie nadrabiające pokrywa je wszystkie, zamiast zalewać oś czasu.

## Automatyczne publikowanie w NoodleR

To harmonogram oddzielny od sekcji **Refresh** powyżej. **Refresh** obsługuje publiczną oś czasu Noodle, a ten harmonogram — twórców NoodleR. Pojawia się w **Noodle Settings** > **Publishing** po włączeniu **Enable NoodleR**.

Zamiast publikować o pełnej godzinie, NoodleR przygotowuje posty z wyprzedzeniem w małej rezerwie i publikuje każdy w zaplanowanym czasie. Dlatego twórca może pokazywać czas następnego posta, zanim sam post powstanie.

- **Automatic posting schedule**: przełącznik, domyślnie **on**. Wyłączenie zatrzymuje całe automatyczne publikowanie w NoodleR. Przygotowane posty, których termin minie w tym czasie, zostaną wycofane zamiast opublikowane z opóźnieniem.
- **Posts/day**: liczba od 1 do 24, domyślnie **4**. Dzienny limit automatycznych prób tekstowych; ten sam limit dotyczy prób obrazowych. Ręczne publikowanie i **Refresh NoodleR now** nie są wliczane.
- **Night quiet**: przełącznik, domyślnie **on**. Twórcy powiązani z **postacią** nie dostają terminów między 23:00 a 07:00 czasu lokalnego. Twórcy powiązani z personą nie podlegają temu ograniczeniu.
- **Text attempts** oraz **Image attempts**: pola tylko do odczytu pokazujące dzisiejsze użycie limitu **Posts/day**.
- **Prepared posts**: pole tylko do odczytu pokazujące liczbę postów w rezerwie i najpóźniejszy zaplanowany termin.
- **Refresh all now**: od razu pisze po jednym poście dla każdego twórcy z włączonym **Automatic**. Twórcy z wyłączoną opcją nie są uwzględniani ani zgłaszani; zajęci są pomijani. Taki post wycofuje przygotowany post tego twórcy przypadający w ciągu następnej godziny.
- **Per creator**: każdy wiersz ma przełączniki **Automatic** i **Images**. Twórcy utworzeni poza konfiguracją prowadzoną zaczynają z oboma na **off**; konfiguracja prowadzona stosuje wybrane tam wartości. Wyłączenie **Automatic** pozostawia tylko publikowanie ręczne.

Automatyczne odpowiedzi twórców mają osobny limit 10 odpowiedzi w ruchomych 24 godzinach dla całej instalacji, wspólny dla wszystkich twórców, a nie po 10 na twórcę.

Automatyczne publikowanie działa na serwerze Marinara Engine. Aplikacja musi działać, ale strona NoodleR nie musi pozostawać otwarta.

## Active Accounts

Sekcja **Active Accounts** (aktywne konta) ustala, ile uprawnionych kont bierze udział w jednym odświeżeniu. Uprawnione konta to zaproszone postacie, postacie dołączone przez folder oraz losowi użytkownicy, jeśli zostali włączeni.

- **Active selection**: lista rozwijana, domyślnie **Random range**. Dostępne opcje to **Random range**, **Exact count** i **All invited**.
- Przy **Random range** pojawiają się dwa pola: **Min active** (1 do 100, domyślnie **2**) i **Max active** (1 do 100, domyślnie **5**). Każde odświeżenie losuje liczbę z tego przedziału.
- Przy **Exact count** pojawia się jedno pole: **Active count** (1 do 100). Ustala ono stałą liczbę kont.
- Przy **All invited** bierze udział każde uprawnione konto, bez żadnego limitu.

Aktywna persona jest zawsze uprawniona, niezależnie od tych kont. Professor Mari jest uprawniona, dopóki przełącznik **Professor Mari participates** jest włączony.

Noodle wybiera aktywne konta, zanim przygotuje profile tworzone po raz pierwszy. Zapytanie o wygenerowanie profilu dostają tylko aktywne postacie bez istniejącego wygenerowanego profilu Noodle; nieaktywne zaproszone postacie są pomijane. Podobnie zapytanie o napisanie osi czasu dostaje karty postaci wyłącznie dla kont wybranych do tego odświeżenia.

## Activity

Sekcja **Activity** (aktywność) ogranicza to, ile pojedyncze odświeżenie może utworzyć. Każde pole jest limitem na jedno odświeżenie.

| Pole | Domyślnie | Zakres |
|---|---|---|
| **Posts** | 8 | 0 do 100 |
| **Replies** | 12 | 0 do 200 |
| **Reposts** | 4 | 0 do 100 |
| **Likes** | 18 | 0 do 500 |

Ustaw pole na 0, żeby AI w ogóle nie tworzyło tego rodzaju aktywności.

## Image Generation

Sekcja **Image Generation** (generowanie obrazów) pozwala Noodle dołączać do części wpisów obrazy stworzone przez AI. Potrzebne jest do tego połączenie skonfigurowane pod generowanie obrazów. Zobacz [Obsługiwani dostawcy AI](../connections/providers-reference.md).

- **Image generation**: przełącznik, domyślnie **off**. Włącz go, żeby AI mogło generować obrazy do wpisów.
- Po włączeniu pojawiają się kolejne kontrolki:
  - **Image generation connection**: lista rozwijana, domyślnie **Default image generation connection**. Pozostawienie wartości Default oznacza użycie tego połączenia, które w panelu Connections jest oznaczone jako domyślne do generowania obrazów.
  - **Prompt instructions**: pole tekstowe z wbudowanym tekstem domyślnym, do 4000 znaków. Te dodatkowe uwagi trafiają do promptu obrazu.
  - **Use avatar references**: przełącznik, domyślnie **on**. Wysyła awatar postaci albo jej obrazy referencyjne do modelu obrazów.
  - **Include descriptions**: przełącznik, domyślnie **on**. Dodaje do promptu obrazu opisowe notatki o wyglądzie postaci.
  - **Images/refresh**: liczba od 0 do 50, domyślnie **3**. Ogranicza liczbę generowanych obrazów osobno dla każdego ręcznego i automatycznego odświeżenia.
- **Attach gallery images**: osobny przełącznik, domyślnie **off**. Pozostaje widoczny nawet przy wyłączonym **Image generation**. Zamiast tworzyć nowy obraz, pozwala wpisowi wykorzystać obraz z galerii danej postaci albo z czatu, w którym ta postać występuje.

Jeśli **Image generation** jest włączone, ale nie ma sprawnego połączenia do obrazów, odświeżenie zostaje zablokowane. Pojawia się wtedy komunikat "Choose an image generation connection for Noodle first." Nieudany obraz jest ponawiany raz. Jeśli druga próba też zawiedzie, odświeżenie idzie dalej i publikuje czysty wpis tekstowy, zamiast pokazywać niewykorzystany prompt obrazu.

Szablon, którym Noodle pisze te prompty obrazów, nazywa się **Noodle Post Image**. Można go edytować w **Settings** > **Generations** > **Image Generation Prompt Overrides**. Tekst z pola **Prompt instructions** trafia do tego szablonu, a wynik przechodzi następnie przez zwykły profil stylu obrazów. Zobacz [Prompt Overrides dla obrazów i wideo](../prompts/prompt-overrides.md) oraz [Profile stylu obrazów](../media/style-profiles.md). Professor Mari nie ma karty postaci, więc jej wpisy z obrazami korzystają z wbudowanego awatara i wbudowanych grafik referencyjnych.

## Timeline Writing

Sekcja **Timeline Writing** (pisanie osi czasu) dostraja ton autora odświeżeń oraz jego długoterminową pamięć.

- **Enhanced tone & continuity**: przełącznik, domyślnie **off**. Po włączeniu głos każdego konta mocniej opiera się na jego własnych polach Personality/Description/Backstory zamiast na domyślnym pogodnym tonie, konta częściej reagują na wpisy innych, cytują je albo się z nimi spierają w ramach tego samego odświeżenia, sięganie po starsze wpisy zdarza się częściej (i faworyzuje wpisy związane z aktualnie aktywnymi kontami zamiast losować w ciemno), a instrukcja przywoływania zachęca do odwołań, zamiast ich unikać. Wyłączony przełącznik odtwarza pierwotny ton i pierwotne zachowanie pamięci Noodle dokładnie tak jak wcześniej, więc jego włączenie jest jedynym sposobem, żeby zmienić charakter osi czasu.
- **Use generated character schedules**: przełącznik, domyślnie **off**. Po włączeniu Noodle dołącza dzisiejszy wygenerowany harmonogram z trybu Conversation dla każdej biorącej udział postaci, o ile taki harmonogram istnieje. Noodle sam ich nie generuje ani nie odświeża. Bieżąca data i godzina lokalna trafiają do każdego odświeżenia osi czasu niezależnie od tego przełącznika.

## Dostosowanie głosu autora osi czasu

Autor odświeżeń w Noodle kieruje się wbudowanym zestawem instrukcji o tonie i swobodzie twórczej: ile osobowości ma być we wpisach każdego konta i jak mocno konta mogą ze sobą żartować, przekomarzać się albo się ścierać. Ten tekst da się przepisać w **Settings** > **Generations** > **Image Generation Prompt Overrides** > **Noodle Timeline Voice & Tone** (w tytule sekcji jest słowo "Image", ale ta lista zawiera każdy edytowalny prompt tekstowy Noodle i trybu Conversation, nie tylko te od obrazów). Widoczny tam tekst domyślny podąża za przełącznikiem **Enhanced tone & continuity** opisanym wyżej, dopóki nie zostanie zmieniony. Po zapisaniu własnego tekstu aplikacja używa go niezależnie od tego przełącznika.

To nadpisanie obejmuje wyłącznie głos i ton. Reguły pilnujące poprawności wyniku odświeżenia (jakie działania strukturalne są dozwolone, jak muszą być kierowane interakcje i tak dalej) nie są częścią tego tekstu i obowiązują zawsze, więc przepisany głos nie zepsuje odświeżenia.

## World / Lore

Sekcja **World / Lore** (świat i wiedza) pozwala odświeżeniu sięgnąć po wpisy z lorebooków, czyli z tego samego systemu, którego używa generowanie na czacie.

- **Lorebook context**: przełącznik, domyślnie **off**. Po włączeniu każde odświeżenie przeszukuje tekst ostatnich wpisów i odpowiedzi w Noodle oraz profile aktywnych postaci pod kątem słów kluczowych z lorebooków i dołącza pasujące wpisy jako kontekst świata dla kont biorących udział w tym odświeżeniu. Aktywować mogą się tylko lorebooki powiązane z aktywną postacią albo oznaczone jako globalne. Aktywowana treść o świecie ma sztywny limit 8192 tokenów na odświeżenie. Domyślnie funkcja jest wyłączona, więc istniejące osie czasu pozostają nietknięte do momentu jej włączenia.

## Carryover

Sekcja **Carryover** (przeniesienie) przepycha ostatnią aktywność z Noodle do czatów. Po włączeniu prompt czatu dostaje blok "Recent Social Media Activity" opisujący, co postacie robiły w Noodle.

- **Carryover to chats**: trzy osobne przełączniki, wszystkie domyślnie **off**: **Conversations**, **Roleplays** i **Games**. Włącz te tryby, które mają dostawać aktywność z Noodle.
- **Carry hours**: liczba od 1 do 720, domyślnie **48**. Tyle godzin wstecz Noodle szuka aktywności do przeniesienia.
- **Carry items**: liczba od 1 do 50, domyślnie **8**. Tyle najwyżej podsumowań aktywności trafia do jednej tury czatu.

Przeniesienie obejmuje wyłącznie aktywność postaci zaproszonych w Noodle oraz aktywną personę czatu. Samo dołączenie przez folder tu nie wystarczy.
Cały opakowany blok przeniesienia ma osobny sztywny limit 8192 tokenów na jedno generowanie w czacie. Jeśli limit liczby pozycji miałby go przekroczyć, Marinara zachowuje najnowsze podsumowania, które się mieszczą, i pokazuje je w kolejności chronologicznej.

## Reset Noodle

Sekcja **Reset Noodle** (wyczyszczenie Noodle) czyści oś czasu, zachowując konta i ustawienia.

1. Kliknij przycisk **Reset Noodle Timeline**.
2. Pojawia się okno o tytule **Reset Noodle Timeline**. Widnieje w nim tekst "This removes all posts, replies, likes, reposts, activity digests, and refresh records. Profiles, follows, invites, and settings stay."
3. Kliknij przycisk **Reset timeline**, żeby potwierdzić.

Usuwa to wyłącznie treść osi czasu. Konta, identyfikatory, opisy, obserwacje, zaproszenia i każde ustawienie Noodle zostają na miejscu.

## Losowi użytkownicy

Losowi użytkownicy to sześć wbudowanych kont tła spoza twojej biblioteki: Thread Countess, Packet Soup, Orbit Notice, Glass Bulletin, Moth Hour i Brine Index. Każde ma krótki, klimatyczny opis.

Włącza się ich wierszem **Random users** na górze listy **Characters** w sekcji **Invites**. Domyślnie jest **off**. Podpis wiersza brzmi **Enabled**, kiedy funkcja jest włączona, albo **Ambient fake profiles**, kiedy jest wyłączona. Po włączeniu te konta mogą podczas odświeżenia publikować, polubiać, udostępniać, odpowiadać i obserwować. Nigdy nie da się ich obserwować z poziomu profilu.

## Łączenie Noodle z czatami

Noodle i czaty mogą dzielić się kontekstem w dwie strony. To dwie osobne funkcje. Włączenie jednej nie włącza drugiej.

**Carryover to chats** (ustawiane w ustawieniach Noodle) wysyła aktywność z Noodle do czatu. Dodaje do promptu tego czatu blok "Recent Social Media Activity", tak jak opisuje to sekcja Carryover powyżej.

**Allow Noodle references** to przełącznik ustawiany osobno dla każdego czatu. Wysyła aktywność w drugą stronę, z czatu do Noodle. Znajdziesz go w ustawieniach samego czatu, w okolicy obszaru **Connected Chats**. Zobacz [Panel **Chat Settings** – przegląd](../chats/chat-settings.md). Domyślnie jest **off** dla każdego czatu. Jego opis brzmi "Timeline refreshes may include recent messages from this chat, with the chat name, mode, and participants stated in the prompt." Jeśli w tym czacie działa też funkcja opisana w przewodniku [Harmonogramy postaci i wiadomości autonomiczne](../conversation/schedules.md), obok wiadomości trafia tam bieżący status i bieżąca aktywność postaci w tej historii (na przykład "currently dnd (At the office)"), ograniczone do tego jednego czatu.

Żeby aktywność z Noodle pojawiała się w czacie, włącz odpowiedni tryb w **Carryover to chats**. Żeby odświeżenie Noodle mogło czytać z czatu, włącz w tym czacie **Allow Noodle references**. Można używać każdej z tych funkcji osobno albo obu naraz.

## Rozwiązywanie problemów

- **Ręczne odświeżenie nic nie generuje**: wybierz **Generation connection**, zaproś co najmniej jedną postać (albo włącz losowych użytkowników) i sprawdź błąd pokazany w sekcji **Refresh**.
- **Automatyczne odświeżenia się nie odbywają**: ustaw **Refreshes/day** powyżej 0, zostaw uruchomiony serwer Marinara i sprawdź zaplanowane godziny oraz strefę czasową w sekcji **Automatic schedule**. Jeśli harmonogram pokazuje błąd, napraw problem z połączeniem albo z limitem zapytań i pozwól ponowić próbę.
- **Wpisy nie wspominają o niedawnym czacie**: włącz **Allow Noodle references** w ustawieniach tego czatu i sprawdź, czy postać jest zaproszona. Kontekst czatu jest dla AI wskazówką, a nie gwarancją.
- **Aktywność z Noodle nie pojawia się w czatach**: włącz odpowiedni tryb w **Carryover to chats** i zwiększ **Carry hours**, jeśli aktywność jest zbyt stara.
- **Wpisy nie mają obrazów**: włącz **Image generation**, wybierz działające połączenie do obrazów i sprawdź limit **Images/refresh**.

## Ustawienia i wartości domyślne

Ta tabela wypisuje każde ustawienie Noodle razem z wartością domyślną i zakresem.

| Ustawienie | Domyślnie | Zakres lub opcje |
|---|---|---|
| **Enable NoodleR** | off | on lub off |
| **Generation connection** | brak | dowolne połączenie tekstowe (wymagane do odświeżenia) |
| **Professor Mari participates** | on | on lub off |
| **Refreshes/day** | 2 | 0 do 24 (0 wyłącza automatyczne odświeżenia) |
| **Automatic posting schedule** | on | on lub off |
| **Posts/day** | 4 | 1 do 24 |
| **Night quiet** | on | twórcy-postacie pomijają 23:00–07:00 |
| **Automatic** dla twórcy | off | konfiguracja prowadzona może je włączyć |
| **Images** dla twórcy | off | konfiguracja prowadzona może je włączyć |
| Automatyczne odpowiedzi twórców | 10 na 24 godziny | dla całej instalacji, nie na twórcę |
| **Active selection** | Random range | Random range, Exact count, All invited |
| **Min active** | 2 | 1 do 100 (tylko przy Random range) |
| **Max active** | 5 | 1 do 100 (tylko przy Random range) |
| **Active count** | tyle co Max active | 1 do 100 (tylko przy Exact count) |
| **Posts** | 8 | 0 do 100 |
| **Replies** | 12 | 0 do 200 |
| **Reposts** | 4 | 0 do 100 |
| **Likes** | 18 | 0 do 500 |
| **Image generation** | off | on lub off |
| **Image generation connection** | Default | dowolne połączenie do generowania obrazów |
| **Prompt instructions** | tekst wbudowany | do 4000 znaków |
| **Use avatar references** | on | on lub off |
| **Include descriptions** | on | on lub off |
| **Images/refresh** | 3 | 0 do 50 |
| **Attach gallery images** | off | on lub off |
| **Lorebook context** | off | on lub off |
| **Enhanced tone & continuity** | off | on lub off |
| **Carryover: Conversations** | off | on lub off |
| **Carryover: Roleplays** | off | on lub off |
| **Carryover: Games** | off | on lub off |
| **Carry hours** | 48 | 1 do 720 |
| **Carry items** | 8 | 1 do 50 |
| **Allow Noodle references** (dla czatu) | off | on lub off |

## Powiązane przewodniki

- [Noodle: wbudowana oś czasu społecznościowa](overview.md)
- [Panel **Chat Settings** – przegląd](../chats/chat-settings.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Obsługiwani dostawcy AI](../connections/providers-reference.md)
