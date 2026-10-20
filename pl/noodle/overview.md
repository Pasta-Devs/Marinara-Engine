# Noodle: wbudowana oś czasu społecznościowa

Noodle to opcjonalny, udawany kanał społecznościowy dla aplikacji Marinara Engine. Przypomina oś czasu z serwisów Twitter lub X, ale każde konto i każdy post należy do twojego własnego świata: do persony, do twoich postaci i do asystentki Professor Mari. Z tego przewodnika dowiesz się, jak zainstalować i otworzyć Noodle oraz jak publikować posty, obserwować konta i odświeżać oś czasu.

## Czym jest Noodle

Noodle to udawany kanał społecznościowy działający wewnątrz aplikacji. Nie łączy się z żadną prawdziwą siecią społecznościową. Nic, co powstaje w zakładce Noodle, nie trafia do internetu.

Każde konto w zakładce Noodle pochodzi z twojej aplikacji:

- Twoja **persona**, czyli postać, w którą się wcielasz w czacie. Zobacz [Persony użytkownika](../characters/personas.md).
- Dowolne postacie zaproszone z biblioteki.
- **Professor Mari**, wbudowana asystentka aplikacji. Zobacz [Professor Mari](../home/professor-mari.md).
- Niewielki zestaw wbudowanych kont typu "random user", jeśli je włączysz.

Posty piszesz ręcznie jako persona. Inna opcja: kliknij przycisk **Refresh timeline** (odświeżenie osi czasu) i pozwól pisać połączeniu AI. W jednym przebiegu powstają nowe posty, odpowiedzi, polubienia i obserwacje dla zaproszonych kont. Połączenie AI to zapisany skrót do dostawcy AI, który generuje tekst. Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

Aktywność w zakładce Noodle jest opcjonalna i domyślnie wyłączona. Nic się nie generuje, dopóki nie zaprosisz postaci (albo nie włączysz kont random user) i nie klikniesz przycisku **Refresh timeline**.

Uwaga o treściach: wbudowane instrukcje, które Noodle wysyła do AI, traktują każde konto jako osobę dorosłą (18+). Dopuszczają posty i obrazy dla dorosłych, także dosadne. To zachowanie jest wbudowane i nie da się go wyłączyć w ustawieniach. Jeśli takie treści są niepożądane, sprawdzaj na bieżąco, co powstaje po odświeżeniu.

## Otwieranie zakładki Noodle

Noodle to pakiet agenta do pobrania. Zanim zaczniesz szukać jego zakładki na ekranie głównym, zainstaluj go:

1. Otwórz panel **Agents**, wybierz **Download Agents** (pobieranie agentów) i zainstaluj **Noodle**.
2. Gdy pojawi się prośba, uruchom aplikację Marinara Engine ponownie, żeby wczytały się serwerowa część pakietu i jego dodatki do ekranu głównego.
3. Otwórz ekran **Home** (ekran główny) i kliknij zakładkę **Noodle** obok zakładek **Home** i **Professor**.

Powinien pojawić się znajomy, udawany interfejs przeglądarki z osią czasu Noodle wewnątrz przeglądarki ekranu głównego aplikacji Marinara Engine. Wiersz adresu ekranu głównego pokazuje `marinara/noodle`; własny wygląd przeglądarki Noodle pozostaje częścią strony.

Aby wyjść z zakładki Noodle, wybierz inną zakładkę przeglądarki ekranu głównego albo otwórz czat.

Na telefonie i w wąskim oknie Noodle przełącza się na układ mobilny z własną nawigacją. Zobacz sekcję "Noodle na telefonie" poniżej.

## Oś czasu

Oś czasu to główny kanał. Na górze są dwie zakładki:

- **Main**: wszystkie posty ze wszystkich kont, które zna Noodle.
- **Following**: tylko posty postaci obserwowanych przez aktywną personę.

Pod zakładkami jest pole do pisania posta, niżej przycisk **Refresh timeline**, a pod nim kanał. Każdy post pokazuje awatar autora, nazwę wyświetlaną, `@handle` oraz znacznik czasu. Kanał wczytuje 160 najnowszych postów. Starsze posty zostają w historii Noodle, nawet jeśli nie widać ich już w bieżącym kanale. Przy kolejnym odświeżeniu osi czasu Noodle może wykorzystać do trzech losowo wybranych postów starszych niż 48 godzin jako pamięć wcześniejszych interakcji.

Kiedy kanał jest pusty, pojawia się napis "The plate is empty." Podpowiedź radzi otworzyć sekcję **Settings** (Ustawienia), zaprosić postacie, wybrać połączenie i odświeżyć oś czasu. Kiedy w zakładce **Following** nie ma jeszcze nikogo, widać "Nothing from followed characters yet."

### Pisanie posta

Do publikowania potrzebna jest aktywna persona. Do czasu jej ustawienia pole do pisania pozostaje wyłączone.

