# Persony

Persona to karta postaci, która reprezentuje cię w czacie: twoje imię, twój opis i inne opcjonalne szczegóły. Marinara wysyła je w każdym prompcie (prompt to tekst, który Marinara wysyła do AI), żeby AI wiedziało, z kim rozmawia. Możesz mieć wiele person i wybierać jedną dla każdego czatu. Jak użyć persony, opisuje [Wybór persony w czacie](choosing-your-persona.md).

## Tworzenie persony

1. Kliknij **Personas** (persony) na górnym pasku nawigacji. Jeśli go nie widzisz, najpierw otwórz **More** (więcej).
2. Kliknij **New** (nowa). Otwiera się okno **Create Persona** (tworzenie persony).
3. Wpisz nazwę w polu **Name** (nazwa). To jedyne wymagane pole.
4. Kliknij **Create** (utwórz).

Persona powstaje z pustym opisem i otwiera się w edytorze **Persona Editor** (edytor persony).

5. Otwórz zakładkę **Card** i napisz **Description** (opis): swoje imię, wygląd i sposób zachowania.
6. Kliknij **Save** (zapis) w nagłówku.

Potem wybierz ją w czacie, w którym chcesz jej używać. Zobacz [Wybór persony w czacie](choosing-your-persona.md).

## Co robi persona

Marinara wysyła twoją personę do AI w każdym prompcie. Wybierz w czacie **None** (brak), żeby nie wysyłać żadnej persony. Bez persony AI zwraca się do ciebie "User".

Makro `{{user}}` to symbol zastępczy. Marinara zamienia je na nazwę persony przed wysłaniem promptu. Jeśli twoja persona nazywa się Alex, `{{user}}` staje się Alex. Zobacz [Makra promptów](../prompts/macros.md).

## Panel Personas

Panel **Personas** to twoja biblioteka person. Kliknij wiersz, żeby otworzyć tę personę w edytorze **Persona Editor**.

