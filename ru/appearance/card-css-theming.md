# Руководство по оформлению карточек через Card CSS

Это руководство объясняет, как задать карточке персонажа или персоны собственный вид в чате. Код CSS вставляется в поле **Creator Notes** (заметки автора) карточки, а Marinara Engine безопасно применяет его к сообщениям этого персонажа. Оформление всегда ограничено чатом и никогда не затрагивает остальное приложение.

## Перед началом

Несколько простых определений, которые нужны по всему руководству:

- **CSS** – язык, который задает цвета, шрифты, рамки и отступы на веб-странице.
- **Card CSS** – это код CSS, вставленный в карточку персонажа или персоны. Он оформляет сообщения именно этой карточки.
- **Card Theming** (оформление карточки) – элемент интерфейса, который включает Card CSS для чата.
- **Селектор** – часть правила CSS, которая выбирает, к каким элементам применить оформление.
- **Селектор потомка** использует пробел в значении "внутри". Запись `.a .b` находит `.b` внутри `.a`.
- **Каскад** – механизм CSS, который решает, какое правило побеждает, когда к одному элементу подходят сразу несколько.
- **Раскладка** – это то, как сообщения расположены на экране. В приложении Marinara есть построчная раскладка **Linear** и раскладка пузырями **Bubbles**.

## Быстрый старт

Оформление задается в двух местах. Сначала код CSS добавляется в карточку, затем включается в чате.

1. Откройте персонажа в редакторе **Character Editor** (редактор персонажа) и найдите поле **Creator Notes**. У персон такое же поле есть в редакторе **Persona Editor** (редактор персоны).
2. Вставьте блок `<style>` в поле **Creator Notes** и сохраните карточку.
3. Откройте чат с этим персонажем.
4. Откройте панель **Chat Settings** (настройки чата), затем раздел **Card Theming**.
5. Выберите режим **Exclusive** или **Chat**. Изначально стоит режим **Disabled**.

Сообщения персонажа должны измениться сразу же. Элемент **Card Theming** появляется только тогда, когда у активного персонажа в этом чате есть код CSS в поле **Creator Notes**. Код CSS одной лишь персоны его не показывает. Хотя бы у одного персонажа в чате должен быть собственный блок `<style>`. Если элемента не видно, проверьте, что блок `<style>` сохранился правильно.

Вот стартовый блок для вставки в **Creator Notes**:

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

Имя персонажа светится розовым, а текст становится нежно-розовым в любой раскладке. Правило для пузыря добавляет фиолетовый градиент с розовой рамкой. Одна оговорка: селектор `.mari-message-bubble` существует только в раскладке **Bubbles** и в режиме Roleplay. В режиме Conversation по умолчанию действует раскладка **Linear**, где элемента-пузыря нет, поэтому правило для пузыря там ничего не делает. Разницу объясняет замечание "Bubbles в сравнении с Linear" ниже.

**Быстрая проверка:** чтобы получить безусловный результат, возьмите правило ниже. Оно нацелено на текст сообщения, который есть в любом режиме и любой раскладке. Фон текста должен сразу стать ярко-розовым.

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## Как работает Card Theming

Когда активен персонаж с кодом CSS в поле **Creator Notes**, Marinara делает четыре вещи:

1. Читает все блоки `<style>` из поля **Creator Notes**.
2. Очищает код CSS и вырезает все опасное. Смотрите раздел "Что оформить нельзя" ниже.
3. Ограничивает область действия кода так, чтобы он доставал только до чата.
4. Вставляет код CSS так, чтобы его ограниченные селекторы перебивали собственное оформление сообщений в приложении.

Способ применения выбирается для каждого чата отдельно: панель **Chat Settings**, затем **Card Theming**. Режимов три.

| Режим | Что делает |
| --- | --- |
| **Disabled** (по умолчанию) | Card CSS выключен, оформление персонажей не применяется. |
| **Exclusive** | Код CSS каждого персонажа влияет только на его собственные сообщения. |
| **Chat** | Весь код Card CSS влияет на всю область чата, включая элементы интерфейса. |

Режим **Exclusive** подходит для групповых чатов, где у каждого персонажа свой вид. Режим **Chat** подходит для чатов с одним персонажем, когда карточка должна оформить всю область чата.

