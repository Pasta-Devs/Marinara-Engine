# Połączenia abonamentowe z Claude, ChatGPT i Grok

Trzy usługi pozwalają czatować w ramach planu, za który już płacisz, zamiast używać klucza API: **Claude (Subscription)**, **OpenAI (ChatGPT)** i **Grok CLI (Subscription)**. Instalujesz małe narzędzie wiersza poleceń (CLI) i logujesz się w nim jeden raz. Aplikacja Marinara Engine korzysta potem z tego logowania. Do aplikacji Marinara Engine nie wkleja się niczego.

Potrzebny plan:

- **Claude (Subscription)**: Anthropic Pro lub Max albo inny plan, który akceptuje Claude Code.
- **OpenAI (ChatGPT)**: konto ChatGPT. Limity użycia zależą od planu.
- **Grok CLI (Subscription)**: SuperGrok lub X Premium+.

## Dodawanie konta abonamentowego

Zanim zaczniesz: narzędzie CLI musi być zainstalowane i zalogowane na komputerze, na którym działa serwer Marinara. To nie jest telefon ani przeglądarka, w której oglądasz aplikację Marinara Engine. Jeśli Marinara działa na innym komputerze albo w kontenerze Docker, wykonaj tam kroki 1 i 2. Polecenia `npm` wymagają środowiska Node.js, które masz, jeśli aplikacja Marinara Engine została zainstalowana ze źródeł. Zobacz [Instalacja aplikacji Marinara Engine](../INSTALLATION.md).

1. Otwórz terminal na komputerze, na którym działa Marinara. Terminal to okno, w którym wpisuje się polecenia. W systemie Windows otwórz PowerShell. W systemie macOS otwórz Terminal.
2. Uruchom polecenie instalacji dla swojej usługi, a potem jej polecenie logowania. Narzędzie pokazuje własne kroki logowania, zwykle stronę internetową, na której się logujesz.

| Usługa | Instalacja | Logowanie |
| --- | --- | --- |
| Claude | `npm i -g @anthropic-ai/claude-code` | `claude login` |
| ChatGPT | `npm i -g @openai/codex` | `codex login` |
| Grok | zobacz niżej | `grok login` |

Dla usługi Grok aplikacja pokazuje to polecenie instalacji. Jeśli nie działa w twoim systemie, postępuj według własnych instrukcji serwisu x.ai dla Grok CLI.

```bash
curl -fsSL https://x.ai/cli/install.sh | bash
```

