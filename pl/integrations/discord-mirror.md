# Kopiowanie wiadomości na Discord

Kopiowanie wiadomości na Discord przenosi twoje wiadomości z czatu na kanał Discord na bieżąco, w trakcie czatu. Działa w trybach Conversation, Roleplay i Game.

To przekaz jednokierunkowy. Marinara wysyła wiadomości na zewnątrz, a Discord nie może nic odesłać, więc nie jest to dwukierunkowy bot. Funkcja korzysta z webhooka Discord, czyli specjalnego adresu URL, dzięki któremu jedna aplikacja może publikować wiadomości na kanale Discord. Kopiowanie ustawia się osobno dla każdego czatu. Każdy czat ma własny adres webhooka, a pozostałe czaty pozostają wyłączone, dopóki nie wkleisz adresu w każdym z nich.

## Tworzenie adresu webhooka Discord

Webhook tworzy się w aplikacji Discord, a nie w aplikacji Marinara Engine. Potrzebne są uprawnienia do zarządzania kanałem Discord, którego chcesz użyć.

1. Otwórz serwer Discord i wybierz kanał, na którym mają pojawiać się wiadomości.
2. Otwórz ustawienia tego kanału, potem **Integrations** (Integracje), a potem **Webhooks** (Webhooki).
3. Utwórz nowy webhook i skopiuj jego adres URL.

Adres webhooka Discord wygląda tak:

```text
https://discord.com/api/webhooks/123456789012345678/AbCdEf-example-token
```

Zachowaj ten adres dla siebie. Każdy, kto go zna, może publikować wiadomości na twoim kanale Discord.

## Włączanie kopiowania

Pole webhooka znajduje się w ustawieniach każdego czatu, w sekcji **Connected Chats** (połączone czaty). Ma podpis **Discord Mirror** (kopiowanie wiadomości na Discord), a jego tekst zastępczy to `https://discord.com/api/webhooks/...`.

1. Otwórz czat, którego wiadomości mają być kopiowane.
2. Otwórz **Chat Settings** (ustawienia czatu).
3. Znajdź sekcję **Connected Chats**.
4. Wklej adres webhooka w polu przy dolnej krawędzi tej sekcji.

Od tej chwili kopiowanie działa w tym czacie. Aby je wyłączyć, wyczyść pole.

Jeśli to nie zadziałało: gdy adres nie jest poprawnym adresem webhooka Discord, pod polem pojawia się czerwony napis "Invalid webhook URL format". Popraw adres, a ustawienie się zapisze. Marinara sprawdza adres jeszcze raz na serwerze podczas zapisu.

Adres webhooka pozostaje w tej instalacji aplikacji Marinara Engine. Eksporty czatów, eksportowane profile ustawień i pliki **Export Profile** (eksport profilu) go pomijają, a import żadnego z nich nigdy nie włącza kopiowania. Żeby kopiować czat przeniesiony do innej instalacji, wklej tam adres jeszcze raz. Profil ustawień zapisany w tej instalacji nadal ustawia kopiowanie, gdy go zastosujesz.

## Co trafia na Discord

Marinara kopiuje twoje wiadomości i odpowiedzi AI w miarę ich generowania.

- Nazwa nadawcy: twoje wiadomości idą pod nazwą aktywnej persony. Wiadomości AI idą pod nazwą postaci.
- W trybie Game Mode tury członków drużyny i postaci NPC (postaci niezależnych) trafiają na Discord pod nazwą "Party". Narracja fabuły idzie pod nazwą "Narrator". Jeśli gra korzysta z opcji **Character GM**, odpowiedzi mistrza gry idą zamiast tego pod nazwą tej postaci.
- Nie jest wysyłany żaden obrazek. Discord pokazuje tylko nazwę nadawcy i tekst.
- Długie wiadomości: Discord ogranicza każdą wiadomość do 2000 znaków. Wiadomość dłuższa niż 1997 znaków zostaje skrócona, a jej kopia kończy się znakami "...".
- Wzmianki w rodzaju @everyone czy @here w tekście nikogo nie powiadamiają na twoim kanale Discord.

## Co nie trafia na Discord

- Ponownie wygenerowane odpowiedzi i swipe'y nie są kopiowane drugi raz. Swipe to kolejna odpowiedź zachowana przy tej samej wiadomości. Na Discord trafia tylko pierwsza odpowiedź w każdej turze.
- Wiadomości napisane funkcją Impersonate nie są kopiowane. Impersonate to funkcja, w której AI pisze wiadomość za ciebie.
- Nieudana wysyłka nie jest ponawiana. Wysyłka, na którą Discord odpowie ograniczeniem częstotliwości (429), również nie jest ponawiana – zobacz niżej. Nieudana wysyłka nie pokazuje w czacie żadnego błędu. Niepowodzenia inne niż ograniczenie częstotliwości są zapisywane tylko na serwerze.

## Ograniczenie częstotliwości

Discord ogranicza tempo publikowania wiadomości przez aplikacje. Marinara wysyła najwyżej jedną wiadomość mniej więcej co 1,2 sekundy na każdy webhook. To około 50 wiadomości na minutę. Kolejne wiadomości czekają w kolejce i wychodzą po kolei. Jeśli Discord odpowie na wysyłkę kodem 429 (zwolnij), ta wiadomość nie jest ponawiana. Marinara odczekuje czas Retry-After podany przez Discord, a potem przechodzi do następnej wiadomości w kolejce.

## Powiązane przewodniki

- [Łączenie czatu Conversation z czatem Roleplay lub Game](../chats/connected-chats.md)
