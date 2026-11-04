# Czaty grupowe w trybach Conversation i Roleplay

Czat grupowy to każdy czat Conversation lub Roleplay z co najmniej dwiema postaciami. Ten przewodnik pokazuje, jak go utworzyć, jak zarządzać uczestnikami i jak wybierać, kto zabiera głos. Tryb Game Mode ma własny system drużyny i ten przewodnik go nie opisuje.

Nie ma osobnego przycisku "czat grupowy". Czat staje się grupowy, gdy dodasz do niego drugą postać. Czat grupowy to nie **Folder** (folder, zapisana lista postaci do wielokrotnego użytku) ani **Chat Branch** (gałąź czatu, alternatywna wersja jednego czatu).

## Tworzenie czatu grupowego

1. W panelu **Chats** (czaty) kliknij przycisk **+** dla wybranego trybu (**New Conversation** albo **New Roleplay**).
2. Otworzy się kreator. W kroku **Persona & Characters** (persona i postacie) wpisz nazwę w polu **Search characters...** i kliknij postać, aby ją dodać.
3. Tak samo dodaj drugą postać.
4. Zakończ kreator, aby otworzyć czat.

Etykieta nad listą wyboru się zmienia. W trybie Conversation pokazuje **Group Chat** (czat grupowy) i liczbę uczestników. W trybie Roleplay pokazuje **Characters** (postacie) i tę liczbę. Jeśli nie zmienisz nazwy czatu, Marinara nazwie go imionami postaci, na przykład "Alice, Bob, Carol".

Liczba postaci nie ma sztywnego limitu. Więcej postaci oznacza dłuższy prompt (tekst, który Marinara wysyła do AI) i wyższy koszt jednej odpowiedzi, więc dodawaj tylko te postacie, których scena potrzebuje.

Aby dodać naraz cały folder, w tym samym kroku rozwiń listę **Add from Folder** (dodanie z folderu), wybierz folder i kliknij **Add** (dodaj). Postacie, które już są w czacie, zostają pominięte. Ta kontrolka pojawia się tylko wtedy, gdy masz co najmniej jeden folder. Zobacz [Porządkowanie biblioteki postaci](../characters/library-organization.md). Wiersz **Random** (losowo, z etykietą **Dice pick**) dodaje jedną losową postać, której jeszcze nie ma w czacie.

## Zarządzanie uczestnikami

Otwórz **Chat Settings** (ustawienia czatu) i znajdź sekcję **Characters**. Nie ma jej w trybie Game Mode. Każdy wiersz uczestnika ma awatar, imię, uchwyt przeciągania, ikonę oka i ikonę kosza.

| Cel | Co zrobić |
| --- | --- |
| Dodanie postaci | Kliknij **Add Character** (dodanie postaci) i wyszukaj postać. |
| Dodanie folderu | Kliknij **Add Character**, a potem **Add all** (dodanie wszystkich) w wierszu folderu. |
| Zmiana kilku postaci naraz | Kliknij imię uczestnika. Otworzy się ta sama lista wyboru. |
| Usunięcie postaci | Kliknij ikonę kosza z podpowiedzią **Remove from chat**. |
| Zmiana kolejności | Przeciągnij uchwyt z podpowiedzią **Drag to reorder**. Przy kolejności **Sequential** postacie odpowiadają w tej kolejności. |
| Czasowe wyłączenie | Kliknij oko z podpowiedzią **Disable in chat**. Kliknij ponownie, aby włączyć postać (podpowiedź **Enable in chat**). |

