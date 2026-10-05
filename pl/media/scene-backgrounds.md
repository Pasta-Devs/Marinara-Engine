# Tła scen i galeria

Ten przewodnik opisuje tła scen generowane przez AI, czyli obrazy, które aplikacja Marinara Engine tworzy z poziomu **Gallery** (galeria), oraz samą galerię. Są też dwa pokrewne przewodniki: [Tła czatu](../appearance/chat-backgrounds.md) opisuje bibliotekę wgranych obrazów wybieranych ręcznie, a [Tła w trybie Roleplay](../roleplay/backgrounds.md) – agenta, który sam dobiera tło w każdej turze.

## Gdzie działają tła scen

Tła scen działają w trybie Roleplay i w trybie Game Mode. W trybie Conversation nie są dostępne. Przy próbie wygenerowania tła w trybie Conversation aplikacja pokazuje taki komunikat:

```
Scene background generation is available in Roleplay and Game modes.
```

Do wygenerowania tła potrzebne jest połączenie **Image Generation** (generowanie obrazów). Jeśli takiego jeszcze nie ma, skonfiguruj je najpierw. Zobacz [Dostawcy generowania obrazów i konfiguracja](image-providers.md).

## Generowanie i ustawianie tła z poziomu panelu Gallery

**Gallery** zbiera obrazy i wideo z danego czatu. Jest sekcją w **Chat Settings**: otwórz Chat Settings i rozwiń **Gallery**. Na komputerze możesz otworzyć ją w osobnym oknie (zobacz [Panel **Chat Settings** – przegląd](../chats/chat-settings.md#popping-a-section-out-into-its-own-window)). Przycisk **Background** (tło) generuje grafikę tła dla bieżącej sceny.

Jak wygenerować tło:

1. Otwórz sekcję **Gallery** w **Chat Settings**.
2. Kliknij przycisk **Background**.
3. Na czas tworzenia obrazu napis na przycisku zmienia się na **Generating...**.
4. Powinien pojawić się taki komunikat o stanie: "AI background generation is running. The new background will be applied when it finishes."
5. Po zakończeniu nowy obraz od razu trafia do bieżącej sceny. Potwierdza to komunikat "Background generated.".

Tło powstaje na podstawie bieżącej sceny. W grze liczą się też gatunek, świat, lokalizacja, pogoda i pora dnia. Wygenerowane tła mają rozmiar obszaru roboczego **Backgrounds**, domyślnie 1280 na 720 pikseli. Rozmiar da się zmienić w sekcji **Settings** (ustawienia), dalej **Generations**, dalej **Image Generation**.

### Gdy nie ma ustawionego połączenia do obrazów

Jeśli Marinara nie znajdzie połączenia do obrazów, generowanie kończy się takim komunikatem:

```
Choose an image generation connection for the Illustrator agent, or mark one as the default image connection.
```

Aby to naprawić, otwórz panel **Connections** (połączenia), rozwiń sekcję **Defaults** i wybierz połączenie do obrazów w sekcji **Images**. Druga opcja: ustaw osobne połączenie do obrazów bezpośrednio w agencie **Illustrator**.

## Sekcja Gallery

Panel **Gallery** ma dwie zakładki: **Images** i **Videos**. Każda z nich pokazuje liczbę elementów, które zawiera. Zakładka **Videos** jest dostępna tylko wtedy, gdy dla czatu włączono wideo ze scen.

Na górze sekcji przyciski akcji pojawiają się tylko wtedy, gdy dana funkcja dotyczy tego czatu:

- **Illustrate**: uruchamia agenta Illustrator i tworzy pojedynczy obraz sceny. Zobacz [Agent Illustrator](illustrator-agent.md).
- **Selfie**: generuje selfie postaci w trybie Conversation.
- **Background**: generuje i ustawia tło sceny, tak jak opisano wyżej.
- **Video**: tworzy wideo ze sceny na podstawie najnowszej ilustracji.
- **Create storyboard**: generuje klatki kluczowe dla ostatniej tury w trybie Game Mode albo dla zakończonego odcinka w trybie Roleplay, gdy storyboard jest aktywny.
- **Browse Images**: otwiera przeglądarkę zapisanych obrazów do wstawienia.
- **View storyboard**: otwiera najnowszy storyboard z trybu Game Mode.

Pod przyciskami znajduje się pole **Upload Images** (wgrywanie obrazów). Przeciągnij na nie obrazy, żeby dodać własne zdjęcia do panelu **Gallery** tego czatu.

### Akcje dla pojedynczego obrazu

Najedź kursorem na dowolny obraz w zakładce **Images** – albo dotknij go na telefonie – żeby pokazać dostępne akcje:

- Otwarcie obrazu w pełnym rozmiarze (**Open gallery image**).
- **Pin to chat**: przypina obraz do czatu.
- **Download image**: zapisuje obraz na urządzeniu.
- **Animate illustration**: zamienia ten obraz w wideo ze sceny.
- **Copy prompt**: kopiuje zapisany prompt obrazu, czyli tekst wysłany do AI. Jeśli obraz nie ma zapisanego promptu, przycisk jest nieaktywny i pokazuje **No prompt saved**.
- **Delete gallery image**: usuwa obraz po potwierdzeniu.

## Sprawdzanie promptu przed wysłaniem

Prompt da się sprawdzić i poprawić, zanim Marinara wyśle żądanie tła do dostawcy obrazów.

1. Otwórz **Settings**, dalej **Generations**, dalej **Image Generation**.
2. Włącz opcję **Expose media prompts before sending**.

Przy włączonej opcji przed każdym żądaniem otwiera się okno **Review Image Prompt**. Tekst pomocy brzmi: "Edit the prompt below before Marinara sends the image request to your provider."

W tym oknie da się:

- Poprawić treść promptu i prompt negatywny.
- Zobaczyć rodzaj i rozmiar obrazu oraz licznik znaków aktualizowany na bieżąco.
- Kliknąć przycisk **Cancel**, żeby przerwać, albo **Generate**, żeby wysłać.

Jeśli któreś pole promptu jest puste, przycisk **Generate** pozostaje nieaktywny, a na ekranie widać uwagę: "Every image request needs a prompt." Wpisany tekst trafia dalej dokładnie w takiej postaci.

## Zarządzanie zapisanymi tłami

Każde wygenerowane tło sceny trafia do biblioteki teł. Do tej samej biblioteki da się dodać własne obrazy. Wgrywane tła obsługują pliki JPG, PNG, GIF, WebP i AVIF o rozmiarze do 20 MB każdy.

Samodzielnie dodane tła da się tagować, przemianować i usuwać. Tagi zapisują się małymi literami i mogą zawierać litery, cyfry, spacje, łączniki oraz podkreślenia, maksymalnie 40 znaków każdy. Wbudowane tła z zasobów gier są widoczne obok własnych, ale nie da się ich przemianować, otagować ani usunąć.

Biblioteką zarządza się w ustawieniach wyglądu – tam też ustawisz tło dla pojedynczego czatu lub tło domyślne. Pełny opis biblioteki, okna wyboru i opcji **Background Blur** znajdziesz w przewodniku [Tła czatu](../appearance/chat-backgrounds.md).

## Pokrewne przewodniki

- [Tła czatu](../appearance/chat-backgrounds.md): biblioteka wgranych obrazów, z której wybierasz ręcznie.
- [Tła w trybie Roleplay](../roleplay/backgrounds.md): agent, który sam dobiera tło w każdej turze.
- [Agent Illustrator](illustrator-agent.md): ilustracje scen w trybie Roleplay i w trybie Game Mode.
- [Dostawcy generowania obrazów i konfiguracja](image-providers.md): konfiguracja połączenia do obrazów.
- [Generowanie wideo sceny](scene-video.md): zamiana obrazu z panelu **Gallery** w wideo.
