# Interaktywny onboarding

Ten przewodnik wyjaśnia, czym jest **interaktywny onboarding** – funkcja karty postaci, dzięki której gracz na początku czatu Roleplay tworzy swoją personę, odpowiadając na pytania autora karty. Opisuje, jak autor konfiguruje ją w edytorze **Character Editor** (edytor postaci) i co gracz widzi w kreatorze nowego czatu.

## Do czego służy

Persona to postać, która reprezentuje cię w czacie. Zobacz [Persony użytkownika](personas.md). Zwykle personę piszesz samodzielnie przed rozpoczęciem gry. Przy interaktywnym onboardingu karta postaci dostarcza zamiast tego szablon persony. Szablon to pięć pól persony – **Description** (opis), **Personality** (osobowość), **Backstory** (historia postaci), **Appearance** (wygląd) i **Scenario** (scenariusz) – z lukami do wypełnienia przez gracza oraz pytania, które te luki wypełniają.

Kiedy gracz zaczyna czat Roleplay z tą kartą, może wybrać **Create your persona** (utworzenie własnej persony), odpowiedzieć na pytania i dostać nową, zwykłą personę. Odpowiedzi zostają wpisane do tekstu jeden raz. Wynikiem jest zwykła persona, którą gracz może edytować, zachować albo usunąć jak każdą inną. Sama karta się nie zmienia.