Wyłączona postać zostaje na liście, ale nie bierze udziału w żadnej odpowiedzi. Jej karta nie trafia do modelu i nie da się jej wybrać jako mówiącej. Jeśli wyłączysz wszystkie postacie, Marinara traktuje je wszystkie jako aktywne, więc odpowiedź nigdy nie jest pusta. Ten stan zapisuje się osobno dla każdego czatu i niczego nie zmienia gdzie indziej. W grupie Roleplay w trybie Merged może go ustawiać za ciebie [Automate active characters](#automate-active-characters-merged-only).

<a id="choose-who-speaks"></a>

## Kto zabiera głos

Otwórz **Chat Settings → Group Chat** (ustawienia czatu, czat grupowy). Ta sekcja pojawia się tylko wtedy, gdy w czacie są co najmniej dwie postacie. Oba tryby korzystają z tego samego przełącznika **Mode** (tryb).

- Jedna odpowiedź mówi głosem wszystkich postaci. W trybie Roleplay ta opcja to **Merged (Narrator)** (odpowiedź scalona z narracją), a w trybie Conversation **Grouped** (grupowo). Jest domyślna. W trybie Roleplay narrator to głos opisujący scenę i jest częścią tej samej odpowiedzi.
- **Individual** (osobno) daje każdej postaci własną odpowiedź.

W trybie Conversation przełączenie na **Individual** pokazuje ostrzeżenie **Individual replies can use many tokens**. Każda odpowiadająca postać to osobne zapytanie do modelu, a duże grupy z funkcją Autonomous Messaging szybko zużywają tokeny.

### **Automate active characters** (Roleplay, tylko przy **Merged**)

To ustawienie włącza i wyłącza za ciebie postacie w dużej obsadzie. Zobacz [Automate active characters](#automate-active-characters-merged-only) na końcu tego przewodnika.

### **Color Dialogues** (Roleplay, tylko przy **Merged**)

**Color Dialogues** (kolorowe dialogi) jest domyślnie wyłączone. Po włączeniu kwestie każdej postaci mają jej własne kolory z zakładki **Colors** (kolory) w edytorze postaci. W grupie Conversation kwestie same dostają kolory mówiących i nie ma przełącznika.

<a id="response-order-individual-only"></a>

### **Response Order** (tylko przy **Individual**)

Gdy **Mode** ma wartość **Individual**, pojawia się **Response Order** (kolejność odpowiedzi). Domyślna jest kolejność **Sequential**.

| Kolejność | Co się dzieje |
| --- | --- |
| **Sequential** | Postacie odpowiadają po kolei, zgodnie z kolejnością listy **Characters**. W trybie Conversation postacie offline są pomijane. |
| **Smart** | Krótkie, ukryte wywołanie modelu wybiera, kto odpowiada następny, zwykle jedną postać. Wzmianka `@Alice` w twojej wiadomości unieważnia ten wybór. W trybie Conversation bierze pod uwagę rozmowę, status z harmonogramu i rozmowność. |
| **Manual** | Nikt nie odpowiada sam z siebie. W trybie Roleplay użyj selektora **Trigger Response** (wywołanie odpowiedzi). W trybie Conversation wywołaj jedną lub więcej postaci wzmianką `@mention` albo użyj selektora. |

Przy kolejności **Smart** model może ustawić w kolejce kilka postaci. Od razu odpowiada tylko pierwsza. Aby wygenerować odpowiedź następnej postaci z kolejki, użyj selektora **Trigger Response** albo wyślij pustą wiadomość.

Jeśli masz wybrany [Decision model](../connections/decision-models.md) (model decyzyjny), możesz włączyć pod nim **Also use it to pick who speaks in Smart response order** (wybieraj nim także mówiącego w kolejności Smart). Kolejność Smart prosi wtedy o wynik tak/nie dla każdego kandydata.

- Pytania współdzielą pięć ostatnich wiadomości i listę kandydatów z imieniem, statusem, aktywnością, rozmownością i krótkim fragmentem osobowości każdego z nich. Zdalna usługa też otrzymuje tę listę. Zobacz [Co widzi model](../connections/decision-models.md#what-the-model-sees).
- Szybkość i koszt zależą od modelu i liczby kandydatów.
- W trybie Roleplay Marinara wybiera najbardziej prawdopodobnego mówiącego. W trybie Conversation odpowiada każdy, kto ma powód, zaczynając od najbardziej prawdopodobnego. Postać, która właśnie mówiła, czeka, jeśli ktoś inny ma powód odpowiedzieć.
- Jeśli model decyzyjny nie odpowie, kolejność Smart wykonuje swoje zwykłe wywołanie modelu.

W trybie Roleplay przy **Individual** z kolejnością **Smart** lub **Manual** pierwszą opcją selektora jest **Smart**, oznaczona ikoną osób. Prosi model o wybranie następnego mówiącego dla tej jednej odpowiedzi. Zapisana kolejność się nie zmienia.

### Ręczne wywołanie odpowiedzi

Użyj selektora **Trigger Response**, aby wybrać mówiącego. Na komputerze to przycisk obok **Send** (wyślij), z etykietą **Trigger character response**. Na telefonie znajdziesz go pod nagłówkiem **Trigger Response** w tacce narzędzi otwieranej z paska wiadomości. Aby wskazać mówiącego w tekście, wpisz `@` i imię postaci. Pojawi się lista autouzupełniania.

### Więcej ustawień trybu Individual

- **Add Turn To Prompt** (dodanie tury do promptu) jest domyślnie włączone. Dodaje krótką instrukcję z imieniem postaci, która ma odpowiedzieć.
- **Name Prefix History** (prefiksy imion w historii, tylko Roleplay) jest domyślnie wyłączone. Zmienia sposób oznaczania wcześniejszych wiadomości imionami mówiących. Zostaw je wyłączone, chyba że któraś postać ciągle myli, kto co powiedział.

### **Scenario Override** (Roleplay)

**Scenario Override** (nadpisanie scenariusza) daje całej grupie jeden wspólny scenariusz. Tekst w polu zastępuje w prompcie własny scenariusz każdej postaci. Puste pole zostawia scenariusze bez zmian. Nie ma przełącznika. Aby edytować w większym oknie, kliknij ikonę rozwijania (podpowiedź **Expand editor**, okno z tytułem **Group Scenario Override**). Ten tekst należy do jednego czatu i profile ustawień go nie obejmują.

### **Character Exchanges** (Conversation)

Włącz **Character Exchanges** (rozmowy między postaciami) w **Chat Settings → Autonomous Messaging** (ustawienia czatu, wiadomości autonomiczne), aby postacie rozmawiały ze sobą podczas twojej nieobecności. Ta opcja jest domyślnie wyłączona i pojawia się tylko w czacie grupowym. Działa tylko wtedy, gdy aplikacja Marinara Engine jest otwarta w przeglądarce, i dzieli dzienny limit wiadomości z wiadomościami autonomicznymi. Działa z harmonogramami postaci i bez nich. W grupie **Individual** rozmowy między postaciami i odpowiedzi na wzmianki `@mention` nigdy nie wykorzystują ostatniego dziennego odezwania się grupy.

## Ustawienia i wartości domyślne

| Ustawienie | Gdzie | Domyślnie |
| --- | --- | --- |
| **Mode** | sekcja Group Chat | **Merged (Narrator)** w trybie Roleplay, **Grouped** w trybie Conversation |
| **Color Dialogues** | Roleplay, Merged | wyłączone |
| **Automate active characters** | Roleplay, Merged | Off |
| **Response Order** | Individual | Sequential |
| **Add Turn To Prompt** | Individual | włączone |
| **Name Prefix History** | Roleplay, Individual | wyłączone |
| **Scenario Override** | Roleplay | puste |
| **Character Exchanges** | Conversation, Autonomous Messaging | wyłączone |

Profile ustawień zapisują te ustawienia z wyjątkiem **Scenario Override** i przypięć automatyzacji. Zobacz [Profile ustawień](settings-profiles.md).

## Szczegóły

<a id="automate-active-characters-merged-only"></a>

### **Automate active characters** (tylko przy **Merged**)

W trybie Merged karta każdej aktywnej postaci trafia do promptu przy każdej odpowiedzi. W trybie Roleplay **Automate active characters** (automatyzowanie aktywnych postaci) może włączać i wyłączać karty za ciebie, żeby duża obsada nie zapełniała kontekstu. Ma trzy opcje i domyślnie jest ustawione na **Off**.

| Opcja | Co robi |
| --- | --- |
| **Off** | Aktywne postacie wybierasz przełącznikami z okiem. |
| **Decision model** | Przed każdą odpowiedzią twój [Decision model](../connections/decision-models.md) odpowiada na jedno pytanie tak/nie o każdą postać: czy ta postać jest w scenie, którą kontynuuje odpowiedź, albo do niej wchodzi? Postać, o której tylko się mówi albo którą ktoś wspomina, pozostaje wyłączona. |
| **Character Tracker** | O tym, kto jest aktywny, decydują obecne postacie z ostatniej odpowiedzi według agenta [Character Tracker](../agents/built-in-agents.md#character-tracker). Nie wymaga to dodatkowego wywołania modelu, ale działa z jedną turą opóźnienia: postać, która wchodzi teraz, zostaje włączona dopiero przy następnej odpowiedzi. |

Wskazówka pod ustawieniem informuje, kiedy czegoś brakuje: nie wybrano modelu decyzyjnego, Character Tracker jest wyłączony w tym czacie albo tracker działa ręcznie i zmienia listę dopiero po uruchomieniu.

- **Przypięcia.** Gdy automatyzacja jest włączona, każdy wiersz postaci pokazuje pinezkę na lewo od oka. Kliknij ją, aby przypiąć postać w obecnym stanie, włączoną lub wyłączoną; automatyzacja zostawia ją wtedy w spokoju. Ręczne przełączenie oka też przypina postać. Kliknij pinezkę ponownie, aby odpiąć postać. Przełączenie automatyzacji na **Off** usuwa wszystkie przypięcia.
- **Narrator pozostaje aktywny.** Wyznaczony Narrator nigdy nie jest wyłączany.
- **Brak odpowiedzi zostawia listę.** W trybie **Decision model**, jeśli model nie odpowie, używana jest ostatnia scena z Character Tracker, o ile istnieje. Dotyczy to też modelu, który najpierw myśli, chyba że włączone jest **Also gate agents that run before the reply** (sprawdzaj także agentów działających przed odpowiedzią), oraz obsady zbyt dużej dla danych wejściowych modelu decyzyjnego. Jeśli żadne z nich nie da odpowiedzi, lista zostaje taka, jaka jest.
- **Wynik bez aktywnych postaci jest ignorowany.** Wynik, który wyłączyłby wszystkich, nie zostaje zastosowany.
- **Agent Character Activity ma pierwszeństwo.** W czacie z własnym agentem używającym typu wyniku **Character Activity** sterowanie zostaje przy tym agencie.

Character Tracker zapisuje własną nazwę każdej postaci. Marinara dopasowuje ją do karty najpierw po identyfikatorze karty, potem po imieniu, a potem po aliasach imienia z zakładki **Colors**. Lista trackera, która nie wymienia żadnej postaci z czatu, zachowuje bieżącą listę. Automatyzacja działa przed każdą odpowiedzią, swipe'em i ponownym generowaniem, a pomija **Continue** i funkcję Impersonate. Ustawienie zapisuje się w profilach ustawień. Przypięcia zostają przy jednym czacie.
