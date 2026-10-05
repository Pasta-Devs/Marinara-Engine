# Własne motywy CSS (Theme Library)

Z tego przewodnika dowiesz się, jak zmienić cały wygląd aplikacji Marinara Engine za pomocą własnego motywu CSS. Zobaczysz, jak tworzyć, importować, eksportować i włączać motywy. Poznasz też zmienne CSS, które da się nadpisać, oraz to, jak motywy współpracują z Card CSS.

## Gotowe style okien czatu

Aby zmienić wygląd bez pisania CSS, otwórz **Settings > Appearance > App** (ustawienia, wygląd, aplikacja) i znajdź **Chat widget style** (styl widgetów czatu) na dole sekcji **App Style** (styl aplikacji). **Dottore** nadaje przyciskom i oknom turkusowe obramowania z przyciętymi narożnikami. **Mari** dodaje różowo-złote ramki z Primogemami przy tytułach okien. Przyciski tego presetu mają takie samo tło jak okna. Każdy preset ma własną czcionkę, działa w jasnym i ciemnym trybie i obejmuje przyciski, okna oraz rozwijane sekcje.

Opcje **Font** (czcionka) i **Shape** (kształt) pozwalają zmieniać te elementy osobno. **Preset font** (czcionka presetu) i **Preset shape** (kształt presetu) korzystają z wybranego stylu.

Niżej są trzy ustawienia kolorów. Każde ma narzędzie wyboru jednolitego koloru oraz opcję gradientu, czyli płynnego przejścia między kolorami:

- **Border & Buttons Color** (kolor obramowań i przycisków) zmienia obrysy oraz ikony przycisków. Ikony korzystają z pierwszego koloru gradientu.
- **Background Color** (kolor tła) wypełnia przyciski, okna, rozwijane sekcje i pola edycji.
- **Text Color** (kolor tekstu) zmienia tekst widgetów. Gradienty są widoczne w nagłówkach i etykietach; tekst w polach edycji korzysta z pierwszego koloru.

Ozdobne emblematy zachowują swoje oryginalne kolory.

Użyj **Reset color** (przywrócenie koloru) przy wybranej opcji, aby znów korzystać z jasnych lub ciemnych kolorów presetu. Wybranie presetu przywraca jego ustawienia **Font**, **Shape** i wszystkich trzech kolorów. **Default** (domyślny) przywraca pierwotny wygląd. Położenie okien pozostaje bez zmian.

Własne motywy CSS nadal mogą nadpisywać te presety. Opisane niżej publiczne zmienne okien i sekcji mają pierwszeństwo przed kolorami presetu. Zmienna `--mari-window-font-family` ustawia czcionkę okien, `--mari-drawer-radius` zmienia narożniki sekcji, a `--mari-window-ornament: none` ukrywa ozdobę przy tytule. Aby usunąć wszystkie ozdoby presetu, najpierw wybierz **Default**.

## Czym jest własny motyw

Własny motyw to blok kodu CSS, który przemalowuje aplikację Marinara Engine. CSS, czyli Cascading Style Sheets, to kod odpowiadający za kolory, obramowania i odstępy w całej aplikacji. Motyw może zmienić tło strony, kolor akcentu, karty, obramowania, tekst i sporo więcej.

Własne motywy mieszkają w sekcji **Theme Library** (biblioteka motywów). Marinara zapisuje je na serwerze, więc synchronizują się z każdym urządzeniem i każdą przeglądarką połączoną z tym samym serwerem. Tym różnią się od większości pozostałych ustawień wyglądu, które zostają na jednym urządzeniu. Ustawienia przypisane do jednego urządzenia opisuje przewodnik [Ustawienia wyglądu](appearance-settings.md).

Aktywny może być tylko jeden własny motyw naraz. W bibliotece da się trzymać dowolnie wiele motywów i przełączać się między nimi.

## Gdzie znaleźć sekcję Theme Library

1. Otwórz **Settings** (Ustawienia).
2. Przejdź do zakładki **Addons**.
3. Znajdź sekcję **Theme Library**.

Sekcja nosi tytuł **Theme Library**, a jej opis brzmi "Create, import, activate, edit, export, or remove custom CSS themes."

## Tworzenie motywu

1. W sekcji **Theme Library** kliknij przycisk **Create Theme** (utworzenie motywu).
2. Wpisz nazwę w polu **Theme name**.
3. Wpisz lub wklej kod CSS w dużym polu tekstowym.
4. Zostaw przełącznik **Preview** (podgląd) włączony, żeby widzieć zmiany w aplikacji na żywo podczas pisania. Wyłącz **Preview**, aby zatrzymać podgląd na żywo.
5. Kliknij przycisk **Save**.

