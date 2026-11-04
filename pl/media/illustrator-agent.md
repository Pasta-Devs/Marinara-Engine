# Agent Illustrator

**Illustrator** to agent do pobrania, który w trakcie czatu rysuje obrazy twoich scen. Z tego przewodnika dowiesz się, jak go włączyć, wybrać styl graficzny i model obrazów oraz tworzyć klipy. Agent to niewielki pomocnik AI, który działa automatycznie w obrębie jednego czatu.

## Co robi agent Illustrator

Illustrator to agent przetwarzania końcowego, więc uruchamia się po tym, jak AI skończy każdą odpowiedź. Czyta ostatnią odpowiedź i ocenia, czy dana chwila zasługuje na obraz. Jeśli tak, pisze prompt obrazu (tekst, który mówi modelowi obrazów, co ma narysować) i wysyła go do twojej usługi obrazów. Każdy obraz, który tworzy, zapisuje się w **Gallery** (galeria) czatu.

Nie rysuje do każdej wiadomości. Po utworzeniu obrazu domyślnie czeka na 5 przyjętych wiadomości użytkownika i asystenta, zanim będzie mógł zrobić kolejny. Każdy czat Roleplay może zmienić tę liczbę. Swipe ani ponowne generowanie odpowiedzi nie przesuwają licznika. Jeśli agent uzna, że dana chwila nie zasługuje na obraz, pomija ją.

