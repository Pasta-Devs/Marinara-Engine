# Создание личных расширений

Это руководство показывает, как написать расширение Browser Extension или Server Extension, упаковать его и импортировать. Оно рассчитано на тех, кто умеет писать на JavaScript. О проверке и запуске расширения читайте в руководстве [Личные расширения](personal-extensions.md).

Код, который вы написали и импортировали сами, считается **External Extension** (внешним расширением). Сначала он отключен и не может выполняться, пока вы не проверите его и не одобрите точный хеш SHA-256.

## Перед началом

Расширения External Extensions скрыты, пока вы не выполните оба защитных шага из раздела [Разрешение импорта сторонних расширений](personal-extensions.md#allow-third-party-imports): `ENABLE_EXTERNAL_EXTENSIONS=true` в файле `.env` и переключатель **Allow third-party extension imports** (разрешить импорт сторонних расширений) в разделе **Settings → Advanced → Danger Zone** (настройки → дополнительно → опасная зона).

Для импорта расширений и управления ими также нужен доступ через localhost или секрет администратора. Если вы работаете с телефона, по адресу LAN или через удаленный браузер, задайте `ADMIN_SECRET` на сервере и введите то же значение в **Settings → Advanced → Admin Access** (доступ администратора).

Выберите среду с минимальными правами, которых достаточно для задачи:

| Среда | Для чего подходит | Важная граница |
| --- | --- | --- |
| Sandboxed Browser Extension | Закрытое состояние, контекст активного чата, кнопки, действия меню и панели, которые отрисовывает Marinara | Нет доступа к DOM приложения Marinara, файлам cookie, хранилищу браузера, сети и произвольному HTML |
| Server Extension | Фоновая логика, которой нужны управляемые таймеры и закрытое хранилище расширения | Отдельная песочница ОС; нет доступа к файлам и секретам Marinara, сети, дочерним процессам и нативным модулям |
| Full-page External Extension | Старый код, которому нужны страница Marinara или API с тем же origin | Нет песочницы; используйте только для точно проверенного кода, которому вы полностью доверяете |

Расширения Browser Extensions работают на всех поддерживаемых платформах. Расширениям Server Extensions нужен Seatbelt в macOS или Bubblewrap в Linux. Перед выбором Server Extension сверьтесь с [таблицей платформ](personal-extensions.md#platform-support).

## Быстрый старт Browser Extension

Создайте папку с такой структурой:

```text
Hello Panel/
  manifest.json
  extension.js
  extension.css
```

Используйте такой файл `manifest.json`:

```json
{
  "kind": "marinara.personal-extension",
  "version": 1,
  "config": {
    "name": "Hello Panel",
    "version": "1.0.0",
    "description": "A minimal sandboxed Browser Extension.",
    "runtime": "client",
    "capabilities": [],
    "jsPath": "extension.js",
    "cssPath": "extension.css"
  }
}
```

Используйте такой файл `extension.js`:

```js
const saved = await marinara.storage.get();
let count = Number(saved.count) || 0;

const statusElement = () => ({
  kind: "text",
  text: `Button pressed ${count} time${count === 1 ? "" : "s"}.`,
});
const elements = () => [
  statusElement(),
  { kind: "button", id: "increment", label: "Count one" },
];

const panel = marinara.ui.registerContribution({
  id: "hello-panel",
  kind: "panel",
  label: "Hello Panel",
  description: "Minimal Personal Extension example",
  icon: "hand",
  elements: elements(),
  onEvent: async ({ elementId }) => {
    if (elementId !== "increment") return;
    count += 1;
    await marinara.storage.patch({ count });
    panel.update({ elements: elements() });
    marinara.ui.showWindow({ title: "Hello Panel", elements: [statusElement()] });
  },
});

marinara.log.info("Hello Panel loaded");
marinara.onCleanup(() => panel.remove());
```

Используйте такой файл `extension.css`, чтобы оформить ограниченное окно iframe, которое открывает кнопка:

```css
[data-ext-root] {
  font-size: 16px;
}
```

Затем импортируйте и запустите расширение:

1. Откройте **Settings → Addons → External Extensions** (дополнения → внешние расширения).
2. Выберите **Import Extension Folder** (импортировать папку расширения) и папку `Hello Panel` либо упакуйте папку в ZIP и импортируйте его через **Import Extension File** (импортировать файл расширения).
3. Откройте отключенный черновик и проверьте его манифест и JavaScript.
4. Выберите **Review and Run** (проверить и запустить) и одобрите точно показанный хеш.
5. Откройте меню Extensions и выберите **Hello Panel**.

Этот же готовый к запуску пример находится в репозитории по пути `docs/examples/personal-extensions/browser-minimal/`.

## Справочник Browser API

Расширения Browser Extensions в песочнице получают один замороженный глобальный объект с именем `marinara`:

| API | Назначение |
| --- | --- |
| `runtime`, `version` | Имя среды (`client`) и текущая версия Browser API |
| `extensionId`, `extensionName`, `capabilities` | Идентификаторы и одобренные возможности именно этой ревизии расширения |
| `log.debug/info/warn/error(...)` | Запись помеченного сообщения в консоль браузера |
| `storage.get()` | Чтение закрытого объекта JSON этого расширения |
| `storage.patch(object)` | Объединение значений с закрытым хранилищем и возврат нового объекта |
| `storage.delete()` | Очистка закрытого хранилища |
| `context.get()` | Чтение текущего снимка активного чата |
| `context.subscribe(listener)` | Получение изменений контекста; возвращает функцию отмены подписки |
| `ui.registerContribution(options)` | Добавление безопасной кнопки, пункта меню Extensions или панели, которую отрисовывает Marinara |
| `ui.showWindow(options)` | Открытие ограниченного окна iframe |
| `dice.registerFormat(options)` | Обучение `/roll` новой записи; Marinara бросает указанные в ней кости |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | Управляемые таймеры, которые удаляются при остановке расширения |
| `onCleanup(callback)` | Регистрация дополнительной логики очистки |

Для обычного интерфейса используйте [панели, которые отрисовывает Marinara](#add-a-marinara-rendered-panel), для поведения с учетом чата – [контекст активного чата](#use-active-chat-context), а для собственной записи `/roll` – [форматы бросков кубиков](#add-a-dice-format). Состояние расширения должно находиться в `marinara.storage`, а не в хранилище браузера.

`showWindow({ title, elements, onEvent, onClose })` возвращает дескриптор с методами `update({ title?, elements? })` и `close()`. CSS пакета оформляет эти окна iframe в песочнице; элементы, которые отрисовывает хост, всегда используют тему и элементы управления самого приложения Marinara.

В безопасной среде Browser нет API DOM и сети. Не обходите эту границу. Если полезной возможности не хватает, запросите узкую возможность на стороне хоста, а не переходите по умолчанию на доступ ко всей странице.

### Возможности контекста

Объявите необязательный доступ к записям в `config.capabilities`:

```json
{
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` заполняет ограниченный набор полей карточек персонажей в активном чате.
- `read_active_persona` заполняет ограниченный набор полей выбранной персоны.
- `full_page_access` выбирает среду совместимости без песочницы и доступен только расширениям External Extensions.

При изменении возможностей меняется хеш исполняемого кода, расширение отключается и требует новой проверки.

<a id="what-a-browser-extension-can-do"></a>

### Что может расширение Browser Extension

Расширение Browser Extension работает в отдельном Worker внутри изолированного iframe с непрозрачным источником (opaque origin). Ему недоступны страница приложения Marinara, DOM, файлы cookie, хранилище браузера, API источника и сеть. Его возможности – закрытое хранилище расширения, ведение журнала, управляемые таймеры, регистрация очистки, ограниченные окна, безопасные слоты для элементов интерфейса хоста и снимок активного чата и идентификаторов персонажей только для чтения. Отдельные поля активных карточек персонажей или выбранной персоны расширение получает, только если соответствующие разрешения объявлены и одобрены.

Расширения могут добавлять действия на верхнюю или боковую панель, пункты меню Extensions и постоянные панели справа через `marinara.ui.registerContribution(...)`. Marinara отрисовывает эти элементы в активной теме оформления и только фиксированным набором элементов управления: заголовки, текст, предварительно отформатированный вывод, кнопки, текстовые поля, раскрывающиеся списки, переключатели, ползунки, выбор цвета и отступы. Расширение передает содержимое и состояние, но никогда не HTML, CSS, адреса URL, компоненты React или обработчики событий хоста.

Эти возможности интерфейса и правила одинаковы для любого расширения Browser Extension в песочнице, откуда бы оно ни пришло. Импортированное стороннее (External) расширение работает в этой безопасной среде, если только его пакет прямо не запрашивает **Full page access** (полный доступ к странице) или не использует описанный ниже формат `marinara.extension` времен до песочницы.

### Оценка числа токенов в тексте

Личные расширения Browser, Full page access и Server могут использовать встроенную в Marinara функцию оценки числа токенов в тексте:

```js
const tokens = marinara.estimateTextTokens(text);
```

Сигнатура функции – `estimateTextTokens(text: string): number`. Она также описана в типе `PersonalExtensionTokenApi`, который экспортируется из `@marinara-engine/shared`. Вызов синхронный и не требует дополнительных возможностей. Он возвращает не зависящую от модели оценку числа токенов Marinara, а не точный результат токенизатора. В старых версиях Engine перед вызовом проверьте `typeof marinara.estimateTextTokens === "function"`.

<a id="add-a-marinara-rendered-panel"></a>

### Добавление панели, которую отрисовывает Marinara

```js
const panel = marinara.ui.registerContribution({
  id: "weather-settings",
  kind: "panel",
  label: "Weather controls",
  description: "Tune a weather scene without leaving Marinara.",
  icon: "sparkles",
  elements: [
    { kind: "heading", text: "Atmosphere" },
    {
      kind: "select",
      id: "weather",
      label: "Weather",
      value: "rain",
      options: [
        { value: "rain", label: "Rain" },
        { value: "snow", label: "Snow" },
        { value: "aurora", label: "Aurora" },
      ],
    },
    { kind: "slider", id: "intensity", label: "Intensity", min: 0, max: 100, value: 60 },
    { kind: "toggle", id: "lightning", label: "Lightning", checked: false },
    { kind: "color", id: "tint", label: "Tint", value: "#6d8cff" },
    { kind: "button", id: "apply", label: "Apply" },
  ],
  onActivate: async () => {
    const settings = await marinara.storage.get();
    // Update the panel when stored state should be reflected in the controls.
  },
  onEvent: async ({ elementId, values }) => {
    if (elementId !== "apply") return;
    await marinara.storage.patch(values);
  },
});

marinara.onCleanup(() => panel.remove());
```

Значение `kind: "button"` создает компактное действие, а `kind: "menu-item"` – действие в меню Extensions. Значение `kind: "command"` создает пункт Command Center, который активирует существующий элемент интерфейса из той же ревизии расширения. Команде обязательно нужен `targetContributionId`, и она не может использовать `onActivate` или `onEvent`.

```js
marinara.ui.registerContribution({
  id: "open-weather",
  kind: "command",
  label: "Open weather controls",
  targetContributionId: "weather-settings",
});
```

Хост находит цель команды, только если у цели тот же идентификатор расширения и тот же хеш содержимого. Отсутствующие цели, цели из другого расширения и цели из устаревшей ревизии отклоняются. По умолчанию кнопки используют `surface: "top-bar"`. Вместо этого они могут выбрать `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents` или `settings`, задав `position` как `header`, `before-content` или `after-content`. Поле `icon` принимает любое поддерживаемое Marinara имя значка Lucide в kebab-case. Оба вида действий вызывают `onActivate`. Панель (`panel`) вызывает `onActivate` при открытии, а ее кнопки вызывают `onEvent` с текущими значениями всех элементов управления панели. Возвращаемый дескриптор поддерживает обновления в зависимости от вида: `button` принимает `label`, `description`, `icon`, `surface` и `position`; `menu-item` – `label`, `description` и `icon`; `panel` – `label`, `description`, `icon` и `elements`. Все дескрипторы поддерживают `remove()`. В идентификаторах допустимы буквы, цифры, `.`, `_` и `-`.

Например, этот код помещает нативное действие над содержимым панели Presets:

```js
marinara.ui.registerContribution({
  id: "preset-helper",
  kind: "button",
  label: "Preset helper",
  description: "Run the preset helper",
  icon: "list-sparkles",
  surface: "presets",
  position: "before-content",
  onActivate: () => {
    // Run extension behavior here.
  },
});
```

Сложные инструменты могут строить многошаговый интерфейс, обновляя элементы панели после события. Храните состояние приложения в `marinara.storage` и не кодируйте его в разметке.

<a id="use-active-chat-context"></a>

### Использование контекста активного чата

Browser Extension API версии 5 открывает непрозрачные идентификаторы чата, который сейчас показан в Marinara:

```js
const renderForContext = async ({ chatId, characterId, characterIds, personaId, characters, persona }) => {
  if (!chatId) return; // Home, a library, or another surface without an active chat.

  const storage = await marinara.storage.get();
  const tab = storage.tabsByChat?.[chatId];

  // characterId is available only for a single-Character chat.
  // Use characterIds for group chats.
  marinara.log.debug("Loaded Notepad tab", {
    chatId,
    characterId,
    characterIds,
    personaId,
    characterNames: characters.map((character) => character.name),
    personaName: persona?.name ?? null,
    tab,
  });
};

const unsubscribe = marinara.context.subscribe(renderForContext);
marinara.onCleanup(unsubscribe);
```

Метод `marinara.context.get()` возвращает тот же текущий снимок без подписки. Когда активного чата нет, `chatId` равен `null`, а `characterIds` пуст. Поле `characterId` заполняется, только если в чате участвует ровно один персонаж; групповые чаты перечисляют всех участников в `characterIds` и оставляют `characterId` равным `null`. Поле `personaId` заполняется, только если разрешение `read_active_persona` одобрено.

Идентификаторы чата и персонажей доступны всегда, и по ним расширение может разделять собственное закрытое хранилище. Для полей записей нужно одно или оба необязательных разрешения в манифесте расширения:

```json
{
  "runtime": "client",
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` заполняет `characters` карточками, которые участвуют в активном чате.
- `read_active_persona` заполняет `persona` персоной, выбранной в активном чате.

Без разрешения соответствующее значение остается `[]` или `null`. Marinara показывает каждое запрошенное разрешение в блоке **Requested access** (запрошенный доступ) и еще раз в окне одобрения точного хеша. Добавление или удаление разрешения меняет хеш исполняемого кода, отключает расширение и требует нового одобрения.

Снимок персонажа содержит только `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe` и `conversationDisplayName`. Снимок персоны содержит только `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe` и `conversationDisplayName`. Длина текста ограничивается до передачи через мост песочницы.

Marinara никогда не передает сообщения, заметки автора, системные промпты, инструкции после истории, комментарии, пути к аватарам, полные библиотеки персонажей и персон, необъявленные поля, метаданные чата, дескрипторы базы данных, доступ к сети и операции изменения данных. Обновления контекста остаются привязаны к одобренному хешу кода и приходят при смене активного чата, его списка персонажей или выбранной персоны.

<a id="add-a-dice-format"></a>

### Добавление формата бросков кубиков

Browser Extension API версии 6 позволяет расширению научить `/roll` собственной записи бросков, например для пула повествовательных костей. Расширение читает запись и указывает, какие кости бросить; Marinara бросает их своим безопасным генератором и возвращает выпавшие грани. Расширение может определить смысл броска, но никогда не то, что выпало.

```js
const SYMBOLS = { boost: [0, 0, 1, 1, 2, 1], setback: [0, 0, -1, -1, 0, 0] };

const format = marinara.dice.registerFormat({
  id: "narrative",
  label: "Narrative dice",
  // Return null for notation this format does not read.
  parse(notation) {
    const terms = [...notation.matchAll(/(\d+)\s*(boost|setback)/g)];
    if (!terms.length) return null;
    const kinds = terms.flatMap(([, count, kind]) => Array(Number(count)).fill(kind));
    return { dice: kinds.map(() => 6), kinds };
  },
  // rolls[i] is the face Marinara threw for dice[i]; plan is what parse returned.
  read({ notation, dice, rolls, plan }) {
    const net = rolls.reduce((sum, face, i) => sum + SYMBOLS[plan.kinds[i]][face - 1], 0);
    return { total: net, text: net > 0 ? `${net} success` : "failure" };
  },
});
marinara.onCleanup(() => format.remove());
```

После этого `/roll 2 boost 1 setback` публикует грани, итог и текст расширения с названием формата. Обычная запись, например `2d6` или `4d6kh3`, всегда обрабатывается как прежде и никогда не передается расширению. Другая запись по очереди передается каждому зарегистрированному формату; бросок выполняет первый, чей `parse` вернет кости.

- `parse(notation)` возвращает `null` или `{ dice: [sides, ...] }` с числом костей от 1 до 100 и числом граней от 2 до 1 000. Остальные данные объекта остаются в песочнице и передаются обратно в `read` как `plan`.
- `read(...)` возвращает `{ total, text?, kept? }`: конечное число, обычный текст длиной до 200 символов и необязательный список позиций учтенных костей в порядке возрастания. Остальные `/roll` зачеркивает.
- Каждое расширение может зарегистрировать 4 формата. Длина записи – не более 100 символов. `parse` и `read` могут быть асинхронными, но каждый должен ответить за 2 секунды.
- Текст показывается как обычный текст: ссылки, изображения, форматирование и HTML экранируются.

Форматы бросков кубиков работают с `/roll` в браузере. Инструмент `roll_dice` Game Master и другие броски на сервере продолжают использовать встроенную запись и кости набора правил. В старых версиях Engine перед вызовом проверьте `typeof marinara.dice?.registerFormat === "function"`.

### Старые расширения и расширения с полным доступом к странице

Управление погодой, редакторы промптов и другие крупные рабочие сценарии – вполне подходящие случаи для элементов интерфейса. Их безопасные версии могут запускаться из меню или кнопкой на верхней панели и работать через панели, которые обновляются по шагам. Существующие пакеты, которые накладывают свои слои на DOM, ищут элементы по селекторам CSS приложения Marinara, обходят внутренние структуры React или обращаются к маршрутам `/api` того же источника, нельзя импортировать в безопасную среду без изменений.

Элементы интерфейса дают интерфейс, а не общие права. API контекста всегда открывает идентификаторы активного чата и персонажей и может открыть только объявленные поля активных записей, перечисленные выше. Функциям, которым нужны сообщения, пресеты, лорбуки, необъявленные данные персонажей или персон либо визуальные эффекты сцены, по-прежнему нужна отдельная, узко ограниченная возможность-посредник, которую предоставляет Marinara. Расширение не должно имитировать ее через доступ к DOM хоста или свободные сетевые запросы.

Если расширению External Extension нужен доступ к DOM хоста, оно может запросить:

```json
{
  "runtime": "client",
  "capabilities": ["full_page_access"]
}
```

**Full page access не является возможностью песочницы.** Одобренные JavaScript и CSS выполняются прямо на странице Marinara. Код может прочитать или изменить все, что видно текущей сессии браузера, изучать чаты и карточки, пользоваться хранилищем браузера, отправлять сетевые запросы и вызывать API Marinara того же источника. На практике у него на странице те же права, что у кода, вставленного в консоль браузера. Черновики Professor Mari не могут запросить этот доступ.

Для сетевых запросов расширениям с полным доступом к странице следует использовать `marinara.fetch(...)`. У него те же сигнатура и результат, что у `window.fetch`, но при этом раздел **Settings > Addons > External Extensions** может показать для этого расширения число запросов за сеанс, переданные байты по данным ответов, недавнюю частоту запросов и предупреждение о длительном высоком трафике. Прямой `window.fetch` остается доступен, потому что код с полным доступом к странице считается доверенным, но такие запросы нельзя отнести к расширению.

Старую оболочку `kind: "marinara.extension"` версии 1 без явного поля `capabilities` Marinara распознает как пакет времен до песочницы и при импорте назначает ей **Full page access**. Благодаря этому старые пакеты вроде WeatherTweaker попадают в правильный процесс проверки, а не молча отказывают внутри Worker. Современный пакет, который использует эту оболочку, но хочет безопасную среду, должен указать `"capabilities": []`.

Обе защитные блокировки External Extension и одобрение точного хеша по-прежнему действуют. Изменение кода, CSS или разрешений отключает расширение и требует нового одобрения. При отключении Marinara удаляет свои узлы скрипта и таблицы стилей, отменяет таймеры, созданные через API совместимости, и вызывает обработчики, зарегистрированные через `marinara.onCleanup(...)`. Код страницы может создавать незарегистрированные обработчики событий, таймеры, глобальные переменные и изменения DOM, поэтому очистка выполняется по мере возможности; если после отключения расширения что-то осталось, перезагрузите страницу.

Более старый API `marinara.ui.showWindow(...)` по-прежнему доступен для временного окна внутри iframe с непрозрачным источником. Он использует тот же фиксированный набор элементов управления и возвращает дескрипторы `update(...)` и `close()`. Если инструмент должен быть доступен через обычную навигацию Marinara, лучше используйте элементы интерфейса.

## Быстрый старт Server Extension

Создайте такую папку:

```text
Server Counter/
  manifest.json
  server-extension.js
```

Используйте такой файл `manifest.json`:

```json
{
  "kind": "marinara.personal-server-extension",
  "version": 1,
  "config": {
    "name": "Server Counter",
    "version": "1.0.0",
    "description": "A minimal sandboxed Server Extension.",
    "runtime": "server",
    "capabilities": [],
    "serverJsPath": "server-extension.js"
  }
}
```

Используйте такой файл `server-extension.js`:

```js
const saved = await marinara.storage.get();
const starts = (Number(saved.starts) || 0) + 1;
await marinara.storage.patch({ starts });

marinara.log.info(`Server Counter started ${starts} time${starts === 1 ? "" : "s"}`);

const timer = marinara.setInterval(() => {
  marinara.log.debug("Server Counter heartbeat");
}, 60_000);

marinara.onCleanup(() => marinara.clearInterval(timer));
```

Этот же готовый к запуску пакет доступен по пути `docs/examples/personal-extensions/server-minimal/`.

Серверный код получает `marinara.runtime`, `marinara.version`, идентификаторы расширения, `log`, `storage`, управляемые таймеры и `onCleanup`. Он не получает доступа к файловой системе, процессам, сети, загрузке модулей или базе данных Marinara.

Расширения Server Extensions остаются отключенными, если хост не может запустить Seatbelt или Bubblewrap. Это ограничение платформы, а не ошибка расширения.

## Справочник пакета и манифеста

| Поле | Примечания |
| --- | --- |
| `kind` | `marinara.personal-extension` или `marinara.personal-server-extension` |
| `version` верхнего уровня | Версия оболочки пакета; сейчас `1` |
| `config.name` | Обязательное отображаемое имя длиной от 1 до 200 символов |
| `config.version` | Необязательная версия расширения, например `1.2.0`; числовые версии с точками позволяют предупреждать о понижении версии |
| `config.description` | Необязательное описание длиной до 2 000 символов |
| `config.runtime` | `client` или `server`; значение по умолчанию – `client` |
| `config.capabilities` | Запрашиваемые возможности Browser; расширения Server Extensions должны использовать пустой список |
| `config.jsPath` / `config.serverJsPath` | Путь к файлу JavaScript или упорядоченный массив путей относительно манифеста |
| `config.cssPath` | Необязательный путь к файлу CSS или упорядоченный массив; CSS безопасной среды остается в iframe песочницы |
| `config.js`, `config.serverJs`, `config.css` | Встроенные альтернативы, когда отдельные файлы не нужны |

Используйте обычный JavaScript. Marinara не компилирует TypeScript и не устанавливает зависимости расширения. При необходимости включите зависимости в JavaScript до импорта.

Отдельные файлы `.js`, `.mjs`, `.cjs`, `.server.js`, `.server.mjs`, `.server.cjs` и `.css` тоже можно импортировать напрямую. Манифест предпочтительнее, потому что он явно фиксирует идентификаторы, среду, версию, возможности и порядок файлов.

### Ограничения проверки

| Содержимое | Текущая граница |
| --- | --- |
| Имя / версия / описание | 200 символов / 64 символа / 2 000 символов |
| JS для Browser или Server | Ограничения исходного кода для отдельного поля нет; продолжает действовать граница содержащего его файла, архива или запроса |
| CSS | 256 KiB |
| Импортированный ZIP | 32 MiB в сжатом виде, 2 MiB на текстовую запись и 16 MiB всего распакованного текста |
| Закрытое хранилище | 1 000 000 байт сериализованного JSON на расширение |

Ограничения ZIP, запроса, сообщения песочницы и хранилища защищают отдельные границы транспорта или среды выполнения; они не являются правилами для исполняемого исходного кода.

## Цикл обновления и восстановления

- Каждый новый импорт сначала отключен и не одобрен.
- Изменение кода, CSS, среды или возможностей снимает одобрение и отключает расширение.
- Повторный импорт с тем же именем после подтверждения обновляет существующую запись. Повторный импорт с полным побайтовым совпадением сохраняет текущий хеш и одобрение; измененное исполняемое содержимое снимает одобрение. Marinara предупреждает, если числовые версии указывают на понижение версии.
- **Export** записывает текущий манифест и исходные файлы в переносимый пакет. Одобрение никогда не экспортируется.
- Восстановление ревизии, импорт профиля или восстановление резервной копии оставляет расширение отключенным до новой проверки.
- **Disable** останавливает среду выполнения и зарегистрированную очистку. Коду с доступом ко всей странице может потребоваться перезагрузка страницы, если он создал незарегистрированные побочные эффекты.
- **Delete** удаляет установленную запись. Сначала экспортируйте ее, если исходный код может еще понадобиться.

## Отладка

| Симптом | Что проверить |
| --- | --- |
| Нет элементов управления внешним импортом | Откройте обе описанные выше защитные блокировки External Extension |
| Раздел управления сообщает, что нужен localhost или Admin Access | Настройте `ADMIN_SECRET` и сохраните его в **Admin Access** |
| Импорт не находит расширение | Проверьте `manifest.json` и относительные пути; Server требует JS, а Browser – CSS или JS |
| Расширение отключается после изменения | Это ожидаемо: проверьте и одобрите новый точный хеш |
| Код Browser не может использовать `document`, `window`, `fetch` или локальное хранилище | Это ожидаемо в безопасной песочнице; используйте описанные посреднические API |
| Server Extension недоступно | Используйте Seatbelt в macOS или Linux с Bubblewrap либо перейдите на Browser Extension |
| Browser Extension вызывает исключение | Откройте инструменты разработчика браузера; сообщения `marinara.log` и ошибки запуска помечены именем расширения |
| Server Extension вызывает исключение | Проверьте его состояние в разделе **Settings → Addons** и журнал сервера Marinara |

Для CSS, закрытого хранилища, импортируемых архивов и сообщений среды выполнения действуют отдельные ограничения безопасности. Marinara должна сообщить, какая граница отклонила пакет, а не представлять проблему как ошибку выполнения.

## Смежные руководства

- [Личные расширения](personal-extensions.md)
- [Настройки сервера: справочник](../CONFIGURATION.md)
- [Устранение неполадок в приложении Marinara Engine](../TROUBLESHOOTING.md)
- [Архитектура личных расширений](../development/personal-extensions.md)
