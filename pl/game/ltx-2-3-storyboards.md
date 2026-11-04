# Storyboardy LTX 2.3 w Game Mode

Ten przewodnik pokazuje, jak podłączyć lokalny workflow LTX 2.3 w ComfyUI (obraz do wideo) do storyboardów trybu Game Mode, żeby każda klatka storyboardu stawała się krótkim klipem wideo. To zaawansowana konfiguracja dla graczy z lokalną kartą graficzną (GPU) i ComfyUI. Część graczy mówi na to Story Mode. W aplikacji Marinara Engine kontrolki noszą nazwy **Game Mode** i **Storyboards**.

Konfigurację opracowano na obrazach pierwszej klatki z **Krea 2** i stylu obrazu **Z-Image Turbo Narrative**. Inne konta do generowania obrazów też powinny działać, o ile przyjmują opisowe prompty scen w języku naturalnym. Wideo LTX renderuje się lokalnie w ComfyUI. To, czy obraz pierwszej klatki powstaje lokalnie, czy w chmurze, zależy od wybranego konta do generowania obrazów.

Gotowa ścieżka składa się z tych kroków:

1. Mistrz gry (GM) pisze turę narracji.
2. Animation Planner zwraca `imagePrompt` i `narrationBeat`.
3. `imagePrompt` trafia do konta do generowania obrazów i staje się ilustracją pierwszej klatki.
4. `narrationBeat` przechodzi przez **Narration Passthrough** i staje się `%prompt%`.
5. Pierwsza klatka i prompt trafiają do workflow LTX 2.3 w ComfyUI, który tworzy klip MP4.

Ilustracja jest pierwszą klatką klipu. LTX dostaje więc zarówno obraz wyjściowy, jak i prompt o tym, jaki ruch nastąpi dalej. Jeśli wszystko działa, klip pojawia się w zakładce **Videos** (filmy) galerii.

## Zanim zaczniesz

Potrzebne są:

1. Działająca lokalna instalacja ComfyUI, do której aplikacja Marinara Engine ma dostęp. Zobacz [Konfiguracja workflow w ComfyUI](../media/comfyui.md).
2. Karta graficzna z wystarczającą ilością pamięci VRAM (pamięci na karcie graficznej). Karta z 8 GB może wystarczyć do pierwszego testu w rozdzielczości 480p z jedną klatką kluczową.
3. Edytowalny workflow `ltx-director-simple` albo równoważny graf LTX 2.3 obraz-do-wideo, który poprawnie kończy pracę w ComfyUI, oraz jego eksport w formacie API, `ltx-director-simple-api`.
4. Konto do generowania obrazów w aplikacji Marinara Engine, które tworzy ilustracje pierwszej klatki.
5. Agent **Storyboard**, pobrany z **Agents → Agent Organizer** (agenci, organizowanie agentów) i włączony w grze w **Chat Settings → Agents** (ustawienia czatu, agenci). Zobacz [Przewodnik po agencie Storyboard](storyboard.md).

Edytowalny workflow i jego eksport API to dwa różne pliki. Otwórz `ltx-director-simple` w ComfyUI, zainstaluj każdy węzeł niestandardowy, który ComfyUI Manager zgłasza jako brakujący, i przetestuj graf na miejscu. Do aplikacji Marinara Engine zaimportuj `ltx-director-simple-api`. Po każdej zmianie węzła lub modelu wyeksportuj graf ponownie w formacie API i podmień plik JSON zapisany na koncie w aplikacji Marinara Engine. Nie wklejaj do aplikacji Marinara Engine zwykłego workflow z edytora wizualnego.

## Przygotowanie workflow API w ComfyUI

Najpierw dodaj edytowalny workflow do kolejki w ComfyUI, z prawdziwym obrazem źródłowym i prostym promptem. Sprawdź, czy zapisuje plik MP4 z dźwiękiem.

Prosta ścieżka w aplikacji Marinara Engine umieszcza jeden kompletny prompt w globalnym wejściu promptu węzła LTX Director:

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

