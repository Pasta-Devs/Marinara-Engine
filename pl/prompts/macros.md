# Makra promptów

Ten przewodnik wyjaśnia makra promptów w aplikacji Marinara Engine. Makro to krótki zapis `{{tag}}`, który Marinara zamienia na aktualną wartość. Wartość trafia do tekstu w chwili budowania promptu – może to być twoje imię albo dzisiejsza data. Poznasz tu wszystkie wbudowane makra, miejsca, w których da się je wpisać, i błędy, których lepiej unikać.

## Czym są makra i gdzie działają

Makro to zwykły tekst ujęty w podwójne nawiasy klamrowe, na przykład `{{user}}` albo `{{char}}`. Kiedy Marinara buduje tekst wysyłany do AI, wyszukuje takie tagi i podmienia każdy z nich na bieżącą wartość. Nie ma przełącznika, który włącza makra. Każde pole, które je obsługuje, zawsze je rozwija.

Wielkość liter w nazwach wbudowanych makr nie ma znaczenia. Dlatego `{{user}}` i `{{USER}}` działają tak samo.

Makra można wpisywać w wielu miejscach aplikacji:

- Pola postaci w panelu **Character Editor** (edytor postaci): Description, Personality, Backstory, Appearance, Scenario, Example Dialogue, System Prompt, Post-History Instructions oraz pole **Depth Prompt**.
- Pola persony w panelu **Persona Editor** (edytor persony) – te same pola karty. Persona to postać, w którą się wcielasz.
- Pola Description i Content we wpisie lorebooka. Lorebook to zbiór faktów o twoim świecie.
- Sekcje presetu promptu w panelu **Preset Editor** (edytor presetów). Preset to zapisany szablon promptu.
- Pola Find, Replace i Trim w skrypcie regex, czyli w wyrażeniu regularnym.
- Szablony promptów agentów.
- Pole wiadomości na czacie. Wpisz `{{roll:1d20}}` w wiadomości, a makro rozwinie się przed jej wysłaniem.

Wartość makra może zawierać kolejne makro – Marinara rozwija także je.

## Zanim zaczniesz

Nie trzeba niczego konfigurować. Wbudowane makra działają od razu, bez klucza API i bez dodatkowego połączenia. Klucz API to tajny kod, trochę jak hasło, dzięki któremu Marinara rozmawia z dostawcą AI. Makra działają jednak wewnątrz aplikacji, całkiem samodzielnie.

Dwie funkcje makr zależą od innych części aplikacji:

- Zmienne presetu (uniwersalny zapis `{{NAME}}`) wymagają presetu promptu, który je definiuje. Zobacz [Zmienne presetu](preset-variables.md).
- Makro agenta `{{agent::TYPE}}` pokazuje tekst dopiero wtedy, gdy odpowiedni agent zakończy pracę i zwróci wynik.

## Makra tożsamości, postaci i persony

Te makra wstawiają imiona oraz pola kart osoby mówiącej i odpowiadającej postaci. Użytkownik to ty (albo twoja aktywna persona). Postać to ta, która odpowiada.

| Makro | Wynik |
| --- | --- |
| `{{user}}` / `{{userName}}` | Twoja bieżąca nazwa wyświetlana (albo nazwa persony). Bez ustawionej persony domyślnie `User`. |
| `{{userNamePhonetic}}` | Pole Phonetic name twojej persony, a przy pustym polu `{{user}}`. |
| `{{char}}` / `{{charName}}` | Nazwa bieżącej postaci. Domyślnie `Character`. |
| `{{<21-character-card-ID>}}` | Zapis zastępczy dla nazwy innej karty postaci. Tekst w nawiasach kątowych zastąp dokładnym 21-znakowym ID tej karty. |
| `{{persona-21-character-card-ID}}` | Zapis zastępczy dla nazwy innej persony. Tekst po `persona-` zastąp dokładnym 21-znakowym ID jej karty, aby pobrać kontekst z tej karty. |
| `{{charNamePhonetic}}` | Pole Phonetic name postaci, a przy pustym polu `{{char}}`. |
| `{{characters}}` | Wszystkie postacie w czacie, oddzielone przecinkami. |
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

