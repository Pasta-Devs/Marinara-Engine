# Внутреннее устройство промптов Noodle (для разработчиков)

Справка для разработчиков: где в коде лежат промпты генерации для Noodle, как их менять и как разобрать итоговый промпт. Промпт – это текст, который Marinara отправляет ИИ. Обычные пользователи настраивают Noodle через панель **Settings** (настройки); об этом рассказывают руководства в папке `docs/noodle/`.

Noodle – это скачиваемый пакет. Его маршруты (`/api/noodle`, регистрируются при активации пакета) и код генерации находятся в пакете Noodle в репозитории [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents), в папке `packages/noodle/src/engine/packages/server/src/`. В таблице ниже источник с пометкой **package** указан относительно этой папки. Engine хранит общие схему и типы Noodle, хранилище Noodle, зарегистрированные переопределения промптов, которые перечислены в Settings, и текст промпта ленты по умолчанию в `packages/server/src/services/noodle/noodle-prompt.ts`. Пакет хранит собственные копии `services/prompt-overrides/registry/noodle.ts` и `services/noodle/noodle-prompt.ts`.

## Карта источников промптов

У Noodle есть один собираемый промпт ленты, встроенный в код промпт профилей и три зарегистрированных переопределения промптов: два для системного промпта ленты и одно для изображений постов.