Węzeł LTX Director nadal może obsługiwać kondycjonowanie obrazem, dane prowadzące, dźwięk i dwa etapy próbkowania. "Prosta" oznacza, że Marinara wysyła jeden spójny akapit obraz-do-wideo, a nie oś czasu Prompt Relay.

### Symbole zastępcze

W eksporcie API podmień odpowiednie wartości na te symbole zastępcze aplikacji Marinara Engine, ujęte w cudzysłowy:

| Symbol zastępczy | Wartość wstawiana przez aplikację Marinara Engine |
| --- | --- |
| `%prompt%` | Kompletny prompt z Animation Planner i szablonu wideo |
| `%reference_image_name%` | Obraz pierwszej klatki wgrany do ComfyUI |
| `%duration_seconds%` | Długość klipu w sekundach |
| `%length%` | Długość przeliczona na liczbę klatek przy domyślnych 16 FPS aplikacji Marinara Engine |
| `%fps%` | Liczba klatek na sekundę, której używa Marinara |
| `%width%`, `%height%` | Wymiary wynikające z rozdzielczości i proporcji obrazu ustawionych na koncie wideo |
| `%seed%` | Nowe losowe ziarno dla każdego żądania |
| `%model%` | Opcjonalna wartość modelu z konta, gdy workflow nie ustala modelu na stałe w swoim węźle ładującym |

Marinara potrafi też wypełnić `%length_s%`, `%global_prompt%`, `%local_prompts%` i `%segment_lengths%`. Te cztery są opcjonalne. Prosta ścieżka ich nie potrzebuje i wysyła swój prompt przez `%prompt%`.

Obraz referencyjny należy do tablicy `segments` wewnątrz `timeline_data` węzła LTX Director, które w workflow API jest serializowanym tekstem JSON. Symbol `%length%` utrzymuje dynamiczną długość klipu przez `normalDurationFrames`. Segment obrazu referencyjnego w klatce zerowej zachowuje własną, stałą wartość `"length":16`.

```json
{
  "timeline_data": "{\"global_prompt\":\"\",\"normalStartFrame\":0,\"normalDurationFrames\":%length%,\"segments\":[{\"id\":\"marinara-reference\",\"start\":0,\"length\":16,\"prompt\":\"\",\"type\":\"image\",\"imageFile\":\"%reference_image_name%\",\"isEndFrame\":false}],\"motionSegments\":[],\"audioSegments\":[]}"
}
```

- Nie wpisuj `%reference_image_name%` obok `timeline_data` ani w osobnym polu obrazu na najwyższym poziomie.
- Tekstowe symbole zastępcze, takie jak `%reference_image_name%`, zostaw w cudzysłowach.
- Liczbowe wejścia węzłów mogą mieć `%length%`, `%duration_seconds%` i `%fps%` w cudzysłowach, bo Marinara zamienia je na liczby. Wewnątrz serializowanego tekstu `timeline_data` zostaw `%length%` bez cudzysłowów, tak jak w przykładzie, żeby odczytana wartość była liczbą.
- Liczbę klatek, sekundy i liczbę klatek na sekundę powiąż z tymi symbolami zastępczymi. Liczby pokazywane w edytowalnym grafie ComfyUI nie są wartościami domyślnymi aplikacji Marinara Engine.

### Eksport po każdej zmianie

1. Dodaj edytowalny workflow do kolejki w ComfyUI i sprawdź, czy tworzy odtwarzalny plik MP4.
2. Wybierz **Save (API Format)**, **Export (API)** albo **Export to API**, zależnie od wersji ComfyUI.
3. Dodaj symbole zastępcze do nowego pliku JSON w formacie API albo potwierdź, że tam są.
4. Podmień workflow zapisany na koncie w aplikacji Marinara Engine.

Jeśli usuniesz węzeł i dalej używasz starszego eksportu, zostają w nim odwołania do węzła, którego już nie ma. ComfyUI odrzuca wtedy żądanie.

## Tworzenie konta wideo

