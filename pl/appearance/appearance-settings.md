# Ustawienia wyglądu

Ten przewodnik prowadzi sekcja po sekcji przez zakładkę **Settings -> Appearance** (Ustawienia -> Wygląd) w aplikacji Marinara Engine. Znajdziesz tu kolory, rozmiar tekstu, układ czatu, stylowanie wiadomości w każdym trybie oraz sposób przywrócenia wszystkich ustawień domyślnych.

Czcionki, tła i własne motywy CSS mają osobne przewodniki. Ta strona odsyła do nich w odpowiednich miejscach.

## Otwieranie ustawień wyglądu

1. Otwórz panel **Settings**.
2. Wybierz zakładkę **Appearance**.

Zakładka dzieli się na sekcje, przez które się przewijasz: **App Style**, **Text & Scale**, **Conversation Display**, **Tracker Panel**, **Roleplay Messages**, **Game Presentation**, **Atmosphere**, **Conversation Theme** oraz **Backgrounds**.

## Color Scheme (ciemny lub jasny)

Lista rozwijana **Color Scheme** (schemat kolorów) znajduje się w sekcji **App Style**. Ma dwie opcje:

- **Dark** (domyślnie). Łagodniejszy dla oczu w ciemnym pomieszczeniu.
- **Light**.

Kilka opisanych niżej kolorów ma osobne wartości domyślne dla trybu ciemnego i jasnego. Do momentu ustawienia własnego koloru idą one automatycznie za aktywnym schematem Color Scheme.

## Visual Style

Pole **Visual Style** (styl wizualny) decyduje o ogólnym wyglądzie całej aplikacji. Do wyboru są dwa kafelki:

- **Default (Marinara)** (domyślnie). Retrowy wygląd w stylu Y2K z efektami poświaty.
- **SillyTavern**. Czysty, minimalistyczny wygląd inspirowany oryginalną aplikacją SillyTavern.

To wyłącznie warstwa wizualna. Nie ma nic wspólnego z importem danych z aplikacji SillyTavern, która jest osobnym narzędziem.

## Background Color i Accent Color

Obie kontrolki znajdują się w sekcji **App Style**. Każda przyjmuje jednolity kolor albo gradient. Gradient to płynne przejście między dwoma lub większą liczbą kolorów.

- **Background Color** (kolor tła) maluje główną powłokę aplikacji za całą resztą. Domyślnie jest to `#050312` w trybie Dark i `#faf8ff` w trybie Light.
- **Accent Color** (kolor akcentu) koloruje przyciski, aktywne ikony, obwódki fokusu, podświetlenia i kontury paneli. Domyślnie w obu schematach jest to `#d4acfb`.

Wartość taka jak `#d4acfb` to szesnastkowy kod koloru, czyli krótki zapis barwy. Żeby wrócić do wartości domyślnej dla schematu, wyczyść pole przyciskiem **Reset to default** (przywrócenie wartości domyślnej).

Zachowaniem koloru akcentu sterują dwa przełączniki:

- **Accent Pulse** (domyślnie wyłączony) delikatnie animuje kolor akcentu. Kolory jednolite rozjaśniają się i przygasają. Gradienty przechodzą po kolei przez swoje barwy.
- **RGB Mode** (domyślnie wyłączony) przez cały czas działania przeprowadza akcent przez tęczową paletę. Zapisany kolor akcentu pozostaje bez zmian.

Naraz działa tylko jedna z tych opcji. Włączenie **RGB Mode** wyłącza **Accent Pulse**, a włączenie **Accent Pulse** wyłącza **RGB Mode**. Efekt Accent Pulse widać na żywo, dopóki zakładka Appearance jest otwarta. Jeśli urządzenie ma włączone ograniczenie animacji, obie animacje są pomijane.

## Chat widget style

Na dole sekcji **App Style** wybierz **Default** (domyślny), **Dottore** lub **Prof. Mari** dla przesuwanych przycisków, okien i sekcji czatu. Czcionkę, kształt ramki i trzy główne kolory można zmieniać osobno. Narzędzia wyboru kolorów obsługują też gradienty.

**Button size (px)** (rozmiar przycisków w pikselach) zmienia rozmiar przesuwanych przycisków czatu i ich ikon bez zmiany ustawienia Display Size. Wpisz rozmiar od 32 do 96 pikseli. Zostaw pole puste lub użyj jego przycisku resetowania, aby zachować bieżący rozmiar domyślny. Rozmiar zapisuje się w preferencjach wyglądu i nie zmienia się po wybraniu innego presetu.

