# 自定义表情、贴纸和 GIF

上传你自己的 emoji 和贴纸，搜索 GIF，并控制角色在回复中可以使用哪些自定义 emoji 和贴纸。这些工具只在 Conversation(对话模式) 中可用。Roleplay(角色扮演) 和 Game Mode(游戏模式) 只有普通的 emoji 选择器。

## 这些工具在哪里

在 Conversation 聊天中，点击消息框旁边的圆形笑脸按钮 **Emoji, GIFs & stickers**(表情、GIF 与贴纸)。面板会在它上方打开（在手机上是键盘上方的抽出面板）。面板的选项卡有：

- **Emoji**：标准表情网格，另外有一个星标选项卡 **Custom emojis**(自定义表情)，用于存放你上传的图片。
- **GIFs**：实时 GIF 搜索。
- **Kaomoji**(颜文字)：文字表情，例如 `(^_^)`。
- **Stickers**(贴纸)：你上传的贴纸。

开启其他输入工具时，还会显示 **Tools**(工具) 选项卡。

## 上传自定义表情

自定义表情是一张小图片，只需上传一次，就能在任何 Conversation 聊天中使用。在消息中，你以短代码的形式输入它：即冒号之间的名字，例如 `:kekw:`。

1. 打开面板，进入 **Emoji**，然后点击星标选项卡 **Custom emojis**。
2. 点击 **Upload**(上传)，然后选择一个或多个图片文件。
3. 在 **Name this emoji** 窗口中输入名字，然后点击 **Add**(添加)。

表情会出现在 **Custom emojis** 网格中。

规则：

- 名字长度为 1 到 32 个字符，只能使用小写字母、数字和下划线。应用会替你转换其他字符。
- 图片最大为 256 x 256 像素。动态 GIF 文件可以使用，并会在聊天中播放。
- 名字必须唯一。如果名字已被占用，会显示 `An emoji named ":name:" already exists.`

如果没有成功：请对照上面的规则检查名字和图片尺寸。

## 使用自定义表情

点击 **Custom emojis** 网格中的一个格子。这会把它的短代码插入消息，但不会发送。你也可以按保存时的样子，用小写字母手动输入短代码。

在 Conversation 聊天中，短代码会以一张小的行内图片显示。如果一条消息只包含 emoji 短代码，它们会显示得更大。如果名字已不存在（例如你删除了它），消息会显示纯文本 `:kekw:`。

## 重命名、删除、导出和导入

点击 **Custom emojis** 选项卡顶部的 **Edit**(编辑)，即可开启编辑模式。

- 点击一个格子，打开 **Rename emoji**(重命名表情)，然后点击 **Rename**(重命名)。
- 点击格子上的垃圾桶标记即可删除它。**Delete emoji**(删除表情) 会提示：使用过它的消息将改为显示文字。
- 点击 **Export**(导出)，将你所有的自定义表情下载为 `marinara-custom-emojis.json`。图片都保存在该文件内。
- 点击 **Import**(导入)，加载之前导出的文件。它会跳过不符合名字或尺寸规则、或与已有名字冲突的表情。

## 自定义贴纸

贴纸是一张较大的图片，并单独占一行显示。通常你在 **Stickers** 选项卡中点击它；插入的文字是 `sticker:name:`。在 **Stickers** 选项卡中，点击 **Upload**，并像表情一样使用 **Edit**、**Export** 和 **Import**。区别如下：

- 上传窗口的标题是 **Name this sticker**(为此贴纸命名)。
- 最大图片为 512 x 512 像素（表情为 256 x 256）。
- 导出文件为 `marinara-custom-stickers.json`。

要发送贴纸，点击它的格子。**Send sticker**(发送贴纸) 窗口提供以下选项：

- **Send & reply**(发送并回复)：把贴纸作为一条单独的消息发出，并让角色作出回应。
- **Add to message**(加入消息)：把 `sticker:name:` 文字放入你的消息，方便你继续输入。