Karta może też zadawać **pytania o postać**. Ich odpowiedzi zapisują się w tym jednym czacie, a nie w personie. Zobacz niżej [Pytania o postać](#character-questions).

Onboarding korzysta z istniejącej składni makr. Nie uruchamia żadnych skryptów.

## Konfiguracja po stronie autora

1. Otwórz postać w edytorze **Character Editor**. Zobacz [Tworzenie i edycja postaci](creating-and-editing-characters.md).
2. Otwórz zakładkę **Onboarding** obok zakładki **Card**.
3. Włącz przełącznik **Interactive onboarding** (interaktywny onboarding). Pod przełącznikiem pojawia się krótki poradnik **How onboarding works** (jak działa onboarding).

Wyłączenie przełącznika ukrywa pola onboardingu, ale zachowuje ich treść.

### Dodawanie pytań

W sekcji **Persona Questions** (pytania o personę) kliknij **Add Question** (dodanie pytania). Każde pytanie działa jak zmienna presetu. Zobacz [Edytor presetów i menedżer promptów](../prompts/presets.md). Karta może mieć do 100 pytań.

- **Variable Name** (nazwa zmiennej) to nazwa, której używasz w polach, na przykład `faction`. Wybierz dowolną nazwę z liter, cyfr i podkreśleń, która zaczyna się od litery albo podkreślenia. Wielkość liter w nazwach ma znaczenie: `Gender` i `gender` to dwie różne nazwy.
- **Question (shown to user)** (pytanie widoczne dla użytkownika) to tekst, który czyta gracz. Może korzystać z wcześniejszych odpowiedzi, na przykład `What does {{player}} look like?`. Tutaj `{{char}}` to nazwa karty, a `{{user}}` to imię gracza.
- **Options** (opcje) zamieniają pytanie w wybór. Domyślnie zaznaczona jest pierwsza opcja. Bez opcji gracz wpisuje dowolną odpowiedź tekstową.
- **Value** (wartość) to tekst, który trafia do persony. Wielkie i małe litery zostają takie, jak je wpiszesz; makra w tym polu wypełniają się tak samo jak w pozostałych polach. Zostaw je puste, żeby użyć etykiety opcji. Jeśli odpowiedź trafia do środka zdania, wpisz wartość małymi literami, na przykład `ranger`.
- **Help text for players** (tekst pomocy dla graczy) to opcjonalny tekst wyświetlany pod opcją.
- **Allow own answer** (zezwolenie na własną odpowiedź) dodaje obok twoich opcji wybór **Write your own** (własna odpowiedź).
- **Multi-Select** (wybór wielokrotny) pozwala graczowi wybrać kilka opcji. Łączy je separator.

Pytanie o nazwie `player` ustawia imię persony. Jeśli go nie dodasz, gracze najpierw są pytani o swoje imię.

Edytor ostrzega, gdy nazwa jest pusta, nieprawidłowa, użyta dwa razy albo zajęta przez wbudowane makro, a także gdy żadne pole nie korzysta z danego pytania.

<a id="character-questions"></a>

### Pytania o postać

Niżej na tej samej zakładce jest druga lista, **Character Questions** (pytania o postać). Jej pytania działają dokładnie tak jak te powyżej, ale odpowiedzi zapisują się w **czacie**, a nie w personie. Wstaw nazwę do jednego z własnych pól karty: **Description**, **Personality**, **Backstory**, **Appearance** lub **Scenario**.

```
{{char}} treats {{relationshipToUser}} with open warmth.
```

Te pięć pól czyta model, więc tylko do nich może dotrzeć odpowiedź na pytanie o postać.

Odpowiedzi są przechowywane jako zmienne czatu, dlatego karta w każdym czacie czyta inną wartość i nigdy nie trzeba jej edytować. Pytanie karty jest zadawane zawsze, gdy karta jest w czacie, niezależnie od tego, czy gracz tworzy personę. Okno pokazuje sekcję **About you** (o tobie) tylko wtedy, gdy powstaje persona.

Autor powinien znać dwie rzeczy:

- **Odpowiedź, która nigdy nie zostanie uzupełniona, zostaje dosłownym tagiem.** Pytanie otwarte bez wartości domyślnej nie jest wstępnie wypełniane, więc czat rozpoczęty bez kreatora pokazuje `{{name}}` dokładnie tak, jak zapisano. Pytania z wyborem wstępnie wypełniają pierwszą opcję, co wystarcza w większości kart.
- **Jeśli dwie karty w jednym czacie deklarują tę samą nazwę, dzielą jedną wartość.** Czat przechowuje jedną odpowiedź na nazwę, więc obie karty czytają ostatnio zapisaną. Okno ostrzega o tym, gdy do tego dojdzie.

### Pisanie pól persony

Wypełnij pięć pól jak we własnej personie, a w miejscu odpowiedzi wpisz `{{name}}`:

```
Name: {{player}}
Class: {{class}}
Role: {{player}} is a {{class}} sworn to {{faction}}.
```

Po kliknięciu w pole pod nim pojawia się lista **Available variables** (dostępne zmienne). Kliknij zmienną, żeby wstawić ją w miejscu kursora.

Użyj `{{#if}}`, żeby pokazać tekst tylko przy niektórych odpowiedziach:

```
{{#if knowsHer == yes}}Grew up next door to {{char}}. {{relationToAna}}{{/if}}
```

Pytanie, które występuje tylko wewnątrz `{{#if}}`, pada tylko wtedy, gdy ten warunek jest spełniony. W przykładzie `relationToAna` to pytanie uzupełniające, które pojawia się, gdy gracz odpowie **yes**. Porównania nie rozróżniają wielkich i małych liter.

`{{user}}` i `{{char}}` zostają w utworzonej personie jako makra, więc działają tak jak w każdej personie. Inne makra, takie jak `{{random}}`, `{{time}}` czy `{{getvar}}`, wypełniają się jeden raz przy tworzeniu persony albo zostają puste, jeśli nie mają wtedy wartości.

**Rendered preview** (podgląd wyniku) na dole pokazuje personę zbudowaną z przykładowych odpowiedzi i wypisuje kolejno zadawane pytania.

## Odpowiadanie na pytania jako gracz

1. Zacznij nowy czat Roleplay. W kroku **Persona & Characters** (persona i postacie) karty z onboardingiem mają na liście postaci małą ikonę osoby z plusem.
2. Dodaj postać. Aby otrzymać z niej nową personę, wybierz wiersz **Create your persona** na górze pola **Your Persona** (twoja persona). Wiersz podaje nazwę karty, do której należy. Każdy inny wybór (albo **None**) pomija tworzenie persony i zostawia twoją.
3. Kliknij **Next** (dalej). Okno z pytaniami otwiera się zawsze, gdy którakolwiek karta w czacie ma pytania o postać, niezależnie od tego, czy tworzysz personę.
4. Odpowiedz na pytania. Najpierw idą **Character questions** (pytania o postać), po jednej sekcji na kartę, a potem **About you**, gdy powstaje persona. Pytania uzupełniające pojawiają się, gdy tylko twoje odpowiedzi sprawią, że nabiorą znaczenia.
5. Kliknij **Create persona** (utworzenie persony) albo **Save answers** (zapisanie odpowiedzi), gdy nie tworzysz persony. Odpowiedzi na pytania o postać zapisują się w czacie, a kreator przechodzi dalej.

Pytania onboardingu są zadawane w kreatorze nowego czatu Roleplay. Quick Start, konfiguracja czatu Conversation i rozpoczęcie czatu prosto z karty postaci jeszcze ich nie zadają. Czat rozpoczęty w ten sposób nadal wypełnia pierwszą opcję każdego pytania, dzięki czemu `{{relationshipToUser}}` zamienia się na wartość zamiast pokazywać tag. Odpowiedź w kreatorze zastępuje tę wartość domyślną, tylko w tym czacie.

## Udostępnianie kart z onboardingiem

Onboarding jest zapisany razem z kartą. Eksport w formatach **Marinara Native** i **Compatible PNG Card** go zachowuje, więc gracz, który zaimportuje kartę, też dostaje pytania. Eksport w formacie **Compatible JSON** go pomija. Karta zaimportowana z ponad 100 pytaniami zachowuje pierwsze 100. Zobacz [Importowanie i eksportowanie kart postaci](import-export.md).

## Powiązane przewodniki

- [Tworzenie i edycja postaci](creating-and-editing-characters.md)
- [Persony użytkownika: tworzenie i edycja](personas.md)
- [Wybór persony w czacie](choosing-your-persona.md)
- [Makra promptów](../prompts/macros.md)
- [Importowanie i eksportowanie kart postaci](import-export.md)