Nowy motyw powstaje z szablonu. Szablon wypisuje najczęściej używane zmienne jako zakomentowane przykłady, więc wystarczy usunąć znaki komentarza i wpisać własne wartości. Zupełnie nowy motyw Marinara włącza od razu po zapisaniu. Pokazuje przy tym potwierdzenie z nazwą motywu, na przykład: Theme "My Theme" saved and activated.

Aby zmienić motyw później, znajdź go na liście **Installed Themes** (zainstalowane motywy). Kliknij ikonę kodu (jej podpowiedź brzmi **Edit theme CSS**), wprowadź zmiany i kliknij przycisk **Save**. Edycja zapisanego motywu aktualizuje go, ale nie zmienia tego, który motyw jest aktywny.

## Importowanie i eksportowanie motywów

Motywami da się dzielić w postaci plików. Przydaje się to przy przenoszeniu motywu między serwerami albo przy przekazywaniu go znajomym.

Aby zaimportować motyw:

1. Kliknij przycisk **Import File** (import pliku) w sekcji **Theme Library**.
2. Wybierz plik `.css` albo plik `.json`.
3. Przeczytaj komunikat, który się pojawi. Podaje on, ile motywów zostało zaimportowanych, pominiętych lub odrzuconych.

Plik `.css` staje się jednym motywem, a jego nazwa pochodzi od nazwy pliku. Plik `.json` może zawierać jeden motyw lub więcej i występuje w dwóch odmianach.

Pierwsza odmiana to plik wyeksportowany z aplikacji Marinara Engine. Każdy motyw jest w nim opakowany w dodatkowe pola, które Marinara dokłada przy eksporcie. Nie trzeba tego czytać ani edytować. Zaimportuj plik bez zmian.

Druga odmiana to mały plik napisany samodzielnie. Dla pojedynczego motywu wystarczy tyle:

```
{ "name": "My Theme", "css": "..." }
```

Zaimportowane motywy synchronizują się z serwerem, ale nie włączają się same. Motyw, który już jest na serwerze pod tą samą nazwą i z tym samym kodem CSS, zostaje pominięty, a nie dodany po raz drugi.

Aby wyeksportować motyw, znajdź go na liście **Installed Themes** i kliknij ikonę wysyłania (jej podpowiedź brzmi **Export theme**). Marinara pobiera plik `.json`, który da się zaimportować w innym miejscu.

## Włączanie motywu

Lista **Installed Themes** pokazuje wszystkie motywy, a na samej górze znajduje się **Default Theme** (motyw domyślny).

1. Kliknij nazwę motywu, aby go włączyć. Aktywny motyw jest oznaczony haczykiem.
2. Kliknij **Default Theme**, aby wyłączyć własne motywy i wrócić do wbudowanego wyglądu aplikacji Marinara Engine.

Przycisk **Reset Appearance** (przywrócenie wyglądu) znajduje się na górze sekcji **App Style** w **Settings -> Appearance**. Jego użycie wyłącza także aktywny własny motyw.

Aby usunąć motyw na dobre, kliknij ikonę kosza w jego wierszu (jej podpowiedź brzmi **Remove theme**), a potem potwierdź w oknie **Delete Theme**. To trwale kasuje kod CSS motywu z serwera.

## Wykaz zmiennych CSS

Edytor motywu ma rozwijaną sekcję **CSS Variable Reference**. Kliknij ją, aby zobaczyć najbardziej przydatne zmienne, które można nadpisać. Motyw zmienia wygląd aplikacji, ustawiając te zmienne w bloku `:root`. Wykaz wymienia następujące zmienne:

| Zmienna | Za co odpowiada |
| --- | --- |
| `--background` | Tło strony |
| `--foreground` | Główny tekst |
| `--primary` | Akcent i przyciski |
| `--primary-foreground` | Tekst na kolorze primary |
| `--secondary` | Karty i pola |
| `--card` | Tło karty |
| `--border` | Obramowania |
| `--muted-foreground` | Przygaszony tekst |
| `--sidebar` | Tło paska bocznego |
| `--sidebar-border` | Obramowanie paska bocznego |
| `--marinara-shell-edge-border` | Lewa i prawa krawędź obudowy |
| `--destructive` | Błędy i usuwanie |
| `--popover` | Tło listy rozwijanej |
| `--accent` | Podświetlenia pod kursorem |