Aby odwołać się do postaci, której nie ma w bieżącym czacie, skopiuj ID jej karty i wstaw je bezpośrednio w podwójne nawiasy klamrowe, na przykład `{{V1StGXR8_Z5jdHi6B-myT}}`. Marinara zamienia to makro na nazwę karty i dodaje do promptu systemowego kontekst postaci z przywołanej karty. Powitania i przykładowe dialogi tej karty zostają pominięte. Włączone lorebooki podpięte do tej karty nadal podlegają swoim zwykłym regułom słów kluczowych, wpisów **Constant**, filtrów, prawdopodobieństwa i limitu tokenów.

Aby odwołać się do nieaktywnej persony, dodaj `persona-` przed skopiowanym ID, na przykład `{{persona-P1StGXR8_Z5jdHi6B-myT}}`. Marinara zamienia makro na nazwę persony i dodaje jej pola Description, Personality, Appearance, Backstory i Scenario do ID Macro Cards. Podpięte lorebooki nadal podlegają swoim zwykłym regułom aktywacji.

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
| `{{chatId}}` | Identyfikator bieżącego czatu. |
| `{{lastGenerationType}}` | Etykieta opisująca powód wygenerowania tej odpowiedzi. |
| `{{idle_duration}}` | Czas od ostatniej aktywności w czacie, w formie tekstu w rodzaju `8 minutes` albo `1 hour 5 minutes`. |
| `{{gameStoryboardKeyframeCount}}` | Bieżąca wartość docelowa **Keyframes per Turn** w trybie Game Mode, od 1 do 6. Domyślnie `3`. |
| `{{agent::TYPE}}` | Zapisany wynik agenta danego typu. |

Wartość `{{lastGenerationType}}` to prosta etykieta. W aplikacji pojawiają się między innymi `normal`, `continue`, `regenerate`, `impersonate`, `guided`, `autonomous`, `turn_game`, `preview`, `game_setup`, `lorebook_scan` i `retry_agents`. Ta lista może się rozrastać, więc traktuj ją jako przykłady, a nie zamknięty zbiór.

Makro `{{gameStoryboardKeyframeCount}}` trafia do promptów Game Master (mistrza gry) w trybie Game Mode, w tym do wbudowanego promptu **Storyboard Game Prompt**. To cel narracyjny, a nie żądanie dokładnie takiej liczby akapitów. Planer storyboardu nadal zwraca mniej ujęć, kiedy w turze brakuje wyraźnie różnych momentów wizualnych.

Makro `{{agent::TYPE}}` wstawia zapisany wynik agenta, czyli pomocnika działającego w tle – takiego jak tracker sceny. Najprościej dodać je w panelu **Preset Editor**: kliknij przycisk **Add Section** (dodanie sekcji), rozwiń grupę **Agent Sections** i wybierz agenta. Marinara tworzy sekcję, w której od razu jest właściwy tag `{{agent::TYPE}}`. To makro rozwija się na samym końcu, więc tekst od agenta nie może wstawić do promptu kolejnych makr.

## Makra outletów lorebooka

Makro `{{outlet::name}}` wstawia treść z tych wpisów lorebooka, które mają pole **Position** ustawione na **Outlet**, a w polu **Outlet name** dokładnie wartość `name`. Outlet to nazwany punkt wstawiania, a wielkość liter w jego nazwie ma znaczenie. Przykładowo `{{outlet::character_rules}}` nie pasuje do outletu o nazwie `Character_Rules`.

Wpisy outletu nadal aktywują się na zwykłych zasadach lorebooka. O tym, czy wpis jest aktywny przy danym generowaniu, decydują słowa kluczowe, tryb Constant, prawdopodobieństwo, filtry, czas, limity wpisów i limity tokenów. Aktywne wpisy o tej samej nazwie outletu łączą się w kolejności z pola **Order**, oddzielone znakami nowej linii. Trafiają wyłącznie w miejsce makra i nie są dodatkowo wstawiane na zwykłej pozycji lorebooka.

