# Архитектура клиентской части (для разработчиков)

Это материал для разработчиков, а не руководство для пользователей. Здесь описано, как устроен клиент приложения Marinara Engine: структура приложения на React, хранилища Zustand, хуки React Query, основные компоненты и карта серверного API. Если вы просто хотите пользоваться приложением, начните с руководств для пользователей.

## Общий обзор

Marinara Engine – это приложение для чата с ИИ, в котором есть режимы Conversation, Roleplay и Game. Клиент представляет собой одностраничное приложение на React 19, которое раздает Vite. Оформление построено на Tailwind CSS v4, а сам клиент упакован как приложение PWA (Progressive Web App, веб-приложение с возможностью установки).

Код клиента лежит в `packages/client`. Он обращается к серверу API на Fastify (`packages/server`) по REST и через Server-Sent Events (SSE). Общие контракты данных (типы, схемы Zod, константы) лежат в `packages/shared` и импортируются с обеих сторон.

## Архитектура приложения

### Три колонки

Интерфейс построен по трехколоночной схеме в духе Discord, которой управляет `components/layout/AppShell.tsx`:

```
+-------------+-----------------------------+--------------+
|  Left       |         Center              |  Right       |
|  Sidebar    |                             |  Panel       |
|             |  Chat area or Editor        |              |
|  Chat list  |  (lazy-loaded)              |  Characters  |
|  Folders    |                             |  Lorebooks   |
|  Mode tabs  |  ChatConversationSurface    |  Presets     |
|             |  ChatRoleplaySurface        |  Connections |
|             |  GameSurface                |  Agents      |
|             |  CharacterEditor            |  Personas    |
|             |  LorebookEditor             |  Settings    |
|             |  PresetEditor               |  Browser     |
|             |  ...other editors           |              |
+-------------+-----------------------------+--------------+
```

- Левая боковая панель (`components/layout/ChatSidebar.tsx`): список чатов, разложенный по папкам, с фильтром по режиму (Conversation, Roleplay, Game).
- Центральная область: либо активная поверхность чата, либо полноэкранный редактор (персонажа, лорбука, пресета и так далее). Одновременно виден только один из них. Редакторы занимают место области чата.
- Правая панель (`components/layout/RightPanel.tsx`): обзор ресурсов и настройки, открывается кнопками верхней панели. После первого монтирования панель остается в DOM (скрывается средствами CSS), чтобы сохранить прокрутку и локальное состояние.
- Верхняя панель (`components/layout/TopBar.tsx`): кнопки быстрого переключения между правыми панелями.

### Навигация

Навигация построена на состоянии. Маршрутизации по URL здесь нет. Тем, что отображается на экране, управляет хранилище Zustand `stores/ui.store.ts`:

| Куда переходим            | Поле хранилища       | Функция перехода                                  |
| ------------------------- | -------------------- | ------------------------------------------------- |
| Открыть редактор персонажа  | `characterDetailId`  | `openCharacterDetail(id)`                          |
| Открыть редактор лорбука   | `lorebookDetailId`   | `openLorebookDetail(id)`                           |
| Открыть редактор пресета     | `presetDetailId`     | `openPresetDetail(id)`                             |
| Открыть редактор подключения | `connectionDetailId` | `openConnectionDetail(id)`                         |
| Открыть редактор агента      | `agentDetailId`      | `openAgentDetail(id)`                              |
| Открыть редактор персоны    | `personaDetailId`    | `openPersonaDetail(id)`                            |
| Сменить правую панель     | `rightPanel`         | `openRightPanel(name)` / `toggleRightPanel(name)` |
| Открыть окно             | `modal`              | `openModal(type, props?)`                          |

### Разделение кода

Крупные редакторы и тяжелые компоненты подгружаются в `AppShell.tsx` лениво – через `React.lazy()` вместе с `Suspense`. Так начальный бандл остается небольшим (см. лимиты бандла ниже).

## Управление состоянием

### Хранилища Zustand (состояние клиента)

Состояние интерфейса и среды выполнения клиент держит в наборе хранилищ Zustand в `packages/client/src/stores/`. Из них сохраняется на диск только `ui.store.ts`. Остальные держат состояние времени выполнения для чатов, агентов, игр, локального движка моделей, перевода, диалогов, дозаполнения и настольных игр.

Сейчас файлов хранилищ столько: `agent.store.ts`, `backfill.store.ts`, `chat.store.ts`, `chess-game.store.ts`, `dialog.store.ts`, `encounter.store.ts`, `gallery.store.ts`, `game-asset.store.ts`, `game-mode.store.ts`, `game-state.store.ts`, `poker-game.store.ts`, `sidecar.store.ts`, `translation.store.ts`, `ui.store.ts` и `uno-game.store.ts`.

#### `ui.store.ts`: настройки и обвязка интерфейса

Единственное сохраняемое хранилище (localStorage через middleware `persist` из Zustand). В нем лежат:

- Тема оформления: `visualTheme` ("default" или "sillytavern"), значение `data-theme` (dark или light) и переопределенные цвета.
- Оформление: `fontSize`, `chatFontSize`, `fontFamily`, свои шрифты и вид курсора.
- Отображение чата: `boldDialogue`, `showTimestamps`, `showModelName` и `messagesPerPage`.
- Оформление текста: цвет текста чата, прозрачность фона сообщений в режиме Roleplay и обводка текста.
- Стриминг: `enableStreaming` и `streamingSpeed`.
- Тема оформления режима Conversation: цвета градиента для пузырьков сообщений.
- Звук: `convoNotificationSound` и `rpNotificationSound`.
- Поведение: `confirmBeforeDelete`, `enterToSendRP`, `enterToSendConvo`, `weatherEffects` и `guideGenerations`.
- Навигация: `rightPanel`, `rightPanelOpen`, `sidebarOpen`, `settingsTab`, все поля `*DetailId` и `modal`.

