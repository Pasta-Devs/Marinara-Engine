# Pierwsze kroki z aplikacją Marinara Engine

Witaj w aplikacji Marinara Engine. Z tego przewodnika dowiesz się, czym jest ta aplikacja, co widać na ekranie głównym i jak dojść do pierwszego czatu. Jest napisany z myślą o nowych osobach, więc wcześniejsza wiedza o konfiguracji nie jest potrzebna.

## Czym jest Marinara Engine

Marinara Engine to lokalna aplikacja do czatowania i odgrywania ról z postaciami AI. Działa na twoim komputerze i łączy się z wybraną usługą AI. Tworzysz albo importujesz postacie, wybierasz sposób czatowania i rozmawiasz z nimi. Marinara nie uruchamia AI samodzielnie, więc pierwszym zadaniem jest dodanie połączenia. Większość osób łączy się z dostawcą AI działającym w sieci. Do pobrania jest też niewielki, wbudowany model **Local Model** (model lokalny). Nadaje się do prostych zadań pomocniczych, a nie do głównego czatu; zobacz [Konfiguracja modelu Local Model](../connections/local-model.md). Po tej pierwszej konfiguracji wszystko działa już z poziomu aplikacji.

## Ekran główny w skrócie

Ekran główny widać wtedy, gdy nie jest otwarty żaden czat. Wygląda trochę jak przeglądarka internetowa: u góry są zakładki i skróty, a niżej biurko z widgetami.

U góry znajdują się takie elementy:

- **Zakładki.** **Home** (ekran główny) to strona główna. **Professor** otwiera asystentkę Professor Mari, która objaśnia aplikację i pomaga w konfiguracji. Niektórzy zainstalowani agenci dodają własną zakładkę.
- **Pasek wyszukiwania.** Na komputerze kliknij pasek pod zakładkami albo naciśnij Ctrl+K (Cmd+K na Macu), żeby znaleźć czaty, postacie, ustawienia i nie tylko.
- **Skróty.** Szybkie linki do **Discord**, **Support** (wsparcie), **Credits** (autorzy), **Documentation** (dokumentacja), **Tutorial** (samouczek), **FAQ** (najczęstsze pytania), **Achievements** (osiągnięcia) i **Widgets** (widgety). Skrót **Achievements** jest widoczny tylko wtedy, gdy ustawienie Achievements jest włączone. Na telefonie dotknij przycisku skrótów po lewej stronie zakładek, żeby zobaczyć je jako listę.

Na środku widać logo aplikacji, napis **Marinara Engine** i numer wersji. Pod nimi przyciski **Conversation**, **Roleplay** i **Game** rozpoczynają nowy czat w danym trybie.

Przy pierwszym otwarciu aplikacji Marinara krótki samouczek pokazuje najważniejsze przyciski i tryby czatu. Cały przebieg opisuje [Samouczek przy pierwszym uruchomieniu](tutorial.md).

<a id="home-widgets"></a>

## Widgety ekranu głównego

Resztę ekranu głównego tworzą widgety: małe karty, które można pokazywać, ukrywać i przesuwać. Razem z aplikacją dostępne są takie widgety:

| Widget | Co robi | Widoczny od początku |
| --- | --- | --- |
| **Professor Mari** | Kliknij **Ask Professor Mari** (zapytaj Professor Mari), żeby otworzyć jej czat. | Tak |
| **Recent chats** (ostatnie czaty) | Pokazuje twoje najnowsze czaty z ostatnią wiadomością. Kliknij czat, żeby otworzyć go ponownie. Jeśli nie ma jeszcze żadnego czatu, widget pokazuje napis **Your chats will show here**. | Tak |
| **Learn the engine** (poznaj aplikację) | Linki do **Documentation**, **Replay tutorial** (powtórz samouczek) i **Read FAQ** (przeczytaj FAQ). | Tak |
| **What's New** (co nowego) | **See what's new** (zobacz nowości) ponownie otwiera okno What's New dla tej wersji, nawet jeśli zostało wcześniej zamknięte. **Read release notes** (przeczytaj informacje o wydaniu) otwiera pełne informacje o wydaniu w internecie. | Tak |
| **Community** (społeczność) | Linki do **Discord**, **Support** i **Credits**. | Tak |
| **Character Library** (biblioteka postaci) | Codziennie nowy wybór twoich postaci. | Nie |
| **Discovery desk** (biurko odkryć) | Proponuje agentów, których jeszcze nie zainstalowano. Strzałkami zobaczysz kolejnych, a **Browse agents** (przeglądanie agentów) otwiera katalog. | Nie |
| **Character of the Day** (postać dnia) | Jedna postać z twojej biblioteki, z przyciskami **Start a chat** (rozpoczęcie czatu) i **View character** (podgląd postaci). | Nie |
| **Clock & calendar** (zegar i kalendarz) | Dzisiejsza data i godzina. | Nie |
| **Achievements** | Twoje ostatnie i najbliższe osiągnięcia. Dostępny tylko wtedy, gdy ustawienie Achievements jest włączone. | Nie |