## 搜索 GIF

**GIFs** 选项卡搜索 Giphy，这是一个在线 GIF 库。你可以在搜索框中输入，也可以浏览热门列表，然后点击一个 GIF 将其发送。

**开始之前：** GIF 搜索需要一个免费的 Giphy API 密钥。密钥是一串秘密代码，让 Marinara 能代表你使用 Giphy 服务。没有密钥时，该选项卡会显示一张设置卡片。设置方法是编辑 `.env` 文件，这是 Marinara 的纯文本设置文件。它位于 Marinara 项目文件夹中；在 Docker 中则位于 `/app/data/.env`（参见[编辑 .env 文件](../CONFIGURATION.md#edit-the-env-file)）。

1. 打开 Giphy 开发者控制台，地址为 `https://developers.giphy.com/dashboard/`。
2. 为网页应用创建一个 API 密钥，并复制它。
3. 用文本编辑器打开 `.env` 文件。
4. 在文件末尾添加以下一行，把 `your_key_here` 替换为你的密钥，然后保存文件：

   ```text
   GIPHY_API_KEY=your_key_here
   ```

5. 重启 Marinara。也就是说，先停止它，然后按你平常的方式再次启动（参见[安装指南](../INSTALLATION.md)）。

GIF 结果采用 Giphy 的成人级分级。你无法在应用中更改它，因此结果可能包含成人 GIF。目前没有仅限安全内容的 GIF 来源。

## 将图库图片标记为表情或贴纸

角色图库或用户角色图库中的任何图片，都可以变成表情或贴纸。它只在包含该角色或用户角色的聊天中生效。

1. 打开 **Character Editor**(角色编辑器) 或 **Persona Editor**(用户角色编辑器)。
2. 打开 **Gallery**(图库) 选项卡，然后打开 **Images**(图片) 子选项卡。
3. 将鼠标悬停在图片上，然后点击其左上角的标记按钮。
4. 选择 **Make emoji**(设为表情) 或 **Make sticker**(设为贴纸)。
5. 在 **Custom Emoji** 或 **Custom Sticker** 窗口中输入名字。

标记按钮现在会显示该名字。同样的尺寸限制适用；图片太大时会显示红色错误。之后要修改，请再次点击标记按钮，选择 **Rename**(重命名)、切换选项（例如 **Switch to sticker**(改为贴纸)），或移除选项（例如 **Remove emoji**(移除表情)）。图片仍然是一张普通的图库图片。

## 候选偏好设置

Marinara 会告诉正在回复的角色，它可以使用哪些自定义表情和贴纸。要更改它的选择方式，请点击 **Custom emojis** 或 **Stickers** 选项卡顶部的齿轮图标 **Selection preferences**(候选偏好设置)。两者打开的是同一项设置，并按聊天分别保存。

- **Semantic**(语义，默认)：提供最符合近期对话的那些。它使用你电脑上的小型模型。如果无法使用，则随机挑选。
- **Random**(随机)：每次回复提供一组随机候选。
- **Tool-call**(工具调用)：每次回复由模型挑选合适的项。在 **Select a model…** 中选择一个模型。如果没有设置模型或调用失败，则使用语义模式。当群聊中一轮有多个角色回复时，会跳过 Tool-call。

**Max offered (each)**(每类最多候选数) 表示每一轮提供给角色的表情名和贴纸名各有多少个。默认为 20，可设为 1 到 100。

## 回应只使用你的主自定义表情

你可以用自定义表情回应一条消息，但只能使用你在 **Custom emojis** 选项卡中上传的表情。图库中标记的表情、贴纸和 GIF 不能用作回应。参见[回应与通知](getting-started.md#react-and-get-notified)。

## 相关指南

- [Conversation 模式：入门](getting-started.md)
- [角色与用户角色图库](../characters/galleries.md)
- [服务器配置参考](../CONFIGURATION.md)