Синхронизируемые темы оформления в `ui.store.ts` не хранятся. Их отдает сервер через React Query, и они одинаковы на всех устройствах, подключенных к одному экземпляру Marinara.

#### `chat.store.ts`: состояние чата

Не сохраняется. Отслеживает активную сессию чата:

- `activeChatId`: какой чат открыт.
- `messages`: текущий массив сообщений.
- `isStreaming`, `streamBuffer`: идет генерация.
- `inputDrafts`: черновики сообщений по чатам.
- `currentInput`: текущее содержимое поля ввода.
- `perChatTyping`: состояние индикатора набора текста.
- `unreadCounts`, `chatNotifications`: значки уведомлений.
- `abortControllers`: отмена незавершенных генераций.

#### `agent.store.ts`: работа агентов

Отслеживает состояние конвейера агентов во время генерации и после нее:

- `activeAgents`: агенты, которые работают сейчас.
- `thoughtBubbles`: размышления агентов, видимые в реальном времени.
- `echoMessages`: Echo Chamber (имитация чата зрителей).
- `cyoaChoices`: интерфейс выбора с ветвлением.
- `debugLog`: метрики производительности и расход токенов.
- `failedAgentTypes`: агенты, завершившиеся с ошибкой (для интерфейса повторного запуска).

#### `game-state.store.ts`: RPG-помощник

Хранит контекст сцены и мира для режима Roleplay:

- `current` (GameState): дата, время, место, погода, присутствующие персонажи, события, характеристики игрока, квесты и инвентарь.
- `isVisible`, `expandedSections`: состояние отображения панели HUD.

#### `encounter.store.ts`: система боя

Состояние пошагового боя:

- `active`: идет ли сражение.
- `party`, `enemies`: участники боя с HP, атаками и статусами.
- `environment`: описание арены.
- `playerActions`, `encounterLog`: очередь действий и история.
- `combatResult`: победа, поражение, отступление или прерывание.

#### `gallery.store.ts`: наложенные изображения

- `pinnedImages`: изображения, закрепленные поверх области чата.

### React Query (данные с сервера)

Все данные с сервера запрашиваются и кешируются через TanStack React Query, который настраивается в `main.tsx`:

- Время устаревания: 30 секунд (общее значение по умолчанию).
- Повтор: 1 попытка.
- Повторный запрос при возврате фокуса: выключен.
- Кеш: только в памяти, без сохранения на диск.

У каждой сущности есть свой файл хуков, который экспортирует хуки запросов и мутаций.

## Справочник хуков

Все хуки лежат в `src/hooks/` и названы по образцу `use-{entity}.ts`.

### Хуки чатов (`use-chats.ts`)

| Хук                               | Тип           | Описание                                  |
| ---------------------------------- | -------------- | -------------------------------------------- |
| `useChats()`                       | Query          | Все чаты                                    |
| `useChat(id)`                      | Query          | Один чат по ID                            |
| `useChatMessages(chatId, perPage)` | Infinite Query | Сообщения чата постранично                |
| `useChatGroup(groupId)`            | Query          | Группа чатов                                   |
| `useCreateChat()`                  | Mutation       | Создать чат                            |
| `useDeleteChat()`                  | Mutation       | Удалить чат                              |
| `useUpdateChatMetadata()`          | Mutation       | Обновить метаданные чата (агенты, спрайты и прочее) |
| `useBranchChat()`                  | Mutation       | Создать ветку чата от конкретного сообщения        |
| `useUpdateMessage()`               | Mutation       | Изменить текст сообщения (оптимистичное обновление)     |
| `useDeleteMessage()`               | Mutation       | Удалить одно сообщение                     |
| `useDeleteMessages()`              | Mutation       | Удалить несколько сообщений                        |
| `useSetActiveSwipe()`              | Mutation       | Переключиться на другой свайп       |
| `usePeekPrompt()`                  | Mutation       | Посмотреть собранный промпт                     |
| `useClearAllData()`                | Mutation       | Удалить всё без возможности возврата              |

### Хуки персонажей (`use-characters.ts`)

| Хук                   | Тип     | Описание                            |
| ---------------------- | -------- | -------------------------------------- |
| `useCharacters()`      | Query    | Все персонажи                         |
| `useCharacter(id)`     | Query    | Один персонаж с разобранными данными карточки |
| `useCreateCharacter()` | Mutation | Создать персонажа                       |
| `useUpdateCharacter()` | Mutation | Обновить данные карточки персонажа            |
| `useDeleteCharacter()` | Mutation | Удалить персонажа                       |
| `useUploadAvatar()`    | Mutation | Загрузить изображение аватара                    |
| `usePersonas()`        | Query    | Все персоны                            |
| `usePersona(id)`       | Query    | Одна персона                         |
| `useCreatePersona()`   | Mutation | Создать персону                         |
| `useUpdatePersona()`   | Mutation | Обновить персону                         |
| `useDeletePersona()`   | Mutation | Удалить персону                         |
| `useCharacterGroups()` | Query    | Группы персонажей                       |
| `usePersonaGroups()`   | Query    | Группы персон                        |

### Хуки пресетов (`use-presets.ts`)

