# Selfie

Selfie to obraz, który postać generuje z samej siebie i wysyła w czacie Conversation, jak zdjęcie udostępnione w komunikatorze. Ten przewodnik opisuje włączanie selfie, wybór ich wyglądu, ręczne proszenie o selfie i wiadomości wideo.

Selfie pochodzą z opcjonalnego pakietu **Illustrator** i korzystają z generowania obrazów. Każde selfie to jedno żądanie obrazu do wybranej usługi, więc pozostają wyłączone, dopóki ich nie skonfigurujesz. Różnią się od obrazów scen w trybach Roleplay i Game Mode.

## Włącz selfie

Zanim zaczniesz: zainstaluj pakiet **Illustrator** z **Agents → Agent Organizer** (organizator agentów) i dodaj konto obrazów, czyli konto usługi, która tworzy obrazy (zobacz [Dostawcy generowania obrazów i konfiguracja](../media/image-providers.md)).

1. Otwórz czat Conversation, a potem otwórz **Chat Settings** (ustawienia czatu).
2. Znajdź sekcję **Agents** i otwórz **Illustrator Settings**.
3. Włącz **Generated Selfies** (generowane selfie). Poniżej pojawią się ustawienia selfie.
4. W polu **Selfie model** (model selfie) wybierz swoje konto obrazów.

Włączenie **Generated Selfies** włącza też główny przełącznik **Commands** dla tego czatu.

Postacie wysyłają selfie dopiero po ustawieniu **Selfie model**. Do tego czasu czat pokazuje komunikat "Choose a Selfie Provider to let characters generate selfie images."

