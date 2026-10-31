# Архитектура Game Mode: наборы правил, проверки и бой

Это карта для тех, кто собирается менять код правил Game Mode: где читается набор правил, как разрешаются проверка и бой, где хранится состояние и что нужно для нового ключа набора правил. Документация для игроков находится в `docs/game/`, руководство для авторов наборов правил начинается с [`docs/extending/writing-rulesets.md`](../extending/writing-rulesets.md), а боевому ИИ посвящена отдельная страница [ИИ боя Game Mode](game-combat-ai.md).

## Где что находится

| Область | Код |
| --- | --- |
| Формат набора правил | `packages/shared/src/schemas/ruleset.schema.ts`: схема zod, `RulesetRef` (закрепление) и перекрестные проверки, выполняемые при импорте. Схема JSON Schema для редактора, `docs/extending/ruleset.schema.json`, создается из нее командой `pnpm ruleset:schema`. |
| Capability API | `supportedCapabilityApi` в `packages/shared/src/schemas/capability-package.schema.ts`, с отдельной строкой комментария для каждой минорной версии, описывающей ее добавления. |
| Расчеты листа персонажа и текущее состояние | `packages/shared/src/features/rulesets/`: `sheet-math.ts`, `live-state.ts` (операции `[sheet:]`), `sheet-commands.ts`, `sheet-builder.ts`, `layers.ts`, `item-*.ts`, `loot.ts`, `market.ts`, `combat-bridge.ts` (блок `battle`). |
| Бои по наборам правил | `packages/shared/src/features/ruleset-combat/`: `resolve.ts`, `options.ts` (что входит в меню), `grid.ts`, `sight.ts`, `zones.ts`, `creatures.ts`, `pool.ts`, `symbols.ts`, `dice.ts`. Все функции чистые, работают с `(definition, state)`. |
| Собственный бой Marinara | `packages/shared/src/features/tactical-combat/` (движок Tactical, создание сетки, ИИ), `combat-director.ts`, `combat-conditions.ts`. |
| Боевой ИИ | `packages/shared/src/features/combat-ai.ts`, `combat-minds.ts`; см. [ИИ боя Game Mode](game-combat-ai.md). |
| Сервер: наборы правил | `packages/server/src/services/game/ruleset-registry.service.ts` (читает установленные и импортированные наборы правил, разрешает закрепление игры), `ruleset-catalog.service.ts`, `ruleset-sheet-turn.service.ts` (применяет команды `[sheet:]` за ход), `game-ruleset-version.service.ts`, `routes/game-rulesets.routes.ts`. |
| Сервер: проверки и кости | `skill-check-resolution.service.ts`, `skill-check.service.ts`, `dice.service.ts`, `dice-pool.service.ts`, `one-request-dice.ts`, `dice-rng.ts`. |
| Сервер: бои | `combat-director.service.ts` (Classic и Tactical), `combat.service.ts` (расчеты раунда Classic, `resolveCombatRound`), `ruleset-combat-director.service.ts` (бой, который разрешает набор правил), `combat-ai.service.ts`, `combat-boss.service.ts`, `tactical-battlefield.service.ts`, `made-battlefield.service.ts`. Маршруты: `routes/combat-director.routes.ts` (запуск, состояние и команда режиссера), `routes/encounter.routes.ts`, а также более старые `POST /game/combat/round`, `/game/combat/tactical/start` и `/game/combat/tactical/action` в `routes/game.routes.ts`. |
| Промпт | `gm-prompts.ts` (`buildGmFormatReminder`, блоки листа персонажа и теги, которым обучают модель). |
| Клиент | `packages/client/src/components/game/`: `GameRulesetSheet.tsx`, `GameSetupRulesChooser.tsx`, `RulesetCombatScreen.tsx` и остальные `RulesetCombat*.tsx`, `TacticalCombatUI.tsx`, `GameCombatUI.tsx`, `DirectedCombatUI.tsx`. |

## Набор правил: от пакета до игры

