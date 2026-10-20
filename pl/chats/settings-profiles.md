# Profile ustawień

Profil ustawień to nazwany zestaw ustawień czatu, których da się użyć wielokrotnie. Może przechowywać połączenie czatu, preset promptu (zapisany szablon promptu), agentów, narzędzia, tłumaczenie, Memory Recall, parametry zaawansowane i inne opcje ustawiane osobno dla każdego czatu. Zamiast konfigurować to wszystko od nowa, zastosuj profil w innym czacie.

Profilami zarządza się na górze panelu **Chat Settings** (ustawienia czatu). Działają w trybach Conversation i Roleplay. W trybie Game Mode kontrolki profilu się nie pojawiają.

## Profile ustawień a presety promptu

W aplikacji Marinara Engine słowo **preset** odnosi się wyłącznie do szablonów promptu:

- **Preset promptu** decyduje o strukturze promptu systemowego (tekstu, który Marinara wysyła do AI) oraz o parametrach generowania. Edytuje się go w panelu Presets. Zobacz [Edytor presetów i menedżer promptów](../prompts/presets.md).
- **Profil ustawień** to szersza konfiguracja wielokrotnego użytku. Może obejmować wybrany preset promptu razem z połączeniem, agentami i pozostałymi ustawieniami czatu.

Preset promptu bywa więc jednym z elementów profilu ustawień.

## Co zawiera profil

Profil zapisuje sposób, w jaki czat rozmawia z AI:

- Połączenie
- Preset promptu (w trybie Conversation nazywany źródłem promptu)
- Agenci i narzędzia
- Tłumaczenie
- Memory Recall
- Advanced Parameters
- Układ okien i przycisków: pozycje i rozmiary okien, przypięcia i blokady, narzędzia wewnątrz Chat Settings lub w osobnych oknach, otwarte okna kontrolek oraz pozycje przycisków na komputerze i telefonie. Profile bez zapisanego układu, takie jak **Default**, zachowują obecny układ czatu.
- Widoczność wskazówek dotyczących układu w Chat Settings. Zastosowanie **Default** lub starszego profilu bez tej opcji pokazuje wskazówki ponownie.
- Pozostałe wielokrotnie używane opcje czatu

Profil nie zastępuje treści należących do czatu, czyli postaci, persony (postaci, w którą się wcielasz), lorebooków (zbiorów faktów o twoim świecie), sprite'ów (obrazków postaci na obszarze sceny), podsumowania, tagów ani promptu sceny. Nie zawiera też historii czatu ani bieżącego stanu czatu, takiego jak jego zmienne makr, postacie wyłączone w nim przez ciebie czy jego pokój gry wieloosobowej.

## Zastosowanie profilu

Lista rozwijana z profilami znajduje się na górze panelu **Chat Settings**. Jej podpowiedź brzmi **Apply a settings profile to this chat**.

1. Otwórz czat, który chcesz zmienić.
2. Otwórz panel **Chat Settings**.
3. Rozwiń listę **Profile**.
4. Wybierz profil po nazwie.

Czat zmienia się od razu. Jeśli profil włącza albo wyłącza **Hide summarised messages** (ukrywanie podsumowanych wiadomości), podsumowane wiadomości czatu w tej samej chwili zostają ukryte przed AI albo znów stają się dla niego widoczne. Kiedy bieżące wartości czatu nie odpowiadają żadnemu zapisanemu profilowi, lista pokazuje **Custom settings profile**. Jeśli wcześniej zastosowany profil już nie istnieje, widnieje tam **Missing profile - choose a profile**.

## Zapisywanie profilu

Rząd ikon pod listą rozwijaną zawiera te działania:

| Przycisk | Podpowiedź | Efekt |
|---|---|---|
| Save | **Save current chat settings into this profile** | Zastępuje wartości zapisane w wybranym profilu |
| Rename | **Rename profile** | Zmienia nazwę wybranego profilu |
| Save As | **Save current chat settings as a new profile** | Tworzy kolejny profil na podstawie bieżącego czatu |
| Import | **Import settings profile (.json)** | Wczytuje plik profilu |
| Export | **Export settings profile (.json)** | Pobiera wybrany profil |
| Delete | **Delete profile** | Trwale usuwa wybrany profil |

Aby utworzyć pierwszy profil, skonfiguruj czat i wybierz **Save current chat settings as a new profile**. Aby zaktualizować go później, zastosuj profil, zmień ustawienia czatu, a potem wybierz **Save current chat settings into this profile**.

### Aktualizowanie innych czatów korzystających z profilu

Każdy czat ma własną kopię ustawień profilu, więc samo zapisanie profilu nie zmienia innych czatów. Gdy z profilu korzystają inne czaty w tym samym trybie, zapis pyta, co zrobić:

- **Save to this profile only** (zapisanie tylko w tym profilu) zapisuje profil i zostawia pozostałe czaty bez zmian.
- **Save and update** (zapisanie i aktualizacja) z dopisaną liczbą czatów, na przykład **Save and update 3 other chats** (zapisanie i aktualizacja 3 innych czatów), kopiuje też do tych czatów ustawienia Chat Settings zapisane w profilu. Ich własne zmiany tych ustawień zostają zastąpione, a ustawienie, które w czacie, z którego zapisujesz, ma wartość domyślną, wraca w nich do wartości domyślnej.

