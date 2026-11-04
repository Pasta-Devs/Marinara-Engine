# Makra promptów

Makro to krótki zapis `{{tag}}`, który Marinara zamienia na aktualną wartość, na przykład twoje imię albo dzisiejszą datę, gdy buduje prompt. Ten przewodnik wymienia wszystkie wbudowane makra, miejsca, w których da się je wpisać, i błędy, których lepiej unikać.

## Gdzie działają makra

Kiedy Marinara buduje tekst wysyłany do AI, podmienia każdy zapis `{{tag}}` na jego bieżącą wartość. Nie ma przełącznika, który włącza makra. Każde pole, które je obsługuje, zawsze je rozwija. Wielkość liter w nazwach wbudowanych makr nie ma znaczenia, więc `{{user}}` i `{{USER}}` działają tak samo. Wartość makra może zawierać kolejne makro – Marinara rozwija także je.

Makra można wpisywać w tych miejscach:

- Pola postaci w panelu **Character Editor** (edytor postaci): Description, Personality, Backstory, Appearance, Scenario, Example Dialogue, System Prompt, Post-History Instructions oraz pole **Depth Prompt**.
- Pola persony w panelu **Persona Editor** (edytor persony) – te same pola karty.
- Pola Description i Content we wpisie lorebooka.
- Sekcje presetu promptu w panelu **Preset Editor** (edytor presetów).
- Pola Find, Replace i Trim w skrypcie regex.
- Szablony promptów agentów.
- Pole wiadomości na czacie. Wpisz `{{roll:1d20}}` w wiadomości, a makro rozwinie się przed jej wysłaniem.

Makra działają wewnątrz aplikacji Marinara Engine i nie wymagają konfiguracji ani klucza API. Dwie funkcje zależą od innych części aplikacji:

- Zmienne presetu (uniwersalny zapis `{{NAME}}`) wymagają presetu promptu, który je definiuje. Zobacz [Zmienne presetu](preset-variables.md).
- Makro agenta `{{agent::TYPE}}` pokazuje tekst dopiero wtedy, gdy odpowiedni agent zakończy pracę i zwróci wynik.

## Makra tożsamości, postaci i persony

Te makra wstawiają imiona oraz pola kart osoby mówiącej i odpowiadającej postaci. Użytkownik to ty (albo twoja aktywna persona). Postać to bot, który odpowiada.

| Makro | Wynik |
| --- | --- |
| `{{user}}` / `{{userName}}` | Twoja bieżąca nazwa wyświetlana (albo nazwa persony). Bez ustawionej persony domyślnie `User`. |
| `{{userNamePhonetic}}` | Pole Phonetic name twojej persony, a przy pustym polu `{{user}}`. |
| `{{char}}` / `{{charName}}` | Nazwa bieżącej postaci. Domyślnie `Character`. |
| `{{21-character-card-ID}}` | Nazwa innej postaci. Zastąp tekst zastępczy dokładnym 21-znakowym ID karty, aby dodać ją do kontekstu. |
| `{{persona-21-character-card-ID}}` | Nazwa innej persony. Zastąp tekst zastępczy po `persona-` dokładnym 21-znakowym ID jej karty, aby dodać ją do kontekstu. |
| `{{charNamePhonetic}}` | Pole Phonetic name postaci, a przy pustym polu `{{char}}`. |
| `{{characters}}` | Wszystkie postacie w czacie, także nieaktywne, oddzielone przecinkami. To makro dodaje tylko nazwy; nie dodaje do promptu kart nieaktywnych postaci. |
| `{{group}}` | Wszystkie pozostałe aktywne postacie w czacie grupowym, bez postaci właśnie odpowiadającej. Persona nie należy do tej listy postaci. |
| `{{persona}}` | Pola Description, Personality, Backstory, Appearance i Scenario twojej persony, połączone znakami nowej linii. |
| `{{personaDescription}}` | Pole Description twojej persony. |
| `{{personaPersonality}}` | Pole Personality twojej persony. |
| `{{personaBackstory}}` | Pole Backstory twojej persony. |
| `{{personaAppearance}}` | Pole Appearance twojej persony. |
| `{{personaScenario}}` | Pole Scenario twojej persony. |

