# Rozszerzenia osobiste

Rozszerzenie osobiste to niewielki fragment kodu, który dodaje do aplikacji Marinara Engine przycisk, panel albo narzędzie pomocnicze. Professor Mari może je dla ciebie napisać, a ty decydujesz, czy w ogóle zostanie uruchomione. Ten przewodnik opisuje przeglądanie, włączanie, eksportowanie i odzyskiwanie rozszerzeń. Jeśli chcesz napisać własne, zobacz [Pisanie własnych rozszerzeń](writing-personal-extensions.md).

## Rodzaje rozszerzeń

| Nazwa | Co to jest |
| --- | --- |
| Personal Extension (rozszerzenie osobiste) | Rozszerzenie napisane dla ciebie przez Professor Mari. Pojawia się jako szkic w **Settings → Addons** (ustawienia, dodatki). |
| External Extension (rozszerzenie zewnętrzne) | Rozszerzenie od kogoś innego albo napisane przez ciebie. Wymaga dodatkowych kroków z sekcji [Zezwolenie na import rozszerzeń od osób trzecich](#allow-third-party-imports). |
| Browser Extension (rozszerzenie przeglądarkowe) | Działa wewnątrz twojej przeglądarki, w piaskownicy. Domyślnie bezpieczne. |
| Server Extension (rozszerzenie serwerowe) | Działa na komputerze, na którym uruchomiona jest aplikacja Marinara Engine, w piaskownicy systemu operacyjnego. Wymaga obsługiwanej platformy. |
| Full page access (pełny dostęp do strony) | Uprawnienie, które usuwa piaskownicę. Tylko dla kodu, któremu w pełni ufasz. |

## Instalowanie rozszerzenia udostępnionego przez inną osobę

Zanim zaczniesz: wykonaj dwa kroki z sekcji [Zezwolenie na import rozszerzeń od osób trzecich](#allow-third-party-imports). Bez nich przyciski importu są ukryte.

1. Otwórz **Settings → Addons**. W sekcji **External Extensions** (rozszerzenia zewnętrzne) wybierz **Import Extension File** (import pliku rozszerzenia) dla pliku `.zip`, `.json`, `.css` lub `.js` albo **Import Extension Folder** (import folderu rozszerzenia) dla folderu.
2. Otwórz nowy szkic. Jest wyłączony i pokazuje swój kod oraz skrót (hash), czyli krótki odcisk dokładnie tego kodu (Marinara używa algorytmu SHA-256).
3. Przeczytaj kod i listę **Requested access** (żądany zakres dostępu).
4. Wybierz **Review and Run** (przegląd i uruchomienie) tylko wtedy, gdy akceptujesz dokładnie tę wersję. Rozszerzenie jest wtedy widoczne jako włączone.

Jeśli to nie zadziałało: gdy brakuje przycisków importu, jeden z dwóch kroków nie został wykonany. Pamiętaj, żeby po zmianie pliku `.env` uruchomić aplikację Marinara Engine ponownie.

## Przegląd rozszerzenia od Professor Mari

Zanim zaczniesz: poproś [Professor Mari](../home/professor-mari.md) o utworzenie rozszerzenia. Asystentka może zapisać kod, ale nie może go zatwierdzić ani włączyć. W tej sekcji nie ma przycisku New Draft ani kontrolki importu.

1. Otwórz **Settings → Addons → Personal Extensions** (ustawienia, dodatki, rozszerzenia osobiste). Gdy nie ma żadnych szkiców, widać komunikat: "Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash."
2. Otwórz szkic i przeczytaj kod. Sprawdź skrót i listę **Requested access**.
3. Wybierz **Review and Run** tylko wtedy, gdy akceptujesz dokładnie tę wersję.

Każdy szkic jest na początku wyłączony. Każda zmiana kodu, zmiana uprawnień albo przywrócona wersja wyłącza rozszerzenie i wymaga ponownego zatwierdzenia.

> **Ostrzeżenie:** Piaskownica ogranicza to, co kod może zrobić, ale nie sprawia, że kod staje się godny zaufania. Szkodliwe rozszerzenie wciąż może marnować czas procesora, dopóki nie zatrzyma go strażnik (licznik czasu, który przerywa kod działający bez końca), zapełnić własną przestrzeń danych aż do limitu albo wprowadzać cię w błąd przez logi. Rozszerzenia z pełnym dostępem do strony celowo rezygnują z piaskownicy. Przeczytaj kod, zanim włączysz rozszerzenie, i przejrzyj każdą linijkę cudzego kodu.

Jeśli to nie zadziałało: zmiany wprowadzone przez Professor Mari i każda przywrócona wersja z powrotem wyłączają szkic. Przejrzyj go ponownie i sprawdź, czy skrót w oknie to ten sam, który odczytano wcześniej.

## Co potrafi rozszerzenie

Rozszerzenie przeglądarkowe działa w piaskownicy (odgrodzonym obszarze) wewnątrz twojej przeglądarki. Nie ma dostępu do strony aplikacji Marinara Engine, ciasteczek, pamięci przeglądarki ani sieci. Może:

- przechowywać prywatne dane i zapisywać logi
- dodawać przyciski, pozycje menu i panele, które Marinara rysuje w twoim motywie
- odczytywać identyfikatory otwartego czatu
- odczytywać wybrane pola aktywnych postaci albo persony, tylko gdy zatwierdzisz te uprawnienia

Pełna lista jest w przewodniku [Pisanie własnych rozszerzeń](writing-personal-extensions.md#what-a-browser-extension-can-do).

Rozszerzenie serwerowe działa w osobnym procesie Node (programie na komputerze z serwerem) wewnątrz piaskownicy systemu operacyjnego. Nie ma dostępu do plików aplikacji Marinara Engine, twoich plików, sekretów serwera, sieci, procesów potomnych, wątków roboczych ani modułów natywnych.

<a id="platform-support"></a>

### Obsługiwane platformy

Rozszerzenia przeglądarkowe zamyka w piaskownicy sama przeglądarka, więc działają wszędzie. Rozszerzenia serwerowe wymagają obsługiwanej piaskownicy systemu operacyjnego. Tam, gdzie jej nie ma, pozostają wyłączone, a Marinara nigdy nie uruchamia ich bez niej.

| Platforma | Rozszerzenia serwerowe |
| --- | --- |
| macOS | W piaskownicy Seatbelt, czyli piaskownicy systemu macOS |
| Linux z Bubblewrap | W piaskownicy Bubblewrap, narzędzia do tworzenia piaskownic w systemie Linux |
| Linux bez `bwrap` | Wyłączone: zainstaluj `bwrap` |
| Docker (domyślnie) | Wyłączone: uprawnienia kontenera |
| Windows | Wyłączone: użyj rozszerzenia przeglądarkowego |
| Android | Wyłączone: użyj rozszerzenia przeglądarkowego |

Rozszerzenia przeglądarkowe działają w piaskownicy na każdej platformie. Rozszerzenia zewnętrzne z pełnym dostępem do strony nie mają piaskownicy na żadnej platformie i zawsze wymagają twojego wyraźnego zaufania.

Oficjalny obraz Docker zawiera Bubblewrap, ale jego domyślny kontener nie może tworzyć zagnieżdżonych przestrzeni nazw i montowań, których potrzebuje Bubblewrap. Marinara sprawdza piaskownicę podczas działania i pozostawia rozszerzenia serwerowe wyłączone, gdy kontener na nią nie pozwala. Opis nadpisania uprawnień kontenera Docker i związanego z tym kompromisu w zakresie bezpieczeństwa znajdziesz w przewodniku [Rozwiązywanie problemów](../TROUBLESHOOTING.md#a-server-extension-says-no-supported-sandbox-is-available).

W systemach Windows i Android nie ma obsługiwanej piaskownicy procesów, więc rozszerzenia serwerowe są niedostępne. Użyj rozszerzenia przeglądarkowego albo uruchom serwer Marinara Engine w systemie macOS lub Linux z `bwrap`.

<a id="allow-third-party-imports"></a>

## Zezwolenie na import rozszerzeń od osób trzecich

Import rozszerzeń od osób trzecich jest domyślnie zablokowany i ukryty, ponieważ uruchamia kod napisany przez inne osoby. Odblokowują go dwa kroki:

1. Na komputerze, na którym działa aplikacja Marinara Engine, ustaw `ENABLE_EXTERNAL_EXTENSIONS=true` w pliku `.env`, a potem uruchom aplikację Marinara Engine ponownie. Zobacz przewodnik [Konfiguracja serwera](../CONFIGURATION.md).
2. Otwórz **Settings → Advanced → Danger Zone** (ustawienia, zaawansowane, strefa zagrożenia), przewiń poniżej kontrolek usuwania danych, przeczytaj ostrzeżenie i włącz **Allow third-party extension imports** (zezwolenie na import rozszerzeń od osób trzecich).

Wtedy w **Settings → Addons** pojawia się sekcja **External Extensions** z kontrolkami importu plików i folderów. Obsługiwane formaty:

- `.personal-extension.zip` oraz zgodne paczki `.zip`
- manifesty `.json`
- `.css`
- `.js`, `.mjs` i `.cjs`
- `.server.js`, `.server.mjs` i `.server.cjs`

Importy nigdy nie przenoszą zatwierdzenia i nie mogą same się włączyć. Większość rozszerzeń przeglądarkowych powinna pozostać w bezpiecznej piaskownicy. Paczka oznaczona jako **Full page access** to co innego:

- Jej kod działa na stronie aplikacji Marinara Engine, bez piaskownicy.
- Może odczytywać czaty i karty, korzystać z pamięci przeglądarki, wysyłać żądania sieciowe i wywoływać własne interfejsy API aplikacji Marinara Engine.
- Włącz ją dopiero po sprawdzeniu dokładnie tej wersji i tylko wtedy, gdy jej ufasz.
- Szkice od Professor Mari nie mogą prosić o taki dostęp.

Wpisy starsze, zaimportowane z profilu, zapisane ręcznie oraz te o nieznanym pochodzeniu również są traktowane jako zewnętrzne. Pozostają ukryte, nie da się ich zatwierdzić i nie działają, dopóki oba kroki nie zostaną wykonane.

Cofnięcie któregokolwiek z tych kroków wyłącza wszystkie zaimportowane rozszerzenia. Ponowne włączenie nie uruchamia ich znowu. Jeśli rozszerzenie z pełnym dostępem do strony zostawiło po sobie zmiany, odśwież stronę.

Jeśli to nie zadziałało: gdy kontrolki importu się nie pojawiają, sprawdź, czy oba kroki są wykonane i czy korzystasz z komputera z serwerem albo masz zapisany sekret administratora w **Settings → Advanced → Admin Access** (ustawienia, zaawansowane, dostęp administracyjny).

## Eksport, wersje i odzyskiwanie

Użyj akcji eksportu rozszerzenia, aby pobrać przenośną paczkę. Paczki wyeksportowane i przywrócone pozostają wyłączone. Przywrócenie wcześniejszej wersji też zamienia rozszerzenie z powrotem w wyłączony szkic.

**Settings → Addons → Extension revision history** (ustawienia, dodatki, historia wersji rozszerzeń) określa, ile poprzednich wersji kodu jest przechowywanych dla każdego rozszerzenia osobistego i zewnętrznego. Domyślna wartość to **10**. Wybierz od **0** do **10**, przy czym **0** wyłącza historię. Przy zmniejszeniu limitu aplikacja prosi o potwierdzenie, zanim trwale usunie starsze wersje. Bieżący kod, zatwierdzenia, stan włączenia i zapisane dane rozszerzeń zostają zachowane. Zmiany wprowadzane przez Professor Mari podlegają temu samemu limitowi.

Jeśli rozszerzenie zachowuje się nieprawidłowo, wybierz **Disable** (wyłączenie). Jeśli interfejs jest niedostępny, zatrzymaj aplikację Marinara Engine i ustaw wartość `enabled` we właściwym wpisie `installed_extensions` na `"false"`. Nigdy nie ustawiaj `approvedHash` ręcznie.

## Powiązane przewodniki

- [Pisanie własnych rozszerzeń](writing-personal-extensions.md)
- [Professor Mari](../home/professor-mari.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
- [Kopia zapasowa i przywracanie](../data/backup-and-restore.md)
- [Dostęp zdalny](../REMOTE_ACCESS.md)
