# Przechowywanie danych w plikach

Ten przewodnik opisuje architekturę lokalnego zapisu danych w aplikacji Marinara Engine. Układ folderów widoczny dla użytkownika opisuje przewodnik [Gdzie Marinara przechowuje dane](../data/where-data-is-stored.md).

## Źródło prawdy

Marinara zapisuje wiersze aplikacji jako migawki JSON w folderze `DATA_DIR/storage`:

```text
storage/
├── manifest.json
└── tables/
    ├── chats.json
    ├── characters.json
    ├── messages/
    │   ├── <encoded-chat-id>.json
    │   └── ...
    ├── message_swipes/
    │   └── <encoded-chat-id>.json
    └── ...
```

Zmienna `FILE_STORAGE_DIR` może wskazać inny folder niż `storage`. Każdy plik tabeli zawiera tablicę JSON. Plik `manifest.json` przechowuje wersję formatu zapisu, czas zapisu, identyfikator backendu oraz liczbę wierszy dla każdej zarejestrowanej tabeli.

### Tabele podzielone na fragmenty

Tabele powiązane z czatami i zapisywane przy każdej turze są przechowywane jako **jeden plik na czat**, a nie jeden duży plik. W układzie monolitycznym zapis każdego wiersza ponownie serializował i zapisywał pełną historię wszystkich czatów. Format zapisu 3 podzielił `messages` oraz `message_swipes`; format 4 rozszerza ten układ na `memory_chunks`, `chat_images`, `agent_runs`, `agent_memory`, `conversation_call_sessions`, `conversation_call_messages`, `game_state_snapshots`, `game_engine_state`, `game_checkpoints`, `game_turn_storyboards`, `game_scene_videos`, `spatial_context_snapshots`, `ooc_influences` i `conversation_notes`. Wiążącą listą jest `SHARDED_TABLES` w pliku `file-backed-store.ts`, odzwierciedlona przez polecenie offline `unshard` w `scripts/protect-launcher-data.mjs`; test regresji pilnuje zgodności obu list. Każda tabela wyznacza fragment według własnej kolumny `chatId`, z dwoma wyjątkami: `message_swipes` korzysta z wiadomości nadrzędnej, a wpływy i notatki z `targetChatId`. Tabele `lorebooks` oraz `game_turn_storyboard_keyframes` celowo pozostają monolityczne.

Śledzenie zmian działa na poziomie plików czatu, więc opróżnienie bufora dotyka tylko zmienionych czatów. Fragment, w którym liczba wierszy spadnie do zera, jest usuwany zamiast zapisywania pustej tablicy. Nazwy plików powstają przez kodowanie procentowe identyfikatora czatu, z awaryjnymi skrótami dla nazw zbyt długich lub zastrzeżonych. To kodowanie stanowi granicę bezpieczeństwa, ponieważ importowane profile mogą mieć dowolne identyfikatory. Pliki są jedynie kontenerami; wiersze zachowują własne klucze.

Przy pierwszym uruchomieniu kompilacji z nowo podzielonymi tabelami istniejące pliki monolityczne migrują automatycznie: wiersze są grupowane według czatu i zapisywane jako fragmenty, po czym plik monolityczny **oraz jego `.bak`** otrzymują nazwę `.pre-shard`. To automatyczna kopia sprzed migracji, której Engine nigdy nie usuwa. Znacznik `.migrating` pozwala jednoznacznie odzyskać dane po awarii. Jeśli starsza kompilacja później odtworzy plik monolityczny obok fragmentów, fragmenty mają pierwszeństwo, a plik powodujący konflikt zostaje odizolowany z datowanym sufiksem `.post-downgrade-` — nigdy nie jest scalany. Osierocone wiersze podrzędne trafiają do fragmentu `orphaned-rows`, zamiast zostać utracone. Manifest zapisany przez nowszy format przechowywania odmawia załadowania.

## Model działania

