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

Przełącznik **Send Avatar References** jest domyślnie wyłączony. Po jego włączeniu Marinara wysyła awatar lub sprite'a postaci do usługi graficznej jako obrazek referencyjny. Dzięki temu selfie bardziej przypomina samą postać. Działa to tylko wtedy, gdy dostawca generowania obrazów obsługuje obrazki referencyjne.

### Attach Card Appearance

Przełącznik **Attach Card Appearance** jest domyślnie wyłączony. Po jego włączeniu Marinara dokłada do opisu selfie tekst wyglądu z karty postaci. Model dostaje wtedy więcej szczegółów o tym, jak postać wygląda.

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

Po skonfigurowaniu selfie postać sama decyduje, kiedy je wysłać w trakcie czatu. Nie trzeba wpisywać żadnej komendy. Postać wybiera moment, a Marinara generuje zdjęcie i publikuje je na czacie.

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
4. Jeśli w **Settings** (Ustawienia), **Generations**, **Image Generation** włączona jest opcja **Expose media prompts before sending**, przejrzyj lub popraw gotowy prompt selfie i kliknij przycisk **Generate**. Rezygnacja z podglądu oznacza, że żądanie generowania obrazu nie zostaje wysłane.
5. Poczekaj, aż przycisk przestanie pokazywać napis **Generating...**.

Kiedy selfie jest gotowe, pojawia się komunikat "Selfie generated.", a zdjęcie trafia na czat. Ręczna prośba również korzysta z wybranego połączenia **Selfie Connection**, więc także zużywa jedno żądanie generowania obrazu.

## Powiązane przewodniki

- [Tryb Conversation: pierwsze kroki](getting-started.md)
- [Dostawcy generowania obrazów i konfiguracja](../media/image-providers.md)
- [Profile stylu obrazów](../media/style-profiles.md)
