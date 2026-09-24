# Przewodnik po agencie Storyboard

Agent **Storyboard** do pobrania zamienia gotowy tekst fabularny w uporządkowane obrazy klatek kluczowych, a opcjonalnie także w krótkie klipy image-to-video. Obsługuje tryby **Roleplay** i **Game Mode**. Czaty Conversation nie korzystają z agenta Storyboard.

To jest aktualny sposób pracy oparty na agencie. Pakiet Storyboard dostarcza prompty planujące (prompt to tekst, który Marinara wysyła do AI), wartości domyślne i kontrolki osobne dla każdego czatu. Marinara Engine odpowiada za integrację, która generuje materiały, zapisuje je w panelu Gallery (Galeria) i pokazuje w czacie albo w podglądzie gry.

## Roleplay i Game Mode w skrócie

| | Roleplay | Game Mode |
| --- | --- | --- |
| Źródło fabuły | Zakończone wiadomości użytkownika i AI od poprzedniego udanego odcinka | Jedna zakończona tura narracji GM (Game Master, czyli mistrz gry) |
| Wybór automatyzacji | **Manual only**, **Still images** albo **Animations** | Osobne przełączniki **Automatic Storyboard Illustrations** i **Automatic Storyboard Animations** |
| Działanie ręczne | **Gallery > Create storyboard** dla ostatniej zakończonej odpowiedzi AI | **Gallery > Create storyboard** dla ostatniej zakończonej tury GM |
| Wyświetlanie | W czacie, pod odpowiedzią AI kończącą odcinek | Pływający podgląd albo tło gry, zsynchronizowane z narracją |
| Prompty planujące | Episode contract, visual style, opcjonalny animation addon i output contract | Osobne planery obrazów nieruchomych i animacji |
| Wspólne prompty końcowe | Prompt obrazu ilustracji i prompt wideo animacji | Prompt obrazu ilustracji i prompt wideo animacji |

Oba tryby zapisują obrazy klatek kluczowych w zakładce **Images** (Obrazy) panelu Gallery, a klipy w zakładce **Videos** (Wideo).

## Instalacja agenta

1. Kliknij ikonę Sparkles, żeby otworzyć panel **Agents** (Agenci).
2. Wybierz zakładkę **Download Agents**.
3. Otwórz pakiet **Storyboard** i kliknij przycisk **Install**.
4. Otwórz czat w trybie Roleplay albo Game Mode, a potem panel ustawień czatu: **Chat Settings > Agents**.
5. Włącz opcję **Enable Agents**, a potem opcję **Enable Storyboards** na karcie agenta Storyboard.

Instalacja pakietu udostępnia go zgodnym czatom, ale nie włącza go po cichu w każdym z nich. Obecna wersja pakietu nie wymaga ponownego uruchomienia aplikacji Marinara Engine.

Jeśli agent Storyboard nie pojawia się w panelu Chat Settings, sprawdź, czy pakiet jest zainstalowany i czy czat działa w trybie Roleplay albo Game Mode.

## Ustawienia agenta Storyboard

Otwórz panel **Agents**, wybierz pakiet **Storyboard** i przejdź do jego konfiguracji. Te wartości obowiązują domyślnie w czatach, które nie mają własnych ustawień.

### Domyślne ustawienia generowania i multimediów

| Ustawienie | Domyślnie | Do czego służy |
| --- | --- | --- |
| Agent connection | Wybrane połączenie agenta | Planuje storyboard za pomocą modelu językowego LLM |
| **Image connection** | Use the Game image connection | Generuje każdą klatkę kluczową; gdzieś w łańcuchu zapasowym musi być ustawione połączenie obrazowe |
| **Video connection** | Use the Game video connection | Generuje klipy, gdy animacje są włączone |
| **Automatic generation** | Still images | Ustala początkowe zachowanie automatyczne dla nowo aktywowanych czatów |
| **Keyframes per turn** | 3, zakres 1-6 | Określa docelową liczbę uporządkowanych klatek |
| **Clip seconds** | 5, zakres 1-15 | Określa żądaną długość każdego klipu |
| **Viewer display** | Floating viewer | Ustala domyślny podgląd w trybie Game Mode; w trybie Roleplay storyboardy zawsze wyświetlają się w czacie |
| **Default Roleplay episode interval** | 1, zakres 1-100 | Określa, ile nowego materiału z trybu Roleplay zbiera się między odcinkami automatycznymi |
| **Attach Card Appearance** | On | Dodaje do promptów obrazu szczegóły wyglądu dopasowanych postaci |
| **Send Avatar References** | On | Wysyła awatary dopasowanych postaci i person, jeśli dostawca obrazów obsługuje referencje |
| **Use the final image template** | On | Formatuje zaplanowaną klatkę, zanim trafi do dostawcy obrazów |
| **Use NovelAI character prompts** | On | Korzysta z natywnych promptów dla poszczególnych postaci na obsługiwanych oficjalnych połączeniach NovelAI V4/V4.5 |

