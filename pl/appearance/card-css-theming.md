# Przewodnik po stylowaniu kart w CSS

Ten przewodnik pokazuje twórcom postaci i person, jak nadać karcie własny wygląd na czacie. Kod CSS wpisuje się w pole **Creator Notes** (notatki twórcy) na karcie, a Marinara Engine bezpiecznie stosuje go do wiadomości tej postaci. Taki kod zmienia wyłącznie wygląd czatu i nigdy nie sięga do reszty aplikacji.

## Zanim zaczniesz

Kilka prostych definicji, które przewijają się przez cały przewodnik:

- **CSS** to język, który decyduje o kolorach, krojach pisma, obramowaniach i odstępach na stronie internetowej.
- **CSS karty** to kod CSS wpisany w kartę postaci lub persony. Nadaje styl wiadomościom tej karty.
- **Card Theming** (stylowanie kart) to kontrolka na ekranie, która włącza CSS karty dla danego czatu.
- **Selektor** to ta część reguły CSS, która wybiera elementy do ostylowania.
- **Selektor potomka** używa spacji w znaczeniu "wewnątrz". Zapis `.a .b` pasuje do elementu `.b` znajdującego się wewnątrz `.a`.
- **Kaskada** to mechanizm CSS, który rozstrzyga, która reguła wygrywa, gdy do tego samego elementu pasuje kilka reguł.
- **Układ** to sposób rozmieszczenia wiadomości na ekranie. Marinara ma układ wierszowy **Linear** oraz układ **Bubbles**.

## Szybki start

Stylowanie karty odbywa się w dwóch miejscach. Najpierw dodaj CSS do karty. Potem włącz go na czacie.

1. Otwórz postać w edytorze **Character Editor** (edytor postaci) i znajdź pole **Creator Notes**. Persony mają to samo pole w edytorze **Persona Editor** (edytor persony).
2. Wklej blok `<style>` w pole **Creator Notes** i zapisz kartę.
3. Otwórz czat z tą postacią.
4. Otwórz **Chat Settings** (ustawienia czatu), a potem sekcję **Card Theming**.
5. Wybierz **Exclusive** albo **Chat**. Na starcie tryb stoi na **Disabled**.

Wiadomości postaci powinny zmienić wygląd od razu. Kontrolka **Card Theming** pojawia się dopiero wtedy, gdy aktywna postać w tym czacie ma kod CSS w polu **Creator Notes**. Sam CSS persony nie wywoła tej kontrolki. Przynajmniej jedna postać w czacie musi mieć własny blok `<style>`. Jeśli kontrolki nie widać, sprawdź, czy blok `<style>` zapisał się poprawnie.

Oto blok na początek, do wklejenia w pole **Creator Notes**:

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

Nazwa postaci świeci na różowo, a jej tekst robi się delikatnie różowy w każdym układzie. Reguła dla dymka dokłada fioletowy gradient z różowym obramowaniem. Jedno zastrzeżenie: `.mari-message-bubble` istnieje wyłącznie w układzie **Bubbles** oraz w trybie Roleplay. Domyślny układ trybu Conversation to **Linear**, w którym nie ma elementu dymka, więc reguła dla dymka nic tam nie zmieni. Różnicę wyjaśnia niżej uwaga "Bubbles a Linear".

**Szybki test:** żeby sprawdzić to ponad wszelką wątpliwość, użyj reguły poniżej. Obejmuje ona tekst wiadomości, który istnieje w każdym trybie i układzie. Tło tekstu powinno natychmiast zrobić się jaskraworóżowe.

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## Jak działa Card Theming

Kiedy aktywna jest postać z kodem CSS w polu **Creator Notes**, Marinara robi cztery rzeczy:

1. Odczytuje każdy blok `<style>` z pola **Creator Notes**.
2. Oczyszcza kod CSS i usuwa wszystko, co niebezpieczne. Zajrzyj do sekcji "Czego nie da się ostylować" poniżej.
3. Ogranicza zakres kodu CSS tak, żeby sięgał tylko do czatu.
4. Wstawia kod CSS w taki sposób, żeby jego selektory o ograniczonym zakresie miały pierwszeństwo przed własnymi stylami wiadomości w aplikacji.

