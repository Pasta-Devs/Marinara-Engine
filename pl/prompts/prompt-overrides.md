# Prompt Overrides dla obrazów i wideo

Ten przewodnik wyjaśnia sekcję **Prompt Overrides** (nadpisania promptów), czyli edytory szablonów, z których Marinara Engine buduje prompty do generowania obrazów i wideo. Zobaczysz, gdzie ich szukać, co da się w nich zmienić i jak bezpiecznie zapisać własny szablon.

## Czym są nadpisania promptów

Pojedyncze nadpisanie **Prompt Override** to szablon promptu do multimediów, którego można używać wielokrotnie. Zanim Marinara wygeneruje obraz lub wideo, najpierw układa tekstowy prompt (tekst, który Marinara wysyła do AI) dla modelu graficznego lub wideo. Sekcja **Prompt Overrides** pozwala edytować właśnie te szablony.

Ta funkcja dotyczy wyłącznie promptów do obrazów i wideo. Nie zmienia tekstowego promptu wysyłanego do modelu czatu w trybie Conversation ani Roleplay. To częste nieporozumienie. Prompt trafiający do modelu czatu zmienia się gdzie indziej: przez preset promptu (zapisany szablon promptu) oraz parametry generowania. Zobacz [Edytor presetów i menedżer promptów](presets.md) i [Parametry generowania](generation-parameters.md).

Kilka pojęć używanych niżej:

- **Sprite** to element grafiki postaci, na przykład wyraz twarzy albo poza całej sylwetki.
- **Storyboard** to zestaw ilustrowanych klatek wygenerowanych z jednej tury w trybie Game Mode albo z ukończonego odcinka w trybie Roleplay.

## Gdzie ich szukać

Edytory znajdziesz w ustawieniach aplikacji.

1. Otwórz panel **Settings** (Ustawienia).
2. Kliknij zakładkę **Generations**.
3. Przewiń do sekcji **Prompt Overrides**, opisanej jako "Reusable image and video prompt templates."

Widać tam dwa zwijane edytory.

## Dwa edytory

Kliknij tytuł edytora, żeby go rozwinąć.

Edytor **Video Generation Prompt Overrides** obsługuje szablony wideo ze scen w trybie Game Mode i w galerii, wiadomości wideo w trybie Conversation, klipów postaci z rozmów w trybie Conversation oraz animowanych portretów z wyrazem twarzy. Każdy szablon promptu wideo decyduje o tym, jak opisujemy modelowi wideo jeden rodzaj klipu.

Edytor **Image Generation Prompt Overrides** obsługuje szablony używane przez systemy obrazów, sprite'ów, trybu Game Mode i kreatora promptów. Obejmuje to selfie z trybu Conversation, portrety postaci NPC w trybie Game Mode, grafiki scen, prompty do storyboardów, szablon **Noodle Post Image** dla postów w sieci Noodle oraz pozostałe zarejestrowane generatory obrazów. Każdy szablon promptu obrazu decyduje o tym, jak opisujemy modelowi graficznemu jeden rodzaj obrazka.

Te dwa edytory razem dają więc kontrolę nad promptami do portretów, selfie, sprite'ów, grafik scen, storyboardów i klipów wideo.

## Edytowanie szablonu

Oba edytory działają tak samo. Wykonaj kolejno te kroki.

1. Otwórz wybrany edytor.
2. Wybierz szablon z listy rozwijanej **Registered prompt**. Zawartość listy zależy od tego, który edytor jest otwarty.
3. Sprawdź kafelek stanu obok listy rozwijanej. Napis **Default** oznacza, że nie zapisano żadnego własnego szablonu. Napis **Custom active** oznacza, że używany jest zapisany własny szablon. Napis **Custom paused** oznacza, że własny szablon jest zapisany, ale wyłączony.
4. Przeczytaj krótki opis pod listą rozwijaną, żeby wiedzieć, do czego służy ten szablon.
5. W sekcji **Available variables** kliknij dowolny kafelek zmiennej, żeby wstawić ją do szablonu. Zmienne mają postać `${name}`, na przykład `${charName}`.
6. Zmień tekst w polu **Template**.
7. Zajrzyj do pola **Rendered preview** poniżej. Podgląd uzupełnia szablon przykładowymi wartościami, więc od razu widać efekt.
8. Jeśli w podglądzie pojawi się ostrzeżenie **Unknown variables**, popraw błędnie wpisaną zmienną. Nazwa spoza listy **Available variables** nie zostanie niczym uzupełniona.
9. Kliknij przycisk **Save**.

Powinien pojawić się komunikat "Prompt override saved", a kafelek stanu powinien zmienić się na **Custom active**.

## Jak zachować szablon i z niego nie korzystać

Pod podglądem znajduje się przełącznik **Apply this override**. Jego tekst pomocniczy brzmi "Turn this off to keep the template saved without using it." Wyłącz go, żeby przechować roboczą wersję, a funkcja dalej będzie używać wbudowanego szablonu domyślnego. Kafelek stanu pokazuje wtedy **Custom paused**.

## Powrót do wbudowanego szablonu

Kliknij przycisk **Reset to Default**, żeby porzucić własny szablon i wrócić do wbudowanego. Jeśli zapisane nadpisanie istnieje, aplikacja najpierw prosi o potwierdzenie. Kafelek stanu wraca do stanu **Default**.

## Kiedy nadpisania zaczynają działać

Nadpisanie **Prompt Override** ma znaczenie tylko dla funkcji, które faktycznie generują obrazy lub wideo: zasobów w trybie Game Mode, selfie i rozmów w trybie Conversation, sprite'ów oraz obrazów do postów w sieci Noodle. Te funkcje wymagają też wcześniej skonfigurowanego połączenia do generowania obrazów lub wideo. Bez działającego połączenia nic się nie uruchomi, a szablon nigdy nie zostanie użyty. Zobacz [Dostawcy generowania obrazów i konfiguracja](../media/image-providers.md) i [Generowanie wideo sceny](../media/scene-video.md).

## Powiązane przewodniki

- [Dostawcy generowania obrazów i konfiguracja](../media/image-providers.md)
- [Generowanie wideo sceny](../media/scene-video.md)
- [Profile stylu obrazów](../media/style-profiles.md)
- [Ustawienia Noodle i przeniesienie do czatów](../noodle/settings.md)
- [Edytor presetów i menedżer promptów](presets.md)
- [Parametry generowania](generation-parameters.md)
