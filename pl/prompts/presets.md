# Edytor presetów i menedżer promptów

Ten przewodnik wyjaśnia, czym są presety promptów w aplikacji Marinara Engine. Zobaczysz, do czego służą, jak zbudować własny w panelu **Preset Editor** (edytor presetów) i jak przypisać go do czatu. Preset (zapisany szablon promptu) decyduje o strukturze tekstu, który Marinara wysyła do AI.

## Czym jest preset

Preset to schemat wielokrotnego użytku. Decyduje o tym, jakie informacje Marinara wysyła do AI i w jakiej kolejności. Obejmuje to napisane przez ciebie instrukcje systemowe, kartę postaci, personę (postać, w którą się wcielasz), historię czatu, wpisy z lorebooków (zbiorów faktów o twoim świecie) i inne elementy.

Presety kształtują prompt (tekst, który Marinara wysyła do AI) w czatach **Roleplay** i **Game**. Tryb **Conversation** działa inaczej i korzysta z jednego pola promptu. Zobacz sekcję "Czym różnią się tryby Conversation i Game" poniżej.

Presety nie wymagają klucza API (tajnego kodu, trochę jak hasło) ani konta. Opisują tylko sposób budowania promptu. Do wysłania promptu i tak potrzebne jest działające połączenie. Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

## Otwieranie panelu Preset Editor

Presety promptów znajdziesz w sekcji **Prompts** panelu **Presets** po lewej stronie aplikacji. Pozostałe sekcje tego panelu to **Regexes** i **Functions**.

Na górze panelu są trzy przyciski:

- **New** (ikona plusa): utworzenie nowego presetu.
- **Import** (ikona pobierania): wczytanie presetu z pliku `.json`.
- **Select** (ikona ptaszka): zaznaczenie kilku presetów naraz do eksportu lub usunięcia.

Pod przyciskami jest pole **Search presets** i menu sortowania z opcjami **A-Z**, **Z-A**, **Newest** i **Oldest**. Presety da się grupować w folderach – służy do tego przycisk **New Folder** (nowy folder). Przeciągnij preset na folder, żeby go przenieść. Zmień nazwę folderu podwójnym kliknięciem lub podwójnym stuknięciem.

Wiersz każdego presetu pokazuje nazwę, format opakowania, liczbę sekcji i autora. Preset oznaczony gwiazdką jako domyślny ma plakietkę **DEFAULT**. Kliknij wiersz presetu, żeby otworzyć go w panelu **Preset Editor**.

## Tworzenie i edytowanie presetu

Wykonaj kolejno te kroki, żeby zrobić nowy preset.

1. Otwórz panel **Presets**.
2. Kliknij przycisk **New**. Otwiera się okno **Create Preset** (tworzenie presetu).
3. Wpisz nazwę w polu **Name**. To pole jest wymagane.
4. Dodaj opcjonalny opis w polu **Description**, żeby pamiętać, do czego służy ten preset.
5. Kliknij przycisk **Create**. Nowy preset otwiera się w panelu **Preset Editor**.
6. Zbuduj prompt w zakładce **Sections** (opisanej niżej).
7. Na koniec kliknij przycisk **Save** (zapisanie) w prawym górnym rogu.

Edytor nie zapisuje sam z siebie. Zmiany zostają zachowane dopiero po kliknięciu przycisku **Save**. Przy próbie wyjścia z niezapisanymi zmianami pojawia się ostrzeżenie z przyciskami **Keep editing**, **Discard** i **Save & close**.

Żeby wyeksportować preset, otwórz go i kliknij przycisk eksportu (ikona strzałki w górę) na górnym pasku. Przy niezapisanych zmianach Marinara najpierw prosi o zapisanie. Preset usuniesz ikoną kosza na górnym pasku.

## Zakładki Overview, Sections i Prompts

Panel **Preset Editor** ma trzy zakładki.

- **Overview**: nazwa presetu, opis, format opakowania i autor.
- **Sections**: właściwa struktura promptu, zbudowana z bloków i znaczników.
- **Prompts**: prompty trybów używane przez czaty Conversation i Game.