### Sekcja Game prompt library

Ta biblioteka udostępnia dwie różne ścieżki planowania. O tym, która jest aktywna, decyduje to, czy gra tworzy obrazy nieruchome, czy klipy.

| Ustawienie | Domyślnie | Do czego służy |
| --- | --- | --- |
| **Still planner** | Still Keyframes | Dzieli jedną zakończoną turę GM na gotowe momenty do zilustrowania |
| **Animation planner** | Comic Page Animation | Tworzy pierwsze klatki gotowe do animacji oraz wskazówki ruchu dopasowane do długości klipu |

Pakiet zawiera też planery NovelAI, komiksowe, mangowe (kolorowe i czarno-białe), anime oraz nastawione na LTX. Treść promptu planera da się edytować w globalnej konfiguracji agenta. Czat w trybie Game Mode wybiera spośród opcji nieruchomych i animowanych w **Chat Settings > Agents > Storyboards**.

### Sekcja Roleplay prompt library

Tryb Roleplay składa cztery wybrane prompty w jedno żądanie do planera.

| Ustawienie | Domyślnie | Do czego służy |
| --- | --- | --- |
| **Episode contract** | Completed Roleplay Episode | Wybiera zakończone momenty fabularne potwierdzone w źródle i zachowuje kolejność wiadomości |
| **Visual style** | Normal / Anime | Określa oprawę wizualną każdej klatki kluczowej |
| **Animation addon** | Simple Storyboard Motion | Dokłada ruch, pracę kamery, dialog i dźwięk ze źródła, tło dźwiękowe oraz zatrzymanie kadru na końcu, ale tylko w klipach |
| **Output contract** | Roleplay Keyframe JSON | Określa ustrukturyzowane pola klatki kluczowej, które zwraca planer |

Otwórz zwiniętą **Prompt library** (bibliotekę promptów) w Stage 1, aby edytować całe te zbiory. Kliknij przycisk **Add option**, żeby dodać własny prompt, zmień jego nazwę, dopisz krótki opis i popraw treść. Wbudowane opcje da się przywrócić do wartości domyślnych z pakietu.

### Sekcja Shared provider formatters

Kiedy któryś z trybów zaplanuje już klatki, wspólne formatery budują końcowe żądania do dostawców.

| Ustawienie | Domyślnie | Do czego służy |
| --- | --- | --- |
| **Default image prompt** | Game Scene Illustration | Formatuje każdą zaplanowaną klatkę kluczową pod dostawcę obrazów |
| **Default video prompt** | Cinematic Scene Video | Formatuje obraz pierwszej klatki i plan ruchu pod dostawcę wideo |

Każdy numerowany etap ma własną zwiniętą **Prompt library**: Stage 2 zawiera formatery obrazu, Stage 3 planery ruchu uwzględniające obraz, a Stage 4 formatery przekazujące prompt wideo. Wśród wbudowanych opcji obrazu są też **Storyboard Illustration** i **Storyboard First Frame**. Wśród opcji wideo są **Anime Game Video**, **Comic Page Video** i **Narration Passthrough**. Czaty w trybie Game Mode i Roleplay mogą wybrać różne formatery, nie ruszając przy tym wspólnego zbioru promptów.

### Globalne wartości domyślne i własne ustawienia czatu

Każdy czat może nadpisać ustawienia domyślne agenta. Panel Chat Settings oznacza wartości odziedziczone jako **Using agent default**, a po ustawieniu własnej wartości pokazuje przycisk przywracania.