Makra pól postaci czytają kartę bieżącej postaci:

| Makro | Pole karty postaci |
| --- | --- |
| `{{description}}` | Description |
| `{{personality}}` | Personality |
| `{{backstory}}` | Backstory |
| `{{appearance}}` | Appearance |
| `{{scenario}}` | Scenario |
| `{{example}}` | Example Dialogue |
| `{{charSysInfo}}` | System Prompt |
| `{{charPostHistory}}` | Post-History Instructions |

W czacie z jedną postacią makra odnoszą się do tej właśnie postaci. W czacie grupowym domyślnie odnoszą się do pierwszej postaci. Aby powtórzyć tekst dla każdej postaci, umieść go w bloku grupowym w nawiasach kwadratowych. Bloki grupowe opisuje przewodnik [Prompty warunkowe](conditional-prompts.md).

Makro `{{group}}` podąża za postacią, która właśnie odpowiada – również podczas pojedynczych generowań w grupie. Przykład: jeśli w grupie w trybie Roleplay są Powers That Be, Maukie i Pantalone, a odpowiada Pantalone, `{{group}}` daje `Powers That Be, Maukie`. Karta postaci zostaje na tej liście nawet wtedy, gdy jej nazwa akurat pokrywa się z `{{user}}`.

Pole Phonetic name pełni dwie funkcje. Decyduje o tym, jak imię wymawia syntezator mowy. Zasila też makra `{{charNamePhonetic}}` i `{{userNamePhonetic}}`. Znajdziesz je zarówno w panelu **Character Editor**, jak i w panelu **Persona Editor**.

Aby wskazać postać spoza bieżącego czatu, skopiuj ID jej karty i umieść je bezpośrednio w podwójnych nawiasach klamrowych, na przykład `{{V1StGXR8_Z5jdHi6B-myT}}`. Nie dodawaj dosłownych znaków `<` ani `>`. Marinara zastępuje makro imieniem postaci. W czatach Roleplay korzystających z presetu promptu dodaje też pola Description, Personality, Appearance, Backstory, Scenario i Example Dialogue wskazanej karty do promptu systemowego; w pozostałych czatach makro zamienia się tylko w imię. Działa to w wiadomościach i polach promptu, a w czatach Roleplay z presetem także w aktywowanych wpisach lorebooka. Początkowe powitania wskazanej karty są pomijane. Włączone lorebooki podpięte do tej karty nadal podlegają zwykłym regułom słów kluczowych, trybu Constant, filtrów, prawdopodobieństwa i limitu tokenów. Jeśli postać jest już w czacie, makro nadal zamienia się w jej imię, a jej karta nie jest dodawana po raz drugi.

Aby odwołać się do persony innej niż aktywna, dodaj `persona-` przed skopiowanym ID, na przykład `{{persona-P1StGXR8_Z5jdHi6B-myT}}`. Marinara zamienia makro na nazwę persony i dodaje pola Description, Personality, Appearance, Backstory i Scenario jej karty do tego samego kontekstu ID Macro Cards. Włączone lorebooki podpięte do tej persony zachowują swoje zwykłe reguły aktywacji.

## Makra trybu Conversation

Te cztery makra działają wyłącznie w trybie Conversation Mode. W każdym innym trybie zawsze dają pusty tekst, nawet jeśli ta sama karta lub ten sam preset są używane w kilku trybach.

| Makro | Wynik |
| --- | --- |
| `{{convo_display}}` | Pole **Convo Display Name** postaci, a przy pustym polu nazwa z karty. |
| `{{char_about}}` | Bieżące pole **About Me** postaci (wartość ustawiona dla danego czatu, a w jej braku wartość domyślna z karty). |
| `{{persona_about}}` | Bieżące pole About Me twojej persony. |
| `{{convo_behavior}}` | Tekst z pola **Convo Behavior** postaci, ale tylko wtedy, gdy ustawienie wstawiania kieruje go właśnie do tego makra. |

