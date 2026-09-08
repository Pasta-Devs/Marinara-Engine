# 界面本地化

Marinara Engine 只本地化应用界面上的文字。模型提示词、用户内容、生成的聊天内容、标识符、协议值、文件路径以及持久化保存的机器值都保持原样。

英语是标准语言，也是运行时的回退语言。因此某个社区翻译缺失时，界面显示的是英文原文，而不是翻译键名或一个空白控件。

界面语言在 **Settings > General > App Behavior > Language**(设置 > 通用 > 应用行为 > 语言) 里选择。这里改的只是 Marinara 的控件和说明文字，不影响模型提示词、创作内容和聊天消息。

选择英语以外的语言时，会在需要时下载对应的语言包。**Refresh language pack**(刷新语言包)可获取更新的翻译。下载的语言包保存在 `DATA_DIR/ui-packs`，可离线使用。下载失败不会改变当前语言或已安装的语言包。启动或更新时不会自动下载语言包。

首次从内置翻译的版本升级时，之前选择的非英语语言会回退到英语。请重新选择该语言以下载语言包。用户内容和其他设置均不变。

## 支持的界面语言

| 语言 | 语言文件 | 文字方向 |
| --- | --- | --- |
| 阿拉伯语 | `ar.json` | 从右向左 |
| 简体中文 | `zh-Hans.json` | 从左向右 |
| 英语 | `en.json` | 从左向右 |
| 法语 | `fr.json` | 从左向右 |
| 德语 | `de.json` | 从左向右 |
| 印地语 | `hi.json` | 从左向右 |
| 日语 | `ja.json` | 从左向右 |
| 韩语 | `ko.json` | 从左向右 |
| 波兰语 | `pl.json` | 从左向右 |
| 巴西葡萄牙语 | `pt-BR.json` | 从左向右 |
| 俄语 | `ru.json` | 从左向右 |
| 西班牙语 | `es.json` | 从左向右 |

英语作为源语言目录维护。社区目录最初借助机器翻译创建，欢迎熟练掌握相应语言的人士修正。界面文本提取仍在进行中，因此没有翻译键的文本会继续显示英语。

## 语言文件

规范英语目录仍位于：

```text
packages/client/src/localization/locales/en.json
```

