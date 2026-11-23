# Profile ustawień

Profil ustawień to nazwany zestaw ustawień czatu wielokrotnego użytku: połączenia, presetu promptu, agentów, narzędzi, tłumaczenia, przywoływania pamięci, parametrów zaawansowanych i innych. Zastosuj go w innym czacie, zamiast ustawiać te opcje od nowa.

Profile znajdują się na górze panelu **Chat Settings** (ustawienia czatu). Działają w trybach Conversation i Roleplay. Czaty Game nie pokazują kontrolek profilu.

Czym innym jest **preset promptu**. Decyduje on o strukturze promptu systemowego (tekstu, który Marinara wysyła do AI) i o wartościach generowania, a edytuje się go w panelu Presets. Zobacz [Edytor presetów i menedżer promptów](../prompts/presets.md). Profil ustawień to szerszy zestaw, który może zawierać preset promptu jako jeden z elementów.

## Zastosowanie profilu

1. Otwórz czat, który chcesz zmienić, a potem otwórz **Chat Settings**. Zobacz [Panel **Chat Settings** – przegląd](chat-settings.md).
2. Rozwiń listę **Profile** (profil) z etykietą **Apply a settings profile to this chat** (zastosowanie profilu ustawień do tego czatu).
3. Wybierz profil po nazwie.

Czat zmienia się od razu. Jeśli profil włącza albo wyłącza **Hide summarised messages** (ukrywanie podsumowanych wiadomości), podsumowane wiadomości czatu w tej samej chwili zostają ukryte przed modelem albo znów stają się dla niego widoczne.

Jeśli to nie zadziałało: gdy wartości czatu nie odpowiadają żadnemu zapisanemu profilowi, lista pokazuje **Custom settings profile** (własny profil ustawień). Jeśli zastosowany profil został usunięty, lista pokazuje **Missing profile - choose a profile** (brak profilu, wybierz profil). Wybierz inny profil.

## Tworzenie lub edycja profilu

1. Obok listy rozwijanej dotknij **New** (nowy) z podpowiedzią "New profile from this chat's settings". Otworzy się kreator profili z ustawieniami tego czatu w polach. Aby zmienić zapisany profil, wybierz go i kliknij **Edit** (edycja). Profilu Default nie można edytować.
2. Wpisz **Profile name** (nazwa profilu).
3. Wypełnij pola (zobacz listę niżej).
4. Dotknij **Save and choose chats…** (zapisanie i wybór czatów).
5. Aby używać profilu w nowych czatach, zaznacz **Make this the default** (ustaw jako domyślny). Lista zaczyna się od pozycji **New conversation chats** (nowe czaty Conversation) albo **New roleplay chats** (nowe czaty Roleplay).
6. Zaznacz istniejące czaty, które mają dostać profil teraz.
7. Dotknij **Apply to N chats** (zastosowanie do N czatów) albo **Save** (zapis), jeśli nic nie zaznaczono.

Kreator grupuje pola w sekcjach **Chat** (czat), **Story** (fabuła), **Pictures** (obrazy) i **Behind the scenes** (za kulisami). Pola to:

- **Connection** (połączenie), **Prompt preset** (preset promptu) i **Parameters** (parametry)
- **Agents** (agenci), **Tools** (narzędzia) i **Memory & summary** (pamięć i podsumowanie)
- **Persona**, **Lorebooks** (lorebooki) i **Background** (tło)
- **Image style** (styl obrazów) i **Translation** (tłumaczenie)

Jak wypełniać pola:

- Kliknij pole, żeby otworzyć okno wyboru z wyszukiwarką i folderami biblioteki, takie jak przy wyborze presetów i lorebooków. Jeśli pole przyjmuje jeden element, wybierz **None** (brak), żeby je wyczyścić.
- W polach **Agents** i **Lorebooks** można wybrać kilka elementów. Zaznacz je w oknie lub użyj na folderze opcji **Add all** (dodaj wszystko). Każdy wybór pojawia się pod polem z przyciskiem usuwania. **Clear selection** (wyczyść zaznaczenie) opróżnia pole. W polu **Tools** włączasz narzędzia przez zaznaczenie ich na liście.
- Na komputerze możesz otworzyć pasek boczny biblioteki, nie zamykając edytora, i przeciągnąć element do jego pola.
- Pola **Parameters**, **Memory & summary** i **Translation** pokazują tylko, czy profil je zawiera. Zmień je w Chat Settings, a potem zapisz w profilu.

W kreatorze nowego czatu na kroku **Use a Profile** (użycie profilu) przy polu profilu jest przycisk **New** (nowy), a przy zapisanym profilu **Edit** (edytuj). Po zapisaniu kreator wybiera ten profil.

<a id="the-profiles-tab"></a>

## Zakładka profili