| Хук                           | Тип     | Описание                                                 |
| ------------------------------ | -------- | ---------------------------------------------------------- |
| `usePresets()`                 | Query    | Все пресеты                                                |
| `usePreset(id)`                | Query    | Один пресет                                              |
| `usePresetFull(id)`            | Query    | Пресет с разделами, группами и вариантами                  |
| `useDefaultPreset()`           | Query    | Пресет по умолчанию                                         |
| `useCreatePreset()`            | Mutation | Создать пресет                                              |
| `useUpdatePreset()`            | Mutation | Обновить пресет                                              |
| `useDeletePreset()`            | Mutation | Удалить пресет                                              |
| `usePresetSections(presetId)`  | Query    | Разделы промпта в пресете                               |
| `usePresetGroups(presetId)`    | Query    | Группы разделов                                            |
| `usePresetVariables(presetId)` | Query    | Переменные пресета (раньше – блоки вариантов)                  |
| `usePreviewPreset()`           | Mutation | Готовый промпт для предпросмотра по `{ presetId, chatId, choices }` |

### Хуки агентов (`use-agents.ts`)

| Хук                 | Тип     | Описание                     |
| -------------------- | -------- | ------------------------------- |
| `useAgentConfigs()`  | Query    | Все настройки агентов        |
| `useAgentConfig(id)` | Query    | Настройки одного агента             |
| `useCreateAgent()`   | Mutation | Создать своего агента             |
| `useUpdateAgent()`   | Mutation | Обновить настройки агента            |
| `useDeleteAgent()`   | Mutation | Удалить агента                    |
| `useToggleAgent()`   | Mutation | Включить или выключить встроенного агента |

### Хук генерации (`use-generate.ts`)

Самый сложный хук. Он возвращает `{ generate, retryAgents }`.

Функция `generate(params)` принимает один объект настроек с полями вида `chatId`, `connectionId`, `userMessage`, `regenerateMessageId`, `continueMessageId`, `impersonate` и `attachments`. Она возвращает `false`, если генерация для этого чата уже идет. Порядок работы такой:

1. Установить состояние стриминга в `chat.store.ts`.
2. Отправить запрос на генерацию по адресу `/api/generate`.
3. Разобрать события SSE: `token`, `agent_start`, `agent_result`, `agent_error`, `thinking`, `tool_call`, `game_state`, `game_state_patch`, `text_rewrite`, `scene_created`, `done`, `error`.
4. Обновить кеш React Query новыми сообщениями.
5. Заполнить хранилище агентов размышлениями и отладочными данными.
6. Показать ошибки во всплывающих уведомлениях.

### Другие хуки

В папке `src/hooks/` есть также много хуков под отдельные возможности. Вот показательная выборка:

| Файл                           | Назначение                                   |
| ------------------------------ | ----------------------------------------- |
| `use-connections.ts`           | Подключения к API: CRUD и проверка             |
| `use-lorebooks.ts`             | CRUD для лорбуков и записей                    |
| `use-scene.ts`                 | Планирование, создание и завершение сцены       |
| `use-encounter.ts`             | Начало сражения, действия, итоги     |
| `use-autonomous-messaging.ts`  | Опрос и расписание автономных сообщений  |
| `use-idle-detection.ts`        | Определение простоя в 10 минут            |
| `use-background-autonomous.ts` | Фоновый опрос по неактивным чатам      |
| `use-translate.ts`             | Перевод текста                          |
| `use-apply-regex.ts`           | Применение скриптов регулярных выражений к сообщениям         |
| `use-custom-tools.ts`          | CRUD для своих инструментов                           |
| `use-knowledge-sources.ts`     | Управление источниками знаний                |
| `use-gallery.ts`               | Изображения галереи чата                           |
| `use-chat-folders.ts`          | CRUD для папок чатов и их порядок      |
| `use-regex-scripts.ts`         | CRUD для скриптов регулярных выражений                          |
| `use-haptic.ts`                | Подключение тактильных устройств и команды к ним      |

## Обзор компонентов

### Система чата (`components/chat/`)

Чат – самая большая часть приложения. Файл `ChatArea.tsx` лениво подгружает три поверхности отображения: Conversation, Roleplay и Game Mode.

#### Режим Conversation (`ChatConversationSurface.tsx`)

Пузырьки сообщений как в мессенджере. Сообщения пользователя справа, ответы ассистента слева. Возможности:

- Бесконечная прокрутка с постраничной подгрузкой (старые сообщения приходят при прокрутке вверх).
- Действия над каждым сообщением: изменить, скопировать, сгенерировать заново, удалить, создать ветку, посмотреть промпт.
- Вложения (изображения и файлы).
- Выбор эмодзи и GIF.
- Слеш-команды.
- Звуки уведомлений при новых сообщениях.
- Черновики, которые сохраняются для каждого чата.

#### Режим Roleplay (`ChatRoleplaySurface.tsx`)

Темный, погружающий интерфейс в духе RPG. Здесь есть всё то же, что в режиме Conversation, и вдобавок:

- Спрайты персонажей, у которых выражение лица меняет агент `expression`.
- Панель HUD режима Roleplay с состоянием мира (время, место, погода, присутствующие персонажи).
- Погодные эффекты (наложение частиц под погоду в сцене).
- Панель Echo Chamber (имитация реакций зрителей).
- Сражения с пошаговой системой действий.
- Панель World Info с активными записями лорбуков.
- Система сцен для коротких ответвлений в отыгрыше.
- Фоновые изображения с плавным переходом между ними.

#### Game Mode (`GameSurface.tsx`)

Поверхность для Game Master на базе ИИ. Она лежит вне папки чата – в `components/game/GameSurface.tsx`. Файл `ChatArea.tsx` отображает ее, когда режим чата равен `game`. Она читает отдельные хранилища игры (`game-mode.store.ts`, `game-asset.store.ts`, `game-state.store.ts`) и управляет сессиями, бросками кубика, проверками навыков, картами и раскадровками хода через хуки из `use-game.ts` и `use-game-storyboards.ts`.

