# Konfiguracja workflow w ComfyUI

Marinara Engine wysyła żądania generowania obrazów i generowania wideo do lokalnego serwera ComfyUI, a żądania obrazów także do punktu końcowego RunPod Serverless, na którym działa ComfyUI. Lokalne połączenie do generowania obrazów może korzystać z prostego workflow wbudowanego w aplikację Marinara Engine, natomiast połączenia wideo i zaawansowana konfiguracja obrazów wymagają własnego workflow w formacie API.

Workflow wklejony do aplikacji Marinara Engine w formacie JSON to migawka. Marinara nie śledzi na bieżąco workflow otwartego w ComfyUI. Po każdej zmianie workflow w ComfyUI przetestuj go ponownie, wyeksportuj jeszcze raz i podmień kod JSON zapisany w połączeniu.

## Zanim zaczniesz

Zainstaluj ComfyUI, dodaj checkpointy i własne węzły, których wymaga workflow, a potem uruchom serwer. Zwykły adres lokalny to `http://127.0.0.1:8188`.

Jeśli ComfyUI działa na innym komputerze w sieci domowej, jego serwer musi nasłuchiwać pod adresem osiągalnym dla aplikacji Marinara Engine. Połączenia do generowania obrazów wymagają dodatkowo wpisu `IMAGE_LOCAL_URLS_ENABLED=true` w pliku `.env` aplikacji Marinara Engine; zobacz [Konfiguracja serwera](../CONFIGURATION.md). Jeśli połączenie nadal się nie udaje, sprawdź zaporę sieciową na tym drugim komputerze.

Lokalny model językowy i model do obrazów mogą nie zmieścić się w pamięci karty graficznej jednocześnie, zwłaszcza przy 8 GB. Kolejka obrazów w aplikacji Marinara Engine pilnuje, żeby kilka zadań nie ruszyło naraz, ale nie sprawi, że dwa załadowane modele zmieszczą się w tej samej pamięci VRAM. Gdy zabraknie pamięci, użyj modelu językowego w chmurze albo hostowanego osobno, uruchom ComfyUI na innym urządzeniu lub zwolnij pamięć po jednym modelu przed użyciem drugiego.

## Tworzenie połączenia w aplikacji Marinara Engine

1. Otwórz sekcję **Connections** (Połączenia) i utwórz nowe połączenie typu **Image Generation** (generowanie obrazów).
2. Wybierz **ComfyUI** dla serwera lokalnego albo **RunPod Serverless (ComfyUI)** dla punktu końcowego RunPod.
3. Przy lokalnym ComfyUI wpisz jego Base URL. Klucz API (tajny kod, trochę jak hasło) nie jest potrzebny. Jeśli pole **ComfyUI Workflow** zostanie puste, Marinara używa wbudowanego prostego workflow typu tekst-na-obraz.
4. Przy RunPod wpisz klucz API oraz Endpoint ID. Własny workflow jest tu obowiązkowy.
5. Skonfiguruj sekcję **Local Image Defaults** (domyślne ustawienia obrazów lokalnych). Te wartości zastępują odpowiadające im symbole zastępcze w workflow.
6. Zapisz połączenie, a po dodaniu workflow użyj przycisku **Test Image** (test obrazu).

## Tworzenie i eksport workflow

1. Przygotuj w ComfyUI osobny workflow na potrzeby aplikacji Marinara Engine.
2. Skonfiguruj i połącz jak zwykle checkpoint, modele LoRA, VAE, enkodery promptu (tekstu, który Marinara wysyła do AI), węzły obrazu latentnego lub wejścia obrazu, sampler oraz węzły wyjściowe.
3. Ustaw workflow w kolejce ComfyUI i sprawdź, czy powstaje oczekiwany obraz.
4. Dodaj węzeł wyjściowy. Najbezpieczniejszy wybór to **SaveImage**, ponieważ Marinara odczytuje gotowe obrazy i animacje z historii workflow w ComfyUI.
5. Zapisz edytowalny workflow pod rozpoznawalną nazwą, na przykład `Marinara_Workflow`.
6. Wyeksportuj workflow w formacie API. Zależnie od wersji interfejsu ComfyUI ta opcja nazywa się **Save (API Format)**, **Export (API)** albo **Export to API**. Jeśli jest ukryta, włącz w ComfyUI opcje dla programistów (tryb dev).
7. Otwórz wyeksportowany plik `.json` w edytorze tekstu.

Workflow w formacie API różni się od zwykłego workflow z edytora wizualnego. Klucze najwyższego poziomu to identyfikatory węzłów, a każdy węzeł zawiera zwykle `class_type` oraz `inputs`. Eksportuj wersję API; nie wklejaj zwykłego pliku workflow z układem graficznym edytora.

