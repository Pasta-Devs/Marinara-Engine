# Sceny: odgałęzienie roleplayu

Ten przewodnik wyjaśnia, czym są sceny w aplikacji Marinara Engine. Scena to krótki, samodzielny roleplay, który odgałęzia się od czatu Conversation. Dowiesz się, jak scenę rozpocząć, jak ją poprowadzić oraz jak ją zakończyć, odrzucić, rozgałęzić albo przekształcić.

## Czym jest scena

Scena to poboczny roleplay, który wyrasta z czatu Conversation. Czat Conversation to tryb wiadomości prywatnych, przypominający komunikator. Dzięki scenie razem z postacią wychodzisz z tego czatu w jeden skupiony moment roleplayu. Taki moment to na przykład retrospekcja, randka albo walka. Główny wątek pozostaje nienaruszony.

Każda scena jest osobnym czatem roleplay. Ma własne tło, własne postacie na obszarze sceny i własną wiadomość otwierającą. Na starcie sceny sytuację wyjściową pisze postać albo sama historia.

Scena z założenia jest tymczasowa. Dopóki jest otwarta, w pierwotnym czacie Conversation widnieje mała karta z napisem **A scene is in progress** (trwa scena). Na tej karcie znajduje się przycisk **Go to Scene** (przejście do sceny), który przenosi do aktywnej sceny.

Na koniec wybierasz, co stanie się ze sceną. Można zapisać podsumowanie z powrotem w czacie Conversation, wyrzucić scenę albo zachować ją jako trwały, samodzielny roleplay. Każdą z tych możliwości opisujemy niżej.

## Rozpoczęcie sceny

Scenę rozpoczyna się wewnątrz czatu Conversation komendą `/scene`. Komenda ma też skrót `/rp`, który działa tak samo.

Wykonaj kolejno te kroki:

1. Otwórz czat Conversation, w którym jest już trochę wiadomości.
2. W polu wiadomości wpisz komendę sceny. Możesz dopisać po niej krótki opis tego, co ma się wydarzyć.

```
/scene we sneak into the old library at midnight
```

3. Naciśnij Enter. Otwiera się okno **Scene Prompt Setup** (konfiguracja promptu sceny).
4. Wybierz **Prompt preset** (preset promptu) dla nowej sceny lub pozostaw **None** (brak). Aplikacja Marinara Engine zapamiętuje ten wybór dla kolejnej sceny. Instrukcje samej sceny nadal obowiązują obok wybranego presetu.
5. W sekcji **POV** wybierz sposób narracji: **First Person**, **Second Person** albo **Third Person**.
6. W sekcji **Tense** wybierz **Past**, **Present** albo **Future**.
7. W polu **Extra instructions** (dodatkowe wskazówki) możesz wpisać uwagi, które pokierują sceną.
8. Kliknij przycisk **Plan Scene**.

Marinara planuje scenę i otwiera ją jako nowy czat roleplay. Nowa scena pojawia się na liście czatów i otwiera się automatycznie, a wiadomość otwierająca opisuje sytuację. Jeśli w oknie konfiguracji zmienisz zdanie, kliknij przycisk **Cancel** – wtedy żadna scena nie powstanie.

Scenę da się też rozpocząć bez opisu. Wpisz samą komendę, jeśli w czacie Conversation jest już dość historii, na której można się oprzeć.

```
/scene
```

Jeśli w czacie Conversation nie ma jeszcze żadnych wiadomości, Marinara prosi o dopisanie opisu albo o wcześniejszą rozmowę, bo bez tego nie zaplanuje sceny.

O rozpoczęcie sceny może poprosić także postać. Wtedy otwiera się to samo okno **Scene Prompt Setup**, z komunikatem w rodzaju "[Character] wants to start a scene." Wybierz **Prompt preset**, **POV** i **Tense**, a potem kliknij przycisk **Plan Scene** tak samo jak wcześniej, albo kliknij przycisk **Cancel**, żeby odmówić.

## Pasek sceny: End Scene, Discard, Convert i Back to conversation

W aktywnej scenie tuż nad polem wiadomości znajduje się pasek. To on zawiera kontrolki decydujące o losie sceny. Zestaw widocznych przycisków zależy od tego, czy scena ma powiązany czat Conversation.

