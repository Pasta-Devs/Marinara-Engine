# Sterowane generowanie i Impersonate

Z tego przewodnika dowiesz się, jak kierować czatem w aplikacji Marinara Engine na dwa sposoby. Sterowane generowanie podpowiada AI, w którą stronę ma pójść, i nie zostawia przy tym widocznej wiadomości. Funkcja Impersonate każe AI napisać za ciebie twoją własną odpowiedź. Opisane jest tu też menu Quick replies (szybkie odpowiedzi), które stawia obie akcje obok przycisku **Send**.

## Sterowane generowanie

Dzięki sterowanemu generowaniu możesz wskazać AI, dokąd ma poprowadzić kolejną odpowiedź. Twoja wskazówka jest poza rolą. Nadaje odpowiedzi kierunek, ale nie pojawia się jako zwykła wiadomość na czacie.

### Sterowanie odpowiedzią komendą /guided

Podstawowy sposób na pokierowanie odpowiedzią to komenda slash `/guided`.

1. Wpisz w polu wiadomości `/guided`, a po nim swoją wskazówkę.
2. Naciśnij Enter albo kliknij przycisk **Send**.
3. AI generuje kolejną odpowiedź, prowadząc ją we wskazanym kierunku.

Na przykład taka wskazówka popycha następną odpowiedź w stronę wyznania:

```
/guided make him admit he is lying
```

Komenda ma krótkie odpowiedniki. Zamiast `/guided` możesz wpisać `/narrator`, `/narrate` albo `/nar`.

Na czacie grupowym wskazówkę da się skierować do jednej postaci. Wpisz `/guided respond for <character> <direction>`. W miejsce `<character>` wstaw nazwę postaci, a w miejsce `<direction>` swoją wskazówkę. Na przykład:

```
/guided respond for Alice make her admit she is lying
```

### Sterowanie przy ponownym generowaniu

Odpowiedzią można też pokierować w trakcie ponownego generowania. Marinara wykorzystuje wtedy tekst wpisany w polu wiadomości jako jednorazową wskazówkę.

1. Otwórz **Settings** (Ustawienia), potem **Advanced**, potem **Message Tools**.
2. Włącz **Guide swipes/regens with chat input**. To ustawienie jest domyślnie wyłączone.
3. Wróć do czatu i wpisz wskazówkę w polu wiadomości, ale jej nie wysyłaj.
4. Kliknij przycisk **Regenerate** przy wiadomości od AI.

Kiedy ustawienie jest włączone, a w polu jest tekst, podpowiedź przycisku **Regenerate** zmienia się na **Regenerate (guided)**. AI tworzy nową wersję odpowiedzi, traktując wpisany tekst jako wskazówkę.

### Odczytywanie zapisanych wskazówek w oknie Stored guidance

Kiedy odpowiedź powstała ze wskazówką, Marinara zapisuje tę wskazówkę do późniejszego wglądu. Przy wiadomości pojawia się akcja **Stored guidance** (zapisana wskazówka) z ikoną zwoju.

1. Kliknij ikonę **Stored guidance** przy wiadomości od AI.
2. Otwiera się okno **Stored guidance** z wskazówką, która dała tę odpowiedź.

Okno opisuje wskazówkę zależnie od tego, skąd pochodzi:

- **/guided**: wskazówka pochodzi z komendy `/guided`.
- **Guided regenerate**: wskazówka pochodzi ze sterowanego kliknięcia przycisku **Regenerate**.
- **Game start**: wskazówka pochodzi z konfiguracji trybu Game Mode.

Przy wskazówkach z komendy `/guided` i ze sterowanego ponownego generowania przycisk **Copy /guided** kopiuje wskazówkę z powrotem jako gotową komendę `/guided`. Można ją wkleić na innym czacie i użyć tego samego kierunku jeszcze raz.

## Impersonate

Funkcja Impersonate każe AI napisać za ciebie kolejną wiadomość, głosem twojej persony. Persona to postać, w którą się wcielasz, wpisana do czatu jako `{{user}}`. O tym, jak ją przygotować, mówi przewodnik [Persony użytkownika](../characters/personas.md).

Impersonate działa wyłącznie na czatach w trybie Roleplay. W trybie Conversation ani w trybie Game Mode nie jest dostępna. Po próbie użycia jej na czacie Conversation zobaczysz komunikat "Impersonate is not available in Conversation mode."

### Korzystanie z /impersonate

1. Wpisz `/impersonate` w polu wiadomości. Możesz dodać po niej wskazówkę, ale nie musisz.
2. Naciśnij Enter albo kliknij przycisk **Send**.
3. AI pisze wiadomość użytkownika jako twoja persona i umieszcza ją na czacie.

Na przykład tak każesz AI napisać twoim głosem wiadomość z pytaniem o pogodę:

```
/impersonate ask about the weather
```

Komenda ma krótki odpowiednik. Zamiast `/impersonate` możesz wpisać `/imp`.

