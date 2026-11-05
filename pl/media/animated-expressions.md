# Animowane wyrazy twarzy

Animowane wyrazy twarzy to krótkie zapętlone animacje używane jako portretowe sprite'y postaci. Sprite to grafika przedstawiająca postać, którą Marinara pokazuje w trakcie czatu. Zwykły sprite wyrazu twarzy to nieruchomy obrazek, na przykład uśmiechnięta twarz. Animowany wyraz twarzy odtwarza się w jego miejsce i jest zapisywany jako GIF, czyli plik graficzny, który sam odtwarza krótką animację w pętli.

Marinara tworzy go w dwóch krokach. Prosi konto **Video Generation** (generowanie wideo) o krótki klip z danym wyrazem twarzy, a potem zamienia ten klip na zapętlony GIF na twoim komputerze. Po zapisaniu działa on jak każdy inny sprite. Agent do pobrania **Expression Engine** pokazuje go wtedy, gdy scena wymaga danej emocji. Zobacz [Sprite'y postaci](../characters/sprites.md) i [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md).

<a id="before-you-start"></a>

## Zanim zaczniesz

Potrzebne są dwie rzeczy.

1. Konto wideo. Sposób jego dodania opisuje przewodnik [Generowanie wideo sceny](scene-video.md).
2. Program ffmpeg na komputerze, na którym działa Marinara. ffmpeg to darmowe narzędzie multimedialne, które zamienia klip na GIF.

Jeśli brakuje programu ffmpeg, generowanie od razu kończy się takim komunikatem:

```text
Animated expression GIF conversion requires ffmpeg. Install ffmpeg and make it available on PATH, or set FFMPEG_PATH.
```

Zainstaluj ffmpeg tak, żeby system go znajdował, albo ustaw zmienną środowiskową `FFMPEG_PATH` na pełną ścieżkę do programu ffmpeg. Zmienna środowiskowa to ustawienie przekazywane serwerowi przed jego uruchomieniem.

## Generowanie animowanych wyrazów twarzy

Używasz tego samego okna co przy nieruchomych sprite'ach.

1. Otwórz **Character Editor** (edytor postaci) dla postaci albo **Persona Editor** (edytor persony) dla persony.
2. Otwórz zakładkę **Sprites**, a potem kategorię **Facial Expressions**.
3. Kliknij **Generate Sprite** (generowanie sprite'a). Otwiera się okno **Generate Sprites**.
4. Zaznacz **Generate animated portraits** (generowanie animowanych portretów). Okno przełącza się w tryb animowany. Selektor obrazów zmienia się w selektor wideo, znikają ustawienia siatki dla arkuszy sprite'ów, a Marinara tworzy po jednym wyrazie twarzy naraz.
5. Wybierz konto wideo.
6. Wypełnij pole **Appearance Description** (opis wyglądu), żeby usługa wiedziała, jak wygląda postać.
7. Wybierz wyrazy twarzy do wygenerowania.
8. Kliknij **Generate Animated Portrait** dla jednego wyrazu twarzy albo **Generate Animated Portraits** dla kilku.

W trakcie pracy widać komunikat "Generating animated portrait GIFs...". Po zakończeniu obejrzyj wyniki i kliknij przycisk zapisu, żeby dodać je do postaci albo persony. Jeśli któryś wyraz twarzy się nie uda, Marinara zachowuje gotowe i wypisuje nazwy nieudanych, żeby dało się spróbować ponownie.

Animowane wyrazy twarzy powstają dłużej niż nieruchome sprite'y, bo Marinara tworzy je po jednym. Zacznij od kilku.

Gdy włączona jest opcja **Expose media prompts before sending** (pokazywanie promptów mediów przed wysłaniem) w **Settings → Generations → Overall Generations** (ustawienia, generowanie, ogólne ustawienia generowania), Marinara zatrzymuje się, żeby każdy prompt dało się przeczytać i poprawić, zanim trafi do usługi.

## Długość i proporcje

Każdy animowany wyraz twarzy to pionowy klip portretowy w proporcjach 9:16, których nie da się zmienić. Aby zmienić długość każdego klipu, otwórz **Settings → Generations** (ustawienia, generowanie), znajdź **Video Generation** i ustaw **Animated expression length**. Wartość domyślna to 3 sekundy, a zakres to od 1 do 8 sekund. Marinara zapisuje mały zapętlony GIF o szerokości 512 pikseli. Krótszy klip daje mniejszy plik i zwartszą pętlę.

<a id="backgrounds-are-not-removed"></a>

## Tło nie jest usuwane

Nieruchomym sprite'om można usunąć tło, dzięki czemu postać unosi się nad sceną. Animowane wyrazy twarzy pomijają to czyszczenie. W trybie animowanym pole wyboru **Prefer clean transparent-style background** dodaje jedynie wskazówkę do promptu wideo (prompt to tekst, który Marinara wysyła do AI). Jego opis mówi: "GIF transparency is not guaranteed." Krok przeglądu informuje, że przy wyniku w formacie GIF pomijane jest czyszczenie tła, cięcie arkusza i przycinanie klatek. Animowany wyraz twarzy może zachować widoczne tło. Jeśli zależy ci na czystszym efekcie, poproś o jednolite tło w polu **Appearance Description**.

## Rozwiązywanie problemów

- **Generowanie kończy się komunikatem o programie ffmpeg**: zainstaluj ffmpeg albo ustaw `FFMPEG_PATH`. Zobacz [Zanim zaczniesz](#before-you-start).
- **Selektor informuje, że nie znaleziono kont wideo**: najpierw dodaj konto. Zobacz [Generowanie wideo sceny](scene-video.md).
- **Przycisk Generate Sprite jest nieaktywny**: na części urządzeń, na przykład w niektórych instalacjach na system Android i w środowisku Termux, Marinara nie może wczytać swojej biblioteki graficznej. Wyłącza to całe generowanie sprite'ów, w tym animowane wyrazy twarzy.
- **Zapisany GIF nadal pokazuje tło**: tak ma być. Zobacz [Tło nie jest usuwane](#backgrounds-are-not-removed).

## Powiązane przewodniki

- [Sprite'y postaci](../characters/sprites.md)
- [Generowanie wideo sceny](scene-video.md)
- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)
