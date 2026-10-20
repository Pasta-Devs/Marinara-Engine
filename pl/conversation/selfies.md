# Selfie

Ten przewodnik wyjaśnia, jak działają selfie w trybie Conversation. Selfie to obrazek, który postać generuje sama ze sobą i wysyła na czat, zupełnie jak zdjęcie w komunikatorze. Poniżej znajdziesz opis włączania selfie, ich konfiguracji oraz ręcznego proszenia o zdjęcie.

## Czym są selfie

Selfie to funkcja trybu Conversation. Postać może wysłać wygenerowane zdjęcie samej siebie w trakcie zwykłego czatu. To co innego niż obrazki scen używane w trybie Roleplay i w Game Mode. Selfie powstały z myślą o komunikatorowym klimacie trybu Conversation.

Selfie korzystają z generowania obrazów. Każde selfie wysłane przez postać zużywa jedno żądanie generowania obrazu w wybranym połączeniu. Dlatego selfie pozostają wyłączone, dopóki nie zostaną skonfigurowane.

Selfie dostarcza opcjonalny pakiet **Illustrator**. Zainstaluj pakiet Illustrator przez **Agents → Download Agents** (pobranie agentów), zanim przejdziesz do konfiguracji.

## Włączanie selfie

Selfie znajdziesz w sekcji **Illustrator Settings**, wewnątrz sekcji **Agents** czatu w trybie Conversation. **Commands** (komendy) to ukryte działania, które postać może wykonać z własnej inicjatywy, na przykład wysłać selfie albo puścić piosenkę. Kontrolki komend pojawiają się w sekcji **Agents** po zainstalowaniu pakietu, który takie komendy dodaje.

Aby włączyć selfie:

1. Otwórz czat w trybie Conversation.
2. Otwórz **Chat Settings** (ustawienia czatu) – ikona suwaków.
3. Znajdź sekcję **Agents**.
4. Włącz w niej główny przełącznik **Commands**. Przy wyłączonym przełączniku postacie nie mogą wykonać żadnego ukrytego działania.
5. Znajdź sekcję **Illustrator Settings**.
6. Włącz przełącznik **Generated Selfies** (generowane selfie).

Po włączeniu przełącznika **Generated Selfies** pod nim pojawiają się ustawienia selfie. Zobaczysz pola połączenia, modelu opisu, stylu i referencji. Przyciski **Resolution** pokazują się dopiero po wybraniu połączenia w polu **Selfie Connection**.

## Ustawienia selfie

Kiedy selfie są już włączone, ustal ich wygląd i wskaż usługę, która je tworzy. Wszystkie te ustawienia znajdują się w sekcji **Illustrator Settings** w **Chat Settings → Agents**. Działają wyłącznie w bieżącym czacie.

### Selfie Connection

Pole **Selfie Connection** wskazuje usługę generowania obrazów, która rysuje zdjęcie. Domyślna wartość to **None (selfies disabled)**, czyli żadna usługa nie jest jeszcze wybrana. Wskaż tutaj jedno ze skonfigurowanych połączeń do generowania obrazów.

Dopóki pole **Selfie Connection** jest puste, postacie nie mogą wysyłać selfie. Widoczna uwaga "Choose a Selfie Connection to let characters generate selfie images" oznacza właśnie brak wybranego połączenia.

O tym, jak dodać połączenie do generowania obrazów, przeczytasz w przewodniku [Dostawcy generowania obrazów i konfiguracja](../media/image-providers.md).

### Prompt Model

Pole **Prompt Model** wskazuje model tekstowy, który pisze opis selfie. Połączenie do generowania obrazów rysuje potem ten opis. Domyślna wartość to **Main chat model**, czyli ten sam model, którego używa już czat. Można wskazać inne połączenie tekstowe, jeśli opis selfie ma pisać inny model.

### Image Style

Pole **Image Style** wskazuje profil stylu użyty do selfie. Profil stylu to zapisany zestaw słów opisujących styl graficzny, na przykład "anime" albo "realistic photo". Domyślna wartość to **Use default style from Style Profiles in Advanced settings**, czyli globalny styl domyślny.

Więcej o stylach znajdziesz w przewodniku [Profile stylu obrazów](../media/style-profiles.md).

### Send Avatar References

**Send Avatar References** to lista rozwijana, domyślnie ustawiona na **Off** (wyłączone). Znajduje się pod sekcją **Video messages** (wiadomości wideo), a każda opcja mówi, czego dotyczy: **Images only** (tylko obrazy), **Videos only** (tylko filmy) albo **Images and videos** (obrazy i filmy).

