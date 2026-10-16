# Awatary 2D i 3D

Dwaj agenci do pobrania dają twoim postaciom i personom animowany awatar, który reaguje, gdy odpowiedź się streamuje. **2D Avatars** (awatary 2D) pokazuje sprite'y w stylu PNGTuber albo awatary mesh, a **3D Avatars** (awatary 3D) pokazuje modele VRM. Miny podążają za odpowiedzią, a usta poruszają się zgodnie z tekstem albo z syntezą mowy.

Ta funkcja wciąż powstaje. Kolejne sekcje są uzupełniane, gdy poszczególne części trafiają na `staging`.

Modele Live2D nie są obsługiwane. Licencja Live2D wymaga osobnej umowy z firmą Live2D nawet w przypadku darmowych aplikacji open source, a środowiska uruchomieniowego Live2D nie można dołączyć do aplikacji Marinara Engine.

## Pobieranie agentów

Obaj agenci są w fazie testów. Na razie ekran **Download Agents** (pobieranie agentów) oferuje ich tylko wtedy, gdy aplikacja Marinara Engine działa na gałęzi `staging`.

**2D Avatars** i **3D Avatars** pobiera się osobno, więc możesz zainstalować tylko tego agenta, którego chcesz. Obaj działają dla postaci i person w czatach w trybie Roleplay i Game.

