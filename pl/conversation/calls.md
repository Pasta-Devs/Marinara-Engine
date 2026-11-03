# Rozmowy audio i wideo w trybie Conversation

Rozmowa to ekran na żywo, podobny do komunikatora głosowego, na którym rozmawiasz z jedną postacią lub kilkoma przez mikrofon albo pisząc. Gdy trwa, leży na wierzchu zwykłego czatu Conversation. Rozmowy istnieją tylko w trybie Conversation.

Rozmowy to opcjonalny pakiet. Zainstaluj **Calls** z **Agents → Agent Organizer** (organizator agentów). Jeśli katalog poprosi o ponowne uruchomienie, zatrzymaj aplikację Marinara Engine i uruchom ją tak, jak zwykle (zobacz [Instalacja aplikacji Marinara Engine](../INSTALLATION.md)).

Podczas rozmowy postacie z działającym głosem Text to Speech (TTS, tekst zamieniany na mówiony dźwięk) mówią na głos. Postacie bez głosu odpowiadają wiadomościami tekstowymi na czacie rozmowy. Zamiast nieruchomego awatara możesz też pokazywać zapętlone klipy wideo postaci wykonane przez AI.

Aplikacja nagrywa mikrofon lub kamerę w twojej przeglądarce. Zależnie od trybu wejścia (niżej) twoja mowa jest zamieniana na tekst na twoim komputerze albo wysyłana do modelu wybranego dla czatu. Odpowiedzi są odtwarzane przez twoją usługę TTS. Gdy rozmowa się kończy, krótkie podsumowanie wraca do czatu Conversation. Pełny zapis rozmowy zostaje w osobnym magazynie rozmów.

## Czego potrzebujesz

