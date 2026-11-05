# Prompt Overrides dla obrazów i wideo

Prompt Overrides (nadpisania promptów) to edytory szablonów, według których Marinara pisze prompty (tekst, który Marinara wysyła do AI) dla modeli obrazów i wideo. Za ich pomocą zmienisz, jak portrety, selfie, sprite'y, grafiki scen, storyboardy albo klipy wideo są opisywane modelowi.

Nie zmieniają one promptu wysyłanego do modelu czatu. Do tego służy preset. Zobacz [Edytor presetów i menedżer promptów](presets.md) i [Parametry generowania](generation-parameters.md).

Sprite to element grafiki postaci, na przykład wyraz twarzy albo poza. Storyboard to zestaw ilustrowanych klatek z jednej tury w trybie Game Mode albo z ukończonego odcinka w trybie Roleplay.

Zanim zaczniesz: Prompt Overrides mają znaczenie tylko dla funkcji, które generują obrazy lub wideo, a te wymagają najpierw konta do generowania obrazów lub wideo. Bez niego szablon nigdy nie zostanie użyty. Zobacz [Dostawcy generowania obrazów i konfiguracja](../media/image-providers.md) i [Generowanie wideo sceny](../media/scene-video.md).

## Gdzie znaleźć edytory

1. Otwórz panel **Settings** (Ustawienia).
2. Kliknij zakładkę **Generations** (generowanie).
3. Przewiń do sekcji **Prompt Overrides** ("Reusable image and video prompt templates").

Są tam dwa edytory. Kliknij tytuł, żeby go rozwinąć.

| Edytor | Obsługiwane szablony |
| --- | --- |
| **Video Generation Prompt Overrides** | Wideo ze scen w trybie Game Mode i w galerii, wiadomości wideo w trybie Conversation, klipy postaci z rozmów w trybie Conversation, animowane portrety z wyrazem twarzy. |
| **Image Generation Prompt Overrides** | Selfie z trybu Conversation, portrety postaci NPC w trybie Game Mode, grafiki scen, prompty do storyboardów, szablon **Noodle Post Image** i inne generatory obrazów. |

## Edytowanie szablonu

1. Otwórz edytor.
2. Wybierz szablon z listy rozwijanej **Registered prompt** (zarejestrowany prompt). Zawartość listy zależy od edytora.
3. Sprawdź kafelek stanu obok niej i przeczytaj krótki opis pod listą rozwijaną.
4. W sekcji **Available variables** (dostępne zmienne) kliknij kafelek zmiennej, żeby ją wstawić. Zmienne mają postać `${charName}`.
5. Zmień tekst w polu **Template** (szablon).
6. Sprawdź pole **Rendered preview** (podgląd wyniku). Uzupełnia ono szablon przykładowymi wartościami.
7. Popraw każde ostrzeżenie **Unknown variables** (nieznane zmienne). Nazwa spoza listy **Available variables** nie zostanie uzupełniona.
8. Kliknij przycisk **Save** (zapis).

Pojawi się komunikat "Prompt override saved", a kafelek stanu zmieni się na **Custom active**.

| Kafelek stanu | Znaczenie |
| --- | --- |
| **Default** | Nie zapisano żadnego własnego szablonu. |
| **Custom active** | Używany jest twój zapisany szablon. |
| **Custom paused** | Twój szablon jest zapisany, ale wyłączony. |

## Jak zachować szablon i z niego nie korzystać

Wyłącz przełącznik **Apply this override** (stosowanie tego nadpisania) pod podglądem. Jego tekst pomocy brzmi "Turn this off to keep the template saved without using it." Marinara nadal używa wbudowanego szablonu, a kafelek stanu pokazuje **Custom paused**.

## Powrót do wbudowanego szablonu

Kliknij przycisk **Reset to Default** (przywrócenie domyślnego). Jeśli zapisano nadpisanie, Marinara poprosi o potwierdzenie. Kafelek stanu wraca do **Default**.

## Powiązane przewodniki

- [Dostawcy generowania obrazów i konfiguracja](../media/image-providers.md)
- [Generowanie wideo sceny](../media/scene-video.md)
- [Profile stylu obrazów](../media/style-profiles.md)
- [Ustawienia Noodle i przeniesienie do czatów](../agents/noodle-settings.md)
- [Edytor presetów i menedżer promptów](presets.md)
- [Parametry generowania](generation-parameters.md)