1. Otwórz **Settings → Connections** (ustawienia, połączenia).
2. Kliknij **Add account** (dodanie konta) i wybierz konto typu **Video Generation**.
3. Wybierz **ComfyUI**.
4. Wpisz **Base URL** (adres bazowy), zwykle `http://127.0.0.1:8188`, gdy ComfyUI działa na tym samym komputerze.
5. Wklej kompletny workflow w formacie API w polu **ComfyUI workflow**.
6. Na pierwszy test przy małej ilości pamięci VRAM wybierz domyślną długość sześciu sekund, proporcje **16:9** i rozdzielczość 480p.
7. Zapisz konto.

Test połączenia oparty tylko na tekście nie sprawdzi symbolu `%reference_image_name%`. Po zapisaniu przetestuj ścieżkę obraz-do-wideo na obrazie z galerii albo na storyboardzie.

## Konfiguracja czatu w trybie Game Mode

Otwórz czat w trybie Game Mode, a potem **Chat Settings → Agents**. Najpierw włącz **Enable Agents** (włączenie agentów) i **Enable Storyboards** (włączenie storyboardów). Prezentacja Storyboard Optimized z kreatora nie włącza agenta.

### Illustrator

| Ustawienie | Zalecana wartość |
| --- | --- |
| **Game Illustrator** | On |
| **Image model** | **Krea 2** |
| **Image Style** | **Z-Image Turbo Narrative** |
| **Use Campaign Art Style** | Off |
| **Attach Card Appearance** | Off |
| **Send Avatar References** | Off dla tego przetestowanego workflow |

Animation Planner i tak dostaje kontekst wyglądu postaci z danej tury, dlatego **Attach Card Appearance** zostaje wyłączone, żeby nie dodawać tych informacji dwa razy. **Storyboard First Frame** również nie powtarza wytycznych artystycznych kampanii wokół gotowej sceny pierwszej klatki przygotowanej przez planera.

**Send Avatar References** steruje obrazami referencyjnymi wysyłanymi do usługi, która generuje obraz pierwszej klatki. Nie steruje wejściem pierwszej klatki w LTX: LTX dostaje gotową ilustrację przez `%reference_image_name%`. Referencje awatarów włącz dopiero wtedy, gdy potwierdzisz, że twoje konto do generowania obrazów je obsługuje i że faktycznie pomagają.

Pierwsza klatka bardzo mocno wpływa na jakość animacji. Powinna pokazywać dokładnie moment tuż przed planowanym ruchem, z wyraźnie widoczną postacią, trasą, dłońmi, drzwiami, rekwizytem albo celem.

### Scene Videos

| Ustawienie | Zalecana wartość |
| --- | --- |
| **Video model** | Konto LTX 2.3 w ComfyUI utworzone wyżej |
| **Game Video Prompt** | **Narration Passthrough** |

**Game Video Prompt** odpowiada za ręczne animacje w galerii i w sekcji Game Assets. Klipy storyboardu mogą korzystać z własnego promptu bez zmieniania tamtych.

### Storyboards

| Ustawienie | Zalecana wartość początkowa |
| --- | --- |
| **Automatic Storyboard Illustrations** | On |
| **Automatic Storyboard Animations** | On |
| **Use NovelAI Character Prompts** | Off |
| **Keyframes per Turn** | Zwykle 3. W pierwszym teście na karcie z 8 GB pamięci VRAM zacznij od 1. |
| **Animation Clip Duration** | 5 sekund |
| **Viewer Display** | Floating na czas testów |
| **Illustration Planner** | **Still Keyframes** (wariant zapasowy dla tur bez wideo) |
| **Animation Planner** | **LTX Simple Image-to-Video** |
| **Use Storyboard Template** | On |
| **Storyboard Illustration Prompt** | **Storyboard First Frame** |
| **Storyboard Video Prompt** | **Narration Passthrough** |

