# Agent Illustrator

Z tego przewodnika dowiesz się, do czego służy agent **Illustrator** – wbudowany pomocnik, który rysuje obrazki scen w trakcie czatu. Zobaczysz, co dokładnie robi, jak go włączyć, jakie style graficzne oferuje i jakich dwóch połączeń potrzebuje.

## Do czego służy agent Illustrator

Agent to niewielki pomocnik AI, który działa automatycznie w obrębie jednego czatu. Agent **Illustrator** uruchamia się po zakończeniu generowania, czyli dopiero wtedy, gdy AI skończy pisać odpowiedź. Czyta ostatnią odpowiedź i ocenia, czy dana chwila zasługuje na obrazek. Jeśli tak, agent **Illustrator** pisze prompt obrazu i wysyła go do dostawcy obrazów. Prompt to tekstowy opis, który mówi modelowi graficznemu, co ma narysować.

Agent **Illustrator** nie rysuje do każdej wiadomości. Domyślnie po wykonaniu obrazu czeka na 5 przyjętych wiadomości użytkownika i AI, zanim zrobi kolejny. Tę liczbę da się zmienić osobno dla każdego czatu Roleplay. Przeglądanie swipe'ów ani ponowne generowanie tej samej odpowiedzi nie przesuwa tego licznika. Jeśli agent uzna, że dana chwila nie nadaje się na ilustrację, pomija ją i nie tworzy obrazu. Każdy powstały obraz trafia do sekcji **Gallery** (Galeria) danego czatu.

