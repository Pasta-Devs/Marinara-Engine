# LTX Storyboard: generowanie wideo z obrazu

Status: uproszczenie w trakcie lokalnego przeglądu.

## Problem

Pierwsza integracja LTX Director Storyboard w aplikacji Marinara Engine dzieliła każde zaplanowane ujęcie na jeden stały prompt globalny (prompt to tekst, który Marinara wysyła do AI) i kilka promptów lokalnych rozdzielonych pionową kreską. Ścieżka Storyboard rozpoznawała następnie identyfikatory wbudowanych szablonów i omijała zwykły kontrakt promptu wideo, żeby złożyć ładunek danych specyficzny dla LTX.

Przez to dostosowywanie promptów zaskakiwało: skopiowanie lub edycja wbudowanego szablonu zmieniały jego identyfikator i po cichu wyłączały to specjalne przekazanie danych. Taki układ zachęcał też planer do rozrzucania zbyt wielu akcji po krótkim klipie. Kiedy planowanie się nie udało, ogólny zapasowy storyboard mógł przekazać do generowania wideo duży fragment surowej narracji, co dawało przeciążone prompty widoczne w logach działającego serwera.

Sprawdzony lokalnie workflow ComfyUI nie potrzebuje tej warstwy promptów rozłożonych w czasie. LTX 2.3 potrafi ożywić przekazaną pierwszą klatkę na podstawie jednego bezpośredniego promptu wideo z obrazu.

## Decyzja produktowa

Zachowaj dotychczasowe identyfikatory szablonów włączanych ręcznie oraz kontrolki w ustawieniach, żeby zapisane czaty dalej działały, ale uprość ich kontrakt:

- Szablon **LTX Director Storyboard** (planowanie ujęć) planuje pierwszą klatkę i jeden kompletny prompt LTX 2.3 do wygenerowania wideo z obrazu dla każdego ujęcia.
- Szablon **Storyboard First Frame** (pierwsza klatka storyboardu) opisuje dokładną ilustrację w chwili T=0, która służy jako obraz referencyjny.
- Szablon **Narration Passthrough** (prompt wideo) zawiera wyłącznie `${narrationSummary}`, więc przekazuje gotowy prompt planera tą samą uniwersalną ścieżką szablonu wideo, z której korzysta każdy inny workflow.

Ścieżka Storyboard nie może sprawdzać tych identyfikatorów szablonów, tworzyć lokalnych segmentów ani doklejać ładunku promptu specyficznego dla LTX. Wybrany szablon wideo pozostaje w pełni edytowalny.

## Kontrakt planera

Zachowaj dotychczasowy kształt danych Storyboard w formacie JSON:

- Pole `imagePrompt` opisuje wyłącznie dokładną pierwszą klatkę w chwili T=0.
- Pole `narrationBeat` to kompletny prompt wysyłany do modelu wideo razem z tym obrazem.
- kotwice sekcji i pole `characters` zachowują dotychczasowe znaczenie.

