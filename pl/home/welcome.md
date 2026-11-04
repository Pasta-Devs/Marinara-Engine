# Pierwsze kroki z aplikacją Marinara Engine

Marinara Engine to aplikacja do czatowania i odgrywania ról z postaciami AI. Działa na twoim własnym komputerze. Ten przewodnik pokazuje ekran główny i kroki prowadzące do pierwszego czatu.

## Rozpoczęcie pierwszego czatu

Zanim zaczniesz: potrzebujesz klucza API (tajnego kodu, trochę jak hasło) od usługi AI albo opisanego niżej **Built-in model** (model wbudowany).

1. Zainstaluj aplikację Marinara Engine i otwórz ją w przeglądarce. Wybierz swoją platformę w przewodniku [Instalacja aplikacji Marinara Engine](../INSTALLATION.md).
2. Dodaj konto. Konto to jeden klucz API do jednej usługi AI. Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).
3. Wybierz modele, których ma używać to konto. Ten sam przewodnik pokazuje, jak to zrobić.
4. Utwórz albo zaimportuj postać. Otwórz panel **Characters** (postacie), a potem kliknij **New** (nowa), żeby otworzyć okno **Create Character** (tworzenie postaci), albo kliknij **Import** (import), żeby wczytać kartę z pliku. Zobacz [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md).
5. Otwórz pasek boczny czatów przyciskiem paska bocznego. Jego zakładki to **CONVO**, **RP** i **GM**. Wybierz jedną z nich, a potem kliknij przycisk **+**. Nazywa się on **New Conversation**, **New Roleplay** albo **New Game**, zgodnie z zakładką.
6. Przejdź przez okno konfiguracji, które się otworzy, a potem kliknij **Create Chat** (utworzenie czatu).

Co zobaczysz: otworzy się nowy czat i możesz napisać pierwszą wiadomość.

Jeśli nie masz jeszcze konta, najpierw otwiera się okno dodawania konta, które kończy się przyciskiem **Start chatting** (rozpocznij czat). Jeśli okno **Set Up** (konfiguracja) poprosi o wybór konta, wybierz konto z listy, a potem kliknij **Create Chat**.

Marinara nie zawiera AI online. Większość osób łączy się z usługą online. Możesz też pobrać **Built-in model**, niewielki model, który działa na twoim komputerze bez klucza API. Nadaje się do lekkich zadań pomocniczych, a nie do głównego czatu. Zobacz [Konfiguracja modelu wbudowanego](../connections/local-model.md).

Przy pierwszym otwarciu aplikacji Marinara Engine uruchamia się krótkie oprowadzenie z przewodnikiem. Zobacz [Samouczek przy pierwszym uruchomieniu](tutorial.md). Któryś krok sprawia kłopot? Zapytaj Professor Mari, wbudowaną asystentkę: [Professor Mari, twoja asystentka w aplikacji](professor-mari.md).

## Ekran główny w skrócie

Ekran główny widać wtedy, gdy nie jest otwarty żaden czat. Wygląda jak przeglądarka internetowa: u góry są zakładki i skróty, a niżej widgety.

- **Zakładki.** **Home** (ekran główny) to strona główna. **Professor** otwiera asystentkę Professor Mari. Niektórzy zainstalowani agenci dodają własną zakładkę.
- **Pasek wyszukiwania.** Na komputerze kliknij pasek pod zakładkami albo naciśnij <kbd>Ctrl</kbd>+<kbd>K</kbd> (<kbd>⌘</kbd>+<kbd>K</kbd> na Macu), żeby znaleźć czaty, postacie, ustawienia i nie tylko. Na telefonach, tabletach i w wąskich oknach ten pasek się nie pokazuje.
- **Skróty.** Szybkie linki do **Discord**, **Support** (wsparcie), **Credits** (autorzy), **Documentation** (dokumentacja), **Tutorial** (samouczek), **FAQ** (najczęstsze pytania), **Achievements** (osiągnięcia) i **Widgets** (widgety). Skrót **Achievements** jest widoczny tylko wtedy, gdy ustawienie Achievements jest włączone. Skróty pokazują się tylko na zakładce **Home**. Na telefonie, tablecie albo w wąskim oknie dotknij przycisku skrótów **Open bookmarks** (otwarcie skrótów) po lewej stronie zakładek, żeby zobaczyć je jako listę.

Na środku widać logo, napis **Marinara Engine** i numer wersji. Pod nimi przyciski **Conversation**, **Roleplay** i **Game** rozpoczynają nowy czat w danym trybie.