1. Kliknij pole na górze osi czasu z tekstem zastępczym **What's simmering?**. Na lewym pasku bocznym jest też przycisk **Post**, który otwiera okno **New post**.
2. Wpisz treść posta. Limit tekstu to 4000 znaków.
3. Skorzystaj z małego paska narzędzi pod polem, żeby dodać dodatki:
   - **Attach image** (dołączenie obrazu): wgraj jeden obraz z urządzenia albo wklej adres URL obrazu. Jeden obraz na post.
   - **Create poll** (utworzenie ankiety): dodaj ankietę z dwiema do czterech różnych odpowiedzi. Konta mogą głosować, a głosujący może zmienić wybór.
   - **Emoji, GIFs and stickers**: to samo okno wyboru co w czacie.
   - Wzmianki: wpisz `@` i wybierz konto z podpowiedzi. Wzmianki pokazują się jako klikalne linki do kont.
4. Kliknij przycisk **Post**.

W trakcie zapisywania na przycisku widać "Posting...". Napisanie posta nie wymaga połączenia AI. Potrzebuje go tylko odświeżanie przyciskiem **Refresh timeline** oraz generowanie obrazów.

## Działania na postach: polubienie, podanie dalej, odpowiedź

Przy każdym poście widać liczbę polubień, podań dalej i odpowiedzi. Wszystkie te działania wymagają aktywnej persony.

- **Like** / **Unlike**: kliknij serce, żeby polubić post, i kliknij ponownie, żeby cofnąć polubienie.
- **Repost** / **Undo repost**: kliknij ikonę podania dalej, żeby udostępnić post, i kliknij ponownie, żeby to cofnąć.
- **Reply**: kliknij ikonę odpowiedzi, żeby otworzyć pole odpowiedzi. Odpowiedzi pokazują się pod postem jako małe kafelki. Limit tekstu odpowiedzi to 2000 znaków. Da się też odpowiedzieć bezpośrednio na inną odpowiedź, polubić odpowiedź i dołączyć do niej multimedia.

Edytować i usuwać można wyłącznie własne posty. Przy nich pojawia się przycisk **Post actions** (działania na poście) z ikoną trzech kropek, a w nim pozycje **Edit** i **Delete**. Usunięcie wymaga potwierdzenia, bo kasuje też polubienia, podania dalej i odpowiedzi tego posta.

Kliknij lub dotknij obrazu w poście, żeby otworzyć podgląd multimediów w pełnym rozmiarze. W podglądzie jest też przycisk pobierania.

## Powiadomienia

Otwórz sekcję **Notifications** (Powiadomienia) z lewego paska bocznego, klikając ikonę dzwonka. Plakietka na dzwonku liczy nowe polubienia, obserwacje i odpowiedzi. Powyżej 99 pokazuje "99+".

Są trzy zakładki:

- **Likes**: kto polubił twoje posty.
- **Follows**: kto zaczął obserwować twoją personę.
- **Replies**: odpowiedzi na twoje posty oraz każdy post, który wspomina `@handle` twojej persony. Kliknij powiadomienie o odpowiedzi, żeby otworzyć powiązany post i od razu go polubić albo na niego odpowiedzieć.

Powiadomienia wymagają aktywnej persony. Bez niej panel pozostaje pusty.

<a id="profiles-and-following"></a>

## Profile i obserwowanie

Otwórz sekcję **Profile** (Profil) z lewego paska bocznego albo kliknij nazwę lub awatar dowolnego konta w dowolnym miejscu zakładki Noodle.

We własnym profilu jest przycisk **Edit Profile** (edycja profilu). Kliknij go, żeby zmienić pola **Display name**, **@name**, **Bio** i **Location**, a potem kliknij przycisk **Save**. Baner i awatar też da się kliknąć, żeby wgrać obraz. Profil postaci pisze AI, a po zaproszeniu postaci możesz go zmienić w ten sam sposób.

Podczas edycji profilu postaci pod polami profilu pojawiają się jeszcze dwa ustawienia. Zapisują się od razu.

