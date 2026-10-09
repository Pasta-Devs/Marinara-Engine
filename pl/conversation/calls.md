# Rozmowy audio i wideo w trybie Conversation

Ten przewodnik wyjaśnia, jak działają rozmowy w trybie Conversation w aplikacji Marinara Engine. Zobaczysz, na czym polega rozmowa, jak ją skonfigurować, jak w niej mówić i jak rozwiązać typowe problemy.

Rozmowy istnieją wyłącznie w trybie Conversation. Czaty w trybie Roleplay i Game Mode nie mają ekranu rozmowy.

Calls to opcjonalny pakiet agenta. Zanim wykonasz poniższą konfigurację, zainstaluj pakiet **Calls** z sekcji **Agents → Download Agents** (pobieranie agentów), a potem uruchom ponownie aplikację Marinara Engine, kiedy katalog o to poprosi.

## Na czym polega rozmowa

Rozmowa to ekran na żywo w stylu aplikacji Discord, na którym mówisz z jedną postacią lub kilkoma naraz. Przez cały czas trwania rozmowy ekran ten leży na zwykłym czacie w trybie Conversation.

W trakcie rozmowy:

- Postacie z działającym głosem Text to Speech (TTS) wypowiadają swoje kwestie na głos. TTS to zamiana tekstu na mówiony dźwięk.
- Postacie bez głosu odpowiadają wiadomościami tekstowymi na czacie rozmowy.
- Ty odpowiadasz mikrofonem albo pisząc.
- Zamiast nieruchomego awatara można też oglądać zapętlone klipy wideo postaci wygenerowane przez AI.

Rozmowa nie działa jak telefon łączący dwa urządzenia. Marinara nagrywa mikrofon lub kamerę w przeglądarce na tym urządzeniu. Nagranie trafia do modelu wybranego dla danego czatu w trybie Conversation. Odpowiedzi wypowiada dostawca TTS, a dane rozmowy zostają na tym samym komputerze.

Po zakończeniu rozmowy Marinara zapisuje w zwykłym czacie w trybie Conversation krótkie podsumowanie rozmowy audio. Pełny zapis rozmowy zostaje w osobnym miejscu i nie jest kopiowany wiadomość po wiadomości do głównego czatu.

## Zanim zaczniesz

Żeby rozmowa głosowa zadziałała, przygotuj kolejno te elementy. Kroki oznaczone jako opcjonalne można pominąć.

1. Czat w trybie Conversation z co najmniej jedną postacią.
2. Zwykłe połączenie z modelem wybrane dla tego czatu. To ten model pisze odpowiedzi postaci w trakcie rozmowy.
3. Włączony przełącznik **Audio/Video Calls** (rozmowy audio i wideo) dla tego czatu – patrz sekcja "Włączanie rozmów dla czatu" poniżej.
4. Włączony przełącznik **Call Audio Pipeline** (obsługa dźwięku rozmów). Bez niego nie ruszy żadna rozmowa, nawet taka, w której tylko piszesz albo tylko słuchasz. On też odpowiada za wejście mikrofonowe.
5. Skonfigurowany Text to Speech, dzięki czemu postacie mogą mówić. Bez tego każda postać dołącza wyłącznie w formie tekstowej.
6. Opcjonalnie: model Local Whisper pobrany z sekcji **Connections** (Połączenia) po instalacji pakietu Calls, jeśli przeglądarka nie rozpoznaje mowy wystarczająco pewnie – w przeglądarce Firefox jest to konieczne. Zamiast modelu Local Whisper możesz też użyć własnego serwera zamiany mowy na tekst.
7. Opcjonalnie: połączenie wideo i wygenerowane klipy, jeśli chcesz korzystać z funkcji **Character Video Presence** (obecność wideo postaci).
8. Opcjonalnie: połączenie do generowania obrazów ustawione dla czatu jako Selfie Connection, jeśli postacie mają wysyłać selfie w rozmowie.

