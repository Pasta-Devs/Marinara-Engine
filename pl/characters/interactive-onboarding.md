# Interaktywny onboarding

Ten przewodnik przyda się tylko wtedy, gdy tworzysz karty, w które grają inne osoby. Interaktywny onboarding pozwala karcie postaci zadać graczowi pytania na początku czatu Roleplay, a potem tworzy z odpowiedzi personę. Autorzy konfigurują go w edytorze **Character Editor** (edytor postaci). Gracze odpowiadają w kreatorze nowego czatu.

## Do czego służy

Persona to karta postaci, która reprezentuje cię w czacie. Zobacz [Persony](personas.md). Zwykle piszesz ją samodzielnie przed rozpoczęciem gry. Przy onboardingu karta dostarcza zamiast tego szablon persony: pięć pól persony – **Description** (opis), **Personality** (osobowość), **Backstory** (historia postaci), **Appearance** (wygląd) i **Scenario** (scenariusz) – z lukami dla gracza oraz pytania, które te luki wypełniają.

Kiedy gracz zaczyna czat Roleplay z tą kartą, może wybrać **Create your persona** (utworzenie własnej persony), odpowiedzieć na pytania i dostać nową, zwykłą personę. Odpowiedzi zostają wpisane do tekstu jeden raz. Gracz może edytować, zachować albo usunąć tę personę jak każdą inną. Karta się nie zmienia.

