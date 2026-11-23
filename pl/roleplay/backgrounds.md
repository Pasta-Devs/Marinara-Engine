# Tła w trybie Roleplay

Czat w trybie Roleplay pokazuje za wiadomościami obraz na całą scenę. Możesz pozwolić, żeby agent **Background** dobierał go po każdej odpowiedzi, utworzyć nowy obraz ręcznie albo przypiąć jeden obraz do konkretnego czatu. Gdy obraz się zmienia, Marinara płynnie przenika stary obraz w nowy.

Generowanie obrazów nie jest wymagane. Bez konta do generowania obrazów tło jest jednolitym kolorem, a czat działa jako zwykły czat tekstowy.

## Ustaw tło dla jednego czatu

Użyj tej opcji, aby za otwartym czatem stale widniał jeden obraz, zamiast zostawiać wybór agentowi. Zmienia to tylko ten czat.

1. Otwórz czat. Potem otwórz **Settings → Appearance** (ustawienia, wygląd) i znajdź sekcję **Backgrounds** (tła).
2. W polu **Chat Background** (tło czatu) wskaż wgrany obraz albo jedno z teł z zasobów gry.

Obraz widać za twoimi wiadomościami. Aby wrócić do domyślnego tła, kliknij **Remove** (usunięcie) obok pola **Chat Background**.

Nie masz jeszcze żadnych obrazów? Najpierw wgraj jakiś. Zobacz [Tła czatu](../appearance/chat-backgrounds.md).

## Pozwól agentowi Background dobierać tło

Agent **Background** to pomocnik, który działa obok odpowiedzi. Po każdej odpowiedzi czyta bieżącą scenę i spośród wszystkich twoich teł wybiera obraz, który pasuje najlepiej. Wybiera wyłącznie istniejące obrazy. Nowe obrazy tworzy automatycznie agent **Illustrator**.

1. Otwórz czat w trybie Roleplay.
2. Otwórz **Chat Settings** (ustawienia czatu) przyciskiem z suwakami w czacie.
3. Otwórz sekcję **Agents** i włącz przełącznik **Enable Agents**.
4. Dodaj agenta **Background**.

Od teraz tło zmienia się samo, w miarę jak fabuła przenosi się między miejscami.

Jeśli to nie zadziałało: gdy masz tylko jedno albo dwa tła, agent wciąż wybiera właśnie je. Dodaj więcej obrazów do biblioteki. Zobacz [Tła czatu](../appearance/chat-backgrounds.md).

## Ponowne używanie posiadanych obrazów