### Konfiguracja Text to Speech

Text to Speech decyduje o tym, które postacie mogą mówić i jakiego głosu używa każda z nich. To funkcja wspólna dla całej aplikacji, więc ma własny przewodnik.

Pełny opis krok po kroku znajdziesz w przewodniku [Konfiguracja syntezy mowy (TTS)](../media/tts-setup.md). W skrócie: otwórz sekcję **Connections**, potem **Text to Speech**, a następnie:

1. Włącz Text to Speech.
2. Wybierz źródło: **OpenAI-compatible**, **ElevenLabs**, **PocketTTS** albo **xAI Voice**.
3. Wpisz klucz dostawcy lub adres lokalnego serwera dla tego źródła.
4. Wybierz model i głos.
5. Ustaw opcję **Voice Option** na **One voice for all characters** albo **Selected per character**.
6. Zapisz, a potem sprawdź przyciskiem podglądu, czy dźwięk faktycznie słychać.

W rozmowie grupowej osobne głosy postaci dużo ułatwiają rozpoznanie, kto mówi. Postać, której głosu Marinara nie potrafi ustalić, bierze udział w rozmowie wyłącznie w formie tekstowej.

### Wybór trybu wejścia mikrofonowego

Po włączeniu przełącznika **Call Audio Pipeline** pojawia się lista rozwijana **Audio input mode** (tryb wejścia dźwięku) z czterema opcjami. Wybierz tę, która pasuje do przeglądarki i dostawcy.

- **Mic recording + Local Whisper**: nagrywa, dopóki mikrofon jest włączony, pomija ciszę i zamienia mowę na tekst na tym samym urządzeniu. To ustawienie domyślne i najlepszy wybór dla przeglądarki Firefox.
- **Browser speech recognition**: korzysta z funkcji Web Speech w przeglądarce. Web Speech API to wbudowane narzędzie przeglądarki do zamiany mowy na tekst. Obsługa bywa różna, a przy jej braku Marinara przełącza się na Local Whisper.
- **Manual system dictation**: ustawia tylko kursor w polu tekstowym rozmowy, żeby mogło tam pisać dyktowanie systemu operacyjnego. W tym trybie Marinara sama nie nagrywa mikrofonu.
- **Provider-native audio/video**: wysyła nagrany dźwięk lub obraz prosto do modelu w trybie Conversation, jeśli ten model przyjmuje multimedia bezpośrednio. Jeśli nie przyjmuje, użyj opcji Local Whisper albo rozpoznawania mowy w przeglądarce.

Przyciski kamery i ekranu pojawiają się tylko przy włączonej opcji **Camera and screen input** (obraz z kamery i ekranu). Działają wyłącznie w trybie **Provider-native audio/video**. W każdym innym trybie są widoczne, ale nieaktywne.

### Pobieranie modelu Local Whisper

Local Whisper zamienia mowę na tekst na tym urządzeniu, na którym działa Marinara. Dźwięk z mikrofonu nigdy nie opuszcza tego urządzenia w celu transkrypcji. Powstały tekst nadal trafia do modelu w trybie Conversation jako część rozmowy.

Local Whisper należy do pakietu Calls i jest najpewniejszą drogą dla mikrofonu w przeglądarkach ze słabym rozpoznawaniem mowy, w tym w przeglądarce Firefox. Po instalacji pakietu Calls otwórz sekcję **Connections**, otwórz **Local Model**, rozwiń kafelek i znajdź **Local Speech Model**. Ta sekcja jest ukryta, dopóki pakiet Calls nie zostanie zainstalowany. Ogólny opis kafelka **Local Model** znajdziesz w przewodniku [Konfiguracja modelu Local Model](../connections/local-model.md).

