# Tworzenie i edycja postaci

Ten przewodnik wyjaśnia, jak stworzyć postać w aplikacji Marinara Engine. Pokazuje też, jak pisać, zapisywać i porządkować wersje karty w edytorze **Character Editor** (edytor postaci). Opisuje zakładki **Metadata**, **Card** i **Advanced**, awatary oraz zapisaną historię wersji.

## Czym jest karta postaci

Karta postaci to plik, który definiuje postać AI. Zapisuje, kim ona jest, jak mówi, jak wygląda i od czego zaczyna się czat z nią. Wszystkie te szczegóły wpisuje się w edytorze **Character Editor**. Kartę da się zbudować od zera, zaimportować z innej aplikacji albo wyeksportować i udostępnić innym.

Większość tego, co napiszesz, trafia do kilku pól tekstowych. AI czyta te pola przy każdej odpowiedzi, więc im jaśniej i konkretniej piszesz, tym spójniejsza jest postać.

## Tworzenie postaci

1. Otwórz panel **Characters** (postacie) z paska bocznego.
2. Kliknij przycisk **New** (nowa) z ikoną plusa. Otwiera się okno **Create Character**.
3. Kliknij okrągłe pole awatara, żeby wgrać obrazek. Ten krok jest opcjonalny.
4. Wpisz nazwę w polu **Name \***. Nazwa jest wymagana.
5. Kliknij przycisk **Create**.

Nowa karta zapisuje się z pustymi polami. Zaraz potem otwiera się pełny edytor **Character Editor**, w którym uzupełnisz resztę. Jeśli plik karty już istnieje, zamiast przycisku **New** użyj przycisku **Import**. Zobacz [Importowanie i eksportowanie kart postaci](import-export.md).

## Edytor postaci w skrócie

Edytor **Character Editor** zastępuje obszar czatu pełnoekranowym miejscem pracy. U góry biegnie nagłówek z najczęściej używanymi elementami.

Po lewej stronie u góry znajdziesz strzałkę **Back**, kafelek awatara, pole nazwy oraz pole tytułu lub komentarza. Pole komentarza służy do krótkiej etykiety w rodzaju `Modern AU version`. Pod nimi drobny wiersz pokazuje autora i wersję.

Po prawej stronie u góry są takie przyciski:

- **Save** (zapis). Ten przycisk jest nieaktywny, dopóki nic nie zmienisz. Jego napis pokazuje bieżący stan: **Uploading…**, **Embedding…** albo **Saving…**.
- Gwiazdka **Favorite**, która oznacza kartę jako ulubioną.
- **Export character**.
- **Import character as persona**, czyli skopiowanie tej karty do nowej persony użytkownika.
- **Duplicate character**.
- **Delete character**.

Przy próbie wyjścia z niezapisaną pracą pojawia się baner o treści `You have unsaved changes. Close without saving?` Daje do wyboru **Keep editing**, **Discard & close** oraz **Save & close**.

Edytor dzieli się na zakładki. Na szerokim ekranie biegną one wzdłuż lewej krawędzi. Na wąskim zamieniają się w przewijany pasek u góry. Zakładki po kolei to **Metadata**, **Card**, **Convo**, **Lorebook**, **Sprites**, **Gallery**, **Colors**, **Stats** i **Advanced**.

Ten przewodnik omawia zakładki **Metadata**, **Card** i **Advanced**, a do tego awatary i historię wersji. Pozostałe zakładki mają własne przewodniki:

- **Convo**: [Profile w trybie Conversation Mode (nazwa wyświetlana, About Me, zachowanie)](../conversation/profiles.md).
- **Lorebook**: [Podpinanie lorebooków do postaci i person](../lorebooks/linking-to-characters.md).
- **Sprites**: [Sprite'y postaci](sprites.md).
- **Gallery**: [Galerie postaci i person](galleries.md).
- **Colors** i **Stats**: [Kolory postaci i statystyki RPG](colors-and-stats.md).

## Zakładka Metadata

Zakładka **Metadata** zbiera dane o tożsamości karty i jej porządkowaniu. Pomagają sortować, udostępniać i śledzić kartę, ale większość z nich nie trafia do AI.

- **Character ID**. Wartość tylko do odczytu, widoczna dopiero po zapisaniu karty. Kliknij przycisk **Copy**, żeby ją skopiować.
- **Name**. Wyświetlana nazwa. W promptach używa się jej jako `{{char}}`.
- **Phonetic name**. Opcjonalny zapis, który poprawia wyłącznie wymowę w syntezie mowy. Puste pole oznacza zwykłą nazwę.
- **Creator**. Osoba, która stworzyła kartę, do podania przy udostępnianiu.
- **Version**. Numer wersji, który ustawiasz sam, na przykład `1.0`.
- **Talkativeness**. Suwak od 0 do 100 procent. Decyduje o tym, jak często ta postać odzywa się na czatach grupowych. Domyślnie 50 procent.
- **Tags**. Wpisz jeden lub więcej tagów w polu dodawania tagu i naciśnij Enter albo kliknij przycisk **Add**. Kilka tagów naraz rozdziel przecinkami. Pojedynczy tag usuwa jego X, a wszystkie naraz przycisk **Remove All**.
- **Creator Notes**. Prywatne notatki, które nigdy nie trafiają do AI. W bibliotece widać je za to jako krótkie podsumowanie.

Na tej samej zakładce mieszka panel **Version history**. Opisuje go sekcja o zapisywaniu i historii wersji poniżej.

## Zakładka Card

Zakładka **Card** to główne miejsce pisania. Zbiera pola, które AI czyta, żeby odgrywać postać. Odnośniki u góry przenoszą od razu do wybranej sekcji. Każde pole ma licznik znaków aktualizowany na bieżąco.

- **Description**. Ogólna tożsamość i rola postaci. Ten tekst trafia do każdego promptu.
- **Personality**. Krótkie podsumowanie temperamentu, sposobu mówienia i typowych zachowań.
- **Backstory**. Historia, pochodzenie i ważne relacje.
- **Appearance**. Opis fizyczny, ubiór i szczegóły wyglądu. Marinara używa tego tekstu również jako zalążka promptu do awatara AI.
- **Scenario**. Domyślna sytuacja wyjściowa nowych czatów z tą postacią.

Sekcja **Dialogue & Greetings** ustala, jak zaczyna się czat i jak brzmi postać:

- **First Message**. Wiadomość otwierająca, pokazywana na początku nowego czatu.
- **Alternate Greetings**. Dodatkowe wiadomości otwierające. Przy rozpoczynaniu czatu wybierasz, której użyć. Kolejność zmieniają strzałki w górę i w dół, a X usuwa wybraną pozycję.
- **Example Dialogue**. Przykładowe wymiany zdań, które uczą AI głosu postaci. Do rozdzielania wymian służy `<START>`. Jako symbole zastępcze wpisuj `{{user}}` i `{{char}}`.

Powitania i przykładowe wiadomości mogą też pokazywać obrazy z galerii postaci; zobacz [Galerie postaci → Ponowne używanie obrazu z galerii w wiadomościach i powitaniach](galleries.md#reuse-a-gallery-image-in-messages-and-greetings).

Krótki wpis w polu **Example Dialogue** wygląda tak:

```
<START>
{{user}}: Hello!
{{char}}: *waves excitedly* Hey there!
```

## Dodawanie awatara

Awatar to obrazek pokazywany przy postaci na czacie i w bibliotece. Można go wgrać, dobrać jego kadr albo wygenerować przez AI.

### Wgranie obrazka

1. Kliknij kafelek awatara w nagłówku edytora.
2. Wskaż plik obrazu. Nowy obrazek pojawia się od razu.

Kiedy postać ma już awatar, na zakładce **Metadata** pojawia się narzędzie do kadrowania. Dzięki niemu przesuniesz albo przybliżysz obrazek w kółku bez ponownego wgrywania pliku. To samo narzędzie ma kontrolkę do usunięcia awatara.

### Generowanie awatara przez AI

Opcja awatara AI pojawia się dopiero wtedy, gdy skonfigurowane jest co najmniej jedno połączenie do generowania obrazów. Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

1. Najedź na kafelek awatara i kliknij mały przycisk różdżki **Generate avatar**.
2. Otwiera się okno **Generate Character Avatar**.
3. Wybierz połączenie w polu **Image Generation Connection**.
4. Przejrzyj lub popraw pole **Avatar Prompt**. Marinara wypełnia je wstępnie tekstem z pola **Appearance**. Kiedy pole **Appearance** jest puste, bierze **Description**, a potem **Personality**.
5. Jeśli karta ma już awatar, można zaznaczyć pole wyboru **Use current avatar as a reference**.
6. Kliknij przycisk **Generate**. Kolejną próbę uruchamia przycisk **Regenerate**.
7. Kiedy wynik się podoba, kliknij przycisk **Use Avatar**.

Rozmiar obrazka bierze się z ustawienia rozmiaru **Portraits** w ustawieniach generowania obrazów, a domyślnie wynosi 1024 na 1024. Przy włączonej opcji **Expose media prompts before sending** przed każdym żądaniem pojawia się dodatkowy krok z podglądem promptu.

## Zakładka Advanced

Zakładka **Advanced** zbiera ustawienia promptu dla zaawansowanych. Przy zwykłej postaci wszystkie mogą zostać puste.

Te ustawienia promptu, zapisane w karcie postaci, działają w trybach Conversation, Roleplay i Game. Wybrany preset trybu Conversation albo Game zmienia otaczający prompt, ale nie wyłącza pól **Post-History Instructions** ani **Depth Prompt** danej postaci.

- **System Prompt**. Instrukcje dla konkretnej postaci, dodawane przez blok postaci w aktywnym presecie, kontekst postaci w trybie Conversation albo kartę postaci lub GM w trybie Game, zależnie od sytuacji. Nie zastępuje głównego promptu systemowego czatu.
- **Post-History Instructions**. Tekst umieszczany blisko końca promptu, tuż przed generowaniem. Typowe zastosowanie to krótkie przypomnienie w rodzaju "Stay in character".
- **Depth Prompt**. Tekst wstawiany w wybranym miejscu historii czatu. Pole **Depth** ustala, o ile wiadomości wstecz sięga. Głębokość 0 to miejsce tuż za ostatnią wiadomością, a głębokość 4 to cztery wiadomości wstecz. Domyślna głębokość to 4. Pole **Role** decyduje, czy tekst wstawia się jako **System**, **User** czy **Assistant**. Domyślna rola to System.

Sekcja **Regex Scripts** na tej zakładce zbiera skrypty typu znajdź i zamień, działające tylko na tej jednej postaci. Korzystają ze wspólnego silnika regex. Zasady ich działania opisuje [Skrypty regex](../extending/regex-scripts.md).

## Zapisywanie i historia wersji

Kliknij przycisk **Save** w nagłówku, żeby zachować zmiany. Przycisk pozostaje nieaktywny do pierwszej edycji, a potem się włącza.

Każdy zapis może dołożyć migawkę do panelu **Version history** na zakładce **Metadata**. Przed pierwszą kolejną edycją panel pokazuje tekst `Previous card states will appear here after the next edit.` Licznik podaje liczbę zapisanych migawek.

Porównanie zapisanej wersji z bieżącą kartą wygląda tak:

1. Otwórz zakładkę **Metadata**.
2. W panelu **Version history** kliknij zapisaną wersję.
3. Otwiera się okno **Compare**. Zestawia obok siebie pola takie jak Name, Description, Personality, Scenario, First Message i Example Dialogue. Każde zmienione pole jest oznaczone.

Powrót do starszej wersji:

1. Otwórz okno **Compare** dla wybranej wersji albo kliknij jej ikonę przywracania na liście.
2. Kliknij przycisk **Restore this version** i potwierdź.

Przywrócenie zastępuje bieżącą kartę tą migawką. Nie dokłada przy tym nowego wpisu w historii. Ikona ołówka poprawia etykietę wersji zapisanej migawki bez jej przywracania. Zapisaną migawkę można też usunąć z listy; usunięcie nie rusza bieżącej karty.

Przycisk **Reset** w nagłówku panelu **Version history** przydaje się wtedy, gdy chcesz zacząć wersjonowanie karty od nowa. Po potwierdzeniu Marinara kasuje wszystkie zapisane migawki i ustawia wersję bieżącej karty na `0.0`. Tego nie da się cofnąć.

## Przeglądanie zmian w karcie proponowanych przez agenta

Na czacie w trybie Roleplay opcjonalny agent potrafi zaproponować drobne poprawki w polach karty na podstawie tego, co wydarzyło się w scenie. Wtedy pojawia się okno **Review Character Card Updates**, żeby decyzja została po twojej stronie. Ty wybierasz, co zostaje.

Przy każdej propozycji masz do wyboru:

- **Approve**. Wprowadza zmianę. Podnosi też numer wersji i dokłada wpis do historii wersji.
- **Regenerate**. Prosi agenta o kolejną próbę.
- **Reject**. Odrzuca propozycję.

Jeśli tekst zmienił się już po zgłoszeniu propozycji, aplikacja ostrzega, zanim pozwoli wymusić edycję. O tym, jak włączyć i wyłączyć takich agentów, mówi [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md).

## Słowo o Professor Mari

**Professor Mari** to wbudowana postać asystentki, która przychodzi razem z aplikacją Marinara Engine. Nie da się jej usunąć. Przy próbie aplikacja blokuje operację i informuje, że to postać wbudowana. Czym się zajmuje, opisuje [Professor Mari, twoja asystentka w aplikacji](../home/professor-mari.md).

## Powiązane przewodniki

- [Persony użytkownika: tworzenie i edycja](personas.md)
- [Sprite'y postaci](sprites.md)
- [Galerie postaci i person](galleries.md)
- [Importowanie i eksportowanie kart postaci](import-export.md)
- [Kolory postaci i statystyki RPG](colors-and-stats.md)
- [Profile w trybie Conversation Mode (nazwa wyświetlana, About Me, zachowanie)](../conversation/profiles.md)
- [Podpinanie lorebooków do postaci i person](../lorebooks/linking-to-characters.md)
