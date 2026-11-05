# Prompty warunkowe ({{#if}})

Blok `{{#if}}` dołącza fragment promptu (tekstu, który Marinara wysyła do AI) tylko wtedy, gdy warunek jest spełniony. Dzięki niemu jeden wspólny preset może dawać różne instrukcje różnym postaciom, personom lub czatom albo pomijać puste pole. Warunki są częścią systemu makr, więc działają wszędzie tam, gdzie działają [makra](macros.md): w kartach postaci, personach, wpisach lorebooków i presetach.

Marinara sprawdza warunek przy każdym budowaniu promptu, zostawia pasujący tekst, a resztę odrzuca. To funkcja zaawansowana i większość czatów nigdy jej nie potrzebuje.

## Podstawowa składnia

Blok zaczyna się od `{{#if condition}}`, a kończy na `{{/if}}`. Dodaj `{{else}}` dla przypadku niespełnionego warunku, a `{{else if}}`, żeby dopisać kolejne warunki. Marinara sprawdza gałęzie od góry do dołu i zostawia pierwszą spełnioną. Jeśli żadna nie jest spełniona i nie ma `{{else}}`, blok znika bez śladu.

```text
{{#if length == "short"}}
Keep your reply to one or two sentences.
{{else if length == "long"}}
Write a detailed, multi-paragraph reply.
{{else}}
Write a reply of normal length.
{{/if}}
```

Blok może zmieścić się w jednej linii albo zająć kilka, a bloki można zagnieżdżać.

## Operatory

Warunek to zwykle wartość po lewej, operator i wartość po prawej, na przykład `char == "Alice"`.

| Operator | Znaczenie |
| --- | --- |
| `==`, `=`, `is` | Równe. |
| `!=`, `is not` | Różne. |
| `>`, `<`, `>=`, `<=` | Większe, mniejsze, większe lub równe, mniejsze lub równe (tylko liczby). |
| `contains`, `includes` | Wartość po lewej zawiera wartość po prawej jako tekst. |
| `not contains`, `not includes` | Wartość po lewej nie zawiera wartości po prawej. |

Reguły porównywania:

1. Przy operatorach równości Marinara porównuje obie strony jak liczby, o ile obie wyglądają na liczby, więc `5` równa się `5.0`. W przeciwnym razie porównuje tekst bez rozróżniania wielkości liter, więc `Mari` równa się `mari`.
2. Przy `>`, `<`, `>=` i `<=` obie strony muszą być liczbami. W przeciwnym razie warunek jest fałszywy.
3. `contains` i `includes` nie rozróżniają wielkości liter, więc `contains "dr"` pasuje do `Dr Smith`.

### Łączenie warunków

Użyj `||` jako OR, a `&&` jako AND. `&&` liczy się przed `||`. Kolejność ustalisz nawiasami.

```text
{{#if character == "Maukie" || character == "Pantalone"}}
Use the shared instructions.
{{/if}}

{{#if (character == "Maukie" || character == "Pantalone") && scenario contains "lake"}}
Use the lakeside instructions for either character.
{{/if}}
```

Gdy jedna wartość ma pasować do jednej z kilku możliwości, powtórzoną lewą stronę da się pominąć: `character == "Maukie" || "Pantalone"`. Działa to z `==`, `=` i `is`. Po obu stronach `&&` zapisuj pełne warunki.

### Sprawdzenie prawdziwości

Warunek bez operatora jest prawdziwy, gdy wartość ma konkretną treść. Jest fałszywy, gdy wartość jest pusta albo jest jednym ze słów `false`, `0`, `no`, `off`, `null` lub `undefined`, bez względu na wielkość liter.

```text
{{#if scenario}}
Current scene: {{scenario}}
{{else}}
No specific scene is set.
{{/if}}
```

### Co można porównywać

Każda strona warunku może być:

