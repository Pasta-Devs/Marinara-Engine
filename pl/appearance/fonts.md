# Własne czcionki i Google Fonts

Zmień czcionkę, której Marinara używa w całej aplikacji. Wybierz czcionkę wbudowaną, dodaj własne pliki czcionek albo pobierz czcionkę z serwisu Google Fonts po nazwie.

## Wybór czcionki aplikacji

1. Otwórz panel **Settings** (Ustawienia), kliknij zakładkę **Appearance** (Wygląd), a potem przycisk **App** (aplikacja).
2. Znajdź sekcję **Text & Scale**.
3. Rozwiń listę rozwijaną **Font** (czcionka) i wybierz czcionkę.

Nową czcionkę najprościej zdobyć z serwisu [Google Fonts](#downloading-from-google-fonts). Domyślnie ustawiona jest opcja **Default (Inter)**, czysty krój wybrany z myślą o czytaniu z ekranu. Dodane czcionki pojawiają się na tej samej liście, pod nią.

Wybór czcionki synchronizuje się między urządzeniami. Przełącza się na nią każda przeglądarka połączona z tym samym serwerem Marinara. Zobacz [Przegląd ustawień](../settings/settings-overview.md).

Widgety czatu mają osobną opcję **Font** w sekcji **Chat widget style** (styl widgetów czatu). Włącz tam przełącznik **Apply preset font** (zastosowanie czcionki presetu), żeby ta czcionka była używana także w wiadomościach, polach wpisywania i kontrolkach czatu. Zobacz [Gotowe style okien czatu](custom-css-themes.md#ready-made-chat-window-styles).

## Dodawanie własnych czcionek

Zanim zaczniesz: czcionki trafiają do folderu na serwerze. Serwer to komputer, na którym działa aplikacja Marinara Engine. Jeśli uruchamiasz aplikację Marinara Engine na własnym komputerze, to on jest serwerem, a folder danych to miejsce, w którym Marinara przechowuje twoje dane.

1. Kliknij przycisk **Open Fonts Folder** (otwarcie folderu czcionek) obok listy rozwijanej **Font**, żeby otworzyć folder `data/fonts/` na serwerze. Możesz też samodzielnie znaleźć folder `data/fonts/` w folderze danych aplikacji Marinara Engine.
2. Skopiuj do niego plik czcionki.
3. Przejdź do **Settings → Appearance → App → Text & Scale**.
4. Rozwiń listę rozwijaną **Font**. Czcionka jest na liście.
5. Zaznacz ją. Tekst aplikacji od razu się zmienia.

Marinara odczytuje pliki `.ttf`, `.otf`, `.woff` i `.woff2`, a pozostałe typy pomija. Nazwę wyświetlaną tworzy z nazwy pliku, więc `OpenSans-Bold.ttf` pokazuje się jako "Open Sans". Nazywaj pliki czytelnie, żeby lista była uporządkowana.

Z czcionek w folderze `data/fonts/` może korzystać każde urządzenie połączone z tym samym serwerem.

Jeśli to nie zadziałało: sprawdź typ pliku i to, czy plik leży w folderze `data/fonts/` na serwerze, a nie na urządzeniu, z którego przeglądasz aplikację.

<a id="downloading-from-google-fonts"></a>

## Pobieranie z Google Fonts

Serwer potrzebuje do tego dostępu do internetu.

1. Przejdź do **Settings → Appearance → App → Text & Scale**.
2. W polu **Google Fonts** wpisz dokładną nazwę czcionki, na przykład `Fira Code` albo `Lora`.
3. Kliknij przycisk **Add** (dodaj).
4. Poczekaj na koniec pobierania. Czcionka pojawi się wtedy na liście rozwijanej **Font**.

Link **Browse fonts at fonts.google.com →** obok pola otwiera stronę Google Fonts, na której da się sprawdzić nazwy. Nazwa może zawierać wyłącznie litery, cyfry i spacje. Ponowne pobranie tej samej czcionki zastępuje starą kopię.

Jeśli to nie zadziałało, przeczytaj komunikat błędu.

- Jeśli Marinara nie może połączyć się z serwisem Google Fonts, sprawdź połączenie z internetem.
- Jeśli komunikat mówi, że czcionki nie znaleziono, sprawdź pisownię, a na stronie Google Fonts sprawdź, czy czcionka ma styl Regular (400). Marinara pobiera tylko tę odmianę.

## Przycisk Open Fonts Folder

Przycisk **Open Fonts Folder** obok listy rozwijanej **Font** otwiera folder `data/fonts/` w eksploratorze plików na komputerze serwera, a nie na urządzeniu, którego używasz. Jeśli aplikacja Marinara Engine działa na twoim własnym komputerze, folder po prostu się otworzy. Przy połączeniu z telefonu albo drugiego komputera skopiuj pliki czcionek do folderu `data/fonts/` na serwerze samodzielnie.

Gdy wybrana jest czcionka domyślna, pola promptów w edytorze presetów i pole Example Dialogue postaci używają czcionki o stałej szerokości znaków. Każda inna czcionka też się do nich stosuje. Pozostałe pola promptów, na przykład szablon promptu agenta, zostają przy czcionce o stałej szerokości znaków.

## Powiązane przewodniki

- [Ustawienia wyglądu](appearance-settings.md)
