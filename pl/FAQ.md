# Najczęściej zadawane pytania

Ten przewodnik odpowiada na pytania, które najczęściej padają o aplikację Marinara Engine. Odpowiedzi są pogrupowane tematycznie. Każda z nich prowadzi do pełnego przewodnika, jeśli potrzeba więcej szczegółów.

## Jak otworzyć aplikację Marinara Engine na telefonie lub innym urządzeniu?

Marinara Engine działa jako lokalny serwer na jednym komputerze. Otwiera się go w przeglądarce internetowej. Ta odpowiedź dotyczy dostępu z telefonu, tabletu albo innego komputera w tej samej sieci.

Skrypty startowe (`start.sh`, `start.bat` i `start-termux.sh`) od razu udostępniają serwer na wszystkich interfejsach sieciowych (`0.0.0.0`). Inne urządzenia mogą się z nim połączyć przez sieć, ale kontrola dostępu domyślnie je blokuje. Dopóki dostęp nie zostanie skonfigurowany na komputerze-hoście, zdalne urządzenie widzi tylko stronę **Access blocked** (dostęp zablokowany) z instrukcją konfiguracji.

Wykonaj kolejno te kroki:

1. Zostaw aplikację Marinara Engine uruchomioną na komputerze-hoście.
2. Na komputerze-hoście skonfiguruj kontrolę dostępu: Basic Auth (nazwa użytkownika i hasło) albo listę dozwolonych adresów IP (spis adresów zaufanych urządzeń). Przewodnik [Dostęp zdalny](REMOTE_ACCESS.md) omawia każdą z opcji, łącznie z obejściem dla w pełni zaufanych sieci prywatnych.
3. Sprawdź lokalny adres IP komputera-hosta. W systemie Windows uruchom to polecenie i odczytaj wartość **IPv4 Address**:

```
ipconfig
```

W systemie macOS lub Linux uruchom to polecenie:

```
hostname -I
```

4. Na drugim urządzeniu otwórz przeglądarkę internetową i wpisz adres IP hosta wraz z numerem portu. Domyślny port to `7860`:

```
http://192.168.1.42:7860
```

Zamiast `192.168.1.42` wpisz własny adres IP hosta.

5. Zaloguj się, jeśli przeglądarka poprosi o nazwę użytkownika i hasło Basic Auth. Jeśli zamiast tego pojawia się strona **Access blocked**, dokończ najpierw krok 2 na komputerze-hoście.

W zwykłych instalacjach komputerowych hasło nie jest potrzebne na tym samym komputerze (`127.0.0.1`). Instalacje w systemie Android zarządzane przez plik APK dodają prywatne logowanie na localhost, żeby inna aplikacja w systemie Android nie mogła podszyć się pod Marinara Engine, ale nakładka na system Android automatycznie tworzy i używa tego poświadczenia. Inne urządzenia pozostają zablokowane, dopóki nie skonfigurujesz kontroli dostępu (Basic Auth albo lista dozwolonych adresów IP). Każdą z opcji wyjaśnia przewodnik [Dostęp zdalny](REMOTE_ACCESS.md).

Jeśli urządzenia są w różnych sieciach, pomoże narzędzie takie jak Tailscale. Tailscale nadaje każdemu urządzeniu stały adres prywatny. Dzięki temu da się połączyć z dowolnego miejsca bez wystawiania aplikacji Marinara Engine do publicznego internetu. Jeśli połączenie się nie udaje, zajrzyj do przewodnika [Rozwiązywanie problemów](TROUBLESHOOTING.md).

## Czy jest aplikacja mobilna Marinara?

Osobnej, natywnej aplikacji mobilnej nie ma. Na telefonie i tablecie korzysta się z tej samej aplikacji internetowej w przeglądarce. Większość przeglądarek mobilnych oferuje opcję **Add to Home Screen** (dodanie do ekranu głównego) albo **Install App** (instalacja aplikacji), dzięki czemu całość wygląda jak prawdziwa aplikacja, bez paska przeglądarki. Nazywa się to PWA (Progressive Web App, czyli strona internetowa, którą da się zainstalować jak aplikację).

W systemie Android można też [pobrać bezpośrednio najnowszy plik APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). Marinara Engine działa wtedy lokalnie na telefonie przez Termux. Instalacja nie wymaga klucza podpisu, hasła ani sekretu dostępu lokalnego; systemowe pytania o uprawnienia opisuje [Przewodnik instalacji na Android (Termux)](installation/android-termux.md). Na urządzeniach iPhone i iPad zajrzyj do przewodnika [PWA na iOS](installation/ios-pwa.md).