Makr outletów używa się w sekcjach promptu w trybie Conversation, Roleplay i Game Mode. Makro działa nawet wtedy, gdy stoi przed znacznikiem lorebooka w ustawieniach presetu, a preset korzystający wyłącznie z wpisów outletu wcale nie potrzebuje takiego znacznika. Nieznany lub nieaktywny outlet daje pusty tekst. Wpis outletu nie rozwija kolejnego makra outletu, więc zagnieżdżone outlety nie działają rekurencyjnie.

## Makra czasu

Wszystkie makra czasu czytają jeden wspólny moment na każde rozwinięcie, więc zawsze się ze sobą zgadzają. Strefa czasowa pochodzi z przeglądarki.

| Makro | Wynik |
| --- | --- |
| `{{date}}` | Bieżąca data w formacie `YYYY-MM-DD`. |
| `{{time}}` | Bieżąca godzina w formacie `HH:MM`, w zapisie 24-godzinnym. |
| `{{datetime}}` / `{{isotime}}` | Pełny znacznik czasu z przesunięciem strefy czasowej. Obie nazwy znaczą to samo. |
| `{{weekday}}` | Nazwa dnia tygodnia, na przykład `Monday`. |
| `{{timezone}}` | Nazwa strefy czasowej, na przykład `Europe/Warsaw`. |

## Makra losowe i rzuty kością

Te makra wprowadzają do promptów element przypadku. Makro `{{random}}` służy do liczb i wyborów, a makro `{{roll}}` do rzutów kością.

| Makro | Działanie |
| --- | --- |
| `{{random}}` | Losowa liczba całkowita od 0 do 100. |
| `{{random:X:Y}}` | Losowa liczba całkowita z przedziału od X do Y, razem z krańcami. |
| `{{random::A::B::C}}` | Losuje jedną opcję, a potem rozwija makra tylko w wybranej opcji. |
| `{{random::A@2::B@0.5}}` | Losowanie z wagami. Zasady opisuje sekcja niżej. |
| `{{roll:XdY}}` | Suma rzutu kością. Na przykład `{{roll:2d6}}` rzuca dwiema sześciościennymi kośćmi i dodaje wyniki. |

Oto prosty przykład losowego wyboru do skopiowania:

```text
{{random::The door creaks open.::A bell rings.::Someone laughs nearby.}}
```

### Losowanie z wagami

Dopisz na końcu opcji `@liczba`, żeby ustalić jej szansę. Ta liczba to waga względna. Im większa, tym większa szansa.

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
- Wagą jest wyłącznie końcowy zapis `@liczba`. Znak `@` w innym miejscu, choćby w adresie e-mail, zostaje nietknięty.

## Zmienne dynamiczne

Dzięki zmiennym jedna część promptu zapisuje wartość, a dalsza część może ją odczytać.

| Makro | Działanie |
| --- | --- |
| `{{setvar::name::value}}` | Zapisuje wartość i nie zostawia nic w tekście. |
| `{{getvar::name}}` | Odczytuje zapisaną wartość (pusty tekst, jeśli nigdy jej nie ustawiono). |
| `{{addvar::name::value}}` | Dodaje liczby, jeśli obie wartości są liczbowe; w przeciwnym razie dopisuje tekst. |
| `{{addnumvar::name::value}}` | Rozszerzenie Marinara, które zawsze wykonuje dodawanie liczbowe. Brakującą lub nieprawidłową wartość traktuje jak 0, a przepełnienie ignoruje. |
| `{{incvar::name}}` | Dodaje 1 do zmiennej liczbowej i wstawia nową wartość. |
| `{{decvar::name}}` | Odejmuje 1 od zmiennej liczbowej i wstawia nową wartość. |

