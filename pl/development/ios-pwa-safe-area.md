# Dolna strefa bezpieczna w PWA na iOS (dla programistów)

Ten przewodnik dla programistów wyjaśnia, skąd bierze się kolorowy pasek na dole ekranu. Pojawia się wtedy, gdy Marinara Engine działa jako aplikacja z ekranu początkowego iPhone'a. Znajdziesz tu opis poprawki, którą wprowadza Marinara, kompromisu, jaki ta poprawka wymusza, oraz sposobu na zdiagnozowanie paska, gdyby wrócił po kolejnej zmianie.

PWA (Progressive Web App) to strona internetowa, którą użytkownik instaluje na ekranie początkowym i otwiera jak zwykłą aplikację. To materiał na poziomie kodu, przeznaczony dla współtwórców, a nie przewodnik dla użytkownika.

## Problem

W iPhone'ach z paskiem gestu ekranu początkowego (modele z Face ID) dół ekranu jest zarezerwowaną strefą bezpieczną na gest powrotu. iOS traktuje ją jako pas o wysokości mniej więcej 34px. Odpowiada to wartości zmiennej CSS `env(safe-area-inset-bottom)`.

Kiedy styl paska stanu PWA ustawiono na `black-translucent`, iOS nie pozwala żadnemu elementowi `position: fixed` rysować w tej strefie. Każda sztuczka w CSS zawodzi. WebKit przycina ujemne odsunięcia od dołu, `calc(100dvh + env(safe-area-inset-bottom))` oraz ujemne nadpisania wysokości.

Efektem jest widoczny pasek pod polem wpisywania wiadomości. Ten pasek, nazywany często "podbródkiem", ma inny kolor niż reszta interfejsu.

## Poprawka, którą wprowadzamy

Marinara ustawia styl paska stanu na `black` zamiast `black-translucent`. Znacznik meta znajduje się w `packages/client/index.html`.

```html
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
```

Znacznik viewport zachowuje `viewport-fit=cover` i domyślne zachowanie klawiatury.

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

W trybie `black` iOS nie blokuje dolnej strefy. Powłoka aplikacji korzysta z `fixed inset-0` bez nadpisywania wysokości viewportu, więc rysuje się aż do samego dołu, w głąb strefy bezpiecznej. Wartość className powłoki w `packages/client/src/components/layout/AppShell.tsx` wygląda tak:

```
mari-app mari-app-background-paint fixed inset-0 flex overflow-hidden
```

Nie dodawaj `interactive-widget=resizes-content` do znacznika viewport. W aplikacjach PWA na urządzeniach mobilnych może to zmieniać rozmiar całej powłoki czatu w trakcie animacji klawiatury i przycinać przewijanie wiadomości.

## Kompromis

Nie da się mieć jednocześnie szklanego paska stanu i wypełnionego dołu ekranu. W trybie `black` pasek stanu jest jednolicie ciemny. Tryb `black-translucent` daje ładniejszą, przezroczystą górę, ale przez niego dolnego paska nie da się usunąć. To twarde ograniczenie systemu iOS.

<a id="landscape-the-cameras-side-insets"></a>

## Poziomy ekran: boczne marginesy kamery

Po obróceniu iPhone'a poziomo jego kamera (notch lub Dynamic Island) znajduje się przy lewej albo prawej krawędzi. Przy `viewport-fit=cover` strona rozciąga się pod nią, a iOS zgłasza tę przestrzeń jako `env(safe-area-inset-left)` i `env(safe-area-inset-right)`. W modelach z Dynamic Island to około 59px po każdej stronie, niezależnie od kierunku obrotu telefonu. Aplikacja Marinara na Androida (docelowy SDK 34, bez trybu od krawędzi do krawędzi) omija wycięcie kamery, więc oba marginesy wynoszą tam 0. Inne przeglądarki na Androidzie mogą zgłaszać niezerowe wartości, np. w trybie pełnoekranowym lub od krawędzi do krawędzi; te same zmienne je obsługują.

Aplikacja Marinara omija tę przestrzeń tak jak pas paska stanu przy pionowym ekranie:

- `packages/client/src/styles/globals.css` odczytuje oba marginesy raz, do `--mari-safe-area-inset-left` i `--mari-safe-area-inset-right` w `:root`. Wszystko inne odczytuje te zmienne, nigdy bezpośrednio `env()`. Pilnuje tego `scripts/regressions/mobile-safe-area-inset.regression.ts`. Okna dialogowe, omnibar, pełnoekranowe edytory i kontrolki TopBar zachowują tę ochronę przed kamerą i zaokrąglonymi rogami.
- Na iPhonie `AppShell.tsx` rozpoznaje stronę kamery z `window.orientation` (lub `screen.orientation.angle`, gdy pierwsze API jest niedostępne). Przy 90° kamera jest po lewej, a przy −90°/270° po prawej. Atrybut `data-mari-camera-side` na `<html>` pozwala CSS wyzerować tylko przeciwny margines **powłoki**: `--mari-shell-inset-left` lub `--mari-shell-inset-right`. Przy nieznanym obrocie oraz na iPadzie i Androidzie pozostają marginesy systemowe.
- W powłoce telefonu `.mari-app` pobiera `left` i `right` ze zmiennych powłoki. Nad kamerą widać tło strony z elementu body w tym samym kolorze co pas paska stanu przy pionowym ekranie, bez lustrzanego pustego marginesu po drugiej stronie.
- Elementy o stałym położeniu w powłoce są pozycjonowane względem ekranu, nie powłoki, więc same omijają tę przestrzeń. Arkusze telefonu i ich tła w `AppShell.tsx` używają `MOBILE_SHELL_PANEL_X_CLASS` ze zmiennymi powłoki. Dekoracje, takie jak gwiazdy powłoki, mają `absolute`, więc pozostają w jej obrębie.

Aby sprawdzić to bez telefonu, otwórz dotykowy obszar widoku 874×402 i ustaw obie zmienne na `59px` w regule `:root` arkusza stylów (style wpisane bezpośrednio w atrybucie nadpisują selektor strony kamery). W Chromium możesz też emulować rzeczywiste marginesy poleceniem DevTools Protocol `Emulation.setSafeAreaInsetsOverride`. `e2e/phone-camera-side.e2e.ts` sprawdza oba kierunki obrotu, starsze i nowsze API orientacji, nieznane obroty oraz inne urządzenia. Test e2e "a phone turned sideways keeps the app out from under its camera" sprawdza wariant awaryjny zachowujący oba marginesy.

## Jak to zdiagnozowano

Pasek namierzono, kolorując kolejne warstwy i otwierając aplikację od nowa. Wstaw style diagnostyczne do `packages/client/dist/index.html`, wewnątrz osadzonego bloku `<style>`. Tego pliku nie zapisuje w pamięci podręcznej service worker, więc zawsze trafia do urządzenia w świeżej wersji. Zmiany widać po ponownym otwarciu, bez czyszczenia pamięci podręcznej.

```
html, body { background-color: #ff0000 !important; }
.mari-chat-input-box { background-color: #00ff00 !important; }
.mari-app { background: #0000ff !important; }
```

Wynik czyta się tak:

- Czerwony podbródek oznacza, że rysuje tam płótno html. W trybie `black-translucent` żaden element fixed go nie zasłoni.
- Niebieski podbródek oznacza, że pudełko powłoki aplikacji sięga dołu. To stan prawidłowy.
- Zielony podbródek oznacza, że samo pole wpisywania wiadomości wypełnia obszar aż do krawędzi.

## Jeśli aktualizacja to zepsuje

### Objaw: pasek podbródka wraca pod polem wpisywania wiadomości

Sprawdzenie 1. Potwierdź, że `apple-mobile-web-app-status-bar-style` nadal ma wartość `black` w `packages/client/index.html`. Jeśli ktoś przywrócił `black-translucent`, ustaw z powrotem `black`.