Ta lista nie jest granicą. Motyw może ustawić dowolną zmienną CSS używaną przez aplikację Marinara Engine, a do tego dołożyć własne style.

Niektóre efekty wizualne mają swoje własne zmienne. Motyw może na przykład poprosić o animację pulsowania akcentu, ustawiając `--marinara-theme-accent-pulse: enabled`.

Kod CSS własnego motywu przechodzi przez czyszczenie, zanim zacznie działać – dla bezpieczeństwa. Style, które wczytują plik z innej strony, nie działają. Aby użyć w motywie obrazka albo czcionki, osadź je jako URI `data:` zamiast odnośnika sieciowego. URI `data:` mieści treść pliku bezpośrednio w kodzie CSS.

## Styl okien i rozwijanych sekcji czatu

Na komputerze **Chat Settings** (ustawienia czatu) otwiera się jako przesuwane okno. Jego rozwijane sekcje nazywają się po angielsku **drawers**. Sekcję można wydzielić do osobnego okna, a potem zminimalizować do małego, przesuwanego przycisku, nazywanego **bubble**.

Takie okna i przyciski służą też innym narzędziom czatu, w tym **Game controls** (sterowanie grą), **Session** (sesja), **Volume** (głośność), **Game Assets** (zasoby gry), powiązanym czatom i kontrolkom pakietów. Na telefonie okna otwierają się jako panele na całą szerokość, a **Tracker Panel** (panel trackerów) ma własny przesuwany przycisk.

Poniższe klasy, atrybuty i zmienne pozwalają nadać tym elementom wspólny styl. Reguły własnego motywu nadpisują ustawienia domyślne bez `!important`.

### Klasy

| Element | Klasa |
| --- | --- |
| Okno | `.mari-window` |
| Pasek tytułu | `.mari-window__header` |
| Tytuł z ikoną | `.mari-window__title-row` |
| Tytuł | `.mari-window__title` |
| Przyciski paska tytułu (**Reset View**, gwiazdka ulubionego układu, **Tracker Panel**, przypięcie, blokada, zamknięcie, **Put back**) | `.mari-window__controls` (każdy przycisk ma klasę `.mari-window__control`) |
| Zawartość okna | `.mari-window__body` |
| Krawędzie i narożniki do zmiany rozmiaru | `.mari-window__resize-handle` |
| Znacznik w narożniku widoczny, gdy wskaźnik lub fokus klawiatury znajduje się w oknie | `.mari-window__resize-grip` |
| Rozwijana sekcja | `.mari-drawer` |
| Nagłówek i tytuł sekcji | `.mari-drawer__header`, `.mari-drawer__title` |
| Ikona sekcji, plakietka z liczbą i **?** | `.mari-drawer__icon`, `.mari-drawer__count`, `.mari-drawer__help` |
| Podgląd zwiniętej sekcji (mały widget trackera) | `.mari-drawer__summary` |
| Przyciski sekcji obok strzałki i przycisk wydzielenia do okna | `.mari-drawer__actions`, `.mari-drawer__popout` |
| Strzałka i zawartość sekcji | `.mari-drawer__arrow`, `.mari-drawer__body` |
| Podgląd, który podąża za wskaźnikiem podczas przeciągania sekcji poza okno | `.mari-drawer-ghost` |
| Przycisk zminimalizowanego okna (bubble) | `.mari-window-bubble` |
| Linia pomocnicza widoczna, gdy przeciągany przycisk wyrównuje się z innym | `.mari-window-snap-guide` |
| Kropka widoczna podczas pracy agentów (przycisk **Chat Settings**, okno **Trackers**) | `.mari-agents-running-dot` |

### Atrybuty danych

