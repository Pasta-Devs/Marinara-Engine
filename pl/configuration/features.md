# Przełączniki funkcji

Niektóre zachowania serwera są opcjonalne. Włączysz je w **Settings > Advanced > Features** (ustawienia > zaawansowane > funkcje). Każdy przełącznik zaczyna wyłączony, więc serwer, na którym nikt nie otworzy tej sekcji, działa jak wcześniej.

Zmiany obowiązują od razu, bez restartu serwera ani odświeżania strony.

<a id="overview"></a>

## Przegląd

| Przełącznik | Klucz ustawienia | Domyślnie | Zmienna środowiskowa |
| --- | --- | --- | --- |
| **Stable lorebook picks** (stałe wybory lorebooka) | `stableLorebookGroupPicks` | Wyłączony | `LOREBOOK_STABLE_GROUP_WINNERS` |
| **Retry failed provider calls** (ponawiaj nieudane wywołania dostawcy) | `providerRetry` | Wyłączony | `PROVIDER_RETRY_TRANSIENT_ERRORS` |
| **Lorebook activation stats** (statystyki aktywacji lorebooków) | `usageAndActivationStats` | Wyłączony | brak |
| **Recover deleted chat messages** (odzyskiwanie usuniętych wiadomości czatu) | `messageTrash` | Wyłączony | brak |

Wyszukanie `features` w ustawieniach prowadzi do tej sekcji.

<a id="where-the-settings-are-stored"></a>

## Gdzie zapisano ustawienia

Wszystkie przełączniki są zapisywane razem w ustawieniu aplikacji `features`, jako obiekt JSON wartości logicznych. Zapisywane są tylko odstępstwa od wartości domyślnej. Brak klucza, pusty obiekt lub nieczytelna wartość oznaczają domyślne zachowanie: wszystko wyłączone.

Serwer trzyma kopię w pamięci, więc sprawdzanie przełącznika nie dodaje odczytów w częstych ścieżkach, np. wywołaniach dostawcy i skanowaniu lorebooków. Zapis z Settings lub dowolny zapis wiersza `features` od razu odświeża kopię.

API to `GET` oraz `PUT /api/app-settings/features`. `PUT` zastępuje cały obiekt i odrzuca nieznane klucze oraz wartości inne niż logiczne.

<a id="switches"></a>

## Przełączniki

<a id="stable-lorebook-picks"></a>

### Stałe wybory lorebooka

Klucz: `stableLorebookGroupPicks`. Zmienna środowiskowa: `LOREBOOK_STABLE_GROUP_WINNERS`.

Włączony: grupa włączania lorebooka zachowuje tego samego zwycięzcę w czacie, dopóki pasujący kandydaci się nie zmieniają. Inne czaty i zestawy kandydatów mogą wybrać inaczej.

Wyłączony: zwycięzca jest losowany przy każdym generowaniu.

<a id="retry-failed-provider-calls"></a>

### Ponawianie nieudanych wywołań dostawcy

Klucz: `providerRetry`. Zmienna środowiskowa: `PROVIDER_RETRY_TRANSIENT_ERRORS`.

Włączony: odmowa lub nieosiągalność połączenia albo błąd bramy 502/503 są ponawiane najwyżej dwukrotnie po krótkiej losowo zmienionej przerwie, tylko przed otrzymaniem jakiegokolwiek tekstu. 504 i zerwane połączenie nigdy nie są ponawiane. Gdy połączenie ma fallback, jest on próbowany od razu zamiast ponowienia.

Wyłączony: jak wcześniej ponawiane są tylko ograniczenia częstotliwości.

<a id="lorebook-activation-stats"></a>

### Statystyki aktywacji lorebooków

Klucz: `usageAndActivationStats`. Bez zmiennej środowiskowej.

Włączony: po pomyślnym zapisaniu odpowiedzi Marinara rejestruje, które wpisy lorebooka zostały aktywowane, więc w edytorze lorebooka można sortować i filtrować wpisy według użycia. Części odpowiedzi dopisane funkcją Continue nie dodają zapisów aktywacji.

Wyłączony: nic nie jest zapisywane, a edytor lorebooka ukrywa statystyki aktywacji.

<a id="recover-deleted-chat-messages"></a>

### Odzyskiwanie usuniętych wiadomości czatu

Klucz: `messageTrash`. Bez zmiennej środowiskowej.

Włączony: usunięte wiadomości czatu trafiają do zakładki **Trash** (kosz) w wyszukiwaniu czatu. Przywrócisz je tam przyciskiem **Restore** (przywrócenie) w ciągu 30 dni; potem są usuwane na dobre. Wiadomości z trybu Game i usunięcia przy cofaniu nadal są trwałe.

Wyłączony: usunięte wiadomości znikają od razu.

<a id="precedence"></a>

## Pierwszeństwo

1. **Zmienna środowiskowa.** Jeśli jest ustawiona, wygrywa z zapisanym przełącznikiem zarówno przy włączaniu, jak i wyłączaniu. Settings pokazuje blokadę z nazwą zmiennej. Pusta wartość oznacza brak ustawienia.
2. **Zapisany przełącznik.** Wartość z Settings > Advanced > Features.
3. **Domyślna wartość.** Wyłączony.

| Zmienna | Steruje | Wartości |
| --- | --- | --- |
| `LOREBOOK_STABLE_GROUP_WINNERS` | Stałe wybory lorebooka | `true`, `1`, `yes` lub `on` włączają. Każda inna wartość wyłącza. |
| `PROVIDER_RETRY_TRANSIENT_ERRORS` | Ponowienia wywołań dostawcy | `true`, `1`, `yes` lub `on` włączają. Każda inna wartość wyłącza. |

Zmienne są odczytywane przy każdej kontroli, więc zmiana `.env` nie wymaga restartu.

<a id="for-developers"></a>

## Dla programistów

Rejestr to `packages/shared/src/schemas/feature-settings.schema.ts`: nazwy i wartości domyślne. Dodaj przełącznik do `FEATURE_SWITCH_NAMES`, `FEATURE_SWITCH_DEFAULTS` i `featureSettingsSchema`, nadaj etykietę i opis pod `settings.features.<key>` w angielskim katalogu, a potem dopisz go do `SERVER_SWITCHES` w `packages/client/src/components/panels/settings/FeatureSwitchesSettings.tsx`, aby pojawił się w Settings. Na serwerze sprawdzaj go przez `isFeatureEnabled("<key>")` z `packages/server/src/services/features/feature-settings.ts`. W kliencie używaj `useFeatureEnabled("<key>")` z `packages/client/src/hooks/use-feature-settings.ts`.
