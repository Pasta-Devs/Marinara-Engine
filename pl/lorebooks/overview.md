# Lorebooki – przegląd

Lorebook to zbiór faktów o świecie, które AI czyta, gdy w czacie padną ich słowa kluczowe. Zapisz w nim miejsca, frakcje, historie postaci i zasady, żeby nie powtarzać ich w każdej wiadomości.

Każdy lorebook zawiera wpisy. Wpis składa się z wyzwalających słów kluczowych i bloku tekstu. Kiedy słowo kluczowe pojawi się w niedawnych wiadomościach, Marinara dodaje tekst wpisu do promptu, czyli tekstu wysyłanego do modelu przy jednej odpowiedzi. W innych narzędziach lorebooki nazywają się też World Info.

Na przykład wpis ze słowem kluczowym `Eldoria` i poniższym tekstem sprawia, że AI zna to miasto za każdym razem, gdy ktoś o nim wspomni.

```text
Eldoria is a rainy port city ruled by a council of nine merchants.
```

Dopasowanie po słowach kluczowych działa z każdym modelem i nie wymaga konfiguracji. Żeby dopasowywać wpisy po znaczeniu, a nie po dokładnych słowach, zobacz [Wyszukiwanie semantyczne w lorebookach](semantic-search.md).

## Tworzenie lorebooka i dodawanie wpisu

1. Otwórz panel **Lorebooks** (Lorebooki) z paska bocznego.
2. Kliknij **New** (nowy, znak plus). Otwiera się okno **Create Lorebook** (utworzenie lorebooka).
3. Wpisz nazwę w polu **Name** (nazwa). To pole jest wymagane.
4. Jeśli chcesz, dodaj opis w polu **Description** (opis).
5. Wybierz kategorię w polu **Category** (kategoria). Domyślnie jest to **Other**. Jeśli zamierzasz podpiąć ten lorebook do postaci, wybierz **Character**, bo lista wyboru w postaci pokazuje tylko tę kategorię.
6. Kliknij **Create Lorebook**. Nowy lorebook pojawia się na liście.
7. Kliknij wiersz lorebooka. Otwiera się edytor na całą stronę.
8. Kliknij zakładkę **Entries** (wpisy).
9. Kliknij **Add Entry** (dodanie wpisu). Pojawia się nowy, pusty wiersz wpisu.
10. Wpisz w wierszu nazwę, na przykład `Eldoria`, a potem kliknij wiersz, żeby go otworzyć.
11. W polu **Primary Keys** (główne słowa kluczowe) wpisz `Eldoria` i naciśnij <kbd>Enter</kbd>.
12. W polu **Content** (treść) napisz tekst dla AI.

Wpis zapisuje się sam chwilę po zakończeniu pisania, a na ekranie widać napis **Saved automatically**. Od teraz wpis dołącza do promptu za każdym razem, gdy jego słowo kluczowe pasuje. Słowa kluczowe, pozycję i czas działania opisuje przewodnik [Wpisy lorebooka: słowa kluczowe, pozycja i czas działania](entries.md).

Jeśli to nie zadziałało: sprawdź, czy lorebook jest aktywny w czacie (zobacz niżej), czy jego przełącznik **Enabled** (włączony) jest włączony i czy słowo kluczowe pada w kilku ostatnich wiadomościach. Marinara przeszukuje tylko tyle wiadomości, ile wskazuje ustawienie **Scan Depth**.

## Włączanie lorebooka w czacie

Lorebook zasila AI tylko wtedy, gdy jest aktywny w otwartym czacie. Są trzy sposoby.

| Sposób | Gdzie go ustawić | Aktywny w |
| --- | --- | --- |
| Globalnie | Przełącznik **Global** (globalny) na zakładce **Overview** (przegląd) lorebooka | Każdym czacie |
| Przez powiązanie | Zakładka **Overview** lorebooka albo edytor postaci lub persony | Czatach z tą postacią lub personą |
| Dodany do jednego czatu | **Chat Settings → Lorebooks** (ustawienia czatu, lorebooki) | Tylko tym czacie |

Lorebook nie może być jednocześnie globalny i powiązany. Włączenie przełącznika **Global** kasuje przy zapisie jego powiązania z postaciami i personami.

Aktywny lorebook nadal musi mieć włączony przełącznik **Enabled**. Powiązania opisuje przewodnik [Podpinanie lorebooków do postaci i person](linking-to-characters.md).

## Ustawienia w zakładce Overview

