# Pisanie zestawów zasad Game Mode

Zestaw zasad mówi trybowi Game Mode, jak działa system stołowy: jakie kości rzuca test, co znajduje się w arkuszu postaci, jakie zasoby są wydawane i co odnawia odpoczynek. Napisz własny, żeby przenieść swój system do trybu Game Mode i udostępnić go innym. Jeśli chcesz grać z zestawem zasad przygotowanym przez kogoś innego, zobacz przewodnik [Game Mode: gra z zestawem zasad](../game/rulesets.md).

Zestaw zasad to jeden plik JSON. Zawiera dane, nie kod, więc nic się w nim nie wykonuje, a import nie może zaszkodzić twojemu komputerowi. Zanim zaimportujesz cudzy plik, przeczytaj tekst mistrza gry, bo ten tekst trafia do modelu w każdej grze, która używa tego zestawu zasad.

## Tworzenie zestawu zasad

1. Skopiuj przykładowy plik pasujący do sposobu rzucania w twoim systemie:
   - [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json) to niewielki system 2d6 z trzema cechami. Pokazuje, że format nie zakłada d20 ani sześciu atrybutów.
   - [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json) to niewielka pula kości dziesięciościennych z trzema cechami i sześcioma umiejętnościami zawodowymi.
   - Oficjalny [pakiet 5e (SRD 5.1)](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014), czyli pełnowymiarowy przykład. Jego `ruleset.json` i `catalogs/` to pliki instalowane przez Agent Organizer.