1. Wybierz model. Domyślny to **Whisper Tiny (Multilingual)**. Zajmuje około 180 MB do pobrania i około 350 MB pamięci podczas pracy. To najlepszy pierwszy wybór na telefony i starsze urządzenia.
2. Albo wybierz **Whisper Base (Multilingual)**, żeby uzyskać większą dokładność przy niewyraźnej mowie. Zajmuje około 320 MB do pobrania i około 650 MB pamięci.
3. Kliknij przycisk **Download Whisper**.
4. Poczekaj, aż pasek postępu dojdzie do końca.

Po pobraniu pojawia się kontrolka **Delete Local Whisper** (ikona kosza), którą można usunąć model.

Odinstalowanie pakietu Calls usuwa też każdy pobrany model Whisper wraz z zapisanym wyborem. W ten sposób odzyskujesz zajęte miejsce na dysku. Ponowna instalacja pakietu Calls przywraca kontrolki pobierania, ale model pobiera się dopiero po jego wybraniu.

<a id="use-your-own-speech-to-text-server"></a>

### Korzystanie z własnego serwera zamiany mowy na tekst

Jeśli Local Whisper słabo radzi sobie z twoim językiem albo akcentem, możesz zamiast tego wysyłać nagrany głos do innego modelu zamiany mowy na tekst. Działa to z każdym serwerem, który udostępnia punkt końcowy `/audio/transcriptions` w stylu OpenAI. Należą do nich samodzielnie hostowane serwery, takie jak Speaches, serwery faster-whisper, LocalAI i serwer whisper.cpp (uruchomiony z opcją `--inference-path /v1/audio/transcriptions`), a także dostawcy tacy jak OpenAI czy Groq.

1. Zainstaluj pakiet Calls, a potem otwórz sekcję **Connections** i znajdź kafelek **Speech to Text** (zamiana mowy na tekst). Dopóki pakiet Calls nie jest zainstalowany, ten kafelek jest ukryty.
2. Rozwiń kafelek i wpisz adres w polu **Server URL** (adres serwera), na przykład `http://localhost:8000/v1` dla serwera na twoim komputerze.
3. Wpisz klucz w polu **API key** (klucz API), jeśli wymaga go twój serwer lub dostawca. Klucz jest zapisywany w postaci zaszyfrowanej, a kafelek pokazuje go tylko w formie zamaskowanej.
4. W polu **Model** wpisz nazwę modelu, której używa twój serwer. Jeśli zostawisz to pole puste, wysyłana jest nazwa `whisper-1`.
5. Opcjonalnie: w polu **Language** (język) wpisz kod języka, na przykład `pl` albo `de`. Podanie modelowi języka zwykle poprawia dokładność. Zostaw pole puste, żeby serwer sam rozpoznał język.
6. Kliknij przycisk **Test** (test). Marinara wysyła jednosekundowe nagranie ciszy i informuje, czy serwer odpowiedział.
7. Włącz przełącznik na kafelku.

Dopóki przełącznik jest włączony, tryb **Mic recording + Local Whisper** wysyła twoją mowę do tego serwera zamiast do modelu Local Whisper. Nie trzeba do tego pobierać modelu Local Whisper. Wyłącz przełącznik, żeby wrócić do modelu Local Whisper. Dźwięk trafia na wpisany przez ciebie serwer, więc używaj tylko takiego, któremu ufasz.

Serwer na tym samym komputerze, na którym działa Marinara, nie wymaga dodatkowych ustawień. Serwer na innym komputerze w sieci domowej zostaje odrzucony, chyba że ustawisz `STT_LOCAL_URLS_ENABLED=true` w pliku `.env` serwera. Zobacz [Konfiguracja serwera](../CONFIGURATION.md).

Wymaga to wersji pakietu Calls, która obsługuje tę funkcję. Jeśli po włączeniu przełącznika rozmowy nadal korzystają z modelu Local Whisper, zaktualizuj pakiet Calls w sekcji **Agents → Download Agents**.

## Włączanie rozmów dla czatu

Rozmowy da się włączyć podczas tworzenia nowego czatu w trybie Conversation albo później, w ustawieniach czatu.