Te pola edytuje się na zakładce **Convo** w panelu **Character Editor** i w panelu **Persona Editor**. Pełną konfigurację opisuje przewodnik [Profile w trybie Conversation Mode](../conversation/profiles.md).

## Makra rozmieszczenia w trybie Conversation

Tryb Conversation Mode sam wstawia do promptu kilka bloków. Dzięki tym makrom preset może **przenieść** taki blok dokładnie tam, gdzie postawisz makro. Kiedy użyjesz makra, Marinara renderuje blok w tym miejscu i **pomija** jego automatyczne wstawianie, więc treść nigdy się nie dubluje. Każde makro ma jeden alias lub kilka aliasów, a wszystkie działają tak samo.

| Makro (i aliasy) | Wstawia |
| --- | --- |
| `{{context}}`, `{{status}}` | Blok kontekstu / statusu czatu w trybie Conversation. |
| `{{commands}}`, `{{commandList}}` | Przypomnienie o dostępnych komendach. |
| `{{reactRules}}`, `{{emojiReact}}` | Zasady **reakcji** własnymi emoji. |
| `{{replyRules}}` | Zasady **odpowiedzi** własnymi emoji i naklejkami. |
| `{{memories}}`, `{{memoryRecall}}` | Blok przywoływania pamięci. |
| `{{lorebook}}`, `{{lore}}` | Wstawki z lorebooków. |

Działa to tylko w trybie Conversation Mode. W czacie z jedną postacią samodzielne ustawienie opisów uczestników przez `{{char_about}}` / `{{persona_about}}` (zobacz wyżej) daje ten sam efekt: Marinara pomija wtedy automatyczny blok "about me" uczestników, więc opisy nie pojawiają się dwa razy. Czaty grupowe zachowują automatyczny blok uczestników, bo każde z tych makr obejmuje tylko jednego uczestnika i nie może ukryć opisów pozostałych.

## Makra kontekstu

Te makra opisują bieżący czat i bieżące zapytanie.

| Makro | Wynik |
| --- | --- |
| `{{input}}` | Najnowsza wiadomość użytkownika dostępna dla promptu. |
| `{{model}}` | Nazwa bieżącego modelu, o ile jakiś jest wybrany. |
| `{{reasoning}}` | Poziom rozumowania, z jakim generowana jest ta odpowiedź: `low`, `medium`, `high`, `xhigh` albo `max`, lub `off`, gdy model nie jest proszony o myślenie. |
| `{{chatId}}` | Identyfikator bieżącego czatu. |
| `{{lastGenerationType}}` | Etykieta opisująca powód wygenerowania tej odpowiedzi. |
| `{{idle_duration}}` | Czas od ostatniej aktywności w czacie, w formie tekstu w rodzaju `8 minutes` albo `1 hour 5 minutes`. |
| `{{gameStoryboardKeyframeCount}}` | Bieżąca wartość docelowa **Keyframes per Turn** w trybie Game Mode, od 1 do 6. Domyślnie `3`. |
| `{{agent::TYPE}}` | Zapisany wynik agenta danego typu. |

`{{reasoning}}` podaje poziom, który dostaje model, po nałożeniu na siebie ustawień presetu, konta i czatu. **Maximum** pokazuje się jako najwyższy poziom, jaki model przyjmuje, więc może to być `max`, `xhigh` albo `high`. Ponieważ `off` czyta się jako fałsz, `{{#if reasoning}}` zachowuje blok tylko wtedy, gdy model myśli. Jeśli twój preset lub czat ma już własną zmienną o nazwie `reasoning`, to ta zmienna zachowuje nazwę.