## Единственное важное правило об области действия

Marinara переписывает ваш код CSS так, чтобы он доставал только до чата. Как именно – зависит от режима.

- Режим **Chat** ограничивает все областью чата. Селектор `.mari-message-bubble` работает обычным образом, потому что находится внутри этой области.
- Режим **Exclusive** ограничивает все элементами сообщений самого персонажа. Именно они несут атрибут `data-card-css`. Класс на этом же элементе не подойдет как селектор потомка. Подходит только то, что лежит внутри.

Отсюда универсальное правило. Пишите `[data-card-css]`, чтобы оформить сам элемент сообщения. Для всего внутри него используйте обычные селекторы классов: `.mari-message-bubble`, `.mari-message-content`, `.mari-message-name`.

Запись `[data-card-css]` означает "сообщение этого персонажа" в режиме **Exclusive** и "область чата" в режиме **Chat**. Она работает в обоих. Селекторы внутренних элементов (те, что с пробелом) в обоих режимах ведут себя одинаково.

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

## Выбор режима через @chat-mode

Оберните правила в блоки `@chat-mode`, чтобы нацелиться на одну область. Код CSS вне любого блока действует везде.

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

Обычные запросы `@media` внутри блоков `@chat-mode` работают как всегда. Применяйте их для адаптивных раскладок.

Для режима **Game Mode** поддержка базовая. В режиме **Chat** код Card CSS достает до всей игровой области. Значит, `[data-card-css]` оформляет игровую область, а нацелиться на нее можно через `@chat-mode game`. У режима Game Mode своя раскладка. Зацепок для пузырей сообщений там нет, поэтому оформляйте широко – например, фон области. Оформление игрового повествования для каждого персонажа отдельно (режим Exclusive) пока недоступно.

## Что можно оформить

Структура чата – один и тот же каркас в режимах Roleplay и Conversation. Ниже перечислены элементы, на которые может нацеливаться Card CSS. Внутренние служебные классы – ненадежные зацепки: они меняются от версии к версии, поэтому держитесь классов `mari-*` и атрибутов `data-*` из таблицы.

| Селектор | На что нацелен |
| --- | --- |
| `[data-card-css]` | Вся строка сообщения (элемент области действия). Подходит для акцентов по левому краю или по краям, а в режиме **Chat** – для области чата. |
| `[data-card-css] .mari-message-bubble` | Видимый пузырь: фон, рамка, углы, тень. Есть в раскладке **Bubbles** и в режиме Roleplay. |
| `[data-card-css] .mari-message-content` | В раскладке **Bubbles** – сам элемент пузыря, включая фон, рамку и углы. В раскладке **Linear** – только текст сообщения. |
| `[data-card-css] .mari-message-name` | Отображаемое имя персонажа. |
| `[data-card-css] .mari-message-meta` | Строка заголовка, где находятся имя и время. |
| `[data-card-css] .mari-message-timestamp` | Время сообщения. |
| `[data-card-css] .mari-message-avatar` | Столбец с аватаром. |
| `[data-card-css] .mari-message-narrator` | Сообщения рассказчика (режим Roleplay). |
| `[data-card-css] .mari-message-user` | Ваши сообщения. Для сообщений персонажа берите `.mari-message-assistant`. |
| `[data-card-css] p`, `... span` | Абзацы и строчные элементы span внутри текста. |
| `[data-grouped]` | Сообщения-продолжения от того же персонажа. Только в режиме Conversation; строки в режиме Roleplay этот атрибут не несут никогда. Для первого сообщения в группе используйте `[data-card-css]:not([data-grouped])`. |

**Bubbles в сравнении с Linear.** Селектор `.mari-message-bubble` нацелен на раскладку **Bubbles**. В раскладке **Linear** элемента-пузыря нет, поэтому оформляйте вместо него `.mari-message-content` (текст) и `[data-card-css]` (строку). Раскладка меняется так: **Settings** (настройки), затем **Appearance**, затем раздел **Conversation Display**, затем **Chat Layout**. В режиме Roleplay пузырь есть всегда.

Вот пример оформленного пузыря для режима Conversation или Roleplay:

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