Żeby zarządzać profilami poza czatem, otwórz panel **Presets** (presety) i wybierz zakładkę **Profiles** (profile). Zawiera wszystkie profile trybów Conversation i Roleplay, z profilem **Default** (domyślnym) każdego trybu na początku. Przyciski **All** (wszystkie), **Conversation** i **Roleplay** filtrują listę według trybu, a pole **Search profiles** (szukaj profili) według nazwy. Gwiazdka oznacza profil domyślny dla nowych czatów w danym trybie.

- Kliknij profil, żeby otworzyć edytor na środku ekranu. **Back** (wstecz) zapisuje zmiany, a **Cancel** (anuluj) je odrzuca. Profili **Default** nie da się edytować, więc nie otwierają się w edytorze.
- **Create settings profile** (utwórz profil ustawień) otwiera pusty profil. Wybierz jego tryb przyciskiem **Conversation** lub **Roleplay**. Zapisany profil zachowuje swój tryb.
- Najedź na wiersz, żeby ustawić profil jako domyślny za pomocą gwiazdki, skopiować go, wyeksportować lub usunąć. Na telefonie przyciski są stale widoczne po prawej stronie wiersza.
- **Select profiles** (wybierz profile) pozwala wyeksportować lub usunąć kilka naraz. **Select all profiles** (wybierz wszystkie profile) pomija profile **Default**, których nie da się usunąć. Każdy profil jest eksportowany do osobnego pliku.
- **Import settings profile (.json)** (importuj profil ustawień) wczytuje plik `.marinara-settings-profile.json`.

Przycisk **Edit** w **Chat Settings** nadal otwiera edytor w oknie nad czatem.

## Zapisywanie ustawień czatu w profilu

Aby zaktualizować profil na podstawie czatu, zastosuj go, zmień czat, a potem użyj rzędu ikon pod listą rozwijaną.

| Przycisk | Etykieta | Efekt |
| --- | --- | --- |
| Save | **Save current chat settings into this profile** | Zastępuje wartości zapisane w profilu. |
| Rename | **Rename profile** | Zmienia nazwę. |
| Import | **Import settings profile (.json)** | Wczytuje plik profilu. |
| Export | **Export settings profile (.json)** | Pobiera profil. |
| Delete | **Delete profile** | Trwale usuwa profil. |

### Aktualizowanie innych czatów korzystających z profilu

Każdy czat ma własną kopię ustawień profilu, więc samo zapisanie profilu nie zmienia innych czatów. Gdy korzystają z niego inne czaty w tym samym trybie, okno **Other chats use this profile** (inne czaty używają tego profilu) pyta, co zrobić:

- **Save to this profile only** (zapisanie tylko w tym profilu) zapisuje profil i zostawia pozostałe czaty bez zmian.
- **Save and update N other chats** (zapisanie i aktualizacja N innych czatów) kopiuje też do tych czatów ustawienia Chat Settings zapisane w profilu. Zastępuje ich własne zmiany tych ustawień, a ustawienie, które w czacie, z którego zapisujesz, ma wartość domyślną, wraca w nich do wartości domyślnej.

Gdy z profilu nie korzysta żaden inny czat, **Save** działa bez pytania. Pokoje gry wieloosobowej nigdy nie są aktualizowane w ten sposób.

<a id="choosing-the-default-profile"></a>

## Wybór profilu domyślnego

Gwiazdka obok listy rozwijanej oznacza profil używany automatycznie w nowych czatach w danym trybie. Domyślny może być tylko jeden profil na tryb. Jej etykiety to **Mark this profile as default for new chats in this mode**, **This profile is the default for new chats in this mode** i **Select a profile to mark it as default**. W kreatorze możesz też zaznaczyć **Make this the default**.

## Import i eksport profilu

**Export settings profile (.json)** pobiera plik `.marinara-settings-profile.json`, który można zachować jako kopię zapasową albo udostępnić. **Import settings profile (.json)** tworzy nowy profil ze zgodnego pliku i nigdy nie nadpisuje istniejącego. Starsze eksporty nadal da się importować. Nieudany import pokazuje komunikat **Import failed**.

Profile przechowują ustawienia, a nie tajne dane dostawców. Wyeksportowany albo zaimportowany profil pomija też webhook kopii czatu w serwisie Discord, adres DeepLX, klucz DeepL i adres Intiface. Profile zapisane w tej instalacji je zachowują. Wyeksportowane pliki nie zawierają persony, lorebooków ani wyborów zmiennych presetu, ponieważ należą one do tej instalacji.

## Profil Default

Tryby Conversation i Roleplay mają własny wbudowany profil **Default** (domyślny). Jego zastosowanie przywraca ustawienia sterowane przez profil do wartości domyślnych aplikacji Marinara Engine dla danego trybu. Nie da się go przemianować, nadpisać ani usunąć. Wyłączone kontrolki pokazują komunikaty **Cannot save into the Default profile**, **Cannot rename the Default profile** i **Cannot delete the Default profile**.

<a id="favorite-window-layouts"></a>

## Ulubione układy okien

