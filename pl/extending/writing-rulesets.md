# Pisanie zestawów zasad Game Mode

Zestaw zasad mówi trybowi Game Mode, jak działa system stołowy: jakie kości rzuca test, co znajduje się w arkuszu postaci, jakie zasoby są wydawane i co odnawia odpoczynek. Ten przewodnik jest dla osób chcących napisać i udostępnić własny zestaw. Jeśli chcesz grać z zestawem kogoś innego, zacznij od [Gry z zestawem zasad](../game/rulesets.md).

Zestaw zasad jest jednym plikiem JSON. Zawiera dane, nie kod. Nic się w nim nie wykonuje, więc import nie może niczego zrobić z twoim komputerem. Przed importem cudzego pliku dokładnie przeczytaj tekst Game Master: trafia do modelu w każdej grze używającej zestawu.

## Najpierw przeczytaj: co zestaw zasad może, a czego nie może

Zestaw może jedynie uzupełniać mechanikę, którą Engine już zna. Obecnie Engine zna pięć sposobów rozstrzygania testu; plik wybiera jeden przez `resolution.kind`:

- **`dice-sum`**: rzuć kośćmi, dodaj liczby z arkusza i osiągnij lub przekrocz trudność. Obejmuje systemy d20, systemy 2d6 plus cecha i wiele innych.
- **`dice-pool`**: rzuć liczbą kości wynikającą z postaci i policz te, które osiągnęły próg. Obejmuje systemy, w których wartość oznacza garść kości zamiast premii.

- **`dice-highest`**: rzuć pulą i odczytaj jej najwyższą kość albo dodaj kilka najwyższych. Obejmuje Blades in the Dark i Trophy Dark.
- **`roll-against`**: rzuć wynik równy liczbie z arkusza lub niższy (albo wyższy). Obejmuje umiejętności procentowe i testy GURPS.
- **`symbol-pool`**: zbuduj i ulepsz kości narracyjne, a potem anuluj przeciwstawne symbole. Obejmuje testy Genesys, a od Capability API 1.382 także walki w tym systemie.

