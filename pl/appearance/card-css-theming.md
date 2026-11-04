# Przewodnik po stylowaniu kart w CSS

CSS karty nadaje karcie postaci lub persony własny wygląd na czacie. Kod CSS wpisujesz w pole **Creator Notes** (notatki twórcy) na karcie, a Marinara stosuje go do wiadomości tej postaci. Może zmieniać wyłącznie wygląd czatu, nigdy reszty aplikacji. Ten przewodnik jest przeznaczony dla twórców kart.

## Zanim zaczniesz

Pojęcia używane w tym przewodniku:

- **CSS** decyduje o kolorach, krojach pisma, obramowaniach i odstępach.
- **CSS karty** to kod CSS wpisany w kartę. Nadaje styl wiadomościom tej karty.
- **Card Theming** (stylowanie kart) to ustawienie czatu, które włącza CSS karty. Znajdziesz je w **Chat Settings → Characters** (ustawienia czatu, postacie), a w trybie Game w **Party** (drużyna).
- **Selektor** to ta część reguły CSS, która wybiera elementy do ostylowania. Spacja między dwoma selektorami oznacza "wewnątrz", więc `.a .b` pasuje do elementu `.b` wewnątrz `.a`.
- **Układ** to sposób rozmieszczenia wiadomości. Tryb Conversation ma układ wierszowy **Linear** oraz układ **Bubbles**.

## Szybki start

Oto blok na początek, do wklejenia w kroku 2:

```html
<style>
  /* the visible message bubble (Bubbles layout, and roleplay) */
  [data-card-css] .mari-message-bubble {
    background: linear-gradient(135deg, #2a1240, #3a1030);
    border: 1px solid #ff66cc;
    border-radius: 14px;
  }
  /* the name and the text (works in every message style) */
  [data-card-css] .mari-message-name {
    color: #ff8fd4;
    text-shadow: 0 0 8px rgba(255, 102, 204, 0.6);
  }
  [data-card-css] .mari-message-content {
    color: #ffd6f0;
  }
</style>
```

Najpierw dodajesz CSS do karty, a potem włączasz go na czacie.

1. Otwórz postać w edytorze postaci (Character Editor) i znajdź pole **Creator Notes**. Persony mają to samo pole w edytorze persony (Persona Editor).
2. Wklej blok startowy w pole **Creator Notes** i zapisz kartę.
3. Otwórz czat z tą postacią.
4. Otwórz **Chat Settings**, a potem **Characters** (w trybie Game **Party**).
5. W sekcji **Card Theming** wybierz **Exclusive** albo **Chat**. Na starcie ustawienie to **Disabled** (wyłączone).

Wiadomości postaci od razu zmieniają wygląd.

Jeśli to nie zadziałało: przyciski **Disabled**, **Exclusive** i **Chat** pojawiają się tylko wtedy, gdy aktywna postać w czacie ma kod CSS w polu **Creator Notes**. Sam CSS persony ich nie wywoła, więc motyw persony też wymaga w czacie jednej postaci z blokiem `<style>`. Sprawdź, czy twój blok `<style>` się zapisał. W czatach Roleplay przełącznik **Color Character Names in Text** (kolorowanie imion postaci w tekście) znajduje się w **Characters**, pod **Add Character** (dodanie postaci).

Nazwa świeci na różowo, a tekst robi się delikatnie różowy w każdym układzie. Reguła dla dymka dodaje fioletowy gradient z różowym obramowaniem. `.mari-message-bubble` istnieje tylko w układzie **Bubbles** i w trybie Roleplay, więc w domyślnym układzie **Linear** trybu Conversation reguła dla dymka nic nie zmienia.

Do testu, którego nie da się przeoczyć, użyj tej reguły. Obejmuje tekst wiadomości, który istnieje w każdym trybie i układzie, i zmienia jego tło na jaskraworóżowe.

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## Jak działa Card Theming