<a id="comfyui-video-workflows"></a>

## Workflow wideo w ComfyUI

Utwórz połączenie typu **Video Generation** (generowanie wideo), wybierz **ComfyUI** i wklej workflow w formacie API do wymaganego pola **ComfyUI Workflow**. WAN 2.2 i inne lokalne grafy wideo są obsługiwane, o ile ten sam workflow działa w ComfyUI i zapisuje plik MP4 przez wyjście takie jak podstawowy węzeł **SaveVideo**.

Workflow wideo może korzystać z tych symboli zastępczych ujętych w cudzysłowy:

| Symbol zastępczy         | Wartość podstawiana przez aplikację Marinara Engine                 |
| ------------------------ | ------------------------------------------------------------------- |
| `%prompt%`               | Skompilowany prompt sceny lub animacji.                             |
| `%width%`, `%height%`    | `832×480` dla 480p albo `1280×720` dla 720p, zamienione przy 9:16.  |
| `%seed%`                 | Nowe losowe 32-bitowe ziarno.                                       |
| `%length%`               | Długość klipu jako liczba klatek przy 16 fps.                       |
| `%model%`                | Wartość Model zapisana w połączeniu, jeśli jest ustawiona.          |
| `%reference_image_name%` | Nazwa wgranego pliku pierwszej klatki dla węzła **LoadImage**.      |

Marinara ustawia workflow w kolejce przez `/prompt`, odpytuje `/history` i pobiera plik MP4 wskazany w wyjściu `gifs` lub `images`. Akcje typu obraz-na-wideo dostarczają `%reference_image_name%`, a testy połączenia z samym tekstem już nie – dlatego to wejście powinno być opcjonalne, gdy jeden workflow ma obsłużyć oba przypadki.

Lokalne renderowanie WAN na kartach graficznych ze średniej półki potrafi przekroczyć 30 minut. Zadania wideo w ComfyUI korzystają ze zmiennej `VIDEO_GEN_TIMEOUT_MS`, a nie z `COMFYUI_GEN_TIMEOUT`, który dotyczy tylko obrazów. Jeśli poprawny workflow zostaje przerwany za wcześnie, zwiększ limit czasu dla wideo i uruchom aplikację Marinara Engine ponownie.

## Dodawanie symboli zastępczych aplikacji Marinara Engine

Zastąp symbolami zastępczymi z listy poniżej te wartości, którymi ma sterować Marinara.

W połączeniu z **lokalnym ComfyUI** trzymaj każdy symbol zastępczy wewnątrz cudzysłowów JSON. Marinara najpierw analizuje workflow, a dopiero potem zamienia dokładny symbol liczbowy, taki jak `"%width%"`, na prawdziwą liczbę. Dzięki temu plik pozostaje poprawny także dla węzłów, które wymagają wartości liczbowej.

W połączeniu **RunPod Serverless (ComfyUI)** symbole tekstowe, takie jak `"%prompt%"`, `"%model%"` czy `"%sampler%"`, zostają w cudzysłowach, a symbole liczbowe – `%width%`, `%height%`, `%seed%`, `%steps%`, `%cfg%`, `%denoise%` i `%clip_skip%` – zostaw bez cudzysłowów. Przy RunPod podstawienie następuje, zanim Marinara przeanalizuje workflow, więc wstawiona liczba sprawia, że wysyłany kod JSON jest poprawny. Edytor połączeń może przejściowo oznaczyć taki szablon jako niepoprawny JSON, bo token bez cudzysłowów zostaje podmieniony dopiero w chwili generowania. To ostrzeżenie nie blokuje zapisu.

Istotne fragmenty prostego workflow API w wersji **lokalnej** mogą wyglądać tak:

```json
{
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": "%seed%",
      "steps": "%steps%",
      "cfg": "%cfg%",
      "sampler_name": "%sampler%",
      "scheduler": "%scheduler%",
      "denoise": "%denoise%"
    }
  },
  "5": {
    "class_type": "EmptyLatentImage",
    "inputs": {
      "width": "%width%",
      "height": "%height%",
      "batch_size": 1
    }
  },
  "6": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "portrait, %prompt%, masterpiece"
    }
  },
  "7": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "watermark, %negative_prompt%"
    }
  }
}
```