Пока персонаж пишет ответ, раскладка **Linear** режима Conversation показывает строку `(name) is typing...`. Ее тоже можно оформить.

| Селектор | На что нацелен |
| --- | --- |
| `[data-card-css] .mari-typing-text` | Надпись `(name) is typing...`. |
| `[data-card-css] .mari-typing-dots span` | Анимированные точки. |
| `[data-card-css] .mari-typing-indicator` | Сама строка. Она также несет имя в атрибуте `data-typing-name`. |

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

По умолчанию аватар круглый. Форму и обводку можно изменить чистым кодом CSS. Примеры ниже нацелены на кнопку аватара. Если в какой-то области аватар выводится без кнопки, примените ту же идею к запасному селектору `.mari-message-avatar > div` для этой раскладки. В режиме Roleplay кнопка лежит внутри дополнительного элемента `div` со свечением. Уберите свечение с этой обертки, если нужна только ваша обводка.

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

### Всплывающая панель профиля About Me (только Conversation)

В режиме Conversation щелчок по аватару открывает всплывающую панель профиля с разделом "about me" персонажа или персоны. Ее можно оформить той же областью действия `[data-card-css]`. Эта панель существует только в режиме Conversation. В режимах Roleplay и Game Mode ее нет. Оберните эти правила в `@chat-mode conversation`, если в карточке есть еще и код CSS для Roleplay или Game Mode. Свою панель могут оформить и карточки персонажей, и персоны – каждая из своего поля **Creator Notes**.

Одна оговорка для персон: элемент **Card Theming** появляется только тогда, когда у активного персонажа в чате есть код CSS в поле **Creator Notes**. Код CSS одной лишь персоны его не показывает. Поэтому, чтобы оформление панели персоны сработало, хотя бы у одного персонажа в чате тоже должен быть блок `<style>`.

| Селектор | На что нацелен |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | Сама панель (элемент области действия): фон, рамка, форма. |
| `[data-card-css] .mari-about-me-banner` | Полоса-баннер сверху (по умолчанию цвета имени). |
| `[data-card-css] .mari-about-me-avatar` | Обертка увеличенного аватара. Для самого круга берите `... > div`. |
| `[data-card-css] .mari-about-me-status` | Точка статуса активности (только у персонажей). |
| `[data-card-css] .mari-about-me-name` | Заголовок с отображаемым именем. |
| `[data-card-css] .mari-about-me-handle` | Вторая строка с @именем (показывается, когда имя для режима Conversation отличается). |
| `[data-card-css] .mari-about-me-presence` | Строка статуса или активности (только у персонажей). |
| `[data-card-css] .mari-about-me-box` | Блок-контейнер раздела About Me. |
| `[data-card-css] .mari-about-me-label` | Подпись `ABOUT ME`. |
| `[data-card-css] .mari-about-me-badge` | Плашка Default или Chat-specific. |
| `[data-card-css] .mari-about-me-text` | Готовый текст раздела about me. |

Панель профиля – это элемент области действия. Нацеливайтесь на нее записью `[data-card-css].mari-about-me-popout` (без пробела, тот же элемент). На вложенные элементы – селектором потомка, например `[data-card-css] .mari-about-me-name`. В режиме **Chat** ограничена вся область, поэтому там можно писать просто `.mari-about-me-name`.

Вот оформленная панель "about me". Вставьте код в поле **Creator Notes** персонажа или персоны, затем включите **Card Theming** в панели **Chat Settings**. Если вставляете в персону, помните про оговорку выше: у персонажа в чате тоже должен быть код CSS в поле **Creator Notes**, иначе элемент останется скрытым.

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

## Что оформить нельзя

Ради безопасности очистка вырезает следующее.

