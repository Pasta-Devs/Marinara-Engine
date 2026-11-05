# Ustawienia wyglądu

Zakładka **Appearance** (wygląd) zmienia wygląd aplikacji Marinara Engine: kolory, rozmiar tekstu, układ czatu i styl wiadomości w każdym trybie czatu.

Szukasz czegoś innego?

- Inna czcionka: [Własne czcionki i Google Fonts](fonts.md).
- Obraz tła czatu: [Tła czatu](chat-backgrounds.md).
- Własny motyw z sekcji **Settings → Addons → Theme Library** (ustawienia, dodatki, biblioteka motywów): [Własne motywy CSS](custom-css-themes.md).
- Własny wygląd postaci w czacie: [Przewodnik po stylowaniu kart w CSS](card-css-theming.md).

## Otwieranie ustawień wyglądu

1. Otwórz panel **Settings**.
2. Wybierz zakładkę **Appearance**.
3. Wybierz przycisk na górze: **App** (aplikacja), **Conversation**, **Roleplay** albo **Game**.

Przyciski dzielą ustawienia według trybu czatu, a zakładka pokazuje tylko wybraną grupę.

| Przycisk | Sekcje |
| --- | --- |
| **App** | **App Style**, **Text & Scale**, **Atmosphere**, **Backgrounds** |
| **Conversation** | **Conversation Display**, **Conversation Theme** |
| **Roleplay** | **Tracker Panel**, **Roleplay Presentation** |
| **Game** | **Game Presentation** |

Żeby zacząć od nowa, kliknij **Reset Appearance** (przywrócenie domyślnego wyglądu) na górze sekcji **App Style**. Przycisk przywraca całą zakładkę do ustawień domyślnych aplikacji Marinara Engine, czyści tło bieżącego czatu i wyłącza aktywny motyw z biblioteki Theme Library.

## Przycisk App

### Color Scheme i Visual Style

W sekcji **App Style** lista rozwijana **Color Scheme** (schemat kolorów) ma opcje **Dark** (domyślnie) i **Light**. Aplikacja zmienia się od razu. Kolory, które mają osobne wartości domyślne dla trybu ciemnego i jasnego, idą za tym ustawieniem, dopóki nie ustawisz własnych.

**Visual Style** (styl wizualny) ma dwa kafelki. **Default (Marinara)** to retrowy wygląd w stylu Y2K z efektami poświaty. **SillyTavern** to czysty, minimalistyczny wygląd. To ustawienie zmienia wyłącznie wygląd i nie ma nic wspólnego z importem z aplikacji SillyTavern.

### Background Color i Accent Color

Obie kontrolki przyjmują jednolity kolor albo gradient, czyli płynne przejście między dwoma lub większą liczbą kolorów. Żeby wrócić do wartości domyślnej, wyczyść pole przyciskiem **Reset to default** (przywrócenie wartości domyślnej).

| Ustawienie | Co koloruje | Domyślnie |
| --- | --- | --- |
| **Background Color** (kolor tła) | Główną powłokę aplikacji. | `#050312` w trybie Dark, `#faf8ff` w trybie Light |
| **Accent Color** (kolor akcentu) | Przyciski, aktywne ikony, obwódki fokusu, podświetlenia, kontury paneli i kontrolki wokół czatu. | **Marinara Gradient** (gradient Marinara), mieszanka różu, pomarańczu i cyjanu |

Wartość taka jak `#050312` to szesnastkowy kod koloru, czyli krótki zapis barwy.

Zachowaniem akcentu sterują dwa przełączniki. Naraz może być włączony tylko jeden.

- **Accent Pulse** animuje kolor akcentu. Kolory jednolite rozjaśniają się i przygasają, a gradienty przechodzą po kolei przez swoje barwy. Domyślnie jest włączony na komputerze i wyłączony na telefonie.
- **RGB Mode** przeprowadza akcent przez tęczową paletę. Zapisany kolor **Accent Color** pozostaje bez zmian. Domyślnie jest wyłączony.

Jeśli urządzenie prosi o ograniczenie ruchu, obie animacje są pomijane.

### Pozostałe kontrolki sekcji App Style

- **Custom Mouse Pointer** (własny wskaźnik myszy, domyślnie włączony) wyświetla kursor aplikacji Marinara Engine w kolorze akcentu. Wyłącz go, żeby korzystać z kursora systemowego albo żeby o kursorze decydował własny motyw.
- **Reduce Ambient Animations & Effects** (ograniczenie animacji i efektów otoczenia) zatrzymuje ozdobne animacje, cząsteczki otoczenia, obracające się podglądy i stopniowe odsłanianie tekstu. Marinara robi to też wtedy, gdy urządzenie prosi o ograniczenie ruchu.
- **Desktop sidebar width** (szerokość pasków bocznych na komputerze) ustawia szerokość obu pasków bocznych na komputerze. Przycisk **Reset width** (przywrócenie szerokości) ją przywraca. Telefony zachowują swój układ.

