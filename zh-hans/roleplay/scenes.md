# 场景：分支出一段角色扮演

场景是从 Conversation(对话模式) 聊天里分支出来的一段短小的角色扮演。想插一段闪回、一次约会或一场打斗，又不想丢掉主线时，就用它。

每个场景都是一段独立的 Roleplay 聊天，有自己的背景、角色和开场消息。场景开着的时候，原来的 Conversation 聊天里会出现一张卡片，写着 **A scene is in progress**，上面有一个 **Go to Scene**(前往场景) 按钮。

场景进行期间，场景里的角色不会在 Conversation 聊天里回复，聊天里会有提示说明它们正在一个进行中的场景里。如果仍想让它们在那里回答你，就在卡片上开启 **Allow replies here**(允许在这里回复)。这个开关默认关闭。开启后，你给场景角色发消息时它们会回复，但它们仍不会主动在那里发消息。

## 开始一个场景

开始之前：打开一段已经有一些消息的 Conversation 聊天。见 [Conversation 模式：入门](../conversation/getting-started.md)。

1. 在消息框里输入 `/scene` 和一句简短描述。`/rp` 的效果一样。例如：`/scene we sneak into the old library at midnight`
2. 按 <kbd>Enter</kbd>。**Scene Prompt Setup**(场景提示词设置) 会打开。
3. 如果看到 **Scene persona**(场景用户角色)，选择由谁来扮演你。**Use the Conversation persona**(使用 Conversation 聊天的用户角色) 会沿用这段 Conversation 的用户角色。
4. 如果看到 **Scene characters**(场景角色)，保持 **Let the scene planner choose characters**(让场景规划器选择角色) 开启，就由 Marinara 来挑。也可以关掉它，自己选择至少一个角色。
5. 选择一个 **Prompt preset**(提示词预设)。保留 **None**(无)，就使用默认 Roleplay [设置方案](../chats/settings-profiles.md#choosing-the-default-profile)的预设。Marinara 会记住你的选择，供下一个场景使用。
6. 在 **POV**(视角) 下选择 **First Person**、**Second Person** 或 **Third Person**。
7. 在 **Tense**(时态) 下选择 **Past**、**Present** 或 **Future**。
8. 可选：在 **Extra instructions**(额外说明) 里写点提示，引导场景走向。
9. 点击 **Plan Scene**(规划场景)。

场景会作为一段新的 Roleplay 聊天出现在你的聊天列表里，开场消息交代好当前情境。在设置窗口里点击 **Cancel**(取消)，就会停下来，不创建场景。

只要聊天积累了足够多的历史，单独输入 `/scene` 也行。如果聊天里还一条消息都没有，Marinara 会请你先补一句描述，或者先聊几句。

角色也可以提议开始一个场景。它的回复旁会出现一个 **Set up scene**(设置场景) 邀请。点击它打开 **Scene Prompt Setup**，然后从第 3 步接着做。**Cancel** 会关闭设置，邀请仍然可用，刷新页面后也一样。

场景的开场方式：

- 和任何新建的 Roleplay 聊天一样，它以你的默认 Roleplay 设置方案为基础。[设置方案](../chats/settings-profiles.md)是一组保存下来的聊天设置。
- 场景规划里有的话，会先发出一条旁白消息，简短说明这个场景怎么演，再以第二条旁白消息发出场景描述。规划里没有说明时，就跳过它。
- 只有一个角色时，开场以这个角色的口吻写成，说出口的话放在双引号里，除非你的写作指令规定了别的风格。
- 群组场景的开场遵循方案里的群聊模式。默认是 **Merged (Narrator)**(合并叙述)：一条回复演完所有角色。在 **Individual**(各自独立) 模式下，由负责开场的角色来写。见[群聊](../chats/group-chats.md#choose-who-speaks)。

## 使用场景操作条

在场景里，消息框上方有一条操作条，决定这个场景的去向。显示哪些按钮，取决于场景有没有来源聊天。

| 按钮 | 作用 |
| --- | --- |
| **Back to conversation**(返回聊天) | 回到开启这个场景的 Conversation 聊天。场景仍然开着。只有存在来源聊天时才显示。 |
| **End Scene**(结束场景) | 保存一份摘要并结束场景。在 **End and save summary?** 处点击 **Yes**。 |
| **Discard**(丢弃) | 删除场景，什么都不保存。在 **Discard scene?** 处点击 **Yes**。 |
| **Convert**(转换) | 把场景变成一段独立的 Roleplay。见下文。 |

**End Scene** 会显示 **Saving...**，把一份简短摘要作为记忆写进来源聊天，然后把你带回那里。**Discard** 什么都不留。两者都会把场景从你的聊天里移除。

## 从某条消息复刻场景

想把场景复制到某条消息为止、另外接着演，同时让原场景保持打开：

1. 把鼠标悬停在想分支的那条消息上。
2. 点击它的 **Clone from here**(从这里克隆) 操作。

Marinara 会新建一段独立的 Roleplay，包含到这条消息为止（含这条）的所有消息，显示一条确认提示，然后打开它。

## 把场景转换成 Roleplay

场景已经演成了一个你想当作普通 Roleplay 留下来的故事时，就用 **Convert**。

1. 点击场景操作条上的 **Convert**。
2. 阅读 **Convert this scene into a standalone roleplay?** 下面的说明：它会基于场景新建一段 Roleplay 聊天，并把原场景从它所属的聊天里剥离。不会有场景摘要或角色记忆写回去。
3. 点击 **Convert**；点击 **Cancel** 则什么都不改。

Clone 会保留原场景，Convert 不会。

## 场景与已连接聊天

场景是自成一体的。即便父级聊天连接了 Conversation，场景也不会从那边取上下文，而且它会忽略已连接的聊天可以发给关联 Roleplay 的简短引导提示。想在聊天和角色扮演之间保持持续的双向联动，就用已连接聊天。见[把 Conversation 聊天连接到 Roleplay 或 Game](../chats/connected-chats.md)。

## 相关指南

- [Roleplay 模式：入门](getting-started.md)
- [聊天分支](../chats/branches.md)
- [把 Conversation 聊天连接到 Roleplay 或 Game](../chats/connected-chats.md)