Wartość `{{lastGenerationType}}` to prosta etykieta. W aplikacji pojawiają się między innymi `normal`, `continue`, `regenerate`, `impersonate`, `guided`, `autonomous`, `turn_game`, `preview`, `game_setup`, `lorebook_scan` i `retry_agents`. Ta lista może się rozrastać, więc traktuj ją jako przykłady, a nie zamknięty zbiór.

Makro `{{gameStoryboardKeyframeCount}}` trafia do promptów mistrza gry (GM) w trybie Game Mode, w tym do wbudowanego promptu **Storyboard Game Prompt**. To cel narracyjny, a nie żądanie dokładnie takiej liczby akapitów. Planer storyboardu nadal zwraca mniej ujęć, kiedy w turze brakuje wyraźnie różnych momentów wizualnych.

Makro `{{agent::TYPE}}` wstawia zapisany wynik agenta, czyli pomocnika działającego w tle – takiego jak tracker sceny. Najprościej dodać je w panelu **Preset Editor**: kliknij przycisk **Add Section** (dodanie sekcji), rozwiń grupę **Agent Sections** i wybierz agenta. Marinara tworzy sekcję, w której od razu jest właściwy tag `{{agent::TYPE}}`. To makro rozwija się na samym końcu, więc tekst od agenta nie może wstawić do promptu kolejnych makr.

## Makra outletów lorebooka

Makro `{{outlet::name}}` wstawia treść z tych wpisów lorebooka, które mają pole **Position** ustawione na **Outlet**, a w polu **Outlet name** dokładnie wartość `name`. Wielkość liter w nazwach outletów ma znaczenie. Przykładowo `{{outlet::character_rules}}` nie pasuje do outletu o nazwie `Character_Rules`.

Wpisy outletu nadal aktywują się na zwykłych zasadach lorebooka. O tym, czy wpis jest aktywny przy danym generowaniu, decydują słowa kluczowe, tryb Constant, prawdopodobieństwo, filtry, czas, limity wpisów i limity tokenów. Aktywne wpisy o tej samej nazwie outletu łączą się w kolejności z pola **Order**, oddzielone znakami nowej linii. Trafiają wyłącznie w miejsce makra i nie są dodatkowo wstawiane na zwykłej pozycji lorebooka.

Makr outletów używa się w sekcjach promptu w trybie Conversation, Roleplay i Game Mode. Makro działa nawet wtedy, gdy stoi przed znacznikiem lorebooka w presecie, a preset korzystający wyłącznie z wpisów outletu wcale nie potrzebuje takiego znacznika. Nieznany lub nieaktywny outlet daje pusty tekst. Wpis outletu nie rozwija kolejnego makra outletu, więc zagnieżdżone outlety nie działają rekurencyjnie.

## Makro rozmiaru lorebooka

`{{lorebooksize::ID}}` daje łączną liczbę wpisów lorebooka o podanym identyfikatorze. Zastąp `ID` identyfikatorem lorebooka, który można skopiować z panelu **Lorebooks** (lorebooki). Na przykład lorebook z ID `V1StGXR8_Z5jdHi6B-myT` i 151 wpisami daje `151` dla `{{lorebooksize::V1StGXR8_Z5jdHi6B-myT}}`.

Nieznane ID lorebooków dają `0`. Liczba obejmuje wszystkie wpisy: włączone, wyłączone i w folderach.

Używaj makra w sekcjach promptu, polach kart postaci, treści wpisów lorebooka i wszędzie, gdzie rozwijane są makra.

<a id="lorebook-include-macro"></a>

## Makro dołączania wpisów lorebooka

`{{include::ENTRY}}` wstawia tekst wpisu lorebooka tam, gdzie wpiszesz to makro. Wspólny fragment tekstu, na przykład zasady domowe, trzymaj w jednym wpisie i używaj go ponownie w innych wpisach, sekcjach promptu lub kartach, dzięki czemu edytujesz tylko jedną kopię. Zamiast `ENTRY` wpisz ID wpisu albo jego nazwę. Wielkość liter w nazwach nie ma znaczenia.

