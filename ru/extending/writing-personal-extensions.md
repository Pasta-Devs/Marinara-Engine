# Создание собственных расширений Personal Extensions

Это руководство предназначено для тех, кто пишет собственные расширения для приложения Marinara Engine. Перед установкой, проверкой и безопасным запуском расширения прочитайте руководство [Personal Extensions](personal-extensions.md).

Код, который вы написали и импортировали сами, считается **External Extension** (внешним расширением). Сначала он отключен и не может выполняться, пока вы не проверите его и не одобрите точный хеш SHA-256.

## Перед началом

Расширения External Extensions скрыты, пока не открыты обе защитные блокировки:

1. Задайте `ENABLE_EXTERNAL_EXTENSIONS=true` в файле `.env` хоста Marinara.
2. Откройте **Settings** > **Advanced** > **Danger Zone** и включите **Allow third-party extension imports**.

Для импорта расширений и управления ими также нужен доступ через localhost или настроенный **Admin Access**. Если вы используете Marinara с телефона, по адресу LAN или через удаленный браузер, задайте `ADMIN_SECRET` на сервере и введите то же значение в разделе **Settings** > **Advanced** > **Admin Access**.

Выберите среду с минимальными правами, которых достаточно для задачи:

| Среда | Для чего подходит | Важная граница |
| --- | --- | --- |
| Sandboxed Browser Extension | Закрытое состояние, контекст активного чата, кнопки, действия меню и панели, которые отрисовывает Marinara | Нет доступа к DOM приложения Marinara, файлам cookie, хранилищу браузера, сети и произвольному HTML |
| Server Extension | Фоновая логика, которой нужны управляемые таймеры и закрытое хранилище расширения | Отдельная песочница ОС; нет доступа к файлам и секретам Marinara, сети, дочерним процессам и нативным модулям |
| Full-page External Extension | Старый код, которому действительно нужны страница Marinara или API с тем же origin | Нет песочницы; используйте только для точно проверенного кода, которому вы полностью доверяете |

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

1. Откройте **Settings** > **Addons** > **External Extensions**.
2. Выберите **Import Folder** и папку `Hello Panel` либо упакуйте папку и импортируйте ZIP.
3. Откройте отключенный черновик и проверьте его манифест и JavaScript.
4. Выберите **Review and Run** и одобрите точно показанный хеш.
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
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | Управляемые таймеры, которые удаляются при остановке расширения |
| `onCleanup(callback)` | Регистрация дополнительной логики очистки |

Для обычного интерфейса используйте [панели, которые отрисовывает Marinara](personal-extensions.md#add-a-marinara-rendered-panel), а для поведения с учетом чата – [контекст активного чата](personal-extensions.md#use-active-chat-context). Состояние расширения должно находиться в `marinara.storage`, а не в хранилище браузера.

`showWindow({ title, elements, onEvent, onClose })` возвращает дескриптор с методами `update({ title?, elements? })` и `close()`. CSS пакета оформляет эти окна iframe в песочнице; элементы, которые отрисовывает хост, всегда используют тему и элементы управления самого приложения Marinara.

В безопасной среде Browser нет API DOM и сети. Не обходите эту границу. Если полезной возможности не хватает, запросите узкую возможность на стороне хоста, а не переходите по умолчанию на доступ ко всей странице.

### Возможности контекста

Объявите необязательный доступ к записям в `config.capabilities`:

```json
{
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` заполняет ограниченный набор полей карт Character в активном чате.
- `read_active_persona` заполняет ограниченный набор полей выбранной Persona.
- `full_page_access` выбирает среду совместимости без песочницы и доступен только расширениям External Extensions.

При изменении возможностей меняется хеш исполняемого кода, расширение отключается и требует новой проверки.

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
| top-level `version` | Версия оболочки пакета; сейчас `1` |
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
| Server Extension вызывает исключение | Проверьте его состояние в разделе **Settings** > **Addons** и журнал сервера Marinara |

Для CSS, закрытого хранилища, импортируемых архивов и сообщений среды выполнения действуют отдельные ограничения безопасности. Marinara должна сообщить, какая граница отклонила пакет, а не представлять проблему как ошибку выполнения.

## Связанные руководства

- [Personal Extensions](personal-extensions.md)
- [Настройка сервера](../CONFIGURATION.md)
- [Устранение неполадок](../TROUBLESHOOTING.md)
- [Архитектура Personal Extensions](../development/personal-extensions.md)