Wiadomość napisaną przez Impersonate da się powtórzyć. Akcja **Regenerate** działa na wiadomościach użytkownika utworzonych przez Impersonate, więc możesz dostać inną wersję.

### Ustawienia sekcji Impersonate

Impersonate ma własną sekcję ustawień, która obowiązuje przy każdym uruchomieniu `/impersonate`, na wszystkich czatach. Otwiera się ją z ustawień pojedynczego czatu.

1. Otwórz panel **Chat Settings** (ustawienia czatu) dla czatu w trybie Roleplay.
2. Znajdź sekcję **Impersonate**.

W sekcji są takie ustawienia:

- **Prompt Template**: nieobowiązkowa instrukcja wysyłana do modelu przy każdym użyciu Impersonate. Zostaw puste, żeby korzystać z promptu samego czatu, a gdy czat go nie ma – z wbudowanego domyślnego. Prompt to tekst, który Marinara wysyła do AI. Obsługiwane są makra `{{user}}`, `{{persona_description}}` i `{{impersonate_direction}}`. Makro to symbol zastępczy, który Marinara zamienia na prawdziwy tekst przed wysłaniem. Kliknij **Built-in default**, żeby zobaczyć domyślną treść. Przycisk **Reset** czyści własny szablon z powrotem do pustego.
- **Preset**: użycie konkretnego presetu promptu tylko dla odpowiedzi z Impersonate. Preset to zapisany zestaw ustawień promptu. Zobacz przewodnik [Edytor presetów i menedżer promptów](../prompts/presets.md). Domyślnie ustawione jest **Use chat default**. Presety działają wyłącznie w trybie Roleplay.
- **Connection**: kierowanie odpowiedzi z Impersonate do konkretnego połączenia, na przykład do tańszego albo szybszego modelu. Połączenie to zapisany skrót do dostawcy AI. Zobacz przewodnik [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md). Domyślnie ustawione jest **Use chat default**. Możesz też wybrać **Random**.
- **Skip agents**: po włączeniu Marinara pomija podczas Impersonate cały ciąg agentów (trackery, agentów kierujących lorebookami i podobnych pomocników). Dzięki temu Impersonate działa szybko i nie zmienia stanu świata. Domyślnie wyłączone. Zobacz przewodnik [Agenci](../agents/agents-overview.md).
- **Use CYOA as direction**: po włączeniu kliknięty wybór CYOA staje się wskazówką dla Impersonate, zamiast trafić na czat jako zwykła wiadomość. CYOA to skrót od "choose your own adventure", czyli zestaw klikalnych wyborów, które niektóre czaty pokazują po odpowiedzi. To ustawienie jest domyślnie wyłączone.

### Ustawianie własnego promptu dla Impersonate

Prompt dla Impersonate da się też ustawić tylko dla jednego czatu, komendą slash.

1. Wpisz `/impersonate_prompt`, a po niej swój prompt w cudzysłowie.
2. Naciśnij Enter.

Na przykład:

```
/impersonate_prompt "You will now play as my OC:"
```

Żeby wyczyścić prompt dla danego czatu i wrócić do domyślnego, wpisz:

```
/impersonate_prompt reset
```

Komenda ma krótki odpowiednik: `/imp_prompt`.

## Menu Quick replies

Menu Quick replies dokłada dodatkowe akcje wysyłania obok zwykłego przycisku **Send**. Daje dostęp do sterowanego generowania i do Impersonate jednym kliknięciem, bez wpisywania komendy slash.

To, które akcje się pokazują, wybierasz w ustawieniach.

1. Otwórz **Settings**, potem **Advanced**, potem **Message Tools**.
2. Włącz **Quick replies**. Domyślnie jest wyłączone.
3. Rozwiń tę pozycję i zaznacz akcje, które mają się pojawić. Po włączeniu menu wszystkie trzy akcje są domyślnie włączone.

Te trzy akcje to:

- **Post only**: dodanie wpisanej wiadomości na czat bez wywoływania odpowiedzi AI. Możesz też użyć komendy slash `/send <message>`.
- **Guide reply**: wysłanie wpisanego tekstu jako wskazówki `/guided` zamiast zwykłej wiadomości.
- **Impersonate**: wygenerowanie odpowiedzi jako twoja persona, z wpisanym tekstem w roli wskazówki. Ta akcja jest ukryta na czatach Conversation, bo Impersonate tam nie działa.

Kiedy włączona jest tylko jedna akcja, jej przycisk stoi wprost obok przycisku **Send**. Przy większej liczbie akcje zwijają się do małego menu. Otwiera je przycisk z trzema kropkami, opisany jako **Quick replies**.

## Powiązane przewodniki

- [Działania na wiadomości: edycja, usuwanie, swipe'y, ponowne generowanie](messages.md)
- [Peek Prompt: zobacz, co dostał model AI](peek-prompt.md)
- [Persony użytkownika: tworzenie i edycja](../characters/personas.md)
- [Edytor presetów i menedżer promptów](../prompts/presets.md)