- Wewnątrz wpisu lorebooka nazwa jest wyszukiwana w lorebooku, do którego należy ten wpis.
- W każdym innym miejscu nazwa jest wyszukiwana w lorebookach używanych przez ten czat: dodanych do czatu, powiązanych z jego postaciami i personą oraz globalnych.
- ID znajduje wpis w dowolnym lorebooku.

`{{include::BOOK::ENTRY}}` pobiera wpis z lorebooka, który wskażesz po jego ID lub nazwie. Ten lorebook nie musi być dodany do czatu ani nawet włączony.

```text
{{include::Rules of the arena}}
{{include::Shared lore::Rules of the arena}}
```

Dołączany wpis nie musi się aktywować i może być wyłączony, więc możesz trzymać wpisy, które istnieją tylko po to, żeby je dołączać. Makra w dołączanym tekście działają jak zwykle, a sam tekst może też dołączać inne wpisy. Jeśli dołączenie prowadzi z powrotem do wpisu, wewnątrz którego już się znajduje, na przykład gdy wpis dołącza sam siebie, to takie dołączenie daje pusty tekst zamiast powtarzać się bez końca. Wpis lub lorebook, którego nie znaleziono, również daje pusty tekst.

Nazwy i ID wpisuj zwykłym tekstem. Makra wewnątrz nich, takie jak `{{include::{{char}}}}`, nie są rozwijane.

## Makra czasu

Makra czasu rzeczywistego czytają jeden wspólny moment na każde rozwinięcie, więc zawsze się ze sobą zgadzają. Strefa czasowa pochodzi z przeglądarki.

| Makro | Wynik |
| --- | --- |
| `{{date}}` | Bieżąca data w formacie `YYYY-MM-DD`. |
| `{{time}}` | Bieżąca godzina w formacie `HH:MM`, w zapisie 24-godzinnym. |
| `{{datetime}}` / `{{isotime}}` | Pełny znacznik czasu z przesunięciem strefy czasowej. Obie nazwy znaczą to samo. |
| `{{weekday}}` | Nazwa dnia tygodnia, na przykład `Monday`. |
| `{{timezone}}` | Nazwa strefy czasowej, na przykład `Europe/Warsaw`. |
| `{{date.world_state}}` | Bieżąca data w świecie opowieści śledzona przez agenta World State, zachowana w oryginalnym formacie. |
| `{{time.world_state}}` | Bieżąca godzina w świecie opowieści śledzona przez agenta World State, zachowana w oryginalnym formacie. |
| `{{weekday.world_state}}` | Własne pole świata o nazwie Weekday lub Day of Week, dzień tygodnia zapisany w śledzonej dacie albo dzień tygodnia odpowiadający poprawnej śledzonej dacie w formacie `YYYY-MM-DD`. |

Makra `.world_state` działają w promptach i szablonach agentów. Korzystają z daty i godziny świata widocznych dla bieżącej tury opowieści. Zmiana swipe'a zmienia turę, z której pochodzą wartości; regeneracja korzysta ze stanu opowieści, od którego zaczyna się zastępcza odpowiedź. Brakująca wartość staje się pustym tekstem; nigdy nie jest zastępowana dzisiejszą datą ani rzeczywistą godziną. Fikcyjne kalendarze zachowują własny tekst daty i godziny. Aby używać fikcyjnego dnia tygodnia, dodaj w World State własne pole o nazwie Weekday lub Day of Week.

Na przykład `{{#if weekday.world_state == "Monday"}}Use the weekday routine.{{/if}}` odczytuje śledzony dzień tygodnia zamiast rzeczywistego.

## Makra losowe i rzuty kością

Te makra wprowadzają do promptów element przypadku. Makro losowe (`{{random}}`) służy do liczb i wyborów, a makro rzutu (`{{roll}}`) do rzutów kością.

