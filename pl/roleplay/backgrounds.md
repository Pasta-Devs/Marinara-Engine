# Tła w trybie Roleplay

Ten przewodnik wyjaśnia, jak działa tło sceny w trybie Roleplay: agent **Background**, który po każdej odpowiedzi sam dobiera tło, ręczne tworzenie tła oraz przypisanie jednego obrazu do konkretnego czatu. Bibliotekę wgranych teł i jej ustawienia opisuje przewodnik [Tła czatu](../appearance/chat-backgrounds.md), a grafiki scen tworzone przez AI z poziomu galerii – przewodnik [Tła scen i galeria](../media/scene-backgrounds.md).

## Tło sceny

W trybie Roleplay za wiadomościami widać pełnoekranowe tło sceny. Przy zmianie tła Marinara płynnie przenika stary obraz w nowy, dzięki czemu zmiana sceny wygląda łagodnie, a nie skokowo.

Generowanie obrazów nie jest do tego potrzebne. Bez skonfigurowanego połączenia do generowania obrazów tło pozostaje jednolitym kolorem. Czat działa wtedy normalnie, jako zwykła rozmowa tekstowa.

## Agent Background

Agent **Background** to opcjonalny pomocnik, który dobiera tło sceny. Uruchamia się po każdej odpowiedzi. Czyta bieżącą scenę, a potem wybiera najlepiej pasujący obraz spośród wszystkich dostępnych teł. Foldery w bibliotece porządkują tylko widok w sekcji ustawień i nigdy nie ukrywają obrazów przed agentem. Agent wybiera wyłącznie istniejące obrazy; automatyczne generowanie teł należy do agenta **Illustrator**.

Agent **Background** jest domyślnie wyłączony. Aby go włączyć:

1. Otwórz czat w trybie Roleplay.
2. Otwórz **Chat Settings** (ustawienia czatu) przyciskiem w czacie. Domyślnie jest w prawym górnym rogu.
3. Przejdź do sekcji **Agents**.
4. Włącz agenta **Background**.

Od tej pory tło sceny zmienia się samo, w miarę jak fabuła przenosi się między miejscami.

## Ręczne wygenerowanie tła

Nowe tło da się też stworzyć samodzielnie, bez udziału agenta. Marinara buduje prompt obrazu – czyli tekst wysyłany do AI – na podstawie sceny (gatunek, świat, aktualne miejsce, pogoda i pora dnia), a następnie tworzy nowe tło.

1. Otwórz **Chat Settings** i rozwiń sekcję **Gallery** (galeria).
2. Kliknij przycisk **Background**.
3. Zaczekaj, aż przycisk zakończy pracę. W trakcie widnieje na nim napis **Generating...**.

Podczas generowania pojawia się informacja: "AI background generation is running. The new background will be applied when it finishes." Nowy obraz trafia do biblioteki teł i zostaje ustawiony w scenie.

Ręczne generowanie korzysta z połączenia obrazów agenta **Illustrator**, a w razie jego braku – z domyślnego połączenia do generowania obrazów. Agent **Background** nie potrzebuje takiego połączenia, bo wybiera wyłącznie obrazy już obecne w bibliotece. Jeśli Marinara nie znajdzie żadnego połączenia, generowanie kończy się komunikatem: "Choose an image generation connection for the Illustrator agent, or mark one as the default image connection."

Generowanie teł scen działa tylko w trybach Roleplay i Game Mode. W trybie Conversation nie jest dostępne.

## Ustawienie tła dla jednego czatu

Zamiast zostawiać wybór agentowi, można przypisać konkretne tło do aktualnie otwartego czatu.

1. Otwórz panel **Settings** (Ustawienia).
2. Przejdź do zakładki **Appearance**.
3. Znajdź sekcję **Backgrounds**.
4. W polu **Chat Background** wskaż wgrany obraz albo jedno z teł z zasobów gry.

Aby wrócić do domyślnego tła, kliknij przycisk **Remove** obok pola **Chat Background**.

## Biblioteka teł i rozmycie

Obrazy do wyboru znajdują się w tej samej sekcji **Backgrounds**, w panelu **Settings**, w zakładce **Appearance**. Przewodnik [Tła czatu](../appearance/chat-backgrounds.md) opisuje tę bibliotekę w całości: import obrazów, tagi, zmianę nazw, usuwanie, suwak **Background Blur** oraz ustawianie domyślnego tła dla nowych czatów w trybie Roleplay.

## Powiązane przewodniki

- [Tła czatu](../appearance/chat-backgrounds.md): biblioteka wgranych obrazów i ustawienia wyglądu teł.
- [Tła scen i galeria](../media/scene-backgrounds.md): grafiki scen tworzone przez AI z poziomu galerii.
- [Tryb Roleplay: pierwsze kroki](getting-started.md): pełny opis sceny w trybie Roleplay, sprite'ów i paska HUD.