Niektórzy zainstalowani agenci też dodają widgety. Professor Mari może też zrobić dla ciebie osobisty widget, jeśli ją o to poprosisz.

Żeby wybrać widgety, kliknij skrót **Widgets**. Okno **Home Widgets** (widgety ekranu głównego) wymienia je w grupach **Built-in** (wbudowane), **Agents** (agenci) i **Personal** (osobiste). Kliknij przycisk z ikoną oka obok widgetu, żeby go pokazać albo ukryć. Widget pokazany ponownie trafia na pierwsze wolne miejsce na ekranie głównym. Osobiste widgety mają też przyciski edycji i usuwania.

Żeby przesunąć widget, przeciągnij uchwyt w jego prawym górnym rogu. Na komputerze uchwyt pojawia się po najechaniu kursorem na widget. Z klawiatury ustaw fokus na uchwycie i użyj klawiszy strzałek. Układ widgetów jest zapisywany w tej przeglądarce.

Na dole okna **Home Widgets** sekcja **Browser chrome** (wygląd przeglądarki) ma trzy przełączniki: **Show URL bar** (pokazanie paska adresu) pokazuje albo ukrywa pasek wyszukiwania, a **Other-tab bookmarks (desktop)** (skróty na innych zakładkach, komputer) i **Other-tab bookmarks (mobile)** (skróty na innych zakładkach, telefon) sprawiają, że skróty pozostają widoczne na zakładkach innych niż **Home**.

## Pierwsze kroki

Wykonaj kolejno te kroki, żeby dojść do pierwszego czatu.

1. Zainstaluj aplikację Marinara Engine i otwórz ją w przeglądarce. Wybierz swoją platformę w przewodniku [Instalacja aplikacji Marinara Engine](../INSTALLATION.md).
2. Dodaj połączenie, żeby aplikacja mogła dotrzeć do usługi AI. Połączenie przechowuje dostawcę, klucz API i model. Klucz API to tajny kod, trochę jak hasło, który dostajesz od dostawcy AI. Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).
3. Utwórz albo zaimportuj postać do rozmowy. Otwórz panel **Characters** (postacie), a potem kliknij przycisk **New** (nowa), żeby otworzyć okno **Create Character** (tworzenie postaci), albo kliknij przycisk **Import** (import), żeby wczytać kartę postaci z pliku. Zobacz [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md).
4. Rozpocznij czat. Na pasku bocznym czatów wybierz zakładkę trybu, a potem kliknij przycisk **+**. Przycisk nazywa się **New Conversation**, **New Roleplay** albo **New Game**, zgodnie z wybraną zakładką. Nowy czat otwiera się razem z oknem konfiguracji, które prowadzi przez resztę. Jeśli nie ma jeszcze zapisanego połączenia, najpierw pojawia się okno **Set Up Conversation**, **Set Up Roleplay** albo **Set Up Game**. Wybierz w nim połączenie, a potem kliknij przycisk **Create Chat**.

Jeśli któryś krok sprawia kłopot, zapytaj wbudowaną asystentkę. Przewodnik [Professor Mari, twoja asystentka w aplikacji](professor-mari.md) pokazuje, co ona potrafi.

## Trzy tryby czatu

Marinara ma trzy tryby czatu. Jeden z nich wybiera się przy zakładaniu nowego czatu.

- **Conversation**: zwykły, bezpośredni czat z AI, bez odgrywania ról, w stylu komunikatora. Zobacz [Tryb Conversation: pierwsze kroki](../conversation/getting-started.md).
- **Roleplay**: wciągające odgrywanie ról z postaciami, śledzeniem sceny i stanem świata. Zobacz [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md).
- **Game**: jednoosobowa gra fabularna prowadzona przez postać Game Master (GM, czyli mistrz gry) sterowaną przez AI, z drużyną, kośćmi, mapami i zadaniami. Zobacz [Game Mode: pierwsze kroki](../game/getting-started.md).

## Gdzie szukać pomocy

Pomoc jest dostępna na kilka sposobów bez wychodzenia z aplikacji:

- Zapytaj asystentkę **Professor Mari** na ekranie głównym o pomoc przy konfiguracji i o to, jak coś zrobić.
- Przeczytaj **FAQ** na ekranie głównym, gdzie są szybkie odpowiedzi na częste pytania.
- Otwórz przewodniki w aplikacji skrótem **Documentation** na ekranie głównym.
- Kliknij skrót **Discord**, żeby trafić do społeczności, albo **Support**, żeby wesprzeć projekt.

Jeśli coś się zepsuło albo nie działa, zajrzyj do przewodnika [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

## Powiązane przewodniki

- [Instalacja aplikacji Marinara Engine](../INSTALLATION.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md)
- [Samouczek przy pierwszym uruchomieniu](tutorial.md)
- [Professor Mari, twoja asystentka w aplikacji](professor-mari.md)
- [Tryb Conversation: pierwsze kroki](../conversation/getting-started.md)
- [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md)
- [Game Mode: pierwsze kroki](../game/getting-started.md)