Jeśli to nie zadziałało: sekcja **Illustrator Settings** pokazuje się tylko wtedy, gdy zainstalowano Illustrator. Selfie wymagają też komendy **Selfies** (zobacz [Wybierz, których komend może używać postać](getting-started.md#choose-which-commands-a-character-can-use)).

## Ustawienia selfie

Wszystkie leżą w **Illustrator Settings** i dotyczą tylko bieżącego czatu.

- **Selfie model**: konto obrazów, które rysuje obraz. Domyślnie **None (selfies disabled)**.
- **Prompt Model** (model promptu): model tekstowy, który pisze opis obrazu. Domyślnie **Agent default**.
- **Image Style** (styl obrazu): zapisany zestaw słów opisujących styl graficzny, takich jak "anime". Domyślnie jest to styl domyślny z Style Profiles w ustawieniach zaawansowanych. Zobacz [Profile stylu obrazów](../media/style-profiles.md).
- **Images Per Generation** (obrazy na generowanie): ile wariantów zrobić dla każdej ilustracji lub selfie.
- **Resolution** (rozdzielczość): rozmiar obrazu. Pokazuje się dopiero po ustawieniu **Selfie model**. Domyślnie 896x1152.
- **Send Avatar References**: wysyła awatar lub sprite'a postaci jako obraz referencyjny. Domyślnie wyłączone. Działa tylko wtedy, gdy usługa obrazów przyjmuje obrazy referencyjne.
- **Attach Card Appearance**: dodaje do promptu tekst **Appearance** z karty każdej wymienionej postaci. Domyślnie wyłączone.

Opcje **Resolution**: 512x512, 512x768, 768x768, 768x1024, 896x1152 i 1024x1024. Rozdzielczość 896x1152 to wysoki portret, który pasuje do większości selfie.

**Send Avatar References** i **Attach Card Appearance** mają po cztery opcje: **Off**, **Images only**, **Videos only** i **Images and videos**.

Jeśli karta lub persona ma włączone **Image Appearance Override** (w sekcji **Appearance** w edytorze), aplikacja wysyła ten tekst zamiast **Appearance**. Użyj tego, gdy **Appearance** jest napisane na potrzeby fabuły, a nie obrazów.

## Poproś o selfie ręcznie

1. Otwórz **Chat Settings** i rozwiń sekcję **Gallery**.
2. Kliknij **Selfie**. Gdy postaci jest więcej niż jedna, wybierz z listy obok przycisku, kto ma zrobić selfie.
3. Jeśli **Expose media prompts before sending** jest włączone (**Settings → Generations → Overall Generations**), przejrzyj lub edytuj prompt i kliknij **Generate**. Anulowanie nie wysyła żadnego żądania.
4. Poczekaj, aż przycisk pokaże **Generating...**.
5. Zobaczysz komunikat "Selfie generated." i obraz pojawi się w czacie. Ręczne żądanie używa **Selfie model** i kosztuje jedno żądanie obrazu.

## Jak postacie wysyłają selfie

Postać sama decyduje, kiedy wysłać selfie. Nie musisz nic wpisywać. Aplikacja generuje obraz i publikuje go, a późniejsze odpowiedzi widzą krótką notatkę o tym, co przedstawiał.

Jeśli to nie zadziałało: gdy w wiadomości widzisz dosłowny tekst `[selfie...]`, sprawdź, czy czat jest w trybie Conversation, czy **Commands** i **Selfies** są włączone, a **Generated Selfies** jest włączone i ustawiono **Selfie model**. Jeśli generowanie się zaczyna, ale kończy się błędem, przeczytaj błąd o koncie obrazów.

## Zrób selfie ponownie

1. Kliknij selfie w czacie, aby je otworzyć.
2. Kliknij **Regenerate image** (okrągła strzałka obok przycisku pinezki).
3. Jeśli chcesz, edytuj prompty, w tym **Character prompts**. Wybierz **Image model** albo zostaw **Chat's image provider**.
4. Kliknij **Generate image**.

Nowy obraz zastępuje stary w wiadomości. Stary zostaje w galerii (Gallery). Każda próba to jedno żądanie obrazu. Obrazy zrobione, zanim ta opcja istniała, nie mają zapisanego promptu selfie czatu ani promptów negatywnych i promptów postaci.

<a id="video-messages"></a>

## Wiadomości wideo

Postać może wysłać krótką wiadomość wideo. Najpierw zainstaluj Illustrator. Selfie mogą pozostać wyłączone.

Aby samodzielnie poprosić o wideo, wpisz `/video` albo `/video Aster`, aby wybrać postać. Możesz też kliknąć **Video** w sekcji **Gallery** czatu, która używa postaci wybranej tam. Klip przychodzi jako nowa wiadomość i odtwarza się w czacie. Pokazuje najnowszy moment rozmowy: model, który pisze prompt, czyta tyle ostatnich wiadomości, ile czyta Illustrator przy obrazie (jego **Agent Budget**). Możesz też animować obraz z galerii. Klip kontynuuje ten obraz i dołącza do najnowszej odpowiedzi.

Jeśli nie da się dodać klipu do czatu, jest on nadal zapisany na karcie **Videos** w galerii. Galeria własna postaci pokazuje wideo tylko wtedy, gdy klip przedstawia tę postać (zobacz [Galerie postaci i person](../characters/galleries.md)).

### Ustawienia wideo

Otwórz **Chat Settings → Agents → Illustrator Settings**, **Video messages**.

- **Generated Videos**: pozwala postaciom wysyłać wiadomości wideo samodzielnie. W nowych czatach jest domyślnie wyłączone, bo każdy klip to żądanie wideo. Wymaga też **Videos** na liście **Commands**.
- **Video Run Interval**: pokazuje się po włączeniu **Generated Videos**. Określa, ile wiadomości musi minąć między klipami. **0** wyłącza tę przerwę.
- **Video model**: konto wideo.
- **Default video provider** używa twojego ustawienia domyślnego.
- **First frame**: obraz, od którego zaczyna się klip (patrz niżej).
- `/video` i przycisk **Video** w galerii działają tak czy inaczej i ignorują ten odstęp. Przesunięcie swipe odpowiedzi, która wysłała klip, pozwala nowemu swipe'owi wysłać własny. W czacie grupowym każda postać może wysłać jeden klip na odpowiedź, do **Videos per reply** (domyślnie 3) w **Settings → Generations → Video Generation**.

Opcje **First frame**:

- **New selfie, or the avatar if no selfie provider** (domyślnie): nowe selfie, gdy selfie są włączone i ustawiono **Selfie model**, w przeciwnym razie awatar.
- **New selfie, then animate it**: zawsze nowe selfie, zapisane też w galerii. Wymaga włączonych selfie i ustawionego **Selfie model**.
- **Avatar or sprite**: awatar albo sprite całej postaci, jeśli nie ma awatara.
- **Prompt only (no picture)**: bez obrazu. Niektóre przepływy ComfyUI nie działają bez obrazu. Jeśli włączono **Send Avatar References**, a obejmuje on wideo, ta opcja czyta **Prompt only (avatar from Send Avatar References)** i zaczyna od awatara.

Gdy **Expose media prompts before sending** jest włączone, przeglądasz prompt selfie razem z promptem klipu.

Obrazy w innych formatach, takich jak WebP, są konwertowane dla usługi wideo. Jedna wiadomość wideo to jedno żądanie wideo, plus żądanie obrazu, gdy zaczyna się od nowego selfie. Twój **Prompt Model** pisze prompt wideo, a **Settings → Generations → Video Generation Prompt Overrides → Conversation Video Message** zawiera jego instrukcje.

## Odniesienie: tag selfie

Postacie proszą o selfie za pomocą tagu w swojej odpowiedzi. Nigdy go nie wpisujesz. Wygląda jak `[selfie]`, opcjonalnie z kontekstem:

```text
[selfie: context="standing beside the river at sunset"]
```

Działają też `[selfie: "standing beside the river"]` i `[selfie: standing beside the river]`, w dowolnej wielkości liter. Aplikacja usuwa tag i publikuje obraz.

## Powiązane przewodniki

- [Tryb Conversation: pierwsze kroki](getting-started.md)
- [Dostawcy generowania obrazów i konfiguracja](../media/image-providers.md)
- [Profile stylu obrazów](../media/style-profiles.md)
