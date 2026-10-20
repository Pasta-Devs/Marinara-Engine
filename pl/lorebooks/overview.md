# Lorebooki – przegląd

Z tego przewodnika dowiesz się, czym jest lorebook w aplikacji Marinara Engine, jak działa panel **Lorebooks** (Lorebooki) i jak lorebook staje się aktywny w czacie. Znajdziesz tu też instrukcję tworzenia pierwszego lorebooka i pierwszego wpisu. Trudniejsze tematy, takie jak słowa kluczowe, czas działania i wyszukiwanie semantyczne, mają własne przewodniki, do których linki są na końcu.

## Czym jest lorebook

Lorebook to niewielka baza wiedzy, z której AI może korzystać w trakcie czatu. Druga nazwa tego samego mechanizmu to **World Info** i oba określenia znaczą to samo. Każdy lorebook zawiera listę wpisów. Wpis składa się z dwóch części: wyzwalających słów kluczowych oraz bloku tekstu.

Kiedy słowo kluczowe pojawi się w niedawnych wiadomościach, Marinara Engine dodaje tekst tego wpisu do promptu. Prompt to ukryte instrukcje i historia czatu wysyłane do AI przy każdej odpowiedzi. Dzięki temu AI korzysta z faktów, których nikt nie podał wprost w czacie.

Oto prosty przykład. Utwórz w lorebooku wpis ze słowem kluczowym `Eldoria` i taką treścią:

```
Eldoria is a rainy port city ruled by a council of nine merchants.
```

Od tej chwili każda wzmianka o mieście Eldoria – twoja albo postaci – sprawia, że AI dostaje ten fakt. Może wtedy odpowiadać tak, jakby zawsze znało to miasto. Bez wpisu musiałoby zgadywać.

Lorebooki przydają się do opisu świata, historii postaci, nazw miejsc, frakcji, zasad i wszystkich faktów, o których AI ma pamiętać. Nie trzeba powtarzać ich w każdej wiadomości. Lorebook podaje je tylko wtedy, gdy są potrzebne, dzięki czemu oszczędza miejsce w treści promptu.

Dopasowanie po słowach kluczowych działa z każdym połączeniem z AI i nie wymaga dodatkowej konfiguracji. Marinara umie też dopasowywać wpisy po znaczeniu, a nie po dokładnych słowach – służy do tego wyszukiwanie semantyczne. To osobna funkcja, którą trzeba włączyć samodzielnie, opisana we własnym przewodniku.

## Panel Lorebooks

Panel **Lorebooks** to biblioteka, w której przegląda się, wyszukuje i porządkuje wszystkie lorebooki. Otwórz go z paska bocznego aplikacji. Panel pokazuje każdy lorebook razem z obrazkiem, nazwą i krótkim opisem.

Na górze panelu są trzy przyciski z ikonami. Mają samą ikonę, bez podpisu. Najedź myszą na przycisk, żeby zobaczyć jego nazwę.

- Przycisk **New** (nowy, znak plus) otwiera okno **Create Lorebook**, w którym tworzy się lorebook.
- Przycisk **Import** (import, strzałka w dół) otwiera okno **Import Lorebook** i służy do wczytania lorebooka z pliku.
- Przycisk **Select** (wybór, znak zaznaczenia) włącza tryb wielokrotnego wyboru, dzięki czemu da się naraz wyeksportować lub usunąć kilka lorebooków.

Pod przyciskami jest pole wyszukiwania z tekstem zastępczym **Search lorebooks**. Filtruje ono listę po nazwie, opisie, nazwach powiązanych postaci i person oraz po tagach. Obok stoi lista rozwijana **Sort order** z opcjami: **Manual order** (kolejność ręczna), **A-Z**, **Z-A**, **Newest**, **Oldest** i **Token Budget**. Przy opcji **Manual order** przeciągnij lorebooki w wybranej kolejności albo przesuń jeden z nich klawiszami Alt+strzałka w górę i Alt+strzałka w dół. Ustawiona kolejność zostaje zachowana.

W wierszu każdego lorebooka są przyciski **Copy** (kopiowanie) i **Delete** (usunięcie). Pojawiają się po najechaniu myszą na wiersz, a na urządzeniach mobilnych widać je zawsze. Przycisk **Copy** tworzy kopię lorebooka. Wyłączony lorebook ma małą plakietkę **OFF**. Kliknij obrazek, żeby go wgrać albo podmienić.

