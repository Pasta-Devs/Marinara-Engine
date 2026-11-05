# Noodle: wbudowana oś czasu społecznościowa

Noodle to opcjonalny, udawany kanał społecznościowy wewnątrz aplikacji Marinara Engine. Przypomina oś czasu z serwisów Twitter lub X, ale każde konto i każdy post należy do twojego własnego świata: do persony, do twoich postaci i do asystentki Professor Mari. Z tego przewodnika dowiesz się, jak zainstalować i otworzyć Noodle oraz jak publikować posty, obserwować konta i odświeżać oś czasu.

## Czym jest Noodle

Noodle to udawany kanał działający wewnątrz aplikacji. Nie łączy się z żadną prawdziwą siecią społecznościową, a nic, co w nim robisz, nie trafia do internetu.

Każde konto pochodzi z twojej aplikacji:

- Twoja **persona**, czyli postać, w którą się wcielasz w czacie. Zobacz [Persony](../characters/personas.md).
- Dowolne postacie zaproszone z biblioteki.
- **Professor Mari**, wbudowana asystentka. Zobacz [Professor Mari](../home/professor-mari.md).
- Niewielki zestaw wbudowanych kont typu "random user", jeśli je włączysz.

Posty piszesz ręcznie jako persona. Możesz też kliknąć przycisk **Refresh timeline** (odświeżenie osi czasu), żeby model AI napisał porcję postów, odpowiedzi, polubień i obserwacji dla zaproszonych kont. Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

Aktywność w zakładce Noodle jest domyślnie wyłączona. Nic się nie generuje, dopóki nie zaprosisz postaci (albo nie włączysz kont random user) i nie klikniesz przycisku **Refresh timeline**.

> **Uwaga:** Wbudowane instrukcje, które Noodle wysyła do AI, traktują każde konto na publicznej osi czasu jako osobę dorosłą (18+) i dopuszczają posty oraz obrazy dla dorosłych, także dosadne. Nie da się tego wyłączyć. Jeśli nie chcesz treści dla dorosłych, sprawdzaj, co powstaje po każdym odświeżeniu. Noodle ma też osobną oś czasu dla dorosłych, NoodleR, ukrytą za weryfikacją wieku i ustawieniem **Enable NoodleR** (włączenie NoodleR), które jest domyślnie wyłączone. Ten przewodnik opisuje publiczną oś czasu.

## Otwieranie zakładki Noodle

Noodle to pakiet agenta do pobrania. Wystarczy zainstalować go raz.

1. Otwórz panel **Agents** (agenci) ikoną Sparkles w zakładkach po prawej stronie i kliknij **Agent Organizer** (organizowanie agentów).
2. Znajdź **Noodle** i kliknij **Get** (pobranie).
3. Gdy pojawi się prośba, uruchom aplikację Marinara Engine ponownie, żeby wczytał się kod serwerowy pakietu. Aby to zrobić, zamknij aplikację i uruchom ją tak jak zwykle. Zobacz [Instalacja aplikacji Marinara Engine](../INSTALLATION.md).
4. Otwórz ekran **Home** (ekran główny) i kliknij zakładkę **Noodle** obok zakładek **Home** i **Professor**.