#### Ключевые компоненты

- `ChatArea.tsx`: центральный дирижер. Запрашивает все данные (сообщения, персонажей, персоны), собирает карту персонажей, определяет режим чата и отображает нужную поверхность.
- `ChatMessage.tsx`: отображает одно сообщение с разметкой Markdown, переключением свайпов, редактированием и меню действий. Внутри используется неуправляемый подкомпонент `EditTextarea` – так при правке не происходит лишних перерисовок.
- `ChatInput.tsx`: поле ввода с авторастяжением, сохранением черновика, дополнением слеш-команд, обработкой вложений и вставкой эмодзи или GIF.

### Компоненты редакторов

У каждого типа ресурса есть полноэкранный редактор, который занимает место области чата:

| Редактор            | Файл                                          | Чем управляет                                                                         |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| Редактор персонажа  | `components/characters/CharacterEditor.tsx`   | Поля карточки персонажа, аватар, приветствие, характер, системный промпт, метаданные   |
| Редактор лорбука   | `components/lorebooks/LorebookEditor.tsx`     | Метаданные лорбука и записи с ключами, правилами активации, настройками вставки   |
| Редактор пресета     | `components/presets/PresetEditor.tsx`         | Разделы промпта, группы, маркеры, параметры генерации, блоки вариантов          |
| Редактор подключения | `components/connections/ConnectionEditor.tsx` | Провайдер API, базовый URL, модель, контекстное окно, флаги                            |
| Редактор агента      | `components/agents/AgentEditor.tsx`           | Шаблон промпта агента, фаза, подключение, инструменты, настройки                       |
| Редактор персоны    | `components/personas/PersonaEditor.tsx`       | Персона пользователя: имя, описание, характеристики, аватар                              |

### Система окон (`components/modals/`)

Окна отображает `components/layout/ModalRenderer.tsx`. Он читает `ui.store.modal` и отображает подходящий компонент внутри `Suspense`. Сами компоненты окон лежат в `components/modals/`.

Сейчас есть такие типы окон (список показательный, а не полный):

| Тип                       | Компонент                     | Назначение                                    |
| -------------------------- | ----------------------------- | ------------------------------------------ |
| `create-character`         | `CreateCharacterModal`        | Быстрое создание персонажа (имя и аватар) |
| `create-connection`        | `CreateConnectionModal`       | Быстрое создание подключения                  |
| `create-persona`           | `CreatePersonaModal`          | Быстрое создание персоны                     |
| `create-lorebook`          | `CreateLorebookModal`         | Быстрое создание лорбука                    |
| `create-preset`            | `CreatePresetModal`           | Быстрое создание пресета                      |
| `import-character`         | `ImportCharacterModal`        | Импорт из файла (JSON или PNG)             |
| `import-connection`        | `ImportConnectionModal`       | Импорт пакета подключения              |
| `import-lorebook`          | `ImportLorebookModal`         | Импорт из файла                            |
| `import-preset`            | `ImportPresetModal`           | Импорт из файла                            |
| `import-persona`           | `ImportPersonaModal`          | Импорт из файла                            |
| `character-card-update`    | `CharacterCardUpdateModal`    | Просмотр изменений карточки, предложенных агентом       |
| `agent-write-approval`     | `AgentWriteApprovalModal`     | Согласие на запись агентом и просмотр правок              |
| `docs-viewer`              | `DocsViewerModal`             | Встроенный просмотр документации                  |
| `st-bulk-import`           | `STBulkImportModal`           | Массовый импорт данных из SillyTavern              |
| `about-me-viewer`          | `AboutMeViewerModal`          | Просмотр About Me в режиме Conversation          |
| `scene-prompt-preferences` | `ScenePromptPreferencesModal` | Настройки промпта сцены                     |

Все окна устроены одинаково: принимают `{ open, onClose }`, оборачивают содержимое в базовый компонент `Modal`, обращаются к API через мутации и показывают загрузку по значению `mutation.isPending`.

### Система панелей (`components/panels/`)

Панели справа показывают списки ресурсов с поиском, сортировкой и фильтрами. Щелчок по ресурсу открывает его полноэкранный редактор в центре.

Панели регистрируются в `RightPanel.tsx` в двух местах:

1. `PANEL_CONFIG`: заголовок, иконка и цвет градиента.
2. `PANELS`: карта компонентов.

Панели сохраняются на уровне модуля. Множество `mountedPanels` помнит, какие панели уже открывались. После монтирования панель остается в DOM (скрытая через `display: none` или `aria-hidden`) и сохраняет свое состояние.

### Базовые элементы интерфейса (`components/ui/`)

| Компонент          | Описание                                                            |
| ------------------ | --------------------------------------------------------------------- |
| `Modal`            | Базовое окно: закрытие щелчком по фону и клавишей Esc, анимации появления и скрытия |
| `ColorPicker`      | Выбор сплошного цвета или градиента с готовыми образцами                   |
| `ExpandedTextarea` | Полноэкранное наложение для правки больших блоков текста              |
| `EmojiPicker`      | Всплывающая панель эмодзи с поиском (отображается через портал)                            |
| `GifPicker`        | Поиск GIF через API Giphy                                          |
| `HelpTooltip`      | Иконка, которая при наведении показывает подсказку через портал                     |

Все компоненты интерфейса работают на управляемых свойствах (value вместе с onChange), а наложения отображают через портал.

## Клиент API (`lib/api-client.ts`)