| Назначение | Источник | Основной символ | Как изменить |
| --- | --- | --- | --- |
| Посты в ленте, ответы, подписки, опросы, голоса и сводки | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildRefreshPrompt()` | Системное сообщение – это переопределение **Noodle Timeline Prompt**, за которым следует переопределение **Noodle Timeline Voice & Tone** (оба см. ниже). Два пользовательских сообщения, контекст (аккаунты, персона, профили, расписания, лор, контекст чатов по согласию, лента, включенные функции и квоты) и сообщение `# JSON Output Format` собираются в коде. |
| Базовый системный промпт ленты | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_BASE` (`noodle.timelineBase`) | Правьте **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Prompt** либо меняйте `NOODLE_TIMELINE_BASE_DEFAULT_PROMPT` в файле `noodle-prompt.ts` в коде. Значение по умолчанию содержит правила платформы для взрослых, авторства персоны, взаимодействий и JSON, поэтому переписанный текст может сломать разбор `noodleGeneratedRefreshSchema`. |
| Указания по тону и голосу ленты (добавляются после базового промпта) | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_VOICE` (`noodle.timelineVoice`) | Правьте **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Voice & Tone** либо меняйте зарегистрированное значение по умолчанию в коде (`noodleTimelineVoiceDefaultText(enhanced, allowRandomUsers)` в файле `noodle-prompt.ts`). Нетронутое значение по умолчанию следует настройке Noodle `enableEnhancedTimelineWriting` (`ctx.enhanced`; в выключенном состоянии, как и по умолчанию, воспроизводит исходное однострочное указание по тону) и тому, разрешены ли случайные пользователи. Как только свой текст переопределения сохранен, он действует независимо от этих настроек. |
| Профили аккаунтов персонажей при первом запуске | **package** `services/noodle/noodle-public-profiles.service.ts` | `generateMissingNoodleProfiles()` | Правьте встроенные системные и пользовательские сообщения в коде. Сначала выполняется отбор участников, и в этот промпт попадают только выбранные аккаунты персонажей без `profileGenerated`. |
| Промпт изображения для сгенерированного поста | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_IMAGE_POST` (`noodle.imagePost`) | Правьте **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Post Image** либо меняйте зарегистрированное значение по умолчанию в коде. |
| Указания по изображениям, свойственные Noodle, по умолчанию | `packages/shared/src/schemas/noodle.schema.ts` | `DEFAULT_NOODLE_SETTINGS.imageGenerationPrompt` | Меняйте настройку Noodle в интерфейсе или значение по умолчанию в схеме в коде. |
| Контекст чата, добавленный по согласию и вставленный в генерацию ленты | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildOptedInChatContext()` | Меняйте сборку контекста в коде; согласие остается в настройках каждого чата. |
| Изображения на входе для постов и ответов ленты | **package** `services/noodle/noodle-vision.ts` | `prepareNoodleVisionAttachments()` | Меняйте в коде отбор изображений, нормализацию, лимиты или запасной вариант только с текстом. |
| Активность Noodle, вставленная в промпты чата | **package** `services/noodle/noodle-context.ts` | `buildRecentSocialMediaActivityBlock()` | Пакет регистрирует ее как сервис `noodle:prompt-context`. Меняйте фильтрацию или сборку блока в коде. Целевые режимы и лимит элементов пользователь задает в настройках Noodle, а на итоговый блок действует жесткий предел 8192 токенов. |
| Контракт сгенерированного JSON | `packages/shared/src/schemas/noodle.schema.ts` | `noodleGeneratedRefreshSchema` | Меняйте только вместе с промптом, обработкой маршрута, общими типами и регрессионными проверками. |
| Контекст мира и лора из лорбуков, вставленный в генерацию ленты | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildRefreshPrompt()` (вызывает `processLorebooks()`) | Работает только при включенной настройке Noodle **Lorebook context** (`enableLorebookContext`, по умолчанию выключена). Используется тот же многоперсонажный `processLorebooks()`, что и в групповых чатах, но со своим лимитом токенов из `noodleLorebookTokenBudget()` в файле `noodle-prompt.ts`: он растет вместе с числом активных персонажей и жестко ограничен 8192 токенами. Вызов идет с `previewOnly: true`, потому что у Noodle нет слота отдельного чата, где хранилось бы состояние закрепления и задержек. |

Промпт профилей в интерфейсе переопределения промптов не показан. Шаблоны **Noodle Timeline Prompt**, **Noodle Timeline Voice & Tone** и **Noodle Post Image** там есть. Когда включено **Noodle image generation** (генерация изображений Noodle; `enableImagePrompts`), настройка Noodle **Image instructions (sent to your LLM)** (указания для изображений, отправляются вашей LLM) уходит модели ленты, и та следует ей, когда пишет идею изображения для каждого поста. Шаблон **Noodle Post Image** по умолчанию больше не добавляет ее, но пользовательские шаблоны по-прежнему могут использовать ее как `${userInstructions}`.

Сервис изображений (**package** `services/noodle/noodle-public-images.service.ts`) загружает `NOODLE_IMAGE_POST`, а затем пропускает результат через `compileImagePrompt()` и только после этого отправляет провайдеру изображений. Значит, на итоговый запрос влияют еще и выбранный профиль стиля изображений и значения по умолчанию из подключения.

## Разбор итоговых промптов

Если запросить обновление вручную при включенном режиме **Debug Mode** (режим отладки), итоговые сообщения модели для профилей и для ленты попадут в общий журнал сервера. Ищите строки:

```text
[debug/noodle] Profile prompt sent to model
[debug/noodle] Prompt sent to model
[debug/noodle] Attached N timeline image input(s) to the refresh prompt
```

Сами изображения ленты никогда не пишутся в журнал отладки в виде base64. В тексте журнала остаются те же ключи вложений постов и ответов, что уходят модели, плюс число нативных изображений на входе. Noodle нормализует эти входные данные и ограничивает их количество в файле `noodle-vision.ts`. Если провайдер прямо отказывается принимать изображения, пакет пишет об этом в журнал и отправляет собранный запасной промпт только с текстом.

Для изображений включите **Expose media prompts before sending** (показывать промпты медиа перед отправкой) в разделе **Settings -> Generations -> Overall Generations**. Так вы увидите итоговые собранные положительный и отрицательный промпты и сможете их отредактировать до отправки запроса.

## Безопасная правка

Сборка промпта – это граница совместимости с высоким риском. При правке держите согласованными сам промпт, `noodleGeneratedRefreshSchema`, обработку маршрута, а также регрессионные проверки упоминаний и опросов в Noodle. В Engine запустите как минимум:

```bash
pnpm check
pnpm regression:prompt
pnpm regression:noodle
```

Изменения в коде, принадлежащем пакету, вносятся и проверяются в Marinara-Agents, в его ветке `staging`.

## Смежные руководства

- [Noodle: встроенная социальная лента](../noodle/overview.md)
- [Настройки Noodle и перенос в чаты](../noodle/settings.md)
- [Дополнительные пакеты агентов и возможностей](optional-agent-packages.md)
- [Карта архитектуры (для разработчиков)](architecture-map.md)