Pierwszeństwo połączeń wygląda w każdym trybie nieco inaczej:

- Tryb Roleplay daje osobne listy rozwijane promptu, obrazu i wideo dla każdego czatu. Opcja **Use global default** dziedziczy konfigurację agenta Storyboard.
- Tryb Game Mode korzysta z własnych połączeń planowania, obrazu i wideo, jeśli są ustawione, a w przeciwnym razie sięga po wartości domyślne agenta Storyboard.

Obrazy nieruchome wymagają połączenia obrazowego. Animacje potrzebują zarówno udanego obrazu klatki kluczowej, jak i połączenia wideo.

## Storyboardy w trybie Roleplay

Storyboardy w trybie Roleplay łączą zakończone wymiany wiadomości w odcinek wizualny i pokazują go pod odpowiedzią AI, która ten odcinek zamyka.

### Szybki start

1. Zainstaluj agenta Storyboard i włącz go w czacie w trybie Roleplay.
2. W **Chat Settings > Agents > Storyboards** wskaż połączenia w polach **Prompt connection** i **Image connection** albo zostaw w nich **Use global default**, jeśli globalna konfiguracja jest kompletna.
3. Wybierz tryb w polu **Automatic mode**:
   - **Manual only**: bez odcinków automatycznych; przycisk **Create storyboard** tworzy na żądanie odcinek z samych obrazów nieruchomych.
   - **Still images**: automatycznie tworzy odcinek ilustrowany.
   - **Animations**: automatycznie tworzy obrazy klatek kluczowych i klip do każdej z nich; wymaga połączenia wideo.
4. Ustaw pola **Messages per episode** i **Keyframes per episode**.
5. Doprowadź do końca nową odpowiedź AI albo otwórz panel Gallery i kliknij przycisk **Create storyboard** (utworzenie storyboardu).

Strzałkami przełączaj kadry storyboardu złożonego z kilku klatek kluczowych. Klatka animowana pokazuje gotowy do odtworzenia klip na miejscu, a w czasie oczekiwania na klip albo przy jego braku wraca do obrazu.

### Jak działa odstęp między odcinkami

Odstęp decyduje o tym, ile nowych wiadomości użytkownika i AI zbiera się między udanymi storyboardami automatycznymi. Licznik przesuwają obie role, a odcinek obejmuje nowe wiadomości w kolejności chronologicznej.

Domyślna wartość to 1, więc kolejna nowo zakończona odpowiedź AI może od razu dać odcinek. Większa wartość zostawia miejsce na dialog i akcję. Materiał źródłowy ogranicza się do 20 ostatnich wiadomości i 12 000 znaków, żeby stary albo bardzo długi czat nie stworzył żądania planowania bez żadnych granic.

Punkt odniesienia przesuwa się dopiero po zapisaniu pełnego albo częściowego storyboardu. Nieudany odcinek nie zużywa materiału źródłowego. Otwarcie istniejącego czatu nie uzupełnia starych odpowiedzi wstecz, a generowanie automatyczne czeka na nowo zakończoną odpowiedź AI.

### Łańcuch promptów w trybie Roleplay

Tryb Roleplay korzysta z czterech warstw planowania, zanim do gry wejdą wspólne formatery dostawców:

1. **Episode contract** wybiera zakończone momenty fabularne potwierdzone w źródle i przypina je do przekazanych wiadomości.
2. **Visual style** decyduje o oprawie: Normal/Anime, NovelAI, Comic, Colored Manga albo B&W Manga.
3. **Animation addon** dokłada się tylko do storyboardów animowanych. Opisuje jedną wykonalną akcję, zachowanie kamery, dialog i dźwięk potwierdzone w źródle, tło dźwiękowe oraz zatrzymanie kadru na końcu.
4. **Output contract** określa ustrukturyzowany wynik z klatkami kluczowymi, który zwraca planer.

Potem ustawienie **Storyboard Illustration Prompt** formatuje każdą zaplanowaną pierwszą klatkę pod dostawcę obrazów. Przy włączonych klipach ustawienie **Storyboard Video Prompt** formatuje plan ruchu pod dostawcę wideo.