| Kontrolka | Do czego służy |
| --- | --- |
| **Download** (pobranie) | Otwiera [Card Browser](bot-browser.md), w którym znajdziesz też persony z serwisu PlotLight. |
| **Open Library** (otwarcie biblioteki) | Otwiera pełnoekranową bibliotekę Persona Library, z tą samą siatką i podglądem co biblioteka Character Library. |
| **New** | Tworzy personę. |
| **Import** (import) | Otwiera okno **Import Persona** (import persony). |
| **Select** (zaznaczanie) | Włącza tryb zaznaczania do zbiorczego usuwania i eksportu. |
| Pole wyszukiwania | Tekst zastępczy **Search personas/tags** (szukaj person/tagów). Przeszukuje nazwę, opis, komentarz i tagi. Wyszukiwanie po tagach opisuje sekcja [Wyszukiwanie](library-organization.md#search). |
| Lista rozwijana sortowania | **Manual order** (kolejność ręczna), **A-Z**, **Z-A**, **Newest** (najnowsze), **Oldest** (najstarsze) albo **Tokens** (szacowany rozmiar promptu). |
| **New Folder** (nowy folder) | Tworzy folder. |
| **Tags** (tagi) | Rozwija listę tagów do filtrowania. |

W kolejności **Manual order** przeciągnij wiersz albo naciśnij <kbd>Alt</kbd>+<kbd>Up</kbd> lub <kbd>Alt</kbd>+<kbd>Down</kbd> na wierszu, który ma fokus. Na ekranie dotykowym naciśnij i przytrzymaj wiersz, żeby go podnieść. Po najechaniu na wiersz pojawiają się **Duplicate** (duplikowanie) i **Delete** (usunięcie). Gdy person jest więcej, niż mieści jedna strona, pojawia się przycisk **Load more** (wczytanie kolejnych). Gdy nie ma żadnej persony, panel wyświetla **No personas yet**.

## Edytor Persona Editor

Otwarcie persony zastępuje obszar czatu pełnoekranowym edytorem **Persona Editor**. W nagłówku znajdziesz:

- Strzałkę **Back** (powrót).
- Kafelek awatara. Kliknij go, żeby wgrać obraz. Przy skonfigurowanym połączeniu do generowania obrazów przycisk z różdżką może też go wygenerować.
- Pole nazwy i pole komentarza, na krótką etykietę w rodzaju `Modern AU version`.
- **Save**, nieaktywny, dopóki czegoś nie zmienisz.
- **Export persona** (eksport persony), **Add persona as character** (dodanie persony jako postaci), **Duplicate persona** (duplikowanie persony) i **Delete persona** (usunięcie persony).

Opuszczenie edytora najpierw zapisuje zmiany. Jeśli zapis się nie powiedzie, edytor pozostaje otwarty z twoją wersją roboczą.

Zakładki, w tej kolejności, to **Metadata**, **Card**, **Convo**, **Lorebook**, **Sprites**, **Gallery**, **Colors** i **Stats**. Każda zakładka przeskakuje do swojej sekcji jednego długiego formularza.

Edytor persony działa jak edytor postaci opisany w przewodniku [Tworzenie i edycja postaci](creating-and-editing-characters.md). Poniższe uwagi opisują różnice.

| Zakładka | Uwagi dotyczące person |
| --- | --- |
| **Metadata** | Dane tożsamości i informacje biblioteczne. Zobacz listę pod tą tabelą. |
| **Card** | Zobacz niżej [Zakładka Card](#card-tab). |
| **Convo** | Pola używane wyłącznie w trybie Conversation. Zobacz [Profile w trybie Conversation Mode](../conversation/profiles.md). |
| **Lorebook** | Przypisz wpisy lorebooka, które włączają się, gdy ta persona jest w czacie. Zobacz [Lorebooki – przegląd](../lorebooks/overview.md). |
| **Sprites** | Grafiki w pozycji stojącej dla trybów Game Mode i Roleplay. Ma kategorie **Facial Expressions**, **Full-body** i **Clips** oraz **Upload Folder**. Zobacz [Sprite'y postaci](sprites.md). |
| **Gallery** | Obrazy i filmy referencyjne, z przyciskami **Upload Persona Images** i **Upload Persona Videos**. Zobacz [Galerie postaci i person](galleries.md). |
| **Colors** | Kolory nazwy, dialogu i pola wiadomości. Zobacz [Kolory postaci i Statystyki Roleplay](colors-and-stats.md). |
| **Stats** | Paski stanu i atrybuty RPG. Zobacz niżej [Zakładka Stats](#stats-tab). |

Zakładka **Metadata** pokazuje:

- **Persona ID** z przyciskiem **Copy** (kopiowanie).
- Kadrowanie awatara.
- **Name** i **Creator** (autor).
- **Phonetic name** (nazwa fonetyczna), używany tylko wtedy, gdy synteza mowy (text-to-speech) czyta twoje imię.
- **Title / Comment** (tytuł / komentarz), krótka etykieta.
- **Version** (wersja), domyślnie `1.0`, z przełącznikiem **Automatic versioning** (automatyczne wersjonowanie).
- **Tags**.
- **Creator Notes** (notatki autora), nigdy niewysyłane do AI.

<a id="card-tab"></a>

### Zakładka Card

Zakładka **Card** zawiera pola, które opisują cię dla AI. Każde ma szacunek liczby tokenów na żywo (token to mały kawałek tekstu).

| Pole | Co wpisać | Wysyłane do AI |
| --- | --- | --- |
| **Summary** (podsumowanie) | Ogólny opis do biblioteki i podglądów. | Nie |
| **Description** | Twoja ogólna tożsamość i rola. | W każdym prompcie |
| **Personality** (osobowość) | Temperament, zachowanie, nawyki językowe. | Tak |
| **Backstory** (historia postaci) | Historia, pochodzenie, relacje. | Tak |
| **Appearance** (wygląd) | Wygląd, ubiór, szczegóły wizualne. | Tak |
| **Scenario** (scenariusz) | Twoja domyślna sytuacja w roleplayach. | Tak |
| **Example Dialogue** (przykładowy dialog) | Przykładowe wymiany zdań. Rozdzielaj je znacznikiem `<START>`. Używaj `{{user}}` dla swojej persony, a `{{char}}` dla drugiej postaci. | Tak |

**Image Appearance Override** (osobny opis wyglądu do obrazów) pod polem **Appearance** działa tak samo jak u postaci. Zobacz [Zakładka Card](creating-and-editing-characters.md#card-tab). Pola tekstowe obsługują makra.

Te funkcje działają tak samo jak u postaci, tylko ich przedmiotem jest persona:

- Przycisk z różdżką nad każdym polem pisze je za ciebie. Zobacz [Generowanie pola karty różdżką](creating-and-editing-characters.md#write-a-card-field-with-the-wand).
- **Add Alternative Field** (dodaj alternatywne pole) pod każdym polem daje wybranym czatom inną wersję tego pola. Lista **Active in** (aktywne w) pokazuje tylko czaty, które używają tej persony, a przypisania są wstrzymywane, gdy czat wybierze inną personę. Każdy wariant można nazwać, a między wariantami przełączać się w **Chat Settings → Card Field Alternatives** (ustawienia czatu → alternatywne pola karty). Zobacz [Alternatywne pola w wybranych czatach](creating-and-editing-characters.md#use-an-alternative-field-in-selected-chats).
- **Version history** (historia wersji) jest w zakładce **Metadata**. Przed pierwszą edycją wyświetla `Previous persona states will appear here after the next edit.` **Reset** usuwa wszystkie migawki i ustawia wersję na 1.0. Zobacz [Historia wersji](creating-and-editing-characters.md#version-history).

<a id="stats-tab"></a>

### Zakładka Stats

Zakładka **Stats** ma dwa osobne bloki. Oba zasilają pasek HUD, czyli panel statystyk widoczny na ekranie w trakcie czatu.

- **Enable Persona Stats** (włączenie statystyk persony) włącza paski stanu, czyli wskaźniki potrzeb takich jak głód i nastrój. Świeżo włączony blok ma na starcie paski Satiety, Energy, Hygiene i Mood, każdy z wartością 100 na 100. Agent **Persona Stats** dostosowuje je w miarę rozwoju historii.
- **Enable Roleplay Stats** (Włącz Statystyki Roleplay) włącza pule (Pools), czyli paski takie jak HP i MP, oraz atrybuty (Attributes), czyli liczby takie jak siła. Oba wyjaśnia przewodnik [Kolory postaci i Statystyki Roleplay](colors-and-stats.md). Świeżo włączony blok ma na starcie HP i MP z wartością 100 na 100 oraz STR, DEX, CON, INT, WIS i CHA z wartością 10. Te wartości są wysyłane razem z personą na potrzeby walki i trybu Game Mode oraz opcjonalnych rzutów. Agenci ich nie aktualizują.

Blok **Game Mode Icon** (ikona trybu Game Mode) ustawia obraz twojego tokenu podczas walki w trybie Game Mode. Zobacz [Ikona trybu Game Mode](colors-and-stats.md#game-mode-icon). Gdy jest zainstalowany zestaw zasad Game Mode (zbiór reguł do gier w stylu stołowych RPG), blok **Ruleset sheets** (arkusze zestawów zasad) przechowuje twoją konfigurację początkową dla tego zestawu. Zobacz [Arkusze zestawów zasad](colors-and-stats.md#ruleset-sheets). Ustawione tu wartości są domyślnymi wartościami startowymi dla nowych czatów.

## Import i eksport person

Aby zaimportować personę, kliknij **Import** w panelu **Personas**. Okno **Import Persona** przyjmuje pliki `.marinara` i `.json`, także kilka naraz. Plik z aplikacji Marinara Engine odtwarza pełne szczegóły, sprite'y i strukturę galerii. Zwykły plik JSON z innego narzędzia jest mapowany pole po polu na nową personę. Nazwa jest wymagana. Przy każdym pliku widać oznaczenie powodzenia albo niepowodzenia.

Aby wyeksportować personę, kliknij **Export persona** w edytorze albo użyj **Export** (eksport) w trybie zaznaczania. Okno **Export Persona** oferuje dwa formaty:

| Format | Co dostajesz |
| --- | --- |
| **Marinara Native** | Wszystkie szczegóły persony z aplikacji Marinara Engine, sprite'y i przypisane lorebooki. Użyj go do przenoszenia persony między instalacjami aplikacji Marinara Engine. |
| **Compatible JSON** | Tylko podstawowe pola persony, dla innych narzędzi. |

Eksport zbiorczy pobiera jeden plik zip z osobnym plikiem dla każdej persony.

## Duplikowanie i usuwanie persony

Aby zduplikować personę, kliknij **Duplicate** w wierszu albo **Duplicate persona** w edytorze. Kopia nosi nazwę "{oryginalna nazwa} (Copy)" i zachowuje wszystkie pola karty, kolory, statystyki i pola zakładki Convo. Żaden czat nie zmienia swojej persony.

Aby usunąć personę, kliknij **Delete** w wierszu albo **Delete persona** w edytorze, a potem potwierdź. Tego nie da się cofnąć. Aby usunąć wiele person, kliknij **Select**, zaznacz persony i użyj **Delete** na pasku zaznaczenia. Jeśli usunięcie się nie powiedzie, te persony pozostają zaznaczone, więc da się spróbować ponownie.

## Dodanie persony jako postaci

**Add persona as character** w nagłówku edytora tworzy nową kartę wśród twoich postaci. Kopiuje nazwę, opis, osobowość, scenariusz, historię, wygląd, tagi, autora, wersję i awatar. Persona pozostaje bez zmian. Edycję nowej karty opisuje przewodnik [Tworzenie i edycja postaci](creating-and-editing-characters.md).

## Powiązane przewodniki

- [Wybór persony w czacie](choosing-your-persona.md)
- [Kolory postaci i Statystyki Roleplay](colors-and-stats.md)
- [Tworzenie i edycja postaci](creating-and-editing-characters.md)
- [Profile w trybie Conversation Mode](../conversation/profiles.md)
- [Makra promptów](../prompts/macros.md)
