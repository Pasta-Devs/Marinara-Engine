# Czaty grupowe w trybach Conversation i Roleplay

Z tego przewodnika dowiesz się, jak działają czaty grupowe w aplikacji Marinara Engine, czyli czaty z dwiema postaciami albo z większą ich liczbą. Zobaczysz, jak utworzyć czat grupowy oraz jak dodawać i usuwać uczestników. Poznasz też sposoby na to, by decydować, kto zabiera głos w trybie Conversation i w trybie Roleplay.

## Czym jest czat grupowy

Czat grupowy to każdy czat, w którym są co najmniej dwie postacie. Nie ma osobnego przycisku "czat grupowy". Zwykły czat staje się grupowy w chwili, gdy dojdzie do niego druga postać.

Czaty grupowe działają w dwóch trybach: **Conversation** i **Roleplay**. Tryb Game Mode ma własny, oddzielny system drużyny i ten przewodnik go nie opisuje.

Słowo "grupa" pojawia się w aplikacji Marinara Engine w kilku znaczeniach. Czat grupowy to wiele postaci w jednym czacie. Czym innym są **Folders** (foldery), czyli zapisane listy postaci do wielokrotnego użytku. Czym innym są też **Chat Branches** (gałęzie czatu), czyli alternatywne wersje tego samego czatu. Tutaj mowa wyłącznie o czatach grupowych.

## Tworzenie czatu grupowego

Czat grupowy tworzy się tym samym kreatorem New Chat, co każdy inny czat. Wystarczy wybrać więcej niż jedną postać.

1. Na pasku bocznym kliknij przycisk nowego czatu dla wybranego trybu. Na przycisku widnieje napis **New Conversation** albo **New Roleplay**.
2. Przejdź do kroku kreatora o nazwie **Persona & Characters**.
3. W polu **Search characters...** znajdź postać, a potem kliknij jej awatar lub imię, żeby ją dodać.
4. Tak samo dodaj drugą postać. Liczba postaci zależy tylko od ciebie.
5. Zakończ kreator, żeby otworzyć czat.

Po dodaniu drugiej postaci etykieta nad listą wyboru zmienia się. W trybie Conversation pokazuje napis **Group Chat** (czat grupowy) i liczbę uczestników. W trybie Roleplay pokazuje napis **Characters** i tę samą liczbę.

Liczba postaci nie ma sztywnego limitu. W praktyce im więcej postaci, tym dłuższy prompt, czyli tekst wysyłany do AI, i tym wyższy koszt jednej odpowiedzi. Dodawaj tylko te postacie, których scena naprawdę potrzebuje.

Jeśli nie zmienisz nazwy czatu, Marinara nadaje mu nazwę złożoną z imion postaci rozdzielonych przecinkami. Przykład: "Alice, Bob, Carol".

### Dodawanie wielu postaci naraz przez **Folders**

Gotowy folder postaci da się dodać w całości, jednym ruchem. **Folders** to zapisane listy postaci, które tworzy się w panelu **Characters**. To najszybszy sposób na przygotowanie czatu grupowego, do którego chcesz wracać.

1. W kroku **Persona & Characters** rozwiń listę **Add from Folder**.
2. Wybierz folder z listy.
3. Kliknij przycisk **Add** obok listy rozwijanej.

Do czatu trafiają wszystkie postacie z tego folderu, których jeszcze w nim nie ma. Kontrolka **Add from Folder** pojawia się dopiero wtedy, gdy istnieje co najmniej jeden folder. O tworzeniu folderów i zarządzaniu nimi przeczytasz w przewodniku o porządkowaniu biblioteki postaci, podlinkowanym niżej.

Można też kliknąć wiersz **Random** (opisany jako **Dice pick**), żeby dodać jedną losową postać spoza czatu.

## Zarządzanie uczestnikami po utworzeniu czatu