Biblioteka promptów trybu Roleplay jest niezależna od biblioteki planerów trybu Game Mode. Zmiana stylu wizualnego w trybie Roleplay nie zmienia planerów obrazów nieruchomych ani planerów animacji w trybie Game Mode.

### Storyboard i Illustrator razem

Storyboard to inny agent niż Illustrator. Ręczne działania agenta Illustrator oraz pozostałe tworzone przez niego materiały nadal są dostępne. Kiedy w trybie Roleplay ustawiona jest opcja **Still images** albo **Animations**, Marinara wstrzymuje dla tej zakończonej odpowiedzi zwykły automatyczny obraz pierwszoplanowy agenta Illustrator. Dzięki temu obaj agenci nie tworzą konkurencyjnych materiałów. Opcja **Manual only** zostawia zwykłą ścieżkę agenta Illustrator bez zmian.

## Storyboardy w trybie Game Mode

Storyboard w trybie Game Mode bierze za źródło fabuły dokładnie jedną zakończoną turę narracji GM. Usuwa ukryte znaczniki poleceń GM, planuje uporządkowane klatki i przypina każdą z nich do zakresu czytelnych fragmentów tury. Podgląd zmienia klatki w miarę przesuwania się czytelnika przez te fragmenty.

### Szybki start

1. Zainstaluj agenta Storyboard.
2. Utwórz albo otwórz czat w trybie Game Mode.
3. Otwórz **Chat Settings > Agents**, włącz opcję **Enable Agents**, a potem opcję **Enable Storyboards**.
4. Sprawdź, czy gra ma połączenie obrazowe albo czy dostarcza je globalna konfiguracja agenta Storyboard.
5. Doprowadź do końca turę narracji GM.
6. Otwórz panel **Gallery** i kliknij przycisk **Create storyboard**.

Zamknięty podgląd gry otwiera się ponownie przyciskiem **View storyboard** w panelu Gallery. Generowanie ręczne korzysta z bieżącego ustawienia animacji: przy włączonej opcji **Automatic Storyboard Animations** ręczny storyboard prosi też o klipy.

### Automatyczne storyboardy w trybie Game Mode

Karta agenta Storyboard ma dwa przełączniki automatyzacji:

- Opcja **Automatic Storyboard Illustrations** tworzy nieruchome klatki kluczowe po zakończonej turze GM.
- Opcja **Automatic Storyboard Animations** dokłada do każdej klatki kluczowej klip. Włączenie animacji włącza też ilustracje, a wyłączenie ilustracji wyłącza animacje.

Generowanie automatyczne rusza tylko wtedy, gdy agent Storyboard jest aktywny w danej grze. Nie tworzy też drugi raz storyboardu dla tury, która już go ma. Jeśli celowo potrzebny jest kolejny storyboard dla ostatniej tury, użyj ręcznego przycisku w panelu Gallery.

Ręczny storyboard w grze może pokazać gotowe prompty obrazów do sprawdzenia, jeśli w ustawieniach generowania włączona jest opcja **Expose image prompts before sending**. Storyboardy automatyczne idą dalej bez okna podglądu, więc nie zatrzymują rozgrywki.

### Ustawienia w trybie Game Mode

Otwórz **Chat Settings > Agents > Storyboards**.

| Ustawienie | Domyślnie w agencie | Za co odpowiada |
| --- | --- | --- |
| **Enable Storyboards** | Off w każdym czacie | Włącza zainstalowanego agenta w tej grze |
| **Automatic Storyboard Illustrations** | Wynika z ustawienia Automatic generation | Nieruchome klatki kluczowe po każdej zakończonej turze GM |
| **Automatic Storyboard Animations** | Wynika z ustawienia Automatic generation | Klipy MP4 do każdej klatki kluczowej |
| **Keyframes per Turn** | 3, zakres 1-6 | Docelowa liczba klatek; krótka tura może dać ich mniej |
| **Animation Clip Duration** | 5 sekund, zakres 1-15 | Żądana długość każdego klipu; dostawca może ją przyciąć |
| **Viewer Display** | Floating | Przeciągany podgląd albo pełne tło gry |
| **Still Planner** | Still Keyframes | Planuje gotowe ilustracje nieruchome |
| **Animation Planner** | Comic Page Animation | Planuje pierwsze klatki gotowe do animacji oraz wskazówki ruchu |
| **Use Storyboard Template** | On | Stosuje wybrany końcowy formater ilustracji |
| **Storyboard Illustration Prompt** | Game Scene Illustration | Formatuje zaplanowaną klatkę pod dostawcę obrazów |
| **Storyboard Video Prompt** | Cinematic Scene Video | Formatuje pierwszą klatkę i plan ruchu pod dostawcę wideo |