- Zainstalowanego pakietu **Calls**.
- Czatu Conversation z co najmniej jedną postacią i konta dla modelu, który pisze odpowiedzi.
- Włączonych **Audio/Video Calls** i **Call Audio Pipeline** w ustawieniach czatu.
- Opcjonalnie: konta Text to Speech, aby postacie mówiły. Bez niego odpowiadają tekstem.
- Opcjonalnie: domyślny tryb mikrofonu wymaga jednorazowego pobrania Local Whisper (zobacz [Pobranie modelu Local Whisper](#download-local-whisper)). Zamiast tego możesz pisać na czacie rozmowy.

## Skonfiguruj pierwszą rozmowę

Zanim zaczniesz: potrzebujesz czatu Conversation z co najmniej jedną postacią i konta dla modelu, który pisze odpowiedzi (zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)).

1. Opcjonalnie: skonfiguruj Text to Speech (zobacz [Konfiguracja Text to Speech](#set-up-text-to-speech)). Bez tego każda postać dołącza tylko jako tekst.
2. Otwórz czat, a potem **Chat Settings → Agents → Calls** (ustawienia czatu, agenci, rozmowy).
3. Włącz **Audio/Video Calls**. Obok nazwy rozmowy pojawia się przycisk rozmowy.
4. Włącz **Call Audio Pipeline**. Bez tego nie można rozpocząć żadnej rozmowy, nawet jeśli tylko piszesz lub tylko słuchasz. Włącza też mikrofon.
5. Wybierz **Audio input mode** (tryb wejścia audio; niżej).
6. Kliknij **Start call** (rozpocznij rozmowę).

Jeśli to nie zadziałało: gdy widzisz komunikat "Conversation call audio is not enabled in Chat Settings", przełącznik **Call Audio Pipeline** jest wyłączony. To ustawienie globalne, więc włączenie go w jednym czacie włącza je dla wszystkich rozmów Conversation.

W nowym czacie najpierw dokończ kreator konfiguracji, a potem otwórz **Chat Settings** tego czatu. Ustawienia Calls pokazują się tylko wtedy, gdy pakiet Calls jest zainstalowany.

Dwa przełączniki wyglądają podobnie, ale robią co innego:

- **Audio/Video Calls** pokazuje przycisk rozmowy, więc możesz zadzwonić do postaci.
- Komenda **Calls** pozwala postaciom dzwonić do ciebie jako pierwsze. Gdy jest wyłączona, nadal możesz samodzielnie rozpoczynać rozmowy.

Główny przełącznik **Commands** w tej samej sekcji musi być włączony, aby działały komendy w rozmowie. Sama rozmowa może się rozpocząć także przy wyłączonym przełączniku.

<a id="set-up-text-to-speech"></a>

### Konfiguracja Text to Speech

Text to Speech decyduje, które postacie mogą mówić i jakim głosem. Pełny opis znajdziesz w [Konfiguracja syntezy mowy (TTS)](../media/tts-setup.md). W skrócie: otwórz **Connections**, kliknij **Add account** i wybierz **Text to speech**. Jeśli to konto jest już na liście w sekcji **On this device**, otwórz je stamtąd. Potem:

1. Włącz Text to Speech.
2. Wybierz źródło: **OpenAI-compatible**, **ElevenLabs**, **PocketTTS** lub **xAI Voice**.
3. Wpisz klucz API albo adres lokalnego serwera dla tego źródła.
4. Wybierz model i głos.
5. Ustaw **Voice option** na **One voice for all** albo **Selected per character or persona**. Osobne głosy postaci ułatwiają śledzenie rozmów grupowych.
6. Zapisz, a potem użyj przycisku podglądu, aby sprawdzić, czy słychać dźwięk.

Jeśli postać nie ma głosu, który aplikacja potrafi ustalić, ta postać jest w rozmowie tylko tekstowa.

### Wybór trybu wejścia audio

Gdy **Call Audio Pipeline** jest włączone, pojawia się lista **Audio input mode**. Jeśli nie masz pewności, zostaw ustawienie domyślne.

| Tryb | Co robi |
| --- | --- |
| **Mic recording + Local Whisper** (domyślny) | Nagrywa, gdy mikrofon nie jest wyciszony, pomija ciszę i zamienia twoją mowę na tekst na twoim komputerze. Najlepszy dla Firefoxa. |
| **Browser speech recognition** | Używa narzędzia do mowy wbudowanego w przeglądarkę. Obsługa bywa różna. Gdy go brakuje, aplikacja wraca do Local Whisper. |
| **Manual system dictation** | Tylko ustawia kursor w polu tekstowym rozmowy, aby dyktowanie systemu operacyjnego mogło tam pisać. Aplikacja nic nie nagrywa. |
| **Provider-native audio/video** | Wysyła nagrany dźwięk lub wideo prosto do modelu, jeśli model przyjmuje multimedia. |

Przyciski kamery i ekranu wymagają włączonego **Camera and screen input** i działają tylko w trybie **Provider-native audio/video**. W pozostałych trybach są widoczne, ale nieaktywne.

## Rozpoczynanie, odbieranie i kończenie rozmowy

**Rozpoczęcie rozmowy.** Gdy rozmowy są włączone, obok nazwy rozmowy jest przycisk telefonu. Jego podpowiedź to **Start call**, a gdy rozmowa trwa, **Open call**. Kliknij go, a otworzy się ekran rozmowy. W jednym czacie może być aktywna lub dzwoniąca tylko jedna rozmowa. Rozpoczęcie kolejnej otwiera ponownie bieżącą.

**Odbieranie rozmowy.** Postać może do ciebie zadzwonić, gdy komenda **Calls** jest włączona. W tym czacie nad polem wiadomości pojawia się baner **Incoming call** z przyciskami **Decline call** i **Answer call**. W innych miejscach aplikacji dostajesz powiadomienie o rozmowie przychodzącej i krótki sygnał dzwonka. Aplikacja nigdy nie odbiera za ciebie. Dołączają tylko postacie, które są dostępne: postać, której harmonogram lub status to offline, nie dołącza.

**Kończenie rozmowy.** Kliknij czerwony przycisk **End call** na ekranie rozmowy albo w zminimalizowanym pływającym okienku. Postać może też wyjść z rozmowy lub ją zakończyć komendą w rozmowie. Aplikacja przestaje wtedy nagrywać i dodaje kartę do czatu Conversation.

## Ekran rozmowy

Scena pokazuje po jednym kafelku dla każdego uczestnika, czyli twojej persony i każdej dostępnej postaci, oraz podświetla osobę, która mówi. Czat rozmowy zawiera wpisane wiadomości i odpowiedzi tylko tekstowe. Wypowiedzi mówione nie są tam powtarzane. Na komputerze jest to panel boczny. Na telefonie otwiera się jako szuflada przyciskiem **Open call chat** i zamyka przyciskiem **Close call chat**.

Pole pisania w rozmowie ma pole **Message in call**, przycisk **Send**, wybór emoji, GIF-ów i naklejek oraz szybki przełącznik modelu. Załączniki plików nie są obsługiwane na czacie rozmowy.

| Kontrolka | Co robi |
| --- | --- |
| Mikrofon | Wycisza i włącza twój mikrofon. Podpowiedź zmienia się zależnie od trybu, na przykład **Unmute microphone with Local Whisper**. |
| **Turn camera on** / **Turn camera off** | Tylko w trybie Provider-native audio/video przy włączonym **Camera and screen input**. |
| **Share screen** / **Stop sharing screen** | Ta sama zasada co przy kamerze. |
| **Character volume** | Przycisk wyciszenia i suwak od 0 do 100. Domyślnie 100, zapisywane w przeglądarce. |
| **Soundboard** | Lista dźwięków z kontrolką **Upload**. |
| **End call** | Czerwony przycisk rozłączenia. |

Jeśli mikrofon jest wyciszony przez dłuższy czas, zobaczysz komunikat "You are muted! Remember to unmute yourself first if you want to talk."

Jeśli opuścisz czat Conversation podczas rozmowy, ekran zmniejsza się do pływającego okienka z nazwą czatu, upływającym czasem i przyciskiem **End call**. Kliknij okienko, aby wrócić. Rozmowa trwa dalej, gdy przeglądasz aplikację.

### Soundboard

Soundboard ma cztery wbudowane dźwięki, których nie można usunąć: **Soft Chime**, **Tap**, **Sparkle** i **Pop**. Kliknij **Upload**, aby dodać własne (mp3, wav, ogg, webm lub m4a, do 8 MB każdy). Własne wgrane dźwięki możesz usunąć. Postacie mogą odtwarzać dźwięk komendą soundboardu.

## Obecność wideo postaci

Ta część jest opcjonalna i zaawansowana. **Character video presence** zastępuje kafelek z nieruchomym awatarem zapętlonym klipem postaci wykonanym przez AI. Domyślnie jest wyłączona. Przełącznik leży w **Chat Settings → Agents → Calls**.

Zanim zaczniesz: dodaj konto Video Generation w **Connections** i oznacz jedno jako **Default for Videos** albo wybieraj je za każdym razem.

1. Otwórz edytor postaci lub persony.
2. Otwórz zakładkę **Sprites**, a potem podzakładkę **Clips**.
3. Kliknij **Generate Clips** albo **Upload extra**, aby dodać własne.
4. W oknie **Generate Call Clips** wybierz **Video Generation Connection** i zaznacz **Use avatar as reference**.
5. Wybierz standardowe klipy do wykonania: **Idle**, **Talking**, **Laughing**, **Angry**, **Crying**, **Sighing**. Możesz też zdefiniować jeden własny klip, podając **Clip name** i opis działania.

Podczas mówionej tury aplikacja czyta w linii wskazówki głosowe, takie jak `[sighs]`, wybiera pasujący klip reakcji, a potem wraca do klipu Idle. Brakujący klip nigdy nie blokuje rozmowy: postać pokazuje wtedy nieruchomy awatar. Przycięty klip zapętla się w swoim zakresie przycięcia. Zobacz [Sprite'y postaci (wyrazy twarzy i całe sylwetki)](../characters/sprites.md).

Dwa kolejne przełączniki pojawiają się pod **Character video presence**, gdy ta opcja jest włączona:

- **Automatic video clips generation** (domyślnie wyłączone) tworzy tylko klipy **Idle** i **Talking** dla uczestnika, który ich potrzebuje. Klipy reakcji i własne nigdy nie powstają automatycznie.
- **Custom clips** (domyślnie wyłączone) pozwala postaci rzadko poprosić o jednorazowy klip w rozmowie na żywo i odtworzyć gotowy własny klip. Służy do szczególnych próśb, a nie do każdego nastroju.

Wyłączenie **Character video presence** wyłącza też oba te przełączniki. Klipy tutaj to wielokrotnego użytku pętle obecności, a nie pozycje **Videos** w galerii, które zawierają filmy scen.

## Konfiguracja zamiany mowy na tekst (zaawansowana)

Potrzebna tylko w trybie **Mic recording + Local Whisper** albo gdy chcesz użyć własnego serwera zamiany mowy na tekst.

<a id="download-local-whisper"></a>

### Pobranie modelu Local Whisper

Local Whisper zamienia twoją mowę na tekst na komputerze, na którym działa aplikacja Marinara Engine, więc dźwięk z mikrofonu nie opuszcza go na potrzeby transkrypcji. Tekst nadal trafia do twojego modelu jako część rozmowy. To najpewniejsza ścieżka mikrofonu w przeglądarkach ze słabą obsługą mowy, takich jak Firefox.

Zanim zaczniesz: zainstaluj pakiet Calls. Bez niego ta sekcja jest ukryta.

1. Otwórz **Connections** i znajdź **Speech to text** w sekcji **On this device**. Jeśli go nie ma na liście, kliknij **Add account** i wybierz **Speech to text**.
2. Znajdź **Local speech model** na tej stronie.
3. Wybierz model:
   - **Whisper Tiny (Multilingual)**: około 180 MB do pobrania i 350 MB pamięci. Najlepszy dla telefonów i starszych komputerów.
   - **Whisper Base (Multilingual)**: około 320 MB do pobrania i 650 MB pamięci. Lepiej radzi sobie z niewyraźną mową.
4. Kliknij **Download Whisper** i poczekaj na pasek postępu.
5. Uruchom aplikację Marinara Engine całkowicie od nowa, zanim użyjesz Calls.

Ikona kosza, **Delete Local Whisper**, usuwa model. Odinstalowanie Calls usuwa też pobrane modele Whisper, a ponowna instalacja nie pobiera ich znowu, dopóki jednego nie wybierzesz.

Jeśli to nie zadziałało: w wersji Lite aplikacji Marinara Engine zobaczysz komunikat "Local Whisper is disabled in Lite mode. Use a full Marinara install to download and run the local speech model." Jeśli zobaczysz komunikat o "native ONNX runtime", brakuje silnika mowy dla twojej platformy. Zainstaluj zależności ponownie tą samą wersją Node, której używasz do uruchamiania aplikacji, a potem uruchom ją ponownie.

<a id="use-your-own-speech-to-text-server"></a>

### Użyj własnego serwera zamiany mowy na tekst

Jeśli Local Whisper słabo radzi sobie z twoim językiem lub akcentem, wyślij głos do innego serwera zamiany mowy na tekst. Działa każdy serwer, który przyjmuje format OpenAI do zamiany mowy na tekst (adres `/audio/transcriptions`), niezależnie od tego, czy uruchamiasz go sam, czy korzystasz z usługi takiej jak OpenAI lub Groq.

1. Otwórz **Connections** i otwórz **Speech to text** w sekcji **On this device**. Jeśli go nie ma na liście, kliknij **Add account** i wybierz **Speech to text**. Jest ukryty, dopóki pakiet Calls nie jest zainstalowany.
2. Wpisz **Server URL**, na przykład `http://localhost:8000/v1`.
3. Wpisz **API key**, jeśli serwer go wymaga. Jest zapisywany w postaci zaszyfrowanej i pokazywany zamaskowany.
4. Wpisz nazwę **Model** używaną przez twój serwer. Zostaw puste, aby wysyłać `whisper-1`.
5. Opcjonalnie: wpisz kod **Language**, taki jak `pl` lub `de`. Zostaw puste, aby serwer sam wykrył język.
6. Kliknij **Test**. Aplikacja wysyła jednosekundowy cichy klip. Zobaczysz komunikat "The server answered." albo "The test failed."
7. Włącz **Use your own speech-to-text server**.

Gdy to jest włączone, **Mic recording + Local Whisper** wysyła twoją mowę na ten serwer i nie musisz pobierać Local Whisper. Twój dźwięk trafia na ten serwer, więc używaj takiego, któremu ufasz.

Serwer na tym samym komputerze działa bez zmian. Serwer na innym komputerze w twojej sieci jest odrzucany, chyba że ustawisz `STT_LOCAL_URLS_ENABLED=true` w pliku `.env` (zobacz [Konfiguracja serwera](../CONFIGURATION.md)).

Jeśli to nie zadziałało: przeczytaj komunikat pod przyciskiem **Test**. Komunikat "Could not reach the speech-to-text server" oznacza, że adres jest błędny albo serwer jest wyłączony. Komunikat z nazwą `STT_LOCAL_URLS_ENABLED` oznacza, że serwer jest na innym komputerze. Liczba pochodzi z twojego serwera: 401 zwykle oznacza błędny klucz API, a 404 błędny adres lub nazwę modelu. Jeśli rozmowy nadal używają Local Whisper, zaktualizuj Calls w **Agents → Agent Organizer**.

## Ustawienia i wartości domyślne

Ustawienia **Per chat** (dla czatu) dotyczą jednego czatu. Ustawienia **Global** (globalne) dotyczą każdej rozmowy Conversation.

| Ustawienie | Zakres | Domyślnie |
| --- | --- | --- |
| **Audio/Video Calls** | Per chat | Wyłączone |
| **Calls** (komenda) | Per chat | Włączone |
| **Generate voice cues in [tags]** | Per chat | Włączone |
| **Call Audio Pipeline** | Global | Wyłączone |
| **Audio input mode** | Global | Mic recording + Local Whisper |
| **Camera and screen input** | Global | Wyłączone |
| **Character video presence** | Global | Wyłączone |
| **Automatic video clips generation** | Global | Wyłączone |
| **Custom clips** | Global | Wyłączone |

Ustawienie globalne zmienione w jednym czacie zmienia się dla każdej rozmowy Conversation. Opcja **Generate voice cues in [tags]** prosi model o dodawanie krótkich wskazówek, takich jak `[whispering]`, `[laughing]` lub `[sighs]`, wewnątrz mówionych linii. Wpływają one na to, jak TTS czyta linię, i pomagają wybierać klipy reakcji. Wyłącz ją, aby mówione linie pozostały zwykłe.

## Komendy w rozmowie

Postacie używają w rozmowie tych samych ukrytych komend co w zwykłych wiadomościach. Każda wymaga swojego przełącznika w **Chat Settings → Agents → Commands** i włączonego głównego przełącznika **Commands**. Zobacz [Wybierz, których komend może używać postać](getting-started.md#choose-which-commands-a-character-can-use). Działają po cichu i nigdy nie są wypowiadane.

W rozmowie działają dwie dodatkowe: **Soundboard** (postać odtwarza dźwięk z soundboardu) oraz wyjście lub zakończenie (postać opuszcza rozmowę albo kończy ją dla wszystkich). **Notes** i **Influence** pojawiają się tylko wtedy, gdy czat ma połączony czat (zobacz [Łączenie czatu Conversation z czatem Roleplay lub Game](../chats/connected-chats.md)). Selfie wymaga **Selfie model** (zobacz [Selfie](selfies.md)). Niektóre komendy dodają do czatu rozmowy mały wpis, na przykład "sent a selfie" z obrazem.

## Podsumowanie po zakończonej rozmowie

Gdy rozmowa się kończy, w czacie Conversation pojawia się karta. Jej tytuł to **Call Started**, **Incoming Call**, **Call Ended** (z czasem trwania), **Call Declined** lub **Missed Call**. Po **Call Ended**, jeśli wydarzyło się coś istotnego, aplikacja pisze w tle krótkie podsumowanie i dodaje je jako ukryty kontekst, który model może czytać. Dzięki temu model wie o rozmowie, a jej treść nie jest kopiowana do widocznego czatu.

## Rozwiązywanie problemów

| Objaw | Rozwiązanie |
| --- | --- |
| Postacie mnie nie słyszą | Sprawdź, czy **Call Audio Pipeline** jest włączone, a przeglądarka zezwala na mikrofon dla strony aplikacji. W Firefoxie albo gdy mowa w przeglądarce nie działa, pobierz Local Whisper i użyj **Mic recording + Local Whisper**. |
| Opcja mowy w przeglądarce nic nie robi | Firefox nie ma rozpoznawania Web Speech, które mają przeglądarki Chromium i Safari. Użyj **Mic recording + Local Whisper** albo **Manual system dictation**. |
| Postać pisze zamiast mówić | Sprawdź ustawienia Text to Speech i przypisania głosów. Zobacz [Konfiguracja syntezy mowy (TTS)](../media/tts-setup.md). |
| Model źle rozumie moją mowę | Spróbuj **Whisper Base (Multilingual)**, zmniejsz hałas albo użyj **Provider-native audio/video**, jeśli twój model to obsługuje. Dla języka, z którym Whisper radzi sobie słabo, [użyj własnego serwera zamiany mowy na tekst](#use-your-own-speech-to-text-server) i ustaw jego **Language**. |
| Przycisk kamery lub ekranu jest nieaktywny | Użyj trybu **Provider-native audio/video** i włącz **Camera and screen input**. Twój model musi też przyjmować wejście z kamery lub ekranu. |
| Postać przestaje odpowiadać w trakcie rozmowy | Sprawdź konto modelu dla tego czatu, a potem znowu wyślij wiadomość na czacie rozmowy. |
| Rozmowa nie działa na moim telefonie | Czat rozmowy otwiera się przyciskiem **Open call chat**. Aby działała mowa, sprawdź konfigurację TTS. Dla mikrofonu obowiązują te same kroki z Local Whisper i uprawnieniami. |

## Powiązane przewodniki

- [Konfiguracja syntezy mowy (TTS)](../media/tts-setup.md)
- [Konfiguracja modelu Local Model](../connections/local-model.md)
- [Sprite'y postaci (wyrazy twarzy i całe sylwetki)](../characters/sprites.md)
- [Tryb Conversation: pierwsze kroki](getting-started.md)