Все обращения к серверу идут через объект `api`:

```typescript
import { api, ApiError } from "@/lib/api-client";
```

| Метод                         | Запрос           | Описание                           |
| ------------------------------ | ------------------- | ------------------------------------- |
| `api.get<T>(path)`             | `GET /api{path}`    | Получить JSON                            |
| `api.post<T>(path, body)`      | `POST /api{path}`   | Отправить JSON, получить JSON               |
| `api.put<T>(path, body)`       | `PUT /api{path}`    | Полное обновление                           |
| `api.patch<T>(path, body)`     | `PATCH /api{path}`  | Частичное обновление                        |
| `api.delete(path)`             | `DELETE /api{path}` | Удалить ресурс                       |
| `api.upload(path, FormData)`   | `POST /api{path}`   | Загрузка файла в формате multipart                 |
| `api.download(path, filename)` | `GET /api{path}`    | Скачивание с окном выбора места          |
| `api.stream(path, body)`       | `POST /api{path}`   | Асинхронный генератор SSE (только токены)     |
| `api.streamEvents(path, body)` | `POST /api{path}`   | Асинхронный генератор SSE (все типы событий) |

Ошибки выбрасываются как `ApiError` со свойствами `status` и `message`.

## Система оформления

### Tailwind CSS v4

В проекте используется Tailwind CSS v4 с плагином `@tailwindcss/vite`, поэтому настройка PostCSS не нужна. Токены темы связаны с пользовательскими свойствами CSS из `globals.css`:

```css
@theme {
  --color-primary: var(--primary);
  --color-background: var(--background);
  --color-border: var(--border);
  /* ... */
}
```

### Устройство тем оформления

Файл `globals.css` разбит на подписанные разделы. Среди них: связка с `@theme` из Tailwind, переменные темной темы, переопределения светлой темы, базовый сброс стилей, свои курсоры, полосы прокрутки, стеклянные панели, утилиты свечения, компоненты интерфейса и анимации по ключевым кадрам. Остальные разделы отвечают за анимации чата, оформление чата под каждый режим, спрайты и панель HUD игры, карточки вызова функций, правила адаптивности, импортированную тему SillyTavern, правила доступности и подсказки для производительности.

### Свои темы оформления

Темы оформления можно создавать самостоятельно. Их описания хранятся на сервере Marinara и синхронизируются между подключенными устройствами. Активная тема тоже общая. Ее CSS вставляет в виде тега `style` компонент `CustomThemeInjector.tsx`.

Синхронизируемый CSS темы может запросить встроенный движок Accent Pulse строкой `--marinara-theme-accent-pulse: enabled`. Добавьте `--marinara-theme-accent-pulse-source: #a78bfa` (или градиент), если пульсация должна брать конкретный акцентный цвет темы, а не текущий акцент из раздела Appearance.

### Personal Extensions

Personal Extensions – это изолированный код, который хранится на сервере и одобряется по точному хешу. Интерфейс раздела Addons работает через `use-personal-extensions.ts`; компонент `PersonalExtensionInjector.tsx` запускает одобренный код для браузера в отдельном Worker внутри изолированного iframe с непрозрачным источником и передает неизменяемые снимки контекста активного чата. Поля контекста присутствуют всегда; вне активного чата `chatId` и `characterId` равны `null`, а `characterIds` пуст. Для ограниченного набора полей активной карточки персонажа и выбранной персоны нужны отдельные объявленные разрешения, привязанные к хешу. Серверные расширения работают в отдельном процессе Node внутри macOS Seatbelt или Linux Bubblewrap и отказываются запускаться, если ни того, ни другого нет. Для внешних источников нужен доступ через `.env` плюс явное согласие в разделе Danger Zone – на границах списка, одобрения и запуска.

Прежде чем менять эту часть, прочитайте [Архитектура личных расширений](personal-extensions.md).

## Общий пакет (`packages/shared`)

Клиент импортирует типы, схемы и константы из `@marinara-engine/shared`.

### Константы

Ключевые файлы в `packages/shared/src/constants/`:

- `defaults.ts`: экспортирует, в частности, `APP_VERSION`, `PROFESSOR_MARI_ID`, `DEFAULT_CONNECTION_ID`, `DEFAULT_GENERATION_PARAMS`, `MAX_FILE_SIZES` и `LIMITS`. Это источник номера версии, и здесь же лежат настройки генерации по умолчанию.
- `providers.ts`: экспортирует `PROVIDERS` – настройки провайдеров API (OpenAI, Anthropic, Google и другие) с адресами и авторизацией.
- `model-lists.ts`: статические каталоги моделей по провайдерам, а также `IMAGE_GENERATION_SOURCES` для провайдеров генерации изображений.
- `agent-prompts.ts`: только базовые промпты сводки и Secret Plot плюс поиск во время выполнения тех промптов, которые приходят с установленными пакетами агентов.

### Схемы (Zod)

Все входные данные проверяются схемами Zod из `packages/shared/src/schemas/`. Показательные файлы:

| Файл схемы             | Сущности                                                           |
| ----------------------- | ------------------------------------------------------------------ |
| `agent.schema.ts`       | Создание и обновление AgentConfig, фазы агентов, типы результатов          |
| `character.schema.ts`   | Карточки персонажей, метаданные совместимости, книги персонажей, группы   |
| `chat.schema.ts`        | Создание чата, создание сообщения, запрос на генерацию                   |
| `connection.schema.ts`  | Создание и обновление подключения к API                                   |
| `custom-tool.schema.ts` | Описания своих инструментов                                            |
| `lorebook.schema.ts`    | Создание и обновление лорбука и записей, условия активации, расписания |
| `prompt.schema.ts`      | Пресет, раздел, группа, блок вариантов, параметры генерации          |
| `regex.schema.ts`       | Создание и обновление скрипта регулярного выражения                                   |
| `personal-extension.schema.ts` | Черновики Personal Extensions, одобрение по точному хешу, откат и приватное хранилище |

