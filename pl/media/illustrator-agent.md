# Agent Illustrator

Z tego przewodnika dowiesz się, do czego służy agent **Illustrator** – wbudowany pomocnik, który rysuje obrazki scen w trakcie czatu. Zobaczysz, co dokładnie robi, jak go włączyć, jakie style graficzne oferuje i jakich dwóch połączeń potrzebuje.

## Do czego służy agent Illustrator

Agent to niewielki pomocnik AI, który działa automatycznie w obrębie jednego czatu. Agent **Illustrator** uruchamia się po zakończeniu generowania, czyli dopiero wtedy, gdy AI skończy pisać odpowiedź. Czyta ostatnią odpowiedź i ocenia, czy dana chwila zasługuje na obrazek. Jeśli tak, agent **Illustrator** pisze prompt obrazu i wysyła go do dostawcy obrazów. Prompt to tekstowy opis, który mówi modelowi graficznemu, co ma narysować.

Agent **Illustrator** nie rysuje do każdej wiadomości. Domyślnie po wykonaniu obrazu czeka na 5 przyjętych wiadomości użytkownika i AI, zanim zrobi kolejny. Przeglądanie swipe'ów ani ponowne generowanie tej samej odpowiedzi nie przesuwa tego licznika. Jeśli agent uzna, że dana chwila nie nadaje się na ilustrację, pomija ją i nie tworzy obrazu. Każdy powstały obraz trafia do sekcji **Gallery** (Galeria) danego czatu.

Agenta **Illustrator** można używać w czatach **Roleplay** i **Game Mode**, a jego instalacja odblokowuje też selfie w trybie Conversation. Krótki opis w aplikacji brzmi: "Responsible for image and video generations." Kroki konfiguracji i ustawienia opisane w tym przewodniku dotyczą czatów Roleplay. Tryb Game Mode korzysta zamiast tego z jednego prostego przełącznika, opisanego niżej w sekcji o trybie Game Mode.

## Zanim zaczniesz

Agent **Illustrator** pisze prompt obrazu, ale do samego narysowania obrazka potrzebuje osobnego połączenia z modelem graficznym. Takie połączenie to zapisany skrót do dostawcy obrazów, na przykład OpenAI albo lokalnego serwera Stable Diffusion.

Najpierw skonfiguruj połączenie z modelem graficznym. Są dwa sposoby, żeby udostępnić je agentowi **Illustrator**:

1. Oznacz jedno połączenie graficzne jako domyślne. Otwórz panel **Connections** (Połączenia), rozwiń sekcję **Defaults** (ustawienia domyślne) i wskaż je w polu **Images** (Obrazy).
2. Albo przypisz agentowi **Illustrator** własne połączenie graficzne na jego pełnym ekranie konfiguracji (zobacz opis przycisku **Open Setup** niżej).

Jeśli nie da się znaleźć żadnego połączenia graficznego, obraz nie powstaje, a aplikacja prosi o wskazanie połączenia. Dodawanie dostawcy opisuje przewodnik [Dostawcy generowania obrazów i konfiguracja](image-providers.md).

## Włączanie agenta Illustrator

Agent **Illustrator** jest domyślnie wyłączony. Oto, jak dodać go do czatu **Roleplay**:

1. Otwórz czat, który ma być ilustrowany.
2. Otwórz panel **Chat Settings** (ustawienia czatu) ikoną koła zębatego.
3. Znajdź sekcję **Agents** (Agenci) i włącz przełącznik **Enable Agents** (włączenie agentów).
4. W grupie **Misc Agents** (pozostali agenci) znajdź pozycję **Illustrator** i dodaj ją przyciskiem z plusem.

Teraz na ekranie widać kartę ustawień agenta **Illustrator** z jego własnymi opcjami. Dodanie agenta zużywa dodatkowe tokeny i oznacza dodatkowe zapytania do AI w każdej turze, dlatego panel pokazuje na bieżąco szacowany koszt.

### Game Mode: przełącznik Game Illustrator

Tryb Game Mode nie korzysta z powyższych kroków i nie pokazuje opcji **Prompt Mode** ani **Prompt Model**. Zamiast tego otwórz panel **Chat Settings** danej gry i włącz pojedynczy przełącznik **Game Illustrator**. Jego opis brzmi: "Auto-generate scene illustrations, NPC portraits, and location backgrounds during gameplay."

## Tryby promptu