To tylko fragment: zachowaj powiązania między węzłami i pozostałe wejścia z wyeksportowanego workflow. Symbol zastępczy promptu można umieścić w dłuższym tekście, żeby dokleić stałe tagi z przodu lub z tyłu. Symbol liczbowy powinien zwykle stanowić całą wartość. W kopii workflow dla RunPod usuń cudzysłowy wokół tych tokenów liczbowych. Dowolne ustawienie da się też wpisać na sztywno, jeśli domyślne wartości z połączenia nie mają go ruszać.

| Symbol zastępczy      | Wartość podstawiana przez aplikację Marinara Engine                                         |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `%prompt%`            | Pozytywny prompt obrazu. Edytor połączeń ostrzega, gdy go brakuje.                          |
| `%negative_prompt%`   | Negatywny prompt obrazu.                                                                    |
| `%width%`, `%height%` | Żądane wymiary obrazu.                                                                      |
| `%seed%`              | Ziarno z połączenia; wartość `-1` daje nowe losowe ziarno.                                  |
| `%model%`             | Model zapisany w połączeniu. Podaj dokładną wartość checkpointu wymaganą przez węzeł ładujący. |
| `%steps%`             | Liczba kroków samplingu.                                                                    |
| `%cfg%`               | Skala CFG. Akceptowane są też `%cfg_scale%` i `%scale%`.                                     |
| `%sampler%`           | Nazwa samplera.                                                                             |
| `%scheduler%`         | Nazwa schedulera.                                                                           |
| `%denoise%`           | Siła odszumiania. Akceptowane jest też `%denoising_strength%`.                               |
| `%clip_skip%`         | Wartość Clip Skip dla zgodnego węzła.                                                       |

Po edycji zapisz plik JSON, skopiuj całą jego zawartość, wklej ją w polu **ComfyUI Workflow** połączenia do generowania obrazów, zapisz połączenie i kliknij przycisk **Test Image**.

## Korzystanie z obrazów referencyjnych

Marinara może przekazać do czterech obrazów referencyjnych, jeśli funkcja uruchamiająca generowanie ma je do wysłania. Własny workflow musi zawierać zgodne węzły wejściowe i symbole zastępcze; samo dodanie symbolu nie utworzy ani nie podłączy tych węzłów.

### Lokalny ComfyUI: nazwy wgranych plików dla węzła LoadImage

W standardowym węźle **LoadImage** w ComfyUI użyj symbolu zastępczego z nazwą pliku:

```json
{
  "12": {
    "class_type": "LoadImage",
    "inputs": {
      "image": "%reference_image_name%",
      "upload": "image"
    }
  }
}
```

Marinara wgrywa obraz referencyjny do folderu wejściowego ComfyUI i zastępuje symbol zastępczy nazwą pliku zwróconą przez ComfyUI. `%reference_image_name%` oznacza pierwszy obraz. W workflow z kilkoma wejściami referencyjnymi użyj symboli od `%reference_image_name_01%` do `%reference_image_name_04%`.

Jeśli workflow zawsze wymaga wejścia obrazu, włącz opcję **Upload a 1x1 placeholder when no reference image is provided** w sekcji **Local Image Defaults**. Marinara podeśle wtedy maleńki obrazek zastępczy, gdy w żądaniu nie ma prawdziwego obrazu referencyjnego.

### Surowe dane obrazu w base64

Użyj `%reference_image%` dla pierwszego surowego obrazu w base64 albo symboli od `%reference_image_01%` do `%reference_image_04%` dla ponumerowanych wejść. Te wartości zawierają dane base64 bez przedrostka `data:image/...` i działają wyłącznie z własnymi węzłami, które przyjmują taki format bezpośrednio.

Workflow dla RunPod obsługują surowe symbole base64. Symbole z nazwą wgranego pliku są przeznaczone dla lokalnego ComfyUI i nie działają w obsłudze RunPod.

## Osobne workflow dla poszczególnych postaci

Dla każdej postaci, która potrzebuje konkretnego checkpointu, zestawu modeli LoRA, konfiguracji ControlNet albo własnego układu obrazów referencyjnych, da się przygotować osobny wyeksportowany workflow i osobne połączenie do generowania obrazów. Wybierz odpowiednie połączenie wszędzie tam, gdzie dana postać lub funkcja obrazów pozwala je wskazać.

Efekty bywają dzięki temu spójniejsze niż przy jednym uniwersalnym workflow, ale każde połączenie i tak przechowuje własną kopię kodu JSON. Po zmianie workflow danej postaci w ComfyUI powtórz dla tego połączenia kroki: eksport, edycję, skopiowanie i wklejenie.

## Rozwiązywanie problemów

