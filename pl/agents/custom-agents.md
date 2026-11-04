# Tworzenie własnych agentów

Własny agent to pomocnik, którego piszesz samodzielnie: ustalasz jego instrukcje, to, kiedy działa, i to, co może zmieniać. Zbuduj go, gdy żaden [agent do pobrania](built-in-agents.md) nie robi tego, czego potrzebujesz. Jeśli któryś z zainstalowanych agentów jest blisko celu, najedź na jego kafelek w panelu **Agents** (Agenci) i kliknij **Copy agent** (kopiowanie agenta), żeby dostać kopię, którą da się edytować.

Zanim zaczniesz: przeczytaj przewodnik [Agenci: pomocnicy AI w czatach](agents-overview.md). Zbudowanie agenta nie uruchamia go. Do czatu dodaje się go dopiero potem. Własni agenci działają w każdym trybie czatu.

## Tworzenie własnego agenta

1. Otwórz panel **Agents**.
2. Kliknij **New** (nowy, ikona plusa) u góry. Otwiera się pełnoekranowy edytor agenta.
3. Wpisz nazwę w polu tytułu, na przykład `Weather Reporter`.
4. Uzupełnij pola **Description** (opis) i **Author** (autor).
5. Wybierz fazę w sekcji **Pipeline Phase** (faza potoku). Szczegóły: [Pipeline Phase](#pipeline-phase).
6. Włącz potrzebne uprawnienia w sekcji **Custom Agent Abilities** (uprawnienia własnego agenta).
7. Wybierz w sekcji **Result Type** (typ wyniku) typ pasujący do tego, co agent wytwarza. Jeśli nie masz pewności, wybierz **Context Injection**. Nie wymaga on żadnego uprawnienia ani ścisłego formatu wyniku.
8. Napisz instrukcje agenta w sekcji **Prompt Template** (szablon promptu).
9. Kliknij **Save** (zapis) na górnym pasku. Pojawia się zielona plakietka **Saved**.

Agent pojawia się teraz w sekcji **Custom Agents** (agenci własni) panelu **Agents**. Żeby go użyć, otwórz czat, przejdź do **Chat Settings** (ustawienia czatu), włącz **Enable Agents** (włączenie agentów) i dodaj agenta z sekcji **Custom Agents**.

## Pipeline Phase

**Pipeline Phase** ustala, kiedy agent się uruchamia.

- **Pre-Generation**: przed odpowiedzią. Może dodać kontekst albo zmienić prompt.
- **Parallel**: równocześnie z odpowiedzią. Nie widzi gotowej odpowiedzi.
- **Post-Processing**: po odpowiedzi. Może przeczytać odpowiedź, a przy części typów wyniku także ją edytować.

Niektóre typy wyniku wymuszają fazę. **Text Rewrite** przełącza ją na **Post-Processing**. **Prompt Patch** i **Character Activity** przełączają ją na **Pre-Generation**.

Agenci w fazie Post-Processing dostają też sekcję **Turn Data Access** (dostęp do danych tury) z dwoma przełącznikami: **Pre-generation injections** i **Parallel agent results**. Włącz je, żeby agent mógł czytać to, co inni agenci wytworzyli w tej samej turze.

## Custom Agent Abilities

Uprawnienia to możliwości, które włącza się samodzielnie. Każde z nich pozostaje zablokowane, dopóki nie włączysz jego przełącznika.

- **Create lorebooks**: tworzy nowy lorebook agenta, gdy jego wynik z wiedzą o świecie nie ma wskazanego celu.
- **Edit lorebooks**: zapisuje wpisy w lorebooku albo zwraca wyniki aktualizujące lorebook.
- **Edit messages**: zastępuje wygenerowany tekst wiadomości albo dopisuje do niego propozycje dalszego ciągu.
- **Edit trackers**: aktualizuje stan trackera gry, postaci, persony lub trackera własnego.
- **Frontend styling**: nakłada tymczasowy styl wizualny na czas generowania.
- **Change chat backgrounds**: zmienia i zapisuje tło czatu.
- **Change character sprites**: zmienia wyrazy twarzy postaci i persony pokazywane na czacie.
- **Control media playback**: steruje usługą Spotify, serwisem YouTube albo muzyką lokalną.
- **Control haptic devices**: wysyła ograniczone komendy do podłączonego urządzenia haptycznego.
- **Edit About Me details**: zmienia tekst About Me przypisany do konkretnego czatu. Zmiany w publicznej karcie nadal wymagają twojej zgody.
- **Image generation**: wysyła prompt obrazu do generatora obrazów.
- **Vectors/embeddings**: korzysta z kontekstu wektorowego. Wektory pozwalają aplikacji Marinara wyszukiwać tekst według znaczenia.
- **Main prompt edits**: edytuje prompt wysyłany do głównego modelu.
- **Create character cards**: proponuje nową kartę postaci. Zapisuje się ona dopiero po tym, jak ją przejrzysz i zaakceptujesz.
- **Choose active chat characters**: wybiera, które dołączone postacie są włączone w bieżącej odpowiedzi w trybie Conversation lub Roleplay.

Po włączeniu **Edit lorebooks** pojawia się sekcja **Lorebook Writer**. Włącz w niej **Allow lorebook entry writes** i wskaż jeden lorebook w polu **Target lorebook**. Agent może pisać tylko do tego lorebooka.

## Result Type

**Result Type** mówi aplikacji Marinara, jak odczytać odpowiedź agenta. Większość typów oczekuje formatu JSON, czyli formatu tekstowego zapisywanego za pomocą nawiasów klamrowych i cudzysłowów. Typ pozostaje wyszarzony, dopóki nie włączysz uprawnienia, którego potrzebuje.

Typy, które nie wymagają żadnego uprawnienia:

- **Context Injection**: dodaje tekst przed generowaniem albo zapisuje notatkę po nim. Od niego najłatwiej zacząć.

Typy wymagające uprawnienia **Edit messages**:

- **Text Rewrite**: zastępuje tekst wiadomości po odpowiedzi.
- **Interactive Choices**: dopisuje do wiadomości propozycje dalszego ciągu.

Typy wymagające uprawnienia **Edit trackers**:

- **Character Tracker**: aktualizuje postacie obecne w scenie.
- **Persona Stats**: aktualizuje statystyki, status i ekwipunek persony.
- **Custom Tracker**: zastępuje pola twojego własnego trackera.
- **Game State**: aktualizuje dane gry w rodzaju stanu świata.

Pozostałe typy, każdy z własnym uprawnieniem:

- **Lorebook Update** (Edit lorebooks): tworzy lub aktualizuje wpisy w lorebooku.
- **Image Prompt** (Image generation): prosi generator obrazów o narysowanie sceny.
- **Prompt Patch** (Main prompt edits): dodaje sekcje promptu, wstawia je na początku albo je zastępuje.
- **Frontend Style** (Frontend styling): nakłada tymczasowy efekt stylu.
- **Background Change** (Change chat backgrounds): wybiera i zapisuje jedno z dostępnych teł.
- **Sprite Change** (Change character sprites): zmienia wyrazy twarzy pokazywane na czacie.
- **Spotify Control**, **YouTube Control**, **Local Music Control** (Control media playback): sterują odtwarzaniem.
- **Haptic Command** (Control haptic devices): wysyła ograniczoną komendę do urządzenia haptycznego.
- **About Me Update** (Edit About Me details): aktualizuje tekst About Me przypisany do czatu i proponuje zmiany publiczne.
- **Character Card Creation** (Create character cards): proponuje jedną edytowalną kartę postaci do twojego zatwierdzenia.
- **Character Activity** (Choose active chat characters): wybiera karty postaci używane w bieżącej odpowiedzi. Działa przed odpowiedzią i musi wybrać co najmniej jedną dołączoną postać.

### Ustawienia agentów obrazowych w czacie

Agent z uprawnieniem **Image generation** dostaje dwie dodatkowe kontrolki w **Chat Settings → Agents → Custom Agents**.

- **Image model** (model obrazów): zastępuje połączenie obrazowe tego agenta tylko w tym czacie. Zostaw **Agent default** (ustawienie domyślne agenta), żeby zachować własne ustawienie agenta. Ustawienie **Image Style** (styl obrazu) czatu dotyczy też obrazów własnych agentów.
- **Camera button** (przycisk aparatu): od razu tworzy obraz, bez czekania na słowa kluczowe, które aktywują agenta. Jeśli szablon agenta odmówi napisania promptu, zamiast obrazu pojawi się powiadomienie o błędzie.

## Activation Keywords

Domyślnie agent działa w swoim zwykłym rytmie (czyli tak często, jak zwykle się uruchamia). Sekcja **Activation Keywords** (słowa wyzwalające) pozwala go pomijać, dopóki scena nie jest istotna, co oszczędza tokeny.

1. W sekcji **Activation Keywords** wpisz jedno słowo kluczowe lub wyrażenie w każdej linii, na przykład `tavern` albo `secret door`.
2. W polu **Scan Depth** (głębokość skanowania) ustaw liczbę ostatnich wiadomości do przeszukania. Domyślnie jest to 5, a maksymalnie 200.

Agent uruchamia się wtedy tylko, gdy w tych wiadomościach pojawi się słowo kluczowe. Zostaw pole puste, żeby wyłączyć filtr. Częstotliwość i ewentualne pytanie aktywacyjne nadal obowiązują.

## Podłączanie narzędzi

Agent może wywoływać narzędzia: funkcje, które AI uruchamia, żeby coś pobrać lub zmienić, a potem odczytuje ich wynik. Nazywa się to też wywoływaniem funkcji (function calling).

1. W edytorze agenta otwórz **Tools / Function Calling** (narzędzia i wywoływanie funkcji) i włącz każde narzędzie, którego chcesz używać. Na liście są narzędzia wbudowane i twoje własne. Jak zbudować własne, opisuje przewodnik [Własne narzędzia](../extending/custom-tools.md).
2. W **Chat Settings** otwórz **Function Calling** (wywoływanie funkcji) i włącz **Enable Tool Use** (zezwolenie na korzystanie z narzędzi). Bez tego narzędzia agenta pozostają wyłączone.

Zaimportowani agenci nigdy nie dostają dostępu do narzędzi. Przejrzyj zaimportowanego agenta, a potem samodzielnie wybierz jego narzędzia.

Agent dostaje najwyżej 16 rund wywołań narzędzi w jednym przebiegu (mniej, jeśli `MAX_TOOL_ROUNDS` na serwerze ma niższą wartość), a potem odpowiada na podstawie tego, co ma. Model, który wywołuje jedno narzędzie naraz, zużywa rundę na każde wywołanie, więc agent zapisujący wiele wpisów powinien wykonywać kilka wywołań w jednej odpowiedzi. Przebieg wstecznego uzupełniania lorebooka dostaje do 64 rund.

## Nazwane warianty promptu

Agent może przechowywać kilka wariantów promptu, dzięki czemu każdy czat może wybrać jeden z nich bez edytowania agenta.

1. W sekcji **Prompt Template** znajdź **Named prompt options** (nazwane warianty promptu).
2. Kliknij **Add option** (dodanie opcji).
3. Nadaj wariantowi nazwę i krótki opis, a potem napisz jego pełny prompt.

Gdy ktoś doda agenta do czatu, lista rozwijana **Prompt Mode** (tryb promptu) pokazuje twoje warianty. Bez nich widać tylko prompt domyślny.

## Inne ustawienia

- **Model override** (zastąpienie modelu): używa dla tego agenta innego modelu, na przykład tańszego. Zostaw puste, żeby agent korzystał z modelu czatu. Agent wysyła parametry generowania zapisane w tym połączeniu. Zobacz [Parametry agentów](../prompts/generation-parameters.md#parameters-for-agents).
- **Agent Budget** (budżet agenta): **Context Size** (rozmiar kontekstu) to liczba ostatnich wiadomości, które agent czyta (domyślnie 5). **Max Output Tokens** (maksymalna liczba tokenów wyniku) to miejsce zarezerwowane na wynik (domyślnie 4096, od 128 do 32768).
- **Add as Prompt Section** (dodanie jako sekcji promptu): udostępnia najnowszy wynik agenta jako sekcję, którą da się umieścić w presecie promptu.

W **Prompt Template** działają makra, takie jak `{{user}}` i `{{char}}`. Zobacz [Makra](../prompts/macros.md).

## Przykład krok po kroku

Ten agent przepisuje każdą odpowiedź na brytyjską odmianę angielskiego.

1. Nazwij go `British English Editor`.
2. W sekcji **Custom Agent Abilities** włącz **Edit messages**.
3. W sekcji **Result Type** wybierz **Text Rewrite**. Faza przełącza się na **Post-Processing**.
4. Wklej to do **Prompt Template**:

   ```text
   You are a copy editor. Rewrite the latest reply into British English.
   Change spelling and vocabulary only. Do not change the meaning, tone, or events.
   Return JSON with an "editedText" field holding the full rewritten reply,
   and a "changes" array of short notes describing what you changed.
   ```

5. Kliknij **Save**.
6. Otwórz czat w trybie Roleplay, włącz **Enable Agents** w **Chat Settings** i dodaj agenta z sekcji **Custom Agents**.

Po każdej odpowiedzi agent zwraca JSON w takiej postaci:

```json
{"editedText":"The colour of the harbour caught her eye.","changes":[{"description":"color to colour, harbor to harbour"}]}
```

Marinara podstawia `editedText` w odpowiedzi. Notatki z `changes` są widoczne jako krótkie podsumowanie.

## Import i eksport agentów

Żeby wyeksportować jednego agenta, kliknij **Export agent** (eksport agenta, ikona wgrywania) na górnym pasku edytora. Plik zawiera prompt i ustawienia agenta, ale nigdy definicji własnych narzędzi. Żeby wyeksportować kilku, użyj **Select agents** (zaznaczanie agentów) w panelu **Agents**, zaznacz ich i wyeksportuj.

Import z zewnątrz jest domyślnie zablokowany.

1. Otwórz **Settings → Advanced → Danger Zone** (ustawienia, zaawansowane, strefa zagrożenia) i włącz **Allow custom Agent imports** (zezwolenie na import własnych agentów). Zmiana w pliku `.env` nie jest potrzebna.
2. W panelu **Agents** kliknij **Import agents** (import agentów) i wybierz pliki agentów albo folder.
3. Przejrzyj listę uprawnień, którą pokazuje Marinara. Zatwierdź tylko to, czego agent potrzebuje. Niezaznaczone uprawnienia pozostają zablokowane.

Ta blokada dotyczy tylko agentów z plików, folderów lub własnych repozytoriów. Agenci utworzeni przez ciebie i oficjalni agenci z katalogu **Agent Organizer** (organizowanie agentów) działają normalnie. Każdy zaimportowany plik dostaje nową, własną tożsamość, więc nie może zastąpić oficjalnego agenta.

Dla bezpieczeństwa Marinara pomija dołączone funkcje, czyści wybór narzędzi, oczyszcza tymczasowy kod CSS i sprawdza zatwierdzone uprawnienia, zanim zaimportowany agent będzie mógł zmienić wiadomości, trackery, lorebooki, tła, sprite'y, multimedia, urządzenia haptyczne, dane About Me, prompty lub obrazy. Zaufane funkcje importuj osobno, przejrzyj je i samodzielnie podłącz do agenta. Wyłączenie przełącznika w **Danger Zone** powstrzymuje zaimportowanych agentów przed uruchamianiem.

<a id="activation-questions"></a>

## Pytania aktywacyjne

Pytanie aktywacyjne sprawdza, czy ostatnia scena potrzebuje twojego agenta. Wychwytuje parafrazy, które umykają słowom kluczowym. Wymaga ustawienia **Decision model** (model decyzyjny), czyli małego modelu, który odpowiada na pytania typu tak lub nie. Wybierz go w panelu Connections. Zobacz [Modele decyzyjne](../connections/decision-models.md). Gdy **Decision model** ma domyślną wartość **None** (brak), pola pytania pozostają wyłączone, a agent z pytaniem działa tak, jakby go nie miał.

1. Otwórz własnego agenta.
2. Wpisz **Question** (pytanie) o długości do 500 znaków. Działają w nim makra `{{user}}` i `{{char}}`.
3. Ustaw **Run when probability is at least** (uruchom przy prawdopodobieństwie co najmniej) na próg dla tego agenta. Agent uruchamia się, gdy prawdopodobieństwo odpowiedzi "tak" osiąga ten próg, więc wyższe wartości pomijają więcej uruchomień. Edytor pokazuje wartość zalecaną dla twojego modelu: 0,5 dla lokalnych modeli czatu i kont Decision albo 0,1 dla wbudowanych modeli Open-Jev. Sprawdź ją na własnych czatach po zmianie modelu. Zobacz [Progi](../connections/decision-models.md#thresholds).
4. Opcjonalnie: ustaw **Bypass the question after this many messages without a successful run** (pomiń pytanie po tylu wiadomościach bez udanego uruchomienia). Po tylu wiadomościach pytanie jest pomijane, więc model, który ciągle odpowiada "nie", nie wyciszy agenta na dobre. Słowa kluczowe i częstotliwość nadal obowiązują.

Napisz pytanie jako stwierdzenie o ostatniej wiadomości, na przykład `The latest message moves the scene to a new place.` Mały model oceniał je trafniej niż `Did the scene change?` Zobacz [Pisanie stwierdzeń](../prompts/conditional-prompts.md#writing-statements).

Jak to działa:

- Słowa kluczowe i częstotliwość są sprawdzane najpierw, więc pominięty agent nie kosztuje żadnego żądania decyzyjnego. Pytania o tej samej głębokości skanowania są grupowane w każdej fazie.
- **Scan Depth** ustala wiadomości używane zarówno przez słowa kluczowe, jak i przez pytanie.
- Agenci w fazie Pre-Generation i Parallel korzystają z czatu sprzed odpowiedzi. Agenci w fazie Post-Processing widzą też gotową odpowiedź.
- Przekroczenie czasu, niedostępny model lub nieprawidłowa odpowiedź pozwalają agentowi działać normalnie. Limit czasu zależy od rodzaju modelu i od tego, czy model musi najpierw rozumować. Zobacz [Limity czasu](../connections/decision-models.md#time-limits).
- Zaimportowani agenci z pytaniem aktywacyjnym lub stwierdzeniami decyzyjnymi pokazują informację z linkiem do przewodnika o modelach decyzyjnych. Bez modelu decyzyjnego agent uruchamia się zawsze, gdy pozwalają na to słowa kluczowe i **Trigger Cadence** (częstotliwość uruchamiania), a stwierdzenia w prompcie są odczytywane jako nie.

Pytania aktywacyjne dotyczą wyłącznie własnych agentów.

<a id="decision-statements-in-the-agents-prompt"></a>

## Stwierdzenia decyzyjne w prompcie agenta

Pytanie aktywacyjne decyduje, czy agent się uruchomi. Stwierdzenie decyzyjne w **Prompt Template** decyduje, jakie instrukcje dostanie uruchomiony agent. Składnię opisuje przewodnik [Prompty warunkowe](../prompts/conditional-prompts.md#asking-the-decision-model):

```text
{{#if decision:"In the latest message, the characters move to a different location"}}
Update the location field.
{{else}}
Leave the location as it is.
{{/if}}
```

Dzięki nim w spokojnych turach wysyłasz mniejszy prompt. Tracker może aktualizować miejsce tylko wtedy, gdy się zmieniło. Agent obrazowy może opisać nowy obraz tylko wtedy, gdy zmieniła się scena. Agent muzyczny może zmienić utwór tylko wtedy, gdy zmienił się nastrój. Żeby wybrać jeden z kilku zestawów instrukcji, użyj `{{#if decision_choice:"The kind of scene in the latest message" == "combat"}}`, potem `{{else if decision_choice:"The kind of scene in the latest message" == "dialogue"}}` i tak dalej. Zobacz [Prompty warunkowe](../prompts/conditional-prompts.md#asking-the-decision-model).

- Agenci w fazie Pre-Generation i Parallel czytają czat sprzed odpowiedzi i współdzielą odpowiedzi z głównym promptem. Agenci w fazie Post-Processing czytają gotową odpowiedź, a ich stwierdzenia są zadawane ponownie z jej udziałem.
- Ponowne uruchomienie agenta wykorzystuje udane odpowiedzi, które nadal są w pamięci podręcznej dla tej samej tury, modelu i stwierdzeń. Zobacz [Ponowne używanie odpowiedzi](../prompts/conditional-prompts.md#answer-reuse).
- W prompcie agenta `{{char}}` oznacza wszystkie postacie w czacie, więc w grupie `{{char}} is angry` staje się "Kaelen, Alyssa is angry". Podaj imię postaci albo napisz "a character".
- Bez odpowiedzi stwierdzenie oznacza nie. Zadbaj, żeby gałąź `{{else}}` miała sens, bo wielu użytkowników nie ma modelu decyzyjnego.

Agenci zainstalowani z repozytorium Marinara-Agents renderują prompty tak samo.

## Powiązane przewodniki

- [Agenci: pomocnicy AI w czatach](agents-overview.md)
- [Modele decyzyjne](../connections/decision-models.md)
- [Agenci do pobrania: przegląd pakietów](built-in-agents.md)
- [Własne narzędzia](../extending/custom-tools.md)
- [Makra](../prompts/macros.md)
