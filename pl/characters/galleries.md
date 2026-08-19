# Galerie postaci i person

Ten przewodnik opisuje zakładkę **Gallery** (Galeria) w edytorze postaci i w edytorze persony. Wyjaśnia, jak dodawać obrazy i wideo, które zostają przypisane do postaci lub persony. Pokazuje też, jak oznaczyć obraz z galerii jako własne emoji albo naklejkę.

## Zakładka **Gallery**

Każda postać i każda persona ma własną zakładkę **Gallery**. Otwórz postać w panelu **Character Editor** (edytor postaci) albo personę w panelu **Persona Editor** (edytor persony), a potem kliknij zakładkę **Gallery** (ikona aparatu).

Galeria ma dwie podzakładki:

- **Images**: obrazy wgrane dla tej postaci lub persony.
- **Videos**: wgrane pliki wideo, a także wideo ze scen i nagrania z rozmów wideo powiązane z tą postacią.

Galeria postaci nosi tytuł **Character Gallery**. Galeria persony nosi tytuł **Persona Gallery**. Obie działają tak samo.

## Czym galeria różni się od galerii czatu

Obrazy z galerii należą do postaci lub persony, a nie do pojedynczego czatu. Po usunięciu czatu te obrazy zostają. Galeria nadaje się na arkusze referencyjne, warianty strojów i zaimportowane paczki obrazów postaci.

Galeria samego czatu działa inaczej. Trzyma ilustracje do konkretnych scen i wygenerowane załączniki wiadomości z tego jednego czatu. Krótko żyjące grafiki scen trzymaj w galerii czatu. Trwałe grafiki postaci trzymaj w zakładce **Gallery** postaci lub persony.

## Dodawanie obrazów

1. Otwórz edytor postaci lub edytor persony.
2. Kliknij zakładkę **Gallery**.
3. Sprawdź, czy wybrana jest podzakładka **Images**.
4. Przeciągnij pliki obrazów na pole **Upload Character Images** albo kliknij je, żeby wybrać pliki. W personie to pole nosi nazwę **Upload Persona Images**.
5. Poczekaj na koniec wgrywania. Nowe obrazy pojawiają się w siatce poniżej.

Galeria przyjmuje popularne formaty obrazów: JPG, PNG, GIF, WebP i AVIF. Kliknięcie obrazu otwiera większy podgląd. Każdy kafelek ma też przycisk pobierania i przycisk usuwania.

## Dodawanie wideo

1. Kliknij zakładkę **Gallery**.
2. Wybierz podzakładkę **Videos**.
3. Przeciągnij pliki wideo na pole **Upload Character Videos** albo kliknij je, żeby wybrać pliki. W personie to pole nosi nazwę **Upload Persona Videos**.
4. Poczekaj na koniec wgrywania.

Obsługiwane formaty wideo to MP4, WebM i MOV. Podzakładka **Videos** pokazuje też wideo ze scen wygenerowane w czatach z tą postacią oraz nagrania z rozmów wideo. Najnowsze pliki są na początku listy.

## Oznaczanie obrazu z galerii jako własne emoji lub naklejka

Obraz z galerii da się zamienić we własne emoji albo w naklejkę dla trybu **Conversation Mode** (czat w stylu komunikatora). Własne emoji to mały obrazek w linii tekstu, zapisywany jako `:name:`. Naklejka to większy obrazek w osobnym bloku, zapisywany jako `sticker:name:`. Działa to wyłącznie w czatach w trybie Conversation Mode.

Aby oznaczyć obraz:

1. Otwórz zakładkę **Gallery** i wybierz podzakładkę **Images**.
2. Znajdź wybrany obraz. W jego lewym górnym rogu jest mały przycisk oznaczania z podpowiedzią **Tag as emoji or sticker**.
3. Kliknij przycisk oznaczania. Otwiera się menu z pozycjami **Make emoji** i **Make sticker**.
4. Kliknij **Make emoji** albo **Make sticker**.
5. W oknie **Custom Emoji** lub **Custom Sticker** wpisz nazwę i zatwierdź.

Nazwa może zawierać małe litery, cyfry i podkreślenia, maksymalnie 32 znaki. Pozostałe znaki Marinara zamienia sama. Na przykład "Big Grin" zmienia się w `big_grin`.