- Przy obrazach Marinara wysyła awatar lub sprite'a postaci do usługi graficznej jako obrazek referencyjny. Dzięki temu selfie bardziej przypomina samą postać. Działa to tylko wtedy, gdy dostawca generowania obrazów obsługuje obrazki referencyjne.
- Przy filmach wiadomość wideo, której pole **First frame** (pierwsza klatka) ma wartość **Prompt only**, zaczyna się od awatara lub sprite'a postaci, a nie bez żadnego obrazu. Usługi wideo przyjmują tylko jeden obraz początkowy, więc to ustawienie nie zmienia pozostałych opcji pierwszej klatki, które i tak zaczynają się od obrazu postaci.

### Attach Card Appearance

**Attach Card Appearance** to lista rozwijana, domyślnie ustawiona na **Off**, z tymi samymi opcjami **Images only**, **Videos only** i **Images and videos**. Dokłada tekst wyglądu z karty każdej postaci wymienionej w prompcie do promptu selfie, do promptu wideo albo do obu. Model dostaje wtedy więcej szczegółów o tym, jak postać wygląda.

Jeśli karta lub persona ma też włączony **Image Appearance Override** (osobny opis wyglądu do obrazów), Marinara wysyła ten opis zamiast tekstu z **Appearance**. Włącz tę opcję pod polem **Appearance** w edytorze postaci lub persony, gdy pełny opis jest przeznaczony dla narratora, a nie dla modelu graficznego. AI, które pisze opis selfie, nadal czyta też pole **Appearance** karty. Zachowuje słowa z nadpisania dokładnie w zapisanej formie, a tekstu z **Appearance** używa tylko do uzupełnienia innych szczegółów.

### Resolution

Ustawienie **Resolution** decyduje o rozmiarze obrazka selfie. Przyciski **Resolution** pokazują się dopiero po wybraniu połączenia w polu **Selfie Connection**. Wybierz jeden z gotowych przycisków. Domyślna wartość to **896x1152**, czyli wysoki format portretowy, który pasuje do większości selfie.

Dostępne rozmiary:

| Rozdzielczość | Kształt              |
| ---------- | ------------------ |
| 512x512    | Kwadrat             |
| 512x768    | Portret           |
| 768x768    | Kwadrat             |
| 768x1024   | Portret           |
| 896x1152   | Portret (domyślnie) |
| 1024x1024  | Kwadrat             |

## Jak postać wysyła selfie

Po skonfigurowaniu selfie postać sama decyduje, kiedy je wysłać w trakcie czatu. Nie trzeba wpisywać żadnej komendy. Postać wybiera moment, a Marinara generuje zdjęcie i publikuje je na czacie. Kolejne odpowiedzi widzą krótką informację o tym, co pokazywało selfie, więc postać pamięta, że je wysłała.

Odpowiedź modelu zawiera `[selfie]`, opcjonalnie z kontekstem:

```text
Here is a picture from my walk!
[selfie: context="standing beside the river at sunset"]
```

Działają także `[selfie: "standing beside the river"]` i `[selfie: standing beside the river]`. Wielkość liter nie ma znaczenia, więc `[SELFIE:xxxxx.]` to poprawna składnia. Jest to komenda trybu Conversation, a nie wyzwalacz obrazu w Roleplay lub Game Mode. Dosłowny znacznik pozostawiony w wiadomości może oznaczać inny tryb czatu albo wyłączoną opcję **Commands**. Sprawdź, czy Illustrator jest zainstalowany, **Generated Selfies** jest włączone i wybrano **Selfie Connection** (połączenie do selfie). Jeśli generowanie rusza, ale kończy się błędem, sprawdź zgłoszony błąd połączenia lub dostawcy obrazów; zmiana wielkości liter w znaczniku go nie naprawi.

## Ręczna prośba o selfie

Selfie można też zamówić samodzielnie, zamiast czekać na inicjatywę postaci.

1. Otwórz **Chat Settings** i rozwiń sekcję **Gallery** (galeria).
2. Kliknij przycisk **Selfie** – ikona aparatu.
3. Jeśli na czacie jest więcej niż jedna postać, wskaż autora selfie na liście postaci obok przycisku.
4. Jeśli w **Settings** (Ustawienia), **Generations**, **Overall Generations** włączona jest opcja **Expose media prompts before sending**, przejrzyj lub popraw gotowy prompt selfie i kliknij przycisk **Generate**. Rezygnacja z podglądu oznacza, że żądanie generowania obrazu nie zostaje wysłane.
5. Poczekaj, aż przycisk przestanie pokazywać napis **Generating...**.

Kiedy selfie jest gotowe, pojawia się komunikat "Selfie generated.", a zdjęcie trafia na czat. Ręczna prośba również korzysta z wybranego połączenia **Selfie Connection**, więc także zużywa jedno żądanie generowania obrazu.

## Ponowne tworzenie selfie