- Przycisk **Back to conversation** (powrót do czatu Conversation) przenosi z powrotem do czatu Conversation, z którego wyszła scena. Scena zostaje otwarta i aktywna, więc można do niej wrócić później. Ten przycisk pojawia się tylko wtedy, gdy scena ma czat źródłowy.
- Przycisk **End Scene** (zakończenie sceny) kończy scenę i zapisuje podsumowanie. Po kliknięciu pasek pyta **End and save summary?** i pokazuje przyciski **Yes** oraz **No**. Kliknij przycisk **Yes**, żeby potwierdzić. W trakcie pracy przycisk pokazuje stan **Saving...**. Marinara zapisuje krótkie podsumowanie sceny w czacie źródłowym jako wspomnienie, a potem wraca do miejsca, w którym ten czat się urwał.
- Przycisk **Discard** (odrzucenie) wyrzuca scenę i nic nie zapisuje. Po kliknięciu pasek pyta **Discard scene?** i pokazuje przyciski **Yes** oraz **No**. Kliknij przycisk **Yes**, żeby usunąć scenę i wrócić do czatu Conversation. Nic nie trafia z powrotem do czatu.
- Przycisk **Convert** (przekształcenie) zamienia scenę w samodzielny czat roleplay. Opisujemy go w osobnej sekcji niżej, bo zmienia scenę na stałe.

Zanim klikniesz przycisk **End Scene** albo **Discard**, zastanów się spokojnie, bo oba usuwają scenę z czatu Conversation. **End Scene** zachowuje wspomnienie o tym, co się wydarzyło. **Discard** nie zachowuje nic.

## Klonowanie sceny od wybranej wiadomości

W czacie sceny przy każdej wiadomości znajduje się mały przycisk akcji z podpowiedzią **Clone from here** (klonowanie od tego miejsca). Dzięki niemu treść sceny trafia do zupełnie nowego czatu roleplay, skopiowana aż do tej wiadomości włącznie.

Jak z tego skorzystać:

1. Najedź kursorem na wiadomość, od której chcesz utworzyć gałąź.
2. Kliknij akcję **Clone from here**.

Marinara tworzy ze sceny nowy, samodzielny roleplay i kopiuje do niego wiadomości do wskazanego miejsca. Pierwotna scena zostaje otwarta i aktywna, więc to bezpieczny sposób na sprawdzenie innej ścieżki. Pojawia się potwierdzenie, że scena została sklonowana jako roleplay, a nowy czat otwiera się od razu.

Klonowanie zachowuje pierwotną scenę. Przekształcanie, opisane dalej, już nie.

## Przekształcenie sceny w samodzielny roleplay

Przycisk **Convert** na pasku sceny odłącza scenę i robi z niej trwały, samodzielny czat roleplay. Po kliknięciu przycisku **Convert** otwiera się okno potwierdzenia zatytułowane **Convert this scene into a standalone roleplay?**

Okno wyjaśnia, co się wydarzy. Marinara tworzy z bieżącej sceny nowy czat roleplay i odłącza pierwotną scenę od jej czatu Conversation. Do pierwotnego czatu nie trafia ani podsumowanie sceny, ani wspomnienie postaci. Kliknij przycisk **Convert**, żeby to zrobić, albo przycisk **Cancel**, żeby zostawić wszystko bez zmian.

Sięgnij po przycisk **Convert**, kiedy scena rozrosła się w historię, którą chcesz zachować i ciągnąć dalej jako zwykły roleplay. Wybierz akcję **Clone from here**, jeśli chcesz mieć kopię, a jednocześnie zostawić pierwotną scenę na miejscu.

Dla jasności, obie ścieżki rozgałęzienia różnią się tak: **Clone from here** tworzy gałąź sceny, a oryginał pozostaje aktywny. **Convert** zamienia gałąź sceny w samodzielny roleplay i usuwa oryginał z czatu Conversation.

## Dlaczego sceny nie dziedziczą kontekstu połączonego czatu

Czat Conversation można połączyć z roleplayem tak, żeby kontekst przepływał między nimi. Sceny celowo działają inaczej. Scena jest samodzielna.

Scena nie pobiera automatycznie kontekstu wymiany zdań z połączonego czatu Conversation, nawet jeśli czat nadrzędny to robi. Połączony czat Conversation potrafi po cichu przekazywać krótkie wskazówki do powiązanego roleplayu, żeby popchnąć jego historię, ale scena takie wskazówki ignoruje. Dzięki temu scena skupia się na własnym momencie, zamiast wciągać w siebie całą rozmowę.

Właśnie dlatego scena czyta się czysto, jak osobna, mała historia. Jeśli zależy ci na stałym, dwustronnym połączeniu między czatem Conversation a roleplayem, użyj połączonego czatu zamiast sceny. Opisuje tę funkcję przewodnik o połączonych czatach, do którego link znajduje się niżej.

## Powiązane przewodniki

- [Tryb Roleplay: pierwsze kroki](getting-started.md)
- [Gałęzie czatu](../chats/branches.md)
- [Łączenie czatu Conversation z czatem Roleplay lub Game](../chats/connected-chats.md)