社区语言包位于 [`docs-i18n` 上的 `ui/`](https://github.com/Pasta-Devs/Marinara-Engine/tree/docs-i18n/ui)，与各文档语言文件夹分开。每个 BCP-47 语言代码使用一个 JSON 文件，例如 `ui/pl.json`、`ui/ko.json` 或 `ui/pt-BR.json`，并共用生成的 `ui/manifest.json`，其中记录文件大小和 SHA-256 哈希。请严格保留语言代码的大小写。即使没有阿拉伯语文档包，也支持阿拉伯语界面。英语随应用加载；社区语言包由用户明确请求下载，并从本地服务器读取。

```json
{
  "_meta": {
    "locale": "pl",
    "direction": "ltr"
  },
  "chat.input.placeholder": "Napisz odpowiedź…",
  "common.actions.save": "Zapisz"
}
```

键名要按界面区域组织，写成语义化的名字。不要拿英文句子当键名，否则以后只是润色一下文案，所有翻译就全都失效了。

## 翻译规则

- 只翻译值，不要改语义化的键名。
- 保留 `{{name}}` 这类插值标记和 `<strong>` 这类富文本标签。
- 翻译键保持按字母顺序排列。
- Marinara Engine 这类产品名保持不变，除非项目正式启用了本地化名称。
- 含义和语气与 `en.json` 保持一致，不要添加英文原文没有的行为描述或承诺。
- 检查译好的标签在桌面端和移动端都放得下。

准备某个功能区域的翻译时，社区语言包可以暂时省略键。缺少的键会回退到英语。语言包验证器会报告覆盖率和过时的键，Engine 会忽略过时的键。空翻译（现有的有意留空的后缀例外除外）、格式错误的元数据，以及被改动的插值或富文本标记均无法通过验证。键重命名或删除后，应同步修改语言包，或通过 `[ui-i18n]` 后续议题跟踪。

功能 PR 必须添加或更新规范英语键，但无需修改社区语言包。只有能提供有用的翻译时，才应翻译社区语言包中的值。不要仅为保持各语言文件的键列表一致而到处复制英语值：回退机制已经提供英语文本，省略键还可以避免给翻译者带来不必要的合并冲突。

机器翻译可以作为初稿，前提是 PR 里注明了这一点。在把某种语言称为“已审校”之前，应该由母语者检查术语、语气、文字截断和移动端布局。

## 提交对已有翻译的修正

只是改几个措辞的话，用 GitHub 的网页编辑器就够了：

1. 打开
   [`ui/`](https://github.com/Pasta-Devs/Marinara-Engine/tree/docs-i18n/ui) 里的语言文件。
2. 点击铅笔图标编辑文件。需要时 GitHub 会提示先创建一个 fork。
3. 只改译文的值。键名、`{{name}}` 这类对标点敏感的标记以及 JSON
   语法都要原样保留。
4. 把改动提交到 fork 里一个专门的分支上。
5. 使用下面的命令刷新语言包清单并验证，然后向 **`docs-i18n`** 发起拉取请求，不要以 `staging` 或 `main` 为目标。
6. 在 PR 描述里写明语言、修正后的含义，以及自己是母语者还是借助了机器翻译。

标题写成 `Improve French UI translation` 这样的形式。同一种语言的多处相关修正可以合并到一个 PR 里。无关的代码改动要单独提。

## 提交一种新语言的翻译

添加新语言时，请保留一份 Engine 的 `staging` 工作副本作为英语源文件，并在 `docs-i18n` 上工作：

```bash
git clone https://github.com/YOUR-NAME/Marinara-Engine.git
cd Marinara-Engine
git checkout docs-i18n
git pull
git checkout -b translation/LOCALE
```

接着：

1. 将 Engine 工作副本中的规范 `en.json` 复制到 `ui/<locale>.json`，例如 `ui/it.json` 或 `ui/pt-PT.json`。
2. 让 `_meta.locale` 与去掉 `.json` 的文件名保持一致。
3. 把 `_meta.direction` 设为 `ltr` 或 `rtl`。
4. 按上面的规则翻译各个值。新增语言时最好把整份英文目录都翻译完，不过目录不完整也能回退到英文。
5. 生成清单并运行语言包验证器（只需 Node.js，无需安装依赖）。它会根据 Engine 工作副本中的英语目录报告覆盖率：

   ```bash
   node scripts/ui-i18n/validate-packs.mjs /path/to/Engine/packages/client/src/localization/locales/en.json --write-manifest
   node scripts/ui-i18n/validate-packs.mjs /path/to/Engine/packages/client/src/localization/locales/en.json
   ```

6. 新语言还需要一个小型 Engine PR，将语言代码添加到 `packages/shared/src/utils/ui-locales.ts` 中的 `UI_LANGUAGE_CODES`；更新现有语言包无需修改 Engine。发布后，在 **Settings > General** 中选择该语言，并在桌面和移动设备上检查长标签、工具提示、加载和错误状态，以及文本方向。
7. 把分支推到 fork，然后
   [提交 Pull Request](https://github.com/Pasta-Devs/Marinara-Engine/compare)，把
   `Pasta-Devs/Marinara-Engine:docs-i18n` 选作目标分支。

PR 描述里要说明语言、译文来源、语言熟练度或审校程度、跑过的校验命令，以及哪些地方还需要母语者审校。如实填写 PR 模板，只勾选自己亲自验证过的手动项。

## 在客户端代码里使用翻译

React 组件使用 `useTranslation`：

```tsx
import { useTranslation } from "react-i18next";

const { t } = useTranslation();
return <button>{t("common.actions.save")}</button>;
```

模块级的界面配置里存翻译键，不要存译好的文字。这样切换语言时不刷新页面也能立即生效。非 React 的客户端辅助代码可以用 `packages/client/src/localization/i18n.ts` 导出的 `translate` 函数。

所有可见文字都要翻译，包括标签、占位文字、工具提示、无障碍名称、替代文字、加载和空状态、toast 提示、确认框以及内置教程。不要把提示词或创作内容送进界面翻译器。

Settings 控件、帮助提示、窗口标题这类共用的旧组件，在调用点还没迁移完的这段时间里，也能识别与英文标准目录完全一致的字面值。这只是一座兼容性的桥，不是推荐用法：新写的组件和改动较大的组件仍然必须直接使用语义化的 `t("area.control.label")` 键。`en.json` 里不存在的英文句子是翻译不了的。

仓库的本地化检查还会扫描客户端 TSX，找出没有翻译的界面文案：

```bash
pnpm localization:ui-check
```

检查范围包括可见的 JSX、直接插值的标签和提示、无障碍名称、占位文字、加载和空状态、toast 提示以及确认框。`code`、`pre`、`script` 和 `style` 元素内部的字面内容有意不在检查范围内，这样命令、配置、URL、宏和其他面向机器的示例才能保持精确。动态的用户创作内容、生成内容、持久化内容、提示词和协议值，同样必须留在界面翻译器之外。

## 可下载智能体的界面

Engine 自有的智能体界面使用规范英语和已下载的 `docs-i18n/ui` 语言包。可下载能力客户端的翻译由各自在 Marinara-Agents 仓库中维护。

每个 capability 自定义元素都会通过 `lang` 和 `dir` 两个属性拿到当前选中的语言，此外还会收到：

```ts
capabilityProps.localization = {
  locale: "pl",
  direction: "ltr",
};
```

语言变化时会触发现有的 `marinara-capability-props` 事件。包内界面应当优先选用自己打包的语言文件，其次回退到包内英文，并在该事件之后重新渲染。
