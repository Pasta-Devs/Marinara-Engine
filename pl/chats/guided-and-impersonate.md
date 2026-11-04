# Sterowane generowanie i Impersonate

Dwa sposoby na kierowanie czatem. Sterowane generowanie nadaje kolejnej odpowiedzi kierunek bez publikowania widocznej wiadomości. Funkcja Impersonate każe modelowi napisać twoją własną odpowiedź. Menu Quick replies (szybkie odpowiedzi) stawia obie akcje obok przycisku **Send** (wysłanie).

## Sterowanie odpowiedzią komendą /guided

Twoja wskazówka jest poza rolą. Kształtuje odpowiedź, ale nie pojawia się jako wiadomość na czacie.

1. Wpisz w polu wiadomości `/guided` i swoją wskazówkę.
2. Naciśnij <kbd>Enter</kbd> albo kliknij **Send**.

Model pisze kolejną odpowiedź zgodnie z twoją wskazówką. Na przykład:

```text
/guided make him admit he is lying
```

Zamiast `/guided` możesz wpisać `/narrator`, `/narrate` albo `/nar`. Na czacie grupowym skieruj wskazówkę do jednej postaci za pomocą `respond as`, `reply as` albo `respond for`:

```text
/guided respond as Alice make her admit she is lying
```

## Sterowanie ponownym generowaniem

Ten sposób wykorzystuje tekst z pola wiadomości jako jednorazową wskazówkę dla ponownego generowania.

1. Otwórz **Settings → Advanced → Message Tools** (ustawienia, zaawansowane, narzędzia wiadomości) i włącz **Guide swipes/regens with chat input** (sterowanie swipe'ami i ponownym generowaniem tekstem z pola wiadomości). Domyślnie jest wyłączone.
2. Na czacie wpisz wskazówkę w polu wiadomości, ale jej nie wysyłaj.
3. Kliknij **Regenerate** (ponowne generowanie) na wiadomości AI. Gdy w polu jest tekst, przycisk nosi nazwę **Regenerate (guided)**.

Wskazówka zostaje potem w polu, więc możesz ją poprawić i ponownie wygenerować odpowiedź. Żeby zamiast tego pole się czyściło, wyłącz **Keep guidance after regenerating** (zachowanie wskazówki po ponownym generowaniu) w **Settings → General → Input & Editing** (ustawienia, ogólne, wprowadzanie i edycja).

Jeśli to nie zadziałało: przycisk musi nosić nazwę **Regenerate (guided)**. Jeśli widnieje na nim tylko **Regenerate**, ustawienie jest wyłączone albo pole jest puste.

<a id="read-stored-guidance"></a>

## Odczytywanie wskazówek Stored guidance

Marinara zapisuje wskazówkę, która pokierowała odpowiedzią.

1. Kliknij ikonę **Stored guidance** (zapisana wskazówka, zwój) na wiadomości AI.
2. Okno o tytule **Stored guidance** pokazuje wskazówkę.

Okno podaje, skąd pochodzi wskazówka: **/guided**, **Guided regenerate** (sterowane ponowne generowanie) albo **Game start** (konfiguracja trybu Game Mode). Przy wskazówkach z `/guided` i ze sterowanego ponownego generowania przycisk **Copy /guided** kopiuje gotową do użycia komendę `/guided`, którą możesz wkleić na innym czacie.

## Pisanie odpowiedzi funkcją Impersonate

Funkcja Impersonate każe modelowi napisać twoją kolejną wiadomość głosem twojej persony. Persona to postać, w którą się wcielasz, zapisywana jako `{{user}}`. Zobacz [Persony](../characters/personas.md).

Zanim zaczniesz: Impersonate działa tylko na czatach w trybie Roleplay. W trybie Conversation zobaczysz komunikat "Impersonate is not available in Conversation mode." Funkcja nie jest dostępna także w trybie Game.

1. Wpisz `/impersonate` w polu wiadomości. Jeśli chcesz, dodaj po niej wskazówkę.
2. Naciśnij <kbd>Enter</kbd> albo kliknij **Send**.

Model publikuje wiadomość użytkownika jako twoja persona. Na przykład ta komenda tworzy wiadomość z pytaniem o pogodę:

```text
/impersonate ask about the weather
```

Krótki odpowiednik to `/imp`. **Regenerate** działa na wiadomości napisanej przez Impersonate, więc możesz dostać inną wersję.

### Ustawienia Impersonate

Te ustawienia obowiązują przy każdym użyciu `/impersonate` na wszystkich twoich czatach. Otwórz panel **Chat Settings** (ustawienia czatu) na czacie w trybie Roleplay i znajdź sekcję **Impersonate**. Jak otworzyć ten panel, opisuje [Panel **Chat Settings** – przegląd](chat-settings.md).

| Kontrolka | Do czego służy |
| --- | --- |
| **Prompt Template** (szablon promptu) | Opcjonalna instrukcja wysyłana przy każdym użyciu Impersonate. Gdy pole jest puste, używany jest prompt samego czatu albo wbudowany prompt domyślny. Obsługuje `{{user}}`, `{{persona_description}}` i `{{impersonate_direction}}` – symbole zastępcze, które Marinara zamienia na prawdziwy tekst. Wybierz **Built-in default** (wbudowany domyślny), żeby przeczytać domyślną treść, **Copy built-in default to edit** (skopiowanie wbudowanego domyślnego do edycji), żeby zacząć od kopii, **Save as** (zapisanie jako), żeby zachować nazwany szablon, i **Delete template** (usunięcie szablonu), żeby go usunąć. |
| **Preset** | Preset promptu tylko dla odpowiedzi z Impersonate. Domyślnie: **Use chat default** (użyj ustawienia czatu). Zobacz [Edytor presetów i menedżer promptów](../prompts/presets.md). |
| **Connection** (połączenie) | Model dla odpowiedzi z Impersonate, na przykład tańszy albo szybszy. Domyślnie: **Use chat default**. Możesz też wybrać **Random** (losowo). Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md). |
| **Skip agents** (pomijanie agentów) | Pomija agentów (trackery, agentów kierujących lorebookami i podobnych pomocników) podczas Impersonate. Dzięki temu Impersonate działa szybko i nie zmienia stanu świata. Domyślnie wyłączone. Zobacz [Agenci](../agents/agents-overview.md). |
| **Use CYOA as direction** (użycie CYOA jako wskazówki) | Kliknięcie opcji CYOA (choose your own adventure, czyli "wybierz własną przygodę") używa jej jako wskazówki dla Impersonate zamiast publikować ją na czacie. Domyślnie wyłączone. Jeśli w **Settings → General → Input & Editing** włączono **Add CYOA choices to the message box instead of sending them** (dodawanie wyborów CYOA do pola wiadomości zamiast ich wysyłania), kliknięcie tylko dodaje tekst do pola wiadomości, a to ustawienie nic nie zmienia. |