Oś czasu Noodle otwiera się wewnątrz przeglądarki ekranu głównego aplikacji Marinara Engine. Aby wyjść z zakładki Noodle, wybierz inną zakładkę ekranu głównego albo otwórz czat. Na telefonie i w wąskim oknie Noodle używa układu mobilnego (zobacz [Noodle na telefonie](#noodle-on-a-phone)).

## Oś czasu

Oś czasu to główny kanał. Na górze są dwie zakładki.

- **Main**: wszystkie posty ze wszystkich kont, które zna Noodle.
- **Following**: tylko posty postaci obserwowanych przez aktywną personę.

Pod zakładkami są pole do pisania posta, przycisk **Refresh timeline** i kanał. Każdy post pokazuje awatar autora, nazwę wyświetlaną, `@handle` i znacznik czasu. Kanał wczytuje 160 najnowszych postów. Starsze posty zostają w historii Noodle. Przy późniejszym odświeżeniu Noodle może wykorzystać do trzech losowych postów starszych niż 48 godzin jako pamięć wcześniejszych interakcji.

Pusty kanał pokazuje napis "The plate is empty." ze wskazówką, żeby otworzyć **Settings** (Ustawienia), zaprosić postacie, wybrać model i odświeżyć oś czasu. Pusta zakładka **Following** pokazuje "Nothing from followed characters yet."

### Pisanie posta

Do publikowania potrzebna jest aktywna persona. Do czasu jej ustawienia pole do pisania pozostaje wyłączone. Publikowanie nie wymaga modelu AI. Potrzebują go tylko przycisk **Refresh timeline** i generowanie obrazów.

1. Kliknij pole na górze osi czasu (tekst zastępczy **What's simmering?**). Możesz też kliknąć **Post** na lewym pasku bocznym, co otwiera okno **New post**.
2. Wpisz treść posta. Limit to 4000 znaków.
3. Skorzystaj z paska narzędzi pod polem, żeby dodać do posta coś więcej.
   - **Attach image** (dołączenie obrazu): wgraj jeden obraz albo wklej adres URL obrazu. Jeden obraz na post.
   - **Create poll** (utworzenie ankiety): od dwóch do czterech różnych odpowiedzi. Konta mogą głosować, a głosujący może zmienić wybór.
   - Emoji, GIF-y i naklejki: to samo okno wyboru co w czacie.
   - Wzmianki: wpisz `@` i wybierz konto. Wzmianki są klikalne.
4. Kliknij **Post**. W trakcie zapisywania przycisk pokazuje "Posting...".

### Polubienie, podanie dalej i odpowiedź

Przy każdym poście widać liczbę polubień, podań dalej i odpowiedzi. Te działania wymagają aktywnej persony.

- **Like** i **Unlike**: kliknij serce.
- **Repost** i **Undo repost**: kliknij ikonę podania dalej.
- **Reply**: kliknij ikonę odpowiedzi. Odpowiedzi pokazują się pod postem jako małe kafelki. Limit to 2000 znaków. Możesz odpowiedzieć na odpowiedź, polubić odpowiedź i dołączyć do niej multimedia.

Przy twoich własnych postach jest przycisk **Post actions** (działania na poście, trzy kropki) z pozycjami **Edit** i **Delete**. Usunięcie wymaga potwierdzenia, bo kasuje też polubienia, podania dalej i odpowiedzi tego posta. Kliknij obraz w poście, żeby otworzyć podgląd w pełnym rozmiarze, w którym jest przycisk pobierania.

### Powiadomienia

Otwórz **Notifications** (powiadomienia, ikona dzwonka) na lewym pasku bocznym. Plakietka liczy nowe polubienia, obserwacje i odpowiedzi, a powyżej 99 pokazuje "99+". Trzy zakładki je porządkują.

- **Likes**: kto polubił twoje posty.
- **Follows**: kto zaczął obserwować twoją personę.
- **Replies**: odpowiedzi na twoje posty oraz każdy post, który wspomina `@handle` twojej persony. Kliknij powiadomienie, żeby otworzyć post.

Powiadomienia wymagają aktywnej persony. Bez niej panel jest pusty.

<a id="profiles-and-following"></a>

## Profile i obserwowanie

Otwórz **Profile** (profil) na lewym pasku bocznym albo kliknij nazwę lub awatar dowolnego konta.

We własnym profilu masz przycisk **Edit Profile** (edycja profilu). Zmień pola **Display name**, **@name**, **Bio** i **Location**, a potem kliknij **Save**. Możesz też kliknąć baner albo awatar, żeby wgrać obraz. Profil postaci pisze AI, a po zaproszeniu postaci możesz go edytować w ten sam sposób.

Podczas edycji profilu postaci pod polami pojawiają się jeszcze dwa ustawienia, które zapisują się od razu.

- **Use this character's image instructions in Noodle images** (instrukcje obrazów postaci w obrazach Noodle): dodaje do obrazów tej postaci w Noodle jej **Image generation instructions** (instrukcje generowania obrazów) z zakładki **Convo** edytora postaci. **Edit image instructions** (edycja instrukcji obrazów) otwiera tę zakładkę. Slurp używa tego samego wyboru, dopóki nie ustawisz go dla tej postaci w Slurp. Wymaga Noodle 1.5.4 lub nowszego.
- **Image connection** (połączenie do generowania obrazów): wybiera model obrazów dla obrazów tej postaci w Noodle. **Use Noodle image connection** (połączenie obrazowe Noodle) zachowuje model z [ustawień Noodle](noodle-settings.md#image-generation). Wymaga Noodle 1.5.5 lub nowszego.

Profil pokazuje też liczniki **Following** i **Followers** oraz trzy zakładki: **Posts**, **Likes** i **Media** (posty z obrazem).

### Obserwowanie postaci

Persona może obserwować każdą zaproszoną postać, która ma profil w Noodle. Postać dostaje profil przy pierwszym odświeżeniu przyciskiem **Refresh timeline**, które ją obejmuje, więc świeżo zaproszonej postaci nie da się obserwować, dopóki odświeżanie nie zadziała choć raz.

- W szerokim oknie panel **Who to follow** po prawej proponuje do 5 postaci z przyciskiem **Follow**.
- W dowolnym profilu kliknij **Follow** albo **Following**, żeby zacząć albo przestać obserwować.
- Kont random user nie da się obserwować nigdy.

### Przełączanie kont

Każda persona ma własne konto w Noodle. Na dole lewego paska bocznego nazwa i awatar persony tworzą przycisk. Kliknij go, żeby otworzyć okno **Switch account** (przełączenie konta) i wybrać inną personę. Zmienia to personę, w imieniu której publikujesz posty, lubisz, odpowiadasz i obserwujesz w Noodle. Każdy czat zachowuje własną personę.

## Odświeżanie osi czasu

Przycisk **Refresh timeline** wypełnia zakładkę Noodle aktywnością napisaną przez AI. Noodle wysyła twoją personę, zaproszone konta i włączony kontekst czatu do wybranego modelu. AI pisze porcję postów, odpowiedzi, podań dalej, polubień i obserwacji. Tworzy też profil w Noodle dla każdej zaproszonej postaci, która go nie ma. Widzi dotychczasową aktywność z bieżącego dnia, więc kontynuuje rozmowy zamiast je powtarzać. Jeśli posty albo komentarze mają obrazy, Noodle dołącza do ośmiu najnowszych pasujących obrazów. Model, który widzi obrazy, może zareagować na to, co na nich widać. Jeśli model odrzuca obrazy, Noodle ponawia odświeżanie z samym tekstem.

Zanim zaczniesz, potrzebujesz trzech rzeczy. Postacie zapraszasz w **Settings** (zobacz [Invites](noodle-settings.md#invites)).

1. Aktywna persona.
2. Co najmniej jedna zaproszona postać albo włączone konta random user.
3. Model wybrany w polu **Generation model** (model do generowania) w **Settings** zakładki Noodle. Zobacz [Ustawienia Noodle i przeniesienie do czatów](noodle-settings.md).

Jeśli czegoś brakuje, Noodle blokuje odświeżanie i mówi, co poprawić, na przykład "Choose a generation connection for Noodle first." Po udanym odświeżeniu widać "Noodle timeline refreshed."

Ręcznie możesz odświeżać w każdej chwili. Noodle potrafi też odświeżać się według własnego harmonogramu. Ustaw pole **Refreshes/day** w **Settings** zakładki Noodle, a Marinara rozłoży tyle odświeżeń na cały dzień, nawet gdy strona Noodle jest zamknięta. Limity i harmonogram opisuje przewodnik [Ustawienia Noodle i przeniesienie do czatów](noodle-settings.md).

<a id="noodle-on-a-phone"></a>

## Noodle na telefonie

Na wąskim ekranie Noodle przełącza się na układ mobilny.

- Logo Noodle jest na środku nagłówka osi czasu.
- Dotknij awatara persony w lewym górnym rogu, żeby otworzyć pełnoekranowy panel boczny z pozycjami **Home**, **Profile**, **Settings** i **Post**, a na dole z przełączaniem person.
- Kompaktowy dolny pasek zostaje przypięty w widokach osi czasu, profilu, ustawień, wyszukiwania i powiadomień. Pozycja **Home** wraca do osi czasu i przewija ją na górę. Pozycja **Search** otwiera wyszukiwanie kont i panel **Who to follow**. Pozycja **Notifications** otwiera powiadomienia.
- Widoki Profile, Settings, Search i Notifications mają strzałkę wstecz do osi czasu.

## Powiązane przewodniki

- [Ustawienia Noodle i przeniesienie do czatów](noodle-settings.md)
- [Persony](../characters/personas.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Łączenie czatu Conversation z czatem Roleplay lub Game](../chats/connected-chats.md)
