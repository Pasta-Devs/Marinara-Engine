# Panel **Chat Settings** – przegląd

**Chat Settings** (ustawienia czatu) to panel opcji otwartego czatu: jego modelu, postaci, agentów, wyszukiwania, podsumowań, gałęzi i galerii. Większość ustawień dotyczy tylko tego czatu.

## Otwieranie Chat Settings

1. Otwórz czat.
2. Dotknij przycisku **Chat Settings** (ikona suwaków). Otworzy się panel. Na telefonie przycisk **Help** (pomoc, **?**) pokazuje opis ikon.
3. Dotknij tytułu sekcji, aby ją rozwinąć. Ponowne dotknięcie tytułu zwija sekcję.

Chat Settings otwiera się automatycznie po utworzeniu czatu. Aby je zamknąć, dotknij **X** w panelu albo ponownie przycisku z suwakami.

Na komputerze przycisk z suwakami początkowo znajduje się w prawym górnym rogu czatu. Gdy po prawej stronie widać Tracker Panel, przycisk początkowo stoi na lewo od tego panelu. Tracker Panel to panel boczny w trybie Roleplay, który pokazuje, co śledzą agenci (pomocnicy działający obok odpowiedzi), na przykład postacie w scenie.

Przycisk z suwakami da się przeciągnąć w wygodniejsze miejsce. Podczas przeciągania wyrównuje się z pobliskimi przyciskami czatu. Na komputerze przytrzymaj <kbd>Alt</kbd>, aby ustawić go swobodnie. Każdy czat zapamiętuje jego położenie. Mała kropka na przycisku oznacza, że agenci pracują. W czacie Roleplay z funkcją Advanced Memory Recall stała kropka w drugim rogu oznacza, że niektóre wspomnienia scen wymagają uwagi. Zobacz [Naprawianie problemów z pamięcią](../agents/memory.md#fixing-memory-problems).

Przy pierwszym otwarciu czatu krótki film pokazuje, jak rozmieszczać przyciski i okna. Kliknij **Got it** (rozumiem). Film pozostanie zamknięty w innych czatach i po odświeżeniu strony. Aby wskazówki dotyczące układu pozostały ukryte w jednym czacie, kliknij **X** obok nich, z podpowiedzią **Hide these tips for this chat** (ukrycie wskazówek dla tego czatu).

## Sekcje w skrócie

To, które sekcje widać, zależy od trybu czatu. Sekcję **Impersonate** opisuje przewodnik [Sterowane generowanie i Impersonate](guided-and-impersonate.md).

- Pasek profilu ustawień: stosuje lub zapisuje zestaw ustawień czatu. Zobacz [Profile ustawień](settings-profiles.md). (Conversation, Roleplay.)
- **Search messages** (wyszukiwanie wiadomości): znajduje wiadomości po słowach albo po `#` i numerze wiadomości. Zakładki **Bookmarks** (zakładki) i **Trash** (kosz) pokazują wiadomości dodane do zakładek i usunięte. (Nie w trybie Game.)
- **Chat Name** (nazwa czatu): nazwa na liście czatów. Kliknij ją, aby ją zmienić. Nigdy nie trafia do modelu.
- **Chat Branches** (gałęzie czatu): przełączanie, zmiana nazw, eksport i import gałęzi. Zobacz [Gałęzie czatu](branches.md).
- **Connection** (połączenie): model, który odpowiada w tym czacie. Opis niżej.
- **Prompt Preset** (preset promptu): zapisana struktura promptu dla tego czatu.
- **Advanced Parameters** (parametry zaawansowane): nadpisuje w tym czacie ustawienia generowania, takie jak temperatura. Zobacz [Parametry generowania](../prompts/generation-parameters.md).
- **Persona**: postać, w którą się wcielasz. Zobacz [Wybór persony w czacie](../characters/choosing-your-persona.md). (Conversation, Roleplay.)
- **Characters** (postacie): postacie w czacie. (Conversation, Roleplay.)
- **Ruleset** (zestaw zasad): rozgrywa czat według zestawu zasad stołowych, z rzutami kośćmi i testami umiejętności oraz arkuszami postaci. Zobacz [Roleplay: gra z zestawem zasad](../roleplay/rulesets.md). (Roleplay.)
- **Party** (drużyna): zastępuje sekcje **Persona** i **Characters**, łącząc je w jednym miejscu. (Game.)
- **Group Chat** (czat grupowy): kto zabiera głos w grupie. Zobacz [Czaty grupowe](group-chats.md). (Czaty z więcej niż jedną postacią.)
- **Scoped Regex Scripts**: osobne dla każdego czatu ustawienie skryptów regex należących do postaci. Zobacz [Skrypty regex](../extending/regex-scripts.md#the-per-chat-scoped-regex-scripts-setting). (Widoczne tylko wtedy, gdy postać w czacie ma przypisane skrypty.)
- **Chat Variables** (zmienne czatu): nazwany tekst, którego używasz ponownie przez `{{name}}`. Opis niżej.
- **Connected Chats** (połączone czaty): łączy czat z innym czatem. Zobacz [Łączenie czatu Conversation z czatem Roleplay lub Game](connected-chats.md).
- **Lorebooks** (lorebooki): podpina informacje o świecie. Zobacz [Lorebooki – przegląd](../lorebooks/overview.md).
- **Chat Summary** (podsumowanie czatu): przeglądanie i tworzenie podsumowań. Zobacz [Memory Recall i podsumowania czatu](../agents/memory.md#chat-summary-roleplay). (Tam, gdzie działają podsumowania.)
- **Active Context** (aktywny kontekst): pokazuje lorebooki i kontekst aktywne w tym czacie. Zobacz [Limity tokenów i rekurencja w lorebookach](../lorebooks/token-budgets.md#seeing-skipped-entries-in-active-context).
- **Agents** (agenci): włącza pomocników. Zobacz [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md).
- **Agent activity** (aktywność agentów): pokazuje, co zrobili agenci. Pozwala ponownie uruchomić trackery, ponowić lub zatrzymać agentów i wyczyścić trackery. Zobacz [Agent activity](../roleplay/getting-started.md#agent-activity). (Roleplay, z włączonymi agentami lub funkcją Advanced Memory.)
- **Author's Notes** (notatki autora): notatka, którą model czyta w każdej turze. Zobacz [Author's Notes](../roleplay/getting-started.md#authors-notes). (Roleplay.)
- **Background** (tło): obraz tła czatu. (Roleplay, Game.)
- **Gallery** (galeria): obrazy i filmy czatu. Zobacz [Tła scen i galeria](../media/scene-backgrounds.md).
- **Widgets** (widgety): to, które widgety paska HUD są widoczne w grze. (Game.)
- **Impersonate**: ustawienia komendy `/impersonate`. (Roleplay.)
- **Memory Recall**: pamięta wcześniejsze części czatu. Zobacz [Memory Recall i podsumowania czatu](../agents/memory.md). (Niedostępne w wersji Lite.)
- **Function Calling** (wywoływanie funkcji): pozwala modelowi używać w tym czacie narzędzi (funkcji).
- **Translation** (tłumaczenie): automatyczne tłumaczenie wiadomości. Zobacz [Tłumaczenie wiadomości](../integrations/message-translation.md).

Czaty Conversation mają też sekcje Autonomous Messaging (postacie piszą do ciebie pierwsze), Commands (działania, które postacie podejmują same) oraz sekcje notatek. Opisuje je przewodnik [Tryb Conversation: pierwsze kroki](../conversation/getting-started.md).

## Wybór modelu dla czatu

Sekcja **Connection** wybiera model, który odpowiada w tym czacie. Wybór zmienia tylko ten czat.

1. Otwórz **Chat Settings** i sekcję **Connection**.
2. Dotknij pola **Model**. Pokazuje ono bieżący model.
3. Sprawdź, czy pole informuje, że czat podąża za modelem **Main** (główny). Main to domyślny model ustawiany w **Connections** (Połączenia).
4. Wybierz model. To samo okno wyboru otwiera przycisk modelu w polu wiadomości. Bieżący model zostaje na górze, a pod nim są ostatnio używane modele i modele oznaczone gwiazdką, zgrupowane według kont. Przeszukuj modele i konta albo użyj przycisku **Browse** (przeglądanie), aby otworzyć katalog jednego konta.

**Follow Main** (podążanie za modelem głównym) usuwa własny wybór czatu, więc czat zmienia model, gdy zmieniasz model Main. **Shuffle** (losowanie) wybiera inny model z twojej puli Shuffle przy każdej odpowiedzi. Zobacz [Funkcja Shuffle](../connections/organizing-connections.md#shuffle). Jeśli konto wymaga klucza albo jest wyłączone, jego model prowadzi do działania naprawczego. Jak dodać konto, opisuje przewodnik [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

## Używanie zmiennych czatu

Zmienna czatu to nazwa fragmentu tekstu. Na przykład dodaj zmienną `char1` o wartości `Mary`, a potem wpisz w wiadomości `{{char1}} walks in.`. Model przeczyta "Mary walks in."

1. Otwórz **Chat Settings** i sekcję **Chat Variables**.
2. Dotknij **Add variable** (dodanie zmiennej), a potem wypełnij w wierszu pola **name** (nazwa) i **value** (wartość).
3. Naciśnij <kbd>Enter</kbd> albo kliknij poza polem, aby zapisać. Przycisk kosza usuwa zmienną.

Nazwy składają się z liter, cyfr i podkreśleń, zaczynają się od litery lub podkreślenia i mają najwyżej 64 znaki. Nazwa mająca dokładnie 21 znaków jest zarezerwowana dla odwołań do postaci. Nazwa należąca do wbudowanego makra, na przykład `char` lub `user`, zostanie odrzucona.

- Twoja wiadomość nadal pokazuje wpisany znacznik. Wartość widzi tylko model. Późniejsza zmiana wartości zmienia każdą wcześniejszą turę, w której użyto tego znacznika.
- Zmienne należą tylko do tego czatu i zostają zachowane po ponownym uruchomieniu.
- To ten sam magazyn, którego używa `{{setvar}}`. Sekcja promptu lub wpis lorebooka, który ustawia tę samą nazwę, nadpisuje twoją wartość.

Przy wielu zmiennych kliknij **Search and edit all in the State Editor** (szukaj i edytuj wszystko w State Editor). Pokazuje wszystkie zmienne na jednej liście, więc możesz je przeszukiwać, edytować, wklejać wiele naraz jako JSON i przejrzeć zmiany przed zapisem. Zobacz [State Editor](../roleplay/hud-and-trackers.md#the-state-editor). Inne makra w podwójnych klamrach opisuje przewodnik [Makra promptów](../prompts/macros.md).

<a id="settings-profiles"></a>

## Profile ustawień

Profil ustawień to zapisany zestaw ustawień czatu, który da się zastosować w innych czatach. Pasek profilu znajduje się na górze panelu i nie pojawia się w trybie Game. Zapisywanie, stosowanie, import, eksport i wybór profilu domyślnego opisuje przewodnik [Profile ustawień](settings-profiles.md).

## Przesuwanie, przypinanie i blokowanie okna

Na komputerze Chat Settings to okno unoszące się nad czatem, a jego zawartość dopasowuje się do rozmiaru okna. Okno otwiera się pod swoim przyciskiem za pierwszym razem albo w zapisanym położeniu.

- Przesuwanie: przeciągnij pasek tytułu. Możesz też zaznaczyć go klawiaturą i użyć klawiszy strzałek; z klawiszem <kbd>Shift</kbd> kroki są większe.
- Zmiana rozmiaru: przeciągnij krawędź lub narożnik. Możesz też zaznaczyć klawiaturą uchwyt w prawym dolnym rogu i użyć strzałek.
- Przypinanie: kliknij **Pin** (przypięcie). Przypięte okno zostaje otwarte po kliknięciu gdzie indziej i otwiera się ponownie po odświeżeniu strony. Nieprzypięte okno zamyka się po kliknięciu poza nim lub naciśnięciu <kbd>Esc</kbd>, chyba że piszesz albo korzystasz z otwartego menu.
- Blokowanie: kliknij **Lock** (blokada). Okna nie da się przesunąć ani zmienić jego rozmiaru, a jego przycisk zostaje w miejscu. Nadal można je otworzyć.
- Zamykanie: kliknij **X**.

Okna pozostają w obszarze czatu. Okno lub przycisk może stać obok pola wiadomości, ale nigdy go nie zasłania. Na telefonie Chat Settings otwiera się jako panel na całą szerokość, który mieści się nad klawiaturą.

## Pomoc, trackery i Reset View

Te przyciski są na pasku tytułu.

- **Help** (**?**) pokazuje etykiety objaśniające kontrolki czatu. Na telefonie najpierw zamyka Chat Settings. Aby go ukryć, włącz **Settings → General → App Behavior → Hide chat Help button** (ustawienia, ogólne, zachowanie aplikacji, ukrycie przycisku pomocy czatu).
- **Reset View** (przywrócenie widoku, okrągła strzałka) prosi o potwierdzenie, a potem przywraca początkowy układ tego czatu: wydzielone sekcje wracają na miejsce, a rozmiary, położenia, przypięcia i blokady okien wracają do stanu początkowego.
- **Favorite layout** (ulubiony układ, gwiazdka) zapisuje to rozmieszczenie dla nowych czatów. Zobacz [Wybieranie układu dla nowych czatów](#choosing-a-layout-for-new-chats).
- **Tracker Panel** (panel trackerów, kość) włącza lub wyłącza panel w czacie Roleplay korzystającym z agentów lub funkcji Advanced Memory. Na komputerze panel otwiera się obok czatu. Na telefonie lub tablecie otwiera go przesuwany przycisk. Zmienia też ustawienie Tracker Panel w **Settings → Appearance** (ustawienia, wygląd).

Gdy Tracker Panel nie jest widoczny, trackery na komputerze korzystają z [okna Trackers](../roleplay/hud-and-trackers.md#the-trackers-window). Jeśli obok wiadomości jest mało miejsca, okno zaczyna jako mały przycisk **Trackers**. Użyj kości, aby znów pokazać Tracker Panel.

<a id="popping-a-section-out-into-its-own-window"></a>

## Wydzielanie sekcji do osobnego okna

Wydziel sekcję, aby dostała własne okno.

1. Kliknij w sekcji przycisk **Pop out** (wydzielenie do okna, kwadrat ze strzałką obok jej **?**). Na komputerze możesz też przeciągnąć tytuł sekcji poza Chat Settings.
2. Przesuwaj, zmieniaj rozmiar, przypinaj lub blokuj nowe okno tak samo jak Chat Settings. Na początku nie jest przypięte, więc kliknięcie gdzie indziej zwija je do przycisku.
3. Aby włożyć je z powrotem, kliknij **Put back in Chat Settings** (przeniesienie do Chat Settings, zakrzywiona strzałka obok **X**) albo przeciągnij okno na Chat Settings.

**X** zmniejsza sekcję do małego przycisku z jej ikoną. Przeciągnij przycisk w wybrane miejsce i kliknij go, aby ponownie otworzyć okno. Trackery wydziela się z okna Trackers tak samo, a ich przycisk powrotu to **Put back in Trackers** (przeniesienie do Trackers).

Na telefonie wydzielenie zamyka Chat Settings i dodaje sekcję do menu **Chat tools** (narzędzia czatu) z trzema kropkami. Dotknij kropek, a potem okrągłej ikony sekcji. Dotknij **Put back in Chat Settings**, aby ją przywrócić.

<a id="the-phones-chat-tools-menu"></a>

## Menu Chat tools na telefonie

Przesuwany przycisk z trzema kropkami zbiera narzędzia wyjęte z Chat Settings. Dotknij go, aby rozwinąć okrągłe przyciski z ikonami, a potem dotknij narzędzia. Ponownie dotknij kropek, aby je zwinąć. Przyciski trackerów, przycisk mapy Game i Character Profiles pozostają osobno.

Przeciągnij przycisk z trzema kropkami, aby przesunąć menu. Otwórz je i użyj blokady u góry, aby je unieruchomić. Gdy menu jest odblokowane, przeciągnij narzędzie w górę lub w dół, aby zmienić jego miejsce, albo zaznacz je klawiaturą i użyj strzałek. Blokada uniemożliwia zarówno przesuwanie, jak i zmianę kolejności. Menu korzysta z twojego stylu widgetów czatu.

<a id="control-windows-and-their-buttons"></a>

## Okna narzędzi i ich przyciski

Niektóre narzędzia otwierają własne małe okna: **Game controls** (sterowanie grą), **Session** (sesja), **Volume** (głośność) i **Game Assets** (zasoby gry) w trybie Game, a także **Connected chat** (połączony czat) i kontrolki zainstalowanych pakietów.

Na komputerze te przyciski początkowo stoją w pobliżu prawego górnego rogu czatu. Kliknij przycisk, aby otworzyć jego okno. Zamknięcie okna przywraca przycisk. Na telefonie są w menu **Chat tools** i otwierają się jako panele na całą szerokość.

Aby trzymać takie narzędzie wewnątrz Chat Settings, otwórz jego okno i wybierz **Put back in Chat Settings**. Przycisk wydzielenia sekcji znów je oddziela. **Reset View** przywraca początkowe rozmieszczenie.

Przeciągnij przycisk, aby go przesunąć. Pobliskie przyciski wyrównują się podczas przeciągania. Przytrzymaj <kbd>Alt</kbd>, aby ustawić go swobodnie, albo użyj strzałek, gdy jest zaznaczony. Przycisk **Calls** (rozmowy głosowe) w trybie Conversation pozostaje zwykłym przyciskiem. W trybie Game przycisk **Character Profiles** (profile postaci) i przycisk **Map** (mapa) na telefonie można przesuwać, a ich blokada zachowuje położenia w każdej grze.

## Każdy czat zapamiętuje własny układ okien

Każdy czat zapamiętuje rozmiary i położenia okien, przypięcia i blokady, wydzielone sekcje oraz położenia przycisków. Położenia na telefonie oraz kolejność i blokada menu Chat tools zapisują się oddzielnie od położeń na komputerze. [Profil ustawień](settings-profiles.md) może zapisać układ do użycia w innych czatach.

<a id="choosing-a-layout-for-new-chats"></a>

## Wybieranie układu dla nowych czatów

Gwiazdka obok **Reset View** sprawia, że bieżące rozmieszczenie staje się początkowym układem nowych czatów w tym samym trybie. Tryby Conversation, Roleplay i Game mają osobne ulubione układy.

1. Rozmieść okna i przyciski. Umieść narzędzia w Chat Settings lub wydziel je do osobnych okien.
2. Ukryj wskazówki dotyczące układu, jeśli mają być ukryte również w nowych czatach.
3. Kliknij gwiazdkę. Wypełnia się, gdy bieżący układ, wskazówki i tryb Scoped Regex Scripts odpowiadają zapisanemu ulubionemu układowi.

Ulubiony układ zapisuje położenia, rozmiary, przypięcia, blokady, narzędzia wydzielone lub umieszczone w Chat Settings, wybór dotyczący wskazówek oraz tryb [Scoped Regex Scripts](../extending/regex-scripts.md#the-per-chat-scoped-regex-scripts-setting) czatu. Czat z opcją **Use preset default** (użyj ustawienia domyślnego presetu) nie zapisuje trybu, więc nowe czaty przejmują go ze swojego presetu promptu. Postacie, model, ustawienia AI i wiadomości pozostają przypisane do czatu.

Aby zastąpić ulubiony układ, zmień rozmieszczenie i ponownie kliknij gwiazdkę. Aby przestać z niego korzystać, kliknij wypełnioną gwiazdkę. Dotyczy to tylko czatów utworzonych później.

Zastosowany profil ustawień z własnym zapisanym układem ma pierwszeństwo przed ulubionym układem. Profil bez zapisanego układu pozostawia ulubione rozmieszczenie bez zmian. Profile nadal stosują własne ustawienie wskazówek i własny tryb Scoped Regex Scripts. Zobacz [Profile ustawień](settings-profiles.md#favorite-window-layouts).

Po aktualizacji ze starszej wersji dotychczasowy układ przycisków narzędzi jest już oznaczony gwiazdką we wszystkich trzech trybach, dopóki go nie zastąpisz lub nie usuniesz. Nowa instalacja ma narzędzia wewnątrz Chat Settings i nie ma ulubionego układu.

## Zmiana wyglądu okien czatu

Otwórz **Settings → Appearance → App** (ustawienia, wygląd, aplikacja) i przewiń do **Chat widget style** (styl widgetów czatu) na dole sekcji **App Style** (styl aplikacji). **Default** (domyślny) zachowuje wygląd aplikacji Marinara Engine. **Dottore** używa lodowych błękitów, jasnego metalu i przyciętych narożników. **Prof. Mari** używa błękitów kamieni szlachetnych, ciepłego złota i łukowatych ramek. Oba style dostosowują się do jasnego i ciemnego trybu i obejmują przesuwane przyciski, okna i sekcje we wszystkich trzech trybach czatu.

- **Font** (czcionka), **Shape** (kształt) i trzy narzędzia wyboru kolorów pod presetami pozwalają dopasować wygląd. Czcionki zainstalowane w aplikacji Marinara Engine pojawiają się na liście czcionek. Ponowne wybranie presetu resetuje czcionkę, kształt i własne kolory.
- **Button size (px)** (rozmiar przycisków w pikselach) ustawia rozmiar przesuwanych przycisków czatu, od 32 do 96. Puste pole zachowuje rozmiar domyślny.
- **Apply preset font** (zastosowanie czcionki presetu), **Apply preset shape** (zastosowanie kształtu presetu) i **Apply preset colors** (zastosowanie kolorów presetu) rozszerzają styl na wiadomości, pola wpisywania i kontrolki czatu. Każdy przełącznik działa osobno i wszystkie są początkowo wyłączone. Wiadomości Conversation korzystają z czcionki i kolorów, ale zachowują własny kształt. Przy włączonym **Apply preset colors** wypowiedzi w cudzysłowie zachowują kolor Dialogue Highlight Color danej postaci lub persony.

Te wybory nie przesuwają okien. Zapisują się w preferencjach aplikacji i synchronizują z przeglądarkami połączonymi z tym samym serwerem. Zobacz [Własne motywy CSS](../appearance/custom-css-themes.md#ready-made-chat-window-styles).