Nakładka na system Android loguje się automatycznie przy otwieraniu zarządzanego przez plik APK serwera w środowisku Termux. Prywatne poświadczenie widzą tylko użytkownicy, którzy celowo otworzą serwer w innej przeglądarce na tym telefonie: otwórz `/android-login`, wykonaj `cat ~/.marinara-engine/android-secret` w aplikacji Termux i wklej wyświetloną wartość. Lokalne narzędzie `mari` CLI automatycznie odczytuje ten sam sekret zarządzany przez program uruchamiający. Ręczne instalacje w środowisku Termux zachowują zwykłe reguły dostępu z localhost i z sieci.

## Jakie są trzy tryby czatu?

Marinara ma trzy tryby czatu, widoczne jako zakładki po otwarciu listy czatów:

- **Conversation**: czat w stylu SMS-ów albo wiadomości prywatnych, jak pisanie do postaci w komunikatorze.
- **Roleplay**: wciągająca scena fabularna z narracją, awatarami postaci i opcjonalnymi grafikami postaci.
- **Game Mode**: prowadzona przygoda tekstowa z mistrzem gry, z opcjonalnymi obrazami scen i wideo.

Każdy tryb ma własny przewodnik na start. Zacznij od trybu, który cię interesuje, a potem sięgnij po szczegółowe przewodniki.

## Jak zmienić strefę czasową harmonogramów w trybie Conversation?

Otwórz czat w trybie Conversation i wybierz opcję **Schedule timezone** (strefa czasowa harmonogramu) w panelu **Chat Settings** (ustawienia czatu). Można ją też wskazać przy tworzeniu harmonogramów w kreatorze trybu Conversation. Marinara zaczyna od strefy czasowej zgłoszonej przez urządzenie, ale da się wskazać dowolną obsługiwaną strefę IANA albo wybrać opcję **Use device**, żeby wrócić do ustawienia urządzenia. To jedno globalne ustawienie dla wszystkich czatów w trybie Conversation, w tym dla wiadomości autonomicznych po stronie serwera. Synchronizuje się też z innymi urządzeniami podłączonymi do tego samego serwera Marinara Engine.

## Czy do korzystania z aplikacji Marinara Engine potrzebny jest klucz API?

Prawie zawsze tak. **Połączenie** to zapisany skrót, który mówi aplikacji Marinara Engine, jak dotrzeć do jednej usługi AI: który dostawca, który model i jakie są dane logowania. **Klucz API** to tajny kod, trochę jak hasło. Wydaje go dostawca AI, żeby Marinara mogła w twoim imieniu rozmawiać z tym dostawcą.

Przed rozpoczęciem jakiegokolwiek czatu potrzebne jest co najmniej jedno połączenie. Żeby je utworzyć, otwórz panel **Connections** (połączenia), kliknij przycisk **New** (nowe), wybierz dostawcę, wklej klucz w pole **API Key** i wskaż model. Pełny opis krok po kroku znajdziesz w przewodniku [Łączenie z dostawcą AI](connections/connecting-to-a-provider.md).

Kilku dostawców w ogóle nie używa klucza API. Opcje subskrypcyjne (Claude, ChatGPT i Grok) logują się przez narzędzie wiersza poleceń, a wbudowany model Local Model działa na twoim komputerze bez żadnego klucza.

## Których dostawców AI obsługuje Marinara?

Marinara obsługuje wielu dostawców. Do każdego połączenia wybiera się jednego.

Do tekstu w czacie i w trybie Roleplay dostępne są: **OpenAI**, **OpenAI (ChatGPT)**, **Anthropic**, **Claude (Subscription)**, **Grok CLI (Subscription)**, **Google Gemini**, **Google Vertex AI**, **Mistral**, **Cohere**, **OpenRouter**, **NanoGPT**, **xAI / Grok** oraz **Custom (OAI-Compatible)** dla modeli lokalnych i uruchamianych samodzielnie, takich jak Ollama, LM Studio i KoboldCpp.

Do generowania obrazów dostępne są między innymi: **OpenAI (DALL-E)**, **Stability AI**, **Together AI**, **NovelAI**, **OpenRouter Images**, **xAI / Grok Imagine**, **Venice.ai**, **Atlas Cloud**, **Pollinations**, **Stable Horde**, **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **RunPod Serverless (ComfyUI)**, **Draw Things**, **NanoGPT** i **Block Entropy**.