Postacie dodaje się, usuwa i porządkuje w panelu bocznym **Chat Settings** (ustawienia czatu). Otwiera go ikona koła zębatego w nagłówku czatu. Podpowiedź przy tej ikonie brzmi **Chat Settings**.

W panelu znajdź sekcję **Characters**. Widać w niej liczbę uczestników oraz tekst pomocy "Characters in this chat. Each character has their own personality that the AI roleplays as." Każdy wiersz uczestnika ma awatar, imię postaci, uchwyt przeciągania, ikonę oka i ikonę kosza.

- Żeby dodać kolejną postać, kliknij przycisk **Add Character** i wyszukaj ją.
- Żeby dodać cały folder, kliknij **Add from Folder** i wybierz jeden z nich.
- Żeby usunąć postać, kliknij ikonę kosza. Jej podpowiedź brzmi **Remove from chat**.
- Żeby zmienić kolejność postaci, przeciągnij uczestnika w górę lub w dół za uchwyt przeciągania. Podpowiedź brzmi **Drag to reorder**.

Kolejność uczestników ma znaczenie. Przy kolejności odpowiedzi **Sequential** (opisanej niżej) postacie odzywają się dokładnie w tej kolejności, w jakiej stoją na liście. Przeciągnij uczestnika, żeby zmienić moment, w którym zabiera głos.

Sekcja **Characters** nie pojawia się w trybie Game Mode. Tam drużyną zarządza się w innym miejscu.

### Wyłączanie uczestnika bez usuwania go

Czasem postać ma na chwilę usiąść z boku, ale zostać na liście. Służy do tego ikona oka w jej wierszu.

- Kliknij oko, żeby wyłączyć postać. Podpowiedź zmienia się na **Disable in chat**, a oko zostaje przekreślone.
- Kliknij ponownie, żeby przywrócić postać do gry. Podpowiedź brzmi wtedy **Enable in chat**.

Wyłączona postać zostaje na liście uczestników, ale nie bierze udziału w żadnej odpowiedzi. Marinara nie wysyła jej karty postaci do modelu, więc nie da się jej też wskazać jako mówiącej.

Jest jeden bezpiecznik. Jeśli wyłączysz wszystkie postacie w czacie, Marinara traktuje je z powrotem jako aktywne. Dzięki temu nie powstaje odpowiedź bez żadnej postaci.

Stan włączenia i wyłączenia zapisuje się osobno dla każdego czatu. Nigdzie indziej w aplikacji nic się przy tym nie zmienia.

## Kto zabiera głos: tryb Roleplay

W trybie Roleplay czat grupowy dostaje w panelu **Chat Settings** sekcję **Group Chat**. Widać ją tylko wtedy, gdy w czacie są co najmniej dwie postacie. To tam ustawia się sposób, w jaki postacie odpowiadają.

### **Merged (Narrator)** albo **Individual**

Ustawienie **Mode** to przełącznik z dwoma przyciskami.

- **Merged (Narrator)** (odpowiedź scalona z narracją) jest domyślne. Jedna odpowiedź obejmuje naraz wszystkie postacie i całą narrację.
- **Individual** (osobno) sprawia, że każda postać generuje własną, oddzielną odpowiedź.

### **Color Dialogues** (tylko przy **Merged**)

Kiedy ustawienie **Mode** stoi na **Merged (Narrator)**, można włączyć **Color Dialogues** (kolorowe dialogi). Domyślnie jest wyłączone. Po włączeniu kwestie każdej postaci wyświetlają się w jej własnych kolorach. Kolory pochodzą z zakładki **Colors** w edytorze postaci. Ta zakładka ustawia kolor imienia, kolor dialogu i kolor ramki. Sposób ich ustawienia opisuje przewodnik o edycji postaci.

<a id="response-order-individual-only"></a>

### **Response Order** (tylko przy **Individual**)

Kiedy ustawienie **Mode** stoi na **Individual**, pojawia się ustawienie **Response Order** (kolejność odpowiedzi). To przełącznik z trzema przyciskami.