1. Słowem kluczowym pola lub tożsamości, na przykład `char`, `user`, `group`, `persona`, `description`, `personality`, `scenario`, `input`, `model` albo `reasoning`. Odczytują one te same wartości co odpowiadające im makra. `group` wymienia pozostałe aktywne postacie, bez tej, która właśnie odpowiada.
2. Wartością w cudzysłowie, na przykład `"Alice"`.
3. Nazwą zmiennej presetu, na przykład `length`. Zobacz [Zmienne presetu](preset-variables.md).
4. Jawnym odwołaniem do zmiennej, zapisanym jako `var:name` albo `var.name`.
5. Innym makrem, które rozwija się najpierw.
6. Pytaniem do modelu decyzyjnego: `decision:"..."` albo `decision_choice:"..."`. Zobacz [Pytanie modelu decyzyjnego](#asking-the-decision-model).

Gołe słowo, które nie jest słowem kluczowym, Marinara bierze za nazwę zmiennej. Jeśli żadna zmienna nie ma takiej nazwy, słowo zostaje potraktowane jako zwykły tekst. Ujmuj stałe wartości w cudzysłów, żeby uniknąć niejasności.

### Cudzysłowy

Stały tekst ujmij w prosty cudzysłów podwójny albo pojedynczy. Wewnątrz wartości w cudzysłowie znak cudzysłowu poprzedź ukośnikiem wstecznym, a nową linię zapisz jako `\n`. Wartość ze spacją, taką jak `"Dr Smith"`, zawsze ujmuj w cudzysłów. Kilka słów bez cudzysłowu Marinara czyta jako jedną nazwę zmiennej.

## Bloki grupowe dla wielu postaci

W czacie grupowym z dwiema postaciami lub większą ich liczbą blok grupowy powtarza swój tekst raz dla każdej postaci. Wstaw samotny znak `[` w osobnej linii, potem tekst, a potem samotny znak `]` w osobnej linii. Blok musi zawierać makro postaci, na przykład `{{char}}` albo `{{description}}`, albo warunek oparty na postaci.

```text
[
{{char}}'s current attitude:
{{#if char == "Alice"}}cheerful and open{{else}}guarded and quiet{{/if}}
]
```

Przy postaciach Alice i Bob blok wykonuje się dwa razy, raz dla każdej z nich. Poza blokiem grupowym makro postaci rozwija się wyłącznie względem bieżącej lub głównej postaci. W czacie z jedną postacią linie `[` i `]` zostają zwykłym tekstem.

## Przykłady

Ton zależny od postaci:

```text
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{else}}
Speak warmly and casually.
{{/if}}
```

Dołączenie pola tylko wtedy, gdy jest wypełnione. Gdy pole **Backstory** (historia postaci) jest puste, blok znika bez śladu, więc pusta etykieta nigdzie nie trafia.

```text
{{#if backstory}}
Backstory to remember: {{backstory}}
{{/if}}
```

Instrukcje dla jednej rodziny modeli. `model` to identyfikator modelu, na przykład `claude-opus-5-5`, więc `contains` pasuje do każdej wersji modelu Opus, a `==` do jednego konkretnego modelu.

```text
{{#if model contains "opus"}}
Keep replies under 400 words.
{{/if}}
```

Instrukcje planowania zależne od myślenia. Gdy rozumowanie jest włączone na dowolnym poziomie, model dostaje pierwszą linię. Gdy jest wyłączone, `{{reasoning}}` ma wartość `off`, którą czyta się jako fałsz. Aby zareagować na jeden poziom, porównaj go, jak w `{{#if reasoning == "max"}}`.

```text
{{#if reasoning}}
Plan the reply in your thinking before you write it.
{{else}}
Before replying, write your plan inside <plan></plan> tags.
{{/if}}
```

<a id="asking-the-decision-model"></a>

## Pytanie modelu decyzyjnego

Warunek może zapytać model decyzyjny o to, co dzieje się na czacie. Model decyzyjny to mały model, który czyta kilka ostatnich wiadomości i napisane przez ciebie stwierdzenie, po czym ocenia, czy to stwierdzenie jest prawdziwe. Nigdy nie pisze niczego na czacie. Dzięki temu preset, karta, wpis lorebooka lub prompt agenta wysyła instrukcję tylko w tych turach, w których ma ona zastosowanie.

Zanim zaczniesz: wybierz model decyzyjny w **Decision model** (model decyzyjny) w panelu **Connections** (Połączenia). Czym on jest i jak go wybrać, wyjaśnia przewodnik [Modele decyzyjne](../connections/decision-models.md). Aby zdecydować, czy aktywuje się cały wpis lorebooka, użyj zamiast tego pola [Decision](../lorebooks/entries.md#decision-activation) wpisu.

Pomysły: opisz nowe miejsce tylko wtedy, gdy scena się przeniosła, dołączaj zasady tempa walki tylko podczas walki, wstrzymaj eskalację w presecie powolnego rozwoju relacji albo w bloku grupowym każ odpowiadać bezpośrednio tylko tej postaci, do której ktoś się zwrócił.

### Tak lub nie: `decision:`

```text
{{#if decision:"The latest message moves the scene to a new place"}}
Open your reply by describing the new location in one or two sentences.
{{/if}}
```

Warunek jest prawdziwy, gdy model decyzyjny uzna stwierdzenie za prawdziwe. Działa z `{{else}}`, `&&`, `||`, nawiasami, zagnieżdżaniem i blokami grupowymi. Makra w stwierdzeniu są rozwijane najpierw, więc `{{user}}` i `{{char}}` działają. W bloku grupowym stwierdzenie z `{{char}}` jest zadawane osobno dla każdej postaci.

### Jedna z kilku odpowiedzi: `decision_choice:`

`decision_choice:` prosi model o wybór jednej opcji. Opcjami są wartości, z którymi go porównujesz.

```text
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen's lines are short and clipped.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and looks away.
{{else}}
Kaelen is his usual self.
{{/if}}
```

Model wybiera między "angry", "sad" i "none of these". Napisz stwierdzenie jako temat, a opcje jako krótkie odpowiedzi. Krótka forma `== "rain" || "snow"` udostępnia obie opcje.

Żeby powiedzieć, co dana opcja oznacza w twojej historii, dopisz po niej kryteria, oddzielone dwukropkiem, z tym samym rodzajem cudzysłowu w obu częściach: `== "angry":"Kaelen raises his voice, makes threats or breaks something"`. Model nadal odpowiada "angry". Jeśli jedna opcja ma w kilku miejscach różne kryteria, używane są pierwsze.

<a id="sticky-and-cooldown"></a>

### Sticky i cooldown

Dopisz `sticky:` i `cooldown:` po stwierdzeniu, żeby zachować jego odpowiedź przez kilka tur, zamiast pytać w każdej turze.

```text
{{#if decision:"The latest message starts a fight" sticky:3 cooldown:5}}
Keep combat pacing rules in effect.
{{/if}}
```

- `sticky:N`: po odpowiedzi tak stwierdzenie pozostaje prawdziwe przez N tur bez pytania.
- `cooldown:N`: zaczyna się po zakończeniu sticky albo zaraz po odpowiedzi tak. Przez N tur stwierdzenie oznacza nie i nie jest zadawane.
- Tura to każda nowa wiadomość czytana przez model decyzyjny. Regeneracja lub swipe tej samej wiadomości to ta sama tura, więc ponowne losowanie nigdy nie skraca licznika.
- Zatrzymane stwierdzenie nie jest zadawane i nie liczy się do **Decision statements per turn** (stwierdzenia decyzyjne na turę).
- Dla `decision_choice:` sticky zachowuje wybraną opcję, a cooldown traktuje każde porównanie jako nie.
- Stwierdzenie zapisane w kilku miejscach używa najdłuższego sticky i cooldown.
- Peek Prompt pokazuje zachowaną odpowiedź i nigdy nie przesuwa licznika.

Dla wpisu lorebooka aktywowanego przez jego pole **Decision** (decyzja) użyj zamiast tego własnych ustawień **Sticky** (utrzymanie aktywności) i **Cooldown** (przerwa) wpisu.

<a id="until-and-while"></a>

### Until i while

Żeby blok pozostawał włączony tak długo, jak coś trwa, dopisz `until:` lub `while:` z drugim stwierdzeniem.

```text
{{#if decision:"A fight starts in the latest message" until:"The fight ends in the latest message"}}
Keep combat pacing rules in effect.
{{/if}}
```

- Po odpowiedzi tak blok pozostaje włączony. Pierwsze stwierdzenie nie jest zadawane. Zamiast niego w każdej turze zadawane jest stwierdzenie `until`, a blok wyłącza się w turze, w której jest ono prawdziwe.
- `while:` działa odwrotnie: blok pozostaje włączony, dopóki jego stwierdzenie jest prawdziwe, i wyłącza się, gdy jest ono fałszywe.
- Użyj jednego albo drugiego. Jeśli zapisano oba, liczy się tylko pierwszy.
- Gdy blok się wyłączy, jak zwykle zaczyna się cooldown. Jeśli w danej turze nie ma odpowiedzi, blok pozostaje włączony.
- Stwierdzenie `until` lub `while` liczy się do **Decision statements per turn**. Pierwsze stwierdzenie nie liczy się, dopóki blok jest włączony.
- Działa to z `decision:`, ale nie z `decision_choice:`.

Przy **sticky** dopisz `:and` (także `:restrict`) lub `:or` (także `:extend`) po drugim stwierdzeniu, żeby wybrać, jak oba się łączą.

| Zapis | Po odpowiedzi tak blok pozostaje włączony |
| --- | --- |
| `until:"..." sticky:5` lub `until:"...":and sticky:5` | Przez najwyżej 5 następnych tur i wyłącza się wcześniej, jeśli stwierdzenie until jest prawdziwe. |
| `until:"...":or sticky:5` | Przez co najmniej 5 następnych tur, a potem do chwili, gdy stwierdzenie until okaże się prawdziwe. |
| `while:"..." sticky:5` lub `while:"...":or sticky:5` | Przez co najmniej 5 następnych tur, a potem dopóki stwierdzenie while jest prawdziwe. |
| `while:"...":and sticky:5` | Przez najwyżej 5 następnych tur i wyłącza się wcześniej, jeśli stwierdzenie while jest fałszywe. |

<a id="checking-every-few-turns"></a>

### Sprawdzanie co kilka tur

Dopisz `every:N`, żeby zadawać stwierdzenie tylko co N tur.

```text
{{#if decision:"The weather changes in the latest message" every:3}}
Describe the new weather in a sentence.
{{/if}}
```

- Pytanie pada w pierwszej turze, w której aplikacja do niego dociera, następnie 3 tury później i tak dalej. Między sprawdzeniami stwierdzenie oznacza nie, nie jest zadawane i nie liczy się do **Decision statements per turn**.
- Regeneracja lub swipe nie przesuwa harmonogramu.
- Sticky i cooldown nadal zatrzymują odpowiedź. `every:` decyduje tylko o tym, kiedy zadawane jest stwierdzenie, którego nic nie zatrzymuje.
- Stwierdzenie zapisane w kilku miejscach używa najmniejszego `every:`.

<a id="priority"></a>

### Priorytet

Gdy plan promptu zawiera więcej stwierdzeń, niż pozwala limit **Decision statements per turn**, `priority:high` lub `priority:low` decyduje, które zostaną zadane. Brak priorytetu oznacza poziom średni.

```text
{{#if decision:"In the latest message, a character is badly hurt" priority:high}}...{{/if}}
{{#if decision:"The latest message mentions food" priority:low}}...{{/if}}
```

- Stwierdzenia o wysokim priorytecie są zadawane pierwsze, a o niskim ostatnie. Przy jednakowym priorytecie decyduje kolejność w prompcie.
- Stwierdzenia ponad limit oznaczają nie, począwszy od najniższego priorytetu, a Peek Prompt je wymienia.
- Stwierdzenie zapisane w kilku miejscach używa najwyższego priorytetu.
- Najpierw planowane są własne stwierdzenia promptu (preset, karty, persona, notatki autora). Stwierdzenia lorebooków wykorzystują miejsca, które zostały, niezależnie od priorytetu.

Wszystkie modyfikatory można łączyć w dowolnej kolejności: `decision:"..." priority:high sticky:3 cooldown:5 every:2`.

### Brak odpowiedzi oznacza nie

Warunek decyzyjny jest fałszywy zawsze, gdy nie ma odpowiedzi: model decyzyjny nie został wybrany, nie odpowiedział na czas albo zawiódł. Dla `decision_choice:` każde porównanie jest fałszywe. Uwzględnij to w projekcie.

- Używaj decyzji do dodawania lub przycinania wskazówek, nigdy do przenoszenia treści, od której zależy historia.
- Daj każdemu blokowi decyzyjnemu wartość domyślną: nic albo `{{else}}`, które pasuje do każdej tury.
- Nie łącz decyzji tak, by jedna błędna odpowiedź zmieniała kilka innych.
- Nie uzależniaj zgody, ostrzeżeń o treści ani instrukcji bezpieczeństwa od decyzji.

Każdy model może odpowiedzieć błędnie. Pisz dla "modelu decyzyjnego", a nie dla jednego produktu.

<a id="writing-statements"></a>

### Pisanie stwierdzeń

- Stwierdź fakt, który jest prawdziwy albo fałszywy, jak w raporcie. Nie zadawaj pytania ("Did the scene change?") i nie pisz instrukcji ("If the scene changed, describe it"). Małe modele często odpowiadają nie na instrukcję, więc blok nigdy się nie uruchamia.
- Napisz "in the latest message", gdy chodzi o bieżącą turę. Model czyta kilka wiadomości, a wcześniejsza z nich może sprawić, że odpowie tak.
- Wskaż, o kogo chodzi. "He is angry" można odnieść do niewłaściwej postaci.
- Opisz coś widocznego w tekście, na przykład działanie albo wypowiedź. Unikaj słów opisujących nastrój ("The scene is intense") i ukrytych intencji ("Mira is lying").
- Pisz krótko. Długie stwierdzenie podziel na części, jeśli chcesz używać ich ponownie albo je debugować.

Jak sprawdzić sformułowanie:

1. Wybierz model w **Decision model** i kliknij **Test** (test). To sprawdza połączenie na stałym przykładzie. Nie testuje twojego stwierdzenia.
2. Dodaj stwierdzenie do promptu i wyślij wiadomości, dla których powinno być prawdziwe, oraz takie, dla których powinno być fałszywe.
3. Użyj **Peek Prompt**, żeby zobaczyć, która gałąź została wysłana. Otwórz **Decision diagnostics** (diagnostyka decyzji), a potem wybierz **Test decisions** (testowanie decyzji), żeby otrzymać świeże odpowiedzi bez generowania odpowiedzi na czacie. Testy hostowane mogą kosztować. Zobacz [Testowanie stwierdzeń decyzyjnych](../chats/peek-prompt.md#testing-decision-statements).
4. Popraw sformułowanie i sprawdź ponownie. Żeby zobaczyć odpowiedzi z bieżących generowań, włącz Debug Mode albo [logowanie debug](../CONFIGURATION.md#logging-levels).

<a id="limits-and-cost"></a>

### Limity i koszty

<a id="statement-allowance"></a>

#### Limit stwierdzeń

**Decision statements per turn** w **Decision model** ma domyślną wartość 32. Nie jest to jeden limit wszystkich żądań Decision ani wydatków. Marinara stosuje go etapami.

1. Stwierdzenia głównego promptu czatu są planowane w ramach limitu. Decyzje lorebooka wykorzystują to, co zostanie.
2. Agenci działający przed odpowiedzią lub obok niej dostają wspólny plan z głównym promptem, znów w ramach limitu. Ten etap nie odejmuje tego, co wykorzystał lorebook, więc suma może przekroczyć ustawienie.
3. Agenci przetwarzania końcowego dostają osobny limit po odpowiedzi.

Pytania aktywacyjne agentów i Smart response order są oddzielne od tego ustawienia.

Do planu danego etapu wchodzą tylko stwierdzenia, których ten etap może użyć: włączone sekcje i grupy presetu, wybrane opcje zmiennych i treść aktywowanych wpisów lorebooka. Stały warunek może wykluczyć stwierdzenie, na przykład `{{#if char == "Dottore" && decision:"..."}}`, gdy postacią jest Mira. Warunek zmiennej tego nie robi, bo zmienne mogą się zmienić podczas budowania promptu. Stwierdzenia zatrzymane przez sticky, cooldown lub `every:` nie zajmują miejsca. Pominięte stwierdzenia oznaczają nie.

#### Żądania i czas

Przy hostowanym koncie Decision jedna tura może wysłać kilka płatnych żądań. Stwierdzenia można grupować, ale aktywacja lorebooka, treść nowo aktywowanych wpisów, dopasowania rekurencyjne i fazy agentów mogą wymagać kolejnych grup. Lokalny model czatu zamiast opłat dodaje czas przetwarzania i odpowiada na `decision_choice:` osobnym pytaniem tak/nie dla każdej opcji.

Każde żądanie ma limit czasu: domyślnie 1,5 sekundy dla hostowanego konta Decision albo 4 sekundy dla konta z modelem czatu zgodnym z OpenAI lub dla modelu lokalnego. Zobacz [Limity czasu](../connections/decision-models.md#time-limits). Lokalny model rozumujący wstrzymuje się przed odpowiedzią, chyba że włączysz **Also gate agents that run before the reply** (sprawdzaj także agentów działających przed odpowiedzią).

<a id="answer-reuse"></a>

#### Ponowne używanie odpowiedzi

Marinara zwykle ponownie używa udanych odpowiedzi dla tej samej tury i tego samego modelu decyzyjnego, więc regeneracja często wysyła te same gałęzie bez nowego żądania. Pamięć podręczna działa w uruchomionym serwerze i mieści do 200 tur. Restart, usunięcie z pamięci podręcznej, nowa lub edytowana najnowsza wiadomość, inny model albo zmienione stwierdzenie lub zestaw opcji mogą wymagać nowej odpowiedzi.

Brakujące lub nieudane odpowiedzi nie trafiają do pamięci podręcznej, więc ponowienie może zapytać znowu i wybrać inną gałąź. Stwierdzenia promptów agentów stosują te same zasady. Ręczne ponowne uruchomienie agenta używa odpowiedzi, które nadal są w pamięci podręcznej dla jego danych wejściowych. Zobacz [Stwierdzenia decyzyjne w prompcie agenta](../agents/custom-agents.md#decision-statements-in-the-agents-prompt).

<a id="prompt-caching"></a>

#### Pamięć podręczna promptu

Pamięć podręczna promptu u dostawcy jest oddzielna od pamięci podręcznej odpowiedzi w aplikacji Marinara. Może ponownie wykorzystać niezmieniony początek promptu wysyłanego do modelu czatu. Zmiana gałęzi decyzyjnej może zatrzymać ponowne użycie od tego miejsca dalej, choć wcześniejsza niezmieniona część nadal może się kwalifikować. Rozliczenia zależą od dostawcy.

Umieszczaj często zmieniające się bloki decyzyjne późno w prompcie, na przykład w instrukcjach po historii albo w płytkiej notatce autora. Decyzję blisko początku zostaw tylko wtedy, gdy jej odpowiedź rzadko się zmienia. Tak samo działają opcje zmiennych presetu, bo ich tekst trafia tam, gdzie występuje `{{name}}`.

Przy bezpośrednim koncie Anthropic z włączonym **Enable prompt caching** (włącz pamięć podręczną promptu) Marinara oznacza koniec promptu systemowego oraz wiadomość czatu oddaloną o **Cache depth** (głębokość pamięci podręcznej) wiadomości od najnowszej (domyślnie 5). Zmiana przed historią może unieważnić granicę systemową i późniejszą historię. Zmiana po oznaczonej granicy historii może zachować część z pamięci podręcznej. Minimalne długości pamięci podręcznej zależą od modelu. Zobacz aktualny [przewodnik Anthropic po pamięci podręcznej promptu](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) lub [przewodnik OpenAI po pamięci podręcznej promptu](https://developers.openai.com/api/docs/guides/prompt-caching).

<a id="when-a-decision-branch-never-appears"></a>

### Gdy gałąź decyzyjna nigdy się nie pojawia

Najbardziej prawdopodobne przyczyny, w kolejności:

1. Nie wybrano modelu decyzyjnego. Każdy warunek decyzyjny jest fałszywy. Edytor pokazuje ostrzeżenie pod każdym polem, które go używa.
2. Model decyzyjny nie odpowiada: błędny klucz, brak środków lub limit żądań na koncie hostowanym, model lokalny zatrzymany lub zbyt wolny albo zainstalowany model decyzyjny, który nie wystartował.
3. To model rozumujący, który wstrzymuje się przed odpowiedzią.
4. Zbyt wiele stwierdzeń na etapie planowania, ponad limit.
5. Odpowiada, ale poniżej swojego progu. Zwykle chodzi o sformułowanie.

Sprawdź, co zgłasza **Test**, i użyj **Peek Prompt**, żeby zobaczyć wysłane gałęzie. Peek Prompt wymienia stwierdzenia, które nie mają jeszcze odpowiedzi i oznaczają nie. Przy poziomie logowania debug każde stwierdzenie, jego odpowiedź i to, czy odczytano ją jako tak, trafiają do logów. Zobacz [Poziomy logowania](../CONFIGURATION.md#logging-levels). Problem rzadko leży w presecie. Zwykle chodzi o sformułowanie albo o gałąź, która niesie coś, bez czego prompt nie może się obejść.

## Powiązane przewodniki

- [Modele decyzyjne](../connections/decision-models.md)
- [Makra promptów](macros.md)
- [Zmienne presetu](preset-variables.md)
- [Czaty grupowe w trybach Conversation i Roleplay](../chats/group-chats.md)