Gdy Illustrator samodzielnie tworzy tła, a historia przenosi się w nowe miejsce, najpierw sprawdza, czy jest tło przypięte do tego miejsca (zobacz [Przypnij tło do miejsca](#pin-a-background-to-a-place)). W przypiętym miejscu niczego nie maluje. W przeciwnym razie przeszukuje twoją bibliotekę teł. Obraz pasuje do miejsca, gdy jego nazwa pliku albo jeden z tagów złożonych z co najmniej dwóch słów występuje w lokalizacji World State. Na przykład `john-bedroom.png` pasuje do "Smith House, John's bedroom". Wielkość liter, akcenty i "'s" nie mają znaczenia, a najbardziej szczegółowa nazwa ma pierwszeństwo przed zwykłym `bedroom.png`.

Gdy brak lokalizacji World State, nazwa miejsca zapisana przez agenta Illustrator dla nowego tła jest dopasowywana w ten sam sposób. Jeśli obraz pasuje, zostaje wyświetlony i nic nie jest malowane. Tylko miejsce bez dopasowania otrzymuje nowy obraz.

Aby miejsce zachowało swój obraz, nazwij plik od tego miejsca (`kitchen.png` dla "Kitchen"). Tag też działa, jeśli ma co najmniej dwa słowa, na przykład `smith house kitchen`; jednowyrazowe tagi, takie jak `kitchen` lub `night`, są ignorowane, ponieważ zwykle opisują wygląd obrazu.

## Wygeneruj tło ręcznie

Na podstawie sceny (gatunek, świat, miejsce, pogoda i pora dnia) Marinara buduje prompt obrazu (prompt to tekst, który Marinara wysyła do AI) i tworzy nowe tło.

Zanim zaczniesz: zainstaluj agenta **Illustrator** i ustaw dla niego konto do generowania obrazów albo oznacz jedno konto do generowania obrazów jako domyślne. Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md). Nie musisz dodawać agenta Illustrator do czatu.

1. Otwórz **Chat Settings** przyciskiem z suwakami w czacie i rozwiń sekcję **Gallery** (galeria).
2. Kliknij **Background**. W trakcie pracy przycisk pokazuje **Generating...**, a w sekcji Gallery widać komunikat "Illustrator is generating a background image for this scene."
3. Zaczekaj, aż generowanie się zakończy. Nowy obraz trafia do biblioteki teł i zostaje ustawiony w scenie.

Ręczne generowanie korzysta z konta obrazów agenta Illustrator, a w razie jego braku z twojego domyślnego konta do generowania obrazów. Działa w trybach Roleplay i Game Mode, ale nie w trybie Conversation.

Jeśli to nie zadziałało: komunikat "Choose an image generation connection for the Illustrator agent, or mark one as the default image connection." oznacza, że Marinara nie znalazła żadnego konta obrazów. Ustaw je i spróbuj ponownie. Jeśli brakuje przycisku **Background**, agent Illustrator nie jest zainstalowany.

## Przypnij tło do miejsca

Użyj tego, gdy miejsce w twojej historii ma zawsze wyglądać tak samo: sypialnia Johna zawsze pokazuje `john-bedroom`, a twoja własna sypialnia zawsze pokazuje `my-bedroom`. Gdy historia dociera do przypiętego miejsca, pojawia się jego obraz, niezależnie od tego, co wybrałby agent Background.

1. Otwórz **Ustawienia czatu** przyciskiem z suwakami w czacie i otwórz sekcję **Tło**.
2. W sekcji **Przypięte miejsca** kliknij **Dodaj miejsce**.
3. Kliknij puste pole obrazu i wybierz tło. Wpisz miejsce tak, jak jest zapisywane w opowieści, na przykład `John's bedroom`.
4. Opcjonalnie: poniżej dodaj inne nazwy, których może używać opowieść, oddzielając je przecinkami, na przykład `John's room, the master bedroom`.

Szybszy sposób: gdy opowieść jest w danym miejscu i wyświetla się właściwy obraz, kliknij **Przypnij ten obraz do miejsca "John's bedroom"**.

Jak rozróżniane są miejsca:

- Wygrywa najbardziej szczegółowa nazwa. `John's bedroom` i `{{user}}'s bedroom` nigdy się nie mieszają, a przypięcie o samej nazwie `bedroom` jest używane tylko dla sypialni, których nikt nie przypiął.
- Jedno lub dwa słowa pomiędzy nadal pozwalają na dopasowanie: "John's guest bedroom" pasuje do `John's bedroom`, chyba że inne przypięcie nazywa to miejsce dokładnie.
- `{{user}}` to imię twojej persony, a `{{char}}` – dowolnej postaci w czacie, więc `{{user}}'s bedroom` pasuje do "Alyssa's bedroom".
- "My" i "our" odnoszą się do autora wiadomości. Gdy w odpowiedzi Johna opowieść toczy się w "my bedroom", chodzi o sypialnię Johna; "your bedroom" w jego odpowiedzi oznacza twoją sypialnię. W twojej wiadomości "your bedroom" oznacza sypialnię postaci, jeśli w czacie jest tylko jedna postać.
- Wielkość liter, znaki diakrytyczne i apostrofy nie mają znaczenia. Nazwy pasują do całych słów: `John` nigdy nie pasuje do "Johnson".
- Jeśli korzystasz z **World Maps**, wybierz miejsce z listy **Miejsce na mapach świata**. Przypięty budynek obejmuje też te pomieszczenia, które nie mają własnego przypięcia.

Co się dzieje:

- Obraz pojawia się raz, po przybyciu na miejsce. Jeśli podczas pobytu wybierzesz ręcznie inne tło, twój wybór pozostaje, dopóki opowieść nie przeniesie się dalej.
- W przypiętym miejscu agent Background nie może zmienić obrazu, a Illustrator nie maluje dla niego nowego tła.
- Potrzebna jest lokalizacja od agenta **World State** (lub World Maps). Dół listy pokazuje, gdzie historia rozgrywa się teraz, a **Tutaj** oznacza używane przypięcie. Przypięcia działają w czatach w trybie Roleplay.

Jeśli to nie zadziałało: sprawdź, czy pole **Historia rozgrywa się w** pod listą pokazuje to miejsce i czy występuje w nim jedna z nazw przypięcia.

### Tła podążające za postacią

Obraz w sekcji **Galeria** postaci (lub persony), oznaczony jako tło, pojawia się w każdym czacie z tą postacią, bez potrzeby przypinania go osobno w każdym czacie.

1. Otwórz sekcję **Galeria** postaci, kliknij przycisk tagu na obrazie i wybierz **Użyj jako tła**.
2. Wpisz przedstawione na nim miejsca, oddzielając je przecinkami, na przykład `{{char}}'s bedroom, {{char}}'s room`. W galerii postaci `{{char}}` oznacza tę postać, a w galerii persony `{{user}}` oznacza tę personę. Zostaw pole puste, jeśli obraz nie przedstawia jednego miejsca.

Obrazy nazywające miejsca działają jak przypięte miejsca w każdym czacie z tą postacią i są wymienione w sekcji **Przypięte miejsca** w **Ustawienia czatu → Tło**. Przypięcie ustawione w samym czacie ma pierwszeństwo przed obrazem z galerii o tej samej nazwie.

## Biblioteka teł i rozmycie

Obrazy do wyboru znajdują się w tej samej sekcji **Backgrounds**. Import, tagi, zmianę nazw, usuwanie, suwak **Background Blur** i domyślne tło nowych czatów w trybie Roleplay opisuje przewodnik [Tła czatu](../appearance/chat-backgrounds.md).

## Powiązane przewodniki

- [Tła czatu](../appearance/chat-backgrounds.md): biblioteka wgranych obrazów i ustawienia wyglądu.
- [Tła scen i galeria](../media/scene-backgrounds.md): grafiki scen tworzone przez AI z twojej galerii.
- [Tryb Roleplay: pierwsze kroki](getting-started.md): scena trybu Roleplay, sprite'y i pasek HUD.
