# Galerie postaci i person

Zakładka **Gallery** (galeria) w edytorach postaci i persony przechowuje obrazy i wideo przypisane do postaci albo persony, więc zostają one nawet po usunięciu czatów. Używaj jej do arkuszy referencyjnych, wariantów strojów i zaimportowanych paczek obrazów. Obraz z galerii da się też oznaczyć jako własne emoji albo naklejkę.

## Zakładka **Gallery**

Każda postać i każda persona ma własną zakładkę **Gallery** (ikona aparatu). Otwórz postać w edytorze postaci albo personę w edytorze persony, a potem kliknij **Gallery**. Galeria postaci nosi tytuł **Character Gallery**, a galeria persony – **Persona Gallery**. Obie działają tak samo.

Galeria ma dwie podzakładki:

- **Images** (obrazy) zawiera wgrane obrazy.
- **Videos** (wideo) zawiera wgrane pliki wideo, a także wideo ze scen i nagrania z rozmów wideo powiązane z tą postacią.

Galeria samego czatu działa inaczej. Trzyma ilustracje scen i wygenerowane załączniki z tego jednego czatu. Krótko żyjące grafiki scen trzymaj tam, a trwałe grafiki – tutaj.

### Dodawanie obrazów

1. Otwórz zakładkę **Gallery** i wybierz **Images**.
2. Przeciągnij pliki obrazów na pole **Upload Character Images** albo kliknij je, żeby wybrać pliki. W personie to pole nosi nazwę **Upload Persona Images**.
3. Poczekaj na koniec wgrywania. Nowe obrazy pojawiają się w siatce.

Kliknij obraz, żeby zobaczyć go w powiększeniu. Każdy kafelek ma przycisk pobierania i przycisk usuwania.

### Dodawanie wideo

1. Otwórz zakładkę **Gallery** i wybierz **Videos**.
2. Przeciągnij pliki wideo na pole **Upload Character Videos** albo kliknij je, żeby wybrać pliki. W personie to pole nosi nazwę **Upload Persona Videos**.
3. Poczekaj na koniec wgrywania.

