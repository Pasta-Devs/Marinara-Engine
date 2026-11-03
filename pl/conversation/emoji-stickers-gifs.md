# Własne emoji, naklejki i GIF-y

Wgraj własne emoji i naklejki, szukaj GIF-ów i kontroluj, których własnych emoji i naklejek może używać postać w swoich odpowiedziach. Te narzędzia działają tylko w trybie Conversation. Tryby Roleplay i Game Mode mają zwykły wybór emoji.

## Gdzie znaleźć te narzędzia

W czacie Conversation kliknij okrągły przycisk z uśmiechniętą buźką **Emoji, GIFs & stickers** obok pola wiadomości. Nad nim otwiera się panel (na telefonie jest to arkusz nad klawiaturą). Ma zakładki:

- **Emoji**: standardowa siatka emoji oraz zakładka z gwiazdką **Custom emojis** dla wgranych obrazów.
- **GIFs**: wyszukiwarka GIF-ów na żywo.
- **Kaomoji**: buźki z tekstu, takie jak `(^_^)`.
- **Stickers**: wgrane naklejki.

Zakładka **Tools** pokazuje się też wtedy, gdy włączone są inne narzędzia wprowadzania.

## Wgraj własne emoji

Własne emoji to mały obraz, który wgrywasz raz i używasz w każdym czacie Conversation. W napisanej wiadomości zapisuje się je jako kod skrótu: nazwa między dwukropkami, na przykład `:kekw:`.

1. Przejdź do zakładki **Emoji**, a potem do zakładki z gwiazdką **Custom emojis**.
2. Kliknij **Upload** (wgraj) i wybierz jeden plik obrazu lub więcej.
3. W oknie **Name this emoji** wpisz nazwę i kliknij **Add** (dodaj).
4. Emoji pojawia się w siatce **Custom emojis**.

Reguły:

- Nazwa ma od 1 do 32 znaków: małe litery, cyfry i podkreślenia. Aplikacja zmienia inne znaki za ciebie.
- Obraz może mieć najwyżej 256 na 256 pikseli. Animowane pliki GIF działają i odtwarzają się w czacie.
- Nazwy muszą być unikalne. Zajęta nazwa pokazuje komunikat `An emoji named ":name:" already exists.`

Jeśli to nie zadziałało: sprawdź nazwę i rozmiar obrazu względem powyższych reguł.

## Użyj własnego emoji

Kliknij kafelek w siatce **Custom emojis**. Wstawia to jego kod skrótu do wiadomości i nie wysyła jej. Możesz też wpisać kod skrótu małymi literami, dokładnie tak, jak go zapisano.

W czacie Conversation kod skrótu pokazuje się jako mały obraz w tekście. Wiadomość złożona wyłącznie z kodów skrótu emoji pokazuje je większe. Jeśli nazwy już nie ma, na przykład po jej usunięciu, wiadomość pokazuje zwykły tekst `:kekw:`.

## Zmień nazwę, usuń, wyeksportuj i zaimportuj

Kliknij **Edit** (edytuj) na górze zakładki **Custom emojis**, aby włączyć tryb edycji.

- Kliknij kafelek, aby otworzyć **Rename emoji**, a potem kliknij **Rename**.
- Kliknij plakietkę kosza na kafelku, aby go usunąć. Okno **Delete emoji** ostrzega, że wiadomości, które go używały, pokażą zamiast niego tekst.
- Kliknij **Export**, aby pobrać wszystkie własne emoji jako `marinara-custom-emojis.json`. Obrazy są w środku pliku.
- Kliknij **Import**, aby wczytać wyeksportowany plik. Pomija emoji, które łamią reguły nazwy lub rozmiaru albo kolidują z istniejącym.

## Własne naklejki

Naklejka to większy obraz, który pokazuje się w osobnej linii. Zwykle klikasz ją w zakładce **Stickers**, a wstawiany jest tekst `sticker:name:`. W zakładce **Stickers** kliknij **Upload** i używaj przycisków **Edit**, **Export** i **Import** tak jak przy emoji. Różnice:

- Okno wgrywania nazywa się **Name this sticker**.
- Największy obraz ma 512 na 512 pikseli (emoji: 256 na 256).
- Plik eksportu nazywa się `marinara-custom-stickers.json`.

Aby wysłać naklejkę, kliknij jej kafelek. Okno **Send sticker** oferuje:

- **Send & reply**: publikuje naklejkę jako osobną wiadomość i pozwala postaci odpowiedzieć.
- **Add to message**: wstawia tekst `sticker:name:` do twojej wiadomości, aby można było pisać dalej.