Sposób zastosowania wybiera się osobno dla każdego czatu w **Chat Settings**, a potem w **Card Theming**. Do wyboru są trzy tryby.

| Tryb | Co robi |
| --- | --- |
| **Disabled** (domyślnie) | CSS karty jest wyłączony, więc żadne style postaci nie działają. |
| **Exclusive** | CSS każdej postaci obejmuje wyłącznie jej własne wiadomości. |
| **Chat** | Cały CSS karty obejmuje cały obszar czatu, razem z elementami interfejsu. |

Tryb **Exclusive** sprawdza się na czatach grupowych, gdzie każda postać ma własny wygląd. Tryb **Chat** wybierz na czatach z jedną postacią, kiedy karta ma nadać styl całej powierzchni czatu.

## Jedna zasada zakresu, która naprawdę się liczy

Marinara przepisuje twój kod CSS tak, żeby sięgał tylko do czatu. Sposób przepisania zależy od trybu.

- Tryb **Chat** ogranicza zakres wszystkiego do obszaru czatu. Selektor `.mari-message-bubble` pasuje normalnie, bo dymek leży wewnątrz tego obszaru.
- Tryb **Exclusive** ogranicza zakres wszystkiego do poszczególnych elementów wiadomości danej postaci. To one mają atrybut `data-card-css`. Klasa na tym samym elemencie nie dopasuje się jako potomek. Pasuje tylko to, co jest w środku.

Stąd bierze się reguła uniwersalna. Do stylowania samego elementu wiadomości używaj `[data-card-css]`. Do wszystkiego w jego wnętrzu używaj zwykłych selektorów klas, takich jak `.mari-message-bubble`, `.mari-message-content` czy `.mari-message-name`.

Zapis `[data-card-css]` oznacza "wiadomość tej postaci" w trybie **Exclusive** oraz "obszar czatu" w trybie **Chat**. Działa w obu. Selektory elementów wewnętrznych (te ze spacją) działają w obu trybach tak samo.

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

## Wybór trybu przez @chat-mode

Reguły zamknięte w blokach `@chat-mode` obejmują tylko jedną powierzchnię. Kod CSS poza takim blokiem działa wszędzie.

```html
<style>
  /* Applies in ALL modes */
  [data-card-css] .mari-message-name {
    color: #00ff95;
  }

  /* Only in Roleplay mode */
  @chat-mode roleplay {
    [data-card-css] .mari-message-bubble {
      border: 1px solid rgba(0, 255, 149, 0.4);
      box-shadow: 0 0 16px rgba(0, 255, 149, 0.25);
    }
  }

  /* Only in Conversation mode */
  @chat-mode conversation {
    [data-card-css] .mari-message-bubble {
      background: rgba(0, 40, 28, 0.9);
      border-radius: 1rem;
    }
  }
</style>
```

Standardowe zapytania `@media` działają normalnie wewnątrz bloków `@chat-mode`. Przydają się do układów responsywnych.

Tryb **Game Mode** ma wsparcie podstawowe. W trybie **Chat** kod CSS karty sięga całej powierzchni gry. Dzięki temu `[data-card-css]` nadaje styl obszarowi gry, a `@chat-mode game` go obejmuje. Gra korzysta z własnego układu. Nie ma tam opisanych wyżej punktów zaczepienia dymka wiadomości, więc celuj szeroko, na przykład w tło obszaru. Stylowanie narracji w grze osobno dla każdej postaci (tryb **Exclusive**) nie jest jeszcze dostępne.

## Co da się ostylować

Struktura czatu opiera się na tym samym szkielecie w trybie Roleplay i Conversation. Poniżej są elementy, które może objąć CSS karty. Wewnętrzne klasy pomocnicze nie są stabilnymi punktami zaczepienia. Zmieniają się między wersjami, więc trzymaj się klas `mari-*` i atrybutów `data-*` wymienionych niżej.

