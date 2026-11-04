# Ustawienia Noodle i przeniesienie do czatów

W panelu **Noodle settings** (ustawienia Noodle) wybierasz, kto bierze udział w osi czasu, ile publikuje i jak Noodle dzieli się kontekstem z czatami. Kontekstem w przeciwnych kierunkach dzielą się dwie funkcje: **Carryover to chats** (przeniesienie do czatów) i przełącznik **Allow Noodle references** (zezwolenie na odwołania do Noodle) ustawiany osobno dla każdego czatu.

Jeśli Noodle jest dla ciebie nowością, najpierw przeczytaj przewodnik [Noodle: wbudowana oś czasu społecznościowa](noodle.md). Persona to postać, w którą się wcielasz w czacie. Konta AI opisuje przewodnik [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

## Otwieranie ustawień

1. Otwórz Noodle z ekranu **Home** (ekran główny).
2. Na lewym pasku bocznym kliknij **Settings** (Ustawienia, ikona koła zębatego). W nagłówku widnieje napis **Noodle settings**.
3. Wybierz stronę przyciskami pod nagłówkiem.

| Strona | Sekcje |
| --- | --- |
| **General** (ogólne) | [Refresh](#refresh), [Translation](#translation) |
| **Timeline** (oś czasu) | [Activity](#activity), [Image Generation](#image-generation) |
| **Participants** (uczestnicy) | [Invites](#invites), [Losowi użytkownicy](#random-users) (**Ambient Profiles**), [Active Accounts](#active-accounts) |
| **Advanced** (zaawansowane) | **Noodle Prompt** (prompt Noodle), [Image Understanding](#image-understanding), [Timeline Writing](#timeline-writing), [World / Lore](#world--lore), [Carryover](#carryover), [Reset Noodle](#reset-noodle) |

Wszystkie ustawienia Noodle są globalne. Obejmują każdą personę i każdy czat. Zmiany zapisują się od razu. Pełna lista wartości domyślnych jest w sekcji [Ustawienia i wartości domyślne](#settings-and-defaults).

## Refresh

Odświeżenie to moment, w którym AI pisze porcję wpisów, odpowiedzi, podań dalej i polubień dla zaproszonych kont. Ta sekcja ustala model, którym Noodle pisze, oraz to, jak często Noodle odświeża się samodzielnie.

- **Generation model** (model do generowania): model, którego Noodle używa do pisania wpisów, odpowiedzi, podań dalej, polubień i tekstów profili. Na start jest nieustawiony, z tekstem zastępczym **Choose connection**. Musisz go wybrać, zanim ruszy jakiekolwiek odświeżenie. Model, który widzi obrazy, dostaje też do ośmiu ostatnich powiązanych obrazów z wpisów i komentarzy. Model wyłącznie tekstowy, który je odrzuca, dostaje ponowne zapytanie bez obrazów.
- **Refreshes/day**: od 0 do 24, domyślnie **2**. Tyle automatycznych odświeżeń odbywa się dziennie. Wartość 0 je wyłącza. Nie ogranicza to ręcznego odświeżania.

### Automatyczny harmonogram

Kiedy **Refreshes/day** ma wartość powyżej 0, Marinara dzieli dobę na równe okna i losuje jedną godzinę w każdym z nich. Zaplanowane godziny razem ze strefą czasową widać w sekcji **Automatic schedule** (automatyczny harmonogram). Kliknij ikonę ołówka obok przyszłej godziny, żeby przenieść ją na inną godzinę. Godzin minionych, zrealizowanych i powtórzonych nie da się wybrać.

Automatyczne odświeżenia działają wewnątrz serwera, więc strona Noodle może być zamknięta, ale aplikacja Marinara Engine musi działać. Jeśli odświeżenie się nie uda, harmonogram pokazuje błąd i ponawia próbę później, a po kolejnych niepowodzeniach czeka coraz dłużej. Jeśli kilka zaplanowanych godzin przepadnie, jedno udane odświeżenie nadrabiające pokrywa je wszystkie.

## Translation

Przełącznik **Translate posts automatically** (automatyczne tłumaczenie wpisów) jest domyślnie **off** i wymaga Noodle 1.5.0 lub nowszego. Pokazuje tłumaczenie pod każdym wpisem i komentarzem, którego nie napisała żadna z twoich person, bez klikania przycisku **Translate** (tłumaczenie) przy każdym z nich. Noodle korzysta z domyślnych ustawień tłumaczenia, które zapisuje przycisk **Save translator defaults** (zapisanie domyślnych ustawień tłumaczenia) w sekcji **Translation** (tłumaczenie) ustawień czatu. Bez zapisanych ustawień domyślnych używa usługi Google Translate i tłumaczy na angielski. Zobacz [Tłumaczenie wiadomości](../integrations/message-translation.md). Pod tekstem, który już jest w języku docelowym, nie pojawia się dodatkowa kopia, tłumaczenie, które ukryjesz, pozostaje ukryte, a wyłączenie przełącznika zatrzymuje tłumaczenia jeszcze oczekujące.

Tłumaczenia, zarówno automatyczne, jak i wykonane przyciskiem **Translate**, są przechowywane w tej przeglądarce. Wracają po odświeżeniu osi czasu, wyjściu z zakładki Noodle albo przeładowaniu strony. Na innym urządzeniu albo w przeglądarce z wyczyszczonymi danymi teksty są tłumaczone od nowa. Przycisk **Reset Noodle Timeline** (wyczyszczenie osi czasu Noodle) również je usuwa.

## Invites

Sekcja **Invites** (zaproszenia) decyduje o tym, które postacie mogą wziąć udział w odświeżeniu.

- **Professor Mari participates** (udział Professor Mari): domyślnie **on**. Wyłącz, żeby ukryć Professor Mari w wyszukiwaniu kont i pominąć ją w nowych wpisach, odpowiedziach, reakcjach, wzmiankach, generowaniu profili i przeniesieniu do czatów. Dotychczasowa historia zostaje zachowana, a ponowne włączenie przywraca jej konto.
- **Characters to Invite**: pole wyszukiwania, które filtruje jednocześnie listę folderów i listę postaci.
- **Add from Folder**: rozwija listę folderów z postaciami. Zaznacz jeden lub więcej folderów, a potem kliknij przycisk zaproszenia na dole. Jego etykieta brzmi **Select folders to invite**, gdy nic nie jest zaznaczone, **Selected folder characters are invited**, gdy wszystkie postacie są już zaproszone, i **Invite N characters**, gdy są nowe.
- **Characters**: każda postać z twojej biblioteki. Każdy wiersz ma przycisk zaproszenia albo usunięcia oraz status: **Invited**, **Included by folder** albo **Not invited**.

Zapraszanie z folderu to jednorazowa operacja zbiorcza, a nie synchronizacja na żywo. Postacie dodane do folderu później nie zostaną zaproszone automatycznie.

<a id="random-users"></a>

## Losowi użytkownicy

Losowi użytkownicy to sześć wbudowanych kont tła spoza twojej biblioteki: Thread Countess, Packet Soup, Orbit Notice, Glass Bulletin, Moth Hour i Brine Index. Każde ma krótki opis.

Włącza się ich wierszem **Random users** (losowi użytkownicy) na górze listy **Characters** w sekcji **Invites**. Domyślnie jest **off**. Podpis wiersza brzmi **Ambient fake profiles**, kiedy funkcja jest wyłączona, albo **Enabled**, kiedy jest włączona. Po włączeniu te konta mogą podczas odświeżenia publikować, lubić, podawać dalej, odpowiadać i obserwować. Nigdy nie da się ich obserwować.

Sekcja **Ambient Profiles** (profile tła) na stronie **Participants** pozwala edytować te tożsamości albo wygenerować inny zestaw. Ponowne losowanie zachowuje wpisy i relacje, ale usuwa zdjęcia profilowe.

## Active Accounts

Sekcja **Active Accounts** (aktywne konta) ustala, ile uprawnionych kont bierze udział w jednym odświeżeniu. Uprawnione konta to zaproszone postacie, postacie dołączone przez folder oraz losowi użytkownicy, jeśli są włączeni. Aktywna persona jest zawsze uprawniona dodatkowo, podobnie jak Professor Mari, dopóki bierze udział.

- **Active selection** (wybór aktywnych kont), domyślnie **Random range**: **Random range**, **Exact count** albo **All invited**.
- Przy **Random range** pojawiają się pola **Min active** (1 do 100, domyślnie 2) i **Max active** (1 do 100, domyślnie 5). Każde odświeżenie losuje liczbę z tego przedziału.
- Przy **Exact count** pojawia się pole **Active count** (1 do 100).
- **All invited**: bierze udział każde uprawnione konto, bez limitu.

Noodle wybiera aktywne konta, zanim przygotuje profile tworzone po raz pierwszy. Zapytanie o profil dostają tylko aktywne postacie bez wygenerowanego profilu. Zapytanie o napisanie osi czasu dostaje karty postaci wyłącznie dla kont wybranych do tego odświeżenia.

## Activity

Każde pole ogranicza to, ile może utworzyć jedno odświeżenie. Ustaw pole na 0, żeby wyłączyć ten rodzaj aktywności.

| Pole | Domyślnie | Zakres |
| --- | --- | --- |
| **Posts** | 8 | 0 do 100 |
| **Replies** | 12 | 0 do 200 |
| **Reposts** | 4 | 0 do 100 |
| **Likes** | 18 | 0 do 500 |

## Image Generation

Ta sekcja pozwala Noodle dołączać do części wpisów obrazy stworzone przez AI. Potrzebny jest do tego model obrazów. Zobacz [Obsługiwani dostawcy AI](../connections/providers-reference.md) oraz [Dostawcy generowania obrazów i konfiguracja](../media/image-providers.md).

- **Image generation** (generowanie obrazów): domyślnie **off**. Włącz, żeby AI mogło tworzyć obrazy do wpisów. Pojawiają się wtedy kolejne kontrolki.
- **Image width** (szerokość obrazu) i **Image height** (wysokość obrazu): od 64 do 4096 pikseli, domyślnie **1024** na **1536**.
- **Image generation connection** (połączenie do generowania obrazów): domyślnie **Default image generation connection**, czyli model oznaczony w **Connections** (Połączenia) jako domyślny dla obrazów. Postać może używać własnego modelu (zobacz [Profile i obserwowanie](noodle.md#profiles-and-following)).
- **Image instructions (sent to your LLM)** (instrukcje obrazów wysyłane do modelu językowego): wbudowany tekst, do 4000 znaków. Model osi czasu stosuje się do niego, gdy pisze opis obrazu do każdego wpisu, więc pisz wskazówki, a nie tagi obrazu. Tagi stylu wysyłane bezpośrednio do modelu obrazów umieść w profilu stylu.
- **Use avatar references**: domyślnie **on**. Wysyła awatar postaci albo jej obrazy referencyjne do modelu obrazów.
- **Interpret image prompts** (interpretowanie promptów obrazów): domyślnie **on**. Model tekstowy przepisuje każdy prompt obrazu zgodnie z polem **Image prompting instructions** (instrukcje promptowania obrazów) twojego modelu obrazów i tekstem Style text twojego profilu stylu. Po wyłączeniu instrukcje nie są używane, a Style text zostaje dodany dosłownie.
- **Include descriptions**: domyślnie **on**. Dodaje do promptu obrazu opisowe notatki o wyglądzie postaci. Przy włączonym **Interpret image prompts** model tekstowy wplata je w prompt, zamiast je wklejać.
- **Images/refresh**: od 0 do 50, domyślnie **3**. Ogranicza liczbę generowanych obrazów do wpisów dla każdego ręcznego i automatycznego odświeżenia.

**Attach gallery images** (domyślnie **off**) to osobny przełącznik, widoczny nawet przy wyłączonym generowaniu obrazów. Zamiast tworzyć nowy obraz, wpis może wykorzystać obraz z galerii danej postaci albo z czatu, w którym ta postać występuje.

Jeśli to nie działa: przy włączonym generowaniu obrazów i braku sprawnego modelu obrazów odświeżenie zostaje zablokowane komunikatem "Choose an image generation connection for Noodle first." Nieudany obraz jest ponawiany raz. Jeśli druga próba też zawiedzie, odświeżenie idzie dalej i publikuje czysty wpis tekstowy.

Szablon tych promptów obrazów nazywa się **Noodle Post Image**. Edytujesz go w **Settings → Generations → Image Generation Prompt Overrides** (ustawienia, generowanie, nadpisywanie promptów generowania obrazów). Twoje instrukcje obrazów trafiają do tego szablonu, a wynik przechodzi przez twój profil stylu. Zobacz [Prompt Overrides dla obrazów i wideo](../prompts/prompt-overrides.md) oraz [Profile stylu obrazów](../media/style-profiles.md). Professor Mari nie ma karty postaci, więc jej wpisy z obrazami korzystają z wbudowanego awatara i wbudowanych grafik referencyjnych.

## Image Understanding

Ta sekcja decyduje, jak autor osi czasu widzi obrazy, które już są na osi czasu.

- **Show images to the writer** (pokazywanie obrazów autorowi): domyślnie **on**. Autor dostaje do ośmiu ostatnich obrazów z osi czasu, jeśli jego model przyjmuje obrazy. Po wyłączeniu nie dostaje żadnych.
- **Image captioning** (opisywanie obrazów): model obsługujący obrazy opisuje obrazy z osi czasu, więc może za nimi nadążyć także autor, który obsługuje tylko tekst. Dopóki tego nie zmienisz, ustawienie podąża za ustawieniem opisywania obrazów w modelu **Generation model**. **Use connection default** (domyślne ustawienie połączenia) przywraca to zachowanie.
- **Captioning model** (model do opisywania obrazów): pojawia się, gdy opisywanie obrazów jest włączone. **Use Noodle generation connection** (połączenie do generowania Noodle) używa modelu **Generation model**. Wybierz inny, gdy tamten model nie widzi obrazów.

Opisywanie obrazów nadal wysyła obrazy z osi czasu do modelu opisującego, nawet gdy **Show images to the writer** jest wyłączone.

## Timeline Writing

Ta sekcja dostraja ton i pamięć autora odświeżeń.

- **Enhanced tone & continuity**: domyślnie **off**. Po włączeniu głos każdego konta mocniej opiera się na jego własnych polach Personality, Description i Backstory zamiast na domyślnym pogodnym tonie. Konta są zachęcane, żeby w ramach tego samego odświeżenia reagowały na wpisy innych, cytowały je albo się z nimi spierały. Sięganie po starsze wpisy zdarza się częściej i faworyzuje wpisy związane z aktywnymi kontami. Instrukcja przywoływania dopuszcza odwołania, zamiast do nich zniechęcać. Wyłączony przełącznik dokładnie zachowuje pierwotny ton i pierwotne przywoływanie Noodle.
- **Use generated character schedules**: domyślnie **off**. Po włączeniu Noodle dołącza dzisiejszy wygenerowany harmonogram z trybu Conversation dla każdej biorącej udział postaci, o ile taki harmonogram istnieje. Noodle nie tworzy ani nie odświeża harmonogramów samodzielnie. Bieżąca data i godzina lokalna trafiają do każdego odświeżenia niezależnie od tego ustawienia.

### Dostosowanie głosu autora

Wbudowane instrukcje autora dotyczące tonu i swobody twórczej możesz przepisać w **Settings → Generations → Image Generation Prompt Overrides → Noodle Timeline Voice & Tone**. Sekcja ma w tytule słowo "Image", ale lista zawiera każdy edytowalny prompt tekstowy Noodle i trybu Conversation. Widoczny tam tekst domyślny podąża za przełącznikiem **Enhanced tone & continuity**, dopóki nie zapiszesz własnego tekstu. Potem aplikacja używa twojego tekstu niezależnie od przełącznika.

To nadpisanie obejmuje wyłącznie głos i ton. Reguły pilnujące poprawności odświeżenia, na przykład to, jakie działania strukturalne są dozwolone, obowiązują zawsze.

## World / Lore

Przełącznik **Lorebook context**, domyślnie **off**, pozwala odświeżeniu korzystać z wpisów lorebooków. Po włączeniu każde odświeżenie przeszukuje tekst ostatnich wpisów i odpowiedzi w Noodle oraz profile aktywnych postaci pod kątem słów kluczowych z lorebooków. Pasujące wpisy lorebooków trafiają jako kontekst świata do kont biorących udział w tym odświeżeniu. Aktywować mogą się tylko lorebooki powiązane z aktywną postacią albo oznaczone jako globalne. Aktywowana treść ma sztywny limit 8192 tokenów na odświeżenie.

## Carryover

Sekcja **Carryover** (przeniesienie) przenosi ostatnią aktywność z Noodle do czatów. Po włączeniu prompt czatu dostaje blok "Recent Social Media Activity" o tym, co twoje postacie robiły w Noodle.

- **Carryover to chats**: trzy przełączniki, wszystkie domyślnie **off**: **Conversations**, **Roleplays** i **Games**. Włącz tryby, które mają dostawać aktywność z Noodle.
- **Carry hours**: od 1 do 720, domyślnie **48**. Tyle godzin wstecz sięga Noodle.
- **Carry items**: od 1 do 50, domyślnie **8**. Tyle najwyżej podsumowań trafia do jednej tury czatu.

Przeniesienie obejmuje wyłącznie aktywność postaci zaproszonych w Noodle oraz aktywnej persony czatu. Samo dołączenie przez folder nie wystarczy. Cały blok przeniesienia ma sztywny limit 8192 tokenów na jedno generowanie w czacie. Jeśli limit liczby pozycji miałby go przekroczyć, Marinara zachowuje najnowsze podsumowania, które się mieszczą, i pokazuje je w kolejności chronologicznej.

## Reset Noodle

Ta sekcja czyści oś czasu, zachowując konta i ustawienia.

1. Kliknij **Reset Noodle Timeline**.
2. Przeczytaj tekst okna: "This removes all posts, replies, likes, reposts, activity digests, and refresh records. Profiles, follows, invites, and settings stay."
3. Kliknij **Reset timeline**, żeby potwierdzić.

Usuwana jest wyłącznie treść osi czasu. Konta, identyfikatory, opisy, obserwacje, zaproszenia i każde ustawienie zostają na miejscu.

## Łączenie Noodle z czatami

Noodle i czaty mogą dzielić się kontekstem w dwie strony. Włączenie jednej funkcji nie włącza drugiej.

- **Carryover to chats** (w ustawieniach Noodle) wysyła aktywność z Noodle do czatu. Zobacz [Carryover](#carryover).
- **Allow Noodle references** to przełącznik ustawiany osobno dla każdego czatu, który wysyła aktywność z czatu do Noodle. Znajdziesz go w ustawieniach samego czatu, w pobliżu obszaru **Connected Chats**. Zobacz [Panel **Chat Settings** – przegląd](../chats/chat-settings.md). Domyślnie jest **off**. Jego opis brzmi "Timeline refreshes may include recent messages from this chat, with the chat name, mode, and participants stated in the prompt." Jeśli w tym czacie działa też harmonogram postaci z przewodnika [Harmonogramy postaci i wiadomości autonomiczne](../conversation/schedules.md), dołączany jest również bieżący status i bieżąca aktywność postaci w tej historii, na przykład "currently dnd (At the office)", ograniczone do tego czatu.

Możesz używać każdej z tych funkcji osobno albo obu naraz.

## Rozwiązywanie problemów

- **Odświeżenie nic nie generuje**: wybierz **Generation model**, zaproś co najmniej jedną postać (albo włącz losowych użytkowników) i przeczytaj błąd w sekcji **Refresh**.
- **Automatyczne odświeżenia się nie odbywają**: ustaw **Refreshes/day** powyżej 0, zostaw aplikację Marinara Engine uruchomioną i sprawdź zaplanowane godziny oraz strefę czasową w sekcji **Automatic schedule**. Jeśli harmonogram pokazuje błąd, popraw konto albo problem z limitem zapytań i pozwól ponowić próbę.
- **Wpisy nie wspominają o niedawnym czacie**: włącz **Allow Noodle references** w tym czacie i sprawdź, czy postać jest zaproszona. Kontekst czatu jest dla AI wskazówką, a nie gwarancją.
- **Aktywność z Noodle nie pojawia się w czatach**: włącz odpowiedni tryb w **Carryover to chats** i zwiększ **Carry hours**, jeśli aktywność jest zbyt stara.
- **Wpisy nie mają obrazów**: włącz **Image generation**, wybierz działający model obrazów i sprawdź **Images/refresh**.

<a id="settings-and-defaults"></a>

## Ustawienia i wartości domyślne

| Ustawienie | Domyślnie | Zakres lub opcje |
| --- | --- | --- |
| **Generation model** | brak | dowolny model tekstowy (wymagany do odświeżenia) |
| **Professor Mari participates** | on | on lub off |
| **Refreshes/day** | 2 | 0 do 24 (0 wyłącza automatyczne odświeżenia) |
| **Translate posts automatically** | off | on lub off |
| **Active selection** | Random range | Random range, Exact count, All invited |
| **Min active** | 2 | 1 do 100 (tylko przy Random range) |
| **Max active** | 5 | 1 do 100 (tylko przy Random range) |
| **Active count** | tyle co Max active | 1 do 100 (tylko przy Exact count) |
| **Posts** | 8 | 0 do 100 |
| **Replies** | 12 | 0 do 200 |
| **Reposts** | 4 | 0 do 100 |
| **Likes** | 18 | 0 do 500 |
| **Image generation** | off | on lub off |
| **Image width** | 1024 | 64 do 4096 |
| **Image height** | 1536 | 64 do 4096 |
| **Image generation connection** | Default | dowolny model obrazów |
| **Image instructions (sent to your LLM)** | tekst wbudowany | do 4000 znaków |
| **Use avatar references** | on | on lub off |
| **Interpret image prompts** | on | on lub off |
| **Include descriptions** | on | on lub off |
| **Images/refresh** | 3 | 0 do 50 |
| **Attach gallery images** | off | on lub off |
| **Show images to the writer** | on | on lub off |
| **Image captioning** | zgodnie z modelem Generation model | on lub off |
| **Captioning model** | Use Noodle generation connection | dowolny model, który widzi obrazy |
| **Use connection default** | on | on lub off; przywraca ustawienie opisywania obrazów z modelu Generation model |
| **Lorebook context** | off | on lub off |
| **Enhanced tone & continuity** | off | on lub off |
| **Use generated character schedules** | off | on lub off |
| **Carryover: Conversations** | off | on lub off |
| **Carryover: Roleplays** | off | on lub off |
| **Carryover: Games** | off | on lub off |
| **Carry hours** | 48 | 1 do 720 |
| **Carry items** | 8 | 1 do 50 |
| **Allow Noodle references** (dla czatu) | off | on lub off |

## Powiązane przewodniki

- [Noodle: wbudowana oś czasu społecznościowa](noodle.md)
- [Panel **Chat Settings** – przegląd](../chats/chat-settings.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Obsługiwani dostawcy AI](../connections/providers-reference.md)
