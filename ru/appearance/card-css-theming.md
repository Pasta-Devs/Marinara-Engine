# Руководство по оформлению карточек через Card CSS

Card CSS задает карточке персонажа или персоны собственный вид в чате. Код CSS вставляется в поле **Creator Notes** (заметки автора) карточки, и Marinara применяет его к сообщениям этого персонажа. Он может оформлять только чат и никогда не затрагивает остальное приложение. Это руководство – для авторов карточек.

## Перед началом

Термины, которые используются в этом руководстве:

- **CSS** задает цвета, шрифты, рамки и отступы.
- **Card CSS** – это код CSS, вставленный в карточку. Он оформляет сообщения этой карточки.
- **Card Theming** (оформление карточки) – настройка каждого чата, которая включает Card CSS. Она находится в **Chat Settings → Characters** (настройки чата → персонажи), а в режиме Game – в **Party** (отряд).
- **Селектор** – часть правила CSS, которая выбирает, какие элементы оформлять. Пробел между двумя селекторами означает "внутри", поэтому `.a .b` находит `.b` внутри `.a`.
- **Раскладка** – это то, как расположены сообщения. В режиме Conversation есть построчная раскладка **Linear** и раскладка пузырями **Bubbles**.

## Быстрый старт

Вот стартовый блок, который нужно вставить на шаге 2:

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

Код CSS добавляется в карточку, а затем включается в чате.

1. Откройте персонажа в редакторе Character Editor и найдите поле **Creator Notes**. У персон такое же поле есть в редакторе Persona Editor.
2. Вставьте стартовый блок в **Creator Notes** и сохраните карточку.
3. Откройте чат с этим персонажем.
4. Откройте **Chat Settings**, затем **Characters** (**Party** в режиме Game).
5. Выберите **Exclusive** или **Chat** в **Card Theming**. Изначально выбрано **Disabled**.

Сообщения персонажа меняются сразу.

Если не получилось: кнопки **Disabled**, **Exclusive** и **Chat** появляются, только когда у активного персонажа в чате есть код CSS в поле **Creator Notes**. Код CSS одной лишь персоны их не показывает, поэтому для оформления персоны в чате тоже нужен хотя бы один персонаж с блоком `<style>`. Проверьте, что ваш блок `<style>` сохранился. В чатах Roleplay переключатель **Color Character Names in Text** (окрашивать имена персонажей в тексте) находится в **Characters**, под **Add Character** (добавить персонажа).

Имя светится розовым, а текст становится нежно-розовым в любой раскладке. Правило для пузыря добавляет фиолетовый градиент с розовой рамкой. `.mari-message-bubble` есть только в раскладке **Bubbles** и в режиме Roleplay, поэтому в раскладке **Linear**, которая в режиме Conversation стоит по умолчанию, правило для пузыря ничего не делает.

Для проверки, результат которой невозможно не заметить, возьмите это правило. Оно нацелено на текст сообщения, который есть в любом режиме и любой раскладке, и делает его фон ярко-розовым.

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## Как работает Card Theming