| Selektor | Co obejmuje |
| --- | --- |
| `[data-card-css]` | Cały wiersz wiadomości (element wyznaczający zakres). Dobry do akcentów przy lewej lub bocznej krawędzi, a w trybie **Chat** także do obszaru czatu. |
| `[data-card-css] .mari-message-bubble` | Widoczny dymek: tło, obramowanie, narożniki, cień. Występuje w układzie **Bubbles** oraz w trybie Roleplay. |
| `[data-card-css] .mari-message-content` | W układzie **Bubbles** sam element dymka, razem z tłem, obramowaniem i narożnikami. W układzie **Linear** wyłącznie tekst wiadomości. |
| `[data-card-css] .mari-message-name` | Wyświetlana nazwa postaci. |
| `[data-card-css] .mari-message-meta` | Wiersz nagłówka z nazwą i znacznikiem czasu. |
| `[data-card-css] .mari-message-timestamp` | Znacznik czasu. |
| `[data-card-css] .mari-message-avatar` | Kolumna z awatarem. |
| `[data-card-css] .mari-message-narrator` | Wiadomości narratora (tryb Roleplay). |
| `[data-card-css] .mari-message-user` | Wiadomości użytkownika. Do wiadomości postaci użyj `.mari-message-assistant`. |
| `[data-card-css] p`, `... span` | Akapity i elementy span w tekście. |
| `[data-grouped]` | Kolejne wiadomości tej samej postaci. Tylko w trybie Conversation; wiersze w trybie Roleplay nigdy tego nie mają. Do pierwszej wiadomości w grupie użyj `[data-card-css]:not([data-grouped])`. |

**Bubbles a Linear.** To układ **Bubbles** jest tym, co obejmuje `.mari-message-bubble`. Układ **Linear** nie ma elementu dymka, więc styluj tam `.mari-message-content` (tekst) oraz `[data-card-css]` (wiersz). Układ zmienisz w **Settings** (Ustawienia), dalej **Appearance**, potem sekcja **Conversation Display** i pozycja **Chat Layout**. Tryb Roleplay zawsze ma dymek.

Oto ostylowany dymek dla trybu Conversation lub Roleplay:

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

Kiedy postać pisze odpowiedź, układ **Linear** w trybie Conversation pokazuje wiersz "(name) is typing...". Da się go ostylować.

| Selektor | Co obejmuje |
| --- | --- |
| `[data-card-css] .mari-typing-text` | Napis "(name) is typing...". |
| `[data-card-css] .mari-typing-dots span` | Animowane kropki. |
| `[data-card-css] .mari-typing-indicator` | Sam wiersz. Niesie też nazwę w atrybucie `data-typing-name`. |

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

Awatar jest domyślnie kółkiem. Samym CSS da się zmienić jego kształt i dodać obwódkę. Przykłady poniżej obejmują klikalny przycisk awatara. Jeśli na jakiejś powierzchni awatar nie jest klikalny, zastosuj ten sam pomysł do zapasowego `.mari-message-avatar > div` w tym układzie. W trybie Roleplay przycisk siedzi dodatkowo w elemencie `div` z poświatą. Wypłaszcz ten element, jeśli chcesz zostawić samą swoją obwódkę.

```css
[data-card-css] .mari-message-avatar button {
  border-radius: 6px; /* 0 for sharp corners, 50% for a circle */
  box-shadow: 0 0 0 2px #ff66cc;
}
/* roleplay only: drop the app glow wrapper so just your ring shows */
@chat-mode roleplay {
  [data-card-css] .mari-message-avatar > div {
    box-shadow: none;
  }
}
```

### Panel profilu About Me (tylko tryb Conversation)

W trybie Conversation kliknięcie awatara otwiera panel podręczny profilu z sekcją "about me" postaci lub persony. Można go ostylować w tym samym zakresie `[data-card-css]`. Ten panel istnieje wyłącznie w trybie Conversation. Nie ma go w trybie Roleplay ani Game Mode. Zamknij te reguły w `@chat-mode conversation`, jeśli w karcie jest też CSS dla trybu Roleplay lub Game Mode. Zarówno karty postaci, jak i persony mogą ostylować własny panel z poziomu pola **Creator Notes**.

