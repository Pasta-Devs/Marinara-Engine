# Starcia bojowe (Roleplay)

Ten przewodnik wyjaśnia starcia bojowe w trybie Roleplay. Zobaczysz, jak włączyć agenta **Combat**, rozpocząć walkę i rozegrać ją w oknie starcia. Dowiesz się też, czym ta funkcja różni się od walki w trybie Game Mode.

Starcia bojowe to opcjonalna funkcja trybu Roleplay. Dodają do sceny osobny ekran walki turowej z paskami zdrowia, listami wrogów i drużyny oraz dziennikiem walki. Bez włączenia tej funkcji czaty w trybie Roleplay działają dokładnie tak jak wcześniej.

## Włączanie agenta **Combat**

Agent to pomocnik, który uruchamia się automatycznie podczas generowania wiadomości. Agent **Combat** dodaje funkcję walki do czatu w trybie Roleplay. Domyślnie jest wyłączony, więc trzeba go włączyć osobno w każdym czacie.

1. Otwórz czat, do którego chcesz dodać walkę.
2. Otwórz **Chat Settings** (ustawienia czatu) przyciskiem w czacie. Domyślnie jest w prawym górnym rogu.
3. Przejdź do sekcji **Agents**.
4. Włącz przełącznik **Enable Agents**, jeśli jeszcze nie jest włączony.
5. Dodaj do czatu agenta **Combat**.

Nad polem wiadomości, w rzędzie akcji, powinien teraz pojawić się przycisk **Encounter** z ikoną skrzyżowanych mieczy. Jego podpowiedź brzmi **Start Combat Encounter**. Brak tego przycisku oznacza, że agent **Combat** nie działa w tym czacie.

Pełny opis panelu **Agents** i zasad działania agentów znajdziesz w przewodniku [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md).

## Rozpoczynanie starcia

Kliknij przycisk **Encounter**, aby otworzyć okno konfiguracji o nazwie **Configure Combat Narrative**. Decyduje ono o stylu, jakim AI pisze w trakcie walki i po niej.

Okno konfiguracji ma dwie grupy ustawień stylu:

- **Combat Narration**: styl pisania używany w trakcie walki.
- **Summary Narration**: styl podsumowania, które trafia do czatu po zakończeniu walki.

Każda grupa ma te same cztery ustawienia:

- Czas: **Present Tense** albo **Past Tense**.
- Osoba: **First Person**, **Second Person** albo **Third Person**.
- Narracja: **Omniscient** (narrator wie wszystko) albo **Limited** (narrator wie tylko to, co wie jedna postać).
- Pole tekstowe punktu widzenia: wpisz, czyimi oczami opowiadana jest scena. Puste pole zostawia neutralny głos narratora.

Pod grupami stylu jest opcjonalna lista rozwijana **Spellbook**. Spellbook to specjalny lorebook (zapisany zbiór wpisów z informacjami o świecie), który wymienia zaklęcia i zdolności dostępne w walce. Podłącz taki lorebook, żeby AI wiedziało, co potrafią rzucić twoje postacie. Jeśli nie używasz spellbooków, zostaw wartość **None**.

Na koniec kliknij przycisk **Begin Combat**. Przycisk **Cancel** zamyka okno konfiguracji bez rozpoczynania walki.

Po kliknięciu przycisku **Begin Combat** aplikacja pokazuje komunikat "Initializing combat encounter...", a AI buduje w tym czasie walkę. Tworzy wrogów, twoją drużynę, ich ataki oraz przedmioty. Może to potrwać kilka sekund.

## Przebieg starcia (okno starcia)

Pełny ekran walki (okno starcia) nosi tytuł **Combat Encounter**. Składa się z takich części:

- **Enemies**: siatka kart wrogów. Na każdej karcie widać pasek zdrowia i ewentualne efekty statusu.
- **Party**: twoja strona walki. Twoja własna postać jest oznaczona jako **(You)**.
- **Combat Log**: bieżący zapis tego, co dzieje się w każdej turze.
- **Your Actions**: przyciski, których używasz w swojej turze.

W sekcji **Your Actions** możesz:

- Wybrać jeden z ataków z listy **Attacks**.
- Użyć jednego z przedmiotów z listy **Items**.
- Wpisać dowolną akcję w polu **Custom Action** i wysłać ją. Przydaje się to do wszystkiego, czego nie obejmują przyciski, na przykład "Sypię strażnikowi piaskiem w oczy".

Kiedy atak albo przedmiot wymaga celu, otwiera się okno **Select Target**. Wskaż pojedynczego wroga lub sojusznika albo wybierz **All Enemies** przy ataku obszarowym, który trafia wszystkich wrogów naraz. Niektóre akcje działają wyłącznie obszarowo i pomijają wybór pojedynczego celu.

Gdy AI rozpatruje turę, na ekranie widać komunikat "Processing action...", a przyciski są zablokowane. Odblokowują się po zakończeniu tury.

Jeśli AI zwróci dane, których aplikacja nie potrafi odczytać, zamiast zepsutego ekranu pojawia się komunikat **Combat Error**. Kliknij na nim przycisk **Close Encounter**, aby bezpiecznie wyjść z walki.

## Kończenie starcia

Walkę można przerwać na dwa sposoby, a poza tym kończy się ona sama, gdy jedna ze stron wygra.

- Przycisk **Conclude** na górnym pasku kończy walkę wcześniej. Najpierw pojawia się prośba o potwierdzenie. Aplikacja zapisuje potem w czacie podsumowanie walki.
- Przycisk **X** na górnym pasku zamyka walkę i porzuca ją. Najpierw pojawia się okno potwierdzenia o nazwie **End Combat**. Podsumowanie w tym przypadku nie powstaje.

Gdy walka kończy się naturalnie, pojawia się baner z wynikiem: **VICTORY**, **DEFEAT**, **FLED** albo **INTERRUPTED**. Aplikacja zapisuje wtedy w czacie wiadomość z podsumowaniem walki, w stylu wybranym w grupie **Summary Narration**. Gdy podsumowanie jest gotowe, kliknij przycisk **Close Combat Window**, aby wrócić do sceny.

Jeśli podsumowanie się nie wygeneruje, przycisk nosi nazwę **Close Anyway**. Kliknij go, żeby wrócić do sceny bez podsumowania.

## Czym to się różni od walki w trybie Game Mode

Starcia bojowe to lżejsza, osobna warstwa walki dla trybu Roleplay. Tryb Game Mode ma własny, wbudowany system walki.

Najważniejsze różnice:

- Starcie w trybie Roleplay rozpoczynasz samodzielnie przyciskiem **Encounter**. W trybie Game Mode walkę zaczyna prowadzona przez AI postać Game Master (mistrz gry), kiedy wymaga tego fabuła.
- Walka w trybie Roleplay wymaga włączonego agenta **Combat**. Walka w trybie Game Mode nie korzysta z agenta **Combat** i działa bez niego.
- Oba systemy używają różnych ekranów walki i nie są ze sobą powiązane.

System walki w trybie Game Mode opisuje przewodnik [Game Mode: walka](../game/combat.md).

## Powiązane przewodniki

- [Tryb Roleplay: pierwsze kroki](getting-started.md)
- [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md)
- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)
- [Game Mode: walka](../game/combat.md)