- `data-window` określa okno i jego przycisk: `chat-settings`, `trackers`, okna kontrolek `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>` i `control:beholder:<package>` oraz `drawer:<window>:<drawer>` dla wydzielonej sekcji, na przykład `drawer:chat-settings:chat-name`.
- `data-drawer` określa sekcję, na przykład `chat-name`. Niektóre nazwy zaczynają się od trybu czatu, jak `roleplay-agents` lub `conversation-agents`. Trackery korzystają z nazw `tracker-world`, `tracker-persona`, `tracker-characters`, `tracker-quests`, `tracker-inventory`, `tracker-custom` i `agent-activity`.
- `data-presentation` ma wartość `"window"` w oknie na komputerze albo `"sheet"` w panelu na telefonie.
- `data-pinned` i `data-locked` mają wartość `"true"`, gdy okno jest przypięte lub zablokowane.
- `data-window-control` określa przycisk paska tytułu: `"pin"`, `"lock"`, `"close"` lub `"put-back"`. Włączony przycisk przypięcia lub blokady ma też `aria-pressed="true"`.
- `data-chat-settings-control` oznacza dodatkowe przyciski paska tytułu **Chat Settings**: `"reset-view"`, `"favorite-layout"` i `"tracker-panel"`. Gwiazdka ulubionego układu ma `aria-pressed="true"` i wypełnioną ikonę, gdy bieżący układ odpowiada zapisanemu ulubionemu.
- `data-edge` ma wartość `"n"`, `"s"`, `"e"`, `"w"`, `"ne"`, `"nw"`, `"se"` lub `"sw"` na odpowiednim uchwycie zmiany rozmiaru.
- Przycisk otwartej sekcji wewnątrz `.mari-drawer__header` ma `aria-expanded="true"`.
- `data-drawer-control="pop-out"` oznacza przycisk wydzielenia sekcji do osobnego okna.
- `data-outside="true"` oznacza podgląd przeciągania wystarczająco daleko poza oknem, aby po upuszczeniu powstało osobne okno.
- `data-axis` ma wartość `"x"` dla pionowej linii wyrównania, a `"y"` dla poziomej.
- `data-detached` ma wartość `"true"`, gdy sekcja jest pokazana w osobnym oknie; atrybut występuje na oknie i sekcji w jego wnętrzu. Okno wydzielonej sekcji ma nazwę `data-window="drawer:<window>:<drawer>"`, na przykład `data-window="drawer:chat-settings:chat-name"`, a `data-drawer-host` określa okno, z którego pochodzi sekcja.
- `data-dragging` ma wartość `"true"` na sekcji podczas przeciągania jej tytułu, a `data-drop-target` ma wartość `"true"` na oknie, nad którym trzymasz wydzieloną sekcję gotową do włożenia z powrotem.
- Przycisk zminimalizowanego okna ma jego `data-window` i `data-minimized="true"`, na przykład `.mari-window-bubble[data-window="control:volume"]`. Okna kontrolek mają nazwy `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>` i `control:beholder:<package>`. Podczas przeciągania przycisku `data-dragging` ma na nim wartość `"true"`.
- Zablokowany przycisk, także przycisk **Chat Settings**, ma `data-locked="true"`. Nadal otwiera swoje okno, ale nie da się go przesunąć, dopóki okno jest zablokowane. Użyj `.mari-window-bubble[data-locked="true"]`, aby wyróżnić takie przyciski.
- Na telefonie okna mają `data-presentation="sheet"`. Ten sam atrybut mają ich nieco większe przyciski. Przycisk **Tracker Panel** to `.mari-window-bubble[data-tracker-panel-toggle="bubble"]`.
- Przycisk **Chat Settings** także jest przyciskiem okna: `.mari-window-bubble[data-chat-settings-button]`. Ma `data-open="true"`, gdy **Chat Settings** jest otwarte.
- Wydzielona sekcja zmniejsza się do przycisku z `data-drawer-host` (oknem, z którego pochodzi). Przycisk **Put back** (włożenie z powrotem) w jej oknie to `[data-window-control="put-back"]`.

### Zmienne

Każda zmienna domyślnie korzysta ze wspólnych kolorów interfejsu czatu, więc motyw potrzebuje tylko tych zmiennych, które ma zmienić.

