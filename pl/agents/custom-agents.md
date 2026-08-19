# Tworzenie własnych agentów

Z tego przewodnika dowiesz się, jak zbudować własnego agenta w aplikacji Marinara Engine. Agent to mały pomocnik AI, który działa automatycznie obok czatu. Zobaczysz, jak ustawić jego fazę, uprawnienia, typ wyniku, słowa wyzwalające, narzędzia i prompt (tekst, który Marinara wysyła do AI), a na koniec czeka pełny przykład krok po kroku.

Agenci to nowość? Zacznij od przewodnika [Agenci: pomocnicy AI w czatach](agents-overview.md), a potem wróć tutaj.

## Kiedy warto zbudować własnego agenta

Marinara Engine ma wielu oficjalnych agentów do pobrania. Zanim zaczniesz tworzyć własnego, zajrzyj do przewodnika [Agenci do pobrania: przegląd pakietów](built-in-agents.md) oraz do publicznego repozytorium pakietów [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Któryś z gotowych agentów może już robić dokładnie to, o co chodzi, a oficjalne manifesty są przy okazji działającymi przykładami pakietów.

Własnego agenta buduj wtedy, gdy potrzebujesz czegoś, czego wbudowani agenci nie obejmują. Dobre powody to na przykład:

- Chcesz pomocnika z własnymi instrukcjami i własnym stylem wypowiedzi.
- Chcesz wstawiać konkretną notatkę do każdego promptu.
- Chcesz przepisywać każdą odpowiedź w określonym stylu.
- Chcesz, żeby agent wywoływał twoje własne narzędzie.

Jeśli któryś z zainstalowanych oficjalnych agentów jest już blisko celu, skopiuj go. W panelu **Agents** (Agenci) najedź na jego kafelek i kliknij przycisk **Copy agent**. Powstaje wtedy własna kopia, którą da się edytować.

## Zanim zaczniesz

Dwie rzeczy warto wiedzieć od razu:

1. Agentów ustawia się dla czatu, a nie dla postaci. Zbudowanie agenta w bibliotece jeszcze go nie uruchamia. Trzeba dodać go do czatu i włączyć przełącznik **Enable Agents** (włączenie agentów) w panelu **Chat Settings** (ustawienia czatu).
2. Własni agenci działają w każdym trybie czatu: Roleplay, Game Mode i Conversation. Oficjalne pakiety pojawiają się tylko w obsługiwanych przez siebie trybach, natomiast twoi własni agenci są dostępni wszędzie.

## Tworzenie własnego agenta

Wykonaj kolejno te kroki, żeby zbudować nowego agenta od zera.

1. Otwórz panel **Agents**.
2. Kliknij przycisk **New** (ikona plusa) u góry.
3. Otwiera się pełnoekranowy edytor agenta z pustym agentem.
4. Wpisz nazwę w polu tytułu na górze, na przykład `Weather Reporter`.
5. Uzupełnij pola **Description** (opis) i **Author** (autor), żeby później pamiętać, do czego ten agent służy.
6. Wybierz fazę w sekcji **Pipeline Phase** (faza potoku) – szczegóły niżej.
7. Włącz potrzebne uprawnienia w sekcji **Custom Agent Abilities** (uprawnienia własnego agenta).
8. Wybierz typ wyniku w sekcji **Result Type** (typ wyniku), pasujący do tego, co agent ma wytwarzać.
9. Napisz instrukcje dla agenta w sekcji **Prompt Template** (szablon promptu).
10. Kliknij przycisk **Save** (zapis) na górnym pasku. Pojawia się wtedy zielona plakietka **Saved**.

Nowy agent trafia do sekcji **Custom Agents** (agenci własni) w panelu **Agents**. Żeby go użyć, otwórz czat, przejdź do panelu **Chat Settings**, włącz przełącznik **Enable Agents** i dodaj agenta z tamtejszej sekcji **Custom Agents**.

## Pipeline Phase

Sekcja **Pipeline Phase** decyduje o tym, kiedy agent się uruchamia. Do wyboru są trzy przyciski:

- **Pre-Generation**: działa, zanim AI odpowie. Może dołożyć kontekst albo zmienić prompt.
- **Parallel**: działa równolegle z odpowiedzią. Nie widzi gotowej odpowiedzi.
- **Post-Processing**: działa po zakończeniu odpowiedzi. Może ją przeczytać, a przy części typów wyniku także zmienić.

Niektóre typy wyniku same wymuszają fazę. Po wybraniu opcji **Text Rewrite** faza przełącza się na **Post-Processing**. Po wybraniu opcji **Prompt Patch** faza przełącza się na **Pre-Generation**. Dzieje się tak dlatego, że takie zadania mają sens wyłącznie w tej jednej fazie.

Własni agenci w fazie **Post-Processing** dostają dodatkowo sekcję **Turn Data Access** (dostęp do danych tury). Są w niej dwa opcjonalne przełączniki: **Pre-generation injections** i **Parallel agent results**. Włącz je, żeby agent widział to, co w tej samej turze wytworzyli inni agenci. Zostaw wyłączone, żeby pracował w izolacji.

## Custom Agent Abilities

Sekcja **Custom Agent Abilities** zbiera uprawnienia, które trzeba włączyć samodzielnie. Dopóki przełącznik jest wyłączony, dane uprawnienie pozostaje zablokowane. Dzięki temu własny agent jest domyślnie bezpieczny. Dostępne uprawnienia:

| Uprawnienie | Na co pozwala agentowi |
|---|---|
| **Create lorebooks** | Utworzyć nowy lorebook (zbiór faktów o twoim świecie) tworzony przez agenta, gdy wynik z opisem świata nie ma wskazanego celu. |
| **Edit lorebooks** | Zapisywać wpisy w lorebooku albo zwracać wyniki aktualizujące lorebook. |
| **Edit messages** | Zastąpić wygenerowaną treść wiadomości przepisanym tekstem albo dopisać do niej propozycje dalszego ciągu. |
| **Edit trackers** | Aktualizować stan trackera (agenta śledzącego stan) gry, postaci, persony lub trackera własnego. |
| **Frontend styling** | Nałożyć tymczasowy efekt wizualny na czas generowania. |
| **Change chat backgrounds** | Zmienić i zapamiętać tło wybrane dla czatu. |
| **Change character sprites** | Zmieniać wyrazy twarzy postaci i persony pokazywane na czacie. |
| **Control media playback** | Sterować odtwarzaniem w Spotify, YouTube lub odtwarzaniem muzyki lokalnej. |
| **Control haptic devices** | Wysyłać ograniczone komendy do podłączonego urządzenia haptycznego. |
| **Edit About Me details** | Zmieniać tekst About Me przypisany do konkretnego czatu. Zmiany w publicznej karcie nadal wymagają osobnej zgody. |
| **Image generation** | Uruchomić generowanie obrazów z podanym promptem obrazu. |
| **Vectors/embeddings** | Korzystać z kontekstu wektorowego lub embeddingów. Wektory to sposób na wyszukiwanie tekstu według znaczenia. |
| **Main prompt edits** | Edytować prompt wysyłany do głównego modelu AI. |

Lorebook to zestaw notatek tła, które AI może wciągnąć do sceny. Tracker to żywy panel przechowujący fakty w rodzaju statystyk, nastroju czy miejsca.

Po włączeniu uprawnienia **Edit lorebooks** pojawia się sekcja **Lorebook Writer**. Włącz w niej przełącznik **Allow lorebook entry writes** i wskaż jeden lorebook na liście rozwijanej **Target lorebook**. Agent może pisać tylko do tego jednego lorebooka.

## Result Type

Sekcja **Result Type** mówi aplikacji Marinara Engine, jak odczytywać wynik agenta. Większość typów wyniku wymaga, żeby agent zwrócił dane w formacie JSON. JSON to prosty format tekstowy zapisywany za pomocą nawiasów klamrowych i cudzysłowów. Każdy typ wyniku potrzebuje pasującego uprawnienia z tabeli powyżej.

| Result Type | Co robi | Potrzebne uprawnienie |
|---|---|---|
| **Context Injection** | Dodaje tekst przed generowaniem albo zapisuje notatkę po generowaniu. | Brak |
| **Text Rewrite** | Działa po odpowiedzi i zastępuje treść wiadomości. | Edit messages |
| **Lorebook Update** | Tworzy lub aktualizuje wpisy w lorebooku. | Edit lorebooks |
| **Character Tracker** | Aktualizuje tracker postaci (postacie obecne w scenie). | Edit trackers |
| **Persona Stats** | Aktualizuje statystyki, status i ekwipunek persony. | Edit trackers |
| **Custom Tracker** | Zastępuje pola twojego własnego trackera. | Edit trackers |
| **Game State** | Aktualizuje dane gry opisujące stan świata. | Edit trackers |
| **Image Prompt** | Prosi generator obrazów o narysowanie sceny. | Image generation |
| **Prompt Patch** | Dodaje sekcje promptu, wstawia je na początku albo je zastępuje. | Main prompt edits |
| **Frontend Style** | Nakłada tymczasowy efekt wizualny. | Frontend styling |
| **Background Change** | Wybiera i zapamiętuje jedno z dostępnych teł czatu. | Change chat backgrounds |
| **Sprite Change** | Zmienia wyrazy twarzy postaci i persony pokazywane na czacie. | Change character sprites |
| **Spotify Control** | Steruje odtwarzaniem w Spotify. | Control media playback |
| **YouTube Control** | Steruje odtwarzaniem w YouTube. | Control media playback |
| **Local Music Control** | Steruje odtwarzaniem z lokalnej kolekcji muzyki. | Control media playback |
| **Haptic Command** | Wysyła ograniczoną komendę do podłączonego urządzenia haptycznego. | Control haptic devices |
| **About Me Update** | Aktualizuje tekst About Me dla danego czatu i proponuje zmiany publiczne. | Edit About Me details |
| **Interactive Choices** | Dopisuje do wygenerowanej wiadomości propozycje dalszego ciągu. | Edit messages |

Najłatwiej zacząć od typu **Context Injection**. Nie wymaga żadnego uprawnienia ani ścisłego formatu wyniku. Sprawdza się wtedy, gdy agent ma tylko dorzucić krótką notatkę do promptu albo zapisać podsumowanie.

Jeśli typ wyniku jest wyszarzony, brakuje włączonego uprawnienia. Włącz pasujący przełącznik w sekcji **Custom Agent Abilities**, a typ wyniku stanie się klikalny.

### Ustawienia agentów obrazowych dla poszczególnych czatów

Agent z uprawnieniem **Image generation** otrzymuje na swojej karcie w sekcji **Chat Settings → Agents → Custom Agents** dwa dodatkowe elementy sterujące, obok wyboru szablonu promptu dostępnego dla każdego własnego agenta:

- **Image Connection** — zastępuje połączenie obrazowe używane przez tego agenta wyłącznie na tym czacie. Ustawienie **Agent default** zachowuje połączenie z ustawień samego agenta. Wybór **Image Style** na poziomie czatu także dotyczy obrazów własnego agenta, dzięki czemu może on generować w inny sposób na każdym czacie bez tworzenia duplikatów.
- **Camera button** — od razu generuje obraz tym agentem, bez czekania na jego słowa aktywujące. Agent nadal sam pisze prompt; jeśli jego szablon nie wygeneruje promptu, zamiast obrazu pojawi się powiadomienie o błędzie.

## Activation Keywords

Domyślnie własny agent działa w swoim zwykłym rytmie. Sekcja **Activation Keywords** (słowa wyzwalające) pozwala go pomijać, dopóki scena nie jest istotna. Oszczędza to tokeny i pieniądze. Token to mały kawałek tekstu, który AI zlicza.

Jak to ustawić:

1. W sekcji **Activation Keywords** wpisz jedno słowo kluczowe lub jedno wyrażenie w każdej linii. Na przykład:

```
tavern
secret door
moonlit ritual
```

2. W polu **Scan Depth** ustaw głębokość skanowania, czyli liczbę ostatnich wiadomości do przeszukania. Domyślnie jest to 5, maksymalnie 200.
3. Agent uruchamia się od tej chwili tylko wtedy, gdy w tylu ostatnich wiadomościach pojawi się co najmniej jedno słowo kluczowe.

Zostaw pole ze słowami kluczowymi puste, żeby agent działał za każdym razem w swoim zwykłym rytmie.

## Podłączanie narzędzi (Function Calling)

Agent może wywoływać narzędzia. Narzędzie to funkcja, którą AI uruchamia, żeby coś pobrać lub zmienić, a potem odczytać wynik. Nazywa się to też wywoływaniem funkcji.

Żeby podłączyć narzędzia, otwórz sekcję **Tools / Function Calling** i włącz lub wyłącz przełącznik przy każdym z nich. Na liście są narzędzia wbudowane oraz wszystkie narzędzia utworzone przez ciebie. O tym, jak zbudować własne, opowiada przewodnik [Własne narzędzia](../extending/custom-tools.md).

Narzędzia działają tylko wtedy, gdy sam czat na to pozwala. W panelu **Chat Settings** otwórz sekcję **Function Calling** i włącz przełącznik **Enable Tool Use**. Bez tego ustawienia czatu narzędzia agenta pozostają wyłączone, nawet jeśli są tutaj włączone.

Zaimportowane pliki agentów nie dają dostępu do narzędzi. Po zaimportowaniu agenta sprawdź jego prompt i ustawienia, a następnie samodzielnie zaznacz narzędzia, z których ma korzystać.

## Nazwane warianty promptu

Jeden agent może przechowywać kilka wariantów promptu. Odpowiada za to funkcja **Named prompt options** (nazwane warianty promptu). Dzięki temu czat wybiera jeden wariant, bez edytowania agenta w całej aplikacji.

Jak dodać wariant:

1. W sekcji **Prompt Template** znajdź **Named prompt options**.
2. Kliknij przycisk **Add option**.
3. Nadaj wariantowi nazwę i krótki opis.
4. Wpisz pełną treść promptu dla tego wariantu.

Kiedy ktoś doda twojego agenta do czatu, zobaczy listę rozwijaną **Prompt Mode** z nazwanymi wariantami. Bez nich menu czatu pokazuje tylko prompt domyślny.

## Inne ustawienia do dopasowania

Własni agenci mają część ustawień wspólnych z agentami wbudowanymi:

- **Connection Override**: wybierz dla tego agenta inne połączenie z AI. Na przykład tańszy model do pracy w tle. Zostaw pole puste, żeby korzystał z połączenia czatu.
- **Agent Budget**: ustaw **Context Size** (ile ostatnich wiadomości agent czyta, domyślnie 5). Ustaw też **Max Output Tokens** (miejsce zarezerwowane na wynik, domyślnie 4096, w zakresie od 128 do 32768).
- **Add as Prompt Section**: włącz to ustawienie, żeby najnowszy wynik agenta stał się sekcją, którą da się wstawić w presecie promptu.

Makra takie jak `{{user}}` i `{{char}}` działają w sekcji **Prompt Template**. Pełną listę znajdziesz w przewodniku [Makra](../prompts/macros.md).

## Przykład krok po kroku

Oto kompletny własny agent, który przepisuje każdą odpowiedź na brytyjską odmianę angielskiego.

Konfiguracja w edytorze:

1. Nazwij go `British English Editor`.
2. W sekcji **Custom Agent Abilities** włącz uprawnienie **Edit messages**.
3. W sekcji **Result Type** wybierz **Text Rewrite**. Faza sama przełącza się na **Post-Processing**.
4. Wklej to do sekcji **Prompt Template**:

```
You are a copy editor. Rewrite the latest reply into British English.
Change spelling and vocabulary only. Do not change the meaning, tone, or events.
Return JSON with an "editedText" field holding the full rewritten reply,
and a "changes" array of short notes describing what you changed.
```

5. Kliknij przycisk **Save**.
6. Otwórz czat w trybie Roleplay, przejdź do panelu **Chat Settings**, włącz przełącznik **Enable Agents** i dodaj agenta `British English Editor` z sekcji **Custom Agents**.

Po każdej odpowiedzi agent zwraca JSON w takiej postaci:

```
{"editedText":"The colour of the harbour caught her eye.","changes":[{"description":"color to colour, harbor to harbour"}]}
```

Marinara odczytuje pole `editedText` i podstawia je w odpowiedzi. Wiadomość pojawia się w brytyjskiej odmianie angielskiego. Notatki z pola `changes` widać jako krótkie podsumowanie tego, co agent poprawił.

## Import i eksport agentów

Własnego agenta da się udostępnić jako plik.

Żeby wyeksportować agenta z edytora, kliknij przycisk **Export agent** (ikona wgrywania) na górnym pasku. Zapisuje on prompt i konfigurację agenta jako pakiet. Pakiety agentów nigdy nie zawierają definicji własnych narzędzi.

Żeby wyeksportować kilku agentów naraz, użyj opcji **Select agents** w panelu **Agents**, zaznacz wybranych agentów i wyeksportuj całą grupę.

Import zewnętrznych agentów jest domyślnie zablokowany. Otwórz **Settings → Advanced → Danger Zone** i najpierw włącz opcję **Allow custom Agent imports**. Ten przełącznik nie wymaga zmian w pliku `.env`. Dotyczy wyłącznie agentów dostarczanych przez pliki, foldery lub własne repozytoria: agenci utworzeni przez ciebie w aplikacji Marinara Engine oraz oficjalni agenci zainstalowani przez **Download Agents** działają normalnie.

Żeby zaimportować agenta, otwórz panel **Agents** i kliknij przycisk **Import agents** dla pojedynczego pliku albo **Import agent folder**, żeby wskazać cały folder. Marinara pokazuje przegląd uprawnień, zanim cokolwiek zapisze. Zatwierdź tylko te uprawnienia, których agent naprawdę potrzebuje – niezaznaczone pozostają zablokowane. Każdy import pliku dostaje nową, własną tożsamość, więc nie zastąpi agenta z katalogu o tym samym typie wewnętrznym.

Dla bezpieczeństwa Marinara pomija dołączone funkcje, czyści zaznaczenia narzędzi z importowanych ustawień, oczyszcza tymczasowy kod CSS przed jego zastosowaniem i sprawdza zatwierdzone uprawnienia, zanim zaimportowany agent zmieni wiadomości, trackery, lorebooki, tła, sprite'y, multimedia, urządzenia haptyczne, dane About Me, prompty czy wygenerowane obrazy. Zaufane funkcje importuj osobno z sekcji **Function Calls**, przejrzyj je i dopiero potem świadomie podłącz do agenta. Ponowne wyłączenie przełącznika w sekcji Danger Zone blokuje uruchamianie agentów zaimportowanych z zewnątrz; agentów utworzonych lokalnie i oficjalnych to nie dotyczy.

## Powiązane przewodniki

- [Agenci: pomocnicy AI w czatach](agents-overview.md)
- [Agenci do pobrania: przegląd pakietów](built-in-agents.md)
- [Własne narzędzia](../extending/custom-tools.md)
- [Makra](../prompts/macros.md)