| Problem                                          | Co sprawdzić                                                                                                                                                                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marinara zgłasza niepoprawny kod JSON workflow   | Przy lokalnym ComfyUI sprawdź cudzysłowy, przecinki i nawiasy po dodaniu symboli zastępczych. Przy RunPod bez cudzysłowów zostają wyłącznie symbole liczbowe; symbole tekstowe i reszta szablonu nadal wymagają poprawnej składni JSON. |
| Do węzła trafia dosłowny prompt lub symbol zastępczy | Sprawdź, czy token jest zapisany dokładnie tak jak na liście i czy wklejony workflow to świeżo wyeksportowana wersja API.                                                                                                     |
| Obraz ignoruje żądane wymiary                    | Wstaw `%width%` i `%height%` w węźle obrazu latentnego lub innym węźle rozmiaru, który faktycznie zasila sampler.                                                                                                             |
| ComfyUI nie znajduje modelu                      | Podaj dokładną nazwę checkpointu wymaganą przez węzeł ładujący albo wpisz checkpoint w workflow na sztywno, zamiast używać `%model%`.                                                                                         |
| ComfyUI zgłasza brakujący węzeł lub brakujące wejście | Zainstaluj te same paczki własnych węzłów, których użyto przy budowaniu workflow, i sprawdź, czy nazwy ich wejść się nie zmieniły.                                                                                        |
| Zadanie kończy się, ale Marinara nie dostaje obrazu | Dodaj podłączone wyjście **SaveImage** i przetestuj workflow jeszcze raz bezpośrednio w ComfyUI.                                                                                                                            |
| Węzeł obrazu referencyjnego zgłasza błąd         | Przy zwykłym lokalnym węźle **LoadImage** użyj symbolu `%reference_image_name...%`. Surowego base64 używaj tylko z węzłem stworzonym pod ten format i sprawdź, czy funkcja aplikacji Marinara Engine faktycznie przekazała obraz referencyjny. |
| Zdalny adres ComfyUI w sieci lokalnej jest blokowany | Przy połączeniach do generowania obrazów włącz `IMAGE_LOCAL_URLS_ENABLED`. Ustaw nasłuchiwanie ComfyUI na interfejsie sieciowym i sprawdź zaporę na komputerze docelowym. Nie wystawiaj serwera ComfyUI bez uwierzytelniania do publicznego internetu. |
| Błąd: `Outbound response exceeded N bytes`      | Odpowiedź przekroczyła ustawiony limit, domyślnie 30 MiB. Mogą to spowodować osadzone w metadanych workflow lub obrazy referencyjne. Wyłącz metadane w ComfyUI albo zwiększ `IMAGE_GEN_MAX_RESPONSE_BYTES` w pliku `.env` aplikacji Marinara Engine i uruchom ją ponownie. |
| Długie generowanie obrazu przekracza limit czasu | Zwiększ `COMFYUI_GEN_TIMEOUT` w pliku `.env` aplikacji Marinara Engine. Wartość podaje się w sekundach, domyślnie `2400`.                                                                                                     |
| Długie generowanie wideo przekracza limit czasu  | Zwiększ `VIDEO_GEN_TIMEOUT_MS` w pliku `.env` aplikacji Marinara Engine. Wartość podaje się w milisekundach, domyślnie `1800000` (30 minut).                                                                                  |
| Generowaniu brakuje pamięci karty graficznej     | Zmniejsz wymiary obrazu lub rozmiar modelu, zwolnij pamięć po lokalnym modelu językowym, użyj zdalnego modelu językowego albo przenieś ComfyUI na inne urządzenie.                                                            |

## Powiązane przewodniki

- [Dostawcy generowania obrazów i konfiguracja](image-providers.md) opisuje wszystkie obsługiwane usługi obrazów oraz wspólne ustawienia obrazów.
- [Generowanie wideo sceny](scene-video.md) opisuje połączenia wideo i wszystkie miejsca, w których pojawia się wideo scen.
- [Storyboardy LTX 2.3 w Game Mode](../game/ltx-2-3-storyboards.md) opisuje workflow LTX Director API, symbole zastępcze i zalecane ustawienia trybu Game Mode.
- [Profile stylu obrazów](style-profiles.md) wyjaśniają, czym są wielokrotnego użytku style promptów w aplikacji Marinara Engine.
- [Agent Illustrator](illustrator-agent.md) opisuje automatyczne ilustrowanie scen.
- [Konfiguracja serwera](../CONFIGURATION.md) dokumentuje dostęp z sieci lokalnej oraz limity czasu dla ComfyUI.
- [Podstawy workflow w ComfyUI](https://docs.comfy.org/development/core-concepts/workflow) wyjaśniają workflow w oficjalnej dokumentacji ComfyUI.