| Zmienna | Co ustawia |
| --- | --- |
| `--mari-window-bg` | Tło okna |
| `--mari-window-text` | Tekst w oknie |
| `--mari-window-border`, `--mari-window-border-width` | Obramowanie okna |
| `--mari-window-radius` | Zaokrąglenie narożników okna |
| `--mari-window-shadow` | Cień okna |
| `--mari-window-backdrop-filter` | Rozmycie za oknem |
| `--mari-window-header-bg`, `--mari-window-header-text`, `--mari-window-header-border` | Kolory paska tytułu |
| `--mari-window-header-padding` | Odstępy na pasku tytułu |
| `--mari-window-control-color`, `--mari-window-control-color-hover`, `--mari-window-control-bg-hover` | Przyciski paska tytułu, w tym gwiazdkę ulubionego układu |
| `--mari-window-control-color-active`, `--mari-window-control-bg-active` | Włączone przyciski paska tytułu, w tym przypięcie, blokadę i wypełnioną gwiazdkę |
| `--mari-window-control-radius`, `--mari-window-control-gap` | Zaokrąglenie i odstępy przycisków |
| `--mari-window-focus-ring` | Obrys fokusu klawiatury i okna, do którego można włożyć sekcję z powrotem |
| `--mari-window-resize-handle-size` | Szerokość krawędzi zmiany rozmiaru |
| `--mari-window-bubble-size`, `--mari-window-bubble-radius`, `--mari-window-bubble-shadow` | Rozmiar, zaokrąglenie i cień przycisku okna |
| `--mari-window-bubble-bg`, `--mari-window-bubble-bg-hover`, `--mari-window-bubble-border` | Tło i obramowanie przycisku okna |
| `--mari-window-bubble-text`, `--mari-window-bubble-text-hover` | Kolor ikony przycisku okna |
| `--mari-window-snap-guide` | Kolor linii wyrównania |
| `--mari-drawer-bg`, `--mari-drawer-border` | Tło sekcji i linię podziału |
| `--mari-drawer-header-bg`, `--mari-drawer-header-bg-hover` | Kolory nagłówka sekcji |
| `--mari-drawer-header-padding`, `--mari-drawer-body-padding-inline`, `--mari-drawer-body-padding-bottom` | Odstępy w sekcji |
| `--mari-drawer-title-color`, `--mari-drawer-icon-color`, `--mari-drawer-arrow-color` | Tekst i ikony nagłówka sekcji |
| `--mari-drawer-count-bg`, `--mari-drawer-count-text` | Plakietkę z liczbą w sekcji |

Ustaw zmienną w `:root`, aby zmienić wszystkie okna, albo na wybranym selektorze, aby zmienić jedno:

```css
:root {
  --mari-window-radius: 0.5rem;
  --mari-window-bubble-bg: #3b0764;
}

[data-window="chat-settings"] .mari-drawer[data-drawer="chat-name"] {
  --mari-drawer-border: transparent;
}
```

## Limity rozmiaru i nazwy

Nazwa motywu może mieć do 200 znaków. Kod CSS może zajmować do 256 KiB, liczone w bajtach UTF-8, a nie w znakach. Większy motyw zostaje odrzucony przy zapisie lub imporcie.

## Admin Access przy instalacji zdalnej

Tworzenie, edycja, import, włączanie i usuwanie motywu to działania chronione. Ma to znaczenie tylko wtedy, gdy aplikacja Marinara Engine jest otwierana przez sieć.

Jeśli aplikacja Marinara Engine jest otwarta na tym samym komputerze, na którym działa serwer, przez pętlę zwrotną (zwaną też localhost), te działania działają bez dodatkowych kroków. Jeśli otwierasz aplikację z innego urządzenia, na przykład z telefonu albo z innego komputera w sieci, serwer potrzebuje najpierw sekretu administratora.

Aby zarządzać motywami przez sieć:

1. Na serwerze ustaw `ADMIN_SECRET` w pliku `.env`.
2. W aplikacji otwórz **Settings -> Advanced -> Admin Access** i wpisz tę samą wartość.

Bez tego zmiany motywów przez sieć kończą się błędem. Pełną konfigurację opisują [Konfiguracja serwera](../CONFIGURATION.md) oraz przewodnik [Dostęp zdalny](../REMOTE_ACCESS.md).

## Jak motywy współpracują z Card CSS

Marinara ma dwa sposoby na dodanie własnego kodu CSS. To osobne funkcje i obie mogą być aktywne jednocześnie.

Własny motyw przemalowuje całą aplikację. Wolno mu nadpisywać podstawowe zmienne aplikacji Marinara Engine, używać `!important` oraz `position: fixed`. Na tym właśnie polega motyw.

Card CSS działa inaczej. Autor postaci lub persony może osadzić kod CSS w karcie, a ty włączasz go osobno dla każdego czatu. Card CSS jest czyszczony ostrzej. Nie może nadpisać podstawowych zmiennych aplikacji, `!important` zostaje usunięty, a `position: fixed` zamienia się w `position: absolute`. Nadaje styl wiadomościom w czacie, a nie całej aplikacji. Zobacz [Przewodnik po stylowaniu kart w CSS](card-css-theming.md).

Jeśli aplikacja wygląda źle, warto sprawdzić zarówno aktywny motyw, jak i Card CSS. Przyczyną może być każde z nich.

## Powiązane przewodniki

- [Przewodnik po stylowaniu kart w CSS](card-css-theming.md)
- [Ustawienia wyglądu](appearance-settings.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
- [Dostęp zdalny: Basic Auth i lista dozwolonych adresów IP](../REMOTE_ACCESS.md)