Jedno zastrzeżenie przy personach: kontrolka **Card Theming** pojawia się tylko wtedy, gdy aktywna postać w czacie ma kod CSS w polu **Creator Notes**. Sam CSS persony nie wywoła tej kontrolki. Żeby motyw panelu persony zadziałał, przynajmniej jedna postać w czacie też musi mieć blok `<style>`.

| Selektor | Co obejmuje |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | Sama karta panelu (element wyznaczający zakres): tło, obramowanie, kształt. |
| `[data-card-css] .mari-about-me-banner` | Górny pasek banera (domyślnie w kolorze nazwy). |
| `[data-card-css] .mari-about-me-avatar` | Element obejmujący powiększony awatar. Do samego kółka użyj `... > div`. |
| `[data-card-css] .mari-about-me-status` | Kropka statusu obecności (tylko postacie). |
| `[data-card-css] .mari-about-me-name` | Nagłówek z wyświetlaną nazwą. |
| `[data-card-css] .mari-about-me-handle` | Dodatkowa linia z @nazwą (widoczna, gdy nazwa wyświetlana w trybie Conversation jest inna). |
| `[data-card-css] .mari-about-me-presence` | Linia statusu lub aktywności (tylko postacie). |
| `[data-card-css] .mari-about-me-box` | Ramka z treścią About Me. |
| `[data-card-css] .mari-about-me-label` | Podpis "ABOUT ME". |
| `[data-card-css] .mari-about-me-badge` | Kafelek Default lub Chat-specific. |
| `[data-card-css] .mari-about-me-text` | Wyrenderowana treść sekcji about me. |

Karta panelu jest elementem wyznaczającym zakres. Obejmiesz ją zapisem `[data-card-css].mari-about-me-popout` (bez spacji, ten sam element). Elementy w środku obejmij selektorem potomka, na przykład `[data-card-css] .mari-about-me-name`. W trybie **Chat** zakresem objęty jest cały obszar, więc można pisać wprost `.mari-about-me-name`.

Oto ostylowany panel "about me". Wklej go w pole **Creator Notes** postaci lub persony, a potem włącz **Card Theming** w **Chat Settings**. Przy wklejaniu do persony pamiętaj o zastrzeżeniu powyżej. Jakaś postać w czacie też musi mieć kod CSS w polu **Creator Notes**, inaczej kontrolka pozostanie ukryta.

```html
<style>
@chat-mode conversation {
  [data-card-css].mari-about-me-popout {
    background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #14101f 70%);
    border: 1px solid rgba(180, 120, 255, 0.45);
    border-radius: 1.25rem;
  }
  [data-card-css] .mari-about-me-banner {
    background: linear-gradient(90deg, #b478ff, #ff77c6);
  }
  [data-card-css] .mari-about-me-avatar > div {
    border-radius: 0.9rem; /* squircle avatar */
    box-shadow: 0 0 0 2px #b478ff;
  }
  [data-card-css] .mari-about-me-name {
    color: #e9d8ff;
    text-shadow: 0 0 10px rgba(180, 120, 255, 0.6);
  }
  [data-card-css] .mari-about-me-box {
    background: rgba(180, 120, 255, 0.08);
    border: 1px solid rgba(180, 120, 255, 0.25);
    border-radius: 0.75rem;
  }
  [data-card-css] .mari-about-me-label {
    color: #b478ff;
    letter-spacing: 0.12em;
  }
  [data-card-css] .mari-about-me-text {
    font-family: Georgia, serif;
    color: #f2e9ff;
  }
}
</style>
```

## Czego nie da się ostylować

Filtr oczyszczający usuwa te rzeczy ze względów bezpieczeństwa.