### Zakładka Overview

Zakładka **Overview** ma cztery pola. Pole **Name** to nazwa wyświetlana w panelu **Presets**. Pole **Description** to krótkie podsumowanie presetu. Pole **Wrap Format** (format opakowania) decyduje o sposobie formatowania sekcji (zobacz "Formaty opakowania"). Pole **Author** to opcjonalna nazwa twórcy, przydatna przy udostępnianiu presetu. Dwa kafelki tylko do odczytu pokazują liczniki **Sections** i **Groups**.

### Zakładka Prompts

Zakładka **Prompts** zbiera prompty trybów.

- **Conversation Mode**: pole tekstowe używane jako prompt trybu Conversation dla tego presetu. Zostaw je puste, żeby korzystać z wbudowanego promptu trybu Conversation aplikacji Marinara Engine.
- **Roleplay Mode**: tego nie da się tu edytować. Tryb Roleplay korzysta z promptu złożonego z twoich sekcji w zakładce **Sections**.
- **Game Mode**: pole tekstowe używane jako prompt trybu Game dla tego presetu. Zostaw je puste, żeby korzystać z wbudowanego promptu gry aplikacji Marinara Engine.

## Sekcje i znaczniki

Prompt buduje się w zakładce **Sections**. Każda sekcja staje się częścią tekstu wysyłanego do AI. Sekcje składają się w całość od góry do dołu.

Kliknij przycisk **Add Section** (dodanie sekcji), żeby otworzyć menu dodawania. Do wyboru są dwa rodzaje sekcji.

Sekcja **Prompt Block** to dowolny tekst, który piszesz samodzielnie. Użyj jej do instrukcji systemowych, zasad tonu albo dowolnych sformułowań, które mają być w każdym prompcie.

Znacznik (**marker**) to sekcja wypełniana automatycznie. Nie ma własnego tekstu. Zamiast tego Marinara uzupełnia ją w chwili wysyłki aktualną zawartością czatu. Poniższa tabela wymienia znaczniki.

| Znacznik | Co wstawia |
|---|---|
| **Character Info** | Szczegóły karty aktywnej postaci. |
| **Persona** | Szczegóły twojej aktywnej persony. |
| **Chat History** | Bieżące wiadomości czatu. |
| **Chat Summary** | Zebrane podsumowanie tego czatu. |
| **Dialogue Examples** | Przykładowe dialogi postaci. |
| **Lorebook Marker (All)** | Wszystkie aktywne wpisy z lorebooków. |
| **Lorebook Marker (Before)** | Wpisy z lorebooków ustawione na wstawianie przed. |
| **Lorebook Marker (After)** | Wpisy z lorebooków ustawione na wstawianie po. |

Sekcja będąca znacznikiem ma w swoim wierszu plakietkę **MARKER**. Po rozwinięciu widać notatkę z nazwą typu znacznika. W większości znaczników nie da się wpisać treści, bo Marinara generuje ją sama.

Kiedy preset nie ma włączonego znacznika **Dialogue Examples**, niepuste przykłady dialogów trafiają do sekcji **Character Info**, zaraz za Scenario. Używają formatowania presetu: XML, Markdown albo bez opakowania. Dodaj znacznik Dialogue Examples, jeśli chcesz sam zdecydować o jego umiejscowieniu; Marinara nie wstawi go dwa razy.

Jeśli czat ma aktywne lorebooki, a preset nie ma żadnego znacznika lorebooka, pojawia się ostrzeżenie. Jego treść brzmi: "Add a lorebook marker when this preset should receive active lorebook entries." Dodaj znacznik lorebooka, żeby te wpisy dotarły do AI. Zobacz [Lorebooki – przegląd](../lorebooks/overview.md).

Jeśli masz skonfigurowanych własnych agentów z włączoną opcją "inject as section", menu dodawania pokazuje grupę **Agent Sections**. Każda sekcja agenta wstawia do promptu najnowszy wynik tego agenta. Dookoła można dopisać własne instrukcje.

