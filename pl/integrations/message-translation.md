# Tłumaczenie wiadomości

Marinara Engine tłumaczy wiadomości czatu między językami. Z tego przewodnika dowiesz się, jak działają czterej dostawcy tłumaczeń, przełączniki tłumaczenia automatycznego i przycisk **Translate** przy pojedynczej wiadomości. Poznasz też ograniczenia każdego dostawcy.

Tłumaczenie ustawia się osobno dla każdego czatu. Każdy czat ma własnego dostawcę, własny język docelowy i własne klucze. Ustawienie wpisane w jednym czacie nie przenosi się do innego.

## Gdzie znaleźć ustawienia tłumaczenia

1. Otwórz czat w dowolnym trybie (Conversation, Roleplay lub Game).
2. Otwórz panel **Chat Settings** (ustawienia czatu) dla tego czatu.
3. Znajdź sekcję **Translation** (tłumaczenie).

Wszystkie opisane niżej ustawienia dostawcy i przełączniki znajdują się w sekcji **Translation**.

## Wybór dostawcy

Lista rozwijana **Provider** (dostawca) ma cztery opcje:

| Dostawca | Czego wymaga | Uwagi |
|---|---|---|
| **Google Translate** | Niczego | Domyślnie. Za darmo, bez klucza. Limit 5000 znaków na żądanie. |
| **DeepL API** | Klucza API DeepL | Wyższa jakość. Działają klucze darmowe i płatne. |
| **DeepLX (self-hosted)** | Adresu serwera DeepLX | Dla instancji DeepLX uruchomionej samodzielnie. |
| **AI (via connection)** | Połączenia AI | Tłumaczy jeden z twoich dostawców AI. |

Domyślnie zaznaczona jest opcja **Google Translate** i nie wymaga ona żadnej konfiguracji. Innego dostawcę wybierz tylko wtedy, gdy potrzebna jest któraś z funkcji opisanych niżej.

### Pole **Target Language**

Pole **Target Language** (język docelowy) określa język, na który tłumaczysz. Domyślna wartość to `en` (angielski).

Format zależy od dostawcy:

- Dla opcji **Google Translate**, **DeepL API** i **DeepLX (self-hosted)** wpisz krótki kod języka. Przykłady: `en`, `ja`, `es`, `de`, `fr`, `zh`, `ko`.
- Dla opcji **AI (via connection)** wpisz nazwę języka. Przykłady: `English`, `Japanese`, `Spanish`.

### Konfiguracja DeepL API

Po wybraniu opcji **DeepL API** pojawia się pole **DeepL API Key** (klucz API DeepL). Wklej tutaj klucz ze swojego konta DeepL. Klucze DeepL wyglądają tak:

```
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
```

Klucz zakończony na `:fx` pochodzi z planu darmowego. Marinara wysyła go do darmowej usługi DeepL. Każdy inny klucz traktowany jest jak klucz płatny.

### Konfiguracja DeepLX

DeepLX to darmowy serwer tłumaczeń, który uruchamiasz samodzielnie. Po wybraniu opcji **DeepLX (self-hosted)** pojawia się pole **DeepLX URL** (adres DeepLX). Wpisz adres swojego serwera DeepLX, na przykład:

```
http://localhost:1188
```

Jeśli serwer DeepLX działa na tym samym urządzeniu albo w sieci lokalnej, jego adres jest adresem lokalnym. Ze względów bezpieczeństwa Marinara domyślnie blokuje żądania do adresów lokalnych. Aby je dopuścić, dodaj tę linię do pliku `.env` i zapisz plik:

```
DEEPLX_LOCAL_URLS_ENABLED=true
```

Plik `.env` to plik ustawień serwera. Miejsce, w którym się znajduje, opisuje [Konfiguracja serwera](../CONFIGURATION.md). Serwera nie trzeba restartować. Zmianę wychwytuje w ciągu kilku sekund.

Serwer DeepLX pod publicznym adresem internetowym nie potrzebuje tego ustawienia. Domyślnie blokowane są tylko adresy lokalne i adresy sieci prywatnych.

### Konfiguracja tłumaczenia przez AI

Po wybraniu opcji **AI (via connection)** tłumaczy jeden z twoich dostawców AI. Pojawiają się wtedy dwa dodatkowe pola.

Lista rozwijana **Connection** (połączenie) decyduje o tym, które połączenie AI wykonuje tłumaczenie. To pole jest wymagane. Puste pole oznacza błąd tłumaczenia z komunikatem "Connection ID is required for AI translation". Połączenie to zapisany skrót do dostawcy AI. Sposób jego utworzenia opisuje przewodnik po połączeniach, do którego link znajdziesz niżej.