| Zablokowane | Dlaczego |
| --- | --- |
| `url(https://...)` | Żadnych zapytań sieciowych, żeby nie dało się śledzić użytkownika ani wyprowadzać danych. Dozwolone jest tylko `url(data:...)`, do obrazów i krojów pisma osadzonych w kodzie. |
| `@font-face` z zewnętrznymi adresami URL | Zostają wyłącznie źródła krojów pisma w formie `data:`. Nazwa rodziny dostaje automatycznie nową nazwę, żeby nie mogła nadpisać krojów aplikacji. |
| `@import` | Żadnego wczytywania zewnętrznych arkuszy stylów. |
| selektory `:has()` | Nie mogą badać elementów spoza czatu. |
| Zagnieżdżone reguły i selektory zaczynające się od `~` lub `+` | Usuwane, żeby CSS karty nie mógł sięgnąć poza swój zakres. Zapisz je jako zwykłe selektory. |
| HTML w `content:` | Tekst ozdobny jest dozwolony, ale znaki `<` i `>` są usuwane, a długość tekstu ograniczona do 200 znaków. Zapisy `attr()` i `counter()` są dozwolone. |
| `position: fixed` | Zamieniane na `position: absolute`, więc nie da się przykryć całego ekranu. |
| `!important` | Usuwane, więc CSS karty nie może na siłę nadpisać stylów aplikacji. |
| Tokeny motywu aplikacji | Tokeny takie jak `--primary` czy `--background` są usuwane, więc CSS karty nie przemaluje interfejsu aplikacji. |

Marinara wstawia CSS karty z selektorami o ograniczonym zakresie, które mają pierwszeństwo przed własnymi stylami wiadomości w aplikacji. Wygrywa więc przy kolorach, tłach, obramowaniach i krojach pisma wewnątrz czatu. Nie przebije jedynie tego, co usuwa filtr oczyszczający, wszystkiego poza czatem oraz stylów, które aplikacja nakłada w linii albo z `!important`. Globalny kolor i rozmiar czcionki czatu z sekcji **Settings** to właśnie taki przypadek.

**Własne kroje pisma.** Osadź krój pisma jako identyfikator `data:` w kodowaniu base64 albo skorzystaj z krojów systemowych lub bezpiecznych dla stron internetowych.

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

```css
font-family: "Courier New", Consolas, monospace;
```

## Exclusive a Chat: wybór zakresu

- W trybie **Exclusive** zapis `[data-card-css]` oznacza wiadomości tej jednej postaci. Najlepiej sprawdza się na czatach grupowych i tam, gdzie każda postać ma mieć własną tożsamość. Kod CSS obejmujący elementy wewnątrz wiadomości działa tak samo jak w trybie **Chat**.
- W trybie **Chat** zapis `[data-card-css]` oznacza cały obszar czatu. Najlepiej sprawdza się przy kartach do rozmów sam na sam, kiedy chodzi o tło albo klimat całości, a nie tylko o dymki wiadomości.

Buduj kod na selektorach `[data-card-css] .mari-message-...`, a karta zadziała poprawnie w obu trybach.

## Wskazówki

1. Dymek styluj przez `.mari-message-bubble`, a nie `[data-card-css]`. To drugie to wiersz na pełną szerokość, więc tło na nim zwykle w ogóle nie będzie widoczne.
2. Używaj kolorów `rgba()`, żeby wtapiały się w motyw jasny i ciemny.
3. Zachowaj umiar w animacjach. Na słabszych urządzeniach lepiej sprawdza się `transition` niż ciężka `animation`.
4. Do telefonów użyj `@media (max-width: 768px)`.
5. Nie opieraj się na klasach pomocniczych. Stabilne są tylko udokumentowane punkty zaczepienia `mari-*`.

## Przykład popisowy: Eldritch Grimoire

To karta z rozmysłem przesadzona. Sięga po każdy udokumentowany punkt zaczepienia, w każdym trybie. Pokazuje:

- świecące nazwy pisane runicznymi kapitalikami i tekst w klimatycznej szeryfowej czcionce
- awatar o zmienionym kształcie i z obwódką, a do tego znaczniki czasu w kapitalikach
- sigil na krawędzi wiersza wiadomości
- animowany dymek w trybie Roleplay z runą w rogu i ostylowaną narrację
- dymek w trybie Conversation oraz niepokojący wskaźnik pisania
- w pełni ostylowany panel profilu otwierany kliknięciem awatara
- powierzchnię gry