**Save and update** kopiuje:

- Opcje generowania i kontekstu
- Opcje czatu grupowego
- Przełączniki funkcji i komend
- Agentów i ich opcje
- Ustawienia pamięci i podsumowań
- Tłumaczenie
- Układ okien

Wszystko inne zostaje tak, jak jest w danym czacie, w tym:

- Połączenie, preset promptu i własny prompt
- Fabuła i postacie
- Lorebooki i tło
- Notatki i postęp
- To, których komend Roleplay może używać tylko narrator czatu
- To, czy Noodle może korzystać z wiadomości czatu

Ustawienia Advanced Parameters i opisywanie obrazów (włączenie lub wyłączenie oraz wybór połączenia, które opisuje obrazy) zmieniają się tylko w czatach korzystających z połączenia profilu, bo ustawia się je dla tego połączenia. Harmonogramy postaci zmieniają się tylko wtedy, gdy w czacie, z którego zapisujesz, zostały włączone lub wyłączone; w przeciwnym razie każdy czat zachowuje własny wybór. Agenci Knowledge Retrieval, Knowledge Router, Lorebook Keeper i Expression Engine pozostają włączeni lub wyłączeni, razem ze swoimi szablonami promptu, tak jak w danym czacie. Każdy czat sam wybiera dla nich źródła, lorebook czy sprite'y.

Pokoje gry wieloosobowej nigdy nie są aktualizowane w ten sposób. Gdy z profilu nie korzysta żaden inny czat, przycisk **Save** (zapis) działa bez pytania.

## Wybór profilu domyślnego

Gwiazdka obok listy rozwijanej oznacza profil używany automatycznie w nowych czatach w danym trybie. Domyślny może być tylko jeden profil na tryb.

Podpowiedzi gwiazdki opisują bieżący stan:

- **Mark this profile as default for new chats in this mode**
- **This profile is the default for new chats in this mode**
- **Select a profile to mark it as default**

## Ulubione układy okien

Gwiazdka obok **Reset View** na pasku tytułu Chat Settings zapisuje ulubiony układ okien dla nowych czatów w bieżącym trybie. Zapamiętuje też, czy wskazówki dotyczące układu są ukryte. Możesz z niej korzystać w trybach Conversation, Roleplay i Game. Gwiazdka obok listy **Profile** nadal wybiera domyślny profil ustawień.

Po aktualizacji istniejącej instalacji znajomy układ przycisków narzędzi staje się ulubionym układem dla nowych czatów we wszystkich trzech trybach. Dzieje się to raz i zachowuje wcześniejszy wybór lub wyczyszczenie ulubionego układu. Układ pozostaje domyślny, dopóki go nie zmienisz. Świeża instalacja zaczyna z narzędziami wewnątrz Chat Settings i bez wybranego ulubionego układu.

Rozmieść okna i przyciski, a potem kliknij gwiazdkę na pasku tytułu, żeby zapisać układ. Gwiazdka jest wypełniona, gdy bieżący układ i widoczność wskazówek odpowiadają ulubionemu. Po przesunięciu okna lub zmianie układu kliknij ją ponownie, żeby zastąpić ulubiony układ. Kliknięcie wypełnionej gwiazdki usuwa ten wybór i przywraca standardowy układ dla przyszłych czatów. Istniejące czaty pozostają bez zmian.

Jeśli nowy czat korzysta z domyślnego profilu ustawień, układ zapisany w profilu ma pierwszeństwo przed ulubionym układem. Profil bez zapisanego układu zachowuje rozmieszczenie czatu, także to pochodzące z ulubionego układu. Profil nadal stosuje własne ustawienie widoczności wskazówek; starsze profile bez tego ustawienia pokazują wskazówki.

Instrukcję znajdziesz w sekcji [Wybór układu dla nowych czatów](chat-settings.md#choosing-a-layout-for-new-chats).

## Import i eksport profili

Przycisk **Export settings profile (.json)** pobiera plik `.marinara-settings-profile.json`, który można zachować jako kopię zapasową albo udostępnić dalej. Przycisk **Import settings profile (.json)** tworzy nowy profil ze zgodnego pliku, nie nadpisując żadnego z istniejących. Starsze wyeksportowane profile nadal da się importować.

Profile przechowują ustawienia, a nie tajne dane dostawców. Eksportowany albo importowany profil pomija też webhook kopii czatu w serwisie Discord, adres DeepLX, klucz DeepL i adres Intiface. Profile zapisane w tej instalacji je zachowują.

## Profil Default

Tryby Conversation i Roleplay mają własny wbudowany profil **Default**. Jego zastosowanie przywraca ustawienia sterowane przez profil do wartości domyślnych aplikacji Marinara Engine dla danego trybu.

Profilu **Default** nie da się przemianować, nadpisać ani usunąć. Wyłączone kontrolki tłumaczą to komunikatami **Cannot save into the Default profile**, **Cannot rename the Default profile** oraz **Cannot delete the Default profile**.

## Powiązane przewodniki

- [Panel **Chat Settings** – przegląd](chat-settings.md)
- [Edytor presetów i menedżer promptów](../prompts/presets.md)
- [Parametry generowania](../prompts/generation-parameters.md)