| Makro | Działanie |
| --- | --- |
| `{{random}}` | Losowa liczba całkowita od 0 do 100. |
| `{{random:X:Y}}` | Losowa liczba całkowita z przedziału od X do Y, razem z krańcami. |
| `{{random::A::B::C}}` | Losuje jedną opcję, a potem rozwija makra tylko w wybranej opcji. |
| `{{random::A@2::B@0.5}}` | Losowanie z wagami. Zasady opisuje sekcja niżej. |
| `{{roll:XdY}}` | Suma rzutu kością. Na przykład `{{roll:2d6}}` rzuca dwiema sześciościennymi kośćmi i dodaje wyniki. `{{roll:d20}}` rzuca jedną kością, a `{{roll:1d8+3}}` dodaje 3 do wyniku rzutu. |

Oto prosty przykład losowego wyboru do skopiowania:

```text
{{random::The door creaks open.::A bell rings.::Someone laughs nearby.}}
```

### Losowanie z wagami

Dopisz na końcu opcji `@number`, żeby ustalić jej szansę. Ta liczba to waga względna. Im większa, tym większa szansa.

```text
{{random::Common event@1::Rare event@0.25}}
```

W tym przykładzie suma wag wynosi 1.25, więc szanse są takie:

| Opcja | Waga | Szansa |
| --- | --- | --- |
| Common event | 1 | 80% |
| Rare event | 0.25 | 20% |

Zasady ważenia:

- Brak wagi liczy się jako 1.
- Wagi ułamkowe są dozwolone, na przykład 0.5 albo 0.01.
- Waga 0 zostawia opcję na liście, ale losowanie nigdy jej nie wybierze.
- Jeśli każda opcja ma wagę 0, makro daje pusty tekst.
- Wagą jest wyłącznie końcowy zapis `@number`. Znak `@` w innym miejscu, choćby w adresie e-mail, zostaje nietknięty.

## Zmienne dynamiczne

Dzięki zmiennym jedna część promptu zapisuje wartość, a dalsza część może ją odczytać.

| Makro | Działanie |
| --- | --- |
| `{{setvar::name::value}}` | Zapisuje wartość i nie zostawia nic w tekście. |
| `{{getvar::name}}` | Odczytuje zapisaną wartość (pusty tekst, jeśli nigdy jej nie ustawiono). |
| `{{addvar::name::value}}` | Dodaje liczby, jeśli obie wartości są liczbowe; w przeciwnym razie dopisuje nowy tekst. |
| `{{addnumvar::name::value}}` | Rozszerzenie aplikacji Marinara Engine: zawsze dodaje liczbę do zapisanej wartości liczbowej. Brakujące lub nieprawidłowe liczby liczą się jako 0; dodawanie, które powoduje przepełnienie, jest ignorowane. |
| `{{incvar::name}}` | Dodaje 1 do zmiennej liczbowej i wstawia nową wartość. |
| `{{decvar::name}}` | Odejmuje 1 od zmiennej liczbowej i wstawia nową wartość. |

Zmienne rozwijają się od lewej do prawej w obrębie jednego budowania promptu. Wartość ustawioną wcześnie, na przykład we wpisie lorebooka stojącym na początku, da się odczytać dalej w tym samym prompcie. Marinara zapisuje je też w bieżącym czacie, tak jak zmienne lokalne w aplikacji SillyTavern: zostają zachowane w kolejnych turach i po ponownym uruchomieniu aplikacji, a inny czat ma własne, osobne wartości.

Każdy zapis `{{NAME}}`, który nie jest wbudowanym makrem, jest wyszukiwany po nazwie: najpierw wśród zmiennych presetu, a potem wśród zmiennych czatu. Jeśli żadna z tych grup nie zawiera tej nazwy, znacznik pozostaje w tekście dokładnie tak, jak został wpisany. Zmienna presetu ma pierwszeństwo, gdy obie grupy używają tej samej nazwy. Zmienne definiowane w presecie opisuje przewodnik [Zmienne presetu](preset-variables.md).

### Zmienne czatu

