# Awatary 2D i 3D

Dwaj agenci do pobrania dają postaciom i personom animowany awatar, który reaguje, gdy odpowiedź się streamuje. **2D Avatars** (awatary 2D) pokazuje sprite'y w stylu PNGTuber albo awatary mesh. **3D Avatars** (awatary 3D) pokazuje modele VRM, MMD PMX, GLB i FBX. Miny podążają za odpowiedzią, a usta poruszają się zgodnie z tekstem albo z syntezą mowy.

Modele Live2D nie są obsługiwane. Licencja Live2D wymaga osobnej umowy nawet w przypadku darmowych aplikacji open source, a środowiska uruchomieniowego Live2D nie można dołączyć do aplikacji Marinara Engine.

## Instalowanie agentów awatarów

Obaj agenci są dostępni na ekranie **Agent Organizer** (organizowanie agentów) w każdej instalacji, w filtrach **Roleplay** i **Game**. Wymagają aplikacji Marinara Engine w wersji 2.5.1 lub nowszej. Starsza wersja aplikacji odmawia ich instalacji. Każdego z nich pobiera się osobno, więc zainstaluj tylko tego agenta, którego chcesz. Obaj działają dla postaci i person w czatach w trybie Roleplay i Game, a podczas czatu nie wysyłają żadnych dodatkowych zapytań do twoich modeli AI.

