# Storyboardy LTX 2.3 w Game Mode

Ten przewodnik wyjaśnia, jak podłączyć lokalny workflow LTX 2.3 w ComfyUI (obraz do wideo) do storyboardów trybu Game Mode w aplikacji Marinara Engine. Część graczy mówi na to Story Mode; kontrolki w aplikacji Marinara noszą nazwy **Game Mode** i **Storyboards**.

Opisaną niżej konfigurację opracowano na generowaniu pierwszej klatki przez **Krea 2** oraz na stylu obrazu **Z-Image Turbo Narrative**, opartym na języku naturalnym. Inne połączenia obrazu też powinny działać, o ile przyjmują opisowe prompty scen w języku naturalnym. Renderowanie wideo LTX odbywa się lokalnie w ComfyUI; to, czy pierwsza klatka powstaje lokalnie, czy w chmurze, zależy od wybranego połączenia obrazu.

Gotowa ścieżka wygląda tak:

```text
GM narration
  -> Animation Planner
     -> imagePrompt -> image connection -> first-frame illustration
     -> narrationBeat -> Narration Passthrough -> %prompt%
  -> first frame + prompt -> ComfyUI LTX 2.3 workflow -> MP4 clip
```

Wygenerowana ilustracja jest pierwszą klatką filmu. Dzięki temu LTX dostaje jednocześnie wizualny punkt wyjścia i prompt skupiony na tym, co dzieje się dalej.

## Zanim zaczniesz

Potrzebne są:

1. Działająca lokalna instalacja ComfyUI, do której aplikacja Marinara Engine ma dostęp.
2. Edytowalny workflow `ltx-director-simple` albo równoważny graf LTX 2.3 obraz-do-wideo, który poprawnie kończy pracę w ComfyUI.
3. Eksport tego samego grafu w formacie API, czyli `ltx-director-simple-api`, przeznaczony dla połączenia w aplikacji Marinara Engine.
4. Połączenie generowania obrazów w aplikacji Marinara Engine, które tworzy ilustracje pierwszej klatki.
5. Agent **Storyboard** zainstalowany z **Agents > Download Agents** i włączony w grze w panelu **Chat Settings > Agents** (ustawienia czatu).

Edytowalny workflow ComfyUI i jego eksport API to dwa różne pliki. Otwórz `ltx-director-simple` w ComfyUI, zainstaluj każdy brakujący węzeł zgłoszony przez ComfyUI Manager i przetestuj graf na miejscu. Do połączenia w aplikacji Marinara Engine zaimportuj `ltx-director-simple-api`. Po każdej zmianie węzła lub modelu wyeksportuj graf ponownie w formacie API i podmień plik JSON zapisany w połączeniu. Nie wklejaj do aplikacji Marinara Engine zwykłego workflow z edytora wizualnego.

Ogólny proces eksportu i konfiguracji połączenia opisuje [Konfiguracja workflow w ComfyUI](../media/comfyui.md).

## Wybór modelu LTX 2.3

Format modelu dobierz do architektury karty graficznej i do pamięci, która zostaje po załadowaniu przez ComfyUI enkodera tekstu, modeli VAE i upscalera. Traktuj poniższe wskazania jako punkt wyjścia, a nie gwarancję, że każdy workflow zmieści się na każdej karcie.

| Rodzina GPU | Praktyczny punkt wyjścia | Uwagi |
| --- | --- | --- |
| RTX serii 30 (Ampere) | INT8 ConvRot | Wariant oszczędzający pamięć, przeznaczony dla kart klasy 3070, 3080 i 3090. |
| RTX serii 40 z 16-24 GB | FP8 input-scaled | Korzysta z przyspieszonej ścieżki FP8 dostępnej w układach generacji Ada. |
| RTX serii 40 z 8-12 GB | INT8 ConvRot, gdy przenoszenie danych przy FP8 jest zbyt wolne | Porównaj oba warianty na docelowym workflow; dostępna pamięć VRAM i sposób odciążania nadal mają znaczenie. |
| RTX serii 50 (Blackwell) | Workflow NVFP4 dev | Wymaga ComfyUI, CUDA i zestawu węzłów obsługujących NVFP4. |
| RTX serii 50 na istniejącym workflow distilled | FP8 input-scaled | Ta ścieżka zgodności wystarczy, dopóki nie pojawi się oficjalny checkpoint distilled w formacie NVFP4. |

Przetestowany workflow dla RTX 3080 używa:

```text
ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors
```