Do generowania wideo dostępne są: **Google AI Studio**, **xAI Imagine**, **OpenRouter Video**, **Atlas Cloud**, **Seedance 2.0** oraz lokalne przepływy pracy **ComfyUI** w formacie API.

Można zapisać wiele połączeń naraz i przypisać każdemu czatowi inne. Zobacz [Łączenie z dostawcą AI](connections/connecting-to-a-provider.md).

## Czy za korzystanie z aplikacji Marinara Engine trzeba płacić?

Sama aplikacja Marinara Engine jest darmowa i działa na twoim komputerze. Płacisz tyle, ile liczy sobie wybrany dostawca AI, a stawki zależą od dostawcy i modelu.

Część opcji nic nie kosztuje na start. Generowanie obrazów przez **Pollinations** nie wymaga klucza. **Stable Horde** jest darmowe, a klucz jest opcjonalny i daje wyższy priorytet. Wbudowany **Local Model** działa na twoim komputerze bez klucza. Opcje subskrypcyjne (Claude, ChatGPT i Grok) korzystają z płatnego planu, który być może już masz, zamiast z klucza API rozliczanego za użycie.

## Czy klucze API są bezpieczne?

Tak. Marinara szyfruje każdy klucz API algorytmem AES-256, zanim zapisze go na dysku. Eksport połączeń i profilu usuwa tajne
wartości. Pełna kopia zapasowa działa inaczej: zawiera zaszyfrowane rekordy oraz, jeśli istnieje, plik klucza szyfrującego
potrzebny do ich odblokowania, więc pliki ZIP z pełną kopią zapasową trzymaj prywatnie.

Import profilu celowo pomija tajne wartości, więc po zaimportowaniu profilu trzeba wpisać każdy klucz API od nowa,
również przy użyciu funkcji **Import Profile** (import profilu) na pliku ZIP z pełną kopią zapasową. Ręczne przywrócenie całego folderu z danymi zachowuje
zaszyfrowane klucze, o ile wróci też pasujący plik klucza szyfrującego.

## Czym jest karta postaci?

**Karta postaci** to zapisany profil postaci AI: imię, awatar, osobowość, historia i powitanie. Karty tworzy się i edytuje w panelu **Character Editor** (edytor postaci). Można też importować karty zrobione w innych aplikacjach. Zobacz [Tworzenie i edycja postaci](characters/creating-and-editing-characters.md).

## Czym jest lorebook i jak używać jednego przy kilku postaciach?

**Lorebook** to zestaw wpisów z informacjami o świecie. Każdy wpis dokłada fakty do promptu tylko wtedy, gdy w czacie pojawią się jego słowa wyzwalające. Oszczędza to tokeny i pilnuje spójności świata. Jeden lorebook da się ograniczyć na trzy sposoby. Wybierz ten, który pasuje:

1. Powiąż go z postaciami albo personami. W edytorze lorebooka wypełnij pole **Linked Characters** (powiązane postacie) lub **Linked Personas** (powiązane persony). Lorebook włącza się wtedy w każdym czacie z powiązaną postacią albo z powiązaną personą. Oba pola przyjmują więcej niż jeden wpis, więc dodaj wszystkie potrzebne postacie.
2. Przypisz go do jednego czatu. Otwórz panel **Chat Settings**, znajdź sekcję **Lorebooks** i użyj przycisku **Add Lorebook** (dodanie lorebooka). Tak zrób, gdy wiedza o świecie dotyczy tylko jednego konkretnego czatu.
3. Filtruj pojedyncze wpisy według postaci. We wspólnym lorebooku każdy wpis można oznaczyć tak, żeby uruchamiał się tylko przy obecności wybranych postaci. Sprawdza się to w dużym lorebooku świata, w którym część wpisów dotyczy konkretnych postaci.

Cała funkcja jest opisana w przewodniku [Lorebooki](lorebooks/overview.md).

## Czym jest agent?

