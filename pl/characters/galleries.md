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

Obsługiwane formaty wideo to MP4, WebM i MOV. Podzakładka **Videos** pokazuje też wideo ze scen wygenerowane w czatach z tą postacią oraz nagrania z rozmów wideo. Najnowsze pliki są na początku listy. Wiadomość wideo z trybu Conversation jest wymieniana tylko u postaci, które pokazuje. To postać, która ją wysłała, oraz każdy, kogo tekst wymienia z imienia. Wystarczy samo imię, jeśli nikt inny na czacie go nie nosi, o ile zapisano je wielką literą. Gdy tekst prosi o zdjęcie grupowe albo grupowe selfie, uwzględniany jest każdy uczestnik czatu. Imiona wypowiedziane w cudzysłowie się nie liczą. Galeria twojej persony wymienia klip tylko wtedy, gdy tekst wymienia twoją personę. Starsze wideo oraz wideo z czatów w trybach Roleplay i Game Mode są wymieniane u każdej postaci i u persony z ich czatu.

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

<a id="reuse-a-gallery-image-in-messages-and-greetings"></a>

## Ponowne używanie obrazu z galerii w wiadomościach i powitaniach

Każdy obraz z galerii postaci można wyświetlić w treści czatu: powitaniu, przykładowej wiadomości lub wiadomości wysyłanej przez postać. Najedź na obraz i kliknij **Copy image reference** (ikonę łącza). Skopiuje to krótki fragment Markdown, który można wkleić wszędzie tam, gdzie mówi postać:

```text
![sunset selfie](card://self/gallery/k3m2xq7.png)
```

Obowiązuje jedna zasada: **`self` oznacza postać wypowiadającą daną wiadomość.** Podczas wyświetlania Marinara Engine zastępuje `self` tą postacią i pokazuje obraz z jej galerii.

Gdzie to działa:

- Pola **First Message**, **Alternate Greetings** i **Example Dialogue** na karcie postaci. Podgląd Markdown pola pokazuje obraz już podczas edycji.
- Każda wiadomość wysyłana przez postać, zarówno w trybie **Roleplay**, jak i **Conversation**.
- **Czaty grupowe**: w odpowiedzi wielu rozmówców `self` jest rozwiązywane osobno dla każdego z nich, więc wypowiedź każdej postaci pokazuje obraz z jej własnej galerii. Jeśli galeria rozmówcy nie ma pliku, Marinara Engine przeszukuje galerie pozostałych postaci z czatu, więc właściwy obraz pojawia się nawet wtedy, gdy odpowiedź zostanie połączona pod jednym rozmówcą.

Gdzie to z założenia nie działa:

- **Twoje własne wiadomości**. Nie mają mówiącej postaci, więc odwołanie `self` wyświetla się jako uszkodzony obraz. Aby samodzielnie wysłać obraz z galerii postaci, użyj wstawiania z przeglądarki zasobów czatu (zapisuje ono pełną postać `card://characters/<id>/...`).
- **Wiadomości systemowe**. W ogóle nie wyświetlają składni obrazów Markdown, więc odwołanie pojawia się jako zwykły tekst.
- **Galerie person**. Obrazy persony pojawiają się w twoich wiadomościach, które nie mają rozmówcy. Zamiast tego użyj formatu persony `card://personas/<id>/gallery/<file>`.

Jedna uwaga dotycząca czatów grupowych: jeśli dwie postacie na czacie mają w galeriach obrazy o **tej samej nazwie pliku**, zawsze wygrywa obraz mówiącej postaci. Gdy rozmówca nie ma tego pliku, **wygrywa pierwsze dopasowanie**: pozostałe postacie są sprawdzane w kolejności postaci na czacie. Jeśli w wypowiedzi innej postaci ma się pokazać wersja konkretnej postaci, nadaj obrazom o wspólnej nazwie różne nazwy plików.

### Dlaczego `self`, a nie pełne łącze

Pełne łącze zawiera wewnętrzny identyfikator postaci (`card://characters/<id>/gallery/<file>`), który powstaje od nowa przy każdym imporcie, dlatego takie łącza psują się po udostępnieniu postaci. Format `self` nie zawiera identyfikatora ani adresu serwera. Przetrwa **natywny eksport i import JSON**: obrazy galerii podróżują w eksporcie i zachowują nazwy plików, więc każde odwołanie działa dalej po drugiej stronie.

Jest jedno ograniczenie: **eksport karty PNG nie zawiera galerii**, więc po udostępnieniu samego pliku PNG żadne odwołanie do galerii nie zadziała. Jeśli postać używa obrazów z galerii, udostępniaj natywny eksport `.json`.

<a id="save-web-images-from-greetings"></a>

### Zapisywanie obrazów z sieci w powitaniach

Wiele kart pokazuje w powitaniach obrazy z innych stron internetowych, a takie łącza mogą przestać działać albo się zmienić. Gdy pola **First Message** lub **Alternate Greetings** pokazują obrazy z sieci, sekcja **Dialogue & Greetings** ma przycisk **Save images locally** (zapisanie obrazów lokalnie). Pobiera on te obrazy do galerii postaci i zamienia każde łącze na odwołanie `card://self/gallery/...`, dzięki czemu obrazy nadal się wyświetlają, nawet gdy strona je usunie albo nie masz dostępu do internetu. Potem zapisz postać, żeby zachować nowe łącza.

Nic nie jest pobierane, dopóki nie naciśniesz przycisku. Zapisywane są tylko obrazy PNG, JPEG, GIF i WebP o rozmiarze do 10 MB i do 40 megapikseli. Łącza do twojego komputera lub sieci domowej są odrzucane. Obraz, którego nie da się zapisać, zachowuje łącze internetowe, a powiadomienie wyjaśnia przyczynę.

**Restore web links** (przywrócenie łączy internetowych) wstawia z powrotem do powitań oryginalne łącza. Zapisane kopie zostają w galerii, dopóki ich nie usuniesz. Eksporty w zgodnych formatach JSON i PNG używają oryginalnych łączy internetowych, bo takie karty nie zawierają galerii. Obrazy z lorebooków nie są objęte tą funkcją.

## Powiązane przewodniki

- [Tworzenie i edycja postaci](creating-and-editing-characters.md)
- [Persony użytkownika: tworzenie i edycja](personas.md)
- [Własne emoji, naklejki i GIF-y](../conversation/emoji-stickers-gifs.md)
- [Tła scen i galeria](../media/scene-backgrounds.md)