1. **Источник.** Официальный набор правил – это пакет возможностей типа `ruleset`, в котором `ruleset.json` (и все `catalogs/<id>.json`) перечислены в `contributions.assets.paths`, а их хеши закреплены в `files[]`. Набор правил от сообщества импортируется как отдельный файл, файл пакета `<name>.ruleset.json` или из папки `rulesets/` репозитория и хранится под идентификатором с пространством имен (`local/<id>`, `<owner>/<id>`), поэтому он никогда не может подменить официальный набор.
2. **Язык.** Переводы официального набора правил – это отдельные языковые пакеты, перечисленные в его записи каталога; менеджер пакетов сохраняет только язык Engine (`syncRulesetLocalePack` в `package-manager.service.ts`). Импортированный файл пакета сохраняет только язык, активный при импорте.
3. **Реестр.** `ruleset-registry.service.ts` разбирает каждое определение по общей схеме и отбрасывает непригодные, записывая строку в журнал. Определения хранятся по идентификатору и версии; та же версия с другими байтами отклоняется.
4. **Закрепление.** При создании игры `chat.metadata.gameRuleset` записывается один раз: `{ id, version, packageId, source?, options }`, где `options` содержит выбранные слои. Отсутствие закрепления означает собственные правила Marinara. Если установка не может выполнить закрепление (набор отсутствует или его версия старее закрепленной), об этом сообщается, а проверки игры остаются неразрешенными; их никогда не разрешают по правилам другой системы.

## Состояние

| Часть | Содержимое | Где | Откатывается со свайпами |
| --- | --- | --- | --- |
| Начальная сборка персонажа | Лист персонажа, который игрок заполняет в карточке или персоне | В карточке `data.extensions.rulesetSheets[rulesetId]`, в персоне `personaStats.rulesetSheets[rulesetId]` | Неприменимо |
| Сборка персонажа в игре | Копия, сделанная при настройке, изменяемая через **Edit sheet** (изменить лист) и при повышении уровня | `chat.metadata.gameCharacterCards[].rulesetSheet` | Нет |
| Текущее состояние | Запасы, шкалы, состояния, статусы, заметки | `game_state_snapshots.ruleset_live` | Да |
| Бой | Столкновение, его начальное значение генератора и курсор костей, чей сейчас ход | Строка хранилища боевого режиссера, по одной на чат | Восстанавливается вместе с ходом, который его начал |

Текущее состояние принадлежит снимку, поэтому повторно сгенерированный ход никогда не списывает ресурс дважды. Хранимый лист персонажа имеет вид `{ v, build }`, ограничен 64 КБ и читается терпимо к отклонениям: неизвестные поля сохраняются, а отсутствующие получают значения по умолчанию. Разметка, перемещающая значения в новые идентификаторы, объявляет `sheet.migrations`, которые при чтении применяются через `readRulesetSheetEnvelope` и `readStoredLiveState`. Лист персонажа для неустановленного набора правил сохраняется неактивным и никогда не удаляется.

## Проверка от начала до конца

1. Game Master пишет `[skill_check: …]`, при необходимости добавляя `who=`, `with=`, название шага лестницы, чары или расход ресурса. Если включены броски в один запрос, вместо этого он может написать блок ветвления или заполнитель `[[roll: …]]` (`one-request-dice.ts`).
2. `skill-check-resolution.service.ts` читает закрепленный набор правил и выбирает обработку по `resolution.kind`: `dice-sum`, `dice-pool`, `dice-highest`, `roll-against` или `symbol-pool`. Числа, написанные моделью, проверяются и заменяются, если набор правил не подтверждает их достоверность; достоверность запасов костей, оставленных костей и результатов по диапазонам никогда не подтверждается.
3. Кости: проверка бросает кости через `rollDieSecurely` (Web Crypto, в `packages/shared/src/utils/dice-notation.ts`). Бой по набору правил, использование предметов в нем, добыча и рынки бросают кости через `seededDieRoller(seed, cursor)` из того же модуля, поэтому бой воспроизводится по начальному значению генератора. Начиная с #8608 другого механизма бросков нет.
4. Результат записывается обратно как полный тег и карточка броска, а также фиксируется в **Logs** (журнал).

## Команды листа персонажа