Zmienne rozwijają się od lewej do prawej podczas budowania promptu i są zapisywane w bieżącym czacie. Wartość ustawioną wcześnie, na przykład we wpisie lorebooka stojącym na początku, da się odczytać dalej w treści tego samego promptu. Tak jak zmienne lokalne w SillyTavern, zachowuje się przez kolejne tury i restarty, ale nie przechodzi do innych czatów.

Każdy zapis `{{NAME}}`, który nie jest wbudowanym makrem, Marinara traktuje jak zmienną presetu i wyszukuje po nazwie. Jeśli zmiennej o takiej nazwie nie ma, tag zostaje w tekście dokładnie tak, jak został wpisany. Sposób definiowania takich zmiennych opisuje przewodnik [Zmienne presetu](preset-variables.md).

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

Makra nie mają znaku ucieczki. Jeśli podwójne nawiasy klamrowe mają zostać w tekście, użyj nazwy, której Marinara nie zna. Każdy nieznany zapis `{{name}}` zostaje dokładnie taki, jak został wpisany – pod warunkiem, że żadna zmienna presetu nie nosi tej nazwy. Do prywatnej notatki, która nigdy nie ma trafić do AI, użyj raczej zapisu `{{// like this}}`.

## Okno Macro reference i komenda /macros

Każde pole obsługujące makra ma w rogu dwa małe przyciski:

- Przycisk **Expand editor** otwiera większe okno edycji tego pola.
- Przycisk **Macro reference** otwiera okno o tytule **Macro reference**, w którym są wszystkie wbudowane makra podzielone na kategorie, każde z dokładną składnią. Lista powstaje z tego samego źródła, którego używa silnik, więc zawsze jest aktualna.

Można też wpisać `/macros` w polu czatu (krótsza forma `/macro` również działa). Pełna lista makr wypisuje się wtedy wprost na czacie, jako szybka ściągawka.

Bloki warunkowe łączą porównania operatorami `||` (LUB) i `&&` (ORAZ) oraz nawiasami. Listy równości można zapisać zwięźle: `{{#if character == "Maukie" || "Pantalone"}}`. Kolejność działań, przykłady dla czatu grupowego i pełną listę operatorów opisuje przewodnik [Prompty warunkowe](conditional-prompts.md).

## Częste błędy

- Nie wpisuj zmiennych wewnątrz bloku `{{random::...}}`. Makro `{{setvar}}` w opcji losowania wykonuje się dla każdej opcji jeszcze przed wyborem, a nie tylko dla tej wylosowanej.
- Nie używaj zmiennej lokalnej jak globalnej. Wartości ustawione przez `{{setvar}}` zachowują się tylko w bieżącym czacie; każdy inny czat ma własną wartość.
- `{{prompt}}` nie jest makrem. Jeśli cała wiadomość to `{{prompt}}`, Marinara jej nie wysyła, tylko otwiera podgląd **Peek Prompt**. Zobacz [Peek Prompt](../chats/peek-prompt.md).
- Custom Tools (narzędzia własne) nie korzystają z zapisu `{{macro}}`. Nie wklejaj `{{roll:1d20}}` do pola narzędzia z nadzieją, że się rozwinie.
- Szablon promptu **Impersonate** przyjmuje tylko kilka symboli zastępczych, a nie pełną listę makr. Ich nazwy też się różnią, więc makro działające w karcie może tam nie zadziałać.
- Bardzo duży albo głęboko zagnieżdżony wynik makra jest po cichu ucinany. Nie pojawia się żaden błąd, więc trzymaj rozwinięcia makr w rozsądnych granicach.

## Powiązane przewodniki

- [Prompty warunkowe](conditional-prompts.md)
- [Zmienne presetu](preset-variables.md)
- [Edytor presetów i menedżer promptów](presets.md)
- [Peek Prompt](../chats/peek-prompt.md)
- [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md)
- [Profile w trybie Conversation Mode](../conversation/profiles.md)