Wiersz każdej sekcji ma po prawej stronie kontrolki. Przycisk **Duplicate** kopiuje sekcję. Ikona oka włącza i wyłącza sekcję. Przycisk **Delete** ją usuwa. Kolejność sekcji zmienisz, przeciągając uchwyt, klikając strzałki w górę i w dół albo przytrzymując palec na ekranie dotykowym.

Rozwiń sekcję (kliknij jej nazwę albo strzałkę), żeby ją edytować. Zmienisz tam pole **Name** i rolę (**System**, **User** albo **Assistant**). W sekcji **Prompt Block** edytujesz dodatkowo pole **Content**. Pole treści obsługuje makra. Zobacz [Makra promptów](macros.md).

## Grupy i pozycja sekcji

### Grupy

Grupa zamyka kilka sekcji w jednym pojemniku. Dzięki temu powiązane sekcje trzymają się razem w gotowym prompcie.

1. W zakładce **Sections** kliknij przycisk **Groups** na pasku narzędzi.
2. Kliknij przycisk **New Group** (nowa grupa). Pojawia się grupa o nazwie "New Group".
3. Kliknij nazwę grupy, żeby ją zmienić.
4. Rozwiń sekcję i wybierz swoją grupę z listy rozwijanej **Group**.

Przy formacie opakowania **XML** grupa staje się jednym tagiem nadrzędnym wokół swoich sekcji. Przy **Markdown** grupa staje się jednym nagłówkiem. Usunięcie grupy nie usuwa jej sekcji – po prostu przestają do niej należeć.

### Pozycja i głębokość

Każda sekcja ma ustawienie **Position** (pozycja) w swoim rozwiniętym edytorze.

- **Ordered (in sequence)**: sekcja stoi tam, gdzie widać ją na liście. To zwykły wybór.
- **Depth (from end of chat)**: sekcja trafia określoną liczbę wiadomości przed koniec czatu. Po wybraniu tej opcji pojawia się liczba **Depth** (głębokość). Głębokość 0 oznacza, że sekcja idzie za ostatnią wiadomością.

Ustawienia **Depth** używaj do przypomnień, które AI ma widzieć blisko najnowszych wiadomości, na przykład do krótkiej notki o stylu.

## Formaty opakowania

Pole **Wrap Format** w zakładce **Overview** decyduje o tym, jak każda sekcja zostaje opakowana przy składaniu promptu. Są trzy przyciski.

- **XML**: każda sekcja jest opakowana w tagi, na przykład w tag z nazwą wokół treści. Grupy stają się tagami nadrzędnymi. To ustawienie domyślne.
- **MARKDOWN**: każda sekcja dostaje nagłówek. Grupy stają się nagłówkami wyższego poziomu.
- **NONE**: nic nie jest dodawane. Treść sekcji leci dokładnie w takiej formie, w jakiej ją zapisano.

XML to dobry domyślny wybór dla większości modeli. Po **MARKDOWN** albo **NONE** sięgaj tylko wtedy, gdy model wyraźnie lepiej odpowiada bez tagów.

## Przypisywanie presetu do czatu

Preset nic nie robi, dopóki nie zostanie przypisany do czatu. W czacie **Roleplay** da się to zrobić na dwa sposoby.

Z panelu **Presets**:

1. Otwórz czat, który chcesz zmienić.
2. W panelu **Presets** najedź kursorem na wiersz presetu.
3. Kliknij przycisk **Assign to chat** (przypisanie do czatu) z ptaszkiem. Kliknij go ponownie, żeby cofnąć przypisanie.

Z panelu **Chat Settings** (ustawienia czatu):

1. Otwórz czat.
2. Otwórz **Chat Settings** (ikona zębatki).
3. Znajdź sekcję **Prompt Preset**.
4. Wybierz preset z listy rozwijanej.

Jeśli preset ma zmienne, przy przypisaniu otwiera się okno **Configure Preset Variables** (konfiguracja zmiennych presetu). Wybierz tam wartości. Zobacz [Zmienne presetu](preset-variables.md). Przełączenie na inny preset kasuje wcześniejsze wybory zmiennych.