Nie musisz używać `{{setvar}}`, aby utworzyć zmienną. Sekcja **Chat Variables** (zmienne czatu) w panelu **Chat Settings** (ustawienia czatu) pozwala wpisać nazwę i wartość bezpośrednio, a potem używać tej nazwy wszędzie, gdzie działają makra, także we własnych wiadomościach. Dodaj `char1` o wartości `Mary`, wpisz `{{char1}} walks in.`, a AI przeczyta "Mary walks in."

Zasady dotyczące zmiennych czatu:

- Nazwy mogą zawierać litery, cyfry i podkreślenia, a muszą zaczynać się od litery lub podkreślenia. Nazwy mające dokładnie 21 znaków są zarezerwowane dla odwołań do postaci. Nazwę z kropką lub łącznikiem nadal można ustawiać i odczytywać przez `{{setvar}}` i `{{getvar}}`, ale nie zostanie ona rozwinięta jako sam zapis `{{name}}`.
- Nie można użyć nazwy wbudowanego makra. `{{char}}` zawsze oznacza postać.
- Twoja wiadomość nadal pokazuje wpisany znacznik. Wartość jest podstawiana przy budowaniu promptu, więc jej późniejsza zmiana wpływa również na wcześniejsze tury, które jej używały.
- Sekcja pokazuje także zmienne ustawione przez `{{setvar}}`, ponieważ korzystają z tego samego magazynu w obrębie czatu.

Sam panel opisuje przewodnik [Panel **Chat Settings** – przegląd](../chats/chat-settings.md).

## Makra formatowania

Te makra kształtują tekst wokół siebie.

| Makro | Działanie |
| --- | --- |
| `{{newline}}` / `{{\n}}` | Wstawia przejście do nowej linii. |
| `{{trim}}` | Usuwa samo siebie i przycina białe znaki wokół tego miejsca. |
| `{{trimStart}}` | Przycina białe znaki na początku otaczającego tekstu. |
| `{{trimEnd}}` | Przycina białe znaki na końcu otaczającego tekstu. |
| `{{uppercase}}...{{/uppercase}}` | Zamienia objęty tekst na WIELKIE LITERY. |
| `{{lowercase}}...{{/lowercase}}` | Zamienia objęty tekst na małe litery. |
| `{{noop}}` | Znika z wyniku. Przydaje się jako nieszkodliwy znacznik podczas edycji. |
| `{{// comment}}` | Notatka autora, która znika z wyniku. |
| `{{banned "text"}}` | Znika z wyniku. Niczego nie filtruje ani nie blokuje. |

## Jak pokazać same podwójne nawiasy klamrowe

Makra nie mają znaku ucieczki. Jeśli podwójne nawiasy klamrowe mają zostać w tekście, użyj nazwy, której Marinara nie zna. Każdy nieznany zapis `{{name}}` zostaje dokładnie taki, jak został wpisany – pod warunkiem, że ani zmienna presetu, ani zmienna czatu nie nosi tej nazwy. Do prywatnej notatki, która nigdy nie ma trafić do AI, użyj raczej zapisu `{{// like this}}`.

## Okno Macro reference i komenda /macros

Każde pole obsługujące makra ma w rogu dwa małe przyciski:

- Przycisk **Expand editor** (rozwinięcie edytora) otwiera większe okno edycji tego pola.
- Przycisk **Macro reference** (wykaz makr) otwiera okno o tytule **Macro reference**, w którym są wszystkie wbudowane makra podzielone na kategorie, każde z dokładną składnią. Lista powstaje z tego samego źródła, którego używa silnik, więc zawsze jest aktualna.

Te pola same też dokańczają nazwy makr. Wpisz `{{ch` na końcu wiersza, a reszta, `ar}}`, pojawi się bladym tekstem. Naciśnij Tab albo dotknij bladego tekstu, żeby go przyjąć. Pisz dalej, żeby go zignorować. W makrze, które przyjmuje wartość, na przykład `{{getvar::`, uzupełnienie kończy się w miejscu, w którym wpisujesz wartość.

