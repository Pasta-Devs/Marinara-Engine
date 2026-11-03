# Profile w trybie Conversation Mode (nazwa wyświetlana, About Me, zachowanie)

Każda postać i każda persona ma mały profil w stylu komunikatora dla trybu Conversation: nazwę wyświetlaną, biogram "o mnie" i instrukcję zachowania. Te pola nigdy nie są używane w trybach Roleplay i Game Mode.

To nie jest profil ustawień (zapisany zestaw opcji czatu, zobacz [Profile ustawień](../chats/settings-profiles.md)). Jeśli dopiero poznajesz ten tryb, przeczytaj najpierw [Tryb Conversation: pierwsze kroki](getting-started.md). Persona to karta postaci, która reprezentuje ciebie.

## Gdzie są te pola

Pola znajdują się w zakładce o nazwie **Convo**.

1. Otwórz postać w panelu **Character Editor** (edytor postaci) albo personę w panelu **Persona Editor** (edytor persony). Aby tam trafić, otwórz panel **Characters** z paska bocznego albo panel **Personas** za pomocą ikony osoby na górnym pasku prawego paska bocznego, a potem kliknij kartę (zobacz [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md) i [Persony użytkownika: tworzenie i edycja](../characters/personas.md)).
2. Kliknij zakładkę **Convo**.

Zakładka zawiera **Convo Display Name**, **About Me** i **Convo Behavior**. Przy postaci ma też **Weekly schedule** (z przyciskiem **Edit schedule** lub **Create schedule**, zobacz [harmonogramy](schedules.md)) oraz **Image generation instructions**, czyli opcjonalne wskazówki dla selfie tej postaci (zobacz [Selfie](selfies.md)).

## Ustaw nazwę wyświetlaną

**Convo Display Name** (nazwa wyświetlana w trybie Conversation) to nazwa pokazywana w czatach Conversation. Zostaw pole puste, aby użyć nazwy z karty. Istniejące wiadomości aktualizują się od razu.

Postacie mają też opcję **Declare this name on the card in the prompt**. Gdy jest włączona, aplikacja dodaje do tekstu karty w prompcie (tekście, który aplikacja wysyła do modelu) linię w rodzaju "Conversation display name: X", żeby model wiedział, która karta używa której nazwy. Najpierw trzeba ustawić nazwę wyświetlaną.

## Napisz About Me

**About Me** (o mnie) to krótki biogram: linijka lub dwie, emoji, żart albo nic. Aplikacja dodaje **About Me** każdej obecnej postaci i persony do promptu w każdej turze, żeby model wiedział, jak każda z nich się przedstawia. Nie musisz nic robić.

Aby go wypełnić:

- Wpisz go samodzielnie. Przycisk emoji na pasku narzędzi wstawia emoji. Przycisk **Revert** (cofnij) przywraca tekst sprzed bieżącej edycji.
- Przy zapisanej postaci kliknij przycisk różdżki (**Generate About Me from this card**).
- Poproś asystentkę **Professor Mari** na ekranie głównym, na przykład `Write Luna's About Me as a cryptic one-line bio.` Professor Mari czyta zapisany profil, pisze biogram głosem tej postaci lub persony i go zapisuje. Jej zmianę możesz zachować albo cofnąć w zwykłym przeglądzie zmian.

Jeśli to nie zadziałało: na karcie, która nie jest jeszcze zapisana, brakuje przycisku różdżki. Najpierw zapisz kartę.

## Ustaw Convo Behavior

**Convo Behavior** (zachowanie w trybie Conversation) to instrukcja, jak postać lub persona zachowuje się w trybie Conversation, na przykład: pisz krótkie odpowiedzi małymi literami i pisz jak prawdziwa osoba. Instrukcje post-history to tekst promptu umieszczany po niedawnej historii czatu. Zostaw ustawienie domyślne, jeśli nie piszesz własnych promptów. Użyj listy **Insertion** (miejsce wstawienia), aby wybrać, gdzie instrukcja trafia w prompcie:

| Opcja | Gdzie trafia instrukcja |
| --- | --- |
| **Constant — after the card** (domyślnie) | Zawsze, tuż po tekście karty. |
| **Constant — before the card** | Zawsze, tuż przed tekstem karty. |
| **Append to post-history** | Na końcu instrukcji post-history. |
| **Prepend to post-history** | Na początku instrukcji post-history. |
| **Replace post-history** | W miejsce instrukcji post-history. |
| **Only where {{convo_behavior}} is placed** | Tylko tam, gdzie we własnym prompcie umieścisz makro. |

## Zmiany About Me dla jednego czatu

**About Me** z karty jest domyślne wszędzie. Możesz ustawić inny biogram tylko dla jednego czatu.

1. W czacie Conversation kliknij awatar lub imię postaci albo persony. Obok otwiera się karta profilu (na telefonie od dołu).
2. Przeczytaj kartę. Pokazuje awatar, imię i bieżące **About Me**. Plakietka mówi **Default** albo **Chat-specific**. Postacie pokazują też **Online**, **Away**, **Busy** lub **Offline**.
3. Kliknij **Edit** (edytuj).
4. Wpisz biogram dla tego czatu. Dostępny jest wybór emoji z zakładką **Custom emojis**.
5. Kliknij **Save** (zapisz). Zobaczysz komunikat "Chat-specific about me saved".

Przycisk **Cancel** zamyka tryb edycji bez zapisu. Przycisk **Revert** cofa niezapisane zmiany. Przycisk **Clear** usuwa istniejącą zmianę i wraca do wartości domyślnej z karty. Zapisanie pustego biogramu też ją usuwa.

## Pozwól postaci zmieniać własne About Me

To opcja zaawansowana. Narzędzie o nazwie `update_about_me` pozwala postaci edytować własny biogram w trakcie czatu. Jest domyślnie wyłączone. Aby go użyć, otwórz **Chat Settings → Function Calling**, włącz **Enable Tool Use**, a potem dodaj narzędzie `update_about_me`.

Postać wybiera jedną z dwóch możliwości:

- Public zmienia prawdziwy biogram widoczny w każdym czacie. Najpierw ją zatwierdzasz.
- Chat zmienia biogram prywatny dla bieżącego czatu.

## Makra do własnych promptów

Makra nie są potrzebne, żeby profile trafiały do modelu. Używaj ich tylko po to, aby umieścić wartość w dokładnie wybranym miejscu własnego promptu. Każde z nich jest puste poza trybem Conversation. Zobacz [Makra promptów](../prompts/macros.md).

| Makro | Wartość |
| --- | --- |
| `{{convo_display}}` | Nazwa wyświetlana odpowiadającej postaci. |
| `{{char_about}}` | Obowiązujące **About Me** postaci. |
| `{{persona_about}}` | Obowiązujące **About Me** persony. |
| `{{convo_behavior}}` | **Convo Behavior** postaci. |

## Powiązane przewodniki

- [Tryb Conversation: pierwsze kroki](getting-started.md)
- [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md)
- [Persony użytkownika: tworzenie i edycja](../characters/personas.md)
- [Makra promptów](../prompts/macros.md)
