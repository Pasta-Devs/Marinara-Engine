# Tłumaczenie wiadomości

Marinara Engine tłumaczy wiadomości czatu między językami. Z tego przewodnika dowiesz się, jak wybrać usługę tłumaczenia, ustawić języki, włączyć tłumaczenie automatyczne i przetłumaczyć pojedynczą wiadomość.

Tłumaczenie ustawia się osobno dla każdego czatu. Każdy czat ma własną usługę, własne języki i własne klucze. Żeby nowe czaty zaczynały z tymi samymi ustawieniami, zapisz je jako [domyślne ustawienia tłumaczenia](#translator-defaults-for-new-chats).

## Gdzie znaleźć ustawienia tłumaczenia

1. Otwórz czat w dowolnym trybie (Conversation, Roleplay lub Game).
2. Otwórz **Chat Settings** (ustawienia czatu).
3. Znajdź sekcję **Translation** (tłumaczenie).

Wszystkie opisane niżej ustawienia znajdują się w tej sekcji.

## Wybór dostawcy

Lista **Provider** (dostawca) ma cztery opcje.

| Dostawca | Czego wymaga | Uwagi |
| --- | --- | --- |
| **Google Translate** | Niczego | Opcja domyślna. Za darmo, bez klucza. Do 5000 znaków na żądanie. |
| **DeepL API** | Klucza API DeepL | Wyższa jakość. Działają klucze darmowe i płatne. |
| **DeepLX (self-hosted)** | Adresu serwera DeepLX | Dla serwera DeepLX uruchomionego samodzielnie. |
| **AI (via connection)** | Konta AI | Tłumaczy jeden z twoich modeli AI. |

Usługa Google Translate działa bez żadnej konfiguracji. Inną opcję wybierz tylko wtedy, gdy potrzebujesz tego, co oferuje.

### Ustawianie języków

Języki ustawiają dwa pola. Oba mają domyślnie wartość `en` (angielski).

- **Model Language** (język modelu) to język, który model AI rozumie i w którym odpowiada. Kiedy piszesz we własnym języku, twoja wiadomość jest tłumaczona na ten język, zanim przeczyta ją AI. Korzystają z niego **Translate My Messages** i **Translate draft**.
- **My Language** (mój język) to język, w którym czytasz. Na ten język są tłumaczone odpowiedzi AI. Korzystają z niego **Auto-Translate Responses** i przycisk **Translate** przy pojedynczej wiadomości.

Na przykład jeśli piszesz po hiszpańsku, a AI najlepiej radzi sobie po angielsku, ustaw **Model Language** na `en`, a **My Language** na `es`.

Dla Google Translate, DeepL API i DeepLX wpisz krótki kod, na przykład `en`, `ja`, `es`, `de`, `fr`, `zh` albo `ko`. Dla AI (via connection) wpisz nazwę języka, na przykład `English`, `Japanese` albo `Spanish`.

Jeśli się nie udało: błędny kod albo nazwa kończy się błędem albo niezmienionym tekstem. Sprawdź format właściwy dla wybranego dostawcy.

### DeepL API

Wybierz **DeepL API** i wklej klucz ze swojego konta DeepL w pole **DeepL API Key** (klucz API DeepL). Klucz zakończony na `:fx` pochodzi z planu darmowego i Marinara wysyła go do darmowej usługi DeepL. Każdy inny klucz traktowany jest jak płatny.

```text
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
```

### DeepLX

DeepLX to darmowy serwer tłumaczeń, który uruchamiasz samodzielnie. Wybierz **DeepLX (self-hosted)** i wpisz adres swojego serwera w polu **DeepLX URL** (adres DeepLX), na przykład `http://localhost:1188`.

Serwer DeepLX na twoim komputerze albo w sieci lokalnej ma adres lokalny. Ze względów bezpieczeństwa Marinara domyślnie blokuje adresy lokalne. Aby je dopuścić, dodaj tę linię do pliku `.env` i zapisz plik. Ponowne uruchamianie nie jest potrzebne. Zmiana zaczyna działać zwykle w ciągu kilku sekund, najwyżej po około 30 sekundach. Gdzie jest ten plik, pokazuje [Konfiguracja serwera](../CONFIGURATION.md).

```text
DEEPLX_LOCAL_URLS_ENABLED=true
```

Serwer DeepLX pod publicznym adresem internetowym nie potrzebuje tego ustawienia.

### AI (via connection)

Wybierz **AI (via connection)**, żeby tłumaczył jeden z twoich modeli AI. Pojawiają się trzy pola.

- **Connection** (połączenie): konto AI, które tłumaczy. To pole jest wymagane. Jeśli zostanie puste, tłumaczenie kończy się błędem "Connection ID is required for AI translation". Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).
- **Outgoing Message Prompt** (prompt dla wiadomości wychodzących) i **Incoming Response Prompt** (prompt dla odpowiedzi przychodzących): instrukcje, które AI dostaje, gdy tłumaczy twoje wiadomości i własne odpowiedzi. Oba zaczynają od wbudowanego promptu domyślnego, który da się zmienić na potrzeby tego czatu. `{{targetLanguage}}` zamienia się w wartość pola **Model Language** albo **My Language**. Po zmianie promptu przycisk **Restore** (przywrócenie) cofa go do wartości domyślnej. Domyślny prompt brzmi:

```text
You are a translator. Translate the given text accurately into {{targetLanguage}},
preserving formatting, markdown, and any special characters like *asterisks* for actions.
Output ONLY the translated text, nothing else -- no explanations, no extra commentary.
```

## Włączanie tłumaczenia automatycznego

Pod ustawieniami dostawcy są cztery przełączniki. Wszystkie są domyślnie wyłączone.

- **Auto-Translate Responses**: tłumaczy każdą odpowiedź AI zaraz po jej wygenerowaniu. W trybie Game Mode Marinara najpierw usuwa z narracji znaczniki przeznaczone wyłącznie dla mistrza gry.
- **Translate My Messages**: tłumaczy twoją wiadomość na język z pola **Model Language** tuż przed wysłaniem jej do AI i zastępuje wpisany tekst. Kiedy tłumaczenie się nie uda, Marinara wysyła oryginalny tekst i pokazuje błąd.
- **Show Draft Translate Button**: dodaje przycisk **Translate draft** obok przycisku **Send** (wysłanie), żeby można było przejrzeć i poprawić tłumaczenie przed wysłaniem. To ręczna alternatywa dla **Translate My Messages**.
- **Show Only Translation** (pokazywanie tylko tłumaczenia): pokazuje tłumaczenie przetłumaczonej wiadomości w miejscu oryginału, zamiast obu tekstów razem.

W trybie Conversation zawsze możesz przetłumaczyć niewysłany szkic: kliknij przycisk buźki przy polu wiadomości, a następnie **Tools → Translate draft** (narzędzia, przetłumacz szkic), na komputerze lub telefonie. Nie musisz włączać żadnego z tych przełączników. Akcja używa ustawień tłumaczenia wiadomości wychodzących tego czatu i zastępuje szkic do sprawdzenia. Niczego nie wysyła. Nieudane tłumaczenie pozostawia szkic bez zmian.

<a id="translator-defaults-for-new-chats"></a>

## Domyślne ustawienia tłumaczenia dla nowych czatów

Przycisk **Save translator defaults** (zapisanie domyślnych ustawień tłumaczenia) pod przełącznikami zapisuje ustawienia tłumaczenia tego czatu dla nowych czatów w każdym trybie. Ustawienia z kreatora i z profilu ustawień mają pierwszeństwo. Istniejące czaty zachowują własne ustawienia. Przycisk **Forget saved defaults** (usunięcie zapisanych ustawień domyślnych) je czyści. [Noodle](../agents/noodle-settings.md#translation) korzysta z tych samych ustawień domyślnych.

Klucz API DeepL i adres DeepLX zostają w tej instalacji aplikacji Marinara Engine. Eksporty czatów, wyeksportowane profile ustawień i pliki z **Export Profile** (Eksportuj profil) je pomijają, a import żadnego z nich nigdy ich nie ustawia. Po przeniesieniu czatu do innej instalacji wpisz je ponownie.

## Tłumaczenie pojedynczej wiadomości

Każda wiadomość, twoja i ta od AI, ma na pasku akcji przycisk **Translate** (tłumaczenie, ikona języków). Działa bez żadnego z powyższych przełączników.

1. Najedź kursorem na wiadomość albo dotknij jej na telefonie, żeby pokazał się jej pasek akcji.
2. Kliknij **Translate**.
3. Tłumaczenie pojawia się pod wiadomością albo, przy włączonym **Show Only Translation**, w jej miejscu.
4. Kliknij przycisk ponownie, żeby ukryć tłumaczenie. Jego etykieta brzmi wtedy **Hide translation**.

Tłumaczenie zapisuje się razem z wiadomością i przetrwa odświeżenie strony oraz przejście do innego czatu. Korzysta z tego samego dostawcy i języka z pola **My Language** co sekcja opisana wyżej.

## Ograniczenia dostawców

- **Google Translate** odrzuca tekst dłuższy niż 5000 znaków z błędem "Text too long for Google Translate (max 5000 characters). Use DeepL or AI provider for longer texts."
- **DeepL API**, **DeepLX (self-hosted)** i **AI (via connection)** przyjmują dłuższy tekst, do serwerowego limitu 50000 znaków na żądanie.
- **Google Translate**, **DeepL API** i **DeepLX (self-hosted)** przerywają pracę z błędem po 15 sekundach.
- **AI (via connection)** korzysta z limitu czasu twojego modelu AI, a nie z limitu 15 sekund.
- **DeepLX (self-hosted)** pod adresem lokalnym jest zablokowany, dopóki nie ustawiono `DEEPLX_LOCAL_URLS_ENABLED=true`.

## Powiązane przewodniki

- [Działania na wiadomości: edycja, usuwanie, swipe'y, ponowne generowanie](../chats/messages.md)
- [Panel **Chat Settings** – przegląd](../chats/chat-settings.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