2. Zmień `id` na własne. Identyfikator zawiera małe litery, cyfry i pojedyncze łączniki, np. `ember-roads`.
3. Otwórz kopię w edytorze tekstu, takim jak Notatnik albo VS Code, i zapisz ją z końcówką `.json`. Najpierw zmień `name`, potem nazwy atrybutów w `sheet`, a następnie `rests` i tekst `gm`. Sekcja [Części pliku](#parts-of-the-file) wymienia każdy klucz, a sekcja [Strony referencyjne](#reference-pages) zawiera linki do stron, które je objaśniają.
4. Zaimportuj plik (zobacz [Wypróbowanie zestawu zasad](#try-your-ruleset)). Import sprawdza cały plik i wskazuje błędy wiersz po wierszu, zanim cokolwiek zapisze.
5. Utwórz nową grę (zobacz [Game Mode: pierwsze kroki](../game/getting-started.md)), wybierz swój zestaw zasad w **Rules** (zasady) i wykonaj kilka testów.

Jeśli to nie zadziała, zobacz sekcję [Rozwiązywanie problemów](#troubleshooting).

Aby edytor pomagał ci podczas pisania, dodaj tę linię jako pierwszą wewnątrz zewnętrznych klamer pliku. Wskazuje ona edytorowi JSON Schema:

```json
"$schema": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json",
```

Schemat wyłapuje błędne nazwy kluczy i niewłaściwe typy. Nie sprawdza, czy nazwy wskazują istniejące rzeczy, np. czy atrybut podany przez umiejętność istnieje. Robi to import. Do dowolnego obiektu możesz dodać linię `"$comment": "..."` z notatką dla siebie. Engine ją ignoruje.

## Co zestaw zasad może, a czego nie może

Zestaw zasad uzupełnia luki w mechanice, którą Engine już zna. Engine zna pięć sposobów rozstrzygania testu, a twój plik wybiera jeden przez `resolution.kind`:

- **`dice-sum`**: rzuć kośćmi, dodaj liczby z arkusza i osiągnij lub przekrocz trudność. Obejmuje systemy d20, systemy 2d6 plus cecha i wiele innych.
- **`dice-pool`**: rzuć liczbą kości wynikającą z postaci i policz te, które osiągnęły próg. Obejmuje systemy, w których wartość oznacza garść kości zamiast premii.
- **`dice-highest`**: rzuć pulą i odczytaj jej najwyższą kość albo dodaj kilka najwyższych. Obejmuje Blades in the Dark i Trophy Dark.
- **`roll-against`**: rzuć wynik równy liczbie z arkusza lub niższy (albo wyższy). Obejmuje umiejętności procentowe i testy GURPS.
- **`symbol-pool`**: zbuduj i ulepsz kości narracyjne, a potem anuluj przeciwstawne symbole. Obejmuje testy Genesys, a od Capability API 1.382 także walki w tym systemie.

Wszystkie pięć rodzajów dokładnie opisuje sekcja [Rodzaje rozstrzygania](ruleset-checks.md#resolution-kinds).

Mechaniki, która nie pasuje do tych postaci, np. przeciwstawnych pul, nie da się zapisać w pliku zestawu zasad. Potrzebuje ona nowego rodzaju rozstrzygania wewnątrz Engine, czyli wkładu w kod z testami. Jeśli twój system go potrzebuje, zgłoś prośbę o funkcję w repozytorium Engine i opisz mechanikę kilkoma w pełni rozpisanymi rzutami. Te rzuty staną się testami.

Game Mode rozstrzyga walkę albo własnym systemem walki Marinara, albo według zasad twojego zestawu. Opcjonalny blok `battle` przekazuje walce Marinara liczby z arkuszy postaci: zobacz [Bitwy](ruleset-combat.md#battles-lending-the-sheet-to-marinaras-combat). Opcjonalny blok `combat` określa, jak zestaw zasad sam rozstrzyga walkę: zobacz [Walka](ruleset-combat.md#combat-a-fight-your-own-rules-resolve). Ustawienie Combat Preference (preferowany rodzaj walki) gry wybiera prezentację Classic lub, gdy zestaw zasad definiuje odległość, pole bitwy Tactical. Zestaw zasad może ograniczyć, których z nich używają jego gry, przez `combat.styles` (zobacz [Które style może wykorzystywać gra](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)).

<a id="parts-of-the-file"></a>

## Części pliku

| Klucz | Zawartość |
| --- | --- |
| `schemaVersion` | Zawsze `1`. |
| `id`, `version` | Nazwa zestawu dla Engine i liczba całkowita zwiększana przy każdej publikacji zmian. |
| `name` | To, co gracze widzą w kreatorze konfiguracji. |
| `edition` | Opcjonalne. Jedna linia określająca wydanie lub szkic. |
| `license` | Opcjonalne. Identyfikator SPDX i wymagany przez źródło tekst uznania autorstwa. |
| `coverage` | Zakres zestawu i jednoliniowy opis widoczny w kreatorze konfiguracji. |
| `resolution` | Sposób rzutu testu lub rzutu obronnego. |
| `sheet` | Cała zawartość arkusza postaci. |
| `rests` | Co odnawia i usuwa każdy rodzaj odpoczynku. |
| `gm` | Tekst dla modelu mistrza gry i wartości arkusza, które widzi on dla każdej postaci. |
| `catalogs` | Opcjonalne. Gotowe wpisy oferowane przez edytor arkusza, aby gracze nie przepisywali długich list. |
| `items` | Opcjonalne. Słowa, którymi opisuje się twoje przedmioty: kategorie, rzadkości, statystyki, miejsca, pieniądze. |
| `battle` | Opcjonalne. Dane, które bitwa może odczytać z arkusza i zapisać po zakończeniu. |
| `combat` | Opcjonalne. Sposób rozstrzygania walki według własnych zasad i to, co pokazuje ekran bitwy. |
| `layers` | Opcjonalne. Warianty zestawu włączane przez gracza przy tworzeniu gry. |

Plik może mieć do 512 KB (256 KB przed Capability API 1.340). Tekst trafiający do promptu (nazwy, etykiety, tekst mistrza gry) nie może zawierać nowych linii, nawiasów kwadratowych ani podwójnych klamer.

Identyfikatory w arkuszu (atrybutów, umiejętności, pól, pul itd.) zaczynają się literą i zawierają małe litery, cyfry oraz podkreślenia, np. `grit_max`.

<a id="reference-pages"></a>

## Strony referencyjne

Ta strona opisuje tworzenie, wypróbowanie i udostępnianie zestawu zasad. Każda z pozostałych stron omawia jeden temat:

- [Testy zestawu zasad](ruleset-checks.md): pięć rodzajów rozstrzygania, przedziały wyników, testy rzucane na własny sposób oraz wydawanie zasobów lub talizmany zmieniające rzut.
- [Arkusze zestawu zasad](ruleset-sheets.md): atrybuty, umiejętności, pola i listy, stany bieżące, tory ran, kary, odpoczynki, tekst mistrza gry, arkusz drużyny i zegary postępu.
- [Katalogi zestawu zasad](ruleset-catalogs.md): gotowe wpisy oferowane przez edytor arkusza w selektorze.
- [Mechanika wpisów zestawu zasad](ruleset-mechanics.md): blok `mechanics` wpisu katalogu, odczytywany przez testy, odpoczynki i walki.
- [Kreator postaci zestawu zasad](ruleset-character-builder.md): tworzenie postaci krok po kroku, od rasy i klasy po wyniki, biegłości, zaklęcia i sprzęt.
- [Przedmioty zestawu zasad](ruleset-items.md): kategorie, broń, pancerz, amunicja, łupy, pieniądze, początkowy sprzęt i targi.
- [Walka według zestawu zasad](ruleset-combat.md): blok `battle` i blok `combat`, z bestiariuszem, planszą, reakcjami i testami przeciwstawnymi.
- [Warstwy, tłumaczenia i migracje zestawu zasad](ruleset-layers-and-translations.md): warianty włączane przez gracza dla jednej gry, tłumaczenia i przenoszenie wartości do nowych identyfikatorów przy zmianie arkusza.

<a id="try-your-ruleset"></a>

## Wypróbowanie zestawu zasad

Zanim zaczniesz, włącz **Allow custom Agent imports** (zezwolenie na import własnych agentów) w **Settings → Advanced → Danger Zone** (ustawienia, zaawansowane, strefa zagrożenia). Importowane zestawy zasad używają tego samego przełącznika bezpieczeństwa co importowani agenci, więc jest on wyłączony, dopóki go nie włączysz. Import wymaga też dostępu przez localhost albo sekretu administratora: **Settings → Advanced → Admin Access** (ustawienia, zaawansowane, dostęp administracyjny).

1. Otwórz panel **Agents** (agenci) i wybierz przycisk **Import agents** (import agentów, ikona pobierania w rzędzie przycisków u góry panelu).
2. Wybierz **Game Mode ruleset** (zestaw zasad trybu Game Mode) i swój plik JSON albo plik pakietu zestawu zasad z końcówką `.ruleset.json` (zobacz [Udostępnianie zestawu zasad](#sharing-your-ruleset)).
3. Przeczytaj podgląd. Pokazuje nazwę, wersję, licencję, zakres zestawu zasad i tekst mistrza gry. Wybierz **Import** (import).

Twój zestaw zasad pojawi się w sekcji **Rules** panelu oraz w wyborze **Rules** kreatora konfiguracji nowych gier. Zestaw zasad zaimportowany z pliku jest zapisywany jako `local/<your id>`, więc nigdy nie zostanie pomylony z oficjalnym zestawem zasad ani z cudzym.

### Zmiana już zaimportowanego zestawu zasad

Zaimportowana wersja nigdy nie jest nadpisywana. Jeśli zaimportujesz zmieniony plik z tym samym `version`, import zostanie odrzucony z prośbą o zwiększenie numeru. Gra jest związana z dokładną wersją, na której ją utworzono, więc trwająca kampania nigdy nie zmienia swojej matematyki.

Podczas tworzenia cykl wygląda tak: edytuj, zwiększ `version`, zaimportuj, rozpocznij nową grę. Stare wersje pozostają zainstalowane obok nowej, dopóki nie usuniesz zestawu zasad z sekcji **Rules**. Usunięcie zestawu zasad, którego gra nadal używa, sprawia, że ta gra zgłasza jego brak aż do ponownego importu.

Jeśli zmienisz kształt arkusza (dodasz, usuniesz lub zmienisz nazwy elementów), zwiększ też `sheet.version`. Istniejące arkusze są odczytywane tolerancyjnie: wartości nieznane nowemu arkuszowi zostają zachowane, a brakujące otrzymują wartości domyślne.

<a id="sharing-your-ruleset"></a>

## Udostępnianie zestawu zasad

Zestaw zasad można udostępnić na pięć sposobów.

### Jako plik

Wyślij plik JSON znajomemu. Zaimportuje go tak samo jak ty.

### Jako plik pakietu

Zestaw zasad zbyt duży na jeden plik, z katalogami we własnych plikach, przenosi się jako jeden zwykły plik JSON o nazwie `<name>.ruleset.json`. Zawiera manifest pakietu i dokumenty zestawu zasad, każdy zapisany w base64 (sposobie zapisania pliku jako zwykłego tekstu):

```json
{
  "format": "marinara-ruleset",
  "version": 1,
  "manifest": { "kind": ["ruleset"], "…": "the package manifest" },
  "files": {
    "ruleset.json": "<base64>",
    "catalogs/spells.json": "<base64>"
  }
}
```

Manifest wymienia `ruleset.json` i każdy `catalogs/<id>.json` w `contributions.assets.paths` oraz w `files`, z rozmiarem i sha256 (odciskiem pliku) każdego z nich. Tworzy go edytor zestawów zasad, np. Pixelforge. **Import agents** → **Game Mode ruleset** przyjmuje plik i pokazuje ten sam podgląd co dla pliku zestawu zasad, z każdym katalogiem i liczbą jego wpisów.

Plik jest odczytywany jako dane i nigdy nie jest instalowany jako pakiet. Nic w nim nie jest skompresowane, więc nigdy nie zawiera więcej niż własny rozmiar. Limity:

- Jest zapisywany jako `local/<its id>`, tak jak plik zestawu zasad.
- Ma najwyżej 132 MB, najwyżej 12 plików katalogów po 2 MB każdy i 40 tłumaczeń po 8 MB każde (zobacz niżej).
- Wersja to zestaw zasad razem z katalogami, więc zmieniony katalog także wymaga wyższego `version`.
- Pakiety zestawów zasad nie są przyjmowane jako archiwa zip.

Plik zostaje odrzucony, z podaniem powodu, jeśli:

- zawiera inny klucz lub jakikolwiek inny plik albo dokument, który nie jest ściśle zakodowany w base64 lub nie jest tekstem UTF-8;
- jego manifest żąda więcej, niż potrzebuje zestaw zasad (jakiegokolwiek kodu, uprawnień lub innych elementów);
- plik nie jest tym, który wymienia manifest;
- `$comment` jest dłuższy niż 2 000 znaków albo `$schema` wskazuje cokolwiek poza własnym schematem Engine;
- zestawu zasad lub katalogu nie da się odczytać.

### Przez oficjalny katalog agentów

Zestaw zasad opublikowany w katalogu to plik pakietu zestawu zasad dokładnie w tej postaci, `<id>.ruleset.json`, nigdy archiwum zip pakietu. Jego manifest deklaruje Capability API 1.374 lub nowsze, więc starszy Engine nigdy nie otrzymuje takiej oferty. Engine odczytuje go tym samym mechanizmem i sprawdza tak samo jak importowany plik pakietu, weryfikuje jego zgodność z manifestem wymienionym w katalogu i instaluje go jak każdy pakiet z katalogu. Zestaw zasad z katalogu, którego artefaktem jest archiwum zip, zostaje odrzucony przed pobraniem czegokolwiek; już zainstalowane zestawy zasad nadal działają.

### Z repozytorium GitHub

Jeśli przechowujesz pracę w publicznym repozytorium w serwisie GitHub, umieść każdy zestaw zasad w folderze `rulesets` w głównym katalogu repozytorium, po jednym pliku na zestaw:

```text
your-repository/
  agents.json        (optional, only if you also share agents)
  rulesets/
    ember-roads.json
    another-system.json
```

Użytkownik dodaje twoje repozytorium raz, przegląda jego zawartość i później je synchronizuje, żeby otrzymać nowe wersje. Lista własnych repozytoriów to zaawansowana funkcja. Osoba prowadząca serwer włącza ją przez `ENABLE_CUSTOM_AGENT_REPOS=true`, a potem otwiera **Agents → Agent Organizer → Custom Sources** (agenci, organizowanie agentów, własne źródła). Zestawy zasad z repozytorium są zapisywane pod nazwą właściciela repozytorium, np. `alice/ember-roads`, więc dwie różne osoby mogą opublikować zestaw zasad o nazwie `v20` bez kolizji.

Obowiązują dwa limity. Repozytorium może zawierać najwyżej 32 pliki JSON bezpośrednio w `rulesets`, a repozytorium z większą liczbą plików zostaje odrzucone. Konto o nazwie `local` nie może publikować zestawów zasad, ponieważ `local/` jest zarezerwowane dla zestawów zasad zaimportowanych z pliku.

### W oficjalnym katalogu

Popularny system z jasną licencją może być oferowany wszystkim przez **Agent Organizer**. Aby go zaproponować, otwórz pull request do repozytorium [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Układ można sprawdzić w tamtejszym pakiecie `ruleset-5e-2014`.

## Licencjonowanie

Publikuj tylko tekst zasad, który masz prawo udostępniać. Wiele systemów publikuje dokument referencyjny na otwartej licencji i właśnie z niego można kopiować. W `license` umieść identyfikator licencji (identyfikator SPDX, czyli krótką standardową nazwę, np. `CC-BY-4.0`) oraz wymagany przez nią tekst uznania autorstwa. Nie kopiuj tekstu z podręczników bez otwartej licencji. Zestaw zasad potrzebuje głównie nazw i liczb. Tekst mistrza gry napisz własnymi słowami.

<a id="troubleshooting"></a>

## Rozwiązywanie problemów

- **Import zgłasza, że nazwa nie istnieje.** Coś w pliku wskazuje niezadeklarowany identyfikator, np. umiejętność wskazującą usunięty atrybut. Komunikat podaje ścieżkę do wiersza.
- **Import zgłasza, że wersja jest już zainstalowana z inną zawartością.** Zwiększ `version` i zaimportuj ponownie.
- **Mojego zestawu zasad nie ma w kreatorze konfiguracji.** Sprawdź, czy **Allow custom Agent imports** jest włączone. Gdy jest wyłączone, importowane zestawy zasad są pomijane w nowych grach, a gry, które już ich używają, nadal działają.
- **Gra zgłasza brak zestawu zasad.** Dokładna wersja, na której utworzono grę, nie jest zainstalowana. Zaimportuj ponownie tę wersję pliku.
