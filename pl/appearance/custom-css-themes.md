# Własne motywy CSS (Theme Library)

Własny motyw CSS przemalowuje całą aplikację Marinara Engine. W sekcji **Theme Library** (biblioteka motywów) możesz tworzyć, importować, eksportować i przełączać motywy. Ten przewodnik wymienia też zmienne i klasy CSS, z których może korzystać motyw, i wyjaśnia, jak motywy współpracują z Card CSS. Aby szybko zmienić wygląd bez CSS, zobacz [Gotowe style okien czatu](#ready-made-chat-window-styles).

Zanim zaczniesz: jeśli otwierasz aplikację Marinara Engine z innego urządzenia, na przykład z telefonu, serwer potrzebuje sekretu administratora, zanim będzie można tworzyć, edytować, importować, włączać lub usuwać motywy. Na komputerze, na którym działa serwer, sekret nie jest potrzebny.

1. Na serwerze ustaw `ADMIN_SECRET` w pliku `.env`.
2. W aplikacji otwórz **Settings → Advanced → Admin Access** (ustawienia, zaawansowane, dostęp administracyjny) i wpisz tę samą wartość.

Zobacz dokument [Konfiguracja serwera](../CONFIGURATION.md) oraz przewodnik [Dostęp zdalny](../REMOTE_ACCESS.md). Aby przełączyć się na motyw, który ktoś ci przekazał, przejdź do sekcji [Włączanie motywu](#activating-a-theme).

## Czym jest własny motyw

CSS, czyli Cascading Style Sheets, to kod, który ustala kolory, obramowania i odstępy. Motyw to blok kodu CSS, który może zmienić tło strony, kolor akcentu, karty, obramowania, tekst i sporo więcej.

Motywy są przechowywane w sekcji **Theme Library** na twoim serwerze Marinara, więc synchronizują się z każdym urządzeniem połączonym z tym samym serwerem. Większość pozostałych ustawień wyglądu zostaje na jednym urządzeniu. Aktywny może być tylko jeden motyw naraz, a w bibliotece możesz trzymać dowolnie wiele motywów.

## Gdzie znaleźć sekcję Theme Library

1. Otwórz **Settings** (Ustawienia).
2. Przejdź do zakładki **Addons** (dodatki).
3. Znajdź sekcję **Theme Library**.

## Tworzenie motywu

1. W sekcji **Theme Library** kliknij przycisk **Create Theme** (utworzenie motywu).
2. Wpisz nazwę w polu nazwy (widać w nim tekst "Theme name...").
3. Wpisz lub wklej kod CSS w dużym polu tekstowym.
4. Zostaw przełącznik **Preview** (podgląd) włączony, żeby widzieć zmiany na żywo podczas pisania. Wyłącz go, aby zatrzymać podgląd na żywo.
5. Kliknij przycisk **Save**.

Nowy motyw powstaje z szablonu, który wypisuje najczęściej używane zmienne jako zakomentowane przykłady. Usuń znaki komentarza i wpisz własne wartości. Zupełnie nowy motyw zostaje włączony od razu po zapisaniu, a na ekranie pojawia się komunikat: Theme "My Theme" saved and activated.

Aby zmienić motyw później, znajdź go na liście **Installed Themes** (zainstalowane motywy), kliknij ikonę kodu (jej podpowiedź brzmi **Edit theme CSS**), wprowadź zmiany i kliknij przycisk **Save**. Edycja nie zmienia tego, który motyw jest aktywny.

## Importowanie i eksportowanie motywów

Aby zaimportować motyw:

1. Kliknij przycisk **Import File** (import pliku) w sekcji **Theme Library**.
2. Wybierz plik `.css` albo `.json`.
3. Przeczytaj komunikat. Podaje on, ile motywów zostało zaimportowanych, pominiętych lub odrzuconych.

Plik `.css` staje się jednym motywem, a jego nazwa pochodzi od nazwy pliku. Plik `.json` może zawierać jeden motyw lub więcej. Plik wyeksportowany z aplikacji Marinara Engine zaimportuj bez zmian albo samodzielnie napisz mały plik:

```json
{ "name": "My Theme", "css": "..." }
```

Zaimportowane motywy nie włączają się same. Motyw o tej samej nazwie i z tym samym kodem CSS co motyw, który już jest na serwerze, zostaje pominięty.

Aby wyeksportować motyw, kliknij ikonę wysyłania (jej podpowiedź brzmi **Export theme**) w jego wierszu na liście **Installed Themes**. Marinara pobiera plik `.json`, który da się zaimportować w innym miejscu.

<a id="activating-a-theme"></a>

## Włączanie motywu

Lista **Installed Themes** pokazuje wszystkie motywy, a na samej górze znajduje się pozycja **Default Theme** (motyw domyślny).

1. Kliknij nazwę motywu, aby go włączyć. Aktywny motyw jest oznaczony haczykiem.
2. Kliknij **Default Theme**, aby wyłączyć własne motywy i wrócić do wbudowanego wyglądu.

Przycisk **Reset Appearance** (przywrócenie wyglądu) na górze sekcji **App Style** (styl aplikacji) w **Settings → Appearance** (ustawienia, wygląd) także wyłącza aktywny motyw.

Aby usunąć motyw, kliknij ikonę kosza (jej podpowiedź brzmi **Remove theme**) i potwierdź w oknie **Delete Theme** (usunięcie motywu). To trwale kasuje kod CSS motywu z serwera.

Jeśli to nie zadziałało: gdy aplikacja wygląda źle, sprawdź zarówno aktywny motyw, jak i Card CSS w czacie. Zobacz [Motywy i Card CSS](#themes-and-card-css).

<a id="ready-made-chat-window-styles"></a>

## Gotowe style okien czatu

Zanim zaczniesz: do tego nie potrzeba CSS.

1. Otwórz **Settings → Appearance → App** (ustawienia, wygląd, aplikacja).
2. Na dole sekcji **App Style** znajdź **Chat widget style** (styl widgetów czatu).
3. Wybierz styl.

| Styl | Wygląd |
| --- | --- |
| **Default** (domyślny) | Pierwotny wygląd. |
| **Dottore** | Lodowoniebieskie ramki przywodzące na myśl aparaturę, jasne metalowe krawędzie i przycięte narożniki. |
| **Prof. Mari** | Baśniowe ramki ze złotym wykończeniem, błękity kamieni szlachetnych i Primogemy przy tytułach okien. Przyciski tego stylu mają takie samo tło jak okna. |

Każdy styl ma własną czcionkę, działa w jasnym i ciemnym trybie i nadaje wspólny wygląd przyciskom, oknom oraz rozwijanym sekcjom. Wybranie stylu przywraca ustawienia **Font** (czcionka), **Shape** (kształt) i wszystkich trzech kolorów. Położenie okien pozostaje bez zmian.

Te elementy możesz zmieniać osobno:

- **Font** i **Shape** korzystają ze stylu (opcje **Preset font** i **Preset shape**, czyli czcionka i kształt presetu), dopóki nie wybierzesz innych.
- **Border & Buttons Color** (kolor obramowań i przycisków) zmienia obrysy oraz ikony przycisków. Ikony korzystają z pierwszego koloru gradientu.
- **Background Color** (kolor tła) wypełnia przyciski, okna, rozwijane sekcje i pola edycji.
- **Text Color** (kolor tekstu) zmienia tekst widgetów. Gradienty są widoczne w nagłówkach i etykietach, a pola edycji korzystają z pierwszego koloru.

Każdy kolor ma narzędzie wyboru jednolitego koloru oraz opcję gradientu. **Reset color** (przywrócenie koloru) przy danej opcji przywraca jasne lub ciemne kolory stylu. Ozdobne emblematy zachowują swoje oryginalne kolory.

### Przenoszenie stylu na czat

Trzy przełączniki pod narzędziami wyboru kolorów rozszerzają działanie stylu. Każdy jest początkowo wyłączony i działa niezależnie. Wyłączenie przełącznika przywraca zwykły wygląd odpowiedniej części czatu, a wybranie innego stylu zachowuje ustawienia przełączników.

| Przełącznik | Co stosuje |
| --- | --- |
| **Apply preset font** (zastosowanie czcionki presetu) | Czcionkę widgetów w wiadomościach, polach wpisywania i kontrolkach czatu. |
| **Apply preset shape** (zastosowanie kształtu presetu) | Kształt ramki w wiadomościach Roleplay (w układzie klasycznym i visual novel), polu dialogowym Game, polach wpisywania i kontrolkach. Wiadomości Conversation zachowują swój kształt. |
| **Apply preset colors** (zastosowanie kolorów presetu) | Kolory obramowań, tła i tekstu w tych obszarach, także w wiadomościach Conversation. Twoje własne kolory i gradienty też są stosowane. Wypowiedzi w cudzysłowie zachowują kolor Dialogue Highlight Color ustawiony dla danej postaci lub persony. Wiadomość złożona z HTML, na przykład ostylowany blok od agenta, zachowuje kolory tekstu, które sama ustawia. |

Przyciski historii, czyli **Load More** (wczytaj więcej) i **Show older** (pokaż starsze), stosują się do przełączników tak jak pozostałe kontrolki czatu. W trybie Game Mode przełączniki obejmują też uwagi poboczne, widgety paska HUD, panel mapy, karty postaci, dzienniki, ekwipunek, panele walki i okna dialogowe. Asystentka Professor Mari może też tworzyć własne motywy dla tych obszarów.

Własny motyw nadal może nadpisywać style. Opisane niżej zmienne okien i rozwijanych sekcji mają pierwszeństwo przed kolorami stylu. Zmienna `--mari-window-font-family` ustawia czcionkę okien, `--mari-drawer-radius` zmienia narożniki sekcji, a `--mari-window-ornament: none` ukrywa ozdobę przy tytule. Aby usunąć wszystkie ozdoby stylu, najpierw wybierz **Default**.

<a id="themes-and-card-css"></a>

## Motywy i Card CSS

Marinara ma dwa sposoby na dodanie własnego kodu CSS i oba mogą być aktywne jednocześnie.

- Własny motyw przemalowuje całą aplikację. Wolno mu nadpisywać podstawowe zmienne aplikacji Marinara Engine, używać `!important` oraz `position: fixed`.
- Card CSS jest osadzony w karcie postaci lub persony i włącza się go osobno dla każdego czatu. Jest czyszczony ostrzej: nie może nadpisać podstawowych zmiennych, `!important` zostaje usunięty, a `position: fixed` zamienia się w `position: absolute`. Nadaje styl wiadomościom w czacie, a nie całej aplikacji. Zobacz [Przewodnik po stylowaniu kart w CSS](card-css-theming.md).

## Limity rozmiaru i nazwy

Nazwa motywu może mieć do 200 znaków. Kod CSS może zajmować do 256 KiB, liczone w bajtach UTF-8. Większy motyw zostaje odrzucony przy zapisie lub imporcie. Kod CSS własnego motywu przechodzi też przez czyszczenie, zanim zacznie działać: style, które wczytują plik z innej strony, nie działają. Zamiast tego osadź obrazek albo czcionkę jako URI `data:`.

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

Motyw może ustawić dowolną zmienną CSS używaną przez aplikację Marinara Engine, nie tylko te. Niektóre efekty mają własne zmienne. Na przykład `--marinara-theme-accent-pulse: enabled` prosi o animację pulsowania akcentu.

## Styl okien i rozwijanych sekcji czatu

Na komputerze **Chat Settings** (ustawienia czatu) otwiera się jako przesuwane okno. Jego rozwijane sekcje nazywają się po angielsku **drawers**. Sekcję można wydzielić do osobnego okna, a potem zminimalizować do małego, przesuwanego przycisku, nazywanego **bubble**.

Takie okna i przyciski służą też innym narzędziom czatu, w tym **Game controls** (sterowanie grą), **Session** (sesja), **Volume** (głośność), **Game Assets** (zasoby gry), powiązanym czatom i kontrolkom pakietów. Na telefonie większość okien otwiera się jako panele na całą szerokość; Echo Chamber pozostaje niewielkim oknem, które można przesuwać i którego rozmiar można zmieniać. Narzędzia wydzielone z Chat Settings znajdziesz w przesuwanym menu **Chat tools** (narzędzia czatu) z trzema kropkami; przyciski trackerów pozostają osobno.

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
| Aktualne podsumowanie, które przycisk pokazuje zamiast ikony (baner World State) | `.mari-window-bubble__banner` |
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
- Przycisk zminimalizowanego okna ma jego `data-window` i `data-minimized="true"`, na przykład `.mari-window-bubble[data-window="control:volume"]`. Okna kontrolek mają nazwy `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>` i `control:beholder:<package>`. Podczas przeciągania przycisku `data-dragging` ma na nim wartość `"true"`. Przycisk, który zamiast ikony pokazuje aktualne podsumowanie, na przykład zminimalizowany tracker World State, ma `data-banner="true"` i rozszerza się do szerokości tego podsumowania.
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

## Stylowanie wiadomości, pól wpisywania i kontrolek czatu

Trzy przełączniki **Apply preset** pozwalają też własnemu motywowi stosować wygląd widgetów w pozostałej części czatu. Motyw może nadpisywać poszczególne elementy za pomocą poniższych zmiennych. Jeśli nie chcesz pisać CSS, poproś asystentkę Professor Mari o pasujący motyw czatu.

| Element | Klasa |
| --- | --- |
| Pola wiadomości Roleplay i Game, uwagi poboczne Game, widgety paska HUD, panel mapy i karty postaci oraz pola wpisywania wiadomości | `.mari-chat-style-surface` |
| Dzienniki, ekwipunek, panele walki, opcje wyboru i okna dialogowe Game; panele mają też atrybut `data-game-section` ze swoją nazwą, np. `logs`, `inventory` albo `combat-actions` | `.mari-game-section.mari-chat-style-surface` |
| Treści Game w oknie, takie jak zakładka Journal, które korzystają z kolorów okna | `.mari-game-section` |
| Wiadomości Conversation (tylko czcionka i kolory) | `.mari-chat-style-conversation` |
| Tekst wiadomości Conversation bez obramowania | `.mari-chat-style-text` |
| Kontrolki czatu, w tym Calls i kontrolki grup Conversation | `.mari-chat-style-control` |
| Przyciski historii: **Load More**, **Show older**, **Show newer** (pokaż nowsze), **Latest** (najnowsze) oraz **Older** (starsze), **All** (wszystkie) i **Show more older logs** (pokaż więcej starszych dzienników) w dziennikach Game. Mają też `.mari-chat-style-control` | `.mari-chat-history-pager` |
| Wiadomość złożona z HTML, na przykład ostylowany blok od agenta. Ustawione w niej kolory tekstu zostają zachowane przy włączonym **Apply preset colors** | `.mari-html-content` |

| Zmienna | Co zmienia |
| --- | --- |
| `--mari-chat-font-family` | Czcionkę odpowiednich obszarów czatu |
| `--mari-chat-bg` | Tło pola; przyjmuje kolor lub gradient |
| `--mari-chat-text` | Czytelny, jednolity kolor tekstu |
| `--mari-chat-border` | Obramowanie pola; przyjmuje kolor lub gradient |
| `--mari-chat-border-color` | Jednolity kolor obramowania używany jako wartość zapasowa |
| `--mari-chat-radius` | Zaokrąglenie pól z wyjątkiem wiadomości Conversation |
| `--mari-chat-control-bg`, `--mari-chat-control-bg-hover` | Tła przycisków czatu |
| `--mari-chat-control-color`, `--mari-chat-control-radius` | Kolor ikon i zaokrąglenie przycisków czatu |
| `--mari-chat-input-bg` | Tło wewnątrz pól edycji |

Na przykład przy włączonych **Apply preset font** i **Apply preset colors**:

```css
:root {
  --mari-chat-font-family: Georgia, serif;
  --mari-chat-bg: #251e29;
  --mari-chat-text: #f4e8dc;
  --mari-chat-border: linear-gradient(100deg, #d6aa66, #dda0b2);
}
```

Nieustawione zmienne korzystają z ustawień widgetów i presetu. Aby te zmienne działały przez wbudowane style, odpowiedni przełącznik musi być włączony. Wiadomości Conversation zachowują swój kształt nawet przy włączonym **Apply preset shape**. Własne motywy mogą też bezpośrednio odwoływać się do klas; ozdobne przycinanie nie powinno obejmować obrysów fokusu, menu ani treści wiadomości.

Na telefonach menu z trzema kropkami rozwija się w okrągłe przyciski. Jego przycisk otwierający to `[data-chat-tools-menu-button]`, rozwinięta kolumna to `[data-chat-tools-menu]`, a każda pozycja listy ma `data-chat-tools-menu-item` ustawione na identyfikator swojego okna. Przyciski narzędzi używają `.mari-window-bubble.mari-chat-tools-button` i `data-chat-tools-menu-tool` z tym samym identyfikatorem. Kolumna nie ma ramki okna; jej przyciski korzystają z kolorów widgetów i ustawionego rozmiaru przycisków, niezależnie od trzech przełączników dla reszty czatu, a przy tym zachowują okrągły kształt.

## Powiązane przewodniki

- [Przewodnik po stylowaniu kart w CSS](card-css-theming.md)
- [Ustawienia wyglądu](appearance-settings.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
- [Dostęp zdalny: logowanie i lista dozwolonych adresów IP](../REMOTE_ACCESS.md)