### Ustawianie promptu dla jednego czatu

1. Wpisz `/impersonate_prompt` i swój prompt w cudzysłowie.
2. Naciśnij <kbd>Enter</kbd>.

```text
/impersonate_prompt "You will now play as my OC:"
```

Aby wrócić do domyślnego promptu, wpisz `/impersonate_prompt reset`. Odpowiednik tej komendy to `/imp_prompt`.

## Dodawanie Quick replies obok przycisku Send

Quick replies dodają obok **Send** alternatywy dostępne jednym kliknięciem, więc nie trzeba wpisywać komendy slash.

1. Otwórz **Settings → General → Input & Editing**.
2. Włącz **Quick replies**. Domyślnie jest wyłączone.
3. Rozwiń tę pozycję, żeby wybrać akcje, które mają się pojawić. Po włączeniu wszystkie trzy akcje są domyślnie włączone.

| Akcja | Do czego służy |
| --- | --- |
| **Post only** (tylko publikacja) | Dodaje wpisaną wiadomość na czat bez odpowiedzi. To samo robi komenda `/send <message>`. |
| **Guide reply** (pokierowanie odpowiedzią) | Wysyła wpisany tekst jako wskazówkę `/guided`. |
| **Impersonate** (pisanie za ciebie) | Generuje odpowiedź po stronie persony, używając wpisanego tekstu jako wskazówki. Na czatach Conversation ta akcja jest ukryta. |

Gdy włączona jest jedna akcja, jej przycisk stoi obok **Send**. Gdy jest ich więcej, zwijają się do przycisku z trzema kropkami (**Quick replies**), który otwiera menu.
