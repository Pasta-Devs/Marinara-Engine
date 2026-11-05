# Najczęściej zadawane pytania

Krótkie odpowiedzi na częste pytania o aplikację Marinara Engine. Każda z nich prowadzi do przewodnika z pełnym opisem kroków.

<a id="how-do-i-access-marinara-engine-from-my-phone-or-another-device"></a>

## Jak otworzyć aplikację Marinara Engine na telefonie lub innym urządzeniu?

Marinara działa jako serwer na jednym komputerze, a otwiera się ją w przeglądarce. Skrypty startowe pozwalają innym urządzeniom dotrzeć do serwera, ale kontrola dostępu blokuje je, dopóki nie ustawisz logowania (nazwy użytkownika i hasła) na komputerze-hoście. Do tego czasu zdalne urządzenie widzi tylko stronę **Access blocked** (dostęp zablokowany).

1. Zostaw aplikację Marinara Engine uruchomioną na komputerze-hoście.
2. Sprawdź lokalny adres IP hosta. W systemie Windows uruchom `ipconfig` i odczytaj wartość **IPv4 Address**. W systemie macOS lub Linux uruchom `hostname -I`.
3. Na drugim urządzeniu otwórz w przeglądarce adres `http://<host IP>:7860`, na przykład `http://192.168.1.42:7860`. `7860` to domyślny port.
4. Ustaw logowanie. Otwórz aplikację Marinara Engine na drugim urządzeniu: strona blokady ma formularz **Setup code** (kod konfiguracji). Znajdź jednorazowy kod w logu serwera na komputerze-hoście (w kontenerze Docker uruchom `docker logs <container> 2>&1 | grep "setup code"`), a potem wpisz go razem z nową nazwą użytkownika i hasłem. Możesz też otworzyć **Settings → Advanced → Access** (ustawienia, zaawansowane, dostęp) w przeglądarce, która jest już zalogowana na hoście.
5. Zaloguj się. Aby dodać kolejne urządzenia bez wpisywania hasła, użyj **Add a device** (dodanie urządzenia) w **Settings → Advanced → Access**.

