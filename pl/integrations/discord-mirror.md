# Kopiowanie wiadomości na Discord

Ten przewodnik wyjaśnia, jak działa kopiowanie wiadomości na Discord w aplikacji Marinara Engine. Wiadomości z czatu trafiają na kanał Discord w jedną stronę, na bieżąco. Funkcja działa w trybach Conversation, Roleplay i Game Mode.

## Do czego służy kopiowanie wiadomości

Kopiowanie wiadomości na Discord jest jednokierunkowe. Marinara wysyła wiadomości na kanał Discord. Discord nie może odesłać nic z powrotem. To nie jest dwukierunkowy bot na Discord.

Kopiowanie korzysta z webhooka Discord. Webhook to specjalny adres URL, dzięki któremu jedna aplikacja może publikować wiadomości na kanale Discord.

Kopiowanie ustawia się osobno dla każdego czatu. Każdy czat ma własny adres webhooka. Wklejenie adresu w danym czacie włącza tam kopiowanie. Pozostałe czaty pozostają wyłączone, dopóki nie wklei się adresu w każdym z nich.

## Tworzenie adresu webhooka Discord

Webhook tworzy się w aplikacji Discord, a nie w aplikacji Marinara Engine. Potrzebne są uprawnienia do zarządzania kanałem Discord, który ma być użyty.

1. Otwórz serwer Discord i wybierz kanał, na którym mają pojawiać się wiadomości.
2. Otwórz ustawienia tego kanału, przejdź do sekcji **Integrations** (Integracje), a potem do **Webhooks** (Webhooki).
3. Utwórz nowy webhook i skopiuj jego adres URL.

Adres webhooka Discord wygląda tak:

```
https://discord.com/api/webhooks/123456789012345678/AbCdEf-example-token
```

Zachowaj ten adres dla siebie. Każdy, kto go zna, może publikować wiadomości na twoim kanale Discord.

## Włączanie kopiowania wiadomości

Ustawienie webhooka znajduje się w ustawieniach każdego czatu, w sekcji **Connected Chats** (połączone czaty). Pole ma podpis **Discord Mirror** (kopiowanie wiadomości na Discord), a jego tekst zastępczy to `https://discord.com/api/webhooks/...`.

1. Otwórz czat, którego wiadomości mają być kopiowane.
2. Otwórz panel **Chat Settings** (ustawienia czatu).
3. Znajdź sekcję **Connected Chats**.
4. Wklej adres webhooka w polu przy dolnej krawędzi tej sekcji.

Od tej chwili kopiowanie działa w tym czacie. Aby je wyłączyć, wyczyść pole do końca.

Jeśli adres nie jest poprawnym adresem webhooka Discord, pod polem pojawia się czerwony napis "Invalid webhook URL format". Popraw adres, a ustawienie się zapisze. Marinara sprawdza adres jeszcze raz na serwerze podczas zapisu.

Adres webhooka zostaje w tej instalacji aplikacji Marinara Engine. Eksporty czatów, wyeksportowane profile ustawień i pliki z **Export Profile** (Eksportuj profil) go pomijają, a import żadnego z nich nigdy nie włącza kopiowania. Żeby kopiować czat przeniesiony do innej instalacji, wklej tam adres jeszcze raz. Profil ustawień zapisany w tej instalacji nadal ustawia kopiowanie, gdy go zastosujesz.

## Co trafia na Discord

Marinara kopiuje wiadomości użytkownika i odpowiedzi AI w miarę ich generowania.

- Nazwa nadawcy: wiadomości użytkownika idą pod nazwą aktywnej persony, czyli postaci, w którą się wcielasz. Wiadomości AI idą pod nazwą postaci.
- W trybie Game Mode narracja trafia na Discord pod nazwą "Narrator". Tury członków drużyny i postaci NPC (postaci niezależnych) idą pod nazwą "Party". Jeśli w grze włączona jest opcja **Character GM**, odpowiedzi Game Mastera (mistrza gry) idą pod nazwą tej postaci.
- Obrazki nie są wysyłane. Discord pokazuje wyłącznie nazwę nadawcy i tekst.
- Długie wiadomości: Discord przycina każdą wiadomość do 2000 znaków. Wiadomość dłuższa niż 1997 znaków zostaje skrócona, a jej kopia kończy się znakami "...".
- Wzmianki w rodzaju @everyone czy @here umieszczone w tekście nikogo nie powiadamiają na twoim kanale Discord.

## Co nie trafia na Discord

- Ponownie wygenerowane odpowiedzi i swipe'y nie są kopiowane po raz drugi. Na Discord idzie tylko pierwsza odpowiedź w danej turze.
- Wiadomości napisane przez funkcję **Impersonate** nie są kopiowane. Ta funkcja pozwala AI napisać wiadomość za ciebie.
- Jeśli wysyłka na Discord się nie powiedzie, Marinara nie pokazuje błędu i nie ponawia próby. Informacja o niepowodzeniu trafia wyłącznie do logów serwera.

## Ograniczenie częstotliwości

Discord ogranicza tempo publikowania wiadomości przez aplikacje. Marinara wysyła najwyżej jedną wiadomość na mniej więcej 1.2 sekundy na każdy webhook. To około 50 wiadomości na minutę. Kolejne wiadomości czekają w kolejce i wychodzą po kolei. Kiedy Discord prosi o zwolnienie tempa, Marinara odczekuje i wysyła dalej.

## Powiązane przewodniki

- [Łączenie czatu Conversation z czatem Roleplay lub Game](../chats/connected-chats.md)