В этой же папке лежат схемы для настроек приложения, профилей настроек чата, звонков в режиме Conversation, своих эмодзи и наклеек, Noodle и тем оформления.

### Типы

Описания типов сущностей лежат в `packages/shared/src/types/`. Выборка ключевых файлов:

| Файл типов             | Ключевые интерфейсы                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `agent.ts`            | `AgentConfig`, `AgentResult`, `AgentContext`, `ToolDefinition`, `ToolCall`, `ToolResult`, `BUILT_IN_AGENTS` |
| `character.ts`        | `Character`, `CharacterCardV2`, `CharacterData`, `RPGStatsConfig`                                           |
| `chat.ts`             | `Chat`, `ChatMetadata`, `Message`, `MessageExtra`, `GenerationInfo`, `StreamEvent`                          |
| `connection.ts`       | `APIConnection`, `ModelInfo`, `ModelCapabilities`, `ConnectionTestResult`                                   |
| `combat-encounter.ts` | `CombatPartyMember`, `CombatEnemy`, `CombatActionResult`, `EncounterSettings`                               |
| `game-state.ts`       | `GameState`, `PresentCharacter`, `PlayerStats`, `QuestProgress`, `InventoryItem`                            |
| `lorebook.ts`         | `Lorebook`, `LorebookEntry`, `ActivationCondition`, `LorebookSchedule`, `QuestData`                         |
| `persona.ts`          | `Persona`, `PersonaStatsConfig`                                                                             |
| `personal-extension.ts` | `PersonalExtension`, метаданные времени выполнения, ревизии, источник и состояние серверной среды выполнения                         |
| `prompt.ts`           | `PromptPreset`, `PromptSection`, `PromptGroup`, `ChoiceBlock`, `GenerationParameters`                       |
| `scene.ts`            | `SceneMeta`, `SceneFullPlan`                                                                                |
| `haptic.ts`           | `HapticDevice`, `HapticStatus`, `HapticDeviceCommand`                                                       |

### Вспомогательные модули

| Файл              | Назначение                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `macro-engine.ts` | `resolveMacros(template, context)`: подставляет макросы вида `{{date}}`, `{{char}}`, `{{random}}`, `{{roll:2d6}}` и `{{getvar::name}}`     |
| `xml-wrapper.ts`  | `nameToXmlTag()`: превращает отображаемое имя в тег XML ("World Info (Before)" становится "world_info_before")                           |

## Точки API

Сервер (`packages/server`) публикует интерфейсы REST по префиксу `/api`. Ниже – обзорная карта, а не полный список. Источник истины – файл `packages/server/src/routes/index.ts` и отдельные файлы маршрутов.

### Основные ресурсы

| Префикс               | Методы                  | Описание                                                                                |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `/api/characters`    | GET, POST, PATCH, DELETE | CRUD персонажей, группы, экспорт (JSON или PNG)                                               |
| `/api/chats`         | GET, POST, PATCH, DELETE | CRUD чатов, сообщения, метаданные, подключение и отключение                                     |
| `/api/prompts`       | GET, POST, PATCH, DELETE | CRUD пресетов, разделы, группы, блоки вариантов, экспорт                                      |
| `/api/connections`   | GET, POST, PATCH, DELETE | CRUD подключений к API, дублирование, проверка                                                      |
| `/api/agents`        | GET, POST, PATCH, DELETE | CRUD агентов, сообщения Echo Chamber, запуски; встроенные агенты переключаются через `PUT /api/agents/toggle/:agentType` |
| `/api/lorebooks`     | GET, POST, PATCH, DELETE | CRUD лорбуков, записи, экспорт                                                            |
| `/api/custom-tools`  | GET, POST, PATCH, DELETE | CRUD своих инструментов                                                                          |
| `/api/regex-scripts` | GET, POST, PATCH, DELETE | CRUD скриптов регулярных выражений                                                                          |

Инструменты памяти агентов обращаются к `/api/agents/memory/:agentType/:chatId`, где `agentType` – строка с типом агента, а `chatId` – идентификатор нужного чата.

### Генерация

| Точка                     | Метод | Описание                                          |
| ---------------------------- | ------ | ---------------------------------------------------- |
| `/api/generate`              | POST   | Основная генерация по SSE с конвейером агентов          |
| `/api/generate/retry-agents` | POST   | Повторный запуск по SSE для типов агентов, переданных вызывающей стороной |

### Возможности чата

| Префикс                    | Точки                        | Описание                  |
| ------------------------- | -------------------------------- | ---------------------------- |
| `/api/chat-folders`       | CRUD и изменение порядка                | Управление папками чатов       |
| `/api/conversation`       | schedule, status, message, check | Система автономных сообщений  |
| `/api/scene`              | create, plan, conclude           | Ответвления сцен             |
| `/api/encounter`          | init, action, summary            | Сражения            |
| `/api/translate`          | POST                             | Перевод текста             |
| `/api/game`               | CRUD и действия                 | Сессии и состояние Game Mode |
| `/api/game-assets`        | CRUD и загрузка                 | Игровые ресурсы                  |
| `/api/turn-games`         | Маршруты Chess, UNO, Poker         | Настольные игры в режиме Conversation     |
| `/api/conversation-calls` | Маршруты звонков и сессий          | Аудиозвонки в режиме Conversation     |