Przy nowym czacie w trybie Conversation najpierw dokończ kreator konfiguracji, potem otwórz ustawienia tego czatu i wykonaj te same kroki co poniżej. Ustawienia pakietów opcjonalnych widać dopiero po instalacji pakietu Calls.

W istniejącym czacie w trybie Conversation:

1. Otwórz czat.
2. Otwórz panel **Chat Settings** (ustawienia czatu).
3. Przejdź do sekcji **Agents**.
4. Otwórz **Calls**.
5. Włącz przełącznik **Audio/Video Calls**. Obok nazwy czatu powinien pojawić się przycisk rozmowy.
6. Włącz przełącznik **Call Audio Pipeline**. Bez niego żadna rozmowa się nie zacznie, nawet jeśli nigdy nie używasz mikrofonu.
7. Wybierz tryb **Audio input mode**.

Przełącznik **Audio/Video Calls** i komenda **Calls** to dwa różne ustawienia. **Audio/Video Calls** pokazuje przycisk rozmowy, dzięki czemu możesz zadzwonić do postaci. Komenda **Calls** pozwala postaciom dzwonić do ciebie jako pierwsze. Po wyłączeniu komendy **Calls** nadal zaczniesz rozmowę samodzielnie, ale postacie nie powinny inicjować rozmów przychodzących.

W sekcji **Agents** jest też główny przełącznik **Commands**, widoczny po instalacji pakietu z komendami. Musi być włączony, żeby ukryte komendy w rozmowie działały. Sama rozmowa ruszy nawet przy wyłączonym przełączniku.

### Ustawienia i wartości domyślne

Większość ustawień rozmowy znajdziesz w panelu **Chat Settings**, dalej **Agents**, dalej **Calls**. Część z nich jest globalna, czyli zmiana w jednym czacie działa na wszystkie rozmowy w trybie Conversation w całej aplikacji.

| Ustawienie | Zakres | Domyślnie |
|---|---|---|
| **Audio/Video Calls** | Dla czatu | Off |
| **Calls** (komenda) | Dla czatu | On |
| **Generate voice cues in [tags]** | Dla czatu | On |
| **Call Audio Pipeline** | Globalnie | Off |
| **Audio input mode** | Globalnie | Mic recording + Local Whisper |
| **Camera and screen input** | Globalnie | Off |
| **Character video presence** | Globalnie | Off |
| **Automatic video clips generation** | Globalnie | Off |
| **Custom clips** | Globalnie | Off |

Opcja **Generate voice cues in [tags]** prosi model o dodawanie krótkich wskazówek w nawiasach kwadratowych, na przykład `[whispering]`, `[laughing]` albo `[sighs]`, wewnątrz wypowiadanych kwestii. Te wskazówki wpływają na sposób czytania kwestii przez TTS i pomagają dobrać klip wideo z reakcją. Domyślnie jest włączona. Wyłącz ją, jeśli wypowiedzi mają zostać bez ozdobników.

## Rozpoczynanie, odbieranie i kończenie rozmowy

### Rozpoczynanie rozmowy

Kiedy rozmowy są włączone dla czatu, obok nazwy czatu pojawia się przycisk ze słuchawką. Jego podpowiedź brzmi **Start call**, gdy żadna rozmowa nie trwa, albo **Open call**, gdy rozmowa już się toczy.

Kliknij przycisk **Start call**. Pełny ekran rozmowy otwiera się od razu.

W jednym czacie może trwać albo dzwonić tylko jedna rozmowa. Jeśli zaczniesz rozmowę w trakcie innej, Marinara otwiera tę trwającą zamiast tworzyć nową.

### Rozmowy przychodzące od postaci

Postać może zadzwonić do ciebie, jeśli komenda **Calls** jest włączona. Gdy tak się stanie, a ty jesteś w tym czacie, nad polem wiadomości pojawia się baner **Incoming call**. Baner ma przycisk **Decline call** i przycisk **Answer call**.