Pakiet dostarcza też planery NovelAI, komiksowe, mangowe, anime oraz nastawione na LTX. Sam wybór planera animacji nie włącza jeszcze generowania wideo; nadal potrzebna jest opcja **Automatic Storyboard Animations** i połączenie wideo.

### Łańcuch promptów w trybie Game Mode

Tryb Game Mode ma osobne planery dla wyników nieruchomych i animowanych:

```text
completed GM narration
  -> Still Planner or Animation Planner
  -> Storyboard Illustration Prompt
  -> image connection
  -> optional Storyboard Video Prompt
  -> video connection
```

Planer wybiera momenty fabularne i układa je w kolejności. Prompt ilustracji to formater przygotowujący żądanie pod dostawcę, a nie kolejny planer fabuły. Przy włączonych animacjach planer animacji tworzy zarówno dokładny opis pierwszej klatki, jak i wskazówkę ruchu; prompt wideo zamienia tę wskazówkę w końcowe żądanie.

### Zaktualizowane przepisy dla trybu Game Mode

Te przepisy zestawiają łańcuch agenta Storyboard ustawiony przez pakiet z pozostałymi ustawieniami gry i dostawcy. Zastosuj nazwany łańcuch, jeśli pakiet go udostępnia, albo odtwórz wypisane wybory ręcznie.

#### Google Comic Storyboards

Łańcuch ustawiony przez pakiet:

- **Illustration Planner**: Still Keyframes
- **Animation Planner**: Comic Page Animation
- **Storyboard Illustration Prompt**: Game Scene Illustration
- **Storyboard Video Prompt**: Comic Page Video
- **Use Storyboard Template**: On

Lista kontrolna gry:

- **Visual Generation**: On
- **Image Connection**: Google/Nano Banana
- **Image Style**: Default
- Zostaw styl artystyczny wygenerowany przez kreator.
- **Automatic Storyboard Illustrations**: On
- **Automatic Storyboard Animations**: Off
- **Keyframes per Turn**: 3
- **Video Connection**: None

Powstają wtedy zwykłe storyboardy złożone z obrazów nieruchomych. Zapisany łańcuch animacji Comic Page włącza się dopiero po wskazaniu połączenia wideo i włączeniu opcji **Automatic Storyboard Animations**.

#### NovelAI Direct Tags

Łańcuch ustawiony przez pakiet:

- **Illustration Planner**: NovelAI Keyframes
- **Storyboard Illustration Prompt**: utwórz własną opcję, której prompt zawiera wyłącznie:

  ```text
  ${scenePrompt}
  ```

- **Use Storyboard Template**: On
- Zostaw ustawienia Animation Planner i Storyboard Video Prompt bez zmian.

Lista kontrolna gry:

- **Image Style**: Danbooru
- **Use Campaign Art Style**: Off
- **Attach Card Appearance**: Off
- **Send Avatar References**: Off
- **Use NovelAI Character Prompts**: Off
- **Queue media generation requests**: On
- Usuń opisowy tekst z pola **Style Text** w profilu Danbooru.
- Dostrój tagi pozytywne, negatywne i ilustracyjne według potrzeb.

Własny szablon przepuszczający wysyła zwięzłe tagi NovelAI z planera i nie opakowuje ich w zwykły opisowy formater ilustracji.

#### Local Krea 2 + LTX 2.3

Łańcuch ustawiony przez pakiet:

- **Illustration Planner**: Still Keyframes jako rozwiązanie zapasowe dla samych obrazów nieruchomych
- **Animation Planner**: LTX Simple Image-to-Video
- **Storyboard Illustration Prompt**: Storyboard First Frame
- **Storyboard Video Prompt**: Narration Passthrough
- **Use Storyboard Template**: On