## Szukaj GIF-ów

Zakładka **GIFs** przeszukuje Giphy, internetową bibliotekę GIF-ów. Wpisz hasło w polu wyszukiwania albo przeglądaj listę popularnych, a potem kliknij GIF, aby go wysłać.

Zanim zaczniesz: wyszukiwanie GIF-ów wymaga darmowego klucza API Giphy. Klucz to tajny kod, dzięki któremu usługa Giphy zna twoją aplikację. Bez niego zakładka pokazuje kartę konfiguracji. Ustawienie go oznacza edycję pliku `.env`, czyli zwykłego pliku ustawień tekstowych aplikacji Marinara Engine. Leży on w folderze projektu aplikacji albo w `/app/data/.env` w Dockerze (zobacz [Edycja pliku .env](../CONFIGURATION.md#edit-the-env-file)).

1. Otwórz panel deweloperski Giphy pod adresem `https://developers.giphy.com/dashboard/`.
2. Utwórz klucz API dla aplikacji internetowej i skopiuj go.
3. Otwórz plik `.env` w edytorze tekstu.
4. Dodaj tę linię na końcu, wstawiając swój klucz w miejsce `your_key_here`, i zapisz plik:

   ```text
   GIPHY_API_KEY=your_key_here
   ```

5. Uruchom aplikację Marinara Engine ponownie. To znaczy: zatrzymaj ją i uruchom tak, jak zwykle ją uruchamiasz (zobacz [Instalacja aplikacji Marinara Engine](../INSTALLATION.md)).

Wyniki GIF-ów używają dojrzałej klasyfikacji Giphy. Nie możesz jej zmienić w aplikacji, więc wyniki mogą zawierać GIF-y dla dorosłych. Nie ma źródła GIF-ów tylko bezpiecznych.

## Oznacz obraz z galerii jako emoji lub naklejkę

Każdy obraz w galerii postaci lub galerii persony może stać się emoji albo naklejką. Działa to w czatach, które obejmują tę postać lub personę.

1. Otwórz **Character Editor** (edytor postaci) albo **Persona Editor** (edytor persony).
2. Otwórz zakładkę **Gallery**, a potem podzakładkę **Images**.
3. Najedź na obraz i kliknij przycisk tagu w jego lewym górnym rogu.
4. Wybierz **Make emoji** lub **Make sticker**.
5. W oknie **Custom Emoji** lub **Custom Sticker** wpisz nazwę.

Przycisk tagu pokazuje teraz tę nazwę. Obowiązują te same limity rozmiaru, a obraz, który jest zbyt duży, pokazuje czerwony błąd. Aby zmienić to później, kliknij przycisk tagu ponownie, aby zobaczyć **Rename**, opcję przełączenia, taką jak **Switch to sticker**, albo opcję usunięcia, taką jak **Remove emoji**. Obraz nadal pozostaje zwykłym obrazem w galerii.

## Preferencje wyboru

Aplikacja informuje odpowiadającą postać, których własnych emoji i naklejek może używać. Aby zmienić sposób ich wyboru, kliknij ikonę koła zębatego **Selection preferences** na górze zakładki **Custom emojis** lub **Stickers**. Obie otwierają to samo ustawienie, zapisywane dla każdego czatu osobno.

- **Semantic** (domyślnie): oferuje te, które najlepiej pasują do ostatniej rozmowy. Używa małego modelu na twoim komputerze. Jeśli nie jest dostępny, wybiera losowo.
- **Random**: oferuje losowy zestaw przy każdej odpowiedzi.
- **Tool-call**: model wybiera pasujące przy każdej odpowiedzi. Wybierz model w polu **Select a model...**. Jeśli żaden nie jest ustawiony albo wybór się nie uda, używa trybu Semantic. Jest pomijany, gdy w jednej grupowej turze odpowiada kilka postaci.

**Max offered (each)** to liczba nazw emoji i nazw naklejek oferowanych na turę. Domyślnie jest to 20, w zakresie od 1 do 100.

## Reakcje używają tylko głównych własnych emoji

Na wiadomość możesz zareagować własnym emoji, ale tylko z emoji wgranych w zakładce **Custom emojis**. Emoji, naklejki i GIF-y oznaczone w galerii nie są dostępne jako reakcje. Zobacz [Reaguj i otrzymuj powiadomienia](getting-started.md#react-and-get-notified).

## Powiązane przewodniki

- [Tryb Conversation: pierwsze kroki](getting-started.md)
- [Galerie postaci i person](../characters/galleries.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
