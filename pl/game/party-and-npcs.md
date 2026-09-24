# Game Mode: drużyna i postacie NPC

Ten przewodnik opisuje osoby, które towarzyszą Ci w kampanii w trybie Game Mode: członków drużyny oraz postacie NPC (postacie niezależne) wprowadzane przez postać Game Master. Dowiesz się, jak otworzyć arkusz postaci członka drużyny, jak go poprawić albo wygenerować ponownie i jak czytać panel **Adventure Journal** (dziennik przygody) razem z etykietami reputacji postaci NPC. Na koniec opisane są dwa tryby pracy postaci Game Master.

Game Mode to jeden z trybów czatu w aplikacji Marinara Engine. Prowadzi jednoosobową grę RPG (fabularną) z postacią Game Master (mistrz gry) sterowaną przez AI, w skrócie GM. Konfigurację i podstawy opisuje przewodnik [Game Mode: pierwsze kroki](getting-started.md).

## Pasek drużyny

Pasek drużyny pokazuje postacie, które podróżują razem z Tobą. Znajdziesz go blisko górnej krawędzi ekranu gry.

Na komputerze jest to pozioma linia małych portretów. Na telefonie pasek zwija się do jednego awatara. Przy więcej niż jednym członku drużyny awatar dostaje plakietkę z liczbą. Dotknij go, żeby otworzyć listę członków drużyny. Jeśli w drużynie jest tylko jedna postać, dotknięcie awatara od razu otwiera jej arkusz postaci.

Oto, co pasek drużyny umożliwia:

1. Kliknij albo dotknij portretu, żeby otworzyć arkusz tej postaci.
2. Najedź na portret (na komputerze), żeby odsłonić mały przycisk **X**.
3. Kliknij przycisk **X**, żeby usunąć tę postać z drużyny.

Usunąć da się każdego towarzysza zwerbowanego przez postać Game Master – i tego z konfiguracji gry, i tego, który dołączył później w trakcie historii. Persona (postać, w którą się wcielasz) to postać prowadzona przez Ciebie. Nie ma przy niej przycisku **X**, więc siebie z drużyny usunąć się nie da.

## Arkusze postaci

Arkusz postaci to podsumowanie jednego członka drużyny na potrzeby gry. To coś innego niż karta postaci. Arkusz pisze postać Game Master na podstawie danej postaci i bieżącej historii.

Arkusz otwiera się kliknięciem portretu na pasku drużyny. Widać w nim te sekcje, które mają jakąkolwiek treść:

- **Attributes** (atrybuty): wartości w stylu gier stołowych, na przykład STR, DEX i CON, każda z modyfikatorem.
- **Stats** (statystyki): paski zasobów, na przykład HP albo MP.
- **Abilities** (zdolności): to, co postać potrafi zrobić.
- **Strengths** (mocne strony) i **Weaknesses** (słabe strony): krótkie listy.
- **Details** (szczegóły): dodatkowe fakty, na przykład Skills, Weapon albo Faction.
- **Inventory** (ekwipunek): przedmioty, które postać ma przy sobie.
- **Traits** (cechy): pozostałe własne pola.

Przy zupełnie nowej postaci może pojawić się napis "Character data will populate as the story progresses.". Arkusz uzupełnia się w trakcie gry.

### Ponowne wygenerowanie arkusza przez AI

Kliknij przycisk **Regenerate Sheet** (ponowne wygenerowanie arkusza), żeby AI napisała arkusz tej postaci od nowa. Korzysta przy tym z opisu postaci i z bieżącego kontekstu gry. Przydaje się to wtedy, gdy historia mocno odmieniła postać.

### Ręczna edycja arkusza

Kliknij przycisk **Edit Sheet** (edycja arkusza), żeby poprawić arkusz samodzielnie. W trybie edycji ustawisz następujące rzeczy:

- **Class** (klasa) i krótki opis w sekcji **Sheet Details**.
- **RPG Attributes**: włącz przełącznik **Enable**, żeby śledzić atrybuty i pule w stylu HP. Przyciskiem **Add Pool** dodasz pasek (nazwa, wartość bieżąca, wartość maksymalna i kolor). Przyciskiem **Add Attribute** dodasz wartość taką jak STR.
- **Abilities**, **Strengths** i **Weaknesses**: przyciskiem **Add** dopiszesz kolejną linię.
- **Details**: przyciskiem **Add Detail** dodasz opisany fakt.

