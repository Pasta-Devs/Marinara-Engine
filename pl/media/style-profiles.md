# Profile stylu obrazów

Z tego przewodnika dowiesz się, jak działają profile stylu obrazów w aplikacji Marinara Engine. Profil stylu to wielokrotnego użytku "styl firmowy", który kształtuje każdy prompt obrazu, zanim Marinara wyśle go do dostawcy obrazów. Dzięki niemu awatary, portrety, selfie, tła, ilustracje i sprite'y wyglądają spójnie.

## Czym jest profil stylu

Marinara Engine generuje wiele rodzajów obrazów: awatary postaci i persony, portrety, selfie w trybie Conversation, tła scen, ilustracje w scenie oraz sprite'y postaci. Każdy z tych obrazów zaczyna się od promptu, czyli tekstu, który Marinara wysyła do AI.

Profil stylu to zapisany zestaw reguł, które Marinara dokłada do tego tekstu. Może dodać słowa pozytywne (czego oczekujesz), słowa negatywne (czego chcesz uniknąć) oraz preferowany styl zapisu promptu. W ten sposób wszystkie obrazy trzymają jeden wygląd i nie trzeba za każdym razem wpisywać tych samych słów opisujących styl.

Jeden profil wybierasz jako domyślny dla całej aplikacji. Da się go nadpisać dla pojedynczego czatu albo pojedynczego połączenia obrazowego. Wszystko to opisujemy poniżej.

Edytor znajdziesz w kilku krokach.

1. Otwórz **Settings** (Ustawienia).
2. Przejdź do zakładki **Generations**.
3. Znajdź sekcję **Image Generation**.
4. Przewiń do sekcji **Style Profiles**.

## Profile wbudowane

Marinara Engine ma 10 wbudowanych profili stylu. Domyślny jest profil **Auto**. Każdy z nich można edytować, a profil wbudowany da się w każdej chwili przywrócić do pierwotnych wartości.

Kilka pojęć, które pojawiają się niżej:

- SDXL to skrót od Stable Diffusion XL. To popularny otwarty model obrazów, który można uruchomić na własnym komputerze albo w chmurze.
- Checkpoint to jeden plik wytrenowanego modelu obrazów. Ludzie pobierają różne checkpointy do różnych stylów graficznych. W tych profilach wymieniamy Illustrious, Pony i NovelAI.
- Danbooru to duży serwis z obrazami anime. Jego krótkie tagi rozdzielone przecinkami (na przykład "1girl, long hair, smile") stały się popularnym sposobem promptowania modeli obrazów anime.

Oto profile wbudowane:

- **Off**: nie dokłada żadnego stylu. Prompt jedzie do dostawcy niemal dokładnie tak, jak został wpisany.
- **Auto**: wnioskuje spójny wygląd z postaci, gry, sceny i wybranego modelu obrazów. To profil domyślny.
- **Anime**: ogólne tagi w stylu anime do czystej grafiki postaci.
- **Danbooru / Illustrious**: tagi w stylu Danbooru pod checkpointy anime SDXL, takie jak Illustrious, Pony i NovelAI.
- **Realistic SDXL**: realizm opisany zwykłym językiem, pod modele SDXL.
- **Photorealistic**: prompty jak do zdjęć, z wiarygodną skórą, światłem i materiałami.
- **Cinematic**: dramatyczne światło i mocna kompozycja, jak w grafice promocyjnej.
- **Digital Painting**: pociągnięcia pędzla rodem z concept artu i zaprojektowane światło.
- **Painterly Fantasy**: miękka, malarska ilustracja fantasy.
- **Z-Image Turbo Narrative**: zwięzła proza pod modele Z-Image Turbo, które dobrze czytają zwykłe zdania.

## Zmiana stylu globalnego

Domyślny profil globalny obowiązuje dla każdego generowanego obrazu, chyba że nadpisze go czat albo połączenie. Zmienisz go w kilku krokach.

1. Otwórz **Settings**, potem zakładkę **Generations**, dalej sekcję **Image Generation** i sekcję **Style Profiles**.
2. Rozwiń listę rozwijaną **Default style**.
3. Wskaż profil, który ma obowiązywać w całej aplikacji.

Wybór zapisuje się od razu. Nowe obrazy korzystają już ze wskazanego profilu.

## Kopiowanie i dostosowywanie profilu

Profil wbudowany da się edytować na miejscu, ale przycisk **Clone** pozwala zachować oryginał i zbudować własną wersję. Oto, co trzeba zrobić, żeby stworzyć i dostosować profil.

1. Rozwiń listę rozwijaną **Editing** i wskaż profil najbliższy temu, o co ci chodzi.
2. Kliknij przycisk **Clone**. Marinara tworzy kopię, otwiera ją do edycji i od razu ustawia ją jako domyślny styl całej aplikacji.
3. W polu **Name** wpisz nazwę, którą łatwo rozpoznasz.
4. Wybierz opcję w polu **Prompt grammar** (opisujemy je w następnej sekcji).
5. Wypełnij pole **Style text** zwykłym opisem wyglądu, o który ci chodzi. Gdy AI pisze prompt obrazu, jak w przypadku agenta Illustrator, selfie i Noodle, kieruje się treścią pola Style text, zamiast ją kopiować. Do innych obrazów, na przykład awatarów, treść pola Style text może zostać dodana dosłownie.
6. Dodaj **Positive tags** (tagi do uwzględnienia) i **Negative tags** (tagi do uniknięcia).
7. Rozwiń sekcję **Per-image tags**, żeby dodać osobne tagi dla każdego rodzaju obrazu (awatar, portret, selfie, tło, ilustracja, sprite).
8. W kroku 2 kopia stała się profilem domyślnym całej aplikacji. Żeby oddać tę rolę innemu profilowi, rozwiń listę **Default style** i wskaż właściwy profil.