Limity rozmiaru zależą od wybranego rodzaju, a nie od galerii. Obraz emoji nie może przekraczać 256 na 256 pikseli. Obraz naklejki nie może przekraczać 512 na 512 pikseli. Przy zbyt dużym obrazie pojawia się komunikat o błędzie, a oznaczenie nie zostaje nadane.

### Zarządzanie oznaczonym obrazem

Po oznaczeniu obrazu przycisk na jego miniaturze pokazuje nadaną nazwę. Kliknięcie go otwiera menu z dalszymi opcjami:

- **Rename**: zmiana nazwy.
- **Switch to sticker** lub **Switch to emoji**: zmiana rodzaju. Przy zmianie Marinara ponownie sprawdza limit rozmiaru nowego rodzaju. Naklejka większa niż 256 na 256 pikseli jest za duża, żeby stać się emoji. W takiej sytuacji pojawia się błąd, a rodzaj zostaje bez zmian.
- **Remove emoji** lub **Remove sticker**: usunięcie oznaczenia. Sam obraz zostaje w zakładce **Gallery**.

### Gdzie działają te przypisane emoji i naklejki

Emoji lub naklejka oznaczona w galerii należy tylko do tej jednej postaci lub persony. Działa wyłącznie w czatach w trybie Conversation Mode z udziałem tej postaci lub persony. To co innego niż globalne zbiory emoji i naklejek dostępne w polu pisania wiadomości.

Jeśli nazwa z galerii pokrywa się z nazwą ze zbioru globalnego, dla tego czatu wygrywa wersja z galerii. Marinara nie sprawdza, czy nazwy się nie powtarzają. Nadawaj każdemu obrazowi inną nazwę, żeby uniknąć niespodzianek.

## Ponowne używanie obrazu z galerii w wiadomościach i powitaniach

Każdy obraz z galerii postaci można wyświetlić w treści czatu: powitaniu, przykładowej wiadomości lub wiadomości wysyłanej przez postać. Najedź na obraz i kliknij **Copy image reference** (ikonę łącza). Skopiuje to krótki fragment Markdown, który można wkleić wszędzie tam, gdzie mówi postać:

```text
![sunset selfie](card://self/gallery/k3m2xq7.png)
```

Obowiązuje jedna zasada: **`self` oznacza postać wypowiadającą daną wiadomość.** Podczas wyświetlania Marinara Engine zastępuje `self` tą postacią i pokazuje obraz z jej galerii.

Działa to w polach **First Message**, **Alternate Greetings** i **Example Dialogue** na karcie postaci, w każdej wiadomości wysyłanej przez postać w trybie Roleplay i Conversation oraz na czatach grupowych. W odpowiedzi wielu rozmówców `self` jest rozwiązywane osobno dla każdego z nich. Jeśli galeria rozmówcy nie ma pliku, Marinara Engine przeszukuje galerie pozostałych postaci z czatu.

Z założenia nie działa to we własnych wiadomościach, które nie mają mówiącej postaci, ani w wiadomościach systemowych, które nie wyświetlają obrazów Markdown. Aby samodzielnie wysłać obraz postaci, użyj przeglądarki zasobów czatu zapisującej pełną postać `card://characters/<id>/...`. Galerie persony używają formatu `card://personas/<id>/gallery/<file>`.

Jeśli dwie postacie mają obrazy o tej samej nazwie pliku, zawsze wygrywa obraz mówiącej postaci. Jeśli go nie ma, używane jest pierwsze dopasowanie według kolejności postaci na czacie. Gdy potrzebujesz konkretnej wersji, nadawaj plikom różne nazwy.

### Dlaczego `self`, a nie pełne łącze

Pełne łącze zawiera wewnętrzny identyfikator postaci (`card://characters/<id>/gallery/<file>`), który powstaje od nowa przy każdym imporcie, dlatego takie łącza psują się po udostępnieniu postaci. Format `self` nie zawiera identyfikatora ani adresu serwera. Przetrwa **natywny eksport i import JSON**: obrazy galerii podróżują w eksporcie i zachowują nazwy plików.

Jest jedno ograniczenie: **eksport karty PNG nie zawiera galerii**. Jeśli postać używa odwołań do galerii, udostępniaj natywny plik `.json`.

## Powiązane przewodniki

- [Tworzenie i edycja postaci](creating-and-editing-characters.md)
- [Persony użytkownika: tworzenie i edycja](personas.md)
- [Własne emoji, naklejki i GIF-y](../conversation/emoji-stickers-gifs.md)
- [Tła scen i galeria](../media/scene-backgrounds.md)