Когда активен персонаж с кодом CSS в поле **Creator Notes**, Marinara читает все блоки `<style>`, вырезает все опасное (смотрите [Что оформить нельзя](#what-you-cannot-style)), ограничивает область действия CSS так, чтобы он доставал только до чата, и вставляет его так, чтобы его селекторы перебивали собственное оформление сообщений в приложении.

Способ применения выбирается для каждого чата в **Chat Settings → Characters** (**Party** в режиме Game).

| Режим | Что делает |
| --- | --- |
| **Disabled** (по умолчанию) | Card CSS выключен. |
| **Exclusive** | Код CSS каждого персонажа влияет только на его собственные сообщения. |
| **Chat** | Весь код Card CSS влияет на всю область чата, включая элементы интерфейса. |

**Exclusive** подходит для групповых чатов, где у каждого персонажа свой вид. **Chat** подходит для карточек для чата один на один, которые оформляют всю поверхность чата, например фон.

## Правило области действия

Marinara переписывает ваш код CSS так, чтобы он доставал только до чата.

- В режиме **Chat** все ограничено областью чата. `[data-card-css]` означает область чата.
- В режиме **Exclusive** все ограничено каждым элементом сообщения вашего персонажа. `[data-card-css]` означает сообщение этого персонажа.

Поэтому пишите `[data-card-css]`, чтобы оформить сам элемент сообщения, и обычные селекторы классов для всего, что лежит внутри него, например `.mari-message-bubble`, `.mari-message-content` и `.mari-message-name`. Класс на том же элементе не может подойти как потомок. Пишите селекторы вида `[data-card-css] .mari-message-...`, и карточка будет работать в обоих режимах.

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

В области действия **Exclusive** `[data-card-css]` – это собственное сообщение персонажа, у которого есть и класс `.mari-message-assistant`. Чтобы оформить и свои строки, используйте область **Chat**. Там `[data-card-css] .mari-message-user` и `.mari-message-assistant` выбирают каждую сторону.

## Выбор режима через @chat-mode

Оберните правила в `@chat-mode roleplay`, `@chat-mode conversation` или `@chat-mode game`, чтобы нацелиться на одну область. Код CSS вне любого блока действует везде. Обычные запросы `@media` внутри этих блоков работают.

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

Для режима Game Mode поддержка базовая. В режиме **Chat** код Card CSS достает до всей игровой области, поэтому `[data-card-css]` оформляет игровую область. У Game своя раскладка и нет пузырей сообщений, поэтому оформляйте широко, например фон области. Оформление игрового повествования для каждого персонажа отдельно (**Exclusive**) пока недоступно.

## Что можно оформить

У режимов Roleplay и Conversation один и тот же каркас. Держитесь классов `mari-*` и атрибутов `data-*` из таблицы ниже. Другие классы меняются от версии к версии.

| Селектор | На что нацелен |
| --- | --- |
| `[data-card-css]` | Вся строка сообщения (элемент области действия). Подходит для акцентов по краям, а в режиме **Chat** – для области чата. |
| `[data-card-css] .mari-message-bubble` | Видимый пузырь: фон, рамка, углы, тень. Есть в раскладке **Bubbles** и в режиме Roleplay. |
| `[data-card-css] .mari-message-content` | В раскладке **Bubbles** – сам элемент пузыря. В раскладке **Linear** – только текст сообщения. |
| `[data-card-css] .mari-message-name` | Отображаемое имя персонажа. |
| `[data-card-css] .mari-message-meta` | Строка заголовка с именем и временем. |
| `[data-card-css] .mari-message-timestamp` | Время сообщения. |
| `[data-card-css] .mari-message-avatar` | Столбец с аватаром. |
| `[data-card-css] .mari-message-narrator` | Сообщения рассказчика (Roleplay). |
| `[data-card-css] .mari-message-user` | Сообщения пользователя. Для сообщений персонажа используйте `.mari-message-assistant`. |
| `[data-card-css] p`, `[data-card-css] span` | Абзацы и строчные элементы span внутри текста. |
| `[data-grouped]` | Сообщения-продолжения от того же персонажа. Только в режиме Conversation. Для первого сообщения в группе используйте `[data-card-css]:not([data-grouped])`. |

Чтобы сменить раскладку, откройте **Settings → Appearance → Conversation** (настройки → оформление → Conversation), затем **Conversation Display**, затем **Chat Layout**. В раскладке **Linear** пузыря нет, поэтому оформляйте `.mari-message-content` (текст) и `[data-card-css]` (строку).

Оформленный пузырь:

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

### Индикатор набора текста

В раскладке **Linear** режима Conversation, пока персонаж пишет, показывается строка "(name) is typing...".

| Селектор | На что нацелен |
| --- | --- |
| `[data-card-css] .mari-typing-text` | Надпись. |
| `[data-card-css] .mari-typing-dots span` | Анимированные точки. |
| `[data-card-css] .mari-typing-indicator` | Сама строка. Она несет имя в атрибуте `data-typing-name`. |

```css
[data-card-css] .mari-typing-text {
  color: #ff66cc;
  font-style: italic;
}
[data-card-css] .mari-typing-dots span {
  background: #ff66cc;
}
```

### Аватар

По умолчанию аватар круглый. Пример нацелен на кнопку аватара, по которой можно нажать. Для аватара без кнопки используйте `.mari-message-avatar > div`. В режиме Roleplay кнопка лежит внутри дополнительной обертки `div` со свечением. Уберите с нее свечение, если нужна только ваша обводка.

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

### Всплывающая панель профиля About Me (только Conversation)

В режиме Conversation щелчок по аватару открывает всплывающую панель профиля с разделом "about me". Карточки персонажей и персоны могут оформить свою панель. В режимах Roleplay и Game ее нет, поэтому оберните эти правила в `@chat-mode conversation`, если в карточке есть оформление и для других режимов.

Карточка панели – это элемент области действия. Нацеливайтесь на нее записью `[data-card-css].mari-about-me-popout` (без пробела, тот же элемент), а на вложенные элементы – как на потомков. В режиме **Chat** можно писать просто `.mari-about-me-name`.

| Селектор | На что нацелен |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | Карточка панели: фон, рамка, форма. |
| `[data-card-css] .mari-about-me-banner` | Полоса-баннер сверху (по умолчанию цвета имени). |
| `[data-card-css] .mari-about-me-avatar` | Обертка увеличенного аватара. Для круга используйте `... > div`. |
| `[data-card-css] .mari-about-me-status` | Точка статуса присутствия (только у персонажей). |
| `[data-card-css] .mari-about-me-name` | Заголовок с отображаемым именем. |
| `[data-card-css] .mari-about-me-handle` | Вторая строка с @именем, которая показывается, когда отображаемое имя для Convo отличается. |
| `[data-card-css] .mari-about-me-presence` | Строка статуса или активности (только у персонажей). |
| `[data-card-css] .mari-about-me-box` | Блок-контейнер раздела About Me. |
| `[data-card-css] .mari-about-me-label` | Подпись "ABOUT ME". |
| `[data-card-css] .mari-about-me-badge` | Плашка Default или Chat-specific. |
| `[data-card-css] .mari-about-me-text` | Основной текст раздела about me. |

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

## Что оформить нельзя

Ради безопасности очистка вырезает следующее.

| Заблокировано | Почему |
| --- | --- |
| `url(https://...)` | Никаких сетевых запросов – это защита от слежки и утечек данных. Разрешено только `url(data:...)` для встроенных картинок и шрифтов. |
| `@font-face` с внешними адресами | Сохраняются только источники шрифтов вида `data:`. Название семейства переименовывается, чтобы оно не перебило шрифты приложения. |
| `@import` | Внешние таблицы стилей не подключаются. |
| Селекторы `:has()` | Так они не могут прощупывать элементы за пределами чата. |
| Вложенные правила и селекторы, которые начинаются с `~` или `+` | Удаляются, чтобы Card CSS не мог выйти за пределы своей области. Пишите обычные селекторы. |
| Код HTML в `content:` | Декоративный текст разрешен, но символы `<` и `>` вырезаются, а длина текста ограничена 200 символами. `attr()` и `counter()` разрешены. |
| `position: fixed` | Переписывается в `position: absolute`, поэтому наложений на весь экран не будет. |
| `!important` | Вырезается, поэтому Card CSS не может продавить стили приложения. |
| Токены темы оформления приложения | Токены вида `--primary` и `--background` вырезаются, поэтому Card CSS не может перекрасить интерфейс приложения. |

Внутри чата Card CSS по весу выше собственных стилей сообщений приложения для цветов, фонов, рамок и шрифтов. Он не может перебить то, что вырезает очистка, все за пределами чата и стили, которые приложение задает прямо в элементе или через `!important`. Один из примеров – общий цвет и размер шрифта чата в **Settings** (настройки).

Чтобы использовать свой шрифт, встройте его через URI `data:` в кодировке base64 или возьмите системный набор шрифтов.

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

## Советы

1. Оформляйте пузырь через `.mari-message-bubble`, а не через `[data-card-css]`. Строка занимает всю ширину, поэтому фон на ней почти не виден.
2. Берите цвета `rgba()`, чтобы они вписывались и в светлую, и в темную тему оформления.
3. Не делайте анимацию навязчивой. На слабых устройствах лучше `transition`, чем тяжелая `animation`. Анимируйте `opacity`, а не `box-shadow`: его анимация вызывает перерисовку на каждом кадре.
4. Для телефонов используйте `@media (max-width: 768px)`.
5. Не опирайтесь на служебные классы. Надежны только описанные зацепки `mari-*`.

## Витрина: Eldritch Grimoire

Этот пример задействует основные зацепки во всех режимах: светящиеся имена, оформленный текст с засечками, аватар с обводкой, анимированный пузырь Roleplay с руной в углу, пузырь Conversation, жуткий индикатор набора текста и игровую область. Вставьте его в **Creator Notes**, затем выберите режим Card Theming в **Chat Settings → Characters** (**Party** в режиме Game). Для игровой области выберите **Chat**. Поменяйте цвета, символ в `content` и шрифты, чтобы оформление стало вашим.

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

## Создание Card CSS с помощью ассистента ИИ

Чтобы не писать CSS вручную, передайте ассистенту ИИ этот промпт. Впишите в отмеченное место свою задумку персонажа.

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

## Смежные руководства

- [Настройки оформления](appearance-settings.md)
- [Собственные темы оформления на CSS (Theme Library)](custom-css-themes.md)
- [Создание и редактирование персонажей](../characters/creating-and-editing-characters.md)
