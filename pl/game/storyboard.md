# Przewodnik po agencie Storyboard

Agent **Storyboard** do pobrania zamienia gotowy tekst fabularny w uporządkowane obrazy klatek kluczowych, a opcjonalnie także w krótkie klipy image-to-video. Działa w trybach Game Mode i Roleplay. Czaty Conversation z niego nie korzystają.

Pakiet Storyboard dostarcza prompty planujące (prompt to tekst, który Marinara wysyła do AI), wartości domyślne i kontrolki osobne dla każdego czatu. Marinara generuje materiały, zapisuje wyniki w panelu Gallery (galeria) i pokazuje je w czacie albo w podglądzie gry. Ten przewodnik zaczyna od trybu Game Mode. Sposób pracy w trybie Roleplay opisuje dalej sekcja [Storyboardy w trybie Roleplay](#roleplay-storyboards). Pozostałe funkcje trybu Roleplay opisuje przewodnik [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md).

- **Game Mode** korzysta z jednej zakończonej tury narracji GM (Game Master, czyli mistrz gry). Ma osobne przełączniki **Automatic Storyboard Illustrations** (automatyczne ilustracje storyboardu) i **Automatic Storyboard Animations** (automatyczne animacje storyboardu) oraz działanie **Gallery → Create storyboard** (galeria, utworzenie storyboardu) dla ostatniej tury GM. Storyboard wyświetla się w pływającym podglądzie albo jako tło gry, zsynchronizowany z narracją, a do planowania służą osobne planery obrazów nieruchomych i animacji.
- **Roleplay** korzysta z zakończonych wiadomości od ostatniego udanego odcinka. Do wyboru automatyzacji są opcje **Manual only** (tylko ręcznie), **Still images** (obrazy statyczne) albo **Animations** (animacje), a **Gallery → Create storyboard** działa na ostatniej zakończonej odpowiedzi AI. Storyboard wyświetla się w czacie, pod odpowiedzią kończącą odcinek, a do planowania służą episode contract, visual style, opcjonalny animation addon i output contract.

Oba tryby zapisują obrazy klatek kluczowych w zakładce **Images** (obrazy) panelu Gallery, a klipy w zakładce **Videos** (filmy).

## Instalacja agenta

1. Kliknij ikonę Sparkles, żeby otworzyć panel **Agents** (agenci).
2. Wybierz **Agent Organizer** (organizowanie agentów).
3. Otwórz pakiet **Storyboard** i kliknij **Install** (instalacja).
4. Otwórz czat w trybie Game Mode albo Roleplay, a potem **Chat Settings → Agents** (ustawienia czatu, agenci).
5. Włącz **Enable Agents** (włączenie agentów), a potem **Enable Storyboards** (włączenie storyboardów) na karcie agenta Storyboard.

Instalacja udostępnia agenta, ale nie włącza go w każdym czacie. Ponowne uruchomienie aplikacji Marinara Engine nie jest potrzebne.

Jeśli to nie zadziałało i agenta Storyboard nie ma w Chat Settings, sprawdź, czy pakiet jest zainstalowany, czy czat działa w trybie Game Mode albo Roleplay i czy wersja pakietu działa z twoją wersją aplikacji Marinara Engine.

## Storyboardy w trybie Game Mode

Storyboard w trybie Game Mode bierze za źródło fabuły dokładnie jedną zakończoną turę narracji GM. Usuwa ukryte znaczniki poleceń GM, planuje uporządkowane klatki i przypina każdą z nich do zakresu czytelnych fragmentów tury. Podgląd zmienia klatki w miarę przesuwania się czytelnika przez te fragmenty.

### Tworzenie storyboardu w grze

**Zanim zaczniesz:** gra potrzebuje konta do generowania obrazów (własnego konta gry albo konta z globalnej konfiguracji agenta Storyboard). Zobacz [Dostawcy generowania obrazów i konfiguracja](../media/image-providers.md).

1. Zainstaluj agenta Storyboard i otwórz czat w trybie Game Mode.
2. Otwórz **Chat Settings → Agents**, włącz **Enable Agents**, a potem **Enable Storyboards**.
3. Doprowadź do końca turę narracji GM.
4. Otwórz **Chat Settings → Gallery** i kliknij **Create storyboard**.

Zamknięty podgląd otworzysz ponownie przyciskiem **View storyboard** (wyświetlenie storyboardu) w panelu Gallery. Generowanie ręczne korzysta z bieżącego ustawienia animacji: przy włączonej opcji **Automatic Storyboard Animations** ręczny storyboard prosi też o klipy.

Jeśli to nie zadziałało, zobacz [Rozwiązywanie problemów](#troubleshooting).

### Automatyczne storyboardy w grze

Karta agenta Storyboard ma dwa przełączniki:

- **Automatic Storyboard Illustrations** tworzy nieruchome klatki kluczowe po zakończonej turze GM.
- **Automatic Storyboard Animations** tworzy dodatkowo klip do każdej klatki kluczowej. Włączenie animacji włącza też ilustracje, a wyłączenie ilustracji wyłącza animacje.

Generowanie automatyczne działa tylko wtedy, gdy agent jest aktywny w danej grze, i nie tworzy ponownie storyboardu dla tury, która już go ma. Jeśli chcesz kolejny storyboard dla ostatniej tury, użyj ręcznego działania w panelu Gallery.

Jeśli w ustawieniach generowania włączona jest opcja **Expose media prompts before sending** (pokazywanie promptów mediów przed wysłaniem), ręczny storyboard w grze może pokazać gotowe prompty obrazów do sprawdzenia. Storyboardy automatyczne pomijają to sprawdzenie, żeby rozgrywka się nie zatrzymywała.

### Ustawienia gry

Otwórz **Chat Settings → Agents → Storyboards** (ustawienia czatu, agenci, storyboardy).

| Ustawienie | Domyślnie w agencie | Za co odpowiada |
| --- | --- | --- |
| **Enable Storyboards** | Off w każdym czacie | Włącza zainstalowanego agenta w tej grze. |
| **Automatic Storyboard Illustrations** | Wynika z ustawienia Automatic generation | Nieruchome klatki kluczowe po każdej turze GM. |
| **Automatic Storyboard Animations** | Wynika z ustawienia Automatic generation | Klipy MP4 do każdej klatki kluczowej. |
| **Keyframes per Turn** | 3, zakres 1-200 | Docelowa liczba klatek. Krótkie tury mogą dać ich mniej. |
| **Animation Clip Duration** | 5 sekund, zakres 1-15 | Żądana długość każdego klipu. Usługa może ją przyciąć. |
| **Viewer Display** | Floating | Przeciągany podgląd albo pełne tło gry. |
| **Illustration Planner** | Still Keyframes | Planuje gotowe ilustracje nieruchome. |
| **Animation Planner** | Comic Page Animation | Planuje pierwsze klatki gotowe do animacji oraz wskazówki ruchu. |
| **Use Storyboard Template** | On | Stosuje wybrany końcowy formater ilustracji. |
| **Storyboard Illustration Prompt** | Game Scene Illustration | Formatuje zaplanowaną klatkę pod usługę obrazów. |
| **Storyboard Video Prompt** | Cinematic Scene Video | Formatuje pierwszą klatkę i plan ruchu pod usługę wideo. |

Pakiet dostarcza też planery NovelAI, komiksowe, mangowe, anime oraz nastawione na LTX. Sam wybór planera animacji nie włącza generowania wideo. Nadal potrzebne są opcja **Automatic Storyboard Animations** i konto wideo.

Każdy czat może nadpisać ustawienia domyślne agenta. Panel Chat Settings oznacza wartości odziedziczone jako **Using agent default** (używana wartość domyślna agenta), a po nadpisaniu wartości pokazuje przycisk przywracania.

### Jak powstaje storyboard w grze

Tryb Game Mode ma osobne planery dla obrazów nieruchomych i animacji.

```text
completed GM narration
  -> still or animation planner
  -> Storyboard Illustration Prompt
  -> image account
  -> optional Storyboard Video Prompt
  -> video account
```

Planer wybiera momenty fabularne i układa je w kolejności. Prompt ilustracji to formater pod usługę, a nie kolejny planer. Przy włączonych animacjach planer animacji tworzy dokładny opis pierwszej klatki i wskazówkę ruchu, a prompt wideo zamienia tę wskazówkę w końcowe żądanie.

### Podgląd w grze

- **Floating viewer** (pływający podgląd) to przeciągany panel o zmiennym rozmiarze, wyświetlany nad grą. Podąża za miejscem czytania w narracji i pokazuje odpowiadającą mu klatkę. Wideo odtwarza się, gdy jest gotowe, a w przeciwnym razie widać obraz klatki. Zamknięcie podglądu ukrywa go na czas bieżącej tury. Do ponownego otwarcia służy **Gallery → View storyboard**.
- **Game background** (tło gry) umieszcza aktywną klatkę za resztą ekranu. Gdy jest włączone, zastępuje generowane tło sceny, więc przycisk **Generate background** (generowanie tła) jest niedostępny. Klipy w tle odtwarzają się raz i zostają na ostatniej klatce.

Żeby odtworzyć klip ponownie, odtworzyć go lub wstrzymać albo wyciszyć, otwórz **Game controls** (sterowanie grą), czyli przycisk z kontrolerem do gier blisko prawego górnego rogu czatu. Na komputerze otwiera się w oknie, a na telefonie jako panel. Jeśli przeniesiono go do Chat Settings, otwórz tam sekcję **Game controls**.

### Prezentacja Storyboard Optimized to nie przełącznik agenta

Prezentacja **Storyboard Optimized** z kreatora zmienia prompt narracji GM tak, żeby tury zawierały wyraźniejsze punkty zaczepienia dla obrazu, nadające się do sfilmowania. Nie instaluje ani nie włącza agenta Storyboard, nie włącza automatycznych materiałów i nie wybiera kont obrazów ani wideo. Agenta można używać zarówno z prezentacją **Standard**, jak i **Storyboard Optimized**. Zainstaluj i włącz agenta osobno.

### Przepisy dla trybu Game Mode

Każdy przepis łączy łańcuch agenta Storyboard z pozostałymi ustawieniami gry i usługi. Zastosuj nazwany łańcuch, jeśli twój pakiet go oferuje, albo wybierz wymienione opcje ręcznie.

#### Google Comic Storyboards

Łańcuch: **Illustration Planner** Still Keyframes, **Animation Planner** Comic Page Animation, **Storyboard Illustration Prompt** Game Scene Illustration, **Storyboard Video Prompt** Comic Page Video, **Use Storyboard Template** On.

Lista kontrolna gry:

- **Illustrator**: On (krok Features kreatora)
- Konto obrazów: Google/Nano Banana, **Image Style**: Default; zostaw styl artystyczny wygenerowany przy konfiguracji
- **Automatic Storyboard Illustrations**: On
- **Automatic Storyboard Animations**: Off
- **Keyframes per Turn**: 3
- Konto wideo: None

Powstają wtedy zwykłe storyboardy z obrazów nieruchomych. Zapisany łańcuch animacji Comic Page zaczyna działać dopiero wtedy, gdy później wybierzesz konto wideo i włączysz **Automatic Storyboard Animations**.

#### NovelAI Direct Tags

Łańcuch: **Illustration Planner** NovelAI Keyframes. W polu **Storyboard Illustration Prompt** utwórz własną opcję, której prompt zawiera wyłącznie poniższy tekst. Ustaw **Use Storyboard Template** na On. Ustawienia Animation Planner i Video Prompt zostaw bez zmian.

```text
${scenePrompt}
```

Lista kontrolna gry:

- **Image Style**: Danbooru; usuń opisowy tekst z pola **Style text** w profilu Danbooru
- **Use Campaign Art Style**: Off
- **Attach Card Appearance**: Off
- **Send Avatar References**: Off
- **Use NovelAI Character Prompts**: Off
- **Queue media generation requests**: On
- Dostrój tagi pozytywne, negatywne i ilustracyjne według potrzeb

Szablon przepuszczający wysyła zwięzłe tagi NovelAI z planera i nie opakowuje ich w zwykły opisowy formater.

#### Local Krea 2 + LTX 2.3

Łańcuch: **Illustration Planner** Still Keyframes jako rozwiązanie zapasowe dla samych obrazów nieruchomych, **Animation Planner** LTX Simple Image-to-Video, **Storyboard Illustration Prompt** Storyboard First Frame, **Storyboard Video Prompt** Narration Passthrough, **Use Storyboard Template** On.

Na karcie GPU z 8 GB pamięci VRAM zacznij od jednej klatki kluczowej w 480p. Gdy to zadziała, przechodź stopniowo do trzech klatek kluczowych i większych rozmiarów. Konto ComfyUI, symbole zastępcze i pełny test opisuje przewodnik [Storyboardy LTX 2.3 w Game Mode](ltx-2-3-storyboards.md).

<a id="roleplay-storyboards"></a>

## Storyboardy w trybie Roleplay

Storyboardy w trybie Roleplay łączą zakończone wymiany wiadomości w odcinek wizualny, wyświetlany pod odpowiedzią AI, która go kończy.

### Tworzenie storyboardu w trybie Roleplay

1. Zainstaluj agenta Storyboard i włącz go w czacie w trybie Roleplay.
2. W **Chat Settings → Agents → Storyboards** wybierz **Prompt connection** (połączenie promptu) i **Image model** (model obrazów) albo zostaw w nich **Use global default** (użycie globalnej wartości domyślnej), jeśli globalna konfiguracja jest kompletna.
3. Wybierz **Automatic mode** (tryb automatyczny):
   - **Manual only**: bez odcinków automatycznych. **Create storyboard** tworzy na żądanie odcinek z obrazów nieruchomych.
   - **Still images**: automatycznie tworzy odcinek z ilustracjami.
   - **Animations**: automatycznie tworzy obrazy klatek kluczowych i klip do każdej klatki. Wymaga konta wideo.
4. Ustaw **Messages per episode** (wiadomości na odcinek) i **Keyframes per episode** (klatki kluczowe na odcinek).
5. Doprowadź do końca nową odpowiedź AI albo otwórz **Chat Settings → Gallery** i kliknij **Create storyboard**.

W storyboardzie z kilkoma klatkami kluczowymi przechodź między klatkami strzałkami. Klatka animowana pokazuje swój klip bezpośrednio w czacie, a gdy klip jest w przygotowaniu albo niedostępny, pokazuje swój obraz.

### Jak działa odstęp między odcinkami

Odstęp to liczba nowych wiadomości użytkownika i AI, które muszą się zebrać między udanymi storyboardami automatycznymi. Liczą się obie role, a odcinek obejmuje nowe wiadomości w kolejności. Domyślna wartość to 1, więc kolejna zakończona odpowiedź AI może od razu dać odcinek. Większa wartość pozwala zebrać więcej dialogu i akcji. Materiał źródłowy ogranicza się do 20 ostatnich wiadomości i 12 000 znaków, więc długi czat nie stworzy żądania planowania bez granic.

Licznik przesuwa się dopiero po zapisaniu pełnego albo częściowego storyboardu, więc nieudany odcinek nie zużywa materiału źródłowego. Otwarcie istniejącego czatu nie uzupełnia wstecz starych odpowiedzi. Generowanie automatyczne czeka na nowo zakończoną odpowiedź AI.

### Biblioteka promptów w trybie Roleplay

Tryb Roleplay składa jedno żądanie do planera z czterech wybranych promptów:

| Ustawienie | Domyślnie | Do czego służy |
| --- | --- | --- |
| **Episode contract** | Completed Roleplay Episode | Wybiera momenty fabularne potwierdzone w źródle i zachowuje ich kolejność z wiadomości. |
| **Visual style** | Normal / Anime | Oprawa wizualna każdej klatki kluczowej. Inne: NovelAI, Comic, Colored Manga, B&W Manga. |
| **Animation addon** | Simple Storyboard Motion | Używany tylko w klipach. Dodaje jedną wykonalną akcję, zachowanie kamery, dialog i dźwięk ze źródła, tło dźwiękowe oraz zatrzymanie kadru na końcu. |
| **Output contract** | Roleplay Keyframe JSON | Ustrukturyzowane pola klatek kluczowych, które zwraca planer. |

Potem **Storyboard Illustration Prompt** formatuje każdą pierwszą klatkę pod usługę obrazów, a przy włączonych klipach **Storyboard Video Prompt** formatuje plan ruchu. Żeby je edytować, otwórz zwiniętą **Prompt library** (biblioteka promptów) w Stage 1. Przyciskiem **Add option** (dodanie opcji) dodasz własny prompt. Potem zmień jego nazwę, dopisz krótki opis i popraw treść. Wbudowane opcje da się przywrócić do wartości domyślnych. Edycja stylu wizualnego w trybie Roleplay nie zmienia planerów trybu Game Mode.

### Storyboard i Illustrator razem

Storyboard to agent osobny od agenta Illustrator, a ręczne działania agenta Illustrator pozostają dostępne. Gdy storyboard w trybie Roleplay ma ustawione **Still images** albo **Animations**, Marinara pomija dla tej odpowiedzi zwykły automatyczny obraz agenta Illustrator, żeby obaj agenci nie tworzyli konkurencyjnych materiałów. **Manual only** zostawia ścieżkę agenta Illustrator bez zmian.

## Ustawienia agenta Storyboard

Otwórz panel **Agents**, wybierz **Storyboard** i otwórz jego konfigurację. Te wartości są domyślne dla czatów, które nie mają własnych ustawień.

| Ustawienie | Domyślnie | Do czego służy |
| --- | --- | --- |
| Agent connection | Wybrane przez ciebie konto agenta | Planuje storyboard za pomocą modelu. |
| **Image model** | **Use the chat image connection** | Tworzy każdą klatkę kluczową. Gdzieś w łańcuchu zapasowym musi być konto do generowania obrazów. |
| **Video connection** | **Use the chat video connection** | Tworzy klipy, gdy animacje są włączone. |
| **Automatic generation** | Still images | Początkowe zachowanie automatyczne w nowo aktywowanych czatach. |
| **Keyframes per turn** | 3, zakres 1-200 | Docelowa liczba uporządkowanych klatek. |
| **Clip seconds** | 5, zakres 1-15 | Żądana długość każdego klipu. |
| **Viewer display** | Floating viewer | Domyślny podgląd w trybie Game Mode. W trybie Roleplay storyboardy zawsze wyświetlają się w czacie. |
| **Default Roleplay episode interval** | 1, zakres 1-100 | Ilość nowego materiału z trybu Roleplay potrzebna między odcinkami automatycznymi. |
| **Attach Card Appearance** | On | Dodaje do promptów obrazu wygląd dopasowanych postaci. Karta lub persona z włączonym **Image Appearance Override** (osobny opis wyglądu do obrazów) przekazuje ten tekst zamiast pola **Appearance** (wygląd). |
| **Send Avatar References** | On | Wysyła awatary dopasowanych postaci i person, gdy usługa obrazów przyjmuje referencje. |
| **Use the final image template** | On | Formatuje zaplanowaną klatkę, zanim trafi do usługi obrazów. W czacie gry to opcja **Use Storyboard Template**. |
| **Use NovelAI character prompts** | On | Natywne prompty dla poszczególnych postaci, tylko na obsługiwanych oficjalnych kontach NovelAI V4 i V4.5. Inne usługi korzystają ze wspólnej ścieżki promptu. |

W trybie Game Mode biblioteka ma dwie ścieżki planowania, wybierane zależnie od tego, czy gra tworzy obrazy nieruchome, czy klipy: **Still planner** (planer obrazów nieruchomych, domyślnie Still Keyframes) i **Animation planner** (planer animacji, domyślnie Comic Page Animation). Treść planerów da się edytować w globalnej konfiguracji agenta, a każdy czat gry wybiera spośród opcji we własnych ustawieniach.

Po planowaniu wspólne formatery tworzą końcowe żądania: **Default image prompt** (domyślnie Game Scene Illustration) i **Default video prompt** (domyślnie Cinematic Scene Video). Każdy numerowany etap ma własną zwiniętą **Prompt library**: Stage 2 zawiera formatery obrazu, Stage 3 planery ruchu uwzględniające obraz, a Stage 4 formatery przekazujące prompt wideo. Wśród opcji obrazu są też **Storyboard Illustration** i **Storyboard First Frame**. Wśród opcji wideo są **Anime Game Video**, **Comic Page Video** i **Narration Passthrough**. Czaty gry i czaty Roleplay mogą wybrać różne formatery.

Opcja **Image-aware shot planning** (planowanie ujęć z uwzględnieniem obrazu) w Stage 3 uwzględnia też pole **Video prompting instructions** (instrukcje do promptów wideo) konta wideo. Wpisz w tym polu w edytorze konta, czego oczekuje twój model wideo, na przykład sposób opisywania pracy kamery, długość promptu albo wskazówki dotyczące dźwięku.

Konta wybiera się w każdym trybie nieco inaczej. Tryb Roleplay ma dla każdego czatu osobne selektory promptu, obrazu i wideo, a **Use global default** dziedziczy konfigurację agenta Storyboard. Tryb Game Mode korzysta z własnych kont planowania, obrazu i wideo, jeśli są ustawione, a w przeciwnym razie sięga po wartości domyślne agenta. Obrazy nieruchome wymagają konta do generowania obrazów. Animacje wymagają udanego obrazu klatki kluczowej i konta wideo.

## Prompty obrazów i spójność postaci

Planer decyduje, które momenty pokazać, i opisuje zawartość wizualną każdej klatki. Końcowy szablon obrazu dokłada strukturę pod usługę, wygląd dopasowanych postaci, obsługę referencji, kontekst lokacji, kierunek artystyczny kampanii oraz instrukcje dotyczące obrazu.

Jeśli planer zwraca już dokładnie taką składnię, jaką ma otrzymać usługa obrazów, użyj szablonu przepuszczającego, na przykład `${scenePrompt}`. Opcję **Use the final image template** wyłącz tylko wtedy, gdy celowo chcesz pominąć formater. Wymagane instrukcje dotyczące obrazu nadal obowiązują.

Dla bardziej spójnych postaci:

- Dbaj o to, żeby pola Appearance na kartach postaci były konkretne i aktualne.
- Zostaw **Attach Card Appearance** włączone, chyba że planer sam powtarza potrzebne szczegóły.
- Zostaw **Send Avatar References** włączone, gdy usługa przyjmuje referencje, a awatary odpowiadają zamierzonemu wyglądowi.
- Wybieraj niewielką, wyraźnie widoczną obsadę w każdej klatce. Storyboard uwzględnia tylko dopasowane, widoczne postacie i persony, a nie wszystkich uczestników czatu.

## Koszty i wydajność

Każda klatka kluczowa to osobne zadanie generowania obrazu. Storyboardy animowane dokładają jedno zadanie wideo do każdej udanej klatki kluczowej, więc animowany storyboard z trzema klatkami może wysłać trzy żądania obrazów i trzy żądania wideo. Przy testowaniu nowej usługi albo lokalnej konfiguracji zacznij od obrazów nieruchomych i jednej klatki kluczowej. Liczbę klatek, długość klipu i odstęp generowania automatycznego zwiększaj dopiero wtedy, gdy podstawowa ścieżka działa.

## Gry ze starszego systemu storyboardów

Istniejące czaty gry mogą mieć ustawienia zapisane przez starszy, wbudowany interfejs storyboardów. Po instalacji pakietu Marinara zachowuje je jako własne ustawienia czatu, więc starsza gra może działać inaczej, niż wynika z bieżących wartości domyślnych agenta. Otwórz **Chat Settings → Agents → Storyboards** i użyj przycisku przywracania przy każdym polu, które ma znowu dziedziczyć wartość domyślną agenta. Te ustawienia to wyłącznie dane z migracji. Generowanie nadal wymaga, żeby pakiet był zainstalowany i włączony w danej grze.

<a id="troubleshooting"></a>

## Rozwiązywanie problemów

### Przycisk Create storyboard jest dostępny, ale generowanie się nie udaje

- Włącz w czacie **Enable Agents** i **Enable Storyboards**.
- Wybierz poprawne konto do generowania obrazów na karcie Storyboard w trybie Roleplay, w ustawieniach gry albo w globalnej konfiguracji agenta Storyboard.
- Poczekaj, aż odpowiedź AI albo GM się zakończy, i spróbuj ponownie.

### Tryb Roleplay nie utworzył odcinka automatycznego

- Wybierz **Still images** albo **Animations**, a nie **Manual only**.
- Poczekaj na nowo zakończoną odpowiedź AI. Otwarcie czatu nie uzupełnia wstecz starych wiadomości.
- Sprawdź **Messages per episode**. Musi się zebrać dość nowych wiadomości użytkownika i AI.
- Nieudane uruchomienie nie przesuwa licznika, więc poszukaj w logu serwera pierwotnego błędu usługi albo błędu parsowania.

### Obrazy się pojawiają, ale wideo nie

- W trybie Roleplay wybierz **Animations**. W trybie Game Mode włącz **Automatic Storyboard Animations**.
- Wybierz konto typu Video Generation, które obsługuje wejście image-to-video.
- Sprawdź zakładkę **Videos** w panelu Gallery. Klip może być gotowy później niż obraz jego klatki kluczowej.
- Jeśli po błędzie modelu planowanie przeszło na ścieżkę zapasową, Marinara może zachować obrazy zapasowe i pominąć wideo w tym uruchomieniu.

### Storyboard jest niepełny albo stoi w miejscu

Zadanie w usłudze mogło się nie powieść, przekroczyć limit czasu albo trafić na limit zapytań lub treści. Jeśli usługa działa poprawnie, ale powoli, zwiększ `IMAGE_GEN_TIMEOUT_MS` albo `VIDEO_GEN_TIMEOUT_MS` w pliku `.env`, a potem uruchom aplikację Marinara Engine ponownie, bo te wartości są odczytywane przy starcie. Zobacz [Konfiguracja serwera](../CONFIGURATION.md).

Włącz tryb Debug i poszukaj w logu serwera hasła `storyboard`, żeby zobaczyć planer, gotowy prompt obrazu, wybór referencji i prompt wideo. Logi w trybie Debug mogą zawierać prywatny tekst czatu, więc wyczyść je przed udostępnieniem.

## Powiązane przewodniki

- [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md)
- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)
- [Game Mode: pierwsze kroki](getting-started.md)
- [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md)
- [Dostawcy generowania obrazów i konfiguracja](../media/image-providers.md)
- [Generowanie wideo sceny](../media/scene-video.md)
- [Storyboardy LTX 2.3 w Game Mode](ltx-2-3-storyboards.md)