Dla każdego pola `narrationBeat` trzymaj się oficjalnego [przewodnika po generowaniu wideo z obrazu w LTX](https://docs.ltx.io/open-source-model/usage-guides/image-to-video) oraz [przewodnika po pisaniu promptów](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide):

- napisz jeden płynny akapit w czasie teraźniejszym: około 2-4 krótkich zdań na 1-6 sekund, 3-5 na 7-10 sekund i 4-8 na 11-15 sekund, ale tylko wtedy, gdy akcja uzasadnia taki poziom szczegółów;
- zacznij od stanu pokazanego w polu `imagePrompt` i opisz, co dzieje się dalej;
- przy 1-6 sekundach użyj jednej głównej akcji i jednego ustawienia kamery, przy 7-10 sekundach najwyżej dwóch powiązanych faz i ustawień, a przy 11-15 sekundach najwyżej trzech;
- opisuj ruch kamery względem filmowanej postaci lub obiektu, a kąt zmieniaj tylko wtedy, gdy długość ujęcia pozwala wyraźnie pokazać przejście;
- reakcje pokazuj przez widoczną mimikę, spojrzenie, postawę, oddech lub gesty;
- dodaj powściągliwy ruch otoczenia oraz pasujący dźwięk lub krótką kwestię dialogu w cudzysłowie;
- zakończ momentem, w którym akcja się dopełnia, wycisza albo zatrzymuje;
- wygląd statyczny, kompozycję, miejsce akcji, oświetlenie, paletę barw, teksturę i styl zostaw obrazowi źródłowemu;
- unikaj zmian sceny, nowych postaci i obiektów, przeładowanej akcji, złożonej fizyki, czytelnego tekstu, elementów interfejsu, wymyślonych wydarzeń oraz każdego cięcia i ruchu kamery, który nie zmieści się wyraźnie w czasie trwania ujęcia.

Zacznij od prostego opisu. Cztery zdania wystarczą, jeśli w pełni wyreżyserują ujęcie; planer nie może rozdymać prostej akcji tylko po to, żeby dodać ruch.

Przykład:

```text
She opens the door and walks outside as the camera follows behind her. A light breeze moves her hair. She glances toward the street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

## Przepływ danych

1. Planer zwraca dla każdego ujęcia jedno pole `imagePrompt` dla chwili T=0 i jedno kompletne pole `narrationBeat`.
2. Generowanie obrazów w Storyboard tworzy ilustrację referencyjną pierwszej klatki.
3. Szablon Narration Passthrough podstawia pod `${narrationSummary}` pole `narrationBeat` tego ujęcia.
4. Zwykłe żądanie generowania wideo niesie wynik w dotychczasowym polu `prompt`.
5. Adapter ComfyUI podmienia `%prompt%` w zapisanym workflow i przekazuje dotychczasowy obraz referencyjny, wymiary, czas trwania, liczbę klatek, ziarno losowe oraz wartości modelu.

W tym przepływie ścieżka Storyboard nie rozgałęzia się osobno dla LTX.

## Kontrakt ComfyUI

Korzystaj ze sprawdzonego workflow LTX 2.3 do generowania wideo z obrazu, z normalnymi symbolami zastępczymi aplikacji Marinara Engine. Wejścia węzła Director powinny wyglądać tak:

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

Zostaw `%reference_image_name%`, `%duration_seconds%`, `%length%`, `%width%`, `%height%`, `%seed%` i `%model%` tam, gdzie workflow już się ich spodziewa. Żądanie sześciosekundowe to nadal 96 klatek, zgodnie z dotychczasowym kontraktem 16 FPS w aplikacji Marinara Engine.

Starsze zapisane workflow z `%global_prompt%`, `%local_prompts%` i `%segment_lengths%` pozostają zgodne: adapter przypisuje zwykły prompt z żądania do wartości globalnej, a prompty lokalne i długości segmentów zostawia puste. Te symbole zastępcze są tylko wsparciem zgodności, a nie zalecaną konfiguracją Storyboard.

## Zachowanie przy błędach

- Jeśli klient się rozłączy albo planer przerwie pracę, przekaż anulowanie dalej. Nie generuj wtedy zastępczych materiałów.
- Jeśli planer naprawdę zawiedzie, zapasowy planer może zachować dotychczasowe działanie dla obrazów statycznych, ale generowanie wideo dla tego żądania trzeba pominąć. Surowa narracja nie jest bezpiecznym promptem do generowania wideo z obrazu.
- Sprawdzony storyboard dostarczony przez klienta nadal kwalifikuje się do generowania wideo, bo jego prompt przeszedł już weryfikację wcześniej.

## Zakres

Ta zmiana nie dodaje drugiego przebiegu modelu wizyjnego po wygenerowanym obrazie referencyjnym. Planer reżyseruje już zarówno pierwszą klatkę, jak i jej bezpośredni ruch, a sam obraz warunkuje model LTX w czasie generowania. Późniejsze przepisanie promptu z uwzględnieniem obrazu można ocenić osobno, jeśli odchylenia pierwszej klatki okażą się duże.

Nie trzeba nic zmieniać w interfejsie klienta, tłumaczeniach, schemacie danych, migracjach, wersji, restarcie usługi ani w repozytorium Marinara-Agents.

## Kryteria akceptacji

- Planer LTX Storyboard prosi o jeden kompletny prompt wideo z obrazu, dopasowany do czasu trwania, z czytelnymi fazami akcji, opisem kamery względem obiektu oraz opcjonalnym dźwiękiem lub dialogiem.
- Szablon Narration Passthrough zawiera dokładnie `${narrationSummary}`.
- Ścieżka Storyboard nie ma obejścia opartego na dokładnym identyfikatorze szablonu, funkcji czyszczącej prompty lokalne ani przekazania danych specyficznego dla LTX.
- Workflow z `global_prompt: "%prompt%"` dostaje kompletny prompt planera, a pola `local_prompts` i `segment_lengths` zostają puste.
- Istniejące workflow z `%global_prompt%` nadal dostają zwykły prompt z żądania jako rozwiązanie zgodnościowe.
- Anulowanie planera zatrzymuje operację, a prawdziwe planowanie zapasowe pomija generowanie wideo.
- Gotową poprawkę pokrywają `pnpm regression:prompt`, `pnpm check` oraz `git diff --check`.