- **LTX Simple Image-to-Video** to zalecany planer. Planuje jedną pierwszą klatkę gotową do animacji i jeden bezpośredni prompt ruchu długości od 4 do 8 zdań, z jedną główną akcją, jednym zachowaniem kamery, powściągliwym ruchem wokół niej oraz pasującym dźwiękiem albo krótkim dialogiem.
- **LTX Director Storyboard** to opcja zaawansowana z bardziej szczegółową reżyserią uwzględniającą czas trwania i z zasadami ciągłości. Wypróbuj ją, gdy prosta ścieżka działa już stabilnie albo gdy dłuższy klip potrzebuje więcej powiązanych faz. Oba planery korzystają z tej samej umowy opartej na `%prompt%`.
- Przy włączonych animacjach **LTX Simple Image-to-Video** przygotowuje oba wyjścia: `imagePrompt` dla Krea i `narrationBeat` dla LTX. **Still Keyframes** służy tylko turom bez wideo.
- **Storyboard First Frame** wysyła do Krea pełną scenę pierwszej klatki w języku naturalnym, przygotowaną przez planera, bez tytułu klatki kluczowej, etykiet promptu, powtórzonych opisów wyglądu ani wytycznych artystycznych kampanii. Zostaw **Use Storyboard Template** włączone, żeby to ustawienie zadziałało.
- **Narration Passthrough** przekazuje gotowy `narrationBeat` planera przez umowę promptu wideo, bez kolejnego streszczenia sceny.

Każda klatka kluczowa uruchamia jedno zadanie obrazu w Krea i jedno lokalne zadanie wideo w LTX, więc trzy klatki kluczowe to trzy renderowania obrazów i trzy renderowania wideo.

## Pierwszy test

Weź zakończoną turę GM z jedną wyraźną akcją wizualną, na przykład otwarciem drzwi, spojrzeniem w stronę dźwięku albo jedną krótką wypowiedzią.

1. Najszybciej sprawdzisz działanie przy małej pamięci VRAM, ustawiając **Keyframes per Turn** na 1 i zostawiając **Animation Clip Duration** na 5 sekundach.
2. Oba automatyczne ustawienia storyboardu włącz po zakończeniu tury GM.
3. Otwórz **Chat Settings → Gallery** (ustawienia czatu, galeria) i wybierz **Create storyboard** (utworzenie storyboardu). Uruchamia to pełną ścieżkę ilustracji i animacji bez czekania na kolejną turę.
4. Jeśli przeglądanie promptów jest włączone, sprawdź prompt pierwszej klatki przed wysłaniem.
5. Sprawdź, czy pierwsza klatka daje fizycznie sensowną pozycję wyjściową.
6. Poczekaj na renderowanie pierwszej klatki, a potem na klip z ComfyUI.
7. Gdy ręczna ścieżka działa, przywróć **Keyframes per Turn** na 3 i zostaw oba automatyczne ustawienia włączone.

Na czas konfiguracji korzystaj z podglądu **Floating** (pływający), żeby obejrzeć każdy obraz i klip. Później przełącz się na **Background** (tło), jeśli chcesz, żeby materiały storyboardu pojawiały się w scenie gry.