Plik `packages/server/src/db/file-backed-store.ts` wczytuje migawki tabel do pamięci przy starcie. Serwer odczytuje i zmienia te wiersze przez operacje plikowe udostępniane przez `db/file-query.ts`. Plik `db/file-schema.ts` dostarcza odporne na kolizje metadane tabel i kolumn dla definicji z folderu `db/schema/`.

Płynne API `select`, `insert`, `update` i `delete` utrzymuje usługi zapisu w zwięzłej formie, a przy tym nie wymaga zewnętrznej bazy danych ani ORM. Obsługiwane filtry i sortowanie to jawne obiekty wyrażeń, więc magazyn nigdy nie parsuje zapytań tekstowych.

Tabele deklarują klucze naturalne przez `fileTable(..., { uniqueBy: [...] })`. Operacje wstawiania i aktualizacji sprawdzają klucze główne oraz zadeklarowane klucze naturalne na podstawie całej proponowanej zmiany, zanim ruszą wiersze w pamięci. Dzięki temu naruszone ograniczenie zostawia tabelę nietkniętą. Reguła może zawierać predykat `when`, jeśli unikalność dotyczy tylko części wierszy.

Pobrane pakiety funkcji (capability packages) mogą mieć własne instancje tabel plikowych. Magazyn odnajduje je po zarejestrowanej nazwie tabeli, gdy porównanie tożsamości obiektów nie da wyniku. Dzięki temu kod zapisu należący do pakietu może bezpiecznie korzystać z tabel silnika.

## Zapis i odzyskiwanie danych

Każdy zapis oznacza zmienione tabele jako wymagające utrwalenia. Krótkie opóźnienie łączy zmiany następujące blisko siebie, a licznik bezpieczeństwa co jakiś czas zapisuje zaległą pracę. Przy kontrolowanym wyłączeniu serwer czeka na trwające zapisy, a potem utrwala wiersze zmienione w ich trakcie.

Marinara zapisuje każdą migawkę do pliku tymczasowego, opróżnia bufor i atomowo zmienia nazwę pliku. Przed podmianą odświeża poprzednią zdrową migawkę jako plik `.bak`. Przy starcie odtwarza nieczytelny plik główny z kopii, o ile to możliwe. Jeśli żadna z kopii nie nadaje się do użytku, Marinara odsuwa uszkodzone pliki, dodając do nazwy znacznik czasu, i startuje z pustą tylko tą jedną tabelą, żeby interfejs pozostał dostępny i dało się naprawić dane.

## Transakcje

Transakcje działają na migawkach kopiowanych przy zapisie (copy-on-write), a ich zasięg wyznacza `AsyncLocalStorage`. Tabela jest klonowana dopiero wtedy, gdy dana transakcja pierwszy raz ją zmienia. Jeśli funkcja zwrotna zgłosi błąd, przywracane są tylko tabele zmienione przez tę transakcję, a równoległe zapisy w innych tabelach zostają nienaruszone.

## Dodawanie tabeli

Przy dodawaniu trwałych danych wykonaj kolejno te kroki:

1. Zdefiniuj tabelę w `packages/server/src/db/schema/`, używając `fileTable` i plikowych konstruktorów kolumn.
2. Wyeksportuj ją z `db/schema/index.ts`.
3. Zadeklaruj klucze naturalne opcją tabeli `uniqueBy`.
4. Zarejestruj jej nazwę w `FILE_BACKED_TABLES`.
5. Zdefiniuj w `file-backed-store.ts` relacje kaskadowe lub ustawiające wartość null, jeśli są potrzebne.
6. Dodaj metadane kolumn JSON w `services/mari-db/mari-db.service.ts`, gdy pole tekstowe zawiera ustrukturyzowany JSON.
7. Sprawdź, czy kopia zapasowa profilu i jej przywracanie działają poprawnie.
8. Uruchom `pnpm check` oraz odpowiednie testy regresyjne zapisu danych.

Definicje tabel, metadane relacji, przenośność profilu i walidację Mari DB utrzymuj zgodne w ramach jednej zmiany.