- **Sequential** jest domyślne. Każda postać odpowiada po kolei, zgodnie z listą **Characters**. Zmień kolejność uczestników, a zmienisz kolejność tur.
- **Smart** wykonuje krótkie, ukryte zapytanie do AI i na tej podstawie decyduje, która postać albo które postacie mają się odezwać jako następne. Czyta ostatnie wiadomości i opisy postaci, a zwykle wskazuje jedną osobę. Wzmianka w stylu `@Alice` w twojej wiadomości unieważnia ten wybór.

  Jeśli wybierzesz **Decision model** (model decyzyjny; zobacz [Modele decyzyjne](../connections/decision-models.md)), możesz włączyć pod nim **Also use it to pick who speaks in Smart response order** (wybieraj nim także mówiącego w kolejności Smart). Kolejność Smart prosi wtedy o osobny wynik tak/nie dla każdego kandydata. Pytania współdzielą pięć ostatnich wiadomości i listę kandydatów z imionami, statusem, aktywnością, rozmownością oraz krótkim fragmentem osobowości lub opisu. Zdalny dostawca też otrzymuje tę listę; zobacz [Co widzi model](../connections/decision-models.md#what-the-model-sees).

  Te wyniki mogą przyjść szybciej niż pełna odpowiedź AI, ale szybkość i koszt zależą od modelu i liczby kandydatów. W trybie Roleplay Marinara wybiera najbardziej prawdopodobnego mówiącego. W Conversation odpowiada każdy, kto ma powód, w kolejności prawdopodobieństwa. Postać, która właśnie mówiła, czeka, jeśli ktoś inny ma powód odpowiedzieć. Gdy model decyzyjny nie odpowie, Smart wykonuje zwykłe wywołanie AI.
- **Manual** wyłącza wszystkie automatyczne odpowiedzi. Wtedy sam wskazujesz mówiącego listą **Trigger Response** na pasku wiadomości.

Przy kolejności **Smart** AI potrafi ustawić w kolejce więcej niż jedną postać. Od razu odpowiada tylko pierwsza. Kolejnego mówiącego wskaże lista **Trigger Response** na pasku wiadomości. Inna opcja: wyślij pustą wiadomość, a odezwie się następna postać z kolejki.

W trybie **Individual** dochodzą jeszcze dwa przełączniki:

- **Add Turn To Prompt** jest domyślnie włączone. Dodaje krótką instrukcję z imieniem postaci, która ma odpowiedzieć w tej turze.
- **Name Prefix History** jest domyślnie wyłączone. Zmienia sposób oznaczania wcześniejszych wiadomości imionami mówiących, zanim trafią one do modelu. Zostaw je wyłączone, chyba że któraś postać ciągle myli, kto co powiedział.

### **Scenario Override**

Pole **Scenario Override** (nadpisanie scenariusza) pozwala dać całej grupie jeden wspólny scenariusz. Wpisany tam tekst zastępuje w prompcie własny scenariusz każdej postaci. Puste pole oznacza, że każda postać zachowuje swój scenariusz.

Nie ma tu osobnego przełącznika. Wpisanie tekstu włącza tę funkcję, a wyczyszczenie pola ją wyłącza. Do edycji w większym oknie służy ikona rozwijania (podpowiedź **Expand editor**). Większy edytor nosi tytuł **Group Scenario Override**.

Jedna uwaga o wielokrotnym użyciu: tekst z pola **Scenario Override** należy do tego jednego czatu. Profile ustawień go nie obejmują, więc nie przeniesie się razem z profilem do nowego czatu.

### Ustawienia i wartości domyślne (Roleplay)

| Ustawienie | Gdzie | Domyślnie |
|---|---|---|
| **Mode** (**Merged (Narrator)** / **Individual**) | sekcja Group Chat | Merged (Narrator) |
| **Color Dialogues** | sekcja Group Chat, tryb Merged | Off |
| **Response Order** (Sequential / Smart / Manual) | sekcja Group Chat, tryb Individual | Sequential |
| **Add Turn To Prompt** | sekcja Group Chat, tryb Individual | On |
| **Name Prefix History** | sekcja Group Chat, tryb Individual | Off |
| **Scenario Override** | sekcja Group Chat | puste (wyłączone) |

Większość tych ustawień zapisuje się w profilach ustawień, więc da się ich używać wielokrotnie. Wyjątkiem jest **Scenario Override**, które zostaje przy jednym czacie.

## Kto zabiera głos: tryb Conversation

Tryb Conversation obsługuje te same czaty grupowe, ale nie pokazuje sekcji **Group Chat**. Odpowiednie ustawienia leżą w sekcji **Autonomous Messaging** (wiadomości autonomiczne) w panelu **Chat Settings**.

Domyślnie czat grupowy w tym trybie zachowuje się jak tryb Merged. Jedna odpowiedź może objąć kilka postaci naraz, a ich kwestie same dostają kolory mówiących. W trybie Conversation nie ma osobnego przełącznika kolorów.

### **Reply When Mentioned**

Włącz **Reply When Mentioned** (odpowiedź po wzmiance), a czat przejdzie na tryb jednej postaci naraz. Wtedy postacie odzywają się tylko wtedy, gdy je wymienisz albo wskażesz ręcznie. Opis przełącznika brzmi "Characters wait for direct mentions or manual response triggers."

Postać wymienia się wzmianką. Wpisz w polu wiadomości `@`, a potem imię postaci, a pojawi się lista podpowiedzi. Odpowiadają te postacie, które wymienisz.

Żeby wskazać mówiącego bez wpisywania wzmianki, użyj listy **Trigger Response**.

- Na komputerze jest to przycisk obok przycisku Send.
- Na urządzeniu mobilnym znajdziesz go pod nagłówkiem **Trigger Response** w tacce narzędzi otwieranej z paska wiadomości.

Podpowiedź przy przycisku brzmi "Trigger character response".

### **Character Exchanges**

Włącz **Character Exchanges** (rozmowy między postaciami), a postacie zaczną odzywać się do siebie same z siebie. Domyślnie jest to wyłączone. Opis brzmi "Characters chat with each other in group chats."

Po włączeniu postacie mogą odpowiadać sobie nawzajem podczas twojej nieobecności, nie tylko tobie. Działa to wyłącznie wtedy, gdy Marinara jest otwarta w przeglądarce. Po zamknięciu aplikacji wymiana zdań ustaje. Obowiązuje tu też ten sam dzienny limit wiadomości, co przy wiadomościach autonomicznych.

## Kolejność tur w skrócie

| Tryb i ustawienie | Co się dzieje | Jak nad tym zapanować |
|---|---|---|
| Roleplay, Merged | jedna odpowiedź obejmuje wszystkie postacie | zawsze wszystkie postacie razem |
| Roleplay, Individual, Sequential | każda postać odpowiada zgodnie z kolejnością uczestników | przeciągnij uczestników, żeby zmienić kolejność |
| Roleplay, Individual, Smart | AI wskazuje następnego mówiącego lub mówiących | wzmianka `@Name` unieważnia ten wybór |
| Roleplay, Individual, Manual | nikt nie odzywa się sam z siebie | użyj listy **Trigger Response** |
| Conversation, domyślnie | jedna odpowiedź może objąć kilka postaci | wzmianka `@Name` wskazuje postać |
| Conversation, włączone Reply When Mentioned | bez wzmianki lub wskazania nikt nie odpowiada | wzmianka `@Name` albo lista **Trigger Response** |
| Conversation, włączone Character Exchanges | postacie mogą też pisać do siebie | wyłącz to ustawienie, żeby przerwać |

## Powiązane przewodniki

- [Porządkowanie biblioteki postaci](../characters/library-organization.md)
- [Tryb Conversation: pierwsze kroki](../conversation/getting-started.md)
- [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md)