| Заблокировано | Почему |
| --- | --- |
| `url(https://...)` | Никаких сетевых запросов – это защита от слежки и утечек данных. Разрешено только `url(data:...)` для встроенных картинок и шрифтов. |
| `@font-face` с внешними адресами | Сохраняются только источники шрифтов вида `data:`. Название семейства переименовывается автоматически, чтобы оно не перебило шрифты приложения. |
| `@import` | Внешние таблицы стилей не подключаются. |
| Селекторы `:has()` | Не позволяют прощупывать элементы за пределами чата. |
| Вложенные правила и селекторы, которые начинаются с `~` или `+` | Удаляются, чтобы Card CSS не мог выйти за пределы своей области. Записывайте их как обычные селекторы. |
| Код HTML в `content:` | Декоративный текст разрешен, но символы `<` и `>` вырезаются, а длина текста ограничена 200 символами. `attr()` и `counter()` разрешены. |
| `position: fixed` | Переписывается в `position: absolute`, поэтому наложений на весь экран не будет. |
| `!important` | Вырезается, поэтому Card CSS не может продавить стили приложения. |
| Токены темы оформления приложения | Токены вида `--primary` и `--background` вырезаются, поэтому Card CSS не может перекрасить интерфейс приложения. |

Card CSS вставляется с ограниченными селекторами, которые по весу выше собственных стилей сообщений приложения. Он выигрывает по цветам, фонам, рамкам и шрифтам внутри чата. Он не влияет лишь на то, что вырезает очистка, на все за пределами чата и на стили, которые приложение задает прямо в элементе или через `!important`. Общий цвет и размер шрифта чата в панели **Settings** – как раз такой случай.

**Свои шрифты.** Встройте шрифт через адрес `data:` в кодировке base64 или возьмите системный либо веб-безопасный набор.

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

```css
font-family: "Courier New", Consolas, monospace;
```

## Exclusive в сравнении с Chat: выбор области действия

- В режиме **Exclusive** запись `[data-card-css]` означает сообщения этого персонажа. Он лучше всего подходит для групповых чатов и отдельного вида у каждого персонажа. Код CSS, нацеленный на элементы внутри сообщения, работает так же, как в режиме **Chat**.
- В режиме **Chat** запись `[data-card-css]` означает всю область чата. Он лучше всего подходит для карточек для чата один на один, когда нужно оформить фон или атмосферу, а не только пузыри сообщений.

Пишите селекторы вида `[data-card-css] .mari-message-...`, и карточка будет правильно работать в обоих режимах.

## Советы

1. Оформляйте пузырь через `.mari-message-bubble`, а не через `[data-card-css]`. Второе – это строка на всю ширину, поэтому фон на ней почти не виден.
2. Берите цвета `rgba()`, чтобы они вписывались и в светлую, и в темную тему оформления.
3. Не делайте анимацию навязчивой. На слабых устройствах `transition` лучше тяжелой `animation`.
4. Для телефонов используйте `@media (max-width: 768px)`.
5. Не опирайтесь на служебные классы. Надежны только описанные здесь зацепки `mari-*`.

## Витрина: Eldritch Grimoire

Это намеренно избыточная карточка. Она задействует все описанные зацепки во всех режимах и показывает:

- светящееся имя рунными заглавными и оформленный текст с засечками
- аватар другой формы с обводкой, а также метки времени капителью
- знак по краю строки сообщения
- анимированный пузырь для режима Roleplay с руной в углу и оформленное повествование
- пузырь для режима Conversation и жуткий индикатор набора текста
- полностью оформленную панель профиля по щелчку на аватаре
- игровую область

Вставьте код целиком в поле **Creator Notes**, затем включите **Card Theming** в панели **Chat Settings**. Он оформляет сообщения в режимах Roleplay и Conversation, панель профиля в режиме Conversation и область в режиме Game Mode (для игры выберите режим **Chat**). Части разделены через `@chat-mode`, так что каждый режим получает ровно те зацепки, которые у него есть. Все безопасно для очистки.

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

**Ваши строки в сравнении со строками персонажа.** В области действия **Exclusive** запись `[data-card-css]` – это собственное сообщение персонажа, у которого есть и класс `.mari-message-assistant`. Чтобы оформить и свои строки, возьмите область **Chat**. Там `[data-card-css]` – это вся область, а `[data-card-css] .mari-message-user` и `.mari-message-assistant` выбирают каждую сторону.

Поменяйте цвета, символ в `content` и шрифты – и оформление станет вашим.

## Создание Card CSS с помощью ассистента ИИ

Если писать код CSS вручную не хочется, передайте ассистенту ИИ промпт ниже. Промпт – это текст, который отправляется модели ИИ. Впишите в отмеченное место свою задумку персонажа.

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