Jeśli coś nie zadziałało, zobacz [Rozwiązywanie problemów](#troubleshooting).

## Jak działa przekazanie promptu

Dla każdej klatki kluczowej Animation Planner zwraca `imagePrompt` (wyłącznie widoczną pierwszą klatkę w chwili T=0) i `narrationBeat` (kompletny prompt LTX opisujący, co dzieje się dalej). **Storyboard First Frame** formatuje `imagePrompt` i wysyła go do Krea 2. Kiedy obraz już istnieje, **Narration Passthrough** rozwija się do `narrationBeat`. Marinara umieszcza go w polu `prompt` żądania wideo, podmienia `%prompt%` w workflow ComfyUI, wgrywa pierwszą klatkę i zastępuje `%reference_image_name%` jej nazwą pliku w ComfyUI. Nie potrzebujesz dwóch lokalnych segmentów promptu. Normalną ścieżką jest jeden globalny prompt.

## Pisanie dobrego promptu LTX

Obraz źródłowy pokazuje już wygląd, kompozycję, otoczenie, światło i styl. Prompt wideo powinien dotyczyć ruchu:

- Jeden płynny akapit w czasie teraźniejszym.
- Jedna skupiona akcja, która mieści się w długości klipu.
- Ruch kamery opisany względem postaci.
- Widoczne reakcje pokazane spojrzeniem, mimiką, postawą, oddechem albo gestem.
- Najwyżej jeden przydatny ruch w otoczeniu.
- Dźwięk otoczenia, efekty, muzyka albo krótki dialog w cudzysłowie, gdy pasuje.
- Naturalne zakończenie, wyciszenie ruchu albo krótkie zatrzymanie.

Unikaj zmian sceny, cięć, teleportacji, kilku niepowiązanych akcji, złożonej fizyki, tłocznej choreografii, dokładnego czytelnego tekstu oraz powtarzania szczegółów widocznych już na pierwszej klatce.

```text
She pushes the door open and walks outside as the camera follows closely behind her. A light breeze moves her hair while her pace remains steady. She glances toward the empty street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

<a id="troubleshooting"></a>

## Rozwiązywanie problemów

### ComfyUI zwraca HTTP 400 albo "Prompt outputs failed validation"

Workflow API nie odpowiada zainstalowanemu grafowi. Poszukaj usuniętego węzła, wiszącego identyfikatora węzła, brakującego węzła niestandardowego, wejścia przemianowanego przy aktualizacji węzła albo nazwy pliku modelu, którego już nie ma. Wyeksportuj świeży workflow API z działającego grafu.

### Obrazy powstają, ale wideo nie

Sprawdź **Automatic Storyboard Animations** oraz **Video model** w trybie Game Mode. Animacje wymagają zarówno ilustracji pierwszej klatki, jak i wybranego konta wideo.

### LTX nie dostaje obrazu początkowego

Upewnij się, że `%reference_image_name%` występuje w zapisanym workflow API i zasila segment obrazu w węźle LTX Director. Marinara wgrywa pierwszą klatkę tylko wtedy, gdy ten symbol zastępczy jest obecny.

### Klip się rozpływa, zmienia postacie albo robi się chaotyczny

Wróć do **LTX Simple Image-to-Video**, ustaw jedną klatkę kluczową i przetestuj turę z jedną akcją. Jeden obraz nie zmieni się czysto w kilka miejsc, póz i zakończeń w krótkim klipie. Sprawdź też pierwszą klatkę: mylące ujęcie wyjściowe utrudnia animację.

### Każde generowanie wygląda zbyt podobnie

Zamień każde wpisane na stałe ziarno próbkowania na `%seed%`. Kiedy uzyskasz przydatny wynik, ustal to ziarno w workflow tymczasowo, tylko na czas porównywania zmian promptu albo próbkowania.

### Brakuje pamięci przy generowaniu

Zacznij od 480p. Potem skróć klip. Na czas testów zostaw jedną klatkę kluczową na turę, zamknij inne programy korzystające z karty graficznej i nie trzymaj lokalnego modelu językowego załadowanego na tym samym GPU z małą ilością pamięci VRAM. Kwantyzowany checkpoint zmniejsza pamięć zajmowaną przez model, ale nie pamięć potrzebną na latenty wideo, enkoder tekstu, modele VAE, dźwięk i upscaling.

### Marinara przestaje czekać, a ComfyUI dalej renderuje

Zamknięcie żądania w przeglądarce albo utrata połączenia może zatrzymać odpytywanie po stronie aplikacji Marinara Engine bez anulowania zadania, które już czeka w kolejce ComfyUI. Zanim uruchomisz to samo renderowanie ponownie, sprawdź w ComfyUI kolejkę, historię i folder wyjściowy.

### Workflow działa w ComfyUI, ale zawodzi z poziomu aplikacji Marinara Engine

Porównaj plik JSON zapisany na koncie z najnowszym eksportem API. Sprawdź bazowy adres URL, pisownię symboli zastępczych, węzły niestandardowe, ścieżki modeli, węzeł wyjściowy, wymiary i pola długości. Edytowalny graf może działać, podczas gdy Marinara wciąż trzyma starszą wyeksportowaną migawkę.

Po ślady z serwera włącz logowanie diagnostyczne i szukaj wpisów `[debug/game/storyboard-video]` oraz `[video-gen/comfyui]`. Poprawne żądanie pokazuje kompletny prompt globalny, nazwę wgranego pliku obrazu referencyjnego, długość, liczbę klatek oraz identyfikator promptu w kolejce ComfyUI.

## Informacje: modele LTX 2.3

Format modelu dobierz do rodziny karty graficznej i do pamięci, która zostaje po załadowaniu przez ComfyUI enkodera tekstu, modeli VAE i upscalera. To punkty wyjścia, a nie obietnice.

| Rodzina GPU | Praktyczny punkt wyjścia | Uwagi |
| --- | --- | --- |
| RTX serii 30 (Ampere) | INT8 ConvRot | Start przy małej pamięci dla kart klasy 3070, 3080 i 3090. |
| RTX serii 40 z 16 do 24 GB | FP8 input-scaled | Korzysta z przyspieszonej ścieżki FP8 w układach Ada. |
| RTX serii 40 z 8 do 12 GB | INT8 ConvRot, gdy odciążanie przy FP8 jest zbyt wolne | Porównaj oba warianty na swoim workflow. |
| RTX serii 50 (Blackwell) | Workflow NVFP4 dev | Wymaga ComfyUI, CUDA i zestawu węzłów obsługujących NVFP4. |
| RTX 50 na istniejącym workflow distilled | FP8 input-scaled | Używaj tego, dopóki nie pojawi się oficjalny checkpoint distilled w formacie NVFP4. |

Przetestowany workflow dla RTX 3080 używa `ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors`. Te końcówki nazw oznaczają różne formaty kwantyzacji i ścieżki wykonania, a nie presety jakości, które zawsze da się wymienić. Workflow **Dev** i **distilled** zakładają inny sposób próbkowania, więc nie podstawiaj checkpointu dev do grafu distilled bez zmiany workflow. To, że checkpoint się mieści, nie gwarantuje, że zmieści się dłuższe wideo albo wyższa rozdzielczość.

Oficjalny workflow dla początkujących używa `ltx-2.3-22b-dev-fp8.safetensors`, `ltx-2.3-22b-distilled-lora-384.safetensors`, `gemma_3_12B_it_fp4_mixed.safetensors` i `ltx-2.3-spatial-upscaler-x2-1.1.safetensors`. Własne workflow mogą używać innych checkpointów, kwantyzacji, węzłów ładujących albo folderów. Nazwy plików zapisane w workflow API muszą dokładnie odpowiadać plikom, które widzi ComfyUI. Jeśli trzymasz modele w innym folderze, na przykład `LTX2/`, popraw wartości w węzłach ładujących i wyeksportuj świeżą kopię API.

Udostępniając workflow, zanotuj model karty graficznej i ilość pamięci VRAM, wersję ComfyUI, wersje sterownika NVIDIA, CUDA, PyTorch i Pythona, węzły niestandardowe wraz z wersjami, nazwy plików modeli i ich foldery, rozdzielczość, długość, liczbę klatek kluczowych i czas renderowania oraz to, czy model Krea 2 działał lokalnie, czy w chmurze.

Oficjalne materiały:

- [Przewodnik LTX 2.3 obraz-do-wideo](https://docs.ltx.io/open-source-model/usage-guides/image-to-video)
- [Przewodnik po promptach LTX](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide)
- [Karta modelu LTX 2.3](https://huggingface.co/Lightricks/LTX-2.3)
- [Karta modelu LTX 2.3 NVFP4](https://huggingface.co/Lightricks/LTX-2.3-nvfp4)
- [Oficjalne przykłady LTX 2.3 dla ComfyUI](https://github.com/Lightricks/ComfyUI-LTXVideo/tree/master/example_workflows/2.3)
- [Społecznościowe wagi rozdzielone dla ComfyUI i wersje FP8](https://huggingface.co/Kijai/LTX2.3_comfy)

## Powiązane przewodniki

- [Przewodnik po agencie Storyboard](storyboard.md)
- [Konfiguracja workflow w ComfyUI](../media/comfyui.md)
- [Generowanie wideo sceny](../media/scene-video.md)
- [Game Mode: pierwsze kroki](getting-started.md)
