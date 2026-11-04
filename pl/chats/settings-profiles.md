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

- Wybieraj elementy z listy każdego pola. W polach **Agents**, **Tools** i **Lorebooks** można wybrać kilka elementów. W polu **Tools** każde narzędzie włączasz albo wyłączasz jego polem wyboru. W polu na jeden element wybierz **None** (brak), aby je wyczyścić.
- Na komputerze w listach agentów i lorebooków przytrzymaj <kbd>Ctrl</kbd> (w systemie macOS <kbd>Command</kbd>), aby wybrać kilka elementów. Na telefonie użyj kontrolek zaznaczania. **Clear selection** (wyczyszczenie zaznaczenia) opróżnia listę.
- Na komputerze możesz otworzyć pasek boczny biblioteki, nie zamykając edytora, i przeciągnąć element do jego pola.
- Pola **Parameters**, **Memory & summary** i **Translation** pokazują tylko, czy profil je zawiera. Zmień je w Chat Settings, a potem zapisz w profilu.

W kreatorze nowego czatu krok **Use a Profile** (użycie profilu) ma też pozycję **New profile…** (nowy profil) na początku listy i przycisk **Edit** obok zapisanego profilu. Po zapisaniu kreator wybiera ten profil.

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

Profile przechowują ustawienia, a nie tajne dane dostawców. Wyeksportowany albo zaimportowany profil pomija też webhook kopii czatu w serwisie Discord, adres DeepLX, klucz DeepL i adres Intiface. Profile zapisane w tej instalacji je zachowują. Wyeksportowane pliki nie zawierają persony ani lorebooków, ponieważ istnieją one tylko w tej instalacji.

## Profil Default

Tryby Conversation i Roleplay mają własny wbudowany profil **Default** (domyślny). Jego zastosowanie przywraca ustawienia sterowane przez profil do wartości domyślnych aplikacji Marinara Engine dla danego trybu. Nie da się go przemianować, nadpisać ani usunąć. Wyłączone kontrolki pokazują komunikaty **Cannot save into the Default profile**, **Cannot rename the Default profile** i **Cannot delete the Default profile**.

<a id="favorite-window-layouts"></a>

## Ulubione układy okien

Gwiazdka obok **Reset View** (przywrócenie widoku) na pasku tytułu Chat Settings zapisuje ulubiony układ okien dla nowych czatów. Gwiazdka obok listy **Profile** wybiera natomiast profil domyślny. Kolejne kroki opisuje sekcja [Wybieranie układu dla nowych czatów](chat-settings.md#choosing-a-layout-for-new-chats).

Gdy nowy czat korzysta z domyślnego profilu z zapisanym układem, ten układ ma pierwszeństwo przed ulubionym układem. Profil bez zapisanego układu zachowuje rozmieszczenie czatu, także to pochodzące z ulubionego układu. Profil nadal stosuje własne ustawienie wskazówek dotyczących układu (starsze profile bez tego ustawienia pokazują wskazówki) i własny tryb Scoped Regex Scripts, a jeśli go nie ma, ustawienie domyślne presetu promptu.

## Co zawiera profil

Profil zapisuje sposób, w jaki czat rozmawia z modelem:

- Połączenie.
- Preset promptu (w trybie Conversation nazywany źródłem promptu).
- Agenci i narzędzia.
- Tłumaczenie, Memory Recall i Advanced Parameters.
- Układ okien i przycisków: położenia, rozmiary, przypięcia, blokady, to, które narzędzia są wewnątrz Chat Settings, a które wydzielone, otwarte okna narzędzi oraz położenia przycisków na komputerach i telefonach. Profile bez zapisanego układu, takie jak **Default**, zostawiają układ czatu bez zmian.
- To, czy wskazówki dotyczące układu są ukryte. Zastosowanie profilu **Default** albo starszego profilu bez tej opcji ponownie pokazuje wskazówki.
- Inne opcje czatu wielokrotnego użytku.

Profil może też przechowywać **wybory początkowe**: personę, lorebooki do włączenia i tło.

- Zastosowanie profilu kopiuje te wybory do czatu. Jeśli któryś z nich jest w profilu pusty, czat zachowuje własny.
- Pozostałe ustawienia profilu nadal zastępują ustawienia czatu.
- Wybory nie pozostają powiązane. Późniejsza zmiana w czacie zostaje tylko w tym czacie.
- **Save current chat settings into this profile** zachowuje personę, lorebooki i tło zapisane w samym profilu. Profil bez tła przejmuje tło czatu, gdy zapisujesz do niego ustawienia.
- Aktualizacja innych czatów nigdy nie zmienia ich persony, lorebooków ani tła.

Profil nie zastępuje treści należących do czatu: postaci, sprite'ów, podsumowania, tagów ani promptu sceny. Nie zawiera też historii rozmowy ani bieżącego stanu, takiego jak zmienne makr, postacie wyłączone przez ciebie czy pokój gry wieloosobowej.

### Co kopiuje Save and update

**Save and update** (zapisanie i aktualizacja) kopiuje do innych czatów:

- Opcje generowania i kontekstu.
- Opcje czatu grupowego.
- Przełączniki funkcji i komend.
- Agentów i ich opcje.
- Ustawienia pamięci i podsumowań.
- Tłumaczenie.
- Układ okien.

Wszystko inne zostaje tak, jak jest w danym czacie:

- Połączenie, preset promptu i własny prompt czatu.
- Fabuła i postacie czatu.
- Lorebooki i tło czatu.
- Notatki i postęp czatu.
- To, których komend Roleplay może używać tylko narrator czatu.
- To, czy Noodle może korzystać z wiadomości czatu.

Advanced Parameters i opisywanie obrazów (włączenie lub wyłączenie oraz wybór połączenia, które opisuje obrazy) zmieniają się tylko w czatach korzystających z połączenia profilu, bo ustawia się je dla tego połączenia. Harmonogramy postaci zmieniają się tylko wtedy, gdy w czacie, z którego zapisujesz, zostały włączone lub wyłączone. Agenci Knowledge Retrieval, Knowledge Router, Lorebook Keeper i Expression Engine pozostają włączeni lub wyłączeni, razem ze swoimi szablonami promptu, tak jak w danym czacie. Każdy czat sam wybiera dla nich źródła, lorebook czy sprite'y.