Sprawdzenie 2. Potwierdź, że className komponentu AppShell w `packages/client/src/components/layout/AppShell.tsx` nadal brzmi `mari-app mari-app-background-paint fixed inset-0 flex overflow-hidden`. Nie łącz `inset-0` z `h-screen`, `h-dvh` ani `max-h-screen`. Zbyt mocno ogranicza to powłokę fixed i pozwala klawiaturze mobilnej przesuwać interfejs.

Sprawdzenie 3. Uruchom powyższą diagnostykę kolorami, żeby zobaczyć, która warstwa rysuje podbródek. Wymuś zamknięcie aplikacji i otwórz ją ponownie. Czyszczenie pamięci podręcznej nie jest potrzebne, bo `dist/index.html` nie trafia do niej z wyprzedzeniem.

- Czerwony podbródek przy niebieskiej powłoce w pozostałych miejscach oznacza, że pudełko powłoki nie sięga dołu. Potwierdź, że styl paska stanu to `black`.
- Podbródek wciąż czerwony przy niebieskiej powłoce oznacza, że powłoka nie przykrywa dołu. Potwierdź, że `fixed inset-0` pozostaje nienaruszone.
- Niebieski podbródek oznacza, że powłoka przykrywa dół, ale pole wpisywania wiadomości nie wypełnia go do końca. Sprawdź opisany niżej odstęp wewnętrzny opakowania pola.

### Objaw: pole wpisywania wiadomości przylega do krawędzi ekranu

Trzy komponenty pola wpisywania wiadomości potrzebują `pb-3` na zewnętrznym opakowaniu, żeby zachować naturalny odstęp, a nie `pb-0`.

- `packages/client/src/components/chat/ChatInput.tsx`: opakowanie brzmi `mari-chat-input chat-input-container px-3 pb-3`.
- `packages/client/src/components/chat/ConversationInput.tsx`: opakowanie brzmi `mari-chat-input chat-input-container relative px-2 sm:px-3 pb-3`.
- `packages/client/src/components/game/GameInput.tsx`: opakowanie brzmi `px-3 pt-2 pb-3`.

## Ponowna kompilacja

Serwer udostępnia skompilowanego klienta z `packages/client/dist`, więc każda zmiana w źródłach wymaga ponownej kompilacji.

```
pnpm build:client
```

Potem wyczyść dane witryny na urządzeniu i otwórz aplikację PWA jeszcze raz. Na telefonie otwórz **Settings** (Ustawienia), następnie **Safari**, dalej **Advanced** (Zaawansowane) i **Website Data** (dane witryn). Service worker zapisuje pliki JS i CSS w pamięci podręcznej według skrótu treści, więc po zmianie skrótu trzeba wyczyścić dane witryny, aby wczytały się nowe fragmenty.

Pliku `dist/index.html` nie zapisuje w pamięci podręcznej service worker, więc zawsze trafia do urządzenia w świeżej wersji. Wykorzystaj to do szybkiego wstawiania stylów diagnostycznych bez pełnej kompilacji.

## Najważniejsze fakty

- `black-translucent` daje przezroczysty pasek stanu, ale blokuje dolną strefę bezpieczną. Nie istnieje żadna sztuczka w CSS, która to obejdzie.
- `black` albo `default` daje jednolity pasek stanu i pozwala elementom fixed sięgnąć dolnej strefy bezpiecznej.
- `env(safe-area-inset-bottom)` to około 34px w iPhone'ach z Face ID. Używaj tej wartości, gdy trzeba odsunąć interaktywną treść znad paska gestu ekranu początkowego.
- W trybie `black-translucent` jednostki viewportu `dvh` i `lvh` odpowiadają wysokości bezpiecznego obszaru treści, a nie fizycznej wysokości ekranu. Nie rozciągaj nimi powłoki poza tę granicę.
- `interactive-widget=resizes-content` może powodować zmianę rozmiaru powłoki czatu fixed w trakcie otwierania klawiatury. Lepiej zostawić domyślne zachowanie viewportu.

## Powiązane przewodniki

- [Architektura frontendu (dla programistów)](frontend.md)
- [Przewodnik po PWA na iOS / iPadOS](../installation/ios-pwa.md)