3. W aplikacji Marinara Engine kliknij **Connections** (Połączenia) na górnym pasku, a potem **Add** (dodaj).
4. W sekcji **Chat** (czat) kliknij swoją usługę. Te usługi mają etykietę **Sign in** (logowanie).
5. Okno pokazuje **Sign in first** (najpierw się zaloguj) i podaje polecenie. Nie ma pola klucza. Kliknij **Connect** (połącz). Marinara testuje logowanie. **Connected** oznacza, że działa.
6. Wybierz model z listy, a potem kliknij **Done** (gotowe). W przypadku Grok CLI możesz też zostawić model pusty, co oznacza użycie domyślnego modelu narzędzia CLI (zobacz [Grok CLI (Subscription)](#grok-cli-subscription)).

Wyślij wiadomość w czacie, żeby to potwierdzić. Odpowiedź oznacza, że wszystko działa.

Jeśli to nie zadziałało:

- **Marinara could not use the login on this computer.** Narzędzie CLI nie jest zainstalowane albo zalogowane na komputerze z aplikacją Marinara Engine. Uruchom tam polecenie logowania, a potem kliknij **Try again** (ponowna próba).

## Claude (Subscription)

Sekcje od tego miejsca opisują opcjonalne ustawienia. Do czatowania nie są potrzebne.

Ta usługa korzysta z twojego planu Claude przez Claude Code. W edytorze modelu (**Edit model**) ma trzy dodatkowe kontrolki: zapisywanie promptów w pamięci podręcznej, **Fast mode** (tryb szybki) i **Diagnose model routing** (diagnoza kierowania do modelu).

### Wydłużona pamięć podręczna tokenów

Zapisywanie promptów w pamięci podręcznej pozwala Claude ponownie wykorzystać początek twojego promptu, więc powtarzane żądania zużywają mniej twojego limitu. **Prompt caching → Extended token caching (1 hour)** (pamięć podręczna promptów, wydłużona pamięć podręczna tokenów na godzinę) żąda pamięci podręcznej na godzinę, co pomaga, gdy robisz przerwy między wiadomościami. Wymaga Claude Code w wersji 2.1.242 lub nowszej. Marinara wysyła to ustawienie razem z żądaniem i nie zmienia twoich zapisanych ustawień Claude.

Gdy opcja jest wyłączona, Claude korzysta z własnego ustawienia domyślnego dla twojego konta. Zobacz [pamięć podręczną promptów w Claude Code](https://code.claude.com/docs/en/prompt-caching).

### Fast mode

Przełącznik **Fast mode → Use Claude Code fast-mode routing** (tryb szybki, kierowanie w trybie szybkim Claude Code) jest domyślnie wyłączony. Niech taki zostanie. Prosi Claude Code o szybszy poziom modelu, ale aplikacja informuje, że obecne modele już go nie oferują, więc włączenie nie daje nic przydatnego i może dodać narzut. Jeśli spróbujesz go włączyć, pojawia się okno o tytule **Turn on fast mode?** (włączyć tryb szybki?). Kliknij **Keep it off** (zostaw wyłączone).

### Diagnose model routing

Użyj przycisku **Diagnose model routing**, gdy wybrany jest duży model, na przykład Opus, a podejrzewasz, że odpowiada mniejszy.

1. Wybierz model. Do czasu ustawienia modelu przycisk pozostaje nieaktywny.
2. Kliknij **Diagnose model routing**. Marinara najpierw zapisuje niezapisane zmiany.
3. Przeczytaj wynik. Marinara wysyła prawdziwy prompt przez twoje logowanie Claude Code i podaje, za który model twoje konto zostało obciążone.

## OpenAI (ChatGPT)

Ta usługa korzysta z twojego konta ChatGPT przez Codex CLI. Marinara odczytuje lokalny plik logowania Codex i odświeża sesję, kiedy tylko może.

Aby ustawić, jak długo Codex myśli przed odpowiedzią, otwórz **Edit model**, włącz **Use custom defaults for this model** (własne wartości domyślne dla tego modelu) i wybierz **Reasoning Effort** (poziom rozumowania). Na start ustawiony jest poziom **Default** (domyślny), który zachowuje poziom, jakiego Codex używa dla danego modelu. Czat może wybrać własny poziom w **Advanced Parameters** (parametry zaawansowane). Poziom z presetu go nie zmienia. Model Codex użyty jako zapasowy kieruje się wyłącznie własnym poziomem, a agenci korzystający z modelu używają poziomu modelu. Dostępne poziomy odpowiadają tym, które oferuje wybrany model.

## Grok CLI (Subscription)

Ta usługa uruchamia Grok CLI na komputerze z aplikacją Marinara Engine. Od innych usług różni się dwiema rzeczami:

- Nie obsługuje streamingu. Odpowiedź pojawia się od razu w całości, a nie słowo po słowie.
- Okno kontekstu ma domyślnie 32 000 tokenów. Tokeny to małe kawałki tekstu, które liczą modele. Duże prompty mogą przekroczyć limit tury samego narzędzia CLI, więc wartość domyślna pozostaje niska. W modelu możesz ustawić większe **Max Context Window** (maksymalne okno kontekstu).

W edytorze modelu **Use the Grok CLI default** (użyj ustawienia domyślnego Grok CLI) zostawia model pusty, żeby narzędzie CLI samo wybrało model. Edytor wskazuje `grok-composer-2.5-fast` jako zwykle najbezpieczniejszy model do roleplayu, bo Marinara uruchamia narzędzie CLI bez interfejsu (headless), z wyłączonymi własnymi narzędziami, pamięcią, wyszukiwaniem w sieci, planami i podagentami Grok.

## Zużycie planu

Konta Claude (Subscription) i OpenAI (ChatGPT) mogą pokazywać, jaką część limitów twojego planu już zużyto.

1. Kliknij **⋯** w wierszu konta, wybierz **Edit account** (edycja konta) i otwórz **Usage and balance** (zużycie i saldo).
2. Jeśli odczyty zewnętrzne są wyłączone, kliknij **Turn on** (włączenie).
3. Włącz **Show the usage meter on the card** (pokazywanie wskaźnika zużycia na karcie), a potem zapisz.

Każde okno limitu ma pasek z procentem zużycia i czasem resetu, na przykład `58% · resets in 2h`. Te same paski pojawiają się w selektorze połączenia czatu i w ustawieniach **Connection** (połączenie) czatu, gdy to konto jest aktywne. Nie pojawiają się przy **Shuffle** (losowanie).

- Paski liczą wszystko na twoim planie, nie tylko aplikację Marinara Engine. W przypadku Claude obejmuje to Claude Code i claude.ai. W przypadku ChatGPT obejmuje całe użycie Codex, na przykład w Codex CLI. Czaty na chatgpt.com mają własne limity i nie są wliczane.
- Usługi podają procent dla każdego okna i nie podają liczby tokenów.
- Odczyt prosi narzędzie CLI na komputerze z aplikacją Marinara Engine o te same dane, które pokazuje jego własne polecenie zużycia. Nie wysyła żadnej wiadomości do modelu i nie zużywa nic z twojego planu. Przycisk odświeżania odczytuje dane ponownie.
- Plan z tylko jednym oknem pokazuje jeden pasek.
- Claude Code oznacza swoje dane o zużyciu jako eksperymentalne. Jeśli nowa wersja je zmieni, paski pokażą błąd i przycisk ponowienia zamiast błędnej liczby.

## Ograniczenia tych usług

- Wymagają płatnego planu (albo kwalifikującego się planu ChatGPT) i narzędzia CLI zalogowanego na komputerze z aplikacją Marinara Engine.
- Żadna z nich nie oferuje embeddingów. Wyszukiwanie semantyczne w lorebookach i przywoływanie pamięci wymagają osobnego konta do embeddingów.
- **Send test message** (Wyślij wiadomość testową) wymaga wcześniejszego wybrania modelu. Wyjątkiem jest Grok CLI.

## Powiązane przewodniki

- [Łączenie z dostawcą AI](connecting-to-a-provider.md)
- [Obsługiwani dostawcy AI](providers-reference.md)