Jeśli akurat pracujesz w innym miejscu aplikacji Marinara Engine, pojawia się powiadomienie o rozmowie przychodzącej, podobne do powiadomienia o wiadomości autonomicznej postaci. Rozlega się krótki dźwięk dzwonka. Marinara nigdy nie odbiera za ciebie, więc trzeba kliknąć przycisk **Answer call**.

Do rozmowy dołączają tylko postacie aktualnie dostępne. Jeśli harmonogram lub status oznacza postać jako niedostępną, ta postać nie dołącza do rozmowy, mimo że należy do czatu.

### Kończenie rozmowy

Rozmowę zakończysz w każdej chwili czerwonym przyciskiem **End call**. Jest on i na ekranie rozmowy, i w zminimalizowanym okienku. Postać również może wyjść z rozmowy albo ją zakończyć, korzystając z komendy dostępnej w trakcie rozmowy.

Po zakończeniu rozmowy Marinara przerywa nagrywanie, bezpiecznie zamyka multimedia i dodaje kafelek do zwykłego czatu w trybie Conversation.

## Ekran rozmowy i kontrolki

Obszar rozmowy pokazuje po jednym kafelku na uczestnika, czyli twoją personę i każdą dostępną postać. Kafelek osoby, która mówi, jest wyróżniony.

Czat rozmowy zbiera pisane wiadomości i odpowiedzi postaci działających tylko tekstowo. Na komputerze siedzi w panelu bocznym. Na telefonie chowa się za przyciskiem **Open call chat**. Czat otwiera się wtedy jako pełny panel boczny, a zamyka przyciskiem **Close call chat**. Wypowiadane kwestie służą jako dźwięk i nie powtarzają się jako osobne dymki czatu.

Panel pisania w rozmowie ma pole **Message in call** i przycisk **Send**. Ma też wybór emoji, GIF-ów i naklejek oraz szybki przełącznik połączenia. Załączników plikowych czat rozmowy jeszcze nie obsługuje.

Pasek sterowania na dole obszaru rozmowy zawiera przyciski z ikonami:

- Mikrofon: wycisza cię i włącza z powrotem. Jego podpowiedź zmienia się razem z trybem wejścia, na przykład **Unmute microphone with Local Whisper**.
- **Turn camera on** i **Turn camera off**: aktywne wyłącznie w trybie **Provider-native audio/video** przy włączonej opcji **Camera and screen input**.
- **Share screen** i **Stop sharing screen**: ta sama zasada co przy kamerze.
- **Character volume**: otwiera panel podręczny z przyciskiem wyciszenia i suwakiem głośności od 0 do 100. Domyślnie jest to 100 procent, a wybór zapisuje się w przeglądarce.
- **Soundboard**: otwiera listę dźwięków z kontrolką **Upload**.
- **End call**: czerwony przycisk rozłączenia.

Jeśli mikrofon zostaje wyciszony na dłużej, pojawia się przypomnienie: "You are muted! Remember to unmute yourself first if you want to talk."

Po opuszczeniu czatu w trybie Conversation w trakcie rozmowy rozmowa kurczy się do małego pływającego okienka. Okienko pokazuje nazwę czatu, upływający czas i czerwony przycisk **End call**. Kliknij wnętrze okienka, żeby wrócić na pełny ekran rozmowy. Marinara utrzymuje rozmowę, kiedy przeglądasz inne panele.

### Tablica dźwięków

Tablica dźwięków **Soundboard** to mała biblioteka dźwięków, które można odtworzyć w dowolnej rozmowie. Domyślnie są cztery wbudowane dźwięki: **Soft Chime**, **Tap**, **Sparkle** i **Pop**. Wbudowanych dźwięków nie da się usunąć.

Własny dźwięk wgrasz przyciskiem **Upload**. Obsługiwane formaty to mp3, wav, ogg, webm i m4a, każdy do 8 MB. Przy wgranych dźwiękach jest kontrolka usuwania. Postacie również mogą odtworzyć dźwięk komendą tablicy dźwięków.

