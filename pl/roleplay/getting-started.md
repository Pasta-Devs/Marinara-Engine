# Tryb Roleplay: pierwsze kroki

Tryb Roleplay to tryb czatu przeznaczony do opowieści. Za wiadomościami dodaje obszar sceny (tło i sprite'y postaci) oraz pasek HUD (heads-up display) ze szczegółami opowieści. Agent to pomocnik, który działa obok odpowiedzi, na przykład taki, który śledzi pogodę albo wybiera sprite'a.

Wybierz tryb Roleplay do sceny z opowieści. Do zwykłego pisania wiadomości wybierz [tryb Conversation](../conversation/getting-started.md), a do uporządkowanej gry z drużyną, walką i rzutami kością – [Game Mode](../game/getting-started.md). Bez generowania obrazów tryb Roleplay działa jako czat czysto tekstowy: miejsca na sprite'y zostają puste, tło ma jednolity kolor, a pasek HUD nadal śledzi opowieść.

## Rozpocznij roleplay

Zanim zaczniesz: dodaj konto w panelu **Connections** (Połączenia) po prawej stronie aplikacji. Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

1. Na pasku bocznym czatów kliknij zakładkę **RP**.
2. Kliknij przycisk **+** u góry paska bocznego. Jego podpowiedź brzmi **New Roleplay** (nowy roleplay).

Czat otwiera się z panelem **Chat Settings** (ustawienia czatu) i pięciokrokowym kreatorem konfiguracji. Wymagane jest tylko konto. Wszystko da się zmienić później.

1. **Name & Connection** (nazwa i połączenie). Nadaj roleplayowi nazwę (opcjonalnie) i wybierz, które połączenie ma odpowiadać.
2. **Pick a Preset** (wybór presetu). Preset ustala strukturę promptu i wartości generowania. Domyślny sprawdza się w większości czatów.
3. **Persona & Characters** (persona i postacie). Wybierz swoją personę i postacie w scenie. W tym kroku przycisk **Create your persona** (utworzenie własnej persony) może zbudować dla ciebie personę na podstawie kilku pytań. Zobacz [Interaktywny onboarding](../characters/interactive-onboarding.md).
4. **Attach Lorebooks** (dołączenie lorebooków). Lorebook to zbiór faktów o świecie, które AI czyta, gdy pojawiają się ich słowa kluczowe. Ten krok jest opcjonalny.
5. **Enable Agents** (włączenie agentów). Wybierz agentów, którzy działają w tym czacie. Później zmienisz to w **Chat Settings → Agents** (ustawienia czatu, agenci).

Po zakończeniu widzisz czat z polem wiadomości. Wpisz pierwszą wiadomość i ją wyślij.

## Obszar sceny: tło, sprite'y i HUD

- **Tło**: obraz obejmujący całą scenę za wiadomościami, który przy zmianie płynnie się przenika. Agent **Background** (tło) może wybierać je co turę, albo możesz ustawić stałe tło dla czatu. Zobacz [Tła w trybie Roleplay](backgrounds.md).
- **Sprite'y**: obrazki postaci na obszarze sceny. Pojawić się może każda postać z włączonymi sprite'ami. Postać potrzebuje biblioteki sprite'ów na swojej karcie, inaczej jej miejsce zostaje puste. Zobacz [Sprite'y postaci](../characters/sprites.md).
- **HUD**: twoje trackery (data, godzina, pogoda, lokalizacja, obecne postacie, ekwipunek, zadania, statystyki). Włączasz je w **Chat Settings → Agents**. Zobacz [Pasek HUD i trackery w trybie Roleplay](hud-and-trackers.md).

### Sterowanie wyświetlaniem sprite'ów

Otwórz **Chat Settings** (przycisk z suwakami w czacie), przejdź do **Agents** i znajdź kartę **Expression Engine**. To agent, który dobiera wyrazy twarzy sprite'ów. Te kontrolki pojawiają się, gdy co najmniej jedna postać ma włączone sprite'y.