Wklej całość w pole **Creator Notes**, a potem włącz **Card Theming** w **Chat Settings**. Karta nadaje styl wiadomościom w trybie Roleplay i Conversation, panelowi w trybie Conversation oraz powierzchni w Game Mode (dla gry ustaw tryb **Chat**). Sekcje są rozdzielone przez `@chat-mode`, żeby każdy tryb dostał dokładnie te punkty zaczepienia, które ma. Wszystko przechodzi przez filtr oczyszczający.

```html
<style>
  /* shared keyframe. Animate OPACITY, never box-shadow: box-shadow is a "paint"
     property, so animating it repaints and re-blurs the whole element every frame
     (which pins weak GPUs). Animating a layer's opacity is GPU-composited and cheap. */
  @keyframes grimoire-pulse {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }

  /* EVERYWHERE (all modes). */
  /* These descendant hooks only match where message rows exist, so they are inert
     in Game and safe to leave unwrapped. */

  /* the character name, glowing crimson rune-caps */
  [data-card-css] .mari-message-name {
    color: #ff5c8a;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 0.82rem;
    text-shadow: 0 0 8px rgba(255, 92, 138, 0.7), 0 0 16px rgba(168, 85, 247, 0.45);
  }
  /* header row and timestamp */
  [data-card-css] .mari-message-meta {
    align-items: baseline;
  }
  [data-card-css] .mari-message-timestamp {
    color: rgba(243, 215, 255, 0.5);
    font-variant: small-caps;
  }
  /* reshape, ring, and saturate the clickable avatar. For a non-clickable avatar,
     target .mari-message-avatar > div for that layout. */
  [data-card-css] .mari-message-avatar button {
    border-radius: 7px;
    box-shadow: 0 0 0 2px rgba(220, 38, 120, 0.6), 0 0 14px rgba(168, 85, 247, 0.5);
    filter: saturate(1.2) contrast(1.05);
  }
  /* glowing serif message text */
  [data-card-css] .mari-message-content {
    color: #f3d7ff;
    text-shadow: 0 0 2px rgba(168, 85, 247, 0.4);
    font-family: "Iowan Old Style", Georgia, "Times New Roman", serif;
  }

  /* ROLEPLAY */
  @chat-mode roleplay {
    /* the row itself, an arcane left edge. (data-grouped does not exist in
       roleplay, so there is no first-of-run trick here.) */
    [data-card-css] {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    /* roleplay wraps the avatar button in its own glow layer. Flatten it
       so only the eldritch ring above hugs the picture. */
    [data-card-css] .mari-message-avatar > div {
      box-shadow: none;
    }
    /* the visible bubble and a corner sigil */
    [data-card-css] .mari-message-bubble {
      background: linear-gradient(135deg, #1a0a24 0%, #2d0a2e 55%, #3a0a1e 100%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 4px 16px 16px 16px;
      position: relative;
      overflow: hidden;
      /* a steady outer halo. An element's own box-shadow is not clipped by its own
         overflow: hidden, so this bloom shows even though message content is clipped.
         (No inset here: the pulsing inset glow lives on the ::after, so a static inset
         would stack with it and over-brighten the inner glow.) */
      box-shadow: 0 0 16px rgba(190, 70, 190, 0.4);
    }
    /* the breathing inner glow. Animate a full-bleed overlay's OPACITY (cheap, GPU
       composited) instead of the bubble's box-shadow (expensive: a full repaint every
       frame). overflow: hidden clips a child's OUTER shadow, so the pulse rides the inset
       glow while the halo above stays steady. pointer-events keeps it click-through. */
    [data-card-css] .mari-message-bubble::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: inset 0 0 26px rgba(120, 0, 80, 0.65);
      animation: grimoire-pulse 4s ease-in-out infinite;
      will-change: opacity;
    }
    [data-card-css] .mari-message-bubble::before {
      content: "✦";
      position: absolute;
      top: 1px;
      right: 7px;
      font-size: 0.7rem;
      color: rgba(220, 38, 120, 0.55);
      text-shadow: 0 0 6px rgba(220, 38, 120, 0.9);
    }
    /* narration */
    [data-card-css] .mari-message-narrator {
      color: #c9a8ff;
      font-style: italic;
      opacity: 0.9;
    }
  }

  /* CONVERSATION */
  @chat-mode conversation {
    /* an arcane left edge on the first message of a run. [data-grouped] marks
       continuations from the same character, and it exists only in
       Conversation mode. */
    [data-card-css]:not([data-grouped]) {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css][data-grouped] {
      border-left: 2px solid transparent;
    }
    /* the Bubbles-layout bubble. In the Linear layout there is no bubble, so
       the EVERYWHERE row hooks above carry the theme instead. */
    [data-card-css] .mari-message-bubble {
      background: rgba(26, 10, 36, 0.92);
      border: 1px solid rgba(220, 38, 120, 0.4);
      border-radius: 1rem;
    }
    /* "(name) is typing..." (Linear layout) */
    [data-card-css] .mari-typing-text {
      color: #ff5c8a;
      font-style: italic;
      letter-spacing: 0.05em;
      text-shadow: 0 0 8px rgba(255, 92, 138, 0.6);
    }
    [data-card-css] .mari-typing-dots span {
      background: #ff5c8a;
      box-shadow: 0 0 6px rgba(255, 92, 138, 0.85);
    }

    /* the avatar-click profile popout. The popout card is the scope element,
       so target it with no space, and its children as descendants. */
    [data-card-css].mari-about-me-popout {
      background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #12081c 72%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 1.25rem;
    }
    [data-card-css] .mari-about-me-banner {
      background: linear-gradient(90deg, #a855f7, #dc2678);
    }
    [data-card-css] .mari-about-me-avatar > div {
      border-radius: 0.9rem;
      box-shadow: 0 0 0 2px #dc2678, 0 0 14px rgba(168, 85, 247, 0.5);
    }
    [data-card-css] .mari-about-me-status {
      box-shadow: 0 0 8px rgba(255, 92, 138, 0.9);
    }
    [data-card-css] .mari-about-me-name {
      color: #ffd7ef;
      text-shadow: 0 0 10px rgba(220, 38, 120, 0.6);
    }
    [data-card-css] .mari-about-me-handle {
      color: rgba(201, 168, 255, 0.8);
    }
    [data-card-css] .mari-about-me-presence {
      color: rgba(201, 168, 255, 0.7);
    }
    [data-card-css] .mari-about-me-box {
      background: rgba(168, 85, 247, 0.08);
      border: 1px solid rgba(220, 38, 120, 0.3);
      border-radius: 0.75rem;
    }
    [data-card-css] .mari-about-me-label {
      color: #dc2678;
      letter-spacing: 0.14em;
    }
    [data-card-css] .mari-about-me-badge {
      background: rgba(220, 38, 120, 0.18);
      color: #ffd7ef;
    }
    [data-card-css] .mari-about-me-text {
      color: #f3d7ff;
      font-family: "Iowan Old Style", Georgia, serif;
    }
  }

  /* GAME (set the mode to Chat) */
  @chat-mode game {
    /* Game has its own layout with no message bubbles. In Chat scope,
       [data-card-css] is the whole game surface, so theme the area broadly. */
    [data-card-css] {
      background-image: radial-gradient(120% 80% at 50% 0%, rgba(58, 10, 46, 0.5), transparent 70%);
    }
  }
</style>
```

**Wiersze użytkownika a wiersze postaci.** W zakresie **Exclusive** zapis `[data-card-css]` to własna wiadomość postaci, która jest zarazem `.mari-message-assistant`. Żeby ostylować także własne wiersze, przełącz się na zakres **Chat**. Tam `[data-card-css]` to cały obszar, a zapisy `[data-card-css] .mari-message-user` i `.mari-message-assistant` wybierają każdą ze stron.

Podmień kolory, znak w `content` i kroje pisma, a karta stanie się w pełni twoja.

## Tworzenie CSS karty z pomocą asystenta AI

Jeśli wolisz nie pisać CSS ręcznie, przekaż asystentowi AI ten prompt (tekst, który Marinara wysyła do AI). Uzupełnij zaznaczone miejsce koncepcją swojej postaci.

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
