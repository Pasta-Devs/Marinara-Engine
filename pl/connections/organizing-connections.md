# Porządkowanie połączeń

Ten przewodnik opisuje, jak utrzymać porządek wśród kont i modeli w panelu **Connections** (Połączenia): zwijanie, oznaczanie gwiazdką, przenoszenie, usuwanie, foldery, funkcję Shuffle i eksport. Jak dodać konto, opisuje [Łączenie z dostawcą AI](connecting-to-a-provider.md).

## Lista kont

Pod sekcją **Jobs** (zadania) panel wymienia twoje konta. Każde konto pokazuje swój obrazek, nazwę, liczbę modeli i adres. Wiersz modelu pokazuje obrazek modelu, jego nazwę i plakietki, takie jak zadanie, które model wykonuje (**Main**, **Agents**, **Images**), **Custom settings** (własne ustawienia), jego cenę albo **Plan** (plan) przy modelach wliczonych w subskrypcję. Karta **Built-in model** (model wbudowany) znajduje się pod sekcją **Jobs**. Zobacz [Konfiguracja modelu wbudowanego](local-model.md).

Kliknij wiersz konta, żeby zwinąć jego modele, i kliknij ponownie, żeby je pokazać. Marinara pamięta, które konta zostały zwinięte. **More actions** (więcej działań, trzy kropki) u góry panelu ma takie pozycje:

| Pozycja | Co robi |
| --- | --- |
| **Fold all accounts** (zwinięcie wszystkich kont), **Open all accounts** (rozwinięcie wszystkich kont) | Zwija albo rozwija wszystkie konta. |
| **Show only Off or Needs key** (pokazanie tylko kont wyłączonych lub bez klucza) | Pokazuje tylko konta, które wymagają uwagi. |
| **Show cost badges** (pokazanie plakietek kosztów) | Pokazuje cenę każdego modelu. |
| **Group by folder** (grupowanie według folderów), **Group by account** (grupowanie według kont) | Przełącza sposób grupowania modeli. Zobacz [Foldery](#folders). |
| **Import account** (import konta), **Export all accounts** (eksport wszystkich kont) | Zobacz [Eksport i import](#export-and-import). |

W szerokim panelu lista rozwijana sortowania jest obok pola **Search models and accounts** (wyszukiwanie modeli i kont). W wąskim panelu sortowanie znajduje się w **More actions**. Do wyboru są **Custom** (własna kolejność), **A–Z**, **Z–A**, **Newest** (najnowsze) i **Oldest** (najstarsze). Pole **Search models and accounts** filtruje listę w trakcie pisania.

Niektóre konta sięgają do modeli kilku twórców, na przykład NanoGPT albo serwer proxy. Ich modele są zgrupowane pod nagłówkami takimi jak **via NanoGPT**.

### Działania na koncie

Kliknij **⋯** w wierszu konta:

| Działanie | Co robi |
| --- | --- |
| **Edit account** (edycja konta) | Otwiera jego ustawienia, w tym **Name** (nazwa), **Address** (adres), **API key** (klucz API) i **Use this account** (używanie tego konta). |
| **Replace key** (zastąpienie klucza) | Pozwala wkleić nowy klucz. Jeśli stary klucz jest też na innych kontach, Marinara pyta, czy zaktualizować również je. |
| **Test** (test) | Sprawdza klucz i pokazuje wynik. |
| **Add model** (dodanie modelu) | Otwiera listę modeli konta. **Add image model** (dodanie modelu obrazów) pojawia się przy usługach, które tworzą też obrazy. |
| **Select models** (zaznaczanie modeli) | Pozwala przenieść albo usunąć kilka modeli naraz. |
| **Duplicate** (duplikowanie) | Dodaje kopię konta razem z kopiami jego modeli. |
| **Turn off** (wyłączenie) / **Turn on** (włączenie) | Wstrzymuje albo wznawia korzystanie z konta przez aplikację Marinara Engine. |
| **Delete account** (usunięcie konta) | Zobacz niżej. |

Żeby usunąć konto, kliknij **Delete account**. Marinara prosi o potwierdzenie i w sekcji **Used by** (używane przez) wymienia, co korzysta z jego modeli: czaty, agentów, modele i zadania. Kliknij **Delete with its N models** (usunięcie razem z N modelami), żeby usunąć konto i jego modele. Te czaty i zadania będą wtedy potrzebować innego modelu. Jeśli jakiegoś modelu nie da się usunąć, edytor wymienia go pod komunikatem **This account still has models. Remove these first:**. Otwórz każdy z tych modeli i usuń go.

W oknie **Edit account** przycisk **Test account** (test konta) sprawdza klucz, **Usage and balance** (zużycie i saldo) pokazuje zużycie planu, a **More options** (więcej opcji) zawiera **Requests per minute** (żądania na minutę) i **Parallel requests** (żądania równoległe).

### Ikony dostawców

Każde konto pokazuje ikonę swojej usługi. Ikony są dostarczane razem z aplikacją Marinara Engine i nigdy nie są wczytywane z internetu. Konto z własnym adresem pokazuje ikonę znanego serwera lub pośrednika, gdy jego adres albo nazwa zawiera nazwę takiego serwera, na przykład Ollama, LM Studio, KoboldCpp, Bifrost albo LiteLLM. W przeciwnym razie pokazuje pierwszą literę swojej nazwy. Żeby wybrać własną ikonę, kliknij obrazek konta, a potem wybierz logo usługi, prześlij własny obraz albo użyj liter.

## Modele oznaczone gwiazdką

Gwiazdka oznacza modele, które chcesz szybko znajdować. Modele oznaczone gwiazdką są wymienione w grupie **Starred** (oznaczone gwiazdką) blisko góry każdego selektora modeli: w oknach **Model for** (model dla) w sekcji **Jobs**, w oknie **Model for this chat** (model dla tego czatu) oraz w polach modelu w **Chat Settings** (ustawienia czatu) i w edytorze agenta.

Aby oznaczyć model gwiazdką, kliknij jego gwiazdkę na liście **Add model** konta albo wybierz **Star** (oznaczenie gwiazdką) w menu **⋯** modelu. Przydzielenie modelowi zadania też go zapisuje.

Aby usunąć gwiazdkę, kliknij ją ponownie. Marinara usuwa model i przez kilka sekund pokazuje **Undo** (cofnięcie). Model zostaje, bez gwiazdki, gdy używa go czat, ma rolę w **Jobs**, ma własne ustawienia albo jest ostatnim modelem swojego konta. Komunikat podaje powód.

## Działania na modelu

Kliknij **⋯** w wierszu modelu:

| Działanie | Co robi |
| --- | --- |
| **Make default for…** (ustawienie jako domyślny) | Przydziela modelowi zadanie, tak samo jak wybranie go w sekcji **Jobs**. |
| **Edit model** (edycja modelu) | Otwiera jego ustawienia. Kliknięcie wiersza modelu działa tak samo. |
| **Move to account…** (przeniesienie do konta) | Przenosi model do innego konta. Model używa wtedy klucza tamtego konta. |
| **Folder** (folder) | Umieszcza model w folderze. |
| **Duplicate** | Tworzy pełną kopię z tymi samymi ustawieniami. |
| **Add to Shuffle** (dodanie do losowania) / **Remove from Shuffle** (usunięcie z losowania) | Zobacz [Funkcja Shuffle](#shuffle). |
| **Change picture** (zmiana obrazka) | Otwiera wybór obrazka. |
| **Remove** (usunięcie) | Usuwa model po potwierdzeniu. Okno potwierdzenia wymienia, co z niego korzysta. |

Gdy przenosisz model, razem z nim przechodzą jego nazwa, obrazek, zadania i czaty, a opcje usługi wracają do ustawień domyślnych.

Na komputerze możesz przeciągnąć wiersz modelu na czat, żeby użyć tego modelu w czacie.

<a id="folders"></a>

## Foldery

Foldery grupują twoje modele, na przykład **RP** i **Work**. Żeby je pokazać, wybierz **Group by folder** w **More actions**. Model należy do jednego folderu.

1. Kliknij **⋯** na modelu i wybierz **Folder**.
2. Wybierz folder albo kliknij **New folder…** (nowy folder), wpisz nazwę i kliknij **Create** (utwórz).

Folder może mieć ikonę i kolor. Żeby zmienić nazwę folderu albo go usunąć, otwórz jego menu **⋯**. Usunięcie folderu zachowuje jego modele w grupie **Not in a folder** (poza folderem).

<a id="shuffle"></a>

## Funkcja Shuffle

Funkcja Shuffle pozwala czatowi wybierać inny model przy każdej odpowiedzi. Przydaje się, gdy żądania mają się rozkładać na kilka usług albo modeli.

1. Kliknij **⋯** na każdym modelu, który ma trafić do puli, i wybierz **Add to Shuffle**.
2. W czacie otwórz okno **Model for this chat** z pola wiadomości albo **Chat Settings → Connection → Model** (ustawienia czatu, połączenie, model) i wybierz **Shuffle** (losowanie).

Każda odpowiedź losuje wtedy model z twojej puli Shuffle.

Jeśli model wylosowany dla odpowiedzi zawiedzie, a **Main** ma model **If it fails** (jeśli zawiedzie), odpowiedź pisze ten model. Powiadomienie podaje model, który zawiódł, i krótki powód, na przykład "key rejected", "rate limited" albo "not found". Odpowiedź zachowuje małą etykietę **Fallback** (połączenie zapasowe). Dotknij jej albo wskaż ją kursorem, żeby znów zobaczyć tę samą informację.

Wybór w oknie **Model for this chat** zmienia tylko ten czat. Aby zmienić model dla nowych czatów, ustaw **Main** w sekcji **Jobs**.

<a id="export-and-import"></a>

## Eksport i import

Konta da się wyeksportować do pliku jako kopię zapasową albo po to, żeby przenieść je do innej instalacji, a później zaimportować.

> **Ostrzeżenie:** Eksport nigdy nie zawiera kluczy API. Po imporcie otwórz każde konto i wpisz jego klucz jeszcze raz. Nigdy nikomu nie udostępniaj klucza.

- **Eksport jednego modelu:** otwórz go przez **Edit model** i kliknij **Export model** (eksport modelu).
- **Eksport wszystkiego:** otwórz **More actions** i wybierz **Export all accounts**. Marinara przypomina, że plik nie zawiera kluczy. Kliknij **Export** (eksport).
- **Import:** otwórz **More actions** i wybierz **Import account**. Upuść na okno jeden plik lub kilka plików (`.json`, `.jsonl` albo `.zip`) albo kliknij, żeby je wskazać. Obejmuje to także wyeksportowany plik `marinara-connections.zip`. Każde zaimportowane konto ma pusty klucz, dopóki go nie uzupełnisz.

Jeden model pobiera się jako plik `.connection.json`. Kilka modeli pobiera się razem jako `marinara-connections.zip`. Gwiazdki trafiają do eksportu. Katalog modeli usługi już nie, więc wczytuje się ponownie przy pierwszym otwarciu modeli konta.

## Powiązane przewodniki

- [Łączenie z dostawcą AI](connecting-to-a-provider.md)
- [Panel **Chat Settings** – przegląd](../chats/chat-settings.md)
