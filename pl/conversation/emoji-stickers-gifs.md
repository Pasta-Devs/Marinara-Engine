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

1. Otwórz panel i przejdź do zakładki **Emoji**, a potem do zakładki z gwiazdką **Custom emojis**.
2. Kliknij **Upload** (wgraj) i wybierz jeden plik obrazu lub więcej.
3. W oknie **Name this emoji** wpisz nazwę i kliknij **Add** (dodaj).

Emoji pojawia się w siatce **Custom emojis**.

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
2. Otwórz zakładkę **Obrazy**, potem **Galeria** i jej podzakładkę **Obrazy**.
3. Najedź na obraz i kliknij przycisk tagu w jego lewym górnym rogu.
4. Wybierz **Make emoji** lub **Make sticker**.
5. W oknie **Custom Emoji** lub **Custom Sticker** wpisz nazwę.

Przycisk tagu pokazuje teraz tę nazwę. Obowiązują te same limity rozmiaru, a obraz, który jest zbyt duży, pokazuje czerwony błąd. Aby zmienić to później, kliknij przycisk tagu ponownie, aby zobaczyć **Rename**, opcję przełączenia, taką jak **Switch to sticker**, albo opcję usunięcia, taką jak **Remove emoji**. Obraz nadal pozostaje zwykłym obrazem w galerii.

## Preferencje wyboru

Aplikacja informuje odpowiadającą postać, których własnych emoji i naklejek może używać. Aby zmienić sposób ich wyboru, kliknij ikonę koła zębatego **Selection preferences** na górze zakładki **Custom emojis** lub **Stickers**. Obie otwierają to samo ustawienie, zapisywane dla każdego czatu osobno.

- **Semantic** (domyślnie): oferuje te, które najlepiej pasują do ostatniej rozmowy. Używa małego modelu na twoim komputerze. Jeśli nie jest dostępny, wybiera losowo. Gdy odpowiada jedna postać, jej własne emoji i naklejki są oceniane razem ze wspólnymi, a przy zbliżonej ocenie pierwszeństwo mają jej własne.
- **Random**: oferuje losowy zestaw przy każdej odpowiedzi.
- **Tool-call**: model wybiera pasujące przy każdej odpowiedzi. Wybierz model w polu **Select a model...**. Jeśli żaden nie jest ustawiony albo wybór się nie uda, używa trybu Semantic. Jest pomijany, gdy w jednej grupowej turze odpowiada kilka postaci.

**Max offered (each)** to liczba nazw emoji i nazw naklejek oferowanych na turę. Domyślnie jest to 20, w zakresie od 1 do 100.

Jeśli postać zapisze nazwę naklejki tak jak emoji, na przykład `:hug:` zamiast `sticker:hug:`, w odpowiedzi pojawi się naklejka. Dzieje się tak tylko wtedy, gdy żadne własne emoji nie ma tej nazwy.

<a id="describe-emojis-and-stickers"></a>

### Opisz emoji i naklejki

Opis mówi, co przedstawia emoji lub naklejka i jakie emocje wyraża, na przykład "kot wyglądający zza poduszki; nieśmiałość, zakłopotanie". Pomaga, gdy nazwa nie wyjaśnia znaczenia obrazka.

- Aby napisać opis, kliknij **Edit** na zakładce **Custom emojis** lub **Stickers**, a potem mały przycisk opisu w rogu kafelka. W przypadku emoji lub naklejki oznaczonej w galerii kliknij przycisk tagu i wybierz **Add description** (dodanie opisu).
- Aby opisy napisała AI, kliknij **Edit**, a potem **Describe with AI** (opisanie za pomocą AI). Model **Image reading** (odczytywanie obrazów) ogląda każdy obrazek i pisze krótki opis. Jeśli niektóre już go mają, wybierz **Describe only the … without** (opisanie tylko tych bez opisu) lub **Describe all … again** (ponowne opisanie wszystkich).

Zanim zaczniesz: opisy AI wymagają modelu, który potrafi odczytywać obrazy. Marinara używa modelu **Image reading**, jeśli ustawisz go w sekcji **Behind the scenes** (za kulisami) w ustawieniach połączenia, a w przeciwnym razie używa modelu agentów.

Korzystają z nich dwa ustawienia w panelu **Selection preferences**:

- **Use descriptions** (używanie opisów, domyślnie włączone): przy wyborze oferowanych emoji i naklejek w trybach **Semantic** i **Tool-call** ocenia je zarówno na podstawie opisu, jak i nazwy. Nie dodaje nic do promptu.
- **Show descriptions to the model** (pokazywanie opisów modelowi, domyślnie wyłączone): dodatkowo umieszcza opis każdego oferowanego emoji lub naklejki obok nazwy, dzięki czemu model zna ich znaczenie. Przy domyślnej liczbie 20 oferowanych dodaje około 1 000 do 1 800 tokenów wejściowych na odpowiedź.

Opisy używane tylko do wyboru oferowanych emoji i naklejek nie uczą modelu znaczenia nazw. Jeśli nazwa mówi coś przeciwnego do wyrażanej emocji, jak sarkastyczne `:fine:`, włącz **Show descriptions to the model** lub **Show them to the model** (pokaż je modelowi).

### Pokaż je modelowi

Zwykle model widzi tylko nazwy własnych emoji i naklejek. Jeśli model czatu potrafi odczytywać obrazy, opcja **Show them to the model** (pokaż je modelowi) w tym samym panelu wysyła mu też obrazki, dzięki czemu wie, jak wygląda każdy z nich. Pomaga to szczególnie przy nazwach, które nie opisują obrazka.

- **Off** (wyłączone, domyślnie): tylko nazwy.
- **Last message** (ostatnia wiadomość): pokazuje własne emoji i naklejki z najnowszej wiadomości.
- **Recent** (ostatnie): pokazuje te z kilku ostatnich wiadomości. **Messages to look at** (liczba sprawdzanych wiadomości) określa ich liczbę, od 2 do 20. Domyślnie jest to 6.

**Offered ones on the sheet** (oferowane na arkuszu) dodaje do obrazków wybraną liczbę oferowanych emoji i taką samą liczbę oferowanych naklejek, od 0 do 30. Domyślnie jest to 6. Arkusz mieści do 30 emoji i 12 naklejek; te z czatu mają pierwszeństwo, więc oferowane wypełniają pozostałe miejsce.

Przy każdej odpowiedzi model otrzymuje jeden obraz z ponumerowanymi emoji i jeden z ponumerowanymi naklejkami oraz ich dokładne nazwy w tekście. Zużywa to dodatkowe tokeny wejściowe przy każdej odpowiedzi (tokeny to małe fragmenty tekstu i obrazów, za które usługa nalicza opłaty), około 1 000 przy ustawieniach domyślnych. Funkcja nie działa, gdy model czatu nie potrafi odczytywać obrazów lub włączone jest **Opisywanie obrazów**. Jeśli model odrzuca obrazy, Marinara wysyła tylko nazwy.

## Reakcje używają tylko głównych własnych emoji

Na wiadomość możesz zareagować własnym emoji, ale tylko z emoji wgranych w zakładce **Custom emojis**. Emoji, naklejki i GIF-y oznaczone w galerii nie są dostępne jako reakcje. Gdy postać reaguje nazwą naklejki, reakcja pokazuje tę naklejkę. Zobacz [Reaguj i otrzymuj powiadomienia](getting-started.md#react-and-get-notified).

## Powiązane przewodniki

- [Tryb Conversation: pierwsze kroki](getting-started.md)
- [Galerie postaci i person](../characters/galleries.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