**Agent** to opcjonalny pomocnik AI, który działa w trakcie czatu i zajmuje się jedną konkretną rzeczą. Może na przykład śledzić bieżącą scenę, pilnować jakości pisania, dodawać mapy lub rozmowy albo prowadzić grę stołową w trybie Conversation. Świeża instalacja nie ma żadnych opcjonalnych agentów. Otwórz panel **Agents** (agenci), kliknij przycisk **Download Agents** (pobranie agentów), przeczytaj szczegóły pozycji i zainstaluj ją. Potem włącz zgodnych agentów osobno dla każdego czatu w panelu **Chat Settings**. Kiedy zainstalowany oficjalny pakiet ma zgodną aktualizację, Marinara pyta o zgodę przed pobraniem. Wybór **No** zostawia bieżącą wersję, a przycisk **Update** czeka w Download Agents na później. Jeśli host jest offline albo weryfikacja się nie powiedzie, zainstalowana wersja działa dalej. Katalog obsługuje też pełne usuwanie pakietów. Zobacz [Agenci](agents/agents-overview.md) i publiczne [repozytorium Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents).

## Jak skonfigurować Noodle?

Noodle to lokalna, fikcyjna sieć społecznościowa aplikacji Marinara Engine, przeznaczona dla twoich postaci. Otwórz zakładkę **Noodle** i przejdź do jej panelu **Settings** (ustawienia). Zaproś postacie albo foldery postaci, wybierz połączenie do generowania w sekcji **Refresh** (odświeżanie), a potem kliknij przycisk **Refresh now**, żeby wygenerować pierwszą aktywność. Da się też ustawić automatyczne godziny odświeżania, generowanie obrazów, losowych użytkowników i przeniesienie do twoich czatów.

Pełne przewodniki: [Noodle: wbudowana oś czasu społecznościowa](noodle/overview.md) oraz [Ustawienia Noodle i przeniesienie do czatów](noodle/settings.md).

## Dlaczego postać nie pamięta wcześniejszych wiadomości?

Modele AI mieszczą naraz ograniczoną ilość tekstu, więc w długich czatach stare wiadomości wypadają z pola widzenia. Marinara ma dwa systemy pamięci, które w tym pomagają:

- **Memory Recall** przeszukuje wcześniejsze wiadomości i po cichu dokłada do promptu najbardziej pasujące fragmenty. Włącz tę funkcję w panelu **Chat Settings** w sekcji **Memory Recall**.
- Podsumowania skracają stare wiadomości do krótkich streszczeń. Czaty w trybie Roleplay używają funkcji **Chat Summary**, a czaty w trybie Conversation – funkcji **Automatic Summarization**.

Konfigurację i szczegóły opisuje przewodnik [Memory Recall i podsumowania czatu](agents/memory.md).

## Jak utworzyć kopię zapasową danych?

Otwórz panel **Settings** (Ustawienia), przejdź na zakładkę **Advanced**, znajdź sekcję **Backup & Export** i kliknij przycisk **Download Backup** (pobranie kopii zapasowej). Marinara zapisuje wtedy jedno archiwum `.zip` z twoimi danymi i wgranymi plikami. Żeby je później przywrócić, użyj funkcji **Import Profile (JSON/ZIP)** w panelu **Settings** na zakładce **Imports** i wskaż ten sam plik `.zip`.

W tej samej sekcji można też włączyć automatyczną kopię zapasową z rotacją: dzienną, tygodniową albo miesięczną. Pliki ZIP z pełną kopią zapasową mogą
zawierać zaszyfrowane rekordy i plik klucza potrzebny do ich odblokowania, więc trzymaj je prywatnie. Funkcja **Import Profile** nadal
zostawia sekrety dostawców puste, więc po imporcie wpisz klucze od nowa. Pełny przewodnik:
[Kopia zapasowa i przywracanie danych aplikacji Marinara](data/backup-and-restore.md).

## Jak działają rozszerzenia i czy da się importować kod z zewnątrz?

Domyślnie tylko Professor Mari może przygotować dla ciebie szkic rozszerzenia osobistego. Takie rozszerzenie na starcie jest wyłączone, a przed uruchomieniem trzeba obejrzeć jego kod i zatwierdzić dokładny skrót SHA-256.

Kod przeglądarkowy domyślnie działa w osobnym wątku Worker wewnątrz ramki iframe o nieprzejrzystym pochodzeniu. Oprócz wąskich uprawnień (logowanie, prywatny magazyn danych, liczniki czasu, sprzątanie i deklaratywny interfejs) dostaje nieprzejrzyste identyfikatory aktywnego czatu oraz postaci. Dzięki temu rozszerzenia takie jak Notepad pamiętają stan osobno dla każdego czatu. Rozszerzenie przeglądarkowe może dodatkowo poprosić o ograniczone migawki: wyłącznie kart postaci biorących udział w tym czacie i persony wybranej do tego czatu. Te uprawnienia widać podczas zatwierdzania dokładnego skrótu, a bez nich odpowiednich danych po prostu nie ma. Rozszerzenia w piaskownicy nigdy nie dostają wiadomości, całych bibliotek postaci ani person, niezadeklarowanych pól, metadanych czatu, dostępu do DOM, dostępu do sieci ani interfejsów zmieniających dane. Kod serwerowy działa w oddzielnym procesie izolowanym przez system, na obsługiwanych hostach macOS i Linux, i nie dostaje kontekstu czatu z przeglądarki.