Obsługiwane formaty to MP4, WebM i MOV. Najnowsze wideo są na początku listy. To, które wideo ze scen i klipy pojawiają się u której postaci, opisuje sekcja [Które wideo są wymieniane](#which-videos-are-listed).

## Oznaczanie obrazu z galerii jako własne emoji lub naklejka

Własne emoji to mały obrazek w linii tekstu, zapisywany jako `:name:`. Naklejka to większy obrazek w osobnym bloku, zapisywany jako `sticker:name:`. Oba działają wyłącznie w czatach w trybie Conversation Mode, czyli w trybie w stylu komunikatora.

1. Otwórz zakładkę **Gallery** i wybierz **Images**.
2. Kliknij mały przycisk oznaczania w lewym górnym rogu obrazu (podpowiedź **Tag as emoji or sticker**).
3. Kliknij **Make emoji** albo **Make sticker**.
4. W oknie **Custom Emoji** lub **Custom Sticker** wpisz nazwę i zatwierdź.

Nazwa składa się z od 1 do 32 małych liter, cyfr i podkreśleń. Pozostałe znaki są zamieniane automatycznie, więc "Big Grin" zmienia się w `big_grin`.

Jeśli to nie zadziałało: obraz emoji nie może przekraczać 256 na 256 pikseli, a obraz naklejki – 512 na 512. Przy zbyt dużym obrazie pojawia się błąd i nic nie zostaje oznaczone.

### Zarządzanie oznaczonym obrazem

Po oznaczeniu obrazu przycisk na jego miniaturze pokazuje nazwę. Kliknij go, żeby zobaczyć dalsze opcje:

- **Rename** (zmiana nazwy) zmienia nazwę.
- **Switch to sticker** lub **Switch to emoji** zmienia rodzaj. Sprawdzany jest limit rozmiaru nowego rodzaju, więc naklejka większa niż 256 na 256 nie może stać się emoji. Pojawia się wtedy błąd, a rodzaj zostaje bez zmian.
- **Remove emoji** lub **Remove sticker** usuwa oznaczenie. Sam obraz zostaje w zakładce **Gallery**.

Emoji lub naklejka oznaczona w galerii działa tylko dla tej jednej postaci lub persony, w czatach w trybie Conversation Mode z jej udziałem. To co innego niż globalne zbiory emoji i naklejek w polu pisania wiadomości. Jeśli nazwa z galerii pokrywa się z nazwą globalną, w tym czacie wygrywa wersja z galerii. Unikalność nazw nie jest sprawdzana, więc nadaj każdemu obrazowi inną nazwę.

<a id="reuse-a-gallery-image-in-messages-and-greetings"></a>

## Ponowne używanie obrazu z galerii w wiadomościach i powitaniach

Każdy obraz z galerii postaci może się pojawić w treści czatu: w powitaniu, przykładowej wiadomości albo wiadomości wysyłanej przez postać. Najedź na obraz z galerii i kliknij **Copy image reference** (kopiowanie odwołania do obrazu, ikona łącza). Kopiuje to fragment Markdown, który można wkleić wszędzie tam, gdzie mówi postać:

```text
![sunset selfie](card://self/gallery/k3m2xq7.png)
```

`self` oznacza postać, która wypowiada daną wiadomość. Przy wyświetlaniu wiadomości Marinara zastępuje `self` tą postacią i wczytuje obraz z jej galerii.

Gdzie to działa:

- Pola **First Message**, **Alternate Greetings** i **Example Dialogue** na karcie postaci. Podgląd Markdown pola pokazuje obraz już podczas edycji.
- Każda wiadomość wysyłana przez postać, w trybie Roleplay i Conversation.
- Czaty grupowe. W odpowiedzi wielu rozmówców `self` jest rozwiązywane osobno dla każdego z nich. Jeśli galeria rozmówcy nie ma pliku, Marinara sprawdza pozostałe postacie z czatu w kolejności czatu. Jeśli dwie postacie mają plik o tej samej nazwie, wygrywa obraz samego rozmówcy.

Gdzie to nie działa:

- **Twoje własne wiadomości**. Nie mają mówiącej postaci, więc odwołanie `self` wyświetla się jako uszkodzony obraz. Aby samodzielnie wysłać obraz postaci, użyj wstawiania z przeglądarki zasobów czatu, które zapisuje pełny format `card://characters/<id>/...`.
- **Wiadomości systemowe**. Nie wyświetlają obrazów Markdown, więc odwołanie pojawia się jako tekst.
- **Galerie person**. Twoje wiadomości nie mają rozmówcy, więc użyj formatu persony `card://personas/<id>/gallery/<file>`.

Pełne łącze zawiera wewnętrzny identyfikator postaci, a identyfikatory powstają od nowa przy imporcie postaci, więc pełne łącza psują się u każdego, komu udostępnisz postać. Format `self` nie zawiera identyfikatora. Przetrwa eksport i import w formacie **Marinara Native**, bo obrazy galerii podróżują w eksporcie razem z nazwami plików. Eksporty **Compatible PNG Card** i **Compatible JSON** nie zawierają galerii, więc po takim udostępnieniu żadne odwołanie do galerii nie zadziała. Gdy postać używa obrazów z galerii, użyj formatu **Marinara Native**.

<a id="save-web-images-from-greetings"></a>

### Zapisywanie obrazów z sieci w powitaniach

Wiele kart pokazuje w powitaniach obrazy z innych stron internetowych, a takie łącza mogą przestać działać. Gdy pola **First Message** lub **Alternate Greetings** pokazują obrazy z sieci, sekcja **Dialogue & Greetings** ma przycisk **Save images locally** (zapisanie obrazów lokalnie).

1. Otwórz zakładkę **Card** i znajdź sekcję **Dialogue & Greetings**.
2. Kliknij **Save images locally**. Marinara pobiera obrazy do galerii i zamienia każde łącze na odwołanie `card://self/gallery/...`.
3. Kliknij **Save** (zapis), żeby zachować nowe łącza.

Nic nie jest pobierane, dopóki nie klikniesz przycisku. Zapisywane są tylko obrazy PNG, JPEG, GIF i WebP o rozmiarze do 10 MB i do 40 megapikseli. Łącza do twojego komputera lub sieci domowej są odrzucane. Obraz, którego nie da się zapisać, zachowuje łącze internetowe, a powiadomienie wyjaśnia przyczynę.

**Restore web links** (przywrócenie łączy internetowych) wstawia z powrotem do powitań oryginalne łącza. Zapisane kopie zostają w galerii, dopóki ich nie usuniesz. Obrazy z lorebooków nie są objęte tą funkcją.

<a id="which-videos-are-listed"></a>

## Które wideo są wymieniane

Podzakładka **Videos** wymienia wideo ze scen wygenerowane w czatach z tą postacią oraz nagrania z rozmów wideo. To, u której postaci pojawia się dane wideo, zależy od jego pochodzenia:

- Wiadomość wideo z trybu Conversation jest wymieniana u postaci, które pokazuje: u tej, która ją wysłała, i u każdego, kogo wymienia z imienia. Wystarczy samo imię, jeśli nikt inny na czacie go nie nosi, o ile zapisano je wielką literą. Gdy tekst prosi o zdjęcie grupowe albo grupowe selfie, uwzględniany jest każdy uczestnik czatu. Imiona w cudzysłowie się nie liczą.
- Galeria twojej persony wymienia klip tylko wtedy, gdy wymienia on twoją personę.
- Starsze wideo oraz wideo z czatów w trybach Roleplay i Game Mode są wymieniane u każdej postaci i u persony z ich czatu.

## Powiązane przewodniki

- [Tworzenie i edycja postaci](creating-and-editing-characters.md)
- [Persony](personas.md)
- [Własne emoji, naklejki i GIF-y](../conversation/emoji-stickers-gifs.md)
- [Tła scen i galeria](../media/scene-backgrounds.md)
