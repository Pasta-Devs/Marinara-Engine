# Обзор настроек

Узнайте, в какой части **Settings** (настройки) находится нужный элемент управления, настройте вкладку **General** (общие) и поймите, как ваши настройки синхронизируются между устройствами.

## Панель Settings и ее шесть вкладок

Панель **Settings** открывается значком шестеренки на верхней панели. Сверху находится поле **Search settings** (поиск по настройкам). Введите слово, например `delete`, `streaming` или `quotes`, и Marinara перенесет вас к нужному разделу. Поиск находит названия на языке вашего интерфейса и на английском.

В панели шесть вкладок. У каждой вкладки свои разделы.

### Что вы хотите сделать

| Что нужно | Куда идти |
| --- | --- |
| Сменить язык | **Settings → General → App Behavior → Language** |
| Увеличить текст | **Settings → Appearance → App → Text & Scale** |
| Сменить тему или цвета | **Settings → Appearance → App → App Style** |
| Задать звук уведомления | **Settings → General → Notifications** |
| Отключить подтверждение удаления | **Settings → General → App Behavior** |
| Добавить быстрые ответы | **Settings → General → Input & Editing** |
| Сделать резервную копию | **Settings → Advanced → Backup & Export** |
| Удалить мои данные | **Settings → Advanced → Danger Zone** |
| Обновить Marinara | **Settings → Advanced → Updates** |

### Что находится на каждой вкладке

**General** (общие; это руководство)

- **App Behavior** (с пунктом **Search and Professor Mari settings**)
- **Notifications**
- **Responses**
- **Input & Editing**
- **Text Rules**
- **Game Playback**

**Appearance** (оформление) содержит четыре кнопки. См. [Настройки оформления](../appearance/appearance-settings.md).

- **App**: **App Style**, **Text & Scale**, **Atmosphere**, **Backgrounds**
- **Conversation**: **Conversation Display**, **Conversation Theme**
- **Roleplay**: **Tracker Panel**, **Roleplay Presentation**
- **Game**: **Game Presentation**

**Generations** (генерации) содержит **Overall Generations**, **Image Generation**, **Video Generation** и **Prompt Overrides**. Пока вы не установите агент Illustrator, эта вкладка показывает только предложение скачать его. См. [Профили стиля](../media/style-profiles.md) и [Генерация видео сцены](../media/scene-video.md).

**Addons** (дополнения) содержит историю ревизий расширений, **Personal Extensions**, **External Extensions** (только когда вы их разблокировали) и **Theme Library**. См. [Личные расширения](../extending/personal-extensions.md) и [Собственные темы оформления на CSS (Theme Library)](../appearance/custom-css-themes.md).

**Imports** (импорт) содержит **Profile & Marinara**, **SillyTavern Import** и **Game Assets**. См. [Резервное копирование и восстановление Marinara](../data/backup-and-restore.md) и [Импорт данных из SillyTavern](../data/importing-from-sillytavern.md).