### Chat widget style

Na dole sekcji **App Style** wybierz **Default** (domyślny), **Dottore** lub **Prof. Mari** dla przesuwanych przycisków, okien i sekcji czatu. Czcionkę, kształt i trzy główne kolory można zmieniać osobno, a trzy przełączniki **Apply preset** (zastosowanie presetu) przenoszą styl na wiadomości, pola wpisywania i kontrolki czatu. **Button size (px)** (rozmiar przycisków w pikselach) zmienia rozmiar przesuwanych przycisków czatu i ich ikon bez zmiany ustawienia **Display Size** (rozmiar wyświetlania). Wpisz wartość od 32 do 96 albo zostaw pole puste, żeby użyć rozmiaru domyślnego. Wszystkie kontrolki opisuje przewodnik [Własne motywy CSS](custom-css-themes.md#ready-made-chat-window-styles).

### Display Size i Chat Font Size

W sekcji **Text & Scale**:

- **Display Size** ustawia bazowy rozmiar tekstu dla całej aplikacji na tym urządzeniu. Zmiana działa od razu. Wybierz jedną z tych opcji:

| Opcja | Rozmiar |
| --- | --- |
| **Tiny** | 12 px |
| **Small** | 14 px |
| **Medium** | 16 px |
| **Default** | 17 px |
| **Large** | 19 px |
| **Huge** | 22 px |
| **Extra large** | 26 px |
| **Extra extra large** | 30 px |
| **Maximum** | 34 px |

- **Chat Font Size** (rozmiar czcionki czatu) to suwak rozmiaru tekstu wiadomości w czacie, od 12 px do 72 px. Domyślnie jest to 16 px.

W tej samej sekcji jest lista rozwijana **Font** (czcionka). Zobacz [Własne czcionki i Google Fonts](fonts.md).

### Kolory tekstu czatu i obrys

Również w sekcji **Text & Scale**:

- **Chat Text Color** (kolor tekstu czatu) to główny kolor tekstu wiadomości. Domyślnie jest to `#d4d4d4` w trybie Dark i `#1a1025` w trybie Light.
- **Default Dialogue Color** (domyślny kolor dialogów) koloruje wypowiedzi w cudzysłowie, gdy postać lub persona nie ma własnego koloru Dialogue Highlight Color. Kolory z karty mają pierwszeństwo. Gdy przełącznik **Apply preset colors** (zastosowanie kolorów presetu) jest włączony, wypowiedzi przyjmują kolor tekstu ze stylu czatu.
- **Chat Chrome Text Color** ustawia tekst kontrolek wokół czatu: widgetów trackerów, etykiet folderów i opisów ustawień. Ma te same wartości domyślne co **Chat Text Color**.
- **Text Outline / Stroke** (obrys tekstu) dodaje obwódkę, dzięki której tekst pozostaje czytelny na niespokojnym tle. Ustaw kolor i szerokość **Width** od 0 do 5 px. Domyślnie jest to 0,5 px, a 0 wyłącza obrys.

Wyczyszczenie pola koloru przywraca wartość domyślną schematu.

### Sekcja Atmosphere

Przełącznik **Dynamic weather effects (rain, snow, fog, etc.)** jest domyślnie włączony. Pokazuje cząsteczki pogodowe zgodnie z pogodą i porą dnia w historii. Daje widoczny efekt tylko wtedy, gdy dla czatu włączony jest agent **World State**. Zobacz [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md).

### Sekcja Backgrounds

Sekcja **Backgrounds** (tła) zawiera selektor **Chat Background** (tło czatu) i **Background Blur** (rozmycie tła). Są tu też dwie inne kontrolki. **Conversation background image opacity** (nieprzezroczystość obrazu tła w trybie Conversation) ustawia, jak mocno widać tło czatu w trybie Conversation; gradient nadal pozostaje widoczny. **Chat List Backgrounds** (tła na liście czatów) pokazuje tło każdego czatu jako przygaszony baner za jego wierszem na liście czatów. Wybierz **Active & Hovered** (aktywny i wskazany kursorem), **Every Row** (każdy wiersz) albo **Off** (wyłączone). Zobacz [Tła czatu](chat-backgrounds.md).

## Przycisk Conversation

- **Chat Layout** (układ czatu, w sekcji **Conversation Display**) zmienia wygląd wiadomości w trybie Conversation i pokazuje podgląd na żywo. **Linear** (domyślnie) wyświetla wiersze w stylu czatu. **Bubbles** wyświetla dymki w stylu komunikatora.
- **Avatar Shape** (kształt awatara) to **Circular** (okrągły) albo **Square** (kwadratowy). Rozmiar awatara się nie zmienia.
- **Always display swipe menu** (stałe wyświetlanie menu swipe'ów) pokazuje strzałki swipe'ów i licznik od pierwszej odpowiedzi. Wyłącz to ustawienie, żeby pojawiały się dopiero po ponownym wygenerowaniu.
- **Conversation Theme** (motyw trybu Conversation) ustawia dwukolorowy gradient za każdym czatem w trybie Conversation. Zakładki **Dark** i **Light** mają każda własny gradient. To ustawienie domyślne dla całego urządzenia, a nie dla pojedynczego czatu.

## Przycisk Roleplay

Sekcja **Tracker Panel** odpowiada za styl bocznego panelu trackerów w trybie Roleplay. Zobacz [Pasek HUD i trackery w trybie Roleplay](../roleplay/hud-and-trackers.md).

Sekcja **Roleplay Presentation** (prezentacja trybu Roleplay) odpowiada za styl wiadomości w trybie Roleplay.

| Ustawienie | Do czego służy | Domyślnie |
| --- | --- | --- |
| **Chat position** | Gdzie na szerokim ekranie stoją wiadomości i pole wpisywania: **Left**, **Center** lub **Right**. Otwarty pasek boczny lub Tracker Panel po tej samej stronie odsuwa je na bok. Na telefonie czat zajmuje całą szerokość. | **Center** |
| **Visual Novel display** (widok visual novel) | Pokazuje po jednym gotowym akapicie naraz, z portretem dialogowym i twoimi sprite'ami. Zmienia bieżący czat w trybie Roleplay oraz ustawienie domyślne dla czatów bez zapisanego stylu. | Wyłączone |
| **Roleplay Messages Background Opacity** | Suwak od 0% do 100%. Zmniejsz wartość, żeby tło prześwitywało przez dymki wiadomości. | 90% |
| **Roleplay Avatars** | Styl awatara przy każdej wiadomości: **None**, **Small Circles**, **Small Rectangles** albo **Glued Side Panel**. | **Small Circles** |
| **Scrollable Avatars** | Utrzymuje awatary na widoku podczas przewijania długiej wiadomości. | Wyłączone |
| **Message avatar scale** | Suwak od 75% do 250%. | 100% |
| **Default sprite scale** | Suwak od 50% do 175%. Rozmiar sprite'ów ustawiony dla czatu nadal ma pierwszeństwo. | 100% |

W tej sekcji są też **Custom chat width** (własna szerokość czatu), **Always display swipe menu**, **Reduced paint effects** (ograniczone efekty rysowania, czyli spłaszczenie kosztownej przezroczystości i cieni, żeby nawigacja pozostała płynna), **Show Thinking In Messages** (pokazywanie myślenia w wiadomościach), **Don't Collapse Thinking** (bez zwijania myślenia) i **Narrator's Cycling Avatars** (zmieniające się awatary narratora). Przy włączonym **Visual Novel display** pojawiają się też **Auto-play VN paragraphs** (automatyczne odtwarzanie akapitów VN) z ustawieniem **Paragraph delay** (opóźnienie akapitu), **Dialogue portrait scale** i **Full-body sprite scale**.

## Przycisk Game

W sekcji **Game Presentation** grupa **Game VN Art** (grafika VN w trybie Game) ma dwa suwaki: **Dialogue portrait scale** (od 75% do 175%, domyślnie 100%) i **Full-body sprite scale** (od 75% do 275%, domyślnie 135%).

**Game Dialogue Display** decyduje o zachowaniu pola dialogowego.

- **Classic Dialogue Box** (klasyczne pole dialogowe, domyślnie) pokazuje jeden aktywny fragment. Wcześniejsze linijki są dostępne pod przyciskiem **Logs** (dziennik).
- **History Above Dialogue Box** (historia nad polem dialogowym) pokazuje wcześniejsze fragmenty nad polem, a cała sesja pozostaje tam do przewijania.

Przełącznik **Game text effects** (efekty tekstu w trybie Game, domyślnie włączony) animuje dramatyczne słowa, wyróżnienia pisane WIELKIMI LITERAMI, wtrącenia w nawiasach i tagi efektów tekstowych. Wyłącz go, żeby wyświetlać zwykły tekst.

## Ustawienia, które zostają na tym urządzeniu

Większość ustawień wyglądu synchronizuje się z pozostałymi urządzeniami. **Display Size** i **Chat Font Size** nie. Zapisują się w przeglądarce, której używasz. Co się synchronizuje, opisuje [Przegląd ustawień](../settings/settings-overview.md).

## Powiązane przewodniki

- [Własne czcionki i Google Fonts](fonts.md)
- [Tła czatu](chat-backgrounds.md)
- [Własne motywy CSS (Theme Library)](custom-css-themes.md)
- [Przewodnik po stylowaniu kart w CSS](card-css-theming.md)
- [Przegląd ustawień](../settings/settings-overview.md)