Te końcówki nazw opisują różne formaty kwantyzacji i ścieżki wykonania, a nie presety jakości, które da się dowolnie wymieniać:

- **INT8 ConvRot** to praktyczna, wypracowana przez społeczność ścieżka niskiej pamięci dla kart RTX serii 30 i słabszych kart Ada.
- **FP8 input-scaled** korzysta z przyspieszonych operacji macierzowych FP8, mniej więcej od RTX serii 40 wzwyż.
- **NVFP4** to czterobitowa ścieżka natywna dla architektury Blackwell, używana w workflow dla RTX serii 50.
- Workflow **dev** i **distilled** zakładają inny sposób próbkowania. Nie podstawiaj checkpointu dev do dołączonego grafu distilled bez dostosowania całego workflow.

Karta z 8 GB pamięci powinna zacząć pierwszy test integracji od rozdzielczości 480p i jednej klatki kluczowej. To, że checkpoint się mieści, nie oznacza jeszcze, że zmieści się dłuższe wideo albo wyższa rozdzielczość: pamięć zajmują też latenty wideo, enkoder tekstu, modele VAE, dźwięk i upscaling.

Oficjalny workflow dla początkujących składa się z tych elementów:

- `ltx-2.3-22b-dev-fp8.safetensors`
- `ltx-2.3-22b-distilled-lora-384.safetensors`
- `gemma_3_12B_it_fp4_mixed.safetensors`
- `ltx-2.3-spatial-upscaler-x2-1.1.safetensors`

Własne workflow mogą używać checkpointu distilled w wersji v1.1, kwantyzacji od innego autora, innych węzłów ładujących albo innych folderów z modelami. Nazwy plików zapisane w workflow API muszą dokładnie odpowiadać plikom, które widzi ComfyUI.

Oficjalne materiały:

- [Przewodnik LTX 2.3 obraz-do-wideo](https://docs.ltx.io/open-source-model/usage-guides/image-to-video)
- [Przewodnik po promptach LTX](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide)
- [Karta modelu LTX 2.3](https://huggingface.co/Lightricks/LTX-2.3)
- [Karta modelu LTX 2.3 NVFP4](https://huggingface.co/Lightricks/LTX-2.3-nvfp4)
- [Oficjalne przykłady LTX 2.3 dla ComfyUI](https://github.com/Lightricks/ComfyUI-LTXVideo/tree/master/example_workflows/2.3)
- [Społecznościowe wagi rozdzielone dla ComfyUI i wersje FP8](https://huggingface.co/Kijai/LTX2.3_comfy)

## Przygotowanie workflow API w ComfyUI

Najpierw uruchom edytowalny workflow bezpośrednio w ComfyUI, na prawdziwym obrazie źródłowym i prostym prompcie. Sprawdź, czy zapisuje plik MP4 z dźwiękiem, i dopiero potem przygotuj jego eksport API dla aplikacji Marinara Engine.

Prosta ścieżka w aplikacji Marinara Engine korzysta z jednego kompletnego promptu w globalnym wejściu promptu węzła LTX Director:

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

Węzeł LTX Director nadal może obsługiwać kondycjonowanie obrazem, dane prowadzące, dźwięk i dwa etapy próbkowania. Słowo "prosta" dotyczy wyłącznie umowy o prompt: Marinara wysyła jeden spójny akapit opisujący przejście z obrazu w wideo, a nie oś czasu Prompt Relay.

### Wymagane symbole zastępcze

W eksporcie API podmień odpowiednie wartości na symbole zastępcze aplikacji Marinara Engine, ujęte w cudzysłowy:

| Symbol zastępczy | Wstawiana wartość |
| --- | --- |
| `%prompt%` | Kompletny prompt przygotowany przez wybrany Storyboard Animation Planner i szablon wideo |
| `%reference_image_name%` | Obraz pierwszej klatki wgrany do ComfyUI |
| `%duration_seconds%` | Długość klipu storyboardu w sekundach |
| `%length%` | Ta sama długość przeliczona na klatki według umowy 16 FPS w aplikacji Marinara Engine |
| `%fps%` | Liczba klatek na sekundę, której Marinara używa dla klipu |
| `%width%`, `%height%` | Wymiary wynikające z rozdzielczości i proporcji obrazu ustawionych w połączeniu wideo |
| `%seed%` | Nowe losowe ziarno dla danego żądania |
| `%model%` | Opcjonalna wartość modelu z połączenia, gdy workflow nie ma modelu wpisanego na stałe w węźle ładującym |

Obraz referencyjny należy do tablicy `segments` wewnątrz `timeline_data` w węźle LTX Director. W workflow API `timeline_data` jest tekstowym zapisem JSON. Symbol `%length%` utrzymuje dynamiczną długość klipu przez `normalDurationFrames`, a segment obrazu referencyjnego w klatce zerowej celowo zachowuje własną, krótką i sztywną wartość `"length":16`:

```json
{
  "timeline_data": "{\"global_prompt\":\"\",\"normalStartFrame\":0,\"normalDurationFrames\":%length%,\"segments\":[{\"id\":\"marinara-reference\",\"start\":0,\"length\":16,\"prompt\":\"\",\"type\":\"image\",\"imageFile\":\"%reference_image_name%\",\"isEndFrame\":false}],\"motionSegments\":[],\"audioSegments\":[]}"
}
```

Nie wpisuj `%reference_image_name%` obok `timeline_data` ani w osobnym polu obrazu na najwyższym poziomie. Liczbę klatek, sekundy i liczbę klatek na sekundę powiąż z zewnętrznymi wejściami workflow przez `%length%`, `%duration_seconds%` i `%fps%`. Wartości liczbowe pokazywane w edytowalnym grafie ComfyUI nie są wartościami domyślnymi aplikacji Marinara Engine.

Tekstowe symbole zastępcze, takie jak `%reference_image_name%`, zostaw w cudzysłowach. Dokładne liczbowe wejścia węzłów mogą mieć `%length%`, `%duration_seconds%` i `%fps%` w cudzysłowach, bo Marinara zamienia je na liczby. Wewnątrz tekstowego zapisu `timeline_data` zostaw `%length%` bez cudzysłowów, dokładnie tak jak wyżej, żeby po odczytaniu osi czasu wartość była liczbą.

### Eksport po każdej zmianie

1. Uruchom edytowalny workflow w ComfyUI.
2. Sprawdź, czy bieżący graf tworzy odtwarzalny plik MP4.
3. Wybierz **Save (API Format)**, **Export (API)** albo **Export to API**.
4. Dodaj symbole zastępcze do nowego pliku JSON w formacie API albo potwierdź, że tam są.
5. Podmień workflow zapisany w połączeniu aplikacji Marinara Engine.

Jeśli usuniesz węzeł i dalej używasz starego eksportu API, w pliku mogą zostać odwołania do węzła, którego już nie ma. ComfyUI odrzuca wtedy żądanie, zanim zacznie się generowanie.

## Tworzenie połączenia wideo w aplikacji Marinara Engine

1. Otwórz sekcję **Settings** (Ustawienia), a potem **Connections** (Połączenia).
2. Dodaj połączenie typu **Video Generation**.
3. Wybierz **ComfyUI**.
4. Wpisz bazowy adres URL ComfyUI, zwykle `http://127.0.0.1:8188`, jeśli działa na tym samym komputerze.
5. Wklej kompletny workflow w formacie API w polu **ComfyUI Workflow**.
6. Na pierwszy test przy małej ilości pamięci VRAM ustaw domyślną długość sześciu sekund, proporcje **16:9** i rozdzielczość 480p.
7. Zapisz połączenie.

Test połączenia oparty tylko na tekście nie sprawdzi symbolu `%reference_image_name%`. Po zapisaniu połączenia zweryfikuj ścieżkę obraz-do-wideo na obrazie z galerii albo na storyboardzie.

## Konfiguracja czatu w trybie Game Mode

Otwórz czat w trybie Game Mode, przejdź do **Chat Settings** i wybierz zakładkę **Agents**. Zanim zaczniesz konfigurować sekcje opisane niżej, włącz przełączniki **Enable Agents** i **Enable Storyboards**. Prezentacja Storyboard Optimized z kreatora nowej gry nie włącza agenta.

### Illustrator

| Ustawienie | Zalecana wartość |
| --- | --- |
| **Game Illustrator** | On |
| **Image Connection** | **Krea 2** |
| **Image Style** | **Z-Image Turbo Narrative** |
| **Use Campaign Art Style** | Off |
| **Attach Card Appearance** | Off |
| **Send Avatar References** | Off dla tego przetestowanego workflow |

Animation Planner i tak dostaje kontekst wyglądu postaci z tury storyboardu, dlatego w tej konfiguracji **Attach Card Appearance** zostaje wyłączone: inaczej te same informacje trafiłyby ponownie do końcowego formatowania obrazu. Podobnie **Storyboard First Frame** nie powtarza wytycznych artystycznych kampanii wokół gotowej sceny T=0 przygotowanej przez planera.

Ustawienie **Send Avatar References** steruje obrazami referencyjnymi wysyłanymi do dostawcy obrazu pierwszej klatki, a nie wejściem pierwszej klatki w LTX. Gotową ilustrację storyboardu LTX dostaje przez `%reference_image_name%`. W tej przetestowanej konfiguracji z Krea zostaw referencje awatarów wyłączone, a włącz je osobno dopiero wtedy, gdy potwierdzisz, że wybrane połączenie obrazu je obsługuje i faktycznie na nich zyskuje.

Obraz pierwszej klatki bardzo mocno wpływa na jakość animacji. Powinien pokazywać dokładnie ten moment tuż przed planowanym ruchem, z wyraźnie widoczną postacią, trasą, dłońmi, drzwiami, rekwizytem albo celem.

### Scene Videos

| Ustawienie | Zalecana wartość |
| --- | --- |
| **Video Connection** | Połączenie LTX 2.3 w ComfyUI utworzone wyżej |
| **Game Video Prompt** | **Narration Passthrough** |

Ogólne ustawienie **Game Video Prompt** odpowiada za ręczne animacje w galerii i w sekcji Game Assets. Klipy storyboardu mogą mieć własny prompt, bez ruszania tych pozostałych animacji.

### Storyboards

Zacznij od takiego profilu:

| Ustawienie | Zalecana wartość początkowa |
| --- | --- |
| **Automatic Storyboard Illustrations** | On |
| **Automatic Storyboard Animations** | On |
| **Use NovelAI Character Prompts** | Off |
| **Keyframes per Turn** | zwykle 3; w pierwszym teście na karcie z 8 GB pamięci VRAM zacznij od 1 |
| **Animation Clip Duration** | 5 sekund |
| **Viewer Display** | Floating na czas testów |
| **Illustration Planner** | **Still Keyframes**; zostaje jako wariant zapasowy dla samych obrazów |
| **Animation Planner** | **LTX Simple Image-to-Video** |
| **Use Storyboard Template** | On |
| **Storyboard Illustration Prompt** | **Storyboard First Frame** |
| **Storyboard Video Prompt** | **Narration Passthrough** |

Zalecanym ustawieniem domyślnym jest **LTX Simple Image-to-Video**. Planuje jedną pierwszą klatkę gotową do animacji i jeden bezpośredni prompt ruchu długości 4–8 zdań. Stawia na jedną główną akcję, jedno zachowanie kamery, powściągliwy ruch otoczenia oraz pasujący dźwięk albo krótką kwestię dialogową.

Wariant **LTX Director Storyboard** pozostaje dostępny jako opcja zaawansowana. Daje bardziej szczegółową reżyserię uwzględniającą czas trwania oraz zasady ciągłości. Sięgnij po niego, gdy prosta ścieżka już działa stabilnie albo gdy dłuższy klip naprawdę potrzebuje kilku powiązanych faz. Oba planery korzystają z tej samej umowy workflow opartej na `%prompt%`.

Ustawienie **Illustration Planner: Still Keyframes** nie tworzy promptu dla Krea, gdy animacje są włączone. W trybie animacji oba wyjścia przygotowuje **LTX Simple Image-to-Video**: `imagePrompt` w języku naturalnym dla Krea oraz `narrationBeat` dla LTX. Still Keyframes zostaje wybrane tylko na potrzeby tur generowanych bez wideo.

Ustawienie **Storyboard First Frame** przekazuje do Krea kompletną scenę T=0 w języku naturalnym, przygotowaną przez Animation Planner, bez dokładania tytułu klatki kluczowej, etykiet promptu, powtórzonych opisów wyglądu ani wytycznych artystycznych kampanii. Zostaw **Use Storyboard Template** włączone, żeby ten formater faktycznie zadziałał.

Ustawienie **Narration Passthrough** jest celowo minimalne. Przekazuje gotowy `narrationBeat` z Animation Planner przez uniwersalną umowę promptu wideo, nie obudowując go kolejnym streszczeniem sceny.

Każda klatka kluczowa uruchamia jedno zadanie obrazu w Krea i jedno lokalne zadanie wideo w LTX. Trzy klatki kluczowe to więc trzy renderowania pierwszej klatki i trzy renderowania wideo. Na karcie z 8 GB pamięci VRAM zacznij od jednej klatki kluczowej w rozdzielczości 480p. Kiedy to się uda, przejdź do trzech klatek kluczowych i wyższych rozdzielczości.

## Pierwszy test

Weź zakończoną turę GM z jedną wyraźną akcją wizualną: otwarciem drzwi, spojrzeniem w stronę dźwięku, kilkoma krokami albo jedną krótką wypowiedzią.

1. Najszybciej sprawdzisz działanie przy małej pamięci VRAM, ustawiając tymczasowo **Keyframes per Turn** na 1 i zostawiając **Animation Clip Duration** na 5 sekundach. Normalny przetestowany profil ma 3 klatki kluczowe.
2. Oba automatyczne ustawienia storyboardu włącz dopiero wtedy, gdy bieżąca tura GM jest już zakończona.
3. Otwórz galerię i wybierz **Create storyboard** dla tej zakończonej tury GM. W ten sposób ręcznie uruchomisz pełną ścieżkę ilustracji i animacji, bez czekania na kolejną turę.
4. Jeśli podgląd promptów jest włączony, przejrzyj prompt pierwszej klatki przed wysłaniem.
5. Sprawdź, czy wygenerowana pierwsza klatka daje sensowną pozycję wyjściową dla ruchu.
6. Poczekaj na renderowanie pierwszej klatki, a potem na gotowy klip z ComfyUI.
7. Gdy ręczna ścieżka działa, przywróć **Keyframes per Turn** na 3 i zostaw oba automatyczne ustawienia włączone dla kolejnych tur.

Na czas konfiguracji korzystaj z trybu podglądu **Floating**, bo łatwiej wtedy obejrzeć każdy obraz i klip. Kiedy workflow zacznie działać niezawodnie, przełącz się na **Background**, jeśli chcesz, żeby materiały storyboardu były wtopione w scenę trybu Game Mode.

## Jak działa przekazanie promptu

Dla każdej klatki kluczowej Animation Planner zwraca:

- `imagePrompt`: wyłącznie widoczną pierwszą klatkę w chwili T=0;
- `narrationBeat`: kompletny prompt LTX obraz-do-wideo, opisujący, co dzieje się dalej.

Wybrany Animation Planner wypełnia oba pola. **Storyboard First Frame** formatuje `imagePrompt` i wysyła tę scenę T=0 w języku naturalnym do Krea 2. Kiedy obraz już istnieje, **Narration Passthrough** rozwija się do `narrationBeat`. Marinara umieszcza go w polu `prompt` zwykłego żądania wideo, podmienia `%prompt%` w workflow ComfyUI, wgrywa pierwszą klatkę i zastępuje `%reference_image_name%` jej nazwą pliku w ComfyUI.

Nie trzeba tworzyć dwóch lokalnych segmentów promptu. Dla tych presetów storyboardu normalną ścieżką jest jeden globalny prompt.

## Co składa się na dobry prompt LTX

Obraz źródłowy opisuje już wygląd postaci, kompozycję, otoczenie, oświetlenie, paletę i teksturę. Prompt wideo powinien skupić się na ruchu:

- jeden płynny akapit w czasie teraźniejszym;
- jedna wyraźna akcja, mieszcząca się w długości klipu;
- ruch kamery opisany względem postaci;
- widoczne reakcje pokazane spojrzeniem, mimiką, postawą, oddechem albo gestem;
- najwyżej jeden sensowny ruch w otoczeniu;
- dźwięk otoczenia, efekty, muzyka albo krótka kwestia w cudzysłowie, jeśli pasuje;
- naturalne domknięcie, wyciszenie ruchu albo krótkie zatrzymanie na koniec.

Unikaj zmian scen, cięć, teleportacji, kilku niepowiązanych akcji, złożonej fizyki, tłocznej choreografii, dokładnego czytelnego tekstu oraz powtarzania listy szczegółów widocznych już na pierwszej klatce.

Przykład:

```text
She pushes the door open and walks outside as the camera follows closely behind her. A light breeze moves her hair while her pace remains steady. She glances toward the empty street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

## Zapisanie powtarzalnej konfiguracji

Wynik "na 8 GB" zależy od czegoś więcej niż sam checkpoint. Udostępniając workflow, zanotuj:

- dokładny model karty graficznej i ilość pamięci VRAM;
- wersję albo commit ComfyUI;
- wersje sterownika NVIDIA, CUDA, PyTorch i Pythona;
- wymagane pakiety węzłów niestandardowych wraz z wersjami;
- dokładne nazwy plików modeli i ich foldery w ComfyUI;
- rozdzielczość wyjściową, długość, liczbę klatek kluczowych i orientacyjny czas renderowania;
- to, czy Krea 2 działa w tej konfiguracji lokalnie, czy przez połączenie obrazu w chmurze.

Dołączony plik JSON w formacie API przechowuje migawkę identyfikatorów węzłów, ścieżek modeli i nazw wejść. Jeśli ktoś trzyma modele w innym folderze, na przykład `LTX2/`, musi poprawić wartości w węzłach ładujących i wyeksportować świeżą kopię API. Workflow, który działa u swojego autora, potrafi zawieść gdzie indziej, gdy różni się węzeł niestandardowy albo ścieżka modelu.

## Rozwiązywanie problemów

### ComfyUI zwraca HTTP 400 albo "Prompt outputs failed validation"

Workflow API nie odpowiada aktualnie zainstalowanemu grafowi. Poszukaj usuniętego węzła, wiszącego identyfikatora węzła, brakującego węzła niestandardowego, wejścia przemianowanego przy aktualizacji węzła albo nazwy pliku modelu, którego już nie ma. Wyeksportuj świeży workflow API z działającego grafu ComfyUI.

### Obrazy powstają, ale wideo nie

Sprawdź **Automatic Storyboard Animations** oraz **Video Connection** w trybie Game Mode. Animacje wymagają zarówno ilustracji pierwszej klatki, jak i wybranego połączenia wideo.

### LTX nie dostaje obrazu początkowego

Upewnij się, że `%reference_image_name%` występuje w zapisanym workflow API i zasila segment obrazu w węźle LTX Director. Marinara wgrywa pierwszą klatkę tylko wtedy, gdy ten symbol zastępczy jest obecny.

### Klip się rozpływa, zmienia postacie albo robi się chaotyczny

Wróć do **LTX Simple Image-to-Video**, ustaw jedną klatkę kluczową i przetestuj turę z jedną akcją. Jeden obraz źródłowy nie zmieni się czysto w kilka lokacji, póz i zakończeń w trakcie krótkiego, ciągłego klipu. Sprawdź też pierwszą klatkę: mylące ujęcie wyjściowe utrudnia animację nawet przy dobrym prompcie ruchu.

### Każde generowanie wygląda podobnie

Zamień każde wpisane na stałe ziarno próbkowania na `%seed%`. Kiedy pojawi się dobry wynik, ustal to ziarno w workflow na stałe tylko na czas porównywania zmian promptu albo próbkowania.

### Brakuje pamięci przy generowaniu

Zacznij od 480p. Następnie w razie potrzeby skróć klip. Na czas testów zostaw jedną klatkę kluczową na turę, zamknij inne programy korzystające z karty graficznej i nie trzymaj lokalnego modelu językowego załadowanego na tym samym GPU o małej pamięci. Kwantyzowany checkpoint zmniejsza pamięć zajętą przez model, ale nie usuwa pamięci potrzebnej na latenty wideo, enkoder tekstu, modele VAE, dźwięk i upscaling.

### Marinara przestaje czekać, a ComfyUI dalej renderuje

Zamknięcie żądania w przeglądarce albo utrata połączenia z klientem potrafi zatrzymać odpytywanie po stronie aplikacji Marinara Engine, nie anulując zadania już stojącego w kolejce ComfyUI. Zanim uruchomisz to samo renderowanie ponownie, sprawdź w ComfyUI kolejkę, historię i folder wyjściowy.

### Workflow działa w ComfyUI, ale zawodzi z poziomu aplikacji Marinara Engine

Porównaj plik JSON zapisany w połączeniu z najnowszym eksportem API. Zweryfikuj bazowy adres URL, pisownię symboli zastępczych, wymagane węzły niestandardowe, ścieżki modeli, węzeł wyjściowy, wymiary i pola długości. Edytowalny graf może działać, podczas gdy Marinara wciąż trzyma starszą wyeksportowaną migawkę.

Po szczegółowe ślady z serwera włącz logowanie diagnostyczne i szukaj wpisów `[debug/game/storyboard-video]` oraz `[video-gen/comfyui]`. Poprawne żądanie pokazuje kompletny prompt globalny, nazwę wgranego pliku obrazu referencyjnego, długość, liczbę klatek oraz identyfikator promptu w kolejce ComfyUI.

## Powiązane przewodniki

- [Przewodnik po agencie Storyboard](storyboard.md)
- [Konfiguracja workflow w ComfyUI](../media/comfyui.md)
- [Generowanie wideo sceny](../media/scene-video.md)
- [Game Mode: pierwsze kroki](getting-started.md)