W trybie **Conversation** presety promptów nie są dostępne z panelu. Kliknięcie przycisku przypisania w czacie Conversation pokazuje komunikat: "Prompt presets are not available in conversation mode." Następna sekcja wyjaśnia, jak czaty Conversation i Game korzystają z presetów.

## Czym różnią się tryby Conversation i Game

Czaty **Conversation** i **Game** nie budują promptu z sekcji. Zamiast tego korzystają z jednego promptu trybu, który da się nadpisać w każdym czacie osobno.

W tych trybach panel **Chat Settings** pokazuje sekcję **Prompt Preset** z listą rozwijaną **Prompt source** (źródło promptu). Lista wymienia twoje presety. Domyślnie stoi na "Default conversation prompt" albo "Default game prompt". Bez żadnych presetów pokazuje "No presets available".

Pod listą rozwijaną jest wiersz stanu. Pokazuje jeden z trzech stanów:

- **Default**: używany jest wbudowany prompt trybu.
- **Preset**: prompt pochodzi z wybranego presetu.
- **Custom**: wpisano zmianę obowiązującą tylko w tym czacie.

Kliknij przycisk **Edit Prompt** (edycja promptu), żeby wpisać prompt wyłącznie dla tego czatu. Edytor otwiera się jako **Edit Conversation Prompt** albo **Edit Game Prompt**. Jeśli wpisany tekst dokładnie odpowiada presetowi lub wartości domyślnej, Marinara traktuje go jako brak zmiany. Kiedy własna zmiana już istnieje, pojawia się przycisk **Reset to default prompt**, który ją kasuje.

Czaty Game mają dodatkowo pole **Extra instructions** (dodatkowe instrukcje). Wpisany tam tekst dochodzi do promptu trybu Game. Limit wynosi 2000 znaków. Przykładowa instrukcja to "Write in the style of Terry Pratchett."

<a id="decision-blocks-and-prompt-caching"></a>

## Bloki decyzyjne i pamięć podręczna promptu

Sekcja może zawierać blok `{{#if decision:"..."}}`, żeby część presetu była wysyłana tylko w turach, w których stwierdzenie o czacie jest prawdziwe. Zobacz [Pytanie modelu decyzyjnego](conditional-prompts.md#asking-the-decision-model).

**Umieszczaj zmienne bloki decyzyjne pod koniec promptu**, na przykład w instrukcjach po historii. Zmieniona gałąź może uniemożliwić dostawcy ponowne użycie promptu od tego miejsca, więc wczesna zmiana traci większość oszczędności. Wcześniejszy niezmieniony początek nadal może się kwalifikować; niekoniecznie cały prompt jest rozliczany jako nowy. Decyzję blisko początku zachowuj tylko przy rzadkiej zmianie odpowiedzi i pasujących tam instrukcjach. Szczegóły dostawców opisuje [Pamięć podręczna promptu](conditional-prompts.md#prompt-caching).

Stwierdzenia w wyłączonych sekcjach i grupach nigdy nie są zadawane i nie liczą się do **Decision statements per turn** (stwierdzenia decyzyjne na turę).

## Sprawdzanie, co dostało AI

Żeby potwierdzić, który preset i które sekcje naprawdę dotarły do AI, użyj funkcji **Peek Prompt**. Pokazuje ona kompletnie złożony prompt dla danej wiadomości. To najszybszy sposób na zdiagnozowanie dziwnej odpowiedzi. Zobacz [Peek Prompt: zobacz, co dostał model AI](../chats/peek-prompt.md).

## Powiązane przewodniki

- [Zmienne presetu](preset-variables.md)
- [Makra promptów](macros.md)
- [Parametry generowania](generation-parameters.md)
- [Profile ustawień](../chats/settings-profiles.md)
- [Panel **Chat Settings** – przegląd](../chats/chat-settings.md)
- [Peek Prompt: zobacz, co dostał model AI](../chats/peek-prompt.md)
