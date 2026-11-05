# Sceny: odgałęzienie roleplayu

Scena to krótki roleplay, który odgałęzia się od czatu Conversation. Przydaje się na retrospekcję, randkę albo walkę, bez utraty głównego wątku.

Każda scena to osobny czat Roleplay z własnym tłem, postaciami i wiadomością otwierającą. Dopóki scena jest otwarta, w pierwotnym czacie Conversation widnieje karta z napisem **A scene is in progress** (trwa scena) i przyciskiem **Go to Scene** (przejście do sceny).

W czasie trwania sceny jej postacie nie odpowiadają w czacie Conversation, a komunikat informuje, że są w aktywnej scenie. Żeby mimo to mogły ci tam odpowiadać, włącz na karcie przełącznik **Allow replies here** (zezwolenie na odpowiedzi tutaj). Domyślnie jest wyłączony. Po jego włączeniu postacie ze sceny odpowiadają, gdy do nich piszesz, ale nadal nie piszą z własnej inicjatywy.

## Rozpocznij scenę

Zanim zaczniesz: otwórz czat Conversation, w którym jest już trochę wiadomości. Zobacz [Tryb Conversation: pierwsze kroki](../conversation/getting-started.md).

1. W polu wiadomości wpisz `/scene` i krótki opis. `/rp` działa tak samo. Na przykład: `/scene we sneak into the old library at midnight`
2. Naciśnij <kbd>Enter</kbd>. Otwiera się okno **Scene Prompt Setup** (konfiguracja promptu sceny).
3. Jeśli widzisz **Scene persona** (persona sceny), wybierz, w kogo się wcielasz. **Use the Conversation persona** (użycie persony z czatu Conversation) zachowuje personę z czatu Conversation.
4. Jeśli widzisz **Scene characters** (postacie sceny), zostaw włączone **Let the scene planner choose characters** (wybór postaci przez planistę sceny), żeby Marinara wybrała je sama. Możesz też to wyłączyć i wybrać co najmniej jedną postać.
5. Wybierz **Prompt preset** (preset promptu). Zostaw **None** (brak), żeby użyć presetu z twojego domyślnego [profilu ustawień](../chats/settings-profiles.md#choosing-the-default-profile) Roleplay. Marinara zapamiętuje ten wybór dla kolejnej sceny.
6. W sekcji **POV** wybierz sposób narracji: **First Person**, **Second Person** albo **Third Person**.
7. W sekcji **Tense** wybierz **Past**, **Present** albo **Future**.
8. Opcjonalnie: wpisz uwagi w polu **Extra instructions** (dodatkowe wskazówki), żeby pokierować sceną.
9. Kliknij **Plan Scene** (zaplanowanie sceny).

Scena otwiera się jako nowy czat Roleplay na liście czatów, z wiadomością otwierającą, która przedstawia sytuację. Kliknij **Cancel** (anuluj) w oknie konfiguracji, żeby przerwać bez tworzenia sceny.

Sama komenda `/scene` też działa, gdy czat Conversation ma już dość historii. Jeśli w czacie Conversation nie ma jeszcze żadnych wiadomości, Marinara prosi o dopisanie opisu albo o wcześniejszą rozmowę.

Postać też może zaproponować scenę. Obok jej odpowiedzi pojawia się zaproszenie **Set up scene** (przygotuj scenę). Kliknij je, żeby otworzyć **Scene Prompt Setup**, a potem kontynuuj od kroku 3. **Cancel** zamyka konfigurację, a zaproszenie pozostaje dostępne, nawet po odświeżeniu strony.

Jak zaczyna się scena:

- Przejmuje ustawienia z twojego domyślnego profilu ustawień Roleplay, tak jak każdy nowy czat Roleplay. [Profil ustawień](../chats/settings-profiles.md) to zapisany zestaw ustawień czatu.
- Gdy plan sceny je zawiera, krótka notatka o tym, jak poprowadzić scenę, pojawia się najpierw jako wiadomość narratora, a opis sceny – jako druga wiadomość narratora. Jeśli plan nie ma takiej notatki, ten krok jest pomijany.
- Przy jednej postaci wiadomość otwierająca jest napisana jej głosem, a wypowiadane słowa są ujęte w podwójne cudzysłowy, chyba że twoje instrukcje pisania określają inny styl.
- W scenie grupowej początek jest zgodny z trybem grupy w profilu. Domyślny jest tryb **Merged (Narrator)** (odpowiedź scalona z narracją): jedna odpowiedź mówi głosem każdej postaci. W trybie **Individual** (osobno) wiadomość otwierającą pisze postać rozpoczynająca scenę. Zobacz [Czaty grupowe](../chats/group-chats.md#choose-who-speaks).

## Użyj paska sceny

W scenie nad polem wiadomości znajduje się pasek, który decyduje o jej losie. To, które przyciski są widoczne, zależy od tego, czy scena ma czat Conversation, z którego wyszła.

| Przycisk | Co robi |
| --- | --- |
| **Back to conversation** (powrót do czatu Conversation) | Przenosi z powrotem do czatu Conversation, z którego wyszła scena. Scena zostaje otwarta. Widoczny tylko wtedy, gdy scena ma czat źródłowy. |
| **End Scene** (zakończenie sceny) | Zapisuje podsumowanie i kończy scenę. Kliknij **Yes** (tak) przy pytaniu **End and save summary?**. |
| **Discard** (odrzucenie) | Usuwa scenę i niczego nie zapisuje. Kliknij **Yes** przy pytaniu **Discard scene?**. |
| **Convert** (przekształcenie) | Zamienia scenę w osobny, samodzielny czat Roleplay. Opis niżej. |

**End Scene** pokazuje **Saving...**, zapisuje krótkie podsumowanie w czacie Conversation jako wspomnienie i przenosi cię tam z powrotem. **Discard** niczego nie zachowuje. Oba przyciski usuwają scenę z twojego czatu Conversation.

## Sklonuj scenę od wybranej wiadomości

Aby skopiować scenę do wybranej wiadomości i ciągnąć ją osobno, a pierwotną scenę zostawić otwartą:

1. Najedź kursorem na wiadomość, od której chcesz utworzyć gałąź.
2. Kliknij jej akcję **Clone from here** (klonowanie od tego miejsca).

Marinara tworzy nowy, samodzielny czat Roleplay z wiadomościami do tej wiadomości włącznie, pokazuje potwierdzenie i otwiera nowy czat.

## Przekształć scenę w czat Roleplay

Użyj **Convert**, kiedy scena rozrosła się w historię, którą chcesz zachować jako zwykły czat Roleplay.

1. Kliknij **Convert** na pasku sceny.
2. Przeczytaj pytanie **Convert this scene into a standalone roleplay?** Przekształcenie tworzy ze sceny nowy czat Roleplay i odłącza pierwotną scenę od jej czatu Conversation. Do czatu nie trafia z powrotem ani podsumowanie sceny, ani wspomnienie postaci.
3. Kliknij **Convert** albo **Cancel**, żeby niczego nie zmieniać.

Klonowanie zostawia pierwotną scenę otwartą. Przekształcenie – nie.

## Sceny i połączone czaty

Scena jest samodzielna. Nie pobiera kontekstu z połączonego czatu Conversation, nawet jeśli czat nadrzędny to robi, i ignoruje krótkie wskazówki, które połączony czat Conversation może wysyłać do powiązanego czatu Roleplay. Jeśli zależy ci na stałym, dwustronnym połączeniu między czatem Conversation a roleplayem, użyj połączonego czatu. Zobacz [Łączenie czatu Conversation z czatem Roleplay lub Game](../chats/connected-chats.md).

## Powiązane przewodniki

- [Tryb Roleplay: pierwsze kroki](getting-started.md)
- [Gałęzie czatu](../chats/branches.md)
- [Łączenie czatu Conversation z czatem Roleplay lub Game](../chats/connected-chats.md)