<a id="choose-a-chat-mode"></a>

## Wybór trybu czatu

Tryb wybierasz przy rozpoczynaniu czatu.

- **Conversation**: zwykły czat z AI w stylu komunikatora. Zobacz [Tryb Conversation: pierwsze kroki](../conversation/getting-started.md).
- **Roleplay**: opowieść z jedną lub kilkoma postaciami. Aplikacja śledzi scenę, na przykład miejsce i czas. Zobacz [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md).
- **Game**: gra jednoosobowa. AI występuje jako Game Master (mistrz gry), który opowiada historię. Dostajesz grupę towarzyszy (drużynę), rzuty kośćmi, mapy i zadania. Zobacz [Game Mode: pierwsze kroki](../game/getting-started.md).

<a id="home-widgets"></a>

## Widgety ekranu głównego

Widgety to małe karty, które możesz pokazywać, ukrywać i przesuwać.

1. Kliknij **Widgets** na pasku skrótów. Otworzy się okno **Home Widgets** (widgety ekranu głównego). Wymienia ono widgety w grupach **Built-in** (wbudowane), **Agents** (agenci) i **Personal** (osobiste).
2. Kliknij przycisk z ikoną oka obok widgetu, żeby go pokazać albo ukryć. Widget pokazany ponownie trafia na pierwsze wolne miejsce na ekranie głównym.
3. Żeby przesunąć widget, przeciągnij uchwyt w jego prawym górnym rogu. Na komputerze uchwyt pojawia się po najechaniu kursorem na widget.

Układ zapisuje się w tej przeglądarce. Osobiste widgety mają też przyciski edycji i usuwania. Na dole okna sekcja **Browser chrome** (wygląd przeglądarki) ma jeden przełącznik: **Show URL bar** (pokazanie paska adresu) pokazuje albo ukrywa pasek wyszukiwania na komputerze.

Professor Mari może zrobić dla ciebie osobisty widget, jeśli ją o to poprosisz. Zainstalowani agenci też mogą dodawać widgety.

## Informacje: wbudowane widgety

| Widget | Co robi | Widoczny od początku |
| --- | --- | --- |
| **Professor Mari** | **Ask Professor Mari** (zapytaj Professor Mari) otwiera jej czat. | Tak |
| **Recent chats** (ostatnie czaty) | Twoje najnowsze czaty. Kliknij czat, żeby otworzyć go ponownie. Gdy nie ma czatów: **Your chats will show here**. | Tak |
| **Learn the engine** (poznaj aplikację) | Linki do **Documentation**, **Replay tutorial** (powtórz samouczek) i **Read FAQ** (przeczytaj FAQ). | Tak |
| **What's New** (co nowego) | **See what's new** (zobacz nowości) i **Read release notes** (przeczytaj informacje o wydaniu). | Tak |
| **Community** (społeczność) | Linki do **Discord**, **Support** i **Credits**. | Tak |
| **Character Library** (biblioteka postaci) | Codziennie nowy wybór twoich postaci. | Nie |
| **Discovery desk** (biurko odkryć) | Agenci, których nie masz zainstalowanych. **Browse agents** (przeglądanie agentów) otwiera katalog. | Nie |
| **Character of the Day** (postać dnia) | Jedna postać z twojej biblioteki, z przyciskami **Start a chat** (rozpoczęcie czatu) i **View character** (podgląd postaci). | Nie |
| **Clock & calendar** (zegar i kalendarz) | Dzisiejsza data i godzina. | Nie |
| **Achievements** | Twoje ostatnie i najbliższe osiągnięcia. Wymaga włączonego ustawienia Achievements. | Nie |

## Gdzie szukać pomocy

- Zapytaj asystentkę Professor Mari na ekranie głównym.
- Otwórz skrót **FAQ**, żeby znaleźć szybkie odpowiedzi.
- Otwórz skrót **Documentation**, żeby przeczytać przewodniki w aplikacji.
- Kliknij **Discord**, żeby trafić do społeczności, albo **Support**, żeby wesprzeć projekt.

Jeśli coś nie działa, zajrzyj do przewodnika [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

## Powiązane przewodniki

- [Instalacja aplikacji Marinara Engine](../INSTALLATION.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md)
- [Samouczek przy pierwszym uruchomieniu](tutorial.md)
- [Professor Mari, twoja asystentka w aplikacji](professor-mari.md)
