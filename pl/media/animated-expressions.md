# Animowane wyrazy twarzy

Ten przewodnik wyjaśnia, czym są animowane wyrazy twarzy w aplikacji Marinara Engine: to krótkie zapętlone animacje używane zamiast portretowych sprite'ów postaci. Sprite (obrazek postaci na obszarze sceny) to grafika, którą Marinara pokazuje dla postaci w trakcie czatu. Dzięki animowanym wyrazom twarzy takie portrety się poruszają, zamiast stać w miejscu.

## Czym są animowane wyrazy twarzy

Zwykły sprite wyrazu twarzy to nieruchomy obrazek, na przykład uśmiechnięta albo zła twarz. Animowany wyraz twarzy to krótka zapętlona animacja, która odtwarza się w miejsce takiego obrazka. Marinara zapisuje każdy z nich jako sprite w formacie GIF. GIF to plik graficzny, który sam odtwarza krótką animację w pętli.

Marinara tworzy animowany wyraz twarzy w dwóch krokach. Najpierw prosi połączenie typu **Video Generation** (generowanie wideo) o krótki klip wideo z danym wyrazem twarzy. Potem zamienia ten klip na zapętlony sprite w formacie GIF, lokalnie na twoim urządzeniu.

Po zapisaniu animowany wyraz twarzy działa jak każdy inny sprite. Agent **Expression Engine** do pobrania wybiera go i pokazuje wtedy, gdy scena wymaga danej emocji. O tym, jak wyświetlają się sprite'y, przeczytasz w przewodniku [Sprite'y postaci](../characters/sprites.md), a o agencie Expression Engine – w przewodniku [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md).

## Zanim zaczniesz

Do generowania animowanych wyrazów twarzy potrzebne są dwie rzeczy.

1. Połączenie typu **Video Generation**. To zapisany skrót do dostawcy, który potrafi tworzyć wideo. Sposób dodania opisuje przewodnik [Generowanie wideo sceny](scene-video.md).
2. Program ffmpeg zainstalowany na urządzeniu, na którym działa Marinara. ffmpeg to darmowe narzędzie multimedialne, które zamienia klip wideo na sprite w formacie GIF.

Jeśli programu ffmpeg nie da się znaleźć, generowanie kończy się od razu takim komunikatem:

```
Animated expression GIF conversion requires ffmpeg. Install ffmpeg and make it available on PATH, or set FFMPEG_PATH.
```

Rozwiązanie: zainstaluj ffmpeg i zadbaj o to, żeby system go widział. Inna opcja: ustaw zmienną środowiskową `FFMPEG_PATH` na pełną ścieżkę do programu ffmpeg. Zmienna środowiskowa to ustawienie przekazywane serwerowi przed jego uruchomieniem.

## Włączanie animowanych portretów

Animowane wyrazy twarzy generuje się w tym samym oknie, co zwykłe sprite'y.

1. Otwórz panel **Character Editor** (edytor postaci) dla wybranej postaci albo panel **Persona Editor** (edytor persony) dla persony.
2. Przejdź do zakładki **Sprites**, a następnie do kategorii **Facial Expressions**.
3. Kliknij przycisk **Generate Sprite**. Otwiera się okno **Generate Sprites**.
4. Zaznacz pole wyboru **Generate animated portraits**. Okno przełącza się w tryb animowany:
   - Lista wyboru połączenia zmienia się z **Image Generation Connection** na **Video Generation Connection**.
   - Znikają ustawienia siatki dla arkuszy nieruchomych sprite'ów.
   - Marinara generuje teraz po jednym wyrazie twarzy naraz, a nie cały arkusz.
5. Wybierz połączenie **Video Generation Connection** z listy rozwijanej.
6. Wypełnij pole **Appearance Description**, żeby dostawca wiedział, jak wygląda postać.
7. Zaznacz, które wyrazy twarzy mają powstać.
8. Kliknij przycisk **Generate Animated Portrait** dla jednego wyrazu twarzy albo **Generate Animated Portraits** dla kilku.