Bibliotekę da się też podzielić na foldery przyciskiem **New Folder** (nowy folder). Przeciągnij lorebook na folder, żeby go tam schować. W dużej bibliotece pomaga to utrzymać porządek. Na telefonie przytrzymaj chwilę lorebook, a potem go przeciągnij. Te foldery biblioteki to co innego niż foldery wpisów wewnątrz pojedynczego lorebooka.

## Kategorie

Każdy lorebook ma jedną kategorię. Kategoria jest tylko etykietą, która porządkuje bibliotekę. Nie zmienia tego, jak ani kiedy lorebook się aktywuje.

W panelu są takie zakładki kategorii:

- **All** pokazuje wszystkie lorebooki pogrupowane według kategorii.
- **Active** pokazuje tylko lorebooki związane z aktualnie otwartym czatem.
- **World**, **Character**, **NPC**, **Spellbook** i **Other** pokazują lorebooki z jednej wybranej kategorii.

Przy tworzeniu lorebooka wybiera się jedną z pięciu kategorii: **World**, **Character**, **NPC**, **Spellbook** albo **Other**. Domyślnie jest to **Other**. Kategorię można zmienić później w zakładce **Overview** (przegląd) danego lorebooka. Uwaga: w zakładce **Overview** ta sama kategoria nazywa się **Uncategorized**, a nie **Other**. Używaj tych etykiet tak, jak ci wygodnie. Notatki o miejscach i realiach świata trafiają na przykład do **World**, a historia towarzysza do **Character**.

## Jak lorebook staje się aktywny

Lorebook zasila AI tylko wtedy, gdy jest aktywny w bieżącym czacie. Są trzy sposoby aktywacji. Wybierz ten, który pasuje.

1. **Global.** Globalny lorebook jest aktywny w każdym czacie, o ile jest włączony. Włącz przełącznik **Global** (globalny) w zakładce **Overview** lorebooka. Nadaje się do faktów ważnych wszędzie, na przykład do zasad wspólnego świata.
2. **Powiązanie z postacią lub personą.** Powiązany lorebook włącza się sam w każdym czacie z tą postacią albo z tą personą. Powiązania ustawia się w zakładce **Overview** lub w edytorze postaci czy persony. To najczęstszy wybór dla historii samej postaci.
3. **Przypięcie do jednego czatu.** Lorebook można dodać tylko do jednego czatu z jego ustawień. Zostaje wtedy aktywny wyłącznie w tym czacie. Przydaje się przy wiedzy pasującej do jednej historii, a nie do całej biblioteki.

Ten sam lorebook nie może być jednocześnie globalny i powiązany. Włączenie przełącznika **Global** kasuje przy zapisie wszystkie powiązania z postaciami i personami. Marinara traktuje te dwie opcje jako wzajemnie się wykluczające.

Każdy aktywny lorebook nadal podlega przełącznikowi **Enabled** (włączony). Kiedy lorebook jest wyłączony, żaden z jego wpisów się nie aktywuje, nawet jeśli jest globalny albo powiązany. Aby sprawdzić, które lorebooki są aktywne w otwartym czacie, otwórz jego ustawienia i znajdź sekcję **Lorebooks**. Tam też da się edytować listę aktywnych lorebooków. Ta sekcja ma osobny przewodnik.

## Tworzenie pierwszego lorebooka i wpisu

Wykonaj kolejno te kroki, aby utworzyć lorebook i dodać do niego jeden wpis.

1. Otwórz panel **Lorebooks** i kliknij przycisk **New**. Otwiera się okno **Create Lorebook**.
2. Wpisz nazwę w polu **Name**. To pole jest wymagane. Dobry przykład to `Eldoria World Lore`.
3. Dodaj krótki opis w polu **Description**, jeśli chcesz. Jest opcjonalny i ułatwia tylko późniejsze odnalezienie lorebooka.
4. Wybierz kategorię z listy rozwijanej **Category** albo zostaw **Other**.
5. Kliknij przycisk **Create Lorebook**. Nowy lorebook pojawia się na liście w panelu.

