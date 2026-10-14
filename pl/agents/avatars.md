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
- **Movement.** **Hop while talking** (podskakiwanie podczas mówienia) i **Hop height** (wysokość podskoku) ustawiają podskakiwanie w stylu PNGTuber. **Time between blinks** (czas między mrugnięciami) to wartość średnia; każde mrugnięcie wypada trochę wcześniej albo później, więc nigdy nie wygląda mechanicznie. Gdy na urządzeniu jest włączone ograniczenie ruchu, awatar nie podskakuje ani nie oddycha, ale jego mina i usta nadal się zmieniają.
- **Use my sprites** (użycie moich sprite'ów) zapisuje sprite'y jako miny awatara. Wybranie miny albo zmiana ruchu też go zapisuje. **Update from sprites** (aktualizacja ze sprite'ów) dołącza sprite'y dodane później i zachowuje miny wybrane przez ciebie dla poszczególnych emocji. Po imporcie wybierz **Remove** (usunięcie), żeby wrócić do swoich sprite'ów.

**Import PNGTuber Plus save** (import zapisu PNGTuber Plus) wczytuje awatar zapisany w programie [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) (plik `.save`). Każdy kostium staje się jedną miną, a jego warstwy mówienia i mrugania stają się obrazkami mówienia i mrugania. Kostiumy są dopasowywane do emocji po nazwach obrazków, które pokazują, takich jak `angry eyes.png`. Dla emocji, których nazwy nie objęły, wybierz minę samodzielnie. Niektóre elementy nie są przenoszone:

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

## Jak miny i usta podążają za odpowiedzią

Awatary reagują samodzielnie; w tej części nie trzeba niczego konfigurować.

**Miny w trybie Roleplay.** Gdy odpowiedź się streamuje, Marinara Engine czyta każde zakończone zdanie i odgaduje jego nastrój. Żeby mina nie migotała:

- Mina zmienia się tylko wtedy, gdy nowy nastrój jest wyraźnie silniejszy od obecnego.
- Mina utrzymuje się co najmniej dwie sekundy.
- Mina wraca do spokojnej dopiero po dwóch spokojnych zdaniach z rzędu.
- Około czterech sekund po zakończeniu odpowiedzi mina rozluźnia się i wraca do spokojnej.

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

### Obrazki mrugania i mówienia

1. Wybierz jeden lub kilka sprite'ów, a potem **Eyes closed** (zamknięte oczy), **Mouth open** (otwarte usta) albo obie opcje. Gdy postać lub persona ma sprite'y portretowe, oferowane są tylko one, bo awatar nigdy nie miesza min portretowych i min całej sylwetki.
2. Sprawdź **Image connection** (połączenie do generowania obrazów; twoje domyślne połączenie obrazowe jest wybrane automatycznie) i wybierz **Make pictures** (tworzenie obrazków). Każdy obrazek to jedno zapytanie o obraz. Przy włączonej opcji **Expose media prompts before sending** (w ustawieniach) najpierw widzisz każdy prompt i możesz go edytować.
3. Nowe obrazki pojawiają się po kolei. Przy tych, które wyglądają dobrze, wybierz **Keep** (zachowanie), a przy pozostałych **Try again** (ponowna próba). **Cancel** (anulowanie) zatrzymuje tworzenie bieżącego obrazka. Obrazki, które już masz, zostają, gdy tworzysz kolejne: **Make pictures** tworzy tylko brakujące, a jeśli **Try again** się nie uda, zostaje stary obrazek. Aby utworzyć zachowany obrazek od nowa, najpierw wybierz **Kept** (zachowany), żeby z niego zrezygnować.
4. Wybierz **Save kept pictures** (zapisanie zachowanych obrazków). Stają się one obrazkami mrugania i mówienia awatara PNGTuber dla tych wyrazów twarzy i leżą obok kopii sprite'a, z którego powstały, więc zawsze się z nim pokrywają. Jeśli awatar nadal pokazywał twoje sprite'y w niezmienionej postaci, zachowuje je wszystkie i dostaje nowe obrazki. Jeśli przed zapisaniem podmienisz sprite, utwórz jego obrazki ponownie.

Najlepiej sprawdzają się modele obrazów, które edytują obrazy, bo dostają twój sprite jako referencję. Sprite jest wysyłany w rozmiarze i proporcjach akceptowanych przez model, a potem wycinany z powrotem z wyniku, więc model, który nie przesuwa obrazu, daje obrazki, które się pokrywają. Jeśli obrazek zmienia coś więcej niż oczy albo usta, awatar przeskakuje przy mrugnięciu albo mówieniu; utwórz wtedy ten obrazek ponownie.

<a id="mesh-avatar"></a>

### Awatar mesh

1. Wybierz jeden sprite. Najlepiej sprawdza się popiersie zwrócone przodem (głowa i ramiona); sprite całej sylwetki ma małą twarz.
2. Wybierz **Chat connection that can see pictures** (połączenie czatu, które widzi obrazy). **The agent's connection** (połączenie agenta) używa połączenia ustawionego na stronie 2D Avatars, a w drugiej kolejności twojego domyślnego połączenia agentów. Jego model musi przyjmować obrazy.
3. Wybierz **Make mesh avatar** (utworzenie awatara mesh). Model czatu znajduje twarz, a Marinara Engine buduje awatar z twojego sprite'a. **Cancel** przerywa tworzenie.
4. Sprawdź podgląd: obrysy powinny leżeć na oczach, brwiach i ustach. Wybierz **Save as mesh avatar** (zapisanie jako awatar mesh) albo **Discard** (odrzucenie) i spróbuj innego sprite'a lub modelu.

Wygenerowany awatar mesh porusza głową, oczami, brwiami i ustami, a mruga i mówi własnymi powiekami i ustami. Włosy poruszają się razem z głową; dłonie, pojedyncze kosmyki i zwisające akcesoria nie poruszają się osobno. Gdy twarz wypełnia większość dużego sprite'a, awatar powstaje z mniejszej kopii, żeby tworzenie trwało krótko.

Twój sprite jest wysyłany do połączenia obrazowego przy obrazkach mrugania i mówienia (a jeśli to połączenie zawiedzie i ma ustawione zapasowe połączenie obrazowe, także do tamtego) oraz do połączenia czatu przy awatarze mesh. Prompty są częścią agenta 2D Avatars. Przy włączonej opcji **Expose media prompts before sending** możesz przeczytać i zmienić prompt każdego obrazka przed jego wysłaniem. Przy włączonym trybie diagnostycznym (Debug mode) każdy prompt trafia do logu serwera.

## Tworzenie własnego modelu

Na początek nie musisz niczego tworzyć. Postać lub persona ze sprite'ami wyrazów twarzy ma już awatar PNGTuber, a [Tworzenie awatara ze sprite'a](#making-an-avatar-from-a-sprite) dodaje obrazki mrugania i mówienia albo buduje za ciebie awatar mesh. Jeśli zamiast tego chcesz zrobić własny model, użyj jednego z tych narzędzi. Sprite'y pokazują się od razu po dodaniu, a każdy plik importuje się na stronie agenta w panelu **Agents**.

| Czego potrzebujesz | Narzędzie | Co dostajesz |
| --- | --- | --- |
| Sprite'y PNGTuber | Dowolny program do rysowania, a potem zakładka **Sprites** (sprite'y) postaci | Sprite'y |
| Sprite'y PNGTuber z warstwami i kostiumami | [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) | Plik `.save` |
| Awatar mesh | [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) | Plik `.mavatar` |
| Model 3D | [VRoid Studio](https://vroid.com/en/studio) albo Blender z [VRM Add-on for Blender](https://vrm-addon-for-blender.info/en-us/) | Plik `.vrm` i opcjonalnie animacja spoczynkowa `.vrma` |

### Własne sprite'y

1. Narysuj po jednym obrazku dla każdej emocji, wszystkie w tym samym rozmiarze i z postacią w tym samym miejscu. Nazwij każdy według jego emocji: `neutral`, `happy`, `angry`, `sad`, `relaxed` i `surprised`. Działają też nazwy zawierające słowo opisujące emocję, takie jak `smile`, `cry`, `calm` czy `shock`.
2. Żeby usta się poruszały, narysuj ten sam obrazek, zmieniając tylko usta na otwarte, i dodaj do jego nazwy `_talk`, na przykład `happy_talk`. Do mrugania zamknij tylko oczy i dodaj `_blink`; przy obu zmianach dodaj `_blink_talk`. Emocja bez takich obrazków i tak podskakuje podczas mówienia.
3. Dodaj obrazki w zakładce **Sprites** postaci lub persony, w kategorii **Facial Expressions** (wyrazy twarzy). **Upload Folder** (wgrywanie folderu) dodaje cały folder i nadaje każdemu sprite'owi nazwę jego pliku. Zobacz [Sprite'y postaci](../characters/sprites.md).
4. Czaty z włączonym agentem 2D Avatars pokazują je od razu. Aby zmienić minę dla danej emocji albo ruch, zobacz [Sprite'y PNGTuber](#pngtuber-sprites).

### PNGTuber Plus

1. Zbuduj awatar z osobnych warstw. Ustaw otwarte usta tak, żeby pokazywały się tylko podczas mówienia, a zamknięte tylko w ciszy. Zamknięte oczy ustaw tak, żeby pokazywały się tylko podczas mrugania, a otwarte tylko poza mruganiem.
2. Dla każdej emocji przygotuj kostium, który podmienia oczy albo usta, i nazwij te obrazki według emocji, na przykład `angry eyes.png` albo `happy_mouth.png`. Kostium 1 to mina w spoczynku.
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