Wszystkie pięć rodzajów dokładnie opisuje sekcja [Rodzaje rozstrzygania](ruleset-checks.md#resolution-kinds).

Mechaniki niepasującej do żadnej z tych postaci nie da się zapisać w pliku zestawu. Przykładem są przeciwstawne pule. Każda taka mechanika wymaga nowego rodzaju rozstrzygania w Engine, czyli wkładu w kod z testami, nie pliku JSON. Jeśli twój system go potrzebuje, zgłoś prośbę o funkcję w repozytorium Engine i opisz mechanikę kilkoma w pełni rozpisanymi rzutami. Te przykłady staną się testami.

Game Mode może rozstrzygać walkę według własnych zasad Marinara albo twojego zestawu. Opcjonalny blok `battle` przekazuje walce Marinara liczby z arkuszy postaci: zobacz [Bitwy](ruleset-combat.md#battles-lending-the-sheet-to-marinaras-combat). Opcjonalny `combat` zamiast tego definiuje rozstrzyganie walki według zestawu: zobacz [Walkę](ruleset-combat.md#combat-a-fight-your-own-rules-resolve). Engine już stosuje te zasady. Ustawienie Combat Preference (preferowany rodzaj walki) gry wybiera prezentację Classic lub, gdy zestaw definiuje odległość, pole bitwy Tactical. Zestaw zasad może ograniczyć dostępne w swoich grach style przez `combat.styles` (zobacz [Które style może wykorzystywać gra](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)).

## Szybki start

1. Skopiuj przykład pasujący do rzutów twojego systemu. [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json) to niewielki system 2d6 z trzema cechami, pokazujący, że format nie zakłada d20 ani sześciu atrybutów. [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json) to mała pula kości dziesięciościennych z trzema cechami i sześcioma umiejętnościami zawodowymi. Pełnowymiarowy przykład znajdziesz w oficjalnym [pakiecie 5e (SRD 5.1)](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014): jego `ruleset.json` i `catalogs/` to pliki instalowane przez Agent Organizer.
2. Zmień `id` na własne. Identyfikator zawiera małe litery, cyfry i pojedyncze łączniki, np. `ember-roads`.
3. Edytuj arkusz, odpoczynki i tekst Game Master.
4. Zaimportuj plik (zobacz [Wypróbowanie zestawu](#trying-your-ruleset)). Import sprawdza cały plik i wskazuje błędy wiersz po wierszu, zanim cokolwiek zapisze.
5. Utwórz nową grę, wybierz zestaw w **Rules** (zasady) i wykonaj kilka testów.

Aby uzyskać pomoc podczas pisania, wskaż edytorowi JSON Schema, dodając tę pierwszą linię wewnątrz zewnętrznych klamer pliku:

```json
"$schema": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json",
```

Schemat podczas pisania wyłapuje błędne nazwy kluczy i typy. Nie sprawdza, czy nazwy w pliku wskazują istniejące rzeczy, np. czy umiejętność podaje istniejący atrybut. Robi to import.

Do dowolnego obiektu pliku możesz dodać linię `"$comment": "..."` z własną notatką. Engine ją ignoruje.

## Części pliku

| Klucz | Zawartość |
| --- | --- |
| `schemaVersion` | Zawsze `1`. |
| `id`, `version` | Nazwa zestawu dla Engine i liczba całkowita zwiększana przy każdej publikacji zmian. |
| `name` | To, co gracze widzą w kreatorze konfiguracji. |
| `edition` | Opcjonalne. Jedna linia określająca wydanie lub szkic. |
| `license` | Opcjonalne. Identyfikator SPDX i wymagany przez źródło tekst uznania autorstwa. |
| `coverage` | Zakres zestawu i jednoliniowy opis widoczny w kreatorze. |
| `resolution` | Sposób rzutu testu lub rzutu obronnego. |
| `sheet` | Cała zawartość arkusza postaci. |
| `rests` | Co odnawia i usuwa każdy rodzaj odpoczynku. |
| `gm` | Tekst dla modelu Game Master i wartości arkusza widoczne dla każdej postaci. |
| `catalogs` | Opcjonalne. Gotowe wpisy oferowane przez edytor arkusza, aby gracze nie przepisywali długich list. |
| `items` | Opcjonalne. Słowa, którymi opisuje się twoje przedmioty: kategorie, rzadkości, statystyki, miejsca, pieniądze. |
| `battle` | Opcjonalne. Dane, które bitwa może odczytać z arkusza i zapisać po zakończeniu. |
| `combat` | Opcjonalne. Sposób rozstrzygania walki według własnych zasad i to, co pokazuje ekran bitwy. |
| `layers` | Opcjonalne. Warianty zestawu włączane przez gracza przy tworzeniu gry. |

Plik może mieć do 512 KB (256 KB przed Capability API 1.340). Tekst trafiający do promptu (nazwy, etykiety, tekst Game Master) nie może zawierać nowych linii, nawiasów kwadratowych ani podwójnych klamer.

Identyfikatory w arkuszu (atrybutów, umiejętności, pól, pul itd.) zaczynają się literą i zawierają małe litery, cyfry oraz podkreślenia, np. `grit_max`.

## Strony tego przewodnika

Ta strona wyjaśnia, czym jest zestaw zasad, jak zacząć go tworzyć oraz jak go wypróbować i udostępnić. Reszta przewodnika jest podzielona według tematów:

- [Testy zestawu zasad](ruleset-checks.md): Jak zestaw zasad wykonuje rzut w teście lub rzucie obronnym: pięć rodzajów rozstrzygania, przedziały wyników, testy rzucane na własny sposób oraz wydawanie zasobów lub talizmany zmieniające rzut
- [Arkusze zestawu zasad](ruleset-sheets.md): Co znajduje się w arkuszu postaci zestawu zasad: atrybuty, umiejętności, pola i listy, stany bieżące, tory ran, kary, odpoczynki i tekst mistrza gry, a także arkusz drużyny i zegary postępu
- [Katalogi zestawu zasad](ruleset-catalogs.md): Gotowe wpisy oferowane przez edytor arkusza postaci w selektorze: nagłówek katalogu, wpisy, wartości utrzymywane przez zestaw zasad, polecenia arkusza postaci i polecenie użycia
- [Mechanika wpisów zestawu zasad](ruleset-mechanics.md): Co wpis katalogu robi w liczbach: blok `mechanics` wpisu, odczytywany przez testy, odpoczynki i walki
- [Kreator postaci zestawu zasad](ruleset-character-builder.md): Prowadzony kreator: tworzenie postaci krok po kroku, od rasy i klasy po wyniki, biegłości, zaklęcia i sprzęt
- [Przedmioty zestawu zasad](ruleset-items.md): Co nosi drużyna: kategorie, broń, pancerz, amunicja, łupy, pieniądze, początkowy sprzęt i targi
- [Walka według zestawu zasad](ruleset-combat.md): Jak zestaw zasad uczestniczy w walce: blok `battle`, który udostępnia arkusz postaci systemowi walki aplikacji Marinara Engine, oraz blok `combat`, który rozstrzyga całą walkę według własnych reguł zestawu zasad, z jego bestiariuszem, planszą, reakcjami i testami przeciwstawnymi
- [Warstwy, tłumaczenia i migracje zestawu zasad](ruleset-layers-and-translations.md): Warianty włączane przez gracza dla jednej gry, tłumaczenia tekstu zestawu zasad i przenoszenie wartości do nowych identyfikatorów przy zmianie arkusza postaci

<a id="trying-your-ruleset"></a>

## Wypróbowanie zestawu zasad

Zestawy zasad społeczności używają tego samego przełącznika co importowani agenci. Otwórz **Settings** (ustawienia) > **Advanced** (zaawansowane) > **Danger Zone** (strefa niebezpieczna) i upewnij się, że **Allow custom Agent imports** (zezwalaj na import własnych agentów) jest włączone. Import wymaga też dostępu przez localhost lub skonfigurowanego **Admin Access** (dostępu administratora).

1. Otwórz panel **Agents** i wybierz przycisk **Import agents** (importuj agentów; ikona pobierania w rzędzie przycisków u góry panelu).
2. Wybierz **Game Mode ruleset** (zestaw zasad trybu Game) i swój plik JSON albo plik pakietu zestawu zasad z końcówką `.ruleset.json` (zobacz [Udostępnianie zestawu zasad](#sharing-your-ruleset)).
3. Przeczytaj podgląd. Pokazuje nazwę, wersję, licencję, zakres obsługi zestawu zasad i tekst Mistrza Gry. Wybierz **Import** (importuj).

Twój zestaw zasad pojawi się w sekcji **Rules** (zasady) panelu oraz w wyborze **Rules** kreatora nowych gier. Zestaw importowany z pliku jest zapisywany jako `local/<your id>`, więc nie można pomylić go z oficjalnym zestawem ani z cudzym.

### Zmiana już zaimportowanego zestawu zasad

Zaimportowana wersja nigdy nie jest nadpisywana. Jeśli zmienisz plik i zaimportujesz go ponownie z tym samym `version`, import zostanie odrzucony z prośbą o zwiększenie numeru. To celowe: gra jest związana z dokładną wersją, na której ją utworzono, więc trwająca kampania nigdy nie obudzi się z inną matematyką.

Cykl podczas tworzenia wygląda więc tak: edytuj, zwiększ `version`, importuj, rozpocznij nową grę. Stare wersje pozostają zainstalowane obok nowej, dopóki nie usuniesz zestawu z sekcji **Rules**. Usunięcie zestawu nadal używanego przez grę sprawia, że gra zgłasza jego brak aż do ponownego importu.

Jeśli zmienisz kształt karty (dodasz, usuniesz lub zmienisz nazwy elementów), zwiększ też `sheet.version`. Istniejące karty są odczytywane tolerancyjnie: wartości nieznane nowej karcie zostają zachowane, a brakujące otrzymują wartości domyślne.

<a id="sharing-your-ruleset"></a>

## Udostępnianie zestawu zasad

**Jako plik.** Wyślij znajomemu plik JSON. Zaimportuje go tak samo jak ty.

**Jako plik pakietu.** Zestaw zasad zbyt duży na jeden plik, z katalogami we własnych plikach, przenosi się jako jeden zwykły plik JSON o nazwie `<name>.ruleset.json`. Zawiera manifest pakietu i dokumenty zestawu, każdy jako dokładne bajty zakodowane w base64:

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

Manifest wymienia `ruleset.json` i każdy `catalogs/<id>.json` w `contributions.assets.paths` oraz w `files`, z rozmiarem i sha256 każdego z nich. Tworzy go edytor zestawów zasad, np. Pixelforge. **Import agents** → **Game Mode ruleset** przyjmuje plik i pokazuje ten sam podgląd co dla pliku zestawu zasad, z każdym katalogiem i liczbą jego wpisów. Nic w nim nie jest skompresowane, więc nigdy nie zawiera więcej niż własny rozmiar. Jest odczytywany jako dane i nigdy nie jest instalowany jako pakiet: zostaje odrzucony, z podaniem powodu, jeśli zawiera cokolwiek innego (inny klucz, jakikolwiek inny plik, dokument, który nie jest ściśle zakodowany w base64 lub nie jest tekstem UTF-8), jeśli jego manifest zawiera więcej niż zestaw zasad (jakikolwiek kod, uprawnienia lub inne elementy), jeśli plik nie jest tym, który wymienia manifest, jeśli `$comment` jest dłuższy niż 2 000 znaków albo `$schema` wskazuje cokolwiek poza własnym schematem Engine, albo jeśli zestawu zasad lub katalogu nie da się odczytać. Jest zapisywany jako `local/<its id>` tak jak plik zestawu zasad, ma najwyżej 132 MB i najwyżej 12 plików katalogów po 2 MB każdy oraz 40 tłumaczeń po 8 MB każde (zobacz niżej). Wersja to zestaw zasad razem z katalogami, więc zmieniony katalog także wymaga wyższego `version`. Pakiety zestawów zasad nie są przyjmowane jako archiwa zip.

**Przez oficjalny katalog agentów.** Zestaw zasad opublikowany w katalogu to plik pakietu zestawu zasad dokładnie w tej postaci, `<id>.ruleset.json`, nigdy archiwum zip pakietu (Capability API 1.374). Jego manifest deklaruje Capability API 1.374 lub nowsze, więc starszy Engine nigdy nie otrzymuje takiej oferty. Engine odczytuje go tym samym mechanizmem i sprawdza tak samo jak importowany plik pakietu, weryfikuje jego zgodność z manifestem wymienionym w katalogu i instaluje go jak każdy pakiet z katalogu. Zestaw zasad z katalogu, którego artefaktem jest archiwum zip, zostaje odrzucony przed pobraniem czegokolwiek; już zainstalowane zestawy nadal działają.

**Z repozytorium GitHub.** Jeśli przechowujesz pracę w publicznym repozytorium GitHub, umieść każdy zestaw zasad w folderze `rulesets` w głównym katalogu repozytorium, po jednym pliku na zestaw:

```text
your-repository/
  agents.json        (optional, only if you also share agents)
  rulesets/
    ember-roads.json
    another-system.json
```

Użytkownik dodaje twoje repozytorium raz przez listę własnych repozytoriów agentów, przegląda zawartość i może później synchronizować nowe wersje. Lista własnych repozytoriów to zaawansowana funkcja włączana przez osobę prowadzącą serwer za pomocą `ENABLE_CUSTOM_AGENT_REPOS=true`. Zestawy z repozytorium są zapisywane pod nazwą właściciela repozytorium, np. `alice/ember-roads`, więc dwóch autorów może opublikować zestaw `v20` bez kolizji.

Obowiązują dwa limity. Repozytorium może zawierać najwyżej 32 pliki JSON bezpośrednio w `rulesets`; większa liczba powoduje odrzucenie. Konto o nazwie `local` nie może publikować zestawów, ponieważ `local/` jest zarezerwowane dla importów z pliku.

**W oficjalnym katalogu.** Popularny system z jasną licencją może być oferowany wszystkim przez **Agent Organizer** (organizowanie agentów). Wymaga to pull requestu do repozytorium [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Układ można sprawdzić w tamtejszym pakiecie `ruleset-5e-2014`.

## Licencjonowanie

Publikuj tylko tekst zasad, który masz prawo udostępniać. Wiele systemów publikuje dokument referencyjny na otwartej licencji i właśnie z niego można kopiować. Umieść identyfikator licencji oraz wymagany przez nią tekst uznania autorstwa w `license`. Nie kopiuj tekstu z podręczników bez otwartej licencji. Zestaw zasad potrzebuje głównie nazw i liczb, a tekst Mistrza Gry powinien być napisany twoimi słowami.

## Rozwiązywanie problemów

- **Import mówi, że nazwa nie istnieje.** Coś w pliku wskazuje niezadeklarowany identyfikator, np. umiejętność wskazująca usuniętą cechę. Komunikat podaje ścieżkę do wiersza.
- **Import mówi, że wersja jest już zainstalowana z inną zawartością.** Zwiększ `version` i importuj ponownie.
- **Mojego zestawu zasad nie ma w kreatorze.** Sprawdź, czy **Allow custom Agent imports** jest włączone. Gdy jest wyłączone, importowane zestawy nie są dostępne dla nowych gier. Gry już ich używające nadal działają.
- **Gra mówi, że brakuje zestawu zasad.** Dokładna wersja, na której utworzono grę, nie jest zainstalowana. Zaimportuj ponownie tę wersję pliku.
