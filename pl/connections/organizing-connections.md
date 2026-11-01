# Porządkowanie połączeń

Z tego przewodnika dowiesz się, jak utrzymać porządek wśród kont i modeli w aplikacji Marinara Engine. Opisuje listę kont, modele oznaczone gwiazdką, przenoszenie i usuwanie modeli, foldery, funkcję Shuffle oraz eksport i import. Konto to jeden klucz, jedno logowanie albo jeden adres u dostawcy AI; model to jeden zapisany z niego model AI. Jak dodać konto, opisuje [Łączenie z dostawcą AI](connecting-to-a-provider.md).

## Lista kont

Pod sekcją **Jobs** (zadania) panel **Connections** (Połączenia) wymienia twoje konta. Każde konto pokazuje swój obrazek, nazwę, liczbę modeli i adres. Wiersz modelu pokazuje obrazek modelu, jego nazwę i plakietki, takie jak zadanie, które model wykonuje (**Main**, **Agents**, **Images**), **Custom settings** (własne ustawienia), jego cenę albo **Plan** (plan) przy modelach wliczonych w subskrypcję.

Kliknij wiersz konta, żeby zwinąć jego modele, i kliknij ponownie, żeby je pokazać. Marinara pamięta, które konta są zwinięte. **More actions** (więcej działań) u góry panelu zawiera opcje **Fold all accounts** (zwinięcie wszystkich kont) i **Open all accounts** (rozwinięcie wszystkich kont), **Show only Off or Needs key** (pokazanie tylko kont wyłączonych lub bez klucza) oraz **Show cost badges** (pokazanie plakietek kosztów). W szerokim panelu lista rozwijana sortowania jest obok pola **Search models and accounts** (wyszukiwanie modeli i kont). W wąskim panelu kolejność sortowania znajduje się w **More actions**.

Konto pośredniczące, które sięga do modeli kilku twórców, na przykład proxy albo LinkAPI, grupuje swoje modele pod nagłówkami **via**, takimi jak **via NanoGPT**, z ikoną danego twórcy.

Blok **Built-in model** (model wbudowany) pod sekcją Jobs pokazuje model działający na twoim komputerze i jego stan. Zobacz [Konfiguracja modelu Local Model](local-model.md).

### Działania na koncie

Kliknij **⋯** w wierszu konta:

- **Edit account** (edycja konta) otwiera jego ustawienia: **Name** (nazwa), **API key** (klucz API), **Address** (adres), **Usage and limits** (zużycie i limity) oraz **Use this account** (używanie tego konta).
- **Replace key** (zastąpienie klucza) pozwala wkleić nowy klucz.
- **Test** (test) sprawdza klucz i pokazuje wynik.
- **Add model** (dodanie modelu) otwiera listę modeli konta. **Add image model** (dodanie modelu obrazów) pojawia się przy dostawcach, którzy tworzą też obrazy.
- **Select models** (zaznaczanie modeli) pozwala przenieść albo usunąć kilka modeli naraz.
- **Duplicate** (duplikowanie) dodaje kopię konta razem z kopiami jego modeli.
- **Turn off** (wyłączenie) sprawia, że Marinara nie używa konta, dopóki nie włączysz go ponownie przyciskiem **Turn on** (włączenie).
- **Delete account** (usunięcie konta). Marinara najpierw wymienia zadania, czaty i agentów, którzy nadal używają jego modeli.

### Ikony dostawców

Każde konto pokazuje ikonę swojego dostawcy. Ikony są dostarczane razem z aplikacją Marinara Engine, więc Marinara nigdy nie wczytuje ich z internetu. Konto z własnym adresem pokazuje ikonę znanego serwera lub pośrednika, gdy jego adres albo nazwa zawiera nazwę takiego serwera, na przykład Ollama, LM Studio, KoboldCpp, Bifrost albo LiteLLM. W przeciwnym razie pokazuje pierwszą literę swojej nazwy. Kliknij obrazek konta, żeby wybrać własny.

## Modele oznaczone gwiazdką

Gwiazdka oznacza modele, które mają być pod ręką. Modele oznaczone gwiazdką są wymienione w grupie **Starred** (oznaczone gwiazdką) blisko góry każdego selektora modeli: w oknach **Model for** (model dla) w sekcji **Jobs**, w oknie czatu **Model for this chat** (model dla tego czatu) oraz w polach modelu w **Chat Settings** (ustawienia czatu) i w edytorze agenta.