W zarządzaniu profilami pomagają dwa przyciski:

- Przycisk **Reset** działa wyłącznie na profilach wbudowanych. Przywraca danemu profilowi wbudowanemu pierwotne wartości.
- Przycisk **Delete** działa wyłącznie na profilach utworzonych przez ciebie i tylko wtedy, gdy istnieje więcej niż jeden profil.

## Tryby zapisu promptu

Lista rozwijana **Prompt grammar** mówi aplikacji Marinara Engine, w jakiej formie model obrazów najlepiej czyta prompt. Wybierz tryb pasujący do twojego modelu obrazów. Tryby są cztery.

- **Hybrid**: mieszanka zdań i tagów. Bezpieczny wybór ogólny.
- **Danbooru tags**: krótkie tagi w stylu Danbooru, rozdzielone przecinkami. Najlepsze do checkpointów anime SDXL, takich jak Illustrious, Pony i NovelAI.
- **Tags**: krótkie słowa kluczowe rozdzielone przecinkami, bez konwencji Danbooru.
- **Natural language**: zwykłe zdania. Najlepsze do modeli, które czytają prozę, na przykład DALL-E i modeli Z-Image Turbo.

## Sekcja Test bench

Sekcja **Test bench** (stół testowy) pokazuje dokładnie to, co wysłałaby Marinara, bez generowania prawdziwego obrazu. Otwórz ją w edytorze Style Profiles. Oto, jak z niej korzystać.

1. Wybierz opcję w polu **Image kind** (na przykład portret albo tło).
2. Wpisz zgrubny prompt w polu **Sample input**.
3. Przeczytaj zawartość pól **Final positive prompt** i **Final negative prompt**.

Sekcja Test bench pokazuje też krótką notatkę o czyszczeniu. Kiedy nic się nie zmienia, wyświetla "No cleanup needed for this sample." Kiedy prompt zostaje poprawiony, podaje, ile powtórzonych albo źle umieszczonych fragmentów zostało uporządkowanych.

## Jak Marinara czyści prompt

Zanim jakiekolwiek żądanie obrazu opuści aplikację, Marinara składa prompt razem z aktywnym profilem. Kompilator robi kilka rzeczy:

- Usuwa tagi bliskie duplikatom, na przykład powtórzony tag jakości.
- Przenosi proste zwroty przeczące (jak "avoid text" czy "no watermark") do promptu negatywnego.
- Zachowuje twoje własne sformułowania w obrazach typu tło, ilustracja i selfie. W portretach, awatarach i sprite'ach skraca je do krótkich tagów wizualnych, które rozpoznaje.
- Dokłada tagi profilu przypisane do danego rodzaju obrazu.

## Przykład przed i po

Załóżmy, że wybierasz profil **Danbooru / Illustrious**, ustawiasz **Image kind** na portret i wpisujesz w polu **Sample input**:

```
masterpiece, masterpiece, red-haired knight, no watermark
```

Sekcja Test bench pokazuje wtedy takie pole **Final positive prompt**:

```
detailed eyes, solo, upper body, portrait, looking at viewer, anime screencap, masterpiece, best quality, absurdres
```

Stały się trzy rzeczy:

- Fragment "no watermark" wyszedł z promptu pozytywnego i trafił do pola **Final negative prompt**. Notatka o czyszczeniu wlicza tę zmianę.
- Profil dołożył własne tagi stylu, tagi portretowe przypisane do rodzaju obrazu oraz tagi jakości. Słowo "masterpiece" w wyniku pochodzi z tagów samego profilu, a nie z wpisanego tekstu.
- Wpisane słowa zostały skrócone. W portretach kompilator zostawia tylko fragmenty, które rozpoznaje jako czytelne wskazówki wizualne. "red-haired knight" do nich nie należy, więc wypadł.

Jeśli w portretach, awatarach albo sprite'ach znikają słowa opisujące temat obrazu, spróbuj rodzaju obrazu **illustration**. Ten rodzaj zachowuje twoje własne sformułowania.

## Kolejność ważności: czat, połączenie, potem ustawienie globalne

Marinara może wziąć profil stylu z trzech miejsc. Wygrywa wybór najbardziej szczegółowy. Kolejność jest taka:

1. Profil wskazany wprost dla bieżącego czatu albo bieżącej gry.
2. Profil ustawiony w polu **Style Profile** na połączeniu obrazowym (w sekcji **Local Image Defaults** w edytorze połączenia).
3. Globalny profil z listy **Default style** ustawionej w sekcji **Settings**.

Sekcja **Local Image Defaults** pojawia się wyłącznie przy lokalnych połączeniach Stable Diffusion (AUTOMATIC1111 / SD Web UI, ComfyUI i NovelAI). U każdego innego dostawcy wybór spada od razu do globalnego ustawienia **Default style**. Żeby ustawić profil dla konkretnego połączenia, otwórz to połączenie, rozwiń sekcję **Local Image Defaults** i wskaż profil na liście rozwijanej **Style Profile**. Zostaw ją na **Use global default**, żeby trzymać się wyboru globalnego. Kiedy Marinara potrafi zgadnąć dobry profil na podstawie nazwy modelu z połączenia, pokazuje przycisk **Use ...**, który stosuje ten profil jednym kliknięciem.

## Powiązane przewodniki

- [Dostawcy generowania obrazów i konfiguracja](image-providers.md)
- [Agent Illustrator](illustrator-agent.md)
- [Selfie](../conversation/selfies.md)