### Медиа и ресурсы

| Префикс                        | Описание                  |
| ----------------------------- | ---------------------------- |
| `/api/avatars/file/:filename` | Выдача изображений аватаров         |
| `/api/backgrounds`            | CRUD фонов и загрузка  |
| `/api/sprites/:characterId`   | Управление выражениями лица у спрайтов |
| `/api/fonts`                  | Управление своими шрифтами       |
| `/api/gallery/:chatId`        | Изображения галереи для чата      |
| `/api/global-gallery`         | Изображения общей галереи        |
| `/api/tts`                    | Маршруты синтеза речи        |
| `/api/youtube`                | Маршруты YouTube DJ              |
| `/api/custom-emojis`          | Свои эмодзи          |
| `/api/custom-stickers`        | Свои наклейки        |
| `/api/gifs/search`            | Поиск GIF (прокси к Giphy)     |

### Внешние интеграции

| Префикс                          | Описание                  |
| ------------------------------- | ---------------------------- |
| `/api/bot-browser/chub/*`       | Поиск персонажей на Chub        |
| `/api/bot-browser/chartavern/*` | Поиск на CharacterTavern           |
| `/api/bot-browser/janny/*`      | Поиск на JannyAI                |
| `/api/bot-browser/pygmalion/*`  | Поиск на Pygmalion              |
| `/api/bot-browser/wyvern/*`     | Поиск на Wyvern                 |
| `/api/bot-browser/datacat/*`    | Поиск на DataCat                |
| `/api/haptic/*`                 | Управление тактильными устройствами        |
| `/api/spotify/*`                | Авторизация Spotify                 |
| `/api/knowledge-sources`        | База знаний для поиска |

### Системные

| Точка                        | Описание                             |
| ------------------------------- | --------------------------------------- |
| `/api/updates/check`            | Проверка версии по релизам на GitHub   |
| `/api/updates/latest`           | Метаданные последнего релиза              |
| `/api/updates/commits-behind`   | Насколько отстала установка из Git             |
| `/api/backup`                   | Полная резервная копия, экспорт, импорт             |
| `/api/import/*`                 | Импорт профилей SillyTavern и Marinara |
| `/api/admin/clear-all`          | Полная очистка данных                     |
| `/api/themes`                   | Синхронизируемые темы оформления                  |
| `/api/personal-extensions`      | Политика изолированных расширений, черновики, одобрение, среда выполнения и приватное хранилище |
| `/api/app-settings`             | Настройки приложения на стороне сервера                |
| `/api/sidecar`                  | Локальный движок моделей                     |
| `/api/chat-presets`             | Профили настроек чата (устаревшее название точки) |
| `/api/connection-folders`       | Папки подключений                      |
| `/api/prompt-overrides`         | Переопределения встроенных промптов               |
| `/api/achievements`             | Открытые достижения                     |
| `/api/noodle`                   | Социальная лента Noodle                  |
| `/api/professor-mari/workspace` | Операции с рабочей областью Professor Mari     |

## Поддержка PWA

Приложение собрано как PWA и настроено через VitePWA:

- Манифест: `public/manifest.json` с названием приложения "Marinara Engine", режимом отображения standalone и темной темой.
- Иконки: значок сайта 64px, маскируемые иконки 192px и 512px, а также логотип для заставки.
- Service worker: Workbox со стратегией автоматического обновления.
- Кеширование: статические ресурсы кешируются, для маршрутов `/api/*` используется NetworkOnly.
- Поддержание активности: `lib/keep-alive.ts` использует Web Locks API вместе с пингами через BroadcastChannel, чтобы вкладка не засыпала.

### Определение расхождения версий

`App.tsx` опрашивает `/api/health` каждые 5 минут. Если версия сервера отличается от версии, закешированной клиентом, клиент снимает регистрацию service worker. Он также очищает кеши, чтобы обновление применилось принудительно.

## Система агентов

Система агентов обрабатывает ответы ИИ настраиваемыми конвейерами. Агенты работают в трех фазах:

1. До генерации: перед основным вызовом LLM (например, вставка контекста или поиск по знаниям).
2. Параллельно: одновременно с основной генерацией (например, отслеживание состояния мира или бой).
3. После обработки: после основного ответа (например, переписывание текста или обновление лорбуков).

Повторные запуски идут через `/api/generate/retry-agents` с явным списком `agentTypes`. Общее действие в интерфейсе – например, кнопка **Re-run Trackers** (перезапустить трекеры) – передает все активные типы трекеров. Отдельный элемент управления в виджете передает только свой трекер.

Инструменты памяти агентов, например панель Secret Plot у Narrative Director, обращаются к `/api/agents/memory/:agentType/:chatId`. Маршрут работает для тех настроенных агентов, которые хранят память по каждому чату. Память Secret Plot в актуальных настройках лежит под `director`, а `secret-plot-driver` по-прежнему принимается для старых чатов.

### Официальные агенты для скачивания

Облегченный движок поставляется с пустым реестром агентов. Пакеты, установленные из публичного каталога [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents), добавляют во время выполнения проверенные манифесты агентов, точки входа для клиента и сервера, а также места в интерфейсе. Активные описания по-прежнему доступны через `BUILT_IN_AGENTS` для совместимости, но берутся из установленных пакетов, а не из встроенных реализаций. В официальном каталоге есть такие пакеты:

| Агент                    | Фаза           | Что делает                                                      |
| ------------------------ | --------------- | ----------------------------------------------------------------- |
| `prose-guardian`         | post_processing | Следит за качеством текста (борьба с повторами, "показывай, а не рассказывай")       |
| `continuity`             | post_processing | Находит нарушения логики повествования и может выдать указания для переписывания        |
| `director`               | pre_generation  | Вставляет указания по сюжету и, если нужно, состояние Secret Plot       |
| `echo-chamber`           | parallel        | Имитирует реакции публики                                      |
| `world-state`            | post_processing | Извлекает из повествования дату, время, место и погоду     |
| `expression`             | post_processing | Подбирает выражения лица для спрайтов персонажей                              |
| `quest`                  | post_processing | Отслеживает появление, изменение и завершение квестов                    |
| `background`             | post_processing | Подбирает подходящие фоновые изображения                                |
| `character-tracker`      | post_processing | Отслеживает изменения состояния персонажей                                |
| `persona-stats`          | post_processing | Отслеживает изменения характеристик персоны игрока                                |
| `custom-tracker`         | post_processing | Отслеживает состояние по вашим собственным правилам                                |
| `inventory-tracker`      | post_processing | Отслеживает валюту, надетое снаряжение и переносимые предметы                       |
| `illustrator`            | post_processing | Создает промпты для изображений сцены и запросы к медиа                  |
| `lorebook-keeper`        | post_processing | Сам создает и обновляет записи лорбуков                                |
| `card-evolution-auditor` | post_processing | Проверяет карточки персонажей и предлагает их развитие                    |
| `combat`                 | parallel        | Отслеживает раунды боя, HP, инициативу и исходы                |
| `html`                   | post_processing | Переписывает готовые ответы в режиме Roleplay, добавляя внутримировые визуальные вставки на HTML |
| `spotify`                | post_processing | Управляет воспроизведением Music DJ (Spotify, YouTube или локальная музыка)         |
| `knowledge-retrieval`    | pre_generation  | Достает контекст из источников знаний                  |
| `knowledge-router`       | pre_generation  | Подбирает подходящие записи лорбуков и знаний                  |
| `haptic`                 | post_processing | Отправляет команды тактильным устройствам                              |
| `cyoa`                   | post_processing | Создает варианты выбора                                          |
| `conversation-calls`     | feature         | Добавляет аудио- и видеозвонки в режиме Conversation и связанные настройки          |
| `hierarchical-maps`      | feature         | Добавляет карты, пространственный контекст и перемещение в Roleplay и Game Mode             |
| `uno`                    | feature         | Добавляет стол UNO в режиме Conversation                              |
| `chess`                  | feature         | Добавляет шахматную доску в режиме Conversation                             |
| `poker`                  | feature         | Добавляет стол Texas Hold'em в режиме Conversation                         |
| `eightball`              | feature         | Добавляет бильярдный стол 8-Ball в режиме Conversation                     |
| `tic-tac-toe`            | feature         | Добавляет поле для крестиков-ноликов в режиме Conversation                       |
| `rock-paper-scissors`    | feature         | Добавляет игру в камень-ножницы-бумагу в режиме Conversation                     |

### Типы результатов агентов

Агенты выдают типизированные результаты, которые обрабатывает клиент. Объединение `AgentResultType` в `packages/shared/src/types/agent.ts` включает:

`game_state_update`, `text_rewrite`, `sprite_change`, `echo_message`, `quest_update`, `image_prompt`, `context_injection`, `continuity_check`, `director_event`, `lorebook_update`, `character_card_update`, `background_change`, `character_tracker_update`, `persona_stats_update`, `custom_tracker_update`, `inventory_tracker_update`, `spotify_control`, `youtube_control`, `local_music_control`, `haptic_command`, `cyoa_choices`, `secret_plot`, `game_master_narration`, `party_action`, `game_map_update`, `game_state_transition`, `prompt_patch`, `frontend_theme_update` и `about_me_update`.

## Режимы чата

### Режим Conversation

Обычный диалог с одним или несколькими персонажами на базе ИИ. У персонажей могут быть разные статусы активности (online, idle, do not disturb, offline), которые влияют на скорость и стиль ответов. Встроенные агенты добавляются к каждому чату отдельно, а не включаются глобально.

### Режим Roleplay

Погружающее повествование с отслеживанием состояния мира: контекст сцены (место, время, погода), присутствие и настроение персонажей, характеристики игрока, инвентарь и квесты, сражения, World Info из лорбуков и выражения лица спрайтов.

### Game Mode

Сессии с Game Master на базе ИИ: участники отряда, кубики, состояние мира, ресурсы, раскадровки, журнал и четкий жизненный цикл сессии. Game Mode использует отдельные хранилища и маршруты для состояния мира, ресурсов, настольных игр, видео сцен и раскадровок. Порядок работы для пользователя описан в руководстве [Game Mode: начало работы](../game/getting-started.md).

## Разработка

### Команды

Установка зависимостей:

```bash
pnpm install
```

Запуск сервера и клиента с горячей перезагрузкой:

```bash
pnpm dev
```

Запуск только клиентского сервера разработки:

```bash
pnpm dev:client
```

Запуск только сервера API:

```bash
pnpm dev:server
```

Базовая проверка (TypeScript вместе с ESLint):

```bash
pnpm check
```

Сборка для продакшена:

```bash
pnpm build
```

### Лимиты бандла

- Основная точка входа: максимум 1 MB.
- Каждый фрагмент: максимум 500 KB.
- Отдельные пакеты вендоров: react, tanstack, motion, zustand, icons и misc.

### Псевдоним пути

`@/*` разворачивается в `./src/*` – и в настройках TypeScript, и в настройках Vite.

## Смежные руководства

- [Карта архитектуры (для разработчиков)](architecture-map.md)
- [Файловое хранилище](file-storage.md)