Gdy aktywna jest postać z kodem CSS w polu **Creator Notes**, Marinara odczytuje każdy blok `<style>`, usuwa wszystko, co niebezpieczne (zobacz [Czego nie da się ostylować](#what-you-cannot-style)), ogranicza zakres CSS tak, żeby sięgał tylko do czatu, i wstawia go tak, żeby jego selektory miały pierwszeństwo przed własnymi stylami wiadomości w aplikacji.

Sposób zastosowania wybierasz osobno dla każdego czatu w **Chat Settings → Characters** (w trybie Game **Party**).

| Tryb | Co robi |
| --- | --- |
| **Disabled** (domyślnie) | CSS karty jest wyłączony. |
| **Exclusive** | CSS każdej postaci obejmuje wyłącznie jej własne wiadomości. |
| **Chat** | Cały CSS kart obejmuje cały obszar czatu, razem z elementami interfejsu. |

Tryb **Exclusive** wybierz na czatach grupowych, gdzie każda postać ma własny wygląd. Tryb **Chat** wybierz przy kartach do rozmów sam na sam, które nadają styl całej powierzchni czatu, na przykład tłu.

## Zasada zakresu

Marinara przepisuje twój kod CSS tak, żeby sięgał tylko do czatu.

- W trybie **Chat** zakres wszystkiego ogranicza się do obszaru czatu. `[data-card-css]` oznacza obszar czatu.
- W trybie **Exclusive** zakres wszystkiego ogranicza się do poszczególnych elementów wiadomości twojej postaci. `[data-card-css]` oznacza wiadomość tej postaci.

Dlatego do stylowania samego elementu wiadomości używaj `[data-card-css]`, a do elementów w jego wnętrzu zwykłych selektorów klas, takich jak `.mari-message-bubble`, `.mari-message-content` i `.mari-message-name`. Klasa na tym samym elemencie nie dopasuje się jako potomek. Buduj kod na selektorach `[data-card-css] .mari-message-...`, a karta zadziała w obu trybach.

```css
[data-card-css] {
  /* the message row itself, good for a left accent border */
  border-left: 3px solid #ff66cc;
}
[data-card-css] .mari-message-bubble {
  /* the visible bubble inside it */
  border-radius: 14px;
}
```

W zakresie **Exclusive** `[data-card-css]` to własna wiadomość postaci, która jest zarazem `.mari-message-assistant`. Żeby ostylować także własne wiersze, użyj zakresu **Chat**. Tam `[data-card-css] .mari-message-user` i `.mari-message-assistant` wybierają każdą ze stron.

## Wybór trybu przez @chat-mode

Zamknij reguły w `@chat-mode roleplay`, `@chat-mode conversation` albo `@chat-mode game`, żeby objąć nimi tylko jedną powierzchnię. Kod CSS poza takim blokiem działa wszędzie. Standardowe zapytania `@media` działają wewnątrz tych bloków.

```html
<style>
  /* Applies in all modes */
  [data-card-css] .mari-message-name {
    color: #00ff95;
  }

  @chat-mode roleplay {
    [data-card-css] .mari-message-bubble {
      border: 1px solid rgba(0, 255, 149, 0.4);
      box-shadow: 0 0 16px rgba(0, 255, 149, 0.25);
    }
  }

  @chat-mode conversation {
    [data-card-css] .mari-message-bubble {
      background: rgba(0, 40, 28, 0.9);
      border-radius: 1rem;
    }
  }
</style>
```

Tryb Game Mode ma wsparcie podstawowe. W trybie **Chat** CSS karty sięga całej powierzchni gry, więc `[data-card-css]` nadaje styl obszarowi gry. Gra ma własny układ i nie ma dymków wiadomości, więc celuj szeroko, na przykład w tło obszaru. Stylowanie narracji w grze osobno dla każdej postaci (tryb **Exclusive**) nie jest jeszcze dostępne.

## Co da się ostylować

Tryby Roleplay i Conversation mają ten sam szkielet. Trzymaj się klas `mari-*` i atrybutów `data-*` wymienionych niżej. Inne klasy zmieniają się między wersjami.

| Selektor | Co obejmuje |
| --- | --- |
| `[data-card-css]` | Cały wiersz wiadomości (element wyznaczający zakres). Dobry do akcentów przy krawędzi, a w trybie **Chat** do obszaru czatu. |
| `[data-card-css] .mari-message-bubble` | Widoczny dymek: tło, obramowanie, narożniki, cień. W układzie **Bubbles** i w trybie Roleplay. |
| `[data-card-css] .mari-message-content` | W układzie **Bubbles** sam element dymka. W układzie **Linear** wyłącznie tekst wiadomości. |
| `[data-card-css] .mari-message-name` | Wyświetlana nazwa postaci. |
| `[data-card-css] .mari-message-meta` | Wiersz nagłówka z nazwą i znacznikiem czasu. |
| `[data-card-css] .mari-message-timestamp` | Znacznik czasu. |
| `[data-card-css] .mari-message-avatar` | Kolumna z awatarem. |
| `[data-card-css] .mari-message-narrator` | Wiadomości narratora (tryb Roleplay). |
| `[data-card-css] .mari-message-user` | Wiadomości użytkownika. Do wiadomości postaci użyj `.mari-message-assistant`. |
| `[data-card-css] p`, `[data-card-css] span` | Akapity i elementy span w tekście. |
| `[data-grouped]` | Kolejne wiadomości tej samej postaci. Tylko w trybie Conversation. Do pierwszej wiadomości w grupie użyj `[data-card-css]:not([data-grouped])`. |

Żeby zmienić układ, otwórz **Settings → Appearance → Conversation** (ustawienia, wygląd, Conversation), potem **Conversation Display**, a potem **Chat Layout** (układ czatu). W układzie **Linear** styluj `.mari-message-content` (tekst) i `[data-card-css]` (wiersz), bo nie ma tam dymka.

Ostylowany dymek:

```css
[data-card-css] .mari-message-bubble {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid rgba(100, 149, 237, 0.35);
  border-radius: 1rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}
[data-card-css] .mari-message-name {
  color: #6495ed;
  text-shadow: 0 0 8px rgba(100, 149, 237, 0.5);
}
[data-card-css] .mari-message-content {
  font-family: Georgia, serif;
}
```

### Wskaźnik pisania

W układzie **Linear** trybu Conversation wiersz "(name) is typing..." jest widoczny, gdy postać pisze.

| Selektor | Co obejmuje |
| --- | --- |
| `[data-card-css] .mari-typing-text` | Napis. |
| `[data-card-css] .mari-typing-dots span` | Animowane kropki. |
| `[data-card-css] .mari-typing-indicator` | Wiersz. Niesie nazwę w atrybucie `data-typing-name`. |

```css
[data-card-css] .mari-typing-text {
  color: #ff66cc;
  font-style: italic;
}
[data-card-css] .mari-typing-dots span {
  background: #ff66cc;
}
```

### Awatar

Awatar jest domyślnie kółkiem. Przykład obejmuje klikalny przycisk awatara. Do awatara, który nie jest klikalny, użyj `.mari-message-avatar > div`. W trybie Roleplay przycisk siedzi dodatkowo w elemencie `div` z poświatą. Wypłaszcz ten element, jeśli chcesz zostawić tylko własną obwódkę.

```css
[data-card-css] .mari-message-avatar button {
  border-radius: 6px; /* 0 for sharp corners, 50% for a circle */
  box-shadow: 0 0 0 2px #ff66cc;
}
@chat-mode roleplay {
  [data-card-css] .mari-message-avatar > div {
    box-shadow: none;
  }
}
```

### Panel profilu About Me (tylko tryb Conversation)

W trybie Conversation kliknięcie awatara otwiera panel podręczny profilu z sekcją "about me". Karty postaci i persony mogą ostylować własny panel. Nie istnieje on w trybach Roleplay ani Game, więc zamknij te reguły w `@chat-mode conversation`, jeśli karta obsługuje też inne tryby.

Karta panelu jest elementem wyznaczającym zakres. Obejmij ją zapisem `[data-card-css].mari-about-me-popout` (bez spacji, ten sam element), a jej elementy podrzędne selektorami potomka. W trybie **Chat** możesz pisać wprost `.mari-about-me-name`.

| Selektor | Co obejmuje |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | Karta panelu: tło, obramowanie, kształt. |
| `[data-card-css] .mari-about-me-banner` | Górny pasek banera (domyślnie w kolorze nazwy). |
| `[data-card-css] .mari-about-me-avatar` | Element obejmujący powiększony awatar. Do kółka użyj `... > div`. |
| `[data-card-css] .mari-about-me-status` | Kropka statusu obecności (tylko postacie). |
| `[data-card-css] .mari-about-me-name` | Nagłówek z wyświetlaną nazwą. |
| `[data-card-css] .mari-about-me-handle` | Dodatkowa linia z @nazwą, widoczna, gdy nazwa wyświetlana w trybie Convo jest inna. |
| `[data-card-css] .mari-about-me-presence` | Linia statusu lub aktywności (tylko postacie). |
| `[data-card-css] .mari-about-me-box` | Ramka z treścią About Me. |
| `[data-card-css] .mari-about-me-label` | Podpis "ABOUT ME". |
| `[data-card-css] .mari-about-me-badge` | Plakietka Default lub Chat-specific. |
| `[data-card-css] .mari-about-me-text` | Treść sekcji about me. |

```css
@chat-mode conversation {
  [data-card-css].mari-about-me-popout {
    background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #14101f 70%);
    border: 1px solid rgba(180, 120, 255, 0.45);
    border-radius: 1.25rem;
  }
  [data-card-css] .mari-about-me-banner {
    background: linear-gradient(90deg, #b478ff, #ff77c6);
  }
  [data-card-css] .mari-about-me-name {
    color: #e9d8ff;
  }
}
```

<a id="what-you-cannot-style"></a>

## Czego nie da się ostylować

Filtr oczyszczający usuwa te rzeczy ze względów bezpieczeństwa.

| Zablokowane | Dlaczego |
| --- | --- |
| `url(https://...)` | Żadnych zapytań sieciowych, żeby nie dało się śledzić użytkownika ani wyprowadzać danych. Dozwolone jest tylko `url(data:...)`, do obrazów i krojów pisma osadzonych w kodzie. |
| `@font-face` z zewnętrznymi adresami URL | Zostają wyłącznie źródła krojów pisma w formie `data:`. Nazwa rodziny zostaje zmieniona, żeby nie mogła nadpisać krojów aplikacji. |
| `@import` | Żadnego wczytywania zewnętrznych arkuszy stylów. |
| selektory `:has()` | Nie mogą badać elementów spoza czatu. |
| Zagnieżdżone reguły i selektory zaczynające się od `~` lub `+` | Usuwane, żeby CSS karty nie mógł sięgnąć poza swój zakres. Pisz zwykłe selektory. |
| HTML w `content:` | Tekst ozdobny jest dozwolony, ale znaki `<` i `>` są usuwane, a długość tekstu ograniczona do 200 znaków. Zapisy `attr()` i `counter()` są dozwolone. |
| `position: fixed` | Zamieniane na `position: absolute`, więc nie da się przykryć całego ekranu. |
| `!important` | Usuwane, więc CSS karty nie może na siłę nadpisać stylów aplikacji. |
| Tokeny motywu aplikacji | Tokeny takie jak `--primary` czy `--background` są usuwane, więc CSS karty nie przemaluje interfejsu aplikacji. |

CSS karty ma pierwszeństwo przed własnymi stylami wiadomości w aplikacji przy kolorach, tłach, obramowaniach i krojach pisma wewnątrz czatu. Nie przebije tego, co usuwa filtr oczyszczający, niczego poza czatem ani stylów, które aplikacja nakłada w linii albo z `!important`. Przykładem są globalny kolor i rozmiar czcionki czatu ustawione w **Settings**.

Własny krój pisma osadź jako identyfikator `data:` w kodowaniu base64 albo użyj zestawu krojów systemowych.

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

## Wskazówki

1. Dymek styluj przez `.mari-message-bubble`, a nie `[data-card-css]`. Wiersz ma pełną szerokość, więc tło na nim jest zwykle prawie niewidoczne.
2. Używaj kolorów `rgba()`, żeby wtapiały się w motyw jasny i ciemny.
3. Zachowaj umiar w animacjach. Na słabszych urządzeniach lepiej sprawdza się `transition` niż ciężka `animation`. Animuj `opacity`, a nie `box-shadow`, który wymusza ponowne rysowanie w każdej klatce.
4. Do telefonów użyj `@media (max-width: 768px)`.
5. Nie opieraj się na klasach pomocniczych. Stabilne są tylko udokumentowane punkty zaczepienia `mari-*`.

## Przykład popisowy: Eldritch Grimoire

Ten przykład sięga po główne punkty zaczepienia w każdym trybie: świecące nazwy, klimatyczny tekst szeryfowy, awatar z obwódką, animowany dymek w trybie Roleplay z runą w rogu, dymek w trybie Conversation, niepokojący wskaźnik pisania i powierzchnię gry. Wklej go w pole **Creator Notes**, a potem wybierz tryb Card Theming w **Chat Settings → Characters** (w trybie Game **Party**). Dla powierzchni gry ustaw **Chat**. Podmień kolory, znak w `content` i kroje pisma, żeby karta stała się twoja.

```html
<style>
  @keyframes grimoire-pulse {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }

  /* All modes */
  [data-card-css] .mari-message-name {
    color: #ff5c8a;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-shadow: 0 0 8px rgba(255, 92, 138, 0.7), 0 0 16px rgba(168, 85, 247, 0.45);
  }
  [data-card-css] .mari-message-timestamp {
    color: rgba(243, 215, 255, 0.5);
    font-variant: small-caps;
  }
  [data-card-css] .mari-message-avatar button {
    border-radius: 7px;
    box-shadow: 0 0 0 2px rgba(220, 38, 120, 0.6), 0 0 14px rgba(168, 85, 247, 0.5);
  }
  [data-card-css] .mari-message-content {
    color: #f3d7ff;
    font-family: "Iowan Old Style", Georgia, "Times New Roman", serif;
  }

  @chat-mode roleplay {
    [data-card-css] {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css] .mari-message-avatar > div {
      box-shadow: none;
    }
    [data-card-css] .mari-message-bubble {
      background: linear-gradient(135deg, #1a0a24 0%, #2d0a2e 55%, #3a0a1e 100%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 4px 16px 16px 16px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 0 16px rgba(190, 70, 190, 0.4);
    }
    /* breathing inner glow: animate a full-bleed overlay's opacity, which is cheap */
    [data-card-css] .mari-message-bubble::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: inset 0 0 26px rgba(120, 0, 80, 0.65);
      animation: grimoire-pulse 4s ease-in-out infinite;
    }
    [data-card-css] .mari-message-bubble::before {
      content: "✦";
      position: absolute;
      top: 1px;
      right: 7px;
      font-size: 0.7rem;
      color: rgba(220, 38, 120, 0.55);
    }
    [data-card-css] .mari-message-narrator {
      color: #c9a8ff;
      font-style: italic;
    }
  }

  @chat-mode conversation {
    [data-card-css]:not([data-grouped]) {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css] .mari-message-bubble {
      background: rgba(26, 10, 36, 0.92);
      border: 1px solid rgba(220, 38, 120, 0.4);
      border-radius: 1rem;
    }
    [data-card-css] .mari-typing-text {
      color: #ff5c8a;
      font-style: italic;
    }
    [data-card-css] .mari-typing-dots span {
      background: #ff5c8a;
    }
    [data-card-css].mari-about-me-popout {
      background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #12081c 72%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 1.25rem;
    }
    [data-card-css] .mari-about-me-banner {
      background: linear-gradient(90deg, #a855f7, #dc2678);
    }
    [data-card-css] .mari-about-me-name {
      color: #ffd7ef;
    }
  }

  /* Game: in Chat scope, [data-card-css] is the whole game surface */
  @chat-mode game {
    [data-card-css] {
      background-image: radial-gradient(120% 80% at 50% 0%, rgba(58, 10, 46, 0.5), transparent 70%);
    }
  }
</style>
```

## Tworzenie CSS karty z pomocą asystenta AI

Żeby nie pisać CSS ręcznie, przekaż asystentowi AI ten prompt. Uzupełnij zaznaczone miejsce koncepcją swojej postaci.

```text
I'm creating a character card for Marinara Engine (an AI chat app). The card has a
"Creator Notes" field where I can embed <style> blocks. Write CSS that themes the
character's messages.

Character concept: [describe the aesthetic]

Technical constraints:
- Use [data-card-css] for the message row (works in both Exclusive and Chat modes);
  use normal class selectors for things inside it.
- [data-card-css] .mari-message-bubble = the visible bubble (background / border /
  corners / shadow); [data-card-css] .mari-message-content = the text;
  [data-card-css] .mari-message-name = the display name;
  [data-card-css] .mari-message-avatar button = the clickable avatar
  (non-clickable fallback: .mari-message-avatar > div; in roleplay the button sits
  under an extra glow-wrapper div).
- Style the typing indicator via [data-card-css] .mari-typing-text and
  [data-card-css] .mari-typing-dots span.
- Conversation only: the avatar-click "about me" popout is themable via
  [data-card-css].mari-about-me-popout (the card), the banner via
  .mari-about-me-banner, the avatar via .mari-about-me-avatar > div, the name via
  .mari-about-me-name, the box via .mari-about-me-box, and the body via
  .mari-about-me-text. Wrap these in @chat-mode conversation { ... }.
- Wrap roleplay-only CSS in @chat-mode roleplay { ... }, conversation-only in
  @chat-mode conversation { ... }; CSS outside applies everywhere.
- Blocked: url(https://...), @import, :has(), !important, app theme tokens
  (--primary, etc.). position: fixed becomes absolute. Use url(data:...) and
  rgba() colors.
- [data-grouped] marks continuation messages, in Conversation mode ONLY
  (roleplay rows never carry it); there, use
  [data-card-css]:not([data-grouped]) for first-in-group.

Output a single <style> block I can paste into Creator Notes.
```

## Powiązane przewodniki

- [Ustawienia wyglądu](appearance-settings.md)
- [Własne motywy CSS (Theme Library)](custom-css-themes.md)
- [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md)
