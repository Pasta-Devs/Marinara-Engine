# Wysyłanie wiadomości i streaming

Ten przewodnik wyjaśnia podstawy działania każdego czatu w aplikacji Marinara Engine. Pokazuje, jak wysłać wiadomość, jak odpowiedź AI pojawia się na ekranie w trakcie pisania oraz jak ją zatrzymać albo ponowić. Opisuje też załączniki, wskaźniki "myślenia" i to, co zrobić, gdy pojawi się błąd generowania.

## Wysyłanie wiadomości

Pasek wpisywania wiadomości znajduje się na dole każdego czatu. Wpisz tekst w polu, a potem uruchom odpowiedź AI na jeden z dwóch sposobów:

1. Kliknij przycisk **Send** (wyślij) po prawej stronie paska wpisywania.
2. Albo naciśnij Enter, jeśli dla danego trybu czatu włączona jest opcja **Send on Enter** (wysyłanie klawiszem Enter).

Wiadomość pojawia się na liście, a zaraz za nią odpowiedź AI, generowana na bieżąco.

W jednym czacie generuje się tylko jedna odpowiedź naraz. Kiedy odpowiedź jest w trakcie streamingu, przycisk **Send** zmienia się w przycisk zatrzymania, więc drugiej odpowiedzi nie da się uruchomić przez przypadek.

Do wysyłania potrzebne jest działające połączenie. Połączenie to zapisany dostęp do dostawcy AI (zobacz powiązany przewodnik poniżej). Bez niego odpowiedź od razu kończy się błędem z informacją, że dla czatu nie skonfigurowano żadnego połączenia.

### Ustawienie **Send on Enter**

Ustawienie **Send on Enter** znajduje się w sekcji **Input & Editing**, w zakładce **General** panelu **Settings** (Ustawienia). Ma osobny przełącznik dla każdego trybu czatu:

| Tryb czatu | Domyślnie | Co robi Enter po włączeniu |
|---|---|---|
| Roleplay | Off | Enter wysyła wiadomość |
| Conversations | On | Enter wysyła wiadomość |
| Game | On | Enter wysyła wiadomość |

Kiedy przełącznik danego trybu jest wyłączony, Enter dodaje nową linię. Wiadomość wysyłasz wtedy przyciskiem **Send**. W trybie Roleplay opcja jest domyślnie wyłączona, bo wiadomości w tym trybie bywają długie i potrzebują podziału na linie.

## Załączanie obrazów i plików

Do wiadomości można dołączyć obrazy lub pliki, żeby AI mogła je zobaczyć albo przeczytać. Kliknij ikonę spinacza na pasku wpisywania i wybierz plik. Dołączone pliki widać jako małe kafelki nad polem wpisywania, jeszcze przed wysłaniem.

Marinara przyjmuje takie typy plików:

- Obrazy.
- Pliki PDF.
- Zwykłe pliki tekstowe: `.txt`, `.md`, `.markdown`, `.json`, `.jsonl`, `.csv`, `.log`, `.xml`, `.yaml` oraz `.yml`.

Każdy plik może mieć najwyżej 20 MB. Większy plik Marinara odrzuca z informacją, że jest za duży. Nieobsługiwany typ pliku również zostaje odrzucony, a komunikat wymienia dozwolone typy.

AI "zobaczy" obraz tylko wtedy, gdy podłączony model obsługuje analizę obrazu. Jeśli model pracuje wyłącznie na tekście, włącz opcję **Image Captioning** (opisywanie obrazów). To ustawienie znajduje się w panelu **Chat Settings** (ustawienia czatu) danego czatu, w sekcji **Advanced Parameters**, i domyślnie jest wyłączone. Po włączeniu Marinara opisuje słowami każdy załączony obraz, korzystając z wybranego połączenia, i wysyła ten opis zamiast samego obrazu.

## Wstawianie obrazu z galerii do wiadomości

Załączniki są przeznaczone do *oglądania przez AI*. Odwołania do galerii są przeznaczone do *oglądania przez czytelnika*: pokazują obraz z galerii bezpośrednio w treści wiadomości.

Wiadomości obsługują składnię obrazów Markdown, a Marinara Engine rozwiązuje specjalne łącza `card://` do plików galerii:

```text
![a caption](card://characters/<character-id>/gallery/<filename>.png)
```

W trybie Roleplay przeglądarka zasobów czatu może wstawić takie łącze. Można je też wkleić wszędzie tam, gdzie pisze się tekst: w wiadomościach, powitaniach i przykładowych dialogach.

Dla obrazu z **własnej galerii postaci** wybieraj przenośny format `card://self/gallery/<filename>`, który działa nadal po eksporcie i imporcie postaci. Przycisk **Copy image reference** w galerii postaci tworzy takie odwołanie. Szczegóły opisuje sekcja [Galerie postaci → Ponowne używanie obrazu z galerii w wiadomościach i powitaniach](../characters/galleries.md#reuse-a-gallery-image-in-messages-and-greetings).

## Streaming odpowiedzi

Streaming pokazuje odpowiedź słowo po słowie, w trakcie generowania, zamiast czekać na całość naraz. Ustawienia streamingu znajdują się w sekcji **Responses**, w zakładce **General** panelu **Settings**:

| Ustawienie | Domyślnie | Co robi |
|---|---|---|
| **Enable streaming** | On | Pokazuje odpowiedź słowo po słowie w trakcie generowania |
| **Streaming speed** | 50 | Decyduje o tym, jak szybko tekst pojawia się na ekranie |
| **Trim incomplete model endings** | Off | Ucina urwane zdanie na końcu przed zapisem |

**Streaming speed** to suwak od 1 do 100. Niższa wartość daje wolniejszy efekt maszyny do pisania, więc da się czytać na bieżąco. Wyższa pokazuje tekst niemal natychmiast. Marinara wygładza nierówne tempo napływania tokenów (małych kawałków tekstu) w czasie pisania odpowiedzi, a potem kończy ją z wybraną prędkością. To ustawienie nie zmienia tempa pracy samego modelu.

Kiedy opcja **Enable streaming** jest wyłączona, cała odpowiedź pojawia się naraz, po zakończeniu pracy modelu.

Opcja **Trim incomplete model endings** wpływa wyłącznie na zapisaną wiadomość. Po włączeniu Marinara usuwa z końca odpowiedzi urwane zdanie. Kompletne odpowiedzi i zakończenia w stylu komendy zostają nietknięte.

## Wskaźniki pisania i postępu

Zanim pojawi się pierwsze słowo odpowiedzi, Marinara pokazuje, że postać pracuje. Widać wtedy imię postaci i trzy animowane kropki. W czacie grupowym imiona wszystkich odpowiadających postaci pojawiają się razem.

Kiedy serwer przygotowuje prompt (tekst, który Marinara wysyła do AI), krótka linia postępu przewija kolejne etykiety:

- **Preparing context...**
- **Building prompt...**
- **Scanning lorebooks...**
- **Recalling memories...**
- **Running agents...**
- **Retrieving knowledge...**
- **Generating...**

Każda etykieta odpowiada krokowi, który Marinara wykonuje przed odpowiedzią albo w jej trakcie. Linia znika, gdy tylko napłynie pierwsze słowo odpowiedzi. Część kroków uruchamia się tylko wtedy, gdy czat korzysta z danej funkcji, więc nie wszystkie etykiety muszą się pojawić.

Jeśli status obecności postaci jest ustawiony na zajęty albo nieobecny, zamiast kropek pisania pojawia się wskaźnik oczekiwania. Odpowiedź rusza, gdy postać znów będzie dostępna.

## Podgląd myślenia modelu

Niektóre modele udostępniają ukryty zapis rozumowania, nazywany często "myśleniem". Marinara trzyma go osobno od widocznej odpowiedzi.

Gdy do odpowiedzi dołączone jest myślenie, przy tej wiadomości pojawia się akcja **View thoughts** (podgląd myśli) z ikoną mózgu. Kliknij ją, żeby otworzyć panel z przechwyconym tekstem rozumowania.

Rozumowanie pokaże się tylko wtedy, gdy model faktycznie je zwraca. Niektóre modele opakowują je w zwykłe znaczniki tekstowe. W takim wypadku ustaw w połączeniu własne **Thinking Tags** (znaczniki myślenia), żeby Marinara umiała oddzielić ukryte rozumowanie od widocznej odpowiedzi. Kilka popularnych par znaczników jest rozpoznawanych od razu. Sposób ustawiania **Thinking Tags** opisuje przewodnik po parametrach generowania, podlinkowany poniżej.

## Zatrzymywanie odpowiedzi

Żeby zatrzymać odpowiedź, która wciąż się generuje, kliknij przycisk zatrzymania. To ten sam przycisk **Send**: w czasie streamingu jego ikona zmienia się w symbol stopu.

Tekst, który zdążył napłynąć przed zatrzymaniem, zwykle zostaje na ekranie. Celowe zatrzymanie nigdy nie jest pokazywane jako błąd.

## Ponawianie bez przepisywania

Jeśli ostatnia wiadomość w czacie jest twoja, a AI nigdy nie odpowiedziała, nie trzeba wpisywać jej jeszcze raz. Zostaw pole wpisywania puste. Potem kliknij przycisk **Send** (albo naciśnij Enter), żeby uruchomić nową odpowiedź bez dublowania wiadomości. W trybie Conversation przycisk pokazuje wtedy okrągłą strzałkę ponowienia.

Ponawianie działa tylko przy pustym polu. Jeśli w polu jest już wpisany tekst, przycisk wyśle właśnie ten tekst.

W trybie Roleplay działa podobny skrót. Naciśnij **Send** przy pustym polu, żeby ponaglić AI do kolejnej odpowiedzi, nawet jeśli już odpowiedziała. Zawsze powstaje wtedy zupełnie nowa odpowiedź. Nic nie dopisuje się do poprzedniej. Żeby przedłużyć poprzednią odpowiedź, użyj komendy `/continue`, opisanej w przewodniku po działaniach na wiadomościach poniżej.

## Kiedy pojawia się błąd generowania

Jeśli odpowiedź się nie uda, Marinara pokazuje powiadomienie na dole ekranu. Powiadomienie utrzymuje się około 15 sekund, a jego treść można skopiować. Zatrzymana odpowiedź nie jest traktowana jak błąd.

W kilku typowych sytuacjach Marinara zamienia surowy komunikat błędu na jasną wskazówkę:

- Jeśli model odrzuca parametr, którego nie obsługuje, powiadomienie podpowiada, jak to naprawić. Otwórz panel **Chat Settings**, przejdź do sekcji **Advanced Parameters** i wyłącz **Send** dla tego parametru.
- Jeśli model wymaga parametru, który jest wyłączony, powiadomienie każe go włączyć z powrotem. Wejdź w to samo miejsce i włącz **Send** dla tego parametru.
- Jeśli odpowiedź wróci zupełnie pusta, powiadomienie proponuje wysłanie wiadomości jeszcze raz.

Inne czytelne komunikaty, jakie mogą się pojawić:

- Dla tego czatu generuje się już odpowiedź. Zaczekaj, aż się skończy, albo zatrzymaj ją przyciskiem zatrzymania.
- Dla tego czatu nie skonfigurowano żadnego połączenia. Najpierw je utwórz (zobacz powiązany przewodnik poniżej).

Jeśli błąd wraca uparcie, więcej sposobów na problemy z połączeniem i błędy generowania znajdziesz w przewodniku po rozwiązywaniu problemów, podlinkowanym poniżej.

## Wolne łącza i zakładki na telefonie

Długa odpowiedź może chwilę potrwać i to normalne. Odpowiedź da się zatrzymać w każdej chwili przyciskiem zatrzymania.

Na telefonie przeglądarka może wstrzymać zakładkę z czatem po przełączeniu się na inną. Jeśli odpowiedź była wtedy w trakcie streamingu, Marinara pokazuje stan **Finishing in background...** (kończenie w tle). Potem sprawdza, czy odpowiedź zakończyła się na serwerze. Kiedy trwa to dłużej, pojawia się informacja, że odpowiedź wciąż kończy się w tle. Odśwież czat za moment, jeśli nadal go nie widać.

## Powiązane przewodniki

- [Działania na wiadomości: edycja, usuwanie, swipe'y, ponowne generowanie](messages.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Parametry generowania](../prompts/generation-parameters.md)
- [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md)