## Obecność wideo postaci i klipy do rozmów

Funkcja **Character Video Presence** zastępuje kafelek z nieruchomym awatarem zapętlonym klipem wideo postaci wygenerowanym przez AI. Domyślnie jest wyłączona. Odpowiada za nią przełącznik **Character video presence** w panelu **Chat Settings**, dalej **Agents**, dalej **Calls**.

Konfiguracja klipów wideo do rozmów:

1. Utwórz połączenie Video Generation w sekcji **Settings**, dalej **Connections**.
2. Oznacz jedno połączenie jako **Default for Videos** albo wybieraj połączenie wideo przy każdym generowaniu.
3. Otwórz edytor postaci lub persony.
4. Otwórz zakładkę **Sprites**, a w niej podzakładkę **Clips**.
5. Użyj przycisku **Generate Clips** albo **Upload extra**, żeby dodać potrzebne klipy.

Więcej o sprite'ach i o edytorze znajdziesz w przewodniku [Sprite'y postaci (wyrazy twarzy i całe sylwetki)](../characters/sprites.md).

Przycisk **Generate Clips** otwiera okno **Generate Call Clips**. Wybierasz tam połączenie w polu **Video Generation Connection** oraz opcję **Use avatar as reference**. Potem zaznaczasz, które standardowe klipy mają powstać. Da się też zdefiniować jeden własny klip: nazwę w polu **Clip name** i opis czynności.

Sześć standardowych rodzajów klipu to **Idle**, **Talking**, **Laughing**, **Angry**, **Crying** i **Sighing**. Podczas wypowiedzi Marinara czyta wskazówki głosowe w wypowiedzi, na przykład `[sighs]` albo `[laughs]`. Dobiera pasujący klip z reakcją, a potem wraca do klipu Idle.

Przy włączonej opcji **Character video presence** pojawiają się pod nią dwa dodatkowe przełączniki:

- **Automatic video clips generation**: domyślnie wyłączony. Po włączeniu Marinara generuje sama tylko dwa podstawowe klipy, **Idle** i **Talking**, dla uczestnika rozmowy, który ich potrzebuje. Klipy z reakcjami i klipy własne nigdy nie powstają automatycznie. Robisz je ręcznie z podzakładki **Clips**.
- **Custom clips**: domyślnie wyłączony. Po włączeniu postać może rzadko poprosić o jednorazowy klip w trakcie trwającej rozmowy, a potem odtworzyć gotowy klip własny. Służy to wyjątkowym prośbom o obraz, a nie każdemu nastrojowi czy każdej kwestii.

Brak klipów nigdy nie blokuje rozmowy. Postać pokazuje po prostu nieruchomy awatar, dopóki klip nie będzie gotowy. Przycięty klip zapętla się w ustawionym zakresie przycięcia.

Wyłączenie opcji **Character video presence** wyłącza również **Automatic video clips generation** oraz **Custom clips**.

Klipy wideo do rozmów to co innego niż sekcja **Videos** w galerii. Galeria Videos trzyma filmy ze scen z czatów w trybie Roleplay, Game Mode i Conversation. Podzakładka **Clips** trzyma opisane tutaj zapętlone klipy obecności, których używa się wielokrotnie.

## Ukryte komendy w rozmowie

Postacie mogą używać w rozmowie tych samych ukrytych komend w nawiasach kwadratowych co w zwykłych wiadomościach w trybie Conversation. Każda komenda potrzebuje swojego przełącznika w **Chat Settings → Agents**, a główny przełącznik **Commands** w tej sekcji musi być włączony. Komendy działają po cichu i nigdy nie są wypowiadane ani pokazywane jako tekst.

