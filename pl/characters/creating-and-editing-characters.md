# Tworzenie i edycja postaci

Karta postaci to plik, który definiuje postać AI: kim jest, jak mówi, jak wygląda i od czego zaczyna się czat z nią. Pisze się ją w edytorze **Character Editor** (edytor postaci). AI czyta pola karty przy każdej odpowiedzi, więc im jaśniej i konkretniej piszesz, tym spójniejsza jest postać.

## Tworzenie postaci

1. Kliknij **Characters** (postacie) na górnym pasku nawigacji. Jeśli tej pozycji nie widzisz, najpierw otwórz **More** (więcej).
2. Kliknij **New** (nowa, ikona plusa). Otwiera się okno **Create Character** (tworzenie postaci).
3. Wpisz nazwę w polu **Name \***. Nazwa jest wymagana.
4. Kliknij okrągłe pole awatara, żeby dodać obrazek. Ten krok jest opcjonalny.
5. Kliknij **Create** (utwórz).

Karta zapisuje się z pustymi polami i otwiera się edytor **Character Editor**.

6. Otwórz zakładkę **Card** i napisz **Description** (opis): kim jest postać. W sekcji **Dialogue & Greetings** dodaj **First Message** (pierwsza wiadomość), od której zaczyna się czat w trybie Roleplay.
7. Kliknij **Save** (zapis) w nagłówku.

Jeśli masz już plik karty, kliknij zamiast tego **Import**. Zobacz [Importowanie i eksportowanie kart postaci](import-export.md).

### Rozpoczynanie czatu z postacią

Wybierz postać przy rozpoczynaniu czatu. Zobacz [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md) albo [Tryb Conversation: pierwsze kroki](../conversation/getting-started.md).

## Edytor postaci w skrócie

Edytor **Character Editor** zastępuje obszar czatu pełnoekranowym miejscem pracy. Na szerokim ekranie zakładki biegną wzdłuż lewej krawędzi. Na wąskim zamieniają się w przewijany pasek u góry. Zakładki po kolei to **Metadata**, **Card**, **Onboarding**, **Convo**, **Lorebook**, **Sprites**, **Gallery**, **Colors**, **Voice**, **Stats** i **Advanced**. Każda zakładka przeskakuje do swojej sekcji jednego długiego formularza, więc można też po prostu przewijać.

W nagłówku są elementy używane najczęściej:

- Strzałka **Back** (wstecz), kafelek awatara, pole nazwy oraz pole tytułu lub komentarza na krótką etykietę w rodzaju `Modern AU version`. Wiersz pod nimi pokazuje autora i wersję.
- **Save**. Przycisk jest nieaktywny, dopóki czegoś nie zmienisz. W trakcie pracy pokazuje napis **Uploading…** (wgrywa się awatar), **Embedding…** (lorebook jest dołączany do karty) albo **Saving…**.
- Gwiazdka **Favorite** (ulubiona).
- **Export character** (eksport postaci). Zobacz [Importowanie i eksportowanie kart postaci](import-export.md).
- **Import character as persona** (import postaci jako persony), czyli skopiowanie tej karty do nowej persony. Zobacz [Persony](personas.md).
- **Duplicate character** (duplikowanie postaci).
- **Delete character** (usunięcie postaci).

Opuszczenie edytora najpierw zapisuje zmiany. Jeśli zapis się nie powiedzie, edytor pozostaje otwarty z twoją wersją roboczą, żeby można było spróbować ponownie.

Zakładki, które mają własne przewodniki:

| Zakładka | Przewodnik |
| --- | --- |
| **Onboarding** | [Interaktywny onboarding](interactive-onboarding.md) |
| **Convo** | [Profile w trybie Conversation Mode](../conversation/profiles.md) |
| **Lorebook** | [Podpinanie lorebooków do postaci](../lorebooks/linking-to-characters.md) |
| **Sprites** | [Sprite'y postaci](sprites.md) |
| **Gallery** | [Galerie postaci i person](galleries.md) |
| **Colors** i **Stats** | [Kolory postaci i statystyki RPG](colors-and-stats.md) |

Poniższe sekcje omawiają zakładki **Metadata**, **Card**, **Voice** i **Advanced**, a do tego awatary i historię wersji.

<a id="metadata-tab"></a>

## Zakładka Metadata

Zakładka **Metadata** zbiera dane o tożsamości karty i jej porządkowaniu. Pomagają sortować, udostępniać i śledzić kartę. Większość z nich nie trafia do AI.

- **Character ID**. Wartość tylko do odczytu. Pojawia się po zapisaniu karty. Kliknij **Copy** (kopiowanie), żeby ją skopiować.
- **Name**. Wyświetlana nazwa. W promptach to `{{char}}`, symbol zastępczy, który Marinara zamienia na nazwę postaci.
- **Creator**. Osoba, która stworzyła kartę, podawana jako autor przy udostępnianiu.
- **Version**. Numer wersji, który ustawiasz samodzielnie, na przykład `1.0`. Przełącznik **Automatic versioning** (automatyczne wersjonowanie) obok niego zachowuje wcześniejsze wersje i podnosi ten numer, gdy karta się zmienia. Historia wersji zapisuje migawki tylko wtedy, gdy ten przełącznik jest włączony.
- **Talkativeness**. Suwak od 0 do 100 procent. Decyduje o tym, jak często ta postać odzywa się na czatach grupowych. Domyślnie 50 procent.
- **Tags**. Wpisz tagi w polu dodawania tagu i naciśnij <kbd>Enter</kbd> albo kliknij **Add** (dodaj). Kilka tagów rozdziel przecinkami. Pole proponuje tagi używane już w bibliotece, od najczęściej używanych. Pojedynczy tag usuwa jego X, a wszystkie naraz przycisk **Remove All** (usunięcie wszystkich).
- **Creator Notes**. Prywatne notatki, które nigdy nie trafiają do AI.

**Split description into fields** (podział opisu na pola) to przycisk pod polem **Version**. Przenosi oznaczone etykietami fragmenty tekstu (osobowość, wygląd, historię, scenariusz, zasady, przykładowy dialog) z pola **Description** do osobnych pól. Najpierw widać krótkie podsumowanie, a zastosowanie zmian zapisuje kartę jako nową wersję. Przycisk jest nieaktywny, dopóki pole **Description** jest puste.

Na tej zakładce jest też panel **Version history** (historia wersji). Zobacz [Historia wersji](#version-history).

<a id="card-tab"></a>

## Zakładka Card

Zakładka **Card** to główne miejsce pisania. Odnośniki u góry przeskakują do dowolnej sekcji, a każde pole ma licznik znaków aktualizowany na bieżąco.

| Pole | Co wpisać | Trafia do AI |
| --- | --- | --- |
| **Summary** (podsumowanie) | Krótki opis do biblioteki i podglądu karty. | Nie |
| **Description** | Ogólna tożsamość i rola postaci. | W każdym prompcie |
| **Personality** | Temperament, sposób mówienia, typowe zachowania. | Tak |
| **Backstory** | Historia, pochodzenie, ważne relacje. | Tak |
| **Appearance** | Wygląd, ubiór, szczegóły wizualne. Służy też jako zalążek promptu do awatara AI. | Tak |
| **Scenario** | Domyślna sytuacja wyjściowa nowych czatów z tą postacią. | Tak |

Przełącznik **Image Appearance Override** (osobny opis wyglądu do obrazów) znajduje się pod polem **Appearance** i domyślnie jest wyłączony. Włącz go, żeby pokazać drugie pole na krótkie tagi obrazu, na przykład słowo wyzwalające LoRA (słowo kluczowe, które włącza własny styl obrazu). Gdy przełącznik jest włączony, a pole wypełnione, prompty obrazów używają tych tagów dokładnie w zapisanej formie, a treść **Appearance** zostaje jako kontekst w tle. Z tego pola wypełnia się też wstępnie prompt awatara AI. Narrator zawsze widzi pełny tekst z **Appearance**.

Sekcja **Dialogue & Greetings** ustala, jak zaczyna się czat i jak brzmi postać:

- **First Message**. Wiadomość otwierająca nowy czat w trybie Roleplay. Czaty w trybach Conversation i Game nie zaczynają się od powitania.
- **Alternate Greetings** (alternatywne powitania). Dodatkowe wiadomości otwierające. Przy rozpoczynaniu czatu w trybie Roleplay można wybrać, której użyć. Kontrolki w górę i w dół zmieniają ich kolejność, a X usuwa wybrane powitanie.
- **Example Dialogue**. Przykładowe wymiany zdań, które uczą głosu postaci. Wymiany rozdzielaj znacznikiem `<START>`, a jako symboli zastępczych używaj `{{user}}` i `{{char}}`.

```text
<START>
{{user}}: Hello!
{{char}}: *waves excitedly* Hey there!
```

Powitania i przykładowe wiadomości mogą pokazywać obrazy z galerii postaci. Zobacz [Ponowne używanie obrazu z galerii w wiadomościach i powitaniach](galleries.md#reuse-a-gallery-image-in-messages-and-greetings). Gdy powitania pokazują obrazy z innych stron internetowych, przycisk **Save images locally** (zapisanie obrazów lokalnie) zachowuje ich kopię w galerii. Zobacz [Zapisywanie obrazów z sieci w powitaniach](galleries.md#save-web-images-from-greetings).

<a id="write-a-card-field-with-the-wand"></a>

### Generowanie pola karty różdżką

Nad polami **Summary**, **Description**, **Personality**, **Backstory**, **Appearance**, **Scenario**, **Example Dialogue**, **First Message** i każdym **Alternate Greeting** znajduje się przycisk z samą ikoną różdżki. Jego podpowiedź podaje nazwę pola, które wypełnia.

Zanim zaczniesz: skonfiguruj działające połączenie tekstowe. Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

1. Wpisz w polu pomysły, które chcesz zachować, na przykład `smart, scientist, handsome`, albo zostaw je puste.
2. Uzupełnij inne pola karty, które AI ma wykorzystać jako punkt odniesienia. Nie musisz najpierw zapisywać.
3. Kliknij różdżkę danego pola. Marinara prosi o 100–300 słów dla tego pola, traktując twój tekst jako punkt wyjścia. Dla pola Example Dialogue prosi o przykładowe wymiany zdań. **First Message** i każde **Alternate Greeting** proszą o jedną wiadomość otwierającą, która zostawia ci miejsce na odpowiedź.
4. Popraw wynik, a potem kliknij **Save**.

Różdżka używa domyślnego połączenia tekstowego agentów, a jeśli go nie ma, domyślnego połączenia tekstowego. Skonfigurowane zapasowe połączenie agentów nadal obowiązuje.

Różdżka zastępuje tylko wybrane pole w niezapisanej wersji roboczej. Jeśli generowanie się nie powiedzie, twój tekst zostaje. Jeśli podczas oczekiwania edytujesz to pole albo przełączysz się na inną kartę, spóźniony wynik nie nadpisze twojej pracy. Do używania różdżki nie potrzebujesz asystentki Professor Mari.

## Dodawanie awatara

Awatar to obrazek pokazywany przy postaci na czacie i w bibliotece.

### Wgranie obrazka

1. Kliknij kafelek awatara w nagłówku edytora.
2. Wybierz plik obrazu. Nowy obrazek pojawia się od razu.

Kiedy postać ma już awatar, na zakładce **Metadata** pojawia się narzędzie do kadrowania awatara. Dzięki niemu przesuniesz albo przybliżysz obrazek w kółku albo usuniesz awatar.

### Generowanie awatara przez AI

Zanim zaczniesz: dodaj połączenie do generowania obrazów. Przycisk awatara AI pojawia się dopiero wtedy, gdy takie połączenie istnieje. Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

1. Najedź na kafelek awatara i kliknij przycisk różdżki. Otwiera się okno **Generate Character Avatar** (generowanie awatara postaci).
2. Wybierz połączenie w polu **Image Generation Connection** (połączenie do generowania obrazów).
3. Przejrzyj lub popraw pole **Avatar Prompt** (prompt awatara). Jeśli **Image Appearance Override** jest włączone i wypełnione, prompt zaczyna się od jego tekstu. W przeciwnym razie korzysta z pola **Appearance**, potem **Description**, a potem **Personality**, zależnie od tego, które pierwsze zawiera tekst.
4. Jeśli karta ma już awatar, można zaznaczyć pole wyboru **Use current avatar as a reference** (użycie bieżącego awatara jako referencji).
5. Kliknij **Generate** (generuj). Żeby spróbować ponownie, kliknij **Regenerate**.
6. Kiedy wynik ci się podoba, kliknij **Use Avatar** (użycie awatara).

Rozmiar obrazka pochodzi z rozmiaru obrazów **Portraits** (portrety) w ustawieniach generowania obrazów. Domyślnie wynosi 1024 na 1024. Jeśli opcja **Expose media prompts before sending** jest włączona, przed każdym żądaniem pojawia się krok przeglądu promptu.

## Zakładka Voice

Zakładka **Voice** (głos) ustala, jak brzmi postać, kiedy funkcja Text to Speech (synteza mowy) czyta jej wypowiedzi na głos.

- **Voice**. Głos tej postaci. Zmiana zapisuje się od razu, bez klikania **Save**. To samo ustawienie co wiersz tej postaci w sekcji **Connections → Text to Speech** (połączenia, synteza mowy). Puste pole oznacza głos domyślny. Jeśli karta o pasującej nazwie, na przykład oryginał kopii AU, ma głos, w pustym polu widać nazwę tego głosu, bo ta karta również z niego korzysta.
- **Preview** (Odsłuchaj). Odtwarza krótką kwestię tym głosem. Pada w niej nazwa postaci albo, jeśli jest ustawiona, nazwa z pola **Phonetic name** (nazwa fonetyczna).
- **Phonetic name**. Opcjonalny zapis, który służy wyłącznie do poprawienia wymowy. Należy do karty, więc kliknij **Save**, żeby go zachować.

Kiedy funkcja Text to Speech jest wyłączona albo wszystkie postacie mają jeden wspólny głos, w miejscu pola **Voice** pojawia się krótka uwaga. Przy jednym wspólnym głosie uwaga proponuje przycisk **Use a voice per character** (osobny głos dla każdej postaci). Przycisk **Open Text to Speech settings** (otwarcie ustawień syntezy mowy) otwiera panel Connections. Zobacz [Konfiguracja syntezy mowy (TTS)](../media/tts-setup.md).

## Zakładka Advanced

Zakładka **Advanced** zbiera ustawienia promptu. Przy zwykłej postaci zostaw je puste. Działają w trybach Conversation, Roleplay i Game. Preset trybu Conversation albo Game zmienia otaczający prompt, ale nie wyłącza pól Post-History Instructions ani Depth Prompt danej postaci.

- **System Prompt**. Instrukcje dla konkretnej postaci, dodawane przez blok postaci w aktywnym presecie, kontekst postaci w trybie Conversation albo kartę postaci w trybie Game. Nie zastępuje głównego promptu systemowego czatu.
- **Post-History Instructions**. Tekst umieszczany po historii czatu, tuż przed tym, jak AI zacznie pisać, na przykład "Stay in character".
- **Depth Prompt**. Tekst wstawiany do historii czatu. **Depth** (głębokość) to liczba wiadomości wstecz: 0 oznacza miejsce tuż za ostatnią wiadomością. Domyślnie 4. **Role** (rola) to **System**, **User** albo **Assistant**. Domyślnie System.

Sekcja **Regex Scripts** zbiera skrypty typu znajdź i zamień, działające tylko dla tej jednej postaci. Zobacz [Skrypty regex](../extending/regex-scripts.md).

<a id="use-an-alternative-field-in-selected-chats"></a>

## Alternatywne pola w wybranych czatach

Alternatywne pole nadaje tej samej postaci inny opis, wygląd, historię lub inny szczegół w wybranych czatach, a wszystkie pozostałe czaty zachowują oryginał. Pod każdym z siedmiu pól karty jest przycisk **Add Alternative Field** (dodaj alternatywne pole).

1. Kliknij **Add Alternative Field** pod polem, które chcesz zmienić. Marinara kopiuje tekst pola do nowego wariantu.
2. Edytuj wariant. Ma własną różdżkę, która traktuje tekst wariantu jako punkt wyjścia i nie zmienia oryginalnego pola.
3. Otwórz **Active in 0 chats** (aktywne w 0 czatach) i zaznacz czaty, które mają go używać. Lista zawiera tylko czaty z tą postacią.
4. Kliknij **Save**.

Zasady:

- Czat może używać tylko jednego wariantu danego pola. Zaznaczenie czatu w innym wariancie przenosi go tam.
- Bez zaznaczonych czatów wariant pozostaje nieaktywny na później.
- Pusty wariant czyści to pole w swoich czatach.
- Nadpisania scenariusza i wyglądu do obrazów ustawione dla konkretnego czatu nadal mają pierwszeństwo.
- Warianty pola **Summary** pozostają metadanymi i nie trafiają do AI.
- Jeśli postać opuści czat, jej przypisanie zostaje wstrzymane i wznawia się po ponownym dodaniu postaci.
- Eksport, import i duplikowanie karty oraz konwersja między postaciami a personami zachowują tekst wariantów, ale czyszczą zaznaczenia czatów. Kopie zapasowe całego profilu zachowują zaznaczenia.

Aby usunąć wariant, kliknij jego przycisk kosza, potwierdź **Delete** (usunięcie), a potem kliknij **Save**. Jego czaty wracają do oryginalnego pola. Usunięcie wariantu nigdy nie usuwa oryginalnego pola.

<a id="version-history"></a>

## Historia wersji

Gdy przełącznik **Automatic versioning** jest włączony, każdy zapis może dołożyć migawkę do panelu **Version history** na zakładce **Metadata**. Do tego czasu panel pokazuje tekst `Previous card states will appear here after the next edit.` Licznik podaje liczbę zapisanych migawek.

Porównanie zapisanej wersji z bieżącą kartą:

1. Otwórz zakładkę **Metadata**.
2. W panelu **Version history** kliknij zapisaną wersję. Okno porównania zestawia pola karty obok siebie i oznacza każde, które się zmieniło.

Powrót do starszej wersji:

1. Otwórz okno porównania dla tej wersji albo kliknij jej ikonę przywracania na liście.
2. Kliknij **Restore this version** (przywrócenie tej wersji) i potwierdź.

Marinara najpierw zapisuje bieżącą kartę w historii wersji (chyba że już odpowiada tej wersji), więc później da się do niej wrócić.

Inne kontrolki w panelu:

- Ikona ołówka zmienia numer wersji karty zapisany w migawce bez jej przywracania.
- Ikona kosza usuwa migawkę. Bieżąca karta się nie zmienia.
- **Reset** usuwa wszystkie zapisane migawki i ustawia wersję karty na 1.0. Marinara prosi o potwierdzenie, a tej operacji nie da się cofnąć. Przycisk **Reset** jest nieaktywny, dopóki masz niezapisane zmiany.

## Przeglądanie zmian w karcie proponowanych przez agenta

Na czacie w trybie Roleplay opcjonalny agent może zaproponować drobne poprawki w polach karty na podstawie sceny. Otwiera się wtedy okno **Review Character Card Updates** (przegląd zmian w karcie postaci), w którym decydujesz, co zostaje. Przy każdej proponowanej zmianie:

- **Approve** (zatwierdzenie) wprowadza ją, podnosi numer wersji i dokłada wpis do historii wersji.
- **Regenerate** prosi agenta o kolejną próbę.
- **Reject** (odrzucenie) odrzuca ją.

Jeśli tekst zmienił się od czasu zgłoszenia propozycji, aplikacja ostrzega, zanim pozwoli wymusić edycję. Jak włączyć i wyłączyć takich agentów, opisuje [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md).

## Jeśli to nie zadziałało

- **Różdżka nic nie robi albo zgłasza błąd.** Sprawdź, czy masz działające połączenie tekstowe. Przy błędzie wersja robocza nigdy nie zostaje nadpisana.
- **Brak przycisku awatara AI.** Najpierw dodaj połączenie do generowania obrazów.
- **Nie da się usunąć asystentki Professor Mari.** To wbudowana postać, którą Marinara resetuje przy każdym uruchomieniu. Zobacz [Professor Mari, twoja asystentka w aplikacji](../home/professor-mari.md).

## Powiązane przewodniki

- [Persony](personas.md)
- [Importowanie i eksportowanie kart postaci](import-export.md)
- [Porządkowanie biblioteki postaci](library-organization.md)