W zwykłych instalacjach komputerowych ten sam komputer (`127.0.0.1`) nie potrzebuje hasła. Odwrotne proxy na tym samym komputerze liczy się jako zdalny gość i wymaga logowania. Wszystkie opcje, kody konfiguracji i kontenery Docker opisuje przewodnik [Dostęp zdalny](REMOTE_ACCESS.md#option-1-login-recommended). Dla urządzeń w różnych sieciach użyj sieci Tailscale: zobacz [Łączenie z dowolnego miejsca przez sieć Tailscale](REMOTE_ACCESS.md#connect-from-anywhere-with-tailscale). Jeśli nie możesz się połączyć, zajrzyj do przewodnika [Rozwiązywanie problemów](TROUBLESHOOTING.md).

## Czy jest aplikacja mobilna Marinara?

Osobnej, natywnej aplikacji nie ma. Na telefonie lub tablecie korzystaj z aplikacji internetowej w przeglądarce. Większość przeglądarek oferuje opcję **Add to Home Screen** (dodanie do ekranu głównego) albo **Install App** (instalacja aplikacji), która zapisuje ją jako PWA (stronę internetową, która otwiera się jak aplikacja, bez paska przeglądarki).

W systemie Android możesz też [pobrać najnowszy plik APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). Uruchamia on aplikację Marinara Engine na telefonie przez środowisko Termux. Zobacz [Przewodnik instalacji na Android (Termux)](installation/android-termux.md). Na urządzeniach iPhone i iPad zobacz [Przewodnik po PWA na iOS / iPadOS](installation/ios-pwa.md).

W aplikacji na system Android ekran uruchamiania oferuje opcje **Open in browser** (otwórz w przeglądarce), **Retry connection** (ponów połączenie) i **Install / Start Marinara**. Aby później zmienić wybór, użyj **Settings → General → App Behavior → Open Android launcher (app or browser)** (ustawienia, ogólne, zachowanie aplikacji, otwórz ekran uruchamiania Android: aplikacja lub przeglądarka). Starsze pliki APK logują się ręcznie pod adresem `/android-login`.

<a id="can-i-play-with-other-people"></a>

## Czy mogę grać z innymi osobami?

Tak. Opcjonalna gra wieloosobowa pozwala kilku osobom dzielić jedną sesję Conversation, Roleplay lub Game. Każdy uczestnik włącza ustawienie, a potem hostuje albo dołącza. Goście nie potrzebują klucza AI. Hasło nie czyni nieznanego gospodarza bezpiecznym. Przed włączeniem przeczytaj [konfigurację, ostrzeżenia i ograniczenia gry wieloosobowej](CONFIGURATION.md#optional-multiplayer).

## Jakie są trzy tryby czatu?

- **Conversation**: czat z postacią w stylu komunikatora.
- **Roleplay**: wciągająca scena fabularna z narracją i awatarami postaci.
- **Game**: przygoda tekstowa prowadzona przez mistrza gry sterowanego przez AI.

Żeby wybrać tryb, zobacz [Pierwsze kroki z aplikacją Marinara Engine](home/welcome.md#choose-a-chat-mode).

## Jak zmienić strefę czasową harmonogramów w trybie Conversation?

Otwórz czat w trybie Conversation i wybierz opcję **Schedule timezone** (strefa czasowa harmonogramu) w panelu Chat Settings. **Use device** (użyj ustawień urządzenia) przywraca strefę czasową twojego urządzenia. To jedno globalne ustawienie dla wszystkich czatów w trybie Conversation, które synchronizuje się z innymi urządzeniami podłączonymi do tego samego serwera. Zobacz [Tryb Conversation: pierwsze kroki](conversation/getting-started.md).

## Czy każdy czat w trybie Conversation ma własny harmonogram?

Nie. Harmonogram należy do postaci, więc używa go każdy czat w trybie Conversation z tą postacią. Edytuj go w **Character Editor → Convo → Weekly schedule** (edytor postaci, Convo, harmonogram tygodniowy).

Żeby w jednym czacie dostawać odpowiedzi od razu, wyłącz **Conversation schedules** (harmonogramy w trybie Conversation) w panelu Chat Settings tego czatu. Ręczne nadpisanie statusu, takie jak **dnd**, nadal obowiązuje i należy do postaci we wszystkich czatach. Użyj **clear**, żeby je usunąć.

## Czy do korzystania z aplikacji Marinara Engine potrzebny jest klucz API?

Tak, w przypadku usług AI online. **Klucz API** to tajny kod od usługi AI, dzięki któremu Marinara może korzystać z twojego konta w tej usłudze. Przed rozpoczęciem czatu potrzebujesz co najmniej jednego konta. Otwórz **Connections** (Połączenia), kliknij **Add** (dodaj), wybierz usługę, wklej klucz i kliknij **Connect** (połącz). Zobacz [Łączenie z dostawcą AI](connections/connecting-to-a-provider.md).

Niektóre opcje nie wymagają klucza. Opcje subskrypcyjne (Claude, ChatGPT i Grok) logują się przez narzędzie wiersza poleceń. **Built-in model** (model wbudowany) działa na twoim komputerze. Zobacz [Konfiguracja modelu wbudowanego](connections/local-model.md).

## Których dostawców AI obsługuje Marinara?

Marinara obsługuje OpenAI, Anthropic, Google Gemini, OpenRouter i wiele innych usług do generowania tekstu, obrazów i wideo, a także serwery **OpenAI-compatible** (zgodne z OpenAI), takie jak Ollama, LM Studio i KoboldCpp. Pełną listę zawiera przewodnik [Obsługiwani dostawcy AI](connections/providers-reference.md). Jak dodać usługę, opisuje przewodnik [Łączenie z dostawcą AI](connections/connecting-to-a-provider.md).

## Czy za korzystanie z aplikacji Marinara Engine trzeba płacić?

Marinara jest darmowa. Płacisz tyle, ile liczy sobie twoja usługa AI. Niektóre opcje można wypróbować za darmo: obrazy z **Pollinations** nie wymagają klucza, **Stable Horde** jest darmowe, a **Built-in model** działa na twoim komputerze. Opcje subskrypcyjne korzystają z płatnego planu, który być może już masz.

## Czy klucze API są bezpieczne?

Tak. Każdy klucz API jest szyfrowany algorytmem AES-256, zanim zostanie zapisany. Eksport kont i profilu pomija tajne wartości, więc po użyciu funkcji **Import Profile** (import profilu) wpisz klucze ponownie, także przy imporcie pliku ZIP z pełną kopią zapasową. Plik ZIP z pełną kopią zapasową zawiera zaszyfrowane rekordy i plik klucza, który je odblokowuje, więc trzymaj go prywatnie. Zobacz [Kopia zapasowa i przywracanie danych aplikacji Marinara](data/backup-and-restore.md).

## Czym jest karta postaci?

Karta postaci to zapisany profil postaci AI: imię, awatar, osobowość, historia i powitanie. Karty tworzy się w panelu **Character Editor** (edytor postaci) albo importuje z innych aplikacji. Zobacz [Tworzenie i edycja postaci](characters/creating-and-editing-characters.md).

## Czym jest lorebook i jak używać jednego przy kilku postaciach?

Lorebook to zbiór faktów o świecie. Każdy wpis trafia do promptu tylko wtedy, gdy w czacie pojawią się jego słowa wyzwalające. Możesz:

1. Wypełnić pole **Linked Characters** (powiązane postacie) lub **Linked Personas** (powiązane persony) w edytorze lorebooka. Lorebook działa wtedy w każdym czacie z nimi.
2. Otworzyć **Chat Settings → Lorebooks → Add Lorebook** (ustawienia czatu, lorebooki, dodanie lorebooka), żeby przypisać go do jednego czatu.
3. Ograniczyć pojedyncze wpisy do wybranych postaci.

Zobacz [Lorebooki](lorebooks/overview.md).

## Czym jest agent?

Agent to opcjonalny pomocnik AI, który działa w trakcie czatu i zajmuje się jednym konkretnym zadaniem, na przykład śledzi scenę albo dodaje mapy. Świeża instalacja nie ma żadnych agentów. Otwórz **Agents → Agent Organizer** (agenci, organizowanie agentów), wybierz agenta i zainstaluj go. Potem włącz go osobno dla każdego czatu w **Chat Settings**. Zobacz [Agenci](agents/agents-overview.md).

## Jak skonfigurować Noodle?

Noodle to lokalna, fikcyjna sieć społecznościowa dla twoich postaci. Zainstaluj **Noodle** z **Agents → Agent Organizer**, uruchom aplikację Marinara Engine ponownie, gdy pojawi się prośba, a potem otwórz **Home → Noodle** (ekran główny, Noodle). Zobacz [Noodle: wbudowana oś czasu społecznościowa](agents/noodle.md).

## Dlaczego postać nie odpowiada?

Zwykle czat nie ma konta ani modelu, klucz API jest błędny albo na koncie skończyły się środki. Zobacz [Postać nie odpowiada](TROUBLESHOOTING.md#my-character-does-not-reply).

## Dlaczego postać nie pamięta wcześniejszych wiadomości?

Modele czytają naraz tylko ograniczoną ilość tekstu, więc w długich czatach stare wiadomości wypadają z pola widzenia. Pomagają w tym dwa narzędzia. **Memory Recall** przywraca pasujące starsze wiadomości, a podsumowania skracają stare wiadomości do streszczeń. Oba znajdziesz w **Chat Settings**. W długich czatach w trybie Roleplay użyj funkcji **Advanced Memory Recall** (zaawansowane przywoływanie pamięci) w **Chat Settings → Memory Recall**. Zobacz [Memory Recall i podsumowania czatu](agents/memory.md).

## Jak utworzyć kopię zapasową danych?

Otwórz **Settings → Advanced → Backup & Export** (ustawienia, zaawansowane, kopie zapasowe i eksport) i kliknij **Download Backup** (pobranie kopii zapasowej). Zapisuje to plik `.zip` z twoimi danymi i wgranymi plikami. Żeby przywrócić dane, użyj funkcji **Import Profile (JSON/ZIP)** w **Settings → Imports** (ustawienia, import). Ta sama sekcja może też tworzyć kopię zapasową codziennie, co tydzień albo co miesiąc. Zobacz [Kopia zapasowa i przywracanie danych aplikacji Marinara](data/backup-and-restore.md).

## Jak działają rozszerzenia i czy da się importować kod z zewnątrz?

Domyślnie szkice rozszerzeń Personal Extension tworzy tylko Professor Mari. Szkic na starcie jest wyłączony, a przed jego uruchomieniem zatwierdzasz dokładny kod. Import z zewnątrz jest ukryty, dopóki host nie ustawi `ENABLE_EXTERNAL_EXTENSIONS=true` w pliku `.env`, a ty nie zaakceptujesz ostrzeżenia w **Settings → Advanced → Danger Zone** (ustawienia, zaawansowane, strefa zagrożenia). Zobacz [Rozszerzenia osobiste](extending/personal-extensions.md).

## Gdzie przechowywane są moje dane?

Na komputerze, na którym działa Marinara, w folderze `data` twojej instalacji. Nic nie jest przechowywane w chmurze. Zobacz [Gdzie Marinara przechowuje dane](data/where-data-is-stored.md).

## Czy aktualizacja skasuje moje dane?

Nie. Aktualizacja zachowuje postacie, czaty i ustawienia. Mimo to najpierw zrób kopię zapasową. Powrót do starszej wersji może spowodować utratę danych, które zapisuje tylko nowsza wersja. Zobacz [Aktualizacja](UPGRADING.md) i [Powrót do starszej wersji](UPGRADING.md#downgrading-to-an-older-version).

## Co potrafi Professor Mari?

Professor Mari to wbudowana asystentka na ekranie głównym. Wyjaśnia działanie aplikacji, a na twoją prośbę tworzy i edytuje postacie, persony, lorebooki i presety. Każda zmiana pokazuje kartę z przyciskiem **Undo** (cofnięcie). Zobacz [Professor Mari](home/professor-mari.md).

## Czym jest agent Storyboard i jak go używać w trybie Game Mode?

Zamienia gotowy tekst opowieści w obrazy. Zainstaluj agenta **Storyboard** z **Agents → Agent Organizer**, a potem włącz go w czacie. Zobacz [Przewodnik po agencie Storyboard](game/storyboard.md).

## Czy postacie mogą mówić na głos w rozmowie?

Tak, w trybie Conversation. Potrzebna jest skonfigurowana funkcja **Text to Speech** (synteza mowy) w **Connections**. Kroki, w tym rozpoznawanie mowy z mikrofonu, opisuje przewodnik [Rozmowy](conversation/calls.md).

## Czy Marinara potrafi generować obrazy?

Tak. Dodaj konto do generowania obrazów, na przykład **Pollinations** (bez klucza) albo płatną usługę. Zobacz [Łączenie z dostawcą AI](connections/connecting-to-a-provider.md).

## Jak czytać dokumentację w aplikacji?

Na ekranie głównym kliknij **Documentation** (dokumentacja) na pasku skrótów. Na telefonie najpierw otwórz menu skrótów. W sekcji FAQ na ekranie głównym możesz też kliknąć **Open Documentation** (otwarcie dokumentacji).

## Gdzie szukać pomocy albo zgłosić błąd?

Zacznij od przewodnika [Rozwiązywanie problemów](TROUBLESHOOTING.md). Na ekranie głównym **Discord** otwiera czat społeczności, a **Support** (wsparcie) – stronę wsparcia projektu. Błędy i propozycje funkcji zgłaszaj na stronie projektu w serwisie GitHub.

## Powiązane przewodniki

- [Rozwiązywanie problemów](TROUBLESHOOTING.md)
- [Instalacja](INSTALLATION.md)
- [Dostęp zdalny](REMOTE_ACCESS.md)
- [Łączenie z dostawcą AI](connections/connecting-to-a-provider.md)