Game Master изменяет лист персонажа с помощью `[sheet: who="Name" op="…"]`. Тег может задавать операции `spend`, `restore` (псевдоним `heal`), `damage`, `temp`, `track`, `condition`, `state`, `note`, `rest`, `use` (псевдоним `cast`), `pass`, `advance`, `dismiss`, `prepare` и `unprepare` (`RULESET_SHEET_OP_NAMES` и `RulesetSheetOp` в `live-state.ts`). `ruleset-sheet-turn.service.ts` проверяет каждую операцию по текущему листу персонажа; невозможная операция, например применение заклинания без оставшейся ячейки, отклоняется, записывается в журнал и показывается один раз за ход, при этом ничто не применяется частично. `sheet` – зарезервированный тег GM.

## Бой от начала до конца

Бой в игре проходит в одном из трех стилей, выбранном набором правил и настройкой игры **Combat Preference** (предпочтение боя):

| Набор правил | Стиль | Сервер |
| --- | --- | --- |
| Отсутствует или нет блока `battle`/`combat` | Бой Classic или Tactical приложения Marinara | `combat-director.service.ts` |
| Блок `battle` | Бой Marinara с запасами, ячейками и навыками из каталога листа персонажа; здоровье переносится как доля максимума и записывается обратно | `combat-director.service.ts` с `combat-bridge.ts` |
| Блок `combat` | Собственный бой набора правил, на поле боя, если `combat` задает расстояние клетки, а игра идет в Tactical | `ruleset-combat-director.service.ts` |

Все три используют общий журнал режиссера: одна строка хранилища на чат, одна ревизия, защита по идентификатору запроса и очередь для каждого чата. Журнал охватывает только бои, работающие через режиссера. Более старые маршруты в `game.routes.ts`, `POST /game/combat/round` (который вызывает `resolveCombatRound` для переданных ему участников боя), `/game/combat/tactical/start` и `/game/combat/tactical/action`, не ведут журнал: клиент хранит состояние боя и отправляет его обратно с каждым вызовом. В бою по набору правил меню определяет допустимость (`options.ts`), обработчик разрешения применяет выбор (`resolve.ts`), кости зависят от начального значения генератора боя и курсора, а все, что член отряда тратит или теряет, записывается по собственным правилам листа персонажа, поэтому при закрытии вкладки посреди боя ничего не теряется. Противники, которых никто не прописал, создаются по бестиарию и бюджету столкновения набора правил; Game Master может играть за именованных противников и боссов, выбирая из ранжированных предложений Engine.

## Добавление ключа набора правил

1. Добавьте его в `ruleset.schema.ts` вместе с перекрестными проверками и в типы TypeScript, которые читает обработчик разрешения.
2. Повысьте `supportedCapabilityApi` на одну минорную версию и добавьте для нее строку комментария. Ограничьте доступность ключа так, чтобы использующий его набор правил был обязан объявить эту минорную версию или новее.
3. Сначала реализуйте его в чистом общем коде, затем подключите сервер, затем клиент.
4. Выполните `pnpm ruleset:schema`, чтобы заново создать `docs/extending/ruleset.schema.json`.
5. Опишите его на соответствующей странице руководства для авторов (`docs/extending/ruleset-*.md`), а также в документации для игроков, если игроки его увидят.
6. Добавьте `scripts/regressions/*.regression.ts`, проверяющий его через чистый код, в том числе на отклоняемых входных данных.
7. Перечислите измененные английские страницы в открытой задаче `[docs-i18n]`.

`docs/development/ruleset-5e-2014.example.json` – сокращенный черновик 5e, который сотни регрессионных и сквозных тестов читают как тестовые данные. Это не поставляемый пакет SRD, который находится в Marinara-Agents в `packages/ruleset-5e-2014/`.

## Незавершенная работа

- Полет над препятствиями на поле боя набора правил: летающее существо перемещается так же, как все остальные.
- Призыв в собственных боях Classic и Tactical приложения Marinara (в боях по наборам правил призыв уже есть). Проект описан в разделе [ИИ боя Game Mode](game-combat-ai.md#summoning-design-extension).
- Агент Battlefield Scout Agent, который готовит описание местности для боя и описан в разделе [ИИ боя Game Mode](game-combat-ai.md#encounter-environment-agent-handoff).