1. Otwórz **Agents → Agent Organizer** (agenci, organizowanie agentów) i zainstaluj **2D Avatars**, **3D Avatars** albo obu agentów. Żaden z nich nie wymaga restartu.
2. Skonfiguruj każdy awatar na stronie agenta (zobacz [Konfigurowanie awatara](#set-up-an-avatar)).
3. W czacie w trybie Roleplay albo Game otwórz **Chat Settings → Agents → Misc Agents** (ustawienia czatu, agenci, agenci różni) i dodaj agenta.

Awatar pojawia się w czacie w trybie Roleplay, Visual Novel albo Game, gdy agenci są włączeni, a odpowiedni agent jest dodany. Działa z agentem Expression Engine i bez niego. Awatar nie ukrywa sprite'a całej sylwetki, więc jeśli awatar ma go zastąpić, wyłącz ten sprite samodzielnie. Awatary stoją tam, gdzie stałby sprite całej sylwetki, i mają ten sam rozmiar.

<a id="set-up-an-avatar"></a>

## Konfigurowanie awatara

Otwórz panel **Agents**, otwórz **2D Avatars** albo **3D Avatars** i skorzystaj z sekcji **Avatars** (awatary) u góry strony.

1. W polu **Character or persona** (postać lub persona) wybierz, kto dostanie awatar. Nazwy oznaczone "(has an avatar)" mają już awatar.
2. W polu **Avatar type** (typ awatara) wybierz rodzaj. 2D Avatars oferuje **PNGTuber sprites** (sprite'y PNGTuber) i **Mesh avatar** (awatar mesh). 3D Avatars oferuje **VRM model** (model VRM), **MMD PMX model** (model MMD PMX) i **GLB or FBX model** (model GLB lub FBX).
3. Skonfiguruj go w sekcji tego typu poniżej: użyj swoich sprite'ów albo zaimportuj plik, wybierz minę dla każdej emocji albo usuń awatar.
4. Sprawdź go w sekcji **Preview** (podgląd). **Try a face** (wypróbowanie miny) przełącza emocje, a **Talk** (mówienie) porusza ustami. Gdy nie ma jeszcze nic do pokazania, podgląd wyświetla przykładowy awatar.
5. Włącz **Show this avatar in chats** (pokazywanie tego awatara w czatach).

**Show this avatar in chats** włącza lub wyłącza skonfigurowany awatar bez usuwania go. Przełącznik pozostaje wyłączony, dopóki nie skonfigurujesz awatara albo nadających się do użycia sprite'ów. Sam obrazek profilowy nie tworzy awatara 2D.

**Movement** (ruch) ma trzy przełączniki dla każdego typu: **Lip sync** (synchronizacja ust) porusza ustami, **Blinking** (mruganie) co kilka sekund mruga oczami, a **Idle motion** (ruch w spoczynku) sprawia, że awatar oddycha i kołysze się podczas czekania. Jeśli postać ma więcej niż jeden typ awatara, **Show this one** (pokazywanie tego typu) wybiera typ używany w czatach. Gdy agent tego typu jest w czacie wyłączony, czat pokazuje inny typ, którego agent jest włączony. Usunięcie typu kasuje jego pliki. Twoje sprite'y zostają.

### Zmiana rozmiaru i przesuwanie awatarów w czacie

1. Otwórz **Chat Settings → Agents** (ustawienia czatu, agenci) i otwórz **Avatars**.
2. Wybierz awatar z listy i użyj jego suwaka rozmiaru.
3. Wybierz **Arrange** (rozmieszczanie), żeby przesuwać awatary. Przeciągaj je myszą albo palcem albo ustaw fokus na jednym z nich i użyj klawiszy strzałek (przytrzymaj <kbd>Shift</kbd>, żeby przesunąć dalej).
4. Wybierz **Done** (gotowe). Awatary zostają w wybranych przez ciebie miejscach, a kliknięcia znów trafiają do czatu. **Reset** przywraca wszystkie awatary na miejsce.

Awatar 3D ma też opcję **Framing** (kadrowanie): **Portrait** (portret) pokazuje głowę i ramiona (to ustawienie domyślne), **Half body** (pół sylwetki) pokazuje model do bioder, a **Full body** (cała sylwetka) pokazuje cały model. Awatar zachowuje swój rozmiar, a wyższy kadr pokazuje większą część modelu. Awatary 2D nie mają kadrowania.

Układ jest zapisywany dla tego czatu na tym urządzeniu. Nie synchronizuje się z innymi urządzeniami. Awatary przesuwa też własny przycisk **Arrange** agenta Expression Engine.

### Gdzie leżą pliki awatarów

Importowane pliki są sprawdzane przed zapisaniem. Jedynym limitem rozmiaru jest zwykły limit wgrywania na serwerze. Pliki leżą w folderze danych w `avatar-models/<character or persona>/<id>/`, obok pliku `avatar.json` z ustawieniami. Kopie zapasowe i eksporty profilu obejmują ten folder. Usunięcie postaci lub persony usuwa jej awatar, podobnie jak wyczyszczenie wszystkich **Characters** (postacie), **Personas** (persony) albo **Media & Assets** (multimedia i zasoby) w sekcji Danger Zone ustawień. Eksport karty postaci nigdy nie zawiera awatarów.

### Czaty grupowe

Czaty grupowe pokazują każdego członka z zapisanym, włączonym awatarem, którego agent jest włączony, bez stałego limitu. W trybie **Individual** mówi i okazuje emocje postać, która odpowiada. W trybie **Merged (Narrator)** znaczniki mówiącego i dialogi przypisane imieniem kierują odpowiednią postacią. Przy włączonych głosach synchronizacja ust podąża za postacią, której głos jest właśnie odtwarzany.

<a id="2d-avatars-pngtuber-sprites-and-mesh-avatars"></a>

## Awatary 2D: sprite'y PNGTuber i awatary mesh

**2D Avatars** pokazuje jeden z dwóch rodzajów awatara. **Sprite'y PNGTuber** to płaskie obrazki, które zmieniają minę, otwierają usta i mrugają. **Awatary mesh** to rysunki, które płynnie poruszają głową, oczami i ustami. Oba rodzaje konfiguruje się na stronie agenta po wybraniu postaci lub persony.

<a id="pngtuber-sprites"></a>

### Sprite'y PNGTuber

Postać lub persona ze sprite'ami wyrazów twarzy może użyć ich jako awatara PNGTuber, w którym sprite'y są minami. Jeśli są sprite'y portretowe, używane są one, a w przeciwnym razie sprite'y całej sylwetki, więc jeden awatar nigdy nie miesza obu rodzajów. Sprawdź podgląd, a potem włącz **Show this avatar in chats** albo zapisz je przyciskiem **Use my sprites** (użycie moich sprite'ów).

- **Obrazki mówienia i mrugania.** Dodaj sprite'y nazwane jak mina, z dopiskiem `_talk` dla otwartych ust i `_blink` dla zamkniętych oczu, na przykład `happy_talk`, `happy_blink` i `happy_blink_talk` dla obu naraz. Działają też `_talking`, `_speak`, `_mouth_open`, `_blinking` i `_eyes_closed`. Mina bez takich obrazków i tak podskakuje podczas mówienia.
- **Face for each feeling** (mina dla każdej emocji). Wybierz, która mina pokazuje się dla emocji Neutral, Happy, Angry, Sad, Relaxed i Surprised (neutralność, radość, złość, smutek, odprężenie i zaskoczenie). **Resting face** (mina w spoczynku) używa miny Neutral. Do wyboru są wszystkie sprite'y, także te dodane później, maksymalnie 64 miny. Import PNGTuber Plus proponuje tylko własne miny. Gdy agent Expression Engine albo postać Game Master wybierze sprite, który masz, pokazuje się dokładnie ta mina.
- **More feelings** (więcej emocji). W sekcji **Face for each feeling** rozwiń **More feelings**, aby wybrać minę dla 23 bardziej szczegółowych emocji, pogrupowanych pod sześcioma głównymi (tabela poniżej). Każda z nich używa miny swojej głównej emocji, dopóki nie wybierzesz innej. Sprite nazwany jak jedna z nich, na przykład `fear` albo `amusement`, albo słowem w rodzaju `scared` czy `laughing`, jest dla niej używany bez konfiguracji.
- **Movement.** **Hop while talking** (podskakiwanie podczas mówienia) i **Hop height** (wysokość podskoku) ustawiają podskakiwanie. **Time between blinks** (czas między mrugnięciami) to wartość średnia. Każde mrugnięcie wypada trochę wcześniej albo później. Gdy na urządzeniu jest włączone ograniczenie ruchu, awatar nie podskakuje ani nie oddycha, ale jego mina i usta nadal się zmieniają.
- **Sprite'y pokazują się bez zmian.** Sprite narysowany na tle pokazuje się razem z nim, a twoje pliki nigdy nie są zmieniane. Aby uzyskać miny bez tła, użyj sekcji [Miny z awatara](#faces-from-the-avatar).
- **Use my sprites** zapisuje sprite'y jako miny. Wybranie miny albo zmiana ruchu również zapisuje awatar. **Update from sprites** (aktualizacja ze sprite'ów) dołącza sprite'y dodane później i zachowuje wybrane przez ciebie miny. Po imporcie wybierz **Remove** (usunięcie), żeby wrócić do swoich sprite'ów.

| Dodatkowe emocje w grupie | Emocje |
| --- | --- |
| Neutral | Curiosity (ciekawość) |
| Happy | Admiration (podziw), Amusement (rozbawienie), Desire (pragnienie), Embarrassment (zakłopotanie), Excitement (ekscytacja), Gratitude (wdzięczność), Optimism (optymizm), Pride (duma) |
| Angry | Annoyance (irytacja), Disapproval (dezaprobata), Disgust (obrzydzenie) |
| Sad | Disappointment (rozczarowanie), Grief (żal), Nervousness (nerwowość), Remorse (skrucha) |
| Relaxed | Approval (aprobata), Caring (troska), Love (miłość), Relief (ulga) |
| Surprised | Confusion (dezorientacja), Fear (strach), Realization (olśnienie) |

**Import PNGTuber Plus save** (import zapisu PNGTuber Plus) wczytuje awatar zapisany w programie [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) (plik `.save`). Każdy kostium staje się jedną miną, a jego warstwy mówienia i mrugania stają się obrazkami mówienia i mrugania. Kostiumy są dopasowywane do emocji po nazwach obrazków, takich jak `angry eyes.png`. Dla emocji, których nazwy nie objęły, wybierz minę samodzielnie. Niektóre elementy nie są przenoszone:

- Kołysanie (wobble), opóźnienie (drag), obrót i rozciąganie nie są importowane. Awatar pokazuje każdą warstwę w spoczynku.
- Animowane warstwy pokazują tylko pierwszą klatkę.
- Bardzo stare zapisy przechowują tylko ścieżki do obrazków na komputerze autora. Najpierw zapisz je ponownie w nowszej wersji programu PNGTuber Plus.
- Bardzo duży awatar jest zmniejszany do 2048 pikseli, żeby telefony zmieściły w pamięci wszystkie obrazki.

Import zapisu wymaga przetwarzania obrazów na serwerze. Niektóre instalacje w systemie Android (w środowisku Termux) go nie mają, a import jest tam odrzucany z komunikatem.

### Awatary mesh

Awatar mesh to plik `.mavatar`. Marinara może go zrobić ze sprite'a (zobacz [Awatar mesh](#mesh-avatar)), możesz też zrobić go w narzędziu [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) (zobacz [Mesh Avatar Studio](#mesh-avatar-studio)). Wybierz **Import .mavatar file** (import pliku .mavatar), żeby go dodać, albo **Replace file** (zamiana pliku), żeby go podmienić. Przy włączonym ruchu w spoczynku awatar sam oddycha i rozgląda się. Mruga, a jego usta podążają za odpowiedzią. Narysowane kształty ust zapisane w pliku są używane. W przeciwnym razie awatar dostaje proste, dorysowane kształty.

W sekcji **Look for each feeling** (wygląd dla każdej emocji) wybierz, co pokazuje każda emocja: jedną z sześciu emocji albo **Smile** (uśmiech), **Shy** (nieśmiałość), **Half-closed eyes** (półprzymknięte oczy) lub **Wink** (puszczenie oczka).

Każdy plik jest sprawdzany przy imporcie. Uszkodzony plik, plik zbyt szczegółowy, żeby działał płynnie, albo taki, który po rozpakowaniu przekracza limit wgrywania, zostaje odrzucony z krótkim wyjaśnieniem. Zachowywane są tylko części potrzebne awatarowi, więc oryginalna ilustracja z wnętrza pliku nie jest przechowywana. Grafika należy do jej twórcy, więc przed udostępnieniem sprawdź jej licencję.

Awatary mesh wymagają WebGL2, który mają aktualne przeglądarki. Bez niego, albo gdy przeglądarka zatrzyma grafikę, żeby oszczędzić pamięć, awatar pokazuje zamiast tego twoją konfigurację PNGTuber albo sprite'y.

<a id="3d-avatars-vrm-models"></a>

## Awatary 3D: modele VRM

**3D Avatars** pokazuje modele VRM, czyli format eksportowany przez program VRoid Studio, rozszerzenie VRM dla programu Blender i UniVRM dla silnika Unity. Działają zarówno pliki VRM 1.0, jak i 0.x. Jeśli nie masz jeszcze modelu, [zrób go w programie VRoid Studio](#get-a-3d-model), darmowej aplikacji.

1. Otwórz **3D Avatars** i wybierz postać lub personę.
2. W sekcji **VRM model** wybierz **Import VRM** (import modelu VRM) i wskaż plik `.vrm`.
3. Przeczytaj **The author's terms** (warunki autora). Pochodzą z pliku modelu i określają, kto może go używać jako awatara, czy dozwolone są użycie komercyjne, zmiany oraz treści seksualne lub bardzo brutalne, a w VRM 1.0 także to, czy trzeba podać autora i czy wolno udostępniać plik. Otwórz również każdy link do licencji zawarty w pliku. Marinara pokazuje warunki, ale ich nie egzekwuje, więc przestrzegaj ich samodzielnie.
4. W sekcji **Faces and mouth shapes** (miny i kształty ust) sprawdź, która ekspresja modelu (expression w formacie VRM) pokazuje każdą minę (Neutral, Happy, Angry, Sad, Relaxed, Surprised), każdy kształt ust (A, I, U, E, O) i mruganie. **Set by the model** (ustawione przez model) oznacza, że model ma standardową ekspresję VRM. **Guessed from its name** (odgadnięte z nazwy) oznacza, że jedna z jego własnych ekspresji ma pasującą nazwę. Pusta ekspresja niczego nie zmienia, więc jest przypisywana tylko do miny Neutral. Jeśli dopasowanie wygląda na błędne, wybierz inną ekspresję albo **None** (brak).
5. Opcjonalnie: w sekcji **Idle animation** (animacja spoczynkowa) dodaj plik `.vrma`, który model będzie odtwarzać podczas czekania. Bez niego model łagodnie oddycha i się kołysze.

**Replace model** (zamiana modelu) zachowuje animację spoczynkową, bo animacje VRM pasują do każdego modelu VRM. **Remove model** (usunięcie modelu) usuwa jedno i drugie.

W czacie model patrzy na ciebie, sam mruga, jeśli ma ekspresję mrugnięcia, i przechyla głowę, gdy myśli albo słucha. Niektóre modele VRM 1.0 nie ruszają ustami, gdy pokazują minę. Gdy taki model mówi, mina pokazuje się z częściową siłą, żeby usta mogły się poruszać. Przy włączonym ograniczeniu ruchu miny i usta nadal się zmieniają, ale model przestaje się kołysać, oddychać i odtwarzać animację spoczynkową.

Jeśli coś nie zadziałało, import podaje powód. Najczęstsze przyczyny:

- **Skompresowane modele.** Kompresja Draco lub meshopt albo tekstury KTX2 się nie wczytują. Wyeksportuj model ponownie z wyłączoną kompresją.
- **Zwykłe modele 3D.** Plik `.glb` lub `.gltf` bez danych VRM nie ma ekspresji ani humanoidalnego szkieletu. Model `.glb` z układem kości zaimportuj jako **GLB or FBX model** (zobacz [Awatary GLB i FBX](#glb-and-fbx-avatars-rigged-models)) albo przekonwertuj go do formatu VRM (zobacz [Blender](#blender-with-the-vrm-add-on-for-blender)).
- **Niekompletne modele.** Model, w którym brakuje kości wymaganych przez VRM albo który wskazuje części, których nie ma w pliku, albo pliki poza nim, zostaje odrzucony.

Duże modele wczytują się dłużej, zwłaszcza na telefonach.

<a id="mmd-avatars-pmx-models-and-vmd-motions"></a>

## Awatary MMD: modele PMX i animacje VMD

1. Na stronie **3D Avatars** wybierz **MMD PMX model** w polu **Avatar type**.
2. Wybierz **Import PMX or ZIP** (import pliku PMX lub ZIP). Wskaż archiwum ZIP z jednym modelem PMX i jego obrazkami. Zachowaj foldery i nazwy plików modelu, także nazwy japońskie. Model, który nie potrzebuje obrazków, może być samym plikiem `.pmx`.
3. W sekcji **Faces and mouth shapes** wybierz minę dla każdej emocji, kształtu ust i mrugania. Typowe nazwy angielskie i japońskie są dopasowywane automatycznie. Sprawdź podgląd i popraw nietrafione dopasowania. Model bez odpowiednich min nadal może być wyświetlany i poruszać ciałem.
4. Opcjonalnie: w sekcji **VMD motion** (animacja VMD) dodaj plik `.vmd` przygotowany dla tego modelu. Jest odtwarzany przy włączonej opcji **Idle motion**, a wybrane miny nadal podążają za czatem. Bez pliku VMD model łagodnie się kołysze.

Brakujące obrazki, niebezpieczne ścieżki i uszkodzone pliki są odrzucane, zanim zastąpią zapisany model. Konfiguracja pokazuje pierwsze 256 nazw ekspresji i ostrzega, jeśli jest ich więcej. Zastąpienie modelu PMX usuwa jego poprzednią animację VMD, więc dodaj animację dla nowego modelu. Usunięcie modelu MMD usuwa jego obrazki i animację, a inne typy awatarów pozostawia bez zmian. Ograniczenie ruchu zatrzymuje animację, ale zachowuje miny i synchronizację ust.

Obsługiwane: modele PMX 2.0 i zgodne modele PMX 2.1 z obrazkami PNG, JPEG, BMP i TGA, także `.sph` i `.spa`. Niektóre nowsze funkcje PMX 2.1 nie są obsługiwane, a import podaje powód. Modele PMD, pozy VPD oraz animacje kamery i światła nie są obsługiwane. Fizyka nie jest symulowana, więc włosy i ubrania mogą wyglądać inaczej niż w programie MikuMikuDance. Modele z ponad 256 ścieżkami do obrazków, bardzo długimi ścieżkami, obrazkami wymagającymi zbyt wiele pamięci albo nadmiernie złożonym układem kości są odrzucane. Przetestuj swój model, zwłaszcza na telefonie.

Awatary MMD wymagają WebGL2 i korzystają z tych samych ustawień pauzy, liczby klatek i kadru co pozostałe awatary. Modele wczytują się tylko z twojej aplikacji Marinara Engine. Przestrzegaj licencji i warunków autorów. Importowanie i odtwarzanie takiego awatara nie wysyła niczego do usługi AI.

<a id="glb-and-fbx-avatars-rigged-models"></a>

## Awatary GLB i FBX: modele z układem kości

1. Na stronie **3D Avatars** wybierz **GLB or FBX model** w polu **Avatar type**.
2. Wybierz **Import GLB or FBX** (import pliku GLB lub FBX) i wskaż jeden plik `.glb` albo `.fbx` z postacią, która ma układ kości.

Zwykły model nie ma danych VRM, które nazywają jego kości, więc import dopasowuje kości po nazwach. Układy kości z programów i serwisów Mixamo, Unity, VRoid, Unreal, Blender, 3ds Max, Maya HumanIK, Character Creator i DAZ używają nazw, które import rozpoznaje. Sekcja pokazuje, ile kości ciała udało się dopasować. Model musi mieć co najmniej biodra, kręgosłup, głowę oraz oba ramiona i przedramiona. W przeciwnym razie import odrzuca model i podaje brakujące kości. Zmień ich nazwy w swoim programie 3D albo nadaj modelowi układ kości w serwisie Mixamo. Modele w pozie A (A-pose), zwrócone tyłem albo wykonane w centymetrach są automatycznie prostowane, obracane i skalowane.

Miny pochodzą z blend shape'ów modelu (nazywanych też shape keys albo morph targets). W sekcji **Faces and mouth shapes** typowe nazwy są dopasowywane: kształty ust w konwencji VRoid, VRChat i Oculus (`aa`, `A`, `viseme_aa`, `Fcl_MTH_A`), otwarta szczęka (`mouthOpen`, `jawOpen`), emocje (`happy`, `Joy`, `mouthSmile`) i mruganie (`blink` albo para dla lewego i prawego oka, na przykład `eyeBlinkLeft` i `eyeBlinkRight` w konwencji ARKit). Sprawdź podgląd i popraw nietrafione dopasowania. Model bez blend shape'ów nadal porusza ciałem i kiwa głową, gdy mówi.

Obsługiwane: binarny glTF (`.glb`) ze wszystkim osadzonym w pliku oraz FBX 2014 (7.4) lub nowszy, w wersji binarnej albo ASCII. Wyeksportuj pliki FBX z włączoną opcją **Embed Media** (albo **Embed Textures**), bo inaczej model pokaże się bez swoich obrazków. Modele z kompresją Draco, meshopt lub KTX2 się nie wczytują, a osobnego pliku `.gltf` z własnymi plikami nie da się użyć. Model VRM zapisany jako `.glb` importuje się w sekcji **VRM model**. Własne animacje modelu, fizyka i edycja pozy nie są obsługiwane. Przestrzegaj warunków autora. Importowanie i odtwarzanie takiego awatara nie wysyła niczego do usługi AI.

<a id="get-a-3d-model"></a>

## Sekcja Get a 3D model

Jeśli postać lub persona nie ma modelu VRM, zrób go w programie VRoid Studio. To darmowa aplikacja firmy pixiv dla systemów Windows i macOS oraz urządzeń iPad. Zrobionych w niej modeli możesz używać jako własnych, ale kilka jej wbudowanych elementów i wszystkie kupione tekstury mają własne warunki. Jej modele mają sześć min, pięć kształtów ust i mruganie, więc miny i synchronizacja ust działają od razu.

Na stronie **3D Avatars** wybierz postać lub personę. W sekcji **Get a 3D model** (zdobycie modelu 3D) przycisk **Read the guide** (przeczytanie przewodnika) otwiera tę sekcję, a **Copy prompt** (kopiowanie promptu) kopiuje opis wyglądu postaci lub persony.

1. Pobierz i zainstaluj program [VRoid Studio](https://vroid.com/en/studio).
2. Opcjonalnie: wybierz **Copy prompt**, wklej prompt do generatora obrazów i użyj obrazka jako odniesienia. VRoid Studio nie ma pola na prompt.
3. W programie VRoid Studio utwórz nowy model. Wybierz włosy, twarz, oczy, ciało i strój najbliższe postaci, a potem zmień kształty i kolory, żeby pasowały.
4. Wyeksportuj model jako VRM (1.0 albo 0.0). Gdy pojawi się prośba, uzupełnij dane modelu i warunki jego użycia.
5. Otwórz **3D Avatars** w panelu **Agents**, wybierz postać lub personę i w sekcji **VRM model** wybierz **Import VRM**. Model z programu VRoid Studio ma już uzupełnione wszystkie miny, kształty ust i mrugnięcie.

Prompt opisuje postać dla narzędzi, które tworzą obraz lub model 3D z tekstu: postać w stylu anime pokazaną w całej sylwetce, stojącą w pozie T (T-pose), widzianą z przodu na jednolitym tle. Wygląd pochodzi z pola **Appearance** (wygląd), z tagów **Image Appearance Override** (osobny opis wyglądu do obrazów), gdy są włączone, albo z opisu, gdy wyglądu nie ma. Prompt zawiera tylko imię i wygląd, nic więcej z karty i nic z twoich czatów. Jest po angielsku. Zmień go według uznania.

Model VRM z innego narzędzia może mieć mniej ekspresji albo nie mieć żadnych. Sekcja **Faces and mouth shapes** pokazuje, które ma. Niektóre strony internetowe twierdzą, że tworzą model VRM z ekspresjami twarzy na podstawie obrazka, ale w październiku 2026 nie udało się tego potwierdzić dla żadnej z nich, więc ten przewodnik żadnej nie poleca. Model utworzony wcześniej za pomocą usuniętego generatora Tripo nadal się wczytuje i porusza ciałem, ale jego twarz się nie porusza.

## Jak miny i usta podążają za odpowiedzią

Awatary reagują samodzielnie. Tutaj nie trzeba niczego konfigurować.

**Miny w trybie Roleplay.** Gdy odpowiedź się streamuje, Marinara czyta każde zakończone zdanie i odgaduje jego nastrój. Żeby mina nie migotała:

- Mina zmienia się tylko wtedy, gdy nowy nastrój jest wyraźnie silniejszy od obecnego.
- Mina utrzymuje się co najmniej dwie sekundy.
- Mina wraca do spokojnej po dwóch spokojnych zdaniach z rzędu oraz około czterech sekund po zakończeniu odpowiedzi.

Przy wyłączonym streamingu każde zdanie nadal ma własny nastrój, a miny zmieniają się po kolei w czasie wypowiadania odpowiedzi. Gdy synteza mowy czyta odpowiedź, miny podążają zamiast tego za głosem (zobacz niżej).

Awatar PNGTuber z minami dla [dodatkowych emocji](#pngtuber-sprites) może pokazać bardziej szczegółową emocję, na przykład Amusement przy radości. Podlega ona tym samym zasadom, a emocja bez własnej miny pokazuje minę swojej głównej emocji. Tak samo działają wybory agenta Expression Engine i postaci Game Master: gdy nie ma miny o nazwie `scared`, awatar pokazuje Fear. Awatary 3D i mesh pokazują tylko sześć emocji.

**Jak odczytywany jest nastrój.** Model czatu nie jest o to pytany, a tekst czatu nigdy nie trafia do zewnętrznej usługi.

- Wbudowana lista słów odpowiada od razu, wszędzie, i zna popularne słowa opisujące nastrój w kilku językach.
- Na komputerach, które to udźwigną, zdania czyta zamiast tego mały model emocji, czyli czytnik nastroju. Rozumie on 36 języków. Pobiera się raz, około 300 MB, przy pierwszym otwarciu czatu w trybie Roleplay z włączonym agentem 2D Avatars lub 3D Avatars. Strona każdego agenta awatarów w panelu **Agents** pokazuje postęp. Nieudane pobieranie ponawia się po około 10 minutach. Dopóki czytnik nie jest gotowy, odpowiada lista słów, a po pobraniu czytnik działa bez połączenia z internetem. W trakcie pracy zajmuje około 1 GB pamięci i jest usuwany z pamięci po 10 minutach bezczynności. Instalacje Lite, system Android i komputery z mniej niż 3 GB pamięci zostają przy liście słów.

**Miny w trybie Game Mode.** Każda kwestia pokazywana przez postać Game Master ma przypisany wyraz twarzy, który przejmuje awatar mówiącej postaci, nawet gdy kwestię czyta głos. Wewnętrzne myśli zmieniają minę, ale nie poruszają ustami.

**Agent Expression Engine.** Gdy jest włączony, jego wybór po odpowiedzi jest ostateczną miną dla tej odpowiedzi. Wybór, który nadejdzie już po wysłaniu przez ciebie kolejnej wiadomości, zostaje przy swojej odpowiedzi. Przy syntezie mowy wybrana mina pojawia się, kiedy głos skończy czytać.

**Usta.** Przy animacji z tekstu usta ruszają się tylko przy dialogach (słowach w cudzysłowie, wierszach `[Name]:` i znacznikach mówiącego), a nie przy narracji, mniej więcej w tempie mowy. Jeśli tekst pojawia się szybciej, niż ktokolwiek zdołałby go wypowiedzieć, usta przyspieszają, a potem przeskakują do przodu. Przy wyłączonym streamingu dialog z odpowiedzi jest wypowiadany w ciągu ośmiu sekund. Gdy synteza mowy odtwarza kwestię, usta porusza zamiast tego głos.

**Ciało.** Awatar myśli od chwili wysłania wiadomości do swoich pierwszych słów, mówi, gdy poruszają się jego usta, słucha, gdy mówi ktoś inny albo gdy piszesz, a w pozostałych chwilach odpoczywa.

**Czaty grupowe.** W grupie Individual mówi członek, który odpowiada, także przy swipe'ach wiadomości jednego z członków. W grupie Merged znacznik mówiącego kieruje dialogiem i miną tej postaci, nawet w akapicie, który wymienia kogoś innego. Dialog przypisany imieniem też podąża za swoim rozmówcą. Proza bez znaczników należy do pierwszej postaci, którą wymienia, albo do postaci z poprzedniego akapitu. Dopóki akapit, który nikogo nie wymienia, jeszcze się pojawia, jego dialog czeka, aż imię albo koniec akapitu pokaże, kto mówi. Przy wyłączonym streamingu w grupie Individual na razie tylko odpowiedź ostatniego członka porusza awatarem.

<a id="lip-sync-with-text-to-speech"></a>

## Synchronizacja ust z syntezą mowy

Gdy synteza mowy czyta odpowiedź w trybie Roleplay, awatar mówiącej postaci porusza ustami zgodnie z głosem. Usta otwierają się szerzej przy głośnych dźwiękach, zamykają w pauzach, zaokrąglają się przy dźwiękach takich jak "u" i pokazują zęby przy dźwiękach takich jak "s". Aby to włączyć, skonfiguruj syntezę mowy zgodnie z przewodnikiem [Konfiguracja syntezy mowy (TTS)](../media/tts-setup.md). Synchronizacja działa wtedy z **Auto-play** (automatyczne odtwarzanie) i z przyciskiem **Speak** (Mów) przy wiadomości, także w układzie visual novel.

Gdy odpowiedź jest czytana na głos przy włączonym **Auto-play**, głos zwykle zaczyna się kilka sekund po pojawieniu się tekstu, więc awatar na niego czeka.

- Gdy tekst się pojawia, awatar mruga i porusza się jak zwykle, ale jego usta pozostają zamknięte, a mina jeszcze się nie zmienia.
- Gdy głos się zaczyna, usta podążają za nim, a mina zmienia się, gdy głos dochodzi do kolejnych zdań, chyba że agent Expression Engine już wybrał minę.
- Mina rozluźnia się około czterech sekund po zakończeniu głosu. Krótkie pauzy między kwestiami jej nie rozluźniają.
- Jeśli głos zawiedzie albo nie zacznie się w ciągu kilku sekund, awatar raz odtwarza miny i ruch ust odpowiedzi na podstawie tekstu. Jeśli głos zawiedzie później, awatar pokazuje ostatni nastrój i się rozluźnia.
- Po 30 sekundach bez głosu awatar przestaje czekać. Głos, który zacznie się później, nadal porusza ustami.

Szczegóły:

- **Kto mówi.** Poruszają się usta postaci, której głos czyta kwestię, czyli tej, dla której **Voice option** (opcja głosu) wybiera głos. Usta każdej postaci poruszają się tylko podczas jej własnych kwestii. Kwestie czytane głosem narratora oraz mówiący, którzy nie są postaciami w czacie, nie poruszają żadnymi ustami. Przy wyłączonym **Only read dialogues** (czytanie tylko dialogów) własna narracja postaci jest czytana jej głosem i porusza jej ustami.
- **Pauza, zatrzymanie i przełączanie czatów.** Wstrzymanie albo zatrzymanie głosu zatrzymuje usta. Jeśli przełączysz czat, gdy odpowiedź jest czytana, awatary w tamtym czacie pozostają nieruchome. Wróć, gdy głos jeszcze gra, a awatar znów go podejmie.
- **Głośność.** **Line volume** (głośność kwestii) zmienia głośność, a nie to, jak szeroko otwierają się usta.
- **Persony.** Usta persony nie poruszają się przy twoich własnych wiadomościach.
- **Game Mode.** Przy włączonej syntezie mowy i **Auto-play** usta czekają na głos swojej postaci i podążają za nim. Kwestie bez głosu zachowują animację z tekstu. Głosy narratora i gracza nie poruszają ustami żadnej postaci. Wewnętrzne myśli pozostają niewypowiedziane.

Synchronizacja ust nie zmienia sposobu odtwarzania głosu. Marinara odczytuje osobną kopię każdego klipu, żeby zgrać ruch ust w czasie, więc odtwarzanie działa tak jak wcześniej, także w przeglądarce Safari oraz na urządzeniach iPhone i iPad. Jeśli pierwszy klip zacznie się, zanim synchronizacja będzie gotowa, jego tekst porusza ustami, dopóki nie przejmie tego synchronizacja z głosem. Jeśli przeglądarka nie może odczytać klipu, głos nadal gra, a tylko usta przestają za nim podążać.

<a id="making-an-avatar-from-a-sprite"></a>

## Tworzenie awatara ze sprite'a

Na stronie **2D Avatars** wybierz postać lub personę, a potem użyj sekcji **Make an avatar from a sprite** (tworzenie awatara ze sprite'a). Korzysta ona ze sprite'ów, które postać lub persona już ma. Twój awatar pozostaje bez zmian, dopóki nie zapiszesz wyniku, więc możesz próbować dowolnie wiele razy.

<a id="faces-from-the-avatar"></a>

### Miny z awatara

**Make faces from the avatar** (tworzenie min z awatara) tworzy miny bez tła, także dla postaci lub persony, która nie ma jeszcze sprite'ów. Wymaga awatara i konta do generowania obrazów. Otwiera to samo generowanie sprite'ów co edytory postaci i persony, z awatarem jako referencją.

1. Wybierz **All faces** (wszystkie miny), czyli wszystkie 29 emocji, **Main faces** (główne miny), czyli sześć głównych, albo wybierz miny samodzielnie. Każda dodatkowa emocja jest w wierszu swojej głównej miny, dopóki nie ma własnej miny.
2. Miny są rysowane partiami, najpierw główne. Starsze modele GPT Image rysują jedną minę na obrazek. Obrazek, którego nie udało się utworzyć, jest ponawiany raz. Jeśli znów się nie uda, tworzenie zatrzymuje się z przyciskiem **Retry picture** (ponowienie obrazka). **Cancel** (anuluj) zachowuje już utworzone miny.
3. Przy włączonej opcji **Expose media prompts before sending** (pokazywanie promptów mediów przed wysłaniem) przeglądasz wszystkie prompty naraz, zanim zostanie wysłany pierwszy. Każda mina jest rysowana z otwartymi oczami i zamkniętymi ustami, żeby obrazki mrugania i mówienia miały co zamykać i otwierać.
4. Marinara rysuje miny na jednolitym kolorze, usuwa go i zapisuje je jako sprite'y postaci lub persony. Nowy sprite zastępuje sprite o tej samej nazwie, więc jeśli chcesz zachować stary, zmień nazwę w ostatnim kroku.

Gdy awatar jest już zapisany, każda nowa mina staje się miną emocji, dla której ją narysowano, nawet po zmianie nazwy. Pozostałe sprite'y zostają. Mina utworzona ponownie zaczyna bez obrazków mrugania i mówienia, bo stare by do niej nie pasowały. Nowe utworzysz w sekcji [Obrazki mrugania i mówienia](#blink-and-talk-pictures). Import PNGTuber Plus zachowuje własne miny.

<a id="blink-and-talk-pictures"></a>

### Obrazki mrugania i mówienia

Każda mina, którą awatar pokazuje dla jakiejś emocji, to jeden wiersz z jej obrazkami **Eyes closed** (zamknięte oczy) i **Mouth open** (otwarte usta) obok **Face** (mina). Są to obrazki zapisane wcześniej, dodane przez ciebie sprite'y `_blink` i `_talk` albo nowe obrazki. Przy sprite'ach portretowych używane są tylko one, bo awatar nigdy nie miesza min portretowych i min całej sylwetki. Mina, która nie jest jednym z twoich sprite'ów, na przykład pochodząca z importu PNGTuber Plus, pokazuje swoje obrazki, ale nie może dostać nowych.

1. Sprawdź **Image model** (model obrazów; twoje domyślne konto do generowania obrazów jest wybrane automatycznie).
2. Kliknij **Make** (utworzenie) przy jednym brakującym obrazku albo przycisk **Make N pictures** (tworzenie N obrazków), żeby utworzyć wszystkie. Każdy obrazek to jedno zapytanie o obraz. Przy włączonej opcji **Expose media prompts before sending** (w ustawieniach) najpierw widzisz każdy prompt i możesz go edytować.
3. Nowe obrazki pojawiają się po kolei. Przy udanych wybierz **Keep** (zachowanie), a przy pozostałych **Try again** (ponowna próba). **Try again** rysuje też od nowa obrazek, który już masz. Rysowany ponownie obrazek pozostaje przyciemniony, z kołowrotkiem. **Cancel** zatrzymuje rysowanie, także na serwerze. Jeśli **Try again** się nie uda, zostaje stary obrazek. Aby utworzyć zachowany obrazek od nowa, najpierw wybierz **Kept** (zachowany), żeby z niego zrezygnować.
4. Wybierz **Save kept pictures** (zapisanie zachowanych obrazków). Stają się one obrazkami mrugania i mówienia awatara i leżą obok kopii sprite'a, z którego powstały, więc zawsze się pokrywają. Jeśli przed zapisaniem podmienisz sprite, utwórz jego obrazki ponownie.

Przy koncie do generowania obrazów, które przyjmuje obraz referencyjny, twój sprite jest jedynym obrazem referencyjnym, w rozmiarze i proporcjach akceptowanych przez model, z promptem, który prosi o zmianę tylko oczu albo ust. Modele przesuwają, skalują albo uzupełniają marginesami obrazek, który zwracają, więc najpierw jest on dopasowywany do twojego sprite'a. Wycinane są z niego tylko oczy (przy mrugnięciu) albo usta (przy mówieniu). Wszystko inne to niezmienione piksele twojego sprite'a, więc awatar nie przeskakuje. Jeśli oczy się nie zamknęły, usta się nie otworzyły albo obrazek był zbyt przesunięty, żeby dało się go dopasować, tworzenie obrazka kończy się błędem z komunikatem. Spróbuj ponownie.

Niektóre konta nie potrafią edytować obrazów, na przykład Pollinations, Together AI, Horde, DALL-E albo workflow ComfyUI bez miejsca na obraz referencyjny. Przy takim koncie **Make** rysuje nową minę razem z jej obrazkami mrugania i mówienia na jednym obrazku, żeby wszystkie trzy do siebie pasowały, tak jak w sekcji [Miny z awatara](#faces-from-the-avatar). Wiersz pokazuje **New face** (nowa mina). **Keep** zachowuje minę razem z oboma obrazkami, a zapisanie sprawia, że nowa mina staje się miną tej emocji. Twój sprite się nie zmienia. Wymaga to wyglądu albo opisu postaci lub persony.

<a id="mesh-avatar"></a>

### Awatar mesh

1. Wybierz **Sprite to use** (sprite do użycia). Neutralny sprite całej sylwetki jest wybrany automatycznie, jeśli istnieje. Najlepiej sprawdza się sprite całej sylwetki albo popiersie zwrócone przodem.
2. Wybierz **Chat provider that can see pictures** (dostawca czatu, który widzi obrazy). **The agent's provider** (dostawca agenta) używa dostawcy ustawionego na stronie 2D Avatars, a w drugiej kolejności twojego domyślnego konta agentów. Jego model musi przyjmować obrazy.
3. Wybierz **Make mesh avatar** (utworzenie awatara mesh). Model czatu znajduje twarz, a Marinara buduje awatar z twojego sprite'a w niezmienionej postaci. **Cancel** przerywa tworzenie.
4. Sprawdź podgląd: obrysy powinny leżeć na oczach, brwiach i ustach. Wybierz **Save as mesh avatar** (zapisanie jako awatar mesh) albo **Discard** (odrzucenie) i spróbuj innego sprite'a lub modelu.

Wygenerowany awatar mesh porusza głową, oczami, brwiami i ustami, a mruga i mówi własnymi powiekami i ustami. Włosy poruszają się razem z głową. Dłonie, pojedyncze kosmyki i zwisające akcesoria nie poruszają się osobno. Małe sprite'y są budowane z większej kopii, żeby usta pasowały do twarzy. Gdy twarz wypełnia większość dużego sprite'a, używana jest mniejsza kopia, żeby tworzenie trwało krótko.

Twój sprite trafia do konta do generowania obrazów przy obrazkach mrugania i mówienia (oraz do jego zapasowego konta do generowania obrazów, jeśli jest ustawione i przyjmuje obraz referencyjny), a do modelu czatu przy awatarze mesh. Konto, które nie potrafi edytować obrazów, dostaje tylko prompt, który zawiera wygląd. Prompty są częścią agenta 2D Avatars. Przy włączonej opcji **Expose media prompts before sending** możesz przeczytać i zmienić każdy prompt. Przy włączonym trybie diagnostycznym każdy prompt trafia do logu serwera.

## Tworzenie własnego modelu

Postać lub persona może bez rysowania używać swoich sprite'ów wyrazów twarzy jako awatara PNGTuber. [Tworzenie awatara ze sprite'a](#making-an-avatar-from-a-sprite) dodaje obrazki mrugania i mówienia albo buduje za ciebie awatar mesh. Aby zrobić własny model, użyj jednego z tych narzędzi. Każdy plik zaimportuj na stronie agenta w panelu **Agents** i włącz **Show this avatar in chats**.

| Czego potrzebujesz | Narzędzie | Co dostajesz |
| --- | --- | --- |
| Sprite'y PNGTuber | Dowolny program do rysowania, a potem zakładka **Sprites** (sprite'y) postaci | Sprite'y |
| Sprite'y PNGTuber z warstwami i kostiumami | [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) | Plik `.save` |
| Awatar mesh | [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) | Plik `.mavatar` |
| Model 3D | [VRoid Studio](https://vroid.com/en/studio) albo Blender z [VRM Add-on for Blender](https://vrm-addon-for-blender.info/en-us/) | Plik `.vrm`, opcjonalnie animacja spoczynkowa `.vrma` |

### Własne sprite'y

1. Narysuj po jednym obrazku dla każdej emocji, wszystkie w tym samym rozmiarze, z postacią w tym samym miejscu. Nazwij każdy według jego emocji: `neutral`, `happy`, `angry`, `sad`, `relaxed`, `surprised`. Działają też nazwy zawierające słowo opisujące emocję, takie jak `smile`, `cry`, `calm` czy `shock`. Dla opcjonalnych [dodatkowych emocji](#pngtuber-sprites) nazwij obrazki na przykład `amusement`, `fear` albo `gratitude`.
2. Żeby usta się poruszały, narysuj ten sam obrazek z otwartymi ustami i dodaj `_talk`, na przykład `happy_talk`. Do mrugania zamknij oczy i dodaj `_blink`. Przy obu zmianach dodaj `_blink_talk`.
3. Dodaj obrazki w zakładce **Sprites**, w kategorii **Facial Expressions** (wyrazy twarzy). Nazwa każdego pliku staje się nazwą jego sprite'a. Zobacz [Sprite'y postaci](../characters/sprites.md#upload-your-own-sprites).
4. Otwórz **2D Avatars** w panelu **Agents**, wybierz postać lub personę i włącz **Show this avatar in chats**.

### PNGTuber Plus

1. Zbuduj awatar z osobnych warstw. Pokazuj otwarte usta tylko podczas mówienia, a zamknięte tylko w ciszy. Pokazuj zamknięte oczy tylko podczas mrugania, a otwarte tylko poza nim.
2. Dla każdej emocji przygotuj kostium, który podmienia oczy albo usta, i nazwij te obrazki według emocji, na przykład `angry eyes.png` albo `happy_mouth.png`. Szczegółowe emocje działają tak samo, na przykład `fear eyes.png`. Kostium 1 to mina w spoczynku.
3. Zapisz awatar, żeby otrzymać plik `.save`.
4. Otwórz **2D Avatars** w panelu **Agents**, wybierz postać lub personę, a potem **PNGTuber sprites** i **Import PNGTuber Plus save**. Dla emocji, których nazwy nie objęły, wybierz minę samodzielnie.

### Mesh Avatar Studio

1. Zacznij od obrazka głowy i ramion zwróconych przodem, z przezroczystym tłem. Mesh Avatar Studio działa na twoim komputerze w środowisku Node.js, a agent programistyczny, taki jak Claude Code czy Codex, przygotowuje obrazek do animacji (rigging). Krok po kroku prowadzi przez to plik README narzędzia.
2. Opcjonalnie: dodaj narysowane oczy i usta w sekcji **Drawn variants** (narysowane warianty). Marinara używa kształtów ust `mouth_a`, `mouth_i`, `mouth_o` i `mouth_a_half` oraz zamkniętych oczu `eyes_closed_0` i `eyes_closed_1`. Każdy awatar mesh ma wbudowane sześć emocji, więc nie trzeba niczego nazywać.
3. Wybierz **Export .mavatar**. Nie pakuj samodzielnie folderu projektu do archiwum ZIP.
4. Otwórz **2D Avatars** w panelu **Agents**, wybierz postać lub personę, a potem **Mesh avatar** i **Import .mavatar file**.

### VRoid Studio

1. Utwórz postać w programie VRoid Studio. Jej miny, kształty ust i mrugnięcie to standardowe ekspresje VRM i są odnajdywane automatycznie.
2. Wyeksportuj ją jako VRM (1.0 albo 0.0). Gdy pojawi się prośba, uzupełnij dane modelu i warunki jego użycia.
3. Otwórz **3D Avatars** w panelu **Agents**, wybierz postać lub personę i wybierz **Import VRM**.

<a id="blender-with-the-vrm-add-on-for-blender"></a>

### Blender z rozszerzeniem VRM Add-on for Blender

1. Zainstaluj rozszerzenie VRM Add-on for Blender z sekcji **Get Extensions** w **Preferences** programu Blender. W wersjach programu Blender starszych niż 4.2 plik ZIP rozszerzenia instaluje się zamiast tego w sekcji **Add-ons**.
2. Nadaj modelowi humanoidalny szkielet (armature) i przypisz jego kości VRM. Rozszerzenie potrafi przypisać je automatycznie.
3. Skonfiguruj ekspresje w panelu VRM rozszerzenia: **Expressions** dla VRM 1.0 albo **VRM 0.x Blend Shape Proxy** dla VRM 0.x. Każda ekspresja musi poruszać shape key albo materiał: pusta ekspresja niczego nie zmienia, więc import używa jej tylko dla miny Neutral. Dopasowywane są też własne ekspresje o jasnej nazwie, takie jak `Smile` czy `Shock`.
   - Miny: **Happy**, **Angry**, **Sad**, **Relaxed** i **Surprised**. VRM 0.x nazywa pierwsze cztery **Joy**, **Angry**, **Sorrow** i **Fun** i nie ma gotowej ekspresji zaskoczenia, więc dodaj własną o nazwie `Surprised`.
   - Kształty ust: **Aa**, **Ih**, **Ou**, **Ee** i **Oh** (w VRM 0.x: **A**, **I**, **U**, **E** i **O**).
   - Mruganie: **Blink**.
4. Wyeksportuj model przez **File → Export → VRM (.vrm)**. Jeśli chcesz animację spoczynkową, zanimuj szkielet i użyj **File → Export → VRM Animation (.vrma)**. Rozszerzenie eksportuje animację tylko z modelu ustawionego na VRM 1.0, więc jeśli chcesz animację, w kroku 3 wybierz VRM 1.0.
5. Otwórz **3D Avatars** w panelu **Agents**, wybierz postać lub personę i wybierz **Import VRM**. Animację dodaj przyciskiem **Add animation** (dodanie animacji) w sekcji **Idle animation**.

### Czego unikać przy eksporcie

- **Kompresja.** Kompresja Draco lub meshopt i tekstury KTX2 się nie wczytują. Opisane wyżej eksporty VRM nigdy ich nie używają, ale zwykły eksport glTF w programie Blender oferuje Draco, a optymalizatory modeli mogą dodać wszystkie trzy. Wyeksportuj model ponownie z wyłączoną kompresją.
- **Zwykły glTF.** Zwykły plik `.glb` nie ma danych VRM, które nazywają miny i szkielet. Zaimportuj go jako **GLB or FBX model** albo wyeksportuj plik `.vrm`.
- **Osobne pliki.** Nie da się użyć modelu, którego tekstury lub dane leżą w osobnych plikach. Wyeksportuj jeden plik `.vrm`.
- **Efekty PNGTuber Plus.** Kołysanie (wobble), opóźnienie (drag) i animacja nie są przenoszone. Każda warstwa jest pokazywana w spoczynku, a warstwa animowana pokazuje pierwszą klatkę.

## Wydajność i urządzenia

Kod rysujący każdy typ awatara pobiera się dopiero wtedy, gdy po raz pierwszy pojawi się awatar tego typu, więc czaty bez awatarów nie wczytują niczego dodatkowo.

| | Telefony | Komputery |
| --- | --- | --- |
| Awatary rysowane jednocześnie | Bez stałego limitu | Bez stałego limitu |
| Klatki na sekundę podczas mówienia | 30 | 30 |
| Klatki na sekundę w spoczynku | 20, a 15, gdy telefon jest obciążony | 30 |
| Ostrość (współczynnik pikseli) | do 1,5× | do 2× |

Czat pokazuje każdy skonfigurowany, włączony awatar w kolejności swoich postaci, a potem twoją personę. Dopasuj rozmiar i rozmieszczenie postaci do ekranu. Awatary przestają się rysować, gdy karta przeglądarki jest ukryta, okno jest w tle, otwarte są ustawienia Appearance (wygląd) albo czat jest poza ekranem lub zasłonięty panelem albo edytorem. Przy włączonym **Reduce Ambient Animations & Effects** (ograniczenie animacji i efektów otoczenia) albo ustawieniu ograniczenia ruchu na urządzeniu awatary nadal zmieniają miny i poruszają ustami, ale pomijają oddychanie, kołysanie i pozy oczekiwania.

## Powiązane przewodniki

- [Agenci: pomocnicy AI w czatach](agents-overview.md)
- [Agenci do pobrania: przegląd pakietów](built-in-agents.md)
