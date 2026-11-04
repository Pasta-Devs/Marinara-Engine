# Wysyłanie wiadomości i streaming

Wpisz wiadomość, wyślij ją i patrz, jak pojawia się odpowiedź. Ten przewodnik opisuje wysyłanie, załączniki, streaming, zatrzymywanie odpowiedzi, ponawianie i odczytywanie błędów.

## Wysyłanie wiadomości

Zanim zaczniesz: czat potrzebuje modelu. Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

1. Wpisz wiadomość na pasku wpisywania na dole czatu.
2. Kliknij **Send** (wysłanie) albo naciśnij <kbd>Enter</kbd>, jeśli dla danego trybu czatu włączona jest opcja **Send on Enter** (wysyłanie klawiszem Enter).

Pojawia się twoja wiadomość, a potem napływa odpowiedź. W jednym czacie naraz generuje się tylko jedna odpowiedź. Podczas streamingu odpowiedzi przycisk **Send** zmienia się w przycisk zatrzymania.

Jeśli to nie zadziałało: gdy czat nie ma ustawionego modelu, odpowiedź od razu kończy się błędem z informacją, że nie skonfigurowano żadnego połączenia. Wybierz je w panelu **Chat Settings** (ustawienia czatu) – zobacz [Panel **Chat Settings** – przegląd](chat-settings.md).

<a id="send-on-enter"></a>

### Ustawienie Send on Enter

Znajdziesz je w **Settings → General → Input & Editing** (ustawienia, ogólne, wprowadzanie i edycja). Każdy tryb czatu ma własny przełącznik.

| Tryb czatu | Domyślnie | Gdy wyłączone |
| --- | --- | --- |
| Roleplay | Wyłączone | <kbd>Enter</kbd> dodaje nową linię. Kliknij **Send**. |
| Conversations | Włączone | Wiadomość wysyła <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (na komputerze Mac <kbd>Cmd</kbd>+<kbd>Enter</kbd>). |
| Game | Włączone | Wiadomość wysyła <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (na komputerze Mac <kbd>Cmd</kbd>+<kbd>Enter</kbd>). |

W trybie Roleplay opcja jest domyślnie wyłączona, bo wiadomości w tym trybie bywają długie i potrzebują podziału na linie. Asystentka Professor Mari ma własny przełącznik, **Enter sends to Professor Mari** (wysyłanie do Professor Mari klawiszem Enter), w **Settings → General → Search and Professor Mari settings** (ustawienia, ogólne, ustawienia wyszukiwarki i asystentki Professor Mari).

## Załączanie obrazów i plików

1. Dotknij ikony spinacza na pasku wpisywania.
2. Wybierz plik. Pojawi się jako mały kafelek nad polem wpisywania.
3. Wyślij wiadomość jak zwykle.

Marinara przyjmuje obrazy, pliki PDF i zwykłe pliki tekstowe (`.txt`, `.md`, `.markdown`, `.json`, `.jsonl`, `.csv`, `.log`, `.xml`, `.yaml`, `.yml`). Każdy plik może mieć najwyżej 20 MB. Większy plik albo nieobsługiwany typ pliku Marinara odrzuca z krótką informacją.

Model zobaczy obraz tylko wtedy, gdy obsługuje analizę obrazu. Dla modelu, który pracuje wyłącznie na tekście, włącz **Image captioning** (opisywanie obrazów) w **Chat Settings → Advanced Parameters** (ustawienia czatu, parametry zaawansowane). Domyślnie ta opcja jest wyłączona. Marinara opisuje wtedy słowami każdy obraz, korzystając z wybranego modelu, i wysyła ten opis zamiast obrazu.

## Wyświetlanie obrazu z galerii w wiadomości

Załączniki są dla modelu. Łącze do galerii pokazuje obraz tobie, w treści wiadomości. Wiadomości obsługują składnię obrazów Markdown, a Marinara rozwiązuje łącza `card://` do plików galerii:

```text
![a caption](card://characters/<character-id>/gallery/<filename>.png)
```

W trybie Roleplay przeglądarka zasobów czatu może wstawić łącze za ciebie. Możesz też wkleić je w wiadomościach, powitaniach i przykładowych dialogach.