Lorebook nie ma jeszcze żadnych wpisów. Czas dodać pierwszy.

1. Kliknij wiersz swojego lorebooka w panelu. Otwiera się edytor na całą stronę.
2. Kliknij zakładkę **Entries** (wpisy). Plakietka obok niej pokazuje liczbę wpisów.
3. Kliknij przycisk **Add Entry** (dodanie wpisu). Pojawia się nowy, pusty wpis.
4. We wpisie dodaj przynajmniej jedno wyzwalające słowo kluczowe, na przykład `Eldoria`.
5. W polu **Content** wpisz tekst, który ma trafić do AI.

Wpis zapisuje się sam chwilę po zakończeniu pisania. Na ekranie widać wtedy krótką informację **Saved automatically**. Lorebook już działa: kiedy słowo kluczowe pasuje do niedawnych wiadomości, treść wpisu dołącza do promptu. Przewodnik [Wpisy lorebooka](entries.md) wyjaśnia słowa kluczowe, zasady dopasowania i opcje czasu działania. Sekcje [Strategia pisania](entries.md#authoring-strategy-choosing-the-right-entry) i [Przykład w praktyce](entries.md#worked-example-a-small-setting) pokazują, jak dobrać właściwe ustawienia do każdego wpisu.

## Ustawienia w zakładce Overview

Otwórz lorebook i kliknij zakładkę **Overview**, aby ustawić zachowanie całego lorebooka. Najważniejsze pola to nazwa, kategoria, powiązania i opisane wyżej przełączniki. W zakładce są też takie ustawienia liczbowe.

| Ustawienie | Do czego służy | Domyślnie |
|---|---|---|
| **Scan Depth** | Ile ostatnich wiadomości Marinara sprawdza pod kątem słów kluczowych. Wpisz 0, aby przeszukać cały czat. | 2 |
| **Token Budget** | Największa liczba tokenów, jaką ten lorebook może dodać do jednego promptu. Wpisz 0, aby znieść limit. | 2048 |
| **Entry Limit** | Największa liczba wpisów, jaką ten lorebook może dodać do jednego promptu. Zakres od 1 do 1000. | 100 |
| **Max Depth** | Ile dodatkowych przebiegów rekurencyjnych ma się wykonać. Pole widać tylko przy włączonym przełączniku **Recursive**. Zakres od 1 do 10. | 3 |

Token to mały kawałek tekstu, mniej więcej kilka znaków. AI ma ograniczone miejsce na prompt, więc **Token Budget** pilnuje, żeby jeden lorebook go nie zapełnił.

W zakładce są też trzy przełączniki:

- **Enabled** włącza i wyłącza cały lorebook. Domyślnie jest włączony.
- **Recursive** sprawia, że tekst aktywowanego wpisu wyzwala kolejne wpisy w dodatkowych przebiegach. Domyślnie jest wyłączony. Włącz go, gdy jedna informacja o świecie ma pociągać za sobą powiązane informacje.
- **Vectors** udostępnia wpisom dopasowanie po znaczeniu. Domyślnie jest wyłączony. Dopasowanie po słowach kluczowych działa również wtedy, gdy ten przełącznik jest wyłączony.

Pod tymi ustawieniami jest panel **Semantic Search (Embeddings)**. Buduje on dane, na których opiera się dopasowanie po znaczeniu. Przewodnik o wyszukiwaniu semantycznym opisuje konfigurację, źródła embeddingów i przyciski wektoryzacji.

Szczegóły limitów, ustawienia **Entry Limit** i rekurencji też mają własny przewodnik. Zacznij od podanych wyżej wartości domyślnych. Sprawdzają się w większości lorebooków, a zmienić je można w każdej chwili.

## Powiązane przewodniki

- [Wpisy lorebooka: słowa kluczowe, pozycja i czas działania](entries.md)
- [Limity tokenów i rekurencja w lorebookach](token-budgets.md)
- [Wyszukiwanie semantyczne w lorebookach](semantic-search.md)
- [Podpinanie lorebooków do postaci i person](linking-to-characters.md)
- [Importowanie i eksportowanie lorebooków](import-export.md)
- [Źródła wiedzy: agenci Knowledge Retrieval i Knowledge Router](../agents/knowledge-sources.md)