Pole **AI Prompt** (prompt dla AI) zawiera instrukcję wysyłaną do AI przy tłumaczeniu. Wypełnia je wbudowany prompt domyślny, czyli tekst, który Marinara wysyła do AI. Da się go zmienić na potrzeby tego czatu. Po zmianie pojawia się przycisk **Restore** (przywrócenie), który cofa pole do wbudowanej wartości domyślnej. Domyślny prompt brzmi:

```
You are a translator. Translate the given text accurately, preserving formatting, markdown, and any special characters like *asterisks* for actions. Output ONLY the translated text, nothing else -- no explanations, no extra commentary.
```

## Przełączniki tłumaczenia automatycznego

Pod ustawieniami dostawcy są trzy przełączniki. Wszystkie trzy są domyślnie wyłączone.

Przełącznik **Auto-Translate Responses** tłumaczy każdą odpowiedź AI automatycznie, zaraz po jej wygenerowaniu. W trybie Game Mode Marinara usuwa z narracji znaczniki przeznaczone wyłącznie dla postaci Game Master (GM, czyli mistrza gry), zanim ją przetłumaczy.

Przełącznik **Translate My Messages** tłumaczy twoją wiadomość na język docelowy tuż przed wysłaniem jej do AI. Tłumaczenie zastępuje wpisany tekst. Kiedy tłumaczenie się nie uda, Marinara wysyła oryginalny tekst i pokazuje komunikat o błędzie.

Przełącznik **Show Draft Translate Button** dodaje przycisk **Translate draft** obok przycisku **Send** (wysłanie). Dzięki temu można przetłumaczyć wiadomość i przejrzeć albo poprawić wynik przed wysłaniem. To ręczna alternatywa dla przełącznika **Translate My Messages**, który tłumaczy przy wysyłaniu, bez możliwości sprawdzenia efektu.

W trybie **Conversation** zawsze możesz przetłumaczyć niewysłany szkic: otwórz przycisk buźki przy polu wiadomości, a następnie **Tools → Translate draft** (narzędzia → przetłumacz szkic), na komputerze lub telefonie. Nie musisz włączać **Show Draft Translate Button** ani automatycznego tłumaczenia. Akcja używa ustawień tłumaczenia wiadomości wychodzących tego czatu i zastępuje szkic do sprawdzenia; nie wysyła wiadomości. Nieudane tłumaczenie pozostawia szkic bez zmian.

## Przycisk **Translate** przy pojedynczej wiadomości

Każda wiadomość czatu, twoja i ta od AI, ma przycisk **Translate** (tłumaczenie) na pasku akcji pojawiającym się po najechaniu kursorem. Przycisk oznaczony jest ikoną języków. Działa niezależnie i nie wymaga żadnego z powyższych przełączników.

1. Najedź kursorem na wiadomość, żeby pokazał się jej pasek akcji.
2. Kliknij przycisk **Translate**.
3. Tłumaczenie pojawia się pod wiadomością.
4. Kliknij ten sam przycisk ponownie, żeby ukryć tłumaczenie. Jego podpowiedź brzmi teraz **Hide translation**.

Tłumaczenie wykonane w ten sposób zapisuje się razem z wiadomością. Przetrwa odświeżenie strony i zostaje na miejscu po przejściu do innego czatu i powrocie.

Przycisk przy pojedynczej wiadomości korzysta z tego samego dostawcy i języka docelowego, które ustawiono w sekcji **Translation**.

## Ograniczenia dostawców

Wybierając dostawcę, weź pod uwagę te ograniczenia.

- **Google Translate** odrzuca tekst dłuższy niż 5000 znaków. Pojawia się wtedy błąd "Text too long for Google Translate (max 5000 characters). Use DeepL or AI provider for longer texts." Przy dłuższym tekście przełącz się na DeepL albo na AI.
- **DeepL API**, **DeepLX (self-hosted)** i **AI (via connection)** przyjmują dłuższy tekst, do serwerowego limitu 50000 znaków na żądanie.
- **Google Translate**, **DeepL API** i **DeepLX (self-hosted)** przerywają pracę i pokazują błąd, jeśli trwa ona dłużej niż 15 sekund.
- **AI (via connection)** korzysta z modelu i limitu czasu ustawionych w samym połączeniu, a nie z limitu 15 sekund.
- **DeepLX (self-hosted)** kierowany na adres lokalny jest zablokowany, dopóki nie ustawisz `DEEPLX_LOCAL_URLS_ENABLED=true` w opisany wyżej sposób.

## Powiązane przewodniki

- [Działania na wiadomości: edycja, usuwanie, swipe'y, ponowne generowanie](../chats/messages.md)
- [Panel **Chat Settings** – przegląd](../chats/chat-settings.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