1. Otwórz **Agents → Download Agents** (agenci, pobieranie agentów) i zainstaluj **2D Avatars**, **3D Avatars** albo obu agentów. Żaden z nich nie wymaga restartu.
2. Skonfiguruj każdy awatar na stronie agenta w panelu **Agents**. Zobacz [Konfigurowanie awatara](#setting-up-an-avatar).
3. W czacie w trybie Roleplay albo Game otwórz **Chat Settings → Agents → Misc Agents** (ustawienia czatu, agenci, agenci różni) i dodaj agenta.

Podczas czatu agenci nie wysyłają żadnych dodatkowych zapytań do twoich połączeń AI. Wymagają silnika z Capability API 1.73, a starsza wersja silnika odmawia ich instalacji.

<a id="setting-up-an-avatar"></a>

## Konfigurowanie awatara

Awatary konfiguruje się na własnej stronie każdego agenta. Otwórz panel **Agents**, otwórz **2D Avatars** albo **3D Avatars** i skorzystaj z sekcji **Avatars** (awatary) u góry strony.

1. W polu **Character or persona** (postać lub persona) wybierz, kto dostanie awatar. Nazwy oznaczone "(has an avatar)" mają już zapisany awatar.
2. W polu **Avatar type** (typ awatara) wybierz rodzaj do skonfigurowania. 2D Avatars oferuje **PNGTuber sprites** (sprite'y PNGTuber) i **Mesh avatar** (awatar mesh). 3D Avatars oferuje **VRM model** (model VRM).
3. Skonfiguruj go we własnej sekcji tego typu pod przełącznikami: użyj swoich sprite'ów albo zaimportuj plik, wybierz minę dla każdej emocji albo usuń awatar. Zobacz [Awatary 2D](#2d-avatars-pngtuber-sprites-and-mesh-avatars) i [Awatary 3D](#3d-avatars-vrm-models).
4. Obejrzyj go w sekcji **Preview** (podgląd). **Try a face** (wypróbowanie miny) przełącza emocje, a **Talk** (mówienie) porusza ustami. Gdy nie ma jeszcze nic do pokazania, podgląd wyświetla przykładowy awatar.

Postać lub persona ze sprite'ami wyrazów twarzy ma już awatar PNGTuber na stronie 2D Avatars, więc czaty z włączonym agentem 2D Avatars pokazują go, nawet jeśli nic nie zapisano.

**Show this avatar in chats** (pokazywanie tego awatara w czatach) włącza albo wyłącza awatar bez usuwania go. **Movement** (ruch) ma trzy przełączniki, które działają przy każdym typie: **Lip sync** (synchronizacja ust) porusza ustami, **Blinking** (mruganie) co kilka sekund mruga oczami, a **Idle motion** (ruch w spoczynku) sprawia, że awatar oddycha i kołysze się podczas czekania. Jeśli postać ma więcej niż jeden typ awatara, **Show this one** (pokazywanie tego typu) wybiera typ używany w czatach. Gdy agent tego typu jest w czacie wyłączony, czat pokazuje inny typ, którego agent jest włączony. Usunięcie typu kasuje jego pliki; twoje sprite'y zostają, a awatar wyłączony przez ciebie pozostaje wyłączony.

Awatar pojawia się w czacie w trybie Roleplay, Visual Novel albo Game, gdy czat ma włączonych agentów i dodanego odpowiedniego agenta. Działa z agentem Expression Engine i bez niego. Awatar nie ukrywa sprite'a całej sylwetki, więc jeśli awatar ma go zastąpić, wyłącz ten sprite samodzielnie. Awatary stoją tam, gdzie stałby sprite całej sylwetki, i mają ten sam rozmiar. Aby je przesunąć, użyj trybu **Arrange** (rozmieszczanie) w ustawieniach sprite'ów agenta Expression Engine.

Importowane pliki są sprawdzane przed zapisaniem, a awatary nie mają własnego limitu rozmiaru poniżej zwykłego limitu wgrywania na serwerze. Pliki awatarów leżą w folderze danych w `avatar-models/<character or persona>/<id>/`, obok pliku `avatar.json` z ustawieniami. Kopie zapasowe i eksporty profilu obejmują ten folder. Usunięcie postaci lub persony usuwa jej awatar, także wtedy, gdy sekcja Danger Zone w ustawieniach czyści wszystkie **Characters** (postacie) albo **Personas** (persony), a wyczyszczenie tam kategorii **Media & Assets** (multimedia i zasoby) opróżnia ten folder. Eksport karty postaci nigdy nie zawiera awatarów.

<a id="2d-avatars-pngtuber-sprites-and-mesh-avatars"></a>

## Awatary 2D: sprite'y PNGTuber i awatary mesh

**2D Avatars** pokazuje jeden z dwóch rodzajów awatara: **sprite'y PNGTuber**, czyli płaskie obrazki, które zmieniają minę, otwierają usta i mrugają, oraz **awatary mesh**, czyli rysunki, które płynnie poruszają głową, oczami i ustami. Oba rodzaje konfiguruje się na stronie agenta w edytorze agenta po wybraniu postaci lub persony.

<a id="pngtuber-sprites"></a>

### Sprite'y PNGTuber

Postać lub persona ze sprite'ami wyrazów twarzy ma już awatar PNGTuber: jej sprite'y są minami i nie trzeba niczego konfigurować. Jeśli istnieją sprite'y portretowe, używane są one, a w przeciwnym razie sprite'y całej sylwetki, więc jeden awatar nigdy nie miesza obu rodzajów.

- **Obrazki mówienia i mrugania.** Dodaj sprite'y nazwane jak mina, z dopiskiem `_talk` dla otwartych ust i `_blink` dla zamkniętych oczu, na przykład `happy_talk` i `happy_blink`, a dla obu naraz `happy_blink_talk`. Działają też `_talking`, `_speak`, `_mouth_open`, `_blinking` i `_eyes_closed`. Mina bez takich obrazków i tak podskakuje podczas mówienia.
- **Face for each feeling** (mina dla każdej emocji). Wybierz, która mina pokazuje się dla emocji Neutral, Happy, Angry, Sad, Relaxed i Surprised (neutralność, radość, złość, smutek, odprężenie i zaskoczenie). **Resting face** (mina w spoczynku) używa miny Neutral. Gdy agent Expression Engine albo postać Game Master wybierze sprite, który masz, pokazuje się dokładnie ta mina.
- **More feelings** (więcej emocji). W sekcji **Face for each feeling** rozwiń **More feelings**, aby wybrać minę dla 23 bardziej szczegółowych emocji, pogrupowanych pod sześcioma głównymi: Curiosity (ciekawość) w grupie Neutral; Admiration (podziw), Amusement (rozbawienie), Desire (pragnienie), Embarrassment (zakłopotanie), Excitement (ekscytacja), Gratitude (wdzięczność), Optimism (optymizm) i Pride (duma) w grupie Happy; Annoyance (irytacja), Disapproval (dezaprobata) i Disgust (obrzydzenie) w grupie Angry; Disappointment (rozczarowanie), Grief (żal), Nervousness (nerwowość) i Remorse (skrucha) w grupie Sad; Approval (aprobata), Caring (troska), Love (miłość) i Relief (ulga) w grupie Relaxed; oraz Confusion (dezorientacja), Fear (strach) i Realization (olśnienie) w grupie Surprised. Są opcjonalne. Każda z nich używa miny swojej głównej emocji, dopóki nie wybierzesz innej. Sprite nazwany jak jedna z nich, na przykład `fear` albo `amusement`, albo słowem w rodzaju `scared` czy `laughing`, jest dla niej używany bez żadnej konfiguracji.
- **Movement.** **Hop while talking** (podskakiwanie podczas mówienia) i **Hop height** (wysokość podskoku) ustawiają podskakiwanie w stylu PNGTuber. **Time between blinks** (czas między mrugnięciami) to wartość średnia; każde mrugnięcie wypada trochę wcześniej albo później, więc nigdy nie wygląda mechanicznie. Gdy na urządzeniu jest włączone ograniczenie ruchu, awatar nie podskakuje ani nie oddycha, ale jego mina i usta nadal się zmieniają.
- **Sprite'y pokazują się bez zmian.** Sprite narysowany na tle pokazuje się razem z nim, a twoje pliki sprite'ów nigdy nie są zmieniane. Jeśli chcesz min bez tła, zobacz [Miny z awatara](#faces-from-the-avatar).
- **Use my sprites** (użycie moich sprite'ów) zapisuje sprite'y jako miny awatara. Wybranie miny albo zmiana ruchu też go zapisuje. **Update from sprites** (aktualizacja ze sprite'ów) dołącza sprite'y dodane później i zachowuje miny wybrane przez ciebie dla poszczególnych emocji. Po imporcie wybierz **Remove** (usunięcie), żeby wrócić do swoich sprite'ów.

**Import PNGTuber Plus save** (import zapisu PNGTuber Plus) wczytuje awatar zapisany w programie [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) (plik `.save`). Każdy kostium staje się jedną miną, a jego warstwy mówienia i mrugania stają się obrazkami mówienia i mrugania. Obrazki są przenoszone bez zmian, razem z tłem, jeśli je mają. Kostiumy są dopasowywane do emocji po nazwach obrazków, które pokazują, takich jak `angry eyes.png`. Dla emocji, których nazwy nie objęły, wybierz minę samodzielnie. Niektóre elementy nie są przenoszone:

- Kołysanie (wobble), opóźnienie (drag), obrót i rozciąganie nie są importowane; awatar pokazuje każdą warstwę w spoczynku.
- Animowane warstwy pokazują tylko pierwszą klatkę.
- Bardzo stare zapisy przechowują tylko ścieżki do obrazków na komputerze autora. Najpierw zapisz je ponownie w nowszej wersji programu PNGTuber Plus.
- Bardzo duży awatar jest zmniejszany do 2048 pikseli, żeby telefony zmieściły w pamięci wszystkie obrazki.

Import zapisu wymaga przetwarzania obrazów na serwerze. Niektóre instalacje w systemie Android (w środowisku Termux) go nie mają, więc import jest tam odrzucany z komunikatem, który o tym informuje.

### Awatary mesh

Awatar mesh to plik `.mavatar`. Marinara Engine może go zrobić z jednego z twoich sprite'ów (zobacz [Tworzenie awatara ze sprite'a](#mesh-avatar)), możesz też zrobić go samodzielnie w narzędziu [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) (zobacz [Tworzenie własnego modelu](#mesh-avatar-studio)). Wybierz **Import .mavatar file** (import pliku .mavatar), żeby go dodać, albo **Replace file** (zamiana pliku), żeby go podmienić. Przy włączonym ruchu w spoczynku awatar sam oddycha i rozgląda się. Mruga, a jego usta podążają za odpowiedzią. Jeśli plik zawiera narysowane kształty ust, są one używane; w przeciwnym razie awatar dostaje proste, dorysowane kształty.

W sekcji **Look for each feeling** (wygląd dla każdej emocji) wybierz, co pokazuje każda emocja: jedną z sześciu emocji albo **Smile** (uśmiech), **Shy** (nieśmiałość), **Half-closed eyes** (półprzymknięte oczy) lub **Wink** (puszczenie oczka).

Każdy plik jest sprawdzany przy imporcie, a uszkodzony plik zostaje odrzucony z krótkim wyjaśnieniem. Tak samo dzieje się z plikiem zbyt szczegółowym, żeby działał płynnie, albo z takim, który po rozpakowaniu przekracza limit wgrywania. Zachowywane są tylko części potrzebne awatarowi, więc oryginalna ilustracja z wnętrza pliku nie jest przechowywana. Grafika należy do jej twórcy; przed udostępnieniem sprawdź jej licencję.

Awatary mesh wymagają WebGL2, który mają aktualne przeglądarki. Bez niego, albo gdy przeglądarka zatrzyma grafikę awatara, żeby oszczędzić pamięć, awatar pokazuje zamiast tego twoją konfigurację PNGTuber albo twoje sprite'y.

<a id="3d-avatars-vrm-models"></a>

## Awatary 3D: modele VRM

**3D Avatars** pokazuje modele VRM, czyli format eksportowany przez program VRoid Studio, rozszerzenie VRM dla programu Blender i UniVRM dla silnika Unity. Działają zarówno pliki VRM 1.0, jak i VRM 0.x.

Model VRM możesz też zrobić ze sprite'a całej sylwetki w usłudze Tripo, korzystając z własnego konta Tripo. Zobacz [Tworzenie modelu 3D w usłudze Tripo](#make-a-3d-model-with-tripo).

1. Otwórz **3D Avatars** w edytorze agenta i wybierz postać lub personę.
2. W sekcji **VRM model** wybierz **Import VRM** (import modelu VRM) i wskaż plik `.vrm`.
3. Przeczytaj **The author's terms** (warunki autora). Pochodzą z pliku modelu i określają, kto może używać modelu jako awatara, czy dozwolone jest użycie komercyjne, czy wolno zmieniać model, czy dozwolone są treści seksualne lub bardzo brutalne, a w modelach VRM 1.0 także to, czy trzeba podać autora i czy wolno udostępniać plik. Jeśli plik zawiera link do licencji albo do własnych warunków autora, otwórz również je. Marinara Engine pokazuje warunki, ale ich nie egzekwuje, więc przestrzegaj ich samodzielnie.
4. W sekcji **Faces and mouth shapes** (miny i kształty ust) sprawdź, która ekspresja modelu (expression w formacie VRM) odpowiada każdej minie (Neutral, Happy, Angry, Sad, Relaxed i Surprised), każdemu kształtowi ust (A, I, U, E i O) oraz mruganiu. Większość jest uzupełniona automatycznie: **Set by the model** (ustawione przez model) oznacza, że model ma standardową ekspresję VRM, a **Guessed from its name** (odgadnięte z nazwy) oznacza, że jedna z jego własnych ekspresji ma pasującą nazwę. Ekspresja, którą model zostawił pustą, niczego nie zmienia, więc nigdy nie jest przypisywana do żadnej miny poza Neutral, czyli modelem w spoczynku, a import informuje, gdy jakąś pominął. Jeśli coś zostało odgadnięte źle, wybierz inną ekspresję albo **None** (brak).
5. Opcjonalnie w sekcji **Idle animation** (animacja spoczynkowa) dodaj plik `.vrma`, który model będzie odtwarzać podczas czekania. Bez niego model łagodnie oddycha i się kołysze.

**Replace model** (zamiana modelu) zachowuje animację spoczynkową, bo animacje VRM pasują do każdego modelu VRM. **Remove model** (usunięcie modelu) usuwa model razem z jego animacją spoczynkową.

W trakcie czatu model patrzy na ciebie, sam mruga, jeśli ma ekspresję mrugnięcia, i przechyla głowę, gdy myśli albo słucha. Jego głowa pozostaje przy górnej krawędzi jego miejsca: szerokie miejsce pokazuje głowę i ramiona, a węższe większą część ciała. Niektóre modele VRM 1.0 nie ruszają ustami, gdy pokazują minę; gdy taki model mówi, mina pokazuje się z częściową siłą, żeby usta mogły się poruszać. Przy włączonym ograniczeniu ruchu mina i usta nadal się zmieniają, ale model przestaje się kołysać, oddychać i odtwarzać animację spoczynkową.

Niektórych plików nie da się użyć, a import podaje powód:

- **Skompresowane modele.** Pliki zapisane z kompresją Draco lub meshopt albo z teksturami KTX2 się nie wczytują. Wyeksportuj model ponownie z wyłączoną kompresją.
- **Zwykłe modele 3D.** Model `.glb` lub `.gltf` bez danych VRM nie ma ekspresji twarzy ani humanoidalnego szkieletu. Najpierw przekonwertuj go do formatu VRM, na przykład rozszerzeniem VRM dla programu Blender (zobacz [Tworzenie własnego modelu](#blender-with-the-vrm-add-on-for-blender)).
- **Niekompletne modele.** Model, którego szkielet nie ma kości wymaganych przez VRM albo wskazuje części, których nie ma w pliku, a także model wskazujący pliki poza sobą, zostaje odrzucony.

Poza zwykłym limitem wgrywania w aplikacji nie ma limitu rozmiaru, ale duże modele wczytują się dłużej, zwłaszcza na telefonach.

## Sekcja Get a 3D model

Jeśli postać lub persona nie ma jeszcze modelu VRM, zrób go w programie VRoid Studio. To darmowa aplikacja firmy pixiv dla systemów Windows i macOS oraz urządzeń iPad, a zrobionych w niej modeli możesz używać jako własnych. Kilka jej wbudowanych elementów i wszystkie kupione tekstury mają własne warunki, więc najpierw je sprawdź. Jej modele mają sześć min, pięć kształtów ust i mruganie, więc miny i synchronizacja ust działają od razu.

Możesz też zlecić to usłudze Tripo, która zrobi model ze sprite'a całej sylwetki przy użyciu twojego własnego konta Tripo: zobacz [Tworzenie modelu 3D w usłudze Tripo](#make-a-3d-model-with-tripo). Kosztuje to kredyty Tripo, a twarz modelu się nie porusza.

Na stronie **3D Avatars** wybierz postać lub personę. W sekcji **Get a 3D model** (zdobycie modelu 3D) przycisk **Read the guide** (przeczytanie przewodnika) otwiera tę sekcję, a **Copy prompt** (kopiowanie promptu) kopiuje opis wyglądu postaci lub persony.

1. Pobierz program [VRoid Studio](https://vroid.com/en/studio) i zainstaluj go.
2. Opcjonalnie zrób obrazek, na którym się oprzesz: wybierz **Copy prompt** i wklej prompt do generatora obrazów. VRoid Studio nie ma pola na prompt, więc obrazek służy tylko do oglądania podczas budowania modelu.
3. W programie VRoid Studio utwórz nowy model. Wybierz włosy, twarz, oczy, ciało i strój najbliższe postaci, a potem zmieniaj ich kształty i kolory, aż będą pasować.
4. Wyeksportuj model jako VRM. Działają zarówno VRM 1.0, jak i VRM 0.0. Gdy program VRoid Studio o to poprosi, uzupełnij dane modelu i warunki jego użycia.
5. Otwórz **3D Avatars** w panelu **Agents**, wybierz postać lub personę i w sekcji **VRM model** wybierz **Import VRM**. W sekcji **Faces and mouth shapes** każda mina, każdy kształt ust i mrugnięcie modelu z programu VRoid Studio są już uzupełnione.

**Do czego służy prompt.** Opisuje postać dla narzędzi, które tworzą obraz lub model 3D z tekstu: postać w stylu anime pokazaną w całej sylwetce, stojącą w pozie T (T-pose), widzianą z przodu na jednolitym tle, z jej wyglądem. Wygląd pochodzi z pola **Appearance** (wygląd), z tagów **Image Appearance Override** (osobny opis wyglądu do obrazów), gdy są włączone, albo z opisu, gdy pole wyglądu jest puste. Prompt zawiera tylko imię i wygląd: nic więcej z karty i nic z twoich czatów. Jest po angielsku; przed użyciem zmień go według uznania.

**Co się porusza.** Mina podąża za odpowiedzią, a usta poruszają się zgodnie z tekstem albo głosem, gdy model ma do tego ekspresje. Model VRM z innego narzędzia może mieć ich mniej albo nie mieć żadnych, a sekcja **Faces and mouth shapes** pokazuje, które ma. Niektóre strony internetowe obiecują zrobić model VRM z ekspresjami twarzy na podstawie obrazka albo opisu, ale w chwili pisania tego przewodnika (październik 2026) nie udało się tego potwierdzić dla żadnej z nich, więc ten przewodnik żadnej nie poleca.

<a id="make-a-3d-model-with-tripo"></a>

### Tworzenie modelu 3D w usłudze Tripo

Tripo to płatna usługa, która tworzy modele 3D z obrazków. Na stronie **3D Avatars** przycisk **Make 3D model** (utworzenie modelu 3D) w sekcji **Get a 3D model** zamienia jeden sprite całej sylwetki w model VRM przy użyciu twojego własnego konta Tripo. Jeden model kosztuje około 60 kredytów Tripo (około 0,60 USD) i powstaje w około 3 minuty.

1. Zaloguj się w serwisie Tripo, a potem utwórz klucz API na [stronie kluczy Tripo](https://developers.tripo3d.ai/en/keys). Tam też kupisz kredyty.
2. Otwórz **3D Avatars** w panelu **Agents** i wybierz postać lub personę. W sekcji **Get a 3D model** wklej klucz w pole **Tripo API key** (klucz API Tripo) i wybierz **Save** (zapis). Przycisk **Get a key** (zdobycie klucza) obok otwiera stronę kluczy Tripo. Klucz jest zachowywany dla wszystkich postaci i person, więc wklejasz go tylko raz. **Remove** go usuwa.
3. Po zapisaniu klucza widać twoje saldo Tripo. Neutralny sprite całej sylwetki jest wybrany automatycznie; możesz wybrać inny. Użyj sprite'a całej sylwetki, na którym widać całą postać: popiersie albo przycięty sprite daje model bez nóg, który zostaje odrzucony.
4. Sprawdź saldo i koszt, a potem wybierz **Make 3D model**. Każdy krok pojawia się po zakończeniu, razem z dotąd zużytymi kredytami: Tripo rysuje sprite w pozie T (5 kredytów), tworzy model 3D (30 kredytów) i dodaje szkielet (25 kredytów), a potem Marinara Engine zamienia go w plik VRM.
5. Obejrzyj obrazki, a potem wybierz **Save as the VRM model** (zapisanie jako model VRM) albo **Discard** (odrzucenie). Zapisanie zastępuje bieżący model VRM postaci lub persony.

**Tylko ciało.** Model z usługi Tripo porusza ciałem, rękami i głową, ale jego twarz się nie porusza: nie ma ekspresji twarzy, więc nie może się uśmiechać, mrugać ani poruszać ustami. Sekcja **Faces and mouth shapes** informuje o tym, zamiast proponować miny do wyboru. Włosy, płaszcze i ogony są częścią ciała i się nie kołyszą, a dłonie nie mają palców, które mogłyby się zginać.

**Cancel** (anulowanie) od razu przerywa czekanie. Tripo nie może zatrzymać kroku, który już się rozpoczął, więc może go jeszcze dokończyć i pobrać za niego kredyty. Za krok, który się nie powiedzie, Tripo zwraca kredyty.

Jeśli coś pójdzie nie tak, panel konfiguracji podaje, co zrobić:

- **Klucz nieprzyjęty:** wklej działający klucz w pole **Tripo API key** na stronie **3D Avatars** i wybierz **Save**. **Get a key** otwiera stronę kluczy Tripo.
- **Za mało kredytów:** doładuj konto w serwisie Tripo. Saldo jest sprawdzane, zanim cokolwiek się zacznie, więc nic nie zostaje wydane.
- **Zasady treści:** usługa Tripo odrzuciła obrazek. Spróbuj innego sprite'a.
- **Serwis zajęty:** spróbuj ponownie za minutę.
- **Opuszczone ręce albo brak nóg:** model nie może poruszać się jak awatar, więc zostaje odrzucony, zanim cokolwiek zostanie zapisane. Spróbuj innego sprite'a całej sylwetki.

**Co jest wysyłane.** Twój sprite trafia do usługi Tripo, a jeśli ma tło, najpierw zostaje ono usunięte. Klucz jest przechowywany na serwerze w postaci zaszyfrowanej, wysyłany tylko do API Tripo i nigdy nie jest pokazywany w aplikacji, zapisywany w logu ani dołączany do eksportu profilu. Przy włączonym trybie diagnostycznym (Debug mode) log serwera pokazuje ustawienia i numery zadań każdego żądania do Tripo.

**Kto może używać modelu.** Zgodnie z warunkami usługi Tripo modele utworzone przez płacących użytkowników należą do nich, a prawa do modeli utworzonych za darmo zachowuje Tripo. Grafika twojego sprite'a może też należeć do kogoś innego. Dlatego plik modelu deklaruje tylko twój osobisty, niekomercyjny użytek, prosi o podanie autora, zastrzega, że pliku nie należy udostępniać, i zawiera link do [warunków Tripo](https://developers.tripo3d.ai/en/terms). Pokazuje je sekcja **The author's terms**. Sprawdź je przed udostępnieniem modelu.

## Jak miny i usta podążają za odpowiedzią

Awatary reagują samodzielnie; w tej części nie trzeba niczego konfigurować.

**Miny w trybie Roleplay.** Gdy odpowiedź się streamuje, Marinara Engine czyta każde zakończone zdanie i odgaduje jego nastrój. Żeby mina nie migotała:

- Mina zmienia się tylko wtedy, gdy nowy nastrój jest wyraźnie silniejszy od obecnego.
- Mina utrzymuje się co najmniej dwie sekundy.
- Mina wraca do spokojnej dopiero po dwóch spokojnych zdaniach z rzędu.
- Około czterech sekund po zakończeniu odpowiedzi mina rozluźnia się i wraca do spokojnej.

Awatar PNGTuber z minami dla [dodatkowych emocji](#pngtuber-sprites) może też pokazać bardziej szczegółową emocję, którą wyraża zdanie, na przykład Amusement, gdy zdanie jest radosne. Ta mina podlega tym samym zasadom: wymaga wyraźnego odczytu i utrzymuje się co najmniej dwie sekundy, a emocja bez własnej miny pokazuje minę swojej głównej emocji. Tak samo działają wybory agenta Expression Engine i postaci Game Master: gdy awatar nie ma miny o wybranej nazwie, na przykład `scared`, pokazuje minę tej emocji, tutaj Fear. Awatary 3D i mesh pokazują tylko sześć emocji.

**Jak odczytywany jest nastrój.** Połączenie czatu nie jest o to pytane. Tekst czatu zostaje w twojej własnej aplikacji Marinara Engine i nigdy nie trafia do zewnętrznej usługi.

- Wbudowana lista słów odpowiada od razu, wszędzie, i zna popularne słowa opisujące nastrój w kilku językach.
- Na komputerach, które to udźwigną, Marinara Engine czyta zdania zamiast tego małym modelem emocji, czyli czytnikiem nastroju. Rozumie on 36 języków. Pobiera się raz, około 300 MB, przy pierwszym otwarciu czatu w trybie Roleplay z włączonym agentem 2D Avatars lub 3D Avatars. Nie pobiera się, gdy obaj agenci są wyłączeni. Strona każdego agenta awatarów w panelu **Agents** pokazuje postęp pobierania, a nieudane pobieranie samo ponawia się po około 10 minutach. Dopóki czytnik nastroju nie jest gotowy, odpowiada lista słów, a po pobraniu czytnik działa bez połączenia z internetem. W trakcie pracy zajmuje około 1 GB pamięci i jest usuwany z pamięci po 10 minutach bezczynności. Instalacje Lite, system Android i komputery z mniej niż 3 GB pamięci zostają przy liście słów.

**Miny w trybie Game Mode.** Każda kwestia pokazywana przez postać Game Master ma przypisany wyraz twarzy, który przejmuje awatar mówiącej postaci. Wewnętrzne myśli postaci zmieniają minę, ale nie poruszają ustami.

**Agent Expression Engine.** Gdy jest włączony w czacie, jego wybór po odpowiedzi jest ostateczną miną dla tej odpowiedzi. Wybór, który nadejdzie już po wysłaniu przez ciebie kolejnej wiadomości, zostaje przy odpowiedzi, której dotyczył. Awatary działają również bez niego.

**Usta.** Gdy usta poruszają się na podstawie tekstu, ruszają się tylko przy dialogach (słowach w cudzysłowie, wierszach `[Name]:` i znacznikach mówiącego), a nie przy narracji, mniej więcej w tempie mowy. Jeśli tekst pojawia się szybciej, niż ktokolwiek zdołałby go wypowiedzieć, usta przyspieszają, a potem przeskakują do przodu, żeby nadążać za słowami na ekranie. Przy wyłączonym streamingu dialog z odpowiedzi jest wypowiadany w ciągu ośmiu sekund. Gdy synteza mowy odtwarza kwestię, usta porusza zamiast tego głos, więc narracja postaci czytana jej głosem także porusza jej ustami.

**Ciało.** Awatar myśli od chwili wysłania wiadomości do swoich pierwszych słów, mówi, gdy poruszają się jego usta, słucha, gdy mówi ktoś inny albo gdy piszesz, a w pozostałych chwilach odpoczywa.

**Czaty grupowe.** W grupie Individual mówi członek, który właśnie odpowiada, także przy swipe'ach wiadomości jednego z członków. W grupie Merged każdy akapit należy do pierwszej postaci, którą wymienia, albo do postaci z poprzedniego akapitu. Dopóki akapit, który nikogo nie wymienia, jeszcze się pojawia, jego dialog czeka, aż imię albo koniec akapitu pokaże, kto go wypowiada. Przy wyłączonym streamingu w grupie Individual na razie tylko odpowiedź ostatniego członka porusza awatarem.

## Synchronizacja ust z syntezą mowy

Gdy synteza mowy czyta odpowiedź w trybie Roleplay, awatar mówiącej postaci porusza ustami zgodnie z głosem. Usta otwierają się szerzej przy głośnych dźwiękach i zamykają w pauzach. Zmieniają też kształt: zaokrąglają się przy ciemnych dźwiękach, takich jak "u", i pokazują zęby przy dźwiękach takich jak "s". Nie trzeba niczego dodatkowo konfigurować. Włącz syntezę mowy zgodnie z przewodnikiem [Konfiguracja syntezy mowy (TTS)](../media/tts-setup.md), a synchronizacja ust zadziała z **Auto-play** (automatyczne odtwarzanie) i z przyciskiem **Speak** (Mów) przy wiadomości, także w układzie visual novel.

- **Kto mówi:** poruszają się usta postaci, której głos czyta kwestię, czyli tej samej postaci, dla której **Voice Option** (opcja głosu) wybiera głos. Gdy odpowiedź ma kilku mówiących, usta każdej postaci poruszają się tylko podczas jej własnych kwestii. Kwestie czytane głosem narratora oraz mówiący, którzy nie są postaciami w czacie, nie poruszają żadnymi ustami. Przy wyłączonym **Only read dialogues** (czytanie tylko dialogów) własna narracja postaci jest czytana jej głosem, więc jej usta poruszają się także przy niej.
- **Pauza, zatrzymanie i przełączanie czatów:** wstrzymanie albo zatrzymanie głosu zatrzymuje usta. Jeśli przełączysz się na inny czat, gdy odpowiedź jest jeszcze czytana, awatary w tamtym czacie pozostają nieruchome. Jeśli wrócisz do pierwszego czatu, zanim głos skończy, jego awatar znów podejmie głos.
- **Głośność:** suwak **Line volume** (głośność kwestii) zmienia głośność głosu, a nie to, jak szeroko otwierają się usta.
- **Persony:** usta persony nie poruszają się przy twoich własnych wiadomościach, z syntezą mowy ani bez niej.
- **Game Mode:** narracja w trybie Game jest odtwarzana przez własny dźwięk trybu Game Mode, więc w trybie Game Mode usta awatarów na razie podążają za tekstem.

Synchronizacja ust nie zmienia sposobu odtwarzania głosu. Marinara Engine odczytuje osobną kopię każdego klipu głosowego, żeby zgrać ruch ust w czasie, więc odtwarzanie działa tak jak wcześniej, także w przeglądarce Safari oraz na urządzeniach iPhone i iPad. Jeśli przeglądarka nie może odczytać klipu, głos nadal gra, a tylko usta przestają za nim podążać.

<a id="making-an-avatar-from-a-sprite"></a>

## Tworzenie awatara ze sprite'a

Na stronie **2D Avatars** w edytorze agenta wybierz postać lub personę, a potem użyj sekcji **Make an avatar from a sprite** (tworzenie awatara ze sprite'a). Korzysta ona ze sprite'ów, które postać lub persona już ma. Twój awatar pozostaje bez zmian, dopóki nie zapiszesz wyniku, więc możesz próbować dowolnie wiele razy.

<a id="faces-from-the-avatar"></a>

### Miny z awatara

**Make faces from the avatar** (tworzenie min z awatara) tworzy miny bez tła, także dla postaci lub persony, która nie ma jeszcze sprite'ów. Otwiera generowanie sprite'ów, to samo co w edytorach postaci i persony, z awatarem zaznaczonym jako referencja. Zaczyna od sześciu głównych min: Neutral, Happy, Angry, Sad, Relaxed i Surprised, i proponuje 23 dodatkowe emocje, na przykład Pride, Grief i Realization. Każda dodatkowa emocja jest w wierszu głównej miny, którą pokazuje, dopóki nie ma własnej miny. Wybierz **All faces** (wszystkie miny), aby dostać wszystkie 29, **Main faces** (główne miny), aby dostać sześć głównych, albo dowolne wybrane miny. Miny są rysowane partiami, najpierw główne, po tyle na jednym obrazku, ile mieści siatka; starsze modele GPT Image rysują jedną minę na obrazek. Obrazek, którego nie udało się utworzyć, jest ponawiany raz; jeśli znów się nie uda, tworzenie zatrzymuje się z przyciskiem **Retry picture** (ponowienie obrazka), a **Cancel** zachowuje już utworzone miny. Przy włączonej opcji **Expose media prompts before sending** przeglądasz prompty wszystkich obrazków naraz, zanim zostanie wysłany pierwszy. Każda mina jest rysowana z otwartymi oczami i zamkniętymi ustami, żeby jej obrazki mrugania i mówienia miały co zamykać i otwierać. Funkcja rysuje z awatara nowe sprite'y wyrazów twarzy na jednolitym kolorze, usuwa ten kolor i zapisuje je jako sprite'y postaci lub persony. Nowy sprite zastępuje sprite o tej samej nazwie, więc jeśli chcesz zachować stary, zmień nazwę w ostatnim kroku. Potrzebne są awatar i połączenie do generowania obrazów.

### Obrazki mrugania i mówienia

1. Każda mina, którą awatar pokazuje dla jakiejś emocji, to jeden wiersz, podpisany nazwami emocji, które ją pokazują. Obok **Face** (mina) są jej obrazki **Eyes closed** (zamknięte oczy) i **Mouth open** (otwarte usta): zapisane wcześniej, dodane przez ciebie sprite'y `_blink` i `_talk` albo nowe. Gdy postać lub persona ma sprite'y portretowe, używane są tylko one, bo awatar nigdy nie miesza min portretowych i min całej sylwetki. Mina, która nie jest jednym z twoich sprite'ów, na przykład pochodząca z importu PNGTuber Plus, pokazuje swoje obrazki, ale nie da się dla niej narysować nowych.
2. Sprawdź **Image connection** (połączenie do generowania obrazów; twoje domyślne połączenie obrazowe jest wybrane automatycznie). **Make** (utworzenie) rysuje jeden brakujący obrazek, a **Make pictures** (tworzenie obrazków) rysuje wszystkie. Każdy obrazek to jedno zapytanie o obraz. Przy włączonej opcji **Expose media prompts before sending** (w ustawieniach) najpierw widzisz każdy prompt i możesz go edytować.
3. Nowe obrazki pojawiają się po kolei. Przy tych, które wyglądają dobrze, wybierz **Keep** (zachowanie), a przy pozostałych **Try again** (ponowna próba); **Try again** rysuje też od nowa obrazek, który już masz. Rysowany ponownie obrazek pozostaje przyciemniony, z kołowrotkiem, dopóki nie nadejdzie nowy. **Cancel** zatrzymuje tworzenie bieżącego obrazka, także na serwerze, i porzuca obrazki, które jeszcze nie powstały. Jeśli **Try again** się nie uda, zostaje stary obrazek. Aby utworzyć zachowany obrazek od nowa, najpierw wybierz **Kept** (zachowany), żeby z niego zrezygnować.
4. Wybierz **Save kept pictures** (zapisanie zachowanych obrazków). Stają się one obrazkami mrugania i mówienia awatara PNGTuber dla tych wyrazów twarzy i leżą obok kopii sprite'a, z którego powstały, więc zawsze się z nim pokrywają. Jeśli awatar nadal pokazywał twoje sprite'y w niezmienionej postaci, zachowuje je wszystkie i dostaje nowe obrazki. Jeśli przed zapisaniem podmienisz sprite, utwórz jego obrazki ponownie.

Najlepiej sprawdzają się modele obrazów, które edytują obrazy, bo dostają twój sprite jako jedyną referencję, z promptem, który prosi o zmianę tylko oczu albo ust. Sprite jest wysyłany w rozmiarze i proporcjach akceptowanych przez model, jako wycięta postać na białym tle, a potem wycinany z powrotem z wyniku według własnego obrysu sprite'a, więc model, który nie przesuwa obrazu, daje obrazki, które się pokrywają. Jeśli obrazek zmienia coś więcej niż oczy albo usta, awatar przeskakuje przy mrugnięciu albo mówieniu; utwórz wtedy ten obrazek ponownie.

<a id="mesh-avatar"></a>

### Awatar mesh

1. Wybierz jeden sprite. Gdy postać ma neutralny sprite całej sylwetki, jest on wybrany automatycznie, a w przeciwnym razie neutralny sprite; możesz wybrać inny. Najlepiej sprawdza się sprite całej sylwetki albo popiersie zwrócone przodem.
2. Wybierz **Chat connection that can see pictures** (połączenie czatu, które widzi obrazy). **The agent's connection** (połączenie agenta) używa połączenia ustawionego na stronie 2D Avatars, a w drugiej kolejności twojego domyślnego połączenia agentów. Jego model musi przyjmować obrazy.
3. Wybierz **Make mesh avatar** (utworzenie awatara mesh). Model czatu znajduje twarz, a Marinara Engine buduje awatar z twojego sprite'a w niezmienionej postaci. **Cancel** przerywa tworzenie.
4. Sprawdź podgląd: obrysy powinny leżeć na oczach, brwiach i ustach. Wybierz **Save as mesh avatar** (zapisanie jako awatar mesh) albo **Discard** i spróbuj innego sprite'a lub modelu.

Wygenerowany awatar mesh porusza głową, oczami, brwiami i ustami, a mruga i mówi własnymi powiekami i ustami. Włosy poruszają się razem z głową; dłonie, pojedyncze kosmyki i zwisające akcesoria nie poruszają się osobno. Gdy twarz wypełnia większość dużego sprite'a, awatar powstaje z mniejszej kopii, żeby tworzenie trwało krótko.

Twój sprite jest wysyłany do połączenia obrazowego przy obrazkach mrugania i mówienia (a jeśli to połączenie zawiedzie i ma ustawione zapasowe połączenie obrazowe, także do tamtego) oraz do połączenia czatu przy awatarze mesh. Prompty są częścią agenta 2D Avatars. Przy włączonej opcji **Expose media prompts before sending** możesz przeczytać i zmienić prompt każdego obrazka przed jego wysłaniem. Przy włączonym trybie diagnostycznym każdy prompt trafia do logu serwera.

## Tworzenie własnego modelu

Na początek nie musisz niczego tworzyć. Postać lub persona ze sprite'ami wyrazów twarzy ma już awatar PNGTuber, a [Tworzenie awatara ze sprite'a](#making-an-avatar-from-a-sprite) dodaje obrazki mrugania i mówienia albo buduje za ciebie awatar mesh. Jeśli zamiast tego chcesz zrobić własny model, użyj jednego z tych narzędzi. Sprite'y pokazują się od razu po dodaniu, a każdy plik importuje się na stronie agenta w panelu **Agents**.

| Czego potrzebujesz | Narzędzie | Co dostajesz |
| --- | --- | --- |
| Sprite'y PNGTuber | Dowolny program do rysowania, a potem zakładka **Sprites** (sprite'y) postaci | Sprite'y |
| Sprite'y PNGTuber z warstwami i kostiumami | [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) | Plik `.save` |
| Awatar mesh | [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) | Plik `.mavatar` |
| Model 3D | [VRoid Studio](https://vroid.com/en/studio) albo Blender z [VRM Add-on for Blender](https://vrm-addon-for-blender.info/en-us/) | Plik `.vrm` i opcjonalnie animacja spoczynkowa `.vrma` |

### Własne sprite'y

1. Narysuj po jednym obrazku dla każdej emocji, wszystkie w tym samym rozmiarze i z postacią w tym samym miejscu. Nazwij każdy według jego emocji: `neutral`, `happy`, `angry`, `sad`, `relaxed` i `surprised`. Działają też nazwy zawierające słowo opisujące emocję, takie jak `smile`, `cry`, `calm` czy `shock`. Dla opcjonalnych [dodatkowych emocji](#pngtuber-sprites) dodaj też obrazki nazwane od nich, na przykład `amusement`, `fear` albo `gratitude`.
2. Żeby usta się poruszały, narysuj ten sam obrazek, zmieniając tylko usta na otwarte, i dodaj do jego nazwy `_talk`, na przykład `happy_talk`. Do mrugania zamknij tylko oczy i dodaj `_blink`; przy obu zmianach dodaj `_blink_talk`. Emocja bez takich obrazków i tak podskakuje podczas mówienia.
3. Dodaj obrazki w zakładce **Sprites** postaci lub persony, w kategorii **Facial Expressions** (wyrazy twarzy). **Upload Folder** (wgrywanie folderu) dodaje cały folder i nadaje każdemu sprite'owi nazwę jego pliku. Zobacz [Sprite'y postaci](../characters/sprites.md).
4. Czaty z włączonym agentem 2D Avatars pokazują je od razu. Aby zmienić minę dla danej emocji albo ruch, zobacz [Sprite'y PNGTuber](#pngtuber-sprites).

### PNGTuber Plus

1. Zbuduj awatar z osobnych warstw. Ustaw otwarte usta tak, żeby pokazywały się tylko podczas mówienia, a zamknięte tylko w ciszy. Zamknięte oczy ustaw tak, żeby pokazywały się tylko podczas mrugania, a otwarte tylko poza mruganiem.
2. Dla każdej emocji przygotuj kostium, który podmienia oczy albo usta, i nazwij te obrazki według emocji, na przykład `angry eyes.png` albo `happy_mouth.png`. Bardziej szczegółowe emocje działają tak samo, na przykład `fear eyes.png`. Kostium 1 to mina w spoczynku.
3. Zapisz awatar, żeby otrzymać plik `.save`.
4. Otwórz **2D Avatars** w panelu **Agents**, wybierz postać lub personę, a potem **PNGTuber sprites** i **Import PNGTuber Plus save**. Dla emocji, których nazwy nie objęły, wybierz minę samodzielnie.

### Mesh Avatar Studio

1. Zacznij od obrazka głowy i ramion zwróconych przodem, z przezroczystym tłem. Mesh Avatar Studio działa na twoim komputerze w środowisku Node.js, a agent programistyczny, taki jak Claude Code czy Codex, przygotowuje obrazek do animacji (rigging). Krok po kroku prowadzi przez to plik README narzędzia.
2. Opcjonalnie dodaj narysowane oczy i usta w sekcji **Drawn variants** (narysowane warianty). Marinara Engine automatycznie używa jego kształtów ust (`mouth_a`, `mouth_i`, `mouth_o` i `mouth_a_half`) i zamkniętych oczu (`eyes_closed_0` i `eyes_closed_1`). Każdy awatar mesh ma wbudowane sześć emocji, więc nie trzeba niczego nazywać.
3. Wybierz **Export .mavatar**. Nie pakuj samodzielnie folderu projektu do archiwum ZIP.
4. Otwórz **2D Avatars** w panelu **Agents**, wybierz postać lub personę, a potem **Mesh avatar** i **Import .mavatar file**.

### VRoid Studio

1. Utwórz postać w programie VRoid Studio. Jej miny, kształty ust i mrugnięcie to standardowe ekspresje VRM, więc zostaną odnalezione automatycznie.
2. Wyeksportuj ją jako VRM. Działają zarówno VRM 1.0, jak i VRM 0.0. Gdy program VRoid Studio o to poprosi, uzupełnij dane modelu i warunki jego użycia.
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

- **Kompresja.** Kompresja siatki Draco lub meshopt i tekstury KTX2 się nie wczytują. Opisane wyżej eksporty VRM nigdy ich nie używają, ale zwykły eksport glTF w programie Blender oferuje Draco, a optymalizatory modeli mogą dodać wszystkie trzy. Wyeksportuj model ponownie z wyłączoną kompresją.
- **Zwykły glTF.** Zwykły plik `.glb` lub `.gltf` nie ma danych VRM, które nazywają jego miny i szkielet. Wyeksportuj zamiast tego plik `.vrm`.
- **Osobne pliki.** Nie da się użyć modelu, którego tekstury lub dane leżą w osobnych plikach. Wyeksportuj jeden plik `.vrm`.
- **Efekty PNGTuber Plus.** Kołysanie (wobble), opóźnienie (drag) i animacja nie są przenoszone: każda warstwa jest pokazywana w spoczynku, a warstwa animowana pokazuje pierwszą klatkę.

## Wydajność i urządzenia

Kod rysujący każdy typ awatara pobiera się dopiero wtedy, gdy po raz pierwszy pojawi się awatar tego typu, więc czaty bez awatarów nie wczytują niczego dodatkowo.

| | Telefony | Komputery |
| --- | --- | --- |
| Awatary rysowane jednocześnie | 2 | 4 |
| Klatki na sekundę podczas mówienia | 30 | 30 |
| Klatki na sekundę w spoczynku | 20, a 15, gdy telefon jest obciążony | 30 |
| Ostrość (współczynnik pikseli) | do 1,5× | do 2× |

Czat pokazuje awatary w kolejności swoich postaci, a potem twoją personę, aż do tego limitu. Awatary całkowicie przestają się rysować, gdy karta przeglądarki jest ukryta, okno jest w tle, otwarte są ustawienia Appearance (wygląd) albo czat jest poza ekranem lub zasłonięty panelem albo edytorem. Przy włączonym **Reduce Ambient Animations & Effects** (ograniczenie animacji i efektów otoczenia) albo ustawieniu ograniczenia ruchu na urządzeniu awatary nadal zmieniają miny i poruszają ustami, ale pomijają oddychanie, kołysanie i pozy oczekiwania.

## Powiązane przewodniki

- [Agenci: pomocnicy AI w czatach](agents-overview.md)
- [Agenci do pobrania: przegląd pakietów](built-in-agents.md)