Można też wpisać `/macros` w polu czatu (krótsza forma `/macro` również działa). Pełna lista makr wypisuje się wtedy wprost na czacie, jako szybka ściągawka.

## Warunki z makrami

Bloki warunkowe (`{{#if ...}}`) mogą łączyć porównania operatorami `||` (LUB) i `&&` (ORAZ) oraz nawiasami. Listy równości można zapisać zwięźle: `{{#if character == "Maukie" || "Pantalone"}}`. Kolejność działań, przykłady dla czatu grupowego i pełną listę operatorów opisuje przewodnik [Prompty warunkowe](conditional-prompts.md).

Warunek może też zapytać twój model decyzyjny o scenę, na przykład `{{#if decision:"The latest message moves the scene to a new place"}}` dla odpowiedzi tak lub nie oraz `{{#if decision_choice:"The kind of scene in the latest message" == "combat"}}` dla wyboru jednej opcji. Bez modelu decyzyjnego albo bez odpowiedzi takie warunki oznaczają nie. Zobacz [Pytanie modelu decyzyjnego](conditional-prompts.md#asking-the-decision-model). Opcje, które można dopisać po stwierdzeniu:

- `sticky:3 cooldown:5` zachowuje odpowiedź tak przez trzy tury, a potem wstrzymuje ją na pięć. Zobacz [Sticky i cooldown](conditional-prompts.md#sticky-and-cooldown).
- `until:"..."` lub `while:"..."` zachowuje odpowiedź tak tak długo, jak pozwala na to drugie stwierdzenie. Zobacz [Until i while](conditional-prompts.md#until-and-while).
- `every:3` zadaje pytanie o stwierdzenie tylko co trzy tury. Zobacz [Sprawdzanie co kilka tur](conditional-prompts.md#checking-every-few-turns).
- `priority:high` lub `priority:low` decyduje, które stwierdzenia zmieszczą się w planie promptu. Zobacz [Priorytet](conditional-prompts.md#priority) i [Limity i koszty](conditional-prompts.md#limits-and-cost).

## Częste błędy

- Nie wpisuj zmiennych wewnątrz bloku `{{random::...}}`. Makro `{{setvar}}` w opcji losowania wykonuje się dla każdej opcji jeszcze przed wyborem, a nie tylko dla tej wylosowanej.
- Nie używaj zmiennej lokalnej jako stanu globalnego. Zostaje zachowana tylko w czacie, w którym ją ustawiono.
- Sekcja promptu lub wpis lorebooka uruchamiający `{{setvar}}` nadpisuje zmienną czatu o tej samej nazwie, ponieważ oba korzystają z jednego magazynu dla danego czatu. Nadaj im różne nazwy, jeśli chcesz zachować obie wartości.
- `{{prompt}}` nie jest makrem. Jeśli cała wiadomość to `{{prompt}}`, Marinara jej nie wysyła, tylko otwiera podgląd **Peek Prompt**. Zobacz [Peek Prompt](../chats/peek-prompt.md).
- Custom Tools (narzędzia własne) nie korzystają z zapisu `{{macro}}`. Nie wklejaj `{{roll:1d20}}` do pola narzędzia z nadzieją, że się rozwinie.
- Szablon promptu **Impersonate** przyjmuje tylko kilka symboli zastępczych, a nie pełną listę makr. Ich nazwy też się różnią, więc makro działające w karcie może tam nie zadziałać.
- Duży albo głęboko zagnieżdżony wynik makra jest po cichu ucinany. Nie pojawia się żaden błąd, więc trzymaj rozwinięcia makr w rozsądnych granicach.

## Powiązane przewodniki

- [Prompty warunkowe](conditional-prompts.md)
- [Zmienne presetu](preset-variables.md)
- [Edytor presetów i menedżer promptów](presets.md)
- [Peek Prompt](../chats/peek-prompt.md)
- [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md)
- [Profile w trybie Conversation Mode](../conversation/profiles.md)