Import z zewnątrz jest domyślnie ukryty. Operator hosta musi ustawić `ENABLE_EXTERNAL_EXTENSIONS=true` w pliku `.env`, a potem użytkownik musi zaakceptować ostrzeżenie w sekcji **Settings → Advanced → Danger Zone**. Dopóki obie bramki nie zostaną otwarte, rekordy zewnętrzne, w tym zapisane ręcznie i zaimportowane z profilu, nie są widoczne, nie da się ich zatwierdzić ani uruchomić.

Rozszerzenie zewnętrzne może poprosić o uprawnienie **Full page access** (pełny dostęp do strony), gdy zgodność ze starszym kodem naprawdę wymaga dostępu do DOM aplikacji Marinara Engine. To już nie jest piaskownica: zatwierdzony kod działa wprost na stronie aplikacji i sięga do jej treści, magazynu przeglądarki, interfejsów sieciowych oraz bieżącej sesji z tego samego pochodzenia. Szkice od Professor Mari nie mogą o to prosić. Włącz to uprawnienie dopiero po sprawdzeniu kodu i tylko dla tej konkretnej, zaufanej wersji. Jeśli po wyłączeniu zostają niezarejestrowane zmiany, odśwież stronę. Zobacz [Rozszerzenia osobiste](extending/personal-extensions.md).

## Gdzie przechowywane są moje dane?

Wszystko zostaje na komputerze, na którym działa Marinara Engine, w folderze `data` wewnątrz instalacji. Twoje postacie, czaty, persony, lorebooki, presety i ustawienia zapisują się właśnie tam. Nic nie trafia do chmury. Zobacz [Gdzie Marinara przechowuje dane](data/where-data-is-stored.md).

## Czy aktualizacja skasuje moje dane?

Nie. Aktualizacja aplikacji Marinara Engine zostawia postacie, czaty i ustawienia na miejscu. Mimo to przed dużą aktualizacją warto zrobić kopię zapasową, na wszelki wypadek. Kroki aktualizacji dla każdej platformy opisuje przewodnik [Aktualizacja](UPGRADING.md).

## Co potrafi Professor Mari?

Professor Mari to wbudowana asystentka na ekranie głównym. Otwiera ją przycisk **Ask Professor Mari**. Wyjaśnia działanie aplikacji i pomaga w konfiguracji. Potrafi też tworzyć i zmieniać twoje dane na zwykłą prośbę wyrażoną potocznie: postacie, persony, lorebooki, presety promptów (zapisane szablony instrukcji) oraz nowe czaty.

Nad polem wpisywania pokazuje też kafelki z gotowymi odpowiedziami, które prowadzą przez wieloetapowe tworzenie i edycję bez ręcznego wpisywania każdego szczegółu.

Kiedy zmienia twoje dane, pojawia się karta podglądu z przyciskami **Keep** i **Restore**, więc każdą niechcianą zmianę da się cofnąć. To wsparcie, a nie zamiennik tych przewodników, gdy coś zależy od wersji. Pełną listę jej możliwości znajdziesz w przewodniku [Professor Mari](home/professor-mari.md).

Professor Mari może też edytować zwykłe pliki źródłowe aplikacji Marinara Engine. Pliki zależności, launchery, instalatory i procesy CI czekają za to na wyraźną akceptację. Jeśli jej zmiana wymaga publicznej biblioteki npm, Marinara pokazuje dokładną ustaloną wersję i sumę kontrolną z rejestru, zanim zainstaluje ją z wyłączonymi skryptami cyklu życia.

Uwaga: na zwykłym adresie zdalnym działania Professor Mari zmieniające dane wymagają zarówno Basic Auth, jak i sekretu administratora. Zaufane trasy sieciowe albo te z listy dozwolonych mogą korzystać z obejść opisanych w przewodniku [Dostęp zdalny](REMOTE_ACCESS.md).