| Kontrolka | Co robi |
| --- | --- |
| **Sprite Source** (źródło sprite'ów) | Wybierz **Expressions** (wyrazy twarzy), **Full-body** (całe sylwetki) albo oba. Jedno z nich musi pozostać włączone. |
| **Expression Size** (rozmiar wyrazów twarzy), **Full-body Size** (rozmiar całych sylwetek) | Ustawiają, jak duży jest każdy rodzaj sprite'ów. |
| **Expression Opacity** (krycie wyrazów twarzy), **Full-body Opacity** (krycie całych sylwetek) | Ustawiają, na ile przezroczysty jest każdy rodzaj. |
| **Default Side** (domyślna strona) | **Left** (lewa) lub **Right** (prawa): strona, po której pojawiają się nowe sprite'y. |
| **Expression Avatars** (awatary z wyrazami twarzy) | Gdy jest włączone, awatary przy wiadomościach pokazują aktualny sprite z wyrazem twarzy postaci. |

Cztery suwaki rozmiaru i krycia zapisują się tylko w tej przeglądarce. Nie synchronizują się z innymi urządzeniami.

Aby przesunąć sprite'y ręcznie:

1. Kliknij **Arrange** (rozmieszczanie), przycisk na obszarze sceny. Zmienia się on w **Done** (gotowe).
2. Przeciągnij sprite'a, a potem kliknij mały ptaszek nad nim, żeby potwierdzić.
3. Kliknij **Done**, aby zakończyć. **Reset** (przywrócenie) usuwa wszystkie własne ustawienia położenia.

Aby ustawić wyraz twarzy wpisaną komendą, wyślij `/emote happy` dla całej sceny albo `/emote "Aria" angry` dla jednej postaci. Wyślij samo `/emote`, żeby wyświetlić listę wyrazów twarzy każdej postaci.

Jeśli to nie zadziałało: sprite'y wymagają wgranej biblioteki sprite'ów na karcie postaci. Bez niej agent od wyrazów twarzy działa, ale nie ma czego pokazać.

## Narzędzia czatu

Narzędzia czatu (wyszukiwanie, gałęzie, podsumowanie, aktywny kontekst, Agent activity, Author's Notes, Gallery) to sekcje panelu **Chat Settings**. Otwórz go przyciskiem z suwakami w czacie. Co robi każda z nich, opisuje przewodnik [Panel **Chat Settings** – przegląd](../chats/chat-settings.md). Zobacz też [Wydzielanie sekcji do osobnego okna](../chats/chat-settings.md#popping-a-section-out-into-its-own-window).

<a id="authors-notes"></a>

### Author's Notes

**Author's Notes** (notatki autora) to notatka, którą AI czyta przy każdej odpowiedzi. Służy do stałych przypomnień, takich jak zasada tonu albo ukryty fakt.

1. Otwórz **Chat Settings** i rozwiń **Author's Notes** pod **Agents**.
2. Wpisz notatkę, na przykład: "Utrzymuj mroczny, pełen napięcia ton."
3. Jeśli nie masz pewności, zostaw **Injection Depth** (głębokość wstawienia) bez zmian. To ustawienie decyduje, w którym miejscu czatu trafia notatka: 0 oznacza miejsce po najnowszej wiadomości, a 4 – cztery wiadomości przed końcem.

Przy dłuższej notatce przeciągnij na komputerze dolny róg pola. Author's Notes działa tak samo w trybie Game Mode i w trybie Conversation Mode.

<a id="agent-activity"></a>

## Agent activity

**Agent activity** (aktywność agentów) pokazuje, co zrobili agenci czatu. Pojawia się, gdy czat korzysta z agentów albo z Advanced Memory. Znajdziesz ją jako osobną sekcję tuż pod **Agents** w **Chat Settings**, na dole Tracker Panel, a na komputerze także na dole okna Trackers.

- Zakładka **Activity** (aktywność): wyniki zapisane przez agentów, zwane dymkami myśli. Możesz odrzucić pojedynczy wynik albo użyć **Clear all** (wyczyszczenie wszystkich). Pojawiają się tu też wyniki własnych agentów.
- Gdy agenci pracują, ikona sekcji zmienia się w kręcący się kołowrotek. Jeśli agent zawiedzie, na ikonie pojawia się kropka, która zostaje, dopóki nie otworzysz sekcji.
- Agenci, którzy zawiedli, są wymienieni z przyciskiem ponowienia. Możesz też zatrzymać działających agentów, ponownie uruchomić trackery i użyć **Clear Trackers** (wyczyszczenie trackerów).
- Zakładka **Injections** (wstawienia do promptu): widoczna tylko wtedy, gdy włączony jest **Debug mode** (tryb diagnostyczny) w **Settings → Advanced** (ustawienia, zaawansowane). Wymienia fragmenty promptu, które agenci piszący zapisali przed ostatnią odpowiedzią. Do tych agentów należą **Prose Guardian**, który przepisuje odpowiedzi zgodnie z twoimi zasadami stylu, oraz **Narrative Director**, który steruje fabułą. Fragment można obejrzeć, edytować i uruchomić ponownie. Edycja zmienia tylko to, co zostaje użyte przy ponownym generowaniu tej samej odpowiedzi, więc ponowne generowanie pozostaje powtarzalne. Nie zmienia odpowiedzi widocznej na ekranie.

Wszystkich agentów opisuje przewodnik [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md). Agenta, który steruje fabułą, opisuje przewodnik [Narrative Director i Secret Plot](narrative-director.md).

## Walka i sceny

- Tryb Roleplay ma lekką warstwę walki. Dodaj agenta Combat, a potem kliknij **Encounter** (starcie) nad polem czatu. Zobacz [Starcia bojowe (Roleplay)](combat-encounters.md).
- Scena to boczna gałąź na retrospekcję albo poboczną lokalizację. Zobacz [Sceny: odgałęzienie roleplayu](scenes.md).
- Jak sterować fabułą, opisuje przewodnik [Narrative Director i Secret Plot](narrative-director.md).

## Wybór modeli

Połączenie czatu pisze prozę postaci. Mocniejszy model utrzymuje spójny głos postaci przez długie sceny. Połączenia agentów wykonują małe, uporządkowane zadania, na przykład odczyt stanu albo wybór wyrazu twarzy, a małe modele potrafią się w nich mylić. Wielu użytkowników prowadzi czat na mocnym modelu, a agentów na szybkim i tanim. Jeśli wartości na pasku HUD albo sprite'y ciągle wychodzą źle, przenieś agentów na mocniejszy model. Ustawienia samplera opisuje przewodnik [Parametry generowania](../prompts/generation-parameters.md).

## Komendy

To opcjonalne funkcje. Komendy to działania, które postać może podjąć sama, zapisane w jej odpowiedzi jako krótki tekst w nawiasach kwadratowych, na przykład `[illustrate: ...]`. Marinara odczytuje nawias, wykonuje działanie i ukrywa nawias w wiadomości.

### Włącz komendę

1. Otwórz **Chat Settings → Agents** i rozwiń **Commands** (komendy).
2. Włącz przełącznik **Commands** na górze. Każda komenda w środku jest na początku wyłączona.
3. Włącz wybrane komendy. Wyszarzona komenda pokazuje, czego jeszcze potrzebuje.

- **Illustrations** (ilustracje), **Video clips** (klipy wideo): dodaj do tego czatu agenta Illustrator.
- **Combat** (walka): dodaj do tego czatu agenta Combat.
- **Soundtrack** (ścieżka dźwiękowa): dodaj agenta Music DJ i włącz agentów.
- **Personal Notes** (osobiste notatki), **Reminders** (przypomnienia), **Whisper** (szept): użyj czatu z jedną postacią albo czatu grupowego z generowaniem **Individual** (osobno).
- **Sound Cues** (sygnały dźwiękowe): wybierz połączenie Music & Sound Effects z włączonymi efektami dźwiękowymi.
- **Documents** (dokumenty), **HTML Artifacts** (artefakty HTML), **Rolls** (rzuty), **Direct Messages** (wiadomości prywatne), **Interruptions** (przerywanie): nic więcej.

**Rolls**, **Combat**, **Documents** i **Whisper** pytają też, kto może z nich korzystać: **All** (wszystkie) postacie albo tylko **Narrator** (narrator). Narrator to postać wybrana w polu **Narrator character** (postać narratora). Może używać komend przeznaczonych tylko dla narratora i czytać notatki, przypomnienia i szepty wszystkich.

Jeśli to nie zadziałało: wyszarzonej komendzie brakuje agenta albo właściwego typu czatu. Przeczytaj wiersz pod jej przełącznikiem.

### Ilustracje

Zanim zaczniesz: dodaj do czatu agenta Illustrator i włącz **Illustrations**.

Postać może teraz poprosić o obraz komendą `[illustrate: subject="..." characters="..."]`. Obraz korzysta z ustawień agenta Illustrator w tym czacie i pojawia się pod wiadomością.

Włącz **Render in-line** (wyświetlanie w treści), aby każdy obraz pojawiał się wewnątrz wiadomości, w miejscu, w którym postać napisała komendę. Zaznacz obraz, aby zobaczyć jego prompt, albo usuń go przyciskiem **X**. Ustawienie dotyczy tylko nowych obrazów. Obrazy, które agent Illustrator tworzy sam, oraz układ Visual Novel się nie zmieniają.

Ilustrację możesz też utworzyć samodzielnie komendą `/illustrate`. W trybie Roleplay wymaga ona agenta Illustrator.

<a id="artifacts-on-demand"></a>

### Artefakty na żądanie

Włącz **HTML Artifacts**, aby narrator mógł utworzyć jeden przedmiot ze świata opowieści, na przykład stronę księgi zaklęć, szyld, szkic na kartce listu albo odczyt z terminala. Komenda to `[html: prompt="..."]`. Nie wymaga agenta. O artefakt możesz też poprosić samodzielnie komendą `/html <what you want>`.

Artefakt pojawia się w miejscu, w którym narrator umieścił komendę, gdy odpowiedź jest już ukończona. W układzie Visual Novel widać tylko znacznik. Jedna odpowiedź może utworzyć najwyżej 3 artefakty, a każdy z nich to osobne żądanie do modelu. Żądanie korzysta z połączenia agenta **Immersive HTML**, jeśli ten agent je ma, w przeciwnym razie z twojego domyślnego połączenia agentów, a w ostatniej kolejności z połączenia czatu. Ustawienie **Parallel requests** (równoległe żądania) tego połączenia (w edytorze konta) określa, ile żądań działa naraz. Do zwykłej ostylowanej strony wystarczą wbudowane rodzaje **Documents**, które są darmowe i działają natychmiast.

Narrator nie widzi kodu HTML artefaktu. W kolejnych turach widzi jego krótką wersję w postaci zwykłego tekstu: czytelny tekst artefaktu i jedną linijkę o tym, jak wygląda. Otwórz znacznik "used html command" pod wiadomością, żeby przeczytać lub edytować ten tekst albo usunąć artefakt, co usuwa go też z pamięci narratora. Jeśli przebieg się nie uda, znacznik podaje przyczynę.

<a id="whispers-and-secrets"></a>

### Szepty i sekrety

Włącz **Whisper**, aby w odpowiedzi mogły pojawiać się prywatne uwagi, sekrety i wizje. Komenda to `[whisper: character="name" text="the secret"]`. Wskaż dokładnie jedną postać czatu albo swoją personę. Tekst w promptach dostają tylko ta postać i narrator. Nieznane lub niejednoznaczne imię jest ignorowane, więc sekret nie wycieka.

- **Reveal a secret** (ujawnij sekret) pokazuje szept na twoim ekranie. Zmienia tylko to, co widzisz, a nie to, co wiedzą postacie. Szepty do twojej persony widać od razu.
- **Edit whisper** (edytuj szept) pozwala zmienić tekst, a potem wybrać **Save** (zapisz). Aby usunąć szept, wyczyść jego tekst i wybierz **Save**. **Cancel** (anuluj) pozostawia go bez zmian.
- Szept możesz wpisać we własnej wiadomości, aby wyszeptać coś jednej postaci. Ten sam nawias działa, gdy edytujesz wiadomość postaci albo narratora. Tekst może zajmować kilka wierszy i zachowywać cudzysłowy, na przykład `text=""I love you.""`.
- Wiadomość, która zawiera wyłącznie szept, jest ukryta przed postaciami, do których szept nie dociera.
- Jeśli za pomocą **Hide from AI** (ukrycie przed AI) ukryjesz wiadomość przed niektórymi postaciami, odbiorca szeptu nadal dostaje szept, ale nic z reszty wiadomości.

Szepty mogą czytać też agenci:

- Czytają je Echo Chamber, trackery, Lorebook Keeper i Long-Term Memory. W czatach grupowych czyta je też kolejność odpowiedzi **Smart**, więc szept może sprawić, że ta postać odpowie jako następna.
- Każdy szept jest oznaczony jako prywatny i wskazuje swojego odbiorcę. To, co agent na jego podstawie napisze, na przykład wpis lorebooka albo notatka trackera, może mimo to dotrzeć do innych postaci.
- W hostowanym pokoju gry wieloosobowej agenci i kolejność odpowiedzi **Smart** nie dostają szeptów.
- Agenci Relationship Tracker i Memory Nag czytają czat samodzielnie i na razie nie widzą szeptów.

<a id="your-private-notes"></a>

### Twoje prywatne notatki

Włącz **Personal Notes**, a potem wpisz `[notes: content="your private note"]` we własnej wiadomości. Te notatki dostaje tylko narrator, a nie inne postacie ani wspólni agenci. Notatkę edytujesz albo usuwasz w szczegółach komend wiadomości. Jeśli postać zostanie wyłączona albo usunięta z grupy, narrator przestaje dostawać jej notatki. Ponowne włączenie postaci je przywraca.

Notatkę możesz też zapisać przy pojedynczej wiadomości:

1. Wybierz **Bookmark, pin or note** (dodaj zakładkę, przypnij lub dodaj notatkę) pod wiadomością.
2. Napisz **Private note** (prywatna notatka). Domyślnie pozostaje prywatna i nie trafia do modelu.
3. Aby udostępnić ją modelowi, włącz **Show the note to the narrator character** (pokaż notatkę postaci narratora) i wybierz postać. Notatkę dostaje tylko ta postać, obok tej wiadomości. Udostępnianie wymaga czatu z jedną postacią albo grupowego generowania **Individual**.

**Remove note** (usuń notatkę) również kończy jej udostępnianie.

<a id="video-clips"></a>

### Klipy wideo

Zanim zaczniesz: dodaj do czatu agenta Illustrator i wybierz połączenie wideo w jego sekcji **Scene Videos** (wideo sceny).

Włącz **Video clips**, aby postacie mogły poprosić o krótki klip ważnego momentu komendą `[video: subject="the moment" motion="what moves and how the camera moves" characters="names"]`. Instrukcje nakazują modelowi wybierać ją zamiast `[illustrate]`, gdy w danym momencie liczy się ruch. Klip zaczyna się od obrazu wskazanego w ustawieniu **First frame** (pierwsza klatka) agenta Illustrator: nowego obrazu od agenta Illustrator, awatara lub sprite'a postaci albo żadnego. Gotowy klip odtwarza się w odpowiedzi. Klip jest dostępny tylko wtedy, gdy pozwala na to **Video Run Interval** (odstęp między klipami), i wlicza się w limit **Videos per reply** (liczba klipów na odpowiedź).

### Przerywanie przez postacie

Włącz **Interruptions**, aby postać mogła przerwać ostatnią wiadomość, gdy przerwanie pasuje do sytuacji. Komenda to `[interrupt: part="a verbatim phrase of at least three words"]`. Marinara szuka tej frazy w wiadomości bezpośrednio przed odpowiedzią, zachowuje tekst do końca frazy i kończy go myślnikiem. Dialog zachowuje zamykający cudzysłów. Jeśli frazy nie ma albo pasuje w dwóch miejscach, wiadomość pozostaje bez zmian.

Aby odzyskać oryginał, otwórz informacje o komendach odpowiedzi i wybierz **Restore original message** (przywróć oryginalną wiadomość). Ponowne generowanie najpierw przywraca pełny oryginał, więc nowa odpowiedź może zdecydować od nowa. Wybranie istniejącego swipe'a stosuje jego przerwanie, chyba że przywrócono oryginał. Twoje późniejsze ręczne zmiany są zachowywane.

## Echo Chamber

**Echo Chamber** to opcjonalny agent, który dodaje do sceny publiczność reagującą na żywo, jak czat na streamingu, w którym co jakiś czas pojawia się nowa reakcja. Włącz go w **Chat Settings → Agents**, na karcie **Echo Chamber**.

- Na komputerze przeciągnij pasek tytułu, żeby przesunąć okno, a krawędź, żeby zmienić jego rozmiar. Przypnij je, żeby pozostało otwarte. **X** zwija je do przycisku, który możesz przesuwać.
- Na telefonie zaczyna jako niewielkie okno nad wiadomościami. Przeciągnij pasek tytułu, aby je przesunąć, albo krawędź lub narożnik, aby zmienić rozmiar. Przypięcie utrzymuje je otwarte po dotknięciu innego miejsca, a blokada zapobiega przypadkowemu przesunięciu.
- Jego wygląd zależy od ustawienia **Chat widget style** (styl widgetów czatu) w **Settings → Appearance → App** (ustawienia, wygląd, aplikacja). Każdy czat zapamiętuje jego układ.

## Wybory CYOA

CYOA to skrót od Choose Your Own Adventure, czyli "wybierz własną przygodę". Agent CYOA Choices jest domyślnie wyłączony i działa tylko w trybie Roleplay. Po włączeniu dodaje pod odpowiedzią klikalne przyciski wyboru, a kliknięcie jednego z nich wysyła go jako twoją kolejną wiadomość. Żeby połączyć kilka wyborów albo najpierw poprawić wybór, włącz **Add CYOA choices to the message box instead of sending them** (dodawanie wyborów CYOA do pola wiadomości zamiast ich wysyłania) w **Settings → General → Input & Editing** (ustawienia, ogólne, wprowadzanie i edycja). Kliknięcie wyboru dodaje wtedy jego tekst do pola wiadomości.

## Rozwiązywanie problemów

| Objaw | Rozwiązanie |
| --- | --- |
| Wartość na pasku HUD jest błędna. | Popraw ją ręcznie i zablokuj, żeby kolejne uruchomienie jej nie zmieniło. Zobacz [Pasek HUD i trackery w trybie Roleplay](hud-and-trackers.md). Jeśli wartości ciągle się rozjeżdżają, użyj mocniejszego modelu dla agentów. |
| Sprite'y się nie zmieniają. | Sprawdź, czy postać ma bibliotekę sprite'ów. Możesz też użyć `/emote`. |
| Tło nigdy się nie zmienia. | Agent **Background** wybiera z twojej biblioteki, więc dodaj więcej teł. Zobacz [Tła w trybie Roleplay](backgrounds.md). |
| Ponownie wygenerowana odpowiedź wciąż idzie w złym kierunku. | Włącz **Debug mode**, otwórz **Agent activity → Injections**, a potem edytuj albo uruchom ponownie zapisany fragment, zanim wygenerujesz odpowiedź jeszcze raz. |

Więcej pomocy znajdziesz w przewodniku [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

## Powiązane przewodniki

- [Tła w trybie Roleplay](backgrounds.md)
- [Pasek HUD i trackery w trybie Roleplay](hud-and-trackers.md)
- [Starcia bojowe (Roleplay)](combat-encounters.md)
- [Narrative Director i Secret Plot](narrative-director.md)
- [Sceny: odgałęzienie roleplayu](scenes.md)
- [Sprite'y postaci](../characters/sprites.md)
- [Łączenie czatu Conversation z czatem Roleplay lub Game](../chats/connected-chats.md)
- [Makra](../prompts/macros.md)