Pod narzędziami wyboru kolorów przełączniki **Apply preset font** (zastosowanie czcionki presetu), **Apply preset shape** (zastosowanie kształtu presetu) i **Apply preset colors** (zastosowanie kolorów presetu) pozwalają dopasować resztę czatu. Są początkowo wyłączone i działają niezależnie. Obejmują wiadomości, pola wpisywania i kontrolki czatu. W trybie Game Mode obejmują też widgety paska HUD, panel mapy, uwagi poboczne, karty postaci, dzienniki, ekwipunek, panele walki i okna dialogowe. Wiadomości Conversation mogą korzystać z wybranej czcionki i kolorów, ale zachowują swój kształt. Uwzględniają też własną czcionkę, kształt i kolory. Przy włączonym przełączniku **Apply preset colors** wypowiedzi w cudzysłowie nadal mają kolor Dialogue Highlight Color ustawiony dla danej postaci lub persony. Przykłady i własne motywy opisuje przewodnik [Własne motywy CSS](custom-css-themes.md#ready-made-chat-window-styles).

## Custom Mouse Pointer

**Custom Mouse Pointer** (własny wskaźnik myszy, domyślnie włączony) wyświetla w całej aplikacji kursor w kolorze akcentu. Wyłącz go, żeby korzystać ze zwykłego kursora systemowego albo żeby o wyglądzie kursora decydował własny motyw CSS.

## Display Size i Chat Font Size

Obie kontrolki znajdują się w sekcji **Text & Scale**.

- **Display Size** (rozmiar wyświetlania) ustawia bazowy rozmiar tekstu dla całej aplikacji na tym urządzeniu. Do wyboru są **Tiny**, **Small**, **Medium**, **Default** (17px), **Large** i **Huge**.
- **Chat Font Size** (rozmiar czcionki czatu) to suwak ustawiający rozmiar tekstu wiadomości w czacie. Zakres sięga od 12px do 48px. Domyślnie jest to 16px.

W tej samej sekcji leży lista rozwijana **Font**. Aby dodać własne czcionki albo pobrać je z Google Fonts, zajrzyj do przewodnika [Własne czcionki i Google Fonts](fonts.md).

## Kolory tekstu czatu i obrys

Również w sekcji **Text & Scale** cztery kontrolki decydują o tym, jak tekst czatu czyta się na tle.

- **Chat Text Color** (kolor tekstu czatu) ustawia główny kolor tekstu wiadomości. Domyślnie jest to `#d4d4d4` w trybie Dark i `#1a1025` w trybie Light.
- **Default Dialogue Color** (domyślny kolor dialogów) koloruje wypowiedzi w cudzysłowie wtedy, gdy karta postaci lub karta persony nie definiuje własnego koloru Dialogue Highlight Color. Kolory z karty mają pierwszeństwo. Gdy przełącznik **Apply preset colors** jest włączony, takie wypowiedzi przyjmują zamiast tego kolor tekstu ze stylu widgetów czatu.
- **Chat Chrome Text Color** ustawia zwykły tekst w widgetach trackerów, etykietach folderów i opisach ustawień. Korzysta z tych samych wartości domyślnych co **Chat Text Color**.
- **Text Outline / Stroke** (obrys tekstu) dodaje wokół tekstu czatu obwódkę, dzięki której pozostaje on czytelny na niespokojnym tle. Ustaw kolor obrysu i szerokość **Width** od 0px do 5px. Domyślna szerokość to 0.5px. Szerokość 0 wyłącza obrys.

Każdy kolor idzie za wartością domyślną schematu Color Scheme, dopóki nie ustawisz własnej. Wyczyszczenie pola koloru przywraca wartość domyślną schematu, a nie zostawia pustki.

## Chat Layout (sekcja Conversation Display)

Sekcja **Conversation Display** ma jedną kontrolkę, **Chat Layout** (układ czatu), która zmienia wygląd wiadomości w trybie Conversation. Podgląd na żywo odświeża się przy każdym wyborze.

- **Linear** (domyślnie). Wiersze w stylu czatu.
- **Bubbles**. Dymki w stylu komunikatora.

## Tracker Panel

Sekcja **Tracker Panel** odpowiada za styl bocznego panelu trackerów w trybie Roleplay. Ten panel to osobna funkcja z własnym przewodnikiem. Zobacz [Pasek HUD i trackery w trybie Roleplay](../roleplay/hud-and-trackers.md).

## Wygląd wiadomości w trybie Roleplay

Sekcja **Roleplay Messages** odpowiada za styl wiadomości w czatach w trybie Roleplay.

- **Chat position** określa, gdzie na szerokim ekranie znajdują się wiadomości i pole, w którym je wpisujesz: **Left**, **Center** (domyślnie) lub **Right**. Przesuwają się razem, a otwarty pasek boczny lub Tracker Panel po tej samej stronie odsuwa je na bok, żeby czat nigdy nie znalazł się pod spodem. Na telefonie i w wąskim oknie czat zajmuje całą szerokość, a w trybie Game Mode okno dialogowe zostaje na środku.
- **Roleplay Messages Background Opacity** to suwak od 0% do 100%. Domyślnie jest to 90%. Zmniejsz wartość, żeby tło prześwitywało przez dymki wiadomości.
- **Roleplay Avatars** wybiera styl awatara przy każdej wiadomości. Cztery opcje to **None**, **Small Circles** (domyślnie), **Small Rectangles** oraz **Glued Side Panel**.
- **Scrollable Avatars** (domyślnie wyłączone) utrzymuje awatary na widoku podczas przewijania długiej wiadomości.
- **Message avatar scale** to suwak od 75% do 250%. Domyślnie jest to 100%.
- **Default sprite scale** to suwak od 50% do 175%. Domyślnie jest to 100%. Rozmiar sprite'ów ustawiony dla konkretnego czatu nadal ma pierwszeństwo przed tą wartością.

## Game Presentation

Sekcja **Game Presentation** skaluje grafikę w trybie Game Mode. Tryb Game Mode potrafi pokazać jednocześnie portret dialogowy i sprite'a całej postaci. Te dwa suwaki ustawiają ich rozmiar.

- **Dialogue portrait scale** to suwak od 75% do 175%. Domyślnie jest to 100%.
- **Full-body sprite scale** to suwak od 75% do 275%. Domyślnie jest to 135%.

Pole **Game Dialogue Display** decyduje o zachowaniu okna dialogowego:

- **Classic VN** (domyślnie). W oknie dialogowym widać jeden aktywny fragment. Wcześniejsze linijki kryją się pod przyciskiem **Logs**.
- **History Above VN**. Wcześniejsze fragmenty pokazują się nad oknem dialogowym. Cała sesja pozostaje tam do przewijania.

## Efekty pogodowe w sekcji Atmosphere

Sekcja **Atmosphere** ma jeden przełącznik, **Dynamic weather effects (rain, snow, fog, etc.)**, włączony domyślnie. Pokazuje animowane cząsteczki pogodowe zgodnie z pogodą i porą dnia w historii.

Ten przełącznik daje efekt tylko wtedy, gdy dla czatu włączony jest agent **World State**. To ten agent odczytuje pogodę z historii. Bez niego przełącznik nic nie zmienia. Zobacz [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md).

## Conversation Theme

Sekcja **Conversation Theme** ustawia dwukolorowe tło gradientowe dla wszystkich czatów w trybie Conversation. Ma osobne zakładki **Dark** i **Light**, więc każdy schemat Color Scheme zachowuje własny gradient. To ustawienie domyślne dla całego urządzenia, a nie dla pojedynczego czatu.

## Backgrounds

W sekcji **Backgrounds** importujesz i wybierasz obrazy tła czatu oraz ustawiasz rozmycie **Background Blur**. To osobny obszar funkcji z własną biblioteką, więc ma też własny przewodnik. Zobacz [Tła czatu](chat-backgrounds.md).

## Reset Appearance

Przycisk **Reset Appearance** (przywrócenie domyślnego wyglądu) siedzi na górze sekcji **App Style**. Przywraca całą zakładkę **Appearance** do ustawień domyślnych aplikacji Marinara Engine. Obejmuje to kolory, rozmiary tekstu, układ, skalę awatarów i sprite'ów oraz gradienty.

Ten przycisk czyści też tło bieżącego czatu i wyłącza aktywny własny motyw z biblioteki Theme Library. Sięgnij po niego, kiedy stylowanie zrobi się chaotyczne i przyda się czysty start.

## Ustawienia, które zostają na tym urządzeniu

Większość ustawień wyglądu synchronizuje się z pozostałymi urządzeniami. Dwa nie: **Display Size** i **Chat Font Size** zapisują się w używanej przeglądarce i nigdy się nie synchronizują.

Pełny obraz tego, które ustawienia synchronizują się między urządzeniami, a które zostają lokalnie, znajdziesz w przewodniku [Przegląd ustawień](../settings/settings-overview.md).

## Powiązane przewodniki

- [Własne czcionki i Google Fonts](fonts.md)
- [Tła czatu](chat-backgrounds.md)
- [Własne motywy CSS (Theme Library)](custom-css-themes.md)
- [Przewodnik po stylowaniu kart w CSS](card-css-theming.md)
- [Przegląd ustawień](../settings/settings-overview.md)
