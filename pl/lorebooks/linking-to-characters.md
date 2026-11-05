# Podpinanie lorebooków do postaci i person

Podepnij lorebook do postaci albo persony, a będzie się sam włączał w odpowiednich czatach. Lorebook można też osadzić w karcie postaci oraz sterować lorebookami w jednym czacie. Lorebooki to dla ciebie nowość? Zacznij od przewodnika [Lorebooki – przegląd](overview.md).

## Podpięcie czy osadzenie

| Cecha | Podpięcie (Assign) | Osadzenie (Embed) |
| --- | --- | --- |
| Co się dzieje | Postać lub persona wskazuje na lorebook w twojej bibliotece. | Lorebook zostaje zapisany w karcie postaci. |
| Kiedy się włącza | W czatach z tą postacią lub personą. | Tak samo, a do tego podróżuje razem z kartą. |
| Eksportuje się z kartą | Nie | Tak |
| Dostępne dla | Postaci i person | Tylko postaci |

Najczęściej wystarczy podpięcie. Osadzaj tylko wtedy, gdy zamierzasz udostępnić kartę razem z jej lorebookiem.

## Zakładka **Lorebook** w edytorze

Zakładkę **Lorebook** ma zarówno edytor postaci, jak i edytor persony.

1. Otwórz postać albo personę do edycji.
2. Kliknij zakładkę **Lorebook**. Sekcja **Lorebooks** (lorebooki) ma dwa przyciski: **New** (nowy) i **Assign Lorebook** (podpięcie lorebooka).

**New** tworzy lorebook od razu podpięty do tej postaci lub persony, z kategorią ustawioną na **Character**. **Assign Lorebook** podpina lorebook, który już masz.

## Podpięcie istniejącego lorebooka

Zanim zaczniesz: lista wyboru pokazuje tylko lorebooki, których pole **Category** ma wartość **Character**, także przy edycji persony. Jeśli jakiegoś lorebooka brakuje, otwórz go, ustaw **Category** na **Character** na zakładce **Overview** i spróbuj ponownie.

1. W zakładce **Lorebook** kliknij **Assign Lorebook**.
2. Wpisz fragment nazwy w polu wyszukiwania.
3. Kliknij lorebook. Pojawia się znacznik wyboru.
4. Zostaw **Scope** (zasięg) na opcji **All chats with** z nazwą albo zmień to ustawienie (zobacz niżej).
5. Kliknij **Assign**.

Lorebook pojawia się teraz na liście podpiętych. Przyciskiem **Scope** w jego wierszu zmienisz zasięg, a ikoną kosza usuniesz podpięcie. Kliknij nazwę, żeby otworzyć lorebook.

Lorebooka globalnego nie da się dodatkowo podpiąć. Zobacz [Lorebooki – przegląd](overview.md).

### Scope

**Scope** decyduje, które czaty mogą korzystać z podpiętego lorebooka. Pod uwagę brane są wyłącznie czaty z tą postacią albo z tą personą.

| Scope | Efekt |
| --- | --- |
| **All chats with** (a po nim nazwa) | Ustawienie domyślne. Lorebook włącza się w każdym takim czacie. |
| **Disabled for all chats** | Podpięcie zostaje, ale lorebook nigdy się nie włącza. Tak wstrzymuje się lorebook. |
| **Specific chats** | Tylko czaty zaznaczone na liście. Przed zapisem trzeba zaznaczyć co najmniej jeden. |

Żeby zmienić zasięg później, kliknij **Scope** w wierszu, popraw ustawienie i kliknij **Assign** jeszcze raz.

## Osadzanie lorebooka w karcie postaci

Zanim zaczniesz: najpierw podepnij lorebook do postaci (zobacz wyżej).

1. Otwórz postać i kliknij zakładkę **Lorebook**.
2. W wierszu lorebooka kliknij **Embed into card** (osadzenie w karcie).

W wierszu pojawia się plakietka **Embedded**, a wpisy eksportują się od teraz razem z kartą.

Karta mieści jeden osadzony lorebook. Jeśli już go ma, przycisk **Embed into card** jest nieaktywny, a jego podpowiedź mówi, żeby najpierw usunąć obecny osadzony lorebook.

Po edycji podpiętego lorebooka kliknij **Refresh** w jego wierszu, żeby zapisać osadzoną kopię od nowa z aktualnych wpisów.

### Zarządzanie osadzonym lorebookiem

Kiedy karta ma osadzony lorebook, pod listą podpiętych pojawiają się te kontrolki, razem z listą jego wpisów tylko do odczytu.

- **Import Embedded Lorebook** (import osadzonego lorebooka) zamienia wpisy z karty w zwykły lorebook w bibliotece, podpięty z powrotem do postaci. Gdy podpięta kopia już istnieje, przycisk nosi nazwę **Reimport Embedded Lorebook**.
- **Edit Embedded Lorebook** otwiera ten podpięty lorebook. Zmiany trafiają z powrotem do kopii w karcie.
- **Remove from card** usuwa osadzoną kopię. Osobno podpięty lorebook zostaje nietknięty.

Wiele kart zaimportowanych z innych narzędzi przychodzi z osadzonym lorebookiem. Kliknij **Import Embedded Lorebook**, żeby dostać wersję do edycji.

## Sekcja **Lorebooks** w panelu **Chat Settings**

Każdy czat ma własne kontrolki lorebooków.

1. Otwórz czat.
2. Otwórz **Chat Settings** (ustawienia czatu).
3. Znajdź sekcję **Lorebooks**. Plakietka pokazuje, ile lorebooków jest aktywnych.

Każdy aktywny lorebook ma plakietkę, która mówi, dlaczego jest włączony.

| Plakietka | Znaczenie |
| --- | --- |
| **Chat** | Został dodany do tego czatu. |
| **Global** | To lorebook globalny. |
| **Character** | Jest podpięty do postaci obecnej w tym czacie. |
| **Persona** | Jest podpięty do persony tego czatu. |

Zestaw aktywnych lorebooków da się zmienić tylko dla tego czatu.

- **Add Lorebook** (dodanie lorebooka) dodaje lorebook do tego czatu. Taki lorebook ma plakietkę **Chat**.
- Ikona kosza (**Remove from chat**) usuwa dodany lorebook.
- Ikona przekreślonego oka (**Disable in this chat**) ukrywa tutaj automatycznie włączany lorebook bez usuwania podpięcia. Lorebook ma wtedy przekreśloną nazwę i plakietkę **Disabled**.
- Ikona oka (**Enable in this chat**) włącza go z powrotem.

### Lorebook Token Budget

**Lorebook Token Budget** ogranicza, ile tokenów tekstu z lorebooków może dodać ten czat. Domyślna wartość to 8192, a 0 oznacza brak limitu. Działa dodatkowo obok własnego **Token Budget** każdego lorebooka. Zobacz [Limity tokenów i rekurencja w lorebookach](token-budgets.md).

## Powiązane przewodniki

- [Lorebooki – przegląd](overview.md)
- [Limity tokenów i rekurencja w lorebookach](token-budgets.md)
- [Importowanie i eksportowanie lorebooków](import-export.md)
- [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md)
- [Panel **Chat Settings** – przegląd](../chats/chat-settings.md)