Aby oznaczyć model gwiazdką, kliknij jego gwiazdkę na liście **Add model** konta albo wybierz **Star** (oznaczenie gwiazdką) w menu **⋯** modelu. Przydzielenie modelowi zadania też go zapisuje.

Aby usunąć gwiazdkę, kliknij ją ponownie. Marinara usuwa model i przez kilka sekund pokazuje **Undo** (cofnięcie). Model zostaje, bez gwiazdki, gdy nadal ma rolę w **Jobs**, ma własne ustawienia albo jest ostatnim modelem swojego konta. Komunikat podaje powód.

## Działania na modelu

Kliknij **⋯** w wierszu modelu:

- **Make default for…** (ustawienie jako domyślny) przydziela modelowi zadanie, tak samo jak wybranie go w sekcji **Jobs**.
- **Edit model** (edycja modelu) otwiera jego ustawienia. Kliknięcie wiersza modelu działa tak samo.
- **Move to account…** (przeniesienie do konta) przenosi model do innego konta tego samego dostawcy albo do nowego konta. Model używa wtedy klucza i katalogu tamtego konta. Czaty używające modelu nadal działają.
- **Folder** (folder) umieszcza model w folderze. Foldery są widoczne po wybraniu **Group by folder** (grupowanie według folderów) w **More actions**.
- **Duplicate** tworzy pełną kopię z tymi samymi ustawieniami, bez pytania.
- **Add to Shuffle** (dodanie do losowania) albo **Remove from Shuffle** (usunięcie z losowania).
- **Change picture** (zmiana obrazka).
- **Remove** (usunięcie) usuwa model po potwierdzeniu.

Na komputerze możesz przeciągnąć wiersz modelu na czat, żeby użyć tego modelu w czacie.

## Wyszukiwanie

Pole **Search models and accounts** u góry panelu filtruje listę w trakcie pisania. Gdy nic nie pasuje, panel o tym informuje.

<a id="shuffle"></a>

## Funkcja Shuffle

Dzięki funkcji Shuffle czat przy każdej odpowiedzi wybiera inny model. Przydaje się to wtedy, gdy zapytania mają się rozkładać na kilku dostawców lub kilka modeli.

Aby dodać model do funkcji Shuffle, wybierz **Add to Shuffle** w jego menu **⋯**. Aby czat korzystał z funkcji Shuffle, otwórz okno **Model for this chat** z pola wiadomości albo z **Chat Settings → Connection → Model** i wybierz **Shuffle** (losowanie). Każda odpowiedź losuje wtedy model z twojej puli Shuffle.

Jeśli model wylosowany dla odpowiedzi zawiedzie, a **Main** ma model **If it fails** (jeśli zawiedzie), odpowiedź pisze ten model. Powiadomienie podaje model, który zawiódł, i krótki powód, na przykład "key rejected", "rate limited" albo "not found", dzięki czemu wiadomo, który z nich wymaga poprawy. Odpowiedź zachowuje małą etykietę **Fallback** (połączenie zapasowe); dotknij jej albo wskaż ją kursorem, żeby znów zobaczyć tę samą informację.

Wybór w oknie **Model for this chat** zmienia tylko ten czat. Aby zmienić model dla nowych czatów, ustaw **Main** w sekcji **Jobs**.

## Eksport i import

Konta da się wyeksportować do pliku jako kopię zapasową albo po to, żeby przenieść je do innej instalacji, a później zaimportować.

**Eksport nigdy nie zawiera kluczy API.** Po imporcie otwórz każde konto i wpisz jego klucz jeszcze raz. Gwiazdki trafiają do eksportu, ale katalog dostawcy już nie, więc wczytuje się ponownie przy pierwszym otwarciu modeli konta.

Aby wyeksportować jeden model, otwórz go przez **Edit model** i kliknij jego przycisk **Export** (eksport) z ikoną wgrywania. Aby wyeksportować wszystko, otwórz **More actions** i wybierz **Export all accounts** (eksport wszystkich kont). Zanim pobieranie ruszy, Marinara przypomina, że plik nie zawiera kluczy.

Jeden model pobiera się jako plik `.connection.json`. Kilka modeli pobiera się razem jako plik `marinara-connections.zip`.

Aby zaimportować, otwórz **More actions** i wybierz **Import account** (import konta). Upuść na okno jeden plik `.json` lub kilka takich plików albo kliknij, żeby je wskazać. Każde zaimportowane konto ma pusty klucz, dopóki go nie uzupełnisz.

## Powiązane przewodniki

- [Łączenie z dostawcą AI](connecting-to-a-provider.md)
- [Panel **Chat Settings** – przegląd](../chats/chat-settings.md)
