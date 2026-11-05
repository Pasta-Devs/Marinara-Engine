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

## Wygeneruj tło ręcznie

Na podstawie sceny (gatunek, świat, miejsce, pogoda i pora dnia) Marinara buduje prompt obrazu (prompt to tekst, który Marinara wysyła do AI) i tworzy nowe tło.

Zanim zaczniesz: zainstaluj agenta **Illustrator** i ustaw dla niego konto do generowania obrazów albo oznacz jedno konto do generowania obrazów jako domyślne. Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md). Nie musisz dodawać agenta Illustrator do czatu.

1. Otwórz **Chat Settings** przyciskiem z suwakami w czacie i rozwiń sekcję **Gallery** (galeria).
2. Kliknij **Background**. W trakcie pracy przycisk pokazuje **Generating...**, a w sekcji Gallery widać komunikat "Illustrator is generating a background image for this scene."
3. Zaczekaj, aż generowanie się zakończy. Nowy obraz trafia do biblioteki teł i zostaje ustawiony w scenie.

Ręczne generowanie korzysta z konta obrazów agenta Illustrator, a w razie jego braku z twojego domyślnego konta do generowania obrazów. Działa w trybach Roleplay i Game Mode, ale nie w trybie Conversation.

Jeśli to nie zadziałało: komunikat "Choose an image generation connection for the Illustrator agent, or mark one as the default image connection." oznacza, że Marinara nie znalazła żadnego konta obrazów. Ustaw je i spróbuj ponownie. Jeśli brakuje przycisku **Background**, agent Illustrator nie jest zainstalowany.

## Biblioteka teł i rozmycie

Obrazy do wyboru znajdują się w tej samej sekcji **Backgrounds**. Import, tagi, zmianę nazw, usuwanie, suwak **Background Blur** i domyślne tło nowych czatów w trybie Roleplay opisuje przewodnik [Tła czatu](../appearance/chat-backgrounds.md).

## Powiązane przewodniki

- [Tła czatu](../appearance/chat-backgrounds.md): biblioteka wgranych obrazów i ustawienia wyglądu.
- [Tła scen i galeria](../media/scene-backgrounds.md): grafiki scen tworzone przez AI z twojej galerii.
- [Tryb Roleplay: pierwsze kroki](getting-started.md): scena trybu Roleplay, sprite'y i pasek HUD.