**Advanced** (расширенные) содержит эти разделы в таком порядке. См. [Вкладка Advanced](#the-advanced-tab).

- **Multiplayer WIP**
- **Access**
- **Admin Access**
- **Features**
- **Updates**
- **Support Diagnostics**
- **Request timeouts**
- **Parameters**
- **Message Tools**
- **Backup & Export**
- **Storage Optimization**
- **Danger Zone**

## Вкладка General

Каждый раздел вкладки **General** находится в **Settings → General**.

| Раздел | Чем управляет |
| --- | --- |
| **App Behavior** | Язык, защита от удаления, переключатели показа и скрытия, пункт **Search and Professor Mari settings**. См. [App Behavior](#app-behavior). |
| **Notifications** | Звуки уведомлений, уведомления браузера и Android. См. [Notifications](#notifications). |
| **Responses** | Стриминг, обрезка и **Messages per page**. См. [Отправка сообщений и стриминг](../chats/sending-and-streaming.md). |
| **Input & Editing** | **Send on Enter**, **Quick replies**, быстрые действия для свайпов и правки. См. [Input and Editing](#input-and-editing). |
| **Text Rules** | Как оформляется текст чата. См. [Text Rules](#text-rules). |
| **Game Playback** | Чтение и переходы в режиме Game Mode. См. [Game Mode: начало работы](../game/getting-started.md). |

<a id="app-behavior"></a>

### App Behavior

| Настройка | Что делает |
| --- | --- |
| **Language** | Задает язык интерфейса. Не меняет промпты для модели и содержимое чата. Непереведенный текст показывается по-английски. Арабский использует расположение справа налево. По умолчанию: английский. |
| **Documentation Language** | Задает язык встроенных руководств. См. ниже. По умолчанию: английский. |
| **Confirm before deleting** | Спрашивает подтверждение, прежде чем Marinara окончательно удалит чат, персонажа или другой элемент. По умолчанию: включено. |
| **Hide chat Help button** | Скрывает кнопку **Help** в чатах Conversation, Roleplay и Game. По умолчанию: выключено. |
| **Show Android status bar** | Оставляет время, заряд и значки уведомлений видимыми над Marinara. Работает только в приложении для Android. По умолчанию: выключено. |
| **Achievements** | Отслеживает достижения, показывает сообщения о получении, закладку и виджет на главном экране. См. [Достижения](../home/achievements.md). По умолчанию: включено. |
| **Disable seasonal ME themes** | Отключает сезонные темы Marinara. По умолчанию: выключено. |
| **Music Player** | Показывает компактный проигрыватель Music Player. Нужен агент **Music DJ** из **Agents → Agent Organizer**, и пока вы его не установите, переключатель неактивен. См. [Music DJ: Spotify, YouTube и локальная музыка](../media/music.md). По умолчанию: включено. |

**Search and Professor Mari settings** – это пункт внизу раздела **App Behavior**. Выберите **Open**, чтобы перейти на страницу настроек поиска, быстрых ответов и Professor Mari. См. [Professor Mari](../home/professor-mari.md).

Языки интерфейса: арабский, упрощенный китайский, английский, французский, немецкий, хинди, японский, корейский, польский, бразильский португальский, русский и испанский. Чтобы улучшить перевод или добавить язык, см. [Локализация интерфейса](../development/localization.md).

Для **Documentation Language** английский встроен. Выберите другой язык и нажмите **Download & Replace** (скачать и заменить). Marinara один раз скачивает этот языковой пакет и удаляет предыдущий, поэтому скачанным остается один язык. Еще не переведенные руководства открываются по-английски с маленьким значком `EN`. Поиск по документации работает на активном языке. Ваш выбор сохраняется после обновлений, а пакет обновляется после обновления, если его переводы изменились. Если скачанные руководства пропали или повреждены, появляется кнопка **Fix documentation** (исправить документацию). Она скачивает пакет заново или возвращает руководства к английскому, если источник загрузки недоступен.

<a id="notifications"></a>

### Notifications

Для уведомлений Marinara проигрывает встроенный сигнал. Чтобы использовать свой звук:

1. Откройте **Settings → General → Notifications**.
2. Загрузите **Custom sound**: MP3, WAV, OGG, M4A, MP4 или WebM, до 10 МБ.

Звук проигрывается на каждом устройстве, подключенном к этому серверу. Его можно прослушать, заменить или удалить. Если файл не читается, Marinara проигрывает встроенный сигнал. Файл входит в резервные копии и экспорт профиля.

**Background Notifications** относятся к сообщениям Conversation, которые персонажи отправляют сами. **Generation Completion Notifications** относятся к ответам, которые вы запускаете сами в режимах Conversation, Roleplay и Game Mode. Оба варианта работают, пока Marinara открыта, но окно не в фокусе. Они никогда не показывают текст сообщений.

<a id="input-and-editing"></a>

### Ввод и правка

Настройки в **Settings → General → Input & Editing**:

| Настройка | Что делает |
| --- | --- |
| **Send on Enter** | Выбирает, в каких режимах Enter отправляет сообщение. |
| **Keep guidance after regenerating** | Оставляет ваше направление в поле сообщения после направляемой повторной генерации. По умолчанию включено. |
| **Add CYOA choices to the message box instead of sending them** | Помещает нажатый вариант в поле сообщения, чтобы вы могли сначала его изменить. |
| **Quick replies** | Добавляет действия для черновиков рядом с кнопкой Send. См. [Направляемая генерация и Impersonate](../chats/guided-and-impersonate.md). |
| **Speech-to-text microphone** | Показывает кнопку микрофона в полях ввода чата. |
| **Intuitive swipe navigation** | Переключает между свайпами (несколькими ответами на одно сообщение) стрелками или жестом на сенсорном экране. |
| **Reroll past the newest swipe** | Создает новый ответ, когда вы листаете дальше самого свежего свайпа. |
| **Up Arrow edits last message** | Нажмите Up Arrow в пустом поле, чтобы править последнее сообщение. |
| **Double-click edits messages** | Двойное нажатие по сообщению Roleplay открывает его на правку. |

В разделе **Responses** есть **Enable streaming**, **Streaming speed**, **Trim incomplete sentences from the response**, **Add a new line before /continue text** (по умолчанию включено) и **Messages per page**. См. [Отправка сообщений и стриминг](../chats/sending-and-streaming.md). О действиях с сообщениями см. [Действия с сообщением: редактирование, удаление, свайпы, повторная генерация](../chats/messages.md).

<a id="text-rules"></a>

### Правила текста

Эти правила меняют обработку текста чата в **Settings → General → Text Rules**. **Bold dialogue in quotes** и **Convert LaTeX symbols** меняют только вид текста, поэтому сохраненные сообщения остаются прежними. **Quote style** переписывает кавычки в тексте, который вы набираете и сохраняете.

| Настройка | Что делает |
| --- | --- |
| **Bold dialogue in quotes** | Показывает текст в кавычках полужирным. По умолчанию включено. |
| **Convert LaTeX symbols** | Показывает математические команды LaTeX как символы. Код не затрагивается. По умолчанию включено. |
| **Quote style** | **Straight** оставляет простые знаки (по умолчанию). **Typographic** заменяет их на изогнутые кавычки и апострофы. |
| **Load images from other websites in messages** | Управляет изображениями, размещенными на других сайтах. По умолчанию выключено. |

#### Bold dialogue in quotes

Когда настройка включена, слова в кавычках в строке `"I missed you," she said.` показываются полужирным. Выключите ее, чтобы оставить цвет прямой речи без полужирного.

#### Convert LaTeX symbols

Некоторые модели записывают формулы командами LaTeX. Когда настройка включена, `\rightarrow`, `\neq`, `\times` и `\alpha` показываются как `→`, `≠`, `×` и `α`.

#### Load images from other websites in messages

Когда настройка выключена, изображение с другого сайта в сообщении, приветствии или предпросмотре карточки показывает название сайта и кнопку **Load image**. Так сообщение не может само обращаться к другим сайтам. Выберите **Load image**, чтобы показать это изображение. Marinara запоминает ваш выбор на всех ваших устройствах. Включите настройку, чтобы сразу показывать все изображения. Изображения, которые хранятся в Marinara, например картинки галереи, аватары и спрайты, показываются всегда.

<a id="the-advanced-tab"></a>

## Вкладка Advanced

| Раздел | Где читать подробнее |
| --- | --- |
| **Admin Access** | [Удаленный доступ](../REMOTE_ACCESS.md) |
| **Features** | [Переключатели функций](../configuration/features.md) |
| **Updates** | [Обновление приложения Marinara Engine](../UPGRADING.md) |
| **Message Tools** | [Message Tools](#message-tools) |
| **Backup & Export** | [Резервное копирование и восстановление Marinara](../data/backup-and-restore.md) |
| **Danger Zone** | [Очистка и сброс данных](../data/clearing-data.md) |

<a id="message-tools"></a>

### Message Tools

Эти переключатели находятся в **Settings → Advanced → Message Tools**. Все выключены по умолчанию, кроме **Show context usage** и **Show "older messages not sent" note**.

| Переключатель | Что делает |
| --- | --- |
| **Show message timestamps** | Показывает дату и время у каждого сообщения. |
| **Show characters in Persona pickers** | Показывает ваших персонажей в списках выбора персоны, чтобы можно было играть за одного из них. |
| **Show model name on messages** | Показывает, какая модель написала каждый ответ. |
| **Show token usage on messages** | Показывает число токенов промпта и ответа у каждого сообщения. |
| **Show context usage** | Показывает, насколько был заполнен контекст при последнем измеренном запросе, в переключателях подключений и в настройках чата Game. |
| **Show message numbers** | Показывает номер у каждого сообщения. |
| **Show "older messages not sent" note** | Показывает пометку под самым новым ответом, если старые сообщения не поместились в промпт. Обрезанный или пустой ответ все равно показывает свою пометку. |
| **Guide swipes/regens with chat input** | Использует ваш черновик как указание при повторной генерации. |
| **Include reasoning in exports** | Добавляет скрытые размышления модели в экспорт чата. |
| **Include private notes in exports** | Добавляет ваши личные заметки к сообщениям в экспорт JSONL и текст. Держите выключенным, когда делитесь расшифровкой. |
| **Debug mode** | Записывает данные запросов к модели в консоль сервера для поддержки. |

Подробнее см. [Действия с сообщением: редактирование, удаление, свайпы, повторная генерация](../chats/messages.md), [Персоны: создание и редактирование](../characters/personas.md), [Выбор модели для одного чата](../connections/connecting-to-a-provider.md#choosing-a-model-for-one-chat), [Peek Prompt: посмотреть, что получила модель ИИ](../chats/peek-prompt.md), [Направляемая генерация и Impersonate](../chats/guided-and-impersonate.md), [Экспорт и импорт чатов](../chats/export-import.md) и [Устранение неполадок](../TROUBLESHOOTING.md).

## Как настройки синхронизируются между устройствами

Marinara хранит большинство настроек на сервере, поэтому они следуют за вами между браузерами и устройствами.

1. Вы меняете настройку в **Settings**.
2. Примерно через секунду Marinara сохраняет ее на сервере.
3. Другой браузер, который открывает тот же сервер, загружает эти настройки.

Побеждает последнее изменение. Если вы откроете Marinara на втором устройстве вскоре после изменения, его более старая копия может заменить ваше изменение. Немного подождите, прежде чем переходить на другое устройство.

Две настройки не синхронизируются никогда. Задайте их заново на каждом устройстве в **Settings → Appearance → Text & Scale**:

- **Display Size** – размер текста интерфейса
- **Chat Font Size** – размер текста в чате

См. [Настройки оформления](../appearance/appearance-settings.md). Если сервер недоступен, приложение продолжает работать с локальными настройками и повторяет попытку при следующем изменении.

## Смежные руководства

- [Настройки оформления](../appearance/appearance-settings.md)
- [Действия с сообщением: редактирование, удаление, свайпы, повторная генерация](../chats/messages.md)
- [Где Marinara хранит ваши данные](../data/where-data-is-stored.md)
- [Устранение неполадок](../TROUBLESHOOTING.md)
