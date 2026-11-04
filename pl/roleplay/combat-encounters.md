# Starcia bojowe (Roleplay)

Starcie bojowe dodaje do sceny w trybie Roleplay ekran walki turowej z paskami zdrowia, listami wrogów i drużyny oraz dziennikiem walki. To funkcja opcjonalna. Czat bez niej działa tak jak wcześniej. Tryb Game Mode ma własny, osobny system walki: zobacz [Game Mode: walka](../game/combat.md).

## Włącz walkę

Agent to pomocnik, który działa obok odpowiedzi. Agent **Combat** dodaje funkcję walki. Domyślnie jest wyłączony, więc włączasz go osobno w każdym czacie.

1. Otwórz czat. Otwórz **Chat Settings** (ustawienia czatu) przyciskiem z suwakami w czacie.
2. Przejdź do sekcji **Agents**.
3. Włącz przełącznik **Enable Agents**, jeśli jest wyłączony.
4. Dodaj agenta **Combat** z list pod przełącznikiem.

Nad polem wiadomości pojawia się teraz przycisk **Encounter** (skrzyżowane miecze). Jego podpowiedź brzmi **Start Combat Encounter**.

Jeśli to nie zadziałało: brak przycisku oznacza, że agent **Combat** nie działa w tym czacie. Zasady działania agentów opisuje przewodnik [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md).

## Rozpocznij starcie

1. Kliknij **Encounter**. Otworzy się okno **Configure Combat Narrative**. Ustala ono styl, jakim pisze AI.
2. Wybierz styl dla grupy **Combat Narration** (w trakcie walki) i dla grupy **Summary Narration** (podsumowanie zapisywane w czacie po zakończeniu walki). Obie grupy mają te same cztery ustawienia, wymienione niżej. Ustawienia domyślne działają, więc możesz od razu kliknąć **Begin Combat**.
3. Opcjonalnie: wybierz **Spellbook** (księga zaklęć). Spellbook to lorebook (zapisany zbiór faktów o świecie), który wymienia zaklęcia i zdolności dostępne w walce. Jeśli go nie używasz, zostaw wartość **None** (brak).
4. Kliknij **Begin Combat**. Kliknij **Cancel**, aby zamknąć okno bez walki.

Gdy AI tworzy wrogów, twoją drużynę oraz ich ataki i przedmioty, widzisz komunikat "Initializing combat encounter...". Może to potrwać kilka sekund.

| Ustawienie stylu | Opcje |
| --- | --- |
| Czas | **Present Tense**, **Past Tense** |
| Osoba | **First Person**, **Second Person**, **Third Person** |
| Narracja | **Omniscient**: narrator wie wszystko. **Limited**: narrator wie to, co wie jedna postać. |
| Punkt widzenia | Pole tekstowe na to, czyimi oczami opowiadana jest scena. Zostaw je puste, aby narrator był neutralny. |

## Rozegraj swoją turę

Ekran **Combat Encounter** ma cztery części:

- **Enemies**: karty z paskiem zdrowia i efektami statusu.
- **Party**: twoja strona. Twoja własna postać jest oznaczona jako **(You)**.
- **Combat Log**: zapis każdej tury.
- **Your Actions**: twoje przyciski.

W swojej turze wybierz atak z listy **Attacks**, użyj przedmiotu z listy **Items** albo wpisz dowolną akcję w polu **Custom Action** i wyślij ją, na przykład "Sypię strażnikowi piaskiem w oczy".

Gdy akcja wymaga celu, otwiera się okno **Select Target**. Wskaż jednego wroga lub sojusznika albo wybierz **All Enemies** przy ataku obszarowym. Akcje wyłącznie obszarowe pomijają ten krok.

Gdy AI rozpatruje turę, widzisz komunikat "Processing action...", a twoje przyciski są zablokowane. Odblokowują się po zakończeniu tury.

Jeśli to nie zadziałało: gdy AI zwróci dane, których aplikacja nie potrafi odczytać, pojawia się ekran **Combat Error**. Kliknij **Close Encounter**, aby bezpiecznie wyjść z walki, a potem rozpocznij nowe starcie.

## Zakończ starcie

- Przycisk **Conclude** na górnym pasku kończy walkę wcześniej. Okno prosi o potwierdzenie, a potem aplikacja zapisuje w czacie podsumowanie walki.
- Przycisk **X** na górnym pasku zamyka i porzuca walkę po potwierdzeniu w oknie o nazwie **End Combat**. Podsumowanie nie powstaje.
- Gdy jedna ze stron wygra, baner pokazuje **VICTORY**, **DEFEAT**, **FLED** albo **INTERRUPTED**. Aplikacja zapisuje w czacie podsumowanie w stylu wybranym w grupie **Summary Narration**. Gdy jest gotowe, kliknij **Close Combat Window**.

Jeśli podsumowanie się nie uda, przycisk nosi nazwę **Close Anyway**. Kliknij go, aby wrócić do sceny bez podsumowania.

## Czym to się różni od walki w trybie Game Mode

- Starcie w trybie Roleplay rozpoczynasz samodzielnie przyciskiem **Encounter**. W trybie Game Mode walkę zaczyna Game Master (mistrz gry), kiedy wymaga tego fabuła.
- Walka w trybie Roleplay wymaga agenta **Combat**. Walka w trybie Game Mode go nie wymaga.
- Oba systemy używają różnych ekranów walki.

## Powiązane przewodniki

- [Tryb Roleplay: pierwsze kroki](getting-started.md)
- [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md)
- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)
- [Game Mode: walka](../game/combat.md)