Przy karcie GPU z 8 GB pamięci VRAM zacznij od jednej klatki kluczowej w 480p. Kiedy taka próba się powiedzie, przejdź do trzech klatek kluczowych i wyższych rozdzielczości. Połączenie z aplikacją ComfyUI, symbole zastępcze i pełną procedurę testową opisuje przewodnik [Storyboardy LTX 2.3 w Game Mode](ltx-2-3-storyboards.md).

### Prezentacja Storyboard Optimized to nie przełącznik agenta

Prezentacja **Storyboard Optimized** z kreatora konfiguracji gry zmienia prompt narracji GM tak, żeby tury zawierały wyraźniejsze punkty zaczepienia dla obrazu. Nie instaluje ani nie włącza agenta Storyboard, nie uruchamia automatycznych materiałów i nie wybiera połączeń obrazowych ani wideo.

Agent Storyboard działa i z prezentacją Standard, i ze Storyboard Optimized. Instalacja oraz włączenie agenta to osobne kroki.

### Podgląd w trybie Game Mode

Opcja **Floating viewer** to przeciągany panel o zmiennym rozmiarze, wyświetlany nad grą. Podąża za miejscem czytania w narracji GM i pokazuje odpowiadającą mu klatkę. Wideo odtwarza się, gdy jest gotowe, a w przeciwnym razie widać obraz klatki.

Opcja **Game background** umieszcza aktywną klatkę za kontrolkami gry. Zastępuje wtedy zwykłe generowane tło sceny, więc przycisk **Generate background** jest nieaktywny. Klipy w tle odtwarzają się raz i zostają na ostatniej klatce; kontrolki gry dają powtórzenie, odtwarzanie/pauzę i wyciszenie.

Zamknięcie pływającego podglądu ukrywa go na czas bieżącej tury. Do ponownego otwarcia służy **Gallery > View storyboard**.

## Prompty obrazów i spójność postaci

Wybrany planer i końcowy prompt obrazu robią co innego:

- Planer decyduje, które momenty pokazać, i opisuje zawartość wizualną każdej klatki.
- Końcowy szablon obrazu dokłada strukturę pod dostawcę, wygląd dopasowanych postaci, obsługę referencji, kontekst lokacji, kierunek artystyczny kampanii oraz instrukcje dotyczące obrazu.

Jeśli planer zwraca już dokładnie taką składnię promptu, jakiej oczekuje dostawca obrazów, użyj szablonu przepuszczającego, na przykład `${scenePrompt}`. Opcję **Use the final image template** wyłącz tylko wtedy, gdy chodzi o celowe pominięcie wybranego formatera. Wymagane instrukcje dotyczące obrazu obowiązują nadal.

Dla większej spójności postaci:

- Dbaj o to, żeby pola Appearance na kartach postaci były konkretne i aktualne.
- Zostaw opcję **Attach Card Appearance** włączoną, chyba że wybrany planer sam powtarza wszystkie potrzebne szczegóły wyglądu.
- Zostaw opcję **Send Avatar References** włączoną, jeśli dostawca przyjmuje referencje, a awatary odpowiadają zamierzonemu wyglądowi.
- Trzymaj w kadrze niewielką, wyraźnie widoczną obsadę. Storyboard dołącza tylko referencje dopasowanych, widocznych postaci i person, a nie wszystkich postaci z czatu.

Opcja **Use NovelAI character prompts** zmienia tylko żądania wysyłane przez obsługiwane oficjalne połączenia NovelAI V4/V4.5. Pozostali dostawcy korzystają ze wspólnej ścieżki promptu nawet przy włączonym przełączniku.

## Koszty i wydajność

Każda klatka kluczowa to osobne zadanie generowania obrazu. Storyboardy animowane dokładają jedno zadanie wideo do każdej udanej klatki kluczowej. Animowany storyboard z trzema klatkami może więc wysłać trzy żądania obrazów i trzy żądania wideo.

Przy sprawdzaniu nowego dostawcy albo lokalnego przepływu pracy zacznij od obrazów nieruchomych i jednej klatki kluczowej. Liczbę klatek, długość klipu i częstotliwość generowania automatycznego zwiększaj dopiero wtedy, gdy podstawowa ścieżka działa stabilnie.