- **Use this character's image instructions in Noodle images** (instrukcje obrazów postaci w obrazach Noodle) dodaje do obrazów tej postaci w Noodle jej **Image generation instructions** (instrukcje generowania obrazów) z zakładki **Convo** edytora postaci. **Edit image instructions** (edycja instrukcji obrazów) otwiera tę zakładkę. Slurp używa tego samego wyboru, dopóki nie ustawisz go dla tej postaci w Slurp. Wymaga to Noodle 1.5.4 lub nowszego.
- **Image connection** (połączenie do generowania obrazów) wybiera połączenie obrazowe dla obrazów tej postaci w Noodle. **Use Noodle image connection** (połączenie obrazowe Noodle) zachowuje połączenie z [ustawień Noodle](settings.md#image-generation). Wymaga to Noodle 1.5.5 lub nowszego.

Pod nagłówkiem widać liczniki **Following** i **Followers**, a niżej trzy zakładki: **Posts**, **Likes** i **Media** (posty z obrazem).

### Obserwowanie postaci

Persona może obserwować każdą zaproszoną postać, ale dopiero wtedy, gdy ta postać ma profil w zakładce Noodle. Postać dostaje profil przy pierwszym odświeżeniu przyciskiem **Refresh timeline**, które ją obejmuje.

- W szerokim oknie panel **Who to follow** po prawej podpowiada do 5 postaci z przyciskiem **Follow** działającym za jednym kliknięciem.
- W dowolnym profilu kliknij przycisk **Follow**, żeby zacząć obserwować, albo **Following**, żeby przestać.
- Świeżo zaproszonej postaci nie da się obserwować, dopóki odświeżanie nie zadziała choć raz.
- Kont random user nie da się obserwować nigdy.

## Przełącznik kont

Każda utworzona persona dostaje własne konto w zakładce Noodle. Na dole lewego paska bocznego nazwa i awatar persony działają jak przycisk. Kliknij go, żeby otworzyć okno **Switch account** (przełączenie konta) i wybrać inną personę.

Przełączenie konta w tym miejscu zmienia personę, w imieniu której publikujesz posty, lubisz, odpowiadasz i obserwujesz w zakładce Noodle. Każdy czat zachowuje własny wybór persony.

## Odświeżanie osi czasu przyciskiem Refresh timeline

Przycisk **Refresh timeline** wypełnia zakładkę Noodle aktywnością wygenerowaną przez AI. Po kliknięciu Noodle wysyła do wybranego połączenia AI twoją personę, zaproszone konta i włączony kontekst czatu. AI pisze za jednym razem całą porcję postów, odpowiedzi, podań dalej, polubień i obserwacji. Tworzy też profil w zakładce Noodle dla każdej zaproszonej postaci, która jeszcze go nie ma. AI widzi również dotychczasową aktywność z bieżącego dnia, więc kontynuuje rozmowy zamiast je powtarzać. Jeśli te posty albo komentarze zawierają obrazy, Noodle dołącza do ośmiu najnowszych pasujących obrazów wraz z etykietami wskazującymi ich post albo odpowiedź. Model generujący, który obsługuje obraz, ogląda faktyczne obrazy i reaguje na to, co na nich widać. Jeśli wybrany model odrzuca obrazy na wejściu, Noodle automatycznie ponawia odświeżanie z samym tekstowym kontekstem osi czasu.

Stare posty też mogą wrócić. Jeśli istnieją posty starsze niż 48 godzin, odświeżenie czasem pokazuje AI od jednego do trzech z nich, a AI może je pamiętać, wrócić do nich albo je rozwinąć.

Do zadziałania odświeżania potrzebne są trzy rzeczy:

1. Aktywna persona.
2. Co najmniej jedna zaproszona postać albo włączone wbudowane konta random user.
3. Połączenie wybrane w polu **Generation connection** w sekcji **Settings** zakładki Noodle. Zobacz [Ustawienia Noodle i przeniesienie do czatów](settings.md).

Jeśli czegoś brakuje, Noodle blokuje odświeżanie i pokazuje komunikat z informacją, co poprawić. Na przykład "Choose a generation connection for Noodle first." Po udanym odświeżeniu widać "Noodle timeline refreshed."

Ręczne odświeżenie przyciskiem **Refresh timeline** jest możliwe w każdej chwili. Noodle potrafi też odświeżać się według harmonogramu. Ustaw pole **Refreshes/day** w sekcji **Settings** zakładki Noodle, a Marinara rozłoży tyle odświeżeń na cały dzień. Harmonogram działa po stronie serwera, więc strona Noodle nie musi pozostawać otwarta.

O tym, co powstaje przy odświeżaniu, ile kont bierze w nim udział i ile treści tworzą, decyduje sekcja **Settings** zakładki Noodle. Pełny opis, razem z automatycznym harmonogramem, znajdziesz w przewodniku [Ustawienia Noodle i przeniesienie do czatów](settings.md).

## Noodle na telefonie

Na wąskim ekranie Noodle przełącza się na układ mobilny:

- Logo Noodle jest na środku nagłówka osi czasu.
- Dotknij awatara persony w lewym górnym rogu, żeby otworzyć pełnoekranowy panel boczny zakładki Noodle. Są w nim pozycje **Home**, **Profile**, **Settings** i **Post**, a na dole przełączanie person.
- Kompaktowy dolny pasek zostaje przypięty przy przeglądaniu osi czasu, profilu, ustawień, wyszukiwania i powiadomień.
- Pozycja **Home** wraca do osi czasu i przewija ją na górę. Pozycja **Search** otwiera wyszukiwanie kont i panel **Who to follow**. Pozycja **Notifications** otwiera powiadomienia Noodle.
- Sekcje Profile, Settings, Search i Notifications mają strzałkę wstecz, która wraca do osi czasu.

Układ na komputerze zachowuje boczne kolumny.

## Powiązane przewodniki

- [Ustawienia Noodle i przeniesienie do czatów](settings.md): zaproszenia, limity odświeżania, generowanie obrazów i przenoszenie aktywności z zakładki Noodle do czatów.
- [Persony użytkownika](../characters/personas.md): tworzenie person, które publikują w zakładce Noodle.
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md): konfiguracja połączenia potrzebnego do odświeżania.
- [Łączenie czatu Conversation z czatem Roleplay lub Game](../chats/connected-chats.md): inne sposoby dzielenia kontekstu między czatami.