Karta może też zadawać pytania o postać. Odpowiedzi na nie zapisują się w tym jednym czacie, a nie w personie. Zobacz [Pytania o postać](#character-questions). Onboarding korzysta z istniejącej składni makr i nie uruchamia żadnych skryptów.

## Konfiguracja po stronie autora

1. Otwórz postać w edytorze **Character Editor**. Zobacz [Tworzenie i edycja postaci](creating-and-editing-characters.md).
2. Otwórz zakładkę **Onboarding** obok zakładki **Card**.
3. Włącz przełącznik **Interactive onboarding** (interaktywny onboarding). Pod przełącznikiem pojawia się krótki poradnik **How onboarding works** (jak działa onboarding).

Wyłączenie przełącznika ukrywa pola onboardingu, ale zachowuje ich treść.

### Niech napisze go Professor Mari

Poproś asystentkę [Professor Mari](../home/professor-mari.md), na przykład: "Napisz zabawny onboarding dla królowej Ayrene, z szablonem persony." Asystentka pisze pytania i pola persony, a potem włącza onboarding. Przed zapisaniem aplikacja sprawdza jej pracę. Literówka w nazwie, `{{name}}` bez pytania albo warunek bez znaku `#` wracają do niej do poprawki. Przy pytaniu o postać dodaje też jego `{{name}}` do jednego z własnych pól karty. Jej zmiany pojawiają się na karcie zmiany, którą możesz przejrzeć albo cofnąć.

### Dodawanie pytań o personę

W sekcji **Persona Questions** (pytania o personę) kliknij **Add Question** (dodanie pytania). Każde pytanie działa jak zmienna presetu, czyli nazwana luka, którą wypełnia odpowiedź. Zobacz [Edytor presetów i menedżer promptów](../prompts/presets.md). Karta może mieć do 100 pytań.

| Pole | Do czego służy |
| --- | --- |
| **Variable Name** (nazwa zmiennej) | Nazwa, której używasz w polach, na przykład `faction`. Użyj liter, cyfr i podkreśleń; nazwa musi zaczynać się od litery albo podkreślenia. Wielkość liter w nazwach ma znaczenie: `Gender` i `gender` to różne nazwy. |
| **Question (shown to user)** (pytanie widoczne dla użytkownika) | Tekst, który czyta gracz. Może korzystać z wcześniejszych odpowiedzi, na przykład `What does {{player}} look like?`. `{{char}}` to nazwa karty, a `{{user}}` to imię gracza. |
| **Options** (opcje) | Zamieniają pytanie w wybór. Domyślnie zaznaczona jest pierwsza opcja. Bez opcji gracz wpisuje dowolną odpowiedź tekstową. |
| **Value** (wartość) | Tekst, który trafia do persony. Wielkie i małe litery zostają takie, jak je wpiszesz, a makra w tym polu zostają wypełnione. Zostaw je puste, żeby użyć etykiety opcji. Jeśli odpowiedź trafia do środka zdania, użyj wartości zapisanej małymi literami, na przykład `ranger`. |
| **Help text for players** (tekst pomocy dla graczy) | Opcjonalny tekst pod opcją. |
| **Allow own answer** (zezwolenie na własną odpowiedź) | Dodaje obok twoich opcji wybór **Write your own** (własna odpowiedź). |
| **Multi-Select** (wybór wielokrotny) | Pozwala graczowi wybrać kilka opcji, które łączy separator. |

Pytanie o nazwie `player` ustawia imię persony. Bez takiego pytania gracze najpierw są pytani o swoje imię. Edytor ostrzega, gdy nazwa jest pusta, nieprawidłowa, użyta dwa razy albo zajęta przez wbudowane makro, a także gdy żadne pole nie korzysta z danego pytania.

### Pisanie pól persony

Wypełnij pięć pól jak we własnej personie, a w miejscu odpowiedzi wpisz `{{name}}`. Kliknij w pole, żeby zobaczyć jego listę **Available variables** (dostępne zmienne), i kliknij zmienną, żeby wstawić ją w miejscu kursora.

```text
Name: {{player}}
Class: {{class}}
Role: {{player}} is a {{class}} sworn to {{faction}}.
```

Użyj `{{#if}}`, żeby pokazać tekst tylko przy niektórych odpowiedziach:

```text
{{#if knowsHer == yes}}Grew up next door to {{char}}. {{relationToAna}}{{/if}}
```

Pytanie, które występuje tylko wewnątrz `{{#if}}`, pada tylko wtedy, gdy warunek jest spełniony. Tutaj `relationToAna` to pytanie uzupełniające, które pojawia się, gdy gracz odpowie **yes**. Porównania nie rozróżniają wielkich i małych liter.

`{{user}}` i `{{char}}` zostają w utworzonej personie jako makra. Inne makra (symbole zastępcze, które wypełnia Marinara, takie jak `{{random}}` dla losowej liczby albo `{{time}}` dla godziny) wypełniają się jeden raz przy tworzeniu persony albo zostają puste, jeśli nie mają wtedy wartości.

**Rendered preview** (podgląd wyniku) na dole pokazuje personę zbudowaną z przykładowych odpowiedzi i wypisuje kolejno zadawane pytania.

<a id="character-questions"></a>

### Pytania o postać

Ta sama zakładka ma drugą listę, **Character Questions** (pytania o postać). Działają one jak pytania o personę, ale odpowiedzi zapisują się w czacie, a nie w personie. Wstaw nazwę do jednego z własnych pól karty (**Description**, **Personality**, **Backstory**, **Appearance** lub **Scenario**), bo to właśnie te pola czyta model.

```text
{{char}} treats {{relationshipToUser}} with open warmth.
```

Powitanie może użyć `{{name}}` pytania o postać i pokazuje wtedy odpowiedź gracza. Powitanie może też użyć `{{name}}` pytania o personę, na przykład `Ah, so you are a {{class}}`, ale wypełnia się ono tylko wtedy, gdy gracz tworzy tę personę w kreatorze nowego czatu, w pierwszej wiadomości i jej alternatywnych powitaniach. Przy istniejącej personie albo w Quick Start tag pokazuje się tak, jak został napisany, a edytor postaci ostrzega o tym. Kliknij w powitanie, a jego lista **Available variables** pokaże oba rodzaje pytań, z etykietami.

Odpowiedzi są przechowywane jako zmienne czatu, dlatego karta w każdym czacie czyta inną wartość i nigdy nie trzeba jej edytować. Pytanie o postać jest zadawane zawsze, gdy karta jest w czacie, niezależnie od tego, czy gracz tworzy personę. Okno pokazuje sekcję **About you** (o tobie) tylko wtedy, gdy powstaje persona.

Warto wiedzieć o trzech rzeczach:

- **Odpowiedź, która nigdy nie zostanie uzupełniona, zostaje dosłownym tagiem.** Pytanie otwarte bez wartości domyślnej nie jest wstępnie wypełniane, więc czat rozpoczęty bez kreatora pokazuje `{{name}}` dokładnie tak, jak zapisano. Pytania z wyborem wstępnie wypełniają pierwszą opcję, co wystarcza w większości kart.
- **Dwie karty w jednym czacie, które deklarują tę samą nazwę, dzielą jedną wartość.** Obie czytają ostatnio zapisaną odpowiedź. Okno ostrzega o tym.
- **Karta, która opuszcza czat, zabiera ze sobą swoje odpowiedzi.** Po usunięciu postaci zmienne czatu należące do jej pytań o postać zostają usunięte, chyba że inna postać w czacie deklaruje tę samą nazwę.

## Odpowiadanie na pytania jako gracz

1. Zacznij nowy czat Roleplay. W kroku **Persona & Characters** (persona i postacie) karty z onboardingiem mają na liście postaci małą ikonę osoby z plusem.
2. Dodaj postać. Aby otrzymać nową personę, wybierz **Create your persona** na górze pola **Your Persona** (twoja persona). Ta pozycja podaje nazwę karty, do której należy. Każdy inny wybór, w tym **None** (brak), pomija tworzenie persony.
3. Kliknij **Next** (dalej). Okno z pytaniami otwiera się zawsze, gdy którakolwiek karta w czacie ma pytania o postać, niezależnie od tego, czy tworzysz personę.
4. Odpowiedz na pytania. Najpierw idą pytania o postać, po jednej sekcji na kartę, a potem **About you**, gdy powstaje persona. Pytania uzupełniające pojawiają się, gdy twoje odpowiedzi sprawią, że nabiorą znaczenia.
5. Kliknij **Review persona** (przegląd persony), aby zobaczyć imię i pola, które powstaną z twoich odpowiedzi. Fragmenty wypełnione twoimi odpowiedziami są wyróżnione. Podgląd niczego nie zapisuje.
6. Kliknij **Create persona** (utworzenie persony) albo **Save answers** (zapisanie odpowiedzi), gdy nie tworzysz persony. Odpowiedzi na pytania o postać zapisują się w czacie, a kreator przechodzi dalej.

Jeśli coś nie zadziałało: gdy persona powstała, ale nie została wybrana, wybierz ją w polu **Your Persona**. Gdy odpowiedzi nie udało się zapisać, czat używa zamiast nich domyślnego tekstu każdej karty.

Pytania onboardingu są zadawane w kreatorze nowego czatu Roleplay. Quick Start, konfiguracja czatu Conversation i rozpoczęcie czatu prosto z karty postaci jeszcze ich nie zadają. Czat rozpoczęty w ten sposób wypełnia pierwszą opcję każdego pytania, dzięki czemu `{{relationshipToUser}}` zamienia się na wartość zamiast pokazywać tag. Odpowiedź w kreatorze zastępuje tę wartość domyślną tylko w tym czacie.

Na pytania można też odpowiedzieć po zakończeniu konfiguracji, z panelu **Chat Settings** (ustawienia czatu):

- Okno wyboru w sekcji **Persona** w czacie Roleplay pokazuje **Create your persona** dla każdej karty w czacie, która to oferuje. Skorzystaj z niego, gdy kreator został pominięty albo gdy później potrzebujesz nowej persony. Zobacz [Wybór persony w czacie](choosing-your-persona.md).
- Znacznik onboardingu obok postaci w sekcji **Characters** (postacie) ponownie otwiera same pytania o postać z tej karty. Okno zaczyna od odpowiedzi, które czat już ma, więc zapisanie jednej zmiany zostawia pozostałe bez zmian. Zapis przywraca też odpowiedź usuniętą z sekcji **Chat Variables** (zmienne czatu). Odpowiedzi innych kart pozostają nietknięte, z wyjątkiem nazwy wspólnej dla dwóch kart, która ma jedną wartość, więc obie karty czytają nową odpowiedź.

Dodanie karty z pytaniami o postać do trwającego czatu Roleplay, z **Chat Settings** albo przez upuszczenie jej na czat, najpierw zadaje jej pytania. Potem karta proponuje swoje powitanie z wypełnionymi i oznaczonymi twoimi odpowiedziami.

## Udostępnianie kart z onboardingiem

Onboarding jest zapisany razem z kartą. Eksporty w formatach **Marinara Native** i **Compatible PNG Card** go zachowują, więc gracz, który zaimportuje kartę, też dostaje pytania. Format **Compatible JSON** go pomija. Karta zaimportowana z ponad 100 pytaniami zachowuje pierwsze 100. Zobacz [Importowanie i eksportowanie kart postaci](import-export.md).

## Powiązane przewodniki

- [Tworzenie i edycja postaci](creating-and-editing-characters.md)
- [Persony](personas.md)
- [Wybór persony w czacie](choosing-your-persona.md)
- [Makra promptów](../prompts/macros.md)
- [Importowanie i eksportowanie kart postaci](import-export.md)