W trakcie pracy widać komunikat "Generating animated portrait GIFs...". Każdy wyraz twarzy staje się najpierw krótkim wideo, a potem Marinara zamienia go na sprite w formacie GIF.

Po zakończeniu generowania obejrzyj wyniki i kliknij przycisk zapisu, żeby dodać je do postaci albo persony. Jeśli któryś wyraz twarzy się nie uda, Marinara zachowuje te gotowe. Wypisuje też nazwy nieudanych, żeby dało się spróbować ponownie.

## Długość i proporcje

Każdy animowany wyraz twarzy to pionowy klip portretowy. Proporcje są ustalone na 9:16 (pionowo) i nie da się ich zmienić.

Długość pojedynczego klipu możesz zmienić. Otwórz panel **Settings** (ustawienia) i znajdź sekcję **Video Generation**. Ustawienie nazywa się **Animated expression length**. Domyślnie ma wartość 3 sekundy, a zakres to od 1 do 8 sekund.

Marinara zapisuje gotowy wynik jako mały zapętlony plik GIF o szerokości 512 pikseli. Krótszy klip to mniejszy plik i szybsza, zwartsza pętla.

## Uwaga o przezroczystości

Nieruchomym sprite'om można usunąć tło, dzięki czemu postać unosi się nad sceną. Z animowanymi wyrazami twarzy jest inaczej: Marinara nie czyści dla nich tła.

W trybie animowanym pole wyboru przezroczystego tła nosi nazwę **Prefer clean transparent-style background**. To pole dodaje jedynie wskazówkę do promptu wideo (prompt to tekst, który Marinara wysyła do AI). Podpowiedź mówi o tym wprost: "Adds a flat transparent-friendly background instruction to the video prompt. GIF transparency is not guaranteed."

Krok przeglądu wyników potwierdza to samo. Pokazuje taką informację: "Animated portrait sprites are saved as looping GIFs. Static background cleanup, sheet slicing, and frame cropping are skipped for GIF output." Animowany wyraz twarzy może więc zachować widoczne tło. Jeśli zależy ci na czystszym efekcie, poproś o jednolite tło w polu **Appearance Description**.

## Czego się spodziewać

Animowane wyrazy twarzy powstają dłużej niż nieruchome sprite'y. Marinara generuje je po jednym, a nie partiami. Zaznaczenie wielu wyrazów twarzy naraz potrafi trwać, więc zacznij od kilku.

Jeśli opcja **Expose media prompts before sending** jest włączona (w panelu **Settings**, w sekcji **Overall Generations**), Marinara zatrzymuje się na kroku przeglądu promptów. Każdy prompt można wtedy przeczytać i poprawić, zanim Marinara wyśle go do dostawcy. Zostaw to ustawienie wyłączone, żeby pominąć przegląd.

## Rozwiązywanie problemów

Generowanie kończy się komunikatem o programie ffmpeg. Zainstaluj ffmpeg i zadbaj o to, żeby serwer go widział, albo ustaw zmienną środowiskową `FFMPEG_PATH`. Zajrzyj wyżej do sekcji "Zanim zaczniesz".

Lista rozwijana informuje, że nie znaleziono żadnych połączeń do generowania wideo. Dodaj najpierw połączenie typu **Video Generation**. Zobacz przewodnik [Generowanie wideo sceny](scene-video.md).

Przycisk **Generate Sprite** jest nieaktywny. Na części urządzeń Marinara nie może wczytać swojej biblioteki graficznej, co wyłącza całe generowanie sprite'ów, w tym animowane wyrazy twarzy. Zdarza się to przy niektórych instalacjach na Android i Termux.

Zapisany plik GIF nadal pokazuje tło. Tak ma być. Animowane wyrazy twarzy pomijają czyszczenie tła. Zajrzyj wyżej do sekcji "Uwaga o przezroczystości".

## Powiązane przewodniki

- [Sprite'y postaci](../characters/sprites.md)
- [Generowanie wideo sceny](scene-video.md)
- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)