## Starsze gry z poprzedniego systemu storyboardów

Storyboard jest teraz agentem do pobrania, ale istniejące czaty w trybie Game Mode mogą wciąż mieć ustawienia zapisane przez dawny, wbudowany interfejs storyboardów. Po instalacji pakietu Marinara zachowuje te wartości jako własne ustawienia czatu i nie kasuje działającej konfiguracji gry.

Dlatego starsza gra może działać inaczej, niż wynika to z aktualnych ustawień domyślnych agenta. Otwórz **Chat Settings > Agents > Storyboards** i użyj przycisku przywracania przy każdym polu, które ma znowu dziedziczyć wartość domyślną agenta Storyboard.

Stare ustawienia to dane z migracji, a nie druga implementacja storyboardów. Bieżące generowanie nadal wymaga, żeby pakiet Storyboard był zainstalowany i aktywny w danej grze.

## Rozwiązywanie problemów

### Brak agenta Storyboard w panelu Chat Settings

- Zainstaluj pakiet **Storyboard** w **Agents > Download Agents**.
- Użyj czatu w trybie Roleplay albo Game Mode; tryb Conversation nie jest obsługiwany.
- Sprawdź, czy wersja pakietu pasuje do zainstalowanej wersji aplikacji Marinara Engine.

### Przycisk Create storyboard jest dostępny, ale generowanie się nie udaje

- Włącz w czacie opcje **Enable Agents** i **Enable Storyboards**.
- Wskaż poprawne połączenie do generowania obrazów: na karcie Storyboard w trybie Roleplay, w ustawieniach gry albo w globalnej konfiguracji agenta Storyboard.
- Poczekaj na koniec odpowiedzi AI albo tury GM, zanim spróbujesz ponownie.

### Tryb Roleplay nie utworzył odcinka automatycznego

- Wybierz **Still images** albo **Animations** zamiast **Manual only**.
- Poczekaj na nowo zakończoną odpowiedź AI. Otwarcie czatu nie uzupełnia starych wiadomości wstecz.
- Sprawdź pole **Messages per episode**. Od ostatniego udanego storyboardu musi się uzbierać dość nowych wiadomości użytkownika i AI.
- Nieudane uruchomienie nie przesuwa punktu odniesienia, więc poszukaj pierwotnego błędu dostawcy albo błędu parsowania w logu serwera (dzienniku serwera).

### Obrazy się pojawiają, ale wideo nie

- W trybie Roleplay wybierz **Animations**. W trybie Game Mode włącz opcję **Automatic Storyboard Animations**.
- Wskaż połączenie typu Video Generation.
- Sprawdź, czy połączenie wideo obsługuje wejście image-to-video.
- Zajrzyj do zakładki **Videos** w panelu Gallery. Klip może być gotowy później niż obraz jego klatki kluczowej.
- Jeśli po błędzie modelu LLM planowanie przeszło na ścieżkę zapasową, Marinara może zachować obrazy zapasowe i pominąć wideo w tym uruchomieniu.

### Storyboard jest niepełny albo stoi w miejscu

Jedno lub więcej zadań u dostawcy mogło się nie powieść, przekroczyć limit czasu albo trafić na limit zapytań lub treści. Jeśli dostawca działa poprawnie, ale powoli, zwiększ wartość `IMAGE_GEN_TIMEOUT_MS` albo `VIDEO_GEN_TIMEOUT_MS` w pliku `.env`, a potem uruchom ponownie aplikację Marinara Engine, bo te wartości odczytują się przy starcie.

Włącz tryb Debug i poszukaj w logu serwera hasła `storyboard`, żeby przejrzeć planer, gotowy prompt obrazu, wybór referencji i prompt wideo. Logi w trybie Debug mogą zawierać prywatny tekst czatu i prompty; wyczyść je przed udostępnieniem.

## Powiązane przewodniki

- [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md)
- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)
- [Game Mode: pierwsze kroki](getting-started.md)
- [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md)
- [Dostawcy generowania obrazów](../media/image-providers.md)
- [Generowanie wideo sceny](../media/scene-video.md)
- [Storyboardy LTX 2.3 w Game Mode](ltx-2-3-storyboards.md)