Na koniec kliknij przycisk **Save Sheet** (zapisanie arkusza). Przycisk **Cancel** odrzuca wprowadzone zmiany.

<a id="the-ruleset-sheet"></a>

### Arkusz zestawu zasad

W [grze z zestawem zasad](dice-and-skill-checks.md#games-that-use-a-ruleset) arkusz każdej postaci zaczyna się od **Ruleset sheet** (arkusz zestawu zasad). Jego układ zależy od systemu; bez zestawu tego bloku nie ma.

- **Resources** (zasoby) pokazują stan i maksimum, np. zdrowia, komórek zaklęć lub zasobu klasy. Użyj plusa, minusa lub wpisz liczbę. **Temp** oznacza bufor tymczasowy.
- **Tracks** (liczniki) zmieniają się w swoim zakresie, np. wyczerpanie.
- **Wound tracks** (tory ran) to rząd pól zamiast liczby, dla systemów zaznaczających obrażenia. Każde pole podaje nazwę stopnia zranienia i karę do rzutów. Jeżeli zestaw ma kilka rodzajów obrażeń, najpierw wybierz rodzaj, a potem użyj **Mark** (zaznacz) lub **Clear one** (usuń jedno). Możesz też kliknąć następne puste pole, aby dodać znacznik, albo ostatnie zaznaczone, aby go usunąć; inne pola nie reagują. Cięższy znacznik zajmuje wyższe pole i przesuwa lżejsze niżej. Wiersz pod torem podaje bieżącą karę oraz obrażenia, które się na nim nie zmieściły. Jeżeli zestaw tak określa, kara zmniejsza pulę kości albo sumowany wynik rzutu; karta kości pokazuje zastosowaną wartość.
- **Notes** (notatki) to krótkie pola, np. na koncentrację.
- **Conditions** (stany) włącza się i wyłącza przyciskami.
- Przyciski odpoczynku przywracają to, co określa zestaw. Długi odpoczynek w 5e (SRD 5.1) odnawia zdrowie, komórki zaklęć i połowę kości wytrzymałości, co najmniej jedną.
- Niżej znajduje się podsumowanie cech, wyszkolonych umiejętności i rzutów obronnych oraz wybranych wartości, np. klasy pancerza.

GM zapisuje wydawanie zasobów, obrażenia, leczenie, stany i odpoczynki; silnik sprawdza zmiany. Niedozwolona zmiana, np. zaklęcie bez wolnej komórki, zostaje odrzucona z komunikatem, bez zmiany stanu.

Użycie wpisu katalogu opłaca cały koszt oraz po jednym użyciu każdego dołączonego licznika. Komórka zaklęcia ma poziom wskazany w zestawie; GM może poprosić o wyższy, ale silnik nigdy nie podnosi go sam. Brak dowolnego składnika odrzuca całą operację bez wydatków. Darmowe działanie, np. sztuczka, jest tylko opisywane. Maksima zasobów zależne od poziomu i użycia zależne od cech przeliczają się przy edycji arkusza.

Stan należy do wiadomości: zmiana wariantu odpowiedzi lub regeneracja cofa arkusz do stanu sprzed tury, aby niczego nie wydać dwa razy. **Edit sheet** (edytuj arkusz) zmienia konfigurację, listy, wyszkolenie i premie. Używa tego samego edytora i katalogów co karta, z komórkami tylko do odczytu i przyciskiem **Review** dla nowszych opisów. **Save sheet** (zapisz arkusz) zmienia wyłącznie kopię tej gry. Osobny **Edit Sheet** nadal edytuje ogólny arkusz, nie arkusz zestawu. Brak pakietu lub zbyt stara wersja wyświetla ostrzeżenie i blokuje rzuty do czasu przywrócenia pakietu.

## Werbowanie i usuwanie członków drużyny

O składzie drużyny decyduje postać Game Master w miarę rozwoju historii. Nie ma osobnego przycisku dodawania towarzysza. Zamiast tego postać GM dodaje i usuwa członków drużyny przez samą narrację, zgodnie z tym, co dzieje się w scenie.

Żeby pożegnać towarzysza samodzielnie, użyj przycisku **X** na pasku drużyny, jak opisano wyżej. Własnej persony w ten sposób nie usuniesz.

## Panel Adventure Journal

Panel **Adventure Journal** to bieżąca kronika kampanii. Powstaje z zapisanych zdarzeń gry, a nie z tekstu pisanego przez AI, więc trzyma się faktów.

Kliknij przycisk **Session** (sesja) na górnym pasku narzędzi, a potem wybierz zakładkę **Journal**. Otworzy się panel dziennika z takimi zakładkami:

- **Timeline** (oś czasu): lista tego, co się wydarzyło – odkryte lokacje, spotkania z postaciami NPC, wyniki walk, zadania i zdarzenia dotyczące przedmiotów.
- **NPCs**: napotkane postacie NPC z portretami i etykietami reputacji (opis niżej).
- **Map** (mapa): zwykła lista nazw odkrytych lokacji.
- **Items** (przedmioty): rejestr przedmiotów zdobytych, użytych, zgubionych i usuniętych.
- **Library** (biblioteka): notatki i księgi ze świata gry pokazane przez postać Game Master, zapisane po to, żeby dało się do nich wrócić.
- **Notes** (notatki): twój własny notatnik z dowolnym tekstem.

### Notatki gracza

Zakładka **Notes** to osobisty notatnik. Po lewej wpisuje się tekst, po prawej widać sformatowany podgląd. Podpis nad notatnikiem ostrzega, że notatki widzą postać Game Master i członkowie drużyny. Wszystko, co tu trafi, może więc wpłynąć na historię.

Notatki zapisują się same chwilę po przerwie w pisaniu. Mała etykieta pokazuje **Saving...** w trakcie zapisu i **Saved** po jego zakończeniu.

## Etykiety reputacji postaci NPC

Zakładka **NPCs** panelu **Adventure Journal** śledzi, co każda postać NPC do Ciebie czuje. Przy każdej wypisanej postaci NPC widać portret, imię i etykietę reputacji.

Etykieta reputacji zmienia się wraz z Twoimi poczynaniami w historii. Przyjmuje jedną z siedmiu wartości, od najlepszej do najgorszej:

| Etykieta | Znaczenie |
|---|---|
| **Devoted** | Głęboko Ci oddana |
| **Allied** | Silny sojusznik |
| **Friendly** | Nastawiona pozytywnie |
| **Neutral** | Bez wyraźnych uczuć |
| **Unfriendly** | Nastawiona negatywnie |
| **Hostile** | Zwrócona przeciwko Tobie |
| **Enemy** | Czynnie wroga |

Etykieta pojawia się dopiero wtedy, gdy reputacja postaci NPC odsunie się od wartości początkowej. Zupełnie nowa postać NPC z niezmienioną reputacją nie ma jeszcze żadnej etykiety.

Postać NPC trafia do tej zakładki wtedy, gdy postać Game Master ją opisze, nada jej reputację albo zapisze notatkę o relacji. Każdy wiersz postaci NPC daje też takie możliwości:

- Wgranie portretu postaci NPC albo jego podmiana.
- Wygenerowanie portretu przez AI, jeśli generowanie obrazów jest włączone.
- Usunięcie postaci NPC z dziennika.

## Tryby pracy postaci Game Master

To, kto prowadzi grę, wybiera się w kreatorze konfiguracji, w kroku **Party** (drużyna), w sekcji **Game Master Mode**. Do wyboru są dwie opcje:

- **Standalone GM**: opcja domyślna. Marinara buduje mistrza gry za Ciebie. Kreator opisuje go słowami "A snarky narrator running the show". Karta postaci nie jest potrzebna.
- **Character GM**: rolę postaci Game Master przejmuje jedna z twoich własnych kart postaci. Aplikacja poleca modelowi wcielić się w tę postać i jednocześnie dalej prowadzić grę. Wybierz to wtedy, gdy narracja ma mieć konkretny głos.

Przy pierwszej grze najlepiej sprawdzi się **Standalone GM**. Tryb ustawia się w momencie tworzenia gry. Pełny opis konfiguracji krok po kroku znajdziesz w przewodniku [Game Mode: pierwsze kroki](getting-started.md).

## Powiązane przewodniki

- [Game Mode: pierwsze kroki](getting-started.md)
- [Game Mode: sesje i zapisy gry](sessions-and-saves.md)