## Czym jest agent Storyboard i jak go używać w trybie Game Mode?

Agent **Storyboard** do pobrania zamienia gotowy tekst opowieści w uporządkowaną serię klatek kluczowych. Każdą klatkę potrafi też ożywić w krótkim klipie. W trybie **Game Mode** obejmuje jedną gotową turę narracji GM (mistrza gry) i pokazuje klatki w pływającym podglądzie albo jako tło gry. W trybie **Roleplay** łączy nowo zakończone wymiany zdań w odcinek osadzony w czacie.

Żeby użyć go w trybie Game Mode, zainstaluj agenta **Storyboard** z **Agents > Download Agents**. Otwórz grę, przejdź do **Chat Settings > Agents**, włącz przełączniki **Enable Agents** i **Enable Storyboards**, a potem wskaż połączenie do generowania obrazów w grze albo w globalnej konfiguracji agenta Storyboard. Zakończ turę narracji GM, otwórz sekcję **Gallery** (galeria) i kliknij przycisk **Create storyboard**. Podgląd otwiera się ponownie przyciskiem **View storyboard**.

Żeby storyboardy w grze powstawały automatycznie, włącz przełącznik **Automatic Storyboard Illustrations**. Kiedy potrzebne są też klipy, włącz **Automatic Storyboard Animations** i wybierz połączenie typu Video Generation. Prezentacja **Storyboard Optimized** z kreatora nowej gry kształtuje wyłącznie narrację GM – nie instaluje agenta ani go nie włącza. Konfigurację w trybach Game Mode i Roleplay, prompty, podglądy, zachowanie po migracji i rozwiązywanie problemów opisuje [Przewodnik po agencie Storyboard](game/storyboard.md).

## Czy postacie mogą mówić na głos w rozmowie?

Tak, w trybie **Conversation**. Rozmowy audio i wideo działają wyłącznie w tym trybie. Żeby usłyszeć głos postaci, skonfiguruj najpierw **Text to Speech** w panelu **Connections**.

Jeśli chcesz odpowiadać mikrofonem, a rozpoznawanie mowy w samej przeglądarce zawodzi, zainstaluj najpierw agenta **Calls** z **Agents > Download Agents**. Potem otwórz panel **Connections**, rozwiń kartę **Local Model**, znajdź pole **Local Speech Model**, wybierz **Whisper Tiny (Multilingual)** albo **Whisper Base (Multilingual)** i kliknij przycisk **Download Whisper**. Odinstalowanie agenta Calls usuwa też pobrane modele Whisper i zwalnia miejsce na dysku. Pełną konfigurację rozmów opisuje przewodnik [Rozmowy](conversation/calls.md).

## Czy Marinara potrafi generować obrazy?

Tak. Dodaj połączenie do generowania obrazów, na przykład **Pollinations** (nie wymaga klucza) albo płatnego dostawcę. Marinara tworzy wtedy awatary postaci, grafiki scen, selfie oraz klatki kluczowe agenta Storyboard w trybach Roleplay i Game Mode. Jak dodać takie połączenie, opisuje przewodnik [Łączenie z dostawcą AI](connections/connecting-to-a-provider.md).

## Jak czytać dokumentację w aplikacji?

Każda instalacja zawiera komplet przewodników. Da się je czytać bez wychodzenia z aplikacji:

- Na ekranie głównym kliknij przycisk **Documentation** w stopce, obok przycisku **Replay Tutorial**.
- W sekcji FAQ na ekranie głównym otwórz pytanie o dokumentację i kliknij przycisk **Open Documentation**.

Oba przyciski otwierają ten sam wbudowany podgląd dokumentacji. Wypisuje on wszystkie przewodniki i wyświetla je wewnątrz aplikacji Marinara Engine.

## Gdzie szukać pomocy albo zgłosić błąd?

Zacznij od przewodnika [Rozwiązywanie problemów](TROUBLESHOOTING.md), uporządkowanego według objawów. W stopce ekranu głównego przycisk **Discord** otwiera czat społeczności, a przycisk **Support** – stronę wsparcia projektu. Błędy i propozycje funkcji zgłaszaj na stronie projektu w serwisie GitHub.

## Powiązane przewodniki

- [Rozwiązywanie problemów](TROUBLESHOOTING.md)
- [Instalacja](INSTALLATION.md)
- [Dostęp zdalny](REMOTE_ACCESS.md)
- [Łączenie z dostawcą AI](connections/connecting-to-a-provider.md)