Lista rozwijana **Prompt Mode** (tryb promptu) ustala styl graficzny, który agent **Illustrator** zapisuje w treści każdego promptu. Na karcie agenta ta lista nosi etykietę **Prompt**. Krótki podpis pod nią brzmi: "Prompt mode controls how Illustrator writes image prompts for this chat."

Do wyboru są następujące style:

- **Illustration**: pojedynczy, dopracowany obraz sceny. To styl ogólnego przeznaczenia.
- **Comic Page**: strona komiksu z kadrami, dymkami dialogowymi, podpisami i efektami dźwiękowymi.
- **Colored Manga**: kolorowa scena w stylu mangi, ze stylizowanymi dymkami i efektami dźwiękowymi.
- **B&W Manga**: czarno-biała strona mangi z tuszowanymi kreskami i cieniowaniem rastrem.
- **Background**: ujęcie miejsca albo kadr ustalający, bez postaci.
- **Selfie**: selfie zrobione w roli albo swobodny portret.

Nowo dodany agent **Illustrator** startuje ze stylem **Background**. Styl da się zmienić w każdej chwili z tej listy. Ostateczny wygląd obrazu zależy dodatkowo od profilu stylu. Ustawia się go zgodnie z przewodnikiem [Profile stylu obrazów](style-profiles.md).

## Prompt Model i połączenie graficzne

Agent **Illustrator** korzysta z dwóch różnych połączeń i warto ich nie mylić.

Pole **Prompt Model** (model promptu) wskazuje model tekstowy, który pisze prompt obrazu. To nie jest model rysujący obrazek. Wybierz go z listy rozwijanej **Prompt Model** na karcie agenta **Illustrator**. Domyślna wartość to **Main chat model**, czyli ponowne użycie tego samego połączenia, z którego korzysta już czat. Wskaż inne połączenie tekstowe, jeśli prompty ma pisać inny model.

Połączenie graficzne to dostawca obrazów, który rysuje gotowy obrazek. Ustawia się je w sposób opisany w sekcji "Zanim zaczniesz" – albo w **Defaults → Images**, albo na własnym ekranie konfiguracji agenta.

## Attach Card Appearance i Send Avatar References

Dwa przełączniki na karcie agenta **Illustrator** pomagają zachować spójny wygląd postaci. Oba są domyślnie wyłączone.

Przełącznik **Attach Card Appearance** dopisuje do promptu obrazu zapisany opis wyglądu każdej widocznej postaci. Tekst pomocy brzmi: "Append matched character appearance lines to image prompts, using only visible/generated names." Włącz go, gdy obraz ma odpowiadać temu, jak postać została opisana.

Przełącznik **Send Avatar References** wysyła do dostawcy obrazów awatary postaci i persony albo ich sprite'y jako obrazy referencyjne. Tekst pomocy brzmi: "Send matching character and persona avatars or sprites as reference images when the provider supports them." Dzięki temu model graficzny łatwiej odwzorowuje twarz albo strój. Nie każdy dostawca przyjmuje obrazy referencyjne, więc efekt zależy od wybranego dostawcy.

## Więcej ustawień i ręczne uruchamianie

Na karcie agenta **Illustrator** jest przycisk **Open Setup** (pełna konfiguracja). Otwiera on pełny ekran konfiguracji agenta, gdzie ustawia się częstotliwość jego działania i przypisuje mu własne połączenie graficzne.

Ustaw **Run Interval** (odstęp uruchamiania) na **0**, aby generować wyłącznie ręcznie. Wyłącza to automatyczne uruchomienia agenta Illustrator, w tym automatyczne tła scen, ale agent pozostaje zainstalowany i dostępny w działaniach galerii. Domyślna wartość nadal wynosi **5**; ustaw wartość dodatnią, aby wznowić automatyczne uruchomienia. Wartość 0 można też wybrać podczas dodawania agenta Illustrator do czatu.

Obraz da się też zamówić od ręki, bez czekania. Otwórz sekcję **Gallery** danego czatu i użyj przycisku **Illustrate** (zilustruj). Agent **Illustrator** uruchamia się wtedy jednorazowo od razu, a przycisk pokazuje w trakcie pracy napis **Generating...**. Przydaje się to wtedy, gdy chcesz mieć obraz bieżącej chwili, a agent jeszcze nic nie narysował.

## Powiązane przewodniki

- [Dostawcy generowania obrazów i konfiguracja](image-providers.md)
- [Profile stylu obrazów](style-profiles.md)
- [Tła scen i galeria](scene-backgrounds.md)
- [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