Otwórz lorebook i kliknij **Overview**, żeby ustawić zachowanie całego lorebooka.

| Ustawienie | Do czego służy | Domyślnie |
| --- | --- | --- |
| **Scan Depth** | Ile ostatnich wiadomości Marinara sprawdza pod kątem słów kluczowych. 0 przeszukuje cały czat. | 2 |
| **Token Budget** | Największa liczba tokenów, jaką ten lorebook może dodać do jednej odpowiedzi. 0 oznacza brak limitu. | 2048 |
| **Entry Limit** | Największa liczba wpisów, jaką ten lorebook może dodać do jednej odpowiedzi. Zakres od 1 do 1000. | 100 |
| **Max Depth** | Dodatkowe przebiegi rekurencji. Widoczne tylko przy włączonym przełączniku **Recursive**. Zakres od 1 do 10. | 3 |

Tokeny to małe kawałki tekstu, które liczą modele; w języku angielskim token to mniej więcej trzy czwarte słowa. Działanie każdego limitu i znaczenie rekurencji opisuje przewodnik [Limity tokenów i rekurencja w lorebookach](token-budgets.md).

Zakładka ma też takie przełączniki.

- **Enabled** włącza i wyłącza cały lorebook. Domyślnie jest włączony.
- **Global** sprawia, że lorebook jest aktywny w każdym czacie.
- **Recursive** pozwala, żeby tekst aktywowanego wpisu wyzwalał kolejne wpisy. Domyślnie jest wyłączony.
- **Vectors** pozwala dopasowywać wpisy także po znaczeniu. Domyślnie jest wyłączony, a słowa kluczowe działają w obu przypadkach.

Panel **Semantic search (embeddings)** pod przełącznikami opisuje przewodnik [Wyszukiwanie semantyczne w lorebookach](semantic-search.md).

## Panel Lorebooks

Na górze panelu są trzy przyciski z ikonami. Ich nazwy widać po najechaniu na nie kursorem.

- **New** otwiera okno **Create Lorebook**.
- **Import** (import) otwiera okno **Import Lorebook**. Zobacz [Importowanie i eksportowanie lorebooków](import-export.md).
- **Select** (wybór) włącza tryb wielokrotnego wyboru, dzięki czemu da się naraz wyeksportować lub usunąć kilka lorebooków.

Pod przyciskami:

- Pole **Search lorebooks** filtruje po nazwie, opisie, nazwach powiązanych postaci i person oraz po tagach.
- Lista **Sort order** oferuje **Manual order** (kolejność ręczna), **A-Z**, **Z-A**, **Newest**, **Oldest** i **Token Budget**. Przy opcji **Manual order** przeciągnij lorebooki na miejsce albo użyj <kbd>Alt</kbd>+<kbd>Up</kbd> i <kbd>Alt</kbd>+<kbd>Down</kbd>.
- **New Folder** (nowy folder) tworzy folder biblioteki. Przeciągnij na niego lorebook. Na telefonie przytrzymaj lorebook, a potem go przeciągnij. Te foldery to co innego niż foldery wpisów wewnątrz lorebooka.

Każdy wiersz ma przyciski **Copy** (kopiowanie, tworzy kopię lorebooka) i **Delete** (usunięcie). Pojawiają się po najechaniu kursorem na wiersz, a na urządzeniach mobilnych widać je zawsze. Wyłączony lorebook ma plakietkę **OFF**. Kliknij obrazek, żeby go wgrać albo podmienić.

### Kategorie

Kategoria to etykieta porządkująca bibliotekę. Nie zmienia tego, kiedy lorebook się aktywuje. Zakładki to **All**, **Active** (lorebooki związane z otwartym czatem), **World**, **Character**, **NPC**, **Spellbook** i **Other**. Kategorię lorebooka zmienisz na jego zakładce **Overview**, gdzie **Other** nazywa się **Uncategorized**.

## Powiązane przewodniki

- [Wpisy lorebooka: słowa kluczowe, pozycja i czas działania](entries.md)
- [Limity tokenów i rekurencja w lorebookach](token-budgets.md)
- [Wyszukiwanie semantyczne w lorebookach](semantic-search.md)
- [Podpinanie lorebooków do postaci i person](linking-to-characters.md)
- [Importowanie i eksportowanie lorebooków](import-export.md)
- [Źródła wiedzy: agenci Knowledge Retrieval i Knowledge Router](../agents/knowledge-sources.md)
