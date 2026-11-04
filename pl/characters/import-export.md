# Importowanie i eksportowanie kart postaci

Karta postaci to jeden plik z jedną postacią: jej nazwą, opisem, osobowością, powitaniami i często też awatarem. Importuj karty, żeby dodać postacie z innych aplikacji i stron. Eksportuj własne postacie, żeby zrobić ich kopię zapasową albo je udostępnić.

## Importowanie postaci

Zanim zaczniesz: przygotuj plik karty postaci na swoim urządzeniu. Jeśli wolisz poszukać kart w internecie, zobacz [Card Browser](bot-browser.md).

1. Kliknij **Characters** (postacie) na górnym pasku nawigacji. Jeśli tej pozycji nie widzisz, najpierw otwórz **More** (więcej).
2. Kliknij **Import** (import) na pasku narzędzi (ikona ze strzałką pobierania). Otwiera się okno **Import Character** (import postaci).
3. Ustaw opisane niżej opcje importu. Obowiązują dla każdego pliku w tej partii.
4. Upuść pliki na to okno albo je dotknij lub kliknij, żeby otworzyć okno wyboru plików na swoim urządzeniu. Możesz wybrać kilka plików, także różnych typów.
5. Poczekaj na listę wyników. Przy każdym pliku widać zielony znak zaznaczenia albo czerwony znak z błędem. Tekst brzmi `Imported "Name"`, `Imported "Name" with its embedded lorebook` albo `Imported "Name" without creating the embedded lorebook`.
6. Nową postać znajdziesz w panelu **Characters**.

Marinara przyjmuje cztery typy plików:

| Typ pliku | Co to jest |
| --- | --- |
| **.json** | Karta zapisana jako tekst. Eksporty z aplikacji Marinara Engine (`.marinara.json`) to również pliki .json. |
| **.png** | Obrazek karty z danymi karty ukrytymi wewnątrz obrazu. |
| **.charx** | Pakiet karty zapisany jako plik zip. |
| **.marinara** | Plik eksportu aplikacji Marinara Engine. |

Eksport z aplikacji Marinara Engine zachowuje najwięcej szczegółów. Pozostałe typy pochodzą z SillyTavern, Chub, Risu i podobnych narzędzi.

Jeśli to nie zadziałało: przeczytaj czerwony komunikat obok pliku. Pozostałe pliki z partii i tak zostaną zaimportowane.

<a id="import-options"></a>

### Opcje importu

| Opcja | Możliwości |
| --- | --- |
| **Imported card tags** (tagi importowanej karty) | **All tags** (domyślnie): zachowanie każdego tagu. |
| | **No tags**: pominięcie tagów. |
| | **Existing only**: zachowanie tylko tych tagów, które już są w twojej bibliotece. |
| **Imported regex scripts** (importowane skrypty regex) | **Character only** (domyślnie): reguły działają dla tej postaci. |
| | **Global**: reguły trafiają do sekcji **Presets → Regexes** (presety, regexy) i działają w każdym czacie. |
| **Split description into fields** (podział opisu na pola) | Domyślnie wyłączona. Zaznacz ją, żeby teksty opatrzone etykietami, takie jak osobowość czy wygląd, przenieść z pola **Description** (opis) do osobnych pól. |

Skrypty regex to małe reguły zamiany tekstu. Zostaw **Character only**, chyba że reguły mają działać wszędzie. Podział nie zmienia kart narratora, kart świata ani kart z wieloma postaciami.

### Karty z wbudowanym lorebookiem

Lorebook to zbiór faktów o tle historii, do których AI zagląda w trakcie czatu. Jeśli karta ma wbudowany lorebook, import zatrzymuje się i pokazuje **Embedded lorebook found** (znaleziono wbudowany lorebook). Widać tam każdy plik i liczbę jego wpisów. Wybierz jedną opcję dla całej partii:

- **Import Lorebook** (import lorebooka) tworzy dodatkowo osobny lorebook aplikacji Marinara Engine powiązany z postacią.
- **No Import** (bez importu) zostawia lorebook wyłącznie wewnątrz karty.

### Importowanie całego folderu SillyTavern

Aby przenieść całą instalację SillyTavern, użyj importera zbiorczego w panelu **Settings** (Ustawienia), w zakładce **Imports** (import). Przenosi on jednocześnie postacie, czaty, presety i lorebooki. Zobacz [Importowanie z SillyTavern](../data/importing-from-sillytavern.md).

## Eksportowanie postaci

1. Otwórz postać w edytorze.
2. Kliknij **Export character** (eksport postaci) w nagłówku. Otwiera się okno **Export Character**.
3. Wybierz format. Marinara pobiera plik.

| Format | Co otrzymujesz | Najlepszy do |
| --- | --- | --- |
| **Marinara Native** | Plik `.marinara.json` z metadanymi aplikacji Marinara Engine, sprite'ami, obrazami z galerii i dołączonymi lorebookami. | Przenoszenia postaci między instalacjami aplikacji Marinara Engine z pełnią szczegółów. |
| **Compatible JSON** | Zwykły plik karty, który odczytają inne aplikacje. Pomija dodatki dostępne tylko w aplikacji Marinara Engine, takie jak sprite'y i obrazy z galerii. | Innych aplikacji, które czytają karty JSON. |
| **Compatible PNG Card** | Obrazek karty z danymi wewnątrz obrazu. Zawiera twoje sprite'y, ale nie obrazy z galerii. | Aplikacji i stron, które oczekują karty PNG, takich jak SillyTavern, Chub i Risu. |

Oba formaty **Compatible** dopisują niepuste pola **Backstory** (historia postaci) i **Appearance** (wygląd) do standardowego pola **Description**, żeby inne aplikacje zachowały te informacje. Twoja zapisana karta pozostaje bez zmian.

[Interaktywny onboarding](interactive-onboarding.md) zapisany w karcie zostaje zachowany w formatach **Marinara Native** i **Compatible PNG Card**, więc karta nadal zadaje swoje pytania, gdy ktoś zaimportuje ją do aplikacji Marinara Engine. Format **Compatible JSON** go pomija.

## Eksportowanie wielu postaci naraz

1. Kliknij **Characters** na górnym pasku nawigacji (albo najpierw **More**, jeśli tej pozycji nie widać).
2. Kliknij **Select** (wybór) na pasku narzędzi (ikona znaku zaznaczenia) i zaznacz wybrane postacie.
3. Kliknij **Export** (eksport) na pasku na dole. Marinara pobiera plik `marinara-characters.zip`.

W pliku zip jest jeden plik **Marinara Native** na każdą postać. Eksport zbiorczy nie ma opcji PNG ani JSON. Do tych formatów użyj eksportu pojedynczej postaci. Więcej sposobów zaznaczania postaci opisuje przewodnik [Porządkowanie biblioteki postaci](library-organization.md#export-or-delete-many-characters).

## Powiązane przewodniki

- [Tworzenie i edycja postaci](creating-and-editing-characters.md)
- [Card Browser: wyszukiwanie i importowanie postaci](bot-browser.md)
- [Importowanie z SillyTavern](../data/importing-from-sillytavern.md)