Dla własnej galerii postaci użyj przenośnej formy `card://self/gallery/<filename>`. Działa ona także po eksporcie i imporcie postaci. Tworzy ją przycisk **Copy image reference** (kopiowanie odwołania do obrazu) w galerii. Zobacz [Galerie postaci](../characters/galleries.md#reuse-a-gallery-image-in-messages-and-greetings).

## Streaming odpowiedzi

Streaming pokazuje odpowiedź słowo po słowie, a nie całą naraz. Te ustawienia znajdują się w **Settings → General → Responses** (ustawienia, ogólne, odpowiedzi).

| Ustawienie | Domyślnie | Do czego służy |
| --- | --- | --- |
| **Enable streaming** (włączenie streamingu) | Włączone | Pokazuje odpowiedź w trakcie pisania. Po wyłączeniu cała odpowiedź pojawia się, gdy model skończy. |
| **Streaming speed** (szybkość streamingu) | 50 | Suwak od 1 do 100. Niższa wartość to wolniejszy efekt maszyny do pisania. Nie zmienia tempa, w jakim pisze model. |
| **Trim incomplete sentences from the response** (ucinanie niedokończonych zdań w odpowiedzi) | Wyłączone | Usuwa niedokończone ostatnie zdanie przed zapisaniem odpowiedzi. Kompletne odpowiedzi i zakończenia w stylu komendy zostają bez zmian. |

## Wskaźniki pisania i postępu

Zanim pojawi się pierwsze słowo, widać imię postaci i trzy animowane kropki. W czacie grupowym widać imiona wszystkich odpowiadających postaci. Gdy serwer przygotowuje prompt, linia postępu wyświetla kolejno te etykiety. Niektóre kroki uruchamiają się tylko wtedy, gdy czat korzysta z danej funkcji, więc nie wszystkie muszą się pojawić.

- **Preparing context...**
- **Building prompt...**
- **Scanning lorebooks...**
- **Recalling memories...**
- **Running agents...**
- **Retrieving knowledge...**
- **Generating...**

Jeśli postać ma status zajęty albo nieobecny, zamiast kropek pojawia się wskaźnik oczekiwania. Odpowiedź rusza, gdy postać jest dostępna.

## Podgląd myślenia modelu

Niektóre modele zwracają ukryty zapis rozumowania, nazywany "myśleniem". Gdy odpowiedź go ma, na wiadomości pojawia się ikona mózgu **View model thoughts** (podgląd myśli modelu). Kliknij ją, żeby przeczytać rozumowanie.

Działa to tylko wtedy, gdy model zwraca rozumowanie. Niektóre modele opakowują je w zwykłe znaczniki tekstowe. Dla takich modeli ustaw **Thinking Tags** (znaczniki myślenia) w ustawieniach generowania, żeby Marinara umiała oddzielić rozumowanie od odpowiedzi. Zobacz [Parametry generowania](../prompts/generation-parameters.md).

## Zatrzymywanie odpowiedzi

Kliknij przycisk zatrzymania – w czasie streamingu odpowiedzi jest nim przycisk **Send**. Tekst, który zdążył napłynąć, zwykle zostaje. Celowe zatrzymanie nigdy nie wyświetla błędu.

<a id="retry-without-retyping"></a>

## Ponawianie bez przepisywania

Jeśli ostatnia wiadomość jest twoja, a odpowiedź AI nie nadeszła, zostaw pole wpisywania puste i kliknij **Send** (albo naciśnij <kbd>Enter</kbd>). Marinara uruchamia nową odpowiedź i nie dubluje wiadomości. W trybie Conversation przycisk pokazuje wtedy okrągłą strzałkę. Jeśli w polu jest szkic, **Send** wysyła zamiast tego szkic.

W trybie Roleplay **Send** przy pustym polu uruchamia zupełnie nową odpowiedź także już po odpowiedzi AI. Nie dopisuje niczego do poprzedniej odpowiedzi. Aby przedłużyć poprzednią odpowiedź, użyj `/continue`. Zobacz [Działania na wiadomości](messages.md).

## Kiedy pojawia się błąd generowania

Nieudana odpowiedź wyświetla na dole ekranu powiadomienie (krótki wyskakujący komunikat) na około 15 sekund. Jego treść można skopiować. Niektóre błędy Marinara zamienia na wskazówkę, co zrobić dalej:

| Przyczyna | Co mówi powiadomienie |
| --- | --- |
| Model odrzuca parametr, którego nie obsługuje | Otwórz **Chat Settings → Advanced Parameters** i wyłącz **Send** dla tego parametru. |
| Model wymaga parametru, który jest wyłączony | Włącz z powrotem **Send** w tym samym miejscu. |
| Odpowiedź wróciła pusta | Wyślij wiadomość jeszcze raz. |
| Odpowiedź już się generuje | Zaczekaj albo zatrzymaj ją przyciskiem zatrzymania. |
| Nie skonfigurowano połączenia | Skonfiguruj połączenie dla czatu. |

Jeśli błąd się powtarza, zobacz [Rozwiązywanie problemów](../TROUBLESHOOTING.md).

## Wolne łącza i karty na telefonie

Długa odpowiedź może chwilę potrwać. Możesz ją zatrzymać w każdej chwili. Na telefonie przeglądarka może wstrzymać kartę z czatem, gdy przełączysz się gdzie indziej. Jeśli odpowiedź była w trakcie streamingu, Marinara pokazuje **Finishing in background...** (kończenie w tle), a potem sprawdza, czy odpowiedź zakończyła się na serwerze. Jeśli się nie pojawiła, odśwież czat za chwilę.