Gwiazdka obok **Reset View** (przywrócenie widoku) na pasku tytułu Chat Settings zapisuje ulubiony układ okien dla nowych czatów. Gwiazdka obok listy **Profile** wybiera natomiast profil domyślny. Kolejne kroki opisuje sekcja [Wybieranie układu dla nowych czatów](chat-settings.md#choosing-a-layout-for-new-chats).

Gdy nowy czat korzysta z domyślnego profilu z zapisanym układem, ten układ ma pierwszeństwo przed ulubionym układem. Profil bez zapisanego układu zachowuje rozmieszczenie czatu, także to pochodzące z ulubionego układu. Profil nadal stosuje własne ustawienie wskazówek dotyczących układu (starsze profile bez tego ustawienia pokazują wskazówki) i własny tryb Scoped Regex Scripts, a jeśli go nie ma, ustawienie domyślne presetu promptu.

## Co zawiera profil

Profil zapisuje sposób, w jaki czat rozmawia z modelem:

- Połączenie.
- Preset promptu (w trybie Conversation nazywany źródłem promptu) wraz z twoimi wyborami jego [zmiennych presetu](../prompts/preset-variables.md). Zastosowanie profilu przenosi te wybory do czatu. Profil zapisany, zanim zaczął je przechowywać, zostawia własne wybory czatu.
- Agenci i narzędzia.
- Tłumaczenie, Memory Recall i Advanced Parameters.
- Układ okien i przycisków: położenia, rozmiary, przypięcia, blokady, to, które narzędzia są wewnątrz Chat Settings, a które wydzielone, otwarte okna narzędzi oraz położenia przycisków na komputerach i telefonach. Profile bez zapisanego układu, takie jak **Default**, zostawiają układ czatu bez zmian.
- To, czy wskazówki dotyczące układu są ukryte. Zastosowanie profilu **Default** albo starszego profilu bez tej opcji ponownie pokazuje wskazówki.
- Inne opcje czatu wielokrotnego użytku.

Profil może też przechowywać **wybory początkowe**: personę, lorebooki do włączenia i tło.

- Zastosowanie profilu kopiuje te wybory do czatu. Jeśli któryś z nich jest w profilu pusty, czat zachowuje własny.
- Pozostałe ustawienia profilu nadal zastępują ustawienia czatu.
- Wybory nie pozostają powiązane. Późniejsza zmiana w czacie zostaje tylko w tym czacie.
- **Save current chat settings into this profile** zastępuje lorebooki profilu tymi, które dodano do czatu za pomocą **Add Lorebook** (dodanie lorebooka) albo przez zastosowanie profilu. Lorebook utworzony dla czatu przez agenta Lorebook Keeper nie zostaje zapisany. Jeśli nie dodano żadnych lorebooków, po zapisie profil nie ma żadnego lorebooka. Profil zachowuje własną personę i tło. Profil bez tła przejmuje tło czatu, gdy zapisujesz do niego ustawienia.
- Aktualizacja innych czatów nigdy nie zmienia ich persony, lorebooków ani tła.

Profil nie zastępuje treści należących do czatu: postaci, sprite'ów, podsumowania, tagów, promptu sceny ani **Author's Notes** (Notatki autora). Nie zawiera też historii rozmowy ani bieżącego stanu, takiego jak zmienne makr, postacie wyłączone przez ciebie czy pokój gry wieloosobowej. Profil zapisany we wcześniejszej wersji może nadal zawierać **Author's Notes**, ale jego zastosowanie zachowuje własne notatki czatu.

### Co kopiuje Save and update

**Save and update** (zapisanie i aktualizacja) kopiuje do innych czatów:

- Opcje generowania i kontekstu.
- Opcje czatu grupowego.
- Przełączniki funkcji i komend.
- Agentów i ich opcje.
- Ustawienia pamięci i podsumowań.
- Tłumaczenie.
- Układ okien.
- Wybory zmiennych presetu, tylko w czatach korzystających z tego samego presetu promptu co profil.

Wszystko inne zostaje tak, jak jest w danym czacie:

- Połączenie, preset promptu i własny prompt czatu.
- Fabuła i postacie czatu.
- Lorebooki i tło czatu.
- **Author's Notes** i postęp czatu.
- To, których komend Roleplay może używać tylko narrator czatu.
- To, czy Noodle może korzystać z wiadomości czatu.

Advanced Parameters i opisywanie obrazów (włączenie lub wyłączenie oraz wybór połączenia, które opisuje obrazy) zmieniają się tylko w czatach korzystających z połączenia profilu, bo ustawia się je dla tego połączenia. Harmonogramy postaci zmieniają się tylko wtedy, gdy w czacie, z którego zapisujesz, zostały włączone lub wyłączone. Agenci Knowledge Retrieval, Knowledge Router, Lorebook Keeper i Expression Engine pozostają włączeni lub wyłączeni, razem ze swoimi szablonami promptu, tak jak w danym czacie. Każdy czat sam wybiera dla nich źródła, lorebook czy sprite'y.