Agenta **Illustrator** można używać w czatach **Roleplay** i **Game Mode**, a jego instalacja odblokowuje też selfie i [wiadomości wideo](../conversation/selfies.md#video-messages) w trybie Conversation. Krótki opis w aplikacji brzmi: "Responsible for image and video generations." Kroki konfiguracji i ustawienia opisane w tym przewodniku dotyczą czatów Roleplay. Tryb Game Mode korzysta zamiast tego z jednego prostego przełącznika, opisanego niżej w sekcji o trybie Game Mode.

## Zanim zaczniesz

Agent **Illustrator** pisze prompt obrazu, ale do samego narysowania obrazka potrzebuje osobnego połączenia z modelem graficznym. Takie połączenie to zapisany skrót do dostawcy obrazów, na przykład OpenAI albo lokalnego serwera Stable Diffusion.

Najpierw skonfiguruj połączenie z modelem graficznym. Są dwa sposoby, żeby udostępnić je agentowi **Illustrator**:

1. Oznacz jedno połączenie graficzne jako domyślne. Otwórz panel **Connections** (Połączenia), rozwiń sekcję **Defaults** (ustawienia domyślne) i wskaż je w polu **Images** (Obrazy).
2. Albo przypisz agentowi **Illustrator** własne połączenie graficzne na jego pełnym ekranie konfiguracji (zobacz opis przycisku **Open Setup** niżej).

Jeśli nie da się znaleźć żadnego połączenia graficznego, obraz nie powstaje, a aplikacja prosi o wskazanie połączenia. Dodawanie dostawcy opisuje przewodnik [Dostawcy generowania obrazów i konfiguracja](image-providers.md).

## Włączanie agenta Illustrator

Agent **Illustrator** jest domyślnie wyłączony. Oto, jak dodać go do czatu **Roleplay**:

1. Otwórz czat, który ma być ilustrowany.
2. Otwórz **Chat Settings** (ustawienia czatu) przyciskiem w czacie. Domyślnie jest w prawym górnym rogu.
3. Znajdź sekcję **Agents** (Agenci) i włącz przełącznik **Enable Agents** (włączenie agentów).
4. W grupie **Misc Agents** (pozostali agenci) znajdź pozycję **Illustrator** i dodaj ją przyciskiem z plusem.

Teraz na ekranie widać kartę ustawień agenta **Illustrator** z jego własnymi opcjami. Dodanie agenta zużywa dodatkowe tokeny i może oznaczać dodatkowe zapytania do AI w każdej turze. Szacunkowe liczby tokenów obejmują tylko instrukcje agentów, a nie bieżący koszt.

### Game Mode: przełącznik Game Illustrator

Tryb Game Mode nie korzysta z powyższych kroków i nie pokazuje opcji **Prompt Mode** ani **Prompt Model**. Zamiast tego otwórz panel **Chat Settings** danej gry i włącz pojedynczy przełącznik **Game Illustrator**. Jego opis brzmi: "Auto-generate scene illustrations, NPC portraits, and location backgrounds during gameplay."

## Tryby promptu

Lista rozwijana **Prompt Mode** (tryb promptu) ustala styl graficzny, który agent **Illustrator** zapisuje w treści każdego promptu. Na karcie agenta ta lista nosi etykietę **Prompt**. Krótki podpis pod nią brzmi: "Prompt mode controls how Illustrator writes image prompts for this chat."

Do wyboru są następujące style:

- **Illustration**: pojedynczy, dopracowany obraz sceny. To styl ogólnego przeznaczenia.
- **Comic Page**: strona komiksu z kadrami, dymkami dialogowymi, podpisami i efektami dźwiękowymi.
- **Colored Manga**: kolorowa scena w stylu mangi, ze stylizowanymi dymkami i efektami dźwiękowymi.
- **B&W Manga**: czarno-biała strona mangi z tuszowanymi kreskami i cieniowaniem rastrem.
- **Background**: ujęcie miejsca albo kadr ustalający, bez postaci.
- **Selfie**: selfie zrobione w roli albo swobodny portret.

Nowo dodany agent **Illustrator** startuje ze stylem **Background**. Styl da się zmienić w każdej chwili z tej listy. Ostateczny wygląd obrazu zależy dodatkowo od profilu stylu. Ustawia się go zgodnie z przewodnikiem [Profile stylu obrazów](style-profiles.md).

## Prompt Model i połączenie graficzne

Agent **Illustrator** korzysta z dwóch różnych połączeń i warto ich nie mylić.

Pole **Prompt Model** (model promptu) wskazuje model tekstowy, który pisze prompt obrazu. To nie jest model rysujący obrazek. Wybierz go z listy rozwijanej **Prompt Model** na karcie agenta **Illustrator**. Domyślna wartość to **Main chat model**, czyli ponowne użycie tego samego połączenia, z którego korzysta już czat. Wskaż inne połączenie tekstowe, jeśli prompty ma pisać inny model.

Połączenie graficzne to dostawca obrazów, który rysuje gotowy obrazek. Ustawia się je w sposób opisany w sekcji "Zanim zaczniesz" – albo w **Defaults → Images**, albo na własnym ekranie konfiguracji agenta.

## Attach Card Appearance i Send Avatar References

Dwa ustawienia na karcie agenta **Illustrator** pomagają zachować spójny wygląd postaci. Oba są domyślnie wyłączone.

Przy obrazach **Attach Card Appearance** dopisuje do promptu obrazu zapisany opis wyglądu każdej widocznej postaci. Prompty wideo dostają go tylko wtedy, gdy uwzględnisz filmy, jak opisano niżej. Tekst pomocy brzmi: "Append matched character appearance lines to image prompts, using only visible/generated names." Włącz go, gdy obraz ma odpowiadać temu, jak postać została opisana.

W panelu **Chat Settings** czatu Roleplay **Attach Card Appearance** to lista rozwijana z czterema opcjami:

- **Off** (wyłączone)
- **Images only** (tylko obrazy) – zwykłe działanie.
- **Videos only** (tylko filmy). Klip dostaje opis wyglądu postaci, które pokazuje. Ma to największe znaczenie przy klipie **Prompt only**, który nie ma obrazu przedstawiającego te postacie.
- **Images and videos** (obrazy i filmy) – jedno i drugie.

Gdy **Attach Card Appearance** jest włączone, karta lub persona z włączonym **Image Appearance Override** (osobny opis wyglądu do obrazów) przekazuje ten osobny opis zamiast tekstu z **Appearance**. Przydaje się to, gdy opis z **Appearance** sprawdza się u narratora, ale model graficzny źle go interpretuje: zostaw pełny opis w **Appearance**, a w osobnym polu wpisz krótszą wersję w postaci tagów. Gdy przełącznik jest wyłączony lub osobne pole jest puste, prompty obrazów nadal korzystają z **Appearance**. Narrator zawsze otrzymuje pełny tekst z **Appearance**. Przełącznik znajdziesz pod polem **Appearance** w edytorze postaci i persony.

Przełącznik **Send Avatar References** wysyła do dostawcy obrazów awatary postaci i persony albo ich sprite'y jako obrazy referencyjne. Tekst pomocy brzmi: "Send matching character and persona avatars or sprites as reference images when the provider supports them." Dzięki temu model graficzny łatwiej odwzorowuje twarz albo strój. Nie każdy dostawca przyjmuje obrazy referencyjne, więc efekt zależy od wybranego dostawcy. W czacie Roleplay jest to lista rozwijana, tak jak **Attach Card Appearance**. Jeśli uwzględnisz filmy, klip z **First frame** ustawionym na **Prompt only** zaczyna się od awatara lub sprite'a postaci zamiast bez obrazu, a ta opcja zmienia nazwę na **Prompt only (avatar from Send Avatar References)**. Pomiń filmy, jeśli klip ma powstać wyłącznie z promptu.

<a id="generated-videos"></a>

## Automatyczne filmy

W czacie Roleplay w sekcji **Chat Settings**, **Agents**, **Illustrator** jest ustawienie **Illustrator makes** (co tworzy agent Illustrator):

- **Pictures** (domyślne): tylko obrazy, tak jak wcześniej.
- **Pictures and clips**: agent Illustrator może też dodać krótki klip do właśnie utworzonego obrazu, gdy najważniejszy jest ruch, na przykład w scenie akcji, przemocy, pościgu lub gdy coś się rozbija. Dotyczy to także obrazów zamówionych przez narratora za pomocą `[illustrate]`. Sam opisuje ruch zgodnie z **Video Prompting Instructions** połączenia wideo. Obraz pojawia się najpierw, a gotowy klip trafia do tej samej wiadomości.
- **Clips only**: za każdym razem, gdy agent Illustrator miałby pokazać obraz, pokazuje zamiast niego krótki klip. Jeśli do klipu zostanie narysowany obraz, staje się on pierwszą klatką i trafia do galerii, a nie do odpowiedzi. Jeśli klip się nie uda, wtedy zamiast niego wyświetla się ten obraz.

Klipy korzystają z **Video Connection** w sekcji **Scene Videos** i każdy z nich to zapytanie o wideo. Bez działającego połączenia wideo agent Illustrator tworzy obrazy, nawet przy **Clips only**. Niestandardowi agenci tworzący obrazy korzystają z tego samego ustawienia.

**Video Run Interval**, widoczne po włączeniu tworzenia klipów, określa liczbę wiadomości użytkownika i asystenta, które muszą minąć od takiego klipu do następnego. Jest niezależne od **Image Run Interval**, które nadal ustala częstotliwość tworzenia obrazów.

- **Clips only**: każde uruchomienie agenta Illustrator to klip. Video Run Interval ustala częstotliwość uruchamiania, a Image Run Interval jest ukryte.
- **Wartość domyślna**: czat bez własnej wartości korzysta z **Video Run Interval** na ekranie **Open Setup** karty agenta Illustrator. Jeśli tam też nie ma wartości, wynosi ona 5.
- **0**: agent Illustrator nie tworzy klipów samodzielnie. Dotyczy to również klipów do obrazów zamówionych przez narratora za pomocą `[illustrate]`; zamiast nich pojawia się obraz.
- **Limit**: jedna odpowiedź dostaje najwyżej **Videos per reply** klipów (w sekcji **Settings**, **Generations**, **Video Generation**).
- **Ręczne klipy**: nadal można animować obraz z galerii. Przy **Clips only** przycisk **Illustrate** przy wiadomości tworzy klip.
- **Swipe'y**: nowy swipe odpowiedzi z klipem liczy się jako nowa odpowiedź. Może dostać własny klip, a wcześniejszy swipe zachowuje swój.

**First frame** (pierwsza klatka), w tej samej sekcji, ustala, od czego zaczyna się każdy klip w trybie Roleplay. Dotyczy to własnych klipów agenta Illustrator, komendy `/video` oraz przycisku **Video** (wideo) w panelu Gallery. Do wyboru jest nowy obraz agenta Illustrator, awatar lub sprite wymienionej postaci, obraz z awatarem jako zastępstwem albo brak obrazu. To samo ustawienie służy do wiadomości wideo w czatach Conversation.

- **Clips only** z awatarem lub bez obrazu: żaden obraz nie jest rysowany. Klip powstaje z opisu sceny i ruchu przygotowanego przez agenta Illustrator.
- **Pictures and clips**: obraz nadal jest widoczny, a tylko klip zaczyna się od awatara lub bez obrazu.
- Bez wybranej pierwszej klatki: klip nigdy nie zamawia obrazu tylko dla siebie. **Pictures and clips** animuje obraz właśnie utworzony przez agenta Illustrator, a **Clips only**, `/video` i przycisk **Video** w panelu Gallery tworzą klip wyłącznie na podstawie sceny.

Klip bez własnego obrazu opisuje wszystkich, których wymienia, łącznie z twoją personą. Pierwsza klatka z awatarem korzysta z osoby wymienionej jako pierwsza.

Ponowne uruchomienie agenta Illustrator z wiadomości (przyciskiem **Illustrate**) także korzysta z **Illustrator makes** i **First frame**: przy **Clips only** tworzy klip zamiast obrazu, a przy **Pictures and clips** może dodać klip, gdy najważniejszy jest ruch.

## Wiele postaci w usłudze NovelAI

Gdy połączenie graficzne agenta Illustrator korzysta z usługi NovelAI i modelu V4, V4.5 lub V5, model piszący prompt otrzymuje instrukcję przygotowania dodatkowego opisu dla każdej widocznej postaci. Każdy opis zawiera wygląd, wyraz twarzy, pozę i przybliżone położenie danej postaci w kadrze. Marinara Engine sprawdza opisy względem listy postaci w scenie, odrzuca te, których nie da się dopasować, i wysyła pozostałe do usługi NovelAI jako natywne prompty postaci obok głównego promptu sceny. Dzięki temu włosy, ubrania i inne cechy nie mieszają się między postaciami w scenach grupowych. Te same opisy dostają obrazy z przycisku **Illustrate** (zilustruj) i z komendy `[illustrate]` postaci.

Liczba opisów zależy od modelu. V5 obsługuje do 22 postaci, a V4 i V4.5 do 6. W scenach z większą liczbą widocznych postaci zachowywane są najważniejsze, a reszta jest traktowana jako bezimienne tło.

Model piszący prompt otrzymuje też wskazówki, skąd brać szczegóły opisów. Stałe cechy pochodzą z pola **Appearance** (wygląd) postaci lub persony: jeśli pole zawiera już tagi Danbooru, są kopiowane bez zmian, a jeśli zawiera zwykły tekst, model zamienia go na tagi. Ubranie pochodzi z bieżącego stroju zapisanego w trackerze postaci, gdy tracker działa, i również jest zamieniane na tagi.

Po włączeniu **Attach Card Appearance** (dołącz wygląd z karty) model dostaje dodatkowo pełną treść pola Appearance każdej karty i persony w czacie jako materiał referencyjny, więc długie karty i karty zbiorowe nie są skracane. Karty opisujące kilka postaci w jednym polu Appearance w formacie `[NAME] tags | [NAME] tags` są rozpisywane osobno dla każdej postaci. Model decyduje, co wykorzystać: kopiuje stałe cechy do pasującego opisu, traktuje tagi ubrań z karty jako ustawienie domyślne, które tracker lub scena może zastąpić, i pomija postaci nieobecne w scenie. Gdy model zwróci opisy postaci, Marinara Engine niczego już nie dopisuje do promptu. Gdy ich nie zwróci, co dotyczy scen z jedną postacią, standardowy wiersz z wyglądem jest dopisywany do głównego promptu tak jak wcześniej.

Nie trzeba niczego ustawiać. Opisy pojawiają się tylko przy połączeniu z własnym serwerem usługi NovelAI, więc połączenia przez proxy lub z innym dostawcą działają bez zmian. Po włączeniu **Expose media prompts before sending** okno podglądu pokazuje opisy pod głównym promptem, aby można było zobaczyć, co zostanie wysłane. Opisy są tam tylko do odczytu; główny prompt można edytować jak zwykle.

## Więcej ustawień i ręczne uruchamianie

Na karcie agenta **Illustrator** jest przycisk **Open Setup** (pełna konfiguracja). Otwiera on pełny ekran konfiguracji agenta, gdzie ustawia się domyślną częstotliwość jego działania i przypisuje mu własne połączenie graficzne.

Każdy czat Roleplay ma własne pole **Image Run Interval** (odstęp uruchamiania) na karcie agenta **Illustrator** w panelu **Chat Settings**. Jego tekst pomocy brzmi: "Messages between automatic images in this chat. 0 means only when you ask." Czat bez własnej wartości korzysta z wartości **Image Run Interval** z ekranu konfiguracji, która wynosi **5**, dopóki jej nie zmienisz. Karta pokazuje napis **Using agent default** albo **Chat override**. Naciśnij przycisk **Use agent default** (użycie wartości domyślnej agenta), aby wrócić do wartości z ekranu konfiguracji. Gdy dodajesz agenta **Illustrator** do czatu, okno dodawania pokazuje to samo pole i zapisuje twój wybór tylko dla tego czatu.

Ustaw **Image Run Interval** na **0**, aby obrazy powstawały wyłącznie na żądanie. Wyłącza to automatyczne uruchomienia agenta Illustrator tworzące obrazy, w tym automatyczne tła scen. Przy **Clips only** ustaw zamiast tego **Video Run Interval** na **0**, aby zatrzymać automatyczne klipy. Agent pozostaje zainstalowany i dostępny w działaniach galerii. Dodatni odstęp między obrazami wznawia ich automatyczne tworzenie.

Obraz da się też zamówić od ręki, bez czekania. Otwórz **Chat Settings**, rozwiń sekcję **Gallery** i użyj przycisku **Illustrate**. Agent **Illustrator** uruchamia się wtedy jednorazowo od razu, a przycisk pokazuje w trakcie pracy napis **Generating...**. Przydaje się to wtedy, gdy chcesz mieć obraz bieżącej chwili, a agent jeszcze nic nie narysował.

## Zapisywanie w galeriach i podgląd promptu

W sekcji **Settings → Generations → Image Generation** (ustawienia → generowanie → generowanie obrazów) opcja **Automatically save generated images to character galleries** (automatycznie zapisuj wygenerowane obrazy w galeriach postaci) jest domyślnie włączona. Wyłącz ją, aby ilustracje i selfie z czatu nie trafiały do galerii przedstawionych postaci i person. Obrazy nadal są widoczne w rozmowie i galerii czatu; ręczne zapisywanie w galerii nadal działa. Istniejące wpisy pozostają bez zmian. Galerie współdzielą pliki obrazów, więc opcja zmienia przypisanie do galerii, a nie usuwa pliku obrazu z czatu.

Dla nowych ilustracji agenta Illustrator wygenerowanych w usłudze NovelAI inspektor pokazuje prompt sceny lub stylu, a po nim pozytywne opisy postaci oddzielone przez ` | `. Dotyczy to również promptu zapisanego w galerii.

Aby narysować ilustrację jeszcze raz ze zmienionym promptem, bez ponownego generowania odpowiedzi, otwórz ją i użyj przycisku **Regenerate image** (ponowne wygenerowanie obrazu). Zobacz [Ponowne generowanie obrazu](scene-backgrounds.md#regenerating-an-image).

Aby zilustrować wcześniejszą wiadomość lub zakres w trybie Roleplay, użyj `/illustrate range=12` albo `/illustrate range=12-18`. Numerację i limity opisuje przewodnik [Komendy ukośnikowe](../chats/slash-commands.md).

## Powiązane przewodniki

- [Dostawcy generowania obrazów i konfiguracja](image-providers.md)
- [Profile stylu obrazów](style-profiles.md)
- [Tła scen i galeria](scene-backgrounds.md)
- [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