- **Selfies**: postać generuje zdjęcie i wysyła je na czat rozmowy. Wymaga to połączenia **Selfie Connection** ustawionego dla czatu. Patrz [Selfie](selfies.md).
- **Memories**: postać zapisuje wspomnienie o innej postaci na podstawie rozmowy.
- **Music**: postać odtwarza utwór przez Music Player, o ile źródło muzyki jest podłączone.
- **Haptics**: postać steruje podłączonym urządzeniem haptycznym w intymnych momentach, o ile takie urządzenie jest podłączone.
- **Reactions**: postać reaguje emoji na twoją ostatnią pisaną wiadomość w rozmowie.
- **Cross-Post**: postać przenosi bieżący temat do innego wspólnego czatu w trybie Conversation.
- **Schedule Updates**: postać na jakiś czas zmienia swój status na dostępny, bezczynny, nie przeszkadzać albo niedostępny oraz swoje zajęcie, a potem wraca do harmonogramu. Patrz [Harmonogramy postaci i wiadomości autonomiczne](schedules.md#characters-can-change-their-own-status).
- **Notes** i **Influence**: zapisują trwałą notatkę albo jednorazową podpowiedź i pojawiają się tylko wtedy, gdy czat ma skonfigurowany czat powiązany.
- **Soundboard**: postać odtwarza jeden z dźwięków tablicy dźwięków rozmowy.
- Wyjście i zakończenie: postać może sama wyjść z rozmowy albo zakończyć ją dla wszystkich.

Niektóre komendy dodają na czat rozmowy mały wpis systemowy. Selfie pokazuje na przykład wpis "sent a selfie" wraz z obrazem, a klip własny pokazuje element zastępczy na czas renderowania.

## Podsumowanie po zakończonej rozmowie

Po zakończeniu rozmowy Marinara dodaje kafelek do zwykłego zapisu czatu w trybie Conversation. Kafelek pokazuje status rozmowy. Możesz zobaczyć takie tytuły:

- **Call Started**
- **Incoming Call**
- **Call Ended**, wraz z długością rozmowy
- **Call Declined**
- **Missed Call**

Po kafelku **Call Ended** Marinara generuje w tle krótkie podsumowanie rozmowy audio, o ile wydarzyło się w niej cokolwiek istotnego. Potem dodaje to podsumowanie do czatu w trybie Conversation jako ukryty kontekst, który model może przeczytać. Dzięki temu model wie, o czym była mowa, a cała rozmowa nie trafia do widocznego czatu.

Szczegółowy zapis rozmowy zostaje w osobnym miejscu. Do zwykłego czatu wraca wyłącznie krótkie podsumowanie.

## Rozwiązywanie problemów

### Rozmowa nie startuje i pojawia się komunikat o wyłączonym dźwięku

Jeśli po kliknięciu przycisku **Start call** widzisz komunikat "Conversation call audio is not enabled in Chat Settings", włącz przełącznik **Call Audio Pipeline**. Otwórz panel **Chat Settings**, dalej **Agents**, dalej **Calls**, i go włącz. To ustawienie jest wymagane przy każdej rozmowie, nawet takiej, w której tylko piszesz. Jest globalne, więc włączenie go w jednym czacie włącza je we wszystkich rozmowach w trybie Conversation.

### Słyszę postacie, ale one nie słyszą mnie

Otwórz panel **Chat Settings**, dalej **Agents**, dalej **Calls**, i sprawdź, czy przełącznik **Call Audio Pipeline** jest włączony. Potem sprawdź, czy przeglądarka dała stronie aplikacji Marinara Engine dostęp do mikrofonu.

Jeśli korzystasz z przeglądarki Firefox albo rozpoznawanie mowy w przeglądarce nie działa, zainstaluj pakiet Calls i pobierz model Local Whisper. Otwórz sekcję **Connections**, dalej **Local Model**, dalej **Local Speech Model**. Potem wybierz tryb **Mic recording + Local Whisper**.

### Local Whisper zgłasza, że jest niedostępny

Local Whisper potrzebuje natywnego środowiska ONNX dla danej platformy. ONNX to silnik, który uruchamia lokalny model mowy. Jeśli model przygotowano dla innej wersji środowiska Node, zainstaluj zależności ponownie z tą samą wersją Node, na której działa Marinara, a potem uruchom aplikację ponownie.

Jeśli używasz wersji "Lite" aplikacji Marinara Engine, Local Whisper jest w niej wyłączony. Aplikacja pokazuje wtedy: "Local Whisper is disabled in Lite mode. Use a full Marinara install to download and run the local speech model." Do korzystania z Local Whisper potrzebna jest pełna instalacja.

### Opcja rozpoznawania mowy w przeglądarce nic nie robi

Rozpoznawanie mowy w przeglądarce zależy od jej obsługi. Firefox nie oferuje takiego rozpoznawania Web Speech jak przeglądarki Chromium i Safari. Użyj trybu **Mic recording + Local Whisper**, żeby mówić bez rąk, albo trybu **Manual system dictation**, żeby pisać dyktowaniem systemu operacyjnego.

### Postać tylko pisze, zamiast mówić

Sprawdź ustawienia Text to Speech i przypisanie głosów. Postać potrzebuje albo jednego globalnego głosu, albo własnego głosu, który dostawca TTS potrafi ustalić. Patrz [Konfiguracja syntezy mowy (TTS)](../media/tts-setup.md).

### Model źle rozumie moją mowę

Zamiast modelu Whisper Tiny wypróbuj **Whisper Base (Multilingual)** dla większej dokładności. Ogranicz hałas i muzykę w tle. Jeśli model to obsługuje, przełącz **Audio input mode** na **Provider-native audio/video**, żeby model słyszał dźwięk bezpośrednio. W przypadku języka, z którym Whisper słabo sobie radzi, [skorzystaj z własnego serwera zamiany mowy na tekst](#use-your-own-speech-to-text-server) z modelem, który zna ten język, i wpisz kod tego języka w polu **Language**.

### Test Speech to Text kończy się błędem

Przeczytaj komunikat pod przyciskiem **Test**. "Could not reach the speech-to-text server" oznacza, że adres jest błędny albo serwer nie działa. Komunikat, w którym pada nazwa `STT_LOCAL_URLS_ENABLED`, oznacza, że serwer działa na innym komputerze w twojej sieci; ustaw tę zmienną na `true` w pliku `.env`. Kod liczbowy, taki jak 401 albo 404, pochodzi od twojego serwera: 401 zwykle oznacza błędny klucz API, a 404 – błędny adres albo błędną nazwę modelu.

### Przycisk kamery albo ekranu jest nieaktywny

Te przyciski działają tylko w trybie **Provider-native audio/video** przy włączonej opcji **Camera and screen input**. Zmień tryb **Audio input mode**, włącz opcję **Camera and screen input** i spróbuj ponownie. Przyciski pomagają zresztą tylko wtedy, gdy model faktycznie potrafi wykorzystać obraz z kamery lub ekranu.

### Rozmowa nie działa na telefonie

Na telefonie czat rozmowy otwiera przycisk **Open call chat**, a zamyka **Close call chat**. Jeśli postać nie chce mówić, sprawdź konfigurację Text to Speech. Przy problemach z mikrofonem na telefonie obowiązują te same kroki z modelem Local Whisper i uprawnieniami co wyżej.

### Postać przestała odpowiadać w trakcie rozmowy

Postacie odpowiadają tylko wtedy, gdy działa połączenie z modelem wybrane dla czatu. Jeśli odpowiedzi się urwały, sprawdź to połączenie, a potem spróbuj wysłać wiadomość na czacie rozmowy jeszcze raz.

## Powiązane przewodniki

- [Konfiguracja syntezy mowy (TTS)](../media/tts-setup.md)
- [Konfiguracja modelu Local Model](../connections/local-model.md)
- [Sprite'y postaci (wyrazy twarzy i całe sylwetki)](../characters/sprites.md)
- [Tryb Conversation: pierwsze kroki](getting-started.md)