Zdjęcie się nie podoba? Kliknij selfie na czacie, żeby je otworzyć, a potem kliknij **Regenerate image** (ponowne wygenerowanie obrazu, okrągła strzałka obok przycisku przypinania). Możesz edytować prompt, prompt negatywny i prompty postaci oraz wybrać **Image connection** (połączenie do generowania obrazów). Kliknij **Generate image** (wygenerowanie obrazu). Nowe zdjęcie zastępuje stare w wiadomości, a stare zostaje w sekcji **Gallery**. Każda próba zużywa jedno żądanie generowania obrazu.

Zdjęcia utworzone, zanim ta opcja się pojawiła, też da się utworzyć ponownie. Korzystają z połączenia selfie ustawionego w czacie, a ich prompty negatywne i prompty postaci nie zostały zapisane.

<a id="video-messages"></a>

## Wiadomości wideo

Postać może też wysłać ci krótki klip wideo. Wpisz `/video` (albo `/video Aster`, żeby wybrać postać) lub kliknij przycisk **Video** (wideo, ikona kliszy filmowej) w sekcji **Gallery** czatu. Ten przycisk korzysta z postaci wybranej w sekcji **Gallery**. Przycisk **Video** działa zawsze, gdy Illustrator jest zainstalowany, nawet przy wyłączonych selfie. Klip przychodzi jako nowa wiadomość od tej postaci i odtwarza się na czacie. Klip zamówiony w ten sposób pokazuje najnowszą chwilę rozmowy: AI, które pisze jego opis, czyta tyle ostatnich wiadomości, ile Illustrator czyta przy tworzeniu obrazu (według rozmiaru kontekstu w jego sekcji **Agent Budget**). Selfie zrobione jako pierwsza klatka korzysta z tych samych wiadomości, więc klip również zaczyna się od tej chwili. Kolejne odpowiedzi widzą krótką informację o tym, co pokazuje klip. Możesz też zanimować obraz z sekcji **Gallery**: klip jest dalszym ciągiem tego obrazu, wysyła go postać wybrana w sekcji **Gallery**, a sam klip dołącza do najnowszej odpowiedzi. Jeśli klipu nie da się dodać do czatu, i tak zostaje zapisany w zakładce **Videos** (filmy) w sekcji **Gallery**. Galeria samej postaci wymienia wiadomość wideo tylko wtedy, gdy klip pokazuje tę postać; zobacz [Galerie postaci i person](../characters/galleries.md).

Ustawisz to w **Chat Settings**, **Agents**, **Illustrator Settings**, w sekcji **Video messages**:

- Pole **Video Connection** (połączenie wideo) wskazuje połączenie typu Video Generation (generowanie wideo). Zostaw na nim wartość **Default video connection** (domyślne połączenie wideo), żeby użyć domyślnego połączenia wideo. Pole **Video Prompting Instructions** (instrukcje do promptów wideo) w ustawieniach połączenia kieruje AI, które pisze prompt wideo.
- Pole **First frame** wskazuje obraz, od którego zaczyna się klip:
  - **New selfie, or the avatar if no selfie connection** (nowe selfie albo awatar, gdy brak połączenia do selfie) – wartość domyślna – robi nowe selfie, gdy selfie są włączone i ustawiono **Selfie Connection**, a w przeciwnym razie używa awatara.
  - **New selfie, then animate it** (nowe selfie, a potem jego animacja) zawsze najpierw robi nowe selfie. Wymaga włączonych selfie i ustawionego pola **Selfie Connection**, a samo selfie zostaje też zapisane w galerii. Przy włączonej opcji **Expose media prompts before sending** przeglądasz prompt selfie razem z promptem klipu.
  - **Avatar or sprite** (awatar lub sprite) zaczyna od awatara postaci, a gdy postać nie ma awatara – od sprite'a całej sylwetki.
  - **Prompt only (no picture)** (tylko prompt, bez obrazu) nie wysyła żadnego obrazu, więc model wideo pracuje wyłącznie na podstawie promptu. Niektóre workflow ComfyUI wymagają obrazu i bez niego kończą się błędem. Gdy **Send Avatar References** obejmuje filmy, ta opcja nazywa się **Prompt only (avatar from Send Avatar References)** (tylko prompt, awatar z ustawienia Send Avatar References), a klip zaczyna się wtedy od awatara.

Obrazy w innych formatach, na przykład WebP, są konwertowane na potrzeby usługi wideo. Wiadomość wideo zużywa jedno żądanie generowania wideo, a gdy zaczyna się od nowego selfie – także jedno żądanie generowania obrazu. Prompt pisze model wybrany w polu **Prompt Model**, a jego instrukcje znajdują się w **Settings**, **Generations**, **Video Generation Prompt Overrides** (nadpisania promptów wideo), **Conversation Video Message** (wiadomość wideo w trybie Conversation).

## Powiązane przewodniki

- [Tryb Conversation: pierwsze kroki](getting-started.md)
- [Dostawcy generowania obrazów i konfiguracja](../media/image-providers.md)
- [Profile stylu obrazów](../media/style-profiles.md)