Działa w czatach w trybie Roleplay i Game Mode. Jego instalacja dodaje też selfie i [wiadomości wideo](../conversation/selfies.md#video-messages) w trybie Conversation. Konfiguracja opisana w tym przewodniku dotyczy trybu Roleplay. Tryb Game Mode korzysta z jednego przełącznika (zobacz [Game Mode](#game-mode-the-game-illustrator-toggle)).

## Zanim zaczniesz

Agent Illustrator pisze prompt, ale obraz rysuje osobny model obrazów. Potrzebujesz takiego modelu. Zobacz [Dostawcy generowania obrazów i konfiguracja](image-providers.md).

Model obrazów możesz mu udostępnić na jeden z dwóch sposobów.

1. Ustaw zadanie **Images** (obrazy) w sekcji **Defaults** (ustawienia domyślne) panelu **Connections** (Połączenia).
2. Albo przypisz agentowi Illustrator własny model obrazów na jego ekranie **Open Setup** (pełna konfiguracja).

Jeśli nie da się znaleźć żadnego modelu obrazów, obraz nie powstaje, a aplikacja prosi o wybranie modelu.

## Włączanie agenta Illustrator

Zanim zaczniesz: zainstaluj agenta **Illustrator** z katalogu **Agent Organizer** (organizowanie agentów). Zobacz [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md).

1. Otwórz czat Roleplay, który chcesz ilustrować.
2. Otwórz **Chat Settings** (ustawienia czatu) i znajdź sekcję **Agents** (Agenci).
3. Włącz **Enable Agents** (włączenie agentów).
4. W grupie **Misc Agents** (pozostali agenci) znajdź **Illustrator** i dodaj go przyciskiem z plusem.

Pojawia się karta **Illustrator** z własnymi opcjami. Agenci zużywają dodatkowe tokeny i mogą dodawać wywołania modelu w każdej turze. Szacunkowe liczby tokenów obejmują tylko instrukcje agentów.

<a id="game-mode-the-game-illustrator-toggle"></a>

### Game Mode: przełącznik Game Illustrator

Tryb Game Mode nie ma opcji **Prompt Mode** (tryb promptu) ani **Prompt Model** (model promptu). Otwórz **Chat Settings** gry i włącz **Game Illustrator** ("Auto-generate scene illustrations, NPC portraits, and location backgrounds during gameplay").

## Wybór stylu graficznego

Lista **Prompt Mode** (na karcie z etykietą **Prompt**) ustala styl graficzny każdego promptu, który pisze agent Illustrator. Nowy agent Illustrator startuje ze stylem **Background**.

| Styl | Co rysuje |
| --- | --- |
| **Illustration** | Pojedynczy, dopracowany obraz sceny. Styl ogólnego przeznaczenia. |
| **Comic Page** | Strona komiksu z kadrami, dymkami dialogowymi, podpisami i efektami dźwiękowymi. |
| **Colored Manga** | Kolorowa scena w stylu mangi ze stylizowanymi dymkami i efektami dźwiękowymi. |
| **B&W Manga** | Czarno-biała strona mangi z tuszowanymi kreskami i cieniowaniem rastrem. |
| **Background** | Ujęcie miejsca albo kadr ustalający, bez postaci. |
| **Selfie** | Selfie zrobione w roli albo swobodny portret. |

Ostateczny wygląd zależy też od profilu stylu. Zobacz [Profile stylu obrazów](style-profiles.md).

## Wybór modelu promptu

**Prompt Model** to model tekstowy, który pisze prompt obrazu. Nie rysuje. Wybierz go z listy **Prompt Model** na karcie. Domyślna wartość to **Main chat model** (główny model czatu), czyli ponowne użycie modelu twojego czatu. Wybierz inny model tekstowy, jeśli prompty ma pisać inny model.

Model obrazów, który rysuje obraz, to ten ustawiony w sekcji **Zanim zaczniesz**.

## Spójny wygląd postaci

Dwa ustawienia na karcie pomagają zachować ten sam wygląd postaci na kolejnych obrazach. Oba są na początku wyłączone.

**Attach Card Appearance** (dołączenie wyglądu z karty) dopisuje do promptu obrazu zapisany opis wyglądu każdej widocznej postaci. W czacie Roleplay jest to lista z czterema opcjami.

- **Off** (wyłączone)
- **Images only** (tylko obrazy), czyli zwykłe działanie.
- **Videos only** (tylko filmy): klip dostaje opis wyglądu postaci, które pokazuje. Ma to największe znaczenie przy klipie **Prompt only**, który nie ma obrazu.
- **Images and videos** (obrazy i filmy): jedno i drugie.

Gdy to ustawienie jest włączone, karta lub persona z włączonym **Image Appearance Override** (osobny opis wyglądu do obrazów) wysyła ten osobny opis zamiast tekstu z **Appearance** (wygląd). Przydaje się to, gdy **Appearance** jest napisane dla narratora, ale model obrazów źle je odczytuje. Zostaw pełny opis w **Appearance**, a w osobnym opisie wpisz krótszą wersję w formie tagów. Gdy osobny opis jest wyłączony lub pusty, prompty obrazów korzystają z **Appearance**. Narrator zawsze widzi pełne **Appearance**. Przełącznik znajduje się pod polem **Appearance** w edytorach postaci i persony.

**Send Avatar References** (wysyłanie awatarów jako referencji) wysyła do usługi obrazów awatary postaci i persony albo ich sprite'y jako obrazy referencyjne, żeby model mógł odwzorować twarz lub strój. Nie każda usługa je przyjmuje. W czacie Roleplay jest to lista, tak jak **Attach Card Appearance**. Gdy uwzględnisz filmy, klip, którego **First frame** (pierwsza klatka) ma wartość **Prompt only**, zaczyna się od awatara lub sprite'a postaci, a ta opcja ma wtedy nazwę **Prompt only (avatar from Send Avatar References)**.

## Częstotliwość rysowania

Karta agenta Illustrator ma przycisk **Open Setup**, który otwiera pełny ekran konfiguracji. Ustawia się tam domyślny odstęp uruchamiania i przypisuje agentowi własny model obrazów.

Każdy czat Roleplay ma własne pole **Image Run Interval** (odstęp między obrazami) na karcie w **Chat Settings** ("Messages between automatic images in this chat. 0 means only when you ask."). Czat bez własnej wartości korzysta z wartości z ekranu konfiguracji, domyślnie **5**. Karta pokazuje **Using agent default** albo **Chat override**. Naciśnij **Use agent default** (użycie wartości domyślnej agenta), żeby wrócić do tej wartości. Gdy dodajesz agenta Illustrator do czatu, okno dodawania pokazuje to samo pole i zapisuje wartość tylko dla tego czatu.

Ustaw **Image Run Interval** na **0**, żeby przejść w tryb wyłącznie ręczny. Zatrzymuje to automatyczne uruchomienia, w tym automatyczne tła scen, ale agent pozostaje dostępny w działaniach galerii. Ustaw liczbę dodatnią, żeby wznowić automatyczne działanie.

Żeby od razu zrobić obraz, otwórz **Chat Settings**, rozwiń sekcję **Gallery** i kliknij **Illustrate** (zilustruj). Agent Illustrator uruchamia się natychmiast, jednorazowo, a przycisk pokazuje **Generating...**.

## Tworzenie klipów

W czacie Roleplay w **Chat Settings → Agents → Illustrator** jest ustawienie **Illustrator makes** (co tworzy agent Illustrator).

- **Pictures** (domyślne): tylko obrazy.
- **Pictures and clips** (obrazy i klipy): agent Illustrator może też zamienić nowy obraz w krótki klip, gdy liczy się ruch, na przykład w scenie akcji, pościgu albo gdy coś się rozbija. Dotyczy to także obrazów, o które narrator prosi za pomocą `[illustrate]`. Ruch opisuje sam, zgodnie z **Video prompting instructions** (instrukcje do promptów wideo) modelu wideo. Obraz pojawia się najpierw, a klip dołącza do tej samej wiadomości, gdy jest gotowy.
- **Clips only** (tylko klipy): wszędzie tam, gdzie agent Illustrator pokazałby obraz, pokazuje krótki klip. Narysowany obraz staje się pierwszą klatką klipu i trafia do galerii, a nie do odpowiedzi. Jeśli klip się nie uda, pokazywany jest obraz.

Klipy korzystają z modelu wideo ustawionego w **Scene Videos** (wideo sceny), a każdy klip to osobne żądanie wideo. Bez działającego modelu wideo agent Illustrator tworzy obrazy nawet przy **Clips only**. Własni agenci tworzący obrazy stosują to samo ustawienie. Zobacz [Generowanie wideo sceny](scene-video.md).

**Video Run Interval** (odstęp między klipami) pojawia się, gdy agent Illustrator tworzy klipy. Określa, ile wiadomości użytkownika i asystenta musi minąć od klipu do następnego, i jest niezależne od **Image Run Interval**.

- Przy **Clips only** każde uruchomienie to klip, **Video Run Interval** ustala, jak często działa agent Illustrator, a **Image Run Interval** jest ukryte.
- Czat bez własnej wartości korzysta z **Video Run Interval** z ekranu **Open Setup** albo z wartości 5.
- **0**: agent nie tworzy klipów samodzielnie, także dla obrazów z `[illustrate]`, które dostają wtedy swój obraz.
- Jedna odpowiedź dostaje najwyżej tyle klipów, ile wskazuje **Videos per reply** (filmy na odpowiedź) w **Settings → Generations → Video Generation** (ustawienia, generowanie, generowanie wideo).
- Nadal możesz animować obraz z galerii. Przy **Clips only** przycisk **Illustrate** przy wiadomości tworzy klip.
- Swipe odpowiedzi, która dostała klip, liczy się jako nowa odpowiedź i może dostać własny klip. Wcześniejszy swipe zachowuje swój klip.

**First frame**, w tej samej sekcji, ustala, od czego zaczyna się każdy klip w trybie Roleplay: klipy agenta Illustrator, komenda `/video` i przycisk **Video** (wideo) w galerii. Do wyboru jest nowy obraz agenta Illustrator, awatar lub sprite wymienionej postaci, obraz z awatarem jako zastępstwem albo brak obrazu. Wiadomości wideo w trybie Conversation korzystają z tego samego ustawienia.

- **Clips only** z awatarem lub bez obrazu: żaden obraz nie jest rysowany. Klip powstaje ze sceny i ruchu opisanych przez agenta Illustrator.
- **Pictures and clips**: obraz nadal się pokazuje, a tylko klip zaczyna się od awatara lub od niczego.
- Bez wybranej pierwszej klatki klip nigdy nie rysuje obrazu tylko dla siebie. **Pictures and clips** animuje obraz, który agent Illustrator właśnie utworzył. **Clips only**, `/video` i **Video** tworzą klip wyłącznie na podstawie sceny.

Klip bez własnego obrazu opisuje wszystkich, których wymienia, łącznie z twoją personą. Pierwsza klatka z awatarem zaczyna się od osoby wymienionej jako pierwsza.

Ponowne uruchomienie agenta Illustrator przyciskiem **Illustrate** przy wiadomości także stosuje się do **Illustrator makes** i **First frame**.

## Wiele postaci w usłudze NovelAI

Gdy agent Illustrator rysuje w usłudze NovelAI modelem V4, V4.5 lub V5, model piszący prompt dodaje jeden opis postaci dla każdej widocznej postaci. Każdy opis zawiera wygląd tej postaci, wyraz twarzy, pozę i przybliżone położenie w kadrze. Marinara sprawdza opisy względem listy postaci w scenie, odrzuca te, których nie da się dopasować, a pozostałe wysyła do usługi NovelAI jako natywne prompty postaci obok głównego promptu. Dzięki temu włosy, ubrania i inne cechy nie mieszają się między postaciami. Obrazy z przycisku **Illustrate** i z komendy `[illustrate]` postaci dostają te same opisy.

V5 przyjmuje do 22 postaci. V4 i V4.5 przyjmują do 6. Gdy widocznych postaci jest więcej, zachowywane są najważniejsze, a reszta staje się bezimiennym tłem.

Stałe cechy pochodzą z pola **Appearance**. Jeśli zawiera ono już tagi Danbooru, są kopiowane bez zmian. Jeśli zawiera zwykły tekst, model piszący prompt zamienia go na tagi. Ubranie pochodzi z bieżącego stroju zapisanego w trackerze postaci, gdy tracker działa, i również jest zamieniane na tagi.

Po włączeniu **Attach Card Appearance** model piszący prompt dostaje też pełną treść pola Appearance każdej karty i persony w czacie, więc długie karty i karty zbiorowe nie są ucinane. Karty zbiorowe opisujące kilka postaci w formacie `[NAME] tags | [NAME] tags` są rozpisywane osobno dla każdej postaci. Model kopiuje stałe cechy do pasującego opisu, traktuje tagi ubrań z karty jako ustawienie domyślne, które tracker lub scena zastępuje, i pomija postacie nieobecne w scenie. Gdy opisy wrócą, Marinara niczego już nie dodaje. Bez opisów, czyli przy jednej postaci, do głównego promptu jak dotąd dopisywany jest zwykły wiersz z wyglądem.

Nie trzeba niczego ustawiać. Opisy pojawiają się tylko dla usługi NovelAI na jej własnym serwerze, więc proxy ani inna usługa nie są tym objęte. Po włączeniu **Expose media prompts before sending** (pokazywanie promptów mediów przed wysłaniem) okno podglądu pokazuje opisy pod głównym promptem, tylko do odczytu. Główny prompt edytuje się jak zwykle.

## Zapisywanie w galeriach i podgląd promptu

W **Settings → Generations → Image Generation** (ustawienia, generowanie, generowanie obrazów) opcja **Automatically save generated images to character galleries** (automatyczne zapisywanie wygenerowanych obrazów w galeriach postaci) jest domyślnie włączona. Wyłącz ją, żeby ilustracje i selfie z czatu nie trafiały do galerii przedstawionych postaci i person. Obrazy nadal pojawiają się w rozmowie i w galerii czatu, a ręczne zapisywanie w galerii nadal działa. Istniejące wpisy pozostają bez zmian. Galerie współdzielą pliki obrazów, więc ta opcja decyduje o przynależności do galerii, a nie o usuwaniu.

Przy nowych ilustracjach z usługi NovelAI inspektor obrazu pokazuje prompt sceny i stylu, a po nim pozytywne opisy postaci, oddzielone przez ` | `. Prompt zapisany w galerii jest taki sam.

Żeby narysować ilustrację jeszcze raz ze zmienionym promptem, bez ponownego generowania odpowiedzi, otwórz ją i użyj przycisku **Regenerate image** (ponowne wygenerowanie obrazu). Zobacz [Ponowne generowanie obrazu](scene-backgrounds.md#regenerating-an-image).

Żeby zilustrować wcześniejszą wiadomość lub zakres wiadomości w trybie Roleplay, użyj `/illustrate range=12` albo `/illustrate range=12-18`. Zobacz [Lista komend slash](../chats/slash-commands.md).

## Powiązane przewodniki

- [Dostawcy generowania obrazów i konfiguracja](image-providers.md)
- [Profile stylu obrazów](style-profiles.md)
- [Tła scen i galeria](scene-backgrounds.md)
- [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
